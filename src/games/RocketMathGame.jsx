import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { hearable } from '../lib/hearable.js'
import { Art, RoundTrail, useBursts } from '../components/play/index.js'
import { INK } from './px.js'

/**
 * Planeten-Taxi — Addieren und Subtrahieren am Zahlenstrahl
 *
 * A little alien calls the space taxi: "Hol mich ab! Ich warte auf
 * Planet vier plus zwei." The planets in a row are the number line. The
 * child taps the planet, the rocket starts and hops planet by planet while
 * the voice counts on, and the alien climbs in and cheers. Minus flies
 * backwards. In the top levels the alien waves from its planet and the
 * child picks how many hops the rocket needs.
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
const N = sayNumber

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
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ overflow: 'visible', display: 'block' }}>
        <ellipse cx="50" cy="96" rx="26" ry="4" fill="rgba(0,0,0,0.25)" />
        {/* antennae */}
        <path d="M38 30 Q32 14 26 10 M62 30 Q68 14 74 10" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />
        <circle cx="26" cy="10" r="6" fill="#FFC93C" stroke={INK} strokeWidth="2.5" />
        <circle cx="74" cy="10" r="6" fill="#FFC93C" stroke={INK} strokeWidth="2.5" />
        {/* the waving arm, behind the body */}
        <motion.g animate={mood === 'idle' && !reduceMotion() ? { rotate: [0, -35, 0, -35, 0] } : { rotate: mood === 'happy' ? -50 : 0 }}
          transition={{ duration: 1.4, repeat: mood === 'idle' ? Infinity : 0, repeatDelay: 1 }}
          style={{ originX: '78px', originY: '62px' }}>
          <path d="M76 62 Q92 52 94 36" stroke={INK} strokeWidth="10" fill="none" strokeLinecap="round" />
          <path d="M76 62 Q92 52 94 36" stroke={color} strokeWidth="5.5" fill="none" strokeLinecap="round" />
        </motion.g>
        <path d="M24 62 Q10 70 10 82" stroke={INK} strokeWidth="10" fill="none" strokeLinecap="round" />
        <path d="M24 62 Q10 70 10 82" stroke={color} strokeWidth="5.5" fill="none" strokeLinecap="round" />
        {/* body */}
        <path d="M50 26 C76 26 84 50 82 70 C80 88 68 94 50 94 C32 94 20 88 18 70 C16 50 24 26 50 26Z" fill={color} stroke={INK} strokeWidth="3.5" />
        <ellipse cx="50" cy="78" rx="18" ry="11" fill="#fff" opacity="0.35" />
        {/* eyes that blink */}
        <g className="pl-blink">
          <ellipse cx="39" cy="52" rx="9" ry="11" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <ellipse cx="61" cy="52" rx="9" ry="11" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <circle cx="41" cy="54" r="4.5" fill={INK} />
          <circle cx="63" cy="54" r="4.5" fill={INK} />
          <circle cx="42.5" cy="52" r="1.5" fill="#fff" />
          <circle cx="64.5" cy="52" r="1.5" fill="#fff" />
        </g>
        {mood === 'oops'
          ? <ellipse cx="50" cy="72" rx="5" ry="4" fill={INK} />
          : <path d="M40 68 Q50 78 60 68" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" />}
        <circle cx="30" cy="64" r="4" fill="#FF6B9A" opacity="0.6" />
        <circle cx="70" cy="64" r="4" fill="#FF6B9A" opacity="0.6" />
      </svg>
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
function NumBlock({ children, color = '#FFFDF7', small, plain }) {
  return (
    <span style={{
      minWidth: plain ? 0 : small ? 42 : 54, height: small ? 48 : 58, padding: plain ? 0 : '0 6px', boxSizing: 'border-box', borderRadius: 12,
      background: plain ? 'none' : color, border: plain ? 'none' : `3px solid ${INK}`, boxShadow: plain ? 'none' : '0 4px 0 rgba(42,27,61,0.35)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: small ? 30 : 38, color: INK,
    }}>{children}</span>
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

const MIN_CELL = 44, GAP = 2   // smallest field and gap on the number line

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
  const firstTry = useRef(0)                     // tasks right on the first try
  const [shown,   setShown]   = useState(false)  // the rocket already flew ahead
  const [mood,    setMood]    = useState('idle')
  const [hopping, setHopping] = useState(false)
  const [hops,    setHops]    = useState(0)      // a new hop, for the jump
  const [launching, setLaunching] = useState(false)
  const [aboard,  setAboard]  = useState(false)  // the alien got in
  const [resident, setResident] = useState(null) // { n, art } peeking out of a wrong planet
  const [lineW,   setLineW]   = useState(0)
  const [bursts, burst] = useBursts()
  const hopTimer = useRef(null)
  const lineRef  = useRef(null)

  const t = tasks[idx]
  const missing = t?.kind === 'missing'

  useEffect(() => () => clearTimeout(hopTimer.current), [])

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

  // Which fields to show: all of them if they fit at 44 px, otherwise a
  // stretch that holds the start and the landing field with at least one
  // field beyond it — the landing field is never simply the last one.
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

  const taskSpeech = useCallback(task => task.kind === 'missing'
    ? `Ich warte auf Planet ${N(task.target)}! Die Rakete steht auf ${N(task.from)}. ${N(task.from)} plus wie viel ergibt ${N(task.target)}? Wie viele Sprünge braucht die Rakete?`
    // Numbers are spelled out for the voice: a digit right before a period is
    // read as an ordinal in German — "4 plus 2." came out as "vier plus zweite".
    : `Hol mich ab! Ich warte auf Planet ${N(task.from)} ${task.op === '+' ? 'plus' : 'minus'} ${N(task.step)}. Wo landet die Rakete?`, [])

  // New task: the taxi whooshes to the starting planet and the alien calls
  useEffect(() => {
    if (!t) return
    setPos(t.from)
    setPicked(null)
    setWrong([])
    setMisses(0)
    setShown(false)
    setAboard(false)
    setResident(null)
    setMood('idle')
    if (idx > 0) sfx.whoosh()
    lockPreviews()
    const id = setTimeout(() => sayTask(taskSpeech(t)), 600)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fly the rocket field by field and count along out loud — the counting on
  // ("sieben, acht, neun") is what the number line is for. In missing-addend
  // tasks the jumps are counted ("eins, zwei, drei"), that is the answer.
  // Each hop waits for its word; the help dialog holds the flight.
  const hopTo = useCallback((from, to, countJumps, done) => {
    setHopping(true)
    const dir = to > from ? 1 : -1
    let cur = from, jumps = 0
    const stepOnce = () => {
      if (pausedRef.current) { hopTimer.current = setTimeout(stepOnce, 250); return }
      setLaunching(false)
      if (cur === to) { setHopping(false); done?.(); return }
      cur += dir; jumps++
      setPos(cur)
      setHops(h => h + 1)
      sfx.boing()
      let moved = false
      // the word can be cut off (help opened, a new task): fly on anyway
      const safety = setTimeout(() => next(), 1400)
      const next = () => {
        if (moved) return
        moved = true
        clearTimeout(safety)
        hopTimer.current = setTimeout(stepOnce, 140)
      }
      hopTimer.current = safety
      narrate([{ text: N(countJumps ? jumps : cur), rate: 1 }], { onEnd: next })
    }
    // the engine roars first: a short shake with flames, then lift-off
    sfx.whoosh()
    setLaunching(true)
    hopTimer.current = setTimeout(stepOnce, 650)
  }, [])

  const equation = task => `${N(task.from)} ${task.op === '+' ? 'plus' : 'minus'} ${N(task.step)} ist ${N(task.target)}.`

  const nextTask = useCallback(() => {
    if (idx + 1 >= tasks.length) {
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry.current, tasks.length)), { minMs: 300 })
    } else {
      setIdx(i => i + 1)
    }
  }, [idx, tasks.length, onComplete])

  // The alien climbs in and cheers, then the next call comes by itself
  const finishTask = useCallback((alreadyThere) => {
    setPicked(missing ? t.step : t.target)
    if (misses === 0) firstTry.current++
    const end = () => {
      setAboard(true)
      setMood('happy')
      sfx.correct()
      sfx.slideUp()
      const r = lineRef.current.getBoundingClientRect()
      burst({ x: r.left + r.width * (t.target - span[0] + 0.5) / (span[1] - span[0] + 1), y: r.top + r.height * 0.6 }, 'stars')
      sayRight(equation(t), {
        onEnd: () => {
          const go = () => (pausedRef.current ? (hopTimer.current = setTimeout(go, 250)) : nextTask())
          hopTimer.current = setTimeout(go, 500)
        },
      })
    }
    if (alreadyThere) end()
    else hopTo(t.from, t.target, missing, end)
  }, [t, missing, misses, span, hopTo, burst, nextTask])

  // After two misses the rocket flies ahead and counts, then the child
  // answers — tapping every field in turn until one is right taught nothing.
  const showTheWay = useCallback(() => {
    setShown(true)
    setHopping(true)
    setPos(t.from)
    narrate([{ text: 'Schau, ich zähle mit!' }], {
      onEnd: () => hopTo(t.from, t.target, missing, () => sayTask('Jetzt du!')),
    })
  }, [t, missing, hopTo])

  const miss = useCallback((n, hint) => {
    setWrong(w => w.includes(n) ? w : [...w, n])
    const m = misses + 1
    setMisses(m)
    setMood('oops')
    sfx.boing()
    if (m >= 2 && !shown) sayWrong(hint, { onEnd: showTheWay })
    else sayWrong(hint)
    setTimeout(() => setMood('idle'), 900)
  }, [misses, shown, showTheWay])

  // Tap on a planet: where does the rocket land? Someone else lives on a
  // wrong one and peeks out, puzzled.
  const pickField = useCallback((n) => {
    if (picked !== null || hopping || !t || missing) return
    if (n === t.target) { finishTask(pos === t.target); return }
    // Which way is "too far" depends on the direction: at minus the rocket
    // flies left, and a field above the result is not far enough. The hints
    // used to be swapped there.
    const dir = t.op === '+' ? 1 : -1
    let hint
    if ((n - t.from) * dir <= 0) hint = t.op === '+' ? 'Bei Plus fliegt die Rakete nach rechts!' : 'Bei Minus fliegt die Rakete nach links!'
    else hint = (n - t.target) * dir > 0 ? 'Das ist zu weit.' : 'Das ist noch nicht weit genug.'
    setResident({ n, art: RESIDENTS[n % RESIDENTS.length] })
    miss(n, hint)
  }, [picked, hopping, t, missing, pos, finishTask, miss])

  // Missing addend: how many jumps from the start to the alien? The answer
  // used to be the flag field itself — the number already written after "=".
  const pickJumps = useCallback((k) => {
    if (picked !== null || hopping || !t || !missing) return
    if (k === t.step) { finishTask(pos === t.target); return }
    const reach = t.from + k
    miss(k, `${N(t.from)} plus ${N(k)} ist ${N(reach)}. Wir brauchen ${N(t.target)}, ${reach > t.target ? 'das ist zu weit' : 'das ist noch nicht weit genug'}.`)
  }, [picked, hopping, t, missing, pos, finishTask, miss])

  if (!t) return null
  const line = Array.from({ length: span[1] - span[0] + 1 }, (_, i) => span[0] + i)
  const done = picked !== null
  const cellW = lineW ? (lineW - GAP * (line.length - 1)) / line.length : MIN_CELL
  const planetPx = Math.max(MIN_CELL - 2, Math.min(cellW - 2, 78))
  const rocketPx = Math.max(44, Math.min(cellW * 1.15, 84))
  const narrow = lineW > 0 && lineW < 520
  const at = n => `${((n - span[0] + 0.5) / line.length) * 100}%`
  // The rocket points the way it is going, up while it waits (the picture
  // points up and to the right; mirrored it flies left)
  const back = (hopping || done) && t.target < t.from
  const heading = !hopping && !done ? -45 : 45
  // waves around the row, so it looks like a path through space
  const lift = n => (n % 2 ? -10 : 8)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(10px,2vw,22px) clamp(8px,3vw,28px)', gap: 'clamp(10px,2vw,20px)',
    }}>
      {bursts}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 720 }}>
        <RoundTrail total={tasks.length} done={idx + (done ? 1 : 0)} walker="🚀" goal="🌕" style={{ flex: 1 }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={() => sayTask(taskSpeech(t))} aria-label="Aufgabe noch einmal hören"
          style={{
            width: 52, height: 52, flexShrink: 0, background: 'var(--px-gold)', border: `3px solid ${INK}`, borderRadius: 12,
            boxShadow: `inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -5px 0 rgba(0,0,0,0.2), 0 4px 0 ${INK}`,
            cursor: 'pointer', fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔊</motion.button>
      </div>

      {/* The alien calls the taxi; its speech bubble holds the sum */}
      <div style={{ flex: 1, display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: narrow ? 18 : 'clamp(8px,2vw,20px)', width: '100%', maxWidth: 720 }}>
        <AnimatePresence mode="wait">
          <motion.div key={idx} initial={{ x: -60, opacity: 0, rotate: -20 }} animate={{ x: 0, opacity: 1, rotate: 0 }} exit={{ y: -80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 16 }}>
            <Alien size={narrow ? 100 : 130} color={t.color} mood={mood}
              label="Alien" onTap={() => { sfx.giggle(); sayTask(taskSpeech(t)) }} />
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
            <NumBlock small={narrow} color={missing ? (done ? '#FFE08A' : '#FFFDF7') : '#FFE08A'}>{missing && !done ? '?' : t.step}</NumBlock>
            <NumBlock small={narrow} plain>=</NumBlock>
            <NumBlock small={narrow} color={missing || done ? '#C8F0C0' : '#FFFDF7'}>{missing || done ? t.target : '?'}</NumBlock>
          </div>
          {plan.frame && <TenFrame filled={t.from} added={done ? t.step : 0} />}
        </motion.div>
      </div>

      {/* The planets: the number line through space */}
      <div ref={lineRef} style={{ position: 'relative', width: '100%', maxWidth: 1000, paddingTop: rocketPx + 18, boxSizing: 'border-box' }}>
        {/* dotted flight path */}
        <div aria-hidden="true" style={{ position: 'absolute', left: at(span[0]), right: `calc(100% - ${at(span[1])})`, top: rocketPx + 18 + planetPx / 2, borderTop: '4px dotted rgba(255,255,255,0.45)' }} />
        <div style={{ display: 'flex', gap: GAP }}>
          {line.map(n => {
            const isWrong = !missing && wrong.includes(n)
            const state = done && n === t.target ? 'right' : isWrong ? 'tried' : undefined
            const Cell = missing ? 'div' : motion.button
            return (
              <div key={n} style={{ position: 'relative', flex: '1 1 0', minWidth: 0, display: 'flex', justifyContent: 'center', transform: `translateY(${lift(n)}px)` }}>
                <Cell
                  {...(!missing && {
                    whileTap: !done && !hopping ? { scale: 0.85 } : {},
                    onClick: () => pickField(n),
                    'aria-label': `Planet ${n}`,
                    ...hearable(N(n)),
                  })}
                  style={{ all: 'unset', cursor: missing || done || hopping ? 'default' : 'pointer', width: planetPx, height: planetPx, display: 'block' }}>
                  <Planet n={n} size={planetPx} state={state} />
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
                    <motion.div key={`r${n}`} aria-hidden="true"
                      initial={{ y: 20, scale: 0, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1, rotate: [0, -12, 12, -8, 0] }} exit={{ y: 20, scale: 0, opacity: 0 }}
                      transition={{ duration: 0.6 }} onAnimationComplete={() => setTimeout(() => setResident(r => (r?.n === n ? null : r)), 900)}
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
          animate={{ left: at(pos) }}
          transition={{ type: 'spring', stiffness: hopping ? 260 : 120, damping: hopping ? 22 : 18 }}
          style={{ position: 'absolute', top: 6 + lift(pos), width: rocketPx, height: rocketPx, marginLeft: -rocketPx / 2, pointerEvents: 'none' }}>
          <motion.div key={hops} animate={hops && !reduceMotion() ? { y: [0, -rocketPx * 0.5, 0] } : {}} transition={{ duration: 0.4 }}>
            <motion.div initial={false} animate={launching && !reduceMotion() ? { x: [0, -4, 4, -4, 4, 0], rotate: heading, scaleX: back ? -1 : 1 } : { x: 0, rotate: heading, scaleX: back ? -1 : 1 }}
              transition={{ duration: 0.3, repeat: launching ? 1 : 0 }}>
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
        </motion.div>
      </div>

      {/* Missing addend: the answer is the number of jumps */}
      <div style={{ minHeight: 76, display: 'flex', alignItems: 'center' }}>
        {missing && !done && (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {Array.from({ length: plan.maxStep }, (_, i) => i + 1).map(k => {
              const isWrong = wrong.includes(k)
              return (
                <motion.button key={k}
                  whileTap={!hopping && !isWrong ? { scale: 0.9 } : {}}
                  onClick={() => pickJumps(k)}
                  aria-label={`${k} Sprünge`}
                  {...hearable(N(k))}
                  style={{
                    width: 64, height: 68, padding: 0, borderRadius: 16, cursor: hopping || isWrong ? 'default' : 'pointer',
                    background: isWrong ? '#9A8FB0' : '#FFFDF7', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(0,0,0,0.35)',
                    opacity: isWrong ? 0.55 : 1, color: INK,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                  }}>
                  <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 30, lineHeight: 1 }}>{k}</span>
                  {/* one little hop arc per jump */}
                  <svg width={Math.min(52, 10 * k)} height="10" viewBox={`0 0 ${10 * k} 10`} aria-hidden="true">
                    {Array.from({ length: k }, (_, j) => <path key={j} d={`M${j * 10 + 1} 9 Q${j * 10 + 5} 0 ${j * 10 + 9} 9`} fill="none" stroke="#FF8A3D" strokeWidth="2.5" />)}
                  </svg>
                </motion.button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
