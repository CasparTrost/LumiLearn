import { useState, useMemo, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, afterNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { soundOf } from './letterSounds.js'
import { Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts } from '../components/play/index.js'
import { useRounds, useSpeaking, shuffle, chance, reduceMotion } from './buchstaben/useRounds.js'
import LetterMonster from './buchstaben/LetterMonster.jsx'
import { pxButton, INK } from './px.js'

/**
 * ABC-Abenteuer: das Buchstaben-Monster.
 *
 * Jeder Buchstabe ist ein Monster mit Augen und Mund. Es sagt seinen Laut
 * ("B wie Ball") und hat Hunger, aber nur auf Dinge, die mit seinem Laut
 * anfangen. Das Kind füttert es: ziehen oder antippen. Ein falsches Ding
 * spuckt es wieder aus ("Bäh!"), ein richtiges mampft es und freut sich.
 * Der Buchstabe wird so zur Figur, der man einen Gefallen tut — gelernt
 * wird dasselbe wie vorher: Buchstabe, Laut und Wörter mit diesem Anlaut.
 */

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

// Kräftige Farben, jede mit dunkler Kontur — vor dem Wald gut zu sehen.
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

/** What the round says first: "B wie Ball. Hör mal, Bö, Ball." */
function infoOf(l) {
  const d = LETTER_DATA[l]
  if (d.note) return { show: d.note, say: d.say ?? d.note }
  return { show: `${l} wie ${d.ex}`, say: `${l} wie ${d.ex}. Hör mal, ${soundOf(l)}, ${d.ex}.` }
}

const ABC = 'audio/abc-abenteuer/'

// ─── Component ────────────────────────────────────────────────────────────────
export default function LetterIntroGame({ level = 1, onComplete }) {
  const questions = useMemo(() => makeQuestions(level), [level])
  const lower = !!LEVELS[Math.min(level, LEVELS.length) - 1]?.lower
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()
  const speaking = useSpeaking()
  const monsterRef = useRef(null)

  const [readyAt, setReadyAt] = useState(-1)    // the round whose task has been said
  const [eatenIn, setEaten]   = useState(null)  // { i, opt }: the right thing of round i, eaten
  const [spit,    setSpit]    = useState(null)  // a wrong thing, flying back out

  // Merksatz, dann die Frage, als eine Ansage. Bis sie durch ist, lässt sich
  // noch nichts füttern: wer sofort fütterte, brach den Merksatz ab und hörte
  // die eigentliche Frage nie.
  const idxRef = useRef(0)
  const sayRound = useCallback(() => {
    const i = idxRef.current, q = questions[i]
    if (!q) return
    const info = infoOf(q.letter)
    narrate([
      i === 0 && { text: 'Das Buchstaben-Monster hat Hunger! Es frisst nur Sachen, die mit seinem Laut anfangen.' },
      { text: info.say, gap: i === 0 ? 300 : 0 },
      { src: ABC + `welches-wort-beginnt-mit-${q.letter.toLowerCase()}.mp3`, text: `Welches Wort beginnt mit ${q.letter}?`, gap: 250 },
    ])
    afterNarration(() => setReadyAt(i), { maxMs: 15000 })
  }, [questions])

  const { idx, done, leaving, tried, win, miss, reveal } = useRounds(questions.length, { onComplete, sayTask: sayRound, outroMs: 550 })
  idxRef.current = idx
  const q = questions[idx]
  const ready = readyAt === idx
  const eaten = eatenIn?.i === idx ? eatenIn.opt : null

  const munch = (then) => {
    setMood('eat', 900)
    sfx.chomp()
    setTimeout(then, 850)
  }

  const feed = (opt) => {
    if (done || tried.includes(opt)) return false
    if (opt === q.correct) {
      setEaten({ i: idx, opt })
      win()
      sayRight(`Lecker! ${opt.w} beginnt mit ${q.letter}.`)
      munch(() => {
        // now and then a little burp: the classic giggle
        if (chance(0.3)) { sfx.burp(); setMood('burp', 900) } else setMood('happy', 1400)
        burst(monsterRef.current, 'hearts')
      })
      return true
    }
    setSpit(opt)
    munch(() => { setMood('yuck', 1100); sfx.boing() })
    setTimeout(() => setSpit(null), 1700)
    const first = opt.w[0].toUpperCase()
    if (miss(opt) >= 2) {
      // Nach zwei Fehlern zeigt das Monster die Lösung und frisst sie selbst.
      sayWrong(`Bäh! Schau mal, ${q.correct.w} beginnt mit ${q.letter}.`)
      reveal()
      setTimeout(() => { setEaten({ i: idx, opt: q.correct }); munch(() => setMood('happy', 1200)) }, 2200)
    } else {
      sayWrong(`Bäh! ${opt.w} beginnt mit ${first}. Das Monster mag nur Sachen mit ${q.letter}.`)
    }
    return true
  }

  // Tickling the monster: it giggles and says its sound
  const tickle = () => {
    if (!ready || done) return
    sfx.giggle()
    setMood('happy', 900)
    const s = soundOf(q.letter)
    narrate([{ text: `${s}! ${s}!` }])
  }

  if (!q) return null
  const info = infoOf(q.letter)
  const color = colorOf(q.letter)
  const shown = lower ? q.letter.toLowerCase() : q.letter
  const live = ready && !done
  const faceMood = mood === 'idle' && speaking ? 'talk' : mood

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-evenly',
      gap:'clamp(6px,1.5vh,14px)', padding:'clamp(10px,2vw,20px) clamp(12px,3vw,24px)', width:'100%', boxSizing:'border-box',
    }}>
      <RoundTrail total={questions.length} done={idx + (done ? 1 : 0)} walker="🐛" goal="🎂" style={{ width:'calc(100% - 80px)', maxWidth:520 }} />

      <DragArea autoTarget="monster" disabled={!live}>
        {/* Merksatz — and the whole task once more */}
        <div style={{ display:'flex', alignItems:'center', gap:10, maxWidth:560 }}>
          <motion.div key={'info-' + idx} initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
            transition={{ delay:0.35, type:'spring', stiffness:380, damping:18 }}
            style={{
              background:'#fffdf7', border:`3px solid ${INK}`, borderRadius:18, boxShadow:'0 5px 0 rgba(42,27,61,0.3)',
              padding:'8px 18px', fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'clamp(17px,3.2vw,22px)',
              color:INK, textAlign:'center',
            }}>
            {info.show}
          </motion.div>
          <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }} onClick={sayRound}
            aria-label="Frage noch einmal anhören"
            style={{ ...pxButton('parch'), width:52, height:52, flexShrink:0, fontSize:24, lineHeight:1, padding:0 }}>🔊</motion.button>
        </div>

        {/* The monster walks in, eats, and walks off */}
        <motion.div key={idx} ref={monsterRef}
          initial={reduceMotion() ? { opacity:0 } : { x:-420, opacity:0 }}
          animate={leaving ? (reduceMotion() ? { opacity:0 } : { x:460, opacity:0, rotate:8 }) : { x:0, opacity:1, rotate:0 }}
          transition={leaving ? { duration:0.5, ease:'easeIn' } : { type:'spring', stiffness:140, damping:15 }}
          style={{ position:'relative' }}>
          <DropZone id="monster" onDrop={feed} label={`Buchstaben-Monster ${shown}`} slop={40}>
            {hover => (
              <div onClick={tickle} style={{ cursor:'pointer' }}>
                <LetterMonster letter={shown} small={lower ? q.letter : q.letter.toLowerCase()} color={color}
                  mood={hover ? 'hungry' : faceMood} size={250} />
              </div>
            )}
          </DropZone>
          <AnimatePresence>
            {spit && !reduceMotion() && (
              <motion.div key={spit.w} aria-hidden="true"
                initial={{ x:0, y:0, scale:0.3, rotate:0, opacity:0 }}
                animate={{ x:[0, 0, 170], y:[0, 0, -90, 60], scale:[0.3, 0.3, 1, 0.9], rotate:[0, 0, 300, 420], opacity:[0, 1, 1, 0] }}
                transition={{ duration:1.4, times:[0, 0.35, 0.7, 1] }}
                style={{ position:'absolute', left:'50%', top:'55%', marginLeft:-45, marginTop:-45, pointerEvents:'none' }}>
                <Art art={spit.e} size={90} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Food on the picnic blanket */}
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'center', gap:'clamp(8px,2vw,18px)', flexWrap:'wrap',
          padding:'10px clamp(10px,2.5vw,24px)', borderRadius:26, maxWidth:'100%', boxSizing:'border-box',
          background:'repeating-conic-gradient(#f3b8b0 0 25%, #fffdf7 0 50%) 0 0 / 36px 36px',
          border:`3px solid ${INK}`, boxShadow:'0 6px 0 rgba(42,27,61,0.25)',
        }}>
          {q.options.map((opt, i) => {
            const gone = opt === eaten || opt === spit
            const isTried = tried.includes(opt)
            return (
              <motion.div key={`${idx}-${opt.w}`}
                initial={{ y:-50, scale:0, opacity:0 }}
                animate={gone ? { scale:0, opacity:0 } : { y:0, scale:1, opacity: isTried ? 0.45 : 1 }}
                transition={{ delay: gone ? 0 : 0.5 + i * 0.09, type:'spring', stiffness:380, damping:17 }}
                style={{ width:'clamp(92px,19vw,124px)' }}>
                <Draggable id={opt.w} data={opt} disabled={isTried || gone} label={opt.w}>
                  <div {...hearable(opt.w, { enabled: !done })} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'8px 4px',
                    background:'#fffdf7', border:`3px solid ${INK}`, borderRadius:'50%/46%',
                    boxShadow:'0 4px 0 rgba(42,27,61,0.25)', filter: isTried ? 'grayscale(0.8)' : undefined,
                  }}>
                    <Art art={opt.e} size={70} />
                    <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'clamp(13px,2.4vw,16px)', color:INK,
                      textAlign:'center', overflowWrap:'anywhere', lineHeight:1.1 }}>{opt.w}</span>
                  </div>
                </Draggable>
              </motion.div>
            )
          })}
          <HearOptions items={q.options.map(o => o.w)} label="Alle Wörter vorlesen" size={48} />
        </div>
      </DragArea>
      {bursts}
    </div>
  )
}
