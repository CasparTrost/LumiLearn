import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, afterNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { Art, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts } from '../components/play/index.js'
import { useRounds, useSpeaking, shuffle, chance, reduceMotion, hintDelay } from './buchstaben/useRounds.js'
import { rec, slug, wordRec, soundRec, hearWord } from './buchstaben/voice.js'
import LetterMonster from './buchstaben/LetterMonster.jsx'
import { pxButton, INK } from './px.js'

/**
 * ABC-Abenteuer: das Buchstaben-Monster.
 *
 * Jeder Buchstabe ist ein Monster mit Augen und Mund. In seiner Sprechblase
 * zeigt es, wie es klingt: "A" und ein Affe. Es hat Hunger, aber nur auf
 * Dinge, die so anfangen wie sein Laut. Das Kind füttert es: ziehen oder
 * antippen. Ein falsches Ding spuckt es wieder aus ("Bäh!") und zeigt
 * daran dessen Buchstaben, und es fliegt in die Ecke, wo es für den Rest des
 * Levels liegen bleibt; ein richtiges mampft es, und es landet in der
 * Sprechblase bei den anderen. Satte Monster gehen nicht weg: Sie stellen
 * sich in eine Reihe am Waldrand, die über das Level wächst. Gelernt wird dasselbe wie vorher: Buchstabe,
 * Laut und Wörter mit diesem Anlaut.
 */

// ─── Data ─────────────────────────────────────────────────────────────────────
// Jedes Bild zeigt eindeutig sein Wort, und jedes Wort fängt mit dem Laut
// seines Buchstabens an: kein "Stern" unter S (das ist "scht"), kein "Ei"
// oder "Eule" unter E, keine Glühbirne als "Lampe", kein Igel-Bild für das
// Eichhörnchen. Kein Bild kommt zweimal vor.
//
// `ex` ist das Beispiel, das das Monster in seiner Sprechblase zeigt ("A wie
// Affe"): ohne Worte der Schlüssel zum Laut. Es steht bewusst nicht unter
// den Antworten, sonst wäre die Antwort schon vorgesagt. X und Y haben kein
// zweites Bild — dort steht nur der Buchstabe.
const LETTER_DATA = {
  A: { ex:{ e:'🐒', w:'Affe' },     opts:[{ e:'🍎', w:'Apfel' },   { e:'🐜', w:'Ameise' },  { e:'🍍', w:'Ananas' },  { e:'🦅', w:'Adler' }]},
  B: { ex:{ e:'🐻', w:'Bär' },      opts:[{ e:'🌸', w:'Blume' },   { e:'🐝', w:'Biene' },    { e:'🍌', w:'Banane' }]},
  C: { ex:{ e:'🤡', w:'Clown' },    opts:[{ e:'💻', w:'Computer' }, { e:'🥐', w:'Croissant' }]},
  D: { ex:{ e:'🦖', w:'Dino' },     opts:[{ e:'🐉', w:'Drache' },   { e:'🥫', w:'Dose' }]},
  E: { ex:{ e:'🦆', w:'Ente' },     opts:[{ e:'🐘', w:'Elefant' },  { e:'🍓', w:'Erdbeere' }, { e:'🫏', w:'Esel' }]},
  F: { ex:{ e:'🐟', w:'Fisch' },    opts:[{ e:'🐸', w:'Frosch' },   { e:'🦊', w:'Fuchs' },   { e:'🪶', w:'Feder' }]},
  G: { ex:{ e:'🦒', w:'Giraffe' },  opts:[{ e:'👻', w:'Geist' },    { e:'🎁', w:'Geschenk' }, { e:'🥒', w:'Gurke' }]},
  H: { ex:{ e:'🐶', w:'Hund' },     opts:[{ e:'🐰', w:'Hase' },     { e:'🏠', w:'Haus' },    { e:'🐓', w:'Hahn' }]},
  I: { ex:{ e:'🦔', w:'Igel' },     opts:[{ e:'🏝️', w:'Insel' }]},
  J: { ex:{ e:'🧥', w:'Jacke' },    opts:[{ e:'🪀', w:'Jo-Jo' }]},
  K: { ex:{ e:'🐱', w:'Katze' },    opts:[{ e:'👑', w:'König' },    { e:'🐨', w:'Koala' },   { e:'🧀', w:'Käse' }]},
  L: { ex:{ e:'🦁', w:'Löwe' },     opts:[{ e:'🦙', w:'Lama' },     { e:'🪜', w:'Leiter' }]},
  M: { ex:{ e:'🐭', w:'Maus' },     opts:[{ e:'🌙', w:'Mond' },     { e:'🥛', w:'Milch' }]},
  N: { ex:{ e:'👃', w:'Nase' },     opts:[{ e:'🪺', w:'Nest' },     { e:'🍝', w:'Nudeln' }]},
  O: { ex:{ e:'👵', w:'Oma' },      opts:[{ e:'👂', w:'Ohr' },      { e:'🍊', w:'Orange' }]},
  P: { ex:{ e:'🐧', w:'Pinguin' },  opts:[{ e:'🍄', w:'Pilz' },     { e:'🐼', w:'Panda' },   { e:'🦜', w:'Papagei' }]},
  Q: { ex:{ e:'🪼', w:'Qualle' },   opts:[{ e:'🟥', w:'Quadrat' }]},
  R: { ex:{ e:'🚀', w:'Rakete' },   opts:[{ e:'🤖', w:'Roboter' },  { e:'🌹', w:'Rose' }]},
  S: { ex:{ e:'☀️', w:'Sonne' },    opts:[{ e:'🛋️', w:'Sofa' },     { e:'🧦', w:'Socke' },   { e:'🥗', w:'Salat' },   { e:'🧼', w:'Seife' }]},
  T: { ex:{ e:'🐯', w:'Tiger' },    opts:[{ e:'🚜', w:'Traktor' },  { e:'🥁', w:'Trommel' }, { e:'🍅', w:'Tomate' }]},
  U: { ex:{ e:'🦉', w:'Uhu' },      opts:[{ e:'🛸', w:'Ufo' }]},
  V: { ex:{ e:'🐦', w:'Vogel' },    opts:[{ e:'🌋', w:'Vulkan' },   { e:'🏺', w:'Vase' }]},
  W: { ex:{ e:'🐋', w:'Wal' },      opts:[{ e:'🐺', w:'Wolf' },     { e:'☁️', w:'Wolke' },   { e:'🪱', w:'Wurm' }]},
  X: {                              opts:[{ e:':px-xylofon:', w:'Xylofon' }]},
  Y: {                              opts:[{ e:'🧘', w:'Yoga' }]},
  Z: { ex:{ e:'🦓', w:'Zebra' },    opts:[{ e:'🦷', w:'Zahn' },     { e:'🚂', w:'Zug' },     { e:'🍋', w:'Zitrone' }, { e:'⛺', w:'Zelt' }]},
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
    return { letter: l, ex: LETTER_DATA[l].ex, correct, options: shuffle([correct, ...distractors]) }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LetterIntroGame({ level = 1, onComplete }) {
  const questions = useMemo(() => makeQuestions(level), [level])
  const lower = !!LEVELS[Math.min(level, LEVELS.length) - 1]?.lower
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()
  const speaking = useSpeaking()
  const monsterRef = useRef(null)
  const gapRef = useRef(null)
  const rootRef = useRef(null)

  const [readyAt, setReadyAt] = useState(-1)    // the round whose task has been said
  const [eatenIn, setEaten]   = useState(null)  // { i, opt }: the right thing of round i, eaten
  const [spit,    setSpit]    = useState(null)  // a wrong thing, flying back out
  const [shout,   setShout]   = useState(0)     // tickled: it shows its letter
  const [lineup,  setLineup]  = useState([])    // the fed monsters, in a row at the forest edge
  const [pile,    setPile]    = useState([])    // spat-out things, stuck in the corners for the level
  const [cheers,  setCheers]  = useState(0)     // the row wiggles each time a monster eats

  // The example and the sound ("A wie Affe." "Ah"), once Lumi has recorded
  // them. Until it is said, nothing can be fed: whoever fed at once cut the
  // sentence off and never heard it.
  const idxRef = useRef(0)
  const sayRound = useCallback(() => {
    const i = idxRef.current, q = questions[i]
    if (!q) return
    narrate([i === 0 && rec('abc/hunger'), rec(`abc/${slug(q.letter)}`), soundRec(q.letter)])
    afterNarration(() => setReadyAt(i), { maxMs: 15000 })
  }, [questions])

  const { idx, done, leaving, finale, tried, streak, win, miss, reveal, isOver, hasTried } =
    useRounds(questions.length, { onComplete, sayTask: sayRound, outroMs: 550 })
  idxRef.current = idx
  const q = questions[idx]
  const ready = readyAt === idx
  const eaten = eatenIn?.i === idx ? eatenIn.opt : null

  // a new monster starts calm, whatever the last one was doing
  useEffect(() => { setMood('idle'); setSpit(null) }, [idx, setMood])
  // a fed monster hops into the row (at the end of the level, too)
  useEffect(() => {
    if (!(leaving || finale) || !q) return
    setLineup(l => (l.some(m => m.i === idx) ? l : [...l, { i: idx, letter: lower ? q.letter.toLowerCase() : q.letter, color: colorOf(q.letter) }]))
  }, [leaving, finale]) // eslint-disable-line react-hooks/exhaustive-deps
  // the end of the level: one more dance and confetti
  useEffect(() => {
    if (!finale) return
    setMood('dance', 1800)
    burst(monsterRef.current, 'confetti', 18)
  }, [finale, setMood, burst])

  // A spat-out thing flies from the monster's mouth into a corner, where it
  // stays: left, right, left … one under the other, in game units (FitBox).
  const spitOut = (opt) => {
    const root = rootRef.current, m = monsterRef.current
    if (!root || !m) return
    const rr = root.getBoundingClientRect(), mr = m.getBoundingClientRect()
    const k = rr.width / root.offsetWidth || 1
    setPile(list => {
      const n = list.length, right = n % 2 === 1, row = Math.floor(n / 2) % 6
      const tx = right ? root.offsetWidth - 58 - (row % 2) * 26 : 10 + (row % 2) * 26
      return [...list, {
        id: n, e: opt.e, tx, ty: 92 + row * 38, rot: (n * 37 % 50) - 25,
        sx: (mr.left + mr.width / 2 - rr.left) / k - 24, sy: (mr.top + mr.height * 0.55 - rr.top) / k - 24,
      }]
    })
  }

  const munch = (then) => {
    setMood('eat', 900)
    sfx.chomp()
    setTimeout(then, 850)
  }

  const feed = (opt) => {
    if (isOver() || hasTried(opt)) return false
    if (opt === q.correct) {
      setEaten({ i: idx, opt })
      setTimeout(() => setCheers(c => c + 1), 850)
      const party = !tried.length && streak + 1 >= 3   // three in a row: it dances
      win(party ? 2800 : 2300)
      sayRight()
      munch(() => {
        // now and then a little burp: the running gag
        if (party) { sfx.tada(); setMood('dance', 1600) }
        else if (chance(0.3)) { sfx.burp(); setMood('burp', 900) }
        else setMood('happy', 1400)
        burst(monsterRef.current, party ? 'confetti' : 'hearts', party ? 16 : 10)
      })
      return true
    }
    setSpit(opt)
    munch(() => { setMood('yuck', 1100); sfx.boing(); spitOut(opt) })
    setTimeout(() => setSpit(s => (s === opt ? null : s)), 1700)
    sayWrong()
    if (miss(opt) >= 2) {
      // Nach zwei Fehlern zeigt das Monster die Lösung und frisst sie selbst.
      reveal(3200)
      setTimeout(() => { setEaten({ i: idx, opt: q.correct }); munch(() => { setMood('happy', 1200); setCheers(c => c + 1) }) }, 1500)
    }
    return true
  }

  // Tickling the monster: it giggles and shouts its letter (and its sound,
  // once recorded)
  const tickle = () => {
    if (isOver()) return
    sfx.giggle()
    setMood('happy', 900)
    setShout(n => n + 1)
    narrate([soundRec(q.letter)])
  }

  if (!q) return null
  const color = colorOf(q.letter)
  const shown = lower ? q.letter.toLowerCase() : q.letter
  const caseOf = w => (lower ? w[0].toLowerCase() : w[0].toUpperCase())
  const live = ready && !done
  const faceMood = mood === 'idle' && speaking ? 'talk' : mood
  const voiced = rec(`abc/${slug(q.letter)}`) || soundRec(q.letter)
  const showAnswer = done && tried.length >= 2 && !eaten
  const heard = q.options.map(o => wordRec(o.w)).filter(Boolean)

  return (
    <div ref={rootRef} style={{
      position:'relative', flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'space-evenly',
      gap:'clamp(6px,1.5vh,14px)', padding:'clamp(10px,2vw,20px) clamp(12px,3vw,24px)', width:'100%', boxSizing:'border-box',
    }}>
      <RoundTrail total={questions.length} done={idx + (done ? 1 : 0)} walker="🐛" goal="🎂" style={{ width:'calc(100% - 80px)', maxWidth:520 }} />

      <DragArea autoTarget="monster" disabled={!live}>
        {/* What the monster wants: its letter, like the example — and what it already ate */}
        <motion.div key={'want-' + idx} initial={{ scale:0, opacity:0 }} animate={leaving ? { scale:0, opacity:0 } : { scale:1, opacity:1 }}
          transition={leaving ? { duration:0.25 } : { delay:0.2, type:'spring', stiffness:380, damping:18 }}
          style={{
            position:'relative', display:'flex', alignItems:'center', gap:10, minHeight:76,
            background:'#fffdf7', border:`3px solid ${INK}`, borderRadius:22, boxShadow:'0 5px 0 rgba(42,27,61,0.3)',
            padding:'6px 16px',
          }}>
          <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:52, lineHeight:1, color,
            WebkitTextStroke:`2.5px ${INK}`, paintOrder:'stroke fill' }}>{shown}</span>
          {q.ex && <>
            <Example item={q.ex} color={color} />
          </>}
          <AnimatePresence>
            {eaten && (
              <motion.div key="ate" initial={{ scale:0, width:0 }} animate={{ scale:1, width:'auto' }}
                transition={{ delay:0.9, type:'spring', stiffness:300, damping:16 }}
                style={{ display:'flex', alignItems:'center', gap:10 }}>
                <Example item={eaten} color={color} />
              </motion.div>
            )}
          </AnimatePresence>
          {voiced && (
            <motion.button whileHover={{ scale:1.08 }} whileTap={{ scale:0.92 }} onClick={sayRound}
              aria-label="Noch einmal anhören"
              style={{ ...pxButton('parch'), width:52, height:52, flexShrink:0, fontSize:24, lineHeight:1, padding:0 }}>🔊</motion.button>
          )}
          {/* the tail, pointing down to the monster */}
          <span aria-hidden="true" style={{ position:'absolute', left:'50%', bottom:-15, marginLeft:-11, borderStyle:'solid', borderWidth:'14px 11px 0 11px', borderColor:`${INK} transparent transparent transparent` }} />
        </motion.div>

        {/* The monster walks in, eats, and walks off */}
        <motion.div key={idx} ref={monsterRef}
          initial={reduceMotion() ? { opacity:0 } : { x:-420, opacity:0 }}
          animate={leaving ? (reduceMotion() ? { opacity:0 } : { y:[0, -40, 150], scale:[1, 1, 0.2], opacity:[1, 1, 0] }) : { x:0, opacity:1, rotate:0 }}
          transition={leaving ? { duration:0.5, ease:'easeIn' } : { type:'spring', stiffness:140, damping:15 }}
          style={{ position:'relative' }}>
          <DropZone id="monster" onDrop={feed} label={`Buchstaben-Monster ${shown}`} slop={40}>
            {hover => (
              <div onClick={tickle} style={{ cursor:'pointer' }}>
                <LetterMonster letter={shown} small={lower ? q.letter : q.letter.toLowerCase()} color={color}
                  mood={hover && live ? 'hungry' : faceMood} size={240} />
              </div>
            )}
          </DropZone>
          {/* tickled: it shouts its letter */}
          <AnimatePresence>
            {shout > 0 && (
              <motion.div key={shout} aria-hidden="true"
                initial={{ scale:0.3, opacity:0, y:0 }} animate={{ scale:[0.3, 1.2, 1], opacity:[0, 1, 0], y:-50 }}
                transition={{ duration:0.9 }}
                style={{ position:'absolute', right:-30, top:10, pointerEvents:'none', fontFamily:'var(--font-heading)', fontWeight:700,
                  fontSize:56, color, WebkitTextStroke:`2.5px ${INK}`, paintOrder:'stroke fill' }}>{shown}!</motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* The fed monsters, in a row at the forest edge */}
        <Lineup monsters={lineup} cheers={cheers} party={finale} />

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
            const glow = showAnswer && opt === q.correct
            return (
              <motion.div key={`${idx}-${opt.w}`}
                initial={{ y:-50, scale:0, opacity:0 }}
                animate={gone || leaving ? { scale:0, opacity:0 }
                  : glow && !reduceMotion() ? { y:[0, -16, 0], scale:[1, 1.12, 1], opacity:1 }
                  : { y:0, scale:1, opacity: isTried ? 0.5 : 1 }}
                transition={gone || leaving ? { duration:0.2 }
                  : glow ? { duration:0.6, repeat:Infinity }
                  : { delay: 0.05 + i * 0.05, type:'spring', stiffness:380, damping:17 }}
                style={{ position:'relative', width:'clamp(96px,19vw,124px)' }}>
                {/* between the first and the second: the hint hand points here, never at one answer */}
                {i === 0 && <span ref={gapRef} aria-hidden="true" style={{ position:'absolute', right:-10, top:'50%', width:2, height:2 }} />}
                <Draggable id={opt.w} data={opt} disabled={isTried || gone} label={opt.w}>
                  <div {...hearWord(opt.w, !done)} style={{
                    display:'flex', flexDirection:'column', alignItems:'center', gap:2, padding:'8px 4px',
                    background:'#fffdf7', border:`3px solid ${glow ? '#ffc93c' : INK}`, borderRadius:'50%/46%',
                    boxShadow: glow ? '0 0 0 5px #ffc93c' : '0 4px 0 rgba(42,27,61,0.25)', filter: isTried ? 'grayscale(0.8)' : undefined,
                  }}>
                    <Art art={opt.e} size={74} />
                    {/* the word only after the choice: before, an E would be found by
                        matching printed first letters instead of thinking of the sound */}
                    <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'clamp(13px,2.4vw,16px)', color:INK,
                      textAlign:'center', overflowWrap:'anywhere', lineHeight:1.1, visibility: isTried || done ? 'visible' : 'hidden' }}>{opt.w}</span>
                  </div>
                </Draggable>
                {/* spat out: it shows its own letter, which is not the monster's */}
                {isTried && !gone && (
                  <motion.span aria-hidden="true" initial={{ scale:0 }} animate={{ scale:1 }} transition={{ type:'spring', stiffness:400 }}
                    style={{ position:'absolute', top:-6, right:-4, width:38, height:38, borderRadius:'50%', background:'#fffdf7',
                      border:`3px solid ${INK}`, display:'flex', alignItems:'center', justifyContent:'center',
                      fontFamily:'var(--font-heading)', fontWeight:700, fontSize:24, color:'#6b6b7a' }}>{caseOf(opt.w)}</motion.span>
                )}
              </motion.div>
            )
          })}
          {heard.length > 0 && <HearOptions items={heard} label="Alle Wörter anhören" size={48} />}
        </div>
        <HintHand from={gapRef} to={monsterRef} active={live && !leaving && !finale} delay={hintDelay(idx)} />
      </DragArea>
      {/* spat-out things, stuck where they landed */}
      {pile.map(t => <Spat key={t.id} t={t} />)}
      {bursts}
    </div>
  )
}

/** A spat-out thing: it flies in an arc from the mouth and stays where it lands. */
function Spat({ t }) {
  const still = reduceMotion()
  return (
    <motion.div aria-hidden="true"
      initial={still ? { x:t.tx, y:t.ty, rotate:t.rot } : { x:t.sx, y:t.sy, scale:0.4, rotate:0 }}
      animate={still ? {} : { x:[t.sx, (t.sx + t.tx) / 2, t.tx], y:[t.sy, Math.min(t.sy, t.ty) - 110, t.ty], scale:[0.4, 1.1, 1], rotate:[0, 300, 360 + t.rot] }}
      transition={{ duration:1.1, ease:'easeOut' }}
      style={{ position:'absolute', left:0, top:0, pointerEvents:'none', zIndex:2, filter:'drop-shadow(0 3px 0 rgba(42,27,61,0.25))' }}>
      <Art art={t.e} size={48} />
    </motion.div>
  )
}

/**
 * The row of fed monsters: little letters with eyes. They all wiggle when
 * the next one eats, a tap tickles one, and at the end the whole row dances.
 */
function Lineup({ monsters, cheers, party }) {
  const still = reduceMotion()
  const [tickled, setTickled] = useState(null)
  const tight = monsters.length > 8
  return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'flex-end', minHeight:54, maxWidth:'100%', marginTop:-6 }}>
      {monsters.map((m, i) => (
        <motion.button key={m.i} type="button" aria-label={`Monster ${m.letter}`}
          onClick={() => { sfx.giggle(); setTickled({ i: m.i, n: (tickled?.n ?? 0) + 1 }) }}
          initial={still ? false : { scale:0, y:-40 }}
          animate={still ? {} : party ? { scale:1, y:[0, -22, 0], rotate:[0, -12, 12, 0] }
            : { scale:1, y:0, rotate:0 }}
          transition={party ? { duration:0.6, repeat:Infinity, delay:i * 0.08 } : { type:'spring', stiffness:380, damping:14 }}
          style={{ all:'unset', cursor:'pointer', position:'relative', margin: tight ? '0 -4px' : '0 2px', transformOrigin:'50% 100%' }}>
          <motion.div key={`${cheers}-${tickled?.i === m.i ? tickled.n : 0}`}
            animate={still || (!cheers && tickled?.i !== m.i) ? {} : { rotate:[0, -14, 12, -8, 0], scaleY:[1, 0.85, 1.1, 1] }}
            transition={{ duration:0.6, delay: tickled?.i === m.i ? 0 : i * 0.05 }}
            style={{ position:'relative', width:40, height:52, display:'flex', alignItems:'flex-end', justifyContent:'center', transformOrigin:'50% 100%' }}>
            <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:42, lineHeight:1, color:m.color,
              WebkitTextStroke:`2px ${INK}`, paintOrder:'stroke fill' }}>{m.letter}</span>
            {[-1, 1].map(d => (
              <span key={d} style={{ position:'absolute', top:0, left:`calc(50% + ${d * 7}px - 6px)`, width:12, height:12, borderRadius:'50%',
                background:'#fff', border:`2px solid ${INK}`, boxSizing:'border-box' }}>
                <span style={{ position:'absolute', left:3, top:3, width:4, height:4, borderRadius:'50%', background:INK }} />
              </span>
            ))}
          </motion.div>
        </motion.button>
      ))}
    </div>
  )
}

/** A picture in the monster's bubble, its first letter picked out below. */
function Example({ item, color }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', lineHeight:1 }}>
      <Art art={item.e} size={52} />
      <span style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:15, color:INK }}>
        <span style={{ color, WebkitTextStroke:`1px ${INK}`, fontSize:19 }}>{item.w[0]}</span>{item.w.slice(1)}
      </span>
    </div>
  )
}
