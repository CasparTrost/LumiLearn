import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts, useDragState } from '../components/play/index.js'
import { pxCard, pxPanel, pxButton, INK } from './px.js'

/**
 * Formen-Werkstatt — aus Formen ein Bild zusammensetzen
 *
 * An animal comes into the workshop and wants something: a boat, a house,
 * a rocket. The child drags the shapes into the outline on the workbench;
 * when the last piece is in, the thing comes alive — it gets a face, the
 * boat sails, the rocket lifts off, a bee visits the flower — and the
 * customer cheers.
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
 *   • Dragging and tapping both work (components/play DragArea): a piece
 *     can be pulled into place, or tapped and then its place tapped. A piece
 *     let go over empty space just goes back — a slipped finger is never
 *     counted as a wrong answer.
 */

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Names of the shapes, for screen readers on the pieces
const SHAPE = {
  circle:    { name: 'Kreis' },
  square:    { name: 'Quadrat' },
  triangle:  { name: 'Dreieck' },
  rtriangle: { name: 'Dreieck' },
  rectangle: { name: 'Rechteck' },
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
// `icon` ist, was sich der Kunde wünscht, `face`, wo das fertige Ding Augen
// bekommt ([x, y, Maßstab]), `alive`, wie es sich dann bewegt und wer oder
// was dazukommt (`extra` bei `at`). `use`: wo der Kunde sein Ding benutzt —
// er steigt ins Boot, leckt am Eis — mit Fußpunkt [x, y] und Stimmung.
const FIGURES = [
  { name: 'Haus', icon: '🏠', face: [50, 66, 0.3], alive: { move: 'hop', extra: '🐦', at: [62, 10] }, use: [50, 86, 'happy'], parts: [
    { shape: 'triangle',  x: 22, y: 18, w: 56, h: 28, color: '#FF6B6B' },    // Dach sitzt auf …
    { shape: 'square',    x: 30, y: 46, w: 40, h: 40, color: '#FFD93D' }] }, // … der Wand ab y46
  { name: 'Baum', icon: '🌳', face: [50, 44, 0.28], alive: { move: 'sway', extra: '🍎', at: [34, 34] }, use: [76, 90, 'happy'], parts: [
    { shape: 'triangle',  x: 20, y: 14, w: 60, h: 48, color: '#6BCB77' },   // Krone endet bei y62
    { shape: 'rectangle', x: 43, y: 62, w: 14, h: 26, color: '#8D6E63' }] },// Stamm beginnt dort
  { name: 'Boot', icon: '⛵', face: [50, 72, 0.18], alive: { move: 'sail', extra: '🌊', at: [50, 90] }, use: [30, 62, 'happy'], parts: [
    { shape: 'triangle',  x: 42, y: 16, w: 32, h: 46, color: '#FF9F43' },   // Segel steht auf …
    { shape: 'rectangle', x: 16, y: 62, w: 68, h: 20, color: '#74B9FF' }] },// … dem Rumpf
  { name: 'Kerze', icon: '🕯️', face: [50, 62, 0.14], alive: { move: 'hop', extra: '✨', at: [66, 10] }, use: [74, 90, 'wow'], parts: [
    { shape: 'triangle',  x: 42, y: 10, w: 16, h: 24, color: '#FF9F43' },  // Flamme genau so …
    { shape: 'rectangle', x: 42, y: 34, w: 16, h: 56, color: '#FFD93D' }] },// … breit wie die Kerze
  { name: 'Eis', icon: '🍦', face: [50, 36, 0.24], alive: { move: 'hop', extra: '✨', at: [70, 18] }, use: [76, 60, 'eat'], parts: [
    { shape: 'circle',    x: 34, y: 20, w: 32, h: 32, color: '#FD79A8' },   // Kugel in der Waffel
    { shape: 'triangle',  x: 38, y: 46, w: 24, h: 40, rot: 180, color: '#D9A066' }] },
  { name: 'Lolli', icon: '🍭', face: [50, 32, 0.34], alive: { move: 'spin' }, use: [78, 56, 'eat'], parts: [
    { shape: 'circle',    x: 28, y: 10, w: 44, h: 44, color: '#E84393' },  // Bonbon auf …
    { shape: 'rectangle', x: 46, y: 54, w: 8,  h: 36, color: '#D9A066' }] },// … dem Stiel
  { name: 'Fahne', icon: '🚩', face: [52, 24, 0.18], alive: { move: 'sway', extra: '💨', at: [84, 20] }, use: [62, 92, 'happy'], parts: [
    { shape: 'rectangle', x: 24, y: 10, w: 8,  h: 80, color: '#8D6E63' },  // Stange, an ihr …
    { shape: 'triangle',  x: 40, y: 4,  w: 30, h: 46, rot: 90, color: '#FF6B6B' }] }, // … das Tuch (Spitze nach rechts)
  { name: 'Schneemann', icon: '⛄', face: [50, 19, 0.17], alive: { move: 'hop', extra: '🎩', at: [50, 2] }, use: [80, 96, 'happy'], parts: [
    { shape: 'circle',    x: 39, y: 8,  w: 22, h: 22, color: '#EAF6FF' },          // drei Kugeln, jede
    { shape: 'circle',    x: 34, y: 28, w: 32, h: 32, color: '#CFE7FF' },// auf der nächsten
    { shape: 'circle',    x: 29, y: 54, w: 42, h: 42, color: '#AED4F7' }] },
  { name: 'Turm', icon: '🗼', face: [50, 76, 0.26], alive: { move: 'hop', extra: '🐦', at: [64, 4] }, use: [78, 94, 'happy'], parts: [
    { shape: 'triangle',  x: 30, y: 6,  w: 40, h: 28, color: '#FF6B6B' },  // Spitze  6–34
    { shape: 'square',    x: 38, y: 34, w: 24, h: 24, color: '#4AA3FF' }, // Mitte  34–58
    { shape: 'square',    x: 32, y: 58, w: 36, h: 36, color: '#B0BEC5' }] },// Sockel 58–94
  { name: 'Rakete', icon: '🚀', face: [50, 50, 0.16], alive: { move: 'launch', extra: '🔥', at: [50, 84] }, use: [50, 52, 'happy'], parts: [
    { shape: 'triangle',  x: 36, y: 6,  w: 28, h: 24, color: '#FF6B6B' },  // Spitze auf dem Rumpf
    { shape: 'rectangle', x: 40, y: 30, w: 20, h: 44, color: '#B0BEC5' },
    // Flossen: rechtwinklig, die senkrechte Kante liegt am Rumpf (x 40 / 60),
    // die untere schließt mit ihm bei y 74 ab. Die linke ist dieselbe Form,
    // eine Dreivierteldrehung weiter.
    { shape: 'rtriangle', x: 20, y: 54, w: 20, h: 20, rot: 270, color: '#4AA3FF' },
    { shape: 'rtriangle', x: 60, y: 54, w: 20, h: 20, color: '#4AA3FF' }] },
  { name: 'Blume', icon: '🌸', face: [50, 36, 0.12], alive: { move: 'sway', extra: '🐝', at: [80, 12] }, use: [76, 94, 'wow'], parts: [
    // vier große Blütenblätter um eine deutlich kleinere Mitte
    { shape: 'circle',    x: 38, y: 5,  w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 19, y: 24, w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 57, y: 24, w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 38, y: 43, w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 43, y: 29, w: 14, h: 14, color: '#FFD93D' },
    { shape: 'rectangle', x: 46, y: 67, w: 8,  h: 27, color: '#6BCB77' }] },// Stiel ab dem unteren Blatt
  { name: 'Zug', icon: '🚂', face: [70, 60, 0.18], alive: { move: 'drive', extra: '💨', at: [84, 34] }, use: [34, 44, 'happy'], parts: [
    { shape: 'rectangle', x: 12, y: 44, w: 46, h: 28, color: '#74B9FF' },   // Wagen 12–58
    { shape: 'square',    x: 58, y: 48, w: 24, h: 24, color: '#FF9F43' },     // Lok schließt bei 58 an
    { shape: 'circle',    x: 18, y: 72, w: 16, h: 16, color: '#444' },        // Räder auf der
    { shape: 'circle',    x: 62, y: 72, w: 16, h: 16, color: '#444' }] },     // Unterkante y72
]

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

// ── Frei bauen: after the last figure, the child builds anything ──────────────
// Tap a shape to put it on the board, drag it where it should go, tap it to
// turn it. "Fertig": Lumi counts the shapes and guesses the figure when the
// shapes are those of one it knows ("Ist das ein Haus?").
const FREE_SHAPES = [
  { shape: 'circle',    w: 24, h: 24 },
  { shape: 'square',    w: 24, h: 24 },
  { shape: 'triangle',  w: 30, h: 24 },
  { shape: 'rectangle', w: 34, h: 14 },
]
const FREE_COLORS = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4AA3FF', '#FF9F43', '#FD79A8']
// What Lumi sees in a free build: how many of each shape, and the figure it
// matches if the shapes are those of one ("Ist das ein Haus?")
function describeBuild(pieces) {
  const kind = p => (p.shape === 'rtriangle' ? 'triangle' : p.shape)
  const key = list => list.map(kind).sort().join()
  const known = FIGURES.find(f => key(f.parts) === key(pieces))
  const counts = Object.entries(pieces.reduce((m, p) => ({ ...m, [kind(p)]: (m[kind(p)] ?? 0) + 1 }), {}))
  return { counts, known }
}

// Lumi's ideas above the free workbench
const IDEAS = ['🏠', '⛵', '🚀']

function FreeBuild({ onDone }) {
  const [pieces, setPieces] = useState([])
  const [seen, setSeen]     = useState(null)   // what Lumi sees, once finished
  const svgRef = useRef(null)
  const drag   = useRef(null)    // { id, dx, dy, moved }
  const firstRef = useRef(null), doneRef = useRef(null)
  const done = !!seen

  useEffect(() => { sayTask() }, [])

  const toSvg = e => {
    const m = svgRef.current?.getScreenCTM()?.inverse()
    if (!m) return { x: 0, y: 0 }
    return { x: m.a * e.clientX + m.c * e.clientY + m.e, y: m.b * e.clientX + m.d * e.clientY + m.f }
  }

  const add = (f) => {
    if (done) return
    setPieces(list => [...list, { ...f, id: Date.now(), x: 50 - f.w / 2 + (list.length % 4) * 4, y: 40 - f.h / 2 + (list.length % 4) * 4, rot: 0, color: FREE_COLORS[list.length % FREE_COLORS.length] }])
    sfx.pop()
  }

  const down = (e, p) => {
    if (done) return
    e.stopPropagation()
    const pt = toSvg(e)
    drag.current = { id: p.id, dx: pt.x - p.x, dy: pt.y - p.y, moved: false }
    try { svgRef.current.setPointerCapture(e.pointerId) } catch { /* not supported */ }
  }
  const move = e => {
    const d = drag.current
    if (!d) return
    const pt = toSvg(e)
    d.moved = true
    setPieces(list => list.map(p => (p.id === d.id
      ? { ...p, x: Math.max(-p.w / 2, Math.min(100 - p.w / 2, pt.x - d.dx)), y: Math.max(-p.h / 2, Math.min(100 - p.h / 2, pt.y - d.dy)) }
      : p)))
  }
  const up = () => {
    const d = drag.current
    drag.current = null
    // a tap without moving turns the piece
    if (d && !d.moved) {
      setPieces(list => list.map(p => (p.id === d.id && p.shape !== 'circle' ? { ...p, rot: p.rot + 90 } : p)))
      sfx.flip()
    }
  }

  // Lumi looks at the build and shows what it sees, then the results
  const finish = () => {
    if (!pieces.length || done) return
    setSeen(describeBuild(pieces))
    sfx.tada()
    sayRight()
    afterNarration(onDone, { minMs: 3200 })
  }

  return (
    <>
      {/* no words: the first shape button is tapped for you, and once
          something is built, the check button */}
      <HintHand to={pieces.length ? doneRef : firstRef} delay={pieces.length ? 8000 : 2500} active={!done} />
      {/* what free building is for: Lumi dreams of things to build */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Art art="lumi" size={54} />
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 15 }}
          style={{ display: 'flex', gap: 4, padding: '6px 12px', background: '#FFFDF7', border: `3px solid ${INK}`, borderRadius: 22, boxShadow: '0 4px 0 rgba(42,27,61,0.3)' }}>
          {IDEAS.map((icon, i) => (
            <motion.span key={icon} animate={reduceMotion() ? {} : { y: [0, -6, 0] }} transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.3 }}>
              <Art art={icon} size={34} />
            </motion.span>
          ))}
          <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 26, color: INK, alignSelf: 'center' }}>?</span>
        </motion.div>
      </div>
      <div style={{ position: 'relative', ...pxPanel, padding: 'clamp(8px,2vw,16px)', background: '#8A5A33' }}>
        <svg ref={svgRef} viewBox="0 0 100 100" onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ width: 'clamp(220px,46vw,300px)', height: 'clamp(220px,46vw,300px)', display: 'block', touchAction: 'none', background: '#DCEBFA', borderRadius: 8 }}>
          {pieces.map(p => (
            <ShapePath key={p.id} {...p} fill={p.color} stroke={INK} strokeWidth={1.5} strokeLinejoin="round"
              onPointerDown={e => down(e, p)} style={{ cursor: done ? 'default' : 'grab' }} />
          ))}
        </svg>
        {/* Lumi says what it sees: each shape with how many, and maybe what it is */}
        <AnimatePresence>
          {seen && (
            <motion.div key="seen" initial={{ scale: 0, y: 20 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}
              style={{
                position: 'absolute', left: '50%', bottom: -30, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 8,
                background: '#FFFDF7', border: `3px solid ${INK}`, borderRadius: 18, padding: '6px 12px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)', whiteSpace: 'nowrap',
              }}>
              <Art art="lumi" size={40} />
              {seen.counts.map(([shape, n]) => (
                <span key={shape} style={{ display: 'flex', alignItems: 'center', gap: 2, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 22, color: INK }}>
                  {n}
                  <svg viewBox="0 0 100 100" width="28" height="28"><ShapePath shape={shape} x={10} y={shape === 'rectangle' ? 30 : 10} w={80} h={shape === 'rectangle' ? 40 : 80} fill="#FFC93C" stroke={INK} strokeWidth={6} /></svg>
                </span>
              ))}
              {seen.known && <><span style={{ fontSize: 22 }}>→</span><Art art={seen.known.icon} size={38} /></>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div style={{ display: 'flex', gap: 'clamp(8px,2.5vw,16px)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 18 }}>
        {FREE_SHAPES.map((f, i) => (
          <motion.button key={f.shape} ref={i === 0 ? firstRef : undefined} whileTap={{ scale: 0.9 }} onClick={() => add(f)} disabled={done}
            aria-label={`${SHAPE[f.shape].name} dazulegen`}
            style={{ width: 'clamp(66px,13vw,84px)', height: 'clamp(66px,13vw,84px)', ...pxCard(), cursor: 'pointer', padding: 6 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <ShapePath shape={f.shape} x={50 - f.w * 1.2} y={50 - f.h * 1.2} w={f.w * 2.4} h={f.h * 2.4}
                fill={FREE_COLORS[i]} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
            </svg>
          </motion.button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => { setPieces(list => list.slice(0, -1)); sfx.whoosh() }} disabled={!pieces.length || done} aria-label="Weg damit"
          style={{ ...pxButton('parch'), padding: '8px 22px', minHeight: 56, fontSize: 28, opacity: pieces.length && !done ? 1 : 0.5 }}>
          🧽
        </button>
        <button ref={doneRef} onClick={finish} disabled={!pieces.length || done} aria-label="Fertig"
          style={{ ...pxButton('green'), color: INK, textShadow: 'none', padding: '8px 30px', minHeight: 56, fontSize: 28, opacity: pieces.length && !done ? 1 : 0.5 }}>
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </>
  )
}

const CUSTOMERS = ['🐰', '🐻', '🐸', '🐱', '🐶', '🐭', '🐷', '🦔']
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// How a finished figure moves when it comes alive
const ALIVE = {
  hop:    { y: [0, -22, 0, -10, 0], scaleY: [1, 1.06, 0.94, 1.03, 1] },
  sway:   { rotate: [0, -7, 6, -4, 0] },
  spin:   { rotate: [0, 360] },
  sail:   { x: [0, 26, -10, 0], rotate: [0, 5, -5, 3, 0] },
  drive:  { x: [0, 30, 30, 0] },
  launch: { y: [0, 6, -60, -40, 0] },
}

// The same journey for the customer riding along, in pixels: only the
// moves that carry it (a boat sails, a rocket lifts off, a train drives)
const CARRIES = ['sail', 'drive', 'launch']
const riding = (move, size) => {
  const m = ALIVE[move]
  return CARRIES.includes(move)
    ? { x: (m.x ?? [0]).map(v => v * size / 100), y: (m.y ?? [0]).map(v => v * size / 100) }
    : {}
}

// Eyes and a smile for the finished thing, in the figure's 100-unit space
function Face({ x, y, s }) {
  return (
    <g transform={`translate(${x - 50 * s} ${y - 46 * s}) scale(${s})`} pointerEvents="none">
      <circle cx="36" cy="42" r="10" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="64" cy="42" r="10" fill="#fff" stroke={INK} strokeWidth="3" />
      <circle cx="38" cy="44" r="5" fill={INK} />
      <circle cx="66" cy="44" r="5" fill={INK} />
      <path d="M38 60 Q50 72 62 60" stroke={INK} strokeWidth="4" fill="none" strokeLinecap="round" />
    </g>
  )
}

// The box a slot covers on the board, turned with the slot; never smaller
// than 18 units, so a thin stem is still a place a finger can find.
function slotBox(p) {
  const turned = (p.rot ?? 0) % 180 !== 0
  const w = Math.max(18, turned ? p.h : p.w), h = Math.max(18, turned ? p.w : p.h)
  const cx = p.x + p.w / 2, cy = p.y + p.h / 2
  return { left: cx - w / 2, top: cy - h / 2, w, h }
}

// The workbench: the outline to fill, one drop place per part
function Board({ fig, customer, rules, filled, wrongSlot, stuck, complete, onDrop, size }) {
  const { hover, picked } = useDragState()
  const zones = fig.parts.map((p, i) => ({ i, box: slotBox(p) }))
    .filter(z => !filled.has(z.i))
    .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)   // small places on top
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
        {/* the blueprint grid of the workbench */}
        <rect x="-4" y="-4" width="108" height="108" rx="8" fill="#DCEBFA" stroke={INK} strokeWidth="1.6" />
        {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${(i + 1) * 10} -4 V104 M-4 ${(i + 1) * 10} H104`} stroke="#B7D2EE" strokeWidth="0.5" />)}
        <motion.g initial={false}
          animate={complete && !reduceMotion() ? ALIVE[fig.alive.move] : { x: 0, y: 0, rotate: 0, scaleY: 1 }}
          transition={{ duration: fig.alive.move === 'spin' ? 0.9 : 1.2, delay: CARRIES.includes(fig.alive.move) ? 1 : 0.3 }}
          style={{ originX: 0.5, originY: 1 }}>
          {/* top levels: only the outline of the whole figure, no lines between the parts */}
          {rules.silhouette && (
            <g pointerEvents="none">
              {fig.parts.map((p, i) => <ShapePath key={`o${i}`} {...p} fill="none" stroke={INK} strokeWidth={2.4} strokeLinejoin="round" />)}
              {fig.parts.map((p, i) => <ShapePath key={`f${i}`} {...p} fill="#C9D9EA" />)}
            </g>
          )}
          {fig.parts.map((p, i) => {
            const done = filled.has(i)
            const glow = !done && (hover === `slot${i}` || (picked && !hover))
            if (!done && rules.silhouette && wrongSlot !== i && hover !== `slot${i}`) return null
            return (
              <ShapePath key={i} {...p}
                fill={done ? p.color : glow ? 'rgba(255,201,60,0.45)' : 'transparent'}
                stroke={wrongSlot === i ? '#C2412D' : done ? INK : glow ? '#E0A000' : 'var(--px-ink-soft)'}
                strokeWidth={done ? 1.6 : wrongSlot === i ? 3 : 2.2}
                strokeDasharray={done ? undefined : '6 5'} strokeLinejoin="round" />
            )
          })}
          {complete && <Face x={fig.face[0]} y={fig.face[1]} s={fig.face[2]} />}
        </motion.g>
        {/* a piece that does not fit sits in the place for a moment, all
            wrong and wobbling, then pops back out */}
        <AnimatePresence>
          {stuck && (
            <motion.g key={stuck.n} initial={{ scale: 0.6, opacity: 0 }}
              animate={reduceMotion() ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [0.6, 1.15, 1, 1.08, 1], rotate: [0, -14, 12, -10, 8] }}
              exit={{ y: -30, opacity: 0, scale: 0.5, transition: { duration: 0.3 } }}
              transition={{ duration: 0.8 }} style={{ originX: 0.5, originY: 0.5, transformBox: 'fill-box' }}>
              <ShapePath shape={stuck.shape} x={stuck.x} y={stuck.y} w={stuck.w} h={stuck.h} rot={stuck.rot}
                fill={stuck.color} stroke={INK} strokeWidth={1.6} strokeLinejoin="round" />
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
      {/* the customer gets in or tucks in, and moves along with it */}
      <AnimatePresence>
        {complete && (
          <motion.div key="user" aria-hidden="true" initial={{ opacity: 0, scale: 0.3, y: -size * 0.3 }}
            animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 14 }}
            style={{ position: 'absolute', left: `${fig.use[0]}%`, top: `${fig.use[1]}%`, width: 0, height: 0, pointerEvents: 'none', zIndex: 2 }}>
            <motion.div animate={reduceMotion() ? {} : riding(fig.alive.move, size)} transition={{ duration: 1.2, delay: 1 }}
              style={{ position: 'absolute', left: -size * 0.11, bottom: 0 }}>
              <Critter art={customer} size={size * (fig.name === 'Rakete' ? 0.16 : 0.22)} mood={fig.use[2]} shadow={false} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* who or what joins the living thing */}
      <AnimatePresence>
        {complete && fig.alive.extra && (
          <motion.div key="extra" aria-hidden="true" initial={{ scale: 0, y: -30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 14 }}
            style={{ position: 'absolute', left: `${fig.alive.at[0]}%`, top: `${fig.alive.at[1]}%`, marginLeft: -size * 0.09, marginTop: -size * 0.09, pointerEvents: 'none' }}>
            <Art art={fig.alive.extra} size={size * 0.18} />
          </motion.div>
        )}
      </AnimatePresence>
      {/* the places, as drop targets over the drawing */}
      {zones.map(({ i, box }) => (
        <DropZone key={i} id={`slot${i}`} slop={4} label={`Platz ${i + 1}`} onDrop={piece => onDrop(piece, i)}
          style={{ position: 'absolute', left: `${box.left}%`, top: `${box.top}%`, width: `${box.w}%`, height: `${box.h}%` }}>
          {null}
        </DropZone>
      ))}
    </div>
  )
}

// A finished figure, small: for the workshop shelf
function MiniFigure({ fig, size }) {
  return (
    <svg viewBox="-4 -4 108 108" width={size} height={size} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      {fig.parts.map((p, i) => <ShapePath key={i} {...p} fill={p.color} stroke={INK} strokeWidth={3} strokeLinejoin="round" />)}
      <Face x={fig.face[0]} y={fig.face[1]} s={fig.face[2]} />
    </svg>
  )
}

// The wall shelf of the workshop: every finished figure lands on it (it
// flies up from the workbench, shrinking), so the workshop fills up
function Shelf({ figs, total }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', width: 'min(100%, 560px)', height: 58, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 6 }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 9, borderRadius: 4, background: '#8A5A33', border: `2px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.25)' }} />
      {Array.from({ length: total }, (_, n) => (
        <div key={n} style={{ width: 48, height: 48, marginBottom: 9, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {figs[n] && (
            <motion.div initial={reduceMotion() ? false : { y: 240, scale: 3.2, opacity: 0.4 }} animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}>
              <MiniFigure fig={figs[n]} size={46} />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  )
}

function useViewportWidth() {
  const [w, setW] = useState(() => window.innerWidth)
  useEffect(() => {
    const on = () => setW(window.innerWidth)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return w
}

export default function ShapeBuildGame({ level = 1, onComplete }) {
  const rules  = levelRules(level)
  const rounds = useState(() => buildRounds(level).map((f, i) => ({ ...f, customer: CUSTOMERS[i % CUSTOMERS.length] })))[0]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [idx,      setIdx]      = useState(0)
  // Each entry pairs the slot that was filled with the tray piece that filled
  // it — the two indices differ whenever a figure has interchangeable pieces
  // (Rakete's two fins, Blume's petals), so tracking only one of them hides
  // the wrong piece.
  const [placed,   setPlaced]   = useState([])     // [{ slot, tray }]
  const [turns,    setTurns]    = useState({})     // tray index -> extra turn the child gave it
  const [wrongSlot, setWrongSlot] = useState(null)
  const [mood,     setMood]     = useMood()
  const [lastDone, setLastDone] = useState(false)  // the last figure is finished: build freely?
  const [freeMode, setFreeMode] = useState(false)
  const [turnHint, setTurnHint] = useState(null)   // { i, n }: this piece only needs turning
  const [streak,   setStreak]   = useState(0)      // figures built without a miss in a row
  const [stuck,    setStuck]    = useState(null)   // a wrong piece sitting in a place for a moment
  const [bursts, burst] = useBursts()
  const misses = useRef(0)
  const roundMisses = useRef(0)
  const timers = useRef([])
  const boardRef = useRef(null)
  const trayRef  = useRef(null)
  const vw = useViewportWidth()
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
    // Drawn size inside the 100-unit tile. Small parts used to shrink in
    // proportion to the largest one — a wheel became a 12-unit dot. The
    // sizes are compressed now: bigger stays bigger (the snowman's three
    // circles keep their order), but a small part stays a shape you see.
    return shuffle(pieces.map(p => {
      const long = Math.max(p.w, p.h)
      const k = (84 * (long / maxDim) ** 0.55) / long
      return { ...p, dw: Math.max(10, p.w * k), dh: Math.max(10, p.h * k) }
    }))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const rotOf = i => (tray[i]?.rot ?? 0) + (turns[i] ?? 0)

  // Timers of the figure: they wait while the help is open
  const later = useCallback((fn, ms) => {
    const run = () => { if (pausedRef.current) timers.current.push(setTimeout(run, 250)); else fn() }
    timers.current.push(setTimeout(run, ms))
  }, [])

  // A layout effect: the new figure is never painted with the last one's pieces
  useLayoutEffect(() => {
    if (!fig) return
    timers.current.forEach(clearTimeout); timers.current = []
    setPlaced([]); setTurns({}); setWrongSlot(null); setTurnHint(null); setStuck(null)
    roundMisses.current = 0
    lockPreviews()
    sayTask()
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const last = idx + 1 >= rounds.length
  // every piece is one task; a piece that first went to a wrong place does
  // not count as right on the first try. Free building is a bonus, not rated.
  const finishLevel = useCallback(() => {
    sfx.complete()
    afterNarration(() => onComplete(result(totalParts - misses.current, totalParts)), { minMs: 300 })
  }, [onComplete, totalParts])

  // A piece let go over a place: it snaps in, or it bounces back and the
  // place flashes; a piece that only lies the wrong way round makes its
  // turn button wiggle.
  const dropPiece = useCallback((trayIdx, slotIdx) => {
    if (!fig || placed.some(pl => pl.slot === slotIdx)) return false
    const piece = tray[trayIdx]
    // A piece fits a slot when it is the same kind of shape, the same size
    // and turned the same way — two identical circles are interchangeable,
    // which is intended.
    const slot = fig.parts[slotIdx]
    const sameShape = piece.shape === slot.shape
    const sameSize  = sameShape && piece.w === slot.w && piece.h === slot.h
    if (!sameSize || !sameTurn(slot.shape, rotOf(trayIdx), slot.rot)) {
      // It goes in, looking ridiculous; the customer laughs; then it pops
      // back out to the tray. Still a miss.
      if (stuck) return false
      misses.current++
      roundMisses.current++
      setStuck({ shape: piece.shape, x: slot.x, y: slot.y, w: slot.w, h: slot.h, rot: rotOf(trayIdx) + 20, color: piece.color, tray: trayIdx, n: Date.now() })
      setMood('oops', 700)
      sfx.boing()
      sayWrong()
      later(() => { setMood('happy', 900); sfx.giggle() }, 500)
      later(() => {
        setStuck(null)
        sfx.pop()
        setWrongSlot(slotIdx)
        if (sameSize) setTurnHint({ i: trayIdx, n: Date.now() })
      }, 850)
      later(() => setWrongSlot(null), 1700)
      return true
    }
    const next = [...placed, { slot: slotIdx, tray: trayIdx }]
    setPlaced(next)
    setTurnHint(null)
    sfx.pop()
    if (next.length < fig.parts.length) {
      setMood('wow', 700)
      return true
    }
    // the last piece: the thing comes alive, the customer cheers; a streak
    // of figures without a miss gets more confetti
    const s = roundMisses.current ? 0 : streak + 1
    setStreak(s)
    later(() => {
      sfx.tada()
      if (fig.alive.move === 'launch' || fig.alive.move === 'drive' || fig.alive.move === 'sail') sfx.whoosh()
      burst(boardRef.current, 'confetti', s >= 3 ? 30 : 16)
    }, 300)
    sfx.correct()
    sayRight()
    afterNarration(() => later(() => (last ? setLastDone(true) : setIdx(i => i + 1)), 0), { minMs: 3000 })
    return true
  }, [fig, placed, tray, turns, last, streak, stuck, burst, later, setMood]) // eslint-disable-line react-hooks/exhaustive-deps

  const turn = i => {
    setTurns(t => ({ ...t, [i]: (t[i] ?? 0) + 90 }))
    sfx.flip()
  }

  if (!fig) return null
  const filledSlots = new Set(placed.map(pl => pl.slot))
  const usedTiles   = new Set(placed.map(pl => pl.tray))
  const complete    = filledSlots.size === fig.parts.length
  const tile = 'clamp(68px,13vw,92px)'
  // on a phone the workbench takes the width; elsewhere a share of it
  const boardPx = Math.round(vw < 560 ? Math.min(320, vw - 76) : Math.min(330, Math.max(230, vw * 0.44)))

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(10px,2vw,22px) clamp(12px,3vw,28px)', gap: 'clamp(10px,2vw,18px)',
    }}>
      {bursts}
      {!freeMode && <HintHand from={trayRef} to={boardRef} delay={idx === 0 ? 2000 : 6000} active={!complete} />}
      <RoundTrail total={rounds.length} done={idx + (complete ? 1 : 0)} walker="🔨" goal="🏠" style={{ width: 'calc(100% - 60px)', maxWidth: 700 }} />
      {!freeMode && <Shelf figs={rounds.slice(0, lastDone ? rounds.length : idx)} total={rounds.length} />}

      {freeMode ? <FreeBuild onDone={finishLevel} /> : (
        <DragArea disabled={complete}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(8px,3vw,28px)', flexWrap: 'wrap' }}>
            {/* the customer, and what it would like */}
            <AnimatePresence mode="wait">
              <motion.div key={idx} initial={{ x: -120, opacity: 0 }} animate={{ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 18 } }}
                exit={{ x: 160, opacity: 0, transition: { duration: 0.25 } }} style={{ paddingTop: 70 }}>
                <Critter art={fig.customer} size={110} mood={mood} label="Kunde" style={{ opacity: complete ? 0 : 1, transition: 'opacity .4s .8s' }}
                  wish={<Art art={fig.icon} size={44} />} />
              </motion.div>
            </AnimatePresence>
            <div ref={boardRef} style={{ ...pxPanel, padding: 'clamp(8px,1.6vw,14px)', background: '#8A5A33' }}>
              <Board fig={fig} customer={fig.customer} rules={rules} filled={filledSlots} wrongSlot={wrongSlot} stuck={stuck} complete={complete}
                size={boardPx} onDrop={(piece, slot) => dropPiece(piece, slot)} />
            </div>
          </div>

          {/* Piece tray. Its place keeps one height all level long, and
              after the last figure the workshop shelf shows up in it: a
              growing page made the scaled game shrink at the very end. */}
          <div ref={trayRef} style={{ display: 'flex', gap: 'clamp(8px,2.5vw,16px)', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', alignContent: 'center', maxWidth: 720, minHeight: 150 }}>
            {lastDone ? (
              <motion.div key="end" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <div style={{ display: 'flex', gap: 14 }}>
                  <motion.button whileTap={{ scale: 0.94 }} onClick={() => setFreeMode(true)} aria-label="Frei bauen"
                    style={{ ...pxButton('gold'), padding: '6px 26px', minHeight: 58, fontSize: 28 }}>🧩</motion.button>
                  <motion.button whileTap={{ scale: 0.94 }} onClick={finishLevel} aria-label="Weiter"
                    style={{ ...pxButton('green'), color: INK, textShadow: 'none', padding: '6px 34px', minHeight: 58, fontSize: 28 }}>➡️</motion.button>
                </div>
              </motion.div>
            ) : tray.map((p, i) => {
              const used = usedTiles.has(i)
              return (
                <div key={`${idx}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, visibility: used || stuck?.tray === i ? 'hidden' : 'visible', opacity: complete ? 0.35 : 1, transition: 'opacity .4s' }}>
                  <Draggable id={`${idx}-${i}`} data={i} label={SHAPE[p.shape].name} disabled={used || complete}>
                    <div style={{ width: tile, height: tile, ...pxCard(), padding: 6, boxSizing: 'border-box' }}>
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                        <motion.g animate={{ rotate: rotOf(i) }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                          <ShapePath shape={p.shape}
                            x={(100 - p.dw) / 2} y={(100 - p.dh) / 2} w={p.dw} h={p.dh}
                            fill={p.color} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
                        </motion.g>
                      </svg>
                    </div>
                  </Draggable>
                  {rules.turn && (p.shape === 'circle' || p.shape === 'square') && <span aria-hidden="true" style={{ width: 48, height: 48 }} />}
                  {rules.turn && p.shape !== 'circle' && p.shape !== 'square' && (
                    <motion.button key={turnHint?.i === i ? turnHint.n : 'still'} whileTap={{ scale: 0.88, rotate: 90 }} onClick={() => turn(i)} disabled={used || complete}
                      animate={turnHint?.i === i && !reduceMotion() ? { scale: [1, 1.3, 1, 1.3, 1], rotate: [0, 40, 0, 40, 0] } : {}} transition={{ duration: 1.2 }}
                      aria-label={`${SHAPE[p.shape].name} drehen`}
                      style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--px-gold)', border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}`, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </motion.button>
                  )}
                </div>
              )
            })}
          </div>
        </DragArea>
      )}
    </div>
  )
}
