import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useAnimation } from 'framer-motion'

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function shuffle(arr)  { return [...arr].sort(() => Math.random() - 0.5) }

const SHOP_ITEMS = [
  { emoji: '🍎', name: 'Äpfel',       singular: 'Apfel',       color: '#FF6B6B' },
  { emoji: '🍊', name: 'Orangen',     singular: 'Orange',      color: '#FF9F43' },
  { emoji: '🍋', name: 'Zitronen',    singular: 'Zitrone',     color: '#FFD93D' },
  { emoji: '🍇', name: 'Trauben',     singular: 'Traube',      color: '#A29BFE' },
  { emoji: '🍓', name: 'Erdbeeren',   singular: 'Erdbeere',    color: '#FF6B9A' },
  { emoji: '🍩', name: 'Donuts',      singular: 'Donut',       color: '#FF9F43' },
  { emoji: '🧁', name: 'Muffins',     singular: 'Muffin',      color: '#FD79A8' },
  { emoji: '🥕', name: 'Karotten',    singular: 'Karotte',     color: '#FF9F43' },
  { emoji: '🌽', name: 'Maiskolben',  singular: 'Maiskolben',  color: '#FFD93D' },
  { emoji: '🍕', name: 'Pizzastücke', singular: 'Pizzastück',  color: '#FF6B6B' },
  { emoji: '🐟', name: 'Fische',      singular: 'Fisch',       color: '#74B9FF' },
  { emoji: '🌸', name: 'Blumen',      singular: 'Blume',       color: '#FD79A8' },
  { emoji: '🍌', name: 'Bananen',     singular: 'Banane',      color: '#FFD93D' },
  { emoji: '🎈', name: 'Ballons',     singular: 'Ballon',      color: '#FF6B6B' },
  { emoji: '🍦', name: 'Eiswaffeln',  singular: 'Eiswaffel',   color: '#74B9FF' },
]

const CUSTOMERS = ['👦', '👧', '🧒', '👴', '👵', '🧑', '👩', '👨']
const GREETINGS = ['Ich möchte bitte', 'Gib mir bitte', 'Ich brauche', 'Ich hätte gerne']
const THANKS    = ['Danke! 🎉', 'Super! 🌟', 'Toll! ✨', 'Perfekt! 💛', 'Danke schön! 🎊']
const WRONG     = ['Das stimmt leider nicht! 🤔', 'Da ist was falsch! 😅', 'Versuch es nochmal! 🙃']

function buildQuestions(level, count = level <= 4 ? 8 : level <= 7 ? 10 : 12) {
  // L1-2: 1 item | L3-6: 2 items | L7-10: 3 items
  const numParts = level <= 2 ? 1 : level <= 6 ? 2 : 3
  // max quantity per item scales with level
  const maxN = [0, 4, 6, 5, 7, 8, 10, 7, 9, 10, 12][level] ?? 10
  const custs    = shuffle(CUSTOMERS)
  return Array.from({ length: count }, (_, qi) => {
    const items = shuffle(SHOP_ITEMS)
    return {
      parts:    Array.from({ length: numParts }, (_, pi) => ({ item: items[pi], n: rnd(1, maxN) })),
      customer: custs[qi % custs.length],
      greeting: GREETINGS[rnd(0, GREETINGS.length - 1)],
      thanks:   THANKS[rnd(0, THANKS.length - 1)],
    }
  })
}

function Confetti({ color }) {
  const bits = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      angle: (i / 22) * 360 + rnd(-8, 8),
      dist:  rnd(80, 170),
      size:  rnd(7, 15),
      c:     [color, '#FFD93D', '#6BCB77', '#74B9FF', '#FD79A8', '#FF9F43'][i % 6],
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

export default function NumbersGame({ level = 1, onComplete }) {
  const questions = useMemo(() => buildQuestions(level), [level])

  const [idx,        setIdx]       = useState(0)
  const [bagged,     setBagged]    = useState({})   // { [partIdx]: count }
  const [flying,     setFlying]    = useState([])   // [{ id, partIdx, emoji, startX, startY, dx, dy }]
  const [returning,  setReturning] = useState([])   // [{ id, emoji, cartX, cartY, dx, dy }]
  const [phase,      setPhase]     = useState('shopping')
  const [bubble,     setBubble]    = useState('')
  const [cartBounce, setCartBounce] = useState(0)
  const [score,      setScore]     = useState(0)
  const [sold,       setSold]       = useState([]) // receipt
  const cartControls = useAnimation()

  useEffect(() => {
    if (cartBounce > 0) {
      cartControls.start({ scale: [1, 1.35, 0.9, 1.12, 1], y: [0, -14, 4, -6, 0], transition: { duration: 0.45, ease: 'easeOut' } })
    }
  }, [cartBounce, cartControls])

  const cardRef   = useRef(null)
  const cartRef   = useRef(null)
  const timerRef  = useRef(null)
  const shelfRefs = useRef([])

  const q = questions[idx]
  const totalBagged    = Object.values(bagged).reduce((a, b) => a + b, 0)
  const totalCollected = totalBagged + flying.length
  const hasBagged      = totalBagged > 0

  useEffect(() => {
    setBagged({})
    setFlying([])
    setReturning([])
    setPhase('shopping')
    setBubble('')
    clearTimeout(timerRef.current)
    // TTS: read the customer request
    const q2 = questions[idx]
    if (q2) {
      const txt = q2.parts.map(p => `${p.n} ${p.n === 1 ? p.item.singular : p.item.name}`).join(' und ')
      setTimeout(() => {
        if (!window.speechSynthesis) return
        window.speechSynthesis.cancel()
        const u = new SpeechSynthesisUtterance(`${q2.greeting} ${txt}.`)
        u.lang = 'de-DE'; u.rate = 0.8; u.pitch = 1.0
        window.speechSynthesis.speak(u)
      }, 600)
    }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const advance = useCallback(() => {
    const next = idx + 1
    if (next >= questions.length) {
      onComplete({ score: score + 1, total: questions.length })
    } else {
      setIdx(next)
    }
  }, [idx, score, questions.length, onComplete])

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

  const removeItem = useCallback((partIdx) => {
    // if called with a specific partIdx use it, otherwise find last non-empty part
    const targetIdx = partIdx !== undefined
      ? partIdx
      : [...Object.keys(bagged)].reverse().find(k => bagged[k] > 0)
    if (targetIdx === undefined || !(bagged[targetIdx] > 0) || phase !== 'shopping') return
    const pi = Number(targetIdx)
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
      setScore(s => s + 1)
      timerRef.current = setTimeout(advance, 1600)
    } else {
      setBubble(WRONG[rnd(0, WRONG.length - 1)])
      setPhase('wrong')
      timerRef.current = setTimeout(() => {
        setBagged({})
        setFlying([])
        setReturning([])
        setPhase('shopping')
        setBubble('')
      }, 1400)
    }
  }, [phase, flying.length, hasBagged, bagged, q, advance])

  const [showReceipt, setShowReceipt] = useState(false)
  if (!q && !showReceipt) return null
  const { parts, customer, greeting } = q
  const accentColor = parts[0].item.color
  const productSize = parts.length === 1
    ? 'clamp(110px,22vw,160px)'
    : parts.length === 2
      ? 'clamp(80px,16vw,114px)'
      : 'clamp(62px,12vw,88px)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, padding: 'clamp(14px,3vw,28px)', width: '100%' }}>

      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 700, height: 14, background: 'rgba(0,0,0,0.08)', borderRadius: 10, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${(idx / questions.length) * 100}%` }}
          style={{ height: '100%', background: accentColor, borderRadius: 10 }}
          transition={{ duration: 0.4 }} />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={idx}
          ref={cardRef}
          initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -24 }} transition={{ duration: 0.3 }}
          style={{
            width: '100%', maxWidth: 700,
            background: 'white', borderRadius: 32,
            boxShadow: '0 8px 40px rgba(0,0,0,0.11)',
            border: `3px solid ${accentColor}44`,
            padding: 'clamp(22px,4vw,40px)',
            position: 'relative', overflow: 'visible',
            display: 'flex', flexDirection: 'column', gap: 28,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            <motion.span
              animate={phase === 'correct' ? { rotate: [0, -20, 20, -12, 12, 0], scale: [1, 1.25, 1.25, 1] }
                     : phase === 'wrong'   ? { x: [0, -10, 10, -6, 6, 0] } : {}}
              transition={{ duration: 0.6 }}
              style={{ fontSize: 'clamp(64px,13vw,90px)', lineHeight: 1, flexShrink: 0, userSelect: 'none' }}
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
                    background: phase === 'correct' ? '#E8F8EE' : '#FFE8E8',
                    border: `2.5px solid ${phase === 'correct' ? '#6BCB77' : '#FF6B6B'}`,
                    borderRadius: 18, padding: 'clamp(12px,2.5vw,20px) clamp(16px,3.5vw,28px)',
                    fontFamily: 'var(--font-heading)', fontSize: 'clamp(20px,4vw,28px)',
                    color: phase === 'correct' ? '#2d7a3a' : '#c0392b',
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
                    background: `${accentColor}14`,
                    border: `2.5px solid ${accentColor}66`,
                    borderRadius: 18, padding: 'clamp(12px,2.5vw,20px) clamp(16px,3.5vw,28px)',
                    fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px,3.6vw,25px)',
                    color: 'var(--text-primary)', flex: 1, lineHeight: 1.6,
                  }}
                >
                  {greeting}{' '}
                  {parts.map((p, i) => (
                    <span key={i}>
                      {i > 0 && (
                        <span style={{ color: 'var(--text-muted)' }}>
                          {i === parts.length - 1 ? ' und ' : ', '}
                        </span>
                      )}
                      <strong style={{ color: p.item.color }}>
                        {p.n} {p.n === 1 ? p.item.singular : p.item.name}
                      </strong>
                    </span>
                  ))}
                  !
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* MIDDLE: Shelf ←→ Cart */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-around', gap: 12 }}>

            {/* Shelf products */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.3vw,22px)', color: 'var(--text-muted)' }}>
                Antippen zum Einlegen
              </div>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                {parts.map((p, i) => {
                  const count = (bagged[i] || 0) + flying.filter(f => f.partIdx === i).length
                  return (
                    <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                      <div style={{ position: 'relative', width: `calc(${productSize} + 16px)`, height: `calc(${productSize} + 16px)`, flexShrink: 0 }}>
                        <motion.button
                          ref={el => { shelfRefs.current[i] = el }}
                          whileHover={phase === 'shopping' ? { scale: 1.2, y: -6 } : {}}
                          whileTap={phase === 'shopping' ? { scale: 0.8 } : {}}
                          onClick={() => addItem(i)}
                          disabled={phase !== 'shopping'}
                          style={{
                            background: 'none', border: 'none', padding: 0,
                            width: '100%', height: '100%',
                            fontSize: productSize, lineHeight: 1,
                            cursor: phase === 'shopping' ? 'pointer' : 'default',
                            userSelect: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            filter: phase === 'shopping'
                              ? `drop-shadow(0 6px 16px ${p.item.color}99)`
                              : 'grayscale(0.5) opacity(0.6)',
                            WebkitTapHighlightColor: 'transparent',
                            transition: 'filter 0.2s',
                          }}
                        >
                          {p.item.emoji}
                        </motion.button>
                        {count > 0 && (
                          <motion.div
                            key={count}
                            initial={{ scale: 0.4 }} animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 500 }}
                            style={{
                              position: 'absolute', top: 0, right: 0,
                              background: p.item.color,
                              color: 'white', borderRadius: '50%',
                              width: 'clamp(28px,5.5vw,38px)', height: 'clamp(28px,5.5vw,38px)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontFamily: 'var(--font-heading)',
                              fontSize: 'clamp(14px,2.8vw,20px)', fontWeight: 800,
                              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                              pointerEvents: 'none',
                            }}
                          >
                            {count}
                          </motion.div>
                        )}
                      </div>
                      {/* Per-item remove button removed — now in shared button row */}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Arrow */}
            <motion.div
              animate={{ x: [0, 8, 0] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'easeInOut' }}
              style={{ fontSize: 'clamp(36px,7vw,52px)', color: accentColor, userSelect: 'none', flexShrink: 0, alignSelf: 'center' }}
            >
              →
            </motion.div>

            {/* Cart */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.3vw,22px)', color: 'var(--text-muted)' }}>
                Einkaufswagen
              </div>
              <div ref={cartRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.span
                  animate={cartControls}
                  style={{ fontSize: 'clamp(110px,22vw,160px)', lineHeight: 1, userSelect: 'none', display: 'block' }}
                >
                  🛒
                </motion.span>
                {totalCollected > 0 && (
                  <motion.div
                    key={totalCollected}
                    initial={{ scale: 0.4 }} animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500 }}
                    style={{
                      position: 'absolute', top: -6, right: -8,
                      background: accentColor, color: 'white', borderRadius: '50%',
                      width: 'clamp(36px,7vw,52px)', height: 'clamp(36px,7vw,52px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'clamp(17px,3.4vw,24px)', fontWeight: 800,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                  >
                    {totalCollected}
                  </motion.div>
                )}
              </div>
              {/* Per-item breakdown */}
              {parts.map((p, i) => {
                const count = bagged[i] || 0
                if (count === 0) return null
                return (
                  <div key={i} style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', maxWidth: 200 }}>
                    <AnimatePresence>
                      {Array.from({ length: count }).map((_, j) => (
                        <motion.span key={`${i}-${j}`}
                          initial={{ scale: 0, y: -10 }} animate={{ scale: 1, y: 0 }}
                          transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                          style={{ fontSize: 'clamp(24px,5vw,34px)', lineHeight: 1 }}
                        >
                          {p.item.emoji}
                        </motion.span>
                      ))}
                    </AnimatePresence>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action buttons: Zurücklegen + Bestätigen side by side */}
          {phase === 'shopping' && hasBagged && (
            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center' }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                onClick={() => removeItem()}
                disabled={flying.length > 0}
                style={{
                  background: '#FFE8E8', border: '2px solid #FF6B6B',
                  borderRadius: 14, padding: 'clamp(10px,2.2vw,16px) clamp(20px,4vw,32px)',
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(17px,3.5vw,23px)',
                  color: '#c0392b', cursor: 'pointer',
                  opacity: flying.length > 0 ? 0.5 : 1,
                }}
              >
                ← Zurücklegen
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.06, y: -2 }} whileTap={{ scale: 0.92 }}
                onClick={confirm}
                disabled={flying.length > 0}
                style={{
                  background: 'linear-gradient(135deg, #6BCB77, #4caf50)',
                  border: 'none',
                  borderRadius: 16, padding: 'clamp(12px,2.5vw,20px) clamp(28px,5.5vw,48px)',
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(20px,4vw,28px)',
                  color: 'white', cursor: 'pointer', fontWeight: 800,
                  boxShadow: '0 4px 14px rgba(76,175,80,0.35)',
                  opacity: flying.length > 0 ? 0.5 : 1,
                }}
              >
                ✓ Bestätigen
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      <p style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--text-muted)', margin: 0 }}>
        {score} von {Math.min(idx + (phase === 'correct' ? 1 : 0), questions.length)} richtig
      </p>
    </div>
  )
}
