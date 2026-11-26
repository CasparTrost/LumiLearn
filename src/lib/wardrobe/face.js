// Lumis Kleiderschrank: things for the face (glasses, masks, noses …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// come from the thing's place in ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'sonnenbrille', name: 'Sonnenbrille', slot: 'face', src: 'sprites/wardrobe/sonnenbrille.webp', at: [0.5, 0.48], size: 2.15, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.34, 1, 0.68], say: 'wort/sonnenbrille' },
  { id: 'herzbrille',   name: 'Herzbrille',   slot: 'face', src: 'sprites/wardrobe/herzbrille.webp',   at: [0.5, 0.47], size: 2.2, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.27, 1, 0.68] },
  { id: 'rundbrille',   name: 'Runde Brille', slot: 'face', src: 'sprites/wardrobe/rundbrille.webp',   at: [0.5, 0.5],  size: 2.1, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.31, 1, 0.69], say: 'wort/brille' },
  { id: 'sternbrille',   name: 'Sternbrille',   slot: 'face', src: 'sprites/wardrobe/sternbrille.webp',   at: [0.5, 0.5],  size: 2.15, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.23, 1, 0.75] },
  { id: 'taucherbrille', name: 'Taucherbrille', slot: 'face', src: 'sprites/wardrobe/taucherbrille.webp', at: [0.5, 0.5],  size: 2.1, pose: { sleep: { dy: -5 }, hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.05, 1, 0.89] },
  { id: 'clownsnase',    name: 'Clownsnase',    slot: 'face', src: 'sprites/wardrobe/clownsnase.webp',    at: [0.5, 0.5],  size: 0.5,  dy: 0.2,  pose: { hmm: { dx: 5, dy: 4 }, think: { dx: 5, dy: 4 } }, box: [0.05, 0.05, 0.95, 0.95] },
  { id: 'heldenmaske',   name: 'Heldenmaske',   slot: 'face', src: 'sprites/wardrobe/heldenmaske.webp',   at: [0.5, 0.5],  size: 2.1, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.29, 1, 0.75] },
  { id: 'monokel',       name: 'Monokel',       slot: 'face', src: 'sprites/wardrobe/monokel.webp',       at: [0.5, 0.5],  size: 2.1, pose: { hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.29, 0.46, 0.97] },
  { id: 'skibrille',     name: 'Skibrille',     slot: 'face', src: 'sprites/wardrobe/skibrille.webp',     at: [0.5, 0.5],  size: 2.15, pose: { sleep: { dy: -5 }, hmm: { size: 0.9, dx: -3, dy: 5 }, think: { size: 0.9, dx: -3, dy: 5 } }, box: [0, 0.24, 1, 0.76] },
  { id: 'schnurrbart',   name: 'Schnurrbart',   slot: 'face', src: 'sprites/wardrobe/schnurrbart.webp',   at: [0.5, 0.064], size: 0.85, pose: { hmm: { dx: 5, dy: 3 }, think: { dx: 5, dy: 3 }, sleep: { dx: -3, dy: -15 } }, box: [0, 0.32, 1, 0.66] },
]
