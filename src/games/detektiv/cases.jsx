import { createContext, useContext } from 'react'
import { motion } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import Pal from './Pal.jsx'

/**
 * The cases of Gefühlsdetektiv: who, what happens to them, how they feel
 * and what helps.
 *
 * A case is data plus a little scenery. The scenery is drawn from pieces
 * placed with <At>, each with up to three looks: `before` (as the case
 * opens), `event` (what happens, as an animation) and `fixed` (after the
 * right help). The stage switches all of them at once.
 *
 * Places are measured from the friend: `dx` right of its middle, `y` above
 * the ground. Nothing may reach further than 235 (REACH) to either side.
 */
export const SH = 340          // height of the stage
export const GROUND = 46       // the ground line, from the bottom of the stage
export const FRIEND = 150      // size of the friend
export const StageCtx = createContext({ fx: 310, pv: 'before', q: 1 })

/**
 * On a narrow stage (a phone held upright) the scene moves closer together
 * instead of shrinking: what the friend holds stays where it is, things
 * further out than `NEAR` come nearer by the factor `q`.
 */
const NEAR = 80
export const REACH = 235
export const squeeze = (dx, q) => (Math.abs(dx) <= NEAR ? dx : Math.sign(dx) * (NEAR + (Math.abs(dx) - NEAR) * q))
export const squeezeFor = sw => Math.min(1, (sw / 2 - 4 - NEAR) / (REACH - NEAR))

const OUT = '#4a2a22'
const NONE = {}

// A piece without a `fixed` look keeps the one the event left it in:
// framer-motion would otherwise move it back to where it started.
const last = look => Object.fromEntries(Object.entries(look).filter(([key]) => key !== 'transition').map(([key, val]) => [key, Array.isArray(val) ? val[val.length - 1] : val]))
const looks = v => (v.event && !v.fixed ? { ...v, fixed: { ...last(v.event), transition: { duration: 0 } } } : v)

/** A piece of scenery, `w` × `h`, its bottom middle at (dx, y). */
export function At({ dx = 0, y = 0, w, h = w, z = 3, v = NONE, origin = '50% 100%', children, style }) {
  const { fx, pv, q } = useContext(StageCtx)
  // squeezed, and a wide thing at the edge stays on the stage
  const room = Math.max(0, fx - 4 - w / 2)
  const x = q < 1 && Math.abs(dx) > NEAR ? Math.max(-room, Math.min(room, squeeze(dx, q))) : dx
  return (
    <motion.div variants={looks(v)} initial="before" animate={pv}
      style={{ position: 'absolute', left: fx + x - w / 2, bottom: GROUND + y, width: w, height: h, zIndex: z, transformOrigin: origin,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', pointerEvents: 'none', ...style }}>
      {children}
    </motion.div>
  )
}

/** A layer over the whole stage: darkness, a storm sky, a flash. */
function Full({ z = 1, v, style }) {
  const { pv } = useContext(StageCtx)
  return <motion.div variants={looks(v)} initial="before" animate={pv} style={{ position: 'absolute', inset: 0, zIndex: z, pointerEvents: 'none', ...style }} />
}

// ── Things ────────────────────────────────────────────────────────────────

function IceCream({ scoop = true, color = '#ff9ec2' }) {
  return (
    <svg viewBox="0 0 40 66" width="40" height="66" style={{ display: 'block', overflow: 'visible' }}>
      <path d="M7 32 H33 L20 64 Z" fill="#e8b062" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <path d="M12 38 L24 52 M20 34 L29 44 M28 38 L16 52 M21 34 L11 44" stroke="#c98a3c" strokeWidth="1.6" />
      {scoop && <Scoop color={color} />}
    </svg>
  )
}
function Scoop({ color = '#ff9ec2' }) {
  return (
    <g>
      <path d="M4 30 C0 12 12 2 20 2 C28 2 40 12 36 30 C32 36 27 30 23 34 C18 38 14 30 9 34 C6 36 4 33 4 30 Z" fill={color} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      <ellipse cx="13" cy="13" rx="5" ry="3.2" fill="#fff" opacity="0.7" transform="rotate(-30 13 13)" />
    </g>
  )
}
const ScoopOnly = () => <svg viewBox="0 0 40 38" width="40" height="38" style={{ display: 'block', overflow: 'visible' }}><Scoop /></svg>
const Splat = () => (
  <svg viewBox="0 0 96 30" width="96" height="30" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M6 20 C0 12 14 8 22 12 C26 2 44 2 50 9 C58 2 78 6 76 14 C90 12 96 22 86 25 C70 31 22 31 10 26 C7 25 5 23 6 20 Z" fill="#ff9ec2" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
    <ellipse cx="36" cy="14" rx="9" ry="3" fill="#fff" opacity="0.6" />
    <circle cx="-4" cy="22" r="4" fill="#ff9ec2" stroke={OUT} strokeWidth="2.4" /><circle cx="101" cy="18" r="3.4" fill="#ff9ec2" stroke={OUT} strokeWidth="2.4" />
  </svg>
)

const BLOCK = 40
const BLOCK_COLORS = ['#ff6b5b', '#ffc93c', '#4aa3ff', '#5cc45a', '#c58bff', '#ff9f43']
function Block({ i }) {
  return (
    <div style={{ width: BLOCK, height: BLOCK - 2, boxSizing: 'border-box', borderRadius: 8, background: BLOCK_COLORS[i % 6], border: `3px solid ${OUT}`,
      boxShadow: 'inset 0 -6px 0 rgba(0,0,0,.16), inset 0 4px 0 rgba(255,255,255,.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 12, height: 12, borderRadius: i % 2 ? 3 : '50%', background: 'rgba(255,255,255,.75)' }} />
    </div>
  )
}

const StormCloud = () => (
  <svg viewBox="0 0 190 92" width="190" height="92" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M30 82 C4 82 2 50 28 46 C24 20 60 8 76 28 C90 4 134 6 138 36 C168 28 186 52 172 70 C168 80 156 82 146 82 Z" fill="#6f7890" stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />
    <path d="M40 68 C60 76 120 76 150 68" stroke="#525b72" strokeWidth="5" fill="none" strokeLinecap="round" />
    <path d="M62 44 L80 50 M118 50 L136 44" stroke={OUT} strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="74" cy="56" rx="4" ry="5" fill={OUT} /><ellipse cx="124" cy="56" rx="4" ry="5" fill={OUT} />
  </svg>
)
const Bolt = () => (
  <svg viewBox="0 0 50 110" width="50" height="110" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M30 0 L4 58 H22 L12 110 L48 42 H28 L40 0 Z" fill="#ffd93c" stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />
  </svg>
)
function Rain({ w = 170, h = 150, n = 9 }) {
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} style={{ display: 'block' }}>
      {Array.from({ length: n }, (_, i) => (
        <motion.rect key={i} x={8 + (i * (w - 16)) / (n - 1)} y="0" width="4" height="16" rx="2" fill="#4aa3ff"
          animate={{ y: [-(i % 3) * 14, h - 10], opacity: [1, 1, 0] }} transition={{ duration: 0.7 + (i % 3) * 0.12, repeat: Infinity, ease: 'linear', delay: (i % 4) * 0.17 }} />
      ))}
    </svg>
  )
}

const flicker = { opacity: [1, 0.15, 1, 0.15, 1, 0], transition: { duration: 0.9, delay: 0.5, times: [0, 0.2, 0.4, 0.6, 0.8, 1] } }
function Lamp() {
  return (
    <svg viewBox="0 0 90 124" width="90" height="124" style={{ display: 'block', overflow: 'visible' }}>
      <path d="M45 -40 V40" stroke={OUT} strokeWidth="4" />
      <path d="M70 76 V110" stroke={OUT} strokeWidth="2.6" /><circle cx="70" cy="114" r="6.5" fill="#ff6b5b" stroke={OUT} strokeWidth="2.6" />
      <circle cx="45" cy="84" r="12" fill="#9aa0b4" stroke={OUT} strokeWidth="3" />
      <motion.circle cx="45" cy="84" r="12" fill="#ffe066" stroke={OUT} strokeWidth="3" variants={{ before: { opacity: 1 }, event: flicker, fixed: { opacity: 1 } }} />
      <path d="M22 40 H68 L84 78 H6 Z" fill="#ff8f6b" stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />
      <path d="M27 48 H63" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}

const Sun = () => (
  <svg viewBox="0 0 80 80" width="80" height="80" style={{ display: 'block', overflow: 'visible' }}>
    {Array.from({ length: 10 }, (_, i) => <path key={i} d="M40 2 V12" stroke="#ffb200" strokeWidth="6" strokeLinecap="round" transform={`rotate(${i * 36} 40 40)`} />)}
    <circle cx="40" cy="40" r="22" fill="#ffd93c" stroke={OUT} strokeWidth="3" />
  </svg>
)
const Moon = () => (
  <svg viewBox="0 0 70 70" width="70" height="70" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M44 6 C22 8 10 26 14 44 C18 60 36 68 54 60 C38 58 28 46 30 30 C31 20 36 11 44 6 Z" fill="#fff3b0" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
    <path d="M60 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z M6 14 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" fill="#fff3b0" stroke={OUT} strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
)

const Table = ({ w = 120 }) => (
  <svg viewBox="0 0 120 70" width={w} height={(w * 70) / 120} style={{ display: 'block', overflow: 'visible' }}>
    <path d="M18 16 V68 M102 16 V68" stroke={OUT} strokeWidth="11" strokeLinecap="round" /><path d="M18 16 V68 M102 16 V68" stroke="#c98a4a" strokeWidth="5.5" strokeLinecap="round" />
    <rect x="3" y="4" width="114" height="15" rx="6" fill="#e2a45c" stroke={OUT} strokeWidth="3.4" />
  </svg>
)
const Glass = () => (
  <svg viewBox="0 0 30 44" width="30" height="44" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M4 4 H26 L23 41 H7 Z" fill="#eaf7ff" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
    <motion.path d="M6 14 H24 L22 39 H8 Z" fill="#ff9f1c" variants={{ before: { opacity: 1 }, event: { opacity: 0, transition: { delay: 1.05, duration: 0.3 } }, fixed: { opacity: 0 } }} />
  </svg>
)

function Window({ size = 130 }) {
  return (
    <svg viewBox="0 0 130 130" width={size} height={size} style={{ display: 'block', overflow: 'visible' }}>
      <rect x="6" y="6" width="118" height="110" rx="6" fill="#9fd8ff" />
      <motion.circle cx="92" cy="40" r="16" fill="#ffd93c" stroke={OUT} strokeWidth="2.4" variants={looks({ before: { opacity: 1 }, event: { opacity: 0, transition: { delay: 0.3, duration: 0.6 } } })} />
      <path d="M6 116 V96 C30 84 50 98 70 92 C94 84 110 92 124 86 V116 Z" fill="#7fcf5f" />
      <motion.rect x="6" y="6" width="118" height="110" rx="6" fill="#7d8799" variants={looks({ before: { opacity: 0 }, event: { opacity: 0.85, transition: { delay: 0.3, duration: 0.8 } } })} />
      <motion.g variants={looks({ before: { opacity: 0 }, event: { opacity: 1, transition: { delay: 0.9, duration: 0.4 } } })}>
        <g transform="translate(8 8)"><Rain w={114} h={106} n={8} /></g>
      </motion.g>
      <rect x="6" y="6" width="118" height="110" rx="6" fill="none" stroke={OUT} strokeWidth="5" />
      <path d="M65 6 V116 M6 60 H124" stroke={OUT} strokeWidth="9" /><path d="M65 6 V116 M6 60 H124" stroke="#e2a45c" strokeWidth="4" />
      <rect x="6" y="6" width="118" height="110" rx="6" fill="none" stroke="#e2a45c" strokeWidth="2" />
      <rect x="-2" y="114" width="134" height="12" rx="5" fill="#e2a45c" stroke={OUT} strokeWidth="3.4" />
    </svg>
  )
}

const Bush = () => (
  <svg viewBox="0 0 130 100" width="130" height="100" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M14 98 C-6 92 -2 62 20 62 C12 38 42 22 58 38 C68 14 108 22 104 50 C130 46 138 82 116 96 C112 99 20 100 14 98 Z" fill="#4fae46" stroke={OUT} strokeWidth="3.4" strokeLinejoin="round" />
    <path d="M30 74 q8 -8 16 0 M70 56 q9 -9 18 0 M84 82 q8 -7 16 0 M44 48 q6 -6 12 0" stroke="#2f8a2c" strokeWidth="3.4" fill="none" strokeLinecap="round" />
    <motion.g variants={{ before: { opacity: 0 }, event: { opacity: [0, 1, 1, 0, 1], transition: { delay: 1.3, duration: 1.1, times: [0, 0.15, 0.55, 0.65, 0.8] } }, fixed: { opacity: 0 } }}>
      <ellipse cx="52" cy="66" rx="7" ry="8" fill="#fff" stroke={OUT} strokeWidth="2" /><ellipse cx="74" cy="66" rx="7" ry="8" fill="#fff" stroke={OUT} strokeWidth="2" />
      <circle cx="50" cy="67" r="3.2" fill={OUT} /><circle cx="72" cy="67" r="3.2" fill={OUT} />
    </motion.g>
  </svg>
)
const Leaf = () => <svg viewBox="0 0 20 14" width="20" height="14" style={{ display: 'block' }}><path d="M1 7 C6 -2 16 0 19 7 C14 14 6 14 1 7 Z" fill="#6fcf5a" stroke={OUT} strokeWidth="2" /></svg>

// the drawing: a house, a sun, the grass
const draw = (delay, to = 1, dur = 0.5) => ({ before: { pathLength: 0, opacity: 0 }, event: { pathLength: to, opacity: 1, transition: { delay, duration: dur } }, fixed: { pathLength: 1, opacity: 1, transition: { delay: to < 1 ? 1 : 0, duration: to < 1 ? 0.8 : 0 } } })
const later = delay => ({ before: { pathLength: 0, opacity: 0 }, fixed: { pathLength: 1, opacity: 1, transition: { delay, duration: 0.5 } } })
function Motif({ times, done = false }) {
  const P = done ? 'path' : motion.path
  const v = i => (done ? {} : { variants: times[i] })
  const s = { fill: 'none', strokeWidth: 5, strokeLinecap: 'round', strokeLinejoin: 'round' }
  return (
    <g>
      <P d="M26 70 V46 L44 30 L62 46 V70 Z M38 70 V56 H50 V70" stroke="#e8483a" {...s} {...v(0)} />
      <P d="M82 16 a10 10 0 1 0 0.1 0 M82 0 V-6 M98 26 H104 M94 12 L99 7" stroke="#ffab1c" {...s} {...v(1)} />
      <P d="M10 76 q8 -9 14 0 q8 -9 14 0 q8 -9 14 0 q8 -9 14 0 q8 -9 14 0 q8 -9 14 0" stroke="#3faa3c" {...s} {...v(2)} />
    </g>
  )
}
/** An easel with a sheet on it. */
function Board({ times, lift = false }) {
  return (
    <svg viewBox="0 0 120 150" width="120" height="150" style={{ display: 'block', overflow: 'visible' }}>
      <path d="M26 20 L8 148 M94 20 L112 148 M60 20 V140" stroke={OUT} strokeWidth="10" strokeLinecap="round" /><path d="M26 20 L8 148 M94 20 L112 148 M60 20 V140" stroke="#c98a4a" strokeWidth="5" strokeLinecap="round" />
      <rect x="4" y="102" width="112" height="10" rx="4" fill="#e2a45c" stroke={OUT} strokeWidth="3" />
      <motion.g variants={lift ? looks({ before: { opacity: 1 }, event: { opacity: 0, transition: { delay: 2, duration: 0.15 } } }) : NONE}>
        <rect x="6" y="4" width="108" height="94" rx="4" fill="#fffdf7" stroke={OUT} strokeWidth="3.4" />
        <g transform="translate(2 12)"><Motif times={times} /></g>
      </motion.g>
    </svg>
  )
}
const Picture = () => (
  <svg viewBox="0 0 108 94" width="84" height="73" style={{ display: 'block', overflow: 'visible' }}>
    <rect x="2" y="2" width="104" height="90" rx="4" fill="#fffdf7" stroke={OUT} strokeWidth="4" />
    <g transform="translate(-2 10)"><Motif done /></g>
  </svg>
)
export const Blanket = ({ w = 58 }) => (
  <svg viewBox="0 0 58 42" width={w} height={(w * 42) / 58} style={{ display: 'block', overflow: 'visible' }}>
    <rect x="3" y="6" width="52" height="33" rx="8" fill="#7fb8ff" stroke={OUT} strokeWidth="3" />
    <path d="M3 20 H55 M3 30 H55 M20 6 V39 M38 6 V39" stroke="#4a8ee6" strokeWidth="2.6" />
    <path d="M6 10 C20 0 38 0 52 10" fill="#a9d1ff" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
  </svg>
)
const Bunting = () => (
  <svg viewBox="0 0 300 50" width="300" height="50" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M0 6 Q150 34 300 6" stroke={OUT} strokeWidth="3" fill="none" />
    {Array.from({ length: 9 }, (_, i) => { const x = 14 + i * 34, y = 8 + 22 * (1 - ((i - 4) / 4.4) ** 2) * 0.62; return <path key={i} d={`M${x - 11} ${y} H${x + 11} L${x} ${y + 24} Z`} fill={BLOCK_COLORS[i % 6]} stroke={OUT} strokeWidth="2.6" strokeLinejoin="round" /> })}
  </svg>
)
const Bark = () => (
  <svg viewBox="0 0 60 90" width="60" height="90" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M50 14 Q26 45 50 76 M34 22 Q16 45 34 68 M18 30 Q8 45 18 60" stroke={OUT} strokeWidth="5" fill="none" strokeLinecap="round" />
  </svg>
)
const Star = () => (
  <svg viewBox="0 0 24 24" width="44" height="44" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="#ffc93c" stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
  </svg>
)

/** What a friend or Lumi can hold in a hand. */
export function holdNode(key) {
  switch (key) {
    case 'cone2':   return <IceCream />
    case 'cone':    return <IceCream scoop={false} />
    case 'balloon': return <Art art="🎈" size={84} />
    case 'crayon':  return <Art art="🖍" size={50} style={{ transform: 'rotate(-55deg) translateY(8px)' }} />
    case 'stub':    return <div style={{ width: 22, height: 26, overflow: 'hidden' }}><Art art="🖍" size={50} style={{ transform: 'translate(-2px, 22px) rotate(-55deg) translateY(8px)' }} /></div>
    case 'picture': return <Picture />
    case 'popped':  return (
      <svg viewBox="0 0 30 70" width="30" height="70" style={{ display: 'block', overflow: 'visible' }}>
        <path d="M15 70 C8 56 22 46 15 30" stroke={OUT} strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <path d="M15 31 C4 30 2 16 9 12 C10 19 14 18 13 8 C21 10 20 20 26 14 C28 24 22 31 15 31 Z" fill="#e8372e" stroke={OUT} strokeWidth="2.6" strokeLinejoin="round" />
      </svg>
    )
    case 'blanket': return <Blanket />
    case '🍦':      return <IceCream color="#ffe08a" />
    case '🖍':      return holdNode('crayon')
    case '🎈':      return holdNode('balloon')
    case '🔍':      return <Art art="🔍" size={54} />
    default:        return <Art art={key} size={46} />
  }
}

// ── Sceneries ─────────────────────────────────────────────────────────────

const hidden = { opacity: 0 }
const HAND = { dx: 72, y: 86 }   // the friend's right hand

function EisScene() {
  return <>
    <At dx={HAND.dx} y={HAND.y + 29} w={40} h={38} z={7} origin="50% 80%" v={{
      before: hidden,
      event: { opacity: [1, 1, 1, 1, 0], rotate: [0, -16, 16, -22, 70], x: [0, 0, 0, -5, 30], y: [0, 0, 0, 0, 118],
        transition: { duration: 1.5, times: [0, 0.14, 0.3, 0.46, 1], ease: ['easeInOut', 'easeInOut', 'easeInOut', 'easeIn'], opacity: { duration: 1.56, times: [0, 0.1, 0.5, 0.96, 1] } } },
    }}><ScoopOnly /></At>
    <At dx={HAND.dx + 30} y={-10} w={96} h={30} z={7} v={{ before: { opacity: 0, scale: 0.2 }, event: { opacity: 1, scale: 1, transition: { delay: 1.48, type: 'spring', stiffness: 500, damping: 14 } } }}><Splat /></At>
  </>
}

// where the blocks of the tumbled tower come to lie: [x, turn]
const TUMBLE = [[8, 0, 0], [52, 24, 2], [-54, -112, 3], [86, 200, 2], [-96, -38, 4]]
function TurmScene() {
  const { q } = useContext(StageCtx)
  return TUMBLE.map(([x, rot, lift]) => [x * q, rot, lift]).map(([tx, rot, lift], i) => (
    <At key={i} dx={122} y={i * (BLOCK - 2)} w={BLOCK} h={BLOCK - 2} z={i === 4 ? 7 : 4} origin="50% 50%" v={{
      before: { x: 0, y: 0, rotate: 0 },
      event: { x: [0, i * 2.5, -i * 2.5, i * 4, tx], y: [0, 0, 0, 0, i * (BLOCK - 2) - lift], rotate: [0, i * 1.5, -i * 1.5, i * 2.5, rot],
        transition: { duration: 1.5 + (4 - i) * 0.1, delay: 0.25, times: [0, 0.2, 0.4, 0.58, 1], ease: ['easeInOut', 'easeInOut', 'easeInOut', 'easeIn'] } },
      fixed: { x: 0, y: 0, rotate: 0, transition: { delay: 0.15 + i * 0.32, type: 'spring', stiffness: 260, damping: 20 } },
    }}><Block i={i} /></At>
  ))
}

const stormSky = { background: 'linear-gradient(#4b556e, #8b93a8)' }
function GewitterScene() {
  const flash = { opacity: [0, 1, 0, 0.9, 0, 0, 1, 0], transition: { duration: 1.6, delay: 0.85, times: [0, 0.04, 0.12, 0.16, 0.24, 0.6, 0.64, 0.76] } }
  return <>
    <Full z={1} style={stormSky} v={{ before: hidden, event: { opacity: 0.75, transition: { duration: 0.8 } }, fixed: { opacity: 0, transition: { delay: 0.9, duration: 1.2 } } }} />
    <Full z={8} style={{ background: '#fff' }} v={{ before: hidden, event: { ...flash, opacity: flash.opacity.map(o => o * 0.55) }, fixed: hidden }} />
    <At dx={112} y={196} w={190} h={92} z={3} v={{ before: { x: 300, opacity: 0 }, event: { x: 0, opacity: 1, transition: { duration: 0.8 } }, fixed: { x: 320, opacity: 0, transition: { delay: 0.9, duration: 1.3 } } }}><StormCloud /></At>
    <At dx={112} y={52} w={170} h={150} z={2} v={{ before: hidden, event: { opacity: 1, transition: { delay: 0.8 } }, fixed: { opacity: 0, transition: { delay: 0.9 } } }}><Rain /></At>
    <At dx={150} y={92} w={50} h={110} z={4} v={{ before: hidden, event: flash, fixed: hidden }}><Bolt /></At>
  </>
}

function GeschenkScene() {
  return <>
    <At dx={128} y={50} w={62} z={3} v={{ before: { opacity: 0, scale: 0.2, y: 40 }, event: { opacity: 1, scale: 1, y: 0, transition: { delay: 1.7, type: 'spring', stiffness: 400, damping: 12 } } }}><Art art="🧸" size={62} /></At>
    <At dx={128} y={-4} w={92} z={4} v={{
      before: { y: -340, opacity: 0, rotate: 0 },
      event: { y: [-340, 0, -22, 0], opacity: 1, rotate: [0, 0, -7, 7, -7, 7, 0],
        transition: { y: { duration: 0.8, times: [0, 0.7, 0.86, 1], ease: 'easeIn' }, opacity: { duration: 0.1 }, rotate: { delay: 1.1, duration: 0.55 } } },
    }}><Art art="🎁" size={92} /></At>
    <At dx={172} y={124} w={40} z={5} v={{ before: hidden, event: { opacity: [0, 1, 0], scale: [0.4, 1.3, 0.8], transition: { delay: 1.7, duration: 0.9 } } }}><Art art="✨" size={40} /></At>
  </>
}

function AlleinScene() {
  // the others go off to play further away, where the friend can still see them
  const off = (x, d) => ({ before: { x: 0, y: 0, scale: 1 }, event: { x, y: -44, scale: 0.62, transition: { duration: 1.3, delay: 0.9 + d, ease: 'easeInOut' } } })
  const hop = { y: [0, -14, 0] }
  return <>
    <At dx={104} w={86} h={93} v={off(52, 0.1)}><motion.div animate={hop} transition={{ duration: 0.5, repeat: Infinity, delay: 0.25 }}><Pal kind="katze" feel="happy" size={86} still /></motion.div></At>
    <At dx={190} w={86} h={93} v={off(16, 0)}><motion.div animate={hop} transition={{ duration: 0.5, repeat: Infinity }}><Pal kind="schwein" feel="happy" size={86} still /></motion.div></At>
    <At dx={147} y={70} w={40} z={4} origin="50% 270%" v={off(34, 0.05)}>
      <motion.div animate={{ x: [-34, 34], y: [0, -26, 0] }} transition={{ x: { duration: 0.5, repeat: Infinity, repeatType: 'mirror', ease: 'linear' }, y: { duration: 0.5, repeat: Infinity } }}><Art art="⚽" size={40} /></motion.div>
    </At>
  </>
}

function BellenScene() {
  const bark = { opacity: [0, 1, 0, 0, 1, 0], scale: [0.6, 1.1, 1.2, 0.6, 1.1, 1.2], transition: { duration: 1.5, delay: 0.9, times: [0, 0.1, 0.35, 0.55, 0.65, 0.9] } }
  return <>
    <At dx={160} w={150} h={162} z={4} v={{
      before: { x: 280 },
      event: { x: [280, 0, -22, 0, 0, -22, 0], transition: { duration: 2.3, delay: 0.15, times: [0, 0.28, 0.36, 0.44, 0.66, 0.74, 0.82] } },
      fixed: { x: 300, transition: { delay: 0.7, duration: 0.9, ease: 'easeIn' } },
    }}><Pal kind="hund" feel="scold" arms="down" size={150} still /></At>
    <At dx={84} y={56} w={60} h={90} z={7} origin="100% 50%" v={{ before: hidden, event: bark, fixed: hidden }}><Bark /></At>
  </>
}

function StiftScene() {
  return <>
    <At dx={150} y={-4} w={120} h={150} z={3}><Board times={[draw(0.1, 0.55, 1.05), later(1.9), later(2.4)]} /></At>
    <At dx={HAND.dx + 4} y={HAND.y + 26} w={26} h={26} z={7} origin="50% 50%" v={{
      before: hidden,
      event: { opacity: [0, 1, 1], x: [0, 14, 34], y: [0, -34, 108], rotate: [0, 160, 400], transition: { delay: 1.2, duration: 0.75, times: [0, 0.35, 1] } },
    }}><div style={{ width: 26, height: 24, overflow: 'hidden' }}><Art art="🖍" size={50} style={{ transform: 'translate(-20px, -4px)' }} /></div></At>
    <At dx={HAND.dx - 6} y={-10} w={22} h={26} z={7} origin="50% 50%" v={{
      before: hidden,
      event: { opacity: [0, 1, 1], y: [-100, -100, 0], rotate: [0, 0, -70], transition: { delay: 1.9, duration: 0.4, times: [0, 0.1, 1], ease: 'easeIn' } },
    }}>{holdNode('stub')}</At>
    <At dx={HAND.dx + 8} y={HAND.y + 14} w={60} z={8} origin="50% 50%" v={{ before: hidden, event: { opacity: [0, 1, 0], scale: [0.3, 1.1, 1.3], transition: { delay: 1.18, duration: 0.5 } } }}><Art art="💥" size={60} /></At>
  </>
}

function BallonScene() {
  return (
    <At dx={HAND.dx} y={HAND.y} w={84} z={7} v={{
      before: { y: -330, x: 70, opacity: 0 },
      event: { y: [-330, 0], x: [70, -24, 16, 0], opacity: [1, 1, 1, 0], rotate: [8, -8, 6, 0],
        transition: { duration: 1.5, ease: 'easeOut', opacity: { duration: 1.52, times: [0, 0.5, 0.98, 1] } } },
    }}><Art art="🎈" size={84} /></At>
  )
}

const LAMP_DX = -112
function DunkelScene() {
  const dark = { before: hidden, event: { opacity: [0, 0.82, 0, 0.82, 0, 0.82], transition: flicker.transition }, fixed: { opacity: 0, transition: { duration: 0.25 } } }
  return <>
    <At dx={LAMP_DX} y={-GROUND} w={330} h={258} z={3} origin="50% 0%" style={{ clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)', background: 'linear-gradient(rgba(255,235,130,.75), rgba(255,235,130,.12))' }}
      v={{ before: { opacity: 1 }, event: flicker, fixed: { opacity: 1, transition: { duration: 0.25 } } }} />
    <At dx={LAMP_DX} y={SH - GROUND - 164} w={90} h={124} z={7} origin="50% 0%"
      v={{ before: { y: 0 }, fixed: { y: [0, 14, 0], transition: { duration: 0.3 } } }}><Lamp /></At>
    <At dx={126} y={-2} w={70} z={3}><Art art="🧸" size={70} /></At>
    <Full z={4} style={{ background: '#141a3a' }} v={dark} />
  </>
}

function PlatzenScene() {
  return <>
    <At dx={HAND.dx} y={HAND.y} w={84} z={7} v={{
      before: hidden,
      event: { opacity: [1, 1, 0], scale: [1, 1.22, 1.16, 1.42, 1.36, 1.7, 1.9], transition: { duration: 1.4, times: [0, 0.14, 0.28, 0.42, 0.56, 0.9, 1], opacity: { duration: 1.42, times: [0, 0.985, 1] } } },
    }}><Art art="🎈" size={84} /></At>
    <At dx={HAND.dx + 4} y={HAND.y + 60} w={110} z={8} origin="50% 50%" v={{ before: hidden, event: { opacity: [0, 1, 0], scale: [0.4, 1.2, 1.5], transition: { delay: 1.38, duration: 0.5 } } }}><Art art="💥" size={110} /></At>
    {[[-60, -50], [58, -70], [-30, 60], [74, 30], [8, -90]].map(([x, y], i) => (
      <At key={i} dx={HAND.dx + 4} y={HAND.y + 90} w={18} h={13} z={8} origin="50% 50%" v={{
        before: hidden,
        event: { opacity: [0, 1, 1], x: [0, x, x * 1.35], y: [0, y, 180 - (i % 2) * 6], rotate: [0, 200, 260 + i * 40], transition: { delay: 1.4, duration: 1, times: [0, 0.3, 1], ease: ['easeOut', 'easeIn'], opacity: { delay: 1.4, duration: 0.1 } } },
      }}><div style={{ width: 18, height: 13, boxSizing: 'border-box', borderRadius: '60% 30% 50% 40%', background: '#e8372e', border: `2.5px solid ${OUT}` }} /></At>
    ))}
  </>
}

function BildScene() {
  return <At dx={150} y={-4} w={120} h={150} z={3}><Board lift times={[draw(0.15), draw(0.75), draw(1.35)]} /></At>
}

function HochturmScene() {
  return <>
    {Array.from({ length: 6 }, (_, i) => (
      <At key={i} dx={128} y={i * (BLOCK - 2)} w={BLOCK} h={BLOCK - 2} z={4} origin="50% 50%" v={{
        before: { opacity: 0, x: -70, y: -70 },
        event: { opacity: 1, x: [-70, -30, 0], y: [-70, -110, 0], transition: { delay: 0.2 + i * 0.38, duration: 0.34, times: [0, 0.5, 1], opacity: { delay: 0.2 + i * 0.38, duration: 0.05 } } },
      }}><Block i={i + 1} /></At>
    ))}
    <At dx={128} y={6 * (BLOCK - 2) - 2} w={44} z={4} origin="50% 50%" v={{ before: { opacity: 0, scale: 0 }, event: { opacity: 1, scale: [0, 1.4, 1], rotate: [0, 360], transition: { delay: 2.55, duration: 0.5 } } }}><Star /></At>
  </>
}

function SpaetScene() {
  return <>
    <At dx={150} y={190} w={80} z={0} origin="50% 50%" v={{ before: { y: 0 }, event: { y: 300, transition: { delay: 0.2, duration: 1.5, ease: 'easeIn' } } }}><Sun /></At>
    <Full z={1} style={{ background: 'linear-gradient(#1c2452, #4a3f7a 70%, #c9785a)' }} v={{ before: hidden, event: { opacity: 0.9, transition: { delay: 0.7, duration: 1.2 } } }} />
    <At dx={-140} y={190} w={70} z={1} origin="50% 50%" v={{ before: { opacity: 0, y: 70 }, event: { opacity: 1, y: 0, transition: { delay: 1.6, duration: 0.8 } } }}><Moon /></At>
    <At dx={110} y={-4} w={50} z={3}><Art art="⚽" size={50} /></At>
    <Full z={4} style={{ background: '#141a3a' }} v={{ before: hidden, event: { opacity: 0.3, transition: { delay: 0.9, duration: 1.2 } } }} />
  </>
}

function SaftScene() {
  return <>
    <At dx={134} y={-4} w={120} h={70} z={3}><Table /></At>
    <At dx={104} y={62} w={30} h={44} z={4} origin="20% 100%" v={{
      before: { rotate: 0 },
      event: { rotate: [0, -14, 8, -96], x: [0, 0, 0, -6], transition: { delay: 0.65, duration: 0.5, times: [0, 0.3, 0.55, 1] } },
      fixed: { rotate: 0, x: 0, transition: { delay: 0.3 } },
    }}><Glass /></At>
    <At dx={70} y={-4} w={10} h={62} z={4} origin="50% 0%" v={{ before: { opacity: 0, scaleY: 0 }, event: { opacity: [0, 1, 1, 0], scaleY: [0, 1, 1, 1], transition: { delay: 1.1, duration: 0.9, times: [0, 0.3, 0.8, 1] } }, fixed: hidden }}>
      <div style={{ width: 8, height: 62, borderRadius: 4, background: '#ff9f1c' }} />
    </At>
    <At dx={74} y={-16} w={128} h={26} z={7} origin="50% 50%" v={{ before: { opacity: 0, scaleX: 0 }, event: { opacity: 1, scaleX: 1, transition: { delay: 1.2, duration: 0.8 } }, fixed: { opacity: 0, scaleX: 0, transition: { delay: 0.3, duration: 1.3 } } }}>
      <div style={{ width: 128, height: 26, boxSizing: 'border-box', borderRadius: '50%', background: '#ffb347', border: `3px solid ${OUT}`, boxShadow: 'inset 0 4px 0 rgba(255,255,255,.5)' }} />
    </At>
  </>
}

function RegenScene() {
  return <>
    <At dx={136} y={88} w={176} h={176} z={2}><Window size={176} /></At>
    <At dx={84} y={-4} w={46} z={7} origin="50% 50%" v={{ before: { x: 0, rotate: 0 }, event: { x: 90, rotate: 320, transition: { delay: 1.1, duration: 1.6, ease: 'easeOut' } } }}><Art art="⚽" size={46} /></At>
  </>
}

function GeburtstagScene() {
  const up = (d, x) => ({ before: { y: 330, x: 0 }, event: { y: 0, x: [0, x, 0], transition: { delay: d, duration: 1.3, ease: 'easeOut' } } })
  return <>
    <At dx={0} y={SH - GROUND - 58} w={300} h={50} z={2} origin="50% 0%" v={{ before: { y: -90 }, event: { y: 0, transition: { delay: 0.15, type: 'spring', stiffness: 200, damping: 12 } } }}><Bunting /></At>
    <At dx={-150} y={150} w={70} z={2} v={up(0.9, 14)}><Art art="🎈" size={70} /></At>
    <At dx={196} y={160} w={64} z={2} v={up(1.1, -12)}><Art art="🎈" size={64} /></At>
    <At dx={134} y={-4} w={120} h={70} z={3} v={{ before: { x: 300 }, event: { x: 0, transition: { delay: 0.3, type: 'spring', stiffness: 160, damping: 16 } } }}>
      <Table /><div style={{ position: 'absolute', bottom: 58, left: 14 }}><Art art="🎂" size={92} /></div>
    </At>
  </>
}

function BuschScene() {
  const rustle = { before: { rotate: 0 }, event: { rotate: [0, -5, 5, -5, 5, 0, 0, -6, 6, -6, 0], x: [0, -3, 3, -3, 3, 0, 0, -4, 4, -4, 0], transition: { delay: 0.4, duration: 1.9 } }, fixed: { rotate: [0, -6, 6, 0], transition: { delay: 0.3, duration: 0.4 } } }
  return <>
    <At dx={128} y={0} w={64} z={7} v={{ before: hidden, fixed: { opacity: 1, x: [30, -22], y: [-30, -64, 0], transition: { delay: 0.6, duration: 0.6, opacity: { delay: 0.6, duration: 0.05 } } } }}><Art art="🦔" size={64} /></At>
    <At dx={164} y={-8} w={130} h={100} z={6} v={rustle}><Bush /></At>
    {[[110, 80, -40, -50], [200, 96, 30, -60], [150, 104, -10, -70]].map(([dx, y, x, up], i) => (
      <At key={i} dx={dx} y={y} w={20} h={14} z={7} origin="50% 50%" v={{ before: hidden, event: { opacity: [0, 1, 0], x: [0, x], y: [0, up, 20], rotate: [0, 240], transition: { delay: 0.5 + i * 0.5, duration: 0.9 } } }}><Leaf /></At>
    ))}
  </>
}

// ── The cases ─────────────────────────────────────────────────────────────
//
// `kind` the animal (Pal), `sound` its voice (lib/animalSounds.js), `feeling`
// the word (feelings.js) and `face` how the friend shows it. `start` is the
// friend as the case opens; `event(c)` is what happens, as timed steps;
// `ms` how long it takes. `good` are the cards that help (one of them is
// offered), `gift` what "Teilen" hands over, `odd` kind things that do not
// fit this case, `glad(card)` the friend once helped, `hurt` its face after
// an unkind card where the feeling was a bright one. `notWith`: feelings
// never offered as a wrong face in this case, because a child could argue
// for them (the tower fell over by itself: sad is as right as angry; the
// friend visibly startles before it is glad about the present). The pairs
// that hold for every case are ALIKE in EmpathyGame.jsx;
// tests/unit/detektiv.test.js checks every case at every level it is in.
const MEAN = ['laugh', 'leave', 'scold']
const happy = () => ({ feel: 'happy', strength: 2 })

export const CASES = [
  { id: 'eis', tier: 1, kind: 'hase', feeling: 'Traurig', face: 'sad', Scene: EisScene, ms: 2700,
    notWith: ['Wütend', 'Überrascht'],
    start: { feel: 'content', hold: 'cone2' },
    event: c => [[0, () => c.F({ hold: 'cone' })], [650, () => { c.F({ feel: 'surprised' }); c.sfx('slideDown') }], [1480, () => c.sfx('splash')], [1800, () => c.F({ feel: 'sad' })]],
    good: ['share', 'hug'], gift: '🍦', odd: ['light', 'blanket'],
    glad: card => (card === 'share' ? { feel: 'happy', strength: 2, hold: '🍦' } : { ...happy(), hold: null }) },

  { id: 'turm', tier: 1, kind: 'baer', sound: '🐻', feeling: 'Wütend', face: 'angry', Scene: TurmScene, ms: 3000,
    notWith: ['Traurig', 'Überrascht'],
    start: { feel: 'content', arms: 'work' },
    event: c => [[1100, () => { c.F({ feel: 'surprised', arms: undefined }); c.sfx('slideDown') }], [1500, () => c.sfx('drum')], [1700, () => c.sfx('drum', true)], [1900, () => c.sfx('bump')], [2100, () => c.F({ feel: 'angry' })]],
    good: ['rebuild'], odd: ['light', 'blanket'], glad: happy },

  { id: 'gewitter', tier: 1, kind: 'maus', sound: '🐭', feeling: 'Ängstlich', face: 'scared', Scene: GewitterScene, ms: 3000,
    notWith: ['Wütend'],   // the storm cloud scowls
    start: { feel: 'content' },
    event: c => [[900, () => { c.F({ feel: 'surprised' }); c.sfx('dragonNear'); c.sfx('bump') }], [1500, () => c.F({ feel: 'scared' })], [1850, () => { c.sfx('dragonNear'); c.sfx('bump') }]],
    good: ['hug'], odd: ['look', 'clap'], glad: happy },

  { id: 'geschenk', tier: 1, kind: 'katze', sound: '🐱', feeling: 'Glücklich', face: 'happy', bright: true, Scene: GeschenkScene, ms: 2900,
    notWith: ['Überrascht', 'Neugierig'],
    start: { feel: 'content' },
    event: c => [[560, () => c.sfx('boing')], [800, () => c.F({ feel: 'surprised' })], [1700, () => { c.sfx('pop'); c.sfx('sparkle') }], [1950, () => c.F({ feel: 'happy' })]],
    good: ['cheer'], odd: ['blanket', 'light'], glad: happy },

  { id: 'allein', tier: 1, kind: 'hund', sound: '🐶', feeling: 'Traurig', face: 'sad', Scene: AlleinScene, ms: 3100,
    notWith: ['Wütend', 'Überrascht'],
    start: { feel: 'content', arms: 'up' },
    event: c => [[900, () => c.sfx('whoosh')], [1200, () => c.F({ feel: 'surprised', arms: undefined })], [2200, () => c.F({ feel: 'sad' })]],
    good: ['play', 'hug'], odd: ['light', 'blanket'], glad: happy },

  { id: 'bellen', tier: 1, kind: 'schwein', sound: '🐷', feeling: 'Ängstlich', face: 'scared', Scene: BellenScene, ms: 3000,
    notWith: ['Wütend'],   // the barking dog on the stage looks angry
    start: { feel: 'content' },
    event: c => [[950, () => { c.animal('🐶') || c.sfx('bump'); c.F({ feel: 'surprised' }) }], [1500, () => c.F({ feel: 'scared' })], [1850, () => { c.sfx('bump'); c.sfx('drum') }]],
    good: ['hug'], odd: ['clap', 'look'], glad: happy },

  { id: 'stift', tier: 1, kind: 'fuchs', feeling: 'Wütend', face: 'angry', Scene: StiftScene, ms: 2900,
    notWith: ['Traurig', 'Überrascht'],
    start: { feel: 'content', hold: 'crayon' },
    event: c => [[250, () => c.sfx('step')], [550, () => c.sfx('step')], [850, () => c.sfx('step')], [1200, () => { c.F({ feel: 'surprised', hold: 'stub' }); c.sfx('bump'); c.sfx('mismatch') }], [1950, () => c.F({ feel: 'angry', hold: null })]],
    good: ['share'], gift: '🖍', odd: ['light', 'blanket'],
    glad: () => ({ feel: 'happy', strength: 2, hold: 'crayon' }) },

  { id: 'ballon', tier: 1, kind: 'loewe', sound: '🦁', feeling: 'Glücklich', face: 'happy', bright: true, Scene: BallonScene, ms: 2600,
    notWith: ['Überrascht'],
    start: { feel: 'content' },
    event: c => [[100, () => c.sfx('sparkle')], [600, () => c.F({ feel: 'surprised' })], [1500, () => { c.F({ feel: 'happy', hold: 'balloon' }); c.sfx('coin') }]],
    good: ['cheer'], odd: ['blanket', 'light'], glad: () => ({ feel: 'happy', strength: 2, hold: 'balloon' }) },

  { id: 'dunkel', tier: 1, kind: 'panda', feeling: 'Ängstlich', face: 'scared', bg: 'room', lamp: LAMP_DX, Scene: DunkelScene, ms: 2900,
    start: { feel: 'content' },
    event: c => [[600, () => c.sfx('flip')], [960, () => c.sfx('flip')], [1380, () => { c.sfx('mismatch'); c.F({ feel: 'surprised', dim: true }) }], [1950, () => c.F({ feel: 'scared' })]],
    good: ['light'], odd: ['share', 'clap'], glad: () => ({ ...happy(), dim: false }) },

  // the bang startles; what stays is sadness, and comfort or a new balloon helps
  { id: 'platzen', tier: 2, kind: 'schwein', sound: '🐷', feeling: 'Traurig', face: 'sad', Scene: PlatzenScene, ms: 2900,
    notWith: ['Überrascht', 'Ängstlich', 'Wütend'],
    start: { feel: 'content', hold: 'balloon' },
    event: c => [[0, () => { c.F({ hold: null, arms: 'holdR' }); c.sfx('slideUp') }], [400, () => c.sfx('slideUp')], [900, () => c.sfx('slideUp')], [1400, () => { c.sfx('pop'); c.sfx('bump'); c.F({ feel: 'surprised', strength: 2, arms: undefined, hold: 'popped' }) }], [2250, () => c.F({ feel: 'sad', strength: 1 })]],
    good: ['share', 'hug'], gift: '🎈', odd: ['blanket', 'light'],
    glad: card => (card === 'share' ? { feel: 'happy', strength: 2, hold: 'balloon' } : { ...happy(), hold: null }) },

  { id: 'bild', tier: 2, kind: 'katze', sound: '🐱', feeling: 'Stolz', face: 'proud', bright: true, Scene: BildScene, ms: 3100,
    start: { feel: 'content', hold: 'crayon' },
    event: c => [[200, () => c.sfx('pop')], [800, () => c.sfx('pop')], [1400, () => c.sfx('pop')], [2000, () => { c.F({ feel: 'proud', hold: ['picture', 'holdUp'] }); c.sfx('tada') }]],
    good: ['clap'], odd: ['blanket', 'light'], hurtHold: ['picture', 'holdR'], tag: [-108, 150],
    glad: () => ({ feel: 'proud', strength: 2, hold: ['picture', 'holdUp'] }) },

  { id: 'hochturm', tier: 2, kind: 'maus', sound: '🐭', feeling: 'Stolz', face: 'proud', bright: true, Scene: HochturmScene, ms: 3500,
    start: { feel: 'content', arms: 'work' },
    event: c => [...Array.from({ length: 6 }, (_, i) => [520 + i * 380, () => c.sfx('pop')]), [2550, () => c.sfx('sparkle')], [2700, () => { c.F({ feel: 'proud', arms: undefined }); c.sfx('tada') }]],
    good: ['clap'], odd: ['blanket', 'light'], glad: () => ({ feel: 'proud', strength: 2 }) },

  { id: 'spaet', tier: 2, kind: 'loewe', sound: '🦁', feeling: 'Müde', face: 'tired', Scene: SpaetScene, ms: 3200,
    start: { feel: 'content' },
    event: c => [[250, () => c.sfx('slideDown')], [1650, () => c.sfx('sparkle')], [2000, () => c.F({ feel: 'tired' })]],
    good: ['blanket'], mean: ['scold', 'laugh'], odd: ['play', 'clap'], quiet: true,
    glad: () => ({ feel: 'asleep', cover: true }) },

  { id: 'saft', tier: 3, kind: 'hund', sound: '🐶', feeling: 'Verlegen', face: 'shy', bg: 'room', Scene: SaftScene, ms: 3000,
    notWith: ['Ängstlich', 'Überrascht'],
    start: { feel: 'content', arms: 'holdR' },
    event: c => [[700, () => c.sfx('bump')], [1150, () => { c.sfx('splash'); c.F({ feel: 'surprised', arms: undefined }) }], [2000, () => c.F({ feel: 'shy' })]],
    good: ['wipe'], odd: ['clap', 'cheer'], glad: happy },

  { id: 'regen', tier: 3, kind: 'baer', sound: '🐻', feeling: 'Gelangweilt', face: 'bored', bg: 'room', Scene: RegenScene, ms: 3100,
    notWith: ['Wütend'],
    start: { feel: 'content' },
    event: c => [[400, () => c.sfx('whoosh')], [1100, () => c.F({ feel: 'neutral' })], [2100, () => c.F({ feel: 'bored' })]],
    good: ['play'], odd: ['blanket', 'light'], glad: happy },

  { id: 'geburtstag', tier: 3, kind: 'hase', feeling: 'Aufgeregt', face: 'excited', bright: true, bg: 'room', Scene: GeburtstagScene, ms: 3000,
    notWith: ['Neugierig'],
    start: { feel: 'content' },
    event: c => [[300, () => c.sfx('slideUp')], [900, () => { c.F({ feel: 'surprised' }); c.sfx('tada') }], [1800, () => { c.F({ feel: 'excited' }); c.sfx('sparkle') }]],
    good: ['cheer'], odd: ['blanket', 'light'], glad: () => ({ feel: 'excited', strength: 2 }) },

  { id: 'busch', tier: 3, kind: 'fuchs', feeling: 'Neugierig', face: 'curious', bright: true, Scene: BuschScene, ms: 2900,
    notWith: ['Ängstlich', 'Aufgeregt'],
    start: { feel: 'content' },
    event: c => [[450, () => c.sfx('whoosh')], [700, () => c.F({ feel: 'surprised' })], [1400, () => c.sfx('whoosh')], [1800, () => c.F({ feel: 'curious' })]],
    good: ['look'], odd: ['clap', 'blanket'], fixSound: '🦔', glad: happy },
].map(k => ({ mean: MEAN, notWith: [], ...k }))
