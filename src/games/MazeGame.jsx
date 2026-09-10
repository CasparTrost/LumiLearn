import { useReducer, useEffect, useRef, useState, useCallback, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { genMaze } from './maze/mazeGen.js'
import { mazeReducer, initState } from './maze/mazeReducer.js'
import { useBoardSize } from './maze/useBoardSize.js'
import { useSwipe } from './maze/useSwipe.js'
import { speak, cancelSpeech } from '../tts.js'
import { sfx } from '../sfx.js'
import './maze/maze.css'

// ──────────────────────────────────────────────────────────────────
// ASSET HELPER
// ──────────────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL ?? '/'
const spr = f => BASE.replace(/\/$/, '') + '/sprites/maze/' + f

// ──────────────────────────────────────────────────────────────────
// LEVEL CONFIG
// ──────────────────────────────────────────────────────────────────
const LEVEL_CONFIG = level => {
  const hasDragon   = level >= 2
  const cols        = level <= 2 ? 11 : level <= 4 ? 13 : level <= 7 ? 15 : 19
  const rows        = cols
  const fogRadius   = level <= 3 ? null : level <= 6 ? 4.5 : 3.5
  const theme       = level <= 3 ? 'forest' : 'dungeon'
  // Note: the dragon no longer moves on its own real-time clock — it takes
  // exactly one patrol step per player move (see mazeReducer.js). This
  // makes the patrol provably avoidable regardless of device speed or
  // reaction time, since the player has unlimited time to plan each move.
  return { hasDragon, cols, rows, fogRadius, theme }
}

// ──────────────────────────────────────────────────────────────────
// WALL TILE LOGIC
// Selects from the mw_*.png set (dungeon) or forest_wall_*.png (forest)
// based on which neighbours are walls.
// ──────────────────────────────────────────────────────────────────
function wallSprite(x, y, g, theme) {
  const hasU = g[y - 1]?.[x] === 1
  const hasD = g[y + 1]?.[x] === 1
  const hasL = g[y]?.[x - 1] === 1
  const hasR = g[y]?.[x + 1] === 1

  if (theme === 'forest') {
    // Forest theme uses forest_wall_*.png sprites
    if (!hasU && !hasL &&  hasD &&  hasR) return 'forest_corner_tl.png'
    if (!hasU && !hasR &&  hasD &&  hasL) return 'forest_corner_tr.png'
    if (!hasD && !hasL &&  hasU &&  hasR) return 'forest_corner_bl.png'
    if (!hasD && !hasR &&  hasU &&  hasL) return 'forest_corner_br.png'
    if ( hasU &&  hasD && !hasL && !hasR) return 'forest_wall_vert.png'
    if (!hasU &&  hasD &&  hasL &&  hasR) return 'forest_wall_top.png'
    if ( hasU && !hasD &&  hasL &&  hasR) return 'forest_wall_solid.png'
    if ( hasU &&  hasD &&  hasL &&  hasR) return 'forest_wall_inner.png'
    return 'forest_wall_solid.png'
  }

  // Dungeon theme uses mw_*.png sprites
  if (!hasU && !hasL &&  hasD &&  hasR) return 'mw_tl.png'
  if (!hasU && !hasR &&  hasD &&  hasL) return 'mw_tr.png'
  if (!hasD && !hasL &&  hasU &&  hasR) return 'mw_bl.png'
  if (!hasD && !hasR &&  hasU &&  hasL) return 'mw_br.png'
  if ( hasU &&  hasD &&  hasL &&  hasR) return 'mw_solid.png'
  if (!hasD) return 'mw_top.png'
  if (!hasU) return 'mw_bot.png'
  if (!hasL) return 'mw_left.png'
  if (!hasR) return 'mw_right.png'
  return 'mw_solid.png'
}

function floorSprite(x, y, theme) {
  if (theme === 'forest') {
    // Vary forest floor tiles slightly
    const n = (x * 7 + y * 13) % 5
    if (n === 0) return 'forest_floor_flowers.png'
    if (n === 1) return 'forest_floor_path.png'
    return 'forest_floor_grass.png'
  }
  return 'mw_floor.png'
}

// ──────────────────────────────────────────────────────────────────
// POTION CONFIG
// ──────────────────────────────────────────────────────────────────
const POTION_SPRITES = ['maze_potion1.png', 'maze_potion2.png', 'maze_potion3.png']

// ──────────────────────────────────────────────────────────────────
// MEMOISED BOARD — only re-renders when collected potions change
// ──────────────────────────────────────────────────────────────────
const Board = memo(function Board({ maze, cellSize, coll, theme }) {
  const { g, rows, cols, potions, exit } = maze

  return (
    <div style={{
      position:        'relative',
      width:           cols * cellSize,
      height:          rows * cellSize,
      imageRendering:  'pixelated',
    }}>
      {g.map((row, y) =>
        row.map((cell, x) => {
          const isWall   = cell === 1
          const isExit   = x === exit.x && y === exit.y
          const potion   = potions.find(p => p.x === x && p.y === y)
          const potionOk = potion && !coll.includes(potion.id)

          // Torch: wall that has floor directly below, sprinkled randomly
          const hasTorch = isWall && g[y + 1]?.[x] === 0 && ((x * 3 + y * 7) % 8 === 0)

          const sprite = isWall ? wallSprite(x, y, g, theme) : floorSprite(x, y, theme)

          return (
            <div
              key={`${x},${y}`}
              style={{
                position: 'absolute',
                left:     x * cellSize,
                top:      y * cellSize,
                width:    cellSize,
                height:   cellSize,
                overflow: 'hidden',
              }}
            >
              {/* Base tile */}
              <img
                src={spr(sprite)}
                alt=""
                draggable={false}
                style={{
                  position:        'absolute',
                  inset:           0,
                  width:           '100%',
                  height:          '100%',
                  imageRendering:  'pixelated',
                  display:         'block',
                  objectFit:       'cover',
                  filter:          isWall ? 'brightness(0.78)' : 'brightness(0.72) saturate(0.9)',
                }}
                onError={e => {
                  e.target.style.display = 'none'
                  e.target.parentNode.style.background = isWall
                    ? (theme === 'forest' ? '#1a4d0e' : '#1a0a2e')
                    : (theme === 'forest' ? '#2d6b1a' : '#120828')
                }}
              />

              {/* Torch (gif sprite) */}
              {hasTorch && (
                <img
                  src={spr('maze_torch.gif')}
                  alt=""
                  draggable={false}
                  style={{
                    position:       'absolute',
                    bottom:         2,
                    left:           '50%',
                    transform:      'translateX(-50%)',
                    width:          Math.round(cellSize * 0.72),
                    height:         Math.round(cellSize * 0.72),
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
                }}>
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
                    src={spr(POTION_SPRITES[potion.type])}
                    alt="Trank"
                    className="mz-coin"
                    draggable={false}
                    style={{
                      width:          Math.round(cellSize * 0.6),
                      height:         Math.round(cellSize * 0.6),
                      imageRendering: 'pixelated',
                      filter:         'drop-shadow(0 0 5px #c084fc)',
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
function DPadButton({ label, onPress, size = 52, ariaLabel, style: styleOverride }) {
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
      aria-label={ariaLabel ?? label}
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
      {label}
    </motion.button>
  )
}

// ──────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ──────────────────────────────────────────────────────────────────
export default function MazeGame({ level = 1, onComplete }) {
  const cfg      = LEVEL_CONFIG(level)
  const mazeRef  = useRef(null)
  if (!mazeRef.current) mazeRef.current = genMaze(cfg.cols, cfg.rows)

  const [st, dispatch] = useReducer(mazeReducer, null, () => initState(mazeRef.current, cfg.hasDragon))

  const { containerRef, cellSize } = useBoardSize(cfg.cols, cfg.rows, 52)

  const doneRef         = useRef(false)
  const onCompleteRef   = useRef(onComplete)
  onCompleteRef.current = onComplete

  const prevDangerRef = useRef(0)

  const [sparkles, setSparkles]     = useState([]) // [{ id, x, y }]
  const [showOverlay, setShowOverlay] = useState(null) // 'won' | 'dead'

  // Moving timer — clear the "moving" flag after animation settles
  const moveTimerRef = useRef(null)

  // ── FINISH ──────────────────────────────────────────────────────
  const finish = useCallback((score, total, delay = 1800) => {
    if (doneRef.current) return
    doneRef.current = true
    setTimeout(() => onCompleteRef.current({ score, total }), delay)
  }, [])

  // ── MOVE HELPER ─────────────────────────────────────────────────
  const doMove = useCallback((dx, dy) => {
    dispatch({ type: 'MOVE', dx, dy, now: Date.now() })
    // Clear moving flag after spring animation
    clearTimeout(moveTimerRef.current)
    moveTimerRef.current = setTimeout(
      () => dispatch({ type: 'SET_MOVING', value: false }),
      320
    )
  }, [])

  // Pass a turn without moving — always 100% safe (see mazeReducer.js).
  // This is how the player waits for the dragon to clear the way.
  const doWait = useCallback(() => {
    dispatch({ type: 'WAIT', now: Date.now() })
  }, [])

  // ── KEYBOARD ────────────────────────────────────────────────────
  useEffect(() => {
    const DIRS = {
      ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0],
      w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0],
    }
    const handler = e => {
      if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault()
        doWait()
        return
      }
      const dir = DIRS[e.key]
      if (!dir) return
      e.preventDefault()
      doMove(dir[0], dir[1])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [doMove, doWait])

  // Note: there is no independent dragon-movement timer anymore. The
  // dragon takes exactly one patrol step per player MOVE, applied
  // atomically inside mazeReducer.js — see the comment there for why
  // this makes the patrol provably avoidable.

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
        const count  = st.coll.length
        const total  = mazeRef.current.potions.length
        speak(`Zaubertrank ${count} von ${total}!`)
        const sid = Date.now()
        setSparkles(prev => [...prev, { id: sid, x: ev.x, y: ev.y }])
        setTimeout(() => setSparkles(prev => prev.filter(s => s.id !== sid)), 700)
        break
      }

      case 'hit':
        try { sfx.hitPlayer() } catch { /* ignore */ }
        speak('Vorsicht! Der Drache hat dich erwischt!')
        navigator.vibrate?.([60, 40, 60])
        break

      case 'dead':
        try { sfx.wrong() } catch { /* ignore */ }
        speak('Oh nein! Der Drache war zu schnell. Versuch es nochmal!')
        navigator.vibrate?.([80, 40, 80, 40, 80])
        setShowOverlay('dead')
        finish(0, Math.max(1, mazeRef.current.potions.length), 2200)
        break

      case 'won':
        try { sfx.complete() } catch { /* ignore */ }
        speak('Super! Du hast das Labyrinth gemeistert!')
        navigator.vibrate?.([50, 30, 50, 30, 100])
        setShowOverlay('won')
        finish(mazeRef.current.potions.length, mazeRef.current.potions.length, 2200)
        break

      default:
        break
    }

    dispatch({ type: 'CLEAR_EVENT' })
  }, [st.event, st.coll.length, finish]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── DANGER WARNING SOUND ─────────────────────────────────────────
  useEffect(() => {
    if (st.dangerLevel >= 1 && prevDangerRef.current < 1) {
      try { sfx.dragonNear() } catch { /* ignore */ }
    }
    prevDangerRef.current = st.dangerLevel
  }, [st.dangerLevel])

  // ── INTRO SPEECH ─────────────────────────────────────────────────
  useEffect(() => {
    const n = mazeRef.current.potions.length
    const dragonWarning = cfg.hasDragon
      ? ' — pass auf den Drachen auf! Drück die Warten-Taste, wenn er im Weg steht.'
      : '!'
    const msg = n > 0
      ? `Sammle ${n} Zaubertrank${n > 1 ? 'e' : ''} und finde den Ausgang${dragonWarning}`
      : `Finde den Ausgang des Labyrinths${dragonWarning}`
    const tid = setTimeout(() => speak(msg), 700)
    return () => clearTimeout(tid)
  }, [cfg.hasDragon])

  // ── CLEANUP ───────────────────────────────────────────────────────
  useEffect(() => () => {
    cancelSpeech()
    clearTimeout(moveTimerRef.current)
  }, [])

  // ── SWIPE ────────────────────────────────────────────────────────
  const swipeHandlers = useSwipe(
    (dx, dy) => doMove(dx, dy),
    { threshold: 18 }
  )

  // ──────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────
  const { cols, rows, theme, fogRadius, hasDragon } = cfg
  const boardW = cols * cellSize
  const boardH = rows * cellSize

  const isForest  = theme === 'forest'
  const bgGrad    = isForest
    ? 'radial-gradient(ellipse at 50% 30%, #1f6b2e 0%, #0b3d17 100%)'
    : 'radial-gradient(ellipse at 50% 30%, #1e0a3c 0%, #080412 100%)'
  const glow      = isForest
    ? '0 0 30px rgba(0,140,0,0.5), 0 12px 50px rgba(0,0,0,0.7)'
    : '0 0 40px rgba(74,0,224,0.45), 0 0 80px rgba(74,0,224,0.18), 0 12px 50px rgba(0,0,0,0.7)'

  // Fog-of-war radial mask
  const fogMaskImage = fogRadius && cellSize > 0
    ? `radial-gradient(circle at ${(st.pos.x + 0.5) * cellSize}px ${(st.pos.y + 0.5) * cellSize}px, transparent 0, transparent ${fogRadius * cellSize}px, rgba(0,0,0,0.95) ${fogRadius * cellSize * 1.55}px)`
    : null

  // Invincibility: blinking
  const isInvincible = st.invUntil > Date.now()

  // Dragon facing direction
  const dragonDir = st.dragon && st.pos
    ? (st.dragon.x > st.pos.x ? -1 : 1)
    : -1

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
                  src={spr(POTION_SPRITES[p.type])}
                  alt=""
                  style={{ width: 20, height: 20, imageRendering: 'pixelated', display: 'block' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              </motion.div>
            )
          })}
        </div>

        {/* Moves counter */}
        <div style={{
          color:       'rgba(255,255,255,0.6)',
          fontSize:    13,
          fontFamily:  'Fredoka, var(--font-heading), sans-serif',
          whiteSpace:  'nowrap',
        }}>
          👣 {st.moves}
        </div>
      </div>

      {/* ── Danger banner ───────────────────────────────────────── */}
      <AnimatePresence>
        {st.dangerLevel > 0 && !st.won && !st.dead && (
          <motion.div
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
              marginBottom: 3,
              flexShrink:  0,
            }}
          >
            {st.dangerLevel >= 1 ? '⚠️ Der Drache ist ganz nah!' : '😰 Ich höre den Drachen…'}
          </motion.div>
        )}
      </AnimatePresence>

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
              width:       boardW,
              height:      boardH,
              borderRadius: 8,
              overflow:    'hidden',
              boxShadow:   glow,
              touchAction: 'none',
              cursor:      'pointer',
              flexShrink:  0,
            }}
          >
            {/* Tiles */}
            <Board
              maze={mazeRef.current}
              cellSize={cellSize}
              coll={st.coll}
              theme={theme}
            />

            {/* Fog of war */}
            {fogMaskImage && (
              <div style={{
                position:         'absolute',
                inset:            0,
                pointerEvents:    'none',
                zIndex:           10,
                maskImage:        fogMaskImage,
                WebkitMaskImage:  fogMaskImage,
                background:       isForest ? '#071f0e' : '#050208',
              }} />
            )}

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

            {/* Sparkle effects */}
            {sparkles.map(s => (
              <Sparkles key={s.id} x={s.x} y={s.y} cellSize={cellSize} />
            ))}

            {/* ── KNIGHT (player) ──────────────────────────────── */}
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
                <img
                  src={spr(st.moving ? 'maze_knight_walk.gif' : 'maze_knight_idle.gif')}
                  alt="Spieler"
                  className={isInvincible ? 'mz-blink mz-bob' : 'mz-bob'}
                  draggable={false}
                  style={{
                    position:       'absolute',
                    bottom:         '2%',
                    left:           '50%',
                    width:          Math.round(cellSize * 1.05),
                    height:         Math.round(cellSize * 1.05),
                    transform:      `translateX(-50%) scaleX(${st.facing})`,
                    imageRendering: 'pixelated',
                    filter:         'drop-shadow(0 2px 5px rgba(0,0,0,0.75))',
                  }}
                  onError={e => {
                    e.target.style.display = 'none'
                    const fb = document.createElement('span')
                    fb.textContent = '🧙'
                    fb.style.cssText = `position:absolute;bottom:2%;left:50%;transform:translateX(-50%) scaleX(${st.facing});font-size:${cellSize * 0.8}px`
                    e.target.parentNode.appendChild(fb)
                  }}
                />
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
                    fontSize:       Math.round(cellSize * 0.85),
                    '--dragon-dir': dragonDir,
                    filter:         st.dangerLevel >= 1
                      ? 'drop-shadow(0 0 8px rgba(255,100,0,0.9))'
                      : 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))',
                  }}
                >
                  🐉
                </div>
              </motion.div>
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
                  <div style={{ fontSize: 56 }}>
                    {showOverlay === 'won' ? '🏆' : '💀'}
                  </div>
                  <div style={{
                    fontFamily: 'Fredoka, var(--font-heading), sans-serif',
                    fontSize:   26,
                    fontWeight: 700,
                    color:      'white',
                  }}>
                    {showOverlay === 'won' ? 'Labyrinth gemeistert!' : 'Der Drache war zu schnell!'}
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15 }}>
                    {showOverlay === 'won'
                      ? `In ${st.moves} Zügen! 🎉`
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
          <DPadButton label="▲" onPress={() => doMove(0, -1)} />
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <DPadButton label="◀" onPress={() => doMove(-1, 0)} />
          {hasDragon ? (
            <DPadButton
              label="⏳"
              ariaLabel="Warten"
              onPress={doWait}
              style={{ background: 'rgba(255,200,60,0.16)', borderColor: 'rgba(255,200,60,0.35)' }}
            />
          ) : (
            <div style={{ width: 52, height: 52 }} />
          )}
          <DPadButton label="▶" onPress={() => doMove(1, 0)} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
          <DPadButton label="▼" onPress={() => doMove(0, 1)} />
        </div>
        {hasDragon && (
          <div style={{
            textAlign:  'center',
            color:      'rgba(255,255,255,0.55)',
            fontSize:   11,
            marginTop:  4,
            fontFamily: 'Fredoka, var(--font-heading), sans-serif',
          }}>
            ⏳ Warten, bis der Drache vorbeizieht
          </div>
        )}
      </div>
    </div>
  )
}
