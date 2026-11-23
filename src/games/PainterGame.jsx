import { useState, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HearOptions from '../components/HearOptions.jsx'
import { Critter, Art, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts, useDragState } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { pxPanel, INK } from './px.js'

/**
 * Farbenreich: "Malerauftrag" — Farbwörter beim Malen nach Wunsch.
 *
 * A customer comes to the paint shop: the mouse wants a house, the
 * caterpillar an apple. It wishes for one part at a time ("Mach das Dach
 * bitte rot!"); its speech bubble shows the picture with that part in the
 * colour. The child drags the paint pot of that colour onto the picture
 * (or taps the pot, then the picture), and the part fills with paint. A
 * wrong pot bounces back and splashes the customer, and the part shows the
 * colour it wants. When everything is painted, the customer moves in: it
 * hops onto the picture, and off they go. Every pot says its colour when
 * picked up, and every painted part says what it became ("Das Dach ist
 * jetzt rot!").
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

// ─── Words ────────────────────────────────────────────────────────────────────
// Region names carry their article; pairs (ears, eyes) are one plural name
// and one wish: "Mach die Ohren bitte braun!" paints both.
const cap = s => s[0].toUpperCase() + s.slice(1)
const acc = p => (!p.pl && p.name.startsWith('der ') ? 'den ' + p.name.slice(4) : p.name)
const verb = (p, sg, pl) => (p.pl ? pl : sg)
const word = colorName => colorName.toLowerCase()
const wish = p => `Mach ${acc(p)} bitte ${word(p.target)}!`

// The parts of a picture in order: regions with the same name are one part
function partsOf(scene) {
  const parts = []
  scene.regions.forEach(r => {
    const p = parts.find(x => x.name === r.name)
    if (p) p.regions.push(r)
    else parts.push({ name: r.name, pl: !!r.pl, target: r.target, regions: [r] })
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
    id: 'house', thing: 'das Haus', level: 1,
    client: '🐭', intro: 'Die Maus sucht ein neues Haus.', done: 'Die Maus zieht ein!', seat: [100, 174], act: 'bounce',
    regions: [
      { id: 'wall',   target: 'Orange', name: 'die Wand',    element: 'rect',    x: 30,  y: 110, width: 140, height: 70 },
      { id: 'roof',   target: 'Rot',    name: 'das Dach',    element: 'polygon', points: '15,115 100,36 185,115' },
      { id: 'door',   target: 'Braun',  name: 'die Tür',     element: 'rect',    x: 83,  y: 140, width: 34,  height: 40 },
      { id: 'window', target: 'Blau',   name: 'das Fenster', element: 'rect',    x: 42,  y: 120, width: 34,  height: 28, rx: 4 },
    ],
  },
  {
    id: 'apple', thing: 'der Apfel', level: 1,
    client: '🐛', intro: 'Die Raupe hat Hunger auf einen Apfel.', done: 'Die Raupe zieht in den Apfel ein!', seat: [122, 112], act: 'bounce',
    regions: [
      { id: 'body', target: 'Rot',   name: 'der Apfel', element: 'circle',  cx: 100, cy: 118, r: 65 },
      { id: 'leaf', target: 'Grün',  name: 'das Blatt', element: 'ellipse', cx: 122, cy: 52,  rx: 22, ry: 12, transform: 'rotate(-35,122,52)' },
      { id: 'stem', target: 'Braun', name: 'der Stiel', element: 'rect',    x: 97,   y: 38,   width: 7, height: 20, rx: 3 },
    ],
  },
  {
    id: 'sun', thing: 'die Sonne', level: 1,
    client: '🦔', intro: 'Dem Igel ist kalt. Er wünscht sich eine Sonne.', done: 'Der Igel wärmt sich in der Sonne.', seat: [100, 182], act: 'float',
    regions: [
      { id: 'rays', target: 'Orange', name: 'die Strahlen', pl: true, element: 'polygon',
        points: '100,10 117,58 164,36 142,83 190,100 142,117 164,164 117,142 100,190 83,142 36,164 58,117 10,100 58,83 36,36 83,58' },
      { id: 'disc', target: 'Gelb',   name: 'die Sonne',   element: 'circle', cx: 100, cy: 100, r: 44 },
    ],
  },
  {
    id: 'balloon', thing: 'der Ballon', level: 1,
    client: '🐰', intro: 'Der Hase möchte fliegen und braucht einen Ballon.', done: 'Der Hase fliegt mit dem Ballon davon!', seat: [100, 192], act: 'float',
    regions: [
      { id: 'ball',   target: 'Rot',  name: 'der Ballon',  element: 'ellipse', cx: 100, cy: 80, rx: 55, ry: 65 },
      { id: 'knot',   target: 'Gelb', name: 'der Knoten',  element: 'circle',  cx: 100, cy: 145, r: 7 },
      { id: 'string', target: 'Grau', name: 'die Schnur',  element: 'rect',    x: 98, y: 152, width: 4, height: 44, rx: 2 },
    ],
  },
  {
    id: 'star', thing: 'der Stern', level: 1,
    client: '🦉', intro: 'Die Eule wünscht sich einen Stern für die Nacht.', done: 'Die Eule sitzt auf ihrem Stern.', seat: [100, 104], act: 'float',
    regions: [
      { id: 'body', target: 'Gelb', name: 'der Stern', element: 'polygon',
        points: '100,18 121,70 176,70 132,103 148,158 100,125 52,158 68,103 24,70 79,70' },
    ],
  },
  // ── Level 2 ──
  {
    id: 'butterfly', thing: 'der Schmetterling', level: 2,
    client: '🐞', intro: 'Der Marienkäfer sucht einen Freund zum Fliegen.', done: 'Der Marienkäfer fliegt mit dem Schmetterling davon!', seat: [100, 84], act: 'float',
    regions: [
      { id: 'wing-tl', target: 'Lila',   name: 'die oberen Flügel',  pl: true, element: 'ellipse', cx: 62,  cy: 76,  rx: 48, ry: 30, transform: 'rotate(-30,62,76)'  },
      { id: 'wing-tr', target: 'Lila',   name: 'die oberen Flügel',  pl: true, element: 'ellipse', cx: 138, cy: 76,  rx: 48, ry: 30, transform: 'rotate(30,138,76)'   },
      { id: 'wing-bl', target: 'Orange', name: 'die unteren Flügel', pl: true, element: 'ellipse', cx: 68,  cy: 138, rx: 38, ry: 24, transform: 'rotate(25,68,138)'   },
      { id: 'wing-br', target: 'Orange', name: 'die unteren Flügel', pl: true, element: 'ellipse', cx: 132, cy: 138, rx: 38, ry: 24, transform: 'rotate(-25,132,138)' },
      { id: 'body',    target: 'Braun',  name: 'der Körper',         element: 'ellipse', cx: 100, cy: 107, rx: 8,  ry: 36 },
    ],
  },
  {
    id: 'fish', thing: 'der Fisch', level: 2,
    client: '🐙', intro: 'Der Krake wünscht sich einen Fisch zum Spielen.', done: 'Der Krake und der Fisch schwimmen um die Wette!', seat: [158, 150], act: 'swim',
    regions: [
      { id: 'body', target: 'Blau',     name: 'der Fisch',          element: 'ellipse', cx: 88,  cy: 100, rx: 62, ry: 42 },
      { id: 'tail', target: 'Türkis',   name: 'die Schwanzflosse',  element: 'polygon', points: '148,100 178,68 178,132' },
      { id: 'fin',  target: 'Hellgrün', name: 'die Rückenflosse',   element: 'polygon', points: '72,58 88,42 108,56' },
      { id: 'eye',  target: 'Schwarz',  name: 'das Auge',           element: 'circle',  cx: 52,  cy: 93,  r: 10 },
    ],
  },
  {
    id: 'bear', thing: 'der Bär', level: 2,
    client: '🐿️', intro: 'Das Eichhörnchen wünscht sich einen Teddybären.', done: 'Das Eichhörnchen kuschelt mit dem Bären!', seat: [100, 160], act: 'bounce',
    regions: [
      { id: 'ear-l',  target: 'Braun',     name: 'die Ohren',    pl: true, element: 'circle',  cx: 65,  cy: 45,  r: 22 },
      { id: 'ear-r',  target: 'Braun',     name: 'die Ohren',    pl: true, element: 'circle',  cx: 135, cy: 45,  r: 22 },
      { id: 'body',   target: 'Braun',     name: 'der Körper',   element: 'ellipse', cx: 100, cy: 148, rx: 52, ry: 45 },
      { id: 'head',   target: 'Braun',     name: 'der Kopf',     element: 'circle',  cx: 100, cy: 80,  r: 44 },
      { id: 'muzzle', target: 'Hellbraun', name: 'die Schnauze', element: 'ellipse', cx: 100, cy: 94,  rx: 22, ry: 15 },
      { id: 'eye-l',  target: 'Schwarz',   name: 'die Augen',    pl: true, element: 'circle',  cx: 86,  cy: 73,  r: 7 },
      { id: 'eye-r',  target: 'Schwarz',   name: 'die Augen',    pl: true, element: 'circle',  cx: 114, cy: 73,  r: 7 },
    ],
  },
  {
    id: 'frog', thing: 'der Frosch', level: 2,
    client: '🦆', intro: 'Die Ente wünscht sich einen Frosch zum Spielen.', done: 'Die Ente und der Frosch hüpfen in den Teich!', seat: [158, 120], act: 'bounce',
    regions: [
      { id: 'body',    target: 'Grün',    name: 'der Frosch',   element: 'ellipse', cx: 100, cy: 125, rx: 55, ry: 45 },
      { id: 'eye-l',   target: 'Weiß',    name: 'die Augen',    pl: true, element: 'circle',  cx: 75,  cy: 80,  r: 18 },
      { id: 'eye-r',   target: 'Weiß',    name: 'die Augen',    pl: true, element: 'circle',  cx: 125, cy: 80,  r: 18 },
      { id: 'pupil-l', target: 'Schwarz', name: 'die Pupillen', pl: true, element: 'circle',  cx: 75,  cy: 83,  r: 8 },
      { id: 'pupil-r', target: 'Schwarz', name: 'die Pupillen', pl: true, element: 'circle',  cx: 125, cy: 83,  r: 8 },
      { id: 'mouth',   target: 'Rot',     name: 'der Mund',     element: 'ellipse', cx: 100, cy: 145, rx: 22, ry: 10 },
    ],
  },
  // ── Level 3 ──
  {
    id: 'rocket', thing: 'die Rakete', level: 3,
    client: '👨‍🚀', intro: 'Der Astronaut möchte zum Mond fliegen.', done: 'Der Astronaut steigt ein. Drei, zwei, eins, los!', seat: [100, 104], act: 'float',
    regions: [
      { id: 'body',   target: 'Grau',   name: 'der Rumpf',   element: 'rect',    x: 72,  y: 70, width: 56, height: 88, rx: 8 },
      { id: 'nose',   target: 'Rot',    name: 'die Spitze',  element: 'polygon', points: '72,70 100,14 128,70' },
      { id: 'wing-l', target: 'Orange', name: 'die Flügel',  pl: true, element: 'polygon', points: '72,128 38,170 72,158' },
      { id: 'wing-r', target: 'Orange', name: 'die Flügel',  pl: true, element: 'polygon', points: '128,128 162,170 128,158' },
      { id: 'window', target: 'Blau',   name: 'das Fenster', element: 'circle',  cx: 100, cy: 98, r: 20 },
      { id: 'flame',  target: 'Gelb',   name: 'die Flamme',  element: 'polygon', points: '80,158 100,196 120,158' },
    ],
  },
  {
    id: 'penguin', thing: 'der Pinguin', level: 3,
    client: '🐤', intro: 'Das Küken wünscht sich einen Pinguin als Freund.', done: 'Das Küken und der Pinguin watscheln los!', seat: [150, 178], act: 'swim',
    regions: [
      { id: 'body',  target: 'Schwarz', name: 'der Körper',   element: 'ellipse', cx: 100, cy: 120, rx: 56, ry: 66 },
      { id: 'belly', target: 'Weiß',    name: 'der Bauch',    element: 'ellipse', cx: 100, cy: 125, rx: 32, ry: 48 },
      { id: 'beak',  target: 'Orange',  name: 'der Schnabel', element: 'polygon', points: '88,96 100,111 112,96 100,84' },
      { id: 'feet',  target: 'Orange',  name: 'die Füße',     pl: true, element: 'polygon', points: '60,178 50,193 82,189 78,178 122,178 118,189 150,193 140,178' },
      // white eyes: black ones on the black body could not be seen
      { id: 'eye-l', target: 'Weiß',    name: 'die Augen',    pl: true, element: 'circle',  cx: 86,  cy: 96,  r: 6 },
      { id: 'eye-r', target: 'Weiß',    name: 'die Augen',    pl: true, element: 'circle',  cx: 114, cy: 96,  r: 6 },
    ],
  },
  {
    id: 'flower', thing: 'die Blume', level: 3,
    client: '🐝', intro: 'Die Biene sucht eine Blume.', done: 'Die Biene landet auf der Blume. Summ, summ!', seat: [100, 96], act: 'bounce',
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
function Picture({ scene, size, filled, want, flash, mini = false }) {
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
function Splat({ color, size }) {
  return (
    <motion.svg viewBox="0 0 60 60" width={size * 0.5} height={size * 0.5} aria-hidden="true"
      initial={{ scale: 0, opacity: 1 }} animate={{ scale: [0, 1.2, 1], opacity: [1, 1, 1, 0] }} transition={{ duration: 1.6, times: [0, 0.15, 0.3, 1] }}
      style={{ position: 'absolute', left: '28%', top: '22%', pointerEvents: 'none', zIndex: 4 }}>
      <path d="M30 6 Q36 18 44 10 Q42 22 56 22 Q44 30 54 42 Q40 38 38 54 Q30 42 22 54 Q20 40 6 44 Q16 32 4 22 Q18 22 16 10 Q24 18 30 6 Z"
        fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
    </motion.svg>
  )
}

// Says a pot's colour when the child picks it up with a tap
function SayPicked() {
  const { picked } = useDragState()
  const name = picked?.data?.name
  useEffect(() => { if (name) narrate([{ text: `${name}.` }], { skipIfSame: true }) }, [name])
  return null
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
  bounce: { y: [0, -30, 0, -16, 0], rotate: [0, -4, 4, 0, 0], transition: { duration: 1.2, delay: 0.7 } },
  float:  { y: [0, -24, -60, -30, 0], rotate: [0, 3, -3, 2, 0], transition: { duration: 2.2, delay: 0.7 } },
  swim:   { x: [0, -24, 24, -16, 0], rotate: [0, -5, 5, -3, 0], transition: { duration: 1.8, delay: 0.7 } },
}
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// ─── Main component ───────────────────────────────────────────────────────────
export default function PainterGame({ level = 1, onComplete }) {
  const [scenes]    = useState(() => buildScenes(level))
  const [sceneIdx,  setSceneIdx]  = useState(0)
  const [partIdx,   setPartIdx]   = useState(0)
  const [filled,    setFilled]    = useState({})     // { regionId: true }
  const [flash,     setFlash]     = useState(0)      // the wished part shows its colour (after a mix-up)
  const [splat,     setSplat]     = useState(null)   // { color, n }: paint on the customer
  const [movedIn,   setMovedIn]   = useState(false)  // the picture is done, the customer moved in
  const [next,      setNext]      = useState(null)   // 'part' | 'scene': what comes once the praise was said
  const [mood,      setMood]      = useMood()
  const paused = usePaused()
  const [bursts, burst] = useBursts()
  const [boxRef, box] = useBox()
  const easelRef = useRef(null)
  const missed   = useRef(new Set())                  // `${scene}/${part}` painted wrong first
  const waiting  = useRef(null)

  const scene   = scenes[sceneIdx]
  const parts   = useMemo(() => partsOf(scene), [scene])
  const part    = movedIn ? null : parts[partIdx]
  const palette = useMemo(() => buildPalette(scene, level), [scene, level])
  const total   = useMemo(() => scenes.reduce((n, s) => n + partsOf(s).length, 0), [scenes])
  useEffect(() => () => waiting.current?.(), [])

  // A new customer: who it is and its first wish
  useEffect(() => {
    lockPreviews()
    const first = partsOf(scene)[0]
    const how = sceneIdx === 0 ? ' Zieh den richtigen Farbtopf auf das Bild.' : ''
    const id = setTimeout(() => sayTask(`${scene.intro} ${wish(first)}${how}`), 650)
    return () => clearTimeout(id)
  }, [sceneIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // The next wish (it was already said with the praise), or after the
  // customer moved in the next customer — held while the help is open
  useEffect(() => {
    if (!next || paused) return
    const id = setTimeout(() => {
      setNext(null)
      if (next === 'part') setPartIdx(i => i + 1)
      else if (sceneIdx + 1 >= scenes.length) {
        onComplete(result(total - missed.current.size, total))
      } else {
        setSceneIdx(i => i + 1)
        setPartIdx(0)
        setFilled({})
        setMovedIn(false)
      }
    }, next === 'part' ? 900 : 300)
    return () => clearTimeout(id)
  }, [next, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // A pot poured onto the picture: taken if it is the wished colour
  const pour = (color) => {
    if (!part || next) return false
    const want = getColor(part.target)
    if (color.name !== part.target) {
      missed.current.add(`${scene.id}/${part.name}`)
      setFlash(Date.now())
      setSplat({ color: color.value, n: Date.now() })
      setMood('oops', 1500)
      sfx.splash()
      sayWrong(`Das ist ${word(color.name)}. ${cap(part.name)} ${verb(part, 'soll', 'sollen')} ${word(want.name)} sein.`)
      return false
    }
    setFilled(f => ({ ...f, ...Object.fromEntries(part.regions.map(r => [r.id, true])) }))
    burst(easelRef.current, 'stars')
    const said = `${cap(part.name)} ${verb(part, 'ist', 'sind')} jetzt ${word(want.name)}!`
    if (partIdx + 1 < parts.length) {
      // the next wish right away, while the paint still flows
      setMood('happy', 1200)
      sayRight(`${said} ${wish(parts[partIdx + 1])}`)
      setNext('part')
    } else {
      // all painted: the customer moves in
      setMovedIn(true)
      setMood('dance', 4000)
      sfx.tada()
      setTimeout(() => burst(easelRef.current, 'confetti', 16), 700)
      sayRight(`${said} Super gemalt! ${cap(scene.thing)} ist fertig. ${scene.done}`)
      waiting.current?.()
      waiting.current = afterNarration(() => setNext('scene'), { minMs: 2200 })
    }
    return true
  }

  // Customer beside the easel when there is room, above it otherwise
  const wide = box.w > box.h * 1.15
  const critter = Math.round(Math.max(84, Math.min(170, wide ? box.w * 0.2 : box.h * 0.2)))
  const easel = Math.max(120, Math.floor(Math.min(560,
    wide ? Math.min(box.w - critter * 1.6, box.h - 8) : Math.min(box.w - 8, box.h - critter * 1.25))))
  const mini = Math.round(Math.max(56, Math.min(96, critter * 0.6)))
  const colour = part && getColor(part.target)

  return (
    <DragArea disabled={paused || !!next || movedIn}>
      <SayPicked />
      {/* relative + zIndex: above GameScreen's backdrop, which is positioned */}
      <div style={{
        position: 'relative', zIndex: 1,
        flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: 'clamp(8px,1.5vw,16px) clamp(10px,2.5vw,24px)',
        gap: 'clamp(6px,1.2vh,12px)', userSelect: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 760, flexShrink: 0 }}>
          <RoundTrail total={scenes.length} done={sceneIdx + (movedIn ? 1 : 0)} walker="🖌️" goal="🖼️" style={{ flex: 1 }} />
          <HearOptions items={[part ? wish(part) : scene.done]} label="Wunsch anhören" size={52} />
        </div>

        {/* the customer and the easel */}
        <div ref={boxRef} style={{
          flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: wide ? 'row' : 'column', gap: wide ? critter * 0.4 : 8,
        }}>
          <div style={{ width: wide ? critter * 1.2 : '100%', height: critter * (wide ? 1.9 : 1.25), flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: wide ? 'center' : 'flex-start', paddingLeft: wide ? 0 : '6%' }}>
            <AnimatePresence mode="wait">
              {!movedIn && box.w > 0 && (
                <motion.div key={scene.id}
                  initial={{ x: -260, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
                  exit={{ x: wide ? 220 : 80, y: wide ? 0 : 120, scale: 0.4, opacity: 0, transition: { duration: 0.45 } }}
                  transition={{ type: 'spring', stiffness: 140, damping: 16 }}>
                  <Critter art={scene.client} size={critter} mood={mood} talks
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
                  </Critter>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <DropZone id="easel" onDrop={pour} label="Bild" style={{ flexShrink: 0 }}>
            {hover => (
              <AnimatePresence mode="wait">
                <motion.div key={scene.id} ref={easelRef}
                  initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.85, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 24 }}
                  style={{ position: 'relative' }}>
                  <motion.div animate={movedIn && !reduceMotion() ? ACT[scene.act] : { x: 0, y: 0, rotate: 0 }}
                    style={{ ...pxPanel, background: '#fffdf7', padding: easel * 0.04, lineHeight: 0, position: 'relative',
                      boxShadow: hover ? '0 0 0 6px #ffc93c, 0 5px 0 rgba(42,27,61,0.35)' : pxPanel.boxShadow, transition: 'box-shadow .2s' }}>
                    <Picture scene={scene} size={easel - easel * 0.08 - 6} filled={filled} want={part} flash={flash} />
                    {/* the customer, moved in */}
                    {movedIn && (
                      <motion.div initial={{ x: -easel * 0.6, y: -easel * 0.3, scale: 1.6, opacity: 0 }}
                        animate={{ x: 0, y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 160, damping: 14 }}
                        style={{ position: 'absolute', left: `${4 + scene.seat[0] / 200 * 92}%`, top: `${4 + scene.seat[1] / 200 * 92}%`, marginLeft: -easel * 0.12, marginTop: -easel * 0.2 }}>
                        <Art art={scene.client} size={Math.round(easel * 0.24)} />
                      </motion.div>
                    )}
                  </motion.div>
                </motion.div>
              </AnimatePresence>
            )}
          </DropZone>
        </div>

        {/* the paint pots */}
        <div style={{ ...pxPanel, flexShrink: 0, padding: '6px 8px', width: '100%', maxWidth: 760, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px clamp(4px,1.2vw,14px)', justifyContent: 'center' }}>
            {palette.map(c => (
              <Draggable key={c.name} id={c.name} data={c} label={c.name}>
                <Pot color={c.value} name={c.name} size={box.w < 420 ? 52 : 60} />
              </Draggable>
            ))}
          </div>
        </div>
      </div>
      {bursts}
    </DragArea>
  )
}
