// Lumi as roboter: corrections per thing, merged over the thing's own fields
// when this shape wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on this shape.
import WORN from './roboter-worn.js'
import { wornFit, offFace } from '../wardrobe.js'

const FIT = {
  // crown and diadem cover the antenna (poking up through their middle it
  // looked broken)
  diadem: { tuft: 'hide' },
  krone: { tuft: 'hide' },
  // the cat ears' band rests on the helmet, not above it
  katzenohren: { dy: 0.07 },
  // white things on the white robot: a thin dark outline
  schlittschuhe: { edge: true },
  astronautenstiefel: { edge: true },
  // the rockets' flames reached below the square when the robot cheers or sits
  rakete: { pose: { happy: { dy: -6 }, sleep: { dy: -6 } } },
}

// Off the eyes and the mouth (offFace in ../wardrobe.js; checked by
// tests/unit/wardrobe-eyes.test.js): per thing and pose the pixels a hat goes
// up, or a held thing's turn. The tall hats sit low on its helmet: a little higher, so their
// brims end above the eyes.
const OFF_FACE = {
  kochmuetze: { idle: 7, wave: 5 },
  zauberhut: { idle: 4, wave: 3 },
  zylinder: { idle: 7, wave: 5 },
  weihnachtsmuetze: { idle: 4 },
}

// Things Tripo painted onto the roboter (scripts/art/worn-from-sheet.mjs): drawn
// from their own picture per pose over the pose picture, not placed by anchors
export default wornFit('roboter', WORN, offFace(FIT, OFF_FACE))
