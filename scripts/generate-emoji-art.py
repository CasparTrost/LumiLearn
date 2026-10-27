#!/usr/bin/env python3
"""
Pictures for every emoji the app shows (public/sprites/emoji/<codepoints>.webp,
256 x 256) and the list src/lib/emojiArtList.js the app uses to know which
ones exist. Smooth cartoon illustrations, not pixel art: pixel art's
stepped edges made the outlines in the shadow riddle hard to recognise.
Animals and things are drawn whole (the giraffe, not the giraffe-face
emoji) for the same reason. The frame, buttons, Lumi and the maze keep
the pixel look. Check every
finished sheet by eye before `finish` — the model sometimes lays a sheet
out differently than asked.

36 emoji per image call: gpt-image-2 draws a 6 x 6 sheet at 2048 x 2048
(quality "low", magenta background — see generate-tile-art.py for why).
The first version put 64 on a sheet and stored 96 px: games show some
pictures at 250 px and more, where they came out blurred, and cutting the
sheet along the grid cut off whatever the model drew across a cell edge
(a kangaroo's tail, an octopus's arms). Now each picture is taken as the
shapes whose centre lies in its cell, whole, wherever they reach.

Each cell is described by the emoji itself plus a
plain description; Unicode's legacy names mislead the model (❤ is "heavy
black heart" and came out black, ⭐ "white medium star" came out white), so
those get a corrected description in FIX.

Usage:
    python3 scripts/generate-emoji-art.py scan              # list emoji in src/ without a picture
    python3 scripts/generate-emoji-art.py generate [N...]   # make sheets for those (all, or batch numbers)
    python3 scripts/generate-emoji-art.py generate --all    # redo every emoji src/ uses
    python3 scripts/generate-emoji-art.py finish            # cut, shrink, write the list
Needs Pillow, numpy and scipy.
"""
import importlib.util, json, os, re, sys, unicodedata
from collections import Counter

import numpy as np
from PIL import Image
from scipy import ndimage as nd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT  = os.path.join(ROOT, 'public', 'sprites', 'emoji')
LIST = os.path.join(ROOT, 'src', 'lib', 'emojiArtList.js')
WORK = os.path.join(ROOT, '.tile-art-work', 'emoji')

spec = importlib.util.spec_from_file_location('tiles', os.path.join(ROOT, 'scripts', 'generate-tile-art.py'))
tiles = importlib.util.module_from_spec(spec); spec.loader.exec_module(tiles)

EMOJI = re.compile(
    r'[\U0001F1E6-\U0001F1FF]{2}'
    r'|[\U0001F000-\U0001FAFF☀-➿⬀-⯿⌀-⏿]️?[\U0001F3FB-\U0001F3FF]?'
    r'(?:‍[\U0001F300-\U0001FAFF☀-➿♀♂⚕⚖✈❤]️?[\U0001F3FB-\U0001F3FF]?)*'
)
SKIP = set('✦✧〰↔⌫')     # typographic marks, not pictures
TOKEN = re.compile(r':px-[a-z0-9-]+:')
COLS = ROWS = 6
PER_SHEET = COLS * ROWS
SIZE = 256

FIX = {
    '❤': 'red heart', '⭐': 'shiny yellow star', '☀': 'bright yellow sun with rays', '☁': 'white fluffy cloud',
    '✈': 'airplane', '☂': 'umbrella', '☔': 'umbrella with rain drops', '✋': 'raised open hand', '✏': 'pencil',
    '✂': 'scissors', '❄': 'blue snowflake', '❌': 'red cross mark X', '❓': 'red question mark', '➕': 'plus sign',
    '➖': 'minus sign', '➡': 'right arrow', '⭕': 'red hollow circle', '⚡': 'yellow lightning bolt', '⛄': 'snowman',
    '♨': 'hot springs steam', '⚫': 'black circle', '⚪': 'white circle', '⬛': 'black square', '⬜': 'white square',
    '✅': 'green check mark', '☕': 'hot coffee cup', '⚓': 'anchor', '⚔': 'crossed swords', '⚖': 'balance scale',
    '⚙': 'gear', '⚠': 'warning sign', '⚽': 'soccer ball', '⛅': 'sun behind cloud', '⛈': 'thunder cloud with rain',
    '⛑': 'rescue helmet', '⛩': 'shinto shrine gate', '⛪': 'church', '⛰': 'mountain', '⛲': 'fountain',
    '⛵': 'sailboat', '⛷': 'skier', '⛺': 'tent', '⌛': 'hourglass', '⏳': 'hourglass with flowing sand',
    '⏰': 'alarm clock', '⏱': 'stopwatch', '⌨': 'computer keyboard', '🖤': 'black heart', '💛': 'yellow heart',
}


def code(e):
    return '-'.join(f'{ord(c):x}' for c in e if c not in '‍️')


# Things no emoji shows, written as :px-name: in the code
CUSTOM = {
    'tisch': 'a simple wooden kitchen table with four legs, seen from the front-side, nothing on it, clearly a table and not a chair',
    'xylofon': "a children's xylophone with rainbow-coloured bars from long to short and two mallets with round heads",
    'tatze': "one big fluffy cat's paw, a single paw seen from below with pink toe pads, not footprints",
    'schaukel': 'a wooden playground swing hanging on two ropes from a simple wooden frame, seen from the front',
    'portemonnaie': 'a small brown leather wallet for coins and notes, slightly open, seen from the front',
    'oelkanne': 'a small old-fashioned metal oil can with a long thin spout, seen from the side',
}


def describe(e):
    if e.startswith(':px-'):
        return CUSTOM.get(e[4:-1], e[4:-1])
    if e in FIX:
        return FIX[e]
    if len(e) == 2 and all(0x1F1E6 <= ord(c) <= 0x1F1FF for c in e):
        return 'national flag of ' + ''.join(chr(ord(c) - 0x1F1E6 + 65) for c in e)
    return ' + '.join(unicodedata.name(c, '?').lower() for c in e if c not in '‍️')


def scan(everything=False):
    seen = Counter()
    for base, _, files in os.walk(os.path.join(ROOT, 'src')):
        for f in files:
            if f.endswith(('.js', '.jsx')) and f != 'emojiArtList.js':
                text = open(os.path.join(base, f), encoding='utf-8').read()
                for m in TOKEN.findall(text):
                    seen[m] += 1
                for m in EMOJI.findall(text):
                    e = m.replace('️', '')
                    if e not in SKIP:
                        seen[e] += 1
    have = {f[:-5] for f in os.listdir(OUT) if f.endswith('.webp')} if os.path.isdir(OUT) else set()
    cdir = os.path.join(OUT, 'custom')
    have |= {'custom/' + f[:-5] for f in os.listdir(cdir) if f.endswith('.webp')} if os.path.isdir(cdir) else set()
    return [{'e': e, 'name': describe(e)} for e, _ in seen.most_common() if everything or name_of(e) not in have]


def name_of(e):
    """File name below public/sprites/emoji, without extension."""
    return 'custom/' + e[4:-1] if e.startswith(':px-') else code(e)


def prompt(batch, cols, rows):
    cells = [f"{i // cols + 1}/{i % cols + 1}: {it['e']} ({it['name']})" for i, it in enumerate(batch)]
    return (
        f"A sheet of {len(batch)} separate pictures for the emoji listed below, arranged in a strict evenly spaced grid "
        f"of {cols} columns and {rows} rows (row/column listed below). Each picture shows exactly what its emoji shows, "
        "centered in its own equal-size cell and filling about two thirds of it, with clear empty space all around; "
        "every picture stays completely inside its cell and never touches or overlaps a neighbour. "
        "No grid lines, no frames, no labels, no text unless the emoji itself contains it. Consistent style for all: "
        "cute children's app illustration, smooth clean vector-like cartoon, crisp smooth dark purple outlines, bright "
        "cheerful colours with soft shading, high resolution, NOT pixel art. Animals and objects are shown whole, from "
        "their most recognisable side, with a clear distinctive silhouette; for an animal-face emoji draw the whole "
        "animal. Faces and hand gestures stay faces and hands. Keep the colours the emoji has. "
        "The whole background is one flat solid pure magenta color (#FF00FF), no gradient, and no magenta "
        "inside the pictures. Cells: " + '; '.join(cells)
    )


def generate(batches, everything=False):
    os.makedirs(WORK, exist_ok=True)
    todo = scan(everything)
    json.dump(todo, open(os.path.join(WORK, 'todo.json'), 'w'), ensure_ascii=False)
    nums = batches or range((len(todo) + PER_SHEET - 1) // PER_SHEET)
    for b in nums:
        batch = todo[b * PER_SHEET:(b + 1) * PER_SHEET]
        if not batch:
            continue
        # A short last sheet gets a grid that fits it: asked for 8 x 8 with
        # only five emoji, the model laid them out in five columns instead.
        cols = min(COLS, len(batch)); rows = (len(batch) + cols - 1) // cols
        print(f'sheet {b}: {len(batch)} emoji, {cols} x {rows}', flush=True)
        sheet = tiles.key_magenta(tiles.request_image(prompt(batch, cols, rows), '2048x2048'))
        sheet.save(os.path.join(WORK, f'sheet_{b}.png'))
        json.dump({'cols': cols, 'rows': rows, 'items': batch},
                  open(os.path.join(WORK, f'sheet_{b}.json'), 'w'), ensure_ascii=False)


def finish():
    os.makedirs(OUT, exist_ok=True)
    for f in sorted(os.listdir(WORK)):
        if not (f.startswith('sheet_') and f.endswith('.json')):
            continue
        meta = json.load(open(os.path.join(WORK, f)))
        sheet = Image.open(os.path.join(WORK, f[:-5] + '.png')).convert('RGBA')
        for it, pic in zip(meta['items'], cut(sheet, meta['cols'], meta['rows'])):
            e = it['e']
            if pic is None:
                print('  nothing drawn for', e, it['name']); continue
            save_small(pic, os.path.join(OUT, name_of(e) + '.webp'))
    write_list()


def cut(sheet, cols, rows):
    """One picture per cell: every shape whose centre lies in the cell, kept
    whole even where it reaches into the next one. Specks are dropped; a
    shape spanning several cells (two pictures drawn touching) is clipped to
    the cell instead."""
    a = np.asarray(sheet)
    H, W = a.shape[:2]; cw, ch = W / cols, H / rows
    solid = a[..., 3] > 24
    # parts of one picture a few pixels apart (a xylophone and its mallets)
    # belong together
    lab, n = nd.label(nd.binary_dilation(solid, iterations=4), np.ones((3, 3), bool))
    lab = np.where(solid, lab, 0)
    areas = nd.sum(solid, lab, range(1, n + 1))
    cells = [[] for _ in range(cols * rows)]
    for k, box in enumerate(nd.find_objects(lab), 1):
        if box is None or areas[k - 1] < cw * ch * 0.004:
            continue
        cy, cx = (box[0].start + box[0].stop) / 2, (box[1].start + box[1].stop) / 2
        cells[min(rows - 1, int(cy // ch)) * cols + min(cols - 1, int(cx // cw))].append((k, box))
    out = []
    for i, parts in enumerate(cells):
        if not parts:
            out.append(None); continue
        c, r = i % cols, i // cols
        mask = np.zeros_like(solid)
        for k, box in parts:
            m = lab[box] == k
            if box[1].stop - box[1].start > 1.4 * cw or box[0].stop - box[0].start > 1.4 * ch:
                ys, xs = np.mgrid[box[0], box[1]]
                m &= (xs >= c * cw) & (xs < (c + 1) * cw) & (ys >= r * ch) & (ys < (r + 1) * ch)
            mask[box] |= m
        # small bits beside the main picture are a neighbour's
        ml, mn = nd.label(mask, np.ones((3, 3), bool))
        if mn > 1:
            sizes = nd.sum(mask, ml, range(1, mn + 1))
            mask &= np.isin(ml, 1 + np.where(sizes >= sizes.max() * 0.02)[0])
        ys, xs = np.nonzero(mask)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        pic = a[y0:y1, x0:x1].copy(); pic[~mask[y0:y1, x0:x1], 3] = 0
        out.append(Image.fromarray(pic))
    return out


def save_small(im, path):
    """Square with a small margin, SIZE px, WebP with alpha (~10 KB; a PNG
    of a smooth picture this size is 4-5 times larger)."""
    w, h = im.size; side = int(max(w, h) * 1.08)
    sq = Image.new('RGBA', (side, side)); sq.paste(im, ((side - w) // 2, (side - h) // 2))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sq.resize((SIZE, SIZE), Image.LANCZOS).save(path, 'WEBP', quality=88, method=6)


def write_list():
    codes = sorted(f[:-5] for f in os.listdir(OUT) if f.endswith('.webp'))
    cdir = os.path.join(OUT, 'custom')
    custom = sorted(f[:-5] for f in os.listdir(cdir) if f.endswith('.webp')) if os.path.isdir(cdir) else []
    with open(LIST, 'w') as fh:
        fh.write('// Generated from public/sprites/emoji by scripts/generate-emoji-art.py — do not edit.\n')
        for name, items in (('EMOJI_ART', codes), ('CUSTOM_ART', custom)):
            fh.write(f'export const {name} = new Set([\n')
            for i in range(0, len(items), 8):
                fh.write('  ' + ', '.join(f"'{c}'" for c in items[i:i + 8]) + ',\n')
            fh.write('])\n')
    print(len(codes), 'pictures,', len(custom), 'custom pictures listed')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'scan':
        for it in scan():
            print(it['e'], it['name'])
    elif cmd == 'generate':
        everything = '--all' in sys.argv[2:]
        generate([int(n) for n in sys.argv[2:] if n != '--all'], everything)
    elif cmd == 'finish':
        finish()
    else:
        raise SystemExit(__doc__)
