import { useState, useCallback, useRef, useEffect, useMemo, useLayoutEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { pxCard, pxPanel, pxBubble, pxSegment, INK } from './px.js'

/**
 * Farbenreich — Farbwörter beim Malen nach Vorgabe.
 *
 * Tap a bucket, then the glowing part of the picture: it fills at once.
 * Painting used to mean rubbing 90 % of a region with the finger (a mouse
 * painted by merely hovering), a wrong colour did nothing at all, and not a
 * single colour word was ever spoken. Now every bucket says its colour, every
 * finished part says what it became ("Das Dach ist jetzt rot!"), and a wrong
 * colour gets a gentle hint which colour that part wants.
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
// Region names carry their article; pairs (ears, eyes) are one plural name,
// so "Die Ohren sind jetzt braun!" is said once both are painted.
const cap = s => s[0].toUpperCase() + s.slice(1)
const acc = r => (!r.pl && r.name.startsWith('der ') ? 'den ' + r.name.slice(4) : r.name)
const verb = (r, sg, pl) => (r.pl ? pl : sg)
function listWords(words) {
  return words.length < 2 ? words[0] : `${words.slice(0, -1).join(', ')} und ${words[words.length - 1]}`
}

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

// ─── Hit test: point-in-region ────────────────────────────────────────────────
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

const polyPoints = region => region.points.trim().split(/\s+/).map(p => {
  const [x, y] = p.split(',').map(Number)
  return { x, y }
})

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
      const pts = polyPoints(region)
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
      const pts = polyPoints(region)
      const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
      return (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
    }
    default: return Infinity
  }
}

// The region under a point: among all regions containing it, the smallest
// (the sun's disc, not the rays behind it). The margin makes thin parts —
// the balloon's string, the apple's stem — easy to hit with a finger.
function regionAt(scene, x, y) {
  const hits = scene.regions.filter(r => isInsideRegion(r, x, y, 5))
  if (!hits.length) return null
  const exact = hits.filter(r => isInsideRegion(r, x, y, 0))
  const list = exact.length ? exact : hits
  return list.sort((a, b) => regionArea(a) - regionArea(b))[0]
}

// ─── Scenes — clean SVG primitives only ─────────────────────────────────────
const SCENES = [
  // ── Level 1 ──
  {
    id: 'house', hint: 'Male das Haus! 🏠', thing: 'das Haus', level: 1,
    regions: [
      { id: 'wall',   target: 'Orange', name: 'die Wand',    element: 'rect',    x: 30,  y: 110, width: 140, height: 70 },
      { id: 'roof',   target: 'Rot',    name: 'das Dach',    element: 'polygon', points: '15,115 100,36 185,115' },
      { id: 'door',   target: 'Braun',  name: 'die Tür',     element: 'rect',    x: 83,  y: 140, width: 34,  height: 40 },
      { id: 'window', target: 'Blau',   name: 'das Fenster', element: 'rect',    x: 42,  y: 120, width: 34,  height: 28, rx: 4 },
    ],
  },
  {
    id: 'apple', hint: 'Male den Apfel! 🍎', thing: 'der Apfel', level: 1,
    regions: [
      { id: 'body', target: 'Rot',   name: 'der Apfel', element: 'circle',  cx: 100, cy: 118, r: 65 },
      { id: 'leaf', target: 'Grün',  name: 'das Blatt', element: 'ellipse', cx: 122, cy: 52,  rx: 22, ry: 12, transform: 'rotate(-35,122,52)' },
      { id: 'stem', target: 'Braun', name: 'der Stiel', element: 'rect',    x: 97,   y: 38,   width: 7, height: 20, rx: 3 },
    ],
  },
  {
    id: 'sun', hint: 'Male die Sonne! ☀️', thing: 'die Sonne', level: 1,
    regions: [
      { id: 'rays', target: 'Orange', name: 'die Strahlen', pl: true, element: 'polygon',
        points: '100,10 117,58 164,36 142,83 190,100 142,117 164,164 117,142 100,190 83,142 36,164 58,117 10,100 58,83 36,36 83,58' },
      { id: 'disc', target: 'Gelb',   name: 'die Sonne',   element: 'circle', cx: 100, cy: 100, r: 44 },
    ],
  },
  {
    id: 'balloon', hint: 'Male den Ballon! 🎈', thing: 'der Ballon', level: 1,
    regions: [
      { id: 'ball',   target: 'Rot',  name: 'der Ballon',  element: 'ellipse', cx: 100, cy: 80, rx: 55, ry: 65 },
      { id: 'knot',   target: 'Gelb', name: 'der Knoten',  element: 'circle',  cx: 100, cy: 145, r: 7 },
      { id: 'string', target: 'Grau', name: 'die Schnur',  element: 'rect',    x: 98, y: 152, width: 4, height: 44, rx: 2 },
    ],
  },
  {
    id: 'star', hint: 'Male den Stern! ⭐', thing: 'der Stern', level: 1,
    regions: [
      { id: 'body', target: 'Gelb', name: 'der Stern', element: 'polygon',
        points: '100,18 121,70 176,70 132,103 148,158 100,125 52,158 68,103 24,70 79,70' },
    ],
  },
  // ── Level 2 ──
  {
    id: 'butterfly', hint: 'Male den Schmetterling! 🦋', thing: 'der Schmetterling', level: 2,
    regions: [
      { id: 'wing-tl', target: 'Lila',   name: 'die oberen Flügel',  pl: true, element: 'ellipse', cx: 62,  cy: 76,  rx: 48, ry: 30, transform: 'rotate(-30,62,76)'  },
      { id: 'wing-tr', target: 'Lila',   name: 'die oberen Flügel',  pl: true, element: 'ellipse', cx: 138, cy: 76,  rx: 48, ry: 30, transform: 'rotate(30,138,76)'   },
      { id: 'wing-bl', target: 'Orange', name: 'die unteren Flügel', pl: true, element: 'ellipse', cx: 68,  cy: 138, rx: 38, ry: 24, transform: 'rotate(25,68,138)'   },
      { id: 'wing-br', target: 'Orange', name: 'die unteren Flügel', pl: true, element: 'ellipse', cx: 132, cy: 138, rx: 38, ry: 24, transform: 'rotate(-25,132,138)' },
      { id: 'body',    target: 'Braun',  name: 'der Körper',         element: 'ellipse', cx: 100, cy: 107, rx: 8,  ry: 36 },
    ],
  },
  {
    id: 'fish', hint: 'Male den Fisch! 🐟', thing: 'der Fisch', level: 2,
    regions: [
      { id: 'body', target: 'Blau',     name: 'der Fisch',          element: 'ellipse', cx: 88,  cy: 100, rx: 62, ry: 42 },
      { id: 'tail', target: 'Türkis',   name: 'die Schwanzflosse',  element: 'polygon', points: '148,100 178,68 178,132' },
      { id: 'fin',  target: 'Hellgrün', name: 'die Rückenflosse',   element: 'polygon', points: '72,58 88,42 108,56' },
      { id: 'eye',  target: 'Schwarz',  name: 'das Auge',           element: 'circle',  cx: 52,  cy: 93,  r: 10 },
    ],
  },
  {
    id: 'bear', hint: 'Male den Bären! 🐻', thing: 'der Bär', level: 2,
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
    id: 'frog', hint: 'Male den Frosch! 🐸', thing: 'der Frosch', level: 2,
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
    id: 'rocket', hint: 'Male die Rakete! 🚀', thing: 'die Rakete', level: 3,
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
    id: 'penguin', hint: 'Male den Pinguin! 🐧', thing: 'der Pinguin', level: 3,
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
    id: 'flower', hint: 'Male die Blume! 🌸', thing: 'die Blume', level: 3,
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

// ─── Paint bucket  ─────────────────────────────────────────────────────────────
function PaintBucket({ color, name, selected, onClick }) {
  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      animate={{ y: selected ? -6 : 0 }}
      onClick={onClick}
      aria-label={name}
      aria-pressed={selected}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '2px 0', outline: 'none', minWidth: 56, minHeight: 56,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
      }}
    >
      <svg width="52" height="54" viewBox="0 0 44 46" style={{ overflow: 'visible' }}>
        <path d="M6 18 L10 42 L34 42 L38 18 Z" fill={color}
          stroke={INK} strokeWidth={selected ? 3 : 2} strokeLinejoin="round" />
        <ellipse cx="22" cy="18" rx="16" ry="5" fill={color} stroke={INK} strokeWidth={selected ? 3 : 2} />
        <ellipse cx="14" cy="27" rx="3" ry="5" fill="white" opacity="0.3" transform="rotate(-15 14 27)" />
        <path d="M12 16 C12 7 32 7 32 16" fill="none" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        {selected && <circle cx="37" cy="9" r="7" fill="#2F8F3A" stroke={INK} strokeWidth="1.5" />}
        {selected && <path d="M33.5 9 L36 11.5 L40.5 6.5" stroke="white" strokeWidth="2.2" strokeLinecap="round" fill="none" />}
      </svg>
      <span style={{
        fontFamily: 'var(--font-heading)', fontSize: 13, fontWeight: 700, lineHeight: 1.2,
        whiteSpace: 'nowrap', color: INK,
        background: selected ? 'var(--px-gold)' : 'transparent',
        padding: '1px 6px', borderRadius: 6,
        border: `2px solid ${selected ? INK : 'transparent'}`,
      }}>{name}</span>
    </motion.button>
  )
}

// ─── What still needs painting: one chip per colour ──────────────────────────
function ColorChip({ group, active }) {
  const allDone = group.done === group.total
  return (
    <div style={{
      ...pxCard(allDone ? 'right' : active ? 'selected' : undefined),
      borderRadius: 10, padding: '3px 10px', minHeight: 32,
      fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700,
      display: 'flex', alignItems: 'center', gap: 6, color: INK,
    }}>
      <span style={{
        width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
        background: group.color.value, border: `2px solid ${INK}`,
      }} />
      {group.target}
      {allDone && <span>✅</span>}
    </div>
  )
}

// ─── Canvas ───────────────────────────────────────────────────────────────────
function PaintCanvas({ scene, size, filled, selectedColor, flash, svgRef, onPointerDown, onPointerMove }) {
  return (
    <div style={{ ...pxPanel, overflow: 'hidden', lineHeight: 0 }}>
      <svg
        ref={svgRef}
        // the frame's 3px border sits inside the measured box
        width={size - 6}
        height={size - 6}
        viewBox="0 0 200 200"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        style={{ display: 'block', borderRadius: 11, touchAction: 'none', cursor: 'pointer', userSelect: 'none' }}
      >
        <defs>
          {/* Unpainted parts are hatched: a painted white part (the frog's
              eyes) used to look exactly like an empty one. */}
          <pattern id="px-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" fill="#FFFAF0" />
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(42,27,61,0.12)" strokeWidth="3" />
          </pattern>
          {scene.regions.map(region => (
            <clipPath key={region.id} id={`clip-${scene.id}-${region.id}`}>
              <ShapeEl region={region} />
            </clipPath>
          ))}
        </defs>

        {/* a soft sky behind the picture, so white stands out from it */}
        <rect width="200" height="200" fill="#DCEBF5" />

        {scene.regions.map(region => {
          const tc     = getColor(region.target)
          const origin = filled[region.id]
          const hinted = selectedColor === region.target && !origin
          return (
            <g key={region.id}>
              <ShapeEl region={region} fill="url(#px-hatch)" />

              {/* fills from where it was tapped, like paint poured in */}
              {origin && (
                <g clipPath={`url(#clip-${scene.id}-${region.id})`}>
                  <motion.circle cx={origin.x} cy={origin.y} fill={tc.value}
                    initial={{ r: 0 }} animate={{ r: 260 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
                </g>
              )}

              {/* the parts the chosen colour belongs to glow */}
              {hinted && (
                <motion.g animate={{ opacity: [0.15, 0.45, 0.15] }} transition={{ duration: 1.4, repeat: Infinity }}>
                  <ShapeEl region={region} fill={tc.value} />
                </motion.g>
              )}

              {/* a wrong colour: the part shows the colour it wants */}
              {flash?.id === region.id && (
                <motion.g key={flash.n} initial={{ opacity: 0 }} animate={{ opacity: [0, 0.85, 0.2, 0.85, 0] }} transition={{ duration: 1.3 }}>
                  <ShapeEl region={region} fill={tc.value} />
                </motion.g>
              )}

              <ShapeEl region={region} fill="none" stroke={INK} strokeWidth={hinted ? 3 : 2} strokeLinejoin="round"
                strokeDasharray={hinted ? '6 4' : undefined} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Measures the box the canvas may fill, so it fits the height as well as the
// width (it used to take the window width only and pushed the buckets off the
// bottom of a landscape tablet).
function useBoxSize(ref) {
  const [size, setSize] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize(Math.floor(Math.min(el.clientWidth, el.clientHeight, 520)))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PainterGame({ level = 1, onComplete }) {
  const [scenes]    = useState(() => buildScenes(level))
  const [sceneIdx,  setSceneIdx]  = useState(0)
  const [filled,    setFilled]    = useState({})   // { regionId: { x, y } } — where the paint was poured in
  const [selected,  setSelected]  = useState(null) // color name
  const [flash,     setFlash]     = useState(null) // { id, n } — part that showed its colour after a mix-up
  const [mood,      setMood]      = useState('happy')
  const [sceneDone, setSceneDone] = useState(false)
  const [advance,   setAdvance]   = useState(false) // the praise was said, go on when not paused
  const paused = usePaused()

  const svgRef    = useRef(null)
  const boxRef    = useRef(null)
  const missed    = useRef(new Set())               // `${scene}/${region}` painted wrong first
  const filledRef = useRef({})
  const dragging  = useRef(false)
  const size      = useBoxSize(boxRef)

  const scene   = scenes[sceneIdx]
  const palette = useMemo(() => buildPalette(scene, level), [scene, level])
  const total   = useMemo(() => scenes.reduce((n, s) => n + s.regions.length, 0), [scenes])

  // New picture: say the task
  useEffect(() => {
    setFilled({}); filledRef.current = {}
    setSelected(null); setFlash(null); setSceneDone(false); setMood('happy')
    lockPreviews()
    const id = setTimeout(() => sayTask(`${scene.hint} Tippe zuerst auf einen Farbeimer.`), 450)
    return () => clearTimeout(id)
  }, [sceneIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // After the praise: next picture or the end — held while the help is open
  useEffect(() => {
    if (!advance || paused) return
    const id = setTimeout(() => {
      setAdvance(false)
      if (sceneIdx + 1 >= scenes.length) onComplete(result(total - missed.current.size, total))
      else setSceneIdx(i => i + 1)
    }, 400)
    return () => clearTimeout(id)
  }, [advance, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const remainingOf = useCallback(colorName => scene.regions.filter(r => r.target === colorName && !filledRef.current[r.id]), [scene])

  const chooseColor = (c) => {
    if (sceneDone) return
    setSelected(c.name)
    const open = remainingOf(c.name)
    const needed = scene.regions.some(r => r.target === c.name)
    const names = [...new Set(open.map(acc))]
    narrate([{ text: !needed ? `${c.name}. ${c.name} brauchen wir hier nicht.`
      : open.length ? `${c.name}! Damit malst du ${listWords(names)}.`
      : `${c.name}. Das ist schon fertig.` }])
  }

  const fill = useCallback((region, pt) => {
    filledRef.current = { ...filledRef.current, [region.id]: pt }
    setFilled(filledRef.current)
    sfx.correct()
    const colour = getColor(region.target)
    const said = []
    // say what it became once the whole part is painted (both ears)
    if (scene.regions.every(r => r.name !== region.name || filledRef.current[r.id])) {
      said.push({ text: `${cap(region.name)} ${verb(region, 'ist', 'sind')} jetzt ${colour.name.toLowerCase()}!` })
    }
    if (scene.regions.every(r => filledRef.current[r.id])) {
      setSceneDone(true)
      setSelected(null)
      setMood('excited')
      sfx.complete?.()
      said.push({ text: `Super gemalt! ${cap(scene.thing)} ist fertig.`, gap: 200 })
      narrate(said)
      afterNarration(() => setAdvance(true), { minMs: 900 })
    } else if (said.length) {
      narrate(said)
    }
  }, [scene])

  const handlePointerDown = useCallback((e) => {
    if (sceneDone) return
    const pt = clientToSVG(svgRef.current, e.clientX, e.clientY)
    const region = pt && regionAt(scene, pt.x, pt.y)
    if (!region || filledRef.current[region.id]) return
    const want = getColor(region.target).name
    const wants = `${cap(region.name)} ${verb(region, 'möchte', 'möchten')} ${want}.`
    if (!selected) {
      setFlash({ id: region.id, n: Date.now() })
      narrate([{ text: `${wants} Tippe auf den Eimer mit ${want}.` }])
      return
    }
    if (selected !== region.target) {
      // gently: show and say the colour this part wants
      missed.current.add(`${scene.id}/${region.id}`)
      setFlash({ id: region.id, n: Date.now() })
      setMood('encouraging')
      setTimeout(() => setMood('happy'), 1300)
      sayWrong(wants)
      return
    }
    dragging.current = true
    try { e.currentTarget.setPointerCapture?.(e.pointerId) } catch { /* not supported */ }
    fill(region, pt)
  }, [scene, selected, sceneDone, fill])

  // Dragging on with the right colour fills every glowing part it touches.
  const handlePointerMove = useCallback((e) => {
    if (!dragging.current || !e.buttons || sceneDone) return
    const pt = clientToSVG(svgRef.current, e.clientX, e.clientY)
    const region = pt && regionAt(scene, pt.x, pt.y)
    if (region && !filledRef.current[region.id] && region.target === selected) fill(region, pt)
  }, [scene, selected, sceneDone, fill])

  useEffect(() => {
    const up = () => { dragging.current = false }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
    return () => { window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
  }, [])

  // One chip per colour the picture needs, with what is done
  const colorGroups = useMemo(() => {
    const map = {}
    scene.regions.forEach(r => {
      if (!map[r.target]) map[r.target] = { target: r.target, color: getColor(r.target), regions: [] }
      map[r.target].regions.push(r)
    })
    return Object.values(map).map(g => ({ ...g, done: g.regions.filter(r => filled[r.id]).length, total: g.regions.length }))
  }, [scene, filled])

  const selColor = selected ? getColor(selected) : null
  const selNeeded = selected && remainingOf(selected).length > 0

  let lumiMsg
  if (sceneDone) {
    lumiMsg = '🎉 Super gemalt!'
  } else if (!selColor) {
    lumiMsg = `${scene.hint} Tippe auf einen Farbeimer.`
  } else {
    lumiMsg = (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ width: 20, height: 20, borderRadius: '50%', background: selColor.value, border: `2px solid ${INK}`, flexShrink: 0 }} />
        <strong>{selColor.name}</strong>
        {selNeeded ? '— tippe auf die Fläche, die leuchtet!' : '— die brauchen wir hier nicht.'}
      </span>
    )
  }

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,1.5vw,16px) clamp(10px,2.5vw,24px)',
      gap: 'clamp(6px,1.2vh,12px)',
      userSelect: 'none',
    }}>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 660, flexShrink: 0 }}>
        {scenes.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < sceneIdx || (i === sceneIdx && sceneDone) ? 'done' : i === sceneIdx ? 'current' : 'todo'), height: 10,
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + speech bubble */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 660, flexShrink: 0 }}>
        <LumiCharacter mood={mood} size={56} />
        <div style={{
          flex: 1, ...pxBubble,
          padding: '7px 14px',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px,2.7vw,19px)',
          color: 'var(--text-primary)',
        }}>
          {lumiMsg}
        </div>
      </div>

      {/* Colours the picture needs */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', width: '100%', maxWidth: 660, flexShrink: 0 }}>
        {colorGroups.map(group => (
          <ColorChip key={group.target} group={group} active={selected === group.target} />
        ))}
      </div>

      {/* Paint canvas — takes whatever height is left */}
      <div ref={boxRef} style={{ flex: 1, minHeight: 120, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {size > 0 && (
            <motion.div
              key={scene.id}
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1,    opacity: 1 }}
              exit={{   scale: 0.88, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 24 }}
            >
              <PaintCanvas
                scene={scene}
                size={size}
                filled={filled}
                selectedColor={selected}
                flash={flash}
                svgRef={svgRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Paint buckets */}
      <div style={{
        ...pxPanel, flexShrink: 0,
        padding: '6px 8px',
        width: '100%', maxWidth: 660,
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px clamp(2px,1vw,10px)', justifyContent: 'center' }}>
          {palette.map(color => (
            <PaintBucket
              key={color.name}
              color={color.value}
              name={color.name}
              selected={selected === color.name}
              onClick={() => chooseColor(color)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
