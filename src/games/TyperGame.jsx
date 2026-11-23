import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { hearable } from '../lib/hearable.js'
import { Art, Wish, RoundTrail } from '../components/play/index.js'
import HearOptions from '../components/HearOptions.jsx'
import { Cauldron, WitchLumi, Puff, Alive, useFliers } from './kessel/Cauldron.jsx'
import { soundOf } from './letterSounds.js'
import { INK, pxCard } from './px.js'

// Keyboard key in the pixel look: parchment key, gold when it is the hinted
// letter, red for backspace. The hinted key pulses a gold ring around its
// pixel drop instead of a soft glow.
const KEY_DROP = 'inset 0 -4px 0 rgba(42,27,61,0.10), 0 4px 0 rgba(42,27,61,0.35)'
const KEY_RING = [KEY_DROP, `${KEY_DROP}, 0 0 0 4px rgba(255,201,60,0.75)`]
function keyLook(hinted, isBackspace) {
  return {
    ...pxCard(hinted ? 'selected' : undefined),
    borderRadius: 10,
    boxShadow: KEY_DROP,
    ...(hinted      ? { background: 'var(--px-gold)' } : null),
    ...(isBackspace ? { background: 'var(--px-red)' } : null),
  }
}

/**
 * Buchstabenwald: "Zauberkessel"
 * Lumi, in a witch's hat, wants to conjure a thing (the picture in the
 * speech bubble). Every letter the child types flies into the bubbling
 * cauldron; when the word is complete it goes *puff* and the thing steps
 * out alive: the cow moos, the ball bounces. A wrong letter makes the steam
 * purple, the cauldron coughs it back out and Lumi coughs along.
 *
 * Scientific basis:
 *   • Encoding Specificity (Tulving, 1983) — motor memory (typing) anchors letter shapes
 *     better than passive recognition alone.
 *   • Handwriting → Brain activation (James & Engelhardt, 2012) — letter-form motor programs
 *     activate reading circuits; keyboard input offers a comparable digital analogue.
 *   • Errorless Learning (Terrace, 1963) — immediate feedback on wrong letters prevents
 *     consolidation of incorrect patterns.
 */

// Every word is a concrete thing with its own picture: the picture and the
// spoken word are the only anchors a child who cannot read yet has. The old
// lists held non-words (SANDBURGREITER, NACHTSTIMMUNG), abstract or odd words
// (DRÜSE, SAG, GUT, LÖSUNG) and one picture for several words (🪑 for TISCH
// and STUHL, 🧙 for HEXE, ZWERG and ZAUBERER). One picture per word now, and
// at most eight letters.
const WORDS = {
  // 3 letters
  OMA:'👵', OPA:'👴', EIS:'🍦', UHR:'⏰', ZUG:'🚂', BUS:'🚌', HUT:'🎩', FEE:'🧚',
  ARM:'💪', OHR:'👂', KUH:'🐄', AXT:'🪓', HAI:'🦈', BÄR:'🐻', TOR:'🥅',
  // 4 letters
  HUND:'🐕', BALL:'⚽', BUCH:'📖', MUND:'👄', HAND:'✋', NASE:'👃', WOLF:'🐺', IGEL:'🦔',
  GELD:'💰', HERZ:'❤️', HOLZ:'🪵', BOOT:'⛵', GANS:'🪿', HAHN:'🐓', HASE:'🐰', KEKS:'🍪',
  MAUS:'🐭', MOND:'🌙', PILZ:'🍄', ROSE:'🌹', SOFA:'🛋️', ZELT:'⛺', BEIN:'🦵', AFFE:'🐒',
  ESEL:'🫏', PFAU:'🦚', BURG:'🏰', RING:'💍', BROT:'🍞', AUTO:'🚗', HAUS:'🏠', BAUM:'🌳',
  LÖWE:'🦁', KIWI:'🥝', LAMA:'🦙', ENTE:'🦆', EULE:'🦉', KÄSE:'🧀', MAIS:'🌽', DINO:'🦕',
  TAXI:'🚕', NEST:'🪺', ZAHN:'🦷', BETT:'🛏️', HOSE:'👖', SALZ:'🧂', FUSS:'🦶',
  // 5 letters
  KATZE:'🐱', VOGEL:'🐦', STERN:'⭐', APFEL:'🍎', SCHUH:'👟', PIZZA:'🍕', FEUER:'🔥',
  WURST:'🌭', NUDEL:'🍝', TASSE:'☕', KERZE:'🕯️', ADLER:'🦅', BIRNE:'🍐', TORTE:'🎂',
  SEIFE:'🧼', KRONE:'👑', ZIEGE:'🐐', KAMEL:'🐪', PFERD:'🐴', TIGER:'🐯', INSEL:'🏝️',
  GURKE:'🥒', SOCKE:'🧦', JACKE:'🧥', GEIGE:'🎻', SCHAF:'🐑', BIENE:'🐝', ANKER:'⚓',
  OTTER:'🦦', FISCH:'🐟', KREBS:'🦀', WOLKE:'☁️', EIMER:'🪣', ZEBRA:'🦓', PANDA:'🐼',
  KOALA:'🐨', HONIG:'🍯', MILCH:'🥛', MÖHRE:'🥕', KÄFER:'🐞', KÜKEN:'🐤', SONNE:'☀️',
  BLUME:'🌸', ROBBE:'🦭', RAUPE:'🐛', KRAKE:'🐙', PALME:'🌴', FEDER:'🪶', BESEN:'🧹',
  // 6 letters
  SCHULE:'🏫', TRAUBE:'🍇', RAKETE:'🚀', AMEISE:'🐜', BRÜCKE:'🌉', ZIRKUS:'🎪', SPINNE:'🕷️',
  PINSEL:'🖌️', TASCHE:'👜', SCHERE:'✂️', BREZEL:'🥨', KIRCHE:'⛪', KOFFER:'🧳', TELLER:'🍽️',
  PFANNE:'🍳', BANANE:'🍌', TOMATE:'🍅', MELONE:'🍈', KAMERA:'📷', BRILLE:'👓', KÜRBIS:'🎃',
  DELFIN:'🐬', DRACHE:'🐉', KUCHEN:'🍰', ROLLER:'🛴', KAKTUS:'🌵', FROSCH:'🐸', SCHWAN:'🦢',
  BALLON:'🎈', ANANAS:'🍍',
  // 7 letters
  ROBOTER:'🤖', ELEFANT:'🐘', ZITRONE:'🍋', GITARRE:'🎸', PINGUIN:'🐧', KÄNGURU:'🦘',
  HAMSTER:'🐹', MUSCHEL:'🐚', TROMMEL:'🥁', PAPAGEI:'🦜', TRAKTOR:'🚜', GIRAFFE:'🦒',
  SPIEGEL:'🪞', FENSTER:'🪟', EINHORN:'🦄', FAHRRAD:'🚲', ZWIEBEL:'🧅', PAPRIKA:'🫑',
  SCHWEIN:'🐷', KLAVIER:'🎹',
  // 8 letters
  KROKODIL:'🐊', FLUGZEUG:'✈️', SCHNECKE:'🐌', TRUTHAHN:'🦃', ZAUBERER:'🧙', ERDBEERE:'🍓',
  GESCHENK:'🎁', SCHLANGE:'🐍', TROMPETE:'🎺',
}

// Word length rises with the level, one step at a time. Before, level 4 went
// back to shorter words than level 3 and level 10 asked for seventeen
// letters (GEBURTSTAGSKUCHEN).
const STATIC_LEN = { 1: [3, 3], 2: [4, 4], 3: [5, 5] }
// speed: percent of the arena per 60 ms tick. 0.35 is a 20-second fall, 0.65
// still more than ten seconds per letter.
const FALLING = {
  4:  { len: [3, 3], speed: 0.35 },
  5:  { len: [4, 4], speed: 0.40 },
  6:  { len: [4, 5], speed: 0.45 },
  7:  { len: [5, 5], speed: 0.50 },
  8:  { len: [5, 6], speed: 0.55 },
  9:  { len: [6, 7], speed: 0.60 },
  10: { len: [7, 8], speed: 0.65 },
}

function pickWords([min, max], n) {
  return shuffle(Object.keys(WORDS).filter(w => w.length >= min && w.length <= max)).slice(0, n)
}

// "ZUG" -> "Zug": what is spoken and named, while the tiles stay in capitals
const nameOf = w => w[0] + w.slice(1).toLowerCase()

const ROWS = [
  ['Q','W','E','R','T','Z','U','I','O','P','Ü'],
  ['A','S','D','F','G','H','J','K','L','Ö'],
  ['Y','X','C','V','B','N','M','Ä','⌫'],
]
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'.split('')

// Anlauttabelle for the typing levels: every key shows a word that starts
// with its sound, and says it — "Mmm wie Maus". A child who cannot read yet
// hears the first sound of "Haus" and looks for the key with the dog. One
// clear picture per letter, all different; C, Q, V, X and Y take the sound
// they most often start a word with (letterSounds.js), the umlauts the few
// words a child knows that start with them.
const ANLAUT = {
  A:['Apfel','🍎'],   B:['Banane','🍌'],  C:['Clown','🤡'],  D:['Dino','🦖'],     E:['Ente','🦆'],
  F:['Fisch','🐟'],   G:['Giraffe','🦒'], H:['Hund','🐕'],   I:['Igel','🦔'],     J:['Jacke','🧥'],
  K:['Katze','🐱'],   L:['Löwe','🦁'],    M:['Maus','🐭'],   N:['Nase','👃'],     O:['Ohr','👂'],
  P:['Pilz','🍄'],    Q:['Qualle','🪼'],  R:['Rakete','🚀'], S:['Sonne','☀️'],    T:['Tiger','🐯'],
  U:['Ufo','🛸'],     V:['Vogel','🐦'],   W:['Wal','🐋'],    X:['Xylofon',':px-xylofon:'],
  Y:['Yoga','🧘'],    Z:['Zebra','🦓'],   Ä:['Ähre','🌾'],   Ö:['Ölkanne',':px-oelkanne:'],
  Ü:['überrascht','😮'],
}
// "Mmm wie Maus"
const anlaut = c => `${soundOf(c)} wie ${ANLAUT[c][0]}`

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// A full QWERTZ row has eleven keys; on a phone they came out 28–33 px wide,
// far too small for a child's finger. Narrow screens get a small keyboard
// instead: the letters of the word plus a few others, in ABC order, as big
// tiles.
function useNarrow(max = 600) {
  const query = `(max-width: ${max}px)`
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [query])
  return narrow
}

function compactKeys(word) {
  const own = [...new Set(word.split(''))]
  const others = shuffle(ALPHABET.filter(c => !own.includes(c)))
  const extra = Math.min(12, Math.max(8, own.length + 3)) - own.length
  return [...own, ...others.slice(0, extra)].sort((a, b) => a.localeCompare(b, 'de'))
}


// What the conjured thing says once it is out of the cauldron ("Kuh! Muuh!").
const SOUND = {
  KUH: 'Muuh!', HUND: 'Wau, wau!', KATZE: 'Miau!', SCHAF: 'Mäh!', ZIEGE: 'Mäh!', ENTE: 'Quak, quak!',
  FROSCH: 'Quak!', HAHN: 'Kikeriki!', ESEL: 'I-aah!', SCHWEIN: 'Grunz, grunz!', LÖWE: 'Roaar!', TIGER: 'Roaar!',
  EULE: 'Schuhu!', BIENE: 'Summ, summ!', MAUS: 'Piep, piep!', KÜKEN: 'Piep, piep!', VOGEL: 'Tschilp!',
  WOLF: 'Auuuh!', GANS: 'Schnatter, schnatter!', ELEFANT: 'Törööö!', AFFE: 'Uh, uh, ah, ah!', SCHLANGE: 'Sssss!',
  KROKODIL: 'Schnapp!', DRACHE: 'Fauch!', ZUG: 'Tschu, tschu!', BUS: 'Tüt, tüt!', AUTO: 'Brumm, brumm!',
  TAXI: 'Tüt, tüt!', TRAKTOR: 'Brumm, brumm!', UHR: 'Tick, tack!', TROMMEL: 'Bumm, bumm!', TROMPETE: 'Törööö!',
  RAKETE: 'Drei, zwei, eins, los!', FLUGZEUG: 'Wuuusch!', FEUER: 'Knister, knister!', HASE: 'Hopp, hopp!',
  KÄNGURU: 'Hopp, hopp!', GESCHENK: 'Überraschung!', ROBOTER: 'Piep, piep, bup!',
}
// …and how it moves. Everything else hops.
const MOVE_OF = Object.fromEntries([
  ['drive', 'ZUG BUS AUTO TAXI TRAKTOR FAHRRAD ROLLER'],
  ['fly',   'VOGEL ADLER EULE BIENE RAKETE FLUGZEUG BALLON FEE DRACHE PAPAGEI KÄFER FEDER WOLKE PFAU SCHWAN'],
  ['swim',  'FISCH HAI DELFIN KREBS KRAKE ROBBE OTTER ENTE BOOT MUSCHEL'],
  ['spin',  'BALL UHR STERN SONNE KRONE RING TELLER PIZZA KUCHEN TORTE KEKS MOND BREZEL'],
].flatMap(([move, words]) => words.split(' ').map(w => [w, move])))

// The potion changes colour with every letter that goes in
const BREWS = ['#7be36b', '#5fd3c9', '#7aa8ff', '#c08bff', '#ff8fd0', '#ffb347', '#ffe066', '#9be15d']

/**
 * The on-screen keyboard. `hint` is the letter that pulses, `onBack` adds ⌫,
 * `pictures` turns it into the Anlauttabelle: each key with its picture,
 * saying its sound on hover and keyboard focus. `onKey(letter, keyElement)`.
 */
function Keyboard({ word, hint, onKey, onBack, pictures = false }) {
  const narrow = useNarrow()
  const keys = useMemo(() => compactKeys(word), [word])

  const key = (k, size) => {
    const hinted = k === hint
    const back = k === '⌫'
    const pic = pictures && !back
    const { picSize, ...box } = size
    return (
      <motion.button key={k} data-key={k}
        whileTap={{ scale:0.85, y:4 }}
        onClick={e => (back ? onBack() : onKey(k, e.currentTarget))}
        {...(pic ? hearable(anlaut(k)) : null)}
        aria-label={back ? 'Löschen' : pic ? `${k}, ${anlaut(k)}` : k}
        animate={hinted ? { scale:[1,1.1,1], boxShadow:[KEY_RING[0],KEY_RING[1],KEY_RING[0]] } : {}}
        transition={hinted ? { duration:1.3, repeat:Infinity } : {}}
        style={{
          ...box,
          ...keyLook(hinted, back),
          color: hinted ? INK : back ? 'white' : 'var(--text-primary)',
          fontFamily:'var(--font-heading)', fontWeight:700,
          cursor:'pointer', display:'flex', flexDirection:'column', gap:2,
          alignItems:'center', justifyContent:'center',
          padding:0, flexShrink:0, lineHeight:1,
        }}
      >
        {k}
        {pic && <Art art={ANLAUT[k][1]} size={picSize} />}
      </motion.button>
    )
  }

  if (narrow) {
    // with pictures the keys grow a little, so letter and picture both stay
    // readable: five 58 px keys fit a 360 px phone
    const size = pictures ? { width:58, height:74, fontSize:22, picSize:30 } : { width:52, height:52, fontSize:24 }
    return (
      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:8, width:'100%', maxWidth:420, flexShrink:0 }}>
        {keys.map(k => key(k, size))}
        {onBack && key('⌫', size)}
      </div>
    )
  }

  // eleven keys and ten gaps across the widest row
  const size = { width:'min(60px, calc((100% - 50px) / 11))', height: pictures ? 76 : 56,
                 fontSize:'clamp(17px,2.4vw,22px)', picSize:32 }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:740, flexShrink:0 }}>
      {ROWS.map((row, ri) => (
        <div key={ri} style={{ display:'flex', justifyContent:'center', gap:5, width:'100%' }}>
          {row.filter(k => k !== '⌫' || onBack).map(k => key(k, size))}
        </div>
      ))}
    </div>
  )
}

// What to say when the child is looking for a letter: the first letter also
// gets its word ("Z wie Zug"), the rest just the letter name. The typing
// levels say the key's sound and picture instead (anlaut).
function lookFor(char, word, pos) {
  return pos === 0 ? `das ${char}, ${char} wie ${nameOf(word)}` : `das ${char}`
}

const firstTask = (word, falling) => (falling
  ? `Wir zaubern das Wort ${nameOf(word)}! Die Buchstaben fallen vom Himmel. Tipp sie auf der Tastatur, bevor sie unten sind.`
  : `Wir zaubern das Wort ${nameOf(word)}! Tipp die Buchstaben auf der Tastatur, dann fliegen sie in den Kessel.`)
const nextTask = word => `Jetzt zaubern wir das Wort ${nameOf(word)}.`
// "Kuh! Muuh!"
const conjured = word => `${nameOf(word)}! ${SOUND[word] ?? ''}`.trim()

// Lumi's act (WitchLumi) for a moment, then back to idle
function useAct() {
  const [state, set] = useState({ act: 'idle', beat: 0 })
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const act = useCallback((a, ms = 900) => {
    clearTimeout(timer.current)
    set(s => ({ act: a, beat: s.beat + 1 }))
    timer.current = setTimeout(() => set(s => ({ ...s, act: 'idle' })), ms)
  }, [])
  return [state, act]
}

/**
 * Everything the cauldron does, shared by both ways of playing: letters fly
 * in (a splash, the potion changes colour), wrong ones are coughed back out,
 * and the finished word comes alive. The surprise now and then: Lumi's hat
 * jumps off, or the cauldron burps.
 */
function useKessel() {
  const [lumi, act] = useAct()
  const [cough, setCough] = useState(false)
  const [splash, setSplash] = useState(0)
  const [fliers, fly] = useFliers()
  const mouthRef = useRef(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }

  const letterIn = (fromEl, char) => {
    fly(fromEl, mouthRef.current, char, true)
    act('stir', 500)
    later(() => { setSplash(n => n + 1); sfx.pop() }, 480)
  }
  const letterOut = (fromEl, char) => {
    fly(fromEl, mouthRef.current, char, false)
    later(() => { sfx.burp(); setCough(true); act('cough', 800) }, 480)
    later(() => setCough(false), 1300)
  }
  const wordDone = () => {
    sfx.tada()
    if (Math.random() < 0.35) {
      act(Math.random() < 0.5 ? 'hat' : 'cheer', 1300)
      later(() => { sfx.burp(); setSplash(n => n + 1) }, 1300)
    } else act('cheer', 1200)
    later(() => sfx.boing(), 1150)
  }
  const tickle = () => { sfx.giggle(); act('stir', 500) }
  const stir = () => { sfx.pop(); setSplash(n => n + 1) }
  return { lumi, cough, splash, fliers, mouthRef, letterIn, letterOut, wordDone, tickle, stir }
}

/** The word in the steam: one bubble per letter, the next one waiting. */
function Slots({ word, typed, nudge }) {
  const n = word.length
  return (
    <div role="img" aria-label={nameOf(word)} data-word={word}
      style={{ display:'flex', justifyContent:'center', gap:6, width:'100%', maxWidth:580, flexShrink:0 }}>
      {word.split('').map((ch, i) => {
        const isTyped = i < typed, isCurrent = i === typed
        return (
          <motion.div key={`${i}-${isTyped}`}
            initial={isTyped ? { scale: 0.4, y: 30 } : false}
            animate={isTyped ? { scale: 1, y: 0 }
              : isCurrent && nudge ? { x: [0, -6, 6, -4, 0], scale: 1 }
              : isCurrent ? { scale: [1, 1.1, 1] } : { scale: 1 }}
            transition={isTyped ? { delay: 0.45, type: 'spring', stiffness: 400, damping: 14 }
              : isCurrent && !nudge ? { duration: 1, repeat: Infinity } : { duration: 0.35 }}
            style={{
              width: `min(58px, calc((100% - ${(n - 1) * 6}px) / ${n}))`, aspectRatio: '1', borderRadius: '50%',
              display:'flex', alignItems:'center', justifyContent:'center', boxSizing:'border-box',
              fontFamily:'var(--font-heading)', fontWeight:800, fontSize:'clamp(18px,4.4vw,30px)', color: INK,
              background: isTyped ? '#ffd34d' : isCurrent ? 'rgba(255,253,247,0.95)' : 'rgba(255,253,247,0.35)',
              border: isTyped ? `3px solid ${INK}` : isCurrent ? '3px dashed #ffb020' : '3px solid rgba(255,253,247,0.6)',
              boxShadow: isTyped ? '0 0 14px rgba(255,211,77,0.8), inset 0 -4px 0 rgba(0,0,0,0.12)' : 'none',
            }}>
            {i <= typed ? ch : ''}
          </motion.div>
        )
      })}
    </div>
  )
}

/** Lumi, the wish and the cauldron, side by side. */
function KesselStage({ word, typed, done, k, lumiSize, potW }) {
  return (
    // the wish over Lumi's hat stands higher than the cauldron: room for it
    <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center', gap:'clamp(10px,3vw,44px)', flexShrink:0,
      marginTop: Math.max(0, lumiSize * 2.15 - potW * 0.92) }}>
      <WitchLumi size={lumiSize} act={k.lumi.act} beat={k.lumi.beat} onTap={k.tickle}
        wish={!done && (
          <Wish side="top" size={lumiSize}>
            <motion.div key={word} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type:'spring', stiffness: 300, damping: 12 }}>
              <Art art={WORDS[word]} size={lumiSize * 0.5} />
            </motion.div>
          </Wish>
        )} />
      <div style={{ position:'relative' }}>
        <Cauldron width={potW} brew={BREWS[typed % BREWS.length]}
          cough={k.cough} splash={k.splash} mouthRef={k.mouthRef} onTap={k.stir} />
        {done && <Puff key={'p' + word} size={potW} />}
        {done && <Alive key={'a' + word} art={WORDS[word]} size={potW * 0.62} move={MOVE_OF[word]} />}
      </div>
    </div>
  )
}

// The trail along the top, and the 🔊 to hear the task again
function TopRow({ total, done, onHear, children }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:760, flexShrink:0 }}>
      <div style={{ flex: 1, padding: '2px 6px', borderRadius: 99, background: 'rgba(255,253,247,0.22)' }}>
        <RoundTrail total={total} done={done} walker="🧹" goal="🔮" />
      </div>
      {children}
      <HearOptions items={[onHear()]} label="Aufgabe noch einmal hören" size={52} />
    </div>
  )
}

// Move on once the payoff is over, but never while the help is open
function useAdvance(go, paused) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready || paused) return
    setReady(false)
    go()
  }, [ready, paused, go])
  return useCallback(() => afterNarration(() => setReady(true), { minMs: 1700 }), [])
}

// ─── Falling letters (level >= 4) ───────────────────────────────────────────
// One letter falls from the night sky at a time (always the NEXT letter of
// the word). The child finds it on the keyboard before it is down, and the
// cauldron catches it. Tapping the falling letter itself does not count, so
// the keyboard is what is practised.
function FallingLettersGame({ level, onComplete }) {
  const cfg    = FALLING[level] ?? FALLING[10]
  const paused = usePaused()
  const k      = useKessel()
  const [words]        = useState(() => pickWords(cfg.len, 5))
  const [wIdx,         setWIdx]       = useState(0)
  const [typed,        setTyped]      = useState(0) // # of letters correctly typed for current word
  const [misses,       setMisses]     = useState(0) // wrong keys on the current letter
  const [showHint,     setShowHint]   = useState(false)
  const [lives,        setLives]      = useState(3)
  const [letterY,      setLetterY]    = useState(-10)
  const [ready,        setReady]      = useState(false) // the letter waits until the task is said
  const [completing,   setCompleting] = useState(false)
  const [fizzle,       setFizzle]     = useState(null)  // where the last letter went out
  const tickRef       = useRef(null)
  const starRef       = useRef(null)
  const livesRef      = useRef(3)
  const completingRef = useRef(false)
  // Words typed right at once (no wrong key, no hint, no lost heart): the score
  const firstTryRef   = useRef(0)
  const helpedRef     = useRef(false)
  // Pre-computed random X positions — stable per (wIdx, typed) pair
  const xSeeds = useRef(Array.from({ length: 200 }, () => Math.round(10 + Math.random() * 75)))

  const word       = words[wIdx] ?? ''
  const targetChar = word[typed] ?? ''
  const letterX    = xSeeds.current[(wIdx * 20 + typed) % 200]

  // Keep refs in sync — used inside the interval callback to avoid stale closures
  livesRef.current      = lives
  completingRef.current = completing

  // The task, at the start of every word
  useEffect(() => {
    if (!word) return
    setReady(false)
    sayTask(wIdx === 0 ? firstTask(word, true) : nextTask(word))
    return afterNarration(() => setReady(true), { minMs: 300, maxMs: 9000 })
  }, [wIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextWord = useCallback(() => {
    const nextIdx = wIdx + 1
    if (nextIdx >= words.length) {
      onComplete(result(firstTryRef.current, words.length))
      return
    }
    setWIdx(nextIdx)
    setTyped(0)
    setMisses(0)
    setShowHint(false)
    helpedRef.current = false
    // Hearts belong to one word: a tough word costs that word, not the run.
    setLives(3)
    livesRef.current = 3
    setLetterY(-10)
    setCompleting(false)
    completingRef.current = false
  }, [wIdx, words.length, onComplete])
  const advance = useAdvance(nextWord, paused)

  const finishWord = useCallback((helped, say) => {
    setCompleting(true)
    completingRef.current = true
    if (!helped) firstTryRef.current += 1
    k.wordDone()
    say()
    advance()
  }, [k, advance])

  // A letter reached the ground: it fizzles out, one heart goes, and from now
  // on the key is shown. With all three hearts gone the word is said and
  // conjured anyway, and the next one comes.
  const letterLanded = useCallback(() => {
    const newLives = livesRef.current - 1
    livesRef.current = newLives
    setLives(newLives)
    helpedRef.current = true
    setFizzle({ x: letterX, id: Date.now() })
    sfx.slideDown()
    if (newLives <= 0) {
      setTyped(word.length)
      finishWord(true, () => narrate([{ text: `Das war knifflig! Das Wort heißt ${nameOf(word)}.` }]))
      return
    }
    setShowHint(true)
    narrate([{ text: `Oh, unten! Such ${lookFor(targetChar, word, typed)}.` }])
  }, [word, targetChar, typed, letterX, finishWord])

  // Fall loop
  useEffect(() => {
    clearInterval(tickRef.current)
    if (!ready || completing || paused) return
    tickRef.current = setInterval(() => {
      setLetterY(y => (y + cfg.speed > 105 ? 106 : y + cfg.speed))
    }, 60)
    return () => clearInterval(tickRef.current)
  }, [ready, completing, paused, cfg.speed])

  // Landing is handled outside the state updater: side effects (speech,
  // hearts, ending the word) do not belong in a setState callback.
  useEffect(() => {
    if (letterY > 105 && !completingRef.current) {
      setLetterY(-10)
      letterLanded()
    }
  }, [letterY, letterLanded])

  const handleChar = useCallback((char, el) => {
    if (completingRef.current || !targetChar) return
    if (char !== targetChar) {
      k.letterOut(el, char)
      const n = misses + 1
      setMisses(n)
      helpedRef.current = true
      if (n >= 2) setShowHint(true)
      sayWrong(`Das ist das ${char}. Wir suchen ${lookFor(targetChar, word, typed)}.`)
      return
    }
    // the falling star itself is caught by the cauldron
    k.letterIn(starRef.current ?? el, char)
    const newTyped = typed + 1
    setTyped(newTyped)
    setMisses(0)
    setShowHint(false)
    setLetterY(-10) // drop the next letter from the top
    if (newTyped >= word.length) finishWord(helpedRef.current, () => sayRight(conjured(word)))
    else narrate([{ text: char, rate: 0.9 }])
  }, [targetChar, typed, word, misses, finishWord, k])

  // Physical keyboard
  const rootRef = useRef(null)
  useEffect(() => {
    const onKey = (e) => {
      const c = e.key.toUpperCase()
      if (c.length === 1 && /[A-ZÄÖÜ]/.test(c)) handleChar(c, rootRef.current?.querySelector(`[data-key="${c}"]`))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleChar])

  return (
    <div ref={rootRef} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(8px,1.6vw,18px) clamp(12px,3vw,32px)', gap:'clamp(6px,1.2vw,12px)' }}>
      <TopRow total={words.length} done={wIdx + (completing ? 1 : 0)} onHear={() => nextTask(word)}>
        <div style={{ display:'flex', gap:2 }} aria-label={`${lives} Herzen`}>
          {Array.from({ length: 3 }, (_, i) => (
            <motion.div key={i} animate={{ scale: i < lives ? 1 : 0.7, opacity: i < lives ? 1 : 0.25 }}>
              <Art art="❤️" size={30} style={{ filter: i < lives ? undefined : 'grayscale(1)' }} />
            </motion.div>
          ))}
        </div>
      </TopRow>

      {/* The night sky the letters fall through. Only to look at: the answer
          is on the keyboard. */}
      <div aria-hidden="true" style={{ position:'relative', width:'100%', maxWidth:740, flex:1, minHeight:140 }}>
        {!completing && targetChar && (
          <motion.div ref={starRef}
            key={`${wIdx}-${typed}`}
            style={{
              position:'absolute', left: letterX + '%', top: `calc(${Math.max(0, letterY)}% - ${letterY / 100 * 64}px)`,
              width:64, height:64, marginLeft:-32, borderRadius:'50%',
              background:'radial-gradient(circle at 40% 35%, #fff6c2, #ffd34d 60%, #ffb020)',
              border:`3px solid ${INK}`, boxShadow:'0 0 24px 8px rgba(255,211,77,0.6)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--font-heading)', fontSize:36, fontWeight:800, color:INK,
              pointerEvents:'none', userSelect:'none',
            }}
            initial={{ scale:0, opacity:0 }}
            animate={{ scale:1, opacity:1, rotate:[-8, 8] }}
            transition={{ rotate: { duration: 0.9, repeat: Infinity, repeatType: 'reverse' } }}
          >
            {targetChar}
          </motion.div>
        )}
        <AnimatePresence>
          {fizzle && (
            <motion.div key={fizzle.id} initial={{ scale: 0.3, opacity: 1 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 0.8 }}
              onAnimationComplete={() => setFizzle(null)}
              style={{ position:'absolute', left: fizzle.x + '%', bottom: 0, width: 50, height: 30, marginLeft: -25, borderRadius: '50%', background: 'rgba(255,253,247,0.7)' }} />
          )}
        </AnimatePresence>
      </div>

      <Slots word={word} typed={typed} nudge={misses > 0} />
      <KesselStage word={word} typed={typed} done={completing} k={k} lumiSize={90} potW={190} />

      {/* On-screen keyboard (no ⌫: a typed letter is always right) */}
      <Keyboard word={word} hint={showHint && !completing ? targetChar : null} onKey={handleChar} />
      {k.fliers}
    </div>
  )
}

// ─── Static word typer (levels 1–3) ──────────────────────────────────────────
function StaticTyperGame({ level, onComplete }) {
  const paused   = usePaused()
  const narrow   = useNarrow()
  const k        = useKessel()
  const [words]  = useState(() => pickWords(STATIC_LEN[level] ?? STATIC_LEN[1], 6))
  const [wIdx,   setWIdx]   = useState(0)
  const [typed,  setTyped]  = useState('')
  const [misses, setMisses] = useState(0)
  const [hintOn, setHintOn] = useState(false)
  // Words typed right at once (no wrong key, no spotlight): the score
  const firstTryRef = useRef(0)
  const helpedRef   = useRef(false)
  const rootRef     = useRef(null)

  const word      = words[wIdx] ?? ''
  const nextChar  = word[typed.length]
  const finished  = typed.length === word.length

  // The hint is per letter: every letter starts unaided, so the child has to
  // find it on the keyboard themselves at least once.
  useEffect(() => { setMisses(0); setHintOn(false) }, [typed.length, wIdx])
  useEffect(() => { if (hintOn) helpedRef.current = true }, [hintOn])

  // ...but a child who simply doesn't know the letter must not be stranded,
  // so the spotlight also comes on by itself after a while.
  useEffect(() => {
    if (finished || hintOn || paused) return
    const id = setTimeout(() => {
      setHintOn(true)
      narrate([{ text: `Such ${anlaut(nextChar)}!` }])
    }, 10000)
    return () => clearTimeout(id)
  }, [typed.length, wIdx, finished, hintOn, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKey = useCallback((key, el) => {
    if (finished) return
    if (key === nextChar) {
      k.letterIn(el, key)
      setTyped(t => t + key)
      if (typed.length + 1 < word.length) narrate([{ text: anlaut(key), rate: 0.9 }])
    } else {
      k.letterOut(el, key)
      const n = misses + 1
      setMisses(n)
      helpedRef.current = true
      if (n >= 2) setHintOn(true)
      sayWrong(`Das ist ${anlaut(key)}. Wir suchen ${anlaut(nextChar)}.`)
    }
  }, [finished, nextChar, typed, word, misses, k])

  const backspace = useCallback(() => setTyped(t => t.slice(0, -1)), [])

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e) => {
      const c = e.key.toUpperCase()
      if (c === 'BACKSPACE') { backspace(); return }
      if (c.length === 1 && /[A-ZÄÖÜ]/.test(c)) handleKey(c, rootRef.current?.querySelector(`[data-key="${c}"]`))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleKey, backspace])

  // The task, at the start of every word
  useEffect(() => {
    if (!word) return
    helpedRef.current = false
    sayTask(wIdx === 0 ? firstTask(word, false) : nextTask(word))
  }, [wIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextWord = useCallback(() => {
    if (wIdx + 1 >= words.length) {
      onComplete(result(firstTryRef.current, words.length))
    } else {
      setWIdx(i => i + 1)
      setTyped('')
    }
  }, [wIdx, words.length, onComplete])
  const advance = useAdvance(nextWord, paused)

  // Word complete: puff, the thing comes alive, and the next word once it
  // has been said
  useEffect(() => {
    if (!finished) return
    if (!helpedRef.current) firstTryRef.current += 1
    k.wordDone()
    sayRight(conjured(word))
    return advance()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-between',
      padding:'clamp(8px,1.6vw,18px) clamp(12px,3vw,32px)', gap:'clamp(8px,1.4vw,14px)',
    }}>
      <TopRow total={words.length} done={wIdx + (finished ? 1 : 0)} onHear={() => nextTask(word)} />

      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end', gap:8, width:'100%' }}>
        <Slots word={word} typed={typed.length} nudge={misses > 0} />
        <KesselStage word={word} typed={typed.length} done={finished} k={k} lumiSize={narrow ? 86 : 120} potW={narrow ? 196 : 250} />
      </div>

      <Keyboard word={word} hint={hintOn && !finished ? nextChar : null} onKey={handleKey} onBack={backspace} pictures />
      {k.fliers}
    </div>
  )
}

export default function TyperGame({ level = 1, onComplete }) {
  if (level >= 4) return <FallingLettersGame level={level} onComplete={onComplete} />
  return <StaticTyperGame level={level} onComplete={onComplete} />
}
