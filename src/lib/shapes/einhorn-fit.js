// Lumi as einhorn: corrections per thing, merged over the thing's own fields
// when this shape wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on this shape.
import { ownTop } from '../wardrobe/top.js'
import WORN from './einhorn-worn.js'
import { wornFit, offFace } from '../wardrobe.js'

const FIT = {
  // the unicorn headband's horn stood on top of the unicorn's own: the own
  // horn and ears go under it (cat and bunny ears keep the own ears and horn:
  // hiding them left a gap above the headband)
  einhornreif: { tuft: 'hide' },
  // cat and bunny ears: the band's ears lie over the unicorn's own ears
  // (one pair of ears; drawn again in front, its own ears stood beside them)
  // and the horn stands in front of the band
  katzenohren: { tuft: null, size: 1.2, dy: 0.06 },
  hasenohren: { tuft: null, size: 1.4, dy: 0.04 },
  // a diadem lets the horn come through, like a crown
  diadem: { tuft: 'front' },
  // white things on the white unicorn: a thin dark outline
  kochjacke: { edge: true },
  arztkittel: { edge: true },
  schlittschuhe: { edge: true },
  astronautenstiefel: { edge: true },
  // the rockets' flames reached below the square when the unicorn cheers
  rakete: { pose: { happy: { dy: -6 } } },
  // the mermaid's tail asleep: narrower than on the chick, between the hooves
  meerjungfrau: { pose: { sleep: { size: 1.3, sy: 0.4, dy: -16 } } },
  // tops painted for the unicorn (wardrobe/top.js ownTop)
  ringelshirt: ownTop('einhorn', 'ringelshirt', { at: [0.5, 0.26], size: 1.55, sy: 0.53, box: [0.05, 0.22, 0.95, 0.78] }, { sleep: { size: 0.92 } }),
  hawaiihemd: ownTop('einhorn', 'hawaiihemd', { at: [0.5, 0.17], size: 1.39, sy: 0.45, box: [0.05, 0.14, 0.95, 0.86] }),
}

// Off the eyes and the mouth (offFace in ../wardrobe.js; checked by
// tests/unit/wardrobe-eyes.test.js): per thing and pose the pixels a hat goes
// up, or a held thing's turn. Its eyes sit high and big under the mane: the tall hats and,
// thinking, the hats tilted over the eye that looks up, a little higher.
// Cheering, the hoof holds things up beside the eye: they lean outward.
const OFF_FACE = {
  muetze: { wave: 5 },
  piratenhut: { wave: 6 },
  basecap: { hmm: { up: 8, size: 0.89 }, think: { up: 8, size: 0.89 }, wave: 7 },
  hasenohren: { hmm: 11, think: 11 },
  propellermuetze: { hmm: 6, think: 6, wave: 7 },
  kochmuetze: { idle: 6, sad: 6, hmm: 6, think: 6, wave: 13 },
  einhornreif: { hmm: 11, think: 11 },
  eierschale: { wave: 4 },
  zauberhut: { idle: 5, sad: 5, wave: 12 },
  zylinder: { idle: 6, sad: 7, hmm: { up: 12, size: 0.98 }, think: { up: 12, size: 0.98 }, wave: 13 },
  weihnachtsmuetze: { idle: 5, sad: 4, wave: 5 },
  krone: { hmm: 10, think: 10, wave: 2 },
  lolli: { happy: { rot: 17 } },
  zuckerwatte: { happy: { rot: 32 } },
  eis: { happy: { rot: 32 } },
  ukulele: { happy: { rot: 32 } },
  windrad: { happy: { dx: 6 } },
  ballon: { sad: { rot: 7 } },
  zauberstab: { sad: { dx: 6 } },
}

// Things Tripo painted onto the einhorn (scripts/art/worn-from-sheet.mjs): drawn
// from their own picture per pose over the pose picture, not placed by anchors
export default wornFit('einhorn', WORN, offFace(FIT, OFF_FACE))
