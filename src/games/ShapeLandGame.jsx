import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, lockPreviews, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { hearable } from '../lib/hearable.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts } from '../components/play/index.js'
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

// art: the article after "Finde …" (accusative). Oval and Raute sit next to
// Kreis and Quadrat on purpose: telling them apart is the real step of
// naming shapes by their look. `eye` is where a face sits in the shape.
const SHAPES = {
  circle:    { name: 'Kreis',    many: 'Kreise',    art: 'den', eye: 46, draw: (c) => <circle cx="50" cy="50" r="42" fill={c} /> },
  square:    { name: 'Quadrat',  many: 'Quadrate',  art: 'das', eye: 46, draw: (c) => <rect x="10" y="10" width="80" height="80" rx="6" fill={c} /> },
  triangle:  { name: 'Dreieck',  many: 'Dreiecke',  art: 'das', eye: 62, draw: (c) => <polygon points="50,8 94,88 6,88" fill={c} /> },
  rectangle: { name: 'Rechteck', many: 'Rechtecke', art: 'das', eye: 46, draw: (c) => <rect x="6" y="26" width="88" height="48" rx="6" fill={c} /> },
  oval:      { name: 'Oval',     many: 'Ovale',     art: 'das', eye: 46, draw: (c) => <ellipse cx="50" cy="50" rx="46" ry="30" fill={c} /> },
  rhombus:   { name: 'Raute',    many: 'Rauten',    art: 'die', eye: 46, draw: (c) => <polygon points="50,4 84,50 50,96 16,50" fill={c} /> },
  star:      { name: 'Stern',    many: 'Sterne',    art: 'den', eye: 52, draw: (c) => <polygon points="50,5 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38" fill={c} /> },
  heart:     { name: 'Herz',     many: 'Herzen',    art: 'das', eye: 42, draw: (c) => <path d="M50 88 C10 58 10 22 32 18 C42 16 50 26 50 32 C50 26 58 16 68 18 C90 22 90 58 50 88Z" fill={c} /> },
}
const SHAPE_IDS = Object.keys(SHAPES)
// Shape colours, all dark enough to stand out on parchment
const COLORS = ['#E8503F', '#F2B705', '#3FA34D', '#3D8BE0', '#8E6CF0', '#E0509A']

// "ein Kreis", "eine Raute"
const indef = (type) => (SHAPES[type].art === 'die' ? 'eine' : 'ein')
// "von einem Kreis", "von einer Raute"
const dat   = (type) => (SHAPES[type].art === 'die' ? 'einer' : 'einem')

// Shapes around us: things whose picture shows the shape plainly, checked
// against the pictures in public/sprites/emoji (outline measured: the
// window 1:1, the door 2:3) — the open book, the cake slice, the gift, the
// waffle (drawn round), the framed picture (not square) and the potato
// (drawn lying at a slant) stay out, their outline is not one shape.
// Names with their article in the nominative.
const OBJECTS = {
  circle:    [['🕐', 'die Uhr'], ['🍪', 'der Keks'], ['🌕', 'der Vollmond'], ['🪙', 'die Münze'], ['🎯', 'die Zielscheibe']],
  square:    [['🪟', 'das Fenster']],
  triangle:  [['🍕', 'das Pizzastück'], ['⚠️', 'das Warnschild'], ['🚩', 'die Fahne'], ['⛺', 'das Zelt']],
  rectangle: [['🚪', 'die Tür'], ['📱', 'das Handy'], ['💌', 'der Brief']],
  oval:      [['🥚', 'das Ei'], ['🪞', 'der Spiegel']],
  rhombus:   [['🪁', 'der Drachen']],
}
// "um den Drachen herum"
const akk = (name) => name.replace(/^der /, 'den ')
const cap = (s) => s[0].toUpperCase() + s.slice(1)

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
// appears at least twice; `overlay` is scenery drawn over the pieces. `tilt` marks loose things (a kite, a balloon) that
// may hang at a slant from level 2.
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
      ['square',     40, 136, 100, 94, '#F2B705'],             // wall
      ['square',     52, 150, 34, 34, '#BFE6FF'],              // window
      ['rectangle',  96, 168, 34, 62, '#8A4F22'],              // door
      ['heart',     100, 180, 26, 24, '#E0509A'],              // heart on the door
      ['triangle',  158, 112, 66, 92, '#3FA34D'],              // fir tree
      ['star',      172, 90, 38, 38, '#FFC93C', 1],            // star on top
      ['rectangle', 182, 204, 18, 28, '#8A4F22'],              // trunk
      ['oval',      218, 200, 64, 34, '#3FA34D'],              // bush
      ['square',    322, 146, 44, 40, '#BFE6FF'],              // car cabin
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
    overlay: (
      <g stroke="#C98A52" strokeWidth="4" strokeLinecap="round">
        {[0, 45, 90, 135].map(a => {
          const dx = 60 * Math.cos(a * Math.PI / 180), dy = 60 * Math.sin(a * Math.PI / 180)
          return <line key={a} x1={377 - dx} y1={101 - dy} x2={377 + dx} y2={101 + dy} />
        })}
        <circle cx="377" cy="101" r="9" fill="#8A4F22" stroke={INK} strokeWidth="2.5" />
      </g>
    ),
  },
]

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
    const scene  = SCENES[used.scene++ % SCENES.length]
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

const taskFor = (r) =>
  r.mode === 'match' ? `Finde alle ${SHAPES[r.answer].many}!`
  : r.mode === 'object' ? `Welche Form hat ${r.thing.name}? Leg die passende Form darauf!`
  : r.mode === 'size' ? (r.down ? 'Alle wollen aufs Foto! Tippe die Formen von groß nach klein!' : 'Alle wollen aufs Foto! Tippe die Formen von klein nach groß!')
  : 'Die Formen machen eine Parade. Wer kommt als Nächstes?'

export default function ShapeLandGame({ level = 1, onComplete }) {
  const TOTAL = 8
  const rounds = useState(() => {
    const used = { object: new Set(), match: new Set(), scene: rand(0, 1) }
    return Array.from({ length: TOTAL }, (_, i) => buildRound(level, i, used))
  })[0]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const [idx,      setIdx]      = useState(0)
  const [picked,   setPicked]   = useState([])       // size: tap order · match: pieces found
  const [wrong,    setWrong]    = useState([])
  const [shake,    setShake]    = useState(null)     // { key, n } — the piece that wobbles
  const [solved,   setSolved]   = useState(false)
  const [owl,      setOwl]      = useMood()
  const [bursts, burst] = useBursts()
  const missed = useRef(new Set())                   // rounds with a miss
  const timer  = useRef(null)

  const r = rounds[idx]

  useEffect(() => {
    if (!r) return
    setPicked([]); setWrong([]); setSolved(false); setShake(null)
    lockPreviews()
    const id = setTimeout(() => sayTask(taskFor(r)), 420)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), [])

  const next = useCallback(() => {
    if (idx + 1 >= TOTAL) {
      sfx.complete()
      afterNarration(() => onComplete(result(TOTAL - missed.current.size, TOTAL)), { minMs: 300 })
    } else setIdx(i => i + 1)
  }, [idx, onComplete])

  // Praise, a short dance, then the next round comes by itself
  const finish = useCallback((praise) => {
    setSolved(true)
    setOwl('dance', 2400)
    sfx.correct()
    sayRight(praise, {
      onEnd: () => {
        const go = () => { timer.current = setTimeout(() => (pausedRef.current ? go() : next()), 600) }
        go()
      },
    })
  }, [next, setOwl])

  const miss = useCallback((key, hint) => {
    setWrong(w => w.includes(key) ? w : [...w, key])
    setShake({ key, n: Date.now() })
    missed.current.add(idx)
    setOwl('oops')
    sfx.boing()
    sayWrong(hint)
  }, [idx, setOwl])

  // ── the picture: find them all ──
  const tapPiece = useCallback((p, e) => {
    if (solved || !r) return
    if (picked.includes(p.id)) { sfx.giggle(); setShake({ key: p.id, n: Date.now() }); return }
    if (p.type === r.answer) {
      const found = [...picked, p.id]
      setPicked(found)
      sfx.sparkle()
      burst(e.currentTarget, 'stars', 6)
      if (found.length === r.need) finish(`Alle ${sayNumber(r.need)} ${SHAPES[r.answer].many} gefunden!`)
      else { narrate([{ text: sayNumber(found.length), rate: 1 }]); setOwl('wow', 700) }
      return
    }
    // A shape the level does not teach yet only wobbles
    if (!poolFor(level).includes(p.type)) { sfx.boing(); setShake({ key: p.id, n: Date.now() }); return }
    miss(p.id, `Das ist ${indef(p.type)} ${SHAPES[p.type].name}. Wir suchen ${SHAPES[r.answer].many}.`)
  }, [solved, r, picked, level, burst, finish, miss, setOwl])

  // ── shapes around us: press the right shape onto the thing ──
  const dropOnThing = useCallback((type) => {
    if (solved || !r) return false
    const { name } = r.thing
    if (type !== r.answer) {
      miss(type, `Das ist ${indef(type)} ${SHAPES[type].name}. Fahr mit dem Finger einmal um ${akk(name)} herum.`)
      return false
    }
    sfx.tada()
    finish(`${cap(name)} hat die Form von ${dat(type)} ${SHAPES[type].name}.`)
    return true
  }, [solved, r, miss, finish])

  // ── the photo: small to big ──
  const pickSize = useCallback((item) => {
    if (solved || !r || picked.includes(item.id)) return
    const order = [...r.sizes].sort((a, b) => (r.down ? b - a : a - b))
    const expected = order[picked.length]
    if (item.size !== expected) {
      // The hint used to be "Fang mit der kleinsten an!" for every miss,
      // even when the smallest was already taken and the child was at step 3.
      const hint = picked.length === 0
        ? (r.down ? 'Fang mit der größten an!' : 'Fang mit der kleinsten an!')
        : (r.down ? 'Welche ist die nächstkleinere?' : 'Welche ist die nächstgrößere?')
      miss(`s${item.id}`, hint)
      return
    }
    const nextPicked = [...picked, item.id]
    setPicked(nextPicked)
    sfx.slideUp()
    if (nextPicked.length === r.items.length) {
      timer.current = setTimeout(() => { sfx.sparkle(); setShake({ key: 'flash', n: Date.now() }) }, 450)
      finish(r.down ? 'Von groß nach klein. Lächeln, klick!' : 'Von klein nach groß. Lächeln, klick!')
    }
  }, [solved, r, picked, miss, finish])

  // ── the parade: who comes next? ──
  const dropInParade = useCallback((opt) => {
    if (solved || !r) return false
    if (opt.type !== r.correct.type) {
      miss(`p${opt.id}`, `Hör mal! ${r.seq.map(s => SHAPES[s.type].name).join(', ')}, und dann?`)
      return false
    }
    setPicked([opt.id])
    r.seq.forEach((_, i) => setTimeout(() => sfx.drum(i % 2 === 0), 120 * i))
    finish('So geht das Muster weiter.')
    return true
  }, [solved, r, miss, finish])

  if (!r) return null

  const owlWish = r.mode === 'match'
    ? <div style={{ width: 40, height: 40 }}><Shape type={r.answer} color="#FFC93C" size="100%" face /></div>
    : r.mode === 'object' ? <Art art={r.thing.emoji} size={40} />
    : r.mode === 'size' ? <Art art="📷" size={40} />
    : <Art art="🥁" size={40} />

  const hearItems = [taskFor(r), ...(
    r.mode === 'object' ? r.options.map(t => SHAPES[t].name)
    : r.mode === 'pattern' ? r.options.map(o => SHAPES[o.type].name)
    : [])]

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(10px,2vw,22px) clamp(10px,3vw,28px)', gap: 'clamp(8px,1.6vw,16px)',
    }}>
      {bursts}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 760 }}>
        <RoundTrail total={TOTAL} done={idx + (solved ? 1 : 0)} walker="🦉" goal="🏆" style={{ flex: 1 }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => narrate(hearItems.map((text, i) => ({ text, gap: i ? 280 : 0 })))}
          aria-label="Aufgabe noch einmal hören"
          style={{
            width: 52, height: 52, flexShrink: 0, background: 'var(--px-gold)', border: `3px solid ${INK}`, borderRadius: 12,
            boxShadow: `inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -5px 0 rgba(0,0,0,0.2), 0 4px 0 ${INK}`,
            cursor: 'pointer', fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔊</motion.button>
      </div>

      {/* The owl detective and what it is looking for */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', maxWidth: 760, minHeight: 96 }}>
        <Critter art="🦉" size={88} mood={owl} talks label="Eule"
          onTap={() => { sfx.giggle(); setOwl('wow', 700); sayTask(taskFor(r)) }} />
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
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'clamp(12px,3dvh,26px)' }}>
        {r.mode === 'match' && <Picture r={r} found={picked} shake={shake} solved={solved} onTap={tapPiece} />}

        {r.mode === 'object' && (
          <DragArea autoTarget="thing" disabled={solved}>
            <DropZone id="thing" onDrop={dropOnThing} label={r.thing.name} slop={40}>
              {hover => (
                <motion.div animate={solved ? { y: [0, -30, 0], rotate: [0, -8, 8, 0] } : { scale: hover ? 1.08 : 1 }}
                  transition={{ duration: solved ? 0.8 : 0.2 }}
                  onClick={() => narrate([{ text: `${cap(r.thing.name)}.` }], { skipIfSame: true })}
                  style={{
                    position: 'relative', width: 'min(34vw, 230px)', height: 'min(34vw, 230px)', minWidth: 150, minHeight: 150,
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
            <div style={{ display: 'flex', gap: 'clamp(14px,4vw,32px)', justifyContent: 'center' }}>
              {r.options.map(type => {
                const isWrong = wrong.includes(type)
                const gone = solved && type === r.answer
                return (
                  <Draggable key={type} id={type} data={type} label={SHAPES[type].name} disabled={isWrong || solved}
                    style={{ visibility: gone ? 'hidden' : 'visible', opacity: isWrong ? 0.4 : 1 }}>
                    <ShakeBox on={shake?.key === type} k={shake?.n}>
                      <div {...hearable(SHAPES[type].name)} style={{ width: 'min(20vw, 120px)', height: 'min(20vw, 120px)', minWidth: 76, minHeight: 76 }}>
                        <Shape type={type} color={r.color} size="100%" face />
                      </div>
                    </ShakeBox>
                  </Draggable>
                )
              })}
            </div>
          </DragArea>
        )}

        {r.mode === 'size' && <Photo r={r} picked={picked} wrong={wrong} shake={shake} solved={solved} onPick={pickSize} />}

        {r.mode === 'pattern' && (
          <DragArea autoTarget="gap" disabled={solved}>
            <Parade r={r} solved={solved} onDrop={dropInParade} />
            <div style={{ display: 'flex', gap: 'clamp(14px,4vw,32px)', justifyContent: 'center' }}>
              {r.options.map(opt => {
                const isWrong = wrong.includes(`p${opt.id}`)
                const gone = picked.includes(opt.id)
                return (
                  <Draggable key={opt.id} id={opt.id} data={opt} label={SHAPES[opt.type].name} disabled={isWrong || solved}
                    style={{ visibility: gone ? 'hidden' : 'visible', opacity: isWrong ? 0.4 : 1 }}>
                    <ShakeBox on={shake?.key === `p${opt.id}`} k={shake?.n}>
                      <div {...hearable(SHAPES[opt.type].name)} style={{ width: 'min(18vw, 104px)', height: 'min(18vw, 104px)', minWidth: 72, minHeight: 72 }}>
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

// ── The hidden-shape picture ──
// Found shapes get a face, glow and dance: circles roll round, the others
// hop. A wrong one wobbles. Every piece has a generous invisible edge, so a
// small finger also hits the heart on the door.
function Picture({ r, found, shake, solved, onTap }) {
  return (
    <svg viewBox="0 0 480 300" role="group" aria-label="Suchbild"
      style={{ width: '100%', maxWidth: 'min(100%, calc((100dvh - 250px) * 1.6), 920px)', height: 'auto', display: 'block', borderRadius: 22, border: `4px solid ${INK}`, boxShadow: '0 6px 0 rgba(42,27,61,0.3)', background: r.scene.sky, touchAction: 'manipulation' }}>
      <g pointerEvents="none">{r.scene.scenery}</g>
      {r.pieces.map(p => {
        const isFound = found.includes(p.id)
        const cx = p.x + p.w / 2, cy = p.y + p.h / 2
        const wobble = shake?.key === p.id
        const spin = isFound && (p.type === 'circle') && !reduceMotion()
        const fs = Math.min(p.w, p.h) / 100
        return (
          <motion.g key={`${p.id}-${wobble ? shake.n : 0}`}
            role="button" aria-label={SHAPES[p.type].name} tabIndex={0}
            onClick={e => onTap(p, e)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap(p, e) } }}
            initial={false}
            animate={wobble && !reduceMotion() ? { rotate: [p.rot, p.rot - 12, p.rot + 10, p.rot - 6, p.rot], scale: [1, 1.12, 1] }
              : isFound ? { rotate: spin ? p.rot + 360 : p.rot, scale: [1, 1.25, 1], y: solved && !reduceMotion() ? [0, -8, 0] : 0 }
              : { rotate: p.rot, scale: 1 }}
            transition={{ duration: isFound && !wobble ? 0.7 : 0.55, y: solved ? { duration: 0.5, repeat: 2, delay: (p.id % 5) * 0.08 } : undefined }}
            style={{ cursor: solved ? 'default' : 'pointer', outline: 'none' }}>
            {/* the wide invisible edge that makes small pieces easy to hit */}
            <g fill="transparent" stroke="transparent" strokeWidth="14" strokeLinejoin="round">{boxShape(p.type, p.x, p.y, p.w, p.h)}</g>
            <g fill={p.color} stroke={isFound ? '#FFC93C' : INK} strokeWidth={isFound ? 5 : 2.5} strokeLinejoin="round"
              style={{ filter: isFound ? 'drop-shadow(0 0 6px #FFE08A)' : undefined }}>
              {boxShape(p.type, p.x, p.y, p.w, p.h)}
            </g>
            {isFound && (
              <g transform={`translate(${cx - 50 * fs} ${cy - 50 * fs}) scale(${fs})`}>
                <Face y={SHAPES[p.type].eye} s={p.type === 'triangle' || p.type === 'star' ? 0.8 : 1} />
              </g>
            )}
          </motion.g>
        )
      })}
      {r.scene.overlay && <g pointerEvents="none">{r.scene.overlay}</g>}
    </svg>
  )
}

// ── The photo: the family lines up from small to big ──
// Tapped shapes hop onto the steps in order; the camera flashes at the end.
function Photo({ r, picked, wrong, shake, solved, onPick }) {
  const max = 'min(17vw, 120px)'
  const waiting = r.items.filter(it => !picked.includes(it.id))
  const order = picked.map(id => r.items.find(it => it.id === id))
  const unit = it => `calc(${max} * ${it.size.toFixed(3)})`
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
        {r.items.map((_, i) => {
          const it = order[i]
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ minHeight: 10 }}>
                {it && (
                  <motion.div layoutId={`sz${it.id}`} style={{ width: unit(it), height: unit(it) }}
                    animate={solved && !reduceMotion() ? { y: [0, -10, 0] } : {}} transition={{ duration: 0.5, repeat: solved ? 2 : 0, delay: i * 0.1 }}>
                    <Shape type={r.type} color={r.color} size="100%" face />
                  </motion.div>
                )}
              </div>
              <div style={{
                width: `calc(${max} * 0.9)`, height: 20 + i * 14, background: '#C98A52', border: `3px solid ${INK}`, borderRadius: 6,
                boxSizing: 'border-box', boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.25)',
              }} />
            </div>
          )
        })}
      </div>
      {/* those still waiting */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(10px,3vw,24px)', minHeight: `calc(${max} + 8px)`, flexWrap: 'wrap', justifyContent: 'center' }}>
        {waiting.map(it => (
          <motion.button key={it.id} layoutId={`sz${it.id}`}
            onClick={() => onPick(it)}
            aria-label={`Form ${r.sizes.slice().sort((a, b) => a - b).indexOf(it.size) + 1} von ${r.sizes.length}`}
            whileTap={{ scale: 0.92 }}
            style={{ all: 'unset', cursor: 'pointer', minWidth: 56, minHeight: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <ShakeBox on={shake?.key === `s${it.id}`} k={shake?.n}>
              <div style={{ width: unit(it), height: unit(it), opacity: wrong.includes(`s${it.id}`) && shake?.key !== `s${it.id}` ? 0.85 : 1 }}>
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
function Parade({ r, solved, onDrop }) {
  const size = `min(calc((100vw - 80px) / ${r.seq.length + 1} - 6px), 76px)`
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'flex-end', padding: '14px 12px 10px', borderRadius: 20,
      background: 'rgba(255,253,247,0.7)', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.25)',
    }}>
      {r.seq.map((s, i) => (
        <motion.div key={i} aria-label={SHAPES[s.type].name} style={{ width: size, height: size }}
          animate={reduceMotion() ? {} : solved ? { y: [0, -18, 0] } : { y: [0, -5, 0] }}
          transition={solved ? { duration: 0.35, delay: i * 0.12 } : { duration: 0.8, repeat: Infinity, delay: i * 0.13 }}>
          <Shape type={s.type} color={s.color} size="100%" face />
        </motion.div>
      ))}
      <DropZone id="gap" label="Lücke in der Parade" onDrop={onDrop}>
        {hover => (
          <div style={{
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
