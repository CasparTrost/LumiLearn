// Lumi as the dino: corrections per thing, merged over the thing's own fields
// when the dino wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on the dino.
import HEAD from '../wardrobe/head.js'
import SHOES from '../wardrobe/shoes.js'
import BOTTOM from '../wardrobe/bottom.js'

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

// Sitting, its feet are big and lie flat in front: the shoes as big as the feet.
const shoes = Object.fromEntries(SHOES.map(t => [t.id, { pose: { sleep: { dy: 2, size: 1 } } }]))

// Its legs are short: shorts and skirts as long as the chick's reached its
// feet. They are made shorter (long trousers stay long).
const SHORT = ['jeansshorts', 'fussballshorts', 'tutu', 'entenbadehose', 'lederhose', 'bastrock', 'schottenrock', 'prinzessinnenrock']
const short = Object.fromEntries(BOTTOM.filter(t => SHORT.includes(t.id)).map(t => [t.id, { sy: +(t.sy * 0.72).toFixed(3) }]))

export default {
  ...hats,
  ...shoes,
  ...short,
  // the crown and the wreath sit around the head: the big spike stands
  // behind their front, not drawn over it
  krone: { ...hats.krone, tuft: null },
  blumenkranz: { ...hats.blumenkranz, tuft: null },
  // sitting, the tutu stands out less (it stuck out beside the dino)
  tutu: { ...short.tutu, pose: { sleep: { size: 0.55, dy: -8 } } },
  // sitting, the tail lies in the lap, not spread over the floor
  meerjungfrau: { pose: { sleep: { dy: -10, size: 1.2, sy: 0.4 } } },
}
