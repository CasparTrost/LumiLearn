import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence, useAnimationFrame, motionValue } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

/**
 * Blasen-Blitz — Subitizing & Inhibitorische Kontrolle
 * Lag fix: Positions are static (CSS left/top %). Framer Motion
 * animates x/y offsets via repeat:Infinity => smooth 60 fps, zero JS overhead.
 */

const TINTS = [
  { bg: 'rgba(108,99,255,0.80)',  glow: '#6C63FF' },
  { bg: 'rgba(255,107,107,0.80)', glow: '#FF6B6B' },
  { bg: 'rgba(255,217,61,0.80)',  glow: '#FFD93D' },
  { bg: 'rgba(107,203,119,0.80)', glow: '#6BCB77' },
  { bg: 'rgba(116,185,255,0.80)', glow: '#74B9FF' },
  { bg: 'rgba(253,121,168,0.80)', glow: '#FD79A8' },
  { bg: 'rgba(0,188,212,0.80)',   glow: '#00BCD4' },
  { bg: 'rgba(255,152,0,0.80)',   glow: '#FF9800' },
]

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

function spawnRound(target, maxNum, count, minTargets, maxTargets) {
  const targetCount = rand(minTargets, maxTargets)
  return Array.from({ length: count }, (_, i) => {
    const value = i < targetCount
      ? target
      : (() => { let v; do { v = rand(1, maxNum) } while (v === target); return v })()
    const tint = TINTS[rand(0, TINTS.length - 1)]
    return {
      id: `${i}-${Math.random().toString(36).slice(2)}`,
      value, tint,
      left: rand(6, 85), top: rand(8, 76), size: rand(58, 94),
      driftX:  rand(-55, 55),
      driftY:  rand(-45, 20),
      midX:    rand(-40, 40),
      midY:    rand(-30, 30),
      floatDur: 5.5 + Math.random() * 5.0,
      floatDly: Math.random() * 2.5,
    }
  })
}

// 10 difficulty tiers: maxNum, bubble count, timer, min/max target bubbles per round
const ROUND_CFG = [
  { maxNum: 3,  count:  7, timeS: 26, minT: 2, maxT: 3 }, // L1
  { maxNum: 5,  count:  9, timeS: 23, minT: 2, maxT: 4 }, // L2
  { maxNum: 7,  count: 10, timeS: 21, minT: 2, maxT: 4 }, // L3
  { maxNum: 10, count: 11, timeS: 19, minT: 2, maxT: 5 }, // L4
  { maxNum: 12, count: 12, timeS: 18, minT: 3, maxT: 5 }, // L5
  { maxNum: 15, count: 13, timeS: 17, minT: 3, maxT: 5 }, // L6
  { maxNum: 20, count: 14, timeS: 16, minT: 3, maxT: 6 }, // L7
  { maxNum: 25, count: 15, timeS: 15, minT: 3, maxT: 6 }, // L8
  { maxNum: 30, count: 17, timeS: 14, minT: 3, maxT: 6 }, // L9
  { maxNum: 40, count: 20, timeS: 12, minT: 4, maxT: 7 }, // L10
]

const FISH = [
  { left:'8%',  top:'18%', flip:false, dur:8,  size:28 },
  { left:'72%', top:'30%', flip:true,  dur:11, size:22 },
  { left:'40%', top:'60%', flip:false, dur:9,  size:20 },
  { left:'85%', top:'55%', flip:true,  dur:13, size:26 },
]

export default function BubblePopGame({ level = 1, onComplete }) {
  const cfg = ROUND_CFG[Math.min(level - 1, ROUND_CFG.length - 1)]

  const [roundIdx,  setRoundIdx]  = useState(0)
  const [target,    setTarget]    = useState(() => rand(1, cfg.maxNum))
  const [bubbles,   setBubbles]   = useState([])
  const [poppedIds, setPoppedIds] = useState([])
  const poppedRef    = useRef(new Set())
  const [lives,     setLives]     = useState(3)
  const livesRef     = useRef(3)
  const [roundsWon, setRoundsWon] = useState(0)
  const roundsWonRef = useRef(0)
  const [timeLeft,  setTimeLeft]  = useState(cfg.timeS)
  const [mood,      setMood]      = useState('happy')
  const [phase,     setPhase]     = useState('playing')
  const lastTargetPopRef = useRef(0) // timestamp of last correct pop for chain detection
  const [chainBadge, setChainBadge] = useState(false)

  const arenaRef   = useRef(null)
  const physicsRef = useRef({}) // { [id]: { px,py, vx,vy, size,left,top, t, floatPeriod } }
  const mvsRef     = useRef({}) // { [id]: { mx: MotionValue, my: MotionValue } }

  useEffect(() => {
    const t = rand(1, cfg.maxNum)
    setTarget(t)
    setBubbles(spawnRound(t, cfg.maxNum, cfg.count, cfg.minT, cfg.maxT))
    poppedRef.current = new Set()
    setPoppedIds([])
    setTimeLeft(cfg.timeS)
    setPhase('playing')
  }, [roundIdx, cfg])

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

  useEffect(() => {
    if (phase !== 'playing') return
    const iv = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(iv)
          const nl = livesRef.current - 1
          livesRef.current = nl
          setLives(nl)
          setMood('encouraging')
          if (nl <= 0) {
            setPhase('done')
            setTimeout(() => onComplete({ score: roundsWonRef.current, total: 3 }), 1200)
          } else {
            setPhase('roundFail')
            setTimeout(() => setRoundIdx(r => r + 1), 1500)
          }
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, roundIdx, onComplete])

  const popBubble = useCallback((bubble) => {
    if (phase !== 'playing' || poppedRef.current.has(bubble.id)) return
    poppedRef.current.add(bubble.id)
    setPoppedIds(prev => [...prev, bubble.id])

    if (bubble.value === target) {
      sfx.pop()
      // Chain detection: two correct pops within 500ms
      const now = Date.now()
      const isChain = now - lastTargetPopRef.current < 500
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
        const nw = roundsWonRef.current + 1
        roundsWonRef.current = nw
        setRoundsWon(nw)
        setPhase('roundWin')
        if (roundIdx + 1 >= 3) {
          setTimeout(() => onComplete({ score: nw, total: 3 }), 1400)
        } else {
          setTimeout(() => setRoundIdx(r => r + 1), 1500)
        }
      }
    } else {
      sfx.wrong()
      const nl = livesRef.current - 1
      livesRef.current = nl
      setLives(nl)
      setMood('encouraging')
      setTimeout(() => setMood('happy'), 700)
      if (nl <= 0) {
        setPhase('done')
        setTimeout(() => onComplete({ score: roundsWonRef.current, total: 3 }), 1200)
      }
    }
  }, [phase, bubbles, target, roundIdx, onComplete])

  // Physics loop: gentle sinusoidal drift + bubble repulsion
  useAnimationFrame((time, delta) => {
    if (!arenaRef.current) return
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

      if (mvs[id]) {
        mvs[id].mx.set(p.px)
        mvs[id].my.set(p.py)
      }
    }
  })

  const timeFraction = timeLeft / cfg.timeS

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(8px,1.5vw,16px) clamp(10px,2.5vw,24px)', gap:'clamp(8px,1.2vw,14px)', userSelect:'none' }}>

      {/* HUD */}
      <div style={{ display:'flex', gap:10, alignItems:'center', width:'100%', maxWidth:720, flexWrap:'wrap', justifyContent:'center' }}>
        <div style={{ display:'flex', gap:5, background:'white', borderRadius:99, padding:'7px 14px', boxShadow:'0 3px 12px rgba(0,0,0,0.08)' }}>
          {Array.from({length:3}).map((_,i) => (
            <span key={i} style={{ fontSize:22, filter: i < lives ? 'none' : 'grayscale(1) opacity(0.25)' }}>{'❤️'}</span>
          ))}
        </div>

        {/* Chain badge */}
        <AnimatePresence>
          {chainBadge && (
            <motion.div
              key="chain"
              initial={{ scale:0, y:-8 }} animate={{ scale:1, y:0 }} exit={{ scale:0, opacity:0 }}
              transition={{ type:'spring', stiffness:500, damping:18 }}
              style={{ background:'linear-gradient(135deg,#FFD93D,#FF9F43)', borderRadius:30, padding:'7px 20px', fontFamily:'var(--font-heading)', fontSize:20, fontWeight:800, color:'white', boxShadow:'0 4px 20px rgba(255,217,61,0.6)', whiteSpace:'nowrap', textShadow:'0 2px 6px rgba(0,0,0,0.2)' }}
            >{'⚡ 2x KETTE!'}</motion.div>
          )}
        </AnimatePresence>

        <motion.div
          animate={{ scale:[1, 1.07, 1] }}
          transition={{ duration:1.8, repeat:Infinity }}
          style={{ background:'linear-gradient(135deg,#0984E3,#74B9FF)', borderRadius:24, padding:'8px 20px', fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.5vw,24px)', color:'white', fontWeight:700, boxShadow:'0 4px 20px rgba(9,132,227,0.4)', display:'flex', alignItems:'center', gap:10 }}
        >
          <span style={{fontSize:'0.85em',opacity:0.9}}>🎯 Alle</span>
          <span style={{ background:'white', color:'#0984E3', borderRadius:'50%', width:'1.9em', height:'1.9em', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'1.05em', fontWeight:800 }}>{target}</span>
          <span style={{fontSize:'0.85em',opacity:0.9}}>poppen!</span>
        </motion.div>

        <div style={{ flex:1, minWidth:100, display:'flex', flexDirection:'column', gap:4 }}>
          <div style={{ height:12, background:'rgba(0,0,0,0.08)', borderRadius:99, overflow:'hidden' }}>
            <motion.div
              animate={{ width:`${timeFraction*100}%` }}
              transition={{ duration:0.85 }}
              style={{ height:'100%', borderRadius:99, background: timeFraction>0.5 ? 'linear-gradient(90deg,#6BCB77,#44D498)' : timeFraction>0.25 ? 'linear-gradient(90deg,#FFD93D,#FFA500)' : 'linear-gradient(90deg,#FF6B6B,#FF4444)' }}
            />
          </div>
          <span style={{ fontFamily:'var(--font-heading)', fontSize:13, color:'var(--text-muted)', textAlign:'right' }}>{timeLeft}s</span>
        </div>
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:10, width:'100%', maxWidth:720 }}>
        <LumiCharacter mood={mood} size={60} />
        <div style={{ flex:1, background:'white', borderRadius:'16px 16px 16px 4px', padding:'9px 14px', fontFamily:'var(--font-heading)', fontSize:'clamp(13px,2.5vw,16px)', color:'var(--text-primary)', boxShadow:'0 2px 12px rgba(9,132,227,0.1)' }}>
          {phase==='roundWin'  ? `🎉 Runde ${roundIdx+1} geschafft! Weiter!`
         : phase==='roundFail' ? '⌛ Zeit! Nächste Runde…'
         : phase==='done'      ? (roundsWon>0 ? `🏆 ${roundsWon} von 3 Runden gewonnen!` : '😅 Probier es nochmal!')
         : `Finde alle Blasen mit der Zahl ${target}!`}
        </div>
      </div>

      {/* OCEAN ARENA */}
      <div ref={arenaRef} style={{ position:'relative', overflow:'hidden', width:'100%', maxWidth:750, height:'clamp(280px,48vw,450px)', background:'linear-gradient(180deg, #05305e 0%, #0a5294 28%, #1076bb 55%, #23a8d8 78%, #5dd8f0 100%)', borderRadius:28, boxShadow:'0 12px 44px rgba(5,48,94,0.45)', flexShrink:0 }}>

        {/* Light rays */}
        {[10,26,42,58,74,88].map((l,i) => (
          <div key={i} style={{ position:'absolute', top:0, left:`${l}%`, width:i%2===0?20:14, height:'75%', background:'linear-gradient(180deg,rgba(255,255,255,0.07),transparent)', transform:'skewX(-6deg)', pointerEvents:'none' }} />
        ))}

        {/* Fish */}
        {FISH.map((f,i) => (
          <motion.div key={i} animate={{ x:[0, f.flip?-28:28, 0] }} transition={{ duration:f.dur, repeat:Infinity, ease:'easeInOut' }}
            style={{ position:'absolute', left:f.left, top:f.top, fontSize:f.size, lineHeight:1, pointerEvents:'none', opacity:0.45, transform:f.flip?'scaleX(-1)':'none' }}
          >🐠</motion.div>
        ))}

        {/* Seaweed */}
        {[6,17,32,50,65,78,92].map((left,i) => (
          <motion.div key={i} animate={{ rotate:[0, i%2===0?10:-10, 0] }} transition={{ duration:2.2+i*0.35, repeat:Infinity, ease:'easeInOut' }}
            style={{ position:'absolute', bottom:16, left:`${left}%`, width:10+(i%3)*4, height:28+(i%4)*16, background:`linear-gradient(180deg,${i%2===0?'#2ecc71':'#27ae60'},#1b6b35)`, borderRadius:'50% 50% 0 0 / 100% 100% 0 0', pointerEvents:'none', transformOrigin:'bottom center' }}
          />
        ))}

        {/* Sand */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:20, background:'linear-gradient(180deg,#c9933c,#9e7229)', pointerEvents:'none' }} />

        {/* Rounds counter */}
        <div style={{ position:'absolute', top:10, left:12, zIndex:10, fontFamily:'var(--font-heading)', fontSize:16, color:'white', background:'rgba(0,0,0,0.30)', borderRadius:99, padding:'4px 12px', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', gap:6 }}>
          {Array.from({length:3}).map((_,i) => (
            <span key={i} style={{ fontSize:16, filter: i<roundsWon?'none':'grayscale(1) opacity(0.3)' }}>⭐</span>
          ))}
        </div>

        {/* BUBBLES */}
        <AnimatePresence>
          {bubbles.map(bubble => {
            if (poppedIds.includes(bubble.id)) return null
            const isTarget = bubble.value === target
            return (
              <motion.button
                key={bubble.id}
                initial={{ scale:0, opacity:0 }}
                animate={{ opacity:1, scale:1 }}
                exit={{ scale:1.5, opacity:0, transition:{ duration:0.25 } }}
                transition={{
                  opacity:{ duration:0.3 },
                  scale:  { type:'spring', stiffness:300, damping:18 },
                }}
                whileTap={{ scale:1.4 }}
                onClick={() => popBubble(bubble)}
                style={{
                  x: mvsRef.current[bubble.id]?.mx,
                  y: mvsRef.current[bubble.id]?.my,
                  position:'absolute',
                  left:`${bubble.left}%`, top:`${bubble.top}%`,
                  marginLeft: -bubble.size/2, marginTop: -bubble.size/2,
                  width:bubble.size, height:bubble.size,
                  borderRadius:'50%',
                  background:`radial-gradient(circle at 33% 26%, rgba(255,255,255,0.70), ${bubble.tint.bg} 52%, rgba(255,255,255,0.08))`,
                  border:`2px solid rgba(255,255,255,0.52)`,
                  boxShadow: isTarget
                    ? `0 0 22px ${bubble.tint.glow}, 0 0 8px rgba(255,255,255,0.35), inset 0 -5px 10px rgba(0,0,0,0.18)`
                    : `0 3px 14px rgba(0,0,0,0.22), inset 0 -5px 10px rgba(0,0,0,0.12)`,
                  fontFamily:'var(--font-heading)',
                  fontSize:bubble.size*0.38, fontWeight:800, color:'white',
                  textShadow:'0 1px 6px rgba(0,0,0,0.45)',
                  cursor:'pointer',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  backdropFilter:'blur(2px)',
                  outline: isTarget ? `3px solid rgba(255,255,255,0.38)` : 'none',
                  outlineOffset:3, zIndex:5,
                }}
              >
                {bubble.value}
              </motion.button>
            )
          })}
        </AnimatePresence>

        {/* Overlays */}
        <AnimatePresence>
          {phase === 'roundWin' && (
            <motion.div key="win" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(40,180,80,0.35)', backdropFilter:'blur(6px)', borderRadius:28, fontFamily:'var(--font-heading)', fontSize:'clamp(26px,8vw,48px)', color:'white', fontWeight:700, flexDirection:'column', gap:4, textShadow:'0 2px 12px rgba(0,0,0,0.4)' }}
            ><span>🎉</span><span>Runde {roundIdx+1} geschafft!</span></motion.div>
          )}
          {phase === 'roundFail' && (
            <motion.div key="fail" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(220,60,60,0.3)', backdropFilter:'blur(5px)', borderRadius:28, fontFamily:'var(--font-heading)', fontSize:'clamp(24px,7vw,42px)', color:'white', fontWeight:700, textShadow:'0 2px 8px rgba(0,0,0,0.4)' }}
            >⌛ Zeit!</motion.div>
          )}
          {phase === 'done' && (
            <motion.div key="done" initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(8px)', borderRadius:28, fontFamily:'var(--font-heading)', fontSize:'clamp(24px,7vw,44px)', color:'white', fontWeight:700, flexDirection:'column', gap:6, textShadow:'0 2px 12px rgba(0,0,0,0.5)' }}
            >
              <span>{roundsWon>=3?'🏆':roundsWon>0?'🌟':'😅'}</span>
              <span>{roundsWon>=3?'Perfekt!':roundsWon>0?`${roundsWon}/3 Runden!`:'Nochmal!'}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p style={{ fontFamily:'var(--font-heading)', fontSize:14, color:'var(--text-muted)' }}>
        Runde {Math.min(roundIdx+1,3)} / 3
      </p>
    </div>
  )
}