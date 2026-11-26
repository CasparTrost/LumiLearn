// Lumi as the dragon: corrections per thing, merged over the thing's own
// fields when the dragon wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on the dragon.
import HEAD from '../wardrobe/head.js'

// The dragon's head stands a little higher in its square than the chick's:
// the tall hats (and the doctor's hat) a little smaller, so it shrinks no
// more than the chick.
const tall = Object.fromEntries(['partyhut', 'zauberhut', 'zylinder', 'kochmuetze', 'doktorhut'].map(id => [id, { size: +(HEAD.find(t => t.id === id).size * 0.97).toFixed(3) }]))

// Thinking, the dragon tilts its head less than the chick: the chick's own
// lift and tilt for that pose are replaced by a small lift.
const straight = { dx: 0, dy: -8, rot: 0, size: 0.92 }
const hats = Object.fromEntries(HEAD.filter(t => t.pose?.hmm || t.pose?.think).map(t => [t.id, { pose: { hmm: straight, think: straight } }]))

export default {
  ...hats,
  ...Object.fromEntries(Object.entries(tall).map(([id, f]) => [id, { ...(hats[id] ?? {}), ...f }])),
}
