import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, AnimatePresence, animate, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, stopNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { Critter, Art, Wish, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts } from '../components/play/index.js'
import { Stage, useLater, DoneButton, usePops, Finale } from './zahlen/stage.jsx'

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

// What a parcel's tag shows
const sideLabel = s => (s.op ? `${s.nums[0]} ${s.op} ${s.nums[1]} kg` : `${s.w} kg`)

const TILT = 13
const tiltFor = (l, r) => (l > r ? -TILT : r > l ? TILT : 0)
// The plank tips like something heavy just settled: a swing past the end
// and back, then still.
const TIP = { type: 'spring', stiffness: 70, damping: 7, mass: 1.4 }

// ── Where the light one lands ─────────────────────────────────────────────
// A right guess flings the light thing off the plank, and it stays where it
// lands: in the tree, on the bird's head, on the sun. The longer the streak,
// the sillier the place, so by the end of a level the tree is full.
const TREE_SLOTS = [[0.5, 0.16], [0.28, 0.3], [0.72, 0.3], [0.4, 0.48], [0.64, 0.5], [0.2, 0.48]]
const PERCH = 46                              // a landed thing, drawn this size
const LIMIT = { tree: TREE_SLOTS.length, head: 3, sun: 3 }
// Held sideways the tree stands beside the seesaw; upright (a phone) it is
// smaller and stands on the ground behind the seesaw's left end.
const treeAt = wide => (wide ? { T: 250, left: -100, top: H - 4 - 250 } : { T: 170, left: 2, top: H - 4 - 170 })

function chooseSpot(streak, landed, sunOk) {
  const n = kind => landed.filter(l => l.spot.kind === kind).length
  const want = streak === 3 || streak === 7 || (streak >= 9 && streak % 2) ? 'head'
    : streak === 5 || streak === 8 ? 'sun' : 'tree'
  for (const kind of [want, 'tree', 'head', 'sun']) {
    if (kind === 'sun' && !sunOk) continue
    if (n(kind) < LIMIT[kind]) return { kind, i: n(kind), flip: kind === 'tree' && streak >= 6 }
  }
  return null
}

// The scene's sun, in the seesaw's own coordinates — or null where the
// backdrop has it cut off (a phone held upright).
function findSun(box, area) {
  const sun = [...document.querySelectorAll('svg circle')].find(c => c.getAttribute('fill') === '#ffd84a')
  const outer = area?.parentElement?.parentElement
  if (!sun || !box || !outer) return null
  const r = sun.getBoundingClientRect(), o = outer.getBoundingClientRect(), b = box.getBoundingClientRect()
  const cx = r.left + r.width / 2, top = r.top
  if (cx < o.left + 60 || cx > o.right - 20 || top < o.top + 20 || r.bottom > o.bottom) return null
  const k = b.width / box.offsetWidth
  return { x: (cx - b.left) / k, y: (top + r.height / 2 - b.top) / k, r: r.width / 2 / k }
}

export default function WeightGame({ level = 1, onComplete }) {
  const [questions] = useState(() => buildQuestions(level))
  const { later, afterSpeech, clear } = useLater()
  const [idx,      setIdx]      = useState(0)
  const [answered, setAnswered] = useState(null)   // null | the side tapped ('left' | 'right' | 'equal') | 'balanced'
  const [blocks,   setBlocks]   = useState(0)      // level 10
  const [tries,    setTries]    = useState(0)      // level 10, wrong ticks on this question
  const [fly,      setFly]      = useState(0)      // bumps when the light one should fly
  const [verdict,  setVerdict]  = useState(null)   // 'right' | 'wrong', once the plank has spoken
  const [wobble,   setWobble]   = useState(0)      // level 10: a wrong tick makes the plank shake
  const [landed,   setLanded]   = useState([])     // things flung off the plank that stayed where they landed
  const [away,     setAway]     = useState(null)   // the side whose rider is flying to its perch
  const [sunAt,    setSunAt]    = useState(null)
  const boxRef = useRef(null), areaRef = useRef(null)
  const reduce = useReducedMotion()
  const firstTry = useRef(0)
  const streak = useRef(0)                       // right in a row: the flyer gets wilder
  const [pops, pop] = usePops()
  const riderRefs = { left: useRef(null), right: useRef(null) }
  const dropRef = useRef(null), brickRef = useRef(null), doneRef = useRef(null)
  // Everyone who played on the seesaw comes to the party at the end
  const [cast] = useState(() => {
    const riders = questions.flatMap(qq => (qq.kind === 'things' ? [qq.left.e, qq.right.e] : []))
    return riders.length ? [...new Set(riders)].slice(0, 6) : ['🐦', '🐻', '🐰', '🐸', '🐷', '🦔']
  })

  useEffect(() => stopNarration, [])
  // where the sun is, again after the screen turns
  useLayoutEffect(() => {
    const measure = () => setSunAt(findSun(boxRef.current, areaRef.current))
    const t = setTimeout(measure, 400)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [])

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

  // A new pair climbs on.
  useEffect(() => {
    lockPreviews()
    sayTask()
  }, [idx])

  const next = () => {
    if (idx + 1 >= questions.length) { setAnswered('finale'); return }
    clear()
    setAnswered(null)
    setBlocks(0)
    setTries(0)
    // the riders and the bird of the next pair would take a still-set fly
    // as their cue and jump the moment they appear
    setFly(0)
    setVerdict(null)
    setAway(null)
    setIdx(idx + 1)
  }

  // First the guess shows for a moment, then the seesaw tells the truth.
  const answer = useCallback((side) => {
    if (answered || balance) return
    const ok = side === heavy
    setAnswered(side)
    sfx.drum()
    later(450, () => {
      if (ok) { firstTry.current++; streak.current++; sayRight() }
      else { streak.current = 0; sayWrong() }
      // a right guess: the light one is flung off to a perch and stays there
      const light = side === 'left' ? 'right' : side === 'right' ? 'left' : null
      const spot = ok && light ? chooseSpot(streak.current, landed, !!sunAt) : null
      const box = boxRef.current, el = riderRefs[light]?.current
      if (spot && box && el) {
        const r = el.getBoundingClientRect(), b = box.getBoundingClientRect(), k = b.width / box.offsetWidth
        const from = { x: (r.left + r.width / 2 - b.left) / k, y: (r.top + r.height / 2 - b.top) / k, size: r.width / k }
        setLanded(l => [...l, { id: idx, e: q[light].e, spot, from, wild: streak.current, done: !!reduce }])
        setAway(light)
      }
      setFly(f => f + 1)
      setVerdict(ok ? 'right' : 'wrong')
      // the plank swings, the light one flies and lands (or the bird is
      // catapulted and flutters back dazed): about two or three seconds
      afterSpeech(next, ok ? 2500 : 3000)
    })
  }, [answered, balance, heavy, landed, sunAt, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Level 10: blocks on and off, then check
  const addBlock = () => {
    if (answered || blocks >= 15) return false
    setBlocks(b => b + 1)
    sfx.drum(true)
    pop(blocks + 1)
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
      sayRight()
      afterSpeech(next, 2200)
      return
    }
    // Right away: the plank shakes and settles where the weights put it,
    // the heavier side glows, the bird shrugs.
    setTries(t => t + 1)
    setWobble(w => w + 1)
    sfx.boing()
    sayWrong()
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

  // The hand: tap one of the two (both hands, so neither is the answer);
  // in level 10 drag a brick over, then the tick.
  const asking = !answered
  const hints = balance
    ? (blocks
        ? <HintHand key={`t${idx}`} to={doneRef} active={asking} delay={9000} />
        : <HintHand key={`b${idx}`} from={brickRef} to={dropRef} active={asking} delay={idx === 0 ? 2000 : 6000} />)
    : ['left', 'right'].map(side => <HintHand key={`${side}${idx}`} to={riderRefs[side]} active={asking} delay={idx === 0 ? 2000 : 6000} repeat={2} />)

  return (
    <DragArea autoTarget="right" disabled={!balance || !!answered}>
      <Stage wide={[780, 540]} tall={[400, 660]}>
        {wide => (
          <>
            <RoundTrail total={questions.length} done={idx + (answered ? 1 : 0)} walker="🐦" goal="🛝" size={wide ? 36 : 32} style={{ margin: '6px 48px 0 24px' }} />
            <div ref={areaRef} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', position: 'relative' }}>
              <div ref={boxRef} style={{ position: 'relative', width: wide ? 620 : 360, height: H }}>
                <Yard wide={wide} width={wide ? 620 : 360} landed={landed} sunAt={sunAt} layer="back" />
                <AnimatePresence mode="wait">
                  <motion.div key={idx} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.3 }}
                    style={{ position: 'relative', zIndex: 1 }}>
                    <Seesaw width={wide ? 620 : 360} q={q} tilt={tilt} fly={fly} answered={answered} heavy={heavy} streak={streak.current}
                      verdict={verdict} wobble={wobble} heavier={q.left.w > q.right.w + (blocks ?? 0) ? 'left' : q.left.w < q.right.w + (blocks ?? 0) ? 'right' : null}
                      sizes={[size(q.left), size(q.right)].map(s => (wide ? s : Math.min(s, 140)))} riderRefs={riderRefs} dropRef={dropRef} pops={pops}
                      onPick={balance ? null : answer} blocks={balance ? blocks : null} onTakeBlock={takeBlock} onDropBlock={addBlock}
                      away={away} hats={landed.filter(l => l.spot.kind === 'head' && l.done).map(l => l.e)} />
                  </motion.div>
                </AnimatePresence>
                <Yard wide={wide} width={wide ? 620 : 360} landed={landed} sunAt={sunAt} layer="front"
                  onLand={id => setLanded(l => l.map(x => (x.id === id ? { ...x, done: true } : x)))} />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 22, padding: '4px 12px 14px', minHeight: 92 }}>
              {/* "Both the same" needs a control of its own — shown in the
                  levels where ties occur. */}
              {!balance && ties && (
                <motion.button type="button" onClick={() => answer('equal')} disabled={!!answered}
                  aria-label="Gleich schwer"
                  whileTap={{ scale: 0.9 }} animate={{ opacity: answered ? 0.4 : 1 }}
                  className="px-btn px-btn--parch" style={{ minHeight: 72, minWidth: 96, padding: '6px 18px' }}>
                  <Art art="⚖️" size={56} />
                </motion.button>
              )}
              {balance && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 8, borderRadius: 16, background: 'rgba(255,253,247,0.75)', border: '3px dashed #8a4f22' }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} ref={i === 0 ? brickRef : undefined}>
                        <Draggable key={`${i}-${i === 0 ? blocks : 0}`} id={`b${i}-${blocks}`} data="block" label="Klotz, ein Kilo">
                          <Art art="🧱" size={58} />
                        </Draggable>
                      </div>
                    ))}
                  </div>
                  <div ref={doneRef}><DoneButton onClick={checkBalance} disabled={!!answered || !blocks} size={78} /></div>
                </>
              )}
            </div>
            {answered === 'finale' && (
              <Finale cast={cast} size={wide ? 110 : 84} onDone={() => onComplete(result(firstTry.current, questions.length))} />
            )}
          </>
        )}
      </Stage>
      {hints}
    </DragArea>
  )
}

// ── The seesaw ─────────────────────────────────────────────────────────────
const H = 330, PIVOT = H - 64

function Seesaw({ width, q, tilt, fly, answered, heavy, streak, verdict, wobble, heavier, sizes, onPick, blocks, onTakeBlock, onDropBlock, riderRefs, dropRef, pops, away, hats }) {
  const reduce = useReducedMotion()
  const L = width * 0.44                 // half the plank
  const ang = useMotionValue(tilt)       // plank angle in degrees, + is right side down
  const [bursts, burst] = useBursts()
  const shook = useRef(wobble)
  useEffect(() => {
    if (reduce) { ang.jump(tilt); return }
    // a wrong tick in level 10: a shake first, then it settles
    const shake = wobble !== shook.current
    shook.current = wobble
    const c = shake
      ? animate(ang, [ang.get(), tilt + 6, tilt - 5, tilt + 3, tilt], { duration: 0.8 })
      : animate(ang, tilt, TIP)
    return () => c.stop()
  }, [tilt, wobble]) // eslint-disable-line react-hooks/exhaustive-deps

  // The verdict, without words: stars burst at a right guess (at both on a
  // right "gleich schwer"); after a wrong one the side that really went
  // down lights up.
  useEffect(() => {
    if (verdict !== 'right') return
    const els = answered === 'equal' ? [riderRefs.left.current, riderRefs.right.current] : [riderRefs[answered]?.current]
    const t = setTimeout(() => els.forEach(el => el && burst(el, 'stars', 12)), 500)
    return () => clearTimeout(t)
  }, [verdict]) // eslint-disable-line react-hooks/exhaustive-deps
  // level 10: after a wrong tick the heavier side glows for a moment
  const [glow, setGlow] = useState(null)
  useEffect(() => {
    if (!wobble) return
    setGlow(heavier)
    const t = setTimeout(() => setGlow(null), 1800)
    return () => clearTimeout(t)
  }, [wobble]) // eslint-disable-line react-hooks/exhaustive-deps

  // Who flies: the side that went up; on a tie both hop a little.
  const up = !fly ? null : tilt < 0 ? 'right' : tilt > 0 ? 'left' : 'both'
  const label = (side) => {
    const s = q[side]
    if (q.kind === 'things') return null
    return side === 'right' && blocks ? `${s.w} + ${blocks} kg` : sideLabel(s)
  }
  const rider = (side, i) => (
    <Rider key={side} side={side} item={q[side]} size={sizes[i]} d={L * 0.8} cx={width / 2} ang={ang}
      label={label(side)} fly={up === side || up === 'both' ? fly : 0} small={up === 'both'} wild={streak} away={away === side}
      guessed={answered === side} heavy={!!fly && heavy === side} innerRef={riderRefs[side]}
      verdict={answered === side || answered === 'equal' ? verdict : null}
      truth={(verdict === 'wrong' && heavy === side) || glow === side} wobble={wobble} heavier={heavier}
      onTap={onPick && !answered ? () => onPick(side) : null} />
  )

  return (
    <div data-heavy={heavy} style={{ position: 'relative', width, height: H }}>
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
      {/* The bird asks without words: who goes down? (or, in level 10: make it level) */}
      <Bird x={width / 2} ang={ang} fly={fly} verdict={verdict} wobble={wobble} hats={hats}
        ask={!answered && (balance(q) ? <Art art="⚖️" size={30} /> : <><DownArrow />?</>)} />
      {balance(q) && (
        <>
          <DropZone id="right" onDrop={onDropBlock} label="Rechte Seite der Wippe"
            style={{ position: 'absolute', left: width / 2 + 30, top: PIVOT - 200, width: L, height: 210 }}>
            {hover => <div ref={dropRef} style={{ width: '100%', height: '100%', borderRadius: 24, background: hover ? 'rgba(255,201,60,0.25)' : 'transparent' }} />}
          </DropZone>
          <Blocks n={blocks} x={width / 2 + L * 0.42} ang={ang} d={L * 0.42} onTake={onTakeBlock}>{pops}</Blocks>
        </>
      )}
      {rider('left', 0)}
      {rider('right', 1)}
      {bursts}
    </div>
  )
}

// "Which one goes down?" — an arrow, not a hand (the hand is the hint)
function DownArrow() {
  return (
    <svg viewBox="0 0 24 30" width={22} height={28} aria-hidden="true">
      <path d="M12 2 V22 M4 15 L12 26 L20 15" fill="none" stroke="#2a1b3d" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
const balance = q => q.kind === 'balance'

// One rider on the plank. It stays upright and follows its end of the plank;
// the light one is flung up ("Huiii!") and plops back down.
function Rider({ side, item, size, d, cx, ang, label, fly, small, wild, away, guessed, heavy, verdict, truth, wobble, heavier, onTap, innerRef }) {
  const reduce = useReducedMotion()
  const s = side === 'left' ? -1 : 1
  const hop = useMotionValue(0)
  const spin = useMotionValue(0)
  const y = useTransform([ang, hop], ([a, h]) => s * d * Math.sin((a * Math.PI) / 180) + h)
  const [mood, setMood] = useMood()

  // How it feels after landing: a right guess cheers, a wrong guess is
  // puzzled; the one that really went down is surprised.
  const after = verdict === 'right' ? ['dance', 2200] : verdict === 'wrong' ? ['oops', 2200] : ['happy', 1400]
  useEffect(() => {
    if (!fly) return
    if (heavy) { setMood(verdict === 'right' ? 'dance' : 'wow', verdict === 'right' ? 2200 : 1400); return }
    sfx.whoosh()
    // flung off to a perch: the yard takes over its flight from here
    if (away) return
    if (reduce) { setMood(...after); return }
    // a streak of right guesses flings it higher, with a somersault
    const high = small ? -36 : -110 - Math.min(wild, 3) * 15
    const c = animate(hop, [0, high, 0], { duration: small ? 0.5 : 1.15, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] })
    if (!small && (wild >= 2 || Math.random() < 0.4)) animate(spin, [0, wild >= 3 ? 720 : 360], { duration: 1.1 })
    c.then(() => { sfx.boing(); setMood(...after) })
    return () => c.stop()
  }, [fly]) // eslint-disable-line react-hooks/exhaustive-deps
  // level 10, a wrong tick: the heavier one says "wow", the other "oops"
  useEffect(() => {
    if (wobble) setMood(heavier === side ? 'wow' : 'oops', 1400)
  }, [wobble]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div ref={innerRef} style={{ position: 'absolute', left: cx + s * d - size / 2, top: PIVOT - 10 - size, width: size, height: size, y, zIndex: 3, opacity: away && fly ? 0 : 1 }}>
      <motion.div style={{ rotate: spin, width: size, height: size }}>
        <Critter art={item.e} size={size} label={item.label ?? label} shadow={false}
          mood={guessed && mood === 'idle' ? 'wow' : mood} onTap={onTap ?? undefined} />
      </motion.div>
      {/* the weight tag stays upright while its parcel somersaults */}
      {label && <div aria-hidden="true" style={tag}>{label}</div>}
      {/* the side that really went down shines */}
      <AnimatePresence>
        {truth && (
          <motion.div key="halo" aria-hidden="true" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.1, 1] }} exit={{ opacity: 0 }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ position: 'absolute', inset: '-22%', borderRadius: '50%', zIndex: -2, background: 'radial-gradient(circle, rgba(255,214,90,0.85) 0%, rgba(255,214,90,0.35) 45%, transparent 70%)' }} />
        )}
      </AnimatePresence>
      {/* A ring of light under it: the child's guess (gold), then green
          for right or grey and wobbling for wrong; the side that really
          went down glows gold. */}
      <AnimatePresence>
        {(guessed || truth) && (
          <motion.div key="ring" aria-hidden="true" initial={{ opacity: 0, scale: 0.4 }}
            animate={guessed && verdict === 'wrong' ? { opacity: 0.8, scale: 1, rotate: [0, -8, 8, -5, 0] } : { opacity: 1, scale: [1, 1.12, 1] }}
            exit={{ opacity: 0 }} transition={{ duration: 0.7, repeat: guessed && !verdict ? Infinity : 0 }}
            style={{
              position: 'absolute', left: -size * 0.08, right: -size * 0.08, bottom: -12, height: 26, borderRadius: '50%', zIndex: -1,
              border: `5px solid ${guessed && verdict === 'right' ? '#5cc45a' : guessed && verdict === 'wrong' ? '#9aa3b5' : '#ffc93c'}`,
              background: guessed && verdict === 'wrong' ? 'rgba(154,163,181,0.25)' : guessed && verdict === 'right' ? 'rgba(92,196,90,0.35)' : 'rgba(255,201,60,0.4)',
              boxShadow: truth || (guessed && verdict === 'right') ? '0 0 18px 6px rgba(255,201,60,0.7)' : 'none',
            }} />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

const tag = {
  position: 'absolute', left: '50%', bottom: '100%', transform: 'translateX(-50%)', marginBottom: 8, whiteSpace: 'nowrap',
  background: '#fffdf7', border: '3px solid #2a1b3d', borderRadius: 14, padding: '3px 10px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: '#2a1b3d',
}

// A little bird on the middle of the plank: the referee. It cheers a right
// guess with a hop; at a wrong one the jolt catapults it, head over heels,
// and it flutters back down and sits there dazed, stars circling its head.
// Things flung onto its head stay there, stacked, and go along for the ride.
function Bird({ x, ang, fly, verdict, wobble, ask, hats = [] }) {
  const reduce = useReducedMotion()
  const hop = useMotionValue(0)
  const sway = useMotionValue(0)
  const spin = useMotionValue(0)
  const [mood, setMood] = useMood()
  const [dazed, setDazed] = useState(0)
  useEffect(() => {
    if (!fly) return
    if (verdict !== 'wrong') {
      setMood('happy', 1600)
      if (reduce) return
      const c = animate(hop, [0, -60, -50, 0], { duration: 1, times: [0, 0.35, 0.7, 1] })
      return () => c.stop()
    }
    setMood('oops', 2600)
    if (reduce) { setDazed(d => d + 1); return }
    sfx.whoosh()
    // up and over, then down in little flutters, rocking side to side
    const a = animate(spin, [0, 720], { duration: 0.9, ease: 'easeOut' })
    const b = animate(hop, [0, -210, -150, -165, -90, -105, -30, 0], { duration: 2.1, times: [0, 0.22, 0.4, 0.5, 0.66, 0.74, 0.9, 1], ease: 'easeInOut' })
    const c = animate(sway, [0, 14, -22, 20, -16, 10, 0], { duration: 2.1 })
    const t = setTimeout(() => { sfx.boing(); setDazed(d => d + 1) }, 2100)
    return () => { a.stop(); b.stop(); c.stop(); clearTimeout(t) }
  }, [fly]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (wobble) setMood('oops', 1600) }, [wobble]) // eslint-disable-line react-hooks/exhaustive-deps
  // the stack on its head wobbles whenever it hops
  return (
    <motion.div style={{ position: 'absolute', left: x - 30, top: PIVOT - 70, y: hop, x: sway, rotate: ang, zIndex: 2 }}>
      <motion.div style={{ rotate: spin, position: 'relative' }}>
        <Critter art="🐦" size={60} mood={mood} label="Vogel" shadow={false} />
        {hats.map((e, i) => (
          <motion.div key={i} aria-hidden="true"
            initial={reduce ? false : { scaleY: 0.6, y: -10 }} animate={{ scaleY: 1, y: 0, rotate: fly && !reduce ? [0, (i % 2 ? 9 : -9), 0] : 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 9 }}
            style={{ position: 'absolute', left: 30 - PERCH * 0.38 + (i % 2 ? 4 : -4), top: -PERCH * 0.62 - i * PERCH * 0.55, width: PERCH * 0.76, height: PERCH * 0.76, transformOrigin: '50% 100%', zIndex: 1 + i, pointerEvents: 'none' }}>
            <Art art={e} size={PERCH * 0.76} />
          </motion.div>
        ))}
      </motion.div>
      <Dazed key={dazed} on={dazed > 0} />
      {/* the question, above whatever is stacked on its head */}
      {ask && (
        <div style={{ position: 'absolute', left: 0, top: -(hats.length ? PERCH * 0.2 + hats.length * PERCH * 0.55 : 0), width: 60, height: 60, pointerEvents: 'none' }}>
          <Wish side="top" size={60}>{ask}</Wish>
        </div>
      )}
    </motion.div>
  )
}

// Two little stars circling over a dazed bird's head, for a moment.
function Dazed({ on }) {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(on)
  useEffect(() => {
    if (!on) return
    const t = setTimeout(() => setShow(false), 1600)
    return () => clearTimeout(t)
  }, [on])
  if (!show) return null
  return (
    <motion.div aria-hidden="true" initial={{ rotate: 0 }} animate={reduce ? {} : { rotate: 720 }} transition={{ duration: 1.6, ease: 'linear' }}
      style={{ position: 'absolute', left: 8, top: -8, width: 44, height: 22, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: -6, top: -4 }}><Art art="💫" size={26} /></div>
      <div style={{ position: 'absolute', right: -6, top: 2 }}><Art art="⭐" size={18} /></div>
    </motion.div>
  )
}

// ── The yard around the seesaw ─────────────────────────────────────────────
// A tree beside the seesaw (behind it), the things that landed in it or on
// the sun (behind), and the ones still in the air (in front).
function Yard({ wide, width, landed, sunAt, layer, onLand }) {
  const reduce = useReducedMotion()
  const { T, left, top } = treeAt(wide)
  const inTree = landed.filter(l => l.spot.kind === 'tree' && l.done).length
  const spotXY = ({ kind, i }) => {
    if (kind === 'tree') return { x: left + TREE_SLOTS[i][0] * T, y: top + TREE_SLOTS[i][1] * T }
    // stuck on the sun's left rim, one below the other
    if (kind === 'sun') return sunAt ? { x: sunAt.x - [0.8, 1.02, 0.7][i] * sunAt.r, y: sunAt.y + [-0.6, 0.12, 0.8][i] * sunAt.r } : null
    // the bird's head, as the Bird draws its stack
    return { x: width / 2 - 4 + (i % 2 ? 8 : 0), y: PIVOT - 70 - PERCH * 0.62 + PERCH * 0.38 - i * PERCH * 0.55 }
  }
  if (layer === 'back') {
    return (
      <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <motion.div key={inTree} initial={false} animate={reduce || !inTree ? {} : { rotate: [0, -2.5, 2, -1, 0] }} transition={{ duration: 0.6 }}
          style={{ position: 'absolute', left, top, width: T, height: T, transformOrigin: '50% 100%' }}>
          <Art art="🌳" size={T} />
        </motion.div>
        {landed.filter(l => l.done && l.spot.kind !== 'head').map(l => {
          const p = spotXY(l.spot)
          if (!p) return null
          return (
            <motion.div key={l.id} initial={reduce ? false : { scaleY: 0.6, y: 6 }} animate={{ scaleY: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 8 }}
              style={{ position: 'absolute', left: p.x - PERCH / 2, top: p.y - PERCH / 2, width: PERCH, height: PERCH, transformOrigin: '50% 100%' }}>
              <div style={{ transform: l.spot.flip ? 'rotate(180deg)' : undefined }}><Art art={l.e} size={PERCH} /></div>
            </motion.div>
          )
        })}
      </div>
    )
  }
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 5, pointerEvents: 'none' }}>
      {landed.filter(l => !l.done).map(l => {
        const p = spotXY(l.spot) ?? { x: l.from.x, y: l.from.y }
        const fx = l.from.x - p.x, fy = l.from.y - p.y, k = l.from.size / PERCH, end = l.spot.kind === 'head' ? 0.76 : 1
        const land = () => { sfx.boing(); onLand(l.id) }
        return (
          <motion.div key={l.id}
            initial={reduce ? { x: 0, y: 0, scale: 1 } : { x: fx, y: fy, scale: k }}
            animate={reduce ? { x: 0, y: 0, scale: 1 } : {
              x: [fx, fx * 0.55, 0], y: [fy, Math.min(fy, 0) - (fy > 150 ? 50 : 110) - Math.min(l.wild, 6) * 8, 0], scale: [k, k * 0.85, end],
              rotate: l.wild >= 4 ? [0, 360, 720 + (l.spot.flip ? 180 : 0)] : l.spot.flip ? [0, 90, 180] : [0, -15, 0],
            }}
            transition={{ duration: reduce ? 0 : 1.1, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] }}
            onAnimationComplete={land}
            style={{ position: 'absolute', left: p.x - PERCH / 2, top: p.y - PERCH / 2, width: PERCH, height: PERCH }}>
            <Art art={l.e} size={PERCH} />
          </motion.div>
        )
      })}
    </div>
  )
}

// The 1-kg blocks laid on the right side (level 10); a tap takes one off.
function Blocks({ n, x, ang, d, onTake, children }) {
  const y = useTransform(ang, a => d * Math.sin((a * Math.PI) / 180))
  return (
    <motion.div style={{ position: 'absolute', left: x - 66, bottom: H - PIVOT + 10, y, zIndex: 4, width: 132, display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center' }}>
      <AnimatePresence>
        {Array.from({ length: n }, (_, i) => (
          <motion.button key={i} type="button" onClick={onTake} aria-label="Klotz wegnehmen"
            initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -40, opacity: 0 }}
            style={{ all: 'unset', cursor: 'pointer', width: 44, height: 38, display: 'flex', justifyContent: 'center' }}>
            <Art art="🧱" size={44} />
          </motion.button>
        ))}
      </AnimatePresence>
      <div style={{ position: 'absolute', left: 0, right: 0, top: -20 }}>{children}</div>
    </motion.div>
  )
}
