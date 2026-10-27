import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { narrate, afterNarration, lockPreviews, stopNarration } from '../narrator.js'
import { sayNumber, sayCount } from '../tts.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { hearable } from '../lib/hearable.js'
import { pxCard, pxPanel, pxButton, INK } from './px.js'

const NUMBER_WORDS   = ['null','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn']
const NUMBER_AUDIO   = ['','eins','zwei','drei','vier','fuenf','sechs','sieben','acht','neun','zehn']
// Content colours for the numerals; the ink outline keeps even the light ones
// readable on parchment.
const NUM_COLORS   = ['#9AB0CC','#FF6B5B','#FF9F43','#FFC93C','#5CC45A','#4AA3FF','#8E6CF0','#FD79A8','#2FB8A6','#E8663A','#3E7BD6']
// Every thing has its noun, so the task can be said: "Tippe genau sechs Sterne an".
const THINGS = [
  { emoji: '⭐', one: 'Stern',         many: 'Sterne',         g: 'm' },
  { emoji: '🍎', one: 'Apfel',         many: 'Äpfel',          g: 'm' },
  { emoji: '🐟', one: 'Fisch',         many: 'Fische',         g: 'm' },
  { emoji: '🦋', one: 'Schmetterling', many: 'Schmetterlinge', g: 'm' },
  { emoji: '🌸', one: 'Blüte',         many: 'Blüten',         g: 'f' },
  { emoji: '🍭', one: 'Lutscher',      many: 'Lutscher',       g: 'm' },
  { emoji: '🎈', one: 'Ballon',        many: 'Ballons',        g: 'm' },
  { emoji: '🐶', one: 'Hund',          many: 'Hunde',          g: 'm' },
  { emoji: '🦁', one: 'Löwe',          many: 'Löwen',          g: 'm' },
  { emoji: '🍕', one: 'Pizzastück',    many: 'Pizzastücke',    g: 'n' },
  { emoji: '🌻', one: 'Sonnenblume',   many: 'Sonnenblumen',   g: 'f' },
  { emoji: '🦄', one: 'Einhorn',       many: 'Einhörner',      g: 'n' },
  { emoji: '🐸', one: 'Frosch',        many: 'Frösche',        g: 'm' },
  { emoji: '🐰', one: 'Hase',          many: 'Hasen',          g: 'm' },
  { emoji: '🍓', one: 'Erdbeere',      many: 'Erdbeeren',      g: 'f' },
  { emoji: '🎀', one: 'Schleife',      many: 'Schleifen',      g: 'f' },
  { emoji: '🍩', one: 'Donut',         many: 'Donuts',         g: 'm' },
  { emoji: '🐨', one: 'Koala',         many: 'Koalas',         g: 'm' },
  { emoji: '🍦', one: 'Eistüte',       many: 'Eistüten',       g: 'f' },
  { emoji: '🎁', one: 'Geschenk',      many: 'Geschenke',      g: 'n' },
  { emoji: '🧁', one: 'Muffin',        many: 'Muffins',        g: 'm' },
  { emoji: '🍇', one: 'Weintraube',    many: 'Weintrauben',    g: 'f' },
  { emoji: '🐞', one: 'Marienkäfer',   many: 'Marienkäfer',    g: 'm' },
  { emoji: '🍌', one: 'Banane',        many: 'Bananen',        g: 'f' },
  { emoji: '🚗', one: 'Auto',          many: 'Autos',          g: 'n' },
  { emoji: '🦆', one: 'Ente',          many: 'Enten',          g: 'f' },
]

// "Tippe genau einen Stern an" — the object of a sentence needs the accusative,
// which sayCount (nominative "ein") does not give for masculine nouns.
const countAcc = (n, t) => n === 1
  ? `${t.g === 'm' ? 'einen' : t.g === 'f' ? 'eine' : 'ein'} ${t.one}`
  : `${sayNumber(n)} ${t.many}`
// Counting along: recordings up to ten, the voice from eleven on (a board
// holds up to thirteen things, and "undefined.mp3" used to fall silent).
const countPart = n => (n >= 1 && n <= 10 ? { src: `audio/zahlen-entdecken/${NUMBER_AUDIO[n]}.mp3`, text: NUMBER_WORDS[n] } : { text: sayNumber(n) })

function rnd(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// The zero round: nothing to tap, Fertig straight away. Said in full, because
// "null Sterne" alone would leave a child waiting for something to count.
const ZERO_TASK = 'Null heißt: gar keins! Tippe auf Fertig, ohne etwas anzutippen.'
const taskParts = (n, thing) => n === 0
  ? [{ text: 'Null.' }, { text: ZERO_TASK, gap: 250 }]
  : [countPart(n), { text: `Tippe genau ${countAcc(n, thing)} an.`, gap: 250 }]

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
  const pool = rnd(THINGS)
  // Extra objects beyond the target count. The board used to hold exactly n
  // items, so tapping everything was always right and the round could not be
  // failed — the link between quantity and numeral was never actually tested.
  // With a few spares the child has to count out n of them and stop, which is
  // the classic "give me n" task and the real measure of cardinality.
  const extra = level <= 1 ? 1 : level <= 2 ? 2 : 3
  return seq.map((n, i) => ({
    n,
    total: n + extra,
    thing: pool[i % pool.length],
    color: NUM_COLORS[n],
  }))
}

export default function NumberIntroGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])

  const [idx,    setIdx]    = useState(0)
  const [tapped, setTapped] = useState(() => new Map()) // Map<index → tapOrder (1-based)>
  const [boom,   setBoom]   = useState(false)
  const [showWeiter, setShowWeiter] = useState(false)
  const [checkResult, setCheckResult] = useState(null) // null | 'ok' | 'wrong'
  const [roundMisses, setRoundMisses] = useState(0)
  const [firstTry, setFirstTry] = useState(0)

  // Stop narration when game unmounts
  useEffect(() => stopNarration, [])

  const round = rounds[idx]
  const done  = checkResult === 'ok'

  // Say the task when a new round starts: the number in the recorded voice,
  // then what to do with it. The number alone left a child who cannot read
  // the hint guessing what was wanted.
  useEffect(() => {
    if (!round) return
    lockPreviews()
    narrate(round.n === 0
      ? taskParts(0)
      : [countPart(round.n), { text: `Tippe genau ${countAcc(round.n, round.thing)} an. Dann drück auf Fertig!`, gap: 250 }])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Taking a thing back renumbers the later ones, so the badges always read
  // 1, 2, 3 … and the child can fix a slip instead of starting over.
  const toggle = (i) => {
    if (done || checkResult === 'wrong') return
    const order = tapped.get(i)
    const m = new Map(tapped)
    if (order === undefined) m.set(i, tapped.size + 1)
    else {
      m.delete(i)
      for (const [k, o] of m) if (o > order) m.set(k, o - 1)
    }
    setTapped(m)
    // In the zero round a tap is not counted along but gently taken back to
    // the task; it is no mistake until Fertig is pressed.
    if (round.n === 0) narrate([{ text: m.size > 0
      ? 'Null heißt: gar keins! Tippe es noch einmal an, dann ist es wieder weg.'
      : 'Gut, jetzt ist wieder keins angetippt. Tippe auf Fertig!' }])
    // Count along in the same recorded voice that announces the round.
    else if (m.size > 0) narrate([countPart(m.size)])
    else stopNarration()
  }

  // Spacebar taps the next untapped item
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code !== 'Space' || done) return
      e.preventDefault()
      const nextIdx = Array.from({ length: round.total }, (_, i) => i).find(i => !tapped.has(i))
      if (nextIdx !== undefined) toggle(nextIdx)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!done) return
    setBoom(true)
    const t = setTimeout(() => setShowWeiter(true), 800)
    return () => clearTimeout(t)
  }, [done]) // eslint-disable-line react-hooks/exhaustive-deps

  const weiterClick = () => {
    setShowWeiter(false)
    setBoom(false)
    const next = idx + 1
    setCheckResult(null)
    if (next >= rounds.length) {
      onComplete(result(firstTry, rounds.length))
    } else {
      setIdx(next)
      setTapped(new Map())
      setRoundMisses(0)
    }
  }

  if (!round) return null

  const objs = Array.from({ length: round.total }, (_, i) => i)
  const { n, thing } = round

  const checkCount = () => {
    const k = tapped.size
    if (k === n) {
      setCheckResult('ok')
      if (roundMisses === 0) setFirstTry(f => f + 1)
      sayRight(n === 0 ? 'Null heißt gar keins, und du hast gar keins angetippt.'
        : n === 1 ? `Das ist genau ${sayCount(1, thing.one, thing.g)}.` : `Das sind genau ${sayNumber(n)} ${thing.many}.`)
      return
    }
    setCheckResult('wrong')
    setRoundMisses(m => m + 1)
    sayWrong(k > n
      ? (n === 0
          ? `Null heißt: gar keins. Wir lassen alle liegen und tippen nur auf Fertig!`
        : n === 1
          ? `Das sind zu viele. Wir brauchen nur ${countAcc(1, thing)}.`
          : `Das waren ${sayNumber(k)}. Wir brauchen nur ${sayNumber(n)}. Wir zählen nochmal!`)
      : `Das ${k === 1 ? 'war erst eins' : `waren erst ${sayNumber(k)}`}. Wir brauchen ${sayNumber(n)}. Wir zählen nochmal!`)
    // Start over only once the sentence is through — it used to be cut off by
    // a fixed 1.9 s reset as soon as the child tapped again.
    afterNarration(() => { setCheckResult(null); setTapped(new Map()) }, { minMs: 1200 })
  }

  // After two miscounts the row of dots shows how many are wanted. Shown from
  // the start it gave the end away: tap until every dot is full.
  const showDots = roundMisses >= 2
  // Fertig waits for a first tap — except for zero, where no tap is the answer.
  const canCheck = tapped.size > 0 || n === 0

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'clamp(12px,3vw,24px)', width:'100%' }}>

      {/* Progress */}
      <div style={{ width:'100%', maxWidth:520, height:12, background:'rgba(42,27,61,0.12)', border:`2px solid ${INK}`, borderRadius:4, overflow:'hidden' }}>
        <motion.div
          animate={{ width:`${((idx + (done ? 1 : 0)) / rounds.length) * 100}%` }}
          style={{ height:'100%', background:round.color, borderRadius:2 }}
          transition={{ duration:0.4 }}
        />
      </div>

      {/* Big number — tap it to hear the task again */}
      <AnimatePresence mode="wait">
        <motion.button
          key={idx}
          initial={{ y:40, scale:0.5, opacity:0 }}
          animate={{ y:0, scale:1, opacity:1 }}
          exit={{ y:-40, scale:0.5, opacity:0 }}
          transition={{ type:'spring', stiffness:380, damping:20 }}
          onClick={() => narrate(taskParts(n, thing))}
          aria-label={`Aufgabe noch einmal hören: ${NUMBER_WORDS[n]}`}
          style={{ textAlign:'center', lineHeight:1, background:'none', border:'none', padding:0, cursor:'pointer', color:'inherit' }}
        >
          <div style={{
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(150px,34vw,260px)',
            lineHeight:1, userSelect:'none',
            color: round.color,
            // Ink outline: a yellow or light numeral otherwise melts into
            // the parchment background
            textShadow:'-5px -5px 0 var(--px-ink), 5px -5px 0 var(--px-ink), -5px 5px 0 var(--px-ink), 5px 5px 0 var(--px-ink), 0 -5px 0 var(--px-ink), 0 5px 0 var(--px-ink), -5px 0 0 var(--px-ink), 5px 0 0 var(--px-ink), 0 11px 0 rgba(42,27,61,0.3)',
          }}>
            {n}
          </div>
          <div style={{fontFamily:'var(--font-heading)',fontSize:'clamp(38px,8vw,58px)',color:'var(--text-secondary)',marginTop:-4,letterSpacing:1}}>
            {NUMBER_WORDS[n]}
          </div>
          {/* Ten frame for 7..10 — the dice pattern below only reaches six,
              so exactly the numbers that are hardest to grasp at a glance had
              no structure to lean on. Five per row makes "five and some more"
              visible instead of forcing a one-by-one count. */}
          {n >= 7 && (
            <svg width={132} height={62} viewBox="0 0 220 100" style={{marginTop:6}}>
              {Array.from({ length: 10 }, (_, i) => {
                const col = i % 5, row = Math.floor(i / 5)
                const x = 6 + col * 42, y = 6 + row * 44
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={38} height={40} rx={5}
                      fill="#FFFDF7" stroke="#2a1b3d" strokeWidth={3}/>
                    {i < n && (
                      <circle cx={x + 19} cy={y + 20} r={12} fill={round.color} stroke="#2a1b3d" strokeWidth={2}/>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
          {/* Dice pattern for n <= 6 */}
          {n <= 6 && (
            <svg width={80} height={80} viewBox="0 0 100 100" style={{marginTop:4}}>
              <rect x={3} y={3} width={94} height={94} rx={12}
                fill="#FFFDF7" stroke="#2a1b3d" strokeWidth={5}/>
              {[
                [],
                [[50,50]],
                [[25,25],[75,75]],
                [[25,25],[50,50],[75,75]],
                [[25,25],[75,25],[25,75],[75,75]],
                [[25,25],[75,25],[50,50],[25,75],[75,75]],
                [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
              ][n].map(([cx,cy],i) => (
                <circle key={i} cx={cx} cy={cy} r={9} fill={round.color} stroke="#2a1b3d" strokeWidth={2}/>
              ))}
            </svg>
          )}
        </motion.button>
      </AnimatePresence>

      {/* Objects OR celebration */}
      <AnimatePresence mode="wait">
        {boom ? (
          <motion.div
            key="boom"
            initial={{ scale:0.6, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
            exit={{ scale:0.8, opacity:0 }}
            transition={{ type:'spring', stiffness:400, damping:18 }}
            style={{
              display:'flex', flexDirection:'column', alignItems:'center', gap:12,
              padding:'24px 44px',
              ...pxPanel,
            }}
          >
            <div style={{ fontSize:'clamp(48px,11vw,70px)', lineHeight:1 }}>🎉</div>
            <div style={{
              fontFamily:'var(--font-heading)',
              fontSize:'clamp(22px,5vw,30px)',
              color:INK, fontWeight:800,
            }}>
              {n} — {NUMBER_WORDS[n]}!
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={`objs-${idx}`}
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            style={{
              display:'flex', flexWrap:'wrap',
              justifyContent:'center',
              gap:'clamp(4px,1.6vw,10px)',
              maxWidth:500,
            }}
          >
            {objs.map(i => {
              const tapOrder = tapped.get(i)  // undefined if not tapped, else 1-based order
              const isTapped = tapOrder !== undefined
              return (
                // The button keeps its full size; only the picture shrinks,
                // so a counted thing stays easy to tap again to put it back.
                <button
                  key={i}
                  onClick={() => toggle(i)}
                  aria-label={isTapped ? `${thing.one} ${tapOrder}, zurücklegen` : thing.one}
                  aria-pressed={isTapped}
                  style={{
                    position:'relative', background:'none', border:'none',
                    cursor:'pointer', padding:4, lineHeight:1,
                    minWidth:52, minHeight:52,
                    WebkitTapHighlightColor:'transparent',
                  }}
                >
                  <motion.span
                    initial={{ scale:0, rotate:-20 }}
                    animate={isTapped ? { scale:0.8, rotate:12, opacity:0.45 } : { scale:1, rotate:0, opacity:1 }}
                    transition={{
                      type:'spring', stiffness:400, damping:15,
                      delay: isTapped ? 0 : i * 0.08,
                    }}
                    whileHover={!isTapped ? { scale:1.2 } : {}}
                    whileTap={{ scale:0.75 }}
                    style={{ display:'inline-block', fontSize:'clamp(44px,9vw,60px)' }}
                  >
                    {thing.emoji}
                  </motion.span>
                  {/* Tap-order badge */}
                  <AnimatePresence>
                    {isTapped && (
                      <motion.span
                        initial={{ scale:0, y:4, opacity:0 }}
                        animate={{ scale:1, y:0, opacity:1 }}
                        exit={{ scale:0, opacity:0 }}
                        transition={{ type:'spring', stiffness:500, damping:18 }}
                        style={{
                          position:'absolute',
                          top:-6, left:'50%', marginLeft:'clamp(-15px,-2.25vw,-11px)',
                          background:'#FFFDF7',
                          color:INK,
                          fontFamily:'var(--font-heading)',
                          fontSize:'clamp(13px,2.5vw,17px)',
                          fontWeight:800,
                          lineHeight:1,
                          borderRadius:'50%',
                          width:'clamp(22px,4.5vw,30px)',
                          height:'clamp(22px,4.5vw,30px)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          border:`2px solid ${INK}`,
                          boxShadow:`0 2px 0 ${INK}`,
                          pointerEvents:'none',
                        }}
                      >
                        {tapOrder}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dot counter — a help after two miscounts: one dot per wanted item,
          filling as the child taps. */}
      {!boom && showDots && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', minHeight:30 }}>
          {Array.from({ length: n }, (_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i < tapped.size ? 1.2 : 0.75,
                background: i < tapped.size ? round.color : 'rgba(0,0,0,0.12)',
              }}
              transition={{ type:'spring', stiffness:500, damping:18 }}
              style={{
                width:22, height:22, borderRadius:'50%',
                border:`2px solid ${INK}`,
                boxShadow: i < tapped.size ? `0 2px 0 ${INK}` : 'none',
              }}
            />
          ))}
        </div>
      )}

      {/* Hint */}
      {!boom && (
        <p style={{
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(16px,3vw,20px)',
          color:'var(--text-secondary)',
          textAlign:'center', margin:0,
        }}>
          {n === 0 ? <>Null heißt: gar keins! Tippe nur auf Fertig. ✅</> : <>Tippe genau {n} {thing.emoji} an! 👆</>}
        </p>
      )}

      {/* The child decides when the count is complete — that decision is the
          whole assessment. Auto-finishing at n made every attempt correct. */}
      {!boom && checkResult !== 'wrong' && (
        <motion.button
          animate={{ opacity: canCheck ? 1 : 0.45, scale: canCheck ? 1 : 0.96 }}
          whileHover={canCheck ? { scale: 1.06 } : {}}
          whileTap={canCheck ? { scale: 0.94 } : {}}
          onClick={() => { if (canCheck) checkCount() }}
          {...hearable('Fertig')}
          style={{
            ...pxButton('green'), color:INK, textShadow:'none',
            padding:'12px 40px', minHeight:52, cursor: canCheck ? 'pointer' : 'default',
            fontSize:'clamp(18px,3.6vw,22px)', fontWeight:800,
          }}
        >✅ Fertig!</motion.button>
      )}

      {checkResult === 'wrong' && (
        <motion.div
          initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
          style={{
            ...pxCard('wrong'),
            padding:'12px 26px', textAlign:'center',
            fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.2vw,20px)',
            color:'#A93226', fontWeight:700,
          }}
        >
          {n === 0
            ? 'Null heißt: gar keins. Nur auf Fertig tippen! 🔁'
            : tapped.size > n
            ? `Das waren ${tapped.size} — das sind zu viele. Wir zählen nochmal! 🔁`
            : `Das waren erst ${tapped.size}. Wir zählen nochmal! 🔁`}
        </motion.div>
      )}

      {showWeiter && (
        <motion.button
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
          onClick={weiterClick}
          {...hearable(idx + 1 >= rounds.length ? 'Fertig' : 'Weiter')}
          style={{
            ...pxButton('green'), color:INK, textShadow:'none',
            padding:'13px 44px', minHeight:52, fontSize:20,
          }}
        >
          {idx + 1 >= rounds.length ? '🏁 Fertig!' : 'Weiter! →'}
        </motion.button>
      )}
    </div>
  )
}
