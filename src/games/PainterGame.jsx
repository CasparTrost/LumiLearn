import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts, useDragState } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { useSceneClear } from './sceneSpace.js'
import { pxPanel, INK } from './px.js'

/**
 * Farbenreich: "Malerauftrag" — Farbwörter beim Malen nach Wunsch.
 *
 * A customer comes to the paint shop: the mouse wants a house, the
 * caterpillar an apple. It wishes for one part at a time: its speech bubble
 * shows the picture with that part in the colour and a drop of the paint,
 * and the part pulses on the easel. The child drags the paint pot of that
 * colour onto the picture (or taps the pot, then the picture), and the part
 * fills with paint. While a pot is held, the customer leans in. A wrong pot
 * bounces back and splashes the customer, and the part shows the colour it
 * wants. When everything is painted, the customer moves in: it hops onto
 * the picture, and off they go. At the end of a level all the customers sit
 * on their pictures in a little gallery. No words needed: a hand shows the
 * move from the pots to the easel when a child waits (after a miss, from the
 * pot of the wished colour). Beside the customer stands a mixing bowl: two
 * pots in, a new colour out (yellow and blue make green), and the mixed
 * paint can be poured like any pot.
 */

// ─── Colours ──────────────────────────────────────────────────────────────────
// `near`: colours a child easily mixes up; as distractors they only come from
// level 7 on.
const ALL_COLORS = [
  { name: 'Rot',       value: '#E53935', near: ['Pink'] },
  { name: 'Blau',      value: '#1E88E5', near: ['Türkis'] },
  { name: 'Grün',      value: '#43A047', near: ['Hellgrün'] },
  { name: 'Gelb',      value: '#FDD835', near: ['Orange'] },
  { name: 'Orange',    value: '#FB8C00', near: ['Gelb'] },
  { name: 'Lila',      value: '#8E24AA', near: ['Pink'] },
  { name: 'Pink',      value: '#E91E63', near: ['Rot', 'Lila'] },
  { name: 'Braun',     value: '#6D4C41', near: ['Hellbraun'] },
  { name: 'Hellbraun', value: '#C49A6C', near: ['Braun', 'Orange'] },
  { name: 'Türkis',    value: '#00ACC1', near: ['Blau'] },
  { name: 'Grau',      value: '#90A4AE', near: ['Weiß'] },
  { name: 'Hellgrün',  value: '#9CCC65', near: ['Grün'] },
  { name: 'Schwarz',   value: '#37474F', near: [] },
  { name: 'Weiß',      value: '#FFFFFF', near: ['Grau'] },
]
const MAX_BUCKETS = 10

function getColor(name) {
  return ALL_COLORS.find(c => c.name === name) ?? ALL_COLORS[0]
}

function buildPalette(scene, level) {
  const needed = [...new Set(scene.regions.map(r => r.target))].map(getColor)
  // More distractors as the levels rise (one on level 1 up to the bucket
  // limit); colours easily confused with a needed one only from level 7.
  const pool = ALL_COLORS.filter(c => !needed.includes(c) &&
    (level >= 7 || !needed.some(n => n.near.includes(c.name))))
  const extra = shuffle(pool).slice(0, Math.max(0, Math.min(level, MAX_BUCKETS - needed.length)))
  return shuffle([...needed, ...extra])
}

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// The parts of a picture in order: regions with the same name are one part
// and one wish (both ears, both eyes)
function partsOf(scene) {
  const parts = []
  scene.regions.forEach(r => {
    const p = parts.find(x => x.name === r.name)
    if (p) p.regions.push(r)
    else parts.push({ name: r.name, target: r.target, regions: [r] })
  })
  return parts
}

// Where paint poured into a region starts: its middle
function centerOf(r) {
  if (r.element === 'rect') return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
  if (r.element === 'polygon') {
    const pts = r.points.trim().split(/\s+/).map(p => p.split(',').map(Number))
    return { x: pts.reduce((s, p) => s + p[0], 0) / pts.length, y: pts.reduce((s, p) => s + p[1], 0) / pts.length }
  }
  return { x: r.cx, y: r.cy }
}

// ─── Scenes — clean SVG primitives only ─────────────────────────────────────
const SCENES = [
  // ── Level 1 ──
  {
    id: 'house', level: 1, client: '🐭', seat: [100, 174], act: 'bounce', use: 'light',
    regions: [
      { id: 'wall',   target: 'Orange', name: 'die Wand',    element: 'rect',    x: 30,  y: 110, width: 140, height: 70 },
      { id: 'roof',   target: 'Rot',    name: 'das Dach',    element: 'polygon', points: '15,115 100,36 185,115' },
      { id: 'door',   target: 'Braun',  name: 'die Tür',     element: 'rect',    x: 83,  y: 140, width: 34,  height: 40 },
      { id: 'window', target: 'Blau',   name: 'das Fenster', element: 'rect',    x: 42,  y: 120, width: 34,  height: 28, rx: 4 },
    ],
  },
  {
    id: 'apple', level: 1, client: '🐛', seat: [122, 112], act: 'bounce', use: 'bite',
    regions: [
      { id: 'body', target: 'Rot',   name: 'der Apfel', element: 'circle',  cx: 100, cy: 118, r: 65 },
      { id: 'leaf', target: 'Grün',  name: 'das Blatt', element: 'ellipse', cx: 122, cy: 52,  rx: 22, ry: 12, transform: 'rotate(-35,122,52)' },
      { id: 'stem', target: 'Braun', name: 'der Stiel', element: 'rect',    x: 97,   y: 38,   width: 7, height: 20, rx: 3 },
    ],
  },
  {
    id: 'sun', level: 1, client: '🦔', seat: [100, 182], act: 'float', use: 'sparkle',
    regions: [
      { id: 'rays', target: 'Orange', name: 'die Strahlen', element: 'polygon',
        points: '100,10 117,58 164,36 142,83 190,100 142,117 164,164 117,142 100,190 83,142 36,164 58,117 10,100 58,83 36,36 83,58' },
      { id: 'disc', target: 'Gelb',   name: 'die Sonne',   element: 'circle', cx: 100, cy: 100, r: 44 },
    ],
  },
  {
    id: 'balloon', level: 1, client: '🐰', seat: [100, 192], act: 'away',
    regions: [
      { id: 'ball',   target: 'Rot',  name: 'der Ballon',  element: 'ellipse', cx: 100, cy: 80, rx: 55, ry: 65 },
      { id: 'knot',   target: 'Gelb', name: 'der Knoten',  element: 'circle',  cx: 100, cy: 145, r: 7 },
      { id: 'string', target: 'Grau', name: 'die Schnur',  element: 'rect',    x: 98, y: 152, width: 4, height: 44, rx: 2 },
    ],
  },
  {
    id: 'star', level: 1, client: '🦉', seat: [100, 104], act: 'float', use: 'sparkle',
    regions: [
      { id: 'body', target: 'Gelb', name: 'der Stern', element: 'polygon',
        points: '100,18 121,70 176,70 132,103 148,158 100,125 52,158 68,103 24,70 79,70' },
    ],
  },
  // ── Level 2 ──
  {
    id: 'butterfly', level: 2, client: '🐞', seat: [100, 84], act: 'away',
    regions: [
      { id: 'wing-tl', target: 'Lila',   name: 'die oberen Flügel',  element: 'ellipse', cx: 62,  cy: 76,  rx: 48, ry: 30, transform: 'rotate(-30,62,76)'  },
      { id: 'wing-tr', target: 'Lila',   name: 'die oberen Flügel',  element: 'ellipse', cx: 138, cy: 76,  rx: 48, ry: 30, transform: 'rotate(30,138,76)'   },
      { id: 'wing-bl', target: 'Orange', name: 'die unteren Flügel', element: 'ellipse', cx: 68,  cy: 138, rx: 38, ry: 24, transform: 'rotate(25,68,138)'   },
      { id: 'wing-br', target: 'Orange', name: 'die unteren Flügel', element: 'ellipse', cx: 132, cy: 138, rx: 38, ry: 24, transform: 'rotate(-25,132,138)' },
      { id: 'body',    target: 'Braun',  name: 'der Körper',         element: 'ellipse', cx: 100, cy: 107, rx: 8,  ry: 36 },
    ],
  },
  {
    id: 'fish', level: 2, client: '🐙', seat: [158, 150], act: 'swim',
    regions: [
      { id: 'body', target: 'Blau',     name: 'der Fisch',          element: 'ellipse', cx: 88,  cy: 100, rx: 62, ry: 42 },
      { id: 'tail', target: 'Türkis',   name: 'die Schwanzflosse',  element: 'polygon', points: '148,100 178,68 178,132' },
      { id: 'fin',  target: 'Hellgrün', name: 'die Rückenflosse',   element: 'polygon', points: '72,58 88,42 108,56' },
      { id: 'eye',  target: 'Schwarz',  name: 'das Auge',           element: 'circle',  cx: 52,  cy: 93,  r: 10 },
    ],
  },
  {
    id: 'bear', level: 2, client: '🐿️', seat: [100, 160], act: 'bounce', use: 'hearts',
    regions: [
      { id: 'ear-l',  target: 'Braun',     name: 'die Ohren',    element: 'circle',  cx: 65,  cy: 45,  r: 22 },
      { id: 'ear-r',  target: 'Braun',     name: 'die Ohren',    element: 'circle',  cx: 135, cy: 45,  r: 22 },
      { id: 'body',   target: 'Braun',     name: 'der Körper',   element: 'ellipse', cx: 100, cy: 148, rx: 52, ry: 45 },
      { id: 'head',   target: 'Braun',     name: 'der Kopf',     element: 'circle',  cx: 100, cy: 80,  r: 44 },
      { id: 'muzzle', target: 'Hellbraun', name: 'die Schnauze', element: 'ellipse', cx: 100, cy: 94,  rx: 22, ry: 15 },
      { id: 'eye-l',  target: 'Schwarz',   name: 'die Augen',    element: 'circle',  cx: 86,  cy: 73,  r: 7 },
      { id: 'eye-r',  target: 'Schwarz',   name: 'die Augen',    element: 'circle',  cx: 114, cy: 73,  r: 7 },
    ],
  },
  {
    id: 'frog', level: 2, client: '🦆', seat: [158, 120], act: 'bounce',
    regions: [
      { id: 'body',    target: 'Grün',    name: 'der Frosch',   element: 'ellipse', cx: 100, cy: 125, rx: 55, ry: 45 },
      { id: 'eye-l',   target: 'Weiß',    name: 'die Augen',    element: 'circle',  cx: 75,  cy: 80,  r: 18 },
      { id: 'eye-r',   target: 'Weiß',    name: 'die Augen',    element: 'circle',  cx: 125, cy: 80,  r: 18 },
      { id: 'pupil-l', target: 'Schwarz', name: 'die Pupillen', element: 'circle',  cx: 75,  cy: 83,  r: 8 },
      { id: 'pupil-r', target: 'Schwarz', name: 'die Pupillen', element: 'circle',  cx: 125, cy: 83,  r: 8 },
      { id: 'mouth',   target: 'Rot',     name: 'der Mund',     element: 'ellipse', cx: 100, cy: 145, rx: 22, ry: 10 },
    ],
  },
  // ── Level 3 ──
  {
    id: 'rocket', level: 3, client: '🐶', seat: [100, 104], act: 'away',
    regions: [
      { id: 'body',   target: 'Grau',   name: 'der Rumpf',   element: 'rect',    x: 72,  y: 70, width: 56, height: 88, rx: 8 },
      { id: 'nose',   target: 'Rot',    name: 'die Spitze',  element: 'polygon', points: '72,70 100,14 128,70' },
      { id: 'wing-l', target: 'Orange', name: 'die Flügel',  element: 'polygon', points: '72,128 38,170 72,158' },
      { id: 'wing-r', target: 'Orange', name: 'die Flügel',  element: 'polygon', points: '128,128 162,170 128,158' },
      { id: 'window', target: 'Blau',   name: 'das Fenster', element: 'circle',  cx: 100, cy: 98, r: 20 },
      { id: 'flame',  target: 'Gelb',   name: 'die Flamme',  element: 'polygon', points: '80,158 100,196 120,158' },
    ],
  },
  {
    id: 'penguin', level: 3, client: '🐼', seat: [150, 178], act: 'swim',
    regions: [
      { id: 'body',  target: 'Schwarz', name: 'der Körper',   element: 'ellipse', cx: 100, cy: 120, rx: 56, ry: 66 },
      { id: 'belly', target: 'Weiß',    name: 'der Bauch',    element: 'ellipse', cx: 100, cy: 125, rx: 32, ry: 48 },
      { id: 'beak',  target: 'Orange',  name: 'der Schnabel', element: 'polygon', points: '88,96 100,111 112,96 100,84' },
      { id: 'feet',  target: 'Orange',  name: 'die Füße',     element: 'polygon', points: '60,178 50,193 82,189 78,178 122,178 118,189 150,193 140,178' },
      // white eyes: black ones on the black body could not be seen
      { id: 'eye-l', target: 'Weiß',    name: 'die Augen',    element: 'circle',  cx: 86,  cy: 96,  r: 6 },
      { id: 'eye-r', target: 'Weiß',    name: 'die Augen',    element: 'circle',  cx: 114, cy: 96,  r: 6 },
    ],
  },
  {
    id: 'flower', level: 3, client: '🐝', seat: [100, 96], act: 'bounce', use: 'buzz',
    regions: [
      { id: 'petals', target: 'Pink', name: 'die Blüte', element: 'polygon',
        points: '100,25 115,63 153,47 137,85 175,100 137,115 153,153 115,137 100,175 85,137 47,153 63,115 25,100 63,85 47,47 85,63' },
      { id: 'center', target: 'Gelb', name: 'die Mitte', element: 'circle',  cx: 100, cy: 100, r: 30 },
      { id: 'stem',   target: 'Grün', name: 'der Stiel', element: 'rect',    x: 96,   y: 128,  width: 8, height: 68, rx: 4 },
      { id: 'leaf',   target: 'Grün', name: 'das Blatt', element: 'ellipse', cx: 128, cy: 165, rx: 28, ry: 13, transform: 'rotate(-30,128,165)' },
    ],
  },
]

function buildScenes(level) {
  // Only 3 scene-difficulty tiers exist (12 scenes total), so this maxes
  // out by level 7 — that's a real content-size limit, not a bug. What
  // WAS a bug: `count` also plateaued (level 8, 9 and 10 all gave the
  // exact same value of 4), making the last 3 of 10 levels identical in
  // difficulty. Now grows across the whole range, using more of the
  // already-available scene pool per session at higher levels.
  const maxSceneLevel = level <= 2 ? 1 : level <= 6 ? 2 : 3
  const available = SCENES.filter(s => s.level <= maxSceneLevel)
  const count     = level <= 3 ? 2 : level <= 5 ? 3 : level <= 7 ? 4 : level <= 9 ? 5 : 6
  return shuffle(available).slice(0, Math.min(count, available.length))
}


// ─── SVG shape renderer  ──────────────────────────────────────────────────────
function ShapeEl({ region, ...paint }) {
  switch (region.element) {
    case 'circle':
      return <circle  cx={region.cx} cy={region.cy} r={region.r} {...paint} />
    case 'ellipse':
      return <ellipse cx={region.cx} cy={region.cy} rx={region.rx} ry={region.ry}
               transform={region.transform} {...paint} />
    case 'rect':
      return <rect    x={region.x}   y={region.y}   width={region.width} height={region.height}
               rx={region.rx ?? 0} {...paint} />
    case 'polygon':
      return <polygon points={region.points} {...paint} />
    default: return null
  }
}

// ─── Colour mixing ────────────────────────────────────────────────────────────
// Two pots into the bowl make a new colour: yellow and blue give green. What
// does not mix into a colour of the palette turns into brown mud. A toy beside
// the task: the mixed paint can be poured like any pot, and only the wished
// colour counts.
const MIX = {
  'Blau+Gelb': 'Grün', 'Gelb+Rot': 'Orange', 'Blau+Rot': 'Lila', 'Rot+Weiß': 'Pink',
  'Schwarz+Weiß': 'Grau', 'Blau+Grün': 'Türkis', 'Gelb+Grün': 'Hellgrün', 'Grün+Weiß': 'Hellgrün',
  'Braun+Weiß': 'Hellbraun', 'Braun+Gelb': 'Hellbraun', 'Blau+Hellgrün': 'Türkis',
}
const mix = (a, b) => (a === b ? a : MIX[[a, b].sort().join('+')] ?? 'Braun')

function Bowl({ fill, size }) {
  return (
    <svg width={size} height={size * 0.62} viewBox="0 0 60 37" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <ellipse cx="30" cy="8" rx="27" ry="7" fill="#fffdf7" stroke={INK} strokeWidth="2.5" />
      {fill && <ellipse cx="30" cy="9" rx="23" ry="5" fill={fill} />}
      <path d="M3 8 Q6 34 30 35 Q54 34 57 8 A27 7 0 0 1 3 8 Z" fill="#9fd3ff" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M10 16 Q14 26 24 29" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}

// The mixing bowl: drop two pots in, take the new colour out. The dots on
// top show what went in.
function MixBowl({ bowl, size, onAdd }) {
  return (
    <DropZone id="bowl" onDrop={onAdd} label="Mischschüssel">
      {hover => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
          <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: size * 0.2, color: INK }}>
            {[bowl.a, bowl.b].map((c, i) => (
              <motion.span key={`${i}-${c?.name}`} initial={{ scale: c ? 0 : 1 }} animate={{ scale: 1 }}
                style={{ width: Math.max(14, size * 0.2), height: Math.max(14, size * 0.2), borderRadius: '50%', background: c?.value ?? 'transparent', border: `2px ${c ? 'solid' : 'dashed'} ${INK}` }} />
            )).reduce((acc, el, i) => (i ? [...acc, <span key="plus">+</span>, el] : [el]), [])}
          </div>
          <motion.div animate={hover ? { scale: 1.12, rotate: [0, -4, 4, 0] } : { scale: 1, rotate: 0 }}>
            {bowl.out
              ? <Draggable id={`mix-${bowl.n}`} data={{ ...bowl.out, mixed: true }} label={bowl.out.name}>
                  <motion.div key={bowl.n} initial={{ rotate: -200, scale: 0.6 }} animate={{ rotate: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }}>
                    <Bowl fill={bowl.out.value} size={size} />
                  </motion.div>
                </Draggable>
              : <Bowl fill={bowl.a?.value} size={size} />}
          </motion.div>
        </div>
      )}
    </DropZone>
  )
}

// ─── Paint pot  ───────────────────────────────────────────────────────────────
function Pot({ color, name, size = 60 }) {
  return (
    <div style={{ width: size + 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
      <svg width={size} height={size * 1.05} viewBox="0 0 44 46" style={{ overflow: 'visible' }} aria-hidden="true">
        <path d="M6 18 L10 42 L34 42 L38 18 Z" fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <ellipse cx="22" cy="18" rx="16" ry="5" fill={color} stroke={INK} strokeWidth="2.5" />
        <path d="M10 19 Q12 30 9 33 Q7 35 8 28" fill={color} stroke={INK} strokeWidth="1.5" />
        <ellipse cx="15" cy="28" rx="3" ry="5" fill="white" opacity="0.35" transform="rotate(-15 15 28)" />
        <path d="M12 16 C12 6 32 6 32 16" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" />
      </svg>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700, lineHeight: 1.1, whiteSpace: 'nowrap', color: INK }}>{name}</span>
    </div>
  )
}

// ─── The picture: hatched where unpainted, paint poured in where painted ─────
// `want` is the part being wished for: on the easel it pulses with a dashed
// outline; in the wish bubble (`mini`) it is shown in its colour.
function Picture({ scene, size, filled, want, flash, fx, mini = false }) {
  const pid = `${mini ? 'mini' : 'big'}-${scene.id}`
  const wanted = r => want?.regions.includes(r)
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <pattern id={`${pid}-hatch`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" fill="#FFFAF0" />
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(42,27,61,0.12)" strokeWidth="3" />
        </pattern>
        {!mini && scene.regions.map(region => (
          <clipPath key={region.id} id={`${pid}-clip-${region.id}`}>
            <ShapeEl region={region} />
          </clipPath>
        ))}
      </defs>
      {scene.regions.map(region => {
        const tc = getColor(region.target).value
        const done = filled[region.id]
        const c = centerOf(region)
        return (
          <g key={region.id}>
            <ShapeEl region={region} fill={mini && (done || wanted(region)) ? tc : `url(#${pid}-hatch)`} />
            {/* fills from the middle, like paint poured in */}
            {!mini && done && (
              <g clipPath={`url(#${pid}-clip-${region.id})`}>
                <motion.circle cx={c.x} cy={c.y} fill={tc} initial={{ r: 0 }} animate={{ r: 260 }} transition={{ duration: 0.6, ease: 'easeOut' }} />
              </g>
            )}
            {/* a wrong colour: the part shows the colour it wants */}
            {!mini && flash && wanted(region) && (
              <motion.g key={flash} initial={{ opacity: 0 }} animate={{ opacity: [0, 0.85, 0.2, 0.85, 0] }} transition={{ duration: 1.3 }}>
                <ShapeEl region={region} fill={tc} />
              </motion.g>
            )}
            <ShapeEl region={region} fill="none" stroke={INK} strokeWidth={mini ? 4 : 2} strokeLinejoin="round" />
          </g>
        )
      })}
      {/* what the customer does with it: the house window lights up, the
          caterpillar takes bites out of the apple */}
      {fx?.lit && scene.regions.filter(r => r.id === 'window').map(r => (
        <motion.g key="lit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} style={{ filter: 'drop-shadow(0 0 8px #ffd34d)' }}>
          <ShapeEl region={r} fill="#FFE066" stroke={INK} strokeWidth="2" />
        </motion.g>
      ))}
      {[-25, 12, 45].slice(0, fx?.bites ?? 0).map(a => (
        <motion.circle key={a} cx={100 + 66 * Math.cos(a * Math.PI / 180)} cy={118 + 66 * Math.sin(a * Math.PI / 180)} fill="#fffdf7"
          initial={{ r: 0 }} animate={{ r: 17 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} />
      ))}
      {/* the wished part, on top: a dancing dashed outline */}
      {!mini && want && want.regions.map(region => (
        <motion.g key={`want-${region.id}`} animate={{ opacity: [1, 0.35, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <ShapeEl region={region} fill="none" stroke="#ffc93c" strokeWidth="7" strokeLinejoin="round" />
          <ShapeEl region={region} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="7 5" strokeLinejoin="round" />
        </motion.g>
      ))}
    </svg>
  )
}

// A splash of the wrong colour on the customer's face
// It stays a while and drips, then the customer shakes it off (it falls).
function Splat({ color, size }) {
  return (
    <motion.svg viewBox="0 0 60 90" width={size * 0.5} height={size * 0.75} aria-hidden="true"
      initial={{ scale: 0, opacity: 1 }}
      animate={{ scale: [0, 1.2, 1, 1, 1], y: [0, 0, 0, 0, size * 0.5], rotate: [0, 0, 0, -10, 25], opacity: [1, 1, 1, 1, 0] }}
      transition={{ duration: 3, times: [0, 0.06, 0.12, 0.8, 1] }}
      style={{ position: 'absolute', left: '28%', top: '22%', pointerEvents: 'none', zIndex: 4, overflow: 'visible', transformOrigin: '50% 30%' }}>
      {[[20, 46], [34, 50], [44, 42]].map(([x, y], k) => (
        <motion.rect key={k} x={x - 3} y={y - 4} width="6" height="26" rx="3" fill={color} stroke={INK} strokeWidth="1.5"
          initial={{ scaleY: 0 }} animate={{ scaleY: [0, 0, 1] }} transition={{ duration: 2.2, times: [0, 0.2 + k * 0.1, 1] }}
          style={{ transformOrigin: `${x}px ${y - 4}px` }} />
      ))}
      <path d="M30 6 Q36 18 44 10 Q42 22 56 22 Q44 30 54 42 Q40 38 38 54 Q30 42 22 54 Q20 40 6 44 Q16 32 4 22 Q18 22 16 10 Q24 18 30 6 Z"
        fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </motion.svg>
  )
}

// The customer: leans in while a pot is held, eager to see its colour
function Customer({ mood, ...props }) {
  const { picked } = useDragState()
  return <Critter mood={picked && mood === 'idle' ? 'hungry' : mood} {...props} />
}

// The area left for customer and easel, measured
function useBox() {
  const ref = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox(b => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box]
}

// How the picture and its new owner leave together
const ACT = {
  away:   { y: [0, 14, -40, -700], rotate: [0, -3, 3, 0], opacity: [1, 1, 1, 0], transition: { duration: 2.3, delay: 0.8, times: [0, 0.15, 0.4, 1], ease: 'easeIn' } },
  bounce: { y: [0, -30, 0, -16, 0], rotate: [0, -4, 4, 0, 0], transition: { duration: 1.2, delay: 0.7 } },
  float:  { y: [0, -24, -60, -30, 0], rotate: [0, 3, -3, 2, 0], transition: { duration: 2.2, delay: 0.7 } },
  swim:   { x: [0, -24, 24, -16, 0], rotate: [0, -5, 5, -3, 0], transition: { duration: 1.8, delay: 0.7 } },
}
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// The end of a level: every customer sits on its picture, and they hop
function Gallery({ scenes, size }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: size * 0.18, padding: 8 }}>
      {scenes.map((sc, i) => (
        <motion.div key={sc.id} initial={{ scale: 0, y: 40 }} animate={{ scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: i * 0.18 }}
          style={{ ...pxPanel, background: '#fffdf7', padding: size * 0.05, lineHeight: 0, position: 'relative' }}>
          <Picture scene={sc} size={size} filled={Object.fromEntries(sc.regions.map(r => [r.id, true]))} mini />
          <motion.div animate={reduceMotion() ? undefined : { y: [0, -size * 0.25, 0] }}
            transition={{ duration: 0.5, delay: 0.6 + i * 0.18, repeat: 2, repeatDelay: 0.4 }}
            style={{ position: 'absolute', left: `${4 + sc.seat[0] / 200 * 92}%`, top: `${4 + sc.seat[1] / 200 * 92}%`, marginLeft: -size * 0.17, marginTop: -size * 0.3 }}>
            <Art art={sc.client} size={Math.round(size * 0.34)} />
          </motion.div>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PainterGame({ level = 1, onComplete }) {
  const [scenes]    = useState(() => buildScenes(level))
  const [sceneIdx,  setSceneIdx]  = useState(0)
  const [partIdx,   setPartIdx]   = useState(0)
  const [filled,    setFilled]    = useState({})     // { regionId: true }
  const [flash,     setFlash]     = useState(0)      // the wished part shows its colour (after a mix-up)
  const [splat,     setSplat]     = useState(null)   // { color, n }: paint on the customer
  const [movedIn,   setMovedIn]   = useState(false)  // the picture is done, the customer moved in
  const [ended,     setEnded]     = useState(false)  // all pictures done: the gallery
  const [next,      setNext]      = useState(null)   // 'part' | 'scene' | 'end': what comes once the payoff played
  const [acted,     setActed]     = useState(false)  // a pot was poured (the hand waits longer then)
  const [bowl,      setBowl]      = useState({ n: 0 }) // the mixing bowl: { a, b, out, n }
  const [fx,        setFx]        = useState({})     // what the moved-in customer does: { lit, bites, gone }
  const [mood,      setMood]      = useMood()
  const paused = usePaused()
  const [bursts, burst] = useBursts()
  const [boxRef, box] = useBox()
  const easelRef = useRef(null)
  const potsRef  = useRef(null)
  const potEls   = useRef({})                         // each pot, by colour (the hand after a miss)
  const [rootRef, clear] = useSceneClear(714, 246)   // the room's window
  const missed   = useRef(new Set())                  // `${scene}/${part}` painted wrong first
  const streak   = useRef(0)                          // parts right at the first try in a row
  const timers   = useRef([])

  const scene   = scenes[sceneIdx]
  const parts   = useMemo(() => partsOf(scene), [scene])
  const part    = movedIn ? null : parts[partIdx]
  const palette = useMemo(() => buildPalette(scene, level), [scene, level])
  const total   = useMemo(() => scenes.reduce((n, s) => n + partsOf(s).length, 0), [scenes])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  // A new wish is a new task
  useEffect(() => { if (part) sayTask() }, [sceneIdx, partIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // After the payoff has played: the next wish, the next customer, or the
  // gallery and the results — held while the help is open
  useEffect(() => {
    if (!next || paused) return
    const id = setTimeout(() => {
      setNext(null)
      setFlash(0)
      if (next === 'part') setPartIdx(i => i + 1)
      else if (next === 'end') onComplete(result(total - missed.current.size, total))
      else if (sceneIdx + 1 >= scenes.length) {
        setEnded(true)
        setNext('end')
        sfx.complete()
        burst(boxRef.current, 'confetti', 24)
      } else {
        setSceneIdx(i => i + 1)
        setPartIdx(0)
        setFilled({})
        setMovedIn(false)
        setSplat(null)
        setFx({})
        setBowl(b => ({ n: b.n + 1 }))
        setMood('idle')
      }
    }, { part: 1000, scene: 3200, end: 3000 }[next])
    return () => clearTimeout(id)
  }, [next, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // A pot poured onto the picture: taken if it is the wished colour
  const pour = (color) => {
    if (!part || next) return false
    setActed(true)
    if (color.name !== part.target) {
      missed.current.add(`${scene.id}/${part.name}`)
      streak.current = 0
      setFlash(Date.now())
      setSplat({ color: color.value, n: Date.now() })
      setMood('oops', 2300)
      sfx.splash()
      // it drips a while, then the customer shakes it off with a laugh
      timers.current.push(setTimeout(() => { setMood('happy', 900); sfx.giggle() }, 2350))
      sayWrong()
      return false
    }
    const first = !missed.current.has(`${scene.id}/${part.name}`)
    streak.current = first ? streak.current + 1 : 0
    if (color.mixed) setBowl(b => ({ n: b.n + 1 }))
    setFilled(f => ({ ...f, ...Object.fromEntries(part.regions.map(r => [r.id, true])) }))
    burst(easelRef.current, 'stars')
    sayRight()
    if (streak.current >= 3) sfx.combo(streak.current)
    if (partIdx + 1 < parts.length) {
      setMood(streak.current >= 3 ? 'dance' : 'happy', 1000)
      if (streak.current && streak.current % 5 === 0) burst(easelRef.current, 'confetti', 16)
      setNext('part')
    } else {
      // all painted: the customer moves in
      setMovedIn(true)
      setMood('idle')
      sfx.tada()
      timers.current.push(setTimeout(() => burst(easelRef.current, 'confetti', 16), 700))
      // and uses it: the mouse goes in and the light comes on, the
      // caterpillar takes bites, the bear gets hugged, the sun and the star
      // sparkle, the bee buzzes round the flower
      const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
      if (scene.use === 'light') { at(1300, () => { setFx({ gone: true }); sfx.pop() }); at(1700, () => { setFx({ gone: true, lit: true }); sfx.sparkle() }) }
      if (scene.use === 'bite') [1000, 1450, 1900].forEach((ms, k) => at(ms, () => { setFx({ bites: k + 1 }); sfx.chomp() }))
      if (scene.use === 'hearts') [1000, 1700].forEach(ms => at(ms, () => burst(easelRef.current, 'hearts', 10)))
      if (scene.use === 'sparkle') [1000, 1600].forEach(ms => at(ms, () => { burst(easelRef.current, 'stars', 12); sfx.sparkle() }))
      setNext('scene')
    }
    return true
  }

  // A pot into the mixing bowl: the first colour waits, the second mixes
  const addToBowl = (color) => {
    if (color.mixed) return false
    if (!bowl.a || bowl.out) { setBowl({ a: color, n: bowl.n + 1 }); sfx.pop(); return true }
    setBowl({ a: bowl.a, b: color, out: getColor(mix(bowl.a.name, color.name)), n: bowl.n + 1 })
    sfx.sparkle()
    return true
  }

  // Customer beside the easel when there is room, above it otherwise
  const wide = box.w > box.h * 1.15
  const critter = Math.round(Math.max(84, Math.min(170, wide ? box.w * 0.2 : box.h * 0.2)))
  const easel = Math.max(120, Math.floor(Math.min(560,
    wide ? Math.min(box.w - critter * 1.6, box.h - 8) : Math.min(box.w - 8, box.h - critter * 1.25))))
  const mini = Math.round(Math.max(56, Math.min(96, critter * 0.6)))
  const colour = part && getColor(part.target)
  const potSize = box.w < 420 ? 52 : palette.length <= 6 ? 80 : 64
  const bowlSize = Math.round(Math.max(60, Math.min(96, critter * 0.62)))
  // after a miss the hand starts at the pot of the wished colour
  const missedNow = part && missed.current.has(`${scene.id}/${part.name}`)

  return (
    <DragArea disabled={paused || !!next || movedIn}>
      <div ref={rootRef} style={{
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: 'clamp(8px,1.5vw,16px) clamp(10px,2.5vw,24px)',
        gap: 'clamp(6px,1.2vh,12px)', userSelect: 'none',
      }}>
        {/* the trail ends left of the window in the wall */}
        <div style={clear ? { width: '100%', maxWidth: Math.min(760, clear.x - 48), alignSelf: 'flex-start', flexShrink: 0 } : { width: '100%', maxWidth: 760, flexShrink: 0 }}>
          <RoundTrail total={scenes.length} done={sceneIdx + (movedIn || ended ? 1 : 0)} walker="🖌️" goal="🖼️" />
        </div>

        {/* the customer and the easel, or at the end the gallery */}
        <div ref={boxRef} style={{
          flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: wide ? 'row' : 'column', gap: wide ? critter * 0.4 : 8,
        }}>
          {ended ? (
            <Gallery scenes={scenes} size={Math.floor(Math.min(260, Math.max(90, Math.sqrt(box.w * box.h / scenes.length) * 0.66)))} />
          ) : <>
            <div style={{
              width: wide ? critter * 1.2 : '100%', height: wide ? Math.min(box.h, critter * 1.9 + bowlSize + 30) : critter * 1.25,
              flexShrink: 0, display: 'flex', flexDirection: wide ? 'column' : 'row', alignItems: wide ? 'center' : 'flex-end',
              justifyContent: wide ? 'flex-end' : 'space-between', gap: 10, padding: wide ? 0 : '0 4% 0 6%', boxSizing: 'border-box',
            }}>
              <AnimatePresence mode="wait">
                {!movedIn && box.w > 0 && (
                  <motion.div key={scene.id}
                    initial={{ x: -260, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                    exit={{ x: wide ? 220 : 80, y: wide ? 0 : 120, scale: 0.4, opacity: 0, transition: { duration: 0.45 } }}
                    transition={{ type: 'spring', stiffness: 140, damping: 16 }}>
                    <Customer art={scene.client} size={critter} mood={mood}
                      wishSide={wide ? 'top' : 'right'}
                      wish={part && (
                        <motion.div key={part.name} initial={{ scale: 0.6 }} animate={{ scale: 1 }} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Picture scene={scene} size={mini} filled={filled} want={part} mini />
                          <svg width={mini * 0.42} height={mini * 0.5} viewBox="0 0 20 24" aria-hidden="true">
                            <path d="M10 1 Q19 13 18 16 A8 8 0 0 1 2 16 Q1 13 10 1 Z" fill={colour.value} stroke={INK} strokeWidth="1.6" />
                          </svg>
                        </motion.div>
                      )}>
                      {splat && <Splat key={splat.n} color={splat.color} size={critter} />}
                    </Customer>
                  </motion.div>
                )}
              </AnimatePresence>
              {!movedIn && box.w > 0 && <MixBowl bowl={bowl} size={bowlSize} onAdd={addToBowl} />}
            </div>

            {box.w > 0 && <DropZone id="easel" onDrop={pour} label="Bild" style={{ flexShrink: 0 }}>
              {hover => (
                <AnimatePresence mode="wait">
                  <motion.div key={scene.id} ref={easelRef}
                    initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                    style={{ position: 'relative' }}>
                    <div style={{ ...pxPanel, background: '#fffdf7', padding: easel * 0.04, lineHeight: 0, position: 'relative',
                      boxShadow: hover ? '0 0 0 6px #ffc93c, 0 5px 0 rgba(42,27,61,0.35)' : pxPanel.boxShadow, transition: 'box-shadow .2s' }}>
                      {/* the picture and its new owner go off together (the balloon lifts the bunny away) */}
                      <motion.div animate={movedIn && !reduceMotion() ? ACT[scene.act] : { x: 0, y: 0, rotate: 0, opacity: 1 }} style={{ position: 'relative' }}>
                        <Picture scene={scene} size={easel - easel * 0.08 - 6} filled={filled} want={part} flash={flash} fx={fx} />
                        {/* the customer, moved in */}
                        {movedIn && (
                          <motion.div initial={{ x: -easel * 0.6, y: -easel * 0.3, scale: 1.6, opacity: 0 }}
                            animate={fx.gone ? { x: 0, y: 0, scale: 0, opacity: 0 }
                              : scene.use === 'buzz' && !reduceMotion() ? { x: [0, easel * 0.25, 0, -easel * 0.25, 0], y: [0, -easel * 0.15, -easel * 0.3, -easel * 0.15, 0], scale: 1, opacity: 1 }
                              : { x: 0, y: 0, scale: 1, opacity: 1 }}
                            transition={scene.use === 'buzz' && !fx.gone ? { duration: 1.4, repeat: 1, delay: 0.6 } : { type: 'spring', stiffness: 160, damping: 14 }}
                            style={{ position: 'absolute', left: `${scene.seat[0] / 200 * 100}%`, top: `${scene.seat[1] / 200 * 100}%`, marginLeft: -easel * 0.12, marginTop: -easel * 0.2 }}>
                            <Art art={scene.client} size={Math.round(easel * 0.24)} />
                          </motion.div>
                        )}
                      </motion.div>
                    </div>
                  </motion.div>
                </AnimatePresence>
              )}
            </DropZone>}
          </>}
        </div>

        {/* the paint pots */}
        <div style={{ ...pxPanel, position: 'relative', flexShrink: 0, padding: '6px 8px', width: '100%', maxWidth: 900, boxSizing: 'border-box', visibility: ended ? 'hidden' : undefined }}>
          {/* where the hand starts: the edge of the pots, not one of them */}
          <div ref={potsRef} aria-hidden="true" style={{ position: 'absolute', left: '50%', top: -4, width: 1, height: 1 }} />
          <motion.div key={scene.id} initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            style={{ display: 'flex', flexWrap: 'wrap', gap: '4px clamp(4px,1.2vw,14px)', justifyContent: 'center' }}>
            {palette.map(c => (
              // the ref outside the draggable: the kit's flying copy would take it along
              <div key={c.name} ref={el => { potEls.current[c.name] = el }}>
                <Draggable id={c.name} data={c} label={c.name}>
                  <Pot color={c.value} name={c.name} size={potSize} />
                </Draggable>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
      <HintHand from={missedNow ? potEls.current[part.target] : potsRef} to={easelRef} active={!!part && !next} delay={missedNow ? 3000 : acted ? 6000 : 2000} />
      {bursts}
    </DragArea>
  )
}
