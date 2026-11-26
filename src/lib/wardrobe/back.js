// Lumis Kleiderschrank: things on the back (capes, wings, a rocket pack, a peacock's fan).
// Drawn BEHIND Lumi's picture: what shows is what sticks out left and right
// of the body or above the shoulders. Anchor: the middle between the
// shoulders, width the body's width. The fields are explained in
// ../wardrobe.js; the stars come from ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, from scripts/art/schrank-<id>.svg.
export default [
  { id: 'umhang',        name: 'Umhang',              slot: 'back', src: 'sprites/wardrobe/umhang.webp',        at: [0.5, 0.29], size: 1.55, box: [0.02, 0.24, 0.98, 0.75] },
  { id: 'schmetterling', name: 'Schmetterlingsflügel', slot: 'back', src: 'sprites/wardrobe/schmetterling.webp', at: [0.5, 0.52], size: 1.7,  box: [0, 0.12, 1, 0.9] },
  { id: 'engel',         name: 'Engelsflügel',        slot: 'back', src: 'sprites/wardrobe/engel.webp',         at: [0.5, 0.52], size: 1.75, box: [0.03, 0.16, 0.97, 0.8] },
  { id: 'fee',           name: 'Feenflügel',          slot: 'back', src: 'sprites/wardrobe/fee.webp',           at: [0.5, 0.52], size: 1.7,  box: [0.04, 0.02, 0.96, 0.9] },
  { id: 'drache',        name: 'Drachenflügel',       slot: 'back', src: 'sprites/wardrobe/drache.webp',        at: [0.5, 0.53], size: 1.75, box: [0.02, 0.17, 0.98, 0.62] },
  { id: 'rakete',        name: 'Raketenrucksack',     slot: 'back', src: 'sprites/wardrobe/rakete.webp',        at: [0.5, 0.45], size: 1.75, box: [0.02, 0.18, 0.98, 0.9], pose: { sleep: { dy: -14, size: 0.94 } } },
  { id: 'pfau',          name: 'Pfauenfedern',        slot: 'back', src: 'sprites/wardrobe/pfau.webp',          at: [0.5, 0.61], size: 1.82, box: [0.04, 0.1, 0.96, 0.66], dy: 0.19 },
]
