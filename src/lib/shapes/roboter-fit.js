// Lumi as roboter: corrections per thing, merged over the thing's own fields
// when this shape wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on this shape.
export default {
  // a diadem lets the antenna come through, like a crown
  diadem: { tuft: 'front' },
  // white things on the white robot: a thin dark outline
  kochjacke: { edge: true },
  arztkittel: { edge: true },
  schlittschuhe: { edge: true },
  astronautenstiefel: { edge: true },
  // the rockets' flames reached below the square when the robot cheers or sits
  rakete: { pose: { happy: { dy: -6 }, sleep: { dy: -6 } } },
}
