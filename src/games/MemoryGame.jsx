import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { usePaused } from '../lib/pause.js'
import { Art, HintHand, useBursts } from '../components/play/index.js'
import { voice, KEY } from './woerter/voice.js'
import Finale from './woerter/Finale.jsx'
import { INK, pxCard } from './px.js'

/**
 * Memo-Welt: "Tierparty". The cards are little presents. Turned over, the
 * one inside jumps up. Two that belong together hug and dance off to the
 * party meadow at the top; the meadow shows from the start what makes a
 * pair (two the same, or the cow and its milk). At the end the whole party
 * comes out and dances.
 * Scientific basis:
 *   • Spacing Effect (Ebbinghaus, 1885) — repeated retrieval over time prevents forgetting.
 *   • Working Memory Training (Klingberg, 2010) — improving working memory capacity
 *     transfers to reading & math performance in children.
 *   • Episodic Memory (Tulving, 1972) — visual context (emoji) creates rich episodic traces.
 */

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Picture pairs by theme, one theme per level: before, the pool was simply
// the first 8–26 entries of one long list, so the later 104 pictures never
// appeared. Every picture has its name (said when the card is turned over,
// once it is recorded).
const ANIMALS = [
  ['🐕','Hund'], ['🐱','Katze'], ['🐟','Fisch'], ['🦋','Schmetterling'],
  ['🐸','Frosch'], ['🐮','Kuh'], ['🐷','Schwein'], ['🐑','Schaf'],
  ['🐔','Huhn'], ['🐧','Pinguin'], ['🦉','Eule'], ['🐝','Biene'],
  ['🐢','Schildkröte'], ['🐘','Elefant'], ['🦁','Löwe'], ['🐒','Affe'],
  ['🐰','Hase'], ['🐭','Maus'], ['🦆','Ente'], ['🐌','Schnecke'],
]
const FOOD = [
  ['🍎','Apfel'], ['🍌','Banane'], ['🍓','Erdbeere'], ['🍇','Traube'],
  ['🍐','Birne'], ['🍒','Kirsche'], ['🥕','Möhre'], ['🍕','Pizza'],
  ['🍦','Eis'], ['🍪','Keks'], ['🥨','Brezel'], ['🍋','Zitrone'],
  ['🥒','Gurke'], ['🍅','Tomate'], ['🥚','Ei'], ['🍞','Brot'],
]
const THINGS = [
  ['🚗','Auto'], ['🚂','Lok'], ['✈️','Flugzeug'], ['🚀','Rakete'],
  ['🚁','Hubschrauber'], ['🚲','Fahrrad'], ['⛵','Segelboot'], ['🚜','Traktor'],
  ['🚌','Bus'], ['🛴','Roller'], ['🎈','Luftballon'], ['⚽','Ball'],
  ['🧸','Teddy'], ['🎁','Geschenk'], ['⭐','Stern'], ['🌙','Mond'],
  ['☂️','Schirm'], ['🔑','Schlüssel'], ['🎸','Gitarre'], ['🥁','Trommel'],
  ['👑','Krone'], ['🏠','Haus'],
]
const PICTURE_POOLS = { 1: ANIMALS, 2: FOOD, 3: THINGS, 4: [...ANIMALS, ...FOOD, ...THINGS] }

// Pairs that belong together without looking alike. From level 5 on these
// replace the identical pairs, which turns the task from pure visual recall
// into recall plus "what goes with what" — the same concept forming that
// Sortier-Spaß trains, but held in memory. No card fits a second pair (the sun went with the sunflower
// as well as with the sunglasses; the candle already showed a flame; the
// "nerd" face next to the books was a cliché, not a connection).
const ASSOCIATION_PAIRS = [
  { a: ['🐄','Kuh'],         b: ['🥛','Milch'] },
  { a: ['🐝','Biene'],       b: ['🍯','Honig'] },
  { a: ['🌧️','Regen'],       b: ['☂️','Schirm'] },
  { a: ['🐔','Huhn'],        b: ['🥚','Ei'] },
  { a: ['🐰','Hase'],        b: ['🥕','Möhre'] },
  { a: ['🖌️','Pinsel'],      b: ['🎨','Farben'] },
  { a: ['🔑','Schlüssel'],   b: ['🔒','Schloss'] },
  { a: ['🧦','Socke'],       b: ['👟','Schuh'] },
  { a: ['🐕','Hund'],        b: ['🦴','Knochen'] },
  { a: ['🐒','Affe'],        b: ['🍌','Banane'] },
  { a: ['🪥','Zahnbürste'],  b: ['🦷','Zahn'] },
  { a: ['🐿️','Eichhörnchen'], b: ['🥜','Nuss'] },
  { a: ['🚒','Feuerwehr'],   b: ['🔥','Feuer'] },
  { a: ['🎣','Angel'],       b: ['🐟','Fisch'] },
  { a: ['⚽','Ball'],         b: ['🥅','Tor'] },
  { a: ['🎂','Torte'],       b: ['🎁','Geschenk'] },
  { a: ['❄️','Schnee'],      b: ['⛄','Schneemann'] },
  { a: ['🎻','Geige'],       b: ['🎵','Musik'] },
  { a: ['☀️','Sonne'],       b: ['🕶️','Sonnenbrille'] },
]

const shuffle = a => [...a].sort(() => Math.random() - 0.5)

// pairKey instead of comparing the emoji itself, so a pair can be two
// different pictures that belong together.
function buildCards(count, pool) {
  const chosen = shuffle(pool).slice(0, count)
  const flat = chosen.flatMap(([emoji, name], i) => [0, 1].map(() =>
    ({ emoji, name, pairKey: `p${i}`, found: [emoji, emoji] })))
  return shuffle(flat).map((c, id) => ({ id, ...c, flipped: false, matched: false }))
}

function buildAssociationCards(count) {
  const chosen = shuffle(ASSOCIATION_PAIRS).slice(0, count)
  const flat = chosen.flatMap(({ a, b }, i) => [a, b].map(([emoji, name]) =>
    ({ emoji, name, pairKey: `p${i}`, found: [a[0], b[0]] })))
  return shuffle(flat).map((c, id) => ({ id, ...c, flipped: false, matched: false }))
}

// Keyboard help only where there is a keyboard
const FINE_POINTER = typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize(s => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/** The back of a card: a present with a ribbon and a bow. */
function Present({ s }) {
  return (
    <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden="true" style={{ display: 'block' }}>
      <rect x={3} y={3} width={94} height={94} rx={14} fill="#8e6cf0" stroke={INK} strokeWidth={5} />
      {[[22, 24], [70, 30], [30, 72], [76, 76], [50, 14], [14, 50], [86, 52]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill={['#ffc93c', '#ff8fb8', '#3fc1a8'][i % 3]} />
      ))}
      <rect x={42} y={3} width={16} height={94} fill="#ffc93c" stroke={INK} strokeWidth={3} />
      <rect x={3} y={42} width={94} height={16} fill="#ffc93c" stroke={INK} strokeWidth={3} />
      <path d="M50 46 C34 28 24 40 34 50 C40 56 46 52 50 50 C54 52 60 56 66 50 C76 40 66 28 50 46 Z" fill="#ff6b8a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={50} cy={49} r={5} fill="#ff6b8a" stroke={INK} strokeWidth={2.5} />
    </svg>
  )
}

/** A string of party flags along the top of the party meadow. */
function Bunting() {
  const colors = ['#ff6b5b', '#ffc93c', '#4aa3ff', '#5cc45a', '#ff8fb8', '#8e6cf0']
  return (
    <svg viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 22, pointerEvents: 'none' }}>
      <path d="M0 2 Q200 14 400 2" fill="none" stroke={INK} strokeWidth={2} />
      {Array.from({ length: 16 }, (_, i) => {
        const x = 6 + i * 25, y = 2 + Math.sin((x / 400) * Math.PI) * 12 * 0.8
        return <path key={i} d={`M${x} ${y} L${x + 18} ${y} L${x + 9} ${y + 12} Z`} fill={colors[i % colors.length]} stroke={INK} strokeWidth={1.2} />
      })}
    </svg>
  )
}

export default function MemoryGame({ level = 1, onComplete }) {
  const paused = usePaused()
  const [bursts, burst] = useBursts()
  // Scale difficulty across 10 levels
  const pairCount   = level <= 2 ? 4 : level <= 4 ? 6 : level <= 6 ? 8 : level <= 8 ? 10 : 12
  // On a phone six columns made 48-px cards; four columns keep them large.
  // A landscape screen gets a wider board instead of a tall one.
  const [screen]    = useState(() => ({
    narrow:    window.matchMedia('(max-width: 600px)').matches,
    landscape: window.innerWidth > window.innerHeight,
  }))
  const gridCols    = screen.narrow ? 4
    : screen.landscape ? { 4: 4, 6: 6, 8: 4, 10: 5, 12: 6 }[pairCount]
    : pairCount <= 8 ? 4 : pairCount <= 10 ? 5 : 6
  const gridRows    = Math.ceil((pairCount * 2) / gridCols)
  // The preview scales with the number of cards (a constant glance per
  // card): higher levels stay harder — there is more to hold — without
  // being impossible.
  const previewSecs = Math.round(Math.min(8, Math.max(3, pairCount * 2 * 0.3)))
  // Association pairs (cow/milk) instead of identical ones from level 5 on.
  const useAssociations = level >= 5

  const [cards,    setCards]    = useState(() =>
    useAssociations ? buildAssociationCards(pairCount) : buildCards(pairCount, PICTURE_POOLS[level] ?? PICTURE_POOLS[4]))
  const [flipped,  setFlipped]  = useState([])
  const [locked,   setLocked]   = useState(false)
  const [moves,    setMoves]    = useState(0)
  const [guests,   setGuests]   = useState([])            // pairs at the party: [{ key, pics }]
  const [hug,      setHug]      = useState(null)          // { a, b, dx, dy } two cards meeting
  const [shaking,  setShaking]  = useState(() => new Set())
  const [jumps,    setJumps]    = useState({})            // card id -> how often it was turned
  const [streak,   setStreak]   = useState(0)             // pairs in a row without a wrong pair
  const [mismatchCount, setMismatchCount] = useState(0)
  const [cursor,   setCursor]   = useState(0)
  const [usingKeys, setUsingKeys] = useState(false)
  const [finale,   setFinale]   = useState(false)
  // Preview phase: all cards face up, a sand timer runs down
  const [phase,     setPhase]     = useState('preview') // 'preview' | 'playing'
  const [countdown, setCountdown] = useState(previewSecs)
  const resultRef = useRef(null)
  // pairs one of whose cards was part of a wrong pair before it was found
  const missedRef = useRef(new Set())
  const cardRefs  = useRef({})
  const partyRef  = useRef(null)
  const boardRef  = useRef(null)
  const board     = useSize(boardRef)

  // The task: the face-up cards and the example on the party meadow show
  // it; Lumi says it when it is recorded
  useEffect(() => {
    sayTask()
    voice([KEY.task(useAssociations ? 'tierparty-zusammen' : 'tierparty')])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const flip = useCallback((id) => {
    if (locked || phase !== 'playing') return
    const card = cards[id]
    if (!card || card.flipped || card.matched) return

    sfx.flip()
    const next = cards.map((c, i) => i === id ? { ...c, flipped: true } : c)
    const newFlipped = [...flipped, id]
    setCards(next)
    setFlipped(newFlipped)
    setJumps(j => ({ ...j, [id]: (j[id] ?? 0) + 1 }))
    voice([KEY.word(card.name)])

    if (newFlipped.length < 2) return

    // Two cards flipped
    setLocked(true)
    const finalMoves = moves + 1
    setMoves(finalMoves)

    const [a, b] = newFlipped
    const match  = next[a].pairKey === next[b].pairKey

    setTimeout(() => {
      if (match) {
        sfx.match()
        setMismatchCount(0)
        const s = streak + 1
        setStreak(s)
        if (s >= 2) sfx.combo(s)
        // the two run to each other and hug …
        const ea = cardRefs.current[a], eb = cardRefs.current[b]
        const dx = ea && eb ? (eb.offsetLeft - ea.offsetLeft) / 2 : 0
        const dy = ea && eb ? (eb.offsetTop - ea.offsetTop) / 2 : 0
        setHug({ a, b, dx, dy })
        if (ea) burst(ea, 'hearts', s >= 3 ? 14 : 8)
        if (eb) burst(eb, 'hearts', s >= 3 ? 14 : 8)
        const found = next[a].found
        const last = guests.length + 1 >= pairCount
        // … and dance off to the party
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c))
          setHug(null)
          setGuests(g => [...g, { key: next[a].pairKey, pics: found }])
          sfx.boing()
          if (partyRef.current) burst(partyRef.current, 'confetti', s >= 3 ? 20 : 12)
        }, reduceMotion() ? 0 : 900)
        sayRight()
        if (last) {
          // Memo keeps its own rating, shown as the tries on the board: perfect
          // play is exactly pairCount moves, so the slack grows with the board.
          // The score is the pairs found without a wrong try on either card.
          const stars = finalMoves <= Math.round(pairCount * 1.5) ? 3
                      : finalMoves <= Math.round(pairCount * 2.5) ? 2 : 1
          resultRef.current = { score: pairCount - missedRef.current.size, total: pairCount, stars }
          afterNarration(() => setFinale(true), { minMs: 1400 })
        }
      } else {
        sfx.mismatch()
        setStreak(0)
        missedRef.current.add(next[a].pairKey).add(next[b].pairKey)
        const newCount = mismatchCount + 1
        setMismatchCount(newCount)
        if (newCount === 4) sayWrong()
        setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c))
        setShaking(new Set([a, b]))
        setTimeout(() => setShaking(new Set()), 640)
      }
      setFlipped([])
      setLocked(false)
    }, match ? 520 : 1000)
  }, [locked, phase, cards, flipped, guests, moves, streak, mismatchCount, pairCount, burst])

  // Preview countdown (held while the help is open); the cards turn over
  useEffect(() => {
    if (phase !== 'preview' || paused) return
    if (countdown <= 0) {
      setCards(prev => prev.map(c => ({ ...c, flipped: false })))
      setPhase('playing')
      sfx.whoosh()
      return
    }
    const t = setTimeout(() => setCountdown(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown, paused])

  // Arrow key navigation + Enter/Space to flip
  useEffect(() => {
    const COLS  = gridCols
    const total = cards.length
    const onKey = (e) => {
      const arrow = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS }[e.key]
      if (arrow) {
        e.preventDefault()
        setUsingKeys(true)
        setCursor(c => Math.min(total - 1, Math.max(0, c + arrow)))
      } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUsingKeys(true); flip(cursor) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursor, flip, cards.length, gridCols])

  // Card size from the room the board has, in both directions
  const gap   = screen.narrow ? 10 : 16
  const cardS = Math.max(40, Math.floor(Math.min(
    (board.w - gap * (gridCols - 1)) / gridCols,
    (board.h - gap * (gridRows - 1)) / gridRows,
    170)))
  // The party meadow has a fixed height (it must not squeeze the board as it
  // fills): one row of guests, or two on a phone
  const partyRows = screen.narrow ? 2 : 1
  const partyH    = screen.narrow ? 100 : 84
  const perRow    = Math.ceil(pairCount / partyRows)
  const guestS    = Math.max(22, Math.min(44, ((board.w || 320) - 100) / perRow / 2.3, (partyH - 26) / partyRows - 4))
  // what makes a pair, shown before any is found
  const example = useAssociations ? ['🐄', '🥛'] : ['🎈', '🎈']
  // the hand taps a card that is still face down
  const handCard = phase === 'playing' && !locked ? cards.find(c => !c.matched && !c.flipped) : null

  return (
    <div style={{
      position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,1.6vw,18px) clamp(10px,3vw,32px)', gap: 'clamp(8px,1.4vw,14px)',
    }}>
      {/* The party meadow: every pair found dances here */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 1000, flexShrink: 0 }}>
        <div ref={partyRef} aria-label={`${guests.length} von ${pairCount} Paaren auf der Party`}
          style={{
            position: 'relative', flex: 1, height: partyH, borderRadius: 22, border: `3px solid ${INK}`,
            background: 'linear-gradient(180deg, #fffdf7, #a4e278)',
            boxShadow: '0 5px 0 rgba(42,27,61,0.25)', padding: '20px 10px 4px', overflow: 'hidden',
            display: 'flex', flexWrap: 'wrap', alignContent: 'flex-end', alignItems: 'flex-end', justifyContent: 'center', gap: '0 10px', boxSizing: 'border-box',
          }}>
          <Bunting />
          {guests.length === 0 && (
            <motion.div aria-hidden="true" animate={reduceMotion() ? {} : { y: [0, -5, 0] }} transition={{ duration: 1, repeat: Infinity }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.6 }}>
              <Art art={example[0]} size={40} />
              <svg viewBox="0 0 20 18" width={20} height={18}><path d="M10 17 C2 11 0 7 0 4.5 A4.5 4.5 0 0 1 10 3 A4.5 4.5 0 0 1 20 4.5 C20 7 18 11 10 17Z" fill="#ff5b8a" stroke={INK} strokeWidth="1.5" /></svg>
              <Art art={example[1]} size={40} />
            </motion.div>
          )}
          <AnimatePresence>
            {guests.map((g, i) => (
              <motion.div key={g.key}
                initial={{ y: -60, scale: 0.3, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                style={{ display: 'flex', alignItems: 'flex-end' }}>
                {g.pics.map((p, k) => (
                  <motion.div key={k}
                    animate={reduceMotion() ? {} : { rotate: k ? [6, -6] : [-6, 6], y: [0, -5, 0] }}
                    transition={{ duration: 0.8, repeat: Infinity, repeatType: 'mirror', delay: (i % 3) * 0.13 }}
                    style={{ marginLeft: k ? -guestS * 0.18 : 0, transformOrigin: '50% 100%' }}>
                    <Art art={p} size={guestS} />
                  </motion.div>
                ))}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0, width: 72 }}>
          {/* the preview's sand timer, then the tries: Memo's own rating comes from them */}
          {phase === 'preview' ? (
            <motion.div key={countdown} aria-label={`noch ${countdown} Sekunden`}
              initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, color: INK, background: 'var(--px-gold)',
                border: `3px solid ${INK}`, borderRadius: 14, padding: '0 8px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
              }}>
              <Art art="⏳" size={24} />{countdown}
            </motion.div>
          ) : (
            <div aria-label={`${moves} Versuche`} style={{ ...pxCard(), padding: '2px 10px', fontFamily: 'var(--font-heading)', fontSize: 17, color: INK, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Art art="👆" size={20} />{moves}
            </div>
          )}
        </div>
      </div>

      {/* The cards */}
      <div ref={boardRef} style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', maxWidth: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {cardS > 0 && board.w > 0 && (
          <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${gridCols}, ${cardS}px)`, gap }}>
            {cards.map(card => {
              const face = card.flipped || phase === 'preview'
              const inHug = hug && (hug.a === card.id || hug.b === card.id)
              const sign = hug?.a === card.id ? 1 : -1
              if (card.matched) {
                return <div key={card.id} ref={el => { cardRefs.current[card.id] = el }} aria-hidden="true"
                  style={{ width: cardS, height: cardS, borderRadius: 16, border: '3px dashed rgba(42,27,61,0.18)', boxSizing: 'border-box' }} />
              }
              return (
                <motion.div key={card.id} ref={el => { cardRefs.current[card.id] = el }}
                  role="button" tabIndex={-1} aria-label={face ? card.name : 'Karte'} data-pair={card.pairKey}
                  onClick={() => flip(card.id)}
                  whileHover={!face && phase === 'playing' ? { scale: 1.05, rotate: -2 } : {}}
                  whileTap={!face && phase === 'playing' ? { scale: 0.9, rotate: 3 } : {}}
                  animate={inHug && !reduceMotion()
                    ? { x: [0, hug.dx * sign * 0.9, hug.dx * sign * 0.9], y: [0, hug.dy * sign * 0.9, hug.dy * sign * 0.9 - 20], rotate: [0, sign * 10, -sign * 10], scale: [1, 1.08, 0.2], opacity: [1, 1, 0] }
                    : shaking.has(card.id) ? { x: [0, -10, 10, -8, 8, 0], rotate: [0, -4, 4, -2, 0] } : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
                  transition={inHug ? { duration: 0.9, times: [0, 0.45, 1] } : { duration: 0.5 }}
                  style={{
                    width: cardS, height: cardS, cursor: face ? 'default' : 'pointer', perspective: 700, zIndex: inHug ? 2 : 1,
                    outline: usingKeys && card.id === cursor ? `4px solid ${INK}` : 'none', outlineOffset: 4, borderRadius: 16,
                  }}>
                  <motion.div
                    animate={{ rotateY: face ? 0 : 180 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                    style={{ position: 'relative', transformStyle: 'preserve-3d', width: '100%', height: '100%' }}>
                    {/* Front: the guest inside, who jumps up when found */}
                    <div style={{
                      position: 'absolute', inset: 0, backfaceVisibility: 'hidden', ...pxCard(), borderRadius: 16,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <motion.div key={jumps[card.id] ?? 0}
                        animate={jumps[card.id] && !reduceMotion() ? { y: [0, -cardS * 0.18, 0, -cardS * 0.06, 0], rotate: [0, -10, 10, -4, 0], scale: [0.8, 1.1, 1] } : {}}
                        transition={{ duration: 0.8, delay: 0.15 }}>
                        <Art art={card.emoji} size={cardS * 0.72} />
                      </motion.div>
                    </div>
                    {/* Back: a present */}
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', filter: 'drop-shadow(0 5px 0 rgba(42,27,61,0.3))' }}>
                      <Present s={cardS} />
                    </div>
                  </motion.div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {FINE_POINTER && (
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: '#2a1b3d', flexShrink: 0, margin: 0, opacity: 0.75 }}>
          ⌨️ Pfeiltasten: wählen · Enter oder Leertaste: umdrehen
        </p>
      )}
      <HintHand to={handCard ? { current: cardRefs.current[handCard.id] } : null} active={!!handCard && !finale}
        delay={moves === 0 ? 2000 : 6000} />
      {finale && <Finale items={[...new Set(guests.flatMap(g => g.pics))].slice(0, 14)} hero="lumi" onDone={() => onComplete(resultRef.current)} />}
      {bursts}
    </div>
  )
}
