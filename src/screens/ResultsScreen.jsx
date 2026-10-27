import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, missionDef, todayMs } from '../AppContext.jsx'
import { PixelLumi, PxStar, PxIcon, uiSpr } from '../components/PixelUI.jsx'
import Confetti from '../components/Confetti.jsx'
import { animalsFor, nextAnimal, einTier, zumTier, farmAsset } from '../components/FarmProgress.jsx'
import { sfx } from '../sfx.js'
import { afterNarration, narrate, stopNarration } from '../narrator.js'
import { sayNumber, sayCount } from '../tts.js'
import { starsFor } from '../lib/score.js'
import { useT } from '../i18n.js'

// One star means the level is done and the next one is open — the texts
// say so ("Üb weiter!" next to an unlocked level was a contradiction).
const MESSAGES = {
  3: ['Fantastisch!', 'Super gemacht!', 'Perfekt!'],
  2: ['Sehr gut gemacht!', 'Klasse!', 'Toll gemacht!'],
  1: ['Geschafft!', 'Level geschafft!', 'Gut gemacht!'],
  0: ['Nicht aufgeben!', 'Du schaffst das!', 'Gleich klappt es!'],
}
const PRAISE_CLIP = s => s >= 2 ? 'audio/allgemein/das-hast-du-super-gemacht.mp3'
  : s >= 1 ? 'audio/allgemein/ja-super.mp3'
  : 'audio/allgemein/klasse-versuch-es-direkt-noch-einmal.mp3'
const cap = s => s[0].toUpperCase() + s.slice(1)

const NO_FRACTION = new Set(['coloring', 'maze'])

export default function ResultsScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  const { gameResult } = state
  const stars       = gameResult?.stars        ?? 0
  const score       = gameResult?.score        ?? 0
  const total       = gameResult?.total        ?? 0
  const moduleId    = gameResult?.moduleId     ?? 'numbers'
  const level       = gameResult?.level        ?? 1
  const nextLevel      = gameResult?.nextLevelNum   ?? null
  const justCompleted  = gameResult?.justCompleted  ?? false
  const masteredWell   = gameResult?.masteredWell   ?? false
  const isFirstPass    = gameResult?.isFirstPass    ?? false
  const maxLevel       = gameResult?.maxLevel       ?? 5
  const newMissionsCompleted = gameResult?.newMissionsCompleted ?? []
  const streakCount    = gameResult?.streakCount ?? 0
  const farmBefore     = gameResult?.farmBefore ?? 0
  const farmAfter      = gameResult?.farmAfter ?? farmBefore

  // What the round meant for the farm
  const newAnimals = animalsFor(farmAfter).slice(animalsFor(farmBefore).length)
  const next       = nextAnimal(farmAfter)

  // "7 von 7 richtig" next to one star was a contradiction: the line now
  // counts what the stars count (answers right on the first try) and is
  // left out for games that rate otherwise (Memo by moves, the maze by
  // dragon hits) and for free painting, where nothing is right or wrong.
  const showFraction = total > 0 && starsFor(score, total) === stars && !NO_FRACTION.has(moduleId)

  // Chosen once: picked during render, the heading changed when the
  // buttons appeared after 1.4 s ("Du schaffst das!" → "Nicht aufgeben!")
  const msg = useMemo(() => {
    if (justCompleted) return masteredWell ? 'Du bist ein Meister!' : 'Alle Level geschafft!'
    if (isFirstPass && nextLevel) return `Level ${nextLevel} ist offen!`
    const list = MESSAGES[Math.max(0, Math.min(3, stars))]
    return list[Math.floor(Math.random() * list.length)]
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [showButtons, setShowButtons] = useState(false)
  useEffect(() => {
    const b = setTimeout(() => setShowButtons(true), 1400)
    return () => clearTimeout(b)
  }, [])

  useEffect(() => {
    const tm = setTimeout(() => {
      if (stars >= 3)      sfx.complete()
      else if (stars >= 1) sfx.correct()
    }, 350)
    // The praise, then what is new — all of it was only on screen before,
    // and mastering a whole game sounded like a narrow pass.
    const news = []
    if (justCompleted) news.push(masteredWell ? 'Du hast alle Level geschafft. Du bist ein Meister!' : 'Du hast alle Level geschafft! Hol dir noch mehr Sterne.')
    else if (isFirstPass && nextLevel) news.push(`Level ${sayNumber(nextLevel)} ist jetzt offen.`)
    if (stars === 0) {
      if (score > 0) news.push(`Du hattest schon ${sayCount(score, 'Aufgabe', 'f')} richtig.`)
      news.push(level > 1 ? 'Versuch es noch einmal, oder spiel das leichtere Level.' : 'Versuch es noch einmal.')
    }
    if (newMissionsCompleted.length) news.push(newMissionsCompleted.length === 1 ? 'Du hast eine Tagesaufgabe geschafft!' : 'Du hast Tagesaufgaben geschafft!')
    newAnimals.forEach(a => news.push(`${cap(einTier(a))} zieht auf deinen Hof!`))
    const stop = afterNarration(() => {
      narrate([
        { src: PRAISE_CLIP(stars) },
        ...news.map((text, i) => ({ text, gap: i === 0 ? 250 : 150 })),
      ])
    }, { minMs: 900 })
    return () => { clearTimeout(tm); stop(); stopNarration() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (lv) => dispatch({ type: 'START_GAME', payload: { moduleId, level: lv } })
  const home = () => dispatch({ type: 'NAVIGATE', payload: 'home' })

  // With the day's play time used up (parent area) the way leads home,
  // where Lumi says goodbye for today
  const limitMin = state.settings?.dailyLimitMin ?? 0
  const timeUp = limitMin > 0 && todayMs(state.profiles[state.activeProfileId]) >= limitMin * 60000

  // One clear main button per situation, plus a small way home
  const main = timeUp ? { label: 'Zur Startseite', icon: '🏠', onClick: home }
    : stars === 0
    ? { label: 'Nochmal', icon: '🔄', onClick: () => go(level) }
    : nextLevel
      ? { label: `Weiter: Level ${nextLevel}`, play: true, onClick: () => go(nextLevel) }
      : { label: 'Zur Startseite', icon: '🏠', onClick: home }
  const secondary = timeUp ? [] : [
    stars === 0 && level > 1 && { label: `Leichter: Level ${level - 1}`, onClick: () => go(level - 1) },
    stars >= 1 && { label: 'Nochmal', icon: '🔄', onClick: () => go(level) },
  ].filter(Boolean)

  const newsChip = { display:'flex', alignItems:'center', gap:8, padding:'6px 12px', border:'3px solid var(--px-ink)', borderRadius:8,
    fontFamily:'var(--font-heading)', fontWeight:700, color:'var(--px-ink)', fontSize:16, lineHeight:1.2 }

  return (
    <div style={{
      minHeight: '100dvh',
      isolation: 'isolate',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'clamp(12px,3dvh,32px) 16px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {(stars >= 2 || newAnimals.length > 0) && <Confetti count={stars === 3 ? 60 : 28} yFrom="-5vh" yTo="110vh" />}

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
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(8px,1.8dvh,16px)', zIndex: 1, width: '100%', maxWidth: 500, padding: 'clamp(14px,2.6dvh,30px) clamp(14px,4vw,28px)' }}
      >
        <PixelLumi size="clamp(56px, 11dvh, 132px)" happy={stars >= 2} />

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
            padding: 'clamp(10px,1.8dvh,18px) 24px',
            border: '3px solid var(--px-ink)',
            boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.12)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            width: '100%',
          }}
        >
          <div style={{ display: 'flex', gap: 10 }} aria-label={`${stars} von 3 Sternen`}>
            {Array.from({ length: 3 }).map((_, idx) => (
              <motion.div
                key={idx}
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: idx < stars ? 1 : 0.7, rotate: 0 }}
                transition={{ delay: 0.5 + idx * 0.15, type: 'spring', stiffness: 400 }}
                style={{ filter: idx < stars ? 'drop-shadow(0 0 10px rgba(255,201,60,0.8))' : 'none' }}
              >
                <PxStar size="clamp(40px, 7dvh, 60px)" off={idx >= stars} />
              </motion.div>
            ))}
          </div>

          {showFraction && (
            <div style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: 18, fontWeight: 600, textAlign: 'center' }}>
              {score} von {total} gleich beim ersten Mal richtig
            </div>
          )}
          {stars === 1 && !justCompleted && (
            <div style={{ fontFamily: 'var(--font-heading)', color: '#fff', fontSize: 16, fontWeight: 600, textAlign: 'center' }}>
              Willst du noch mehr Sterne? Spiel es nochmal!
            </div>
          )}
        </motion.div>

        {/* What is new: missions, streak, the farm */}
        <motion.div
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.9 }}
          style={{ display:'flex', flexWrap:'wrap', gap:8, justifyContent:'center', width:'100%' }}
        >
          {newMissionsCompleted.map(id => missionDef(id) && (
            <div key={id} style={{ ...newsChip, background:'#d9f5c8' }}>
              <span style={{ fontSize:18 }}>✅</span> {t('mission.' + id)}
            </div>
          ))}
          {streakCount >= 2 && (
            <div style={{ ...newsChip, background:'var(--px-parch-light)' }}>
              <span style={{ fontSize:18 }}>🔥</span> {streakCount} Tage in Folge
            </div>
          )}
          {newAnimals.length > 0 ? (
            <div style={{ ...newsChip, background:'var(--px-gold)', flexWrap:'wrap', justifyContent:'center' }}>
              {newAnimals.map(a => (
                <img key={a.instanceId} src={farmAsset(a.gif)} alt={a.name} className="px-art" style={{ width:40, height:40, objectFit:'contain' }} />
              ))}
              {/* the animals by name; the farm's level name ("Wachsender Hof") read as if it were the new animal */}
              <span>Neu auf deinem Hof: {newAnimals.map(einTier).join(' und ')}!</span>
            </div>
          ) : next && farmAfter > farmBefore ? (
            <div style={{ ...newsChip, background:'var(--px-parch-light)' }}>
              <span style={{ fontSize:18 }}>🌾</span> Noch {next.missing} ⭐ bis {zumTier(next)}
            </div>
          ) : null}
        </motion.div>

        {/* Buttons — appear after short delay */}
        <div style={{ minHeight: 'clamp(112px, 16dvh, 136px)', width:'100%' }}>
          {showButtons && (
            <motion.div
              initial={{ opacity:0, y:16 }}
              animate={{ opacity:1, y:0 }}
              transition={{ type:'spring', stiffness:300, damping:22 }}
              style={{ display:'flex', flexDirection:'column', gap:10, width:'100%', alignItems:'center' }}
            >
              <button className="px-btn px-btn--green px-btn--lg" onClick={main.onClick} style={{ width:'100%', whiteSpace:'normal' }}>
                {main.play ? <PxIcon name="play" size={22} /> : main.icon} {main.label}
              </button>
              <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
                {secondary.map(b => (
                  <button key={b.label} className="px-btn px-btn--gold px-btn--md" onClick={b.onClick}>
                    {b.icon} {b.label}
                  </button>
                ))}
                {main.onClick !== home && (
                  <button className="px-btn px-btn--parch px-btn--md" onClick={home} aria-label="Startseite">
                    🏠
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
