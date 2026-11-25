import { useEffect } from 'react'
import { animate, motion, useAnimationControls, useMotionValue, useTransform } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import './frosch.css'

// Frosch-Hüpfer: the pieces of the pond — the water in its meadow, lily
// pads, rings and splashes, the frog's tongue, the duck.

const INK = '#2a1b3d'

/** The pond: water with gentle waves and a sandy shore, grass all around. */
export function Water({ box, wide }) {
  const r = wide ? Math.min(box.h * 0.2, 110) : 34
  // a pond, not a pool: no two corners alike
  const round = `${r * 1.25}px ${r * 0.9}px ${r * 1.15}px ${r}px / ${r}px ${r * 1.2}px ${r * 0.9}px ${r * 1.3}px`
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, boxSizing: 'border-box',
      borderRadius: round, border: `4px solid ${INK}`, overflow: 'hidden', containerType: 'inline-size',
      background: 'linear-gradient(180deg, #6fd0f5 0%, #3fa6de 100%)',
      boxShadow: 'inset 0 10px 0 rgba(255,255,255,0.22), 0 0 0 7px #ecd791, 0 0 0 10px rgba(42,27,61,0.14)',
    }}>
      <svg className="fr-wave" aria-hidden="true" width="100%" height="100%" style={{ position: 'absolute', left: 0, top: 0, width: 'calc(100% + 40px)' }}>
        <defs>
          <pattern id="fr-waves" width="160" height="84" patternUnits="userSpaceOnUse">
            <path d="M8 22 q 14 -9 28 0 t 28 0" fill="none" stroke="#fff" strokeOpacity="0.3" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M92 64 q 12 -8 24 0 t 24 0" fill="none" stroke="#fff" strokeOpacity="0.2" strokeWidth="3.5" strokeLinecap="round" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fr-waves)" />
      </svg>
      {/* fish, deep down: only their shadows glide by */}
      {[[0.22, 26, 0, 1], [0.8, 34, -13, -1], [0.5, 30, -22, 1]].map(([y, dur, delay, dir], i) => (
        <div key={i} className={dir > 0 ? 'fr-fish' : 'fr-fish fr-fish-back'} style={{ position: 'absolute', left: 0, top: `${y * 100}%`, animationDuration: `${dur}s`, animationDelay: `${delay}s` }}>
          <svg viewBox="0 0 60 26" width={wide ? 58 : 46} height={wide ? 25 : 20} style={{ display: 'block', transform: dir > 0 ? undefined : 'scaleX(-1)' }}>
            <path d="M2 13 L14 4 L14 9 Q30 -2 50 8 Q58 12 58 13 Q58 14 50 18 Q30 28 14 17 L14 22 Z" fill="#1c5f9e" opacity="0.2" />
          </svg>
        </div>
      ))}
    </div>
  )
}

/** Grass tufts, flowers and reeds around the pond; nothing here can be tapped. */
export function Greenery({ L }) {
  const { w, h, water: W } = L
  const spots = L.wide
    ? [[W.x * 0.3, h * 0.36, 'tuft'], [W.x * 0.72, h * 0.9, 'flower', '#ff8fb8'], [W.x * 0.25, h * 0.86, 'tuft'],
       [w - (w - W.x - W.w) * 0.25, h * 0.92, 'flower', '#fffdf7'], [w - (w - W.x - W.w) * 0.8, h * 0.93, 'tuft'],
       [W.x + W.w * 0.3, h - 5, 'tuft'], [W.x + W.w * 0.72, h - 4, 'flower', '#ffd34d'], [w - 22, W.y + 30, 'tuft']]
    : [[26, h - 12, 'flower', '#ff8fb8'], [w * 0.26, h - 6, 'tuft'], [w - 30, W.y - 16, 'tuft'], [22, W.y - 14, 'flower', '#fffdf7']]
  const reeds = L.wide
    ? [[W.x + W.w * 0.1, W.y + 16, 1], [W.x + W.w * 0.9, W.y + W.h - 4, 0.9]]
    : [[W.x + 22, W.y + W.h * 0.3, 0.8], [W.x + W.w - 22, W.y + W.h * 0.74, 0.8]]
  return (
    <svg aria-hidden="true" width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
      {spots.map(([x, y, kind, color], i) => (kind === 'tuft'
        ? <path key={i} transform={`translate(${x} ${y})`} d="M-14 0 Q-12 -22 -5 -30 Q-6 -14 0 0 Q2 -26 9 -33 Q6 -12 14 0 Z" fill="#4f9e3a" opacity="0.85" />
        : <g key={i} transform={`translate(${x} ${y})`}>
            <rect x="-2" y="-26" width="4" height="26" fill="#3f9a3a" />
            {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-35" rx="5.5" ry="9" fill={color} stroke={INK} strokeWidth="1.5" transform={`rotate(${a} 0 -26)`} />)}
            <circle cx="0" cy="-26" r="5" fill="#ffd84a" stroke={INK} strokeWidth="1.5" />
          </g>))}
      {reeds.map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <g className="fr-sway">
            {[[-12, -54, -6], [0, -72, 2], [12, -46, 8]].map(([dx, top, lean]) => (
              <g key={dx}>
                <path d={`M${dx} 6 Q${dx + lean * 0.4} ${top / 2} ${dx + lean} ${top}`} stroke="#3f8f3a" strokeWidth="4" fill="none" strokeLinecap="round" />
                <rect x={dx + lean - 5} y={top - 4} width="10" height="24" rx="5" fill="#8a5a33" stroke={INK} strokeWidth="2" />
              </g>
            ))}
            <path d="M-22 6 Q-24 -18 -30 -30 M22 6 Q26 -14 32 -24" stroke="#4fae4a" strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>
        </g>
      ))}
    </svg>
  )
}

/**
 * A lily pad, round with its notch, the syllable written on its front rim
 * (the frog sits on the back half). `bump` counts landings: the pad dips
 * and springs back. `dip` counts wrong taps: it goes under with a few
 * bubbles and comes up again. `lit`: the frog has been here. `glow`: this
 * one is next (the help after two misses, the duck's hint).
 */
export function Pad({ w, h, text, lit = false, glow = false, bump = 0, dip = 0, flower = false, reduce = false }) {
  const controls = useAnimationControls()
  useEffect(() => {
    if (!bump || reduce) return
    controls.start({ y: [0, h * 0.14, -h * 0.04, 0], scaleY: [1, 0.9, 1.04, 1], transition: { duration: 0.42 } })
  }, [bump]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!dip) return
    controls.start(reduce
      ? { opacity: [1, 0.35, 1], transition: { duration: 0.8 } }
      : { y: [0, h * 0.34, h * 0.34, 0], scale: [1, 0.78, 0.78, 1], opacity: [1, 0.3, 0.3, 1], transition: { duration: 1, times: [0, 0.22, 0.6, 1] } })
  }, [dip]) // eslint-disable-line react-hooks/exhaustive-deps
  const size = text ? Math.min(h * 0.4, (w * 1.08) / Math.max(2.4, text.length)) : 0
  return (
    <div style={{ position: 'relative', width: w, height: h }}>
      {dip > 0 && !reduce && <Bubbles key={dip} w={w} h={h} />}
      <motion.div animate={controls} className={glow ? 'fr-glow' : undefined} style={{ position: 'absolute', inset: 0, borderRadius: '50%' }}>
        <svg viewBox="0 0 100 62" width={w} height={h} aria-hidden="true" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <ellipse cx="50" cy="36" rx="49" ry="28" fill="#1f6fb2" opacity="0.35" />
          <path d="M50 30 L63 4 A48 29 0 1 1 37 4 Z" fill={lit ? '#b9ec6b' : '#7ccf5a'} stroke={glow ? '#ffb300' : INK} strokeWidth={glow ? 5 : 3.5} strokeLinejoin="round" />
          <path d="M50 30 L20 42 M50 30 L80 42 M50 30 L28 18 M50 30 L72 18" stroke="#4f9e3a" strokeWidth="2.5" strokeLinecap="round" opacity="0.55" />
          {flower && <g transform="translate(80 14)">
            {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx="0" cy="-7" rx="4.5" ry="8" fill="#ff8fb8" stroke={INK} strokeWidth="1.5" transform={`rotate(${a})`} />)}
            <circle r="4" fill="#ffd34d" stroke={INK} strokeWidth="1.5" />
          </g>}
        </svg>
        {text && (
          <span style={{
            position: 'absolute', left: 0, right: 0, bottom: h * 0.09, textAlign: 'center',
            fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: size, lineHeight: 1, letterSpacing: 0.5,
            color: INK, textShadow: '0 2px 0 rgba(255,255,255,0.55)', whiteSpace: 'nowrap',
          }}>{text}</span>
        )}
      </motion.div>
    </div>
  )
}

function Bubbles({ w, h }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: w / 2, top: h / 2, pointerEvents: 'none' }}>
      {[-0.22, 0.05, 0.26].map((dx, i) => (
        <motion.div key={i} initial={{ x: dx * w, y: 0, scale: 0.4, opacity: 0 }}
          animate={{ y: [0, -h * 0.5, -h * 0.9], scale: [0.4, 1, 1.2], opacity: [0, 0.9, 0] }}
          transition={{ duration: 0.8, delay: 0.15 + i * 0.12 }}
          style={{ position: 'absolute', width: 12, height: 12, marginLeft: -6, borderRadius: '50%', border: '2.5px solid #fff', background: 'rgba(255,255,255,0.3)' }} />
      ))}
    </div>
  )
}

/** Rings where the next hop would land. Gold when the duck points here. */
export function HopSpot({ pt, w, hint = false }) {
  const h = w * 0.5
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: pt.x - w / 2, top: pt.y - h / 2, width: w, height: h, pointerEvents: 'none' }}>
      {hint && <div className="fr-glow" style={{ position: 'absolute', inset: '14%', borderRadius: '50%', border: '5px solid #ffc93c', background: 'rgba(255,201,60,0.3)' }} />}
      {[0, 1.3].map(d => (
        <div key={d} className="fr-ripple" style={{
          position: 'absolute', inset: 0, borderRadius: '50%', animationDelay: `-${d}s`,
          border: `${hint ? 6 : 4.5}px solid ${hint ? '#ffc93c' : '#fff'}`, opacity: hint ? 1 : 0.85,
        }} />
      ))}
    </div>
  )
}

/** One ring spreading on the water: something landed here. */
export function Ring({ x, y, size = 80, onDone }) {
  return (
    <motion.div aria-hidden="true" initial={{ scale: 0.5, opacity: 0.85 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: 0.75, ease: 'easeOut' }}
      onAnimationComplete={onDone}
      style={{ position: 'absolute', left: x - size / 2, top: y - size * 0.24, width: size, height: size * 0.48, borderRadius: '50%', border: '3.5px solid #fff', pointerEvents: 'none' }} />
  )
}

/** Splash: rings and drops where the frog went in. */
export function Splash({ x, y, size = 90, onDone }) {
  const s = size / 90
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, pointerEvents: 'none' }}>
      {[0, 0.16].map(d => (
        <motion.div key={d} initial={{ scale: 0.3, opacity: 0.95 }} animate={{ scale: 2.6, opacity: 0 }} transition={{ duration: 0.95, delay: d, ease: 'easeOut' }}
          onAnimationComplete={d ? onDone : undefined}
          style={{ position: 'absolute', left: -42 * s, top: -18 * s, width: 84 * s, height: 36 * s, borderRadius: '50%', border: '4px solid #fff' }} />
      ))}
      {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map(i => (
        <motion.div key={i} initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: i * 17 * s, y: [0, (-66 + Math.abs(i) * 11) * s, 14 * s], opacity: [1, 1, 0], scale: [1, 1.1, 0.7] }}
          transition={{ duration: 0.75, ease: 'easeOut' }}
          style={{ position: 'absolute', left: -6, top: -8, width: 12 * s, height: 15 * s, borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', background: '#e6f7ff', border: '2px solid #2a7fc0' }} />
      ))}
    </div>
  )
}

/** Drops flying off a frog that shakes itself dry. */
export function Drops({ x, y, size = 90, onDone }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: x, top: y - size * 0.45, width: 0, height: 0, pointerEvents: 'none' }}>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + 0.3, d = size * (0.7 + (i % 3) * 0.14)
        return (
          <motion.div key={i} initial={{ x: 0, y: 0, opacity: 1 }} animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d * 0.7 + 10, opacity: 0 }}
            transition={{ duration: 0.55, delay: (i % 4) * 0.07, ease: 'easeOut' }} onAnimationComplete={i === 9 ? onDone : undefined}
            style={{ position: 'absolute', left: -4, top: -5, width: 8, height: 10, borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', background: '#e6f7ff', border: '2px solid #2a7fc0' }} />
        )
      })}
    </div>
  )
}

/**
 * The frog's tongue: out to the fly at (dx, dy) from its mouth in a blink
 * and back again, the fly stuck to its tip.
 */
export function Tongue({ dx, dy, fly = 36, onDone }) {
  const p = useMotionValue(0)
  const x2 = useTransform(p, v => dx * v), y2 = useTransform(p, v => dy * v)
  const fx = useTransform(p, v => dx * v - fly / 2), fy = useTransform(p, v => dy * v - fly / 2)
  useEffect(() => {
    const a = animate(p, [0, 1, 1, 0], { duration: 0.34, times: [0, 0.3, 0.45, 1], ease: 'easeOut', onComplete: onDone })
    return () => a.stop()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <svg aria-hidden="true" width="1" height="1" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
        <motion.line x1="0" y1="0" x2={x2} y2={y2} stroke={INK} strokeWidth="11" strokeLinecap="round" />
        <motion.line x1="0" y1="0" x2={x2} y2={y2} stroke="#ff6b9a" strokeWidth="6.5" strokeLinecap="round" />
      </svg>
      <motion.div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, x: fx, y: fy, pointerEvents: 'none' }}>
        <Art art="🪰" size={fly} />
      </motion.div>
    </>
  )
}

// The duck is drawn in a box of 130 × 150 with its feet at (45, 148) and
// its bill to the right. Bent down to peck, the tip of the bill is here:
export const DUCK_PECK = { x: 71 / 150, y: -13 / 150 }

/**
 * The duck. It waddles up when a child waits long, and taps what comes next
 * with its bill (a friend of the frog: a stork would eat it). Placed by its
 * feet; `peck` counts its pecks.
 */
export function Duck({ size, flip = false, walking = false, peck = 0, reduce = false }) {
  const k = size / 150
  const foot = (x, cls) => (
    <g className={walking && !reduce ? cls : undefined} style={{ transformBox: 'view-box', transformOrigin: `${x}px 136px` }}>
      <path d={`M${x} 134 L${x} 145 M${x - 4} 148 L${x + 11} 148 L${x + 1} 143 Z`} stroke={INK} strokeWidth="5.5" fill="#f59a23" strokeLinecap="round" strokeLinejoin="round" />
      <path d={`M${x} 134 L${x} 145`} stroke="#f59a23" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  )
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: -45 * k, top: -148 * k, width: 130 * k, height: 150 * k, transform: flip ? 'scaleX(-1)' : undefined, transformOrigin: `${45 * k}px 50%`, pointerEvents: 'none' }}>
      <div className={walking && !reduce ? 'fr-strut' : undefined} style={{ position: 'absolute', inset: 0 }}>
        <svg viewBox="0 0 130 150" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <ellipse cx="48" cy="149" rx="30" ry="4.5" fill="rgba(20,40,80,0.2)" />
          {foot(38, 'fr-leg-a')}
          {foot(54, 'fr-leg-b')}
          <path d="M14 112 Q4 98 8 92 Q18 100 30 104 Z" fill="#fff6d8" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <ellipse cx="48" cy="116" rx="36" ry="22" fill="#fff6d8" stroke={INK} strokeWidth="3.5" />
          <path d="M26 110 Q44 98 62 108 Q52 126 32 122 Z" fill="#f3e6bf" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
        <motion.div key={peck} animate={peck && !reduce ? { rotate: [0, 55, 42, 55, 0] } : { rotate: peck && reduce ? 55 : 0 }}
          transition={{ duration: 0.9, times: [0, 0.28, 0.45, 0.62, 1], ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, transformOrigin: `${72 * k}px ${110 * k}px` }}>
          <svg viewBox="0 0 130 150" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
            <path d="M66 112 Q64 96 76 88" stroke={INK} strokeWidth="21" fill="none" strokeLinecap="round" />
            <path d="M94 80 Q112 80 119 88 Q110 95 94 93 Z" fill="#f59a23" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <circle cx="82" cy="82" r="16" fill="#fff6d8" stroke={INK} strokeWidth="3.5" />
            <path d="M66 112 Q64 96 76 88" stroke="#fff6d8" strokeWidth="14" fill="none" strokeLinecap="round" />
            <circle cx="87" cy="78" r="2.6" fill={INK} />
            <circle cx="79" cy="86" r="3.5" fill="#ffb3c1" opacity="0.8" />
          </svg>
        </motion.div>
      </div>
    </div>
  )
}
