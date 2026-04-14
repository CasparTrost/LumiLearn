import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const spr = (n) => BASE + 'sprites/maze/' + n

// ── Tileset: Set 1.png (448x320, 16x16 tiles, 28 cols x 20 rows) ─────────────
// Wall tiles: context-aware (Wang tile system)
// W = wall tile when surrounded, WT = wall-top (floor below), FLOOR = walkable
const TW = {
  wallTop:  [4, 10],
  wallFill: [6, 10],
  wallH:    [5, 10],
  wallL:    [4,  8],
  wallR:    [12, 8],
  cornerTL: [12,11],
  cornerTR: [13,11],
  floor:    [9, 12],
  floor2:   [9, 12],
  floor3:   [9, 12],
  floor4:   [9, 12],
  door:     [11,11],
  vase:     [2, 12],
}

// CSS for tileset background
function tbg(col, row, ts) {
  return {
    backgroundImage: `url(${spr('maze_tileset.png')})`,
    backgroundPosition: `${-col*16*ts}px ${-row*16*ts}px`,
    backgroundSize: `${448*ts}px ${320*ts}px`,
    imageRendering: 'pixelated',
  }
}

// Smart wall tile: based on neighbors
function wallTile(x, y, g, rows, cols) {
  const U = y > 0       && g[y-1] && g[y-1][x] === 1
  const D = y < rows-1  && g[y+1] && g[y+1][x] === 1
  const L = x > 0       && g[y][x-1] === 1
  const R = x < cols-1  && g[y][x+1] === 1

  // Top face: wall with open floor below (most visible wall)
  if (!D) return TW.wallTop
  // Left edge only
  if (!L && R && !D) return TW.wallL
  if (!L && R && D)  return TW.wallL
  // Right edge only
  if (L && !R && D)  return TW.wallR
  // Corner top-left (open left, open above)
  if (!L && !U && R && D) return TW.cornerTL
  // Corner top-right (open right, open above)
  if (L && !U && !R && D) return TW.cornerTR
  // Horizontal wall (open above and below → horizontal stripe)
  if (!U && !D) return TW.wallH
  // Interior fill
  return TW.wallFill
}

// Floor tile: always the same clean tile
function floorTile(x, y) {
  return TW.floor
}

// ── DFS Maze Generator ────────────────────────────────────────────────────────
function genMaze(cols, rows) {
  const g = Array.from({length:rows}, () => Array(cols).fill(1))
  function carve(x, y) {
    g[y][x] = 0
    for (const {dx,dy} of [{dx:0,dy:-2},{dx:2,dy:0},{dx:0,dy:2},{dx:-2,dy:0}].sort(()=>Math.random()-.5)) {
      const nx=x+dx, ny=y+dy
      if (nx>0&&nx<cols-1&&ny>0&&ny<rows-1&&g[ny][nx]===1) { g[y+dy/2][x+dx/2]=0; carve(nx,ny) }
    }
  }
  carve(1,1)
  return g
}

function bfs(g, rows, cols, from, to) {
  if (!from||!to) return []
  const q=[[from]], vis=new Set([`${from.x},${from.y}`])
  while(q.length) {
    const path=q.shift(), {x,y}=path[path.length-1]
    if(x===to.x&&y===to.y) return path
    for (const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]) {
      const nx=x+dx,ny=y+dy,k=`${nx},${ny}`
      if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&g[ny][nx]===0&&!vis.has(k)){vis.add(k);q.push([...path,{x:nx,y:ny}])}
    }
  }
  return []
}

const LEVELS = [
  {cols:9, rows:9, potions:0,dragon:false},
  {cols:11,rows:11,potions:2,dragon:true},
  {cols:13,rows:11,potions:2,dragon:true},
  {cols:13,rows:13,potions:3,dragon:true},
  {cols:15,rows:13,potions:3,dragon:true},
  {cols:15,rows:15,potions:4,dragon:true},
  {cols:17,rows:15,potions:4,dragon:true},
  {cols:19,rows:17,potions:5,dragon:true},
  {cols:21,rows:19,potions:5,dragon:true},
  {cols:23,rows:21,potions:6,dragon:true},
]
const POTS = ['maze_potion1.png','maze_potion2.png','maze_potion3.png']

// CSS keyframe for torch — NO React state, pure CSS animation
const TORCH_CSS = `
@keyframes torch-anim {
  0%   {transform:translateX(0)}
  12%  {transform:translateX(calc(-1 * var(--fw)))}
  25%  {transform:translateX(calc(-2 * var(--fw)))}
  37%  {transform:translateX(calc(-3 * var(--fw)))}
  50%  {transform:translateX(calc(-4 * var(--fw)))}
  62%  {transform:translateX(calc(-5 * var(--fw)))}
  75%  {transform:translateX(calc(-6 * var(--fw)))}
  87%  {transform:translateX(calc(-7 * var(--fw)))}
  100% {transform:translateX(0)}
}
`

function Torch({ size }) {
  return (
    <div style={{position:'absolute',bottom:2,left:'50%',marginLeft:`-${size/2}px`,
      width:size,height:size,pointerEvents:'none',zIndex:3}}>
      <img src={spr('maze_torch.gif')} alt=""
        style={{width:size,height:size,imageRendering:'pixelated',display:'block'}}/>
    </div>
  )
}

export default function MazeGame({ level=1, onComplete }) {
  const cfg = LEVELS[Math.min(level-1,LEVELS.length-1)]
  const {cols,rows} = cfg

  const cellSize = Math.min(
    Math.floor((typeof window!=='undefined'?Math.min(window.innerWidth-16,640):400)/cols),
    Math.floor(460/rows), 44
  )
  const ts = cellSize/16
  const W=cols*cellSize, H=rows*cellSize

  const build = useCallback(()=>{
    const g = genMaze(cols,rows)
    const start={x:1,y:1}, exit={x:cols-2,y:rows-2}
    g[exit.y][exit.x]=0

    // Torches: walls that have floor below
    const torches = new Set()
    for(let y=0;y<rows-1;y++) for(let x=1;x<cols-1;x++)
      if(g[y][x]===1&&g[y+1][x]===0&&Math.random()<0.14) torches.add(`${x},${y}`)

    // Vases: occasional floor decoration
    const vases = new Set()
    for(let y=2;y<rows-2;y++) for(let x=2;x<cols-2;x++) {
      const dS=Math.abs(x-1)+Math.abs(y-1), dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
      if(g[y][x]===0&&dS>4&&dE>4&&Math.random()<0.03) vases.add(`${x},${y}`)
    }

    // Potions
    const open=[]
    for(let y=1;y<rows-1;y++) for(let x=1;x<cols-1;x++){
      if(g[y][x]===0&&!vases.has(`${x},${y}`)){
        const dS=Math.abs(x-1)+Math.abs(y-1),dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
        if(dS>5&&dE>5) open.push({x,y})
      }
    }
    open.sort(()=>Math.random()-.5)
    const potions=open.slice(0,cfg.potions).map((p,i)=>({...p,id:`p${i}`,img:POTS[i%3]}))

    // Dragon
    const mainPath=bfs(g,rows,cols,start,exit)
    const segLen=Math.max(3,Math.min(6,Math.floor(mainPath.length*0.12)))
    const segStart=Math.floor(mainPath.length*0.35+Math.random()*mainPath.length*0.2)
    const seg=mainPath.slice(segStart,segStart+segLen)
    const dragonWps=seg.length>=2?[seg[0],seg[seg.length-1]]:[]

    return {g,start,exit,torches,vases,potions,dragonWps}
  },[cols,rows,cfg.potions])

  const [maze,setMaze]=useState(build)
  const [pos,setPos]=useState({x:1,y:1})
  const [coll,setColl]=useState([])
  const [won,setWon]=useState(false)
  const [mood,setMood]=useState('happy')
  const [facing,setFacing]=useState(1)
  const [moving,setMoving]=useState(false)
  const moveTimerRef=useRef(null)
  const [dragon,setDragon]=useState(null)
  const [lives,setLives]=useState(3)
  const [moves,setMoves]=useState(0)
  const dpRef=useRef([]),dsRef=useRef(0),ddRef=useRef(1)
  const ref=useRef(null)

  useEffect(()=>{ref.current?.focus()},[])

  useEffect(()=>{
    if(cfg.dragon&&maze.dragonWps.length>=2){
      const p=bfs(maze.g,rows,cols,maze.dragonWps[0],maze.dragonWps[1])
      dpRef.current=p.length>1?p:[maze.dragonWps[0]]
      dsRef.current=0;ddRef.current=1;setDragon({...maze.dragonWps[0]})
    } else setDragon(null)
  },[maze])

  const move=useCallback((dx,dy)=>{
    if(won) return
    const nx=pos.x+dx,ny=pos.y+dy
    if(nx<0||ny<0||nx>=cols||ny>=rows||maze.g[ny][nx]===1) return
    if(dx>0)setFacing(1);else if(dx<0)setFacing(-1)
    setPos({x:nx,y:ny});setMoves(m=>m+1)
    setMoving(true)
    if(moveTimerRef.current) clearTimeout(moveTimerRef.current)
    moveTimerRef.current=setTimeout(()=>setMoving(false),300)
  },[won,pos,cols,rows,maze.g])

  useEffect(()=>{
    const h=e=>{
      const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}
      const v=m[e.key];if(!v)return;e.preventDefault();move(v[0],v[1])
    }
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[move])

  useEffect(()=>{
    if(!cfg.dragon||won)return
    const speed=Math.max(320,920-(level-2)*75)
    const iv=setInterval(()=>{
      const p=dpRef.current;if(!p||p.length<2)return
      dsRef.current+=ddRef.current
      if(dsRef.current>=p.length-1){ddRef.current=-1;dsRef.current=p.length-2}
      if(dsRef.current<=0){ddRef.current=1;dsRef.current=1}
      setDragon({...p[dsRef.current]})
    },speed)
    return()=>clearInterval(iv)
  },[cfg.dragon,won,level])

  useEffect(()=>{
    const nc=maze.potions.filter(p=>p.x===pos.x&&p.y===pos.y&&!coll.includes(p.id))
    if(nc.length){setColl(prev=>[...prev,...nc.map(p=>p.id)]);setMood('excited');setTimeout(()=>setMood('happy'),700)}
    if(pos.x===maze.exit.x&&pos.y===maze.exit.y&&coll.length+nc.length>=maze.potions.length){
      setWon(true);setMood('excited')
      setTimeout(()=>onComplete({score:Math.max(1,maze.potions.length),total:Math.max(1,maze.potions.length)}),2000)
    }
  },[pos]) // eslint-disable-line

  useEffect(()=>{
    if(!dragon||won)return
    if(dragon.x===pos.x&&dragon.y===pos.y){
      const nl=lives-1;setLives(nl);setMood('encouraging');setPos({x:1,y:1})
      setTimeout(()=>setMood('happy'),900)
      if(nl<=0)setTimeout(()=>onComplete({score:coll.length,total:maze.potions.length}),1200)
    }
  },[dragon]) // eslint-disable-line

  const allDone=coll.length>=maze.potions.length

  return (
    <div ref={ref} tabIndex={0} style={{
      flex:1,display:'flex',flexDirection:'column',alignItems:'center',
      gap:'clamp(6px,1.5vw,10px)',padding:'8px',
      outline:'none',touchAction:'none',overscrollBehavior:'none',
      background:'radial-gradient(ellipse at 50% 20%,#1e0a3c 0%,#080412 100%)',
      minHeight:'100%',userSelect:'none',
    }}>

      <AnimatePresence>
        {won&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}}
            style={{position:'fixed',inset:0,zIndex:999,background:'rgba(8,4,18,0.88)',
              display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
            {['💎','✨','🌟','⭐','💫','✨','🌟'].map((e,i)=>(
              <motion.span key={i} initial={{opacity:1,scale:0,y:0}}
                animate={{y:-(80+i*28),x:(i%2?1:-1)*(45+i*20),scale:[0,1.5,0],opacity:[1,1,0]}}
                transition={{duration:0.85,delay:i*0.07}}
                style={{position:'absolute',fontSize:26,top:'50%',left:'50%'}}>{e}</motion.span>
            ))}
            <motion.div animate={{scale:[1,1.1,1]}} transition={{duration:0.7,repeat:Infinity}}
              style={{fontSize:76}}>🏆</motion.div>
            <div style={{fontFamily:'var(--font-heading)',fontSize:28,fontWeight:900,color:'#d8b4fe',
              textShadow:'0 0 30px #9333ea'}}>Geschafft!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'center',width:'100%',maxWidth:W+16}}>
        {maze.potions.length>0&&(
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
        {cfg.dragon&&(
          <div style={{background:'rgba(88,28,135,0.3)',borderRadius:12,padding:'5px 10px',
            display:'flex',gap:3,border:'1px solid rgba(168,85,247,0.4)'}}>
            {[0,1,2].map(i=><span key={i} style={{fontSize:15,opacity:i<lives?1:0.12}}>❤️</span>)}
          </div>
        )}
        <div style={{background:'rgba(88,28,135,0.3)',borderRadius:12,padding:'5px 10px',
          fontFamily:'var(--font-heading)',fontSize:13,color:'#d8b4fe',
          border:'1px solid rgba(168,85,247,0.4)'}}>👣 {moves}</div>
        {!allDone&&maze.potions.length>0&&(
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
        position:'relative',width:W,height:H,flexShrink:0,
        border:'3px solid #6b21a8',borderRadius:10,overflow:'hidden',
        boxShadow:'0 0 0 1px #9333ea55,0 0 50px rgba(147,51,234,0.3),0 12px 50px rgba(0,0,0,0.7)',
      }}>
        <div style={{position:'absolute',inset:0,zIndex:30,pointerEvents:'none',
          background:'radial-gradient(ellipse at 50% 50%,transparent 30%,rgba(0,0,0,0.5) 100%)'}}/>

        {maze.g.map((row,y)=>row.map((cell,x)=>{
          const isExit=maze.exit.x===x&&maze.exit.y===y
          const potion=maze.potions.find(p=>p.x===x&&p.y===y&&!coll.includes(p.id))
          const hasTorch=maze.torches.has(`${x},${y}`)
          const hasVase=maze.vases.has(`${x},${y}`)&&!potion&&!isExit
          const wallInfo = cell===1 ? wallTile(x,y,maze.g,rows,cols) : null
          const isVert = wallInfo === 'vert'
          const [tc,tr] = isVert ? TW.wallFill : (cell===1 ? wallInfo : floorTile(x,y))

          return (
            <div key={`${x}-${y}`} style={{position:'absolute',left:x*cellSize,top:y*cellSize,
              width:cellSize,height:cellSize,overflow:'hidden'}}>
              {/* Base tile */}
              {isVert ? (
                <img src={spr('maze_wall_vert.png')} alt=""
                  style={{position:'absolute',inset:0,width:'100%',height:'100%',
                    imageRendering:'pixelated',filter:'brightness(0.75) saturate(0.85)'}}/>
              ) : (
                <div style={{position:'absolute',inset:0,...tbg(tc,tr,ts),
                  filter:cell===1?'brightness(0.65) saturate(0.85)':'brightness(0.55) saturate(0.7)'}}/>
              )}
              {/* Wall atmosphere */}
              {cell===1&&(
                <div style={{position:'absolute',inset:0,background:'rgba(67,20,120,0.3)'}}/>
              )}
              {/* Torch warm glow on floor */}
              {cell===0&&y>0&&maze.torches.has(`${x},${y-1}`)&&(
                <div style={{position:'absolute',inset:0,
                  background:'radial-gradient(ellipse at 50% 0%,rgba(255,150,30,0.22) 0%,transparent 80%)'}}/>
              )}
              {/* Exit */}
              {isExit&&(
                <motion.div style={{position:'absolute',inset:0,zIndex:5}}
                  animate={allDone?{opacity:[0.8,1,0.8]}:{opacity:0.4}}
                  transition={{duration:1.5,repeat:Infinity}}>
                  <div style={{width:'100%',height:'100%',...tbg(TW.door[0],TW.door[1],ts),
                    filter:allDone?'brightness(1.6) drop-shadow(0 0 10px #e879f9) saturate(1.4)':'brightness(0.6)'}}/>
                </motion.div>
              )}
              {/* Potion */}
              {potion&&(
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:5}}
                  animate={{y:[0,-2.5,0]}} transition={{duration:1.8,repeat:Infinity,ease:'easeInOut'}}>
                  <img src={spr(potion.img)} style={{width:cellSize*0.6,height:cellSize*0.6,
                    imageRendering:'pixelated',filter:'drop-shadow(0 0 6px #c084fc)'}} alt=""/>
                </motion.div>
              )}
              {/* Vase */}
              {hasVase&&(
                <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:4}}>
                  <div style={{width:cellSize*0.65,height:cellSize*0.65,...tbg(TW.vase[0],TW.vase[1],ts*0.65),filter:'brightness(0.75)'}}/>
                </div>
              )}
              {/* Torch - pure CSS, no React state flicker */}
              {hasTorch&&<Torch size={Math.round(cellSize*0.72)}/>}
            </div>
          )
        }))}

        {/* Player - Knight */}
        <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:20,pointerEvents:'none'}}
          animate={{left:pos.x*cellSize,top:pos.y*cellSize}}
          transition={{type:'spring',stiffness:500,damping:32}}>
          <img
            key={moving?'walk':'idle'}
            src={spr(moving?'maze_knight_walk.gif':'maze_knight_idle.gif')}
            alt="Ritter"
            style={{
              width:cellSize*0.9, height:cellSize*0.9,
              transform:`scaleX(${facing})`,
              imageRendering:'pixelated',
              filter:'drop-shadow(0 3px 8px rgba(192,132,252,0.9))',
            }}
          />
        </motion.div>

        {/* Dragon */}
        {dragon&&(
          <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:18,pointerEvents:'none'}}
            animate={{left:dragon.x*cellSize,top:dragon.y*cellSize}}
            transition={{type:'spring',stiffness:320,damping:28}}>
            <motion.span animate={{scale:[1,1.09,1]}} transition={{duration:0.9,repeat:Infinity}}
              style={{fontSize:cellSize*0.72,lineHeight:1,
                filter:'drop-shadow(0 0 12px rgba(251,146,60,0.95))'}}>
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
              boxShadow:b.l?'0 4px 16px rgba(147,51,234,0.5),inset 0 1px 0 rgba(255,255,255,0.1)':'none',
              display:'flex',alignItems:'center',justifyContent:'center',
              width:68,height:68,
            }}>{b.l}</motion.button>
        ))}
      </div>
    </div>
  )
}
