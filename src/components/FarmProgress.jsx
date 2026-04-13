import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const asset = (n) => BASE + 'sprites/farm/' + n

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
  moo()   { const ac=getAc();if(!ac)return;const t=ac.currentTime;tone(130,'sine',t,.5,.2) },
  baa()   { const ac=getAc();if(!ac)return;const t=ac.currentTime;tone(220,'sine',t,.3,.18) },
  cluck() { const ac=getAc();if(!ac)return;const t=ac.currentTime;[0,.07,.14].forEach(d=>tone(650,'square',t+d,.06,.1)) },
  oink()  { const ac=getAc();if(!ac)return;const t=ac.currentTime;tone(280,'sawtooth',t,.15,.18) },
  neigh() {
    const ac=getAc(); if(!ac) return; const t=ac.currentTime
    // Realistic horse neigh: rising then falling pitch with vibrato
    try {
      const o=ac.createOscillator(), g=ac.createGain(), vib=ac.createOscillator(), vibGain=ac.createGain()
      o.type='sawtooth'
      o.frequency.setValueAtTime(400,t)
      o.frequency.linearRampToValueAtTime(900,t+0.15)
      o.frequency.linearRampToValueAtTime(600,t+0.35)
      o.frequency.linearRampToValueAtTime(400,t+0.6)
      g.gain.setValueAtTime(0,t)
      g.gain.linearRampToValueAtTime(0.22,t+0.05)
      g.gain.setValueAtTime(0.18,t+0.4)
      g.gain.linearRampToValueAtTime(0.001,t+0.7)
      // Vibrato
      vib.type='sine'; vib.frequency.value=8
      vibGain.gain.value=15
      vib.connect(vibGain); vibGain.connect(o.frequency)
      o.connect(g); g.connect(ac.destination)
      vib.start(t+0.1); vib.stop(t+0.7)
      o.start(t); o.stop(t+0.7)
    } catch {}
  },
  chime() { const ac=getAc();if(!ac)return;const t=ac.currentTime;[523,659,784].forEach((f,i)=>tone(f,'sine',t+i*.1,.2,.13)) },
}

const ZONES = {
  Pferdekoppel: [{x:66,y:258},{x:219,y:257},{x:190,y:321},{x:38,y:320}],
  Schafgehege: [{x:356,y:232},{x:466,y:232},{x:472,y:332},{x:281,y:329},{x:308,y:258}],
  Huhnerstall: [{x:514,y:233},{x:598,y:232},{x:596,y:273},{x:514,y:272}],
  Schweinestall: [{x:626,y:275},{x:725,y:282},{x:730,y:339},{x:625,y:338}],
  Kuhstall: [{x:125,y:141},{x:64,y:149},{x:7,y:156},{x:62,y:172},{x:125,y:173},{x:132,y:206},{x:56,y:213},{x:56,y:225},{x:275,y:233},{x:169,y:220},{x:148,y:179},{x:169,y:141}],
  Wege: [{x:3,y:323},{x:84,y:327},{x:110,y:300},{x:114,y:324},{x:180,y:321},{x:235,y:208},{x:225,y:194},{x:157,y:200},{x:119,y:165},{x:117,y:114},{x:128,y:180},{x:174,y:200},{x:277,y:191},{x:292,y:167},{x:419,y:167},{x:275,y:191},{x:230,y:203},{x:189,y:329},{x:444,y:328},{x:469,y:255},{x:474,y:326},{x:543,y:332},{x:562,y:311},{x:610,y:334},{x:123,y:327},{x:4,y:323}],
}


// Farmer centerline path (drawn in positioner tool)
const FARMER_PATH = [{x:4,y:379},{x:98,y:383},{x:129,y:352},{x:134,y:380},{x:211,y:376},{x:275,y:244},{x:264,y:227},{x:184,y:234},{x:139,y:193},{x:137,y:134},{x:150,y:211},{x:204,y:234},{x:325,y:224},{x:342,y:196},{x:491,y:196},{x:322,y:224},{x:270,y:238},{x:221,y:386},{x:520,y:384},{x:550,y:299},{x:555,y:382},{x:636,y:389},{x:659,y:364},{x:715,y:391},{x:144,y:383},{x:5,y:379}]

const ANIMAL_DEFS = [
  { id:'chicken', name:'Huhn',    gif:'anim_chicken.gif', gifRight:'anim_chicken_right.gif', size:40, zone:'Huhnerstall',   sfx:sfx.cluck, unlockLevel:2, emoji:'🐔' },
  { id:'sheep',   name:'Schaf',   gif:'anim_sheep.gif',   gifRight:'anim_sheep_right.gif', size:52, zone:'Schafgehege',   sfx:sfx.baa,   unlockLevel:3, emoji:'🐑' },
  { id:'pig',     name:'Schwein', gif:'anim_pig.gif',     gifRight:'anim_pig_right.gif', size:54, zone:'Schweinestall', sfx:sfx.oink,  unlockLevel:4, emoji:'🐷' },
  { id:'cow',     name:'Kuh',     gif:'anim_cow.gif',     gifRight:'anim_cow_right.gif', size:60, zone:'Kuhstall',      sfx:sfx.moo,   unlockLevel:5, emoji:'🐄' },
  { id:'horse', name:'Pferd', gif:'anim_horse.gif', gifRight:'anim_horse_left.gif', size:64, zone:'Pferdekoppel', sfx:sfx.neigh, unlockLevel:6, emoji:'🐴', facesRight:true },
]

function getLevel(n) {
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=12) return 4; if (n<=16) return 5; return 6
}
const LABELS  = ['','Kleiner Hof','Wachsender Hof','Bluehender Hof','Grosser Hof','Praechtiger Hof','Traumhof!']
const NEXT_AT = [0,3,6,9,13,17,Infinity]

function pointInPoly(px,py,points) {
  let inside=false
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const xi=points[i].x,yi=points[i].y,xj=points[j].x,yj=points[j].y
    if (((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside
  }
  return inside
}

function randomInZone(zone) {
  const points = ZONES[zone]
  if (!points) return {x:320,y:200}
  const xs=points.map(p=>p.x), ys=points.map(p=>p.y)
  const minX=Math.min(...xs), maxX=Math.max(...xs)
  const minY=Math.min(...ys), maxY=Math.max(...ys)
  for (let i=0;i<40;i++) {
    const x=minX+Math.random()*(maxX-minX)
    const y=minY+Math.random()*(maxY-minY)
    if (pointInPoly(x,y,points)) return {x,y}
  }
  return {x:(minX+maxX)/2, y:(minY+maxY)/2}
}

// Animal: roams in zone, correct facing, occasional pauses
function RoamingAnimal({ def, farmScale = 1 }) {
  // Use two separate GIF files: def.gif (faces left) and def.gifRight (faces right)
  // For horse: def.gif faces right, def.gifRight faces left
  const posRef = useRef(randomInZone(def.zone))
  const targetRef = useRef(randomInZone(def.zone))
  const pauseRef = useRef(false)
  const pauseTimerRef = useRef(null)
  const [pos, setPos] = useState(posRef.current)
  const [movingRight, setMovingRight] = useState(false)
  const [bouncing, setBouncing] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const iv = setInterval(() => {
      if (pauseRef.current) return
      const dx = targetRef.current.x - posRef.current.x
      const dy = targetRef.current.y - posRef.current.y
      const dist = Math.sqrt(dx*dx + dy*dy)
      if (dist < 3) {
        targetRef.current = randomInZone(def.zone)
        if (Math.random() < 0.3) {
          pauseRef.current = true
          setPaused(true)
          pauseTimerRef.current = setTimeout(() => {
            pauseRef.current = false
            setPaused(false)
          }, 800 + Math.random()*1500)
        }
      } else {
        const newX = posRef.current.x + (dx/dist)*0.4
        const newY = posRef.current.y + (dy/dist)*0.4
        // Only move if new position is still inside the zone polygon
        const zonePoints = ZONES[def.zone]
        if (!zonePoints || pointInPoly(newX, newY, zonePoints)) {
          posRef.current = { x: newX, y: newY }
          setPos({...posRef.current})
          if (Math.abs(dx) > Math.abs(dy) * 0.3) {
            setMovingRight(dx > 0)
          }
        } else {
          // Outside boundary — pick new target inside zone
          targetRef.current = randomInZone(def.zone)
        }
      }
    }, 50)
    return () => { clearInterval(iv); if(pauseTimerRef.current) clearTimeout(pauseTimerRef.current) }
  }, [def.zone])

  const click = () => {
    try { def.sfx() } catch {}
    setBouncing(true)
    setTimeout(() => setBouncing(false), 600)
  }

  // Pick correct GIF based on direction
  // facesLeft animals (default): use gif when going left, gifRight when going right
  // facesRight animals (horse): use gif when going right, gifRight when going left
  const currentGif = def.facesRight
    ? (movingRight ? asset(def.gif) : asset(def.gifRight || def.gif))
    : (movingRight ? asset(def.gifRight || def.gif) : asset(def.gif))

  return (
    <motion.div
      initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0,opacity:0}}
      transition={{type:'spring',stiffness:280}}
      style={{ position:'absolute',
        left:`calc(${(pos.x/750*100).toFixed(3)}% - ${Math.round(def.size*farmScale/2)}px)`,
        top:`calc(${(pos.y/419*100).toFixed(3)}% - ${Math.round(def.size*farmScale/2)}px)`,
        width:Math.round(def.size * farmScale), zIndex:Math.round(pos.y), cursor:'pointer' }}
      onClick={click}
    >
      <img
        src={currentGif}
        alt={def.name}
        style={{
          width:'100%',
          imageRendering:'pixelated',
          filter:'drop-shadow(1px 3px 3px rgba(0,0,0,.4))',
          // Stop GIF when paused by forcing a static snapshot via object-position trick
          // We swap to a static version - simplest: use CSS animation-play-state
          animationPlayState: paused ? 'paused' : 'running',
          // For GIF pause: re-render the img to freeze it
          opacity: 1,
        }}
      />
    </motion.div>
  )
}

// Farmer: walks waypoints with direction-aware animations + turn pauses
function Farmer({ farmScale = 1 }) {
  const wps = FARMER_PATH
  const posRef = useRef(wps[0])
  const wpRef = useRef(0)
  const pauseRef = useRef(false)
  const lastDirRef = useRef({dx:1,dy:0}) // track previous direction vector
  const [pos, setPos] = useState(wps[0])
  const [dir, setDir] = useState('idle_front')

  useEffect(() => {
    const iv = setInterval(() => {
      if (pauseRef.current) return

      const t = wps[wpRef.current]
      const dx=t.x-posRef.current.x, dy=t.y-posRef.current.y
      const dist=Math.sqrt(dx*dx+dy*dy)

      if (dist < 2) {
        const nextIdx = (wpRef.current+1) % wps.length
        const nextWp = wps[nextIdx]
        // Check if this is a turn: dot product of current and next direction
        const curDx = t.x - posRef.current.x
        const curDy = t.y - posRef.current.y
        const nextDx = nextWp.x - t.x
        const nextDy = nextWp.y - t.y
        const curLen = Math.sqrt(curDx*curDx+curDy*curDy) || 1
        const nextLen = Math.sqrt(nextDx*nextDx+nextDy*nextDy) || 1
        const dot = (curDx/curLen)*(nextDx/nextLen) + (curDy/curLen)*(nextDy/nextLen)
        // dot < 0.3 means angle > ~72 degrees = significant turn
        const isTurn = dot < 0.3

        wpRef.current = nextIdx

        if (isTurn) {
          pauseRef.current = true
          // Face camera (idle_front) or away (idle_back) based on vertical direction
          setDir(curDy > 0 ? 'idle_front' : 'idle_back')
          setTimeout(() => { pauseRef.current = false }, 500 + Math.random()*800)
        } else if (Math.random() < 0.08) {
          // Occasional random pause
          pauseRef.current = true
          setDir(Math.random() < 0.5 ? 'idle_front' : 'idle_back')
          setTimeout(() => { pauseRef.current = false }, 600 + Math.random()*1200)
        }
      } else {
        const spd = 0.7
        posRef.current = { x: posRef.current.x+dx/dist*spd, y: posRef.current.y+dy/dist*spd }
        setPos({...posRef.current})
        const adx = Math.abs(dx), ady = Math.abs(dy)
        if (adx > ady) {
          setDir(dx > 0 ? 'right' : 'left')
        } else {
          setDir(dy > 0 ? 'down' : 'up')
        }
      }
    }, 50)
    return () => clearInterval(iv)
  }, [])

  // Pick GIF and flip based on direction
  let gif = 'farmer_idle_front.gif'
  let flipX = false
  if (dir === 'right')       { gif = 'farmer_walk_right.gif'; flipX = false }
  else if (dir === 'left')   { gif = 'farmer_walk_right.gif'; flipX = true  }
  else if (dir === 'up')     { gif = 'farmer_walk_up.gif';    flipX = false }
  else if (dir === 'down')   { gif = 'farmer_walk_down.gif';  flipX = false }
  else if (dir === 'idle_back') { gif = 'farmer_idle_back.gif'; flipX = false }
  else                        { gif = 'farmer_idle_front.gif'; flipX = false }

  return (
    <div style={{ position:'absolute',
      left:`calc(${(pos.x/750*100).toFixed(3)}% - ${Math.round(24*farmScale)}px)`,
      top:`calc(${(pos.y/419*100).toFixed(3)}% - ${Math.round(24*farmScale)}px)`,
      width:Math.round(48*farmScale),
      zIndex:Math.round(pos.y)+10, pointerEvents:'none' }}>
      <img src={asset(gif)} alt="Bauer"
        style={{ width:'100%', imageRendering:'pixelated',
          transform: flipX ? 'scaleX(-1)' : 'none',
          filter:'drop-shadow(1px 3px 3px rgba(0,0,0,.5))' }}/>
    </div>
  )
}

function UnlockBanner({ animal, onDone }) {
  useEffect(() => {
    try { sfx.chime() } catch {}
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div
      initial={{opacity:0,scale:0.8,y:20}} animate={{opacity:1,scale:1,y:0}}
      exit={{opacity:0,scale:0.8,y:-20}} transition={{type:'spring',stiffness:300}}
      style={{ position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
        zIndex:100, background:'linear-gradient(135deg,rgba(30,70,15,.97),rgba(50,100,20,.97))',
        border:'3px solid #FFD93D',borderRadius:20,padding:'20px 28px',textAlign:'center',
        boxShadow:'0 8px 40px rgba(0,0,0,.6)',minWidth:260 }}
    >
      <div style={{fontSize:13,color:'rgba(255,255,200,.8)',fontFamily:'var(--font-body)',marginBottom:8}}>
        Schau, wer deinen Bauernhof besuchen kommt!
      </div>
      <motion.div animate={{scale:[1,1.2,1],rotate:[0,10,-10,0]}} transition={{duration:.6,repeat:2}}
        style={{fontSize:64,lineHeight:1,marginBottom:8}}>{animal.emoji}</motion.div>
      <div style={{fontFamily:'var(--font-heading)',fontSize:20,color:'#FFD93D',fontWeight:700}}>
        {animal.name} freigeschaltet!
      </div>
      <motion.div animate={{opacity:[0.5,1,0.5]}} transition={{duration:1,repeat:Infinity}}
        style={{fontSize:11,color:'rgba(255,255,200,.6)',marginTop:8,fontFamily:'var(--font-body)'}}>
        Platziere es auf deinem Hof!
      </motion.div>
    </motion.div>
  )
}

export default function FarmProgress({ completedCount: rawCount = 0, totalModules = 17 }) {
  const completedCount = 17 // PREVIEW: max level
  const level = getLevel(completedCount)
  const pct = Math.round((completedCount / totalModules) * 100)
  const nextUnlock = NEXT_AT[level] !== Infinity
    ? (NEXT_AT[level] - completedCount) + ' bis naechstes Level'
    : 'Max Level!'

  const unlockedAnimals = ANIMAL_DEFS.filter(a => level >= a.unlockLevel)
  const [placedAnimals, setPlacedAnimals] = useState([])
  const farmRef = React.useRef(null)
  const [farmScale, setFarmScale] = React.useState(() => {
    if (typeof window === 'undefined') return 1
    // Farm width = min(windowWidth - 110px sidebar, 750px)
    const w = Math.min(Math.max(window.innerWidth - 110, 100), 750)
    return w / 750
  })
  useEffect(() => {
    const update = () => {
      if (farmRef.current) {
        const w = farmRef.current.getBoundingClientRect().width
        if (w > 0) setFarmScale(w / 750)
      }
    }
    const t = setTimeout(update, 50)
    window.addEventListener('resize', update)
    return () => { clearTimeout(t); window.removeEventListener('resize', update) }
  }, [])
  const [showBanner, setShowBanner] = useState(null)
  const [prevLevel, setPrevLevel] = useState(level)

  useEffect(() => {
    if (level > prevLevel) {
      const newAnimal = ANIMAL_DEFS.find(a => a.unlockLevel === level)
      if (newAnimal) setShowBanner(newAnimal)
      setPrevLevel(level)
    }
  }, [level])

  // Per-level animal limits (max: chicken:4, sheep:4, pig:3, cow:2, horse:2)
  // Lv2:chick1 | Lv3:+pig1 | Lv4:+sheep1,chick2 | Lv5:+sheep2+pig2,chick3 | Lv6:+cow1+horse1+sheep3+pig3+sheep4+cow2+horse2
  const getMaxAnimals = (defId, currentLevel) => {
    const table = {
      chicken: [0, 0, 1, 1, 2, 3, 4],
      pig:     [0, 0, 0, 1, 1, 2, 3],
      sheep:   [0, 0, 0, 0, 1, 2, 4],
      cow:     [0, 0, 0, 0, 0, 1, 2],
      horse:   [0, 0, 0, 0, 0, 0, 2],
    }
    const row = table[defId] || [0,0,0,0,0,0,0]
    return row[Math.min(currentLevel, 6)] || 0
  }
  const addAnimal = useCallback((def) => {
    setPlacedAnimals(prev => {
      const count = prev.filter(a=>a.id===def.id).length
      const max = getMaxAnimals(def.id, level)
      if (count >= max) return prev
      return [...prev, { ...def, instanceId: def.id + '_' + Date.now() }]
    })
    try { def.sfx() } catch {}
  }, [level])

  const removeAnimal = useCallback((instanceId) => {
    setPlacedAnimals(prev => prev.filter(a => a.instanceId !== instanceId))
  }, [])

  return (
    <div className="farm-progress-wrapper" style={{ width:'100%', maxWidth:860, margin:'0 auto', userSelect:'none' }}>

      {/* Header */}
      <div style={{
        display:'flex', justifyContent:'space-between', alignItems:'center',
        padding:'10px 16px 8px',
        background:'linear-gradient(135deg,#1a2e0d,#2d5a1a)',
        borderRadius:'20px 20px 0 0',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{fontSize:22}}>🌾</span>
          <div>
            <div style={{color:'#FFE082',fontSize:13,fontWeight:700,fontFamily:'var(--font-heading)'}}>
              {LABELS[level]}
            </div>
            <div style={{color:'rgba(255,255,200,.6)',fontSize:10,fontFamily:'var(--font-body)'}}>
              {nextUnlock}
            </div>
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{color:'#FFE082',fontSize:11,fontFamily:'var(--font-heading)',fontWeight:700}}>
            Level {level} / 6
          </div>
          <div style={{display:'flex',gap:4,marginTop:3,justifyContent:'flex-end'}}>
            {[1,2,3,4,5,6].map(l=>(
              <div key={l} style={{width:10,height:10,borderRadius:'50%',
                background:l<=level?'#FFD93D':'rgba(255,255,255,.2)',
                boxShadow:l<=level?'0 0 6px #FFD93D':undefined,
                transition:'all .3s'}}/>
            ))}
          </div>
        </div>
      </div>

      <div className="farm-flex-container" style={{ display:'flex', gap:0, alignItems:'flex-start' }}>

        {/* FARM SCENE - larger */}
        <div ref={farmRef} className="farm-scene" style={{ flex:1, position:'relative', overflow:'hidden',
          boxShadow:'0 8px 32px rgba(0,0,0,.3)',
          cursor:'url(' + BASE + 'sprites/farm/cursor_fork.png) 4 4, crosshair' }}>
          <img src={asset('farm_final.png')} alt="Farm"
            style={{width:'100%', display:'block'}}/>
          <div style={{position:'absolute',inset:0}}>
            <AnimatePresence>
              {placedAnimals.map(a => <RoamingAnimal key={a.instanceId} def={a} farmScale={farmScale}/>)}
            </AnimatePresence>
            <Farmer farmScale={farmScale}/>
            <AnimatePresence>
              {showBanner && <UnlockBanner key={showBanner.id} animal={showBanner} onDone={()=>setShowBanner(null)}/>}
            </AnimatePresence>
          </div>
        </div>

        {/* SIDEBAR */}
        <div className="farm-sidebar" style={{ width:110, flexShrink:0,
          background:'linear-gradient(180deg,#1a2e0d,#2d5a1a)',
          borderRadius:'0 0 0 0',
          padding:'8px 6px',
          display:'flex', flexDirection:'column', gap:4,
          overflowY:'auto',
        }}>
          <div style={{color:'#FFE082',fontSize:8,fontFamily:'var(--font-heading)',
            textAlign:'center',marginBottom:4,letterSpacing:1}}>
            TIERE
          </div>

          {ANIMAL_DEFS.map(def => {
            const unlocked = level >= def.unlockLevel
            const count = placedAnimals.filter(a=>a.id===def.id).length
            const maxCount = getMaxAnimals(def.id, level)
            const isFull = count >= maxCount && maxCount > 0
            return (
              <motion.div key={def.id}
                whileHover={unlocked && !isFull ? {scale:1.05} : {}}
                whileTap={unlocked && !isFull ? {scale:.95} : {}}
                onClick={()=>unlocked && !isFull && addAnimal(def)}
                style={{
                  background: unlocked
                    ? isFull ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.1)'
                    : 'rgba(0,0,0,.2)',
                  border: `1.5px solid ${unlocked ? (isFull?'rgba(255,255,200,.2)':'rgba(255,217,61,.5)') : 'rgba(255,255,255,.08)'}`,
                  borderRadius:10, padding:'5px 4px', textAlign:'center',
                  cursor: unlocked && !isFull ? 'pointer' : 'default',
                  opacity: unlocked ? 1 : .4,
                  position:'relative',
                  transition:'all .2s',
                }}
              >
                {unlocked ? (
                  <img src={asset(def.gif)} alt={def.name}
                    style={{width:36,imageRendering:'pixelated',display:'block',margin:'0 auto'}}/>
                ) : (
                  <div style={{fontSize:22,lineHeight:1,padding:'4px 0'}}>🔒</div>
                )}
                <div style={{fontSize:8,color:unlocked?(isFull?'rgba(255,255,200,.4)':'#FFE082'):'#555',
                  fontFamily:'var(--font-heading)',marginTop:3,lineHeight:1.2}}>
                  {unlocked ? def.name : `Lv${def.unlockLevel}`}
                </div>
                {unlocked && maxCount > 0 && (
                  <div style={{
                    fontSize:7,color:'rgba(255,255,200,.6)',
                    fontFamily:'var(--font-body)',marginTop:1,
                  }}>
                    {count}/{maxCount}
                  </div>
                )}
                {unlocked && count > 0 && (
                  <motion.div whileTap={{scale:.8}}
                    onClick={e=>{e.stopPropagation();const last=placedAnimals.filter(a=>a.id===def.id).pop();if(last)removeAnimal(last.instanceId)}}
                    style={{
                      position:'absolute',top:-4,right:-4,
                      background:'#e74c3c',color:'white',
                      borderRadius:'50%',width:14,height:14,
                      fontSize:9,fontWeight:'bold',
                      display:'flex',alignItems:'center',justifyContent:'center',
                      cursor:'pointer',zIndex:10,
                    }}>×</motion.div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* PROGRESS BAR */}
      <div style={{
        background:'linear-gradient(135deg,#1a2e0d,#2d5a1a)',
        borderRadius:'0 0 20px 20px',
        padding:'8px 16px 12px',
        boxShadow:'0 6px 20px rgba(0,0,0,.2)',
      }}>
        <div style={{background:'rgba(0,0,0,.35)',borderRadius:8,height:12,overflow:'hidden',
          border:'1.5px solid rgba(255,255,255,.12)'}}>
          <motion.div initial={{width:0}} animate={{width:`${pct}%`}}
            transition={{duration:1.2,ease:'easeOut'}}
            style={{height:'100%',background:'linear-gradient(90deg,#4caf50,#8bc34a,#cddc39)',
              borderRadius:6,boxShadow:'0 0 8px rgba(100,200,50,.4)'}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:5,
          fontSize:10,color:'rgba(255,255,255,.5)',fontFamily:'var(--font-body)'}}>
          <span>{completedCount} / {totalModules} Module</span>
          <span>{pct}%</span>
        </div>
      </div>
    </div>
  )
}
