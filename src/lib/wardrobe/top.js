// Lumis Kleiderschrank: tops (shirts, jackets, pullovers). Worn over the body,
// the wings in front of them; anchor: the middle of the neck line, width the body's.
// The fields are explained in ../wardrobe.js; the stars come from ORDER there.
// Picture: public/sprites/wardrobe/<id>.webp, made with Tripo (scripts/art/png-to-webp.mjs).

/**
 * A top painted for one figure (lib/shapes.js): its own picture,
 * public/sprites/wardrobe/shapes/<figure>/<id>.webp, shaped for that body, with
 * its own placing (`f`: at, size, sy, box …) and per-pose corrections. Every
 * pose is written in full, so none of the chick's per-pose fields carry over
 * (fitted() in ../wardrobe.js merges per pose). The chick's own picture is the
 * thing's `src` below (also the shelf's picture).
 */
export const POSE_KEYS = ['idle', 'happy', 'sad', 'hmm', 'think', 'sleep', 'wave']
export const ownTop = (figure, id, f, pose = {}) => ({
  src: `sprites/wardrobe/shapes/${figure}/${id}.webp`, dx: 0, dy: 0, rot: 0, ...f,
  pose: Object.fromEntries(POSE_KEYS.map(p => [p, { size: 1, sy: f.sy, dx: 0, dy: 0, rot: 0, ...pose[p] }])),
})

export default [
  { id: 'ringelshirt', name: 'Ringelshirt', slot: 'top', src: 'sprites/wardrobe/ringelshirt.webp', at: [0.500, 0.290], size: 1.75, sy: 0.65, pose: { sad: { size: 0.86 }, sleep: { size: 0.8, sy: 0.58 } }, box: [0.05, 0.25, 0.95, 0.75] },
  { id: 'heldenshirt', name: 'Heldenshirt', slot: 'top', src: 'sprites/wardrobe/heldenshirt.webp', at: [0.500, 0.245], size: 1.611, sy: 0.671, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.599 } }, box: [0.05, 0.21, 0.95, 0.79] },
  { id: 'fussballtrikot', name: 'Fußballtrikot', slot: 'top', src: 'sprites/wardrobe/fussballtrikot.webp', at: [0.500, 0.245], size: 1.611, sy: 0.671, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.599 } }, box: [0.05, 0.21, 0.95, 0.79] },
  { id: 'hawaiihemd', name: 'Hawaiihemd', slot: 'top', src: 'sprites/wardrobe/hawaiihemd.webp', at: [0.500, 0.235], size: 1.69, sy: 0.545, pose: { sad: { size: 0.86 }, sleep: { size: 0.8, sy: 0.48 } }, box: [0.05, 0.2, 0.95, 0.8] },
  { id: 'katzenhoodie', name: 'Katzenpulli', slot: 'top', src: 'sprites/wardrobe/katzenhoodie.webp', at: [0.5, 0.46], size: 1.611, sy: 0.795, cutTop: 0.44, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.710 } }, box: [0.05, 0.07, 0.95, 0.93] },
  { id: 'regenjacke', name: 'Regenjacke', slot: 'top', src: 'sprites/wardrobe/regenjacke.webp', at: [0.5, 0.28], size: 1.611, sy: 0.638, cutTop: 0.26, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.570 } }, box: [0.05, 0.13, 0.95, 0.87] },
  { id: 'bienenkostuem', name: 'Bienenkostüm', slot: 'top', src: 'sprites/wardrobe/bienenkostuem.webp', at: [0.500, 0.210], size: 1.778, sy: 0.534, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.477 } }, box: [0.05, 0.17, 0.95, 0.83] },
  { id: 'ritterruestung', name: 'Ritterrüstung', slot: 'top', src: 'sprites/wardrobe/ritterruestung.webp', at: [0.500, 0.183], size: 1.611, sy: 0.541, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.483 } }, box: [0.05, 0.14, 0.95, 0.86] },
  { id: 'rettungsweste', name: 'Rettungsweste', slot: 'top', src: 'sprites/wardrobe/rettungsweste.webp', at: [0.500, 0.164], size: 1.611, sy: 0.530, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.473 } }, box: [0.05, 0.08, 0.95, 0.92] },
  { id: 'sternenpyjama', name: 'Schlafanzug-Oberteil', slot: 'top', src: 'sprites/wardrobe/sternenpyjama.webp', at: [0.500, 0.227], size: 1.611, sy: 0.628, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.561 } }, box: [0.05, 0.19, 0.95, 0.81] },
  { id: 'kochjacke', name: 'Kochjacke', slot: 'top', src: 'sprites/wardrobe/kochjacke.webp', at: [0.500, 0.236], size: 1.611, sy: 0.648, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.579 } }, box: [0.05, 0.2, 0.95, 0.8] },
  { id: 'arztkittel', name: 'Arztkittel', slot: 'top', src: 'sprites/wardrobe/arztkittel.webp', at: [0.500, 0.227], size: 1.611, sy: 0.628, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.561 } }, box: [0.05, 0.19, 0.95, 0.81] },
  { id: 'astronautenjacke', name: 'Astronautenjacke', slot: 'top', src: 'sprites/wardrobe/astronautenjacke.webp', at: [0.5, 0.29], size: 1.611, sy: 0.706, cutTop: 0.27, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.630 } }, box: [0.05, 0.18, 0.95, 0.82] },
  { id: 'skijacke', name: 'Skijacke', slot: 'top', src: 'sprites/wardrobe/skijacke.webp', at: [0.500, 0.225], size: 1.611, sy: 0.607, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.542 } }, box: [0.05, 0.14, 0.95, 0.85] },
  { id: 'smoking', name: 'Smoking', slot: 'top', src: 'sprites/wardrobe/smoking.webp', at: [0.500, 0.236], size: 1.611, sy: 0.648, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.579 } }, box: [0.05, 0.2, 0.95, 0.8] },
  { id: 'rentierpulli', name: 'Rentierpulli', slot: 'top', src: 'sprites/wardrobe/rentierpulli.webp', at: [0.500, 0.201], size: 1.611, sy: 0.572, dy: -0.04, pose: { sleep: { size: 0.8, sy: 0.511 } }, box: [0.05, 0.16, 0.95, 0.84] },
]
