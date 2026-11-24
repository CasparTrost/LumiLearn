import { useReducer, useEffect, useRef, useState, useCallback, useMemo, useId, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { genMaze, shortestTour } from './maze/mazeGen.js'
import { mazeReducer, initState } from './maze/mazeReducer.js'
import { useBoardSize } from './maze/useBoardSize.js'
import { useSwipe } from './maze/useSwipe.js'
import { sfx } from '../sfx.js'
import './maze/maze.css'
import { afterNarration } from '../narrator.js'
import { sayRight } from '../lib/feedback.js'
import { usePaused } from '../lib/pause.js'
import { PxIcon } from '../components/PixelUI.jsx'
import { Art, HintHand, useBursts } from '../components/play/index.js'

// ──────────────────────────────────────────────────────────────────
// ASSET HELPER
// ──────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL ?? '/'
const spr = f => BASE.replace(/\/$/, '') + '/sprites/maze/' + f
const wangSpr = (theme, id) => spr(`wang/${theme}/wang_${id}.png`)

// ──────────────────────────────────────────────────────────────────
// LEVEL CONFIG
// ──────────────────────────────────────────────────────────────────
const LEVEL_CONFIG = level => {
  const hasDragon   = level >= 2
  const cols        = level <= 2 ? 11 : level <= 4 ? 13 : level <= 7 ? 15 : 19
  const rows        = cols
  // Fog used to arrive as one hard step: level 3 still had full sight,
  // level 4 dropped straight to a 4.5-cell radius while the grid grew to 13
  // and the dragon was already there — three new difficulties in one level
  // jump. A wide first veil sits in between now.
  const fogRadius   = level <= 3 ? null
                    : level === 4 ? 6.5
                    : level <= 6 ? 5
                    : level <= 8 ? 4 : 3.5
  // Three worlds: Zauberwald (1–3, bright path, dark hedge), Kristallhöhle
  // (4–6, lit by glowing crystals) and the Kerker (7–10, lit by torches).
  // The last two levels re-tint the Kerker so the finale is a place of its
  // own without new art.
  const theme       = level <= 3 ? 'zauberwald' : level <= 6 ? 'kristall' : 'kerker'
  const tint        = level >= 9 ? 'glut' : null
  // Dragon moves independently, once every `dragonSpeed` ms. Deliberately
  // slow and only ramps up gently with level — this is a kids' game, not
  // a reflex test. Combined with the short 5-cell patrol (mazeGen.js) and
  // long invincibility frames after a hit, a child has real time to watch
  // the pattern, judge a gap, and cross.
  const dragonSpeed = Math.max(650, 1300 - (level - 2) * 90)
  const patrolLen   = level <= 4 ? 5 : level <= 7 ? 6 : 7
  return { hasDragon, cols, rows, fogRadius, theme, tint, dragonSpeed, patrolLen }
}

// A win in at most this many times the fewest possible steps (all potions,
// then the exit) earns the crown: extra praise for planning the way. It
// never changes the stars, which go by the dragon's hits alone.
const SHORT_WAY = 1.3
// Where the stars twinkle round Lumi on a perfect win: the sides and the
// top, never below, where the title follows
const TWINKLE_ANGLES = [-150, -30, 170, 10, -115, -65]

// ──────────────────────────────────────────────────────────────────
// WALL TILE LOGIC — PixelLab-generated Wang (corner) tileset
// ──────────────────────────────────────────────────────────────────
// These 16-tile sets (public/sprites/maze/wang/<theme>/wang_0..15.png)
// are CORNER tiles, not edge tiles: unlike the old mw_*/forest_wall_*
// set (one sprite per maze CELL, picked from its 4 orthogonal
// neighbours), each of these sprites is meant to sit at the
// intersection POINT between four diagonally-adjacent maze cells — the
// classic "dual-grid" Wang-tiling technique. Its four quadrants show
// wall or floor material depending on whether the cell in that
// diagonal direction (NW/NE/SW/SE) is a wall, so adjacent sprites
// always line up seamlessly regardless of how jagged the maze boundary
// is — no separate straight/corner/solid file picking needed, and no
// risk of a mismatched rotation.
//
// id is a 4-bit number encoding which of the 4 surrounding cells are
// walls: NW*8 + NE*4 + SW*2 + SE*1 (1 = wall/"upper", 0 = floor/
// "lower" — matches the corners metadata PixelLab returned alongside
// each tile). id=0 (all floor) needs no sprite at all.
function wangTileId(dx, dy, g, cols, rows) {
  const isWall = (cx, cy) =>
    cx < 0 || cy < 0 || cx >= cols || cy >= rows ? true : g[cy][cx] === 1
  const nw = isWall(dx - 1, dy - 1)
  const ne = isWall(dx,     dy - 1)
  const sw = isWall(dx - 1, dy)
  const se = isWall(dx,     dy)
  return (nw ? 8 : 0) | (ne ? 4 : 0) | (sw ? 2 : 0) | (se ? 1 : 0)
}

// The Zauberwald set's all-floor tile (id 0) is the floor itself, so floor
// and wall edges come from one generation and match in colour and texture.
function floorSprite(theme) {
  return `wang/${theme}/wang_0.png`
}

// ──────────────────────────────────────────────────────────────────
// LIGHT SOURCES — torches (Kerker) and crystals (Kristallhöhle)
// ──────────────────────────────────────────────────────────────────
// Sit on wall cells that have floor directly below, so they read as
// mounted on the wall face. Picked in a fixed pseudo-random order and kept
// at least LIGHT_GAP cells apart: the old 1-in-8 sprinkle left whole
// quarters of a fogged maze without a single light, and clumped others.
// Closer together they lit up nearly the whole board and the fog no
// longer hid anything; the Kerker is sparser than the cave.
const LIGHT_KIND = { kerker: 'torch', kristall: 'crystal' }
const LIGHT_GAP  = { kerker: 6, kristall: 5 }

function lightSources(maze, theme) {
  const kind = LIGHT_KIND[theme]
  if (!kind) return []
  const { g, rows, cols } = maze
  const spots = []
  for (let y = 0; y < rows - 1; y++) {
    for (let x = 0; x < cols; x++) {
      if (g[y][x] === 1 && g[y + 1][x] === 0) spots.push({ x, y, h: (x * 73 + y * 151) % 97 })
    }
  }
  spots.sort((a, b) => a.h - b.h)
  const picked = []
  for (const s of spots) {
    if (picked.every(p => Math.abs(p.x - s.x) + Math.abs(p.y - s.y) >= LIGHT_GAP[theme])) {
      picked.push({ x: s.x, y: s.y, kind })
    }
  }
  return picked
}

// ──────────────────────────────────────────────────────────────────
// SPRITES — PixelLab art
// ──────────────────────────────────────────────────────────────────
// Animated sprites are horizontal strips of square frames, played by
// stepping background-position (mz-strip in maze.css).
const LUMI_WALK   = { src: 'lumi_walk.png',   frames: 10, fps: 12 }
const DRAGON_WALK = { src: 'dragon_walk.png', frames: 8,  fps: 9 }
const PORTAL_GLOW = { src: 'portal_glow.png', frames: 8,  fps: 8 }
const TORCH_FIRE  = { src: 'torch_fire.png',  frames: 8,  fps: 10 }

function SpriteStrip({ sprite, size, className, style }) {
  const { src, frames, fps } = sprite
  return (
    <div
      className={className}
      style={{
        width:              size,
        height:             size,
        backgroundImage:    `url(${spr(src)})`,
        backgroundSize:     `${frames * size}px ${size}px`,
        backgroundRepeat:   'no-repeat',
        imageRendering:     'pixelated',
        '--strip-w':        `${frames * size}px`,
        animation:          `mz-strip ${frames / fps}s steps(${frames}) infinite`,
        ...style,
      }}
    />
  )
}

// One potion sprite, three colours: pink, turquoise, gold.
const POTION_HUES = [0, 190, 60]
// Level 9–10: the Kerker glows red-hot, as if deep under a volcano.
const TINT = { glut: 'sepia(0.5) hue-rotate(-28deg) saturate(2.2) brightness(0.88)' }

const FOG_COLOR = { zauberwald: '#071f0e', kristall: '#0a0618', kerker: '#070403' }
const WORLD_LOOK = {
  zauberwald: {
    bg:   'radial-gradient(ellipse at 50% 30%, #2f8a3c 0%, #0b3d17 100%)',
    glow: '0 0 30px rgba(0,140,0,0.5), 0 12px 50px rgba(0,0,0,0.7)',
  },
  kristall: {
    bg:   'radial-gradient(ellipse at 50% 30%, #1d2b5e 0%, #070a1f 100%)',
    glow: '0 0 40px rgba(80,200,255,0.4), 0 0 80px rgba(80,200,255,0.15), 0 12px 50px rgba(0,0,0,0.7)',
  },
  kerker: {
    bg:   'radial-gradient(ellipse at 50% 30%, #3a2416 0%, #0d0805 100%)',
    glow: '0 0 40px rgba(255,140,40,0.32), 0 0 80px rgba(255,140,40,0.12), 0 12px 50px rgba(0,0,0,0.7)',
  },
}

const potionFilter = type => (POTION_HUES[type] ? `hue-rotate(${POTION_HUES[type]}deg) ` : '')

// ──────────────────────────────────────────────────────────────────
// MEMOISED BOARD — only re-renders when collected potions change
// ──────────────────────────────────────────────────────────────────
const Board = memo(function Board({ maze, cellSize, coll, theme, tint, lights }) {
  const { g, rows, cols, potions, exit } = maze
  // The exit stays grey with a lock until every potion is collected
  const open = coll.length >= potions.length

  // Dual-grid overlay: one wang tile per intersection point between 4
  // diagonally-adjacent cells, i.e. a (cols+1) x (rows+1) grid offset by
  // half a cell from the maze's own cell grid. id=0 (all 4 neighbours
  // floor) needs no sprite — the floor layer underneath already shows
  // through there.
  // Every world's tileset brings its own floor/wall contrast. The old
  // dungeon set did not (floor and wall a few RGB units apart) and needed
  // brightness filters plus per-tile masks; the Kerker set replaced it.
  const isWood      = theme === 'zauberwald'
  const tintFilter  = TINT[tint] ?? 'none'

  const wangOverlay = []
  for (let dy = 0; dy <= rows; dy++) {
    for (let dx = 0; dx <= cols; dx++) {
      const id = wangTileId(dx, dy, g, cols, rows)
      if (id === 0) continue
      wangOverlay.push({ dx, dy, id })
    }
  }

  return (
    <div style={{
      position:        'relative',
      width:           cols * cellSize,
      height:          rows * cellSize,
      overflow:        'hidden',
      imageRendering:  'pixelated',
    }}>
      {/* Floor layer — every cell, including under walls, so the wang
          overlay's rounded/diagonal transitions always have floor
          showing through wherever a corner isn't a wall. */}
      {g.map((row, y) =>
        row.map((cell, x) => (
          <img
            key={`f-${x},${y}`}
            src={spr(floorSprite(theme))}
            alt=""
            draggable={false}
            style={{
              position:        'absolute',
              left:            x * cellSize,
              top:             y * cellSize,
              width:           cellSize,
              height:          cellSize,
              imageRendering:  'pixelated',
              display:         'block',
              objectFit:       'cover',
              filter:          tintFilter,
            }}
            onError={e => {
              e.target.style.display = 'none'
              e.target.parentNode.style.background = isWood ? '#8fd14f' : '#120828'
            }}
          />
        ))
      )}

      {/* Wall layer — PixelLab Wang tileset, dual-grid positioned. */}
      {wangOverlay.map(({ dx, dy, id }) => (
          <img
            key={`w-${dx},${dy}`}
            src={wangSpr(theme, id)}
            alt=""
            draggable={false}
            style={{
              position:        'absolute',
              left:            (dx - 0.5) * cellSize,
              top:             (dy - 0.5) * cellSize,
              width:           cellSize,
              height:          cellSize,
              imageRendering:  'pixelated',
              display:         'block',
              filter:          tintFilter,
              pointerEvents:   'none',
            }}
            onError={e => { e.target.style.display = 'none' }}
          />
      ))}

      {/* Decorations — torch / exit / potion, above both tile layers */}
      {g.map((row, y) =>
        row.map((cell, x) => {
          const isWall   = cell === 1
          const isExit   = x === exit.x && y === exit.y
          const potion   = potions.find(p => p.x === x && p.y === y)
          const potionOk = potion && !coll.includes(potion.id)

          const light = isWall ? lights.find(l => l.x === x && l.y === y) : null

          if (!light && !(isExit && !isWall) && !potionOk) return null

          return (
            <div
              key={`d-${x},${y}`}
              style={{
                position: 'absolute',
                left:     x * cellSize,
                top:      y * cellSize,
                width:    cellSize,
                height:   cellSize,
              }}
            >
              {/* Torch / crystal on the wall face */}
              {light?.kind === 'torch' && (
                <SpriteStrip
                  sprite={TORCH_FIRE}
                  size={Math.round(cellSize * 0.9)}
                  style={{
                    position:      'absolute',
                    bottom:        -Math.round(cellSize * 0.08),
                    left:          '50%',
                    transform:     'translateX(-50%)',
                    pointerEvents: 'none',
                    zIndex:        3,
                  }}
                />
              )}
              {light?.kind === 'crystal' && (
                <img
                  src={spr('crystal.png')}
                  alt=""
                  draggable={false}
                  className="mz-crystal"
                  style={{
                    position:       'absolute',
                    bottom:         0,
                    left:           '50%',
                    width:          Math.round(cellSize * 0.8),
                    height:         Math.round(cellSize * 0.8),
                    imageRendering: 'pixelated',
                    pointerEvents:  'none',
                    zIndex:         3,
                  }}
                />
              )}

              {/* Exit portal */}
              {isExit && !isWall && (
                <div style={{
                  position:        'absolute',
                  inset:           0,
                  display:         'flex',
                  alignItems:      'center',
                  justifyContent:  'center',
                  zIndex:          5,
                  filter:          open ? undefined : 'grayscale(0.85) brightness(0.75)',
                  transition:      'filter 0.6s',
                }}>
                  {!open && (
                    <span style={{
                      position: 'absolute', zIndex: 2, lineHeight: 1,
                      fontSize: Math.round(cellSize * 0.42),
                    }}>🔒</span>
                  )}
                  {theme !== 'kerker' ? (
                    <SpriteStrip
                      sprite={PORTAL_GLOW}
                      size={cellSize}
                      style={{ filter: 'drop-shadow(0 0 6px #67e8f9)' + (theme === 'kristall' ? ' hue-rotate(40deg)' : '') }}
                    />
                  ) : (
                  <img
                    src={spr('maze_portal.png')}
                    alt="Ausgang"
                    className="mz-portal"
                    draggable={false}
                    style={{
                      width:          Math.round(cellSize * 0.85),
                      height:         Math.round(cellSize * 0.85),
                      imageRendering: 'pixelated',
                      filter:         'drop-shadow(0 0 6px #a855f7)',
                    }}
                    onError={e => {
                      e.target.style.display = 'none'
                      e.target.parentNode.innerHTML += '<span style="font-size:' + Math.round(cellSize * 0.7) + 'px" class="mz-portal">🌀</span>'
                    }}
                  />
                  )}
                </div>
              )}

              {/* Potion */}
              {potionOk && (
                <div style={{
                  position:       'absolute',
                  inset:          0,
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  zIndex:         5,
                }}>
                  <img
                    src={spr('potion.png')}
                    alt="Trank"
                    className="mz-coin"
                    draggable={false}
                    style={{
                      width:          Math.round(cellSize * 0.66),
                      height:         Math.round(cellSize * 0.66),
                      imageRendering: 'pixelated',
                      filter:         potionFilter(potion.type) + 'drop-shadow(0 0 5px rgba(255,255,255,0.8))',
                    }}
                    onError={e => {
                      e.target.style.display = 'none'
                      e.target.parentNode.innerHTML += '<span style="font-size:' + Math.round(cellSize * 0.55) + 'px" class="mz-coin">🧪</span>'
                    }}
                  />
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
})

// ──────────────────────────────────────────────────────────────────
// SPARKLE BURST on potion pickup
// ──────────────────────────────────────────────────────────────────
function Sparkles({ x, y, cellSize }) {
  const items = ['✦', '✧', '⋆', '✦', '✧', '⋆']
  return (
    <div style={{
      position:      'absolute',
      left:          x * cellSize,
      top:           y * cellSize,
      width:         cellSize,
      height:        cellSize,
      pointerEvents: 'none',
      zIndex:        30,
    }}>
      {items.map((ch, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 1, scale: 0, x: cellSize / 2, y: cellSize / 2, rotate: 0 }}
          animate={{
            opacity: 0,
            scale:   1.5,
            x:       cellSize / 2 + Math.cos((i / items.length) * Math.PI * 2) * cellSize * 0.9,
            y:       cellSize / 2 + Math.sin((i / items.length) * Math.PI * 2) * cellSize * 0.9,
            rotate:  180,
          }}
          transition={{ duration: 0.55, ease: 'easeOut' }}
          style={{ position: 'absolute', fontSize: cellSize * 0.28, color: '#FFD700', lineHeight: 1 }}
        >
          {ch}
        </motion.span>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// LIGHTING — fog of war with real light sources
// ──────────────────────────────────────────────────────────────────
// The fog used to be one radial CSS mask around Lumi: everything else was
// black, torches included, so they decorated nothing. Now the fog is an
// SVG mask (white = fog, black = clear) that several lights cut into:
//   • Lumi glows and lights the cells around,
//   • torches / crystals light their own patch of corridor, so they work
//     as landmarks even far away,
//   • the exit and any potion still lying around shine a little,
//   • cells Lumi has already walked stay faintly visible.
// A second, additive layer paints the warm (torch) or cool (crystal) glow
// on top, flickering gently.
const LIGHT_LOOK = {
  torch:   { r: 1.8, glow: 'rgba(255,150,40,0.6)',  flicker: true  },
  crystal: { r: 1.8, glow: 'rgba(120,220,255,0.4)', flicker: false },
}
const SEEN_FOG = '#8a8a8a'   // mask grey: explored cells keep ~55 % fog

function Lighting({ maze, cellSize, pos, seen, lights, coll, radius, fogColor, extra = [] }) {
  const id = useId().replace(/:/g, '')
  const { cols, rows, exit, potions } = maze
  const W = cols * cellSize
  const H = rows * cellSize
  const c = v => (v + 0.5) * cellSize

  const spots = [
    ...lights.map(l => ({ key: `l-${l.x},${l.y}`, x: c(l.x), y: c(l.y) + cellSize * 0.45, r: LIGHT_LOOK[l.kind].r })),
    { x: c(exit.x), y: c(exit.y), r: 1.5, key: 'exit' },
    ...potions.filter(p => !coll.includes(p.id)).map(p => ({ x: c(p.x), y: c(p.y), r: 1.0, key: 'p' + p.id })),
    ...extra.map(e => ({ x: c(e.x), y: c(e.y), r: 0.9, key: 'x' + e.x + ',' + e.y })),
  ]

  return (
    <>
      <svg
        width={W}
        height={H}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 10 }}
        aria-hidden="true"
      >
        <defs>
          <radialGradient id={`${id}-hole`}>
            <stop offset="0%"   stopColor="#000" stopOpacity="1" />
            <stop offset="55%"  stopColor="#000" stopOpacity="1" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={W} height={H}>
            <rect width={W} height={H} fill="#fff" />
            {Object.keys(seen).map(k => {
              const [x, y] = k.split(',').map(Number)
              return <rect key={k} x={x * cellSize} y={y * cellSize} width={cellSize} height={cellSize} fill={SEEN_FOG} />
            })}
            {spots.map(sp => (
              <circle key={sp.key} cx={sp.x} cy={sp.y} r={sp.r * cellSize} fill={`url(#${id}-hole)`} />
            ))}
            {/* Lumi's own light glides along instead of jumping */}
            <circle
              cx={0}
              cy={0}
              r={radius * cellSize}
              fill={`url(#${id}-hole)`}
              style={{ r: radius * cellSize, transform: `translate(${c(pos.x)}px, ${c(pos.y)}px)`, transition: 'transform 0.22s ease-out, r 0.6s ease-out' }}
            />
          </mask>
        </defs>
        <rect width={W} height={H} fill={fogColor} mask={`url(#${id}-mask)`} />
      </svg>

      {/* Coloured glow of the light sources, added on top of the fog */}
      {lights.map(l => {
        const look = LIGHT_LOOK[l.kind]
        const d = look.r * 2 * cellSize
        return (
          <div
            key={`g-${l.x},${l.y}`}
            className={look.flicker ? 'mz-flicker' : 'mz-shimmer'}
            style={{
              position:      'absolute',
              left:          c(l.x) - d / 2,
              top:           c(l.y) + cellSize * 0.45 - d / 2,
              width:         d,
              height:        d,
              borderRadius:  '50%',
              background:    `radial-gradient(circle, ${look.glow} 0%, transparent 68%)`,
              mixBlendMode:  'screen',
              pointerEvents: 'none',
              zIndex:        12,
              animationDelay: `${-((l.x * 7 + l.y * 3) % 10) / 10}s`,
            }}
          />
        )
      })}
    </>
  )
}

// ──────────────────────────────────────────────────────────────────
// D-PAD BUTTON  (touch-friendly with hold-repeat)
//
// IMPORTANT: without setPointerCapture, `whileTap={{ scale: 0.86 }}`
// shrinking the button on press can slide the button's hit-area out from
// under the finger — the browser then delivers `pointerup` to whatever
// element ends up under the pointer, NOT to this button, so `stop()`
// never runs and the repeat interval fires forever (the character keeps
// walking on its own). Pointer capture pins all events for this pointer
// to this element regardless of visual size changes. A window-level
// fallback listener is a second safety net in case capture itself fails.
// ──────────────────────────────────────────────────────────────────
// Pixel arrow instead of ◀▶▲▼, which some devices drew as coloured emoji
const ARROW = { up: ['down', 180], down: ['down', 0], left: ['play', 180], right: ['play', 0] }

function DPadButton({ dir, label, onPress, size = 52, style: styleOverride }) {
  const repeatRef = useRef(null)
  const activeRef = useRef(false)

  const stop = useCallback(() => {
    if (!activeRef.current) return
    activeRef.current = false
    clearInterval(repeatRef.current)
    repeatRef.current = null
  }, [])

  const start = useCallback(e => {
    activeRef.current = true
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    onPress()
    clearInterval(repeatRef.current)
    repeatRef.current = setInterval(onPress, 155)
  }, [onPress])

  // Global safety net — guarantees the repeat stops even if this
  // element never receives its own pointerup/cancel (capture failure,
  // browser quirk, or the finger sliding off while the button shrinks).
  useEffect(() => {
    window.addEventListener('pointerup', stop)
    window.addEventListener('pointercancel', stop)
    window.addEventListener('blur', stop)
    return () => {
      window.removeEventListener('pointerup', stop)
      window.removeEventListener('pointercancel', stop)
      window.removeEventListener('blur', stop)
      stop()
    }
  }, [stop])

  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      aria-label={label}
      style={{
        width:             size,
        height:            size,
        background:        'rgba(255,255,255,0.14)',
        border:            '2px solid rgba(255,255,255,0.28)',
        borderRadius:      12,
        color:             'white',
        fontSize:          22,
        cursor:            'pointer',
        display:           'flex',
        alignItems:        'center',
        justifyContent:    'center',
        backdropFilter:    'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        touchAction:       'none',
        userSelect:        'none',
        WebkitUserSelect:  'none',
        ...styleOverride,
      }}
    >
      <PxIcon name={ARROW[dir][0]} size={20} color="white" style={{ transform: `rotate(${ARROW[dir][1]}deg)` }} />
    </motion.button>
  )
}

// A screen wider than tall (a tablet held across): arrows beside the maze
function useWide() {
  const get = () => typeof window !== 'undefined' && window.innerWidth >= 720 && window.innerWidth > window.innerHeight * 1.1
  const [wide, setWide] = useState(get)
  useEffect(() => {
    const on = () => setWide(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return wide
}

// Animals that live in the dead ends of the open mazes
const FRIENDS = ['🐇', '🐸', '🦔', '🐿️', '🦋']

// Cells with one way in, far from the start and the exit, farthest first
function deadEnds({ g, start, exit, potions }) {
  const open = (x, y) => g[y]?.[x] === 0
  const out = []
  for (let y = 1; y < g.length - 1; y++) for (let x = 1; x < g[0].length - 1; x++) {
    if (!open(x, y)) continue
    const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => open(x + dx, y + dy)).length
    const taken = [start, exit, ...potions].some(c => c.x === x && c.y === y)
    if (ways === 1 && !taken) out.push({ x, y, d: Math.abs(x - start.x) + Math.abs(y - start.y) })
  }
  return out.sort((a, b) => b.d - a.d).filter((c, i, all) => i === 0 || Math.abs(c.x - all[0].x) + Math.abs(c.y - all[0].y) > 6)
}

// The first step from `from` on the shortest way to the nearest target
// (the hint hand shows it on the arrow buttons)
function firstStep(g, from, targets) {
  const key = p => `${p.x},${p.y}`
  const goal = new Set(targets.map(key))
  const prev = new Map([[key(from), null]])
  const queue = [from]
  while (queue.length) {
    const c = queue.shift()
    if (goal.has(key(c))) {
      let p = c
      while (prev.get(key(p)) && key(prev.get(key(p))) !== key(from)) p = prev.get(key(p))
      return { dx: p.x - from.x, dy: p.y - from.y }
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, y: c.y + dy }
      if (g[n.y]?.[n.x] !== 0 || prev.has(key(n))) continue
      prev.set(key(n), c)
      queue.push(n)
    }
  }
  return null
}

// ── Potions with powers ─────────────────────────────────────────────
// Each potion does something for the next eight steps, by its colour:
// pink makes Lumi big and the dragon gets out of the way, turquoise leaves
// sparkly footprints (they stay, a trail through the fog), gold widens
// Lumi's light. Nothing to read: the potion floats over Lumi with a pip
// per step left.
const POWER_STEPS = 8
const POWER_GLOW  = ['rgba(255,120,200,0.55)', 'rgba(80,240,230,0.55)', 'rgba(255,210,60,0.6)']

// ── The treasure chest ──────────────────────────────────────────────
// In the dead end farthest off the way to the potions and the gate: worth
// the long way round, and found only by wandering. Opened, it pops
// confetti and gives Lumi a sticker, shown again at the win.
const LOOT = ['💎', '👑', '🦄', '🌈', '🔮', '⭐']
function treasureSpot({ g, start, exit, potions, mainPath }, avoid) {
  const key = p => `${p.x},${p.y}`
  const dist = new Map((mainPath ?? []).map(p => [key(p), 0]))
  const queue = [...(mainPath ?? [])]
  while (queue.length) {
    const c = queue.shift(), d = dist.get(key(c))
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: c.x + dx, y: c.y + dy }
      if (g[n.y]?.[n.x] !== 0 || dist.has(key(n))) continue
      dist.set(key(n), d + 1)
      queue.push(n)
    }
  }
  const taken = new Set([start, exit, ...potions, ...avoid].map(key))
  let best = null
  for (let y = 1; y < g.length - 1; y++) for (let x = 1; x < g[0].length - 1; x++) {
    if (g[y][x] !== 0 || taken.has(`${x},${y}`)) continue
    const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => g[y + dy]?.[x + dx] === 0).length
    if (ways !== 1) continue
    const off = dist.get(`${x},${y}`) ?? 0
    const far = Math.abs(x - start.x) + Math.abs(y - start.y)
    if (!best || off > best.off || (off === best.off && far > best.far)) best = { x, y, off, far }
  }
  return best
}

// A wooden chest drawn here (there is none in the emoji set): the lid
// flips open
function Chest({ size, open }) {
  return (
    <svg viewBox="0 0 40 36" width={size} height={size * 0.9} aria-hidden="true" style={{ overflow: 'visible', display: 'block' }}>
      <rect x="4" y="16" width="32" height="18" rx="3" fill="#A0622D" stroke="#2a1b3d" strokeWidth="2.5" />
      <rect x="4" y="22" width="32" height="4" fill="#FFC93C" stroke="#2a1b3d" strokeWidth="1.5" />
      <rect x="17" y="20" width="6" height="8" rx="1.5" fill="#FFE08A" stroke="#2a1b3d" strokeWidth="1.5" />
      {open && <ellipse cx="20" cy="16" rx="13" ry="3.5" fill="#FFE27A" />}
      <motion.g initial={false} animate={{ rotate: open ? -70 : 0 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}
        style={{ originX: 0, originY: 1 }}>
        <path d="M4 16 Q4 5 20 5 Q36 5 36 16 Z" fill="#B5733A" stroke="#2a1b3d" strokeWidth="2.5" strokeLinejoin="round" />
        <path d="M18 5 V16 M22 5 V16" stroke="#FFC93C" strokeWidth="2" />
      </motion.g>
    </svg>
  )
}

// A sticker: the picture with a thick white edge
function Sticker({ art, size }) {
  return (
    <span style={{ display: 'inline-flex', padding: size * 0.1, borderRadius: '30%', background: '#fff', boxShadow: '0 0 0 2px #2a1b3d, 0 3px 0 2px rgba(0,0,0,0.3)' }}>
      <Art art={art} size={size * 0.8} />
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────
export default function MazeGame({ level = 1, onComplete }) {
  const cfg      = LEVEL_CONFIG(level)
  const wide     = useWide()
  const dpadRefs = { up: useRef(null), down: useRef(null), left: useRef(null), right: useRef(null) }
  const mazeRef  = useRef(null)
  if (!mazeRef.current) mazeRef.current = genMaze(cfg.cols, cfg.rows, Date.now(), cfg.patrolLen)

  const [st, dispatch] = useReducer(mazeReducer, null, () => initState(mazeRef.current, cfg.hasDragon))
  const stRef = useRef(st)
  stRef.current = st

  // While the help is open the dragon, the preview and Lumi hold still
  const paused    = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused

  // Fog levels first show the whole map for a moment: "Merk dir den Weg!"
  // — a chance to plan before the fog closes in.
  const [preview, setPreview] = useState(!!cfg.fogRadius)
  const previewLeftRef = useRef(4500)

  const { containerRef, cellSize: camCell, fitCell, viewCols, viewRows } = useBoardSize(cfg.cols, cfg.rows, 76)
  const lights = useMemo(() => lightSources(mazeRef.current, cfg.theme), [cfg.theme])

  const doneRef         = useRef(false)
  const onCompleteRef   = useRef(onComplete)
  onCompleteRef.current = onComplete

  const prevDangerRef  = useRef(0)
  const dragonStepRef  = useRef(0)
  const dragonDirRef   = useRef(1)
  // The dragon sprite faces east; it looks where it walks, and keeps that
  // facing while it patrols up and down.
  const dragonFaceRef  = useRef(1)

  const [sparkles, setSparkles]     = useState([]) // [{ id, x, y }]
  const [gateNag, setGateNag]       = useState(0)  // bumped into the closed gate (time)
  const [hitFx, setHitFx]           = useState(0)  // the dragon caught Lumi (time)
  const [showOverlay, setShowOverlay] = useState(null) // 'won' | 'dead'
  const [power, setPower]           = useState(null) // { type, until } — the last potion's power, until that many moves
  const [prints, setPrints]         = useState([])   // turquoise footprints: [{ x, y, k }]
  const [scare, setScare]           = useState(0)    // big Lumi walked into the dragon (time)
  const [dragonTap, setDragonTap]   = useState(null) // { k, kind: 'giggle' | 'blush' }
  const [chestOpen, setChestOpen]   = useState(0)    // time it was opened
  const [loot]                      = useState(() => LOOT[Math.floor(Math.random() * LOOT.length)])
  const [bursts, burst]             = useBursts()
  const chestRef = useRef(null)
  // The fewest steps for this maze, and the bonus earned at the win:
  // null, 'short' (crown) or 'perfect' (short way and the dragon never hit)
  const shortest = useMemo(() => shortestTour(mazeRef.current), [])
  const [bonus, setBonus] = useState(null)

  // Every time the dragon caught Lumi, over all tries: the stars go by it
  // (none → 3, one → 2, more → 1). A win used to give three stars however
  // many hearts were lost on the way.
  const hitsRef      = useRef(0)
  const restartRef   = useRef(null)
  // Camera position (top-left cell) when only a part of the maze fits
  const camRef       = useRef({ x: 0, y: 0 })

  // Moving timer — clear the "moving" flag after animation settles
  const moveTimerRef = useRef(null)

  // ── FINISH ──────────────────────────────────────────────────────
  const finish = useCallback((score, total, delay = 1800) => {
    if (doneRef.current) return
    doneRef.current = true
    afterNarration(() => onCompleteRef.current({ score, total }), { minMs: delay })
  }, [])

  // ── MOVE HELPER ─────────────────────────────────────────────────
  const doMove = useCallback((dx, dy) => {
    if (pausedRef.current) return
    dispatch({ type: 'MOVE', dx, dy, now: Date.now() })
    // Clear moving flag after spring animation
    clearTimeout(moveTimerRef.current)
    moveTimerRef.current = setTimeout(
      () => dispatch({ type: 'SET_MOVING', value: false }),
      320
    )
  }, [])

  // ── KEYBOARD ────────────────────────────────────────────────────
  useEffect(() => {
    const DIRS = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    }
    const handler = e => {
      const dir = DIRS[e.key]
      if (!dir) return
      e.preventDefault()
      doMove(dir[0], dir[1])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doMove])

  // ── DRAGON MOVEMENT — independent patrol, real time ───────────────
  // Reflects cleanly at both ends of the patrol (visits every cell,
  // including the two extremes — an earlier version corrected the index
  // before dispatching it, so the outermost cells were never actually
  // reached). Speed is deliberately slow and only ramps up gently with
  // level, so a child has real time to watch the pattern and react.
  useEffect(() => {
    const wps = mazeRef.current.dragonWps
    if (!cfg.hasDragon || !wps || wps.length < 2 || st.won || st.dead || paused) return

    const last = wps.length - 1
    const iv = setInterval(() => {
      let i   = dragonStepRef.current
      let dir = dragonDirRef.current
      if (i >= last) dir = -1
      else if (i <= 0) dir = 1
      const dx = wps[i + dir].x - wps[i].x
      if (dx) dragonFaceRef.current = Math.sign(dx)
      i += dir
      dragonStepRef.current = i
      dragonDirRef.current  = dir
      dispatch({ type: 'DRAGON_STEP', pos: wps[i], now: Date.now() })
    }, cfg.dragonSpeed)

    return () => clearInterval(iv)
  }, [cfg.hasDragon, cfg.dragonSpeed, st.won, st.dead, paused])

  // ── PREVIEW — the whole map, then the fog ─────────────────────────
  useEffect(() => {
    if (!preview || paused) return
    const t0 = Date.now()
    const id = setTimeout(() => setPreview(false), previewLeftRef.current)
    return () => { clearTimeout(id); previewLeftRef.current -= Date.now() - t0 }
  }, [preview, paused])

  // ── SIDE EFFECTS — consume events from reducer ───────────────────
  // Everything the child needs to know is shown, not said: the potion
  // jumps into the tracker, a closed gate shows its lock and the potions
  // still missing, a hit flashes and Lumi tumbles.
  useEffect(() => {
    const ev = st.event
    if (!ev) return

    switch (ev.type) {
      case 'bump':
        try { sfx.bump() } catch { /* ignore */ }
        navigator.vibrate?.(18)
        break

      case 'potion': {
        try { sfx.potion() } catch { /* ignore */ }
        const type = mazeRef.current.potions.find(p => p.id === ev.id)?.type ?? 0
        setPower({ type, until: stRef.current.moves + POWER_STEPS })
        if (type === 0) dispatch({ type: 'BIG', steps: POWER_STEPS })
        const sid = Date.now()
        setSparkles(prev => [...prev, { id: sid, x: ev.x, y: ev.y }])
        setTimeout(() => setSparkles(prev => prev.filter(s => s.id !== sid)), 700)
        break
      }

      // Big Lumi walked into the dragon: it jumps aside, startled
      case 'scare':
        try { sfx.boing() } catch { /* ignore */ }
        setScare(Date.now())
        break

      case 'needPotions':
        try { sfx.boing() } catch { /* ignore */ }
        setGateNag(Date.now())
        break

      case 'hit':
        hitsRef.current++
        try { sfx.hitPlayer() } catch { /* ignore */ }
        setHitFx(Date.now())
        navigator.vibrate?.([60, 40, 60])
        break

      // The last heart is gone: the same maze once more from the start,
      // instead of ending the game with no stars.
      case 'dead':
        hitsRef.current++
        try { sfx.hitPlayer() } catch { /* ignore */ }
        setHitFx(Date.now())
        navigator.vibrate?.([80, 40, 80, 40, 80])
        setShowOverlay('dead')
        setPower(null)
        clearTimeout(restartRef.current)
        restartRef.current = setTimeout(() => {
          dragonStepRef.current = 0
          dragonDirRef.current  = 1
          dispatch({ type: 'RESTART' })
          setShowOverlay(null)
        }, 3200)
        break

      case 'won': {
        const short   = ev.moves <= shortest * SHORT_WAY
        // "No hits" only means something where there is a dragon
        const perfect = short && cfg.hasDragon && hitsRef.current === 0
        try { sfx.complete() } catch { /* ignore */ }
        sayRight()
        navigator.vibrate?.([50, 30, 50, 30, 100])
        setBonus(perfect ? 'perfect' : short ? 'short' : null)
        setShowOverlay('won')
        finish(Math.max(0, 3 - hitsRef.current), 3, short ? 3200 : 2600)
        break
      }

      default:
        break
    }

    dispatch({ type: 'CLEAR_EVENT' })
  }, [st.event, finish]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── DANGER WARNING SOUND ─────────────────────────────────────────
  useEffect(() => {
    if (st.dangerLevel >= 1 && prevDangerRef.current < 1) {
      try { sfx.dragonNear() } catch { /* ignore */ }
    }
    prevDangerRef.current = st.dangerLevel
  }, [st.dangerLevel])

  // ── THE GOAL, SHOWN AT THE START ──────────────────────────────────
  // The potions, an arrow, the gate (and the dragon to look out for), for
  // a moment over the board: what the level is about, without words.
  const [intro, setIntro] = useState(true)
  useEffect(() => {
    if (paused) return
    const id = setTimeout(() => setIntro(false), 2800)
    return () => clearTimeout(id)
  }, [paused])

  // ── FRIENDS — little animals in dead ends of the open mazes ────────
  // They hop and send hearts when Lumi visits: something to discover on
  // the way, with no score attached.
  const friends = useMemo(() => (cfg.fogRadius ? [] : deadEnds(mazeRef.current).slice(0, 2)
    .map((c, i) => ({ ...c, art: FRIENDS[(level + i) % FRIENDS.length] }))), [cfg.fogRadius, level])
  const [met, setMet] = useState([])
  useEffect(() => {
    const f = friends.find(c => Math.abs(c.x - st.pos.x) + Math.abs(c.y - st.pos.y) <= 1)
    if (f && !met.includes(f.art)) { setMet(m => [...m, f.art]); try { sfx.giggle() } catch { /* ignore */ } }
  }, [st.pos, friends, met])

  // ── POWERS ────────────────────────────────────────────────────────
  const powerOn = power && st.moves < power.until && !st.dead ? power.type : null
  const big     = powerOn === 0
  useEffect(() => {
    if (!power || power.type !== 1 || !st.moves || st.moves > power.until) return
    setPrints(p => (p.some(q => q.k === st.moves) ? p : [...p.slice(-70), { x: st.pos.x, y: st.pos.y, k: st.moves, f: st.facing }]))
  }, [st.moves]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── THE CHEST ─────────────────────────────────────────────────────
  const chest = useMemo(() => treasureSpot(mazeRef.current, friends), [friends])
  useEffect(() => {
    if (!chest || chestOpen || st.pos.x !== chest.x || st.pos.y !== chest.y) return
    setChestOpen(Date.now())
    try { sfx.tada() } catch { /* ignore */ }
    burst(chestRef.current, 'confetti', 26)
    setTimeout(() => burst(chestRef.current, 'stars', 10), 250)
  }, [st.pos]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── THE DRAGON, TAPPED ─────────────────────────────────────────────
  // It giggles, or blushes — a friend, after all
  const tapDragon = e => {
    e.stopPropagation()
    const kind = dragonTap?.kind === 'giggle' ? 'blush' : 'giggle'
    try { if (kind === 'giggle') sfx.giggle(); else sfx.sparkle() } catch { /* ignore */ }
    setDragonTap({ k: Date.now(), kind })
  }

  // ── CLEANUP ───────────────────────────────────────────────────────
  useEffect(() => () => {
    clearTimeout(moveTimerRef.current)
    clearTimeout(restartRef.current)
  }, [])

  // ── SWIPE ────────────────────────────────────────────────────────
  // Holding the finger after a swipe keeps Lumi walking — up to the next
  // fork, a wall, or the dragon.
  const canRun = useCallback((dx, dy) => {
    const { pos, dragon, won, dead } = stRef.current
    const g = mazeRef.current.g
    if (pausedRef.current || won || dead) return false
    const nx = pos.x + dx, ny = pos.y + dy
    if (g[ny]?.[nx] !== 0) return false
    if (dragon && dragon.x === nx && dragon.y === ny) return false
    const sides = dx !== 0 ? [[0, 1], [0, -1]] : [[1, 0], [-1, 0]]
    return !sides.some(([sx, sy]) => g[pos.y + sy]?.[pos.x + sx] === 0)
  }, [])
  const swipeHandlers = useSwipe(
    (dx, dy, repeat) => {
      if (repeat && !canRun(dx, dy)) return false
      doMove(dx, dy)
      return true
    },
    { threshold: 18 }
  )

  // ──────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────
  const { cols, rows, theme, fogRadius, hasDragon } = cfg
  // The preview shows the whole maze; after it, a part around Lumi when the
  // whole one would make the cells too small
  const cellSize = preview ? fitCell : camCell
  const vCols    = preview ? cols : viewCols
  const vRows    = preview ? rows : viewRows
  const boardW = cols * cellSize
  const boardH = rows * cellSize

  // The camera only moves once Lumi comes within three cells of its edge
  {
    const margin = 3
    let { x: cx, y: cy } = camRef.current
    if (st.pos.x < cx + margin) cx = st.pos.x - margin
    if (st.pos.x > cx + vCols - 1 - margin) cx = st.pos.x - (vCols - 1 - margin)
    if (st.pos.y < cy + margin) cy = st.pos.y - margin
    if (st.pos.y > cy + vRows - 1 - margin) cy = st.pos.y - (vRows - 1 - margin)
    camRef.current = {
      x: Math.max(0, Math.min(cols - vCols, cx)),
      y: Math.max(0, Math.min(rows - vRows, cy)),
    }
  }
  const cam = camRef.current

  const { bg: bgGrad, glow } = WORLD_LOOK[theme]

  // Where the hint hand points: the arrow on the shortest way to the next
  // potion, or to the gate once all are in
  const left = mazeRef.current.potions.filter(p => !st.coll.includes(p.id))
  const step = firstStep(mazeRef.current.g, st.pos, left.length ? left : [mazeRef.current.exit])
  const nextDir = !step ? null : step.dx > 0 ? 'right' : step.dx < 0 ? 'left' : step.dy > 0 ? 'down' : step.dy < 0 ? 'up' : null
  const padSize = wide ? 66 : 56

  // Invincibility: blinking
  const isInvincible = st.invUntil > Date.now()
  const lumiSize     = Math.round(cellSize * 1.05)
  // The Lumi sprite is drawn turned slightly to the left, the knight it
  // replaced faced right — so the flip is the other way round.
  const lumiFlip     = -st.facing

  const dragonDir = dragonFaceRef.current

  return (
    <div style={{
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      height:          '100%',
      minHeight:       0,
      overflow:        'hidden',
      background:      bgGrad,
      paddingInline:   8,
      paddingBottom:   8,
      boxSizing:       'border-box',
    }}>

      {bursts}
      {/* ── HUD ─────────────────────────────────────────────────────
          The hearts, and the goal as a picture: each potion still to find
          as a grey shape, found ones in colour, then the gate — locked
          until all are in. A bump into the closed gate makes the missing
          potions jump. */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        width:           '100%',
        maxWidth:        720,
        padding:         '6px 4px',
        flexShrink:      0,
        gap:             8,
      }}>
        <div aria-label={`${st.lives} Herzen`} style={{ display: 'flex', gap: 2 }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ scale: i < st.lives ? 1 : 0.5, opacity: i < st.lives ? 1 : 0.25, rotate: i < st.lives ? 0 : -30 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              <Art art={i < st.lives ? '❤️' : '💔'} size={30} />
            </motion.span>
          ))}
          {/* the chest's sticker, once found */}
          <AnimatePresence>
            {chestOpen > 0 && (
              <motion.span key="sticker" initial={{ scale: 0, rotate: -40 }} animate={{ scale: 1, rotate: -8 }} transition={{ delay: 1.2, type: 'spring', stiffness: 300, damping: 12 }}
                style={{ marginLeft: 4 }}>
                <Sticker art={loot} size={30} />
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        <div aria-label={`${st.coll.length} von ${mazeRef.current.potions.length} Tränken`} style={{
          display: 'flex', gap: 6, alignItems: 'center', padding: '4px 10px', borderRadius: 16,
          background: 'rgba(255,253,247,0.92)', border: '3px solid var(--px-ink)', boxShadow: '0 3px 0 rgba(0,0,0,0.3)',
        }}>
          {mazeRef.current.potions.map(p => {
            const done = st.coll.includes(p.id)
            return (
              <motion.div key={`${p.id}-${done ? 'in' : gateNag}`}
                initial={false}
                animate={done ? { scale: [1.6, 1], rotate: [0, 360] } : gateNag ? { y: [0, -10, 0, -10, 0], scale: [1, 1.25, 1] } : { scale: 1 }}
                transition={{ duration: done ? 0.5 : 0.9 }}
                style={{ width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? 'transparent' : 'rgba(42,27,61,0.12)', border: done ? 'none' : '2px dashed rgba(42,27,61,0.45)' }}
              >
                <img src={spr('potion.png')} alt=""
                  style={{ width: 32, height: 32, imageRendering: 'pixelated', display: 'block',
                    filter: done ? potionFilter(p.type) || undefined : 'grayscale(1) brightness(1.4) opacity(0.45)' }}
                  onError={e => { e.target.style.display = 'none' }} />
              </motion.div>
            )
          })}
          <span aria-hidden="true" style={{ fontSize: 22, fontWeight: 900, color: 'var(--px-ink)' }}>→</span>
          <div style={{ position: 'relative', width: 36, height: 36 }}>
            <img src={spr('maze_portal.png')} alt="" style={{ width: 36, height: 36, imageRendering: 'pixelated', display: 'block' }} />
            <AnimatePresence>
              {st.coll.length < mazeRef.current.potions.length && (
                <motion.span key="lock" exit={{ scale: 0, rotate: 90 }} style={{ position: 'absolute', right: -8, bottom: -6 }}>
                  <Art art="🔒" size={22} />
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* ── Look first / the dragon is near ──────────────────────────
          Fixed-height slot, always present in the flex layout — the
          board container below is watched by a ResizeObserver, so a
          banner coming and going must never change its height. */}
      <div style={{
        height:      40,
        flexShrink:  0,
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        width:       '100%',
      }}>
        <AnimatePresence>
          {preview && (
            // Look at the map: the eyes, and a bar running out
            <motion.div key="preview" aria-label="Merk dir den Weg!"
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(42,27,61,0.8)', padding: '3px 14px', borderRadius: 20 }}>
              <Art art="👀" size={28} />
              <div style={{ width: 120, height: 10, borderRadius: 5, background: 'rgba(255,255,255,0.25)', overflow: 'hidden' }}>
                <motion.div initial={{ width: '100%' }} animate={{ width: paused ? undefined : '0%' }} transition={{ duration: previewLeftRef.current / 1000, ease: 'linear' }}
                  style={{ height: '100%', background: '#FFC93C' }} />
              </div>
            </motion.div>
          )}
          {!preview && st.dangerLevel > 0 && !big && !st.won && !st.dead && (
            <motion.div key="danger" aria-label="Der Drache ist nah!"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, scale: st.dangerLevel >= 1 ? [1, 1.12, 1] : 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={st.dangerLevel >= 1 ? { scale: { duration: 0.7, repeat: Infinity } } : {}}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: st.dangerLevel >= 1 ? 'rgba(220,38,38,0.9)' : 'rgba(160,55,0,0.75)',
                padding: '2px 14px', borderRadius: 20,
              }}
            >
              <Art art="⚠️" size={26} /><Art art="🐉" size={30} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Board and arrows: side by side on a wide screen, so the maze can
          use the full height of a tablet held across */}
      <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'center', gap: wide ? 20 : 0 }}>
      {/* ── BOARD CONTAINER ────────────────────────────────────────*/}
      <div
        ref={containerRef}
        style={{
          flex:            1,
          minHeight:       0,
          alignSelf:       'stretch',
          display:         'flex',
          alignItems:      'center',
          justifyContent:  'center',
          width:           '100%',
        }}
      >
        {cellSize > 0 && (
          <div
            {...swipeHandlers}
            style={{
              position:    'relative',
              width:       vCols * cellSize,
              height:      vRows * cellSize,
              borderRadius: 8,
              overflow:    'hidden',
              boxShadow:   glow,
              touchAction: 'none',
              cursor:      'default',
              flexShrink:  0,
            }}
          >
           {/* The whole maze, slid so that Lumi stays in view */}
           <div style={{
             position:   'absolute',
             left:       0,
             top:        0,
             width:      boardW,
             height:     boardH,
             transform:  `translate(${-cam.x * cellSize}px, ${-cam.y * cellSize}px)`,
             transition: 'transform 0.3s ease-out',
           }}>
            {/* Tiles */}
            <Board
              maze={mazeRef.current}
              cellSize={cellSize}
              coll={st.coll}
              theme={theme}
              tint={cfg.tint}
              lights={lights}
            />

            {/* Fog of war + light sources */}
            {fogRadius && !preview && (
              <Lighting
                maze={mazeRef.current}
                cellSize={cellSize}
                pos={st.pos}
                seen={st.seen}
                lights={lights}
                coll={st.coll}
                radius={powerOn === 2 ? fogRadius * 1.8 : fogRadius}
                fogColor={FOG_COLOR[theme]}
                extra={chest && !chestOpen ? [chest] : []}
              />
            )}

            {/* Sparkle effects */}
            {sparkles.map(s => (
              <Sparkles key={s.id} x={s.x} y={s.y} cellSize={cellSize} />
            ))}

            {/* Sparkly footprints (the turquoise potion), above the fog */}
            {prints.map((p, i) => (
              <motion.div key={p.k} aria-hidden="true" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}
                className="mz-shimmer"
                style={{ position: 'absolute', left: (p.x + (i % 2 ? 0.52 : 0.28)) * cellSize, top: (p.y + (i % 2 ? 0.5 : 0.3)) * cellSize,
                  width: cellSize * 0.2, height: cellSize * 0.26, borderRadius: '50%', zIndex: 15, pointerEvents: 'none',
                  background: 'radial-gradient(circle, #ffffff 0%, #7ff6ea 45%, rgba(40,220,210,0.25) 100%)',
                  boxShadow: '0 0 8px 2px rgba(80,240,230,0.75)', animationDelay: `${-(i % 5) * 0.5}s` }} />
            ))}

            {/* The treasure chest in a far dead end */}
            {chest && (
              <div ref={chestRef} aria-label={chestOpen ? undefined : 'Schatztruhe'} role={chestOpen ? undefined : 'img'}
                style={{ position: 'absolute', left: chest.x * cellSize, top: chest.y * cellSize, width: cellSize, height: cellSize, zIndex: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <motion.div animate={chestOpen ? { y: 0 } : { y: [0, -2, 0], rotate: [0, -3, 3, 0] }} transition={chestOpen ? {} : { duration: 1.8, repeat: Infinity }}
                  style={{ filter: chestOpen ? undefined : 'drop-shadow(0 0 6px rgba(255,215,80,0.9))' }}>
                  <Chest size={cellSize * 0.86} open={!!chestOpen} />
                </motion.div>
                {/* the sticker inside jumps out */}
                <AnimatePresence>
                  {chestOpen > 0 && Date.now() - chestOpen < 2600 && (
                    <motion.div key="loot" initial={{ y: 0, scale: 0.2, opacity: 0 }}
                      animate={{ y: -cellSize * 1.3, scale: 1, opacity: 1, rotate: [0, -10, 10, -6, 0] }} exit={{ opacity: 0, scale: 0.4, y: -cellSize * 2 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 12 }}
                      onAnimationComplete={() => setTimeout(() => setChestOpen(t => t + 0.001), 2000)}
                      style={{ position: 'absolute', zIndex: 30 }}>
                      <Sticker art={loot} size={Math.max(44, cellSize * 1.2)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Friends in the dead ends: they hop and send hearts when Lumi comes by */}
            {friends.map(f => {
              const happy = met.includes(f.art)
              return (
                <motion.div key={f.art} aria-hidden="true"
                  animate={happy ? { y: [0, -cellSize * 0.4, 0, -cellSize * 0.25, 0] } : { y: [0, -2, 0] }}
                  transition={happy ? { duration: 0.9, repeat: 2 } : { duration: 2, repeat: Infinity }}
                  style={{ position: 'absolute', left: f.x * cellSize, top: f.y * cellSize, width: cellSize, height: cellSize, zIndex: 18,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <Art art={f.art} size={cellSize * 0.85} />
                  {happy && (
                    <motion.span initial={{ y: 0, opacity: 1 }} animate={{ y: -cellSize, opacity: 0 }} transition={{ duration: 1.4, repeat: 1 }}
                      style={{ position: 'absolute', top: -cellSize * 0.2 }}><Art art="❤️" size={cellSize * 0.45} /></motion.span>
                  )}
                </motion.div>
              )
            })}

            {/* The closed gate, when bumped: its lock shakes, and the
                potions still missing pop up above it */}
            <AnimatePresence>
              {gateNag > 0 && Date.now() - gateNag < 2000 && (
                <motion.div key={gateNag} aria-hidden="true"
                  initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                  onAnimationComplete={() => setTimeout(() => setGateNag(0), 1500)}
                  style={{ position: 'absolute', left: (mazeRef.current.exit.x + 0.5) * cellSize, top: mazeRef.current.exit.y * cellSize, zIndex: 40, pointerEvents: 'none' }}>
                  <motion.div animate={{ rotate: [0, -18, 18, -12, 12, 0] }} transition={{ duration: 0.6 }}
                    style={{ position: 'absolute', left: -cellSize * 0.4, top: cellSize * 0.1 }}>
                    <Art art="🔒" size={cellSize * 0.8} />
                  </motion.div>
                  <div style={{ position: 'absolute', bottom: cellSize * 0.3, left: 0, transform: 'translateX(-50%)', display: 'flex', gap: 2, width: 'max-content',
                    background: 'rgba(255,253,247,0.95)', border: '2px solid var(--px-ink)', borderRadius: 12, padding: '2px 6px' }}>
                    {mazeRef.current.potions.filter(p => !st.coll.includes(p.id)).map(p => (
                      <img key={p.id} src={spr('potion.png')} alt="" style={{ width: Math.max(30, cellSize * 0.7), height: Math.max(30, cellSize * 0.7), flexShrink: 0, imageRendering: 'pixelated', filter: potionFilter(p.type) || undefined }} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── LUMI (player) ───────────────────────────────── */}
            <motion.div
              animate={{ left: st.pos.x * cellSize, top: st.pos.y * cellSize }}
              transition={{ type: 'spring', stiffness: 600, damping: 35 }}
              style={{
                position:      'absolute',
                width:         cellSize,
                height:        cellSize,
                zIndex:        20,
                pointerEvents: 'none',
              }}
            >
              {/* Lumi leuchtet: a soft warm halo in the dark worlds */}
              {fogRadius && (
                <div className="mz-shimmer" style={{
                  position:     'absolute',
                  inset:        '-60%',
                  borderRadius: '50%',
                  background:   'radial-gradient(circle, rgba(255,230,120,0.38) 0%, transparent 62%)',
                  mixBlendMode: 'screen',
                }} />
              )}

              {/* the potion's power: a glow, and the potion with a pip per step left */}
              {powerOn !== null && (
                <div className="mz-shimmer" aria-hidden="true" style={{ position: 'absolute', inset: big ? '-110%' : '-70%', borderRadius: '50%',
                  background: `radial-gradient(circle, ${POWER_GLOW[powerOn]} 0%, transparent 62%)`, transition: 'inset .35s' }} />
              )}
              <AnimatePresence>
                {powerOn !== null && (
                  <motion.div key={`pw${power.until}`} aria-hidden="true" initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0, opacity: 0 }}
                    style={{ position: 'absolute', left: '50%', top: big ? -cellSize * 1.25 : -cellSize * 0.72, transform: 'translateX(-50%)', zIndex: 2,
                      display: 'flex', alignItems: 'center', gap: 1, padding: '1px 4px', borderRadius: 10, background: 'rgba(42,27,61,0.78)', transition: 'top .35s' }}>
                    <img src={spr('potion.png')} alt="" style={{ width: Math.max(14, cellSize * 0.38), height: Math.max(14, cellSize * 0.38), imageRendering: 'pixelated', filter: potionFilter(powerOn) || undefined }} />
                    {Array.from({ length: Math.max(0, power.until - st.moves) }, (_, i) => (
                      <span key={i} style={{ width: Math.max(3, cellSize * 0.09), height: Math.max(3, cellSize * 0.09), borderRadius: '50%', background: '#FFE08A' }} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Drop shadow */}
              <div style={{
                position:     'absolute',
                left:         '18%',
                right:        '18%',
                bottom:       '2%',
                height:       '12%',
                borderRadius: '50%',
                background:   'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 72%)',
              }} />

              {/* Sprite — bump-shake lives on this WRAPPER (framer-motion owns
                  its transform via the `x` motion value). The actual <img>
                  below is a plain element so our own CSS `transform`
                  (centering + left/right flip) is never overwritten by
                  framer-motion — motion.* components always recompute
                  `transform` from their own x/y/scale/rotate values, which
                  silently discards any hand-written transform string. */}
              {/* the pink potion: Lumi grows big */}
              <div style={{ position: 'absolute', inset: 0, transform: big ? 'scale(1.6)' : 'none', transformOrigin: '50% 95%', transition: 'transform .35s cubic-bezier(.3,1.7,.5,1)' }}>
              <motion.div
                key={`${st.bumpKey}-${hitFx}`}
                animate={hitFx && Date.now() - hitFx < 600 ? { rotate: [0, -30, 360], scale: [1, 0.7, 1] } : st.bumpKey > 0 ? { x: [0, -5, 5, -3, 0] } : { x: 0 }}
                transition={{ duration: hitFx && Date.now() - hitFx < 600 ? 0.6 : 0.22 }}
                style={{ position: 'absolute', inset: 0 }}
              >
                <div
                  className={isInvincible ? 'mz-blink mz-bob' : 'mz-bob'}
                  style={{
                    position:   'absolute',
                    bottom:     '2%',
                    left:       '50%',
                    width:      lumiSize,
                    height:     lumiSize,
                    // The mz-bob CSS animation owns `transform` while it
                    // runs and reads --facing for the flip (see maze.css).
                    // This inline transform is only the fallback for when
                    // the animation is off (prefers-reduced-motion).
                    '--facing': lumiFlip,
                    transform:  `translateX(-50%) scaleX(${lumiFlip})`,
                    filter:     'drop-shadow(0 2px 5px rgba(0,0,0,0.75))',
                  }}
                >
                  {st.moving ? (
                    <SpriteStrip sprite={LUMI_WALK} size={lumiSize} />
                  ) : (
                    <img
                      src={spr('lumi_idle.png')}
                      alt="Lumi"
                      draggable={false}
                      style={{ display: 'block', width: lumiSize, height: lumiSize, imageRendering: 'pixelated' }}
                    />
                  )}
                </div>
              </motion.div>
              </div>
            </motion.div>

            {/* ── DRAGON ───────────────────────────────────────── */}
            {hasDragon && st.dragon && !st.dead && (
              <motion.div
                animate={{ left: st.dragon.x * cellSize, top: st.dragon.y * cellSize }}
                transition={{ type: 'spring', stiffness: 180, damping: 22 }}
                style={{
                  position:      'absolute',
                  width:         cellSize,
                  height:        cellSize,
                  zIndex:        19,
                  pointerEvents: 'none',
                }}
              >
                {/* a tap: it giggles or blushes. Big Lumi: it cowers away,
                    small, sweating — and hops aside if Lumi walks into it */}
                <motion.div
                  key={`${scare}-${dragonTap?.k ?? 0}`}
                  role="button" aria-label="Drache" tabIndex={-1}
                  onPointerDown={tapDragon}
                  animate={scare && Date.now() - scare < 800 ? { y: [0, -cellSize * 0.8, 0], x: [0, cellSize * 0.3, 0], rotate: [0, 20, 0] }
                    : dragonTap?.kind === 'giggle' && Date.now() - dragonTap.k < 900 ? { rotate: [0, -14, 14, -10, 10, 0], y: [0, -6, 0, -4, 0] }
                    : dragonTap?.kind === 'blush' && Date.now() - dragonTap.k < 900 ? { scale: [1, 0.9, 1.05, 1] } : {}}
                  transition={{ duration: 0.7 }}
                  style={{ position: 'absolute', inset: -cellSize * 0.15, pointerEvents: 'auto', cursor: 'pointer' }}>
                <div style={{ position: 'absolute', inset: 0, transition: 'transform .3s',
                  transform: big ? `translateX(${Math.sign(st.dragon.x - st.pos.x || 1) * cellSize * 0.18}px) scale(0.72)` : 'none' }}>
                <div
                  className="mz-dragon"
                  style={{
                    position:       'absolute',
                    inset:          cellSize * 0.15,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    '--dragon-dir': big ? Math.sign(st.dragon.x - st.pos.x || 1) : dragonDir,
                    filter:         big ? 'drop-shadow(0 0 5px rgba(140,200,255,0.9))' : st.dangerLevel >= 1
                      ? 'drop-shadow(0 0 8px rgba(255,100,0,0.95)) drop-shadow(0 0 3px #fff)'
                      : 'drop-shadow(0 0 5px rgba(255,170,60,0.85))',
                  }}
                >
                  <SpriteStrip sprite={DRAGON_WALK} size={Math.round(cellSize * 1.1)} />
                </div>
                </div>
                {/* blushing cheeks and a heart, or giggle notes */}
                {dragonTap && Date.now() - dragonTap.k < 1400 && (
                  <motion.div aria-hidden="true" initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0] }} transition={{ duration: 1.4 }}
                    style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                    {dragonTap.kind === 'blush' ? (
                      <>
                        <span style={{ position: 'absolute', left: '34%', top: '52%', width: '22%', height: '12%', borderRadius: '50%', background: 'rgba(255,110,160,0.85)' }} />
                        <span style={{ position: 'absolute', left: '64%', top: '50%', width: '20%', height: '12%', borderRadius: '50%', background: 'rgba(255,110,160,0.85)' }} />
                        <motion.span initial={{ y: 0 }} animate={{ y: -cellSize * 0.9 }} transition={{ duration: 1.4 }}
                          style={{ position: 'absolute', left: '38%', top: '-10%' }}><Art art="❤️" size={cellSize * 0.45} /></motion.span>
                      </>
                    ) : (
                      [0, 1].map(i => (
                        <motion.span key={i} initial={{ y: 0, x: 0 }} animate={{ y: -cellSize * 0.9, x: (i ? 1 : -1) * cellSize * 0.4 }} transition={{ duration: 1.3, delay: i * 0.15 }}
                          style={{ position: 'absolute', left: '40%', top: '0%' }}><Art art="🎵" size={cellSize * 0.4} /></motion.span>
                      ))
                    )}
                  </motion.div>
                )}
                {big && (
                  <motion.span aria-hidden="true" animate={{ y: [0, 4, 0], opacity: [1, 0.5, 1] }} transition={{ duration: 0.8, repeat: Infinity }}
                    style={{ position: 'absolute', top: '8%', left: '70%', pointerEvents: 'none' }}><Art art="💧" size={cellSize * 0.32} /></motion.span>
                )}
                </motion.div>
                {st.dangerLevel >= 1 && !big && (
                  <motion.span aria-hidden="true" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.6, repeat: Infinity }}
                    style={{ position: 'absolute', top: -cellSize * 0.55, left: '50%', marginLeft: -cellSize * 0.22, fontFamily: 'var(--font-heading)', fontWeight: 900,
                      fontSize: cellSize * 0.6, lineHeight: 1, color: '#FFC93C', WebkitTextStroke: '2px #2a1b3d' }}>!</motion.span>
                )}
              </motion.div>
            )}
           </div>

            {/* A hit: a red flash and a crash star where Lumi was */}
            <AnimatePresence>
              {hitFx > 0 && Date.now() - hitFx < 900 && (
                <motion.div key={hitFx} aria-hidden="true" initial={{ opacity: 0.75 }} animate={{ opacity: 0 }} transition={{ duration: 0.9 }}
                  onAnimationComplete={() => setHitFx(0)}
                  style={{ position: 'absolute', inset: 0, zIndex: 45, pointerEvents: 'none', background: 'rgba(230,40,40,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div initial={{ scale: 0.3, rotate: -20 }} animate={{ scale: 1.4, rotate: 10 }} transition={{ duration: 0.5 }}>
                    <Art art="💥" size={Math.min(140, cellSize * 3)} />
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* The goal, for a moment at the start: potions → gate (mind the dragon) */}
            <AnimatePresence>
              {intro && !showOverlay && (
                <motion.div key="intro" aria-label="Sammle die Tränke, dann zum Tor"
                  initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }}
                  style={{ position: 'absolute', inset: 0, zIndex: 46, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 22,
                    background: 'rgba(255,253,247,0.96)', border: '4px solid var(--px-ink)', boxShadow: '0 6px 0 rgba(0,0,0,0.35)' }}>
                    {mazeRef.current.potions.map((p, i) => (
                      <motion.img key={p.id} src={spr('potion.png')} alt="" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 + i * 0.2 }}
                        style={{ width: 46, height: 46, imageRendering: 'pixelated', filter: potionFilter(p.type) || undefined }} />
                    ))}
                    <span style={{ fontSize: 34, fontWeight: 900, color: 'var(--px-ink)' }}>→</span>
                    <img src={spr('maze_portal.png')} alt="" style={{ width: 50, height: 50, imageRendering: 'pixelated' }} />
                    {hasDragon && <><Art art="⚠️" size={34} /><Art art="🐉" size={44} /></>}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Danger vignette */}
            {st.dangerLevel > 0 && !big && (
              <div style={{
                position:      'absolute',
                inset:         0,
                pointerEvents: 'none',
                zIndex:        11,
                background:    `radial-gradient(ellipse at center, transparent 35%, rgba(220,38,38,${st.dangerLevel * 0.38}) 100%)`,
                animation:     st.dangerLevel >= 1 ? 'mz-danger-pulse 0.7s ease-in-out infinite' : undefined,
              }} />
            )}

            {/* ── WIN / DEAD overlay ───────────────────────────── */}
            <AnimatePresence>
              {showOverlay && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.82 }}
                  animate={{ opacity: 1, scale: 1 }}
                  style={{
                    position:       'absolute',
                    inset:          0,
                    zIndex:         50,
                    display:        'flex',
                    flexDirection:  'column',
                    alignItems:     'center',
                    justifyContent: 'center',
                    background:     showOverlay === 'won'
                      ? 'radial-gradient(ellipse, rgba(107,203,119,0.95) 0%, rgba(16,80,24,0.98) 100%)'
                      : 'radial-gradient(ellipse, rgba(180,0,0,0.92) 0%, rgba(40,0,0,0.97) 100%)',
                    textAlign:      'center',
                    gap:            12,
                    borderRadius:   8,
                  }}
                >
                  {showOverlay === 'won' ? (
                    <div style={{ position: 'relative', width: 'min(128px, 24vh)', aspectRatio: '1' }}>
                      <img
                        src={spr('lumi_happy.png')}
                        alt=""
                        className="mz-coin"
                        style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
                      />
                      {/* The crown for a short way drops onto Lumi's head */}
                      {bonus && (
                        <motion.div
                          initial={{ y: -70, opacity: 0, rotate: -25 }}
                          animate={{ y: 0, opacity: 1, rotate: -8 }}
                          transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 11 }}
                          style={{
                            position: 'absolute', top: '-19%', left: '50%', marginLeft: '-19%',
                            width: '38%', fontSize: 'min(48px, 9vh)', lineHeight: 1, textAlign: 'center',
                            filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.9))',
                          }}
                        >
                          👑
                        </motion.div>
                      )}
                      {/* No hit and a short way: stars twinkle all round */}
                      {bonus === 'perfect' && TWINKLE_ANGLES.map((deg, i) => (
                        <motion.span
                          key={deg}
                          aria-hidden
                          animate={{ scale: [0.4, 1.2, 0.4], opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.1, delay: 0.8 + i * 0.18, repeat: Infinity }}
                          style={{
                            position: 'absolute', lineHeight: 1, fontSize: 'min(26px, 5vh)',
                            left: `${50 + Math.cos(deg * Math.PI / 180) * 64}%`,
                            top:  `${50 + Math.sin(deg * Math.PI / 180) * 56}%`,
                            marginLeft: -13, marginTop: -13,
                          }}
                        >
                          ✨
                        </motion.span>
                      ))}
                    </div>
                  ) : (
                    <Art art="💔" size={72} />
                  )}
                  {/* the chest's sticker, and the dragon waving goodbye */}
                  {showOverlay === 'won' && chestOpen > 0 && (
                    <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: -8 }} transition={{ delay: 0.7, type: 'spring', stiffness: 260, damping: 12 }}
                      style={{ position: 'absolute', left: '8%', top: '10%' }}>
                      <Sticker art={loot} size={64} />
                    </motion.div>
                  )}
                  {showOverlay === 'won' && hasDragon && (
                    <motion.div aria-label="Der Drache winkt" role="img" initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                      style={{ position: 'absolute', right: '6%', bottom: '6%', display: 'flex', alignItems: 'flex-end' }}>
                      <SpriteStrip sprite={DRAGON_WALK} size={64} style={{ transform: 'scaleX(-1)' }} />
                      <motion.span animate={{ rotate: [0, 24, -10, 24, 0] }} transition={{ duration: 1, repeat: Infinity }}
                        style={{ display: 'inline-block', transformOrigin: '70% 90%', marginLeft: -10, marginBottom: 30 }}><Art art="👋" size={34} /></motion.span>
                    </motion.div>
                  )}
                  <div style={{
                    fontFamily: 'Fredoka, var(--font-heading), sans-serif',
                    fontSize:   26,
                    fontWeight: 700,
                    color:      'white',
                  }}>
                    {showOverlay === 'won'
                      ? (bonus === 'perfect' ? 'Labyrinth-Profi!' : 'Labyrinth gemeistert!')
                      : 'Der Drache war zu schnell!'}
                  </div>
                  {showOverlay === 'won' && bonus && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.9, type: 'spring', stiffness: 300 }}
                      style={{
                        background:   'var(--px-gold)',
                        color:        'var(--px-ink)',
                        border:       '3px solid var(--px-ink)',
                        borderRadius: 10,
                        boxShadow:    '0 4px 0 var(--px-ink)',
                        padding:      '4px 16px',
                        fontFamily:   'Fredoka, var(--font-heading), sans-serif',
                        fontSize:     17,
                        fontWeight:   700,
                      }}
                    >
                      {bonus === 'perfect' ? 'Kurzer Weg, kein Treffer!' : 'Ganz kurzer Weg!'}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── D-PAD ─────────────────────────────────────────────────
          The hint hand taps the arrow that leads towards the next potion
          (or, with all of them, the gate) when a child waits */}
      <HintHand to={dpadRefs[nextDir]} delay={st.moves === 0 ? 2000 : 6000} active={!!nextDir && !preview && !intro && !st.won && !st.dead} />
      <div style={{ flexShrink: 0, marginTop: wide ? 0 : 8, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6 }}>
          <span ref={dpadRefs.up}><DPadButton dir="up" label="Nach oben" size={padSize} onPress={() => doMove(0, -1)} /></span>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <span ref={dpadRefs.left}><DPadButton dir="left" label="Nach links" size={padSize} onPress={() => doMove(-1, 0)} /></span>
          <span ref={dpadRefs.down}><DPadButton dir="down" label="Nach unten" size={padSize} onPress={() => doMove(0, 1)} /></span>
          <span ref={dpadRefs.right}><DPadButton dir="right" label="Nach rechts" size={padSize} onPress={() => doMove(1, 0)} /></span>
        </div>
      </div>
      </div>
    </div>
  )
}
