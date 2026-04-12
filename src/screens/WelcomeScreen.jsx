import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { useApp } from '../AppContext.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import Button from '../components/Button.jsx'

function Orb({ x, y, size, color, delay }) {
  return (
    <motion.div
      animate={{ y: [0, -18, 0], x: [0, 8, 0] }}
      transition={{ duration: 5 + delay, repeat: Infinity, ease: 'easeInOut', delay }}
      style={{
        position: 'absolute', left: x, top: y,
        width: size, height: size, borderRadius: '50%',
        background: color, filter: `blur(${size * 0.35}px)`,
        pointerEvents: 'none',
      }}
    />
  )
}

function StarBg() {
  const stars = Array.from({ length: 28 }, (_, i) => ({
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 100}%`,
    r: Math.random() * 2.5 + 1,
    delay: Math.random() * 3,
  }))
  return (
    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      {stars.map((s, i) => (
        <motion.circle key={i} cx={s.x} cy={s.y} r={s.r} fill="white"
          animate={{ opacity: [0.2, 0.9, 0.2] }}
          transition={{ duration: 2.5, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </svg>
  )
}

export default function WelcomeScreen() {
  const { dispatch } = useApp()

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #1A0050 0%, #4A00E0 40%, #8E2DE2 75%, #C64FCC 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
      padding: 24,
    }}>
      <StarBg />
      <Orb x="5%" y="10%" size={220} color="rgba(167,139,250,0.28)" delay={0} />
      <Orb x="65%" y="5%" size={160} color="rgba(255,107,107,0.2)" delay={1.2} />
      <Orb x="70%" y="60%" size={280} color="rgba(108,99,255,0.22)" delay={0.8} />
      <Orb x="-5%" y="65%" size={200} color="rgba(78,205,196,0.18)" delay={2} />

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1, gap: 0 }}
      >
        {/* Logo text */}
        <motion.div
          animate={{ textShadow: ['0 0 20px rgba(255,217,61,0.5)', '0 0 40px rgba(255,217,61,0.9)', '0 0 20px rgba(255,217,61,0.5)'] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(42px, 10vw, 72px)',
            fontWeight: 700,
            color: '#FFD93D',
            letterSpacing: '-1px',
            lineHeight: 1,
            marginBottom: 6,
          }}
        >
          LumiLearn
        </motion.div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(14px, 3vw, 18px)', color: 'rgba(255,255,255,0.75)', marginBottom: 36, letterSpacing: 1 }}>
          ✨ Lernen macht Spaß ✨
        </div>

        <LumiCharacter mood="excited" size={180} />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ marginTop: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}
        >
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(15px, 3.5vw, 20px)', color: 'rgba(255,255,255,0.88)', textAlign: 'center', maxWidth: 340 }}>
            Dein persönlicher Lernbegleiter für Kinder von 3–7 Jahren
          </div>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{ marginTop: 8 }}
          >
            <Button size="lg" variant="gold" onClick={() => dispatch({ type: 'NAVIGATE', payload: 'language' })}>
              Jetzt starten 🚀
            </Button>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Bottom wave */}
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none"
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: 80 }}>
        <path d="M0,40 C360,80 1080,0 1440,40 L1440,80 L0,80 Z" fill="rgba(240,244,255,0.12)" />
      </svg>
    </div>
  )
}
