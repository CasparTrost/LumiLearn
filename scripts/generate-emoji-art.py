#!/usr/bin/env python3
"""
Pixel-art pictures for every emoji the app shows
(public/sprites/emoji/<codepoints>.png, 96 x 96, palette PNG ~3 KB) and the
list src/lib/emojiArtList.js the app uses to know which ones exist.
Check every finished sheet by eye before `finish` — the model sometimes
lays a sheet out differently than asked.

64 emoji per image call: gpt-image-2 draws an 8 x 8 sheet at 2048 x 2048
(quality "low", magenta background — see generate-tile-art.py for why),
which is cut into cells. Each cell is described by the emoji itself plus a
plain description; Unicode's legacy names mislead the model (❤ is "heavy
black heart" and came out black, ⭐ "white medium star" came out white), so
those get a corrected description in FIX.

Usage:
    python3 scripts/generate-emoji-art.py scan              # list emoji in src/ without a picture
    python3 scripts/generate-emoji-art.py generate [N...]   # make sheets (all, or batch numbers)
    python3 scripts/generate-emoji-art.py finish            # cut, shrink, write the list
"""
import importlib.util, json, os, re, sys, unicodedata
from collections import Counter

from PIL import Image

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT  = os.path.join(ROOT, 'public', 'sprites', 'emoji')
LIST = os.path.join(ROOT, 'src', 'lib', 'emojiArtList.js')
WORK = os.path.join(ROOT, '.tile-art-work', 'emoji')

spec = importlib.util.spec_from_file_location('tiles', os.path.join(ROOT, 'scripts', 'generate-tile-art.py'))
tiles = importlib.util.module_from_spec(spec); spec.loader.exec_module(tiles)

EMOJI = re.compile(
    r'[\U0001F1E6-\U0001F1FF]{2}'
    r'|[\U0001F300-\U0001FAFF☀-➿⬀-⯿⌀-⏿]️?[\U0001F3FB-\U0001F3FF]?'
    r'(?:‍[\U0001F300-\U0001FAFF☀-➿♀♂⚕⚖✈❤]️?[\U0001F3FB-\U0001F3FF]?)*'
)
SKIP = set('✦✧〰↔⌫')     # typographic marks, not pictures

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


def describe(e):
    if e in FIX:
        return FIX[e]
    if len(e) == 2 and all(0x1F1E6 <= ord(c) <= 0x1F1FF for c in e):
        return 'national flag of ' + ''.join(chr(ord(c) - 0x1F1E6 + 65) for c in e)
    return ' + '.join(unicodedata.name(c, '?').lower() for c in e if c not in '‍️')


def scan():
    seen = Counter()
    for base, _, files in os.walk(os.path.join(ROOT, 'src')):
        for f in files:
            if f.endswith(('.js', '.jsx')) and f != 'emojiArtList.js':
                for m in EMOJI.findall(open(os.path.join(base, f), encoding='utf-8').read()):
                    e = m.replace('️', '')
                    if e not in SKIP:
                        seen[e] += 1
    have = {f[:-4] for f in os.listdir(OUT)} if os.path.isdir(OUT) else set()
    return [{'e': e, 'name': describe(e)} for e, _ in seen.most_common() if code(e) not in have]


def prompt(batch, cols, rows):
    cells = [f"{i // cols + 1}/{i % cols + 1}: {it['e']} ({it['name']})" for i, it in enumerate(batch)]
    return (
        f"A sprite sheet of {len(batch)} separate pixel art versions of emoji, arranged in a strict evenly spaced grid "
        f"of {cols} columns and {rows} rows (row/column listed below). Each picture shows exactly what its emoji shows, "
        "centered in its own equal-size cell with clear empty space around it; pictures never touch the cell borders. "
        "No grid lines, no frames, no labels, no text unless the emoji itself contains it. Consistent style for all: "
        "cute chunky 32-bit pixel art, thick dark purple outline, bright cheerful colors, soft shading, simple readable "
        "shapes. The whole background is one flat solid pure magenta color (#FF00FF), no gradient, and no magenta "
        "inside the pictures. Cells: " + '; '.join(cells)
    )


def generate(batches):
    os.makedirs(WORK, exist_ok=True)
    todo = scan()
    json.dump(todo, open(os.path.join(WORK, 'todo.json'), 'w'), ensure_ascii=False)
    nums = batches or range((len(todo) + 63) // 64)
    for b in nums:
        batch = todo[b * 64:(b + 1) * 64]
        if not batch:
            continue
        # A short last sheet gets a grid that fits it: asked for 8 x 8 with
        # only five emoji, the model laid them out in five columns instead.
        cols = min(8, len(batch)); rows = (len(batch) + cols - 1) // cols
        print(f'sheet {b}: {len(batch)} emoji, {cols} x {rows}')
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
        cols, rows, batch = meta['cols'], meta['rows'], meta['items']
        sheet = Image.open(os.path.join(WORK, f[:-5] + '.png')).convert('RGBA')
        W, H = sheet.size
        for i, it in enumerate(batch):
            c, r = i % cols, i // cols
            cell = sheet.crop((W * c // cols, H * r // rows, W * (c + 1) // cols, H * (r + 1) // rows))
            save_small(tiles.to_tile(cell), os.path.join(OUT, code(it['e']) + '.png'))
    write_list()


def save_small(im, path):
    im.resize((96, 96), Image.LANCZOS).quantize(colors=96, method=Image.Quantize.FASTOCTREE).save(path, optimize=True)


def write_list():
    codes = sorted(f[:-4] for f in os.listdir(OUT) if f.endswith('.png'))
    with open(LIST, 'w') as fh:
        fh.write('// Generated from public/sprites/emoji by scripts/generate-emoji-art.py — do not edit.\n')
        fh.write('export const EMOJI_ART = new Set([\n')
        for i in range(0, len(codes), 8):
            fh.write('  ' + ', '.join(f"'{c}'" for c in codes[i:i + 8]) + ',\n')
        fh.write('])\n')
    print(len(codes), 'pictures listed')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'scan':
        for it in scan():
            print(it['e'], it['name'])
    elif cmd == 'generate':
        generate([int(n) for n in sys.argv[2:]])
    elif cmd == 'finish':
        finish()
    else:
        raise SystemExit(__doc__)
