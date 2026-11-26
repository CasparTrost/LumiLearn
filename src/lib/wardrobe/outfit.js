// Lumis Kleiderschrank: outfits. Tripo painted every figure in all seven poses
// wearing ONE top together with ONE bottom (docs/kleiderschrank-bilder.md,
// "Die Paare"); a top from one sheet with a bottom from another looked broken
// (bits of the other partner in the garment, a bare belly), so the pair from
// one sheet is one thing to wear: an outfit. Worn, it draws its top
// (wardrobe/top.js) over its bottom (wardrobe/bottom.js) from the painted
// pictures; on the shelf its tile shows the top's picture over the bottom's.
// `name`: for the parents (the child sees the pictures). The stars come from
// ORDER in ../wardrobe.js. The pyjama top was painted alone: no bottom.
export default [
  { id: 'outfit-ringelshirt', name: 'Ringelshirt und Jeans', slot: 'outfit', top: 'ringelshirt', bottom: 'jeansshorts' },
  { id: 'outfit-heldenshirt', name: 'Heldenshirt und Skihose', slot: 'outfit', top: 'heldenshirt', bottom: 'skihose' },
  { id: 'outfit-fussballtrikot', name: 'Trikot und Flickenjeans', slot: 'outfit', top: 'fussballtrikot', bottom: 'flickenjeans' },
  { id: 'outfit-hawaiihemd', name: 'Hawaiihemd und Baströckchen', slot: 'outfit', top: 'hawaiihemd', bottom: 'bastrock' },
  { id: 'outfit-katzenhoodie', name: 'Katzenpulli und Leggings', slot: 'outfit', top: 'katzenhoodie', bottom: 'regenbogenleggings' },
  { id: 'outfit-regenjacke', name: 'Regenjacke und Lederhose', slot: 'outfit', top: 'regenjacke', bottom: 'lederhose' },
  { id: 'outfit-bienenkostuem', name: 'Biene mit Tutu', slot: 'outfit', top: 'bienenkostuem', bottom: 'tutu' },
  { id: 'outfit-ritterruestung', name: 'Rüstung und Piratenhose', slot: 'outfit', top: 'ritterruestung', bottom: 'piratenhose' },
  { id: 'outfit-rettungsweste', name: 'Schwimmweste und Badehose', slot: 'outfit', top: 'rettungsweste', bottom: 'entenbadehose' },
  { id: 'outfit-kochjacke', name: 'Kochjacke und Schottenrock', slot: 'outfit', top: 'kochjacke', bottom: 'schottenrock' },
  { id: 'outfit-arztkittel', name: 'Arztkittel und Clownshose', slot: 'outfit', top: 'arztkittel', bottom: 'clownshose' },
  { id: 'outfit-astronautenjacke', name: 'Raumanzug und Prinzessinnenrock', slot: 'outfit', top: 'astronautenjacke', bottom: 'prinzessinnenrock' },
  { id: 'outfit-skijacke', name: 'Meerjungfrau', slot: 'outfit', top: 'skijacke', bottom: 'meerjungfrau' },
  { id: 'outfit-smoking', name: 'Smoking und Shorts', slot: 'outfit', top: 'smoking', bottom: 'fussballshorts' },
  { id: 'outfit-rentierpulli', name: 'Rentierpulli und Schlafanzughose', slot: 'outfit', top: 'rentierpulli', bottom: 'pyjamahose' },
  { id: 'outfit-sternenpyjama', name: 'Sternenschlafanzug', slot: 'outfit', top: 'sternenpyjama' },
]
