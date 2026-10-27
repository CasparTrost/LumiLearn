import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, lockPreviews, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { pxCard, pxPanel, pxBubble, pxButton, pxSegment, ACCENT, INK } from './px.js'

/**
 * Formen-Land — Formen erkennen, Größen ordnen, Muster fortsetzen,
 * Formen im Alltag finden
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

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// art: the article after "Finde …" (accusative). Oval and Raute sit next to
// Kreis and Quadrat on purpose: telling them apart is the real step of
// naming shapes by their look.
const SHAPES = {
  circle:    { name: 'Kreis',     art: 'den', draw: (c) => <circle cx="50" cy="50" r="42" fill={c} /> },
  square:    { name: 'Quadrat',   art: 'das', draw: (c) => <rect x="10" y="10" width="80" height="80" rx="6" fill={c} /> },
  triangle:  { name: 'Dreieck',   art: 'das', draw: (c) => <polygon points="50,8 94,88 6,88" fill={c} /> },
  rectangle: { name: 'Rechteck',  art: 'das', draw: (c) => <rect x="6" y="26" width="88" height="48" rx="6" fill={c} /> },
  oval:      { name: 'Oval',      art: 'das', draw: (c) => <ellipse cx="50" cy="50" rx="46" ry="30" fill={c} /> },
  rhombus:   { name: 'Raute',     art: 'die', draw: (c) => <polygon points="50,4 84,50 50,96 16,50" fill={c} /> },
  star:      { name: 'Stern',     art: 'den', draw: (c) => <polygon points="50,5 61,38 96,38 68,59 79,92 50,71 21,92 32,59 4,38 39,38" fill={c} /> },
  heart:     { name: 'Herz',      art: 'das', draw: (c) => <path d="M50 88 C10 58 10 22 32 18 C42 16 50 26 50 32 C50 26 58 16 68 18 C90 22 90 58 50 88Z" fill={c} /> },
}
const SHAPE_IDS = Object.keys(SHAPES)
// Shape colours, all dark enough to stand out on parchment
const COLORS = ['#E8503F', '#F2B705', '#3FA34D', '#3D8BE0', '#8E6CF0', '#E0509A']

// "ein Kreis", "eine Raute"
const indef = (type) => (SHAPES[type].art === 'die' ? 'eine' : 'ein')
// "von einem Kreis", "von einer Raute"
const dat   = (type) => (SHAPES[type].art === 'die' ? 'einer' : 'einem')

// Shapes around us: things whose picture shows the shape plainly, checked
// against the sprites in public/sprites/emoji — the open book, the cake
// slice, the dice and the gift stay out, their outline is not one shape.
// Names with their article in the nominative.
const OBJECTS = {
  circle:    [['🕐', 'die Uhr'], ['🍪', 'der Keks'], ['🌕', 'der Vollmond'], ['🪙', 'die Münze'], ['🎯', 'die Zielscheibe']],
  square:    [['🪟', 'das Fenster'], ['🧇', 'die Waffel']],
  triangle:  [['🍕', 'das Pizzastück'], ['⚠️', 'das Warnschild'], ['🚩', 'die Fahne'], ['⛺', 'das Zelt']],
  rectangle: [['🚪', 'die Tür'], ['📱', 'das Handy'], ['🖼️', 'das Bild'], ['💌', 'der Brief'], ['📓', 'das Heft']],
  oval:      [['🥚', 'das Ei'], ['🪞', 'der Spiegel'], ['🥔', 'die Kartoffel']],
  rhombus:   [['🪁', 'der Drachen']],
}
// "um den Drachen herum"
const akk = (name) => name.replace(/^der /, 'den ')
const cap = (s) => s[0].toUpperCase() + s.slice(1)

function Shape({ type, color, size = 72, rotate = 0 }) {
  const s = SHAPES[type]
  if (!s) return null
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ display: 'block', overflow: 'visible' }}>
      <g transform={rotate ? `rotate(${rotate} 50 50)` : undefined}>{s.draw(color)}</g>
    </svg>
  )
}

// L1-2 recognise · L3 + a first AB pattern · L4 + order by size ·
// L5-6 + shapes around us · L7-10 all four
function modeFor(level, idx) {
  if (level <= 2) return 'match'
  if (level === 3) return idx % 3 === 2 ? 'pattern' : 'match'
  if (level === 4) return idx % 2 === 0 ? 'match' : 'size'
  if (level <= 6) return ['match', 'object', 'size'][idx % 3]
  return ['match', 'object', 'pattern', 'size'][idx % 4]
}

function poolFor(level) {
  return level <= 2 ? SHAPE_IDS.slice(0, 3)     // Kreis, Quadrat, Dreieck
       : level === 3 ? SHAPE_IDS.slice(0, 4)    // + Rechteck
       : level <= 5 ? SHAPE_IDS.slice(0, 6)     // + Oval, Raute
       : SHAPE_IDS
}

// From level 2 the shapes stand at a slant now and then: a tilted triangle
// is still a triangle. Square and Raute are only turned a little, so the
// one never turns into the other.
function tiltFor(level, type) {
  if (level < 2 || Math.random() < 0.4) return 0
  if (type === 'square' || type === 'rhombus') return [-15, 15][rand(0, 1)]
  if (type === 'circle') return 0
  return [-30, -15, 15, 30, 180][rand(0, 4)]
}

// used: the shapes already asked for in this level's "shapes around us"
function buildRound(level, idx, used) {
  const mode = modeFor(level, idx)
  const pool = poolFor(level)

  if (mode === 'object') {
    // a shape not asked yet first, so the circle doesn't win by having more things
    const types  = pool.filter(t => OBJECTS[t])
    const fresh  = types.filter(t => !used.has(t))
    const type   = shuffle(fresh.length ? fresh : types)[0]
    const [emoji, name] = shuffle(OBJECTS[type])[0]
    const thing  = { type, emoji, name }
    used.add(type)
    // A square is a rectangle too, so the window never meets the rectangle
    const others = pool.filter(t => t !== thing.type && t !== 'star' && t !== 'heart'
      && !(thing.type === 'square' && t === 'rectangle'))
    return {
      mode, thing, answer: thing.type,
      options: shuffle([thing.type, ...shuffle(others).slice(0, 2)]),
      color: COLORS[rand(0, COLORS.length - 1)],
    }
  }

  if (mode === 'match') {
    const [answer, ...rest] = shuffle(pool)
    const optCount = level <= 2 ? 3 : 4
    const options = shuffle([answer, ...rest.slice(0, optCount - 1)])
    return {
      mode, answer, options,
      color: COLORS[rand(0, COLORS.length - 1)],
      tilt: Object.fromEntries(options.map(t => [t, tiltFor(level, t)])),
    }
  }

  if (mode === 'size') {
    const count = level <= 5 ? 3 : level <= 8 ? 4 : 5
    const type  = pool[rand(0, pool.length - 1)]
    const color = COLORS[rand(0, COLORS.length - 1)]
    // From level 6 the order is sometimes the other way round
    const down  = level >= 6 && Math.random() < 0.5
    // Sizes far enough apart that the order is decidable at a glance;
    // scale is the share of the card's full size
    const sizes = Array.from({ length: count }, (_, i) => 0.4 + i * (0.6 / (count - 1)))
    return { mode, type, color, down, items: shuffle(sizes.map((s, i) => ({ id: i, size: s }))), sizes }
  }

  // pattern: AB, ABC or AAB, continued by one element. The row's length
  // varies: with a fixed six the next element was always the row's first.
  const kinds = level <= 3 ? [['A','B']] : level <= 8 ? [['A','B'], ['A','B','C']] : [['A','B'], ['A','B','C'], ['A','A','B']]
  const unit  = kinds[rand(0, kinds.length - 1)]
  const picks = shuffle(pool).slice(0, 3)
  const cols  = shuffle(COLORS).slice(0, 3)
  const map   = { A: 0, B: 1, C: 2 }
  const len   = unit.length * 2 + rand(0, unit.length - 1)
  const seq   = []
  for (let i = 0; i < len; i++) {
    const k = unit[i % unit.length]
    seq.push({ type: picks[map[k]], color: cols[map[k]] })
  }
  const nextKey = unit[len % unit.length]
  const correct = { type: picks[map[nextKey]], color: cols[map[nextKey]] }
  const wrongs  = picks
    .map((p, i) => ({ type: p, color: cols[i] }))
    .filter(o => o.type !== correct.type)
  return {
    mode, seq, correct,
    options: shuffle([correct, ...wrongs].slice(0, 3)),
  }
}

// Phones held upright: three answers go below each other, so they can be
// big — side by side they had to shrink to a third of the width.
function useNarrow() {
  const get = () => typeof window !== 'undefined' && window.innerWidth < 520
  const [narrow, setNarrow] = useState(get)
  useEffect(() => {
    const on = () => setNarrow(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return narrow
}

const taskFor = (r) =>
  r.mode === 'match' ? `Finde ${SHAPES[r.answer].art} ${SHAPES[r.answer].name}!`
  : r.mode === 'object' ? `Welche Form hat ${r.thing.name}?`
  : r.mode === 'size' ? (r.down ? 'Tippe die Formen von groß nach klein!' : 'Tippe die Formen von klein nach groß!')
  : 'Was kommt als Nächstes?'

export default function ShapeLandGame({ level = 1, onComplete }) {
  const TOTAL = 8
  const rounds = useState(() => {
    const used = new Set()
    return Array.from({ length: TOTAL }, (_, i) => buildRound(level, i, used))
  })[0]

  const [idx,      setIdx]      = useState(0)
  const [picked,   setPicked]   = useState([])       // size mode: tap order
  const [wrong,    setWrong]    = useState([])
  const [shakeKey, setShakeKey] = useState(0)
  const [missed,   setMissed]   = useState([])       // rounds with a miss
  const [solved,   setSolved]   = useState(false)
  const [mood,     setMood]     = useState('happy')

  const r = rounds[idx]
  const narrow = useNarrow()

  useEffect(() => {
    if (!r) return
    setPicked([]); setWrong([]); setSolved(false); setMood('happy')
    lockPreviews()
    const id = setTimeout(() => sayTask(taskFor(r)), 420)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const finish = useCallback((praise) => {
    setSolved(true)
    setMood('excited')
    sfx.correct()
    sayRight(praise)
  }, [])

  const miss = useCallback((key, hint) => {
    setWrong(w => w.includes(key) ? w : [...w, key])
    setShakeKey(k => k + 1)
    setMissed(m => (m.includes(idx) ? m : [...m, idx]))
    setMood('encouraging')
    sfx.wrong()
    sayWrong(hint)
    setTimeout(() => setMood('happy'), 900)
  }, [idx])

  const pickShape = useCallback((type) => {
    if (solved || !r) return
    const want = SHAPES[r.answer]
    if (type !== r.answer) {
      miss(type, `Das ist ${indef(type)} ${SHAPES[type].name}. Wir suchen ${want.art} ${want.name}.`)
      return
    }
    finish(`Das ist ${indef(type)} ${want.name}.`)
  }, [solved, r, miss, finish])

  const pickObjectShape = useCallback((type) => {
    if (solved || !r) return
    const { name } = r.thing
    if (type !== r.answer) {
      miss(type, `Das ist ${indef(type)} ${SHAPES[type].name}. Fahr mit dem Finger einmal um ${akk(name)} herum.`)
      return
    }
    finish(`${cap(name)} hat die Form von ${dat(type)} ${SHAPES[type].name}.`)
  }, [solved, r, miss, finish])

  const pickSize = useCallback((item) => {
    if (solved || !r || picked.includes(item.id)) return
    const order = [...r.sizes].sort((a, b) => (r.down ? b - a : a - b))
    const expected = order[picked.length]
    if (item.size !== expected) {
      // The hint used to be "Fang mit der kleinsten an!" for every miss,
      // even when the smallest was already taken and the child was at step 3.
      const hint = picked.length === 0
        ? (r.down ? 'Fang mit der größten an!' : 'Fang mit der kleinsten an!')
        : (r.down ? 'Welche ist die nächstkleinere?' : 'Welche ist die nächstgrößere?')
      miss(`s${item.id}`, hint)
      return
    }
    const next = [...picked, item.id]
    setPicked(next)
    sfx.pop?.()
    if (next.length === r.items.length) finish(r.down ? 'Von groß nach klein.' : 'Von klein nach groß.')
  }, [solved, r, picked, miss, finish])

  const pickPattern = useCallback((opt, i) => {
    if (solved || !r) return
    if (opt.type !== r.correct.type) {
      miss(`p${i}`, `Hör mal! ${r.seq.map(s => SHAPES[s.type].name).join(', ')}, und dann?`)
      return
    }
    finish('So geht das Muster weiter.')
  }, [solved, r, miss, finish])

  const weiterClick = () => {
    if (idx + 1 >= TOTAL) {
      sfx.complete()
      afterNarration(() => onComplete(result(TOTAL - missed.length, TOTAL)), { minMs: 300 })
    } else setIdx(i => i + 1)
  }

  if (!r) return null

  const prompt = r.mode === 'match'
    ? <>Finde {SHAPES[r.answer].art} <strong style={{ color: ACCENT }}>{SHAPES[r.answer].name}</strong>! 🔍</>
    : r.mode === 'object'
      ? <>Welche <strong style={{ color: ACCENT }}>Form</strong> hat {r.thing.name}? 🔍</>
    : r.mode === 'size'
      ? <>Tippe die Formen von <strong style={{ color: ACCENT }}>{r.down ? 'groß nach klein' : 'klein nach groß'}</strong>! 📏</>
      : <>Was kommt als <strong style={{ color: ACCENT }}>Nächstes</strong>? 🔮</>

  const hearItems = [taskFor(r), ...(
    r.mode === 'match' || r.mode === 'object' ? r.options.map(t => SHAPES[t].name)
    : r.mode === 'pattern' ? r.options.map(o => SHAPES[o.type].name)
    : [])]

  // The shapes grow with the screen: they were 100 px cards under the
  // question with 60 % of the screen empty below.
  const sumScale = r.mode === 'size' ? r.sizes.reduce((a, b) => a + b, 0) : 0
  // Every size leaves room for the cards' padding and the gaps between them
  const threeUp  = (cap, vh) => (narrow ? `min(${vh - 4}dvh, 40vw, ${cap}px)` : `min(${vh}dvh, calc((min(100vw, 720px) - 130px - 11vw) / 3), ${cap}px)`)
  const cardSize = r.mode === 'match'
    ? (r.options.length === 4 ? 'min(19dvh, calc((min(100vw, 720px) - 100px - 8vw) / 2), 190px)' : threeUp(200, 22))
    : r.mode === 'size'
      // the whole row has to fit across: buttons, gaps and shelf (on a phone
      // it may wrap — the order is about size, not place)
      ? (narrow ? 'min(20dvh, 34vw, 220px)' : `min(26dvh, calc((min(100vw, 720px) - ${76 + 14 * r.items.length}px) / ${sumScale.toFixed(2)}), 220px)`)
      : (narrow ? 'min(12dvh, 26vw, 150px)' : threeUp(150, 17))
  // the thing in "shapes around us", above its three answers
  const thingSize = narrow ? 'min(22dvh, 46vw, 200px)' : 'min(26dvh, 220px)'
  const rowSize = r.mode === 'pattern' ? `min(64px, calc((min(100vw, 720px) - ${60 + 4 * r.seq.length}px) / ${r.seq.length + 1}))` : null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(12px,2vw,20px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680, flexShrink: 0 }}>
        {rounds.map((_, i) => {
          const done = i < idx || (i === idx && solved)
          return (
            <div key={i} style={{
              flex: 1, ...pxSegment(done ? 'done' : i === idx ? 'current' : 'todo'),
              // solved, but not on the first try
              ...(done && missed.includes(i) ? { background: '#F3A091' } : {}),
            }} />
          )
        })}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680, flexShrink: 0 }}>
        <LumiCharacter mood={mood} size={68} />
        <div style={{
          flex: 1, ...pxBubble, padding: '12px 18px',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(17px,3.4vw,24px)', color: 'var(--text-primary)',
        }}>
          {solved ? <>⭐ Richtig!</> : prompt}
        </div>
        <HearOptions items={hearItems} size={52} label="Aufgabe und Antworten vorlesen" style={{ alignSelf: 'center' }} />
      </div>

      <div style={{
        flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 'clamp(14px,3dvh,28px)',
      }}>
        {/* MATCH — four shapes as 2×2, three in one row */}
        {r.mode === 'match' && (
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${r.options.length === 4 ? 2 : narrow ? 1 : 3}, auto)`,
            gap: 'clamp(12px,3vw,26px)', justifyContent: 'center',
          }}>
            {r.options.map(type => {
              const isWrong = wrong.includes(type)
              const isRight = solved && type === r.answer
              return (
                <motion.button key={type}
                  whileHover={!solved && !isWrong ? { scale: 1.05 } : {}}
                  whileTap={!solved && !isWrong ? { scale: 0.94 } : {}}
                  onClick={() => { if (!isWrong) pickShape(type) }}
                  {...hearable(SHAPES[type].name)}
                  aria-label={SHAPES[type].name}
                  style={{
                    ...pxCard(isRight ? 'right' : isWrong ? 'wrong' : undefined),
                    padding: 'clamp(12px,2.2vw,20px)', cursor: solved ? 'default' : 'pointer',
                    opacity: isWrong ? 0.5 : 1,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <div style={{ width: cardSize, height: cardSize }}>
                    <Shape type={type} color={r.color} size="100%" rotate={r.tilt[type]} />
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}

        {/* SHAPES AROUND US — the thing, then three shapes. Tap the thing to
            hear its name again. */}
        {r.mode === 'object' && (
          <>
            <motion.button
              key={r.thing.emoji}
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              onClick={() => narrate([{ text: `${cap(r.thing.name)}.` }], { skipIfSame: true })}
              aria-label={r.thing.name}
              style={{
                ...pxPanel, width: thingSize, height: thingSize, padding: 0, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: `calc(${thingSize} * 0.7)`, lineHeight: 1,
              }}
            >{r.thing.emoji}</motion.button>
            <div style={{ display: 'flex', gap: 'clamp(12px,3vw,24px)', flexWrap: 'nowrap', justifyContent: 'center' }}>
              {r.options.map(type => {
                const isWrong = wrong.includes(type)
                const isRight = solved && type === r.answer
                return (
                  <motion.button key={type}
                    whileHover={!solved && !isWrong ? { scale: 1.05 } : {}}
                    whileTap={!solved && !isWrong ? { scale: 0.94 } : {}}
                    onClick={() => { if (!isWrong) pickObjectShape(type) }}
                    {...hearable(SHAPES[type].name)}
                    aria-label={SHAPES[type].name}
                    style={{
                      ...pxCard(isRight ? 'right' : isWrong ? 'wrong' : undefined),
                      padding: 'clamp(10px,2vw,18px)', cursor: solved ? 'default' : 'pointer',
                      opacity: isWrong ? 0.5 : 1,
                    }}
                  >
                    <div style={{ width: cardSize, height: cardSize }}>
                      <Shape type={type} color={r.color} size="100%" />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </>
        )}

        {/* SIZE ORDER */}
        {r.mode === 'size' && (
          <div style={{
            display: 'flex', gap: 'clamp(6px,1.5vw,16px)', justifyContent: 'center', alignItems: 'flex-end',
            flexWrap: narrow ? 'wrap' : 'nowrap', rowGap: 14,
            ...pxPanel, padding: 10,
          }}>
            {r.items.map(item => {
              const order = picked.indexOf(item.id)
              const taken = order !== -1
              const isWrong = wrong.includes(`s${item.id}`)
              return (
                <motion.button key={`${item.id}-${isWrong ? shakeKey : 0}`}
                  whileHover={!taken && !solved ? { scale: 1.06 } : {}}
                  whileTap={!taken && !solved ? { scale: 0.94 } : {}}
                  onClick={() => pickSize(item)}
                  aria-label={`Form ${r.sizes.slice().sort((a, b) => a - b).indexOf(item.size) + 1} von ${r.sizes.length}`}
                  animate={isWrong ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
                  style={{
                    position: 'relative', background: 'transparent', border: 'none',
                    padding: 4, minWidth: 48, minHeight: 48,
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    cursor: taken || solved ? 'default' : 'pointer',
                    opacity: taken ? 0.45 : 1,
                  }}
                >
                  <div style={{ width: `calc(${cardSize} * ${item.size.toFixed(3)})`, height: `calc(${cardSize} * ${item.size.toFixed(3)})` }}>
                    <Shape type={r.type} color={r.color} size="100%" />
                  </div>
                  {taken && (
                    <span style={{
                      position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                      background: ACCENT, color: 'white', borderRadius: '50%',
                      border: `2px solid ${INK}`, boxSizing: 'border-box',
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 800,
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
              display: 'flex', gap: 4, alignItems: 'center',
              flexWrap: 'nowrap', justifyContent: 'center',
              ...pxPanel, padding: 10,
            }}>
              {r.seq.map((s, i) => (
                <div key={i} style={{ width: rowSize, height: rowSize }}>
                  <Shape type={s.type} color={s.color} size="100%" />
                </div>
              ))}
              <div style={{
                width: rowSize, height: rowSize, borderRadius: 10, border: `3px dashed ${INK}`, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 3,
                fontFamily: 'var(--font-heading)', fontSize: 24, color: INK,
              }}>{solved ? <Shape type={r.correct.type} color={r.correct.color} size="100%" /> : '?'}</div>
            </div>
            <div style={{ display: 'flex', gap: 'clamp(12px,3vw,24px)', flexWrap: 'nowrap', justifyContent: 'center' }}>
              {r.options.map((opt, i) => {
                const isWrong = wrong.includes(`p${i}`)
                const isRight = solved && opt.type === r.correct.type
                return (
                  <motion.button key={i}
                    whileHover={!solved && !isWrong ? { scale: 1.05 } : {}}
                    whileTap={!solved && !isWrong ? { scale: 0.94 } : {}}
                    onClick={() => { if (!isWrong) pickPattern(opt, i) }}
                    {...hearable(SHAPES[opt.type].name)}
                    aria-label={SHAPES[opt.type].name}
                    style={{
                      ...pxCard(isRight ? 'right' : isWrong ? 'wrong' : undefined),
                      padding: 'clamp(10px,2vw,18px)', cursor: solved ? 'default' : 'pointer',
                      opacity: isWrong ? 0.5 : 1,
                    }}
                  >
                    <div style={{ width: cardSize, height: cardSize }}>
                      <Shape type={opt.type} color={opt.color} size="100%" />
                    </div>
                  </motion.button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Fixed slot for "Weiter", so nothing jumps when it appears */}
      <div style={{ height: 62, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence>
          {solved && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={weiterClick}
              {...hearable('Weiter')}
              style={{
                ...pxButton('green'),
                // ink on green: white text reached only 2.2:1
                color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
                padding: '12px 40px', minHeight: 52,
                fontSize: 'clamp(17px,3.4vw,21px)',
              }}
            >Weiter! ➡️</motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
