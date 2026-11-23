import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, Wish, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts } from '../components/play/index.js'
import { pxButton, INK } from './px.js'

/**
 * Kuckucks-Uhr — Uhrzeit lesen & stellen
 *
 * A cuckoo lives in a wooden clock and wants to come out at a certain time
 * ("Um drei Uhr gibt es Kuchen!"). The child turns the hands with a finger;
 * when the time is right the cuckoo pops out, calls as often as the hour
 * says and gets its treat. In between, four animals guess the time shown and
 * the child says who is right, or Lumi asks what happens at that time.
 *
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
// sentence "Um sieben Uhr …"; `mood` is what Lumi then does on the stage.
// Soft hyphens (­) let the long words break on a narrow card; speech
// drops them.
const DAILY_ACTIVITIES = [
  { id: 'aufstehen',    icon: '⏰',  label: 'Aufstehen',          does: 'steht Lumi auf',                h: 7,  m: 0,  mood: 'wow' },
  { id: 'kindergarten', icon: '🏫',  label: 'Kinder­garten',  does: 'geht Lumi in den Kindergarten', h: 9,  m: 0,  mood: 'happy' },
  { id: 'mittagessen',  icon: '🍽️', label: 'Mittag­essen',   does: 'isst Lumi zu Mittag',           h: 12, m: 0,  mood: 'eat' },
  { id: 'spielplatz',   icon: '🛝',  label: 'Spiel­platz',    does: 'geht Lumi auf den Spielplatz',  h: 3,  m: 0,  mood: 'dance' },
  { id: 'abendessen',   icon: '🍲',  label: 'Abend­essen',    does: 'isst Lumi zu Abend',            h: 6,  m: 0,  mood: 'eat' },
  { id: 'schlafen',     icon: '🛏️', label: 'Schlafen­gehen', does: 'geht Lumi schlafen',            h: 8,  m: 0,  mood: 'sleep' },
  { id: 'obst',         icon: '🍎',  label: 'Obst essen',         does: 'isst Lumi Obst',                h: 4,  m: 30, mood: 'eat' },
  { id: 'baden',        icon: '🛁',  label: 'Baden',              does: 'badet Lumi',                    h: 5,  m: 30, mood: 'happy' },
  { id: 'zaehne',       icon: '🪥',  label: 'Zähne putzen',       does: 'putzt Lumi die Zähne',          h: 7,  m: 30, mood: 'happy' },
]
const plain = text => text.replace(/­/g, '')
const activitiesFor = level => DAILY_ACTIVITIES.filter(a => level >= 4 || a.m === 0)

// What the cuckoo is waiting for in a setting round: "Um drei Uhr gibt es …"
const TREATS = [
  { icon: '🍰', name: 'Kuchen' }, { icon: '🍦', name: 'Eis' }, { icon: '🍪', name: 'Kekse' },
  { icon: '🍕', name: 'Pizza' }, { icon: '🧁', name: 'Muffins' }, { icon: '🍓', name: 'Erdbeeren' },
]

// The four animals who guess the time in a reading round
const GUESSERS = ['🐰', '🐻', '🐸', '🦉']

// Every third round asks what happens at a time instead of reading or
// setting it, so the face connects to the child's own day. The activity is
// drawn at random and never twice in a level: it used to be the same four in
// the same order every time, and Abendessen/Schlafengehen never came up.
function generateRounds(level) {
  const tier  = tierFor(level)
  const count = level <= 5 ? 8 : 10
  const acts  = shuffle(activitiesFor(level))
  const treats = shuffle(TREATS)
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
    rounds.push({ ...t, treat: treats[i % treats.length] })
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

// What the child sees in a bubble: the spoken form up to level 6, the
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

// How often the cuckoo calls: the hour at a full hour, once otherwise —
// like a real cuckoo clock, so the calls count the hour out loud.
const callsFor = t => (t.m === 0 ? (t.h % 12 || 12) : 1)

// The cuckoo's own call, two falling notes. Local, because no game but
// this one has a cuckoo.
let audio = null
function cuckooCall() {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume().catch(() => {})
    ;[[784, 0], [622, 0.17]].forEach(([f, d]) => {
      const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + d
      o.type = 'triangle'; o.frequency.setValueAtTime(f, t0)
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16)
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.18)
    })
  } catch { /* no audio */ }
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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
        width: 56, height: 56, borderRadius: 14,
        background: color, color: 'white', border: `3px solid ${INK}`,
        textShadow: '0 2px 0 rgba(0,0,0,0.3)',
        fontSize: 28, fontWeight: 800, lineHeight: 1,
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
    <svg width={44} height={44} viewBox="0 0 34 34" aria-hidden="true" style={{ flexShrink: 0 }}>
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

// ── The cuckoo clock ─────────────────────────────────────────────────────────
// A wooden house (viewBox 300 × 360) around the face: a roof with the
// cuckoo's door in the gable, the body with the face, a pendulum and two
// pine-cone weights below. The face sits at (150, 192) in a 216-unit box,
// so the house is 300/216 of the face wide and 360/216 high.
const HOUSE_W = 300 / 216, HOUSE_H = 360 / 216
const WOOD = '#B5733A', WOOD_DARK = '#8A4F22', WOOD_LIGHT = '#D9A066'

const CLOCK_CSS = `
@keyframes cu-swing { 0%,100% { transform: rotate(13deg); } 50% { transform: rotate(-13deg); } }
.cu-pend { animation: cu-swing 1.6s ease-in-out infinite; transform-origin: 150px 298px; }
.cu-paused .cu-pend { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .cu-pend { animation: none; } }
`

/**
 * bird: 'in' behind the closed door · 'peek' looking out, waiting ·
 * 'out' popped out on its perch · 'puzzled' out, but it is not time yet ·
 * 'eat' out, eating its treat
 */
function CuckooClock({ size, bird, calls, treat, wish, paused, onDoor, children }) {
  const w = size * HOUSE_W, h = size * HOUSE_H
  const out = bird === 'out' || bird === 'puzzled' || bird === 'eat'
  const doorOpen = out ? 0.12 : bird === 'peek' ? 0.55 : 1
  const birdPx = w * 0.3
  return (
    <div className={paused ? 'cu-paused' : undefined} style={{ position: 'relative', width: w, height: h, flexShrink: 0 }}>
      <style>{CLOCK_CSS}</style>
      <svg viewBox="0 0 300 360" width={w} height={h} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.25))' }}>
        {/* pendulum and weights hang behind the body */}
        <g className="cu-pend">
          <line x1="150" y1="290" x2="150" y2="340" stroke={INK} strokeWidth="4" />
          <circle cx="150" cy="344" r="14" fill="#FFC93C" stroke={INK} strokeWidth="3.5" />
          <circle cx="146" cy="340" r="4" fill="#fff" opacity="0.7" />
        </g>
        {[96, 204].map(x => (
          <g key={x}>
            <line x1={x} y1="290" x2={x} y2="318" stroke={INK} strokeWidth="2.5" strokeDasharray="4 3" />
            <ellipse cx={x} cy="334" rx="10" ry="17" fill="#7A4A22" stroke={INK} strokeWidth="3" />
            <path d={`M${x - 8} 326 h16 M${x - 9} 334 h18 M${x - 8} 342 h16`} stroke="#5A3416" strokeWidth="2" />
          </g>
        ))}
        {/* body */}
        <rect x="24" y="86" width="252" height="212" rx="16" fill={WOOD} stroke={INK} strokeWidth="4" />
        <rect x="34" y="96" width="232" height="192" rx="12" fill="none" stroke={WOOD_LIGHT} strokeWidth="3" opacity="0.7" />
        {/* roof with the door in the gable */}
        <polygon points="2,100 150,4 298,100" fill={WOOD_DARK} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <polygon points="34,90 150,26 266,90" fill={WOOD_LIGHT} />
        <path d="M70 76 L150 32 L230 76" fill="none" stroke={WOOD} strokeWidth="3" />
        <rect x="122" y="40" width="56" height="44" rx="7" fill="#2a1b3d" />
        {/* two carved leaves on the peak */}
        <ellipse cx="136" cy="10" rx="14" ry="6" fill="#5CC45A" stroke={INK} strokeWidth="2.5" transform="rotate(-25 136 10)" />
        <ellipse cx="164" cy="10" rx="14" ry="6" fill="#5CC45A" stroke={INK} strokeWidth="2.5" transform="rotate(25 164 10)" />
        {/* the perch the cuckoo stands on */}
        {out && <rect x="128" y="82" width="44" height="7" rx="3" fill={WOOD_DARK} stroke={INK} strokeWidth="2.5" />}
      </svg>

      {/* the face */}
      <div style={{ position: 'absolute', left: '14%', top: `${(84 / 360) * 100}%`, width: size, height: size }}>
        {children}
      </div>

      {/* the cuckoo */}
      <motion.div aria-hidden="true"
        initial={false}
        animate={{
          opacity: bird === 'in' ? 0 : 1,
          scale: out ? 1 : bird === 'peek' ? 0.5 : 0.3,
          y: out ? -birdPx * 0.12 : birdPx * 0.12,
          rotate: bird === 'puzzled' ? [0, -16, 12, -10, 0] : 0,
        }}
        transition={{ type: 'spring', stiffness: 420, damping: 15 }}
        style={{ position: 'absolute', left: (w - birdPx) / 2, top: h * (62 / 360) - birdPx * 0.62, width: birdPx, height: birdPx, pointerEvents: 'none', zIndex: 2 }}>
        <motion.div key={calls} initial={{ scaleY: 1 }} animate={calls ? { scaleY: [1, 0.8, 1.12, 1], y: [0, 4, -6, 0] } : {}} transition={{ duration: 0.28 }}>
          <motion.div animate={bird === 'eat' && !reduceMotion() ? { scaleY: [1, 0.85, 1.08, 0.88, 1.04, 1] } : {}} transition={{ duration: 0.9 }}>
            <Art art="🐦" size={birdPx} />
          </motion.div>
        </motion.div>
        {bird === 'puzzled' && (
          <span style={{ position: 'absolute', top: -birdPx * 0.25, right: -birdPx * 0.1, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: birdPx * 0.45, color: '#6b3fd6', WebkitTextStroke: `2px ${INK}` }}>?</span>
        )}
      </motion.div>

      {/* the door's two leaves, over the bird while it is inside; a tap peeks */}
      <svg viewBox="0 0 300 360" width={w} height={h} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 3 }}>
        {[122, 150].map(x => (
          <motion.rect key={x} x={x} y="40" width="28" height="44" rx="4"
            fill={WOOD} stroke={INK} strokeWidth="3"
            initial={false} animate={{ scaleX: doorOpen }} transition={{ type: 'spring', stiffness: 300, damping: 18 }}
            style={{ originX: x === 122 ? 0 : 1, originY: 0.5 }} />
        ))}
        <rect x="114" y="34" width="72" height="56" fill="transparent" style={{ pointerEvents: onDoor ? 'auto' : 'none', cursor: 'pointer' }} onClick={onDoor} />
      </svg>

      {/* how many times it has called */}
      <AnimatePresence>
        {calls > 0 && (
          <motion.div key={calls} aria-hidden="true"
            initial={{ scale: 0.3, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.4 }}
            transition={{ duration: 0.18 }}
            style={{
              position: 'absolute', top: h * 0.02, left: w * 0.06, zIndex: 4,
              width: w * 0.2, height: w * 0.2, borderRadius: '50%', background: '#FFC93C', border: `3px solid ${INK}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: w * 0.11, color: INK,
            }}>{calls}</motion.div>
        )}
      </AnimatePresence>

      {/* the treat lands on the perch */}
      <AnimatePresence>
        {treat && (
          <motion.div aria-hidden="true" key="treat"
            initial={{ y: -h * 0.3, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: [0.6, 1, 1, 0.7, 0.4] }} exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 1.6, y: { type: 'spring', stiffness: 380, damping: 14 } }}
            style={{ position: 'absolute', left: w * 0.2, top: h * 0.12, zIndex: 4, pointerEvents: 'none' }}>
            <Art art={treat} size={w * 0.2} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* what the cuckoo is waiting for */}
      {wish && (
        <div style={{ position: 'absolute', left: '50%', top: 0, width: 0, height: 0, zIndex: 5 }}>
          <Wish side="top" size={110}>{wish}</Wish>
        </div>
      )}
    </div>
  )
}

// One of the animals guessing the time in a reading round. The whole card
// is the answer; the time stands in its speech bubble, and the animal bobs
// while its guess is read out.
function Guesser({ art, text, speaking, state, onPick, hear, compact }) {
  const dim = state === 'tried' || state === 'oops'
  return (
    <motion.button
      onClick={onPick} {...hearable(hear)} aria-label={hear}
      whileTap={state ? {} : { scale: 0.94 }}
      animate={state === 'right' ? { y: [0, -26, 0, -10, 0] } : state === 'oops' ? { rotate: [0, -10, 8, -5, 0] } : speaking ? { y: [0, -6, 0] } : { y: 0, rotate: 0 }}
      transition={speaking ? { duration: 0.5, repeat: Infinity } : { duration: 0.7 }}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: state ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, minHeight: 64, minWidth: 0,
        opacity: dim ? 0.45 : 1, transition: 'opacity .3s',
      }}>
      <Art art={art} size={compact ? 52 : 64} />
      <span style={{
        position: 'relative', flex: 1, minWidth: 0, padding: compact ? '8px 8px' : '10px 12px', borderRadius: 16,
        background: state === 'right' ? '#DDF6CF' : speaking ? '#FFF1BF' : '#FFFDF7',
        border: `3px solid ${state === 'right' ? '#2F8F3A' : INK}`,
        boxShadow: '0 4px 0 rgba(42,27,61,0.25)',
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: compact ? 17 : 21, color: INK, textAlign: 'center',
        transition: 'background .2s',
      }}>{text}</span>
    </motion.button>
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
  const paused    = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [idx,     setIdx]     = useState(0)
  // null · 'hint' after a first miss · 'right' · 'shown' after a second miss
  const [status,  setStatus]  = useState(null)
  const [tried,   setTried]   = useState([])       // options already tapped this round
  const [hands,   setHands]   = useState(0)        // the set-mode hands, minutes since 12:00
  const [bird,    setBird]    = useState('in')
  const [calls,   setCalls]   = useState(0)
  const [treatOut, setTreatOut] = useState(false)
  const [speaking, setSpeaking] = useState(null)   // guesser being read out
  const [picked,  setPicked]  = useState(null)     // guesser / activity just tapped
  const [lumiMood, setLumiMood] = useMood()
  const [lumiDoes, setLumiDoes] = useState(null)   // activity Lumi is doing
  const [bursts, burst] = useBursts()
  const missed    = useRef(new Set())               // rounds with a miss
  const tweenRef  = useRef(null)
  const timers    = useRef([])
  const areaRef   = useRef(null)
  const area      = useSize(areaRef)

  const t = times[idx]
  // 'read' = who says the right time · 'set' = put the hands there ·
  // 'daily' = what happens at this time of day
  const mode = t?.activity ? 'daily' : (idx % 3 === 0 ? 'read' : 'set')
  const resolved = status === 'right' || status === 'shown'

  // Timers of the round: they wait while the help is open and end with it
  const later = useCallback((fn, ms) => {
    const run = () => { if (pausedRef.current) timers.current.push(setTimeout(run, 250)); else fn() }
    timers.current.push(setTimeout(run, ms))
  }, [])
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  const task = !t ? ''
    : mode === 'read'  ? 'Wie spät ist es? Wer hat recht?'
    : mode === 'daily' ? 'Was macht Lumi, wenn die Uhr so aussieht?'
    :                    `Um ${say(t)} gibt es ${t.treat.name}! Stell die Uhr auf ${say(t)}.`

  const options      = useMemo(() => (t && mode === 'read' ? readOptions(t, level) : []), [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  const dailyOptions = useMemo(() => {
    if (!t?.activity) return []
    const others = shuffle(activitiesFor(level).filter(a => a.id !== t.activity.id)).slice(0, 2)
    return shuffle([t.activity, ...others])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // The task; in a reading round each animal's guess follows, and the
  // animal bobs while it is read
  const readout = useRef(0)       // a tap ends the reading of the guesses
  const speakTask = useCallback(() => {
    if (mode !== 'read') { sayTask(task); return }
    const run = ++readout.current
    const next = i => {
      if (run !== readout.current) return
      if (i >= options.length) { setSpeaking(null); return }
      setSpeaking(i)
      narrate([{ text: say(options[i]), gap: 200 }], { onEnd: () => next(i + 1) })
    }
    sayTask(task, { onEnd: () => next(0) })
  }, [mode, task, options])

  // New round: hands somewhere clearly wrong, then the task
  useEffect(() => {
    if (!t) return
    setStatus(null); setTried([]); setCalls(0); setTreatOut(false); setSpeaking(null); setPicked(null); setLumiDoes(null)
    setBird(mode === 'set' ? 'peek' : 'in')
    cancelAnimationFrame(tweenRef.current)
    let start
    do { start = fromHM(rand(1, 12), rand(0, 11) * 5) }
    while (timeDiffMin(toHM(start).h, toHM(start).m, t.h, t.m) <= 60)
    setHands(start)
    lockPreviews()
    const id = setTimeout(speakTask, 450)
    return () => { clearTimeout(id); clearTimers() }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { cancelAnimationFrame(tweenRef.current); clearTimers() }, [])

  // The cuckoo pops out and calls: as often as the hour at a full hour
  const ring = useCallback((then) => {
    setBird('out')
    sfx.slideUp()
    const n = callsFor(t)
    const call = k => {
      if (k > n) { setCalls(0); then?.(); return }
      setCalls(k); cuckooCall()
      later(() => call(k + 1), 420)
    }
    later(() => call(1), 380)
  }, [t, later])

  const nextRound = useCallback(() => {
    if (idx + 1 >= times.length) {
      sfx.complete()
      afterNarration(() => onComplete(result(times.length - missed.current.size, times.length)), { minMs: 500 })
    } else {
      setIdx(i => i + 1)
    }
  }, [idx, times.length, onComplete])

  // After a right answer the next round comes by itself
  const right = useCallback((praise, at) => {
    setStatus('right')
    setSpeaking(null)
    sfx.correct()
    if (at) burst(at, 'stars')
    ring(() => {
      // now and then a full cuckoo burps — the classic giggle
      if (mode === 'set') { setTreatOut(true); setBird('eat'); sfx.chomp(); if (Math.random() < 0.3) later(sfx.burp, 900) }
      sayRight(praise, { onEnd: () => later(nextRound, 700) })
    })
  }, [mode, ring, burst, later, nextRound])

  // After a second miss in set mode the hands glide to the right place
  const showOnClock = useCallback((then) => {
    const from = hands, to = fromHM(t.h, t.m)
    let delta = ((to - from) % 720 + 720) % 720
    if (delta > 360) delta -= 720
    const t0 = performance.now(), dur = 1100
    const step = (now) => {
      const k = Math.min(1, (now - t0) / dur)
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      setHands(((Math.round(from + delta * e) % 720) + 720) % 720)
      if (k < 1) tweenRef.current = requestAnimationFrame(step)
      else then?.()
    }
    tweenRef.current = requestAnimationFrame(step)
  }, [hands, t])

  // First miss: a hint and another try. Second miss: show and say the answer.
  // The cuckoo looks out, puzzled — it is not its time yet.
  const wrong = useCallback((hint, reveal) => {
    missed.current.add(idx)
    setSpeaking(null)
    sfx.boing()
    setBird('puzzled')
    if (status === 'hint') {
      setStatus('shown')
      sayWrong(reveal)
      later(() => ring(), 900)
    } else {
      setStatus('hint')
      sayWrong(hint)
      later(() => setBird(mode === 'set' ? 'peek' : 'in'), 1300)
    }
  }, [idx, status, mode, later, ring])

  const pickGuess = useCallback((opt, i, e) => {
    if (resolved || tried.includes(i)) return
    readout.current++
    setTried(tr => [...tr, i])
    setPicked(i)
    if (opt === t) right(`Es ist ${say(t)}.`, e.currentTarget)
    else wrong(readHint(t.m), `Es ist ${say(t)}. ${describeHands(t.h, t.m)}`)
  }, [resolved, tried, t, right, wrong])

  // An activity given to Lumi: Lumi does it, or hands it back
  const giveActivity = useCallback((act) => {
    if (resolved || tried.includes(act.id)) return false
    setTried(tr => [...tr, act.id])
    if (act.id === t.activity.id) {
      setLumiDoes(act); setLumiMood(act.mood, 0)
      right(`Um ${say(t)} ${act.does}.`)
      return true
    }
    setLumiMood('oops')
    const last = status === 'hint'
    wrong(`Es ist ${say(t)}. Was macht Lumi da?`, `Um ${say(t)} ${t.activity.does}.`)
    if (last) { setLumiDoes(t.activity); setLumiMood(t.activity.mood, 0) }
    return false
  }, [resolved, tried, t, status, right, wrong, setLumiMood])

  const submitAnalog = useCallback((e) => {
    if (resolved || bird === 'puzzled') return
    const cur = toHM(hands)
    if (timeDiffMin(cur.h, cur.m, t.h, t.m) <= TOLERANCE[tier]) { right(`Es ist ${say(t)}.`, e.currentTarget); return }
    // Which hand is off? The minute hand alone decides "halb", "Viertel" …
    const minuteOk = Math.min(Math.abs(cur.m - t.m), 60 - Math.abs(cur.m - t.m)) <= TOLERANCE[tier]
    const hint = minuteOk
      ? 'Der lange Zeiger stimmt schon. Schau noch einmal auf den kurzen Zeiger.'
      : cur.h % 12 === t.h % 12
        ? 'Der kurze Zeiger stimmt schon. Schau noch einmal auf den langen Zeiger.'
        : 'Der kurze Zeiger zeigt die Stunde, der lange Zeiger die Minuten. Versuch es noch einmal.'
    if (status === 'hint') {
      missed.current.add(idx)
      setStatus('shown')
      sfx.boing()
      sayWrong(`Schau, so sieht ${say(t)} aus. ${describeHands(t.h, t.m)}`)
      showOnClock(() => ring())
      return
    }
    wrong(hint)
  }, [resolved, bird, hands, t, tier, status, idx, right, wrong, showOnClock, ring])

  // A tap on the closed door: the cuckoo peeks out and giggles
  const peek = () => {
    if (bird !== 'in') return
    sfx.giggle(); setBird('peek')
    later(() => setBird(b => (b === 'peek' ? 'in' : b)), 900)
  }

  // ── Layout: the clock takes what is left of the height ───────────────────
  const wide    = area.w > area.h * 1.15 && area.w >= 560
  const compact = area.w < 520
  const side    = mode === 'read'  ? (wide ? { w: 340, h: 0 } : { w: 0, h: compact ? 150 : 160 })
                : mode === 'daily' ? (wide ? { w: 300, h: 0 } : { w: 0, h: compact ? 140 : 150 })
                :                    (wide ? { w: 230, h: 0 } : { w: 0, h: compact ? 136 : 80 })
  const gap     = 16
  const headroom = 58     // the cuckoo's wish bubble above the roof
  const clockPx = Math.max(120, Math.floor(Math.min(
    ((wide ? area.h : area.h - side.h - gap) - headroom) / HOUSE_H,
    (wide ? area.w - side.w - gap : area.w) / HOUSE_W,
    420,
  )))

  if (!t) return null

  const wish = mode === 'set' && !resolved
    ? <><Art art={t.treat.icon} size={38} /><span>{label(t, level)}</span></>
    : null

  const fertig = (
    <motion.button key="fertig"
      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.94 }}
      onClick={submitAnalog} disabled={resolved}
      {...hearable('Fertig')} aria-label="Fertig"
      style={{
        ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
        padding: '6px 22px 6px 12px', minHeight: 60, fontSize: 22, opacity: resolved ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: 8,
      }}><Art art="🐦" size={44} />Fertig!</motion.button>
  )

  const steppers = [['hour', 'Stundenzeiger', 60, HOUR_C], ['minute', 'Minutenzeiger', 5, MIN_C]].map(([kind, name, stepBy, color]) => (
    <div key={kind} {...hearable(kind === 'hour' ? 'Der kurze Zeiger' : 'Der lange Zeiger')}
      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <HandIcon kind={kind} />
      <StepButton label="−" color={color} disabled={resolved}
        onPress={() => setHands(v => (v - stepBy + 720) % 720)} ariaLabel={`${name} zurück`} />
      <StepButton label="+" color={color} disabled={resolved}
        onPress={() => setHands(v => (v + stepBy) % 720)} ariaLabel={`${name} vor`} />
    </div>
  ))

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,1.6vw,18px) clamp(12px,3vw,32px) clamp(14px,2vw,22px)',
      gap: 'clamp(6px,1.2dvh,12px)', overflow: 'hidden', position: 'relative',
    }}>
      {bursts}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 760, flexShrink: 0 }}>
        <RoundTrail total={times.length} done={idx + (resolved ? 1 : 0)} walker="🐦" goal="🎂" style={{ flex: 1 }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={speakTask} aria-label="Aufgabe noch einmal hören"
          style={{
            width: 52, height: 52, flexShrink: 0, background: 'var(--px-gold)', border: `3px solid ${INK}`, borderRadius: 12,
            boxShadow: `inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -5px 0 rgba(0,0,0,0.2), 0 4px 0 ${INK}`,
            cursor: 'pointer', fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔊</motion.button>
      </div>

      <DragArea autoTarget="lumi" disabled={resolved}>
      <div ref={areaRef} style={{
        flex: 1, minHeight: 0, width: '100%', maxWidth: 1180,
        display: 'flex', flexDirection: wide ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center', gap,
      }}>
        <div style={{ paddingTop: headroom, flexShrink: 0 }}>
          <CuckooClock size={clockPx} bird={bird} calls={calls} paused={paused}
            treat={treatOut && t.treat ? t.treat.icon : null} wish={wish}
            onDoor={mode !== 'set' && !resolved ? peek : null}>
            <ClockFace
              value={mode === 'set' ? hands : fromHM(t.h, t.m)}
              onChange={setHands}
              interactive={mode === 'set' && !resolved}
              level={level}
              highlightHands={status === 'hint'}
              size={clockPx}
            />
          </CuckooClock>
        </div>

        {/* READ: four animals guess, the child says who is right */}
        {mode === 'read' && (
          <div style={{
            display: 'grid', gridTemplateColumns: wide ? '1fr' : '1fr 1fr',
            gap: wide ? 12 : 8, width: wide ? side.w : 'min(100%, 560px)', flexShrink: 0,
          }}>
            {options.map((opt, i) => {
              const isAnswer = opt === t
              const state = resolved && isAnswer ? 'right' : !tried.includes(i) ? null : picked === i && !resolved ? 'oops' : 'tried'
              return (
                <Guesser key={`${opt.h}:${opt.m}`} art={GUESSERS[i]} text={label(opt, level)} hear={say(opt)}
                  speaking={speaking === i} state={state} compact={compact}
                  onPick={e => pickGuess(opt, i, e)} />
              )
            })}
          </div>
        )}

        {/* DAILY: give Lumi what happens at this time */}
        {mode === 'daily' && (
          <div style={{
            display: 'flex', flexDirection: wide ? 'column' : 'row', alignItems: 'center',
            gap: wide ? 14 : 10, width: wide ? side.w : 'min(100%, 600px)', flexShrink: 0, justifyContent: 'center',
          }}>
            <DropZone id="lumi" label="Lumi" onDrop={giveActivity} slop={30}>
              {hover => (
                <div style={{ position: 'relative' }}>
                  <Critter art="lumi" size={compact ? 84 : wide ? 120 : 100} mood={hover ? 'hungry' : lumiMood} talks
                    wish={lumiDoes ? <Art art={lumiDoes.icon} size={compact ? 34 : 44} /> : <span style={{ fontSize: 28 }}>?</span>}
                    wishSide={wide ? 'top' : 'right'} label="Lumi" />
                </div>
              )}
            </DropZone>
            <div style={{ display: 'flex', gap: compact ? 8 : 12, flex: wide ? undefined : 1, justifyContent: 'center' }}>
              {dailyOptions.map(act => {
                const gone = lumiDoes?.id === act.id
                const isTried = tried.includes(act.id) && !gone
                return (
                  <Draggable key={act.id} id={act.id} data={act} label={plain(act.label)} disabled={isTried || resolved}
                    style={{ visibility: gone ? 'hidden' : 'visible', opacity: isTried ? 0.4 : 1 }}>
                    <div {...hearable(plain(act.label))} style={{
                      width: compact ? 82 : 92, padding: '8px 4px 6px', boxSizing: 'border-box', borderRadius: 16,
                      background: '#FFFDF7', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.25)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}>
                      <Art art={act.icon} size={compact ? 50 : 58} />
                      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 13, color: INK, textAlign: 'center', lineHeight: 1.1, hyphens: 'manual', overflowWrap: 'anywhere' }}>{act.label}</span>
                    </div>
                  </Draggable>
                )
              })}
            </div>
          </div>
        )}

        {/* SET: ± for each hand — the non-drag way to set the clock — and
            the button that lets the cuckoo out */}
        {mode === 'set' && (
          <div style={{
            display: 'flex', flexDirection: wide || compact ? 'column' : 'row', flexWrap: 'wrap',
            gap: wide ? 18 : 12, flexShrink: 0, alignItems: 'center', justifyContent: 'center',
          }}>
            {compact ? <div style={{ display: 'flex', gap: 14 }}>{steppers}</div> : steppers}
            {fertig}
          </div>
        )}
      </div>
      </DragArea>

      {/* After a second miss the answer stays up until the child moves on */}
      <AnimatePresence>
        {status === 'shown' && (
          <motion.button key="weiter"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, delay: 1.2 }}
            whileTap={{ scale: 0.94 }}
            onClick={nextRound}
            {...hearable('Weiter')}
            style={{
              ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
              position: 'absolute', right: 'clamp(12px,3vw,32px)', bottom: 'clamp(12px,2vw,24px)', zIndex: 6,
              padding: '10px 36px', minHeight: 56, fontSize: 'clamp(18px,3.5vw,22px)',
            }}
          >Weiter! ➡️</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
