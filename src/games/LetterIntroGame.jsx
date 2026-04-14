import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { voice } from '../voice.js'

// ─── Data ─────────────────────────────────────────────────────────────────────
const LETTER_DATA = {
  A: { color:'#FF6B6B', info:'A ist der 1. Buchstabe des Alphabets – und ein Vokal.',         opts:[{ e:'🍎', w:'Apfel' },   { e:'🐒', w:'Affe' },      { e:'🚗', w:'Auto' },    { e:'🐊', w:'Alligator' }, { e:'🍆', w:'Aubergine' }, { e:'🦅', w:'Adler' }]},
  B: { color:'#FF9F43', info:'B ist der 2. Buchstabe des Alphabets.',                          opts:[{ e:'🌸', w:'Blume' },   { e:'🐝', w:'Biene' },     { e:'🎈', w:'Ballon' }]},
  D: { color:'#c8a500', info:'D ist der 4. Buchstabe – nach C kommt D.',                       opts:[{ e:'🦖', w:'Dino' },    { e:'🐉', w:'Drache' },    { e:'🥫', w:'Dose' }]},
  E: { color:'#5DB85D', info:'E ist der 5. Buchstabe des Alphabets – und ein Vokal.',          opts:[{ e:'🥚', w:'Ei' },      { e:'🐘', w:'Elefant' },   { e:'🦆', w:'Ente' },    { e:'🦔', w:'Eichhörnchen' }, { e:'🍓', w:'Erdbeere' }, { e:'🦅', w:'Eule' }]},
  F: { color:'#74B9FF', info:'F ist der 6. Buchstabe. F klingt wie ein leises „fff".',         opts:[{ e:'🐟', w:'Fisch' },   { e:'🐸', w:'Frosch' },    { e:'🦊', w:'Fuchs' }]},
  G: { color:'#A29BFE', info:'G ist der 7. Buchstabe des Alphabets.',                          opts:[{ e:'🦒', w:'Giraffe' }, { e:'👻', w:'Geist' },     { e:'🎁', w:'Geschenk' }]},
  H: { color:'#E84393', info:'H ist der 8. Buchstabe. H haucht ganz leise.',                   opts:[{ e:'🐶', w:'Hund' },    { e:'🐰', w:'Hase' },      { e:'🏠', w:'Haus' }]},
  I: { color:'#44D498', info:'I ist der 9. Buchstabe des Alphabets – und ein Vokal.',          opts:[{ e:'🦔', w:'Igel' },    { e:'🏝️', w:'Insel' },    { e:'🦗', w:'Insekt' }]},
  J: { color:'#FF6B9A', info:'J ist der 10. Buchstabe des Alphabets.',                         opts:[{ e:'🐆', w:'Jaguar' },  { e:'🧥', w:'Jacke' },     { e:'🥛', w:'Joghurt' }]},
  K: { color:'#6C63FF', info:'K ist der 11. Buchstabe des Alphabets.',                         opts:[{ e:'🐱', w:'Katze' },   { e:'👑', w:'König' },     { e:'🐨', w:'Koala' }]},
  L: { color:'#FF6B6B', info:'L ist der 12. Buchstabe. L klingt wie ein weiches „lll".',       opts:[{ e:'🦁', w:'Löwe' },    { e:'💡', w:'Lampe' },     { e:'🦙', w:'Lama' }]},
  M: { color:'#FF9F43', info:'M ist der 13. Buchstabe. M klingt wie ein Summen.',              opts:[{ e:'🐭', w:'Maus' },    { e:'🌙', w:'Mond' },      { e:'🎵', w:'Musik' }]},
  N: { color:'#5DB85D', info:'N ist der 14. Buchstabe des Alphabets.',                         opts:[{ e:'👃', w:'Nase' },    { e:'🌰', w:'Nuss' },      { e:'🪺', w:'Nest' }]},
  O: { color:'#74B9FF', info:'O ist der 15. Buchstabe des Alphabets – und ein Vokal.',         opts:[{ e:'👂', w:'Ohr' },     { e:'🍊', w:'Orange' },    { e:'🐙', w:'Oktopus' }]},
  P: { color:'#A29BFE', info:'P ist der 16. Buchstabe des Alphabets.',                         opts:[{ e:'🐧', w:'Pinguin' }, { e:'🍄', w:'Pilz' },      { e:'🐴', w:'Pferd' }]},
  R: { color:'#E84393', info:'R ist der 18. Buchstabe. R kann man rollen lassen.',             opts:[{ e:'🚀', w:'Rakete' },  { e:'🤖', w:'Roboter' },   { e:'🌹', w:'Rose' }]},
  S: { color:'#44D498', info:'S ist der 19. Buchstabe. S zischt wie eine Schlange.',           opts:[{ e:'☀️', w:'Sonne' },   { e:'⭐', w:'Stern' },     { e:'🐌', w:'Schnecke' }, { e:'🦋', w:'Schmetterling' }, { e:'🐍', w:'Schlange' }, { e:'🧸', w:'Spielzeug' }]},
  T: { color:'#FF6B9A', info:'T ist der 20. Buchstabe des Alphabets.',                         opts:[{ e:'🐯', w:'Tiger' },   { e:'🚜', w:'Traktor' },   { e:'🥁', w:'Trommel' }]},
  U: { color:'#6C63FF', info:'U ist der 21. Buchstabe des Alphabets – und ein Vokal.',         opts:[{ e:'⏰', w:'Uhr' },     { e:'🦉', w:'Uhu' },       { e:'🛸', w:'Ufo' }]},
  V: { color:'#FF6B6B', info:'V ist der 22. Buchstabe. V klingt ähnlich wie F.',              opts:[{ e:'🐦', w:'Vogel' },   { e:'🌋', w:'Vulkan' },    { e:'🏺', w:'Vase' }]},
  W: { color:'#FF9F43', info:'W ist der 23. Buchstabe des Alphabets.',                         opts:[{ e:'🐺', w:'Wolf' },    { e:'☁️', w:'Wolke' },     { e:'🐋', w:'Wal' }]},
  Z: { color:'#5DB85D', info:'Z ist der 26. und letzte Buchstabe des Alphabets.',              opts:[{ e:'🦓', w:'Zebra' },   { e:'🦷', w:'Zahn' },      { e:'🚂', w:'Zug' },     { e:'🎯', w:'Ziel' },    { e:'🧱', w:'Ziegel' }]},
  C: { color:'#E17055', info:'C ist der 3. Buchstabe. C klingt oft wie K oder Z.',                opts:[{ e:'🤡', w:'Clown' },   { e:'💻', w:'Computer' },  { e:'🍪', w:'Cookie' }]},
  Q: { color:'#6C5CE7', info:'Q ist der 17. Buchstabe. Q kommt fast immer mit U zusammen.',       opts:[{ e:'🐊', w:'Qualle' },  { e:'💨', w:'Qualm' },     { e:'🎵', w:'Quetsche' }]},
  X: { color:'#00B894', info:'X ist der 24. Buchstabe. X macht ein „ks" Geräusch.',               opts:[{ e:'🎸', w:'Xylofon' }, { e:'✖️', w:'Kreuz' },    { e:'📐', w:'X-Form' }]},
  Y: { color:'#FDCB6E', info:'Y ist der 25. Buchstabe. Y klingt wie ein „Ü" oder „J".',           opts:[{ e:'🧘', w:'Yoga' },    { e:'🛥️', w:'Yacht' },    { e:'🧶', w:'Yarn' }]},
}

const ALL_LETTERS = Object.keys(LETTER_DATA)
const VOWELS = new Set(['A','E','I','O','U'])

// ─── Voice audio ─────────────────────────────────────────────────────────────
const ABC = 'audio/abc-abenteuer/'
const LETTER_INFO_AUDIO = {
  A: ABC + 'a-ist-der-1-buchstabe-des-alphabets-und-ein-vokal.mp3',
  B: ABC + 'b-ist-der-2-buchstabe-des-alphabets.mp3',
  D: ABC + 'd-ist-der-4-buchstabe-nach-c-kommt-d.mp3',
  E: ABC + 'e-ist-der-5-buchstabe-des-alphabets-und-ein-vokal.mp3',
  F: ABC + 'f-ist-der-6-buchstabe.mp3',
  G: ABC + 'g-ist-der-7-buchstabe-des-alphabets.mp3',
  H: ABC + 'h-ist-der-8-buchstabe-h-haucht-ganz-leise.mp3',
  I: ABC + 'i-ist-der-9-buchstabe-des-alphabets-und-ein-vokal.mp3',
  J: ABC + 'j-ist-der-10-buchstabe-des-alphabets.mp3',
  K: ABC + 'k-ist-der-11-buchstabe-des-alphabets.mp3',
  L: ABC + 'l-ist-der-12-buchstabe.mp3',
  M: ABC + 'm-ist-der-13-buchstabe-m-klingt-wie-ein-summen.mp3',
  N: ABC + 'n-ist-der-14-buchstabe-des-alphabets.mp3',
  O: ABC + 'o-ist-der-15-buchstabe-des-alphabets-und-ein-vokal.mp3',
  P: ABC + 'p-ist-der-16-buchstabe-des-alphabets.mp3',
  R: ABC + 'r-ist-der-18-buchstabe-r-kann-man-rollen-lassen.mp3',
  S: ABC + 's-ist-der-19-buchstabe-s-zischt-wie-eine-schlange.mp3',
  T: ABC + 't-ist-der-20-buchstabe-des-alphabets.mp3',
  U: ABC + 'u-ist-der-21-buchstabe-des-alphabets-und-ein-vokal.mp3',
  V: ABC + 'v-ist-der-22-buchstabe-v-klingt-aehnlich-wie-f.mp3',
  W: ABC + 'w-ist-der-23-buchstabe-des-alphabets.mp3',
  Z: ABC + 'z-ist-der-26-und-letzte-buchstabe-des-alphabets.mp3',
  C: null, Q: null, X: null, Y: null,
}

function wordAudio(word) {
  let s = word.toLowerCase()
  s = s.replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue').replace(/ß/g,'ss')
  return ABC + s + '.mp3'
}

const LEVEL_LETTERS = [
  ['A','E','I','O','U','M','B','S'],                            // L1 – Vokale + häufige
  ['H','D','F','K','L','N','R','T'],                            // L2
  ['G','J','P','W','Z','V','C','Q'],                            // L3 – inkl. C und Q
  ['A','B','D','E','F','G','H','I','J','K','L','M','X','Y'],    // L4 – inkl. X und Y
  ALL_LETTERS,                                                   // L5 – alle
]

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function makeQuestions(letters) {
  return letters.filter(l => LETTER_DATA[l]).map(l => {
    const { color, info, opts } = LETTER_DATA[l]
    const [correct] = shuffle(opts)
    // Distractors from other letters
    const otherPool = shuffle(ALL_LETTERS.filter(k => k !== l))
      .slice(0, 6)
      .flatMap(k => LETTER_DATA[k].opts)
    const [d1, d2] = shuffle(otherPool)
    return {
      letter: l,
      color,
      info,
      correct,
      options: shuffle([correct, d1, d2]),
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LetterIntroGame({ level = 1, onComplete }) {
  const questions = useMemo(() => {
    const lvl      = Math.max(0, Math.min(level - 1, LEVEL_LETTERS.length - 1))
    const letters  = LEVEL_LETTERS[lvl]
    return makeQuestions(shuffle(letters))
  }, [level])

  const [idx,      setIdx]      = useState(0)
  const [selected, setSelected] = useState(null)
  const [score,    setScore]    = useState(0)
  const [shakeOpt, setShakeOpt] = useState(null)
  const [showWeiter, setShowWeiter] = useState(false)

  // Stop narration when game unmounts
  useEffect(() => () => voice.stop(), [])

  // Play letter info then question prompt on each new question
  useEffect(() => {
    const letter = questions[idx]?.letter
    if (!letter) return
    const infoAudio = LETTER_INFO_AUDIO[letter]
    if (infoAudio) voice.chain([infoAudio, ABC + `welches-wort-beginnt-mit-${letter.toLowerCase()}.mp3`])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const weiterClick = useCallback(() => {
    setShowWeiter(false)
    const next = idx + 1
    if (next >= questions.length) {
      onComplete({ score, total: questions.length })
    } else {
      setIdx(next)
      setSelected(null)
    }
  }, [idx, questions.length, score, onComplete])

  const q = questions[idx]
  if (!q) return null

  const pick = (opt) => {
    if (selected !== null) return
    if (opt === q.correct) {
      voice.play(wordAudio(opt.w))
      setSelected(opt)
      const nextScore = score + 1
      setScore(nextScore)
      setShowWeiter(true)
    } else {
      setShakeOpt(opt)
      setTimeout(() => setShakeOpt(null), 600)
    }
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:20, padding:'clamp(12px,3vw,24px)', width:'100%' }}>

      {/* Progress */}
      <div style={{ width:'100%', maxWidth:520, height:10, background:'rgba(0,0,0,0.08)', borderRadius:10, overflow:'hidden' }}>
        <motion.div
          animate={{ width:`${(idx / questions.length) * 100}%` }}
          style={{ height:'100%', background:q.color, borderRadius:10 }}
          transition={{ duration:0.4 }}
        />
      </div>

      {/* Big letter */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ scale:0.4, rotate:-15, opacity:0 }}
          animate={{ scale:1, rotate:0, opacity:1 }}
          exit={{ scale:0.4, rotate:15, opacity:0 }}
          transition={{ type:'spring', stiffness:360, damping:20 }}
          style={{ textAlign:'center', display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'center', gap:'clamp(12px,3vw,28px)', position:'relative' }}
        >
          {/* Uppercase */}
          <div style={{
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(150px,28vw,240px)',
            lineHeight:1, userSelect:'none',
            color: q.color,
            filter:`drop-shadow(0 8px 32px ${q.color}77)`,
          }}>
            {q.letter}
          </div>
          {/* Lowercase */}
          <div style={{
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(110px,20vw,176px)',
            lineHeight:1, color:`${q.color}77`,
          }}>
            {q.letter.toLowerCase()}
          </div>
          {VOWELS.has(q.letter) && (
            <div style={{
              position:'absolute', top:-8, right:-8,
              background:'#FFD93D', color:'#333',
              borderRadius:99, padding:'2px 10px',
              fontFamily:'var(--font-heading)', fontSize:12, fontWeight:700,
              boxShadow:'0 2px 8px rgba(0,0,0,0.15)',
            }}>Vokal</div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Info badge — outside AnimatePresence so it fades in calmly */}
      <AnimatePresence mode="wait">
        <motion.div
          key={'info-' + idx}
          initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
          transition={{ delay:0.3, duration:0.35 }}
          style={{
            background:`${q.color}18`,
            border:`2px solid ${q.color}55`,
            borderRadius:16,
            padding:'10px 22px',
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(14px,3vw,20px)',
            color:'var(--text-secondary)',
            textAlign:'center',
            maxWidth:440,
            width:'100%',
          }}
        >
          {q.info}
        </motion.div>
      </AnimatePresence>

      {/* Question */}
      <div style={{
        fontFamily:'var(--font-heading)',
        fontSize:'clamp(16px,3.5vw,22px)',
        color:'var(--text-secondary)',
        textAlign:'center',
      }}>
        Welches Wort beginnt mit <strong style={{ color:q.color }}>{q.letter}</strong>?
      </div>

      {/* Options */}
      <div style={{
        display:'flex', gap:'clamp(10px,2.5vw,20px)',
        flexWrap:'wrap', justifyContent:'center',
        width:'100%', maxWidth:580,
      }}>
        {q.options.map((opt, i) => {
          const isCorrect = opt === q.correct
          const isChosen  = opt === selected
          const isWrong   = opt === shakeOpt

          let bg     = 'white'
          let border = '3px solid #ECE8FF'
          let shadow = '0 4px 18px rgba(0,0,0,0.07)'
          if (isChosen && isCorrect) {
            bg = '#E8F8EE'; border = '3px solid #6BCB77'
            shadow = '0 8px 28px rgba(107,203,119,0.4)'
          }

          return (
            <motion.button
              key={`${idx}-${i}`}
              animate={isWrong
                ? { x:[0,-10,10,-7,7,-3,3,0], opacity:[1,0.6,1,0.6,1,0.6,1,1] }
                : {}}
              transition={{ duration:0.45 }}
              whileHover={!selected ? { scale:1.07, y:-3 } : {}}
              whileTap={!selected ? { scale:0.93 } : {}}
              onClick={() => pick(opt)}
              style={{
                background:bg, border, boxShadow:shadow,
                borderRadius:24,
                padding:'clamp(14px,3.2vw,24px) clamp(16px,3.5vw,30px)',
                cursor: selected ? 'default' : 'pointer',
                display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                transition:'background 0.2s, border 0.2s, box-shadow 0.2s',
                minWidth:'clamp(100px,26vw,165px)',
                position:'relative',
              }}
            >
              <span style={{ fontSize:'clamp(44px,9.5vw,66px)', lineHeight:1 }}>
                {opt.e}
              </span>
              <span style={{
                fontFamily:'var(--font-heading)',
                fontSize:'clamp(14px,3vw,20px)',
                color:'var(--text-primary)', fontWeight:700,
                textAlign:'center',
              }}>
                {opt.w}
              </span>
              {isChosen && isCorrect && (
                <motion.span
                  initial={{ scale:0 }} animate={{ scale:1 }}
                  transition={{ type:'spring', stiffness:500 }}
                  style={{ fontSize:22, position:'absolute', top:-10, right:-10 }}
                >
                  ✅
                </motion.span>
              )}
              {isWrong && (
                <span style={{ fontSize:22, position:'absolute', top:-10, right:-10 }}>❌</span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Weiter button */}
      {showWeiter && (
        <motion.button
          initial={{ scale:0 }} animate={{ scale:1 }}
          transition={{ type:'spring', stiffness:300, delay:0.2 }}
          whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
          onClick={weiterClick}
          style={{
            background:`linear-gradient(135deg,${q.color},${q.color}cc)`,
            color:'white', border:'none', borderRadius:20,
            padding:'14px 40px',
            fontFamily:'var(--font-heading)', fontSize:20, fontWeight:700,
            cursor:'pointer', boxShadow:`0 5px 20px ${q.color}66`,
          }}
        >Weiter! →</motion.button>
      )}

      {/* Score */}
      <p style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'var(--text-muted)', margin:0 }}>
        {score} von {Math.min(idx + (selected ? 1 : 0), questions.length)} richtig
      </p>
    </div>
  )
}
