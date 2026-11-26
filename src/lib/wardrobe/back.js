// Lumis Kleiderschrank: things on the back (capes, wings, a rocket pack, a peacock's fan).
// Drawn BEHIND Lumi's picture: what shows is what sticks out left and right
// of the body or above the shoulders. Anchor: the middle between the
// shoulders, width the body's width. The fields are explained in
// ../wardrobe.js; the stars come from ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, made with Tripo (converted with
// scripts/art/png-to-webp.mjs); the few still drawn come from scripts/art/schrank-<id>.svg.
export default [
  { id: 'umhang',        name: 'Umhang',              slot: 'back', src: 'sprites/wardrobe/umhang.webp',        at: [0.5, 0.33], size: 1.5,  box: [0.01, 0.23, 0.99, 0.88],
    pose: { sleep: { dy: 10, size: 0.86 }, sad: { size: 0.93 } },
    over: [[0.12, 0.24], [0.5, 0.29], [0.88, 0.24], [0.89, 0.345], [0.59, 0.415], [0.555, 0.455], [0.445, 0.455], [0.41, 0.415], [0.11, 0.345]] },
  { id: 'schmetterling', name: 'Schmetterlingsflügel', slot: 'back', src: 'sprites/wardrobe/schmetterling.webp', at: [0.5, 0.5], size: 1.45, dy: 0.02, spread: [45, 0.7],  box: [0.05, 0.1, 0.95, 0.9] },
  { id: 'engel',         name: 'Engelsflügel',        slot: 'back', src: 'sprites/wardrobe/engel.webp',         at: [0.5, 0.6], size: 1.5, dy: 0.06, spread: 42, pose: { happy: { dy: 6 } }, box: [0.03, 0.16, 0.97, 0.8] },
  { id: 'fee',           name: 'Feenflügel',          slot: 'back', src: 'sprites/wardrobe/fee.webp',           at: [0.5, 0.5], size: 1.5, dy: 0.02, spread: [40, 0.7],  box: [0.04, 0.02, 0.96, 0.9] },
  { id: 'drache',        name: 'Drachenflügel',       slot: 'back', src: 'sprites/wardrobe/drache.webp',        at: [0.5, 0.5], size: 1.6, spread: 35, box: [0.02, 0.17, 0.98, 0.62] },
  { id: 'rakete',        name: 'Raketenrucksack',     slot: 'back', src: 'sprites/wardrobe/rakete.webp',        at: [0.5, 0.44], size: 1.55, box: [0.08, 0.05, 0.92, 0.95], pose: { sleep: { dy: -14, size: 0.94 }, sad: { dy: -10 } } },
  { id: 'pfau',          name: 'Pfauenfedern',        slot: 'back', src: 'sprites/wardrobe/pfau.webp',          at: [0.5, 0.61], size: 1.82, box: [0.04, 0.1, 0.96, 0.66], dy: 0.19 },
]
