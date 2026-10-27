import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { soundOf } from './letterSounds.js'
import { pxCard, pxButton, INK } from './px.js'

// ─── Data ─────────────────────────────────────────────────────────────────────
// Jedes Bild zeigt eindeutig sein Wort, und jedes Wort fängt mit dem Laut
// seines Buchstabens an: kein "Stern" unter S (das ist "scht"), kein "Ei"
// oder "Eule" unter E, keine Glühbirne als "Lampe", kein Igel-Bild für das
// Eichhörnchen. Kein Bild kommt zweimal vor.
//
// `ex` ist das Beispiel im Merksatz ("B wie Ball"). Es steht bewusst nicht
// unter den Antworten, sonst wäre die Antwort schon vorgesagt.
// `note` ersetzt den Merksatz bei den Buchstaben, deren Laut nicht ihr
// eigener ist; `say` ist dann die Fassung für die Stimme.
const LETTER_DATA = {
  A: { ex:'Arm',    opts:[{ e:'🍎', w:'Apfel' },   { e:'🐒', w:'Affe' },     { e:'🐜', w:'Ameise' },  { e:'🍍', w:'Ananas' },  { e:'🦅', w:'Adler' }]},
  B: { ex:'Ball',   opts:[{ e:'🌸', w:'Blume' },   { e:'🐝', w:'Biene' },    { e:'🍌', w:'Banane' },  { e:'🐻', w:'Bär' }]},
  C: { note:'C klingt meistens wie K – wie in Cowboy.',
                    opts:[{ e:'🤡', w:'Clown' },   { e:'💻', w:'Computer' }, { e:'🥐', w:'Croissant' }]},
  D: { ex:'Dach',   opts:[{ e:'🦖', w:'Dino' },    { e:'🐉', w:'Drache' },   { e:'🥫', w:'Dose' }]},
  E: { ex:'Ecke',   opts:[{ e:'🦆', w:'Ente' },    { e:'🐘', w:'Elefant' },  { e:'🍓', w:'Erdbeere' }, { e:'🫏', w:'Esel' }]},
  F: { ex:'Fuß',    opts:[{ e:'🐟', w:'Fisch' },   { e:'🐸', w:'Frosch' },   { e:'🦊', w:'Fuchs' },   { e:'🪶', w:'Feder' }]},
  G: { ex:'Gabel',  opts:[{ e:'🦒', w:'Giraffe' }, { e:'👻', w:'Geist' },    { e:'🎁', w:'Geschenk' }, { e:'🥒', w:'Gurke' }]},
  H: { ex:'Hut',    opts:[{ e:'🐶', w:'Hund' },    { e:'🐰', w:'Hase' },     { e:'🏠', w:'Haus' },    { e:'🐓', w:'Hahn' }]},
  I: { ex:'Iglu',   opts:[{ e:'🦔', w:'Igel' },    { e:'🏝️', w:'Insel' }]},
  J: { ex:'Junge',  opts:[{ e:'🧥', w:'Jacke' },   { e:'🪀', w:'Jo-Jo' }]},
  K: { ex:'Kuh',    opts:[{ e:'🐱', w:'Katze' },   { e:'👑', w:'König' },    { e:'🐨', w:'Koala' },   { e:'🧀', w:'Käse' }]},
  L: { ex:'Licht',  opts:[{ e:'🦁', w:'Löwe' },    { e:'🦙', w:'Lama' },     { e:'🪜', w:'Leiter' }]},
  M: { ex:'Mama',   opts:[{ e:'🐭', w:'Maus' },    { e:'🌙', w:'Mond' },     { e:'🥛', w:'Milch' }]},
  N: { ex:'Nacht',  opts:[{ e:'👃', w:'Nase' },    { e:'🪺', w:'Nest' },     { e:'🍝', w:'Nudeln' }]},
  O: { ex:'Ofen',   opts:[{ e:'👂', w:'Ohr' },     { e:'🍊', w:'Orange' },   { e:'👵', w:'Oma' }]},
  P: { ex:'Papa',   opts:[{ e:'🐧', w:'Pinguin' }, { e:'🍄', w:'Pilz' },     { e:'🐼', w:'Panda' },   { e:'🦜', w:'Papagei' }]},
  Q: { note:'Q kommt fast immer mit U – Qu wie in Quatsch.',
       say:'Q kommt fast immer mit U. Zusammen klingen sie wie in Quatsch.',
                    opts:[{ e:'🪼', w:'Qualle' },  { e:'🟥', w:'Quadrat' }]},
  R: { ex:'Regen',  opts:[{ e:'🚀', w:'Rakete' },  { e:'🤖', w:'Roboter' },  { e:'🌹', w:'Rose' }]},
  S: { ex:'Sand',   opts:[{ e:'☀️', w:'Sonne' },   { e:'🛋️', w:'Sofa' },     { e:'🧦', w:'Socke' },   { e:'🥗', w:'Salat' },   { e:'🧼', w:'Seife' }]},
  T: { ex:'Tor',    opts:[{ e:'🐯', w:'Tiger' },   { e:'🚜', w:'Traktor' },  { e:'🥁', w:'Trommel' }, { e:'🍅', w:'Tomate' }]},
  U: { ex:'Uhr',    opts:[{ e:'🛸', w:'Ufo' },     { e:'🦉', w:'Uhu' }]},
  V: { note:'V klingt meistens wie F – wie in Vater. Manchmal wie W – wie in Video.',
                    opts:[{ e:'🐦', w:'Vogel' },   { e:'🌋', w:'Vulkan' },   { e:'🏺', w:'Vase' }]},
  W: { ex:'Wasser', opts:[{ e:'🐺', w:'Wolf' },    { e:'☁️', w:'Wolke' },    { e:'🐋', w:'Wal' },     { e:'🪱', w:'Wurm' }]},
  X: { note:'X klingt wie ks – wie in Hexe und Taxi.',
       say:'X klingt so wie in Hexe und in Taxi.',
                    opts:[{ e:':px-xylofon:', w:'Xylofon' }]},
  Y: { note:'Y klingt oft wie J – wie in Yeti.',
                    opts:[{ e:'🧘', w:'Yoga' }]},
  Z: { ex:'Zoo',    opts:[{ e:'🦓', w:'Zebra' },   { e:'🦷', w:'Zahn' },     { e:'🚂', w:'Zug' },     { e:'🍋', w:'Zitrone' }, { e:'⛺', w:'Zelt' }]},
}

const ALL_LETTERS = Object.keys(LETTER_DATA)

// Buchstaben, die gleich klingen können. Ihre Wörter sind nie die falsche
// Antwort: wer bei F nach dem Laut geht und "Vogel" tippt, hat richtig gehört.
const SAME_SOUND = {
  F:['V'], V:['F','W'], W:['V'], K:['C','Q'], C:['K','Q','Z'], Q:['K','C'], Z:['C'], J:['Y'], Y:['J'],
}

// Kräftige Farben, jede mit dunkler Kontur — auf Pergament gut zu sehen.
const COLORS = ['#E8483B', '#E07A10', '#2F8F3A', '#2F7FD8', '#8A4FD0', '#D63A7C', '#13968C', '#B8860B']
const colorOf = l => COLORS[ALL_LETTERS.indexOf(l) % COLORS.length]

// Höchstens zehn Runden je Level. Level 5 hatte alle 26 Buchstaben am Stück,
// mit Ansage über fünf Minuten — zu lang für ein Kind. Die Schritte: erst
// Laute, die man lange halten kann, dann kurze, dann die seltenen mit
// eigenem Merksatz, dann gemischt, zuletzt der kleine Buchstabe.
const LEVELS = [
  { letters:['A','M','O','L','S','E','I','U'], options:3 },
  { letters:['B','D','F','H','K','N','R','T'], options:3 },
  { letters:['G','J','P','W','Z','V','C','Q'], options:4 },
  { letters:['X','Y'], review:8,               options:4 },
  { review:10,                                 options:4, lower:true },
]

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function makeQuestions(level) {
  const cfg = LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))]
  const known = cfg.letters ?? []
  const review = shuffle(ALL_LETTERS.filter(l => !known.includes(l))).slice(0, cfg.review ?? 0)
  const letters = shuffle([...known, ...review])

  return letters.map(l => {
    const correct = shuffle(LETTER_DATA[l].opts)[0]
    const blocked = new Set([l, ...(SAME_SOUND[l] ?? [])])
    // Falsche Antworten aus anderen Buchstaben, je eine pro Buchstabe — nie
    // ein gleich klingender, nie dasselbe Bild wie die richtige Antwort.
    const distractors = shuffle(ALL_LETTERS.filter(k => !blocked.has(k)))
      .map(k => shuffle(LETTER_DATA[k].opts)[0])
      .filter(o => o.e !== correct.e)
      .slice(0, cfg.options - 1)
    return { letter: l, correct, options: shuffle([correct, ...distractors]) }
  })
}

/** What the round says first: "B wie Ball. Hör mal: Bö, Ball." */
function infoOf(l) {
  const d = LETTER_DATA[l]
  if (d.note) return { show: d.note, say: d.say ?? d.note }
  return { show: `${l} wie ${d.ex}`, say: `${l} wie ${d.ex}. Hör mal: ${soundOf(l)}, ${d.ex}.` }
}

const ABC = 'audio/abc-abenteuer/'
const NEXT_BTN = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.4)' }

// ─── Component ────────────────────────────────────────────────────────────────
export default function LetterIntroGame({ level = 1, onComplete }) {
  const questions = useMemo(() => makeQuestions(level), [level])
  const lower = !!LEVELS[Math.min(level, LEVELS.length) - 1]?.lower
  const paused = usePaused()

  const [idx,      setIdx]      = useState(0)
  const [solved,   setSolved]   = useState(false)
  const [wrong,    setWrong]    = useState([])     // this round's wrong taps
  const [shakeOpt, setShakeOpt] = useState(null)
  const [ready,    setReady]    = useState(false)  // the task has been said
  const [firstTry, setFirstTry] = useState(0)
  const [leaving,  setLeaving]  = useState(false)

  const q = questions[idx]
  const info = q && infoOf(q.letter)
  const shown = q && (lower ? q.letter.toLowerCase() : q.letter)

  useEffect(() => { lockPreviews(); return () => stopNarration() }, [])

  // Merksatz, dann die Frage, als eine Ansage. Bis sie durch ist, zählen die
  // Karten noch nicht: wer sofort tippte, brach den Merksatz ab und hörte die
  // eigentliche Frage nie.
  const sayRound = useCallback(() => {
    if (!q) return
    narrate([
      { text: info.say },
      { src: ABC + `welches-wort-beginnt-mit-${q.letter.toLowerCase()}.mp3`, text: `Welches Wort beginnt mit ${q.letter}?`, gap: 250 },
    ])
    afterNarration(() => setReady(true), { maxMs: 12000 })
  }, [q, info])

  // Auch nach dem Schließen der Hilfe noch einmal, solange die Runde läuft.
  useEffect(() => {
    if (paused || solved) return
    const t = setTimeout(sayRound, 400)
    return () => clearTimeout(t)
  }, [idx, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (opt) => {
    if (solved || !ready || wrong.includes(opt)) return
    if (opt === q.correct) {
      sfx.correct()
      if (!wrong.length) setFirstTry(n => n + 1)
      sayRight(`${opt.w} beginnt mit ${q.letter}.`)
      setSolved(true)
      return
    }
    sfx.wrong()
    setShakeOpt(opt)
    setTimeout(() => setShakeOpt(null), 600)
    const misses = [...wrong, opt]
    setWrong(misses)
    if (misses.length >= 2) {
      // Nach zwei Fehlern zeigt Lumi die Lösung, statt raten zu lassen.
      narrate([{ text: `Schau mal: ${q.correct.w} beginnt mit ${q.letter}.` }])
      setSolved(true)
    } else {
      sayWrong(`${opt.w} beginnt mit ${opt.w[0].toUpperCase()}. Such ein Wort mit ${q.letter}!`)
    }
  }

  const weiterClick = () => {
    if (leaving) return
    if (idx + 1 >= questions.length) {
      setLeaving(true)
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry, questions.length)), { minMs: 300 })
    } else {
      lockPreviews()
      setSolved(false); setWrong([]); setReady(false)
      setIdx(idx + 1)
    }
  }

  if (!q) return null
  const color = colorOf(q.letter)

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-evenly',
      gap:'clamp(10px,2vh,18px)', padding:'clamp(12px,3vw,24px)', width:'100%', boxSizing:'border-box',
    }}>

      {/* Progress */}
      <div style={{ width:'100%', maxWidth:520, height:14, background:'rgba(42,27,61,0.12)', border:`2px solid ${INK}`, borderRadius:4, overflow:'hidden', boxSizing:'border-box' }}>
        <motion.div
          animate={{ width:`${((idx + (solved ? 1 : 0)) / questions.length) * 100}%` }}
          style={{ height:'100%', background:'var(--px-green)', borderRadius:2, boxShadow:'inset 0 -3px 0 rgba(0,0,0,0.18)' }}
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
          style={{ textAlign:'center', display:'flex', flexDirection:'row', alignItems:'baseline', justifyContent:'center', gap:'clamp(12px,3vw,28px)' }}
        >
          {/* Ab Level 5 ist der kleine Buchstabe der große */}
          <div style={{
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(130px,24vw,210px)',
            lineHeight:1, userSelect:'none',
            color,
            WebkitTextStroke:`5px ${INK}`, paintOrder:'stroke fill',
            filter:'drop-shadow(0 6px 0 rgba(42,27,61,0.35))',
          }}>
            {shown}
          </div>
          <div style={{
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(80px,15vw,130px)',
            lineHeight:1, userSelect:'none',
            color, opacity:0.85,
            WebkitTextStroke:`3px ${INK}`, paintOrder:'stroke fill',
          }}>
            {lower ? q.letter : q.letter.toLowerCase()}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Merksatz, und die ganze Ansage noch einmal — ein Kind, das sie
          überhört hat, kam sonst nicht mehr an sie heran. */}
      <div style={{ display:'flex', alignItems:'center', gap:12, maxWidth:520, width:'100%' }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={'info-' + idx}
            initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            transition={{ delay:0.3, duration:0.35 }}
            style={{
              flex:1,
              background:`linear-gradient(${color}1f, ${color}1f), var(--px-parch-light)`,
              border:`3px solid ${INK}`,
              borderRadius:12,
              boxShadow:'0 5px 0 rgba(42,27,61,0.35)',
              padding:'10px 18px',
              fontFamily:'var(--font-heading)',
              fontSize:'clamp(16px,3.2vw,21px)',
              color:INK,
              textAlign:'center',
            }}
          >
            {info.show}
          </motion.div>
        </AnimatePresence>
        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          onClick={sayRound}
          aria-label="Frage noch einmal anhören"
          style={{ ...pxButton('parch'), width:52, height:52, flexShrink:0, fontSize:24, lineHeight:1, padding:0 }}
        >🔊</motion.button>
      </div>

      {/* Question */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(17px,3.5vw,23px)', color:INK, textAlign:'center' }}>
          Welches Wort beginnt mit <strong style={{ borderBottom:`4px solid ${color}` }}>{shown}</strong>?
        </div>
        <HearOptions items={q.options.map(o => o.w)} label="Alle Wörter vorlesen" size={48} />
      </div>

      {/* Options */}
      <div style={{
        display:'grid', gridTemplateColumns:`repeat(${q.options.length}, minmax(0, 1fr))`,
        gap:'clamp(10px,2.5vw,20px)', width:'100%', maxWidth: q.options.length * 170,
        opacity: ready || solved ? 1 : 0.7, transition:'opacity 0.3s',
      }}>
        {q.options.map((opt, i) => {
          const isCorrect = opt === q.correct
          const isWrong   = wrong.includes(opt)
          const cardState = solved && isCorrect ? 'right' : isWrong ? 'wrong' : undefined
          const live      = ready && !solved && !isWrong

          return (
            <motion.button
              key={`${idx}-${i}`}
              animate={opt === shakeOpt
                ? { x:[0,-10,10,-7,7,-3,3,0] }
                : { scale: solved && isCorrect ? [1, 1.08, 1] : 1 }}
              transition={{ duration:0.45 }}
              whileHover={live ? { scale:1.06, y:-3 } : {}}
              whileTap={live ? { scale:0.94 } : {}}
              onClick={() => pick(opt)}
              {...hearable(opt.w, { enabled: !solved })}
              style={{
                ...pxCard(cardState),
                padding:'clamp(12px,2.6vw,20px) 6px',
                cursor: live ? 'pointer' : 'default',
                display:'flex', flexDirection:'column', alignItems:'center', gap:8,
                position:'relative', minWidth:0,
                opacity: isWrong && !solved ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize:'clamp(48px,10vw,72px)', lineHeight:1, minHeight:'1em' }}>
                {opt.e}
              </span>
              <span style={{
                fontFamily:'var(--font-heading)',
                fontSize:'clamp(14px,2.8vw,19px)',
                color:INK, fontWeight:700,
                textAlign:'center', overflowWrap:'anywhere',
              }}>
                {opt.w}
              </span>
              {solved && isCorrect && (
                <motion.span
                  initial={{ scale:0 }} animate={{ scale:1 }}
                  transition={{ type:'spring', stiffness:500 }}
                  style={{ fontSize:24, position:'absolute', top:-12, right:-10 }}
                >✅</motion.span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Weiter — der Platz ist immer da, damit nichts springt */}
      <div style={{ minHeight:64, display:'flex', alignItems:'center' }}>
        {solved && (
          <motion.button
            initial={{ scale:0 }} animate={{ scale:1 }}
            transition={{ type:'spring', stiffness:300, delay:0.2 }}
            whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
            onClick={weiterClick}
            {...hearable('Weiter')}
            style={{ ...NEXT_BTN, padding:'14px 40px', fontSize:20, minHeight:56 }}
          >Weiter! →</motion.button>
        )}
      </div>
    </div>
  )
}
