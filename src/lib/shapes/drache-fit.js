// Lumi as the dragon: corrections per thing, merged over the thing's own
// fields when the dragon wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on the dragon.
import HEAD from '../wardrobe/head.js'
import SHOES from '../wardrobe/shoes.js'
import BOTTOM from '../wardrobe/bottom.js'
import { ownTop } from '../wardrobe/top.js'
import POSES from './drache-poses.js'

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

// Its legs are short: the chick's shorts reached its feet and stuck out at
// both hips. They are made narrower and shorter (as wide as its hips, as
// long as its thighs).
const SHORTS = ['jeansshorts', 'fussballshorts', 'entenbadehose', 'lederhose']
const shorts = Object.fromEntries(BOTTOM.filter(t => SHORTS.includes(t.id)).map(t => [t.id, { size: +(t.size * 0.85).toFixed(3), sy: +(t.sy * 0.8 / 0.85).toFixed(3) }]))

// Sitting, every bottom is one garment over its hips and thighs: its drawn
// part fills the lap from under the arms to the floor between the feet
// (the arms and the feet lie in front of it). `sit` places a thing so its
// drawn part (`box`) fills [x0, y0, x1, y1] on the sleeping picture.
function sit(t, [x0, y0, x1, y1], f = {}) {
  const A = POSES.sleep.bottom
  const [bx0, by0, bx1, by1] = t.box ?? [0, 0, 1, 1]
  const W = (x1 - x0) / (bx1 - bx0), H = (y1 - y0) / (by1 - by0)
  return {
    size: +(W / (A.w * (f.size ?? t.size))).toFixed(3), sy: +(H / W).toFixed(3),
    dx: Math.round(x0 + (t.at[0] - bx0) * W - A.x - (t.dx ?? 0) * A.w),
    dy: Math.round(y0 + (t.at[1] - by0) * H - A.y - (t.dy ?? 0) * A.w),
  }
}
const SKIRTS = ['tutu', 'bastrock', 'schottenrock', 'prinzessinnenrock']
const LAP = [84, 268, 298, 374], SHORT = [86, 268, 296, 360], SKIRT = [70, 266, 312, 368]
const sitting = Object.fromEntries(BOTTOM.filter(t => t.feet !== false).map(t => {
  const f = shorts[t.id] ?? {}
  return [t.id, { ...f, pose: { sleep: sit(t, SKIRTS.includes(t.id) ? SKIRT : SHORTS.includes(t.id) ? SHORT : LAP, f) } }]
}))

export default {
  ...sitting,
  ...hats,
  // sitting, the tail lies in the lap, not spread over the floor
  meerjungfrau: { pose: { sleep: { dy: -8, size: 1.85, sy: 0.32 } } },
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
  // tops painted for the dragon (wardrobe/top.js ownTop)
  ringelshirt: ownTop('drache', 'ringelshirt', { at: [0.5, 0.29], size: 1.62, sy: 0.57, box: [0.05, 0.25, 0.95, 0.75] }, { sleep: { size: 0.85 } }),
  hawaiihemd: ownTop('drache', 'hawaiihemd', { at: [0.5, 0.23], size: 1.5, sy: 0.49, box: [0.05, 0.2, 0.95, 0.8] }, { sleep: { size: 0.95 } }),
}
