import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { pxCard, pxPanel, pxBubble, pxButton, pxSegment, INK } from './px.js'

/**
 * Hörabenteuer — Phonologisches Bewusstsein
 * Scientific basis:
 *   • Phonological Awareness (National Reading Panel, 2000) — connecting spoken words to images
 *     is the single strongest predictor of reading readiness.
 *   • Dual Coding Theory (Paivio, 1990) — audio + visual encoding deepens memory traces.
 *   • Peabody Picture Vocabulary Test methodology — hear a word, find the matching picture.
 */

// The play button pulses until the word was heard: its pixel drop plus a
// gold ring, instead of the old soft coral glow.
const PLAY_SHADOW       = pxButton('gold').boxShadow
const PLAY_SHADOW_PULSE = `${PLAY_SHADOW}, 0 0 0 6px rgba(255,201,60,0.55)`
const NEXT_BTN          = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.4)' }

// [article, word, picture]. Every picture shows one thing a child names the
// same way; the wrong answers are other words of this list, so each one has
// a name Lumi can say after a wrong tap ("Das ist der Hai.").
const BANK = {
  tier: [
    ['der','Hund','🐕'], ['die','Katze','🐱'], ['das','Pferd','🐴'], ['die','Kuh','🐄'], ['das','Schaf','🐑'],
    ['das','Schwein','🐖'], ['der','Löwe','🦁'], ['der','Tiger','🐯'], ['der','Bär','🐻'], ['der','Fuchs','🦊'],
    ['der','Elefant','🐘'], ['die','Giraffe','🦒'], ['der','Affe','🐒'], ['der','Pinguin','🐧'], ['die','Eule','🦉'],
    ['der','Frosch','🐸'], ['die','Schildkröte','🐢'], ['die','Biene','🐝'], ['der','Schmetterling','🦋'],
    ['die','Schnecke','🐌'], ['das','Krokodil','🐊'], ['der','Delfin','🐬'], ['der','Hai','🦈'], ['der','Fisch','🐟'],
    ['der','Igel','🦔'], ['der','Regenwurm','🪱'],
  ],
  essen: [
    ['der','Apfel','🍎'], ['die','Banane','🍌'], ['die','Erdbeere','🍓'], ['die','Pizza','🍕'], ['der','Kuchen','🎂'],
    ['das','Eis','🍦'], ['das','Brot','🍞'], ['der','Keks','🍪'], ['die','Milch','🥛'], ['der','Saft','🧃'],
    ['die','Karotte','🥕'], ['die','Tomate','🍅'],
  ],
  ding: [
    ['der','Ball','⚽'], ['das','Buch','📚'], ['die','Schere','✂️'], ['der','Stuhl','🪑'], ['das','Bett','🛏️'],
    ['die','Krone','👑'], ['das','Geschenk','🎁'], ['die','Brille','👓'], ['die','Gitarre','🎸'], ['der','Koffer','🧳'],
    ['die','Kerze','🕯️'], ['der','Schlüssel','🔑'], ['die','Trommel','🥁'], ['der','Anker','⚓'], ['der','Zauberstab','🪄'],
    ['der','Diamant','💎'], ['der','Hut','🎩'], ['der','Eimer','🪣'], ['der','Kompass','🧭'], ['der','Drache','🐉'],
  ],
  fahrzeug: [
    ['die','Rakete','🚀'], ['der','Zug','🚂'], ['das','Auto','🚗'], ['das','Flugzeug','✈️'], ['das','Schiff','🚢'],
    ['das','Fahrrad','🚲'], ['der','Traktor','🚜'], ['die','Straßenbahn','🚊'], ['der','Hubschrauber','🚁'], ['der','Bus','🚌'],
  ],
  natur: [
    ['die','Sonne','☀️'], ['der','Mond','🌙'], ['der','Stern','⭐'], ['der','Regenbogen','🌈'], ['die','Blume','🌸'],
    ['der','Baum','🌳'], ['der','Pilz','🍄'], ['die','Welle','🌊'], ['der','Vulkan','🌋'], ['das','Haus','🏠'],
    ['das','Schloss','🏰'], ['das','Zelt','⛺'],
  ],
}
const item = (cat) => ([art, word, emoji]) => ({ art, word, emoji, cat })
const WORD_BANK = Object.entries(BANK).flatMap(([cat, list]) => list.map(item(cat)))

// Never wrong answers for each other: a shark is a fish, too, and a child
// may well call a cake a biscuit.
const CLOSE = [['Fisch','Hai','Delfin'], ['Kuchen','Keks'], ['Milch','Saft'], ['Haus','Schloss','Zelt'], ['Zug','Straßenbahn']]
const isClose = (a, b) => CLOSE.some(g => g.includes(a) && g.includes(b))

// Words that differ in a single sound. Picking between these is the one
// thing that really needs close listening — the ordinary rounds vary
// meaning, not sound, and can be won on vocabulary alone.
const MINIMAL_SETS = [
  [['das','Haus','🏠'], ['die','Maus','🐭'], ['der','Mais','🌽']],
  [['die','Nase','👃'], ['der','Hase','🐰'], ['die','Vase','🏺']],
  [['die','Rose','🌹'], ['die','Hose','👖'], ['die','Dose','🥫']],
  [['die','Kanne','🫖'], ['die','Tanne','🌲'], ['die','Pfanne','🍳']],
  [['der','Mond','🌙'], ['der','Mund','👄'], ['der','Hund','🐕']],
  [['das','Bein','🦵'], ['das','Schwein','🐖'], ['der','Stein','🪨']],
  [['die','Katze','🐱'], ['die','Tatze',':px-tatze:']],
  [['die','Kuh','🐄'], ['der','Schuh','👟']],
  [['der','Fisch','🐟'], ['der','Tisch',':px-tisch:']],
  [['der','Hahn','🐓'], ['der','Zahn','🦷']],
  [['die','Tasse','☕'], ['die','Tasche','👜']],
  [['der','Wal','🐋'], ['der','Schal','🧣']],
].map(set => set.map(item('paar')))
const PAIR_WORDS = new Set(MINIMAL_SETS.flat().map(w => w.word))

// The steps: pictures from different areas, then from the same area (Hund
// or Katze?), then words that differ in a single sound (Haus, Maus, Mais),
// at last reading — the picture is shown, the word must be read.
// `minimal`: every third round (some) or two of three (most).
const LEVELS = [
  { options:3 },
  { options:4 },
  { options:4, sameCat:true },
  { options:4, sameCat:true, minimal:'some' },
  { options:4, sameCat:true, minimal:'some' },
  { options:3, sameCat:true, minimal:'most' },
  { options:3, sameCat:true, minimal:'most' },
  { options:4, read:true },
  { options:4, read:true, sameCat:true },
  { options:3, read:true, minimal:'all' },
]
const ROUNDS = 8

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

function buildRounds(level) {
  const cfg = LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))]
  // With sound-pair rounds in play, their words stay out of the others, so
  // no word comes up twice in one level.
  const base = shuffle(WORD_BANK.filter(w => !cfg.minimal || !PAIR_WORDS.has(w.word)))
  const sets = shuffle(MINIMAL_SETS)
  const isMinimal = i => cfg.minimal === 'all' || (cfg.minimal === 'most' ? i % 3 !== 0 : cfg.minimal === 'some' && i % 3 === 2)

  const fill = (target, taken, n) => {
    const free = WORD_BANK.filter(w => w.word !== target.word && !(cfg.minimal && PAIR_WORDS.has(w.word))
      && !isClose(w.word, target.word) && !taken.some(t => t.word === w.word || isClose(t.word, w.word)))
    const same  = free.filter(w => w.cat === target.cat)
    const other = free.filter(w => w.cat !== target.cat)
    return (cfg.sameCat ? [...shuffle(same), ...shuffle(other)] : shuffle(other)).slice(0, n)
  }

  let next = 0
  return Array.from({ length: ROUNDS }, (_, i) => {
    if (isMinimal(i)) {
      const set = sets[i % sets.length]
      const target = shuffle(set)[0]
      const extra = cfg.options > set.length ? fill(target, set, cfg.options - set.length) : []
      return { target, options: shuffle([...set, ...extra]), pair: true }
    }
    const target = base[next++ % base.length]
    return { target, options: shuffle([target, ...fill(target, [target], cfg.options - 1)]) }
  })
}

const the = w => `${w.art} ${w.word}`
const The = w => the(w)[0].toUpperCase() + the(w).slice(1)

export default function ListenGame({ level = 1, onComplete }) {
  const isReading = !!LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))].read
  const paused = usePaused()

  const [rounds]     = useState(() => buildRounds(level))
  const [idx,        setIdx]        = useState(0)
  const [solved,     setSolved]     = useState(false)
  const [wrongPicks, setWrongPicks] = useState([])  // this round's failed taps
  const [mood,       setMood]       = useState('happy')
  const [played,     setPlayed]     = useState(false)
  const [firstTry,   setFirstTry]   = useState(0)
  const [leaving,    setLeaving]    = useState(false)

  const round   = rounds[idx]
  const current = round?.target

  const sayWord = useCallback(() => {
    if (!current) return
    narrate([{ text: current.word, rate: 0.72, pitch: 1.1 }])
    setPlayed(true)
  }, [current])

  // Reading levels never say the word before it is answered — otherwise
  // they would be one more listening task, not reading.
  const sayTask = useCallback(() => {
    if (!current) return
    if (isReading) narrate([{ text: 'Welches Wort passt zum Bild? Lies genau.' }])
    else narrate([
      { text: idx === 0 ? 'Hör gut zu und tippe auf das Bild.' : 'Tippe auf das Bild.' },
      { text: current.word, rate: 0.72, pitch: 1.1, gap: 200 },
    ])
    setPlayed(true)
  }, [current, idx, isReading])

  useEffect(() => { lockPreviews(); return () => stopNarration() }, [])

  // Round start, and again after the help dialog was closed.
  useEffect(() => {
    if (paused || solved) return
    const t = setTimeout(sayTask, 550)
    return () => clearTimeout(t)
  }, [idx, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (opt) => {
    if (solved || !current || wrongPicks.includes(opt.word)) return
    if (opt.word === current.word) {
      if (!wrongPicks.length) setFirstTry(n => n + 1)
      setSolved(true)
      setMood('excited')
      sfx.correct()
      sayRight(`${The(current)}.`)
      return
    }
    // A wrong tap can be corrected; after the second one Lumi shows the
    // right picture instead of letting the child guess on.
    const misses = [...wrongPicks, opt.word]
    setWrongPicks(misses)
    setMood('encouraging')
    sfx.wrong()
    if (misses.length >= 2) {
      narrate([{ text: isReading ? `Schau mal, hier steht ${current.word}.` : `Schau mal, das ist ${the(current)}.` }])
      setSolved(true)
    } else {
      sayWrong(isReading ? `Da steht ${opt.word}.` : `Das ist ${the(opt)}. Hör noch mal, ${current.word}.`)
      setTimeout(() => setMood('happy'), 1100)
    }
  }

  const weiterClick = () => {
    if (leaving) return
    if (idx + 1 >= rounds.length) {
      setLeaving(true)
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry, rounds.length)), { minMs: 300 })
    } else {
      lockPreviews()
      setSolved(false); setWrongPicks([]); setMood('happy'); setPlayed(false)
      setIdx(i => i + 1)
    }
  }

  if (!current) return null
  const options = round.options
  const cols = options.length === 4 ? 2 : options.length

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly',
      padding: 'clamp(16px,3vw,32px) clamp(16px,4vw,40px)',
      gap: 'clamp(12px,2vh,22px)',
    }}>

      {/* Progress */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:680 }}>
        {rounds.map((_, i) => (
          <div key={i} style={{
            flex:1, ...pxSegment(i < idx || (i === idx && solved) ? 'done' : i === idx ? 'current' : 'todo'),
            transition:'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + bubble */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:14, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={mood} size={80} />
        <div style={{
          flex:1, ...pxBubble,
          padding:'14px 22px',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(18px,3.8vw,26px)',
          color:INK,
        }}>
          {isReading ? 'Welches Wort passt zum Bild? 📝' : 'Welches Bild passt zum Wort? 🖼️'}
        </div>
      </div>

      {/* Play button: the word (pictures), the task again (reading) */}
      <motion.button
        whileHover={{ scale:1.06 }} whileTap={{ scale:0.93 }}
        onClick={isReading ? sayTask : sayWord}
        animate={!played
          ? { scale:[1,1.08,1], boxShadow:[PLAY_SHADOW, PLAY_SHADOW_PULSE, PLAY_SHADOW] }
          : {}}
        transition={!played ? { duration:1.4, repeat:Infinity } : {}}
        aria-label={isReading ? 'Aufgabe noch einmal anhören' : 'Wort anhören'}
        style={{
          ...pxButton('gold'),
          padding:'14px clamp(28px,5vw,56px)', minHeight:60,
          fontSize:'clamp(20px,4.5vw,30px)',
          fontWeight:600,
          display:'flex', alignItems:'center', gap:14,
        }}
      >
        🔊 {isReading ? 'Nochmal' : 'Anhören!'}
      </motion.button>

      {/* READING: big picture + word buttons */}
      {isReading && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, width:'100%', maxWidth:560 }}>
          <motion.div
            key={idx}
            initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
            style={{
              fontSize:'clamp(90px,18vw,140px)', lineHeight:1, minHeight:'1em',
              ...pxPanel, padding:'22px 44px',
            }}
          >{current.emoji}</motion.div>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${cols}, minmax(0, 1fr))`, gap:12, width:'100%' }}>
            {options.map(opt => {
              const isAns   = opt.word === current.word
              const isWrong = wrongPicks.includes(opt.word)
              const live    = !solved && !isWrong
              return (
                <motion.button
                  key={opt.word}
                  whileHover={live ? { scale:1.05 } : {}}
                  whileTap={live ? { scale:0.95 } : {}}
                  animate={{ opacity: isWrong && !solved ? 0.6 : 1 }}
                  onClick={() => pick(opt)}
                  style={{
                    ...pxCard(solved && isAns ? 'right' : isWrong ? 'wrong' : undefined),
                    padding:'14px 10px', minHeight:64,
                    fontFamily:'var(--font-heading)', fontSize:'clamp(18px,3.4vw,24px)',
                    fontWeight:700, cursor:live ? 'pointer' : 'default', color:INK,
                    overflowWrap:'anywhere',
                  }}
                >{opt.word}{solved && isAns ? ' ✅' : ''}</motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* LISTENING: picture grid — two in a row, three in a row, four as 2×2 */}
      {!isReading && (
        <div style={{
          display:'grid', gridTemplateColumns:`repeat(${cols}, minmax(0, 1fr))`,
          gap:'clamp(12px,2.5vw,22px)',
          width:'100%', maxWidth: cols === 3 ? 760 : 600,
        }}>
          {options.map((opt, i) => {
            const isAns   = opt.word === current.word
            const isWrong = wrongPicks.includes(opt.word)
            const live    = !solved && !isWrong
            return (
              <motion.button key={`${idx}-${opt.word}`}
                initial={{ opacity:0, y:18 }}
                animate={{ opacity: isWrong && !solved ? 0.6 : 1, y:0 }}
                transition={{ delay:i*0.07, type:'spring', stiffness:320 }}
                whileHover={live ? { scale:1.05 } : {}}
                whileTap={live ? { scale:0.95 } : {}}
                onClick={() => pick(opt)}
                aria-label={`Bild ${i + 1}`}
                style={{
                  padding:'clamp(16px,3.5vw,30px) 12px',
                  ...pxCard(solved && isAns ? 'right' : isWrong ? 'wrong' : undefined),
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
                  cursor:live ? 'pointer' : 'default',
                  lineHeight:1, minWidth:0,
                }}
              >
                <motion.span
                  animate={solved && isAns ? { scale:[1,1.35,1], rotate:[0,12,-12,0] } : {}}
                  transition={{ duration:0.55 }}
                  style={{ fontSize:'clamp(64px,14vw,100px)', minHeight:'1em' }}
                >
                  {opt.emoji}
                </motion.span>
                <span style={{
                  fontFamily:'var(--font-heading)', fontSize:'clamp(15px,2.9vw,19px)', fontWeight:700, color:'#256B2E',
                  visibility: solved && isAns ? 'visible' : 'hidden',
                }}>{current.word}</span>
              </motion.button>
            )
          })}
        </div>
      )}

      <div style={{ minHeight:64, display:'flex', alignItems:'center' }}>
        {solved && (
          <motion.button
            initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
            transition={{ type:'spring', stiffness:300, delay:0.4 }}
            whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
            onClick={weiterClick}
            {...hearable('Weiter')}
            style={{ ...NEXT_BTN, padding:'14px 40px', minHeight:56, fontSize:20 }}
          >Weiter! →</motion.button>
        )}
      </div>
    </div>
  )
}
