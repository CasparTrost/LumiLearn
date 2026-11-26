// Lumis Kleiderschrank: things Lumi holds at its wing (a balloon, a wand …).
// Anchor: the tip of the wing that holds (on the sleeping picture: the floor
// beside Lumi), width the size of a held thing. `at` is the point where the
// wing holds the picture (the end of a string, a handle).
// The fields are explained in ../wardrobe.js; the stars come from ORDER
// there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'ballon',     name: 'Luftballon', slot: 'hold', src: 'sprites/wardrobe/ballon.webp',     at: [0.5, 0.97], size: 1.8,  box: [0.26, 0.02, 0.74, 0.98] },
  { id: 'zauberstab', name: 'Zauberstab', slot: 'hold', src: 'sprites/wardrobe/zauberstab.webp', at: [0.5, 0.9],  size: 1.5,  box: [0.18, 0.05, 0.87, 0.98] },
  { id: 'blume',      name: 'Sonnenblume', slot: 'hold', src: 'sprites/wardrobe/blume.webp',     at: [0.5, 0.9],  size: 1.5,  box: [0.25, 0.05, 0.76, 0.98] },
  { id: 'lolli',      name: 'Lolli',      slot: 'hold', src: 'sprites/wardrobe/lolli.webp',      at: [0.5, 0.9],  size: 1.4,  box: [0.23, 0.06, 0.77, 0.98] },
  { id: 'faehnchen',  name: 'Fähnchen',   slot: 'hold', src: 'sprites/wardrobe/faehnchen.webp',  at: [0.5, 0.9],  size: 1.35, box: [0.45, 0.05, 0.94, 0.98] },
  { id: 'schirm',     name: 'Regenschirm', slot: 'hold', src: 'sprites/wardrobe/schirm.webp',    at: [0.5, 0.84], size: 2.4,  rot: -10, dy: -0.12, box: [0.16, 0.01, 0.84, 0.99], pose: { hmm: { rot: 22, size: 0.95 }, think: { rot: 22, size: 0.95 }, happy: { rot: -4, size: 0.8, dy: 26 }, sleep: { rot: -8, size: 0.75, dx: -24 } } },
  { id: 'eis',        name: 'Eis',        slot: 'hold', src: 'sprites/wardrobe/eis.webp',        at: [0.5, 0.8],  size: 1.7,  box: [0.28, 0.07, 0.72, 0.97], pose: { sleep: { size: 0.9 } } },
  { id: 'windrad',    name: 'Windrad',    slot: 'hold', src: 'sprites/wardrobe/windrad.webp',    at: [0.5, 0.9],  size: 1.5,  box: [0.24, 0.05, 0.77, 0.98] },
]
