import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { narrate, lockPreviews, stopNarration } from '../narrator.js'
import { sayNumber, sayCount } from '../tts.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { hearable } from '../lib/hearable.js'
import { sfx } from '../sfx.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts } from '../components/play/index.js'
import { Stage, useLater, DoneButton, HearButton } from './zahlen/stage.jsx'

/**
 * Zahlenland — "Lumis Obststand"
 *
 * Animal customers queue at the market stand. Each one says what it wants
 * (in the bubble as a number and a picture); the child puts the fruit from
 * the crates into the customer's basket and taps the tick. Right: the
 * customer pays with clinking coins and waddles off happily. Wrong: it
 * looks into the basket and counts ("Hm, das sind fünf, ich wollte vier"),
 * and only the wrong kinds go back to the crates.
 */

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function shuffle(arr)  { return [...arr].sort(() => Math.random() - 0.5) }

const SHOP_ITEMS = [
  { emoji: '🍎', name: 'Äpfel',       singular: 'Apfel',         g: 'm' },
  { emoji: '🍊', name: 'Orangen',     singular: 'Orange',        g: 'f' },
  { emoji: '🍋', name: 'Zitronen',    singular: 'Zitrone',       g: 'f' },
  { emoji: '🍇', name: 'Weintrauben', singular: 'Weintraube',    g: 'f' },
  { emoji: '🍓', name: 'Erdbeeren',   singular: 'Erdbeere',      g: 'f' },
  { emoji: '🍩', name: 'Donuts',      singular: 'Donut',         g: 'm' },
  { emoji: '🧁', name: 'Muffins',     singular: 'Muffin',        g: 'm' },
  { emoji: '🥕', name: 'Karotten',    singular: 'Karotte',       g: 'f' },
  { emoji: '🌽', name: 'Maiskolben',  singular: 'Maiskolben',    g: 'm' },
  { emoji: '🍕', name: 'Pizzastücke', singular: 'Pizzastück',    g: 'n' },
  { emoji: '🐟', name: 'Fische',      singular: 'Fisch',         g: 'm' },
  { emoji: '🌸', name: 'Blumen',      singular: 'Blume',         g: 'f' },
  { emoji: '🍌', name: 'Bananen',     singular: 'Banane',        g: 'f' },
  { emoji: '🎈', name: 'Ballons',     singular: 'Ballon',        g: 'm' },
  { emoji: '🍦', name: 'Eistüten',    singular: 'Eistüte',       g: 'f' },
]

const CUSTOMERS = [
  ['🐻', 'Bär'], ['🐰', 'Hase'], ['🐷', 'Schwein'], ['🐮', 'Kuh'], ['🐧', 'Pinguin'], ['🦛', 'Nilpferd'],
  ['🐘', 'Elefant'], ['🐒', 'Affe'], ['🦆', 'Ente'], ['🐔', 'Huhn'], ['🐑', 'Schaf'], ['🦙', 'Lama'],
  ['🐼', 'Panda'], ['🦔', 'Igel'], ['🐱', 'Katze'], ['🐶', 'Hund'],
]
const GREETINGS = ['Ich möchte bitte', 'Gib mir bitte', 'Ich brauche', 'Ich hätte gerne']
const THANKS    = ['Danke!', 'Super!', 'Toll!', 'Perfekt!', 'Danke schön!']

const N = sayNumber
const noun = (n, item) => (n === 1 ? item.singular : item.name)
// Every greeting takes an object, so one masculine thing is "einen Apfel" —
// sayCount gives the nominative "ein", which is right after "Das ist" only.
const countAcc = (n, item) => n === 1
  ? `${item.g === 'm' ? 'einen' : item.g === 'f' ? 'eine' : 'ein'} ${item.singular}`
  : `${N(n)} ${item.name}`
// "vier Muffins, drei Zitronen und fünf Weintrauben" — said as it is written.
const listing = words => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} und ${words[words.length - 1]}`

function buildQuestions(level, count = level <= 4 ? 8 : level <= 7 ? 10 : 12) {
  // L1-2: 1 item | L3-6: 2 items | L7-10: 3 items
  const numParts = level <= 2 ? 1 : level <= 6 ? 2 : 3
  // max quantity per item scales with level
  const maxN = [0, 4, 6, 5, 7, 8, 10, 7, 9, 10, 12][level] ?? 10
  const custs = shuffle(CUSTOMERS)
  return Array.from({ length: count }, (_, qi) => {
    const items = shuffle(SHOP_ITEMS)
    const [art, label] = custs[qi % custs.length]
    const base = {
      art, label,
      greeting: GREETINGS[rnd(0, GREETINGS.length - 1)],
      thanks:   THANKS[rnd(0, THANKS.length - 1)],
    }
    // Levels 9 and 10 bring real sums: every other customer already has some
    // at home and wants the rest ("Ich habe schon zwei, ich brauche fünf").
    if (level >= 9 && qi % 2 === 1) {
      const total = rnd(4, maxN)
      const home  = rnd(1, total - 1)
      return { ...base, home, parts: [{ item: items[0], n: total - home }] }
    }
    return { ...base, parts: Array.from({ length: numParts }, (_, pi) => ({ item: items[pi], n: rnd(1, maxN) })) }
  })
}

function orderSpeech(q) {
  if (q.home) {
    const { item, n } = q.parts[0]
    return `Ich habe zu Hause schon ${countAcc(q.home, item)}. Ich brauche ${countAcc(q.home + n, item)}. Gib mir bitte den Rest!`
  }
  return `${q.greeting} ${listing(q.parts.map(p => countAcc(p.n, p.item)))}.`
}

// The customer looks into the basket and counts: what is off, and how.
function lookInBasket(q, basket) {
  if (q.home) {
    const { item, n } = q.parts[0], have = basket[0] || 0, total = q.home + n
    return `Hm, ${have > n ? 'das sind zu viele' : 'das sind zu wenige'}. Zu Hause sind schon ${N(q.home)}. Bis ${N(total)} fehlen noch ${countAcc(n, item)}.`
  }
  return q.parts.map((p, i) => ({ p, have: basket[i] || 0 })).filter(({ p, have }) => have !== p.n)
    .map(({ p, have }) => have === 0 ? `Ich möchte auch ${countAcc(p.n, p.item)}.`
      : `Hm, das ${have === 1 ? `ist ${sayCount(1, p.item.singular, p.item.g)}` : `sind ${N(have)} ${p.item.name}`}, ich wollte ${N(p.n)}.`)
    .join(' ')
}

export default function NumbersGame({ level = 1, onComplete }) {
  const questions = useMemo(() => buildQuestions(level), [level])
  const reduce = useReducedMotion()
  const { later, afterSpeech, clear } = useLater()
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()

  const [idx,       setIdx]       = useState(0)
  const [basket,    setBasket]    = useState({})   // { [partIdx]: count }
  const [phase,     setPhase]     = useState('shop') // shop | look | pay
  const [wrongs,    setWrongs]    = useState(0)    // wrong baskets for this customer
  const [served,    setServed]    = useState(0)    // coins on the counter
  const [taken,     setTaken]     = useState(0)    // a new fruit on top of the crate after each one
  const firstTry  = useRef(0)
  const basketRef = useRef(null)

  const q = questions[idx]
  const given = Object.values(basket).reduce((a, b) => a + b, 0)
  // The numbers on the crates and the voice counting along would do the
  // counting for the child. They come in as a help once an order went wrong.
  const help = wrongs >= 1

  useEffect(() => stopNarration, [])

  // Reading the order out once and never again is hard on a child holding
  // "vier Orangen und zwei Weintrauben" in mind while hunting the crates.
  const speakOrder = () => narrate([{ text: orderSpeech(q), rate: 0.8 }])

  // The next customer steps up and orders.
  useEffect(() => {
    lockPreviews()
    later(700, speakOrder)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const put = (pi) => {
    if (phase !== 'shop') return false
    const k = (basket[pi] || 0) + 1
    setBasket(b => ({ ...b, [pi]: (b[pi] || 0) + 1 }))
    setTaken(t => t + 1)
    sfx.pop()
    if (help) narrate([{ text: N(k) }])
    return true
  }
  // A tap on a kind in the basket puts one of exactly that kind back.
  const putBack = (pi) => {
    if (phase !== 'shop' || !(basket[pi] > 0)) return
    setBasket(b => ({ ...b, [pi]: Math.max(0, (b[pi] || 0) - 1) }))
    sfx.slideUp()
    if (help && basket[pi] > 1) narrate([{ text: N(basket[pi] - 1) }])
  }

  const next = () => {
    if (idx + 1 >= questions.length) { onComplete(result(firstTry.current, questions.length)); return }
    clear()
    setIdx(idx + 1)
    setBasket({})
    setWrongs(0)
    setPhase('shop')
  }

  const confirm = () => {
    if (phase !== 'shop' || !given) return
    if (q.parts.every((p, i) => (basket[i] || 0) === p.n)) {
      setPhase('pay')
      if (wrongs === 0) firstTry.current++
      // A little surprise now and then: a dance, a happy spin, a wiggle
      setMood(['happy', 'dance', 'happy', 'wow'][rnd(0, 3)], 2200)
      burst(basketRef.current, 'stars')
      // The customer pays: coins clink onto the counter one by one.
      ;[0, 1, 2].forEach(i => later(350 + i * 260, () => { sfx.coin(); setServed(s => s + 1) }))
      const got = q.home
        ? `Jetzt habe ich ${countAcc(q.home + q.parts[0].n, q.parts[0].item)}.`
        : `Das sind genau ${listing(q.parts.map(p => sayCount(p.n, noun(p.n, p.item), p.item.g)))}.`
      sayRight(`${q.thanks} ${got}`)
      afterSpeech(next, 1700)
      return
    }
    setPhase('look')
    setWrongs(w => w + 1)
    setMood('oops', 2400)
    sayWrong(lookInBasket(q, basket))
    // Only the wrong kinds go back to the crates; what was counted right
    // stays in the basket. That waits for the sentence.
    afterSpeech(() => {
      sfx.boing()
      setBasket(b => {
        const keep = {}
        q.parts.forEach((p, i) => { if ((b[i] || 0) === p.n) keep[i] = b[i] })
        return keep
      })
      setPhase('shop')
    }, 900)
  }

  const waiting = questions.slice(idx + 1, idx + 3)

  return (
    <DragArea autoTarget="basket" disabled={phase !== 'shop'}>
      <Stage wide={[800, 560]} tall={[440, 740]}>
        {wide => {
          const size = wide ? 200 : 160
          const customer = (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', paddingTop: wide ? 96 : 84 }}>
              <AnimatePresence mode="wait">
                <motion.div key={idx}
                  initial={reduce ? { opacity: 0 } : { x: 320, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={reduce ? { opacity: 0 } : { x: -420, opacity: 0, rotate: [0, -6, 6, -6, 0], transition: { duration: 0.7 } }}
                  transition={{ type: 'spring', stiffness: 140, damping: 17 }}>
                  <Critter art={q.art} size={size} mood={mood} label={q.label} talks
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
                    transition={{ type: 'spring', stiffness: 140, damping: 17 }}>
                    <Basket q={q} basket={basket} onTake={putBack} glow={hover || ready} bounce={given} innerRef={basketRef} size={wide ? 190 : 160} />
                  </motion.div>
                </AnimatePresence>
              )}
            </DropZone>
          )
          const crates = (
            <div style={{ display: 'flex', gap: wide ? 18 : 10, alignItems: 'flex-end', justifyContent: 'center' }}>
              {q.parts.map((p, i) => (
                <Crate key={`${idx}-${i}`} item={p.item} id={`${idx}-${i}-${taken}`} pi={i}
                  count={help ? basket[i] || 0 : null} width={q.parts.length === 3 ? 128 : wide ? 150 : 140} />
              ))}
            </div>
          )
          const trail = <RoundTrail total={questions.length} done={idx + (phase === 'pay' ? 1 : 0)} walker="🧺" goal="🪙" size={wide ? 36 : 32} style={{ margin: '6px 48px 0 24px' }} />
          const hear = <HearButton onClick={speakOrder} label="Bestellung noch einmal hören" />
          return wide ? (
            <>
              {trail}
              <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 34, padding: '0 16px' }}>
                <div style={{ alignSelf: 'center' }}>{hear}</div>
                {customer}
                {bag}
                <Queue list={waiting} />
              </div>
              <Counter>
                {crates}
                <Coins n={served} />
                <DoneButton onClick={confirm} disabled={phase !== 'shop' || !given} />
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  {hear}
                  <DoneButton onClick={confirm} disabled={phase !== 'shop' || !given} size={78} />
                </div>
              </div>
              <Counter>{crates}</Counter>
            </>
          )
        }}
      </Stage>
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
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }} aria-label={orderSpeech(q)}>
        <Art art="🏠" size={34} />{num(q.home)}<Art art={item.emoji} size={34} />
        <span style={{ fontSize: 26, margin: '0 4px' }}>→</span>
        {num(q.home + n)}<Art art={item.emoji} size={34} />
      </span>
    )
  }
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }} aria-label={orderSpeech(q)}>
      {q.parts.map((p, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{num(p.n)}<Art art={p.item.emoji} size={38} /></span>
      ))}
    </span>
  )
}

// The customer's basket: one row per kind, each row a button that puts one
// of that kind back on its crate.
function Basket({ q, basket, onTake, glow, bounce, innerRef, size }) {
  return (
    <div ref={innerRef} style={{ position: 'relative', width: size, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', gap: 2, marginBottom: -size * 0.52, zIndex: 1, minHeight: 40 }}>
        {q.parts.map((p, i) => basket[i] > 0 && (
          <button key={i} type="button" onClick={e => { e.stopPropagation(); onTake(i) }} aria-label={`${p.item.singular} zurücklegen`}
            style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center', maxWidth: size * 0.9, minHeight: 44, alignItems: 'center' }}>
            <AnimatePresence>
              {Array.from({ length: basket[i] }, (_, j) => (
                <motion.span key={j} initial={{ y: -50, scale: 0.4 }} animate={{ y: 0, scale: 1 }} exit={{ y: -40, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 20 }} style={{ margin: -2 }}>
                  <Art art={p.item.emoji} size={34} />
                </motion.span>
              ))}
            </AnimatePresence>
          </button>
        ))}
      </div>
      <motion.div key={bounce} initial={{ scaleY: 0.88, scaleX: 1.08 }} animate={{ scaleY: 1, scaleX: 1 }}
        transition={{ type: 'spring', stiffness: 600, damping: 12 }} style={{ transformOrigin: '50% 100%', filter: glow ? 'drop-shadow(0 0 10px #ffc93c)' : undefined }}>
        <Art art="🧺" size={size} />
      </motion.div>
    </div>
  )
}

// A crate full of one kind; the one on top can be dragged (or tapped) into
// the basket, and another rolls up in its place.
function Crate({ item, id, pi, count, width }) {
  return (
    <div style={{ position: 'relative', width, display: 'flex', flexDirection: 'column', alignItems: 'center' }} {...hearable(item.name)}>
      <div style={{ display: 'flex', marginBottom: -26, zIndex: 1, alignItems: 'flex-end' }}>
        <Art art={item.emoji} size={width * 0.34} style={{ transform: 'rotate(-14deg)', marginRight: -width * 0.12 }} />
        <Draggable key={id} id={id} data={{ pi }} label={`${item.singular} in den Korb legen`} style={{ borderRadius: '50%', zIndex: 2 }}>
          <motion.div initial={{ y: -16, scale: 0.6 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 16 }}>
            <Art art={item.emoji} size={width * 0.56} />
          </motion.div>
        </Draggable>
        <Art art={item.emoji} size={width * 0.34} style={{ transform: 'rotate(12deg)', marginLeft: -width * 0.12 }} />
      </div>
      <div style={{
        width, height: width * 0.42, boxSizing: 'border-box', borderRadius: 8, border: '4px solid #2a1b3d',
        background: 'repeating-linear-gradient(0deg, #c27a3a 0 12px, #a8642c 12px 15px)', boxShadow: '0 5px 0 rgba(42,27,61,0.35)',
      }} />
      <AnimatePresence>
        {count != null && count > 0 && (
          <motion.span key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
            style={{
              position: 'absolute', top: -6, right: -6, width: 38, height: 38, borderRadius: '50%', zIndex: 3,
              background: '#fffdf7', border: '3px solid #2a1b3d', boxShadow: '0 3px 0 #2a1b3d',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: '#2a1b3d',
            }}>{count}</motion.span>
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

// The coins the customers paid, piling up on the counter
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

// The next customers, waiting their turn
function Queue({ list }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, opacity: 0.9, alignSelf: 'flex-end' }}>
      {list.map((c, i) => (
        <motion.div key={c.art + i} layout initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }}>
          <Critter art={c.art} size={i === 0 ? 76 : 62} />
        </motion.div>
      ))}
    </div>
  )
}
