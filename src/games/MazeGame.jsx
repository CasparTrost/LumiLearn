import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

/**
 * Lumi-Labyrinth — Räumliches Denken & Problemlösung
 * Scientific basis:
 *   • Spatial Reasoning (Uttal et al., 2013 meta-analysis) — spatial training improves
 *     mathematical ability and is one of the strongest STEM predictors.
 *   • Executive Function / Planning (Diamond, 2013) — maze navigation trains working memory,
 *     inhibitory control, and cognitive flexibility simultaneously.
 *   • Intrinsic motivation via challenge (Csikszentmihalyi, Flow Theory) — increasing grid
 *     size per level keeps kids in the "flow zone".
 *
 * Controls: Arrow keys OR WASD OR on-screen D-pad
 * Lumi walks through the maze collecting stars to the exit door.
 */

// ─── Maze generator (Recursive Back-Tracker / DFS) ───────────────────────────
const DIRS = [
  { dx: 0, dy: -2, wall: { dx: 0, dy: -1 }, bit: 'N' },
  { dx: 2, dy:  0, wall: { dx: 1, dy:  0 }, bit: 'E' },
  { dx: 0, dy:  2, wall: { dx: 0, dy:  1 }, bit: 'S' },
  { dx:-2, dy:  0, wall: { dx:-1, dy:  0 }, bit: 'W' },
]

function generateMaze(cols, rows) {
  // cols and rows must be odd numbers for DFS maze
  const grid = Array.from({ length: rows }, () => Array(cols).fill(1)) // 1 = wall
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false))

  function carve(x, y) {
    visited[y][x] = true
    grid[y][x] = 0
    const dirs = [...DIRS].sort(() => Math.random() - 0.5)
    for (const d of dirs) {
      const nx = x + d.dx
      const ny = y + d.dy
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows && !visited[ny][nx]) {
        grid[y + d.wall.dy][x + d.wall.dx] = 0 // carve wall between
        carve(nx, ny)
      }
    }
  }

  carve(1, 1)
  return grid
}

function placeStar(grid, rows, cols, avoid) {
  // find a random open cell away from player
  const candidates = []
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] === 0) {
        const dist = Math.abs(x - avoid.x) + Math.abs(y - avoid.y)
        if (dist > 4) candidates.push({ x, y })
      }
    }
  }
  if (!candidates.length) return null
  return candidates[Math.floor(Math.random() * candidates.length)]
}

function pickOpenCells(grid, rows, cols, n, minDist) {
  // collect open cells with min manhattan distance from BOTH corners
  const pool = []
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] === 0) {
        const dStart = Math.abs(x - 1) + Math.abs(y - 1)
        const dExit  = Math.abs(x - (cols - 2)) + Math.abs(y - (rows - 2))
        if (dStart >= minDist && dExit >= minDist) pool.push({ x, y })
      }
    }
  }
  pool.sort(() => Math.random() - 0.5)
  return pool.slice(0, n)
}

// BFS — returns array of cells from `from` to `to` through open maze cells
function bfsPath(grid, rows, cols, from, to) {
  if (!from || !to) return []
  const queue = [[from]]
  const visited = new Set([`${from.x},${from.y}`])
  while (queue.length > 0) {
    const path = queue.shift()
    const { x, y } = path[path.length - 1]
    if (x === to.x && y === to.y) return path
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx = x + dx, ny = y + dy
      const key = `${nx},${ny}`
      if (nx >= 0 && ny >= 0 && nx < cols && ny < rows && grid[ny][nx] === 0 && !visited.has(key)) {
        visited.add(key)
        queue.push([...path, { x: nx, y: ny }])
      }
    }
  }
  return [] // no path found
}

// Theme per level group
const LEVEL_THEMES = [
  { wall:'#1d3a1a,#2a5225', floor1:'#c8e6a0', floor2:'#bfdc98', name:'Wald' },        // L1-2
  { wall:'#1a2a3a,#253545', floor1:'#a0c4e6', floor2:'#8fb8da', name:'Ozean' },       // L3-4
  { wall:'#3a1a1a,#5a2525', floor1:'#e6b0a0', floor2:'#daa090', name:'Vulkan' },      // L5-6
  { wall:'#2a1a3a,#3a2550', floor1:'#c4a0e6', floor2:'#b890da', name:'Kristall' },    // L7-8
  { wall:'#101020,#1a1a35', floor1:'#9090c8', floor2:'#8080b8', name:'Weltraum' },    // L9-10
]

const LEVEL_CONFIG = [
  { cols: 5,  rows: 5,  stars: 0, label: 'Winzig' },
  { cols: 7,  rows: 7,  stars: 1, label: 'Klein' },
  { cols: 7,  rows: 9,  stars: 1, label: 'Klein-L' },
  { cols: 9,  rows: 9,  stars: 2, label: 'Mittel' },
  { cols: 9,  rows: 11, stars: 2, label: 'Mittel-L' },
  { cols: 11, rows: 11, stars: 3, label: 'Groß' },
  { cols: 11, rows: 13, stars: 3, label: 'Groß-L' },
  { cols: 13, rows: 13, stars: 3, label: 'Riesig' },
  { cols: 13, rows: 15, stars: 4, label: 'Riesig-L' },
  { cols: 15, rows: 15, stars: 4, label: 'Gigantisch' },
]

export default function MazeGame({ level = 1, onComplete }) {
  const cfg    = LEVEL_CONFIG[Math.min(level - 1, LEVEL_CONFIG.length - 1)]
  const { cols, rows } = cfg

  const buildLevel = useCallback(() => {
    const grid   = generateMaze(cols, rows)
    const start  = { x: 1, y: 1 }
    const exit   = { x: cols - 2, y: rows - 2 }
    grid[exit.y][exit.x] = 0
    const starsPos = []
    let avoidPos = { ...start }
    for (let i = 0; i < cfg.stars; i++) {
      const s = placeStar(grid, rows, cols, avoidPos)
      if (s) { starsPos.push(s); avoidPos = s }
    }
    // Compute main path start→exit — dragon must NEVER patrol these cells
    const mainPath = bfsPath(grid, rows, cols, start, exit)
    const mainPathSet = new Set(mainPath.map(p => `${p.x},${p.y}`))

    // Dragon waypoints: only cells NOT on the main path
    const safeOpen = []
    for (let wy = 2; wy < rows - 2; wy++) {
      for (let wx = 2; wx < cols - 2; wx++) {
        if (grid[wy][wx] === 0 && !mainPathSet.has(`${wx},${wy}`)) {
          safeOpen.push({ x: wx, y: wy })
        }
      }
    }
    safeOpen.sort(() => Math.random() - 0.5)
    const waypoints = []
    for (const candidate of safeOpen) {
      if (waypoints.length === 0) { waypoints.push(candidate); continue }
      const prev = waypoints[waypoints.length - 1]
      const path = bfsPath(grid, rows, cols, prev, candidate)
      // Only add if the path between waypoints also stays off the main route
      const pathOffMain = path.every(p => !mainPathSet.has(`${p.x},${p.y}`))
      if (path.length > 1 && pathOffMain) { waypoints.push(candidate) }
      if (waypoints.length >= 3) break
    }
    if (waypoints.length < 2 && safeOpen.length >= 2) waypoints.push(safeOpen[1])
    return { grid, start, exit, starsPos, waypoints }
  }, [cols, rows, cfg.stars])

  const [maze,        setMaze]        = useState(buildLevel)
  const [playerPos,   setPlayerPos]   = useState({ x: 1, y: 1 })
  const [collectedStars, setCollected] = useState([])
  const [won,         setWon]         = useState(false)
  const [moves,       setMoves]       = useState(0)
  const [mood,        setMood]        = useState('happy')
  const [direction,   setDirection]   = useState('right') // 'left' | 'right' | 'up' | 'down'
  const [ghostPos,    setGhostPos]    = useState(null)
  const [lives,       setLives]       = useState(3)
  const ghostPathRef    = useRef([])   // current BFS path the dragon follows
  const ghostPathStep   = useRef(0)    // step index in that path
  const ghostWpIdx = useRef(0) // current target waypoint index
  const containerRef = useRef(null)

  // Focus for keyboard events
  useEffect(() => { containerRef.current?.focus() }, [])

  // Initialize dragon position + first BFS path
  useEffect(() => {
    if (level >= 2 && maze.waypoints && maze.waypoints.length >= 2) {
      ghostWpIdx.current = 0
      ghostPathStep.current = 0
      ghostPathRef.current = bfsPath(maze.grid, cols, rows, maze.waypoints[0], maze.waypoints[1 % maze.waypoints.length])
      setGhostPos({ ...maze.waypoints[0] })
    } else {
      setGhostPos(null)
    }
  }, [maze, level])

  const tryMove = useCallback((dx, dy) => {
    if (won) return
    const nx = playerPos.x + dx
    const ny = playerPos.y + dy
    if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) return
    if (maze.grid[ny][nx] === 1) return // wall
    if (dx > 0) setDirection('right')
    else if (dx < 0) setDirection('left')
    else if (dy > 0) setDirection('down')
    else if (dy < 0) setDirection('up')
    setPlayerPos({ x: nx, y: ny })
    setMoves(m => m + 1)
  }, [won, playerPos, cols, rows, maze.grid])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      const map = { ArrowUp:'U', ArrowDown:'D', ArrowLeft:'L', ArrowRight:'R',
                    w:'U', s:'D', a:'L', d:'R', W:'U', S:'D', A:'L', D:'R' }
      const dir = map[e.key]
      if (!dir) return
      e.preventDefault()
      if (dir === 'U') tryMove(0, -1)
      if (dir === 'D') tryMove(0,  1)
      if (dir === 'L') tryMove(-1, 0)
      if (dir === 'R') tryMove( 1, 0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tryMove])

  // Dragon patrol — follows BFS paths between waypoints in a cycle
  useEffect(() => {
    if (level < 2 || won || !maze.waypoints || maze.waypoints.length < 2) return
    const speed = Math.max(160, 440 - (level - 2) * 70) // faster at higher levels
    const wps = maze.waypoints
    const iv = setInterval(() => {
      ghostPathStep.current += 1
      const path = ghostPathRef.current
      if (path.length === 0 || ghostPathStep.current >= path.length) {
        // Reached the current target waypoint — pick next and compute new path
        const from = path.length > 0 ? path[path.length - 1] : wps[ghostWpIdx.current]
        ghostWpIdx.current = (ghostWpIdx.current + 1) % wps.length
        const to = wps[ghostWpIdx.current]
        const newPath = bfsPath(maze.grid, cols, rows, from, to)
        if (newPath.length > 1) {
          ghostPathRef.current = newPath
        } else {
          // No path found — skip to next waypoint
          ghostWpIdx.current = (ghostWpIdx.current + 1) % wps.length
          const to2 = wps[ghostWpIdx.current]
          const newPath2 = bfsPath(maze.grid, cols, rows, from, to2)
          ghostPathRef.current = newPath2.length > 1 ? newPath2 : [from]
        }
        ghostPathStep.current = 0
        setGhostPos({ ...ghostPathRef.current[0] })
      } else {
        setGhostPos({ ...path[ghostPathStep.current] })
      }
    }, speed)
    return () => clearInterval(iv)
  }, [level, won, maze, cols, rows])

  // Check star collection & exit
  useEffect(() => {
    // Stars
    const newCollected = maze.starsPos.filter(s =>
      s.x === playerPos.x && s.y === playerPos.y &&
      !collectedStars.some(c => c.x === s.x && c.y === s.y)
    )
    if (newCollected.length > 0) {
      setCollected(prev => [...prev, ...newCollected])
      setMood('excited')
      setTimeout(() => setMood('happy'), 800)
    }

    // Exit
    const neededStars = maze.starsPos.length
    const totalCollected = collectedStars.length + newCollected.length
    if (playerPos.x === maze.exit.x && playerPos.y === maze.exit.y &&
        totalCollected >= neededStars) {
      setWon(true)
      setMood('excited')
      setTimeout(() => {
        onComplete({ score: Math.max(neededStars, 1), total: Math.max(neededStars, 1) })
      }, 1800)
    }
  }, [playerPos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ghost collision — reset player
  useEffect(() => {
    if (!ghostPos || won) return
    if (ghostPos.x === playerPos.x && ghostPos.y === playerPos.y) {
      const nl = lives - 1
      setLives(nl)
      setMood('encouraging')
      setPlayerPos({ x: 1, y: 1 })
      setTimeout(() => setMood('happy'), 900)
      if (nl <= 0) {
        setTimeout(() => onComplete({ score: collectedStars.length, total: maze.starsPos.length }), 1200)
      }
    }
  }, [ghostPos]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cell size responsive
  const cellSize = Math.min(
    Math.floor((typeof window !== 'undefined' ? Math.min(window.innerWidth * 0.92, 640) : 400) / cols),
    Math.floor(480 / rows),
    52
  )

  const totalW = cols * cellSize
  const totalH = rows * cellSize

  const allStarsHeld = collectedStars.length >= maze.starsPos.length

  return (
    <div ref={containerRef} tabIndex={0} style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(12px,2vw,24px) 12px',
      gap:'clamp(10px,1.8vw,18px)',
      outline:'none',
    }}>

      {/* WIN overlay */}
      <AnimatePresence>
        {won && (
          <motion.div
            initial={{ opacity:0, scale:0.7 }}
            animate={{ opacity:1, scale:1 }}
            style={{
              position:'fixed', inset:0, zIndex:500,
              display:'flex', alignItems:'center', justifyContent:'center',
              background:'rgba(0,0,0,0.55)', flexDirection:'column', gap:16,
            }}
          >
            {['🌟','✨','⭐','🎉','🌟','✨'].map((e,i) => (
              <motion.span key={i}
                initial={{y:0,x:0,scale:0,opacity:1}}
                animate={{y:-(100+i*40),x:(i%2===0?1:-1)*(60+i*30),scale:[0,1.4,0],opacity:[1,1,0]}}
                transition={{duration:0.9,delay:i*0.08}}
                style={{position:'absolute',fontSize:36}}>{e}</motion.span>
            ))}
            <motion.div
              animate={{scale:[1,1.1,1],rotate:[0,5,-5,0]}}
              transition={{duration:0.6,repeat:3}}
              style={{fontSize:80}}>🏆</motion.div>
            <div style={{fontFamily:'var(--font-heading)',fontSize:28,fontWeight:900,color:'#FFD93D',
              textShadow:'0 0 20px rgba(255,217,61,0.8)'}}>Super gemacht!</div>
            <div style={{fontFamily:'var(--font-body)',fontSize:16,color:'rgba(255,255,255,0.8)'}}>
              Du hast das Labyrinth gelöst! 🎉
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status bar */}
      <div style={{ display:'flex', gap:12, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
        <div style={{
          background:'white', borderRadius:99, padding:'8px 18px',
          fontFamily:'var(--font-heading)', fontSize:16, color:'var(--text-secondary)',
          boxShadow:'0 3px 12px rgba(0,0,0,0.08)',
          display:'flex', alignItems:'center', gap:6,
        }}>
          {Array.from({ length: maze.starsPos.length }).map((_, i) => (
            <span key={i} style={{ fontSize:22, filter: i < collectedStars.length ? 'none' : 'grayscale(1) opacity(0.35)' }}>💎</span>
          ))}
        </div>
        <div style={{
          background:'white', borderRadius:99, padding:'8px 18px',
          fontFamily:'var(--font-heading)', fontSize:15, color:'var(--text-muted)',
          boxShadow:'0 3px 12px rgba(0,0,0,0.08)',
        }}>
          {'👟 ' + moves + ' Schritte'}
        </div>
        {level >= 2 && (
          <div style={{ display:'flex', gap:4, background:'white', borderRadius:99, padding:'8px 14px', boxShadow:'0 3px 12px rgba(0,0,0,0.08)', alignItems:'center' }}>
            {Array.from({length:3}).map((_,i) => (
              <span key={i} style={{ fontSize:20, filter: i < lives ? 'none' : 'grayscale(1) opacity(0.28)' }}>{'❤️'}</span>
            ))}
          </div>
        )}
        {!allStarsHeld && (
          <div style={{
            background:'#e8f5e0', borderRadius:99, padding:'8px 18px',
            fontFamily:'var(--font-heading)', fontSize:14, color:'#2d5a1b', border:'1.5px solid #6BCB77',
          }}>
            {'Sammel alle 💎 dann zum 🏰!'}
          </div>
        )}
      </div>

      {/* Lumi hint */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:10, width:'100%', maxWidth:640 }}>
        <LumiCharacter mood={mood} size={70} />
        <div style={{
          flex:1, background:'white', borderRadius:'20px 20px 20px 5px',
          padding:'12px 18px',
          fontFamily:'var(--font-heading)', fontSize:'clamp(14px,3vw,18px)',
          color:'var(--text-primary)',
          boxShadow:'0 3px 16px rgba(74,0,224,0.1)',
        }}>
          {won ? '🎉 Fantastisch! Du hast das Labyrinth gelöst!'
               : allStarsHeld ? '🏰 Zum Schloss! Du hast alle Edelsteine!'
               : level >= 2 ? 'Finde alle 💎 und meide den � Drachen! Pfeiltasten oder Buttons.'
               : 'Finde alle 💎 Edelsteine und dann zum Schloss! Pfeiltasten oder Buttons.'}
        </div>
      </div>

      {/* Maze canvas */}
      <div style={{
        background: (['#1a2e1a','#1a2535','#2e1a1a','#251a2e','#101020'])[Math.min(Math.floor((level-1)/2), 4)], borderRadius:20, padding:6,
        boxShadow:'0 8px 36px rgba(10,40,10,0.45)',
        overflow:'hidden',
        position:'relative',
        width: totalW + 12,
        flexShrink:0,
      }}>
        <div style={{ position:'relative', width:totalW, height:totalH }}>
          {/* Cells */}
          {maze.grid.map((row, y) => row.map((cell, x) => {
            const isPlayer = playerPos.x === x && playerPos.y === y
            const isExit   = maze.exit.x === x && maze.exit.y === y
            const isStar   = maze.starsPos.some(s => s.x === x && s.y === y && !collectedStars.some(c => c.x === x && c.y === y))
            const isStart  = x === 1 && y === 1

            const themeIdx = Math.min(Math.floor((level - 1) / 2), LEVEL_THEMES.length - 1)
            const theme = LEVEL_THEMES[themeIdx]
            const isEven = (x + y) % 2 === 0
            let bg = cell === 1
              ? `linear-gradient(135deg,${theme.wall})`
              : isExit
              ? (allStarsHeld ? 'radial-gradient(circle,#ffe066,#ffa500)' : 'radial-gradient(circle,#8b7a4a,#6b5c33)')
              : isStart ? theme.floor1
              : isEven ? theme.floor1 : theme.floor2

            return (
              <div key={`${x}-${y}`} style={{
                position:'absolute',
                left: x * cellSize, top: y * cellSize,
                width: cellSize, height: cellSize,
                background: bg,
                // wall edge shadow for depth
                boxShadow: cell === 1 ? 'inset 0 0 6px rgba(0,0,0,0.5)' : 'none',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: cellSize * 0.55,
                lineHeight:1,
                zIndex: isPlayer ? 3 : 1,
              }}>
                {isExit && !isPlayer && (
                  <motion.span
                    animate={allStarsHeld ? { scale:[1,1.15,1], filter:['drop-shadow(0 0 8px #ffa500)','drop-shadow(0 0 18px #ffd700)','drop-shadow(0 0 8px #ffa500)'] } : {}}
                    transition={{ duration:1.4, repeat:Infinity }}
                    style={{ fontSize: cellSize * 0.62 }}
                  >🏰</motion.span>
                )}
                {isStar && !isPlayer && (
                  <motion.span
                    animate={{ scale:[1,1.25,1], rotate:[0,20,-20,0], filter:['drop-shadow(0 0 4px #FFD700)','drop-shadow(0 0 12px #FFD700)','drop-shadow(0 0 4px #FFD700)'] }}
                    transition={{ duration:1.5, repeat:Infinity }}
                    style={{ fontSize: cellSize * 0.60 }}
                  >💎</motion.span>
                )}
              </div>
            )
          }))}

          {/* Player */}
          <motion.div
            style={{
              position:'absolute',
              left: playerPos.x * cellSize,
              top:  playerPos.y * cellSize,
              width: cellSize, height: cellSize,
              display:'flex', alignItems:'center', justifyContent:'center',
              zIndex:4,
              fontSize: cellSize * 0.75,
              lineHeight:1,
            }}
            animate={{ left: playerPos.x * cellSize, top: playerPos.y * cellSize }}
            transition={{ type:'spring', stiffness:420, damping:28 }}
          >
            <motion.span
              animate={won
                ? { scale:[1,1.4,1.4,1], rotate:[0,10,-10,0] }
                : { y:[0,-2,0] }}
              transition={won
                ? { duration:0.6, repeat:Infinity }
                : { duration:1.2, repeat:Infinity, ease:'easeInOut' }}
              style={{
                display:'inline-block',
                filter: direction==='down' ? 'none' : `drop-shadow(0 2px 4px rgba(0,0,0,0.4))`,
                transform: direction==='left' ? 'scaleX(-1)' : 'scaleX(1)',
              }}
            >
              {'\ud83e\udd34'}
            </motion.span>
          </motion.div>

          {/* Ghost (level 2+) */}
          {ghostPos && (
            <motion.div
              style={{ position:'absolute', width:cellSize, height:cellSize, display:'flex', alignItems:'center', justifyContent:'center', zIndex:3, fontSize:cellSize*0.70, lineHeight:1 }}
              animate={{ left: ghostPos.x * cellSize, top: ghostPos.y * cellSize }}
              transition={{ type:'spring', stiffness:280, damping:26 }}
            >
              <motion.span
                animate={{ y:[0,-3,0], opacity:[1,0.75,1], scale:[1,1.1,1] }}
                transition={{ duration:1.0, repeat:Infinity, ease:'easeInOut' }}
                style={{ display:'inline-block', filter:'drop-shadow(0 0 8px rgba(255,80,0,0.85))' }}
              >{'\ud83d\udc32'}</motion.span>
            </motion.div>
          )}
        </div>
      </div>

      {/* D-Pad */}
      <div style={{ display:'grid', gridTemplateColumns:'48px 48px 48px', gridTemplateRows:'48px 48px 48px', gap:4 }}>
        {[
          { label:'▲', dx:0, dy:-1, col:2, row:1 },
          { label:'◀', dx:-1, dy:0, col:1, row:2 },
          { label:'◉', dx:0,  dy:0, col:2, row:2 },
          { label:'▶', dx:1,  dy:0, col:3, row:2 },
          { label:'▼', dx:0,  dy:1, col:2, row:3 },
        ].map(btn => (
          <motion.button key={btn.label}
            whileHover={btn.dx !== 0 || btn.dy !== 0 ? { scale:1.15 } : {}}
            whileTap={btn.dx !== 0 || btn.dy !== 0 ? { scale:0.88 } : {}}
            onClick={() => tryMove(btn.dx, btn.dy)}
            style={{
              gridColumn: btn.col, gridRow: btn.row,
              borderRadius:12,
              background: btn.dx === 0 && btn.dy === 0 ? 'transparent' : 'linear-gradient(135deg,#6C63FF,#4A00E0)',
              color:'white', border:'none',
              fontFamily:'var(--font-heading)', fontSize:22, fontWeight:700,
              cursor: btn.dx === 0 && btn.dy === 0 ? 'default' : 'pointer',
              boxShadow: btn.dx !== 0 || btn.dy !== 0 ? '0 4px 14px rgba(74,0,224,0.35)' : 'none',
              display:'flex', alignItems:'center', justifyContent:'center',
              width:48, height:48,
            }}
          >
            {btn.label !== '◉' ? btn.label : ''}
          </motion.button>
        ))}
      </div>
    </div>
  )
}
