import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const spr = (n) => BASE + 'sprites/maze/' + n

// ─── Maze Generator (DFS) ────────────────────────────────────────────────────
const DIRS = [
  { dx:0, dy:-2, wall:{dx:0,dy:-1} },
  { dx:2, dy:0,  wall:{dx:1,dy:0}  },
  { dx:0, dy:2,  wall:{dx:0,dy:1}  },
  { dx:-2,dy:0,  wall:{dx:-1,dy:0} },
]

function generateMaze(cols, rows) {
  const grid = Array.from({length:rows}, () => Array(cols).fill(1))
  function carve(x, y) {
    grid[y][x] = 0
    for (const d of [...DIRS].sort(() => Math.random()-.5)) {
      const nx=x+d.dx, ny=y+d.dy
      if (nx>0&&nx<cols-1&&ny>0&&ny<rows-1&&grid[ny][nx]===1) {
        grid[y+d.wall.dy][x+d.wall.dx] = 0
        carve(nx, ny)
      }
    }
  }
  carve(1,1)
  return grid
}

function bfs(grid, rows, cols, from, to) {
  if (!from||!to) return []
  const q=[[from]], vis=new Set([`${from.x},${from.y}`])
  while (q.length) {
    const path=q.shift(), {x,y}=path[path.length-1]
    if (x===to.x&&y===to.y) return path
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx=x+dx,ny=y+dy,k=`${nx},${ny}`
      if (nx>=0&&ny>=0&&nx<cols&&ny<rows&&grid[ny][nx]===0&&!vis.has(k)) {
        vis.add(k); q.push([...path,{x:nx,y:ny}])
      }
    }
  }
  return []
}

const LEVEL_CONFIG = [
  {cols:11,rows:11,potions:2,label:'Einfach',dragon:false},
  {cols:13,rows:13,potions:3,label:'Klein',dragon:true},
  {cols:15,rows:13,potions:3,label:'Mittel',dragon:true},
  {cols:15,rows:15,potions:4,label:'Mittel+',dragon:true},
  {cols:17,rows:15,potions:4,label:'Groß',dragon:true},
  {cols:19,rows:17,potions:5,label:'Groß+',dragon:true},
  {cols:21,rows:19,potions:5,label:'Riesig',dragon:true},
  {cols:23,rows:21,potions:6,label:'Riesig+',dragon:true},
  {cols:25,rows:23,potions:6,label:'Gigantisch',dragon:true},
  {cols:27,rows:25,potions:7,label:'Meister',dragon:true},
]

// Torch sprite: 128x16 = 8 frames horizontal, each 16x16
// We use CSS background-position animation
function TorchSprite({size}) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setFrame(f => (f+1)%8), 120)
    return () => clearInterval(iv)
  }, [])
  const scale = size / 16
  return (
    <div style={{
      width: size, height: size, overflow:'hidden', imageRendering:'pixelated',
    }}>
      <img src={spr('maze_torch.png')} alt=""
        style={{
          width: 128*scale, height: 16*scale,
          transform: `translateX(${-frame*16*scale}px)`,
          imageRendering:'pixelated',
        }}/>
    </div>
  )
}

// Coin sprite: 128x32 = 8 frames top row, each 16x16
function CoinSprite({size}) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setFrame(f => (f+1)%8), 100)
    return () => clearInterval(iv)
  }, [])
  const scale = size / 16
  return (
    <div style={{width:size,height:size,overflow:'hidden',imageRendering:'pixelated'}}>
      <img src={spr('maze_coin.png')} alt=""
        style={{
          width:128*scale, height:32*scale,
          transform:`translate(${-frame*16*scale}px, 0px)`,
          imageRendering:'pixelated',
        }}/>
    </div>
  )
}

// Water sprite: 128x32 = 8 frames, each 16x16
function WaterSprite({size}) {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const iv = setInterval(() => setFrame(f => (f+1)%8), 150)
    return () => clearInterval(iv)
  }, [])
  const scale = size / 16
  return (
    <div style={{width:size,height:size,overflow:'hidden',imageRendering:'pixelated'}}>
      <img src={spr('maze_water.png')} alt=""
        style={{
          width:128*scale, height:32*scale,
          transform:`translate(${-frame*16*scale}px, 0px)`,
          imageRendering:'pixelated',
        }}/>
    </div>
  )
}

const POTION_SPRITES = ['maze_potion1.png','maze_potion2.png','maze_potion3.png']
const POTION_COLORS = ['#FF6B6B','#74B9FF','#6BCB77']

export default function MazeGame({ level=1, onComplete }) {
  const cfg = LEVEL_CONFIG[Math.min(level-1, LEVEL_CONFIG.length-1)]
  const {cols, rows} = cfg

  const buildLevel = useCallback(() => {
    const grid = generateMaze(cols, rows)
    const start = {x:1,y:1}
    const exit  = {x:cols-2,y:rows-2}
    grid[exit.y][exit.x] = 0

    // Place potions (collectibles) on open cells away from start/exit
    const open = []
    for (let y=1;y<rows-1;y++) for (let x=1;x<cols-1;x++) {
      if (grid[y][x]===0) {
        const dS=Math.abs(x-1)+Math.abs(y-1), dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
        if (dS>4&&dE>4) open.push({x,y})
      }
    }
    open.sort(()=>Math.random()-.5)
    const potions = open.slice(0,cfg.potions).map((p,i)=>({
      ...p, id:`p${i}`, sprite:POTION_SPRITES[i%3], color:POTION_COLORS[i%3]
    }))

    // Torches: place on wall cells adjacent to floor, decoratively
    const torches = []
    for (let y=1;y<rows-1;y++) for (let x=1;x<cols-1;x++) {
      if (grid[y][x]===1) {
        // Adjacent to open path below
        if (y>0&&grid[y-1]&&grid[y-1][x]===0&&Math.random()<0.08) {
          torches.push({x,y})
        }
      }
    }

    // Dragon patrol segment on main path
    const mainPath = bfs(grid, rows, cols, start, exit)
    const segLen = Math.min(5, Math.max(3, Math.floor(mainPath.length*0.12)))
    const segStart = Math.floor(mainPath.length*0.35+Math.random()*mainPath.length*0.2)
    const segment = mainPath.slice(segStart, segStart+segLen)
    const dragonWps = segment.length>=2
      ? [segment[0], segment[segment.length-1]]
      : [{x:Math.floor(cols/2),y:Math.floor(rows/2)},{x:Math.floor(cols/2)+2,y:Math.floor(rows/2)}]

    return {grid, start, exit, potions, torches, dragonWps}
  }, [cols, rows, cfg.potions])

  const [maze,         setMaze]         = useState(buildLevel)
  const [playerPos,    setPlayerPos]    = useState({x:1,y:1})
  const [collected,    setCollected]    = useState([])
  const [won,          setWon]          = useState(false)
  const [mood,         setMood]         = useState('happy')
  const [direction,    setDirection]    = useState('right')
  const [dragonPos,    setDragonPos]    = useState(null)
  const [lives,        setLives]        = useState(3)
  const [moves,        setMoves]        = useState(0)
  const [showBoost,    setShowBoost]    = useState(false)  // potion collected effect
  const dragonPathRef  = useRef([])
  const dragonStepRef  = useRef(0)
  const dragonDirRef   = useRef(1) // 1=forward, -1=backward (bounce)
  const containerRef   = useRef(null)

  useEffect(() => { containerRef.current?.focus() }, [])

  useEffect(() => {
    if (cfg.dragon && maze.dragonWps.length>=2) {
      const path = bfs(maze.grid, rows, cols, maze.dragonWps[0], maze.dragonWps[1])
      dragonPathRef.current = path.length>1 ? path : [maze.dragonWps[0]]
      dragonStepRef.current = 0
      dragonDirRef.current = 1
      setDragonPos({...maze.dragonWps[0]})
    } else { setDragonPos(null) }
  }, [maze, cfg.dragon])

  const tryMove = useCallback((dx, dy) => {
    if (won) return
    const nx=playerPos.x+dx, ny=playerPos.y+dy
    if (nx<0||ny<0||nx>=cols||ny>=rows) return
    if (maze.grid[ny][nx]===1) return
    if (dx>0) setDirection('right')
    else if (dx<0) setDirection('left')
    else if (dy>0) setDirection('down')
    else setDirection('up')
    setPlayerPos({x:nx,y:ny})
    setMoves(m=>m+1)
  }, [won, playerPos, cols, rows, maze.grid])

  // Keyboard
  useEffect(() => {
    const h=(e)=>{
      const m={ArrowUp:'U',ArrowDown:'D',ArrowLeft:'L',ArrowRight:'R',w:'U',s:'D',a:'L',d:'R'}
      const dir=m[e.key]; if(!dir) return
      e.preventDefault()
      if(dir==='U')tryMove(0,-1); if(dir==='D')tryMove(0,1)
      if(dir==='L')tryMove(-1,0); if(dir==='R')tryMove(1,0)
    }
    window.addEventListener('keydown',h)
    return ()=>window.removeEventListener('keydown',h)
  },[tryMove])

  // Dragon patrol (bounce)
  useEffect(()=>{
    if(!cfg.dragon||won) return
    const speed=Math.max(350,950-(level-2)*80)
    const iv=setInterval(()=>{
      const path=dragonPathRef.current
      if(!path||path.length<2) return
      dragonStepRef.current+=dragonDirRef.current
      if(dragonStepRef.current>=path.length-1){dragonDirRef.current=-1;dragonStepRef.current=path.length-2}
      if(dragonStepRef.current<=0){dragonDirRef.current=1;dragonStepRef.current=1}
      setDragonPos({...path[dragonStepRef.current]})
    },speed)
    return ()=>clearInterval(iv)
  },[cfg.dragon,won,level])

  // Collect potions + check exit
  useEffect(()=>{
    const newC = maze.potions.filter(p=>p.x===playerPos.x&&p.y===playerPos.y&&!collected.includes(p.id))
    if(newC.length>0){
      setCollected(prev=>[...prev,...newC.map(p=>p.id)])
      setMood('excited'); setShowBoost(true)
      setTimeout(()=>{setMood('happy');setShowBoost(false)},800)
    }
    if(playerPos.x===maze.exit.x&&playerPos.y===maze.exit.y&&
       collected.length+newC.length>=maze.potions.length){
      setWon(true); setMood('excited')
      setTimeout(()=>onComplete({score:Math.max(1,maze.potions.length),total:Math.max(1,maze.potions.length)}),2000)
    }
  },[playerPos])// eslint-disable-line

  // Dragon collision
  useEffect(()=>{
    if(!dragonPos||won) return
    if(dragonPos.x===playerPos.x&&dragonPos.y===playerPos.y){
      const nl=lives-1; setLives(nl); setMood('encouraging')
      setPlayerPos({x:1,y:1})
      setTimeout(()=>setMood('happy'),900)
      if(nl<=0) setTimeout(()=>onComplete({score:collected.length,total:maze.potions.length}),1200)
    }
  },[dragonPos])// eslint-disable-line

  const cellSize = Math.min(
    Math.floor((typeof window!=='undefined'?Math.min(window.innerWidth*0.94,700):400)/cols),
    Math.floor(520/rows), 36
  )
  const totalW=cols*cellSize, totalH=rows*cellSize
  const allCollected=collected.length>=maze.potions.length

  // Determine wall/floor tile from Set 1.png (448x320, 28x20 tiles of 16x16)
  // We use CSS background to show specific tiles from the tileset
  // Floor tile: approximately col 1, row 1 in tileset = position (16,16)
  // Wall tile: col 0, row 0 = position (0,0) - dark stone
  const tilesetUrl = spr('maze_tileset.png')
  const tileScale = cellSize / 16

  return (
    <div ref={containerRef} tabIndex={0} style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(8px,2vw,20px) 8px', gap:'clamp(8px,1.5vw,14px)',
      outline:'none', touchAction:'none', overscrollBehavior:'none',
      background:'linear-gradient(180deg,#0d0d1a 0%,#1a1025 100%)',
      minHeight:'100%',
    }}>

      {/* WIN overlay */}
      <AnimatePresence>
        {won && (
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:'fixed',inset:0,zIndex:500,background:'rgba(0,0,0,0.7)',
              display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
            {['🌟','✨','⭐','🎉','💎','✨'].map((e,i)=>(
              <motion.span key={i}
                initial={{y:0,x:0,scale:0,opacity:1}}
                animate={{y:-(100+i*40),x:(i%2===0?1:-1)*(60+i*30),scale:[0,1.4,0],opacity:[1,1,0]}}
                transition={{duration:0.9,delay:i*0.08}}
                style={{position:'absolute',fontSize:36}}>{e}</motion.span>
            ))}
            <motion.div animate={{scale:[1,1.1,1]}} transition={{duration:0.6,repeat:3}}
              style={{fontSize:80}}>🏆</motion.div>
            <div style={{fontFamily:'var(--font-heading)',fontSize:28,fontWeight:900,color:'#FFD93D',
              textShadow:'0 0 20px rgba(255,217,61,0.8)'}}>Geschafft!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap',justifyContent:'center',width:'100%',maxWidth:700}}>
        {/* Potions */}
        <div style={{background:'rgba(255,255,255,0.08)',borderRadius:14,padding:'6px 14px',
          display:'flex',alignItems:'center',gap:6,border:'1.5px solid rgba(255,255,255,0.15)'}}>
          {maze.potions.map((p,i)=>(
            <motion.div key={p.id} animate={collected.includes(p.id)?{scale:[1,1.4,1]}:{}}
              transition={{duration:0.4}}
              style={{opacity:collected.includes(p.id)?1:0.3,filter:collected.includes(p.id)?`drop-shadow(0 0 6px ${p.color})`:'none'}}>
              <img src={spr(p.sprite)} style={{width:20,height:20,imageRendering:'pixelated'}} alt=""/>
            </motion.div>
          ))}
        </div>
        {/* Lives */}
        {cfg.dragon&&(
          <div style={{background:'rgba(255,255,255,0.08)',borderRadius:14,padding:'6px 12px',
            display:'flex',gap:4,border:'1.5px solid rgba(255,255,255,0.15)'}}>
            {[0,1,2].map(i=>(
              <span key={i} style={{fontSize:18,filter:i<lives?'none':'grayscale(1) opacity(0.3)'}}>❤️</span>
            ))}
          </div>
        )}
        {/* Moves */}
        <div style={{background:'rgba(255,255,255,0.08)',borderRadius:14,padding:'6px 14px',
          fontFamily:'var(--font-heading)',fontSize:14,color:'rgba(255,255,255,0.7)',
          border:'1.5px solid rgba(255,255,255,0.15)'}}>
          👣 {moves}
        </div>
        {/* Hint */}
        {!allCollected&&(
          <div style={{background:'rgba(255,215,61,0.15)',borderRadius:14,padding:'6px 14px',
            fontFamily:'var(--font-heading)',fontSize:13,color:'#FFD93D',
            border:'1.5px solid rgba(255,215,61,0.3)'}}>
            Sammle alle Tränke! 🧪
          </div>
        )}
      </div>

      {/* Lumi hint */}
      <div style={{display:'flex',alignItems:'flex-end',gap:8,width:'100%',maxWidth:700}}>
        <LumiCharacter mood={mood} size={56}/>
        <div style={{flex:1,background:'rgba(255,255,255,0.09)',borderRadius:'18px 18px 18px 4px',
          padding:'10px 16px',fontFamily:'var(--font-heading)',fontSize:'clamp(13px,2.5vw,16px)',
          color:'rgba(255,255,255,0.85)',border:'1.5px solid rgba(255,255,255,0.12)'}}>
          {won?'🎉 Fantastisch! Du hast die Zauberhöhle bezwungen!'
            :allCollected?'🚪 Zur Tür! Du hast alle Tränke!'
            :cfg.dragon?'Sammle alle 🧪 Tränke und meide den 🐲 Drachen!'
            :'Sammle alle 🧪 Tränke und finde die Tür!'}
        </div>
      </div>

      {/* Maze */}
      <div style={{
        borderRadius:16, overflow:'hidden',
        border:'3px solid rgba(100,80,200,0.5)',
        boxShadow:'0 0 40px rgba(100,80,200,0.3)',
        flexShrink:0,
        position:'relative',
        width:totalW, height:totalH,
        background:'#0a0814',
      }}>
        {maze.grid.map((row,y)=>row.map((cell,x)=>{
          const isExit=maze.exit.x===x&&maze.exit.y===y
          const potion=maze.potions.find(p=>p.x===x&&p.y===y&&!collected.includes(p.id))
          const isTorch=cell===1&&maze.torches.some(t=>t.x===x&&t.y===y)
          const isPlayer=playerPos.x===x&&playerPos.y===y

          return (
            <div key={`${x}-${y}`} style={{
              position:'absolute', left:x*cellSize, top:y*cellSize,
              width:cellSize, height:cellSize,
              overflow:'hidden', zIndex:isPlayer?4:1,
            }}>
              {cell===1 ? (
                // Wall: use tileset stone tile (top-left of Set 1.png = dark stone)
                <div style={{
                  width:'100%',height:'100%',
                  backgroundImage:`url(${tilesetUrl})`,
                  backgroundPosition:`${-0*tileScale*16}px ${-0*tileScale*16}px`,
                  backgroundSize:`${448*tileScale}px ${320*tileScale}px`,
                  imageRendering:'pixelated',
                }}/>
              ) : (
                // Floor: slightly different stone tile
                <div style={{
                  width:'100%',height:'100%',
                  backgroundImage:`url(${tilesetUrl})`,
                  backgroundPosition:`${-3*tileScale*16}px ${-1*tileScale*16}px`,
                  backgroundSize:`${448*tileScale}px ${320*tileScale}px`,
                  imageRendering:'pixelated',
                  filter:'brightness(0.7)',
                }}/>
              )}
              {/* Exit portal */}
              {isExit&&(
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}
                  animate={allCollected?{filter:['brightness(1)','brightness(1.5)','brightness(1)']}:{filter:'brightness(0.5)'}}
                  transition={{duration:1,repeat:Infinity}}>
                  <span style={{fontSize:cellSize*0.7}}>🚪</span>
                </motion.div>
              )}
              {/* Potion */}
              {potion&&(
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center'}}
                  animate={{y:[0,-2,0]}} transition={{duration:1.5,repeat:Infinity,ease:'easeInOut'}}>
                  <img src={spr(potion.sprite)} style={{width:cellSize*0.65,height:cellSize*0.65,imageRendering:'pixelated',
                    filter:`drop-shadow(0 0 4px ${potion.color})`}} alt=""/>
                </motion.div>
              )}
              {/* Torch on wall */}
              {isTorch&&(
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',
                  zIndex:2}}>
                  <TorchSprite size={Math.round(cellSize*0.7)}/>
                </div>
              )}
            </div>
          )
        }))}

        {/* Player */}
        <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:5}}
          animate={{left:playerPos.x*cellSize,top:playerPos.y*cellSize}}
          transition={{type:'spring',stiffness:450,damping:28}}>
          <motion.span
            animate={won?{scale:[1,1.4,1]}:{y:[0,-1,0]}}
            transition={won?{duration:0.5,repeat:Infinity}:{duration:1.2,repeat:Infinity}}
            style={{fontSize:cellSize*0.72,display:'inline-block',
              transform:direction==='left'?'scaleX(-1)':'scaleX(1)',
              filter:'drop-shadow(0 2px 6px rgba(200,150,255,0.6))'}}>
            🧙‍♂️
          </motion.span>
          {showBoost&&(
            <motion.span initial={{y:0,opacity:1,scale:1}} animate={{y:-20,opacity:0,scale:1.5}}
              transition={{duration:0.6}} style={{position:'absolute',top:0,fontSize:16}}>✨</motion.span>
          )}
        </motion.div>

        {/* Dragon */}
        {dragonPos&&(
          <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:4}}
            animate={{left:dragonPos.x*cellSize,top:dragonPos.y*cellSize}}
            transition={{type:'spring',stiffness:280,damping:26}}>
            <motion.span animate={{scale:[1,1.08,1]}} transition={{duration:0.8,repeat:Infinity}}
              style={{fontSize:cellSize*0.72,filter:'drop-shadow(0 0 8px rgba(255,100,0,0.7))'}}>
              🐲
            </motion.span>
          </motion.div>
        )}
      </div>

      {/* D-Pad */}
      <div style={{display:'grid',gridTemplateColumns:'70px 70px 70px',gridTemplateRows:'70px 70px 70px',gap:6}}>
        {[
          {label:'▲',dx:0,dy:-1,col:2,row:1},
          {label:'◀',dx:-1,dy:0,col:1,row:2},
          {label:'',dx:0,dy:0,col:2,row:2},
          {label:'▶',dx:1,dy:0,col:3,row:2},
          {label:'▼',dx:0,dy:1,col:2,row:3},
        ].map(btn=>(
          <motion.button key={btn.label+btn.col}
            whileHover={btn.dx!==0||btn.dy!==0?{scale:1.12}:{}}
            whileTap={btn.dx!==0||btn.dy!==0?{scale:0.88}:{}}
            onClick={()=>tryMove(btn.dx,btn.dy)}
            style={{
              gridColumn:btn.col,gridRow:btn.row,
              borderRadius:16,
              background:btn.dx===0&&btn.dy===0?'transparent':'linear-gradient(135deg,#7c3aed,#4c1d95)',
              color:'white',border:'none',
              fontFamily:'var(--font-heading)',fontSize:26,fontWeight:700,
              cursor:btn.dx===0&&btn.dy===0?'default':'pointer',
              boxShadow:btn.dx!==0||btn.dy!==0?'0 4px 16px rgba(124,58,237,0.5)':'none',
              display:'flex',alignItems:'center',justifyContent:'center',
              width:70,height:70,
            }}
          >{btn.label}</motion.button>
        ))}
      </div>
    </div>
  )
}
