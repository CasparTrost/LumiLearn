import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const spr = (n) => BASE + 'sprites/maze/' + n

// ── Tile coords - verified by GPT-4o vision (no arrows!) ────────────────────
// WALL: c6,r8  WALL_TOP: c6,r14  FLOOR: c1,r0 / c3,r0 / c4,r0  DOOR: c11,r11
const T = {
  wall:    [6, 8],
  wallTop: [6, 14],
  floor:   [1, 0],   // clean stone floor
  floor2:  [3, 0],   // clean stone floor variant
  floor3:  [4, 0],   // clean stone floor variant
  floor4:  [0, 2],   // clean stone floor variant
  door:    [11, 11],
  vase:    [2, 12],
}
function tileBg(col, row, ts) {
  return {
    backgroundImage: `url(${spr('maze_tileset.png')})`,
    backgroundPosition: `${-col*16*ts}px ${-row*16*ts}px`,
    backgroundSize: `${448*ts}px ${320*ts}px`,
    imageRendering: 'pixelated',
  }
}
function floorTile(x, y) {
  const h = (x * 7 + y * 13) % 10
  if (h < 6) return T.floor
  if (h < 8) return T.floor2
  return T.floor3
}

// ── DFS Maze ────────────────────────────────────────────────────────────────
function genMaze(cols, rows) {
  const g = Array.from({length: rows}, () => Array(cols).fill(1))
  function carve(x, y) {
    g[y][x] = 0
    for (const {dx, dy} of [{dx:0,dy:-2},{dx:2,dy:0},{dx:0,dy:2},{dx:-2,dy:0}].sort(() => Math.random() - .5)) {
      const nx=x+dx, ny=y+dy
      if (nx>0&&nx<cols-1&&ny>0&&ny<rows-1&&g[ny][nx]===1) { g[y+dy/2][x+dx/2]=0; carve(nx,ny) }
    }
  }
  carve(1, 1)
  return g
}

function bfs(g, rows, cols, from, to) {
  if (!from||!to) return []
  const q=[[from]], vis=new Set([`${from.x},${from.y}`])
  while (q.length) {
    const path=q.shift(), {x,y}=path[path.length-1]
    if (x===to.x&&y===to.y) return path
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx=x+dx,ny=y+dy,k=`${nx},${ny}`
      if (nx>=0&&ny>=0&&nx<cols&&ny<rows&&g[ny][nx]===0&&!vis.has(k)) { vis.add(k); q.push([...path,{x:nx,y:ny}]) }
    }
  }
  return []
}

const LEVELS = [
  {cols:9, rows:9, potions:0, dragon:false},
  {cols:11,rows:11,potions:2, dragon:true},
  {cols:13,rows:11,potions:2, dragon:true},
  {cols:13,rows:13,potions:3, dragon:true},
  {cols:15,rows:13,potions:3, dragon:true},
  {cols:15,rows:15,potions:4, dragon:true},
  {cols:17,rows:15,potions:4, dragon:true},
  {cols:19,rows:17,potions:5, dragon:true},
  {cols:21,rows:19,potions:5, dragon:true},
  {cols:23,rows:21,potions:6, dragon:true},
]

// Torch sprite - smooth, no flicker (150ms per frame)
function Torch({ size }) {
  const [f, setF] = useState(0)
  useEffect(() => { const iv = setInterval(() => setF(p => (p+1)%8), 150); return () => clearInterval(iv) }, [])
  const s = size / 16
  return (
    <div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
      width:size,height:size,overflow:'hidden',imageRendering:'pixelated',pointerEvents:'none',zIndex:3,
      transition:'opacity 0.1s'}}>
      <img src={spr('maze_torch.png')} alt=""
        style={{width:128*s,height:16*s,transform:`translateX(${-f*16*s}px)`,imageRendering:'pixelated',
          display:'block', transition:'transform 0.05s'}}/>
    </div>
  )
}

// Potion sprites
const POTS = ['maze_potion1.png','maze_potion2.png','maze_potion3.png']

export default function MazeGame({ level=1, onComplete }) {
  const cfg = LEVELS[Math.min(level-1, LEVELS.length-1)]
  const { cols, rows } = cfg

  const cellSize = Math.min(
    Math.floor((typeof window!=='undefined' ? Math.min(window.innerWidth-16, 640) : 400) / cols),
    Math.floor(460 / rows),
    44
  )
  const ts = cellSize / 16  // tileset scale factor

  const build = useCallback(() => {
    const g = genMaze(cols, rows)
    const start = {x:1,y:1}, exit = {x:cols-2,y:rows-2}
    g[exit.y][exit.x] = 0

    // Torches: wall cells with floor below
    const torches = new Set()
    for (let y=0; y<rows-1; y++) for (let x=0; x<cols; x++)
      if (g[y][x]===1 && g[y+1][x]===0 && Math.random()<0.12) torches.add(`${x},${y}`)

    // Vase decorations on floor cells
    const vases = new Set()
    for (let y=1; y<rows-1; y++) for (let x=1; x<cols-1; x++) {
      const dS=Math.abs(x-1)+Math.abs(y-1), dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
      if (g[y][x]===0 && dS>3 && dE>3 && Math.random()<0.04) vases.add(`${x},${y}`)
    }

    // Potions
    const open = []
    for (let y=1; y<rows-1; y++) for (let x=1; x<cols-1; x++) {
      if (g[y][x]===0 && !vases.has(`${x},${y}`)) {
        const dS=Math.abs(x-1)+Math.abs(y-1), dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
        if (dS>5 && dE>5) open.push({x,y})
      }
    }
    open.sort(() => Math.random()-.5)
    const potions = open.slice(0, cfg.potions).map((p,i) => ({...p, id:`p${i}`, img:POTS[i%3]}))

    // Dragon patrol segment
    const mainPath = bfs(g, rows, cols, start, exit)
    const segLen = Math.max(3, Math.min(6, Math.floor(mainPath.length*0.12)))
    const segStart = Math.floor(mainPath.length*0.35 + Math.random()*mainPath.length*0.2)
    const seg = mainPath.slice(segStart, segStart+segLen)
    const dragonWps = seg.length>=2 ? [seg[0], seg[seg.length-1]] : []

    return {g, start, exit, torches, vases, potions, dragonWps}
  }, [cols, rows, cfg.potions])

  const [maze,    setMaze]    = useState(build)
  const [pos,     setPos]     = useState({x:1,y:1})
  const [coll,    setColl]    = useState([])
  const [won,     setWon]     = useState(false)
  const [mood,    setMood]    = useState('happy')
  const [facing,  setFacing]  = useState(1)
  const [dragon,  setDragon]  = useState(null)
  const [lives,   setLives]   = useState(3)
  const [moves,   setMoves]   = useState(0)
  const dpRef=useRef([]), dsRef=useRef(0), ddRef=useRef(1)
  const ref=useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  useEffect(() => {
    if (cfg.dragon && maze.dragonWps.length>=2) {
      const p = bfs(maze.g, rows, cols, maze.dragonWps[0], maze.dragonWps[1])
      dpRef.current = p.length>1 ? p : [maze.dragonWps[0]]
      dsRef.current=0; ddRef.current=1
      setDragon({...maze.dragonWps[0]})
    } else setDragon(null)
  }, [maze])

  const move = useCallback((dx, dy) => {
    if (won) return
    const nx=pos.x+dx, ny=pos.y+dy
    if (nx<0||ny<0||nx>=cols||ny>=rows||maze.g[ny][nx]===1) return
    if (dx>0) setFacing(1); else if (dx<0) setFacing(-1)
    setPos({x:nx,y:ny}); setMoves(m=>m+1)
  }, [won, pos, cols, rows, maze.g])

  useEffect(() => {
    const h = e => {
      const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}
      const v=m[e.key]; if(!v) return; e.preventDefault(); move(v[0],v[1])
    }
    window.addEventListener('keydown',h); return () => window.removeEventListener('keydown',h)
  }, [move])

  useEffect(() => {
    if (!cfg.dragon||won) return
    const speed = Math.max(320, 920-(level-2)*75)
    const iv = setInterval(() => {
      const p=dpRef.current; if(!p||p.length<2) return
      dsRef.current += ddRef.current
      if (dsRef.current>=p.length-1) { ddRef.current=-1; dsRef.current=p.length-2 }
      if (dsRef.current<=0) { ddRef.current=1; dsRef.current=1 }
      setDragon({...p[dsRef.current]})
    }, speed)
    return () => clearInterval(iv)
  }, [cfg.dragon, won, level])

  useEffect(() => {
    const nc = maze.potions.filter(p=>p.x===pos.x&&p.y===pos.y&&!coll.includes(p.id))
    if (nc.length) { setColl(prev=>[...prev,...nc.map(p=>p.id)]); setMood('excited'); setTimeout(()=>setMood('happy'),700) }
    if (pos.x===maze.exit.x&&pos.y===maze.exit.y&&coll.length+nc.length>=maze.potions.length) {
      setWon(true); setMood('excited')
      setTimeout(() => onComplete({score:Math.max(1,maze.potions.length),total:Math.max(1,maze.potions.length)}), 2000)
    }
  }, [pos]) // eslint-disable-line

  useEffect(() => {
    if (!dragon||won) return
    if (dragon.x===pos.x&&dragon.y===pos.y) {
      const nl=lives-1; setLives(nl); setMood('encouraging'); setPos({x:1,y:1})
      setTimeout(()=>setMood('happy'), 900)
      if (nl<=0) setTimeout(()=>onComplete({score:coll.length,total:maze.potions.length}), 1200)
    }
  }, [dragon]) // eslint-disable-line

  const allDone = coll.length >= maze.potions.length
  const W = cols*cellSize, H = rows*cellSize

  return (
    <div ref={ref} tabIndex={0} style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      gap:'clamp(6px,1.5vw,10px)', padding:'8px',
      outline:'none', touchAction:'none', overscrollBehavior:'none',
      background:'radial-gradient(ellipse at 50% 20%, #1e0a3c 0%, #080412 100%)',
      minHeight:'100%', userSelect:'none',
    }}>

      {/* WIN overlay */}
      <AnimatePresence>
        {won && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:999,background:'rgba(8,4,18,0.88)',
              display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
            {['💎','✨','🌟','⭐','💫','✨','🌟'].map((e,i)=>(
              <motion.span key={i} initial={{opacity:1,scale:0,y:0}}
                animate={{y:-(80+i*28),x:(i%2?1:-1)*(45+i*20),scale:[0,1.5,0],opacity:[1,1,0]}}
                transition={{duration:0.85,delay:i*0.07}}
                style={{position:'absolute',fontSize:26,top:'50%',left:'50%'}}>{e}</motion.span>
            ))}
            <motion.div animate={{scale:[1,1.1,1],rotate:[0,4,-4,0]}} transition={{duration:0.7,repeat:Infinity}}
              style={{fontSize:76}}>🏆</motion.div>
            <div style={{fontFamily:'var(--font-heading)',fontSize:28,fontWeight:900,color:'#d8b4fe',
              textShadow:'0 0 30px #9333ea, 0 0 60px #7e22ce'}}>Geschafft!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'center',width:'100%',maxWidth:W+16}}>
        {maze.potions.length>0 && (
          <div style={{background:'rgba(88,28,135,0.3)',borderRadius:12,padding:'5px 10px',
            display:'flex',gap:5,border:'1px solid rgba(168,85,247,0.4)'}}>
            {maze.potions.map(p=>(
              <motion.div key={p.id} animate={coll.includes(p.id)?{scale:[1,1.6,1]}:{}} transition={{duration:0.3}}
                style={{opacity:coll.includes(p.id)?1:0.22,filter:coll.includes(p.id)?'drop-shadow(0 0 6px #c084fc)':'none'}}>
                <img src={spr(p.img)} style={{width:20,height:20,imageRendering:'pixelated',display:'block'}} alt=""/>
              </motion.div>
            ))}
          </div>
        )}
        {cfg.dragon && (
          <div style={{background:'rgba(88,28,135,0.3)',borderRadius:12,padding:'5px 10px',
            display:'flex',gap:3,border:'1px solid rgba(168,85,247,0.4)'}}>
            {[0,1,2].map(i=><span key={i} style={{fontSize:15,opacity:i<lives?1:0.12}}>❤️</span>)}
          </div>
        )}
        <div style={{background:'rgba(88,28,135,0.3)',borderRadius:12,padding:'5px 10px',
          fontFamily:'var(--font-heading)',fontSize:13,color:'#d8b4fe',
          border:'1px solid rgba(168,85,247,0.4)'}}>👣 {moves}</div>
        {!allDone&&maze.potions.length>0 && (
          <div style={{background:'rgba(161,98,7,0.2)',borderRadius:12,padding:'5px 10px',
            fontFamily:'var(--font-heading)',fontSize:12,color:'#fde68a',
            border:'1px solid rgba(251,191,36,0.3)'}}>🧪 Sammle alle Tränke!</div>
        )}
      </div>

      {/* Lumi */}
      <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',maxWidth:W+16}}>
        <LumiCharacter mood={mood} size={44}/>
        <div style={{flex:1,background:'rgba(88,28,135,0.2)',borderRadius:12,padding:'7px 12px',
          fontFamily:'var(--font-heading)',fontSize:'clamp(11px,2vw,14px)',color:'#e9d5ff',
          border:'1px solid rgba(168,85,247,0.3)'}}>
          {won?'🎉 Du hast das Dungeon bezwungen!'
            :allDone?'🚪 Zur Tür! Du hast alle Tränke!'
            :cfg.dragon?'Sammle 🧪 und meide den 🐲!'
            :'Finde den Ausgang! 🚪'}
        </div>
      </div>

      {/* Maze */}
      <div style={{
        position:'relative', width:W, height:H, flexShrink:0,
        border:'3px solid #6b21a8',
        borderRadius:10,
        overflow:'hidden',
        boxShadow:'0 0 0 1px #9333ea55, 0 0 50px rgba(147,51,234,0.3), 0 12px 50px rgba(0,0,0,0.7)',
      }}>
        {/* Ambient vignette */}
        <div style={{position:'absolute',inset:0,zIndex:30,pointerEvents:'none',
          background:'radial-gradient(ellipse at 50% 50%,transparent 35%,rgba(0,0,0,0.5) 100%)'}}/>

        {maze.g.map((row,y) => row.map((cell,x) => {
          const isExit  = maze.exit.x===x && maze.exit.y===y
          const potion  = maze.potions.find(p=>p.x===x&&p.y===y&&!coll.includes(p.id))
          const hasTorch = maze.torches.has(`${x},${y}`)
          const hasVase  = maze.vases.has(`${x},${y}`) && !potion && !isExit
          // Use wall-top tile when wall has floor directly below (visible top face)
          const hasFloorBelow = cell===1 && y+1<rows && maze.g[y+1]&&maze.g[y+1][x]===0
          const [tc, tr] = cell===1 ? (hasFloorBelow ? T.wallTop : T.wall) : floorTile(x,y)

          return (
            <div key={`${x}-${y}`} style={{position:'absolute',left:x*cellSize,top:y*cellSize,width:cellSize,height:cellSize,overflow:'hidden'}}>
              {/* Tile */}
              <div style={{position:'absolute',inset:0, ...tileBg(tc,tr,ts),
                filter: cell===1 ? 'brightness(0.6) saturate(0.8)' : 'brightness(0.55) saturate(0.65)'
              }}/>
              {/* Wall tint */}
              {cell===1 && <>
                <div style={{position:'absolute',inset:0,background:'rgba(76,29,149,0.35)'}}/>
                <div style={{position:'absolute',top:0,left:0,right:0,height:'40%',
                  background:'linear-gradient(180deg,rgba(0,0,0,0.55),transparent)'}}/>
                <div style={{position:'absolute',bottom:0,left:0,right:0,height:'20%',
                  background:'linear-gradient(0deg,rgba(0,0,0,0.3),transparent)'}}/>
              </>}
              {/* Floor subtle glow */}
              {cell===0 && !hasTorch && (
                <div style={{position:'absolute',inset:0,background:'rgba(88,28,135,0.06)'}}/>
              )}
              {/* Torch glow on floor below torch - smooth pulse */}
              {cell===0 && y>0 && maze.torches.has(`${x},${y-1}`) && (
                <motion.div style={{position:'absolute',inset:0}}
                  animate={{opacity:[0.6,1,0.7,1,0.6]}}
                  transition={{duration:2.5,repeat:Infinity,ease:'easeInOut'}}>
                  <div style={{width:'100%',height:'100%',
                    background:'radial-gradient(ellipse at 50% 0%,rgba(255,160,50,0.28) 0%,transparent 80%)'}}/>
                </motion.div>
              )}
              {/* Exit door */}
              {isExit && (
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:5}}
                  animate={allDone
                    ?{filter:['drop-shadow(0 0 8px #c084fc)','drop-shadow(0 0 20px #e879f9)','drop-shadow(0 0 8px #c084fc)']}
                    :{opacity:0.4}}
                  transition={{duration:1.4,repeat:Infinity}}>
                  {/* Door tile from tileset */}
                  <div style={{width:'100%',height:'100%',...tileBg(T.door[0],T.door[1],ts),
                    filter:allDone?'brightness(1.8) drop-shadow(0 0 12px #e879f9) saturate(1.5)':'brightness(0.7) saturate(0.6)'}}/>
                </motion.div>
              )}
              {/* Potion */}
              {potion && (
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:5}}
                  animate={{y:[0,-2.5,0]}} transition={{duration:1.8,repeat:Infinity,ease:'easeInOut'}}>
                  <img src={spr(potion.img)} style={{width:cellSize*0.6,height:cellSize*0.6,
                    imageRendering:'pixelated',filter:'drop-shadow(0 0 6px #c084fc) drop-shadow(0 0 12px #9333ea)'}} alt=""/>
                </motion.div>
              )}
              {/* Vase decoration */}
              {hasVase && (
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:4}}>
                  <div style={{width:cellSize*0.7,height:cellSize*0.7,...tileBg(T.vase[0],T.vase[1],ts*0.7),
                    filter:'brightness(0.8) sepia(0.3)'}}/>
                </div>
              )}
              {/* Torch */}
              {hasTorch && <Torch size={Math.round(cellSize*0.72)}/>}
            </div>
          )
        }))}

        {/* Player */}
        <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:20,pointerEvents:'none'}}
          animate={{left:pos.x*cellSize,top:pos.y*cellSize}}
          transition={{type:'spring',stiffness:500,damping:32}}>
          <motion.span
            animate={{y:[0,-2,0]}} transition={{duration:1.15,repeat:Infinity,ease:'easeInOut'}}
            style={{fontSize:cellSize*0.72,lineHeight:1,display:'block',
              transform:`scaleX(${facing})`,
              filter:'drop-shadow(0 3px 8px rgba(192,132,252,0.9)) drop-shadow(0 1px 3px rgba(0,0,0,0.9))'}}>
            🧙‍♂️
          </motion.span>
        </motion.div>

        {/* Dragon */}
        {dragon && (
          <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:18,pointerEvents:'none'}}
            animate={{left:dragon.x*cellSize,top:dragon.y*cellSize}}
            transition={{type:'spring',stiffness:320,damping:28}}>
            <motion.span animate={{scale:[1,1.09,1]}} transition={{duration:0.9,repeat:Infinity}}
              style={{fontSize:cellSize*0.72,lineHeight:1,
                filter:'drop-shadow(0 0 12px rgba(251,146,60,0.95)) drop-shadow(0 2px 5px rgba(0,0,0,0.9))'}}>
              🐲
            </motion.span>
          </motion.div>
        )}
      </div>

      {/* D-Pad */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,68px)',gridTemplateRows:'repeat(3,68px)',gap:5,flexShrink:0}}>
        {[
          {l:'▲',dx:0,dy:-1,c:2,r:1},{l:'◀',dx:-1,dy:0,c:1,r:2},
          {l:'',dx:0,dy:0,c:2,r:2},  {l:'▶',dx:1,dy:0,c:3,r:2},
          {l:'▼',dx:0,dy:1,c:2,r:3},
        ].map(b=>(
          <motion.button key={b.l||'mid'} whileTap={b.l?{scale:0.82}:{}}
            onClick={()=>b.l&&move(b.dx,b.dy)}
            style={{
              gridColumn:b.c,gridRow:b.r,borderRadius:14,
              background:b.l?'linear-gradient(135deg,#7c3aed,#4c1d95)':'transparent',
              color:'#f3e8ff',border:b.l?'2px solid #9333ea':'none',
              fontSize:24,fontWeight:900,cursor:b.l?'pointer':'default',
              boxShadow:b.l?'0 4px 16px rgba(147,51,234,0.5),inset 0 1px 0 rgba(255,255,255,0.12)':'none',
              display:'flex',alignItems:'center',justifyContent:'center',
              width:68,height:68,
            }}>{b.l}</motion.button>
        ))}
      </div>
    </div>
  )
}
