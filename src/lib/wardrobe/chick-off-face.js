// Lumis Kleiderschrank: what keeps the chick's things off its eyes (see
// offFace in ../wardrobe.js; the other figures have theirs in
// ../shapes/<id>-fit.js). Per thing and pose: the pixels (of the 384 square)
// a hat goes up, so its brim ends above the eye. Cheering, the chick's eyes
// are arcs high up in its face; thinking, the eye that looks up lies under
// the hat's side. Found with tests/unit/wardrobe-eyes.test.js.
export default {
  muetze: { happy: 3, wave: 2 },
  piratenhut: { happy: 5, wave: 2 },
  basecap: { happy: 6, wave: 4 },
  hasenohren: { hmm: 2, think: 2 },
  propellermuetze: { happy: 5, hmm: 4, think: 4 },
  kochmuetze: { happy: 11, wave: 10 },
  einhornreif: { hmm: 12, think: 12 },
  eierschale: { happy: 2 },
  zauberhut: { happy: 10, wave: 7 },
  zylinder: { happy: 11, hmm: 2, think: 2, wave: 10 },
  weihnachtsmuetze: { hmm: { up: 7, size: 0.98 }, think: { up: 7, size: 0.98 } },
  doktorhut: { hmm: { up: 7, size: 0.98 }, think: { up: 7, size: 0.98 } },
  krone: { hmm: 10, think: 10 },
}
