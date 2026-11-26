// Lumi as einhorn: corrections per thing, merged over the thing's own fields
// when this shape wears it ({ [id]: { size, at, dx, dy, rot, sy, pose: { sleep: {…} }, hide } }).
// `hide: true`: the thing is not drawn on this shape.
export default {
  // the unicorn headband's horn stood on top of the unicorn's own: the own
  // horn and ears go under it (cat and bunny ears keep the own ears and horn:
  // hiding them left a gap above the headband)
  einhornreif: { tuft: 'hide' },
  // a diadem lets the horn come through, like a crown
  diadem: { tuft: 'front' },
  // white things on the white unicorn: a thin dark outline
  kochjacke: { edge: true },
  arztkittel: { edge: true },
  schlittschuhe: { edge: true },
  astronautenstiefel: { edge: true },
  // the rockets' flames reached below the square when the unicorn cheers
  rakete: { pose: { happy: { dy: -6 } } },
}
