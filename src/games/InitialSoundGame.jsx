import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'

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
 *   • The sound is spoken on its own before the word, so the child works
 *     from the phoneme and not from the whole word's shape.
 */

function speakDE(text, slow = false) {
  speak(text, { rate: slow ? 0.55 : 0.82, pitch: 1.08, lang: 'de-DE' })
}
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Only words whose first sound really is the letter's own sound — no "Chamäleon"
// for C, no silent or shifted starts.
const WORDS = [
  ['A','Apfel','🍎'], ['A','Affe','🐒'], ['B','Ball','⚽'], ['B','Banane','🍌'],
  ['D','Dose','🥫'],  ['D','Drache','🐉'], ['E','Ente','🦆'], ['E','Elefant','🐘'],
  ['F','Fisch','🐟'], ['F','Fuchs','🦊'], ['G','Gabel','🍴'], ['G','Giraffe','🦒'],
  ['H','Hund','🐕'],  ['H','Haus','🏠'], ['I','Igel','🦔'], ['J','Jacke','🧥'],
  ['K','Katze','🐱'], ['K','Krone','👑'], ['L','Löwe','🦁'], ['L','Lampe','💡'],
  ['M','Maus','🐭'],  ['M','Mond','🌙'], ['N','Nase','👃'], ['N','Nest','🪺'],
  ['O','Ohr','👂'],   ['P','Pilz','🍄'], ['P','Pferd','🐴'], ['R','Rose','🌹'],
  ['R','Rakete','🚀'], ['S','Sonne','☀️'], ['S','Socke','🧦'], ['T','Tisch','🪑'],
  ['T','Tiger','🐯'], ['U','Uhr','⏰'], ['V','Vogel','🐦'], ['W','Wolke','☁️'],
  ['W','Wolf','🐺'],  ['Z','Zebra','🦓'], ['Z','Zahn','🦷'],
]

// The bare sound, spoken on its own — same convention as ABC-Abenteuer.
const SOUND = {
  A:'Aaa', B:'Bbb', D:'Ddd', E:'Eee', F:'Fff', G:'Ggg', H:'Hhh', I:'Iii',
  J:'Jjj', K:'Kkk', L:'Lll', M:'Mmm', N:'Nnn', O:'Ooo', P:'Ppp', R:'Rrr',
  S:'Sss', T:'Ttt', U:'Uuu', V:'Fff', W:'Www', Z:'Zzz',
}
const LETTERS = [...new Set(WORDS.map(w => w[0]))]

function buildRounds(level, count = 8) {
  const optionCount = level <= 3 ? 3 : level <= 7 ? 4 : 5
  const pool = shuffle(WORDS)
  return Array.from({ length: count }, (_, i) => {
    const [letter, word, emoji] = pool[i % pool.length]
    const others = shuffle(LETTERS.filter(l => l !== letter)).slice(0, optionCount - 1)
    return { letter, word, emoji, options: shuffle([letter, ...others]) }
  })
}

export default function InitialSoundGame({ level = 1, onComplete }) {
  const rounds = useState(() => buildRounds(level))[0]
  const [idx,    setIdx]    = useState(0)
  const [wrong,  setWrong]  = useState([])
  const [misses, setMisses] = useState(0)
  const [solved, setSolved] = useState(false)
  const [mood,   setMood]   = useState('happy')
  const [showWeiter, setShowWeiter] = useState(false)

  const r = rounds[idx]

  // Sound first, then the word — the child should reason from the phoneme.
  const sayTask = useCallback(() => {
    if (!r) return
    const snd = SOUND[r.letter] ?? r.letter
    speakDE(`${snd}. ${snd}. ${r.word}. Womit fängt ${r.word} an?`, true)
  }, [r])

  useEffect(() => {
    setWrong([]); setSolved(false); setMood('happy')
    const id = setTimeout(sayTask, 450)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((L) => {
    if (solved || !r) return
    if (L !== r.letter) {
      setWrong(w => w.includes(L) ? w : [...w, L])
      setMisses(m => m + 1)
      setMood('encouraging')
      sfx.wrong()
      speakDE(`${SOUND[L] ?? L}. Damit fängt ${r.word} nicht an.`)
      setTimeout(() => setMood('happy'), 1100)
      return
    }
    setSolved(true)
    setMood('excited')
    sfx.correct()
    speakDE(`${SOUND[r.letter]}. ${r.word} fängt mit ${r.letter} an!`)
    setTimeout(() => setShowWeiter(true), 800)
  }, [solved, r])

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= rounds.length) {
      sfx.complete()
      const stars = misses <= 1 ? 3 : misses <= rounds.length ? 2 : 1
      setTimeout(() => onComplete({ score: rounds.length, total: rounds.length, stars }), 300)
    } else setIdx(i => i + 1)
  }

  if (!r) return null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(12px,2vw,20px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {rounds.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < idx ? '#6C63FF' : i === idx ? '#FFD93D' : '#ECE8FF',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={68} />
        <div style={{
          flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px', padding: '12px 18px',
          boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.4vw,22px)', color: 'var(--text-primary)',
        }}>
          {solved
            ? <><strong style={{ color: '#4A00E0' }}>{r.word}</strong> fängt mit <strong style={{ color: '#4A00E0' }}>{r.letter}</strong> an! 🕵️</>
            : <>Womit fängt <strong style={{ color: '#4A00E0' }}>{r.word}</strong> an? 🕵️</>}
        </div>
      </div>

      {/* The word, as a picture */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'white', borderRadius: 26, padding: 'clamp(12px,2.5vw,20px) clamp(26px,7vw,54px)',
        boxShadow: '0 6px 26px rgba(74,0,224,0.14)',
      }}>
        <div style={{ fontSize: 'clamp(58px,14vw,96px)', lineHeight: 1 }}>{r.emoji}</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(20px,4.5vw,30px)', fontWeight: 800, color: '#4A00E0' }}>
          {r.word}
        </div>
        <motion.button
          whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
          onClick={sayTask}
          aria-label="Laut noch einmal anhören"
          style={{
            background: '#F0EEFF', border: '2px solid #A29BFE', borderRadius: 99,
            padding: '5px 16px', cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontSize: 13, color: '#6C63FF',
          }}
        >🔊 Nochmal hören</motion.button>
      </div>

      {/* Letters to choose from */}
      <div style={{ display: 'flex', gap: 'clamp(8px,2.5vw,18px)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {r.options.map(L => {
          const isWrong = wrong.includes(L)
          const isRight = solved && L === r.letter
          return (
            <motion.button key={L}
              whileHover={!solved && !isWrong ? { scale: 1.08 } : {}}
              whileTap={!solved && !isWrong ? { scale: 0.92 } : {}}
              onClick={() => { if (!isWrong) pick(L) }}
              aria-label={`Buchstabe ${L}`}
              style={{
                width: 'clamp(58px,13vw,86px)', height: 'clamp(58px,13vw,86px)',
                borderRadius: 20,
                background: isRight ? '#E8F8EE' : isWrong ? '#FFE8E8' : 'white',
                border: `3.5px solid ${isRight ? '#6BCB77' : isWrong ? '#FF6B6B' : '#ECE8FF'}`,
                fontFamily: 'var(--font-heading)', fontWeight: 800,
                fontSize: 'clamp(28px,6.5vw,44px)',
                color: isWrong ? '#C0392B' : '#4A00E0',
                cursor: solved || isWrong ? 'default' : 'pointer',
                opacity: isWrong ? 0.55 : 1,
                boxShadow: isRight ? '0 6px 24px rgba(107,203,119,0.4)' : '0 4px 16px rgba(0,0,0,0.06)',
              }}
            >{L}</motion.button>
          )
        })}
      </div>

      <AnimatePresence>
        {showWeiter && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={weiterClick}
            style={{
              background: 'linear-gradient(135deg,#6C63FF,#4A00E0)', color: 'white',
              border: 'none', borderRadius: 20, padding: '12px 40px', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.4vw,21px)', fontWeight: 700,
              boxShadow: '0 5px 20px rgba(74,0,224,0.38)',
            }}
          >Weiter! →</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
