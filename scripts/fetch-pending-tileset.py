#!/usr/bin/env python3
"""
One-off helper: fetches the two tileset generations that were already
triggered by generate-maze-tileset.py (they run async on PixelLab's
servers — the main script didn't wait for them the first time this was
run, but the jobs themselves already started and are NOT re-triggered
by this script, so running this costs nothing extra).

Standalone — save anywhere and run it. Needs PIXELLAB_API_KEY set the
same way as before.

    python fetch-pending-tileset.py

If PixelLab's "processing" status takes a while, just re-run this
script again in a minute or two — it always re-polls fresh, it never
starts a new generation.
"""

import base64
import json
import os
import sys
import time

try:
    import requests
except ImportError:
    print("Missing dependency. Run:  pip install requests")
    sys.exit(1)

API_BASE = "https://api.pixellab.ai/v2"
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "pixellab-output")

# The two jobs already started by the previous run of
# generate-maze-tileset.py — do NOT change these to start new ones.
JOBS = {
    "dungeon": {
        "background_job_id": "59d50bde-0083-4613-ba8e-b76809634336",
        "tileset_id": "d3a0f969-3527-4b54-9dc2-5724ed28bd24",
    },
    "forest": {
        "background_job_id": "401f6b45-f1ed-4914-8554-23198187b30a",
        "tileset_id": "257c2cf5-e426-49de-bdc5-8a5a4e2f5db2",
    },
}

IN_PROGRESS_STATUSES = {"processing", "pending", "queued", "running", "started"}


def save_tile_image(tile, out_path):
    image = tile.get("image") if isinstance(tile, dict) else None
    b64 = None
    if isinstance(image, dict):
        b64 = image.get("base64")
    elif isinstance(image, str):
        b64 = image
    if not b64:
        return False
    if "," in b64 and b64.strip().startswith("data:"):
        b64 = b64.split(",", 1)[1]
    try:
        with open(out_path, "wb") as f:
            f.write(base64.b64decode(b64))
        return True
    except Exception:
        return False


def tile_to_metadata(tile):
    return {
        "id": tile.get("id"),
        "name": tile.get("name"),
        "description": tile.get("description"),
        "corners": tile.get("corners"),
        "pattern_4x4": tile.get("pattern_4x4"),
    }


def try_extract_tiles(data):
    """The completed-job payload shape isn't confirmed yet, so try the
    plausible spots in order and report which one worked."""
    candidates = [
        ("tileset.tiles", (data.get("tileset") or {}).get("tiles") if isinstance(data.get("tileset"), dict) else None),
        ("result.tileset.tiles", ((data.get("result") or {}).get("tileset") or {}).get("tiles") if isinstance(data.get("result"), dict) else None),
        ("result.tiles", (data.get("result") or {}).get("tiles") if isinstance(data.get("result"), dict) else None),
        ("tiles", data.get("tiles")),
    ]
    for label, tiles in candidates:
        if tiles:
            return label, tiles
    return None, None


def poll_job(api_key, name, ids):
    headers = {"Authorization": f"Bearer {api_key}"}
    job_url = f"{API_BASE}/background-jobs/{ids['background_job_id']}"

    print(f"\nPolling '{name}' (job {ids['background_job_id']})...")
    data = None
    for attempt in range(60):  # up to ~5 minutes at 5s intervals
        resp = requests.get(job_url, headers=headers, timeout=60)
        if resp.status_code >= 400:
            print(f"  HTTP {resp.status_code}: {resp.text[:500]}")
            return
        data = resp.json()
        status = data.get("status")
        print(f"  [{attempt+1}] status={status}")
        if status not in IN_PROGRESS_STATUSES:
            break
        time.sleep(5)
    else:
        print("  Still processing after ~5 minutes — just re-run this script again later.")
        return

    theme_dir = os.path.join(OUT_DIR, name)
    os.makedirs(theme_dir, exist_ok=True)
    with open(os.path.join(theme_dir, "job-result-raw.json"), "w") as f:
        json.dump(data, f, indent=2)

    label, tiles = try_extract_tiles(data)

    if not tiles:
        # Completed but not in a shape we anticipated — try fetching the
        # tileset directly by id as a second attempt.
        print(f"  status={data.get('status')} but no tiles found in the job payload directly.")
        print(f"  Trying GET /tilesets/{ids['tileset_id']} as a second lookup...")
        resp2 = requests.get(f"{API_BASE}/tilesets/{ids['tileset_id']}", headers=headers, timeout=60)
        if resp2.status_code < 400:
            data2 = resp2.json()
            with open(os.path.join(theme_dir, "tileset-raw.json"), "w") as f:
                json.dump(data2, f, indent=2)
            label, tiles = try_extract_tiles(data2) if data2.get("tiles") is None else ("tiles", data2.get("tiles"))
            if not tiles and isinstance(data2, dict):
                label, tiles = try_extract_tiles({"tileset": data2})
        else:
            print(f"  GET /tilesets/{{id}} failed too: HTTP {resp2.status_code}: {resp2.text[:500]}")

    if not tiles:
        print(f"  Could not locate tile images automatically. Full raw JSON saved to")
        print(f"  {theme_dir}/job-result-raw.json — send me that file and I'll fix the extraction.")
        return

    print(f"  Found tiles via '{label}' ({len(tiles)} tiles). Saving images...")
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
            print(f"    Could not extract image for tile {i} ({meta.get('name')})")
        metadata.append(meta)

    with open(os.path.join(theme_dir, "tiles.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"  Saved {saved}/{len(tiles)} tiles -> {theme_dir}/")


def main():
    api_key = os.environ.get("PIXELLAB_API_KEY")
    if not api_key:
        print("Set PIXELLAB_API_KEY first (same as before).")
        sys.exit(1)

    os.makedirs(OUT_DIR, exist_ok=True)
    for name, ids in JOBS.items():
        poll_job(api_key, name, ids)

    print(f"\nDone. Send me everything in {OUT_DIR}/ (including any job-result-raw.json /")
    print("tileset-raw.json if tiles weren't found automatically).")


if __name__ == "__main__":
    main()
