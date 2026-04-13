import { useState, useEffect, useRef, useCallback } from 'react'
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
  Pferdekoppel:  [{x:56,y:220},{x:187,y:219},{x:162,y:274},{x:32,y:273}],
  Schafgehege:   [{x:304,y:198},{x:398,y:198},{x:403,y:283},{x:240,y:281},{x:263,y:220}],
  Huhnerstall:   [{x:439,y:199},{x:510,y:198},{x:509,y:233},{x:439,y:232}],
  Schweinestall: [{x:534,y:235},{x:619,y:241},{x:623,y:289},{x:533,y:288}],
  Kuhstall:      [{x:56,y:100},{x:180,y:100},{x:180,y:200},{x:56,y:200}],
  Wege: [{x:3,y:323},{x:84,y:327},{x:110,y:300},{x:114,y:324},{x:180,y:321},{x:235,y:208},{x:225,y:194},{x:157,y:200},{x:119,y:165},{x:117,y:114},{x:128,y:180},{x:174,y:200},{x:277,y:191},{x:292,y:167},{x:419,y:167},{x:275,y:191},{x:230,y:203},{x:189,y:329},{x:444,y:328},{x:469,y:255},{x:474,y:326},{x:543,y:332},{x:562,y:311},{x:610,y:334},{x:123,y:327},{x:4,y:323}],
}


// Farmer centerline path (drawn in positioner tool)
const FARMER_PATH = [{x:3,y:323},{x:84,y:327},{x:110,y:300},{x:114,y:324},{x:180,y:321},{x:235,y:208},{x:225,y:194},{x:157,y:200},{x:119,y:165},{x:117,y:114},{x:128,y:180},{x:174,y:200},{x:277,y:191},{x:292,y:167},{x:419,y:167},{x:275,y:191},{x:230,y:203},{x:189,y:329},{x:444,y:328},{x:469,y:255},{x:474,y:326},{x:543,y:332},{x:562,y:311},{x:610,y:334},{x:123,y:327},{x:4,y:323}]

const ANIMAL_DEFS = [
  { id:'chicken', name:'Huhn',    gif:'anim_chicken.gif', gifRight:'anim_chicken_right.gif', size:40, zone:'Huhnerstall',   sfx:sfx.cluck, unlockLevel:2, emoji:'🐔' },
  { id:'sheep',   name:'Schaf',   gif:'anim_sheep.gif',   gifRight:'anim_sheep_right.gif', size:52, zone:'Schafgehege',   sfx:sfx.baa,   unlockLevel:3, emoji:'🐑' },
  { id:'pig',     name:'Schwein', gif:'anim_pig.gif',     gifRight:'anim_pig_right.gif', size:54, zone:'Schweinestall', sfx:sfx.oink,  unlockLevel:4, emoji:'🐷' },
  { id:'cow',     name:'Kuh',     gif:'anim_cow.gif',     gifRight:'anim_cow_right.gif', size:60, zone:'Kuhstall',      sfx:sfx.moo,   unlockLevel:5, emoji:'🐄' },
  { id:'horse',   name:'Pferd',   gif:'anim_horse.gif',    gifRight:'anim_horse_right.gif', size:64, zone:'Pferdekoppel',  sfx:sfx.neigh, unlockLevel:6, emoji:'🐴' },
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
function RoamingAnimal({ def }) {
  // Use two separate GIF files: def.gif (faces left) and def.gifRight (faces right)
  // For horse: def.gif faces right, def.gifRight faces left
  const posRef = useRef(randomInZone(def.zone))
  const targetRef = useRef(randomInZone(def.zone))
  const pauseRef = useRef(false)
  const pauseTimerRef = useRef(null)
  const [pos, setPos] = useState(posRef.current)
  const [movingRight, setMovingRight] = useState(false)
  const [bouncing, setBouncing] = useState(false)

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
          pauseTimerRef.current = setTimeout(() => { pauseRef.current = false }, 1000 + Math.random()*2000)
        }
      } else {
        posRef.current = { x: posRef.current.x + (dx/dist)*0.4, y: posRef.current.y + (dy/dist)*0.4 }
        setPos({...posRef.current})
        if (Math.abs(dx) > Math.abs(dy) * 0.3) {
          setMovingRight(dx > 0)
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
      style={{ position:'absolute', left:pos.x-def.size/2, top:pos.y-def.size/2,
        width:def.size, zIndex:Math.round(pos.y), cursor:'pointer' }}
      onClick={click}
    >
      <motion.img
        src={currentGif}
        alt={def.name}
        style={{ width:'100%', imageRendering:'pixelated', filter:'drop-shadow(1px 3px 3px rgba(0,0,0,.4))' }}
        animate={bouncing ? {y:[0,-12,0,-6,0]} : {y:0}}
        transition={{duration:.5}}
      />
    </motion.div>
  )
}

// Farmer: walks waypoints with direction-aware animations + turn pauses
function Farmer() {
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
    <div style={{ position:'absolute', left:pos.x-24, top:pos.y-24, width:48,
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
  const [showBanner, setShowBanner] = useState(null)
  const [prevLevel, setPrevLevel] = useState(level)

  useEffect(() => {
    if (level > prevLevel) {
      const newAnimal = ANIMAL_DEFS.find(a => a.unlockLevel === level)
      if (newAnimal) setShowBanner(newAnimal)
      setPrevLevel(level)
    }
  }, [level])

  // Max animals per type at max level: chicken:4, sheep:5, pig:3, cow:3, horse:2
  // Scale with level: at unlock level = 1, increases by 1 each 2 levels after
  const getMaxAnimals = (defId, currentLevel) => {
    const maxAtMax = { chicken:4, sheep:5, pig:3, cow:3, horse:2 }
    const unlockAt = ANIMAL_DEFS.find(a=>a.id===defId)?.unlockLevel || 2
    const levelsAbove = Math.max(0, currentLevel - unlockAt)
    const max = maxAtMax[defId] || 1
    return Math.min(max, 1 + Math.floor(levelsAbove * 0.8))
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
    <div style={{ width:'100%', maxWidth:780, margin:'0 auto', userSelect:'none' }}>
      <div style={{ display:'flex', gap:12, alignItems:'flex-start' }}>

        {/* FARM */}
        <div style={{ flex:1, borderRadius:16, overflow:'hidden',
          boxShadow:'0 12px 40px rgba(0,0,0,.3)', position:'relative' }}>
          <img src={asset('farm_final.png')} alt="Farm" style={{width:'100%',display:'block'}}/>
          <div style={{position:'absolute',inset:0}}>
            <AnimatePresence>
              {placedAnimals.map(a => <RoamingAnimal key={a.instanceId} def={a}/>)}
            </AnimatePresence>
            <Farmer/>
            <AnimatePresence>
              {showBanner && <UnlockBanner key={showBanner.id} animal={showBanner} onDone={()=>setShowBanner(null)}/>}
            </AnimatePresence>
          </div>
        </div>

        {/* SIDEBAR */}
        <div style={{ width:120, flexShrink:0 }}>
          <div style={{ background:'linear-gradient(180deg,#1b4a0d,#2d6e1a)',
            borderRadius:16, padding:'10px 8px', boxShadow:'0 8px 24px rgba(0,0,0,.3)' }}>
            <div style={{fontFamily:'"Press Start 2P",monospace',fontSize:8,color:'#FFE082',
              textAlign:'center',marginBottom:10}}>TIERE</div>

            {ANIMAL_DEFS.map(def => {
              const unlocked = level >= def.unlockLevel
              const count = placedAnimals.filter(a=>a.id===def.id).length
              return (
                <div key={def.id} style={{marginBottom:8}}>
                  <motion.div whileHover={unlocked?{scale:1.08}:{}} whileTap={unlocked?{scale:.95}:{}}
                    onClick={()=>unlocked&&addAnimal(def)}
                    style={{ background:unlocked?'rgba(255,255,255,.12)':'rgba(255,255,255,.04)',
                      border:`2px solid ${unlocked?'rgba(255,217,61,.5)':'rgba(255,255,255,.1)'}`,
                      borderRadius:10, padding:'6px 4px', textAlign:'center',
                      cursor:unlocked?'pointer':'not-allowed', opacity:unlocked?1:.4, position:'relative' }}
                  >
                    {unlocked
                      ? <img src={asset(def.gif)} alt={def.name} style={{width:40,imageRendering:'pixelated',display:'block',margin:'0 auto'}}/>
                      : <div style={{fontSize:24,lineHeight:1}}>🔒</div>
                    }
                    <div style={{fontSize:9,color:unlocked?'#FFE082':'#666',
                      fontFamily:'"Press Start 2P",monospace',marginTop:4}}>
                      {unlocked ? def.name : `LVL ${def.unlockLevel}`}
                    {unlocked && <div style={{fontSize:8,color:'rgba(255,255,200,.5)'}}>{count}/{getMaxAnimals(def.id,level)}</div>}
                    </div>
                    {unlocked && count > 0 && (
                      <div style={{ position:'absolute',top:-4,right:-4,
                        background:'#FFD93D',color:'#1a1a2e',borderRadius:'50%',
                        width:16,height:16,fontSize:9,fontWeight:'bold',
                        display:'flex',alignItems:'center',justifyContent:'center' }}>{count}</div>
                    )}
                  </motion.div>
                  {unlocked && count > 0 && (
                    <motion.div whileTap={{scale:.9}}
                      onClick={()=>{const last=placedAnimals.filter(a=>a.id===def.id).pop();if(last)removeAnimal(last.instanceId)}}
                      style={{fontSize:9,color:'#ff6b6b',textAlign:'center',cursor:'pointer',marginTop:2}}>
                      ↩ entf.
                    </motion.div>
                  )}
                </div>
              )
            })}
            <div style={{borderTop:'1px solid rgba(255,255,255,.1)',marginTop:6,paddingTop:6,
              fontSize:8,color:'rgba(255,255,200,.5)',textAlign:'center',fontFamily:'var(--font-body)'}}>
              Klick = hinzuf.
            </div>
          </div>
        </div>
      </div>

      {/* PROGRESS */}
      <div style={{background:'linear-gradient(135deg,#1b4a0d,#2d6e1a)',
        borderRadius:'0 0 16px 16px',padding:'10px 16px 12px',marginTop:2,
        boxShadow:'0 6px 20px rgba(0,0,0,.2)'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
          <span style={{color:'#FFE082',fontSize:10,fontWeight:700,
            fontFamily:'"Press Start 2P",monospace',textShadow:'1px 1px 0 rgba(0,0,0,.5)'}}>
            {LABELS[level]}
          </span>
          <span style={{color:'rgba(255,255,200,.7)',fontSize:8,fontFamily:'"Press Start 2P",monospace'}}>
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
          fontSize:8,color:'rgba(255,255,255,.55)',fontFamily:'"Press Start 2P",monospace'}}>
          <span>LVL {level} / 6</span>
          <span>{completedCount} / {totalModules} ({pct}%)</span>
        </div>
      </div>
    </div>
  )
}
