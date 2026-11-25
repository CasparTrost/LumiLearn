import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, MotionConfig, motionValue, useAnimationFrame, useMotionValue, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, leaveGame, lockPreviews } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { useBursts, useJuice, HintHand, useIdle } from '../components/play/index.js'
import { useLater } from './zahlen/stage.jsx'
import Korbmonster from './sort/Korbmonster.jsx'
import { Backdrop, Belt, Tonne, Thing } from './sort/parts.jsx'
import { planLevel, wordOf, groupWord, gameLine } from './sort/data.js'
import { layoutFor, aimAt, throwArc, arcAt, freeSpot, SIGN_H, AIM_MIN } from './sort/layout.js'

/**
 * Sortier-Spaß: "Fließband-Füttern" — grouping things, later by a property.
 *
 * The belt never stops: things come out of the pipe on the left and ride to
 * the right, several at once. Each basket monster shows on its sign what it
 * eats (two or three pictures of its group). The child flings every thing
 * to the monster that eats it: drag it and let go in the monster's
 * direction (the monster that would get it opens its mouth while the finger
 * moves), or tap the thing and then the monster. The thing flies in a bow,
 * the monster munches, gets a little fatter, and the bar on its rim fills.
 *
 *   • The wrong monster spits the thing back onto the belt ("Bäh!") and the
 *     right one waves. After two wrong throws of one thing its monster
 *     keeps waving until it is fed.
 *   • A thing that reaches the end of the belt falls into the pipe and
 *     comes out again at the start (a bump travels back through the pipe):
 *     nothing is lost, only the streak ends.
 *   • The belt gets a little faster with every thing fed at the first
 *     throw, and slower after a wrong throw or when something falls into
 *     the pipe. Never more things ride than the level allows (two at
 *     level 1).
 *   • A child who waits: the belt stands still and a hand shows the throw.
 *   • A golden thing now and then: fed, it gives a shower of stars.
 *
 * The level is done when every monster is full; then they burp one after
 * the other and dance. Levels (sort/data.js): two monsters with groups far
 * apart, then three, then four with groups close together (fruit and
 * vegetables), then a property instead of a group (round / with corners,
 * big / small, lives / does not live), and at the end a bin for rubbish
 * that belongs to nobody. Score: things fed at the first throw.
 *
 * The stars, the streak and its notes come from the game-feel kit
 * (components/play/Juice.jsx). A small loop moves the things through
 * MotionValues; with reduced motion the belt stands still, the things wait
 * on it, and a throw is a short straight hop.
 */

const PIPE_S = 1.2        // seconds a thing needs back through the pipe
const FLING = 0.008       // × S px per ms: faster than this, a drag is a fling
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = t => 1 - (1 - t) * (1 - t)
// what the child can pick up, and what is on the table for the level's limit
const GRABBABLE = new Set(['belt', 'picked'])
const AWAY = new Set(['pipe', 'gone', 'drop'])
let lumpSeq = 0

export default function SortGame({ level = 1, onComplete }) {
  const [plan] = useState(() => planLevel(level))
  const n = plan.targets.length
  const total = plan.things.length
  const byId = useMemo(() => Object.fromEntries(plan.things.map(t => [t.id, t])), [plan])
  const reduce = useReducedMotion()
  const { later, afterSpeech, paused } = useLater()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [bursts, burst] = useBursts()

  // The play area, and where everything stands in it
  const rootRef = useRef(null)
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const el = rootRef.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setBox(b => (b && b.w === w && b.h === h ? b : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const L = useMemo(() => box && layoutFor(box.w, box.h, n), [box, n])
  const LRef = useRef(L)
  LRef.current = L

  const juice = useJuice({ hudSize: L?.hud.size ?? 40 })
  const { hit, miss, shake } = juice   // these three never change

  // What moves, between two renders: every thing's place and what it is
  // doing — pipe (waiting in the pipe) · rise (coming out) · belt · held
  // (in the hand) · picked (tapped, held up) · fly (to a target) · stuck
  // (in the wrong basket for a moment) · back (to the belt) · drop (into
  // the pipe) · gone (eaten)
  const sim = useRef(null)
  if (!sim.current) {
    sim.current = {
      t: 0, v: 0, roll: 0, factor: 1, hold: false, lastSpawn: 0, ptr: null,
      queue: plan.things.map(t => t.id),
      th: Object.fromEntries(plan.things.map(t => [t.id, { id: t.id, mode: 'pipe', x: -300, y: -300, rot: 0, sc: 1, k: 0, wrongs: 0, missed: false, backAt: null }])),
      mv: Object.fromEntries(plan.things.map(t => [t.id, { x: motionValue(-300), y: motionValue(-300), r: motionValue(0), s: motionValue(1) }])),
      gaze: plan.targets.map(() => ({ x: motionValue(0), y: motionValue(0) })),
    }
  }
  const roll = useMotionValue(0)
  const [, setVer] = useState(0)
  const bump = useCallback(() => setVer(v => v + 1), [])

  const [phase, setPhase] = useState('play')      // play · finale
  const phaseRef = useRef(phase)
  const [fed, setFed] = useState(() => plan.targets.map(() => []))   // what each target got
  const fedRef = useRef(fed)
  const [moods, setMoods] = useState(() => plan.targets.map(() => 'idle'))
  const moodSeq = useRef(plan.targets.map(() => 0))
  const [aim, setAim] = useState(-1)              // the target a drag points at
  const aimRef = useRef(-1)
  const [picked, setPickedState] = useState(null) // the thing held up after a tap
  const pickedRef = useRef(null)
  const setPicked = id => { pickedRef.current = id; setPickedState(id) }
  const [lumps, setLumps] = useState([])          // things on their way back through the pipe
  const [hint, setHint] = useState(null)          // what the hand shows: { id, to, tap }
  const drag = useRef(null)
  const firstTry = useRef(0)
  const fedCount = useRef(0)
  const finished = useRef(false)
  const targetEls = useRef([])
  const thingEls = useRef({})
  const pipeIn = useRef(null)
  const hintFrom = useRef(null)
  const hintTo = useRef(null)

  useEffect(() => () => leaveGame(), [])

  // A target's mood, back to idle after `ms` (0: it stays)
  const setMood = useCallback((i, m, ms = 1000) => {
    const seq = ++moodSeq.current[i]
    setMoods(l => l.map((x, j) => (j === i ? m : x)))
    if (ms) later(ms, () => { if (moodSeq.current[i] === seq) setMoods(l => l.map((x, j) => (j === i ? 'idle' : x))) })
  }, [later])

  // Lumi names the monsters once the recordings exist (silent until then):
  // each hops as its word is said. Picking up a thing ends it.
  useEffect(() => {
    lockPreviews()
    const first = gameLine(plan.targets.some(t => t.kind === 'bin') ? 'tonne' : plan.level >= 7 ? 'schilder' : 'start')
    const words = plan.targets.map((t, i) => ({ i, w: groupWord(t.key) })).filter(x => x.w)
    const say = k => {
      if (k >= words.length) return
      setMood(words[k].i, 'happy', 800)
      narrate([words[k].w], { onEnd: () => later(150, () => say(k + 1)) })
    }
    if (first) later(400, () => narrate([first], { onEnd: () => say(0) }))
    else if (words.length) later(400, () => say(0))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A new size of the play area (the phone was turned): what rides moves along
  const lastL = useRef(null)
  useLayoutEffect(() => {
    const a = lastL.current
    lastL.current = L
    if (!a || !L || a === L) return
    for (const p of Object.values(sim.current.th)) {
      if (p.mode === 'belt' || p.mode === 'picked') {
        p.x = L.belt.x0 + ((p.x - a.belt.x0) / (a.belt.x1 - a.belt.x0)) * (L.belt.x1 - L.belt.x0)
        p.y = L.belt.rideY
      } else if (p.mode === 'fly' || p.mode === 'stuck') {
        p.to = { ...L.targets[p.target].mouth }
        p.ctrl = throwArc(L, p.from, p.to)
      } else if (p.mode === 'back') {
        p.to = { x: clamp(p.to.x, L.belt.x0, L.belt.x1 - L.S), y: L.belt.rideY }
        p.ctrl = throwArc(L, p.from, p.to)
      }
    }
  }, [L])

  // ── What happens to a thing ──────────────────────────────────────────────

  const ridingAt = () => Object.values(sim.current.th).filter(p => p.mode === 'belt' || p.mode === 'rise').map(p => p.x)
    .concat(Object.values(sim.current.th).filter(p => p.mode === 'back').map(p => p.to.x))

  const flight = (p, to, ctrl, dur, spin, sc) => {
    p.from = { x: p.x, y: p.y }
    p.to = to
    p.ctrl = ctrl
    p.k = 0
    p.dur = reduce ? 0.12 : dur
    p.spin = reduce ? 0 : spin
    p.rot0 = p.rot
    p.sc0 = p.sc
    p.sc1 = sc
  }

  // Back onto the belt, where there is room
  const putDown = id => {
    const p = sim.current.th[id], L = LRef.current
    if (!L || AWAY.has(p.mode)) return
    const x = freeSpot(L, p.x, ridingAt())
    flight(p, { x, y: L.belt.rideY }, { x: (p.x + x) / 2, y: Math.min(p.y, L.belt.rideY) - L.S * 0.25 }, 0.2, 0, 1)
    p.mode = 'back'
    if (pickedRef.current === id) setPicked(null)
    bump()
  }

  const throwTo = (id, i) => {
    const p = sim.current.th[id], L = LRef.current
    if (!L) return
    const to = { ...L.targets[i].mouth }
    const d = Math.hypot(to.x - p.x, to.y - p.y)
    flight(p, to, throwArc(L, p, to), clamp(0.34 + d / 1300, 0.42, 0.8), to.x >= p.x ? 360 : -360, 0.72)
    p.target = i
    p.mode = 'fly'
    if (pickedRef.current === id) setPicked(null)
    sfx.whoosh()
    bump()
  }

  // The wrong monster spits it back onto the belt
  const spit = id => {
    const p = sim.current.th[id], L = LRef.current
    if (!L || p.mode !== 'stuck') return
    const to = { x: freeSpot(L, p.x, ridingAt()), y: L.belt.rideY }
    flight(p, to, throwArc(L, p, to), 0.6, -360, 1)
    p.mode = 'back'
    sfx.pop()
    bump()
  }

  const finale = () => {
    phaseRef.current = 'finale'
    setPhase('finale')
    setHint(null)
    const mid = () => { const r = rootRef.current.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height * 0.4 } }
    // one burp after the other, then everybody dances
    plan.targets.forEach((t, i) => later(800 + i * 340, () => { setMood(i, 'burp', 0); sfx.burp(); shake(0.5) }))
    const t0 = 800 + n * 340 + 300
    later(t0, () => { sfx.tada(); plan.targets.forEach((t, i) => setMood(i, 'dance', 0)); burst(mid(), 'confetti', 24) })
    later(t0 + 900, () => { burst(mid(), 'stars', 14); sfx.combo(6) })
    later(t0 + 1800, () => burst(mid(), 'confetti', 20))
    later(t0 + (reduce ? 1400 : 2900), () => {
      if (finished.current) return
      finished.current = true
      onComplete(result(firstTry.current, total))
    })
  }

  // A thrown thing has arrived at target `p.target`
  const landed = t => {
    const s = sim.current, p = s.th[t.id], i = p.target
    const el = targetEls.current[i]
    if (t.to !== i) {
      // Not for this one: it pulls a face and spits the thing back onto the
      // belt; the monster it belongs to waves. No longer right at the first throw.
      p.missed = true
      p.wrongs += 1
      p.mode = 'stuck'
      s.factor = Math.max(0.7, s.factor - 0.18)
      setMood(i, 'bah', 1100)
      sfx.boing()
      miss(el)
      // (the thing's name, said when it was picked up, is not cut off)
      afterSpeech(() => sayWrong())
      later(reduce ? 80 : 340, () => spit(t.id))
      later(450, () => setMood(t.to, 'point', 1700))
      return
    }
    p.mode = 'gone'
    if (!p.missed) { firstTry.current += 1; s.factor = Math.min(1.45, s.factor + 0.05) }
    fedCount.current += 1
    const list = fedRef.current.map((l, j) => (j === i ? [...l, t] : l))
    fedRef.current = list
    setFed(list)
    const { milestone } = hit(el, { stars: t.golden ? 5 : 1 })
    setMood(i, 'chomp', 700)
    if (plan.targets[i].kind === 'bin') { sfx.drum(true); sfx.bump() } else sfx.chomp()
    if (t.golden) {
      sfx.sparkle()
      burst(el, 'stars', 16)
      later(260, () => burst(el, 'confetti', 14))
    } else burst(el, 'stars', 5)
    // a streak: the others cheer along
    if (milestone) plan.targets.forEach((x, j) => j !== i && setMood(j, 'happy', 800))
    afterSpeech(() => sayRight())
    if (fedCount.current >= total) { finale(); return }
    if (list[i].length >= plan.targets[i].need) later(750, () => { setMood(i, 'burp', 800); sfx.burp(); shake(0.4) })
  }

  // It rode off the end of the belt: into the pipe and round again
  const dropped = () => {
    sim.current.factor = Math.max(0.7, sim.current.factor - 0.12)
    sfx.slideDown()
    miss(pipeIn.current)
  }

  // ── The loop ─────────────────────────────────────────────────────────────

  const tick = delta => {
    const L = LRef.current, s = sim.current
    if (!L || pausedRef.current) return
    const dt = Math.min(delta, 50) / 1000
    const near = rate => Math.min(1, dt * rate)
    s.t += dt
    const playing = phaseRef.current === 'play'
    const S = L.S, rideY = L.belt.rideY
    const len = L.belt.x1 - L.belt.x0
    const cap = Math.max(2, Math.min(plan.cap, Math.floor(len / (S * 1.35))))

    // the belt: faster while things go well, still while the hand shows the throw
    // (a short belt, a phone held upright, is crossed sooner, but not in proportion)
    const cross = plan.cross * clamp(len / (S * 6), 0.6, 1)
    const want = !playing || reduce || s.hold ? 0 : (len / cross) * s.factor
    s.v += (want - s.v) * near(5)
    if (want === 0 && s.v < 1) s.v = 0
    s.roll += s.v * dt
    roll.set(s.roll)

    let changed = false
    for (const t of plan.things) {
      const p = s.th[t.id]
      if (p.mode === 'gone') continue
      if (p.mode === 'pipe') {
        if (p.backAt != null && s.t >= p.backAt) { p.backAt = null; s.queue.unshift(t.id) }
      } else if (p.mode === 'rise') {
        p.k = Math.min(1, p.k + dt / 0.45)
        const e = easeOut(p.k)
        p.x = lerp(L.pipe.left.x, L.belt.x0, e)
        p.y = lerp(L.pipe.left.y + S * 0.3, rideY, e) - Math.sin(Math.PI * p.k) * S * 0.5
        p.sc = 0.4 + 0.6 * e
        p.rot = (1 - e) * -50
        if (p.k >= 1) { p.mode = 'belt'; changed = true }
      } else if (p.mode === 'belt') {
        p.x += s.v * dt
        p.y = rideY
        p.sc += (1 - p.sc) * near(12)
        p.rot += (0 - p.rot) * near(12)
        if (p.x >= L.belt.x1) { p.mode = 'drop'; p.k = 0; p.from = { x: p.x, y: p.y }; changed = true; dropped() }
      } else if (p.mode === 'drop') {
        p.k = Math.min(1, p.k + dt / 0.5)
        p.x = lerp(p.from.x, L.pipe.right.x, easeOut(p.k))
        p.y = p.from.y + (L.pipe.right.y + S * 0.35 - p.from.y) * p.k * p.k - Math.sin(Math.PI * p.k) * S * 0.22
        p.rot = 220 * p.k
        p.sc = 1 - 0.5 * p.k
        if (p.k >= 1) {
          p.mode = 'pipe'
          p.backAt = s.t + PIPE_S
          const id = ++lumpSeq
          setLumps(l => [...l, { id, s: PIPE_S }])
          later(PIPE_S * 1000 + 100, () => setLumps(l => l.filter(x => x.id !== id)))
          changed = true
        }
      } else if (p.mode === 'held') {
        // under the finger at first, then a little above it, so it can be seen
        const q = s.ptr
        q.ox += (0 - q.ox) * near(8)
        q.oy += (-S * 0.3 - q.oy) * near(8)
        const nx = p.x + (q.x + q.ox - p.x) * near(30)
        p.rot += (clamp((nx - p.x) * 1.8, -24, 24) - p.rot) * near(10)
        p.x = nx
        p.y += (q.y + q.oy - p.y) * near(30)
        p.sc += (1.18 - p.sc) * near(14)
      } else if (p.mode === 'picked') {
        p.y += (rideY - S * 0.4 + (reduce ? 0 : Math.sin(s.t * 5) * 4) - p.y) * near(14)
        p.sc += (1.15 - p.sc) * near(14)
        p.rot = reduce ? 0 : Math.sin(s.t * 3.4) * 6
      } else if (p.mode === 'stuck') {
        p.x = p.to.x + (reduce ? 0 : Math.sin(s.t * 46) * 3)
      } else if (p.mode === 'fly' || p.mode === 'back') {
        p.k = Math.min(1, p.k + dt / p.dur)
        const at = arcAt(p.from, p.ctrl, p.to, p.k)
        p.x = at.x
        p.y = at.y
        p.rot = lerp(p.rot0, p.spin, p.k)
        p.sc = lerp(p.sc0, p.sc1, p.k)
        if (p.k >= 1) {
          changed = true
          if (p.mode === 'fly') landed(t)
          else { p.mode = 'belt'; p.rot = 0 }
        }
      }
    }

    // riding things keep apart: the one behind waits
    const riding = Object.values(s.th).filter(p => p.mode === 'belt').sort((a, b) => b.x - a.x)
    for (let i = 1; i < riding.length; i++) {
      if (riding[i - 1].x - riding[i].x < S * 1.02) riding[i].x = Math.max(L.belt.x0 - S * 0.3, riding[i - 1].x - S * 1.02)
    }

    // the next thing comes out of the pipe: never more than the level
    // allows, and only when the start of the belt is free
    if (playing && s.queue.length && s.t - s.lastSpawn > 0.6) {
      const all = Object.values(s.th)
      const live = all.filter(p => !AWAY.has(p.mode)).length
      if (live < cap) {
        if (reduce) {
          // the belt stands still: straight onto a free place
          const taken = ridingAt()
          const slot = Array.from({ length: cap }, (x, i) => L.belt.x0 + ((i + 0.5) * (len - S)) / cap)
            .find(x => taken.every(o => Math.abs(o - x) >= S))
          if (slot != null) {
            const p = s.th[s.queue.shift()]
            Object.assign(p, { mode: 'belt', x: slot, y: rideY, sc: 1, rot: 0 })
            s.lastSpawn = s.t
            changed = true
          }
        } else {
          const gap = Math.max(S * 1.5, len / (cap + 1.5))
          const free = all.every(p => !(p.mode === 'belt' || p.mode === 'rise' || p.mode === 'back') || (p.mode === 'back' ? p.to.x : p.x) > L.belt.x0 + gap)
          if (free) {
            const p = s.th[s.queue.shift()]
            Object.assign(p, { mode: 'rise', k: 0, x: L.pipe.left.x, y: L.pipe.left.y + S * 0.3, sc: 0.4, rot: -50 })
            s.lastSpawn = s.t
            sfx.flip()
            changed = true
          }
        }
      }
    }

    for (const t of plan.things) {
      const p = s.th[t.id], m = s.mv[t.id]
      if (p.mode === 'pipe' || p.mode === 'gone') continue
      m.x.set(p.x); m.y.set(p.y); m.r.set(p.rot); m.s.set(p.sc)
    }

    // the monsters' eyes: on what flies to them, else on what is in the
    // child's hand, else on whatever rides past
    plan.targets.forEach((tg, i) => {
      if (tg.kind !== 'monster') return
      const r = L.targets[i]
      const ex = r.x + r.w / 2, ey = r.y + r.w * (SIGN_H + 0.54)
      let f = null, rank = 9, dist = Infinity
      for (const p of Object.values(s.th)) {
        if (p.mode === 'pipe' || p.mode === 'gone') continue
        const k = p.mode === 'fly' && p.target === i ? 0 : p.mode === 'held' ? 1 : p.mode === 'picked' ? 2 : p.mode === 'fly' || p.mode === 'back' || p.mode === 'stuck' ? 3 : 4
        const d = Math.hypot(p.x - ex, p.y - ey)
        if (k < rank || (k === rank && d < dist)) { f = p; rank = k; dist = d }
      }
      let gx = 0, gy = 0
      if (f) { const m = Math.min(1, dist / (S * 1.2)) / (dist || 1); gx = (f.x - ex) * m; gy = (f.y - ey) * m }
      const g = s.gaze[i]
      g.x.set(g.x.get() + (gx - g.x.get()) * near(10))
      g.y.set(g.y.get() + (gy - g.y.get()) * near(10))
    })

    // the monster the drag points at opens its mouth
    const d = drag.current
    if (d) {
      const a = aimAt(L, d.start, d.at, flinging(d, performance.now()))
      if (a !== aimRef.current) { aimRef.current = a; setAim(a) }
    }

    if (changed) bump()
  }
  const tickRef = useRef(tick)
  tickRef.current = tick
  useAnimationFrame(useCallback((time, delta) => tickRef.current(delta), []))

  // ── The child's hand ─────────────────────────────────────────────────────

  const local = e => { const r = rootRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }

  const pick = id => {
    const p = sim.current.th[id]
    p.mode = 'picked'
    setPicked(id)
    bump()
  }

  const grab = (t, e) => {
    const s = sim.current, p = s.th[t.id]
    if (phaseRef.current !== 'play' || pausedRef.current || drag.current || !GRABBABLE.has(p.mode)) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* an old browser: the window still gets the moves */ }
    const at = local(e)
    const other = pickedRef.current
    if (other && other !== t.id) putDown(other)
    drag.current = { id: t.id, pid: e.pointerId, start: at, at, far: 0, was: p.mode, speed: 0, moved: e.timeStamp }
    s.ptr = { x: at.x, y: at.y, ox: p.x - at.x, oy: p.y - at.y }
    p.mode = 'held'
    sfx.pop()
    // Lumi says what it is, where the word is recorded: "Banane."
    narrate([wordOf(t.name)])
    bump()
  }
  // Is the finger flinging (fast, just now) or resting? By the clock of
  // the events themselves, so a busy frame does not turn a fling into a rest.
  const flinging = (d, now) => now - d.moved < 90 && d.speed > LRef.current.S * FLING
  const move = e => {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    const at = local(e), now = e.timeStamp
    const v = Math.hypot(at.x - d.at.x, at.y - d.at.y) / Math.max(1, now - d.moved)
    d.speed = d.speed * 0.4 + v * 0.6
    d.moved = now
    d.at = at
    d.far = Math.max(d.far, Math.hypot(at.x - d.start.x, at.y - d.start.y))
    sim.current.ptr.x = at.x
    sim.current.ptr.y = at.y
  }
  const release = (e, cancelled) => {
    const d = drag.current
    if (!d || e.pointerId !== d.pid) return
    drag.current = null
    aimRef.current = -1
    setAim(-1)
    if (sim.current.th[d.id].mode !== 'held') return
    if (cancelled) { putDown(d.id); return }
    const L = LRef.current
    const a = aimAt(L, d.start, local(e), flinging(d, e.timeStamp))
    if (a >= 0) throwTo(d.id, a)
    // hardly moved: a tap. The thing is held up for a tap on a monster; a
    // second tap on it puts it back.
    else if (d.far < L.S * AIM_MIN && d.was !== 'picked') pick(d.id)
    else putDown(d.id)
  }

  const tapTarget = i => {
    if (phaseRef.current !== 'play' || pausedRef.current) return
    const id = pickedRef.current
    if (id && sim.current.th[id].mode === 'picked') { throwTo(id, i); return }
    // empty hands: a tickle, and its word
    sfx.giggle()
    setMood(i, 'happy', 800)
    narrate([groupWord(plan.targets[i].key)])
  }

  // with the keyboard: Enter on a thing holds it up, Enter on a monster throws
  const keyThing = (t, e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    const p = sim.current.th[t.id]
    if (phaseRef.current !== 'play' || pausedRef.current) return
    if (p.mode === 'picked') putDown(t.id)
    else if (p.mode === 'belt') {
      const other = pickedRef.current
      if (other) putDown(other)
      narrate([wordOf(t.name)])
      pick(t.id)
    }
  }

  // a tap beside everything puts the held-up thing back
  const tapStage = e => {
    if (e.target.closest('[data-thing],[data-target]')) return
    if (pickedRef.current) putDown(pickedRef.current)
  }

  // ── A child who waits: the belt stands still, a hand shows the throw ────
  const idle = useIdle(plan.level <= 2 && fedCount.current === 0 ? 2600 : 7000, phase === 'play' && !paused && !!L)
  useEffect(() => {
    sim.current.hold = idle
    if (!idle) { setHint(null); return }
    const find = () => {
      const s = sim.current
      const up = pickedRef.current
      const id = up ?? Object.values(s.th).filter(p => p.mode === 'belt').sort((a, b) => b.x - a.x)[0]?.id
      setHint(h => (!id ? null : h?.id === id && h.tap === !!up ? h : { id, to: byId[id].to, tap: !!up }))
    }
    find()
    const iv = setInterval(find, 700)
    return () => clearInterval(iv)
  }, [idle, byId])
  hintFrom.current = hint ? thingEls.current[hint.id] : null
  hintTo.current = hint ? targetEls.current[hint.to] : null

  // ── What each target shows ───────────────────────────────────────────────
  const s = sim.current
  const flyingTo = new Set(), helping = new Set()
  for (const t of plan.things) {
    const p = s.th[t.id]
    if (p.mode === 'fly') flyingTo.add(p.target)
    // after two wrong throws its monster waves until it is fed
    if (p.wrongs >= 2 && !AWAY.has(p.mode) && p.mode !== 'fly') helping.add(t.to)
  }
  const moodOf = i => (moods[i] !== 'idle' ? moods[i]
    : phase !== 'play' ? 'idle'
    : aim === i || flyingTo.has(i) ? 'hungry'
    : helping.has(i) ? 'point'
    : picked ? 'ready'
    : fed[i].length >= plan.targets[i].need ? 'full' : 'idle')

  const S = L?.S ?? 80
  const grip = 6   // a thing can be grabbed a little beside its picture

  return (
    <MotionConfig reducedMotion="user">
      <div ref={el => { rootRef.current = el; juice.stage.current = el }} onPointerDown={tapStage}
        data-phase={phase} data-level={plan.level} data-fed={fedCount.current} data-total={total} data-first={firstTry.current}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}>
        {L && (
          <>
            <Backdrop L={L} />
            <div style={{ position: 'absolute', right: L.pad, top: L.hud.y, zIndex: 8 }}>{juice.hud}</div>

            {plan.targets.map((tg, i) => {
              const r = L.targets[i], mood = moodOf(i)
              return (
                <button key={tg.key} type="button" className="fb-target" ref={el => { targetEls.current[i] = el }} onClick={() => tapTarget(i)}
                  aria-label={tg.label} data-target={i} data-kind={tg.kind} data-mood={mood} data-have={fed[i].length} data-need={tg.need}
                  style={{ left: r.x, top: r.y, width: r.w, height: r.h, zIndex: 2 }}>
                  {tg.kind === 'bin'
                    ? <Tonne width={r.w} need={tg.need} have={fed[i].length} mood={mood} />
                    : <Korbmonster width={r.w} tint={tg.tint} look={tg.look} mood={mood} need={tg.need} gaze={s.gaze[i]}
                        sign={{ pics: tg.sign, label: tg.label, scale: tg.signScale }}
                        items={fed[i].map(t => ({ id: t.id, node: <Thing thing={{ ...t, golden: false }} size={r.w * 0.3} /> }))} />}
                </button>
              )
            })}

            <Belt L={L} roll={roll} lumps={lumps} pipeIn={pipeIn} />

            {plan.things.map(t => {
              const p = s.th[t.id]
              if (p.mode === 'pipe' || p.mode === 'gone') return null
              const m = s.mv[t.id]
              const up = p.mode === 'held' || p.mode === 'picked' || p.mode === 'fly' || p.mode === 'back' || p.mode === 'stuck'
              return (
                <motion.div key={t.id} className="fb-thing" role="button" tabIndex={GRABBABLE.has(p.mode) ? 0 : -1} aria-label={t.name}
                  ref={el => { thingEls.current[t.id] = el }} data-thing={t.id} data-to={t.to} data-mode={p.mode} data-golden={t.golden ? 1 : undefined}
                  onPointerDown={e => grab(t, e)} onPointerMove={move} onPointerUp={e => release(e, false)} onPointerCancel={e => release(e, true)}
                  onKeyDown={e => keyThing(t, e)}
                  style={{
                    x: m.x, y: m.y, rotate: m.r, scale: m.s, width: S + 2 * grip, height: S + 2 * grip, padding: grip, boxSizing: 'border-box',
                    marginLeft: -(S / 2 + grip), marginTop: -(S / 2 + grip), zIndex: up ? 30 : p.mode === 'belt' ? 7 : 5,
                    pointerEvents: GRABBABLE.has(p.mode) || p.mode === 'held' ? 'auto' : 'none',
                    filter: up ? 'drop-shadow(0 10px 6px rgba(42,27,61,0.3))' : 'drop-shadow(0 3px 0 rgba(42,27,61,0.25))',
                  }}>
                  <Thing thing={t} size={S} picked={p.mode === 'picked'} />
                </motion.div>
              )
            })}
          </>
        )}
        {/* the hand: the thing nearest the end to the monster that eats it,
            or a tap on that monster when the thing is held up already */}
        <HintHand key={hint ? `${hint.id}-${hint.tap}` : 'none'} from={hint && !hint.tap ? hintFrom : undefined} to={hintTo} active={!!hint && phase === 'play'} delay={0} />
        {bursts}
        {juice.layer}
      </div>
    </MotionConfig>
  )
}
