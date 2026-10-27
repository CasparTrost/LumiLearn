import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { pxCard, pxPanel, pxBubble, pxButton, pxSegment, ACCENT, INK } from './px.js'

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
 *     The levels follow it: matching outlined places first, then a piece that
 *     does not belong, then pieces that have to be turned, and at the top
 *     only the silhouette of the whole figure, with no lines between parts.
 *   • Tap-to-place instead of dragging: the same reason ClockGame and SortGame
 *     offer tap controls — a four-year-old's drag is imprecise, and a missed
 *     drag would look like a wrong answer when it is only a slipped finger.
 */

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Names carry their article: "Das Kreis passt da nicht" is exactly the kind of
// sentence a five-year-old should never hear from a learning app. `pro` is
// the pronoun for "Wohin gehört er/es?".
const SHAPE = {
  circle:    { name: 'Kreis',    art: 'Der', pro: 'er' },
  square:    { name: 'Quadrat',  art: 'Das', pro: 'es' },
  triangle:  { name: 'Dreieck',  art: 'Das', pro: 'es' },
  rtriangle: { name: 'Dreieck',  art: 'Das', pro: 'es' },
  rectangle: { name: 'Rechteck', art: 'Das', pro: 'es' },
}

// Turning a circle changes nothing, a square looks the same every quarter
// turn and a rectangle every half turn — only the turns that look different
// count.
function sameTurn(shape, a = 0, b = 0) {
  const period = shape === 'circle' ? 1 : shape === 'square' ? 90 : shape === 'rectangle' ? 180 : 360
  const n = r => ((r % period) + period) % period
  return period === 1 || n(a) === n(b)
}

function ShapePath({ shape, x, y, w, h, rot = 0, ...paint }) {
  const transform = rot ? `rotate(${rot} ${x + w / 2} ${y + h / 2})` : undefined
  if (shape === 'circle')    return <ellipse cx={x + w / 2} cy={y + h / 2} rx={w / 2} ry={h / 2} transform={transform} {...paint} />
  if (shape === 'triangle')  return <polygon points={`${x + w / 2},${y} ${x + w},${y + h} ${x},${y + h}`} transform={transform} {...paint} />
  // right angle bottom left: the upright side can sit flush against a body
  if (shape === 'rtriangle') return <polygon points={`${x},${y} ${x},${y + h} ${x + w},${y + h}`} transform={transform} {...paint} />
  return <rect x={x} y={y} width={w} height={h} rx={3} transform={transform} {...paint} />
}

// Jede Figur ist eine kleine Teileliste — der Umriss, den das Kind füllt.
//
// Die Teile schließen exakt aneinander an: die Dachkante liegt genau auf der
// Hauswand, der Stamm endet genau da, wo die Krone beginnt, die Räder sitzen
// auf der Unterkante des Wagens. Vorher standen die Formen mit Lücken
// nebeneinander, und das Ergebnis sah nach Formen aus statt nach einem Haus.
//
// `g` ist das Geschlecht für den Artikel: "Baue einen Baum", nicht "Baue Baum".
// `part` sagt, was das Teil im Bild ist: "Das Dreieck ist das Dach!"
const FIGURES = [
  { name: 'Haus', g: 'n', parts: [
    { shape: 'triangle',  x: 22, y: 18, w: 56, h: 28, color: '#FF6B6B', part: 'das Dach' },    // Dach sitzt auf …
    { shape: 'square',    x: 30, y: 46, w: 40, h: 40, color: '#FFD93D', part: 'die Wand' }] }, // … der Wand ab y46
  { name: 'Baum', g: 'm', parts: [
    { shape: 'triangle',  x: 20, y: 14, w: 60, h: 48, color: '#6BCB77', part: 'die Krone' },   // Krone endet bei y62
    { shape: 'rectangle', x: 43, y: 62, w: 14, h: 26, color: '#8D6E63', part: 'der Stamm' }] },// Stamm beginnt dort
  { name: 'Boot', g: 'n', parts: [
    { shape: 'triangle',  x: 42, y: 16, w: 32, h: 46, color: '#FF9F43', part: 'das Segel' },   // Segel steht auf …
    { shape: 'rectangle', x: 16, y: 62, w: 68, h: 20, color: '#74B9FF', part: 'der Rumpf' }] },// … dem Rumpf
  { name: 'Kerze', g: 'f', parts: [
    { shape: 'triangle',  x: 42, y: 10, w: 16, h: 24, color: '#FF9F43', part: 'die Flamme' },  // Flamme genau so …
    { shape: 'rectangle', x: 42, y: 34, w: 16, h: 56, color: '#FFD93D', part: 'das Wachs' }] },// … breit wie die Kerze
  { name: 'Eis', g: 'n', parts: [
    { shape: 'circle',    x: 34, y: 20, w: 32, h: 32, color: '#FD79A8', part: 'die Kugel' },   // Kugel in der Waffel
    { shape: 'triangle',  x: 38, y: 46, w: 24, h: 40, rot: 180, color: '#D9A066', part: 'die Waffel' }] },
  { name: 'Lolli', g: 'm', parts: [
    { shape: 'circle',    x: 28, y: 10, w: 44, h: 44, color: '#E84393', part: 'das Bonbon' },  // Bonbon auf …
    { shape: 'rectangle', x: 46, y: 54, w: 8,  h: 36, color: '#D9A066', part: 'der Stiel' }] },// … dem Stiel
  { name: 'Fahne', g: 'f', parts: [
    { shape: 'rectangle', x: 24, y: 10, w: 8,  h: 80, color: '#8D6E63', part: 'die Stange' },  // Stange, an ihr …
    { shape: 'triangle',  x: 40, y: 4,  w: 30, h: 46, rot: 90, color: '#FF6B6B', part: 'die Fahne' }] }, // … das Tuch (Spitze nach rechts)
  { name: 'Schneemann', g: 'm', parts: [
    { shape: 'circle',    x: 39, y: 8,  w: 22, h: 22, color: '#EAF6FF', part: 'der Kopf' },          // drei Kugeln, jede
    { shape: 'circle',    x: 34, y: 28, w: 32, h: 32, color: '#CFE7FF', part: 'die mittlere Kugel' },// auf der nächsten
    { shape: 'circle',    x: 29, y: 54, w: 42, h: 42, color: '#AED4F7', part: 'die untere Kugel' }] },
  { name: 'Turm', g: 'm', parts: [
    { shape: 'triangle',  x: 30, y: 6,  w: 40, h: 28, color: '#FF6B6B', part: 'die Spitze' },  // Spitze  6–34
    { shape: 'square',    x: 38, y: 34, w: 24, h: 24, color: '#4AA3FF', part: 'das Fenster' }, // Mitte  34–58
    { shape: 'square',    x: 32, y: 58, w: 36, h: 36, color: '#B0BEC5', part: 'der Sockel' }] },// Sockel 58–94
  { name: 'Rakete', g: 'f', parts: [
    { shape: 'triangle',  x: 36, y: 6,  w: 28, h: 24, color: '#FF6B6B', part: 'die Spitze' },  // Spitze auf dem Rumpf
    { shape: 'rectangle', x: 40, y: 30, w: 20, h: 44, color: '#B0BEC5', part: 'der Rumpf' },
    // Flossen: rechtwinklig, die senkrechte Kante liegt am Rumpf (x 40 / 60),
    // die untere schließt mit ihm bei y 74 ab. Die linke ist dieselbe Form,
    // eine Dreivierteldrehung weiter.
    { shape: 'rtriangle', x: 20, y: 54, w: 20, h: 20, rot: 270, color: '#4AA3FF', part: 'eine Flosse' },
    { shape: 'rtriangle', x: 60, y: 54, w: 20, h: 20, color: '#4AA3FF', part: 'eine Flosse' }] },
  { name: 'Blume', g: 'f', parts: [
    // vier große Blütenblätter um eine deutlich kleinere Mitte
    { shape: 'circle',    x: 38, y: 5,  w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 19, y: 24, w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 57, y: 24, w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 38, y: 43, w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 43, y: 29, w: 14, h: 14, color: '#FFD93D', part: 'die Mitte' },
    { shape: 'rectangle', x: 46, y: 67, w: 8,  h: 27, color: '#6BCB77', part: 'der Stiel' }] },// Stiel ab dem unteren Blatt
  { name: 'Zug', g: 'm', parts: [
    { shape: 'rectangle', x: 12, y: 44, w: 46, h: 28, color: '#74B9FF', part: 'der Wagen' },   // Wagen 12–58
    { shape: 'square',    x: 58, y: 48, w: 24, h: 24, color: '#FF9F43', part: 'die Lok' },     // Lok schließt bei 58 an
    { shape: 'circle',    x: 18, y: 72, w: 16, h: 16, color: '#444', part: 'ein Rad' },        // Räder auf der
    { shape: 'circle',    x: 62, y: 72, w: 16, h: 16, color: '#444', part: 'ein Rad' }] },     // Unterkante y72
]

// "Baue einen Baum" / "Das ist ein Baum" — im Deutschen unterscheidet sich der
// Artikel nach Fall, und maskulin ist der einzige, bei dem das auffällt.
const ART = { m: { akk: 'einen', nom: 'ein' }, f: { akk: 'eine', nom: 'eine' }, n: { akk: 'ein', nom: 'ein' } }
const art = (fig, fall) => (ART[fig.g] ?? ART.n)[fall]

// What each level asks for, on top of more parts:
//   1–3 two-part figures · 4–5 up to three parts and one piece that does not
//   belong · 6–7 pieces come turned and are turned by tapping them again ·
//   8–10 all figures, only the silhouette shows where the parts go
function levelRules(level) {
  return {
    maxParts:   level <= 3 ? 2 : level <= 6 ? 3 : Infinity,
    distractor: level >= 4,
    turn:       level >= 6,
    silhouette: level >= 8,
  }
}

function buildRounds(level, count = 6) {
  // Easy levels only use figures with few parts. When the tier holds fewer
  // figures than there are rounds it repeats *its own* figures — padding with
  // the full list used to hand a level-1 child the four-part rocket. From
  // level 7 the bigger figures come first in the draw, so they do appear.
  const { maxParts } = levelRules(level)
  const pool = FIGURES.filter(f => f.parts.length <= maxParts)
  const picks = []
  while (picks.length < count) {
    let batch = shuffle(pool)
    if (level >= 7) batch = [...batch.filter(f => f.parts.length > 2), ...batch.filter(f => f.parts.length <= 2)]
    // never the same figure twice in a row across a reshuffle
    if (picks.length && batch[0] === picks[picks.length - 1] && batch.length > 1) {
      batch = [batch[1], batch[0], ...batch.slice(2)]
    }
    picks.push(...batch)
  }
  return shuffle(picks.slice(0, count))
}

// A piece that fits nowhere in this figure: a shape it does not use, or a
// size none of its parts has.
function makeDistractor(fig) {
  const used = new Set(fig.parts.map(p => p.shape === 'rtriangle' ? 'triangle' : p.shape))
  const free = ['circle', 'square', 'triangle', 'rectangle'].filter(s => !used.has(s))
  const shape = free.length ? free[Math.floor(Math.random() * free.length)] : 'square'
  const dims = { circle: [26, 26], square: [28, 28], triangle: [34, 28], rectangle: [36, 16] }[shape]
  return { shape, x: 0, y: 0, w: dims[0], h: dims[1], color: '#B39DDB', extra: true }
}

// A turn that really looks different: none for circles and squares, a
// quarter for rectangles, any for triangles.
function randomTurn(shape) {
  if (shape === 'circle' || shape === 'square') return 0
  if (shape === 'rectangle') return 90
  return 90 * (1 + Math.floor(Math.random() * 3))
}

const sayShape = p => `${SHAPE[p.shape].art} ${SHAPE[p.shape].name}`

export default function ShapeBuildGame({ level = 1, onComplete }) {
  const rules  = levelRules(level)
  const rounds = useState(() => buildRounds(level))[0]
  const [idx,      setIdx]      = useState(0)
  // Each entry pairs the slot that was filled with the tray piece that filled
  // it — the two indices differ whenever a figure has interchangeable pieces
  // (Rakete's two fins, Blume's petals), so tracking only one of them greys
  // out the wrong tile.
  const [placed,   setPlaced]   = useState([])     // [{ slot, tray }]
  const [selected, setSelected] = useState(null)   // tray index
  const [turns,    setTurns]    = useState({})     // tray index -> extra turn the child gave it
  const [wrongSlot, setWrongSlot] = useState(null)
  const [mood,     setMood]     = useState('happy')
  const [showWeiter, setShowWeiter] = useState(false)
  const misses = useRef(0)
  const totalParts = useMemo(() => rounds.reduce((n, f) => n + f.parts.length, 0), [rounds])

  const fig = rounds[idx]
  // The tray holds the pieces the figure needs (plus one that does not
  // belong from level 4), in random order; from level 6 they lie turned.
  const tray = useMemo(() => {
    if (!fig) return []
    const pieces = fig.parts.map(p => ({
      ...p,
      rot: (p.rot ?? 0) + (rules.turn ? randomTurn(p.shape) : 0),
    }))
    if (rules.distractor) pieces.push(makeDistractor(fig))
    const maxDim = Math.max(...pieces.map(p => Math.max(p.w, p.h)))
    const k = 84 / maxDim
    return shuffle(pieces.map(p => ({
      ...p,
      // drawn size inside the 100-unit tile, kept proportional to the real
      // piece; a floor of 12 keeps a thin stem visible without faking its size
      dw: Math.max(12, p.w * k), dh: Math.max(12, p.h * k),
    })))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const rotOf = i => (tray[i]?.rot ?? 0) + (turns[i] ?? 0)

  useEffect(() => {
    if (!fig) return
    setPlaced([]); setSelected(null); setTurns({}); setWrongSlot(null); setMood('happy')
    lockPreviews()
    const extra = idx > 0 ? ''
      : rules.turn ? ' Tippe ein Teil noch einmal an, dann dreht es sich.'
      : rules.distractor ? ' Ein Teil gehört nicht dazu.' : ''
    const id = setTimeout(() => sayTask(`Baue ${art(fig, 'akk')} ${fig.name}! Welche Form passt wohin?${extra}`), 450)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (i) => {
    if (showWeiter) return
    if (selected === i && rules.turn) {
      // tapping the chosen piece again turns it a quarter
      setTurns(t => ({ ...t, [i]: (t[i] ?? 0) + 90 }))
      sfx.flip?.()
      return
    }
    setSelected(selected === i ? null : i)
    if (selected !== i) {
      const s = SHAPE[tray[i].shape]
      narrate([{ text: `${s.art} ${s.name}. Wohin gehört ${s.pro}?` }])
    }
  }

  const placeAt = useCallback((slotIdx) => {
    if (selected === null || !fig || placed.some(pl => pl.slot === slotIdx)) return
    const piece = tray[selected]
    // A piece fits a slot when it is the same kind of shape, the same size
    // and turned the same way — two identical circles are interchangeable,
    // which is intended.
    const slot = fig.parts[slotIdx]
    const sameShape = piece.shape === slot.shape
    const sameSize  = sameShape && piece.w === slot.w && piece.h === slot.h
    if (!sameSize || !sameTurn(slot.shape, rotOf(selected), slot.rot)) {
      const s = SHAPE[piece.shape]
      // Right kind of shape, wrong size (the snowman's three circles) is a
      // different mistake from the wrong shape entirely — say which one it is,
      // so the child learns that size is part of "fitting".
      const msg = sameSize
        ? 'Die Form passt, aber sie liegt falsch herum. Tippe noch einmal auf das Teil, dann dreht es sich.'
        : sameShape
          ? `${s.art} ${s.name} ist zu ${piece.w * piece.h > slot.w * slot.h ? 'groß' : 'klein'} für diesen Platz.`
          : `${s.art} ${s.name} passt da nicht.`
      setWrongSlot(slotIdx)
      misses.current++
      setMood('encouraging')
      sfx.mismatch()
      sayWrong(msg)
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
      sayRight(`${sayShape(piece)} ist ${slot.part}. Das ist ${art(fig, 'nom')} ${fig.name}.`)
      setTimeout(() => setShowWeiter(true), 700)
    } else {
      narrate([{ text: `${sayShape(piece)} ist ${slot.part}!` }])
    }
  }, [selected, fig, placed, tray, turns]) // eslint-disable-line react-hooks/exhaustive-deps

  const missTap = () => {
    if (selected !== null && !showWeiter) narrate([{ text: 'Tippe auf einen Platz im Bild.' }], { skipIfSame: true })
  }

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= rounds.length) {
      sfx.complete()
      // every piece is one task; a piece that first went to a wrong place
      // does not count as right on the first try
      afterNarration(() => onComplete(result(totalParts - misses.current, totalParts)), { minMs: 300 })
    } else setIdx(i => i + 1)
  }

  if (!fig) return null
  const filledSlots = new Set(placed.map(pl => pl.slot))
  const usedTiles   = new Set(placed.map(pl => pl.tray))
  const complete    = filledSlots.size === fig.parts.length
  const sel         = selected !== null ? tray[selected] : null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(10px,2vw,18px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {rounds.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < idx || (i === idx && complete) ? 'done' : i === idx ? 'current' : 'todo'),
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={64} />
        <div style={{
          flex: 1, ...pxBubble, padding: '11px 16px',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px,3vw,20px)', color: 'var(--text-primary)',
        }}>
          {complete
            ? <>🎉 Fertig! Das ist {art(fig, 'nom')} <strong style={{ color: ACCENT }}>{fig.name}</strong>.</>
            : sel
              ? <>Wohin gehört {SHAPE[sel.shape].art.toLowerCase()} <strong style={{ color: ACCENT }}>{SHAPE[sel.shape].name}</strong>?{rules.turn && ' Noch einmal tippen: drehen.'}</>
              : <>Baue {art(fig, 'akk')} <strong style={{ color: ACCENT }}>{fig.name}</strong> — wähle unten eine Form! 🧩</>}
        </div>
      </div>

      {/* The figure being assembled */}
      <div style={{ ...pxPanel, padding: 'clamp(8px,2vw,16px)' }}>
        <svg viewBox="0 0 100 100" style={{ width: 'clamp(220px,46vw,300px)', height: 'clamp(220px,46vw,300px)', display: 'block' }}>
          <rect width="100" height="100" fill="transparent" onClick={missTap} />
          {/* top levels: only the outline of the whole figure, no lines between the parts */}
          {rules.silhouette && (
            <g pointerEvents="none">
              {fig.parts.map((p, i) => <ShapePath key={`o${i}`} {...p} fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />)}
              {fig.parts.map((p, i) => <ShapePath key={`f${i}`} {...p} fill="#E8DCC4" />)}
            </g>
          )}
          {fig.parts.map((p, i) => {
            const done = filledSlots.has(i)
            if (!done && rules.silhouette && wrongSlot !== i) return null
            return (
              <ShapePath key={i} {...p} pointerEvents="none"
                fill={done ? p.color : 'transparent'}
                stroke={wrongSlot === i ? '#C2412D' : done ? 'rgba(42,27,61,0.45)' : 'var(--px-ink-soft)'}
                strokeWidth={done ? 1.5 : wrongSlot === i ? 3 : 2.2}
                strokeDasharray={done ? undefined : '6 5'} />
            )
          })}
          {/* hit areas: a wide invisible edge around thin places (stem,
              flame) first, the places themselves on top */}
          {fig.parts.map((p, i) => !filledSlots.has(i) && (
            <ShapePath key={`h${i}`} {...p} fill="none" stroke="transparent" strokeWidth={12} pointerEvents="stroke"
              onClick={() => placeAt(i)} style={{ cursor: sel ? 'pointer' : 'default' }} />
          ))}
          {fig.parts.map((p, i) => !filledSlots.has(i) && (
            <ShapePath key={`t${i}`} {...p} fill="transparent" pointerEvents="fill"
              onClick={() => placeAt(i)} style={{ cursor: sel ? 'pointer' : 'default' }} />
          ))}
        </svg>
      </div>

      {/* Piece tray */}
      <div style={{ display: 'flex', gap: 'clamp(8px,2.5vw,16px)', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 680 }}>
        {tray.map((p, i) => {
          const used = usedTiles.has(i)
          const isSel = selected === i
          return (
            <motion.button key={i}
              whileTap={!used ? { scale: 0.93 } : {}}
              onClick={() => { if (!used) pick(i) }}
              aria-label={`${SHAPE[p.shape].name} auswählen`}
              disabled={used || complete}
              style={{
                width: 'clamp(64px,13vw,84px)', height: 'clamp(64px,13vw,84px)', position: 'relative',
                ...pxCard(isSel ? 'selected' : undefined),
                cursor: used ? 'default' : 'pointer', opacity: used ? 0.35 : 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6,
              }}
            >
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <motion.g animate={{ rotate: rotOf(i) }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                  <ShapePath shape={p.shape}
                    x={(100 - p.dw) / 2} y={(100 - p.dh) / 2} w={p.dw} h={p.dh}
                    fill={p.color} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
                </motion.g>
              </svg>
              {isSel && rules.turn && (
                <span aria-hidden style={{ position: 'absolute', top: -10, right: -10, width: 26, height: 26, borderRadius: '50%', background: 'var(--px-gold)', border: `2px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </span>
              )}
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
            aria-label="Weiter"
            style={{
              ...pxButton('green'), color: INK, textShadow: 'none', padding: '12px 40px',
              fontSize: 'clamp(16px,3.4vw,21px)',
            }}
          >Weiter! →</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
