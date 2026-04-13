import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const asset = (n) => BASE + 'sprites/farm/' + n

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
}

function getLevel(n) {
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=12) return 4; if (n<=16) return 5; return 6
}
const LABELS  = ['','Kleiner Hof','Wachsender Hof','Bluehender Hof','Grosser Hof','Praechtiger Hof','Traumhof!']
const NEXT_AT = [0,3,6,9,13,17,Infinity]

function Sparkle({ x, y }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, pointerEvents:'none', zIndex:50 }}>
      {['*','+','.'].map((c,i) => (
        <motion.div key={i} initial={{opacity:1,x:0,y:0}} animate={{opacity:0,x:(i-1)*22,y:-38}}
          transition={{duration:.7,delay:i*.07}}
          style={{position:'absolute',color:'#FFD93D',fontSize:18,fontFamily:'monospace',fontWeight:'bold'}}>
          {c}
        </motion.div>
      ))}
    </div>
  )
}

// Animal sprite using GIF — clickable with bounce + sound
function Animal({ gif, x, y, size=80, sfxFn, onSpark, delay=0, flip=false, label }) {
  const [bounce, setBounce] = useState(false)
  const handleClick = () => {
    try { sfxFn() } catch {}
    setBounce(true)
    setTimeout(() => setBounce(false), 700)
    if (onSpark) onSpark(x + size/2, y)
  }
  return (
    <motion.div
      initial={{ scale:0, opacity:0 }}
      animate={{ scale:1, opacity:1 }}
      transition={{ type:'spring', stiffness:300, delay }}
      style={{ position:'absolute', left:x, bottom:y, width:size, height:'auto', cursor:'pointer', zIndex:15 }}
      onClick={handleClick}
      title={label}
    >
      <motion.img
        src={gif}
        alt={label}
        style={{
          width:'100%',
          imageRendering:'pixelated',
          transform: flip ? 'scaleX(-1)' : 'none',
          filter: 'drop-shadow(2px 4px 4px rgba(0,0,0,0.3))',
        }}
        animate={bounce ? { y:[0,-20,0,-10,0] } : { y:[0,-4,0] }}
        transition={bounce ? { duration:.6, type:'spring' } : { duration:2+delay*.4, repeat:Infinity, ease:'easeInOut' }}
      />
    </motion.div>
  )
}

export default function FarmProgress({ completedCount=0, totalModules=17 }) {
  const level = getLevel(completedCount)
  const show  = (min) => level >= min
  const [spark, setSpark] = useState(null)

  const doSpark = useCallback((x, y, id) => {
    setSpark({ x, y, key: Date.now()+id })
    setTimeout(() => setSpark(null), 900)
  }, [])

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? (NEXT_AT[level] - completedCount) + ' bis naechstes Level'
    : 'Max Level!'

  const pct = Math.round((completedCount / totalModules) * 100)

  return (
    <div style={{ width:'100%', maxWidth:640, margin:'0 auto', userSelect:'none',
      borderRadius:20, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.25)' }}>

      {/* Farm scene */}
      <div style={{ position:'relative', overflow:'hidden', aspectRatio:'16/9' }}>

        {/* Animated background video */}
        <video
          autoPlay loop muted playsInline
          style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
        >
          <source src={asset('farm_bg_loop.mp4')} type="video/mp4"/>
        </video>

        {/* Animal sprites overlay */}
        <div style={{ position:'absolute', inset:0 }}>

          {/* Level 2+: Chicken */}
          <AnimatePresence>
            {show(2) && (
              <Animal key="chicken" gif={asset('anim_chicken.gif')}
                x={200} y={55} size={72} sfxFn={sfx.cluck}
                onSpark={(x,y)=>doSpark(x,y,'chicken')} delay={.1} label="Huhn"/>
            )}
          </AnimatePresence>

          {/* Level 2+: Sheep */}
          <AnimatePresence>
            {show(2) && (
              <Animal key="sheep" gif={asset('anim_sheep.gif')}
                x={290} y={50} size={80} sfxFn={sfx.baa}
                onSpark={(x,y)=>doSpark(x,y,'sheep')} delay={.15} label="Schaf"/>
            )}
          </AnimatePresence>

          {/* Level 3+: Pig */}
          <AnimatePresence>
            {show(3) && (
              <Animal key="pig" gif={asset('anim_pig.gif')}
                x={370} y={52} size={76} sfxFn={sfx.oink}
                onSpark={(x,y)=>doSpark(x,y,'pig')} delay={.1} label="Schwein"/>
            )}
          </AnimatePresence>

          {/* Level 3+: Cow */}
          <AnimatePresence>
            {show(3) && (
              <Animal key="cow" gif={asset('anim_cow.gif')}
                x={450} y={48} size={90} sfxFn={sfx.moo}
                onSpark={(x,y)=>doSpark(x,y,'cow')} delay={.2} label="Kuh"/>
            )}
          </AnimatePresence>

          {/* Level 5+: second cow (flipped) */}
          <AnimatePresence>
            {show(5) && (
              <Animal key="cow2" gif={asset('anim_cow.gif')}
                x={130} y={48} size={80} sfxFn={sfx.moo}
                onSpark={(x,y)=>doSpark(x,y,'cow2')} delay={.1} flip label="Kuh 2"/>
            )}
          </AnimatePresence>

          {/* Max level stars */}
          {level===6 && [60,160,260,360,480].map((x,i)=>(
            <motion.div key={i} style={{position:'absolute',top:10,left:x,color:'#FFD93D',
              fontSize:14,pointerEvents:'none',zIndex:20,fontWeight:'bold'}}
              animate={{opacity:[.2,1,.2],y:[0,-5,0]}}
              transition={{duration:2,repeat:Infinity,delay:i*.4}}>*</motion.div>
          ))}

          {/* Click hint */}
          {show(2) && (
            <motion.div animate={{opacity:[.3,.7,.3]}} transition={{duration:3,repeat:Infinity}}
              style={{position:'absolute',bottom:6,left:0,right:0,textAlign:'center',
                fontSize:9,color:'rgba(255,255,200,0.85)',fontFamily:'monospace',
                textShadow:'1px 1px 0 rgba(0,0,0,.7)',zIndex:20,letterSpacing:1}}>
              CLICK THE ANIMALS!
            </motion.div>
          )}

          {/* Level badge */}
          <div style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.55)',
            backdropFilter:'blur(4px)',borderRadius:12,padding:'3px 10px',
            color:'#FFE082',fontSize:10,fontFamily:'"Press Start 2P",monospace',zIndex:20}}>
            LVL {level}
          </div>

          {/* Sparkle */}
          <AnimatePresence>
            {spark && <Sparkle key={spark.key} x={spark.x} y={spark.y}/>}
          </AnimatePresence>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{background:'linear-gradient(135deg,#1b4a0d,#2d6e1a)',padding:'10px 16px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{color:'#FFE082',fontSize:11,fontWeight:700,
            fontFamily:'"Press Start 2P",monospace',textShadow:'1px 1px 0 rgba(0,0,0,.5)'}}>
            {LABELS[level]}
          </span>
          <span style={{color:'rgba(255,255,200,.75)',fontSize:8,fontFamily:'"Press Start 2P",monospace'}}>
            {nextUnlock}
          </span>
        </div>
        <div style={{background:'rgba(0,0,0,.4)',borderRadius:8,height:14,overflow:'hidden',
          border:'2px solid rgba(255,255,255,.15)'}}>
          <motion.div initial={{width:0}} animate={{width:`${pct}%`}}
            transition={{duration:1.2,ease:'easeOut'}}
            style={{height:'100%',background:'linear-gradient(90deg,#4caf50,#8bc34a,#cddc39)',borderRadius:6}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,
          fontSize:8,color:'rgba(255,255,255,.65)',fontFamily:'"Press Start 2P",monospace'}}>
          <span>LVL {level} / 6</span>
          <span>{completedCount} / {totalModules} ({pct}%)</span>
        </div>
      </div>
    </div>
  )
}
