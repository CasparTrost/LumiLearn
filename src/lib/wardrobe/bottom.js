// Lumis Kleiderschrank: bottoms (shorts, trousers, skirts). Worn over the lower body
// and the legs, under the top's hem; anchor: the waist, width the body's there.
// The fields are explained in ../wardrobe.js; the stars come from ORDER there.
// Picture: public/sprites/wardrobe/<id>.webp, made with Tripo (scripts/art/png-to-webp.mjs).
export default [
  { id: 'jeansshorts', name: 'Jeansshorts', slot: 'bottom', src: 'sprites/wardrobe/jeansshorts.webp', at: [0.500, 0.224], size: 1.444, sy: 0.392, dy: -0.1, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.2, 0.95, 0.8] },
  { id: 'fussballshorts', name: 'Fußballshorts', slot: 'bottom', src: 'sprites/wardrobe/fussballshorts.webp', at: [0.500, 0.168], size: 1.444, sy: 0.332, dy: -0.1, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.14, 0.95, 0.85] },
  { id: 'tutu', name: 'Tutu', slot: 'bottom', src: 'sprites/wardrobe/tutu.webp', at: [0.500, 0.233], size: 1.556, sy: 0.355, dy: -0.1, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.21, 0.95, 0.79] },
  { id: 'entenbadehose', name: 'Badehose', slot: 'bottom', src: 'sprites/wardrobe/entenbadehose.webp', at: [0.500, 0.196], size: 1.444, sy: 0.357, dy: -0.1, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.17, 0.95, 0.83] },
  { id: 'lederhose', name: 'Lederhose', slot: 'bottom', src: 'sprites/wardrobe/lederhose.webp', at: [0.500, 0.196], size: 1.444, sy: 0.357, dy: -0.1, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.17, 0.95, 0.83] },
  { id: 'bastrock', name: 'Baströckchen', slot: 'bottom', src: 'sprites/wardrobe/bastrock.webp', at: [0.500, 0.178], size: 1.444, sy: 0.336, dy: -0.1, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.15, 0.95, 0.85] },
  { id: 'pyjamahose', name: 'Schlafanzughose', slot: 'bottom', src: 'sprites/wardrobe/pyjamahose.webp', at: [0.5, 0.086], size: 1.250, sy: 0.462, dy: -0.2, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.06, 0.05, 0.94, 0.95] },
  { id: 'piratenhose', name: 'Piratenhose', slot: 'bottom', src: 'sprites/wardrobe/piratenhose.webp', at: [0.5, 0.132], size: 1.278, sy: 0.509, dy: -0.2, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.1, 0.95, 0.9] },
  { id: 'schottenrock', name: 'Schottenrock', slot: 'bottom', src: 'sprites/wardrobe/schottenrock.webp', at: [0.500, 0.178], size: 1.444, sy: 0.336, dy: -0.1, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.15, 0.95, 0.85] },
  { id: 'flickenjeans', name: 'Flickenjeans', slot: 'bottom', src: 'sprites/wardrobe/flickenjeans.webp', at: [0.5, 0.123], size: 1.222, sy: 0.519, dy: -0.2, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.05, 0.09, 0.95, 0.91] },
  { id: 'prinzessinnenrock', name: 'Prinzessinnenrock', slot: 'bottom', src: 'sprites/wardrobe/prinzessinnenrock.webp', at: [0.500, 0.086], size: 1.444, sy: 0.292, dy: -0.1, pose: { sleep: { dy: -16, sy: 0.25, size: 0.85 } }, box: [0.05, 0.05, 0.95, 0.95] },
  { id: 'regenbogenleggings', name: 'Regenbogenleggings', slot: 'bottom', src: 'sprites/wardrobe/regenbogenleggings.webp', at: [0.5, 0.086], size: 1.583, sy: 0.365, dy: -0.2, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.2, 0.05, 0.8, 0.95] },
  { id: 'clownshose', name: 'Clownshose', slot: 'bottom', src: 'sprites/wardrobe/clownshose.webp', at: [0.5, 0.24], size: 1.5, sy: 0.457, cutTop: 0.22, edge: true, dy: -0.2, pose: { sleep: { dy: -12, size: 0.85 } }, box: [0.1, 0.05, 0.9, 0.95] },
  { id: 'skihose', name: 'Skihose', slot: 'bottom', src: 'sprites/wardrobe/skihose.webp', at: [0.5, 0.086], size: 1.341, sy: 0.431, dy: -0.2, pose: { sleep: { dy: -16, size: 0.85 } }, box: [0.09, 0.05, 0.91, 0.95] },
  { id: 'meerjungfrau', name: 'Meerjungfrauenflosse', slot: 'bottom', src: 'sprites/wardrobe/meerjungfrau.webp', at: [0.500, 0.086], size: 1.187, sy: 0.580, feet: false, dy: -0.1, pose: { sleep: { dy: -30, size: 1.2, sy: 0.42 } }, box: [0.1, 0.05, 0.9, 0.95] },
]
