import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'

/**
 * Formen-Land — Formen erkennen, Größen ordnen, Muster fortsetzen
 *
 * Geometry and seriation had no home in the app at all: the closest thing,
 * "Farbenreich", paints prepared regions and never names a shape. Both are
 * core strands of early maths (NCTM: Geometry, Measurement, Algebraic
 * Thinking) and both feed later arithmetic.
 *
 * Scientific basis:
 *   • Van Hiele level 0 (visual recognition) — naming whole shapes by their
 *     look precedes any talk of sides or corners, so the game asks for
 *     matching and naming, never for properties.
 *   • Seriation (Piaget) — ordering by size is a concrete-operational
 *     milestone and a known predictor of number-line understanding.
 *   • Repeating patterns (Clements & Sarama) — extending an AB/ABC pattern
 *     is early algebraic thinking.
 */

function speakDE(text) { speak(text, { rate: 0.85, pitch: 1.05, lang: 'de-DE' }) }
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

const SHAPES = {
  circle:    { name: 'Kreis',     art: 'den', draw: (c) => <circle cx="50" cy="50" r="42" fill={c} /> },
  square:    { name: 'Quadrat',   art: 'das', draw: (c) => <rect x="10" y="10" width="80" height="80" rx="6" fill={c} /> },
  triangle:  { name: 'Dreieck',   art: 'das', draw: (c) => <polygon points="50,8 94,88 6,88" fill={c} /> },
  rectangle: { name: 'Rechteck',  art: 'das', draw: (c) => <rect x="6" y="26" width="88" height="48" rx="6" fill={c} /> },
  star:      { name: 'Stern',     art: 'den', draw: (c) => <polygon points="50,5 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38" fill={c} /> },
  heart:     { name: 'Herz',      art: 'das', draw: (c) => <path d="M50 88 C10 58 10 22 32 18 C42 16 50 26 50 32 C50 26 58 16 68 18 C90 22 90 58 50 88Z" fill={c} /> },
}
const SHAPE_IDS = Object.keys(SHAPES)
const COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#74B9FF', '#A29BFE', '#FD79A8']

function Shape({ type, color, size = 72 }) {
  const s = SHAPES[type]
  if (!s) return null
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
      {s.draw(color)}
    </svg>
  )
}

// L1-3 recognise · L4-6 order by size · L7-10 continue the pattern
function modeFor(level, idx) {
  if (level <= 3) return 'match'
  if (level <= 6) return idx % 2 === 0 ? 'match' : 'size'
  return idx % 3 === 2 ? 'size' : idx % 3 === 1 ? 'pattern' : 'match'
}

function buildRound(level, idx) {
  const mode = modeFor(level, idx)
  const pool = level <= 2 ? SHAPE_IDS.slice(0, 3) : level <= 5 ? SHAPE_IDS.slice(0, 5) : SHAPE_IDS

  if (mode === 'match') {
    const [answer, ...rest] = shuffle(pool)
    const optCount = level <= 2 ? 3 : 4
    return {
      mode, answer,
      color: COLORS[rand(0, COLORS.length - 1)],
      options: shuffle([answer, ...rest.slice(0, optCount - 1)]),
    }
  }

  if (mode === 'size') {
    const count = level <= 5 ? 3 : level <= 8 ? 4 : 5
    const type  = pool[rand(0, pool.length - 1)]
    const color = COLORS[rand(0, COLORS.length - 1)]
    // Sizes far enough apart that the order is decidable at a glance
    const sizes = Array.from({ length: count }, (_, i) => 34 + i * 18)
    return { mode, type, color, items: shuffle(sizes.map((s, i) => ({ id: i, size: s }))), sizes }
  }

  // pattern: AB, ABC or AAB, continued by one element
  const kinds = level <= 8 ? [['A','B'], ['A','B','C']] : [['A','B'], ['A','B','C'], ['A','A','B']]
  const unit  = kinds[rand(0, kinds.length - 1)]
  const picks = shuffle(pool).slice(0, 3)
  const cols  = shuffle(COLORS).slice(0, 3)
  const map   = { A: 0, B: 1, C: 2 }
  const seq   = []
  for (let i = 0; i < 6; i++) {
    const k = unit[i % unit.length]
    seq.push({ type: picks[map[k]], color: cols[map[k]] })
  }
  const answer = seq[6 % unit.length === 0 ? 0 : 6 % unit.length]
  const nextKey = unit[6 % unit.length]
  const correct = { type: picks[map[nextKey]], color: cols[map[nextKey]] }
  const wrongs  = picks
    .map((p, i) => ({ type: p, color: cols[i] }))
    .filter(o => o.type !== correct.type)
  return {
    mode, seq, correct,
    options: shuffle([correct, ...wrongs].slice(0, 3)),
  }
}

export default function ShapeLandGame({ level = 1, onComplete }) {
  const TOTAL = 8
  const rounds = useState(() => Array.from({ length: TOTAL }, (_, i) => buildRound(level, i)))[0]

  const [idx,    setIdx]    = useState(0)
  const [picked, setPicked] = useState([])       // size mode: tap order
  const [wrong,  setWrong]  = useState([])
  const [misses, setMisses] = useState(0)
  const [solved, setSolved] = useState(false)
  const [mood,   setMood]   = useState('happy')
  const [showWeiter, setShowWeiter] = useState(false)

  const r = rounds[idx]

  useEffect(() => {
    if (!r) return
    setPicked([]); setWrong([]); setSolved(false); setMood('happy')
    const say = r.mode === 'match'  ? `Finde ${SHAPES[r.answer].art} ${SHAPES[r.answer].name}!`
              : r.mode === 'size'   ? 'Tippe die Formen von klein nach groß!'
              :                       'Was kommt als Nächstes?'
    const id = setTimeout(() => speakDE(say), 420)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback(() => {
    setSolved(true)
    setMood('excited')
    sfx.correct()
    setTimeout(() => setShowWeiter(true), 500)
  }, [])

  const miss = useCallback((key, msg) => {
    setWrong(w => w.includes(key) ? w : [...w, key])
    setMisses(m => m + 1)
    setMood('encouraging')
    sfx.wrong()
    speakDE(msg)
    setTimeout(() => setMood('happy'), 900)
  }, [])

  const pickShape = useCallback((type) => {
    if (solved || !r) return
    if (type !== r.answer) { miss(type, `Das ist ${SHAPES[type].art === 'den' ? 'ein' : 'ein'} ${SHAPES[type].name}.`); return }
    speakDE(`${SHAPES[type].name}! Richtig.`)
    finish()
  }, [solved, r, miss, finish])

  const pickSize = useCallback((item) => {
    if (solved || !r) return
    const expected = [...r.sizes].sort((a, b) => a - b)[picked.length]
    if (item.size !== expected) { miss(`s${item.id}`, 'Fang mit der kleinsten an!'); return }
    const next = [...picked, item.id]
    setPicked(next)
    sfx.pop?.()
    if (next.length === r.items.length) { speakDE('Von klein nach groß. Super!'); finish() }
  }, [solved, r, picked, miss, finish])

  const pickPattern = useCallback((opt, i) => {
    if (solved || !r) return
    if (opt.type !== r.correct.type) { miss(`p${i}`, 'Schau dir das Muster nochmal an.'); return }
    speakDE('Genau, so geht das Muster weiter!')
    finish()
  }, [solved, r, miss, finish])

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= TOTAL) {
      sfx.complete()
      const stars = misses <= 1 ? 3 : misses <= TOTAL ? 2 : 1
      setTimeout(() => onComplete({ score: TOTAL, total: TOTAL, stars }), 300)
    } else setIdx(i => i + 1)
  }

  if (!r) return null

  const prompt = r.mode === 'match'
    ? <>Finde {SHAPES[r.answer].art} <strong style={{ color: '#4A00E0' }}>{SHAPES[r.answer].name}</strong>! 🔍</>
    : r.mode === 'size'
      ? <>Tippe die Formen von <strong style={{ color: '#4A00E0' }}>klein nach groß</strong>! 📏</>
      : <>Was kommt als <strong style={{ color: '#4A00E0' }}>Nächstes</strong>? 🔮</>

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(12px,2vw,20px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {rounds.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < idx ? '#6C63FF' : i === idx ? '#FFD93D' : '#ECE8FF',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={68} />
        <div style={{
          flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px', padding: '12px 18px',
          boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.4vw,22px)', color: 'var(--text-primary)',
        }}>
          {solved ? <>⭐ Richtig!</> : prompt}
        </div>
      </div>

      {/* MATCH */}
      {r.mode === 'match' && (
        <div style={{ display: 'flex', gap: 'clamp(10px,3vw,22px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {r.options.map(type => {
            const isWrong = wrong.includes(type)
            const isRight = solved && type === r.answer
            return (
              <motion.button key={type}
                whileHover={!solved && !isWrong ? { scale: 1.07 } : {}}
                whileTap={!solved && !isWrong ? { scale: 0.94 } : {}}
                onClick={() => { if (!isWrong) pickShape(type) }}
                aria-label={SHAPES[type].name}
                style={{
                  background: isRight ? '#E8F8EE' : isWrong ? '#FFE8E8' : 'white',
                  border: `3px solid ${isRight ? '#6BCB77' : isWrong ? '#FF6B6B' : '#ECE8FF'}`,
                  borderRadius: 22, padding: 'clamp(12px,2.5vw,20px)', cursor: solved ? 'default' : 'pointer',
                  opacity: isWrong ? 0.55 : 1,
                  boxShadow: isRight ? '0 6px 24px rgba(107,203,119,0.4)' : '0 4px 16px rgba(0,0,0,0.06)',
                }}
              >
                <Shape type={type} color={r.color} size={72} />
              </motion.button>
            )
          })}
        </div>
      )}

      {/* SIZE ORDER */}
      {r.mode === 'size' && (
        <div style={{ display: 'flex', gap: 'clamp(8px,2.5vw,18px)', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end' }}>
          {r.items.map(item => {
            const order = picked.indexOf(item.id)
            const taken = order !== -1
            const isWrong = wrong.includes(`s${item.id}`)
            return (
              <motion.button key={item.id}
                whileHover={!taken && !solved ? { scale: 1.07 } : {}}
                whileTap={!taken && !solved ? { scale: 0.94 } : {}}
                onClick={() => pickSize(item)}
                aria-label={`Form Größe ${item.size}`}
                animate={isWrong ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                style={{
                  position: 'relative', background: 'transparent', border: 'none',
                  padding: 6, cursor: taken || solved ? 'default' : 'pointer',
                  opacity: taken ? 0.45 : 1,
                }}
              >
                <Shape type={r.type} color={r.color} size={item.size} />
                {taken && (
                  <span style={{
                    position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                    background: '#4A00E0', color: 'white', borderRadius: '50%',
                    width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 800,
                  }}>{order + 1}</span>
                )}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* PATTERN */}
      {r.mode === 'pattern' && (
        <>
          <div style={{
            display: 'flex', gap: 'clamp(4px,1.5vw,10px)', alignItems: 'center',
            flexWrap: 'wrap', justifyContent: 'center',
            background: 'white', borderRadius: 20, padding: 'clamp(10px,2vw,16px)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.07)',
          }}>
            {r.seq.map((s, i) => <Shape key={i} type={s.type} color={s.color} size={42} />)}
            <div style={{
              width: 46, height: 46, borderRadius: 12, border: '3px dashed #A29BFE',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-heading)', fontSize: 24, color: '#A29BFE',
            }}>{solved ? <Shape type={r.correct.type} color={r.correct.color} size={38} /> : '?'}</div>
          </div>
          <div style={{ display: 'flex', gap: 'clamp(10px,3vw,20px)', flexWrap: 'wrap', justifyContent: 'center' }}>
            {r.options.map((opt, i) => {
              const isWrong = wrong.includes(`p${i}`)
              const isRight = solved && opt.type === r.correct.type
              return (
                <motion.button key={i}
                  whileHover={!solved && !isWrong ? { scale: 1.07 } : {}}
                  whileTap={!solved && !isWrong ? { scale: 0.94 } : {}}
                  onClick={() => { if (!isWrong) pickPattern(opt, i) }}
                  aria-label={SHAPES[opt.type].name}
                  style={{
                    background: isRight ? '#E8F8EE' : isWrong ? '#FFE8E8' : 'white',
                    border: `3px solid ${isRight ? '#6BCB77' : isWrong ? '#FF6B6B' : '#ECE8FF'}`,
                    borderRadius: 20, padding: 'clamp(10px,2vw,16px)', cursor: solved ? 'default' : 'pointer',
                    opacity: isWrong ? 0.55 : 1,
                  }}
                >
                  <Shape type={opt.type} color={opt.color} size={56} />
                </motion.button>
              )
            })}
          </div>
        </>
      )}

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
