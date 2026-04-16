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

// ── Animated balance beam ─────────────────────────────────────────────────────
function Beam({ tiltDeg }) {
  const CX = 160, CY = 22, ARM = 130

  return (
    <svg width={320} height={52} viewBox="0 0 320 52" style={{ overflow: 'visible', display: 'block' }}>
      {/* Stand pole */}
      <rect x={CX - 6} y={CY} width={12} height={34} rx={6} fill="#9B8FCC" />
      <rect x={CX - 22} y={CY + 32} width={44} height={10} rx={5} fill="#7C6FAF" />

      {/* Rotating beam */}
      <motion.g
        animate={{ rotate: tiltDeg }}
        transition={{ type: 'spring', stiffness: 70, damping: 14 }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      >
        <rect x={CX - ARM - 6} y={CY - 6} width={ARM * 2 + 12} height={12} rx={6} fill="#A29BFE" />
        <circle cx={CX - ARM} cy={CY} r={8} fill="#6C63FF" />
        <circle cx={CX + ARM} cy={CY} r={8} fill="#6C63FF" />
      </motion.g>

      {/* Pivot cap */}
      <circle cx={CX} cy={CY} r={10} fill="#4A00E0" />
      <circle cx={CX} cy={CY} r={5} fill="white" />
    </svg>
  )
}

// ── Clickable weight card ─────────────────────────────────────────────────────
function WeightCard({ emoji, label, heavier, lighter, answered, onClick, side }) {
  return (
    <motion.button
      onClick={!answered ? onClick : undefined}
      whileHover={!answered ? { scale: 1.04 } : {}}
      whileTap={!answered ? { scale: 0.96 } : {}}
      style={{
        flex: 1,
        minWidth: 130,
        maxWidth: 210,
        padding: 'clamp(16px,3vw,26px) clamp(10px,2vw,18px)',
        borderRadius: 28,
        background: answered && heavier
          ? 'linear-gradient(160deg,#FFFDE7,#FFF6A0)'
          : answered && lighter
          ? 'linear-gradient(160deg,#F5F5F5,#EEEEEE)'
          : 'white',
        border: `3px solid ${
          answered && heavier ? '#FFD93D'
          : answered && lighter ? '#DDD'
          : '#ECE8FF'
        }`,
        boxShadow: answered && heavier
          ? '0 0 0 4px #FFD93D55, 0 8px 36px rgba(255,217,61,0.45)'
          : answered && lighter
          ? '0 4px 16px rgba(0,0,0,0.07)'
          : '0 6px 28px rgba(108,99,255,0.16)',
        cursor: answered ? 'default' : 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
        transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
        outline: 'none',
        position: 'relative',
      }}
    >
      {/* Keyboard hint pill */}
      {!answered && (
        <div style={{
          position: 'absolute', top: 8,
          [side === 'left' ? 'left' : 'right']: 10,
          background: '#ECE8FF', borderRadius: 99,
          padding: '2px 8px',
          fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
          color: '#6C63FF',
        }}>
          {side === 'left' ? '←' : '→'}
        </div>
      )}

      {/* Emoji */}
      <div style={{ fontSize: 'clamp(50px,11vw,76px)', lineHeight: 1 }}>{emoji}</div>

      {/* Label */}
      <div style={{
        fontFamily: 'var(--font-heading)',
        fontSize: 'clamp(16px,3.5vw,22px)',
        fontWeight: 800,
        color: answered && lighter ? '#AAA' : '#222',
        textAlign: 'center', lineHeight: 1.2,
      }}>
        {label}
      </div>

      {/* Result badge */}
      <div style={{ height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {answered && heavier && (
          <motion.div
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 380, damping: 16 }}
            style={{
              background: 'linear-gradient(135deg,#FFD93D,#F7A428)',
              borderRadius: 99, padding: '4px 12px',
              fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 800,
              color: 'white', boxShadow: '0 3px 12px rgba(255,164,40,0.45)',
            }}
          >
            {'⬇️ Schwerer!'}
          </motion.div>
        )}
      </div>
    </motion.button>
  )
}

// ── Main Game ─────────────────────────────────────────────────────────────────
export default function WeightGame({ level = 1, onComplete }) {
  const [questions] = useState(() => buildQuestions(level))
  const [idx,       setIdx]      = useState(0)
  const [answered,  setAnswered] = useState(false)
  const [isCorrect, setIsCorrect]= useState(false)
  const [score,     setScore]    = useState(0)
  const [mood,      setMood]     = useState('happy')

  const q = questions[idx]
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
