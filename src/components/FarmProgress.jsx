import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { narrate } from '../narrator.js'
import { sayNumber } from '../tts.js'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
export const farmAsset = (n) => BASE + 'sprites/farm/' + n
const asset = farmAsset

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
  { id:'chicken', name:'Huhn',    art:'das', gif:'anim_chicken.gif', gifRight:'anim_chicken_right.gif', size:40, zone:'Huhnerstall',   sfx:sfx.cluck, emoji:'🐔' },
  { id:'sheep',   name:'Schaf',   art:'das', gif:'anim_sheep.gif',   gifRight:'anim_sheep_right.gif',   size:52, zone:'Schafgehege',   sfx:sfx.baa,   emoji:'🐑' },
  { id:'pig',     name:'Schwein', art:'das', gif:'anim_pig.gif',     gifRight:'anim_pig_right.gif',     size:54, zone:'Schweinestall', sfx:sfx.oink,  emoji:'🐷' },
  { id:'cow',     name:'Kuh',     art:'die', gif:'anim_cow.gif',     gifRight:'anim_cow_right.gif',     size:60, zone:'Kuhstall',      sfx:sfx.moo,   emoji:'🐄' },
  { id:'horse',   name:'Pferd',   art:'das', gif:'anim_horse.gif',   gifRight:'anim_horse_left.gif',    size:64, zone:'Pferdekoppel',  sfx:sfx.neigh, emoji:'🐴', facesRight:true },
]
const DEF = Object.fromEntries(ANIMAL_DEFS.map(d => [d.id, d]))

// Der Hof wächst mit den Sternen. Vorher kam das erste Tier erst nach drei
// komplett gemeisterten Spielen (25–30 erfolgreiche Runden) — tagelang
// passierte auf dem Hof nichts. Jetzt wohnt ab dem ersten Tag ein Huhn dort,
// und schon die ersten Runden bringen das nächste Tier; später werden die
// Abstände größer. Punkte = Sterne (bestes Ergebnis je Level) plus zwei
// Extra-Sterne je geschaffter Tagesaufgabe (AppContext farmPoints).
const ARRIVALS   = ['chicken','sheep','pig','cow','chicken','sheep','pig','horse','chicken','sheep','cow','pig','chicken','sheep','horse']
const THRESHOLDS = [0, 2, 5, 9, 14, 20, 27, 35, 44, 54, 65, 77, 90, 105, 120]

/** The animals living on the farm with this many points, in arrival order. */
export function animalsFor(points) {
  const seen = {}
  return ARRIVALS.filter((_, i) => points >= THRESHOLDS[i]).map(id => {
    seen[id] = (seen[id] ?? 0) + 1
    return { ...DEF[id], instanceId: `${id}_${seen[id] - 1}` }
  })
}

/** The next animal and how many stars are still missing, or null when full. */
export function nextAnimal(points) {
  const i = THRESHOLDS.findIndex(t => points < t)
  if (i < 0) return null
  return { ...DEF[ARRIVALS[i]], missing: THRESHOLDS[i] - points, at: THRESHOLDS[i], from: THRESHOLDS[i - 1] ?? 0 }
}

/** "das Huhn" → "zum Huhn", "die Kuh" → "zur Kuh" */
export const zumTier = a => `${a.art === 'die' ? 'zur' : 'zum'} ${a.name}`
/** "ein Huhn", "eine Kuh" */
export const einTier = a => `${a.art === 'die' ? 'eine' : 'ein'} ${a.name}`

// Exported so ParentScreen and the results show the same farm the kid sees.
export function getFarmLevel(points) {
  const n = animalsFor(points).length
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=11) return 4; if (n<=14) return 5; return 6
}
// One list of names (the celebration used to have its own, different one)
export const FARM_LEVEL_LABELS = ['','Kleiner Hof','Wachsender Hof','Blühender Hof','Großer Hof','Prächtiger Hof','Traumhof']

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

// The animals only move while the farm can be seen: page visible and the
// farm on screen. Scrolled away they used to keep a requestAnimationFrame
// loop and a React update per animal running, which costs battery on a
// weak tablet.
const FarmVisible = React.createContext({ current: true })
function useFarmVisible() {
  return React.useContext(FarmVisible)
}

function RoamingAnimal({ def, farmScale = 1, delay = 0 }) {
  const posRef = useRef(randomInZone(def.zone))
  const targetRef = useRef(randomInZone(def.zone))
  const pauseRef = useRef(false)
  const pauseTimerRef = useRef(null)
  const visibleRef = useFarmVisible()
  const [pos, setPos] = useState(posRef.current)
  const [movingRight, setMovingRight] = useState(false)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let lastTick = 0
    let rafId
    const INTERVAL = 100 // ms between logic ticks (10fps is plenty for animals)
    const tick = (now) => {
      rafId = requestAnimationFrame(tick)
      if (!visibleRef.current || now - lastTick < INTERVAL) return
      lastTick = now
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
        const newX = posRef.current.x + (dx/dist)*0.8
        const newY = posRef.current.y + (dy/dist)*0.8
        const zonePoints = ZONES[def.zone]
        if (!zonePoints || pointInPoly(newX, newY, zonePoints)) {
          posRef.current = { x: newX, y: newY }
          setPos({...posRef.current})
          if (Math.abs(dx) > Math.abs(dy) * 0.3) setMovingRight(dx > 0)
        } else {
          targetRef.current = randomInZone(def.zone)
        }
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(rafId); if(pauseTimerRef.current) clearTimeout(pauseTimerRef.current) }
  }, [def.zone]) // eslint-disable-line react-hooks/exhaustive-deps

  const click = () => { try { def.sfx() } catch {} narrate([{ text: `${def.art === 'die' ? 'Die' : 'Das'} ${def.name}!` }]) }

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
          filter:'drop-shadow(0 2px 0 rgba(42,27,61,.35))' }}/>
    </motion.div>
  )
}

function Farmer({ farmScale = 1 }) {
  const wps = FARMER_PATH
  const posRef = useRef(wps[0])
  const wpRef = useRef(0)
  const pauseRef = useRef(false)
  const visibleRef = useFarmVisible()
  const [pos, setPos] = useState(wps[0])
  const [dir, setDir] = useState('idle_front')

  useEffect(() => {
    let lastTick = 0
    let rafId
    const INTERVAL = 80
    const tick = (now) => {
      rafId = requestAnimationFrame(tick)
      if (!visibleRef.current || now - lastTick < INTERVAL) return
      lastTick = now
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
        posRef.current = { x: posRef.current.x+dx/dist*1.0, y: posRef.current.y+dy/dist*1.0 }
        setPos({...posRef.current})
        const adx=Math.abs(dx), ady=Math.abs(dy)
        if (adx > ady) setDir(dx > 0 ? 'right' : 'left')
        else setDir(dy > 0 ? 'down' : 'up')
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
          filter:'drop-shadow(0 2px 0 rgba(42,27,61,.35))' }}/>
    </div>
  )
}

export default function FarmProgress({ points = 0 }) {
  const level = getFarmLevel(points)
  const next = nextAnimal(points)
  const pct = next ? Math.round(((points - next.from) / (next.at - next.from)) * 100) : 100

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

  // visible = page shown and farm on screen
  const visibleRef = useRef(!document.hidden)
  useEffect(() => {
    let onScreen = true
    const sync = () => { visibleRef.current = onScreen && !document.hidden }
    const io = typeof IntersectionObserver !== 'undefined' && farmRef.current
      ? new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync() })
      : null
    io?.observe(farmRef.current)
    document.addEventListener('visibilitychange', sync)
    return () => { io?.disconnect(); document.removeEventListener('visibilitychange', sync) }
  }, [])

  const animals = animalsFor(points)
  const goal = next
    ? `Noch ${next.missing} ⭐ bis ${zumTier(next)}`
    : 'Alle Tiere sind da!'
  const sayGoal = next
    ? `Auf deinem Hof wohnen schon ${animals.length === 1 ? 'ein Tier' : `${sayNumber(animals.length)} Tiere`}. Noch ${sayNumber(next.missing)} ${next.missing === 1 ? 'Stern' : 'Sterne'}, dann kommt ${einTier(next)}.`
    : 'Alle Tiere wohnen auf deinem Hof. Toll!'

  return (
    <div className="farm-progress-wrapper" style={{
      width:'100%', userSelect:'none',
      // Pixel frame like every panel (styles/pixel.css)
      border:'3px solid var(--px-ink)', borderRadius:'var(--px-radius)', overflow:'hidden',
      boxShadow:'0 5px 0 var(--px-ink-soft)', background:'var(--px-parch)',
    }}>

      {/* Header: what the farm is, and what comes next */}
      <button className="px-wood" onClick={() => narrate([{ text: sayGoal }])}
        aria-label={`${FARM_LEVEL_LABELS[level]}. ${goal.replace('⭐', 'Sterne')}`}
        style={{
          width:'100%', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10,
          padding:'6px 12px', borderBottom:'3px solid var(--px-ink)', textAlign:'left', cursor:'pointer',
        }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          <span style={{fontSize:22}}>🌾</span>
          <div style={{ minWidth:0 }}>
            <div className="px-title" style={{fontSize:17, lineHeight:1.15}}>
              {FARM_LEVEL_LABELS[level]}
            </div>
            <div className="px-title" style={{fontSize:14, lineHeight:1.2, letterSpacing:0, textShadow:'-1px -1px 0 var(--px-ink), 1px -1px 0 var(--px-ink), -1px 1px 0 var(--px-ink), 1px 2px 0 var(--px-ink)'}}>
              {goal}
            </div>
          </div>
        </div>
        {next && (
          <img src={asset(next.gif)} alt={next.name} className="px-art"
            style={{ width:40, height:40, objectFit:'contain', flexShrink:0, filter:'brightness(0.25) opacity(0.75)' }} />
        )}
      </button>

      {/* Farm */}
      <div ref={farmRef} className="farm-scene" style={{ position:'relative', overflow:'hidden', width:'100%',
        // own stacking context: the animals' z-index (their y position, up
        // to ~430) stays inside the farm instead of rising above the
        // profile and level sheets
        isolation:'isolate',
        cursor:'url(' + BASE + 'sprites/farm/cursor_fork.png) 4 4, crosshair' }}>
        <img src={asset('farm_final.png')} alt="Dein Bauernhof" width={1376} height={768} style={{width:'100%', height:'auto', display:'block'}}/>
        <div style={{position:'absolute',inset:0}}>
          <FarmVisible.Provider value={visibleRef}>
            <AnimatePresence>
              {animals.map((a, i) => (
                <RoamingAnimal key={a.instanceId} def={a} farmScale={farmScale} delay={i * 0.08}/>
              ))}
            </AnimatePresence>
            <Farmer farmScale={farmScale}/>
          </FarmVisible.Provider>
        </div>
      </div>

      {/* Progress to the next animal */}
      <div className="px-wood" style={{
        padding:'6px 12px 8px',
        borderTop:'3px solid var(--px-ink)', borderBottom:'none', boxShadow:'none',
      }}>
        <div style={{background:'rgba(42,27,61,.55)',borderRadius:4,height:14,overflow:'hidden',
          border:'2px solid var(--px-ink)'}}>
          <motion.div initial={{width:0}} animate={{width:`${pct}%`}}
            transition={{duration:1.2,ease:'easeOut'}}
            style={{height:'100%',background:'var(--px-gold)',
              boxShadow:'inset 0 2px 0 rgba(255,255,255,.4)'}}/>
        </div>
      </div>
    </div>
  )
}
