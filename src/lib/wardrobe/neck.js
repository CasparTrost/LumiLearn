// Lumis Kleiderschrank: things round the neck (scarves, ties, chains …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// come from the thing's place in ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'schal',    name: 'Schal',    slot: 'neck', src: 'sprites/wardrobe/schal.webp',    at: [0.5, 0.3],  size: 1.12, box: [0.03, 0.22, 0.97, 0.78] },
  { id: 'fliege',   name: 'Fliege',   slot: 'neck', src: 'sprites/wardrobe/fliege.webp',   at: [0.5, 0.44], size: 0.6,  box: [0.08, 0.31, 0.92, 0.7] },
  { id: 'medaille', name: 'Medaille', slot: 'neck', src: 'sprites/wardrobe/medaille.webp', at: [0.5, 0.13], size: 0.8,  box: [0.15, 0.1, 0.85, 0.77] },
]
