import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import { INK } from '../px.js'
import { Firefly } from './Cauldron.jsx'

// Buchstabenwald: the clearing in the night forest where Lumi's cauldron
// stands. Trees frame it left and right, their crowns close over it, and a
// branch runs across from tree to tree: the word hangs on it, one letter on
// each leaf. The conjured things stand on the forest floor.

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// a stable pseudo-random number per index, so the crowns do not jump between renders
const rnd = i => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x) }

const LEAF_DARK = '#1d4643', LEAF = '#25594f', LEAF_LIGHT = '#3d7d62', BARK = '#4a3550', BARK_DARK = '#33243f'

/**
 * The forest around the clearing, drawn in the stage's own pixels (no
 * stretching): `w`×`h`, the branch at `branchY`, the forest floor from
 * `floorY` down, the trunks `trunkW` wide at both edges.
 */
export function ForestBack({ w, h, branchY, floorY, trunkW }) {
  const crowns = []
  const step = 58
  for (let i = 0, x = -30; x < w + 40; i++, x += step) {
    const r = 40 + rnd(i) * 26
    crowns.push({ x, y: branchY - r * 0.55 - rnd(i + 50) * 14, r, c: i % 3 === 0 ? LEAF_DARK : LEAF })
  }
  const glows = Array.from({ length: Math.round(w / 90) }, (_, i) => ({ x: 20 + rnd(i + 7) * (w - 40), y: 8 + rnd(i + 90) * Math.max(10, branchY - 20), d: rnd(i + 3) * 2.6 }))
  // the forest floor: a soft mound across the clearing
  const fy = floorY
  const ground = `M0 ${fy + 10} Q${w * 0.25} ${fy - 6} ${w * 0.5} ${fy} Q${w * 0.75} ${fy + 6} ${w} ${fy - 4} L${w} ${h} L0 ${h} Z`
  const trunk = (x0, dir) => {
    const x1 = x0 + dir * trunkW
    return `M${x0} ${floorY + 14} L${x0} ${branchY - 20} L${x1 + dir * 6} ${branchY - 30} Q${x1} ${branchY + 40} ${x1 + dir * 4} ${floorY + 14} Z`
  }
  return (
    <svg aria-hidden="true" width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ position: 'absolute', left: 0, top: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* far trees, dark against the sky */}
      {[0.03, 0.14, 0.86, 0.97].map((fx, i) => (
        <g key={i} opacity={0.55}>
          <rect x={w * fx - 7} y={branchY} width={14} height={floorY - branchY} fill="#201a45" />
          <circle cx={w * fx} cy={branchY + 30 + i * 8} r={46} fill="#1b2d48" />
        </g>
      ))}
      {/* the forest floor, with moss and tufts of grass */}
      <path d={ground} fill="#1f3442" />
      <path d={`M0 ${fy + 10} Q${w * 0.25} ${fy - 6} ${w * 0.5} ${fy} Q${w * 0.75} ${fy + 6} ${w} ${fy - 4}`} fill="none" stroke="#3d6b55" strokeWidth={5} strokeLinecap="round" />
      {Array.from({ length: Math.round(w / 70) }, (_, i) => {
        const x = 30 + i * 70 + rnd(i + 20) * 30
        const y = fy + 8 + rnd(i + 30) * Math.max(4, h - fy - 14)
        return <path key={i} d={`M${x - 8} ${y} q4 -14 6 0 q3 -16 5 0 q4 -12 6 0`} fill="none" stroke="#3d6b55" strokeWidth={3} strokeLinecap="round" />
      })}
      {/* the two trees that frame the clearing */}
      <path d={trunk(-6, 1)} fill={BARK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d={trunk(w + 6, -1)} fill={BARK} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d={`M${trunkW * 0.35} ${branchY + 30} L${trunkW * 0.35} ${floorY}`} stroke={BARK_DARK} strokeWidth={4} strokeLinecap="round" />
      <path d={`M${w - trunkW * 0.35} ${branchY + 30} L${w - trunkW * 0.35} ${floorY}`} stroke={BARK_DARK} strokeWidth={4} strokeLinecap="round" />
      {/* the crowns closing over the clearing */}
      <g className="ks-sway">
        {crowns.map((c, i) => <circle key={i} cx={c.x} cy={c.y} r={c.r} fill={c.c} stroke={INK} strokeWidth={3} />)}
        {crowns.map((c, i) => <circle key={`l${i}`} cx={c.x - c.r * 0.25} cy={c.y - c.r * 0.35} r={c.r * 0.38} fill={LEAF_LIGHT} opacity={0.55} />)}
      </g>
      {/* the branch the word hangs on, from tree to tree */}
      <path d={`M0 ${branchY + 2} L${w} ${branchY + 2}`} fill="none" stroke={INK} strokeWidth={13} strokeLinecap="round" />
      <path d={`M0 ${branchY + 2} L${w} ${branchY + 2}`} fill="none" stroke="#6b4a3a" strokeWidth={8} strokeLinecap="round" />
      {/* fireflies glowing in the leaves */}
      {glows.map((g, i) => (
        <g key={i} className="ks-glow" style={{ animationDelay: `-${g.d}s` }}>
          <circle cx={g.x} cy={g.y} r={7} fill="#fff59a" opacity={0.35} />
          <circle cx={g.x} cy={g.y} r={3} fill="#fff59a" />
        </g>
      ))}
    </svg>
  )
}

/**
 * A leaf with a letter on it. How it looks says where the letter is:
 *   wait    a dark leaf, the letter faint (comes later)
 *   next    a light leaf with a gold dashed rim, pulsing (the one to type)
 *   gap     only a dashed outline: this letter is on its way down
 *   done    gold and glowing (in the cauldron)
 *   fall    the light leaf that is falling
 */
export function Leaf({ char, size = 58, look = 'wait', pulse = false, style, leafRef }) {
  const fill = { wait: LEAF, next: '#fffdf7', gap: 'rgba(255,253,247,0.12)', done: '#ffd34d', fall: '#fffdf7' }[look]
  const stroke = look === 'next' ? '#ffb020' : look === 'gap' ? 'rgba(255,253,247,0.7)' : look === 'wait' ? LEAF_LIGHT : INK
  const color = look === 'wait' ? 'rgba(255,253,247,0.8)' : INK
  const still = reduceMotion()
  return (
    <motion.div ref={leafRef} data-leaf={look}
      animate={pulse && !still ? { scale: [1, 1.1, 1] } : { scale: 1 }}
      transition={pulse ? { duration: 1, repeat: Infinity } : { duration: 0.3 }}
      style={{ position: 'relative', width: size, height: size * 1.18, flexShrink: 0, transformOrigin: '50% 0%', ...style }}>
      <svg viewBox="0 0 100 118" width={size} height={size * 1.18} aria-hidden="true"
        style={{ position: 'absolute', inset: 0, overflow: 'visible',
          filter: look === 'done' ? 'drop-shadow(0 0 8px rgba(255,211,77,0.9))' : look === 'next' || look === 'fall' ? 'drop-shadow(0 0 10px rgba(255,236,150,0.65))' : undefined }}>
        <path d="M50 2 L50 14" stroke={look === 'gap' ? 'rgba(255,253,247,0.7)' : INK} strokeWidth={4} strokeLinecap="round" />
        <path d="M50 12 C84 26 100 62 50 116 C0 62 16 26 50 12 Z" fill={fill} stroke={stroke}
          strokeWidth={look === 'next' || look === 'gap' ? 5 : 4} strokeDasharray={look === 'next' || look === 'gap' ? '10 7' : undefined} strokeLinejoin="round" />
        {look !== 'gap' && <path d="M50 22 L50 104" stroke={look === 'wait' ? LEAF_LIGHT : 'rgba(42,27,61,0.12)'} strokeWidth={3} strokeLinecap="round" />}
      </svg>
      <span aria-hidden="true" style={{
        position: 'absolute', left: 0, right: 0, top: size * 0.3, textAlign: 'center',
        fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.56, lineHeight: 1, color,
        opacity: look === 'gap' ? 0 : 1,
      }}>{char}</span>
    </motion.div>
  )
}

/** The falling letter: the light leaf, held at its stem by a firefly. */
export function FallingLeaf({ char, size = 64, leafRef }) {
  return (
    <div style={{ position: 'relative', width: size, height: size * 1.18 }}>
      <Leaf char={char} size={size} look="fall" leafRef={leafRef} />
      <div style={{ position: 'absolute', left: '50%', top: -size * 0.42, marginLeft: -size * 0.38 }}><Firefly size={size * 0.76} /></div>
    </div>
  )
}

/**
 * The cheeky raven of the duel. It sits on the branch, holding the thing
 * Lumi wants in its beak; `feathers` of `total` tail feathers are left.
 * `ruffle` changes every time it loses one.
 */
export function Raven({ size = 110, feathers, total, holding, ruffle = 0 }) {
  const still = reduceMotion()
  const n = Math.max(1, total)
  return (
    <motion.div key={ruffle} aria-hidden="true"
      animate={still || !ruffle ? {} : { rotate: [0, 12, -8, 4, 0], y: [0, -10, 0] }} transition={{ duration: 0.5 }}
      style={{ position: 'relative', width: size, height: size * 0.92, transformOrigin: '60% 100%' }}>
      <svg viewBox="0 0 120 110" width={size} height={size * 0.92} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {/* tail feathers, fanned out to the right: one per letter */}
        {Array.from({ length: n }, (_, i) => {
          const a = -40 + (n === 1 ? 40 : (80 * i) / (n - 1))
          return (
            <g key={i} transform={`translate(84 66) rotate(${a})`} opacity={i < feathers ? 1 : 0} style={{ transition: 'opacity .2s' }}>
              <ellipse cx={22} cy={0} rx={22} ry={6} fill="#3a3157" stroke={INK} strokeWidth={2.5} />
              <path d="M4 0 L40 0" stroke="#5a4f80" strokeWidth={1.5} />
            </g>
          )
        })}
        {/* legs on the branch */}
        <path d="M56 92 L52 106 M68 92 L70 106" stroke="#ffb347" strokeWidth={4} strokeLinecap="round" />
        {/* body, wing and head */}
        <ellipse cx={64} cy={70} rx={30} ry={24} fill="#2c2440" stroke={INK} strokeWidth={3.5} />
        <path d="M58 60 Q80 56 92 76 Q74 84 58 74 Z" fill="#3a3157" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx={40} cy={42} r={20} fill="#2c2440" stroke={INK} strokeWidth={3.5} />
        {/* a tuft of head feathers, ruffled */}
        <path d="M40 22 Q36 10 44 6 M44 23 Q48 12 56 12" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        {/* the beak, pointing at Lumi */}
        <path d="M24 40 L2 48 L24 52 Z" fill="#ffb347" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        {/* a cheeky eye with a raised brow */}
        <circle cx={36} cy={38} r={7} fill="#fff" stroke={INK} strokeWidth={2} />
        <circle cx={34} cy={39} r={3.4} fill={INK} />
        <path d="M27 28 L44 31" stroke={INK} strokeWidth={3} strokeLinecap="round" />
      </svg>
      {holding && (
        <div style={{ position: 'absolute', left: -size * 0.46, top: size * 0.2 }}>
          <Art art={holding} size={size * 0.55} />
        </div>
      )}
    </motion.div>
  )
}

/** A feather the raven lost: it twirls down and fades. */
export function LostFeather({ x, y, onDone }) {
  return (
    <motion.svg aria-hidden="true" viewBox="0 0 50 14" width={46} height={13}
      initial={{ x, y, rotate: 0, opacity: 1 }}
      animate={{ x: [x, x - 30, x + 20, x - 10], y: [y, y + 50, y + 100, y + 150], rotate: [0, 60, -40, 90], opacity: [1, 1, 1, 0] }}
      transition={{ duration: 1.6, ease: 'easeOut' }} onAnimationComplete={onDone}
      style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 6 }}>
      <ellipse cx={25} cy={7} rx={23} ry={6} fill="#3a3157" stroke={INK} strokeWidth={2} />
      <path d="M4 7 L46 7" stroke="#5a4f80" strokeWidth={1.5} />
    </motion.svg>
  )
}

/**
 * The hedgehog that carries off a letter that reached the forest floor: it
 * scurries in from the nearer edge, takes the leaf on its back and is gone.
 * `x`, `y`: where the leaf lies (its foot); `from`: the edge (-1 left, 1
 * right). `onTake` comes when it has the leaf, `onDone` when it is gone.
 */
export function Hedgehog({ x, y, from, char, size = 56, w, onTake, onDone }) {
  const still = reduceMotion()
  const D = still ? 0.4 : 1.8
  const [carry, setCarry] = useState(false)
  const take = useRef(onTake)
  take.current = onTake
  useEffect(() => {
    const t = setTimeout(() => { setCarry(true); take.current?.() }, D * 450)
    return () => clearTimeout(t)
  }, [D])
  const edge = from < 0 ? -size * 1.2 : w + size * 0.2
  const at = x - size / 2
  return (
    <motion.div aria-hidden="true"
      initial={{ x: edge, y: y - size * 0.9 }}
      animate={still ? { x: at } : { x: [edge, at, at, edge] }}
      transition={{ duration: D, times: [0, 0.42, 0.55, 1], ease: 'easeInOut' }}
      onAnimationComplete={onDone}
      style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, zIndex: 7, pointerEvents: 'none' }}>
      {/* it looks the way it runs (the picture looks left): in, then out */}
      <div style={{ transform: `scaleX(${(from < 0) !== carry ? -1 : 1})` }}>
        <motion.div animate={still ? {} : { y: [0, -4, 0] }} transition={{ duration: 0.18, repeat: Infinity }}>
          <Art art="🦔" size={size} />
        </motion.div>
      </div>
      {carry && (
        <motion.div initial={{ scale: 1.6, y: 10 }} animate={{ scale: 1, y: 0 }}
          style={{ position: 'absolute', left: size * 0.22, top: -size * 0.42, rotate: '-20deg' }}>
          <Leaf char={char} size={size * 0.5} look="fall" />
        </motion.div>
      )}
    </motion.div>
  )
}
