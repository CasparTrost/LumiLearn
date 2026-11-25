import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls, useSpring, useMotionValueEvent } from 'framer-motion'
import { Art } from '../../components/play/index.js'

/**
 * The cuckoo clock of "Lumis Tag": a wooden house with a face whose hands
 * the child turns, a door in the gable for the cuckoo, a pendulum below.
 */

export const INK = '#2a1b3d'
// Hour hand blue, minute hand red: the same on the card's digits
export const HOUR_C = '#2F6FC4'
export const MIN_C = '#C2412D'
const WOOD = '#B5733A', WOOD_DARK = '#8A4F22', WOOD_LIGHT = '#D9A066'

// The face is drawn in a 240-unit box
const CX = 120, CY = 120, R = 108
const HOUR_LEN = R * 0.52, MIN_LEN = R * 0.84
const rad = d => d * Math.PI / 180
const tip = (deg, len) => ({ x: CX + len * Math.sin(rad(deg)), y: CY - len * Math.cos(rad(deg)) })
// the turn from b to a, −180 … 180; exactly opposite counts as forward (the day goes on)
const angleDiff = (a, b) => { const d = ((a - b) % 360 + 360) % 360; return d > 180 ? d - 360 : d }

/**
 * A number that glides to `to` (a soft spring), re-rendering as it goes.
 * With reduced motion it jumps.
 */
export function useGlide(to, reduce, { stiffness = 260, damping = 30 } = {}) {
  const spring = useSpring(to, { stiffness, damping })
  const [v, setV] = useState(to)
  useEffect(() => { if (reduce) { spring.jump(to); setV(to) } else spring.set(to) }, [to, reduce, spring])
  useMotionValueEvent(spring, 'change', setV)
  return v
}

/**
 * The face. `day` is the time in day minutes (it may run past 720: the
 * hands are drawn from it without wrapping, so they never spin back the
 * long way round).
 *
 * hands 'hour': the whole face turns the short hand, whole hours only.
 * hands 'both': a finger near the short hand (or near the middle) turns
 *   it, anywhere else the long one; the long hand takes the short one
 *   along, like a real clock. `step` is the snap in minutes.
 * hands null: the face only shows.
 *
 * onTurn(delta) reports every snapped step in minutes (+ forward, − back),
 * onGrab() and onLetGo(moved) the touch.
 *
 * lit: how many hour numbers glow (the cuckoo's calls, 1 … n).
 * pulse: 'hour' | 'minute' | 'both' — the hand that is off.
 * ghost: a day time whose hands are drawn faintly (the help after two misses).
 */
export function ClockFace({ day, hands, step = 60, onTurn, onGrab, onLetGo, lit = 0, pulse, ghost, labels, size, reduce, anchors }) {
  const svgRef = useRef(null)
  const drag = useRef(null)          // { hand, raw, sent, lastAngle, moved }
  const [grab, setGrab] = useState(null)
  const shown = useGlide(day, reduce, { stiffness: 420, damping: 34 })

  const hourAngle = shown * 0.5
  const minuteAngle = shown * 6

  const pointer = useCallback(e => {
    const r = svgRef.current.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    return { angle: (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360, dist: Math.hypot(dx, dy) / (r.width / 2) * R }
  }, [])

  // Move the raw (unsnapped) time of the drag and report whole steps
  const follow = useCallback((d, angle) => {
    const turn = angleDiff(angle, d.lastAngle)
    d.lastAngle = angle
    d.raw += d.hand === 'hour' ? turn * 2 : turn / 6
    const unit = d.hand === 'hour' ? 60 : step
    const snapped = Math.round((d.raw - d.offset) / unit) * unit + d.offset
    const delta = snapped - d.sent
    if (delta) { d.sent = snapped; d.moved = true; onTurn?.(delta) }
  }, [step, onTurn])

  const down = useCallback(e => {
    if (!hands) return
    e.preventDefault()
    const { angle, dist } = pointer(e)
    const hA = day * 0.5, mA = day * 6
    let hand = 'hour'
    if (hands === 'both') {
      const nearHour = Math.abs(angleDiff(angle, hA)) < 28 && dist < R * 0.72
      const nearMin = Math.abs(angleDiff(angle, mA)) < 22
      hand = nearHour && !(nearMin && dist > R * 0.6) ? 'hour' : nearMin ? 'minute' : dist < R * 0.45 ? 'hour' : 'minute'
    }
    // start where the hand is; the first move jumps it to the finger
    const handAngle = hand === 'hour' ? hA : mA
    // an hour drag keeps the minutes: it snaps to whole hours around them
    const offset = hand === 'hour' ? (((Math.round(day) % 60) + 60) % 60) : 0
    const d = { hand, raw: day, sent: day, lastAngle: handAngle, moved: false, offset }
    drag.current = d
    setGrab(hand)
    try { svgRef.current.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    onGrab?.(hand)
    follow(d, angle)
  }, [hands, pointer, day, follow, onGrab])

  const move = useCallback(e => {
    if (!drag.current) return
    e.preventDefault()
    follow(drag.current, pointer(e).angle)
  }, [pointer, follow])

  const up = useCallback(() => {
    const d = drag.current
    if (!d) return
    drag.current = null
    setGrab(null)
    onLetGo?.(d.moved)
  }, [onLetGo])

  // the hands stop following a finger when the face is locked
  useEffect(() => { if (!hands) { drag.current = null; setGrab(null) } }, [hands])

  const hEnd = tip(hourAngle, HOUR_LEN), mEnd = tip(minuteAngle, MIN_LEN)
  const pulseH = pulse === 'hour' || pulse === 'both'
  const pulseM = pulse === 'minute' || pulse === 'both'
  const gH = ghost != null ? tip(ghost * 0.5, HOUR_LEN) : null
  const gM = ghost != null ? tip(ghost * 6, MIN_LEN) : null
  const pct = p => ({ left: `${(p.x / 240) * 100}%`, top: `${(p.y / 240) * 100}%` })

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg ref={svgRef} viewBox="0 0 240 240" width={size} height={size}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        role="img" aria-label={hands ? 'Uhr zum Stellen' : 'Uhr'} data-day={Math.round(day)}
        style={{ display: 'block', borderRadius: '50%', touchAction: 'none', userSelect: 'none', cursor: hands ? (grab ? 'grabbing' : 'grab') : 'default' }}>
        <circle cx={CX} cy={CY} r={R} fill="#FFFDF7" stroke={INK} strokeWidth={5} />
        <circle cx={CX} cy={CY} r={R - 6} fill="none" stroke="#ecd2a0" strokeWidth={3} />
        {Array.from({ length: 60 }, (_, i) => {
          if (i % 5 && size < 200) return null
          const a = rad(i * 6), big = i % 15 === 0, five = i % 5 === 0
          const o = R - 8, n = big ? R - 22 : five ? R - 16 : R - 12
          return <line key={i} x1={CX + o * Math.sin(a)} y1={CY - o * Math.cos(a)} x2={CX + n * Math.sin(a)} y2={CY - n * Math.cos(a)}
            stroke={five ? (big ? INK : '#b9a27e') : '#dcc9a6'} strokeWidth={big ? 3.5 : five ? 2 : 1.2} strokeLinecap="round" />
        })}

        {/* the help: where the hands belong, faint and dashed */}
        {ghost != null && (
          <g opacity={0.55} style={{ pointerEvents: 'none' }}>
            <line x1={CX} y1={CY} x2={gH.x} y2={gH.y} stroke={HOUR_C} strokeWidth={9} strokeLinecap="round" strokeDasharray="2 12" />
            <line x1={CX} y1={CY} x2={gM.x} y2={gM.y} stroke={MIN_C} strokeWidth={6} strokeLinecap="round" strokeDasharray="2 10" />
            <circle cx={gH.x} cy={gH.y} r={11} fill="none" stroke={HOUR_C} strokeWidth={3} strokeDasharray="4 4" />
            <circle cx={gM.x} cy={gM.y} r={9} fill="none" stroke={MIN_C} strokeWidth={3} strokeDasharray="4 4" />
          </g>
        )}

        {/* the numbers; the cuckoo's calls light them one after another */}
        {Array.from({ length: 12 }, (_, i) => {
          const n = i + 1, a = rad(n * 30), r2 = R - 34
          const x = CX + r2 * Math.sin(a), y = CY - r2 * Math.cos(a)
          const on = n <= lit
          return (
            <g key={n} style={{ pointerEvents: 'none' }}>
              <AnimatePresence>
                {on && (
                  <motion.circle key="glow" cx={x} cy={y} r={15} fill="#FFC93C" stroke={INK} strokeWidth={2.5}
                    initial={reduce ? false : { scale: 0.2 }} animate={{ scale: 1 }} exit={{ opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 14 }}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                )}
              </AnimatePresence>
              <text x={x} y={y + 6.5} textAnchor="middle" fontSize={n % 3 === 0 ? 20 : 18} fontWeight={800}
                fill={INK} stroke={on ? '#FFC93C' : '#FFFDF7'} strokeWidth={4} paintOrder="stroke"
                fontFamily="var(--font-heading, system-ui)">{n}</text>
            </g>
          )
        })}

        {labels && Array.from({ length: 11 }, (_, i) => {
          const m = (i + 1) * 5, a = rad(m * 6), r3 = R - 57
          return (
            <text key={m} x={CX + r3 * Math.sin(a)} y={CY - r3 * Math.cos(a) + 5} textAnchor="middle" fontSize={14.5} fontWeight={800}
              fill={MIN_C} stroke="#FFFDF7" strokeWidth={3} paintOrder="stroke" fontFamily="var(--font-heading, system-ui)"
              style={{ pointerEvents: 'none' }}>{m}</text>
          )
        })}

        {/* the hands: short and blue, long and red */}
        <motion.line x1={CX} y1={CY} x2={hEnd.x} y2={hEnd.y} stroke={HOUR_C} strokeLinecap="round"
          animate={pulseH && !reduce ? { strokeWidth: [10, 17, 10] } : { strokeWidth: 10 }}
          transition={pulseH ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }} style={{ pointerEvents: 'none' }} />
        <motion.line x1={CX} y1={CY} x2={mEnd.x} y2={mEnd.y} stroke={MIN_C} strokeLinecap="round"
          animate={pulseM && !reduce ? { strokeWidth: [6, 12, 6] } : { strokeWidth: 6 }}
          transition={pulseM ? { duration: 0.9, repeat: Infinity, delay: pulse === 'both' ? 0.45 : 0 } : { duration: 0.2 }} style={{ pointerEvents: 'none' }} />
        {/* grips: where a finger takes the hand */}
        {hands && (
          <g style={{ pointerEvents: 'none' }}>
            <circle cx={tip(hourAngle, HOUR_LEN * 0.78).x} cy={tip(hourAngle, HOUR_LEN * 0.78).y} r={15}
              fill={HOUR_C} fillOpacity={grab === 'hour' ? 0.45 : 0.22} stroke={HOUR_C} strokeWidth={3} />
            {hands === 'both' && (
              <circle cx={mEnd.x} cy={mEnd.y} r={12} fill={MIN_C} fillOpacity={grab === 'minute' ? 0.45 : 0.22} stroke={MIN_C} strokeWidth={3} />
            )}
          </g>
        )}
        <circle cx={CX} cy={CY} r={8} fill={INK} style={{ pointerEvents: 'none' }} />
        <circle cx={CX} cy={CY} r={3} fill="#fff" style={{ pointerEvents: 'none' }} />
      </svg>
      {/* points for the hint hand: the tip of the hand that is to move, and where it belongs */}
      {anchors && (
        <>
          <span ref={anchors.from} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, pointerEvents: 'none', ...pct(anchors.hand === 'minute' ? mEnd : tip(hourAngle, HOUR_LEN * 0.78)) }} />
          <span ref={anchors.to} aria-hidden="true" style={{ position: 'absolute', width: 1, height: 1, pointerEvents: 'none', ...pct(anchors.hand === 'minute' ? tip(anchors.target * 6, MIN_LEN) : tip(anchors.target * 0.5, HOUR_LEN * 0.78)) }} />
        </>
      )}
    </div>
  )
}

// ── The cuckoo's voice ────────────────────────────────────────────────────

// Its own two falling notes ("kuck-uck"), or a sour, sinking one when it
// came out at the wrong time. Local: no other game has a cuckoo.
let audio = null
export function cuckooCall(sour = false) {
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)()
    if (audio.state === 'suspended') audio.resume().catch(() => {})
    const notes = sour ? [[523, 0, 392], [392, 0.2, 262]] : [[784, 0, 784], [622, 0.17, 622]]
    notes.forEach(([f, d, f2]) => {
      const o = audio.createOscillator(), g = audio.createGain(), t0 = audio.currentTime + d
      o.type = 'triangle'
      o.frequency.setValueAtTime(f, t0)
      if (f2 !== f) o.frequency.exponentialRampToValueAtTime(f2, t0 + 0.22)
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + (sour ? 0.24 : 0.16))
      o.connect(g); g.connect(audio.destination); o.start(t0); o.stop(t0 + 0.26)
    })
  } catch { /* no audio */ }
}

// ── The house ─────────────────────────────────────────────────────────────

/** The house is this many face widths wide and high (viewBox 300 × 340, face 216 units). */
export const HOUSE_W = 300 / 216, HOUSE_H = 340 / 216

const CSS = `
@keyframes lt-swing { 0%,100% { transform: rotate(12deg); } 50% { transform: rotate(-12deg); } }
.lt-pend { animation: lt-swing 1.6s ease-in-out infinite; transform-origin: 150px 292px; }
.lt-paused .lt-pend { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .lt-pend { animation: none; } }
`

/**
 * bird: 'in' (door shut) · 'out' (popped out on its perch, calling) ·
 * 'flop' (out at the wrong time: it sinks back sheepishly).
 * `call` changes with every call: the bird bobs.
 */
export function CuckooHouse({ size, bird, call, paused, reduce, children, houseRef }) {
  const w = size * HOUSE_W, h = size * HOUSE_H
  const bob = useAnimationControls()
  useEffect(() => {
    if (call && !reduce) bob.start({ scaleY: [1, 0.8, 1.14, 1], y: [0, 3, -6, 0], transition: { duration: 0.22 } })
  }, [call, bob, reduce])
  const out = bird === 'out'
  const flop = bird === 'flop'
  const birdPx = w * 0.3
  return (
    <div ref={houseRef} className={paused ? 'lt-paused' : undefined} style={{ position: 'relative', width: w, height: h, flexShrink: 0 }}>
      <style>{CSS}</style>
      <svg viewBox="0 0 300 340" width={w} height={h} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.25))' }}>
        {/* pendulum and pine-cone weights hang behind the body */}
        <g className="lt-pend">
          <line x1="150" y1="290" x2="150" y2="318" stroke={INK} strokeWidth="4" />
          <circle cx="150" cy="322" r="14" fill="#FFC93C" stroke={INK} strokeWidth="3.5" />
          <circle cx="145" cy="317" r="4" fill="#fff" opacity="0.7" />
        </g>
        {[92, 208].map(x => (
          <g key={x}>
            <line x1={x} y1="290" x2={x} y2="302" stroke={INK} strokeWidth="2.5" strokeDasharray="4 3" />
            <ellipse cx={x} cy="318" rx="9" ry="16" fill="#7A4A22" stroke={INK} strokeWidth="3" />
            <path d={`M${x - 7} 311 h14 M${x - 8} 318 h16 M${x - 7} 325 h14`} stroke="#5A3416" strokeWidth="2" />
          </g>
        ))}
        <rect x="24" y="86" width="252" height="212" rx="16" fill={WOOD} stroke={INK} strokeWidth="4" />
        <rect x="34" y="96" width="232" height="192" rx="12" fill="none" stroke={WOOD_LIGHT} strokeWidth="3" opacity="0.7" />
        <polygon points="2,100 150,4 298,100" fill={WOOD_DARK} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <polygon points="34,90 150,26 266,90" fill={WOOD_LIGHT} />
        <path d="M70 76 L150 32 L230 76" fill="none" stroke={WOOD} strokeWidth="3" />
        <rect x="122" y="40" width="56" height="44" rx="7" fill="#2a1b3d" />
        <ellipse cx="136" cy="10" rx="14" ry="6" fill="#5CC45A" stroke={INK} strokeWidth="2.5" transform="rotate(-25 136 10)" />
        <ellipse cx="164" cy="10" rx="14" ry="6" fill="#5CC45A" stroke={INK} strokeWidth="2.5" transform="rotate(25 164 10)" />
        {(out || flop) && <rect x="128" y="82" width="44" height="7" rx="3" fill={WOOD_DARK} stroke={INK} strokeWidth="2.5" />}
      </svg>

      {/* the face */}
      <div style={{ position: 'absolute', left: `${(42 / 300) * 100}%`, top: `${(84 / 340) * 100}%`, width: size, height: size }}>
        {children}
      </div>

      {/* the cuckoo */}
      <motion.div aria-hidden="true" initial={false}
        animate={{
          opacity: bird === 'in' ? 0 : 1,
          scale: out ? 1 : flop ? 0.85 : 0.3,
          // at the wrong time it pops out, turns away and droops
          scaleX: flop ? -0.85 : out ? 1 : 0.3,
          y: out ? -birdPx * 0.14 : flop ? birdPx * 0.06 : birdPx * 0.15,
          rotate: flop ? (reduce ? -20 : [0, 16, -12, -22]) : 0,
        }}
        transition={{ type: 'spring', stiffness: 520, damping: 14 }}
        style={{ position: 'absolute', left: (w - birdPx) / 2, top: h * (62 / 340) - birdPx * 0.62, width: birdPx, height: birdPx, pointerEvents: 'none', zIndex: 2 }}>
        <motion.div animate={bob} style={{ transformOrigin: '50% 100%' }}>
          <Art art="🐦" size={birdPx} />
        </motion.div>
      </motion.div>

      {/* the door's two leaves: they bang open */}
      <svg viewBox="0 0 300 340" width={w} height={h} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none', zIndex: 3 }}>
        {[122, 150].map(x => (
          <motion.rect key={x} x={x} y="40" width="28" height="44" rx="4" fill={WOOD} stroke={INK} strokeWidth="3"
            initial={false} animate={{ scaleX: out || flop ? 0.1 : 1 }}
            transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 700, damping: out || flop ? 9 : 22 }}
            style={{ originX: x === 122 ? 0 : 1, originY: 0.5 }} />
        ))}
        <circle cx="146" cy="62" r="2.5" fill={INK} /><circle cx="154" cy="62" r="2.5" fill={INK} />
      </svg>
    </div>
  )
}
