import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { Art, artSrc } from '../../components/play/index.js'
import { sfx } from '../../sfx.js'
import { INK } from '../px.js'
import './kessel.css'

// Zauberkessel: the pieces of the stage. Lumi in a witch's hat stirs a
// bubbling cauldron; typed letters fly in, and a finished word comes out
// alive with a puff.

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * The cauldron. `brew` is the colour of the potion, `cough` turns the steam
 * purple (a wrong letter), `splash` changes with every letter that lands.
 * `mouthRef` marks where letters fly in.
 */
export function Cauldron({ width = 220, brew = '#7be36b', cough = false, splash = 0, mouthRef, onTap }) {
  const steam = cough ? '#b27cff' : '#ffffff'
  return (
    <motion.div
      onPointerDown={onTap}
      animate={cough ? { rotate: [0, -4, 4, -3, 2, 0], y: [0, -6, 0] } : { rotate: 0, y: 0 }}
      transition={{ duration: 0.6 }}
      style={{ position: 'relative', width, height: width * 0.92, flexShrink: 0, cursor: 'pointer', transformOrigin: '50% 100%' }}>
      <svg viewBox="0 0 240 220" width={width} height={width * 0.92} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
        {/* steam */}
        {[70, 120, 165].map((x, i) => (
          <circle key={x} className="ks-steam" cx={x} cy={62} r={14 - i * 2} fill={steam} opacity={0.8}
            style={{ animationDelay: `${i * 0.7}s`, transition: 'fill .3s' }} />
        ))}
        {/* fire */}
        <rect x={62} y={196} width={116} height={14} rx={7} fill="#8a4f22" stroke={INK} strokeWidth={3} transform="rotate(-6 120 203)" />
        <rect x={62} y={196} width={116} height={14} rx={7} fill="#a8622c" stroke={INK} strokeWidth={3} transform="rotate(6 120 203)" />
        {[88, 120, 152].map((x, i) => (
          <g key={x} className="ks-flame" style={{ animationDelay: `${i * 0.17}s` }}>
            <path d={`M${x - 18} 200 Q${x - 20} 172 ${x} 150 Q${x + 20} 172 ${x + 18} 200 Z`} fill="#ff9a3c" stroke={INK} strokeWidth={2.5} />
            <path d={`M${x - 9} 199 Q${x - 10} 182 ${x} 170 Q${x + 10} 182 ${x + 9} 199 Z`} fill="#ffd34d" />
          </g>
        ))}
        {/* legs and pot */}
        <path d="M52 168 L40 196 L60 196 L70 176 Z M188 168 L200 196 L180 196 L170 176 Z" fill="#2c2440" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M24 92 Q14 188 120 194 Q226 188 216 92 Z" fill="#3b3355" stroke={INK} strokeWidth={5} strokeLinejoin="round" />
        <path d="M44 112 Q42 160 84 178" fill="none" stroke="#fff" strokeOpacity={0.22} strokeWidth={9} strokeLinecap="round" />
        {/* rim, potion and its bubbles */}
        <ellipse cx={120} cy={90} rx={104} ry={24} fill="#4a4168" stroke={INK} strokeWidth={5} />
        <ellipse cx={120} cy={92} rx={86} ry={15} fill={brew} style={{ transition: 'fill .5s' }} />
        <ellipse cx={104} cy={88} rx={40} ry={5} fill="#fff" opacity={0.35} />
        {[[80, 0], [118, 0.5], [150, 1.1], [100, 0.8], [136, 0.3]].map(([x, d]) => (
          <circle key={x} className="ks-bubble" cx={x} cy={92} r={6} fill={brew} stroke={INK} strokeWidth={2}
            style={{ animationDelay: `${d}s`, transition: 'fill .5s' }} />
        ))}
      </svg>
      {/* where letters fly in */}
      <div ref={mouthRef} aria-hidden="true" style={{ position: 'absolute', left: '35%', width: '30%', top: '34%', height: '10%' }} />
      {/* a splash for every letter that lands */}
      <AnimatePresence>
        {splash > 0 && !reduceMotion() && (
          <motion.div key={splash} aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '38%', width: 0, height: 0 }}
            exit={{ opacity: 0 }}>
            {[-2, -1, 0, 1, 2].map(i => (
              <motion.span key={i}
                initial={{ x: 0, y: 0, scale: 0.6, opacity: 1 }}
                animate={{ x: i * width * 0.09, y: [0, -width * 0.2, -width * 0.06], opacity: [1, 1, 0] }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ position: 'absolute', left: -7, top: -7, width: 14, height: 14, borderRadius: '50%', background: cough ? '#b27cff' : brew, border: `2px solid ${INK}` }} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** The witch's hat: a purple cone with a gold band and a star. */
function Hat({ size }) {
  return (
    <svg viewBox="0 0 100 80" width={size} height={size * 0.8} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <path d="M50 2 Q58 30 76 60 L24 60 Q40 32 50 2 Z" fill="#6f4fd8" stroke={INK} strokeWidth={4} strokeLinejoin="round" />
      <path d="M30 50 L70 50 L74 58 L26 58 Z" fill="#ffc93c" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <ellipse cx={50} cy={64} rx={46} ry={10} fill="#8e6cf0" stroke={INK} strokeWidth={4} />
      <path className="ks-twinkle" d="M50 20 l3 7 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="#ffd34d" stroke={INK} strokeWidth={1.5} />
    </svg>
  )
}

/**
 * Lumi with a witch's hat and a wand. The play kit's Critter cannot carry a
 * hat that moves along with it, so Lumi moves here as one piece.
 *   act: idle · stir (a letter went in) · cough (a wrong one) · cheer · hat (the hat jumps off)
 */
const ACTS = {
  idle:  { y: [0, -4, 0], transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
  stir:  { rotate: [0, 8, -6, 0], y: 0, transition: { duration: 0.45 } },
  cough: { rotate: [0, -10, 8, -6, 0], x: [0, -6, 4, -3, 0], y: 0, transition: { duration: 0.7 } },
  cheer: { y: [0, -40, 0, -14, 0], rotate: [0, 0, 360, 360, 360], transition: { duration: 1.1, ease: 'easeOut' } },
  hat:   { y: [0, -6, 0], rotate: 0, transition: { duration: 0.6 } },
}
export function WitchLumi({ size = 110, act = 'idle', beat = 0, wish, onTap }) {
  const still = reduceMotion()
  const happy = act === 'cheer' || act === 'hat'
  const controls = useAnimationControls()
  // `beat` changes with every new act, so the same act can play twice
  useEffect(() => {
    if (still) return
    // back to upright before the endless idle bob: a spin (cheer) ends at
    // 360°, and an idle that animated the turn would spin forever
    let live = true
    const idle = () => { if (!live) return; controls.set({ rotate: 0, x: 0 }); controls.start(ACTS.idle) }
    if (act === 'idle') idle()
    else controls.start(ACTS[act]).then(idle)
    return () => { live = false }
  }, [act, beat, still, controls])
  return (
    <motion.button type="button" onClick={onTap} aria-label="Lumi"
      animate={controls}
      style={{ all: 'unset', position: 'relative', width: size, height: size * 1.35, flexShrink: 0, cursor: 'pointer', transformOrigin: '50% 100%' }}>
      <div aria-hidden="true" style={{ position: 'absolute', bottom: -4, left: '20%', width: '60%', height: size * 0.08, borderRadius: '50%', background: 'rgba(42,27,61,0.2)' }} />
      <img src={artSrc('lumi', happy ? 'happy' : 'idle')} alt="" draggable={false}
        style={{ position: 'absolute', bottom: 0, left: 0, width: size, height: size, imageRendering: 'pixelated' }} />
      <motion.div
        animate={act === 'hat' && !still ? { y: [0, -size * 0.9, -size * 0.9, 0], rotate: [0, -20, 340, 360] } : { y: 0, rotate: act === 'cough' ? -12 : -6 }}
        transition={act === 'hat' ? { duration: 1.1, times: [0, 0.35, 0.6, 1], ease: 'easeInOut' } : { type: 'spring', stiffness: 200, damping: 10 }}
        style={{ position: 'absolute', left: size * 0.16, top: size * 0.02, width: size * 0.68 }}>
        <Hat size={size * 0.68} />
      </motion.div>
      <motion.div aria-hidden="true"
        animate={act === 'stir' || act === 'cheer' ? { rotate: [0, -30, 10, 0] } : { rotate: 0 }}
        transition={{ duration: 0.5 }}
        style={{ position: 'absolute', right: -size * 0.12, bottom: size * 0.18, transformOrigin: '20% 80%' }}>
        <Art art="🪄" size={size * 0.42} />
      </motion.div>
      {act === 'cough' && !still && (
        <motion.div aria-hidden="true" initial={{ opacity: 0.9, scale: 0.4, x: 0 }} animate={{ opacity: 0, scale: 1.6, x: size * 0.35, y: -size * 0.2 }}
          transition={{ duration: 0.8 }}
          style={{ position: 'absolute', right: -size * 0.05, top: size * 0.55, width: size * 0.3, height: size * 0.3, borderRadius: '50%', background: '#c9b3ff' }} />
      )}
      {wish}
    </motion.button>
  )
}

/** A puff of smoke, out of which the finished word steps. */
export function Puff({ size = 220 }) {
  if (reduceMotion()) return null
  const balls = [[-0.3, -0.1], [0.3, -0.12], [0, -0.32], [-0.18, 0.1], [0.2, 0.08], [-0.38, -0.36], [0.36, -0.34]]
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 4 }}>
      {balls.map(([x, y], i) => (
        <motion.div key={i}
          initial={{ x: 0, y: 0, scale: 0.2, opacity: 1 }}
          animate={{ x: x * size, y: y * size, scale: [0.2, 1.3, 1.6], opacity: [1, 1, 0] }}
          transition={{ duration: 1, delay: i * 0.03, ease: 'easeOut' }}
          style={{ position: 'absolute', left: -size * 0.16, top: -size * 0.16, width: size * 0.32, height: size * 0.32, borderRadius: '50%', background: '#fffdf7', border: `3px solid rgba(42,27,61,0.25)` }} />
      ))}
    </div>
  )
}

/**
 * The finished word, alive: an animal hops, a car drives, a bird flies.
 *   move: hop · drive · fly · swim · spin
 */
const MOVES = {
  hop:   { y: [0, -50, 0, -30, 0], scaleY: [1, 1.1, 0.85, 1.05, 1], transition: { duration: 1.2, delay: 0.3 } },
  drive: { x: [0, -40, 40, 0], rotate: [0, -4, 4, 0], transition: { duration: 1.4, delay: 0.3, ease: 'easeInOut' } },
  fly:   { y: [0, -60, -30, -70, 0], x: [0, 30, -30, 20, 0], rotate: [0, 10, -10, 6, 0], transition: { duration: 1.6, delay: 0.3 } },
  swim:  { x: [0, -30, 30, -20, 0], rotate: [0, -12, 12, -8, 0], transition: { duration: 1.4, delay: 0.3 } },
  spin:  { rotate: [0, 360], y: [0, -40, 0], transition: { duration: 1.1, delay: 0.3 } },
}
export function Alive({ art, size = 150, move = 'hop' }) {
  const still = reduceMotion()
  return (
    <motion.div aria-hidden="true"
      initial={{ scale: 0, y: size * 0.4, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 14 }}
      style={{ position: 'absolute', left: '50%', bottom: '50%', marginLeft: -size / 2, width: size, height: size, zIndex: 5, pointerEvents: 'none' }}>
      <motion.div animate={still ? {} : MOVES[move] ?? MOVES.hop} style={{ width: size, height: size, filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.25))' }}>
        <Art art={art} size={size} />
      </motion.div>
    </motion.div>
  )
}

/**
 * Letters flying from a key into the cauldron (or back out of it). They
 * fly above everything in screen coordinates, so the FitBox scale does not
 * matter.
 *   const [fliers, fly] = useFliers()
 *   fly(keyEl, mouthEl, 'K', ok)
 */
export function useFliers() {
  const [list, setList] = useState([])
  const fly = useCallback((from, to, char, ok) => {
    if (!from || !to || reduceMotion()) return
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect()
    const s = Math.max(36, Math.min(64, a.height))
    const id = Math.random()
    setList(l => [...l.slice(-5), {
      id, char, ok, s,
      x0: a.left + a.width / 2 - s / 2, y0: a.top + a.height / 2 - s / 2,
      x1: b.left + b.width / 2 - s / 2, y1: b.top + b.height / 2 - s / 2,
    }])
    setTimeout(() => setList(l => l.filter(f => f.id !== id)), ok ? 700 : 1500)
    sfx.whoosh()
  }, [])
  const node = typeof document === 'undefined' ? null : createPortal(
    <>{list.map(f => <Flier key={f.id} {...f} />)}</>, document.body)
  return [node, fly]
}

function Flier({ char, ok, s, x0, y0, x1, y1 }) {
  const top = Math.min(y0, y1) - 120
  // a wrong letter goes in, the cauldron coughs it up, and it tumbles away
  const out = { x: [x0, (x0 + x1) / 2, x1, x1 + 90, x1 + 160], y: [y0, top, y1, y1 - 140, y1 + 220], rotate: [0, 180, 360, 500, 720], scale: [1, 1, 0.6, 1, 0.8], opacity: [1, 1, 1, 1, 0] }
  const inn = { x: [x0, (x0 + x1) / 2, x1], y: [y0, top, y1], rotate: [0, 200, 360], scale: [1, 1.1, 0.3], opacity: [1, 1, 0.4] }
  return (
    <motion.div aria-hidden="true"
      initial={{ x: x0, y: y0 }}
      animate={ok ? inn : out}
      transition={{ duration: ok ? 0.55 : 1.3, ease: 'easeInOut', times: ok ? [0, 0.45, 1] : [0, 0.2, 0.4, 0.65, 1] }}
      style={{
        position: 'fixed', left: 0, top: 0, width: s, height: s, zIndex: 9999, pointerEvents: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%',
        background: ok ? '#ffd34d' : '#d8c4ff', border: `3px solid ${INK}`,
        fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: s * 0.55, color: INK,
        boxShadow: '0 0 18px 4px rgba(255,211,77,0.7)',
      }}>
      {char}
    </motion.div>
  )
}
