// Lumis Kleiderschrank: things for the face (glasses, masks, noses …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// come from the thing's place in ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, made with Tripo (converted with
// scripts/art/png-to-webp.mjs); the few still drawn come from scripts/art/schrank-<id>.svg.
export default [
  { id: 'sonnenbrille', name: 'Sonnenbrille', slot: 'face', src: 'sprites/wardrobe/sonnenbrille.webp', at: [0.5, 0.468], size: 2.389, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.32, 0.95, 0.68] },
  { id: 'herzbrille',   name: 'Herzbrille',   slot: 'face', src: 'sprites/wardrobe/herzbrille.webp',   at: [0.5, 0.495], size: 2.444, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.31, 0.95, 0.69] },
  { id: 'rundbrille',   name: 'Runde Brille', slot: 'face', src: 'sprites/wardrobe/rundbrille.webp',   at: [0.5, 0.5],  size: 2.333, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.3, 0.95, 0.7] },
  { id: 'sternbrille',   name: 'Sternbrille',   slot: 'face', src: 'sprites/wardrobe/sternbrille.webp',   at: [0.5, 0.508],  size: 2.389, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.28, 0.95, 0.72] },
  { id: 'taucherbrille', name: 'Taucherbrille', slot: 'face', src: 'sprites/wardrobe/taucherbrille.webp', at: [0.5, 0.521],  size: 2.333, pose: { sleep: { dy: -5 }, hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.2, 0.95, 0.8] },
  { id: 'clownsnase',    name: 'Clownsnase',    slot: 'face', src: 'sprites/wardrobe/clownsnase.webp',    at: [0.5, 0.5],  size: 0.5,  dy: 0.2,  pose: { hmm: { dx: 5, dy: 4 }, think: { dx: 5, dy: 4 } }, box: [0.05, 0.05, 0.95, 0.95] },
  { id: 'heldenmaske',   name: 'Heldenmaske',   slot: 'face', src: 'sprites/wardrobe/heldenmaske.webp',   at: [0.5, 0.481],  size: 2.333, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.28, 0.95, 0.72] },
  { id: 'monokel',       name: 'Monokel',       slot: 'face', src: 'sprites/wardrobe/monokel.webp',       at: [0.923, 0.328],  size: 1.342, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.14, 0.05, 0.86, 0.95] },
  { id: 'skibrille',     name: 'Skibrille',     slot: 'face', src: 'sprites/wardrobe/skibrille.webp',     at: [0.5, 0.5],  size: 2.389, pose: { sleep: { dy: -5 }, hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.23, 0.95, 0.77] },
  { id: 'schnurrbart',   name: 'Schnurrbart',   slot: 'face', src: 'sprites/wardrobe/schnurrbart.webp',   at: [0.5, 0.092], size: 0.944, pose: { hmm: { dx: 5, dy: 3 }, think: { dx: 5, dy: 3 }, sleep: { dx: -3, dy: -15 }, happy: { dy: 14 }, wave: { dy: 10 } }, box: [0.05, 0.34, 0.95, 0.67] },
  { id: 'spiralbrille',  name: 'Spiralbrille',  slot: 'face', src: 'sprites/wardrobe/spiralbrille.webp',  at: [0.5, 0.5],  size: 2.3, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.3, 0.95, 0.7] },
  { id: 'brille3d',      name: '3D-Brille',     slot: 'face', src: 'sprites/wardrobe/brille3d.webp',      at: [0.5, 0.53],  size: 2.2, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.28, 0.95, 0.72] },
  { id: 'federmaske',    name: 'Federmaske',    slot: 'face', src: 'sprites/wardrobe/federmaske.webp',    at: [0.425, 0.68],  size: 2.7, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0.05, 0.12, 0.95, 0.88] },
]
