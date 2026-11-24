import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion, useAnimationControls } from 'framer-motion'
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
 * customer pays, the coins go into Lumi's money jar, and it walks off
 * happily with its basket. Wrong: it looks into the basket, the counts
 * show up, the rows that are off wiggle — and the child fixes them (takes
 * one out, puts more in); nothing that was right is taken away.
 *
 * Hold a crate and the fruit pours in one by one; a basket filled far past
 * the order tips over (a miss, like any wrong basket). Once per level a
 * king comes shopping and pays with one giant coin, and on a streak of
 * three the customer walks off wearing the basket as a hat.
 *
 * Rest orders (levels 9–10): what the customer has at home is already in
 * the basket, marked with a little house, and the bubble shows how many it
 * wants in all — the child counts on from there.
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

// How much a kind's row group may hold before the basket tips over: the
// order plus a few, rounded up to whole rows of five.
const capOf = (p, home = 0) => Math.ceil((p.n + home + 3) / 5) * 5

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

// Once per level a king does the shopping (never the first customer)
const pickVip = count => rnd(1, count - 2)

export default function NumbersGame({ level = 1, onComplete }) {
  const questions = useMemo(() => buildQuestions(level), [level])
  const vipAt = useMemo(() => pickVip(questions.length), [questions])
  const reduce = useReducedMotion()
  const { later, afterSpeech, clear } = useLater()
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()
  const [pops, pop] = usePops()

  const [idx,    setIdx]    = useState(0)
  const [basket, setBasket] = useState({})     // { [partIdx]: count }
  const [phase,  setPhase]  = useState('shop') // shop | look | tip | pay | finale
  const [wrongs, setWrongs] = useState(0)      // wrong baskets for this customer
  const [served, setServed] = useState(0)      // coins in the money jar
  const [giant,  setGiant]  = useState(0)      // the king's giant coins
  const [hat,    setHat]    = useState(null)   // { x, y }: the basket flies onto the customer's head
  const [taken,  setTaken]  = useState({})     // per crate: a new fruit rolls up after each one
  const [queueAt, setQueueAt] = useState(0)    // who stands in line; moves up once the old customer is gone
  const firstTry  = useRef(0)
  const streak    = useRef(0)
  const basketRef = useRef(null), crateRef = useRef(null), doneRef = useRef(null)
  const custRef = useRef(null), bagRef = useRef(null)

  const q = questions[idx]
  const given = Object.values(basket).reduce((a, b) => a + b, 0)
  // The counts on the basket rows would do the counting for the child.
  // They come in as a help once an order went wrong.
  const help = wrongs >= 1

  useEffect(() => stopNarration, [])

  // The next customer steps up.
  useEffect(() => {
    lockPreviews()
    sayTask()
  }, [idx])

  const vip = idx === vipAt
  const homeOf = pi => (q.home && pi === 0 ? q.home : 0)

  const put = (pi) => {
    if (phase !== 'shop') return false
    // far too many: the basket tips over and that kind spills out — a miss
    if ((basket[pi] || 0) + 1 + homeOf(pi) > capOf(q.parts[pi], homeOf(pi))) { tip(pi); return false }
    setBasket(b => ({ ...b, [pi]: (b[pi] || 0) + 1 }))
    setTaken(t => ({ ...t, [pi]: (t[pi] || 0) + 1 }))
    sfx.pop()
    if (help) pop((basket[pi] || 0) + 1 + homeOf(pi))
    return true
  }
  // Holding a crate pours (Crate calls this every 350 ms); the latest put
  // is kept in a ref, so each pour sees the basket as it is now.
  const putRef = useRef(put)
  putRef.current = put
  const pour = pi => putRef.current(pi)

  const tip = (pi) => {
    setPhase('tip')
    setWrongs(w => w + 1)
    streak.current = 0
    setMood('wow', 1600)
    sfx.boing()
    later(250, () => sfx.splash())
    sayWrong()
    afterSpeech(() => {
      setBasket(b => ({ ...b, [pi]: 0 }))
      setMood('oops', 1000)
      setPhase('shop')
    }, 2000)
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
    setHat(null)
    setMood('idle')
    setPhase('shop')
  }

  // The basket hops onto the customer's head; measured on screen, moved in
  // the stage's own (scaled) units.
  const putOnHead = () => {
    const bag = bagRef.current, cust = custRef.current
    if (!bag || !cust || reduce) return
    const b = bag.getBoundingClientRect(), c = cust.getBoundingClientRect()
    const scale = b.width / (bag.offsetWidth || b.width)
    setHat({
      x: (c.left + c.width / 2 - (b.left + b.width / 2)) / scale,
      y: (c.top + c.height * 0.2 - b.bottom + b.height * 0.25) / scale,
    })
  }

  const confirm = () => {
    if (phase !== 'shop' || !given) return
    if (q.parts.every((p, i) => (basket[i] || 0) === p.n)) {
      setPhase('pay')
      if (wrongs === 0) { firstTry.current++; streak.current++ } else streak.current = 0
      // The customer cheers — on a streak with a dance and confetti — and
      // now and then can't wait and takes a bite right away.
      const party = streak.current >= 3 && streak.current % 3 === 0
      if (party) { setMood('dance', 2400); sfx.tada(); later(300, putOnHead) }
      else if (Math.random() < 0.3) { setMood('eat', 800); sfx.chomp(); later(800, () => setMood('happy', 1400)) }
      else setMood(['happy', 'dance', 'wow'][rnd(0, 2)], 1600)
      burst(basketRef.current, party ? 'confetti' : 'stars', party ? 22 : 10)
      // It pays: coins clink into the jar one by one — the king with one
      // giant coin that lands with a thunk.
      if (vip) later(450, () => { sfx.drum(); sfx.coin(); setGiant(g => g + 1) })
      else [0, 1, 2].forEach(i => later(350 + i * 260, () => { sfx.coin(); setServed(s => s + 1) }))
      sayRight()
      afterSpeech(next, party ? 2600 : 2200)
      return
    }
    setPhase('look')
    setWrongs(w => w + 1)
    streak.current = 0
    setMood('oops', 2000)
    sfx.boing()
    sayWrong()
    // It looks into the basket: the counts come up and the rows that are
    // off wiggle. Everything stays in the basket; the child fixes it.
    afterSpeech(() => setPhase('shop'), 1800)
  }

  const waiting = questions.slice(queueAt + 1, queueAt + 3).map((c, i) => ({ ...c, key: queueAt + 1 + i }))
  // The hand: a fruit from the first crate into the basket; once something
  // is in it, the tick.
  const hint = given > 0
    ? <HintHand key={`t${idx}-${wrongs}`} to={wrongs ? basketRef : doneRef} active={phase === 'shop'} delay={wrongs ? 5000 : 9000} />
    : <HintHand key={`d${idx}`} from={crateRef} to={basketRef} active={phase === 'shop'} delay={idx === 0 ? 2000 : 6000} />

  return (
    <DragArea autoTarget="basket" disabled={phase !== 'shop'}>
      <Stage wide={[800, 560]} tall={[440, 780]}>
        {wide => {
          const size = wide ? 200 : 175
          // The next in line walks up from its place in the queue (on a
          // phone, where there is no queue, from the side).
          const customer = (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingTop: wide ? 96 : 76 }}>
              <AnimatePresence mode="wait" onExitComplete={() => setQueueAt(idx)}>
                <motion.div key={idx} ref={custRef}
                  initial={reduce ? { opacity: 0 } : wide && idx > 0 ? { x: 430, scale: 0.38, opacity: 1 } : { x: 320, opacity: 0 }}
                  animate={{ x: 0, scale: 1, opacity: 1 }}
                  style={{ transformOrigin: '50% 100%' }}
                  exit={reduce ? { opacity: 0 } : { x: -520, opacity: 0, rotate: [0, -6, 6, -6, 0], transition: { duration: 0.7, ease: 'easeIn' } }}
                  transition={{ type: 'spring', stiffness: 140, damping: 17 }}>
                  <Critter art={q.art} size={size} mood={mood} label={vip ? `${q.label}, König` : q.label}
                    accessory={vip ? <Crown size={size} /> : null}
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
                  <motion.div key={idx} ref={bagRef} initial={reduce ? { opacity: 0 } : { x: 320, opacity: 0 }}
                    animate={hat ? { x: hat.x, y: hat.y, scale: 0.5, rotate: -10, opacity: 1 }
                      : phase === 'tip' && !reduce ? { x: 0, y: 0, scale: 1, opacity: 1, rotate: [0, 18, -95, -95, 0] }
                      : { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { x: (hat?.x ?? 0) - 520, opacity: 0, transition: { duration: 0.7, ease: 'easeIn' } }}
                    transition={hat ? { type: 'spring', stiffness: 170, damping: 14 } : phase === 'tip' ? { duration: 2, times: [0, 0.12, 0.35, 0.8, 1] } : { type: 'spring', stiffness: 140, damping: 17 }}
                    style={{ position: 'relative', zIndex: hat ? 3 : undefined, transformOrigin: phase === 'tip' ? '15% 100%' : '50% 50%' }}>
                    <Basket q={q} basket={basket} onTake={putBack} glow={hover || ready} innerRef={basketRef}
                      counts={help || phase === 'look'} wiggle={phase === 'look'} width={wide ? 260 : 220} limit={wide ? 230 : 190} />
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
                  <Crate key={i} item={p.item} id={`${idx}-${i}-${taken[i] || 0}`} pi={i} innerRef={i === 0 ? crateRef : undefined} onPour={pour}
                    width={q.parts.length === 3 ? 128 : wide ? 150 : 140} />
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
                    <Jar n={served} giant={giant} />
                    {done}
                  </Counter>
                </>
              ) : (
                <>
                  {trail}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly' }}>
                    {customer}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Jar n={served} giant={giant} />
                      {bag}
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

// What the customer wants, as pictures: "4 🍋 2 🍓". For a rest order the
// bubble shows how many it wants in all; the ones from home are already in
// the basket.
function Order({ q }) {
  const num = n => <span style={{ fontSize: 30, lineHeight: 1 }}>{n}</span>
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      aria-label={q.home ? `${q.home} ${q.parts[0].item.name} zu Hause, ${q.home + q.parts[0].n} gewünscht` : q.parts.map(p => `${p.n} ${p.item.name}`).join(', ')}>
      {q.parts.map((p, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>{num(p.n + (q.home && i === 0 ? q.home : 0))}<Art art={p.item.emoji} size={38} /></span>
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

// The customer's basket: a wide wicker basket with one group per kind,
// laid out in rows of five (five and some more is seen at a glance), so
// everything in it lies flat and can be counted. Each group is a button
// that puts one of that kind back on its crate. Things from home sit first
// in their group with a little house and stay.
function Basket({ q, basket, onTake, glow, counts, wiggle, innerRef, width, limit }) {
  const total = Object.values(basket).reduce((a, b) => a + b, 0)
  const home = i => (q.home && i === 0 ? q.home : 0)
  // Small enough that even a full basket (every kind at its cap) stays
  // below the awning
  const rows = q.parts.reduce((a, p, i) => a + capOf(p, home(i)) / 5, 0)
  const item = Math.min(width >= 250 ? 30 : 26, Math.floor((limit - q.parts.length * 10) / rows))
  // a little squash each time something lands, without re-mounting
  const squash = useAnimationControls()
  const last = useRef(total)
  useEffect(() => {
    if (total > last.current) squash.start({ scaleY: [0.92, 1], scaleX: [1.04, 1], transition: { type: 'spring', stiffness: 600, damping: 14 } })
    last.current = total
  }, [total, squash])
  return (
    <div ref={innerRef} style={{ position: 'relative', width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={width * 0.62} height={46} viewBox="0 0 100 46" preserveAspectRatio="none" aria-hidden="true" style={{ marginBottom: -12, display: 'block' }}>
        <path d="M6 46 Q50 -16 94 46" fill="none" stroke="#2a1b3d" strokeWidth="11" />
        <path d="M6 46 Q50 -16 94 46" fill="none" stroke="#c98a52" strokeWidth="6" />
      </svg>
      <motion.div animate={squash}
        style={{
          width, boxSizing: 'border-box', padding: '8px 12px 20px', display: 'flex', flexDirection: 'column', gap: 4,
          borderRadius: '18px 18px 90px 90px / 18px 18px 56px 56px', border: '4px solid #2a1b3d', borderTop: '10px solid #8a4f22', transformOrigin: '50% 100%',
          background: 'repeating-linear-gradient(0deg, transparent 0 13px, rgba(90,50,20,0.35) 13px 15px), repeating-linear-gradient(90deg, #d99a5b 0 14px, #c27a3a 14px 28px)',
          boxShadow: `inset 0 6px 0 rgba(255,255,255,0.25), 0 6px 0 rgba(42,27,61,0.3)${glow ? ', 0 0 0 6px #ffc93c' : ''}`,
        }}>
        {q.parts.map((p, i) => {
          const have = basket[i] || 0, off = have !== p.n
          return (
            <motion.button key={i} type="button" onClick={e => { e.stopPropagation(); onTake(i) }} aria-label={`${p.item.name} zurücklegen`}
              animate={wiggle && off ? { x: [0, -5, 5, -5, 5, 0] } : { x: 0 }} transition={{ duration: 0.6, repeat: wiggle ? 2 : 0 }}
              style={{
                all: 'unset', cursor: 'pointer', position: 'relative', minHeight: 44, padding: '3px 44px 3px 6px', borderRadius: 12,
                display: 'grid', gridTemplateColumns: `repeat(5, ${item}px)`, gridAutoRows: item, alignContent: 'center', justifyContent: 'center',
                background: 'rgba(255,253,247,0.4)',
              }}>
              {Array.from({ length: home(i) }, (_, j) => (
                <span key={`h${j}`} style={{ position: 'relative', display: 'inline-flex', opacity: 0.9 }}>
                  <Art art={p.item.emoji} size={item} />
                  <span style={{ position: 'absolute', left: -4, top: -6 }}><Art art="🏠" size={16} /></span>
                </span>
              ))}
              <AnimatePresence>
                {Array.from({ length: have }, (_, j) => (
                  <motion.span key={j} initial={{ y: -40, scale: 0.4 }} animate={{ y: 0, scale: 1 }} exit={{ y: -30, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 520, damping: 20 }} style={{ display: 'inline-flex' }}>
                    <Art art={p.item.emoji} size={item} />
                  </motion.span>
                ))}
              </AnimatePresence>
              {counts && (
                <motion.span key={have} initial={{ scale: 0.5 }} animate={{ scale: 1 }} style={{ ...badge, right: 2 }}>{have + home(i)}</motion.span>
              )}
            </motion.button>
          )
        })}
      </motion.div>
    </div>
  )
}

// A crate full of one kind; the one on top can be dragged (or tapped) into
// the basket, and another rolls up in its place.
// Holding it pours: after a short hold one fruit after another goes in,
// until the finger lets go. A quick tap still puts in one.
function Crate({ item, id, pi, width, innerRef, onPour }) {
  const hold = useRef(null)
  const stop = () => { clearTimeout(hold.current?.t); clearInterval(hold.current?.iv); hold.current = null }
  useEffect(() => stop, [])
  const start = e => {
    stop()
    const h = { poured: false, x: e.clientX, y: e.clientY }
    h.t = setTimeout(() => {
      const go = () => { if (onPour(pi) === false) stop(); else h.poured = true }
      go()
      h.iv = setInterval(go, 350)
    }, 420)
    hold.current = h
    window.addEventListener('pointerup', stop, { once: true })
    window.addEventListener('pointercancel', stop, { once: true })
  }
  return (
    <div style={{ position: 'relative', width, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ display: 'flex', marginBottom: -26, zIndex: 1, alignItems: 'flex-end' }}>
        <Art art={item.emoji} size={width * 0.34} style={{ transform: 'rotate(-14deg)', marginRight: -width * 0.12 }} />
        <div ref={innerRef} style={{ zIndex: 2 }} onPointerDownCapture={start}
          onPointerMoveCapture={e => {
            const h = hold.current
            if (h?.poured) e.stopPropagation()
            // a finger that moves is dragging, not pouring
            else if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 8) stop()
          }}
          onPointerUpCapture={e => { if (hold.current?.poured) e.stopPropagation(); stop() }}>
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

// Lumi's money jar: each customer's coins drop in with a clink and pile up
// inside, so the level's work can be seen filling it.
function Jar({ n, giant }) {
  const reduce = useReducedMotion()
  const shown = Math.min(n, 24)
  // a little squash for each coin, without dropping the old ones again
  const squash = useAnimationControls()
  useEffect(() => {
    if ((n || giant) && !reduce) squash.start({ scaleY: [giant ? 0.85 : 0.94, 1], transition: { type: 'spring', stiffness: 500, damping: 12 } })
  }, [n, giant, reduce, squash])
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 78, height: 96, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 50, height: 12, borderRadius: 4, background: '#e8663a', border: '3px solid #2a1b3d', zIndex: 2 }} />
      <motion.div animate={squash}
        style={{
          position: 'relative', width: 70, height: 76, marginTop: -3, borderRadius: '14px 14px 20px 20px', border: '3px solid #2a1b3d', overflow: 'hidden',
          background: 'linear-gradient(90deg, rgba(255,255,255,0.75) 0 18%, rgba(220,240,255,0.55) 18%)', transformOrigin: '50% 100%',
        }}>
        {Array.from({ length: Math.min(giant, 2) }, (_, i) => (
          <motion.div key={`g${i}`} initial={reduce ? false : { y: -110, rotate: -40 }} animate={{ y: 0, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 11 }}
            style={{ position: 'absolute', left: 8 + i * 10, bottom: 2 + i * 6 }}>
            <Art art="🪙" size={50} />
          </motion.div>
        ))}
        {Array.from({ length: shown }, (_, i) => (
          <motion.div key={i} initial={reduce ? false : { y: -80 }} animate={{ y: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            style={{ position: 'absolute', left: 4 + (i % 3) * 19 + (Math.floor(i / 3) % 2) * 6, bottom: 2 + Math.floor(i / 3) * 8 + (giant ? 22 : 0) }}>
            <Art art="🪙" size={24} />
          </motion.div>
        ))}
      </motion.div>
    </div>
  )
}

// The king's crown, worn on the customer and moving with it
function Crown({ size }) {
  return (
    <span aria-hidden="true" style={{ position: 'absolute', top: -size * 0.1, left: '50%', transform: 'translateX(-50%) rotate(-10deg)', pointerEvents: 'none' }}>
      <Art art="👑" size={size * 0.34} />
    </span>
  )
}

// The next customers, waiting their turn; each keeps its place in the line
// as it moves up.
function Queue({ list }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 4, alignSelf: 'flex-end', minWidth: 150 }}>
      <AnimatePresence initial={false}>
        {list.map((c, i) => (
          <motion.div key={c.key} layout initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0 } }}>
            <Critter art={c.art} size={i === 0 ? 76 : 62} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
