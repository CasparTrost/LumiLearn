import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'

/**
 * Reim-Rallye — hören, was sich reimt
 *
 * Rhyme awareness is among the best-established predictors of later reading,
 * and no module covered it: Hörabenteuer tests vocabulary (which picture is
 * a "Katze"), Silben-Spaß works on syllables, ABC-Abenteuer on letters —
 * none of them on the sound at the end of a word.
 *
 * Scientific basis:
 *   • Rhyme/onset-rime awareness (Bradley & Bryant, 1983; Goswami) — hearing
 *     that Maus and Haus share an ending precedes phoneme-level analysis and
 *     predicts decoding skill years later.
 *   • The task is deliberately picture-based: no reading is required, so it
 *     measures the sound and not the spelling.
 */

function speakDE(text, slow = false) {
  speak(text, { rate: slow ? 0.55 : 0.8, pitch: 1.05, lang: 'de-DE' })
}
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

// Words inside a group rhyme with each other (matching from the stressed
// vowel onward, not merely a shared last letter).
const RHYME_GROUPS = [
  [['Maus','🐭'], ['Haus','🏠']],
  [['Hose','👖'], ['Rose','🌹'], ['Dose','🥫']],
  [['Katze','🐱'], ['Tatze','🐾'], ['Matratze','🛏️']],
  [['Hund','🐕'], ['Mund','👄']],
  [['Baum','🌳'], ['Schaum','🫧'], ['Traum','💤']],
  [['Fisch','🐟'], ['Tisch','🪑']],
  [['Ball','⚽'], ['Stall','🏚️']],
  [['Nase','👃'], ['Hase','🐰'], ['Vase','🏺']],
  [['Kuh','🐄'], ['Schuh','👟']],
  [['Sonne','☀️'], ['Tonne','🗑️']],
  [['Igel','🦔'], ['Spiegel','🪞']],
  [['Krone','👑'], ['Bohne','🫘']],
  [['Kanne','🫖'], ['Tanne','🌲'], ['Pfanne','🍳']],
  [['Ziege','🐐'], ['Fliege','🪰']],
  [['Schaf','🐑'], ['Schlaf','💤']],
  [['Rakete','🚀'], ['Trompete','🎺']],
  [['Banane','🍌'], ['Fahne','🚩']],
  [['Eis','🍦'], ['Reis','🍚']],
  [['Buch','📚'], ['Tuch','🧣']],
  [['Stern','🌟'], ['Kern','🌰']],
  [['Wand','🧱'], ['Hand','✋'], ['Sand','🏖️']],
  [['Boot','⛵'], ['Brot','🍞']],
]

function buildRounds(level, count = 8) {
  const optionCount = level <= 3 ? 3 : 4
  const groups = shuffle(RHYME_GROUPS)
  const rounds = []
  for (let i = 0; i < count; i++) {
    const g = groups[i % groups.length]
    const [base, partner] = shuffle(g).slice(0, 2)
    // Distractors come from other groups, so they are guaranteed not to
    // rhyme with the base — and never share its first sound either, which
    // would make "sounds similar" ambiguous for a child.
    const others = shuffle(
      RHYME_GROUPS.filter(x => x !== g).flat().filter(w => w[0][0] !== base[0][0])
    ).slice(0, optionCount - 1)
    rounds.push({
      base:    { w: base[0], e: base[1] },
      correct: { w: partner[0], e: partner[1] },
      options: shuffle([[partner[0], partner[1]], ...others].map(([w, e]) => ({ w, e }))),
    })
  }
  return rounds
}

export default function RhymeGame({ level = 1, onComplete }) {
  const rounds = useState(() => buildRounds(level))[0]
  const [idx,    setIdx]    = useState(0)
  const [wrong,  setWrong]  = useState([])
  const [misses, setMisses] = useState(0)
  const [solved, setSolved] = useState(false)
  const [mood,   setMood]   = useState('happy')
  const [showWeiter, setShowWeiter] = useState(false)

  const r = rounds[idx]

  const sayTask = useCallback(() => {
    if (!r) return
    speakDE(`${r.base.w}. Was reimt sich auf ${r.base.w}?`)
  }, [r])

  useEffect(() => {
    setWrong([]); setSolved(false); setMood('happy')
    const id = setTimeout(sayTask, 450)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((opt) => {
    if (solved || !r) return
    if (opt.w !== r.correct.w) {
      setWrong(w => w.includes(opt.w) ? w : [...w, opt.w])
      setMisses(m => m + 1)
      setMood('encouraging')
      sfx.wrong()
      // Naming both words is the teaching moment: the child hears why they
      // do not go together.
      speakDE(`${r.base.w} und ${opt.w}. Das reimt sich nicht.`)
      setTimeout(() => setMood('happy'), 1100)
      return
    }
    setSolved(true)
    setMood('excited')
    sfx.correct()
    speakDE(`${r.base.w} und ${opt.w}. Das reimt sich!`)
    setTimeout(() => setShowWeiter(true), 700)
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
            ? <>⭐ <strong style={{ color: '#4A00E0' }}>{r.base.w}</strong> und <strong style={{ color: '#4A00E0' }}>{r.correct.w}</strong> reimen sich!</>
            : <>Was reimt sich auf <strong style={{ color: '#4A00E0' }}>{r.base.w}</strong>? 🎵</>}
        </div>
      </div>

      {/* The word to rhyme with */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        background: 'white', borderRadius: 26, padding: 'clamp(12px,2.5vw,22px) clamp(24px,6vw,48px)',
        boxShadow: '0 6px 26px rgba(74,0,224,0.14)',
      }}>
        <div style={{ fontSize: 'clamp(56px,13vw,90px)', lineHeight: 1 }}>{r.base.e}</div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(20px,4.5vw,30px)', fontWeight: 800, color: '#4A00E0' }}>
          {r.base.w}
        </div>
        <motion.button
          whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
          onClick={sayTask}
          aria-label="Wort noch einmal anhören"
          style={{
            background: '#F0EEFF', border: '2px solid #A29BFE', borderRadius: 99,
            padding: '5px 16px', cursor: 'pointer',
            fontFamily: 'var(--font-heading)', fontSize: 13, color: '#6C63FF',
          }}
        >🔊 Nochmal</motion.button>
      </div>

      {/* Candidates */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(clamp(96px,22vw,140px),1fr))',
        gap: 'clamp(10px,2.5vw,18px)', width: '100%', maxWidth: 620,
      }}>
        {r.options.map(opt => {
          const isWrong = wrong.includes(opt.w)
          const isRight = solved && opt.w === r.correct.w
          return (
            <motion.button key={opt.w}
              whileHover={!solved && !isWrong ? { scale: 1.05 } : {}}
              whileTap={!solved && !isWrong ? { scale: 0.95 } : {}}
              onClick={() => { if (!isWrong) pick(opt) }}
              aria-label={opt.w}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: isRight ? '#E8F8EE' : isWrong ? '#FFE8E8' : 'white',
                border: `3px solid ${isRight ? '#6BCB77' : isWrong ? '#FF6B6B' : '#ECE8FF'}`,
                borderRadius: 22, padding: 'clamp(10px,2vw,16px) 8px',
                cursor: solved || isWrong ? 'default' : 'pointer',
                opacity: isWrong ? 0.55 : 1,
                boxShadow: isRight ? '0 6px 24px rgba(107,203,119,0.4)' : '0 4px 16px rgba(0,0,0,0.06)',
              }}
            >
              <span style={{ fontSize: 'clamp(34px,8vw,52px)', lineHeight: 1 }}>{opt.e}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(13px,2.8vw,17px)', color: 'var(--text-primary)' }}>
                {opt.w}
              </span>
            </motion.button>
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
