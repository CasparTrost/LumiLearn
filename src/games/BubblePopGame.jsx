import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useAnimationFrame, motionValue } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { pxCard, pxBubble, pxButton, INK } from './px.js'

/**
 * Blasen-Blitz — Mengen auf einen Blick erfassen, dann Zahlen schnell finden
 *
 *   • Levels 1–4: the bubbles carry dice patterns of one to six dots. Small
 *     quantities in a familiar pattern are seen at once rather than counted
 *     (subitizing); the child hears the number and finds the quantity.
 *   • From level 5: numerals. The target is first only heard, the digit
 *     comes a moment later, and the other bubbles favour numbers that are
 *     easy to mix up (12/21, 6/9, neighbours) — hearing a number word and
 *     finding its numeral, not matching a digit to a digit.
 *
 * Positions are static (CSS left/top %); a small physics loop drifts each
 * bubble around its spot through MotionValues.
 */

const TINTS = ['#4aa3ff', '#ff6b5b', '#ffc93c', '#5cc45a', '#8e6cf0', '#fd79a8', '#2fb8a6', '#ff9f43']
const ROUNDS = 5

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
const N = sayNumber
const Cap = s => s[0].toUpperCase() + s.slice(1)

// Numbers easy to take for the target: digits swapped, neighbours, 6 and 9.
function confusables(v, maxNum) {
  const out = [v - 1, v + 1]
  if (v > 9) out.push(Number(String(v).split('').reverse().join('')))
  if (v % 10 === 6) out.push(v + 3)
  if (v % 10 === 9) out.push(v - 3)
  return out.filter(x => x >= 1 && x <= maxNum && x !== v)
}

function spawnRound(target, cfg, W, H) {
  const targetCount = rand(cfg.minT, cfg.maxT)
  const near = cfg.dots ? [] : confusables(target, cfg.maxNum)
  return Array.from({ length: cfg.count }, (_, i) => {
    let value = target
    if (i >= targetCount) {
      if (near.length && Math.random() < 0.5) value = near[rand(0, near.length - 1)]
      else do { value = rand(1, cfg.maxNum) } while (value === target)
    }
    const size = rand(cfg.dots ? 66 : 58, cfg.dots ? 92 : 88)
    const r = size / 2 + 4
    // Inside the water by at least the radius: bubbles at the edge used to
    // be cut off by up to two thirds.
    const left = ((r + Math.random() * Math.max(0, W - 2 * r)) / W) * 100
    const top  = ((r + Math.random() * Math.max(0, H - 2 * r - 20)) / H) * 100
    return {
      id: `${i}-${Math.random().toString(36).slice(2)}`,
      value, tint: TINTS[rand(0, TINTS.length - 1)],
      left, top, size,
      floatDur: 5.5 + Math.random() * 5.0,
    }
  })
}

// 10 tiers: number range, bubbles on the board, target bubbles per round.
// No clock in the first three levels — with a visible countdown a four-year-
// old feels pressure but learns nothing from it.
const ROUND_CFG = [
  { maxNum: 3,  count:  6, minT: 2, maxT: 3, dots: true  }, // L1
  { maxNum: 4,  count:  7, minT: 2, maxT: 3, dots: true  }, // L2
  { maxNum: 5,  count:  8, minT: 2, maxT: 4, dots: true  }, // L3
  { maxNum: 6,  count:  9, minT: 2, maxT: 4, dots: true,  timed: true }, // L4
  { maxNum: 10, count: 10, minT: 2, maxT: 4, timed: true }, // L5
  { maxNum: 12, count: 11, minT: 3, maxT: 5, timed: true }, // L6
  { maxNum: 20, count: 12, minT: 3, maxT: 5, timed: true }, // L7
  { maxNum: 25, count: 13, minT: 3, maxT: 5, timed: true }, // L8
  { maxNum: 30, count: 14, minT: 3, maxT: 6, timed: true }, // L9
  { maxNum: 40, count: 15, minT: 3, maxT: 6, timed: true }, // L10
].map(c => ({
  ...c,
  // The budget grows with the board so the pressure per bubble stays
  // roughly constant; difficulty comes from the count and the number range.
  timeS: Math.max(24, Math.round(c.count * 1.5 + 10)),
}))

const FISH = [
  { left:'8%',  top:'18%', flip:false, dur:8,  size:28 },
  { left:'72%', top:'30%', flip:true,  dur:11, size:22 },
  { left:'40%', top:'60%', flip:false, dur:9,  size:20 },
  { left:'85%', top:'55%', flip:true,  dur:13, size:26 },
]

const DICE = [
  [],
  [[50,50]],
  [[28,28],[72,72]],
  [[26,26],[50,50],[74,74]],
  [[28,28],[72,28],[28,72],[72,72]],
  [[26,26],[74,26],[50,50],[26,74],[74,74]],
  [[28,24],[72,24],[28,50],[72,50],[28,76],[72,76]],
]

function Dots({ n }) {
  return (
    <svg viewBox="0 0 100 100" width="74%" height="74%" style={{ pointerEvents: 'none' }}>
      {DICE[n].map(([cx, cy], i) => <circle key={i} cx={cx} cy={cy} r={11} fill="#FFFDF7" stroke="#2a1b3d" strokeWidth={4} />)}
    </svg>
  )
}

// What the voice says about a bubble or the target.
const taskText  = (t, dots) => dots
  ? `Finde alle Blasen mit ${t === 1 ? 'einem Punkt' : `${N(t)} Punkten`}!`
  : `Finde alle Blasen mit der ${Cap(N(t))}!`
const wrongText = (v, t, dots) => dots
  ? `${v === 1 ? 'Das ist ein Punkt' : `Das sind ${N(v)} Punkte`}. Wir suchen ${t === 1 ? 'einen Punkt' : `${N(t)} Punkte`}.`
  : `Das ist die ${Cap(N(v))}. Wir suchen die ${Cap(N(t))}.`

export default function BubblePopGame({ level = 1, onComplete }) {
  const cfg = ROUND_CFG[Math.min(level - 1, ROUND_CFG.length - 1)]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  const [roundIdx,  setRoundIdx]  = useState(0)
  const [target,    setTarget]    = useState(() => rand(1, cfg.maxNum))
  const [bubbles,   setBubbles]   = useState([])
  const [poppedIds, setPoppedIds] = useState([])
  const poppedRef    = useRef(new Set())
  const [lives,     setLives]     = useState(3)      // per round
  const livesRef     = useRef(3)
  const [rounds,    setRounds]    = useState([])     // per finished round: 'clean' | 'won' | 'lost'
  const roundsRef    = useRef([])
  const [timeLeft,  setTimeLeft]  = useState(cfg.timeS)
  const [mood,      setMood]      = useState('happy')
  const [wrongMsg,  setWrongMsg]  = useState(null)
  const [hint,      setHint]      = useState(false)  // targets pulse briefly after a wrong pop
  const [showDigit, setShowDigit] = useState(true)
  const [phase,     setPhase]     = useState('playing')
  const lastTargetPopRef = useRef(0) // timestamp of last correct pop for chain detection
  const [chainBadge, setChainBadge] = useState(false)
  const mistakesRef = useRef(0)

  const arenaRef   = useRef(null)
  const physicsRef = useRef({}) // { [id]: { px,py, vx,vy, size,left,top, t, floatPeriod } }
  const mvsRef     = useRef({}) // { [id]: { mx: MotionValue, my: MotionValue } }

  // Wait while the help is open, then go on.
  const whenUnpaused = useCallback(function go(cb) {
    if (pausedRef.current) setTimeout(() => go(cb), 250)
    else cb()
  }, [])

  useEffect(() => {
    const t = rand(1, cfg.maxNum)
    const rect = arenaRef.current?.getBoundingClientRect()
    setTarget(t)
    setBubbles(spawnRound(t, cfg, rect?.width || 360, rect?.height || 300))
    poppedRef.current = new Set()
    setPoppedIds([])
    livesRef.current = 3
    setLives(3)
    mistakesRef.current = 0
    setTimeLeft(cfg.timeS)
    setPhase('playing')
    // From level 5 the target is heard first; the digit follows.
    const hearFirst = !cfg.dots && level >= 5
    setShowDigit(!hearFirst)
    lockPreviews()
    const id = setTimeout(() => sayTask(taskText(t, cfg.dots)), 300)
    const id2 = hearFirst ? setTimeout(() => setShowDigit(true), 2600) : null
    return () => { clearTimeout(id); clearTimeout(id2) }
  }, [roundIdx, cfg, level])

  // Init physics state + MotionValues whenever bubbles change
  useEffect(() => {
    const newPhys = {}
    const newMvs  = {}
    bubbles.forEach(b => {
      newPhys[b.id] = {
        px: 0, py: 0,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: b.size, left: b.left, top: b.top,
        t: Math.random() * Math.PI * 2,
        floatPeriod: b.floatDur,
      }
      newMvs[b.id] = { mx: motionValue(0), my: motionValue(0) }
    })
    physicsRef.current = newPhys
    mvsRef.current     = newMvs
  }, [bubbles])

  // A round is over: note how it went, let `say` tell the child (it is told
  // whether this was the last round), and go on once it is said.
  const endRound = useCallback((how, say) => {
    const list = [...roundsRef.current, how]
    roundsRef.current = list
    setRounds(list)
    const last = list.length >= ROUNDS
    say(last)
    if (!last) {
      afterNarration(() => whenUnpaused(() => setRoundIdx(r => r + 1)), { minMs: 1500 })
      return
    }
    setPhase('done')
    const won   = list.filter(r => r !== 'lost').length
    const clean = list.filter(r => r === 'clean').length
    afterNarration(() => {
      narrate([{ text: `Du hast ${won === 1 ? 'eine' : N(won)} von fünf Runden geschafft!` }])
      afterNarration(() => whenUnpaused(() => onComplete(result(clean, ROUNDS))), { minMs: 1200 })
    }, { minMs: 400 })
  }, [onComplete, whenUnpaused])

  useEffect(() => {
    if (phase !== 'playing' || !cfg.timed) return
    const iv = setInterval(() => {
      if (pausedRef.current) return
      setTimeLeft(t => (t <= 1 ? 0 : t - 1))
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, cfg.timed])

  // Running out of time costs this round, nothing more.
  useEffect(() => {
    if (phase !== 'playing' || !cfg.timed || timeLeft > 0) return
    setMood('encouraging')
    setPhase('roundFail')
    endRound('lost', last => narrate([{ text: last ? 'Die Zeit ist um.' : 'Die Zeit ist um. Nächste Runde!' }]))
  }, [timeLeft, phase, cfg.timed, endRound])

  const popBubble = useCallback((bubble) => {
    if (phase !== 'playing' || pausedRef.current || poppedRef.current.has(bubble.id)) return

    if (bubble.value === target) {
      poppedRef.current.add(bubble.id)
      setPoppedIds(prev => [...prev, bubble.id])
      sfx.pop()
      const now = Date.now()
      const isChain = now - lastTargetPopRef.current < 1500
      lastTargetPopRef.current = now
      if (isChain) {
        setChainBadge(true)
        sfx.combo(2)
        setTimeout(() => setChainBadge(false), 1200)
      }
      setMood('excited')
      setTimeout(() => setMood('happy'), 600)
      const remaining = bubbles.filter(b => b.value === target && !poppedRef.current.has(b.id)).length
      if (remaining === 0) {
        setPhase('roundWin')
        setWrongMsg(null)
        endRound(mistakesRef.current === 0 ? 'clean' : 'won', () => sayRight('Du hast alle gefunden!'))
      }
    } else {
      // A wrong bubble stays: it was not the one, and the child should see
      // which number it really is.
      sfx.wrong()
      mistakesRef.current += 1
      const nl = livesRef.current - 1
      livesRef.current = nl
      setLives(nl)
      setMood('encouraging')
      setTimeout(() => setMood('happy'), 700)
      setShowDigit(true)
      if (nl <= 0) {
        // Three wrong pops end this round only — they used to end the whole
        // game, ten seconds in.
        setPhase('roundFail')
        setWrongMsg(null)
        endRound('lost', last => sayWrong(`${wrongText(bubble.value, target, cfg.dots)} Diese Runde ist vorbei.${last ? '' : ' Nächste Runde!'}`))
        return
      }
      setWrongMsg(wrongText(bubble.value, target, cfg.dots))
      sayWrong(wrongText(bubble.value, target, cfg.dots))
      setHint(true)
      setTimeout(() => setHint(false), 1200)
      setTimeout(() => setWrongMsg(null), 2600)
    }
  }, [phase, bubbles, target, cfg.dots, endRound])

  // Physics loop: gentle sinusoidal drift + bubble repulsion, held while paused
  useAnimationFrame((time, delta) => {
    if (!arenaRef.current || pausedRef.current) return
    const rect = arenaRef.current.getBoundingClientRect()
    const W = rect.width, H = rect.height
    if (W === 0 || H === 0) return

    const dtS   = Math.min(delta / 1000, 0.05)
    const phys  = physicsRef.current
    const mvs   = mvsRef.current
    const popped = poppedRef.current
    const ids   = Object.keys(phys)

    // Absolute pixel centres for each active bubble
    const abs = {}
    for (const id of ids) {
      if (popped.has(id)) continue
      const p = phys[id]
      abs[id] = { x: W * p.left / 100 + p.px, y: H * p.top / 100 + p.py }
    }

    for (const id of ids) {
      if (popped.has(id)) continue
      const p  = phys[id]
      const ax = abs[id]
      if (!ax) continue

      // Soft sinusoidal home drift (replaces keyframes)
      const freq = 0.00025 / (p.floatPeriod / 7)
      const tgtX = Math.sin(time * freq       + p.t) * 30
      const tgtY = Math.cos(time * freq * 0.8 + p.t * 0.9) * 22
      p.vx += (tgtX - p.px) * 1.1 * dtS
      p.vy += (tgtY - p.py) * 1.1 * dtS

      // Repulsion from other bubbles
      for (const otherId of ids) {
        if (otherId === id || popped.has(otherId)) continue
        const ao = abs[otherId]
        if (!ao) continue
        const dx = ax.x - ao.x
        const dy = ax.y - ao.y
        const dist2   = dx * dx + dy * dy
        const minDist = (p.size + phys[otherId].size) / 2 + 6
        if (dist2 < minDist * minDist && dist2 > 0.01) {
          const dist  = Math.sqrt(dist2)
          const force = (minDist - dist) / minDist * 160 * dtS
          p.vx += (dx / dist) * force
          p.vy += (dy / dist) * force
        }
      }

      // Soft boundary: don't drift too far from spawn point
      const maxDrift = Math.min(W, H) * 0.13
      if (Math.abs(p.px) > maxDrift) p.vx -= Math.sign(p.px) * 90 * dtS
      if (Math.abs(p.py) > maxDrift) p.vy -= Math.sign(p.py) * 90 * dtS

      // Damping (water viscosity feel)
      const damp = Math.pow(0.86, dtS * 60)
      p.vx *= damp
      p.vy *= damp

      // Integrate
      p.px += p.vx * dtS * 60
      p.py += p.vy * dtS * 60

      // Hard edge: a bubble never leaves the water
      const r = p.size / 2 + 2
      const homeX = W * p.left / 100, homeY = H * p.top / 100
      p.px = Math.max(r - homeX, Math.min(W - r - homeX, p.px))
      p.py = Math.max(r - homeY, Math.min(H - 20 - r - homeY, p.py))

      if (mvs[id]) {
        mvs[id].mx.set(p.px)
        mvs[id].my.set(p.py)
      }
    }
  })

  const timeFraction = timeLeft / cfg.timeS
  const repeatTask = () => sayTask(taskText(target, cfg.dots))

  return (
    <div style={{ flex:1, minHeight:0, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(8px,1.5vw,16px) clamp(10px,2.5vw,24px) 64px', gap:'clamp(8px,1.2vw,14px)', userSelect:'none' }}>

      {/* Status: hearts of this round, the target, rounds, the calm clock */}
      <div style={{ display:'flex', gap:10, alignItems:'center', width:'100%', maxWidth:750, flexWrap:'wrap', justifyContent:'center', flexShrink:0 }}>
        <div style={{ display:'flex', gap:4, ...pxCard(), padding:'6px 12px' }} aria-label={`${lives} Herzen`}>
          {Array.from({length:3}).map((_,i) => (
            <span key={i} style={{ fontSize:22, filter: i < lives ? 'none' : 'grayscale(1) opacity(0.25)' }}>{'❤️'}</span>
          ))}
        </div>

        {/* The target — tap to hear it again */}
        <motion.button
          animate={{ scale:[1, 1.06, 1] }}
          transition={{ duration:1.8, repeat:Infinity }}
          onClick={repeatTask}
          aria-label="Aufgabe noch einmal hören"
          style={{ ...pxButton('gold'), padding:'6px 16px', minHeight:52, fontSize:'clamp(17px,3.5vw,24px)', display:'flex', alignItems:'center', gap:10 }}
        >
          <span>🎯</span>
          <span style={{ background:'#FFFDF7', color:INK, border:`3px solid ${INK}`, textShadow:'none', borderRadius:'50%', width:'1.9em', height:'1.9em', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'1.05em', fontWeight:800 }}>
            {showDigit ? target : '?'}
          </span>
          <span>🔊</span>
        </motion.button>

        <div style={{ display:'flex', gap:3, ...pxCard(), padding:'6px 10px' }} aria-label="Runden">
          {Array.from({length:ROUNDS}).map((_,i) => (
            <span key={i} style={{ fontSize:18, filter: rounds[i] === 'clean' ? 'none' : rounds[i] ? 'grayscale(0.6) opacity(0.6)' : 'grayscale(1) opacity(0.25)', outline: i === roundIdx && phase === 'playing' ? `2px solid ${INK}` : 'none', borderRadius:4 }}>⭐</span>
          ))}
        </div>

        {/* Chain badge */}
        <AnimatePresence>
          {chainBadge && (
            <motion.div
              key="chain"
              initial={{ scale:0, y:-8 }} animate={{ scale:1, y:0 }} exit={{ scale:0, opacity:0 }}
              transition={{ type:'spring', stiffness:500, damping:18 }}
              style={{ ...pxButton('gold'), cursor:'default', padding:'6px 16px', fontSize:18, fontWeight:800, whiteSpace:'nowrap' }}
            >{'⚡ 2x KETTE!'}</motion.div>
          )}
        </AnimatePresence>

        {cfg.timed && (
          <div style={{ flex:1, minWidth:90, display:'flex', alignItems:'center', gap:6 }} aria-hidden="true">
            <span style={{ fontSize:20 }}>⏳</span>
            <div style={{ flex:1, height:14, background:'rgba(42,27,61,0.12)', border:`2px solid ${INK}`, borderRadius:4, overflow:'hidden' }}>
              <motion.div
                animate={{ width:`${timeFraction*100}%` }}
                transition={{ duration:0.85 }}
                style={{ height:'100%', borderRadius:2, background: timeFraction>0.5 ? 'var(--px-green)' : timeFraction>0.25 ? 'var(--px-gold)' : 'var(--px-red)' }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:10, width:'100%', maxWidth:750, flexShrink:0 }}>
        <LumiCharacter mood={mood} size={56} />
        <div style={{ flex:1, ...pxBubble, padding:'8px 14px', fontFamily:'var(--font-heading)', fontSize:'clamp(15px,2.5vw,18px)', color:'var(--text-primary)' }}>
          {phase==='roundWin'  ? '🎉 Du hast alle gefunden!'
         : phase==='roundFail' ? (cfg.timed && timeLeft === 0 ? '⏳ Die Zeit ist um.' : 'Diese Runde ist vorbei.')
         : phase==='done'      ? `🏆 ${rounds.filter(r => r !== 'lost').length} von ${ROUNDS} Runden geschafft!`
         : wrongMsg ? `🔎 ${wrongMsg}`
         : cfg.dots ? `Finde alle Blasen mit ${target} ${target === 1 ? 'Punkt' : 'Punkten'}!`
         : showDigit ? `Finde alle Blasen mit der Zahl ${target}!` : 'Hör gut zu! 👂'}
        </div>
      </div>

      {/* OCEAN ARENA */}
      <div ref={arenaRef} style={{ position:'relative', overflow:'hidden', width:'100%', maxWidth:750, flex:1, minHeight:220, maxHeight:520, background:'linear-gradient(180deg, #05305e 0%, #0a5294 28%, #1076bb 55%, #23a8d8 78%, #5dd8f0 100%)', border:`3px solid ${INK}`, borderRadius:14, boxShadow:'inset 0 -4px 0 rgba(0,0,0,0.18), 0 5px 0 rgba(42,27,61,0.35)', isolation:'isolate' }}>

        {/* Light rays */}
        {[10,26,42,58,74,88].map((l,i) => (
          <div key={i} style={{ position:'absolute', top:0, left:`${l}%`, width:i%2===0?20:14, height:'75%', background:'linear-gradient(180deg,rgba(255,255,255,0.07),transparent)', transform:'skewX(-6deg)', pointerEvents:'none' }} />
        ))}

        {/* Fish */}
        {FISH.map((f,i) => (
          <motion.div key={i} animate={paused ? {} : { x:[0, f.flip?-28:28, 0] }} transition={{ duration:f.dur, repeat:Infinity, ease:'easeInOut' }}
            style={{ position:'absolute', left:f.left, top:f.top, fontSize:f.size, lineHeight:1, pointerEvents:'none', opacity:0.45, transform:f.flip?'scaleX(-1)':'none' }}
          >🐠</motion.div>
        ))}

        {/* Seaweed */}
        {[6,17,32,50,65,78,92].map((left,i) => (
          <div key={i}
            style={{ position:'absolute', bottom:16, left:`${left}%`, width:10+(i%3)*4, height:28+(i%4)*16, background:`linear-gradient(180deg,${i%2===0?'#2ecc71':'#27ae60'},#1b6b35)`, borderRadius:'50% 50% 0 0 / 100% 100% 0 0', pointerEvents:'none' }}
          />
        ))}

        {/* Sand */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:20, background:'linear-gradient(180deg,#c9933c,#9e7229)', pointerEvents:'none' }} />

        {/* BUBBLES — all alike: a ring or glow on the targets gave the answer away */}
        <AnimatePresence>
          {bubbles.map(bubble => {
            if (poppedIds.includes(bubble.id)) return null
            const pulse = hint && bubble.value === target
            return (
              <motion.button
                key={bubble.id}
                initial={{ scale:0, opacity:0 }}
                animate={pulse ? { opacity:1, scale:[1, 1.18, 1, 1.18, 1] } : { opacity:1, scale:1 }}
                exit={{ scale:1.5, opacity:0, transition:{ duration:0.25 } }}
                transition={pulse ? { duration:1.1 } : {
                  opacity:{ duration:0.3 },
                  scale:  { type:'spring', stiffness:300, damping:18 },
                }}
                whileTap={{ scale:1.3 }}
                onClick={() => popBubble(bubble)}
                aria-label={cfg.dots ? `${bubble.value} ${bubble.value === 1 ? 'Punkt' : 'Punkte'}` : `${bubble.value}`}
                style={{
                  x: mvsRef.current[bubble.id]?.mx,
                  y: mvsRef.current[bubble.id]?.my,
                  position:'absolute',
                  left:`${bubble.left}%`, top:`${bubble.top}%`,
                  marginLeft: -bubble.size/2, marginTop: -bubble.size/2,
                  width:bubble.size, height:bubble.size, padding:0,
                  borderRadius:'50%',
                  background:`radial-gradient(circle at 33% 26%, rgba(255,255,255,0.75), ${bubble.tint} 55%, ${bubble.tint})`,
                  border:`3px solid ${INK}`,
                  boxShadow:'inset 0 -5px 0 rgba(0,0,0,0.15), 0 4px 0 rgba(42,27,61,0.4)',
                  fontFamily:'var(--font-heading)',
                  fontSize:bubble.size*0.42, fontWeight:800, color:'#fff',
                  // an ink outline keeps white digits readable on yellow
                  textShadow:'-2px -2px 0 #2a1b3d, 2px -2px 0 #2a1b3d, -2px 2px 0 #2a1b3d, 2px 2px 0 #2a1b3d, 0 3px 0 #2a1b3d',
                  cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  zIndex:5,
                }}
              >
                {cfg.dots ? <Dots n={bubble.value} /> : bubble.value}
              </motion.button>
            )
          })}
        </AnimatePresence>

        {/* Overlays */}
        <AnimatePresence>
          {phase === 'roundWin' && (
            <motion.div key="win" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', inset:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(40,140,70,0.45)', borderRadius:11, fontFamily:'var(--font-heading)', fontSize:'clamp(26px,8vw,48px)', color:'white', fontWeight:700, flexDirection:'column', gap:4, textShadow:'0 3px 0 #2a1b3d' }}
            ><span>🎉</span><span>Runde {roundIdx+1} geschafft!</span></motion.div>
          )}
          {phase === 'roundFail' && (
            <motion.div key="fail" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', inset:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(42,27,61,0.45)', borderRadius:11, fontFamily:'var(--font-heading)', fontSize:'clamp(24px,7vw,42px)', color:'white', fontWeight:700, textShadow:'0 3px 0 #2a1b3d' }}
            >{cfg.timed && timeLeft === 0 ? '⏳' : '🫧'}</motion.div>
          )}
          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', inset:0, zIndex:10, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(42,27,61,0.55)', borderRadius:11, fontFamily:'var(--font-heading)', fontSize:'clamp(24px,7vw,44px)', color:'white', fontWeight:700, flexDirection:'column', gap:6, textShadow:'0 3px 0 #2a1b3d' }}
            >
              <span>🏆</span>
              <span>{rounds.filter(r => r !== 'lost').length} / {ROUNDS}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
