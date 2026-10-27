#!/usr/bin/env python3
"""
Coloring pages for the Mal-Atelier (public/images/coloring/lumi-<name>.png,
1000 x 1164, 1-bit black on white). Replaced the earlier pages, which were
official Nintendo printables.

One gpt-image-2 call draws all six pages as a 3 x 2 sheet. The game fills
an area with the paint bucket up to the black lines, so `finish` turns the
sheet into pages that hold the paint:

  1. cut each page out of the sheet, drop the frame the model sometimes
     draws round a page, count faded line pixels as line (quality "low"
     draws lines that fade out in places), thicken a little, binarize;
  2. close gaps where a figure would leak into the background: regions as
     they'd be with every gap up to 2R closed, grown back to the real
     lines; short seams between such a region and the background are the
     missing pieces of line;
  3. for figures that still leak (SEEDS), find the narrowest neck on the
     way to the background and plug it, if it is a gap (<= 14 px) and not
     an opening the drawing really has.

Look at every page before committing. Needs Pillow, numpy and scipy.

Usage:
    python3 scripts/generate-coloring-pages.py generate
    python3 scripts/generate-coloring-pages.py finish
"""
import importlib.util, os, sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage as nd

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT  = os.path.join(ROOT, 'public', 'images', 'coloring')
WORK = os.path.join(ROOT, '.tile-art-work', 'coloring')

LUMI = ('Lumi, a small round chubby chick-like creature with big friendly eyes, rosy cheeks, a tiny beak, '
        'a small tuft of three feathers on top and two tiny wings')
PAGES = {
    'wald':      f'{LUMI} waving in a magic forest with big mushrooms, a few trees and flowers',
    'bauernhof': f'{LUMI} on a farm with a cow, a pig and a hen, a barn and a fence behind',
    'weltraum':  f'{LUMI} flying a rocket in space with a moon, a planet with a ring and big stars',
    'meer':      f'{LUMI} underwater with a smiling fish, a turtle, a starfish, seaweed and bubbles',
    'schloss':   f'{LUMI} in front of a little castle with a friendly baby dragon, a flag on the tower',
    'garten':    f'{LUMI} in a garden with big flowers, two butterflies, a snail and a smiling sun',
}
# Figures that still leaked after step 2 (box x0, y0, x1, y1 inside them)
SEEDS = {'bauernhof': [(270, 330, 420, 480), (200, 900, 380, 1000)]}
# Line pieces the model left out and no automatic step finds
LINES = {'bauernhof': [[(482, 906), (502, 890), (526, 872)],          # Lumi's wing
                       [(258, 325), (282, 316), (300, 311), (330, 301), (360, 299), (395, 301)],
                       [(250, 336), (245, 380), (246, 420), (250, 470)]]}

W_OUT, H_OUT, MARGIN = 1000, 1164, 40
FADED, R, MAX_GAP = 245, 13, 14


def generate():
    spec = importlib.util.spec_from_file_location('tiles', os.path.join(ROOT, 'scripts', 'generate-tile-art.py'))
    tiles = importlib.util.module_from_spec(spec); spec.loader.exec_module(tiles)
    cells = '; '.join(f'row {i // 3 + 1}, column {i % 3 + 1}: {s}' for i, s in enumerate(PAGES.values()))
    prompt = ("A sheet of 6 separate children's coloring book pages for ages 4 to 7, arranged in a strict grid of "
              "3 columns and 2 rows, each page in its own equal-size tall cell with a wide white margin; pages never "
              "touch each other. Pure black outlines on pure white, no grey, no shading, no hatching, no filled black "
              "areas, no colour, no text, no frames, no borders. Thick bold uniform lines, all shapes fully closed so "
              "each area can be filled with a paint bucket, big simple areas (few tiny details), cute friendly style. "
              "Pages: " + cells)
    os.makedirs(WORK, exist_ok=True)
    tiles.request_image(prompt, '2048x2048').save(os.path.join(WORK, 'sheet.png'))


def cut(sheet, i):
    W, H = sheet.size; c, r = i % 3, i // 3
    cell = np.array(sheet.crop((W * c // 3, H * r // 2, W * (c + 1) // 3, H * (r + 1) // 2)))
    line = cell < FADED
    # frame: rows / columns near the edge that are mostly line
    frame = np.zeros_like(line); h, w = line.shape
    for y in [*range(int(h * .12)), *range(int(h * .88), h)]:
        if line[y].mean() > .45: frame[max(0, y - 3):y + 4] = True
    for x in [*range(int(w * .12)), *range(int(w * .88), w)]:
        if line[:, x].mean() > .45: frame[:, max(0, x - 3):x + 4] = True
    line &= ~nd.binary_dilation(frame & line, iterations=4)
    ys, xs = np.where(line); line = line[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    page = Image.fromarray(np.where(line, 0, 255).astype('uint8')).filter(ImageFilter.MinFilter(3))
    s = min((W_OUT - 2 * MARGIN) / page.width, (H_OUT - 2 * MARGIN) / page.height)
    page = page.resize((round(page.width * s), round(page.height * s)), Image.LANCZOS)
    out = Image.new('L', (W_OUT, H_OUT), 255)
    out.paste(page, ((W_OUT - page.width) // 2, (H_OUT - page.height) // 2))
    return np.array(out) < 160


def seal(line):
    yy, xx = np.mgrid[-R:R + 1, -R:R + 1]
    lab, _ = nd.label(~nd.binary_dilation(line, xx * xx + yy * yy <= R * R))
    idx = nd.distance_transform_edt(lab == 0, return_distances=False, return_indices=True)
    full = lab[idx[0], idx[1]]
    seam = np.zeros_like(line)
    seam[:, 1:] |= full[:, 1:] != full[:, :-1]; seam[1:] |= full[1:] != full[:-1]
    # only against the background (seams between inner regions would put
    # lines across faces) and only short pieces: a gap is short
    bg = full[2, 2]; touch = np.zeros_like(line)
    touch[:, 1:] |= (full[:, 1:] == bg) ^ (full[:, :-1] == bg); touch[1:] |= (full[1:] == bg) ^ (full[:-1] == bg)
    seam &= touch & ~line
    sl, sk = nd.label(seam, np.ones((3, 3), bool))
    sizes = nd.sum(seam, sl, range(1, sk + 1))
    seam &= np.isin(sl, 1 + np.where(sizes <= 3 * R)[0])
    return line | (nd.binary_dilation(seam, np.ones((3, 3), bool)) & ~line)


def drop_straight_bits(a):
    lab, _ = nd.label(a, np.ones((3, 3), bool))
    for i, sl in enumerate(nd.find_objects(lab), 1):
        h, w = sl[0].stop - sl[0].start, sl[1].stop - sl[1].start
        if (w <= 8 and h > 80) or (h <= 8 and w > 80): a[lab == i] = False
    return a


def plug(a, box):
    x0, y0, x1, y1 = box
    clear = nd.distance_transform_edt(~a)
    sub = clear[y0:y1, x0:x1]; sy, sx = np.unravel_index(sub.argmax(), sub.shape); seed = (y0 + sy, x0 + sx)
    Y, X = np.ogrid[:a.shape[0], :a.shape[1]]
    for _ in range(12):
        if nd.label(~a)[0][seed] != nd.label(~a)[0][2, 2]: return a
        clear = nd.distance_transform_edt(~a)
        lo, hi = 0.5, clear[seed]                      # widest path seed -> background: its narrowest point
        while hi - lo > 0.5:
            t = (lo + hi) / 2; l, _ = nd.label(clear >= t)
            lo, hi = (t, hi) if l[seed] and l[seed] == l[2, 2] else (lo, t)
        if 2 * lo > MAX_GAP: break                     # a real opening in the drawing
        l, _ = nd.label(clear >= hi); A, B = l == l[seed], l == l[2, 2]
        L, _ = nd.label(clear >= lo); rest = (L == L[seed]) & ~A & ~B
        for it in (2, 4, 8, 16):
            neck = rest & nd.binary_dilation(A, iterations=it) & nd.binary_dilation(B, iterations=it)
            if neck.any(): break
        nl, nk = nd.label(neck, np.ones((3, 3), bool))
        for cy, cx in nd.center_of_mass(neck, nl, range(1, nk + 1)):
            a = a | ((Y - cy) ** 2 + (X - cx) ** 2 <= (hi + 1.5) ** 2)
    print('  still leaks:', box)
    return a


def finish():
    sheet = Image.open(os.path.join(WORK, 'sheet.png')).convert('L')
    for i, name in enumerate(PAGES):
        a = seal(cut(sheet, i))
        if name in LINES:
            im = Image.fromarray(np.where(a, 0, 255).astype('uint8')); d = ImageDraw.Draw(im)
            for pts in LINES[name]: d.line(pts, fill=0, width=7, joint='curve')
            a = np.array(im) < 128
        a = drop_straight_bits(a)
        for box in SEEDS.get(name, []): a = plug(a, box)
        Image.fromarray(np.where(a, 0, 255).astype('uint8')).convert('1').save(
            os.path.join(OUT, f'lumi-{name}.png'), optimize=True)
        print(name)


if __name__ == '__main__':
    {'generate': generate, 'finish': finish}.get(sys.argv[1] if len(sys.argv) > 1 else '', lambda: sys.exit(__doc__))()
