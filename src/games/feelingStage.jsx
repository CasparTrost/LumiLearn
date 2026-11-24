import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Critter, Art, Wish, DropZone } from '../components/play/index.js'
import { afterNarration } from '../narrator.js'
import { usePaused } from '../lib/pause.js'
import { sfx } from '../sfx.js'
import { FEELING_ICON, FEELING_BADGE } from './feelings.js'

/**
 * The stage of the feelings world (Gefühlswelt, Freunde trösten, Lumis
 * Abenteuer): a little scene that plays in front of the child, with Lumi,
 * other characters and things that drop, fly away, break or arrive.
 *
 * A scene is data, so seventy situations need no seventy components:
 *
 *   <Stage lumi={{ feel: 'sad', x: 170 }} cast={[{ a: '🎈', x: 250, y: 120, act: 'up', d: 1 }]} />
 *
 * Coordinates are in a virtual stage of W × H, scaled to fit the room the
 * game gives it; x is the middle of a thing, y how far above the ground.
 */
export const W = 600
export const H = 320
const GROUND = 26
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ── Feelings ──────────────────────────────────────────────────────────────

/** The feeling words (feelings.js) as Lumi's faces. */
export const FEEL = {
  'Glücklich': 'happy', 'Traurig': 'sad', 'Wütend': 'angry', 'Ängstlich': 'scared',
  'Aufgeregt': 'excited', 'Müde': 'tired', 'Verlegen': 'shy', 'Dankbar': 'thankful',
  'Überrascht': 'surprised', 'Stolz': 'proud', 'Gelangweilt': 'bored',
  'Eifersüchtig': 'jealous', 'Neugierig': 'curious', 'Einsam': 'lonely',
}

const OUT = '#5a2b1c'
const BODY = '#ffe165'
const SHADE = '#f6b23e'
const CHEEK = '#ff9db0'

// Eyes, brows, mouth and arms of each face. Lumi's pixel sprite has only two
// faces; to mirror thirteen feelings Lumi is drawn here, same shape and colours.
const FACES = {
  neutral:   { eyes: 'open',   mouth: 'tiny',   arms: 'down' },
  calm:      { eyes: 'closed', mouth: 'smile',  arms: 'down', cheeks: true },
  happy:     { eyes: 'happy',  mouth: 'grin',   arms: 'up',   cheeks: true, brows: 'M38 50 Q46 45 53 50 M67 50 Q74 45 82 50' },
  sad:       { eyes: 'open',   mouth: 'frown',  arms: 'down', brows: 'M39 52 L52 47 M81 52 L68 47', look: 2 },
  angry:     { eyes: 'narrow', mouth: 'teeth',  arms: 'fists', brows: 'M38 50 L53 57 M82 50 L67 57', flush: true },
  scared:    { eyes: 'wide',   mouth: 'wobble', arms: 'cross', brows: 'M38 48 Q45 42 52 47 M68 47 Q75 42 82 48' },
  excited:   { eyes: 'star',   mouth: 'grin',   arms: 'up',   cheeks: true, brows: 'M38 48 Q46 42 53 48 M67 48 Q74 42 82 48' },
  tired:     { eyes: 'half',   mouth: 'yawn',   arms: 'down', brows: 'M39 54 L52 54 M68 54 L81 54' },
  shy:       { eyes: 'down',   mouth: 'wobble', arms: 'face', blush: true, brows: 'M39 51 L52 48 M81 51 L68 48' },
  thankful:  { eyes: 'closed', mouth: 'smile',  arms: 'chest', cheeks: true, brows: 'M39 52 Q46 48 52 51 M68 51 Q74 48 81 52' },
  surprised: { eyes: 'wide',   mouth: 'O',      arms: 'up',   brows: 'M38 46 Q45 39 52 45 M68 45 Q75 39 82 46' },
  proud:     { eyes: 'closed', mouth: 'smug',   arms: 'hips', cheeks: true, brows: 'M39 50 Q46 46 52 49 M68 49 Q74 46 81 50' },
  bored:     { eyes: 'half',   mouth: 'flat',   arms: 'down', brows: 'M39 55 L52 55 M68 55 L81 55', look: 1 },
  jealous:   { eyes: 'side',   mouth: 'pout',   arms: 'cross', brows: 'M39 52 L52 49 M68 46 L81 50' },
  curious:   { eyes: 'curious', mouth: 'o',     arms: 'chest', brows: 'M39 51 Q46 47 52 50 M67 44 Q74 39 82 45' },
  lonely:    { eyes: 'down',   mouth: 'frown',  arms: 'chest', brows: 'M39 52 L52 48 M81 52 L68 48' },
}

function Eye({ kind, cx, cy, look = 0, right }) {
  const ink = { fill: OUT }
  const line = { fill: 'none', stroke: OUT, strokeWidth: 3.2, strokeLinecap: 'round' }
  switch (kind) {
    case 'happy':  return <path d={`M${cx - 7} ${cy + 2} Q${cx} ${cy - 7} ${cx + 7} ${cy + 2}`} {...line} />
    case 'closed': return <path d={`M${cx - 7} ${cy - 1} Q${cx} ${cy + 5} ${cx + 7} ${cy - 1}`} {...line} />
    case 'narrow': return <ellipse cx={cx} cy={cy + 1} rx="6.5" ry="3.4" {...ink} />
    case 'wide':   return <g><circle cx={cx} cy={cy} r="8.5" fill="#fff" stroke={OUT} strokeWidth="2.4" /><circle cx={cx} cy={cy + 1} r="3.4" {...ink} /></g>
    case 'half':   return <g><path d={`M${cx - 7} ${cy} A7 7 0 0 0 ${cx + 7} ${cy} Z`} {...ink} /><path d={`M${cx - 8} ${cy} L${cx + 8} ${cy}`} {...line} /></g>
    case 'down':   return <g><ellipse cx={cx} cy={cy + 3} rx="5" ry="5.5" {...ink} /><path d={`M${cx - 7} ${cy - 2} Q${cx} ${cy - 4} ${cx + 7} ${cy - 2}`} {...line} strokeWidth="2.4" /></g>
    case 'side':   return <g><ellipse cx={cx} cy={cy} rx="7.5" ry="6.5" fill="#fff" stroke={OUT} strokeWidth="2.4" /><circle cx={cx + 3.5} cy={cy + 1} r="3.4" {...ink} /><path d={`M${cx - 8} ${cy - 3} L${cx + 8} ${cy - 3}`} {...line} /></g>
    case 'star': {
      const p = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 3.4 : 8.5, a = -Math.PI / 2 + (i * Math.PI) / 5
        return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
      }).join(' L')
      return <path d={`M${p} Z`} fill="#ffb200" stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
    }
    case 'curious':
      return right
        ? <g><ellipse cx={cx} cy={cy} rx="8" ry="9" {...ink} /><circle cx={cx - 2.5} cy={cy - 3} r="2.8" fill="#fff" /></g>
        : <g><ellipse cx={cx} cy={cy + 1} rx="5" ry="5.5" {...ink} /><circle cx={cx - 1.6} cy={cy - 1} r="1.8" fill="#fff" /></g>
    default: // Lumi's big shiny eyes
      return <g><ellipse cx={cx} cy={cy + look} rx="6.5" ry="7.5" {...ink} /><circle cx={cx - 2.4} cy={cy - 2.6 + look} r="2.4" fill="#fff" /></g>
  }
}

function Mouth({ kind }) {
  const line = { fill: 'none', stroke: OUT, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (kind) {
    case 'smile':  return <path d="M51 79 Q60 87 69 79" {...line} />
    case 'grin':   return <g><path d="M48 76 Q60 96 72 76 Z" fill={OUT} stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" /><ellipse cx="60" cy="86" rx="5.5" ry="3" fill="#ff6b7d" /></g>
    case 'frown':  return <path d="M51 86 Q60 77 69 86" {...line} />
    case 'teeth':  return <g><rect x="49" y="78" width="22" height="9" rx="3" fill="#fff" stroke={OUT} strokeWidth="2.6" /><path d="M56 78 V87 M64 78 V87" stroke={OUT} strokeWidth="2" /></g>
    case 'wobble': return <path d="M49 83 q3.7 -4 7.3 0 q3.7 4 7.3 0 q3.7 -4 7.3 0" {...line} strokeWidth="2.8" />
    case 'O':      return <ellipse cx="60" cy="84" rx="6" ry="8" fill={OUT} />
    case 'o':      return <ellipse cx="64" cy="83" rx="3.6" ry="4.2" fill={OUT} />
    case 'yawn':   return <ellipse cx="60" cy="85" rx="5.5" ry="7.5" fill={OUT} />
    case 'flat':   return <path d="M53 83 L68 82" {...line} />
    case 'smug':   return <path d="M51 80 Q61 88 70 77" {...line} />
    case 'pout':   return <path d="M54 85 Q60 80 66 85" {...line} />
    default:       return <path d="M56 80 Q60 83 64 80" {...line} strokeWidth="2.8" />
  }
}

// Arm nubs: [cx, cy, rotate] left and right; in front of the body or behind it
const ARMS = {
  down:  { l: [15, 84, 25],  r: [105, 84, -25] },
  fists: { l: [15, 86, 0],   r: [105, 86, 0], fist: true },
  up:    { l: [13, 50, -35], r: [107, 50, 35] },
  hips:  { l: [17, 84, -45], r: [103, 84, 45], front: true },
  face:  { l: [36, 80, 15],  r: [84, 80, -15], front: true },
  chest: { l: [52, 96, 40],  r: [68, 96, -40], front: true },
  cross: { l: [50, 96, 70],  r: [70, 98, -70], front: true },
}

function Arms({ pose, fill }) {
  const A = ARMS[pose] ?? ARMS.down
  return [A.l, A.r].map(([cx, cy, rot], i) => A.fist
    ? <circle key={i} cx={cx} cy={cy} r="7.5" fill={fill} stroke={OUT} strokeWidth="3" />
    : <ellipse key={i} cx={cx} cy={cy} rx="6.5" ry="11" fill={fill} stroke={OUT} strokeWidth="3" transform={`rotate(${rot} ${cx} ${cy})`} />)
}

// What sits on top of the head: Lumi's tuft, or the ears of a friend
function Top({ ears, body, shade }) {
  const st = { fill: body, stroke: OUT, strokeWidth: 3, strokeLinejoin: 'round' }
  switch (ears) {
    case 'bunny': return <g>{[[42, -14], [78, 14]].map(([x, r]) => <g key={x} transform={`rotate(${r} ${x} 30)`}><ellipse cx={x} cy="12" rx="9" ry="22" {...st} /><ellipse cx={x} cy="14" rx="4" ry="14" fill={CHEEK} /></g>)}</g>
    case 'bear':  return <g>{[30, 90].map(x => <g key={x}><circle cx={x} cy="32" r="13" {...st} /><circle cx={x} cy="32" r="6" fill={shade} /></g>)}</g>
    case 'cat':   return <g><path d="M24 46 L30 10 L54 28 Z" {...st} /><path d="M96 46 L90 10 L66 28 Z" {...st} /></g>
    case 'antenna': return <g><path d="M60 24 L56 6" stroke={OUT} strokeWidth="3" /><circle cx="56" cy="6" r="6" fill="#ffc93c" stroke={OUT} strokeWidth="2.5" /></g>
    default:      return <path d="M54 26 C51 14 59 4 71 5 C66 9 68 13 75 11 C74 20 67 26 61 26 Z" {...st} />
  }
}

// What floats around Lumi: tears, steam, Zzz … `n` grows with the strength.
function Marks({ feel, n }) {
  const blue = '#4aa3ff'
  if (feel === 'sad') return (
    <g fill={blue}>
      {n >= 2
        ? <><rect x="41" y="70" width="6" height="34" rx="3" opacity="0.85" /><rect x="73" y="70" width="6" height="34" rx="3" opacity="0.85" /></>
        : <motion.path d="M44 70 q-4 8 0 11 q4 -3 0 -11" animate={{ y: [0, 14], opacity: [1, 0] }} transition={{ duration: 1.4, repeat: Infinity }} />}
      {n === 1 && <motion.path d="M76 70 q-4 8 0 11 q4 -3 0 -11" animate={{ y: [0, 14], opacity: [1, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: 0.7 }} />}
    </g>
  )
  if (feel === 'angry') return (
    <g fill="#fff" stroke={OUT} strokeWidth="2">
      {[[16, 22], [100, 20], [58, 2]].slice(0, n + 1).map(([x, y], i) => (
        <motion.g key={i} animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.25 }}>
          <circle cx={x} cy={y + 6} r="6" /><circle cx={x + 7} cy={y + 2} r="7" /><circle cx={x + 13} cy={y + 7} r="5" />
        </motion.g>
      ))}
    </g>
  )
  if (feel === 'scared') return (
    <g fill="#8fd3ff" stroke={OUT} strokeWidth="1.6">
      <path d="M96 38 q-6 10 0 13 q6 -3 0 -13" />
      {n >= 1 && <path d="M24 44 q-5 8 0 11 q5 -3 0 -11" />}
    </g>
  )
  if (feel === 'tired') return (
    <motion.text x="86" y="26" fontFamily="var(--font-heading)" fontWeight="700" fontSize={14 + n * 4} fill={blue}
      animate={{ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }} transition={{ duration: 2.2, repeat: Infinity }}>Zzz</motion.text>
  )
  if (feel === 'surprised' || feel === 'curious') return (
    <motion.text x="96" y="30" fontFamily="var(--font-heading)" fontWeight="700" fontSize={24 + n * 4}
      fill={feel === 'curious' ? '#6b3fd6' : '#ffb200'} stroke={OUT} strokeWidth="1.5"
      initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
      {feel === 'curious' ? '?' : n >= 2 ? '!!' : '!'}
    </motion.text>
  )
  if (feel === 'proud') return (
    <g>
      <path d="M53 88 L60 100 L67 88" fill="none" stroke="#4a8ee6" strokeWidth="5" />
      <circle cx="60" cy="104" r="8" fill="#ffc93c" stroke={OUT} strokeWidth="2.2" />
      <path d="M60 99 l1.6 3.2 3.4 .5 -2.5 2.4 .6 3.4 -3.1 -1.6 -3.1 1.6 .6 -3.4 -2.5 -2.4 3.4 -.5 z" fill="#fff6c8" />
      <motion.path d="M100 16 l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5 z" fill="#ffc93c" stroke={OUT} strokeWidth="1.4"
        animate={{ scale: [0.7, 1.2, 0.7] }} transition={{ duration: 1.2, repeat: Infinity }} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
    </g>
  )
  if (feel === 'excited' || feel === 'happy') {
    const spots = [[12, 30], [104, 26], [96, 4]]
    return (
      <g fill="#ffc93c" stroke={OUT} strokeWidth="1.4">
        {spots.slice(0, n + 1).map(([x, y], i) => (
          <motion.path key={i} d={`M${x} ${y - 8} L${x + 2.5} ${y - 2.5} L${x + 8} ${y} L${x + 2.5} ${y + 2.5} L${x} ${y + 8} L${x - 2.5} ${y + 2.5} L${x - 8} ${y} L${x - 2.5} ${y - 2.5} Z`}
            animate={{ scale: [0.7, 1.2, 0.7], rotate: [0, 30, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.3 }}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        ))}
      </g>
    )
  }
  if (feel === 'thankful') return (
    <g fill="#ff5b8a" stroke={OUT} strokeWidth="1.4">
      {[[98, 30], [14, 36]].slice(0, n >= 1 ? 2 : 1).map(([x, y], i) => (
        <motion.path key={i} d={`M${x} ${y + 8} C${x - 8} ${y + 2} ${x - 8} ${y - 6} ${x} ${y - 2} C${x + 8} ${y - 6} ${x + 8} ${y + 2} ${x} ${y + 8} Z`}
          animate={{ y: [0, -10, 0] }} transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.5 }} />
      ))}
    </g>
  )
  if (feel === 'bored') return (
    <motion.g animate={{ x: [0, 10], opacity: [0.8, 0] }} transition={{ duration: 2, repeat: Infinity }}>
      <circle cx="80" cy="88" r="4" fill="#fff" stroke={OUT} strokeWidth="1.4" /><circle cx="88" cy="84" r="3" fill="#fff" stroke={OUT} strokeWidth="1.2" />
    </motion.g>
  )
  if (feel === 'jealous') return (
    <g fill="#9ccf6a" stroke={OUT} strokeWidth="1.6" opacity="0.95">
      <circle cx="96" cy="20" r="7" /><circle cx="104" cy="14" r="6" /><circle cx="108" cy="22" r="5" />
    </g>
  )
  if (feel === 'shy') return (
    <g stroke="#e8506e" strokeWidth="2" strokeLinecap="round">
      <path d="M28 66 l4 -5 M33 67 l4 -5 M83 66 l4 -5 M88 67 l4 -5" />
    </g>
  )
  return null
}

// How the whole body moves with a feeling; `k` is the strength (0.6 … 1.4)
function bodyMotion(feel, k) {
  const loop = (d, more = {}) => ({ duration: d, repeat: Infinity, ease: 'easeInOut', ...more })
  switch (feel) {
    case 'happy':     return { animate: { y: [0, -14 * k, 0], rotate: 0, scaleY: 1 }, transition: loop(0.7) }
    case 'excited':   return { animate: { y: [0, -22 * k, 0], rotate: [0, -8 * k, 8 * k, 0], scaleY: 1 }, transition: loop(0.6) }
    case 'sad':       return { animate: { y: 4 * k, scaleY: 1 - 0.05 * k, rotate: [0, -3, 3, 0] }, transition: { rotate: loop(3), default: { duration: 0.6 } } }
    case 'lonely':    return { animate: { y: 6, scaleY: 0.88, rotate: 4 }, transition: { duration: 0.6 } }
    case 'angry':     return { animate: { x: [-2 * k, 2 * k], scale: 1 + 0.03 * k, rotate: 0 }, transition: { x: { duration: 0.09, repeat: Infinity, repeatType: 'mirror' } } }
    case 'scared':    return { animate: { x: [-1.5 * k, 1.5 * k], scale: 1 - 0.04 * k, rotate: 0 }, transition: { x: { duration: 0.06, repeat: Infinity, repeatType: 'mirror' } } }
    case 'tired':     return { animate: { rotate: [-4 * k, 4 * k], y: 3, scaleY: 0.97 }, transition: { rotate: loop(2.6, { repeatType: 'mirror' }) } }
    case 'shy':       return { animate: { rotate: [-6, 6], scale: 0.96, y: 0 }, transition: { rotate: loop(1.4, { repeatType: 'mirror' }) } }
    case 'thankful':  return { animate: { rotate: [-3, 3], y: 0, scale: 1 }, transition: { rotate: loop(1.8, { repeatType: 'mirror' }) } }
    case 'surprised': return { animate: { y: [0, -18 * k, 0], scaleY: [1, 1.1, 1.05], rotate: 0 }, transition: { duration: 0.5 } }
    case 'proud':     return { animate: { scaleY: 1 + 0.08 * k, rotate: -9, y: -4 }, transition: { type: 'spring', stiffness: 200, damping: 10 } }
    case 'bored':     return { animate: { scaleY: [1, 0.95, 1], rotate: 3, y: 2 }, transition: { scaleY: loop(3) } }
    case 'jealous':   return { animate: { rotate: 6, x: 3, scale: 1 }, transition: { duration: 0.5 } }
    case 'curious':   return { animate: { rotate: -10, x: 4, y: -4, scale: 1 }, transition: { type: 'spring', stiffness: 160, damping: 12 } }
    default:          return { animate: { y: [0, -3, 0], scaleY: [1, 1.02, 1], rotate: 0, x: 0, scale: 1 }, transition: loop(2.6) }
  }
}

/**
 * Lumi with a face for every feeling: the child gives Lumi a face, and Lumi
 * makes it — eyes, mouth, arms, tears or steam, and the body moves with it.
 * `strength` 0, 1 or 2 (ein bisschen … sehr). With `look` ({ body, shade,
 * ears: bunny | bear | cat | antenna }) it is one of Lumi's friends.
 */
export function FeelLumi({ feel = 'neutral', strength = 1, size = 150, flip = false, look }) {
  const body = look?.body ?? BODY, shade = look?.shade ?? SHADE
  const F = FACES[feel] ?? FACES.neutral
  const A = ARMS[F.arms] ?? ARMS.down
  const m = reduceMotion() ? { animate: {}, transition: {} } : bodyMotion(feel, 0.6 + strength * 0.4)
  return (
    <motion.div key={feel} {...m} style={{ width: size, height: size * 1.08, transformOrigin: '50% 100%' }}>
      <svg viewBox="0 0 120 130" width={size} height={size * 1.08} style={{ display: 'block', overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden="true">
        <defs><clipPath id="fl-body"><path d="M60 22 C87 22 105 44 107 72 C109 99 92 116 60 116 C28 116 11 99 13 72 C15 44 33 22 60 22 Z" /></clipPath></defs>
        <ellipse cx="60" cy="124" rx="34" ry="4.5" fill="rgba(42,27,61,0.18)" />
        {!A.front && <Arms pose={F.arms} fill={body} />}
        <Top ears={look?.ears} body={body} shade={shade} />
        <ellipse cx="44" cy="117" rx="10" ry="6" fill={shade} stroke={OUT} strokeWidth="3" />
        <ellipse cx="76" cy="117" rx="10" ry="6" fill={shade} stroke={OUT} strokeWidth="3" />
        <path d="M60 22 C87 22 105 44 107 72 C109 99 92 116 60 116 C28 116 11 99 13 72 C15 44 33 22 60 22 Z" fill={body} />
        <g clipPath="url(#fl-body)">
          <ellipse cx="60" cy="118" rx="54" ry="24" fill={shade} />
          {F.flush && <rect x="0" y="0" width="120" height="130" fill="#ff5b4a" opacity={0.12 + strength * 0.06} />}
        </g>
        <path d="M60 22 C87 22 105 44 107 72 C109 99 92 116 60 116 C28 116 11 99 13 72 C15 44 33 22 60 22 Z" fill="none" stroke={OUT} strokeWidth="3.4" />
        <ellipse cx="38" cy="40" rx="7" ry="4.5" fill="#fff" opacity="0.9" transform="rotate(-35 38 40)" />
        {(F.cheeks || F.blush) && <g fill={F.blush ? '#ff6f8f' : CHEEK} opacity={F.blush ? 0.85 : 0.75}>
          <ellipse cx="33" cy="75" rx={F.blush ? 10 : 7} ry={F.blush ? 6 : 4.5} /><ellipse cx="87" cy="75" rx={F.blush ? 10 : 7} ry={F.blush ? 6 : 4.5} /></g>}
        {F.flush && <g fill="#ff6b5b" opacity="0.6"><ellipse cx="33" cy="75" rx="8" ry="5" /><ellipse cx="87" cy="75" rx="8" ry="5" /></g>}
        <Eye kind={F.eyes} cx={46} cy={63} look={F.look} />
        <Eye kind={F.eyes} cx={74} cy={63} look={F.look} right />
        {F.brows && <path d={F.brows} fill="none" stroke={OUT} strokeWidth="3" strokeLinecap="round" />}
        <Mouth kind={F.mouth} />
        {A.front && <Arms pose={F.arms} fill={body} />}
        <Marks feel={feel} n={strength} />
      </svg>
    </motion.div>
  )
}

// ── Characters other than Lumi ────────────────────────────────────────────

// A feeling on an emoji character: the kit's moods plus what they lack
const ACTOR_MOOD = { happy: 'happy', excited: 'dance', sad: 'sad', lonely: 'sad', tired: 'sleep', surprised: 'wow', proud: 'wow', thankful: 'happy', curious: 'oops' }

function ActorMarks({ feel, s, whole }) {
  // a whole figure has its face small at the top, the emoji's fills the picture
  const k = whole ? 0.55 : 1
  const at = whole ? { scared: [0, 0.28], angry: [-0.12, 0.22], proud: [-0.06, 0.26], sad: [0.12, 0.38] }
    : { scared: [0.02, 0.02], angry: [-0.1, -0.08], proud: [-0.08, -0.04], sad: [0.3, 0.12] }
  if (feel === 'scared') return <Art art="💧" size={s * 0.26 * k} style={{ position: 'absolute', top: s * at.scared[0], right: s * at.scared[1] }} />
  if (feel === 'angry') return (
    <motion.div animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }} transition={{ duration: 0.8, repeat: Infinity }}
      style={{ position: 'absolute', top: s * at.angry[0], right: s * at.angry[1], pointerEvents: 'none' }}><Art art="💨" size={s * 0.34 * k} /></motion.div>
  )
  if (feel === 'proud') return <Art art="✨" size={s * 0.3 * k} style={{ position: 'absolute', top: s * at.proud[0], left: s * at.proud[1] }} />
  if (feel === 'sad') return (
    <motion.div animate={{ y: [0, s * 0.15 * k], opacity: [1, 0] }} transition={{ duration: 1.3, repeat: Infinity }}
      style={{ position: 'absolute', top: s * at.sad[0], left: s * at.sad[1], pointerEvents: 'none' }}><Art art="💧" size={s * 0.2 * k} /></motion.div>
  )
  return null
}

// People stand on the stage as whole figures (pictures made with Tripo),
// not as the emoji's head and shoulders, which looked like heads sticking
// out of the meadow. Grown-ups a little taller than children.
const PEOPLE = {
  '👵': ['oma', 1.45], '👴': ['opa', 1.45], '👩': ['mama', 1.5], '👨': ['papa', 1.5], '👮': ['polizei', 1.5],
  '👧': ['maedchen', 1.25], '👦': ['junge', 1.25], '🧒': ['kleinkind', 1.1],
}
// people who have a sitting picture (legs bent over a seat)
const SITS = new Set(['maedchen'])
/** A cast entry with its person drawn whole: [art, size] */
function asPerson(art, size, sit) {
  const p = PEOPLE[art]
  if (!p) return [art, size, false]
  return [`:px-mensch-${p[0]}${sit && SITS.has(p[0]) ? '-sitzt' : ''}:`, Math.round(size * p[1]), true]
}

/** An emoji character with a feeling: a frightened kitten trembles, an angry child steams. */
function Actor({ art, feel, size, flip, label, whole }) {
  const shake = feel === 'scared' || feel === 'angry'
  return (
    <motion.div animate={shake && !reduceMotion() ? { x: feel === 'scared' ? [-2, 2] : [-3, 3] } : { x: 0 }}
      transition={shake ? { duration: feel === 'scared' ? 0.07 : 0.1, repeat: Infinity, repeatType: 'mirror' } : {}}
      style={{ position: 'relative', width: size, height: size, filter: feel === 'angry' ? 'drop-shadow(0 0 6px rgba(255,80,60,.7))' : undefined }}>
      <Critter art={art} size={size} mood={ACTOR_MOOD[feel] ?? 'idle'} flip={flip} label={label} />
      <ActorMarks feel={feel} s={size} whole={whole} />
    </motion.div>
  )
}

/** A thing on the stage: a tap makes it wobble with a boing. */
function Thing({ art, size, flip }) {
  const [n, setN] = useState(0)
  return (
    <motion.div key={n} animate={n ? { rotate: [0, -12, 10, -5, 0], scale: [1, 1.15, 1] } : {}} transition={{ duration: 0.5 }}
      onPointerDown={() => { sfx.boing(); setN(k => k + 1) }}
      style={{ width: size, height: size, cursor: 'pointer', transform: flip ? 'scaleX(-1)' : undefined }}>
      <Art art={art} size={size} />
    </motion.div>
  )
}

// ── What things do on the stage ───────────────────────────────────────────
// Each act is framer-motion initial/animate/transition for one thing, from
// its place (x, y) in the virtual stage; `d` is the delay in seconds. A
// thing that leaves the stage is hidden at the end, so nothing tappable
// waits off screen.
function act(c, s) {
  const d = c.d ?? 0
  const x = c.x, y = c.y ?? 0
  const offR = W - x + s, offL = -(x + s)
  const spring = { type: 'spring', stiffness: 220, damping: 15, delay: d }
  switch (c.act) {
    case 'drop':  return { initial: { y: -(H + s) }, animate: { y: 0 }, transition: { type: 'spring', stiffness: 240, damping: 13, delay: d } }
    case 'in':    return { initial: { x: offR }, animate: { x: 0, y: [0, -14, 0, -14, 0] }, transition: { x: { ...spring, stiffness: 90, damping: 16 }, y: { duration: 1, delay: d } } }
    case 'inL':   return { initial: { x: offL }, animate: { x: 0, y: [0, -14, 0, -14, 0] }, transition: { x: { ...spring, stiffness: 90, damping: 16 }, y: { duration: 1, delay: d } } }
    case 'out':   return { initial: { x: 0 }, animate: { x: offR + 60, y: [0, -12, 0, -12, 0], transitionEnd: { visibility: 'hidden' } }, transition: { duration: 1.4, delay: d, ease: 'easeIn' } }
    case 'visit': return { initial: { x: offR }, animate: { x: [offR, 0, 0, offR + 60], transitionEnd: { visibility: 'hidden' } }, transition: { duration: 2.6, times: [0, 0.3, 0.65, 1], delay: d } }
    case 'grab':  return { initial: { x: 0 }, animate: { x: [0, 0, c.to - x, offR + 60], transitionEnd: { visibility: 'hidden' } }, transition: { duration: 2.6, times: [0, 0.35, 0.45, 1], delay: d } }
    case 'pass':  return { initial: { x: 0, y: 0 }, animate: { x: [0, c.to - x, 0, c.to - x, 0], y: [0, -60, 0, -60, 0, -60, 0, -60, 0] }, transition: { duration: 2, delay: d, ease: 'easeInOut' } }
    case 'give':  return { initial: { x: 0, y: 0 }, animate: { x: c.to - x, y: [0, -50, 0] }, transition: { duration: 0.9, delay: d } }
    case 'up':    return { initial: { y: 0 }, animate: { y: -(H + y + s), x: [0, -14, 12, -8, 6], transitionEnd: { visibility: 'hidden' } }, transition: { duration: 3.2, delay: d, ease: 'easeIn' } }
    case 'fall':  return { initial: { y: 0, rotate: 0 }, animate: { y: [0, -14, y], rotate: [0, -12, 110], scaleY: [1, 1, 0.75] }, transition: { duration: 0.8, delay: d, ease: 'easeIn' } }
    case 'topple':return { initial: { rotate: 0 }, animate: { rotate: [0, -8, 8, -8, 92], y: [0, 0, 0, 0, s * 0.3] }, transition: { duration: 1.3, delay: d } }
    case 'shake': return { initial: { scale: 0 }, animate: { scale: 1, x: [0, -6, 6, -6, 6, 0] }, transition: { scale: spring, x: { duration: 0.5, repeat: Infinity, repeatDelay: 0.6, delay: d + 0.4 } } }
    case 'bang':  return { initial: { scale: 0, opacity: 0 }, animate: { scale: [0, 1.6, 1], opacity: 1 }, transition: { duration: 0.5, delay: d } }
    case 'down':  return { initial: { y: -(H - y) }, animate: { y: [-(H - y), 0, -16, 0] }, transition: { duration: 2, times: [0, 0.6, 0.8, 1], delay: d } }
    case 'grow':  return { initial: { scale: 0.3 }, animate: { scale: 1 }, transition: { type: 'spring', stiffness: 80, damping: 9, delay: d } }
    case 'sweep': return { initial: { x: offL }, animate: { x: offR + 60, transitionEnd: { visibility: 'hidden' } }, transition: { duration: 2.4, delay: d, ease: 'linear' } }
    case 'zoom':  return { initial: { x: offL }, animate: { x: offR + 60, transitionEnd: { visibility: 'hidden' } }, transition: { duration: 1.8, delay: d, ease: 'easeInOut' } }
    case 'sink':  return { initial: { opacity: 1 }, animate: { opacity: [1, 1, 0], y: [0, 0, 24], scaleY: [1, 1, 0.4] }, transition: { duration: 1.4, delay: d } }
    case 'bob':   return { initial: { scale: 0 }, animate: { scale: 1, y: [0, -10, 0] }, transition: { scale: spring, y: { duration: 2.4, repeat: Infinity, delay: d } } }
    case 'hop':   return { initial: { scale: 0 }, animate: { scale: 1, y: [0, -24, 0] }, transition: { scale: spring, y: { duration: 0.6, repeat: Infinity, repeatDelay: 0.2, delay: d } } }
    case 'scribble': return { initial: { scale: 0 }, animate: { scale: 1, x: [0, -40, 30, -30, 40, 0], y: [0, 20, -10, 24, -6, 0] }, transition: { scale: spring, x: { duration: 1.2, delay: d + 0.3, repeat: 1 }, y: { duration: 1.2, delay: d + 0.3, repeat: 1 } } }
    case 'flicker':  return { initial: { opacity: 1 }, animate: { opacity: [1, 0.2, 1, 0.1, 1, 0.15] }, transition: { duration: 1.2, delay: d } }
    case 'buzz':  return { initial: { scale: 0 }, animate: { scale: 1, x: [0, 60, -30, 40, 0], y: [0, -30, 10, -40, 0] }, transition: { scale: spring, x: { duration: 3, repeat: Infinity, delay: d }, y: { duration: 2.2, repeat: Infinity, delay: d } } }
    case 'swing': return { initial: false, animate: { x: [-7, 7], rotate: [-4, 4] }, transition: { duration: 1.1, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: d } }
    case 'jack':  return { initial: { scale: 0, y: 30 }, animate: { scale: [0, 1.25, 1], y: [30, -30, 0] }, transition: { duration: 0.7, delay: d } }
    case 'none':  return { initial: false, animate: {}, transition: {} }
    default:      return { initial: { scale: 0 }, animate: { scale: 1 }, transition: spring } // pop
  }
}

// Lumi's own moves in a scene
function lumiAct(l) {
  const d = l.d ?? 0
  switch (l.act) {
    case 'in':      return { initial: { x: -(l.x + 160) }, animate: { x: 0, y: [0, -16, 0, -16, 0, -16, 0] }, transition: { x: { type: 'spring', stiffness: 70, damping: 16, delay: d }, y: { duration: 1.4, delay: d } } }
    case 'run':     return { initial: { x: -(l.x + 160) }, animate: { x: 0, y: [0, -10, 0, -10, 0, -10, 0] }, transition: { duration: 1.1, delay: d, ease: 'easeOut' } }
    case 'hop':     return { initial: false, animate: { y: [0, -30, 0] }, transition: { duration: 0.55, repeat: Infinity, repeatDelay: 0.3, delay: d } }
    case 'stumble': return { initial: false, animate: { rotate: [0, 0, -80, -80, 0], x: [0, 0, -16, -16, 0] }, transition: { duration: 2.2, times: [0, 0.3, 0.45, 0.8, 1], delay: d } }
    case 'climb':   return { initial: { y: 0 }, animate: { y: -(l.up ?? 120) }, transition: { duration: 1.8, delay: d, ease: 'easeInOut' } }
    case 'swing':   return { initial: false, animate: { x: [-7, 7], rotate: [-4, 4] }, transition: { duration: 1.1, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut', delay: d } }
    case 'away':    return { initial: false, animate: { x: [0, 0, -(l.x + 200)] }, transition: { duration: 2, times: [0, 0.3, 1], delay: d } }
    default:        return { initial: false, animate: {}, transition: {} }
  }
}

// Weather and light over the stage, inside its rounded frame
function Fx({ kind }) {
  if (!kind) return null
  // feathered edges: weather over the scene, not a box on the meadow
  const fade = 'radial-gradient(ellipse 50% 50% at 50% 50%, #000 62%, transparent 100%)'
  const frame = { position: 'absolute', inset: -20, overflow: 'hidden', pointerEvents: 'none', maskImage: fade, WebkitMaskImage: fade }
  if (kind === 'night' || kind === 'dark') return (
    <motion.div initial={{ opacity: kind === 'dark' ? 0 : 1 }} animate={{ opacity: 1 }} transition={{ delay: kind === 'dark' ? 1.2 : 0, duration: 0.6 }}
      style={{ ...frame, background: kind === 'dark' ? 'radial-gradient(ellipse at 50% 70%, rgba(10,8,30,.55), rgba(10,8,30,.9) 70%)' : 'radial-gradient(ellipse at 50% 60%, rgba(30,34,90,.35), rgba(20,22,70,.75) 75%)' }}>
      {kind === 'night' && [[60, 40], [140, 90], [470, 50], [540, 110], [300, 30], [400, 80]].map(([x, y], i) => (
        <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
          style={{ position: 'absolute', left: x, top: y, width: 6, height: 6, borderRadius: 3, background: '#fff6c8' }} />
      ))}
    </motion.div>
  )
  if (kind === 'rain' || kind === 'snow') return (
    <div style={{ ...frame, background: kind === 'rain' ? 'rgba(90,110,150,.22)' : 'rgba(255,255,255,.12)' }}>
      {Array.from({ length: kind === 'rain' ? 26 : 22 }, (_, i) => (
        <motion.div key={i} initial={{ y: -30 }} animate={{ y: H + 30 }}
          transition={{ duration: kind === 'rain' ? 0.9 : 3.5, repeat: Infinity, delay: (i * 0.37) % (kind === 'rain' ? 0.9 : 3.5), ease: 'linear' }}
          style={{ position: 'absolute', left: (i * 53) % W, top: 0,
            ...(kind === 'rain' ? { width: 3, height: 16, borderRadius: 2, background: '#6fb3ff' } : { width: 9, height: 9, borderRadius: 5, background: '#fff', boxShadow: '0 0 2px #9ab' }) }} />
      ))}
    </div>
  )
  if (kind === 'glow') return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 0.7] }} transition={{ duration: 1.2, delay: 1 }}
      style={{ ...frame, background: 'radial-gradient(ellipse at 50% 40%, rgba(255,240,150,.75), rgba(255,240,150,0) 70%)' }} />
  )
  if (kind === 'spot') return (
    <div style={{ ...frame, background: 'radial-gradient(ellipse 120px 220px at 170px 230px, rgba(255,240,180,.25), rgba(20,10,40,.7) 100%)' }} />
  )
  return null
}

/**
 * The stage. `lumi` puts Lumi on it ({ x, feel, strength, size, act });
 * `cast` the others ({ a, x, y, s, act, d, feel, flip, char, say, to, rot, z, node }).
 * `drop` makes Lumi ('lumi') or one of the cast (its index) a target for
 * faces and gifts: { who, id, onDrop }. `bubbles` shows a thought bubble
 * over someone ({ lumi: <Art …/>, 2: … }), `looks` overrides a feeling
 * after something happened ({ 2: 'happy' }), `tint` greys someone out
 * ({ 2: 0.3 }: saturation) until the colour comes back.
 */
export function Stage({ lumi, cast = [], fx, drop, tap, bubbles = {}, looks = {}, tint = {}, playKey, children, minHeight = 230 }) {
  const box = useRef(null)
  // On a tall screen (phone, tablet upright) the scene moves closer
  // together instead of shrinking: things keep their size, the gaps narrow.
  const [{ scale, squeeze, vis }, setFit] = useState({ scale: 1, squeeze: 1, vis: W })
  const paused = usePaused()
  const [started, setStarted] = useState(!paused)
  useEffect(() => { if (!paused) setStarted(true) }, [paused])

  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight
      const sq = w / h < 1 ? 0.6 : w / h < 1.4 ? 0.72 : 1
      const sc = Math.max(0.3, Math.min(w / (W * sq), h / H))
      setFit({ scale: sc, squeeze: sq, vis: Math.min(W, w / sc) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const X = x => W / 2 + (x - W / 2) * squeeze
  // what Lumi holds stays in Lumi's hand when the scene squeezes
  const Xc = x => (lumi && Math.abs(x - lumi.x) < 110 ? X(lumi.x) + x - lumi.x : X(x))
  // a thing standing at the edge stays on the visible part of the stage
  // (on a phone a prop at the right end was a few pixels off the screen)
  const inside = (x, size) => Math.max(W / 2 - vis / 2 + size / 2 + 4, Math.min(W / 2 + vis / 2 - size / 2 - 4, x))

  // `tap`: { who, onTap } — someone to tap to make the scene happen; it
  // wiggles and glows until it is tapped
  const wrapTap = (who, node, size) => (tap && tap.who === who
    ? <motion.div data-tap-actor="" role="button" tabIndex={0} aria-label={tap.label} onClick={tap.onTap}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') tap.onTap() }}
        animate={reduceMotion() ? {} : { rotate: [0, -6, 6, -4, 0], scale: [1, 1.06, 1] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.8 }}
        style={{ cursor: 'pointer', width: size, borderRadius: '50%', filter: 'drop-shadow(0 0 10px rgba(255,201,60,.95))', transformOrigin: '50% 100%' }}>{node}</motion.div>
    : node)

  const wrapDrop = (who, node, size) => (drop && drop.who === who
    ? <DropZone id={drop.id ?? 'stage-target'} onDrop={drop.onDrop} label={drop.label} slop={40}>
        {hover => <motion.div animate={{ scale: hover ? 1.1 : 1, y: hover ? -6 : 0 }} style={{ position: 'relative', width: size }}>{node}</motion.div>}
      </DropZone>
    : node)

  const bubble = (who, size) => bubbles[who] != null &&
    <Wish size={size}>{bubbles[who]}</Wish>

  return (
    // overflow clipped: a scaled stage would otherwise count as content
    // height, and the FitBox around the game would shrink everything
    <div ref={box} style={{ position: 'relative', flex: 1, minHeight, width: '100%', overflow: 'clip' }}>
      <div key={playKey} style={{ position: 'absolute', left: '50%', top: '50%', width: W, height: H, transform: `translate(-50%, -50%) scale(${scale})` }}>
        {/* the ground the scene stands on: a soft patch, not a board */}
        <div style={{ position: 'absolute', left: 30, right: 30, bottom: 4, height: 44, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,255,255,.45), rgba(255,255,255,0) 70%)' }} />
        {started && <Fx kind={fx} />}
        {started && cast.map((raw, i) => {
          const [art, s, whole] = asPerson(raw.a, raw.s ?? 80, raw.sit)
          const c = { ...raw, a: art, s, whole, x: inside(Xc(raw.x), s), to: raw.to != null ? Xc(raw.to) : undefined }
          const feel = looks[i] ?? c.feel
          const m = reduceMotion() ? { initial: false, animate: {} } : act(c, s)
          const body = c.node ?? (c.char || c.feel
            ? <Actor art={c.a} feel={feel} size={s} flip={c.flip} label={c.label} whole={c.whole} />
            : <Thing art={c.a} size={s} flip={c.flip} />)
          return (
            <div key={i} style={{ position: 'absolute', left: c.x - s / 2, bottom: GROUND + (c.y ?? 0), width: s, height: s, zIndex: c.z ?? 1, transform: c.rot ? `rotate(${c.rot}deg)` : undefined }}>
              <motion.div {...m} style={{ width: s, height: s, position: 'relative' }}>
                {c.act === 'down' && <div style={{ position: 'absolute', left: '50%', bottom: '80%', width: 2, height: H, background: '#4a3a6b' }} />}
                <div style={{ filter: tint[i] != null ? `saturate(${tint[i]})` : undefined, transition: 'filter .9s' }}>
                  {wrapTap(i, wrapDrop(i, body, s), s)}
                </div>
                {c.say && <Wish size={s * 0.8} side={c.x > W / 2 ? 'left' : 'right'} style={{ fontSize: 20 }}><Said say={c.say} /></Wish>}
                {bubble(i, s)}
              </motion.div>
            </div>
          )
        })}
        {lumi && (() => {
          const l = { ...lumi, x: X(lumi.x) }
          const s = l.size ?? 150
          const m = reduceMotion() ? { initial: false, animate: {} } : lumiAct(l)
          return (
            <div style={{ position: 'absolute', left: l.x - s / 2, bottom: GROUND - 6 + (l.y ?? 0), width: s, zIndex: 2 }}>
              <motion.div {...m} style={{ position: 'relative', width: s }}>
                {/* `pulse`: a new number makes Lumi swell and settle once (a breath, a hug) */}
                <motion.div key={lumi.pulse ?? 0} animate={lumi.pulse ? { scale: [1, 1.2, 1] } : {}} transition={{ duration: 1, ease: 'easeInOut' }} style={{ transformOrigin: '50% 100%' }}>
                  {wrapTap('lumi', wrapDrop('lumi', <FeelLumi feel={lumi.feel} strength={lumi.strength} size={s} flip={lumi.flip} />, s), s)}
                </motion.div>
                {lumi.say && <Wish size={s * 0.7} side="right" style={{ fontSize: 20 }}><Said say={lumi.say} /></Wish>}
                {/* `hold`: something at Lumi's mouth or hand (a balloon being blown up) */}
                {lumi.hold && <div style={{ position: 'absolute', left: s * 0.72, bottom: s * 0.32, pointerEvents: 'none' }}>{lumi.hold}</div>}
                {bubble('lumi', s)}
              </motion.div>
            </div>
          )
        })()}
        {children}
      </div>
    </div>
  )
}

/** The face of a feeling, with its badge where it has one (Stolz: a medal). */
export function FeelingFace({ feeling, size = 44 }) {
  const badge = FEELING_BADGE[feeling]
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <Art art={FEELING_ICON[feeling]} size={size} />
      {badge && <Art art={badge} size={size * 0.5} style={{ position: 'absolute', right: -size * 0.12, bottom: -size * 0.1 }} />}
    </span>
  )
}

/**
 * Where the hint hand picks something up: one of the tray's pieces, a
 * different one each time it shows the move — never always the right one.
 */
export function useTrayStart(trayRef) {
  const [r] = useState(() => ({
    get current() {
      const items = trayRef.current?.querySelectorAll('.pl-drag[tabindex="0"]')
      if (!items?.length) return trayRef.current
      return items[Math.floor(Date.now() / 7000) % items.length]
    },
  }))
  return r
}

/** A feeling face as a picture with its word: what the child hands over. */
export function FaceChip({ feeling, size = 76, dim = false, glow = false }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      opacity: dim ? 0.35 : 1, filter: dim ? 'grayscale(0.8)' : undefined, transition: 'opacity .3s',
    }}>
      <motion.div animate={glow ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={{ duration: 0.6 }}
        style={{
          width: size + 16, height: size + 16, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#fffdf7', border: '3px solid #2a1b3d', boxShadow: glow ? '0 0 0 5px #ffc93c, 0 5px 0 rgba(42,27,61,.3)' : '0 5px 0 rgba(42,27,61,.3)',
        }}>
        <FeelingFace feeling={feeling} size={size} />
      </motion.div>
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 17, color: '#2a1b3d', textShadow: '0 1px 0 #fff, 0 0 6px #fff' }}>{feeling}</span>
    </div>
  )
}

/** A picture in a round frame with its word under it: a strength, a way to help. */
export function PicChip({ art, size = 60, label, dim = false, glow = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, maxWidth: 130, opacity: dim ? 0.35 : 1, transition: 'opacity .3s' }}>
      <motion.div animate={glow ? { scale: 1.12 } : { scale: 1 }}
        style={{ width: size + 18, height: size + 18, borderRadius: '50%', background: '#fffdf7', border: '3px solid #2a1b3d',
          boxShadow: glow ? '0 0 0 5px #ffc93c, 0 5px 0 rgba(42,27,61,.3)' : '0 5px 0 rgba(42,27,61,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Art art={art} size={size} />
      </motion.div>
      {label && <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, lineHeight: 1.1, color: '#2a1b3d', textAlign: 'center', textShadow: '0 1px 0 #fff, 0 0 6px #fff' }}>{label}</span>}
    </div>
  )
}

/**
 * Do something once Lumi has stopped talking and `ms` of play time have
 * passed — time with the help or the quit dialog open does not count.
 * One pending step at a time; a new one replaces it.
 */
export function useAfter() {
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const stop = useRef(null)
  const cancel = useCallback(() => { stop.current?.(); stop.current = null }, [])
  useEffect(() => cancel, [cancel])
  const after = useCallback((fn, ms = 0, { quiet = true, maxMs = 20000 } = {}) => {
    cancel()
    let timer, wait, alive = true
    const tick = left => {
      if (!alive) return
      if (pausedRef.current) { timer = setTimeout(() => tick(left), 200); return }
      if (left <= 0) { alive = false; fn(); return }
      const step = Math.min(left, 150)
      timer = setTimeout(() => tick(left - step), step)
    }
    if (quiet) wait = afterNarration(() => tick(ms), { minMs: 150, maxMs })
    else tick(ms)
    stop.current = () => { alive = false; clearTimeout(timer); wait?.() }
  }, [cancel])
  return [after, cancel]
}

/** The round button that plays the scene again. */
export function AgainButton({ onClick }) {
  return (
    <motion.button whileTap={{ scale: 0.88, rotate: -90 }} onClick={onClick} aria-label="Nochmal anschauen" title="Nochmal anschauen"
      style={{
        width: 56, height: 56, flexShrink: 0, borderRadius: '50%', cursor: 'pointer', padding: 0,
        background: '#fffdf7', border: '3px solid var(--px-ink)', boxShadow: '0 4px 0 var(--px-ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}><Art art="🔄" size={36} /></motion.button>
  )
}

/** What a speech bubble holds: pictures (an array) or a short word. */
function Said({ say }) {
  return Array.isArray(say) ? say.map((a, i) => <Art key={i} art={a} size={40} />) : say
}

/** An empty face with a question mark: "how does … feel?" */
export function AskFace({ size = 44, art }) {
  return (
    <motion.span animate={{ rotate: [-6, 6] }} transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror' }}
      style={{ width: size, height: size, borderRadius: '50%', border: '3px dashed #6b3fd6', background: '#f4efff',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 700,
        fontSize: size * 0.62, color: '#6b3fd6', lineHeight: 1 }}>
      {art ? <Art art={art} size={size * 0.7} /> : '?'}
    </motion.span>
  )
}

// How long the moves of a scene take, in ms: the child acts once it has played
const ACT_MS = { drop: 900, in: 1300, inL: 1300, out: 1400, visit: 2600, grab: 2600, give: 900, up: 2200, fall: 800, topple: 1300,
  bang: 500, down: 2000, grow: 1200, pass: 2000, sweep: 2400, zoom: 1800, sink: 1400, jack: 700, scribble: 2700, flicker: 1200 }
const LUMI_MS = { in: 1400, run: 1100, stumble: 2200, climb: 1800, away: 2000 }
export function sceneLength(cast = [], lumi) {
  if (reduceMotion()) return 600
  const ends = cast.map(c => (c.d ?? 0) * 1000 + (ACT_MS[c.act] ?? 500))
  if (lumi?.act) ends.push((lumi.d ?? 0) * 1000 + (LUMI_MS[lumi.act] ?? 500))
  return Math.max(900, ...ends)
}
