import { useReducer, useEffect, useRef, useState, useCallback, useMemo, useId, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { genMaze, shortestTour } from './maze/mazeGen.js'
import { mazeReducer, initState } from './maze/mazeReducer.js'
import { useBoardSize } from './maze/useBoardSize.js'
import { useSwipe } from './maze/useSwipe.js'
import { speak, cancelSpeech, sayNumber } from '../tts.js'
import { sfx } from '../sfx.js'
import './maze/maze.css'
import { afterNarration } from '../narrator.js'
import { usePaused } from '../lib/pause.js'
import { PxIcon } from '../components/PixelUI.jsx'

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

function Lighting({ maze, cellSize, pos, seen, lights, coll, radius, fogColor }) {
  const id = useId().replace(/:/g, '')
  const { cols, rows, exit, potions } = maze
  const W = cols * cellSize
  const H = rows * cellSize
  const c = v => (v + 0.5) * cellSize

  const spots = [
    ...lights.map(l => ({ key: `l-${l.x},${l.y}`, x: c(l.x), y: c(l.y) + cellSize * 0.45, r: LIGHT_LOOK[l.kind].r })),
    { x: c(exit.x), y: c(exit.y), r: 1.5, key: 'exit' },
    ...potions.filter(p => !coll.includes(p.id)).map(p => ({ x: c(p.x), y: c(p.y), r: 1.0, key: 'p' + p.id })),
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
              style={{ transform: `translate(${c(pos.x)}px, ${c(pos.y)}px)`, transition: 'transform 0.22s ease-out' }}
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

// ──────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────
export default function MazeGame({ level = 1, onComplete }) {
  const cfg      = LEVEL_CONFIG(level)
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
  const [showOverlay, setShowOverlay] = useState(null) // 'won' | 'dead'
  // The fewest steps for this maze, and the bonus earned at the win:
  // null, 'short' (crown) or 'perfect' (short way and the dragon never hit)
  const shortest = useMemo(() => shortestTour(mazeRef.current), [])
  const [bonus, setBonus] = useState(null)

  // Every time the dragon caught Lumi, over all tries: the stars go by it
  // (none → 3, one → 2, more → 1). A win used to give three stars however
  // many hearts were lost on the way.
  const hitsRef      = useRef(0)
  const lastWarnRef  = useRef(0)
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
        // "Zaubertrank 1 von 3!" was read with digits
        const count  = st.coll.length
        const left   = mazeRef.current.potions.length - count
        const word   = sayNumber(count)
        const got    = count === 1 ? 'Ein Zaubertrank!' : `${word[0].toUpperCase()}${word.slice(1)} Zaubertränke!`
        speak(left === 0
          ? `${got} Jetzt schnell zum Tor!`
          : `${got} Noch ${left === 1 ? 'einer' : sayNumber(left)}.`, { lang: 'de-DE' })
        const sid = Date.now()
        setSparkles(prev => [...prev, { id: sid, x: ev.x, y: ev.y }])
        setTimeout(() => setSparkles(prev => prev.filter(s => s.id !== sid)), 700)
        break
      }

      case 'needPotions': {
        const n = ev.missing
        speak(`Du brauchst noch ${n === 1 ? 'einen Zaubertrank' : `${sayNumber(n)} Zaubertränke`}, dann öffnet sich das Tor!`, { lang: 'de-DE' })
        break
      }

      case 'hit':
        hitsRef.current++
        try { sfx.hitPlayer() } catch { /* ignore */ }
        speak('Autsch, der Drache hat dich erwischt! Ein paar Schritte zurück.', { lang: 'de-DE' })
        navigator.vibrate?.([60, 40, 60])
        break

      // The last heart is gone: the same maze once more from the start,
      // instead of ending the game with no stars.
      case 'dead':
        hitsRef.current++
        try { sfx.wrong() } catch { /* ignore */ }
        speak('Oh nein! Der Drache war zu schnell. Wir versuchen es noch einmal!', { lang: 'de-DE' })
        navigator.vibrate?.([80, 40, 80, 40, 80])
        setShowOverlay('dead')
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
        speak('Super! Du hast das Labyrinth gemeistert!'
          + (short ? ' Du hast einen ganz kurzen Weg gefunden!' : '')
          + (perfect ? ' Und der Drache hat dich kein einziges Mal erwischt. Du bist ein echter Labyrinth-Profi!' : ''),
          { lang: 'de-DE' })
        navigator.vibrate?.([50, 30, 50, 30, 100])
        setBonus(perfect ? 'perfect' : short ? 'short' : null)
        setShowOverlay('won')
        finish(Math.max(0, 3 - hitsRef.current), 3, short ? 3200 : 2200)
        break
      }

      default:
        break
    }

    dispatch({ type: 'CLEAR_EVENT' })
  }, [st.event, st.coll.length, finish]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── DANGER WARNING SOUND ─────────────────────────────────────────
  // The warning used to be shown only as text. Said once (and again only
  // after a while), with the rule that keeps Lumi safe.
  useEffect(() => {
    if (st.dangerLevel >= 1 && prevDangerRef.current < 1) {
      try { sfx.dragonNear() } catch { /* ignore */ }
      if (Date.now() - lastWarnRef.current > 25000) {
        lastWarnRef.current = Date.now()
        speak('Psst, der Drache ist ganz nah! Wenn du stehen bleibst, kann er dir nichts tun.', { lang: 'de-DE' })
      }
    }
    prevDangerRef.current = st.dangerLevel
  }, [st.dangerLevel])

  // ── INTRO SPEECH ─────────────────────────────────────────────────
  useEffect(() => {
    const n = mazeRef.current.potions.length
    const dragonWarning = cfg.hasDragon ? ' — pass auf den Drachen auf!' : '!'
    const msg = n > 0
      // Plural von Trank ist Tränke, und für einen einzelnen heißt es
      // "einen", nicht "eins": vorher "Sammle 3 Zaubertranke".
      ? `Sammle ${n === 1 ? 'einen Zaubertrank' : `${sayNumber(n)} Zaubertränke`} und finde den Ausgang${dragonWarning}`
      : `Finde den Ausgang des Labyrinths${dragonWarning}`
    const look = cfg.fogRadius ? ' Schau gut hin und merk dir den Weg!' : ''
    const tid = setTimeout(() => speak(msg + look, { lang: 'de-DE' }), 700)
    return () => clearTimeout(tid)
  }, [cfg.hasDragon, cfg.fogRadius])

  // ── CLEANUP ───────────────────────────────────────────────────────
  useEffect(() => () => {
    cancelSpeech()
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

      {/* ── HUD ─────────────────────────────────────────────────── */}
      <div style={{
        display:         'flex',
        alignItems:      'center',
        justifyContent:  'space-between',
        width:           '100%',
        maxWidth:        480,
        padding:         '8px 4px',
        flexShrink:      0,
        gap:             8,
      }}>
        {/* Lives */}
        <div style={{ display: 'flex', gap: 3, fontSize: 20 }}>
          {[0, 1, 2].map(i => (
            <motion.span
              key={i}
              animate={{ scale: i < st.lives ? 1 : 0.45, opacity: i < st.lives ? 1 : 0.22 }}
              transition={{ type: 'spring', stiffness: 400 }}
            >
              ❤️
            </motion.span>
          ))}
        </div>

        {/* Potion trackers */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {mazeRef.current.potions.map(p => {
            const done = st.coll.includes(p.id)
            return (
              <motion.div
                key={p.id}
                animate={{ scale: done ? 1.12 : 0.72, opacity: done ? 1 : 0.38 }}
                transition={{ type: 'spring', stiffness: 350 }}
              >
                <img
                  src={spr('potion.png')}
                  alt=""
                  style={{ width: 22, height: 22, imageRendering: 'pixelated', display: 'block', filter: potionFilter(p.type) || undefined }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              </motion.div>
            )
          })}
        </div>

        {/* Moves counter */}
        <div style={{
          color:       'rgba(255,255,255,0.85)',
          fontSize:    15,
          fontFamily:  'Fredoka, var(--font-heading), sans-serif',
          whiteSpace:  'nowrap',
        }}>
          👣 {st.moves}
        </div>
      </div>

      {/* ── Danger banner ───────────────────────────────────────────
          Fixed-height slot, always present in the flex layout (even
          when empty) — the board container below is watched by a
          ResizeObserver (useBoardSize), so if this banner mounting/
          unmounting changed the available height, the whole maze would
          visibly resize for as long as the banner was shown. Reserving
          the space up front means showing/hiding the banner only
          fades its content, never touches the board's size. */}
      <div style={{
        height:      34,
        flexShrink:  0,
        display:     'flex',
        alignItems:  'center',
        justifyContent: 'center',
        width:       '100%',
      }}>
        <AnimatePresence>
          {preview && (
            <motion.div
              key="preview"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                background:  'rgba(42,27,61,0.8)',
                color:       'white',
                padding:     '4px 18px',
                borderRadius: 20,
                fontFamily:  'Fredoka, var(--font-heading), sans-serif',
                fontSize:    15,
                fontWeight:  600,
              }}
            >
              👀 Merk dir den Weg!
            </motion.div>
          )}
          {!preview && st.dangerLevel > 0 && !st.won && !st.dead && (
            <motion.div
              key="danger"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              style={{
                background:  st.dangerLevel >= 1 ? 'rgba(220,38,38,0.88)' : 'rgba(160,55,0,0.75)',
                color:       'white',
                padding:     '4px 18px',
                borderRadius: 20,
                fontFamily:  'Fredoka, var(--font-heading), sans-serif',
                fontSize:    14,
                fontWeight:  600,
              }}
            >
              {st.dangerLevel >= 1 ? '⚠️ Der Drache ist ganz nah!' : '😰 Ich höre den Drachen…'}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── BOARD CONTAINER ────────────────────────────────────────*/}
      <div
        ref={containerRef}
        style={{
          flex:            1,
          minHeight:       0,
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
                radius={fogRadius}
                fogColor={FOG_COLOR[theme]}
              />
            )}

            {/* Sparkle effects */}
            {sparkles.map(s => (
              <Sparkles key={s.id} x={s.x} y={s.y} cellSize={cellSize} />
            ))}

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
              <motion.div
                key={st.bumpKey}
                animate={st.bumpKey > 0 ? { x: [0, -5, 5, -3, 0] } : { x: 0 }}
                transition={{ duration: 0.22 }}
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
                <div
                  className="mz-dragon"
                  style={{
                    position:       'absolute',
                    inset:          0,
                    display:        'flex',
                    alignItems:     'center',
                    justifyContent: 'center',
                    '--dragon-dir': dragonDir,
                    filter:         st.dangerLevel >= 1
                      ? 'drop-shadow(0 0 8px rgba(255,100,0,0.9))'
                      : 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                  }}
                >
                  <SpriteStrip sprite={DRAGON_WALK} size={Math.round(cellSize * 1.1)} />
                </div>
              </motion.div>
            )}
           </div>

            {/* Danger vignette */}
            {st.dangerLevel > 0 && (
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
                    <div style={{ fontSize: 56 }}>💀</div>
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
                  <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 15 }}>
                    {showOverlay === 'won'
                      ? `👣 ${st.moves} Schritte`
                      : 'Versuche es nochmal…'}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* ── D-PAD ───────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, marginTop: 8, userSelect: 'none', WebkitUserSelect: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <DPadButton dir="up" label="Nach oben" onPress={() => doMove(0, -1)} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <DPadButton dir="left" label="Nach links" onPress={() => doMove(-1, 0)} />
          <DPadButton dir="down" label="Nach unten" onPress={() => doMove(0, 1)} />
          <DPadButton dir="right" label="Nach rechts" onPress={() => doMove(1, 0)} />
        </div>
      </div>
    </div>
  )
}
