import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { narrate, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { usePaused } from '../lib/pause.js'
import { INK, pxCard, pxPanel, pxBubble } from './px.js'

// Sparkle burst that fires when a pair is found
function SparkBurst({ id }) {
  const sparks = Array.from({ length: 10 }, (_, i) => ({
    angle: (i / 10) * 360,
    dist:  55 + Math.random() * 40,
    emoji: ['⭐','✨','🌟','💫'][i % 4],
    size:  16 + Math.random() * 14,
  }))
  return (
    <div style={{ position:'fixed', top:'50%', left:'50%', pointerEvents:'none', zIndex:999 }}>
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          initial={{ x:0, y:0, scale:0, opacity:1 }}
          animate={{
            x: Math.cos(s.angle * Math.PI/180) * s.dist,
            y: Math.sin(s.angle * Math.PI/180) * s.dist,
            scale:[0,1.3,0.8,0], opacity:[1,1,1,0],
          }}
          transition={{ duration:0.7, delay: i*0.03, ease:'easeOut' }}
          style={{ position:'absolute', fontSize:s.size, lineHeight:1, marginLeft:-s.size/2, marginTop:-s.size/2 }}
        >{s.emoji}</motion.span>
      ))}
    </div>
  )
}

/**
 * Memo-Welt — Gedächtnistraining
 * Scientific basis:
 *   • Spacing Effect (Ebbinghaus, 1885) — repeated retrieval over time prevents forgetting.
 *   • Working Memory Training (Klingberg, 2010) — improving working memory capacity
 *     transfers to reading & math performance in children.
 *   • Episodic Memory (Tulving, 1972) — visual context (emoji) creates rich episodic traces.
 */

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

export default function MemoryGame({ level = 1, onComplete }) {
  const paused = usePaused()
  // Scale difficulty across 10 levels
  const pairCount   = level <= 2 ? 4 : level <= 4 ? 6 : level <= 6 ? 8 : level <= 8 ? 10 : 12
  // On a phone six columns made 48-px cards; four columns keep them large
  // (the board grows taller, and the frame scales it to fit). A landscape
  // screen gets a wider board instead of a tall one that would be shrunk.
  const [screen]    = useState(() => ({
    narrow:    window.matchMedia('(max-width: 600px)').matches,
    landscape: window.innerWidth > window.innerHeight,
  }))
  const gridCols    = screen.narrow ? 4
    : screen.landscape ? { 4: 4, 6: 6, 8: 4, 10: 5, 12: 6 }[pairCount]
    : pairCount <= 8 ? 4 : pairCount <= 10 ? 5 : 6
  // The preview used to shrink with the level while the board grew: one
  // single second for twelve pairs, i.e. twenty-four cards. Nobody can encode
  // that, so the phase became decorative and the game turned into pure trial
  // and error at exactly the levels meant to train memory. It now scales with
  // the number of cards (a constant glance per card), which keeps higher
  // levels harder — there is simply more to hold — without being impossible.
  const previewSecs = Math.round(Math.min(8, Math.max(3, pairCount * 2 * 0.3)))
  // Association pairs (cow/milk) instead of identical ones from level 5 on.
  const useAssociations = level >= 5

  const [cards,    setCards]    = useState(() =>
    useAssociations ? buildAssociationCards(pairCount) : buildCards(pairCount, PICTURE_POOLS[level] ?? PICTURE_POOLS[4]))
  const [flipped,  setFlipped]  = useState([])
  const [locked,   setLocked]   = useState(false)
  const [moves,    setMoves]    = useState(0)
  const [matches,  setMatches]  = useState(0)
  const [mood,     setMood]     = useState('happy')
  const [trophies,       setTrophies]       = useState([])
  const [sparkKey,       setSparkKey]       = useState(null)
  const [justMatched,    setJustMatched]    = useState(() => new Set())
  const [justMismatched, setJustMismatched] = useState(() => new Set())
  const [mismatchCount,  setMismatchCount]  = useState(0)
  const [matchPopup,     setMatchPopup]     = useState({ visible: false, text: '' })
  const [cursor,         setCursor]         = useState(0)
  const [usingKeys,      setUsingKeys]      = useState(false)
  // Preview phase: all cards face up. The countdown starts once the task has
  // been said, so the child gets the whole time to look.
  const [phase,          setPhase]          = useState('preview') // 'preview' | 'playing'
  const [counting,       setCounting]       = useState(false)
  const [countdown,      setCountdown]      = useState(previewSecs)
  const doneRef = useRef(false)
  // pairs one of whose cards was part of a wrong pair before it was found
  const missedRef = useRef(new Set())

  // The task. From level 5 on the rule changes, so it is explained with an
  // example — before, the bubble still said "Finde alle Paare" and a child
  // turning over a cow and a glass of milk could not know they belong.
  useEffect(() => {
    sayTask(useAssociations
      ? `${level === 5 ? 'Jetzt wird es knifflig! ' : ''}Finde zwei Karten, die zusammengehören, wie die Kuh und die Milch. Merk dir, wo die Bilder liegen!`
      : 'Merk dir, wo die Bilder liegen! Gleich drehen sich die Karten um.')
    return afterNarration(() => setCounting(true), { minMs: 300, maxMs: 10000 })
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
    // Name what is on the card: words to go with the pictures
    narrate([{ text: card.name }])

    if (newFlipped.length < 2) return

    // Two cards flipped
    setLocked(true)
    const finalMoves = moves + 1
    setMoves(finalMoves)

    const [a, b] = newFlipped
    const match  = next[a].pairKey === next[b].pairKey

    const delay = match ? 520 : 940
    setTimeout(() => {
      if (match) {
        sfx.match()
        setMismatchCount(0)
        const newMatches = matches + 1
        setMatches(newMatches)
        setMood('excited')
        setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c))
        setJustMatched(new Set([a, b]))
        setTimeout(() => setJustMatched(new Set()), 700)
        const found = next[a].found
        setMatchPopup({ visible: true, text: found.join(' ') + ' Paar! 🎉' })
        setTimeout(() => setMatchPopup({ visible: false, text: '' }), 950)
        setTrophies(prev => [...prev, found.join('')])
        setSparkKey(k => (k ?? 0) + 1)
        const last = newMatches >= pairCount && !doneRef.current
        if (last) { doneRef.current = true; sfx.complete() }
        // the name of the second card first, then why they are a pair
        afterNarration(() => {
          sayRight(next[a].say)
          if (!last) return
          // Memo keeps its own rating, by moves: perfect play is exactly
          // pairCount moves, so the slack grows with the board. The score is
          // the pairs found without a wrong try on either of their cards.
          const stars = finalMoves <= Math.round(pairCount * 1.5) ? 3
                      : finalMoves <= Math.round(pairCount * 2.5) ? 2 : 1
          const firstTry = pairCount - missedRef.current.size
          afterNarration(() => onComplete({ score: firstTry, total: pairCount, stars }), { minMs: 900 })
        }, { maxMs: 1500 })
        if (!last) setTimeout(() => setMood('happy'), 800)
      } else {
        sfx.mismatch()
        missedRef.current.add(next[a].pairKey).add(next[b].pairKey)
        const newCount = mismatchCount + 1
        setMismatchCount(newCount)
        afterNarration(() => (newCount === 4
          ? sayWrong('Schau noch mal genau hin! Du schaffst das!')
          : narrate([{ text: missLine(useAssociations ? NO_MATCH : NO_PAIR) }])), { maxMs: 1500 })
        setMood('encouraging')
        setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c))
        setJustMismatched(new Set([a, b]))
        setTimeout(() => setJustMismatched(new Set()), 640)
        setTimeout(() => setMood('happy'), 700)
      }
      setFlipped([])
      setLocked(false)
    }, delay)
  }, [locked, phase, cards, flipped, matches, moves, mismatchCount, pairCount, useAssociations, onComplete])

  // Preview phase countdown (held while the help is open)
  useEffect(() => {
    if (phase !== 'preview' || !counting || paused) return
    if (countdown <= 0) {
      setCards(prev => prev.map(c => ({ ...c, flipped: false })))
      setPhase('playing')
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

  const bubble = phase === 'preview'
    ? (useAssociations ? 'Finde, was zusammengehört: 🐄 + 🥛. Merk dir die Bilder! 👀' : 'Merk dir, wo die Bilder liegen! 👀')
    : mismatchCount >= 5
      ? 'Kein Stress! Schau genau hin — du schaffst das! 💪'
      : mismatchCount >= 3
        ? 'Fast! Versuch es nochmal! 🔍'
        : useAssociations
          ? 'Finde, was zusammengehört! 🧠'
          : 'Finde zwei gleiche Bilder! 🧠'

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(14px,2vw,22px)',
    }}>

      {/* Floating "Paar!" popup */}
      <AnimatePresence>
        {matchPopup.visible && (
          <motion.div
            key={`mp-${sparkKey}`}
            initial={{ y: 0, opacity: 1, scale: 0.7 }}
            animate={{ y: -100, opacity: 0, scale: 1.35 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: '46%', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 300, pointerEvents: 'none',
              fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 800,
              color: 'var(--px-gold)', WebkitTextStroke: `1.5px ${INK}`, textShadow: `0 4px 0 ${INK}`,
              whiteSpace: 'nowrap',
            }}
          >
            {matchPopup.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sparkle burst on match */}
      <AnimatePresence>{sparkKey && <SparkBurst key={sparkKey} id={sparkKey} />}</AnimatePresence>

      {/* Trophy shelf */}
      <div style={{
        width:'100%', maxWidth:780,
        minHeight:52,
        ...pxPanel, background:'#FFF1C9',
        padding:'8px 16px',
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
      }}>
        <span style={{ fontFamily:'var(--font-heading)', fontSize:15, color:INK, whiteSpace:'nowrap' }}>🏆 Gefunden:</span>
        <AnimatePresence>
          {trophies.map((emoji, i) => (
            <motion.span
              key={i}
              initial={{ scale:0, rotate:-30, y:-20 }}
              animate={{ scale:1, rotate:0, y:0 }}
              transition={{ type:'spring', stiffness:420, damping:16 }}
              style={{ fontSize:28, lineHeight:1, filter:'drop-shadow(0 2px 0 rgba(42,27,61,0.25))' }}
            >{emoji}</motion.span>
          ))}
        </AnimatePresence>
        {trophies.length === 0 && (
          <span style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'#6b5640' }}>Noch keine Paare</span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display:'flex', gap:'clamp(10px,3vw,20px)', alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
        <div style={{
          ...pxCard(), padding:'8px 20px',
          fontFamily:'var(--font-heading)', fontSize:17, color:INK,
        }}>
          ✨ {matches} von {pairCount} Paaren
        </div>
        <div style={{
          ...pxCard(), padding:'8px 20px',
          fontFamily:'var(--font-heading)', fontSize:17, color:INK,
        }}>
          👆 {moves} Versuche
        </div>
      </div>

      {/* Lumi callout — during the preview it holds the countdown, so
          nothing covers the cards the child is meant to memorise */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={mood} size={80} />
        <div style={{
          flex:1, ...pxBubble,
          padding:'14px 20px',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(16px,3.5vw,24px)',
          color:'var(--text-primary)',
          display:'flex', alignItems:'center', gap:14,
        }}>
          <span style={{ flex:1 }}>{bubble}</span>
          {phase === 'preview' && counting && (
            <motion.span
              key={countdown}
              initial={{ scale:1.5, opacity:0 }} animate={{ scale:1, opacity:1 }}
              aria-label={`noch ${countdown} Sekunden`}
              style={{
                fontFamily:'var(--font-heading)', fontSize:'clamp(30px,6vw,44px)', fontWeight:800, lineHeight:1,
                color:INK, background:'var(--px-gold)', border:`3px solid ${INK}`, borderRadius:12,
                minWidth:56, padding:'6px 10px', textAlign:'center',
              }}
            >
              {countdown}
            </motion.span>
          )}
        </div>
      </div>

      {/* Card grid */}
      <div style={{
        display:'grid',
        gridTemplateColumns:`repeat(${gridCols},1fr)`,
        gap:'clamp(10px,2vw,18px)',
        width:'100%', maxWidth: screen.landscape && gridCols > 4 ? 960 : 780,
      }}>
        {cards.map((card) => (
          <motion.div key={card.id}
            onClick={() => flip(card.id)}
            whileHover={!card.matched && !card.flipped && phase === 'playing' ? {scale:1.06} : {}}
            animate={
              justMatched.has(card.id)    ? { scale:[1,1.28,0.92,1.10,1] } :
              justMismatched.has(card.id) ? { x:[0,-11,11,-8,8,-4,4,0], rotate:[0,-3,3,-2,2,0] } :
              {}
            }
            transition={{ duration: 0.50 }}
            style={{ cursor: card.matched ? 'default' : 'pointer', perspective:700,
                     outline: usingKeys && card.id === cursor ? `3px solid ${INK}` : 'none',
                     outlineOffset: 4, borderRadius: 14 }}
          >
            <motion.div
              animate={{ rotateY: (card.flipped || card.matched || phase === 'preview') ? 0 : 180 }}
              transition={{ type:'spring', stiffness:260, damping:22 }}
              style={{ position:'relative', transformStyle:'preserve-3d', width:'100%', aspectRatio:'1' }}
            >
              {/* Front — the picture sized by the card, not the window */}
              <div style={{
                position:'absolute', inset:0, backfaceVisibility:'hidden',
                ...pxCard(card.matched ? 'right' : undefined),
                display:'flex', alignItems:'center', justifyContent:'center',
                containerType:'inline-size', fontSize:'52cqw',
              }}>
                {card.emoji}
              </div>
              {/* Back */}
              <div style={{
                position:'absolute', inset:0, backfaceVisibility:'hidden',
                transform:'rotateY(180deg)',
                borderRadius:12,
                background:'linear-gradient(180deg,#9A7BF5 0%,#8e6cf0 45%,#6a48cf 100%)',
                border:`3px solid ${INK}`,
                boxShadow:'inset 0 3px 0 rgba(255,255,255,0.3), inset 0 -5px 0 rgba(0,0,0,0.22), 0 5px 0 rgba(42,27,61,0.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'clamp(22px,5vw,38px)',
                overflow:'hidden',
              }}>
                {/* dot pattern */}
                <div style={{
                  position:'absolute', inset:0, borderRadius:9, pointerEvents:'none', opacity:0.18,
                  backgroundImage:'radial-gradient(circle, white 1px, transparent 1px)',
                  backgroundSize:'14px 14px',
                }} />
                ✨
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      {FINE_POINTER && (
        <p style={{ fontFamily:'var(--font-heading)', fontSize:14, color:'#6b5640' }}>
          ⌨️ Pfeiltasten: wählen · Enter oder Leertaste: umdrehen
        </p>
      )}
    </div>
  )
}
