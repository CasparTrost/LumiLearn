// Lumis Kleiderschrank: things round the neck (scarves, ties, chains …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// come from the thing's place in ORDER there (not in ORDER yet: last).
// Picture: public/sprites/wardrobe/<id>.webp, made with Tripo (converted with
// scripts/art/png-to-webp.mjs); the few still drawn come from scripts/art/schrank-<id>.svg.
export default [
  { id: 'schal',    name: 'Schal',    slot: 'neck', src: 'sprites/wardrobe/schal.webp',    at: [0.5, 0.22], size: 1.0, pose: { sleep: { size: 0.9, cut: 0.62 } }, box: [0.05, 0.09, 0.95, 0.91] },
  { id: 'fliege',   name: 'Fliege',   slot: 'neck', src: 'sprites/wardrobe/fliege.webp',   at: [0.5, 0.42], size: 0.56,  box: [0.05, 0.26, 0.95, 0.74] },
  { id: 'medaille', name: 'Medaille', slot: 'neck', src: 'sprites/wardrobe/medaille.webp', at: [0.5, 0.09], size: 0.903, pose: { sleep: { size: 0.8 } }, box: [0.19, 0.05, 0.81, 0.95] },
  { id: 'perlenkette',    name: 'Perlenkette',    slot: 'neck', src: 'sprites/wardrobe/perlenkette.webp',    at: [0.5, 0.291], size: 0.84,  box: [0.05, 0.22, 0.95, 0.78] },
  { id: 'blumenkette',    name: 'Blumenkette',    slot: 'neck', src: 'sprites/wardrobe/blumenkette.webp',    at: [0.5, 0.316], size: 0.97,  box: [0.05, 0.17, 0.95, 0.83] },
  { id: 'halstuch',       name: 'Halstuch',       slot: 'neck', src: 'sprites/wardrobe/halstuch.webp',       at: [0.5, 0.195], size: 0.929, pose: { sleep: { size: 0.9 } }, box: [0.05, 0.09, 0.95, 0.91] },
  { id: 'krawatte',       name: 'Krawatte',       slot: 'neck', src: 'sprites/wardrobe/krawatte.webp',       at: [0.5, 0.13], size: 0.764, pose: { sleep: { size: 0.85 } }, box: [0.28, 0.05, 0.72, 0.95] },
  { id: 'gloeckchen',     name: 'Glöckchen',      slot: 'neck', src: 'sprites/wardrobe/gloeckchen.webp',     at: [0.5, 0.196],  size: 0.84, pose: { sleep: { size: 0.85 } }, box: [0.05, 0.07, 0.95, 0.93] },
  { id: 'herzkette',      name: 'Herzkette',      slot: 'neck', src: 'sprites/wardrobe/herzkette.webp',      at: [0.495, 0.086], size: 0.804, pose: { sleep: { size: 0.85 } }, box: [0.15, 0.05, 0.84, 0.95] },
  { id: 'sternabzeichen', name: 'Sternabzeichen', slot: 'neck', src: 'sprites/wardrobe/sternabzeichen.webp', at: [0.5, 0.17],  size: 0.88, pose: { sleep: { size: 0.85 } }, box: [0.14, 0.05, 0.86, 0.95] },
  { id: 'kopfhoerer',     name: 'Kopfhörer',      slot: 'neck', src: 'sprites/wardrobe/kopfhoerer.webp',     at: [0.5, 0.16], size: 1.0, pose: { sleep: { size: 0.9 } }, box: [0.05, 0.11, 0.95, 0.89] },
  { id: 'halskrause',     name: 'Halskrause',     slot: 'neck', src: 'sprites/wardrobe/halskrause.webp',     at: [0.5, 0.24],  size: 1.15, pose: { sad: { dy: 6 } }, box: [0.05, 0.2, 0.95, 0.8] },
  { id: 'kamera',         name: 'Kamera',         slot: 'neck', src: 'sprites/wardrobe/kamera.webp',         at: [0.5, 0.06],  size: 0.65, pose: { sleep: { size: 0.85, dy: -8 } }, box: [0.15, 0.05, 0.85, 0.95] },
]
