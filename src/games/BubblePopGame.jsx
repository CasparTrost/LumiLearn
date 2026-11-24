import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence, useAnimationFrame, useAnimationControls, motionValue, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, useMood, RoundTrail, useBursts, HintHand, useIdle } from '../components/play/index.js'
import { useLater, Pips, Finale } from './zahlen/stage.jsx'

/**
 * Blasen-Blitz — "Kraken-Party": Mengen auf einen Blick erfassen, dann
 * Zahlen schnell finden
 *
 * Under water an octopus wishes for bubbles with exactly one amount (its
 * bubble shows it). Every right bubble pops and a star swims to the
 * octopus, who juggles it; a wrong one turns into a puffer fish that puffs
 * up, offended, and swims off. Quick pops in a row make the octopus dance.
 *
 *   • Levels 1–4: the bubbles carry dice patterns of one to six dots. Small
 *     quantities in a familiar pattern are seen at once rather than counted
 *     (subitizing).
 *   • From level 5: numerals, and the other bubbles favour numbers that are
 *     easy to mix up (12/21, 6/9, neighbours). The target used to be heard
 *     first and shown later; only recorded sentences are spoken now, so it
 *     is shown from the start.
 *
 * The bubbles rise slowly from the sand (faster from level 5), leave at the
 * top and come up again from below with the same value, so the wished-for
 * ones are never lost. A small physics loop moves them through
 * MotionValues; with reduced motion they hold still.
 *
 * The stars the octopus juggles stay from round to round; on a quick
 * streak it drops them on its own head, where they pile up as a crown.
 * After the last round comes a short party (not scored): every bubble is
 * a wished-for one, and each pop rings higher.
 */

const TINTS = ['#4aa3ff', '#ff6b5b', '#ffc93c', '#5cc45a', '#8e6cf0', '#fd79a8', '#2fb8a6', '#ff9f43']
const ROUNDS = 5

function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

// Numbers easy to take for the target: digits swapped, neighbours, 6 and 9.
function confusables(v, maxNum) {
  const out = [v - 1, v + 1]
  if (v > 9) out.push(Number(String(v).split('').reverse().join('')))
  if (v % 10 === 6) out.push(v + 3)
  if (v % 10 === 9) out.push(v - 3)
  return out.filter(x => x >= 1 && x <= maxNum && x !== v)
}

function spawnRound(target, cfg, W, H) {
  const targetCount = rand(cfg.minT, cfg.maxT)
  const near = cfg.dots ? [] : confusables(target, cfg.maxNum)
  const placed = []
  return Array.from({ length: cfg.count }, (_, i) => {
    let value = target
    if (i >= targetCount) {
      if (near.length && Math.random() < 0.5) value = near[rand(0, near.length - 1)]
      else do { value = rand(1, cfg.maxNum) } while (value === target)
    }
    // a little smaller in a phone-sized sea, never below a fingertip
    const size = Math.round(rand(cfg.dots ? 70 : 62, cfg.dots ? 96 : 90) * Math.max(0.8, Math.min(1, W / 520)))
    const r = size / 2 + 4
    // Inside the water by at least the radius, so no bubble is cut off, and
    // apart from the others: of a few random spots the one with the most
    // room is taken, so the bubbles spread over the whole sea instead of
    // clumping where chance put them.
    let best = null
    for (let k = 0; k < 24; k++) {
      const x = r + Math.random() * Math.max(0, W - 2 * r), y = r + Math.random() * Math.max(0, H - 2 * r)
      const room = Math.min(Infinity, ...placed.map(p => Math.hypot(p.x - x, p.y - y) - p.r - r))
      if (!best || room > best.room) best = { x, y, room }
    }
    placed.push({ x: best.x, y: best.y, r })
    return {
      id: `${i}-${Math.random().toString(36).slice(2)}`,
      value, tint: TINTS[rand(0, TINTS.length - 1)],
      left: (best.x / W) * 100, top: (best.y / H) * 100, size,
      floatDur: 5.5 + Math.random() * 5.0,
    }
  })
}

// How fast the bubbles rise: seconds to cross the sea once
const riseS = level => (level <= 3 ? 16 : level <= 4 ? 13 : level <= 7 ? 10 : 8)
const PARTY_MS = 8000

// 10 tiers: number range, bubbles in the sea, target bubbles per round.
// No clock in the first three levels — with a visible countdown a four-year-
// old feels pressure but learns nothing from it.
const ROUND_CFG = [
  { maxNum: 3,  count:  6, minT: 2, maxT: 3, dots: true  }, // L1
  { maxNum: 4,  count:  7, minT: 2, maxT: 3, dots: true  }, // L2
  { maxNum: 5,  count:  8, minT: 2, maxT: 4, dots: true  }, // L3
  { maxNum: 6,  count:  9, minT: 2, maxT: 4, dots: true,  timed: true }, // L4
  { maxNum: 10, count: 10, minT: 2, maxT: 4, timed: true }, // L5
  { maxNum: 12, count: 11, minT: 3, maxT: 5, timed: true }, // L6
  { maxNum: 20, count: 12, minT: 3, maxT: 5, timed: true }, // L7
  { maxNum: 25, count: 13, minT: 3, maxT: 5, timed: true }, // L8
  { maxNum: 30, count: 14, minT: 3, maxT: 6, timed: true }, // L9
  { maxNum: 40, count: 15, minT: 3, maxT: 6, timed: true }, // L10
].map(c => ({
  ...c,
  // The budget grows with the sea so the pressure per bubble stays
  // roughly constant; difficulty comes from the count and the number range.
  timeS: Math.max(24, Math.round(c.count * 1.5 + 10)),
}))

// The bubble's shine: a crescent hugging the upper left rim, away from
// where any pip sits
function Shine() {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
      <path d="M10 56 A42 42 0 0 1 46 8.5" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}

// White dots on a bubble, its numeral — or a star at the party (value 0)
function Face({ value, dots, size }) {
  if (value === 0) return <Art art="⭐" size={size * 0.6} />
  if (dots) return <Pips n={value} size={size * 0.74} color="#fffdf7" face={false} />
  return value
}

export default function BubblePopGame({ level = 1, onComplete }) {
  const cfg = ROUND_CFG[Math.min(level - 1, ROUND_CFG.length - 1)]
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const reduce = useReducedMotion()
  const { later, afterSpeech } = useLater()
  const [mood, setMood] = useMood()
  const [bursts, burst] = useBursts()

  const [roundIdx,  setRoundIdx]  = useState(0)
  const [target,    setTarget]    = useState(() => rand(1, cfg.maxNum))
  const [bubbles,   setBubbles]   = useState([])
  const [poppedIds, setPoppedIds] = useState([])
  const poppedRef    = useRef(new Set())
  const [lives,     setLives]     = useState(3)      // per round
  const livesRef     = useRef(3)
  const roundsRef    = useRef([])                    // per finished round: 'clean' | 'won' | 'lost'
  const [timeLeft,  setTimeLeft]  = useState(cfg.timeS)
  const [hint,      setHint]      = useState(false)  // targets pulse briefly after a wrong pop
  const [phase,     setPhase]     = useState('playing')
  const [stars,     setStars]     = useState(0)      // juggled by the octopus, kept from round to round
  const starsRef     = useRef(0)
  const [crown,     setCrown]     = useState(0)      // stars dropped on its head, for good
  const droppedRef   = useRef(false)                 // one drop per round
  const partyRef     = useRef(0)                     // pops at the party, for the rising sound
  const [flyers,    setFlyers]    = useState([])     // stars swimming to the octopus
  const [puffers,   setPuffers]   = useState([])     // wrong bubbles, now offended puffer fish
  const lastPopRef  = useRef(0)                      // time of the last right pop, for a streak
  const streakRef   = useRef(0)
  const mistakesRef = useRef(0)

  const rootRef    = useRef(null)
  const arenaRef   = useRef(null)
  const octoRef    = useRef(null)
  const wishRef    = useRef(null)
  const anchorRef  = useRef(null) // where a wished-for bubble will be, for the hand
  const physicsRef = useRef({}) // { [id]: { x, y, vx, vy, size, t, freq } } in px, in the sea
  const mvsRef     = useRef({}) // { [id]: { mx: MotionValue, my: MotionValue } }

  // The octopus sits beside the sea on a tablet held sideways, below it
  // when the screen is tall.
  // (first guessed from the window, so the first bubbles are spread over
  // the sea as it is really laid out)
  const [wide, setWide] = useState(() => innerWidth > (innerHeight - 80) * 1.05)
  useLayoutEffect(() => {
    const el = rootRef.current
    const ro = new ResizeObserver(() => setWide(el.clientWidth > el.clientHeight * 1.05))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // New bubbles: their place and motion are set up before they are drawn,
  // so none flashes at the corner for a frame.
  const launch = useCallback((list) => {
    const rect = arenaRef.current?.getBoundingClientRect()
    const W = rect?.width || 360, H = rect?.height || 300
    const phys = {}, mvs = {}
    list.forEach(b => {
      const x = (W * b.left) / 100, y = (H * b.top) / 100
      phys[b.id] = { x, y, vx: 0, vy: 0, size: b.size, t: Math.random() * Math.PI * 2, freq: 0.6 + Math.random() * 0.6 }
      mvs[b.id] = { mx: motionValue(x), my: motionValue(y) }
    })
    physicsRef.current = phys
    mvsRef.current = mvs
    poppedRef.current = new Set()
    setPoppedIds([])
    setBubbles(list)
  }, [])

  useEffect(() => {
    const t = rand(1, cfg.maxNum)
    const rect = arenaRef.current?.getBoundingClientRect()
    setTarget(t)
    launch(spawnRound(t, cfg, rect?.width || 360, rect?.height || 300))
    droppedRef.current = false
    livesRef.current = 3
    setLives(3)
    mistakesRef.current = 0
    setTimeLeft(cfg.timeS)
    setPhase('playing')
    lockPreviews()
    sayTask()
  }, [roundIdx, cfg, launch])

  // The party after the last round: every bubble is a star bubble, for
  // about eight seconds, then everyone dances (Finale). Not scored.
  const party = useCallback(() => {
    const rect = arenaRef.current?.getBoundingClientRect()
    const W = rect?.width || 360, H = rect?.height || 300
    partyRef.current = 0
    launch(spawnRound(0, { ...cfg, dots: true, minT: 14, maxT: 14, count: 14, maxNum: 0 }, W, H))
    setPhase('party')
    setMood('dance', 2000)
    sfx.tada()
    later(PARTY_MS, () => setPhase('finale'))
  }, [cfg, launch, later, setMood])

  // A round is over: note how it went and go on once the octopus has had
  // its moment (a dance for a won round); after the last, the party.
  const endRound = useCallback((how) => {
    const list = [...roundsRef.current, how]
    roundsRef.current = list
    const last = list.length >= ROUNDS
    afterSpeech(() => (last ? party() : setRoundIdx(r => r + 1)), how === 'lost' ? 2800 : 2600)
  }, [afterSpeech, party])

  useEffect(() => {
    if (phase !== 'playing' || !cfg.timed) return
    const iv = setInterval(() => {
      if (pausedRef.current) return
      setTimeLeft(t => (t <= 1 ? 0 : t - 1))
    }, 1000)
    return () => clearInterval(iv)
  }, [phase, cfg.timed])

  // Running out of time costs this round, nothing more: the octopus nods off.
  useEffect(() => {
    if (phase !== 'playing' || !cfg.timed || timeLeft > 0) return
    setMood('sleep', 2600)
    setPhase('roundFail')
    sayWrong()
    endRound('lost')
  }, [timeLeft, phase, cfg.timed, endRound, setMood])

  // Where a bubble is right now, relative to the whole game
  const bubbleAt = (b) => {
    const root = rootRef.current.getBoundingClientRect(), a = arenaRef.current.getBoundingClientRect()
    const p = physicsRef.current[b.id]
    return { x: a.left - root.left + (p?.x ?? 0), y: a.top - root.top + (p?.y ?? 0) }
  }

  // A star swims from the bubble to the octopus, who juggles it.
  const sendStar = (id, at) => {
    const root = rootRef.current.getBoundingClientRect(), o = octoRef.current.getBoundingClientRect()
    setFlyers(f => [...f, { id, x0: at.x, y0: at.y, x1: o.left - root.left + o.width / 2, y1: o.top - root.top + o.height * 0.15 }])
  }

  // Oops: the juggled stars land on its head, and stay there as a crown.
  const dropStars = useCallback(() => {
    const n = starsRef.current
    if (!n) return
    starsRef.current = 0
    setStars(0)
    setCrown(c => c + n)
    sfx.slideDown()
    setMood('oops', 900)
    later(900, () => { sfx.giggle(); setMood('happy', 1200) })
  }, [later, setMood])

  const popBubble = useCallback((bubble) => {
    if ((phase !== 'playing' && phase !== 'party') || pausedRef.current || poppedRef.current.has(bubble.id)) return
    const at = bubbleAt(bubble)
    poppedRef.current.add(bubble.id)
    setPoppedIds(prev => [...prev, bubble.id])

    if (phase === 'party') {
      // every pop rings a little higher; nothing is counted
      partyRef.current += 1
      sfx.combo(Math.min(6, 1 + Math.floor(partyRef.current / 2)))
      sendStar(bubble.id, at)
      const r0 = rootRef.current.getBoundingClientRect()
      burst({ x: r0.left + at.x, y: r0.top + at.y }, partyRef.current % 3 ? 'stars' : 'confetti', 8)
      // a popped party bubble comes up again from the sand, so the party goes on
      later(900, () => {
        poppedRef.current.delete(bubble.id)
        respawn(physicsRef.current[bubble.id])
        setPoppedIds(prev => prev.filter(x => x !== bubble.id))
      })
      return
    }

    if (bubble.value === target) {
      sfx.pop()
      sendStar(bubble.id, at)
      const now = Date.now()
      streakRef.current = now - lastPopRef.current < 1800 ? streakRef.current + 1 : 1
      lastPopRef.current = now
      if (streakRef.current >= 2) sfx.combo(streakRef.current)
      // a little sparkle where it popped; a quick streak sparkles more
      const r0 = rootRef.current.getBoundingClientRect()
      burst({ x: r0.left + at.x, y: r0.top + at.y }, 'stars', streakRef.current >= 2 ? 10 : 5)
      setMood(streakRef.current >= 3 ? 'dance' : 'wow', streakRef.current >= 3 ? 2400 : 700)
      // on a quick streak it gets carried away and drops its stars (once a round)
      if (streakRef.current >= 3 && !droppedRef.current) { droppedRef.current = true; later(900, dropStars) }
      const remaining = bubbles.filter(b => b.value === target && !poppedRef.current.has(b.id)).length
      if (remaining === 0) {
        setPhase('roundWin')
        later(500, () => { setMood('dance', 2600); burst(octoRef.current, 'stars', 14) })
        sayRight()
        endRound(mistakesRef.current === 0 ? 'clean' : 'won')
      }
      return
    }
    // A wrong bubble turns into a puffer fish: it puffs up, offended, and
    // swims away, still showing what it was.
    sfx.boing()
    setPuffers(p => [...p, { id: bubble.id, x: at.x, y: at.y, value: bubble.value, dir: at.x < rootRef.current.clientWidth / 2 ? -1 : 1 }])
    streakRef.current = 0
    mistakesRef.current += 1
    const nl = livesRef.current - 1
    livesRef.current = nl
    setLives(nl)
    setMood('oops', 1200)
    sayWrong()
    if (nl <= 0) {
      // Three wrong pops end this round only.
      setPhase('roundFail')
      endRound('lost')
      return
    }
    setHint(true)
    later(1200, () => setHint(false))
  }, [phase, bubbles, target, endRound, later, setMood, burst, dropStars])

  // Back to the sand: a bubble that left at the top comes up again from
  // below, where there is room.
  const respawn = (p) => {
    const a = arenaRef.current
    if (!p || !a) return
    const W = a.clientWidth, H = a.clientHeight, r = p.size / 2 + 4
    let best = null
    for (let k = 0; k < 8; k++) {
      const x = r + Math.random() * Math.max(0, W - 2 * r)
      const room = Math.min(Infinity, ...Object.values(physicsRef.current).filter(o => o !== p && o.y > H - 3 * r).map(o => Math.abs(o.x - x)))
      if (!best || room > best.room) best = { x, room }
    }
    p.x = best.x
    p.y = H + r + Math.random() * 30
    p.vx = 0
  }

  // Physics loop: the bubbles rise, sway and nudge each other apart; held
  // while paused, still with reduced motion.
  useAnimationFrame((time, delta) => {
    if (!arenaRef.current || pausedRef.current) return
    const W = arenaRef.current.clientWidth, H = arenaRef.current.clientHeight
    if (W === 0 || H === 0) return
    if (reduce) {
      // holding still: only kept inside the sea, should it change size
      for (const [id, p] of Object.entries(physicsRef.current)) {
        const r = p.size / 2 + 2
        p.x = Math.max(r, Math.min(W - r, p.x))
        p.y = Math.max(r, Math.min(H - r, p.y))
        mvsRef.current[id]?.mx.set(p.x)
        mvsRef.current[id]?.my.set(p.y)
      }
      return
    }

    const dt     = Math.min(delta / 1000, 0.05)
    const phys   = physicsRef.current
    const mvs    = mvsRef.current
    const popped = poppedRef.current
    const ids    = Object.keys(phys).filter(id => !popped.has(id))
    const speed  = H / riseS(phase === 'party' ? 6 : level)

    for (const id of ids) {
      const p = phys[id]
      // rise at the steady speed, sway gently from side to side
      p.vy += (-speed - p.vy) * 1.5 * dt
      p.vx += (Math.cos((time / 1000) * p.freq + p.t) * 22 - p.vx) * 1.2 * dt

      // nudge apart from the others
      for (const oid of ids) {
        if (oid === id) continue
        const o = phys[oid]
        const dx = p.x - o.x, dy = p.y - o.y
        const d2 = dx * dx + dy * dy
        const min = (p.size + o.size) / 2 + 6
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const f = ((min - d) / min) * 220 * dt * 60
          p.vx += (dx / d) * f * dt * 4
          p.vy += (dy / d) * f * dt * 2
        }
      }

      p.x += p.vx * dt
      p.y += p.vy * dt
      // never out at the sides
      const r = p.size / 2 + 2
      p.x = Math.max(r, Math.min(W - r, p.x))
      // out at the top: up again from the sand, same value
      if (p.y < -r) respawn(p)

      mvs[id]?.mx.set(p.x)
      mvs[id]?.my.set(p.y)
    }
  })

  // The hand points where a wished-for bubble will be in a moment (the
  // bubbles move; the hand needs a place that holds still while it shows).
  const hintDelay = roundIdx === 0 ? 2000 : 8000
  const idle = useIdle(hintDelay, phase === 'playing')
  const [aimAt, setAimAt] = useState(null)
  useEffect(() => {
    if (!idle) { setAimAt(null); return }
    const aim = () => {
      const a = arenaRef.current
      if (!a) return
      const H = a.clientHeight, ahead = reduce ? 0 : (H / riseS(level)) * 1.2
      const p = bubbles.filter(b => b.value === target && !poppedRef.current.has(b.id))
        .map(b => physicsRef.current[b.id]).filter(Boolean)
        .map(q => ({ x: q.x, y: q.y - ahead })).filter(q => q.y > 60 && q.y < H - 40)
        .sort((u, v) => v.y - u.y)[0]
      setAimAt(p ?? null)
    }
    aim()
    // the hand comes back every few seconds: by then the bubbles have moved on
    const iv = setInterval(aim, 6000)
    return () => clearInterval(iv)
  }, [idle]) // eslint-disable-line react-hooks/exhaustive-deps

  const octoSize = wide ? 170 : 150
  const wish = cfg.dots
    ? <Pips n={target} size={56} color="#ff6b5b" />
    : <span style={{ fontSize: 46, lineHeight: 1, minWidth: 50, textAlign: 'center' }}>{target}</span>

  const octopus = (
    <div style={{ position: 'relative', display: 'flex', flexDirection: wide ? 'column' : 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: wide ? 8 : 18, paddingTop: 80 }}>
      <div ref={octoRef} style={{ position: 'relative' }}>
        <Critter art="🐙" size={octoSize} mood={mood} label="Krake"
          wish={phase === 'finale' ? null : phase === 'party' ? <Art art="🎉" size={46} /> : <span ref={wishRef} data-target={target}>{wish}</span>} />
        <Juggle n={stars} size={octoSize} still={reduce || paused} />
        <StarCrown n={crown} size={octoSize} />
      </div>
    </div>
  )

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 'clamp(6px,1.5vw,14px) clamp(8px,2vw,20px)', gap: 8, userSelect: 'none', overflow: 'hidden' }}>

      {/* Hearts of this round, the rounds, the calm clock */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 4, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,253,247,0.85)', border: '3px solid #2a1b3d', boxShadow: '0 3px 0 rgba(42,27,61,0.3)' }} aria-label={`${lives} Herzen`}>
          {[0, 1, 2].map(i => (
            <motion.span key={i} animate={i < lives ? { scale: 1, opacity: 1, rotate: 0 } : { scale: [1, 1.4, 0.75], opacity: 0.3, rotate: [0, -20, 0] }}
              transition={{ duration: 0.5 }} style={{ display: 'inline-flex', filter: i < lives ? undefined : 'grayscale(1)' }}>
              <Art art="❤️" size={40} />
            </motion.span>
          ))}
        </div>
        <RoundTrail total={ROUNDS} done={roundsRef.current.length} walker="🐠" goal="🐚" size={32} style={{ flex: 1 }} />
        {cfg.timed && <Clock fraction={timeLeft / cfg.timeS} />}
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column-reverse', gap: 8 }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: wide ? 'flex-end' : 'center', justifyContent: 'center', paddingBottom: wide ? 24 : 4, width: wide ? 210 : undefined }}>
          {octopus}
        </div>

        {/* The open sea: the bubbles float in the scene behind */}
        <div ref={arenaRef} style={{ position: 'relative', flex: 1, minHeight: 200, overflow: 'hidden' }}>
          {/* now and then a visitor swims through: a fish in one round, a dolphin in another */}
          {!reduce && phase === 'playing' && roundIdx % 2 === 1 && <Visitor key={roundIdx} art={roundIdx === 1 ? '🐠' : '🐬'} paused={paused} />}
          {aimAt && <div ref={anchorRef} aria-hidden="true" style={{ position: 'absolute', left: aimAt.x, top: aimAt.y, width: 2, height: 2 }} />}
          <AnimatePresence>
            {bubbles.map(bubble => {
              if (poppedIds.includes(bubble.id)) return null
              // after a miss the wished-for ones pulse once; when a round is
              // lost, they light up gold before the next round comes
              const reveal = phase === 'roundFail' && bubble.value === target
              const pulse = (hint || reveal) && bubble.value === target
              return (
                <motion.button
                  key={bubble.id}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={pulse ? { opacity: 1, scale: [1, 1.18, 1, 1.18, 1] } : { opacity: 1, scale: 1 }}
                  exit={{ scale: 1.6, opacity: 0, transition: { duration: 0.2 } }}
                  transition={pulse ? { duration: 1.1, repeat: reveal ? 1 : 0 } : { opacity: { duration: 0.3 }, scale: { type: 'spring', stiffness: 300, damping: 18 } }}
                  whileTap={{ scale: 1.25 }}
                  onClick={() => popBubble(bubble)}
                  aria-label={bubble.value === 0 ? 'Party-Blase' : cfg.dots ? `${bubble.value} ${bubble.value === 1 ? 'Punkt' : 'Punkte'}` : `${bubble.value}`}
                  style={{
                    x: mvsRef.current[bubble.id]?.mx,
                    y: mvsRef.current[bubble.id]?.my,
                    position: 'absolute',
                    left: 0, top: 0,
                    marginLeft: -bubble.size / 2, marginTop: -bubble.size / 2,
                    width: bubble.size, height: bubble.size, padding: 0,
                    borderRadius: '50%',
                    // see-through soap bubbles with a coloured rim; the shine is a
                    // thin crescent along the rim (Shine), never a dot that
                    // could be counted as one more pip
                    background: `radial-gradient(circle at 40% 35%, ${bubble.tint}77 0%, ${bubble.tint}cc 60%, ${bubble.tint})`,
                    border: '3px solid #2a1b3d',
                    boxShadow: reveal
                      ? '0 0 0 6px #ffc93c, 0 0 18px 8px rgba(255,201,60,0.8)'
                      : 'inset 0 -6px 0 rgba(0,0,0,0.12), 0 4px 0 rgba(42,27,61,0.35)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: bubble.size * 0.44, fontWeight: 800, color: '#fff',
                    // an ink outline keeps white digits readable on any tint
                    textShadow: '-2px -2px 0 #2a1b3d, 2px -2px 0 #2a1b3d, -2px 2px 0 #2a1b3d, 2px 2px 0 #2a1b3d, 0 3px 0 #2a1b3d',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: 5,
                  }}
                >
                  <Shine />
                  <Face value={bubble.value} dots={cfg.dots} size={bubble.size} />
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Stars swimming to the octopus */}
      {flyers.map(f => (
        <motion.div key={f.id} aria-hidden="true"
          initial={{ x: f.x0 - 22, y: f.y0 - 22, scale: 0.4, rotate: 0 }}
          animate={{ x: [f.x0 - 22, (f.x0 + f.x1) / 2 - 22, f.x1 - 22], y: [f.y0 - 22, Math.min(f.y0, f.y1) - 80, f.y1 - 22], scale: [0.4, 1.3, 0.8], rotate: 360 }}
          transition={{ duration: reduce ? 0.01 : 0.75, ease: 'easeInOut' }}
          onAnimationComplete={() => { setFlyers(l => l.filter(x => x.id !== f.id)); starsRef.current += 1; setStars(starsRef.current); sfx.coin() }}
          style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none' }}>
          <Art art="⭐" size={44} />
        </motion.div>
      ))}

      {/* Offended puffer fish */}
      {puffers.map(p => (
        <motion.div key={p.id} aria-hidden="true"
          initial={{ x: p.x - 40, y: p.y - 40, scale: 0.5 }}
          animate={reduce ? { opacity: [1, 1, 0] } : { scale: [0.5, 1.5, 1.35, 1.35], x: [p.x - 40, p.x - 40, p.x - 40, p.x - 40 + p.dir * 900], y: [p.y - 40, p.y - 52, p.y - 40, p.y - 120] }}
          transition={{ duration: 2.2, times: [0, 0.25, 0.45, 1], ease: 'easeIn' }}
          onAnimationComplete={() => setPuffers(l => l.filter(x => x.id !== p.id))}
          style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ transform: p.dir > 0 ? 'scaleX(-1)' : undefined }}><Art art="🐡" size={80} /></div>
          <span style={{
            marginTop: -6, minWidth: 34, height: 34, padding: '0 4px', borderRadius: 17, background: '#fffdf7', border: '3px solid #2a1b3d',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 20, color: '#2a1b3d',
          }}>{cfg.dots ? <Pips n={p.value} size={28} color="#2a1b3d" face={false} /> : p.value}</span>
        </motion.div>
      ))}
      {/* The hand shows the move: from the wish to a bubble like it */}
      <HintHand key={`${roundIdx}-${aimAt?.x}`} from={wishRef} to={anchorRef} active={phase === 'playing' && !!aimAt} delay={0} />
      {phase === 'finale' && (
        <Finale cast={['🐙', '🐠', '🐡', '🦀', '🐬', '🐳']} size={wide ? 110 : 80}
          onDone={() => onComplete(result(roundsRef.current.filter(r => r === 'clean').length, ROUNDS))} />
      )}
      {bursts}
    </div>
  )
}

// A visitor crossing the sea once, behind the bubbles; a tap makes it
// giggle and spin
function Visitor({ art, paused }) {
  const [spin, setSpin] = useState(0)
  const swim = useAnimationControls()
  // it holds still while the help is open and swims on afterwards
  useEffect(() => {
    if (paused) swim.stop()
    else swim.start({ left: '110%', transition: { duration: 9, ease: 'linear', delay: 1.5 } })
  }, [paused, swim])
  return (
    <motion.div initial={{ left: '-15%' }} animate={swim}
      style={{ position: 'absolute', top: '42%', zIndex: 2 }}>
      <motion.button type="button" aria-label="Besuch" onClick={() => { sfx.giggle(); setSpin(x => x + 1) }}
        animate={{ rotate: spin * 360, y: [0, -10, 0] }} transition={{ rotate: { duration: 0.6 }, y: { duration: 1.6, repeat: Infinity } }}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', transform: 'scaleX(-1)' }}>
        <Art art={art} size={70} />
      </motion.button>
    </motion.div>
  )
}

// The stars it dropped on its own head, piled up as a wobbly crown
function StarCrown({ n, size }) {
  if (!n) return null
  const rows = [], shown = Math.min(n, 15)
  for (let left = shown, w = 5; left > 0; w--) { const k = Math.min(w, left); rows.push(k); left -= k }
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: size * 0.82, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column-reverse', alignItems: 'center', pointerEvents: 'none' }}>
      {rows.map((k, r) => (
        <div key={r} style={{ display: 'flex', marginBottom: -8 }}>
          {Array.from({ length: k }, (_, i) => (
            <motion.span key={i} initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12, delay: i * 0.05 }}
              style={{ display: 'inline-flex', margin: '0 -3px', transform: `rotate(${((r * 5 + i) * 37) % 30 - 15}deg)` }}>
              <Art art="⭐" size={22} />
            </motion.span>
          ))}
        </div>
      ))}
    </div>
  )
}

// The stars the octopus juggles, circling over its head
function Juggle({ n: all, size, still }) {
  const n = Math.min(all, 8)
  if (!n) return null
  return (
    <motion.div aria-hidden="true" animate={still ? {} : { rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
      style={{ position: 'absolute', left: '50%', top: size * 0.05, width: size * 0.9, height: size * 0.5, marginLeft: -size * 0.45, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1, rotate: still ? 0 : -360 }}
            transition={{ scale: { type: 'spring', stiffness: 400 }, rotate: { duration: 2.4, repeat: Infinity, ease: 'linear' } }}
            style={{ position: 'absolute', left: `calc(50% + ${Math.cos(a) * size * 0.4}px - 16px)`, top: `calc(50% + ${Math.sin(a) * size * 0.22}px - 16px)` }}>
            <Art art="⭐" size={32} />
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// A calm clock: a strip of sand that runs out
function Clock({ fraction }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 4, width: 'clamp(90px,18vw,170px)' }}>
      <Art art="⏳" size={30} />
      <div style={{ flex: 1, height: 16, background: 'rgba(255,253,247,0.6)', border: '3px solid #2a1b3d', borderRadius: 10, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${fraction * 100}%` }} transition={{ duration: 0.85 }}
          style={{ height: '100%', background: fraction > 0.5 ? '#5cc45a' : fraction > 0.25 ? '#ffc93c' : '#ff9f43' }} />
      </div>
    </div>
  )
}
