// Lumis Kleiderschrank: things on the back (capes, wings, a backpack).
// Drawn BEHIND Lumi's picture: what shows is what sticks out left and right
// of the body or above the shoulders. Anchor: the middle between the
// shoulders, width the body's width. The fields are explained in
// ../wardrobe.js; the stars come from ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'umhang', name: 'Umhang', slot: 'back', src: 'sprites/wardrobe/umhang.webp', at: [0.5, 0.29], size: 1.55, box: [0.02, 0.24, 0.98, 0.75] },
]
