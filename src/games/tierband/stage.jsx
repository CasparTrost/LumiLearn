import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import { instOf, countOf, artOf } from './band.js'
import './tierband.css'

// What the stage of the Tier-Band is made of: the animals with their
// instruments, stools and benches, the lamp on its rail, the hill of the
// big band, and an animal on its way from one place to another.

export const INK = '#2a1b3d'
const WOOD = '#c98a52'
const WOOD_DARK = '#a8683a'
const GOLD = '#ffd34d'

// the colour of the little note that pops up when an instrument sounds
const NOTE_TINT = {
  drum: '#ff6b5b', bass: '#c98a52', maraca: '#ff9f43', cymbal: '#ffd34d', bell: '#ffe680', xylo: '#b79cf5',
  cowbell: '#8fd0ff', whistle: '#6fd3ff', quack: '#ffb347', trumpet: '#ffc93c', wood: '#e3a462', guitar: '#ff8fb8',
}

// Instruments that have a picture of their own in the app's art
const PICTURE = { drum: '🥁', bass: '🎻', trumpet: '🎺', guitar: '🎸', xylo: ':px-xylofon:' }

const line = { stroke: INK, strokeWidth: 3, strokeLinejoin: 'round', strokeLinecap: 'round' }

/** The instrument an animal holds, as a small picture. */
export function Instrument({ inst, size }) {
  if (PICTURE[inst]) return <Art art={PICTURE[inst]} size={size} />
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {inst === 'maraca' && (
        <g transform="rotate(32 24 24)">
          <rect x="21" y="25" width="6" height="20" rx="3" fill={WOOD} {...line} />
          <ellipse cx="24" cy="15" rx="11" ry="13" fill="#ff6b5b" {...line} />
          <path d="M14 12 Q24 18 34 12 M14.5 20 Q24 25 33.5 20" fill="none" stroke={GOLD} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {inst === 'cymbal' && (
        <g>
          <ellipse cx="17" cy="25" rx="12" ry="17" fill="#ffc93c" {...line} transform="rotate(-12 17 25)" />
          <ellipse cx="32" cy="25" rx="12" ry="17" fill={GOLD} {...line} transform="rotate(12 32 25)" />
          <circle cx="32" cy="25" r="3.5" fill={WOOD_DARK} stroke={INK} strokeWidth="2" />
          <path d="M26 14 Q31 10 37 13" fill="none" stroke="#fff6c9" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {inst === 'bell' && (
        <g>
          <path d="M20 9 a4 4 0 0 1 8 0" fill="none" {...line} />
          <circle cx="24" cy="40" r="4.5" fill="#ff9f43" {...line} />
          <path d="M24 8 C13 8 12 20 11 29 L6 36 H42 L37 29 C36 20 35 8 24 8Z" fill={GOLD} {...line} />
          <path d="M17 16 Q16 22 15.5 27" fill="none" stroke="#fff6c9" strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {inst === 'quack' && (
        <g transform="rotate(-14 24 24)">
          <path d="M5 20 L33 9 V39 L5 28 Z" fill="#ff9f43" {...line} />
          <path d="M14 16.5 V31.5 M23 13 V35" stroke="#fffdf7" strokeWidth="3.5" />
          <rect x="33" y="6" width="8" height="36" rx="4" fill={GOLD} {...line} />
          <rect x="1" y="20" width="6" height="8" rx="2" fill="#6fb7ff" {...line} />
        </g>
      )}
      {inst === 'whistle' && (
        <g transform="rotate(-38 24 24)">
          <rect x="2" y="19" width="44" height="10" rx="5" fill="#f2c078" {...line} />
          <rect x="2" y="19" width="9" height="10" rx="4" fill={WOOD_DARK} {...line} />
          {[19, 27, 35].map(x => <circle key={x} cx={x} cy="24" r="2.4" fill={INK} />)}
        </g>
      )}
      {inst === 'wood' && (
        <g>
          <path d="M33 5 L22 19" {...line} stroke={INK} strokeWidth="7" />
          <path d="M33 5 L22 19" stroke="#f2c078" strokeWidth="3" strokeLinecap="round" />
          <circle cx="34" cy="5" r="5" fill="#ff6b5b" {...line} />
          <rect x="5" y="21" width="38" height="19" rx="6" fill={WOOD} {...line} />
          <rect x="12" y="28" width="24" height="5" rx="2.5" fill="#6b3f1f" />
        </g>
      )}
      {inst === 'cowbell' && (
        <g>
          <path d="M18 14 V10 a6 6 0 0 1 12 0 V14" fill="none" {...line} />
          <path d="M15 13 H33 L42 41 H6 Z" fill="#7fb2e8" {...line} />
          <path d="M15 20 L12 33" fill="none" stroke="#d9ecff" strokeWidth="3.5" strokeLinecap="round" />
          <circle cx="24" cy="42" r="3.5" fill={GOLD} stroke={INK} strokeWidth="2.5" />
        </g>
      )}
    </svg>
  )
}

function Note({ tint, size }) {
  return (
    <svg viewBox="0 0 24 28" width={size} height={size * 1.17} aria-hidden="true" style={{ display: 'block' }}>
      <path d="M10 21 V5 L21 2.5 V17" fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" strokeLinecap="round" />
      <ellipse cx="6.5" cy="21.5" rx="5" ry="4" fill={tint} stroke={INK} strokeWidth="2.5" />
      <ellipse cx="17.5" cy="17.5" rx="5" ry="4" fill={tint} stroke={INK} strokeWidth="2.5" />
      <path d="M10 21 V5 L21 2.5 V17" fill="none" stroke={tint} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

/**
 * An animal of the band with its instrument (drawn at its side). Each time `pulse` goes up to
 * a new number it plays: a hop (not with reduced motion) and a little
 * note; `delay` seconds later for the second, third … of a group.
 * `oops` (a number that goes up) makes it shake its head. `sour`: it sits
 * where it does not belong; its note comes out grey and falls down.
 */
export function Performer({ art, size, pulse = 0, delay = 0, dance = false, phase = 0, oops = 0, sour = false, reduce = false, still = false }) {
  const controls = useAnimationControls()
  const [note, setNote] = useState(0)
  const inst = instOf(art)
  // (the numbers only go up: one that is not newer than the last is no new note)
  const heard = useRef(0)
  useEffect(() => {
    if (!pulse || pulse <= heard.current) return
    heard.current = pulse
    const go = () => {
      setNote(n => n + 1)
      if (!reduce) controls.start({ y: [0, -size * 0.26, 0], scaleY: [1, 1.12, 0.94, 1], transition: { duration: 0.26, ease: 'easeOut' } })
    }
    if (!delay) { go(); return }
    const t = setTimeout(go, delay * 1000)
    return () => clearTimeout(t)
  }, [pulse]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!oops || reduce) return
    controls.start({ rotate: [0, -16, 13, -9, 6, 0], x: [0, -size * 0.06, size * 0.06, -size * 0.04, size * 0.02, 0], transition: { duration: 0.7 } })
  }, [oops]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, pointerEvents: 'none' }}>
      <motion.div animate={controls} style={{ width: size, height: size, transformOrigin: '50% 100%' }}>
        <div className={dance && !reduce ? 'tb-sway' : still || reduce ? undefined : 'tb-wait'} style={{ position: 'relative', width: size, height: size, animationDelay: `${-phase * 0.5}s` }}>
          <Art art={art} size={size} />
          {inst && (
            <div style={{ position: 'absolute', right: -size * 0.1, bottom: -size * 0.04, filter: 'drop-shadow(0 2px 0 rgba(42,27,61,0.35))' }}>
              <Instrument inst={inst} size={size * 0.5} />
            </div>
          )}
        </div>
      </motion.div>
      {note > 0 && (
        <motion.div key={note} aria-hidden="true"
          initial={{ opacity: 0, y: 0, scale: 0.6 }}
          animate={reduce ? { opacity: [0, 1, 1, 0] }
            : sour ? { opacity: [0, 1, 1, 0], y: [0, -size * 0.3, size * 0.5], x: [0, size * 0.08, size * 0.2], scale: 1, rotate: [0, 20, 140] }
              : { opacity: [0, 1, 1, 0], y: -size * 0.42, x: size * 0.1, scale: 1, rotate: [0, -12, 10] }}
          transition={{ duration: sour ? 0.8 : 0.55, ease: 'easeOut' }}
          style={{ position: 'absolute', right: -size * 0.04, top: -size * 0.12 }}>
          <Note tint={sour ? '#b8b3c9' : NOTE_TINT[inst] ?? GOLD} size={Math.max(14, size * 0.3)} />
        </motion.div>
      )}
    </div>
  )
}

// A group stands in up to two lines: the back line first (like a choir)
export const GROUP_PITCH = 1.14   // from one animal of a group to the next, in animals: room for the instrument
export const colsOf = n => (n <= 2 ? n : Math.ceil(n / 2))
export const rowsOf = n => (n <= 2 ? 1 : 2)
/** How high a group of n animals of size e stands. */
export const groupH = (n, e) => (rowsOf(n) === 1 ? e : e * 1.82)

/**
 * A group of a growing row ("🐸🐸🐸"): its animals side by side, the back
 * line first. `pulseOf(k)` and `delayOf(k)` say when animal number k plays.
 */
export function Group({ q, token, e, pulseOf = () => 0, delayOf = () => 0, dance, sour, reduce, still }) {
  const n = countOf(q, token)
  const back = n <= 2 ? n : Math.ceil(n / 2)
  const lines = n <= 2 ? [[...Array(n).keys()]] : [[...Array(back).keys()], [...Array(n - back).keys()].map(i => i + back)]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none' }}>
      {lines.map((ks, li) => (
        <div key={li} style={{ display: 'flex', marginTop: li ? -e * 0.18 : 0, position: 'relative', zIndex: li }}>
          {ks.map(k => (
            <div key={k} style={{ width: e * GROUP_PITCH, display: 'flex', justifyContent: 'flex-start' }}>
              <Performer art={artOf(q, token)} size={e} pulse={pulseOf(k)} delay={delayOf(k)} dance={dance} phase={k} sour={sour} reduce={reduce} still={still} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

/** A stool. `want`: it is the one that waits for somebody. */
export function Stool({ w, h, want = false, dim = false }) {
  return (
    <svg viewBox="0 0 60 30" width={w} height={h} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible', opacity: dim ? 0.6 : 1 }}>
      <path d="M15 9 L9 29 M45 9 L51 29 M12.5 21 H47.5" fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round" />
      <path d="M15 9 L9 29 M45 9 L51 29 M12.5 21 H47.5" fill="none" stroke={WOOD_DARK} strokeWidth="3" strokeLinecap="round" />
      <rect x="3" y="1.5" width="54" height="10" rx="5" fill={want ? GOLD : '#e9a85c'} stroke={INK} strokeWidth="3" />
      <rect x="9" y="3.5" width="30" height="2.5" rx="1.2" fill="rgba(255,255,255,0.5)" />
    </svg>
  )
}

/** The bench a group of a growing row stands on. */
export function Bench({ w, h, want = false }) {
  return (
    <div aria-hidden="true" style={{ width: w, height: h, boxSizing: 'border-box', borderRadius: `${h * 0.4}px ${h * 0.4}px 3px 3px`, background: want ? GOLD : '#e9a85c', border: `3px solid ${INK}`, boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -4px 0 rgba(0,0,0,0.14)' }} />
  )
}

/**
 * The lamp on its rail and its cone of light. It stands over the place
 * that has the beat (`x`, `top` of the rail) and lights the floor `h`
 * below, `w` wide; between two rounds of the loop it is dark.
 */
export function Lamp({ x, top, w, h, on, reduce }) {
  const head = Math.max(20, Math.min(34, w * 0.4))
  const neck = Math.min(46, (head * 0.7 * 100) / w)   // half the cone's width at the lamp, in percent
  return (
    <motion.div aria-hidden="true" initial={false} animate={{ x, y: top }}
      transition={reduce ? { duration: 0 } : { type: 'tween', duration: 0.14, ease: 'easeOut' }}
      style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', left: -w / 2, top: head * 0.55, width: w, height: h - head * 0.55,
        clipPath: `polygon(${50 - neck}% 0, ${50 + neck}% 0, 100% 100%, 0 100%)`,
        background: 'linear-gradient(rgba(255,246,196,0.85), rgba(255,236,150,0.34))',
        opacity: on ? 1 : 0, transition: reduce ? undefined : 'opacity .14s',
      }} />
      <div style={{
        position: 'absolute', left: -w * 0.55, top: h - 7, width: w * 1.1, height: 14, borderRadius: '50%',
        background: 'rgba(255,240,170,0.75)', opacity: on ? 1 : 0, transition: reduce ? undefined : 'opacity .14s',
      }} />
      <svg viewBox="0 0 40 30" width={head * 1.33} height={head} style={{ position: 'absolute', left: -head * 0.665, top: -head * 0.2, overflow: 'visible' }}>
        <rect x="16" y="0" width="8" height="8" fill="#6b5aa8" stroke={INK} strokeWidth="2.5" />
        <path d="M9 7 H31 L37 24 H3 Z" fill="#51467f" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <ellipse cx="20" cy="24" rx="15" ry="4.5" fill={on ? '#fff3b0' : '#8d86b3'} stroke={INK} strokeWidth="2.5" />
      </svg>
    </motion.div>
  )
}

/**
 * Where the big band stands on its hill, front line first and from the
 * middle outwards: for a hill w wide and h high and animals of size a.
 * `pitch` is how close they stand (in animals), `taper` how much shorter
 * each line further up is (in hill widths).
 */
export function hillSlots(w, h, a, { pitch = 0.74, taper = 0.2, tiers: most = 3 } = {}) {
  const out = []
  const tiers = Math.max(1, Math.min(most, Math.floor((h - a * 1.1) / (a * 0.5)) + 1))
  for (let j = 0; j < tiers; j++) {
    const span = w * (0.92 - j * taper)
    const n = Math.max(1, Math.floor(span / (a * pitch)))
    const step = span / n
    // from the middle outwards
    const order = [...Array(n).keys()].sort((p, r) => Math.abs(p - (n - 1) / 2) - Math.abs(r - (n - 1) / 2))
    for (const k of order) out.push({ x: w / 2 + (k - (n - 1) / 2) * step, y: h - 3 - j * a * 0.5, z: tiers - j })
  }
  return out
}

/** The hill at the back with the big band: everybody who was in a finished row. */
export function Hill({ box, a, crowd, slots, dance, reduce, innerRef, peak = 0.38, pulseOf = () => 0, onTap }) {
  const { w, h } = box
  const bulbs = Math.max(4, Math.round(w / 56))
  // `peak`: how far below the top of its box the hill's top is, in box heights
  const lights = Math.max(0, h * peak - 34)
  const c1 = h - (h * (1 - peak)) / 0.75, c2 = h - (h * (1 - peak - 0.2)) / 0.75
  return (
    <div ref={innerRef} style={{ position: 'absolute', left: box.x, top: box.y, width: w, height: h, pointerEvents: 'none' }}>
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <path d={`M0 ${h} C${w * 0.12} ${c1} ${w * 0.88} ${c1} ${w} ${h} Z`} fill="#3f8f5a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d={`M${w * 0.1} ${h} C${w * 0.22} ${c2} ${w * 0.78} ${c2} ${w * 0.9} ${h} Z`} fill="#4fa86a" />
        {/* a string of lanterns over the hill */}
        <path d={`M${w * 0.04} ${lights + 16} Q${w / 2} ${lights - 8} ${w * 0.96} ${lights + 16}`} fill="none" stroke="rgba(255,253,247,0.55)" strokeWidth="2" />
        {Array.from({ length: bulbs }, (_, i) => {
          const t = (i + 0.5) / bulbs
          const x = w * (0.04 + 0.92 * t), y = lights + 16 - 48 * t * (1 - t) + 5
          return <circle key={i} className="tb-bulb" style={{ animationDelay: `${-(i % 3) * 0.6}s` }} cx={x} cy={y} r="5"
            fill={['#ffcf4a', '#ff7b8c', '#6fc7ff', '#8fe08a'][i % 4]} stroke={INK} strokeWidth="2" />
        })}
      </svg>
      {crowd.map((c, i) => {
        const s = slots[i]
        if (!s) return null
        return (
          <motion.div key={c.id} initial={reduce ? false : { scale: 0.2 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 14 }}
            onPointerDown={onTap ? () => onTap(c, i) : undefined}
            style={{ position: 'absolute', left: s.x - a / 2, top: s.y - a, zIndex: s.z, transformOrigin: '50% 100%', pointerEvents: onTap ? 'auto' : undefined, cursor: onTap ? 'pointer' : undefined }}>
            <Performer art={c.art} size={a} pulse={pulseOf(i)} dance={dance} phase={i % 2} reduce={reduce} still />
          </motion.div>
        )
      })}
    </div>
  )
}

/**
 * Somebody on the way from one place to another, in a bow: an animal (or
 * a group) hopping onto its stool, back to where it waited, or up the hill.
 * `from` and `to` are the middles, in the game's own pixels.
 */
export function Flyer({ from, to, size, toSize = size, reduce, onDone, children }) {
  const lift = Math.min(90, 30 + Math.hypot(to.x - from.x, to.y - from.y) * 0.25)
  const x0 = from.x - size / 2, y0 = from.y - size / 2, x1 = to.x - size / 2, y1 = to.y - size / 2
  return (
    <motion.div aria-hidden="true"
      initial={{ x: x0, y: y0, scale: 1 }}
      animate={{ x: [x0, (x0 + x1) / 2, x1], y: [y0, Math.min(y0, y1) - lift, y1], scale: [1, 1.12, toSize / size] }}
      transition={{ duration: reduce ? 0.01 : 0.42, times: [0, 0.5, 1], ease: 'easeInOut' }}
      onAnimationComplete={onDone}
      style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, zIndex: 30, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {children}
    </motion.div>
  )
}
