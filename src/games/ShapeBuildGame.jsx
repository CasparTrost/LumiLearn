import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'

/**
 * Formen-Werkstatt — aus Formen ein Bild zusammensetzen
 *
 * Formen-Land asks which shape something *is*; this asks which shapes
 * something is *made of*. Part-whole composition ("a house is a square and a
 * triangle") appears in no other module, and it is a different skill from
 * recognition: the figure has to be decomposed before it can be rebuilt.
 *
 * Scientific basis:
 *   • Spatial composition (Clements & Sarama) — combining shapes into larger
 *     figures is its own developmental progression, separate from naming.
 *   • Tap-to-place instead of dragging: the same reason ClockGame and SortGame
 *     offer tap controls — a four-year-old's drag is imprecise, and a missed
 *     drag would look like a wrong answer when it is only a slipped finger.
 */

function speakDE(text) { speak(text, { rate: 0.85, pitch: 1.05, lang: 'de-DE' }) }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Names carry their article: "Das Kreis passt da nicht" is exactly the kind of
// sentence a five-year-old should never hear from a learning app.
const SHAPE = {
  circle:    { name: 'Kreis',    art: 'Der' },
  square:    { name: 'Quadrat',  art: 'Das' },
  triangle:  { name: 'Dreieck',  art: 'Das' },
  rectangle: { name: 'Rechteck', art: 'Das' },
}

function ShapePath({ shape, x, y, w, h, rot = 0, fill, stroke, dashed, sw }) {
  const common = {
    fill: fill ?? 'none',
    stroke: stroke ?? 'none',
    strokeWidth: sw ?? (dashed ? 2.5 : 0),
    strokeDasharray: dashed ? '6 5' : undefined,
    transform: rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined,
  }
  if (shape === 'circle')   return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} {...common} />
  if (shape === 'triangle') return <polygon points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} {...common} />
  return <rect x={x} y={y} width={w} height={h} rx={shape === 'square' ? 3 : 3} {...common} />
}

// Each figure is a small parts list — the outline the child fills in.
const FIGURES = [
  { name: 'Haus',       parts: [
    { shape: 'triangle',  x: 20, y: 12, w: 60, h: 32, color: '#FF6B6B' },
    { shape: 'square',    x: 26, y: 44, w: 48, h: 48, color: '#FFD93D' }] },
  { name: 'Baum',       parts: [
    { shape: 'triangle',  x: 22, y: 10, w: 56, h: 46, color: '#6BCB77' },
    { shape: 'rectangle', x: 43, y: 56, w: 14, h: 32, color: '#8D6E63' }] },
  { name: 'Boot',       parts: [
    { shape: 'triangle',  x: 40, y: 12, w: 34, h: 44, color: '#FF9F43' },
    { shape: 'rectangle', x: 18, y: 60, w: 64, h: 20, color: '#74B9FF' }] },
  { name: 'Schneemann', parts: [
    { shape: 'circle',    x: 38, y: 8,  w: 24, h: 24, color: '#EAF6FF' },
    { shape: 'circle',    x: 34, y: 28, w: 32, h: 32, color: '#CFE7FF' },
    { shape: 'circle',    x: 30, y: 56, w: 40, h: 40, color: '#AED4F7' }] },
  { name: 'Rakete',     parts: [
    { shape: 'triangle',  x: 38, y: 6,  w: 24, h: 26, color: '#FF6B6B' },
    { shape: 'rectangle', x: 40, y: 32, w: 20, h: 42, color: '#A29BFE' },
    { shape: 'triangle',  x: 22, y: 56, w: 20, h: 26, color: '#6C63FF' },
    { shape: 'triangle',  x: 58, y: 56, w: 20, h: 26, color: '#6C63FF' }] },
  { name: 'Blume',      parts: [
    { shape: 'circle',    x: 40, y: 14, w: 22, h: 22, color: '#FFD93D' },
    { shape: 'circle',    x: 20, y: 30, w: 22, h: 22, color: '#FD79A8' },
    { shape: 'circle',    x: 60, y: 30, w: 22, h: 22, color: '#FD79A8' },
    { shape: 'rectangle', x: 47, y: 50, w: 8,  h: 38, color: '#6BCB77' }] },
  { name: 'Zug',        parts: [
    { shape: 'rectangle', x: 14, y: 40, w: 50, h: 30, color: '#74B9FF' },
    { shape: 'square',    x: 66, y: 46, w: 24, h: 24, color: '#FF9F43' },
    { shape: 'circle',    x: 20, y: 68, w: 18, h: 18, color: '#444' },
    { shape: 'circle',    x: 62, y: 68, w: 18, h: 18, color: '#444' }] },
  { name: 'Kerze',      parts: [
    { shape: 'triangle',  x: 42, y: 10, w: 16, h: 24, color: '#FF9F43' },
    { shape: 'rectangle', x: 44, y: 36, w: 12, h: 56, color: '#FFD93D' }] },
  { name: 'Berg',       parts: [
    { shape: 'circle',    x: 14, y: 12, w: 20, h: 20, color: '#FFD93D' },
    { shape: 'triangle',  x: 10, y: 26, w: 80, h: 60, color: '#8D6E63' }] },
  { name: 'Turm',       parts: [
    { shape: 'square',    x: 32, y: 58, w: 36, h: 36, color: '#A29BFE' },
    { shape: 'square',    x: 38, y: 34, w: 24, h: 24, color: '#6C63FF' },
    { shape: 'triangle',  x: 34, y: 8,  w: 32, h: 26, color: '#FF6B6B' }] },
]

function buildRounds(level, count = 6) {
  // Easy levels only use figures with few parts. When the tier holds fewer
  // figures than there are rounds it repeats *its own* figures — padding with
  // the full list used to hand a level-1 child the four-part rocket.
  const pool = level <= 3 ? FIGURES.filter(f => f.parts.length <= 2)
             : level <= 6 ? FIGURES.filter(f => f.parts.length <= 3)
             : FIGURES
  const picks = []
  while (picks.length < count) {
    let batch = shuffle(pool)
    // never the same figure twice in a row across a reshuffle
    if (picks.length && batch[0] === picks[picks.length - 1] && batch.length > 1) {
      batch = [batch[1], batch[0], ...batch.slice(2)]
    }
    picks.push(...batch)
  }
  return picks.slice(0, count)
}

export default function ShapeBuildGame({ level = 1, onComplete }) {
  const rounds = useState(() => buildRounds(level))[0]
  const [idx,      setIdx]      = useState(0)
  // Each entry pairs the slot that was filled with the tray piece that filled
  // it — the two indices differ whenever a figure has interchangeable pieces
  // (Rakete's two fins, Blume's two petals), so tracking only one of them
  // greys out the wrong tile.
  const [placed,   setPlaced]   = useState([])     // [{ slot, tray }]
  const [selected, setSelected] = useState(null)   // tray index
  const [wrongSlot, setWrongSlot] = useState(null)
  const [misses,   setMisses]   = useState(0)
  const [mood,     setMood]     = useState('happy')
  const [showWeiter, setShowWeiter] = useState(false)

  const fig = rounds[idx]
  // The tray holds exactly the pieces the figure needs, in random order.
  const tray = useMemo(() => {
    if (!fig) return []
    const maxDim = Math.max(...fig.parts.map(p => Math.max(p.w, p.h)))
    const k = 84 / maxDim
    return shuffle(fig.parts.map(p => ({
      ...p,
      // drawn size inside the 100-unit tile, kept proportional to the real
      // piece; a floor of 12 keeps a thin stem visible without faking its size
      dw: Math.max(12, p.w * k), dh: Math.max(12, p.h * k),
    })))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!fig) return
    setPlaced([]); setSelected(null); setWrongSlot(null); setMood('happy')
    const id = setTimeout(() => speakDE(`Baue ${fig.name}! Welche Form passt wohin?`), 450)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const placeAt = useCallback((slotIdx) => {
    if (selected === null || !fig || placed.some(pl => pl.slot === slotIdx)) return
    const piece = tray[selected]
    // A piece fits a slot when it is the same kind of shape and the same size —
    // two identical circles are interchangeable, which is intended.
    const slot = fig.parts[slotIdx]
    const fits = piece.shape === slot.shape && piece.w === slot.w && piece.h === slot.h
    if (!fits) {
      const s = SHAPE[piece.shape]
      // Right kind of shape, wrong size (the snowman's three circles) is a
      // different mistake from the wrong shape entirely — say which one it is,
      // so the child learns that size is part of "fitting".
      const sizeOnly = piece.shape === slot.shape
      const msg = sizeOnly
        ? `${s.art} ${s.name} ist zu ${piece.w * piece.h > slot.w * slot.h ? 'groß' : 'klein'} für diesen Platz.`
        : `${s.art} ${s.name} passt da nicht.`
      setWrongSlot(slotIdx)
      setMisses(m => m + 1)
      setMood('encouraging')
      sfx.wrong()
      speakDE(msg)
      setTimeout(() => { setWrongSlot(null); setMood('happy') }, 900)
      return
    }
    const next = [...placed, { slot: slotIdx, tray: selected }]
    setPlaced(next)
    setSelected(null)
    sfx.pop?.()
    if (next.length === fig.parts.length) {
      setMood('excited')
      sfx.correct()
      speakDE(`Fertig! Das ist ${fig.name}.`)
      setTimeout(() => setShowWeiter(true), 700)
    }
  }, [selected, fig, placed, tray])

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= rounds.length) {
      sfx.complete()
      const stars = misses <= 1 ? 3 : misses <= rounds.length ? 2 : 1
      setTimeout(() => onComplete({ score: rounds.length, total: rounds.length, stars }), 300)
    } else setIdx(i => i + 1)
  }

  if (!fig) return null
  const filledSlots = new Set(placed.map(pl => pl.slot))
  const usedTiles   = new Set(placed.map(pl => pl.tray))
  const complete    = filledSlots.size === fig.parts.length

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(10px,2vw,18px)',
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
        <LumiCharacter mood={mood} size={64} />
        <div style={{
          flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px', padding: '11px 16px',
          boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,3vw,19px)', color: 'var(--text-primary)',
        }}>
          {complete
            ? <>🎉 Fertig! Das ist <strong style={{ color: '#4A00E0' }}>{fig.name}</strong>.</>
            : selected === null
              ? <>Baue <strong style={{ color: '#4A00E0' }}>{fig.name}</strong> — wähle unten eine Form! 🧩</>
              : <>Wohin gehört {SHAPE[tray[selected].shape].art.toLowerCase()} <strong style={{ color: '#4A00E0' }}>{SHAPE[tray[selected].shape].name}</strong>?</>}
        </div>
      </div>

      {/* The figure being assembled */}
      <div style={{
        background: 'white', borderRadius: 26, padding: 'clamp(8px,2vw,16px)',
        boxShadow: '0 6px 26px rgba(74,0,224,0.12)',
      }}>
        <svg viewBox="0 0 100 100" style={{ width: 'clamp(190px,44vw,290px)', height: 'clamp(190px,44vw,290px)', display: 'block' }}>
          {fig.parts.map((p, i) => {
            const done = filledSlots.has(i)
            return (
              <g key={i}
                onClick={() => placeAt(i)}
                style={{ cursor: selected !== null && !done ? 'pointer' : 'default' }}
              >
                <ShapePath {...p}
                  fill={done ? p.color : 'transparent'}
                  stroke={wrongSlot === i ? '#FF6B6B' : done ? 'rgba(60,40,110,0.35)' : '#A29BFE'}
                  sw={done ? 1.5 : undefined}
                  dashed={!done} />
              </g>
            )
          })}
        </svg>
      </div>

      {/* Piece tray */}
      <div style={{ display: 'flex', gap: 'clamp(8px,2.5vw,16px)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {tray.map((p, i) => {
          const used = usedTiles.has(i)
          const isSel = selected === i
          return (
            <motion.button key={i}
              whileHover={!used ? { scale: 1.07 } : {}} whileTap={!used ? { scale: 0.93 } : {}}
              onClick={() => { if (!used) setSelected(isSel ? null : i) }}
              aria-label={`${SHAPE[p.shape].name} auswählen`}
              style={{
                width: 'clamp(58px,13vw,80px)', height: 'clamp(58px,13vw,80px)',
                borderRadius: 16, background: used ? '#F4F2FA' : 'white',
                border: `3px solid ${isSel ? '#4A00E0' : used ? '#E8E4F5' : '#ECE8FF'}`,
                boxShadow: isSel ? '0 0 0 4px rgba(74,0,224,0.18)' : '0 3px 12px rgba(0,0,0,0.06)',
                cursor: used ? 'default' : 'pointer', opacity: used ? 0.35 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
              }}
            >
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                <ShapePath shape={p.shape}
                  x={(100 - p.dw) / 2} y={(100 - p.dh) / 2} w={p.dw} h={p.dh}
                  fill={p.color} stroke="rgba(60,40,110,0.45)" sw={2.5} />
              </svg>
            </motion.button>
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
