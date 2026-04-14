import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const spr = (n) => BASE + 'sprites/maze/' + n

const MAZE_GRID = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,1,0],
  [1,0,0,0,0,1,0,1,0,1,0,1,0,1,1,0,0,1,0,0,0,0,0,1,0,1,0,0,0,0,1,0],
  [1,1,1,1,0,0,0,1,0,1,1,1,0,1,1,0,0,0,0,1,1,1,0,0,0,1,1,1,1,1,1,0],
  [0,0,1,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,1,1,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,1,0,1,0],
  [0,1,1,1,1,1,0,1,1,1,1,1,1,1,0,0,0,1,1,1,0,0,0,1,1,0,0,1,1,0,1,0],
  [0,1,1,1,1,1,0,1,1,1,1,1,1,1,0,0,0,1,1,1,1,0,0,1,0,0,1,1,1,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,1,1,1,1,0,0,0,1,0],
  [0,1,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,1,0,1,0,1,0,1,0,0,0,1,1,0,0,0,0,0,0,0,1,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,0,1,0,1,1,1,1,0,0,1,1,0,0,0,0,0,1,0,1,1,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0],
  [0,1,0,0,1,1,0,1,0,0,1,1,1,1,1,0,0,1,0,0,0,1,1,0,1,0,0,0,0,0,1,0],
  [0,1,0,0,1,1,0,1,0,0,1,1,1,1,1,0,0,0,0,0,0,1,0,0,1,0,1,1,1,1,1,0],
  [0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,1,1,1,1,0],
  [0,0,0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,1,0],
  [0,1,1,1,0,0,1,1,0,1,0,1,0,1,0,1,0,1,0,1,0,0,1,0,1,1,0,0,0,0,1,0],
  [0,1,1,1,0,0,1,1,1,1,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,0,0,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,1,1,0,0,0,0,1,1,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1,1,0,0,1,1,0,0,0,1,0,0,1,1,0],
  [0,1,0,0,0,0,0,0,0,1,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,1,0,0,1,0,0],
  [0,1,0,0,1,1,1,1,1,1,0,1,1,1,1,0,0,1,0,0,0,0,1,0,0,0,1,1,1,1,1,0],
  [0,1,0,0,1,1,1,1,1,0,0,1,1,1,1,0,0,0,0,1,1,1,0,1,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
]
const GRID_ROWS = 32, GRID_COLS = 32, CELL = 32
const IMG_SIZE = 1024

const isWalk = (c,r) => c>=0&&r>=0&&c<GRID_COLS&&r<GRID_ROWS&&MAZE_GRID[r][c]===0

const POT_SPOTS = [{"x":5,"y":5},{"x":20,"y":8},{"x":8,"y":20},{"x":25,"y":15},{"x":15,"y":25},{"x":12,"y":12}]

export default function MazeGame({ level=1, onComplete }) {
  const [pos,setPos]=useState({"x":0,"y":0})
  const [coll,setColl]=useState([])
  const [won,setWon]=useState(false)
  const [mood,setMood]=useState('happy')
  const [lives,setLives]=useState(3)
  const [moves,setMoves]=useState(0)
  const [dragon,setDragon]=useState(null)
  const dpRef=useRef([]),dsRef=useRef(0),ddRef=useRef(1)
  const ref=useRef(null)
  const EXIT={"x":31,"y":30}
  const potions=POT_SPOTS.filter(p=>isWalk(p.x,p.y)).slice(0,Math.min(level+1,5))

  useEffect(()=>{
    ref.current?.focus()
    if(level>=2){
      const path=[]
      for(let c=5;c<GRID_COLS-5;c++) if(isWalk(c,Math.floor(GRID_ROWS/2))) path.push({"x":c,"y":Math.floor(GRID_ROWS/2)})
      if(path.length>2){dpRef.current=path.slice(0,10);setDragon(path[0])}
    }
  },[])

  const move=useCallback((dx,dy)=>{
    if(won)return
    const nx=pos.x+dx,ny=pos.y+dy
    if(!isWalk(nx,ny))return
    setPos({x:nx,y:ny});setMoves(m=>m+1)
  },[won,pos])

  useEffect(()=>{
    const h=e=>{
      const m={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],w:[0,-1],s:[0,1],a:[-1,0],d:[1,0]}
      const v=m[e.key];if(!v)return;e.preventDefault();move(v[0],v[1])
    }
    window.addEventListener('keydown',h);return()=>window.removeEventListener('keydown',h)
  },[move])

  useEffect(()=>{
    if(level<2||won||dpRef.current.length<2)return
    const spd=Math.max(350,900-(level-2)*80)
    const iv=setInterval(()=>{
      dsRef.current+=ddRef.current
      if(dsRef.current>=dpRef.current.length-1){ddRef.current=-1;dsRef.current=dpRef.current.length-2}
      if(dsRef.current<=0){ddRef.current=1;dsRef.current=1}
      setDragon({...dpRef.current[dsRef.current]})
    },spd)
    return()=>clearInterval(iv)
  },[level,won])

  useEffect(()=>{
    const nc=potions.filter(p=>p.x===pos.x&&p.y===pos.y&&!coll.some(c=>c.x===p.x&&c.y===p.y))
    if(nc.length){setColl(prev=>[...prev,...nc]);setMood('excited');setTimeout(()=>setMood('happy'),700)}
    if(pos.x===EXIT.x&&pos.y===EXIT.y&&coll.length+nc.length>=potions.length){
      setWon(true);setMood('excited')
      setTimeout(()=>onComplete({score:Math.max(1,potions.length),total:Math.max(1,potions.length)}),2000)
    }
  },[pos])

  useEffect(()=>{
    if(!dragon||won)return
    if(dragon.x===pos.x&&dragon.y===pos.y){
      const nl=lives-1;setLives(nl);setMood('encouraging')
      setPos({"x":0,"y":0})
      setTimeout(()=>setMood('happy'),900)
      if(nl<=0)setTimeout(()=>onComplete({score:coll.length,total:potions.length}),1200)
    }
  },[dragon])

  const dispSize = typeof window!=='undefined'?Math.min(window.innerWidth-16,window.innerHeight-260,480):400
  const sc = dispSize/IMG_SIZE
  const allDone = coll.length>=potions.length

  return (
    <div ref={ref} tabIndex={0} style={{
      flex:1,display:'flex',flexDirection:'column',alignItems:'center',
      padding:'8px',gap:'8px',outline:'none',touchAction:'none',
      background:'#0a1e04',minHeight:'100%',userSelect:'none',
    }}>
      <AnimatePresence>{won&&(<motion.div initial={{opacity:0}} animate={{opacity:1}}
        style={{position:'fixed',inset:0,zIndex:999,background:'rgba(0,0,0,0.8)',
          display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16}}>
        <motion.div animate={{scale:[1,1.1,1]}} transition={{duration:0.7,repeat:Infinity}} style={{fontSize:76}}>🏆</motion.div>
        <div style={{fontFamily:'var(--font-heading)',fontSize:28,fontWeight:900,color:'#76c442'}}>Geschafft!</div>
      </motion.div>)}</AnimatePresence>

      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',justifyContent:'center'}}>
        <div style={{background:'rgba(76,175,80,0.2)',borderRadius:12,padding:'5px 10px',display:'flex',gap:5,border:'1px solid rgba(76,175,80,0.4)'}}>
          {potions.map((p,i)=>(<motion.span key={i} style={{fontSize:18,opacity:coll.some(c=>c.x===p.x&&c.y===p.y)?1:0.25}}>🧪</motion.span>))}
        </div>
        {level>=2&&<div style={{background:'rgba(76,175,80,0.2)',borderRadius:12,padding:'5px 10px',display:'flex',gap:3,border:'1px solid rgba(76,175,80,0.4)'}}>{"❤️".repeat(lives)}</div>}
        <div style={{background:'rgba(76,175,80,0.2)',borderRadius:12,padding:'5px 10px',fontFamily:'var(--font-heading)',fontSize:13,color:'#b5e853',border:'1px solid rgba(76,175,80,0.4)'}}>👣 {moves}</div>
      </div>

      <div style={{display:'flex',alignItems:'center',gap:8,width:'100%',maxWidth:dispSize}}>
        <LumiCharacter mood={mood} size={44}/>
        <div style={{flex:1,background:'rgba(76,175,80,0.15)',borderRadius:12,padding:'7px 12px',
          fontFamily:'var(--font-heading)',fontSize:'clamp(11px,2vw,14px)',color:'#b5e853',
          border:'1px solid rgba(76,175,80,0.3)'}}>
          {won?'🎉 Geschafft!':allDone?'🚪 Zum Ausgang!':level>=2?'Sammle 🧪 und meide 🐲!':'Finde den Ausgang! 🚪'}
        </div>
      </div>

      <div style={{position:'relative',width:dispSize,height:dispSize,flexShrink:0,
        border:'3px solid #2d7a0a',borderRadius:10,overflow:'hidden',
        boxShadow:'0 0 30px rgba(76,175,80,0.3)'}}>
        <img src={spr('maze_bg.png')} alt="" style={{width:'100%',height:'100%',display:'block',imageRendering:'auto'}}/>
        <div style={{position:'absolute',inset:0,pointerEvents:'none'}}>
          {potions.map((p,i)=>!coll.some(c=>c.x===p.x&&c.y===p.y)&&(
            <motion.div key={i} style={{position:'absolute',
              left:`${(p.x*CELL+CELL/4)*sc}px`,top:`${(p.y*CELL+CELL/4)*sc}px`,
              width:`${CELL*sc*0.6}px`,height:`${CELL*sc*0.6}px`,zIndex:2}}
              animate={{y:[0,-3,0]}} transition={{duration:1.8,repeat:Infinity}}>
              <span style={{fontSize:`${CELL*sc*0.5}px`}}>🧪</span>
            </motion.div>
          ))}
          {dragon&&level>=2&&(
            <motion.div style={{position:'absolute',zIndex:3,
              width:`${CELL*sc*1.4}px`,height:`${CELL*sc*1.4}px`}}
              animate={{left:`${dragon.x*CELL*sc}px`,top:`${dragon.y*CELL*sc}px`}}
              transition={{type:'spring',stiffness:280,damping:26}}>
              <span style={{fontSize:`${CELL*sc*1.1}px`,filter:'drop-shadow(0 0 8px rgba(255,120,0,0.9))'}}>🐲</span>
            </motion.div>
          )}
          <motion.div style={{position:'absolute',zIndex:5,
            width:`${CELL*sc*3.5}px`}}
            animate={{left:`${(pos.x*CELL-CELL*0.5)*sc}px`,top:`${(pos.y*CELL-CELL*0.8)*sc}px`}}
            transition={{type:'spring',stiffness:500,damping:32}}>
            <img src={spr('maze_knight_idle.gif')} alt="" style={{width:'100%',height:'auto',imageRendering:'pixelated'}}/>
          </motion.div>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'repeat(3,68px)',gridTemplateRows:'repeat(3,68px)',gap:5,flexShrink:0}}>
        {[{l:'▲',dx:0,dy:-1,c:2,r:1},{l:'◀',dx:-1,dy:0,c:1,r:2},{l:'',dx:0,dy:0,c:2,r:2},{l:'▶',dx:1,dy:0,c:3,r:2},{l:'▼',dx:0,dy:1,c:2,r:3}].map(b=>(
          <motion.button key={b.l||'c'} whileTap={b.l?{scale:0.82}:{}} onClick={()=>b.l&&move(b.dx,b.dy)}
            style={{gridColumn:b.c,gridRow:b.r,borderRadius:14,
              background:b.l?'linear-gradient(135deg,#2d7a0a,#1a4a06)':'transparent',
              color:'#b5e853',border:b.l?'2px solid #4CAF50':'none',
              fontSize:24,fontWeight:900,cursor:b.l?'pointer':'default',
              boxShadow:b.l?'0 4px 16px rgba(76,175,80,0.5)':'none',
              display:'flex',alignItems:'center',justifyContent:'center',width:68,height:68}}>{b.l}</motion.button>
        ))}
      </div>
    </div>
  )
}
