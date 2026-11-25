// Lumis Kleiderschrank: things Lumi holds at its wing (a balloon, a wand …).
// Anchor: the tip of the wing that holds (on the sleeping picture: the floor
// beside Lumi), width the size of a held thing. `at` is the point where the
// wing holds the picture (the end of a string, a handle).
// The fields are explained in ../wardrobe.js; the stars come from ORDER
// there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'ballon', name: 'Luftballon', slot: 'hold', src: 'sprites/wardrobe/ballon.webp', at: [0.5, 0.97], size: 1, box: [0.22, 0.02, 0.78, 0.98] },
]
