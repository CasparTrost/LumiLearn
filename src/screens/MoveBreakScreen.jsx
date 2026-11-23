import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, todayStr } from '../AppContext.jsx'
import { HudBar, PxIcon } from '../components/PixelUI.jsx'
import Confetti from '../components/Confetti.jsx'
import { journeyArt } from '../components/JourneyPath.jsx'
import { narrate, stopNarration } from '../narrator.js'
import { sayNumber } from '../tts.js'
import { sfx } from '../sfx.js'
import { startStop } from '../lib/journeyNav.js'
import { nextStopIndex } from '../lib/learning.js'

/**
 * The movement break in the middle of the journey: Lumi and the frog show
 * three short moves, about a minute in all, the child does them along.
 *
 * Short bursts of movement between learning tasks help young children
 * concentrate afterwards (Mahar et al. 2006; Donnelly & Lambourne 2011),
 * and a calm breath at the end brings them back down before the next game.
 * Nothing is checked or scored — it is a break.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const LUMI = `${BASE}/sprites/maze/lumi_happy.png`

// kind: how the picture moves; count: spoken numbers, one per move
const MOVES = [
  { id: 'frog',   say: 'Spring wie ein Frosch! Fünfmal. Los geht\'s!', pic: 'frog', count: 5, beat: 1200 },
  { id: 'tree',   say: 'Streck dich ganz hoch, wie ein großer Baum! Die Arme nach oben, so hoch du kannst.', pic: 'stretch', hold: 6000 },
  { id: 'bird',   say: 'Flieg wie ein Vogel! Breite die Arme aus und flattere.', pic: 'fly', hold: 6000 },
  { id: 'clap',   say: 'Klatsch mit Lumi in die Hände! Sechsmal.', pic: 'clap', count: 6, beat: 900 },
  { id: 'turn',   say: 'Dreh dich einmal ganz langsam im Kreis.', pic: 'turn', hold: 5000 },
  { id: 'stamp',  say: 'Stampf wie ein Elefant! Viermal, ganz fest.', pic: 'stamp', count: 4, beat: 1100 },
]
const BREATH = { id: 'breath', say: 'Und jetzt ganz ruhig. Atme tief ein … und langsam wieder aus.', pic: 'breath', hold: 7000 }

/** Three moves for today (a different mix each day), then the calm breath. */
export function movesFor(seedText) {
  let h = 7
  for (const c of seedText) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const pool = [...MOVES]
  const out = []
  while (out.length < 2) out.push(pool.splice(h++ % pool.length, 1)[0])
  // always one jumpy move first
  if (!out.some(m => m.count)) out[0] = MOVES[0]
  return [...out, BREATH]
}

function Figure({ pic, beat }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const frog = pic === 'frog'
  const anim = reduce ? {} : {
    frog:    { y: [0, -90, 0], scaleY: [1, 1.1, 0.9, 1] },
    stretch: { scaleY: [1, 1.35, 1.35, 1], y: [0, -20, -20, 0] },
    fly:     { x: [-60, 60, -60], rotate: [-12, 12, -12] },
    clap:    { scale: [1, 1.18, 1] },
    turn:    { rotateY: [0, 360] },
    stamp:   { y: [0, -24, 6, 0], rotate: [-4, 4, -4] },
    breath:  { scale: [1, 1.25, 1] },
  }[pic]
  const dur = { frog: beat / 1000, clap: beat / 1000, stamp: beat / 1000, stretch: 3, fly: 2, turn: 4, breath: 6 }[pic] ?? 2
  return (
    <div style={{ position: 'relative', width: 'min(60vw, 280px)', height: 'min(60vw, 280px)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      {pic === 'breath' && (
        <motion.div aria-hidden="true" animate={reduce ? {} : { scale: [0.7, 1.15, 0.7], opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: '6%', borderRadius: '50%', background: 'radial-gradient(circle, #bfe9ff 0%, rgba(191,233,255,0) 70%)' }} />
      )}
      <motion.img src={frog ? journeyArt('move.png') : LUMI} alt="" draggable={false}
        animate={anim} transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
        style={{ width: '78%', height: '78%', imageRendering: 'pixelated', filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.3))', transformOrigin: '50% 100%' }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: -6, width: '50%', height: 14, borderRadius: '50%', background: 'rgba(42,27,61,0.18)' }} />
    </div>
  )
}

export default function MoveBreakScreen() {
  const { state, dispatch } = useApp()
  const profile = state.profiles[state.activeProfileId]
  const idx = state.moveStop
  const moves = useMemo(() => movesFor(todayStr() + (profile?.id ?? '')), [profile?.id])
  const [step, setStep] = useState(0)          // which move
  const [count, setCount] = useState(0)        // numbers said in this move
  const [finished, setFinished] = useState(false)
  const timers = useRef([])
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }

  useEffect(() => () => { timers.current.forEach(clearTimeout); stopNarration() }, [])

  // Each move: Lumi says it, then counts along (or waits), then the next
  useEffect(() => {
    if (finished) return
    const m = moves[step]
    if (!m) {
      setFinished(true)
      sfx.complete()
      if (typeof idx === 'number') dispatch({ type: 'JOURNEY_STOP_DONE', payload: idx })
      narrate([{ text: 'Super gemacht! Jetzt sind wir wieder fit für die Reise.' }])
      return
    }
    setCount(0)
    narrate([{ text: m.say }], { onEnd: () => {
      if (m.count) {
        for (let i = 1; i <= m.count; i++) {
          later(() => { setCount(i); sfx.pop(); narrate([{ text: sayNumber(i) }]) }, i * m.beat - m.beat / 2)
        }
        later(() => setStep(s => s + 1), m.count * m.beat + 900)
      } else {
        later(() => setStep(s => s + 1), m.hold)
      }
    } })
  }, [step, finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const home = () => { stopNarration(); dispatch({ type: 'NAVIGATE', payload: 'home' }) }
  const skip = () => {
    timers.current.forEach(clearTimeout); timers.current = []
    stopNarration()
    setStep(moves.length)
  }
  // straight on to the next stop of the journey
  const goOn = () => {
    stopNarration()
    const j = profile?.journey
    const n = nextStopIndex(j)
    if (n === -1 || !startStop(dispatch, j, n)) home()
  }

  const m = moves[step]
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #bfe9ff 0%, #e6f8d8 70%, #c7ec9f 100%)', overflow: 'hidden' }}>
      <HudBar>
        <button className="px-btn px-btn--wood px-btn--icon" onClick={home} aria-label="Zur Startseite"><PxIcon name="back" size={20} color="#fff" /></button>
        <span className="px-title" style={{ flex: 1, fontSize: 'clamp(18px,3vw,28px)' }}>Bewegungspause</span>
        {!finished && <button className="px-btn px-btn--parch px-btn--sm" onClick={skip}>Überspringen</button>}
      </HudBar>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 16, textAlign: 'center' }}>
        {finished && <Confetti count={40} yFrom="-5vh" yTo="110vh" />}
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Figure pic="clap" beat={700} />
              <div className="px-title" style={{ fontSize: 'clamp(26px,5vw,40px)' }}>Super gemacht!</div>
              <button className="px-btn px-btn--green px-btn--lg" onClick={goOn}><PxIcon name="play" size={22} /> Weiter auf der Reise</button>
            </motion.div>
          ) : m && (
            <motion.div key={m.id} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -80, opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <Figure pic={m.pic} beat={m.beat} />
              <div className="px-panel" style={{ padding: '10px 16px', maxWidth: 520, fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px,3vw,24px)', fontWeight: 700, color: 'var(--px-ink)' }}>
                {m.say}
              </div>
              {m.count && (
                <div aria-live="polite" style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: m.count }, (_, i) => (
                    <motion.span key={i} animate={{ scale: i < count ? [1.4, 1] : 1 }}
                      className={`px-pip${i < count ? ' px-pip--gold' : ''}`} style={{ width: 26, height: 26 }} />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <div aria-hidden="true" style={{ display: 'flex', gap: 6 }}>
          {moves.map((_, i) => <span key={i} className={`px-pip${i < step || finished ? ' px-pip--done' : ''}`} style={{ width: 14, height: 14 }} />)}
        </div>
      </div>
    </div>
  )
}
