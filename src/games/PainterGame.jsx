import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

// ─── Brush constants ──────────────────────────────────────────────────────────
const BRUSH_R    = 8                       // brush dot radius in SVG user-units (viewBox 200×200)
const MIN_DIST   = 4                       // min distance (SVG units) between consecutive stroke points
const GRID       = 8                       // coverage grid cell size in SVG units
const COLS       = Math.ceil(200 / GRID)   // 25
const ROWS       = Math.ceil(200 / GRID)   // 25
const COVER_FRAC  = 0.90                    // fraction of inside-cells that must be painted
const EDGE_MARGIN = 3                       // extra px margin so edge cells are included in inside set

// ─── Colours ──────────────────────────────────────────────────────────────────
const ALL_COLORS = [
  { name: 'Rot',      value: '#E53935' },
  { name: 'Blau',     value: '#1E88E5' },
  { name: 'Grün',     value: '#43A047' },
  { name: 'Gelb',     value: '#FDD835' },
  { name: 'Orange',   value: '#FB8C00' },
  { name: 'Lila',     value: '#8E24AA' },
  { name: 'Pink',     value: '#E91E63' },
  { name: 'Braun',    value: '#6D4C41' },
  { name: 'Türkis',   value: '#00ACC1' },
  { name: 'Grau',     value: '#90A4AE' },
  { name: 'Hellgrün', value: '#7CB342' },
  { name: 'Schwarz',  value: '#37474F' },
]

function getColor(name) {
  return ALL_COLORS.find(c => c.name === name) ?? ALL_COLORS[0]
}

function isLight(hex) {
  if (!hex || hex.length < 7) return true
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return (r * 299 + g * 587 + b * 114) / 1000 > 155
}

function buildPalette(scene, level) {
  const needed = [...new Set(scene.regions.map(r => r.target))].map(getColor)
  const extra  = shuffle(ALL_COLORS.filter(c => !needed.find(n => n.name === c.name)))
    .slice(0, Math.min(2 + level, 5))
  return shuffle([...needed, ...extra])
}

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// ─── Convert screen coords → SVG user-space ───────────────────────────────────
function clientToSVG(svgEl, clientX, clientY) {
  if (!svgEl) return null
  const ctm = svgEl.getScreenCTM()
  if (!ctm) return null
  const inv = ctm.inverse()
  return {
    x: inv.a * clientX + inv.c * clientY + inv.e,
    y: inv.b * clientX + inv.d * clientY + inv.f,
  }
}

// ─── Coverage helpers: point-in-region & grid cell pre-computation ────────────
function pointInPolygon(px, py, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x, yi = points[i].y
    const xj = points[j].x, yj = points[j].y
    const cross = ((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)
    if (cross) inside = !inside
  }
  return inside
}

function isInsideRegion(region, px, py, margin = 0) {
  switch (region.element) {
    case 'circle':
      return (px - region.cx) ** 2 + (py - region.cy) ** 2 <= (region.r + margin) ** 2
    case 'ellipse': {
      let tx = px, ty = py
      if (region.transform) {
        const m = region.transform.match(/rotate\(([-\d.]+),\s*([-\d.]+),\s*([-\d.]+)\)/)
        if (m) {
          // Inverse of rotate(a, ox, oy): apply rotate(-a, ox, oy)
          const rad = parseFloat(m[1]) * Math.PI / 180
          const ox  = parseFloat(m[2]), oy = parseFloat(m[3])
          const dx  = px - ox, dy = py - oy
          tx = dx * Math.cos(rad) + dy * Math.sin(rad) + ox
          ty = -dx * Math.sin(rad) + dy * Math.cos(rad) + oy
        }
      }
      const mrx = region.rx + margin, mry = region.ry + margin
      return ((tx - region.cx) / mrx) ** 2 + ((ty - region.cy) / mry) ** 2 <= 1
    }
    case 'rect':
      return px >= region.x - margin && px <= region.x + region.width  + margin &&
             py >= region.y - margin && py <= region.y + region.height + margin
    case 'polygon': {
      const pts = region.points.trim().split(/\s+/).map(p => {
        const [x, y] = p.split(',').map(Number)
        return { x, y }
      })
      // For polygon: check exact boundary + margin via distance to edges
      if (pointInPolygon(px, py, pts)) return true
      if (margin <= 0) return false
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        // Distance from point to segment
        const ax = pts[j].x, ay = pts[j].y, bx = pts[i].x, by = pts[i].y
        const dx = bx - ax, dy = by - ay
        const len2 = dx * dx + dy * dy
        if (len2 === 0) continue
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
        const nx = ax + t * dx - px, ny = ay + t * dy - py
        if (nx * nx + ny * ny <= margin * margin) return true
      }
      return false
    }
    default: return false
  }
}

// Approximate bounding-box area for a region — used to rank overlapping shapes
function regionArea(region) {
  switch (region.element) {
    case 'circle':  return Math.PI * region.r * region.r
    case 'ellipse': return Math.PI * region.rx * region.ry
    case 'rect':    return region.width * region.height
    case 'polygon': {
      const pts = region.points.trim().split(/\s+/).map(p => {
        const [x, y] = p.split(',').map(Number); return { x, y }
      })
      let xs = pts.map(p => p.x), ys = pts.map(p => p.y)
      return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    }
    default: return Infinity
  }
}

function computeInsideCells(region) {
  const cells = new Set()
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const cx = col * GRID + GRID / 2
      const cy = row * GRID + GRID / 2
      if (isInsideRegion(region, cx, cy, 0)) cells.add(row * COLS + col)
    }
  }
  return cells
}

// ─── Scenes — clean SVG primitives only ─────────────────────────────────────
const SCENES = [
  // ── Level 1 ──
  {
    id: 'house', hint: 'Male das Haus! 🏠', level: 1,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'wall',   target: 'Orange', label: '🟧 Wand',    element: 'rect',    x: 30,  y: 110, width: 140, height: 70 },
      { id: 'roof',   target: 'Rot',    label: '🔴 Dach',    element: 'polygon', points: '15,115 100,36 185,115' },
      { id: 'door',   target: 'Braun',  label: '🚪 Tür',     element: 'rect',    x: 83,  y: 140, width: 34,  height: 40 },
      { id: 'window', target: 'Blau',   label: '🪟 Fenster', element: 'rect',    x: 42,  y: 120, width: 34,  height: 28, rx: 4 },
    ],
  },
  {
    id: 'apple', hint: 'Male den Apfel! 🍎', level: 1,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'body', target: 'Rot',   label: '🍎 Apfel', element: 'circle',  cx: 100, cy: 118, r: 65 },
      { id: 'leaf', target: 'Grün',  label: '🌿 Blatt', element: 'ellipse', cx: 122, cy: 52,  rx: 22, ry: 12, transform: 'rotate(-35,122,52)' },
      { id: 'stem', target: 'Braun', label: '🪵 Stiel', element: 'rect',    x: 97,   y: 38,   width: 7, height: 20, rx: 3 },
    ],
  },
  {
    id: 'sun', hint: 'Male die Sonne! ☀️', level: 1,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'rays', target: 'Orange', label: '✨ Strahlen', element: 'polygon',
        points: '100,10 117,58 164,36 142,83 190,100 142,117 164,164 117,142 100,190 83,142 36,164 58,117 10,100 58,83 36,36 83,58' },
      { id: 'disc', target: 'Gelb',   label: '☀️ Sonne',   element: 'circle', cx: 100, cy: 100, r: 44 },
    ],
  },
  // ── Level 2 ──
  {
    id: 'butterfly', hint: 'Male den Schmetterling! 🦋', level: 2,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'wing-tl', target: 'Lila',   label: '💜 Obere Flügel',  element: 'ellipse', cx: 62,  cy: 76,  rx: 48, ry: 30, transform: 'rotate(-30,62,76)'  },
      { id: 'wing-tr', target: 'Lila',   label: '💜 Obere Flügel',  element: 'ellipse', cx: 138, cy: 76,  rx: 48, ry: 30, transform: 'rotate(30,138,76)'   },
      { id: 'wing-bl', target: 'Orange', label: '🟠 Untere Flügel', element: 'ellipse', cx: 68,  cy: 138, rx: 38, ry: 24, transform: 'rotate(25,68,138)'   },
      { id: 'wing-br', target: 'Orange', label: '🟠 Untere Flügel', element: 'ellipse', cx: 132, cy: 138, rx: 38, ry: 24, transform: 'rotate(-25,132,138)' },
      { id: 'body',    target: 'Braun',  label: '🤎 Körper',         element: 'ellipse', cx: 100, cy: 107, rx: 8,  ry: 36 },
    ],
  },
  {
    id: 'fish', hint: 'Male den Fisch! 🐟', level: 2,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'body', target: 'Blau',     label: '🐟 Körper',        element: 'ellipse', cx: 88,  cy: 100, rx: 62, ry: 42 },
      { id: 'tail', target: 'Türkis',   label: '🩵 Schwanzflosse', element: 'polygon', points: '148,100 178,68 178,132' },
      { id: 'fin',  target: 'Hellgrün', label: '🟢 Rückenflosse',  element: 'polygon', points: '72,58 88,42 108,56' },
      { id: 'eye',  target: 'Schwarz',  label: '👁️ Auge',           element: 'circle',  cx: 52,  cy: 93,  r: 10 },
    ],
  },
  {
    id: 'bear', hint: 'Male den Bären! 🐻', level: 2,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'ear-l',  target: 'Braun',   label: '🤎 Ohren',    element: 'circle',  cx: 65,  cy: 45,  r: 22 },
      { id: 'ear-r',  target: 'Braun',   label: '🤎 Ohren',    element: 'circle',  cx: 135, cy: 45,  r: 22 },
      { id: 'body',   target: 'Braun',   label: '🤎 Körper',   element: 'ellipse', cx: 100, cy: 148, rx: 52, ry: 45 },
      { id: 'head',   target: 'Braun',   label: '🤎 Kopf',     element: 'circle',  cx: 100, cy: 80,  r: 44 },
      { id: 'muzzle', target: 'Orange',  label: '🟠 Schnauze', element: 'ellipse', cx: 100, cy: 94,  rx: 22, ry: 15 },
      { id: 'eye-l',  target: 'Schwarz', label: '👁️ Augen',    element: 'circle',  cx: 86,  cy: 73,  r: 7 },
      { id: 'eye-r',  target: 'Schwarz', label: '👁️ Augen',    element: 'circle',  cx: 114, cy: 73,  r: 7 },
    ],
  },
  // ── Level 3 ──
  {
    id: 'rocket', hint: 'Male die Rakete! 🚀', level: 3,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'body',   target: 'Grau',   label: '⬜ Körper',  element: 'rect',    x: 72,  y: 70, width: 56, height: 88, rx: 8 },
      { id: 'nose',   target: 'Rot',    label: '🔴 Spitze',  element: 'polygon', points: '72,70 100,14 128,70' },
      { id: 'wing-l', target: 'Orange', label: '🟠 Flügel',  element: 'polygon', points: '72,128 38,170 72,158' },
      { id: 'wing-r', target: 'Orange', label: '🟠 Flügel',  element: 'polygon', points: '128,128 162,170 128,158' },
      { id: 'window', target: 'Blau',   label: '🪟 Fenster', element: 'circle',  cx: 100, cy: 98, r: 20 },
      { id: 'flame',  target: 'Gelb',   label: '🔥 Flamme',  element: 'polygon', points: '80,158 100,196 120,158' },
    ],
  },
  {
    id: 'penguin', hint: 'Male den Pinguin! 🐧', level: 3,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'body',  target: 'Schwarz', label: '🖤 Körper',   element: 'ellipse', cx: 100, cy: 120, rx: 56, ry: 66 },
      { id: 'belly', target: 'Grau',    label: '🩶 Bauch',    element: 'ellipse', cx: 100, cy: 125, rx: 32, ry: 48 },
      { id: 'beak',  target: 'Orange',  label: '🟠 Schnabel', element: 'polygon', points: '88,96 100,111 112,96 100,84' },
      { id: 'feet',  target: 'Orange',  label: '🟠 Füße',     element: 'polygon', points: '60,178 50,193 82,189 78,178 122,178 118,189 150,193 140,178' },
      { id: 'eye-l', target: 'Schwarz', label: '👁️ Augen',    element: 'circle',  cx: 86,  cy: 96,  r: 6 },
      { id: 'eye-r', target: 'Schwarz', label: '👁️ Augen',    element: 'circle',  cx: 114, cy: 96,  r: 6 },
    ],
  },
  {
    id: 'flower', hint: 'Male die Blume! 🌸', level: 3,
    viewBox: '0 0 200 200',
    regions: [
      { id: 'petals', target: 'Pink', label: '🌸 Blüte', element: 'polygon',
        points: '100,25 115,63 153,47 137,85 175,100 137,115 153,153 115,137 100,175 85,137 47,153 63,115 25,100 63,85 47,47 85,63' },
      { id: 'center', target: 'Gelb', label: '🌼 Mitte', element: 'circle',  cx: 100, cy: 100, r: 30 },
      { id: 'stem',   target: 'Grün', label: '🌿 Stiel', element: 'rect',    x: 96,   y: 128,  width: 8, height: 68, rx: 4 },
      { id: 'leaf',   target: 'Grün', label: '🌿 Blatt', element: 'ellipse', cx: 128, cy: 165, rx: 28, ry: 13, transform: 'rotate(-30,128,165)' },
    ],
  },
]

function buildScenes(level) {
  const maxSceneLevel = level <= 2 ? 1 : level <= 6 ? 2 : 3
  const available = SCENES.filter(s => s.level <= maxSceneLevel)
  const count     = level <= 4 ? 2 : level <= 7 ? 3 : 4
  return shuffle(available).slice(0, Math.min(count, available.length))
}

// ─── SVG shape renderer  ──────────────────────────────────────────────────────
// `hitTarget` prop: if true, renders a transparent wider version for easier hit detection
function ShapeEl({ region, fill, stroke, strokeWidth, hitTarget = false }) {
  const extra = hitTarget ? { fill: 'transparent', stroke: 'transparent', strokeWidth: 18, 'data-regionid': region.id } : {}
  const common = hitTarget ? extra : { fill, stroke, strokeWidth, 'data-regionid': region.id }
  switch (region.element) {
    case 'circle':
      return <circle  cx={region.cx} cy={region.cy} r={region.r} {...common} />
    case 'ellipse':
      return <ellipse cx={region.cx} cy={region.cy} rx={region.rx} ry={region.ry}
               transform={region.transform} {...common} />
    case 'rect':
      return <rect    x={region.x}   y={region.y}   width={region.width} height={region.height}
               rx={region.rx ?? 0} {...common} />
    case 'polygon':
      return <polygon points={region.points} {...common} />
    default: return null
  }
}

// ─── Paint bucket  ─────────────────────────────────────────────────────────────
function PaintBucket({ color, name, selected, onClick }) {
  return (
    <motion.button
      whileHover={{ scale: 1.15, y: -6 }}
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      title={name}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: 0, outline: 'none',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        filter: selected ? `drop-shadow(0 0 10px ${color})` : 'none',
        transition: 'filter 0.2s',
      }}
    >
      <svg width="46" height="50" viewBox="0 0 44 48">
        <path d="M6 18 L10 42 L34 42 L38 18 Z" fill={color}
          stroke={selected ? 'white' : 'rgba(0,0,0,0.2)'} strokeWidth={selected ? 2.5 : 1.5} strokeLinejoin="round" />
        <ellipse cx="22" cy="18" rx="16" ry="5" fill={color}
          stroke={selected ? 'white' : 'rgba(0,0,0,0.2)'} strokeWidth={selected ? 2.5 : 1.5} />
        <ellipse cx="14" cy="25" rx="3" ry="5" fill="white" opacity="0.28" transform="rotate(-15 14 25)" />
        <path d="M12 16 C12 8 32 8 32 16" fill="none"
          stroke={selected ? 'white' : '#999'} strokeWidth={selected ? 2.5 : 2} strokeLinecap="round" />
        {selected && <circle cx="34" cy="12" r="7" fill="#4CAF50" />}
        {selected && <path d="M30 12 L33 15 L38 9" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />}
      </svg>
      <span style={{
        fontFamily: 'var(--font-heading)', fontSize: 11, fontWeight: 700,
        whiteSpace: 'nowrap',
        background: selected ? color : 'rgba(255,255,255,0.82)',
        padding: '2px 6px', borderRadius: 6,
        border: `1.5px solid ${selected ? color : 'transparent'}`,
        color: selected ? (isLight(color) ? '#222' : 'white') : 'var(--text-primary)',
        transition: 'all 0.2s',
        boxShadow: selected ? `0 2px 8px ${color}88` : 'none',
      }}>{name}</span>
    </motion.button>
  )
}

// ─── Colour group badge ───────────────────────────────────────────────────────
function ColorBadge({ group, isActive, progress, onClick }) {
  const allDone = group.done === group.total
  return (
    <motion.button
      onClick={onClick}
      whileHover={allDone ? {} : { scale: 1.08 }}
      whileTap={allDone ? {} : { scale: 0.93 }}
      style={{
        background: allDone ? '#E8F8EE' : isActive ? `${group.color.value}22` : 'rgba(255,255,255,0.9)',
        border: `2px solid ${allDone ? '#6BCB77' : isActive ? group.color.value : '#DDD8F5'}`,
        borderRadius: 10, padding: '5px 10px',
        fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700,
        display: 'flex', alignItems: 'center', gap: 6,
        cursor: allDone ? 'default' : 'pointer', outline: 'none',
        boxShadow: isActive ? `0 2px 12px ${group.color.value}55` : 'none',
        transition: 'all 0.2s', pointerEvents: allDone ? 'none' : 'auto',
        color: 'var(--text-primary)', position: 'relative', overflow: 'hidden',
      }}
    >
      {/* progress fill behind label */}
      {!allDone && progress > 0 && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${progress * 100}%`,
          background: `${group.color.value}22`,
          transition: 'width 0.1s',
          pointerEvents: 'none',
        }} />
      )}
      {allDone
        ? <span>✅</span>
        : <span style={{
            width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
            background: group.color.value, border: '1.5px solid rgba(0,0,0,0.15)',
            display: 'inline-block',
          }} />
      }
      <span style={{ position: 'relative' }}>{group.target}</span>
      {!allDone && <span style={{ fontSize: 10, opacity: 0.4, position: 'relative' }}>🖌️</span>}
    </motion.button>
  )
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
function PaintCanvas({ scene, strokes, completed, selectedColor, svgRef, onPointerMove, onPointerLeave }) {
  const size = typeof window !== 'undefined' ? Math.min(window.innerWidth - 48, 460) : 320

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      viewBox={scene.viewBox}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      style={{
        display: 'block', borderRadius: 20, background: '#FAFAFA',
        boxShadow: '0 8px 36px rgba(108,99,255,0.13)',
        touchAction: 'none',
        cursor: selectedColor ? 'none' : 'default',
        userSelect: 'none',
      }}
    >
      {/* ── Clip paths (one per region, defines the paintable boundary) ── */}
      <defs>
        {scene.regions.map(region => (
          <clipPath key={region.id} id={`clip-${scene.id}-${region.id}`}>
            {/* Shape geometry only — fill/stroke don't matter inside clipPath */}
            <ShapeEl region={region} fill="white" stroke="none" strokeWidth={0} />
          </clipPath>
        ))}
      </defs>

      <rect width="200" height="200" fill="#FAFAFA" />

      {scene.regions.map(region => {
        const tc       = getColor(region.target)
        const isDone   = !!completed[region.id]
        const isHinted = selectedColor === region.target && !isDone
        const dots     = strokes[region.id] ?? []

        return (
          <g key={region.id}>
            {/* 1. Base shape — always shows unpainted background; green border when done */}
            <ShapeEl
              region={region}
              fill={isHinted ? tc.value + '22' : '#ECEAF8'}
              stroke={isDone ? '#6BCB77' : isHinted ? tc.value : '#C0B8DC'}
              strokeWidth={isDone ? 4 : isHinted ? 3 : 2}
            />

            {/* 2. Brush stroke dots — always visible (no auto-fill on completion) */}
            {dots.length > 0 && (
              <g
                clipPath={`url(#clip-${scene.id}-${region.id})`}
                style={{ pointerEvents: 'none' }}
              >
                {dots.map((pt, i) => (
                  <circle
                    key={i}
                    cx={pt.x} cy={pt.y}
                    r={BRUSH_R}
                    fill={tc.value}
                    opacity={0.88}
                  />
                ))}
              </g>
            )}

            {/* 3. Auto-complete overlay: fills the last ~10% once threshold reached */}
            {isDone && (
              <ShapeEl
                region={region}
                fill={tc.value}
                stroke="#6BCB77"
                strokeWidth={4}
              />
            )}

            {/* 4. Wide invisible hit-target on top (easier to hover small shapes) */}
            <ShapeEl region={region} hitTarget />
          </g>
        )
      })}
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PainterGame({ level = 1, onComplete }) {
  const [scenes]    = useState(() => buildScenes(level))
  const [sceneIdx,  setSceneIdx]  = useState(0)
  const [strokes,   setStrokes]   = useState({})   // { regionId: [{x,y},...] }
  const [completed, setCompleted] = useState({})   // { regionId: bool }
  const [selected,  setSelected]  = useState(null) // color name
  const [brushPos,  setBrushPos]  = useState(null) // viewport {x,y} for cursor
  const [score,     setScore]     = useState(0)
  const [mood,      setMood]      = useState('happy')
  const [advancing, setAdvancing] = useState(false)

  const svgRef          = useRef(null)
  const lastPtRef       = useRef(null)       // last SVG point painted
  const insideCellsRef  = useRef(null)       // { regionId: Set<number> } — pre-computed inside cells
  const paintedCellsRef = useRef({})         // { regionId: Set<number> } — cells covered by brush
  const completedRef    = useRef({})         // mirrors completed for use in callbacks
  const advRef          = useRef(false)
  const sceneRef        = useRef(scenes[0])
  const scoreRef        = useRef(0)

  const scene   = scenes[sceneIdx]
  const palette = useMemo(() => buildPalette(scene, level), [scene, level])

  useEffect(() => { sceneRef.current = scene },   [scene])
  useEffect(() => { advRef.current = advancing },  [advancing])
  useEffect(() => { scoreRef.current = score },    [score])

  // Reset everything when scene changes
  useEffect(() => {
    setStrokes({})
    setCompleted({})
    completedRef.current = {}
    paintedCellsRef.current = {}
    lastPtRef.current = null
  }, [sceneIdx])

  // Pre-compute which grid cells are inside each region whenever scene changes.
  // Each cell is assigned to the SMALLEST region that contains it — matching the
  // hit-test logic — so "inside" cells are exactly the ones the brush can actually paint.
  useEffect(() => {
    if (!scene) return
    // Raw inside cells per region (no ownership yet)
    const rawCells = {}
    scene.regions.forEach(r => { rawCells[r.id] = computeInsideCells(r) })
    // Assign each cell to its smallest (highest-priority) owner
    const map = {}
    scene.regions.forEach(r => { map[r.id] = new Set() })
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const idx = row * COLS + col
        const owners = scene.regions.filter(r => rawCells[r.id].has(idx))
        if (owners.length === 0) continue
        owners.sort((a, b) => regionArea(a) - regionArea(b))
        map[owners[0].id].add(idx)
      }
    }
    insideCellsRef.current = map
  }, [sceneIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear brush pos when colour deselected
  useEffect(() => { if (!selected) setBrushPos(null) }, [selected])

  // ── Check for scene completion ──────────────────────────────────────────────
  useEffect(() => {
    if (!scene || advRef.current) return
    const allDone = scene.regions.every(r => completed[r.id])
    if (!allDone) return
    setMood('excited')
    sfx.complete?.()
    advRef.current = true
    setAdvancing(true)
    const ns = scoreRef.current + 1
    setScore(ns)
    setTimeout(() => {
      advRef.current = false
      setAdvancing(false)
      if (sceneIdx + 1 >= scenes.length) {
        onComplete({ score: ns, total: scenes.length })
      } else {
        setSceneIdx(i => i + 1)
        setSelected(null)
        setMood('happy')
      }
    }, 1500)
  }, [completed]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pointer move: painting ──────────────────────────────────────────────────
  const handlePointerMove = useCallback((e) => {
    if (!selected) return

    // Update brush cursor position
    setBrushPos({ x: e.clientX, y: e.clientY })

    if (advRef.current) return

    // Convert to SVG coordinate space
    const svgPt = clientToSVG(svgRef.current, e.clientX, e.clientY)
    if (!svgPt) return

    // Hit test: among ALL regions containing the point, pick the smallest (tightest fit).
    // This prevents a large background shape (rays polygon) from stealing clicks
    // that are geometrically inside a smaller overlapping shape (disc circle).
    const sc = sceneRef.current
    if (!sc) return
    const hits = sc.regions.filter(r =>
      !completedRef.current[r.id] &&
      isInsideRegion(r, svgPt.x, svgPt.y, EDGE_MARGIN)
    )
    if (hits.length === 0) return
    // Sort by approximate area ascending — smallest shape wins
    hits.sort((a, b) => regionArea(a) - regionArea(b))
    const topRegion = hits[0]
    // Only paint if the selected colour matches the tightest region under the cursor
    if (selected !== topRegion.target) return
    const region = topRegion
    const rid = region.id

    // Already completed (double-guard — also checked in the find above)
    if (completedRef.current[rid]) return

    // Distance throttle: skip if pointer barely moved
    const last = lastPtRef.current
    if (last) {
      const dx = svgPt.x - last.x
      const dy = svgPt.y - last.y
      if (dx * dx + dy * dy < MIN_DIST * MIN_DIST) return
    }
    lastPtRef.current = svgPt

    // Append stroke point (triggers re-render to show new dot)
    setStrokes(s => ({
      ...s,
      [rid]: [...(s[rid] ?? []), { x: svgPt.x, y: svgPt.y }],
    }))

    // Mark grid cells within brush radius as painted, then check coverage
    if (!paintedCellsRef.current[rid]) paintedCellsRef.current[rid] = new Set()
    const painted = paintedCellsRef.current[rid]
    const inside  = insideCellsRef.current?.[rid]

    if (inside && inside.size > 0) {
      const colMin = Math.max(0, Math.floor((svgPt.x - BRUSH_R) / GRID))
      const colMax = Math.min(COLS - 1, Math.floor((svgPt.x + BRUSH_R) / GRID))
      const rowMin = Math.max(0, Math.floor((svgPt.y - BRUSH_R) / GRID))
      const rowMax = Math.min(ROWS - 1, Math.floor((svgPt.y + BRUSH_R) / GRID))

      for (let row = rowMin; row <= rowMax; row++) {
        for (let col = colMin; col <= colMax; col++) {
          // Use nearest-point distance: mark the cell if the brush OVERLAPS any part of it,
          // not just if the cell center is inside the brush circle.
          // This correctly handles thin tips where the center sits just outside the brush.
          const nearX = Math.max(col * GRID, Math.min((col + 1) * GRID, svgPt.x))
          const nearY = Math.max(row * GRID, Math.min((row + 1) * GRID, svgPt.y))
          const d2 = (nearX - svgPt.x) ** 2 + (nearY - svgPt.y) ** 2
          if (d2 <= BRUSH_R * BRUSH_R) {
            const idx = row * COLS + col
            if (inside.has(idx)) painted.add(idx)
          }
        }
      }

      const coverage = painted.size / inside.size
      if (coverage >= COVER_FRAC && !completedRef.current[rid]) {
        completedRef.current[rid] = true
        sfx.correct()
        setCompleted(c => ({ ...c, [rid]: true }))
        lastPtRef.current = null
      }
    }
  }, [selected])

  const handlePointerLeave = useCallback(() => {
    setBrushPos(null)
  }, [])

  if (!scene) return null

  // Build colour groups for badges + progress
  const colorGroups = useMemo(() => {
    const map = {}
    scene.regions.forEach(r => {
      if (!map[r.target]) map[r.target] = { target: r.target, color: getColor(r.target), regions: [] }
      map[r.target].regions.push(r)
    })
    return Object.values(map).map(g => ({
      ...g,
      done:  g.regions.filter(r => completed[r.id]).length,
      total: g.regions.length,
    }))
  }, [scene, completed])

  const selColor   = selected ? getColor(selected) : null
  const allSceneDone = colorGroups.every(g => g.done === g.total)

  // Progress per region (for badge fill bar) — ratio of painted cells to required
  function regionProgress(target) {
    const rids = scene.regions.filter(r => r.target === target)
    const avg = rids.reduce((sum, r) => {
      const painted = paintedCellsRef.current[r.id]?.size ?? 0
      const inside  = insideCellsRef.current?.[r.id]?.size ?? 1
      return sum + Math.min(painted / (inside * COVER_FRAC), 1)
    }, 0) / rids.length
    return avg
  }

  let lumiMsg
  if (allSceneDone) {
    lumiMsg = '🎉 Super gemalt! Weiter geht\'s!'
  } else if (!selected) {
    lumiMsg = `${scene.hint} Wähle einen Farbeimer und male drauf los! 🖌️`
  } else {
    lumiMsg = (
      <span>
        <strong style={{ color: selColor.value }}>{selColor.name}</strong>
        {' '}gewählt — einfach über die leuchtende Fläche fahren! ✨
      </span>
    )
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,1.5vw,18px) clamp(10px,2.5vw,24px)',
      gap: 'clamp(8px,1.2vw,14px)',
      userSelect: 'none',
    }}>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 660 }}>
        {scenes.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < sceneIdx ? '#74B9FF' : i === sceneIdx ? '#FFD93D' : '#ECE8FF',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + speech bubble */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, width: '100%', maxWidth: 660 }}>
        <LumiCharacter mood={mood} size={68} />
        <div style={{
          flex: 1, background: 'white', borderRadius: '22px 22px 22px 6px',
          padding: '10px 16px', boxShadow: '0 4px 24px rgba(116,185,255,0.15)',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(13px,2.7vw,18px)',
          color: 'var(--text-primary)',
        }}>
          {lumiMsg}
        </div>
      </div>

      {/* Colour badges with progress */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'center', width: '100%', maxWidth: 660 }}>
        {colorGroups.map(group => (
          <ColorBadge
            key={group.target}
            group={group}
            isActive={selected === group.target}
            progress={regionProgress(group.target)}
            onClick={() => setSelected(s => s === group.target ? null : group.target)}
          />
        ))}
      </div>

      {/* Paint canvas */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scene.id}
          initial={{ scale: 0.88, opacity: 0 }}
          animate={{ scale: 1,    opacity: 1 }}
          exit={{   scale: 0.88, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        >
          <PaintCanvas
            scene={scene}
            strokes={strokes}
            completed={completed}
            selectedColor={selected}
            svgRef={svgRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          />
        </motion.div>
      </AnimatePresence>

      {/* Paint buckets */}
      <div style={{
        background: 'rgba(255,255,255,0.72)', borderRadius: 22,
        padding: 'clamp(8px,1.2vw,14px) clamp(10px,2vw,18px)',
        boxShadow: '0 4px 20px rgba(108,99,255,0.09)',
        width: '100%', maxWidth: 660, backdropFilter: 'blur(8px)',
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(5px,1.2vw,10px)', justifyContent: 'center' }}>
          {palette.map(color => (
            <PaintBucket
              key={color.name}
              color={color.value}
              name={color.name}
              selected={selected === color.name}
              onClick={() => setSelected(s => s === color.name ? null : color.name)}
            />
          ))}
        </div>
      </div>

      {/* Floating brush tip — teardrop, follows cursor */}
      {selected && brushPos && (
        <div
          aria-hidden
          style={{
            position: 'fixed',
            left: brushPos.x - 11,
            top:  brushPos.y - 11,
            width: 22, height: 22,
            borderRadius: '50% 50% 50% 0',
            transform: 'rotate(-45deg)',
            background: selColor.value,
            border: '2.5px solid white',
            boxShadow: `0 3px 10px rgba(0,0,0,0.35), 0 0 0 3px ${selColor.value}44`,
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}
    </div>
  )
}
