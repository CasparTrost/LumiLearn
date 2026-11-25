import { motion, useTransform } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import { SIGN_H, MONSTER_H } from './layout.js'
import { motionFor, Shout } from './Korbmonster.jsx'
import './fliessband.css'

// Fließband-Füttern (SortGame.jsx): the kitchen, the belt with its pipe,
// the bin, and the looks of the things on the belt.

const INK = '#2a1b3d'
const PIPE = '#35b6a4', PIPE_DARK = '#1f8f80', PIPE_LIGHT = '#8fe3d6'
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** The room: a tiled wall, and the wooden counter the monsters stand on. */
export function Backdrop({ L }) {
  const ledge = L.targets[0].y + L.targets[0].h - L.mw * 0.07
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', inset: 0, backgroundColor: '#eaf4f3',
        backgroundImage: 'linear-gradient(#d5e8e6 3px, transparent 3px), linear-gradient(90deg, #d5e8e6 3px, transparent 3px)',
        backgroundSize: '64px 64px', backgroundPosition: '-2px -2px',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, top: ledge, bottom: 0, borderTop: `4px solid ${INK}`,
        background: 'linear-gradient(#e3aa6d 0 14px, rgba(42,27,61,0.28) 14px 17px, transparent 17px), repeating-linear-gradient(90deg, #c98a52 0 62px, #b97a45 62px 66px)',
      }} />
    </div>
  )
}

/**
 * The belt and the pipe that brings back what fell off its end.
 * `roll`: a MotionValue, how far the belt has run in px. `lumps`: things on
 * their way back through the pipe, as bumps that travel right to left.
 */
export function Belt({ L, roll, lumps, pipeIn, pipeOut }) {
  const { belt, pipe, S } = L
  const stripes = useTransform(roll, v => `${v % 62}px 0px`)
  const turn = useTransform(roll, v => (v / (belt.thick * 0.5)) * (180 / Math.PI))
  const lip = Math.max(10, Math.round(S * 0.16))
  const stub = (side, ref) => {
    const x = pipe[side].x - pipe.mouthW / 2
    return (
      <div ref={ref} style={{ position: 'absolute', left: x, top: belt.top - lip + 2, width: pipe.mouthW, height: pipe.top + pipe.h - belt.top + lip - 2, zIndex: 6 }}>
        {/* the tube down to the pipe under the belt */}
        <div style={{
          position: 'absolute', left: 5, right: 5, top: lip - 3, bottom: 0, boxSizing: 'border-box', border: `3px solid ${INK}`, borderRadius: '0 0 10px 10px',
          background: `linear-gradient(90deg, ${PIPE_DARK}, ${PIPE} 30%, ${PIPE_LIGHT} 52%, ${PIPE} 72%, ${PIPE_DARK})`,
        }} />
        {/* its mouth */}
        <div style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: lip + 4, boxSizing: 'border-box', border: `3px solid ${INK}`, borderRadius: 8,
          background: `linear-gradient(90deg, ${PIPE_DARK}, ${PIPE} 30%, ${PIPE_LIGHT} 52%, ${PIPE} 72%, ${PIPE_DARK})`, boxShadow: '0 3px 0 rgba(42,27,61,0.3)',
        }} />
        <div style={{ position: 'absolute', left: 7, right: 7, top: 3, height: 5, borderRadius: 4, background: '#12423c' }} />
      </div>
    )
  }
  return (
    <div aria-hidden="true">
      {/* the pipe under the belt */}
      <div style={{
        position: 'absolute', left: pipe.left.x, width: pipe.right.x - pipe.left.x, top: pipe.top, height: pipe.h, boxSizing: 'border-box', zIndex: 3,
        border: `3px solid ${INK}`, borderLeft: 'none', borderRight: 'none', background: `linear-gradient(${PIPE_LIGHT}, ${PIPE} 45%, ${PIPE_DARK})`,
      }} />
      {lumps.map(l => (
        <motion.div key={l.id} initial={{ x: pipe.right.x - pipe.left.x - pipe.mouthW * 0.6, scale: 0.6 }}
          animate={{ x: pipe.mouthW * 0.2, scale: [0.6, 1, 1, 0.6] }} transition={{ duration: l.s, ease: 'easeInOut' }}
          style={{
            position: 'absolute', left: pipe.left.x, top: pipe.top - pipe.h * 0.4, width: pipe.h * 2.6, height: pipe.h * 1.8, boxSizing: 'border-box', zIndex: 4,
            border: `3px solid ${INK}`, borderRadius: '50%', background: `linear-gradient(${PIPE_LIGHT}, ${PIPE} 45%, ${PIPE_DARK})`,
          }} />
      ))}
      {/* the belt */}
      <div style={{
        position: 'absolute', left: belt.left, width: belt.right - belt.left, top: belt.top, height: belt.thick, boxSizing: 'border-box', zIndex: 3,
        border: `3px solid ${INK}`, borderRadius: belt.thick / 2, background: '#6d6a7c', boxShadow: '0 4px 0 rgba(42,27,61,0.35)', overflow: 'hidden',
      }}>
        <motion.div style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, #8d8a9e 0 22px, #5d5a6c 22px 31px)', backgroundSize: '62px 100%', backgroundPosition: stripes }} />
        <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: '34%', background: 'rgba(255,255,255,0.22)' }} />
      </div>
      {[belt.left + 3, belt.right - belt.thick - 3].map(x => (
        <motion.div key={x} style={{
          position: 'absolute', left: x, top: belt.top + 3, width: belt.thick - 6, height: belt.thick - 6, boxSizing: 'border-box', zIndex: 3, rotate: turn,
          borderRadius: '50%', background: '#c9c5d6', border: `3px solid ${INK}`, backgroundImage: `linear-gradient(90deg, transparent 42%, ${INK} 42% 58%, transparent 58%)`,
        }} />
      ))}
      {stub('left', pipeOut)}
      {stub('right', pipeIn)}
    </div>
  )
}

/**
 * The bin, for what belongs to no monster. It has the same box as a monster
 * and the same moods: its lid opens when rubbish comes its way and slams
 * shut on it; anything else it spits out again.
 */
export function Tonne({ width = 200, need = 0, have = 0, mood = 'idle' }) {
  const W = width
  const signH = W * SIGN_H
  const full = need > 0 && have >= need
  const open = mood === 'hungry' ? -44 : mood === 'ready' ? -30 : mood === 'bah' ? -62 : mood === 'burp' ? -20 : 0
  const flap = mood === 'point' || mood === 'dance'
  const seg = 108 / Math.max(1, need)
  return (
    <motion.div animate={reduceMotion() ? undefined : motionFor(mood, W) ?? motionFor('idle', W)}
      style={{ position: 'relative', width: W, height: W * MONSTER_H, transformOrigin: '50% 100%' }}>
      <svg viewBox="0 0 200 196" width={W} height={W * 0.98} style={{ position: 'absolute', left: 0, top: signH, overflow: 'visible', display: 'block' }} aria-hidden="true">
        <defs>
          <linearGradient id="fb-tin" x1="0" x2="1">
            <stop offset="0" stopColor="#8e9aab" /><stop offset="0.3" stopColor="#c3ccd8" /><stop offset="0.55" stopColor="#e3e8ef" /><stop offset="1" stopColor="#8e9aab" />
          </linearGradient>
        </defs>
        <ellipse cx="100" cy="188" rx="64" ry="7" fill="rgba(42,27,61,0.16)" />
        {/* it stinks once something is in it */}
        {have > 0 && (
          <g className="fb-stink" fill="none" stroke="#6fa32e" strokeWidth="5" strokeLinecap="round">
            <path d="M70 30 q-9 -9 0 -18 q9 -9 0 -18" /><path d="M100 22 q-9 -9 0 -18 q9 -9 0 -18" /><path d="M130 30 q-9 -9 0 -18 q9 -9 0 -18" />
          </g>
        )}
        <ellipse cx="100" cy="76" rx="61" ry="11" fill="#3b2a4f" stroke={INK} strokeWidth="4" />
        <path d="M38 76 L50 176 Q51 185 61 185 L139 185 Q149 185 150 176 L162 76 A62 11 0 0 1 38 76 Z" fill="url(#fb-tin)" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        {[[72, 76], [100, 100], [128, 124]].map(([a, b]) => (
          <path key={a} d={`M${a} 118 L${b} 174`} stroke="#77839a" strokeWidth="5" strokeLinecap="round" opacity="0.7" />
        ))}
        {/* the bar that fills: one piece for each piece of rubbish */}
        {need > 0 && (
          <g data-bar={`${have}/${need}`}>
            <rect x="44" y="94" width="112" height="17" rx="8.5" fill={INK} />
            {Array.from({ length: need }, (_, i) => (
              <rect key={i} x={46 + i * seg + 1} y="97" width={seg - 2} height="11" rx="4" fill={i < have ? (full ? '#5cc45a' : '#ffc93c') : '#fffdf7'} style={{ transition: 'fill .3s' }} />
            ))}
          </g>
        )}
        {/* the lid, hinged at the left */}
        <g transform="translate(34 76)">
          <g className={flap ? 'fb-flap' : 'fb-lid'} style={flap ? undefined : { transform: `rotate(${open}deg)` }}>
            <path d="M-2 0 Q-4 -12 12 -16 Q66 -32 120 -16 Q136 -12 134 0 Q66 12 -2 0 Z" fill="#d3dae4" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
            <path d="M14 -9 Q66 -22 118 -9" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.7" />
            <path d="M52 -24 Q66 -42 80 -24" fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
            <path d="M52 -24 Q66 -42 80 -24" fill="none" stroke="#aab4c2" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        </g>
        {full && (
          <g transform="translate(160 60)">
            <circle r="16" fill="#5cc45a" stroke={INK} strokeWidth="3.5" />
            <path d="M-8 1 L-2 7 L9 -6" fill="none" stroke="#fff" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )}
      </svg>
      <Shout mood={mood === 'bah' ? 'bah' : null} W={W} top={signH + W * 0.4} />
    </motion.div>
  )
}

const BONE = '#f6f0df'

// Rubbish no emoji shows: a fish bone, a ball of paper, an open tin, an old shoe
function RubbishArt({ kind, size }) {
  const common = { viewBox: '0 0 100 100', width: size, height: size, style: { display: 'block', flexShrink: 0 }, 'aria-hidden': true }
  if (kind === 'graete') {
    const ribs = [36, 46, 56]
    return (
      <svg {...common}>
        <g transform="rotate(-16 50 50)" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 32 L28 50 L8 68 Q15 50 8 32 Z" fill={BONE} stroke={INK} strokeWidth="4.5" />
          <path d="M26 50 L68 50" stroke={INK} strokeWidth="12" />
          {ribs.map((x, i) => <path key={x} d={`M${x - 2} ${31 + i * 2} L${x + 2} ${69 - i * 2}`} stroke={INK} strokeWidth="11" />)}
          <path d="M62 29 Q95 33 95 50 Q95 67 62 71 Q71 50 62 29 Z" fill={BONE} stroke={INK} strokeWidth="4.5" />
          <path d="M26 50 L68 50" stroke={BONE} strokeWidth="5" />
          {ribs.map((x, i) => <path key={x} d={`M${x - 2} ${31 + i * 2} L${x + 2} ${69 - i * 2}`} stroke={BONE} strokeWidth="4.5" />)}
          <path d="M76 41 l9 9 M85 41 l-9 9" stroke={INK} strokeWidth="4" />
        </g>
      </svg>
    )
  }
  if (kind === 'papier') return (
    <svg {...common}>
      <path d="M18 44 L26 26 L38 30 L44 14 L60 20 L70 12 L80 30 L92 40 L84 56 L90 70 L72 76 L64 90 L46 82 L30 88 L26 70 L12 62 Z" fill="#fbf8ef" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M38 30 L52 40 L44 14 Z M52 40 L80 30 L84 56 L62 58 Z M26 70 L46 62 L46 82 L30 88 Z" fill="#ddd7c7" />
      <path d="M38 30 L52 40 L44 14 M52 40 L80 30 M52 40 L62 58 L84 56 M62 58 L72 76 M62 58 L46 62 L26 70 M46 62 L46 82 M46 62 L26 26 M18 44 L46 62" fill="none" stroke="#a39d8b" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M58 26 l10 -3 M60 32 l12 -3 M66 66 l10 -3 M30 50 l8 3 M32 76 l8 -2" fill="none" stroke="#4aa3ff" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
  if (kind === 'dose') return (
    <svg {...common}>
      <path d="M28 40 L31 82 Q51 93 73 82 L76 40 Z" fill="#b4bfca" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M29.5 52 Q52 63 75 52 L73.8 71 Q52 82 30.8 71 Z" fill="#e2574c" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M36 61 q6 4 0 8 M36 46 l1 30" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
      <ellipse cx="52" cy="40" rx="24" ry="8.5" fill="#566270" stroke={INK} strokeWidth="4.5" />
      {/* the lid, bent open, with its jagged edge */}
      <path d="M30 37 L20 14 L27 17 L30 10 L37 14 L42 7 L48 13 L55 8 L58 16 L66 14 L64 24 Q48 22 30 37 Z" fill="#dfe5ea" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
    </svg>
  )
  // an old shoe: the sole hangs loose at the toe, a patch, a lace undone
  return (
    <svg {...common}>
      <path d="M12 72 L12 30 Q12 20 24 20 L38 20 Q46 20 46 30 L47 44 Q62 47 78 54 Q91 60 91 71 Z" fill="#a8703f" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M8 72 L66 72 L92 84 Q88 90 78 88 L62 82 L18 84 Q8 84 8 76 Z" fill="#5b3a22" stroke={INK} strokeWidth="4.5" strokeLinejoin="round" />
      <path d="M66 72 L91 71 L92 84 Z" fill="#3b2a4f" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
      <path d="M72 72 l0 5 M79 72 l0 7 M86 72 l0 9" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path d="M16 27 Q29 34 43 27" fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <rect x="20" y="48" width="16" height="13" rx="2" fill="#e0b85c" stroke={INK} strokeWidth="3" transform="rotate(-8 28 54)" />
      <path d="M24 51 l0 7 M32 50 l0 7" stroke={INK} strokeWidth="2" strokeLinecap="round" transform="rotate(-8 28 54)" />
      <path d="M47 34 l11 -5 M48 42 l12 -3 M58 29 q12 2 8 16 q-2 8 4 10" fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" />
      <path d="M47 34 l11 -5 M48 42 l12 -3 M58 29 q12 2 8 16 q-2 8 4 10" fill="none" stroke="#fdf6e3" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  )
}

/** The picture of a thing: the app's art for an emoji, or a drawing of rubbish. */
export function ThingArt({ art, size }) {
  return art.startsWith('rubbish:') ? <RubbishArt kind={art.slice(8)} size={size} /> : <Art art={art} size={size} />
}

/**
 * A thing as it rides, flies or peeks out of a basket: its picture, wavy
 * stink lines for rubbish, a golden shine for the golden one.
 */
export function Thing({ thing, size, picked = false }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      {thing.golden && (
        <>
          <div className="fb-gold" aria-hidden="true" style={{ position: 'absolute', inset: -size * 0.14, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,214,66,0.95) 30%, rgba(255,201,60,0.55) 55%, rgba(255,201,60,0) 72%)' }} />
          {[[-0.06, 0.02, 0], [0.82, -0.08, -0.45], [0.86, 0.7, -0.9], [0.02, 0.76, -0.2]].map(([x, y, d]) => (
            <svg key={x} className="fb-twinkle" viewBox="0 0 20 20" width={size * 0.26} height={size * 0.26} aria-hidden="true"
              style={{ position: 'absolute', left: size * x, top: size * y, animationDelay: `${d}s`, zIndex: 1 }}>
              <path d="M10 0 L12.4 7.6 L20 10 L12.4 12.4 L10 20 L7.6 12.4 L0 10 L7.6 7.6 Z" fill="#fff6c4" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
            </svg>
          ))}
        </>
      )}
      {picked && <div className="fb-ring" aria-hidden="true" style={{ position: 'absolute', inset: -size * 0.08, borderRadius: '50%', border: '4px solid #ffc93c', boxShadow: `0 0 0 2.5px ${INK}, inset 0 0 0 2.5px ${INK}`, background: 'rgba(255,253,247,0.3)' }} />}
      <div style={{ position: 'relative', filter: thing.golden ? 'drop-shadow(0 0 3px #fff3b0) drop-shadow(0 0 5px #ffc93c)' : undefined }}>
        <ThingArt art={thing.art} size={size} />
      </div>
      {thing.rubbish && (
        <svg className="fb-stink" viewBox="0 0 60 30" width={size * 0.6} height={size * 0.3} aria-hidden="true"
          style={{ position: 'absolute', left: size * 0.2, top: -size * 0.2, overflow: 'visible' }} fill="none" stroke="#6fa32e" strokeWidth="4.5" strokeLinecap="round">
          <path d="M12 28 q-7 -7 0 -14 q7 -7 0 -14" /><path d="M30 28 q-7 -7 0 -14 q7 -7 0 -14" /><path d="M48 28 q-7 -7 0 -14 q7 -7 0 -14" />
        </svg>
      )}
    </div>
  )
}
