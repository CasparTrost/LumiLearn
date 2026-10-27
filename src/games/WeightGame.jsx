import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, lockPreviews, stopNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { hearable } from '../lib/hearable.js'
import { emojiSrc, hasEmojiArt } from '../lib/emojiArt.jsx'
import { usePaused } from '../lib/pause.js'
import { pxPanel, pxBubble, pxButton, pxSegment, ACCENT, INK } from './px.js'

/**
 * Waage-Welt — Vergleiche, was schwerer ist
 *
 * Scientific basis:
 *   • Conservation & Proportional Reasoning (Piaget)
 *   • STEM Foundations (NCTM) — measurement and comparison for Pre-K – Grade 2
 *   • Concrete → Pictorial → Abstract learning trajectory
 *
 * L1 things that differ a lot · L2 closer pairs, drawn the same size (a brick
 * and a sponge look alike, only one is heavy) · L3–5 parcels with numbers ·
 * L6–7 plus · L8–9 minus · L10 make the balance level with 1-kg blocks.
 */

const randomBetween = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a
const N = sayNumber
const kilo = n => (n === 1 ? 'ein Kilo' : `${N(n)} Kilo`)
const cap = s => s[0].toUpperCase() + s.slice(1)
const ART = { m: 'der', f: 'die', n: 'das', pl: 'die' }

// [emoji, name, weight, gender] — the weights only rank the pair and size
// the pictures; every pair has one clearly heavier thing.
const BIG_GAP = [
  [['🪶', 'Feder', 1, 'f'],          ['🔨', 'Hammer', 18, 'm']],
  [['🐘', 'Elefant', 40, 'm'],       ['🐭', 'Maus', 1, 'f']],
  [['🚗', 'Auto', 30, 'n'],          ['🦋', 'Schmetterling', 1, 'm']],
  [['🪨', 'Stein', 20, 'm'],         ['🍃', 'Blatt', 1, 'n']],
  [['🐮', 'Kuh', 25, 'f'],           ['🐔', 'Huhn', 3, 'n']],
  [['🐳', 'Wal', 50, 'm'],           ['🐠', 'Fisch', 2, 'm']],
  [['🚂', 'Zug', 60, 'm'],           ['🛴', 'Roller', 5, 'm']],
  [['🐊', 'Krokodil', 35, 'n'],      ['🦜', 'Papagei', 2, 'm']],
  [['🏠', 'Haus', 55, 'n'],          ['🧦', 'Socke', 1, 'f']],
  [['🦁', 'Löwe', 28, 'm'],          ['🐇', 'Hase', 2, 'm']],
  [['🍞', 'Brot', 6, 'n'],           ['🍬', 'Bonbon', 1, 'n']],
  [['🪑', 'Stuhl', 12, 'm'],         ['🧸', 'Teddybär', 2, 'm']],
  [['🛶', 'Kanu', 30, 'n'],          ['🫧', 'Seifenblase', 1, 'f']],
  [['🪵', 'Holzklotz', 15, 'm'],     ['🌸', 'Blüte', 1, 'f']],
  [['🚢', 'Schiff', 65, 'n'],        ['⛵', 'Segelboot', 8, 'n']],
  [['🦒', 'Giraffe', 30, 'f'],       ['🐓', 'Hahn', 3, 'm']],
  [['🎹', 'Klavier', 40, 'n'],       ['🎺', 'Trompete', 2, 'f']],
  [['🥥', 'Kokosnuss', 5, 'f'],      ['🫐', 'Blaubeere', 1, 'f']],
  [['🚜', 'Traktor', 40, 'm'],       ['🚲', 'Fahrrad', 6, 'n']],
  [['🛁', 'Badewanne', 25, 'f'],     ['🧽', 'Schwamm', 1, 'm']],
  [['🚁', 'Hubschrauber', 42, 'm'],  ['🪁', 'Drachen', 2, 'm']],
  [['🍊', 'Orange', 6, 'f'],         ['🐝', 'Biene', 1, 'f']],
  [['🍑', 'Pfirsich', 5, 'm'],       ['🌰', 'Eichel', 1, 'f']],
  [['💻', 'Laptop', 12, 'm'],        ['📱', 'Handy', 4, 'n']],
  [['🎒', 'Schulranzen', 8, 'm'],    ['🖊️', 'Stift', 1, 'm']],
  [['🚌', 'Bus', 40, 'm'],           ['🛵', 'Moped', 6, 'n']],
  [['🍉', 'Wassermelone', 8, 'f'],   ['🥐', 'Croissant', 1, 'n']],
  [['🎃', 'Kürbis', 9, 'm'],         ['🕯️', 'Kerze', 1, 'f']],
  [['🍰', 'Kuchenstück', 5, 'n'],    ['🍭', 'Lutscher', 1, 'm']],
  [['🪜', 'Leiter', 8, 'f'],         ['📐', 'Lineal', 1, 'n']],
  [['🐅', 'Tiger', 26, 'm'],         ['🐜', 'Ameise', 1, 'f']],
  [['🦣', 'Mammut', 55, 'n'],        ['🐿️', 'Eichhörnchen', 1, 'n']],
  [['🐸', 'Frosch', 4, 'm'],         ['🐛', 'Raupe', 1, 'f']],
]

// Closer pairs, still clear to a child — and some that look the same size
// but are not the same weight.
const SMALL_GAP = [
  [['🍉', 'Wassermelone', 8, 'f'],   ['🍎', 'Apfel', 2, 'm']],
  [['🍍', 'Ananas', 4, 'f'],         ['🍓', 'Erdbeere', 1, 'f']],
  [['🐑', 'Schaf', 10, 'n'],         ['🐔', 'Huhn', 3, 'n']],
  [['🎃', 'Kürbis', 6, 'm'],         ['🍊', 'Orange', 2, 'f']],
  [['🥥', 'Kokosnuss', 4, 'f'],      ['🍇', 'Weintraube', 1, 'f']],
  [['🧳', 'Koffer', 8, 'm'],         ['🧢', 'Mütze', 1, 'f']],
  [['📚', 'Bücher', 6, 'pl'],        ['✏️', 'Bleistift', 1, 'm']],
  [['🐢', 'Schildkröte', 4, 'f'],    ['🐌', 'Schnecke', 1, 'f']],
  [['🧱', 'Ziegelstein', 5, 'm'],    ['🧽', 'Schwamm', 1, 'm']],
  [['🪨', 'Stein', 5, 'm'],          ['🎈', 'Luftballon', 1, 'm']],
  [['⚽', 'Fußball', 3, 'm'],        ['🎈', 'Luftballon', 1, 'm']],
  [['🥔', 'Kartoffel', 3, 'f'],      ['🍒', 'Kirsche', 1, 'f']],
  [['🐰', 'Hase', 4, 'm'],           ['🐭', 'Maus', 1, 'f']],
  [['🍍', 'Ananas', 4, 'f'],         ['🍋', 'Zitrone', 1, 'f']],
  [['🚲', 'Fahrrad', 8, 'n'],        ['🛹', 'Skateboard', 3, 'n']],
  [['🍞', 'Brot', 4, 'n'],           ['🍪', 'Keks', 1, 'm']],
  [['🎒', 'Rucksack', 5, 'm'],       ['🧦', 'Socke', 1, 'f']],
  [['🥚', 'Ei', 2, 'n'],             ['🪶', 'Feder', 1, 'f']],
]

// From level 3 the things are neutral containers. A car with "2 kg" next to
// a snake with "6 kg" taught the opposite of level 1.
const BOXES = ['📦', '🎁', '🧺', '🛍️']

const thing = ([e, label, w, g]) => ({ e, label, w, g })
const pick  = arr => arr[randomBetween(0, arr.length - 1)]

// Heavy and light used to sit left in 45 of 50 pairs — always tapping left
// gave three stars. Each question now puts them on a random side.
const sides = (a, b) => (Math.random() < 0.5 ? { left: a, right: b } : { left: b, right: a })

function pairQuestions(list, n, sameSize) {
  return [...list].sort(() => Math.random() - 0.5).slice(0, n)
    .map(([a, b]) => ({ kind: 'things', sameSize, ...sides(thing(a), thing(b)) }))
}

// A numbered side: a single weight, or "a + b" / "a − b".
const plain = w => ({ e: pick(BOXES), w, nums: [w] })

function numberQuestions(n, maxKg, allowEqual) {
  return Array.from({ length: n }, () => {
    const a = randomBetween(1, maxKg)
    let b
    if (allowEqual && Math.random() < 0.25) b = a
    else do { b = randomBetween(1, maxKg) } while (b === a)
    return { kind: 'numbers', ...sides(plain(a), plain(b)) }
  })
}

function sumQuestions(n, op, max) {
  return Array.from({ length: n }, () => {
    let a, b, w
    if (op === '+') { a = randomBetween(1, max - 1); b = randomBetween(1, max - a); w = a + b }
    else            { a = randomBetween(3, max); b = randomBetween(1, a - 1); w = a - b }
    let other
    // a tie now and then, otherwise close to the result so it has to be worked out
    if (Math.random() < 0.25) other = w
    else do { other = Math.max(1, w + randomBetween(-3, 3)) } while (other === w)
    return { kind: 'numbers', ...sides({ e: pick(BOXES), w, nums: [a, b], op }, plain(other)) }
  })
}

// Level 10: a parcel on the left, a lighter one on the right — how many 1-kg
// blocks make the balance level? (Multiplication, "6 × 4 kg", sat here
// before, well beyond this age group.)
function balanceQuestions(n) {
  return Array.from({ length: n }, () => {
    const big = randomBetween(5, 15)
    const small = randomBetween(Math.max(1, big - 9), big - 1)
    return { kind: 'balance', left: plain(big), right: plain(small) }
  })
}

function buildQuestions(level) {
  const n = level <= 4 ? 8 : level <= 7 ? 10 : level <= 9 ? 12 : 8
  if (level <= 1) return pairQuestions(BIG_GAP, n, false)
  if (level <= 2) return pairQuestions(SMALL_GAP, n, true)
  if (level <= 3) return numberQuestions(n, 10, false)
  if (level <= 4) return numberQuestions(n, 20, true)
  if (level <= 5) return numberQuestions(n, 30, true)
  if (level <= 6) return sumQuestions(n, '+', 10)
  if (level <= 7) return sumQuestions(n, '+', 20)
  if (level <= 8) return sumQuestions(n, '−', 10)
  if (level <= 9) return sumQuestions(n, '−', 20)
  return balanceQuestions(n)
}

// What a side shows and what is said about it
const sideLabel = s => s.label ?? (s.op ? `${s.nums[0]} kg ${s.op} ${s.nums[1]} kg` : `${s.w} kg`)
const sideSpeech = s => s.op ? `${kilo(s.nums[0])} ${s.op === '+' ? 'plus' : 'minus'} ${kilo(s.nums[1])}` : kilo(s.w)
const named = s => `${ART[s.g]} ${s.label}`

function taskSpeech(q, ties) {
  const orSame = ties ? ' Oder sind beide gleich schwer?' : ''
  if (q.kind === 'things') return `Was ist schwerer, ${q.left.label} oder ${q.right.label}?`
  if (q.kind === 'balance') return `Links liegen ${kilo(q.left.w)}, rechts ${kilo(q.right.w)}. Wie viele Klötze brauchst du, damit die Waage gerade ist?`
  if (!q.left.op && !q.right.op) return `Welche Seite ist schwerer, ${kilo(q.left.w)} oder ${kilo(q.right.w)}?${orSame}`
  return `Links sind ${sideSpeech(q.left)}, rechts ${sideSpeech(q.right)}. Welche Seite ist schwerer?${orSame}`
}

// The answer, explained: what is heavier and, with numbers, by how much.
function explain(q, heavy) {
  if (q.kind === 'things') return `${cap(named(q[heavy]))} ${q[heavy].g === 'pl' ? 'sind' : 'ist'} schwerer.`
  const sum = [q.left, q.right].find(s => s.op)
  const first = sum ? `${cap(sideSpeech(sum))} ${sum.w === 1 ? 'ist' : 'sind'} ${kilo(sum.w)}. ` : ''
  if (heavy === 'equal') return `${first}Beide Seiten wiegen ${kilo(q.left.w)}. Die Waage ist gerade.`
  const h = q[heavy], l = q[heavy === 'left' ? 'right' : 'left']
  return `${first}${cap(kilo(h.w))} sind ${kilo(h.w - l.w)} mehr als ${kilo(l.w)}.`
}

// Emoji in SVG are not swapped for the pixel pictures by the build step, so
// the picture is placed as an <image> here.
function Pic({ e, x, y, size }) {
  if (hasEmojiArt(e)) return <image href={emojiSrc(e)} x={x - size / 2} y={y - size / 2} width={size} height={size} style={{ imageRendering: 'pixelated' }} />
  return <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={size}>{e}</text>
}

// ── Balance Scale — beam, chains and pans ───────────────────────────────────
const W = 400, CX = 200, PIVOT_Y = 70, ARM = 150, CHAIN = 90, PAN_W = 96

function Pan({ side, x, item, size, label, blocks, heavy, answered, onPick, beam, drop, fall }) {
  // The pans hang straight down from the ends of the beam instead of turning
  // with it, so picture and label stay upright. They follow the beam's angle
  // frame by frame, so they stay on its ends even while it swings.
  const s = side === 'left' ? -1 : 1
  const dx = useTransform(beam, t => s * ARM * Math.cos((t * Math.PI) / 180) - s * ARM)
  const dy = useTransform([beam, drop], ([t, d]) => s * ARM * Math.sin((t * Math.PI) / 180) + d)
  const won = answered && heavy === side
  const py = PIVOT_Y + CHAIN
  return (
    <motion.g style={{ x: dx, y: dy }}>
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={x} y1={PIVOT_Y + 9 + i * 16} x2={x} y2={PIVOT_Y + 9 + (i + 1) * 16}
          stroke="#5b4a6e" strokeWidth={3} strokeLinecap="round" />
      ))}
      <ellipse cx={x} cy={py} rx={PAN_W / 2} ry={10} fill="#ffe08a" stroke="#2a1b3d" strokeWidth={3} />
      <path d={`M${x - PAN_W / 2} ${py} Q${x} ${py + 28} ${x + PAN_W / 2} ${py}`} fill="#ffc93c" stroke="#2a1b3d" strokeWidth={3} />
      {won && <circle cx={x} cy={py - 24} r={40} fill="none" stroke="#2F8F3A" strokeWidth={4} strokeDasharray="8 6" />}
      <motion.g style={{ y: fall }}>
        <Pic e={item.e} x={x} y={py - 12 - (blocks ? 16 : 0)} size={size} />
      </motion.g>
      {/* 1-kg blocks laid on the right pan in level 10 */}
      {Array.from({ length: blocks ?? 0 }, (_, i) => (
        <g key={i}>
          <rect x={x - 42 + (i % 6) * 14} y={py - 10 - Math.floor(i / 6) * 14} width={13} height={13}
            fill="#d0583a" stroke="#2a1b3d" strokeWidth={2} />
        </g>
      ))}
      <text x={x} y={py + 36} textAnchor="middle" fontSize={label.length > 8 ? 17 : 20}
        fontWeight="700" fill={won ? ACCENT : '#2a1b3d'}
        fontFamily="var(--font-heading,system-ui)">
        {label}
      </text>
      {won && <Pic e="🏆" x={x} y={py + 60} size={26} />}
      {answered && heavy === 'equal' && <Pic e="⚖️" x={x} y={py + 60} size={26} />}
      {/* The whole pan is the tap target, not just the picture */}
      {onPick && (
        <rect x={x - 62} y={py - 70} width={124} height={130} fill="transparent"
          style={{ cursor: answered ? 'default' : 'pointer' }}
          role="button" aria-label={`${label} ist schwerer`}
          onClick={!answered ? onPick : undefined} />
      )}
    </motion.g>
  )
}

// One scale per question: it mounts when the pair lands and keeps its own
// tilt while it fades out.
function BalanceScale({ tiltDeg, q, sizes, answered, heavy, onPick, blocks }) {
  const paused = usePaused()
  const reduceMotion = useReducedMotion()
  const beam = useMotionValue(tiltDeg)   // beam angle in degrees
  const drop = useMotionValue(0)         // both pans dip by the same amount
  const fall = useMotionValue(reduceMotion ? 0 : -46)  // the things dropping onto the pans
  // The running animation of each value, so the help dialog can hold them.
  // Finished ones leave the list — play() would start them over.
  const running = useRef({})
  const play = (key, mv, to, opts) => {
    running.current[key]?.stop()
    const c = animate(mv, to, opts)
    if (paused) c.pause()
    running.current[key] = c
    c.then(() => { if (running.current[key] === c) delete running.current[key] })
  }
  useEffect(() => {
    Object.values(running.current).forEach(c => (paused ? c.pause() : c.play()))
  }, [paused])

  // The pair lands: both things drop in and both pans bounce once, exactly
  // alike — the scale comes alive without giving the answer away.
  useEffect(() => {
    if (reduceMotion) return
    play('fall', fall, 0, { duration: 0.32, ease: 'easeIn', delay: 0.3 })
    play('drop', drop, [0, 9, -3, 0], { duration: 0.7, times: [0, 0.3, 0.65, 1], ease: 'easeOut', delay: 0.62 })
    return () => Object.values(running.current).forEach(c => c.stop())
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // After the answer (and in level 10 with the blocks) the beam tips for real.
  useEffect(() => {
    if (beam.get() === tiltDeg) return
    if (reduceMotion) beam.jump(tiltDeg)
    else play('beam', beam, tiltDeg, TIP)
  }, [tiltDeg]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <svg width="100%" viewBox={`0 0 ${W} 300`}
      style={{ maxWidth: 460, display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id="bBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#c27a3a"/><stop offset="100%" stopColor="#8a4f22"/>
        </linearGradient>
        <linearGradient id="bPole" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#c27a3a"/><stop offset="50%" stopColor="#e3a462"/>
          <stop offset="100%" stopColor="#c27a3a"/>
        </linearGradient>
        <linearGradient id="bBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e3a462"/><stop offset="100%" stopColor="#c27a3a"/>
        </linearGradient>
        <filter id="bShadow"><feDropShadow dx="0" dy="3" stdDeviation="0" floodColor="#2a1b3d" floodOpacity="0.3"/></filter>
      </defs>

      {/* Base */}
      <rect x={CX-60} y={274} width={120} height={18} rx={4} fill="url(#bBase)" stroke="#2a1b3d" strokeWidth={3} filter="url(#bShadow)"/>
      <rect x={CX-45} y={264} width={90}  height={14} rx={3} fill="#e3a462" stroke="#2a1b3d" strokeWidth={3}/>

      {/* Pole with rings */}
      <rect x={CX-7} y={PIVOT_Y+14} width={14} height={198} rx={3} fill="url(#bPole)" stroke="#2a1b3d" strokeWidth={3}/>
      {[0.25,0.5,0.75].map((f,i)=>(
        <rect key={i} x={CX-10} y={PIVOT_Y+14+(198)*f} width={20} height={7} rx={2} fill="#8a4f22" stroke="#2a1b3d" strokeWidth={2}/>
      ))}

      {/* Beam */}
      <motion.g style={{ rotate: beam, transformOrigin:`${CX}px ${PIVOT_Y}px` }}>
        <rect x={CX-ARM-8} y={PIVOT_Y-7} width={ARM*2+16} height={14} rx={3}
          fill="url(#bBeam)" stroke="#2a1b3d" strokeWidth={3} filter="url(#bShadow)"/>
        <circle cx={CX-ARM} cy={PIVOT_Y} r={9} fill="#ffc93c" stroke="#2a1b3d" strokeWidth={3}/>
        <circle cx={CX+ARM} cy={PIVOT_Y} r={9} fill="#ffc93c" stroke="#2a1b3d" strokeWidth={3}/>
      </motion.g>

      <Pan side="left"  x={CX-ARM} item={q.left}  size={sizes[0]} label={sideLabel(q.left)}
        heavy={heavy} answered={answered} beam={beam} drop={drop} fall={fall} onPick={onPick && (() => onPick('left'))} />
      <Pan side="right" x={CX+ARM} item={q.right} size={sizes[1]} blocks={blocks}
        label={blocks != null ? `${q.right.w} kg + ${blocks} kg` : sideLabel(q.right)}
        heavy={heavy} answered={answered} beam={beam} drop={drop} fall={fall} onPick={onPick && (() => onPick('right'))} />

      {/* Pivot cap */}
      <circle cx={CX} cy={PIVOT_Y} r={14} fill="#2a1b3d" filter="url(#bShadow)"/>
      <circle cx={CX} cy={PIVOT_Y} r={6}  fill="#ffc93c"/>
      <circle cx={CX} cy={PIVOT_Y} r={2}  fill="#2a1b3d"/>
    </svg>
  )
}

const TILT = 18
const tiltFor = (l, r) => (l > r ? -TILT : r > l ? TILT : 0)
// The beam tips like something heavy just settled: slow, a swing past the
// end and back, then still.
const TIP = { type: 'spring', stiffness: 60, damping: 7, mass: 1.6 }

export default function WeightGame({ level = 1, onComplete }) {
  const [questions] = useState(() => buildQuestions(level))
  const [idx,       setIdx]      = useState(0)
  const [answered,  setAnswered] = useState(false)
  const [isCorrect, setIsCorrect]= useState(false)
  const [showWeiter, setShowWeiter] = useState(false)
  const [firstTry,  setFirstTry] = useState(0)
  const [mood,      setMood]     = useState('happy')
  const [blocks,    setBlocks]   = useState(0)      // level 10
  const [tries,     setTries]    = useState(0)      // level 10, wrong "Fertig" on this question

  useEffect(() => stopNarration, [])

  const q = questions[idx]
  const balance = q.kind === 'balance'
  const heavy = q.left.w > q.right.w ? 'left' : q.right.w > q.left.w ? 'right' : 'equal'
  const ties  = questions.some(qq => qq.kind === 'numbers' && qq.left.w === qq.right.w)

  // In the first level the picture is the only clue, and an elephant drawn
  // as large as a mouse throws it away. In level 2 the pair is drawn the same
  // size on purpose; parcels with printed weights keep a fixed size.
  const size = (s) => {
    if (q.kind !== 'things' || q.sameSize) return 52
    return Math.round(30 + Math.sqrt(Math.min(s.w, 60) / 60) * 40)
  }

  // Read the task. Before, from level 3 on only "Rechne. Welche Seite ist
  // schwerer?" was said, and the numbers never were.
  useEffect(() => {
    if (!q) return
    lockPreviews()
    const id = setTimeout(() => sayTask(taskSpeech(q, ties)), 300)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const resultText = balance
    ? `${q.left.w} kg = ${q.right.w} kg + ${q.left.w - q.right.w} kg`
    : heavy === 'equal' ? 'Beide sind gleich schwer! ⚖️'
    : q.kind === 'things' ? `${cap(named(q[heavy]))} ${q[heavy].g === 'pl' ? 'sind' : 'ist'} schwerer.`
    : (() => {
        const sum = [q.left, q.right].find(s => s.op)
        const h = q[heavy], l = q[heavy === 'left' ? 'right' : 'left']
        return `${sum ? `${sideLabel(sum)} = ${sum.w} kg. ` : ''}${h.w} kg sind ${h.w - l.w} kg mehr als ${l.w} kg.`
      })()

  const answer = useCallback((side) => {
    if (answered || balance) return
    const ok = side === heavy
    setAnswered(true)
    setIsCorrect(ok)
    setMood(ok ? 'excited' : 'encouraging')
    if (ok) { sfx.correct(); setFirstTry(s => s + 1); sayRight(explain(q, heavy)) }
    else { sfx.wrong(); sayWrong(explain(q, heavy)) }
    setTimeout(() => setShowWeiter(true), 800)
  }, [answered, balance, heavy, q])

  // Level 10: put blocks on, take them off, then check
  const addBlock = (d) => {
    if (answered) return
    const b = Math.max(0, Math.min(15, blocks + d))
    if (b === blocks) return
    setBlocks(b)
    sfx.pop?.()
    if (b > 0) narrate([{ text: N(b), rate: 1 }])
  }
  const checkBalance = () => {
    if (answered) return
    const need = q.left.w - q.right.w
    if (blocks === need) {
      setAnswered(true)
      setIsCorrect(true)
      setMood('excited')
      sfx.correct()
      if (tries === 0) setFirstTry(s => s + 1)
      sayRight(`${cap(kilo(q.left.w))} sind ${kilo(q.right.w)} plus ${kilo(need)}. Die Waage ist gerade.`)
      setTimeout(() => setShowWeiter(true), 800)
      return
    }
    setTries(t => t + 1)
    setMood('encouraging')
    sfx.wrong()
    sayWrong(`Rechts sind jetzt ${kilo(q.right.w + blocks)}, links ${kilo(q.left.w)}. ${blocks > need ? 'Das sind zu viele Klötze.' : 'Da fehlen noch Klötze.'}`)
    setTimeout(() => setMood('happy'), 900)
  }

  const weiterClick = () => {
    setShowWeiter(false)
    setAnswered(false)
    setIsCorrect(false)
    setMood('happy')
    if (idx + 1 >= questions.length) {
      sfx.complete()
      onComplete(result(firstTry, questions.length))
    } else {
      // Reset with the new question, so the beam never sees the old blocks
      setBlocks(0)
      setTries(0)
      setIdx(i => i + 1)
    }
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  answer('left')
      if (e.key === 'ArrowRight') answer('right')
      if (e.key === 'ArrowDown' && ties) answer('equal')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer, ties])

  // The beam shows the truth once answered; in level 10 it also follows the
  // blocks after a first wrong try, as a help.
  const tiltDeg = balance
    ? (answered || tries > 0 ? tiltFor(q.left.w, q.right.w + blocks) : -TILT)
    : answered ? tiltFor(q.left.w, q.right.w) : 0

  const questionText = q.kind === 'things' ? 'Was ist schwerer? Tippe auf die schwerere Seite!'
    : balance ? 'Wie viele 1-kg-Klötze 🧱 machen die Waage gerade?'
    : 'Welche Seite ist schwerer? Tippe drauf!'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(14px,2.5vw,24px) clamp(14px,3vw,28px)',
      gap: 'clamp(10px,1.8vw,16px)',
    }}>

      {/* Flash overlay */}
      <AnimatePresence>
        {answered && (
          <motion.div key={'flash' + idx}
            initial={{ opacity: 0.28 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            style={{ position: 'fixed', inset: 0, zIndex: 150, pointerEvents: 'none',
                     background: isCorrect ? '#5CC45A' : '#FF6B5B' }}
          />
        )}
      </AnimatePresence>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 640 }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < idx ? 'done' : i === idx ? 'current' : 'todo'),
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi — tap the bubble to hear the task again */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 640 }}>
        <LumiCharacter mood={mood} size={68} />
        <AnimatePresence mode="wait">
          <motion.button key={idx + (answered ? 'a' : 'q')}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            onClick={() => sayTask(answered ? explain(q, heavy) : taskSpeech(q, ties))}
            aria-label="Noch einmal hören"
            style={{
              flex: 1, ...pxBubble, textAlign: 'left', cursor: 'pointer',
              padding: '12px 18px',
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3vw,20px)',
              color: 'var(--text-primary)',
            }}
          >
            {answered
              ? <>
                  <strong style={{ color: isCorrect ? '#2F8F3A' : '#C2412D' }}>
                    {isCorrect ? 'Super! 🎉 ' : 'Schau mal: '}
                  </strong>
                  {resultText}
                </>
              : questionText}
            {' '}🔊
          </motion.button>
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 500,
                   ...pxPanel, padding: 'clamp(8px,1.6vw,14px) clamp(10px,2vw,18px)' }}
        >
          <BalanceScale
            tiltDeg={tiltDeg} q={q}
            sizes={[size(q.left), size(q.right)]}
            answered={answered}
            heavy={balance ? (answered ? 'equal' : null) : heavy}
            onPick={balance ? null : answer}
            blocks={balance ? blocks : null}
          />
        </motion.div>
      </AnimatePresence>

      {/* "Both the same" needs a control of its own — shown in the levels
          where ties occur. */}
      {!answered && !balance && ties && (
        <motion.button
          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
          onClick={() => answer('equal')}
          {...hearable('Gleich schwer')}
          style={{
            ...pxButton('parch'),
            padding: '10px 30px', minHeight: 52,
            fontSize: 'clamp(16px,3.2vw,19px)',
          }}
        >⚖️ Gleich schwer</motion.button>
      )}

      {/* Level 10: blocks on and off, then check */}
      {!answered && balance && (
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => addBlock(-1)} aria-label="Klotz wegnehmen"
            {...hearable('Klotz wegnehmen')}
            style={{ ...pxButton('parch'), width: 64, height: 56, padding: 0, fontSize: 24 }}>− 🧱</motion.button>
          <motion.button whileTap={{ scale: 0.9 }} onClick={() => addBlock(1)} aria-label="Klotz dazulegen"
            {...hearable('Klotz dazulegen')}
            style={{ ...pxButton('gold'), width: 64, height: 56, padding: 0, fontSize: 24 }}>+ 🧱</motion.button>
          <motion.button whileTap={{ scale: 0.94 }} onClick={checkBalance}
            {...hearable('Fertig')}
            style={{ ...pxButton('green'), color: INK, textShadow: 'none', padding: '10px 30px', minHeight: 56, fontSize: 'clamp(17px,3.2vw,20px)' }}>✅ Fertig</motion.button>
        </div>
      )}

      {/* Weiter button */}
      {showWeiter && (
        <motion.button
          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ type:'spring', stiffness:300, delay:0.2 }}
          whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
          onClick={weiterClick}
          {...hearable('Weiter')}
          style={{
            ...pxButton('green'), color: INK, textShadow: 'none',
            padding:'clamp(12px,2vw,16px) clamp(28px,6vw,52px)', minHeight: 52,
            fontSize:'clamp(18px,3.5vw,22px)',
          }}
        >Weiter! →</motion.button>
      )}
    </div>
  )
}
