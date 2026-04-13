import { useState, useCallback, useEffect, useRef } from 'react'
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

// Zone definitions from positioner (640x357 scale)
const ZONES = {
  Pferdekoppel:  [{x:56,y:220},{x:187,y:219},{x:162,y:274},{x:32,y:273}],
  Schafgehege:   [{x:304,y:198},{x:398,y:198},{x:403,y:283},{x:240,y:281},{x:263,y:220}],
  Huhnerstall:   [{x:439,y:199},{x:510,y:198},{x:509,y:233},{x:439,y:232}],
  Schweinestall: [{x:534,y:235},{x:619,y:241},{x:623,y:289},{x:533,y:288}],
  Wege: [{x:3,y:313},{x:91,y:315},{x:96,y:301},{x:122,y:301},{x:122,y:313},{x:173,y:311},{x:215,y:217},{x:207,y:200},{x:139,y:202},{x:108,y:163},{x:109,y:115},{x:132,y:112},{x:128,y:165},{x:157,y:195},{x:252,y:183},{x:290,y:178},{x:287,y:164},{x:321,y:152},{x:428,y:157},{x:427,y:176},{x:310,y:177},{x:243,y:200},{x:200,y:316},{x:455,y:316},{x:456,y:249},{x:477,y:250},{x:475,y:316},{x:551,y:318},{x:549,y:305},{x:580,y:304},{x:580,y:314},{x:633,y:315},{x:633,y:341},{x:5,y:337}],
}

// Get random point inside a polygon (rejection sampling)
function randomPointInPolygon(points, attempts = 50) {
  const xs = points.map(p=>p.x), ys = points.map(p=>p.y)
  const minX=Math.min(...xs), maxX=Math.max(...xs)
  const minY=Math.min(...ys), maxY=Math.max(...ys)
  for (let i=0;i<attempts;i++) {
    const x = minX + Math.random()*(maxX-minX)
    const y = minY + Math.random()*(maxY-minY)
    if (pointInPoly(x,y,points)) return {x,y}
  }
  return {x:(minX+maxX)/2, y:(minY+maxY)/2}
}

function pointInPoly(px,py,points) {
  let inside=false
  for (let i=0,j=points.length-1;i<points.length;j=i++) {
    const xi=points[i].x,yi=points[i].y,xj=points[j].x,yj=points[j].y
    if (((yi>py)!==(yj>py))&&(px<(xj-xi)*(py-yi)/(yj-yi)+xi)) inside=!inside
  }
  return inside
}

// Autonomous animal that roams within its zone
function RoamingAnimal({ gif, zone, size, sfxFn, delay=0, flip=false, label, show }) {
  const points = ZONES[zone] || []
  const [pos, setPos] = useState(() => randomPointInPolygon(points))
  const [target, setTarget] = useState(() => randomPointInPolygon(points))
  const [facingLeft, setFacingLeft] = useState(flip)
  const [bounce, setBounce] = useState(false)
  const rafRef = useRef(null)
  const posRef = useRef(pos)
  const targetRef = useRef(target)

  useEffect(() => {
    if (!show) return
    let frame = 0
    const moveInterval = setInterval(() => {
      // Move toward target
      const dx = targetRef.current.x - posRef.current.x
      const dy = targetRef.current.y - posRef.current.y
      const dist = Math.sqrt(dx*dx + dy*dy)
      const speed = 0.4
      if (dist < 2) {
        // Pick new target
        const newTarget = randomPointInPolygon(points)
        targetRef.current = newTarget
        setTarget(newTarget)
      } else {
        const newPos = {
          x: posRef.current.x + (dx/dist)*speed,
          y: posRef.current.y + (dy/dist)*speed,
        }
        posRef.current = newPos
        setPos({...newPos})
        setFacingLeft(dx < 0)
      }
    }, 50)
    return () => clearInterval(moveInterval)
  }, [show, zone])

  const handleClick = () => {
    try { sfxFn() } catch {}
    setBounce(true)
    setTimeout(() => setBounce(false), 600)
  }

  if (!show) return null

  return (
    <motion.div
      initial={{ scale:0, opacity:0 }}
      animate={{ scale:1, opacity:1 }}
      exit={{ scale:0, opacity:0 }}
      transition={{ type:'spring', stiffness:260, delay }}
      style={{
        position:'absolute',
        left: pos.x - size/2,
        top: pos.y - size/2,
        width: size,
        cursor:'pointer',
        zIndex: Math.round(pos.y),
        pointerEvents:'auto',
      }}
      onClick={handleClick}
      title={label}
    >
      <motion.img
        src={gif}
        alt={label}
        style={{
          width:'100%',
          imageRendering:'pixelated',
          transform: facingLeft ? 'scaleX(-1)' : 'none',
          filter:'drop-shadow(1px 3px 3px rgba(0,0,0,0.4))',
        }}
        animate={bounce ? { y:[0,-14,0,-7,0], scale:[1,1.15,1] } : {}}
        transition={{ duration:.5, type:'spring' }}
      />
    </motion.div>
  )
}

// Farmer that walks along waypoints
function Farmer({ show }) {
  const waypoints = ZONES.Wege
  const [pos, setPos] = useState(waypoints[0])
  const [wpIdx, setWpIdx] = useState(0)
  const [facingLeft, setFacingLeft] = useState(false)
  const posRef = useRef(waypoints[0])
  const wpIdxRef = useRef(0)

  useEffect(() => {
    if (!show) return
    const moveInterval = setInterval(() => {
      const target = waypoints[wpIdxRef.current]
      const dx = target.x - posRef.current.x
      const dy = target.y - posRef.current.y
      const dist = Math.sqrt(dx*dx + dy*dy)
      const speed = 0.6
      if (dist < 2) {
        const next = (wpIdxRef.current + 1) % waypoints.length
        wpIdxRef.current = next
        setWpIdx(next)
      } else {
        const newPos = {
          x: posRef.current.x + (dx/dist)*speed,
          y: posRef.current.y + (dy/dist)*speed,
        }
        posRef.current = newPos
        setPos({...newPos})
        setFacingLeft(dx < 0)
      }
    }, 50)
    return () => clearInterval(moveInterval)
  }, [show])

  if (!show) return null

  return (
    <motion.div
      initial={{ opacity:0 }}
      animate={{ opacity:1 }}
      style={{
        position:'absolute',
        left: pos.x - 24,
        top: pos.y - 48,
        width: 48,
        zIndex: Math.round(pos.y) + 10,
        pointerEvents:'none',
      }}
    >
      <img
        src={asset('anim_farmer.gif')}
        alt="Bauer"
        style={{
          width:'100%',
          imageRendering:'pixelated',
          transform: facingLeft ? 'scaleX(-1)' : 'none',
          filter:'drop-shadow(1px 3px 3px rgba(0,0,0,0.5))',
        }}
      />
    </motion.div>
  )
}

function Sparkle({ x, y }) {
  return (
    <div style={{ position:'absolute', left:x, top:y, pointerEvents:'none', zIndex:999 }}>
      {['*','+','.'].map((c,i) => (
        <motion.div key={i} initial={{opacity:1,x:0,y:0}} animate={{opacity:0,x:(i-1)*20,y:-32}}
          transition={{duration:.6,delay:i*.07}}
          style={{position:'absolute',color:'#FFD93D',fontSize:16,fontFamily:'monospace',fontWeight:'bold'}}>
          {c}
        </motion.div>
      ))}
    </div>
  )
}

export default function FarmProgress({ completedCount=0, totalModules=17 }) {
  const level = getLevel(completedCount)
  const show  = (min) => level >= min
  const [spark, setSpark] = useState(null)

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? (NEXT_AT[level] - completedCount) + ' bis naechstes Level'
    : 'Max Level!'
  const pct = Math.round((completedCount / totalModules) * 100)

  return (
    <div style={{ width:'100%', maxWidth:640, margin:'0 auto', userSelect:'none',
      borderRadius:20, overflow:'hidden', boxShadow:'0 12px 40px rgba(0,0,0,0.25)' }}>

      <div style={{ position:'relative', overflow:'hidden' }}>
        <img src={asset('farm_final.png')} alt="Farm"
          style={{ width:'100%', display:'block' }} />

        <div style={{ position:'absolute', inset:0 }}>
          <AnimatePresence>
            {show(5) && <RoamingAnimal key="horse" gif={asset('anim_cow.gif')} zone="Pferdekoppel" size={64} sfxFn={sfx.moo} delay={.1} label="Pferd" show={show(5)}/>}
          </AnimatePresence>
          <AnimatePresence>
            {show(2) && <RoamingAnimal key="sheep1" gif={asset('anim_sheep.gif')} zone="Schafgehege" size={52} sfxFn={sfx.baa} delay={.1} label="Schaf" show={show(2)}/>}
          </AnimatePresence>
          <AnimatePresence>
            {show(4) && <RoamingAnimal key="sheep2" gif={asset('anim_sheep.gif')} zone="Schafgehege" size={52} sfxFn={sfx.baa} delay={.2} flip label="Schaf" show={show(4)}/>}
          </AnimatePresence>
          <AnimatePresence>
            {show(2) && <RoamingAnimal key="chicken1" gif={asset('anim_chicken.gif')} zone="Huhnerstall" size={40} sfxFn={sfx.cluck} delay={.1} label="Huhn" show={show(2)}/>}
          </AnimatePresence>
          <AnimatePresence>
            {show(3) && <RoamingAnimal key="chicken2" gif={asset('anim_chicken.gif')} zone="Huhnerstall" size={40} sfxFn={sfx.cluck} delay={.2} flip label="Huhn" show={show(3)}/>}
          </AnimatePresence>
          <AnimatePresence>
            {show(5) && <RoamingAnimal key="chicken3" gif={asset('anim_chicken.gif')} zone="Huhnerstall" size={36} sfxFn={sfx.cluck} delay={.15} label="Huhn" show={show(5)}/>}
          </AnimatePresence>
          <AnimatePresence>
            {show(3) && <RoamingAnimal key="pig" gif={asset('anim_pig.gif')} zone="Schweinestall" size={56} sfxFn={sfx.oink} delay={.1} label="Schwein" show={show(3)}/>}
          </AnimatePresence>
          <AnimatePresence>
            {show(4) && <RoamingAnimal key="pig2" gif={asset('anim_pig.gif')} zone="Schweinestall" size={52} sfxFn={sfx.oink} delay={.2} flip label="Schwein" show={show(4)}/>}
          </AnimatePresence>
          {/* Farmer walks the paths from level 2 */}
          <Farmer show={show(2)} />

          {level===6 && [50,150,280,400,520].map((x,i)=>(
            <motion.div key={i} style={{position:'absolute',top:8,left:x,color:'#FFD93D',
              fontSize:14,pointerEvents:'none',zIndex:20,fontWeight:'bold'}}
              animate={{opacity:[.2,1,.2],y:[0,-4,0]}} transition={{duration:1.8,repeat:Infinity,delay:i*.4}}>
              *
            </motion.div>
          ))}

          {spark && <Sparkle key={spark.key} x={spark.x} y={spark.y}/>}
        </div>
      </div>

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
