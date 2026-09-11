import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'

/**
 * Rechen-Rakete — Addieren und Subtrahieren am Zahlenstrahl
 *
 * Scientific basis:
 *   • Mental number line (Siegler & Ramani, 2009) — board-game-like movement
 *     along a left-to-right number line measurably improves later arithmetic;
 *     the rocket hops one field per unit so the operation is a movement, not
 *     a memorised fact.
 *   • Concrete-Pictorial-Abstract (Bruner) — the ten frame carries the early
 *     levels and is withdrawn once the line alone suffices.
 *   • Missing-addend problems (Carpenter & Moser) — "3 + ? = 5" demands a
 *     different, harder mental action than "3 + 2 = ?" and comes last.
 */

function speakDE(text) { speak(text, { rate: 0.85, pitch: 1.05, lang: 'de-DE' }) }
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

// L1-2  plus 1 or 2, ten frame        L3-4  plus up to 5, ten frame
// L5-6  plus, no ten frame            L7-8  minus
// L9-10 missing addend
function levelPlan(level) {
  if (level <= 2)  return { max: 10, kind: 'add',     maxStep: 2, frame: true }
  if (level <= 4)  return { max: 10, kind: 'add',     maxStep: 5, frame: true }
  if (level <= 6)  return { max: 10, kind: 'add',     maxStep: 5, frame: false }
  if (level <= 8)  return { max: 10, kind: 'sub',     maxStep: 5, frame: false }
  return             { max: 20, kind: 'missing', maxStep: 6, frame: false }
}

function buildTasks(level, count = 8) {
  const p = levelPlan(level)
  const out = []
  let guard = 0
  while (out.length < count && guard++ < 400) {
    if (p.kind === 'sub') {
      const from = rand(2, p.max)
      const step = rand(1, Math.min(p.maxStep, from))
      out.push({ from, step, target: from - step, op: '−', kind: 'sub' })
    } else if (p.kind === 'missing') {
      const from = rand(0, p.max - 2)
      const step = rand(1, Math.min(p.maxStep, p.max - from))
      out.push({ from, step, target: from + step, op: '+', kind: 'missing' })
    } else {
      const step = rand(1, p.maxStep)
      const from = rand(0, p.max - step)
      out.push({ from, step, target: from + step, op: '+', kind: 'add' })
    }
  }
  return out
}

// ── Ten frame ────────────────────────────────────────────────────────────────
function TenFrame({ filled, added, max = 10 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, width: 'clamp(150px,34vw,220px)' }}>
      {Array.from({ length: max }, (_, i) => {
        const isBase  = i < filled
        const isAdded = i >= filled && i < filled + added
        return (
          <div key={i} style={{
            aspectRatio: '1', borderRadius: 8,
            border: '2px solid #C9C2EC',
            background: isBase ? '#6C63FF' : isAdded ? '#FFD93D' : 'white',
            transition: 'background 0.25s',
          }} />
        )
      })}
    </div>
  )
}

export default function RocketMathGame({ level = 1, onComplete }) {
  const plan  = useMemo(() => levelPlan(level), [level])
  const tasks = useState(() => buildTasks(level))[0]

  const [idx,     setIdx]     = useState(0)
  const [pos,     setPos]     = useState(() => tasks[0]?.from ?? 0)
  const [picked,  setPicked]  = useState(null)
  const [wrong,   setWrong]   = useState([])
  const [misses,  setMisses]  = useState(0)
  const [score,   setScore]   = useState(0)
  const [mood,    setMood]    = useState('happy')
  const [hopping, setHopping] = useState(false)
  const [showWeiter, setShowWeiter] = useState(false)
  const hopTimer = useRef(null)

  const t = tasks[idx]

  useEffect(() => () => clearTimeout(hopTimer.current), [])

  // New task: rocket returns to the starting number and the task is read out
  useEffect(() => {
    if (!t) return
    setPos(t.from)
    setPicked(null)
    setWrong([])
    setMood('happy')
    const said = t.kind === 'missing'
      ? `${t.from} plus wie viel ergibt ${t.target}?`
      : `${t.from} ${t.op === '+' ? 'plus' : 'minus'} ${t.step}. Wo landet die Rakete?`
    const id = setTimeout(() => speakDE(said), 450)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fly the rocket field by field, counting along — the movement is the
  // point, so it must be seen, not jumped.
  const hopTo = useCallback((from, to, done) => {
    setHopping(true)
    const dir = to > from ? 1 : -1
    let cur = from
    const stepOnce = () => {
      if (cur === to) { setHopping(false); done?.(); return }
      cur += dir
      setPos(cur)
      sfx.pop?.()
      hopTimer.current = setTimeout(stepOnce, 260)
    }
    hopTimer.current = setTimeout(stepOnce, 200)
  }, [])

  const pick = useCallback((n) => {
    if (picked !== null || hopping || !t) return
    // In missing-addend rounds the child names the jump length, elsewhere the
    // landing field — both are answered by tapping the line.
    const answer = t.kind === 'missing' ? t.target : t.target
    if (n !== answer) {
      setWrong(w => w.includes(n) ? w : [...w, n])
      setMisses(m => m + 1)
      setMood('encouraging')
      sfx.wrong()
      speakDE(n > answer ? 'Das ist zu weit.' : 'Das ist noch nicht weit genug.')
      setTimeout(() => setMood('happy'), 900)
      return
    }
    setPicked(n)
    setMood('excited')
    sfx.correct()
    hopTo(t.from, t.target, () => {
      const ns = score + 1
      setScore(ns)
      speakDE(t.kind === 'missing'
        ? `${t.from} plus ${t.step} ist ${t.target}.`
        : `${t.from} ${t.op === '+' ? 'plus' : 'minus'} ${t.step} ist ${t.target}.`)
      setShowWeiter(true)
    })
  }, [picked, hopping, t, score, hopTo])

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= tasks.length) {
      sfx.complete()
      const stars = misses === 0 ? 3 : misses <= tasks.length ? 2 : 1
      setTimeout(() => onComplete({ score: score, total: tasks.length, stars }), 300)
    } else {
      setIdx(i => i + 1)
    }
  }

  if (!t) return null
  const line = Array.from({ length: plan.max + 1 }, (_, i) => i)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(12px,3vw,28px)', gap: 'clamp(12px,2vw,20px)',
    }}>
      {/* Progress */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {tasks.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < idx ? '#6C63FF' : i === idx ? '#FFD93D' : '#ECE8FF',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + task */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={68} />
        <div style={{
          flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px', padding: '12px 18px',
          boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.4vw,22px)', color: 'var(--text-primary)',
        }}>
          {picked !== null
            ? <>🚀 Gelandet auf <strong style={{ color: '#4A00E0' }}>{t.target}</strong>!</>
            : t.kind === 'missing'
              ? <>Wo muss die Rakete landen, damit es <strong style={{ color: '#4A00E0' }}>{t.target}</strong> sind?</>
              : <>Tippe das Feld, auf dem die Rakete landet!</>}
        </div>
      </div>

      {/* The sum itself */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'clamp(8px,2vw,14px)',
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(30px,7vw,48px)', fontWeight: 800,
        color: '#4A00E0', background: 'white', borderRadius: 20,
        padding: 'clamp(8px,1.5vw,14px) clamp(18px,4vw,32px)',
        boxShadow: '0 5px 22px rgba(74,0,224,0.14)',
      }}>
        <span>{t.from}</span>
        <span style={{ color: '#FF9F43' }}>{t.op}</span>
        <span>{t.kind === 'missing' ? '?' : t.step}</span>
        <span style={{ color: '#9B8FCC' }}>=</span>
        <span>{t.kind === 'missing' ? t.target : (picked !== null ? t.target : '?')}</span>
      </div>

      {/* Ten frame while the levels still need it */}
      {plan.frame && (
        <TenFrame filled={t.from} added={picked !== null ? t.step : 0} max={10} />
      )}

      {/* Number line */}
      <div style={{
        display: 'flex', gap: 'clamp(2px,0.8vw,6px)', flexWrap: 'nowrap',
        width: '100%', maxWidth: 720, justifyContent: 'center',
        overflowX: 'auto', padding: '30px 4px 6px',
      }}>
        {line.map(n => {
          const here    = pos === n
          const isWrong = wrong.includes(n)
          const done    = picked !== null
          return (
            <div key={n} style={{ position: 'relative', flexShrink: 0 }}>
              {here && (
                <motion.div
                  layoutId="rocket"
                  transition={{ type: 'spring', stiffness: 420, damping: 26 }}
                  style={{
                    position: 'absolute', left: '50%', top: -30, transform: 'translateX(-50%)',
                    fontSize: 'clamp(22px,5vw,32px)', lineHeight: 1, pointerEvents: 'none',
                  }}
                >🚀</motion.div>
              )}
              <motion.button
                whileHover={!done && !hopping ? { scale: 1.12 } : {}}
                whileTap={!done && !hopping ? { scale: 0.9 } : {}}
                onClick={() => pick(n)}
                aria-label={`Feld ${n}`}
                style={{
                  width: 'clamp(26px,5.4vw,44px)', height: 'clamp(34px,6.4vw,52px)',
                  borderRadius: 12, cursor: done || hopping ? 'default' : 'pointer',
                  border: `2.5px solid ${done && n === t.target ? '#6BCB77' : isWrong ? '#FF6B6B' : here ? '#4A00E0' : '#ECE8FF'}`,
                  background: done && n === t.target ? '#E8F8EE' : isWrong ? '#FFE8E8' : here ? '#F0EEFF' : 'white',
                  fontFamily: 'var(--font-heading)', fontWeight: 700,
                  fontSize: 'clamp(13px,2.6vw,18px)',
                  color: isWrong ? '#C0392B' : 'var(--text-primary)',
                  opacity: isWrong ? 0.6 : 1,
                  transition: 'background 0.2s, border 0.2s',
                }}
              >{n}</motion.button>
            </div>
          )
        })}
      </div>

      <AnimatePresence>
        {showWeiter && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={weiterClick}
            style={{
              background: 'linear-gradient(135deg,#6C63FF,#4A00E0)', color: 'white',
              border: 'none', borderRadius: 20, padding: '12px 40px', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.4vw,21px)', fontWeight: 700,
              boxShadow: '0 5px 20px rgba(74,0,224,0.38)',
            }}
          >Weiter! →</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
