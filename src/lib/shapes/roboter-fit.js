// Lumi as roboter: corrections per thing, merged over the thing's own fields
// when this shape wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on this shape.
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
}
