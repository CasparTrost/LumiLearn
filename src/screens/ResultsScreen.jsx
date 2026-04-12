import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import StarRow from '../components/StarRow.jsx'
import Button from '../components/Button.jsx'
import { sfx } from '../sfx.js'
import { voice } from '../voice.js'

function Confetti({ count = 32 }) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    x: 10 + Math.random() * 80,
    color: ['#FFD93D', '#FF6B6B', '#6C63FF', '#4ECDC4', '#6BCB77', '#FD79A8'][i % 6],
    size: 8 + Math.random() * 10,
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1,
    rotate: Math.random() * 360,
  }))
  return (
    <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: `${p.x}vw`, y: '-5vh', rotate: 0, opacity: 1 }}
          animate={{ y: '110vh', rotate: p.rotate + 720, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? 3 : '50% 0',
          }}
        />
      ))}
    </div>
  )
}

export default function ResultsScreen() {
  const { state, dispatch } = useApp()
  const { gameResult, currentGame } = state
  const stars       = gameResult?.stars        ?? 0
  const score       = gameResult?.score        ?? 0
  const total       = gameResult?.total        ?? 0
  const moduleId    = gameResult?.moduleId     ?? 'numbers'
  const level       = gameResult?.level        ?? 1
  const nextLevelNum   = gameResult?.nextLevelNum   ?? null   // null = no more levels
  const justCompleted  = gameResult?.justCompleted  ?? false  // all levels done for first time
  const isFirstPass    = gameResult?.isFirstPass    ?? false  // first time passing this level
  const maxLevel       = gameResult?.maxLevel       ?? 5

  // Modules where a fraction counter makes sense
  const SCORE_MODULES = ['numbers','letters','listen','words','patterns','shapes','emotions','shadows','bubbles']
  const showFraction  = SCORE_MODULES.includes(moduleId) && total > 0
  // nextLevel is now derived directly from gameResult
  const nextLevel     = nextLevelNum   // kept as alias for clarity

  const mood = stars >= 3 ? 'excited' : stars >= 2 ? 'happy' : stars >= 1 ? 'encouraging' : 'thinking'
  useEffect(() => {
    const t = setTimeout(() => {
      if (stars >= 3)      sfx.complete()
      else if (stars >= 1) sfx.correct()
    }, 350)
    const v = setTimeout(() => {
      if (stars >= 2)      voice.play('audio/allgemein/das-hast-du-super-gemacht.mp3')
      else if (stars >= 1) voice.play('audio/allgemein/ja-super.mp3')
      else                 voice.play('audio/allgemein/klasse-versuch-es-direkt-noch-einmal.mp3')
    }, 900)
    return () => { clearTimeout(t); clearTimeout(v); voice.stop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const messages = {
    3: ['Fantastisch! 🎉', 'Du bist ein Superstar! ⭐', 'Perfekt! Wow!'],
    2: ['Sehr gut gemacht! 👏', 'Weiter so! 🌟', 'Klasse!'],
    1: ['Gut versucht! 💪', 'Nächstes Mal schaffst du das! 🌈', 'Üb weiter!'],
    0: ['Nicht aufgeben! 💕', 'Probier\'s nochmal! 🔄', 'Du schaffst das!'],
  }
  const msg = justCompleted
    ? '🎉 Spiel abgeschlossen! Du bist ein Meister!'
    : isFirstPass && nextLevel
      ? `🚀 Level ${nextLevel} freigeschaltet!`
      : messages[stars][Math.floor(Math.random() * 3)]

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #1A0050 0%, #4A00E0 50%, #8E2DE2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {stars >= 2 && <Confetti count={stars === 3 ? 60 : 28} />}

      {/* Decorative glowing orbs */}
      <div style={{ position:'fixed', top:'10%', left:'5%', width:220, height:220, borderRadius:'50%', background:'radial-gradient(circle, rgba(142,45,226,0.25), transparent 70%)', pointerEvents:'none', zIndex:0 }} />
      <div style={{ position:'fixed', bottom:'15%', right:'5%', width:180, height:180, borderRadius:'50%', background:'radial-gradient(circle, rgba(255,217,61,0.2), transparent 70%)', pointerEvents:'none', zIndex:0 }} />

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 1, width: '100%', maxWidth: 480 }}
      >
        <LumiCharacter mood={mood} size={160} />

        <motion.div
          animate={{ scale: [1, 1.04, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(28px, 7vw, 44px)',
            color: 'white',
            textAlign: 'center',
            textShadow: '0 2px 20px rgba(0,0,0,0.3)',
          }}
        >
          {msg}
        </motion.div>

        {/* Stars */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 280 }}
          style={{
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 28,
            padding: '24px 44px',
            backdropFilter: 'blur(16px)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            width: '100%',
          }}
        >
          {/* Animated star row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <motion.span
                key={idx}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: idx < stars ? 1 : 0.4, rotate: 0, opacity: idx < stars ? 1 : 0.3 }}
                transition={{ delay: 0.5 + idx * 0.15, type: 'spring', stiffness: 400 }}
                style={{ fontSize: 52, lineHeight: 1, filter: idx < stars ? 'drop-shadow(0 0 12px #FFD93D)' : 'none' }}
              >
                ⭐
              </motion.span>
            ))}
          </div>

          {showFraction && (
            <div style={{ fontFamily: 'var(--font-body)', color: 'rgba(255,255,255,0.9)', fontSize: 18, fontWeight: 600 }}>
              {score} von {total} richtig ✅
            </div>
          )}
        </motion.div>

          {justCompleted && (
            <motion.div
              initial={{ scale:0, y:-20 }}
              animate={{ scale:1, y:0 }}
              transition={{ delay:1.2, type:'spring', stiffness:380 }}
              style={{
                background:'linear-gradient(135deg,#FFD93D,#FF9F43)',
                borderRadius:20, padding:'12px 28px',
                fontFamily:'var(--font-heading)', fontSize:'clamp(18px,4vw,26px)',
                color:'white', fontWeight:800, textAlign:'center',
                boxShadow:'0 6px 24px rgba(255,217,61,0.5)',
              }}
            >
              🏆 Alle {maxLevel} Level gemeistert!
            </motion.div>
          )}

          {/* Buttons */}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
          <Button variant="white" size="md" onClick={() => dispatch({ type: 'START_GAME', payload: { moduleId, level } })}>
            🔄 Nochmal
          </Button>
          {nextLevel && (
            <Button variant="gold" size="md" onClick={() => dispatch({ type: 'START_GAME', payload: { moduleId, level: nextLevel } })}>
              {isFirstPass ? `🚀 Level ${nextLevel}` : `➡️ Level ${nextLevel}`}
            </Button>
          )}
          {!nextLevel && justCompleted && (
            <Button variant="gold" size="md" onClick={() => dispatch({ type: 'NAVIGATE', payload: 'home' })}>
              🌟 Zurück zur Auswahl
            </Button>
          )}
          <Button variant="primary" size="md" onClick={() => dispatch({ type: 'NAVIGATE', payload: 'home' })}>
            🏠 Menü
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
