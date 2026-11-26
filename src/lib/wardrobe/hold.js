// Lumis Kleiderschrank: things Lumi holds at its wing (a balloon, a wand …).
// Anchor: the tip of the wing that holds (on the sleeping picture: the floor
// beside Lumi), width the size of a held thing. `at` is the point where the
// wing holds the picture (the end of a string, a handle).
// The fields are explained in ../wardrobe.js; the stars come from ORDER
// there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, made with Tripo (converted with
// scripts/art/png-to-webp.mjs); the few still drawn come from scripts/art/schrank-<id>.svg.
export default [
  { id: 'ballon',     name: 'Luftballon', slot: 'hold', src: 'sprites/wardrobe/ballon.webp',     at: [0.5, 0.97], size: 1.8,  box: [0.26, 0.02, 0.74, 0.98] },
  { id: 'zauberstab', name: 'Zauberstab', slot: 'hold', src: 'sprites/wardrobe/zauberstab.webp', at: [0.5, 0.9],  size: 1.5,  box: [0.18, 0.05, 0.87, 0.98] },
  { id: 'blume',      name: 'Sonnenblume', slot: 'hold', src: 'sprites/wardrobe/blume.webp',     at: [0.5, 0.9],  size: 1.5,  box: [0.25, 0.05, 0.76, 0.98] },
  { id: 'lolli',      name: 'Lolli',      slot: 'hold', src: 'sprites/wardrobe/lolli.webp',      at: [0.5, 0.9],  size: 1.4,  box: [0.23, 0.06, 0.77, 0.98] },
  { id: 'faehnchen',  name: 'Fähnchen',   slot: 'hold', src: 'sprites/wardrobe/faehnchen.webp',  at: [0.5, 0.9],  size: 1.35, box: [0.45, 0.05, 0.94, 0.98] },
  { id: 'eis',        name: 'Eis',        slot: 'hold', src: 'sprites/wardrobe/eis.webp',        at: [0.5, 0.78],  size: 1.7,  box: [0.22, 0.05, 0.78, 0.95], pose: { sleep: { size: 0.9 } } },
  { id: 'windrad',    name: 'Windrad',    slot: 'hold', src: 'sprites/wardrobe/windrad.webp',    at: [0.5, 0.9],  size: 1.5,  box: [0.24, 0.05, 0.77, 0.98] },
  { id: 'laterne',    name: 'Laterne',    slot: 'hold', src: 'sprites/wardrobe/laterne.webp',    at: [0.84, 0.2], size: 1.3, pose: { wave: { size: 0.97 }, sad: { size: 0.85, dy: -8 }, sleep: { dy: -24, size: 0.55 }, hmm: { size: 0.85, dy: -16 }, think: { size: 0.85, dy: -16 } }, box: [0.14, 0.05, 0.86, 0.95] },
  { id: 'zuckerwatte', name: 'Zuckerwatte', slot: 'hold', src: 'sprites/wardrobe/zuckerwatte.webp', at: [0.5, 0.86], size: 1.6, box: [0.21, 0.05, 0.79, 0.95] },
  { id: 'ukulele',     name: 'Ukulele',     slot: 'hold', src: 'sprites/wardrobe/ukulele.webp',     at: [0.5, 0.5], size: 2.0, rot: -25, pose: { hmm: { rot: 50 }, think: { rot: 50 }, sad: { size: 0.85 }, wave: { size: 0.95 } }, box: [0.3, 0.05, 0.7, 0.95] },
]
