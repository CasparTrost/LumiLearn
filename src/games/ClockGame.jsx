import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

/**
 * Uhrzeiten-Meister — Uhrzeit lesen & stellen
 * Scientific basis:
 *   • Concrete-Pictorial-Abstract (Bruner) — manipulating analog clock hands
 *     builds deep conceptual understanding before abstract notation.
 *   • Time Perception (Friedman, 1990) — children ages 5–7 can learn to read
 *     hours and half-hours; quarter-hours from age 7.
 *   • Dual-task engagement — simultaneously reading/setting reinforces both
 *     receptive and productive knowledge of time concepts.
 */

// ── Question banks per level ─────────────────────────────────────────────────
// L1: full hours only
// L2: full + half hours
// L3: quarter hours
// L4: 5-minute steps
// L5: any minute

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

function generateTimes(level, count = level <= 4 ? 8 : level <= 7 ? 10 : 12) {
  const times = []
  const seen  = new Set()
  let attempts = 0
  while (times.length < count && attempts < 500) {
    attempts++
    let h, m
    if (level <= 2) {
      h = rand(1, 12); m = 0
    } else if (level <= 4) {
      h = rand(1, 12); m = [0, 30][rand(0, 1)]
    } else if (level <= 6) {
      h = rand(1, 12); m = [0, 15, 30, 45][rand(0, 3)]
    } else if (level <= 8) {
      h = rand(1, 12); m = rand(0, 11) * 5
    } else {
      h = rand(1, 12); m = rand(0, 59)
    }
    const key = `${h}:${m}`
    if (!seen.has(key)) { seen.add(key); times.push({ h, m }) }
  }
  return times
}

function fmt(h, m) {
  return `${h}:${String(m).padStart(2, '0')} Uhr`
}

function timeDiffMin(h1, m1, h2, m2) {
  // difference in minutes, mod 720 (half-day)
  const t1 = ((h1 % 12) * 60 + m1 + 720) % 720
  const t2 = ((h2 % 12) * 60 + m2 + 720) % 720
  const raw = Math.abs(t1 - t2)
  return Math.min(raw, 720 - raw)
}

// ── Analog Clock SVG ─────────────────────────────────────────────────────────
const CX = 120, CY = 120, R = 108

function ClockFace({ targetH, targetM, interactive, onAnswer, level = 1 }) {
  // Current hand positions (for interactive mode)
  const [hours,   setHours]   = useState(12)
  const [minutes, setMinutes] = useState(0)
  const [dragging, setDragging] = useState(null) // 'hour' | 'minute' | null
  const svgRef = useRef(null)

  // For display-only mode, show target time directly
  const displayH = interactive ? hours   : targetH
  const displayM = interactive ? minutes : targetM

  const getAngle = useCallback((e) => {
    const svg = svgRef.current
    if (!svg) return 0
    const rect    = svg.getBoundingClientRect()
    const cx      = rect.left + rect.width  / 2
    const cy      = rect.top  + rect.height / 2
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    // atan2(dx, -dy): 0° at top (12 o'clock), positive clockwise
    return (Math.atan2(clientX - cx, -(clientY - cy)) * 180 / Math.PI + 360) % 360
  }, [])

  const onPointerDown = useCallback((hand, e) => {
    if (!interactive) return
    e.preventDefault()
    setDragging(hand)
  }, [interactive])

  // Window-level drag: doesn't break when pointer leaves SVG bounds
  useEffect(() => {
    if (!dragging) return
    const handleMove = (e) => {
      e.preventDefault()
      const angle = getAngle(e)
      if (dragging === 'minute') {
        setMinutes(Math.round(angle / 6) % 60)
      } else {
        setHours(Math.round(angle / 30) % 12 || 12)
      }
    }
    const handleUp = () => setDragging(null)
    window.addEventListener('mousemove', handleMove, { passive: false })
    window.addEventListener('mouseup',   handleUp)
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend',  handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup',   handleUp)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend',  handleUp)
    }
  }, [dragging, getAngle])

  // Submit answer
  const submit = useCallback(() => {
    if (!interactive || !onAnswer) return
    onAnswer(hours, minutes)
  }, [interactive, hours, minutes, onAnswer])

  // Hour hand: 360°/12h = 30° per hour + 0.5° per minute
  const hourAngle   = (displayH % 12) * 30 + displayM * 0.5
  // Minute hand: 360°/60min = 6° per minute
  const minuteAngle = displayM * 6

  // Correct clock-angle → SVG coordinate: 0° = 12 o'clock, clockwise
  function handEnd(angleDeg, length) {
    const rad = angleDeg * Math.PI / 180
    return {
      x: CX + length * Math.sin(rad),
      y: CY - length * Math.cos(rad),
    }
  }

  const hourEnd   = handEnd(hourAngle,   R * 0.54)
  const minuteEnd = handEnd(minuteAngle, R * 0.76)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg
        ref={svgRef}
        viewBox="0 0 240 240"
        style={{
          width: 'min(76vw, 340px)',
          height: 'auto',
          display: 'block',
          borderRadius: '50%',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          cursor: dragging ? 'grabbing' : interactive ? 'grab' : 'default',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {/* Clock face */}
        <circle cx={CX} cy={CY} r={R} fill="white" stroke="#E0D5FF" strokeWidth={4} />
        <circle cx={CX} cy={CY} r={R - 6} fill="none" stroke="#F3EEFF" strokeWidth={2} />

        {/* Hour markers */}
        {Array.from({ length: 12 }, (_, i) => {
          const ang = (i / 12) * Math.PI * 2 - Math.PI / 2
          const outer = R - 8
          const inner = i % 3 === 0 ? R - 22 : R - 16
          return (
            <line key={i}
              x1={CX + outer * Math.cos(ang)} y1={CY + outer * Math.sin(ang)}
              x2={CX + inner * Math.cos(ang)} y2={CY + inner * Math.sin(ang)}
              stroke={i % 3 === 0 ? '#6C63FF' : '#C0B8E8'}
              strokeWidth={i % 3 === 0 ? 3.5 : 2}
              strokeLinecap="round"
            />
          )
        })}

        {/* Hour numbers */}
        {[12,1,2,3,4,5,6,7,8,9,10,11].map((n, i) => {
          const ang = (i / 12) * Math.PI * 2 - Math.PI / 2
          const r2  = R - 34
          return (
            <text key={n}
              x={CX + r2 * Math.cos(ang)}
              y={CY + r2 * Math.sin(ang) + 5}
              textAnchor="middle"
              fontSize={i % 3 === 0 ? 17 : 13}
              fontWeight={i % 3 === 0 ? '700' : '500'}
              fill={i % 3 === 0 ? '#4A00E0' : '#9B8FCC'}
              fontFamily="var(--font-heading, system-ui)"
              opacity={level <= 3 ? 1 : level <= 5 ? 0.7 : 0.4}
            >{n}</text>
          )
        })}

        {/* Hour hand */}
        <line
          x1={CX} y1={CY}
          x2={hourEnd.x} y2={hourEnd.y}
          stroke={interactive ? '#4A00E0' : '#333'}
          strokeWidth={interactive ? 8 : 7}
          strokeLinecap="round"
          style={{ cursor: 'default', pointerEvents: 'none' }}
        />
        {/* Minute hand */}
        <line
          x1={CX} y1={CY}
          x2={minuteEnd.x} y2={minuteEnd.y}
          stroke={interactive ? '#FF6B6B' : '#6C63FF'}
          strokeWidth={interactive ? 5 : 4}
          strokeLinecap="round"
          style={{ cursor: 'default', pointerEvents: 'none' }}
        />
        {/* Center cap */}
        <circle cx={CX} cy={CY} r={7} fill="#4A00E0" style={{ pointerEvents: 'none' }} />
        <circle cx={CX} cy={CY} r={4} fill="white" style={{ pointerEvents: 'none' }} />

        {/* Tip handles — grab these to drag each hand */}
        {interactive && (<>
          {/* Hour tip: blue circle */}
          <circle
            cx={hourEnd.x} cy={hourEnd.y} r={26}
            fill="#4A00E0" opacity={dragging === 'hour' ? 1 : 0.82}
            stroke="white" strokeWidth={3}
            style={{ cursor: dragging === 'hour' ? 'grabbing' : 'grab', filter: 'drop-shadow(0 2px 6px rgba(74,0,224,0.5))' }}
            onMouseDown={(e) => { e.stopPropagation(); onPointerDown('hour', e) }}
            onTouchStart={(e) => { e.stopPropagation(); onPointerDown('hour', e) }}
          />
          <text x={hourEnd.x} y={hourEnd.y + 5} textAnchor="middle" fontSize={11}
            fill="white" fontWeight="800" style={{ pointerEvents: 'none', userSelect: 'none' }}>S</text>

          {/* Minute tip: red circle */}
          <circle
            cx={minuteEnd.x} cy={minuteEnd.y} r={24}
            fill="#FF6B6B" opacity={dragging === 'minute' ? 1 : 0.82}
            stroke="white" strokeWidth={3}
            style={{ cursor: dragging === 'minute' ? 'grabbing' : 'grab', filter: 'drop-shadow(0 2px 6px rgba(255,107,107,0.5))' }}
            onMouseDown={(e) => { e.stopPropagation(); onPointerDown('minute', e) }}
            onTouchStart={(e) => { e.stopPropagation(); onPointerDown('minute', e) }}
          />
          <text x={minuteEnd.x} y={minuteEnd.y + 5} textAnchor="middle" fontSize={11}
            fill="white" fontWeight="800" style={{ pointerEvents: 'none', userSelect: 'none' }}>M</text>
        </>)}
      </svg>

      {/* Digital readout — only visible when child is setting the time */}
      {interactive && (
        <div style={{
          fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 800,
          color: '#4A00E0',
          background: 'white', borderRadius: 14, padding: '6px 20px',
          boxShadow: '0 3px 12px rgba(74,0,224,0.12)',
        }}>
          {fmt(displayH, displayM)}
        </div>
      )}

      {/* Legend */}
      {interactive && (
        <div style={{
          display: 'flex', gap: 18, justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700,
        }}>
          <span style={{ color: '#4A00E0' }}>🔵 Stundenzeiger ziehen</span>
          <span style={{ color: '#FF6B6B' }}>🔴 Minutenzeiger ziehen</span>
        </div>
      )}

      {interactive && (
        <motion.button
          whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.93 }}
          onClick={submit}
          style={{
            background: 'linear-gradient(135deg,#6C63FF,#4A00E0)',
            color: 'white', border: 'none', borderRadius: 18,
            padding: '14px 40px',
            fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700,
            cursor: 'pointer', boxShadow: '0 5px 20px rgba(74,0,224,0.38)',
          }}
        >{'✅ Fertig!'}</motion.button>
      )}
    </div>
  )
}

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function ClockGame({ level = 1, onComplete }) {
  const [times]     = useState(() => generateTimes(level))
  const [idx,       setIdx]       = useState(0)
  const [mode,      setMode]      = useState('read')   // 'read' (pick digital) | 'set' (drag hands)
  const [feedback,  setFeedback]  = useState(null)     // 'ok' | 'wrong'
  const [score,     setScore]     = useState(0)
  const [mood,      setMood]      = useState('happy')
  const [flashKey,  setFlashKey]  = useState(0)

  const t = times[idx]

  // Alternate between 'read' and 'set' modes
  useEffect(() => { setMode(idx % 2 === 0 ? 'read' : 'set') }, [idx])

  // Wrong-answer options — stable via useMemo
  const options = useMemo(() => {
    if (!t) return []
    const correct = fmt(t.h, t.m)
    const wrongs  = []
    const seen    = new Set([correct])
    let tries     = 0
    while (wrongs.length < 3 && tries < 200) {
      tries++
      let wh = rand(1, 12)
      let wm
      if (level <= 1)      wm = 0
      else if (level <= 2) wm = [0, 30][rand(0, 1)]
      else if (level <= 3) wm = [0, 15, 30, 45][rand(0, 3)]
      else                 wm = rand(0, 11) * 5
      const s = fmt(wh, wm)
      if (!seen.has(s) && !(wh === t.h && wm === t.m)) { seen.add(s); wrongs.push(s) }
    }
    return shuffle([correct, ...wrongs])
  }, [idx, level])

  const advance = useCallback((ok) => {
    const ns = score + (ok ? 1 : 0)
    if (ok) setScore(ns)
    setFeedback(ok ? 'ok' : 'wrong')
    setMood(ok ? 'excited' : 'encouraging')
    setFlashKey(k => k + 1)
    if (ok) sfx.correct(); else sfx.wrong()
    setTimeout(() => {
      setFeedback(null)
      setMood('happy')
      if (idx + 1 >= times.length) {
        sfx.complete()
        setTimeout(() => onComplete({ score: ns, total: times.length }), 900)
      } else {
        setIdx(i => i + 1)
      }
    }, 1100)
  }, [score, idx, times.length, onComplete])

  const pickDigital = useCallback((opt) => {
    if (feedback) return
    const correct = fmt(t.h, t.m)
    advance(opt === correct)
  }, [feedback, t, advance])

  const submitAnalog = useCallback((h, m) => {
    if (feedback) return
    const diff = timeDiffMin(h, m, t.h, t.m)
    const tolerance = level <= 2 ? 0 : level <= 3 ? 14 : 4
    advance(diff <= tolerance)
  }, [feedback, t, level, advance])

  if (!t) return null

  // Tolerance label shown to child
  const toleranceLabel = level <= 1 ? 'ganze Stunden' : level <= 2 ? 'halbe Stunden' : level <= 3 ? 'Viertelstunden' : '5-Minuten-Schritte'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)',
      gap: 'clamp(12px,2vw,20px)',
    }}>

      {/* Confetti on correct */}
      <AnimatePresence>
        {feedback === 'ok' && (
          <motion.div key={'confetti-'+flashKey}
            initial={{opacity:1}} animate={{opacity:0}} transition={{delay:0.8,duration:0.3}}
            style={{position:'fixed',inset:0,zIndex:160,pointerEvents:'none',
              display:'flex',alignItems:'center',justifyContent:'center',fontSize:60}}>
            {['🌟','✨','⭐','🎉','🌟','✨'].map((e,i) => (
              <motion.span key={i}
                initial={{y:0,x:0,scale:0,opacity:1}}
                animate={{y:-(80+i*25),x:(i%2===0?1:-1)*(40+i*30),scale:[0,1.3,0],opacity:[1,1,0]}}
                transition={{duration:0.7,delay:i*0.06}}
                style={{position:'absolute'}}>{e}</motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Flash overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div key={flashKey}
            initial={{ opacity: 0.35 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ position: 'fixed', inset: 0, zIndex: 150, pointerEvents: 'none',
                     background: feedback === 'ok' ? '#6BCB77' : '#FF6B6B' }}
          />
        )}
      </AnimatePresence>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {times.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < idx ? '#6C63FF' : i === idx ? '#FFD93D' : '#ECE8FF',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Score + difficulty label */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--text-muted)' }}>
          {'✅ ' + score + ' / ' + times.length}
        </div>
        <div style={{
          background: '#F0EEFF', borderRadius: 99, padding: '5px 14px',
          fontFamily: 'var(--font-heading)', fontSize: 13, color: '#6C63FF',
          border: '1.5px solid #A29BFE',
        }}>{'🕐 ' + toleranceLabel}</div>
      </div>

      {/* Lumi */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={72} />
        <motion.div
          key={idx}
          initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }}
          style={{
            flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px',
            padding: '13px 18px',
            boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.2vw,22px)',
            color: 'var(--text-primary)',
          }}
        >
          {mode === 'read'
            ? (<>Welche Uhrzeit zeigt die Uhr? 🕐</>)
            : (<>Stelle die Uhr auf <strong style={{ color: '#4A00E0' }}>{fmt(t.h, t.m)}</strong>! Ziehe die Zeiger! 🖐️</>)
          }
        </motion.div>
      </div>

      {/* Main interaction area */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'clamp(16px,4vw,40px)',
        alignItems: 'center', justifyContent: 'center', width: '100%',
      }}>

        {/* Clock display */}
        <AnimatePresence mode="wait">
          <motion.div key={idx}
            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{
              background: feedback === 'ok' ? 'linear-gradient(135deg,#E8F8EE,#D0F4DE)'
                        : feedback === 'wrong' ? 'linear-gradient(135deg,#FFE8E8,#ffd0d0)'
                        : 'linear-gradient(135deg,#F0EEFF,#E8E4FF)',
              borderRadius: 28, padding: 'clamp(16px,3vw,28px)',
              boxShadow: '0 8px 36px rgba(74,0,224,0.14)',
              transition: 'background 0.3s',
            }}
          >
            <ClockFace
              targetH={t.h} targetM={t.m}
              interactive={mode === 'set'}
              onAnswer={submitAnalog}
              level={level}
            />
          </motion.div>
        </AnimatePresence>

        {/* READ MODE: pick the digital time */}
        {mode === 'read' && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(2,1fr)',
            gap: 'clamp(10px,2vw,16px)', width: 280,
          }}>
            {options.map(opt => {
              const correct = opt === fmt(t.h, t.m)
              const done    = feedback !== null
              return (
                <motion.button key={opt}
                  whileHover={!done ? { scale: 1.06 } : {}}
                  whileTap={!done ? { scale: 0.94 } : {}}
                  onClick={() => pickDigital(opt)}
                  style={{
                    padding: '14px 10px',
                    minHeight: 80,
                    borderRadius: 20,
                    fontFamily: 'var(--font-heading)', fontSize: 'clamp(17px,3.5vw,22px)',
                    fontWeight: 700,
                    background: done && correct ? '#E8F8EE' : done && opt === options.find(o => o !== fmt(t.h, t.m)) ? '#FFE8E8' : 'white',
                    border: `3px solid ${done && correct ? '#6BCB77' : done && !correct ? '#FF6B6B' : '#ECE8FF'}`,
                    boxShadow: done && correct ? '0 6px 22px rgba(107,203,119,0.4)' : '0 4px 14px rgba(0,0,0,0.07)',
                    color: 'var(--text-primary)',
                    cursor: done ? 'default' : 'pointer',
                    transition: 'background 0.22s, border 0.22s, box-shadow 0.22s',
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', gap: 4,
                  }}
                >
                  <span>{opt}</span>
                  {/* pre-reserved space — no reflow when ✅ appears */}
                  <span style={{ fontSize: 18, opacity: done && correct ? 1 : 0, transition: 'opacity 0.2s' }}>{'✅'}</span>
                </motion.button>
              )
            })}
          </div>
        )}

        {/* SET MODE feedback badge */}
        {mode === 'set' && feedback === 'ok' && (
          <motion.div
            initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 14 }}
            style={{ fontSize: 80, lineHeight: 1, filter: 'drop-shadow(0 4px 14px rgba(107,203,119,0.5))' }}
          >🎉</motion.div>
        )}
        {mode === 'set' && feedback === 'wrong' && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            style={{
              fontSize: 72, lineHeight: 1,
              filter: 'drop-shadow(0 4px 14px rgba(0,0,0,0.2))',
            }}
          >
            ❌
          </motion.div>
        )}
      </div>
    </div>
  )
}
