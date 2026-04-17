import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

/**
 * Waage-Welt — Vergleiche, was schwerer ist
 *
 * Scientific basis:
 *   • Conservation & Proportional Reasoning (Piaget)
 *   • STEM Foundations (NCTM) — measurement and comparison for Pre-K – Grade 2
 *   • Concrete → Pictorial → Abstract learning trajectory
 */

const randomBetween = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a

// ── L1: Intuitive / perceptual comparison ───────────────────────────────────
const INTUITIVE = [
  { leftEmoji: '🪶', leftLabel: 'Feder',          leftW: 1,  rightEmoji: '🔨', rightLabel: 'Hammer',        rightW: 18 },
  { leftEmoji: '🐘', leftLabel: 'Elefant',        leftW: 40, rightEmoji: '🐭', rightLabel: 'Maus',          rightW: 1  },
  { leftEmoji: '🍎', leftLabel: 'Apfel',          leftW: 5,  rightEmoji: '🐣', rightLabel: 'Küken',         rightW: 2  },
  { leftEmoji: '🚗', leftLabel: 'Auto',           leftW: 30, rightEmoji: '🦋', rightLabel: 'Schmetterling', rightW: 1  },
  { leftEmoji: '🪨', leftLabel: 'Stein',          leftW: 20, rightEmoji: '🍃', rightLabel: 'Blatt',         rightW: 1  },
  { leftEmoji: '🐮', leftLabel: 'Kuh',            leftW: 25, rightEmoji: '🐔', rightLabel: 'Huhn',          rightW: 3  },
  { leftEmoji: '🐳', leftLabel: 'Wal',            leftW: 50, rightEmoji: '🐠', rightLabel: 'Fisch',         rightW: 2  },
  { leftEmoji: '🍌', leftLabel: 'Banane',         leftW: 4,  rightEmoji: '🍓', rightLabel: 'Erdbeere',      rightW: 2  },
  { leftEmoji: '🚂', leftLabel: 'Zug',            leftW: 60, rightEmoji: '🛴', rightLabel: 'Roller',        rightW: 5  },
  { leftEmoji: '🍉', leftLabel: 'Melone',         leftW: 8,  rightEmoji: '🍇', rightLabel: 'Traube',        rightW: 3  },
  { leftEmoji: '🏋️', leftLabel: 'Hantel',         leftW: 22, rightEmoji: '🎈', rightLabel: 'Luftballon',    rightW: 1  },
  { leftEmoji: '🐊', leftLabel: 'Krokodil',       leftW: 35, rightEmoji: '🦜', rightLabel: 'Papagei',       rightW: 2  },
  { leftEmoji: '🚀', leftLabel: 'Rakete',         leftW: 45, rightEmoji: '🍂', rightLabel: 'Blatt',         rightW: 1  },
  { leftEmoji: '🏠', leftLabel: 'Haus',           leftW: 55, rightEmoji: '🏐', rightLabel: 'Volleyball',    rightW: 3  },
  { leftEmoji: '🦁', leftLabel: 'Löwe',           leftW: 28, rightEmoji: '🐇', rightLabel: 'Hase',          rightW: 2  },
  { leftEmoji: '🍞', leftLabel: 'Brot',           leftW: 6,  rightEmoji: '🍬', rightLabel: 'Bonbon',        rightW: 1  },
  { leftEmoji: '🐋', leftLabel: 'Blauwal',        leftW: 80, rightEmoji: '🐿️', rightLabel: 'Eichhörnchen', rightW: 1  },
  { leftEmoji: '💎', leftLabel: 'Diamant',        leftW: 12, rightEmoji: '🧸', rightLabel: 'Teddybär',      rightW: 4  },
  { leftEmoji: '🌊', leftLabel: 'Welle',          leftW: 40, rightEmoji: '🫧', rightLabel: 'Seifenblase',   rightW: 1  },
  { leftEmoji: '🪵', leftLabel: 'Holzblock',      leftW: 15, rightEmoji: '🌸', rightLabel: 'Blüte',         rightW: 1  },
  { leftEmoji: '🐸', leftLabel: 'Frosch',         leftW: 4,  rightEmoji: '🐛', rightLabel: 'Raupe',         rightW: 1  },
  { leftEmoji: '🥊', leftLabel: 'Boxhandschuh',   leftW: 10, rightEmoji: '🪁', rightLabel: 'Schleuder',     rightW: 1  },
  { leftEmoji: '🏔️', leftLabel: 'Berg',           leftW: 70, rightEmoji: '⛺', rightLabel: 'Zelt',          rightW: 4  },
  { leftEmoji: '🚢', leftLabel: 'Schiff',         leftW: 65, rightEmoji: '⛵', rightLabel: 'Segelboot',     rightW: 8  },
  { leftEmoji: '🍕', leftLabel: 'Pizza',          leftW: 7,  rightEmoji: '🍬', rightLabel: 'Gummibärchen', rightW: 1  },
  { leftEmoji: '🦒', leftLabel: 'Giraffe',        leftW: 30, rightEmoji: '🐓', rightLabel: 'Hahn',          rightW: 3  },
  { leftEmoji: '🎸', leftLabel: 'Gitarre',        leftW: 6,  rightEmoji: '🪗', rightLabel: 'Harmonika',     rightW: 2  },
  { leftEmoji: '🥥', leftLabel: 'Kokosnuss',      leftW: 5,  rightEmoji: '🫐', rightLabel: 'Blaubeere',     rightW: 1  },
  { leftEmoji: '🚜', leftLabel: 'Traktor',        leftW: 40, rightEmoji: '🛺', rightLabel: 'Rikscha',       rightW: 6  },
  { leftEmoji: '🦣', leftLabel: 'Mammut',         leftW: 55, rightEmoji: '🐇', rightLabel: 'Hase',          rightW: 2  },
  { leftEmoji: '🪨', leftLabel: 'Felsbrocken',    leftW: 30, rightEmoji: '🍃', rightLabel: 'Blättchen',     rightW: 1  },
  { leftEmoji: '🎠', leftLabel: 'Karussell',      leftW: 35, rightEmoji: '🥎', rightLabel: 'Baseball',      rightW: 3  },
  { leftEmoji: '🍰', leftLabel: 'Torte',          leftW: 5,  rightEmoji: '🍡', rightLabel: 'Dango',         rightW: 1  },
  { leftEmoji: '🦘', leftLabel: 'Känguru',        leftW: 20, rightEmoji: '🐁', rightLabel: 'Mäuschen',      rightW: 1  },
  { leftEmoji: '🪜', leftLabel: 'Leiter',         leftW: 8,  rightEmoji: '📐', rightLabel: 'Lineal',        rightW: 1  },
  { leftEmoji: '🛁', leftLabel: 'Badewanne',      leftW: 25, rightEmoji: '🧽', rightLabel: 'Schwamm',       rightW: 1  },
  { leftEmoji: '🚁', leftLabel: 'Hubschrauber',   leftW: 42, rightEmoji: '🪁', rightLabel: 'Drachen',       rightW: 2  },
  { leftEmoji: '🐝', leftLabel: 'Biene',          leftW: 1,  rightEmoji: '🍊', rightLabel: 'Orange',        rightW: 6  },
  { leftEmoji: '🏋️', leftLabel: 'Gewichtheber',   leftW: 28, rightEmoji: '🧒', rightLabel: 'Kind',          rightW: 15 },
  { leftEmoji: '🌰', leftLabel: 'Eichel',         leftW: 1,  rightEmoji: '🍑', rightLabel: 'Pfirsich',      rightW: 5  },
  { leftEmoji: '📱', leftLabel: 'Handy',          leftW: 4,  rightEmoji: '💻', rightLabel: 'Laptop',        rightW: 12 },
  { leftEmoji: '🎒', leftLabel: 'Schulrucksack',  leftW: 8,  rightEmoji: '🖊️', rightLabel: 'Stift',         rightW: 1  },
  { leftEmoji: '🐅', leftLabel: 'Tiger',          leftW: 26, rightEmoji: '🐾', rightLabel: 'Pfote',         rightW: 1  },
  { leftEmoji: '🚌', leftLabel: 'Bus',            leftW: 40, rightEmoji: '🛵', rightLabel: 'Moped',         rightW: 6  },
  { leftEmoji: '🍦', leftLabel: 'Softeis',        leftW: 2,  rightEmoji: '🥐', rightLabel: 'Croissant',     rightW: 4  },
  { leftEmoji: '🌍', leftLabel: 'Erde',           leftW: 99, rightEmoji: '🌕', rightLabel: 'Mond',          rightW: 15 },
  { leftEmoji: '🎃', leftLabel: 'Kürbis',         leftW: 9,  rightEmoji: '🕯️', rightLabel: 'Kerze',         rightW: 1  },
  { leftEmoji: '🦴', leftLabel: 'Knochen',        leftW: 6,  rightEmoji: '🪶', rightLabel: 'Feder',         rightW: 1  },
  { leftEmoji: '🏊', leftLabel: 'Schwimmer',      leftW: 18, rightEmoji: '🐠', rightLabel: 'Fisch',         rightW: 1  },
  { leftEmoji: '🪣', leftLabel: 'Eimer',          leftW: 4,  rightEmoji: '🧴', rightLabel: 'Flasche',       rightW: 2  },
]

// ── L2: Numeric weights ──────────────────────────────────────────────────────
const BOX_ITEMS = [
  { emoji: '📦', label: 'Paket'    },
  { emoji: '🎒', label: 'Rucksack' },
  { emoji: '🧳', label: 'Koffer'   },
  { emoji: '🏀', label: 'Ball'     },
  { emoji: '🎱', label: 'Billard'  },
  { emoji: '🧱', label: 'Ziegel'   },
]

function makeNumericQuestions(n = 8, maxKg = 15) {
  const qs = []
  for (let i = 0; i < n; i++) {
    const lw = randomBetween(1, maxKg)
    let rw
    do { rw = randomBetween(1, maxKg) } while (rw === lw)
    const li = BOX_ITEMS[randomBetween(0, BOX_ITEMS.length - 1)]
    let ri
    do { ri = BOX_ITEMS[randomBetween(0, BOX_ITEMS.length - 1)] } while (ri === li)
    qs.push({
      leftEmoji: li.emoji,  leftLabel: `${lw} kg`,  leftW: lw,
      rightEmoji: ri.emoji, rightLabel: `${rw} kg`, rightW: rw,
      showNumbers: true,
    })
  }
  return qs
}

// ── L3: Addition one side ────────────────────────────────────────────────────
function makeAdditionQuestions(n = 8) {
  const qs = []
  for (let i = 0; i < n; i++) {
    const a = randomBetween(1, 8)
    const b = randomBetween(1, 8)
    let rw
    do { rw = randomBetween(2, 14) } while (rw === a + b)
    qs.push({
      leftEmoji: '📦', leftLabel: `${a} + ${b} kg`, leftW: a + b,
      rightEmoji: '📦', rightLabel: `${rw} kg`,      rightW: rw,
      showNumbers: true,
    })
  }
  return qs
}

// ── L4: Multiplication ───────────────────────────────────────────────────────
function makeMultiplyQuestions(n = 8) {
  const qs = []
  for (let i = 0; i < n; i++) {
    const a = randomBetween(2, 6)
    const b = randomBetween(2, 5)
    let rw
    do { rw = randomBetween(4, 28) } while (rw === a * b)
    qs.push({
      leftEmoji: '📦', leftLabel: `${a} × ${b} kg`, leftW: a * b,
      rightEmoji: '📦', rightLabel: `${rw} kg`,       rightW: rw,
      showNumbers: true,
    })
  }
  return qs
}

function buildQuestions(level) {
  const n = level <= 4 ? 8 : level <= 7 ? 10 : 12
  if (level <= 2) return [...INTUITIVE].sort(() => Math.random() - 0.5).slice(0, n)
  if (level <= 4) return makeNumericQuestions(n, 15)
  if (level <= 6) return makeNumericQuestions(n, 50)
  if (level <= 8) return makeAdditionQuestions(n)
  return makeMultiplyQuestions(n)
}

// ── Balance Scale — realistic SVG with beam, chains and pans ────────────────
function BalanceScale({ tiltDeg, leftEmoji, rightEmoji, leftLabel, rightLabel,
                        answered, leftHeavier, onPickLeft, onPickRight }) {
  const W = 400, CX = 200, PIVOT_Y = 70, ARM = 150, CHAIN = 90, PAN_W = 88

  return (
    <svg width="100%" viewBox={`0 0 ${W} 280`}
      style={{ maxWidth: 440, display:'block', overflow:'visible' }}>
      <defs>
        <linearGradient id="bBase" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7C6FAF"/><stop offset="100%" stopColor="#4A00E0"/>
        </linearGradient>
        <linearGradient id="bPole" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#A29BFE"/><stop offset="50%" stopColor="#E8E4FF"/>
          <stop offset="100%" stopColor="#A29BFE"/>
        </linearGradient>
        <linearGradient id="bBeam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EDE8FF"/><stop offset="100%" stopColor="#A29BFE"/>
        </linearGradient>
        <filter id="bShadow"><feDropShadow dx="0" dy="3" stdDeviation="5" floodOpacity="0.2"/></filter>
      </defs>

      {/* Base */}
      <rect x={CX-60} y={254} width={120} height={18} rx={9} fill="url(#bBase)" filter="url(#bShadow)"/>
      <rect x={CX-45} y={244} width={90}  height={14} rx={7} fill="#9B8FCC"/>

      {/* Pole with rings */}
      <rect x={CX-7} y={PIVOT_Y+14} width={14} height={178} rx={7} fill="url(#bPole)"/>
      {[0.25,0.5,0.75].map((f,i)=>(
        <rect key={i} x={CX-10} y={PIVOT_Y+14+(178)*f} width={20} height={7} rx={3.5} fill="#7C6FAF"/>
      ))}

      {/* Beam + chains + pans (all rotate together) */}
      <motion.g
        animate={{ rotate: tiltDeg }}
        transition={{ type:'spring', stiffness:50, damping:11 }}
        style={{ transformOrigin:`${CX}px ${PIVOT_Y}px` }}
      >
        {/* Beam bar */}
        <rect x={CX-ARM-8} y={PIVOT_Y-7} width={ARM*2+16} height={14} rx={7}
          fill="url(#bBeam)" filter="url(#bShadow)"/>
        <circle cx={CX-ARM} cy={PIVOT_Y} r={9} fill="#6C63FF"/>
        <circle cx={CX+ARM} cy={PIVOT_Y} r={9} fill="#6C63FF"/>

        {/* Left chain */}
        {Array.from({length:5},(_,i)=>(
          <line key={"lc"+i} x1={CX-ARM} y1={PIVOT_Y+9+i*16} x2={CX-ARM} y2={PIVOT_Y+9+(i+1)*16}
            stroke="#9B8FCC" strokeWidth={3} strokeLinecap="round"/>
        ))}
        {/* Right chain */}
        {Array.from({length:5},(_,i)=>(
          <line key={"rc"+i} x1={CX+ARM} y1={PIVOT_Y+9+i*16} x2={CX+ARM} y2={PIVOT_Y+9+(i+1)*16}
            stroke="#9B8FCC" strokeWidth={3} strokeLinecap="round"/>
        ))}

        {/* Left pan bowl */}
        <ellipse cx={CX-ARM} cy={PIVOT_Y+CHAIN}   rx={PAN_W/2} ry={10} fill="#D4CCFF" stroke="#9B8FCC" strokeWidth={2}/>
        <path d={`M${CX-ARM-PAN_W/2} ${PIVOT_Y+CHAIN} Q${CX-ARM} ${PIVOT_Y+CHAIN+28} ${CX-ARM+PAN_W/2} ${PIVOT_Y+CHAIN}`}
          fill="#C4BAFF" stroke="#9B8FCC" strokeWidth={2}/>
        {/* Right pan bowl */}
        <ellipse cx={CX+ARM} cy={PIVOT_Y+CHAIN}   rx={PAN_W/2} ry={10} fill="#D4CCFF" stroke="#9B8FCC" strokeWidth={2}/>
        <path d={`M${CX+ARM-PAN_W/2} ${PIVOT_Y+CHAIN} Q${CX+ARM} ${PIVOT_Y+CHAIN+28} ${CX+ARM+PAN_W/2} ${PIVOT_Y+CHAIN}`}
          fill="#C4BAFF" stroke="#9B8FCC" strokeWidth={2}/>

        {/* Left item — clickable */}
        <g style={{ cursor: answered?'default':'pointer' }}
           onClick={!answered ? onPickLeft : undefined}>
          {answered && leftHeavier && (
            <circle cx={CX-ARM} cy={PIVOT_Y+CHAIN-22} r={38} fill="#FFD93D" opacity={0.22}/>
          )}
          <text x={CX-ARM} y={PIVOT_Y+CHAIN-8} textAnchor="middle" fontSize={40}
            dominantBaseline="middle" style={{userSelect:'none',
              filter: answered&&leftHeavier?'drop-shadow(0 0 8px #FFD93D)':'none'}}>
            {leftEmoji}
          </text>
          <text x={CX-ARM} y={PIVOT_Y+CHAIN+32} textAnchor="middle" fontSize={13}
            fontWeight="700" fill={answered&&leftHeavier?"#4A00E0":"#6C5CE7"}
            fontFamily="var(--font-heading,system-ui)">
            {leftLabel}
          </text>
          {answered && leftHeavier && (
            <text x={CX-ARM} y={PIVOT_Y+CHAIN+50} textAnchor="middle" fontSize={20}>🏆</text>
          )}
        </g>

        {/* Right item — clickable */}
        <g style={{ cursor: answered?'default':'pointer' }}
           onClick={!answered ? onPickRight : undefined}>
          {answered && !leftHeavier && (
            <circle cx={CX+ARM} cy={PIVOT_Y+CHAIN-22} r={38} fill="#FFD93D" opacity={0.22}/>
          )}
          <text x={CX+ARM} y={PIVOT_Y+CHAIN-8} textAnchor="middle" fontSize={40}
            dominantBaseline="middle" style={{userSelect:'none',
              filter: answered&&!leftHeavier?'drop-shadow(0 0 8px #FFD93D)':'none'}}>
            {rightEmoji}
          </text>
          <text x={CX+ARM} y={PIVOT_Y+CHAIN+32} textAnchor="middle" fontSize={13}
            fontWeight="700" fill={answered&&!leftHeavier?"#4A00E0":"#6C5CE7"}
            fontFamily="var(--font-heading,system-ui)">
            {rightLabel}
          </text>
          {answered && !leftHeavier && (
            <text x={CX+ARM} y={PIVOT_Y+CHAIN+50} textAnchor="middle" fontSize={20}>🏆</text>
          )}
        </g>
      </motion.g>

      {/* Pivot cap */}
      <circle cx={CX} cy={PIVOT_Y} r={14} fill="#4A00E0" filter="url(#bShadow)"/>
      <circle cx={CX} cy={PIVOT_Y} r={6}  fill="white"/>
      <circle cx={CX} cy={PIVOT_Y} r={2}  fill="#4A00E0"/>
    </svg>
  )
}


function speakDE(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance((text||'').replace(/[^\w\säöüÄÖÜß.,!?]/g,''))
  u.lang = 'de-DE'; u.rate = 0.8; u.pitch = 1.05
  window.speechSynthesis.speak(u)
}

export default function WeightGame({ level = 1, onComplete }) {
  const [questions] = useState(() => buildQuestions(level))
  const [idx,       setIdx]      = useState(0)
  const [answered,  setAnswered] = useState(false)
  const [isCorrect, setIsCorrect]= useState(false)
  const [score,     setScore]    = useState(0)
  const [mood,      setMood]     = useState('happy')

  const q = questions[idx]

  // Speak item labels when question changes
  useEffect(() => {
    if (q && q.leftLabel && q.rightLabel && level <= 2) {
      setTimeout(() => speakDE(q.leftLabel + ' oder ' + q.rightLabel), 300)
    }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  const correctSide   = q.leftW >= q.rightW ? 'left' : 'right'
  const heavierLabel  = q.leftW >= q.rightW ? q.leftLabel : q.rightLabel
  const tiltDeg       = answered ? (q.leftW > q.rightW ? -18 : q.rightW > q.leftW ? 18 : 0) : 0

  const answer = useCallback((side) => {
    if (answered) return
    const ok = side === correctSide
    setAnswered(true)
    setIsCorrect(ok)
    setMood(ok ? 'excited' : 'encouraging')
    if (ok) { sfx.correct(); setScore(s => s + 1) } else sfx.wrong()

    setTimeout(() => {
      setAnswered(false)
      setMood('happy')
      if (idx + 1 >= questions.length) {
        sfx.complete()
        setTimeout(() => onComplete({ score: score + (ok ? 1 : 0), total: questions.length }), 700)
      } else {
        setIdx(i => i + 1)
      }
    }, 1600)
  }, [answered, correctSide, idx, questions.length, score, onComplete])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  answer('left')
      if (e.key === 'ArrowRight') answer('right')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answer])

  const questionText = useMemo(() => {
    if (level <= 1) return 'Was ist schwerer? Tippe auf die richtige Seite!'
    if (level <= 2) return 'Welche Seite wiegt mehr? Tippe drauf!'
    if (level <= 3) return 'Rechne — welche Seite ist schwerer?'
    return 'Löse die Aufgabe! Welche Seite wiegt mehr?'
  }, [level])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,24px) clamp(14px,3vw,28px)',
      gap: 'clamp(10px,1.8vw,16px)',
    }}>

      {/* Flash overlay */}
      <AnimatePresence>
        {answered && (
          <motion.div key={'flash' + idx}
            initial={{ opacity: 0.28 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.55 }}
            style={{ position: 'fixed', inset: 0, zIndex: 150, pointerEvents: 'none',
                     background: isCorrect ? '#6BCB77' : '#FF6B6B' }}
          />
        )}
      </AnimatePresence>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 640 }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < idx ? '#6C63FF' : i === idx ? '#FFD93D' : '#ECE8FF',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Score row */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--text-muted)' }}>
          {'✅ ' + score + ' / ' + questions.length}
        </div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 12, color: 'var(--text-muted)', opacity: 0.6 }}>
          {'← links  ·  → rechts'}
        </div>
      </div>

      {/* Lumi */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 640 }}>
        <LumiCharacter mood={mood} size={68} />
        <AnimatePresence mode="wait">
          <motion.div key={idx + (answered ? 'a' : 'q')}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{
              flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px',
              padding: '12px 18px',
              boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px,3vw,20px)',
              color: 'var(--text-primary)',
            }}
          >
            {answered
              ? isCorrect
                ? <><strong style={{ color: '#6BCB77' }}>{'Super! 🎉'}</strong>{' ' + heavierLabel + ' ist schwerer!'}</>
                : <><strong style={{ color: '#FF6B6B' }}>{'Fast! 💪'}</strong>{' ' + heavierLabel + ' ist schwerer.'}</>
              : questionText
            }
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Beam */}
      {/* Weiter button */}
      {showWeiter && (
        <motion.button
          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ type:'spring', stiffness:300, delay:0.2 }}
          whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
          onClick={weiterClick}
          style={{
            background:'linear-gradient(135deg,#FFD93D,#FF9F43)',
            color:'white', border:'none', borderRadius:20,
            padding:'clamp(12px,2vw,16px) clamp(28px,6vw,52px)',
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(17px,3.5vw,22px)', fontWeight:700,
            cursor:'pointer', boxShadow:'0 5px 20px rgba(255,159,67,0.45)',
          }}
        >Weiter! →</motion.button>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          style={{ display: 'flex', justifyContent: 'center', width: '100%', maxWidth: 480 }}
        >
          <Beam tiltDeg={tiltDeg} />
        </motion.div>
      </AnimatePresence>

      {/* Weight cards */}
      {/* Weiter button */}
      {showWeiter && (
        <motion.button
          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ type:'spring', stiffness:300, delay:0.2 }}
          whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
          onClick={weiterClick}
          style={{
            background:'linear-gradient(135deg,#FFD93D,#FF9F43)',
            color:'white', border:'none', borderRadius:20,
            padding:'clamp(12px,2vw,16px) clamp(28px,6vw,52px)',
            fontFamily:'var(--font-heading)',
            fontSize:'clamp(17px,3.5vw,22px)', fontWeight:700,
            cursor:'pointer', boxShadow:'0 5px 20px rgba(255,159,67,0.45)',
          }}
        >Weiter! →</motion.button>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          style={{
            display: 'flex', gap: 'clamp(10px,3vw,22px)',
            width: '100%', maxWidth: 520,
            justifyContent: 'center', alignItems: 'stretch',
          }}
        >
          <WeightCard
            emoji={q.leftEmoji} label={q.leftLabel}
            heavier={answered && q.leftW >= q.rightW}
            lighter={answered && q.leftW < q.rightW}
            answered={answered}
            onClick={() => answer('left')}
            side="left"
          />
          <div style={{
            alignSelf: 'center', flexShrink: 0,
            fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px,4vw,26px)',
            fontWeight: 900, color: '#A29BFE',
          }}>VS</div>
          <WeightCard
            emoji={q.rightEmoji} label={q.rightLabel}
            heavier={answered && q.rightW > q.leftW}
            lighter={answered && q.rightW <= q.leftW}
            answered={answered}
            onClick={() => answer('right')}
            side="right"
          />
        </motion.div>
      </AnimatePresence>

    </div>
  )
}
