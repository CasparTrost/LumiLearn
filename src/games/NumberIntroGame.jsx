import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { narrate, lockPreviews, stopNarration } from '../narrator.js'
import { sayNumber, sayCount } from '../tts.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { sfx } from '../sfx.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts } from '../components/play/index.js'
import { Stage, useLater, DoneButton, Pips } from './zahlen/stage.jsx'

/**
 * Zahlen entdecken — "Bruno hat Hunger"
 *
 * A hungry animal holds up a sign with a number. The child lays exactly
 * that many things on its plate (each one counted aloud) and taps the
 * tick. Then the animal eats: just right gives a burp, a giggle or a
 * dance; too few and it is still hungry, too many and it is stuffed and
 * the rest rolls back. Counting out n of more things and deciding when to
 * stop is the "give me n" task, the measure of cardinality.
 */

const NUMBER_WORDS = ['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn']
const NUMBER_AUDIO = ['','eins','zwei','drei','vier','fuenf','sechs','sieben','acht','neun','zehn']
// Content colours for the numerals; the ink outline keeps even the light ones
// readable.
const NUM_COLORS = ['#9AB0CC','#FF6B5B','#FF9F43','#FFC93C','#5CC45A','#4AA3FF','#8E6CF0','#FD79A8','#2FB8A6','#E8663A','#3E7BD6']

// Who is hungry, and for what. Only food that is one thing in its picture
// (no cherry pairs, no grape bunches), so every picture counts as one.
const EATERS = [
  { art: '🐻', label: 'Bruno, der Bär', foods: [['🍓', 'Erdbeere', 'Erdbeeren', 'f'], ['🍎', 'Apfel', 'Äpfel', 'm'], ['🧁', 'Muffin', 'Muffins', 'm']] },
  { art: '🐰', label: 'Hase',         foods: [['🥕', 'Karotte', 'Karotten', 'f']] },
  { art: '🐒', label: 'Affe',         foods: [['🍌', 'Banane', 'Bananen', 'f']] },
  { art: '🐭', label: 'Maus',         foods: [['🧀', 'Käsestück', 'Käsestücke', 'n']] },
  { art: '🐶', label: 'Hund',         foods: [['🦴', 'Knochen', 'Knochen', 'm']] },
  { art: '🐱', label: 'Katze',        foods: [['🐟', 'Fisch', 'Fische', 'm']] },
  { art: '🐿️', label: 'Eichhörnchen', foods: [['🌰', 'Kastanie', 'Kastanien', 'f']] },
  { art: '🦛', label: 'Nilpferd',     foods: [['🍉', 'Melonenstück', 'Melonenstücke', 'n']] },
  { art: '🐷', label: 'Schwein',      foods: [['🍩', 'Donut', 'Donuts', 'm']] },
  { art: '🦖', label: 'Dino',         foods: [['🍕', 'Pizzastück', 'Pizzastücke', 'n']] },
  { art: '🐼', label: 'Panda',        foods: [['🍪', 'Keks', 'Kekse', 'm']] },
  { art: '🐘', label: 'Elefant',      foods: [['🥨', 'Brezel', 'Brezeln', 'f']] },
  { art: '🐧', label: 'Pinguin',      foods: [['🍦', 'Eistüte', 'Eistüten', 'f']] },
  { art: '🦔', label: 'Igel',         foods: [['🍐', 'Birne', 'Birnen', 'f']] },
]
const food = ([emoji, one, many, g]) => ({ emoji, one, many, g })

const N = sayNumber
// "Ich habe Hunger auf einen Apfel": the object needs the accusative, which
// sayCount (nominative "ein") does not give for masculine nouns.
const countAcc = (n, f) => n === 1
  ? `${f.g === 'm' ? 'einen' : f.g === 'f' ? 'eine' : 'ein'} ${f.one}`
  : `${N(n)} ${f.many}`
const them = (n, f) => (n > 1 ? 'sie' : f.g === 'm' ? 'ihn' : f.g === 'f' ? 'sie' : 'es')
// Counting along: recordings up to ten, the voice from eleven on.
const countPart = n => (n >= 1 && n <= 10 ? { src: `audio/zahlen-entdecken/${NUMBER_AUDIO[n]}.mp3`, text: NUMBER_WORDS[n] } : { text: N(n) })

function rnd(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// The zero round: nothing on the plate, the tick straight away.
const taskParts = r => r.n === 0
  ? [{ text: 'Null.' }, { text: 'Ich bin schon pappsatt und möchte gar nichts! Null heißt: gar keins. Tippe auf den Haken, ohne etwas auf den Teller zu legen.', gap: 250 }]
  : [countPart(r.n), { text: `${r.hello ? 'Hallo, ich bin Bruno! ' : ''}Ich habe Hunger auf ${countAcc(r.n, r.food)}! Leg ${them(r.n, r.food)} auf meinen Teller, dann tippe auf den Haken.`, gap: 250 }]

// Zero comes in once the counting is familiar, never as the opening round.
const withZero = seq => { const at = 2 + Math.floor(Math.random() * (seq.length - 1)); return [...seq.slice(0, at), 0, ...seq.slice(at)] }

function buildRounds(level) {
  let seq
  if (level <= 1)      seq = rnd([1, 1, 2, 2, 3, 3])
  else if (level <= 2) seq = rnd([1, 2, 3, 4, 5])
  else if (level <= 3) seq = withZero(rnd([1, 2, 3, 4, 5, 6, 7]))
  // The last level is about the hard numbers: all of six to ten, two smaller
  // ones and the zero in between — eight rounds instead of ten long ones.
  else seq = withZero(rnd([6, 7, 8, 9, 10, ...rnd([2, 3, 4, 5]).slice(0, 2)]))
  // Bruno opens every level; his friends follow, a new one each round.
  const [bruno, ...friends] = EATERS
  const eaters = [bruno, ...rnd(friends)]
  // A few things more than wanted: tapping everything must not be right,
  // the child has to count out n and stop.
  const extra = level <= 1 ? 1 : level <= 2 ? 2 : 3
  return seq.map((n, i) => {
    const eater = eaters[i % eaters.length]
    return { n, total: n + extra, eater, food: food(eater.foods[Math.floor(Math.random() * eater.foods.length)]), color: NUM_COLORS[n], hello: i === 0 }
  })
}

export default function NumberIntroGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])
  const reduce = useReducedMotion()
  const { later, afterSpeech, clear } = useLater()
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()
  const critterRef = useRef(null)

  const [idx,    setIdx]    = useState(0)
  const [pile,   setPile]   = useState(() => [...Array(rounds[0].total).keys()])
  const [plate,  setPlate]  = useState([])        // ids, in the order they were laid down
  const [eaten,  setEaten]  = useState(0)
  const [phase,  setPhase]  = useState('play')    // play | eat | done
  const [misses, setMisses] = useState(0)         // on this round
  const firstTry = useRef(0)

  const round = rounds[idx]
  const { n, food: f, eater } = round

  useEffect(() => stopNarration, [])

  // A new animal walks in and says what it wants.
  useEffect(() => {
    lockPreviews()
    later(500, () => narrate(taskParts(round)))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (idx + 1 >= rounds.length) { onComplete(result(firstTry.current, rounds.length)); return }
    clear()
    setIdx(idx + 1)
    setPile([...Array(rounds[idx + 1].total).keys()])
    setPlate([])
    setEaten(0)
    setMisses(0)
    setPhase('play')
  }

  // Something lands on the plate: counted along in the recorded voice,
  // going on from what was eaten already.
  const lay = id => {
    if (phase !== 'play') return false
    const k = plate.length + 1
    setPile(p => p.filter(x => x !== id))
    setPlate(p => [...p, id])
    sfx.pop()
    if (n === 0) narrate([{ text: 'Null heißt: gar keins! Tippe es auf dem Teller an, dann ist es wieder weg.' }])
    else narrate([countPart(eaten + k)])
    return true
  }
  // A tap on the plate takes that thing back, so a slip is easy to fix.
  const takeBack = id => {
    if (phase !== 'play') return
    const rest = plate.filter(x => x !== id)
    setPlate(rest)
    setPile(p => [...p, id].sort((a, b) => a - b))
    sfx.slideUp()
    if (n === 0) narrate([{ text: rest.length ? 'Noch eins wegnehmen!' : 'Gut, jetzt ist der Teller leer. Tippe auf den Haken!' }])
    else if (eaten + rest.length > 0) narrate([countPart(eaten + rest.length)])
    else stopNarration()
  }

  const miss = () => setMisses(m => m + 1)

  const check = () => {
    if (phase !== 'play') return
    const k = plate.length, t = eaten + k
    if (n === 0) {
      if (k === 0) {
        setPhase('done')
        if (misses === 0) firstTry.current++
        setMood('sleep', 2600)
        sayRight('Null heißt gar keins, und du hast mir gar keins gegeben. Danke!')
        afterSpeech(next, 1400)
      } else {
        // Full already: everything is pushed back to the pile.
        miss()
        setMood('oops', 1600)
        sfx.boing()
        setPile(p => [...p, ...plate].sort((a, b) => a - b))
        setPlate([])
        setPhase('eat')
        sayWrong('Null heißt: gar keins. Ich bin doch schon satt! Tippe nur auf den Haken.')
        afterSpeech(() => setPhase('play'))
      }
      return
    }
    setPhase('eat')
    // A wrong amount is eaten bite by bite and counted aloud, so the child
    // hears where it went wrong; the right one goes munch-munch-munch.
    const bites = Math.min(k, n - eaten), counted = t !== n, e0 = eaten
    const bite = i => {
      if (i >= bites) { ate(t); return }
      setPlate(p => p.slice(1))
      setEaten(e0 + i + 1)
      setMood('eat', 700)
      sfx.chomp()
      if (counted) narrate([countPart(e0 + i + 1)])
      later(counted ? 700 : 320, () => bite(i + 1))
    }
    later(200, () => bite(0))
  }

  const ate = t => {
    if (t === n) {
      setPhase('done')
      if (misses === 0) firstTry.current++
      // A little surprise, so the twentieth meal is still fun
      const treat = ['burp', 'burp', 'dance', 'happy'][Math.floor(Math.random() * 4)]
      const what = n === 1 ? `Das war genau ${sayCount(1, f.one, f.g)}.` : `Das waren genau ${N(n)} ${f.many}.`
      if (treat === 'burp') {
        sfx.burp()
        setMood('wow', 700)
        later(700, () => { sfx.giggle(); setMood('happy', 1400) })
      } else setMood(treat, treat === 'dance' ? 3000 : 1400)
      burst(critterRef.current, 'hearts')
      sayRight(treat === 'burp' ? `Hoppla! Entschuldigung! ${what}` : `Mmh, lecker! ${what}`)
      afterSpeech(next, 1200)
    } else if (t > n) {
      // Stuffed: the rest rolls back off the plate.
      miss()
      setMood('oops', 2200)
      sfx.boing()
      setPile(p => [...p, ...plate.slice(n - eaten)].sort((a, b) => a - b))
      setPlate([])
      setPhase('done')
      sayWrong(`Uff, ich bin pappsatt! Ich wollte nur ${N(n)}. Das waren ${N(t)}.`)
      afterSpeech(next, 1400)
    } else {
      // Still hungry: what was eaten stays eaten, the child gives the rest.
      miss()
      setMood('hungry', 0)
      sayWrong(`Ich habe noch Hunger! Das ${t === 1 ? 'war erst eins' : `waren erst ${N(t)}`}. Ich möchte ${N(n)}. Gib mir noch ${countAcc(n - t, f)}!`)
      afterSpeech(() => { setMood('idle'); setPhase('play') })
    }
  }

  const repeat = () => narrate(taskParts(round))
  const canCheck = phase === 'play' && (plate.length > 0 || n === 0)
  // After two misses a row of dots fills with what was given — shown from
  // the start, it would give the end away: fill until every dot is full.
  const helpDots = misses >= 2 && n > 0
  const belly = 1 + Math.min(eaten, 10) * 0.035

  return (
    <DragArea autoTarget="plate" disabled={phase !== 'play'}>
      <Stage wide={[780, 540]} tall={[440, 720]}>
        {wide => {
          const sign = (
            <Sign key={`s${idx}`} n={n} color={round.color} onTap={repeat}
              help={helpDots ? eaten + plate.length : null} />
          )
          const animal = (
            <DropZone id="plate" onDrop={lay} label={`Teller von ${eater.label}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {(hover, { ready }) => (
                <>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16 }}>
                    {!wide && sign}
                    <AnimatePresence mode="wait">
                      <motion.div key={idx} ref={critterRef}
                        initial={reduce ? { opacity: 0 } : { x: 260, opacity: 0 }}
                        animate={{ x: 0, opacity: 1, scaleX: belly, scaleY: 1 + (belly - 1) * 0.3 }}
                        exit={reduce ? { opacity: 0 } : { x: -260, opacity: 0, transition: { duration: 0.35 } }}
                        transition={{ type: 'spring', stiffness: 160, damping: 18 }}
                        style={{ transformOrigin: '50% 100%' }}>
                        <Critter art={eater.art} size={wide ? 200 : 170} label={eater.label} talks flip={wide}
                          wish={n > 0 && phase === 'play' ? <Art art={f.emoji} size={40} /> : null} wishSide={wide ? 'right' : 'top'}
                          mood={phase === 'play' && (hover || ready) && n > 0 ? 'hungry' : mood} />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <Plate items={plate} food={f} start={eaten} onTake={takeBack} glow={hover} width={wide ? 300 : 380} />
                </>
              )}
            </DropZone>
          )
          const heap = (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 6, maxWidth: wide ? 250 : 420 }}>
              <AnimatePresence>
                {pile.map(id => (
                  <motion.div key={`${idx}-${id}`} layout={!reduce}
                    initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: ((id * 37) % 21) - 10 }} exit={{ scale: 0, transition: { duration: 0.1 } }}
                    transition={{ type: 'spring', stiffness: 380, damping: 18, delay: phase === 'play' && plate.length === 0 && eaten === 0 ? id * 0.05 : 0 }}>
                    <Draggable id={`${idx}-${id}`} data={id} label={f.one} style={{ padding: 3, borderRadius: 14 }}>
                      <Art art={f.emoji} size={wide ? 56 : 54} />
                    </Draggable>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )
          const trail = <RoundTrail total={rounds.length} done={idx + (phase === 'done' ? 1 : 0)} walker="🐻" goal="🍯" size={wide ? 38 : 34} style={{ margin: '6px 48px 0 24px' }} />
          return wide ? (
            <>
              {trail}
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40, padding: '0 12px 12px' }}>
                {sign}
                {animal}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                  <Blanket>{heap}</Blanket>
                  <DoneButton onClick={check} disabled={!canCheck} />
                </div>
              </div>
            </>
          ) : (
            <>
              {trail}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', padding: '0 10px 12px' }}>
                {animal}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <Blanket>{heap}</Blanket>
                  <DoneButton onClick={check} disabled={!canCheck} size={76} />
                </div>
              </div>
            </>
          )
        }}
      </Stage>
      {bursts}
    </DragArea>
  )
}

// The sign the animal holds up: the numeral, its word and its dots.
// A tap says the task again.
function Sign({ n, color, onTap, help }) {
  return (
    <motion.button type="button" onClick={onTap} aria-label={`Aufgabe noch einmal hören: ${NUMBER_WORDS[n]}`}
      initial={{ y: -40, rotate: -8, opacity: 0 }} animate={{ y: 0, rotate: -3, opacity: 1 }}
      whileTap={{ scale: 0.94 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
      style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{
        position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        padding: '6px 18px 12px', minWidth: 140, borderRadius: 18,
        background: '#fffdf7', border: '5px solid #8a4f22', boxShadow: '0 0 0 3px #2a1b3d, 0 8px 0 3px rgba(42,27,61,0.3)',
      }}>
        <span style={{
          fontFamily: 'var(--font-heading)', fontSize: 112, lineHeight: 1, color,
          textShadow: '-4px -4px 0 #2a1b3d, 4px -4px 0 #2a1b3d, -4px 4px 0 #2a1b3d, 4px 4px 0 #2a1b3d, 0 -4px 0 #2a1b3d, 0 4px 0 #2a1b3d, -4px 0 0 #2a1b3d, 4px 0 0 #2a1b3d, 0 9px 0 rgba(42,27,61,0.3)',
        }}>{n}</span>
        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 28, color: '#5b4a6e', marginTop: -6 }}>{NUMBER_WORDS[n]}</span>
        <Pips n={n} size={66} color={color} fill={help ?? n} />
        <span aria-hidden="true" style={{ position: 'absolute', top: -14, right: -16 }}><Art art="🔊" size={34} /></span>
      </div>
      <div aria-hidden="true" style={{ width: 14, height: 46, background: '#8a4f22', border: '3px solid #2a1b3d', borderTop: 'none', borderRadius: '0 0 6px 6px' }} />
    </motion.button>
  )
}

// The plate in front of the animal; everything on it is numbered on, from
// what was eaten already.
function Plate({ items, food: f, start, onTake, glow, width }) {
  return (
    <div style={{
      marginTop: -8, width, minHeight: 96, padding: '14px 22px', boxSizing: 'border-box',
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 4,
      background: 'radial-gradient(ellipse at 50% 40%, #ffffff 55%, #e4f1ff 100%)', borderRadius: 999,
      border: '4px solid #2a1b3d', boxShadow: `inset 0 0 0 7px ${glow ? '#ffc93c' : '#bcdcff'}, 0 6px 0 rgba(42,27,61,0.3)`,
      transition: 'box-shadow .2s',
    }}>
      <AnimatePresence>
        {items.map((id, i) => (
          <motion.button key={id} type="button" onClick={e => { e.stopPropagation(); onTake(id) }}
            aria-label={`${f.one} ${start + i + 1}, zurücklegen`}
            initial={{ scale: 0, y: -30 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0, y: -40, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            style={{ all: 'unset', cursor: 'pointer', position: 'relative', width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Art art={f.emoji} size={42} />
            <span style={{
              position: 'absolute', top: -6, right: -6, minWidth: 22, height: 22, borderRadius: 11, padding: '0 3px', boxSizing: 'border-box',
              background: '#fffdf7', border: '2px solid #2a1b3d', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 13, lineHeight: '18px', textAlign: 'center', color: '#2a1b3d',
            }}>{start + i + 1}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

// The picnic blanket the food lies on
function Blanket({ children }) {
  return (
    <div style={{
      padding: 12, borderRadius: 22, border: '4px solid #2a1b3d', minHeight: 90, minWidth: 150,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'repeating-conic-gradient(#ff8a7a 0 25%, #fff3e6 0 50%) 0 0 / 44px 44px',
      boxShadow: '0 6px 0 rgba(42,27,61,0.3)',
    }}>
      {children}
    </div>
  )
}
