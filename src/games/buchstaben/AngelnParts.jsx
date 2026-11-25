import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../../sfx.js'
import { Art } from '../../components/play/index.js'
import { reduceMotion } from './useRounds.js'
import './angeln.css'

/** The pictures of Anlaut-Angeln: pond, bank, boat, frogs and buckets, the boot and the chest. */

const INK = '#2a1b3d'
export const BUCKET_COLORS = ['#e8483b', '#2f7fd8', '#e07a10', '#8a4fd0']

/** The pond: the surface seen from above (where the boat floats), the water under it, sand and weed. */
export function Pond({ L }) {
  const { pond, surface, water } = L
  const air = surface - pond.y
  const weeds = Math.max(3, Math.round(pond.w / 150))
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: pond.x, top: pond.y, width: pond.w, height: pond.h, overflow: 'hidden', pointerEvents: 'none' }}>
      {/* the surface, far away: light, with lily pads at the edges */}
      <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: air + 4,
        background: 'linear-gradient(180deg, #a6e4f7 0%, #7fd0f0 100%)', borderTop: `3px solid ${INK}` }}>
        <span className="ang-ripple" style={{ left: '18%', top: '30%' }} />
        <span className="ang-ripple" style={{ left: '64%', top: '58%', animationDelay: '1.4s' }} />
        <span className="ang-ripple" style={{ left: '40%', top: '18%', animationDelay: '2.6s' }} />
        <LilyPad x={10} y={air * 0.22} s={34} />
        <LilyPad x={pond.w - 46} y={air * 0.5} s={28} />
      </div>
      {/* the water */}
      <div style={{ position: 'absolute', left: 0, top: air, width: '100%', bottom: 0,
        background: 'linear-gradient(180deg, #3fa6de 0%, #2a83c6 45%, #1d5f9f 100%)' }}>
        <div className="ang-rays" />
      </div>
      {/* the front edge of the surface: a wave line */}
      <svg className="ang-wave" width={pond.w + 80} height="18" viewBox={`0 0 ${pond.w + 80} 18`} preserveAspectRatio="none"
        style={{ position: 'absolute', left: -40, top: air - 8 }}>
        <path d={wavePath(pond.w + 80)} fill="#7fd0f0" stroke="#fffdf7" strokeWidth="3" />
      </svg>
      {/* sand and weed */}
      <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: pond.y + pond.h - water.bottom + 10,
        background: '#e9cf86', borderTop: `3px solid ${INK}`, borderRadius: '50% 50% 0 0 / 14px 14px 0 0' }} />
      {Array.from({ length: weeds }, (_, i) => (
        <Weed key={i} x={((i + 0.5) / weeds) * pond.w + (i % 2 ? 18 : -18)} y={pond.h - 10} h={28 + (i % 3) * 12} delay={i * 0.7} />
      ))}
    </div>
  )
}

const wavePath = w => {
  let d = 'M0 18 L0 8'
  for (let x = 0; x < w; x += 40) d += ` Q${x + 10} 0 ${x + 20} 8 T${x + 40} 8`
  return d + ` L${w} 18 Z`
}

function LilyPad({ x, y, s }) {
  return (
    <svg width={s} height={s * 0.6} viewBox="0 0 100 60" style={{ position: 'absolute', left: x, top: y }}>
      <path d="M50 30 L64 6 A48 27 0 1 1 36 6 Z" fill="#7ccf5a" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
    </svg>
  )
}

function Weed({ x, y, h, delay }) {
  return (
    <svg className="ang-weed" width="30" height={h + 6} viewBox={`0 0 30 ${h + 6}`}
      style={{ position: 'absolute', left: x - 15, top: y - h, animationDelay: `${delay}s` }}>
      <path d={`M15 ${h + 6} Q4 ${h * 0.6} 13 ${h * 0.3} Q20 ${h * 0.1} 12 2`} stroke="#3f9a3a" strokeWidth="6" fill="none" strokeLinecap="round" />
      <path d={`M15 ${h + 6} Q26 ${h * 0.6} 20 ${h * 0.35}`} stroke="#4fae4a" strokeWidth="5" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** The bank the buckets stand on. */
export function Bank({ L }) {
  const { bank, side } = L
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', left: bank.x, top: bank.y, width: bank.w, height: bank.h, pointerEvents: 'none',
      background: 'linear-gradient(180deg, #8fdc6a 0%, #6cc24f 100%)',
      border: `3px solid ${INK}`, borderRadius: side ? '26px 0 0 26px' : '0 0 26px 26px',
      borderRight: side ? 'none' : undefined, borderTop: side ? undefined : 'none',
      boxShadow: 'inset 0 -6px 0 rgba(42,27,61,0.12)',
    }} />
  )
}

/** The little boat with Lumi in it. The game moves it (ref) and turns it (dir). */
export function Boat({ boatRef, size, dir, children }) {
  const w = size * 1.7
  return (
    <div ref={boatRef} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, pointerEvents: 'none', zIndex: 4, willChange: 'transform' }}>
      <div style={{ position: 'absolute', left: -size / 2 - dir * size * 0.08, top: -size * 0.98, width: size, height: size }}>
        {children}
      </div>
      <svg width={w} height={size * 0.5} viewBox="0 0 170 50" style={{ position: 'absolute', left: -w / 2, top: -size * 0.26, overflow: 'visible' }}>
        <path d="M4 6 L166 6 Q156 46 120 46 L50 46 Q14 46 4 6 Z" fill="#c9803f" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <path d="M14 20 L156 20" stroke="#8a5a2b" strokeWidth="4" />
        <rect x="0" y="0" width="170" height="9" rx="4" fill="#e3a35e" stroke={INK} strokeWidth="4" />
      </svg>
    </div>
  )
}

/** An old boot, the thing nobody wants to catch. */
export function Boot({ size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block' }}>
      <path d="M30 10 L62 10 L62 58 Q86 60 92 74 L92 86 L22 86 Q18 70 26 50 Z" fill="#7a5233" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M22 86 L92 86 L92 92 L22 92 Z" fill="#3b2a20" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
      <path d="M30 10 L62 10 L62 20 L29 20 Z" fill="#5e3e26" stroke={INK} strokeWidth="4" />
      <path d="M40 32 L56 32 M40 42 L56 42" stroke="#e8d3a6" strokeWidth="4" strokeLinecap="round" />
      <path d="M70 62 Q74 54 80 58" stroke="#3f9a3a" strokeWidth="4" fill="none" strokeLinecap="round" />
    </svg>
  )
}

/** A treasure chest; `open` lifts the lid and shows the gold. */
export function Chest({ size, open }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {open && <ellipse cx="50" cy="44" rx="34" ry="12" fill="#ffd34d" stroke={INK} strokeWidth="4" />}
      {open && [30, 46, 62].map(x => <circle key={x} cx={x + 4} cy="38" r="8" fill="#ffe27a" stroke={INK} strokeWidth="3" />)}
      <rect x="12" y="44" width="76" height="44" rx="6" fill="#b5652b" stroke={INK} strokeWidth="5" />
      <rect x="12" y="58" width="76" height="8" fill="#ffc93c" stroke={INK} strokeWidth="3" />
      <rect x="44" y="54" width="12" height="18" rx="3" fill="#ffc93c" stroke={INK} strokeWidth="3" />
      <g style={{ transformOrigin: '12px 44px', transform: open ? 'rotate(-38deg)' : 'none', transition: 'transform 0.3s' }}>
        <path d="M12 44 Q12 16 50 16 Q88 16 88 44 Z" fill="#c9773a" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <path d="M30 20 L30 44 M70 20 L70 44" stroke="#ffc93c" strokeWidth="6" />
      </g>
    </svg>
  )
}

/** A rubbish bin with a frog on it: comes up for the boot, takes it, burps, and goes. */
export function BinFrog({ x, y, size, open }) {
  return (
    <motion.div aria-hidden="true" initial={{ y: size * 1.3, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: size * 1.3, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 18 }}
      style={{ position: 'absolute', left: x - size / 2, top: y - size * 1.45, width: size, height: size * 1.45, pointerEvents: 'none', zIndex: 5 }}>
      <motion.div animate={open ? { scaleY: [1, 1.15, 0.9, 1], y: [0, -10, 0] } : {}} transition={{ duration: 0.5 }}
        style={{ position: 'absolute', left: size * 0.16, top: 0, width: size * 0.68, height: size * 0.68, transformOrigin: '50% 100%' }}>
        <Art art="🐸" size={size * 0.68} />
      </motion.div>
      <svg width={size} height={size * 0.86} viewBox="0 0 100 86" style={{ position: 'absolute', left: 0, top: size * 0.58 }}>
        <path d="M14 10 L86 10 L78 82 L22 82 Z" fill="#9aa7b3" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
        <path d="M36 22 L38 72 M50 22 L50 72 M64 22 L62 72" stroke="#6c7884" strokeWidth="4" strokeLinecap="round" />
        <rect x="8" y="4" width="84" height="10" rx="4" fill="#b9c4ce" stroke={INK} strokeWidth="4" />
      </svg>
    </motion.div>
  )
}

/** Water drops flying up where something breaks the surface. */
export function Splash({ x, y, big }) {
  const n = big ? 9 : 5
  if (reduceMotion()) return null
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, pointerEvents: 'none', zIndex: 6 }}>
      {Array.from({ length: n }, (_, k) => (
        <motion.div key={k} initial={{ x: 0, y: 0, opacity: 1, scale: 0.6 }}
          animate={{ x: (k - (n - 1) / 2) * (big ? 16 : 12), y: [0, -(big ? 60 : 34) - (k % 3) * 12, 14], opacity: [1, 1, 0], scale: 1 }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          style={{ position: 'absolute', left: -6, top: -8, width: 12, height: 15, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: '#6cc3f5', border: `2px solid ${INK}` }} />
      ))}
    </div>
  )
}

// What a frog does when something lands in its bucket, in turn
const REACTIONS = ['giggle', 'sleepy', 'jump']
// Where the catches peek out of a bucket: beside the frog, left and right, then further out
const PILE_AT = [{ x: 18, r: -14 }, { x: 82, r: 12 }, { x: 6, r: -26 }, { x: 94, r: 24 }]

/**
 * A frog on a bucket with its letter. Tapping the frog: it says its sound
 * ("Mmm", or "Mmm wie Maus!" while the hint picture shows). Tapping the
 * bucket, or dropping the catch on it, puts the catch in.
 *   state  'wait' | 'tried' (not this one) | 'help' (this one!) | 'off' (dimmed while helping)
 *   hover  the catch is being dragged over it
 *   pile   the catches of the level in this bucket; `landed` counts the right ones
 *   nope   counts the times the frog handed something back
 *   word   the word that just landed, written, with its first letter picked out
 */
export function FrogUnit({ u, L, i, color, state, hover, pile, landed, nope, chorus, hint, word, bucketRef, finale, onFrog, onBucket }) {
  const still = reduceMotion()
  const [croak, setCroak] = useState(0)
  const react = landed ? REACTIONS[(landed - 1) % REACTIONS.length] : null
  useEffect(() => {
    if (react === 'giggle') { const t = setTimeout(sfx.giggle, 450); return () => clearTimeout(t) }
    if (react === 'jump') { const t = setTimeout(sfx.splash, 900); return () => clearTimeout(t) }
  }, [react, landed])
  const spring = { type: 'spring', stiffness: 300, damping: 14 }
  const frogTop = 0, bucketTop = u.f * 0.72
  const dim = state === 'tried' || state === 'off'
  const tapFrog = () => { setCroak(c => c + 1); onFrog(L) }
  const pileSize = Math.max(30, u.uw * 0.36)
  return (
    <div data-unit={L} style={{ position: 'absolute', left: u.x, top: u.y, width: u.uw, height: u.uh, zIndex: 3 }}>
      {/* the catches of the level, peeking out of the bucket beside the frog */}
      {pile.map((e, k) => {
        const at = PILE_AT[k % PILE_AT.length], up = Math.floor(k / PILE_AT.length) * 8
        return (
          <motion.div key={k} aria-hidden="true" initial={{ y: -60, scale: 0.3, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={spring}
            style={{ position: 'absolute', left: `${at.x}%`, top: bucketTop - pileSize * 0.62 - up, width: pileSize, marginLeft: -pileSize / 2, rotate: `${at.r}deg`, zIndex: 0, pointerEvents: 'none' }}>
            <Art art={e} size={pileSize} />
          </motion.div>
        )
      })}
      {/* the frog: tap it to hear its sound */}
      <button type="button" aria-label={`Frosch ${L}`} onClick={tapFrog}
        style={{ all: 'unset', position: 'absolute', left: (u.uw - Math.max(64, u.f)) / 2, top: frogTop - 4, width: Math.max(64, u.f), height: Math.max(64, u.f * 0.86),
          cursor: 'pointer', zIndex: 2, WebkitTapHighlightColor: 'transparent', display: 'flex', justifyContent: 'center' }}>
        <motion.div
          animate={still ? {}
            : finale ? { y: [0, -u.f * 0.6, 0], rotate: [0, 0, 360], transition: { duration: 0.8, delay: i * 0.1, repeat: 1 } }
            : react === 'jump' ? { x: [0, u.uw * 0.25, u.uw * 0.5, u.uw * 0.5, 0], y: [0, -u.f, u.f * 0.3, u.f * 0.3, 0], rotate: [0, 20, 40, 40, 0], transition: { duration: 1.6, times: [0, 0.25, 0.5, 0.7, 1] } }
            : react === 'sleepy' ? { y: [0, 5], scaleY: [1, 0.9], rotate: [0, -8], transition: { duration: 1.2 } }
            : react === 'giggle' ? { y: [0, -u.f * 0.5, 0, -u.f * 0.2, 0], rotate: [0, 0, 360, 360, 360], transition: { duration: 1 } }
            : state === 'help' ? { y: [0, -u.f * 0.22, 0], transition: { duration: 0.7, repeat: Infinity } }
            : hover ? { y: -u.f * 0.18, scale: 1.12, rotate: 0, transition: spring }
            : { y: [0, -3, 0], scale: 1, rotate: 0, transition: { duration: 2 + i * 0.3, repeat: Infinity } }}
          style={{ width: u.f, height: u.f, filter: dim ? 'grayscale(0.8) brightness(0.95)' : undefined, transformOrigin: '50% 100%' }}>
          {/* a hop of its own when tapped, all together for a streak; a head shake when it hands something back */}
          <motion.div key={`${croak}-${chorus}-${nope}`} style={{ width: '100%', height: '100%', transformOrigin: '50% 100%' }}
            animate={still || croak + chorus + nope === 0 ? {}
              : nope && !croak ? { rotate: [0, -16, 14, -10, 8, 0] }
              : { y: [0, -u.f * 0.4, 0], scaleY: [1, 0.85, 1.12, 1] }}
            transition={{ duration: nope && !croak ? 0.7 : 0.55, delay: chorus && !croak && !nope ? i * 0.08 : 0 }}>
            <Art art="🐸" size={u.f} />
          </motion.div>
        </motion.div>
      </button>
      {/* tapped: its letter pops up */}
      <AnimatePresence>
        {croak > 0 && (
          <motion.div key={croak} aria-hidden="true" initial={{ scale: 0.3, opacity: 0, y: 0 }}
            animate={{ scale: [0.3, 1.15, 1], opacity: [0, 1, 0], y: -30 }} transition={{ duration: 1 }}
            style={{ position: 'absolute', top: 0, left: '66%', zIndex: 4, pointerEvents: 'none', fontFamily: 'var(--font-heading)',
              fontWeight: 700, fontSize: Math.max(24, u.f * 0.42), color, WebkitTextStroke: `2px ${INK}`, paintOrder: 'stroke fill' }}>{L}</motion.div>
        )}
      </AnimatePresence>
      {/* Zzz */}
      {react === 'sleepy' && !still && (
        <motion.div key={`z${landed}`} aria-hidden="true" initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 1, 0], y: -30 }} transition={{ duration: 2, delay: 0.5 }}
          style={{ position: 'absolute', top: 0, right: 0, zIndex: 4, pointerEvents: 'none', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: '#2f7fd8' }}>Zzz</motion.div>
      )}
      {/* the bucket: the catch goes in here */}
      <button type="button" ref={bucketRef} aria-label={`Eimer ${L}`} data-bucket={L} onClick={() => onBucket(L)}
        style={{ all: 'unset', position: 'absolute', left: (u.uw - u.bw) / 2, top: bucketTop, width: u.bw, height: u.bh, cursor: 'pointer', zIndex: 1, WebkitTapHighlightColor: 'transparent' }}>
        <motion.div animate={hover && !still ? { scale: 1.08 } : { scale: 1 }} transition={spring} style={{ width: '100%', height: '100%' }}>
          <svg viewBox="0 0 100 78" width={u.bw} height={u.bh} style={{ display: 'block', overflow: 'visible', opacity: dim ? 0.55 : 1 }} aria-hidden="true">
            {(hover || state === 'help') && <path d="M2 6 L14 76 Q50 86 86 76 L98 6 Z" fill="none" stroke="#ffc93c" strokeWidth="14" strokeLinejoin="round" />}
            <path d="M8 8 L18 72 Q50 82 82 72 L92 8 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <ellipse cx="50" cy="8" rx="42" ry="7" fill={color} stroke={INK} strokeWidth="4" style={{ filter: 'brightness(0.72)' }} />
            <circle cx="50" cy="43" r="25" fill="#fffdf7" stroke={INK} strokeWidth="3" />
            <text x="50" y="44" textAnchor="middle" dominantBaseline="central" fontFamily="Fredoka, Nunito, sans-serif" fontWeight="700" fontSize="38" fill={INK}>{L}</text>
          </svg>
        </motion.div>
      </button>
      {/* after a miss: a picture that starts like the letter */}
      <AnimatePresence>
        {hint && !dim && (
          <motion.div key={hint.word} aria-hidden="true" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}
            style={{ position: 'absolute', right: -4, top: bucketTop + u.bh * 0.52, zIndex: 2, width: Math.max(34, u.uw * 0.36), height: Math.max(34, u.uw * 0.36), borderRadius: '50%',
              background: '#fffdf7', border: `3px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <Art art={hint.emoji} size={Math.max(34, u.uw * 0.36) * 0.76} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* it landed: the word, written, its first letter picked out */}
      <AnimatePresence>
        {word && (
          <motion.div key={word.key} aria-hidden="true" initial={{ scale: 0, opacity: 0, x: '-50%' }} animate={{ scale: 1, opacity: 1, x: '-50%' }} exit={{ opacity: 0, x: '-50%' }}
            transition={{ type: 'spring', stiffness: 360, damping: 16 }}
            style={{ position: 'absolute', left: '50%', top: bucketTop + u.bh * 0.25, zIndex: 5, pointerEvents: 'none', whiteSpace: 'nowrap',
              background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 14, boxShadow: '0 4px 0 rgba(42,27,61,0.3)', padding: '2px 10px',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: Math.max(18, Math.min(28, u.uw * 0.22)), color: INK }}>
            <span style={{ color, fontSize: '1.25em' }}>{word.text[0]}</span>{word.text.slice(1)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
