import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, narrate, afterNarration, leaveGame } from '../narrator.js'
import { feelingWord } from '../lib/words.js'
import { LINES, line } from '../lib/lumiLines.js'
import { sayRight, sayWrong, announce } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, useMood, RoundTrail, useBursts, HintHand, useIdle } from '../components/play/index.js'
import { INK } from './px.js'
import { Friend, SignFace, CAST, FRIEND_RATIO, slug } from './gefuehle/faces.jsx'
import { levelConfig, pickRounds, step, allDown, shuffle, GRIDS } from './gefuehle/rounds.js'
import { useLater, useSize, pointIn } from './gefuehle/hooks.js'

/**
 * Gefühlswelt — "Gefühle-Haus": reading feelings from faces, and the words
 * for them
 *
 * A house full of animals. Lumi stands beside it and holds up a sign with
 * one face, and says the feeling ("Traurig."). Animals pop up at the
 * windows, each with a feeling on its face; the child taps everyone who
 * feels like the sign. That is the whole rule.
 *
 *   • A right tap: the animal cheers, leaps out of its window to the sign
 *     and turns into a star on the meter under it. A full meter (four to
 *     six stars) ends the round.
 *   • A wrong tap: the animal shakes its head, Lumi says "Hm, noch nicht."
 *     and then, while the sign nods, the feeling on the sign once more. Only
 *     that one feeling is named: two bare words in a row ("Wütend."
 *     "Traurig.") left a child guessing which was meant. The animal stays
 *     at its window; the round just no longer counts as "first try".
 *   • The animals stay a while, duck down, and others come up (about five
 *     seconds at level 1, two at level 10). A right face is always on
 *     screen (gefuehle/rounds.js), so a child never waits.
 *   • After two misses in a round the right ones bounce.
 *   • The third right tap in a row within a round lights the house up and
 *     the cat on the roof dances (without a sound: it used to meow at every
 *     tap of a faultless level); at the end of a level everyone leans out
 *     and waves.
 *
 * It is about reading an expression, not about finding the same picture
 * twice: the sign shows a plain round face, the windows show ten different
 * animals, and from level 2 every feeling comes with two faces (other eyes,
 * another mouth). In levels 9 and 10 the sign turns away after two seconds,
 * and the child goes by the word (a tap on the sign says it again and shows
 * the face for a moment).
 *
 * Why this: naming feelings and recognising them in faces is the first
 * step of emotional literacy (the R and L of the RULER approach, Brackett &
 * Rivers 2014; PATHS, Domitrovich et al. 2007). Seeing one feeling on many
 * different faces, next to faces that look similar, is what makes the
 * category stick rather than one picture of it.
 */

const TICK = 100
const SIGN_MS = 2000       // levels 9 and 10: how long the sign shows its face
const PAD = 8
const TRAIL = 30
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
// Lines Lumi may get later; silent until they are recorded:
// "Wer schaut so?" before the first word of a level, and "Hör genau hin."
// in the levels where the sign turns away.
const optional = key => (LINES[key] ? line(key) : null)
const SAY_START = 'gefuehlswelt/wer-schaut-so'
const SAY_LISTEN = 'gefuehlswelt/hoer-genau-hin'

const CURTAINS = ['#ff8fb8', '#6fb7ff', '#ffcf4a', '#7ed492', '#b79cf5', '#ff9f6b']

// The house for a number of windows in the room it has: of the grids that
// fit, the one that shows the biggest faces.
const FRAME = 23           // what a window's frame takes from its cell
const MAX_CELL = 260
function houseFit(w, h, n) {
  const roofH = clamp(h * 0.12, 44, 92)
  const cat = clamp(roofH * 1.1, 50, 76)
  const catUp = cat * 0.6  // how far the cat looks out over the roof
  const over = 8, wp = 7
  const roomW = w - over * 2 - wp * 2, roomH = h - roofH - catUp - 4 - wp * 2
  const fit = GRIDS[n].map(([c, r]) => {
    const ch = Math.min(roomH / r, Math.min(roomW / c, MAX_CELL) * 1.15)
    const cw = Math.min(roomW / c, MAX_CELL, ch * 1.05)
    const friend = Math.min((cw - FRAME) * 0.96, (ch - FRAME) / FRIEND_RATIO * 1.03)
    return { c, r, cw, ch, friend }
  }).sort((a, b) => b.friend - a.friend)[0]
  const wallW = fit.c * fit.cw + wp * 2, wallH = fit.r * fit.ch + wp * 2
  return { ...fit, roofH, cat, catUp, over, wp, wallW, wallH, roofW: wallW + over * 2, height: catUp + roofH + wallH }
}

// Where Lumi with the sign and the house stand: side by side on a screen
// held sideways, the sign above the house on one held upright. The house
// takes the room its windows need; what is left goes to Lumi and the sign.
function layout(W, H, n) {
  const wide = W > H * 1.15
  const top = PAD + TRAIL * 1.35 + 4
  const aw = W - PAD * 2, ah = H - top - PAD
  if (wide) {
    const hw = clamp(aw * 0.27, 200, 310)
    const fit = houseFit(aw - hw - 8, ah, n)
    // both together in the middle of the screen
    const left = PAD + Math.max(0, (aw - hw - 8 - fit.roofW) / 2)
    return { wide, fit, host: { left, top, width: hw, height: ah }, house: { left: left + hw + 8, top, width: fit.roofW, height: ah } }
  }
  const hh = clamp(ah * 0.22, 118, 170)
  const fit = houseFit(aw, ah - hh - 12, n)
  const more = Math.min(70, Math.max(0, ah - hh - 12 - fit.height - 4))
  return { wide, fit, host: { left: PAD, top, width: aw, height: hh + more }, house: { left: PAD, top: top + hh + more + 12, width: aw, height: ah - hh - more - 12 } }
}

export default function EmotionGame({ level = 1, onComplete }) {
  const cfg = useMemo(() => levelConfig(level), [level])
  const rounds = useMemo(() => pickRounds(cfg), [cfg])
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const reduce = useReducedMotion()
  const { later, afterSpeech } = useLater()
  const [bursts, burst] = useBursts()
  const [lumi, setLumi] = useMood()
  const [catDance, setCatDance] = useState({ n: 0, long: false }) // the roof cat's dance: silent, see House

  const [roundIdx, setRoundIdx] = useState(0)
  const [phase, setPhase] = useState('ready')     // ready | play | won | finale
  const [slots, setSlots] = useState(() => Array(cfg.windows).fill(null))
  const [stars, setStars] = useState(0)           // landed on the meter
  const [misses, setMisses] = useState(0)         // in this round
  const [faceUp, setFaceUp] = useState(true)      // the sign shows its face
  const [pulse, setPulse] = useState(0)           // the sign calls for a look
  const [lit, setLit] = useState(0)               // the house is lit up (a streak)
  const [flyers, setFlyers] = useState([])        // caught animals on their way to the meter
  const [done, setDone] = useState(0)             // rounds finished

  // What the clock and the taps work on; the state above is its picture
  const g = useRef({ now: 0, slots: [], mem: {}, caught: 0, misses: 0, streak: 0, clean: 0, faceUntil: 0, faceUp: true }).current
  const target = phase === 'finale' ? 'Glücklich' : rounds[roundIdx]

  const rootRef = useRef(null)
  const houseRef = useRef(null)
  const signRef = useRef(null)
  const meterRef = useRef([])
  const hintRef = useRef(null)
  const hintId = useRef(null)
  const size = useSize(rootRef)

  useEffect(() => leaveGame, [])

  const show = next => { g.slots = next; setSlots(next) }
  const sayTarget = () => narrate([feelingWord(target)])

  // A new round: the sign turns to the next face, Lumi says the word, and
  // the first animal to pop up is one that feels like it.
  useEffect(() => {
    g.round = roundIdx
    g.streak = 0
    g.caught = 0
    g.misses = 0
    g.mem = {}
    g.faceUp = true
    setStars(0)
    setMisses(0)
    setFaceUp(true)
    setFlyers([])
    show(Array(cfg.windows).fill(null))
    setPhase('ready')
    lockPreviews()
    // after any praise still being spoken, not over it
    // (the sign of levels 9 and 10 turns away only once the word was said)
    g.faceUntil = Infinity
    const stop = afterNarration(() => narrate([roundIdx === 0 ? optional(cfg.hideFace ? SAY_LISTEN : SAY_START) : null, feelingWord(rounds[roundIdx])],
      { onEnd: () => { g.faceUntil = g.now + SIGN_MS } }))
    later(reduce ? 300 : 800, () => setPhase('play'))
    return stop
  }, [roundIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // The house's clock: who ducks, who comes up. It stands still while the
  // help is open.
  useEffect(() => {
    if (phase !== 'play' && phase !== 'won') return
    const iv = setInterval(() => {
      if (pausedRef.current) return
      g.now += TICK
      const next = step(g.slots, g.mem, { now: g.now, target, cfg, spawn: phase === 'play' })
      if (next !== g.slots) show(next)
      if (g.mem.born) sfx.flip()
      // levels 9 and 10: the sign turns away, the word has to do
      if (cfg.hideFace && phase === 'play' && g.faceUp && g.misses < 2 && g.now >= g.faceUntil) { g.faceUp = false; setFaceUp(false) }
    }, TICK)
    return () => clearInterval(iv)
  }, [phase, target, cfg]) // eslint-disable-line react-hooks/exhaustive-deps

  // The hand points at one animal that feels like the sign, and only as
  // long as that animal is at its window: it keeps to the one it chose, and
  // when that one ducks or is caught the hand is gone in the same moment and
  // a new one comes at the next right animal (the one that stays longest).
  // The hand never slides across the house and never rests on a window
  // whose animal has changed.
  const rightUp = phase === 'play' ? slots.filter(c => c?.state === 'up' && c.feeling === target) : []
  const hinted = rightUp.find(c => c.id === hintId.current) ?? rightUp.reduce((a, c) => (!a || c.until > a.until ? c : a), null)
  useLayoutEffect(() => {
    hintId.current = hinted?.id ?? null
    hintRef.current = hinted ? rootRef.current?.querySelector('[data-hint="1"]') ?? null : null
  })

  const lightUp = ms => { setLit(n => n + 1); later(ms, () => setLit(n => Math.max(0, n - 1))) }

  const finale = () => {
    const animals = shuffle(CAST.map((_, i) => i))
    setPhase('finale')
    setFaceUp(true)
    show(Array.from({ length: cfg.windows }, (_, i) => ({
      // the sign shows "Glücklich" now, so that is what every face shows
      id: `party-${i}`, animal: animals[i % animals.length], feeling: 'Glücklich', variant: i % 2, state: 'up', wave: true,
    })))
    lightUp(4200)
    sfx.tada()
    setLumi('dance', 3800)
    setCatDance(d => ({ n: d.n + 1, long: true }))
    later(250, () => burst(houseRef.current, 'confetti', 26))
    later(1200, () => { sfx.sparkle(); burst(houseRef.current, 'stars', 14) })
    later(2200, () => burst(signRef.current, 'confetti', 20))
    later(3800, () => onComplete(result(g.clean, rounds.length)))
  }

  const win = () => {
    const last = roundIdx + 1 >= rounds.length
    if (g.misses === 0) g.clean += 1
    setPhase('won')
    show(allDown(g.slots, g.now))
    later(reduce ? 100 : 750, () => {
      sfx.tada()
      setLumi('dance', 1600)
      setDone(roundIdx + 1)
      burst(signRef.current, 'stars', 12)
    })
    sayRight()
    afterSpeech(() => (last ? finale() : setRoundIdx(r => r + 1)), 2300)
  }

  const tapWindow = (i, el) => {
    const c = g.slots[i]
    if (pausedRef.current || !c || c.state === 'out') return
    if (phase === 'finale') { sfx.giggle(); burst(el, 'hearts', 6); return }
    if (phase !== 'play') return
    // a right one that is just ducking away still counts: the finger was on its way
    if (c.state === 'down' && c.feeling !== target) return
    // (a tap cuts Lumi's word short: the sign's two seconds start now)
    if (g.faceUntil === Infinity) g.faceUntil = g.now + SIGN_MS

    if (c.feeling === target) {
      g.caught += 1
      g.streak += 1
      const n = g.caught
      show(g.slots.map((x, k) => (k === i ? { ...c, state: 'out', gone: g.now + 300 } : x)))
      sfx.pop()
      announce('right')
      burst(el, 'stars', 6)
      // it leaps out of the window to the meter, where it becomes a star
      const from = pointIn(rootRef.current, el), to = pointIn(rootRef.current, meterRef.current[n - 1] ?? signRef.current)
      setFlyers(f => [...f, { id: c.id, animal: c.animal, from, to, n }])
      if (g.streak === 3) {
        // three in a row in this round: the lights go on, the cat dances.
        // Once, when the third is reached, and counted anew in every round:
        // counted on and on, the house never went dark again in a faultless
        // level and the cat meowed at every tap.
        sfx.combo(g.streak)
        lightUp(1800)
        setCatDance(d => ({ n: d.n + 1, long: false }))
        burst(el, 'confetti', 14)
      }
      if (n >= cfg.need) win()
      else setLumi('happy', 900)
      return
    }

    // Not this one: it shakes its head, Lumi says "noch nicht" (once it is
    // through, never cut off), and then the sign nods and Lumi says again
    // whom we are looking for.
    g.misses += 1
    g.streak = 0
    setMisses(g.misses)
    show(g.slots.map((x, k) => (k === i ? { ...c, until: Math.max(c.until, g.now + 1800), shake: (c.shake ?? 0) + 1 } : x)))
    sfx.boing()
    setLumi('oops', 900)
    const round = roundIdx
    sayWrong(null, { onEnd: () => later(250, () => {
      if (g.round !== round || g.caught >= cfg.need) return
      setPulse(p => p + 1)
      narrate([feelingWord(target)])
    }) })
    // the word alone was not enough: the face comes back and stays
    if (cfg.hideFace && g.misses >= 2) { g.faceUp = true; setFaceUp(true) }
  }

  const tapSign = () => {
    if (phase !== 'play' && phase !== 'ready') return
    sayTarget()
    setPulse(p => p + 1)
    if (cfg.hideFace) { g.faceUp = true; g.faceUntil = g.now + SIGN_MS; setFaceUp(true) }
  }

  const landed = f => {
    setFlyers(l => l.filter(x => x.id !== f.id))
    setStars(s => Math.max(s, f.n))
    sfx.coin()
  }

  const L = size && layout(size.w, size.h, cfg.windows)
  const helping = misses >= 2 && phase === 'play'
  // the very first round shows the move soon; later the hand waits longer.
  // The game counts the quiet time itself, because the hand below is a new
  // one for every animal it points at.
  const hintDelay = roundIdx === 0 && level <= 2 ? 2600 : 7000
  const waiting = useIdle(hintDelay, phase === 'play')

  return (
    <div ref={rootRef} className="gf-root" data-phase={phase} data-target={target} data-round={roundIdx}
      style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {L && (
        <>
          <div style={{ position: 'absolute', left: PAD, right: PAD, top: PAD }}>
            <RoundTrail total={rounds.length} done={done} walker="lumi" goal="🎉" size={TRAIL} />
          </div>
          <Host box={L.host} wide={L.wide} cfg={cfg} target={target} faceUp={faceUp} pulse={pulse} roundIdx={roundIdx}
            stars={phase === 'finale' ? cfg.need : stars} lumi={lumi} signRef={signRef} meterRef={meterRef} onSign={tapSign} reduce={reduce} />
          <House box={L.house} fit={L.fit} cfg={cfg} slots={slots} target={target} phase={phase} lit={lit > 0} helping={helping}
            hinted={hinted?.id} catDance={catDance} houseRef={houseRef} onTap={tapWindow} reduce={reduce} />

          {flyers.map(f => {
            const w = Math.min(120, f.from.w * 0.8), h = w * FRIEND_RATIO
            const x0 = f.from.x - w / 2, y0 = f.from.y - h / 2, x1 = f.to.x - w / 2, y1 = f.to.y - h / 2
            return (
              <motion.div key={f.id} aria-hidden="true"
                initial={{ x: x0, y: y0, scale: 1, rotate: 0 }}
                animate={{ x: [x0, x0, (x0 + x1) / 2, x1], y: [y0, y0 - 26, Math.min(y0, y1) - 50, y1], scale: [1, 1.2, 0.9, 0.3], rotate: [0, -8, 180, 360] }}
                transition={{ duration: reduce ? 0.01 : 0.85, times: [0, 0.22, 0.6, 1], ease: 'easeInOut' }}
                onAnimationComplete={() => landed(f)}
                style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none' }}>
                <Friend animal={f.animal} feeling="Glücklich" size={w} paws={false} still />
              </motion.div>
            )
          })}
        </>
      )}
      <HintHand key={`${roundIdx}-${hinted?.id ?? 'none'}`} to={hintRef} active={phase === 'play' && waiting && !!hinted} delay={0} />
      {bursts}
    </div>
  )
}

// ── Lumi, the sign and the meter ──────────────────────────────────────────

function Host({ box, wide, cfg, target, faceUp, pulse, roundIdx, stars, lumi, signRef, meterRef, onSign, reduce }) {
  const { width: w, height: h } = box
  const need = cfg.need
  // wide: the sign on its pole, the meter under it, Lumi at its foot.
  // upright: Lumi, the sign and the meter in a row.
  const cols = wide ? need : 2
  const rows = Math.ceil(need / cols)
  const board = wide ? Math.min(w - 16, h * 0.46, 250) : Math.min(h - 6, 210, w * 0.42)
  const star = wide ? clamp((board - 14) / need - 4, 26, 44) : clamp((h - 16) / rows - 4, 30, 46)
  const meterW = cols * (star + 4) + 12, meterH = rows * (star + 4) + 12
  const lumiSize = wide ? clamp(Math.min(w * 0.6, h - board - meterH - 26), 70, 170) : clamp(Math.min(h * 0.74, w - board - meterW - 22), 64, 130)

  const meter = (
    <div role="img" aria-label={`${stars} von ${need} Sternen`} data-stars={stars}
      style={{ width: meterW, height: meterH, padding: 4, display: 'grid', gridTemplateColumns: `repeat(${cols}, ${star + 4}px)`, placeContent: 'center',
        background: '#e3a462', border: `3px solid ${INK}`, borderRadius: 12, boxShadow: 'inset 0 -4px 0 rgba(0,0,0,0.14), 0 4px 0 rgba(42,27,61,0.3)', flexShrink: 0 }}>
      {Array.from({ length: need }, (_, i) => (
        <div key={i} ref={el => { meterRef.current[i] = el }} style={{ position: 'relative', width: star + 4, height: star + 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 24 24" width={star} height={star} aria-hidden="true" style={{ position: 'absolute' }}>
            <path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="rgba(42,27,61,0.16)" stroke="rgba(42,27,61,0.4)" strokeWidth="1.4" strokeDasharray="2.5 2" strokeLinejoin="round" />
          </svg>
          <AnimatePresence>
            {i < stars && (
              <motion.div key="star" initial={reduce ? false : { scale: 0, rotate: -120 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 14 }} style={{ position: 'relative', display: 'flex' }}>
                <Art art="⭐" size={star} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  )

  const sign = (
    <motion.button type="button" ref={signRef} onClick={onSign} whileTap={{ scale: 0.94 }}
      aria-label={`${target}. Noch einmal hören`} data-face={faceUp ? 1 : 0}
      style={{ all: 'unset', boxSizing: 'border-box', position: 'relative', zIndex: 2, width: board, height: board, flexShrink: 0, cursor: 'pointer', padding: board * 0.05,
        background: '#c98a52', border: `4px solid ${INK}`, borderRadius: board * 0.12,
        boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.3), inset 0 -6px 0 rgba(0,0,0,0.16), 0 6px 0 rgba(42,27,61,0.35)' }}>
      <motion.div key={pulse} initial={pulse && !reduce ? { scale: 1.12 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 10 }}
        style={{ width: '100%', height: '100%', background: '#fff8e6', border: `3px solid ${INK}`, borderRadius: board * 0.08, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait" initial={false}>
          {faceUp ? (
            <motion.div key={`face-${roundIdx}-${target}`} initial={reduce ? false : { rotateY: 90, scale: 0.8 }} animate={{ rotateY: 0, scale: 1 }} exit={reduce ? undefined : { rotateY: -90 }}
              transition={{ duration: 0.22 }}>
              <SignFace feeling={target} size={board * 0.8} />
            </motion.div>
          ) : (
            // "listen": Lumi says it, the face is turned away
            <motion.div key="listen" initial={reduce ? false : { rotateY: 90 }} animate={{ rotateY: 0 }} exit={reduce ? undefined : { rotateY: -90 }} transition={{ duration: 0.22 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Art art="lumi" mood="happy" size={board * 0.58} />
              <svg viewBox="0 0 40 60" width={board * 0.24} height={board * 0.36} aria-hidden="true">
                {[8, 18, 28].map((r, k) => (
                  <path key={r} className="gf-sound" style={{ animationDelay: `${k * 0.18}s` }} d={`M4 ${30 - r} A${r} ${r} 0 0 1 4 ${30 + r}`}
                    fill="none" stroke="#6b3fd6" strokeWidth="5" strokeLinecap="round" />
                ))}
              </svg>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.button>
  )

  const chick = <Critter art="lumi" size={lumiSize} mood={lumi} talks shadow={wide} />

  if (!wide) {
    return (
      <div style={{ position: 'absolute', ...box, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <div style={{ alignSelf: 'flex-end', marginRight: -4 }}>{chick}</div>
        {sign}
        {meter}
      </div>
    )
  }
  return (
    <div style={{ position: 'absolute', ...box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      {sign}
      <div style={{ marginTop: 6, position: 'relative', zIndex: 2 }}>{meter}</div>
      {/* the pole, and Lumi holding it */}
      <div style={{ position: 'relative', width: '100%', height: lumiSize + 4, flexShrink: 0 }}>
        <div aria-hidden="true" style={{ position: 'absolute', left: '50%', marginLeft: lumiSize * 0.2, top: -meterH - 12, bottom: 0, width: 14, background: '#a8683a', border: `3px solid ${INK}`, borderRadius: 6 }} />
        <div style={{ position: 'absolute', left: '50%', marginLeft: -lumiSize * 0.72, bottom: 0 }}>{chick}</div>
      </div>
    </div>
  )
}

// ── The house ─────────────────────────────────────────────────────────────

function House({ box, fit: f, cfg, slots, target, phase, lit, helping, hinted, catDance, houseRef, onTap, reduce }) {
  const n = cfg.windows
  const roofW = f.roofW
  // a house with ten places and nine windows has a door in the middle downstairs
  const places = f.c * f.r
  const door = places > n ? f.c * (f.r - 1) + Math.floor(f.c / 2) : -1
  let k = 0
  const cells = Array.from({ length: places }, (_, p) => (p === door ? -1 : k++))
  const ridge = f.c <= 3 ? roofW * 0.2 : roofW * 0.56
  const rl = (roofW - ridge) / 2, rr = rl + ridge
  const lamps = Math.max(5, Math.round(roofW / 46))

  return (
    <div style={{ position: 'absolute', ...box, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }}>
      <div ref={houseRef} className={lit ? 'gf-lit' : undefined} data-lit={lit ? 1 : 0} style={{ position: 'relative', width: roofW, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* the cat on the roof */}
        {/* It dances here, by itself, and not through a happy mood: a happy
            Critter makes its animal sound, and a meow on top of Lumi's words
            is one voice too many. It can be tapped only at the end party: in a
            round a child looking for "every animal that is glad" tapped the
            cat too, and it meowed back like an answer. */}
        <motion.div key={catDance.n} style={{ position: 'absolute', left: rl + ridge * 0.5 - f.cat * (f.c <= 3 ? 0.5 : 1.6), top: -f.catUp, zIndex: 3, transformOrigin: '50% 100%',
          pointerEvents: phase === 'finale' ? undefined : 'none' }}
          animate={catDance.n && !reduce ? { rotate: [0, -12, 12, -12, 12, 0], y: [0, -f.cat * 0.14, 0, -f.cat * 0.14, 0, 0] } : {}}
          transition={{ duration: 0.8, repeat: catDance.long ? 3 : 1 }}>
          <Critter art="🐱" size={f.cat} label={phase === 'finale' ? 'Katze auf dem Dach' : undefined} shadow={false} />
        </motion.div>
        <svg width={roofW} height={f.roofH} viewBox={`0 0 ${roofW} ${f.roofH}`} aria-hidden="true" style={{ display: 'block', overflow: 'visible', position: 'relative', zIndex: 2, marginBottom: -4 }}>
          <defs>
            <pattern id="gf-tiles" width="26" height="16" patternUnits="userSpaceOnUse">
              <rect width="26" height="16" fill="#e8594c" />
              <path d="M0 0 Q13 14 26 0 M-13 8 Q0 22 13 8 M13 8 Q26 22 39 8" fill="none" stroke="#b93a33" strokeWidth="2.2" />
            </pattern>
          </defs>
          {/* chimney and its smoke */}
          <g>
            {!reduce && [0, 1.1, 2.2].map(d => <circle key={d} className="gf-smoke" style={{ animationDelay: `${d}s` }} cx={rr + 4} cy={-10} r="9" fill="#fff" opacity="0" />)}
            <rect x={rr - 8} y={-8} width="26" height={f.roofH * 0.7} fill="#c9705a" stroke={INK} strokeWidth="3.5" />
            <rect x={rr - 12} y={-14} width="34" height="10" rx="3" fill="#a85443" stroke={INK} strokeWidth="3.5" />
          </g>
          <path d={`M2 ${f.roofH - 2} L${rl} 4 L${rr} 4 L${roofW - 2} ${f.roofH - 2} Z`} fill="url(#gf-tiles)" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d={`M2 ${f.roofH - 2} L${roofW - 2} ${f.roofH - 2}`} stroke={INK} strokeWidth="6" strokeLinecap="round" />
          {/* a string of lamps along the eaves: they blink when the house lights up */}
          {Array.from({ length: lamps }, (_, i) => (
            <circle key={i} className="gf-lamp" style={{ animationDelay: `${(i % 2) * 0.25}s` }} cx={18 + (i * (roofW - 36)) / (lamps - 1)} cy={f.roofH + 5} r="6"
              fill={['#ffcf4a', '#ff7b8c', '#6fc7ff', '#8fe08a'][i % 4]} stroke={INK} strokeWidth="2.4" />
          ))}
        </svg>
        <div style={{ width: f.wallW, height: f.wallH, padding: f.wp, display: 'grid', gridTemplateColumns: `repeat(${f.c}, ${f.cw}px)`, gridAutoRows: f.ch,
          background: lit ? '#fff5cf' : '#ffe6bd', border: `4px solid ${INK}`, borderRadius: '0 0 10px 10px', transition: 'background .3s, box-shadow .3s',
          boxShadow: lit ? '0 0 34px 10px rgba(255,214,90,0.85), inset 0 -8px 0 rgba(203,138,82,0.5)' : 'inset 0 -8px 0 rgba(203,138,82,0.5), 0 5px 0 rgba(42,27,61,0.25)' }}>
          {cells.map((i, p) => (i < 0
            ? <Door key="door" w={f.cw} h={f.ch} />
            : <Window key={i} i={i} c={slots[i]} w={f.cw} h={f.ch} target={target} phase={phase} lit={lit} helping={helping} onTap={onTap} reduce={reduce}
                hint={slots[i] != null && slots[i].id === hinted}
                party={phase === 'finale'} delay={phase === 'finale' ? p * 0.07 : 0} z={places - p} />
          ))}
        </div>
      </div>
    </div>
  )
}

function Door({ w, h }) {
  const dw = Math.min(w * 0.56, h * 0.5)
  return (
    <div style={{ width: w, height: h, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
      <motion.button type="button" aria-label="Tür" whileTap={{ scale: 0.95 }} onClick={() => sfx.drum()}
        style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'relative', width: dw, height: Math.max(64, h * 0.82), marginBottom: -7,
          background: '#b3723f', border: `4px solid ${INK}`, borderBottom: 'none', borderRadius: `${dw / 2}px ${dw / 2}px 0 0`, boxShadow: 'inset 0 6px 0 rgba(255,255,255,0.22), inset -6px 0 0 rgba(0,0,0,0.12)' }}>
        <span aria-hidden="true" style={{ position: 'absolute', right: '16%', top: '56%', width: 12, height: 12, borderRadius: '50%', background: '#ffcf4a', border: `3px solid ${INK}` }} />
        <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '18%', width: dw * 0.36, height: dw * 0.36, marginLeft: -dw * 0.18, borderRadius: '50%', background: '#ffe9a8', border: `3px solid ${INK}` }} />
      </motion.button>
    </div>
  )
}

/** One window: curtains that open when someone pops up, and the someone. */
function Window({ i, c, w, h, target, phase, lit, helping, hint, onTap, reduce, party, delay, z }) {
  const ref = useRef(null)
  const up = c?.state === 'up'
  const open = !!c && c.state !== 'down'
  const right = up && phase === 'play' && c.feeling === target
  const live = up || (c?.state === 'down' && phase === 'play' && c.feeling === target)
  const size = Math.min((w - FRAME) * 0.96, (h - FRAME) / FRIEND_RATIO * 1.03)
  const tint = CURTAINS[i % CURTAINS.length]
  const curtain = side => (
    <motion.div aria-hidden="true" initial={false} animate={{ scaleX: open ? 0.16 : 1 }}
      transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 22 }}
      style={{ position: 'absolute', top: 0, bottom: 0, [side]: 0, width: '52%', transformOrigin: `${side === 'left' ? 0 : 100}% 50%`, zIndex: party ? 1 : 3,
        background: `repeating-linear-gradient(90deg, ${tint} 0 9px, rgba(0,0,0,0.14) 9px 11px), ${tint}`,
        [side === 'left' ? 'borderRight' : 'borderLeft']: `3px solid ${INK}` }} />
  )
  return (
    <div style={{ width: w, height: h, padding: 3, position: 'relative', zIndex: party ? z : undefined }}>
      <motion.button type="button" ref={ref} whileTap={up ? { scale: 0.93 } : undefined}
        onClick={() => onTap(i, ref.current)} disabled={!live} tabIndex={up ? 0 : -1}
        aria-label={up ? `${CAST[c.animal].name}, ${c.feeling}` : 'Leeres Fenster'}
        data-window={i} data-feel={up ? slug(c.feeling) : undefined} data-right={right ? 1 : undefined} data-hint={right && hint ? 1 : undefined}
        style={{ all: 'unset', boxSizing: 'border-box', display: 'block', position: 'relative', width: '100%', height: '100%', cursor: up ? 'pointer' : 'default',
          padding: 3, background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 13,
          // without motion the help after two misses is a golden frame instead of a bounce
          boxShadow: helping && right && reduce ? '0 0 0 5px #ffc93c, 0 3px 0 rgba(42,27,61,0.28)' : '0 3px 0 rgba(42,27,61,0.28)' }}>
        <div style={{ position: 'relative', width: '100%', height: '100%', overflow: party ? 'visible' : 'hidden', borderRadius: 8, border: `2.5px solid ${INK}`,
          background: lit ? '#ffdf7a' : '#51467f', transition: 'background .3s' }}>
          <AnimatePresence>
            {c && c.state !== 'out' && (
              <motion.div key={c.id}
                initial={reduce ? { opacity: 0 } : party ? { scale: 0 } : { y: '105%' }}
                animate={reduce ? { opacity: up ? 1 : 0 } : party ? { scale: 1.1 } : { y: up ? '0%' : '105%' }}
                exit={{ opacity: 0, transition: { duration: 0.05 } }}
                transition={reduce ? { duration: 0.15 } : up ? { type: 'spring', stiffness: 420, damping: 19, delay } : { duration: 0.28, ease: 'easeIn' }}
                style={{ position: 'absolute', left: '50%', top: 1, marginLeft: -size / 2, zIndex: 2, transformOrigin: '50% 100%' }}>
                {/* a wrong tap: it shakes its head */}
                <motion.div key={c.shake ?? 0} animate={c.shake && !reduce ? { rotate: [0, -15, 13, -10, 7, 0], x: [0, -7, 7, -5, 3, 0] } : {}} transition={{ duration: 0.7 }}
                  style={{ transformOrigin: '50% 90%' }}>
                  <div className={helping && right ? 'gf-bounce' : undefined}>
                    <Friend animal={c.animal} feeling={c.feeling} variant={c.variant} size={size} wave={!!c.wave} />
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
          {curtain('left')}
          {curtain('right')}
        </div>
        {/* the sill */}
        <span aria-hidden="true" style={{ position: 'absolute', left: -6, right: -6, bottom: -6, height: 11, background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 6 }} />
      </motion.button>
    </div>
  )
}
