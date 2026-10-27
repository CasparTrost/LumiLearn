import { useState, useEffect, useLayoutEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { hearable } from '../lib/hearable.js'
import { pxCard, pxPanel, pxBubble, pxButton, pxSegment, ACCENT, INK } from './px.js'

/**
 * Rechen-Rakete — Addieren und Subtrahieren am Zahlenstrahl
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
    out.push({ ...t, r: Math.random() })
  }
  return out
}

// ── Ten frame ────────────────────────────────────────────────────────────────
function TenFrame({ filled, added, max = 10 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, width: 'clamp(150px,34vw,220px)' }}>
      {Array.from({ length: max }, (_, i) => {
        const isBase  = i < filled
        const isAdded = i >= filled && i < filled + added
        return (
          <div key={i} style={{
            aspectRatio: '1', borderRadius: 4,
            border: `2px solid ${INK}`,
            background: isBase ? 'var(--px-purple)' : isAdded ? 'var(--px-gold)' : '#FFFDF7',
            boxShadow: 'inset 0 -3px 0 rgba(42,27,61,0.15)',
            transition: 'background 0.25s',
          }} />
        )
      })}
    </div>
  )
}

const CELL = 44, GAP = 2   // smallest field and gap on the number line

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
  const [firstTry, setFirstTry] = useState(0)
  const [shown,   setShown]   = useState(false)  // the rocket already flew ahead
  const [mood,    setMood]    = useState('happy')
  const [hopping, setHopping] = useState(false)
  const [showWeiter, setShowWeiter] = useState(false)
  const [lineW,   setLineW]   = useState(0)
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
    const measure = () => setLineW(el.clientWidth - 12)
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
    const fit = Math.max(1, Math.floor((lineW + GAP) / (CELL + GAP)))
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
    ? `${N(task.from)} plus wie viel ergibt ${N(task.target)}? Wie viele Sprünge braucht die Rakete?`
    // Numbers are spelled out for the voice: a digit right before a period is
    // read as an ordinal in German — "4 plus 2." came out as "vier plus zweite".
    : `${N(task.from)} ${task.op === '+' ? 'plus' : 'minus'} ${N(task.step)}. Wo landet die Rakete?`, [])

  // New task: rocket returns to the starting number and the task is read out
  useEffect(() => {
    if (!t) return
    setPos(t.from)
    setPicked(null)
    setWrong([])
    setMisses(0)
    setShown(false)
    setMood('happy')
    lockPreviews()
    const id = setTimeout(() => sayTask(taskSpeech(t)), 450)
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
      if (cur === to) { setHopping(false); done?.(); return }
      cur += dir; jumps++
      setPos(cur)
      sfx.pop?.()
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
    hopTimer.current = setTimeout(stepOnce, 250)
  }, [])

  const equation = task => `${N(task.from)} ${task.op === '+' ? 'plus' : 'minus'} ${N(task.step)} ist ${N(task.target)}.`

  const finishTask = useCallback((alreadyThere) => {
    setPicked(missing ? t.step : t.target)
    setMood('excited')
    sfx.correct()
    if (misses === 0) setFirstTry(f => f + 1)
    const end = () => { sayRight(equation(t)); setShowWeiter(true) }
    if (alreadyThere) end()
    else hopTo(t.from, t.target, missing, end)
  }, [t, missing, misses, hopTo])

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
    setMood('encouraging')
    sfx.wrong()
    if (m >= 2 && !shown) sayWrong(hint, { onEnd: showTheWay })
    else sayWrong(hint)
    setTimeout(() => setMood('happy'), 900)
  }, [misses, shown, showTheWay])

  // Tap on the number line: where does the rocket land?
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
    miss(n, hint)
  }, [picked, hopping, t, missing, pos, finishTask, miss])

  // Missing addend: how many jumps from the start to the flag? The answer
  // used to be the flag field itself — the number already written after "=".
  const pickJumps = useCallback((k) => {
    if (picked !== null || hopping || !t || !missing) return
    if (k === t.step) { finishTask(pos === t.target); return }
    const reach = t.from + k
    miss(k, `${N(t.from)} plus ${N(k)} ist ${N(reach)}. Wir brauchen ${N(t.target)}, ${reach > t.target ? 'das ist zu weit' : 'das ist noch nicht weit genug'}.`)
  }, [picked, hopping, t, missing, pos, finishTask, miss])

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= tasks.length) {
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry, tasks.length)), { minMs: 300 })
    } else {
      setIdx(i => i + 1)
    }
  }

  if (!t) return null
  const line = Array.from({ length: span[1] - span[0] + 1 }, (_, i) => span[0] + i)
  const done = picked !== null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(12px,2.5vw,28px) clamp(8px,3vw,28px)', gap: 'clamp(12px,2vw,22px)',
    }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {tasks.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < idx ? 'done' : i === idx ? 'current' : 'todo'),
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + task — tap the bubble to hear it again */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={68} />
        <button
          onClick={() => sayTask(taskSpeech(t))}
          aria-label="Aufgabe noch einmal hören"
          style={{
            flex: 1, ...pxBubble, padding: '12px 18px', textAlign: 'left', cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(17px,3.4vw,22px)', color: 'var(--text-primary)',
          }}
        >
          {done
            ? <>🚀 Gelandet auf <strong style={{ color: ACCENT }}>{t.target}</strong>!</>
            : missing
              ? <>Wie viele Sprünge braucht die Rakete bis zur <strong style={{ color: ACCENT }}>{t.target}</strong> 🏁?</>
              : <>Tippe das Feld, auf dem die Rakete landet!</>}
          {' '}🔊
        </button>
      </div>

      {/* The sum itself */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'clamp(8px,2vw,14px)',
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(32px,7vw,52px)', fontWeight: 800,
        color: ACCENT, ...pxPanel,
        padding: 'clamp(8px,1.5vw,14px) clamp(18px,4vw,32px)',
      }}>
        <span>{t.from}</span>
        <span style={{ color: INK }}>{t.op}</span>
        <span>{missing ? (done ? t.step : '?') : t.step}</span>
        <span style={{ color: INK }}>=</span>
        <span>{missing ? t.target : (done ? t.target : '?')}</span>
      </div>

      {/* Ten frame while the levels still need it */}
      {plan.frame && (
        <TenFrame filled={t.from} added={done ? t.step : 0} max={10} />
      )}

      {/* Number line */}
      <div ref={lineRef} style={{
        display: 'flex', gap: GAP, flexWrap: 'nowrap',
        width: '100%', maxWidth: 1000, justifyContent: 'center',
        padding: '34px 6px 12px', boxSizing: 'border-box',
        ...pxPanel,
      }}>
        {line.map(n => {
          const here    = pos === n
          const isWrong = !missing && wrong.includes(n)
          const flag    = missing && n === t.target
          const Cell    = missing ? motion.div : motion.button
          return (
            <div key={n} style={{ position: 'relative', flex: '1 1 0', minWidth: 0, maxWidth: 68 }}>
              {here && (
                <motion.div
                  layoutId="rocket"
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  style={{
                    position: 'absolute', left: 0, right: 0, top: -34, textAlign: 'center',
                    fontSize: 'clamp(24px,5vw,32px)', lineHeight: 1, pointerEvents: 'none',
                  }}
                >🚀</motion.div>
              )}
              {flag && !here && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: -32, textAlign: 'center', fontSize: 26, lineHeight: 1, pointerEvents: 'none' }}>🏁</div>
              )}
              <Cell
                {...(!missing && {
                  whileHover: !done && !hopping ? { scale: 1.1 } : {},
                  whileTap: !done && !hopping ? { scale: 0.9 } : {},
                  onClick: () => pickField(n),
                  'aria-label': `Feld ${n}`,
                })}
                style={{
                  width: '100%', minWidth: CELL, height: 'clamp(52px,7vw,64px)', boxSizing: 'border-box',
                  ...pxCard(done && n === t.target ? 'right' : isWrong ? 'wrong' : here || flag ? 'selected' : undefined),
                  borderRadius: 8, cursor: missing || done || hopping ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  fontFamily: 'var(--font-heading)', fontWeight: 700,
                  fontSize: 'clamp(17px,2.8vw,22px)',
                  color: isWrong ? '#A93226' : 'var(--text-primary)',
                  opacity: isWrong ? 0.6 : 1,
                  transition: 'background 0.2s, border 0.2s',
                }}
              >{n}</Cell>
            </div>
          )
        })}
      </div>

      {/* Missing addend: the answer is the number of jumps */}
      {missing && !done && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {Array.from({ length: plan.maxStep }, (_, i) => i + 1).map(k => (
            <motion.button
              key={k}
              whileHover={!hopping ? { scale: 1.08 } : {}} whileTap={!hopping ? { scale: 0.92 } : {}}
              onClick={() => pickJumps(k)}
              aria-label={`${k} Sprünge`}
              {...hearable(N(k))}
              style={{
                ...pxCard(wrong.includes(k) ? 'wrong' : undefined),
                width: 60, height: 60, padding: 0, cursor: hopping ? 'default' : 'pointer',
                fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 28,
                color: wrong.includes(k) ? '#A93226' : INK, opacity: wrong.includes(k) ? 0.6 : 1,
              }}
            >{k}</motion.button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showWeiter && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={weiterClick}
            {...hearable('Weiter')}
            style={{
              ...pxButton('green'), color: INK, textShadow: 'none', padding: '12px 40px', minHeight: 52,
              fontSize: 'clamp(18px,3.4vw,22px)',
            }}
          >Weiter! →</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
