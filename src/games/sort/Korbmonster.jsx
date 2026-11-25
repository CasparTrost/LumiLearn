import { motion, AnimatePresence, useTransform, useMotionValue } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import { SIGN_H, MONSTER_H } from './layout.js'
import './fliessband.css'

/**
 * A basket monster of the sorting belt (SortGame): a woven basket with a
 * face and feet that collects one kind of thing. It eats nothing: a thing
 * hops into the basket (plop), sits there peeking out over the rim, and
 * the monster beams. Its sign shows what it collects, as pictures (the
 * word underneath is for the parents). It follows the thing in the child's
 * hand with its eyes, opens its eyes wide when the thing comes its way,
 * gets a little rounder with every thing, and the bar on the rim fills.
 * The wrong thing it does not want: it shakes its head and hands it back.
 *
 *   <Korbmonster width={200} tint={{ bg, ring }} sign={{ pics: ['🐕', '🐱'], label: 'Tiere', scale: 1 }}
 *     items={[{ id, art }]} need={4} mood="idle" look={0} gaze={{ x, y }} renderItem={…} />
 *
 * Moods: idle · ready (something is held up) · eager (it comes my way) ·
 * catch (it landed in the basket) · nope (not mine, head shake) · cheer
 * (the basket is full) · happy · point (waves: "to me!") · dance · full
 * `gaze`: two MotionValues, −1 … 1, where the eyes look.
 * `need`: things until it is full; `items.length` of them are in it.
 */
const INK = '#2a1b3d'
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Where the things in the basket sit: x across the rim (0..1), how far up
const PILE = [[0.5, 0], [0.26, 0.06], [0.74, 0.06], [0.38, -0.2], [0.62, -0.2], [0.5, -0.36]]

// How a monster (or the bin) of width W moves in each mood. The hops grow
// with its size, so a small one on a phone does not jump out of the screen.
export const motionFor = (mood, W) => {
  const still = { x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1 }
  const h = W * 0.1
  return ({
    idle:   { ...still, y: [0, -3, 0], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
    ready:  { ...still, y: [0, -h * 0.3, 0], scale: 1.03, transition: { duration: 0.9, repeat: Infinity, ease: 'easeInOut' } },
    full:   { ...still, rotate: [0, -1.5, 1.5, 0], scaleY: [1, 1.02, 1], transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } },
    eager:  { ...still, scale: 1.06, transition: { type: 'spring', stiffness: 320, damping: 14 } },
    happy:  { ...still, y: [0, -h, 0, -h * 0.4, 0], rotate: [0, -4, 4, 0, 0], transition: { duration: 0.8 } },
    nope:   { ...still, rotate: [0, -6, 6, -5, 5, 0], transition: { duration: 0.7 } },
    cheer:  { ...still, y: [0, -h * 1.1, 0, -h * 0.5, 0], scaleY: [1, 1.06, 0.94, 1.03, 1], transition: { duration: 0.8 } },
    point:  { ...still, y: [0, -h * 0.6, 0, -h * 0.6, 0], scale: 1.03, transition: { duration: 1.1, repeat: Infinity, repeatDelay: 0.4 } },
    dance:  { ...still, rotate: [0, -4, 4, -4, 4, 0], y: [0, -h * 0.7, 0, -h * 0.7, 0, 0], transition: { duration: 1.1, repeat: Infinity } },
    catch:  { ...still, scaleY: [1, 0.88, 1.06, 0.97, 1], scaleX: [1, 1.07, 0.97, 1.02, 1], transition: { duration: 0.55 } },
  })[mood]
}

export default function Korbmonster({ width = 200, tint, sign, items = [], need = 0, mood = 'idle', look = 0, gaze }) {
  const W = width
  const signH = W * SIGN_H
  const H = W * MONSTER_H
  const rimY = signH + W * 0.35      // the rim of the basket on screen
  const s = W * 0.3                  // a thing in the basket
  const id = `km-${look}-${tint.ring.slice(1)}`
  const have = items.length
  const full = need > 0 && have >= need
  // a little rounder with every thing in it
  const fat = { scaleX: 1 + 0.22 * (need ? Math.min(1, have / need) : 0) }
  const fatSpring = { type: 'spring', stiffness: 300, damping: 9 }
  const shown = items.slice(-PILE.length)

  return (
    <motion.div animate={reduceMotion() ? undefined : motionFor(mood, W) ?? motionFor('idle', W)}
      style={{ position: 'relative', width: W, height: H, transformOrigin: '50% 100%' }}>
      {/* the sign's stick (the board is drawn last, so a full basket never hides it) */}
      {sign && <div style={{ position: 'absolute', left: W * 0.5 - 3, top: W * 0.26, width: 6, height: rimY - W * 0.24, background: '#8a4f22', border: `2px solid ${INK}`, borderRadius: 3 }} />}
      {/* inside of the basket, behind what it holds */}
      <motion.div initial={false} animate={fat} transition={fatSpring} style={{ position: 'absolute', left: 0, top: signH, width: W, height: W * 0.98 }}>
        <svg viewBox="0 0 200 196" width={W} height={W * 0.98} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          <ellipse cx="100" cy="188" rx="64" ry="7" fill="rgba(42,27,61,0.16)" />
          <ellipse cx="100" cy="70" rx="72" ry="17" fill="#3b2a4f" />
        </svg>
      </motion.div>

      {/* what it collected, peeking out over the rim */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <AnimatePresence>
          {shown.map((it, i) => {
            const [u, up] = PILE[i]
            return (
              <motion.div key={it.id} initial={{ scale: 0.4, y: -W * 0.16 }} animate={{ scale: 1, y: [W * 0.08, -W * 0.06, 0] }} exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16, y: { duration: 0.5, times: [0, 0.55, 1] } }}
                style={{ position: 'absolute', left: W * (0.14 + u * 0.72) - s / 2, top: rimY - s * 0.72 + up * W, width: s, height: s }}>
                {it.node ?? <Art art={it.art} size={s} />}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* the basket itself, with its face */}
      <motion.div initial={false} animate={fat} transition={fatSpring} style={{ position: 'absolute', left: 0, top: signH, width: W, height: W * 0.98, pointerEvents: 'none' }}>
        <svg viewBox="0 0 200 196" width={W} height={W * 0.98} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
          <defs>
            <pattern id={id} width="20" height="14" patternUnits="userSpaceOnUse">
              <rect width="20" height="14" fill={tint.ring} />
              <rect width="20" height="7" fill="#fff" opacity="0.16" />
              <line x1="10" y1="0" x2="10" y2="7" stroke={INK} strokeOpacity="0.22" strokeWidth="2" />
              <line x1="0" y1="7" x2="0" y2="14" stroke={INK} strokeOpacity="0.22" strokeWidth="2" />
            </pattern>
          </defs>
          {/* it waves: "to me!" */}
          {mood === 'point' && (
            <g transform="translate(168 104)">
              <g className="fb-wave">
                <path d="M0 0 L22 -40" stroke={INK} strokeWidth="15" strokeLinecap="round" />
                <path d="M0 0 L22 -40" stroke={tint.ring} strokeWidth="9" strokeLinecap="round" />
                <circle cx="25" cy="-48" r="13" fill={tint.bg} stroke={INK} strokeWidth="3.5" />
                <path d="M17 -57 l-3 -7 M25 -61 l0 -8 M33 -57 l4 -7" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
              </g>
            </g>
          )}
          {/* feet */}
          <ellipse cx="66" cy="184" rx="20" ry="10" fill="#ffb347" stroke={INK} strokeWidth="3" />
          <ellipse cx="134" cy="184" rx="20" ry="10" fill="#ffb347" stroke={INK} strokeWidth="3" />
          {/* body */}
          <path d="M26 70 Q28 164 52 178 L148 178 Q172 164 174 70 A74 17 0 0 1 26 70 Z" fill={`url(#${id})`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          {/* the front of the rim is the bar that fills: one piece per thing */}
          <path d="M26 71 A74 17 0 0 0 174 71" fill="none" stroke={INK} strokeWidth="17" />
          <path d="M26 71 A74 17 0 0 0 174 71" fill="none" stroke="#fffdf7" strokeWidth="11" />
          {need > 0 && (
            <>
              <path d="M26 71 A74 17 0 0 0 174 71" fill="none" stroke={full ? '#5cc45a' : '#ffc93c'} strokeWidth="11" pathLength={need}
                strokeDasharray={`${have} ${need + 1}`} data-bar={`${have}/${need}`} style={{ transition: 'stroke-dasharray .35s ease-out, stroke .3s' }} />
              <path d="M26 71 A74 17 0 0 0 174 71" fill="none" stroke={INK} strokeWidth="11" pathLength={need}
                strokeDasharray="0.07 0.93" strokeDashoffset="-0.965" />
            </>
          )}
          {/* face plate, so the face reads on any weave */}
          <ellipse cx="100" cy="128" rx="58" ry="38" fill={tint.bg} stroke={INK} strokeWidth="3" />
          <Face mood={mood} look={look} gaze={gaze} />
          {look === 1 && (
            <g transform="translate(162 62) rotate(18)">
              <path d="M0 0 L-16 -10 L-16 10 Z M0 0 L16 -10 L16 10 Z" fill="#ff5b8a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
              <circle r="5" fill="#ff5b8a" stroke={INK} strokeWidth="3" />
            </g>
          )}
          {look === 2 && (
            <g transform="translate(34 60) rotate(-24)">
              <ellipse cx="0" cy="-12" rx="7" ry="15" fill="#5cc45a" stroke={INK} strokeWidth="3" />
              <ellipse cx="12" cy="-6" rx="6" ry="12" fill="#5cc45a" stroke={INK} strokeWidth="3" transform="rotate(40 12 -6)" />
            </g>
          )}
        </svg>
      </motion.div>

      {sign && <Sign sign={sign} W={W} glow={mood === 'point'} tint={tint} full={full} />}

    </motion.div>
  )
}

// The sign: pictures of what this monster eats, big enough to read from
// across the table; the word hangs underneath, small, for the parents.
// A tick when the monster is full.
function Sign({ sign, W, glow, tint, full }) {
  const n = sign.pics.length
  const boardH = W * 0.3
  const pic = Math.min(boardH - 8, (W * 0.94) / n - 4) * (sign.scale ?? 1)
  return (
    <>
      <motion.div initial={{ scale: 0 }} animate={glow ? { scale: [1, 1.12, 1, 1.12, 1] } : { scale: 1 }}
        transition={glow ? { duration: 1.1, repeat: Infinity, repeatDelay: 0.4 } : { type: 'spring', stiffness: 380, damping: 16 }}
        style={{
          position: 'absolute', left: '50%', top: 0, x: '-50%', height: boardH, minWidth: W * 0.6, maxWidth: W, boxSizing: 'border-box',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: Math.max(2, W * 0.015), padding: `0 ${W * 0.03}px`,
          background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: Math.max(10, W * 0.07),
          boxShadow: glow ? `0 0 0 5px ${tint.ring}, 0 4px 0 rgba(42,27,61,0.3)` : '0 4px 0 rgba(42,27,61,0.3)', transition: 'box-shadow .2s',
        }}>
        {sign.pics.map(p => <Art key={p} art={p} size={pic} />)}
        {full && (
          <motion.svg viewBox="0 0 40 40" width={W * 0.16} height={W * 0.16} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 12 }}
            style={{ position: 'absolute', right: -W * 0.06, top: -W * 0.06 }} aria-hidden="true">
            <circle cx="20" cy="20" r="17" fill="#5cc45a" stroke={INK} strokeWidth="3.5" />
            <path d="M11 21 L18 28 L30 13" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          </motion.svg>
        )}
      </motion.div>
      {sign.label && W >= 130 && (
        <div style={{
          position: 'absolute', left: '50%', top: boardH - 3, transform: 'translateX(-50%)', padding: `0 ${W * 0.035}px`, whiteSpace: 'nowrap',
          background: '#fff4d6', border: `2px solid ${INK}`, borderRadius: 6, fontFamily: 'var(--font-heading)', fontWeight: 700,
          fontSize: Math.max(9, Math.min(13, W * 0.06)), lineHeight: 1.35, color: INK, pointerEvents: 'none',
        }}>{sign.label}</div>
      )}
    </>
  )
}

// Eyes and mouth for each mood; the pupils follow `gaze`
function Face({ mood, look, gaze }) {
  const zero = useMotionValue(0)
  const gx = useTransform(gaze?.x ?? zero, v => v * 6)
  const gy = useTransform(gaze?.y ?? zero, v => v * 5)
  const shut = mood === 'happy' || mood === 'dance' || mood === 'full' || mood === 'cheer' || mood === 'catch'
  const big = mood === 'eager' || mood === 'point' || mood === 'ready'
  return (
    <g>
      {[72, 128].map(x => (
        <g key={x}>
          {shut ? (
            <path d={`M${x - 12} 114 Q${x} 100 ${x + 12} 114`} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          ) : (
            <g className="pl-blink">
              <ellipse cx={x} cy="108" rx={big ? 17 : 15} ry={big ? 19 : 17} fill="#fff" stroke={INK} strokeWidth="3" />
              <motion.g style={{ x: gx, y: gy }}>
                <circle cx={x} cy="110" r={big ? 9 : 7.5} fill={INK} />
                <circle cx={x - 2.5} cy="106.5" r="2.6" fill="#fff" />
              </motion.g>
              {look === 1 && <path d={`M${x - 14} 94 l-5 -6 M${x} 90 l0 -7 M${x + 14} 94 l5 -6`} stroke={INK} strokeWidth="3" strokeLinecap="round" />}
            </g>
          )}
        </g>
      ))}
      <circle cx="52" cy="134" r="8" fill="#ff8fb8" opacity="0.7" />
      <circle cx="148" cy="134" r="8" fill="#ff8fb8" opacity="0.7" />
      {mood === 'point' ? (
        // calling "to me!"
        <g>
          <ellipse cx="100" cy="144" rx="21" ry="16" fill="#5a1f2e" stroke={INK} strokeWidth="3" />
          <ellipse cx="100" cy="153" rx="12" ry="6" fill="#ff6b81" />
        </g>
      ) : mood === 'eager' || mood === 'ready' ? (
        // a big smile: is it for me?
        <path d="M78 136 Q100 160 122 136" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
      ) : mood === 'happy' || mood === 'dance' || mood === 'catch' || mood === 'cheer' ? (
        <g>
          <path d="M74 134 Q100 168 126 134 Z" fill="#5a1f2e" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M88 152 Q100 160 112 152 Q100 148 88 152" fill="#ff6b81" />
        </g>
      ) : mood === 'nope' ? (
        // a small, sorry mouth: not mine
        <path d="M88 146 Q100 140 112 146" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      ) : (
        <path d="M84 138 Q100 152 116 138" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      )}
    </g>
  )
}
