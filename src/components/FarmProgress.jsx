import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── Web Audio farm sounds ─────────────────────────────────────────────────────
let _ac = null
function getAc() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)()
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}
function tone(f, type, t0, dur, vol = 0.15) {
  try {
    const o = getAc().createOscillator(), g = getAc().createGain()
    o.connect(g); g.connect(getAc().destination)
    o.type = type; o.frequency.setValueAtTime(f, t0)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.start(t0); o.stop(t0 + dur + 0.05)
  } catch {}
}
function noise(t0, dur, vol = 0.07) {
  try {
    const buf = getAc().createBuffer(1, getAc().sampleRate * dur, getAc().sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const src = getAc().createBufferSource()
    const filt = getAc().createBiquadFilter()
    const g = getAc().createGain()
    src.buffer = buf; filt.type = 'bandpass'; filt.frequency.value = 600
    src.connect(filt); filt.connect(g); g.connect(getAc().destination)
    g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    src.start(t0); src.stop(t0 + dur + 0.05)
  } catch {}
}
const sfx = {
  baa()   { const t = getAc().currentTime; tone(220,'sine',t,0.3,0.2); tone(190,'sine',t+0.15,0.25,0.12) },
  moo()   { const t = getAc().currentTime; tone(130,'sine',t,0.6,0.22); tone(110,'sine',t+0.2,0.5,0.1) },
  cluck() { const t = getAc().currentTime; [0,.07,.14].forEach(d=>tone(650+Math.random()*150,'square',t+d,.06,.1)) },
  quack() { const t = getAc().currentTime; tone(480,'sawtooth',t,.1,.18); tone(340,'sawtooth',t+.08,.15,.12) },
  toot()  { const t = getAc().currentTime; tone(320,'square',t,.12,.22); tone(420,'square',t+.1,.12,.16) },
  chime() { const t = getAc().currentTime; [523,659,784,1047].forEach((f,i)=>tone(f,'sine',t+i*.09,.22,.14)) },
  oink()  { const t = getAc().currentTime; tone(280,'sawtooth',t,.15,.18); tone(220,'sawtooth',t+.1,.2,.12) },
  splash(){ const t = getAc().currentTime; noise(t,.25,.1); tone(280,'sine',t,.15,.07) },
}

// ── Farm config ───────────────────────────────────────────────────────────────
function getLevel(n) {
  if (n<=2) return 1; if (n<=5) return 2; if (n<=8) return 3
  if (n<=12) return 4; if (n<=16) return 5; return 6
}
const LABELS = ['','Kleiner Hof','Wachsender Hof','Blühender Hof','Großer Hof','Prächtiger Hof','Traumhof ⭐']
const NEXT_AT = [0,3,6,9,13,17,Infinity]
const SKY = ['','#c8e8ff','#a8d8ff','#80c4ff','#5bb0ff','#3a9aff','#1a7aff']

// ── SVG Components ────────────────────────────────────────────────────────────

function Sun() {
  return (
    <motion.g
      animate={{ rotate: 360 }}
      transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      style={{ originX: '75%', originY: '18%' }}
    >
      <motion.circle cx="300" cy="50" r="28" fill="#FFD93D"
        animate={{ r: [28,30,28] }} transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }} />
      {[0,40,80,120,160,200,240,280,320].map((a,i) => (
        <motion.line key={i}
          x1={300+Math.cos(a*Math.PI/180)*32} y1={50+Math.sin(a*Math.PI/180)*32}
          x2={300+Math.cos(a*Math.PI/180)*42} y2={50+Math.sin(a*Math.PI/180)*42}
          stroke="#FFB800" strokeWidth="3.5" strokeLinecap="round"
        />
      ))}
    </motion.g>
  )
}

function Cloud({ x, y, scale=1, speed=18 }) {
  return (
    <motion.g
      animate={{ x: [0, 420] }}
      transition={{ duration: speed, repeat: Infinity, ease: 'linear', repeatDelay: 0 }}
      initial={{ x: -120 }}
    >
      <ellipse cx={x} cy={y} rx={38*scale} ry={20*scale} fill="white" opacity="0.92" />
      <ellipse cx={x+22*scale} cy={y-10*scale} rx={28*scale} ry={18*scale} fill="white" opacity="0.95" />
      <ellipse cx={x-18*scale} cy={y-6*scale} rx={22*scale} ry={14*scale} fill="white" opacity="0.88" />
    </motion.g>
  )
}

function Windmill({ x, y }) {
  return (
    <g>
      {/* Tower */}
      <polygon points={`${x-6},${y} ${x+6},${y} ${x+3},${y-55} ${x-3},${y-55}`} fill="#9e9e9e" />
      {/* Blades */}
      <motion.g
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        style={{ originX: x, originY: y-55 }}
      >
        {[0,90,180,270].map((a,i) => (
          <motion.rect key={i}
            x={x-3} y={y-75} width={6} height={22} rx={3}
            fill="#b0bec5"
            transform={`rotate(${a} ${x} ${y-55})`}
          />
        ))}
        <circle cx={x} cy={y-55} r={4} fill="#78909c" />
      </motion.g>
    </g>
  )
}

function House({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={70} height={50} fill="#8d6e63" rx={2}/>
      <polygon points={`${x-8},${y} ${x+78},${y} ${x+35},${y-38}`} fill="#c62828"/>
      {/* Door */}
      <rect x={x+27} y={y+25} width={16} height={25} fill="#5d4037" rx={2}/>
      {/* Windows */}
      <rect x={x+6} y={y+10} width={14} height={12} fill="#81d4fa" rx={1}/>
      <rect x={x+50} y={y+10} width={14} height={12} fill="#81d4fa" rx={1}/>
      {/* Chimney */}
      <rect x={x+52} y={y-42} width={8} height={20} fill="#795548"/>
      <motion.g animate={{opacity:[0,0.6,0]}} transition={{duration:2,repeat:Infinity,ease:'easeInOut'}}>
        <ellipse cx={x+56} cy={y-46} rx={5} ry={4} fill="#9e9e9e" opacity={0.5}/>
      </motion.g>
    </g>
  )
}

function Barn({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={85} height={58} fill="#c62828" rx={2}/>
      <polygon points={`${x-10},${y} ${x+95},${y} ${x+42},${y-42}`} fill="#b71c1c"/>
      <rect x={x+33} y={y+28} width={20} height={30} fill="#4e342e" rx={1}/>
      <rect x={x+5} y={y+8} width={18} height={14} fill="#81d4fa" rx={1}/>
      <rect x={x+62} y={y+8} width={18} height={14} fill="#81d4fa" rx={1}/>
      <motion.text x={x+42} y={y-20} fontSize={16} textAnchor="middle"
        animate={{opacity:[0.4,1,0.4]}} transition={{duration:2,repeat:Infinity}}>⭐</motion.text>
    </g>
  )
}

function Fence({ x, y, count=8 }) {
  const posts = Array.from({length:count},(_,i)=>i)
  return (
    <g>
      {posts.map(i=>(
        <rect key={i} x={x+i*16} y={y} width={4} height={18} fill="#a1887f" rx={1}/>
      ))}
      <rect x={x} y={y+4} width={count*16} height={3} fill="#a1887f" rx={1}/>
      <rect x={x} y={y+11} width={count*16} height={3} fill="#a1887f" rx={1}/>
    </g>
  )
}

function Flowers({ positions }) {
  const colors = ['#e91e63','#9c27b0','#ff9800','#f44336','#2196f3']
  return (
    <g>
      {positions.map(([x,y],i) => (
        <motion.g key={i}
          animate={{ y:[0,-2,0] }}
          transition={{ duration:1.5+i*.3, repeat:Infinity, ease:'easeInOut' }}
        >
          <line x1={x} y1={y} x2={x} y2={y+10} stroke="#4caf50" strokeWidth={2}/>
          <circle cx={x} cy={y} r={5} fill={colors[i%colors.length]}/>
          <circle cx={x} cy={y} r={2.5} fill="#fff176"/>
        </motion.g>
      ))}
    </g>
  )
}

function Pond({ x, y }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={35} ry={14} fill="#29b6f6" opacity={0.85}/>
      <motion.ellipse cx={x} cy={y} rx={25} ry={8} fill="none" stroke="#4fc3f7" strokeWidth={1.5}
        animate={{ rx:[25,30,25], opacity:[0.5,0.2,0.5] }}
        transition={{ duration:3, repeat:Infinity, ease:'easeInOut' }}/>
    </g>
  )
}

function VeggieGarden({ x, y }) {
  return (
    <g>
      <rect x={x} y={y} width={50} height={14} fill="#795548" rx={2} opacity={0.65}/>
      {['🥕','🥦','🌽','🍅'].map((e,i) => (
        <motion.text key={i} x={x+6+i*12} y={y+2} fontSize={11}
          animate={{ y:[y+2,y-1,y+2] }}
          transition={{ duration:2+i*.2, repeat:Infinity, ease:'easeInOut' }}>
          {e}
        </motion.text>
      ))}
    </g>
  )
}

// ── Animated Animals ──────────────────────────────────────────────────────────
function Sheep({ x, y, onClick, bouncing }) {
  return (
    <motion.g
      onClick={onClick} style={{ cursor:'pointer' }}
      animate={bouncing ? { y:[y,y-22,y-8,y] } : { y:[y,y-3,y] }}
      transition={bouncing ? { duration:.6, type:'spring' } : { duration:2, repeat:Infinity, ease:'easeInOut' }}
    >
      {/* Body */}
      <ellipse cx={x} cy={y-8} rx={16} ry={12} fill="white"/>
      <circle cx={x-10} cy={y-8} rx={10} ry={9} fill="white"/>
      <circle cx={x+8} cy={y-10} rx={9} ry={8} fill="white"/>
      <circle cx={x} cy={y-16} rx={8} ry={7} fill="white"/>
      {/* Head */}
      <circle cx={x+18} cy={y-14} r={9} fill="#9e9e9e"/>
      <circle cx={x+21} cy={y-17} r={3} fill="#757575"/>
      {/* Eyes */}
      <circle cx={x+20} cy={y-16} r={1.5} fill="#212121"/>
      {/* Legs */}
      {[-8,-2,4,10].map((dx,i) => <rect key={i} x={x+dx-1} y={y} width={3} height={10} fill="#9e9e9e" rx={1}/>)}
    </motion.g>
  )
}

function Cow({ x, y, onClick, bouncing }) {
  return (
    <motion.g
      onClick={onClick} style={{ cursor:'pointer' }}
      animate={bouncing ? { x:[x,x+8,x-8,x] } : { y:[y,y-2,y] }}
      transition={bouncing ? { duration:.5 } : { duration:2.5, repeat:Infinity, ease:'easeInOut' }}
    >
      {/* Body */}
      <ellipse cx={x} cy={y-10} rx={22} ry={14} fill="#efebe9"/>
      <ellipse cx={x+5} cy={y-12} rx={10} ry={8} fill="#4e342e" opacity={0.3}/>
      {/* Head */}
      <circle cx={x+26} cy={y-16} r={12} fill="#efebe9"/>
      <ellipse cx={x+30} cy={y-10} rx={8} ry={5} fill="#bcaaa4"/>
      {/* Horns */}
      <line x1={x+22} y1={y-27} x2={x+18} y2={y-34} stroke="#795548" strokeWidth={2.5} strokeLinecap="round"/>
      <line x1={x+30} y1={y-27} x2={x+34} y2={y-34} stroke="#795548" strokeWidth={2.5} strokeLinecap="round"/>
      {/* Eyes */}
      <circle cx={x+25} cy={y-18} r={2} fill="#212121"/>
      {/* Legs */}
      {[-14,-6,4,12].map((dx,i) => <rect key={i} x={x+dx-1.5} y={y} width={4} height={14} fill="#bcaaa4" rx={2}/>)}
      {/* Tail */}
      <motion.path d={`M${x-22},${y-5} Q${x-32},${y-15} ${x-28},${y-25}`} fill="none" stroke="#bcaaa4" strokeWidth={2.5}
        animate={{ d:[`M${x-22},${y-5} Q${x-32},${y-15} ${x-28},${y-25}`,`M${x-22},${y-5} Q${x-28},${y-20} ${x-20},${y-28}`] }}
        transition={{ duration:1.5, repeat:Infinity, repeatType:'reverse', ease:'easeInOut' }}/>
    </motion.g>
  )
}

function Chicken({ x, y, onClick, bouncing }) {
  return (
    <motion.g
      onClick={onClick} style={{ cursor:'pointer' }}
      animate={bouncing ? { y:[y,y-15,y] } : {}}
      transition={bouncing ? { duration:.4, type:'spring' } : {}}
    >
      {/* Body */}
      <ellipse cx={x} cy={y-8} rx={11} ry={10} fill="#fff9c4"/>
      {/* Head */}
      <circle cx={x+10} cy={y-18} r={8} fill="#fff9c4"/>
      {/* Beak */}
      <polygon points={`${x+18},${y-18} ${x+23},${y-16} ${x+18},${y-14}`} fill="#ff9800"/>
      {/* Comb */}
      <motion.path d={`M${x+8},${y-26} Q${x+10},${y-30} ${x+12},${y-26} Q${x+14},${y-30} ${x+16},${y-26}`}
        fill="#f44336"
        animate={{ y:[0,-1,0] }} transition={{ duration:0.8, repeat:Infinity, ease:'easeInOut' }}/>
      {/* Eye */}
      <circle cx={x+12} cy={y-19} r={1.8} fill="#212121"/>
      {/* Wings */}
      <motion.ellipse cx={x-5} cy={y-8} rx={7} ry={5} fill="#f9a825" opacity={0.7}
        animate={{ rotate:[-10,10,-10] }} transition={{ duration:0.4, repeat:Infinity }}/>
      {/* Legs */}
      <line x1={x-3} y1={y} x2={x-5} y2={y+10} stroke="#ff9800" strokeWidth={2}/>
      <line x1={x+3} y1={y} x2={x+5} y2={y+10} stroke="#ff9800" strokeWidth={2}/>
    </motion.g>
  )
}

function Duck({ x, y, onClick, bouncing }) {
  return (
    <motion.g
      onClick={onClick} style={{ cursor:'pointer' }}
      animate={bouncing ? { x:[x,x+10,x-5,x] } : { x:[x,x+2,x] }}
      transition={bouncing ? { duration:.5 } : { duration:3, repeat:Infinity, ease:'easeInOut' }}
    >
      <ellipse cx={x} cy={y-6} rx={10} ry={7} fill="#fff9c4"/>
      <circle cx={x+10} cy={y-12} r={7} fill="#fff9c4"/>
      <polygon points={`${x+17},${y-12} ${x+23},${y-10} ${x+17},${y-8}`} fill="#ff9800"/>
      <circle cx={x+12} cy={y-13} r={1.5} fill="#212121"/>
      <ellipse cx={x-3} cy={y-5} rx={5} ry={3.5} fill="#fff59d" opacity={0.7}/>
    </motion.g>
  )
}

function Pig({ x, y, onClick, bouncing }) {
  return (
    <motion.g
      onClick={onClick} style={{ cursor:'pointer' }}
      animate={bouncing ? { y:[y,y-12,y] } : { y:[y,y-2,y] }}
      transition={bouncing ? { duration:.5, type:'spring' } : { duration:2.2, repeat:Infinity, ease:'easeInOut' }}
    >
      <ellipse cx={x} cy={y-8} rx={15} ry={11} fill="#f48fb1"/>
      <circle cx={x+15} cy={y-14} r={10} fill="#f48fb1"/>
      <ellipse cx={x+17} cy={y-10} rx={6} ry={4} fill="#f06292"/>
      <circle cx={x+14} cy={y-11} r={1.5} fill="#ad1457"/>
      <circle cx={x+20} cy={y-11} r={1.5} fill="#ad1457"/>
      <circle cx={x+13} cy={y-15} r={2} fill="#212121"/>
      {[-8,-1,5,12].map((dx,i) => <rect key={i} x={x+dx-1.5} y={y} width={3} height={9} fill="#f06292" rx={1}/>)}
    </motion.g>
  )
}

function Farmer({ x, y, onClick, bouncing }) {
  return (
    <motion.g
      onClick={onClick} style={{ cursor:'pointer' }}
      animate={bouncing ? { y:[y,y-18,y] } : { y:[y,y-2,y] }}
      transition={bouncing ? { duration:.5, type:'spring' } : { duration:2.8, repeat:Infinity, ease:'easeInOut' }}
    >
      {/* Body */}
      <rect x={x-8} y={y-32} width={16} height={20} fill="#1565c0" rx={3}/>
      {/* Head */}
      <circle cx={x} cy={y-42} r={10} fill="#ffcc80"/>
      {/* Hat */}
      <rect x={x-12} y={y-54} width={24} height={5} fill="#f9a825" rx={2}/>
      <rect x={x-8} y={y-66} width={16} height={14} fill="#f9a825" rx={2}/>
      {/* Eyes & smile */}
      <circle cx={x-3} cy={y-43} r={1.5} fill="#212121"/>
      <circle cx={x+3} cy={y-43} r={1.5} fill="#212121"/>
      <path d={`M${x-3},${y-38} Q${x},${y-35} ${x+3},${y-38}`} fill="none" stroke="#212121" strokeWidth={1.5}/>
      {/* Arms - waving */}
      <motion.line x1={x-8} y1={y-28} x2={x-18} y2={y-38}
        stroke="#ffcc80" strokeWidth={4} strokeLinecap="round"
        animate={{ x2:[x-18,x-22,x-18], y2:[y-38,y-42,y-38] }}
        transition={{ duration:0.8, repeat:Infinity, ease:'easeInOut' }}/>
      <line x1={x+8} y1={y-28} x2={x+18} y2={y-38} stroke="#ffcc80" strokeWidth={4} strokeLinecap="round"/>
      {/* Legs */}
      <rect x={x-7} y={y-12} width={6} height={14} fill="#33691e" rx={2}/>
      <rect x={x+1} y={y-12} width={6} height={14} fill="#33691e" rx={2}/>
    </motion.g>
  )
}

function Tractor({ x, y, onClick, bouncing }) {
  return (
    <motion.g
      onClick={onClick} style={{ cursor:'pointer' }}
      animate={bouncing ? { x:[x,x+15,x+30,x+15,x] } : {}}
      transition={bouncing ? { duration:1.5, ease:'easeInOut' } : {}}
    >
      {/* Body */}
      <rect x={x} y={y-25} width={55} height={25} fill="#c62828" rx={4}/>
      {/* Cabin */}
      <rect x={x+25} y={y-45} width={28} height={22} fill="#e53935" rx={3}/>
      {/* Window */}
      <rect x={x+28} y={y-42} width={16} height={12} fill="#81d4fa" rx={2}/>
      {/* Exhaust */}
      <rect x={x+48} y={y-55} width={5} height={12} fill="#424242" rx={2}/>
      <motion.circle cx={x+50} cy={y-57} r={4} fill="#9e9e9e" opacity={0.4}
        animate={{ r:[4,8,12], opacity:[0.5,0.2,0] }}
        transition={{ duration:1.2, repeat:Infinity, ease:'easeOut' }}/>
      {/* Big rear wheel */}
      <circle cx={x+15} cy={y} r={18} fill="#212121"/>
      <circle cx={x+15} cy={y} r={12} fill="#424242"/>
      <circle cx={x+15} cy={y} r={5} fill="#757575"/>
      {[0,60,120,180,240,300].map((a,i) => (
        <motion.line key={i}
          x1={x+15+Math.cos(a*Math.PI/180)*6} y1={y+Math.sin(a*Math.PI/180)*6}
          x2={x+15+Math.cos(a*Math.PI/180)*11} y2={y+Math.sin(a*Math.PI/180)*11}
          stroke="#616161" strokeWidth={2}/>
      ))}
      {/* Small front wheel */}
      <circle cx={x+48} cy={y} r={11} fill="#212121"/>
      <circle cx={x+48} cy={y} r={6} fill="#424242"/>
      <circle cx={x+48} cy={y} r={3} fill="#757575"/>
    </motion.g>
  )
}

// ── Click feedback ────────────────────────────────────────────────────────────
function Sparkles({ x, y }) {
  const particles = ['⭐','✨','💫','🌟']
  return (
    <div style={{ position:'absolute', left:x-30, top:y-60, pointerEvents:'none', zIndex:20 }}>
      {particles.map((p,i) => (
        <motion.div key={i}
          initial={{ opacity:1, x:0, y:0, scale:1 }}
          animate={{ opacity:0, x:(i-1.5)*25, y:-50-i*10, scale:1.5 }}
          transition={{ duration:0.8, delay:i*0.06 }}
          style={{ position:'absolute', fontSize:16 }}
        >
          {p}
        </motion.div>
      ))}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FarmProgress({ completedCount = 0, totalModules = 17, profile }) {
  const level = getLevel(completedCount)
  const show = (min) => level >= min
  const [clicked, setClicked] = useState(null)
  const [sparkPos, setSparkPos] = useState(null)

  const handleClick = useCallback((id, sfxFn, px, py) => {
    try { sfxFn() } catch {}
    setClicked(id)
    setSparkPos({ x: px, y: py })
    setTimeout(() => { setClicked(null); setSparkPos(null) }, 900)
  }, [])

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? `${NEXT_AT[level] - completedCount} Module bis zum nächsten Upgrade ✨`
    : '🏆 Maximaler Hof erreicht!'

  return (
    <div style={{ width:'100%', maxWidth:640, margin:'0 auto', userSelect:'none' }}>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8, padding:'0 4px' }}>
        <div style={{ fontFamily:'var(--font-heading)', fontSize:18, color:'var(--text-primary)', fontWeight:700 }}>
          🌾 {LABELS[level]}
        </div>
        <div style={{ fontSize:12, color:'var(--text-secondary)', fontFamily:'var(--font-body)' }}>
          {nextUnlock}
        </div>
      </div>

      {/* Farm SVG */}
      <div style={{ borderRadius:24, overflow:'hidden', boxShadow:'0 8px 32px rgba(0,0,0,0.15)', position:'relative' }}>
        {sparkPos && <Sparkles x={sparkPos.x} y={sparkPos.y} />}

        <svg viewBox="0 0 400 230" width="100%" style={{ display:'block', background: SKY[level] }}>
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SKY[level]}/>
              <stop offset="100%" stopColor="#e8f5e9"/>
            </linearGradient>
            <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#66bb6a"/>
              <stop offset="100%" stopColor="#388e3c"/>
            </linearGradient>
          </defs>

          {/* Sky */}
          <rect x="0" y="0" width="400" height="230" fill="url(#sky)"/>

          {/* Sun */}
          <Sun />

          {/* Clouds */}
          <Cloud x={-40} y={35} scale={1} speed={22} />
          <Cloud x={-80} y={55} scale={0.7} speed={30} />

          {/* Ground */}
          <rect x="0" y="170" width="400" height="60" fill="url(#ground)"/>
          {/* Grass detail */}
          {Array.from({length:20},(_,i)=>(
            <motion.line key={i} x1={10+i*20} y1={170} x2={10+i*20} y2={163}
              stroke="#4caf50" strokeWidth={2} strokeLinecap="round"
              animate={{ x2:[10+i*20-2, 10+i*20+2, 10+i*20-1] }}
              transition={{ duration:1.5+i*.05, repeat:Infinity, ease:'easeInOut' }}/>
          ))}

          {/* House */}
          <House x={20} y={120} />

          {/* Fence (level 2+) */}
          <AnimatePresence>
            {show(2) && (
              <motion.g key="fence" initial={{opacity:0,y:10}} animate={{opacity:1,y:0}}>
                <Fence x={100} y={155} count={9}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Tree (level 2+) */}
          <AnimatePresence>
            {show(2) && (
              <motion.g key="tree" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}}
                transition={{type:'spring',stiffness:300}}>
                <rect x={175} y={130} width={8} height={42} fill="#795548"/>
                <motion.circle cx={179} cy={118} r={26} fill="#43a047"
                  animate={{r:[26,27,26]}} transition={{duration:2.5,repeat:Infinity,ease:'easeInOut'}}/>
                <circle cx={165} cy={127} r={17} fill="#388e3c"/>
                <circle cx={193} cy={126} r={17} fill="#2e7d32"/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Flowers (level 2+) */}
          <AnimatePresence>
            {show(2) && (
              <motion.g key="flowers" initial={{opacity:0}} animate={{opacity:1}}>
                <Flowers positions={[[215,158],[226,155],[237,159],[248,156],[259,158]]}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Barn (level 4+) */}
          <AnimatePresence>
            {show(4) && (
              <motion.g key="barn" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}}
                transition={{type:'spring',stiffness:200}}>
                <Barn x={290} y={112}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Windmill (level 5+) */}
          <AnimatePresence>
            {show(5) && (
              <motion.g key="windmill" initial={{opacity:0,y:20}} animate={{opacity:1,y:0}}>
                <Windmill x={160} y={170}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Pond (level 4+) */}
          <AnimatePresence>
            {show(4) && (
              <motion.g key="pond" initial={{scale:0}} animate={{scale:1}} transition={{type:'spring'}}>
                <Pond x={250} y={178}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Veggie garden (level 5+) */}
          <AnimatePresence>
            {show(5) && (
              <motion.g key="garden" initial={{opacity:0}} animate={{opacity:1}}>
                <VeggieGarden x={200} y={160}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* ── Animals ── */}

          {/* Sheep (level 2+) */}
          <AnimatePresence>
            {show(2) && (
              <motion.g key="sheep" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.1}}>
                <Sheep x={120} y={162} onClick={()=>handleClick('sheep',sfx.baa,120,162)} bouncing={clicked==='sheep'}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Chicken (level 3+) */}
          <AnimatePresence>
            {show(3) && (
              <motion.g key="chicken" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.15}}>
                <Chicken x={270} y={162} onClick={()=>handleClick('chicken',sfx.cluck,270,162)} bouncing={clicked==='chicken'}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Cow (level 4+) */}
          <AnimatePresence>
            {show(4) && (
              <motion.g key="cow" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.1}}>
                <Cow x={300} y={160} onClick={()=>handleClick('cow',sfx.moo,300,160)} bouncing={clicked==='cow'}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Duck on pond (level 4+) */}
          <AnimatePresence>
            {show(4) && (
              <motion.g key="duck" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.2}}>
                <Duck x={240} y={172} onClick={()=>handleClick('duck',sfx.quack,240,172)} bouncing={clicked==='duck'}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Pig (level 3+) */}
          <AnimatePresence>
            {show(3) && (
              <motion.g key="pig" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.12}}>
                <Pig x={200} y={164} onClick={()=>handleClick('pig',sfx.oink,200,164)} bouncing={clicked==='pig'}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Farmer (level 3+) */}
          <AnimatePresence>
            {show(3) && (
              <motion.g key="farmer" initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} transition={{type:'spring',delay:.08}}>
                <Farmer x={85} y={168} onClick={()=>handleClick('farmer',sfx.chime,85,168)} bouncing={clicked==='farmer'}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Tractor (level 5+) */}
          <AnimatePresence>
            {show(5) && (
              <motion.g key="tractor" initial={{x:-100,opacity:0}} animate={{x:0,opacity:1}} transition={{type:'spring',stiffness:100}}>
                <Tractor x={50} y={168} onClick={()=>handleClick('tractor',sfx.toot,80,168)} bouncing={clicked==='tractor'}/>
              </motion.g>
            )}
          </AnimatePresence>

          {/* Stars at max level */}
          {level===6 && [40,130,220,310,380].map((x,i)=>(
            <motion.text key={i} x={x} y={20} fontSize={12} textAnchor="middle"
              animate={{opacity:[.2,1,.2],y:[20,15,20]}}
              transition={{duration:2+i*.4,repeat:Infinity,ease:'easeInOut',delay:i*.3}}>⭐</motion.text>
          ))}

          {/* Click hint */}
          <motion.text x={200} y={225} fontSize={10} textAnchor="middle" fill="rgba(255,255,255,0.7)"
            animate={{opacity:[0.4,0.8,0.4]}} transition={{duration:2.5,repeat:Infinity}}>
            Tippe auf die Tiere! 🐄🐑🐷
          </motion.text>
        </svg>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop:10, background:'rgba(0,0,0,0.06)', borderRadius:99, height:8, overflow:'hidden' }}>
        <motion.div
          initial={{ width:0 }}
          animate={{ width:`${(completedCount/totalModules)*100}%` }}
          transition={{ duration:1, ease:'easeOut' }}
          style={{ height:'100%', background:'linear-gradient(90deg,#66bb6a,#43a047)', borderRadius:99 }}
        />
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, fontSize:12, color:'var(--text-secondary)', fontFamily:'var(--font-body)' }}>
        <span>{completedCount} / {totalModules} Module abgeschlossen</span>
        <span>Level {level} / 6</span>
      </div>
    </div>
  )
}
