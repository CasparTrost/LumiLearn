import { useEffect, useId, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import Monster from './Monster.jsx'
import { MAX_SQUIRTS, hexOf } from './colors.js'
import { slotAt } from './layout.js'

/**
 * The pieces of the paint shower: the machine (glass tank, pipe, shower
 * head, tiled tray), the rain, the lever, the drain, the taps, the thought
 * bubble, the parade shelf and the water bucket. All drawn in SVG; the game
 * (PainterGame.jsx) places them.
 */
const INK = '#2a1b3d'
const METAL = '#c9d2e3'
const METAL_D = '#8f9bb5'
const ink = (w = 4) => ({ stroke: INK, strokeWidth: w, strokeLinejoin: 'round', strokeLinecap: 'round' })

// A drop of paint: on the taps, and as the recipe in a bubble
export function Drop({ hex, size = 28 }) {
  return (
    <svg viewBox="0 0 24 26" width={size} height={size * 1.08} aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      <path d="M12 2 C12 2 3 12.5 3 17 A9 9 0 0 0 21 17 C21 12.5 12 2 12 2Z" fill={hex} {...ink(2.4)} />
      <path d="M8 17 a4 4 0 0 0 3.5 3.6" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}

/**
 * Tank, pipe, shower head and tray, in a 240 × 400 box. `squirts` paints
 * are in the tank, mixed to `hex`; `slow` lets it run out as slowly as the
 * shower rains; `puddle` is the paint left on the tray.
 */
export function Machine({ squirts, hex, slow, puddle, wobble }) {
  const uid = `fdm${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const off = squirts ? 110 * (1 - (squirts / MAX_SQUIRTS) * 0.94) : 122
  // the first squirt into an empty tank shows its own colour at once; only
  // a mix changes colour softly
  const was = useRef(squirts)
  useEffect(() => { was.current = squirts })
  const blend = was.current === 0 ? 'none' : 'fill .3s'
  return (
    <svg viewBox="0 0 240 400" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <clipPath id={uid}><rect x="35" y="27" width="170" height="109" rx="19" /></clipPath>
      </defs>
      {/* the tiled wall of the shower */}
      <rect x="24" y="168" width="192" height="210" rx="14" fill="#e6f6fc" {...ink()} />
      {[1, 2, 3, 4, 5].map(i => <path key={`v${i}`} d={`M${24 + i * 32} 170 V376`} stroke="#bfe2f0" strokeWidth="3" />)}
      {[1, 2, 3, 4, 5].map(i => <path key={`h${i}`} d={`M26 ${168 + i * 35} H214`} stroke="#bfe2f0" strokeWidth="3" />)}
      {/* the tray, with what ran off */}
      <rect x="10" y="366" width="220" height="27" rx="12" fill="#cfd6e4" {...ink()} />
      <rect x="22" y="371" width="196" height="8" rx="4" fill="#aab4c9" />
      {puddle && <rect x="34" y="369" width="172" height="11" rx="5.5" fill={puddle} {...ink(2.5)} />}
      {/* pipes: to the lever on the right, to the drain on the left */}
      <rect x="132" y="148" width="112" height="14" fill={METAL} {...ink()} />
      <rect x="-6" y="112" width="40" height="14" fill={METAL} {...ink()} />
      {/* neck and shower head */}
      <rect x="106" y="138" width="28" height="34" fill={METAL} {...ink()} />
      <rect x="100" y="148" width="40" height="14" rx="4" fill={METAL_D} {...ink()} />
      <path d="M98 170 H142 L178 197 H62Z" fill={METAL} {...ink()} />
      <rect x="56" y="195" width="128" height="12" rx="6" fill={METAL_D} {...ink()} />
      {[72, 88, 104, 120, 136, 152, 168].map(x => <circle key={x} cx={x} cy="201" r="2.4" fill={INK} />)}
      {/* the glass tank */}
      <g className={wobble ? 'fd-wobble' : undefined} key={wobble}>
        <rect x="30" y="22" width="180" height="118" rx="24" fill="rgba(188,214,232,0.85)" {...ink(5)} />
        <g clipPath={`url(#${uid})`}>
          <motion.g initial={false} animate={{ y: off }} transition={{ duration: slow ? 1.25 : 0.35, ease: slow ? 'linear' : 'easeOut' }}>
            <rect x="30" y="28" width="180" height="124" fill={hex} style={{ transition: blend }} />
            <path className="fd-wave" d="M-10 28 q10 -6 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V36 H-10Z"
              fill={hex} stroke="rgba(42,27,61,0.45)" strokeWidth="2" style={{ transition: blend }} />
            {[[66, 56, 0], [118, 60, 0.7], [164, 55, 1.3]].map(([cx, cy, d]) => (
              <circle key={cx} className="fd-fizz" cx={cx} cy={cy} r="4.5" fill="rgba(255,255,255,0.55)" stroke="rgba(42,27,61,0.3)" strokeWidth="1.5" style={{ animationDelay: `${d}s` }} />
            ))}
          </motion.g>
        </g>
        {[1, 2].map(i => <path key={i} d={`M36 ${136 - i * 34.5} h12`} stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.5" />)}
        <path d="M190 44 V96" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.75" />
        <path d="M190 108 V116" stroke="#fff" strokeWidth="6" strokeLinecap="round" opacity="0.75" />
        <rect x="22" y="12" width="196" height="16" rx="8" fill={METAL} {...ink()} />
        <rect x="70" y="14" width="100" height="7" rx="3.5" fill={INK} opacity="0.75" />
      </g>
    </svg>
  )
}

// Drops 86 apart in every column, falling 172: the rain never jumps
const COLUMNS = [66, 80, 93, 107, 120, 133, 147, 160, 174]
const SPLASH = [[-46, -30], [-30, -46], [-10, -52], [12, -52], [32, -44], [48, -28]]

/** What comes out of the shower head, over the monster: paint, water or glitter. */
export function Rain({ kind = 'paint', hex }) {
  const uid = `fdr${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const fill = kind === 'water' ? '#8fd3ff' : hex
  return (
    <svg viewBox="0 0 240 400" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs><clipPath id={uid}><rect x="40" y="207" width="160" height="164" /></clipPath></defs>
      <g clipPath={`url(#${uid})`}>
        {COLUMNS.map((x, c) => (
          <g key={x} className="fd-rain">
            {[-1, 0, 1, 2, 3].map(k => {
              const y = 104 + k * 86 + ((c * 37) % 86) - 43
              return kind === 'glitter'
                ? <path key={k} d="M0 -9 L2.6 -2.8 L9 -2.8 L3.8 1.6 L5.6 8 L0 4.2 L-5.6 8 L-3.8 1.6 L-9 -2.8 L-2.6 -2.8Z" transform={`translate(${x} ${y})`}
                    fill={['#ffd428', '#ff7fb6', '#96d6ff'][(c + k) % 3]} {...ink(1.6)} />
                : <rect key={k} x={x - 4.5} y={y} width="9" height={kind === 'water' ? 20 : 30} rx="4.5" fill={fill} {...ink(1.8)} />
            })}
          </g>
        ))}
      </g>
      {kind !== 'glitter' && SPLASH.map(([dx, dy], i) => (
        <circle key={i} className="fd-splash" cx={120 + dx * 0.9} cy="246" r="6" fill={fill} {...ink(1.8)}
          style={{ '--dx': `${dx}px`, '--dy': `${dy}px`, animationDelay: `${(i % 3) * 0.16}s` }} />
      ))}
    </svg>
  )
}

/** The big lever that opens the shower. state: off (tank empty) · ready · down */
export function Lever({ state }) {
  const down = state === 'down', off = state === 'off'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      {state === 'ready' && <circle className="fd-glow" cx="60" cy="62" r="56" fill="#ffe27a" opacity="0.6" />}
      <rect x="16" y="68" width="88" height="42" rx="13" fill={METAL} {...ink()} />
      <rect x="44" y="76" width="32" height="12" rx="6" fill={INK} opacity="0.8" />
      <g style={{ transform: `rotate(${down ? 62 : -30}deg)`, transformOrigin: '60px 86px', transition: 'transform .22s ease-in' }}>
        <path d="M60 86 V34" stroke={INK} strokeWidth="15" strokeLinecap="round" />
        <path d="M60 86 V34" stroke="#f3f5fa" strokeWidth="8" strokeLinecap="round" />
        <circle cx="60" cy="26" r="20" fill={off ? '#b9bfcc' : '#5cc45a'} {...ink()} />
        <ellipse cx="53" cy="19" rx="7" ry="4.5" fill="#fff" opacity="0.6" transform="rotate(-30 53 19)" />
      </g>
      <circle cx="60" cy="86" r="8" fill={METAL_D} {...ink(3)} />
    </svg>
  )
}

/** The wheel on the tank's side pipe that lets the paint out again. */
export function Drain({ on, turn }) {
  return (
    <svg viewBox="0 0 64 64" width="100%" height="100%" style={{ display: 'block', overflow: 'visible', opacity: on ? 1 : 0.45, transition: 'opacity .2s' }} aria-hidden="true">
      <path d="M10 44 V58" stroke={INK} strokeWidth="15" strokeLinecap="round" />
      <path d="M10 44 V58" stroke={METAL} strokeWidth="8" strokeLinecap="round" />
      <g style={{ transform: `rotate(${turn * 180}deg)`, transformOrigin: '34px 30px', transition: 'transform .5s ease-out' }}>
        <circle cx="34" cy="30" r="23" fill="#6fa8e6" {...ink()} />
        <circle cx="34" cy="30" r="13" fill="#e6f6fc" {...ink(3)} />
        <path d="M34 9 V51 M13 30 H55" stroke={INK} strokeWidth="4" strokeLinecap="round" />
        <circle cx="34" cy="30" r="6" fill="#6fa8e6" {...ink(3)} />
      </g>
    </svg>
  )
}

/** A paint tap: a pump bottle full of one paint. */
export function TapArt({ hex }) {
  return (
    <svg viewBox="0 0 100 110" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <rect x="43" y="10" width="14" height="20" fill={METAL} {...ink()} />
      <path d="M30 6 H62 Q70 6 70 14 H30Z" fill={METAL_D} {...ink()} />
      <rect x="35" y="26" width="30" height="13" rx="4" fill={METAL} {...ink()} />
      <rect x="12" y="37" width="76" height="68" rx="20" fill={hex} {...ink(4.5)} />
      <path d="M24 56 V84" stroke="#fff" strokeWidth="7" strokeLinecap="round" opacity="0.55" />
      <path d="M50 52 C50 52 37 67 37 75 A13 13 0 0 0 63 75 C63 67 50 52 50 52Z" fill="rgba(255,255,255,0.35)" stroke="rgba(42,27,61,0.35)" strokeWidth="2.5" />
    </svg>
  )
}

/**
 * The thought bubble: the monster in the colour it wants to be, and (when
 * `recipe` is given) the paints that make it, as drops. It moves to `rect`.
 */
export function Bubble({ rect, kind, target, recipe, tail = 'left', big, label, delay = 0 }) {
  const reduce = useReducedMotion()
  const side = Math.min(rect.w, rect.h)
  const inner = side * (recipe ? 0.58 : 0.72)
  const dot = (size, pos) => (
    <span aria-hidden="true" style={{ position: 'absolute', width: size, height: size, borderRadius: '50%', background: '#fffdf7', border: `3px solid ${INK}`, boxSizing: 'border-box', ...pos }} />
  )
  return (
    <motion.div initial={{ opacity: 0, scale: 0.4, left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      animate={{ opacity: 1, scale: 1, left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
      exit={{ opacity: 0, scale: 0.4, transition: { duration: 0.18 } }}
      transition={reduce ? { duration: 0.01, delay } : { type: 'spring', stiffness: 260, damping: 22, delay }}
      role="img" aria-label={label} style={{ position: 'absolute', zIndex: big ? 9 : 6, pointerEvents: 'none' }}>
      {!big && tail === 'left' && <>{dot(side * 0.16, { left: -side * 0.1, bottom: side * 0.2 })}{dot(side * 0.1, { left: -side * 0.2, bottom: side * 0.12 })}</>}
      {!big && tail === 'right' && <>{dot(side * 0.18, { right: -side * 0.1, top: side * 0.26 })}{dot(side * 0.11, { right: -side * 0.21, top: side * 0.36 })}</>}
      {!big && tail === 'down' && <>{dot(side * 0.18, { left: side * 0.36, bottom: -side * 0.12 })}{dot(side * 0.11, { left: side * 0.46, bottom: -side * 0.24 })}</>}
      <div style={{
        position: 'absolute', inset: 0, borderRadius: '44% 44% 44% 44% / 46% 46% 46% 46%', background: '#fffdf7', border: `${side > 120 ? 4 : 3}px solid ${INK}`,
        boxShadow: '0 5px 0 rgba(42,27,61,0.28)', boxSizing: 'border-box',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: side * 0.02,
      }}>
        <div style={{ width: side * 0.86, height: side * 0.86, position: 'absolute', borderRadius: '50%', background: 'radial-gradient(circle, #e8e2f6 0%, #f3eefb 62%, rgba(255,253,247,0) 72%)' }} />
        <Monster kind={kind} color={target} size={inner} mood="happy" wipe={0} style={{ zIndex: 1 }} />
        {recipe && (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 320, damping: 14 }}
            style={{ display: 'flex', gap: side * 0.03, zIndex: 1, padding: `${side * 0.02}px ${side * 0.06}px`, borderRadius: 99, background: '#fffdf7', border: `2px solid ${INK}` }}>
            {recipe.map(p => <Drop key={p} hex={hexOf(p)} size={side * 0.17} />)}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}

/**
 * The parade: wooden boards where the monsters of the level collect. Empty
 * places wait as dashed rings; a monster that is poked wiggles.
 */
export function Shelf({ shelf, total, parade, party, poked, onPoke }) {
  const rows = Array.from({ length: shelf.rows }, (_, r) => r)
  const perRow = shelf.cols
  return (
    <>
      {rows.map(r => {
        const inRow = Math.min(perRow, total - r * perRow)
        return (
          <div key={r} aria-hidden="true" style={{
            position: 'absolute', left: shelf.x - 10, top: shelf.y + r * (shelf.slot + shelf.pad) + shelf.slot, width: inRow * shelf.slot + 20, height: Math.max(9, Math.min(12, shelf.pad - 2)),
            background: '#b9783f', border: `2.5px solid ${INK}`, borderRadius: 6, boxSizing: 'border-box', boxShadow: '0 3px 0 rgba(42,27,61,0.25)',
          }} />
        )
      })}
      {Array.from({ length: total }, (_, i) => {
        const at = slotAt(shelf, i), m = parade[i]
        if (!m) {
          return <span key={i} aria-hidden="true" style={{
            position: 'absolute', left: at.x + at.size * 0.2, top: at.y + at.size * 0.3, width: at.size * 0.6, height: at.size * 0.6, borderRadius: '50%',
            border: '3px dashed rgba(42,27,61,0.3)', boxSizing: 'border-box',
          }} />
        }
        return (
          <button key={i} type="button" className="fd-btn" aria-label={`Monster in ${m.label}`} onClick={() => onPoke(i)}
            style={{ left: at.x, top: at.y, width: at.size, height: at.size }}>
            <div key={poked?.i === i ? poked.n : 'still'} className={party ? 'fd-dance' : poked?.i === i ? 'fd-wiggle' : undefined}
              style={{ animationDelay: party ? `${(i % 4) * -0.2}s` : undefined }}>
              <Monster kind={m.kind} color={m.color} size={at.size} mood={party || poked?.i === i ? 'happy' : 'idle'} wipe={0} />
            </div>
          </button>
        )
      })}
    </>
  )
}

/** The bucket of water that washes a monster grey again. */
export function Bucket({ size }) {
  return (
    <motion.div aria-hidden="true" initial={{ x: -size * 1.2, y: -size * 0.3, rotate: 0, opacity: 0 }}
      animate={{ x: [-size * 1.2, 0, 0, 0], y: [-size * 0.3, 0, 0, 0], rotate: [0, 0, 118, 118], opacity: [0, 1, 1, 1] }}
      exit={{ x: -size * 1.2, opacity: 0, rotate: 0, transition: { duration: 0.3 } }}
      transition={{ duration: 0.7, times: [0, 0.4, 0.75, 1] }}
      style={{ width: size, height: size, transformOrigin: '70% 40%' }}>
      <svg viewBox="0 0 60 60" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }}>
        <path d="M10 22 Q30 -6 50 22" fill="none" {...ink(3.5)} />
        <path d="M8 20 H52 L46 54 H14Z" fill="#7fb2e8" {...ink()} />
        <ellipse cx="30" cy="20" rx="22" ry="5" fill="#bfe6ff" {...ink(3)} />
        <path d="M17 30 V46" stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
      </svg>
    </motion.div>
  )
}
