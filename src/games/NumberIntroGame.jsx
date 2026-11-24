import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { lockPreviews, stopNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { sfx } from '../sfx.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts, HintHand } from '../components/play/index.js'
import { Stage, useLater, DoneButton, Pips, usePops, Finale } from './zahlen/stage.jsx'

/**
 * Zahlen entdecken — "Bruno hat Hunger"
 *
 * A hungry animal holds up a sign with a number. The child lays exactly
 * that many things on its plate (each one pops up its count) and taps the
 * tick. Then the animal eats: just right gives a burp, a giggle or a
 * dance; too few and it is still hungry, too many and it is stuffed and
 * the rest rolls back. Counting out n of more things and deciding when to
 * stop is the "give me n" task, the measure of cardinality.
 *
 * Nothing here needs words: the sign shows the number (numeral, dots),
 * the bubble shows the food, a hand shows the move when a child waits.
 */

const NUMBER_WORDS = ['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn']
// Content colours for the numerals; the ink outline keeps even the light ones
// readable.
const NUM_COLORS = ['#9AB0CC','#FF6B5B','#FF9F43','#FFC93C','#5CC45A','#4AA3FF','#8E6CF0','#FD79A8','#2FB8A6','#E8663A','#3E7BD6']

// Who is hungry, and for what. Only food that is one thing in its picture
// (no cherry pairs, no grape bunches), so every picture counts as one.
const EATERS = [
  { art: '🐻', label: 'Bruno, der Bär', foods: [['🍓', 'Erdbeere'], ['🍎', 'Apfel'], ['🧁', 'Muffin']] },
  { art: '🐰', label: 'Hase',         foods: [['🥕', 'Karotte']] },
  { art: '🐒', label: 'Affe',         foods: [['🍌', 'Banane']] },
  { art: '🐭', label: 'Maus',         foods: [['🧀', 'Käse']] },
  { art: '🐶', label: 'Hund',         foods: [['🦴', 'Knochen']] },
  { art: '🐱', label: 'Katze',        foods: [['🐟', 'Fisch']] },
  { art: '🐿️', label: 'Eichhörnchen', foods: [['🌰', 'Kastanie']] },
  { art: '🦛', label: 'Nilpferd',     foods: [['🍉', 'Melone']] },
  { art: '🐷', label: 'Schwein',      foods: [['🍩', 'Donut']] },
  { art: '🦖', label: 'Dino',         foods: [['🍕', 'Pizza']] },
  { art: '🐼', label: 'Panda',        foods: [['🍪', 'Keks']] },
  { art: '🐘', label: 'Elefant',      foods: [['🥨', 'Brezel']] },
  { art: '🐧', label: 'Pinguin',      foods: [['🍦', 'Eis']] },
  { art: '🦔', label: 'Igel',         foods: [['🍐', 'Birne']] },
]

function rnd(arr) { return [...arr].sort(() => Math.random() - 0.5) }

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
    const [emoji, name] = eater.foods[Math.floor(Math.random() * eater.foods.length)]
    return { n, total: n + extra, eater, food: { emoji, name }, color: NUM_COLORS[n] }
  })
}

export default function NumberIntroGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])
  const reduce = useReducedMotion()
  const { later, afterSpeech, clear } = useLater()
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()
  const [pops, pop] = usePops()
  const [bitePops, bitePop] = usePops({ color: '#ff6b5b' })
  const critterRef = useRef(null)
  const pileRef = useRef(null), plateRef = useRef(null), doneRef = useRef(null)

  const [idx,    setIdx]    = useState(0)
  const [pile,   setPile]   = useState(() => [...Array(rounds[0].total).keys()])
  const [plate,  setPlate]  = useState([])        // ids, in the order they were laid down
  const [eaten,  setEaten]  = useState(0)
  const [phase,  setPhase]  = useState('play')    // play | eat | stuffed | done | finale
  const [misses, setMisses] = useState(0)         // on this round
  const [puff,   setPuff]   = useState(0)         // a burp cloud
  const firstTry = useRef(0)
  const streak = useRef(0)                        // right on the first try, in a row

  const round = rounds[idx]
  const { n, food: f, eater } = round

  useEffect(() => stopNarration, [])

  // A new animal walks in: Lumi's turn to listen, the child's to act.
  useEffect(() => {
    lockPreviews()
    sayTask()
  }, [idx])

  const next = () => {
    if (idx + 1 >= rounds.length) { setPhase('finale'); return }
    clear()
    setIdx(idx + 1)
    setPile([...Array(rounds[idx + 1].total).keys()])
    setPlate([])
    setEaten(0)
    setMisses(0)
    setPuff(0)
    setMood('idle')
    setPhase('play')
  }

  // Something lands on the plate: its count pops up over the plate,
  // going on from what was eaten already.
  const lay = id => {
    if (phase !== 'play') return false
    const k = eaten + plate.length + 1
    setPile(p => p.filter(x => x !== id))
    setPlate(p => [...p, id])
    sfx.pop()
    pop(n === 0 ? '?' : k)
    if (n === 0) setMood('oops', 900)
    return true
  }
  // A tap on the plate takes that thing back, so a slip is easy to fix —
  // and a stuffed animal is helped by taking the extra ones away.
  const takeBack = id => {
    if (phase !== 'play' && phase !== 'stuffed') return
    const rest = plate.filter(x => x !== id)
    setPlate(rest)
    setPile(p => [...p, id].sort((a, b) => a - b))
    sfx.slideUp()
    if (phase === 'stuffed' && rest.length === 0) {
      // Everything extra is off the plate: relief, a giggle, done.
      // It still was a miss, so this round is not right on the first try.
      setPhase('done')
      setMood('happy', 1600)
      sfx.giggle()
      burst(critterRef.current, 'hearts', 8)
      sayRight()
      afterSpeech(next, 2200)
    }
  }

  const miss = () => { setMisses(m => m + 1); streak.current = 0 }

  const check = () => {
    if (phase !== 'play') return
    const k = plate.length, t = eaten + k
    if (n === 0) {
      if (k === 0) {
        // Full already, and nothing came: a happy nap.
        setPhase('done')
        if (misses === 0) firstTry.current++
        setMood('sleep', 2400)
        sayRight()
        afterSpeech(next, 2200)
      } else {
        // Full already: everything is pushed back to the pile.
        miss()
        setMood('oops', 1600)
        sfx.boing()
        setPile(p => [...p, ...plate].sort((a, b) => a - b))
        setPlate([])
        setPhase('eat')
        sayWrong()
        afterSpeech(() => setPhase('play'), 1400)
      }
      return
    }
    setPhase('eat')
    // A wrong amount is eaten bite by bite and each bite pops its number,
    // so the child sees where it went wrong; the right one goes
    // munch-munch-munch.
    const bites = Math.min(k, n - eaten), counted = t !== n, e0 = eaten
    const bite = i => {
      if (i >= bites) { ate(t); return }
      setPlate(p => p.slice(1))
      setEaten(e0 + i + 1)
      setMood('eat', 700)
      sfx.chomp()
      if (counted) bitePop(e0 + i + 1)
      later(counted ? 620 : 300, () => bite(i + 1))
    }
    later(200, () => bite(0))
  }

  const ate = t => {
    if (t === n) {
      setPhase('done')
      if (misses === 0) { firstTry.current++; streak.current++ } else streak.current = 0
      // A little surprise, so the twentieth meal is still fun: a burp
      // (with a puff), a dance or a happy spin — and a party on a streak.
      const treat = streak.current >= 3 && streak.current % 3 === 0 ? 'party' : ['burp', 'burp', 'dance', 'happy'][Math.floor(Math.random() * 4)]
      if (treat === 'burp') {
        sfx.burp()
        setPuff(p => p + 1)
        setMood('wow', 700)
        later(700, () => { sfx.giggle(); setMood('happy', 1400) })
      } else setMood(treat === 'happy' ? 'happy' : 'dance', treat === 'happy' ? 1400 : 2400)
      burst(critterRef.current, treat === 'party' ? 'confetti' : 'hearts', treat === 'party' ? 22 : 10)
      if (treat === 'party') sfx.tada()
      sayRight()
      afterSpeech(next, treat === 'party' || treat === 'dance' ? 2600 : 2200)
    } else if (t > n) {
      // Stuffed: the belly bulges, the animal wobbles and won't eat the
      // rest — the extra ones stay on the plate, shaking, until the child
      // takes them off.
      miss()
      setMood('oops', 0)
      sfx.boing()
      setPhase('stuffed')
      sayWrong()
    } else {
      // Still hungry: what was eaten stays eaten, the bubble shows how many
      // more, and the child gives the rest.
      miss()
      setMood('hungry', 0)
      sayWrong()
      afterSpeech(() => { setMood('idle'); setPhase('play') }, 1400)
    }
  }

  const canCheck = phase === 'play' && (plate.length > 0 || n === 0)
  // After two misses the sign's dots fill with what was given — shown from
  // the start, it would give the end away: fill until every dot is full.
  const helpDots = misses >= 2 && n > 0 ? Math.min(n, eaten + plate.length) : null
  const belly = 1 + Math.min(eaten, 10) * 0.04 + (phase === 'stuffed' ? 0.18 : 0)
  const wantMore = n - eaten
  // The hand: drag food onto the plate; once something is on it, tap the
  // tick (and in the zero round, the tick straight away).
  const hint = phase === 'stuffed'
    ? <HintHand to={plateRef} delay={1800} key={`s${idx}`} />
    : n === 0 || plate.length > 0
    ? <HintHand to={doneRef} active={phase === 'play'} delay={n === 0 ? 6000 : 9000} key={`t${idx}`} />
    : <HintHand from={pileRef} to={plateRef} active={phase === 'play'} delay={idx === 0 && eaten === 0 ? 2000 : 6000} key={`d${idx}`} />

  return (
    <DragArea autoTarget="plate" disabled={phase !== 'play'}>
      <Stage wide={[780, 540]} tall={[440, 720]}>
        {wide => {
          const sign = <Sign key={`s${idx}`} n={n} color={round.color} fill={helpDots} />
          const wish = n === 0
            ? <Art art="🍽️" size={40} />
            : <>{eaten > 0 && <span style={{ fontSize: 30 }}>{wantMore}</span>}<Art art={f.emoji} size={40} /></>
          const showWish = phase === 'play' || phase === 'stuffed'
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
                        animate={phase === 'stuffed' && !reduce
                          ? { x: 0, opacity: 1, scaleX: belly, scaleY: 1 + (belly - 1) * 0.3, rotate: [0, -7, 6, -4, 0] }
                          : { x: 0, opacity: 1, scaleX: belly, scaleY: 1 + (belly - 1) * 0.3, rotate: 0 }}
                        exit={reduce ? { opacity: 0 } : { x: -260, opacity: 0, transition: { duration: 0.35 } }}
                        transition={phase === 'stuffed' ? { rotate: { duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }, default: { type: 'spring', stiffness: 160, damping: 18 } } : { type: 'spring', stiffness: 160, damping: 18 }}
                        style={{ position: 'relative', transformOrigin: '50% 100%' }}>
                        <Critter art={eater.art} size={wide ? 200 : 170} label={eater.label} flip={wide}
                          mood={phase === 'play' && (hover || ready) && n > 0 ? 'hungry' : phase === 'play' && n === 0 && mood === 'idle' ? 'sleep' : mood}
                          wish={showWish ? wish : null} wishSide={wide ? 'right' : 'top'} />
                        <Puff key={puff} on={puff > 0} />
                        <div style={{ position: 'absolute', left: 0, right: 0, top: '30%' }}>{bitePops}</div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                  <div ref={plateRef} style={{ position: 'relative' }}>
                    <Plate items={plate} food={f} start={eaten} onTake={takeBack} glow={hover} shake={phase === 'stuffed'} width={wide ? 280 : 380} item={wide ? 50 : 58}
                      rows={Math.ceil(Math.min(round.total, n + 1) / (wide ? 4 : 5))} />
                    {pops}
                  </div>
                </>
              )}
            </DropZone>
          )
          // The blanket closes up as things are taken, rows fold away
          // smoothly; the box around it keeps its size, so nothing else on
          // the stage moves.
          const cols = Math.min(round.total, wide ? 3 : 4)
          const heap = (
            <div style={{ width: cols * 64 + 32, height: Math.ceil(round.total / cols) * 64 + 32, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
              <Blanket>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(pile.length, cols))}, 60px)`, gap: 4, justifyContent: 'center' }}>
                  <AnimatePresence initial={false}>
                    {pile.map((id, i) => (
                      <motion.div key={`${idx}-${id}`} ref={i === 0 ? pileRef : undefined} layout={reduce ? false : 'position'}
                        initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: ((id * 37) % 21) - 10 }} exit={{ scale: 0, transition: { duration: 0.12 } }}
                        transition={{ type: 'spring', stiffness: 380, damping: 24 }} style={{ width: 60, height: 60 }}>
                        <Draggable id={`${idx}-${id}`} data={id} label={f.name} style={{ padding: 3, borderRadius: 14 }}>
                          <Art art={f.emoji} size={54} />
                        </Draggable>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </Blanket>
            </div>
          )
          const trail = <RoundTrail total={rounds.length} done={idx + (phase === 'done' || phase === 'finale' ? 1 : 0)} walker="🐻" goal="🍯" size={wide ? 38 : 34} style={{ margin: '6px 48px 0 24px' }} />
          const done = <div ref={doneRef}><DoneButton onClick={check} disabled={!canCheck} size={wide ? 84 : 80} /></div>
          return (
            <>
              {wide ? (
                <>
                  {trail}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '0 12px 12px' }}>
                    {sign}
                    {animal}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
                      {heap}
                      {done}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {trail}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly', padding: '0 10px 12px' }}>
                    {animal}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {heap}
                      {done}
                    </div>
                  </div>
                </>
              )}
              {phase === 'finale' && (
                <Finale cast={[...new Set(rounds.map(r => r.eater.art))]} size={wide ? 120 : 96}
                  onDone={() => onComplete(result(firstTry.current, rounds.length))} />
              )}
            </>
          )
        }}
      </Stage>
      {hint}
      {bursts}
    </DragArea>
  )
}

// The sign the animal holds up: the numeral, its word and its dots.
// A tap makes it wobble.
function Sign({ n, color, fill }) {
  const [wob, setWob] = useState(0)
  return (
    <motion.div role="img" aria-label={`${n}`} onClick={() => { setWob(w => w + 1); sfx.boing() }}
      initial={{ y: -40, rotate: -8, opacity: 0 }} animate={{ y: 0, rotate: wob % 2 ? 3 : -3, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 9 }}
      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', transformOrigin: '50% 100%' }}
      data-n={n}>
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
        <Pips n={n} size={66} color={color} fill={fill ?? n} />
      </div>
      <div aria-hidden="true" style={{ width: 14, height: 46, background: '#8a4f22', border: '3px solid #2a1b3d', borderTop: 'none', borderRadius: '0 0 6px 6px' }} />
    </motion.div>
  )
}

// The plate in front of the animal; everything on it is numbered on, from
// what was eaten already.
// Its height is set for the round (room for one more than wanted), so
// the animal above does not jump as things are laid down.
function Plate({ items, food: f, start, onTake, glow, shake, width, item, rows }) {
  return (
    <div style={{
      marginTop: -8, width, minHeight: Math.max(96, rows * (item + 4) + 28), padding: '14px 22px', boxSizing: 'border-box',
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 4,
      background: 'radial-gradient(ellipse at 50% 40%, #ffffff 55%, #e4f1ff 100%)', borderRadius: 999,
      border: '4px solid #2a1b3d', boxShadow: `inset 0 0 0 7px ${glow ? '#ffc93c' : '#bcdcff'}, 0 6px 0 rgba(42,27,61,0.3)`,
      transition: 'box-shadow .2s',
    }}>
      <AnimatePresence>
        {items.map((id, i) => (
          <motion.button key={id} type="button" onClick={e => { e.stopPropagation(); onTake(id) }}
            aria-label={`${f.name} ${start + i + 1}, zurücklegen`}
            initial={{ scale: 0, y: -30 }} animate={shake ? { scale: 1, y: 0, rotate: [0, -12, 12, -8, 0], x: [0, 4, -4, 2, 0] } : { scale: 1, y: 0, rotate: 0, x: 0 }}
            exit={{ scale: 0, y: -40, opacity: 0 }}
            transition={shake ? { rotate: { duration: 0.7, repeat: Infinity, repeatDelay: 0.5 }, x: { duration: 0.7, repeat: Infinity, repeatDelay: 0.5 } } : { type: 'spring', stiffness: 500, damping: 20 }}
            style={{ all: 'unset', cursor: 'pointer', position: 'relative', width: item, height: item, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Art art={f.emoji} size={item - 6} />
            <span style={{
              position: 'absolute', top: -10, right: -10, minWidth: 30, height: 30, borderRadius: 15, padding: '0 4px', boxSizing: 'border-box',
              background: '#fffdf7', border: '3px solid #2a1b3d', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, lineHeight: '24px', textAlign: 'center', color: '#2a1b3d',
            }}>{start + i + 1}</span>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  )
}

// The little cloud a burp blows out
function Puff({ on }) {
  if (!on) return null
  return (
    <motion.div aria-hidden="true" initial={{ opacity: 0, scale: 0.4, x: 0, y: 0 }} animate={{ opacity: [0, 1, 0], scale: [0.4, 1.2, 1.6], x: 40, y: -50 }}
      transition={{ duration: 1.1 }} style={{ position: 'absolute', left: '55%', top: '15%', pointerEvents: 'none' }}>
      <Art art="💨" size={56} />
    </motion.div>
  )
}

// The picnic blanket the food lies on
function Blanket({ children }) {
  const reduce = useReducedMotion()
  return (
    <motion.div layout={!reduce} transition={{ type: 'spring', stiffness: 380, damping: 30 }} style={{
      padding: 12, borderRadius: 22, border: '4px solid #2a1b3d', minHeight: 90, minWidth: 150,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'repeating-conic-gradient(#ff8a7a 0 25%, #fff3e6 0 50%) 0 0 / 44px 44px',
      boxShadow: '0 6px 0 rgba(42,27,61,0.3)',
    }}>
      {children}
    </motion.div>
  )
}
