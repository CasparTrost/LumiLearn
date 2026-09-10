import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { voice } from '../voice.js'
import { speak } from '../tts.js'

const NUMBER_WORDS   = ['','eins','zwei','drei','vier','fünf','sechs','sieben','acht','neun','zehn']
const NUMBER_AUDIO   = ['','eins','zwei','drei','vier','fuenf','sechs','sieben','acht','neun','zehn']
const NUM_COLORS   = ['','#FF6B6B','#FF9F43','#FFD93D','#5DB85D','#74B9FF','#A29BFE','#FD79A8','#44D498','#FF6B9A','#6C63FF']
const ALL_EMOJIS   = ['⭐','🍎','🐟','🦋','🌸','🍭','🎈','🐶','🌙','🦁','🍕','🌻','🎵','🦄','🐸','🐰','🍓','🎀','🌈','🍩','🐠','🎂','🐨','🌺','🎪','🌮','🍦','🎁','🧁','🍇']

function rnd(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function buildRounds(level) {
  const maxN = level <= 1 ? 3 : level <= 2 ? 5 : level <= 3 ? 7 : 10
  let seq = Array.from({ length: maxN }, (_, i) => i + 1)
  if (maxN <= 3) seq = rnd([...seq, ...seq])
  else seq = rnd(seq)
  const emojiPool = rnd(ALL_EMOJIS)
  // Extra objects beyond the target count. The board used to hold exactly n
  // items, so tapping everything was always right and the round could not be
  // failed — the link between quantity and numeral was never actually tested.
  // With a few spares the child has to count out n of them and stop, which is
  // the classic "give me n" task and the real measure of cardinality.
  const extra = level <= 1 ? 1 : level <= 2 ? 2 : 3
  return seq.map((n, i) => ({
    n,
    total: n + extra,
    emoji: emojiPool[i % emojiPool.length],
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
  const [misses, setMisses] = useState(0)

  // Stop narration when game unmounts
  useEffect(() => () => voice.stop(), [])

  // Speak the number name when a new round starts
  useEffect(() => {
    const n = rounds[idx]?.n
    if (n != null) voice.play(`audio/zahlen-entdecken/${NUMBER_AUDIO[n]}.mp3`, NUMBER_WORDS[n])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const round = rounds[idx]
  const done  = checkResult === 'ok'

  // Spacebar taps the next untapped item
  useEffect(() => {
    const handleKey = (e) => {
      if (e.code !== 'Space' || done) return
      e.preventDefault()
      setTapped(p => {
        const nextIdx = Array.from({ length: round.total }, (_, i) => i).find(i => !p.has(i))
        if (nextIdx === undefined) return p
        const m = new Map(p)
        m.set(nextIdx, p.size + 1)
        return m
      })
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [done, round])

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
      // Every round is eventually counted right (a miscount can be retried),
      // so the score alone would always mean three stars.
      const stars = misses === 0 ? 3 : misses <= rounds.length ? 2 : 1
      onComplete({ score: rounds.length, total: rounds.length, stars })
    } else {
      setIdx(next)
      setTapped(new Map())
    }
  }

  if (!round) return null

  const objs = Array.from({ length: round.total }, (_, i) => i)

  const checkCount = () => {
    if (tapped.size === round.n) {
      setCheckResult('ok')
      return
    }
    setCheckResult('wrong')
    setMisses(m => m + 1)
    const tooMany = tapped.size > round.n
    speak(tooMany
      ? `Das sind zu viele. Zähle noch einmal bis ${round.n}.`
      : `Das sind noch zu wenige. Zähle bis ${round.n}.`,
      { rate: 0.8, pitch: 1.05, lang: 'de-DE' })
    setTimeout(() => { setCheckResult(null); setTapped(new Map()) }, 1900)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:18, padding:'clamp(12px,3vw,24px)', width:'100%' }}>

      {/* Progress */}
      <div style={{ width:'100%', maxWidth:520, height:10, background:'rgba(0,0,0,0.08)', borderRadius:10, overflow:'hidden' }}>
        <motion.div
          animate={{ width:`${((idx + (done ? 1 : 0)) / rounds.length) * 100}%` }}
          style={{ height:'100%', background:round.color, borderRadius:10 }}
          transition={{ duration:0.4 }}
        />
      </div>

      {/* Big number */}
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ y:40, scale:0.5, opacity:0 }}
          animate={{ y:0, scale:1, opacity:1 }}
          exit={{ y:-40, scale:0.5, opacity:0 }}
          transition={{ type:'spring', stiffness:380, damping:20 }}
          style={{ textAlign:'center', lineHeight:1 }}
        >
          <div style={{
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(182px,39vw,286px)',
            lineHeight:1, userSelect:'none',
            color: round.color,
            filter:`drop-shadow(0 8px 32px ${round.color}77)`,
          }}>
            {round.n}
          </div>
          <div style={{fontFamily:'var(--font-heading)',fontSize:'clamp(42px,9vw,62px)',color:'var(--text-secondary)',marginTop:-4,letterSpacing:1}}>
            {NUMBER_WORDS[round.n]}
          </div>
          {/* Ten frame for 7..10 — the dice pattern below only reaches six,
              so exactly the numbers that are hardest to grasp at a glance had
              no structure to lean on. Five per row makes "five and some more"
              visible instead of forcing a one-by-one count. */}
          {round.n >= 7 && (
            <svg width={132} height={62} viewBox="0 0 220 100" style={{marginTop:6}}>
              {Array.from({ length: 10 }, (_, i) => {
                const col = i % 5, row = Math.floor(i / 5)
                const x = 6 + col * 42, y = 6 + row * 44
                return (
                  <g key={i}>
                    <rect x={x} y={y} width={38} height={40} rx={7}
                      fill="white" stroke={`${round.color}55`} strokeWidth={2}/>
                    {i < round.n && (
                      <circle cx={x + 19} cy={y + 20} r={12} fill={round.color}/>
                    )}
                  </g>
                )
              })}
            </svg>
          )}
          {/* Dice pattern for n <= 6 */}
          {round.n <= 6 && (
            <svg width={80} height={80} viewBox="0 0 100 100" style={{marginTop:4}}>
              <rect x={2} y={2} width={96} height={96} rx={18}
                fill="white" stroke={round.color} strokeWidth={3}/>
              {[
                [],
                [[50,50]],
                [[25,25],[75,75]],
                [[25,25],[50,50],[75,75]],
                [[25,25],[75,25],[25,75],[75,75]],
                [[25,25],[75,25],[50,50],[25,75],[75,75]],
                [[25,25],[75,25],[25,50],[75,50],[25,75],[75,75]],
              ][round.n].map(([cx,cy],i) => (
                <circle key={i} cx={cx} cy={cy} r={8} fill={round.color}/>
              ))}
            </svg>
          )}
        </motion.div>
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
              padding:'28px 52px', borderRadius:32,
              background:'rgba(255,255,255,0.95)',
              boxShadow:`0 0 0 4px ${round.color}55, 0 12px 40px ${round.color}33`,
            }}
          >
            <div style={{ fontSize:'clamp(48px,11vw,70px)', lineHeight:1 }}>🎉</div>
            <div style={{
              fontFamily:'var(--font-heading)',
              fontSize:'clamp(22px,5vw,30px)',
              color:round.color, fontWeight:800,
            }}>
              {round.n} — {NUMBER_WORDS[round.n]}!
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
              gap:'clamp(4px,2vw,12px)',
              maxWidth:480,
            }}
          >
            {objs.map(i => {
              const tapOrder = tapped.get(i)  // undefined if not tapped, else 1-based order
              const isTapped = tapOrder !== undefined
              return (
                <motion.div
                  key={i}
                  style={{ position:'relative', display:'inline-flex' }}
                >
                  <motion.button
                    initial={{ scale:0, rotate:-20 }}
                    animate={isTapped ? { scale:0.55, rotate:20, opacity:0.35 } : { scale:1, rotate:0, opacity:1 }}
                    transition={{
                      type:'spring', stiffness:400, damping:15,
                      delay: isTapped ? 0 : i * 0.10,
                    }}
                    whileHover={!isTapped ? { scale:1.25, rotate:[0,8,-8,0] } : {}}
                    whileTap={!isTapped ? { scale:0.75 } : {}}
                    onClick={() => {
                      if (!isTapped) {
                        const newOrder = tapped.size + 1
                        setTapped(p => { const m = new Map(p); m.set(i, newOrder); return m })
                        // Count along in the same recorded voice that
                        // announces the round. This used to be speech
                        // synthesis while the round number was a recording,
                        // so the voice audibly changed mid-round.
                        voice.play(`audio/zahlen-entdecken/${NUMBER_AUDIO[newOrder]}.mp3`,
                                   NUMBER_WORDS[newOrder])
                      }
                    }}
                    style={{
                      background:'none', border:'none',
                      cursor: isTapped ? 'default' : 'pointer',
                      fontSize:'clamp(40px,9vw,60px)',
                      lineHeight:1, padding:4,
                      WebkitTapHighlightColor:'transparent',
                    }}
                  >
                    {round.emoji}
                  </motion.button>
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
                          top:-10, left:'50%',
                          transform:'translateX(-50%)',
                          background: round.color,
                          color:'white',
                          fontFamily:'var(--font-heading)',
                          fontSize:'clamp(12px,2.5vw,17px)',
                          fontWeight:800,
                          lineHeight:1,
                          borderRadius:'50%',
                          width:'clamp(22px,4.5vw,30px)',
                          height:'clamp(22px,4.5vw,30px)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:`0 2px 8px ${round.color}88`,
                          pointerEvents:'none',
                        }}
                      >
                        {tapOrder}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dot counter — one dot per wanted item, not per item on the board:
          it shows how many are still to collect now that spares lie around. */}
      {!boom && (
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center', minHeight:30 }}>
          {Array.from({ length: round.n }, (_, i) => (
            <motion.div
              key={i}
              animate={{
                scale: i < tapped.size ? 1.2 : 0.75,
                background: i < tapped.size ? round.color : 'rgba(0,0,0,0.12)',
              }}
              transition={{ type:'spring', stiffness:500, damping:18 }}
              style={{
                width:22, height:22, borderRadius:'50%',
                boxShadow: i < tapped.size ? `0 0 12px ${round.color}99` : 'none',
              }}
            />
          ))}
        </div>
      )}

      {/* Hint */}
      {!boom && (
        <motion.p
          initial={{ opacity:0 }}
          animate={{ opacity: tapped.size === 0 ? 1 : 0 }}
          transition={{ delay: tapped.size === 0 ? 1.4 : 0, duration:0.3 }}
          style={{
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(14px,3vw,19px)',
            color:'var(--text-muted)',
            textAlign:'center', margin:0,
          }}
        >
          {round.n === 1 ? `Sammle genau 1 ${round.emoji} ein! 👆` : `Sammle genau ${round.n} ${round.emoji} ein! 👆`}
        </motion.p>
      )}

      {/* The child decides when the count is complete — that decision is the
          whole assessment. Auto-finishing at n made every attempt correct. */}
      {!boom && checkResult !== 'wrong' && (
        <motion.button
          animate={{ opacity: tapped.size > 0 ? 1 : 0.35, scale: tapped.size > 0 ? 1 : 0.96 }}
          whileHover={tapped.size > 0 ? { scale: 1.06 } : {}}
          whileTap={tapped.size > 0 ? { scale: 0.94 } : {}}
          onClick={() => { if (tapped.size > 0) checkCount() }}
          style={{
            background: `linear-gradient(135deg, ${round.color}, ${round.color}cc)`,
            color:'white', border:'none', borderRadius:20,
            padding:'12px 40px', cursor: tapped.size > 0 ? 'pointer' : 'default',
            fontFamily:'var(--font-heading)', fontSize:'clamp(17px,3.6vw,22px)',
            fontWeight:800, boxShadow:`0 5px 20px ${round.color}66`,
          }}
        >✅ Fertig!</motion.button>
      )}

      {checkResult === 'wrong' && (
        <motion.div
          initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
          style={{
            background:'#FFE8E8', border:'3px solid #FF6B6B', borderRadius:20,
            padding:'12px 26px', textAlign:'center',
            fontFamily:'var(--font-heading)', fontSize:'clamp(15px,3.2vw,20px)',
            color:'#C0392B', fontWeight:700,
          }}
        >
          {tapped.size > round.n
            ? `Das waren ${tapped.size} — das sind zu viele. Wir zählen nochmal! 🔁`
            : `Das waren erst ${tapped.size}. Wir zählen nochmal! 🔁`}
        </motion.div>
      )}

      {showWeiter && (
        <motion.button
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
          onClick={weiterClick}
          style={{
            padding:'13px 44px', borderRadius:50,
            background:`linear-gradient(135deg,${round.color},${round.color}cc)`,
            color:'white', fontFamily:'var(--font-heading)', fontSize:20, fontWeight:700,
            border:'none', cursor:'pointer', boxShadow:`0 4px 18px ${round.color}66`,
          }}
        >
          {idx + 1 >= rounds.length ? '🏁 Fertig!' : 'Weiter! →'}
        </motion.button>
      )}
    </div>
  )
}
