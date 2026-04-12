import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Web Audio helpers ─────────────────────────────────────────────────────────
let _actx = null
function getCtx() {
  if (typeof window === 'undefined') return null
  if (!_actx) {
    try { _actx = new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
  }
  if (_actx.state === 'suspended') _actx.resume().catch(() => {})
  return _actx
}
function tone(freq, type, delay, dur, vol = 0.22, freqEnd) {
  const ac = getCtx(); if (!ac) return
  try {
    const osc = ac.createOscillator(), g = ac.createGain()
    osc.connect(g); g.connect(ac.destination)
    osc.type = type
    const t = ac.currentTime + delay
    osc.frequency.setValueAtTime(freq, t)
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.start(t); osc.stop(t + dur + 0.02)
  } catch { /* ignore */ }
}
function noise(delay, dur, vol = 0.15, filterFreq = 2000) {
  const ac = getCtx(); if (!ac) return
  try {
    const bufSize = ac.sampleRate * 0.5
    const buf = ac.createBuffer(1, bufSize, ac.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    const flt = ac.createBiquadFilter()
    flt.type = 'bandpass'; flt.frequency.value = filterFreq; flt.Q.value = 1.5
    const g = ac.createGain()
    src.connect(flt); flt.connect(g); g.connect(ac.destination)
    const t = ac.currentTime + delay
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.start(t); src.stop(t + dur + 0.05)
  } catch { /* ignore */ }
}

const farmSfx = {
  baa()   { tone(200,'sine',0,0.18,0.28,220); tone(180,'sine',0.15,0.25,0.22,170); tone(200,'sine',0.35,0.20,0.18) },
  cluck() { tone(700,'square',0,0.04,0.18); tone(600,'square',0.06,0.04,0.16); tone(750,'square',0.12,0.03,0.14); tone(620,'square',0.17,0.04,0.12) },
  moo()   { tone(150,'sawtooth',0,0.5,0.22,130); tone(160,'sine',0.1,0.4,0.12) },
  quack() { tone(500,'sine',0,0.06,0.24,300); tone(480,'sine',0.07,0.09,0.18,280) },
  chime() { tone(523,'sine',0,0.14,0.22); tone(659,'sine',0.09,0.16,0.20); tone(784,'sine',0.19,0.20,0.18); tone(1047,'sine',0.30,0.22,0.14) },
  splash(){ noise(0,0.12,0.20,800); noise(0.05,0.18,0.14,1200); noise(0.10,0.10,0.08,400) },
  rustle(){ noise(0,0.08,0.18,3000); noise(0.05,0.10,0.12,4000); noise(0.12,0.06,0.08,2500) },
  knock() { tone(80,'sine',0,0.08,0.30); tone(80,'sine',0.14,0.08,0.26) },
  tinkle(){ tone(1318,'sine',0,0.10,0.18); tone(1568,'sine',0.07,0.10,0.16); tone(2093,'sine',0.14,0.12,0.12) },
  whoosh(){ noise(0,0.25,0.22,600); noise(0.10,0.20,0.16,900); noise(0.20,0.15,0.10,400) },
}

// ── Farm stage thresholds ─────────────────────────────────────────────────────
const STAGES = [
  { min: 0,  level: 1, label: 'Kleines Feld',     skyTop: '#B8D4F0', skyBot: '#D6EAF8' },
  { min: 3,  level: 2, label: 'Wachsender Hof',   skyTop: '#74B9FF', skyBot: '#BDE0FE' },
  { min: 6,  level: 3, label: 'Bunter Bauernhof', skyTop: '#0984E3', skyBot: '#74B9FF' },
  { min: 9,  level: 4, label: 'Großer Hof',       skyTop: '#0652DD', skyBot: '#1289A7' },
  { min: 13, level: 5, label: 'Prächtiger Hof',   skyTop: '#1B1464', skyBot: '#0652DD' },
  { min: 17, level: 6, label: '🌟 Traumfarm!',    skyTop: '#0A3D62', skyBot: '#1289A7' },
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

// ── Animated cloud ────────────────────────────────────────────────────────────
function Cloud({ cx, cy, rx, ry, opacity, active, onClick }) {
  return (
    <motion.g
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      animate={active ? { x: [0, 80, 160, 240], opacity: [1, 1, 0.5, 0] } : { x: 0, opacity }}
      transition={active ? { duration: 2.5, ease: 'easeInOut' } : { duration: 0.3 }}
      whileHover={{ scale: 1.05 }}
    >
      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="white" opacity={active ? 1 : opacity} />
      <ellipse cx={cx - rx * 0.35} cy={cy + 3} rx={rx * 0.55} ry={ry * 0.75} fill="white" opacity={active ? 1 : opacity} />
      <ellipse cx={cx + rx * 0.35} cy={cy + 4} rx={rx * 0.5} ry={ry * 0.65} fill="white" opacity={active ? 1 : opacity} />
    </motion.g>
  )
}

// ── Windmill blades ───────────────────────────────────────────────────────────
function WindmillBlades({ cx, cy, fast }) {
  return (
    <motion.g
      style={{ originX: `${cx}px`, originY: `${cy}px` }}
      animate={{ rotate: [0, 360] }}
      transition={{ duration: fast ? 0.8 : 4, repeat: Infinity, ease: 'linear' }}
    >
      {[0, 90, 180, 270].map((angle, i) => {
        const rad = (angle * Math.PI) / 180
        const x1 = cx, y1 = cy
        const x2 = cx + Math.cos(rad) * 22, y2 = cy + Math.sin(rad) * 22
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8B4513" strokeWidth={5} strokeLinecap="round" />
      })}
      <circle cx={cx} cy={cy} r={5} fill="#A0522D" />
    </motion.g>
  )
}

// ── Pond ripple rings ─────────────────────────────────────────────────────────
function PondRipples({ cx, cy }) {
  return (
    <>
      {[1, 2, 3].map(i => (
        <motion.ellipse
          key={i}
          cx={cx} cy={cy} rx={0} ry={0}
          fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth={1.5}
          animate={{ rx: [0, 28 + i * 8], ry: [0, 10 + i * 3], opacity: [0.8, 0] }}
          transition={{ duration: 1.2, delay: i * 0.25, ease: 'easeOut', repeat: 1 }}
        />
      ))}
    </>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FarmProgress({ completedCount = 0, totalModules = 17, profile }) {
  const [active, setActive] = useState(null)
  const [windFast, setWindFast] = useState(false)
  const timerRef = useRef(null)

  const n = completedCount
  const stage = getStage(n)
  const nextStage = getNextStage(n)
  const toNext = nextStage ? nextStage.min - n : 0

  const show = {
    house:    n >= 0,
    sun:      n >= 0,
    clouds:   n >= 0,
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
    sfxFn()
    if (extraFn) extraFn()
    timerRef.current = setTimeout(() => setActive(null), 1800)
  }

  const popIn = {
    hidden: { scale: 0, opacity: 0 },
    visible: { scale: 1, opacity: 1, transition: { type: 'spring', stiffness: 420, damping: 18 } },
  }

  const W = 480, H = 260

  return (
    <div style={{
      margin: 'clamp(12px,2vw,20px) clamp(16px,4vw,40px)',
      borderRadius: 24,
      overflow: 'hidden',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      background: 'white',
    }}>
      {/* Header bar */}
      <div style={{
        background: `linear-gradient(135deg, ${stage.skyTop}, ${stage.skyBot})`,
        padding: '10px 18px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'white', fontSize: 'clamp(15px,3vw,20px)' }}>
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
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(12px,2.2vw,15px)', color: 'white', fontWeight: 700,
        }}>
          {n}/{totalModules} ✅
        </div>
      </div>

      {/* SVG Farm */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', background: `linear-gradient(180deg, ${stage.skyTop} 0%, ${stage.skyBot} 55%, #5D8A3C 55%, #3E6B23 100%)` }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Sky gradient defs */}
        <defs>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE066" />
            <stop offset="100%" stopColor="#FFD700" stopOpacity="0.3" />
          </radialGradient>
          <radialGradient id="pondGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#74B9FF" />
            <stop offset="100%" stopColor="#0984E3" />
          </radialGradient>
        </defs>

        {/* ── GROUND ── */}
        <rect x={0} y={H * 0.55} width={W} height={H * 0.45} fill="#5D8A3C" />
        <rect x={0} y={H * 0.55} width={W} height={8} fill="#6BCB77" />

        {/* ── RAINBOW (level 6) ── */}
        <AnimatePresence>
          {show.rainbow && (
            <motion.g key="rainbow" initial="hidden" animate="visible" variants={popIn}>
              {[
                ['#FF6B6B', 95], ['#FF9F43', 88], ['#FFD93D', 81],
                ['#6BCB77', 74], ['#74B9FF', 67], ['#A29BFE', 60],
              ].map(([color, ry], i) => (
                <path key={i} d={`M 30 ${H*0.55} A ${ry+10} ${ry} 0 0 1 ${W*0.55} ${H*0.55}`}
                  fill="none" stroke={color} strokeWidth={6} opacity={0.7} />
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── CLOUDS ── */}
        <AnimatePresence>
          {show.clouds && (
            <>
              <motion.g key="cloud1" initial="hidden" animate="visible" variants={popIn}>
                <Cloud cx={80} cy={40} rx={35} ry={16} opacity={0.9}
                  active={active === 'cloud1'}
                  onClick={() => { tap('cloud1', () => {}, () => {}) }} />
              </motion.g>
              <motion.g key="cloud2" initial="hidden" animate="visible" variants={popIn}>
                <Cloud cx={340} cy={30} rx={28} ry={13} opacity={0.8}
                  active={active === 'cloud2'}
                  onClick={() => { tap('cloud2', () => {}, () => {}) }} />
              </motion.g>
              {show.windmill && (
                <motion.g key="cloud3" initial="hidden" animate="visible" variants={popIn}>
                  <Cloud cx={200} cy={22} rx={22} ry={11} opacity={0.75}
                    active={active === 'cloud3'}
                    onClick={() => { tap('cloud3', () => {}, () => {}) }} />
                </motion.g>
              )}
            </>
          )}
        </AnimatePresence>

        {/* ── SUN ── */}
        <AnimatePresence>
          {show.sun && (
            <motion.g
              key="sun"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer', originX: '420px', originY: '40px' }}
              whileHover={{ scale: 1.1 }}
              animate={active === 'sun'
                ? { rotate: [0, 360], scale: [1, 1.15, 1], transition: { duration: 0.7, ease: 'easeInOut' } }
                : { rotate: 0, scale: 1 }}
              onClick={() => tap('sun', farmSfx.chime)}
            >
              {[0, 45, 90, 135, 180, 225, 270, 315].map(a => {
                const r = (a * Math.PI) / 180
                return <line key={a} x1={420 + Math.cos(r)*18} y1={40 + Math.sin(r)*18}
                  x2={420 + Math.cos(r)*27} y2={40 + Math.sin(r)*27}
                  stroke="#FFD700" strokeWidth={3} strokeLinecap="round" />
              })}
              <circle cx={420} cy={40} r={16} fill="url(#sunGlow)" stroke="#FFD700" strokeWidth={2} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── FENCE ── */}
        <AnimatePresence>
          {show.fence && (
            <motion.g key="fence" initial="hidden" animate="visible" variants={popIn}>
              {[120, 145, 170, 195, 220, 245, 270].map(x => (
                <g key={x}>
                  <rect x={x} y={H*0.52} width={6} height={22} rx={2} fill="#C8A47C" />
                  <rect x={x-2} y={H*0.52+5} width={12} height={3} rx={1} fill="#A0784A" />
                </g>
              ))}
              <rect x={120} y={H*0.52+5} width={155} height={4} rx={2} fill="#A0784A" />
              <rect x={120} y={H*0.52+14} width={155} height={4} rx={2} fill="#A0784A" />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── HOUSE ── */}
        <AnimatePresence>
          {show.house && (
            <motion.g
              key="house"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              whileHover={{ y: -2 }}
              animate={active === 'house'
                ? { x: [-3, 3, -3, 3, 0], transition: { duration: 0.4, times: [0, 0.25, 0.5, 0.75, 1] } }
                : { x: 0 }}
              onClick={() => tap('house', farmSfx.knock)}
            >
              {/* Walls */}
              <rect x={30} y={H*0.40} width={60} height={50} rx={3} fill="#D4956A" />
              {/* Roof */}
              <polygon points={`28,${H*0.40} 92,${H*0.40} 60,${H*0.27}`} fill="#C0392B" />
              <polygon points={`28,${H*0.40} 92,${H*0.40} 60,${H*0.27}`} fill="none" stroke="#922B21" strokeWidth={1.5} />
              {/* Door */}
              <rect x={51} y={H*0.52} width={18} height={22} rx={4} fill="#7D3C1E" />
              <circle cx={67} cy={H*0.63} r={2.5} fill="#F0B27A" />
              {/* Windows */}
              <rect x={34} y={H*0.43} width={14} height={12} rx={3} fill="#AED6F1" stroke="white" strokeWidth={1.5} />
              <rect x={72} y={H*0.43} width={14} height={12} rx={3} fill="#AED6F1" stroke="white" strokeWidth={1.5} />
              {/* Chimney */}
              <rect x={70} y={H*0.27} width={8} height={14} rx={2} fill="#943126" />
              {active === 'house' && (
                <>
                  <motion.circle cx={74} cy={H*0.22} r={4} fill="rgba(180,180,180,0.6)"
                    animate={{ y: [-5, -18], opacity: [0.7, 0], scale: [1, 1.8] }} transition={{ duration: 0.8, repeat: 2 }} />
                  <motion.circle cx={76} cy={H*0.20} r={3} fill="rgba(180,180,180,0.5)"
                    animate={{ y: [-3, -14], opacity: [0.6, 0], scale: [1, 1.5] }} transition={{ duration: 0.7, delay: 0.2, repeat: 2 }} />
                </>
              )}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── BARN ── */}
        <AnimatePresence>
          {show.barn && (
            <motion.g key="barn" initial="hidden" animate="visible" variants={popIn}>
              <rect x={320} y={H*0.38} width={90} height={62} rx={3} fill="#C0392B" />
              <polygon points={`318,${H*0.38} 412,${H*0.38} 365,${H*0.23}`} fill="#922B21" />
              <rect x={352} y={H*0.50} width={26} height={30} rx={3} fill="#7D3C1E" />
              <rect x={330} y={H*0.41} width={18} height={14} rx={3} fill="#F9E79F" stroke="white" strokeWidth={1.5} />
              <rect x={362} y={H*0.41} width={18} height={14} rx={3} fill="#F9E79F" stroke="white" strokeWidth={1.5} />
              <rect x={392} y={H*0.41} width={14} height={12} rx={3} fill="#F9E79F" stroke="white" strokeWidth={1.5} />
              {/* Barn cross */}
              <line x1={352} y1={H*0.50} x2={378} y2={H*0.65} stroke="#5D1A0B" strokeWidth={2} />
              <line x1={378} y1={H*0.50} x2={352} y2={H*0.65} stroke="#5D1A0B" strokeWidth={2} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── WINDMILL ── */}
        <AnimatePresence>
          {show.windmill && (
            <motion.g
              key="windmill"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setWindFast(true)
                farmSfx.whoosh()
                setTimeout(() => setWindFast(false), 2200)
              }}
            >
              {/* Tower */}
              <polygon points={`218,${H*0.26} 234,${H*0.26} 230,${H*0.55} 222,${H*0.55}`} fill="#D5D8DC" stroke="#AAB7B8" strokeWidth={1} />
              {/* Door */}
              <rect x={222} y={H*0.47} width={8} height={10} rx={2} fill="#7D3C1E" />
              <WindmillBlades cx={226} cy={H*0.30} fast={windFast} />
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── TREE ── */}
        <AnimatePresence>
          {show.tree && (
            <motion.g
              key="tree"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'tree'
                ? { rotate: [-5, 5, -4, 4, -2, 2, 0], originX: '110px', originY: `${H*0.55}px`, transition: { duration: 0.8 } }
                : { rotate: 0 }}
              onClick={() => tap('tree', farmSfx.rustle)}
              whileHover={{ scale: 1.05 }}
            >
              {/* Trunk */}
              <rect x={107} y={H*0.43} width={9} height={20} rx={3} fill="#8B4513" />
              {/* Foliage layers */}
              <circle cx={111} cy={H*0.36} r={24} fill="#27AE60" />
              <circle cx={111} cy={H*0.33} r={18} fill="#2ECC71" />
              <circle cx={111} cy={H*0.31} r={10} fill="#82E0AA" />
              {/* Apples (level 3+) */}
              {n >= 5 && <circle cx={101} cy={H*0.37} r={4} fill="#E74C3C" />}
              {n >= 5 && <circle cx={120} cy={H*0.39} r={4} fill="#E74C3C" />}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── FLOWERS ── */}
        <AnimatePresence>
          {show.flowers && (
            <motion.g
              key="flowers"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'flowers' ? { scale: [1, 1.25, 1], transition: { duration: 0.5 } } : { scale: 1 }}
              onClick={() => tap('flowers', farmSfx.tinkle)}
            >
              {[
                { x: 150, c: '#FF6B6B' }, { x: 162, c: '#FFD93D' }, { x: 174, c: '#A29BFE' },
                { x: 186, c: '#FF9F43' }, { x: 198, c: '#FD79A8' },
              ].map(({ x, c }) => (
                <g key={x}>
                  <line x1={x+3} y1={H*0.555} x2={x+3} y2={H*0.51} stroke="#6BCB77" strokeWidth={2} />
                  <circle cx={x+3} cy={H*0.50} r={5} fill={c} />
                  <circle cx={x+3} cy={H*0.50} r={2.5} fill="rgba(255,255,255,0.7)" />
                </g>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── VEGETABLE GARDEN ── */}
        <AnimatePresence>
          {show.garden && (
            <motion.g key="garden" initial="hidden" animate="visible" variants={popIn}>
              {/* Soil beds */}
              <rect x={260} y={H*0.60} width={50} height={22} rx={4} fill="#7D5A44" opacity={0.8} />
              {/* Veggies */}
              {[268, 278, 288, 298, 308].map(x => (
                <g key={x}>
                  <line x1={x+2} y1={H*0.60} x2={x+2} y2={H*0.57} stroke="#27AE60" strokeWidth={2} />
                  <text x={x-2} y={H*0.58} fontSize={11} style={{ userSelect: 'none' }}>
                    {['🥕', '🌽', '🥬', '🥕', '🌽'][Math.floor((x - 268) / 10)]}
                  </text>
                </g>
              ))}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── POND ── */}
        <AnimatePresence>
          {show.pond && (
            <motion.g
              key="pond"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              onClick={() => tap('pond', farmSfx.splash)}
            >
              <ellipse cx={270} cy={H*0.68} rx={38} ry={14} fill="url(#pondGrad)" opacity={0.88} />
              <ellipse cx={270} cy={H*0.67} rx={35} ry={10} fill="#74B9FF" opacity={0.5} />
              {/* Lily pads */}
              <ellipse cx={260} cy={H*0.69} rx={6} ry={4} fill="#27AE60" opacity={0.7} />
              <ellipse cx={278} cy={H*0.70} rx={5} ry={3} fill="#27AE60" opacity={0.7} />
              {active === 'pond' && <PondRipples cx={270} cy={H*0.68} />}
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── SHEEP ── */}
        <AnimatePresence>
          {show.sheep && (
            <motion.g
              key="sheep"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'sheep' ? { y: [-8, 0, -5, 0], transition: { duration: 0.5 } } : { y: 0 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => tap('sheep', farmSfx.baa)}
            >
              <text x={145} y={H*0.72} fontSize={28} style={{ userSelect: 'none' }}>🐑</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── CHICKEN ── */}
        <AnimatePresence>
          {show.chicken && (
            <motion.g
              key="chicken"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'chicken'
                ? { y: [-6, 0, -8, 0, -4, 0], x: [0, 4, -4, 4, 0], transition: { duration: 0.5 } }
                : { y: 0, x: 0 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => tap('chicken', farmSfx.cluck)}
            >
              <text x={200} y={H*0.73} fontSize={26} style={{ userSelect: 'none' }}>🐔</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── COW ── */}
        <AnimatePresence>
          {show.cow && (
            <motion.g
              key="cow"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'cow'
                ? { x: [-4, 4, -3, 3, 0], transition: { duration: 0.9, ease: 'easeInOut' } }
                : { x: 0 }}
              whileHover={{ scale: 1.08 }}
              onClick={() => tap('cow', farmSfx.moo)}
            >
              <text x={240} y={H*0.72} fontSize={30} style={{ userSelect: 'none' }}>🐄</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── DUCK ── */}
        <AnimatePresence>
          {show.duck && (
            <motion.g
              key="duck"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'duck'
                ? { rotate: [0, 360], scale: [1, 1.2, 1], transition: { duration: 0.7 } }
                : { rotate: 0, scale: 1 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => tap('duck', farmSfx.quack)}
            >
              <text x={292} y={H*0.76} fontSize={22} style={{ userSelect: 'none' }}>🦆</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── HORSE (level 6) ── */}
        <AnimatePresence>
          {show.horse && (
            <motion.g
              key="horse"
              initial="hidden" animate="visible" variants={popIn}
              style={{ cursor: 'pointer' }}
              animate={active === 'horse'
                ? { x: [0, 8, 0, 8, 0], y: [-4, 0, -4, 0], transition: { duration: 0.6 } }
                : { x: 0, y: 0 }}
              whileHover={{ scale: 1.1 }}
              onClick={() => tap('horse', () => { tone(350,'sine',0,0.4,0.22,280); tone(380,'sine',0.2,0.3,0.16) })}
            >
              <text x={170} y={H*0.73} fontSize={28} style={{ userSelect: 'none' }}>🐎</text>
            </motion.g>
          )}
        </AnimatePresence>

        {/* ── PROGRESS BAR (ground level) ── */}
        <g>
          <rect x={20} y={H*0.93} width={W - 40} height={10} rx={5} fill="rgba(0,0,0,0.15)" />
          <motion.rect
            x={20} y={H*0.93}
            width={0} height={10} rx={5}
            fill="rgba(255,255,255,0.7)"
            animate={{ width: ((n / totalModules) * (W - 40)) }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
          {/* Stage markers */}
          {STAGES.slice(1).map(st => {
            const px = 20 + (st.min / totalModules) * (W - 40)
            return (
              <g key={st.min}>
                <line x1={px} y1={H*0.91} x2={px} y2={H*0.97} stroke="white" strokeWidth={2} opacity={0.6} />
                <text x={px} y={H*0.905} textAnchor="middle" fontSize={7} fill="white" opacity={0.8}>
                  Lv{st.level}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      {/* Tap hint */}
      <div style={{
        textAlign: 'center', padding: '6px 12px 10px',
        fontSize: 'clamp(11px,1.8vw,12px)', color: '#999',
        fontFamily: 'var(--font-body)',
      }}>
        👆 Tippe auf Tiere und Gegenstände!
      </div>
    </div>
  )
}
