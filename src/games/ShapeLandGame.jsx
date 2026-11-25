import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, LayoutGroup, useAnimationControls } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, afterNarration, narrate } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { LINES, line } from '../lib/lumiLines.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, artSrc, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { INK } from './px.js'
import { SCENES, Spokes, Twinkles, sceneDeck, sceneShown, timesShown } from './shapeScenes.jsx'
import { SHAPE_IDS, OBJECTS, defensible, objectOptions, shapeBag, pieceAt, onPiece } from './shapeRules.js'
import { useBox, isUpright, isFlat } from './useBox.js'

/**
 * Formen-Land — Formen erkennen, Größen ordnen, Muster fortsetzen,
 * Formen im Alltag finden
 *
 * An owl detective hunts for shapes. Most rounds are a busy picture — a
 * street, a fair — built entirely from shapes: the owl holds one up in its
 * magnifying glass, and every one found gets a face, giggles and flies into
 * the owl's collection case; a star flies to the counter, and finds in a
 * row without a wrong tap build a streak (components/play/Juice.jsx). The
 * last one sets the whole picture in motion: the big wheel turns, the
 * train leaves, the rocket lifts off. The first picture of a level is a
 * "blink" round: the shapes to find wink one after another, with rising
 * notes, before the hunt starts, so the child knows how many there are. In
 * between the shapes line up from small to big for a photo, march in a
 * parade the child continues, or a shape is pressed onto a thing like a
 * cookie cutter to show its form.
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
 *
 * What counts as right is in shapeRules.js, the pictures in shapeScenes.jsx.
 * The game lays itself out from the room it really has (useBox.js): stacked
 * on a tablet and an upright phone, side by side on a phone held sideways.
 */

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

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
// Shape colours, all dark enough to stand out on parchment
const COLORS = ['#E8503F', '#F2B705', '#3FA34D', '#3D8BE0', '#8E6CF0', '#E0509A']

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// What Lumi says to a task and names when it is solved. None of these is
// recorded yet: each is skipped while its recording is missing.
const optional = key => (LINES[key] ? line(key) : null)
const slug = w => w.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue')
const sayKey = r =>
  r.mode === 'match' ? `formen/finde-${slug(SHAPES[r.answer].many)}`      // "Finde alle Kreise."
  : r.mode === 'object' ? 'formen/welche-form'                           // "Welche Form ist das?"
  : r.mode === 'size' ? (r.down ? 'formen/gross-nach-klein' : 'formen/klein-nach-gross')
  : 'formen/wer-kommt'                                                   // "Wer kommt als Nächstes?"
const nameKey = type => `formen/${slug(SHAPES[type].name)}`              // "Ein Kreis."

// A face for a shape that was found or that takes part in a game: the
// shapes are little characters here. `wink`: one eye shut (the blink round).
function Face({ y = 46, s = 1, wink = false }) {
  return (
    <g pointerEvents="none" transform={`translate(50 ${y}) scale(${s}) translate(-50 -46)`}>
      <circle cx="38" cy="42" r="8" fill="#fff" stroke={INK} strokeWidth="2.5" />
      <circle cx="40" cy="44" r="3.8" fill={INK} />
      {wink
        ? <path d="M54 44 Q62 36 70 44" stroke={INK} strokeWidth="3.5" fill="none" strokeLinecap="round" />
        : <><circle cx="62" cy="42" r="8" fill="#fff" stroke={INK} strokeWidth="2.5" /><circle cx="64" cy="44" r="3.8" fill={INK} /></>}
      <path d="M40 58 Q50 68 60 58" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  )
}
const faceScale = type => (type === 'triangle' || type === 'star' ? 0.8 : 1)

function Shape({ type, color, size = 72, rotate = 0, face = false, dashed = false }) {
  const s = SHAPES[type]
  if (!s) return null
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={rotate ? `rotate(${rotate} 50 50)` : undefined}>
        <g stroke={INK} strokeWidth={dashed ? 5 : 4} strokeLinejoin="round" strokeDasharray={dashed ? '9 8' : undefined}>{s.draw(color)}</g>
        {face && <Face y={s.eye} s={faceScale(type)} />}
      </g>
    </svg>
  )
}

// A shape laid onto a thing's outline in its picture (see OBJECTS)
function Outline({ type, outline, color }) {
  const [x, y, w, h] = type === 'triangle' ? [] : outline
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <g fill={color} stroke={INK} strokeWidth="3" strokeLinejoin="round">
        {type === 'triangle' ? <polygon points={outline.map(p => p.join(',')).join(' ')} />
          : type === 'circle' || type === 'oval' ? <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} />
          : <rect x={x} y={y} width={w} height={h} rx="3" />}
      </g>
    </svg>
  )
}

// The owl's magnifying glass with the shape to look for in it. It is not
// one of the places of the collection: the sample used to stand in a row
// with them, and two triangles to find read as three.
function Lens({ type, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <path d="M70 70 L92 92" stroke={INK} strokeWidth="15" strokeLinecap="round" />
      <path d="M72 72 L91 91" stroke="#C98A52" strokeWidth="8" strokeLinecap="round" />
      <circle cx="44" cy="44" r="39" fill="#E8F7FF" stroke={INK} strokeWidth="6" />
      <g transform="translate(15 15) scale(0.58)">
        <g stroke={INK} strokeWidth="6" strokeLinejoin="round">{SHAPES[type].draw('#FFC93C')}</g>
        <Face y={SHAPES[type].eye} s={faceScale(type)} />
      </g>
      <path d="M18 34 Q24 18 40 13" stroke="#fff" strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.9" />
    </svg>
  )
}

// The owl's collection case: one place for every shape of the kind in the
// picture, empty (a dashed outline) until that shape is found and flies in.
function Collection({ type, need, colors, slot, blinkAt, slotRefs }) {
  return (
    <div role="img" aria-label={`${colors.length} von ${need}`} style={{
      display: 'flex', flexWrap: 'wrap', gap: 4, padding: 6, borderRadius: 14, boxSizing: 'border-box',
      background: '#C98A52', border: `3px solid ${INK}`, boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.25), 0 4px 0 rgba(42,27,61,0.3)',
    }}>
      {Array.from({ length: need }, (_, i) => {
        const got = i < colors.length
        return (
          <motion.div key={i} ref={el => { slotRefs.current[i] = el }}
            animate={blinkAt === i && !reduceMotion() ? { scale: [1, 1.35, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}
            style={{ position: 'relative', width: slot, height: slot, borderRadius: 8, background: blinkAt === i ? '#FFE08A' : '#FFFDF7' }}>
            <div style={{ position: 'absolute', inset: 4, opacity: got ? 0 : 0.5 }}><Shape type={type} color="transparent" size="100%" dashed /></div>
            {got && (
              // it appears as the flying shape arrives
              <motion.div initial={reduceMotion() ? false : { scale: 0 }} animate={{ scale: [0, 1.3, 1] }} transition={{ delay: 0.4, duration: 0.3 }}
                style={{ position: 'absolute', inset: 3 }}>
                <Shape type={type} color={colors[i]} size="100%" face />
              </motion.div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

// The hidden-shape pictures (a street, a fair, a ship, a farm, space, a
// castle, the sea, a train, a party): see shapeScenes.jsx

// A picture seen before comes back in another look: mirrored, at sunset, at
// night (the windows lit) or in other colours. Only the look changes: the
// same shapes, the same number of each kind. A picture with a sky of its own
// (space, the sea, a room) keeps it.
const LOOKS = [
  { mirror: false, sky: null,      shift: 0 },
  { mirror: true,  sky: '#FFC9A3', shift: 2 },
  { mirror: false, sky: '#33407A', shift: 4, night: true },
  { mirror: true,  sky: '#D3F0C4', shift: 1 },
]
// The stars of a night look: crosses like the sparkles in space, never dots
// that could be taken for little circles
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
  const stars = W => look.night && !scene.ownSky && <Twinkles at={NIGHT_STARS.map(([x, y]) => [x * W / 480, y])} />
  const point = (W, p) => p && [flip(W, p[0], 0), p[1]]
  return {
    ...scene,
    mirror: look.mirror,
    sky: (!scene.ownSky && look.sky) || scene.sky,
    pieces: scene.pieces.map(([type, x, y, w, h, color, loose]) => [type, flip(480, x, w), y, w, h, recolour(color), loose]),
    scenery: <>{stars(480)}{mirrored(480, scene.scenery)}</>,
    strings: mirrored(480, scene.strings),
    overlay: mirrored(480, scene.overlay),
    spinAt: point(480, scene.spinAt),
    bug: [flip(480, scene.bug[0], 26), scene.bug[1]],
    tall: {
      ...scene.tall,
      boxes: scene.tall.boxes.map(([x, y, w, h]) => [flip(300, x, w), y, w, h]),
      scenery: <>{stars(300)}{mirrored(300, scene.tall.scenery)}</>,
      strings: mirrored(300, scene.tall.strings),
      overlay: mirrored(300, scene.tall.overlay),
      spinAt: point(300, scene.tall.spinAt),
      bug: [flip(300, scene.tall.bug[0], 26), scene.tall.bug[1]],
    },
  }
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
// L5-6 + shapes around us · L7-10 all four. Every level opens with a picture.
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

// used: what this level asked for already (the picture rounds and "shapes
// around us" each on their own), so the circle doesn't win by having more things
function buildRound(level, idx, used) {
  const mode = modeFor(level, idx)
  const pool = poolFor(level)

  if (mode === 'object') {
    const types  = pool.filter(t => OBJECTS[t])
    const fresh  = types.filter(t => !used.object.has(t))
    const type   = shuffle(fresh.length ? fresh : types)[0]
    const [emoji, name, outline] = shuffle(OBJECTS[type])[0]
    used.object.add(type)
    return {
      mode, thing: { type, emoji, name, outline }, answer: type,
      options: objectOptions(type, pool, shuffle),
      color: COLORS[rand(0, COLORS.length - 1)],
    }
  }

  if (mode === 'match') {
    const answer = used.nextShape()
    // the next picture of the level's own order: none comes twice while
    // another is still waiting; one seen before comes in another look
    const n       = used.scene++
    const sceneId = used.deck[n % used.deck.length]
    const scene   = lookOf(SCENES[sceneId], timesShown(sceneId) + Math.floor(n / used.deck.length))
    // the pieces of the picture, each with its turn for this round
    const pieces = scene.pieces.map(([type, x, y, w, h, color, loose], id) => ({
      id, type, x, y, w, h, color, rot: loose ? tiltFor(level, type) : 0,
    }))
    // the ones to find, from left to right: the order they wink in
    const sought = pieces.filter(p => p.type === answer).sort((a, b) => a.x - b.x).map(p => p.id)
    // the first picture of a level is the blink round
    return { mode, answer, scene, sceneId, pieces, sought, need: sought.length, blink: n === 0 }
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
  // On a narrow phone the row stays shorter, so its members stay big enough
  // to tell apart (eight of them were 28 px each).
  const kinds = level <= 3 ? [['A','B']] : level <= 8 ? [['A','B'], ['A','B','C']] : [['A','B'], ['A','B','C'], ['A','A','B']]
  const unit  = kinds[rand(0, kinds.length - 1)]
  const picks = shuffle(pool).slice(0, 3)
  const cols  = shuffle(COLORS).slice(0, 3)
  const map   = { A: 0, B: 1, C: 2 }
  const narrow = typeof window !== 'undefined' && window.innerWidth < 560
  const len   = unit.length * 2 + rand(0, narrow ? Math.min(1, unit.length - 1) : unit.length - 1)
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

let flightSeq = 0
// the blink round: how long each shape winks
const BLINK_MS = 700

export default function ShapeLandGame({ level = 1, onComplete }) {
  const TOTAL = 8
  const rounds = useState(() => {
    const used = { object: new Set(), nextShape: shapeBag(poolFor(level)), scene: 0, deck: sceneDeck() }
    return Array.from({ length: TOTAL }, (_, i) => buildRound(level, i, used))
  })[0]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [rootRef, box] = useBox()
  const upright = isUpright(box), flat = isFlat(box)

  const [idx,      setIdx]      = useState(0)
  const [picked,   setPicked]   = useState([])       // size: tap order · match: pieces found
  const [wrong,    setWrong]    = useState([])
  const [shake,    setShake]    = useState(null)     // { key, n } — the piece that wobbles
  const [look,     setLook]     = useState(0)        // after a miss: look at the task again
  const [solved,   setSolved]   = useState(false)
  const [ending,   setEnding]   = useState(false)
  const [blinkAt,  setBlinkAt]  = useState(-1)       // the blink round: which of the sought ones winks now
  const [blinking, setBlinking] = useState(false)
  const [winkId,   setWinkId]   = useState(null)     // after two misses: this one winks, as a help
  const [flights,  setFlights]  = useState([])       // found shapes on their way into the collection
  const [owl,      setOwl]      = useMood()
  const [bursts, burst] = useBursts()
  const juice = useJuice({ hudSize: upright ? 28 : flat ? 46 : 36 })
  const { hit, miss: bonk } = juice                  // these never change
  const owlNo = useAnimationControls()
  const missed = useRef(new Set())                   // rounds with a miss
  const roundMisses = useRef(0)
  const seenIdx = useRef(-1)                         // the last round whose picture was counted
  const timers = useRef([])
  const hint   = { from: useRef(null), to: useRef(null) }
  const owlRef = useRef(null)
  const slotRefs = useRef([])

  const r = rounds[idx]

  const later = useCallback((fn, ms) => {
    const run = () => { if (pausedRef.current) timers.current.push(setTimeout(run, 250)); else fn() }
    timers.current.push(setTimeout(run, ms))
  }, [])

  // A layout effect: the new round is never painted with the last one's state
  useLayoutEffect(() => {
    if (!r) return
    timers.current.forEach(clearTimeout); timers.current = []
    setPicked([]); setWrong([]); setSolved(false); setShake(null); setLook(0); setWinkId(null); setBlinkAt(-1)
    roundMisses.current = 0
    setOwl('idle')
    // the picture counts as seen once it is on screen (once, also when
    // effects run twice)
    if (r.mode === 'match' && seenIdx.current !== idx) { seenIdx.current = idx; sceneShown(r.sceneId) }
    // the blink round: the shapes to find wink one after another, each with
    // a note that is one step higher: how many there are can be seen and heard
    const blinks = r.mode === 'match' && r.blink
    setBlinking(blinks)
    if (blinks) {
      r.sought.forEach((_, i) => later(() => { setBlinkAt(i); sfx.pluck(i) }, 900 + i * BLINK_MS))
      later(() => { setBlinkAt(-1); setBlinking(false) }, 900 + r.sought.length * BLINK_MS)
    }
    lockPreviews()
    sayTask()
    // Lumi says the task; in the first round after whatever is still being said
    const said = optional(sayKey(r))
    if (said) later(() => afterNarration(() => narrate([said]), { maxMs: 4000 }), idx ? 0 : 300)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The end of the level, here first: the owl dances with its cup
  const next = useCallback(() => {
    // the new picture mounts as it is (initial={false}): it must never see
    // the last round's "solved" (it would start flying off) or its finds
    if (idx + 1 < TOTAL) { setSolved(false); setPicked([]); setWrong([]); setShake(null); setIdx(i => i + 1); return }
    setEnding(true)
    setOwl('dance', 0)                               // the owl hoots, this once
    sfx.tada()
    burst({ x: innerWidth / 2, y: innerHeight * 0.4 }, 'confetti', 24)
    later(() => {
      sfx.complete()
      afterNarration(() => onComplete(result(TOTAL - missed.current.size, TOTAL)), { minMs: 400 })
    }, 2200)
  }, [idx, onComplete, burst, later, setOwl])

  // Praise and a little jump of the owl; the next round comes once the
  // payoff was seen. `named`: what Lumi names before the praise ("Ein Kreis.")
  const finish = useCallback((minMs = 1800, named = null) => {
    setSolved(true)
    sfx.tada()
    burst(owlRef.current, 'hearts', 8)
    sayRight(undefined, { lead: [named] })
    afterNarration(() => later(next, 0), { minMs })
  }, [next, burst, later])

  // A wrong answer: a soft bonk, the streak is over, the owl shakes its
  // head and the task pulses. Nothing is taken away.
  const miss = useCallback((key, at) => {
    setWrong(w => w.includes(key) ? w : [...w, key])
    setShake({ key, n: Date.now() })
    setLook(Date.now())
    missed.current.add(idx)
    roundMisses.current++
    bonk(at)
    if (!reduceMotion()) owlNo.start({ rotate: [0, -12, 10, -7, 5, 0], transition: { duration: 0.6 } })
    sayWrong()
  }, [idx, bonk, owlNo])

  // ── the picture: find them all ──
  // p: the piece the tap resolved to (see Picture), at: where on screen
  const tapPiece = useCallback((p, at) => {
    if (!r) return
    const { fly, drive, spin } = r.scene.go
    // solved: for a moment the picture is a toy. Tapped shapes hop, found
    // ones laugh and circles roll. Nothing here counts.
    if (solved) {
      if (ending || fly.includes(p.id) || drive.includes(p.id) || spin.includes(p.id)) return
      setShake({ key: p.id, n: Date.now(), play: true })
      if (picked.includes(p.id)) { sfx.giggle(); burst(at, 'stars', 4) } else sfx.pop()
      return
    }
    if (picked.includes(p.id)) { sfx.giggle(); setShake({ key: p.id, n: Date.now() }); return }
    if (p.type === r.answer) {
      const found = [...picked, p.id]
      setPicked(found)
      setWinkId(null)
      sfx.pop()
      hit(at)                                        // a note, a star to the counter, the streak grows
      burst(at, 'stars', 5)
      // … and the shape itself flies into its place in the collection
      const slot = slotRefs.current[found.length - 1]
      if (slot && !reduceMotion()) {
        const b = slot.getBoundingClientRect()
        setFlights(l => [...l, { id: ++flightSeq, type: p.type, color: p.color, from: at, to: { x: b.left + b.width / 2, y: b.top + b.height / 2 }, size: b.width }])
      }
      if (found.length === r.need) finish(3800)
      else setOwl('wow', 700)
      return
    }
    // Only a wobble, never a miss: a shape the level does not teach yet,
    // and one a child could defend (a square while rectangles are asked)
    if (!poolFor(level).includes(p.type) || defensible(p.type, r.answer)) { sfx.boing(); setShake({ key: p.id, n: Date.now() }); return }
    miss(p.id, at)
    // the second miss in a picture: one of those still hidden winks
    if (roundMisses.current >= 2) {
      const hidden = r.sought.filter(id => !picked.includes(id))
      later(() => setWinkId({ id: hidden[rand(0, hidden.length - 1)], n: Date.now() }), 700)
    }
  }, [solved, ending, r, picked, level, burst, finish, miss, hit, setOwl, later])

  // ── shapes around us: press the right shape onto the thing ──
  const dropOnThing = useCallback((type) => {
    if (solved || !r) return false
    if (type !== r.answer) { miss(type); return false }
    hit(hint.to, { stars: 2 })
    finish(1800, optional(nameKey(r.answer)))
    return true
  }, [solved, r, miss, finish, hit]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── the photo: small to big ──
  const pickSize = useCallback((item, el) => {
    if (solved || !r || picked.includes(item.id)) return
    const order = [...r.sizes].sort((a, b) => (r.down ? b - a : a - b))
    if (item.size !== order[picked.length]) { miss(`s${item.id}`, el); return }
    const nextPicked = [...picked, item.id]
    setPicked(nextPicked)
    sfx.slideUp()
    hit(el, { silent: true })
    if (nextPicked.length === r.items.length) {
      later(() => { sfx.sparkle(); setShake({ key: 'flash', n: Date.now() }) }, 500)
      finish(2200)
    }
  }, [solved, r, picked, miss, finish, later, hit])

  // ── the parade: who comes next? ──
  const dropInParade = useCallback((opt) => {
    if (solved || !r) return false
    if (opt.type !== r.correct.type) { miss(`p${opt.id}`); return false }
    setPicked([opt.id])
    hit(hint.to, { stars: 2 })
    r.seq.forEach((_, i) => later(() => sfx.drum(i % 2 === 0), 120 * i))
    finish(1200 + 120 * r.seq.length)
    return true
  }, [solved, r, miss, finish, later, hit]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!r) return null

  // ── the room there is, and what goes where ──
  const pad = flat ? 12 : Math.round(clamp(box.w * 0.02, 8, 22))
  const gap = flat ? 12 : Math.round(clamp(box.h * 0.018, 8, 16))
  const trail = upright ? 32 : flat ? 36 : 40
  const owlSize = upright ? 68 : flat ? 110 : 88
  const sideW = Math.round(clamp(box.w * 0.27, 300, 400))        // flat: the owl's column
  const cw = flat ? box.w - 2 * pad - sideW - gap : Math.min(box.w - 2 * pad, 960)
  const ch = flat ? box.h - 2 * pad : box.h - 2 * pad - trail * 1.35 - (owlSize + 8) - 2 * gap
  const lens = upright ? 54 : flat ? 78 : 66

  // What the owl holds up: the shape to find, the thing, the photo's order,
  // the end of the parade and its gap
  const mini = upright ? 24 : flat ? 36 : 30
  const bubble = r.mode === 'match'
    ? <motion.div key={look} animate={look && !reduceMotion() ? { scale: [1, 1.3, 1, 1.3, 1] } : {}} transition={{ duration: 1.1 }}><Lens type={r.answer} size={lens} /></motion.div>
    : r.mode === 'object' ? <Art art={r.thing.emoji} size={lens - 8} />
    : r.mode === 'size' ? (
      <>
        <Art art="📷" size={lens - 14} />
        {/* the order, one little shape for each one to line up */}
        <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
          {(r.down ? [...r.sizes].reverse() : r.sizes).map((s, i) => (
            <div key={i} style={{ width: mini * s, height: mini * s }}><Shape type={r.type} color={r.color} size="100%" /></div>
          ))}
        </div>
      </>
    ) : (
      // the end of the parade and the place that is free
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {r.seq.slice(-2).map((s, i) => <div key={i} style={{ width: mini, height: mini }}><Shape type={s.type} color={s.color} size="100%" /></div>)}
        <div style={{ width: mini, height: mini, boxSizing: 'border-box', border: `3px dashed ${INK}`, borderRadius: 8 }} />
      </div>
    )

  const owlBox = (
    <motion.div ref={owlRef} style={{ flexShrink: 0 }} animate={solved && !reduceMotion() ? { scale: [1, 1.3, 1.1, 1.25, 1], y: [0, -20, 0, -12, 0] } : { scale: 1, y: 0 }} transition={{ duration: 1.2 }}>
      <motion.div animate={owlNo} style={{ transformOrigin: '50% 90%' }}>
        <Critter art="🦉" size={owlSize} mood={owl} label="Eule"
          accessory={ending ? <span style={{ position: 'absolute', right: -6, bottom: 2, pointerEvents: 'none' }}><Art art="🏆" size={owlSize * 0.42} /></span> : null}
          onTap={() => { sfx.giggle(); setOwl('wow', 700) }} />
      </motion.div>
    </motion.div>
  )
  const bubbleBox = (
    <div aria-label={taskFor(r)} style={{
      position: 'relative', flexShrink: 0, background: '#FFFDF7', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
      padding: upright ? '6px 10px' : '8px 14px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: -14, top: '50%', marginTop: -10, borderStyle: 'solid', borderWidth: '10px 14px 10px 0', borderColor: `transparent ${INK} transparent transparent` }} />
      {bubble}
    </div>
  )
  // the collection case, its places as big as the room allows
  const caseRoom = flat ? sideW - 8 : cw - owlSize - (lens + 34) - 2 * (upright ? 8 : 14)
  const slot = r.mode === 'match' ? Math.floor(clamp((caseRoom - 18) / r.need - 4, 22, flat ? 54 : upright ? 34 : 42)) : 0
  const caseBox = r.mode === 'match' && (
    <Collection key={idx} type={r.answer} need={r.need} slot={slot} blinkAt={blinkAt} slotRefs={slotRefs}
      colors={picked.map(id => r.pieces[id].color)} />
  )

  const active = !solved && !ending && !blinking
  const delay = idx === 0 && level <= 2 ? 2500 : 7000
  const hintHand = r.mode === 'object' || r.mode === 'pattern'
    ? <HintHand from={hint.from} to={hint.to} delay={delay} active={active} />
    : <HintHand to={hint.to} delay={delay} active={active} />

  // the picture, as big as the room allows
  const PW = upright ? 300 : 480, PH = upright ? 420 : 300
  const picW = Math.floor(Math.min(cw, ch * PW / PH, 920))
  // "shapes around us" and the parade: the choices, big enough for a finger
  const optSize = Math.round(flat ? clamp((ch - 60) * 0.42, 100, 170) : clamp((cw - 80) / 3, 76, 120))
  const thingSize = Math.round(flat ? clamp(ch - 60, 180, 320) : clamp(Math.min(cw * 0.5, ch - optSize - gap * 3), 150, 240))

  const content = (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: Math.round(clamp(ch * 0.04, 10, 26)) }}>
      {r.mode === 'match' && (
        // a fresh picture each round: nothing carries over from the last
        // one, which had just flown and driven away
        <Picture key={idx} r={r} tall={upright} width={picW} found={picked} shake={shake} solved={solved}
          blinkId={blinkAt >= 0 ? r.sought[blinkAt] : null} wink={winkId} onTap={tapPiece} anchorRef={hint.to} />
      )}

      {r.mode === 'object' && (
        <DragArea autoTarget="thing" disabled={solved}>
          <div style={{ display: 'flex', flexDirection: flat ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: flat ? 40 : Math.round(clamp(ch * 0.05, 12, 28)) }}>
            <DropZone id="thing" onDrop={dropOnThing} label={r.thing.name} slop={40}>
              {hover => (
                <motion.div ref={hint.to} key={look} animate={solved ? { y: [0, -30, 0], rotate: [0, -8, 8, 0] } : look ? { rotate: [0, -6, 6, -4, 0] } : { scale: hover ? 1.08 : 1 }}
                  transition={{ duration: solved ? 0.8 : 0.5 }}
                  style={{
                    position: 'relative', width: thingSize, height: thingSize,
                    borderRadius: 28, background: 'rgba(255,253,247,0.85)', border: `4px dashed ${hover ? '#FFC93C' : INK}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Art art={r.thing.emoji} size={thingSize * 0.68} />
                  {solved && (
                    // the shape, laid exactly onto the thing's outline in its picture
                    <motion.div initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 0.55 }}
                      style={{ position: 'absolute', inset: thingSize * 0.16 - 4 }}>
                      <Outline type={r.answer} outline={r.thing.outline} color={r.color} />
                    </motion.div>
                  )}
                </motion.div>
              )}
            </DropZone>
            <div ref={hint.from} style={{ display: 'flex', gap: flat ? 24 : Math.round(clamp(cw * 0.04, 12, 32)), justifyContent: 'center' }}>
              {r.options.map(type => {
                const isWrong = wrong.includes(type)
                const gone = solved && type === r.answer
                return (
                  <Draggable key={type} id={type} data={type} label={SHAPES[type].name} disabled={isWrong || solved}
                    style={{ visibility: gone ? 'hidden' : 'visible', opacity: isWrong ? 0.4 : 1 }}>
                    <ShakeBox on={shake?.key === type} k={shake?.n}>
                      <div style={{ width: optSize, height: optSize }}>
                        <Shape type={type} color={r.color} size="100%" face />
                      </div>
                    </ShakeBox>
                  </Draggable>
                )
              })}
            </div>
          </div>
        </DragArea>
      )}

      {r.mode === 'size' && <Photo r={r} room={[cw, ch]} big={flat ? 170 : 124} tap={flat ? 100 : 56} picked={picked} shake={shake} solved={solved} look={look} onPick={pickSize} rowRef={hint.to} />}

      {r.mode === 'pattern' && (
        <DragArea autoTarget="gap" disabled={solved}>
          <Parade r={r} size={Math.floor(Math.min(flat ? 120 : 76, (cw - 30) / (r.seq.length + 1) - 6))} solved={solved} look={look} onDrop={dropInParade} gapRef={hint.to} />
          <div ref={hint.from} style={{ display: 'flex', gap: flat ? 24 : Math.round(clamp(cw * 0.04, 12, 32)), justifyContent: 'center' }}>
            {r.options.map(opt => {
              const isWrong = wrong.includes(`p${opt.id}`)
              const gone = picked.includes(opt.id)
              return (
                <Draggable key={opt.id} id={opt.id} data={opt} label={SHAPES[opt.type].name} disabled={isWrong || solved}
                  style={{ visibility: gone ? 'hidden' : 'visible', opacity: isWrong ? 0.4 : 1 }}>
                  <ShakeBox on={shake?.key === `p${opt.id}`} k={shake?.n}>
                    <div style={{ width: optSize, height: optSize }}>
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
  )

  return (
    <div ref={rootRef} style={{
      flex: 1, minHeight: 0, minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: flat ? 'row' : 'column', alignItems: 'center',
      padding: pad, gap,
    }}>
      {bursts}
      {juice.layer}
      {hintHand}
      {/* found shapes on their way into the collection, over everything */}
      {typeof document !== 'undefined' && createPortal(
        <div aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 9990, pointerEvents: 'none', overflow: 'hidden' }}>
          {flights.map(f => (
            <motion.div key={f.id}
              initial={{ x: f.from.x - f.size / 2, y: f.from.y - f.size / 2, scale: 2, rotate: -20 }}
              animate={{ x: f.to.x - f.size / 2, y: f.to.y - f.size / 2, scale: 1, rotate: 0 }}
              transition={{ duration: 0.42, ease: [0.5, 0, 0.75, 0.6] }}
              onAnimationComplete={() => setFlights(l => l.filter(x => x.id !== f.id))}
              style={{ position: 'absolute', left: 0, top: 0, width: f.size, height: f.size }}>
              <Shape type={f.type} color={f.color} size="100%" face />
            </motion.div>
          ))}
        </div>, document.body)}

      {flat ? (
        // a phone held sideways: the owl's column beside the task
        <div style={{ width: sideW, flexShrink: 0, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <RoundTrail total={TOTAL} done={idx + (solved ? 1 : 0)} walker="🦉" goal="🏆" size={trail} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>{owlBox}{bubbleBox}</div>
          <div style={{ display: 'flex' }}>{caseBox}</div>
          <div style={{ marginTop: 'auto', display: 'flex' }}>{juice.hud}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 760, flexShrink: 0 }}>
            <RoundTrail total={TOTAL} done={idx + (solved ? 1 : 0)} walker="🦉" goal="🏆" size={trail} style={{ flex: 1 }} />
            {juice.hud}
          </div>
          {/* The owl detective, what it is looking for, and its collection */}
          <div style={{ display: 'flex', alignItems: 'center', gap: upright ? 8 : 14, width: '100%', maxWidth: 760, height: owlSize + 8, flexShrink: 0 }}>
            {owlBox}{bubbleBox}{caseBox}
          </div>
        </>
      )}
      {content}
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
// hop. When all are found the picture has its moment: balloons and kites
// fly away (their strings with them), the car drives off, the big wheel
// turns, the flags wave. On an upright phone the pieces stand in the
// upright layout of the same picture.
//
// A tap is resolved by pieceAt (shapeRules.js), not by the shape that
// happens to lie on top. Only a tap right on a shape of another kind, with
// none of the sought kind there, can be a miss.
function Picture({ r, tall, width, found, shake, solved, blinkId, wink, onTap, anchorRef }) {
  const [bugGone, setBugGone] = useState(false)
  useEffect(() => setBugGone(false), [r])
  const svgRef = useRef(null)
  const W = tall ? 300 : 480, H = tall ? 420 : 300
  const scene = r.scene
  const lay = tall ? scene.tall : scene
  const bug = lay.bug
  const boxOf = p => (tall ? scene.tall.boxes[p.id] : [p.x, p.y, p.w, p.h])
  const flyAway = e => { e.stopPropagation(); if (bugGone) return; sfx.giggle(); sfx.whoosh(); setBugGone(true) }
  const tap = e => {
    const m = svgRef.current?.getScreenCTM()?.inverse()
    if (!m) return
    const px = m.a * e.clientX + m.c * e.clientY + m.e, py = m.b * e.clientX + m.d * e.clientY + m.f
    // around small pieces the finger may land a little off: a sought one is
    // a target of at least 48 px on screen, however small the picture is
    const unit = 1 / Math.abs(m.a || 1)                // screen px per picture unit
    const near = p => { const [, , w, h] = boxOf(p); return clamp((48 / unit - Math.min(w, h)) / 2, tall ? 8 : 6, 20) }
    const hit = pieceAt(r.pieces, boxOf, px, py, { answer: r.answer, found, near })
    if (hit) onTap(hit, { x: e.clientX, y: e.clientY })
  }
  const moving = solved && !reduceMotion()
  const { fly: flies, drive: drives, spin: spins, wave: waves } = scene.go

  // Where the face of a piece sits, and how big ([x, y, scale]): in its
  // middle, unless something lies on it there (the door on the wall, the
  // window on the rocket): then, smaller, on a spot of it that is free.
  const faceSpot = p => {
    const box = boxOf(p)
    const [x, y, w, h] = box
    const m = Math.min(w, h)
    const drop = (SHAPES[p.type].eye - 46) / 100 * m          // a triangle's face sits lower
    const above = r.pieces.filter(q => q.id > p.id).map(boxOf)
    const free = (cx, cy, k) => {
      const fw = m * 0.24 * k, fh = m * 0.2 * k
      return !above.some(([bx, by, bw, bh]) => cx + fw > bx && cx - fw < bx + bw && cy + fh > by && cy - fh < by + bh)
    }
    const mid = [x + w / 2, y + h / 2, m / 100]
    if (free(mid[0], mid[1] + drop, 1)) return mid
    for (const k of [0.7, 0.5]) {
      for (const [dx, dy] of [[0, -0.28], [0, 0.28], [-0.28, 0], [0.28, 0], [-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) {
        const cx = x + w / 2 + dx * w, cy = y + h / 2 + dy * h
        if (free(cx, cy + drop * k, k) && onPiece({ type: p.type }, box, cx, cy + drop * k, -m * 0.2 * k)) return [cx, cy, m / 100 * k]
      }
    }
    return mid
  }

  const piece = p => {
    const [x, y, w, h] = boxOf(p)
    const isFound = found.includes(p.id)
    const wobble = shake?.key === p.id
    const roll = isFound && p.type === 'circle' && !reduceMotion() && !spins.includes(p.id)
    const [cx, cy, fs] = faceSpot(p)
    const fly = moving && flies.includes(p.id)
    const drive = moving && drives.includes(p.id)
    const wave = moving && waves.includes(p.id)
    const play = wobble && shake.play && !fly && !drive && !reduceMotion()
    // it winks: in the blink round, or as a help after two misses
    const winks = !isFound && (blinkId === p.id || wink?.id === p.id)
    return (
      <motion.g key={`${p.id}-${wobble ? shake.n : 0}-${wink?.id === p.id ? wink.n : 0}`}
        role="button" aria-label={SHAPES[p.type].name} tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); const b = e.currentTarget.getBoundingClientRect(); onTap(p, { x: b.left + b.width / 2, y: b.top + b.height / 2 }) } }}
        initial={false}
        animate={play ? (p.type === 'circle' ? { rotate: [p.rot, p.rot + 360], scale: [1, 1.2, 1], y: [0, -12, 0] } : { y: [0, -20, 0], scale: [1, 1.15, 1], rotate: [p.rot, p.rot - 10, p.rot + 10, p.rot] })
          : wobble && !reduceMotion() ? { rotate: [p.rot, p.rot - 12, p.rot + 10, p.rot - 6, p.rot], scale: [1, 1.12, 1] }
          : winks ? { rotate: p.rot, scale: reduceMotion() ? 1 : [1, 1.3, 1.2, 1.3, 1] }
          : fly ? { y: [0, 12, -H - 80], rotate: [p.rot, p.rot - 10, p.rot + 15], scale: 1 }
          : drive ? { x: scene.mirror ? [0, 10, -W - 60] : [0, -10, W + 60], scale: 1, rotate: roll ? p.rot + (scene.mirror ? -720 : 720) : p.rot }
          : wave ? { rotate: [p.rot, p.rot - 18, p.rot + 16, p.rot - 12, p.rot + 10, p.rot], scale: 1 }
          : isFound ? { rotate: roll ? p.rot + 360 : p.rot, scale: [1, 1.25, 1], y: moving && !spins.includes(p.id) ? [0, -8, 0] : 0 }
          : { rotate: p.rot, scale: 1, x: 0, y: 0 }}
        transition={fly ? { duration: 1.8, delay: 0.4 + (p.id % 5) * 0.12, ease: 'easeIn' }
          : drive ? { duration: 1.6, delay: 0.6, ease: 'easeIn' }
          : wave ? { duration: 0.9, repeat: 2, delay: 0.3 }
          : winks ? { duration: 0.5 }
          : { duration: isFound && !wobble ? 0.7 : 0.55, y: solved ? { duration: 0.5, repeat: 2, delay: (p.id % 5) * 0.08 } : undefined }}
        style={{ outline: 'none' }}>
        <g fill={p.color} stroke={isFound || winks ? '#FFC93C' : INK} strokeWidth={isFound || winks ? 5 : 2.5} strokeLinejoin="round"
          style={{ filter: isFound || winks ? 'drop-shadow(0 0 6px #FFE08A)' : undefined }}>
          {boxShape(p.type, x, y, w, h)}
        </g>
        {(isFound || winks) && (
          <g transform={`translate(${cx - 50 * fs} ${cy - 50 * fs}) scale(${fs})`}>
            <Face y={SHAPES[p.type].eye} s={faceScale(p.type)} wink={winks} />
          </g>
        )}
      </motion.g>
    )
  }

  // where the hint hand points: a shape of the kind that is still hidden,
  // at a spot of it where nothing else lies (not the diamond on the wagon)
  const hidden = r.pieces.find(p => p.type === r.answer && !found.includes(p.id))
  const [hx, hy] = hidden ? faceSpot(hidden) : [W / 2, H / 2]

  return (
    <div style={{ position: 'relative', width, flexShrink: 0 }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Suchbild" onClick={tap}
        style={{
          width: '100%', height: 'auto', display: 'block', boxSizing: 'border-box', borderRadius: 22, border: `4px solid ${INK}`, boxShadow: '0 6px 0 rgba(42,27,61,0.3)',
          background: scene.sky, touchAction: 'manipulation', overflow: 'hidden', cursor: solved ? 'default' : 'pointer',
        }}>
        <g pointerEvents="none">{lay.scenery}</g>
        {/* strings go with what they hold: they never stay hanging in the air */}
        {lay.strings && <g pointerEvents="none" style={{ opacity: solved ? 0 : 1, transition: 'opacity .3s .35s' }}>{lay.strings}</g>}
        {r.pieces.map(p => {
          if (!spins.includes(p.id)) return piece(p)
          if (p.id !== spins[0]) return null
          // the big wheel turns as one thing about its hub: the wheel, its
          // spokes over it, its cabins
          const at = lay.spinAt
          return (
            <g key="spin" style={{
              transformBox: 'view-box', transformOrigin: `${at[0]}px ${at[1]}px`,
              transform: moving ? 'rotate(360deg)' : 'rotate(0deg)', transition: moving ? 'transform 3s cubic-bezier(.45,0,.3,1) .4s' : 'none',
            }}>
              {piece(p)}
              <g pointerEvents="none"><Spokes cx={at[0]} cy={at[1]} r={boxOf(p)[2] / 2 - 16} /></g>
              {spins.slice(1).map(id => piece(r.pieces[id]))}
            </g>
          )
        })}
        {lay.overlay && <g pointerEvents="none">{lay.overlay}</g>}
        {/* the ladybug (or the picture's own critter): tap it and it flies off */}
        <motion.g initial={false} animate={bugGone ? { x: 160, y: -260, opacity: 0 } : { x: 0, y: 0, opacity: 1 }}
          transition={{ duration: bugGone ? 1.2 : 0 }} onClick={flyAway} style={{ cursor: 'pointer' }}>
          <image href={artSrc(scene.critter ?? '🐞')} x={bug[0]} y={bug[1]} width="26" height="26" />
        </motion.g>
      </svg>
      <div ref={anchorRef} aria-hidden="true" style={{ position: 'absolute', left: `${hx / W * 100}%`, top: `${hy / H * 100}%`, width: 2, height: 2, pointerEvents: 'none' }} />
    </div>
  )
}

// ── The photo: the family lines up from small to big ──
// Each step shows a faint outline of the size that belongs there, so the
// order is clear without words. Tapped shapes hop onto the steps in turn;
// the camera flashes at the end. `room`: the width and height there is,
// `big`: the biggest a shape may be, `tap`: the least a finger needs. All
// of them always fit: five steps at a fixed size were wider than an upright phone.
function Photo({ r, room: [cw, ch], big, tap, picked, shake, solved, look, onPick, rowRef }) {
  const n = r.items.length
  const stepGap = 6
  const max = Math.floor(Math.min(big, ((cw - 16) / n - stepGap) / 0.9, (ch - 44 - (n - 1) * 14 - 24) / 2))
  const waiting = r.items.filter(it => !picked.includes(it.id))
  const order = picked.map(id => r.items.find(it => it.id === id))
  const wanted = [...r.sizes].sort((a, b) => (r.down ? b - a : a - b))
  const unit = s => Math.round(max * s)
  const rowGap = Math.floor(clamp((cw - 16 - r.sizes.reduce((sum, s) => sum + Math.max(tap, unit(s)), 0)) / Math.max(1, n - 1), 4, 24))
  return (
    <LayoutGroup>
      {/* the steps for the photo */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: stepGap, minHeight: max + 24 }}>
        <AnimatePresence>
          {solved && shake?.key === 'flash' && (
            <motion.div key="flash" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }}
              style={{ position: 'absolute', inset: -16, background: '#fff', borderRadius: 24, pointerEvents: 'none', zIndex: 2 }} />
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
                // the steps go the way of the order: up from small to big, down from big to small
                width: Math.round(max * 0.9), height: 20 + (r.down ? n - 1 - i : i) * 14, marginTop: 4, background: '#C98A52', border: `3px solid ${INK}`, borderRadius: 6,
                boxSizing: 'border-box', boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.25)',
              }} />
            </div>
          )
        })}
      </div>
      {/* those still waiting */}
      <div ref={rowRef} style={{ display: 'flex', alignItems: 'flex-end', gap: rowGap, minHeight: max + 4, justifyContent: 'center' }}>
        {waiting.map(it => (
          <motion.button key={it.id} layoutId={`sz${it.id}`}
            onClick={e => onPick(it, e.currentTarget)}
            aria-label={`Form ${r.sizes.slice().sort((a, b) => a - b).indexOf(it.size) + 1} von ${r.sizes.length}`}
            whileTap={{ scale: 0.92 }}
            style={{ all: 'unset', cursor: 'pointer', minWidth: tap, minHeight: tap, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
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
function Parade({ r, size, solved, look, onDrop, gapRef }) {
  return (
    <div style={{
      display: 'flex', gap: 6, alignItems: 'flex-end', padding: '14px 10px 10px', borderRadius: 20,
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
          // the free place: an empty dashed frame, no question mark
          <div ref={gapRef} style={{
            width: size, height: size, borderRadius: 14, boxSizing: 'border-box', padding: 3,
            border: solved ? 'none' : `3px dashed ${hover ? '#FFC93C' : INK}`, background: hover ? 'rgba(255,201,60,0.3)' : 'rgba(255,253,247,0.6)',
          }}>
            {solved && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1, y: [0, -18, 0] }} transition={{ delay: r.seq.length * 0.12 }} style={{ width: '100%', height: '100%' }}>
                <Shape type={r.correct.type} color={r.correct.color} size="100%" face />
              </motion.div>
            )}
          </div>
        )}
      </DropZone>
    </div>
  )
}
