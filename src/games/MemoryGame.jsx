import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
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
// Sortier-Spaß trains, but held in memory. `act` is what the two do together
// at the party (PartyPair): the cow drinks the milk, the bee flies to the
// honey, the sock slips into the shoe. No card fits a second pair (the sun went with the sunflower
// as well as with the sunglasses; the candle already showed a flame; the
// "nerd" face next to the books was a cliché, not a connection).
const ASSOCIATION_PAIRS = [
  { a: ['🐄','Kuh'],         b: ['🥛','Milch'], act: 'eat' },
  { a: ['🐝','Biene'],       b: ['🍯','Honig'], act: 'fly' },
  { a: ['🌧️','Regen'],       b: ['☂️','Schirm'], act: 'onto' },
  { a: ['🐔','Huhn'],        b: ['🥚','Ei'], act: 'onto' },
  { a: ['🐰','Hase'],        b: ['🥕','Möhre'], act: 'eat' },
  { a: ['🖌️','Pinsel'],      b: ['🎨','Farben'], act: 'scrub' },
  { a: ['🔑','Schlüssel'],   b: ['🔒','Schloss'], act: 'onto' },
  { a: ['🧦','Socke'],       b: ['👟','Schuh'], act: 'onto' },
  { a: ['🐕','Hund'],        b: ['🦴','Knochen'], act: 'eat' },
  { a: ['🐒','Affe'],        b: ['🍌','Banane'], act: 'eat' },
  { a: ['🪥','Zahnbürste'],  b: ['🦷','Zahn'], act: 'scrub' },
  { a: ['🐿️','Eichhörnchen'], b: ['🥜','Nuss'], act: 'eat' },
  { a: ['🚒','Feuerwehr'],   b: ['🔥','Feuer'], act: 'eat' },
  { a: ['🎣','Angel'],       b: ['🐟','Fisch'], act: 'float' },
  { a: ['⚽','Ball'],         b: ['🥅','Tor'], act: 'onto' },
  { a: ['🎂','Torte'],       b: ['🎁','Geschenk'], act: 'fly' },
  { a: ['❄️','Schnee'],      b: ['⛄','Schneemann'], act: 'onto' },
  { a: ['🎻','Geige'],       b: ['🎵','Musik'], act: 'float' },
  { a: ['☀️','Sonne'],       b: ['🕶️','Sonnenbrille'], act: 'float' },
]

const shuffle = a => [...a].sort(() => Math.random() - 0.5)

// Two of the same at the party: leapfrog, a spin together, a hug
const SAME_ACTS = ['jump', 'spin', 'hug']

// pairKey instead of comparing the emoji itself, so a pair can be two
// different pictures that belong together.
function buildCards(count, pool) {
  const chosen = shuffle(pool).slice(0, count)
  const flat = chosen.flatMap(([emoji, name], i) => [0, 1].map(() =>
    ({ emoji, name, pairKey: `p${i}`, found: [emoji, emoji], act: SAME_ACTS[i % SAME_ACTS.length] })))
  return shuffle(flat).map((c, id) => ({ id, ...c, flipped: false, matched: false }))
}

function buildAssociationCards(count) {
  const chosen = shuffle(ASSOCIATION_PAIRS).slice(0, count)
  const flat = chosen.flatMap(({ a, b, act }, i) => [a, b].map(([emoji, name]) =>
    ({ emoji, name, pairKey: `p${i}`, found: [a[0], b[0]], act })))
  return shuffle(flat).map((c, id) => ({ id, ...c, flipped: false, matched: false }))
}

/**
 * A pair at the party, doing its thing again and again: `a` on the left,
 * `b` on the right, `s` their size.
 */
function PartyPair({ pics, act, s, i }) {
  const d = s * 0.82
  const still = reduceMotion()
  const loop = (duration, times) => ({ duration, times, repeat: Infinity, repeatDelay: 1.4, delay: 0.6 + (i % 4) * 0.35 })
  const moves = {
    // b goes to a and is gobbled up; a chews
    eat:   [{ scaleY: [1, 1, 1.18, 0.9, 1] }, { x: [0, -d * 0.7, -d * 0.7, 0, 0], scale: [1, 0.6, 0, 0, 1], opacity: [1, 1, 0, 0, 1] }],
    // a flies a loop over b and back
    fly:   [{ x: [0, d * 0.5, d * 1.2, d * 0.5, 0], y: [0, -s * 0.45, -s * 0.1, -s * 0.45, 0] }, {}],
    // a hops onto (into) b, then back
    onto:  [{ x: [0, d * 0.5, d, d, 0], y: [0, -s * 0.45, -s * 0.15, -s * 0.15, 0], scale: [1, 1, 0.8, 0.8, 1] }, { scaleY: [1, 1, 0.85, 1, 1] }],
    // a scrubs back and forth over b
    scrub: [{ x: [0, d * 0.7, d * 0.95, d * 0.7, d * 0.95, 0], y: [0, -s * 0.3, -s * 0.3, -s * 0.3, -s * 0.3, 0], rotate: [0, -20, 20, -20, 20, 0] }, {}],
    // b floats up over a, like a note out of the violin
    float: [{ rotate: [0, -8, 8, 0] }, { x: [0, -d * 0.4, -d * 0.4, 0], y: [0, -s * 0.45, -s * 0.3, 0] }],
    // leapfrog: a jumps over b, b ducks
    jump:  [{ x: [0, d * 0.5, d, d * 0.5, 0], y: [0, -s * 0.5, 0, -s * 0.5, 0] }, { scaleY: [1, 0.75, 1, 0.75, 1] }],
    spin:  [{ rotate: [0, 360], y: [0, -s * 0.2, 0] }, { rotate: [0, -360], y: [0, -s * 0.2, 0] }],
    hug:   [{ x: [0, d * 0.18, 0], rotate: [0, 12, 0] }, { x: [0, -d * 0.18, 0], rotate: [0, -12, 0] }],
  }[act] ?? []
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
      {pics.map((p, k) => (
        <motion.div key={k} animate={still ? {} : moves[k]} transition={loop(1.6)}
          style={{ marginLeft: k ? -s * 0.18 : 0, transformOrigin: '50% 100%', position: 'relative', zIndex: k ? 1 : 2 }}>
          <Art art={p} size={s} />
        </motion.div>
      ))}
    </div>
  )
}

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
  // The preview scales with the number of cards, half a second per card:
  // higher levels stay harder — there is more to hold — without being
  // impossible (20 cards: 11 s).
  const previewSecs = Math.round(Math.max(4, 1 + pairCount * 2 * 0.5))
  // Association pairs (cow/milk) instead of identical ones from level 5 on.
  const useAssociations = level >= 5

  const [cards,    setCards]    = useState(() =>
    useAssociations ? buildAssociationCards(pairCount) : buildCards(pairCount, PICTURE_POOLS[level] ?? PICTURE_POOLS[4]))
  const [flipped,  setFlipped]  = useState([])
  const [locked,   setLocked]   = useState(false)
  const [moves,    setMoves]    = useState(0)
  const [guests,   setGuests]   = useState([])            // pairs at the party: [{ key, pics }]
  const [hug,      setHug]      = useState(null)          // { a, b, dx, dy } two cards meeting
  const [puzzled,  setPuzzled]  = useState(null)          // { a, b, dir } two wrong ones look at each other
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
  // cards the child has turned over at least once, for the hint hand
  const seenRef   = useRef(new Set())
  // pairs found so far, counted at once (the guests join the party later)
  const foundRef  = useRef(0)
  const cardRefs  = useRef({})
  const partyRef  = useRef(null)
  const boardRef  = useRef(null)
  const board     = useSize(boardRef)
  const party     = useSize(partyRef)

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
    seenRef.current.add(id)
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
        const last = ++foundRef.current >= pairCount
        // … then dance in their places on the board, and join the party
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c))
          setHug(null)
          setGuests(g => [...g, { key: next[a].pairKey, pics: found, act: next[a].act }])
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
        // they look at each other, shrug, and duck back down
        const ea = cardRefs.current[a], eb = cardRefs.current[b]
        const dx = ea && eb ? eb.offsetLeft - ea.offsetLeft : 1
        const dy = ea && eb ? eb.offsetTop - ea.offsetTop : 0
        setPuzzled({ a, b, dir: Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0, up: Math.sign(dy) })
        setTimeout(() => {
          setPuzzled(null)
          sfx.slideDown()
          setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c))
          setFlipped([])
          setLocked(false)
        }, reduceMotion() ? 600 : 1300)
        return
      }
      setFlipped([])
      setLocked(false)
    }, match ? 520 : 600)
  }, [locked, phase, cards, flipped, moves, streak, mismatchCount, pairCount, burst])

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
  // The party meadow has a fixed height from the start (it must not squeeze
  // the board as it fills): as few rows as keep every guest at least 34 px
  const partyW = party.w || board.w || 320
  const sizeFor = rows => Math.min(48, (partyW - 16) / Math.ceil(pairCount / rows) / 1.65 - 6)
  const partyRows = [1, 2, 3].find(r => sizeFor(r) >= 34) ?? 3
  const guestS    = Math.max(24, sizeFor(partyRows))
  const partyH    = 26 + partyRows * (guestS + 8)
  // what makes a pair, shown before any is found
  const example = useAssociations ? ['🐄', '🥛'] : ['🎈', '🎈']
  // The hand taps a card worth turning: the partner of the open card, or a
  // card of a pair the child has already seen both of; otherwise a card not
  // seen yet (never the same one over and over)
  const handCard = useMemo(() => {
    if (phase !== 'playing' || locked) return null
    const seen = seenRef.current
    const down = cards.filter(c => !c.matched && !c.flipped)
    const open = cards.find(c => c.flipped && !c.matched)
    const partner = c => down.find(d => d.pairKey === c.pairKey && d.id !== c.id)
    if (open) {
      const p = partner(open)
      if (p && seen.has(p.id)) return p
    } else {
      const known = down.find(c => seen.has(c.id) && seen.has(partner(c)?.id))
      if (known) return known
    }
    const fresh = down.filter(c => !seen.has(c.id))
    const pool = fresh.length ? fresh : down
    return pool[Math.floor(Math.random() * pool.length)] ?? null
  }, [phase, locked, cards])

  return (
    <div style={{
      position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,1.6vw,18px) clamp(10px,3vw,32px)', gap: 'clamp(8px,1.4vw,14px)',
    }}>
      {/* The party meadow: every pair found dances here */}
      <div style={{ position: 'relative', width: '100%', maxWidth: 1000, flexShrink: 0 }}>
        <div ref={partyRef} aria-label={`${guests.length} von ${pairCount} Paaren auf der Party`}
          style={{
            position: 'relative', height: partyH, borderRadius: 22, border: `3px solid ${INK}`,
            background: 'linear-gradient(180deg, #fffdf7, #a4e278)',
            boxShadow: '0 5px 0 rgba(42,27,61,0.25)', padding: '20px 10px 4px', overflow: 'hidden',
            display: 'flex', flexWrap: 'wrap', alignContent: 'space-evenly', alignItems: 'flex-end', justifyContent: 'center', gap: '0 6px', boxSizing: 'border-box',
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
                style={{ width: guestS * 1.65, display: 'flex', justifyContent: 'center' }}>
                <PartyPair pics={g.pics} act={g.act} s={guestS} i={i} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div style={{ position: 'absolute', top: -12, right: 12, zIndex: 2 }}>
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
                // a found guest dances in its place
                return (
                  <div key={card.id} ref={el => { cardRefs.current[card.id] = el }} aria-hidden="true"
                    style={{ position: 'relative', width: cardS, height: cardS, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    <div style={{ position: 'absolute', width: cardS * 0.6, height: cardS * 0.12, marginBottom: cardS * 0.06, borderRadius: '50%', background: 'rgba(42,27,61,0.15)' }} />
                    <motion.div initial={{ scale: 0.4, y: -cardS * 0.3 }}
                      animate={reduceMotion() ? { scale: 1, y: 0 } : { scale: 1, y: [0, -cardS * 0.16, 0], rotate: card.id % 2 ? [-10, 10, -10] : [10, -10, 10] }}
                      transition={{ scale: { type: 'spring', stiffness: 300, damping: 12 }, y: { duration: 0.7, repeat: Infinity, delay: (card.id % 4) * 0.15 }, rotate: { duration: 1.4, repeat: Infinity } }}
                      style={{ transformOrigin: '50% 100%', marginBottom: cardS * 0.1 }}>
                      <Art art={card.emoji} size={cardS * 0.62} />
                    </motion.div>
                  </div>
                )
              }
              const puz = puzzled && (puzzled.a === card.id || puzzled.b === card.id) ? (puzzled.a === card.id ? 1 : -1) : 0
              return (
                <motion.div key={card.id} ref={el => { cardRefs.current[card.id] = el }}
                  role="button" tabIndex={-1} aria-label={face ? card.name : 'Karte'} data-pair={card.pairKey}
                  onClick={() => flip(card.id)}
                  whileHover={!face && phase === 'playing' ? { scale: 1.05, rotate: -2 } : {}}
                  whileTap={!face && phase === 'playing' ? { scale: 0.9, rotate: 3 } : {}}
                  animate={inHug && !reduceMotion()
                    ? { x: [0, hug.dx * sign * 0.8, 0], y: [0, hug.dy * sign * 0.8 - 10, 0], rotate: [0, sign * 10, 0], scale: [1, 1.08, 1] }
                    : { x: 0, y: 0, rotate: 0, scale: 1 }}
                  transition={inHug ? { duration: 0.9, times: [0, 0.45, 1] } : { duration: 0.5 }}
                  style={{
                    position: 'relative', width: cardS, height: cardS, cursor: face ? 'default' : 'pointer', perspective: 700, zIndex: inHug ? 2 : 1,
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
                        {/* a wrong pair: lean toward the other one, look, shrug */}
                        <motion.div
                          animate={puz && !reduceMotion()
                            ? { x: [0, puz * (puzzled.dir || 0) * cardS * 0.1, puz * (puzzled.dir || 0) * cardS * 0.1, 0], y: [0, puz * -(puzzled.up || 0) * cardS * 0.06, -cardS * 0.08, 0],
                                rotate: [0, puz * (puzzled.dir || 1) * 14, puz * (puzzled.dir || 1) * -8, 0], scaleY: [1, 1, 1.12, 0.9] }
                            : { x: 0, y: 0, rotate: 0, scaleY: 1 }}
                          transition={{ duration: 1.2, times: [0, 0.3, 0.7, 1] }}
                          style={{ transformOrigin: '50% 100%' }}>
                          <Art art={card.emoji} size={cardS * 0.72} />
                        </motion.div>
                      </motion.div>
                      {puz !== 0 && (
                        <motion.div aria-hidden="true" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.45, type: 'spring', stiffness: 400 }}
                          style={{ position: 'absolute', top: cardS * 0.02, right: cardS * 0.08, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: cardS * 0.26, color: '#6b3fd6', WebkitTextStroke: '1.5px #2a1b3d' }}>?</motion.div>
                      )}
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

      {/* only for a child who plays with the keys */}
      {usingKeys && (
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 14, color: '#2a1b3d', flexShrink: 0, margin: 0, opacity: 0.75 }}>
          ⌨️ Pfeiltasten: wählen · Enter oder Leertaste: umdrehen
        </p>
      )}
      <HintHand key={handCard?.id ?? 'none'} to={handCard ? { current: cardRefs.current[handCard.id] } : null} active={!!handCard && !finale}
        delay={moves === 0 ? 2000 : 6000} />
      {finale && <Finale items={[...new Set(guests.flatMap(g => g.pics))].slice(0, 14)} hero="lumi" onDone={() => onComplete(resultRef.current)} />}
      {bursts}
    </div>
  )
}
