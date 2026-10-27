import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { narrate, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { hearable } from '../lib/hearable.js'
import { soundOf } from './letterSounds.js'
import { INK, pxCard, pxPanel, pxBubble, pxSegment } from './px.js'

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
 * Buchstabenwald — Tippen & Schreiben
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

/**
 * The on-screen keyboard. `hint` is the letter that pulses, `onBack` adds ⌫,
 * `pictures` turns it into the Anlauttabelle: each key with its picture,
 * saying its sound on hover and keyboard focus.
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
      <motion.button key={k}
        whileTap={{ scale:0.88 }}
        onClick={() => (back ? onBack() : onKey(k))}
        {...(pic ? hearable(anlaut(k)) : null)}
        aria-label={back ? 'Löschen' : pic ? anlaut(k) : k}
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
        {pic && <span aria-hidden="true" style={{ fontSize:picSize, lineHeight:1 }}>{ANLAUT[k][1]}</span>}
      </motion.button>
    )
  }

  if (narrow) {
    // with pictures the keys grow a little, so letter and picture both stay
    // readable: five 58 px keys fit a 360 px phone
    const size = pictures ? { width:58, height:66, fontSize:22, picSize:22 } : { width:52, height:52, fontSize:24 }
    return (
      <div style={{ display:'flex', flexWrap:'wrap', justifyContent:'center', gap:8, width:'100%', maxWidth:420 }}>
        {keys.map(k => key(k, size))}
        {onBack && key('⌫', size)}
      </div>
    )
  }

  // eleven keys and ten gaps across the widest row
  const size = { width:'min(56px, calc((100% - 50px) / 11))', height: pictures ? 66 : 56,
                 fontSize:'clamp(17px,2.4vw,22px)', picSize:'clamp(19px,2.2vw,22px)' }
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%', maxWidth:720 }}>
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

// ─── Falling Letters Arcade (level >= 4) ────────────────────────────────────
// One letter falls at a time (always the NEXT letter of the word). The child
// has to find it on the keyboard before it lands. Tapping the falling tile
// itself used to count as the answer, so the keyboard was never needed.
function FallingLettersGame({ level, onComplete }) {
  const cfg    = FALLING[level] ?? FALLING[10]
  const paused = usePaused()
  const [words]        = useState(() => pickWords(cfg.len, 5))
  const [wIdx,         setWIdx]       = useState(0)
  const [typed,        setTyped]      = useState(0) // # of letters correctly typed for current word
  const [solved,       setSolved]     = useState(0) // words done so far, for the counter
  const [misses,       setMisses]     = useState(0) // wrong keys on the current letter
  const [showHint,     setShowHint]   = useState(false)
  const [lives,        setLives]      = useState(3)
  const [letterY,      setLetterY]    = useState(-10)
  const [mood,         setMood]       = useState('happy')
  const [ready,        setReady]      = useState(false) // the letter waits until the task is said
  const [completing,   setCompleting] = useState(false)
  const [missAnim,     setMissAnim]   = useState(false)
  const tickRef       = useRef(null)
  const livesRef      = useRef(3)
  const completingRef = useRef(false)
  // Words typed right at once (no wrong key, no hint, no lost heart): the score
  const firstTryRef   = useRef(0)
  const helpedRef     = useRef(false)
  // Pre-computed random X positions — stable per (wIdx, typed) pair
  const xSeeds = useRef(Array.from({ length: 200 }, () => Math.round(10 + Math.random() * 65)))

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
    sayTask(wIdx === 0
      ? `Schreib das Wort ${nameOf(word)}! Die Buchstaben fallen herunter. Tipp sie auf der Tastatur, bevor sie unten sind.`
      : `Jetzt das Wort ${nameOf(word)}.`)
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
    setMood('happy')
  }, [wIdx, words.length, onComplete])

  const finishWord = useCallback((helped, say) => {
    setCompleting(true)
    completingRef.current = true
    setSolved(s => s + 1)
    if (!helped) firstTryRef.current += 1
    say()
    afterNarration(nextWord, { minMs: 900 })
  }, [nextWord])

  // A letter reached the floor: one heart, and from now on the key is shown.
  // With all three hearts gone the word is read out and the next one comes —
  // before, this was a game over that the child could only leave by quitting
  // (and the call that should have ended it crashed).
  const letterLanded = useCallback(() => {
    const newLives = livesRef.current - 1
    livesRef.current = newLives
    setLives(newLives)
    helpedRef.current = true
    setMissAnim(true)
    setMood('encouraging')
    setTimeout(() => { setMissAnim(false); setMood('happy') }, 600)
    sfx.wrong()
    if (newLives <= 0) {
      setTyped(word.length)
      finishWord(true, () => narrate([{ text: `Das war knifflig! Das Wort heißt ${nameOf(word)}.` }]))
      return
    }
    setShowHint(true)
    narrate([{ text: `Oh, unten! Such ${lookFor(targetChar, word, typed)}.` }])
  }, [word, targetChar, typed, finishWord])

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

  const handleChar = useCallback((char) => {
    if (completingRef.current || !targetChar) return
    if (char !== targetChar) {
      sfx.wrong()
      setMood('encouraging')
      setTimeout(() => setMood('happy'), 400)
      const n = misses + 1
      setMisses(n)
      helpedRef.current = true
      if (n >= 2) setShowHint(true)
      sayWrong(`Das ist das ${char}. Wir suchen ${lookFor(targetChar, word, typed)}.`)
      return
    }
    sfx.correct()
    const newTyped = typed + 1
    setTyped(newTyped)
    setMisses(0)
    setShowHint(false)
    setLetterY(-10) // drop the next letter from the top
    if (newTyped >= word.length) {
      setMood('excited')
      finishWord(helpedRef.current, () => sayRight(`${nameOf(word)}!`))
    } else {
      setMood('excited')
      setTimeout(() => setMood('happy'), 400)
      narrate([{ text: char, rate: 0.9 }])
    }
  }, [targetChar, typed, word, misses, finishWord])

  // Physical keyboard
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toUpperCase()
      if (k.length === 1 && /[A-ZÄÖÜ]/.test(k)) handleChar(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleChar])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(10px,2vw,22px) clamp(12px,3vw,32px)', gap:'clamp(10px,1.5vw,18px)' }}>

      {/* HUD */}
      <div style={{ display:'flex', gap:12, width:'100%', maxWidth:720, justifyContent:'space-between', alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {words.map((_, i) => (
            <div key={i} style={{ flex:1, width:28, ...pxSegment(i < wIdx ? 'done' : i === wIdx ? 'current' : 'todo'), transition:'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }} aria-label={`${lives} Herzen`}>
          {Array.from({length:3}).map((_,i) => (
            <span key={i} style={{ fontSize:22, filter: i < lives ? 'none' : 'grayscale(1) opacity(0.28)' }}>❤️</span>
          ))}
        </div>
        <div style={{ fontFamily:'var(--font-heading)', fontSize:16, color:INK, ...pxCard(), padding:'6px 16px' }}>
          {`✅ ${solved} von ${words.length}`}
        </div>
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:720 }}>
        <LumiCharacter mood={mood} size={72} />
        <div style={{ flex:1, ...pxBubble, padding:'12px 18px', fontFamily:'var(--font-heading)', fontSize:'clamp(15px,3.2vw,22px)', color:'var(--text-primary)' }}>
          {showHint ? `💡 Such das ${targetChar} auf der Tastatur!` : 'Tipp den Buchstaben, bevor er unten ist! ⌨️'}
        </div>
      </div>

      {/* What word is being built */}
      <div style={{ height:'clamp(44px,9vw,64px)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <motion.span key={word}
          initial={{ scale:0.6, opacity:0 }} animate={{ scale:1, opacity:1 }}
          style={{ fontSize:'clamp(38px,8vw,58px)', lineHeight:1,
                   filter:'drop-shadow(0 4px 0 rgba(42,27,61,0.25))' }}>
          {WORDS[word]}
        </motion.span>
      </div>

      {/* Word progress display */}
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        {word.split('').map((ch, i) => (
          <div key={i} style={{
            width:'clamp(32px,6vw,52px)', height:'clamp(38px,7vw,60px)',
            ...pxCard(i < typed ? 'right' : i === typed ? 'selected' : undefined),
            display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.5vw,26px)', fontWeight:700,
            color: i < typed ? '#1F6B2A' : i === typed ? INK : 'var(--px-ink-soft)',
            transition:'all 0.2s',
          }}>{i <= typed ? ch : '_'}</div>
        ))}
      </div>

      {/* Falling arena */}
      <div style={{
        position:'relative', width:'100%', maxWidth:720,
        // bounded by the height too, so the keyboard below keeps full-size keys
        height:'clamp(200px, min(42vw, 36vh), 360px)',
        background: missAnim
          ? 'linear-gradient(180deg,#33001a,#660033 65%,#CC0044)'
          : 'linear-gradient(180deg,#1b1230,#2e1f55 65%,#4b3486)',
        border:`3px solid ${INK}`, borderRadius:14, overflow:'hidden', flexShrink:0,
        boxShadow:'inset 0 -6px 0 rgba(0,0,0,0.25), 0 5px 0 rgba(42,27,61,0.35)',
        transition:'background 0.35s',
      }}>
        {/* Stars */}
        {Array.from({length:18}).map((_,i) => (
          <div key={i} style={{ position:'absolute', borderRadius:1, width: 2 + i%3, height: 2 + i%3, background:'white', opacity:0.3 + (i%4)*0.1, left: `${(i * 17 + 5) % 95}%`, top: `${(i * 23 + 8) % 90}%` }} />
        ))}
        {/* Floor */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:28, background:'rgba(255,80,80,0.22)', borderTop:'2px solid rgba(255,80,80,0.55)' }} />

        {/* The single falling letter — only to look at; the answer is on the keyboard */}
        {!completing && targetChar && (
          <motion.div
            key={`${wIdx}-${typed}`}
            aria-hidden
            style={{
              position:'absolute',
              left: letterX + '%',
              top:  letterY + '%',
              transform:'translate(-50%,-50%)',
              width:'clamp(48px,10vw,72px)', height:'clamp(48px,10vw,72px)',
              borderRadius:12,
              background:'var(--px-gold)',
              border:`3px solid ${INK}`,
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--font-heading)', fontSize:'clamp(24px,5.5vw,40px)', fontWeight:800,
              color:INK, textShadow:'0 2px 0 rgba(255,255,255,0.45)',
              boxShadow:'inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -5px 0 rgba(0,0,0,0.22), 0 5px 0 rgba(0,0,0,0.45)',
              pointerEvents:'none', userSelect:'none',
            }}
            initial={{ scale:0, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
          >
            {targetChar}
          </motion.div>
        )}
      </div>

      {/* On-screen keyboard (no ⌫: a typed letter is always right) */}
      <Keyboard word={word} hint={showHint && !completing ? targetChar : null} onKey={handleChar} />
    </div>
  )
}

// ─── Static word typer (levels 1–3) ──────────────────────────────────────────
function StaticTyperGame({ level, onComplete }) {
  const paused   = usePaused()
  const [words]  = useState(() => pickWords(STATIC_LEN[level] ?? STATIC_LEN[1], 6))
  const [wIdx,   setWIdx]   = useState(0)
  const [typed,  setTyped]  = useState('')
  const [shake,  setShake]  = useState(false)
  const [correct, setCorrect] = useState(0)
  const [mood,   setMood]   = useState('happy')
  const [misses, setMisses] = useState(0)
  const [hintOn, setHintOn] = useState(false)
  // Words typed right at once (no wrong key, no spotlight): the score
  const firstTryRef = useRef(0)
  const helpedRef   = useRef(false)

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

  const handleKey = useCallback((k) => {
    if (finished) return
    if (k === nextChar) {
      sfx.correct()
      setTyped(t => t + k)
      if (typed.length + 1 < word.length) narrate([{ text: anlaut(k), rate: 0.9 }])
    } else {
      sfx.wrong()
      setShake(true)
      setMood('encouraging')
      setTimeout(() => { setShake(false); setMood('happy') }, 500)
      const n = misses + 1
      setMisses(n)
      helpedRef.current = true
      if (n >= 2) setHintOn(true)
      sayWrong(`Das ist ${anlaut(k)}. Wir suchen ${anlaut(nextChar)}.`)
    }
  }, [finished, nextChar, typed, word, misses])

  const backspace = useCallback(() => setTyped(t => t.slice(0, -1)), [])

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toUpperCase()
      if (k === 'BACKSPACE') { backspace(); return }
      if (k.length === 1 && /[A-ZÄÖÜ]/.test(k)) handleKey(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleKey, backspace])

  // The task, at the start of every word
  useEffect(() => {
    if (!word) return
    helpedRef.current = false
    sayTask(wIdx === 0
      ? `Schreib das Wort ${nameOf(word)}! Tipp die Buchstaben auf der Tastatur.`
      : `Jetzt das Wort ${nameOf(word)}.`)
  }, [wIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Word complete: praise, and the next word once it has been said
  useEffect(() => {
    if (!finished) return
    setMood('excited')
    setCorrect(c => c + 1)
    if (!helpedRef.current) firstTryRef.current += 1
    sayRight(`${nameOf(word)}!`)
    return afterNarration(() => {
      if (wIdx + 1 >= words.length) {
        onComplete(result(firstTryRef.current, words.length))
      } else {
        setWIdx(i => i + 1)
        setTyped('')
        setMood('happy')
      }
    }, { minMs: 900 })
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(12px,3vw,32px)',
      gap:'clamp(14px,2vw,22px)',
    }}>

      {/* Progress */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:720 }}>
        {words.map((_, i) => (
          <div key={i} style={{
            flex:1, ...pxSegment(i < wIdx ? 'done' : i === wIdx ? 'current' : 'todo'),
            transition:'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + instruction */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={mood} size={88} />
        <div style={{
          flex:1, ...pxBubble,
          padding:'16px 22px',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(18px,3.8vw,26px)',
          color:'var(--text-primary)',
        }}>
          {hintOn && nextChar ? `💡 Such das ${nextChar} ${ANLAUT[nextChar][1]}` : 'Schreib das Wort! 🔤'}
        </div>
      </div>

      {/* Word display */}
      <AnimatePresence mode="wait">
        <motion.div key={wIdx}
          initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
          style={{
            display:'flex', gap:'clamp(6px,1.5vw,12px)',
            padding:'clamp(14px,3vw,24px)',
            ...pxPanel,
            width:'100%', maxWidth:760,
            justifyContent:'center', flexWrap:'wrap', alignItems:'center',
          }}
        >
          <span style={{ fontSize:'clamp(40px,8vw,64px)', lineHeight:1, marginRight:'clamp(4px,1.5vw,12px)' }}>
            {WORDS[word]}
          </span>
          {word.split('').map((ch, i) => {
            const isTyped  = i < typed.length
            const isCurrent = i === typed.length

            return (
              <motion.div key={i}
                animate={isCurrent && shake ? { x:[-6,6,-6,6,0] } : isCurrent ? { scale:[1,1.12,1] } : {}}
                transition={isCurrent && !shake ? { duration:0.7, repeat:Infinity } : { duration:0.3 }}
                style={{
                  width:'clamp(40px,8vw,66px)',
                  height:'clamp(50px,10vw,80px)',
                  ...pxCard(isTyped ? 'right' : isCurrent ? (shake ? 'wrong' : 'selected') : undefined),
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--font-heading)',
                  fontSize:'clamp(22px,5vw,38px)',
                  fontWeight:700,
                  color: isTyped ? '#1F6B2A'
                       : isCurrent ? (shake ? '#C2412D' : INK)
                       : 'var(--px-ink-soft)',
                  transition:'all 0.2s',
                }}
              >
                {isTyped || isCurrent ? ch : '_'}
              </motion.div>
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* Keyboard */}
      <Keyboard word={word} hint={hintOn && !finished ? nextChar : null} onKey={handleKey} onBack={backspace} pictures />

      <p style={{ fontFamily:'var(--font-heading)', fontSize:17, color:'var(--px-ink-soft)' }}>
        ✅ {correct} von {words.length} Wörtern geschafft
      </p>
    </div>
  )
}

export default function TyperGame({ level = 1, onComplete }) {
  if (level >= 4) return <FallingLettersGame level={level} onComplete={onComplete} />
  return <StaticTyperGame level={level} onComplete={onComplete} />
}
