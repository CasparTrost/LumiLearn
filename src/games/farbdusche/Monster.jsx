import { useId, useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { hexOf, isDark } from './colors.js'

/**
 * The monsters of the paint shower, drawn so they can take any colour.
 *
 *   <Monster kind="blob" color="orange" size={160} mood="happy" />
 *
 * `color` is a colour id from colors.js, or null for a monster that has no
 * colour yet (pale and hatched, like a page of a colouring book, so it is
 * neither the white nor the grey a monster may wish for). When `color`
 * changes, the new coat runs down over the old one from the head to the
 * feet. `mood` moves the face: idle · up · down · side · happy · no · wet.
 */
const INK = '#2a1b3d'
const CREAM = '#fff3d6'

// 14 spikes around (60, 64): the fuzzy one
const FUZZ = Array.from({ length: 28 }, (_, i) => {
  const a = (i / 28) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 39 : 49
  return `${i ? 'L' : 'M'}${(60 + Math.cos(a) * r).toFixed(1)} ${(64 + Math.sin(a) * r * 0.92).toFixed(1)}`
}).join(' ') + 'Z'

const foot = (cx, cy = 106) => ({ cx, cy, rx: 12, ry: 7 })

// body: the outline; under: parts in the coat's colour behind the body
// (ellipses, or rects with a turn); horns: cream bits; eyes: [x, y, r];
// mouth: [x, y]
const SHAPES = {
  blob: {
    body: 'M60 22 C90 22 104 46 103 70 C102 96 84 106 60 106 C36 106 18 96 17 70 C16 46 30 22 60 22Z',
    under: [foot(42), foot(78)],
    horns: ['M36 34 L27 10 L50 25Z', 'M84 34 L93 10 L70 25Z'],
    spots: [[86, 86, 5], [93, 72, 3], [80, 96, 3]],
    eyes: [[46, 58, 11], [74, 58, 11]], mouth: [60, 82],
  },
  cyclops: {
    body: 'M60 18 C84 18 94 46 94 72 C94 98 80 107 60 107 C40 107 26 98 26 72 C26 46 36 18 60 18Z',
    under: [foot(47, 107), foot(73, 107), { cx: 22, cy: 74, rx: 9, ry: 6 }, { cx: 98, cy: 74, rx: 9, ry: 6 }],
    antenna: true,
    spots: [[40, 92, 4], [80, 94, 5]],
    eyes: [[60, 52, 18]], mouth: [60, 86],
  },
  fuzzy: {
    body: FUZZ,
    under: [foot(46, 108), foot(74, 108)],
    eyes: [[47, 58, 10], [73, 58, 10]], mouth: [60, 80],
  },
  box: {
    body: 'M40 36 H80 A18 18 0 0 1 98 54 V88 A18 18 0 0 1 80 106 H40 A18 18 0 0 1 22 88 V54 A18 18 0 0 1 40 36Z',
    under: [foot(44, 107), foot(76, 107), { rect: [35, 16, 10, 28], turn: -8 }, { rect: [75, 16, 10, 28], turn: 8 }],
    belly: [40, 84, 40, 14],
    eyes: [[38, 16, 10], [82, 16, 10]], mouth: [60, 66],
  },
  ghost: {
    body: 'M24 103 L24 60 C24 32 40 17 60 17 C80 17 96 32 96 60 L96 103 Q90 95 84 103 Q78 111 72 103 Q66 95 60 103 Q54 111 48 103 Q42 95 36 103 Q30 111 24 103Z',
    under: [{ cx: 19, cy: 72, rx: 9, ry: 6 }, { cx: 101, cy: 72, rx: 9, ry: 6 }],
    spots: [[82, 86, 4], [40, 90, 3]],
    eyes: [[47, 54, 11], [73, 54, 11]], mouth: [60, 78],
  },
  wide: {
    body: 'M60 40 C94 40 110 60 108 81 C106 100 88 107 60 107 C32 107 14 100 12 81 C10 60 26 40 60 40Z',
    under: [foot(40, 107), foot(80, 107), { cx: 27, cy: 48, rx: 11, ry: 11 }, { cx: 93, cy: 48, rx: 11, ry: 11 }],
    eyes: [[40, 67, 9], [60, 59, 10], [80, 67, 9]], mouth: [60, 88],
  },
}

// The coat: everything that takes the paint, with its outline
function Coat({ kind, color, uid }) {
  const sh = SHAPES[kind] ?? SHAPES.blob
  const blank = color == null
  const fill = blank ? `url(#${uid})` : hexOf(color)
  const stroke = { stroke: INK, strokeWidth: 4, strokeLinejoin: 'round' }
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      {blank && (
        <defs>
          <pattern id={uid} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(40)">
            <rect width="9" height="9" fill="#e9e6e0" />
            <rect width="3" height="9" fill="#cfcac2" />
          </pattern>
        </defs>
      )}
      {sh.horns?.map((d, i) => <path key={i} d={d} fill={CREAM} {...stroke} />)}
      {sh.antenna && (
        <g>
          <path d="M60 20 Q56 9 63 5" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <circle cx="64" cy="5" r="5" fill={CREAM} stroke={INK} strokeWidth="3" />
        </g>
      )}
      {sh.under?.map((u, i) => (u.rect
        ? <rect key={i} x={u.rect[0]} y={u.rect[1]} width={u.rect[2]} height={u.rect[3]} rx="5" fill={fill} {...stroke} transform={`rotate(${u.turn} ${u.rect[0] + u.rect[2] / 2} ${u.rect[1] + u.rect[3]})`} />
        : <ellipse key={i} {...u} fill={fill} {...stroke} />))}
      <path d={sh.body} fill={fill} {...stroke} />
      {sh.belly && <rect x={sh.belly[0]} y={sh.belly[1]} width={sh.belly[2]} height={sh.belly[3]} rx="7" fill="rgba(255,255,255,0.3)" />}
      {sh.spots?.map(([cx, cy, r], i) => <circle key={i} cx={cx} cy={cy} r={r} fill="rgba(42,27,61,0.14)" />)}
    </svg>
  )
}

const PUPIL = { idle: [0, 0], up: [0, -0.38], down: [0, 0.42], side: [0.42, 0.05], happy: [0, -0.05], no: [0, 0.1], wet: [0, 0] }

// Eyes and mouth: they stay on top while the coat changes underneath
function Face({ kind, mood, dark }) {
  const sh = SHAPES[kind] ?? SHAPES.blob
  const line = dark ? '#fff6e8' : INK
  const [mx, my] = sh.mouth
  const [px, py] = PUPIL[mood] ?? PUPIL.idle
  const shut = mood === 'wet'
  return (
    <svg viewBox="0 0 120 120" width="100%" height="100%" style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
      <g className={shut ? undefined : 'fd-blink'}>
        {sh.eyes.map(([x, y, r], i) => (shut
          ? <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#fffdf7" stroke={INK} strokeWidth="3" />
              <path d={`M${x - r * 0.6} ${y - r * 0.35} L${x + r * 0.35} ${y} L${x - r * 0.6} ${y + r * 0.35}`} transform={i % 2 ? `rotate(180 ${x} ${y})` : undefined}
                fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          : <g key={i}>
              <circle cx={x} cy={y} r={r} fill="#fffdf7" stroke={INK} strokeWidth="3" />
              <circle cx={x + px * r} cy={y + py * r} r={r * (mood === 'happy' ? 0.58 : 0.46)} fill={INK} style={{ transition: 'cx .25s, cy .25s' }} />
              <circle cx={x + px * r - r * 0.18} cy={y + py * r - r * 0.2} r={r * 0.17} fill="#fff" />
              {mood === 'no' && <path d={`M${x - r} ${y - r * 1.25} L${x + r} ${y - r * 1.25}`} transform={`rotate(${x < 60 ? -16 : x > 60 ? 16 : 0} ${x} ${y - r * 1.25})`} stroke={line} strokeWidth="3.5" strokeLinecap="round" />}
            </g>))}
      </g>
      {mood === 'happy' ? (
        <g>
          <path d={`M${mx - 15} ${my - 5} Q${mx} ${my + 22} ${mx + 15} ${my - 5}Z`} fill="#7a1f2b" stroke={line} strokeWidth="3" strokeLinejoin="round" />
          <ellipse cx={mx} cy={my + 6} rx="6" ry="3.5" fill="#ff8fb8" />
        </g>
      ) : mood === 'down' ? (
        <ellipse cx={mx} cy={my} rx="5" ry="6" fill="#7a1f2b" stroke={line} strokeWidth="3" />
      ) : mood === 'no' || mood === 'side' ? (
        <path d={`M${mx - 10} ${my + 4} Q${mx} ${my - 6} ${mx + 10} ${my + 4}`} fill="none" stroke={line} strokeWidth="3.5" strokeLinecap="round" />
      ) : mood === 'wet' ? (
        <path d={`M${mx - 12} ${my} Q${mx - 6} ${my - 6} ${mx} ${my} Q${mx + 6} ${my + 6} ${mx + 12} ${my}`} fill="none" stroke={line} strokeWidth="3.5" strokeLinecap="round" />
      ) : (
        <path d={`M${mx - 10} ${my - 2} Q${mx} ${my + 9} ${mx + 10} ${my - 2}`} fill="none" stroke={line} strokeWidth="3.5" strokeLinecap="round" />
      )}
      {/* a shine that keeps even a black monster round */}
      <ellipse cx="38" cy="38" rx="9" ry="5" fill="#fff" opacity="0.28" transform="rotate(-35 38 38)" style={{ display: kind === 'box' || kind === 'wide' ? 'none' : undefined }} />
    </svg>
  )
}

export default function Monster({ kind, color = null, size = 120, mood = 'idle', wipe = 1, drip = null, style }) {
  const uid = `fd${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const reduce = useReducedMotion()
  const prev = useRef(color)
  const [run, setRun] = useState(null) // the coat running down: { from, n }
  useLayoutEffect(() => {
    if (prev.current === color) return
    const from = prev.current
    prev.current = color
    setRun(reduce || !wipe ? null : { from, n: Math.random() })
  }, [color, reduce, wipe])
  const dark = color != null && isDark(hexOf(color))
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, ...style }}>
      {run ? (
        <>
          <div style={{ position: 'absolute', inset: 0 }}><Coat kind={kind} color={run.from} uid={`${uid}a`} /></div>
          <motion.div key={run.n} initial={{ height: 0 }} animate={{ height: size * 1.02 }} transition={{ duration: wipe, ease: 'linear' }}
            onAnimationComplete={() => setRun(null)}
            style={{ position: 'absolute', left: -size * 0.1, top: -size * 0.02, width: size * 1.2, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', left: size * 0.1, top: size * 0.02, width: size, height: size }}><Coat kind={kind} color={color} uid={`${uid}b`} /></div>
          </motion.div>
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0 }}><Coat kind={kind} color={color} uid={uid} /></div>
      )}
      <Face kind={kind} mood={mood} dark={dark && !run} />
      {drip && !reduce && [0.26, 0.5, 0.72].map((x, i) => (
        <span key={`${drip}-${i}`} className="fd-drip" aria-hidden="true"
          style={{ left: size * x, top: size * (i === 1 ? 0.84 : 0.76), width: size * 0.07, height: size * 0.1, background: drip, animationDelay: `${i * 0.23}s` }} />
      ))}
    </div>
  )
}
