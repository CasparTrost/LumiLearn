// Lumi as roboter: corrections per thing, merged over the thing's own fields
// when this shape wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on this shape.
import { ownTop } from '../wardrobe/top.js'

export default {
  // crown and diadem cover the antenna (poking up through their middle it
  // looked broken)
  diadem: { tuft: 'hide' },
  krone: { tuft: 'hide' },
  // white things on the white robot: a thin dark outline
  kochjacke: { edge: true },
  arztkittel: { edge: true },
  schlittschuhe: { edge: true },
  astronautenstiefel: { edge: true },
  // the rockets' flames reached below the square when the robot cheers or sits
  rakete: { pose: { happy: { dy: -6 }, sleep: { dy: -6 } } },
  // the mermaid's tail asleep: the chick's wide flat tail lay across the boots
  meerjungfrau: { pose: { sleep: { size: 1.25, sy: 0.42, dy: -16 } } },
  // tops painted for the robot (wardrobe/top.js ownTop)
  ringelshirt: ownTop('roboter', 'ringelshirt', { at: [0.5, 0.29], size: 1.69, sy: 0.52, box: [0.05, 0.24, 0.95, 0.76] }, { sad: { size: 0.88 }, hmm: { size: 0.92 }, think: { size: 0.92 }, sleep: { size: 0.85 } }),
  hawaiihemd: ownTop('roboter', 'hawaiihemd', { at: [0.5, 0.21], size: 1.46, sy: 0.46, box: [0.05, 0.18, 0.95, 0.82] }, { sad: { size: 0.9 }, sleep: { size: 0.9, dy: -6 } }),
}
