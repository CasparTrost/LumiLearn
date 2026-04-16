import { useState, useEffect, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

/**
 * Hörabenteuer — Phonologisches Bewusstsein
 * Scientific basis:
 *   • Phonological Awareness (National Reading Panel, 2000) — connecting spoken words to images
 *     is the single strongest predictor of reading readiness.
 *   • Dual Coding Theory (Paivio, 1990) — audio + visual encoding deepens memory traces.
 *   • Peabody Picture Vocabulary Test methodology — hear a word, find the matching picture.
 */

const WORD_BANK = [
  // Tiere
  { word: 'Hund',          emoji: '🐕', wrong: ['🐱','🐟','🦁'] },
  { word: 'Katze',         emoji: '🐱', wrong: ['🐕','🐟','🐸'] },
  { word: 'Vogel',         emoji: '🐦', wrong: ['🐕','🐟','🐱'] },
  { word: 'Fisch',         emoji: '🐟', wrong: ['🐕','🐦','🐸'] },
  { word: 'Pferd',         emoji: '🐴', wrong: ['🐄','🐑','🐖'] },
  { word: 'Kuh',           emoji: '🐄', wrong: ['🐖','🐑','🐴'] },
  { word: 'Schaf',         emoji: '🐑', wrong: ['🐄','🐐','🐖'] },
  { word: 'Schwein',       emoji: '🐖', wrong: ['🐄','🐑','🐴'] },
  { word: 'Löwe',          emoji: '🦁', wrong: ['🐯','🐻','🦊'] },
  { word: 'Tiger',         emoji: '🐯', wrong: ['🦁','🐻','🐆'] },
  { word: 'Bär',           emoji: '🐻', wrong: ['🦁','🐯','🦊'] },
  { word: 'Fuchs',         emoji: '🦊', wrong: ['🐺','🐻','🐱'] },
  { word: 'Elefant',       emoji: '🐘', wrong: ['🦒','🦏','🦛'] },
  { word: 'Giraffe',       emoji: '🦒', wrong: ['🐘','🦓','🦏'] },
  { word: 'Affe',          emoji: '🐒', wrong: ['🦁','🐘','🦜'] },
  { word: 'Pinguin',       emoji: '🐧', wrong: ['🦆','🦢','🐦'] },
  { word: 'Eule',          emoji: '🦉', wrong: ['🐦','🦜','🦆'] },
  { word: 'Frosch',        emoji: '🐸', wrong: ['🐢','🦎','🦗'] },
  { word: 'Schildkröte',   emoji: '🐢', wrong: ['🐸','🦎','🐊'] },
  { word: 'Biene',         emoji: '🐝', wrong: ['🦋','🐞','🦗'] },
  { word: 'Schmetterling', emoji: '🦋', wrong: ['🐝','🐞','🦗'] },
  { word: 'Schnecke',      emoji: '🐌', wrong: ['🐛','🐞','🦗'] },
  { word: 'Krokodil',      emoji: '🐊', wrong: ['🐢','🦎','🐍'] },
  { word: 'Delfin',        emoji: '🐬', wrong: ['🐟','🐳','🦈'] },
  { word: 'Hai',           emoji: '🦈', wrong: ['🐬','🐳','🐟'] },
  // Essen & Trinken
  { word: 'Apfel',         emoji: '🍎', wrong: ['🍊','🍌','🍇'] },
  { word: 'Banane',        emoji: '🍌', wrong: ['🍎','🍊','🍇'] },
  { word: 'Erdbeere',      emoji: '🍓', wrong: ['🍎','🍒','🍇'] },
  { word: 'Pizza',         emoji: '🍕', wrong: ['🍔','🌮','🍜'] },
  { word: 'Kuchen',        emoji: '🎂', wrong: ['🍕','🍩','🍪'] },
  { word: 'Eis',           emoji: '🍦', wrong: ['🍰','🍩','🧁'] },
  { word: 'Brot',          emoji: '🍞', wrong: ['🥐','🥨','🧀'] },
  { word: 'Keks',          emoji: '🍪', wrong: ['🎂','🍩','🧁'] },
  { word: 'Milch',         emoji: '🥛', wrong: ['🧃','🍵','🥤'] },
  { word: 'Saft',          emoji: '🧃', wrong: ['🥛','🍵','🥤'] },
  { word: 'Karotte',       emoji: '🥕', wrong: ['🌽','🥦','🥬'] },
  { word: 'Mais',          emoji: '🌽', wrong: ['🥕','🍅','🥦'] },
  { word: 'Tomate',        emoji: '🍅', wrong: ['🍎','🌽','🫑'] },
  // Gegenstände & Spielzeug
  { word: 'Ball',          emoji: '⚽', wrong: ['🎈','🎂','🎮'] },
  { word: 'Drachen',       emoji: '🐉', wrong: ['🦁','🐬','🦋'] },
  { word: 'Rakete',        emoji: '🚀', wrong: ['✈️','🚗','🚂'] },
  { word: 'Zug',           emoji: '🚂', wrong: ['🚗','✈️','🚢'] },
  { word: 'Auto',          emoji: '🚗', wrong: ['🚂','✈️','🚢'] },
  { word: 'Flugzeug',      emoji: '✈️', wrong: ['🚀','🚁','🛸'] },
  { word: 'Schiff',        emoji: '🚢', wrong: ['⛵','🚤','🛶'] },
  { word: 'Fahrrad',       emoji: '🚲', wrong: ['🛴','🚗','🛵'] },
  { word: 'Buch',          emoji: '📚', wrong: ['📓','📰','📋'] },
  { word: 'Schere',        emoji: '✂️', wrong: ['🖊️','📌','🔧'] },
  // Natur & Himmel
  { word: 'Sonne',         emoji: '☀️', wrong: ['🌙','⭐','🌈'] },
  { word: 'Mond',          emoji: '🌙', wrong: ['☀️','⭐','🌈'] },
  { word: 'Stern',         emoji: '⭐', wrong: ['🌙','☀️','💫'] },
  { word: 'Regenbogen',    emoji: '🌈', wrong: ['☀️','🌧️','⛅'] },
  { word: 'Blume',         emoji: '🌸', wrong: ['🌳','🍎','⭐'] },
  { word: 'Baum',          emoji: '🌳', wrong: ['🌸','🍎','🌿'] },
  { word: 'Pilz',          emoji: '🍄', wrong: ['🌳','🌸','🌿'] },
  { word: 'Welle',         emoji: '🌊', wrong: ['💧','🌧️','⛈️'] },
  { word: 'Vulkan',        emoji: '🌋', wrong: ['⛰️','🏔️','🗻'] },
  // Zuhause & Alltag
  { word: 'Haus',          emoji: '🏠', wrong: ['⛺','🏰','🏛️'] },
  { word: 'Schloss',       emoji: '🏰', wrong: ['🏠','⛺','🏛️'] },
  { word: 'Stuhl',         emoji: '🪑', wrong: ['🛋️','🛏️','🚪'] },
  { word: 'Bett',          emoji: '🛏️', wrong: ['🪑','🛋️','🛁'] },
  { word: 'Schuhe',        emoji: '👟', wrong: ['🧤','🧢','🧣'] },
  { word: 'Krone',         emoji: '👑', wrong: ['💎','🎩','💍'] },
  { word: 'Zelt',          emoji: '⛺', wrong: ['🏠','🏚️','🛖'] },
  { word: 'Lampe',         emoji: '💡', wrong: ['🕯️','🔦','🪔'] },
  { word: 'Geschenk',      emoji: '🎁', wrong: ['🎈','🎀','🎊'] },
  { word: 'Ballon',        emoji: '🎈', wrong: ['🎁','🎀','💨'] },
]

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

function speak(text, slow = false) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang  = 'de-DE'
  u.rate  = slow ? 0.45 : 0.72
  u.pitch = 1.1
  window.speechSynthesis.speak(u)
}

export default function ListenGame({ level = 1, onComplete }) {
  const wordCount   = level <= 2 ? 7 : level <= 5 ? 9 : level <= 8 ? 11 : 13
  const optionCount = level <= 3 ? 3 : 4
  // Easy levels: simpler/more common words from start of bank
  const poolEnd     = level <= 2 ? 28 : level <= 5 ? 55 : WORD_BANK.length
  const [words]    = useState(() => shuffle(WORD_BANK.slice(0, poolEnd)).slice(0, wordCount))
  const [idx,      setIdx]      = useState(0)
  const [options,  setOptions]  = useState([])
  const [selected, setSelected] = useState(null)
  const [correct,  setCorrect]  = useState(0)
  const [mood,     setMood]     = useState('happy')
  const [played,   setPlayed]   = useState(false)
  const [showWeiter, setShowWeiter] = useState(false)

  const current = words[idx]

  useEffect(() => {
    if (!current) return
    setOptions(shuffle([current.emoji, ...current.wrong.slice(0, optionCount - 1)]))
    setSelected(null)
    setMood('happy')
    setPlayed(false)
    const t = setTimeout(() => { speak(current.word); setPlayed(true) }, 550)
    return () => clearTimeout(t)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const replay = useCallback(() => {
    if (!current) return
    speak(current.word)
    setPlayed(true)
  }, [current])

  const pick = useCallback((emoji) => {
    if (selected !== null || !current) return
    const ok = emoji === current.emoji
    const nc = correct + (ok ? 1 : 0)
    setSelected(emoji)
    setMood(ok ? 'excited' : 'encouraging')
    if (ok) { setCorrect(nc); setShowWeiter(true); setTimeout(() => speak(current.word), 300) }
    else {
      // Repeat word slowly on wrong answer
      setTimeout(() => speak(current.word, true), 600)
      setTimeout(() => {
        if (idx + 1 >= words.length) { onComplete({ score: nc, total: words.length }) }
        else { setIdx(i => i + 1) }
      }, 2200)
    }
  }, [selected, current, correct, idx, words, onComplete])

  const weiterClick = useCallback(() => {
    setShowWeiter(false)
    if (idx + 1 >= words.length) { onComplete({ score: correct, total: words.length }) }
    else { setIdx(i => i + 1) }
  }, [idx, words.length, correct, onComplete])

  if (!current) return null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(16px,3vw,32px) clamp(16px,4vw,40px)',
      gap: 'clamp(14px,2.5vw,26px)',
    }}>

      {/* Progress */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:680 }}>
        {words.map((_, i) => (
          <div key={i} style={{
            flex:1, height:10, borderRadius:99,
            background: i < idx ? '#FF6B6B' : i === idx ? '#FFD93D' : '#FFE4DD',
            transition:'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + bubble */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:14, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={mood} size={88} />
        <div style={{
          flex:1, background:'white', borderRadius:'24px 24px 24px 6px',
          padding:'16px 22px',
          boxShadow:'0 4px 24px rgba(255,107,107,0.12)',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(18px,3.8vw,26px)',
          color:'var(--text-primary)',
        }}>
          Welches Bild passt zum Wort? 🖼️
        </div>
      </div>

      {/* Play button */}
      <motion.button
        whileHover={{ scale:1.06 }} whileTap={{ scale:0.93 }}
        onClick={replay}
        animate={!played
          ? { scale:[1,1.08,1], boxShadow:['0 6px 24px rgba(255,107,107,0.3)','0 12px 44px rgba(255,107,107,0.6)','0 6px 24px rgba(255,107,107,0.3)'] }
          : {}}
        transition={!played ? { duration:1.4, repeat:Infinity } : {}}
        style={{
          background:'linear-gradient(135deg,#FF6B6B,#FF8E53)',
          color:'white', borderRadius:99,
          padding:'16px clamp(28px,5vw,56px)',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(20px,4.5vw,30px)',
          fontWeight:600,
          boxShadow:'0 8px 28px rgba(255,107,107,0.4)',
          display:'flex', alignItems:'center', gap:14,
        }}
      >
        🔊 Anhören!
      </motion.button>

      {/* 2×2 picture grid */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(2,1fr)',
        gap:'clamp(12px,2.5vw,22px)',
        width:'100%', maxWidth:760,
      }}>
        {options.map((emoji, i) => {
          const isAns  = emoji === current.emoji
          const isChos = emoji === selected
          const done   = selected !== null

          let bg     = 'white'
          let border = '3px solid #F0EEF8'
          let shadow = '0 4px 18px rgba(0,0,0,0.06)'

          if (done) {
            if (isAns)        { bg='#E8F8EE'; border='3px solid #6BCB77'; shadow='0 8px 28px rgba(107,203,119,0.4)' }
            else if (isChos)  { bg='#FFE8E8'; border='3px solid #FF6B6B' }
          }

          return (
            <motion.button key={`${idx}-${i}`}
              initial={{ opacity:0, y:18 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay:i*0.07, type:'spring', stiffness:320 }}
              whileHover={!done ? { scale:1.05 } : {}}
              whileTap={!done ? { scale:0.95 } : {}}
              onClick={() => pick(emoji)}
              style={{
                padding:'clamp(20px,5vw,40px) 16px',
                borderRadius:26, background:bg, border, boxShadow:shadow,
                fontSize:'clamp(56px,14vw,92px)',
                display:'flex', alignItems:'center', justifyContent:'center',
                cursor:done ? 'default' : 'pointer',
                transition:'all 0.22s', lineHeight:1,
              }}
            >
              <div style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:4 }}>
                <motion.span
                  animate={done && isAns ? { scale:[1,1.35,1], rotate:[0,12,-12,0] } : {}}
                  transition={{ duration:0.55 }}
                >
                  {emoji}
                </motion.span>
                {done && isAns && (
                  <motion.span
                    initial={{opacity:0,y:4}} animate={{opacity:1,y:0}}
                    style={{
                      fontFamily:'var(--font-heading)',
                      fontSize:'clamp(13px,2.8vw,17px)',
                      fontWeight:700, color:'#2d7a3a',
                    }}
                  >{current.word}</motion.span>
                )}
              </div>
            </motion.button>
          )
        })}
      </div>

      {showWeiter && (
        <motion.button
          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ type:'spring', stiffness:300, delay:0.2 }}
          whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
          onClick={weiterClick}
          style={{
            background:'linear-gradient(135deg,#FF6B6B,#FF8E53)',
            color:'white', border:'none', borderRadius:20,
            padding:'14px 40px',
            fontFamily:'var(--font-heading)', fontSize:20, fontWeight:700,
            cursor:'pointer', boxShadow:'0 5px 20px rgba(255,107,107,0.45)',
          }}
        >Weiter! →</motion.button>
      )}

      <p style={{ fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-muted)' }}>
        ✅ {correct} von {Math.min(idx + (selected !== null ? 1 : 0), words.length)} richtig
      </p>
    </div>
  )
}
