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
    try {
      const o=ac.createOscillator(), g=ac.createGain(), vib=ac.createOscillator(), vibGain=ac.createGain()
      o.type='sawtooth'
      o.frequency.setValueAtTime(400,t); o.frequency.linearRampToValueAtTime(900,t+0.15)
      o.frequency.linearRampToValueAtTime(600,t+0.35); o.frequency.linearRampToValueAtTime(400,t+0.6)
      g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.22,t+0.05)
      g.gain.setValueAtTime(0.18,t+0.4); g.gain.linearRampToValueAtTime(0.001,t+0.7)
      vib.type='sine'; vib.frequency.value=8; vibGain.gain.value=15
      vib.connect(vibGain); vibGain.connect(o.frequency)
      o.connect(g); g.connect(ac.destination)
      vib.start(t+0.1); vib.stop(t+0.7); o.start(t); o.stop(t+0.7)
    } catch {}
  },
  levelUp() {
    const ac=getAc(); if(!ac) return; const t=ac.currentTime
    // Triumphant fanfare
    [[523,.0],[659,.15],[784,.3],[1047,.5],[784,.7],[1047,.9]].forEach(([f,d])=>tone(f,'sine',t+d,.25,.18))
  },
  chime() { const ac=getAc();if(!ac)return;const t=ac.currentTime;[523,659,784,1047].forEach((f,i)=>tone(f,'sine',t+i*.12,.25,.15)) },
}

const ZONES = {
  Pferdekoppel:  [{x:66,y:258},{x:219,y:257},{x:190,y:321},{x:38,y:320}],
  Schafgehege:   [{x:356,y:232},{x:466,y:232},{x:472,y:332},{x:281,y:329},{x:308,y:258}],
  Huhnerstall:   [{x:514,y:233},{x:598,y:232},{x:596,y:273},{x:514,y:272}],
  Schweinestall: [{x:626,y:275},{x:725,y:282},{x:730,y:339},{x:625,y:338}],
  Kuhstall:      [{x:125,y:141},{x:64,y:149},{x:7,y:156},{x:62,y:172},{x:125,y:173},{x:132,y:206},{x:56,y:213},{x:56,y:225},{x:275,y:233},{x:169,y:220},{x:148,y:179},{x:169,y:141}],
}

const FARMER_PATH = [{x:4,y:379},{x:98,y:383},{x:129,y:352},{x:134,y:380},{x:211,y:376},{x:275,y:244},{x:264,y:227},{x:184,y:234},{x:139,y:193},{x:137,y:134},{x:150,y:211},{x:204,y:234},{x:325,y:224},{x:342,y:196},{x:491,y:196},{x:322,y:224},{x:270,y:238},{x:221,y:386},{x:520,y:384},{x:550,y:299},{x:555,y:382},{x:636,y:389},{x:659,y:364},{x:715,y:391},{x:144,y:383},{x:5,y:379}]

const ANIMAL_DEFS = [
  { id:'chicken', name:'Huhn',    gif:'anim_chicken.gif', gifRight:'anim_chicken_right.gif', size:40, zone:'Huhnerstall',   sfx:sfx.cluck, emoji:'🐔' },
  { id:'sheep',   name:'Schaf',   gif:'anim_sheep.gif',   gifRight:'anim_sheep_right.gif',   size:52, zone:'Schafgehege',   sfx:sfx.baa,   emoji:'🐑' },
  { id:'pig',     name:'Schwein', gif:'anim_pig.gif',     gifRight:'anim_pig_right.gif',     size:54, zone:'Schweinestall', sfx:sfx.oink,  emoji:'🐷' },
  { id:'cow',     name:'Kuh',     gif:'anim_cow.gif',     gifRight:'anim_cow_right.gif',     size:60, zone:'Kuhstall',      sfx:sfx.moo,   emoji:'🐄' },
  { id:'horse',   name:'Pferd',   gif:'anim_horse.gif',   gifRight:'anim_horse_left.gif',    size:64, zone:'Pferdekoppel',  sfx:sfx.neigh, emoji:'🐴', facesRight:true },
]

// How many of each animal per level [lv0..lv6]
const ANIMAL_COUNT = {
  chicken: [0, 0, 1, 1, 2, 3, 4],
  pig:     [0, 0, 0, 1, 1, 2, 3],
  sheep:   [0, 0, 0, 0, 1, 2, 4],
  cow:     [0, 0, 0, 0, 0, 1, 2],
  horse:   [0, 0, 0, 0, 0, 0, 2],
}

function getLevel(n) {
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=12) return 4; if (n<=16) return 5; return 6
}
const LABELS  = ['','Kleiner Hof','Wachsender Hof','Blühender Hof','Großer Hof','Prächtiger Hof','Traumhof!']
const NEXT_AT = [0,3,6,9,13,17,Infinity]

// Compute which animals should be on farm for a given level
function getAnimalsForLevel(lvl) {
  const result = []
  ANIMAL_DEFS.forEach(def => {
    const count = (ANIMAL_COUNT[def.id] || [])[Math.min(lvl,6)] || 0
    for (let i = 0; i < count; i++) {
      result.push({ ...def, instanceId: `${def.id}_${i}` })
    }
  })
  return result
}

// Compute which animals are NEW at this level vs previous
function getNewAnimals(lvl) {
  const prev = getAnimalsForLevel(lvl - 1)
  const curr = getAnimalsForLevel(lvl)
  const prevIds = prev.map(a => a.instanceId)
  return curr.filter(a => !prevIds.includes(a.instanceId))
}

function pointInPoly(px, py, points) {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi=points[i].x, yi=points[i].y, xj=points[j].x, yj=points[j].y
    if (((yi>py)!==(yj>py)) && (px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside
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

function RoamingAnimal({ def, farmScale = 1, delay = 0 }) {
  const posRef = useRef(randomInZone(def.zone))
  const targetRef = useRef(randomInZone(def.zone))
  const pauseRef = useRef(false)
  const pauseTimerRef = useRef(null)
  const [pos, setPos] = useState(posRef.current)
  const [movingRight, setMovingRight] = useState(false)
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
          pauseRef.current = true; setPaused(true)
          pauseTimerRef.current = setTimeout(() => { pauseRef.current = false; setPaused(false) }, 800 + Math.random()*1500)
        }
      } else {
        const newX = posRef.current.x + (dx/dist)*0.4
        const newY = posRef.current.y + (dy/dist)*0.4
        const zonePoints = ZONES[def.zone]
        if (!zonePoints || pointInPoly(newX, newY, zonePoints)) {
          posRef.current = { x: newX, y: newY }
          setPos({...posRef.current})
          if (Math.abs(dx) > Math.abs(dy) * 0.3) setMovingRight(dx > 0)
        } else {
          targetRef.current = randomInZone(def.zone)
        }
      }
    }, 50)
    return () => { clearInterval(iv); if(pauseTimerRef.current) clearTimeout(pauseTimerRef.current) }
  }, [def.zone])

  const click = () => { try { def.sfx() } catch {} }

  const currentGif = def.facesRight
    ? (movingRight ? asset(def.gif) : asset(def.gifRight || def.gif))
    : (movingRight ? asset(def.gifRight || def.gif) : asset(def.gif))

  return (
    <motion.div
      initial={{scale:0, opacity:0, y: -30}}
      animate={{scale:1, opacity:1, y: 0}}
      exit={{scale:0, opacity:0}}
      transition={{type:'spring', stiffness:300, damping:18, delay}}
      style={{ position:'absolute',
        left:`calc(${(pos.x/750*100).toFixed(3)}% - ${Math.round(def.size*farmScale/2)}px)`,
        top:`calc(${(pos.y/419*100).toFixed(3)}% - ${Math.round(def.size*farmScale/2)}px)`,
        width:Math.round(def.size * farmScale), zIndex:Math.round(pos.y), cursor:'pointer' }}
      onClick={click}
    >
      <img src={currentGif} alt={def.name}
        style={{ width:'100%', imageRendering:'pixelated',
          filter:'drop-shadow(1px 3px 3px rgba(0,0,0,.4))' }}/>
    </motion.div>
  )
}

function Farmer({ farmScale = 1 }) {
  const wps = FARMER_PATH
  const posRef = useRef(wps[0])
  const wpRef = useRef(0)
  const pauseRef = useRef(false)
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
        const curDx=t.x-posRef.current.x, curDy=t.y-posRef.current.y
        const nextDx=nextWp.x-t.x, nextDy=nextWp.y-t.y
        const curLen=Math.sqrt(curDx*curDx+curDy*curDy)||1
        const nextLen=Math.sqrt(nextDx*nextDx+nextDy*nextDy)||1
        const dot=(curDx/curLen)*(nextDx/nextLen)+(curDy/curLen)*(nextDy/nextLen)
        wpRef.current = nextIdx
        if (dot < 0.3) {
          pauseRef.current = true
          setDir(curDy > 0 ? 'idle_front' : 'idle_back')
          setTimeout(() => { pauseRef.current = false }, 500 + Math.random()*800)
        } else if (Math.random() < 0.08) {
          pauseRef.current = true
          setDir(Math.random() < 0.5 ? 'idle_front' : 'idle_back')
          setTimeout(() => { pauseRef.current = false }, 600 + Math.random()*1200)
        }
      } else {
        posRef.current = { x: posRef.current.x+dx/dist*0.7, y: posRef.current.y+dy/dist*0.7 }
        setPos({...posRef.current})
        const adx=Math.abs(dx), ady=Math.abs(dy)
        if (adx > ady) setDir(dx > 0 ? 'right' : 'left')
        else setDir(dy > 0 ? 'down' : 'up')
      }
    }, 50)
    return () => clearInterval(iv)
  }, [])

  let gif = 'farmer_idle_front.gif', flipX = false
  if (dir==='right')      { gif='farmer_walk_right.gif' }
  else if (dir==='left')  { gif='farmer_walk_right.gif'; flipX=true }
  else if (dir==='up')    { gif='farmer_walk_up.gif' }
  else if (dir==='down')  { gif='farmer_walk_down.gif' }
  else if (dir==='idle_back') { gif='farmer_idle_back.gif' }

  return (
    <div style={{ position:'absolute',
      left:`calc(${(pos.x/750*100).toFixed(3)}% - ${Math.round(24*farmScale)}px)`,
      top:`calc(${(pos.y/419*100).toFixed(3)}% - ${Math.round(24*farmScale)}px)`,
      width:Math.round(48*farmScale), zIndex:Math.round(pos.y)+10, pointerEvents:'none' }}>
      <img src={asset(gif)} alt="Bauer"
        style={{ width:'100%', imageRendering:'pixelated',
          transform: flipX ? 'scaleX(-1)' : 'none',
          filter:'drop-shadow(1px 3px 3px rgba(0,0,0,.5))' }}/>
    </div>
  )
}

// Confetti particle
function Confetti({ count = 30 }) {
  const pieces = Array.from({length: count}, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ['#FFD93D','#FF6B6B','#6BCB77','#4D96FF','#FF9F1C','#fff'][i % 6],
    delay: Math.random() * 0.5,
    dur: 1.5 + Math.random() * 1,
    rotate: Math.random() * 360,
  }))
  return (
    <div style={{position:'absolute',inset:0,overflow:'hidden',pointerEvents:'none',zIndex:200}}>
      {pieces.map(p => (
        <motion.div key={p.id}
          initial={{x:`${p.x}vw`, y:'-10%', rotate:0, opacity:1}}
          animate={{y:'110%', rotate: p.rotate + 720, opacity:[1,1,0]}}
          transition={{duration: p.dur, delay: p.delay, ease:'easeIn'}}
          style={{position:'absolute', width:8, height:8,
            background: p.color, borderRadius: p.id%3===0 ? '50%' : 2,
            top:0, left:0}}
        />
      ))}
    </div>
  )
}

// Epic level-up overlay
function LevelUpCelebration({ level, newAnimals, onDone }) {
  const [phase, setPhase] = useState('enter') // enter → animals → done

  useEffect(() => {
    try { sfx.levelUp() } catch {}
    // Phase 1: show level card for 2s, then show new animals for 2.5s, then done
    const t1 = setTimeout(() => setPhase('animals'), 5500)
    const t2 = setTimeout(() => {
      setPhase('exit')
      setTimeout(onDone, 600)
    }, 5500 + (newAnimals.length * 400) + 5000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [])

  return (
    <motion.div
      initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      style={{
        position:'fixed', inset:0, zIndex:1000,
        background:'rgba(0,0,0,.75)',
        display:'flex', alignItems:'center', justifyContent:'center',
        flexDirection:'column',
      }}
    >
      <Confetti count={40}/>

      <AnimatePresence mode="wait">
        {phase === 'enter' && (
          <motion.div key="level-card"
            initial={{scale:0, rotate:-10}} animate={{scale:1, rotate:0}}
            exit={{scale:0.8, opacity:0, y:-40}}
            transition={{type:'spring', stiffness:260, damping:18}}
            style={{
              background:'linear-gradient(135deg,#1a2e0d,#2d5a1a)',
              border:'4px solid #FFD93D',
              borderRadius:28, padding:'32px 48px', textAlign:'center',
              boxShadow:'0 0 60px rgba(255,217,61,.4), 0 20px 60px rgba(0,0,0,.6)',
            }}
          >
            <motion.div
              animate={{scale:[1,1.15,1]}}
              transition={{duration:0.7, repeat:2}}
              style={{width:80, margin:'0 auto 8px'}}
            >
              <img src={asset('farmer_idle_front.gif')} alt="Bauer"
                style={{width:'100%', imageRendering:'pixelated',
                  filter:'drop-shadow(0 4px 12px rgba(255,217,61,.6))'}}/>
            </motion.div>
            <div style={{fontFamily:'var(--font-heading)', fontSize:13, color:'rgba(255,255,200,.7)', letterSpacing:2, marginBottom:8}}>
              NEUES LEVEL ERREICHT!
            </div>
            <div style={{fontFamily:'var(--font-heading)', fontSize:36, fontWeight:900, color:'#FFD93D',
              textShadow:'0 0 30px rgba(255,217,61,.8)', lineHeight:1.1}}>
              {LABELS[level]}
            </div>
            <div style={{fontFamily:'var(--font-body)', fontSize:14, color:'rgba(255,255,200,.6)', marginTop:10}}>
              Level {level} von 6
            </div>
          </motion.div>
        )}

        {phase === 'animals' && newAnimals.length > 0 && (
          <motion.div key="animals-card"
            initial={{scale:0.8, opacity:0, y:30}} animate={{scale:1, opacity:1, y:0}}
            exit={{scale:0.8, opacity:0}}
            transition={{type:'spring', stiffness:300, damping:20}}
            style={{
              background:'linear-gradient(135deg,#1a2e0d,#2d5a1a)',
              border:'4px solid #FFD93D',
              borderRadius:28, padding:'28px 40px', textAlign:'center',
              boxShadow:'0 0 60px rgba(255,217,61,.4), 0 20px 60px rgba(0,0,0,.6)',
              maxWidth:360,
            }}
          >
            <div style={{fontFamily:'var(--font-heading)', fontSize:13, color:'rgba(255,255,200,.7)', letterSpacing:2, marginBottom:16}}>
              {newAnimals.length === 1 ? 'EIN NEUES TIER ZIEHT EIN!' : 'NEUE TIERE ZIEHEN EIN!'}
            </div>
            <div style={{display:'flex', justifyContent:'center', gap:20, flexWrap:'wrap', marginBottom:16}}>
              {newAnimals.map((a, i) => (
                <motion.div key={a.instanceId}
                  initial={{scale:0, y:20}} animate={{scale:1, y:0}}
                  transition={{type:'spring', stiffness:300, delay: i * 0.35}}
                  style={{textAlign:'center'}}
                >
                  <motion.div
                    animate={{y:[0,-10,0]}}
                    transition={{duration:0.7, delay: i*0.35+0.3, repeat:Infinity, ease:'easeInOut'}}
                    style={{width:80, margin:'0 auto'}}
                  >
                    <img src={asset(a.gif)} alt={a.name}
                      style={{width:'100%', imageRendering:'pixelated',
                        filter:'drop-shadow(0 4px 8px rgba(0,0,0,.5))'}}/>
                  </motion.div>
                  <div style={{fontFamily:'var(--font-heading)', fontSize:14, color:'#FFD93D', marginTop:6, fontWeight:700}}>
                    {a.name}
                  </div>
                </motion.div>
              ))}
            </div>
            <motion.div
              animate={{opacity:[0.5,1,0.5]}} transition={{duration:1, repeat:Infinity}}
              style={{fontSize:12, color:'rgba(255,255,200,.5)', fontFamily:'var(--font-body)'}}>
              Schau mal auf deinen Hof! 👇
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default function FarmProgress({ completedCount: rawCount = 0, totalModules = 17, farmLevel: farmLevelProp = null }) {
  const completedCount = rawCount  // use real count
  // Use explicit farmLevel prop if provided (coin-based), else derive from completedCount
  const level = farmLevelProp !== null ? Math.min(farmLevelProp - 1, 6) : getLevel(completedCount)
  const pct = Math.round((completedCount / totalModules) * 100)
  const nextUnlock = NEXT_AT[level] !== Infinity
    ? `${NEXT_AT[level] - completedCount} bis nächstes Level`
    : 'Max Level! 🏆'

  const farmRef = useRef(null)
  const [farmScale, setFarmScale] = useState(() => {
    if (typeof window === 'undefined') return 1
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

  // Animals are derived from level — no manual placement
  const animals = getAnimalsForLevel(level)

  // Level-up detection — persist prevLevel in localStorage
  const [prevLevel, setPrevLevel] = useState(() => {
    try { return parseInt(localStorage.getItem('lumilearn_farm_level') || '0', 10) } catch { return 0 }
  })
  const [celebration, setCelebration] = useState(null)

  useEffect(() => {
    if (level > prevLevel) {
      const newAnimals = getNewAnimals(level)
      setCelebration({ level, newAnimals })
      setPrevLevel(level)
      try { localStorage.setItem('lumilearn_farm_level', String(level)) } catch {}
    } else if (prevLevel === 0 && level > 0) {
      // First ever load — just save, no celebration
      setPrevLevel(level)
      try { localStorage.setItem('lumilearn_farm_level', String(level)) } catch {}
    }
  }, [level])

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

      {/* Farm — full width, no sidebar */}
      <div ref={farmRef} className="farm-scene" style={{ position:'relative', overflow:'hidden', width:'100%',
        boxShadow:'0 8px 32px rgba(0,0,0,.3)',
        cursor:'url(' + BASE + 'sprites/farm/cursor_fork.png) 4 4, crosshair' }}>
        <img src={asset('farm_final.png')} alt="Farm" style={{width:'100%', display:'block'}}/>
        <div style={{position:'absolute',inset:0}}>
          <AnimatePresence>
            {animals.map((a, i) => (
              <RoamingAnimal key={a.instanceId} def={a} farmScale={farmScale} delay={i * 0.08}/>
            ))}
          </AnimatePresence>
          <Farmer farmScale={farmScale}/>
        </div>
      </div>

      {/* Progress Bar */}
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
          <span style={{display:'flex',alignItems:'center',gap:8}}>
            {pct}%
            {/* TEST BUTTON - remove before release */}
            <span onClick={()=>setCelebration({level, newAnimals:getNewAnimals(level)||getAnimalsForLevel(level).slice(0,2)})}
              style={{fontSize:9,opacity:.3,cursor:'pointer',userSelect:'none'}}
              title="Test Level-Up Animation">✨</span>
          </span>
        </div>
      </div>

      {/* Level-Up Celebration Overlay */}
      <AnimatePresence>
        {celebration && (
          <LevelUpCelebration
            key={celebration.level}
            level={celebration.level}
            newAnimals={celebration.newAnimals}
            onDone={() => setCelebration(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
