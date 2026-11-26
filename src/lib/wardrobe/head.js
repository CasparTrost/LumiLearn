// Lumis Kleiderschrank: things for the head (hats, crowns, ears …).
// One line per thing; the fields are explained in ../wardrobe.js. The stars
// that unlock a thing come from its place in ORDER there (a thing not in
// ORDER yet comes last).
// Picture: public/sprites/wardrobe/<id>.webp, made with Tripo (converted with
// scripts/art/png-to-webp.mjs); the few still drawn come from scripts/art/schrank-<id>.svg.
export default [
  { id: 'muetze',      name: 'Bommelmütze', slot: 'head', src: 'sprites/wardrobe/muetze.webp',      at: [0.5, 0.597], size: 1.15, sy: 0.8, box: [0.08, 0.05, 0.92, 0.95], tuft: 'hide' },
  { id: 'partyhut',    name: 'Partyhut',    slot: 'head', src: 'sprites/wardrobe/partyhut.webp',    at: [0.5, 0.737],  size: 1.15, sy: 0.85, box: [0.15, 0.05, 0.84, 0.95], dx: -0.06, rot: -8 },
  { id: 'blumenkranz', name: 'Blumenkranz', slot: 'head', src: 'sprites/wardrobe/blumenkranz.webp', at: [0.5, 0.485],  size: 1.278, box: [0.05, 0.28, 0.95, 0.72], tuft: 'front' },
  { id: 'piratenhut',  name: 'Piratenhut',  slot: 'head', src: 'sprites/wardrobe/piratenhut.webp',  at: [0.5, 0.552],  size: 1.235,  box: [0.05, 0.18, 0.95, 0.82], tuft: 'hide' },
  { id: 'zauberhut',   name: 'Zauberhut',   slot: 'head', src: 'sprites/wardrobe/zauberhut.webp',   at: [0.5, 0.604],   size: 1.22, box: [0.05, 0.1, 0.95, 0.91], tuft: 'hide' },
  { id: 'krone',       name: 'Krone',       slot: 'head', src: 'sprites/wardrobe/krone.webp',       at: [0.5, 0.530],  size: 1.25, sy: 0.8, box: [0.05, 0.16, 0.95, 0.84], tuft: 'front' },
  { id: 'cowboyhut',       name: 'Cowboyhut',       slot: 'head', src: 'sprites/wardrobe/cowboyhut.webp',       at: [0.5, 0.551], size: 1.404, box: [0.05, 0.23, 0.95, 0.78], tuft: 'hide' },
  { id: 'kochmuetze',      name: 'Kochmütze',       slot: 'head', src: 'sprites/wardrobe/kochmuetze.webp',      at: [0.5, 0.604], size: 1.6, sy: 0.8, box: [0.05, 0.11, 0.95, 0.89], tuft: 'hide' },
  { id: 'feuerwehrhelm',   name: 'Feuerwehrhelm',   slot: 'head', src: 'sprites/wardrobe/feuerwehrhelm.webp',   at: [0.5, 0.559], size: 1.27, box: [0.05, 0.19, 0.95, 0.8], tuft: 'hide' },
  { id: 'matrosenmuetze',  name: 'Matrosenmütze',   slot: 'head', src: 'sprites/wardrobe/matrosenmuetze.webp',  at: [0.5, 0.56], size: 1.306, box: [0.05, 0.2, 0.95, 0.8], tuft: 'hide' },
  { id: 'basecap',         name: 'Kappe',           slot: 'head', src: 'sprites/wardrobe/basecap.webp',         at: [0.5, 0.553], size: 1.035, box: [0.05, 0.09, 0.95, 0.91], tuft: 'hide' },
  { id: 'zylinder',        name: 'Zylinder',        slot: 'head', src: 'sprites/wardrobe/zylinder.webp',        at: [0.5, 0.565], size: 1.395, box: [0.05, 0.17, 0.95, 0.83], tuft: 'hide' },
  { id: 'hasenohren',      name: 'Hasenohren',      slot: 'head', src: 'sprites/wardrobe/hasenohren.webp',      at: [0.5, 0.604], size: 1.45, sy: 0.7, box: [0.07, 0.05, 0.93, 0.95], tuft: 'front' },
  { id: 'katzenohren',     name: 'Katzenohren',     slot: 'head', src: 'sprites/wardrobe/katzenohren.webp',     at: [0.5, 0.591], size: 1.118, box: [0.05, 0.21, 0.95, 0.79], pose: { sleep: { size: 1.15, dy: 10 } }, tuft: 'front' },
  { id: 'strohhut',        name: 'Strohhut',        slot: 'head', src: 'sprites/wardrobe/strohhut.webp',        at: [0.5, 0.546], size: 1.506, box: [0.05, 0.24, 0.95, 0.75], tuft: 'hide' },
  { id: 'weihnachtsmuetze', name: 'Weihnachtsmütze', slot: 'head', src: 'sprites/wardrobe/weihnachtsmuetze.webp', at: [0.5, 0.548], size: 1.241, box: [0.05, 0.17, 0.95, 0.83], tuft: 'hide' },
  { id: 'propellermuetze', name: 'Propellermütze',  slot: 'head', src: 'sprites/wardrobe/propellermuetze.webp', at: [0.5, 0.551], size: 1.114, box: [0.05, 0.12, 0.95, 0.88], tuft: 'hide' },
  { id: 'eierschale',      name: 'Eierschale',      slot: 'head', src: 'sprites/wardrobe/eierschale.webp',      at: [0.5, 0.565], size: 1.124, box: [0.05, 0.14, 0.95, 0.86], tuft: 'hide' },
  { id: 'einhornreif',     name: 'Einhorn-Haarreif', slot: 'head', src: 'sprites/wardrobe/einhornreif.webp',    at: [0.5, 0.604], size: 1.35, sy: 0.75, box: [0.14, 0.05, 0.86, 0.95], pose: { hmm: { size: 0.99 }, think: { size: 0.99 } } },
  { id: 'tortenhut',       name: 'Tortenhut',       slot: 'head', src: 'sprites/wardrobe/tortenhut.webp',       at: [0.5, 0.645], size: 1.15, sy: 0.75, box: [0.11, 0.05, 0.89, 0.95], tuft: 'hide' },
  { id: 'fliegenpilz',     name: 'Fliegenpilz-Hut', slot: 'head', src: 'sprites/wardrobe/fliegenpilz.webp',     at: [0.5, 0.557], size: 1.163, box: [0.05, 0.18, 0.95, 0.82], tuft: 'hide' },
  { id: 'antennen',        name: 'Antennen',        slot: 'head', src: 'sprites/wardrobe/antennen.webp',        at: [0.5, 0.576], size: 1.55, sy: 0.6, box: [0.08, 0.05, 0.92, 0.95], tuft: 'front' },
  { id: 'diadem',          name: 'Diadem',          slot: 'head', src: 'sprites/wardrobe/diadem.webp',          at: [0.5, 0.567], size: 1.22, box: [0.05, 0.19, 0.95, 0.81] },
  { id: 'heiligenschein',  name: 'Heiligenschein',  slot: 'head', src: 'sprites/wardrobe/heiligenschein.webp',  at: [0.5, 0.803], size: 0.899, box: [0.05, 0.32, 0.95, 0.68] },
  { id: 'doktorhut',       name: 'Doktorhut',       slot: 'head', src: 'sprites/wardrobe/doktorhut.webp',       at: [0.5, 0.55], size: 1.365, box: [0.05, 0.17, 0.95, 0.82], tuft: 'hide' },
]
