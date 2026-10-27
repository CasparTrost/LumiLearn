import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { soundOf } from './letterSounds.js'
import { pxCard, pxPanel, pxBubble, pxButton, pxSegment, ACCENT, INK } from './px.js'

/**
 * Anlaut-Detektiv — welcher Buchstabe macht diesen Laut?
 *
 * Fills the gap between two existing modules: Hörabenteuer stops at meaning
 * (hear a word, find its picture) and ABC-Abenteuer starts from the letter
 * (see a B, pick a word beginning with it). Neither ever asks the question
 * that actually links sound to writing — which letter makes this sound? —
 * even though that mapping is what reading is built on.
 *
 * Scientific basis:
 *   • Grapheme-phoneme correspondence — isolating a word's first sound and
 *     assigning it a letter is the core skill of alphabetic decoding
 *     (Ehri's phase theory: this is the step into the alphabetic phase).
 *   • The child only sees the picture and hears the word; the written word
 *     appears once the round is solved. Shown beforehand, it could be solved
 *     by matching its first letter without listening at all.
 *   • Letters speak as sounds ("Fff", "Mmm"), never as letter names ("Eff",
 *     "Em") — the name of a letter is not the sound at the start of a word.
 */

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Only words whose first sound really is the letter's own sound, with a
// picture that shows just that word: no Vogel under V (that is an F sound),
// no Pferd (pf), no chair for "Tisch", no light bulb for "Lampe".
const WORDS = [
  ['A','Apfel','🍎'], ['A','Affe','🐒'], ['A','Ameise','🐜'], ['A','Ananas','🍍'],
  ['E','Ente','🦆'],  ['E','Elefant','🐘'], ['E','Esel','🫏'],
  ['I','Igel','🦔'],  ['I','Insel','🏝️'],
  ['O','Ohr','👂'],   ['O','Oma','👵'], ['O','Orange','🍊'],
  ['U','Ufo','🛸'],   ['U','Uhu','🦉'],
  ['M','Maus','🐭'],  ['M','Mond','🌙'], ['M','Milch','🥛'], ['M','Möhre','🥕'],
  ['S','Sonne','☀️'], ['S','Socke','🧦'], ['S','Sofa','🛋️'], ['S','Seife','🧼'],
  ['F','Fisch','🐟'], ['F','Fuchs','🦊'], ['F','Feder','🪶'], ['F','Fuß','🦶'],
  ['L','Löwe','🦁'],  ['L','Leiter','🪜'], ['L','Lama','🦙'],
  ['N','Nase','👃'],  ['N','Nest','🪺'], ['N','Nudeln','🍝'],
  ['R','Rose','🌹'],  ['R','Rakete','🚀'], ['R','Roboter','🤖'],
  ['W','Wolke','☁️'], ['W','Wolf','🐺'], ['W','Wal','🐋'], ['W','Wurm','🪱'],
  ['H','Hund','🐕'],  ['H','Haus','🏠'], ['H','Hase','🐰'], ['H','Hahn','🐓'],
  ['B','Banane','🍌'], ['B','Biene','🐝'], ['B','Bär','🐻'], ['B','Baum','🌳'],
  ['P','Pilz','🍄'],  ['P','Pinguin','🐧'], ['P','Panda','🐼'], ['P','Pinsel','🖌️'],
  ['D','Dose','🥫'],  ['D','Dino','🦖'], ['D','Delfin','🐬'],
  ['T','Tomate','🍅'], ['T','Tiger','🐯'], ['T','Tür','🚪'],
  ['G','Giraffe','🦒'], ['G','Gurke','🥒'], ['G','Geist','👻'], ['G','Geschenk','🎁'],
  ['K','Katze','🐱'], ['K','Koala','🐨'], ['K','Kuh','🐄'], ['K','Käse','🧀'],
  ['Z','Zebra','🦓'], ['Z','Zahn','🦷'], ['Z','Zitrone','🍋'], ['Z','Zelt','⛺'],
  ['J','Jo-Jo','🪀'],
]
const ALL = [...new Set(WORDS.map(w => w[0]))].join('')

// Sounds that are easy to mix up. Kept apart in the early levels, offered
// side by side at the end — telling B from P is the hard part.
const PARTNER = { B:'P', P:'B', D:'T', T:'D', G:'K', K:'G', M:'N', N:'M' }

// The steps: long sounds you can hold (mmm, sss, fff), then the vowels, then
// the short ones (b, d, g …), and last the look-alike pairs.
// `targets` are asked, `extra` letters only appear as wrong answers.
const LEVELS = [
  { targets:'MSF',                              options:3 },
  { targets:'MSFLNR',                           options:3 },
  { targets:'MSFLNRWH',                         options:4 },
  { targets:'AEO',      extra:'MSFL',           options:3 },
  { targets:'AEIOU',    extra:'MSFLNR',         options:4 },
  { targets:'AEIOUMSFLNRWH',                    options:4 },
  { targets:'BDGKPT',   extra:'MSFLNR',         options:4 },
  { targets:'BDGKPTZJ', extra:'AEIOUMSFLNRWH',  options:4 },
  { targets:'BDGKPTMN',                         options:4, pairs:true },
  { targets:ALL,                                options:5, pairs:true },
]

function buildRounds(level, count = 8) {
  const cfg = LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))]
  const targets = shuffle([...cfg.targets])
  const pool = [...new Set([...cfg.targets, ...(cfg.extra ?? '')])]
  const unused = shuffle(WORDS)
  return Array.from({ length: count }, (_, i) => {
    const letter = targets[i % targets.length]
    // a word not seen yet in this level, if this letter still has one
    const at = unused.findIndex(w => w[0] === letter)
    const [, word, emoji] = at >= 0 ? unused.splice(at, 1)[0] : shuffle(WORDS.filter(w => w[0] === letter))[0]
    const partner = PARTNER[letter]
    let others = shuffle(pool.filter(l => l !== letter && l !== partner))
    if (cfg.pairs && partner && pool.includes(partner)) others = [partner, ...others]
    return { letter, word, emoji, options: shuffle([letter, ...others.slice(0, cfg.options - 1)]) }
  })
}

const NEXT_BTN = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.4)' }

export default function InitialSoundGame({ level = 1, onComplete }) {
  const rounds = useState(() => buildRounds(level))[0]
  const paused = usePaused()
  const [idx,      setIdx]      = useState(0)
  const [wrong,    setWrong]    = useState([])
  const [solved,   setSolved]   = useState(false)
  const [mood,     setMood]     = useState('happy')
  const [firstTry, setFirstTry] = useState(0)
  const [leaving,  setLeaving]  = useState(false)

  const r = rounds[idx]

  // The word, then the question. Slower than normal speech, so the first
  // sound can be heard — but not so slow that it drags.
  const sayTask = useCallback(() => {
    if (!r) return
    narrate([{ text: `${r.word}. Mit welchem Laut fängt ${r.word} an?`, rate: 0.75 }])
  }, [r])

  useEffect(() => { lockPreviews(); return () => stopNarration() }, [])

  // Round start, and again after the help dialog was closed.
  useEffect(() => {
    if (paused || solved) return
    const id = setTimeout(sayTask, 450)
    return () => clearTimeout(id)
  }, [idx, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const answer = `${r?.word} fängt mit ${soundOf(r?.letter)} an. Das ist das ${r?.letter}.`

  const pick = useCallback((L) => {
    if (solved || !r || wrong.includes(L)) return
    if (L !== r.letter) {
      const misses = [...wrong, L]
      setWrong(misses)
      setMood('encouraging')
      sfx.wrong()
      if (misses.length >= 2) {
        // After two misses Lumi shows the answer instead of letting the
        // child guess through the rest.
        narrate([{ text: `Hör mal, ${answer}` }])
        setSolved(true)
      } else {
        sayWrong(`Das ist ${soundOf(L)}. Hör noch mal, ${r.word}.`)
        setTimeout(() => setMood('happy'), 1100)
      }
      return
    }
    if (!wrong.length) setFirstTry(n => n + 1)
    setSolved(true)
    setMood('excited')
    sfx.correct()
    sayRight(answer)
  }, [solved, r, wrong, answer])

  const weiterClick = () => {
    if (leaving) return
    if (idx + 1 >= rounds.length) {
      setLeaving(true)
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry, rounds.length)), { minMs: 300 })
    } else {
      lockPreviews()
      setWrong([]); setSolved(false); setMood('happy')
      setIdx(i => i + 1)
    }
  }

  if (!r) return null

  // After solving: the word, its first letter picked out
  const spelled = <><strong style={{ color: ACCENT, fontSize: '1.25em' }}>{r.word[0]}</strong>{r.word.slice(1)}</>

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(12px,2vh,20px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {rounds.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < idx || (i === idx && solved) ? 'done' : i === idx ? 'current' : 'todo'),
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={68} />
        <div style={{
          flex: 1, ...pxBubble, padding: '12px 18px',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(17px,3.4vw,23px)', color: INK,
        }}>
          {solved
            ? <><strong>{r.word}</strong> fängt mit <strong style={{ color: ACCENT }}>{r.letter}</strong> an!</>
            : <>Womit fängt das Wort an? 🕵️</>}
        </div>
      </div>

      {/* The word, as a picture — written only once it is solved */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        ...pxPanel, padding: 'clamp(14px,2.5vw,22px) clamp(30px,8vw,64px)', minWidth: 'min(320px, 80%)',
      }}>
        <motion.div key={idx} initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{ fontSize: 'clamp(100px,22vw,160px)', lineHeight: 1 }}>{r.emoji}</motion.div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52 }}>
          {solved && (
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(24px,5vw,34px)', fontWeight: 800, color: INK }}>
              {spelled}
            </div>
          )}
          <motion.button
            whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={sayTask}
            aria-label="Wort noch einmal anhören"
            style={{ ...pxButton('parch'), width: 52, height: 52, padding: 0, fontSize: 24, lineHeight: 1, flexShrink: 0 }}
          >🔊</motion.button>
        </div>
      </div>

      {/* Letters to choose from */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px,2.5vw,18px)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {r.options.map(L => {
          const isWrong = wrong.includes(L)
          const isRight = solved && L === r.letter
          const live = !solved && !isWrong
          return (
            <motion.button key={L}
              whileHover={live ? { scale: 1.08 } : {}}
              whileTap={live ? { scale: 0.92 } : {}}
              animate={isRight ? { scale: [1, 1.15, 1] } : { scale: 1 }}
              onClick={() => pick(L)}
              // the sound, not the letter's name — that is the whole lesson
              {...hearable(soundOf(L))}
              aria-label={`Buchstabe ${L}`}
              style={{
                width: 'clamp(72px,14vw,104px)', height: 'clamp(72px,14vw,104px)',
                ...pxCard(isRight ? 'right' : isWrong ? 'wrong' : undefined),
                fontFamily: 'var(--font-heading)', fontWeight: 800,
                fontSize: 'clamp(34px,7vw,52px)',
                color: isWrong ? '#A3301F' : ACCENT,
                cursor: live ? 'pointer' : 'default',
                opacity: isWrong ? 0.6 : 1,
              }}
            >{L}</motion.button>
          )
        })}
        <HearOptions items={r.options.map(soundOf)} label="Alle Laute vorlesen" size={52} />
      </div>

      <div style={{ minHeight: 60, display: 'flex', alignItems: 'center' }}>
        <AnimatePresence>
          {solved && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={weiterClick}
              {...hearable('Weiter')}
              style={{ ...NEXT_BTN, padding: '12px 40px', minHeight: 56, fontSize: 'clamp(17px,3.4vw,21px)' }}
            >Weiter! →</motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
