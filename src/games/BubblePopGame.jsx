import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { motion, AnimatePresence, useAnimationFrame, useAnimationControls, motionValue, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, narrate, afterNarration } from '../narrator.js'
import { numberWord } from '../lib/words.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, useMood, RoundTrail, useBursts, useJuice, HintHand, useIdle } from '../components/play/index.js'
import { useLater, Pips, Finale } from './zahlen/stage.jsx'
import { rand, spawnRound, makeGiant, giantSize } from './blasen/sea.js'

/**
 * Blasen-Blitz — "Kraken-Party": Mengen auf einen Blick erfassen, dann
 * Zahlen schnell finden
 *
 * Under water an octopus wishes for bubbles with exactly one amount (its
 * bubble shows it). Every right bubble pops and a star flies to the star
 * counter (components/play/Juice.jsx: a note that climbs with every right
 * pop in a row, a flame for three, five and eight). A wrong one is not what
 * the octopus wished for, so it does not pop: it is rubbery, boings back
 * from the finger and shoots up out of the sea, still showing what it was,
 * while the octopus shakes its head and the right ones pulse. From three in
 * a row the octopus dances; when all the wished-for bubbles of a round are
 * found, its wish is fulfilled (the speech bubble goes) and it juggles a
 * star for each of them over its head.
 *
 * Once per level, in one of the middle rounds, a giant bubble drifts
 * slowly across the sea. In the dot levels it carries two dice faces (a sum:
 * 2 + 1 dots is a three); in the numeral levels its number hides behind a
 * wobbling veil and shows only in glimpses. If it is a wished-for one,
 * popping it bursts it into a shower of five bonus stars; if not, it is a
 * wrong bubble like any other. It is a bonus: the round never waits for it.
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
 * How many bubbles and how big depends on the sea as it is on screen: never
 * smaller than a fingertip (64 px), and never more than the sea can carry
 * without a crowd (a phone held sideways has room for about eight, the
 * giant counting as two or three).
 *
 * The stars are counted over the whole level and are a reward only: the
 * result is the number of rounds without a wrong pop, as before.
 * After the last round comes a short party (not scored): every bubble is
 * a wished-for one, every pop is one more star, and the octopus juggles
 * all the way through.
 */

const ROUNDS = 5

// How fast the bubbles rise: seconds to cross the sea once
const riseS = level => (level <= 3 ? 16 : level <= 4 ? 13 : level <= 7 ? 10 : 8)
// The giant drifts across the sea once, slowly, a little faster later on
const driftS = level => (level <= 4 ? 14 : 11)
// …and turns up this long after its round began, once the wish is heard
const GIANT_AFTER_MS = 2500
const PARTY_MS = 8000
const SEA_MASK = 'linear-gradient(to bottom, transparent 0, #000 18px, #000 calc(100% - 36px), transparent 100%)'

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
function Face({ bubble, dots, size }) {
  const { value } = bubble
  if (bubble.giant) return <GiantFace bubble={bubble} size={size} />
  if (value === 0) return <Art art="⭐" size={size * 0.6} />
  if (dots) return <Pips n={value} size={size * 0.74} color="#fffdf7" face={false} />
  return value
}

// The giant's face: two dice side by side, like the one in the octopus's
// wish (two dice, 1 and 2, make a three), or its number behind a milky veil
// that wobbles and parts now and then for a glimpse
function GiantFace({ bubble, size }) {
  if (bubble.parts) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: size * 0.05 }}>
        {bubble.parts.map((n, i) => (
          <div key={i} style={{ transform: `rotate(${i ? 9 : -9}deg)` }}>
            <Pips n={n} size={size * 0.36} color="#ff6b5b" />
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', overflow: 'hidden' }}>
      <motion.span animate={{ filter: ['blur(10px)', 'blur(10px)', 'blur(0px)', 'blur(0px)', 'blur(10px)'] }}
        transition={{ duration: 3, times: [0, 0.5, 0.6, 0.82, 1], repeat: Infinity }}
        style={{ display: 'inline-block' }}>{bubble.value}</motion.span>
      {/* the veil: milky, wavy, parting for a moment */}
      <motion.div aria-hidden="true"
        animate={{ opacity: [0.92, 0.92, 0.05, 0.05, 0.92], skewX: [-6, 6, 0, 0, -6], scaleY: [1, 1.06, 1, 1, 1] }}
        transition={{ duration: 3, times: [0, 0.5, 0.6, 0.82, 1], repeat: Infinity }}
        style={{
          position: 'absolute', inset: '-10%', pointerEvents: 'none',
          background: 'repeating-radial-gradient(circle at 50% 120%, rgba(255,253,247,0.85) 0 14px, rgba(220,240,255,0.7) 14px 26px)',
        }} />
    </div>
  )
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
  const juice = useJuice()
  const { hit, miss, shake } = juice   // these three never change

  const [roundIdx,  setRoundIdx]  = useState(0)
  const [target,    setTarget]    = useState(() => rand(1, cfg.maxNum))
  const [bubbles,   setBubbles]   = useState([])
  const [poppedIds, setPoppedIds] = useState([])
  const poppedRef    = useRef(new Set())               // popped, or bounced off: no longer tappable
  const [bounced,   setBounced]   = useState([])     // wrong ones, boinging and shooting off
  const bouncedRef   = useRef(new Set())
  const [lives,     setLives]     = useState(3)      // per round
  const livesRef     = useRef(3)
  const roundsRef    = useRef([])                    // per finished round: 'clean' | 'won' | 'lost'
  const [timeLeft,  setTimeLeft]  = useState(cfg.timeS)
  const [hint,      setHint]      = useState(false)  // targets pulse briefly after a wrong pop
  const [phase,     setPhase]     = useState('playing')
  const partyRef     = useRef(0)                     // pops at the party: now stars, now confetti
  const mistakesRef = useRef(0)
  // The one round of the level with the giant bubble: one of the middle ones
  const [giantRound] = useState(() => rand(1, 3))

  const rootRef    = useRef(null)
  const arenaRef   = useRef(null)
  const octoRef    = useRef(null)
  const anchorRef  = useRef(null) // where a wished-for bubble will be, for the hand
  const physicsRef = useRef({}) // { [id]: { x, y, vx, vy, size, t, freq } } in px, in the sea
  const mvsRef     = useRef({}) // { [id]: { mx: MotionValue, my: MotionValue } }

  // The octopus sits beside the sea on a screen held sideways, below it
  // when the screen is tall.
  // (first guessed from the window, so the first bubbles are spread over
  // the sea as it is really laid out)
  const [wide, setWide] = useState(() => innerWidth > (innerHeight - 80) * 1.05)
  // The top row has room for the star counter beside the hearts, the trail
  // and the clock — on a phone held upright it has not.
  const [roomy, setRoomy] = useState(() => innerWidth >= 560)
  // The height under the top row: on a phone held sideways the octopus and
  // its wish have to fit into about 250 px
  const [stageH, setStageH] = useState(() => innerHeight - 140)
  const stage = juice.stage
  useLayoutEffect(() => {
    const el = rootRef.current
    const ro = new ResizeObserver(() => {
      setWide(el.clientWidth > el.clientHeight * 1.05)
      setRoomy(el.clientWidth >= 560)
      if (stage.current) setStageH(stage.current.clientHeight)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [stage])
  const hudOnTop = wide || roomy
  // A short stage: smaller wish, and the octopus as big as still fits
  // under it (it used to stand 80 px into the row of hearts)
  const tight = wide && stageH < 360
  const wishPx = tight ? 44 : 56
  const wishRoom = wishPx + 48            // the wish bubble with its tail, above the head
  const octoSize = wide ? Math.round(Math.max(96, Math.min(170, stageH - wishRoom - 12))) : 150

  // Lays out new bubbles: their place and motion are set up before they
  // are drawn, so none flashes at the corner for a frame. `keep` adds them
  // to the ones there (the giant), instead of starting a new sea.
  const place = useCallback((list, keep = false) => {
    const rect = arenaRef.current?.getBoundingClientRect()
    const W = rect?.width || 360, H = rect?.height || 300
    const phys = keep ? physicsRef.current : {}, mvs = keep ? mvsRef.current : {}
    list.forEach(b => {
      const x = (W * b.left) / 100, y = (H * b.top) / 100
      phys[b.id] = { x, y, vx: 0, vy: 0, size: b.size, t: Math.random() * Math.PI * 2, freq: 0.6 + Math.random() * 0.6, giant: !!b.giant, dir: b.dir ?? 0 }
      mvs[b.id] = { mx: motionValue(x), my: motionValue(y) }
    })
    physicsRef.current = phys
    mvsRef.current = mvs
    if (keep) { setBubbles(l => [...l, ...list]); return }
    poppedRef.current = new Set()
    bouncedRef.current = new Set()
    setPoppedIds([])
    setBounced([])
    setBubbles(list)
  }, [])

  // Gone from the sea for good (popped, bounced off, drifted out)
  const remove = useCallback((id) => {
    poppedRef.current.add(id)
    bouncedRef.current.delete(id)
    setPoppedIds(prev => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const seaSize = () => {
    const rect = arenaRef.current?.getBoundingClientRect()
    return { W: rect?.width || 360, H: rect?.height || 300 }
  }

  useEffect(() => {
    const withGiant = roundIdx === giantRound
    // the giant's round wishes for at least two, so that two dice faces can add up to it
    const t = withGiant && cfg.dots ? rand(2, cfg.maxNum) : rand(1, cfg.maxNum)
    const { W, H } = seaSize()
    setTarget(t)
    place(spawnRound(t, cfg, W, H, { giant: withGiant }))
    livesRef.current = 3
    setLives(3)
    mistakesRef.current = 0
    setTimeLeft(cfg.timeS)
    setPhase('playing')
    lockPreviews()
    sayTask()
    // The giant comes in from one side, once the wish has been heard
    let gone = false
    if (withGiant) {
      later(GIANT_AFTER_MS, () => {
        if (gone) return
        const { W: w, H: h } = seaSize()
        const size = giantSize(w, h), dir = Math.random() < 0.5 ? 1 : -1
        const g = { ...makeGiant(t, cfg), size, dir }
        // with reduced motion it simply holds still in the middle for a while
        const x = reduce ? w / 2 : dir > 0 ? -size / 2 : w + size / 2
        place([{ ...g, left: (x / w) * 100, top: 50 }], true)
        if (reduce) later(driftS(level) * 1000, () => { if (!gone) remove(g.id) })
      })
    }
    // after any praise still being spoken, not over it
    const stop = afterNarration(() => narrate([numberWord(t)]))
    return () => { gone = true; stop?.() }
  }, [roundIdx, cfg]) // eslint-disable-line react-hooks/exhaustive-deps

  // The party after the last round: every bubble is a star bubble, for
  // about eight seconds, then everyone dances (Finale). Not scored.
  const party = useCallback(() => {
    const { W, H } = seaSize()
    partyRef.current = 0
    place(spawnRound(0, { ...cfg, dots: true, count: 14, maxNum: 0 }, W, H, { all: true }))
    setPhase('party')
    setMood('dance', 2000)
    sfx.tada()
    later(PARTY_MS, () => setPhase('finale'))
  }, [cfg, place, later, setMood])

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

  // `el` is the bubble's button: where the star starts from
  const popBubble = useCallback((bubble, el) => {
    if ((phase !== 'playing' && phase !== 'party') || pausedRef.current || poppedRef.current.has(bubble.id)) return

    if (phase === 'party') {
      // every pop is one more star and rings a little higher; the result
      // of the level is not touched
      remove(bubble.id)
      partyRef.current += 1
      hit(el)
      burst(el, partyRef.current % 3 ? 'stars' : 'confetti', 8)
      // a popped party bubble comes up again from the sand, so the party goes on
      later(900, () => {
        poppedRef.current.delete(bubble.id)
        respawn(physicsRef.current[bubble.id])
        setPoppedIds(prev => prev.filter(x => x !== bubble.id))
      })
      return
    }

    if (bubble.value === target) {
      remove(bubble.id)
      sfx.pop()
      if (bubble.giant) {
        // the giant bursts into a shower of bonus stars; the round goes on
        hit(el, { stars: 5 })
        burst(el, 'stars', 22)
        later(180, () => burst(el, 'confetti', 16))
        shake(0.6)
        setMood('dance', 2400)
        return
      }
      // the star, the climbing note, the flame for a streak
      const { streak, milestone } = hit(el)
      // a little sparkle where it popped; more when the flame shows
      burst(el, 'stars', milestone ? 10 : 5)
      setMood(streak >= 3 ? 'dance' : 'wow', streak >= 3 ? 2400 : 700)
      const remaining = bubbles.filter(b => !b.giant && b.value === target && !poppedRef.current.has(b.id)).length
      if (remaining === 0) {
        shake(0.7)   // the last one of the round lands a little harder
        setPhase('roundWin')
        later(500, () => { setMood('dance', 2600); burst(octoRef.current, 'stars', 14) })
        sayRight()
        endRound(mistakesRef.current === 0 ? 'clean' : 'won')
      }
      return
    }
    // Not what the octopus wished for: the bubble does not pop. It is
    // rubbery, boings back from the finger and shoots up out of the sea,
    // still showing what it was; the octopus shakes its head and the
    // wished-for ones pulse.
    poppedRef.current.add(bubble.id)
    bouncedRef.current.add(bubble.id)
    const p = physicsRef.current[bubble.id]
    if (p) p.bouncedAt = performance.now()
    setBounced(l => [...l, bubble.id])
    miss(el)
    later(60, () => sfx.boing())
    if (reduce) later(900, () => remove(bubble.id))
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
  }, [phase, bubbles, target, endRound, later, setMood, burst, hit, miss, shake, remove, reduce])

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

  // Physics loop: the bubbles rise, sway and nudge each other apart; the
  // giant drifts across and pushes the others aside; a bounced one waits
  // out its boing and shoots off. Held while paused, still with reduced
  // motion.
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
    const off    = bouncedRef.current
    const ids    = Object.keys(phys).filter(id => !popped.has(id))
    const speed  = H / riseS(phase === 'party' ? 6 : level)

    for (const id of off) {
      const p = phys[id]
      if (!p) continue
      // the boing first (it holds still), then up and away, fast
      if (performance.now() - (p.bouncedAt ?? 0) > 420) {
        p.vy += (-H * 1.5 - p.vy) * 3 * dt
        p.vx += ((p.x < W / 2 ? -1 : 1) * 60 - p.vx) * 2 * dt
        p.x += p.vx * dt
        p.y += p.vy * dt
      }
      if (p.y < -p.size) remove(id)
      mvs[id]?.mx.set(p.x)
      mvs[id]?.my.set(p.y)
    }

    for (const id of ids) {
      const p = phys[id]
      if (p.giant) {
        // across the sea once, on a slow swell; then it is gone
        p.x += (p.dir * (W + p.size)) / driftS(level) * dt
        p.y = H / 2 + Math.sin((time / 1000) * 0.9 + p.t) * H * 0.08
        if ((p.dir > 0 && p.x > W + p.size / 2) || (p.dir < 0 && p.x < -p.size / 2)) remove(id)
        mvs[id]?.mx.set(p.x)
        mvs[id]?.my.set(p.y)
        continue
      }
      // rise at the steady speed, sway gently from side to side
      p.vy += (-speed - p.vy) * 1.5 * dt
      p.vx += (Math.cos((time / 1000) * p.freq + p.t) * 22 - p.vx) * 1.2 * dt

      // nudge apart from the others (the giant pushes harder)
      for (const oid of ids) {
        if (oid === id) continue
        const o = phys[oid]
        const dx = p.x - o.x, dy = p.y - o.y
        const d2 = dx * dx + dy * dy
        const min = (p.size + o.size) / 2 + 6
        if (d2 < min * min && d2 > 0.01) {
          const d = Math.sqrt(d2)
          const f = ((min - d) / min) * 220 * dt * 60 * (o.giant ? 2 : 1)
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

  // The hand taps where a wished-for bubble will be in a moment (the
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
      const p = bubbles.filter(b => !b.giant && b.value === target && !poppedRef.current.has(b.id))
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

  const wish = cfg.dots
    ? <Pips n={target} size={wishPx} color="#ff6b5b" />
    : <span style={{ fontSize: wishPx * 0.82, lineHeight: 1, minWidth: wishPx * 0.9, textAlign: 'center' }}>{target}</span>
  // The wish is shown while it is open; when it is fulfilled (the round
  // won) or at the party the octopus juggles stars where it was
  const wishOpen = phase === 'playing' || phase === 'roundFail'
  const partyTime = phase === 'party' || phase === 'finale'

  const octopus = (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: wide ? 'column' : 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: wide ? 8 : 18,
      paddingTop: wishRoom,
      // on a phone held upright the star counter stands to its right: a step aside for it
      paddingRight: hudOnTop ? 0 : 'clamp(0px, calc(480px - 100vw), 70px)',
    }}>
      <div ref={octoRef} style={{ position: 'relative' }}>
        <Critter art="🐙" size={octoSize} mood={mood} label="Krake"
          wish={wishOpen ? <span data-target={target}>{wish}</span> : null} />
        {/* Its turn when the round is won: one star per bubble found.
            (The star of each single pop flies to the counter instead.) */}
        <Juggle n={phase === 'party' ? 8 : phase === 'roundWin' ? bubbles.filter(b => !b.giant && b.value === target).length : 0}
          size={octoSize} room={wishRoom} still={reduce || paused} />
      </div>
    </div>
  )

  return (
    <div ref={rootRef} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 'clamp(6px,1.5vw,14px) clamp(8px,2vw,20px)', gap: 8, userSelect: 'none', overflow: 'hidden' }}>

      {/* Hearts of this round, the rounds, the calm clock. At the party
          nothing can be lost any more: hearts and clock step aside. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: roomy ? 12 : 8, flexShrink: 0 }}>
        <motion.div animate={{ opacity: partyTime ? 0 : 1 }} aria-hidden={partyTime || undefined}
          style={{ display: 'flex', gap: roomy ? 4 : 2, padding: roomy ? '4px 10px' : '4px 8px', borderRadius: 999, background: 'rgba(255,253,247,0.85)', border: '3px solid #2a1b3d', boxShadow: '0 3px 0 rgba(42,27,61,0.3)' }} aria-label={`${lives} Herzen`}>
          {[0, 1, 2].map(i => (
            <motion.span key={i} animate={i < lives ? { scale: 1, opacity: 1, rotate: 0 } : { scale: [1, 1.4, 0.75], opacity: 0.3, rotate: [0, -20, 0] }}
              transition={{ duration: 0.5 }} style={{ display: 'inline-flex', filter: i < lives ? undefined : 'grayscale(1)' }}>
              <Art art="❤️" size={roomy ? 40 : 30} />
            </motion.span>
          ))}
        </motion.div>
        <RoundTrail total={ROUNDS} done={roundsRef.current.length} walker="🐠" goal="🐚" size={32} style={{ flex: 1 }} />
        {cfg.timed && <motion.div animate={{ opacity: partyTime ? 0 : 1 }}><Clock fraction={timeLeft / cfg.timeS} narrow={!roomy} /></motion.div>}
        {/* The star counter (Juice): top right where there is room beside the trail … */}
        {hudOnTop && juice.hud}
      </div>

      <div ref={juice.stage} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column-reverse', gap: 8 }}>
        <div style={{ position: 'relative', flexShrink: 0, display: 'flex', alignItems: wide ? 'flex-end' : 'center', justifyContent: 'center', paddingBottom: wide ? (tight ? 6 : 24) : 4, width: wide ? Math.max(150, octoSize + 40) : undefined }}>
          {octopus}
          {/* … and beside the octopus where the top row is full: below the
              sea, where no bubble comes */}
          {!hudOnTop && <div style={{ position: 'absolute', right: 0, top: '50%' }}>{juice.hud}</div>}
        </div>

        {/* The open sea: the bubbles float in the scene behind */}
        {/* Its edges fade, so the bubbles come up out of the water and
            leave into it, instead of being cut by a hard line */}
        <div ref={arenaRef} style={{
          position: 'relative', flex: 1, minHeight: 200, overflow: 'hidden',
          WebkitMaskImage: SEA_MASK, maskImage: SEA_MASK,
        }}>
          {/* now and then a visitor swims through: a fish in one round, a dolphin in another */}
          {!reduce && phase === 'playing' && roundIdx % 2 === 1 && roundIdx !== giantRound && <Visitor key={roundIdx} art={roundIdx === 1 ? '🐠' : '🐬'} paused={paused} />}
          {aimAt && <div ref={anchorRef} aria-hidden="true" style={{ position: 'absolute', left: aimAt.x, top: aimAt.y, width: 2, height: 2 }} />}
          <AnimatePresence>
            {bubbles.map(bubble => {
              if (poppedIds.includes(bubble.id)) return null
              const off = bounced.includes(bubble.id)
              // after a miss the wished-for ones pulse once; when a round is
              // lost, they light up gold before the next round comes
              const reveal = phase === 'roundFail' && bubble.value === target && !bubble.giant
              const big = bubble.giant
              const pulse = (hint || reveal) && bubble.value === target && !off && !big
              return (
                <motion.button
                  key={bubble.id}
                  initial={big ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                  animate={off
                    // the boing: squashed flat, stretched tall, settling
                    ? { scale: 1, scaleX: [1, 1.35, 0.8, 1.12, 0.95], scaleY: [1, 0.68, 1.25, 0.9, 1.05], opacity: 1 }
                    : pulse ? { opacity: 1, scale: [1, 1.18, 1, 1.18, 1] } : { opacity: 1, scale: 1 }}
                  exit={{ scale: 1.6, opacity: 0, transition: { duration: 0.2 } }}
                  transition={off ? { duration: 0.42 } : pulse ? { duration: 1.1, repeat: reveal ? 1 : 0 } : { opacity: { duration: 0.3 }, scale: { type: 'spring', stiffness: 300, damping: 18 } }}
                  whileTap={off ? undefined : { scale: 1.25 }}
                  onClick={e => popBubble(bubble, e.currentTarget)}
                  aria-label={big ? 'Riesenblase' : bubble.value === 0 ? 'Party-Blase' : cfg.dots ? `${bubble.value} ${bubble.value === 1 ? 'Punkt' : 'Punkte'}` : `${bubble.value}`}
                  data-value={bubble.value}
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
                    background: big
                      ? 'radial-gradient(circle at 40% 35%, #dff4ff 0%, #8fd3ff 55%, #8e6cf0 100%)'
                      : `radial-gradient(circle at 40% 35%, ${bubble.tint}77 0%, ${bubble.tint}cc 60%, ${bubble.tint})`,
                    border: big ? '4px solid #2a1b3d' : '3px solid #2a1b3d',
                    boxShadow: reveal
                      ? '0 0 0 6px #ffc93c, 0 0 18px 8px rgba(255,201,60,0.8)'
                      : big ? 'inset 0 -10px 0 rgba(0,0,0,0.1), 0 0 0 5px rgba(255,253,247,0.55), 0 6px 0 rgba(42,27,61,0.35)'
                        : 'inset 0 -6px 0 rgba(0,0,0,0.12), 0 4px 0 rgba(42,27,61,0.35)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: bubble.size * (big ? 0.4 : 0.44), fontWeight: 800, color: '#fff',
                    // an ink outline keeps white digits readable on any tint
                    textShadow: '-2px -2px 0 #2a1b3d, 2px -2px 0 #2a1b3d, -2px 2px 0 #2a1b3d, 2px 2px 0 #2a1b3d, 0 3px 0 #2a1b3d',
                    cursor: 'pointer',
                    pointerEvents: off ? 'none' : undefined,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    zIndex: big ? 4 : 5,
                  }}
                >
                  <Shine />
                  <Face bubble={bubble} dots={cfg.dots} size={bubble.size} />
                </motion.button>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* The hand taps a wished-for bubble */}
      <HintHand key={`${roundIdx}-${aimAt?.x}`} to={anchorRef} active={phase === 'playing' && !!aimAt} delay={0} />
      {phase === 'finale' && (
        <Finale cast={['🐙', '🐠', '🐡', '🦀', '🐬', '🐳']} size={wide ? Math.min(110, stageH * 0.4) : 80}
          onDone={() => onComplete(result(roundsRef.current.filter(r => r === 'clean').length, ROUNDS))} />
      )}
      {bursts}
      {juice.layer}
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

// The stars the octopus juggles, circling over its head where its wish
// was (`room` px above it), not in front of its face
function Juggle({ n: all, size, room, still }) {
  const n = Math.min(all, 8)
  if (!n) return null
  const h = Math.min(room, size * 0.5)
  return (
    <motion.div aria-hidden="true" animate={still ? {} : { rotate: 360 }} transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
      style={{ position: 'absolute', left: '50%', top: -h + size * 0.02, width: size * 0.9, height: h, marginLeft: -size * 0.45, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2
        return (
          <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1, rotate: still ? 0 : -360 }}
            transition={{ scale: { type: 'spring', stiffness: 400 }, rotate: { duration: 2.4, repeat: Infinity, ease: 'linear' } }}
            style={{ position: 'absolute', left: `calc(50% + ${Math.cos(a) * size * 0.36}px - 15px)`, top: `calc(50% + ${Math.sin(a) * (h / 2 - 15)}px - 15px)` }}>
            <Art art="⭐" size={30} />
          </motion.div>
        )
      })}
    </motion.div>
  )
}

// A calm clock: a strip of sand that runs out
function Clock({ fraction, narrow }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 4, width: narrow ? 74 : 'clamp(90px,18vw,170px)' }}>
      <Art art="⏳" size={narrow ? 24 : 30} />
      <div style={{ flex: 1, height: 16, background: 'rgba(255,253,247,0.6)', border: '3px solid #2a1b3d', borderRadius: 10, overflow: 'hidden' }}>
        <motion.div animate={{ width: `${fraction * 100}%` }} transition={{ duration: 0.85 }}
          style={{ height: '100%', background: fraction > 0.5 ? '#5cc45a' : fraction > 0.25 ? '#ffc93c' : '#ff9f43' }} />
      </div>
    </div>
  )
}
