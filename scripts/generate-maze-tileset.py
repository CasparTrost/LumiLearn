#!/usr/bin/env python3
"""
Generates the LumiLearn maze wall/floor tilesets via the PixelLab API.

This file is standalone — it does NOT need to live inside the LumiLearn
repo or be run from any particular folder. Save it anywhere (Desktop is
fine) and run it from there; its output folder is created right next to
wherever this .py file itself is saved, not relative to your current
directory.

WHY THIS SCRIPT EXISTS: Claude Code's remote execution environment blocks
outbound network access to api.pixellab.ai (org egress policy), so this
can't be run from within a Claude Code session — it's meant to be run
locally by whoever holds the PixelLab API key.

Setup:
    pip install pixellab
    pip install requests    # only used as a fallback, see below

    macOS / Linux (bash/zsh), from the folder where you saved this file:
        export PIXELLAB_API_KEY="your-key-here"
        python3 generate-maze-tileset.py

    Windows (PowerShell), from the folder where you saved this file
    (e.g. cd $env:USERPROFILE\Desktop):
        $env:PIXELLAB_API_KEY = "your-key-here"
        python generate-maze-tileset.py

    Windows (cmd.exe):
        set PIXELLAB_API_KEY=your-key-here
        python generate-maze-tileset.py

    The env var only lasts for the current terminal session — set it
    again if you open a new window.

What it does:
    1. Prints your current credit/generation balance (client.get_balance())
       so you can see what you're spending before committing.
    2. Asks for a y/n confirmation before spending anything.
    3. Generates ONE Wang tileset for the dungeon theme (used levels 4+)
       and ONE for the forest theme (used levels 1-3) via
       client.generate_tileset() — POST /v2/create-tileset. Each call
       produces a full 16-tile (or 25-tile at transition_size=1.0)
       seamlessly-connecting set in one shot: you describe the "lower"
       (walkable floor) and "upper" (wall) terrain and it returns every
       corner/edge combination already matching, rather than us hand-
       picking or hand-fixing individual tile files (see the wall-tile
       -orientation fix earlier in this branch's history).
    4. Saves every tile image to ./pixellab-output/<theme>/, plus a
       tiles.json per theme with each tile's id, name, corner
       classification (NW/NE/SW/SE: "lower"/"upper"/"transition") and
       pattern_4x4 — the data needed to wire this into the game's tile
       -selection logic afterwards.

VERIFIED AGAINST THE LIVE OPENAPI SPEC (api.pixellab.ai/v2/openapi.json)
on 2026-09-10 — not guessed. Two things worth knowing going in:

  - The Wang tileset PixelLab returns is CORNER-based (each tile is
    classified by its 4 corner vertices being "lower" or "upper"
    terrain, with `pattern_4x4` for matching), not the simple
    edge-based 4-neighbour lookup the current wallSprite() function in
    MazeGame.jsx uses. Wiring the generated tiles in will need a small
    adaptation on the game side — that's a follow-up step once the
    actual tiles exist, not something this script needs to solve.
  - tile_size for standard mode only accepts 16 or 32 per side (64 is
    an experimental "pro" mode option, not requested here).

After it finishes: send everything in ./pixellab-output/ back — it'll
get wired into src/games/MazeGame.jsx / mazeGen.js to replace the
current hand-picked mw_*.png / forest_*.png tile lookups.
"""

import base64
import json
import os
import sys
import time

try:
    import pixellab
except ImportError:
    print("Missing dependency. Run:  pip install pixellab")
    sys.exit(1)

try:
    import requests
except ImportError:
    requests = None  # only needed for the HTTP fallback below

OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pixellab-output")

# Used only as a fallback when the installed pixellab SDK doesn't expose
# generate_tileset() yet (i.e. the SDK is older than the live API). Talks
# to the REST endpoint directly instead, per api.pixellab.ai/v2/docs.
API_BASE = "https://api.pixellab.ai/v2"

# v2 prompts — round 1 (grey-on-grey dungeon, muted overall) read as
# "flat"/"trist" rather than "schön" once actually in the game. Rewritten
# for a crisper, more modern-game look: bolder outlines, more saturated/
# higher-contrast colours, clearly legible patterns rather than a noisy
# realistic texture.
#
# transition_size + shape_style: the API rejected a bare 0.15 — standard/
# pro mode only accepts transition_size 0/0.25/0.5/1.0 UNLESS shape_style
# is explicitly 'square' or 'round', which unlocks any value in between
# (per the live 422 response). 'square' also happens to fit "clear
# contours" better than the default anyway — blocky/sharp transitions
# instead of a rounded blend — so both the value and the shape it was
# aiming for are set explicitly now.
# tile_size: 32 is the recommended balance of quality vs. cost (16 or 32
# are the only standard-mode options).
TILESETS = [
    {
        "name": "dungeon",
        "lower_description": "dark blue-grey stone floor, modern pixel art game style, clean crisp geometric tile pattern, bold clear outlines, high contrast, saturated cool tones",
        "upper_description": "sturdy stone brick wall, modern pixel art game style, bold clean outlines, clearly defined brick pattern, bright highlighted top edge, high contrast, saturated cool tones",
        "transition_description": "crisp sharp contour where floor meets wall, clean bold edge line",
        "tile_size": {"width": 32, "height": 32},
        "transition_size": 0.15,
        "shape_style": "square",
        "view": "low top-down",
    },
    {
        "name": "forest",
        "lower_description": "vibrant green grass path with small clover and pebble details, modern pixel art game style, clean crisp pattern, bold clear outlines, saturated colors",
        "upper_description": "dense leafy hedge wall, modern pixel art game style, bold clean outlines, clearly defined individual leaf clusters, saturated vibrant green, bright highlighted top edge, high contrast",
        "transition_description": "crisp sharp contour where grass meets hedge, clean bold edge line",
        "tile_size": {"width": 32, "height": 32},
        "transition_size": 0.15,
        "shape_style": "square",
        "view": "low top-down",
    },
]


def save_tile_image(tile, out_path):
    """Tile images come back as base64 (per the PixelLab SDK's Base64Image
    type — same shape used across the API, see the docs' `.pil_image()`
    examples). Handle both the SDK object form and a plain dict, since we
    don't have a live install to check the exact attribute access against."""
    image = getattr(tile, "image", None)
    if image is None and isinstance(tile, dict):
        image = tile.get("image")

    if image is not None and hasattr(image, "pil_image"):
        image.pil_image().save(out_path)
        return True

    b64 = getattr(image, "base64", None) if image is not None else None
    if b64 is None and isinstance(image, dict):
        b64 = image.get("base64")
    if b64:
        # base64 field may be a raw string or a data: URI
        if "," in b64 and b64.strip().startswith("data:"):
            b64 = b64.split(",", 1)[1]
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(b64))
        return True

    return False


def tile_to_metadata(tile):
    def get(obj, key):
        return getattr(obj, key, None) if not isinstance(obj, dict) else obj.get(key)

    corners = get(tile, "corners")
    pattern = get(tile, "pattern_4x4")
    return {
        "id": get(tile, "id"),
        "name": get(tile, "name"),
        "description": get(tile, "description"),
        "corners": corners if isinstance(corners, dict) else (corners.__dict__ if corners else None),
        "pattern_4x4": pattern if isinstance(pattern, dict) else (pattern.__dict__ if pattern else None),
    }


IN_PROGRESS_STATUSES = {"processing", "pending", "queued", "running", "started"}


def call_generate_tileset_http(api_key, t):
    """Fallback for when the installed SDK doesn't have generate_tileset()
    yet. Talks to POST /create-tileset directly. Returns a plain dict —
    tile_to_metadata()/save_tile_image() already handle dict-shaped tiles,
    so no separate parsing path is needed below."""
    if requests is None:
        raise RuntimeError("The 'requests' package is needed for this fallback. Run: pip install requests")

    resp = requests.post(
        f"{API_BASE}/create-tileset",
        headers={"Authorization": f"Bearer {api_key}"},
        json={
            "lower_description": t["lower_description"],
            "upper_description": t["upper_description"],
            "transition_description": t["transition_description"],
            "tile_size": t["tile_size"],
            "transition_size": t["transition_size"],
            "shape_style": t.get("shape_style"),
            "view": t["view"],
        },
        timeout=180,
    )
    if resp.status_code >= 400:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:800]}")
    return resp.json()


def as_dict(obj):
    if isinstance(obj, dict):
        return obj
    if obj is None:
        return {}
    return getattr(obj, "__dict__", {}) or {}


def find_tiles(data):
    """generate_tileset() is async: the initial response is just a job
    stub ({background_job_id, tileset_id, status}), not the tiles. Once
    the job is done, the tiles could plausibly show up in a few
    different spots depending on exactly how the finished payload is
    shaped — try each, in order."""
    d = as_dict(data)
    candidates = [
        as_dict(d.get("tileset")).get("tiles"),
        as_dict(as_dict(d.get("result")).get("tileset")).get("tiles"),
        as_dict(d.get("result")).get("tiles"),
        d.get("tiles"),
    ]
    for tiles in candidates:
        if tiles:
            return tiles
    return None


def resolve_tileset(api_key, response):
    """Given the immediate response from generate_tileset()/create-tileset,
    return the finished tile list — polling the async job first if the
    response is just a job stub rather than the finished tileset."""
    tiles = find_tiles(response)
    if tiles:
        return tiles

    d = as_dict(response)
    job_id = d.get("background_job_id")
    tileset_id = d.get("tileset_id")
    if not job_id:
        # Not a job stub and no tiles either — nothing more we can do here.
        return None

    if requests is None:
        raise RuntimeError(
            "This API call is async (returned a background_job_id) but the "
            "'requests' package isn't installed to poll for the result. Run: pip install requests"
        )

    headers = {"Authorization": f"Bearer {api_key}"}
    job_url = f"{API_BASE}/background-jobs/{job_id}"
    print(f"  Job queued ({job_id}) — polling until it finishes...")
    data = None
    for attempt in range(90):  # up to ~7.5 minutes at 5s intervals
        resp = requests.get(job_url, headers=headers, timeout=60)
        if resp.status_code >= 400:
            raise RuntimeError(f"Polling job status failed: HTTP {resp.status_code}: {resp.text[:500]}")
        data = resp.json()
        status = data.get("status")
        if status not in IN_PROGRESS_STATUSES:
            print(f"  Job finished with status={status}")
            break
        if attempt % 6 == 0:  # log roughly every 30s, not every 5s
            print(f"  ...still {status} ({attempt * 5}s elapsed)")
        time.sleep(5)
    else:
        raise RuntimeError(
            f"Job {job_id} was still processing after ~7.5 minutes. "
            f"It's still running on PixelLab's side — check back later "
            f"(tileset_id={tileset_id})."
        )

    tiles = find_tiles(data)
    if tiles:
        return tiles

    if tileset_id:
        print(f"  Tiles not found directly in job result — trying GET /tilesets/{tileset_id}...")
        resp2 = requests.get(f"{API_BASE}/tilesets/{tileset_id}", headers=headers, timeout=60)
        if resp2.status_code < 400:
            data2 = resp2.json()
            tiles = data2.get("tiles") or find_tiles(data2) or find_tiles({"tileset": data2})
            if tiles:
                return tiles
        else:
            print(f"  GET /tilesets/{{id}} failed too: HTTP {resp2.status_code}: {resp2.text[:500]}")

    print(f"  Could not locate tiles automatically. Raw finished job payload:\n  {data!r}")
    return None


def main():
    api_key = os.environ.get("PIXELLAB_API_KEY")
    if not api_key:
        print("Set PIXELLAB_API_KEY first — see the setup instructions at the top of this file.")
        sys.exit(1)

    client = pixellab.Client(secret=api_key)

    version = getattr(pixellab, "__version__", None)
    print(f"pixellab SDK version: {version or 'unknown'}")

    use_sdk = hasattr(client, "generate_tileset")
    if not use_sdk:
        print(
            "\nNote: your installed pixellab SDK does not have generate_tileset() yet.\n"
            "This usually means it's outdated — try this first, in a NEW terminal\n"
            "(so PIXELLAB_API_KEY is still set), then re-run this script:\n"
            "    pip install --upgrade pixellab\n"
            "\nFor this run, falling back to calling the REST API directly instead\n"
            "(POST /create-tileset) — no SDK update needed for it to work.\n"
        )

    try:
        balance = client.get_balance()
        print(f"Current PixelLab balance: {balance}")
    except Exception as e:
        print(f"(Could not fetch balance — continuing anyway: {e})")

    print(f"\nAbout to generate {len(TILESETS)} tileset(s):")
    for t in TILESETS:
        print(f"  - {t['name']}: lower='{t['lower_description']}' / upper='{t['upper_description']}' "
              f"({t['tile_size']['width']}x{t['tile_size']['height']}px, view={t['view']})")
    print("\nThis WILL spend generations/credits from your account.")
    confirm = input("Continue? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted — nothing was generated.")
        return

    os.makedirs(OUT_DIR, exist_ok=True)

    for t in TILESETS:
        print(f"\nGenerating '{t['name']}' tileset ({t['view']}, transition_size={t['transition_size']})...")
        try:
            if use_sdk:
                kwargs = dict(
                    lower_description=t["lower_description"],
                    upper_description=t["upper_description"],
                    transition_description=t["transition_description"],
                    tile_size=t["tile_size"],
                    transition_size=t["transition_size"],
                    view=t["view"],
                )
                if t.get("shape_style"):
                    kwargs["shape_style"] = t["shape_style"]
                response = client.generate_tileset(**kwargs)
            else:
                response = call_generate_tileset_http(api_key, t)
        except TypeError as e:
            print(f"  Parameter mismatch calling generate_tileset: {e}")
            print("  Run: python3 -c \"import pixellab; help(pixellab.Client.generate_tileset)\"")
            print("  to see the exact signature installed on your machine, fix the call above, and re-run.")
            continue
        except Exception as e:
            print(f"  Generation failed: {e}")
            if not use_sdk:
                print(
                    "  (This was the HTTP fallback — if this says 401/403, the auth header\n"
                    "  name/format this script guessed (Authorization: Bearer <key>) may be\n"
                    "  wrong. Send me this exact error and I'll correct it.)"
                )
            continue

        try:
            tiles = resolve_tileset(api_key, response)
        except Exception as e:
            print(f"  Failed while waiting for the result: {e}")
            continue
        if not tiles:
            continue

        theme_dir = os.path.join(OUT_DIR, t["name"])
        os.makedirs(theme_dir, exist_ok=True)

        metadata = []
        saved = 0
        for i, tile in enumerate(tiles):
            meta = tile_to_metadata(tile)
            fname = f"{i:02d}_{(meta['name'] or 'tile').replace('+', '-').replace(' ', '_')}.png"
            out_path = os.path.join(theme_dir, fname)
            if save_tile_image(tile, out_path):
                saved += 1
                meta["file"] = fname
            else:
                print(f"  Could not extract image for tile {i} ({meta.get('name')}) — inspect manually")
            metadata.append(meta)

        with open(os.path.join(theme_dir, "tiles.json"), "w") as f:
            json.dump(metadata, f, indent=2)

        print(f"  Saved {saved}/{len(tiles)} tiles -> {theme_dir}/")

    print(f"\nDone. Send me everything in {OUT_DIR}/ and I'll wire it into the game.")


if __name__ == "__main__":
    main()
