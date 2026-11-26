// Lumis Kleiderschrank: things round the neck (scarves, ties, chains …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// come from the thing's place in ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'schal',    name: 'Schal',    slot: 'neck', src: 'sprites/wardrobe/schal.webp',    at: [0.5, 0.3],  size: 1.12, box: [0.03, 0.22, 0.97, 0.78] },
  { id: 'fliege',   name: 'Fliege',   slot: 'neck', src: 'sprites/wardrobe/fliege.webp',   at: [0.5, 0.44], size: 0.6,  box: [0.08, 0.31, 0.92, 0.7] },
  { id: 'medaille', name: 'Medaille', slot: 'neck', src: 'sprites/wardrobe/medaille.webp', at: [0.5, 0.13], size: 0.8,  box: [0.15, 0.1, 0.85, 0.77] },
  { id: 'perlenkette',    name: 'Perlenkette',    slot: 'neck', src: 'sprites/wardrobe/perlenkette.webp',    at: [0.5, 0.12], size: 0.9,  box: [0.08, 0.06, 0.92, 0.53] },
  { id: 'blumenkette',    name: 'Blumenkette',    slot: 'neck', src: 'sprites/wardrobe/blumenkette.webp',    at: [0.5, 0.17], size: 1.0,  box: [0.02, 0.02, 0.98, 0.7] },
  { id: 'halstuch',       name: 'Halstuch',       slot: 'neck', src: 'sprites/wardrobe/halstuch.webp',       at: [0.5, 0.19], size: 0.95, box: [0.06, 0.1, 0.94, 0.8] },
  { id: 'krawatte',       name: 'Krawatte',       slot: 'neck', src: 'sprites/wardrobe/krawatte.webp',       at: [0.5, 0.16], size: 0.8, pose: { sleep: { size: 0.85 } }, box: [0.29, 0.09, 0.71, 0.88] },
  { id: 'gloeckchen',     name: 'Glöckchen',      slot: 'neck', src: 'sprites/wardrobe/gloeckchen.webp',     at: [0.5, 0.2],  size: 0.9, pose: { sleep: { size: 0.85 } }, box: [0.08, 0.1, 0.92, 0.78] },
  { id: 'herzkette',      name: 'Herzkette',      slot: 'neck', src: 'sprites/wardrobe/herzkette.webp',      at: [0.5, 0.11], size: 0.75, pose: { sleep: { size: 0.85 } }, box: [0.13, 0.08, 0.87, 0.83] },
  { id: 'sternabzeichen', name: 'Sternabzeichen', slot: 'neck', src: 'sprites/wardrobe/sternabzeichen.webp', at: [0.5, 0.2],  size: 0.9, pose: { sleep: { size: 0.85 } }, box: [0.08, 0.1, 0.92, 0.85] },
]
