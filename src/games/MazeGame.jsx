import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const spr = (n) => BASE + 'sprites/maze/' + n

// ─── DFS Maze Generator ──────────────────────────────────────────────────────
function generateMaze(cols, rows) {
  const grid = Array.from({length:rows}, () => Array(cols).fill(1))
  function carve(x, y) {
    grid[y][x] = 0
    const dirs = [{dx:0,dy:-2},{dx:2,dy:0},{dx:0,dy:2},{dx:-2,dy:0}].sort(()=>Math.random()-.5)
    for (const {dx,dy} of dirs) {
      const nx=x+dx, ny=y+dy
      if (nx>0&&nx<cols-1&&ny>0&&ny<rows-1&&grid[ny][nx]===1) {
        grid[y+dy/2][x+dx/2]=0; carve(nx,ny)
      }
    }
  }
  carve(1,1)
  return grid
}

function bfs(grid, rows, cols, from, to) {
  if (!from||!to) return []
  const q=[[from]], vis=new Set([`${from.x},${from.y}`])
  while(q.length) {
    const path=q.shift(), {x,y}=path[path.length-1]
    if(x===to.x&&y===to.y) return path
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx=x+dx,ny=y+dy,k=`${nx},${ny}`
      if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&grid[ny][nx]===0&&!vis.has(k)){vis.add(k);q.push([...path,{x:nx,y:ny}])}
    }
  }
  return []
}

const LEVEL_CONFIG = [
  {cols:11,rows:11,potions:0,dragon:false},
  {cols:13,rows:13,potions:2,dragon:true},
  {cols:15,rows:13,potions:2,dragon:true},
  {cols:15,rows:15,potions:3,dragon:true},
  {cols:17,rows:15,potions:3,dragon:true},
  {cols:19,rows:17,potions:4,dragon:true},
  {cols:21,rows:19,potions:4,dragon:true},
  {cols:23,rows:21,potions:5,dragon:true},
  {cols:25,rows:23,potions:5,dragon:true},
  {cols:27,rows:25,potions:6,dragon:true},
]

// Tileset: Set 1.png = 448x320, tiles 16x16
// WALL: col=3, row=2 → bgPos = (-3*16, -2*16) = (-48, -32)
// FLOOR: col=10, row=8 → bgPos = (-160, -128)
// FLOOR2: col=13, row=7 → bgPos = (-208, -112)
const TILE = {
  wall:  { x: -48,  y: -32  },
  floor: { x: -160, y: -128 },
  floor2:{ x: -208, y: -112 },
}

// Animated torch: 8 frames horizontal in Torch Yellow.png (128x16)
function Torch({ size }) {
  const [f, setF] = useState(0)
  useEffect(() => { const iv=setInterval(()=>setF(p=>(p+1)%8),120); return ()=>clearInterval(iv) }, [])
  const s = size/16
  return (
    <div style={{position:'absolute',bottom:0,left:'50%',transform:'translateX(-50%)',
      width:size,height:size,overflow:'hidden',imageRendering:'pixelated',pointerEvents:'none'}}>
      <img src={spr('maze_torch.png')} alt=""
        style={{width:128*s,height:16*s,transform:`translateX(${-f*16*s}px)`,imageRendering:'pixelated'}}/>
    </div>
  )
}

// Animated coin: Coin Gif.gif (animated GIF, 16x16)
function Coin({ size }) {
  return (
    <img src={spr('maze_coin.gif')} alt="🧪"
      style={{width:size,height:size,imageRendering:'pixelated',
        filter:'drop-shadow(0 0 6px #FFD700) drop-shadow(0 0 12px #FFD700)'}}/>
  )
}

const POTIONS = ['maze_potion1.png','maze_potion2.png','maze_potion3.png',
                 'maze_potion1.png','maze_potion2.png','maze_potion3.png']

export default function MazeGame({ level=1, onComplete }) {
  const cfg = LEVEL_CONFIG[Math.min(level-1, LEVEL_CONFIG.length-1)]
  const {cols,rows} = cfg

  const build = useCallback(() => {
    const grid = generateMaze(cols, rows)
    const start = {x:1,y:1}, exit = {x:cols-2,y:rows-2}
    grid[exit.y][exit.x] = 0

    // Torches: on wall cells adjacent to floor below them
    const torches = new Set()
    for(let y=1;y<rows-1;y++) for(let x=1;x<cols-1;x++) {
      if(grid[y][x]===1&&y+1<rows&&grid[y+1][x]===0&&Math.random()<0.12)
        torches.add(`${x},${y}`)
    }

    // Potions on open cells far from start/exit
    const open=[]
    for(let y=1;y<rows-1;y++) for(let x=1;x<cols-1;x++) {
      if(grid[y][x]===0) {
        const dS=Math.abs(x-1)+Math.abs(y-1), dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
        if(dS>5&&dE>5) open.push({x,y})
      }
    }
    open.sort(()=>Math.random()-.5)
    const potions = open.slice(0,cfg.potions).map((p,i)=>({...p,id:`p${i}`,img:POTIONS[i%POTIONS.length]}))

    // Dragon: bounces on main path segment
    const mainPath = bfs(grid, rows, cols, start, exit)
    const segLen = Math.max(3, Math.min(7, Math.floor(mainPath.length*0.12)))
    const segStart = Math.floor(mainPath.length*0.35+Math.random()*mainPath.length*0.2)
    const seg = mainPath.slice(segStart, segStart+segLen)
    const dragonWps = seg.length>=2 ? [seg[0],seg[seg.length-1]] : []

    return {grid, start, exit, torches, potions, dragonWps}
  }, [cols, rows, cfg.potions])

  const [maze,      setMaze]      = useState(build)
  const [pos,       setPos]       = useState({x:1,y:1})
  const [collected, setCollected] = useState([])
  const [won,       setWon]       = useState(false)
  const [mood,      setMood]      = useState('happy')
  const [dir,       setDir]       = useState('right')
  const [dragon,    setDragon]    = useState(null)
  const [lives,     setLives]     = useState(3)
  const [moves,     setMoves]     = useState(0)
  const dpathRef = useRef([])
  const dstepRef = useRef(0)
  const ddirRef  = useRef(1)
  const ref      = useRef(null)

  useEffect(() => { ref.current?.focus() }, [])

  useEffect(() => {
    if(cfg.dragon&&maze.dragonWps.length>=2) {
      const p = bfs(maze.grid,rows,cols,maze.dragonWps[0],maze.dragonWps[1])
      dpathRef.current = p.length>1?p:[maze.dragonWps[0]]
      dstepRef.current=0; ddirRef.current=1
      setDragon({...maze.dragonWps[0]})
    } else setDragon(null)
  }, [maze])

  const move = useCallback((dx,dy) => {
    if(won) return
    const nx=pos.x+dx, ny=pos.y+dy
    if(nx<0||ny<0||nx>=cols||ny>=rows||maze.grid[ny][nx]===1) return
    if(dx>0)setDir('right'); else if(dx<0)setDir('left')
    else if(dy>0)setDir('down'); else setDir('up')
    setPos({x:nx,y:ny}); setMoves(m=>m+1)
  }, [won,pos,cols,rows,maze.grid])

  useEffect(() => {
    const h=e=>{
      const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
               w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}
      const v=m[e.key]; if(!v) return
      e.preventDefault(); move(v[0],v[1])
    }
    window.addEventListener('keydown',h)
    return ()=>window.removeEventListener('keydown',h)
  },[move])

  // Dragon bounce
  useEffect(() => {
    if(!cfg.dragon||won) return
    const speed = Math.max(350, 950-(level-2)*80)
    const iv = setInterval(() => {
      const path=dpathRef.current; if(!path||path.length<2) return
      dstepRef.current+=ddirRef.current
      if(dstepRef.current>=path.length-1){ddirRef.current=-1;dstepRef.current=path.length-2}
      if(dstepRef.current<=0){ddirRef.current=1;dstepRef.current=1}
      setDragon({...path[dstepRef.current]})
    }, speed)
    return ()=>clearInterval(iv)
  }, [cfg.dragon,won,level])

  // Collect + exit check
  useEffect(() => {
    const nc = maze.potions.filter(p=>p.x===pos.x&&p.y===pos.y&&!collected.includes(p.id))
    if(nc.length>0){
      setCollected(prev=>[...prev,...nc.map(p=>p.id)])
      setMood('excited'); setTimeout(()=>setMood('happy'),700)
    }
    const total = collected.length+nc.length
    if(pos.x===maze.exit.x&&pos.y===maze.exit.y&&total>=maze.potions.length) {
      setWon(true); setMood('excited')
      setTimeout(()=>onComplete({score:Math.max(1,maze.potions.length),total:Math.max(1,maze.potions.length)}),2000)
    }
  }, [pos]) // eslint-disable-line

  // Dragon collision
  useEffect(() => {
    if(!dragon||won) return
    if(dragon.x===pos.x&&dragon.y===pos.y) {
      const nl=lives-1; setLives(nl); setMood('encouraging')
      setPos({x:1,y:1}); setTimeout(()=>setMood('happy'),900)
      if(nl<=0) setTimeout(()=>onComplete({score:collected.length,total:maze.potions.length}),1200)
    }
  }, [dragon]) // eslint-disable-line

  const cellSize = Math.min(
    Math.floor(Math.min(typeof window!=='undefined'?window.innerWidth*0.95:400,680)/cols),
    Math.floor(500/rows), 38
  )
  const W=cols*cellSize, H=rows*cellSize
  const allDone = collected.length>=maze.potions.length
  const tileScale = cellSize/16  // tiles are 16x16 in tileset

  return (
    <div ref={ref} tabIndex={0} style={{
      flex:1,display:'flex',flexDirection:'column',alignItems:'center',
      padding:'8px',gap:'8px',outline:'none',
      touchAction:'none',overscrollBehavior:'none',
      background:'linear-gradient(180deg,#0a0814 0%,#130d1e 100%)',
      minHeight:'100%',userSelect:'none',
    }}>

      {/* WIN overlay */}
      <AnimatePresence>
        {won&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.75)',
              display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
            {['🌟','✨','⭐','🎉','💎','✨'].map((e,i)=>(
              <motion.span key={i} initial={{y:0,opacity:1,scale:0}}
                animate={{y:-(80+i*35),x:(i%2?1:-1)*(50+i*25),scale:[0,1.4,0],opacity:[1,1,0]}}
                transition={{duration:0.8,delay:i*0.08}} style={{position:'absolute',fontSize:32}}>{e}</motion.span>
            ))}
            <motion.div animate={{scale:[1,1.12,1]}} transition={{duration:0.6,repeat:3}} style={{fontSize:72}}>🏆</motion.div>
            <div style={{fontFamily:'var(--font-heading)',fontSize:26,fontWeight:900,color:'#FFD93D',textShadow:'0 0 20px #FFD93D88'}}>Geschafft!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
        {maze.potions.length>0&&(
          <div style={{background:'rgba(255,255,255,0.07)',borderRadius:12,padding:'5px 12px',
            display:'flex',gap:6,border:'1px solid rgba(255,255,255,0.12)'}}>
            {maze.potions.map(p=>(
              <motion.div key={p.id} animate={collected.includes(p.id)?{scale:[1,1.5,1]}:{}} transition={{duration:0.3}}
                style={{opacity:collected.includes(p.id)?1:0.25}}>
                <img src={spr(p.img)} style={{width:18,height:18,imageRendering:'pixelated'}} alt=""/>
              </motion.div>
            ))}
          </div>
        )}
        {cfg.dragon&&(
          <div style={{background:'rgba(255,255,255,0.07)',borderRadius:12,padding:'5px 10px',
            display:'flex',gap:3,border:'1px solid rgba(255,255,255,0.12)'}}>
            {[0,1,2].map(i=><span key={i} style={{fontSize:16,opacity:i<lives?1:0.2}}>❤️</span>)}
          </div>
        )}
        <div style={{background:'rgba(255,255,255,0.07)',borderRadius:12,padding:'5px 12px',
          fontFamily:'var(--font-heading)',fontSize:13,color:'rgba(255,255,255,0.6)',border:'1px solid rgba(255,255,255,0.12)'}}>
          👣 {moves}
        </div>
        {!allDone&&maze.potions.length>0&&(
          <div style={{background:'rgba(255,215,61,0.12)',borderRadius:12,padding:'5px 12px',
            fontFamily:'var(--font-heading)',fontSize:12,color:'#FFD93D',border:'1px solid rgba(255,215,61,0.25)'}}>
            Sammle alle Tränke! 🧪
          </div>
        )}
      </div>

      {/* Lumi */}
      <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',maxWidth:680}}>
        <LumiCharacter mood={mood} size={48}/>
        <div style={{flex:1,background:'rgba(255,255,255,0.07)',borderRadius:14,padding:'8px 14px',
          fontFamily:'var(--font-heading)',fontSize:'clamp(12px,2.5vw,15px)',color:'rgba(255,255,255,0.8)',
          border:'1px solid rgba(255,255,255,0.1)'}}>
          {won?'🎉 Fantastisch! Geschafft!'
            :allDone?'🚪 Zur Tür! Du hast alle Tränke!'
            :cfg.dragon?'Sammle alle 🧪 und meide den 🐲!'
            :'Finde die Tür! 🚪'}
        </div>
      </div>

      {/* Maze */}
      <div style={{
        position:'relative', width:W, height:H,
        border:'3px solid #3d1d6b',
        borderRadius:12,
        boxShadow:'0 0 30px rgba(100,50,200,0.4), inset 0 0 20px rgba(0,0,0,0.5)',
        overflow:'hidden', flexShrink:0,
        background:'#0a0814',
      }}>
        {maze.grid.map((row,y)=>row.map((cell,x)=>{
          const isExit = maze.exit.x===x&&maze.exit.y===y
          const potion = maze.potions.find(p=>p.x===x&&p.y===y&&!collected.includes(p.id))
          const hasTorch = maze.torches.has(`${x},${y}`)
          const tile = cell===1 ? TILE.wall : ((x+y)%2===0 ? TILE.floor : TILE.floor2)

          return (
            <div key={`${x}-${y}`} style={{
              position:'absolute', left:x*cellSize, top:y*cellSize,
              width:cellSize, height:cellSize, overflow:'hidden',
            }}>
              {/* Tile background */}
              <div style={{
                position:'absolute',inset:0,
                backgroundImage:`url(${spr('maze_tileset.png')})`,
                backgroundPosition:`${tile.x*tileScale}px ${tile.y*tileScale}px`,
                backgroundSize:`${448*tileScale}px ${320*tileScale}px`,
                imageRendering:'pixelated',
                filter: cell===1 ? 'brightness(0.7)' : 'brightness(0.55)',
              }}/>
              {/* Wall top shadow for depth */}
              {cell===1&&(
                <div style={{position:'absolute',inset:0,
                  background:'linear-gradient(180deg,rgba(0,0,0,0.4) 0%,transparent 40%)'}}/>
              )}
              {/* Exit door */}
              {isExit&&(
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:2}}
                  animate={allDone?{filter:['brightness(1)','brightness(2)','brightness(1)']}:{opacity:0.4}}
                  transition={{duration:1.2,repeat:Infinity}}>
                  <span style={{fontSize:cellSize*0.7,filter:allDone?'drop-shadow(0 0 8px #FFD700)':'none'}}>🚪</span>
                </motion.div>
              )}
              {/* Potion */}
              {potion&&(
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:2}}
                  animate={{y:[0,-2,0]}} transition={{duration:1.6,repeat:Infinity,ease:'easeInOut'}}>
                  <img src={spr(potion.img)} style={{width:cellSize*0.6,height:cellSize*0.6,
                    imageRendering:'pixelated',filter:'drop-shadow(0 0 5px #a78bfa)'}} alt=""/>
                </motion.div>
              )}
              {/* Torch */}
              {hasTorch&&<Torch size={Math.round(cellSize*0.75)}/>}
            </div>
          )
        }))}

        {/* Player */}
        <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:10,pointerEvents:'none'}}
          animate={{left:pos.x*cellSize,top:pos.y*cellSize}}
          transition={{type:'spring',stiffness:500,damping:30}}>
          <motion.span
            animate={{y:[0,-1.5,0]}} transition={{duration:1.1,repeat:Infinity,ease:'easeInOut'}}
            style={{fontSize:cellSize*0.72,display:'block',
              transform:dir==='left'?'scaleX(-1)':'none',
              filter:'drop-shadow(0 3px 6px rgba(180,120,255,0.7))'}}>
            🧙‍♂️
          </motion.span>
        </motion.div>

        {/* Dragon */}
        {dragon&&(
          <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:9,pointerEvents:'none'}}
            animate={{left:dragon.x*cellSize,top:dragon.y*cellSize}}
            transition={{type:'spring',stiffness:300,damping:28}}>
            <motion.span animate={{scale:[1,1.1,1]}} transition={{duration:0.9,repeat:Infinity}}
              style={{fontSize:cellSize*0.72,
                filter:'drop-shadow(0 0 8px rgba(255,120,0,0.8))'}}>
              🐲
            </motion.span>
          </motion.div>
        )}
      </div>

      {/* D-Pad */}
      <div style={{display:'grid',gridTemplateColumns:'64px 64px 64px',gridTemplateRows:'64px 64px 64px',gap:5}}>
        {[
          {l:'▲',dx:0,dy:-1,c:2,r:1},{l:'◀',dx:-1,dy:0,c:1,r:2},
          {l:'',dx:0,dy:0,c:2,r:2},  {l:'▶',dx:1,dy:0,c:3,r:2},
          {l:'▼',dx:0,dy:1,c:2,r:3},
        ].map(b=>(
          <motion.button key={b.l+b.c} whileTap={b.l?{scale:0.85}:{}}
            onClick={()=>b.l&&move(b.dx,b.dy)}
            style={{
              gridColumn:b.c,gridRow:b.r,borderRadius:14,
              background:b.l?'linear-gradient(135deg,#6d28d9,#4c1d95)':'transparent',
              color:'white',border:'none',
              fontSize:24,fontWeight:700,cursor:b.l?'pointer':'default',
              boxShadow:b.l?'0 4px 14px rgba(109,40,217,0.5)':'none',
              display:'flex',alignItems:'center',justifyContent:'center',
              width:64,height:64,
            }}>{b.l}</motion.button>
        ))}
      </div>
    </div>
  )
}
