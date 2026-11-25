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
]
