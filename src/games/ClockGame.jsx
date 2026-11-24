import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, Wish, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts } from '../components/play/index.js'
import { pxButton, INK } from './px.js'

/**
 * Kuckucks-Uhr — Uhrzeit lesen & stellen
 *
 * A cuckoo lives in a wooden clock and wants to come out at a certain time,
 * for a treat. Its wish bubble shows the treat and the time as a picture:
 * a blue number for the short hand and a red wedge for how far the long
 * hand has gone round (from level 7 the digital time). The child turns the
 * hands with a finger; when the time is right the cuckoo pops out, calls as
 * often as the hour says and eats its treat. In between, animals hold up
 * their guess of the time shown and the child taps the one who is right,
 * or gives Lumi the picture of what happens at that time.
 *
 * Nothing needs reading or listening: a miss makes the hand that is off
 * pulse, and a hand shows what to do when a child waits.
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
// 12-hour face. The half-hour ones join from level 4. `mood` is what Lumi
// does once given the picture. Soft hyphens (­) let the long words
// break on a narrow card.
const DAILY_ACTIVITIES = [
  { id: 'aufstehen',    icon: '⏰',  label: 'Aufstehen',               h: 7,  m: 0,  mood: 'wow' },
  { id: 'kindergarten', icon: '🏫',  label: 'Kinder­garten',      h: 9,  m: 0,  mood: 'happy' },
  { id: 'mittagessen',  icon: '🍽️', label: 'Mittag­essen',       h: 12, m: 0,  mood: 'eat' },
  { id: 'spielplatz',   icon: '🛝',  label: 'Spiel­platz',        h: 3,  m: 0,  mood: 'dance' },
  { id: 'abendessen',   icon: '🍲',  label: 'Abend­essen',        h: 6,  m: 0,  mood: 'eat' },
  { id: 'schlafen',     icon: '🛏️', label: 'Schlafen­gehen',     h: 8,  m: 0,  mood: 'sleep' },
  { id: 'obst',         icon: '🍎',  label: 'Obst essen',              h: 4,  m: 30, mood: 'eat' },
  { id: 'baden',        icon: '🛁',  label: 'Baden',                   h: 5,  m: 30, mood: 'happy' },
  { id: 'zaehne',       icon: '🪥',  label: 'Zähne putzen',            h: 7,  m: 30, mood: 'happy' },
]
const plain = text => text.replace(/­/g, '')
const activitiesFor = level => DAILY_ACTIVITIES.filter(a => level >= 4 || a.m === 0)

// What the cuckoo is waiting for in a setting round
const TREATS = ['🍰', '🍦', '🍪', '🍕', '🧁', '🍓', '🍩', '🍎']

// The animals who guess the time in a reading round, four of them each time
const GUESSERS = ['🐰', '🐻', '🐸', '🦉', '🐱', '🐶', '🐷', '🐭', '🦔', '🐢']

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

// Uhrzeit so, wie man sie einem Kind sagt — für eine Zeigeruhr. Sie steht
// nur noch als Name für Bildschirmleser an den Antworten ("halb drei").
const MIN_WORD = { 5: 'fünf', 10: 'zehn', 20: 'zwanzig' }
function toGermanTime(h, m) {
  const cur = h % 12 === 0 ? 12 : h % 12
  const nxt = cur % 12 + 1
  if (m === 0)  return `${cur} Uhr`
  if (m === 15) return `Viertel nach ${cur}`
  if (m === 30) return `halb ${nxt}`
  if (m === 45) return `Viertel vor ${nxt}`
  if (m === 25) return `fünf vor halb ${nxt}`
  if (m === 35) return `fünf nach halb ${nxt}`
  if (m < 30 && MIN_WORD[m])      return `${MIN_WORD[m]} nach ${cur}`
  if (m > 30 && MIN_WORD[60 - m]) return `${MIN_WORD[60 - m]} vor ${nxt}`
  return `${cur}:${String(m).padStart(2, '0')} Uhr`
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
// `highlight` ('hour' | 'minute' | 'both') makes a hand pulse after a miss:
// the one that is off, so the child's eye goes where the mistake is.
function ClockFace({ value, onChange, interactive, level, highlight, size }) {
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
  const pulseHour   = highlight === 'hour' || highlight === 'both'
  const pulseMinute = highlight === 'minute' || highlight === 'both'

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
          ring, and the digits keep a light outline so they stay readable. */}
      <motion.line
        x1={CX} y1={CY}
        x2={hourEnd.x} y2={hourEnd.y}
        stroke={HOUR_C}
        strokeLinecap="round"
        animate={pulseHour ? { strokeWidth: [9, 16, 9] } : { strokeWidth: 9 }}
        transition={pulseHour ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
        style={{ pointerEvents: 'none' }}
      />
      {/* Minute hand — when both pulse, on the offbeat */}
      <motion.line
        x1={CX} y1={CY}
        x2={minuteEnd.x} y2={minuteEnd.y}
        stroke={MIN_C}
        strokeLinecap="round"
        animate={pulseMinute ? { strokeWidth: [5, 11, 5] } : { strokeWidth: 5 }}
        transition={pulseMinute ? { duration: 0.9, repeat: Infinity, delay: highlight === 'both' ? 0.45 : 0 } : { duration: 0.2 }}
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
 * 'eat' out, eating its treat. `hat`: a streak of right answers, the
 * cuckoo dresses up.
 */
function CuckooClock({ size, bird, calls, treat, wish, hat, paused, onDoor, children }) {
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
          {hat && out && (
            <motion.div initial={{ y: -birdPx * 0.6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}
              style={{ position: 'absolute', left: birdPx * 0.18, top: -birdPx * 0.28 }}>
              <Art art="🎩" size={birdPx * 0.45} />
            </motion.div>
          )}
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
          <motion.div aria-hidden="true" key={treat}
            initial={{ y: -h * 0.3, opacity: 0, scale: 0.6 }} animate={{ y: 0, opacity: 1, scale: [0.6, 1, 1, 0.7, 0.4] }} exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 1.6, y: { type: 'spring', stiffness: 380, damping: 14 } }}
            style={{ position: 'absolute', left: w * 0.2, top: h * 0.12, zIndex: 4, pointerEvents: 'none' }}>
            <Art art={treat} size={w * 0.2} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* what the cuckoo is waiting for, beside its door so it never hides it */}
      {wish && (
        <div style={{ position: 'absolute', left: '24%', top: 0, width: 0, height: 0, zIndex: 5 }}>
          <Wish side="top" size={110}>{wish}</Wish>
        </div>
      )}
    </div>
  )
}

// A time as a picture, for children who cannot read "halb fünf": the
// number of the hour the short hand has passed, in its blue, and a red
// wedge for how far the long hand has gone round from the top. From
// level 7 the digital time.
function TimeToken({ t, level, size = 54 }) {
  if (showDigital(level)) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', height: size * 0.8, padding: '0 10px', borderRadius: 10,
        background: '#2a1b3d', color: '#9CFFB0', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.42,
        letterSpacing: 1, boxShadow: 'inset 0 -3px 0 rgba(0,0,0,0.4)',
      }}>{t.h}:{String(t.m).padStart(2, '0')}</span>
    )
  }
  const a = t.m * 6 * Math.PI / 180
  const end = [50 + 42 * Math.sin(a), 50 - 42 * Math.cos(a)]
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="50" cy="50" r="46" fill="#FFFDF7" stroke={INK} strokeWidth="5" />
      {t.m > 0 && <path d={`M50 50 L50 8 A42 42 0 ${t.m > 30 ? 1 : 0} 1 ${end[0]} ${end[1]} Z`} fill="#F7C1B6" />}
      <line x1="50" y1="50" x2={end[0]} y2={end[1]} stroke={MIN_C} strokeWidth="6" strokeLinecap="round" />
      <text x="50" y="66" textAnchor="middle" fontSize="44" fontWeight="800" fill={HOUR_C}
        stroke="#FFFDF7" strokeWidth="7" paintOrder="stroke" fontFamily="var(--font-heading, system-ui)">{t.h % 12 || 12}</text>
    </svg>
  )
}

// One of the animals guessing the time in a reading round: it holds up
// its guess, and the whole card is the answer.
function Guesser({ art, t, level, state, onPick, compact }) {
  return (
    <motion.button
      onClick={onPick} aria-label={toGermanTime(t.h, t.m)}
      initial={{ scale: 0.4, opacity: 0 }}
      whileTap={state ? {} : { scale: 0.92 }}
      animate={state === 'right' ? { scale: 1, opacity: 1, y: [0, -26, 0, -10, 0] }
        : state === 'oops' ? { scale: 1, opacity: 0.45, rotate: [0, -10, 8, -5, 0] }
        : { scale: 1, opacity: state === 'tried' ? 0.45 : 1, y: 0, rotate: 0 }}
      transition={{ duration: 0.7 }}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: state ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 72, minWidth: 0,
      }}>
      <Art art={art} size={compact ? 54 : 70} />
      <span style={{
        padding: 6, borderRadius: 18,
        background: state === 'right' ? '#DDF6CF' : '#FFFDF7',
        border: `3px solid ${state === 'right' ? '#2F8F3A' : INK}`,
        boxShadow: '0 4px 0 rgba(42,27,61,0.25)', display: 'flex',
      }}><TimeToken t={t} level={level} size={compact ? 50 : 62} /></span>
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

// Where the hint hand shows turning a hand: two points on the face
const ANCHOR = deg => ({ left: `${50 + 32 * Math.sin(deg * Math.PI / 180)}%`, top: `${50 - 32 * Math.cos(deg * Math.PI / 180)}%` })

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
  const [moved,   setMoved]   = useState(false)    // the child has turned a hand
  const [pulse,   setPulse]   = useState(null)     // the hand that is off
  const [bird,    setBird]    = useState('in')
  const [calls,   setCalls]   = useState(0)
  const [treat,   setTreat]   = useState(null)
  const [picked,  setPicked]  = useState(null)     // guesser just tapped
  const [streak,  setStreak]  = useState(0)        // right on the first try in a row
  const [ending,  setEnding]  = useState(false)
  const [lumiMood, setLumiMood] = useMood()
  const [lumiDoes, setLumiDoes] = useState(null)   // activity Lumi is doing
  const [bursts, burst] = useBursts()
  const missed    = useRef(new Set())               // rounds with a miss
  const tweenRef  = useRef(null)
  const timers    = useRef([])
  const areaRef   = useRef(null)
  const houseRef  = useRef(null)
  const area      = useSize(areaRef)
  const hint      = { a: useRef(null), b: useRef(null), fertig: useRef(null), cards: useRef(null), lumi: useRef(null), guesses: useRef(null) }

  const t = times[idx]
  // 'read' = who holds up the right time · 'set' = put the hands there ·
  // 'daily' = what happens at this time of day
  const mode = t?.activity ? 'daily' : (idx % 3 === 0 ? 'read' : 'set')
  const resolved = status === 'right' || status === 'shown'

  // Timers of the round: they wait while the help is open and end with it
  const later = useCallback((fn, ms) => {
    const run = () => { if (pausedRef.current) timers.current.push(setTimeout(run, 250)); else fn() }
    timers.current.push(setTimeout(run, ms))
  }, [])
  const clearTimers = () => { timers.current.forEach(clearTimeout); timers.current = [] }

  const options = useMemo(() => {
    if (!t || mode !== 'read') return []
    const animals = shuffle(GUESSERS)
    return readOptions(t, level).map((o, i) => ({ ...o, art: animals[i] }))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  const dailyOptions = useMemo(() => {
    if (!t?.activity) return []
    const others = shuffle(activitiesFor(level).filter(a => a.id !== t.activity.id)).slice(0, 2)
    return shuffle([t.activity, ...others])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // New round: everything back, hands somewhere clearly wrong
  useEffect(() => {
    if (!t) return
    setStatus(null); setTried([]); setCalls(0); setTreat(null); setPicked(null); setLumiDoes(null)
    setPulse(null); setMoved(false)
    setLumiMood('idle')
    setBird(mode === 'set' ? 'peek' : 'in')
    cancelAnimationFrame(tweenRef.current)
    let start
    do { start = fromHM(rand(1, 12), rand(0, 11) * 5) }
    while (timeDiffMin(toHM(start).h, toHM(start).m, t.h, t.m) <= 60)
    setHands(start)
    lockPreviews()
    sayTask()
    return clearTimers
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => { cancelAnimationFrame(tweenRef.current); clearTimers() }, [])

  // The child turns a hand: a soft tick per notch
  const turnHands = useCallback(v => {
    setHands(old => { if (old !== v) sfx.step(); return v })
    setMoved(true)
    setPulse(null)
  }, [])

  // The cuckoo pops out and calls: as often as the hour at a full hour
  const ring = useCallback((n, then) => {
    setBird('out')
    sfx.slideUp()
    const call = k => {
      if (k > n) { setCalls(0); then?.(); return }
      setCalls(k); cuckooCall()
      later(() => call(k + 1), 420)
    }
    later(() => call(1), 380)
  }, [later])

  // The end of the level, in the clock: the cuckoo comes out in its hat
  // with a cake and calls three times, then the results
  const finishLevel = useCallback(() => {
    setEnding(true); setStatus('right'); setPulse(null)
    setTreat('🎂')
    sfx.tada()
    burst(houseRef.current, 'confetti', 18)
    ring(3, () => {
      sfx.complete()
      afterNarration(() => onComplete(result(times.length - missed.current.size, times.length)), { minMs: 1400 })
    })
  }, [ring, burst, onComplete, times.length])

  const nextRound = useCallback(() => {
    if (idx + 1 >= times.length) finishLevel()
    else setIdx(i => i + 1)
  }, [idx, times.length, finishLevel])

  // A right answer: the cuckoo calls, eats its treat (and now and then
  // burps), and the next round comes by itself once all of it was seen
  const right = useCallback((at) => {
    setStatus('right')
    setPulse(null)
    sfx.correct()
    if (at) burst(at, 'stars')
    const first = !missed.current.has(idx)
    const s = first ? streak + 1 : 0
    setStreak(s)
    if (s >= 3) burst(houseRef.current, 'confetti', 8 + 2 * s)
    ring(callsFor(t), () => {
      sayRight()
      if (mode === 'set') {
        setTreat(t.treat); setBird('eat'); sfx.chomp()
        if (Math.random() < 0.3) later(sfx.burp, 900)
      }
      afterNarration(() => later(nextRound, 0), { minMs: mode === 'set' ? 1900 : 1300 })
    })
  }, [idx, t, mode, streak, ring, burst, later, nextRound])

  // First miss: the cuckoo looks out puzzled, the hand that is off pulses,
  // and the child tries again. Second miss: the answer is shown and stays
  // until the child moves on.
  const wrong = useCallback((off, reveal) => {
    missed.current.add(idx)
    setStreak(0)
    sfx.boing()
    setBird('puzzled')
    sayWrong()
    if (status === 'hint') {
      setStatus('shown')
      setPulse(null)
      reveal?.()
    } else {
      setStatus('hint')
      setPulse(off)
      later(() => setBird(b => (b === 'puzzled' ? (mode === 'set' ? 'peek' : 'in') : b)), 1300)
    }
  }, [idx, status, mode, later])

  const pickGuess = useCallback((opt, i, e) => {
    if (resolved || tried.includes(i)) return
    setTried(tr => [...tr, i])
    setPicked(i)
    if (opt.h === t.h && opt.m === t.m) right(e.currentTarget)
    else wrong('both', () => later(() => ring(callsFor(t)), 900))
  }, [resolved, tried, t, right, wrong, later, ring])

  // An activity given to Lumi: Lumi does it, or hands it back
  const giveActivity = useCallback((act) => {
    if (resolved || tried.includes(act.id)) return false
    setTried(tr => [...tr, act.id])
    if (act.id === t.activity.id) {
      setLumiDoes(act); setLumiMood(act.mood, 0)
      right()
      return true
    }
    setLumiMood('oops')
    wrong('both', () => { setLumiDoes(t.activity); setLumiMood(t.activity.mood, 0); later(() => ring(callsFor(t)), 900) })
    return false
  }, [resolved, tried, t, right, wrong, later, ring, setLumiMood])

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

  const submitAnalog = useCallback((e) => {
    if (resolved || bird === 'puzzled') return
    const cur = toHM(hands)
    if (timeDiffMin(cur.h, cur.m, t.h, t.m) <= TOLERANCE[tier]) { right(e.currentTarget); return }
    // Which hand is off? The minute hand alone decides "halb", "Viertel" …
    const minuteOk = Math.min(Math.abs(cur.m - t.m), 60 - Math.abs(cur.m - t.m)) <= TOLERANCE[tier]
    const off = minuteOk ? 'hour' : cur.h % 12 === t.h % 12 ? 'minute' : 'both'
    wrong(off, () => showOnClock(() => ring(callsFor(t))))
  }, [resolved, bird, hands, t, tier, right, wrong, showOnClock, ring])

  // A tap on the closed door: the cuckoo peeks out and giggles
  const peek = () => {
    if (bird !== 'in') return
    sfx.giggle(); setBird('peek')
    later(() => setBird(b => (b === 'peek' ? 'in' : b)), 900)
  }

  // ── Layout: the clock takes what is left of the height ───────────────────
  const wide    = area.w > area.h * 1.15 && area.w >= 560
  const compact = area.w < 520
  const side    = mode === 'read'  ? (wide ? { w: 250, h: 0 } : { w: 0, h: compact ? 172 : 180 })
                : mode === 'daily' ? (wide ? { w: 300, h: 0 } : { w: 0, h: compact ? 176 : 196 })
                :                    (wide ? { w: 230, h: 0 } : { w: 0, h: compact ? 136 : 80 })
  const gap     = 16
  const headroom = 78     // the cuckoo's wish bubble above the roof
  const clockPx = Math.max(120, Math.floor(Math.min(
    ((wide ? area.h : area.h - side.h - gap) - headroom) / HOUSE_H,
    (wide ? area.w - side.w - gap : area.w) / HOUSE_W,
    420,
  )))

  if (!t) return null

  const wish = mode === 'set' && !resolved
    ? <><Art art={t.treat} size={42} /><TimeToken t={t} level={level} size={56} /></>
    : null

  const fertig = (
    <motion.button key="fertig" ref={hint.fertig}
      whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.92 }}
      animate={moved && !resolved && !reduceMotion() ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={moved ? { duration: 1.2, repeat: Infinity } : {}}
      onClick={submitAnalog} disabled={resolved}
      aria-label="Fertig"
      style={{
        ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
        padding: '6px 22px 6px 12px', minHeight: 64, fontSize: 22, opacity: resolved ? 0.5 : 1,
        display: 'flex', alignItems: 'center', gap: 8,
      }}><Art art="🐦" size={46} />✔</motion.button>
  )

  const steppers = [['hour', 'Stundenzeiger', 60, HOUR_C], ['minute', 'Minutenzeiger', 5, MIN_C]].map(([kind, name, stepBy, color]) => (
    <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <HandIcon kind={kind} />
      <StepButton label="−" color={color} disabled={resolved}
        onPress={() => turnHands((hands - stepBy + 720) % 720)} ariaLabel={`${name} zurück`} />
      <StepButton label="+" color={color} disabled={resolved}
        onPress={() => turnHands((hands + stepBy) % 720)} ariaLabel={`${name} vor`} />
    </div>
  ))

  // The hand shows turning a hand first, then (once turned) the button
  const hintHand = mode === 'set'
    ? (moved ? <HintHand to={hint.fertig} delay={6000} active={!resolved && bird !== 'puzzled'} />
      : <HintHand from={hint.a} to={hint.b} delay={idx === 0 ? 2000 : 6000} active={!resolved && bird !== 'puzzled'} />)
    : mode === 'read'
      ? <HintHand to={hint.guesses} delay={idx === 0 ? 2000 : 6000} active={!resolved && bird !== 'puzzled'} />
      : <HintHand from={hint.cards} to={hint.lumi} delay={idx === 0 ? 2000 : 6000} active={!resolved && bird !== 'puzzled'} />

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,1.6vw,18px) clamp(12px,3vw,32px) clamp(14px,2vw,22px)',
      gap: 'clamp(6px,1.2dvh,12px)', overflow: 'hidden', position: 'relative',
    }}>
      {bursts}
      {!ending && hintHand}
      <RoundTrail total={times.length} done={idx + (resolved ? 1 : 0)} walker="🐦" goal="🎂" style={{ width: 'calc(100% - 60px)', maxWidth: 700, flexShrink: 0 }} />

      <DragArea autoTarget="lumi" disabled={resolved}>
      <div ref={areaRef} style={{
        flex: 1, minHeight: 0, width: '100%', maxWidth: 1180,
        display: 'flex', flexDirection: wide ? 'row' : 'column',
        alignItems: 'center', justifyContent: 'center', gap,
      }}>
        <div ref={houseRef} style={{ paddingTop: headroom, flexShrink: 0 }}>
          <CuckooClock size={clockPx} bird={bird} calls={calls} paused={paused} hat={streak >= 3 || ending}
            treat={treat} wish={wish}
            onDoor={mode !== 'set' && !resolved ? peek : null}>
            <ClockFace
              value={mode === 'set' ? hands : fromHM(t.h, t.m)}
              onChange={turnHands}
              interactive={mode === 'set' && !resolved}
              level={level}
              highlight={pulse}
              size={clockPx}
            />
            <span ref={hint.a} style={{ position: 'absolute', width: 2, height: 2, pointerEvents: 'none', ...ANCHOR(50) }} />
            <span ref={hint.b} style={{ position: 'absolute', width: 2, height: 2, pointerEvents: 'none', ...ANCHOR(150) }} />
          </CuckooClock>
        </div>

        {/* READ: four animals hold up a time, the child taps who is right */}
        {mode === 'read' && (
          <div ref={hint.guesses} style={{
            display: 'grid', gridTemplateColumns: wide ? '1fr' : '1fr 1fr',
            gap: wide ? 12 : 10, width: wide ? side.w : 'min(100%, 460px)', flexShrink: 0,
          }}>
            {options.map((opt, i) => {
              const isAnswer = opt.h === t.h && opt.m === t.m
              const state = resolved && isAnswer ? 'right' : !tried.includes(i) ? null : picked === i && !resolved ? 'oops' : 'tried'
              return (
                <Guesser key={`${idx}-${i}`} art={opt.art} t={opt} level={level} state={state} compact={compact}
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
                <div ref={hint.lumi} style={{ position: 'relative', paddingTop: wide ? 0 : 52 }}>
                  <Critter art="lumi" size={compact ? 84 : wide ? 120 : 100} mood={hover ? 'hungry' : lumiMood}
                    wish={lumiDoes ? <Art art={lumiDoes.icon} size={compact ? 34 : 44} /> : <span style={{ fontSize: 30, lineHeight: 1 }}>?</span>}
                    label="Lumi" />
                </div>
              )}
            </DropZone>
            <div ref={hint.cards} style={{ display: 'flex', gap: compact ? 8 : 12, flex: wide ? undefined : 1, justifyContent: 'center' }}>
              {dailyOptions.map(act => {
                const gone = lumiDoes?.id === act.id
                const isTried = tried.includes(act.id) && !gone
                return (
                  <Draggable key={act.id} id={act.id} data={act} label={plain(act.label)} disabled={isTried || resolved}
                    style={{ visibility: gone ? 'hidden' : 'visible', opacity: isTried ? 0.4 : 1 }}>
                    <div style={{
                      width: compact ? 84 : 96, padding: '8px 4px 6px', boxSizing: 'border-box', borderRadius: 16,
                      background: '#FFFDF7', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.25)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    }}>
                      <Art art={act.icon} size={compact ? 54 : 62} />
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
        {status === 'shown' && !ending && (
          <motion.button key="weiter"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, delay: 1.6 }}
            whileTap={{ scale: 0.94 }}
            onClick={nextRound}
            aria-label="Weiter"
            style={{
              ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
              position: 'absolute', right: 'clamp(12px,3vw,32px)', bottom: 'clamp(12px,2vw,24px)', zIndex: 6,
              padding: '10px 32px', minHeight: 60, fontSize: 30,
            }}
          >➡️</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
