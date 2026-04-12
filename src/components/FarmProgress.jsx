import { useState, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"

const BASE = import.meta.env.BASE_URL || "/LumiLearn/"
const img = (name) => BASE + "images/farm/" + name + ".jpg"

// Farm sounds via Web Audio API
let _ac = null
function ac() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)()
  if (_ac.state === "suspended") _ac.resume()
  return _ac
}
function tone(f, type, t0, dur, vol = 0.15) {
  try {
    const o = ac().createOscillator(), g = ac().createGain()
    o.connect(g); g.connect(ac().destination)
    o.type = type; o.frequency.setValueAtTime(f, t0)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.start(t0); o.stop(t0 + dur + 0.05)
  } catch {}
}
const farmSfx = {
  baa()    { const t = ac().currentTime; tone(220,"sine",t,0.3,0.18); tone(180,"sine",t+0.15,0.25,0.12) },
  moo()    { const t = ac().currentTime; tone(130,"sine",t,0.5,0.2); tone(160,"sine",t+0.1,0.4,0.1) },
  cluck()  { const t = ac().currentTime; [0,0.08,0.16].forEach(d => tone(600+Math.random()*200,"square",t+d,0.06,0.1)) },
  toot()   { const t = ac().currentTime; tone(300,"square",t,0.15,0.2); tone(400,"square",t+0.1,0.15,0.15) },
  chime()  { const t = ac().currentTime; [523,659,784].forEach((f,i) => tone(f,"sine",t+i*0.08,0.2,0.14)) },
}

function getFarmLevel(n) {
  if (n <= 2) return 1
  if (n <= 5) return 2
  if (n <= 8) return 3
  if (n <= 12) return 4
  if (n <= 16) return 5
  return 6
}

const BG_IMAGES = {
  1: "farm_level1",
  2: "farm_level1",
  3: "farm_level3",
  4: "farm_level3",
  5: "farm_level5",
  6: "farm_level5",
}

const LEVEL_LABELS = ["","Kleiner Bauernhof","Wachsender Hof","Blühender Hof","Großer Hof","Prächtiger Hof","Traumhof ⭐"]
const NEXT_AT = [0,3,6,9,13,17,Infinity]

const popIn = {
  initial: { scale: 0, opacity: 0 },
  animate: { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 350, damping: 14 } }
}

function Animal({ src, sfx, x, y, size = 100, label }) {
  const [bounce, setBounce] = useState(false)
  const click = () => {
    try { sfx() } catch {}
    setBounce(true)
    setTimeout(() => setBounce(false), 700)
  }
  return (
    <motion.div
      onClick={click}
      {...popIn}
      animate={bounce ? { y: [0,-20,0,-10,0], scale:[1,1.15,1] } : popIn.animate}
      transition={bounce ? { duration: 0.6, type:"spring" } : undefined}
      style={{
        position:"absolute", left:x, bottom:y, width:size, height:size,
        cursor:"pointer", zIndex:2,
      }}
      title={label}
    >
      <img src={img(src)} alt={label} style={{ width:"100%", height:"100%", objectFit:"contain", filter:"drop-shadow(2px 4px 6px rgba(0,0,0,0.25))" }} />
    </motion.div>
  )
}

export default function FarmProgress({ completedCount = 0, totalModules = 17, profile }) {
  const level = getFarmLevel(completedCount)
  const show = (minLevel) => level >= minLevel

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? `${NEXT_AT[level] - completedCount} Module bis zum nächsten Upgrade`
    : "🏆 Maximaler Hof erreicht!"

  return (
    <div style={{ width:"100%", maxWidth:640, margin:"0 auto", userSelect:"none" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"0 4px" }}>
        <div style={{ fontFamily:"var(--font-heading)", fontSize:18, color:"var(--text-primary)", fontWeight:700 }}>
          🌾 {LEVEL_LABELS[level]}
        </div>
        <div style={{ fontSize:12, color:"var(--text-secondary)", fontFamily:"var(--font-body)" }}>
          {nextUnlock}
        </div>
      </div>

      {/* Farm scene */}
      <div style={{ borderRadius:24, overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.15)", position:"relative", aspectRatio:"16/9" }}>
        {/* Background image */}
        <AnimatePresence mode="wait">
          <motion.img
            key={BG_IMAGES[level]}
            src={img(BG_IMAGES[level])}
            initial={{ opacity:0 }}
            animate={{ opacity:1 }}
            exit={{ opacity:0 }}
            transition={{ duration:0.8 }}
            style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }}
            alt="Farm"
          />
        </AnimatePresence>

        {/* Overlay animals — positioned over background */}
        <div style={{ position:"absolute", inset:0 }}>
          {/* Sheep (level 2+) */}
          <AnimatePresence>
            {show(2) && <Animal key="sheep" src="sheep" sfx={farmSfx.baa} x="8%" y="10%" size={80} label="Schaf" />}
          </AnimatePresence>

          {/* Cow (level 4+) */}
          <AnimatePresence>
            {show(4) && <Animal key="cow" src="cow" sfx={farmSfx.moo} x="55%" y="8%" size={90} label="Kuh" />}
          </AnimatePresence>

          {/* Chicken (level 3+) */}
          <AnimatePresence>
            {show(3) && <Animal key="chicken" src="chicken" sfx={farmSfx.cluck} x="75%" y="8%" size={65} label="Huhn" />}
          </AnimatePresence>

          {/* Tractor (level 5+) */}
          <AnimatePresence>
            {show(5) && <Animal key="tractor" src="tractor" sfx={farmSfx.toot} x="30%" y="5%" size={100} label="Traktor" />}
          </AnimatePresence>

          {/* Farmer (level 3+) */}
          <AnimatePresence>
            {show(3) && <Animal key="farmer" src="farmer" sfx={farmSfx.chime} x="20%" y="8%" size={75} label="Bauer" />}
          </AnimatePresence>

          {/* Level badge */}
          <div style={{
            position:"absolute", top:10, right:10,
            background:"rgba(0,0,0,0.55)", backdropFilter:"blur(6px)",
            borderRadius:20, padding:"4px 12px",
            fontFamily:"var(--font-heading)", fontSize:13, color:"white", fontWeight:700,
          }}>
            Level {level} / 6
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop:10, background:"rgba(0,0,0,0.06)", borderRadius:99, height:8, overflow:"hidden" }}>
        <motion.div
          initial={{ width:0 }}
          animate={{ width: `${(completedCount / totalModules) * 100}%` }}
          transition={{ duration:1, ease:"easeOut" }}
          style={{ height:"100%", background:"linear-gradient(90deg,#66bb6a,#43a047)", borderRadius:99 }}
        />
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", marginTop:4, fontSize:12, color:"var(--text-secondary)", fontFamily:"var(--font-body)" }}>
        <span>{completedCount} / {totalModules} Module</span>
        <span>Tippe auf die Tiere! 🐄🐑</span>
      </div>
    </div>
  )
}
