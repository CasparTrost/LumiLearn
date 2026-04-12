import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const spr = (n) => BASE + 'sprites/farm/' + n

// Web Audio
let _ac = null
function getAc() {
  if (typeof window === 'undefined') return null
  try {
    if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)()
    if (_ac.state === 'suspended') _ac.resume()
    return _ac
  } catch { return null }
}
function tone(f, type, t0, dur, vol = 0.14) {
  const ac = getAc(); if (!ac) return
  try {
    const o = ac.createOscillator(), g = ac.createGain()
    o.connect(g); g.connect(ac.destination)
    o.type = type; o.frequency.setValueAtTime(f, t0)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.start(t0); o.stop(t0 + dur + 0.05)
  } catch {}
}
const sfx = {
  moo()   { const ac=getAc();if(!ac)return;const t=ac.currentTime;tone(130,'sine',t,.5,.2);tone(110,'sine',t+.2,.4,.1) },
  baa()   { const ac=getAc();if(!ac)return;const t=ac.currentTime;tone(220,'sine',t,.3,.18);tone(190,'sine',t+.15,.25,.12) },
  cluck() { const ac=getAc();if(!ac)return;const t=ac.currentTime;[0,.07,.14].forEach(d=>tone(650+Math.random()*150,'square',t+d,.06,.1)) },
  oink()  { const ac=getAc();if(!ac)return;const t=ac.currentTime;tone(280,'sawtooth',t,.15,.18);tone(220,'sawtooth',t+.1,.2,.12) },
  chime() { const ac=getAc();if(!ac)return;const t=ac.currentTime;[523,659,784,1047].forEach((f,i)=>tone(f,'sine',t+i*.08,.2,.13)) },
}

// Animated player using sprite sheet
function PlayerSprite({ scale = 2 }) {
  const canvasRef = useRef(null)
  const timerRef  = useRef(null)
  const frameRef  = useRef(0)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const img = new window.Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.imageSmoothingEnabled = false
      if (timerRef.current) clearInterval(timerRef.current)
      timerRef.current = setInterval(() => {
        if (!canvasRef.current) return
        try {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          ctx.drawImage(img, frameRef.current * 48, 48, 48, 48, 0, 0, canvas.width, canvas.height)
          frameRef.current = (frameRef.current + 1) % 4
        } catch {}
      }, 180)
    }
    img.onerror = () => {}
    img.src = spr('f_player.png')
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])
  return <canvas ref={canvasRef} width={48*scale} height={48*scale} style={{ imageRendering:'pixelated', display:'block' }} />
}

function getLevel(n) {
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=12) return 4; if (n<=16) return 5; return 6
}
const LABELS  = ['','Kleiner Hof','Wachsender Hof','Bluehender Hof','Grosser Hof','Praechtiger Hof','Traumhof!']
const NEXT_AT = [0,3,6,9,13,17,Infinity]
const SKY_TOP    = ['','#4a90d9','#3a82d0','#2a6ec4','#1a5ab8','#0d48a0','#072878']
const SKY_BOTTOM = ['','#a8d8f8','#8ec8f5','#6aacec','#4892e0','#2870cc','#1050aa']

function Sparkle({ x, y }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, pointerEvents:'none', zIndex:50 }}>
      {['*','x','+'].map((c,i) => (
        <motion.div key={i} initial={{opacity:1,x:0,y:0,scale:1}} animate={{opacity:0,x:(i-1)*24,y:-40,scale:1.8}}
          transition={{duration:.65,delay:i*.06}}
          style={{position:'absolute',color:'#FFD93D',fontSize:16,fontFamily:'monospace',fontWeight:'bold'}}>
          {c}
        </motion.div>
      ))}
    </div>
  )
}

function Animal({ src, x, y, w, h, sfxFn, onSpark, delay=0, flip=false, label }) {
  const [bounce, setBounce] = useState(false)
  const handleClick = () => {
    try { sfxFn() } catch {}
    setBounce(true); setTimeout(()=>setBounce(false),700)
    if (onSpark) onSpark(x+w/2, y+h)
  }
  return (
    <motion.div initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}}
      transition={{type:'spring',stiffness:260,delay}}
      style={{position:'absolute',left:x,bottom:y,width:w,height:h,cursor:'pointer',zIndex:15}}
      onClick={handleClick} title={label}>
      <motion.img src={src} alt={label}
        style={{width:'100%',height:'100%',objectFit:'contain',imageRendering:'pixelated',
          transform:flip?'scaleX(-1)':'none',
          filter:'drop-shadow(2px 6px 4px rgba(0,0,0,0.35))'}}
        animate={bounce?{y:[0,-22,0,-10,0],scale:[1,1.2,1]}:{y:[0,-4,0]}}
        transition={bounce?{duration:.55,type:'spring'}:{duration:2+delay*.5,repeat:Infinity,ease:'easeInOut'}}/>
    </motion.div>
  )
}

export default function FarmProgress({ completedCount:rawCount=0, totalModules=17 }) {
  const completedCount = rawCount  // set to 17 to preview max level
  const level = getLevel(completedCount)
  const show  = (min) => level >= min
  const [spark, setSpark] = useState(null)
  const doSpark = useCallback((x,y,id) => {
    setSpark({x,y,key:Date.now()+id})
    setTimeout(()=>setSpark(null),900)
  },[])

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? (NEXT_AT[level]-completedCount)+' bis naechstes Level'
    : 'Max Level!'

  const pct = Math.round((completedCount/totalModules)*100)

  return (
    <div style={{width:'100%',maxWidth:640,margin:'0 auto',userSelect:'none',
      borderRadius:20,overflow:'hidden',
      boxShadow:'0 12px 40px rgba(0,0,0,0.25)'}}>

      {/* ── SCENE ── */}
      <div style={{position:'relative',height:280,overflow:'hidden'}}>

        {/* Sky — gradient that shifts with level */}
        <div style={{position:'absolute',inset:0,zIndex:0,
          background:`linear-gradient(180deg, ${SKY_TOP[level]} 0%, ${SKY_BOTTOM[level]} 55%, #7ec850 55%, #5aa020 65%, #4a8a15 65%, #3a7010 100%)`,
          transition:'background 1s ease'}}/>

        {/* Sun */}
        <motion.div animate={{rotate:360}} transition={{duration:22,repeat:Infinity,ease:'linear'}}
          style={{position:'absolute',top:14,right:24,zIndex:2,pointerEvents:'none',
            width:44,height:44,borderRadius:'50%',
            background:'radial-gradient(circle,#fff9a0,#FFD93D)',
            boxShadow:'0 0 0 6px rgba(255,220,50,.3), 0 0 0 14px rgba(255,220,50,.15), 0 0 30px rgba(255,210,0,.5)'}}/>

        {/* Clouds */}
        {[
          {delay:0, y:16, w:90, op:.95, dur:18},
          {delay:7, y:34, w:60, op:.75, dur:25},
          {delay:14,y:22, w:75, op:.85, dur:21},
        ].map((cl,i)=>(
          <motion.div key={i}
            animate={{x:['0%','115%']}} initial={{x:`${-20-i*15}%`}}
            transition={{duration:cl.dur,repeat:Infinity,ease:'linear',delay:cl.delay}}
            style={{position:'absolute',top:cl.y,left:0,zIndex:2,pointerEvents:'none'}}>
            <svg width={cl.w} height={36} viewBox={`0 0 ${cl.w} 36`}>
              <ellipse cx={cl.w*.5} cy={26} rx={cl.w*.46} ry={14} fill={`rgba(255,255,255,${cl.op})`}/>
              <ellipse cx={cl.w*.38} cy={18} rx={cl.w*.28} ry={14} fill={`rgba(255,255,255,${cl.op})`}/>
              <ellipse cx={cl.w*.62} cy={20} rx={cl.w*.24} ry={12} fill={`rgba(255,255,255,${cl.op*.9})`}/>
            </svg>
          </motion.div>
        ))}

        {/* Rolling hills background */}
        <svg viewBox="0 0 640 100" preserveAspectRatio="none"
          style={{position:'absolute',bottom:90,left:0,width:'100%',height:100,zIndex:3,pointerEvents:'none'}}>
          <path d="M0,80 Q80,20 160,60 Q240,90 320,40 Q400,0 480,50 Q560,90 640,60 L640,100 L0,100 Z" fill="#5aa020"/>
          <path d="M0,90 Q100,50 200,75 Q300,95 400,60 Q500,30 640,70 L640,100 L0,100 Z" fill="#6ab828"/>
        </svg>

        {/* Tile-based ground */}
        <img src={spr('f_scene_bg.png')} alt=
          style={{position:'absolute',bottom:0,left:0,width:'100%',height:192,
            objectFit:'cover',objectPosition:'bottom',zIndex:4,imageRendering:'pixelated',
            pointerEvents:'none'}}/>

        {/* ── HOUSE ── */}
        <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} transition={{type:'spring',stiffness:150,delay:.05}}
          style={{position:'absolute',left:12,bottom:72,zIndex:12,cursor:'pointer',
            filter:'drop-shadow(4px 8px 8px rgba(0,0,0,0.45))'}}
          onClick={()=>doSpark(70,150,'house')}>
          <img src={spr('f_house.png')} alt="Haus" style={{width:108,height:144,objectFit:'contain',imageRendering:'pixelated'}}/>
        </motion.div>

        {/* Trees left */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="tl" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.1}}
              style={{position:'absolute',left:130,bottom:72,zIndex:11,
                filter:'drop-shadow(2px 6px 5px rgba(0,0,0,0.35))'}}>
              <motion.img src={spr('f_tree.png')} alt="Baum"
                style={{width:70,height:88,objectFit:'contain',imageRendering:'pixelated'}}
                animate={{y:[0,-3,0]}} transition={{duration:2.8,repeat:Infinity,ease:'easeInOut'}}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Trees right (level 4+) */}
        <AnimatePresence>
          {show(4) && (
            <motion.div key="tr" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.15}}
              style={{position:'absolute',right:14,bottom:70,zIndex:11,
                filter:'drop-shadow(2px 6px 5px rgba(0,0,0,0.35))'}}>
              <motion.img src={spr('f_tree.png')} alt="Baum"
                style={{width:62,height:78,objectFit:'contain',imageRendering:'pixelated',transform:'scaleX(-1)'}}
                animate={{y:[0,-3,0]}} transition={{duration:3.2,repeat:Infinity,ease:'easeInOut',delay:.6}}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fence (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="fence" initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{delay:.2}}
              style={{position:'absolute',left:198,bottom:66,zIndex:10}}>
              <img src={spr('f_fence.png')} alt="Zaun"
                style={{width:68,height:68,objectFit:'contain',imageRendering:'pixelated',
                  filter:'drop-shadow(1px 3px 3px rgba(0,0,0,0.3))'}}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="player" initial={{x:-80,opacity:0}} animate={{x:0,opacity:1}} transition={{type:'spring',delay:.05}}
              style={{position:'absolute',left:205,bottom:68,zIndex:16,cursor:'pointer',
                filter:'drop-shadow(2px 5px 4px rgba(0,0,0,0.4))'}}
              onClick={()=>doSpark(225,145,'player')}>
              <PlayerSprite scale={2}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Animals */}
        <AnimatePresence>
          {show(2) && <Animal key="chick" src={spr('f_chicken.png')} x={270} y={64} w={46} h={46} sfxFn={sfx.cluck} onSpark={(x,y)=>doSpark(x,y,'chick')} delay={.15} label="Huhn"/>}
        </AnimatePresence>
        <AnimatePresence>
          {show(2) && <Animal key="sheep" src={spr('f_sheep.png')} x={320} y={62} w={58} h={58} sfxFn={sfx.baa} onSpark={(x,y)=>doSpark(x,y,'sheep')} delay={.1} label="Schaf"/>}
        </AnimatePresence>
        <AnimatePresence>
          {show(3) && <Animal key="cow" src={spr('f_cow.png')} x={380} y={60} w={68} h={68} sfxFn={sfx.moo} onSpark={(x,y)=>doSpark(x,y,'cow')} delay={.1} label="Kuh"/>}
        </AnimatePresence>
        <AnimatePresence>
          {show(3) && <Animal key="pig" src={spr('f_pig.png')} x={452} y={62} w={54} h={54} sfxFn={sfx.oink} onSpark={(x,y)=>doSpark(x,y,'pig')} delay={.2} flip label="Schwein"/>}
        </AnimatePresence>
        <AnimatePresence>
          {show(5) && <Animal key="cow2" src={spr('f_cow.png')} x={508} y={60} w={62} h={62} sfxFn={sfx.moo} onSpark={(x,y)=>doSpark(x,y,'cow2')} delay={.1} flip label="Kuh 2"/>}
        </AnimatePresence>

        {/* Level 6 stars */}
        {level===6 && [40,150,260,370,500].map((x,i)=>(
          <motion.div key={i} style={{position:'absolute',top:12,left:x,color:'#FFD93D',fontSize:16,
            pointerEvents:'none',zIndex:20,textShadow:'0 0 8px #FFD93D'}}
            animate={{opacity:[.2,1,.2],y:[0,-6,0],scale:[1,1.2,1]}}
            transition={{duration:1.8,repeat:Infinity,delay:i*.35}}>*</motion.div>
        ))}

        {/* Sparkles */}
        <AnimatePresence>
          {spark && <Sparkle key={spark.key} x={spark.x} y={spark.y}/>}
        </AnimatePresence>

        {/* Hint */}
        {show(2) && (
          <motion.div animate={{opacity:[.3,.7,.3]}} transition={{duration:3.5,repeat:Infinity}}
            style={{position:'absolute',bottom:5,left:0,right:0,textAlign:'center',
              fontSize:8,color:'rgba(255,255,255,0.9)',fontFamily:'"Press Start 2P",monospace',
              textShadow:'1px 1px 0 rgba(0,0,0,.7)',zIndex:20,letterSpacing:1}}>
            CLICK THE ANIMALS!
          </motion.div>
        )}
      </div>

      {/* ── FOOTER / PROGRESS ── */}
      <div style={{
        background:'linear-gradient(135deg,#1b4a0d 0%,#2d6e1a 50%,#1b4a0d 100%)',
        padding:'10px 16px 12px',
      }}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
          <span style={{color:'#FFE082',fontSize:11,fontWeight:700,fontFamily:'"Press Start 2P",monospace',
            textShadow:'1px 1px 0 rgba(0,0,0,.5)'}}>
            {LABELS[level]}
          </span>
          <span style={{color:'rgba(255,255,200,.75)',fontSize:8,fontFamily:'"Press Start 2P",monospace'}}>
            {nextUnlock}
          </span>
        </div>

        {/* EXP bar */}
        <div style={{background:'rgba(0,0,0,.4)',borderRadius:10,height:16,overflow:'hidden',
          border:'2px solid rgba(255,255,255,.15)',boxShadow:'inset 0 2px 4px rgba(0,0,0,.3)'}}>
          <motion.div initial={{width:0}} animate={{width:`${pct}%`}} transition={{duration:1.2,ease:'easeOut'}}
            style={{height:'100%',borderRadius:8,
              background:'linear-gradient(90deg,#4caf50,#8bc34a,#cddc39)',
              boxShadow:'0 0 8px rgba(100,200,50,.5)'}}/>
        </div>

        <div style={{display:'flex',justifyContent:'space-between',marginTop:6,
          fontSize:8,color:'rgba(255,255,255,.65)',fontFamily:'"Press Start 2P",monospace'}}>
          <span>LVL {level} / 6</span>
          <span>{completedCount} / {totalModules} Module ({pct}%)</span>
        </div>
      </div>
    </div>
  )
}
