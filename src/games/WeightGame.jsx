import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, lockPreviews, stopNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { hearable } from '../lib/hearable.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail } from '../components/play/index.js'
import { Stage, useLater, DoneButton, HearButton } from './zahlen/stage.jsx'

/**
 * Waage-Welt — "Die Wippe": Vergleiche, was schwerer ist
 *
 * Two things want to play on the seesaw. The child guesses who goes down
 * and taps it; then the seesaw tips with a swing, the light one flies up
 * ("Huiii!") and plops back. First guess, then see: predicting and
 * checking is the heart of early science.
 *
 * Scientific basis:
 *   • Conservation & Proportional Reasoning (Piaget)
 *   • STEM Foundations (NCTM) — measurement and comparison for Pre-K – Grade 2
 *   • Concrete → Pictorial → Abstract learning trajectory
 *
 * L1 things that differ a lot · L2 closer pairs, drawn the same size (a brick
 * and a sponge look alike, only one is heavy) · L3–5 parcels with numbers ·
 * L6–7 plus · L8–9 minus · L10 put 1-kg blocks on until the seesaw is level.
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

// From level 3 the things are neutral parcels. A car with "2 kg" next to
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
// blocks make the seesaw level?
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
const sideLabel = s => (s.op ? `${s.nums[0]} ${s.op} ${s.nums[1]} kg` : `${s.w} kg`)
const sideSpeech = s => s.op ? `${kilo(s.nums[0])} ${s.op === '+' ? 'plus' : 'minus'} ${kilo(s.nums[1])}` : kilo(s.w)
const named = s => `${ART[s.g]} ${s.label}`

function taskSpeech(q, ties) {
  const orSame = ties ? ' Oder sind beide gleich schwer?' : ''
  if (q.kind === 'things') return `Wer geht auf der Wippe nach unten: ${named(q.left)} oder ${named(q.right)}?`
  if (q.kind === 'balance') return `Links liegen ${kilo(q.left.w)}, rechts ${kilo(q.right.w)}. Leg Klötze nach rechts, bis die Wippe gerade ist! Jeder Klotz wiegt ein Kilo.`
  if (!q.left.op && !q.right.op) return `Welche Seite geht nach unten, ${kilo(q.left.w)} oder ${kilo(q.right.w)}?${orSame}`
  return `Links sind ${sideSpeech(q.left)}, rechts ${sideSpeech(q.right)}. Welche Seite geht nach unten?${orSame}`
}

// The answer, explained: what is heavier and, with numbers, by how much.
function explain(q, heavy) {
  if (q.kind === 'things') return `${cap(named(q[heavy]))} ${q[heavy].g === 'pl' ? 'sind' : 'ist'} schwerer.`
  const sum = [q.left, q.right].find(s => s.op)
  const first = sum ? `${cap(sideSpeech(sum))} ${sum.w === 1 ? 'ist' : 'sind'} ${kilo(sum.w)}. ` : ''
  if (heavy === 'equal') return `${first}Beide Seiten wiegen ${kilo(q.left.w)}. Die Wippe bleibt gerade.`
  const h = q[heavy], l = q[heavy === 'left' ? 'right' : 'left']
  return `${first}${cap(kilo(h.w))} sind ${kilo(h.w - l.w)} mehr als ${kilo(l.w)}.`
}

const TILT = 13
const tiltFor = (l, r) => (l > r ? -TILT : r > l ? TILT : 0)
// The plank tips like something heavy just settled: a swing past the end
// and back, then still.
const TIP = { type: 'spring', stiffness: 70, damping: 7, mass: 1.4 }

export default function WeightGame({ level = 1, onComplete }) {
  const [questions] = useState(() => buildQuestions(level))
  const { later, afterSpeech, clear } = useLater()
  const [idx,      setIdx]      = useState(0)
  const [answered, setAnswered] = useState(null)   // null | the side tapped ('left' | 'right' | 'equal') | 'balanced'
  const [blocks,   setBlocks]   = useState(0)      // level 10
  const [tries,    setTries]    = useState(0)      // level 10, wrong ticks on this question
  const [fly,      setFly]      = useState(0)      // bumps when the light one should fly
  const firstTry = useRef(0)

  useEffect(() => stopNarration, [])

  const q = questions[idx]
  const balance = q.kind === 'balance'
  const heavy = q.left.w > q.right.w ? 'left' : q.right.w > q.left.w ? 'right' : 'equal'
  const ties  = questions.some(qq => qq.kind === 'numbers' && qq.left.w === qq.right.w)

  // In the first level the picture is the only clue, and an elephant drawn
  // as large as a mouse throws it away. In level 2 the pair is drawn the same
  // size on purpose; parcels with printed weights keep a fixed size.
  const size = (s) => {
    if (q.kind !== 'things' || q.sameSize) return 110
    return Math.round(72 + Math.sqrt(Math.min(s.w, 60) / 60) * 80)
  }

  // Read the task, with the numbers.
  useEffect(() => {
    lockPreviews()
    later(500, () => sayTask(taskSpeech(q, ties)))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (idx + 1 >= questions.length) { sfx.complete(); onComplete(result(firstTry.current, questions.length)); return }
    clear()
    setAnswered(null)
    setBlocks(0)
    setTries(0)
    // the riders and the bird of the next pair would take a still-set fly
    // as their cue and jump the moment they appear
    setFly(0)
    setIdx(idx + 1)
  }

  // First the guess shows for a moment, then the seesaw tells the truth.
  const answer = useCallback((side) => {
    if (answered || balance) return
    const ok = side === heavy
    setAnswered(side)
    sfx.drum()
    later(450, () => {
      setFly(f => f + 1)
      if (ok) { firstTry.current++; sayRight(explain(q, heavy)) }
      else sayWrong(explain(q, heavy))
      afterSpeech(next, ok ? 1300 : 1800)
    })
  }, [answered, balance, heavy, q]) // eslint-disable-line react-hooks/exhaustive-deps

  // Level 10: blocks on and off, then check
  const addBlock = () => {
    if (answered || blocks >= 15) return false
    setBlocks(b => b + 1)
    narrate([{ text: N(blocks + 1), rate: 1 }])
    return true
  }
  const takeBlock = () => {
    if (answered || !blocks) return
    setBlocks(b => b - 1)
    sfx.slideUp()
  }
  const checkBalance = () => {
    if (answered || !blocks) return
    const need = q.left.w - q.right.w
    if (blocks === need) {
      setAnswered('balanced')
      setFly(f => f + 1)
      if (tries === 0) firstTry.current++
      sayRight(`${cap(kilo(q.left.w))} sind ${kilo(q.right.w)} plus ${kilo(need)}. Die Wippe ist gerade.`)
      afterSpeech(next, 1300)
      return
    }
    setTries(t => t + 1)
    sayWrong(`Rechts sind jetzt ${kilo(q.right.w + blocks)}, links ${kilo(q.left.w)}. ${blocks > need ? 'Das sind zu viele Klötze.' : 'Da fehlen noch Klötze.'}`)
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

  // The plank shows the truth once answered; in level 10 it also follows the
  // blocks after a first wrong try, as a help.
  const tilt = balance
    ? (answered || tries > 0 ? tiltFor(q.left.w, q.right.w + blocks) : -TILT)
    : answered && fly ? tiltFor(q.left.w, q.right.w) : 0

  const repeat = () => sayTask(answered && !balance ? explain(q, heavy) : taskSpeech(q, ties))

  return (
    <DragArea autoTarget="right" disabled={!balance || !!answered}>
      <Stage wide={[780, 540]} tall={[440, 680]}>
        {wide => (
          <>
            <RoundTrail total={questions.length} done={idx + (answered ? 1 : 0)} walker="🐦" goal="🛝" size={wide ? 36 : 32} style={{ margin: '6px 48px 0 24px' }} />
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <AnimatePresence mode="wait">
                <motion.div key={idx} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}>
                  <Seesaw width={wide ? 620 : 420} q={q} tilt={tilt} fly={fly} answered={answered} heavy={heavy}
                    sizes={[size(q.left), size(q.right)].map(s => (wide ? s : s * 0.9))}
                    onPick={balance ? null : answer} blocks={balance ? blocks : null} onTakeBlock={takeBlock} onDropBlock={addBlock} />
                </motion.div>
              </AnimatePresence>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '4px 12px 14px', minHeight: 92 }}>
              <HearButton onClick={repeat} />
              {/* "Both the same" needs a control of its own — shown in the
                  levels where ties occur. */}
              {!balance && ties && (
                <motion.button type="button" onClick={() => answer('equal')} disabled={!!answered}
                  {...hearable('Gleich schwer')} aria-label="Gleich schwer"
                  whileTap={{ scale: 0.9 }} animate={{ opacity: answered ? 0.4 : 1 }}
                  className="px-btn px-btn--parch" style={{ minHeight: 64, padding: '6px 22px', gap: 8, fontSize: 18 }}>
                  <Art art="⚖️" size={44} /> Gleich schwer
                </motion.button>
              )}
              {balance && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 8, borderRadius: 16, background: 'rgba(255,253,247,0.75)', border: '3px dashed #8a4f22' }}>
                    {[0, 1, 2].map(i => (
                      <Draggable key={`${blocks}-${i}`} id={`b${blocks}-${i}`} data="block" label="Klotz, ein Kilo">
                        <Art art="🧱" size={58} />
                      </Draggable>
                    ))}
                  </div>
                  <DoneButton onClick={checkBalance} disabled={!!answered || !blocks} size={78} />
                </>
              )}
            </div>
          </>
        )}
      </Stage>
    </DragArea>
  )
}

// ── The seesaw ─────────────────────────────────────────────────────────────
const H = 330, PIVOT = H - 64

function Seesaw({ width, q, tilt, fly, answered, heavy, sizes, onPick, blocks, onTakeBlock, onDropBlock }) {
  const reduce = useReducedMotion()
  const L = width * 0.44                 // half the plank
  const ang = useMotionValue(tilt)       // plank angle in degrees, + is right side down
  useEffect(() => {
    if (reduce) { ang.jump(tilt); return }
    const c = animate(ang, tilt, TIP)
    return () => c.stop()
  }, [tilt]) // eslint-disable-line react-hooks/exhaustive-deps

  // Who flies: the side that went up; on a tie both hop a little.
  const up = !fly ? null : tilt < 0 ? 'right' : tilt > 0 ? 'left' : 'both'
  const label = (side) => {
    const s = q[side]
    if (q.kind === 'things') return null
    return side === 'right' && blocks ? `${s.w} + ${blocks} kg` : sideLabel(s)
  }
  const rider = (side, i) => (
    <Rider key={side} side={side} item={q[side]} size={sizes[i]} d={L * 0.8} cx={width / 2} ang={ang}
      label={label(side)} fly={up === side || up === 'both' ? fly : 0} small={up === 'both'}
      guessed={answered === side} heavy={!!fly && heavy === side}
      onTap={onPick && !answered ? () => onPick(side) : null} />
  )

  return (
    <div style={{ position: 'relative', width, height: H }}>
      {/* The stand */}
      <svg width={width} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
        <ellipse cx={width / 2} cy={H - 10} rx={L * 1.05} ry={12} fill="rgba(42,27,61,0.16)" />
        <path d={`M${width / 2 - 46} ${H - 12} L${width / 2} ${PIVOT} L${width / 2 + 46} ${H - 12} Z`} fill="#ff6b5b" stroke="#2a1b3d" strokeWidth="5" strokeLinejoin="round" />
        <circle cx={width / 2} cy={PIVOT + 30} r="9" fill="#ffc93c" stroke="#2a1b3d" strokeWidth="4" />
      </svg>
      {/* The plank */}
      <motion.div aria-hidden="true" style={{
        position: 'absolute', left: width / 2 - L, top: PIVOT - 10, width: L * 2, height: 20, rotate: ang,
        borderRadius: 10, border: '4px solid #2a1b3d', boxSizing: 'border-box',
        background: 'repeating-linear-gradient(90deg, #e3a462 0 36px, #c98a52 36px 40px)', boxShadow: '0 5px 0 rgba(42,27,61,0.3)',
      }} />
      <Bird x={width / 2} ang={ang} fly={fly} />
      {balance(q) && (
        <>
          <DropZone id="right" onDrop={onDropBlock} label="Rechte Seite der Wippe"
            style={{ position: 'absolute', left: width / 2 + 30, top: PIVOT - 200, width: L, height: 210 }}>
            {hover => <div style={{ width: '100%', height: '100%', borderRadius: 24, background: hover ? 'rgba(255,201,60,0.25)' : 'transparent' }} />}
          </DropZone>
          <Blocks n={blocks} x={width / 2 + L * 0.42} ang={ang} d={L * 0.42} onTake={onTakeBlock} />
        </>
      )}
      {rider('left', 0)}
      {rider('right', 1)}
    </div>
  )
}
const balance = q => q.kind === 'balance'

// One rider on the plank. It stays upright and follows its end of the plank;
// the light one is flung up ("Huiii!") and plops back down.
function Rider({ side, item, size, d, cx, ang, label, fly, small, guessed, heavy, onTap }) {
  const reduce = useReducedMotion()
  const s = side === 'left' ? -1 : 1
  const hop = useMotionValue(0)
  const spin = useMotionValue(0)
  const y = useTransform([ang, hop], ([a, h]) => s * d * Math.sin((a * Math.PI) / 180) + h)
  const [mood, setMood] = useMood()

  useEffect(() => {
    if (!fly) return
    if (heavy) { setMood('wow', 900); return }
    sfx.whoosh()
    if (reduce) { setMood('happy', 1200); return }
    const high = small ? -36 : -150
    const c = animate(hop, [0, high, 0], { duration: small ? 0.5 : 1.15, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] })
    if (!small && Math.random() < 0.5) animate(spin, [0, 360], { duration: 1.1 })
    c.then(() => { sfx.boing(); setMood('happy', 1400) })
    return () => c.stop()
  }, [fly]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div style={{ position: 'absolute', left: cx + s * d - size / 2, top: PIVOT - 10 - size, width: size, height: size, y, zIndex: 3 }}>
      <motion.div style={{ rotate: spin, width: size, height: size }}>
        <Critter art={item.e} size={size} label={item.label ?? label} shadow={false}
          mood={guessed && mood === 'idle' ? 'wow' : mood} onTap={onTap ?? undefined}
          wish={label ? <span style={{ fontSize: 22 }}>{label}</span> : null} />
      </motion.div>
      <AnimatePresence>
        {guessed && (
          <motion.div key="guess" aria-hidden="true" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: [0, -8, 0] }} exit={{ opacity: 0 }}
            transition={{ y: { duration: 0.6, repeat: 2 } }}
            style={{ position: 'absolute', left: size / 2 - 24, top: label ? -110 : -56 }}>
            <Art art="👇" size={48} />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// A little bird on the middle of the plank; it startles when the plank tips.
function Bird({ x, ang, fly }) {
  const reduce = useReducedMotion()
  const hop = useMotionValue(0)
  const [mood, setMood] = useMood()
  useEffect(() => {
    if (!fly || reduce) return
    setMood('wow', 1100)
    const c = animate(hop, [0, -70, -60, 0], { duration: 1.3, times: [0, 0.3, 0.7, 1] })
    return () => c.stop()
  }, [fly]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div style={{ position: 'absolute', left: x - 24, top: PIVOT - 56, y: hop, rotate: ang, zIndex: 2 }}>
      <Critter art="🐦" size={48} mood={mood} label="Vogel" shadow={false} />
    </motion.div>
  )
}

// The 1-kg blocks laid on the right side (level 10); a tap takes one off.
function Blocks({ n, x, ang, d, onTake }) {
  const y = useTransform(ang, a => d * Math.sin((a * Math.PI) / 180))
  return (
    <motion.div style={{ position: 'absolute', left: x - 50, bottom: H - PIVOT + 10, y, zIndex: 4, width: 100, display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center' }}>
      <AnimatePresence>
        {Array.from({ length: n }, (_, i) => (
          <motion.button key={i} type="button" onClick={onTake} aria-label="Klotz wegnehmen"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            style={{ all: 'unset', cursor: 'pointer', width: 32, height: 30, display: 'flex', justifyContent: 'center' }}>
            <Art art="🧱" size={32} />
          </motion.button>
        ))}
      </AnimatePresence>
    </motion.div>
  )
}
