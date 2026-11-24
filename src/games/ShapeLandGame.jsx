import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, artSrc, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts } from '../components/play/index.js'
import { INK } from './px.js'

/**
 * Formen-Land — Formen erkennen, Größen ordnen, Muster fortsetzen,
 * Formen im Alltag finden
 *
 * An owl detective hunts for shapes. Most rounds are a busy picture — a
 * street, a fair — built entirely from shapes: "Finde alle Kreise!" and
 * every circle found gets a face, giggles and spins (the wheels roll, the
 * sun laughs). In between the shapes line up from small to big for a
 * photo, march in a parade the child continues, or a shape is pressed onto
 * a thing like a cookie cutter to show its form.
 *
 * Geometry and seriation had no home in the app at all: the closest thing,
 * "Farbenreich", paints prepared regions and never names a shape. Both are
 * core strands of early maths (NCTM: Geometry, Measurement, Algebraic
 * Thinking) and both feed later arithmetic.
 *
 * Scientific basis:
 *   • Van Hiele level 0 (visual recognition) — naming whole shapes by their
 *     look precedes any talk of sides or corners, so the game asks for
 *     matching and naming, never for properties. Finding them inside a
 *     picture is how children meet shapes in their world.
 *   • Seriation (Piaget) — ordering by size is a concrete-operational
 *     milestone and a known predictor of number-line understanding.
 *   • Repeating patterns (Clements & Sarama) — extending an AB/ABC pattern
 *     is early algebraic thinking.
 */

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Oval and Raute sit next to Kreis and Quadrat on purpose: telling them
// apart is the real step of naming shapes by their look. The names label
// the shapes for screen readers; `eye` is where a face sits in the shape.
const SHAPES = {
  circle:    { name: 'Kreis',    many: 'Kreise',    eye: 46, draw: (c) => <circle cx="50" cy="50" r="42" fill={c} /> },
  square:    { name: 'Quadrat',  many: 'Quadrate',  eye: 46, draw: (c) => <rect x="10" y="10" width="80" height="80" rx="6" fill={c} /> },
  triangle:  { name: 'Dreieck',  many: 'Dreiecke',  eye: 62, draw: (c) => <polygon points="50,8 94,88 6,88" fill={c} /> },
  rectangle: { name: 'Rechteck', many: 'Rechtecke', eye: 46, draw: (c) => <rect x="6" y="26" width="88" height="48" rx="6" fill={c} /> },
  oval:      { name: 'Oval',     many: 'Ovale',     eye: 46, draw: (c) => <ellipse cx="50" cy="50" rx="46" ry="30" fill={c} /> },
  rhombus:   { name: 'Raute',    many: 'Rauten',    eye: 46, draw: (c) => <polygon points="50,4 84,50 50,96 16,50" fill={c} /> },
  star:      { name: 'Stern',    many: 'Sterne',    eye: 52, draw: (c) => <polygon points="50,5 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38" fill={c} /> },
  heart:     { name: 'Herz',     many: 'Herzen',    eye: 42, draw: (c) => <path d="M50 88 C10 58 10 22 32 18 C42 16 50 26 50 32 C50 26 58 16 68 18 C90 22 90 58 50 88Z" fill={c} /> },
}
const SHAPE_IDS = Object.keys(SHAPES)
// Shape colours, all dark enough to stand out on parchment
const COLORS = ['#E8503F', '#F2B705', '#3FA34D', '#3D8BE0', '#8E6CF0', '#E0509A']

// Shapes around us: things whose picture shows the shape plainly, checked
// against the pictures in public/sprites/emoji (outline measured: the
// window 1:1, the door 2:3) — the open book, the cake slice, the gift, the
// waffle (drawn round), the framed picture (not square) and the potato
// (drawn lying at a slant) stay out, their outline is not one shape.
// Names (for screen readers) with their article.
const OBJECTS = {
  circle:    [['🕐', 'die Uhr'], ['🍪', 'der Keks'], ['🌕', 'der Vollmond'], ['🪙', 'die Münze'], ['🎯', 'die Zielscheibe']],
  square:    [['🪟', 'das Fenster']],
  triangle:  [['🍕', 'das Pizzastück'], ['⚠️', 'das Warnschild'], ['🚩', 'die Fahne'], ['⛺', 'das Zelt']],
  rectangle: [['🚪', 'die Tür'], ['📱', 'das Handy'], ['💌', 'der Brief']],
  oval:      [['🥚', 'das Ei'], ['🪞', 'der Spiegel']],
  rhombus:   [['🪁', 'der Drachen']],
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// A face for a shape that was found or that takes part in a game: the
// shapes are little characters here.
function Face({ y = 46, s = 1 }) {
  return (
    <g pointerEvents="none" transform={`translate(50 ${y}) scale(${s}) translate(-50 -46)`}>
      <circle cx="38" cy="42" r="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="62" cy="42" r="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="40" cy="44" r="3.8" fill={INK} />
      <circle cx="64" cy="44" r="3.8" fill={INK} />
      <path d="M40 58 Q50 68 60 58" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  )
}

function Shape({ type, color, size = 72, rotate = 0, face = false }) {
  const s = SHAPES[type]
  if (!s) return null
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={rotate ? `rotate(${rotate} 50 50)` : undefined}>
        <g stroke={INK} strokeWidth="4" strokeLinejoin="round">{s.draw(color)}</g>
        {face && <Face y={s.eye} s={type === 'triangle' || type === 'star' ? 0.8 : 1} />}
      </g>
    </svg>
  )
}

// ── The hidden-shape pictures ────────────────────────────────────────────────
// Each picture is a list of pieces [type, x, y, w, h, colour, tilt?] on a
// 480 × 300 board, drawn in order (later ones on top), plus some scenery that
// is not a shape to look for (strings, poles, the ground). Every shape kind
// appears at least twice; `overlay` is scenery drawn over the pieces. `tilt`
// marks loose things (a kite, a balloon) that may hang at a slant from level
// 2. `tall` lays the same pieces out upright for phones, where the wide
// picture made them too small to tap. A ladybug (`bug`) hides in each
// picture: a little surprise for whoever taps it.
const SCENES = [
  {
    sky: '#BFE6FF',
    pieces: [
      ['circle',    396, 14, 58, 58, '#FFC93C'],               // the sun
      ['star',       26, 18, 42, 42, '#F2B705', 1],            // a star balloon
      ['heart',     140, 24, 44, 40, '#E0509A', 1],            // a heart balloon
      ['oval',      196, 30, 36, 48, '#E8503F', 1],            // a balloon
      ['rhombus',   262, 18, 46, 64, '#8E6CF0', 1],            // the kite
      ['rhombus',   334, 74, 34, 46, '#3FA34D', 1],            // a small kite
      ['rectangle', 108, 70, 20, 40, '#8A4F22'],               // chimney
      ['triangle',   28, 74, 124, 62, '#E8503F'],              // roof
      ['circle',     76, 96, 28, 28, '#BFE6FF'],               // round window
      ['square',     43, 136, 94, 94, '#F2B705'],              // wall
      ['square',     52, 150, 34, 34, '#BFE6FF'],              // window
      ['rectangle',  96, 168, 34, 62, '#8A4F22'],              // door
      ['heart',     100, 180, 26, 24, '#E0509A'],              // heart on the door
      ['triangle',  158, 112, 66, 92, '#3FA34D'],              // fir tree
      ['star',      172, 90, 38, 38, '#FFC93C', 1],            // star on top
      ['rectangle', 182, 204, 18, 28, '#8A4F22'],              // trunk
      ['oval',      218, 200, 64, 34, '#3FA34D'],              // bush
      ['square',    324, 144, 40, 40, '#BFE6FF'],              // car cabin
      ['rectangle', 290, 180, 116, 38, '#3D8BE0'],             // car
      ['circle',    300, 202, 34, 34, '#2a1b3d'],              // wheel
      ['circle',    364, 202, 34, 34, '#2a1b3d'],              // wheel
      ['triangle',  420, 132, 50, 44, '#FFC93C'],              // warning sign
      ['circle',    250, 248, 32, 32, '#E8503F'],              // ball
      ['square',    140, 246, 38, 38, '#8E6CF0', 1],           // gift
      ['oval',      414, 254, 44, 28, '#9A8FB0'],              // a stone
    ],
    scenery: (
      <>
        <rect x="0" y="230" width="480" height="70" fill="#7CC86A" />
        <rect x="0" y="230" width="480" height="8" fill="#5CAE52" />
        <path d="M47 60 Q60 120 70 200 M162 64 Q170 120 160 200 M214 78 Q220 140 236 200 M285 82 Q300 120 290 150" stroke={INK} strokeWidth="1.5" fill="none" opacity="0.6" />
        <rect x="442" y="170" width="6" height="62" fill="#9A8FB0" stroke={INK} strokeWidth="1.5" />
      </>
    ),

    // the same pieces, in the same order, on an upright 300 × 420 board for phones
    tall: {
      boxes: [[226, 8, 60, 60], [12, 14, 46, 46], [70, 40, 46, 42], [124, 20, 40, 54], [176, 84, 48, 66], [240, 96, 40, 54],
        [98, 148, 26, 42], [14, 160, 136, 66], [64, 180, 34, 34], [30, 226, 104, 104], [42, 242, 40, 40], [90, 268, 38, 62],
        [92, 280, 32, 30], [178, 176, 76, 104], [198, 148, 38, 38], [206, 280, 22, 50], [150, 300, 64, 34], [196, 316, 40, 40],
        [156, 352, 128, 40], [166, 378, 34, 34], [240, 378, 34, 34], [240, 236, 54, 48], [14, 362, 38, 38], [62, 356, 42, 42], [108, 392, 42, 24]],
      scenery: (
        <>
          <rect x="0" y="330" width="300" height="90" fill="#7CC86A" />
          <rect x="0" y="330" width="300" height="8" fill="#5CAE52" />
          <path d="M35 60 Q28 110 34 160 M93 82 Q100 120 96 160 M144 74 Q140 120 150 170 M200 150 Q190 165 198 178 M260 150 Q252 165 262 178" stroke={INK} strokeWidth="1.5" fill="none" opacity="0.6" />
          <rect x="264" y="284" width="6" height="48" fill="#9A8FB0" stroke={INK} strokeWidth="1.5" />
        </>
      ),
      bug: [262, 300],
    },
    bug: [446, 212],
    // when all are found: the balloons and kites fly off, the car drives away
    go: { fly: [1, 2, 3, 4, 5], drive: [17, 18, 19, 20] },
  },
  {
    sky: '#FFE2C2',
    pieces: [
      ['star',       18, 16, 36, 36, '#F2B705', 1],
      ['star',       84, 30, 34, 34, '#E8503F', 1],
      ['rhombus',   150, 14, 40, 58, '#3D8BE0', 1],            // kite
      ['rhombus',   118, 76, 30, 42, '#E0509A', 1],            // small kite
      ['triangle',  326, 124, 102, 106, '#8A4F22'],            // stand of the wheel
      ['circle',    300, 24, 154, 154, '#FFE08A'],             // ferris wheel
      ['square',    362, 14, 30, 30, '#E8503F'],               // cabin
      ['square',    362, 158, 30, 30, '#3FA34D'],              // cabin
      ['triangle',   78, 96, 26, 24, '#3D8BE0', 1],            // flag on the tent
      ['triangle',   26, 118, 130, 112, '#E8503F'],            // tent
      ['rectangle',  74, 176, 34, 54, '#2a1b3d'],              // tent door
      ['oval',      170, 120, 74, 30, '#8E6CF0'],              // sign
      ['rectangle', 172, 150, 70, 80, '#3FA34D'],              // booth
      ['square',    190, 162, 34, 34, '#BFE6FF'],              // booth window
      ['heart',     194, 200, 28, 26, '#E0509A'],              // heart on the booth
      ['oval',      262, 58, 32, 44, '#3D8BE0', 1],            // balloon
      ['heart',     226, 48, 36, 32, '#E0509A', 1],            // heart balloon
      ['circle',    272, 108, 32, 32, '#F2B705', 1],           // balloon
      ['circle',    258, 196, 34, 34, '#E0509A'],              // lollipop
      ['rectangle',  14, 248, 80, 20, '#8A4F22'],              // bench
      ['square',    116, 244, 40, 40, '#F2B705', 1],           // crate
      ['oval',      414, 216, 60, 30, '#3FA34D'],              // bush
    ],
    scenery: (
      <>
        <rect x="0" y="230" width="480" height="70" fill="#E8C27A" />
        <rect x="0" y="230" width="480" height="8" fill="#D4A95E" />
        <path d="M278 102 Q270 160 275 196 M248 80 Q256 150 275 196 M288 140 Q282 170 275 196" stroke={INK} strokeWidth="1.5" fill="none" opacity="0.6" />
        <rect x="273" y="226" width="5" height="34" fill="#fff" stroke={INK} strokeWidth="1" />
        <line x1="90" y1="96" x2="90" y2="122" stroke={INK} strokeWidth="2" />
      </>
    ),
    // the wheel's spokes, over the wheel
    overlay: <Spokes cx={377} cy={101} />,
    tall: {
      boxes: [[12, 12, 40, 40], [62, 56, 36, 36], [14, 98, 40, 58], [70, 112, 32, 44], [160, 120, 100, 110], [130, 20, 160, 160],
        [193, 4, 34, 34], [193, 162, 34, 34], [55, 206, 32, 28], [10, 232, 120, 110], [54, 292, 34, 50], [150, 246, 76, 30],
        [152, 276, 72, 70], [171, 282, 32, 32], [174, 316, 30, 28], [252, 236, 34, 44], [258, 290, 34, 30], [110, 160, 32, 32],
        [240, 356, 32, 32], [14, 384, 84, 20], [110, 370, 40, 40], [176, 382, 56, 30]],
      scenery: (
        <>
          <rect x="0" y="346" width="300" height="74" fill="#E8C27A" />
          <rect x="0" y="346" width="300" height="8" fill="#D4A95E" />
          <path d="M269 280 Q266 320 276 346 M275 320 Q280 334 276 346 M126 192 Q120 214 118 236" stroke={INK} strokeWidth="1.5" fill="none" opacity="0.6" />
          <rect x="254" y="386" width="5" height="30" fill="#fff" stroke={INK} strokeWidth="1" />
          <line x1="70" y1="210" x2="70" y2="236" stroke={INK} strokeWidth="2" />
        </>
      ),
      overlay: <Spokes cx={210} cy={100} />,
      bug: [262, 196],
    },
    bug: [30, 222],
    go: { fly: [2, 3, 15, 16, 17], drive: [] },
  },
  {
    sky: '#BFE6FF',
    pieces: [
      ['circle',    404, 14, 56, 56, '#FFC93C'],               // the sun
      ['oval',       24, 22, 72, 30, '#FFFFFF'],               // cloud
      ['oval',      300, 44, 60, 24, '#FFFFFF'],               // cloud
      ['rectangle', 226, 36, 12, 140, '#8A4F22'],              // mast
      ['rhombus',   238, 12, 24, 32, '#E0509A', 1],            // pennant
      ['triangle',  124, 52, 98, 118, '#E8503F'],              // big sail
      ['triangle',  242, 72, 72, 98, '#F2B705'],               // small sail
      ['star',      157, 112, 32, 32, '#FFC93C'],              // star on the sail
      ['square',    322, 140, 30, 30, '#8E6CF0'],              // crate on deck
      ['rectangle',  96, 170, 270, 44, '#8A4F22'],             // hull
      ['circle',    120, 180, 24, 24, '#BFE6FF'],              // porthole
      ['circle',    170, 180, 24, 24, '#BFE6FF'],              // porthole
      ['circle',    220, 180, 24, 24, '#BFE6FF'],              // porthole
      ['heart',     300, 180, 28, 26, '#E0509A'],              // heart on the hull
      ['rectangle', 424, 118, 12, 90, '#8A4F22'],              // palm trunk
      ['oval',      396, 100, 70, 28, '#3FA34D'],              // palm leaves
      ['oval',      380, 196, 96, 36, '#E8C27A'],              // island
      ['rhombus',    40, 180, 30, 44, '#E8503F', 1],           // buoy
      ['oval',       36, 246, 48, 24, '#F2B705'],              // fish
      ['triangle',  262, 232, 36, 30, '#9A8FB0'],              // a fin
      ['star',      190, 250, 36, 36, '#E0509A'],              // starfish
      ['heart',     120, 262, 28, 26, '#F2B705'],              // shell
      ['oval',      330, 258, 44, 22, '#8E6CF0'],              // fish
      ['square',    420, 250, 32, 32, '#3FA34D', 1],           // floating crate
    ],
    scenery: (
      <>
        <rect x="0" y="200" width="480" height="100" fill="#5BB4E8" />
        <path d="M0 204 Q20 196 40 204 T80 204 T120 204 T160 204 T200 204 T240 204 T280 204 T320 204 T360 204 T400 204 T440 204 T480 204" stroke="#fff" strokeWidth="3" fill="none" opacity="0.7" />
        <path d="M30 236 q10 -6 20 0 M150 232 q10 -6 20 0 M380 240 q10 -6 20 0 M260 280 q10 -6 20 0 M80 290 q10 -6 20 0" stroke="#fff" strokeWidth="2" fill="none" opacity="0.7" />
      </>
    ),
    tall: {
      boxes: [[236, 8, 54, 54], [14, 20, 70, 28], [150, 40, 56, 22], [108, 70, 12, 166], [120, 44, 24, 32], [20, 90, 86, 140],
        [124, 110, 62, 120], [47, 170, 32, 32], [188, 206, 26, 30], [14, 236, 200, 50], [30, 248, 26, 26], [80, 248, 26, 26],
        [130, 248, 26, 26], [176, 248, 28, 26], [254, 190, 12, 110], [226, 172, 68, 28], [210, 290, 88, 36], [16, 300, 28, 42],
        [60, 340, 48, 24], [150, 306, 36, 30], [120, 370, 38, 38], [200, 378, 30, 28], [240, 344, 44, 22], [250, 386, 30, 30]],
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
    // when all are found: the ship sails off
    go: { fly: [], drive: [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  },
]

// The same picture never twice in a level: each of the pictures also comes
// mirrored, at sunset, at night (the windows lit) and in other colours. Only
// the look changes: the same shapes, the same number of each kind.
const LOOKS = [
  { mirror: false, sky: null,      shift: 0 },
  { mirror: true,  sky: '#FFC9A3', shift: 2 },
  { mirror: false, sky: '#33407A', shift: 4, night: true },
  { mirror: true,  sky: '#D3F0C4', shift: 1 },
]
const NIGHT_STARS = [[30, 20], [90, 50], [150, 16], [210, 60], [270, 26], [330, 52], [380, 14], [440, 40], [60, 80], [250, 90]]

function lookOf(scene, k) {
  const look = LOOKS[k % LOOKS.length]
  if (!k) return scene
  const recolour = c => {
    const i = COLORS.indexOf(c)
    if (i >= 0) return COLORS[(i + look.shift) % COLORS.length]
    if (look.night && c === '#BFE6FF') return '#FFE58A'        // lit windows
    if (look.night && c === '#2a1b3d') return '#6B6390'        // dark wheels, still seen
    return c
  }
  const flip = (W, x, w) => (look.mirror ? W - x - w : x)
  const mirrored = (W, node) => (look.mirror && node ? <g transform={`translate(${W} 0) scale(-1 1)`}>{node}</g> : node)
  const stars = W => look.night && NIGHT_STARS.map(([x, y], i) => <circle key={i} cx={x * W / 480} cy={y} r={i % 3 ? 2 : 3} fill="#FFF3B0" />)
  return {
    ...scene,
    sky: look.sky ?? scene.sky,
    pieces: scene.pieces.map(([type, x, y, w, h, color, loose]) => [type, flip(480, x, w), y, w, h, recolour(color), loose]),
    scenery: <>{stars(480)}{mirrored(480, scene.scenery)}</>,
    overlay: mirrored(480, scene.overlay),
    bug: [flip(480, scene.bug[0], 26), scene.bug[1]],
    tall: {
      ...scene.tall,
      boxes: scene.tall.boxes.map(([x, y, w, h]) => [flip(300, x, w), y, w, h]),
      scenery: <>{stars(300)}{mirrored(300, scene.tall.scenery)}</>,
      overlay: mirrored(300, scene.tall.overlay),
      bug: [flip(300, scene.tall.bug[0], 26), scene.tall.bug[1]],
    },
  }
}

function Spokes({ cx, cy }) {
  return (
    <g stroke="#C98A52" strokeWidth="4" strokeLinecap="round">
      {[0, 45, 90, 135].map(a => {
        const dx = 60 * Math.cos(a * Math.PI / 180), dy = 60 * Math.sin(a * Math.PI / 180)
        return <line key={a} x1={cx - dx} y1={cy - dy} x2={cx + dx} y2={cy + dy} />
      })}
      <circle cx={cx} cy={cy} r="9" fill="#8A4F22" stroke={INK} strokeWidth="2.5" />
    </g>
  )
}

// One shape of a picture, drawn into its box
function boxShape(type, x, y, w, h) {
  switch (type) {
    case 'circle':   return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
    case 'oval':     return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
    case 'triangle': return <polygon points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} />
    case 'rhombus':  return <polygon points={`${x + w / 2},${y} ${x + w},${y + h / 2} ${x + w / 2},${y + h} ${x},${y + h / 2}`} />
    case 'star':
    case 'heart':    return <g transform={`translate(${x} ${y}) scale(${w / 100} ${h / 100})`}>{SHAPES[type].draw()}</g>
    default:         return <rect x={x} y={y} width={w} height={h} rx={3} />
  }
}

// L1-2 recognise · L3 + a first AB pattern · L4 + order by size ·
// L5-6 + shapes around us · L7-10 all four
function modeFor(level, idx) {
  if (level <= 2) return 'match'
  if (level === 3) return idx % 3 === 2 ? 'pattern' : 'match'
  if (level === 4) return idx % 2 === 0 ? 'match' : 'size'
  if (level <= 6) return ['match', 'object', 'size'][idx % 3]
  return ['match', 'object', 'pattern', 'size'][idx % 4]
}

function poolFor(level) {
  return level <= 2 ? SHAPE_IDS.slice(0, 3)     // Kreis, Quadrat, Dreieck
       : level === 3 ? SHAPE_IDS.slice(0, 4)    // + Rechteck
       : level <= 5 ? SHAPE_IDS.slice(0, 6)     // + Oval, Raute
       : SHAPE_IDS
}

// From level 2 the shapes stand at a slant now and then: a tilted triangle
// is still a triangle. Square and Raute are only turned a little, so the
// one never turns into the other.
function tiltFor(level, type) {
  if (level < 2 || Math.random() < 0.4) return 0
  if (type === 'square' || type === 'rhombus') return [-15, 15][rand(0, 1)]
  if (type === 'circle') return 0
  return [-30, -15, 15, 30, 180][rand(0, 4)]
}

// used: the shapes already asked for in this level (both the picture rounds
// and "shapes around us"), so the circle doesn't win by having more things
function buildRound(level, idx, used) {
  const mode = modeFor(level, idx)
  const pool = poolFor(level)

  if (mode === 'object') {
    const types  = pool.filter(t => OBJECTS[t])
    const fresh  = types.filter(t => !used.object.has(t))
    const type   = shuffle(fresh.length ? fresh : types)[0]
    const [emoji, name] = shuffle(OBJECTS[type])[0]
    const thing  = { type, emoji, name }
    used.object.add(type)
    // A square is a rectangle too, so the window never meets the rectangle
    const others = pool.filter(t => t !== thing.type && t !== 'star' && t !== 'heart'
      && !(thing.type === 'square' && t === 'rectangle'))
    return {
      mode, thing, answer: thing.type,
      options: shuffle([thing.type, ...shuffle(others).slice(0, 2)]),
      color: COLORS[rand(0, COLORS.length - 1)],
    }
  }

  if (mode === 'match') {
    const fresh  = pool.filter(t => !used.match.has(t))
    const answer = shuffle(fresh.length ? fresh : pool)[0]
    used.match.add(answer)
    const n      = used.scene++
    const scene  = lookOf(SCENES[n % SCENES.length], Math.floor(n / SCENES.length))
    // the pieces of the picture, each with its turn for this round
    const pieces = scene.pieces.map(([type, x, y, w, h, color, loose], id) => ({
      id, type, x, y, w, h, color, rot: loose ? tiltFor(level, type) : 0,
    }))
    return { mode, answer, scene, pieces, need: pieces.filter(p => p.type === answer).length }
  }

  if (mode === 'size') {
    const count = level <= 5 ? 3 : level <= 8 ? 4 : 5
    const type  = pool[rand(0, pool.length - 1)]
    const color = COLORS[rand(0, COLORS.length - 1)]
    // From level 6 the order is sometimes the other way round
    const down  = level >= 6 && Math.random() < 0.5
    // Sizes far enough apart that the order is decidable at a glance;
    // scale is the share of the card's full size
    const sizes = Array.from({ length: count }, (_, i) => 0.4 + i * (0.6 / (count - 1)))
    return { mode, type, color, down, items: shuffle(sizes.map((s, i) => ({ id: i, size: s }))), sizes }
  }

  // pattern: AB, ABC or AAB, continued by one element. The row's length
  // varies: with a fixed six the next element was always the row's first.
  const kinds = level <= 3 ? [['A','B']] : level <= 8 ? [['A','B'], ['A','B','C']] : [['A','B'], ['A','B','C'], ['A','A','B']]
  const unit  = kinds[rand(0, kinds.length - 1)]
  const picks = shuffle(pool).slice(0, 3)
  const cols  = shuffle(COLORS).slice(0, 3)
  const map   = { A: 0, B: 1, C: 2 }
  const len   = unit.length * 2 + rand(0, unit.length - 1)
  const seq   = []
  for (let i = 0; i < len; i++) {
    const k = unit[i % unit.length]
    seq.push({ type: picks[map[k]], color: cols[map[k]] })
  }
  const nextKey = unit[len % unit.length]
  const correct = { type: picks[map[nextKey]], color: cols[map[nextKey]] }
  const wrongs  = picks
    .map((p, i) => ({ type: p, color: cols[i] }))
    .filter(o => o.type !== correct.type)
  return {
    mode, seq, correct,
    options: shuffle([correct, ...wrongs].slice(0, 3)).map((o, i) => ({ ...o, id: i })),
  }
}

// The task in words, for screen readers on the owl's bubble
const taskFor = (r) =>
  r.mode === 'match' ? `Finde alle ${SHAPES[r.answer].many}!`
  : r.mode === 'object' ? `Welche Form hat ${r.thing.name}?`
  : r.mode === 'size' ? (r.down ? 'Von groß nach klein!' : 'Von klein nach groß!')
  : 'Wer kommt als Nächstes?'

// Upright phones get the upright pictures
function useTall() {
  const get = () => typeof window !== 'undefined' && window.innerWidth < 560 && window.innerHeight > window.innerWidth
  const [tall, setTall] = useState(get)
  useEffect(() => {
    const on = () => setTall(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return tall
}

export default function ShapeLandGame({ level = 1, onComplete }) {
  const TOTAL = 8
  const rounds = useState(() => {
    const used = { object: new Set(), match: new Set(), scene: rand(0, SCENES.length - 1) }
    return Array.from({ length: TOTAL }, (_, i) => buildRound(level, i, used))
  })[0]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const tall = useTall()

  const [idx,      setIdx]      = useState(0)
  const [picked,   setPicked]   = useState([])       // size: tap order · match: pieces found
  const [wrong,    setWrong]    = useState([])
  const [shake,    setShake]    = useState(null)     // { key, n } — the piece that wobbles
  const [look,     setLook]     = useState(0)        // after a miss: look at the task again
  const [solved,   setSolved]   = useState(false)
  const [streak,   setStreak]   = useState(0)        // rounds right on the first try in a row
  const [ending,   setEnding]   = useState(false)
  const [owl,      setOwl]      = useMood()
  const [bursts, burst] = useBursts()
  const missed = useRef(new Set())                   // rounds with a miss
  const timers = useRef([])
  const hint   = { from: useRef(null), to: useRef(null) }
  const owlRef = useRef(null)

  const r = rounds[idx]

  const later = useCallback((fn, ms) => {
    const run = () => { if (pausedRef.current) timers.current.push(setTimeout(run, 250)); else fn() }
    timers.current.push(setTimeout(run, ms))
  }, [])

  // A layout effect: the new round is never painted with the last one's state
  useLayoutEffect(() => {
    if (!r) return
    timers.current.forEach(clearTimeout); timers.current = []
    setPicked([]); setWrong([]); setSolved(false); setShake(null); setLook(0)
    setOwl('idle')
    lockPreviews()
    sayTask()
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The end of the level, here first: the owl dances with its cup
  const next = useCallback(() => {
    // the new picture mounts as it is (initial={false}): it must never see
    // the last round's "solved" (it would start flying off) or its finds
    if (idx + 1 < TOTAL) { setSolved(false); setPicked([]); setWrong([]); setShake(null); setIdx(i => i + 1); return }
    setEnding(true)
    setOwl('dance', 0)
    sfx.tada()
    burst({ x: innerWidth / 2, y: innerHeight * 0.4 }, 'confetti', 24)
    later(() => {
      sfx.complete()
      afterNarration(() => onComplete(result(TOTAL - missed.current.size, TOTAL)), { minMs: 400 })
    }, 2200)
  }, [idx, onComplete, burst, later, setOwl])

  // Praise and a dance; the next round comes once the payoff was seen.
  // A streak of rounds without a miss gets confetti.
  const finish = useCallback((minMs = 1800) => {
    setSolved(true)
    const s = missed.current.has(idx) ? 0 : streak + 1
    setStreak(s)
    setOwl('dance', 2400)
    sfx.correct()
    burst(owlRef.current, 'hearts', 8)
    if (s >= 3) burst({ x: innerWidth / 2, y: innerHeight * 0.35 }, 'confetti', 10 + 2 * s)
    sayRight()
    afterNarration(() => later(next, 0), { minMs })
  }, [idx, streak, next, burst, later, setOwl])

  const miss = useCallback((key) => {
    setWrong(w => w.includes(key) ? w : [...w, key])
    setShake({ key, n: Date.now() })
    setLook(Date.now())
    missed.current.add(idx)
    setOwl('oops')
    sfx.boing()
    sayWrong()
  }, [idx, setOwl])

  // ── the picture: find them all ──
  // p: the piece the tap resolved to (see Picture), at: where on screen
  const tapPiece = useCallback((p, at) => {
    if (!r) return
    // solved: for a moment the picture is a toy. Tapped shapes hop, found
    // ones laugh and circles roll. Nothing here counts.
    if (solved) {
      if (ending || r.scene.go.fly.includes(p.id) || r.scene.go.drive.includes(p.id)) return
      setShake({ key: p.id, n: Date.now(), play: true })
      if (picked.includes(p.id)) { sfx.giggle(); burst(at, 'stars', 4) } else sfx.pop()
      return
    }
    if (picked.includes(p.id)) { sfx.giggle(); setShake({ key: p.id, n: Date.now() }); return }
    if (p.type === r.answer) {
      const found = [...picked, p.id]
      setPicked(found)
      sfx.sparkle()
      burst(at, 'stars', 6)
      if (found.length === r.need) finish(3800)
      else setOwl('wow', 700)
      return
    }
    // A shape the level does not teach yet only wobbles
    if (!poolFor(level).includes(p.type)) { sfx.boing(); setShake({ key: p.id, n: Date.now() }); return }
    miss(p.id)
  }, [solved, ending, r, picked, level, burst, finish, miss, setOwl])

  // ── shapes around us: press the right shape onto the thing ──
  const dropOnThing = useCallback((type) => {
    if (solved || !r) return false
    if (type !== r.answer) { miss(type); return false }
    sfx.tada()
    finish()
    return true
  }, [solved, r, miss, finish])

  // ── the photo: small to big ──
  const pickSize = useCallback((item) => {
    if (solved || !r || picked.includes(item.id)) return
    const order = [...r.sizes].sort((a, b) => (r.down ? b - a : a - b))
    if (item.size !== order[picked.length]) { miss(`s${item.id}`); return }
    const nextPicked = [...picked, item.id]
    setPicked(nextPicked)
    sfx.slideUp()
    if (nextPicked.length === r.items.length) {
      later(() => { sfx.sparkle(); setShake({ key: 'flash', n: Date.now() }) }, 500)
      finish(2200)
    }
  }, [solved, r, picked, miss, finish, later])

  // ── the parade: who comes next? ──
  const dropInParade = useCallback((opt) => {
    if (solved || !r) return false
    if (opt.type !== r.correct.type) { miss(`p${opt.id}`); return false }
    setPicked([opt.id])
    r.seq.forEach((_, i) => later(() => sfx.drum(i % 2 === 0), 120 * i))
    finish(1200 + 120 * r.seq.length)
    return true
  }, [solved, r, miss, finish, later])

  if (!r) return null

  // What the owl holds up: the shape to find, the thing, the camera, the drum
  const owlWish = r.mode === 'match'
    ? <motion.div key={look} animate={look ? { scale: [1, 1.35, 1, 1.35, 1] } : {}} transition={{ duration: 1.1 }} style={{ width: 46, height: 46 }}><Shape type={r.answer} color="#FFC93C" size="100%" face /></motion.div>
    : r.mode === 'object' ? <Art art={r.thing.emoji} size={44} />
    : r.mode === 'size' ? <Art art="📷" size={44} />
    : <Art art="🥁" size={44} />

  const active = !solved && !ending
  const delay = idx === 0 ? 2000 : 6000
  const hintHand = r.mode === 'object' || r.mode === 'pattern'
    ? <HintHand from={hint.from} to={hint.to} delay={delay} active={active} />
    : <HintHand to={hint.to} delay={delay} active={active} />

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,2vw,22px) clamp(8px,3vw,28px)', gap: 'clamp(8px,1.6vw,16px)',
    }}>
      {bursts}
      {hintHand}
      <RoundTrail total={TOTAL} done={idx + (solved ? 1 : 0)} walker="🦉" goal="🏆" style={{ width: 'calc(100% - 60px)', maxWidth: 700 }} />

      {/* The owl detective and what it is looking for */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 760, minHeight: tall ? 80 : 96 }}>
        <motion.div ref={owlRef} animate={solved && !reduceMotion() ? { scale: [1, 1.35, 1.1, 1.3, 1], y: [0, -24, 0, -14, 0] } : { scale: 1, y: 0 }} transition={{ duration: 1.2 }}>
        <Critter art="🦉" size={tall ? 74 : 88} mood={owl} label="Eule"
          accessory={<span style={{ position: 'absolute', right: -6, bottom: 2, pointerEvents: 'none' }}><Art art={ending ? '🏆' : '🔍'} size={tall ? 32 : 38} /></span>}
          onTap={() => { sfx.giggle(); setOwl('wow', 700) }} />
        </motion.div>
        <div aria-label={taskFor(r)} style={{
          position: 'relative', background: '#FFFDF7', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
          padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <span aria-hidden="true" style={{ position: 'absolute', left: -14, top: '50%', marginTop: -10, borderStyle: 'solid', borderWidth: '10px 14px 10px 0', borderColor: `transparent ${INK} transparent transparent` }} />
          {owlWish}
          {r.mode === 'match' && (
            // one slot per shape to find, filled as they are found
            <div aria-label={`${picked.length} von ${r.need}`} style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: r.need }, (_, i) => (
                <motion.div key={i} animate={{ scale: i === picked.length - 1 ? [1, 1.4, 1] : 1 }}
                  style={{ width: 30, height: 30, opacity: i < picked.length ? 1 : 0.35 }}>
                  <Shape type={r.answer} color={i < picked.length ? '#FFC93C' : '#fff'} size="100%" />
                </motion.div>
              ))}
            </div>
          )}
          {r.mode === 'size' && (
            // the direction: small to big, or big to small
            <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
              {(r.down ? [30, 22, 14] : [14, 22, 30]).map((d, i) => (
                <div key={i} style={{ width: d, height: d }}><Shape type={r.type} color={r.color} size="100%" /></div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(12px,3dvh,26px)' }}>
        {r.mode === 'match' && (
          <div ref={hint.to} style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
            {/* a fresh picture each round: nothing carries over from the last
                one, which had just flown and driven away */}
            <Picture key={idx} r={r} tall={tall} found={picked} shake={shake} solved={solved} onTap={tapPiece} />
          </div>
        )}

        {r.mode === 'object' && (
          <DragArea autoTarget="thing" disabled={solved}>
            <DropZone id="thing" onDrop={dropOnThing} label={r.thing.name} slop={40}>
              {hover => (
                <motion.div ref={hint.to} key={look} animate={solved ? { y: [0, -30, 0], rotate: [0, -8, 8, 0] } : look ? { rotate: [0, -6, 6, -4, 0] } : { scale: hover ? 1.08 : 1 }}
                  transition={{ duration: solved ? 0.8 : 0.5 }}
                  style={{
                    position: 'relative', width: 'min(34vw, 230px)', height: 'min(34vw, 230px)', minWidth: 160, minHeight: 160,
                    borderRadius: 28, background: 'rgba(255,253,247,0.85)', border: `4px dashed ${hover ? '#FFC93C' : INK}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Art art={r.thing.emoji} size={150} />
                  {solved && (
                    <motion.div initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 0.55 }}
                      style={{ position: 'absolute', inset: 22 }}>
                      <Shape type={r.answer} color={r.color} size="100%" />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </DropZone>
            <div ref={hint.from} style={{ display: 'flex', gap: 'clamp(14px,4vw,32px)', justifyContent: 'center' }}>
              {r.options.map(type => {
                const isWrong = wrong.includes(type)
                const gone = solved && type === r.answer
                return (
                  <Draggable key={type} id={type} data={type} label={SHAPES[type].name} disabled={isWrong || solved}
                    style={{ visibility: gone ? 'hidden' : 'visible', opacity: isWrong ? 0.4 : 1 }}>
                    <ShakeBox on={shake?.key === type} k={shake?.n}>
                      <div style={{ width: 'min(24vw, 120px)', height: 'min(24vw, 120px)', minWidth: 80, minHeight: 80 }}>
                        <Shape type={type} color={r.color} size="100%" face />
                      </div>
                    </ShakeBox>
                  </Draggable>
                )
              })}
            </div>
          </DragArea>
        )}

        {r.mode === 'size' && <Photo r={r} picked={picked} shake={shake} solved={solved} look={look} onPick={pickSize} rowRef={hint.to} />}

        {r.mode === 'pattern' && (
          <DragArea autoTarget="gap" disabled={solved}>
            <Parade r={r} solved={solved} look={look} onDrop={dropInParade} gapRef={hint.to} />
            <div ref={hint.from} style={{ display: 'flex', gap: 'clamp(14px,4vw,32px)', justifyContent: 'center' }}>
              {r.options.map(opt => {
                const isWrong = wrong.includes(`p${opt.id}`)
                const gone = picked.includes(opt.id)
                return (
                  <Draggable key={opt.id} id={opt.id} data={opt} label={SHAPES[opt.type].name} disabled={isWrong || solved}
                    style={{ visibility: gone ? 'hidden' : 'visible', opacity: isWrong ? 0.4 : 1 }}>
                    <ShakeBox on={shake?.key === `p${opt.id}`} k={shake?.n}>
                      <div style={{ width: 'min(22vw, 104px)', height: 'min(22vw, 104px)', minWidth: 76, minHeight: 76 }}>
                        <Shape type={opt.type} color={opt.color} size="100%" face />
                      </div>
                    </ShakeBox>
                  </Draggable>
                )
              })}
            </div>
          </DragArea>
        )}
      </div>
    </div>
  )
}

// A wobble, for a shape that was not the one
function ShakeBox({ on, k, children }) {
  return (
    <motion.div key={on ? k : 'still'} animate={on && !reduceMotion() ? { rotate: [0, -14, 12, -8, 6, 0], scale: [1, 1.1, 1] } : {}} transition={{ duration: 0.6 }}>
      {children}
    </motion.div>
  )
}

// Is the point (px, py) on a piece, `pad` units around its edge included?
// The piece may hang at a slant (`rot`, about its middle).
function onPiece({ type, rot }, [x, y, w, h], px, py, pad = 0) {
  const cx = x + w / 2, cy = y + h / 2
  const a = -(rot || 0) * Math.PI / 180
  const dx = (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a)
  const dy = (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a)
  const rx = w / 2 + pad, ry = h / 2 + pad
  switch (type) {
    case 'circle':
    case 'oval':     return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1
    case 'rhombus':  return Math.abs(dx) / rx + Math.abs(dy) / ry <= 1
    case 'triangle': return Math.abs(dy) <= ry && Math.abs(dx) <= (w / 2) * ((dy + h / 2) / h) + pad * 1.4
    case 'star':     return Math.hypot(dx / w, dy / h) <= 0.44 + pad / Math.min(w, h)
    case 'heart':    return (dx / (w * 0.46 + pad)) ** 2 + ((dy + h * 0.04) / (h * 0.44 + pad)) ** 2 <= 1
    default:         return Math.abs(dx) <= rx && Math.abs(dy) <= ry
  }
}

// ── The hidden-shape picture ──
// Found shapes get a face, glow and dance: circles roll round, the others
// hop. When all are found the picture takes off: balloons and kites fly
// away, the car drives off. On an upright phone the pieces stand in the
// upright layout of the same picture.
//
// A tap is resolved here, not by the shape that happens to lie on top:
// the roof's middle has the round window on it, the wall has the door.
// If any shape of the kind being sought is under the finger (a little
// around small ones too), the tap is for it. Only a tap right on a shape
// of another kind, with none of the sought kind there, is a miss.
function Picture({ r, tall, found, shake, solved, onTap }) {
  const [bugGone, setBugGone] = useState(false)
  useEffect(() => setBugGone(false), [r])
  const svgRef = useRef(null)
  const W = tall ? 300 : 480, H = tall ? 420 : 300
  const bug = tall ? r.scene.tall.bug : r.scene.bug
  const boxOf = p => (tall ? r.scene.tall.boxes[p.id] : [p.x, p.y, p.w, p.h])
  const flyAway = e => { e.stopPropagation(); if (bugGone) return; sfx.giggle(); sfx.whoosh(); setBugGone(true) }
  const tap = e => {
    const m = svgRef.current?.getScreenCTM()?.inverse()
    if (!m) return
    const px = m.a * e.clientX + m.c * e.clientY + m.e, py = m.b * e.clientX + m.d * e.clientY + m.f
    const at = { x: e.clientX, y: e.clientY }
    const top = list => list[list.length - 1]
    // around small pieces the finger may land a little off: up to 20 units
    const near = p => { const [, , w, h] = boxOf(p); return Math.max(tall ? 8 : 6, (40 - Math.min(w, h)) / 2) }
    const sought = r.pieces.filter(p => p.type === r.answer && onPiece(p, boxOf(p), px, py, near(p)))
    const fresh = sought.filter(p => !found.includes(p.id))
    const hit = fresh.length ? top(fresh) : sought.length ? top(sought) : top(r.pieces.filter(p => onPiece(p, boxOf(p), px, py)))
    if (hit) onTap(hit, at)
  }
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Suchbild" onClick={tap}
      style={{
        width: '100%', maxWidth: tall ? `min(100%, calc((100dvh - 240px) * ${W / H}))` : `min(100%, calc((100dvh - 250px) * ${W / H}), 920px)`,
        height: 'auto', display: 'block', borderRadius: 22, border: `4px solid ${INK}`, boxShadow: '0 6px 0 rgba(42,27,61,0.3)',
        background: r.scene.sky, touchAction: 'manipulation', overflow: 'hidden', cursor: solved ? 'default' : 'pointer',
      }}>
      <g pointerEvents="none">{tall ? r.scene.tall.scenery : r.scene.scenery}</g>
      {r.pieces.map(p => {
        const [x, y, w, h] = boxOf(p)
        const isFound = found.includes(p.id)
        const cx = x + w / 2, cy = y + h / 2
        const wobble = shake?.key === p.id
        const spin = isFound && p.type === 'circle' && !reduceMotion()
        const fs = Math.min(w, h) / 100
        const fly = solved && r.scene.go.fly.includes(p.id) && !reduceMotion()
        const drive = solved && r.scene.go.drive.includes(p.id) && !reduceMotion()
        const play = wobble && shake.play && !fly && !drive && !reduceMotion()
        return (
          <motion.g key={`${p.id}-${wobble ? shake.n : 0}`}
            role="button" aria-label={SHAPES[p.type].name} tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); onTap(p, { x: b.left + b.width / 2, y: b.top + b.height / 2 }) } }}
            initial={false}
            animate={play ? (p.type === 'circle' ? { rotate: [p.rot, p.rot + 360], scale: [1, 1.2, 1], y: [0, -12, 0] } : { y: [0, -20, 0], scale: [1, 1.15, 1], rotate: [p.rot, p.rot - 10, p.rot + 10, p.rot] })
              : wobble && !reduceMotion() ? { rotate: [p.rot, p.rot - 12, p.rot + 10, p.rot - 6, p.rot], scale: [1, 1.12, 1] }
              : fly ? { y: [0, 12, -H - 80], rotate: [p.rot, p.rot - 10, p.rot + 15], scale: 1 }
              : drive ? { x: [0, -10, W + 60], scale: 1, rotate: spin ? p.rot + 720 : p.rot }
              : isFound ? { rotate: spin ? p.rot + 360 : p.rot, scale: [1, 1.25, 1], y: solved && !reduceMotion() ? [0, -8, 0] : 0 }
              : { rotate: p.rot, scale: 1, x: 0, y: 0 }}
            transition={fly ? { duration: 1.8, delay: 0.4 + (p.id % 5) * 0.12, ease: 'easeIn' }
              : drive ? { duration: 1.6, delay: 0.6, ease: 'easeIn' }
              : { duration: isFound && !wobble ? 0.7 : 0.55, y: solved ? { duration: 0.5, repeat: 2, delay: (p.id % 5) * 0.08 } : undefined }}
            style={{ outline: 'none' }}>
            <g fill={p.color} stroke={isFound ? '#FFC93C' : INK} strokeWidth={isFound ? 5 : 2.5} strokeLinejoin="round"
              style={{ filter: isFound ? 'drop-shadow(0 0 6px #FFE08A)' : undefined }}>
              {boxShape(p.type, x, y, w, h)}
            </g>
            {isFound && (
              <g transform={`translate(${cx - 50 * fs} ${cy - 50 * fs}) scale(${fs})`}>
                <Face y={SHAPES[p.type].eye} s={p.type === 'triangle' || p.type === 'star' ? 0.8 : 1} />
              </g>
            )}
          </motion.g>
        )
      })}
      {(tall ? r.scene.tall.overlay : r.scene.overlay) && <g pointerEvents="none">{tall ? r.scene.tall.overlay : r.scene.overlay}</g>}
      {/* the ladybug: tap it and it flies off */}
      <motion.g initial={false} animate={bugGone ? { x: 160, y: -260, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
        transition={{ duration: bugGone ? 1.2 : 0 }} onClick={flyAway} style={{ cursor: 'pointer' }}>
        <image href={artSrc('🐞')} x={bug[0]} y={bug[1]} width="26" height="26" />
      </motion.g>
    </svg>
  )
}

// ── The photo: the family lines up from small to big ──
// Each step shows a faint outline of the size that belongs there, so the
// order is clear without words. Tapped shapes hop onto the steps in turn;
// the camera flashes at the end.
function Photo({ r, picked, shake, solved, look, onPick, rowRef }) {
  const max = 'min(26vw, 124px)'
  const waiting = r.items.filter(it => !picked.includes(it.id))
  const order = picked.map(id => r.items.find(it => it.id === id))
  const wanted = [...r.sizes].sort((a, b) => (r.down ? b - a : a - b))
  const unit = s => `calc(${max} * ${s.toFixed(3)})`
  return (
    <LayoutGroup>
      {/* the steps for the photo */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 6, minHeight: `calc(${max} + 40px)` }}>
        <AnimatePresence>
          {solved && shake?.key === 'flash' && (
            <motion.div key="flash" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }}
              style={{ position: 'absolute', inset: -20, background: '#fff', borderRadius: 24, pointerEvents: 'none', zIndex: 2 }} />
          )}
        </AnimatePresence>
        {wanted.map((size, i) => {
          const it = order[i]
          const nextUp = i === order.length
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ position: 'relative', width: unit(size), height: unit(size) }}>
                {/* where the next one goes: its outline */}
                {!it && (
                  <motion.div key={nextUp ? look : 'o'} aria-hidden="true" animate={nextUp && look ? { scale: [1, 1.2, 1, 1.2, 1] } : {}} transition={{ duration: 1 }}
                    style={{ position: 'absolute', inset: 0, opacity: nextUp ? 0.45 : 0.2 }}>
                    <Shape type={r.type} color="transparent" size="100%" />
                  </motion.div>
                )}
                {it && (
                  <motion.div layoutId={`sz${it.id}`} style={{ position: 'absolute', inset: 0 }}
                    animate={solved && !reduceMotion() ? { y: [0, -10, 0] } : {}} transition={{ duration: 0.5, repeat: solved ? 2 : 0, delay: i * 0.1 }}>
                    <Shape type={r.type} color={r.color} size="100%" face />
                  </motion.div>
                )}
              </div>
              <div style={{
                width: `calc(${max} * 0.9)`, height: 20 + i * 14, marginTop: 4, background: '#C98A52', border: `3px solid ${INK}`, borderRadius: 6,
                boxSizing: 'border-box', boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.25)',
              }} />
            </div>
          )
        })}
      </div>
      {/* those still waiting */}
      <div ref={rowRef} style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(10px,3vw,24px)', minHeight: `calc(${max} + 8px)`, flexWrap: 'wrap', justifyContent: 'center' }}>
        {waiting.map(it => (
          <motion.button key={it.id} layoutId={`sz${it.id}`}
            onClick={() => onPick(it)}
            aria-label={`Form ${r.sizes.slice().sort((a, b) => a - b).indexOf(it.size) + 1} von ${r.sizes.length}`}
            whileTap={{ scale: 0.92 }}
            style={{ all: 'unset', cursor: 'pointer', minWidth: 56, minHeight: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <ShakeBox on={shake?.key === `s${it.id}`} k={shake?.n}>
              <div style={{ width: unit(it.size), height: unit(it.size) }}>
                <Shape type={r.type} color={r.color} size="100%" face />
              </div>
            </ShakeBox>
          </motion.button>
        ))}
      </div>
    </LayoutGroup>
  )
}

// ── The parade: the shapes march, one place at the end is free ──
// After a miss the parade marches its rhythm once more, shape by shape.
function Parade({ r, solved, look, onDrop, gapRef }) {
  const size = `min(calc((100vw - 80px) / ${r.seq.length + 1} - 6px), 76px)`
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'flex-end', padding: '14px 12px 10px', borderRadius: 20,
      background: 'rgba(255,253,247,0.7)', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.25)',
    }}>
      {r.seq.map((s, i) => (
        <motion.div key={`${i}-${look}`} aria-label={SHAPES[s.type].name} style={{ width: size, height: size }}
          animate={reduceMotion() ? {} : solved || look ? { y: [0, -18, 0] } : { y: [0, -5, 0] }}
          transition={solved || look ? { duration: 0.35, delay: i * 0.18 } : { duration: 0.8, repeat: Infinity, delay: i * 0.13 }}>
          <Shape type={s.type} color={s.color} size="100%" face />
        </motion.div>
      ))}
      <DropZone id="gap" label="Lücke in der Parade" onDrop={onDrop}>
        {hover => (
          <div ref={gapRef} style={{
            width: size, height: size, borderRadius: 14, boxSizing: 'border-box', padding: 3,
            border: solved ? 'none' : `3px dashed ${hover ? '#FFC93C' : INK}`, background: hover ? 'rgba(255,201,60,0.3)' : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-heading)', fontSize: 28, color: INK,
          }}>
            {solved
              ? <motion.div initial={{ scale: 0 }} animate={{ scale: 1, y: [0, -18, 0] }} transition={{ delay: r.seq.length * 0.12 }} style={{ width: '100%', height: '100%' }}>
                  <Shape type={r.correct.type} color={r.correct.color} size="100%" face />
                </motion.div>
              : '?'}
          </div>
        )}
      </DropZone>
    </div>
  )
}
