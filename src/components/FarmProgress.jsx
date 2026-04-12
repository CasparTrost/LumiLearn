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
  moo()   { const ac=getAc(); if(!ac) return; const t=ac.currentTime; tone(130,'sine',t,.5,.2); tone(110,'sine',t+.2,.4,.1) },
  baa()   { const ac=getAc(); if(!ac) return; const t=ac.currentTime; tone(220,'sine',t,.3,.18); tone(190,'sine',t+.15,.25,.12) },
  cluck() { const ac=getAc(); if(!ac) return; const t=ac.currentTime; [0,.07,.14].forEach(d=>tone(650+Math.random()*150,'square',t+d,.06,.1)) },
  oink()  { const ac=getAc(); if(!ac) return; const t=ac.currentTime; tone(280,'sawtooth',t,.15,.18); tone(220,'sawtooth',t+.1,.2,.12) },
  chime() { const ac=getAc(); if(!ac) return; const t=ac.currentTime; [523,659,784,1047].forEach((f,i)=>tone(f,'sine',t+i*.08,.2,.13)) },
}

// Player sprite animator
function PlayerSprite({ scale = 2 }) {
  const canvasRef = useRef(null)
  const timerRef  = useRef(null)
  const frameRef  = useRef(0)
  const rowRef    = useRef(1) // row 1 = walk down

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
          ctx.drawImage(img, frameRef.current * 48, rowRef.current * 48, 48, 48, 0, 0, canvas.width, canvas.height)
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

// Farm config
function getLevel(n) {
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=12) return 4; if (n<=16) return 5; return 6
}
const LABELS  = ['','Kleiner Hof','Wachsender Hof','Bluehender Hof','Grosser Hof','Praechtiger Hof','Traumhof!']
const NEXT_AT = [0,3,6,9,13,17,Infinity]

// Sparkle
function Sparkle({ x, y }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, pointerEvents:'none', zIndex:50 }}>
      {['+','*','.'].map((c,i) => (
        <motion.div key={i} initial={{opacity:1,x:0,y:0}} animate={{opacity:0,x:(i-1)*22,y:-38}}
          transition={{duration:.7,delay:i*.07}}
          style={{position:'absolute',color:'#FFD93D',fontSize:18,fontFamily:'monospace',fontWeight:'bold'}}>
          {c}
        </motion.div>
      ))}
    </div>
  )
}

// Animal with CSS bounce animation
function Animal({ src, x, y, size, sfxFn, onClick, delay = 0, flip = false, label }) {
  const [bounce, setBounce] = useState(false)
  const handleClick = () => {
    try { sfxFn() } catch {}
    setBounce(true)
    setTimeout(() => setBounce(false), 700)
    if (onClick) onClick()
  }
  return (
    <motion.div
      initial={{ scale:0, opacity:0 }}
      animate={{ scale:1, opacity:1 }}
      transition={{ type:'spring', stiffness:300, delay }}
      style={{ position:'absolute', left:x, bottom:y, width:size, height:size, cursor:'pointer', zIndex:10 }}
      onClick={handleClick}
      title={label}
    >
      <motion.img
        src={src}
        alt={label}
        style={{ width:'100%', height:'100%', objectFit:'contain', imageRendering:'pixelated',
          transform: flip ? 'scaleX(-1)' : 'none',
          filter:'drop-shadow(2px 4px 4px rgba(0,0,0,0.3))'
        }}
        animate={bounce
          ? { y:[0,-20,0,-10,0], scale:[1,1.15,1] }
          : { y:[0,-3,0] }
        }
        transition={bounce
          ? { duration:.6, type:'spring' }
          : { duration:2+delay*.3, repeat:Infinity, ease:'easeInOut' }
        }
      />
    </motion.div>
  )
}

export default function FarmProgress({ completedCount = 0, totalModules = 17 }) {
  const level = getLevel(completedCount)
  const show  = (min) => level >= min
  const [spark, setSpark] = useState(null)

  const click = useCallback((id, sfxFn, x, y) => {
    setSpark({ id, x, y, key: Date.now() })
    setTimeout(() => setSpark(null), 900)
    try { sfxFn() } catch {}
  }, [])

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? (NEXT_AT[level] - completedCount) + ' bis naechstes Level'
    : 'Max Level erreicht!'

  // Grass tile background pattern
  const grassStyle = {
    backgroundImage: `url(${spr('f_grass.png')})`,
    backgroundRepeat: 'repeat',
    backgroundSize: '48px 48px',
    imageRendering: 'pixelated',
  }

  return (
    <div style={{ width:'100%', maxWidth:640, margin:'0 auto', userSelect:'none' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        background:'linear-gradient(135deg,#2d5a1b,#4a8c2a)', borderRadius:'16px 16px 0 0',
        padding:'8px 16px', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
        <span style={{ color:'#FFE082', fontSize:13, fontWeight:700, fontFamily:'"Press Start 2P",monospace',
          textShadow:'1px 1px 0 rgba(0,0,0,0.5)' }}>
          {LABELS[level]}
        </span>
        <span style={{ color:'rgba(255,255,255,0.8)', fontSize:9, fontFamily:'"Press Start 2P",monospace' }}>
          {nextUnlock}
        </span>
      </div>

      {/* Farm Scene */}
      <div style={{ position:'relative', overflow:'hidden', height:260, borderRadius:'0 0 0 0',
        border:'4px solid #2d5a1b', borderTop:'none', ...grassStyle }}>

        {/* Sky top */}
        <div style={{ position:'absolute', top:0, left:0, right:0, height:70,
          background:'linear-gradient(180deg,#87CEEB 0%,#B0E0FF 100%)', zIndex:1 }}/>

        {/* Animated clouds */}
        <motion.div animate={{x:['0%','120%']}} transition={{duration:20,repeat:Infinity,ease:'linear',repeatDelay:3}} initial={{x:'-20%'}}
          style={{position:'absolute',top:8,left:0,zIndex:2,pointerEvents:'none'}}>
          <div style={{background:'white',borderRadius:20,padding:'6px 18px',opacity:.85,fontSize:24,filter:'blur(0.5px)'}}>
            &nbsp;&nbsp;&nbsp;
          </div>
        </motion.div>
        <motion.div animate={{x:['0%','120%']}} transition={{duration:28,repeat:Infinity,ease:'linear',delay:9}} initial={{x:'-35%'}}
          style={{position:'absolute',top:22,left:0,zIndex:2,pointerEvents:'none'}}>
          <div style={{background:'white',borderRadius:20,padding:'4px 24px',opacity:.7,fontSize:20}}>
            &nbsp;&nbsp;&nbsp;&nbsp;
          </div>
        </motion.div>

        {/* Sun */}
        <motion.div animate={{rotate:360}} transition={{duration:20,repeat:Infinity,ease:'linear'}}
          style={{position:'absolute',top:8,right:16,zIndex:2,pointerEvents:'none',
            width:40,height:40,borderRadius:'50%',background:'#FFD93D',
            boxShadow:'0 0 20px #FFD93D, 0 0 40px rgba(255,217,61,0.4)' }}/>

        {/* Ground / grass area */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:190, zIndex:3, ...grassStyle }}/>

        {/* House (always visible) */}
        <motion.div initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:200}}
          style={{position:'absolute',left:8,bottom:60,zIndex:8,cursor:'pointer'}}
          onClick={()=>click('house',sfx.chime,60,160)}>
          <img src={spr('f_house.png')} alt="Haus"
            style={{width:96,height:128,objectFit:'contain',imageRendering:'pixelated',
              filter:'drop-shadow(3px 6px 6px rgba(0,0,0,0.4))'}}/>
        </motion.div>

        {/* Tree left (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="tree1" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.1}}
              style={{position:'absolute',left:120,bottom:58,zIndex:7}}>
              <motion.img src={spr('f_tree.png')} alt="Baum"
                style={{width:64,height:80,objectFit:'contain',imageRendering:'pixelated',
                  filter:'drop-shadow(2px 4px 4px rgba(0,0,0,0.3))'}}
                animate={{y:[0,-2,0]}} transition={{duration:3,repeat:Infinity,ease:'easeInOut'}}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tree right (level 4+) */}
        <AnimatePresence>
          {show(4) && (
            <motion.div key="tree2" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.15}}
              style={{position:'absolute',right:20,bottom:58,zIndex:7}}>
              <motion.img src={spr('f_tree.png')} alt="Baum"
                style={{width:56,height:70,objectFit:'contain',imageRendering:'pixelated',transform:'scaleX(-1)',
                  filter:'drop-shadow(2px 4px 4px rgba(0,0,0,0.3))'}}
                animate={{y:[0,-2,0]}} transition={{duration:3.5,repeat:Infinity,ease:'easeInOut',delay:.5}}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fence (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="fence" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:.2}}
              style={{position:'absolute',left:195,bottom:56,zIndex:6}}>
              <img src={spr('f_fence.png')} alt="Zaun"
                style={{width:64,height:64,objectFit:'contain',imageRendering:'pixelated'}}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Player walking (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="player" initial={{x:-60,opacity:0}} animate={{x:0,opacity:1}} transition={{type:'spring',delay:.05}}
              style={{position:'absolute',left:200,bottom:60,zIndex:12,cursor:'pointer'}}
              onClick={()=>click('player',sfx.chime,215,140)}>
              <PlayerSprite scale={2}/>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sheep (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.g key="sheep">
              <Animal src={spr('f_sheep.png')} x={270} y={58} size={56} sfxFn={sfx.baa}
                onClick={()=>click('sheep',sfx.baa,285,130)} delay={.1} label="Schaf"/>
            </motion.g>
          )}
        </AnimatePresence>

        {/* Cow (level 3+) */}
        <AnimatePresence>
          {show(3) && (
            <Animal key="cow" src={spr('f_cow.png')} x={330} y={55} size={64} sfxFn={sfx.moo}
              onClick={()=>click('cow',sfx.moo,360,130)} delay={.1} label="Kuh"/>
          )}
        </AnimatePresence>

        {/* Chicken (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <Animal key="chick" src={spr('f_chicken.png')} x={195} y={60} size={44} sfxFn={sfx.cluck}
              onClick={()=>click('chick',sfx.cluck,210,135)} delay={.15} label="Huhn"/>
          )}
        </AnimatePresence>

        {/* Pig (level 3+) */}
        <AnimatePresence>
          {show(3) && (
            <Animal key="pig" src={spr('f_pig.png')} x={400} y={58} size={52} sfxFn={sfx.oink}
              onClick={()=>click('pig',sfx.oink,420,135)} delay={.2} flip label="Schwein"/>
          )}
        </AnimatePresence>

        {/* Second cow (level 5+) */}
        <AnimatePresence>
          {show(5) && (
            <Animal key="cow2" src={spr('f_cow.png')} x={460} y={55} size={60} sfxFn={sfx.moo}
              onClick={()=>click('cow2',sfx.moo,480,130)} delay={.1} flip label="Kuh 2"/>
          )}
        </AnimatePresence>

        {/* Max level sparkles */}
        {level===6 && [60,170,280,390,490].map((x,i)=>(
          <motion.div key={i} style={{position:'absolute',top:10,left:x,color:'#FFD93D',fontSize:14,pointerEvents:'none',zIndex:20,fontWeight:'bold'}}
            animate={{opacity:[.2,1,.2],y:[0,-5,0]}} transition={{duration:2,repeat:Infinity,delay:i*.4}}>
            *
          </motion.div>
        ))}

        {/* Sparkle feedback */}
        <AnimatePresence>
          {spark && <Sparkle key={spark.key} x={spark.x} y={spark.y}/>}
        </AnimatePresence>

        {/* Hint */}
        {show(2) && (
          <motion.div animate={{opacity:[.4,.8,.4]}} transition={{duration:3,repeat:Infinity}}
            style={{position:'absolute',bottom:6,left:0,right:0,textAlign:'center',fontSize:9,
              color:'rgba(255,255,255,0.8)',fontFamily:'"Press Start 2P",monospace',
              textShadow:'1px 1px 0 rgba(0,0,0,0.6)',zIndex:20,letterSpacing:1}}>
            CLICK THE ANIMALS!
          </motion.div>
        )}

        {/* Zindex overlay to keep sky behind */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:70,zIndex:1,pointerEvents:'none',
          background:'linear-gradient(180deg,#87CEEB 0%,#B0E0FF 100%)'}}/>
      </div>

      {/* Progress */}
      <div style={{background:'linear-gradient(135deg,#2d5a1b,#4a8c2a)',borderRadius:'0 0 16px 16px',
        padding:'10px 16px',boxShadow:'0 4px 12px rgba(0,0,0,0.3)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:6,
          fontSize:9,color:'#FFE082',fontFamily:'"Press Start 2P",monospace'}}>
          <span>LEVEL {level}</span>
          <span>{completedCount}/{totalModules} MODULE</span>
        </div>
        <div style={{background:'rgba(0,0,0,0.3)',borderRadius:8,height:14,overflow:'hidden',border:'2px solid rgba(255,255,255,0.2)'}}>
          <motion.div initial={{width:0}} animate={{width:`${(completedCount/totalModules)*100}%`}}
            transition={{duration:1.2,ease:'easeOut'}}
            style={{height:'100%',background:'linear-gradient(90deg,#66bb6a,#FFD93D)',borderRadius:6}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:6,
          fontSize:9,color:'rgba(255,255,255,0.7)',fontFamily:'"Press Start 2P",monospace'}}>
          <span>{'*'.repeat(level)}{'o'.repeat(6-level)}</span>
          <span>LVL {level}/6</span>
        </div>
      </div>
    </div>
  )
}
