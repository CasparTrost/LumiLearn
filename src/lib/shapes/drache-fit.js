// Lumi as the dragon: corrections per thing, merged over the thing's own
// fields when the dragon wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on the dragon.
import HEAD from '../wardrobe/head.js'
import SHOES from '../wardrobe/shoes.js'

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

export default {
  ...hats,
  // sitting, the tail lies in the lap, not spread over the floor
  meerjungfrau: { pose: { sleep: { dy: -10, size: 1.2, sy: 0.4 } } },
  // sitting, its feet are smaller than the chick's: the shoes too
  ...Object.fromEntries(SHOES.map(t => [t.id, { pose: { sleep: { size: 0.85, dy: 4 } } }])),
  ...Object.fromEntries(Object.entries(tall).map(([id, f]) => [id, { ...(hats[id] ?? {}), ...f }])),
  // the crown sits around the head: horns and crest stand behind its front
  // band (drawn over it, the crest covered its jewels)
  krone: { ...hats.krone, tuft: null },
  // the moustache right under the nostrils, above the open mouth (the
  // chick's lowered it laughing and waving: on the dragon it hung on the chin)
  schnurrbart: { pose: { idle: { dy: -6 }, happy: { dy: -4 }, sad: { dy: -4 }, wave: { dy: -4 } } },
}
