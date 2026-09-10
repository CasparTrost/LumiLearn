#!/usr/bin/env python3
"""
Generates the LumiLearn maze wall/floor tilesets via the PixelLab API.

WHY THIS SCRIPT EXISTS: Claude Code's remote execution environment blocks
outbound network access to api.pixellab.ai (org egress policy) — so this
script can't be run by Claude directly. Run it yourself, locally, with
your PixelLab API key. It only spends credits on the two tileset calls
below (one per maze theme) and asks for confirmation first, since the
free tier only has 40 generations total.

Setup:
    pip install pixellab
    export PIXELLAB_API_KEY="your-key-here"
    python3 scripts/generate-maze-tileset.py

What it does:
    1. Prints your current credit balance (if the SDK exposes it) so you
       can see the cost before committing.
    2. Asks for a y/n confirmation before spending anything.
    3. Generates ONE Wang tileset for the dungeon theme (used levels 4+)
       and ONE for the forest theme (used levels 1-3) via
       create_topdown_tileset — each call produces a full seamless set
       of wall/corner/floor tiles in one shot, rather than us hand-
       picking or hand-fixing individual tile files again.
    4. Saves the results to ./pixellab-output/ with clear filenames.

After it finishes: send the files in ./pixellab-output/ back — they'll
get sliced up and wired into src/games/MazeGame.jsx / mazeGen.js to
replace the current hand-picked mw_*.png / forest_*.png tile lookups.

NOTE ON PARAMETERS: create_topdown_tileset's exact parameter names
(lower_description, upper_description, tile_size, transition_height,
base_tile_id) are taken from PixelLab's own docs/examples — I could not
reach api.pixellab.ai from the sandboxed environment to verify them
against the live schema. If the SDK rejects a parameter name, run
`python3 -c "import pixellab; help(pixellab.Client.create_topdown_tileset)"`
first to see the exact signature installed on your machine, and adjust
the calls below accordingly BEFORE re-running (so you don't waste a
generation on a call that was going to fail anyway).
"""

import os
import sys

try:
    import pixellab
except ImportError:
    print("Missing dependency. Run:  pip install pixellab")
    sys.exit(1)

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "pixellab-output")
TILE_SIZE = 32  # matches the existing sprites well (16px dungeon / 48px
                 # forest tiles both scale cleanly); bump to 64 for more
                 # detail if you have credits to spare, but 32 is the
                 # recommended balance of quality vs. cost on a 40-gen budget.

TILESETS = [
    {
        "name": "dungeon",
        "lower_description": "smooth dark grey dungeon stone floor, subtle cracks, top-down view",
        "upper_description": "dark stone dungeon wall with mortar lines and a bit of moss, top-down view",
        "out_file": "dungeon_tileset.png",
    },
    {
        "name": "forest",
        "lower_description": "bright green grass path, top-down view",
        "upper_description": "dense dark green forest hedge wall, leafy, top-down view",
        "out_file": "forest_tileset.png",
    },
]


def main():
    api_key = os.environ.get("PIXELLAB_API_KEY")
    if not api_key:
        print("Set PIXELLAB_API_KEY first, e.g.:")
        print('  export PIXELLAB_API_KEY="your-key-here"')
        sys.exit(1)

    client = pixellab.Client(secret=api_key)

    # Show balance up front if the SDK exposes it — best-effort, don't
    # fail the whole script if this particular call/attr doesn't exist.
    try:
        balance = client.get_balance()
        print(f"Current PixelLab balance: {balance}")
    except Exception as e:
        print(f"(Could not fetch balance — continuing anyway: {e})")

    print(f"\nAbout to generate {len(TILESETS)} tileset(s) at {TILE_SIZE}x{TILE_SIZE}px:")
    for t in TILESETS:
        print(f"  - {t['name']}: lower='{t['lower_description']}' / upper='{t['upper_description']}'")
    print("\nThis WILL spend generations from your free-tier balance.")
    confirm = input("Continue? [y/N] ").strip().lower()
    if confirm != "y":
        print("Aborted — nothing was generated.")
        return

    os.makedirs(OUT_DIR, exist_ok=True)

    for t in TILESETS:
        print(f"\nGenerating '{t['name']}' tileset...")
        try:
            result = client.create_topdown_tileset(
                lower_description=t["lower_description"],
                upper_description=t["upper_description"],
                tile_size=TILE_SIZE,
            )
        except TypeError as e:
            print(f"  Parameter mismatch calling create_topdown_tileset: {e}")
            print("  Run: python3 -c \"import pixellab; help(pixellab.Client.create_topdown_tileset)\"")
            print("  to see the exact signature, fix the call above, and re-run.")
            continue
        except Exception as e:
            print(f"  Generation failed: {e}")
            continue

        out_path = os.path.join(OUT_DIR, t["out_file"])
        # The SDK's return shape isn't something I could verify without
        # network access — try the common possibilities.
        image = getattr(result, "image", None) or getattr(result, "tileset", None) or result
        if hasattr(image, "save"):
            image.save(out_path)
        elif isinstance(image, (bytes, bytearray)):
            with open(out_path, "wb") as f:
                f.write(image)
        else:
            print(f"  Unrecognized result shape ({type(result)}) — inspect manually:")
            print(f"  {result!r}")
            continue

        print(f"  Saved -> {out_path}")

    print(f"\nDone. Send me everything in {OUT_DIR}/ and I'll wire it into the game.")


if __name__ == "__main__":
    main()
