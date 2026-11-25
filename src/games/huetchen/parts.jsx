import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../../sfx.js'
import { Art } from '../../components/play/index.js'
import { thingY } from './layout.js'

/** The pictures of Hütchenspiel im Gebüsch: bush, leaves, stump, bubble, sign, arrows, the row of finds. */

const INK = '#2a1b3d'
const rand = (a, b) => a + Math.random() * (b - a)

/**
 * One bush and what hides in it. The bush moves between the places
 * (`b.swap`: from, to, behind or in front, how long), its thing hops on
 * top, in, out (b.thing). Every bush looks the same: which is which only
 * the eyes that followed them know.
 */
export function Bush({ L, b, mode, reduce, cheeky, onTap, setEl }) {
  const { B, bh, T, ground, slots } = L
  const Y = thingY(bh, T)
  const sw = b.swap
  const x = slots[Math.min(b.slot, slots.length - 1)] - B / 2
  let animate, transition
  if (sw && slots[sw.from] != null && slots[sw.to] != null) {
    const x0 = slots[sw.from] - B / 2, x1 = slots[sw.to] - B / 2
    if (reduce) {
      animate = { x: x1, y: 0, scale: 1, opacity: 1 }
      transition = { duration: 0.18, ease: 'linear' }
    } else {
      // the one behind goes up and gets smaller, the one in front comes
      // down a little and bigger; both overshoot and settle
      const over = Math.sign(x1 - x0) * B * 0.08
      const back = sw.role === 'back'
      animate = {
        x: [x0, (x0 + x1) / 2, x1 + over, x1],
        y: back ? [0, -bh * 0.34, 0, 0] : [0, bh * 0.07, 0, 0],
        scale: back ? [1, 0.82, 1.03, 1] : [1, 1.1, 0.98, 1],
        opacity: 1,
      }
      transition = { duration: sw.ms / 1000, times: [0, 0.5, 0.8, 1], ease: 'easeInOut' }
    }
  } else {
    animate = { x, y: 0, scale: b.gone ? 0 : 1, opacity: b.gone ? 0 : 1 }
    transition = reduce ? { duration: 0 } : b.gone ? { duration: 0.35, ease: 'backIn' } : { type: 'spring', stiffness: 300, damping: 24 }
  }

  // the thing: where it is, and how it gets there
  const thing = thingMotion(b.thing, Y, T, B, reduce)
  const z = sw ? (sw.role === 'back' ? 1 : 5) : b.thing === 'out' || b.thing === 'peek' ? 4 : 2
  const breathe = mode === 'find' && !b.gone && !reduce
  const help = b.help && !reduce

  return (
    <motion.button type="button" ref={setEl}
      data-bush={b.id} data-word={b.word} data-slot={b.slot} data-gone={b.gone ? 1 : 0}
      aria-label={`Busch ${b.slot + 1}`} disabled={b.gone}
      initial={{ x, y: 0, scale: reduce ? 1 : 0, opacity: reduce ? 1 : 0 }}
      animate={animate} transition={transition}
      onClick={e => onTap(b, e.currentTarget)}
      style={{
        all: 'unset', position: 'absolute', left: 0, top: ground - bh, width: B, height: bh, zIndex: z,
        cursor: b.gone ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent', transformOrigin: '50% 100%',
        pointerEvents: b.gone ? 'none' : 'auto',
      }}>
      {/* the squirrel: pokes its head out from behind, sticks out its tongue, ducks */}
      {cheeky > 0 && !reduce && (
        <motion.div key={cheeky} aria-hidden="true" initial={{ y: B * 0.3, opacity: 0, rotate: 0 }}
          animate={{ y: [B * 0.3, -B * 0.12, -B * 0.12, -B * 0.12, B * 0.3], opacity: [0, 1, 1, 1, 0], rotate: [0, -12, 10, -12, 0] }}
          transition={{ duration: 1.7, times: [0, 0.2, 0.5, 0.8, 1] }}
          onAnimationStart={() => sfx.giggle()}
          style={{ position: 'absolute', right: -B * 0.2, top: bh * 0.02, width: B * 0.44, pointerEvents: 'none' }}>
          <Art art="🐿️" size={B * 0.44} />
          <motion.span animate={{ scaleY: [0, 0, 1, 1, 0] }} transition={{ duration: 1.7, times: [0, 0.25, 0.35, 0.75, 0.85] }}
            style={{ position: 'absolute', left: '30%', top: '60%', width: Math.max(6, B * 0.05), height: Math.max(8, B * 0.07), borderRadius: '0 0 6px 6px', background: '#ff7a9a', border: `2px solid ${INK}`, borderTop: 'none', transformOrigin: '50% 0' }} />
        </motion.div>
      )}
      {/* the thing, cut off where the bush ends below */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -B * 0.3, width: B * 1.6, top: -B * 3, height: B * 3 + bh * 0.93, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div key={b.tid} data-thing={b.thing} initial={b.thing === 'top' && !reduce ? { y: Y.top - B * 1.8, opacity: 1, scale: 1, rotate: 0 } : false}
          animate={thing.animate} transition={thing.transition}
          style={{ position: 'absolute', left: (B * 1.6 - T) / 2, top: B * 3, width: T, height: T, transformOrigin: '50% 90%' }}>
          <Art art={b.emoji} size={T} />
        </motion.div>
      </div>
      {/* the bush: a shake when something lands in it or pops out (b.rustle),
          and under it what it does meanwhile: trembles at the drum roll,
          breathes while it waits for a tap, wiggles when it is the one */}
      <motion.div key={b.rustle} aria-hidden="true" initial={false}
        animate={reduce || !b.rustle ? {} : { rotate: [0, -4, 4, -2, 0], scaleY: [1, 0.9, 1.05, 1], scaleX: [1, 1.06, 0.97, 1] }}
        transition={{ duration: 0.45 }}
        style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%' }}>
        <motion.div
          animate={reduce ? {} : help ? { rotate: [0, -5, 5, -4, 4, 0], scaleY: [1, 0.95, 1.03, 1] }
            : mode === 'drum' ? { x: [0, -1.5, 1.5, -1, 0] }
            : breathe ? { scale: [1, 1.035, 1] } : { rotate: 0, scale: 1, x: 0, scaleY: 1 }}
          transition={help ? { duration: 0.9, repeat: Infinity, repeatDelay: 0.3 }
            : mode === 'drum' ? { duration: 0.18, repeat: Infinity }
            : breathe ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut', delay: b.slot * 0.15 } : { duration: 0.2 }}
          style={{ position: 'absolute', inset: 0, transformOrigin: '50% 100%' }}>
          <BushArt />
        </motion.div>
      </motion.div>
      {b.rustle > 0 && !reduce && <Leaves key={`l${b.rustle}`} B={B} bh={bh} many={b.rustleBig} />}
    </motion.button>
  )
}

function thingMotion(st, Y, T, B, reduce) {
  const fast = { duration: 0.12 }
  if (reduce) {
    const y = st === 'in' || st === 'gone' ? Y.hidden : st === 'help' ? Y.hidden - T * 0.4 : st === 'out' ? Y.top - T * 0.1 : Y.top
    return { animate: { y, scale: 1, rotate: 0, opacity: st === 'gone' || st === 'leave' ? 0 : 1 }, transition: fast }
  }
  switch (st) {
    case 'top': return { animate: { y: Y.top, scale: 1, rotate: 0, opacity: 1 }, transition: { type: 'spring', stiffness: 380, damping: 15 } }
    case 'in': return {
      animate: { y: [Y.top, Y.top - T * 0.5, Y.hidden], scale: [1, 1.06, 0.85], rotate: [0, -12, 0], opacity: 1 },
      transition: { duration: 0.55, times: [0, 0.38, 1], ease: ['easeOut', 'easeIn'] },
    }
    case 'peek': return {
      // out it pops and shakes its head: not me!
      animate: { y: [Y.hidden, Y.top - T * 0.25, Y.top, Y.top, Y.top, Y.top], rotate: [0, 0, -14, 14, -10, 0], scale: [0.85, 1.08, 1, 1, 1, 1], opacity: 1 },
      transition: { duration: 1.1, times: [0, 0.22, 0.4, 0.6, 0.8, 1] },
    }
    case 'out': return {
      animate: { y: [Y.hidden, Y.top - T * 0.75, Y.top - T * 0.12], rotate: [0, 200, 360], scale: [0.85, 1.25, 1.15], opacity: 1 },
      transition: { duration: 0.75, times: [0, 0.55, 1], ease: 'easeOut' },
    }
    case 'wave': return {
      animate: { y: [Y.hidden, Y.top - T * 0.3, Y.top], rotate: [0, 0, 0], scale: [0.85, 1.05, 1], opacity: 1 },
      transition: { duration: 0.5, ease: 'easeOut' },
    }
    case 'help': return {
      // the top of it peeks out of the leaves
      animate: { y: [Y.hidden - T * 0.3, Y.hidden - T * 0.45, Y.hidden - T * 0.3], scale: 0.9, rotate: 0, opacity: 1 },
      transition: { duration: 1.2, repeat: Infinity, ease: 'easeInOut' },
    }
    case 'leave': return {
      animate: { y: Y.top - B * 1.2, scale: 0.6, rotate: 20, opacity: 0 },
      transition: { duration: 0.5, ease: 'easeIn' },
    }
    case 'gone': return { animate: { y: Y.hidden, opacity: 0, scale: 0.85, rotate: 0 }, transition: { duration: 0 } }
    default: return { animate: { y: Y.hidden, scale: 0.85, rotate: 0, opacity: 1 }, transition: { duration: 0.35 } }
  }
}

/** The bush: a few round lobes of leaves, one outline, little red berries. */
function BushArt() {
  return (
    <svg viewBox="0 0 200 160" width="100%" height="100%" preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <ellipse cx="100" cy="156" rx="94" ry="9" fill="rgba(42,27,61,0.2)" />
      <g stroke={INK} strokeWidth="5">
        <circle cx="46" cy="100" r="42" fill="#3c9447" />
        <circle cx="154" cy="100" r="42" fill="#3c9447" />
        <circle cx="100" cy="66" r="54" fill="#4fb058" />
        <circle cx="62" cy="58" r="36" fill="#4fb058" />
        <circle cx="138" cy="60" r="36" fill="#4fb058" />
        <rect x="6" y="98" width="188" height="56" rx="26" fill="#3c9447" />
      </g>
      {/* the same shapes again without outline: one bush, not many circles */}
      <circle cx="46" cy="100" r="39" fill="#3c9447" />
      <circle cx="154" cy="100" r="39" fill="#3c9447" />
      <rect x="9" y="101" width="182" height="50" rx="23" fill="#3c9447" />
      <circle cx="100" cy="68" r="51" fill="#4fb058" />
      <circle cx="62" cy="60" r="33" fill="#4fb058" />
      <circle cx="138" cy="62" r="33" fill="#4fb058" />
      <path d="M100 120 Q100 96 100 84 M100 120 Q70 112 46 100 M100 120 Q132 112 154 100" stroke="#368740" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d="M50 52 q12 -14 28 -6 M108 30 q16 -10 30 2 M26 94 q10 -10 22 -3 M146 92 q10 -10 22 -2 M76 96 q10 -8 20 -2" stroke="#86d67f" strokeWidth="6" fill="none" strokeLinecap="round" />
      {[[56, 84], [140, 78], [100, 126], [160, 124], [36, 124]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="7" fill="#ff5d6c" stroke={INK} strokeWidth="2.5" />
      ))}
    </svg>
  )
}

/** Leaves that fly out of a rustling bush and drift down. */
function Leaves({ B, bh, many }) {
  const n = many ? 9 : 6
  const leaves = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / (n - 1) - 0.5) * 2.4 + rand(-0.2, 0.2)
    const d = B * rand(0.35, 0.7)
    return { id: i, dx: Math.cos(a) * d, dy: Math.sin(a) * d, r: rand(-260, 260), s: B * rand(0.1, 0.15), c: i % 3 ? '#6cc565' : '#a6de7a' }
  })
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: bh * 0.25, width: 0, height: 0, pointerEvents: 'none', zIndex: 6 }}>
      {leaves.map(l => (
        <motion.svg key={l.id} viewBox="0 0 20 12" width={l.s} height={l.s * 0.6}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: [0, l.dx, l.dx * 1.2], y: [0, l.dy, l.dy + B * 0.45], rotate: [0, l.r * 0.6, l.r], opacity: [1, 1, 0] }}
          transition={{ duration: 1, times: [0, 0.35, 1], ease: 'easeOut' }}
          style={{ position: 'absolute', left: -l.s / 2, top: -l.s * 0.3 }}>
          <path d="M1 6 Q10 -3 19 6 Q10 15 1 6 Z" fill={l.c} stroke={INK} strokeWidth="1.6" />
          <path d="M3 6 H16" stroke={INK} strokeWidth="1" />
        </motion.svg>
      ))}
    </div>
  )
}

/** The tree stump Lumi stands on to look over the bushes. */
export function Stump({ s }) {
  if (!s) return null
  const h = s.bottom - s.top
  if (h < 10) return null
  const w = s.w
  return (
    <svg aria-hidden="true" width={w + 20} height={h + 16} viewBox={`-10 -8 ${w + 20} ${h + 16}`}
      style={{ position: 'absolute', left: s.x - w / 2 - 10, top: s.top - 8, overflow: 'visible', pointerEvents: 'none' }}>
      <path d={`M0 0 L0 ${h} L${w} ${h} L${w} 0`} fill="#a8683a" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      {/* bark */}
      <path d={`M${w * 0.28} 14 V${h - 6} M${w * 0.62} 24 V${h - 14} M${w * 0.82} 10 V${h * 0.5}`} stroke="#86502a" strokeWidth="4" strokeLinecap="round" />
      <ellipse cx={w / 2} cy="0" rx={w / 2} ry="9" fill="#e3b277" stroke={INK} strokeWidth="4" />
      <ellipse cx={w / 2} cy="0" rx={w * 0.3} ry="5" fill="none" stroke="#c38a50" strokeWidth="2.5" />
      <ellipse cx={w / 2} cy="0" rx={w * 0.12} ry="2" fill="none" stroke="#c38a50" strokeWidth="2.5" />
    </svg>
  )
}

/**
 * Lumi's speech bubble, its tail pointing at her (`side` left: she stands
 * to the left of it; top: below it). `wood`: the reading sign.
 */
export function Bubble({ L, children, wood, k }) {
  const bb = L.bubble
  const left = bb.side === 'left'
  const bg = wood ? '#e9b872' : '#fffdf7'
  const pos = left
    ? { left: bb.ax + 14, top: bb.ay, y: '-50%' }
    : { left: bb.ax, bottom: L.H - bb.ay + 14, x: '-50%' }
  const { x, y, ...place } = pos
  return (
    <motion.div key={k} initial={{ scale: 0.3, opacity: 0, x, y }} animate={{ scale: 1, opacity: 1, x, y }}
      transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      style={{
        position: 'absolute', ...place, zIndex: 7, maxWidth: bb.maxW, boxSizing: 'border-box',
        background: bg, border: `4px solid ${INK}`, borderRadius: wood ? 14 : 22, padding: wood ? '6px 10px' : 8,
        boxShadow: wood ? 'inset 0 4px 0 rgba(255,255,255,0.35), inset 0 -5px 0 rgba(0,0,0,0.14), 0 5px 0 rgba(42,27,61,0.3)' : '0 5px 0 rgba(42,27,61,0.28)',
        display: 'flex', alignItems: 'center', gap: 8, transformOrigin: left ? '0% 50%' : '50% 100%',
      }}>
      {children}
      <span aria-hidden="true" style={{
        position: 'absolute', width: 0, height: 0, borderStyle: 'solid',
        ...(left
          ? { left: -17, top: '50%', marginTop: -11, borderWidth: '11px 16px 11px 0', borderColor: `transparent ${INK} transparent transparent` }
          : { left: '50%', bottom: -17, marginLeft: -11, borderWidth: '16px 11px 0 11px', borderColor: `${INK} transparent transparent transparent` }),
      }} />
      <span aria-hidden="true" style={{
        position: 'absolute', width: 0, height: 0, borderStyle: 'solid',
        ...(left
          ? { left: -10, top: '50%', marginTop: -7, borderWidth: '7px 11px 7px 0', borderColor: `transparent ${bg} transparent transparent` }
          : { left: '50%', bottom: -10, marginLeft: -7, borderWidth: '11px 7px 0 7px', borderColor: `${bg} transparent transparent transparent` }),
      }} />
    </motion.div>
  )
}

/** The loudspeaker: Lumi says the word again. */
export function Speaker({ size, onTap, pulse, btnRef }) {
  return (
    <motion.button type="button" ref={btnRef} onClick={onTap} aria-label="Noch einmal hören"
      whileTap={{ scale: 0.9 }}
      animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={pulse ? { duration: 1.4, repeat: Infinity } : {}}
      style={{
        all: 'unset', boxSizing: 'border-box', width: size, height: size, flexShrink: 0, cursor: 'pointer', borderRadius: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 55%), #ffc93c',
        border: `4px solid ${INK}`, boxShadow: 'inset 0 -5px 0 rgba(0,0,0,0.15), 0 4px 0 rgba(42,27,61,0.3)',
      }}>
      <svg viewBox="0 0 48 48" width={size * 0.66} height={size * 0.66} aria-hidden="true">
        <path d="M6 18 H15 L27 8 V40 L15 30 H6 Z" fill="#fffdf7" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <path d="M33 17 Q38 24 33 31" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M38 11 Q47 24 38 37" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
    </motion.button>
  )
}

/** Two arrows that cross: these two bushes are about to swap (instead of the swap's arc, with reduced motion). */
export function SwapArrows({ L, a, b }) {
  const xa = L.slots[a], xb = L.slots[b]
  if (xa == null || xb == null) return null
  const y = L.ground - L.bh * 0.55
  const h = L.bh * 0.55
  const left = Math.min(xa, xb) - 20, w = Math.abs(xb - xa) + 40
  const p1 = `M${xa - left} ${h} Q${(xa + xb) / 2 - left} ${-h * 0.4} ${xb - left} ${h}`
  const p2 = `M${xb - left} ${h + 14} Q${(xa + xb) / 2 - left} ${h * 2.2} ${xa - left} ${h + 14}`
  return (
    <svg aria-hidden="true" width={w} height={h * 2.4} style={{ position: 'absolute', left, top: y - h, zIndex: 8, overflow: 'visible', pointerEvents: 'none' }}>
      <defs>
        <marker id="hc-head" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="3.2" markerHeight="3.2" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 Z" fill={INK} />
        </marker>
      </defs>
      {[p1, p2].map(d => (
        <g key={d}>
          <path d={d} stroke="#fffdf7" strokeWidth="12" fill="none" strokeLinecap="round" />
          <path d={d} stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" markerEnd="url(#hc-head)" />
        </g>
      ))}
    </svg>
  )
}

/** The row at the top: a ring for every find of the level, filled as they come. */
export function Rings({ L, found, finale, reduce, setEl }) {
  const r = L.ring
  return (
    <>
      {L.rings.map((p, k) => (
        <div key={k} ref={el => setEl(k, el)} style={{
          position: 'absolute', left: p.x - r / 2, top: p.y - r / 2, width: r, height: r, borderRadius: '50%', boxSizing: 'border-box', zIndex: 3,
          background: found[k] ? '#fffdf7' : 'rgba(255,253,247,0.6)', border: `${r > 26 ? 3 : 2.5}px solid ${INK}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <AnimatePresence>
            {found[k] && (
              <motion.div key={found[k]} initial={reduce ? false : { scale: 1.8, y: -r * 0.6 }}
                animate={finale && !reduce ? { scale: [1, 1.25, 1], y: [0, -r * 0.5, 0], rotate: [0, -10, 10, 0] } : { scale: 1, y: 0 }}
                transition={finale ? { duration: 0.6, delay: k * 0.07, repeat: 2, repeatDelay: 0.3 } : { type: 'spring', stiffness: 420, damping: 14 }}
                style={{ display: 'flex' }}>
                <Art art={found[k]} size={r * 0.82} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </>
  )
}
