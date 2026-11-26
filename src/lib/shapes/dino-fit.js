// Lumi as the dino: corrections per thing, merged over the thing's own fields
// when the dino wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on the dino. `worn`: see wornFit in ../wardrobe.js.
import HEAD from '../wardrobe/head.js'
import SHOES from '../wardrobe/shoes.js'
import BOTTOM from '../wardrobe/bottom.js'
import FACE from '../wardrobe/face.js'
import { ownTop } from '../wardrobe/top.js'
import POSES from './dino-poses.js'
import WORN from './dino-worn.js'
import { wornFit, offFace } from '../wardrobe.js'

// The dino's head hardly turns when it thinks (the chick's does): every hat
// sits as on the front views, not tilted like the chick's, only lifted off
// the eye that looks up and turned a little with its brow.
const straight = { dx: 0, dy: -14, rot: -4, size: 0.94 }
// waving, its eyes open wide: the hats whose brim comes low a little higher
const LOW = ['zylinder', 'krone', 'kochmuetze', 'weihnachtsmuetze', 'zauberhut', 'eierschale']
const hats = Object.fromEntries(HEAD.map(t => [t.id, { pose: { hmm: straight, think: straight, ...(LOW.includes(t.id) ? { wave: { dy: -5 } } : null) } }]))
// the party hat is tall and sits above the eyes anyway: hardly lifted
hats.partyhut = { pose: { hmm: { ...straight, dy: -2 }, think: { ...straight, dy: -2 } } }
// waving, the doctor's hat turned level: its tassel hangs beside the eye, not on it
hats.doktorhut.pose.wave = { rot: -4, dx: -3 }

// Thinking, its face is hardly turned (the chick's is): glasses and masks a
// little wider than the chick's and on its eyes, which look up, not pushed down.
const level = { size: 0.97, dx: 0, dy: -3 }
const glasses = Object.fromEntries(FACE.filter(t => !['clownsnase', 'schnurrbart'].includes(t.id)).map(t => [t.id, { pose: { hmm: level, think: level } }]))

// Sitting, its feet are big and lie flat in front: the shoes as big as the feet.
const shoes = Object.fromEntries(SHOES.map(t => [t.id, { pose: { sleep: { dy: 2, size: 1 } } }]))

// Its legs are short: shorts and skirts as long as the chick's reached its
// feet. They are made smaller, as wide as its hips (the chick's stuck out on
// both sides) and as long as its thighs; skirts stand out a little. Long
// trousers stay long.
const SHORTS = ['jeansshorts', 'fussballshorts', 'entenbadehose', 'lederhose']
const SKIRTS = ['tutu', 'bastrock', 'schottenrock', 'prinzessinnenrock']
const short = Object.fromEntries(BOTTOM.filter(t => SHORTS.includes(t.id) || SKIRTS.includes(t.id)).map(t => {
  const [w, h] = SHORTS.includes(t.id) ? [0.8, 0.8] : [0.9, 0.78]
  return [t.id, { size: +(t.size * w).toFixed(3), sy: +(t.sy * h / w).toFixed(3) }]
}))

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
const LAP = [118, 276, 312, 374], SHORT_LAP = [120, 276, 310, 360], SKIRT_LAP = [104, 272, 326, 366]
const sitting = Object.fromEntries(BOTTOM.filter(t => t.feet !== false).map(t => {
  const f = short[t.id] ?? {}
  return [t.id, { ...f, pose: { sleep: sit(t, SKIRTS.includes(t.id) ? SKIRT_LAP : SHORTS.includes(t.id) ? SHORT_LAP : LAP, f) } }]
}))

const FIT = {
  ...hats,
  ...glasses,
  ...shoes,
  ...sitting,
  // the crown and the wreath sit around the head: the big spike stands
  // behind their front, not drawn over it
  krone: { ...hats.krone, tuft: null },
  blumenkranz: { ...hats.blumenkranz, tuft: null },
  // its head is big and the hand low: the balloon leans out beside the
  // head on its string, not in front of the face
  ballon: { pose: { idle: { rot: 22 }, sad: { rot: 30 }, hmm: { rot: 22 }, think: { rot: 22 }, wave: { rot: 24 } } },
  // sitting, the tail lies in the lap, not spread over the floor
  meerjungfrau: { pose: { sleep: { dy: -20, size: 1.75, sy: 0.3 } } },
  // tops painted for the dino (wardrobe/top.js ownTop)
  ringelshirt: ownTop('dino', 'ringelshirt', { at: [0.5, 0.29], size: 1.42, sy: 0.6, box: [0.05, 0.24, 0.95, 0.76] }, { sad: { size: 1.1, dy: -14 }, sleep: { size: 0.92 } }),
  hawaiihemd: ownTop('dino', 'hawaiihemd', { at: [0.5, 0.23], size: 1.25, sy: 0.5, box: [0.05, 0.18, 0.95, 0.82] }, { sad: { size: 1.1, dy: -14 } }),
}

// Off the eyes and the mouth (offFace in ../wardrobe.js; checked by
// tests/unit/wardrobe-eyes.test.js): per thing and pose the pixels a hat goes
// up, or a held thing's turn. Waving, its eyes open wide right under the brim; the tall hats sit low
// on its round head. Cheering, the paw holds things up beside the eye: an ice
// cream, candy floss and the ukulele lean outward, off the eye.
const OFF_FACE = {
  muetze: { wave: 6 },
  piratenhut: { wave: 5 },
  basecap: { idle: 3, hmm: 2, think: 2, wave: 4 },
  propellermuetze: { wave: 5 },
  kochmuetze: { idle: 6, hmm: 4, think: 4, wave: { up: 8, size: 0.98 } },
  cowboyhut: { wave: 2 },
  feuerwehrhelm: { wave: 2 },
  zauberhut: { idle: 5, hmm: 3, think: 3, wave: 8 },
  matrosenmuetze: { wave: 2 },
  zylinder: { idle: 6, hmm: 4, think: 4, wave: 10 },
  weihnachtsmuetze: { idle: 4, hmm: 3, think: 3 },
  lolli: { happy: { rot: 8 } },
  zuckerwatte: { happy: { rot: 22 } },
  eis: { happy: { rot: 22 } },
  ukulele: { happy: { rot: 27 } },
}

// Things Tripo painted onto the dino (scripts/art/worn-from-sheet.mjs): drawn
// from their own picture per pose over the pose picture, not placed by anchors
export default wornFit('dino', WORN, offFace(FIT, OFF_FACE))
