import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { sfx } from '../sfx.js'
import { afterNarration, lockPreviews, narrate } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { LINES, line } from '../lib/lumiLines.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts, useDragState, useJuice } from '../components/play/index.js'
import { pxCard, pxPanel, pxButton, INK } from './px.js'
import { useBox, isUpright, isFlat } from './useBox.js'

/**
 * Formen-Werkstatt — aus Formen ein Bild zusammensetzen
 *
 * An animal comes into the workshop and wants something: a boat, a house,
 * a rocket (Lumi names it). The child drags the shapes into the outline on
 * the workbench. Held over a place, a piece shows its ghost there: it fits,
 * or it is plainly too big, too small or the wrong way round. A piece that
 * fits snaps in with a click and a little shake, and a star flies to the
 * counter (components/play/Juice.jsx). When the last piece is in, the
 * thing does what it does, each in its own way: the boat sails off and
 * comes back, the rocket shakes and lifts off, the pencil scribbles, the
 * bus drives a round with the customer on board. Then it goes on the
 * workshop shelf. After the last wish the bench is free for a moment: the
 * child builds what it likes, and the level ends by itself.
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
 *
 * The game lays itself out from the room it really has (useBox.js): stacked
 * on a tablet and an upright phone, side by side on a phone held sideways.
 */

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

// Every figure is a small list of parts: the outline the child fills.
//
// The parts meet exactly: the roof's edge lies on the wall, the trunk
// starts where the crown ends, the wheels sit on the lower edge of the bus.
//
// `icon` is what the customer wishes for, and it shows what is built: a
// fir tree for a triangle on a trunk, a pencil for a rectangle with a tip, a
// bus for a box on two wheels. (A candle was wished and a pencil built, a
// lattice tower wished and a house with a roof built, a leafy tree wished
// and a fir built.) `word`: Lumi's recording of its name (lib/lumiLines.js,
// wort/…). `face`: where the finished thing gets eyes ([x, y, scale]).
// `alive`: what it does then (see ALIVE) and who or what joins it (`extra`
// at `at`; `rides`: it goes along, `orbit`: it circles). `use`: where the
// customer uses its thing, with the foot point [x, y] and a mood. `window`:
// a round window [x, y, r] for the customer to look out of.
const FIGURES = [
  { name: 'Haus', icon: '🏠', word: 'haus', face: [50, 66, 0.3], alive: { move: 'hop', extra: '🐦', at: [62, 10] }, use: [50, 86, 'happy'], parts: [
    { shape: 'triangle',  x: 22, y: 18, w: 56, h: 28, color: '#FF6B6B' },    // the roof sits on …
    { shape: 'square',    x: 30, y: 46, w: 40, h: 40, color: '#FFD93D' }] }, // … the wall from y 46
  { name: 'Tanne', icon: '🌲', word: 'baum', face: [50, 44, 0.28], alive: { move: 'sway', extra: '🐿️', at: [68, 54] }, use: [22, 90, 'happy'], parts: [
    { shape: 'triangle',  x: 20, y: 14, w: 60, h: 48, color: '#6BCB77' },   // the crown ends at y 62
    { shape: 'rectangle', x: 43, y: 62, w: 14, h: 26, color: '#8D6E63' }] },// the trunk starts there
  { name: 'Boot', icon: '⛵', word: 'boot', face: [50, 72, 0.18], alive: { move: 'sail', extra: '🌊', at: [50, 92] }, use: [30, 62, 'happy'], parts: [
    { shape: 'triangle',  x: 42, y: 16, w: 32, h: 46, color: '#FF9F43' },   // the sail stands on …
    { shape: 'rectangle', x: 16, y: 62, w: 68, h: 20, color: '#74B9FF' }] },// … the hull
  { name: 'Stift', icon: '✏️', word: 'stift', face: [50, 34, 0.14], alive: { move: 'scribble' }, use: [84, 96, 'happy'], parts: [
    { shape: 'rectangle', x: 42, y: 8,  w: 16, h: 54, color: '#FFD93D' },   // the pencil and …
    { shape: 'triangle',  x: 42, y: 62, w: 16, h: 22, rot: 180, color: '#D9A066' }] }, // … its tip, down on the paper
  { name: 'Eis', icon: '🍦', word: 'eis', face: [50, 36, 0.24], alive: { move: 'wobble', extra: '✨', at: [70, 18] }, use: [76, 60, 'eat'], parts: [
    { shape: 'circle',    x: 34, y: 20, w: 32, h: 32, color: '#FD79A8' },   // the scoop in the cone
    { shape: 'triangle',  x: 38, y: 46, w: 24, h: 40, rot: 180, color: '#D9A066' }] },
  { name: 'Lolli', icon: '🍭', face: [50, 32, 0.34], alive: { move: 'spin' }, use: [80, 60, 'eat'], swirl: true, parts: [
    { shape: 'circle',    x: 28, y: 10, w: 44, h: 44, color: '#E84393' },  // the sweet on …
    { shape: 'rectangle', x: 46, y: 54, w: 8,  h: 36, color: '#D9A066' }] },// … its stick
  { name: 'Fahne', icon: '🚩', word: 'fahne', face: [52, 24, 0.18], alive: { move: 'flutter', extra: '💨', at: [86, 22] }, use: [62, 92, 'happy'], parts: [
    { shape: 'rectangle', x: 24, y: 10, w: 8,  h: 80, color: '#8D6E63' },  // the pole, and on it …
    { shape: 'triangle',  x: 40, y: 4,  w: 30, h: 46, rot: 90, color: '#FF6B6B' }] }, // … the cloth (pointing right)
  { name: 'Schneemann', icon: '⛄', word: 'schneemann', face: [50, 19, 0.17], alive: { move: 'hop', extra: '🎩', at: [50, 2], snow: true }, use: [82, 96, 'happy'], parts: [
    { shape: 'circle',    x: 39, y: 8,  w: 22, h: 22, color: '#EAF6FF' },          // three balls, each
    { shape: 'circle',    x: 34, y: 28, w: 32, h: 32, color: '#CFE7FF' },          // on the next
    { shape: 'circle',    x: 29, y: 54, w: 42, h: 42, color: '#AED4F7' }] },
  { name: 'Bus', icon: '🚌', word: 'bus', face: [56, 50, 0.2], alive: { move: 'drive' }, use: [30, 32, 'happy'], parts: [
    { shape: 'rectangle', x: 12, y: 32, w: 76, h: 40, color: '#FFD93D' },   // a box …
    { shape: 'circle',    x: 22, y: 64, w: 20, h: 20, color: '#444' },      // … on two wheels
    { shape: 'circle',    x: 60, y: 64, w: 20, h: 20, color: '#444' }] },
  { name: 'Rakete', icon: '🚀', word: 'rakete', face: [50, 62, 0.15], window: [50, 40, 9], alive: { move: 'launch', extra: '🔥', at: [50, 84], rides: true }, use: [50, 48, 'happy'], parts: [
    { shape: 'triangle',  x: 36, y: 6,  w: 28, h: 24, color: '#FF6B6B' },  // the nose on the hull
    { shape: 'rectangle', x: 40, y: 30, w: 20, h: 44, color: '#B0BEC5' },
    // The fins: right-angled, the upright side on the hull (x 40 / 60), the
    // lower one flush with it at y 74. The left one is the same shape, three
    // quarter turns on.
    { shape: 'rtriangle', x: 20, y: 54, w: 20, h: 20, rot: 270, color: '#4AA3FF' },
    { shape: 'rtriangle', x: 60, y: 54, w: 20, h: 20, color: '#4AA3FF' }] },
  { name: 'Blume', icon: '🌸', word: 'blume', face: [50, 36, 0.12], alive: { move: 'bloom', extra: '🐝', at: [50, 36], orbit: true }, use: [78, 94, 'happy'], parts: [
    // four big petals around a clearly smaller middle
    { shape: 'circle',    x: 38, y: 5,  w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 19, y: 24, w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 57, y: 24, w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 38, y: 43, w: 24, h: 24, color: '#FD79A8' },
    { shape: 'circle',    x: 43, y: 29, w: 14, h: 14, color: '#FFD93D' },
    { shape: 'rectangle', x: 46, y: 67, w: 8,  h: 27, color: '#6BCB77' }] },// the stem from the lower petal
  { name: 'Zug', icon: '🚂', word: 'zug', face: [70, 60, 0.18], alive: { move: 'chug', extra: '💨', at: [70, 34], rides: true }, use: [34, 44, 'happy'], parts: [
    { shape: 'rectangle', x: 12, y: 44, w: 46, h: 28, color: '#74B9FF' },   // the wagon 12–58
    { shape: 'square',    x: 58, y: 48, w: 24, h: 24, color: '#FF9F43' },   // the engine joins at 58
    { shape: 'circle',    x: 18, y: 72, w: 16, h: 16, color: '#444' },      // wheels on the
    { shape: 'circle',    x: 62, y: 72, w: 16, h: 16, color: '#444' }] },   // lower edge y 72
]

// Lumi names the wish ("Haus."): only where the word is recorded
const wishWord = fig => (fig.word && LINES[`wort/${fig.word}`] ? line(`wort/${fig.word}`) : null)

// What each level asks for, on top of more parts:
//   1–3 two-part figures · 4–5 up to three parts and one piece that does not
//   belong · 6–7 pieces come turned and are turned with their button ·
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

const CUSTOMERS = ['🐰', '🐻', '🐸', '🐱', '🐶', '🐭', '🐷', '🦔']

// ── What a finished thing does ───────────────────────────────────────────────
// In board units (the bench is 100 wide). OUT is out of sight: the bench
// clips what leaves it, so the boat sails out at one side and comes back in
// at the other. `carries`: the customer rides along. `turn`: about the
// middle, not the foot.
const OUT = 126
const ALIVE = {
  hop:      { anim: { y: [0, -22, 0, -10, 0], scaleY: [1, 1.06, 0.94, 1.03, 1] }, dur: 1.2 },
  sway:     { anim: { rotate: [0, -7, 6, -4, 0] }, dur: 1.4 },
  flutter:  { anim: { rotate: [0, 4, -3, 4, -3, 2, 0], x: [0, 2, -1, 2, -1, 1, 0] }, dur: 1.3 },
  wobble:   { anim: { scaleX: [1, 1.14, 0.9, 1.07, 1], scaleY: [1, 0.88, 1.1, 0.95, 1] }, dur: 1.1 },
  bloom:    { anim: { scale: [1, 1.14, 1, 1.1, 1] }, dur: 1.4, turn: true },
  spin:     { anim: { rotate: [0, 720] }, dur: 1.5, turn: true },
  scribble: { anim: { x: [0, -28, 28, 0], y: [0, 4, 4, 0] }, times: [0, 0.2, 0.8, 1], dur: 2 },
  sail:     { anim: { x: [0, OUT, -OUT, 0], rotate: [0, 6, -6, 0] }, times: [0, 0.46, 0.46, 1], dur: 2.8, carries: true },
  drive:    { anim: { x: [0, -5, OUT, -OUT, 0] }, times: [0, 0.12, 0.5, 0.5, 1], dur: 2.4, carries: true },
  chug:     { anim: { x: [0, 3, 0, 3, OUT, -OUT, 0], y: [0, -1.5, 0, -1.5, 0, 0, 0] }, times: [0, 0.08, 0.16, 0.24, 0.56, 0.56, 1], dur: 2.8, carries: true },
  launch:   { anim: { y: [0, 2, -2, 2, -2, -OUT, -OUT, 0], x: [0, -1.5, 1.5, -1.5, 1.5, 0, 0, 0] }, times: [0, 0.07, 0.14, 0.21, 0.28, 0.6, 0.64, 1], dur: 3, carries: true },
}
// it starts once the customer has got in
const aliveDelay = move => (ALIVE[move].carries ? 1 : 0.3)
const aliveMs = move => (aliveDelay(move) + ALIVE[move].dur) * 1000
const aliveTransition = move => ({ duration: ALIVE[move].dur, delay: aliveDelay(move), times: ALIVE[move].times, ease: 'easeInOut' })

// The same journey for whoever rides along, in pixels
const riding = (move, size) => {
  const a = ALIVE[move].anim
  return { x: (a.x ?? [0]).map(v => v * size / 100), y: (a.y ?? [0]).map(v => v * size / 100) }
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

// The blueprint paper of the workbench
function Paper() {
  return (
    <>
      <rect x="-4" y="-4" width="108" height="108" rx="8" fill="#DCEBFA" stroke={INK} strokeWidth="1.6" />
      {Array.from({ length: 9 }, (_, i) => <path key={i} d={`M${(i + 1) * 10} -4 V104 M-4 ${(i + 1) * 10} H104`} stroke="#B7D2EE" strokeWidth="0.5" />)}
    </>
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

// The workbench: the outline to fill, one drop place per part.
// `held`: the tray piece a finger is carrying (see the tray).
function Board({ fig, customer, rules, filled, wrongSlot, stuck, complete, held, onDrop, size, innerRef }) {
  const { hover, picked } = useDragState()
  const zones = fig.parts.map((p, i) => ({ i, box: slotBox(p) }))
    .filter(z => !filled.has(z.i))
    .sort((a, b) => b.box.w * b.box.h - a.box.w * a.box.h)   // small places on top
  const move = fig.alive.move
  const moving = complete && !reduceMotion()
  // The ghost: the piece that is held, drawn where it would land, as big
  // and turned as it is. In its place it fills the outline; anywhere else
  // it is plainly too big, too small or the wrong way round.
  const over = typeof hover === 'string' && hover.startsWith('slot') ? Number(hover.slice(4)) : null
  const ghost = over != null && held && !filled.has(over) ? { slot: fig.parts[over], piece: held } : null
  return (
    <div ref={innerRef} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
        <defs><clipPath id="sb-bench"><rect x="-3" y="-3" width="106" height="106" rx="7" /></clipPath></defs>
        <Paper />
        <g clipPath="url(#sb-bench)">
          {/* the pencil's scribble stays on the paper */}
          {complete && move === 'scribble' && (
            <motion.path d="M22 92 q5 -9 10 0 t10 0 t10 0 t10 0 t10 0 q3 -5 6 -3" fill="none" stroke="#E84393" strokeWidth="2.4" strokeLinecap="round"
              initial={{ pathLength: reduceMotion() ? 1 : 0 }} animate={{ pathLength: 1 }}
              transition={{ duration: ALIVE.scribble.dur * 0.6, delay: aliveDelay(move) + ALIVE.scribble.dur * 0.2, ease: 'linear' }} />
          )}
          <motion.g initial={false}
            animate={moving ? ALIVE[move].anim : { x: 0, y: 0, rotate: 0, scale: 1, scaleX: 1, scaleY: 1 }}
            transition={moving ? aliveTransition(move) : { duration: 0 }}
            style={{ originX: 0.5, originY: ALIVE[move].turn ? 0.5 : 1 }}>
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
            {ghost && (
              <ShapePath shape={ghost.piece.shape} rot={ghost.piece.rot} w={ghost.piece.w} h={ghost.piece.h}
                x={ghost.slot.x + ghost.slot.w / 2 - ghost.piece.w / 2} y={ghost.slot.y + ghost.slot.h / 2 - ghost.piece.h / 2}
                fill={ghost.piece.color} fillOpacity={0.5} stroke={INK} strokeOpacity={0.6} strokeWidth={1.4} strokeLinejoin="round" pointerEvents="none" />
            )}
            {/* the sweet's swirl: without it nobody sees that it spins */}
            {complete && fig.swirl && <path d="M50 32 a4 4 0 0 1 0 8 a8 8 0 0 1 0 -16 a12 12 0 0 1 0 24 a16 16 0 0 1 0 -32" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.85" />}
            {complete && fig.window && <circle cx={fig.window[0]} cy={fig.window[1]} r={fig.window[2]} fill="#DCEBFA" stroke={INK} strokeWidth="1.6" />}
            {complete && <Face x={fig.face[0]} y={fig.face[1]} s={fig.face[2]} />}
          </motion.g>
        </g>
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
      {/* whoever is on the bench with the thing: clipped like the thing itself */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -size * 0.03, top: -size * 0.03, width: size * 1.06, height: size * 1.06, overflow: 'hidden', borderRadius: size * 0.07, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: size * 0.03, top: size * 0.03, width: size, height: size }}>
          {/* the customer gets in or tucks in, and goes along */}
          <AnimatePresence>
            {complete && (
              <motion.div key="user" initial={{ opacity: 0, scale: 0.3, y: -size * 0.3 }}
                animate={{ opacity: 1, scale: 1, y: 0 }} transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 14 }}
                style={{ position: 'absolute', left: `${fig.use[0]}%`, top: `${fig.use[1]}%`, width: 0, height: 0, zIndex: 2 }}>
                <motion.div animate={moving && ALIVE[move].carries ? riding(move, size) : {}} transition={aliveTransition(move)}
                  style={{ position: 'absolute', left: -size * (fig.window ? 0.07 : 0.11), bottom: 0 }}>
                  <Critter art={customer} size={size * (fig.window ? 0.14 : 0.22)} mood={fig.use[2]} shadow={false} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* who or what joins the living thing */}
          <AnimatePresence>
            {complete && fig.alive.extra && (
              <motion.div key="extra" initial={{ scale: 0, y: -30, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
                transition={{ delay: 0.6, type: 'spring', stiffness: 300, damping: 14 }}
                style={{ position: 'absolute', left: `${fig.alive.at[0]}%`, top: `${fig.alive.at[1]}%`, marginLeft: -size * 0.09, marginTop: -size * 0.09 }}>
                <motion.div
                  animate={!moving ? {}
                    : fig.alive.rides ? riding(move, size)
                    : fig.alive.orbit ? { x: [0, 30, 0, -30, 0].map(v => v * size / 100), y: [-30, 0, 30, 0, -30].map(v => v * size / 100) }
                    : {}}
                  transition={fig.alive.orbit ? { duration: 1.6, delay: 0.7, ease: 'linear' } : aliveTransition(move)}>
                  <Art art={fig.alive.extra} size={size * 0.18} />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {/* snow for the snowman */}
          {complete && fig.alive.snow && !reduceMotion() && [14, 30, 70, 86, 50].map((x, i) => (
            <motion.div key={x} initial={{ y: -size * 0.12, opacity: 0 }} animate={{ y: size * 1.05, opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.8, delay: 0.3 + i * 0.22, ease: 'linear' }}
              style={{ position: 'absolute', left: `${x}%`, top: 0, marginLeft: -size * 0.04 }}>
              <Art art="❄️" size={size * 0.08} />
            </motion.div>
          ))}
        </div>
      </div>
      {/* the places, as drop targets over the drawing; a piece held near
          one already shows its ghost there */}
      {zones.map(({ i, box }) => (
        <DropZone key={i} id={`slot${i}`} slop={Math.round(size * 0.05)} label={`Platz ${i + 1}`} onDrop={piece => onDrop(piece, i)}
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

// The wall shelf of the workshop: one place for every wish of the level,
// and every finished thing lands on its place (it flies up from the
// workbench, shrinking), so the workshop fills up
function Shelf({ figs, total, mini }) {
  return (
    <div aria-hidden="true" style={{ position: 'relative', flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 4, padding: '0 10px' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 9, borderRadius: 4, background: '#8A5A33', border: `2px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.25)' }} />
      {Array.from({ length: total }, (_, n) => (
        <div key={n} style={{ position: 'relative', width: mini + 2, height: mini, marginBottom: 9, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          {/* its place, still free */}
          {!figs[n] && <div style={{ position: 'absolute', left: '18%', right: '18%', bottom: 2, height: '58%', borderRadius: 8, border: '2px dashed rgba(42,27,61,0.28)' }} />}
          {figs[n] && (
            <motion.div initial={reduceMotion() ? false : { y: 240, scale: 3.2, opacity: 0.4 }} animate={{ y: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}>
              <MiniFigure fig={figs[n]} size={mini} />
            </motion.div>
          )}
        </div>
      ))}
    </div>
  )
}

// ── The bonus: the bench is free ─────────────────────────────────────────────
// After the last wish the child builds what it likes: a tap on a shape puts
// it on the bench, a finger moves it, a tap on it turns it. No words and no
// question: the hand shows the first tap. It ends by itself: with the green
// tick, or when the child has stopped for a while (the ring round the tick
// runs out) — then what was built gets a face and hops, and the level is
// over. Nothing here is rated.
const FREE_SHAPES = [
  { shape: 'circle',    w: 24, h: 24, color: '#FF6B6B' },
  { shape: 'square',    w: 24, h: 24, color: '#FFD93D' },
  { shape: 'triangle',  w: 30, h: 24, color: '#6BCB77' },
  { shape: 'rectangle', w: 34, h: 14, color: '#4AA3FF' },
]
const QUIET_MS = 9000        // with something built: this long without a touch, and it is done
const QUIET_EMPTY_MS = 7000  // nothing built: the child does not want to
const HURRY_MS = 4000        // the ring runs for the last seconds

function FreeBuild({ size, tile, row, onDone, hit, burst }) {
  const [pieces, setPieces] = useState([])
  const [done, setDone]     = useState(false)
  const [hurry, setHurry]   = useState(false)
  const paused = usePaused()
  const svgRef = useRef(null)
  const drag   = useRef(null)    // { id, dx, dy, moved }
  const firstRef = useRef(null), doneRef = useRef(null)
  const live = useRef({ pieces, paused, done })
  live.current = { pieces, paused, done }

  const toSvg = e => {
    const m = svgRef.current?.getScreenCTM()?.inverse()
    if (!m) return { x: 0, y: 0 }
    return { x: m.a * e.clientX + m.c * e.clientY + m.e, y: m.b * e.clientX + m.d * e.clientY + m.f }
  }

  // the piece is the colour of its button
  const add = (f) => {
    if (done) return
    setPieces(list => [...list, { ...f, id: Date.now(), x: 50 - f.w / 2 + (list.length % 4) * 5 - 8, y: 44 - f.h / 2 + (list.length % 4) * 5 - 8, rot: 0 }])
    sfx.pop()
  }

  const down = (e, p) => {
    if (done) return
    e.stopPropagation()
    const pt = toSvg(e)
    drag.current = { id: p.id, dx: pt.x - p.x, dy: pt.y - p.y, x0: pt.x, y0: pt.y, moved: false }
    try { svgRef.current.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    // the one that is touched comes to the front
    setPieces(list => [...list.filter(q => q.id !== p.id), ...list.filter(q => q.id === p.id)])
  }
  const move = e => {
    const d = drag.current
    if (!d) return
    const pt = toSvg(e)
    // a finger never holds perfectly still: only a real move is a move
    if (!d.moved && Math.hypot(pt.x - d.x0, pt.y - d.y0) < 2.5) return
    d.moved = true
    setPieces(list => list.map(p => (p.id === d.id
      ? { ...p, x: clamp(pt.x - d.dx, -p.w / 2, 100 - p.w / 2), y: clamp(pt.y - d.dy, -p.h / 2, 100 - p.h / 2) }
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

  // What was built comes alive like every other thing here, then the results
  const finish = useCallback(() => {
    const { pieces: built, done: over } = live.current
    if (over) return
    setDone(true)
    setHurry(false)
    if (!built.length) { onDone(); return }
    sfx.tada()
    burst(svgRef.current, 'confetti', 18)
    hit(svgRef.current, { stars: Math.min(built.length, 5) })
    afterNarration(onDone, { minMs: 2400 })
  }, [onDone, burst, hit])

  // It ends by itself once the child has stopped. The clock stands while
  // the help is open or a piece is being moved.
  useEffect(() => {
    if (done) return undefined
    let last = performance.now()
    const touch = () => { last = performance.now(); setHurry(false) }
    window.addEventListener('pointerdown', touch, true)
    window.addEventListener('keydown', touch, true)
    const id = setInterval(() => {
      if (live.current.paused || drag.current) { last = performance.now(); return }
      const quiet = performance.now() - last
      const limit = live.current.pieces.length ? QUIET_MS : QUIET_EMPTY_MS
      if (quiet >= limit) finish()
      else if (quiet >= limit - HURRY_MS) setHurry(true)
    }, 250)
    return () => { clearInterval(id); window.removeEventListener('pointerdown', touch, true); window.removeEventListener('keydown', touch, true) }
  }, [done, finish])

  // the face sits on the piece that lies on top, where nothing hides it
  const big = pieces[pieces.length - 1] ?? null
  const btn = Math.round(tile * 0.86)
  return (
    <>
      {/* no words: the hand taps the first shape for you */}
      <HintHand to={pieces.length ? doneRef : firstRef} delay={pieces.length ? 5000 : 1500} active={!done && !paused} />
      <div style={{ ...pxPanel, padding: Math.round(size * 0.04), background: '#8A5A33', flexShrink: 0 }}>
        <svg ref={svgRef} viewBox="0 0 100 100" width={size} height={size} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
          role="group" aria-label="Freie Werkbank" style={{ display: 'block', touchAction: 'none', overflow: 'visible' }}>
          <Paper />
          <motion.g animate={done && pieces.length && !reduceMotion() ? ALIVE.hop.anim : { y: 0, scaleY: 1 }} transition={{ duration: 1.2, delay: 0.2 }} style={{ originX: 0.5, originY: 1 }}>
            {pieces.map(p => (
              <ShapePath key={p.id} {...p} fill={p.color} stroke={INK} strokeWidth={1.5} strokeLinejoin="round"
                onPointerDown={e => down(e, p)} style={{ cursor: done ? 'default' : 'grab' }} />
            ))}
            {done && big && <Face x={big.x + big.w / 2} y={big.y + big.h / 2} s={Math.max(0.12, Math.min(big.w, big.h) / 100 * 0.8)} />}
          </motion.g>
        </svg>
      </div>
      <div style={{ display: 'flex', flexDirection: row ? 'column' : 'row', flexWrap: row ? 'nowrap' : 'wrap', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', maxWidth: row ? tile * 2 + 12 : undefined }}>
          {FREE_SHAPES.map((f, i) => (
            <motion.button key={f.shape} ref={i === 0 ? firstRef : undefined} whileTap={{ scale: 0.9 }} onClick={() => add(f)} disabled={done}
              aria-label={`${SHAPE[f.shape].name} dazulegen`}
              style={{ width: tile, height: tile, ...pxCard(), cursor: 'pointer', padding: 6, boxSizing: 'border-box' }}>
              <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
                <ShapePath shape={f.shape} x={50 - f.w * 1.2} y={50 - f.h * 1.2} w={f.w * 2.4} h={f.h * 2.4}
                  fill={f.color} stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
              </svg>
            </motion.button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          {/* one step back */}
          <button onClick={() => { setPieces(list => list.slice(0, -1)); sfx.whoosh() }} disabled={!pieces.length || done} aria-label="Letztes Teil wegnehmen"
            style={{ ...pxButton('parch'), width: btn, height: btn, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: pieces.length && !done ? 1 : 0.4 }}>
            <svg width={btn * 0.5} height={btn * 0.5} viewBox="0 0 24 24" aria-hidden="true"><path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12" transform="translate(0 -3)" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
          {/* done: the green tick. In the last seconds its ring runs out. */}
          <motion.button ref={doneRef} onClick={finish} disabled={done} aria-label="Fertig"
            animate={hurry && !reduceMotion() ? { scale: [1, 1.1, 1] } : { scale: 1 }} transition={hurry ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
            style={{ ...pxButton('green'), position: 'relative', width: btn * 1.3, height: btn, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: done ? 0.5 : 1 }}>
            <svg width={btn * 0.55} height={btn * 0.55} viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            {hurry && (
              <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: -9, width: 'calc(100% + 18px)', height: 'calc(100% + 18px)', pointerEvents: 'none' }}>
                <motion.rect x="3" y="3" width="94" height="94" rx="18" fill="none" stroke="#FFC93C" strokeWidth="6" strokeLinecap="round" pathLength="1"
                  initial={{ strokeDasharray: '1 1', strokeDashoffset: 0 }} animate={{ strokeDashoffset: 1 }} transition={{ duration: HURRY_MS / 1000, ease: 'linear' }} />
              </svg>
            )}
          </motion.button>
        </div>
      </div>
    </>
  )
}

export default function ShapeBuildGame({ level = 1, onComplete }) {
  const rules  = levelRules(level)
  const rounds = useState(() => buildRounds(level).map((f, i) => ({ ...f, customer: CUSTOMERS[i % CUSTOMERS.length] })))[0]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [rootRef, box] = useBox()
  const upright = isUpright(box), flat = isFlat(box)
  const [idx,      setIdx]      = useState(0)
  // Each entry pairs the slot that was filled with the tray piece that filled
  // it — the two indices differ whenever a figure has interchangeable pieces
  // (Rakete's two fins, Blume's petals), so tracking only one of them hides
  // the wrong piece.
  const [placed,   setPlaced]   = useState([])     // [{ slot, tray }]
  const [turns,    setTurns]    = useState({})     // tray index -> extra turn the child gave it
  const [wrongSlot, setWrongSlot] = useState(null)
  const [mood,     setMood]     = useState('idle')
  const [freeMode, setFreeMode] = useState(false)  // the wishes are done: the bench is free
  const [turnHint, setTurnHint] = useState(null)   // { i, n }: this piece only needs turning
  const [stuck,    setStuck]    = useState(null)   // a wrong piece sitting in a place for a moment
  const [held,     setHeld]     = useState(null)   // the tray piece under a finger
  const [bursts, burst] = useBursts()
  const juice = useJuice({ hudSize: upright ? 28 : flat ? 46 : 36 })
  const { hit, miss: bonk, shake } = juice         // these never change
  const noNo = useAnimationControls()
  // the parts that did not go in right at the first try, as `${figure}-${part}`
  const missedParts = useRef(new Set())
  const timers = useRef([])
  const boardRef = useRef(null)
  const benchRef = useRef(null)
  const trayRef  = useRef(null)
  const totalParts = useMemo(() => rounds.reduce((n, f) => n + f.parts.length, 0), [rounds])

  const fig = rounds[idx]
  // The tray holds the pieces the figure needs (plus one that does not
  // belong from level 4), in random order; from level 6 they lie turned.
  const tray = useMemo(() => {
    if (!fig) return []
    const pieces = fig.parts.map((p, part) => ({
      ...p, part,
      rot: (p.rot ?? 0) + (rules.turn ? randomTurn(p.shape) : 0),
    }))
    if (rules.distractor) pieces.push(makeDistractor(fig))
    const maxDim = Math.max(...pieces.map(p => Math.max(p.w, p.h)))
    // Drawn size inside the 100-unit tile: true to scale, so bigger is
    // plainly bigger (the snowman's three balls were squeezed to nearly one
    // size). Only a very small part is drawn larger than it is, so it stays
    // a shape you see: a wheel was a 12-unit dot.
    return shuffle(pieces.map(p => {
      const k = Math.max(84 / maxDim, 38 / Math.max(p.w, p.h))
      return { ...p, dw: Math.max(9, p.w * k), dh: Math.max(9, p.h * k) }
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
    setPlaced([]); setTurns({}); setWrongSlot(null); setTurnHint(null); setStuck(null); setHeld(null); setMood('idle')
    lockPreviews()
    sayTask()
    // Lumi names the wish as the customer comes in; the first time, after
    // whatever is still being said
    const word = wishWord(fig)
    if (word) later(() => afterNarration(() => narrate([word]), { minMs: 0, maxMs: 4000 }), 500)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // which piece is under a finger: its ghost shows on the bench
  useEffect(() => {
    const drop = () => setHeld(null)
    window.addEventListener('pointerup', drop)
    window.addEventListener('pointercancel', drop)
    return () => { window.removeEventListener('pointerup', drop); window.removeEventListener('pointercancel', drop) }
  }, [])

  const last = idx + 1 >= rounds.length
  // Every part is one task: it counts as right when it went into its place
  // at the first try, however often another one was tried. (Every wrong try
  // was taken off: one piece tried three times cost three of twelve.)
  // Free building is a bonus, not rated.
  const finishLevel = useCallback(() => {
    sfx.complete()
    afterNarration(() => onComplete(result(totalParts - missedParts.current.size, totalParts)), { minMs: 300 })
  }, [onComplete, totalParts])

  // where a place is on screen: the star starts there
  const slotPoint = slot => {
    const b = benchRef.current?.getBoundingClientRect()
    return b ? { x: b.left + b.width * (slot.x + slot.w / 2) / 100, y: b.top + b.height * (slot.y + slot.h / 2) / 100 } : undefined
  }

  // A piece let go over a place: it snaps in, or it sits there all wrong for
  // a moment and pops back; a piece that only lies the wrong way round makes
  // its turn button wiggle.
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
      if (stuck) return false
      // the part that missed: the piece itself, or, for the piece that does
      // not belong, the part whose place it was put on
      missedParts.current.add(`${idx}-${piece.extra ? slotIdx : piece.part}`)
      // the piece's own size, sitting crooked on the place: too big, too small, wrong
      setStuck({ shape: piece.shape, x: slot.x + slot.w / 2 - piece.w / 2, y: slot.y + slot.h / 2 - piece.h / 2, w: piece.w, h: piece.h, rot: rotOf(trayIdx) + 20, color: piece.color, tray: trayIdx, n: Date.now() })
      bonk()                                        // a soft bonk; the streak is over
      if (!reduceMotion()) noNo.start({ rotate: [0, -10, 9, -6, 4, 0], transition: { duration: 0.6 } })
      sayWrong()
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
    // it snaps in: a click, a little shake of the bench, a star
    sfx.bump()
    shake(0.5)
    hit(slotPoint(slot))
    if (next.length < fig.parts.length) {
      setMood('wow')
      later(() => setMood('idle'), 700)
      return true
    }
    // the last piece: the thing does what it does, the customer joins in
    const move = fig.alive.move
    later(() => {
      sfx.tada()
      burst(benchRef.current, 'confetti', 16)
    }, 300)
    const go = aliveDelay(move) * 1000
    if (move === 'sail') later(() => sfx.splash(), go)
    if (move === 'spin') later(() => sfx.slideUp(), go)
    if (move === 'drive') { later(() => sfx.note(4, 0.16), go - 350); later(() => sfx.note(4, 0.16), go - 100) }   // toot toot
    if (move === 'chug') [0, 1, 2, 3].forEach(i => later(() => sfx.drum(i % 2 === 0), go + i * 220))
    if (move === 'launch') later(() => { sfx.whoosh(); shake(1.6) }, go + ALIVE.launch.dur * 280)
    if (move === 'scribble') [0, 1, 2, 3, 4].forEach(i => later(() => sfx.step(), go + 400 + i * 240))
    sayRight()
    // The next figure is rendered without this one's pieces from the start:
    // with them it counted as complete for a moment, and its customer, who
    // rides along, made the new customer's animal sound
    const advance = () => { if (last) { setFreeMode(true); return } setPlaced([]); setTurns({}); setIdx(i => i + 1) }
    afterNarration(() => later(advance, 0), { minMs: Math.max(3000, aliveMs(move) + 700) })
    return true
  }, [fig, idx, placed, tray, turns, last, stuck, burst, later, bonk, hit, shake, noNo]) // eslint-disable-line react-hooks/exhaustive-deps

  const turn = i => {
    setTurns(t => ({ ...t, [i]: (t[i] ?? 0) + 90 }))
    sfx.flip()
  }

  if (!fig) return null
  const filledSlots = new Set(placed.map(pl => pl.slot))
  const usedTiles   = new Set(placed.map(pl => pl.tray))
  const complete    = filledSlots.size === fig.parts.length

  // ── the room there is, and what goes where ──
  const pad = flat ? 12 : Math.round(clamp(box.w * 0.02, 8, 22))
  const gap = flat ? 12 : Math.round(clamp(box.h * 0.016, 8, 14))
  const trail = upright ? 32 : flat ? 36 : 40
  const mini = upright ? 40 : flat ? 58 : 52
  // the turn button sits on the corner of its piece's tile
  const badge = rules.turn ? (flat ? 76 : upright ? 46 : 50) : 0
  const cellGap = flat ? 14 : 8
  const perRow = upright || flat ? 4 : 8
  const tile = Math.floor(flat ? 112 : upright ? Math.min(80, (box.w - 2 * pad - (perRow - 1) * cellGap) / perRow - badge * 0.4) : 92)
  const cell = { w: tile + badge * 0.4, h: tile + badge * 0.3 }
  // the tray keeps the room of the fullest tray of the level, so the bench
  // never jumps: two rows only where seven pieces can come
  const trayRows = (upright || flat) && level >= 7 ? 2 : 1
  const trayH = trayRows * cell.h + (trayRows - 1) * cellGap
  const panel = 28                                             // the bench's frame around the paper
  const custSize = upright ? 72 : flat ? 150 : 110
  const headH = flat ? Math.max(trail * 1.35, mini + 10) : trail * 1.35
  const boardPx = Math.round(clamp(
    flat ? box.h - 2 * pad - headH - gap - panel
      : upright ? Math.min(box.w - 2 * pad - panel - 12, box.h - 2 * pad - headH - (mini + 10) - (custSize + 14) - trayH - 4 * gap - panel)
      : box.h - 2 * pad - headH - (mini + 10) - trayH - 3 * gap - panel,
    160, flat ? 420 : 330))

  const customer = (
    <AnimatePresence mode="wait">
      <motion.div key={idx} initial={{ x: -120, opacity: 0 }} animate={{ x: 0, opacity: 1, transition: { type: 'spring', stiffness: 260, damping: 18 } }}
        exit={{ x: 160, opacity: 0, transition: { duration: 0.25 } }}
        style={upright ? { paddingRight: custSize * 0.9 } : { paddingTop: custSize * 0.62 }}>
        <motion.div animate={noNo} style={{ transformOrigin: '50% 90%' }}>
          <Critter art={fig.customer} size={custSize} mood={mood} label="Kunde" style={{ opacity: complete ? 0 : 1, transition: 'opacity .4s .8s' }}
            wishSide={upright ? 'right' : 'top'} wish={<Art art={fig.icon} size={upright ? 38 : flat ? 60 : 44} />} />
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )

  const bench = (
    <div ref={boardRef} style={{ ...pxPanel, padding: panel / 2 - 3, background: '#8A5A33', flexShrink: 0 }}>
      <Board fig={fig} customer={fig.customer} rules={rules} filled={filledSlots} wrongSlot={wrongSlot} stuck={stuck} complete={complete}
        held={held != null && tray[held] ? { ...tray[held], rot: rotOf(held) } : null}
        size={boardPx} innerRef={benchRef} onDrop={(piece, slot) => dropPiece(piece, slot)} />
    </div>
  )

  const trayBox = (
    <div ref={trayRef} style={{
      display: 'flex', gap: cellGap, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-start', alignContent: 'center', flexShrink: 0,
      width: flat ? perRow * (cell.w + cellGap) : '100%', maxWidth: perRow * (cell.w + cellGap), minHeight: trayH,
    }}>
      {tray.map((p, i) => {
        const used = usedTiles.has(i)
        const turnable = rules.turn && p.shape !== 'circle' && p.shape !== 'square'
        return (
          <div key={`${idx}-${i}`} onPointerDownCapture={() => setHeld(i)}
            style={{ position: 'relative', width: cell.w, height: cell.h, visibility: used || stuck?.tray === i ? 'hidden' : 'visible', opacity: complete ? 0.35 : 1, transition: 'opacity .4s' }}>
            <Draggable id={`${idx}-${i}`} data={i} label={SHAPE[p.shape].name} disabled={used || complete} style={{ width: tile, height: tile }}>
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
            {turnable && (
              <motion.button key={turnHint?.i === i ? turnHint.n : 'still'} whileTap={{ scale: 0.88, rotate: 90 }}
                onClick={() => turn(i)} disabled={used || complete}
                animate={turnHint?.i === i && !reduceMotion() ? { scale: [1, 1.3, 1, 1.3, 1], rotate: [0, 40, 0, 40, 0] } : {}} transition={{ duration: 1.2 }}
                aria-label={`${SHAPE[p.shape].name} drehen`}
                style={{ position: 'absolute', right: 0, bottom: 0, width: badge, height: badge, borderRadius: '50%', background: 'var(--px-gold)', border: `3px solid ${INK}`, boxShadow: `0 3px 0 ${INK}`, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
                <svg width={badge * 0.54} height={badge * 0.54} viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </motion.button>
            )}
          </div>
        )
      })}
    </div>
  )

  const shelf = <Shelf figs={rounds.slice(0, freeMode ? rounds.length : idx)} total={rounds.length} mini={mini} />
  const trailBox = <RoundTrail total={rounds.length} done={freeMode ? rounds.length : idx + (complete ? 1 : 0)} walker="🔨" goal="🏠" size={trail} style={{ flex: 1, maxWidth: 560 }} />
  const free = freeMode && <FreeBuild size={boardPx} tile={tile} row={flat} onDone={finishLevel} hit={hit} burst={burst} />

  return (
    <div ref={rootRef} style={{
      flex: 1, minHeight: 0, minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: pad, gap,
    }}>
      {bursts}
      {juice.layer}
      {!freeMode && <HintHand from={trayRef} to={boardRef} delay={idx === 0 ? 2000 : 6000} active={!complete} />}
      {flat ? (
        // a phone held sideways: the way, the shelf and the stars in one row
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, width: '100%', height: headH, flexShrink: 0 }}>
          {trailBox}{shelf}<div style={{ alignSelf: 'center' }}>{juice.hud}</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', maxWidth: 760, flexShrink: 0 }}>{trailBox}{juice.hud}</div>
          {shelf}
        </>
      )}

      <div ref={juice.stage} style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: flat ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: flat ? 24 : gap }}>
        {freeMode ? free : (
          <DragArea disabled={complete}>
            {upright ? (
              <>{customer}{bench}{trayBox}</>
            ) : flat ? (
              <>{customer}{bench}{trayBox}</>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: Math.round(clamp(box.w * 0.03, 8, 28)) }}>{customer}{bench}</div>
                {trayBox}
              </>
            )}
          </DragArea>
        )}
      </div>
    </div>
  )
}
