// Lumi as einhorn: corrections per thing, merged over the thing's own fields
// when this shape wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on this shape.
import { ownTop } from '../wardrobe/top.js'

export default {
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
