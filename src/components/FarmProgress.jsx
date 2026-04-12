import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
const sprite = (name) => BASE + 'sprites/farm/' + name

// ── Web Audio ─────────────────────────────────────────────────────────────────
let _ac = null
function getAc() {
  if (!_ac) _ac = new (window.AudioContext || window.webkitAudioContext)()
  if (_ac.state === 'suspended') _ac.resume()
  return _ac
}
function tone(f, type, t0, dur, vol = 0.14) {
  try {
    const o = getAc().createOscillator(), g = getAc().createGain()
    o.connect(g); g.connect(getAc().destination)
    o.type = type; o.frequency.setValueAtTime(f, t0)
    g.gain.setValueAtTime(vol, t0)
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur)
    o.start(t0); o.stop(t0 + dur + 0.05)
  } catch {}
}
const sfx = {
  moo()   { const t = getAc().currentTime; tone(130,'sine',t,.5,.2); tone(110,'sine',t+.2,.4,.1) },
  cluck() { const t = getAc().currentTime; [0,.07,.14].forEach(d => tone(650+Math.random()*150,'square',t+d,.06,.1)) },
  chime() { const t = getAc().currentTime; [523,659,784,1047].forEach((f,i) => tone(f,'sine',t+i*.08,.2,.13)) },
}

// ── Sprite Animator ───────────────────────────────────────────────────────────
function SpriteAnim({ src, frameW, frameH, cols, totalFrames, fps = 8, scale = 3, row = 0, onClick, style = {} }) {
  const canvasRef = useRef(null)
  const imgRef = useRef(null)
  const frameRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      ctx.imageSmoothingEnabled = false

      const draw = () => {
        if (!canvasRef.current) return
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        const col = frameRef.current % cols
        ctx.drawImage(img,
          col * frameW, row * frameH, frameW, frameH,
          0, 0, canvas.width, canvas.height
        )
        frameRef.current = (frameRef.current + 1) % totalFrames
        timerRef.current = setTimeout(draw, 1000 / fps)
      }
      draw()
    }
    img.src = src
    return () => clearTimeout(timerRef.current)
  }, [src, row, fps])

  return (
    <canvas
      ref={canvasRef}
      width={frameW * scale}
      height={frameH * scale}
      onClick={onClick}
      style={{ imageRendering: 'pixelated', cursor: onClick ? 'pointer' : 'default', ...style }}
    />
  )
}

// ── Farm config ───────────────────────────────────────────────────────────────
function getLevel(n) {
  if (n <= 2) return 1; if (n <= 5) return 2; if (n <= 8) return 3
  if (n <= 12) return 4; if (n <= 16) return 5; return 6
}
const LABELS = ['', 'Kleiner Hof', 'Wachsender Hof', 'Blühender Hof', 'Großer Hof', 'Prächtiger Hof', 'Traumhof ⭐']
const NEXT_AT = [0, 3, 6, 9, 13, 17, Infinity]
const SKY_COLORS = ['', '#c8e8ff', '#a8d8ff', '#7ec8f0', '#5bb0ff', '#3a9aff', '#1a7aff']

// ── Sparkle feedback ──────────────────────────────────────────────────────────
function Sparkles({ x, y }) {
  return (
    <div style={{ position: 'absolute', left: x - 20, top: y - 50, pointerEvents: 'none', zIndex: 30 }}>
      {['⭐', '✨', '💫'].map((p, i) => (
        <motion.div key={i}
          initial={{ opacity: 1, x: 0, y: 0 }}
          animate={{ opacity: 0, x: (i - 1) * 22, y: -40 }}
          transition={{ duration: 0.7, delay: i * 0.07 }}
          style={{ position: 'absolute', fontSize: 14 }}
        >{p}</motion.div>
      ))}
    </div>
  )
}

// ── Simple animated cloud ─────────────────────────────────────────────────────
function AnimCloud({ delay = 0, y = 30, scale = 1 }) {
  return (
    <motion.div
      animate={{ x: ['0%', '120%'] }}
      transition={{ duration: 22 + delay * 3, repeat: Infinity, ease: 'linear', delay }}
      initial={{ x: '-20%' }}
      style={{ position: 'absolute', top: y, left: 0, opacity: 0.9, transform: `scale(${scale})` }}
    >
      <svg width="80" height="40" viewBox="0 0 80 40">
        <ellipse cx="40" cy="28" rx="35" ry="16" fill="white" />
        <ellipse cx="52" cy="20" rx="22" ry="16" fill="white" />
        <ellipse cx="28" cy="22" rx="18" ry="13" fill="white" />
      </svg>
    </motion.div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function FarmProgress({ completedCount = 0, totalModules = 17, profile }) {
  const level = getLevel(completedCount)
  const show = (min) => level >= min
  const [sparkle, setSparkle] = useState(null)

  const handleClick = useCallback((id, sfxFn, x, y) => {
    try { sfxFn() } catch {}
    setSparkle({ id, x, y })
    setTimeout(() => setSparkle(null), 800)
  }, [])

  const nextUnlock = NEXT_AT[level] !== Infinity
    ? `${NEXT_AT[level] - completedCount} Module bis zum nächsten Upgrade ✨`
    : '🏆 Maximaler Hof erreicht!'

  return (
    <div style={{ width: '100%', maxWidth: 640, margin: '0 auto', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, padding: '0 4px' }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-primary)', fontWeight: 700 }}>
          🌾 {LABELS[level]}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
          {nextUnlock}
        </div>
      </div>

      {/* Farm scene */}
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
        position: 'relative', height: 220,
        background: `linear-gradient(180deg, ${SKY_COLORS[level]} 0%, ${SKY_COLORS[level]} 60%, #66bb6a 60%, #388e3c 100%)`,
        transition: 'background 0.8s ease',
      }}>
        {/* Clouds */}
        <AnimCloud delay={0} y={15} scale={1} />
        <AnimCloud delay={6} y={35} scale={0.65} />

        {/* Sun */}
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          style={{ position: 'absolute', top: 8, right: 20, fontSize: 36 }}>
          ☀️
        </motion.div>

        {/* House (always) */}
        <div style={{ position: 'absolute', left: 10, bottom: 40 }}>
          <SpriteAnim src={sprite('house.png')} frameW={16} frameH={16} cols={14} totalFrames={1} fps={1} scale={4} row={0} />
        </div>

        {/* Tree (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="tree" initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 200 }}
              style={{ position: 'absolute', left: 130, bottom: 40 }}>
              <SpriteAnim src={sprite('tree.png')} frameW={16} frameH={16} cols={10} totalFrames={3} fps={2} scale={3} row={0} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Farmer (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="farmer" initial={{ x: -50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              style={{ position: 'absolute', left: 85, bottom: 42, cursor: 'pointer', zIndex: 10 }}
              onClick={() => handleClick('farmer', sfx.chime, 100, 130)}>
              <SpriteAnim src={sprite('farmer_idle.png')} frameW={16} frameH={16} cols={8} totalFrames={8} fps={6} scale={3} row={0} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Cow (level 3+) */}
        <AnimatePresence>
          {show(3) && (
            <motion.div key="cow" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.1 }}
              style={{ position: 'absolute', left: 200, bottom: 40, cursor: 'pointer', zIndex: 10 }}
              onClick={() => handleClick('cow', sfx.moo, 230, 130)}>
              <SpriteAnim src={sprite('cow.png')} frameW={16} frameH={16} cols={8} totalFrames={8} fps={5} scale={3} row={2} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Chicken (level 2+) */}
        <AnimatePresence>
          {show(2) && (
            <motion.div key="chicken" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', delay: 0.15 }}
              style={{ position: 'absolute', left: 310, bottom: 44, cursor: 'pointer', zIndex: 10 }}
              onClick={() => handleClick('chicken', sfx.cluck, 325, 135)}>
              <SpriteAnim src={sprite('chicken.png')} frameW={16} frameH={16} cols={4} totalFrames={4} fps={6} scale={3} row={0} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* More animals at higher levels */}
        <AnimatePresence>
          {show(4) && (
            <motion.div key="cow2" initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
              style={{ position: 'absolute', left: 370, bottom: 40, cursor: 'pointer', zIndex: 10 }}
              onClick={() => handleClick('cow2', sfx.moo, 390, 130)}>
              <SpriteAnim src={sprite('cow.png')} frameW={16} frameH={16} cols={8} totalFrames={8} fps={4} scale={2.5} row={0} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Windmill emoji (level 5+) */}
        <AnimatePresence>
          {show(5) && (
            <motion.div key="windmill" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              style={{ position: 'absolute', right: 20, bottom: 44, fontSize: 40 }}>
              <motion.span animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                style={{ display: 'block' }}>🎡</motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Max level stars */}
        {level === 6 && ['⭐', '✨', '🌟'].map((s, i) => (
          <motion.div key={i} style={{ position: 'absolute', top: 8, left: 30 + i * 40, fontSize: 18 }}
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}>
            {s}
          </motion.div>
        ))}

        {/* Hint text */}
        {show(2) && (
          <motion.div animate={{ opacity: [0.4, 0.8, 0.4] }} transition={{ duration: 3, repeat: Infinity }}
            style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.85)', fontFamily: 'var(--font-body)' }}>
            Tippe auf die Tiere! 🐄🐔
          </motion.div>
        )}

        {/* Sparkle feedback */}
        <AnimatePresence>
          {sparkle && <Sparkles key={sparkle.id} x={sparkle.x} y={sparkle.y} />}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div style={{ marginTop: 10, background: 'rgba(0,0,0,0.06)', borderRadius: 99, height: 8, overflow: 'hidden' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(completedCount / totalModules) * 100}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{ height: '100%', background: 'linear-gradient(90deg,#66bb6a,#43a047)', borderRadius: 99 }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'var(--font-body)' }}>
        <span>{completedCount} / {totalModules} Module abgeschlossen</span>
        <span>Level {level} / 6</span>
      </div>
    </div>
  )
}
