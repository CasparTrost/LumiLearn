// Wippe-Katapult: the pictures — tree with its ruler, seesaw, parachute,
// prop, parcels, blocks, stair, stumps, the crate and the branch where the
// fed animals sit. Drawn in the app's look: ink outlines, warm wood.
import { useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Art, Critter } from '../../components/play/index.js'
import { TOP } from './levels.js'
import { A, THICK } from './geometry.js'

export const INK = '#2a1b3d'
export const PARCH = '#fffdf7'
const WOOD = '#c98a52', WOOD_D = '#8a4f22', WOOD_L = '#e3a462'
const BARK = '#b37a45', BARK_D = '#7a4a1e'

export const numeral = (size, color = INK) => ({
  fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size, lineHeight: 1, color,
})

/**
 * The tree on the left: a trunk with a step at every unit of height (the
 * ruler), a crown at the top that stays out of the flyer's way, and the
 * branch with the treat. In levels 7–8 the steps carry their numbers.
 */
export function Tree({ g, numbers, target }) {
  const { x0, x1 } = g.trunk
  const top = g.yAt(TOP) - 60
  const bottom = g.ground + 4
  const steps = Array.from({ length: TOP }, (_, i) => i + 1)
  const blobs = useMemo(() => {
    const cx = (x0 + x1) / 2
    return [[cx - 34, top + 6, 46], [cx + 16, top - 18, 44], [cx + 40, top + 26, 34], [cx - 10, top + 36, 40], [cx - 52, top + 44, 30]]
  }, [x0, x1, top])
  return (
    <svg aria-hidden="true" width={g.W} height={g.H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      {/* roots and trunk */}
      <path d={`M${x0 - 16} ${bottom} Q${x0 - 2} ${bottom - 10} ${x0 + 2} ${bottom - 40} L${x0 + 4} ${top + 30} L${x1 - 4} ${top + 30} L${x1 - 2} ${bottom - 40} Q${x1 + 2} ${bottom - 10} ${x1 + 16} ${bottom} Z`}
        fill={BARK} stroke={BARK_D} strokeWidth="3.5" strokeLinejoin="round" />
      <path d={`M${x0 + 14} ${top + 70} v26 M${x1 - 14} ${(top + bottom) / 2} v22 M${x0 + 18} ${bottom - 70} v18`} stroke={BARK_D} strokeWidth="3" strokeLinecap="round" opacity="0.55" />
      {/* the crown */}
      {blobs.map(([x, y, r], i) => <circle key={`o${i}`} cx={x} cy={y} r={r + 4} fill="#1f5c2c" />)}
      {blobs.map(([x, y, r], i) => <circle key={`f${i}`} cx={x} cy={y} r={r} fill="#4caf50" />)}
      {blobs.map(([x, y, r], i) => <circle key={`l${i}`} cx={x - r * 0.25} cy={y - r * 0.3} r={r * 0.42} fill="#6cc763" opacity="0.85" />)}
      {/* the ruler: a notch for every step, on the side the flyer flies */}
      {steps.map(s => {
        const y = g.yAt(s)
        const big = numbers || s % 5 === 0
        return <line key={s} x1={x1 - (big ? 16 : 10)} x2={x1 + 1} y1={y} y2={y} stroke={BARK_D} strokeWidth={big ? 4 : 3} strokeLinecap="round" />
      })}
      {numbers && steps.map(s => {
        const hot = s === target, cx = (x0 + x1) / 2 - 4, cy = g.yAt(s)
        return (
          <g key={`n${s}`}>
            {hot && <circle cx={cx} cy={cy} r={17} fill="#ffc93c" stroke={INK} strokeWidth="3.5" />}
            <text x={cx} y={cy + (hot ? 8 : 7)} textAnchor="middle"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: hot ? 23 : 19 }}
              fill={hot ? INK : PARCH} stroke={hot ? 'none' : INK} strokeWidth="4" paintOrder="stroke">{s}</text>
          </g>
        )
      })}
    </svg>
  )
}

/** The branch the treat hangs from, at a height in steps. */
export function TreatBranch({ g, step }) {
  const y = g.yAt(step) - g.treat / 2 - 6
  const x1 = g.trunk.x1 - 4, x2 = g.treatX + 10
  return (
    <svg aria-hidden="true" width={g.W} height={g.H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={`M${x1} ${y + 8} Q${(x1 + x2) / 2} ${y - 2} ${x2} ${y}`} fill="none" stroke={BARK_D} strokeWidth="11" strokeLinecap="round" />
      <path d={`M${x1} ${y + 8} Q${(x1 + x2) / 2} ${y - 2} ${x2} ${y}`} fill="none" stroke={BARK} strokeWidth="6" strokeLinecap="round" />
      <ellipse cx={x2 - 4} cy={y - 9} rx="11" ry="6" fill="#4caf50" stroke="#1f5c2c" strokeWidth="2.5" transform={`rotate(-25 ${x2 - 4} ${y - 9})`} />
      <line x1={g.treatX} y1={y} x2={g.treatX} y2={y + 10} stroke={INK} strokeWidth="2.5" />
    </svg>
  )
}

/** The stand under the pivot. */
export function Stand({ g }) {
  const w = 40
  return (
    <svg aria-hidden="true" width={g.W} height={g.H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
      <ellipse cx={g.px} cy={g.ground + 2} rx={g.L * 0.9} ry={9} fill="rgba(42,27,61,0.14)" />
      <path d={`M${g.px - w} ${g.ground} L${g.px} ${g.py} L${g.px + w} ${g.ground} Z`} fill="#ff6b5b" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <circle cx={g.px} cy={g.py + 2} r="8" fill="#ffc93c" stroke={INK} strokeWidth="3.5" />
    </svg>
  )
}

/** The plank, turned by the motion value `ang` about the pivot. */
export function Plank({ g, ang, seat = true }) {
  return (
    <motion.div aria-hidden="true" style={{
      position: 'absolute', left: g.px - g.L, top: g.py - THICK / 2, width: g.L * 2, height: THICK,
      rotate: ang, transformOrigin: '50% 50%', borderRadius: 9, border: `4px solid ${INK}`, boxSizing: 'border-box',
      background: `repeating-linear-gradient(90deg, ${WOOD_L} 0 34px, ${WOOD} 34px 38px)`, boxShadow: '0 5px 0 rgba(42,27,61,0.28)', zIndex: 3,
    }}>
      {/* a little seat on the flyer's end, a landing pad on the other */}
      {/* the landing plate on the raised end: where things go */}
      {seat && <div style={{ position: 'absolute', left: g.L + g.load - 30, top: -9, width: 60, height: 9, borderRadius: '8px 8px 0 0', background: '#ffc93c', border: `3px solid ${INK}`, borderBottom: 'none', boxSizing: 'border-box' }} />}
      {seat && <div style={{ position: 'absolute', left: g.L + g.seat - 26, top: -10, width: 52, height: 10, borderRadius: '8px 8px 0 0', background: '#ff6b5b', border: `3px solid ${INK}`, borderBottom: 'none', boxSizing: 'border-box' }} />}
    </motion.div>
  )
}

/** A wooden prop, standing (rotate 0) or knocked over (±90), turning about its foot. */
export function Prop({ x, foot, height, rot }) {
  return (
    <motion.div aria-hidden="true" style={{
      position: 'absolute', left: x - 9, top: foot - height, width: 18, height, rotate: rot, transformOrigin: '50% 100%', zIndex: 2,
      background: `linear-gradient(90deg, ${WOOD} 0 60%, ${WOOD_D} 60%)`, border: `3px solid ${INK}`, borderRadius: 6, boxSizing: 'border-box',
    }} />
  )
}

/** A parachute over the flyer: a striped canopy and four lines. */
export function Parachute({ size }) {
  const w = size * 1.5, h = size * 1.05
  return (
    <svg aria-hidden="true" viewBox="0 0 150 105" width={w} height={h} style={{ display: 'block', overflow: 'visible' }}>
      {[[22, 40], [52, 44], [98, 44], [128, 40]].map(([x, y], i) => (
        <line key={i} x1={x} y1={y} x2={75 + (i - 1.5) * 9} y2={104} stroke={INK} strokeWidth="2.5" />
      ))}
      <path d="M8 44 Q8 2 75 2 Q142 2 142 44 Q124 34 108 44 Q92 34 75 44 Q58 34 42 44 Q26 34 8 44 Z" fill="#ff6b5b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M42 44 Q48 10 75 2 Q102 10 108 44 Q92 34 75 44 Q58 34 42 44 Z" fill={PARCH} />
      <path d="M75 2 Q70 22 75 44" fill="none" stroke={INK} strokeWidth="2" opacity="0.5" />
      <path d="M8 44 Q8 2 75 2 Q142 2 142 44" fill="none" stroke={INK} strokeWidth="4" />
    </svg>
  )
}

/** A parcel with its number. */
export function Parcel({ n, size, glow }) {
  const tag = size * 0.5
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {glow && <Glow size={size} />}
      <Art art="📦" size={size} />
      <span style={{
        position: 'absolute', left: '50%', top: '56%', transform: 'translate(-50%, -50%)', width: tag, height: tag, borderRadius: '50%',
        background: PARCH, border: `3px solid ${INK}`, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...numeral(tag * 0.72),
      }}>{n}</span>
    </div>
  )
}

/** A soft golden glow behind a thing: the game's help after two misses. */
export function Glow() {
  const reduce = useReducedMotion()
  return (
    <motion.span aria-hidden="true" animate={reduce ? { opacity: 0.85 } : { opacity: [0.5, 1, 0.5], scale: [0.95, 1.1, 0.95] }}
      transition={{ duration: 1.1, repeat: reduce ? 0 : Infinity }}
      style={{ position: 'absolute', inset: '-18%', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,90,0.95) 0%, rgba(255,214,90,0.4) 50%, transparent 72%)', pointerEvents: 'none' }} />
  )
}

/** A one-kilo block: a little wooden cube with a 1 on it. */
export function Block({ size, ghost }) {
  return (
    <div style={{
      width: size, height: size, boxSizing: 'border-box', borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: ghost ? 'rgba(255,253,247,0.45)' : `linear-gradient(160deg, #ffd27a, ${WOOD_L} 60%, ${WOOD})`,
      border: ghost ? `3px dashed ${INK}` : `3px solid ${INK}`, boxShadow: ghost ? 'none' : 'inset 0 -4px 0 rgba(42,27,61,0.18)',
      ...numeral(size * 0.62, ghost ? 'rgba(42,27,61,0.45)' : INK),
    }}>1</div>
  )
}

/** The crate the blocks come from (level 10): a tap takes one out. */
export function Crate({ size }) {
  const b = size * 0.3
  return (
    <div style={{ position: 'relative', width: size, height: size * 0.86 }}>
      <div style={{ position: 'absolute', left: size * 0.1, top: 0, display: 'flex', gap: 2 }}>
        {[0, 1, 2].map(i => <div key={i} style={{ marginTop: i === 1 ? -b * 0.35 : 0 }}><Block size={b} /></div>)}
      </div>
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: size * 0.56, boxSizing: 'border-box', borderRadius: 8,
        background: `repeating-linear-gradient(0deg, ${WOOD} 0 ${size * 0.17}px, ${WOOD_D} ${size * 0.17}px ${size * 0.19}px)`,
        border: `4px solid ${INK}`, boxShadow: '0 5px 0 rgba(42,27,61,0.3)',
      }} />
    </div>
  )
}

/** The stair of level 9: three wooden steps, low to high. */
export function Stair({ steps, bottom }) {
  return (
    <>
      {steps.map((s, i) => (
        <div key={i} aria-hidden="true" style={{
          position: 'absolute', left: s.x - s.w / 2, top: s.top, width: s.w, height: bottom - s.top, boxSizing: 'border-box',
          background: `linear-gradient(180deg, ${WOOD_L} 0 10px, ${WOOD} 10px)`, border: `4px solid ${INK}`, borderRadius: '8px 8px 0 0',
          marginLeft: i ? -2 : 0, boxShadow: 'inset 0 -6px 0 rgba(42,27,61,0.15)',
        }}>
          {/* little dots like on a die: one, two, three — the steps' order, not a number to read */}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, display: 'flex', justifyContent: 'center', gap: 4 }}>
            {Array.from({ length: i + 1 }, (_, k) => <span key={k} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(42,27,61,0.45)' }} />)}
          </div>
        </div>
      ))}
    </>
  )
}

/** A tree stump (level 10): the bridge's two ends. */
export function Stump({ x, top, bottom, w }) {
  const h = bottom - top
  return (
    <svg aria-hidden="true" width={w + 24} height={h + 8} style={{ position: 'absolute', left: x - w / 2 - 12, top: top - 4, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={`M2 ${h + 8} Q10 ${h} 12 ${h - 16} L14 8 L${w + 10} 8 L${w + 12} ${h - 16} Q${w + 14} ${h} ${w + 22} ${h + 8} Z`} fill={BARK} stroke={BARK_D} strokeWidth="3.5" strokeLinejoin="round" />
      <ellipse cx={w / 2 + 12} cy={8} rx={w / 2 - 1} ry={7} fill="#e8c088" stroke={BARK_D} strokeWidth="3" />
      <ellipse cx={w / 2 + 12} cy={8} rx={w / 4} ry={3} fill="none" stroke={BARK_D} strokeWidth="2" opacity="0.6" />
    </svg>
  )
}

// The crown the seat branch grows out of, round its right end: [x, y, r]
// from the branch's end, scaled by the branch's `crown`
const CROWN = [[-4, -52, 54], [-48, -78, 34], [-40, -20, 30], [10, 4, 42], [-14, 30, 26]]

/** The branch at the top where every animal that got its treat sits. */
export function Branch({ g, guests, seats }) {
  const { x0, x1, y, seat, crown = 1 } = g.branch
  const w = x1 - x0
  const blobs = CROWN.map(([dx, dy, r]) => [w + dx * crown, seat + 9 + dy * crown, r * crown])
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: x0, top: y - seat - 4, width: w, height: seat + 22, zIndex: 2, pointerEvents: 'none' }}>
      <svg width={w} height={22} style={{ position: 'absolute', left: 0, top: seat - 2, overflow: 'visible' }}>
        <path d={`M4 12 Q${w / 2} 2 ${w + 8} 9`} fill="none" stroke={BARK_D} strokeWidth="13" strokeLinecap="round" />
        <path d={`M4 12 Q${w / 2} 2 ${w + 8} 9`} fill="none" stroke={BARK} strokeWidth="8" strokeLinecap="round" />
        <ellipse cx={18} cy={4} rx={10} ry={5} fill="#4caf50" stroke="#1f5c2c" strokeWidth="2.5" transform="rotate(-20 18 4)" />
      </svg>
      {/* the leaves of its tree, just off the right edge of the picture */}
      <svg width={w} height={seat + 22} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {blobs.map(([x, cy, r], i) => <circle key={`o${i}`} cx={x} cy={cy} r={r + 4} fill="#1f5c2c" />)}
        {blobs.map(([x, cy, r], i) => <circle key={`f${i}`} cx={x} cy={cy} r={r} fill="#4caf50" />)}
        {blobs.map(([x, cy, r], i) => <circle key={`l${i}`} cx={x - r * 0.25} cy={cy - r * 0.3} r={r * 0.42} fill="#6cc763" opacity="0.85" />)}
      </svg>
      {Array.from({ length: seats }, (_, i) => {
        const who = guests[i]
        return (
          <div key={i} style={{ position: 'absolute', left: 10 + i * seat, top: 0, width: seat, height: seat, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {who
              ? <motion.div initial={{ scale: 0.4, y: -20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}>
                  <Critter art={who.art} size={seat - 2} shadow={false} mood="happy" />
                </motion.div>
              : <span style={{ width: seat * 0.34, height: seat * 0.34, borderRadius: '50%', marginBottom: 3, background: 'rgba(255,253,247,0.55)', border: '2.5px solid rgba(42,27,61,0.28)', boxSizing: 'border-box' }} />}
          </div>
        )
      })}
    </div>
  )
}

/** A mark at the height a throw reached: the thing's picture, or the number. */
export function Mark({ g, step, art, n, blink }) {
  const reduce = useReducedMotion()
  // never taller than a step of the ruler, so two marks next to each other do not overlap
  const s = Math.max(20, Math.min(30, Math.floor(g.unit) - 9))
  return (
    <motion.div aria-hidden="true" data-mark={step} initial={{ scale: 0.2, opacity: 0 }}
      animate={blink && !reduce ? { scale: [1, 1.25, 1], opacity: 1, transition: { duration: 0.5, repeat: 3 } } : { scale: 1, opacity: 1 }}
      style={{
        position: 'absolute', left: g.trunk.x1 + 2, top: g.yAt(step) - s / 2 - 3, height: s + 6, minWidth: s + 14, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 8px 0 4px', boxSizing: 'border-box',
        background: PARCH, border: `3px solid ${INK}`, borderRadius: '6px 16px 16px 6px', boxShadow: '0 3px 0 rgba(42,27,61,0.25)',
      }}>
      {art ? <Art art={art} size={s - 2} /> : <span style={numeral(s * 0.8)}>{n}</span>}
    </motion.div>
  )
}

export { A }
