// Lumi as the dino: corrections per thing, merged over the thing's own fields
// when the dino wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on the dino.
import HEAD from '../wardrobe/head.js'
import SHOES from '../wardrobe/shoes.js'

// The dino's head hardly turns when it thinks (the chick's does): the hats
// sit as on the front views, not tilted like the chick's, only lifted a
// little off the eye that looks up.
const straight = { dx: 0, dy: -14, rot: -2, size: 0.94 }
const hats = Object.fromEntries(HEAD.filter(t => t.pose?.hmm || t.pose?.think).map(t => [t.id, { pose: { hmm: straight, think: straight } }]))

// Sitting, its feet are big and lie flat in front: the shoes as big as the feet.
const shoes = Object.fromEntries(SHOES.map(t => [t.id, { pose: { sleep: { dy: 2, size: 1 } } }]))

export default {
  ...hats,
  ...shoes,
  // sitting, the tail lies in the lap, not spread over the floor
  meerjungfrau: { pose: { sleep: { dy: -10, size: 1.2, sy: 0.4 } } },
}
