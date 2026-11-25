import { INK } from './px.js'

// ── The hidden-shape pictures of Formen-Land ─────────────────────────────────
// Each picture is written part by part, each part with both of its boxes
// side by side: [type, colour, wide box, upright box, what it does]. The wide
// box is [x, y, w, h] on a 480 × 300 board, the upright one on 300 × 420 (for
// phones held upright, where the wide picture made the pieces too small to
// tap). Parts are drawn in order, later ones on top.
//
// Every kind of shape appears at least twice, and every part looks like the
// shape it is called, as it is drawn: a circle and a square are as high as
// wide, a rhombus is clearly longer one way (a square on its corner is no
// "Raute" to a child), and no part is half hidden behind another (a rhombus
// behind the rocket was a triangle to look at). tests/unit/shapeScenes.test.js
// checks all of it.
//
// `does`, words in any order:
//   loose  may hang at a slant from level 2 (a kite, a balloon)
//   fly    flies up and away once all are found     ┐ every picture has its
//   drive  drives off to the side                   │ moment when the last
//   spin   turns about `spinAt` (the big wheel)     │ shape is found
//   wave   waves where it is (a flag)               ┘
//
// Around the parts: `scenery` is what is no shape to look for (the ground,
// rails, a fence), and nothing in it looks like one: poles and sticks are
// plain lines. `strings` hang on things that fly off and go with them.
// `overlay` is scenery drawn over the parts. `ownSky`: the sky is part of
// the picture (space, the sea, a room) and stays as it is in every look.
// `critter`: the little surprise that hides in the picture at `bug` (default
// the ladybug). Plants are green #3C9A48, outside the shape colours, so they
// stay green in every look.
function picture({ parts, tall, ...rest }) {
  const does = (p, what) => (p[4] ?? '').split(' ').includes(what)
  const ids = what => parts.flatMap((p, id) => (does(p, what) ? [id] : []))
  return {
    ...rest,
    pieces: parts.map(p => [p[0], ...p[2], p[1], does(p, 'loose') ? 1 : 0]),
    tall: { ...tall, boxes: parts.map(p => p[3]) },
    go: { fly: ids('fly'), drive: ids('drive'), spin: ids('spin'), wave: ids('wave') },
  }
}

// little sparkles in space: crosses, so they are never taken for a shape
function Twinkles({ at }) {
  return (
    <g stroke="#FFF3B0" strokeWidth="2" strokeLinecap="round">
      {at.map(([x, y], i) => <path key={i} d={`M${x - 5} ${y} H${x + 5} M${x} ${y - 5} V${y + 5}`} />)}
    </g>
  )
}

// a pole, a stick: a line, never a thin rectangle with an outline
const pole = (d, color = '#9A8FB0') => <path d={d} stroke={color} strokeWidth="5" strokeLinecap="round" fill="none" />
// the string of a balloon or a kite
const string = d => <path d={d} stroke={INK} strokeWidth="1.5" fill="none" opacity="0.6" />

export const SCENES = [
  // ── a street: a house, a fir tree, a car, balloons and kites ──
  picture({
    sky: '#BFE6FF',
    parts: [
      ['circle',    '#FFC93C', [396, 14, 58, 58],   [226, 8, 60, 60]],                // the sun
      ['star',      '#F2B705', [26, 18, 42, 42],    [12, 14, 46, 46], 'loose fly'],   // a star balloon
      ['heart',     '#E0509A', [140, 24, 44, 40],   [70, 40, 46, 42], 'loose fly'],   // a heart balloon
      ['oval',      '#E8503F', [196, 30, 36, 48],   [124, 20, 40, 54], 'loose fly'],  // a balloon
      ['rhombus',   '#8E6CF0', [262, 18, 46, 64],   [176, 80, 48, 66], 'loose fly'],  // the kite
      ['rhombus',   '#3FA34D', [334, 74, 34, 46],   [240, 96, 40, 54], 'loose fly'],  // a small kite
      ['triangle',  '#E8503F', [28, 74, 124, 62],   [14, 160, 136, 66]],              // roof
      ['rectangle', '#8A4F22', [108, 70, 20, 40],   [98, 148, 26, 42]],               // chimney, in front of the roof
      ['circle',    '#BFE6FF', [76, 96, 28, 28],    [64, 180, 34, 34]],               // round window
      ['square',    '#F2B705', [43, 136, 94, 94],   [30, 226, 104, 104]],             // wall
      ['square',    '#BFE6FF', [52, 150, 34, 34],   [42, 242, 40, 40]],               // window
      ['rectangle', '#8A4F22', [96, 168, 34, 62],   [90, 268, 38, 62]],               // door
      ['heart',     '#E0509A', [100, 180, 26, 24],  [92, 280, 32, 30]],               // heart on the door
      ['triangle',  '#3FA34D', [158, 112, 66, 92],  [176, 176, 70, 104]],             // fir tree
      ['star',      '#FFC93C', [172, 90, 38, 38],   [192, 148, 38, 38], 'loose'],     // star on top
      ['rectangle', '#8A4F22', [182, 204, 18, 28],  [200, 280, 22, 30]],              // trunk
      ['oval',      '#3FA34D', [218, 200, 64, 34],  [134, 300, 62, 32]],              // bush
      ['square',    '#BFE6FF', [324, 140, 40, 40],  [196, 312, 40, 40], 'drive'],     // car cabin
      ['rectangle', '#3D8BE0', [290, 180, 116, 38], [156, 352, 128, 40], 'drive'],    // car
      ['circle',    '#2a1b3d', [300, 202, 34, 34],  [166, 378, 34, 34], 'drive'],     // wheel
      ['circle',    '#2a1b3d', [364, 202, 34, 34],  [240, 378, 34, 34], 'drive'],     // wheel
      ['triangle',  '#FFC93C', [420, 132, 50, 44],  [246, 236, 52, 46]],              // warning sign
      ['circle',    '#E8503F', [250, 248, 32, 32],  [14, 362, 38, 38]],               // ball
      ['square',    '#8E6CF0', [140, 246, 38, 38],  [62, 356, 42, 42], 'loose'],      // gift
      ['oval',      '#9A8FB0', [414, 254, 44, 28],  [108, 392, 42, 24]],              // a stone
    ],
    scenery: (
      <>
        <rect x="0" y="230" width="480" height="70" fill="#7CC86A" />
        <rect x="0" y="230" width="480" height="8" fill="#5CAE52" />
        {pole('M445 176 V232')}
      </>
    ),
    strings: string('M47 60 Q60 120 70 200 M162 64 Q170 120 160 200 M214 78 Q220 140 236 200 M285 82 Q300 120 290 150'),
    tall: {
      scenery: (
        <>
          <rect x="0" y="330" width="300" height="90" fill="#7CC86A" />
          <rect x="0" y="330" width="300" height="8" fill="#5CAE52" />
          {pole('M272 282 V332')}
        </>
      ),
      strings: string('M35 60 Q28 110 34 160 M93 82 Q100 120 96 160 M144 74 Q140 120 150 170 M200 146 Q190 162 198 176 M260 150 Q252 165 262 178'),
      bug: [262, 300],
    },
    bug: [446, 212],
  }),

  // ── a fair: the big wheel, a tent, a booth ──
  picture({
    sky: '#FFE2C2',
    parts: [
      ['star',      '#F2B705', [18, 16, 36, 36],    [12, 12, 40, 40], 'loose'],
      ['star',      '#E8503F', [84, 30, 34, 34],    [66, 44, 36, 36], 'loose'],
      ['rhombus',   '#3D8BE0', [150, 14, 40, 58],   [14, 84, 40, 58], 'loose fly'],   // kite
      ['rhombus',   '#E0509A', [118, 76, 30, 42],   [70, 98, 32, 44], 'loose fly'],   // small kite
      ['circle',    '#FFE08A', [300, 24, 154, 154], [133, 37, 150, 150], 'spin'],     // the big wheel
      ['square',    '#E8503F', [362, 32, 30, 30],   [193, 45, 30, 30], 'spin'],       // cabin, inside the rim
      ['square',    '#3FA34D', [308, 86, 30, 30],   [141, 97, 30, 30], 'spin'],       // cabin
      ['square',    '#3D8BE0', [416, 86, 30, 30],   [245, 97, 30, 30], 'spin'],       // cabin
      ['triangle',  '#8A4F22', [317, 101, 120, 129], [153, 112, 110, 188]],           // its stand, in front, from the hub to the ground
      ['triangle',  '#3D8BE0', [78, 92, 26, 24],    [45, 292, 26, 24], 'loose'],      // flag on the tent
      ['triangle',  '#E8503F', [26, 118, 130, 112], [6, 318, 104, 96]],               // tent
      ['rectangle', '#2a1b3d', [74, 176, 34, 54],   [41, 366, 34, 48]],               // tent door
      ['oval',      '#8E6CF0', [170, 120, 74, 30],  [188, 304, 76, 28]],              // sign
      ['rectangle', '#3FA34D', [176, 150, 62, 80],  [195, 332, 62, 82]],              // booth
      ['square',    '#BFE6FF', [190, 162, 34, 34],  [209, 342, 34, 34]],              // booth window
      ['heart',     '#E0509A', [194, 200, 28, 26],  [212, 382, 28, 26]],              // heart on the booth
      ['oval',      '#3D8BE0', [246, 56, 32, 44],   [20, 150, 34, 44], 'loose fly'],  // balloon
      ['heart',     '#E0509A', [206, 44, 36, 32],   [60, 196, 34, 30], 'loose fly'],  // heart balloon
      ['circle',    '#F2B705', [252, 118, 30, 30],  [96, 150, 32, 32], 'loose fly'],  // balloon
      ['circle',    '#E0509A', [258, 196, 34, 34],  [264, 330, 30, 30]],              // lollipop
      ['rectangle', '#8A4F22', [14, 248, 80, 20],   [116, 396, 72, 18]],              // bench
      ['square',    '#F2B705', [116, 244, 40, 40],  [120, 346, 38, 38], 'loose'],     // crate
      ['oval',      '#3FA34D', [416, 238, 58, 28],  [258, 392, 40, 24]],              // bush
    ],
    scenery: (
      <>
        <rect x="0" y="230" width="480" height="70" fill="#E8C27A" />
        <rect x="0" y="230" width="480" height="8" fill="#D4A95E" />
        {pole('M275 228 V260', '#fff')}
        <path d="M91 96 V122" stroke={INK} strokeWidth="2" />
      </>
    ),
    // the balloons are tied to the booth …
    strings: string('M224 76 Q232 120 238 152 M262 100 Q256 130 238 152 M267 148 Q252 150 238 152'),
    spinAt: [377, 101],
    tall: {
      scenery: (
        <>
          <rect x="0" y="296" width="300" height="124" fill="#E8C27A" />
          <rect x="0" y="296" width="300" height="8" fill="#D4A95E" />
          {pole('M279 358 V390', '#fff')}
          <path d="M58 296 V320" stroke={INK} strokeWidth="2" />
        </>
      ),
      // … and to the top of the tent
      strings: string('M37 194 Q40 260 58 318 M77 226 Q70 280 58 318 M112 182 Q100 260 58 318'),
      spinAt: [208, 112],
      bug: [268, 240],
    },
    bug: [30, 222],
  }),

  // ── a sailing ship by an island ──
  picture({
    sky: '#BFE6FF',
    parts: [
      ['circle',    '#FFC93C', [404, 14, 56, 56],   [236, 8, 54, 54]],                // the sun
      ['oval',      '#FFFFFF', [24, 22, 72, 30],    [14, 20, 70, 28]],                // cloud
      ['oval',      '#FFFFFF', [300, 44, 60, 24],   [150, 40, 56, 22]],               // cloud
      ['rectangle', '#8A4F22', [226, 36, 12, 140],  [108, 70, 12, 166], 'drive'],     // mast
      ['rhombus',   '#E0509A', [238, 12, 24, 32],   [120, 44, 24, 32], 'loose drive'], // pennant
      ['triangle',  '#E8503F', [124, 52, 98, 118],  [20, 90, 86, 140], 'drive'],      // big sail
      ['triangle',  '#F2B705', [242, 72, 72, 98],   [124, 110, 62, 120], 'drive'],    // small sail
      ['star',      '#FFC93C', [157, 112, 32, 32],  [47, 170, 32, 32], 'drive'],      // star on the sail
      ['square',    '#8E6CF0', [322, 140, 30, 30],  [186, 208, 28, 28], 'drive'],     // crate on deck
      ['rectangle', '#8A4F22', [96, 170, 270, 44],  [14, 236, 200, 50], 'drive'],     // hull
      ['circle',    '#BFE6FF', [120, 180, 24, 24],  [30, 248, 26, 26], 'drive'],      // porthole
      ['circle',    '#BFE6FF', [170, 180, 24, 24],  [80, 248, 26, 26], 'drive'],      // porthole
      ['circle',    '#BFE6FF', [220, 180, 24, 24],  [130, 248, 26, 26], 'drive'],     // porthole
      ['heart',     '#E0509A', [300, 180, 28, 26],  [176, 248, 28, 26], 'drive'],     // heart on the hull
      ['oval',      '#3FA34D', [396, 100, 70, 28],  [226, 172, 68, 28]],              // palm leaves
      ['oval',      '#E8C27A', [380, 196, 96, 36],  [210, 290, 88, 36]],              // island
      ['rectangle', '#8A4F22', [424, 118, 12, 90],  [254, 190, 12, 110]],             // palm trunk, in front of both
      ['rhombus',   '#E8503F', [40, 180, 30, 44],   [16, 300, 28, 42], 'loose'],      // buoy
      ['oval',      '#F2B705', [36, 246, 48, 24],   [60, 340, 48, 24]],               // fish
      ['triangle',  '#9A8FB0', [262, 232, 36, 30],  [150, 306, 36, 30]],              // a fin
      ['star',      '#E0509A', [190, 250, 36, 36],  [120, 370, 38, 38]],              // starfish
      ['heart',     '#F2B705', [120, 262, 28, 26],  [200, 378, 30, 28]],              // shell
      ['oval',      '#8E6CF0', [330, 258, 44, 22],  [240, 344, 44, 22]],              // fish
      ['square',    '#3FA34D', [420, 250, 32, 32],  [250, 386, 30, 30], 'loose'],     // floating crate
    ],
    scenery: (
      <>
        <rect x="0" y="200" width="480" height="100" fill="#5BB4E8" />
        <path d="M0 204 Q20 196 40 204 T80 204 T120 204 T160 204 T200 204 T240 204 T280 204 T320 204 T360 204 T400 204 T440 204 T480 204" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" />
        <path d="M30 236 q10 -6 20 0 M150 232 q10 -6 20 0 M380 240 q10 -6 20 0 M260 280 q10 -6 20 0 M80 290 q10 -6 20 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.7" />
      </>
    ),
    tall: {
      scenery: (
        <>
          <rect x="0" y="270" width="300" height="150" fill="#5BB4E8" />
          <path d="M0 274 Q20 266 40 274 T80 274 T120 274 T160 274 T200 274 T240 274 T280 274 T320 274" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" />
          <path d="M60 316 q10 -6 20 0 M200 338 q10 -6 20 0 M30 400 q10 -6 20 0 M170 410 q10 -6 20 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.7" />
        </>
      ),
      bug: [272, 292],
    },
    bug: [446, 198],
  }),

  // ── the farm: a red barn, a tractor, hay, a tree ──
  picture({
    sky: '#BFE6FF',
    parts: [
      ['circle',    '#FFC93C', [408, 12, 56, 56],  [232, 10, 56, 56]],             // the sun
      ['oval',      '#FFFFFF', [22, 20, 76, 28],   [14, 20, 72, 26]],              // cloud
      ['oval',      '#FFFFFF', [236, 34, 62, 24],  [100, 72, 58, 22]],             // cloud
      ['rhombus',   '#8E6CF0', [330, 22, 36, 50],  [168, 26, 36, 50], 'loose fly'], // kite
      ['square',    '#E8503F', [40, 120, 110, 110], [20, 190, 112, 112]],          // barn
      ['triangle',  '#8A4F22', [28, 54, 134, 66],  [8, 120, 136, 70]],             // barn roof, on the wall
      ['rhombus',   '#F2B705', [80, 74, 30, 40],   [61, 142, 30, 40]],             // hay loft window
      ['rectangle', '#8A4F22', [72, 166, 46, 64],  [53, 236, 46, 66]],             // barn door
      ['heart',     '#E0509A', [82, 180, 26, 24],  [63, 250, 26, 24]],             // heart on the door
      ['oval',      '#3C9A48', [400, 78, 68, 90],  [210, 112, 72, 98]],            // tree top
      ['rectangle', '#8A4F22', [424, 162, 20, 68], [236, 196, 20, 104]],           // tree trunk, in front of it
      ['triangle',  '#E8C27A', [166, 166, 64, 64], [136, 240, 60, 60]],            // haystack
      ['circle',    '#E8C27A', [232, 192, 38, 38], [198, 264, 36, 36]],            // hay bale, beside it
      ['square',    '#BFE6FF', [284, 130, 46, 46], [150, 310, 46, 46], 'drive'],   // tractor cabin
      ['rectangle', '#3FA34D', [278, 176, 100, 34], [144, 356, 104, 34], 'drive'], // tractor
      ['circle',    '#2a1b3d', [274, 188, 46, 46], [140, 368, 46, 46], 'drive'],   // big wheel
      ['circle',    '#2a1b3d', [346, 202, 30, 30], [214, 382, 30, 30], 'drive'],   // small wheel
      ['star',      '#F2B705', [14, 244, 34, 34],  [16, 326, 34, 34]],             // star flower
      ['star',      '#E0509A', [396, 250, 30, 30], [258, 330, 30, 30]],            // star flower
      ['heart',     '#E8503F', [130, 256, 28, 26], [72, 372, 28, 26]],             // heart flower
    ],
    scenery: (
      <>
        <rect x="0" y="226" width="480" height="74" fill="#7CC86A" />
        <rect x="0" y="226" width="480" height="8" fill="#5CAE52" />
        <path d="M372 196 V230 M392 196 V230 M466 196 V230 M366 204 H480 M366 218 H480" stroke="#C98A52" strokeWidth="5" strokeLinecap="round" />
        <path d="M31 278 V296 M411 280 V296 M144 282 V296" stroke="#3E8A3A" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    strings: string('M348 72 Q340 92 350 108 T344 140'),
    tall: {
      scenery: (
        <>
          <rect x="0" y="300" width="300" height="120" fill="#7CC86A" />
          <rect x="0" y="300" width="300" height="8" fill="#5CAE52" />
          <path d="M150 262 V300 M206 262 V300 M150 272 H290 M150 288 H290" stroke="#C98A52" strokeWidth="5" strokeLinecap="round" />
          <path d="M33 360 V378 M273 360 V376 M86 398 V412" stroke="#3E8A3A" strokeWidth="3" strokeLinecap="round" />
        </>
      ),
      strings: string('M186 76 Q178 96 188 112 T182 140'),
      bug: [262, 392],
    },
    bug: [306, 262],
  }),

  // ── space: a rocket, planets, stars, a rover on the moon ──
  picture({
    sky: '#2B2F6B',
    ownSky: true,
    parts: [
      ['circle',    '#3FA34D', [34, 22, 40, 40],   [18, 18, 40, 40]],              // little planet
      ['circle',    '#E0509A', [378, 26, 66, 66],  [208, 38, 66, 66]],             // ringed planet
      ['oval',      '#F2B705', [354, 50, 114, 22], [184, 62, 112, 22]],            // its ring
      ['star',      '#F2B705', [120, 16, 36, 36],  [84, 12, 34, 34]],
      ['star',      '#FFC93C', [300, 116, 30, 30], [250, 140, 30, 30]],
      ['star',      '#FFFFFF', [444, 126, 26, 26], [18, 136, 28, 28]],
      ['oval',      '#3FA34D', [128, 72, 72, 24],  [216, 226, 72, 24]],            // flying saucer
      ['oval',      '#F2B705', [216, 182, 40, 52], [130, 250, 40, 54], 'fly'],     // the flame, under the rocket
      ['rhombus',   '#3D8BE0', [176, 124, 30, 62], [88, 184, 30, 64], 'fly'],      // fin, beside the rocket
      ['rhombus',   '#3D8BE0', [266, 124, 30, 62], [182, 184, 30, 64], 'fly'],     // fin
      ['rectangle', '#FFFFFF', [206, 66, 60, 116], [118, 122, 64, 128], 'fly'],    // the rocket
      ['triangle',  '#E8503F', [206, 18, 60, 52],  [118, 70, 64, 56], 'fly'],      // its nose
      ['circle',    '#BFE6FF', [220, 84, 32, 32],  [134, 142, 32, 32], 'fly'],     // window
      ['heart',     '#E0509A', [222, 134, 28, 26], [136, 200, 28, 26], 'fly'],     // heart on the rocket
      ['rectangle', '#3D8BE0', [40, 140, 42, 18],  [6, 92, 32, 16]],               // solar panel
      ['square',    '#9A8FB0', [84, 128, 42, 42],  [40, 80, 38, 38]],              // satellite
      ['rectangle', '#3D8BE0', [128, 140, 42, 18], [80, 92, 32, 16]],              // solar panel
      ['triangle',  '#3FA34D', [74, 212, 30, 26],  [32, 296, 30, 26]],             // flag on the moon
      ['triangle',  '#9A8FB0', [404, 188, 68, 64], [222, 290, 70, 64]],            // moon mountain
      ['heart',     '#E8503F', [358, 214, 24, 22], [158, 336, 24, 22], 'drive'],   // heart on the moon car
      ['square',    '#BFE6FF', [318, 204, 32, 32], [120, 326, 32, 32], 'drive'],   // moon car cabin
      ['rectangle', '#F2B705', [306, 236, 84, 24], [108, 358, 84, 24], 'drive'],   // moon car
      ['circle',    '#2a1b3d', [312, 252, 26, 26], [114, 374, 26, 26], 'drive'],   // wheel
      ['circle',    '#2a1b3d', [358, 252, 26, 26], [162, 374, 26, 26], 'drive'],   // wheel
    ],
    scenery: (
      <>
        <Twinkles at={[[24, 96], [180, 40], [290, 20], [340, 150], [460, 200], [160, 190], [100, 250], [450, 110]]} />
        <path d="M0 246 Q120 232 240 246 T480 242 V300 H0Z" fill="#C9C3D9" stroke={INK} strokeWidth="2" />
        <path d="M30 276 q16 -8 32 0 M190 268 q12 -6 24 0 M410 280 q18 -8 36 0 M250 288 q10 -5 20 0" stroke="#9A8FB0" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M143 74 A21 21 0 0 1 185 74 Z" fill="#BFE6FF" stroke={INK} strokeWidth="2.5" />
        <path d="M105 128 V114 M74 212 V256" stroke="#9A8FB0" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
    tall: {
      scenery: (
        <>
          <Twinkles at={[[70, 64], [150, 30], [280, 128], [20, 200], [70, 280], [276, 190], [240, 14], [120, 56]]} />
          <path d="M0 330 Q75 318 150 330 T300 326 V420 H0Z" fill="#C9C3D9" stroke={INK} strokeWidth="2" />
          <path d="M20 370 q16 -8 32 0 M220 380 q18 -8 36 0 M200 404 q10 -5 20 0" stroke="#9A8FB0" strokeWidth="3" fill="none" strokeLinecap="round" />
          <path d="M231 228 A21 21 0 0 1 273 228 Z" fill="#BFE6FF" stroke={INK} strokeWidth="2.5" />
          <path d="M59 80 V66 M32 296 V342" stroke="#9A8FB0" strokeWidth="3" strokeLinecap="round" />
        </>
      ),
      bug: [40, 384],
    },
    bug: [150, 262],
  }),

  // ── a castle on a hill: fireworks from the towers when all are found ──
  picture({
    sky: '#BFE6FF',
    parts: [
      ['circle',    '#FFC93C', [412, 12, 52, 52],  [124, 8, 52, 52]],              // the sun
      ['oval',      '#FFFFFF', [18, 26, 74, 28],   [10, 14, 70, 26], 'drive'],     // cloud
      ['oval',      '#FFFFFF', [392, 92, 70, 26],  [214, 16, 74, 26], 'drive'],    // cloud
      ['rectangle', '#9A8FB0', [110, 96, 60, 136], [24, 146, 60, 170]],            // tower
      ['rectangle', '#9A8FB0', [310, 96, 60, 136], [216, 146, 60, 170]],           // tower
      ['square',    '#C9C3D9', [175, 102, 130, 130], [88, 192, 124, 124]],         // the castle
      ['triangle',  '#3D8BE0', [106, 44, 68, 54],  [20, 92, 68, 56]],              // tower roof
      ['triangle',  '#3D8BE0', [306, 44, 68, 54],  [212, 92, 68, 56]],             // tower roof
      ['triangle',  '#E8503F', [172, 46, 136, 56], [86, 136, 128, 56]],            // castle roof, between the towers
      ['rhombus',   '#E0509A', [142, 6, 24, 32],   [56, 54, 24, 32], 'loose wave'], // flag
      ['rhombus',   '#3FA34D', [342, 6, 24, 32],   [248, 54, 24, 32], 'loose wave'], // flag
      ['star',      '#FFC93C', [126, 64, 28, 28],  [40, 114, 28, 28], 'fly'],      // star on the roof
      ['star',      '#FFC93C', [326, 64, 28, 28],  [232, 114, 28, 28], 'fly'],     // star on the roof
      ['square',    '#BFE6FF', [125, 120, 30, 30], [39, 168, 30, 30]],             // tower window
      ['square',    '#BFE6FF', [325, 120, 30, 30], [231, 168, 30, 30]],            // tower window
      ['circle',    '#BFE6FF', [222, 116, 36, 36], [132, 204, 36, 36]],            // round window
      ['heart',     '#E8503F', [186, 124, 28, 26], [96, 212, 28, 26]],             // shield
      ['heart',     '#F2B705', [266, 124, 28, 26], [176, 212, 28, 26]],            // shield
      ['rectangle', '#8A4F22', [214, 166, 52, 66], [124, 250, 52, 66]],            // the gate
      ['oval',      '#5BB4E8', [372, 248, 92, 30], [190, 348, 94, 30]],            // pond
      ['oval',      '#3C9A48', [16, 206, 70, 32],  [12, 340, 70, 32]],             // bush
    ],
    scenery: (
      <>
        <path d="M0 236 Q240 214 480 236 V300 H0Z" fill="#7CC86A" />
        <path d="M0 236 Q240 214 480 236" stroke="#5CAE52" strokeWidth="8" fill="none" />
        <path d="M212 232 L262 232 L300 300 L180 300Z" fill="#E8C27A" />
        <path d="M140 44 V8 M340 44 V8" stroke={INK} strokeWidth="2.5" />
      </>
    ),
    tall: {
      scenery: (
        <>
          <path d="M0 318 Q150 304 300 318 V420 H0Z" fill="#7CC86A" />
          <path d="M0 318 Q150 304 300 318" stroke="#5CAE52" strokeWidth="8" fill="none" />
          <path d="M122 316 L178 316 L196 420 L104 420Z" fill="#E8C27A" />
          <path d="M54 92 V56 M246 92 V56" stroke={INK} strokeWidth="2.5" />
        </>
      ),
      bug: [30, 392],
    },
    bug: [60, 262],
  }),

  // ── under the sea: a submarine, fish, bubbles, starfish ──
  picture({
    sky: '#4FA8DC',
    ownSky: true,
    critter: '🦀',
    parts: [
      ['circle',    '#E8F7FF', [204, 20, 30, 30],  [234, 12, 30, 30], 'fly'],      // bubble
      ['circle',    '#E8F7FF', [228, 58, 24, 24],  [262, 50, 24, 24], 'fly'],      // bubble
      ['circle',    '#E8F7FF', [180, 100, 26, 26], [22, 120, 26, 26], 'fly'],      // bubble
      ['rhombus',   '#E8503F', [238, 84, 20, 38],  [76, 90, 20, 40], 'drive'],     // propeller, at the stern
      ['rectangle', '#9A8FB0', [352, 22, 10, 32],  [184, 26, 10, 34], 'drive'],    // periscope
      ['oval',      '#F2B705', [260, 70, 154, 66], [98, 76, 156, 68], 'drive'],    // submarine
      ['rectangle', '#F2B705', [318, 48, 48, 30],  [150, 54, 48, 30], 'drive'],    // tower, on it
      ['circle',    '#BFE6FF', [288, 90, 26, 26],  [126, 96, 28, 28], 'drive'],    // porthole
      ['circle',    '#BFE6FF', [330, 90, 26, 26],  [170, 96, 28, 28], 'drive'],    // porthole
      ['oval',      '#E8503F', [38, 92, 66, 38],   [30, 182, 70, 40]],             // fish
      ['rhombus',   '#E8503F', [100, 90, 24, 42],  [96, 181, 24, 42]],             // its tail
      ['oval',      '#8E6CF0', [120, 170, 56, 32], [168, 222, 58, 32]],            // fish
      ['rhombus',   '#8E6CF0', [172, 168, 20, 36], [222, 220, 20, 36]],            // its tail
      ['triangle',  '#3C9A48', [12, 140, 44, 112], [8, 238, 44, 116]],             // seaweed
      ['triangle',  '#3C9A48', [434, 160, 36, 92], [256, 262, 36, 92]],            // seaweed
      ['square',    '#C98A52', [298, 204, 48, 48], [120, 300, 48, 48], 'loose'],   // sunken box
      ['square',    '#8E6CF0', [348, 222, 30, 30], [172, 318, 30, 30], 'loose'],   // little box
      ['star',      '#E0509A', [200, 236, 40, 40], [58, 348, 40, 40]],             // starfish
      ['star',      '#F2B705', [394, 254, 30, 30], [232, 372, 30, 30]],            // starfish
      ['heart',     '#E8503F', [86, 256, 28, 26],  [120, 376, 30, 28]],            // shell
      ['heart',     '#FFC93C', [262, 264, 24, 22], [186, 386, 26, 24]],            // shell
    ],
    scenery: (
      <>
        <path d="M60 0 L100 0 L40 220 L10 220Z M300 0 L330 0 L280 220 L250 220Z" fill="#fff" opacity="0.12" />
        <path d="M0 248 Q60 236 120 246 T240 244 T360 246 T480 240 V300 H0Z" fill="#E8C27A" />
        <path d="M0 248 Q60 236 120 246 T240 244 T360 246 T480 240" stroke="#D4A95E" strokeWidth="6" fill="none" />
        <path d="M150 230 q6 -14 0 -28 M160 236 q-6 -16 2 -30 M452 160 q8 -16 0 -30" stroke="#2F8F3A" strokeWidth="4" fill="none" strokeLinecap="round" />
      </>
    ),
    tall: {
      scenery: (
        <>
          <path d="M40 0 L80 0 L30 300 L0 300Z M200 0 L230 0 L190 300 L160 300Z" fill="#fff" opacity="0.12" />
          <path d="M0 346 Q50 334 100 344 T200 342 T300 338 V420 H0Z" fill="#E8C27A" />
          <path d="M0 346 Q50 334 100 344 T200 342 T300 338" stroke="#D4A95E" strokeWidth="6" fill="none" />
          <path d="M70 330 q6 -14 0 -28 M80 336 q-6 -16 2 -30 M274 260 q8 -16 0 -30" stroke="#2F8F3A" strokeWidth="4" fill="none" strokeLinecap="round" />
        </>
      ),
      bug: [16, 388],
    },
    bug: [440, 270],
  }),

  // ── a train on its way ──
  picture({
    sky: '#BFE6FF',
    parts: [
      ['circle',    '#FFC93C', [24, 14, 52, 52],   [14, 14, 52, 52]],              // the sun
      ['oval',      '#FFFFFF', [110, 26, 72, 26],  [96, 26, 72, 26]],              // cloud
      ['oval',      '#FFFFFF', [420, 22, 52, 30],  [206, 40, 52, 30], 'loose fly'], // smoke
      ['oval',      '#FFFFFF', [398, 64, 40, 26],  [236, 92, 40, 26], 'loose fly'], // smoke
      ['heart',     '#E0509A', [156, 84, 30, 28],  [60, 118, 30, 28], 'loose fly'], // balloon
      ['triangle',  '#3C9A48', [14, 108, 64, 118], [30, 290, 70, 110]],            // fir tree
      ['star',      '#FFC93C', [31, 92, 30, 30],   [50, 272, 30, 30]],             // star on the tree
      ['rectangle', '#3D8BE0', [106, 152, 152, 58], [8, 190, 124, 52], 'drive'],   // the wagon
      ['square',    '#BFE6FF', [118, 162, 32, 32], [16, 198, 28, 28], 'drive'],    // window
      ['rhombus',   '#F2B705', [166, 160, 26, 36], [53, 196, 24, 32], 'drive'],    // diamond on the wagon
      ['square',    '#BFE6FF', [208, 162, 32, 32], [86, 198, 28, 28], 'drive'],    // window
      ['circle',    '#2a1b3d', [118, 198, 34, 34], [18, 232, 30, 30], 'drive'],    // wheel
      ['circle',    '#2a1b3d', [212, 198, 34, 34], [92, 232, 30, 30], 'drive'],    // wheel
      ['rectangle', '#8A4F22', [404, 104, 24, 44], [258, 144, 22, 42], 'drive'],   // chimney
      ['rectangle', '#3FA34D', [330, 144, 112, 52], [196, 182, 98, 48], 'drive'],  // engine
      ['heart',     '#E0509A', [356, 156, 28, 26], [212, 192, 26, 24], 'drive'],   // heart on the engine
      ['square',    '#E8503F', [268, 112, 64, 64], [140, 158, 58, 58], 'drive'],   // driver's cab
      ['star',      '#FFC93C', [284, 128, 32, 32], [153, 171, 32, 32], 'drive'],   // star on the cab
      ['circle',    '#2a1b3d', [282, 186, 46, 46], [146, 218, 44, 44], 'drive'],   // big wheel
      ['circle',    '#2a1b3d', [390, 196, 36, 36], [238, 228, 34, 34], 'drive'],   // wheel
      ['triangle',  '#3C9A48', [30, 238, 42, 54],  [128, 320, 50, 78]],            // little fir tree
      ['rhombus',   '#F2B705', [448, 146, 24, 34], [234, 298, 28, 38]],            // sign
    ],
    scenery: (
      <>
        <rect x="0" y="226" width="480" height="74" fill="#7CC86A" />
        <rect x="0" y="226" width="480" height="6" fill="#5CAE52" />
        <path d="M0 238 H480" stroke="#8A4F22" strokeWidth="6" />
        <path d="M0 233 H480" stroke="#6B6390" strokeWidth="3" />
        <path d="M10 238 v6 M40 238 v6 M70 238 v6 M100 238 v6 M130 238 v6 M160 238 v6 M190 238 v6 M220 238 v6 M250 238 v6 M280 238 v6 M310 238 v6 M340 238 v6 M370 238 v6 M400 238 v6 M430 238 v6 M460 238 v6" stroke="#8A4F22" strokeWidth="5" />
        {pole('M460 180 V230')}
      </>
    ),
    strings: string('M172 112 Q180 140 168 152'),
    tall: {
      scenery: (
        <>
          <rect x="0" y="258" width="300" height="162" fill="#7CC86A" />
          <rect x="0" y="258" width="300" height="6" fill="#5CAE52" />
          <path d="M0 270 H300" stroke="#8A4F22" strokeWidth="6" />
          <path d="M0 265 H300" stroke="#6B6390" strokeWidth="3" />
          <path d="M10 270 v6 M40 270 v6 M70 270 v6 M100 270 v6 M130 270 v6 M160 270 v6 M190 270 v6 M220 270 v6 M250 270 v6 M280 270 v6" stroke="#8A4F22" strokeWidth="5" />
          {pole('M248 336 V396')}
        </>
      ),
      strings: string('M76 146 Q84 170 72 190'),
      bug: [210, 390],
    },
    bug: [300, 262],
  }),

  // ── a birthday party: cake, presents, balloons ──
  picture({
    sky: '#FFE2C2',
    ownSky: true,
    parts: [
      ['circle',    '#FFFFFF', [24, 26, 50, 50],   [14, 60, 46, 46]],              // the clock
      ['rhombus',   '#E8503F', [157, 18, 26, 34],  [30, 16, 26, 34], 'wave'],      // garland
      ['rhombus',   '#3FA34D', [227, 26, 26, 34],  [137, 26, 26, 34], 'wave'],     // garland
      ['rhombus',   '#3D8BE0', [297, 18, 26, 34],  [244, 16, 26, 34], 'wave'],     // garland
      ['circle',    '#F2B705', [324, 70, 36, 36],  [196, 104, 34, 34], 'loose fly'], // balloon
      ['oval',      '#E8503F', [362, 26, 40, 54],  [214, 46, 38, 52], 'loose fly'],  // balloon
      ['heart',     '#E0509A', [408, 44, 42, 38],  [254, 68, 40, 36], 'loose fly'],  // heart balloon
      ['oval',      '#8E6CF0', [432, 92, 36, 50],  [244, 112, 36, 50], 'loose fly'], // balloon
      ['rectangle', '#A9703F', [42, 228, 12, 64],  [22, 284, 12, 74]],             // table leg: a shape too
      ['rectangle', '#A9703F', [426, 228, 12, 64], [266, 284, 12, 74]],            // table leg
      ['rectangle', '#C98A52', [26, 206, 428, 22], [10, 262, 280, 22]],            // the table
      ['star',      '#FFC93C', [222, 62, 36, 36],  [132, 90, 36, 36]],             // star on the cake
      ['rectangle', '#FFFFFF', [196, 110, 88, 42], [104, 140, 92, 46]],            // cake, top
      ['rectangle', '#E0509A', [174, 150, 132, 58], [80, 184, 140, 80]],           // cake
      ['heart',     '#E8503F', [226, 164, 28, 26], [136, 210, 28, 26]],            // heart on the cake
      ['triangle',  '#8E6CF0', [66, 140, 52, 68],  [20, 196, 52, 68]],             // party hat
      ['triangle',  '#3FA34D', [118, 158, 40, 50], [228, 206, 46, 58]],            // party hat
      ['square',    '#3D8BE0', [326, 148, 60, 60], [170, 340, 60, 60]],            // present
      ['star',      '#FFC93C', [340, 164, 32, 32], [184, 354, 32, 32]],            // star on the present
      ['square',    '#F2B705', [390, 168, 40, 40], [234, 360, 40, 40]],            // present
      ['circle',    '#3FA34D', [236, 258, 34, 34], [72, 360, 34, 34]],             // ball
    ],
    scenery: (
      <>
        <path d="M0 140 H480" stroke="#F5CFA5" strokeWidth="3" />
        <rect x="0" y="258" width="480" height="42" fill="#E0B98A" />
        <rect x="0" y="258" width="480" height="5" fill="#C99B68" />
        <path d="M110 10 Q240 54 370 10" stroke={INK} strokeWidth="2" fill="none" />
        <path d="M240 96 V112" stroke={INK} strokeWidth="3" />
      </>
    ),
    strings: string('M342 106 Q350 128 356 146 M382 80 Q370 120 356 146 M429 82 Q400 120 356 146 M450 142 Q420 150 410 168'),
    // the clock's hands and the bows on the presents
    overlay: (
      <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M49 51 V36 M49 51 H60" />
        <path d="M356 148 q-12 -14 -14 -2 q2 6 14 2 q12 -14 14 -2 q-2 6 -14 2" fill="#E8503F" strokeWidth="2" />
        <path d="M410 168 q-10 -12 -12 -2 q2 5 12 2 q10 -12 12 -2 q-2 5 -12 2" fill="#E8503F" strokeWidth="2" />
      </g>
    ),
    tall: {
      scenery: (
        <>
          <rect x="0" y="320" width="300" height="100" fill="#E0B98A" />
          <rect x="0" y="320" width="300" height="5" fill="#C99B68" />
          <path d="M0 8 Q150 52 300 8" stroke={INK} strokeWidth="2" fill="none" />
          <path d="M150 126 V142" stroke={INK} strokeWidth="3" />
        </>
      ),
      strings: string('M213 138 Q230 200 262 262 M233 98 Q244 180 262 262 M274 104 Q270 180 262 262 M262 162 V262'),
      overlay: (
        <g stroke={INK} strokeWidth="3" strokeLinecap="round" fill="none">
          <path d="M37 83 V70 M37 83 H47" />
          <path d="M200 340 q-12 -14 -14 -2 q2 6 14 2 q12 -14 14 -2 q-2 6 -14 2" fill="#E8503F" strokeWidth="2" />
          <path d="M254 360 q-10 -12 -12 -2 q2 5 12 2 q10 -12 12 -2 q-2 5 -12 2" fill="#E8503F" strokeWidth="2" />
        </g>
      ),
      bug: [126, 388],
    },
    bug: [100, 266],
  }),
]

// The spokes of the big wheel: lines, drawn over it and turning with it
export function Spokes({ cx, cy, r = 60 }) {
  return (
    <g stroke="#C98A52" strokeWidth="4" strokeLinecap="round">
      {[0, 45, 90, 135].map(a => {
        const dx = r * Math.cos(a * Math.PI / 180), dy = r * Math.sin(a * Math.PI / 180)
        return <line key={a} x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} />
      })}
    </g>
  )
}

// ── Which picture comes next ──
// Counted for this session: how often each picture was on screen. A level
// takes the pictures in an order of its own, the ones seen least first, in a
// random order among equals. So no picture comes twice in a level while
// another still waits, each level opens with a different picture in a
// different order, and a child sees every picture before one comes back,
// which then comes in another look (see lookOf in ShapeLandGame.jsx).
const shown = SCENES.map(() => 0)

export function sceneDeck(random = Math.random) {
  const deck = SCENES.map((_, i) => i)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck.sort((a, b) => shown[a] - shown[b])   // a stable sort: the shuffle decides among equals
}

export function sceneShown(id) { shown[id]++ }
export const timesShown = id => shown[id]
