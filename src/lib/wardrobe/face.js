// Lumis Kleiderschrank: things for the face (glasses, masks, noses …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// come from the thing's place in ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'sonnenbrille', name: 'Sonnenbrille', slot: 'face', src: 'sprites/wardrobe/sonnenbrille.webp', at: [0.5, 0.48], size: 2.15, box: [0, 0.34, 1, 0.68], say: 'wort/sonnenbrille' },
  { id: 'herzbrille',   name: 'Herzbrille',   slot: 'face', src: 'sprites/wardrobe/herzbrille.webp',   at: [0.5, 0.47], size: 2.2,  box: [0, 0.27, 1, 0.68] },
  { id: 'rundbrille',   name: 'Runde Brille', slot: 'face', src: 'sprites/wardrobe/rundbrille.webp',   at: [0.5, 0.5],  size: 2.1,  box: [0, 0.31, 1, 0.69], say: 'wort/brille' },
]
