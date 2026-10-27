#!/usr/bin/env python3
"""
Coloring pages for the Mal-Atelier (public/images/coloring/lumi-<name>.png,
1000 x 1500, 1-bit black on white).

One gpt-image-2 call per page, portrait 1024 x 1536, quality "medium".
The first pages were six on one sheet at quality "low": blotchy broken
lines, sky and ground one area, bushes in dozens of crumbs, and outlines
open enough for the paint bucket to run out. Asked one at a time, with a
frame and a horizon line and "few big areas", the model draws real
coloring-book pages; `finish` only has to tidy them:

  1. black where darker than mid grey, everything else white;
  2. lines a little thicker (a child's tap near a thin line hits the line);
  3. specks of white too small to tap and fill become line.

Look at every page before committing. Page ids stay stable once shipped:
the album remembers which page a picture was painted on.

Usage:
    python3 scripts/generate-coloring-pages.py generate [name ...]
    python3 scripts/generate-coloring-pages.py finish
Needs Pillow, numpy and scipy.
"""
import importlib.util, os, sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as nd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT  = os.path.join(ROOT, 'public', 'images', 'coloring')
WORK = os.path.join(ROOT, '.tile-art-work', 'coloring2')

LUMI = ('Lumi, a small round chubby baby chick with a big round body, big friendly eyes, a tiny beak, '
        'a tuft of three feathers on top and two small wings')
PAGES = {
    'wald':      f'{LUMI} standing in a magic forest, waving, with two big mushrooms, one tree and three flowers',
    'bauernhof': f'{LUMI} on a farm next to a friendly cow and a little pig, a red barn and a short fence behind them',
    'weltraum':  f'{LUMI} flying a rocket in space past a smiling moon, a planet with a ring and a few big stars',
    'meer':      f'{LUMI} swimming under the sea with a smiling fish, a turtle, a starfish and some seaweed',
    'schloss':   f'{LUMI} in front of a little castle with two towers, next to a friendly baby dragon',
    'garten':    f'{LUMI} in a garden with three big flowers, a butterfly, a snail and a smiling sun',
    'strand':    f'{LUMI} on the beach building a sandcastle, with a bucket, a spade, a beach ball and a palm tree',
    'winter':    f'{LUMI} in the snow next to a snowman with a scarf and a hat, a pine tree and big snowflakes',
}
PROMPT = ("A children's coloring book page for ages 4 to 6, portrait. Black line art on pure white only: "
          "no grey, no shading, no hatching, no texture, no filled black areas, no text. "
          "Bold clean outlines of one even thickness (like a thick marker), smooth and continuous, every shape "
          "completely closed so each area can be filled with a paint bucket. Few, big, simple areas a small child "
          "can tap and fill; no tiny details, no grass strokes, no dots, no small leaves. "
          "The whole scene sits inside a simple rounded rectangle frame line; a clear horizon line runs from the "
          "left frame edge to the right frame edge so the sky and the ground are separate areas. Scene: ")

W_OUT, H_OUT = 1000, 1500
MIN_AREA = 250          # white areas smaller than this (px) can't be tapped and filled


def generate(names):
    spec = importlib.util.spec_from_file_location('tiles', os.path.join(ROOT, 'scripts', 'generate-tile-art.py'))
    tiles = importlib.util.module_from_spec(spec); spec.loader.exec_module(tiles)
    os.makedirs(WORK, exist_ok=True)
    for name in names or PAGES:
        print(name, flush=True)
        tiles.request_image(PROMPT + PAGES[name], '1024x1536', 'medium').save(os.path.join(WORK, name + '.png'))


def finish():
    for name in PAGES:
        src = os.path.join(WORK, name + '.png')
        if not os.path.exists(src):
            print('missing', name); continue
        im = Image.open(src).convert('L').resize((W_OUT, H_OUT), Image.LANCZOS)
        im = im.point(lambda v: 0 if v < 140 else 255).filter(ImageFilter.MinFilter(3))
        line = np.asarray(im) < 128
        lab, n = nd.label(~line)
        sizes = nd.sum(~line, lab, range(1, n + 1))
        line |= np.isin(lab, 1 + np.where(sizes < MIN_AREA)[0])
        Image.fromarray(np.where(line, 0, 255).astype('uint8')).convert('1').save(
            os.path.join(OUT, f'lumi-{name}.png'), optimize=True)
        print(name, n, 'areas,', int((sizes >= MIN_AREA).sum()), 'big enough')


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'generate':
        generate(sys.argv[2:])
    elif cmd == 'finish':
        finish()
    else:
        raise SystemExit(__doc__)
