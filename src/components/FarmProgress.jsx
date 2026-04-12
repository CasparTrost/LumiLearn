import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Web Audio API helpers ─────────────────────────────────────────────────────
let _actx = null
function getCtx() {
  if (typeof window === 'undefined') return null
  if (!_actx) {
    try { _actx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
  }
  if (_actx.state === 'suspended') _actx.resume().catch(() => {})
  return _actx
}
function tone(freq, type, delay, dur, vol = 0.20, freqEnd) {
  const ac = getCtx(); if (!ac) return
  try {
    const t = ac.currentTime + delay
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.start(t); osc.stop(t + dur + 0.02)
  } catch { /* ignore */ }
}
function noise(delay, dur, vol = 0.12, filterFreq = 2000) {
  const ac = getCtx(); if (!ac) return
  try {
    const t       = ac.currentTime + delay
    const bufSize = Math.floor(ac.sampleRate * Math.min(dur + 0.1, 1))
    const buf     = ac.createBuffer(1, bufSize, ac.sampleRate)
    const data    = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
    const src  = ac.createBufferSource()
    src.buffer = buf
    const flt  = ac.createBiquadFilter()
    flt.type   = 'bandpass'
    flt.frequency.value = filterFreq
    flt.Q.value = 1.2
    const g = ac.createGain()
    src.connect(flt); flt.connect(g); g.connect(ac.destination)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.start(t); src.stop(t + dur + 0.05)
  } catch { /* ignore */ }
}

// ── Farm sound effects ────────────────────────────────────────────────────────
const farmSfx = {
  // 🐑 Sheep — low sine wobble
  baa()    { tone(200,'sine',0,0.18,0.26,220); tone(185,'sine',0.16,0.22,0.18,170); tone(200,'sine',0.34,0.18,0.14) },
  // 🐔 Chicken — rapid short bursts
  cluck()  { tone(700,'square',0,0.04,0.16); tone(620,'square',0.06,0.04,0.14); tone(760,'square',0.12,0.03,0.13); tone(630,'square',0.17,0.04,0.10) },
  // 🐄 Cow — sustained low tone
  moo()    { tone(150,'sawtooth',0,0.55,0.22,130); tone(158,'sine',0.08,0.45,0.10) },
  // 🦆 Duck — quick descending
  quack()  { tone(500,'sine',0,0.06,0.22,300); tone(470,'sine',0.08,0.10,0.16,270) },
  // ☀️ Sun — ascending chime
  chime()  { tone(523,'sine',0,0.14,0.20); tone(659,'sine',0.09,0.16,0.18); tone(784,'sine',0.19,0.18,0.16); tone(1047,'sine',0.30,0.22,0.13) },
  // 🔵 Pond — filtered noise splash
  splash() { noise(0,0.10,0.18,900); noise(0.04,0.16,0.14,1300); noise(0.09,0.12,0.09,500) },
  // 🌳 Tree — noise rustle
  rustle() { noise(0,0.07,0.16,3200); noise(0.05,0.09,0.12,4500); noise(0.11,0.06,0.08,2600) },
  // 🏠 House — two quick thumps
  knock()  { tone(80,'sine',0,0.09,0.28); tone(80,'sine',0.16,0.09,0.24) },
  // 🌸 Flowers — high tinkle
  tinkle() { tone(1318,'sine',0,0.10,0.16); tone(1568,'sine',0.07,0.11,0.14); tone(2093,'sine',0.14,0.13,0.11) },
  // 💨 Windmill — whoosh
  whoosh() { noise(0,0.22,0.20,700); noise(0.08,0.20,0.15,1000); noise(0.18,0.16,0.10,450) },
  // 🐎 Horse — neigh-ish
  neigh()  { tone(350,'sawtooth',0,0.20,0.18,420); tone(300,'sine',0.18,0.30,0.14,250) },
}

// ── Farm stage config ─────────────────────────────────────────────────────────
const STAGES = [
  { min:0,  level:1, label:'Kleines Feld',      skyA:'#C8E8FF', skyB:'#E0F4FF' },
  { min:3,  level:2, label:'Wachsender Hof',    skyA:'#90CAF9', skyB:'#C8E8FF' },
  { min:6,  level:3, label:'Blühender Bauernhof', skyA:'#42A5F5', skyB:'#90CAF9' },
  { min:9,  level:4, label:'Großer Hof',         skyA:'#1565C0', skyB:'#1E88E5' },
  { min:13, level:5, label:'Prächtiger Hof',     skyA:'#0D47A1', skyB:'#1565C0' },
  { min:17, level:6, label:'🌟 Traumfarm',       skyA:'#1A237E', skyB:'#0D47A1' },
]

function getStage(n) {
  let s = STAGES[0]
  for (const st of STAGES) { if (n >= st.min) s = st }
  return s
}
function getNextStage(n) {
  for (const st of STAGES) { if (n < st.min) return st }
  return null
}

// ── Sub-components ────────────────────────────────────────────────────────────

function WindmillBlades({ cx, cy, fast }) {
  return (
    <motion.g
      style={{ originX: `${cx}px`, originY: `${cy}px` }}
      animate={{ rotate: [0, 360] }}
      transition={{ duration: fast ? 0.7 : 3.5, repeat: Infinity, ease: 'linear' }}
    >
      {[0, 90, 180, 270].map((a, i) => {
        const r   = (a * Math.PI) / 180
        const x2  = cx + Math.cos(r) * 20
        const y2  = cy + Math.sin(r) * 20
        return <line key={i} x1={cx} y1={cy} x2={x2} y2={y2} stroke="#8B6914" strokeWidth={5} strokeLinecap="round" />
      })}
      <circle cx={cx} cy={cy} r={4.5} fill="#A0784A" />
    </motion.g>
  )
}

function PondRipples({ cx, cy }) {
  return (
    <>
      {[0, 1, 2].map(i => (
        <motion.ellipse
          key={i}
          cx={cx} cy={cy} rx={0} ry={0}
          fill="none" stroke="rgba(255,255,255,0.65)" strokeWidth={1.5}
          animate={{ rx: [0, 26 + i*9], ry: [0, 9 + i*3], opacity: [0.9, 0] }}
          transition={{ duration: 1.1, delay: i * 0.22, ease: 'easeOut' }}
        />
      ))}
    </>
  )
}

const popIn = {
  hidden:  { scale: 0, opacity: 0 },
  visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 440, damping: 16 } },
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FarmProgress({ completedCount = 0, totalModules = 17, profile }) {
  const [active,   setActive]   = useState(null)
  const [windFast, setWindFast] = useState(false)
  const timerRef = useRef(null)

  const n         = completedCount
  const stage     = getStage(n)
  const nextStage = getNextStage(n)
  const toNext    = nextStage ? nextStage.min - n : 0

  // visibility flags
  const show = {
    sun:      true,
    clouds:   true,
    house:    true,
    tree:     n >= 3,
    sheep:    n >= 3,
    flowers:  n >= 6,
    chicken:  n >= 6,
    fence:    n >= 6,
    barn:     n >= 9,
    cow:      n >= 9,
    pond:     n >= 9,
    duck:     n >= 9,
    windmill: n >= 13,
    garden:   n >= 13,
    horse:    n >= 17,
    rainbow:  n >= 17,
  }

  function tap(id, sfxFn, extraFn) {
    if (timerRef.current) clearTimeout(timerRef.current)
    setActive(id)
    try { sfxFn() } catch { /* audio blocked */ }
    if (extraFn) extraFn()
    timerRef.current = setTimeout(() => setActive(null), 1800)
  }

  const W = 480, H = 260
  const groundY = H * 0.55

  return (
    <div style={{
      margin: 'clamp(10px,2vw,18px) clamp(16px,4vw,40px)',
      borderRadius: 24,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.16)',
      background: 'white',
    }}>

      {/* ── Header bar ── */}
      <div style={{
        background: `linear-gradient(135deg, ${stage.skyA}, ${stage.skyB})`,
        padding: '10px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 8,
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'white',
            fontSize: 'clamp(14px,3vw,19px)', lineHeight: 1.2,
          }}>
            🌾 Level {stage.level} — {stage.label}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'clamp(11px,2vw,13px)', marginTop: 2 }}>
            {nextStage
              ? `Noch ${toNext} Modul${toNext !== 1 ? 'e' : ''} bis zum nächsten Upgrade!`
              : '🏆 Maximale Farm erreicht!'}
          </div>
        </div>
        <div style={{
          background: 'rgba(255,255,255,0.22)', borderRadius: 99, padding: '4px 14px',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(12px,2.2vw,15px)',
          color: 'white', fontWeight: 700, flexShrink: 0,
        }}>
          {n}/{totalModules} ✅
        </div>
      </div>

      {/* ── SVG Farm Scene ── */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block' }}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="fp-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stage.skyA} />
            <stop offset="100%" stopColor={stage.skyB} />
          </linearGradient>
          <radialGradient id="fp-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#FFE566" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0.4" />
          </radialGradient>
          <radialGradient id="fp-pond" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#74B9FF" />
            <stop offset="100%" stopColor="#0984E3" />
          </radialGradient>
        </defs>

        {/* Sky */}
        <rect x={0} y={0} width={W} height={H} fill="url(#fp-sky)" />

        {/* Ground */}
        <rect x={0} y={groundY} width={W} height={H - groundY} fill="#5D8A3C" />
        <rect x={0} y={groundY} width={W} height={7} fill="#72B843" />

        {/* ── Rainbow (level 6) ── */}
        <AnimatePresence>
          {show.rainbow && (
            <motion.g key="rainbow" initial="hidden" animate="visible" variants={popIn}>
              {['#FF6B6B','#FF9F43','#FFD93D','#6BCB77','#74B9FF','#A29BFE'].map((c, i) => (
                <path key={i}
                  d={`M 10 ${groundY} A ${80-i*7} ${55-i*5} 0 0 1 ${W*0.52} ${groundY}`}
                  fill="none" stroke={c} strokeWidth={6} opacity={0.65}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Clouds ── */}
        <AnimatePresence>
          {show.clouds && ['cloud1','cloud2','cloud3'].map((id, ci) => {
            const props = [
              { cx:75,  cy:38, rx:34, ry:15, op:0.88 },
              { cx:345, cy:28, rx:27, ry:12, op:0.80 },
              { cx:195, cy:20, rx:21, ry:10, op:0.70 },
            ][ci]
            if (ci === 2 && !show.windmill) return null
            return (
              <motion.g
                key={id}
                initial="hidden" animate="visible" variants={popIn}
                style={{ cursor: 'pointer' }}
                onClick={() => tap(id, () => {})}
                animate={active === id
                  ? { x: [0, 90, 200], opacity: [1, 1, 0], transition: { duration: 2.2, ease: 'easeInOut' } }
                  : { x: 0, opacity: props.op }}
              >
                <ellipse cx={props.cx} cy={props.cy} rx={props.rx} ry={props.ry} fill="white" />
                <ellipse cx={props.cx - props.rx*0.33} cy={props.cy+3} rx={props.rx*0.54} ry={props.ry*0.72} fill="white" />
                <ellipse cx={props.cx + props.rx*0.33} cy={props.cy+4} rx={props.rx*0.48} ry={props.ry*0.62} fill="white" />
              </motion.g>
            )
          })}
        </AnimatePresence>

        {/* ── Sun ── */}
        <AnimatePresence>
          {show.sun && (
            <motion.g
              key="sun"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer', originX: '418px', originY: '42px' }}
              whileHover={{ scale: 1.1 }}
              animate={active === 'sun'
                ? { rotate:[0,360], scale:[1,1.18,1], transition:{ duration:0.65, ease:'easeInOut' } }
                : { rotate:0, scale:1 }}
              onClick={() => tap('sun', farmSfx.chime)}
            >
              {[0,40,80,120,160,200,240,280,320].map((a, i) => {
                const r = (a * Math.PI) / 180
                return (
                  <line key={i}
                    x1={418 + Math.cos(r)*20} y1={42 + Math.sin(r)*20}
                    x2={418 + Math.cos(r)*30} y2={42 + Math.sin(r)*30}
                    stroke="#FFB800" strokeWidth={3} strokeLinecap="round"
                  />
                )
              })}
              <circle cx={418} cy={42} r={18} fill="url(#fp-sun)" stroke="#FFD700" strokeWidth={1.5} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Fence ── */}
        <AnimatePresence>
          {show.fence && (
            <motion.g key="fence" initial="hidden" animate="visible" variants={popIn}>
              <rect x={118} y={groundY - 6} width={160} height={4}  rx={2} fill="#B8845A" />
              <rect x={118} y={groundY + 5} width={160} height={4}  rx={2} fill="#B8845A" />
              {[118,137,156,175,194,213,232,251,268].map(x => (
                <rect key={x} x={x} y={groundY - 10} width={6} height={22} rx={2} fill="#C9956A" />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── House ── */}
        <AnimatePresence>
          {show.house && (
            <motion.g
              key="house"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              whileHover={{ y: -3 }}
              animate={active === 'house'
                ? { x:[-3,3,-3,3,0], transition:{ duration:0.38, times:[0,.25,.5,.75,1] } }
                : { x:0 }}
              onClick={() => tap('house', farmSfx.knock)}
            >
              {/* Walls */}
              <rect x={28} y={groundY - 52} width={62} height={52} rx={3} fill="#D4956A" />
              {/* Roof */}
              <polygon points={`26,${groundY-52} 92,${groundY-52} 59,${groundY-72}`} fill="#C0392B" />
              <line x1={26} y1={groundY-52} x2={59} y2={groundY-72} stroke="#A93226" strokeWidth={1.5} />
              <line x1={92} y1={groundY-52} x2={59} y2={groundY-72} stroke="#A93226" strokeWidth={1.5} />
              {/* Chimney */}
              <rect x={70} y={groundY-74} width={8} height={14} rx={2} fill="#922B21" />
              {/* Door */}
              <rect x={50} y={groundY - 22} width={18} height={22} rx={4} fill="#7D3C1E" />
              <circle cx={66} cy={groundY - 11} r={2.2} fill="#F0B27A" />
              {/* Windows */}
              <rect x={32} y={groundY - 44} width={13} height={11} rx={2.5} fill="#AED6F1" stroke="white" strokeWidth={1.5} />
              <rect x={73} y={groundY - 44} width={13} height={11} rx={2.5} fill="#AED6F1" stroke="white" strokeWidth={1.5} />
              {/* Chimney smoke when active */}
              {active === 'house' && [0,1,2].map(i => (
                <motion.circle key={i} cx={74+i*2} cy={groundY-76}
                  r={3+i} fill="rgba(160,160,160,0.55)"
                  animate={{ y:[-4-(i*5), -20-(i*8)], opacity:[0.7,0], scale:[1,1.8+i*0.3] }}
                  transition={{ duration:0.9, delay:i*0.18, repeat:2 }}
                />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Barn ── */}
        <AnimatePresence>
          {show.barn && (
            <motion.g key="barn" initial="hidden" animate="visible" variants={popIn}>
              <rect x={318} y={groundY - 66} width={92} height={66} rx={3} fill="#C0392B" />
              <polygon points={`316,${groundY-66} 412,${groundY-66} 364,${groundY-90}`} fill="#922B21" />
              {/* Doors */}
              <rect x={349} y={groundY - 30} width={28} height={30} rx={3} fill="#7D3C1E" />
              <line x1={363} y1={groundY-30} x2={363} y2={groundY} stroke="#5D1A0B" strokeWidth={2} />
              <line x1={349} y1={groundY-15} x2={377} y2={groundY-15} stroke="#5D1A0B" strokeWidth={1.5} />
              {/* Windows */}
              <rect x={325} y={groundY - 54} width={16} height={13} rx={2.5} fill="#F9E79F" stroke="white" strokeWidth={1.5} />
              <rect x={390} y={groundY - 54} width={16} height={13} rx={2.5} fill="#F9E79F" stroke="white" strokeWidth={1.5} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Windmill ── */}
        <AnimatePresence>
          {show.windmill && (
            <motion.g
              key="windmill"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setWindFast(true)
                try { farmSfx.whoosh() } catch { /* audio blocked */ }
                setTimeout(() => setWindFast(false), 2200)
              }}
              whileHover={{ scale: 1.04 }}
            >
              {/* Tower */}
              <polygon
                points={`216,${groundY-2} 234,${groundY-2} 230,${groundY-70} 220,${groundY-70}`}
                fill="#D5D8DC" stroke="#B2BEC3" strokeWidth={1}
              />
              {/* Door */}
              <rect x={221} y={groundY - 20} width={8} height={18} rx={2} fill="#7D3C1E" />
              {/* Blades */}
              <WindmillBlades cx={225} cy={groundY - 72} fast={windFast} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Tree ── */}
        <AnimatePresence>
          {show.tree && (
            <motion.g
              key="tree"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer', originX: '110px', originY: `${groundY}px` }}
              animate={active === 'tree'
                ? { rotate:[-5,5,-4,4,-2,2,0], transition:{ duration:0.75 } }
                : { rotate:0 }}
              whileHover={{ scale: 1.06 }}
              onClick={() => tap('tree', farmSfx.rustle)}
            >
              {/* Trunk */}
              <rect x={106} y={groundY - 26} width={9} height={26} rx={3} fill="#8B4513" />
              {/* Foliage */}
              <circle cx={110} cy={groundY - 52} r={24} fill="#27AE60" />
              <circle cx={110} cy={groundY - 58} r={18} fill="#2ECC71" />
              <circle cx={110} cy={groundY - 63} r={10} fill="#82E0AA" />
              {/* Apples (unlocked at level 3+) */}
              {n >= 5 && <circle cx={100} cy={groundY - 50} r={4}   fill="#E74C3C" />}
              {n >= 5 && <circle cx={120} cy={groundY - 52} r={4}   fill="#E74C3C" />}
              {n >= 5 && <circle cx={108} cy={groundY - 42} r={3.5} fill="#E74C3C" />}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Flowers ── */}
        <AnimatePresence>
          {show.flowers && (
            <motion.g
              key="flowers"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'flowers'
                ? { scale:[1,1.28,1], transition:{ duration:0.45 } }
                : { scale:1 }}
              onClick={() => tap('flowers', farmSfx.tinkle)}
            >
              {[
                { x:148, c:'#FF6B6B' },
                { x:160, c:'#FFD93D' },
                { x:172, c:'#A29BFE' },
                { x:184, c:'#FF9F43' },
                { x:196, c:'#FD79A8' },
                { x:208, c:'#74B9FF' },
              ].map(({ x, c }) => (
                <g key={x}>
                  <line x1={x+3} y1={groundY+1} x2={x+3} y2={groundY-12} stroke="#6BCB77" strokeWidth={2} />
                  <circle cx={x+3} cy={groundY-13} r={5}   fill={c} />
                  <circle cx={x+3} cy={groundY-13} r={2.2} fill="rgba(255,255,255,0.7)" />
                </g>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Vegetable Garden ── */}
        <AnimatePresence>
          {show.garden && (
            <motion.g key="garden" initial="hidden" animate="visible" variants={popIn}>
              <rect x={258} y={groundY + 8} width={54} height={20} rx={4} fill="#7D5A44" opacity={0.85} />
              {['🥕','🌽','🥬','🥕','🌽'].map((emoji, i) => (
                <text key={i} x={261 + i*11} y={groundY + 7} fontSize={11} style={{ userSelect:'none' }}>
                  {emoji}
                </text>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Pond ── */}
        <AnimatePresence>
          {show.pond && (
            <motion.g
              key="pond"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              onClick={() => tap('pond', farmSfx.splash)}
              whileHover={{ scale: 1.04 }}
            >
              <ellipse cx={268} cy={groundY + 20} rx={38} ry={14} fill="url(#fp-pond)" opacity={0.90} />
              <ellipse cx={268} cy={groundY + 18} rx={34} ry={9}  fill="#74B9FF" opacity={0.45} />
              {/* Lily pads */}
              <ellipse cx={258} cy={groundY+21} rx={6} ry={4} fill="#27AE60" opacity={0.75} />
              <ellipse cx={278} cy={groundY+22} rx={5} ry={3} fill="#27AE60" opacity={0.70} />
              {active === 'pond' && <PondRipples cx={268} cy={groundY + 20} />}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Sheep ── */}
        <AnimatePresence>
          {show.sheep && (
            <motion.g
              key="sheep"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'sheep'
                ? { y:[-10,0,-6,0], transition:{ duration:0.45 } }
                : { y:0 }}
              whileHover={{ scale: 1.12 }}
              onClick={() => tap('sheep', farmSfx.baa)}
            >
              <text x={143} y={groundY + 22} fontSize={26} style={{ userSelect:'none' }}>🐑</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Chicken ── */}
        <AnimatePresence>
          {show.chicken && (
            <motion.g
              key="chicken"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'chicken'
                ? { y:[-7,0,-9,0,-4,0], x:[0,4,-4,4,0], transition:{ duration:0.48 } }
                : { y:0, x:0 }}
              whileHover={{ scale: 1.12 }}
              onClick={() => tap('chicken', farmSfx.cluck)}
            >
              <text x={196} y={groundY + 22} fontSize={24} style={{ userSelect:'none' }}>🐔</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Cow ── */}
        <AnimatePresence>
          {show.cow && (
            <motion.g
              key="cow"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'cow'
                ? { x:[-5,5,-4,4,0], transition:{ duration:0.85, ease:'easeInOut' } }
                : { x:0 }}
              whileHover={{ scale: 1.10 }}
              onClick={() => tap('cow', farmSfx.moo)}
            >
              <text x={236} y={groundY + 22} fontSize={28} style={{ userSelect:'none' }}>🐄</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Duck ── */}
        <AnimatePresence>
          {show.duck && (
            <motion.g
              key="duck"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer', originX: '300px', originY: `${groundY+22}px` }}
              animate={active === 'duck'
                ? { rotate:[0,360], scale:[1,1.22,1], transition:{ duration:0.65 } }
                : { rotate:0, scale:1 }}
              whileHover={{ scale: 1.12 }}
              onClick={() => tap('duck', farmSfx.quack)}
            >
              <text x={290} y={groundY + 28} fontSize={20} style={{ userSelect:'none' }}>🦆</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Horse (level 6) ── */}
        <AnimatePresence>
          {show.horse && (
            <motion.g
              key="horse"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'horse'
                ? { x:[0,8,0,8,0], y:[-4,0,-4,0], transition:{ duration:0.55 } }
                : { x:0, y:0 }}
              whileHover={{ scale: 1.10 }}
              onClick={() => tap('horse', farmSfx.neigh)}
            >
              <text x={164} y={groundY + 22} fontSize={26} style={{ userSelect:'none' }}>🐎</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── Progress bar (ground strip) ── */}
        <g>
          <rect x={18} y={H - 14} width={W - 36} height={9} rx={4.5} fill="rgba(0,0,0,0.14)" />
          <motion.rect
            x={18} y={H - 14} height={9} rx={4.5}
            fill="rgba(255,255,255,0.72)"
            animate={{ width: Math.max(9, ((n / totalModules) * (W - 36))) }}
            transition={{ duration: 1.1, ease: 'easeOut' }}
          />
          {STAGES.slice(1).map(st => {
            const px = 18 + (st.min / totalModules) * (W - 36)
            return (
              <g key={st.min}>
                <line x1={px} y1={H-17} x2={px} y2={H-5} stroke="white" strokeWidth={1.8} opacity={0.55} />
                <text x={px} y={H-18} textAnchor="middle" fontSize={6.5} fill="white" opacity={0.75}>
                  Lv{st.level}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tip footer */}
      <div style={{
        textAlign: 'center',
        padding: '5px 12px 9px',
        fontSize: 'clamp(11px,1.8vw,12px)',
        color: '#aaa',
        fontFamily: 'var(--font-body)',
      }}>
        👆 Tippe auf Tiere & Gegenstände!
      </div>
    </div>
  )
}
