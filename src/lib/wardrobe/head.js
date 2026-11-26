// Lumis Kleiderschrank: things for the head (hats, crowns, ears …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// that unlock a thing come from its place in ORDER there (a thing not in
// ORDER yet comes last). Picture: public/sprites/wardrobe/<id>.webp,
// drawn from scripts/art/schrank-<id>.svg.
export default [
  { id: 'muetze',      name: 'Bommelmütze', slot: 'head', src: 'sprites/wardrobe/muetze.webp',      at: [0.5, 0.523], size: 1.18, box: [0.09, 0.17, 0.91, 0.84], tuft: 'hide' },
  { id: 'partyhut',    name: 'Partyhut',    slot: 'head', src: 'sprites/wardrobe/partyhut.webp',    at: [0.5, 0.84],  size: 0.72, box: [0.21, 0.04, 0.8, 0.9], dx: -0.2, dy: 0.08, rot: -18 },
  { id: 'blumenkranz', name: 'Blumenkranz', slot: 'head', src: 'sprites/wardrobe/blumenkranz.webp', at: [0.5, 0.56],  size: 1.25, box: [0.04, 0.35, 0.96, 0.8], tuft: 'front' },
  { id: 'piratenhut',  name: 'Piratenhut',  slot: 'head', src: 'sprites/wardrobe/piratenhut.webp',  at: [0.5, 0.53],  size: 1.1,  box: [0.04, 0.15, 0.99, 0.84], tuft: 'hide' },
  { id: 'zauberhut',   name: 'Zauberhut',   slot: 'head', src: 'sprites/wardrobe/zauberhut.webp',   at: [0.5, 0.8],   size: 1.06, box: [0.05, 0.05, 0.95, 0.9], tuft: 'hide' },
  { id: 'krone',       name: 'Krone',       slot: 'head', src: 'sprites/wardrobe/krone.webp',       at: [0.5, 0.66],  size: 0.82, box: [0.08, 0.27, 0.93, 0.8], tuft: 'front', say: 'wort/krone' },
  { id: 'cowboyhut',       name: 'Cowboyhut',       slot: 'head', src: 'sprites/wardrobe/cowboyhut.webp',       at: [0.5, 0.531], size: 1.585, box: [0, 0.27, 1, 0.74], pose: { hmm: { dy: -10 }, think: { dy: -10 } }, tuft: 'hide' },
  { id: 'kochmuetze',      name: 'Kochmütze',       slot: 'head', src: 'sprites/wardrobe/kochmuetze.webp',      at: [0.5, 0.555], size: 1.172, box: [0.02, 0.15, 1, 0.85], pose: { hmm: { dy: -10 }, think: { dy: -10 } }, tuft: 'hide' },
  { id: 'feuerwehrhelm',   name: 'Feuerwehrhelm',   slot: 'head', src: 'sprites/wardrobe/feuerwehrhelm.webp',   at: [0.5, 0.508], size: 1.283, box: [0, 0.23, 1, 0.79], pose: { hmm: { dy: -10 }, think: { dy: -10 } }, tuft: 'hide' },
  { id: 'matrosenmuetze',  name: 'Matrosenmütze',   slot: 'head', src: 'sprites/wardrobe/matrosenmuetze.webp',  at: [0.422, 0.422], size: 1.465, box: [0.02, 0.25, 1, 0.8], pose: { hmm: { dy: -10 }, think: { dy: -10 } }, tuft: 'hide' },
  { id: 'basecap',         name: 'Basecap',         slot: 'head', src: 'sprites/wardrobe/basecap.webp',         at: [0.633, 0.5], size: 1.567, box: [0.03, 0.27, 0.97, 0.73], pose: { hmm: { dy: -10 }, think: { dy: -10 } }, tuft: 'hide' },
  { id: 'zylinder',        name: 'Zylinder',        slot: 'head', src: 'sprites/wardrobe/zylinder.webp',        at: [0.5, 0.672], size: 1.036, box: [0.07, 0.19, 0.93, 0.8], tuft: 'hide' },
  { id: 'hasenohren',      name: 'Hasenohren',      slot: 'head', src: 'sprites/wardrobe/hasenohren.webp',      at: [0.5, 0.57], size: 1.123, box: [0.01, 0.13, 1, 0.81], pose: { hmm: { dx: -12, dy: -2, rot: 6 }, think: { dx: -12, dy: -2, rot: 6 } }, tuft: 'front' },
  { id: 'katzenohren',     name: 'Katzenohren',     slot: 'head', src: 'sprites/wardrobe/katzenohren.webp',     at: [0.5, 0.484], size: 0.998, box: [0, 0.15, 1, 0.76], pose: { hmm: { dx: -12, dy: -2, rot: 6 }, think: { dx: -12, dy: -2, rot: 6 } }, tuft: 'front' },
  { id: 'strohhut',        name: 'Strohhut',        slot: 'head', src: 'sprites/wardrobe/strohhut.webp',        at: [0.5, 0.5], size: 1.567, box: [0.01, 0.28, 0.99, 0.72], pose: { hmm: { dy: -10 }, think: { dy: -10 } }, tuft: 'hide' },
  { id: 'weihnachtsmuetze', name: 'Weihnachtsmütze', slot: 'head', src: 'sprites/wardrobe/weihnachtsmuetze.webp', at: [0.414, 0.508], size: 1.404, box: [0, 0.23, 1, 0.75], pose: { hmm: { dy: -10 }, think: { dy: -10 } }, tuft: 'hide' },
]
