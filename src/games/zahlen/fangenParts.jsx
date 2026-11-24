import { useEffect, useMemo } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Critter, Art, useMood, artSrc } from '../../components/play/index.js'
import { Pips } from './stage.jsx'
import { FRUITS, slotOf } from './fangen.js'

/**
 * The drawn pieces of "Bruno fängt" (NumberIntroGame.jsx): the basket you
 * can look into, the tree's crown, the sign, the "Mampf" mouth, the old
 * boot, the picnic blanket and the board that lays a basket against the
 * sign's dots.
 */

const INK = '#2a1b3d'
const WOOD = '#8a4f22'
const BARK = '#5a2e0e'       // outlines of the wooden things, like the pictures' own
const PARCH = '#fffdf7'

/** Height of the basket and where its floor is (things stand on it), in its own px. */
export const BASKET_H = 100
export const BASKET_FLOOR = 66

/**
 * A fruit. A golden one keeps its own colour (an apple stays an apple) and
 * shines: a glow behind it, rays that turn, glitter.
 */
export function Fruit({ fruit, size, gold = false, style }) {
  const reduce = useReducedMotion()
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, ...style }}>
      {gold && (
        <motion.svg viewBox="-50 -50 100 100" aria-hidden="true" width={size * 1.7} height={size * 1.7}
          animate={reduce ? {} : { rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', left: -size * 0.35, top: -size * 0.35, pointerEvents: 'none' }}>
          <circle r="34" fill="#ffe680" opacity="0.75" />
          <circle r="27" fill="#fff3b0" opacity="0.9" />
          {Array.from({ length: 8 }, (_, i) => <path key={i} d="M-5 -30 L0 -48 L5 -30 Z" fill="#ffd23c" stroke="#e8a61c" strokeWidth="1.5" strokeLinejoin="round" transform={`rotate(${i * 45})`} />)}
        </motion.svg>
      )}
      <Art art={FRUITS[fruit].art} size={size} style={{ position: 'relative' }} />
      {gold && [[0.02, 0.06, 0], [0.74, 0, 0.5], [0.68, 0.7, 0.9]].map(([x, y, d], i) => (
        <motion.svg key={i} viewBox="0 0 20 20" width={size * 0.32} height={size * 0.32} aria-hidden="true"
          animate={reduce ? {} : { scale: [0.3, 1, 0.3], rotate: [0, 90, 180] }} transition={{ duration: 1.1, repeat: Infinity, delay: d }}
          style={{ position: 'absolute', left: size * x, top: size * y, pointerEvents: 'none' }}>
          <path d="M10 0 L12.5 7.5 L20 10 L12.5 12.5 L10 20 L7.5 12.5 L0 10 L7.5 7.5 Z" fill="#fffbe0" stroke={INK} strokeWidth="1.2" strokeLinejoin="round" />
        </motion.svg>
      ))}
    </span>
  )
}

/** The old boot: nothing to eat, and it smells. */
export function Boot({ size = 56 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d="M19 8 Q28 4 40 8 L41 30 Q42 35 48 36 L56 38 Q62 40 62 47 V52 H15 Z" fill="#a47a52" stroke="#4a2a12" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M19 8 Q29 13 40 8" fill="none" stroke="#4a2a12" strokeWidth="3" />
      <path d="M48 37 Q52 44 62 46" fill="none" stroke="#4a2a12" strokeWidth="2.5" />
      <path d="M13 51 H63 V56 Q63 60 59 60 H17 Q13 60 13 56 Z" fill="#5b4332" stroke="#4a2a12" strokeWidth="3" strokeLinejoin="round" />
      <path d="M13 55 H24 V60 H17 Q13 60 13 56 Z" fill="#3b2a1e" />
      <rect x="21" y="20" width="12" height="11" rx="2" fill="#d8b77e" stroke="#4a2a12" strokeWidth="2" transform="rotate(-8 27 25)" />
      <path d="M23 22 l8 6 M31 21 l-8 8" stroke="#4a2a12" strokeWidth="1.5" />
      <path d="M40 16 h-7 M41 23 h-6 M42 30 h-5" stroke="#f3e2c0" strokeWidth="2.6" strokeLinecap="round" />
      {/* the smell */}
      <path d="M6 30 q-5 -5 0 -10 q5 -5 0 -10" fill="none" stroke="#6f9a2c" strokeWidth="3" strokeLinecap="round" />
      <path d="M52 26 q-4 -4 0 -8 q4 -4 0 -8" fill="none" stroke="#6f9a2c" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

/**
 * The basket, seen a little from above so everything in it can be counted:
 * the inside, then what lies in it (`children`, placed from the middle of
 * the top edge), then the woven front. With `split` it has two halves.
 */
export function Basket({ width, split = false, children }) {
  const W = width
  const ribs = Math.round((W - 40) / 24)
  return (
    <div style={{ position: 'relative', width: W, height: BASKET_H }}>
      <svg viewBox={`0 0 ${W} ${BASKET_H}`} width={W} height={BASKET_H} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <ellipse cx={W / 2} cy={BASKET_H - 1} rx={W * 0.46} ry={7} fill="rgba(42,27,61,0.2)" />
        <path d={`M8 24 Q8 6 26 6 H${W - 26} Q${W - 8} 6 ${W - 8} 24 V${BASKET_FLOOR + 10} H8 Z`} fill="#c98d4b" stroke={BARK} strokeWidth="4" strokeLinejoin="round" />
        {/* a cloth inside, so fruit of every colour shows */}
        <path d={`M15 26 Q15 13 27 13 H${W - 27} Q${W - 15} 13 ${W - 15} 26 V${BASKET_FLOOR + 8} H15 Z`} fill="#fff6e0" stroke="#e0c690" strokeWidth="2" />
        <path d={`M16 26 Q16 14 27 14 H${W - 27} Q${W - 16} 14 ${W - 16} 26 V31 H16 Z`} fill="rgba(138,79,34,0.16)" />
        {split && <rect x={W / 2 - 5} y={6} width={10} height={BASKET_FLOOR + 4} fill="#c98d4b" stroke={BARK} strokeWidth="3" />}
      </svg>
      <div style={{ position: 'absolute', left: W / 2, top: 0, width: 0, height: 0 }}>{children}</div>
      <svg viewBox={`0 0 ${W} ${BASKET_H}`} width={W} height={BASKET_H} aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}>
        <path d={`M5 ${BASKET_FLOOR} H${W - 5} L${W - 15} 94 Q${W - 17} 98 ${W - 23} 98 H23 Q17 98 15 94 Z`} fill="#d9a05b" stroke={BARK} strokeWidth="4" strokeLinejoin="round" />
        <path d={`M11 80 H${W - 11} M14 89 H${W - 14}`} stroke="#a86a2c" strokeWidth="3" strokeLinecap="round" />
        {Array.from({ length: ribs }, (_, i) => {
          const x = 20 + ((W - 40) / (ribs - 1 || 1)) * i
          return <path key={i} d={`M${x} 72 V96`} stroke="#a86a2c" strokeWidth="3" strokeLinecap="round" />
        })}
        <rect x={2} y={BASKET_FLOOR - 6} width={W - 4} height={13} rx={6.5} fill="#eebf7a" stroke={BARK} strokeWidth="3.5" />
      </svg>
    </div>
  )
}

/** An empty hollow in the basket: one thing goes here. */
export function Nest({ size }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" style={{ display: 'block' }}>
      <circle cx="20" cy="20" r="16" fill="rgba(138,79,34,0.14)" stroke="#a8763a" strokeWidth="2.6" strokeDasharray="5 4.5" />
    </svg>
  )
}

// A little random, but the same on every render
function seeded(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

/**
 * The crown of the tree across the top of the field, with a few fruit of
 * the round still hanging in it. The trunk stands behind everything.
 */
export function Crown({ width, height, fruits }) {
  const blobs = useMemo(() => {
    const rnd = seeded(7), n = Math.max(5, Math.round(width / 62))
    return Array.from({ length: n + 1 }, (_, i) => ({ x: (width / n) * i + (rnd() - 0.5) * 16, y: height * (0.42 + rnd() * 0.14), r: height * (0.5 + rnd() * 0.16) }))
  }, [width, height])
  const hung = useMemo(() => {
    const rnd = seeded(23), n = Math.max(3, Math.round(width / 150))
    return Array.from({ length: n }, (_, i) => ({ x: (width / n) * (i + 0.5) + (rnd() - 0.5) * 50, y: height * (0.2 + rnd() * 0.22), rot: (rnd() - 0.5) * 40 }))
  }, [width, height])
  const size = height * 0.38
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none' }}>
      <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <rect x={-20} y={-40} width={width + 40} height={height * 0.5 + 40} fill="#2f7d3a" />
        {blobs.map((b, i) => <circle key={`o${i}`} cx={b.x} cy={b.y} r={b.r + 4} fill="#1f5c2c" />)}
        <rect x={-20} y={-40} width={width + 40} height={height * 0.45 + 40} fill="#4caf50" />
        {blobs.map((b, i) => <circle key={`f${i}`} cx={b.x} cy={b.y} r={b.r} fill="#4caf50" />)}
        {blobs.map((b, i) => <circle key={`l${i}`} cx={b.x - b.r * 0.25} cy={b.y - b.r * 0.3} r={b.r * 0.45} fill="#6cc763" opacity="0.8" />)}
      </svg>
      {hung.map((h, i) => (
        <span key={i} style={{ position: 'absolute', left: h.x - size / 2, top: h.y, transform: `rotate(${h.rot}deg)`, display: 'flex' }}>
          <Art art={FRUITS[fruits[i % fruits.length]].art} size={size} />
        </span>
      ))}
    </div>
  )
}

export function Trunk({ x, top, bottom, width = 46 }) {
  const h = bottom - top
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width + 30} ${h}`} width={width + 30} height={h}
      style={{ position: 'absolute', left: x - (width + 30) / 2, top, pointerEvents: 'none', overflow: 'visible' }}>
      <path d={`M10 0 H${width + 20} L${width + 14} ${h * 0.75} Q${width + 16} ${h - 6} ${width + 30} ${h} H0 Q14 ${h - 6} 16 ${h * 0.75} Z`} fill="#b37a45" stroke="#7a4a1e" strokeWidth="3.5" strokeLinejoin="round" />
      <path d={`M${width * 0.5} ${h * 0.2} v${h * 0.16} M${width * 0.9} ${h * 0.45} v${h * 0.14} M${width * 0.55} ${h * 0.68} v${h * 0.12}`} stroke="#7a4a1e" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

const numeral = (size, color) => ({
  fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size, lineHeight: 1, color,
  textShadow: `-${size * 0.04}px -${size * 0.04}px 0 ${INK}, ${size * 0.04}px -${size * 0.04}px 0 ${INK}, -${size * 0.04}px ${size * 0.04}px 0 ${INK}, ${size * 0.04}px ${size * 0.04}px 0 ${INK}, 0 -${size * 0.04}px 0 ${INK}, 0 ${size * 0.04}px 0 ${INK}, -${size * 0.04}px 0 0 ${INK}, ${size * 0.04}px 0 0 ${INK}, 0 ${size * 0.08}px 0 rgba(42,27,61,0.3)`,
})

const board = {
  background: PARCH, border: `5px solid ${WOOD}`, borderRadius: 18,
  boxShadow: `0 0 0 3px ${INK}, 0 7px 0 3px rgba(42,27,61,0.3)`, boxSizing: 'border-box',
}

/**
 * The sign: how many of what. The numeral, the fruit and the amount as
 * dots (dice up to six, a ten frame from seven). Two amounts stand side by
 * side (`row`) or one above the other. It hangs on two ropes from above;
 * `bump` makes it swing (a new task, or "look here" after a miss).
 */
export function Sign({ wants, row, bump = 0, onTap }) {
  const two = wants.length > 1
  const one = (w, k) => {
    // on a narrow sign the amounts stand apart: numeral and fruit, the dots below
    const stack = two ? row : !row
    const num = two ? 62 : row ? 84 : w.n >= 10 ? 86 : 104
    const pic = two ? 42 : row ? 54 : w.n >= 10 ? 54 : 62
    const pip = two ? 42 : row ? 62 : 70
    return (
      <div key={k} data-want={w.fruit} style={{ display: 'flex', flexDirection: stack ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: stack ? 4 : 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={numeral(num, w.color)}>{w.n}</span>
          <Art art={FRUITS[w.fruit].art} size={pic} />
        </div>
        <Pips n={w.n} size={pip} color={w.color} />
      </div>
    )
  }
  const label = wants.map(w => `${w.n} ${w.n === 1 ? FRUITS[w.fruit].name : FRUITS[w.fruit].many}`).join(' und ')
  return (
    <motion.div role="button" tabIndex={0} aria-label={`Schild: ${label}`} data-need={wants.map(w => w.n).join(',')} data-nosteer="1"
      onClick={onTap} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTap?.() } }}
      key={bump} initial={{ rotate: -7 }} animate={{ rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 7 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, transformOrigin: '50% 0%', cursor: 'pointer', outlineOffset: 4 }}>
      <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'space-around', alignSelf: 'stretch', height: row ? 12 : 16, marginBottom: -3 }}>
        {[0, 1].map(i => <span key={i} style={{ width: 6, background: '#c9a36b', borderLeft: `2px solid ${INK}`, borderRight: `2px solid ${INK}`, boxSizing: 'content-box' }} />)}
      </div>
      <div style={{
        ...board, display: 'flex', flexDirection: two ? (row ? 'row' : 'column') : 'row', alignItems: 'center', justifyContent: 'center',
        gap: two ? (row ? 14 : 8) : 0, padding: row ? '6px 14px 8px' : '8px 12px 12px', minWidth: row ? 0 : 150,
      }}>
        {wants.map(one).flatMap((el, k) => (k === 0 ? [el] : [
          <span key={`d${k}`} aria-hidden="true" style={row ? { width: 3, alignSelf: 'stretch', background: 'rgba(138,79,34,0.35)', borderRadius: 2 } : { height: 3, alignSelf: 'stretch', background: 'rgba(138,79,34,0.35)', borderRadius: 2 }} />, el,
        ]))}
      </div>
    </motion.div>
  )
}

/**
 * "Mampf": a face with its mouth wide open, the fruit on its way in.
 * Pressing it means: that is enough, eat. Faded while the basket is empty.
 */
export function MampfButton({ size = 110, fruit, disabled, onPress, hint = false, innerRef }) {
  const reduce = useReducedMotion()
  const live = !disabled && !reduce
  return (
    <motion.button ref={innerRef} type="button" aria-label="Mampf" aria-disabled={!!disabled} data-nosteer="1"
      onClick={disabled ? undefined : onPress}
      animate={{ scale: disabled ? 0.88 : hint && !reduce ? [1, 1.12, 1] : 1 }}
      transition={hint && !disabled ? { scale: { duration: 0.8, repeat: Infinity } } : { type: 'spring', stiffness: 400, damping: 14 }}
      whileTap={disabled ? undefined : { scale: 0.86 }}
      style={{
        all: 'unset', boxSizing: 'border-box', width: size, height: size, flexShrink: 0, cursor: disabled ? 'default' : 'pointer', display: 'block',
        borderRadius: '50%', WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation',
      }}>
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
        <circle cx="50" cy="55" r="45" fill="rgba(42,27,61,0.35)" />
        <circle cx="50" cy="50" r="45" fill={disabled ? '#ece3cc' : '#ffcf4a'} stroke={INK} strokeWidth="4" style={{ transition: 'fill .25s' }} />
        <path d="M14 42 A38 38 0 0 1 60 10" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="5" strokeLinecap="round" />
        <circle cx="31" cy="34" r="6" fill={INK} /><circle cx="69" cy="34" r="6" fill={INK} />
        <circle cx="33" cy="32" r="2" fill="#fff" /><circle cx="71" cy="32" r="2" fill="#fff" />
        {!disabled && <><circle cx="19" cy="50" r="6" fill="#ff8fb8" opacity="0.7" /><circle cx="81" cy="50" r="6" fill="#ff8fb8" opacity="0.7" /></>}
        {disabled
          // nothing in the basket yet: the mouth is shut
          ? <path d="M34 64 Q50 74 66 64" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          : (
            // the mouth opens and shuts while it waits for a press
            <motion.g style={{ transformBox: 'fill-box', transformOrigin: '50% 30%' }}
              animate={live ? { scaleY: [1, 1, 0.55, 1] } : { scaleY: 1 }}
              transition={live ? { duration: 1.5, times: [0, 0.55, 0.75, 1], repeat: Infinity } : { duration: 0.2 }}>
              <path d="M22 50 Q50 44 78 50 Q80 86 50 88 Q20 86 22 50 Z" fill="#7a1f2b" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
              <path d="M34 78 Q50 68 66 78 Q60 87 50 87 Q40 87 34 78 Z" fill="#ff7d8f" />
              <path d="M33 49 H67 V56 Q67 59 64 59 H36 Q33 59 33 56 Z" fill="#fff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            </motion.g>
          )}
        {fruit && !disabled && (
          <motion.g style={{ transformBox: 'fill-box', transformOrigin: '50% 50%' }}
            animate={live ? { y: [-34, 0, 4, 4], scale: [1, 1, 0.2, 0.2], opacity: [1, 1, 0, 0] } : { y: 0, scale: 1, opacity: 1 }}
            transition={live ? { duration: 1.5, times: [0, 0.5, 0.75, 1], repeat: Infinity } : { duration: 0.2 }}>
            <image href={artSrc(FRUITS[fruit].art)} x="33" y="50" width="34" height="34" />
          </motion.g>
        )}
      </svg>
    </motion.button>
  )
}

/**
 * The picnic blanket: one place per animal of the level. Everyone who has
 * eaten sits down there, so the blanket fills as the level goes on. A tap
 * on a guest makes it say hello.
 */
export function Picnic({ seats, guests, size, cols, style }) {
  const rows = Math.ceil(seats / cols)
  return (
    <div role="group" aria-label={`Picknick: ${guests.length} von ${seats} Tieren sind satt`} data-picnic={guests.length} style={{
      position: 'relative', padding: 6, borderRadius: 16, boxSizing: 'border-box', flexShrink: 0,
      width: cols * size + 12 + 6, height: rows * size + 12 + 6,
      background: 'repeating-conic-gradient(#ff8a7a 0 25%, #fff3e6 0 50%) 0 0 / 32px 32px',
      border: `3px solid ${INK}`, boxShadow: '0 5px 0 rgba(42,27,61,0.3)',
      display: 'grid', gridTemplateColumns: `repeat(${cols}, ${size}px)`, gridAutoRows: `${size}px`, justifyContent: 'center', alignContent: 'center',
      ...style,
    }}>
      {Array.from({ length: seats }, (_, i) => {
        const g = guests[i]
        return (
          <div key={i} style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div aria-hidden="true" style={{ position: 'absolute', inset: size * 0.1, borderRadius: '50%', background: 'rgba(255,253,247,0.75)', border: '2.5px dashed rgba(42,27,61,0.4)', boxSizing: 'border-box' }} />
            {g && <Guest art={g.art} label={g.label} size={size * 0.92} />}
          </div>
        )
      })}
    </div>
  )
}

function Guest({ art, label, size }) {
  const [mood, setMood] = useMood()
  useEffect(() => { setMood('happy', 1400) }, [setMood])
  return (
    <motion.div data-nosteer="1" initial={{ y: -50, opacity: 0, scale: 1.4 }} animate={{ y: 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 15 }} style={{ position: 'relative', display: 'flex' }}>
      <Critter art={art} size={size} mood={mood} label={`${label}, satt`} onTap={() => setMood('happy', 1200)} shadow={false} />
    </motion.div>
  )
}

/** The size of the board for a basket (see CompareBoard). */
export function boardLayout(wants, counts, cell) {
  const cols = wants.length > 1 ? 3 : 5
  const blocks = wants.map((w, k) => {
    const cells = Math.max(w.n, counts[k] ?? 0)
    return { cols: Math.min(cols, Math.max(cells, 1)), rows: Math.ceil(cells / cols), cells }
  })
  const pad = 12, gap = 18
  const rows = Math.max(...blocks.map(b => b.rows))
  const widths = blocks.map(b => Math.max(b.cols * cell, cell * 2))
  const width = widths.reduce((a, b) => a + b, 0) + gap * (blocks.length - 1) + pad * 2 + 10
  const height = rows * cell + pad * 2 + 10
  return { cols, blocks, widths, rows, width, height, pad: pad + 5, gap }
}

/**
 * A basket laid against the sign's dots, one thing on each dot. Dots left
 * empty are what is still missing; things without a dot are too many and
 * roll away (`rolled[k]` of them are gone already).
 *   from  where the things come flying from, relative to the board's corner
 */
export function CompareBoard({ wants, counts, cell, from, rolled, show }) {
  const reduce = useReducedMotion()
  const L = boardLayout(wants, counts, cell)
  let left = L.pad
  return (
    <motion.div aria-hidden="true" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.7, opacity: 0, transition: { duration: 0.18 } }}
      transition={{ type: 'spring', stiffness: 420, damping: 24 }}
      style={{ ...board, position: 'relative', width: L.width, height: L.height }}>
      {wants.map((w, k) => {
        const b = L.blocks[k], x0 = left + L.widths[k] / 2
        left += L.widths[k] + L.gap
        const have = counts[k] ?? 0
        return (
          <div key={k}>
            {k > 0 && <span style={{ position: 'absolute', left: x0 - L.widths[k] / 2 - L.gap / 2 - 1.5, top: 10, bottom: 10, width: 3, borderRadius: 2, background: 'rgba(138,79,34,0.35)' }} />}
            {Array.from({ length: b.cells }, (_, i) => {
              const s = slotOf(i, L.cols)
              // rows from the top here, like the dots on the sign
              const cx = x0 + (s.x + (L.cols - b.cols) / 2) * cell, cy = L.pad + s.row * cell + cell / 2
              const dot = i < w.n, thing = i < have
              const gone = i >= w.n && i >= have - (rolled[k] ?? 0)
              const missing = dot && !thing
              return (
                <div key={i} style={{ position: 'absolute', left: cx - cell / 2, top: cy - cell / 2, width: cell, height: cell, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {dot && (
                    <motion.span
                      animate={missing && show && !reduce ? { scale: [1, 1.18, 1] } : { scale: 1 }}
                      transition={missing && show ? { duration: 0.7, repeat: Infinity } : { duration: 0.2 }}
                      style={{
                        position: 'absolute', inset: cell * 0.07, borderRadius: '50%', boxSizing: 'border-box',
                        background: missing && show ? PARCH : w.color, border: `3px ${missing && show ? 'dashed' : 'solid'} ${INK}`,
                      }} />
                  )}
                  {missing && show && <span style={{ position: 'relative', opacity: 0.28, filter: 'grayscale(1)', display: 'flex' }}><Art art={FRUITS[w.fruit].art} size={cell * 0.6} /></span>}
                  <AnimatePresence>
                    {thing && !gone && (
                      <motion.span key="t"
                        initial={reduce ? { opacity: 0 } : { x: from.x - cx, y: from.y - cy, scale: 0.8 }}
                        animate={!dot && show && !reduce ? { x: 0, y: 0, scale: 1, opacity: 1, rotate: [0, -14, 14, -10, 0] } : { x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
                        exit={reduce ? { opacity: 0 } : { x: cell * 3.2, y: cell * 2.6, rotate: 300, opacity: 0, transition: { duration: 0.5, ease: 'easeIn' } }}
                        transition={!dot && show
                          ? { rotate: { duration: 0.6, repeat: Infinity, repeatDelay: 0.2 }, default: { duration: 0.2 } }
                          : { type: 'spring', stiffness: 260, damping: 22, delay: i * 0.08 }}
                        style={{ position: 'relative', display: 'flex', zIndex: 2 }}>
                        <Art art={FRUITS[w.fruit].art} size={cell * 0.8} />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </div>
        )
      })}
    </motion.div>
  )
}
