import { useEffect, useRef, useCallback, useState } from 'react'
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
  moo()   { const ac = getAc(); if (!ac) return; const t = ac.currentTime; tone(130,'sine',t,.5,.2); tone(110,'sine',t+.2,.4,.1) },
  cluck() { const ac = getAc(); if (!ac) return; const t = ac.currentTime; [0,.07,.14].forEach(d=>tone(650+Math.random()*150,'square',t+d,.06,.1)) },
  chime() { const ac = getAc(); if (!ac) return; const t = ac.currentTime; [523,659,784,1047].forEach((f,i)=>tone(f,'sine',t+i*.08,.2,.13)) },
}

// Sprite Animator using setInterval (React Strict Mode safe)
function Sprite({ src, frameW, frameH, cols, frames, fps = 8, scale = 4, row = 0, onClick, flipX = false, style = {} }) {
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
          if (flipX) { ctx.save(); ctx.translate(canvas.width, 0); ctx.scale(-1, 1) }
          ctx.drawImage(img, (frameRef.current % cols) * frameW, row * frameH, frameW, frameH, 0, 0, canvas.width, canvas.height)
          if (flipX) ctx.restore()
          frameRef.current = (frameRef.current + 1) % frames
        } catch {}
      }, 1000 / fps)
    }
    img.onerror = () => {}
    img.src = src
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [src, row, fps, cols, frames, frameW, frameH, flipX])

  return (
    <canvas ref={canvasRef} width={frameW * scale} height={frameH * scale}
      onClick={onClick}
      style={{ imageRendering: 'pixelated', cursor: onClick ? 'pointer' : 'default', display: 'block', ...style }} />
  )
}

function getLevel(n) {
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=12) return 4; if (n<=16) return 5; return 6
}
const LABELS  = ['','Kleiner Hof','Wachsender Hof','Blühender Hof','Großer Hof','Prächtiger Hof','Traumhof']
const NEXT_AT = [0,3,6,9,13,17,Infinity]
const SKY_CLR = ['','#5b8dd9','#5b8dd9','#3d6abf','#2d5aaa','#1d4a95','#0d3080']
const CLD_CLR = ['','#e8e8e8','#e8e8e8','#c8d8f0','#b8c8e8','#a8b8d8','#8898c8']

function Sparkle({ x, y }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, pointerEvents:'none', zIndex:40 }}>
      {['★','✦','·'].map((c,i) => (
        <motion.div key={i} initial={{opacity:1,x:0,y:0}} animate={{opacity:0,x:(i-1)*20,y:-35}}
          transition={{duration:.7,delay:i*.06}}
          style={{position:'absolute',color:'#FFD93D',fontSize:16,fontFamily:'monospace',fontWeight:'bold'}}>
          {c}
        </motion.div>
      ))}
    </div>
  )
}

export default function FarmProgress({ completedCount = 0, totalModules = 17 }) {
  const level = getLevel(completedCount)
  const show  = (min) => level >= min
  const [spark, setSpark] = useState(null)

  const click = useCallback((id, sfxFn, x, y) => {
    try { sfxFn() } catch {}
    setSpark({ id, x, y, key: Date.now() })
    setTimeout(() => setSpark(null), 900)
  }, [])

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? `${NEXT_AT[level] - completedCount} bis naechstes Level`
    : 'Max Level!'

  const skyColor = SKY_CLR[level]
  const bg = `linear-gradient(180deg,${skyColor} 0%,${skyColor} 55%,#3a7d44 55%,#2d6e35 70%,#4caf50 70%,#388e3c 100%)`

  return (
    <div style={{ width:'100%', maxWidth:640, margin:'0 auto', userSelect:'none' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', background:'#1a1a2e', border:'3px solid #FFD93D', borderBottom:'none', borderRadius:'8px 8px 0 0', padding:'6px 12px' }}>
        <span style={{ color:'#FFD93D', fontSize:10, fontFamily:'"Press Start 2P",monospace' }}>{'[FARM] ' + LABELS[level]}</span>
        <span style={{ color:'#aaa', fontSize:8, fontFamily:'"Press Start 2P",monospace' }}>{nextUnlock}</span>
      </div>

      <div style={{ position:'relative', overflow:'hidden', border:'3px solid #FFD93D', borderTop:'none', height:240, background:bg, transition:'background .8s' }}>
        <motion.div animate={{x:['0%','110%']}} transition={{duration:18,repeat:Infinity,ease:'linear',repeatDelay:2}} initial={{x:'-15%'}}
          style={{position:'absolute',top:18,left:0,pointerEvents:'none'}}>
          <svg width="64" height="24" viewBox="0 0 64 24" style={{imageRendering:'pixelated'}}>
            <rect x="8"  y="16" width="48" height="8" fill={CLD_CLR[level]}/>
            <rect x="16" y="8"  width="32" height="8" fill={CLD_CLR[level]}/>
            <rect x="24" y="0"  width="16" height="8" fill={CLD_CLR[level]}/>
          </svg>
        </motion.div>
        <motion.div animate={{x:['0%','110%']}} transition={{duration:26,repeat:Infinity,ease:'linear',delay:8}} initial={{x:'-25%'}}
          style={{position:'absolute',top:35,left:0,pointerEvents:'none'}}>
          <svg width="48" height="20" viewBox="0 0 48 20" style={{imageRendering:'pixelated'}}>
            <rect x="8"  y="12" width="32" height="8" fill={CLD_CLR[level]}/>
            <rect x="16" y="4"  width="16" height="8" fill={CLD_CLR[level]}/>
          </svg>
        </motion.div>

        <motion.div animate={{rotate:360}} transition={{duration:20,repeat:Infinity,ease:'linear'}}
          style={{position:'absolute',top:10,right:18,pointerEvents:'none'}}>
          <svg width="32" height="32" viewBox="0 0 32 32" style={{imageRendering:'pixelated'}}>
            <rect x="12" y="0"  width="8" height="4"  fill="#FFD93D"/>
            <rect x="12" y="28" width="8" height="4"  fill="#FFD93D"/>
            <rect x="0"  y="12" width="4" height="8"  fill="#FFD93D"/>
            <rect x="28" y="12" width="4" height="8"  fill="#FFD93D"/>
            <rect x="4"  y="4"  width="4" height="4"  fill="#FFD93D"/>
            <rect x="24" y="4"  width="4" height="4"  fill="#FFD93D"/>
            <rect x="4"  y="24" width="4" height="4"  fill="#FFD93D"/>
            <rect x="24" y="24" width="4" height="4"  fill="#FFD93D"/>
            <rect x="8"  y="8"  width="16" height="16" fill="#FFD93D"/>
            <rect x="10" y="10" width="12" height="12" fill="#FFF176"/>
          </svg>
        </motion.div>

        <div style={{position:'absolute',left:8,bottom:60,zIndex:5}}>
          <Sprite src={spr('house.png')} frameW={32} frameH={32} cols={7} frames={1} fps={1} scale={4} row={0}/>
        </div>

        <AnimatePresence>
          {show(2) && (
            <motion.div key="tree" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',stiffness:300}}
              style={{position:'absolute',left:145,bottom:62,zIndex:4}}>
              <Sprite src={spr('tree.png')} frameW={16} frameH={16} cols={10} frames={3} fps={2} scale={4} row={0}/>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {show(2) && (
            <motion.div key="farmer" initial={{x:-40,opacity:0}} animate={{x:0,opacity:1}} transition={{type:'spring'}}
              style={{position:'absolute',left:100,bottom:60,zIndex:8,cursor:'pointer'}}
              onClick={()=>click('farmer',sfx.chime,110,120)}>
              <Sprite src={spr('farmer.png')} frameW={16} frameH={16} cols={8} frames={8} fps={6} scale={4} row={0}/>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {show(2) && (
            <motion.div key="chick" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.1}}
              style={{position:'absolute',left:195,bottom:62,zIndex:6,cursor:'pointer'}}
              onClick={()=>click('chick',sfx.cluck,205,125)}>
              <Sprite src={spr('chicken.png')} frameW={16} frameH={16} cols={4} frames={4} fps={6} scale={4} row={0}/>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {show(3) && (
            <motion.div key="cow" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.1}}
              style={{position:'absolute',left:260,bottom:58,zIndex:7,cursor:'pointer'}}
              onClick={()=>click('cow',sfx.moo,290,120)}>
              <Sprite src={spr('cow.png')} frameW={16} frameH={16} cols={8} frames={8} fps={5} scale={4} row={2}/>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {show(4) && (
            <motion.div key="crops" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}
              style={{position:'absolute',left:330,bottom:62,zIndex:5}}>
              <Sprite src={spr('crops.png')} frameW={16} frameH={16} cols={5} frames={3} fps={2} scale={4} row={0}/>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {show(4) && (
            <motion.div key="cow2" initial={{x:60,opacity:0}} animate={{x:0,opacity:1}} transition={{type:'spring'}}
              style={{position:'absolute',left:370,bottom:58,zIndex:6,cursor:'pointer'}}
              onClick={()=>click('cow2',sfx.moo,395,120)}>
              <Sprite src={spr('cow2.png')} frameW={16} frameH={16} cols={8} frames={8} fps={4} scale={3.5} row={0} flipX/>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {show(5) && (
            <motion.div key="chick2" initial={{scale:0}} animate={{scale:1}} transition={{type:'spring'}}
              style={{position:'absolute',left:435,bottom:62,zIndex:6,cursor:'pointer'}}
              onClick={()=>click('chick2',sfx.cluck,445,125)}>
              <Sprite src={spr('chicken2.png')} frameW={16} frameH={16} cols={4} frames={4} fps={7} scale={4} row={0} flipX/>
            </motion.div>
          )}
        </AnimatePresence>

        {level===6 && [50,160,270,380,480].map((x,i)=>(
          <motion.div key={i} style={{position:'absolute',top:8,left:x,color:'#FFD93D',fontSize:12,pointerEvents:'none',fontFamily:'monospace'}}
            animate={{opacity:[.2,1,.2],y:[0,-4,0]}} transition={{duration:1.8,repeat:Infinity,delay:i*.35}}>
            {String.fromCharCode(9733)}
          </motion.div>
        ))}

        <AnimatePresence>
          {spark && <Sparkle key={spark.key} x={spark.x} y={spark.y}/>}
        </AnimatePresence>

        <div style={{position:'absolute',bottom:4,left:0,right:0,textAlign:'center',fontSize:7,color:'rgba(255,255,200,0.6)',fontFamily:'monospace',letterSpacing:1}}>
          [ CLICK THE ANIMALS ]
        </div>
      </div>

      <div style={{background:'#1a1a2e',border:'3px solid #FFD93D',borderTop:'none',borderRadius:'0 0 8px 8px',padding:'8px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:5,fontSize:8,color:'#FFD93D',fontFamily:'"Press Start 2P",monospace'}}>
          <span>EXP</span><span>{completedCount}/{totalModules}</span>
        </div>
        <div style={{background:'#0d0d1a',border:'2px solid #555',borderRadius:2,height:12,overflow:'hidden'}}>
          <motion.div initial={{width:0}} animate={{width:`${(completedCount/totalModules)*100}%`}}
            transition={{duration:1,ease:'easeOut'}}
            style={{height:'100%',background:'linear-gradient(90deg,#FFD93D,#FF9F43)',borderRadius:1}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,fontSize:7,color:'#888',fontFamily:'"Press Start 2P",monospace'}}>
          <span>LVL {level}</span>
          <span>{Array(level).fill('\u2605').join('')}{Array(6-level).fill('\u2606').join('')}</span>
        </div>
      </div>
    </div>
  )
}
