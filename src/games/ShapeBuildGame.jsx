import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { sayNumber } from '../tts.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts, useDragState } from '../components/play/index.js'
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
//
// `icon` is what the customer asks for, `face` where the finished thing gets
// its eyes ([x, y, scale]), `alive` how it moves then and who or what joins
// it (`extra` at `at`).
const FIGURES = [
  { name: 'Haus', g: 'n', icon: '🏠', face: [50, 66, 0.3], alive: { move: 'hop', extra: '🐦', at: [62, 10] }, parts: [
    { shape: 'triangle',  x: 22, y: 18, w: 56, h: 28, color: '#FF6B6B', part: 'das Dach' },    // Dach sitzt auf …
    { shape: 'square',    x: 30, y: 46, w: 40, h: 40, color: '#FFD93D', part: 'die Wand' }] }, // … der Wand ab y46
  { name: 'Baum', g: 'm', icon: '🌳', face: [50, 44, 0.28], alive: { move: 'sway', extra: '🍎', at: [34, 34] }, parts: [
    { shape: 'triangle',  x: 20, y: 14, w: 60, h: 48, color: '#6BCB77', part: 'die Krone' },   // Krone endet bei y62
    { shape: 'rectangle', x: 43, y: 62, w: 14, h: 26, color: '#8D6E63', part: 'der Stamm' }] },// Stamm beginnt dort
  { name: 'Boot', g: 'n', icon: '⛵', face: [50, 72, 0.18], alive: { move: 'sail', extra: '🌊', at: [50, 90] }, parts: [
    { shape: 'triangle',  x: 42, y: 16, w: 32, h: 46, color: '#FF9F43', part: 'das Segel' },   // Segel steht auf …
    { shape: 'rectangle', x: 16, y: 62, w: 68, h: 20, color: '#74B9FF', part: 'der Rumpf' }] },// … dem Rumpf
  { name: 'Kerze', g: 'f', icon: '🕯️', face: [50, 62, 0.14], alive: { move: 'hop', extra: '✨', at: [66, 10] }, parts: [
    { shape: 'triangle',  x: 42, y: 10, w: 16, h: 24, color: '#FF9F43', part: 'die Flamme' },  // Flamme genau so …
    { shape: 'rectangle', x: 42, y: 34, w: 16, h: 56, color: '#FFD93D', part: 'das Wachs' }] },// … breit wie die Kerze
  { name: 'Eis', g: 'n', icon: '🍦', face: [50, 36, 0.24], alive: { move: 'hop', extra: '✨', at: [70, 18] }, parts: [
    { shape: 'circle',    x: 34, y: 20, w: 32, h: 32, color: '#FD79A8', part: 'die Kugel' },   // Kugel in der Waffel
    { shape: 'triangle',  x: 38, y: 46, w: 24, h: 40, rot: 180, color: '#D9A066', part: 'die Waffel' }] },
  { name: 'Lolli', g: 'm', icon: '🍭', face: [50, 32, 0.34], alive: { move: 'spin' }, parts: [
    { shape: 'circle',    x: 28, y: 10, w: 44, h: 44, color: '#E84393', part: 'das Bonbon' },  // Bonbon auf …
    { shape: 'rectangle', x: 46, y: 54, w: 8,  h: 36, color: '#D9A066', part: 'der Stiel' }] },// … dem Stiel
  { name: 'Fahne', g: 'f', icon: '🚩', face: [52, 24, 0.18], alive: { move: 'sway', extra: '💨', at: [84, 20] }, parts: [
    { shape: 'rectangle', x: 24, y: 10, w: 8,  h: 80, color: '#8D6E63', part: 'die Stange' },  // Stange, an ihr …
    { shape: 'triangle',  x: 40, y: 4,  w: 30, h: 46, rot: 90, color: '#FF6B6B', part: 'die Fahne' }] }, // … das Tuch (Spitze nach rechts)
  { name: 'Schneemann', g: 'm', icon: '⛄', face: [50, 19, 0.17], alive: { move: 'hop', extra: '🎩', at: [50, 2] }, parts: [
    { shape: 'circle',    x: 39, y: 8,  w: 22, h: 22, color: '#EAF6FF', part: 'der Kopf' },          // drei Kugeln, jede
    { shape: 'circle',    x: 34, y: 28, w: 32, h: 32, color: '#CFE7FF', part: 'die mittlere Kugel' },// auf der nächsten
    { shape: 'circle',    x: 29, y: 54, w: 42, h: 42, color: '#AED4F7', part: 'die untere Kugel' }] },
  { name: 'Turm', g: 'm', icon: '🗼', face: [50, 76, 0.26], alive: { move: 'hop', extra: '🐦', at: [64, 4] }, parts: [
    { shape: 'triangle',  x: 30, y: 6,  w: 40, h: 28, color: '#FF6B6B', part: 'die Spitze' },  // Spitze  6–34
    { shape: 'square',    x: 38, y: 34, w: 24, h: 24, color: '#4AA3FF', part: 'das Fenster' }, // Mitte  34–58
    { shape: 'square',    x: 32, y: 58, w: 36, h: 36, color: '#B0BEC5', part: 'der Sockel' }] },// Sockel 58–94
  { name: 'Rakete', g: 'f', icon: '🚀', face: [50, 50, 0.16], alive: { move: 'launch', extra: '🔥', at: [50, 84] }, parts: [
    { shape: 'triangle',  x: 36, y: 6,  w: 28, h: 24, color: '#FF6B6B', part: 'die Spitze' },  // Spitze auf dem Rumpf
    { shape: 'rectangle', x: 40, y: 30, w: 20, h: 44, color: '#B0BEC5', part: 'der Rumpf' },
    // Flossen: rechtwinklig, die senkrechte Kante liegt am Rumpf (x 40 / 60),
    // die untere schließt mit ihm bei y 74 ab. Die linke ist dieselbe Form,
    // eine Dreivierteldrehung weiter.
    { shape: 'rtriangle', x: 20, y: 54, w: 20, h: 20, rot: 270, color: '#4AA3FF', part: 'eine Flosse' },
    { shape: 'rtriangle', x: 60, y: 54, w: 20, h: 20, color: '#4AA3FF', part: 'eine Flosse' }] },
  { name: 'Blume', g: 'f', icon: '🌸', face: [50, 36, 0.12], alive: { move: 'sway', extra: '🐝', at: [80, 12] }, parts: [
    // vier große Blütenblätter um eine deutlich kleinere Mitte
    { shape: 'circle',    x: 38, y: 5,  w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 19, y: 24, w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 57, y: 24, w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 38, y: 43, w: 24, h: 24, color: '#FD79A8', part: 'ein Blütenblatt' },
    { shape: 'circle',    x: 43, y: 29, w: 14, h: 14, color: '#FFD93D', part: 'die Mitte' },
    { shape: 'rectangle', x: 46, y: 67, w: 8,  h: 27, color: '#6BCB77', part: 'der Stiel' }] },// Stiel ab dem unteren Blatt
  { name: 'Zug', g: 'm', icon: '🚂', face: [70, 60, 0.18], alive: { move: 'drive', extra: '💨', at: [84, 34] }, parts: [
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
const PLURAL = { circle: 'Kreise', square: 'Quadrate', triangle: 'Dreiecke', rectangle: 'Rechtecke' }

function describeBuild(pieces) {
  const kind = p => (p.shape === 'rtriangle' ? 'triangle' : p.shape)
  const key = list => list.map(kind).sort().join()
  const mine = key(pieces)
  const known = FIGURES.find(f => key(f.parts) === mine)
  const counts = Object.entries(pieces.reduce((m, p) => ({ ...m, [kind(p)]: (m[kind(p)] ?? 0) + 1 }), {}))
    .map(([shape, n]) => (n === 1 ? `ein ${SHAPE[shape].name}` : `${sayNumber(n)} ${PLURAL[shape]}`))
  const list = counts.length < 2 ? counts[0] : `${counts.slice(0, -1).join(', ')} und ${counts[counts.length - 1]}`
  return known
    ? `Ich sehe ${list}. Ist das ${art(known, 'nom')} ${known.name}? Toll gebaut!`
    : `Ich sehe ${list}. Toll gebaut!`
}

const FREE_TASK = 'Jetzt darfst du frei bauen! Tippe auf eine Form und schieb sie hin, wo du willst.'

function FreeBuild({ onDone }) {
  const [pieces, setPieces] = useState([])
  const [done, setDone]     = useState(false)
  const svgRef = useRef(null)
  const drag   = useRef(null)    // { id, dx, dy, moved }

  useEffect(() => { sayTask(FREE_TASK) }, [])

  const toSvg = e => {
    const m = svgRef.current?.getScreenCTM()?.inverse()
    if (!m) return { x: 0, y: 0 }
    return { x: m.a * e.clientX + m.c * e.clientY + m.e, y: m.b * e.clientX + m.d * e.clientY + m.f }
  }

  const add = (f) => {
    if (done) return
    setPieces(list => [...list, { ...f, id: Date.now(), x: 50 - f.w / 2 + (list.length % 4) * 4, y: 40 - f.h / 2 + (list.length % 4) * 4, rot: 0, color: FREE_COLORS[list.length % FREE_COLORS.length] }])
    sfx.pop?.()
    narrate([{ text: `${SHAPE[f.shape].art} ${SHAPE[f.shape].name}.` }])
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
      sfx.flip?.()
    }
  }

  const finish = () => {
    if (!pieces.length || done) return
    setDone(true)
    sfx.correct()
    narrate([{ text: describeBuild(pieces) }], { onEnd: onDone })
  }

  return (
    <>
      <div style={{ ...pxPanel, padding: 'clamp(8px,2vw,16px)' }}>
        <svg ref={svgRef} viewBox="0 0 100 100" onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          style={{ width: 'clamp(220px,46vw,300px)', height: 'clamp(220px,46vw,300px)', display: 'block', touchAction: 'none' }}>
          {pieces.map(p => (
            <ShapePath key={p.id} {...p} fill={p.color} stroke={INK} strokeWidth={1.5} strokeLinejoin="round"
              onPointerDown={e => down(e, p)} style={{ cursor: done ? 'default' : 'grab' }} />
          ))}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 'clamp(8px,2.5vw,16px)', flexWrap: 'wrap', justifyContent: 'center' }}>
        {FREE_SHAPES.map((f, i) => (
          <motion.button key={f.shape} whileTap={{ scale: 0.93 }} onClick={() => add(f)} disabled={done}
            aria-label={`${SHAPE[f.shape].name} dazulegen`}
            style={{ width: 'clamp(64px,13vw,84px)', height: 'clamp(64px,13vw,84px)', ...pxCard(), cursor: 'pointer', padding: 6 }}>
            <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
              <ShapePath shape={f.shape} x={50 - f.w * 1.2} y={50 - f.h * 1.2} w={f.w * 2.4} h={f.h * 2.4}
                fill={FREE_COLORS[i]} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
            </svg>
          </motion.button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => setPieces(list => list.slice(0, -1))} disabled={!pieces.length || done}
          style={{ ...pxButton('parch'), padding: '10px 20px', fontSize: 17, opacity: pieces.length && !done ? 1 : 0.5 }}>
          🧽 Weg damit
        </button>
        <button onClick={finish} disabled={!pieces.length || done}
          style={{ ...pxButton('green'), color: INK, textShadow: 'none', padding: '10px 28px', fontSize: 17, opacity: pieces.length && !done ? 1 : 0.5 }}>
          ✅ Fertig
        </button>
      </div>
    </>
  )
}

const sayShape = p => `${SHAPE[p.shape].art} ${SHAPE[p.shape].name}`
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
function Board({ fig, rules, filled, wrongSlot, complete, onDrop, size }) {
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
          transition={{ duration: fig.alive.move === 'spin' ? 0.9 : 1.2, delay: 0.3 }}
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
      </svg>
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
  const [bursts, burst] = useBursts()
  const misses = useRef(0)
  const timer  = useRef(null)
  const boardRef = useRef(null)
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
    const k = 84 / maxDim
    return shuffle(pieces.map(p => ({
      ...p,
      // drawn size inside the 100-unit tile, kept proportional to the real
      // piece; a floor of 12 keeps a thin stem visible without faking its size
      dw: Math.max(12, p.w * k), dh: Math.max(12, p.h * k),
    })))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const rotOf = i => (tray[i]?.rot ?? 0) + (turns[i] ?? 0)

  const speakTask = useCallback(() => {
    if (freeMode) { sayTask(FREE_TASK); return }
    const extra = idx > 0 ? ''
      : rules.turn ? ' Tippe auf den Pfeil, dann dreht sich ein Teil.'
      : rules.distractor ? ' Ein Teil gehört nicht dazu.' : ''
    sayTask(`Baue ${art(fig, 'akk')} ${fig.name}! Zieh die Formen in das Bild.${extra}`)
  }, [idx, fig, freeMode, rules.turn, rules.distractor])

  useEffect(() => {
    if (!fig) return
    setPlaced([]); setTurns({}); setWrongSlot(null)
    lockPreviews()
    const id = setTimeout(speakTask, 650)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(timer.current), [])

  const last = idx + 1 >= rounds.length
  // every piece is one task; a piece that first went to a wrong place does
  // not count as right on the first try. Free building is a bonus, not rated.
  const finishLevel = useCallback(() => {
    sfx.complete()
    afterNarration(() => onComplete(result(totalParts - misses.current, totalParts)), { minMs: 300 })
  }, [onComplete, totalParts])

  // A piece let go over a place: it snaps in, or it is handed back with a word
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
      const s = SHAPE[piece.shape]
      // Right kind of shape, wrong size (the snowman's three circles) is a
      // different mistake from the wrong shape entirely — say which one it is,
      // so the child learns that size is part of "fitting".
      const msg = sameSize
        ? 'Die Form passt, aber sie liegt falsch herum. Tippe auf den Pfeil, dann dreht sie sich.'
        : sameShape
          ? `${s.art} ${s.name} ist zu ${piece.w * piece.h > slot.w * slot.h ? 'groß' : 'klein'} für diesen Platz.`
          : `${s.art} ${s.name} passt da nicht.`
      setWrongSlot(slotIdx)
      misses.current++
      setMood('oops')
      sayWrong(msg)
      timer.current = setTimeout(() => setWrongSlot(null), 900)
      return false
    }
    const next = [...placed, { slot: slotIdx, tray: trayIdx }]
    setPlaced(next)
    sfx.pop()
    if (next.length < fig.parts.length) {
      setMood('wow', 700)
      narrate([{ text: `${sayShape(piece)} ist ${slot.part}!` }])
      return true
    }
    // the last piece: the thing comes alive, the customer cheers
    timer.current = setTimeout(() => {
      sfx.tada()
      if (fig.alive.move === 'launch' || fig.alive.move === 'drive' || fig.alive.move === 'sail') sfx.whoosh()
      setMood('dance', 2600)
      burst(boardRef.current, 'confetti', 16)
    }, 300)
    sfx.correct()
    sayRight(`${sayShape(piece)} ist ${slot.part}. Das ist ${art(fig, 'nom')} ${fig.name}.${last ? ' Willst du jetzt noch frei bauen?' : ''}`, {
      onEnd: () => {
        if (last) { setLastDone(true); return }
        const go = () => { timer.current = setTimeout(() => (pausedRef.current ? go() : setIdx(i => i + 1)), 700) }
        go()
      },
    })
    return true
  }, [fig, placed, tray, turns, last, burst, setMood]) // eslint-disable-line react-hooks/exhaustive-deps

  const turn = i => {
    setTurns(t => ({ ...t, [i]: (t[i] ?? 0) + 90 }))
    sfx.flip()
  }

  if (!fig) return null
  const filledSlots = new Set(placed.map(pl => pl.slot))
  const usedTiles   = new Set(placed.map(pl => pl.tray))
  const complete    = filledSlots.size === fig.parts.length
  const tile = 'clamp(68px,13vw,92px)'
  const boardPx = Math.round(Math.min(330, Math.max(230, vw * 0.44)))

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(10px,2vw,22px) clamp(12px,3vw,28px)', gap: 'clamp(10px,2vw,18px)',
    }}>
      {bursts}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 720 }}>
        <RoundTrail total={rounds.length} done={idx + (complete ? 1 : 0)} walker="🔨" goal="🏠" style={{ flex: 1 }} />
        <motion.button whileTap={{ scale: 0.9 }} onClick={speakTask} aria-label="Aufgabe noch einmal hören"
          style={{
            width: 52, height: 52, flexShrink: 0, background: 'var(--px-gold)', border: `3px solid ${INK}`, borderRadius: 12,
            boxShadow: `inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -5px 0 rgba(0,0,0,0.2), 0 4px 0 ${INK}`,
            cursor: 'pointer', fontSize: 26, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>🔊</motion.button>
      </div>

      {freeMode ? <FreeBuild onDone={finishLevel} /> : (
        <DragArea disabled={complete}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(8px,3vw,28px)', flexWrap: 'wrap' }}>
            {/* the customer, and what it would like */}
            <AnimatePresence mode="wait">
              <motion.div key={idx} initial={{ x: -120, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 160, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 200, damping: 18 }} style={{ paddingTop: 70 }}>
                <Critter art={fig.customer} size={110} mood={mood} talks label="Kunde"
                  wish={<Art art={fig.icon} size={44} />} />
              </motion.div>
            </AnimatePresence>
            <div ref={boardRef} style={{ ...pxPanel, padding: 'clamp(8px,1.6vw,14px)', background: '#8A5A33' }}>
              <Board fig={fig} rules={rules} filled={filledSlots} wrongSlot={wrongSlot} complete={complete}
                size={boardPx} onDrop={(piece, slot) => dropPiece(piece, slot)} />
            </div>
          </div>

          {/* Piece tray */}
          <div style={{ display: 'flex', gap: 'clamp(8px,2.5vw,16px)', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 720, minHeight: 100 }}>
            {tray.map((p, i) => {
              const used = usedTiles.has(i)
              return (
                <div key={`${idx}-${i}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, visibility: used ? 'hidden' : 'visible', opacity: complete ? 0.35 : 1, transition: 'opacity .4s' }}>
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
                  {rules.turn && p.shape !== 'circle' && p.shape !== 'square' && (
                    <motion.button whileTap={{ scale: 0.88, rotate: 90 }} onClick={() => turn(i)} disabled={used || complete}
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

      {/* After the last figure: build freely, or finish */}
      <AnimatePresence>
        {lastDone && !freeMode && (
          <motion.div key="end" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
            <motion.button whileTap={{ scale: 0.94 }} onClick={() => setFreeMode(true)}
              style={{ ...pxButton('gold'), padding: '12px 28px', fontSize: 'clamp(16px,3.4vw,21px)' }}>🧩 Frei bauen</motion.button>
            <motion.button whileTap={{ scale: 0.94 }} onClick={finishLevel} aria-label="Weiter"
              style={{ ...pxButton('green'), color: INK, textShadow: 'none', padding: '12px 40px', fontSize: 'clamp(16px,3.4vw,21px)' }}>Weiter! →</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
