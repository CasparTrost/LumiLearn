import { motion } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import { sfx } from '../../sfx.js'
import { pxButton } from '../px.js'

/**
 * Taschenlampen-Jagd: the pieces around the dark room — the garland of
 * friends, the cards, the eyes in the dark, the lamps that go on, the
 * light joker.
 */

const INK = '#2a1b3d'
export const BULBS = ['#ffc93c', '#ff6b5b', '#4aa3ff', '#3fc1a8', '#5cc45a', '#ff8fb8', '#b98cff']

/** The middle of garland place `i` (of `total`), in the game's px. */
export function slotAt(g, i, total) {
  const per = Math.ceil(total / (g.rows ?? 1))
  const step = g.w / per
  return { x: g.x + step * ((i % per) + 0.5), y: g.y + Math.floor(i / per) * (g.rowH ?? 0) + 12 + g.pic / 2 }
}

/**
 * The garland above the room: one bulb per shadow of the level. Every
 * friend found climbs up and hangs below its bulb, which lights up; a tap
 * makes it giggle. `away`: places whose friend is down in the room for the
 * party. `hop`: a number that changes when they all hop.
 */
export function Garland({ box, total, found, away, hop, reduce }) {
  const rows = box.rows ?? 1
  const per = Math.ceil(total / rows)
  const step = box.w / per
  const rowH = box.rowH ?? box.h
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={found.length} aria-label={`${found.length} von ${total} gefunden`}
      style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h }}>
      {Array.from({ length: rows }, (_, r) => {
        const n = Math.min(per, total - r * per)
        return (
          <svg key={r} viewBox={`0 0 ${box.w} 24`} width={box.w} height={24} aria-hidden="true" style={{ position: 'absolute', left: 0, top: r * rowH, overflow: 'visible' }}>
            <path d={`M0 3 ${Array.from({ length: n }, (_, i) => `Q${step * (i + 0.5)} 20 ${step * (i + 1)} 3`).join(' ')}`} fill="none" stroke="#cfc4ee" strokeWidth="3" />
          </svg>
        )
      })}
      {Array.from({ length: total }, (_, i) => {
        const f = found.find(x => x.slot === i)
        const color = BULBS[i % BULBS.length]
        const here = f && !away.includes(i)
        return (
          <div key={i} style={{ position: 'absolute', left: step * (i % per), width: step, top: Math.floor(i / per) * rowH, height: rowH, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div aria-hidden="true" style={{
              marginTop: 8, width: 12, height: 15, borderRadius: '50% 50% 45% 45%', border: `2px solid ${INK}`, boxSizing: 'border-box', flexShrink: 0,
              background: f ? color : '#8d84ab', boxShadow: f ? `0 0 12px 4px ${color}` : 'none', transition: 'background .4s, box-shadow .4s',
            }} />
            {here && (
              <motion.button type="button" aria-label={f.name} data-friend={f.e}
                initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                whileTap={{ rotate: [0, -15, 15, 0], scale: 1.2 }}
                onClick={() => sfx.giggle()}
                style={{ all: 'unset', cursor: 'pointer', marginTop: 1, width: box.pic, height: box.pic, borderRadius: '50%', background: '#fffdf7', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <motion.div key={hop} animate={hop && !reduce ? { y: [0, -box.pic * 0.45, 0], rotate: [0, -12, 12, 0] } : { y: 0 }} transition={{ duration: 0.5, delay: (i % 8) * 0.05 }} style={{ display: 'flex' }}>
                  <Art art={f.e} size={box.pic - 6} />
                </motion.div>
              </motion.button>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * Two glowing eyes in the dark (the cat's are yellow and slit). `glint`:
 * a thing that is not alive (fruit, an egg) has no eyes; a little glint
 * shows where it is.
 */
export function Eyes({ size, cat, glint, delay = 0 }) {
  if (glint) {
    return (
      <svg viewBox="0 0 40 14" width={size} height={size * 0.35} className="pl-blink" style={{ display: 'block', animationDelay: `${-delay}s`, overflow: 'visible', filter: `drop-shadow(0 0 ${size * 0.12}px #9fd8ff)` }}>
        <path d="M24 -4 Q25 5 34 7 Q25 9 24 18 Q23 9 14 7 Q23 5 24 -4 Z" fill="#e8f6ff" />
      </svg>
    )
  }
  const fill = cat ? '#ffe14d' : '#d9f2ff'
  return (
    <svg viewBox="0 0 40 14" width={size} height={size * 0.35} className="pl-blink" style={{ display: 'block', animationDelay: `${-delay}s`, overflow: 'visible', filter: `drop-shadow(0 0 ${size * 0.12}px ${cat ? '#ffd21f' : '#9fd8ff'})` }}>
      <ellipse cx="9" cy="7" rx="6.5" ry="5.5" fill={fill} />
      <ellipse cx="31" cy="7" rx="6.5" ry="5.5" fill={fill} />
      {cat
        ? <><ellipse cx="9" cy="7" rx="1.5" ry="4.6" fill={INK} /><ellipse cx="31" cy="7" rx="1.5" ry="4.6" fill={INK} /></>
        : <><circle cx="10" cy="7.5" r="2.6" fill={INK} /><circle cx="32" cy="7.5" r="2.6" fill={INK} /></>}
    </svg>
  )
}

/**
 * A lamp that came down over a found thing: a cord from the ceiling and a
 * shade. Its light is drawn on the darkness (the canvas); this is the lamp.
 */
export function CeilingLamp({ x, drop, size, reduce }) {
  return (
    <motion.div aria-hidden="true"
      initial={reduce ? { opacity: 0 } : { y: -drop - size }} animate={reduce ? { opacity: 1 } : { y: 0, rotate: [0, 10, -7, 4, 0] }}
      transition={reduce ? { duration: 0.2 } : { y: { type: 'spring', stiffness: 260, damping: 14 }, rotate: { duration: 1.4, delay: 0.25 } }}
      style={{ position: 'absolute', left: x - size / 2, top: 0, width: size, transformOrigin: '50% 0', pointerEvents: 'none' }}>
      <div style={{ width: 3, height: drop, margin: '0 auto', background: INK }} />
      <svg viewBox="0 0 44 30" width={size} height={size * 0.68} style={{ display: 'block', overflow: 'visible' }}>
        <ellipse cx="22" cy="28" rx="16" ry="6" fill="#fff7c2" opacity="0.9" />
        <path d="M4 24 Q22 -8 40 24 Z" fill="#ff6b5b" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="22" cy="25" r="6" fill="#fff3a0" stroke={INK} strokeWidth="2" />
      </svg>
    </motion.div>
  )
}

/** Bunting along the ceiling once the room is lit. */
export function Bunting({ w }) {
  const n = Math.max(6, Math.round(w / 60))
  return (
    <motion.svg viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden="true" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 24, pointerEvents: 'none' }}>
      <path d="M0 2 Q100 10 200 2" fill="none" stroke={INK} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: n }, (_, i) => {
        const x = 2 + i * (196 / n), y = 2 + 8 * Math.sin(Math.PI * (x / 200)) * 0.9
        return <path key={i} d={`M${x} ${y} L${x + 196 / n * 0.7} ${y} L${x + 196 / n * 0.35} ${y + 11} Z`} fill={BULBS[i % BULBS.length]} stroke={INK} strokeWidth="0.6" />
      })}
    </motion.svg>
  )
}

/** The light joker: once a room the whole room lights up for a moment. */
export function Joker({ used, onClick, x, y, size }) {
  return (
    <motion.button type="button" onClick={used ? undefined : onClick} aria-label="Licht-Tipp" aria-disabled={used}
      whileTap={used ? undefined : { scale: 0.88 }}
      style={{
        ...pxButton('gold'), position: 'absolute', left: x, top: y, width: size, height: size, padding: 0, borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: used ? 0.4 : 1, cursor: used ? 'default' : 'pointer',
        touchAction: 'manipulation',
      }}>
      <Art art="💡" size={size * 0.62} />
    </motion.button>
  )
}
