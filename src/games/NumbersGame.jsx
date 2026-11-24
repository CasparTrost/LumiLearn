import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { lockPreviews, stopNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { sfx } from '../sfx.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts, HintHand } from '../components/play/index.js'
import { Stage, useLater, DoneButton, usePops, Finale } from './zahlen/stage.jsx'

/**
 * Zahlenland — "Lumis Obststand"
 *
 * Animal customers queue at the market stand. Each one shows what it wants
 * in its bubble, as a number and a picture; the child puts the fruit from
 * the crates into the customer's basket and taps the tick. Right: the
 * customer pays with clinking coins and walks off happily with its basket.
 * Wrong: it looks into the basket, the counts show up, and only the wrong
 * kinds go back to the crates.
 */

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function shuffle(arr)  { return [...arr].sort(() => Math.random() - 0.5) }

const SHOP_ITEMS = [
  { emoji: '🍎', name: 'Apfel' },
  { emoji: '🍊', name: 'Orange' },
  { emoji: '🍋', name: 'Zitrone' },
  { emoji: '🍇', name: 'Weintraube' },
  { emoji: '🍓', name: 'Erdbeere' },
  { emoji: '🍩', name: 'Donut' },
  { emoji: '🧁', name: 'Muffin' },
  { emoji: '🥕', name: 'Karotte' },
  { emoji: '🌽', name: 'Maiskolben' },
  { emoji: '🍕', name: 'Pizzastück' },
  { emoji: '🐟', name: 'Fisch' },
  { emoji: '🌸', name: 'Blume' },
  { emoji: '🍌', name: 'Banane' },
  { emoji: '🎈', name: 'Ballon' },
  { emoji: '🍦', name: 'Eistüte' },
]

const CUSTOMERS = [
  ['🐻', 'Bär'], ['🐰', 'Hase'], ['🐷', 'Schwein'], ['🐮', 'Kuh'], ['🐧', 'Pinguin'], ['🦛', 'Nilpferd'],
  ['🐘', 'Elefant'], ['🐒', 'Affe'], ['🦆', 'Ente'], ['🐔', 'Huhn'], ['🐑', 'Schaf'], ['🦙', 'Lama'],
  ['🐼', 'Panda'], ['🦔', 'Igel'], ['🐱', 'Katze'], ['🐶', 'Hund'],
]

function buildQuestions(level, count = level <= 4 ? 8 : level <= 7 ? 10 : 12) {
  // L1-2: 1 item | L3-6: 2 items | L7-10: 3 items
  const numParts = level <= 2 ? 1 : level <= 6 ? 2 : 3
  // max quantity per item scales with level
  const maxN = [0, 4, 6, 5, 7, 8, 10, 7, 9, 10, 12][level] ?? 10
  const custs = shuffle(CUSTOMERS)
  return Array.from({ length: count }, (_, qi) => {
    const items = shuffle(SHOP_ITEMS)
    const [art, label] = custs[qi % custs.length]
    // Levels 9 and 10 bring real sums: every other customer already has some
    // at home and wants the rest ("Ich habe schon zwei, ich brauche fünf").
    if (level >= 9 && qi % 2 === 1) {
      const total = rnd(4, maxN)
      const home  = rnd(1, total - 1)
      return { art, label, home, parts: [{ item: items[0], n: total - home }] }
    }
    return { art, label, parts: Array.from({ length: numParts }, (_, pi) => ({ item: items[pi], n: rnd(1, maxN) })) }
  })
}

export default function NumbersGame({ level = 1, onComplete }) {
  const questions = useMemo(() => buildQuestions(level), [level])
  const reduce = useReducedMotion()
  const { later, afterSpeech, clear } = useLater()
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()
  const [pops, pop] = usePops()

  const [idx,    setIdx]    = useState(0)
  const [basket, setBasket] = useState({})     // { [partIdx]: count }
  const [phase,  setPhase]  = useState('shop') // shop | look | pay | finale
  const [wrongs, setWrongs] = useState(0)      // wrong baskets for this customer
  const [served, setServed] = useState(0)      // coins on the counter
  const [taken,  setTaken]  = useState({})     // per crate: a new fruit rolls up after each one
  const firstTry  = useRef(0)
  const streak    = useRef(0)
  const basketRef = useRef(null), crateRef = useRef(null), doneRef = useRef(null)

  const q = questions[idx]
  const given = Object.values(basket).reduce((a, b) => a + b, 0)
  // The numbers on the crates would do the counting for the child. They
  // come in as a help once an order went wrong.
  const help = wrongs >= 1

  useEffect(() => stopNarration, [])

  // The next customer steps up.
  useEffect(() => {
    lockPreviews()
    sayTask()
  }, [idx])

  const put = (pi) => {
    if (phase !== 'shop') return false
    setBasket(b => ({ ...b, [pi]: (b[pi] || 0) + 1 }))
    setTaken(t => ({ ...t, [pi]: (t[pi] || 0) + 1 }))
    sfx.pop()
    if (help) pop((basket[pi] || 0) + 1)
    return true
  }
  // A tap on a kind in the basket puts one of exactly that kind back.
  const putBack = (pi) => {
    if (phase !== 'shop' || !(basket[pi] > 0)) return
    setBasket(b => ({ ...b, [pi]: Math.max(0, (b[pi] || 0) - 1) }))
    sfx.slideUp()
  }

  const next = () => {
    if (idx + 1 >= questions.length) { setPhase('finale'); return }
    clear()
    setIdx(idx + 1)
    setBasket({})
    setTaken({})
    setWrongs(0)
    setMood('idle')
    setPhase('shop')
  }

  const confirm = () => {
    if (phase !== 'shop' || !given) return
    if (q.parts.every((p, i) => (basket[i] || 0) === p.n)) {
      setPhase('pay')
      if (wrongs === 0) { firstTry.current++; streak.current++ } else streak.current = 0
      // The customer cheers — on a streak with a dance and confetti — and
      // now and then can't wait and takes a bite right away.
      const party = streak.current >= 3 && streak.current % 3 === 0
      if (party) { setMood('dance', 2400); sfx.tada() }
      else if (Math.random() < 0.3) { setMood('eat', 800); sfx.chomp(); later(800, () => setMood('happy', 1400)) }
      else setMood(['happy', 'dance', 'wow'][rnd(0, 2)], 1600)
      burst(basketRef.current, party ? 'confetti' : 'stars', party ? 22 : 10)
      // It pays: coins clink onto the counter one by one.
      ;[0, 1, 2].forEach(i => later(350 + i * 260, () => { sfx.coin(); setServed(s => s + 1) }))
      sayRight()
      afterSpeech(next, party ? 2600 : 2200)
      return
    }
    setPhase('look')
    setWrongs(w => w + 1)
    streak.current = 0
    setMood('oops', 2000)
    sayWrong()
    // It looks into the basket and the counts come up; then only the wrong
    // kinds go back to the crates — what was counted right stays.
    afterSpeech(() => {
      sfx.boing()
      setBasket(b => {
        const keep = {}
        q.parts.forEach((p, i) => { if ((b[i] || 0) === p.n) keep[i] = b[i] })
        return keep
      })
      setPhase('shop')
    }, 2000)
  }

  const waiting = questions.slice(idx + 1, idx + 3).map((c, i) => ({ ...c, key: idx + 1 + i }))
  // The hand: a fruit from the first crate into the basket; once something
  // is in it, the tick.
  const hint = given > 0
    ? <HintHand key={`t${idx}`} to={doneRef} active={phase === 'shop'} delay={9000} />
    : <HintHand key={`d${idx}`} from={crateRef} to={basketRef} active={phase === 'shop'} delay={idx === 0 ? 2000 : 6000} />

  return (
    <DragArea autoTarget="basket" disabled={phase !== 'shop'}>
      <Stage wide={[800, 560]} tall={[440, 740]}>
        {wide => {
          const size = wide ? 200 : 180
          const customer = (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', paddingTop: wide ? 96 : 84 }}>
              <AnimatePresence mode="wait">
                <motion.div key={idx}
                  initial={reduce ? { opacity: 0 } : { x: 320, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { x: -520, opacity: 0, rotate: [0, -6, 6, -6, 0], transition: { duration: 0.7, ease: 'easeIn' } }}
                  transition={{ type: 'spring', stiffness: 140, damping: 17 }}>
                  <Critter art={q.art} size={size} mood={mood} label={q.label}
                    wish={phase === 'pay' ? null : <Order q={q} />} />
                </motion.div>
              </AnimatePresence>
            </div>
          )
          const bag = (
            <DropZone id="basket" onDrop={d => put(d.pi)} label="Korb">
              {(hover, { ready }) => (
                // the customer takes the full basket along; the next one brings an empty one
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={idx} initial={reduce ? { opacity: 0 } : { x: 320, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { x: -520, opacity: 0, transition: { duration: 0.7, ease: 'easeIn' } }}
                    transition={{ type: 'spring', stiffness: 140, damping: 17 }} style={{ position: 'relative' }}>
                    <Basket q={q} basket={basket} onTake={putBack} glow={hover || ready} innerRef={basketRef}
                      counts={phase === 'look'} size={wide ? 190 : 180} />
                    <div style={{ position: 'absolute', left: 0, right: 0, top: '20%' }}>{pops}</div>
                  </motion.div>
                </AnimatePresence>
              )}
            </DropZone>
          )
          // The crates change with the customer: the old ones sink behind the
          // counter while it walks off, then the new ones come up.
          const crates = (
            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={idx} initial={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { y: 90, opacity: 0, transition: { duration: 0.7, ease: 'easeIn' } }}
                transition={{ type: 'spring', stiffness: 220, damping: 20 }}
                style={{ display: 'flex', gap: wide ? 18 : 10, alignItems: 'flex-end', justifyContent: 'center' }}>
                {q.parts.map((p, i) => (
                  <Crate key={i} item={p.item} id={`${idx}-${i}-${taken[i] || 0}`} pi={i} innerRef={i === 0 ? crateRef : undefined}
                    count={help ? basket[i] || 0 : null} width={q.parts.length === 3 ? 128 : wide ? 150 : 140} />
                ))}
              </motion.div>
            </AnimatePresence>
          )
          const trail = <RoundTrail total={questions.length} done={idx + (phase === 'pay' || phase === 'finale' ? 1 : 0)} walker="🧺" goal="🪙" size={wide ? 36 : 32} style={{ margin: '6px 48px 0 24px' }} />
          const done = <div ref={doneRef}><DoneButton onClick={confirm} disabled={phase !== 'shop' || !given} size={wide ? 84 : 80} /></div>
          return (
            <>
              {wide ? (
                <>
                  {trail}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 40, padding: '0 16px' }}>
                    {customer}
                    {bag}
                    <Queue list={waiting} />
                  </div>
                  <Counter>
                    {crates}
                    <Coins n={served} />
                    {done}
                  </Counter>
                </>
              ) : (
                <>
                  {trail}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                      {customer}
                      {bag}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
                      <Coins n={served} />
                      {done}
                    </div>
                  </div>
                  <Counter>{crates}</Counter>
                </>
              )}
              {phase === 'finale' && (
                <Finale cast={questions.slice(0, 6).map(c => c.art)} size={wide ? 110 : 84}
                  onDone={() => onComplete(result(firstTry.current, questions.length))} />
              )}
            </>
          )
        }}
      </Stage>
      {hint}
      {bursts}
    </DragArea>
  )
}

// What the customer wants, as pictures: "4 🍋", or for the rest orders
// "🏠 2 🍎 → 5 🍎".
function Order({ q }) {
  const num = n => <span style={{ fontSize: 30, lineHeight: 1 }}>{n}</span>
  if (q.home) {
    const { item, n } = q.parts[0]
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label={`${q.home} ${item.name} zu Hause, ${q.home + n} gewünscht`}>
        <Art art="🏠" size={34} />{num(q.home)}<Art art={item.emoji} size={34} />
        <span style={{ fontSize: 26, margin: '0 4px' }}>→</span>
        {num(q.home + n)}<Art art={item.emoji} size={34} />
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label={q.parts.map(p => `${p.n} ${p.item.name}`).join(', ')}>
      {q.parts.map((p, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{num(p.n)}<Art art={p.item.emoji} size={38} /></span>
      ))}
    </span>
  )
}

const badge = {
  position: 'absolute', right: -24, top: '50%', marginTop: -18, width: 36, height: 36, borderRadius: '50%', zIndex: 3,
  background: '#fffdf7', border: '3px solid #2a1b3d', boxShadow: '0 3px 0 #2a1b3d',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 19, color: '#2a1b3d',
}

// The customer's basket: one row per kind, each row a button that puts one
// of that kind back on its crate. While the customer looks into it, each
// row shows its count, and the rows that are off wiggle.
function Basket({ q, basket, onTake, glow, counts, innerRef, size }) {
  const total = Object.values(basket).reduce((a, b) => a + b, 0)
  return (
    <div ref={innerRef} style={{ position: 'relative', width: size, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 2, marginBottom: -size * 0.52, zIndex: 1, minHeight: 40 }}>
        {q.parts.map((p, i) => basket[i] > 0 && (
          <motion.button key={i} type="button" onClick={e => { e.stopPropagation(); onTake(i) }} aria-label={`${p.item.name} zurücklegen`}
            animate={counts && basket[i] !== p.n ? { rotate: [0, -4, 4, -4, 4, 0] } : { rotate: 0 }} transition={{ duration: 0.6, repeat: counts ? 2 : 0 }}
            style={{ all: 'unset', cursor: 'pointer', position: 'relative', display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center', maxWidth: size * 0.9, minHeight: 52, alignItems: 'center' }}>
            <AnimatePresence>
              {Array.from({ length: basket[i] }, (_, j) => (
                <motion.span key={j} initial={{ y: -50, scale: 0.4 }} animate={{ y: 0, scale: 1 }} exit={{ y: -40, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 20 }} style={{ margin: -2 }}>
                  <Art art={p.item.emoji} size={38} />
                </motion.span>
              ))}
            </AnimatePresence>
            {counts && (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} style={{ ...badge, background: basket[i] === p.n ? '#c9f0c2' : '#ffe08a' }}>{basket[i]}</motion.span>
            )}
          </motion.button>
        ))}
      </div>
      <motion.div key={total} initial={total ? { scaleY: 0.88, scaleX: 1.08 } : false} animate={{ scaleY: 1, scaleX: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 12 }} style={{ transformOrigin: '50% 100%', filter: glow ? 'drop-shadow(0 0 10px #ffc93c)' : undefined }}>
        <Art art="🧺" size={size} />
      </motion.div>
    </div>
  )
}

// A crate full of one kind; the one on top can be dragged (or tapped) into
// the basket, and another rolls up in its place.
function Crate({ item, id, pi, count, width, innerRef }) {
  return (
    <div style={{ position: 'relative', width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', marginBottom: -26, zIndex: 1, alignItems: 'flex-end' }}>
        <Art art={item.emoji} size={width * 0.34} style={{ transform: 'rotate(-14deg)', marginRight: -width * 0.12 }} />
        <div ref={innerRef} style={{ zIndex: 2 }}>
          <Draggable key={id} id={id} data={{ pi }} label={`${item.name} in den Korb legen`} style={{ borderRadius: '50%' }}>
            <motion.div initial={{ y: -16, scale: 0.6 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 16 }}>
              <Art art={item.emoji} size={width * 0.56} />
            </motion.div>
          </Draggable>
        </div>
        <Art art={item.emoji} size={width * 0.34} style={{ transform: 'rotate(12deg)', marginLeft: -width * 0.12 }} />
      </div>
      <div style={{
        width, height: width * 0.42, boxSizing: 'border-box', borderRadius: 8, border: '4px solid #2a1b3d',
        background: 'repeating-linear-gradient(0deg, #c27a3a 0 12px, #a8642c 12px 15px)', boxShadow: '0 5px 0 rgba(42,27,61,0.35)',
      }} />
      <AnimatePresence>
        {count != null && count > 0 && (
          <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            style={{ ...badge, right: -6, top: -6, marginTop: 0, width: 38, height: 38, fontSize: 20 }}>{count}</motion.span>
        )}
      </AnimatePresence>
    </div>
  )
}

// The stand's wooden counter along the bottom
function Counter({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 26, padding: '10px 14px 14px',
      background: 'linear-gradient(#c98a52 0 12px, #a8693a 12px)', borderTop: '4px solid #2a1b3d',
    }}>
      {children}
    </div>
  )
}

// The coins the customers paid, piling up
function Coins({ n }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 76, height: 84 }}>
      {Array.from({ length: Math.min(n, 18) }, (_, i) => (
        <motion.div key={i} initial={{ y: -90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
          style={{ position: 'absolute', left: (i % 3) * 18 + 2, bottom: Math.floor(i / 3) * 9 }}>
          <Art art="🪙" size={36} />
        </motion.div>
      ))}
    </div>
  )
}

// The next customers, waiting their turn; each keeps its place in the line
// as it moves up.
function Queue({ list }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, alignSelf: 'flex-end', minWidth: 150 }}>
      <AnimatePresence initial={false}>
        {list.map((c, i) => (
          <motion.div key={c.key} layout initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -60, opacity: 0 }}>
            <Critter art={c.art} size={i === 0 ? 76 : 62} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
