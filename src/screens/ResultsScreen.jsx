import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { ALL_MISSIONS } from '../AppContext.jsx'
import { PixelLumi, PxStar, uiSpr } from '../components/PixelUI.jsx'
import Button from '../components/Button.jsx'
import Confetti from '../components/Confetti.jsx'
import { sfx } from '../sfx.js'
import { voice } from '../voice.js'
import { afterNarration } from '../narrator.js'
import { useT } from '../i18n.js'
import { useProfile } from '../hooks/useProfile.js'

export default function ResultsScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  const { streak: profileStreak } = useProfile()
  const { gameResult, currentGame } = state
  const stars       = gameResult?.stars        ?? 0
  const score       = gameResult?.score        ?? 0
  const total       = gameResult?.total        ?? 0
  const moduleId    = gameResult?.moduleId     ?? 'numbers'
  const level       = gameResult?.level        ?? 1
  const nextLevelNum   = gameResult?.nextLevelNum   ?? null
  const justCompleted  = gameResult?.justCompleted  ?? false
  const isFirstPass    = gameResult?.isFirstPass    ?? false
  const maxLevel       = gameResult?.maxLevel       ?? 5
  const newMissionsCompleted = gameResult?.newMissionsCompleted ?? []
  const streakCount    = profileStreak?.count ?? 0

  // Modules where a fraction counter makes sense
  const SCORE_MODULES = ['numbers','letters','listen','words','patterns','shapes','emotions','shadows','bubbles']
  const showFraction  = SCORE_MODULES.includes(moduleId) && total > 0
  // nextLevel is now derived directly from gameResult
  const nextLevel     = nextLevelNum   // kept as alias for clarity

  const [showButtons, setShowButtons] = useState(false)
  useEffect(() => {
    const b = setTimeout(() => setShowButtons(true), 1400)
    return () => clearTimeout(b)
  }, [])
  useEffect(() => {
    const t = setTimeout(() => {
      if (stars >= 3)      sfx.complete()
      else if (stars >= 1) sfx.correct()
    }, 350)
    // Ein Lob, sonst nichts.
    //
    // Vorher liefen hier drei Ansagen gegeneinander: das Spiel sagte seinen
    // Glückwunsch, der Bildschirmwechsel schnitt ihn ab, dieses Lob startete
    // nach 900 ms — und wurde seinerseits von einer Münz-Ansage zerschnitten.
    // Die Münzen sind inzwischen ganz aus der App verschwunden, und das Lob
    // wartet, bis der Satz aus dem Spiel zu Ende ist, statt ihn zu überfahren.
    const stop = afterNarration(() => {
      if (stars >= 2)      voice.play('audio/allgemein/das-hast-du-super-gemacht.mp3')
      else if (stars >= 1) voice.play('audio/allgemein/ja-super.mp3')
      else                 voice.play('audio/allgemein/klasse-versuch-es-direkt-noch-einmal.mp3')
    }, { minMs: 900 })
    return () => { clearTimeout(t); stop(); voice.stop() }
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
      isolation: 'isolate',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {stars >= 2 && <Confetti count={stars === 3 ? 60 : 28} yFrom="-5vh" yTo="110vh" />}

      {/* Pixel landscape, dimmed so the result card stands out */}
      <div aria-hidden="true" className="px-art" style={{
        position:'fixed', inset:0, zIndex:-2,
        backgroundImage:`url(${uiSpr('landscape.png')})`,
        backgroundSize:'cover', backgroundPosition:'center 70%', imageRendering:'pixelated',
      }} />
      <div aria-hidden="true" style={{ position:'fixed', inset:0, zIndex:-1, background:'rgba(42,27,61,0.35)' }} />

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="px-panel"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, zIndex: 1, width: '100%', maxWidth: 500, padding: 'clamp(22px,4vw,34px) clamp(18px,4vw,30px)' }}
      >
        <PixelLumi size={136} happy={stars >= 2} />

        <div style={{
            fontFamily: 'var(--font-heading)',
            fontSize: 'clamp(26px, 6vw, 38px)',
            fontWeight: 700,
            color: 'var(--px-ink)',
            textAlign: 'center',
            lineHeight: 1.15,
          }}
        >
          {msg}
        </div>

        {/* Stars */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 280 }}
          style={{
            background: 'rgba(42,27,61,0.82)',
            borderRadius: 10,
            padding: '18px 36px',
            border: '3px solid var(--px-ink)',
            boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 14,
            width: '100%',
          }}
        >
          {/* Animated star row */}
          <div style={{ display: 'flex', gap: 10 }}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: idx < stars ? 1 : 0.7, rotate: 0 }}
                transition={{ delay: 0.5 + idx * 0.15, type: 'spring', stiffness: 400 }}
                style={{ filter: idx < stars ? 'drop-shadow(0 0 10px rgba(255,201,60,0.8))' : 'none' }}
              >
                <PxStar size={60} off={idx >= stars} />
              </motion.div>
            ))}
          </div>

          {showFraction && (
            <div style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: 18, fontWeight: 600 }}>
              {score} von {total} richtig ✅
            </div>
          )}
        </motion.div>

        {/* Serie — der Bauernhof und die Sterne zeigen den Fortschritt, die
            Tagesserie den Fleiß. Hier stand vorher eine Münzanzeige; sie
            versprach eine Währung, die es nie gab. */}
        {streakCount >= 2 && (
          <motion.div
            initial={{ scale:0, y:10 }}
            animate={{ scale:1, y:0 }}
            transition={{ delay:0.8, type:'spring', stiffness:350 }}
            style={{ display:'flex', justifyContent:'center', marginTop:4 }}
          >
            <div className="px-chip" style={{ fontFamily:'var(--font-heading)', fontSize:17 }}>
              <span style={{ fontSize:18 }}>🔥</span> {streakCount} Tage!
            </div>
          </motion.div>
        )}

          {/* Mission completions */}
          {newMissionsCompleted.length > 0 && (
            <motion.div
              initial={{ opacity:0, y:10 }}
              animate={{ opacity:1, y:0 }}
              transition={{ delay:1.0 }}
              style={{ display:'flex', flexDirection:'column', gap:6, width:'100%', alignItems:'center' }}
            >
              {newMissionsCompleted.map(id => {
                const m = ALL_MISSIONS.find(x => x.id === id)
                if (!m) return null
                return (
                  <div key={id} style={{
                    display:'flex', alignItems:'center', gap:8,
                    background:'#d9f5c8', borderRadius:8, padding:'6px 14px',
                    border:'3px solid var(--px-ink)',
                  }}>
                    <span style={{ fontSize:18 }}>✅</span>
                    <span style={{ fontFamily:'var(--font-heading)', fontWeight:600, color:'var(--px-ink)', fontSize:15 }}>Aufgabe erledigt: {t('mission.' + id)}</span>
                  </div>
                )
              })}
            </motion.div>
          )}

          {justCompleted && (
            <motion.div
              initial={{ scale:0, y:-20 }}
              animate={{ scale:1, y:0 }}
              transition={{ delay:1.2, type:'spring', stiffness:380 }}
              className="px-title"
              style={{
                background:'var(--px-gold)', border:'3px solid var(--px-ink)',
                borderRadius:10, padding:'10px 24px',
                fontSize:'clamp(18px,4vw,24px)', textAlign:'center',
                boxShadow:'inset 0 -5px 0 rgba(0,0,0,0.2), 0 5px 0 var(--px-ink)',
              }}
            >
              🏆 Alle {maxLevel} Level gemeistert!
            </motion.div>
          )}

          {/* Buttons — appear after short delay */}
          {showButtons && (
            <motion.div
              initial={{ opacity:0, y:16 }}
              animate={{ opacity:1, y:0 }}
              transition={{ type:'spring', stiffness:300, damping:22 }}
              style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', alignItems:'center', marginTop:8 }}
            >
              {/* 0-star mode: big Nochmal, small home */}
              {stars === 0 && (
                <>
                  <Button variant="gold" size="lg" onClick={() => dispatch({ type: 'START_GAME', payload: { moduleId, level } })}>
                    🔄 Nochmal versuchen!
                  </Button>
                  <Button variant="white" size="sm" onClick={() => dispatch({ type: 'NAVIGATE', payload: 'home' })}>
                    🏠 Menü
                  </Button>
                </>
              )}
              {/* 1-3 star mode */}
              {stars >= 1 && (
                <>
                  {/* Primary action: next level or mastered */}
                  {nextLevel && (
                    <Button variant="gold" size="lg" onClick={() => dispatch({ type: 'START_GAME', payload: { moduleId, level: nextLevel } })}>
                      {isFirstPass ? `🚀 Level ${nextLevel} starten!` : `➡️ Weiter zu Level ${nextLevel}`}
                    </Button>
                  )}
                  {!nextLevel && justCompleted && (
                    <Button variant="gold" size="lg" onClick={() => dispatch({ type: 'NAVIGATE', payload: 'home' })}>
                      🌟 Zurück zur Auswahl
                    </Button>
                  )}
                  {/* Secondary actions row */}
                  <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
                    <Button variant="white" size="md" onClick={() => dispatch({ type: 'START_GAME', payload: { moduleId, level } })}>
                      🔄 Nochmal
                    </Button>
                    <Button variant="primary" size="md" onClick={() => dispatch({ type: 'NAVIGATE', payload: 'home' })}>
                      🏠 Menü
                    </Button>
                  </div>
                </>
              )}
            </motion.div>
          )}
      </motion.div>
    </div>
  )
}
