import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { usePaused } from '../lib/pause.js'
import HearOptions from '../components/HearOptions.jsx'
import { Art, useBursts } from '../components/play/index.js'
import { INK, pxCard } from './px.js'

/**
 * Memo-Welt: "Tierparty". The cards are little presents. Turned over, the
 * one inside jumps up and says its name. Two that belong together hug and
 * dance off to the party meadow at the top; at the end everybody there
 * dances together.
 * Scientific basis:
 *   • Spacing Effect (Ebbinghaus, 1885) — repeated retrieval over time prevents forgetting.
 *   • Working Memory Training (Klingberg, 2010) — improving working memory capacity
 *     transfers to reading & math performance in children.
 *   • Episodic Memory (Tulving, 1972) — visual context (emoji) creates rich episodic traces.
 */

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Picture pairs by theme, one theme per level: before, the pool was simply
// the first 8–26 entries of one long list, so the later 104 pictures never
// appeared. Every picture has its name (said when the card is turned over)
// and its plural ("Zwei Hunde!").
const ANIMALS = [
  ['🐕','Hund','Hunde'], ['🐱','Katze','Katzen'], ['🐟','Fisch','Fische'], ['🦋','Schmetterling','Schmetterlinge'],
  ['🐸','Frosch','Frösche'], ['🐮','Kuh','Kühe'], ['🐷','Schwein','Schweine'], ['🐑','Schaf','Schafe'],
  ['🐔','Huhn','Hühner'], ['🐧','Pinguin','Pinguine'], ['🦉','Eule','Eulen'], ['🐝','Biene','Bienen'],
  ['🐢','Schildkröte','Schildkröten'], ['🐘','Elefant','Elefanten'], ['🦁','Löwe','Löwen'], ['🐒','Affe','Affen'],
  ['🐰','Hase','Hasen'], ['🐭','Maus','Mäuse'], ['🦆','Ente','Enten'], ['🐌','Schnecke','Schnecken'],
]
const FOOD = [
  ['🍎','Apfel','Äpfel'], ['🍌','Banane','Bananen'], ['🍓','Erdbeere','Erdbeeren'], ['🍇','Traube','Trauben'],
  ['🍐','Birne','Birnen'], ['🍒','Kirsche','Kirschen'], ['🥕','Möhre','Möhren'], ['🍕','Pizza','Pizzas'],
  ['🍦','Eis','Eis'], ['🍪','Keks','Kekse'], ['🥨','Brezel','Brezeln'], ['🍋','Zitrone','Zitronen'],
  ['🥒','Gurke','Gurken'], ['🍅','Tomate','Tomaten'], ['🥚','Ei','Eier'], ['🍞','Brot','Brote'],
]
const THINGS = [
  ['🚗','Auto','Autos'], ['🚂','Lok','Loks'], ['✈️','Flugzeug','Flugzeuge'], ['🚀','Rakete','Raketen'],
  ['🚁','Hubschrauber','Hubschrauber'], ['🚲','Fahrrad','Fahrräder'], ['⛵','Segelboot','Segelboote'], ['🚜','Traktor','Traktoren'],
  ['🚌','Bus','Busse'], ['🛴','Roller','Roller'], ['🎈','Luftballon','Luftballons'], ['⚽','Ball','Bälle'],
  ['🧸','Teddy','Teddys'], ['🎁','Geschenk','Geschenke'], ['⭐','Stern','Sterne'], ['🌙','Mond','Monde'],
  ['☂️','Schirm','Schirme'], ['🔑','Schlüssel','Schlüssel'], ['🎸','Gitarre','Gitarren'], ['🥁','Trommel','Trommeln'],
  ['👑','Krone','Kronen'], ['🏠','Haus','Häuser'],
]
const PICTURE_POOLS = { 1: ANIMALS, 2: FOOD, 3: THINGS, 4: [...ANIMALS, ...FOOD, ...THINGS] }

// Pairs that belong together without looking alike. From level 5 on these
// replace the identical pairs, which turns the task from pure visual recall
// into recall plus "what goes with what" — the same concept forming that
// Sortier-Spaß trains, but held in memory. Each pair says why it belongs
// together, and no card fits a second pair (the sun went with the sunflower
// as well as with the sunglasses; the candle already showed a flame; the
// "nerd" face next to the books was a cliché, not a connection).
const ASSOCIATION_PAIRS = [
  { a: ['🐄','Kuh'],         b: ['🥛','Milch'],        say: 'Die Kuh gibt Milch!' },
  { a: ['🐝','Biene'],       b: ['🍯','Honig'],        say: 'Die Biene macht Honig!' },
  { a: ['🌧️','Regen'],       b: ['☂️','Schirm'],       say: 'Bei Regen hält der Schirm dich trocken!' },
  { a: ['🐔','Huhn'],        b: ['🥚','Ei'],           say: 'Das Huhn legt Eier!' },
  { a: ['🐰','Hase'],        b: ['🥕','Möhre'],        say: 'Der Hase knabbert gern Möhren!' },
  { a: ['🖌️','Pinsel'],      b: ['🎨','Farben'],       say: 'Mit dem Pinsel malst du mit Farbe!' },
  { a: ['🔑','Schlüssel'],   b: ['🔒','Schloss'],      say: 'Der Schlüssel schließt das Schloss auf!' },
  { a: ['🧦','Socke'],       b: ['👟','Schuh'],        say: 'Erst die Socke, dann der Schuh!' },
  { a: ['🐕','Hund'],        b: ['🦴','Knochen'],      say: 'Der Hund kaut gern einen Knochen!' },
  { a: ['🐒','Affe'],        b: ['🍌','Banane'],       say: 'Der Affe isst gern Bananen!' },
  { a: ['🪥','Zahnbürste'],  b: ['🦷','Zahn'],         say: 'Mit der Zahnbürste putzt du die Zähne!' },
  { a: ['🐿️','Eichhörnchen'], b: ['🥜','Nuss'],        say: 'Das Eichhörnchen sammelt Nüsse!' },
  { a: ['🚒','Feuerwehr'],   b: ['🔥','Feuer'],        say: 'Die Feuerwehr löscht das Feuer!' },
  { a: ['🎣','Angel'],       b: ['🐟','Fisch'],        say: 'Mit der Angel fängt man Fische!' },
  { a: ['⚽','Ball'],         b: ['🥅','Tor'],          say: 'Der Ball soll ins Tor!' },
  { a: ['🎂','Torte'],       b: ['🎁','Geschenk'],     say: 'Zum Geburtstag gibt es Torte und Geschenke!' },
  { a: ['❄️','Schnee'],      b: ['⛄','Schneemann'],   say: 'Aus Schnee baut man einen Schneemann!' },
  { a: ['🎻','Geige'],       b: ['🎵','Musik'],        say: 'Die Geige macht Musik!' },
  { a: ['☀️','Sonne'],       b: ['🕶️','Sonnenbrille'], say: 'Bei Sonne trägt man eine Sonnenbrille!' },
]

const shuffle = a => [...a].sort(() => Math.random() - 0.5)

// pairKey instead of comparing the emoji itself, so a pair can be two
// different pictures that belong together.
function buildCards(count, pool) {
  const chosen = shuffle(pool).slice(0, count)
  const flat = chosen.flatMap(([emoji, name, plural], i) => [0, 1].map(() =>
    ({ emoji, name, pairKey: `p${i}`, found: [emoji], say: `Zwei ${plural}!` })))
  return shuffle(flat).map((c, id) => ({ id, ...c, flipped: false, matched: false }))
}

function buildAssociationCards(count) {
  const chosen = shuffle(ASSOCIATION_PAIRS).slice(0, count)
  const flat = chosen.flatMap(({ a, b, say }, i) => [a, b].map(([emoji, name]) =>
    ({ emoji, name, pairKey: `p${i}`, found: [a[0], b[0]], say })))
  return shuffle(flat).map((c, id) => ({ id, ...c, flipped: false, matched: false }))
}

// A wrong pair is part of playing memory, not a mistake: a light word, never
// the same one twice in a row.
const NO_PAIR = ['Kein Paar.', 'Das passt nicht.', 'Nicht gleich. Merk sie dir!']
const NO_MATCH = ['Das gehört nicht zusammen.', 'Das passt nicht zusammen.', 'Hm, die gehören nicht zusammen.']
let lastMiss = -1
function missLine(list) {
  lastMiss = (lastMiss + 1 + Math.floor(Math.random() * (list.length - 1))) % list.length
  return list[lastMiss]
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
  const [mismatchCount, setMismatchCount] = useState(0)
  const [cursor,   setCursor]   = useState(0)
  const [usingKeys, setUsingKeys] = useState(false)
  const [allDance, setAllDance] = useState(false)
  // Preview phase: all cards face up. The countdown starts once the task has
  // been said, so the child gets the whole time to look.
  const [phase,     setPhase]     = useState('preview') // 'preview' | 'playing'
  const [counting,  setCounting]  = useState(false)
  const [countdown, setCountdown] = useState(previewSecs)
  const doneRef = useRef(false)
  // pairs one of whose cards was part of a wrong pair before it was found
  const missedRef = useRef(new Set())
  const cardRefs  = useRef({})
  const partyRef  = useRef(null)
  const boardRef  = useRef(null)
  const board     = useSize(boardRef)

  const task = useAssociations
    ? `${level === 5 ? 'Jetzt wird es knifflig! ' : ''}Finde zwei Karten, die zusammengehören, wie die Kuh und die Milch. Merk dir, wo die Bilder liegen! Jedes Paar darf zur Party.`
    : 'Merk dir, wo die Bilder liegen! Gleich drehen sich die Karten um. Jedes Paar darf zur Party.'

  // The task. From level 5 on the rule changes, so it is explained with an
  // example.
  useEffect(() => {
    sayTask(task)
    return afterNarration(() => setCounting(true), { minMs: 300, maxMs: 12000 })
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
    // Name what is on the card: words to go with the pictures
    narrate([{ text: card.name }])

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
        // the two run to each other and hug …
        const ea = cardRefs.current[a], eb = cardRefs.current[b]
        const dx = ea && eb ? (eb.offsetLeft - ea.offsetLeft) / 2 : 0
        const dy = ea && eb ? (eb.offsetTop - ea.offsetTop) / 2 : 0
        setHug({ a, b, dx, dy })
        if (ea) burst(ea, 'hearts', 8)
        if (eb) burst(eb, 'hearts', 8)
        const found = next[a].found
        const newCount = guests.length + 1
        const last = newCount >= pairCount && !doneRef.current
        // … and dance off to the party
        setTimeout(() => {
          setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c))
          setHug(null)
          setGuests(g => [...g, { key: next[a].pairKey, pics: found.length > 1 ? found : [found[0], found[0]] }])
          sfx.boing()
          if (partyRef.current) burst(partyRef.current, 'confetti', 12)
        }, reduceMotion() ? 0 : 900)
        if (last) doneRef.current = true
        // the name of the second card first, then why they are a pair
        afterNarration(() => {
          sayRight(next[a].say)
          if (!last) return
          // Memo keeps its own rating, shown as the tries on the board: perfect
          // play is exactly pairCount moves, so the slack grows with the board.
          // The score is the pairs found without a wrong try on either card.
          const stars = finalMoves <= Math.round(pairCount * 1.5) ? 3
                      : finalMoves <= Math.round(pairCount * 2.5) ? 2 : 1
          const firstTry = pairCount - missedRef.current.size
          setTimeout(() => { setAllDance(true); sfx.tada(); if (partyRef.current) burst(partyRef.current, 'confetti', 24) }, 900)
          afterNarration(() => onComplete({ score: firstTry, total: pairCount, stars }), { minMs: 2600 })
        }, { maxMs: 1500 })
      } else {
        sfx.mismatch()
        missedRef.current.add(next[a].pairKey).add(next[b].pairKey)
        const newCount = mismatchCount + 1
        setMismatchCount(newCount)
        afterNarration(() => (newCount === 4
          ? sayWrong('Schau noch mal genau hin! Du schaffst das!')
          : narrate([{ text: missLine(useAssociations ? NO_MATCH : NO_PAIR) }])), { maxMs: 1500 })
        setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c))
        setShaking(new Set([a, b]))
        setTimeout(() => setShaking(new Set()), 640)
      }
      setFlipped([])
      setLocked(false)
    }, match ? 520 : 1000)
  }, [locked, phase, cards, flipped, guests, moves, mismatchCount, pairCount, useAssociations, onComplete, burst])

  // Preview phase countdown (held while the help is open)
  useEffect(() => {
    if (phase !== 'preview' || !counting || paused) return
    if (countdown <= 0) {
      setCards(prev => prev.map(c => ({ ...c, flipped: false })))
      setPhase('playing')
      sfx.whoosh()
      narrate([{ text: useAssociations ? 'Los! Finde, was zusammengehört.' : 'Los! Finde die Paare.' }])
      return
    }
    const t = setTimeout(() => setCountdown(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, counting, countdown, paused, useAssociations])

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
  const perRow = screen.narrow ? Math.ceil(pairCount / 2) : pairCount
  const guestS = Math.max(24, Math.min(48, ((board.w || 320) - 120) / perRow / 2.3))

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,1.6vw,18px) clamp(10px,3vw,32px)', gap: 'clamp(8px,1.4vw,14px)',
    }}>
      {/* The party meadow: every pair found dances here */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 1000, flexShrink: 0 }}>
        <div ref={partyRef} aria-label={`${guests.length} von ${pairCount} Paaren auf der Party`}
          style={{
            position: 'relative', flex: 1, minHeight: screen.narrow ? 92 : 84, borderRadius: 22, border: `3px solid ${INK}`,
            background: 'linear-gradient(180deg, #fffdf7, #a4e278)',
            boxShadow: '0 5px 0 rgba(42,27,61,0.25)', padding: '20px 10px 6px',
            display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: '2px 10px', boxSizing: 'border-box',
          }}>
          <Bunting />
          {guests.length === 0 && (
            <div aria-hidden="true" style={{ display: 'flex', gap: 18, opacity: 0.85 }}>
              <Art art="🎂" size={44} /><Art art="🎈" size={44} /><Art art="🎁" size={44} />
            </div>
          )}
          <AnimatePresence>
            {guests.map((g, i) => (
              <motion.div key={g.key}
                initial={{ y: -60, scale: 0.3, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                style={{ display: 'flex', alignItems: 'flex-end' }}>
                {g.pics.map((p, k) => (
                  <motion.div key={k}
                    animate={reduceMotion() ? {} : { rotate: k ? [6, -6] : [-6, 6], y: [0, allDance ? -16 : -5, 0] }}
                    transition={{ duration: allDance ? 0.4 : 0.8, repeat: Infinity, repeatType: 'mirror', delay: (i % 3) * 0.13 }}
                    style={{ marginLeft: k ? -guestS * 0.18 : 0, transformOrigin: '50% 100%' }}>
                    <Art art={p} size={guestS} />
                  </motion.div>
                ))}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <HearOptions items={[task]} label="Aufgabe noch einmal hören" size={52} />
          {/* the preview's countdown, then the tries: Memo's own rating comes from them */}
          {phase === 'preview' && counting && (
            <motion.div key={countdown} aria-label={`noch ${countdown} Sekunden`}
              initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 2,
                fontFamily: 'var(--font-heading)', fontSize: 26, fontWeight: 800, color: INK, background: 'var(--px-gold)',
                border: `3px solid ${INK}`, borderRadius: 14, padding: '0 8px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
              }}>
              <Art art="⏳" size={24} />{countdown}
            </motion.div>
          )}
          {phase === 'playing' && (
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
                  whileTap={!face && phase === 'playing' ? { scale: 0.92 } : {}}
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
      {bursts}
    </div>
  )
}
