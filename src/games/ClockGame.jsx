import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import HearOptions from '../components/HearOptions.jsx'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import { pxCard, pxPanel, pxBubble, pxButton, pxSegment, ACCENT, INK } from './px.js'

/**
 * Uhrzeiten-Meister — Uhrzeit lesen & stellen
 * Scientific basis:
 *   • Concrete-Pictorial-Abstract (Bruner) — manipulating analog clock hands
 *     builds deep conceptual understanding before abstract notation.
 *   • Time Perception (Friedman, 1990) — children ages 5–7 can learn to read
 *     hours and half-hours; quarter-hours from age 7.
 *   • Dual-task engagement — simultaneously reading/setting reinforces both
 *     receptive and productive knowledge of time concepts.
 */

// ── Question banks per level ─────────────────────────────────────────────────
// L1-3: full hours · L4-6: + half hours · L7-9: quarter hours · L10: 5-minute
// steps. Levels 7–10 used to ask for 5-minute steps and any minute ("drei Uhr
// neunundfünfzig") — second/third-grade material in an app for four- to
// seven-year-olds.
function tierFor(level) {
  if (level <= 3) return 'hour'
  if (level <= 6) return 'half'
  if (level <= 9) return 'quarter'
  return 'five'
}
const MINUTES = { hour: [0], half: [0, 30], quarter: [0, 15, 30, 45], five: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55] }
// The new step of a tier comes up more often than the old one
const NEW_MINUTES = { hour: [0], half: [30], quarter: [15, 45], five: [5, 10, 20, 25, 35, 40, 50, 55] }

// Roughly half a step of the tier: precise enough to force the right notch,
// forgiving enough that dragging a hand isn't a pixel exercise.
const TOLERANCE = { hour: 8, half: 8, quarter: 5, five: 2 }

// From level 7 the times are also written digitally ("4:30 Uhr"); before,
// only the way they are said ("halb 5") — a digital readout let the child
// match digits instead of looking at the hands.
const showDigital = level => level >= 7

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }
const pickOne = a => a[rand(0, a.length - 1)]

function randomTime(tier) {
  const m = Math.random() < 0.6 ? pickOne(NEW_MINUTES[tier]) : pickOne(MINUTES[tier])
  return { h: rand(1, 12), m }
}

// Times of day a preschooler recognises, each at its own place on the
// 12-hour face. The half-hour ones join from level 4. `does` finishes the
// sentence "Um sieben Uhr …". Soft hyphens (\u00AD) let the long words
// break on a narrow card; speech drops them.
const DAILY_ACTIVITIES = [
  { id: 'aufstehen',    icon: '⏰',  label: 'Aufstehen',     does: 'steht Lumi auf',             h: 7,  m: 0 },
  { id: 'kindergarten', icon: '🏫',  label: 'Kinder\u00ADgarten',  does: 'geht Lumi in den Kindergarten', h: 9, m: 0 },
  { id: 'mittagessen',  icon: '🍽️', label: 'Mittag\u00ADessen',   does: 'isst Lumi zu Mittag',        h: 12, m: 0 },
  { id: 'spielplatz',   icon: '🛝',  label: 'Spiel\u00ADplatz',    does: 'geht Lumi auf den Spielplatz', h: 3, m: 0 },
  { id: 'abendessen',   icon: '🍲',  label: 'Abend\u00ADessen',    does: 'isst Lumi zu Abend',         h: 6,  m: 0 },
  { id: 'schlafen',     icon: '🛏️', label: 'Schlafen\u00ADgehen', does: 'geht Lumi schlafen',         h: 8,  m: 0 },
  { id: 'obst',         icon: '🍎',  label: 'Obst essen',    does: 'isst Lumi Obst',             h: 4,  m: 30 },
  { id: 'baden',        icon: '🛁',  label: 'Baden',         does: 'badet Lumi',                 h: 5,  m: 30 },
  { id: 'zaehne',       icon: '🪥',  label: 'Zähne putzen',  does: 'putzt Lumi die Zähne',       h: 7,  m: 30 },
]
const plain = text => text.replace(/\u00AD/g, '')
const activitiesFor = level => DAILY_ACTIVITIES.filter(a => level >= 4 || a.m === 0)

// Every third round asks what happens at a time instead of reading or
// setting it, so the face connects to the child's own day. The activity is
// drawn at random and never twice in a level: it used to be the same four in
// the same order every time, and Abendessen/Schlafengehen never came up.
function generateRounds(level) {
  const tier  = tierFor(level)
  const count = level <= 5 ? 8 : 10
  const acts  = shuffle(activitiesFor(level))
  const seen  = new Set()
  const rounds = []
  for (let i = 0; i < count; i++) {
    if (i % 3 === 2 && acts.length) {
      const act = acts.pop()
      seen.add(`${act.h}:${act.m}`)
      rounds.push({ h: act.h, m: act.m, activity: act })
      continue
    }
    let t, tries = 0
    do { t = randomTime(tier) } while (seen.has(`${t.h}:${t.m}`) && ++tries < 50)
    seen.add(`${t.h}:${t.m}`)
    rounds.push(t)
  }
  return rounds
}

// Uhrzeit so, wie man sie einem Kind sagt — für eine Zeigeruhr.
//
// Im Kindergarten heißt das "halb drei", und genau diese Brücke zwischen
// Zeigerstellung und Wort soll das Spiel bauen.
//
// spoken: Stunden als Wort, für die Sprachausgabe. Volle Stunde 1 heißt
// "ein Uhr", sonst steht die Eins allein: "halb eins", "fünf nach eins".
const MIN_WORD = { 5: 'fünf', 10: 'zehn', 20: 'zwanzig' }
function toGermanTime(h, m, { spoken = false } = {}) {
  const cur = h % 12 === 0 ? 12 : h % 12
  const nxt = cur % 12 + 1
  const H = (n) => (spoken ? sayNumber(n) : String(n))
  if (m === 0)  return spoken && cur === 1 ? 'ein Uhr' : `${H(cur)} Uhr`
  if (m === 15) return `Viertel nach ${H(cur)}`
  if (m === 30) return `halb ${H(nxt)}`
  if (m === 45) return `Viertel vor ${H(nxt)}`
  if (m === 25) return `fünf vor halb ${H(nxt)}`
  if (m === 35) return `fünf nach halb ${H(nxt)}`
  if (m < 30 && MIN_WORD[m])      return `${MIN_WORD[m]} nach ${H(cur)}`
  if (m > 30 && MIN_WORD[60 - m]) return `${MIN_WORD[60 - m]} vor ${H(nxt)}`
  return spoken ? `${H(cur)} Uhr ${sayNumber(m)}` : `${cur}:${String(m).padStart(2, '0')} Uhr`
}
const say = (t) => toGermanTime(t.h, t.m, { spoken: true })

function fmt(h, m) {
  return `${h}:${String(m).padStart(2, '0')} Uhr`
}

// What the child reads on a card: the spoken form up to level 6, the
// digital one from level 7.
const label = (t, level) => (showDigital(level) ? fmt(t.h, t.m) : toGermanTime(t.h, t.m))

// "die Vier", "der Zwölf"
const numberNoun = n => { const w = sayNumber(n); return w[0].toUpperCase() + w.slice(1) }

// Where the hands are, in words — for the explanation after two misses:
// "Der kurze Zeiger steht genau zwischen der Vier und der Fünf, der lange
// Zeiger zeigt auf die Sechs."
function describeHands(h, m) {
  const cur = h % 12 === 0 ? 12 : h % 12
  const nxt = cur % 12 + 1
  const short = m === 0  ? `der kurze Zeiger zeigt auf die ${numberNoun(cur)}`
              : m === 30 ? `der kurze Zeiger steht genau zwischen der ${numberNoun(cur)} und der ${numberNoun(nxt)}`
              : m < 30   ? `der kurze Zeiger steht kurz nach der ${numberNoun(cur)}`
              :            `der kurze Zeiger steht kurz vor der ${numberNoun(nxt)}`
  const long  = m === 0 ? 'der lange Zeiger steht oben auf der Zwölf'
              : `der lange Zeiger zeigt auf die ${numberNoun(m / 5)}`
  return `${short[0].toUpperCase()}${short.slice(1)}, ${long}.`
}

// A first hint when reading: how to read the long hand, without the answer.
function readHint(m) {
  if (m === 0)  return 'Der lange Zeiger steht oben auf der Zwölf, das ist eine volle Stunde. Wohin zeigt der kurze Zeiger?'
  if (m === 30) return 'Der lange Zeiger steht unten auf der Sechs, dann ist es halb. Der kurze Zeiger ist schon auf dem Weg zur nächsten Zahl.'
  if (m === 15) return 'Der lange Zeiger steht auf der Drei, dann ist es Viertel nach.'
  if (m === 45) return 'Der lange Zeiger steht auf der Neun, dann ist es Viertel vor.'
  return 'Der lange Zeiger zeigt die Minuten. Zähle in Fünferschritten: fünf, zehn, fünfzehn.'
}

function timeDiffMin(h1, m1, h2, m2) {
  // difference in minutes, mod 720 (half-day)
  const t1 = ((h1 % 12) * 60 + m1 + 720) % 720
  const t2 = ((h2 % 12) * 60 + m2 + 720) % 720
  const raw = Math.abs(t1 - t2)
  return Math.min(raw, 720 - raw)
}

// The hands are one value, minutes since 12:00 (0–719), like a real clock:
// turning the minute hand past the 12 moves the hour hand on.
const toHM   = T => ({ h: Math.floor(T / 60) || 12, m: T % 60 })
const fromHM = (h, m) => ((h % 12) * 60 + m) % 720

// Wrong options from the level's own tier, built from the mistakes children
// really make. They used to be random times in 5-minute steps, so on level
// 9 ("jede Minute") the only time that wasn't a multiple of five was the
// answer, and level 2 (full hours) offered half hours.
function readOptions(t, level) {
  const tier = tierFor(level)
  const ok = (c) => MINUTES[tier].includes(c.m) && !(c.h === t.h && c.m === t.m)
  const norm = (h) => ((h - 1 + 12) % 12) + 1
  const typical = [
    { h: norm(t.h + 1), m: t.m },                     // "halb vier" read as 4:30
    { h: norm(t.h - 1), m: t.m },
    { h: norm(12 - t.h - (t.m ? 1 : 0)), m: (60 - t.m) % 60 },   // mirrored
    t.m % 5 === 0 && t.m ? { h: t.m / 5, m: (t.h % 12) * 5 } : null, // hands swapped
  ].filter(Boolean).filter(ok)
  const seen = new Set([`${t.h}:${t.m}`])
  const wrongs = []
  for (const c of [...shuffle(typical), ...Array.from({ length: 60 }, () => randomTime(tier))]) {
    const k = `${c.h}:${c.m}`
    if (wrongs.length >= 3 || seen.has(k) || !ok(c)) continue
    seen.add(k); wrongs.push(c)
  }
  return shuffle([t, ...wrongs])
}

// Hand colours: hour hand blue, minute hand red — the same in every round,
// and on the ± buttons. (They used to be the old lilac #4A00E0/#6C63FF.)
const HOUR_C = '#2F6FC4'
const MIN_C  = '#C2412D'

// ── Tap-to-step button (with hold-repeat) ───────────────────────────────────
// Non-drag alternative to grabbing a clock hand — same pattern as MazeGame's
// D-Pad buttons (pointer capture + a window-level fallback, so the repeat
// reliably stops even if the pointerup lands on a different element after
// the whileTap scale shrinks the hit area).
function StepButton({ label, onPress, color, ariaLabel, disabled }) {
  const repeatRef = useRef(null)
  const activeRef = useRef(false)

  const stop = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    clearInterval(repeatRef.current)
    repeatRef.current = null
  }, [])

  const start = useCallback(e => {
    if (disabled) return
    activeRef.current = true
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    onPress()
    clearInterval(repeatRef.current)
    repeatRef.current = setInterval(onPress, 260)
  }, [onPress, disabled])

  useEffect(() => {
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
      stop()
    }
  }, [stop])

  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.88 }}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      aria-label={ariaLabel}
      disabled={disabled}
      style={{
        width: 52, height: 52, borderRadius: 12,
        background: color, color: 'white', border: `3px solid ${INK}`,
        textShadow: '0 2px 0 rgba(0,0,0,0.3)',
        fontSize: 26, fontWeight: 800, lineHeight: 1,
        cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        boxShadow: `inset 0 2px 0 rgba(255,255,255,0.3), inset 0 -4px 0 rgba(0,0,0,0.22), 0 4px 0 ${INK}`,
      }}
    >{label}</motion.button>
  )
}

// A little clock with only the one hand, instead of the words "Stunde" /
// "Minute" a non-reader cannot use.
function HandIcon({ kind }) {
  const long = kind === 'minute'
  return (
    <svg width={40} height={40} viewBox="0 0 34 34" aria-hidden="true" style={{ flexShrink: 0 }}>
      <circle cx="17" cy="17" r="15" fill="#FFFDF7" stroke={INK} strokeWidth="2.5" />
      <line x1="17" y1="17" x2={long ? 17 : 24} y2={long ? 4 : 12}
        stroke={long ? MIN_C : HOUR_C} strokeWidth={long ? 3 : 4.5} strokeLinecap="round" />
      <circle cx="17" cy="17" r="2.5" fill={INK} />
    </svg>
  )
}

// ── Analog Clock SVG ─────────────────────────────────────────────────────────
const CX = 120, CY = 120, R = 108
const HOUR_LEN = R * 0.52, MIN_LEN = R * 0.86

function handEnd(angleDeg, length) {
  const rad = angleDeg * Math.PI / 180
  return { x: CX + length * Math.sin(rad), y: CY - length * Math.cos(rad) }
}

// value: minutes since 12:00. In interactive mode the whole face is the
// handle: a finger near the middle turns the short hand, further out the
// long one. The grips used to sit right on the 11/12 and 7/8 and carried
// the letters "S" and "M".
function ClockFace({ value, onChange, interactive, level, highlightHands, size }) {
  const svgRef  = useRef(null)
  const dragRef = useRef(null)          // 'hour' | 'minute' | null
  const [dragging, setDragging] = useState(null)
  const { h, m } = toHM(value)

  const pointer = useCallback((e) => {
    const rect = svgRef.current.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    // atan2(dx, -dy): 0° at top (12 o'clock), positive clockwise
    return {
      angle: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360,
      dist:  Math.hypot(dx, dy) / (rect.width / 2) * R,
    }
  }, [])

  const moveHand = useCallback((hand, angle) => {
    if (hand === 'minute') {
      // in 5-minute notches; past the 12 the hour moves on, like a real clock
      const nm = Math.round(angle / 30) * 5 % 60
      const curM = value % 60
      let hour = Math.floor(value / 60)
      if (curM >= 45 && nm < 15) hour += 1
      else if (curM < 15 && nm >= 45) hour -= 1
      onChange((((hour * 60 + nm) % 720) + 720) % 720)
    } else {
      // The hour hand stands between two numbers at :30 or :45 — drawn at
      // hours·30° + minutes·0.5°. Rounding the raw angle to the nearest hour
      // set "halb fünf" to 5:30 exactly when the child put the hand in the
      // right place, between the 4 and the 5. Take the minute share off first.
      const curM = value % 60
      const nh = Math.floor((((angle - curM * 0.5) % 360 + 360) % 360) / 30 + 0.5) % 12
      onChange(nh * 60 + curM)
    }
  }, [value, onChange])

  const onPointerDown = useCallback((e) => {
    if (!interactive) return
    e.preventDefault()
    const { angle, dist } = pointer(e)
    const hand = dist < R * 0.5 ? 'hour' : 'minute'
    dragRef.current = hand
    setDragging(hand)
    try { svgRef.current.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    moveHand(hand, angle)
  }, [interactive, pointer, moveHand])

  const onPointerMove = useCallback((e) => {
    if (!dragRef.current) return
    e.preventDefault()
    moveHand(dragRef.current, pointer(e).angle)
  }, [pointer, moveHand])

  const endDrag = useCallback(() => { dragRef.current = null; setDragging(null) }, [])

  // Hour hand: 360°/12h = 30° per hour + 0.5° per minute
  const hourAngle   = (h % 12) * 30 + m * 0.5
  const minuteAngle = m * 6
  const hourEnd     = handEnd(hourAngle, HOUR_LEN)
  const minuteEnd   = handEnd(minuteAngle, MIN_LEN)
  const hourGrip    = handEnd(hourAngle, HOUR_LEN * 0.72)

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 240 240"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      role="img"
      aria-label={interactive ? 'Uhr zum Stellen' : 'Uhr'}
      style={{
        width: size, height: size,
        display: 'block',
        borderRadius: '50%',
        filter: 'drop-shadow(0 5px 0 rgba(42,27,61,0.35))',
        cursor: dragging ? 'grabbing' : interactive ? 'grab' : 'default',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* Clock face */}
      <circle cx={CX} cy={CY} r={R} fill="#FFFDF7" stroke={INK} strokeWidth={5} />
      <circle cx={CX} cy={CY} r={R - 6} fill="none" stroke="#ecd2a0" strokeWidth={3} />

      {/* Hour markers */}
      {Array.from({ length: 12 }, (_, i) => {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2
        const outer = R - 8
        const inner = i % 3 === 0 ? R - 22 : R - 16
        return (
          <line key={i}
            x1={CX + outer * Math.cos(ang)} y1={CY + outer * Math.sin(ang)}
            x2={CX + inner * Math.cos(ang)} y2={CY + inner * Math.sin(ang)}
            stroke={i % 3 === 0 ? INK : '#b9a27e'}
            strokeWidth={i % 3 === 0 ? 3.5 : 2}
            strokeLinecap="round"
          />
        )
      })}

      {/* Hands under the numbers: the long hand reaches across the number
          ring, and the digits keep a light outline so they stay readable.
          The hour hand pulses while a hint is showing, so the child's eye
          is sent to the thing the hint talks about. */}
      <motion.line
        x1={CX} y1={CY}
        x2={hourEnd.x} y2={hourEnd.y}
        stroke={HOUR_C}
        strokeLinecap="round"
        animate={highlightHands ? { strokeWidth: [9, 15, 9] } : { strokeWidth: 9 }}
        transition={highlightHands ? { duration: 1.1, repeat: Infinity } : { duration: 0.2 }}
        style={{ pointerEvents: 'none' }}
      />
      {/* Minute hand — pulses on the offbeat so the two are told apart */}
      <motion.line
        x1={CX} y1={CY}
        x2={minuteEnd.x} y2={minuteEnd.y}
        stroke={MIN_C}
        strokeLinecap="round"
        animate={highlightHands ? { strokeWidth: [5, 10, 5] } : { strokeWidth: 5 }}
        transition={highlightHands ? { duration: 1.1, repeat: Infinity, delay: 0.55 } : { duration: 0.2 }}
        style={{ pointerEvents: 'none' }}
      />
      {/* Hour numbers — always fully visible: they used to fade to 40 % from
          level 6, just when minute numbers were added */}
      {[12,1,2,3,4,5,6,7,8,9,10,11].map((n, i) => {
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2
        const r2  = R - 34
        return (
          <text key={n}
            x={CX + r2 * Math.cos(ang)}
            y={CY + r2 * Math.sin(ang) + 6}
            textAnchor="middle"
            fontSize={i % 3 === 0 ? 19 : 16}
            fontWeight={i % 3 === 0 ? '700' : '600'}
            fill="#2a1b3d"
            stroke="#FFFDF7" strokeWidth={4} paintOrder="stroke"
            fontFamily="var(--font-heading, system-ui)"
            style={{ pointerEvents: 'none' }}
          >{n}</text>
        )
      })}

      {/* 5-minute labels — only once times are also shown digitally */}
      {showDigital(level) && Array.from({ length: 12 }, (_, i) => {
        const min = i * 5
        if (min === 0) return null // 12 already shown as hour number
        const ang = (i / 12) * Math.PI * 2 - Math.PI / 2
        const r3 = R - 54
        return (
          <text key={'m'+i}
            x={CX + r3 * Math.cos(ang)}
            y={CY + r3 * Math.sin(ang) + 4}
            textAnchor="middle"
            fontSize={10} fontWeight="700"
            fill="#8a4f22"
            stroke="#FFFDF7" strokeWidth={3} paintOrder="stroke"
            fontFamily="var(--font-heading, system-ui)"
            style={{ pointerEvents: 'none' }}
          >{min}</text>
        )
      })}

      {/* Grips — see-through, so the numbers under them stay readable */}
      {interactive && (<>
        <circle cx={hourGrip.x} cy={hourGrip.y} r={17}
          fill={HOUR_C} fillOpacity={dragging === 'hour' ? 0.4 : 0.2} stroke={HOUR_C} strokeWidth={2.5}
          style={{ pointerEvents: 'none' }} />
        <circle cx={minuteEnd.x} cy={minuteEnd.y} r={12}
          fill={MIN_C} fillOpacity={dragging === 'minute' ? 0.4 : 0.2} stroke={MIN_C} strokeWidth={2.5}
          style={{ pointerEvents: 'none' }} />
      </>)}

      {/* Center cap */}
      <circle cx={CX} cy={CY} r={7} fill={INK} style={{ pointerEvents: 'none' }} />
      <circle cx={CX} cy={CY} r={3} fill="white" style={{ pointerEvents: 'none' }} />
    </svg>
  )
}

// Size of an element, for laying the clock out against the real height.
function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const calc = () => {
      const r = el.getBoundingClientRect()
      setSize(s => (s.w === Math.round(r.width) && s.h === Math.round(r.height) ? s : { w: Math.round(r.width), h: Math.round(r.height) }))
    }
    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function ClockGame({ level = 1, onComplete }) {
  const [times]   = useState(() => generateRounds(level))
  const tier      = tierFor(level)
  const [idx,     setIdx]     = useState(0)
  // null · 'hint' after a first miss · 'right' · 'shown' after a second miss
  const [status,  setStatus]  = useState(null)
  const [tried,   setTried]   = useState([])       // options already tapped this round
  const [missed,  setMissed]  = useState([])       // rounds with a miss
  const [mood,    setMood]    = useState('happy')
  const [flash,   setFlash]   = useState(null)     // { kind, key }
  const [hands,   setHands]   = useState(0)        // the set-mode hands, minutes since 12:00
  const tweenRef  = useRef(null)

  const t = times[idx]
  // 'read' = pick the time · 'set' = put the hands there ·
  // 'daily' = say what happens at this time of day
  const mode = t?.activity ? 'daily' : (idx % 3 === 0 ? 'read' : 'set')
  const resolved = status === 'right' || status === 'shown'

  const task = !t ? ''
    : mode === 'read'  ? 'Schau auf die Uhr. Wie viel Uhr ist es?'
    : mode === 'daily' ? 'Was macht Lumi, wenn die Uhr so aussieht?'
    :                    `Stelle die Uhr auf ${say(t)}.`

  const options      = useMemo(() => (t && mode === 'read' ? readOptions(t, level) : []), [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  const dailyOptions = useMemo(() => {
    if (!t?.activity) return []
    const others = shuffle(activitiesFor(level).filter(a => a.id !== t.activity.id)).slice(0, 2)
    return shuffle([t.activity, ...others])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // New round: hands somewhere clearly wrong, then the task
  useEffect(() => {
    if (!t) return
    setStatus(null); setTried([]); setMood('happy')
    cancelAnimationFrame(tweenRef.current)
    let start
    do { start = fromHM(rand(1, 12), rand(0, 11) * 5) }
    while (timeDiffMin(toHM(start).h, toHM(start).m, t.h, t.m) <= 60)
    setHands(start)
    lockPreviews()
    const id = setTimeout(() => sayTask(task), 450)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(tweenRef.current), [])

  // After a second miss in set mode the hands glide to the right place
  const showOnClock = useCallback(() => {
    const from = hands, to = fromHM(t.h, t.m)
    let delta = ((to - from) % 720 + 720) % 720
    if (delta > 360) delta -= 720
    const t0 = performance.now(), dur = 1100
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      setHands(((Math.round(from + delta * e) % 720) + 720) % 720)
      if (k < 1) tweenRef.current = requestAnimationFrame(step)
    }
    tweenRef.current = requestAnimationFrame(step)
  }, [hands, t])

  const right = useCallback((praise) => {
    setStatus('right')
    setMood('excited')
    setFlash({ kind: 'ok', key: Date.now() })
    sfx.correct()
    sayRight(praise)
  }, [])

  // First miss: a hint and another try. Second miss: show and say the answer.
  const wrong = useCallback((hint, reveal) => {
    setMissed(ms => (ms.includes(idx) ? ms : [...ms, idx]))
    setMood('encouraging')
    setFlash({ kind: 'wrong', key: Date.now() })
    sfx.wrong()
    if (status === 'hint') {
      setStatus('shown')
      sayWrong(reveal)
    } else {
      setStatus('hint')
      sayWrong(hint)
    }
  }, [idx, status])

  const pickDigital = useCallback((opt) => {
    if (resolved || tried.includes(opt)) return
    setTried(tr => [...tr, opt])
    if (opt === t) right(`Es ist ${say(t)}.`)
    else wrong(readHint(t.m), `Es ist ${say(t)}. ${describeHands(t.h, t.m)}`)
  }, [resolved, tried, t, right, wrong])

  const pickActivity = useCallback((act) => {
    if (resolved || tried.includes(act.id)) return
    setTried(tr => [...tr, act.id])
    if (act.id === t.activity.id) right(`Um ${say(t)} ${act.does}.`)
    else wrong(`Es ist ${say(t)}. Was macht Lumi da?`, `Um ${say(t)} ${t.activity.does}.`)
  }, [resolved, tried, t, right, wrong])

  const submitAnalog = useCallback(() => {
    if (resolved) return
    const cur = toHM(hands)
    if (timeDiffMin(cur.h, cur.m, t.h, t.m) <= TOLERANCE[tier]) { right(`Es ist ${say(t)}.`); return }
    // Which hand is off? The minute hand alone decides "halb", "Viertel" …
    const minuteOk = Math.min(Math.abs(cur.m - t.m), 60 - Math.abs(cur.m - t.m)) <= TOLERANCE[tier]
    const hint = minuteOk
      ? 'Der lange Zeiger stimmt schon. Schau noch einmal auf den kurzen Zeiger.'
      : cur.h % 12 === t.h % 12
        ? 'Der kurze Zeiger stimmt schon. Schau noch einmal auf den langen Zeiger.'
        : 'Der kurze Zeiger zeigt die Stunde, der lange Zeiger die Minuten. Versuch es noch einmal.'
    if (status === 'hint') showOnClock()
    wrong(hint, `Schau, so sieht ${say(t)} aus. ${describeHands(t.h, t.m)}`)
  }, [resolved, hands, t, tier, status, right, wrong, showOnClock])

  const weiterClick = () => {
    if (idx + 1 >= times.length) {
      sfx.complete()
      afterNarration(() => onComplete(result(times.length - missed.length, times.length)), { minMs: 500 })
    } else {
      setIdx(i => i + 1)
    }
  }

  // ── Layout: the clock takes what is left of the height ───────────────────
  const areaRef = useRef(null)
  const area    = useSize(areaRef)
  const wide    = area.w > area.h * 1.2 && area.w >= 560
  const side    = mode === 'read'  ? (wide ? { w: 360, h: 0 } : { w: 0, h: 150 })
                : mode === 'daily' ? (wide ? { w: 250, h: 0 } : { w: 0, h: 108 })
                :                    (wide ? { w: 150, h: 0 } : { w: 0, h: 64 })
  const gap     = 16
  const panelPad = 12
  const clockPx = Math.max(150, Math.floor(Math.min(
    wide ? area.h : area.h - side.h - gap,
    wide ? area.w - side.w - gap : area.w,
    560,
  ) - panelPad * 2 - 6))

  if (!t) return null

  const hearItems = [task, ...(
    mode === 'read'  ? options.map(o => say(o))
    : mode === 'daily' ? dailyOptions.map(a => plain(a.label))
    : [])]

  const target = showDigital(level)
    ? <><strong style={{ color: ACCENT }}>{fmt(t.h, t.m)}</strong> ({toGermanTime(t.h, t.m)})</>
    : <strong style={{ color: ACCENT }}>{toGermanTime(t.h, t.m)}</strong>

  const bubble = status === 'right'
    ? <>⭐ Richtig! Es ist <strong style={{ color: ACCENT }}>{toGermanTime(t.h, t.m)}</strong>.</>
    : status === 'shown'
      ? (mode === 'daily'
          ? <>👀 Um <strong style={{ color: ACCENT }}>{toGermanTime(t.h, t.m)}</strong>: {t.activity.label}.</>
          : <>👀 So sieht <strong style={{ color: ACCENT }}>{toGermanTime(t.h, t.m)}</strong> aus.</>)
      : status === 'hint'
        ? (mode === 'daily'
            ? <>💡 Es ist <strong style={{ color: ACCENT }}>{toGermanTime(t.h, t.m)}</strong>. Was macht Lumi da?</>
            : <>💡 Schau auf die Zeiger: der kurze zeigt die Stunde, der lange die Minuten.</>)
        : mode === 'read'
          ? <>Wie viel Uhr ist es? 🕐</>
          : mode === 'daily'
            ? <>Was macht Lumi, wenn die Uhr so aussieht? 🤔</>
            : <>Stelle die Uhr auf {target}!</>

  const doneSeg = (i) => i < idx || (i === idx && resolved)

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(10px,2vw,22px) clamp(12px,3vw,32px)',
      gap: 'clamp(8px,1.6dvh,16px)', overflow: 'hidden',
    }}>

      {/* Confetti on correct */}
      <AnimatePresence>
        {flash?.kind === 'ok' && (
          <motion.div key={'confetti-' + flash.key}
            initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ delay: 0.8, duration: 0.3 }}
            style={{ position: 'fixed', inset: 0, zIndex: 160, pointerEvents: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 60 }}>
            {['🌟','✨','⭐','🎉','🌟','✨'].map((e, i) => (
              <motion.span key={i}
                initial={{ y: 0, x: 0, scale: 0, opacity: 1 }}
                animate={{ y: -(80 + i * 25), x: (i % 2 === 0 ? 1 : -1) * (40 + i * 30), scale: [0, 1.3, 0], opacity: [1, 1, 0] }}
                transition={{ duration: 0.7, delay: i * 0.06 }}
                style={{ position: 'absolute' }}>{e}</motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Flash overlay */}
      <AnimatePresence>
        {flash && (
          <motion.div key={flash.key}
            initial={{ opacity: flash.kind === 'ok' ? 0.35 : 0.22 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ position: 'fixed', inset: 0, zIndex: 150, pointerEvents: 'none',
                     background: flash.kind === 'ok' ? '#6BCB77' : '#FF6B6B' }}
          />
        )}
      </AnimatePresence>

      {/* Progress — a round solved only on a later try turns light red */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680, flexShrink: 0 }}>
        {times.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(doneSeg(i) ? 'done' : i === idx ? 'current' : 'todo'),
            ...(doneSeg(i) && missed.includes(i) ? { background: '#F3A091' } : {}),
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + task; the speaker reads the task and every answer */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, width: '100%', maxWidth: 680, flexShrink: 0 }}>
        <LumiCharacter mood={mood} size={60} />
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          style={{
            flex: 1, ...pxBubble,
            padding: '10px 16px',
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.2vw,22px)',
            color: 'var(--text-primary)',
          }}
        >{bubble}</motion.div>
        <HearOptions items={hearItems} size={52} label="Aufgabe und Antworten vorlesen" style={{ alignSelf: 'center' }} />
      </div>

      {/* Main interaction area */}
      <div ref={areaRef} style={{
        flex: 1, minHeight: 0, width: '100%', maxWidth: 1100,
        display: 'flex', flexDirection: wide ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center', gap,
      }}>
        <AnimatePresence mode="wait">
          <motion.div key={idx}
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{
              ...pxPanel,
              ...(status === 'right' ? { background: '#DDF6CF', borderColor: '#2F8F3A' } : {}),
              padding: panelPad, flexShrink: 0,
              transition: 'background 0.3s',
            }}
          >
            <ClockFace
              value={mode === 'set' ? hands : fromHM(t.h, t.m)}
              onChange={setHands}
              interactive={mode === 'set' && !resolved}
              level={level}
              highlightHands={status === 'hint'}
              size={clockPx}
            />
          </motion.div>
        </AnimatePresence>

        {/* READ MODE: pick the time */}
        {mode === 'read' && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 12, width: wide ? side.w : 'min(100%, 420px)', flexShrink: 0,
          }}>
            {options.map(opt => {
              const isAnswer = opt === t
              const isTried  = tried.includes(opt)
              const st = resolved && isAnswer ? 'right' : isTried && !isAnswer ? 'wrong' : undefined
              return (
                <motion.button key={`${opt.h}:${opt.m}`}
                  whileHover={!resolved && !isTried ? { scale: 1.05 } : {}}
                  whileTap={!resolved && !isTried ? { scale: 0.95 } : {}}
                  onClick={() => pickDigital(opt)}
                  {...hearable(say(opt))}
                  aria-label={say(opt)}
                  style={{
                    ...pxCard(st),
                    minHeight: wide ? 88 : 64, padding: '8px 10px',
                    fontFamily: 'var(--font-heading)', fontSize: wide ? 26 : 'clamp(18px,3.4vw,24px)',
                    fontWeight: 700, color: 'var(--text-primary)',
                    cursor: resolved || isTried ? 'default' : 'pointer',
                    opacity: isTried && !isAnswer ? 0.5 : 1,
                    transition: 'background 0.22s, border 0.22s, box-shadow 0.22s, opacity 0.2s',
                  }}
                >{label(opt, level)}</motion.button>
              )
            })}
          </div>
        )}

        {/* DAILY MODE: what happens at this time of day? */}
        {mode === 'daily' && (
          <div style={{
            display: 'flex', flexDirection: wide ? 'column' : 'row',
            gap: 12, width: wide ? side.w : 'min(100%, 480px)', flexShrink: 0,
          }}>
            {dailyOptions.map(act => {
              const isAnswer = act.id === t.activity.id
              const isTried  = tried.includes(act.id)
              const st = resolved && isAnswer ? 'right' : isTried && !isAnswer ? 'wrong' : undefined
              return (
                <motion.button key={act.id}
                  whileHover={!resolved && !isTried ? { scale: 1.05 } : {}}
                  whileTap={!resolved && !isTried ? { scale: 0.95 } : {}}
                  onClick={() => pickActivity(act)}
                  {...hearable(plain(act.label))}
                  aria-label={plain(act.label)}
                  style={{
                    ...pxCard(st),
                    flex: 1, minWidth: 0, minHeight: wide ? 88 : 96, padding: '8px 10px',
                    fontFamily: 'var(--font-heading)', fontSize: wide ? 20 : 'clamp(14px,2.8vw,18px)',
                    fontWeight: 700, color: 'var(--text-primary)',
                    cursor: resolved || isTried ? 'default' : 'pointer',
                    opacity: isTried && !isAnswer ? 0.5 : 1,
                    transition: 'background 0.22s, border 0.22s, box-shadow 0.22s, opacity 0.2s',
                    display: 'flex', flexDirection: wide ? 'row' : 'column',
                    alignItems: 'center', justifyContent: 'center', gap: wide ? 12 : 4,
                  }}
                >
                  <span style={{ fontSize: wide ? 48 : 38, lineHeight: 1, flexShrink: 0 }}>{act.icon}</span>
                  <span style={{ textAlign: 'center', hyphens: 'manual', overflowWrap: 'anywhere' }}>{act.label}</span>
                </motion.button>
              )
            })}
          </div>
        )}

        {/* SET MODE: ± for each hand — the non-drag way to set the clock */}
        {mode === 'set' && (
          <div style={{
            display: 'flex', flexDirection: wide ? 'column' : 'row',
            gap: wide ? 20 : 'clamp(14px,5vw,36px)', flexShrink: 0, alignItems: 'center',
          }}>
            {[['hour', 'Stundenzeiger', 60, HOUR_C], ['minute', 'Minutenzeiger', 5, MIN_C]].map(([kind, name, stepBy, color]) => (
              <div key={kind} {...hearable(kind === 'hour' ? 'Der kurze Zeiger' : 'Der lange Zeiger')}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <HandIcon kind={kind} />
                <StepButton label="−" color={color} disabled={resolved}
                  onPress={() => setHands(v => (v - stepBy + 720) % 720)} ariaLabel={`${name} zurück`} />
                <StepButton label="+" color={color} disabled={resolved}
                  onPress={() => setHands(v => (v + stepBy) % 720)} ariaLabel={`${name} vor`} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed slot for "Fertig" / "Weiter", so nothing jumps */}
      <div style={{ height: 60, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {resolved ? (
          <motion.button
            key="weiter"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, delay: 0.3 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={weiterClick}
            {...hearable('Weiter')}
            style={{
              ...pxButton('green'),
              // ink on green: white text reached only 2.2:1
              color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
              padding: '10px 44px', minHeight: 52,
              fontSize: 'clamp(18px,3.5vw,22px)',
            }}
          >Weiter! ➡️</motion.button>
        ) : mode === 'set' ? (
          <motion.button
            key="fertig"
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={submitAnalog}
            {...hearable('Fertig')}
            style={{
              ...pxButton('green'),
              color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
              padding: '10px 40px', minHeight: 52, fontSize: 20,
            }}
          >{'✅ Fertig!'}</motion.button>
        ) : null}
      </div>
    </div>
  )
}
