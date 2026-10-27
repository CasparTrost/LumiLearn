#!/usr/bin/env python3
"""
Pixel-art pictures for the game tiles on the home screen
(public/sprites/tiles/<module-id>.png, 128 x 128).

One image call draws a whole SHEET of pictures (default 3 x 3 = 9), which is
cut into cells afterwards — nine pictures for the price of one call.

Uses gpt-image-2 through CometAPI (OpenAI-compatible images endpoint). The
key is never in this file: in a Claude Code cloud session it is a network
secret injected for api.cometapi.com; locally set COMETAPI_KEY.

Two CometAPI quirks this works around (seen 2026-10):
  • background "transparent" fails with 502 "upstream request failed" after
    ~30 s, so sheets come on solid magenta and the magenta is keyed out;
  • medium/high quality often exceeds CometAPI's upstream time limit;
    quality "low" finishes in ~15–20 s and looks the same once the picture
    is scaled down to pixel-art size.

Usage:
    python3 scripts/generate-tile-art.py numbers letters maze ...   # ids
    python3 scripts/generate-tile-art.py --all
"""
import base64, io, json, os, subprocess, sys
from collections import deque

import numpy as np
from PIL import Image

OUT  = os.path.join(os.path.dirname(__file__), '..', 'public', 'sprites', 'tiles')
WORK = os.path.join(os.path.dirname(__file__), '..', '.tile-art-work')   # raw sheets, git-ignored
API  = 'https://api.cometapi.com/v1/images/generations'

# id: (what the picture shows, may it contain letters/digits?)
TILES = {
    'number-intro':  ("a wooden abacus with colorful beads next to a big friendly smiling number 3", True),
    'letter-intro':  ("three stacked wooden toy blocks showing the capital letters A, B and C", True),
    'emotions':      ("two cute round faces side by side, one laughing yellow face and one sad blue face with a tear", False),
    'listen':        ("a big friendly cartoon ear with colorful sound waves and a musical note", False),
    'shadows':       ("a cute orange cat sitting next to its own pitch black silhouette", False),
    'shapes':        ("a painter's palette with a brush and blobs of paint, next to a red circle, blue square and yellow triangle", False),
    'numbers':       ("three colorful toy number blocks showing 1, 2 and 3 with a small plus sign", True),
    'letters':       ("a small cute tree whose leaves are colorful square letter tiles", True),
    'words2':        ("two colorful jigsaw puzzle pieces clicking together, each with a big letter on it", True),
    'bubbles':       ("three shiny rainbow soap bubbles floating, each with a number 1, 2, 3 inside", True),
    'words':         ("three memory game cards, two face down with a star pattern and one flipped showing a red strawberry", False),
    'patterns':      ("a string of colorful wooden beads in a repeating red blue yellow pattern ending with a glowing question mark bead", False),
    'sort':          ("a woven basket with apples, a teddy bear and toy blocks neatly sorted", False),
    'weight':        ("a golden balance scale tipped to one side, a big red apple on the low side and a white feather on the high side", False),
    'clock':         ("a cute round red alarm clock with a smiling face and bells on top", False),
    'maze':          ("a small green hedge maze seen from above with a round yellow chick-like creature at the entrance and a glowing blue portal at the exit", False),
    'stories':       ("an open storybook with a tiny castle, trees and a rainbow popping out of the pages", False),
    'rocket-math':   ("a cartoon rocket flying over a wooden number line ruler with stars", False),
    'shapes-land':   ("colorful chunky geometric toy shapes: a circle, triangle, square and star piled together", False),
    'rhyme':         ("a happy little bluebird singing with colorful musical notes around it", False),
    'initial-sound': ("a detective magnifying glass held over a big capital letter A", True),
    'empathy':       ("a cute brown bear hugging and comforting a sad little bunny, a small heart above them", False),
    'shape-build':   ("a tiny house built from toy shapes: a red triangle roof, a yellow square wall and a blue rectangle door", False),
    'coloring':      ("three colorful crayons next to a half colored-in flower drawing", False),
}


def sheet_prompt(ids, cols, rows):
    cells = []
    for i, tid in enumerate(ids):
        subj, text = TILES[tid]
        cells.append(f"Row {i // cols + 1}, column {i % cols + 1}: {subj}" + ("" if text else " (no text)") + ".")
    return (
        f"A sprite sheet of {len(ids)} separate cute pixel art game icons for a children's learning app, "
        f"arranged in an evenly spaced grid of {cols} columns and {rows} rows. Each icon sits centered in its own "
        "equal-size cell with generous empty space around it; icons never touch or overlap the cell borders. "
        "No grid lines, no frames, no labels. All icons share one consistent style: chunky 32-bit pixel art, "
        "thick dark purple outline, bright cheerful colors, soft shading, simple readable shapes. "
        "The whole background is one flat solid pure magenta color (#FF00FF), no gradient, no shadows on it, "
        "and no magenta anywhere inside the icons. " + " ".join(cells)
    )


def request_image(prompt, size):
    headers = ['-H', 'Content-Type: application/json']
    if os.environ.get('COMETAPI_KEY'):
        headers += ['-H', 'Authorization: Bearer ' + os.environ['COMETAPI_KEY']]
    for model in ('gpt-image-2', 'gpt-image-2', 'gpt-image-1.5'):
        body = json.dumps({'model': model, 'prompt': prompt, 'size': size, 'n': 1, 'quality': 'low'})
        r = subprocess.run(['curl', '-s', '--max-time', '300', *headers, '-d', body, API],
                           capture_output=True, text=True)
        try:
            data = json.loads(r.stdout)['data'][0]['b64_json']
            return Image.open(io.BytesIO(base64.b64decode(data))).convert('RGBA')
        except Exception:
            print('  retry:', model, r.stdout[:120])
    raise SystemExit('image request failed')


def key_magenta(im):
    """Magenta background -> transparent. Flood-fills from the border through
    magenta-ish pixels only, so pink inside a picture survives; then clears
    the fringe and enclosed pockets of near-exact magenta."""
    a = np.asarray(im).astype(np.int16)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    bgish = (r > 150) & (b > 150) & (g < 110) & (abs(r - b) < 90)
    H, W = bgish.shape
    seen = np.zeros_like(bgish)
    q = deque((y, x) for y in range(H) for x in (0, W - 1) if bgish[y, x])
    q.extend((y, x) for x in range(W) for y in (0, H - 1) if bgish[y, x])
    # enclosed pockets (inside a ladder, a pretzel, a basket): every pixel
    # close to the sheet's actual background colour seeds a fill too, which
    # then takes the pocket's slightly shaded edge pixels with it. The model
    # never paints exact #FF00FF (one sheet: 234/66/212), so the key colour
    # is measured from the border instead of assumed.
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])[:, :3]
    border = border[(border[:, 0] > 150) & (border[:, 2] > 150) & (border[:, 1] < 110)]
    if len(border):
        key = np.median(border, axis=0)
        near_key = (np.abs(a[..., :3] - key).sum(axis=-1) < 45) & bgish
        q.extend(zip(*np.nonzero(near_key)))
    for y, x in q: seen[y, x] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
            if 0 <= ny < H and 0 <= nx < W and bgish[ny, nx] and not seen[ny, nx]:
                seen[ny, nx] = True; q.append((ny, nx))
    out = np.asarray(im).copy()
    out[seen, 3] = 0
    near = np.zeros_like(seen)
    near[1:, :] |= seen[:-1, :]; near[:-1, :] |= seen[1:, :]; near[:, 1:] |= seen[:, :-1]; near[:, :-1] |= seen[:, 1:]
    out[near & ~seen & (r > 140) & (b > 120) & (g < 140), 3] = 0
    return Image.fromarray(out)


def drop_slivers(im):
    """Remove bits of neighbouring pictures a sheet cut dragged in: small
    pieces touching the cell edge (big pictures may reach it), and specks."""
    a = np.asarray(im).copy()
    solid = a[..., 3] > 24
    H, W = solid.shape
    lab = np.zeros((H, W), np.int32)
    parts, n = [], 0
    for y0 in range(H):
        for x0 in range(W):
            if not solid[y0, x0] or lab[y0, x0]:
                continue
            n += 1; lab[y0, x0] = n; q = deque([(y0, x0)]); area = 0; edge = False
            while q:
                y, x = q.popleft(); area += 1
                edge |= y in (0, H - 1) or x in (0, W - 1)
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        ny, nx = y + dy, x + dx
                        if 0 <= ny < H and 0 <= nx < W and solid[ny, nx] and not lab[ny, nx]:
                            lab[ny, nx] = n; q.append((ny, nx))
            parts.append((n, area, edge))
    total = sum(p[1] for p in parts) or 1
    biggest = max((p[1] for p in parts), default=1)
    for k, area, edge in parts:
        if (edge and area < biggest * 0.15) or area < total * 0.004:
            a[lab == k, 3] = 0
    return Image.fromarray(a)


def to_tile(im):
    """Trim, centre on a square with a small margin, scale to 128 px."""
    im = drop_slivers(im)
    box = im.getbbox()
    if box:
        im = im.crop(box)
        w, h = im.size
        side = int(max(w, h) * 1.06)
        sq = Image.new('RGBA', (side, side))
        sq.paste(im, ((side - w) // 2, (side - h) // 2))
        im = sq
    return im.resize((128, 128), Image.LANCZOS)


def run_sheet(ids, name):
    cols = 3
    rows = max(2, (len(ids) + cols - 1) // cols)           # 3x2 (wide) or 3x3 sheet
    ids = ids + [ids[-1]] * (cols * rows - len(ids))      # pad a short sheet
    size = '1024x1024' if rows == 3 else '1536x1024'
    print(f'sheet {name}: {", ".join(dict.fromkeys(ids))}')
    sheet = key_magenta(request_image(sheet_prompt(ids, cols, rows), size))
    os.makedirs(WORK, exist_ok=True)
    sheet.save(os.path.join(WORK, f'sheet_{name}.png'))
    W, H = sheet.size
    cw, ch = W / cols, H / rows
    os.makedirs(OUT, exist_ok=True)
    for i, tid in enumerate(dict.fromkeys(ids)):
        c, r = i % cols, i // cols
        cell = sheet.crop((int(c * cw), int(r * ch), int((c + 1) * cw), int((r + 1) * ch)))
        to_tile(cell).save(os.path.join(OUT, f'{tid}.png'), optimize=True)
        print('  ->', tid)


if __name__ == '__main__':
    ids = list(TILES) if sys.argv[1:] == ['--all'] else sys.argv[1:]
    unknown = [i for i in ids if i not in TILES]
    if not ids or unknown:
        raise SystemExit(f'usage: {sys.argv[0]} --all | <id> ...   unknown: {unknown}')
    for n, start in enumerate(range(0, len(ids), 9)):
        run_sheet(ids[start:start + 9], f'{n + 1}')
