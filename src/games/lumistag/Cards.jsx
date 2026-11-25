import { forwardRef } from 'react'
import { motion } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import { hourOf, minuteOf, skyAt, darkness, spoken } from './day.js'
import { INK, HOUR_C, MIN_C } from './Clock.jsx'

/**
 * The cards of "Lumis Tag": the moment to set (a picture and its time),
 * the day strip that fills from morning to night, and the digital times
 * to pick from in a reading round.
 *
 * The time on a card is coloured like the hands: the hour blue like the
 * short hand, the minutes red like the long one.
 */

const FONT = 'var(--font-heading, system-ui)'

/** A small clock face like the big one, with the hands at `time`. */
export function MiniClock({ time, size }) {
  const h = (hourOf(time) % 12) * 30 + minuteOf(time) * 0.5, m = minuteOf(time) * 6
  const end = (deg, len) => [50 + len * Math.sin(deg * Math.PI / 180), 50 - len * Math.cos(deg * Math.PI / 180)]
  const [hx, hy] = end(h, 24), [mx, my] = end(m, 37)
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="50" cy="50" r="46" fill="#FFFDF7" stroke={INK} strokeWidth="5" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = end(i * 30, 40), [x2, y2] = end(i * 30, i % 3 ? 35 : 31)
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={i % 3 ? '#b9a27e' : INK} strokeWidth={i % 3 ? 3 : 4.5} strokeLinecap="round" />
      })}
      <line x1="50" y1="50" x2={hx} y2={hy} stroke={HOUR_C} strokeWidth="9" strokeLinecap="round" />
      <line x1="50" y1="50" x2={mx} y2={my} stroke={MIN_C} strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="5.5" fill={INK} />
    </svg>
  )
}

/** "7:30" with the hour blue and the minutes red, on a little display. */
export function Digital({ time, size }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'baseline', padding: `${size * 0.08}px ${size * 0.22}px`, borderRadius: size * 0.22,
      background: '#FFFDF7', border: `3px solid ${INK}`, fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1,
      fontVariantNumeric: 'tabular-nums', letterSpacing: 1, whiteSpace: 'nowrap',
    }}>
      <span style={{ color: HOUR_C }}>{hourOf(time)}</span>
      <span style={{ color: INK }}>:</span>
      <span style={{ color: MIN_C }}>{String(minuteOf(time)).padStart(2, '0')}</span>
    </span>
  )
}

/** The hour alone, big and blue like the short hand. */
function HourNumber({ time, size }) {
  return (
    <span style={{
      fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: 1, color: HOUR_C,
      WebkitTextStroke: `${Math.max(2, size * 0.04)}px ${INK}`, paintOrder: 'stroke fill', textShadow: '0 3px 0 rgba(42,27,61,0.25)',
    }}>{hourOf(time)}</span>
  )
}

/** A little sky of that time of day, behind a card's picture: morning, noon or night at a glance. */
export function skyBg(time) {
  const s = skyAt(time)
  return `linear-gradient(180deg, ${s.top}, ${s.bottom})`
}

/**
 * The moment to set: its picture on the sky of its time, and the time as
 * the level shows it ('clock' | 'number' | 'digital'), or no time at all
 * in a reading round (the clock shows it; the child finds it).
 */
export const TaskCard = forwardRef(function TaskCard({ task, kind, height, reading, reduce }, ref) {
  const pic = height * 0.62
  const night = darkness(task.time) > 0.5
  return (
    <motion.div ref={ref} key={task.moment}
      initial={reduce ? false : { scale: 0.4, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 17 }}
      role="img" data-time={task.time} aria-label={reading ? task.label : `${task.label}, ${spoken(task.time)}`}
      style={{
        display: 'flex', alignItems: 'stretch', height, flexShrink: 0, boxSizing: 'border-box', borderRadius: 16, overflow: 'hidden',
        background: '#FFFDF7', border: `3px solid ${INK}`, boxShadow: '0 5px 0 rgba(42,27,61,0.35)',
      }}>
      <div style={{ width: height * 0.92, display: 'flex', alignItems: 'center', justifyContent: 'center', background: skyBg(task.time), position: 'relative', flexShrink: 0 }}>
        <Art art={task.art} size={pic} />
        <span aria-hidden="true" style={{ position: 'absolute', top: height * 0.04, right: height * 0.05 }}>
          <Art art={night ? '🌙' : '☀️'} size={height * 0.24} />
        </span>
      </div>
      {!reading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: `0 ${height * 0.12}px`, borderLeft: `3px solid ${INK}`, minWidth: height * 0.8 }}>
          {kind === 'clock' && <MiniClock time={task.time} size={height * 0.78} />}
          {kind === 'number' && <HourNumber time={task.time} size={height * 0.68} />}
          {kind === 'digital' && <Digital time={task.time} size={height * 0.34} />}
        </div>
      )}
    </motion.div>
  )
})

/**
 * The day strip: one place for each moment of the level, tinted with the
 * sky of its time, so morning is on the left and night on the right. The
 * moments still to come wait faintly; the one now glows; the done ones
 * show their picture and a little clock.
 */
export function DayStrip({ tasks, done, current, slot, slotRefs, reduce, hop }) {
  return (
    <div style={{ display: 'flex', gap: Math.max(4, slot * 0.08), justifyContent: 'center', flexShrink: 0 }}>
      {tasks.map((t, i) => {
        const isDone = i < done, now = i === current && !isDone
        return (
          <motion.div key={i} ref={el => { if (slotRefs) slotRefs.current[i] = el }}
            animate={hop === i && !reduce ? { y: [0, -slot * 0.35, 0], rotate: [0, -8, 0] }
              : isDone && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
            transition={{ duration: 0.45 }}
            aria-label={isDone ? `${t.label}, ${spoken(t.time)}` : undefined}
            style={{
              position: 'relative', width: slot, height: slot, borderRadius: slot * 0.2, boxSizing: 'border-box', flexShrink: 0,
              background: skyBg(t.time), border: `3px solid ${now ? '#FFC93C' : INK}`,
              boxShadow: now ? `0 0 0 3px ${INK}, 0 0 14px 4px rgba(255,201,60,0.9)` : '0 3px 0 rgba(42,27,61,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <span style={{ opacity: isDone ? 1 : now ? 0.75 : 0.4, filter: isDone ? 'none' : 'grayscale(0.8)', display: 'flex' }}>
              <Art art={t.art} size={slot * 0.62} />
            </span>
            {isDone && (
              <span style={{ position: 'absolute', right: -slot * 0.12, bottom: -slot * 0.12 }}>
                <MiniClock time={t.time} size={slot * 0.42} />
              </span>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

/** One digital time to pick in a reading round. */
export function ReadChoice({ time, state, onPick, height, glow, reduce }) {
  return (
    <motion.button type="button" onClick={onPick} aria-label={spoken(time)} disabled={state === 'tried'}
      initial={reduce ? false : { scale: 0.5, opacity: 0 }}
      animate={state === 'right' ? { scale: [1, 1.15, 1], opacity: 1 }
        : glow && !reduce ? { scale: [1, 1.08, 1], opacity: 1, transition: { duration: 0.9, repeat: Infinity } }
        : { scale: 1, opacity: state === 'tried' ? 0.35 : 1 }}
      whileTap={state ? undefined : { scale: 0.9 }}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: state === 'tried' ? 'default' : 'pointer', flexShrink: 0,
        minWidth: Math.max(72, height * 1.35), height: Math.max(64, height), padding: '0 6px', borderRadius: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: state === 'right' ? '#DDF6CF' : glow ? '#FFF0B8' : '#FFFDF7',
        border: `3px solid ${state === 'right' ? '#2F8F3A' : INK}`, boxShadow: '0 5px 0 rgba(42,27,61,0.35)',
        fontFamily: FONT, fontWeight: 800, fontSize: Math.max(24, height * 0.42), fontVariantNumeric: 'tabular-nums',
        WebkitTapHighlightColor: 'transparent',
      }}>
      <span style={{ color: HOUR_C }}>{hourOf(time)}</span>
      <span style={{ color: INK }}>:</span>
      <span style={{ color: MIN_C }}>{String(minuteOf(time)).padStart(2, '0')}</span>
    </motion.button>
  )
}
