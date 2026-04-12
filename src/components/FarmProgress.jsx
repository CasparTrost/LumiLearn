import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Web Audio farm sounds ────────────────────────────────────────────────────
let _ac = null
function ac() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)()
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}
function tone(f, type, t0, dur, vol = 0.18) {
  try {
    const o = ac().createOscillator(), g = ac().createGain()
    o.connect(g); g.connect(ac().destination)
    o.type = type; o.frequency.setValueAtTime(f, t0)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.start(t0); o.stop(t0 + dur + 0.02)
  } catch {}
}
function noise(t0, dur, vol = 0.08) {
  try {
    const buf = ac().createBuffer(1, ac().sampleRate * dur, ac().sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = ac().createBufferSource()
    const filt = ac().createBiquadFilter()
    const g = ac().createGain()
    src.buffer = buf; filt.type = 'bandpass'; filt.frequency.value = 800
    src.connect(filt); filt.connect(g); g.connect(ac().destination)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    src.start(t0); src.stop(t0 + dur + 0.02)
  } catch {}
}

const farmSfx = {
  baa()    { const t = ac().currentTime; tone(220,'sine',t,0.3,0.2); tone(180,'sine',t+0.15,0.25,0.15) },
  cluck()  { const t = ac().currentTime; [0,0.08,0.16].forEach(d => tone(600+Math.random()*200,'square',t+d,0.06,0.12)) },
  moo()    { const t = ac().currentTime; tone(130,'sine',t,0.5,0.22); tone(160,'sine',t+0.1,0.45,0.12) },
  quack()  { const t = ac().currentTime; tone(500,'sawtooth',t,0.1,0.18); tone(350,'sawtooth',t+0.08,0.15,0.14) },
  chime()  { const t = ac().currentTime; [523,659,784,1047].forEach((f,i) => tone(f,'sine',t+i*0.08,0.2,0.16)) },
  splash() { const t = ac().currentTime; noise(t,0.3,0.12); tone(300,'sine',t,0.15,0.08) },
  rustle() { const t = ac().currentTime; noise(t,0.2,0.07) },
  knock()  { const t = ac().currentTime; tone(90,'sine',t,0.08,0.25); tone(90,'sine',t+0.15,0.08,0.2) },
  whoosh() { const t = ac().currentTime; noise(t,0.4,0.1); tone(200,'sine',t,0.4,0.05) },
  tinkle() { const t = ac().currentTime; [1200,1500,1800].forEach((f,i) => tone(f,'sine',t+i*0.05,0.15,0.1)) },
}

// ── Farm level config ────────────────────────────────────────────────────────
function getFarmLevel(n) {
  if (n <= 2)  return 1
  if (n <= 5)  return 2
  if (n <= 8)  return 3
  if (n <= 12) return 4
  if (n <= 16) return 5
  return 6
}
const LEVEL_LABELS = ['','Kleiner Bauernhof','Wachsender Hof','Blühender Hof','Großer Hof','Prächtiger Hof','Traumhof ⭐']
const SKY_COLORS = ['','#b8e4f9','#87ceeb','#5bb8f5','#3a9fd6','#1a80c4','#0d5fa3']
const NEXT_AT = [0,3,6,9,13,17,Infinity]

// ── Main Component ───────────────────────────────────────────────────────────
export default function FarmProgress({ completedCount = 0, totalModules = 17, profile }) {
  const level = getFarmLevel(completedCount)
  const [clicked, setClicked] = useState(null)
  const [windSpin, setWindSpin] = useState(false)
  const [cloudPos, setCloudPos] = useState(0)

  const click = useCallback((id, sfxFn) => {
    try { sfxFn() } catch {}
    setClicked(id)
    if (id === 'windmill') setWindSpin(true)
    if (id === 'cloud') setCloudPos(p => p + 30)
    setTimeout(() => setClicked(null), 1000)
    if (id === 'windmill') setTimeout(() => setWindSpin(false), 2000)
  }, [])

  const show = (minLevel) => level >= minLevel

  const popIn = {
    initial: { scale: 0, opacity: 0 },
    animate: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 400, damping: 15 } }
  }

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? `${NEXT_AT[level] - completedCount} Module bis zum nächsten Upgrade`
    : '🏆 Maximaler Hof erreicht!'

  return (
    <div style={{ width: '100%', maxWidth: 600, margin: '0 auto', userSelect: 'none' }}>
      {/* Farm label */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-primary)', fontWeight: 700 }}>
          🌾 {LEVEL_LABELS[level]}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
          {nextUnlock}
        </div>
      </div>

      {/* SVG Farm */}
      <div style={{ borderRadius: 24, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', cursor: 'default' }}>
        <svg viewBox="0 0 400 220" width="100%" style={{ display: 'block', background: SKY_COLORS[level] }}>
          <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SKY_COLORS[level]} />
              <stop offset="100%" stopColor="#e8f5e9" />
            </linearGradient>
            <linearGradient id="groundGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#66bb6a" />
              <stop offset="100%" stopColor="#388e3c" />
            </linearGradient>
          </defs>

          {/* Sky */}
          <rect x="0" y="0" width="400" height="220" fill="url(#skyGrad)" />

          {/* Ground */}
          <rect x="0" y="155" width="400" height="65" fill="url(#groundGrad)" />

          {/* Cloud (always visible, clickable) */}
          <motion.g
            animate={{ x: cloudPos }}
            transition={{ type: 'spring', stiffness: 60 }}
            onClick={() => click('cloud', farmSfx.rustle)}
            style={{ cursor: 'pointer' }}
          >
            <motion.g animate={clicked === 'cloud' ? { y: [-3, 0] } : {}}>
              <ellipse cx="80" cy="45" rx="30" ry="16" fill="white" opacity="0.9" />
              <ellipse cx="100" cy="38" rx="20" ry="14" fill="white" opacity="0.9" />
              <ellipse cx="62" cy="42" rx="18" ry="12" fill="white" opacity="0.85" />
            </motion.g>
          </motion.g>

          {/* Sun */}
          <motion.g
            onClick={() => click('sun', farmSfx.chime)}
            style={{ cursor: 'pointer' }}
            animate={clicked === 'sun' ? { rotate: 360 } : {}}
            transition={{ duration: 0.8, ease: 'easeInOut' }}
            transformOrigin="330 40"
          >
            <circle cx="330" cy="40" r="22" fill="#FFD93D" />
            {[0,45,90,135,180,225,270,315].map((a,i) => (
              <line key={i}
                x1={330 + Math.cos(a*Math.PI/180)*26}
                y1={40  + Math.sin(a*Math.PI/180)*26}
                x2={330 + Math.cos(a*Math.PI/180)*34}
                y2={40  + Math.sin(a*Math.PI/180)*34}
                stroke="#FFB800" strokeWidth="3" strokeLinecap="round"
              />
            ))}
          </motion.g>

          {/* House (always visible) */}
          <motion.g onClick={() => click('house', farmSfx.knock)} style={{ cursor: 'pointer' }}
            animate={clicked === 'house' ? { x: [-3,3,-2,2,0] } : {}} transition={{ duration: 0.4 }}>
            <rect x="30" y="120" width="60" height="40" fill="#8d6e63" rx="2" />
            <polygon points="20,122 90,122 55,90" fill="#c62828" />
            <rect x="50" y="135" width="14" height="25" fill="#5d4037" rx="2" />
            <rect x="35" y="128" width="12" height="10" fill="#81d4fa" rx="1" />
            <rect x="68" y="128" width="12" height="10" fill="#81d4fa" rx="1" />
          </motion.g>

          {/* Tree (level 2+) */}
          <AnimatePresence>{show(2) && (
            <motion.g key="tree" {...popIn} onClick={() => click('tree', farmSfx.rustle)} style={{ cursor: 'pointer' }}
              animate={clicked === 'tree' ? { rotate: [-5,5,-3,3,0] } : popIn.animate} transformOrigin="160 155">
              <rect x="157" y="130" width="6" height="28" fill="#795548" />
              <circle cx="160" cy="118" r="22" fill="#43a047" />
              <circle cx="148" cy="125" r="14" fill="#388e3c" />
              <circle cx="172" cy="124" r="14" fill="#2e7d32" />
            </motion.g>
          )}</AnimatePresence>

          {/* Sheep (level 2+) */}
          <AnimatePresence>{show(2) && (
            <motion.g key="sheep" {...popIn} onClick={() => click('sheep', farmSfx.baa)} style={{ cursor: 'pointer' }}
              animate={clicked === 'sheep' ? { y: [0,-8,0] } : popIn.animate} transition={{ type: 'spring', stiffness: 300 }}>
              <text x="195" y="168" fontSize="28" textAnchor="middle">🐑</text>
            </motion.g>
          )}</AnimatePresence>

          {/* Flowers (level 3+) */}
          <AnimatePresence>{show(3) && (
            <motion.g key="flowers" {...popIn}>
              {[[110,152,'#e91e63'],[122,150,'#9c27b0'],[134,153,'#ff9800']].map(([x,y,c],i) => (
                <motion.g key={i} onClick={() => click('flower'+i, farmSfx.tinkle)} style={{ cursor: 'pointer' }}
                  animate={clicked === 'flower'+i ? { scale: [1,1.5,1] } : {}} transition={{ duration: 0.4 }}>
                  <line x1={x} y1={y} x2={x} y2={y+8} stroke="#4caf50" strokeWidth="2" />
                  <circle cx={x} cy={y} r="5" fill={c} />
                  <circle cx={x} cy={y} r="2.5" fill="#fff176" />
                </motion.g>
              ))}
            </motion.g>
          )}</AnimatePresence>

          {/* Chicken (level 3+) */}
          <AnimatePresence>{show(3) && (
            <motion.g key="chicken" {...popIn} onClick={() => click('chicken', farmSfx.cluck)} style={{ cursor: 'pointer' }}
              animate={clicked === 'chicken' ? { y: [0,-5,0,-5,0] } : popIn.animate} transition={{ duration: 0.3 }}>
              <text x="240" y="168" fontSize="26" textAnchor="middle">🐔</text>
            </motion.g>
          )}</AnimatePresence>

          {/* Fence (level 3+) */}
          <AnimatePresence>{show(3) && (
            <motion.g key="fence" {...popIn}>
              {[270,285,300,315,330,345,360].map((x,i) => (
                <rect key={i} x={x} y="148" width="4" height="14" fill="#a1887f" rx="1" />
              ))}
              <rect x="270" y="150" width="94" height="3" fill="#a1887f" rx="1" />
              <rect x="270" y="157" width="94" height="3" fill="#a1887f" rx="1" />
            </motion.g>
          )}</AnimatePresence>

          {/* Barn (level 4+) */}
          <AnimatePresence>{show(4) && (
            <motion.g key="barn" {...popIn} onClick={() => click('barn', farmSfx.knock)} style={{ cursor: 'pointer' }}
              animate={clicked === 'barn' ? { x: [-2,2,-1,1,0] } : popIn.animate}>
              <rect x="290" y="110" width="70" height="48" fill="#c62828" rx="2" />
              <polygon points="282,112 368,112 325,82" fill="#b71c1c" />
              <rect x="316" y="125" width="18" height="33" fill="#4e342e" rx="1" />
              <rect x="295" y="116" width="14" height="12" fill="#81d4fa" rx="1" />
              <rect x="349" y="116" width="14" height="12" fill="#81d4fa" rx="1" />
              <text x="325" y="105" fontSize="11" textAnchor="middle" fill="#ffeb3b">★</text>
            </motion.g>
          )}</AnimatePresence>

          {/* Cow (level 4+) */}
          <AnimatePresence>{show(4) && (
            <motion.g key="cow" {...popIn} onClick={() => click('cow', farmSfx.moo)} style={{ cursor: 'pointer' }}
              animate={clicked === 'cow' ? { x: [-4,4,-2,2,0] } : popIn.animate} transition={{ duration: 0.5 }}>
              <text x="145" y="170" fontSize="28" textAnchor="middle">🐄</text>
            </motion.g>
          )}</AnimatePresence>

          {/* Pond (level 4+) */}
          <AnimatePresence>{show(4) && (
            <motion.g key="pond" {...popIn} onClick={() => click('pond', farmSfx.splash)} style={{ cursor: 'pointer' }}>
              <ellipse cx="220" cy="175" rx="28" ry="12" fill="#29b6f6" opacity="0.85" />
              <ellipse cx="220" cy="175" rx="22" ry="9" fill="#4fc3f7" opacity="0.6" />
              {clicked === 'pond' && [1,2,3].map(r => (
                <motion.ellipse key={r} cx="220" cy="175" rx={r*10} ry={r*4}
                  fill="none" stroke="#29b6f6" strokeWidth="1.5"
                  initial={{ opacity: 0.8, scale: 0 }} animate={{ opacity: 0, scale: 1 }}
                  transition={{ duration: 0.6, delay: r * 0.15 }} />
              ))}
              <text x="220" y="173" fontSize="18" textAnchor="middle">🦆</text>
            </motion.g>
          )}</AnimatePresence>

          {/* Windmill (level 5+) */}
          <AnimatePresence>{show(5) && (
            <motion.g key="windmill" {...popIn} onClick={() => click('windmill', farmSfx.whoosh)} style={{ cursor: 'pointer' }}>
              <rect x="73" y="110" width="8" height="50" fill="#9e9e9e" />
              <motion.g
                animate={{ rotate: windSpin ? 360*4 : 0 }}
                transition={{ duration: 2, ease: 'easeInOut' }}
                transformOrigin="77 118"
              >
                {[0,90,180,270].map((a,i) => (
                  <motion.rect key={i}
                    x="75" y="102" width="4" height="18" fill="#b0bec5" rx="2"
                    transform={`rotate(${a} 77 118)`}
                  />
                ))}
              </motion.g>
              <circle cx="77" cy="118" r="4" fill="#78909c" />
            </motion.g>
          )}</AnimatePresence>

          {/* Vegetable garden (level 5+) */}
          <AnimatePresence>{show(5) && (
            <motion.g key="garden" {...popIn} onClick={() => click('garden', farmSfx.rustle)} style={{ cursor: 'pointer' }}>
              <rect x="155" y="155" width="36" height="12" fill="#795548" rx="2" opacity="0.7" />
              {[160,168,176,184].map((x,i) => (
                <text key={i} x={x} y="158" fontSize="10">🥕</text>
              ))}
            </motion.g>
          )}</AnimatePresence>

          {/* Extra animals at level 6 */}
          <AnimatePresence>{show(6) && (
            <motion.g key="extras" {...popIn}>
              <text x="260" y="170" fontSize="22" textAnchor="middle"
                onClick={() => click('horse', farmSfx.knock)} style={{ cursor: 'pointer' }}>🐴</text>
              <text x="100" y="170" fontSize="20" textAnchor="middle"
                onClick={() => click('pig', farmSfx.cluck)} style={{ cursor: 'pointer' }}>🐷</text>
            </motion.g>
          )}</AnimatePresence>

          {/* Stars at max level */}
          {level === 6 && [50,150,250,350].map((x,i) => (
            <motion.text key={i} x={x} y="25" fontSize="14" textAnchor="middle"
              animate={{ opacity: [0.3,1,0.3], y: [25,20,25] }}
              transition={{ duration: 2+i*0.3, repeat: Infinity, ease: 'easeInOut' }}>
              ⭐
            </motion.text>
          ))}
        </svg>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.06)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(completedCount / totalModules) * 100}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ height: '100%', background: 'linear-gradient(90deg, #66bb6a, #43a047)', borderRadius: 99 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
        <span>{completedCount} / {totalModules} Module</span>
        <span>Level {level} / 6</span>
      </div>
    </div>
  )
}
