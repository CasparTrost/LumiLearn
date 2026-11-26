// Lumi as the dragon: corrections per thing, merged over the thing's own
// fields when the dragon wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on the dragon.
import HEAD from '../wardrobe/head.js'
import SHOES from '../wardrobe/shoes.js'
import WORN from './drache-worn.js'
import { wornFit, offFace } from '../wardrobe.js'

// The dragon's head stands a little higher in its square than the chick's
// and its eyes sit high under the brow: every hat sits higher and a little
// smaller (the tall hats and the doctor's hat smaller still), so no brim
// lies on an eye and it shrinks no more than the chick.
const TALL = ['partyhut', 'zauberhut', 'zylinder', 'kochmuetze', 'doktorhut']
const RING = ['heiligenschein', 'diadem', 'krone', 'katzenohren', 'blumenkranz']
const tall = Object.fromEntries(HEAD.filter(t => !RING.includes(t.id)).map(t => [t.id, { size: +(t.size * (TALL.includes(t.id) ? 0.92 : 0.95)).toFixed(3) }]))

// Thinking, the dragon tilts its head less than the chick: the chick's own
// lift and tilt for that pose are replaced by a small lift.
const straight = { dx: 0, dy: -16, rot: -3, size: 0.87 }
const hats = Object.fromEntries(HEAD.map(t => [t.id, { pose: { hmm: straight, think: straight } }]))
// the knitted hat comes down low: thinking a little smaller; the tiara is a
// band and sits on the hair, hardly lifted
hats.muetze = { pose: { hmm: { ...straight, size: 0.85 }, think: { ...straight, size: 0.85 } } }
hats.diadem = { pose: { hmm: { ...straight, dy: -4 }, think: { ...straight, dy: -4 } } }
hats.doktorhut = { pose: { hmm: { ...straight, size: 0.84 }, think: { ...straight, size: 0.84 } } }

const FIT = {
  ...hats,
  // sitting, its big soles face the front: the shoes as big as the feet, over them
  ...Object.fromEntries(SHOES.map(t => [t.id, { pose: { sleep: { size: 1.02, dy: 0 } } }])),
  ...Object.fromEntries(Object.entries(tall).map(([id, f]) => [id, { ...(hats[id] ?? {}), ...f }])),
  // the crown sits around the head: horns and crest stand behind its front
  // band (drawn over it, the crest covered its jewels)
  krone: { ...hats.krone, tuft: null },
  // its paw closes over the cone with the arm raised or hanging: the cone
  // held near its tip, so no loose tip sticks out under the paw
  eis: { pose: { happy: { dy: -20 }, sad: { dy: -20 } } },
  // the balloon leans out beside the head on its string, not on the cheek
  ballon: { pose: { idle: { rot: 16 }, sad: { rot: 18 }, wave: { rot: 16 }, hmm: { rot: -14 }, think: { rot: -14 } } },
  // the moustache right under the nostrils, above the open mouth (the
  // chick's lowered it laughing and waving: on the dragon it hung on the chin)
  schnurrbart: { pose: { idle: { dy: -6 }, happy: { dy: -4 }, sad: { dy: -4 }, wave: { dy: -4 } } },
}

// Off the eyes and the mouth (offFace in ../wardrobe.js; checked by
// tests/unit/wardrobe-eyes.test.js): per thing and pose the pixels a hat goes
// up, or a held thing's turn. Cheering and waving, its eyes are high in the face, right under
// the hats' brims: the hats a little higher. Cheering, the paw holds things up
// beside the eye: they lean outward.
const OFF_FACE = {
  muetze: { happy: 6, wave: { up: 7, size: 0.98 } },
  piratenhut: { idle: 3, happy: 9, wave: 8 },
  basecap: { idle: 7, happy: 12, hmm: 2, think: 2, wave: 9 },
  propellermuetze: { idle: 3, happy: 8, wave: 8 },
  kochmuetze: { idle: 6, happy: 12, wave: 12 },
  cowboyhut: { happy: 2, wave: 3 },
  einhornreif: { idle: 3, happy: 8, wave: 4 },
  feuerwehrhelm: { happy: 2, wave: 3 },
  eierschale: { happy: 4, wave: 5 },
  zauberhut: { idle: 5, happy: 11, wave: 11 },
  strohhut: { happy: 2, wave: 3 },
  matrosenmuetze: { happy: 2, wave: 2 },
  fliegenpilz: { happy: 3, wave: 3 },
  zylinder: { idle: 6, happy: 12, wave: 12 },
  weihnachtsmuetze: { idle: 5, happy: 12, wave: 8 },
  doktorhut: { happy: 4 },
  krone: { happy: 6, wave: 6 },
  zuckerwatte: { happy: { rot: 17 } },
  eis: { happy: { rot: 7 } },
  ukulele: { happy: { rot: 22 } },
}

// Things Tripo painted onto the drache (scripts/art/worn-from-sheet.mjs): drawn
// from their own picture per pose over the pose picture, not placed by anchors
export default wornFit('drache', WORN, offFace(FIT, OFF_FACE))
