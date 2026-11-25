import { useId } from 'react'
import { motion } from 'framer-motion'

/**
 * The animal friends of Gefühlsdetektiv, and Lumi the detective.
 *
 * One round body with a face, and what makes the animal: ears, muzzle,
 * nose, tail, markings. Face, arms, ears and the whole body show a feeling,
 * so a friend can be read without a word: hanging ears and tears, fists and
 * steam, wide eyes and trembling, a medal and a straight back.
 *
 *   <Pal kind="hase" feel="sad" size={150} />
 *
 * Drawn in a 120 × 130 box, feet on the bottom edge.
 */
export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const OUT = '#4a2a22'
const CHEEK = '#ff9db0'
const DARK = '#33293d'
const BODY_PATH = 'M60 22 C87 22 105 44 107 72 C109 99 92 116 60 116 C28 116 11 99 13 72 C15 44 33 22 60 22 Z'

export const SPECIES = {
  hase:    { body: '#ece4dc', shade: '#cbbeb3', muzzle: '#fffaf4', inner: '#ffb3c4', nose: '#ff8fa8', ears: 'hare', tail: 'puff', whiskers: true },
  katze:   { body: '#ffb24d', shade: '#e8872c', muzzle: '#fff3dc', inner: '#ffc9d2', nose: '#ff7d95', ears: 'cat', tail: 'cat', whiskers: true, stripes: '#d9741c' },
  baer:    { body: '#bb7a44', shade: '#955829', muzzle: '#f1cfa3', inner: '#f1cfa3', nose: OUT, ears: 'round', tail: 'stub' },
  hund:    { body: '#f5d391', shade: '#dba95b', muzzle: '#fff6e2', inner: '#b9763f', nose: OUT, ears: 'flop', tail: 'wag', patch: '#e2ae66' },
  maus:    { body: '#bcb9c8', shade: '#9490a6', muzzle: '#e8e5f0', inner: '#ffb9cb', nose: '#ff8fa8', ears: 'mouse', tail: 'thin', whiskers: true },
  fuchs:   { body: '#ff8b3d', shade: '#dd661f', muzzle: '#fff6ea', inner: DARK, nose: OUT, ears: 'fox', tail: 'fox', wide: true },
  schwein: { body: '#ffb6c8', shade: '#f08ca6', inner: '#f08ca6', ears: 'pig', tail: 'curl', snout: '#ff95af' },
  panda:   { body: '#fbfbf7', shade: '#d6d6dc', inner: '#55495f', ears: 'round', earFill: DARK, patches: DARK, nose: DARK, limb: DARK, tail: 'stub' },
  loewe:   { body: '#ffca5c', shade: '#eda434', muzzle: '#fff3d6', inner: '#eda434', mane: '#c96a2a', ears: 'round', nose: '#7a3d22', tail: 'lion' },
  lumi:    { body: '#ffe165', shade: '#f6b23e', ears: 'tuft' },
}

// Eyes, brows, mouth and arms of each face
const FACES = {
  neutral:   { eyes: 'open',   mouth: 'tiny',   arms: 'down' },
  content:   { eyes: 'open',   mouth: 'smile',  arms: 'down', cheeks: true },
  calm:      { eyes: 'closed', mouth: 'smile',  arms: 'down', cheeks: true },
  asleep:    { eyes: 'closed', mouth: 'smile',  arms: 'down', cheeks: true },
  happy:     { eyes: 'happy',  mouth: 'grin',   arms: 'up',   cheeks: true, brows: 'M38 50 Q46 45 53 50 M67 50 Q74 45 82 50' },
  sad:       { eyes: 'open',   mouth: 'frown',  arms: 'down', brows: 'M39 52 L52 47 M81 52 L68 47', look: 2 },
  angry:     { eyes: 'narrow', mouth: 'teeth',  arms: 'fists', brows: 'M38 50 L53 57 M82 50 L67 57', flush: true },
  scared:    { eyes: 'wide',   mouth: 'wobble', arms: 'cross', brows: 'M38 48 Q45 42 52 47 M68 47 Q75 42 82 48' },
  excited:   { eyes: 'star',   mouth: 'grin',   arms: 'up',   cheeks: true, brows: 'M38 48 Q46 42 53 48 M67 48 Q74 42 82 48' },
  tired:     { eyes: 'half',   mouth: 'yawn',   arms: 'down', brows: 'M39 54 L52 54 M68 54 L81 54' },
  // embarrassed, as on the Verlegen face of Gefühlswelt: eyes down and away,
  // a small crooked smile under a big blush, one paw at the cheek (the wavy
  // mouth, the sweat drop and both hands at the cheeks read as worried)
  shy:       { eyes: 'away',   mouth: 'sheepish', arms: 'cheek', blush: true, brows: 'M39 50 Q45 46 52 48 M81 50 Q75 46 68 48' },
  surprised: { eyes: 'wide',   mouth: 'O',      arms: 'up',   brows: 'M38 46 Q45 39 52 45 M68 45 Q75 39 82 46' },
  proud:     { eyes: 'closed', mouth: 'smug',   arms: 'hips', cheeks: true, brows: 'M39 50 Q46 46 52 49 M68 49 Q74 46 81 50' },
  bored:     { eyes: 'half',   mouth: 'flat',   arms: 'down', brows: 'M39 55 L52 55 M68 55 L81 55', look: 1 },
  curious:   { eyes: 'curious', mouth: 'o',     arms: 'chest', brows: 'M39 51 Q46 47 52 50 M67 44 Q74 39 82 45' },
  // Lumi the detective
  kind:      { eyes: 'open',   mouth: 'smile',  arms: 'down', cheeks: true },
  laugh:     { eyes: 'happy',  mouth: 'grin',   arms: 'point', brows: 'M38 48 L53 52 M82 48 L67 52' },
  scold:     { eyes: 'narrow', mouth: 'shout',  arms: 'wag',  brows: 'M38 50 L53 57 M82 50 L67 57' },
  oops:      { eyes: 'side',   mouth: 'wobble', arms: 'down', blush: true, brows: 'M39 51 L52 48 M81 51 L68 48' },
  away:      { eyes: 'half',   mouth: 'flat',   arms: 'down', brows: 'M39 55 L52 55 M68 55 L81 55' },
}

function Eye({ kind, cx, cy, look = 0, right, ink, glint }) {
  const fill = { fill: ink }
  const line = { fill: 'none', stroke: ink, strokeWidth: 3.2, strokeLinecap: 'round' }
  switch (kind) {
    case 'happy':  return <path d={`M${cx - 7} ${cy + 2} Q${cx} ${cy - 7} ${cx + 7} ${cy + 2}`} {...line} />
    case 'closed': return <path d={`M${cx - 7} ${cy - 1} Q${cx} ${cy + 5} ${cx + 7} ${cy - 1}`} {...line} />
    case 'narrow': return <ellipse cx={cx} cy={cy + 1} rx="6.5" ry="3.4" {...fill} />
    case 'wide':   return <g><circle cx={cx} cy={cy} r="8.5" fill="#fff" stroke={OUT} strokeWidth="2.4" /><circle cx={cx} cy={cy + 1} r="3.4" fill={OUT} /></g>
    case 'half':   return <g><path d={`M${cx - 7} ${cy} A7 7 0 0 0 ${cx + 7} ${cy} Z`} {...fill} /><path d={`M${cx - 8} ${cy} L${cx + 8} ${cy}`} {...line} /></g>
    case 'down':   return <g><ellipse cx={cx} cy={cy + 3} rx="5" ry="5.5" {...fill} /><path d={`M${cx - 7} ${cy - 2} Q${cx} ${cy - 4} ${cx + 7} ${cy - 2}`} {...line} strokeWidth="2.4" /></g>
    case 'away':   return <g><ellipse cx={cx - 3} cy={cy + 3} rx="5" ry="5.5" {...fill} /><path d={`M${cx - 7} ${cy - 2} Q${cx} ${cy - 4} ${cx + 7} ${cy - 2}`} {...line} strokeWidth="2.4" /></g>
    case 'side':   return <g><ellipse cx={cx} cy={cy} rx="7.5" ry="6.5" fill="#fff" stroke={OUT} strokeWidth="2.4" /><circle cx={cx - 3.5} cy={cy + 1} r="3.4" fill={OUT} /></g>
    case 'star': {
      const p = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? 3.6 : 9, a = -Math.PI / 2 + (i * Math.PI) / 5
        return `${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`
      }).join(' L')
      return <path d={`M${p} Z`} fill="#ffb200" stroke={OUT} strokeWidth="1.8" strokeLinejoin="round" />
    }
    case 'curious':
      return right
        ? <g><ellipse cx={cx} cy={cy} rx="8" ry="9" {...fill} /><circle cx={cx - 2.5} cy={cy - 3} r="2.8" fill={glint} /></g>
        : <g><ellipse cx={cx} cy={cy + 1} rx="5" ry="5.5" {...fill} /><circle cx={cx - 1.6} cy={cy - 1} r="1.8" fill={glint} /></g>
    default:
      return <g><ellipse cx={cx} cy={cy + look} rx="6.5" ry="7.5" {...fill} /><circle cx={cx - 2.4} cy={cy - 2.6 + look} r="2.4" fill={glint} /></g>
  }
}

function Mouth({ kind }) {
  const line = { fill: 'none', stroke: OUT, strokeWidth: 3.2, strokeLinecap: 'round', strokeLinejoin: 'round' }
  switch (kind) {
    case 'smile':  return <path d="M51 79 Q60 87 69 79" {...line} />
    case 'grin':   return <g><path d="M48 77 Q60 96 72 77 Z" fill={OUT} stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" /><ellipse cx="60" cy="87" rx="5.5" ry="3" fill="#ff6b7d" /></g>
    case 'frown':  return <path d="M51 87 Q60 78 69 87" {...line} />
    case 'teeth':  return <g><rect x="49" y="79" width="22" height="9" rx="3" fill="#fff" stroke={OUT} strokeWidth="2.6" /><path d="M56 79 V88 M64 79 V88" stroke={OUT} strokeWidth="2" /></g>
    case 'shout':  return <g><path d="M49 80 Q60 76 71 80 L68 92 Q60 95 52 92 Z" fill={OUT} stroke={OUT} strokeWidth="2" strokeLinejoin="round" /><path d="M54 81.5 H66" stroke="#fff" strokeWidth="3" strokeLinecap="round" /></g>
    case 'wobble': return <path d="M49 84 q3.7 -4 7.3 0 q3.7 4 7.3 0 q3.7 -4 7.3 0" {...line} strokeWidth="2.8" />
    case 'O':      return <ellipse cx="60" cy="86" rx="6" ry="8" fill={OUT} />
    case 'o':      return <ellipse cx="62" cy="85" rx="3.6" ry="4.2" fill={OUT} />
    case 'yawn':   return <g><ellipse cx="60" cy="87" rx="6.5" ry="8.5" fill={OUT} /><ellipse cx="60" cy="91" rx="3.6" ry="3" fill="#ff6b7d" /></g>
    case 'flat':   return <path d="M53 84 L68 83" {...line} />
    case 'sheepish': return <path d="M53 83 Q58 88 67 81" {...line} />
    case 'smug':   return <path d="M51 80 Q61 89 70 78" {...line} />
    default:       return <path d="M56 81 Q60 84 64 81" {...line} strokeWidth="2.8" />
  }
}

// Arm nubs: [cx, cy, rotate] left and right; in front of the body or behind it
const ARMS = {
  down:   { l: [15, 84, 25],  r: [105, 84, -25] },
  fists:  { l: [14, 84, 0],   r: [106, 84, 0], fist: true },
  up:     { l: [13, 50, -35], r: [107, 50, 35] },
  hips:   { l: [17, 84, -45], r: [103, 84, 45], front: true },
  face:   { l: [36, 80, 15],  r: [84, 80, -15], front: true },
  cheek:  { l: [15, 84, 25],  r: [88, 76, -20], front: true },
  chest:  { l: [52, 98, 40],  r: [68, 98, -40], front: true },
  cross:  { l: [50, 98, 70],  r: [70, 100, -70], front: true },
  holdR:  { l: [15, 84, 25],  r: [108, 68, 50] },
  holdL:  { l: [12, 68, -50], r: [105, 84, -25] },
  holdUp: { l: [16, 42, -18], r: [104, 42, 18] },
  hugR:   { l: [88, 94, 80],  r: [110, 78, 80], front: true },
  hugL:   { l: [10, 78, -80], r: [32, 94, -80], front: true },
  point:  { l: [15, 84, 25],  r: [113, 72, 90] },
  wag:    { l: [17, 84, -45], r: [108, 46, 20], wag: true },
  clap:   { l: [48, 90, 55],  r: [72, 90, -55], front: true, clap: true },
  work:   { l: [15, 84, 25],  r: [110, 76, 75], work: true },
}
/** Where the hand of a holding arm is, in the 120 × 130 box */
const HAND = { holdR: [118, 56], holdL: [2, 56], holdUp: [60, 30] }

function Arms({ pose, fill, still }) {
  const A = ARMS[pose] ?? ARMS.down
  return [A.l, A.r].map(([cx, cy, rot], i) => {
    const arm = A.fist
      ? <circle cx={cx} cy={cy} r="7.5" fill={fill} stroke={OUT} strokeWidth="3" />
      : <ellipse cx={cx} cy={cy} rx="6.5" ry="11" fill={fill} stroke={OUT} strokeWidth="3" transform={`rotate(${rot} ${cx} ${cy})`} />
    if (still) return <g key={i}>{arm}</g>
    if (A.clap) return <motion.g key={i} animate={{ x: i ? [5, -3, 5] : [-5, 3, -5] }} transition={{ duration: 0.3, repeat: Infinity }}>{arm}</motion.g>
    if ((A.wag || A.work) && i === 1) return (
      <motion.g key={i} animate={{ rotate: A.wag ? [-14, 14] : [-18, 10] }} transition={{ duration: A.wag ? 0.22 : 0.3, repeat: Infinity, repeatType: 'mirror' }}
        style={{ transformBox: 'view-box', transformOrigin: A.wag ? '104px 60px' : '104px 82px' }}>{arm}</motion.g>
    )
    return <g key={i}>{arm}</g>
  })
}

// Ears hang with the heavy feelings
const DROOP = { sad: 1, scared: 0.75, tired: 0.9, shy: 0.7, bored: 0.6, asleep: 0.5, oops: 0.4 }

function Ears({ sp, feel }) {
  const d = DROOP[feel] ?? 0
  const st = { fill: sp.earFill ?? sp.body, stroke: OUT, strokeWidth: 3, strokeLinejoin: 'round' }
  switch (sp.ears) {
    case 'hare': return <g>{[[42, -1], [78, 1]].map(([x, dir]) => (
      <g key={x} transform={`rotate(${dir * (12 + d * 78)} ${x} 32)`}><ellipse cx={x} cy="8" rx="9.5" ry="25" {...st} /><ellipse cx={x} cy="9" rx="4.2" ry="16" fill={sp.inner} /></g>))}</g>
    case 'round': return <g>{[30, 90].map(x => <g key={x}><circle cx={x} cy={32 + d * 3} r="13" {...st} /><circle cx={x} cy={32 + d * 3} r="6" fill={sp.inner} /></g>)}</g>
    case 'mouse': return <g>{[25, 95].map(x => <g key={x}><circle cx={x} cy={29 + d * 7} r="19" {...st} /><circle cx={x} cy={29 + d * 7} r="11.5" fill={sp.inner} /></g>)}</g>
    case 'cat': return <g>{[-1, 1].map(dir => (
      <g key={dir} transform={`rotate(${dir * d * 30} ${60 + dir * 22} 40)`}>
        <path d={dir < 0 ? 'M24 46 L29 8 L54 28 Z' : 'M96 46 L91 8 L66 28 Z'} {...st} />
        <path d={dir < 0 ? 'M31 36 L32 18 L44 28 Z' : 'M89 36 L88 18 L76 28 Z'} fill={sp.inner} />
      </g>))}</g>
    case 'fox': return <g>{[-1, 1].map(dir => (
      <g key={dir} transform={`rotate(${dir * d * 32} ${60 + dir * 22} 40)`}>
        <path d={dir < 0 ? 'M21 48 L24 2 L55 27 Z' : 'M99 48 L96 2 L65 27 Z'} {...st} />
        <path d={dir < 0 ? 'M24 2 L23.5 17 L35 11 Z' : 'M96 2 L96.5 17 L85 11 Z'} fill={sp.inner} stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
      </g>))}</g>
    case 'pig': return <g>{[-1, 1].map(dir => (
      <path key={dir} transform={`rotate(${dir * d * 25} ${60 + dir * 24} 36)`} d={dir < 0 ? 'M24 42 L26 14 L50 28 Z' : 'M96 42 L94 14 L70 28 Z'} {...st} fill={sp.shade} />))}</g>
    case 'tuft': return <path d="M54 26 C51 14 59 4 71 5 C66 9 68 13 75 11 C74 20 67 26 61 26 Z" {...st} />
    default: return null
  }
}

function Tail({ sp }) {
  const o = { fill: 'none', stroke: OUT, strokeLinecap: 'round' }
  switch (sp.tail) {
    case 'puff': return <circle cx="104" cy="103" r="10" fill="#fff" stroke={OUT} strokeWidth="3" />
    case 'stub': return <circle cx="103" cy="103" r="8" fill={sp.limb ?? sp.shade} stroke={OUT} strokeWidth="3" />
    case 'cat':  return <g><path d="M96 106 C120 110 124 88 113 76" {...o} strokeWidth="14" /><path d="M96 106 C120 110 124 88 113 76" {...o} stroke={sp.body} strokeWidth="8" /></g>
    case 'thin': return <path d="M98 108 C122 114 128 94 116 88 C110 85 108 94 114 96" {...o} stroke="#e8809a" strokeWidth="4" />
    case 'wag':  return <g><path d="M98 100 C112 99 117 89 113 80" {...o} strokeWidth="13" /><path d="M98 100 C112 99 117 89 113 80" {...o} stroke={sp.body} strokeWidth="7" /></g>
    case 'curl': return <path d="M102 98 c9 -3 12 6 5 8 c-6 2 -7 -6 -1 -6" {...o} stroke="#d96a88" strokeWidth="4" />
    case 'fox':  return <g><path d="M94 108 C116 120 136 98 124 70 C120 88 110 94 98 92 Z" fill={sp.body} stroke={OUT} strokeWidth="3" strokeLinejoin="round" /><path d="M124 70 C129 82 128 92 122 100 C120 92 120 84 121 79 Z" fill="#fff6ea" stroke={OUT} strokeWidth="2.4" strokeLinejoin="round" /></g>
    case 'lion': return <g><path d="M98 106 C118 110 124 94 116 84" {...o} strokeWidth="10" /><path d="M98 106 C118 110 124 94 116 84" {...o} stroke={sp.body} strokeWidth="5" /><circle cx="116" cy="82" r="8" fill={sp.mane} stroke={OUT} strokeWidth="2.6" /></g>
    default: return null
  }
}

// What floats around a friend: tears, steam, Zzz … `n` grows with the strength.
function Marks({ feel, n, still }) {
  const blue = '#4aa3ff'
  const loop = (animate, transition) => (still ? {} : { animate, transition: { repeat: Infinity, ...transition } })
  if (feel === 'sad') return (
    <g fill={blue}>
      {n >= 2
        ? <><rect x="41" y="68" width="6" height="36" rx="3" opacity="0.85" /><rect x="73" y="68" width="6" height="36" rx="3" opacity="0.85" />
            <ellipse cx="34" cy="119" rx="12" ry="4" opacity="0.7" /><ellipse cx="86" cy="119" rx="12" ry="4" opacity="0.7" /></>
        : <><motion.path d="M44 68 q-4 8 0 11 q4 -3 0 -11" {...loop({ y: [0, 16], opacity: [1, 0] }, { duration: 1.4 })} />
            <motion.path d="M76 68 q-4 8 0 11 q4 -3 0 -11" {...loop({ y: [0, 16], opacity: [1, 0] }, { duration: 1.4, delay: 0.7 })} /></>}
    </g>
  )
  if (feel === 'angry' || feel === 'scold') return (
    <g fill="#fff" stroke={OUT} strokeWidth="2">
      {[[10, 20], [98, 18], [54, -4]].slice(0, n + 1).map(([x, y], i) => (
        <motion.g key={i} {...loop({ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }, { duration: 0.8, delay: i * 0.25 })}>
          <circle cx={x} cy={y + 6} r="6" /><circle cx={x + 7} cy={y + 2} r="7" /><circle cx={x + 13} cy={y + 7} r="5" />
        </motion.g>
      ))}
    </g>
  )
  if (feel === 'scared') return (
    <g fill="#8fd3ff" stroke={OUT} strokeWidth="1.6">
      <path d="M97 36 q-6 10 0 13 q6 -3 0 -13" />
      <path d="M23 42 q-5 8 0 11 q5 -3 0 -11" />
      {n >= 2 && <path d="M108 58 q-5 8 0 11 q5 -3 0 -11" />}
    </g>
  )
  if (feel === 'tired' || feel === 'asleep') return (
    <motion.text x="88" y="24" fontFamily="var(--font-heading)" fontWeight="700" fontSize={feel === 'asleep' ? 24 : 15 + n * 3} fill={blue} stroke="#fff" strokeWidth="0.6"
      {...loop({ opacity: [0.3, 1, 0.3], y: [0, -6, 0] }, { duration: 2.2 })}>Zzz</motion.text>
  )
  if (feel === 'surprised' || feel === 'curious') return (
    <text x="98" y="28" fontFamily="var(--font-heading)" fontWeight="700" fontSize={26 + n * 4}
      fill={feel === 'curious' ? '#6b3fd6' : '#ffb200'} stroke={OUT} strokeWidth="1.5">
      {feel === 'curious' ? '?' : n >= 2 ? '!!' : '!'}
    </text>
  )
  if (feel === 'proud') return (
    <g>
      <path d="M53 90 L60 102 L67 90" fill="none" stroke="#4a8ee6" strokeWidth="5" />
      <circle cx="60" cy="106" r="8" fill="#ffc93c" stroke={OUT} strokeWidth="2.2" />
      <path d="M60 101 l1.6 3.2 3.4 .5 -2.5 2.4 .6 3.4 -3.1 -1.6 -3.1 1.6 .6 -3.4 -2.5 -2.4 3.4 -.5 z" fill="#fff6c8" />
      {[[104, 18], [14, 26]].slice(0, n).map(([x, y], i) => (
        <motion.path key={i} d={`M${x} ${y - 8} l2.5 5.5 5.5 2.5 -5.5 2.5 -2.5 5.5 -2.5 -5.5 -5.5 -2.5 5.5 -2.5 z`} fill="#ffc93c" stroke={OUT} strokeWidth="1.4"
          {...loop({ scale: [0.7, 1.2, 0.7] }, { duration: 1.2, delay: i * 0.4 })} style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
      ))}
    </g>
  )
  if (feel === 'excited' || feel === 'happy') {
    const spots = [[10, 30], [108, 26], [98, 2]]
    return (
      <g fill="#ffc93c" stroke={OUT} strokeWidth="1.4">
        {spots.slice(0, feel === 'excited' ? 3 : n).map(([x, y], i) => (
          <motion.path key={i} d={`M${x} ${y - 8} L${x + 2.5} ${y - 2.5} L${x + 8} ${y} L${x + 2.5} ${y + 2.5} L${x} ${y + 8} L${x - 2.5} ${y + 2.5} L${x - 8} ${y} L${x - 2.5} ${y - 2.5} Z`}
            {...loop({ scale: [0.7, 1.2, 0.7], rotate: [0, 30, 0] }, { duration: 1.2, delay: i * 0.3 })}
            style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
        ))}
      </g>
    )
  }
  if (feel === 'bored') return (
    <motion.g {...loop({ x: [0, 12], y: [0, -4], opacity: [0.9, 0] }, { duration: 2 })}>
      <circle cx="80" cy="92" r="4.5" fill="#fff" stroke={OUT} strokeWidth="1.4" /><circle cx="89" cy="88" r="3.2" fill="#fff" stroke={OUT} strokeWidth="1.2" />
    </motion.g>
  )
  if (feel === 'shy' || feel === 'oops') return (
    <g stroke="#e8506e" strokeWidth="2" strokeLinecap="round">
      <path d="M26 66 l4 -5 M31 67 l4 -5 M85 66 l4 -5 M90 67 l4 -5" />
      {n >= 2 && feel === 'oops' && <path d="M100 34 q-6 10 0 13 q6 -3 0 -13" fill="#8fd3ff" stroke={OUT} strokeWidth="1.6" />}
    </g>
  )
  if (feel === 'laugh') return (
    <g fill="#8fd3ff" stroke={OUT} strokeWidth="1.4">
      <path d="M33 60 q-7 3 -6 9 q6 -1 6 -9" /><path d="M87 60 q7 3 6 9 q-6 -1 -6 -9" />
    </g>
  )
  return null
}

// How the whole body moves with a feeling; `k` is the strength (1 or 1.4)
function bodyMotion(feel, k) {
  const loop = (d, more = {}) => ({ duration: d, repeat: Infinity, ease: 'easeInOut', ...more })
  switch (feel) {
    case 'happy':     return { animate: { y: [0, -12 * k, 0], rotate: 0, scaleY: 1 }, transition: loop(0.7) }
    case 'excited':   return { animate: { y: [0, -20 * k, 0], rotate: [0, -7 * k, 7 * k, 0], scaleY: 1 }, transition: loop(0.6) }
    case 'laugh':     return { animate: { y: [0, -7, 0], rotate: [0, -5, 5, 0] }, transition: loop(0.4) }
    case 'sad':       return { animate: { y: 4 * k, scaleY: 1 - 0.06 * k, rotate: [0, -3, 3, 0] }, transition: { rotate: loop(3), default: { duration: 0.6 } } }
    case 'angry':     return { animate: { x: [-2 * k, 2 * k], y: [0, -5 * k, 0], scale: 1 + 0.03 * k, rotate: 0 }, transition: { x: { duration: 0.09, repeat: Infinity, repeatType: 'mirror' }, y: loop(0.45) } }
    case 'scold':     return { animate: { rotate: [8, 12], y: [0, -4, 0] }, transition: { rotate: loop(0.3, { repeatType: 'mirror' }), y: loop(0.3) } }
    case 'scared':    return { animate: { x: [-1.8 * k, 1.8 * k], scale: 1 - 0.05 * k, rotate: 0 }, transition: { x: { duration: 0.06, repeat: Infinity, repeatType: 'mirror' } } }
    case 'tired':     return { animate: { rotate: [-4 * k, 4 * k], y: 3, scaleY: 0.96 }, transition: { rotate: loop(2.6, { repeatType: 'mirror' }) } }
    case 'asleep':    return { animate: { scaleY: [1, 1.04, 1], y: 2 }, transition: loop(3) }
    case 'shy':       return { animate: { rotate: [-6, 6], scale: 0.95, y: 0 }, transition: { rotate: loop(1.4, { repeatType: 'mirror' }) } }
    case 'oops':      return { animate: { rotate: -5, scale: 0.94, y: 0 }, transition: { duration: 0.4 } }
    case 'surprised': return { animate: { y: [0, -20 * k, 0], scaleY: [1, 1.1, 1.05], rotate: 0 }, transition: { duration: 0.5 } }
    case 'proud':     return { animate: { scaleY: 1 + 0.07 * k, rotate: -7, y: -3 }, transition: { type: 'spring', stiffness: 200, damping: 10 } }
    case 'bored':     return { animate: { scaleY: [0.95, 0.91, 0.95], rotate: 4, y: 3 }, transition: { scaleY: loop(3) } }
    case 'curious':   return { animate: { rotate: [8, 12], x: 4, y: -3, scale: 1 }, transition: { rotate: loop(1.2, { repeatType: 'mirror' }) } }
    default:          return { animate: { y: [0, -3, 0], scaleY: [1, 1.02, 1], rotate: 0, x: 0, scale: 1 }, transition: loop(2.6) }
  }
}

/**
 * `kind` the animal (SPECIES), `feel` its face (FACES), `strength` 1 or 2
 * (more tears, more steam), `arms` another arm pose than the face's own,
 * `hold` something in its hand ({ node, at: 'holdR' | 'holdL' | 'holdUp' }),
 * `hat` Lumi's detective cap, `cover` a blanket, `still` no movement
 * (pictures on cards).
 */
export default function Pal({ kind = 'hase', feel = 'neutral', strength = 1, size = 150, flip = false, arms, hold, hat = false, cover = false, still = false }) {
  const clip = useId()
  const sp = SPECIES[kind] ?? SPECIES.hase
  const F = FACES[feel] ?? FACES.neutral
  const pose = arms ?? hold?.at ?? F.arms
  const A = ARMS[pose] ?? ARMS.down
  const quiet = still || reduceMotion()
  const m = quiet ? { animate: {}, transition: {} } : bodyMotion(feel, strength >= 2 ? 1.4 : 1)
  const limb = sp.limb ?? sp.body
  const ink = sp.patches ? '#fff' : OUT
  const glint = sp.patches ? DARK : '#fff'
  const animal = kind !== 'lumi'
  const ex = sp.snout ? 2 : 0
  const droop = DROOP[feel] ?? 0
  const hand = HAND[hold?.at] ?? HAND.holdR
  const h = size * 1.08
  return (
    <motion.div key={feel} {...m} style={{ position: 'relative', width: size, height: h, transformOrigin: '50% 100%' }}>
      <svg viewBox="0 0 120 130" width={size} height={h} style={{ display: 'block', overflow: 'visible', transform: flip ? 'scaleX(-1)' : undefined }} aria-hidden="true">
        <defs><clipPath id={clip}><path d={BODY_PATH} /></clipPath></defs>
        <ellipse cx="60" cy="124" rx="34" ry="4.5" fill="rgba(42,27,61,0.18)" />
        {sp.mane && <g fill={sp.mane} stroke={OUT} strokeWidth="3">
          {Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (0.92 + (i * 1.16) / 12); return <circle key={i} cx={60 + 49 * Math.cos(a)} cy={66 + 49 * Math.sin(a)} r="13" /> })}
          <circle cx="60" cy="64" r="50" stroke="none" />
        </g>}
        <Tail sp={sp} />
        {!A.front && <Arms pose={pose} fill={limb} still={quiet} />}
        {sp.ears !== 'flop' && !(hat && sp.ears === 'tuft') && <Ears sp={sp} feel={feel} />}
        <ellipse cx="44" cy="118" rx="10" ry="6" fill={sp.limb ?? sp.shade} stroke={OUT} strokeWidth="3" />
        <ellipse cx="76" cy="118" rx="10" ry="6" fill={sp.limb ?? sp.shade} stroke={OUT} strokeWidth="3" />
        <path d={BODY_PATH} fill={sp.body} />
        <g clipPath={`url(#${clip})`}>
          <ellipse cx="60" cy="120" rx="54" ry="24" fill={sp.shade} />
          {sp.wide && <path d="M8 70 C30 74 44 92 60 92 C76 92 90 74 112 70 L112 120 L8 120 Z" fill={sp.muzzle} />}
          {sp.muzzle && !sp.wide && <ellipse cx="60" cy="86" rx="23" ry="16" fill={sp.muzzle} />}
          {sp.patch && <ellipse cx="80" cy="56" rx="17" ry="19" fill={sp.patch} />}
          {sp.stripes && <path d="M60 22 V36 M48 24 L50 35 M72 24 L70 35 M13 66 H25 M14 78 H24 M107 66 H95 M106 78 H96" stroke={sp.stripes} strokeWidth="4.5" strokeLinecap="round" />}
          {sp.patches && <g fill={sp.patches}><ellipse cx="44" cy="58" rx="13" ry="15.5" transform="rotate(14 44 58)" /><ellipse cx="76" cy="58" rx="13" ry="15.5" transform="rotate(-14 76 58)" /></g>}
          {F.flush && <rect x="0" y="0" width="120" height="130" fill="#ff4a3a" opacity={0.16 + strength * 0.08} />}
        </g>
        <path d={BODY_PATH} fill="none" stroke={OUT} strokeWidth="3.4" />
        {!sp.patches && <ellipse cx="36" cy="40" rx="7" ry="4.5" fill="#fff" opacity="0.8" transform="rotate(-35 36 40)" />}
        {sp.ears === 'flop' && <g fill={sp.inner} stroke={OUT} strokeWidth="3">
          <ellipse cx="17" cy={56 + droop * 4} rx="10" ry="23" transform="rotate(14 17 56)" /><ellipse cx="103" cy={56 + droop * 4} rx="10" ry="23" transform="rotate(-14 103 56)" /></g>}
        {(F.cheeks || F.blush) && <g fill={F.blush ? '#ff6f8f' : CHEEK} opacity={F.blush ? 0.9 : 0.75}>
          <ellipse cx="31" cy="74" rx={F.blush ? 10 : 7} ry={F.blush ? 6.5 : 4.5} /><ellipse cx="89" cy="74" rx={F.blush ? 10 : 7} ry={F.blush ? 6.5 : 4.5} /></g>}
        {F.flush && <g fill="#ff5b4a" opacity="0.6"><ellipse cx="31" cy="74" rx="8" ry="5" /><ellipse cx="89" cy="74" rx="8" ry="5" /></g>}
        {sp.whiskers && <path d="M27 80 L12 77 M27 85 L13 88 M93 80 L108 77 M93 85 L107 88" stroke={OUT} strokeWidth="1.8" strokeLinecap="round" opacity="0.7" />}
        <g transform={animal ? 'translate(0 -3)' : undefined}>
          <Eye kind={F.eyes} cx={46 - ex} cy={63} look={F.look} ink={ink} glint={glint} />
          <Eye kind={F.eyes} cx={74 + ex} cy={63} look={F.look} ink={ink} glint={glint} right />
          {F.brows && <path d={F.brows} fill="none" stroke={ink} strokeWidth="3" strokeLinecap="round" />}
        </g>
        {sp.snout
          ? <g><ellipse cx="60" cy="74" rx="11" ry="7.5" fill={sp.snout} stroke={OUT} strokeWidth="2.6" /><ellipse cx="56" cy="74" rx="1.8" ry="2.6" fill={OUT} /><ellipse cx="64" cy="74" rx="1.8" ry="2.6" fill={OUT} /></g>
          : sp.nose && <path d="M54.5 70.5 Q60 67.5 65.5 70.5 Q65 76 60 77.5 Q55 76 54.5 70.5 Z" fill={sp.nose} stroke={OUT} strokeWidth="1.6" strokeLinejoin="round" />}
        <g transform={animal ? `translate(0 ${sp.snout ? 5 : 3})` : undefined}><Mouth kind={F.mouth} /></g>
        {hat && <g>
          <path d="M26 36 C24 8 96 8 94 36 Z" fill="#b7814a" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
          <path d="M44 14 L50 35 M60 11 V35 M76 14 L70 35" stroke="#8a5a2c" strokeWidth="2.4" />
          <path d="M17 37 Q60 27 103 37 Q104 43 60 41 Q16 43 17 37 Z" fill="#8a5a2c" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
          <circle cx="60" cy="10" r="4" fill="#8a5a2c" stroke={OUT} strokeWidth="2.4" />
        </g>}
        {cover && <g>
          <path d="M6 84 Q60 70 114 84 L118 122 Q60 130 2 122 Z" fill="#7fb8ff" stroke={OUT} strokeWidth="3" strokeLinejoin="round" />
          <path d="M8 96 Q60 84 112 96 M5 109 Q60 98 115 109 M34 79 L30 125 M60 76 V127 M86 79 L90 125" stroke="#4a8ee6" strokeWidth="2.6" fill="none" />
        </g>}
        {A.front && !cover && <Arms pose={pose} fill={limb} still={quiet} />}
        <Marks feel={feel} n={strength} still={quiet} />
      </svg>
      {hold?.node && (
        <div style={{ position: 'absolute', left: ((flip ? 120 - hand[0] : hand[0]) / 120) * size, top: (hand[1] / 130) * h, width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <div style={{ flexShrink: 0, transform: 'translateY(-50%)' }}>{hold.node}</div>
        </div>
      )}
    </motion.div>
  )
}
