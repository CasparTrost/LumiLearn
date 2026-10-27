import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'
import { narrate, lockPreviews, afterNarration } from '../narrator.js'
import { sayNumber, sayCount } from '../tts.js'
import { sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { hearable } from '../lib/hearable.js'
import { pxCard, pxPanel, pxBubble, pxButton, INK } from './px.js'

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function shuffle(arr)  { return [...arr].sort(() => Math.random() - 0.5) }

const SHOP_ITEMS = [
  { emoji: '🍎', name: 'Äpfel',       singular: 'Apfel',         g: 'm', color: '#FF6B5B' },
  { emoji: '🍊', name: 'Orangen',     singular: 'Orange',        g: 'f', color: '#FF9F43' },
  { emoji: '🍋', name: 'Zitronen',    singular: 'Zitrone',       g: 'f', color: '#FFC93C' },
  { emoji: '🍇', name: 'Weintrauben', singular: 'Weintraube',    g: 'f', color: '#8E6CF0' },
  { emoji: '🍓', name: 'Erdbeeren',   singular: 'Erdbeere',      g: 'f', color: '#FF6B9A' },
  { emoji: '🍩', name: 'Donuts',      singular: 'Donut',         g: 'm', color: '#E8663A' },
  { emoji: '🧁', name: 'Muffins',     singular: 'Muffin',        g: 'm', color: '#FD79A8' },
  { emoji: '🥕', name: 'Karotten',    singular: 'Karotte',       g: 'f', color: '#FF9F43' },
  { emoji: '🌽', name: 'Maiskolben',  singular: 'Maiskolben',    g: 'm', color: '#FFC93C' },
  { emoji: '🍕', name: 'Pizzastücke', singular: 'Pizzastück',    g: 'n', color: '#FF6B5B' },
  { emoji: '🐟', name: 'Fische',      singular: 'Fisch',         g: 'm', color: '#4AA3FF' },
  { emoji: '🌸', name: 'Blumen',      singular: 'Blume',         g: 'f', color: '#FD79A8' },
  { emoji: '🍌', name: 'Bananen',     singular: 'Banane',        g: 'f', color: '#FFC93C' },
  { emoji: '🎈', name: 'Ballons',     singular: 'Ballon',        g: 'm', color: '#FF6B5B' },
  { emoji: '🍦', name: 'Eistüten',    singular: 'Eistüte',       g: 'f', color: '#4AA3FF' },
]

const CUSTOMERS = ['👦', '👧', '🧒', '👴', '👵', '🧑', '👩', '👨']
const GREETINGS = ['Ich möchte bitte', 'Gib mir bitte', 'Ich brauche', 'Ich hätte gerne']
const THANKS    = ['Danke!', 'Super!', 'Toll!', 'Perfekt!', 'Danke schön!']

const noun = (n, item) => (n === 1 ? item.singular : item.name)
// Every greeting takes an object, so one masculine thing is "einen Apfel" —
// sayCount gives the nominative "ein", which is right after "Das ist" only.
const countAcc = (n, item) => n === 1
  ? `${item.g === 'm' ? 'einen' : item.g === 'f' ? 'eine' : 'ein'} ${item.singular}`
  : `${sayNumber(n)} ${item.name}`
// "vier Muffins, drei Zitronen und fünf Weintrauben" — said as it is written.
const listing = words => words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} und ${words[words.length - 1]}`

function buildQuestions(level, count = level <= 4 ? 8 : level <= 7 ? 10 : 12) {
  // L1-2: 1 item | L3-6: 2 items | L7-10: 3 items
  const numParts = level <= 2 ? 1 : level <= 6 ? 2 : 3
  // max quantity per item scales with level
  const maxN = [0, 4, 6, 5, 7, 8, 10, 7, 9, 10, 12][level] ?? 10
  const custs    = shuffle(CUSTOMERS)
  return Array.from({ length: count }, (_, qi) => {
    const items = shuffle(SHOP_ITEMS)
    const base = {
      customer: custs[qi % custs.length],
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

function Confetti({ color }) {
  const bits = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      angle: (i / 22) * 360 + rnd(-8, 8),
      dist:  rnd(80, 170),
      size:  rnd(7, 15),
      c:     [color, '#FFC93C', '#5CC45A', '#4AA3FF', '#FD79A8', '#FF9F43'][i % 6],
    })), [color])
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40, overflow: 'visible' }}>
      {bits.map((b, i) => (
        <motion.div key={i}
          initial={{ x: '50%', y: '40%', scale: 0, opacity: 1, rotate: 0 }}
          animate={{
            x: `calc(50% + ${Math.cos(b.angle * Math.PI / 180) * b.dist}px)`,
            y: `calc(40% + ${Math.sin(b.angle * Math.PI / 180) * b.dist}px)`,
            scale: [0, 1.5, 0.7], opacity: [1, 1, 0], rotate: b.angle * 2,
          }}
          transition={{ duration: 0.9, ease: 'easeOut', delay: i * 0.015 }}
          style={{
            position: 'absolute', width: b.size, height: b.size,
            borderRadius: i % 3 === 0 ? '50%' : 3,
            background: b.c,
            marginLeft: -b.size / 2, marginTop: -b.size / 2,
          }}
        />
      ))}
    </div>
  )
}

function FlyingItem({ emoji, startX, startY, dx, dy, onDone }) {
  return (
    <motion.span
      initial={{ x: 0, y: 0, scale: 1, opacity: 1, rotate: 0 }}
      animate={{
        x: [0, dx * 0.25, dx], y: [0, Math.min(-90, dy - 60), dy],
        scale: [1, 1.15, 0.55], opacity: [1, 1, 0], rotate: [0, -8, 15],
      }}
      transition={{ duration: 0.52, ease: [0.25, 0.46, 0.45, 0.94] }}
      onAnimationComplete={onDone}
      style={{
        position: 'absolute', left: startX, top: startY,
        marginLeft: '-0.5em', marginTop: '-0.5em',
        fontSize: 'clamp(38px,8vw,58px)', lineHeight: 1,
        pointerEvents: 'none', zIndex: 50,
      }}
    >{emoji}</motion.span>
  )
}

function ReturnItem({ emoji, cartX, cartY, dx, dy, onDone }) {
  return (
    <motion.span
      initial={{ x: 0, y: 0, scale: 0.55, opacity: 0.9, rotate: 15 }}
      animate={{
        x: [0, -dx * 0.25, -dx], y: [0, Math.min(-90, -dy - 60), -dy],
        scale: [0.55, 1.15, 1], opacity: [0.9, 1, 0], rotate: [15, -8, 0],
      }}
      transition={{ duration: 0.52, ease: [0.25, 0.46, 0.45, 0.94] }}
      onAnimationComplete={onDone}
      style={{
        position: 'absolute', left: cartX, top: cartY,
        marginLeft: '-0.5em', marginTop: '-0.5em',
        fontSize: 'clamp(38px,8vw,58px)', lineHeight: 1,
        pointerEvents: 'none', zIndex: 50,
      }}
    >{emoji}</motion.span>
  )
}

// Small round number on a shelf item or the cart (only shown as a help).
const badge = (size) => ({
  position: 'absolute', top: -4, right: -4,
  background: '#FFFDF7', color: INK, borderRadius: '50%',
  width: size, height: size,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--font-heading)', fontWeight: 800,
  border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}`,
  pointerEvents: 'none',
})

export default function NumbersGame({ level = 1, onComplete }) {
  const questions = useMemo(() => buildQuestions(level), [level])

  const [idx,        setIdx]       = useState(0)
  const [bagged,     setBagged]    = useState({})   // { [partIdx]: count }
  const [flying,     setFlying]    = useState([])   // [{ id, partIdx, emoji, startX, startY, dx, dy }]
  const [returning,  setReturning] = useState([])   // [{ id, emoji, cartX, cartY, dx, dy }]
  const [phase,      setPhase]     = useState('shopping')
  const [bubble,     setBubble]    = useState('')
  const [cartBounce, setCartBounce] = useState(0)
  const [firstTry,   setFirstTry]  = useState(0)
  const [showWeiter, setShowWeiter] = useState(false)
  const [wrongCount,  setWrongCount]  = useState(0)  // wrong attempts on the current customer
  const [narrow,      setNarrow]      = useState(false)
  const cartControls = useAnimation()

  useEffect(() => {
    if (cartBounce > 0) {
      cartControls.start({ scale: [1, 1.35, 0.9, 1.12, 1], y: [0, -14, 4, -6, 0], transition: { duration: 0.45, ease: 'easeOut' } })
    }
  }, [cartBounce, cartControls])

  const rootRef   = useRef(null)
  const cardRef   = useRef(null)
  const cartRef   = useRef(null)
  const timerRef  = useRef(null)
  const shelfRefs = useRef([])

  // This game is not scaled (the flying items need real coordinates), so it
  // lays itself out: below ~560 px the cart goes under the shelf instead of
  // beside it, where three products and the cart ran past the screen edge.
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setNarrow(el.clientWidth < 560))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const q = questions[idx]
  const totalBagged    = Object.values(bagged).reduce((a, b) => a + b, 0)
  const totalCollected = totalBagged + flying.length
  const hasBagged      = totalBagged > 0
  // The numbers on the shelf and the cart did the counting for the child.
  // They come back as a help once an order went wrong.
  const showCounts     = wrongCount >= 1

  // Reading the order out once and never again is hard on a child holding
  // "vier Orangen und zwei Weintrauben" in mind while hunting the shelves.
  const speakOrder = useCallback(() => {
    const q2 = questions[idx]
    if (q2) narrate([{ text: orderSpeech(q2), rate: 0.8, pitch: 1.0 }])
  }, [questions, idx])

  useEffect(() => {
    setBagged({})
    setFlying([])
    setReturning([])
    setPhase('shopping')
    setBubble('')
    setShowWeiter(false)
    setWrongCount(0)
    clearTimeout(timerRef.current)
    lockPreviews()
    const t = setTimeout(speakOrder, 600)
    return () => clearTimeout(t)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timerRef.current), [])

  const weiterClick = useCallback(() => {
    setShowWeiter(false)
    const next = idx + 1
    if (next >= questions.length) onComplete(result(firstTry, questions.length))
    else setIdx(next)
  }, [idx, firstTry, questions.length, onComplete])

  const onItemLand = useCallback((id, partIdx) => {
    setFlying(f => f.filter(x => x.id !== id))
    setBagged(b => ({ ...b, [partIdx]: (b[partIdx] || 0) + 1 }))
    setCartBounce(c => c + 1)
  }, [])

  const addItem = useCallback((partIdx) => {
    if (phase !== 'shopping') return
    const part    = q.parts[partIdx]
    const shelfEl = shelfRefs.current[partIdx]
    let startX = 120, startY = 100, dx = 150, dy = 50
    if (cardRef.current && shelfEl && cartRef.current) {
      const cr = cardRef.current.getBoundingClientRect()
      const sr = shelfEl.getBoundingClientRect()
      const tr = cartRef.current.getBoundingClientRect()
      startX = sr.left - cr.left + sr.width  / 2
      startY = sr.top  - cr.top  + sr.height / 2
      dx     = (tr.left - cr.left + tr.width  / 2) - startX
      dy     = (tr.top  - cr.top  + tr.height / 2) - startY
    }
    const id = Date.now() + Math.random()
    setFlying(f => [...f, { id, partIdx, emoji: part.item.emoji, startX, startY, dx, dy }])
  }, [phase, q])

  // Tapping a thing in the cart puts one of exactly that kind back. The old
  // "Zurücklegen" button always took from the last kind, so too many apples
  // could only be fixed by also removing correctly counted lemons.
  const removeItem = useCallback((pi) => {
    if (!(bagged[pi] > 0) || phase !== 'shopping') return
    const part    = q.parts[pi]
    const shelfEl = shelfRefs.current[pi]
    setBagged(b => ({ ...b, [pi]: b[pi] - 1 }))
    let cartX = 160, cartY = 120, dx = 150, dy = 50
    if (cardRef.current && shelfEl && cartRef.current) {
      const cr = cardRef.current.getBoundingClientRect()
      const sr = shelfEl.getBoundingClientRect()
      const tr = cartRef.current.getBoundingClientRect()
      cartX = tr.left - cr.left + tr.width  / 2
      cartY = tr.top  - cr.top  + tr.height / 2
      dx    = cartX - (sr.left - cr.left + sr.width  / 2)
      dy    = cartY - (sr.top  - cr.top  + sr.height / 2)
    }
    const id = Date.now() + Math.random()
    setReturning(r => [...r, { id, emoji: part.item.emoji, cartX, cartY, dx, dy }])
  }, [phase, bagged, q])

  const onItemReturn = useCallback((id) => {
    setReturning(r => r.filter(x => x.id !== id))
  }, [])

  const confirm = useCallback(() => {
    if (phase !== 'shopping' || flying.length > 0 || !hasBagged) return
    const allCorrect = q.parts.every((p, i) => (bagged[i] || 0) === p.n)
    if (allCorrect) {
      setBubble(q.thanks)
      setPhase('correct')
      if (wrongCount === 0) setFirstTry(s => s + 1)
      // The customer thanks and names what was counted — quantity and number
      // word once more side by side.
      const got = q.home
        ? `Jetzt habe ich ${countAcc(q.home + q.parts[0].n, q.parts[0].item)}.`
        : `Das sind genau ${listing(q.parts.map(p => sayCount(p.n, noun(p.n, p.item), p.item.g)))}.`
      narrate([{ text: `${q.thanks} ${got}`, pitch: 1.1 }])
      timerRef.current = setTimeout(() => setShowWeiter(true), 900)
    } else {
      // Name every kind that is off, not just the first one: with two wrong
      // kinds the child used to hear about one and fail again on the other.
      const off = q.parts
        .map((p, i) => ({ p, have: bagged[i] || 0 }))
        .filter(({ p, have }) => have !== p.n)
      setBubble(off.map(({ p, have }) => `${have > p.n ? 'Zu viele' : 'Zu wenige'} ${p.item.emoji}`).join(' · '))
      setPhase('wrong')
      setWrongCount(c => c + 1)
      const hint = q.home
        ? (() => {
            const { item, n } = q.parts[0], total = q.home + n
            return `${off[0].have > n ? 'Das sind zu viele.' : 'Das sind zu wenige.'} Zu Hause sind schon ${sayNumber(q.home)}. Bis ${sayNumber(total)} fehlen noch ${countAcc(n, item)}.`
          })()
        : off.map(({ p, have }) =>
            have > p.n ? `Ich möchte nur ${countAcc(p.n, p.item)}.`
            : have === 0 ? `Ich möchte auch ${countAcc(p.n, p.item)}.`
            : `Ich möchte ${countAcc(p.n, p.item)}, das sind noch zu wenige.`).join(' ')
      sayWrong(hint)
      // Only the wrong baskets go back on the shelf. Emptying the whole cart
      // made the child re-collect items that were already counted correctly.
      // That waits for the sentence; a fixed delay cut it off.
      afterNarration(() => {
        setBagged(b => {
          const keep = {}
          q.parts.forEach((p, i) => { if ((b[i] || 0) === p.n) keep[i] = b[i] })
          return keep
        })
        setFlying([])
        setReturning([])
        setPhase('shopping')
        setBubble('')
      }, { minMs: 1700 })
    }
  }, [phase, flying.length, hasBagged, bagged, q, wrongCount])

  if (!q) return null
  const { parts, customer, greeting, home } = q
  const accentColor = parts[0].item.color
  // The lower bounds let two or three products plus the cart fit a 360px
  // phone.
  const productSize = parts.length === 1
    ? 'clamp(80px,20vw,150px)'
    : parts.length === 2
      ? 'clamp(54px,14vw,110px)'
      : 'clamp(44px,11vw,86px)'
  const ordered = (p) => (
    // Ink on parchment with the colour as an underline: yellow words on
    // parchment were unreadable (1.35:1).
    <strong style={{ color: INK, borderBottom: `4px solid ${p.item.color}`, whiteSpace: 'nowrap' }}>
      {p.n} {noun(p.n, p.item)} {p.item.emoji}
    </strong>
  )

  const shelf = (
    <div style={{ display: 'flex', gap: narrow ? 14 : 20, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      {parts.map((p, i) => {
        const count = (bagged[i] || 0) + flying.filter(f => f.partIdx === i).length
        return (
          <div key={i} style={{ position: 'relative', width: `calc(${productSize} + 16px)`, height: `calc(${productSize} + 16px)`, flexShrink: 0 }}>
            <motion.button
              ref={el => { shelfRefs.current[i] = el }}
              whileHover={phase === 'shopping' ? { scale: 1.15, y: -6 } : {}}
              whileTap={phase === 'shopping' ? { scale: 0.8 } : {}}
              onClick={() => addItem(i)}
              disabled={phase !== 'shopping'}
              aria-label={`${p.item.singular} in den Wagen legen`}
              {...hearable(p.item.name)}
              style={{
                ...pxCard(), padding: 0,
                width: '100%', height: '100%',
                fontSize: `calc(${productSize} * 0.82)`, lineHeight: 1,
                cursor: phase === 'shopping' ? 'pointer' : 'default',
                userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: phase === 'shopping' ? 'none' : 'grayscale(0.5) opacity(0.6)',
                WebkitTapHighlightColor: 'transparent',
                transition: 'filter 0.2s',
              }}
            >
              {p.item.emoji}
            </motion.button>
            {showCounts && count > 0 && (
              <motion.div key={count} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}
                style={{ ...badge('clamp(28px,5.5vw,38px)'), fontSize: 'clamp(15px,2.8vw,20px)' }}>
                {count}
              </motion.div>
            )}
          </div>
        )
      })}
    </div>
  )

  const cart = (
    <div style={{ display: 'flex', flexDirection: narrow ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: narrow ? 'nowrap' : 'wrap', minWidth: 0 }}>
      <div ref={cartRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <motion.span
          animate={cartControls}
          style={{ fontSize: narrow ? 64 : 'clamp(84px,14vw,140px)', lineHeight: 1, userSelect: 'none', display: 'block' }}
        >
          🛒
        </motion.span>
        {showCounts && totalCollected > 0 && (
          <motion.div key={totalCollected} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500 }}
            style={{ ...badge(narrow ? 34 : 'clamp(36px,6vw,48px)'), top: -8, right: -10, fontSize: narrow ? 17 : 'clamp(17px,3vw,22px)' }}>
            {totalCollected}
          </motion.div>
        )}
      </div>
      {/* What is in the cart, one group per kind — tap to put one back */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: narrow ? 1 : undefined, alignItems: narrow ? 'flex-start' : 'center' }}>
        {parts.map((p, i) => {
          const count = bagged[i] || 0
          if (count === 0) return null
          return (
            <motion.button
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => removeItem(i)}
              disabled={phase !== 'shopping'}
              aria-label={`${p.item.singular} zurücklegen`}
              style={{
                display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', alignItems: 'center',
                maxWidth: narrow ? '100%' : 230, minHeight: 44, padding: '2px 6px',
                background: 'rgba(255,253,247,0.7)', border: `2px dashed ${INK}`, borderRadius: 10,
                cursor: phase === 'shopping' ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <AnimatePresence>
                {Array.from({ length: count }).map((_, j) => (
                  <motion.span key={`${i}-${j}`}
                    initial={{ scale: 0, y: -10 }} animate={{ scale: 1, y: 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                    style={{ fontSize: narrow ? 24 : 'clamp(24px,4vw,32px)', lineHeight: 1 }}
                  >
                    {p.item.emoji}
                  </motion.span>
                ))}
              </AnimatePresence>
            </motion.button>
          )
        })}
      </div>
    </div>
  )

  return (
    <div ref={rootRef} style={{
      flex: 1, minHeight: 0, width: '100%', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: narrow ? 10 : 'clamp(12px,2.4vh,24px)',
      padding: narrow ? 10 : 'clamp(14px,2.4vh,28px) clamp(14px,3vw,28px)',
    }}>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 700, height: 14, flexShrink: 0, background: 'rgba(42,27,61,0.12)', border: `2px solid ${INK}`, borderRadius: 4, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${(idx / questions.length) * 100}%` }}
          style={{ height: '100%', background: accentColor, borderRadius: 2 }}
          transition={{ duration: 0.4 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx}
          ref={cardRef}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.3 }}
          style={{
            width: '100%', maxWidth: 700, flexShrink: 0,
            ...pxPanel,
            padding: narrow ? 12 : 'clamp(18px,3vw,36px)',
            position: 'relative', overflow: 'visible',
            display: 'flex', flexDirection: 'column', gap: narrow ? 14 : 'clamp(16px,3vh,28px)',
          }}
        >
          {phase === 'correct' && <Confetti color={accentColor} />}

          {/* Flying items */}
          {flying.map(f => (
            <FlyingItem key={f.id} emoji={f.emoji}
              startX={f.startX} startY={f.startY} dx={f.dx} dy={f.dy}
              onDone={() => onItemLand(f.id, f.partIdx)} />
          ))}
          {/* Returning items */}
          {returning.map(r => (
            <ReturnItem key={r.id} emoji={r.emoji}
              cartX={r.cartX} cartY={r.cartY} dx={r.dx} dy={r.dy}
              onDone={() => onItemReturn(r.id)} />
          ))}

          {/* TOP: Customer + speech bubble */}
          <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 8 : 16 }}>
            <motion.span
              animate={phase === 'correct' ? { rotate: [0, -20, 20, -12, 12, 0], scale: [1, 1.25, 1.25, 1] }
                     : phase === 'wrong'   ? { x: [0, -10, 10, -6, 6, 0] } : {}}
              transition={{ duration: 0.6 }}
              style={{ fontSize: narrow ? 48 : 'clamp(64px,10vw,86px)', lineHeight: 1, flexShrink: 0, userSelect: 'none' }}
            >
              {customer}
            </motion.span>

            <AnimatePresence mode="wait">
              {bubble ? (
                <motion.div key="bubble"
                  initial={{ opacity: 0, x: -8, scale: 0.88 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -8, scale: 0.88 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  style={{
                    ...pxCard(phase === 'correct' ? 'right' : 'wrong'),
                    padding: narrow ? '10px 12px' : 'clamp(12px,2.5vw,20px) clamp(16px,3.5vw,28px)',
                    fontFamily: 'var(--font-heading)', fontSize: narrow ? 20 : 'clamp(20px,3.4vw,28px)',
                    color: phase === 'correct' ? '#2d7a3a' : '#A93226',
                    fontWeight: 700, flex: 1,
                  }}
                >
                  {bubble}
                </motion.div>
              ) : (
                <motion.div key="order"
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.3 }}
                  style={{
                    ...pxBubble,
                    padding: narrow ? '8px 12px' : 'clamp(12px,2.5vw,20px) clamp(16px,3.5vw,28px)',
                    fontFamily: 'var(--font-heading)', fontSize: narrow ? 17 : 'clamp(18px,3vw,25px)',
                    color: 'var(--text-primary)', flex: 1, lineHeight: 1.55, minWidth: 0,
                  }}
                >
                  {home ? (
                    <>
                      🏠 {Array.from({ length: home }, (_, k) => <span key={k}>{parts[0].item.emoji}</span>)}
                      {' '}Ich brauche{' '}
                      <strong style={{ color: INK, borderBottom: `4px solid ${parts[0].item.color}`, whiteSpace: 'nowrap' }}>
                        {home + parts[0].n} {noun(home + parts[0].n, parts[0].item)}
                      </strong>. Gib mir den Rest!
                    </>
                  ) : (
                    <>
                      {greeting}{' '}
                      {parts.map((p, i) => (
                        <span key={i}>
                          {i > 0 && (i === parts.length - 1 ? ' und ' : ', ')}
                          {ordered(p)}
                        </span>
                      ))}
                      !
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Hear the order again — it was spoken once on entry with no
                way back to it. */}
            <motion.button
              whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={speakOrder}
              aria-label="Bestellung noch einmal anhören"
              style={{ ...pxButton('gold'), width: 48, height: 48, padding: 0, flexShrink: 0, fontSize: 24, lineHeight: 1 }}
            >🔊</motion.button>
          </div>

          {/* MIDDLE: Shelf → Cart (side by side, or stacked on a phone) */}
          <div style={{ display: 'flex', flexDirection: narrow ? 'column' : 'row', alignItems: 'center', justifyContent: 'space-around', gap: narrow ? 10 : 12 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {shelf}
              {/* Quantity hint — after a wrong order: how many of each kind
                  (and, for the rest orders, how many are already at home). */}
              {wrongCount >= 1 && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}
                >
                  {parts.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'center',
                      background: '#FFFDF7', border: `3px dashed ${p.item.color}`,
                      borderRadius: 10, padding: '4px 10px',
                      fontFamily: 'var(--font-heading)', fontSize: narrow ? 15 : 'clamp(15px,2.4vw,18px)',
                      color: INK, fontWeight: 700,
                    }}>
                      <span>💡</span>
                      {home && <span>🏠 {home} +</span>}
                      <span>{Array.from({ length: p.n }, (_, k) => <span key={k}>{p.item.emoji}</span>)}</span>
                      <span>= {p.n}</span>
                    </div>
                  ))}
                </motion.div>
              )}
            </div>

            {/* Arrow */}
            <motion.div
              animate={narrow ? { y: [0, 6, 0] } : { x: [0, 8, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: narrow ? 28 : 'clamp(36px,6vw,52px)', color: INK, userSelect: 'none', flexShrink: 0, alignSelf: 'center', lineHeight: 1 }}
            >
              {narrow ? '↓' : '→'}
            </motion.div>

            {cart}
          </div>

          {/* Fertig, or on to the next customer */}
          <div style={{ display: 'flex', justifyContent: 'center', minHeight: 56 }}>
            {phase === 'shopping' && hasBagged && (
              <motion.button
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: flying.length > 0 ? 0.5 : 1, y: 0 }}
                whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.92 }}
                onClick={confirm}
                disabled={flying.length > 0}
                {...hearable('Fertig')}
                style={{
                  ...pxButton('green'), color: INK, textShadow: 'none',
                  padding: '10px clamp(28px,5.5vw,48px)', minHeight: 52,
                  fontSize: 'clamp(20px,3.4vw,26px)', fontWeight: 800,
                }}
              >
                ✅ Fertig
              </motion.button>
            )}
            {showWeiter && (
              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                onClick={weiterClick}
                {...hearable(idx + 1 >= questions.length ? 'Fertig' : 'Nächster Kunde')}
                style={{
                  ...pxButton('green'), color: INK, textShadow: 'none',
                  padding: '10px 36px', minHeight: 52, fontSize: 'clamp(18px,3vw,22px)',
                }}
              >
                {idx + 1 >= questions.length ? '🏁 Fertig!' : 'Nächster Kunde →'}
              </motion.button>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
