// Planeten-Hüpfer: the pictures. All drawn here (inline SVG) except the
// alien, the residents, the star and the flame, which are the app's own
// pictures (components/play/Critter.jsx, Art).
import { motion, useReducedMotion } from 'framer-motion'
import { customArtSrc } from '../../lib/emojiArt.jsx'
import { Art } from '../../components/play/index.js'
import { PLUS } from './tasks.js'

export const INK = '#2a1b3d'
export const GOLD = '#ffc93c'
export const PARCH = '#fffdf7'
/** The two signs have a colour each, in the sum and on their thrust button. */
export const SIGN_COLOR = { '+': '#ff9a3d', '−': '#4aa3ff' }
const PLANET_COLORS = ['#ff8a65', '#4fc3f7', '#ffd54f', '#aed581', '#ce93d8', '#f48fb1', '#80cbc4']
export const ALIEN_SRC = customArtSrc('alien')

/**
 * The alien, the app's picture turned to its own colour. `face` crops it to
 * the head, for a rocket window.
 */
export function AlienPic({ size, hue = 0, style }) {
  return (
    <img src={ALIEN_SRC} alt="" draggable={false}
      style={{ width: size, height: size, display: 'block', maxWidth: 'none', objectFit: 'contain', filter: `hue-rotate(${hue}deg)`, ...style }} />
  )
}

/**
 * A planet of the number line: a ball with its number and a little round
 * door (someone lives in every planet). `glow`: the start of the sum, lit
 * up together with its number in the sum.
 */
export function Planet({ n, size, glow = false, home = false }) {
  const c = PLANET_COLORS[n % PLANET_COLORS.length]
  const ring = n % 3 === 1
  return (
    <svg viewBox="-10 -10 120 120" width={size * 1.2} height={size * 1.2} aria-hidden="true"
      style={{ display: 'block', overflow: 'visible', margin: -size * 0.1 }}>
      {glow && <circle cx="50" cy="50" r="60" fill={GOLD} opacity="0.55" />}
      {ring && <ellipse cx="50" cy="56" rx="60" ry="14" fill="none" stroke={INK} strokeWidth="9" transform="rotate(-14 50 56)" />}
      {ring && <ellipse cx="50" cy="56" rx="60" ry="14" fill="none" stroke="#ffe08a" strokeWidth="5" transform="rotate(-14 50 56)" />}
      <circle cx="50" cy="50" r="44" fill={c} stroke={INK} strokeWidth="5" />
      <circle cx="33" cy="30" r="9" fill="#fff" opacity="0.35" />
      {/* the door, low on the right */}
      <path d="M70 84 V75 a7 7 0 0 1 14 0 V82" fill={home ? '#ffe08a' : '#5b3a8a'} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <text x="47" y="63" textAnchor="middle" fontSize="46" fontWeight="800" fill={INK}
        stroke="#fff" strokeWidth="7" paintOrder="stroke" fontFamily="var(--font-heading, system-ui)">{n}</text>
    </svg>
  )
}

// Where the windows sit on the rocket (viewBox 0 0 100 160, nose up):
// two columns, one row per pair of passengers
export function windowSpots(seats) {
  const rows = Math.ceil(seats / 2)
  const r = rows <= 3 ? 13 : 9
  const top = rows <= 3 ? 62 : 56, bottom = 120
  return Array.from({ length: seats }, (_, i) => {
    const row = Math.floor(i / 2), col = i % 2
    const y = rows === 1 ? (top + bottom) / 2 : top + (row * (bottom - top)) / (rows - 1)
    return { x: col ? 66 : 34, y, r }
  })
}

/**
 * The rocket, nose up, feet at the bottom of its box: a round window per
 * passenger of the level, and who has come aboard looks out of one.
 * `flame` 0 … 1 is the engine.
 */
export function Rocket({ w, h, seats, riders, flame = 0, upright = 0, newest = -1 }) {
  const reduce = useReducedMotion()
  const spots = windowSpots(seats)
  return (
    <svg viewBox="0 0 100 160" width={w} height={h} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {/* the flame under the nozzle */}
      <motion.g style={{ originX: '50px', originY: '146px' }}
        animate={{ scaleY: flame ? (reduce ? 1 : [0.8 + flame * 0.5, 1 + flame * 0.7, 0.85 + flame * 0.5]) : 0, opacity: flame ? 1 : 0 }}
        transition={flame && !reduce ? { duration: 0.18, repeat: Infinity } : { duration: 0.15 }}>
        <path d="M34 146 Q50 214 66 146 Z" fill="#ff6b3d" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M41 146 Q50 190 59 146 Z" fill="#ffd34d" />
      </motion.g>
      {/* fins (the legs it stands on) */}
      <path d="M22 98 L4 134 L6 160 L26 140 Z" fill="#ff5b5b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M78 98 L96 134 L94 160 L74 140 Z" fill="#ff5b5b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {/* nozzle */}
      <path d="M36 136 H64 L60 150 H40 Z" fill="#8b84a3" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {/* body */}
      <path d="M50 4 C76 22 82 52 81 86 L79 138 H21 L19 86 C18 52 24 22 50 4 Z" fill={PARCH} stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M50 4 C64 14 72 28 76 40 H24 C28 28 36 14 50 4 Z" fill="#ff5b5b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M26 46 C26 70 26 110 28 132" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity="0.8" />
      <rect x="20" y="126" width="60" height="7" fill="#ff5b5b" stroke={INK} strokeWidth="3" />
      {/* windows, and who looks out of them */}
      <defs>
        {spots.map((s, i) => <clipPath key={i} id={`rk-win-${i}`}><circle cx={s.x} cy={s.y} r={s.r} /></clipPath>)}
      </defs>
      {spots.map((s, i) => {
        const hue = riders[i]
        const S = s.r * 5.6
        return (
          <g key={i}>
            <circle cx={s.x} cy={s.y} r={s.r + 2.5} fill="#c9c3dc" stroke={INK} strokeWidth="3" />
            <circle cx={s.x} cy={s.y} r={s.r} fill={hue == null ? '#2c2457' : '#bfe6ff'} />
            {hue != null && (
              <motion.g clipPath={`url(#rk-win-${i})`}
                initial={i === newest && !reduce ? { opacity: 0 } : false} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                {/* the face stays upright when the rocket lies on its side */}
                <g transform={`rotate(${-upright} ${s.x} ${s.y})`}>
                  <image href={ALIEN_SRC} x={s.x - 0.47 * S} y={s.y - 0.36 * S} width={S} height={S} style={{ filter: `hue-rotate(${hue}deg)` }} />
                </g>
              </motion.g>
            )}
            {hue == null && <circle cx={s.x - s.r * 0.35} cy={s.y - s.r * 0.35} r={s.r * 0.28} fill="#fff" opacity="0.5" />}
          </g>
        )
      })}
    </svg>
  )
}

const round = (size, bg) => ({
  all: 'unset', boxSizing: 'border-box', width: size, height: size, borderRadius: size * 0.28, flexShrink: 0, position: 'relative',
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: `radial-gradient(circle at 35% 25%, rgba(255,255,255,0.5), transparent 55%), ${bg}`,
  border: `4px solid ${INK}`, boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.18), 0 5px 0 rgba(42,27,61,0.4)',
  WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
})

/**
 * A thrust button: an arrow the way the rocket hops, a flame behind it, and
 * the sign it stands for in its corner (in the sign's colour, as in the sum).
 * `way` is the arrow on screen: 'right' | 'left' | 'up' | 'down'.
 */
export function ThrustButton({ op, way, size, onPress, btnRef, pulse = 0 }) {
  const reduce = useReducedMotion()
  const turn = { right: 0, down: 90, left: 180, up: 270 }[way]
  return (
    <motion.button ref={btnRef} type="button" aria-label={op === PLUS ? 'Vorwärts hüpfen' : 'Rückwärts hüpfen'}
      data-thrust={op === PLUS ? 'plus' : 'minus'}
      onPointerDown={e => { e.preventDefault(); onPress() }}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPress() } }}
      whileTap={reduce ? undefined : { scale: 0.88, y: 3 }}
      animate={pulse && !reduce ? { rotate: [0, -8, 8, -6, 6, 0], scale: [1, 1.1, 1] } : { rotate: 0, scale: 1 }}
      transition={{ duration: 0.7 }}
      key={pulse}
      style={round(size, SIGN_COLOR[op])}>
      <svg viewBox="0 0 100 100" width={size * 0.8} height={size * 0.8} aria-hidden="true" style={{ transform: `rotate(${turn}deg)`, overflow: 'visible' }}>
        {/* the flame trails behind the arrow */}
        <path d="M30 50 Q6 34 -2 50 Q6 66 30 50 Z" fill="#ffd34d" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M30 50 Q14 42 10 50 Q14 58 30 50 Z" fill="#ff6b3d" />
        <path d="M28 38 H58 V22 L92 50 L58 78 V62 H28 Z" fill="#fff" stroke={INK} strokeWidth="6" strokeLinejoin="round" />
      </svg>
      <span aria-hidden="true" style={{
        position: 'absolute', top: -12, right: -12, width: size * 0.42, height: size * 0.42, borderRadius: '50%',
        background: PARCH, border: `3px solid ${INK}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.36, lineHeight: 1, color: SIGN_COLOR[op],
        WebkitTextStroke: `1.5px ${INK}`,
      }}>{op}</span>
    </motion.button>
  )
}

/** The landing button: the big green tick of every number game ("done"). */
export function LandButton({ size, onPress, disabled, btnRef }) {
  return (
    <motion.button ref={btnRef} type="button" aria-label="Landen" aria-disabled={disabled} data-land=""
      onPointerDown={e => { e.preventDefault(); if (!disabled) onPress() }}
      onKeyDown={e => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) { e.preventDefault(); onPress() } }}
      animate={{ opacity: disabled ? 0.45 : 1, scale: disabled ? 0.92 : 1 }}
      whileTap={disabled ? undefined : { scale: 0.86 }}
      style={{ ...round(size, '#5cc45a'), borderRadius: '50%', cursor: disabled ? 'default' : 'pointer' }}>
      <svg viewBox="0 0 40 40" width={size * 0.55} height={size * 0.55} aria-hidden="true">
        <path d="M8 21 L17 30 L33 11" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 21 L17 30 L33 11" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  )
}

/** Little hop arcs, one per hop: under a number, on a count bubble. */
export function HopArcs({ k, width, color = '#ff8a3d', height = 12 }) {
  return (
    <svg width={width} height={height} viewBox={`0 0 ${10 * k} 10`} preserveAspectRatio="none" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {Array.from({ length: k }, (_, j) => (
        <path key={j} d={`M${j * 10 + 1} 9 Q${j * 10 + 5} -1 ${j * 10 + 9} 9`} fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

/** A number bubble for "how many hops?" */
export function CountBubble({ k, size, state, onPress }) {
  const off = state === 'tried'
  return (
    <motion.button type="button" aria-label={`${k} Hüpfer`} data-count={k} disabled={off}
      onClick={() => !off && onPress(k)}
      whileTap={off ? undefined : { scale: 0.88 }}
      initial={{ scale: 0 }} animate={{ scale: 1, opacity: off ? 0.45 : 1 }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      style={{
        all: 'unset', boxSizing: 'border-box', width: size, height: size, borderRadius: '50%', flexShrink: 0, cursor: off ? 'default' : 'pointer',
        background: off ? '#b9b2cc' : PARCH, border: `4px solid ${INK}`, boxShadow: '0 5px 0 rgba(42,27,61,0.4)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.46, lineHeight: 1, color: INK,
      }}>
      {k}
      <HopArcs k={k} width={Math.min(size * 0.62, 11 * k)} height={size * 0.13} />
    </motion.button>
  )
}

/** The star a hop can fly through: a bonus for the counter. */
export function BonusStar({ size }) {
  const reduce = useReducedMotion()
  return (
    <motion.div animate={reduce ? {} : { y: [0, -5, 0], rotate: [-8, 8, -8] }} transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}>
      <Art art="⭐" size={size} />
    </motion.div>
  )
}

/** The moon of the finale, drawn so it can be big. */
export function Moon({ r }) {
  return (
    <svg viewBox="-60 -60 120 120" width={r * 2} height={r * 2} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <circle r="58" fill="#fff3b0" opacity="0.35" />
      <circle r="50" fill="#ffe68a" stroke={INK} strokeWidth="5" />
      <circle cx="-18" cy="-14" r="10" fill="#f2cf63" stroke={INK} strokeWidth="3" />
      <circle cx="16" cy="12" r="13" fill="#f2cf63" stroke={INK} strokeWidth="3" />
      <circle cx="-10" cy="24" r="6" fill="#f2cf63" stroke={INK} strokeWidth="2.5" />
      <circle cx="22" cy="-22" r="5" fill="#f2cf63" stroke={INK} strokeWidth="2.5" />
    </svg>
  )
}
