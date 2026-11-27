import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, todayStr } from '../AppContext.jsx'
import { HudBar, PxIcon } from '../components/PixelUI.jsx'
import Confetti from '../components/Confetti.jsx'
import { journeyArt } from '../lib/assets.js'
import LumiFigure from '../components/LumiFigure.jsx'
import { narrate, stopNarration } from '../narrator.js'
import { sayNumber } from '../tts.js'
import { sfx } from '../sfx.js'
import { startStop } from '../lib/journeyNav.js'
import { nextStopIndex } from '../lib/learning.js'
import { line } from '../lib/lumiLines.js'
import { STICKER_BY_EMOJI } from '../lib/stickers.js'
import { Art } from '../components/play/index.js'

/**
 * The movement break, which Lumi suggests after a while of playing (results
 * screen): Lumi and the frog show three short moves, about a minute in all,
 * and the child does them along.
 *
 * Short bursts of movement between learning tasks help young children
 * concentrate afterwards (Mahar et al. 2006; Donnelly & Lambourne 2011),
 * and a calm breath at the end brings them back down before the next game.
 * Nothing is checked or scored — it is a break.
 */
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

// kind: how the picture moves; count: spoken numbers, one per move
// say: the recording (lib/lumiLines.js); its text is shown too
const MOVES = [
  { id: 'frog',   say: line('bewegung/frosch'),    pic: 'frog', count: 5, beat: 1200 },
  { id: 'tree',   say: line('bewegung/baum'),      pic: 'stretch', hold: 6000 },
  { id: 'bird',   say: line('bewegung/vogel'),     pic: 'fly', hold: 6000 },
  { id: 'clap',   say: line('bewegung/klatschen'), pic: 'clap', count: 6, beat: 900 },
  { id: 'turn',   say: line('bewegung/drehen'),    pic: 'turn', hold: 5000 },
  { id: 'stamp',  say: line('bewegung/elefant'),   pic: 'stamp', count: 4, beat: 1100 },
]
const BREATH = { id: 'breath', say: line('bewegung/atmen'), pic: 'breath', hold: 7000 }
// counting along in the recorded number words (public/audio/zahlen-entdecken)
const NUMBER_CLIP = ['', 'eins', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sieben', 'acht', 'neun', 'zehn']

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

// Lumi's picture for each move: arms up to stretch tall and to clap, one wing
// up to fly and wave, standing as usual to turn and stamp, and to breathe
// (with a gentle sway, never asleep)
export const MOVE_MOOD = { stretch: 'happy', fly: 'wave', clap: 'happy', turn: 'wave', stamp: 'idle', breath: 'idle' }

// `room`: beside the card (a phone held sideways) the figure keeps room for
// its swing on both sides, so flying it never reaches the screen's edge or
// the card (the swing, and the tilt of the wings at its ends)
function Figure({ pic, beat, box = 'min(60vw, 280px)', swing = 60, room = false }) {
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const frog = pic === 'frog'
  const anim = reduce ? {} : {
    frog:    { y: [0, -90, 0], scaleY: [1, 1.1, 0.9, 1] },
    stretch: { scaleY: [1, 1.35, 1.35, 1], y: [0, -20, -20, 0] },
    fly:     { x: [-swing, swing, -swing], rotate: [-12, 12, -12] },
    clap:    { scale: [1, 1.18, 1] },
    turn:    { rotateY: [0, 360] },
    stamp:   { y: [0, -24, 6, 0], rotate: [-4, 4, -4] },
    breath:  { scale: [1, 1.12, 1], rotate: [0, -3, 0, 3, 0] },
  }[pic]
  const dur = { frog: beat / 1000, clap: beat / 1000, stamp: beat / 1000, stretch: 3, fly: 2, turn: 4, breath: 6 }[pic] ?? 2
  return (
    <div style={{ position: 'relative', width: box, height: box, flexShrink: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginInline: room ? `calc(${swing + 10}px + ${box} * 0.06)` : undefined }}>
      {pic === 'breath' && (
        <motion.div aria-hidden="true" animate={reduce ? {} : { scale: [0.7, 1.15, 0.7], opacity: [0.35, 0.7, 0.35] }} transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: '6%', borderRadius: '50%', background: 'radial-gradient(circle, #bfe9ff 0%, rgba(191,233,255,0) 70%)' }} />
      )}
      {frog ? (
        <motion.img src={journeyArt('move.png')} alt="" draggable={false}
          animate={anim} transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '78%', height: '78%', imageRendering: 'pixelated', filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.3))', transformOrigin: '50% 100%' }} />
      ) : (
        // Lumi does the moves along, in what the child chose in the wardrobe
        <motion.div animate={anim} transition={{ duration: dur, repeat: Infinity, ease: 'easeInOut' }}
          style={{ width: '78%', height: '78%', filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.3))', transformOrigin: '50% 100%' }}>
          <LumiFigure mood={MOVE_MOOD[pic] ?? 'happy'} size="100%" style={{ display: 'block', height: '100%' }} />
        </motion.div>
      )}
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
  // the break was the last of today's ideas: the sticker comes out here
  const [hadSticker] = useState(() => !!profile?.journey?.chest)
  const sticker = !hadSticker && finished ? profile?.journey?.chest : null
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
      // the last of today's ideas: the sticker is in the album now
      dispatch({ type: 'OPEN_CHEST' })
      narrate([line('bewegung/fertig')])
      return
    }
    setCount(0)
    narrate([m.say], { onEnd: () => {
      if (m.count) {
        for (let i = 1; i <= m.count; i++) {
          later(() => { setCount(i); sfx.pop(); narrate([{ src: `audio/zahlen-entdecken/${NUMBER_CLIP[i]}.mp3`, text: sayNumber(i) }]) }, i * m.beat - m.beat / 2)
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
  // straight on to Lumi's next idea
  const goOn = () => {
    stopNarration()
    const j = profile?.journey
    const n = nextStopIndex(j)
    if (n === -1 || !startStop(dispatch, j, n)) home()
  }

  const m = moves[step]
  // A phone held sideways: Lumi beside the card (above it, the card was
  // below the edge of the screen)
  const sideways = typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerHeight < 500
  const narrow = typeof window !== 'undefined' && window.innerWidth < 420
  const row = sideways ? { flexDirection: 'row', gap: 20 } : { flexDirection: 'column', gap: 16 }
  const box = sideways ? 'min(40vw, 62vh, 280px)' : undefined
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'linear-gradient(180deg, #bfe9ff 0%, #e6f8d8 70%, #c7ec9f 100%)', overflow: 'hidden' }}>
      <HudBar>
        <button className="px-btn px-btn--wood px-btn--icon" onClick={home} aria-label="Zur Startseite" style={{ flexShrink: 0 }}><PxIcon name="back" size={20} color="#fff" /></button>
        <span className="px-title" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 'clamp(18px,3vw,28px)' }}>Bewegungspause</span>
        {/* a narrow phone: the skip arrows alone (the word did not fit beside the title) */}
        {!finished && <button className="px-btn px-btn--parch px-btn--sm" onClick={skip} aria-label="Überspringen" title="Überspringen"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}><PxIcon name="skip" size={16} />{!narrow && ' Überspringen'}</button>}
      </HudBar>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: sideways ? 8 : 18, padding: sideways ? '8px 16px' : 16, textAlign: 'center' }}>
        {finished && <Confetti count={40} yFrom="-5vh" yTo="110vh" />}
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div key="done" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ display: 'flex', ...row, alignItems: 'center' }}>
              <Figure pic="clap" beat={700} box={box} swing={sideways ? 22 : 60} room={sideways} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="px-title" style={{ fontSize: 'clamp(26px,5vw,40px)' }}>Super gemacht!</div>
              {sticker && STICKER_BY_EMOJI[sticker] && (
                <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ delay: 0.5, type: 'spring', stiffness: 260, damping: 12 }}
                  aria-label={`Neuer Sticker: ${STICKER_BY_EMOJI[sticker].name}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 14, background: '#fff3c4', border: '3px solid var(--px-ink)' }}>
                  <img src={journeyArt('chest-open.png')} alt="" style={{ width: 56, height: 56, imageRendering: 'pixelated' }} />
                  <Art art={sticker} size={56} />
                </motion.div>
              )}
              <button className="px-btn px-btn--green px-btn--lg" onClick={goOn}><PxIcon name="play" size={22} /> Weiter spielen</button>
              </div>
            </motion.div>
          ) : m && (
            <motion.div key={m.id} initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -80, opacity: 0 }}
              style={{ display: 'flex', ...row, alignItems: 'center' }}>
              <Figure pic={m.pic} beat={m.beat} box={box} swing={sideways ? 22 : 60} room={sideways} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="px-panel" style={{ padding: '10px 16px', maxWidth: 520, fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px,3vw,24px)', fontWeight: 700, color: 'var(--px-ink)' }}>
                {m.say.text}
              </div>
              {m.count && (
                <div aria-live="polite" style={{ display: 'flex', gap: 8 }}>
                  {Array.from({ length: m.count }, (_, i) => (
                    <motion.span key={i} animate={{ scale: i < count ? [1.4, 1] : 1 }}
                      className={`px-pip${i < count ? ' px-pip--gold' : ''}`} style={{ width: 26, height: 26 }} />
                  ))}
                </div>
              )}
              </div>
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
