import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { customArtSrc } from '../lib/emojiArt.jsx'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Art, RoundTrail, HintHand, useBursts } from '../components/play/index.js'
import { INK } from './px.js'

/**
 * Planeten-Taxi — Addieren und Subtrahieren am Zahlenstrahl
 *
 * A little alien calls the space taxi; its speech bubble holds the sum
 * ("4 + 2 = ?"). The planets in a row are the number line. The child taps
 * the planet, the rocket starts and hops planet by planet, each hop drawn
 * as a gold arc with its number, and the alien climbs in and cheers. Minus
 * flies backwards. In the top levels the alien waves from its planet and
 * the child picks how many hops the rocket needs. At the end of the level
 * the taxi takes all its passengers to the moon.
 *
 * Everything is shown, nothing needs listening: a wrong planet has someone
 * else living on it, the number to count pulses, and an arrow points the
 * way when the rocket would fly the wrong way.
 *
 * Scientific basis:
 *   • Mental number line (Siegler & Ramani, 2009) — board-game-like movement
 *     along a left-to-right number line measurably improves later arithmetic;
 *     the rocket hops one field per unit so the operation is a movement, not
 *     a memorised fact.
 *   • Concrete-Pictorial-Abstract (Bruner) — the ten frame carries the early
 *     levels and is withdrawn once the line alone suffices.
 *   • Missing-addend problems (Carpenter & Moser) — "3 + ? = 5" demands a
 *     different, harder mental action than "3 + 2 = ?" and comes last.
 */

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

// L1-3  plus, ten frame (steps 2, 3, 5)  L4  plus, no ten frame
// L5    minus                            L6  plus and minus mixed
// L7    plus up to 20 (across the ten)   L8  minus up to 20 (across the ten)
// L9    missing addend up to 10          L10 missing addend up to 20
// The range of twenty used to arrive together with the missing addend; now
// it comes with plain plus and minus first.
function levelPlan(level) {
  if (level <= 1)  return { max: 10, kind: 'add',     maxStep: 2, frame: true }
  if (level <= 2)  return { max: 10, kind: 'add',     maxStep: 3, frame: true }
  if (level <= 3)  return { max: 10, kind: 'add',     maxStep: 5, frame: true }
  if (level <= 4)  return { max: 10, kind: 'add',     maxStep: 5, frame: false }
  if (level <= 5)  return { max: 10, kind: 'sub',     maxStep: 5, frame: false }
  if (level <= 6)  return { max: 10, kind: 'mixed',   maxStep: 5, frame: false }
  if (level <= 7)  return { max: 20, kind: 'add',     maxStep: 5, frame: false, cross: true }
  if (level <= 8)  return { max: 20, kind: 'sub',     maxStep: 5, frame: false, cross: true }
  if (level <= 9)  return { max: 10, kind: 'missing', maxStep: 5, frame: false }
  return             { max: 20, kind: 'missing', maxStep: 6, frame: false }
}

function makeTask(p, i) {
  const kind = p.kind === 'mixed' ? (i % 2 ? 'sub' : 'add') : p.kind
  // Every other task crosses the ten (8 + 5, 13 − 5) where the range allows it.
  const cross = p.cross && i % 2 === 0
  if (kind === 'sub') {
    const step = rand(cross ? 2 : 1, p.maxStep)
    const from = cross ? rand(11, Math.min(p.max, 9 + step)) : rand(step + (p.max > 10 ? 10 : 0), p.max)
    return { from, step, target: from - step, op: '−', kind }
  }
  if (kind === 'missing') {
    const from = rand(p.max > 10 ? 4 : 0, p.max - 2)
    const room = Math.min(p.maxStep, p.max - from)
    const step = rand(Math.min(2, room), room)
    return { from, step, target: from + step, op: '+', kind }
  }
  const step = rand(cross ? 2 : 1, p.maxStep)
  const from = cross ? rand(Math.max(4, 11 - step), 9) : rand(p.max > 10 ? 10 : 0, p.max - step)
  return { from, step, target: from + step, op: '+', kind }
}

// Each alien has its own colour, and each planet someone else at home
const ALIEN_COLORS = ['#5CC45A', '#FF8FB8', '#4AA3FF', '#FFA94D', '#B78CF2', '#3FC1A8']
// The alien picture is green; each task's alien is tinted by turning its hue
const ALIEN_HUE = { '#5CC45A': 0, '#FF8FB8': 230, '#4AA3FF': 105, '#FFA94D': 290, '#B78CF2': 160, '#3FC1A8': 55 }
const RESIDENTS = ['🐙', '🤖', '🐌', '🐢', '🦀', '🐸']
const PLANET_COLORS = ['#FF8A65', '#4FC3F7', '#FFD54F', '#AED581', '#CE93D8', '#F48FB1', '#80CBC4']

function buildTasks(level, count = 8) {
  const p = levelPlan(level)
  const out = [], seen = new Set()
  let guard = 0
  while (out.length < count && guard++ < 400) {
    const t = makeTask(p, out.length)
    const key = `${t.from}${t.op}${t.step}`
    // No task twice in one level ("8 + 1" came up twice in a row).
    if (seen.has(key) && guard < 300) continue
    seen.add(key)
    // r places the visible part of the number line (see below), fixed per task
    out.push({ ...t, r: Math.random(), color: ALIEN_COLORS[out.length % ALIEN_COLORS.length] })
  }
  return out
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ── The alien ────────────────────────────────────────────────────────────────
// Drawn here: no picture in the emoji set shows one. A round little body,
// two antennae, big eyes and an arm that waves; it jumps when it is happy
// and tilts its head when something went wrong.
function Alien({ size = 110, color = '#5CC45A', mood = 'idle', onTap, label }) {
  const anim = reduceMotion() ? {}
    : mood === 'happy' ? { y: [0, -size * 0.35, 0, -size * 0.15, 0], rotate: [0, -8, 8, 0, 0], transition: { duration: 1 } }
    : mood === 'oops'  ? { rotate: [0, -12, 9, -5, 0], y: 0, transition: { duration: 0.8 } }
    : { y: [0, -size * 0.03, 0], rotate: 0, transition: { duration: 2.2, repeat: Infinity } }
  return (
    <motion.button type="button" onClick={onTap} aria-label={label} tabIndex={label ? 0 : -1} animate={anim}
      style={{ all: 'unset', cursor: onTap ? 'pointer' : 'default', width: size, height: size, display: 'block', transformOrigin: '50% 100%', flexShrink: 0 }}>
      <img src={customArtSrc('alien')} alt="" draggable={false}
        style={{ width: size, height: size, display: 'block', objectFit: 'contain', filter: `hue-rotate(${ALIEN_HUE[color] ?? 0}deg) drop-shadow(0 4px 0 rgba(42,27,61,0.25))` }} />
    </motion.button>
  )
}

// ── Ten frame ────────────────────────────────────────────────────────────────
// The sum as blocks: the start in purple, what is added in gold.
function TenFrame({ filled, added }) {
  return (
    <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, width: 'clamp(130px,26vw,190px)' }}>
      {Array.from({ length: 10 }, (_, i) => {
        const isBase  = i < filled
        const isAdded = i >= filled && i < filled + added
        return (
          <motion.div key={i} initial={false} animate={{ scale: isAdded ? [1, 1.25, 1] : 1 }} transition={{ delay: (i - filled) * 0.08 }}
            style={{
              aspectRatio: '1', borderRadius: 5, border: `2px solid ${INK}`,
              background: isBase ? 'var(--px-purple)' : isAdded ? 'var(--px-gold)' : '#FFFDF7',
              boxShadow: 'inset 0 -3px 0 rgba(42,27,61,0.18)',
            }} />
        )
      })}
    </div>
  )
}

// One number of the sum, on a block
function NumBlock({ children, color = '#FFFDF7', small, plain, pulse }) {
  return (
    <motion.span key={pulse || 'still'} animate={pulse && !reduceMotion() ? { scale: [1, 1.3, 1, 1.3, 1] } : {}} transition={{ duration: 1.2 }}
      style={{
      minWidth: plain ? 0 : small ? 42 : 54, height: small ? 48 : 58, padding: plain ? 0 : '0 6px', boxSizing: 'border-box', borderRadius: 12,
      background: plain ? 'none' : color, border: plain ? 'none' : `3px solid ${INK}`, boxShadow: plain ? 'none' : '0 4px 0 rgba(42,27,61,0.35)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: small ? 30 : 38, color: INK,
    }}>{children}</motion.span>
  )
}

// A planet of the number line: a ball with its number, a ring on some
function Planet({ n, size, state }) {
  const c = PLANET_COLORS[n % PLANET_COLORS.length]
  const ring = n % 3 === 1
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {state === 'right' && <circle cx="50" cy="50" r="58" fill="#FFC93C" opacity="0.45" />}
      {ring && <ellipse cx="50" cy="56" rx="60" ry="14" fill="none" stroke={INK} strokeWidth="9" transform="rotate(-14 50 56)" />}
      {ring && <ellipse cx="50" cy="56" rx="60" ry="14" fill="none" stroke="#FFE08A" strokeWidth="5" transform="rotate(-14 50 56)" />}
      <circle cx="50" cy="50" r="44" fill={state === 'tried' ? '#9A8FB0' : c} stroke={INK} strokeWidth="5" />
      <circle cx="34" cy="34" r="10" fill="#fff" opacity="0.35" />
      <circle cx="66" cy="70" r="6" fill="#000" opacity="0.1" />
      <text x="50" y="65" textAnchor="middle" fontSize="44" fontWeight="800" fill={INK}
        stroke="#fff" strokeWidth="6" paintOrder="stroke" fontFamily="var(--font-heading, system-ui)">{n}</text>
    </svg>
  )
}

const MIN_CELL = 46, GAP = 2   // smallest field and gap on the number line
const SIDE = 12                 // room at both ends, so the turned rocket is never cut off
const HOP_MS = 520              // one hop of the rocket

export default function RocketMathGame({ level = 1, onComplete }) {
  const plan  = useMemo(() => levelPlan(level), [level])
  const tasks = useState(() => buildTasks(level))[0]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const [idx,     setIdx]     = useState(0)
  const [pos,     setPos]     = useState(() => tasks[0]?.from ?? 0)
  const [picked,  setPicked]  = useState(null)
  const [wrong,   setWrong]   = useState([])
  const [misses,  setMisses]  = useState(0)      // on the current task
  const [shown,   setShown]   = useState(false)  // the rocket already flew ahead
  const [mood,    setMood]    = useState('idle')
  const [hopping, setHopping] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [trail,   setTrail]   = useState([])     // the hops so far: [{ from, to }]
  const [ghost,   setGhost]   = useState(null)   // a wrong number of hops, shown dashed
  const [aboard,  setAboard]  = useState(false)  // the alien got in
  const [resident, setResident] = useState(null) // { n, art } peeking out of a wrong planet
  const [arrow,   setArrow]   = useState(null)   // 1 / -1: the way the rocket has to fly
  const [pulse,   setPulse]   = useState(null)   // the number block to look at again
  const [streak,  setStreak]  = useState(0)      // right on the first try in a row
  const [riders,  setRiders]  = useState([])     // the aliens picked up so far
  const [ending,  setEnding]  = useState(false)
  const [lineW,   setLineW]   = useState(0)
  const [bursts, burst] = useBursts()
  const firstTry = useRef(0)                     // tasks right on the first try
  const timers   = useRef([])
  const lineRef  = useRef(null)
  const rowRef   = useRef(null)
  const jumpsRef = useRef(null)

  const t = tasks[idx]
  const missing = t?.kind === 'missing'

  // Timers of the task: they wait while the help is open and end with it
  const later = useCallback((fn, ms) => {
    const run = () => { if (pausedRef.current) timers.current.push(setTimeout(run, 250)); else fn() }
    timers.current.push(setTimeout(run, ms))
  }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // The number line fits the width it has. It used to be one scrolling row:
  // on a phone the outer fields were cut off and unreachable, and every field
  // was only 26 px wide.
  useLayoutEffect(() => {
    const el = lineRef.current
    if (!el) return
    const measure = () => setLineW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Which fields to show: all of them if they fit, otherwise a stretch that
  // holds the start and the landing field with at least one field beyond
  // it — the landing field is never simply the last one.
  const span = useMemo(() => {
    if (!t) return [0, 0]
    const total = plan.max + 1
    const fit = Math.max(1, Math.floor((lineW + GAP) / (MIN_CELL + GAP)))
    if (!lineW || fit >= total) return [0, plan.max]
    const lo = Math.min(t.from, t.target), hi = Math.max(t.from, t.target)
    const need = hi - lo + 1
    const len = Math.max(need, Math.min(fit, total))
    const spare = len - need
    const beyond = spare > 0 ? 1 + Math.floor(t.r * spare) : 0
    let start = t.target >= t.from ? lo - (spare - beyond) : lo - beyond
    start = Math.max(0, Math.min(start, plan.max - len + 1))
    return [start, start + len - 1]
  }, [t, lineW, plan.max])

  // New task: everything back, the taxi whooshes to the starting planet.
  // A layout effect, so the new task is never painted with the last one's
  // state (the new alien used to play the last one's boarding).
  useLayoutEffect(() => {
    if (!t) return
    timers.current.forEach(clearTimeout); timers.current = []
    setPos(t.from)
    setPicked(null); setWrong([]); setMisses(0); setShown(false)
    setAboard(false); setResident(null); setArrow(null); setPulse(null)
    setTrail([]); setGhost(null); setHopping(false); setLaunching(false)
    setMood('idle')
    if (idx > 0) sfx.whoosh()
    lockPreviews()
    sayTask()
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fly the rocket field by field: the engine roars first (a short shake),
  // then one hop after the other, each drawn as an arc with its number —
  // counting on is what the number line is for.
  const hopTo = useCallback((from, to, done) => {
    setHopping(true)
    setLaunching(true)
    setTrail([])
    sfx.whoosh()
    const dir = to > from ? 1 : -1
    let cur = from
    const stepOnce = () => {
      setLaunching(false)
      if (cur === to) { setHopping(false); done?.(); return }
      const prev = cur
      cur += dir
      setPos(cur)
      setTrail(tr => [...tr, { from: prev, to: cur }])
      sfx.boing()
      later(stepOnce, HOP_MS)
    }
    later(stepOnce, 650)
  }, [later])

  const nextTask = useCallback(() => {
    if (idx + 1 < tasks.length) { setIdx(i => i + 1); return }
    // the end of the level: the taxi takes everybody to the moon
    setEnding(true)
    sfx.slideUp()
    later(() => {
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry.current, tasks.length)), { minMs: 600 })
    }, 2000)
  }, [idx, tasks.length, onComplete, later])

  // The alien climbs in and cheers, then the next call comes by itself
  // once the pick-up was seen
  const finishTask = useCallback((alreadyThere) => {
    setPicked(missing ? t.step : t.target)
    setArrow(null); setPulse(null)
    const first = misses === 0
    if (first) firstTry.current++
    const s = first ? streak + 1 : 0
    setStreak(s)
    const end = () => {
      setAboard(true)
      setMood('happy')
      setRiders(r => [...r, t.color])
      sfx.correct()
      sfx.slideUp()
      const r = lineRef.current.getBoundingClientRect()
      burst({ x: r.left + r.width * (t.target - span[0] + 0.5) / (span[1] - span[0] + 1), y: r.top + r.height * 0.6 }, s >= 3 ? 'confetti' : 'stars', s >= 3 ? 18 : 10)
      sayRight()
      afterNarration(() => later(nextTask, 0), { minMs: s >= 3 ? 2300 : 1900 })
    }
    if (alreadyThere) end()
    else hopTo(t.from, t.target, end)
  }, [t, missing, misses, streak, span, hopTo, burst, later, nextTask])

  // After two misses the rocket flies ahead with its arcs, then waits there
  // for the child to answer — tapping every field in turn taught nothing.
  const showTheWay = useCallback(() => {
    setShown(true)
    setPos(t.from)
    later(() => hopTo(t.from, t.target), 900)
  }, [t, hopTo, later])

  const miss = useCallback((n) => {
    setWrong(w => w.includes(n) ? w : [...w, n])
    const m = misses + 1
    setMisses(m)
    setStreak(0)
    setMood('oops')
    sfx.boing()
    sayWrong()
    later(() => setMood('idle'), 900)
    if (m >= 2 && !shown) showTheWay()
  }, [misses, shown, showTheWay, later])

  // Tap on a planet: where does the rocket land? Someone else lives on a
  // wrong one and peeks out, puzzled; the way to fly or the number to count
  // is pointed out.
  const pickField = useCallback((n) => {
    if (picked !== null || hopping || !t || missing) return
    if (n === t.target) { finishTask(pos === t.target); return }
    // Which way is "too far" depends on the direction: at minus the rocket
    // flies left, and a field above the result is not far enough.
    const dir = t.op === '+' ? 1 : -1
    setResident({ n, art: RESIDENTS[n % RESIDENTS.length], k: Date.now() })
    later(() => setResident(r => (r?.n === n ? null : r)), 1600)
    if ((n - t.from) * dir <= 0) { setArrow(dir); later(() => setArrow(null), 2200) }
    else setPulse(Date.now())
    miss(n)
  }, [picked, hopping, t, missing, pos, finishTask, miss, later])

  // Missing addend: how many jumps from the start to the alien? A wrong
  // number shows its hops dashed, landing short of the alien or past it.
  const pickJumps = useCallback((k) => {
    if (picked !== null || hopping || !t || !missing) return
    if (k === t.step) { finishTask(pos === t.target); return }
    setGhost({ k, at: Date.now() })
    later(() => setGhost(g => (g?.k === k ? null : g)), 1800)
    miss(k)
  }, [picked, hopping, t, missing, pos, finishTask, miss, later])

  if (!t) return null
  const line = Array.from({ length: span[1] - span[0] + 1 }, (_, i) => span[0] + i)
  const done = picked !== null
  const narrow = lineW > 0 && lineW < 520
  const cellW = lineW ? (lineW - GAP * (line.length - 1)) / line.length : MIN_CELL
  const planetPx = Math.max(MIN_CELL - 2, Math.min(cellW - 2, 80))
  const rocketPx = Math.max(44, Math.min(cellW * (narrow ? 1 : 1.15), 86))
  const frac = n => (n - span[0] + 0.5) / line.length
  const at = n => `${frac(n) * 100}%`
  // The rocket points the way it is going, up while it waits (the picture
  // points up and to the right; mirrored it flies left)
  const back = (hopping || done) && t.target < t.from
  const heading = !hopping && !done ? -45 : 45
  // waves around the row, so it looks like a path through space
  const lift = n => (n % 2 ? -10 : 8)
  const top = rocketPx + 30           // where the planets start in the line box
  // the hops to draw: the flight so far, or a wrong number of hops dashed
  const ghostHops = ghost ? Array.from({ length: ghost.k }, (_, i) => ({ from: t.from + i, to: t.from + i + 1 })).filter(h => h.to <= span[1]) : []

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(10px,2vw,22px) clamp(8px,3vw,28px)', gap: 'clamp(10px,2vw,20px)',
    }}>
      {bursts}
      {!ending && (missing
        ? <HintHand to={jumpsRef} delay={idx === 0 ? 2000 : 6000} active={!done && !hopping} />
        : <HintHand to={rowRef} delay={idx === 0 ? 2000 : 6000} active={!done && !hopping} />)}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 720 }}>
        <RoundTrail total={tasks.length} done={idx + (done ? 1 : 0)} walker="🚀" goal="🌕" style={{ flex: 1 }} />
      </div>

      {/* The alien calls the taxi; its speech bubble holds the sum */}
      <div style={{ flex: 1, display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: narrow ? 18 : 'clamp(8px,2vw,20px)', width: '100%', maxWidth: 720 }}>
        <AnimatePresence mode="wait">
          {/* once picked up, the alien jumps out of the call and rides the taxi */}
          <motion.div key={idx} initial={{ x: -60, opacity: 0, rotate: -20 }}
            animate={aboard && !reduceMotion() ? { y: [0, -40, 160], scale: [1, 1.1, 0.2], opacity: [1, 1, 0], rotate: 0 } : { x: 0, y: 0, scale: 1, opacity: aboard ? 0 : 1, rotate: 0 }}
            exit={{ y: -80, opacity: 0 }}
            transition={aboard ? { duration: 0.7, ease: 'easeIn' } : { type: 'spring', stiffness: 220, damping: 16 }}>
            <Alien size={narrow ? 100 : 130} color={t.color} mood={mood} label="Alien" onTap={() => { sfx.giggle(); setMood('happy'); later(() => setMood('idle'), 1000) }} />
          </motion.div>
        </AnimatePresence>
        <motion.div key={`b${idx}`} initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.2 }}
          style={{
            position: 'relative', background: '#FFFDF7', border: `3px solid ${INK}`, borderRadius: 22,
            boxShadow: '0 6px 0 rgba(0,0,0,0.3)', padding: 'clamp(10px,2vw,16px) clamp(12px,2.4vw,22px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
          }}>
          <span aria-hidden="true" style={narrow
            ? { position: 'absolute', top: -15, left: '50%', marginLeft: -11, borderStyle: 'solid', borderWidth: '0 11px 15px 11px', borderColor: `transparent transparent ${INK} transparent` }
            : { position: 'absolute', left: -15, top: '50%', marginTop: -11, borderStyle: 'solid', borderWidth: '11px 15px 11px 0', borderColor: `transparent ${INK} transparent transparent` }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(4px,1.2vw,10px)' }}
            aria-label={`${t.from} ${t.op} ${missing ? '?' : t.step} = ${missing ? t.target : '?'}`}>
            <NumBlock small={narrow} color="#D9CCFF">{t.from}</NumBlock>
            <NumBlock small={narrow} plain>{t.op}</NumBlock>
            <NumBlock small={narrow} color={missing ? (aboard ? '#FFE08A' : '#FFFDF7') : '#FFE08A'} pulse={missing ? null : pulse}>{missing && !aboard ? '?' : t.step}</NumBlock>
            <NumBlock small={narrow} plain>=</NumBlock>
            <NumBlock small={narrow} color={missing || aboard ? '#C8F0C0' : '#FFFDF7'}>{missing || aboard ? t.target : '?'}</NumBlock>
          </div>
          {plan.frame && <TenFrame filled={t.from} added={aboard ? t.step : 0} />}
        </motion.div>
      </div>

      {/* The planets: the number line through space */}
      <div style={{ width: '100%', maxWidth: 1000, padding: `0 ${SIDE}px`, boxSizing: 'border-box' }}>
      <div ref={lineRef} style={{ position: 'relative', width: '100%', paddingTop: top, boxSizing: 'border-box' }}>
        {/* dotted flight path */}
        <div aria-hidden="true" style={{ position: 'absolute', left: at(span[0]), right: `calc(100% - ${at(span[1])})`, top: top + planetPx / 2, borderTop: '4px dotted rgba(255,255,255,0.45)' }} />
        {/* the hops: gold arcs with their number, or a wrong count dashed */}
        <svg aria-hidden="true" viewBox="0 0 1000 100" preserveAspectRatio="none"
          style={{ position: 'absolute', left: 0, top: top - 34, width: '100%', height: 46, overflow: 'visible', pointerEvents: 'none' }}>
          {[...trail.map(h => ({ ...h, gold: true })), ...ghostHops].map((h, i) => {
            const x1 = frac(h.from) * 1000, x2 = frac(h.to) * 1000
            return (
              <motion.path key={`${h.gold ? 'g' : 'd'}${i}`} d={`M${x1} 96 Q${(x1 + x2) / 2} ${-40} ${x2} 96`} fill="none"
                stroke={h.gold ? '#FFC93C' : '#D9CCFF'} strokeWidth="4" strokeDasharray={h.gold ? undefined : '6 6'} strokeLinecap="round"
                vectorEffect="non-scaling-stroke" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: h.gold ? 0.35 : 0.25, delay: h.gold ? 0 : i * 0.15 }} />
            )
          })}
        </svg>
        {[...trail.map(h => ({ ...h, gold: true })), ...ghostHops].map((h, i) => (
          <motion.span key={`n${h.gold ? 'g' : 'd'}${i}`} aria-hidden="true" initial={{ scale: 0, y: 6 }} animate={{ scale: 1, y: 0 }}
            style={{
              position: 'absolute', left: `${(frac(h.from) + frac(h.to)) * 50}%`, top: top - 58, width: 26, height: 26, marginLeft: -13,
              borderRadius: '50%', background: h.gold ? '#FFC93C' : '#D9CCFF', border: `2px solid ${INK}`, boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 15, color: INK, pointerEvents: 'none',
            }}>{(h.gold ? i : i - trail.length) + 1}</motion.span>
        ))}
        {/* where the hint hand taps: the row, between two planets, so it
            never points at the answer */}
        <span ref={rowRef} aria-hidden="true" style={{ position: 'absolute', left: `${(frac(span[0]) + frac(span[1])) * 50 + 50 / line.length}%`, top: top + planetPx * 0.75, width: 2, height: 2 }} />
        <div style={{ display: 'flex', gap: GAP }}>
          {line.map(n => {
            const isWrong = !missing && wrong.includes(n)
            const state = done && n === t.target ? 'right' : isWrong ? 'tried' : undefined
            const Cell = missing ? 'div' : motion.button
            const landed = trail.length && trail[trail.length - 1].to === n
            return (
              <div key={n} style={{ position: 'relative', flex: '1 1 0', minWidth: 0, display: 'flex', justifyContent: 'center', transform: `translateY(${lift(n)}px)` }}>
                <Cell
                  {...(!missing && {
                    whileTap: !done && !hopping ? { scale: 0.8 } : {},
                    onClick: () => pickField(n),
                    'aria-label': `Planet ${n}`,
                  })}
                  style={{ all: 'unset', cursor: missing || done || hopping ? 'default' : 'pointer', width: planetPx, height: planetPx, display: 'block' }}>
                  <motion.div key={landed ? `l${trail.length}` : 'p'} animate={landed && !reduceMotion() ? { scaleY: [1, 0.8, 1.08, 1], scaleX: [1, 1.15, 0.95, 1] } : {}} transition={{ duration: 0.35 }}>
                    <Planet n={n} size={planetPx} state={state} />
                  </motion.div>
                </Cell>
                {/* the alien waits on its planet when the planet is known */}
                {missing && n === t.target && !aboard && (
                  <div style={{ position: 'absolute', bottom: planetPx * 0.7, left: '50%', marginLeft: -planetPx * 0.45, pointerEvents: 'none' }}>
                    <Alien size={planetPx * 0.9} color={t.color} mood="idle" />
                  </div>
                )}
                {/* someone else lives on a wrong planet */}
                <AnimatePresence>
                  {resident?.n === n && (
                    <motion.div key={`r${resident.k}`} aria-hidden="true"
                      initial={{ y: 20, scale: 0, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1, rotate: [0, -12, 12, -8, 0] }} exit={{ y: 20, scale: 0, opacity: 0 }}
                      transition={{ duration: 0.6 }}
                      style={{ position: 'absolute', bottom: planetPx * 0.72, left: '50%', marginLeft: -planetPx * 0.55, pointerEvents: 'none' }}>
                      <Art art={resident.art} size={planetPx * 1.1} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </div>

        {/* the taxi */}
        <motion.div aria-hidden="true" initial={false}
          animate={ending && !reduceMotion() ? { left: '115%', y: -500, opacity: 0 } : { left: at(pos), y: 0, opacity: 1 }}
          transition={ending ? { duration: 1.8, ease: 'easeIn' } : { type: 'spring', stiffness: hopping ? 260 : 120, damping: hopping ? 22 : 18 }}
          style={{ position: 'absolute', top: 6 + lift(pos), width: rocketPx, height: rocketPx, marginLeft: -rocketPx / 2, pointerEvents: 'none', zIndex: 2 }}>
          <motion.div key={trail.length} animate={trail.length && !reduceMotion() ? { y: [0, -rocketPx * 0.45, 0] } : {}} transition={{ duration: 0.4 }}>
            <motion.div initial={false}
              animate={launching && !reduceMotion() ? { x: [0, -4, 4, -4, 4, 0], rotate: heading, scaleX: back ? -1 : 1 }
                : aboard && streak >= 3 && !reduceMotion() ? { x: 0, rotate: [heading, heading + 360], scaleX: back ? -1 : 1 }
                : { x: 0, rotate: ending ? 45 : heading, scaleX: back && !ending ? -1 : 1 }}
              transition={{ duration: aboard && streak >= 3 ? 0.8 : 0.3, repeat: launching ? 1 : 0 }}>
              <Art art="🚀" size={rocketPx} />
            </motion.div>
          </motion.div>
          {/* the alien rides along once picked up */}
          <AnimatePresence>
            {aboard && (
              <motion.div key="rider" initial={{ y: rocketPx, scale: 0 }} animate={{ y: [rocketPx, -rocketPx * 0.9, -rocketPx * 0.45], scale: [0, 1, 0.7] }}
                transition={{ duration: 0.8 }}
                style={{ position: 'absolute', left: rocketPx * 0.05, top: 0 }}>
                <Alien size={rocketPx * 0.8} color={t.color} mood="happy" />
              </motion.div>
            )}
          </AnimatePresence>
          {/* the way to fly, after a planet the wrong way round */}
          <AnimatePresence>
            {arrow && (
              <motion.div key={`a${arrow}`} initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, arrow * 18, 0, arrow * 18, 0] }} exit={{ opacity: 0 }}
                transition={{ duration: 1.4 }}
                style={{ position: 'absolute', top: rocketPx * 0.2, [arrow > 0 ? 'left' : 'right']: rocketPx * 1.05 }}>
                <svg width={rocketPx * 0.75} height={rocketPx * 0.6} viewBox="0 0 40 32" style={{ transform: arrow < 0 ? 'scaleX(-1)' : undefined, display: 'block' }}>
                  <path d="M3 11 H22 V3 L37 16 L22 29 V21 H3 Z" fill="#FFC93C" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
                </svg>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>

      </div>

      {/* Missing addend: the answer is the number of jumps, in one row */}
      <div style={{ minHeight: 80, display: 'flex', alignItems: 'center' }}>
        {missing && !done && (
          <div style={{ position: 'relative', display: 'flex', gap: narrow ? 6 : 12, flexWrap: 'nowrap', justifyContent: 'center' }}>
            {/* the hint hand taps below the row, between two buttons: never on one */}
            <span ref={jumpsRef} aria-hidden="true" style={{ position: 'absolute', left: plan.maxStep % 2 ? `${50 + 50 / plan.maxStep}%` : '50%', top: '112%', width: 2, height: 2 }} />
            {Array.from({ length: plan.maxStep }, (_, i) => i + 1).map(k => {
              const isWrong = wrong.includes(k)
              return (
                <motion.button key={k}
                  whileTap={!hopping && !isWrong ? { scale: 0.88 } : {}}
                  onClick={() => pickJumps(k)}
                  aria-label={`${k} Sprünge`}
                  style={{
                    width: narrow ? Math.min(52, Math.floor((lineW + 2 * SIDE - 6 * (plan.maxStep - 1)) / plan.maxStep)) : 66, height: 72, padding: 0, borderRadius: 16, cursor: hopping || isWrong ? 'default' : 'pointer',
                    background: isWrong ? '#9A8FB0' : '#FFFDF7', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(0,0,0,0.35)',
                    opacity: isWrong ? 0.55 : 1, color: INK,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30, lineHeight: 1 }}>{k}</span>
                  {/* one little hop arc per jump */}
                  <svg width={Math.min(narrow ? 44 : 56, 10 * k)} height="10" viewBox={`0 0 ${10 * k} 10`} aria-hidden="true">
                    {Array.from({ length: k }, (_, j) => <path key={j} d={`M${j * 10 + 1} 9 Q${j * 10 + 5} 0 ${j * 10 + 9} 9`} fill="none" stroke="#FF8A3D" strokeWidth="2.5" />)}
                  </svg>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>

      {/* the passengers so far, waving from the taxi rank */}
      <div aria-hidden="true" style={{ display: 'flex', gap: 2, minHeight: 34, marginTop: -8 }}>
        {riders.map((c, i) => (
          <motion.div key={i} initial={{ y: -30, scale: 0 }}
            animate={ending && !reduceMotion() ? { y: -600, x: 400, scale: 0.6 } : { y: 0, scale: 1 }}
            transition={ending ? { duration: 1.6, delay: 0.2 + i * 0.06, ease: 'easeIn' } : { type: 'spring', stiffness: 300, damping: 14 }}>
            <Alien size={40} color={c} mood="idle" />
          </motion.div>
        ))}
      </div>
    </div>
  )
}
