import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const spr = (n) => BASE + 'sprites/maze/' + n

// ─── Tileset constants (Set 1.png = 448x320, 16x16 tiles) ───────────────────
// bgPos = (-col*16*scale, -row*16*scale)  then scale via backgroundSize
const TILES = {
  wall:   { col:0, row:3 },   // solid dark stone block
  floor:  { col:0, row:0 },   // light grid floor
  floor2: { col:0, row:6 },   // light squares variant
  floor3: { col:5, row:12 },  // stone symbols variant
}

// ─── DFS Maze ────────────────────────────────────────────────────────────────
function generateMaze(cols, rows) {
  const g = Array.from({length:rows}, ()=>Array(cols).fill(1))
  function carve(x,y) {
    g[y][x]=0
    for(const {dx,dy} of [{dx:0,dy:-2},{dx:2,dy:0},{dx:0,dy:2},{dx:-2,dy:0}].sort(()=>Math.random()-.5)) {
      const nx=x+dx,ny=y+dy
      if(nx>0&&nx<cols-1&&ny>0&&ny<rows-1&&g[ny][nx]===1){g[y+dy/2][x+dx/2]=0;carve(nx,ny)}
    }
  }
  carve(1,1); return g
}

function bfs(g,rows,cols,from,to) {
  if(!from||!to) return []
  const q=[[from]],vis=new Set([`${from.x},${from.y}`])
  while(q.length){
    const p=q.shift(),{x,y}=p[p.length-1]
    if(x===to.x&&y===to.y) return p
    for(const [dx,dy] of [[0,-1],[1,0],[0,1],[-1,0]]){
      const nx=x+dx,ny=y+dy,k=`${nx},${ny}`
      if(nx>=0&&ny>=0&&nx<cols&&ny<rows&&g[ny][nx]===0&&!vis.has(k)){vis.add(k);q.push([...p,{x:nx,y:ny}])}
    }
  }
  return []
}

// Level config — cells sized to fit screen nicely
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

// Torch animation (128x16, 8 frames horizontal)
function Torch({size}) {
  const [f,setF]=useState(0)
  useEffect(()=>{const iv=setInterval(()=>setF(p=>(p+1)%8),110);return()=>clearInterval(iv)},[])
  const s=size/16
  return (
    <div style={{position:'absolute',bottom:1,left:'50%',transform:'translateX(-50%)',
      width:size,height:size,overflow:'hidden',imageRendering:'pixelated',pointerEvents:'none',zIndex:3}}>
      <img src={spr('maze_torch.png')} alt=""
        style={{width:128*s,height:16*s,transform:`translateX(${-f*16*s}px)`,imageRendering:'pixelated',display:'block'}}/>
    </div>
  )
}

// Water animation (128x32, 8 frames horizontal, 16x16 each)
function Water({size}) {
  const [f,setF]=useState(0)
  useEffect(()=>{const iv=setInterval(()=>setF(p=>(p+1)%8),140);return()=>clearInterval(iv)},[])
  const s=size/16
  return (
    <div style={{position:'absolute',inset:0,overflow:'hidden',imageRendering:'pixelated',zIndex:2}}>
      <img src={spr('maze_water.png')} alt=""
        style={{width:128*s,height:32*s,transform:`translateX(${-f*16*s}px)`,imageRendering:'pixelated',display:'block'}}/>
    </div>
  )
}

export default function MazeGame({ level=1, onComplete }) {
  const cfg = LEVELS[Math.min(level-1,LEVELS.length-1)]
  const {cols,rows}=cfg

  // Cell size: fit screen width with some padding
  const cellSize = Math.min(
    Math.floor((typeof window!=='undefined'?Math.min(window.innerWidth-24,640):400)/cols),
    Math.floor(440/rows),
    42
  )
  const W=cols*cellSize, H=rows*cellSize
  const ts=cellSize/16  // tileset scale

  const build = useCallback(()=>{
    const g=generateMaze(cols,rows)
    const start={x:1,y:1}, exit={x:cols-2,y:rows-2}
    g[exit.y][exit.x]=0

    // Water hazards: random floor cells (not near start/exit)
    const waterCells=new Set()
    for(let y=1;y<rows-1;y++) for(let x=1;x<cols-1;x++) {
      if(g[y][x]===0){
        const dS=Math.abs(x-1)+Math.abs(y-1),dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
        if(dS>4&&dE>4&&Math.random()<0.06) waterCells.add(`${x},${y}`)
      }
    }

    // Torches on wall cells that have floor below
    const torchCells=new Set()
    for(let y=0;y<rows-1;y++) for(let x=0;x<cols;x++) {
      if(g[y][x]===1&&y+1<rows&&g[y+1][x]===0&&Math.random()<0.10)
        torchCells.add(`${x},${y}`)
    }

    // Potions
    const open=[]
    for(let y=1;y<rows-1;y++) for(let x=1;x<cols-1;x++) {
      if(g[y][x]===0&&!waterCells.has(`${x},${y}`)){
        const dS=Math.abs(x-1)+Math.abs(y-1),dE=Math.abs(x-(cols-2))+Math.abs(y-(rows-2))
        if(dS>5&&dE>5) open.push({x,y})
      }
    }
    open.sort(()=>Math.random()-.5)
    const POTS=['maze_potion1.png','maze_potion2.png','maze_potion3.png']
    const potions=open.slice(0,cfg.potions).map((p,i)=>({...p,id:`p${i}`,img:POTS[i%3]}))

    // Dragon patrol on main path
    const mainPath=bfs(g,rows,cols,start,exit)
    const segLen=Math.max(3,Math.min(6,Math.floor(mainPath.length*0.12)))
    const segStart=Math.floor(mainPath.length*0.35+Math.random()*mainPath.length*0.2)
    const seg=mainPath.slice(segStart,segStart+segLen)
    const dragonWps=seg.length>=2?[seg[0],seg[seg.length-1]]:[]

    return {g,start,exit,waterCells,torchCells,potions,dragonWps}
  },[cols,rows,cfg.potions])

  const [maze,setMaze]=useState(build)
  const [pos,setPos]=useState({x:1,y:1})
  const [coll,setColl]=useState([])
  const [won,setWon]=useState(false)
  const [mood,setMood]=useState('happy')
  const [facing,setFacing]=useState(1) // 1=right, -1=left
  const [dragon,setDragon]=useState(null)
  const [lives,setLives]=useState(3)
  const [moves,setMoves]=useState(0)
  const [stunned,setStunned]=useState(false) // water stun
  const dpRef=useRef([]),dsRef=useRef(0),ddRef=useRef(1)
  const ref=useRef(null)

  useEffect(()=>{ref.current?.focus()},[])

  useEffect(()=>{
    if(cfg.dragon&&maze.dragonWps.length>=2){
      const p=bfs(maze.g,rows,cols,maze.dragonWps[0],maze.dragonWps[1])
      dpRef.current=p.length>1?p:[maze.dragonWps[0]]
      dsRef.current=0;ddRef.current=1
      setDragon({...maze.dragonWps[0]})
    } else setDragon(null)
  },[maze])

  const move=useCallback((dx,dy)=>{
    if(won||stunned) return
    const nx=pos.x+dx,ny=pos.y+dy
    if(nx<0||ny<0||nx>=cols||ny>=rows||maze.g[ny][nx]===1) return
    if(dx>0)setFacing(1); else if(dx<0)setFacing(-1)
    setPos({x:nx,y:ny}); setMoves(m=>m+1)
    // Water: stun briefly
    if(maze.waterCells.has(`${nx},${ny}`)){
      setStunned(true); setMood('encouraging')
      setTimeout(()=>{setStunned(false);setMood('happy')},800)
    }
  },[won,stunned,pos,cols,rows,maze.g,maze.waterCells])

  useEffect(()=>{
    const h=e=>{
      const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],
               w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}
      const v=m[e.key];if(!v)return;e.preventDefault();move(v[0],v[1])
    }
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[move])

  useEffect(()=>{
    if(!cfg.dragon||won)return
    const speed=Math.max(300,900-(level-2)*75)
    const iv=setInterval(()=>{
      const p=dpRef.current;if(!p||p.length<2)return
      dsRef.current+=ddRef.current
      if(dsRef.current>=p.length-1){ddRef.current=-1;dsRef.current=p.length-2}
      if(dsRef.current<=0){ddRef.current=1;dsRef.current=1}
      setDragon({...p[dsRef.current]})
    },speed)
    return()=>clearInterval(iv)
  },[cfg.dragon,won,level])

  // Collect & exit
  useEffect(()=>{
    const nc=maze.potions.filter(p=>p.x===pos.x&&p.y===pos.y&&!coll.includes(p.id))
    if(nc.length){setColl(prev=>[...prev,...nc.map(p=>p.id)]);setMood('excited');setTimeout(()=>setMood('happy'),700)}
    if(pos.x===maze.exit.x&&pos.y===maze.exit.y&&coll.length+nc.length>=maze.potions.length){
      setWon(true);setMood('excited')
      setTimeout(()=>onComplete({score:Math.max(1,maze.potions.length),total:Math.max(1,maze.potions.length)}),2000)
    }
  },[pos]) // eslint-disable-line

  // Dragon hit
  useEffect(()=>{
    if(!dragon||won)return
    if(dragon.x===pos.x&&dragon.y===pos.y){
      const nl=lives-1;setLives(nl);setMood('encouraging');setPos({x:1,y:1})
      setTimeout(()=>setMood('happy'),900)
      if(nl<=0)setTimeout(()=>onComplete({score:coll.length,total:maze.potions.length}),1200)
    }
  },[dragon]) // eslint-disable-line

  const allDone=coll.length>=maze.potions.length

  // Tile bgPos helper
  const tileBg=(col,row)=>({
    backgroundImage:`url(${spr('maze_tileset.png')})`,
    backgroundPosition:`${-col*16*ts}px ${-row*16*ts}px`,
    backgroundSize:`${448*ts}px ${320*ts}px`,
    imageRendering:'pixelated',
  })

  // Pick floor variant per cell
  const floorTile=(x,y)=>{
    const h=(x*31+y*17)%20
    if(h<14) return TILES.floor
    if(h<17) return TILES.floor2
    return TILES.floor3
  }

  return (
    <div ref={ref} tabIndex={0} style={{
      flex:1,display:'flex',flexDirection:'column',alignItems:'center',
      gap:'clamp(6px,1.5vw,12px)',padding:'8px',
      outline:'none',touchAction:'none',overscrollBehavior:'none',
      background:'radial-gradient(ellipse at 50% 30%,#1a0a2e 0%,#0a0514 70%)',
      minHeight:'100%',userSelect:'none',
    }}>

      {/* WIN */}
      <AnimatePresence>
        {won&&(
          <motion.div initial={{opacity:0}} animate={{opacity:1}}
            style={{position:'fixed',inset:0,zIndex:999,background:'rgba(10,5,20,0.85)',
              display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
            {['💎','✨','🌟','⭐','💫','✨','🌟'].map((e,i)=>(
              <motion.span key={i} initial={{y:0,opacity:1,scale:0}}
                animate={{y:-(90+i*30),x:(i%2?1:-1)*(40+i*22),scale:[0,1.5,0],opacity:[1,1,0]}}
                transition={{duration:0.9,delay:i*0.07}} style={{position:'absolute',fontSize:28,top:'50%',left:'50%'}}>{e}</motion.span>
            ))}
            <motion.div animate={{scale:[1,1.1,1],rotate:[0,5,-5,0]}} transition={{duration:0.7,repeat:Infinity}}
              style={{fontSize:80}}>🏆</motion.div>
            <div style={{fontFamily:'var(--font-heading)',fontSize:28,fontWeight:900,color:'#e9d5ff',
              textShadow:'0 0 30px #a855f7,0 0 60px #7c3aed'}}>Geschafft!</div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* HUD */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'center',width:'100%',maxWidth:W+20}}>
        {maze.potions.length>0&&(
          <div style={{background:'rgba(139,92,246,0.15)',borderRadius:12,padding:'5px 10px',
            display:'flex',gap:5,border:'1px solid rgba(139,92,246,0.3)'}}>
            {maze.potions.map(p=>(
              <motion.div key={p.id} animate={coll.includes(p.id)?{scale:[1,1.6,1]}:{}} transition={{duration:0.3}}
                style={{opacity:coll.includes(p.id)?1:0.2,filter:coll.includes(p.id)?'drop-shadow(0 0 6px #a78bfa)':'none'}}>
                <img src={spr(p.img)} style={{width:20,height:20,imageRendering:'pixelated',display:'block'}} alt=""/>
              </motion.div>
            ))}
          </div>
        )}
        {cfg.dragon&&(
          <div style={{background:'rgba(139,92,246,0.15)',borderRadius:12,padding:'5px 10px',
            display:'flex',gap:3,border:'1px solid rgba(139,92,246,0.3)'}}>
            {[0,1,2].map(i=><span key={i} style={{fontSize:15,opacity:i<lives?1:0.15}}>❤️</span>)}
          </div>
        )}
        <div style={{background:'rgba(139,92,246,0.15)',borderRadius:12,padding:'5px 10px',
          fontFamily:'var(--font-heading)',fontSize:13,color:'#c4b5fd',
          border:'1px solid rgba(139,92,246,0.3)'}}>👣 {moves}</div>
        {!allDone&&maze.potions.length>0&&(
          <div style={{background:'rgba(250,204,21,0.1)',borderRadius:12,padding:'5px 10px',
            fontFamily:'var(--font-heading)',fontSize:12,color:'#fde68a',
            border:'1px solid rgba(250,204,21,0.25)'}}>🧪 Sammle alle Tränke!</div>
        )}
      </div>

      {/* Lumi */}
      <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',maxWidth:W+20}}>
        <LumiCharacter mood={stunned?'encouraging':mood} size={44}/>
        <div style={{flex:1,background:'rgba(139,92,246,0.12)',borderRadius:12,padding:'7px 12px',
          fontFamily:'var(--font-heading)',fontSize:'clamp(11px,2.2vw,14px)',color:'#e9d5ff',
          border:'1px solid rgba(139,92,246,0.25)'}}>
          {won?'🎉 Fantastisch, du hast es geschafft!'
            :stunned?'💦 Ups! Wasser verlangsamt dich!'
            :allDone?'🚪 Zur Tür! Du hast alle Tränke!'
            :cfg.dragon?'Sammle 🧪 und meide den 🐲!'
            :'Finde den Ausgang! 🚪'}
        </div>
      </div>

      {/* Maze grid */}
      <div style={{
        position:'relative',width:W,height:H,flexShrink:0,
        border:'3px solid #4c1d95',borderRadius:10,overflow:'hidden',
        boxShadow:'0 0 0 1px #7c3aed44, 0 0 40px rgba(124,58,237,0.35), 0 10px 40px rgba(0,0,0,0.6)',
      }}>
        {/* Ambient overlay */}
        <div style={{position:'absolute',inset:0,zIndex:20,pointerEvents:'none',
          background:'radial-gradient(ellipse at 50% 50%,transparent 40%,rgba(0,0,0,0.45) 100%)'}}/>

        {maze.g.map((row,y)=>row.map((cell,x)=>{
          const isExit=maze.exit.x===x&&maze.exit.y===y
          const potion=maze.potions.find(p=>p.x===x&&p.y===y&&!coll.includes(p.id))
          const hasTorch=maze.torchCells.has(`${x},${y}`)
          const hasWater=cell===0&&maze.waterCells.has(`${x},${y}`)
          const ft=cell===1?TILES.wall:floorTile(x,y)

          return (
            <div key={`${x}-${y}`} style={{
              position:'absolute',left:x*cellSize,top:y*cellSize,
              width:cellSize,height:cellSize,overflow:'hidden',
            }}>
              {/* Base tile */}
              <div style={{
                position:'absolute',inset:0,
                ...tileBg(ft.col,ft.row),
                filter:cell===1?'brightness(0.55) saturate(0.7)':'brightness(0.5) saturate(0.6)',
              }}/>
              {/* Wall: purple tint + top edge darkening */}
              {cell===1&&<>
                <div style={{position:'absolute',inset:0,background:'rgba(67,20,100,0.45)',mixBlendMode:'multiply'}}/>
                <div style={{position:'absolute',top:0,left:0,right:0,height:'35%',
                  background:'linear-gradient(180deg,rgba(0,0,0,0.6) 0%,transparent 100%)'}}/>
              </>}
              {/* Floor: subtle glow */}
              {cell===0&&!hasWater&&(
                <div style={{position:'absolute',inset:0,background:'rgba(100,60,180,0.08)'}}/>
              )}
              {/* Water */}
              {hasWater&&<Water size={cellSize}/>}
              {/* Exit */}
              {isExit&&(
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:4}}
                  animate={allDone
                    ?{filter:['drop-shadow(0 0 8px #a855f7)','drop-shadow(0 0 20px #e879f9)','drop-shadow(0 0 8px #a855f7)']}
                    :{opacity:0.35}}
                  transition={{duration:1.5,repeat:Infinity}}>
                  <span style={{fontSize:cellSize*0.72}}>🚪</span>
                </motion.div>
              )}
              {/* Potion */}
              {potion&&(
                <motion.div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',zIndex:4}}
                  animate={{y:[0,-2.5,0]}} transition={{duration:1.8,repeat:Infinity,ease:'easeInOut'}}>
                  <img src={spr(potion.img)} style={{width:cellSize*0.58,height:cellSize*0.58,
                    imageRendering:'pixelated',filter:'drop-shadow(0 0 6px #a78bfa) drop-shadow(0 0 12px #7c3aed)'}} alt=""/>
                </motion.div>
              )}
              {/* Torch */}
              {hasTorch&&<Torch size={Math.round(cellSize*0.7)}/>}
              {/* Torch glow on floor below */}
              {cell===0&&y>0&&maze.torchCells.has(`${x},${y-1}`)&&(
                <div style={{position:'absolute',inset:0,
                  background:'radial-gradient(ellipse at 50% 0%,rgba(255,180,50,0.25) 0%,transparent 70%)',
                  pointerEvents:'none'}}/>
              )}
            </div>
          )
        }))}

        {/* Player */}
        <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
          display:'flex',alignItems:'center',justifyContent:'center',zIndex:15,pointerEvents:'none'}}
          animate={{left:pos.x*cellSize,top:pos.y*cellSize}}
          transition={{type:'spring',stiffness:480,damping:32}}>
          <motion.div
            animate={stunned
              ?{opacity:[1,0.3,1,0.3,1],scale:[1,0.9,1]}
              :{y:[0,-2,0]}}
            transition={stunned?{duration:0.8}:{duration:1.2,repeat:Infinity}}
            style={{fontSize:cellSize*0.70,lineHeight:1,
              transform:`scaleX(${facing})`,display:'block',
              filter:'drop-shadow(0 3px 8px rgba(168,85,247,0.8)) drop-shadow(0 1px 2px rgba(0,0,0,0.8))'}}>
            🧙‍♂️
          </motion.div>
        </motion.div>

        {/* Dragon */}
        {dragon&&(
          <motion.div style={{position:'absolute',width:cellSize,height:cellSize,
            display:'flex',alignItems:'center',justifyContent:'center',zIndex:14,pointerEvents:'none'}}
            animate={{left:dragon.x*cellSize,top:dragon.y*cellSize}}
            transition={{type:'spring',stiffness:320,damping:28}}>
            <motion.div animate={{scale:[1,1.08,1]}} transition={{duration:0.85,repeat:Infinity}}
              style={{fontSize:cellSize*0.70,lineHeight:1,
                filter:'drop-shadow(0 0 10px rgba(251,146,60,0.9)) drop-shadow(0 2px 4px rgba(0,0,0,0.8))'}}>
              🐲
            </motion.div>
          </motion.div>
        )}
      </div>

      {/* D-Pad */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,64px)',gridTemplateRows:'repeat(3,64px)',gap:4}}>
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
              color:'#e9d5ff',border:b.l?'2px solid #a855f7':'none',
              fontSize:22,fontWeight:900,cursor:b.l?'pointer':'default',
              boxShadow:b.l?'0 4px 16px rgba(168,85,247,0.45),inset 0 1px 0 rgba(255,255,255,0.15)':'none',
              display:'flex',alignItems:'center',justifyContent:'center',
              width:64,height:64,transition:'all 0.1s',
            }}>{b.l}</motion.button>
        ))}
      </div>
    </div>
  )
}
