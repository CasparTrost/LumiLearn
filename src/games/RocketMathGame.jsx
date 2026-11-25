import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { Critter, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { leaveGame, lockPreviews, narrate } from '../narrator.js'
import { LINES, line } from '../lib/lumiLines.js'
import { numberWord } from '../lib/words.js'
import { sayRight, sayTask, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { useLater } from './zahlen/stage.jsx'
import { ALIEN_HUES, MINUS, PLUS, TOP, buildTasks, countChoices, dirOf, freeGap, judge, levelPlan, residentOf } from './rakete/tasks.js'
import { bow, clamp, hopPath, layout } from './rakete/layout.js'
import {
  AlienPic, BonusStar, CountBubble, GOLD, HopArcs, INK, LandButton, Moon, Planet, Rocket, SIGN_COLOR, ThrustButton, windowSpots,
} from './rakete/parts.jsx'

/**
 * Rechen-Rakete — "Planeten-Hüpfer": plus and minus as counting on and
 * counting back on the number line
 *
 * The planets 0 … 10 are the number line. An alien shows a sum ("4 + 2");
 * the rocket lands on planet 4 by itself, and the 4 of the sum lights up
 * with it. The child flies the rocket:
 *
 *   • Levels 1–6 (hop). Every press on the flame button is one hop to the
 *     next planet: a gold arc is drawn, numbered (1, 2 …), and Lumi says
 *     the planet the rocket touches down on. When it has hopped far enough
 *     the child presses the green tick (or taps the rocket) and it lands.
 *     Right: the alien pops out of its planet, cheers and climbs in. Wrong:
 *     someone else lives there and shakes its head; the arcs stay, the
 *     sum's second number pulses with the number of arcs beside it (one hop
 *     too many), and the rocket flies back to the start. Minus has a
 *     backward button; from level 5 both come mixed, each marked with its
 *     sign, and a hop back along the last arc takes that arc back.
 *   • Levels 7–8 (tap). No buttons: the child taps the planet where the
 *     rocket will land and it flies there in one go, drawing the arcs as
 *     proof. Worked out in the head.
 *   • Level 9 (count). "4 + ▢ = 7": the alien waves from planet 7. The
 *     child hops there, lands, and then says how many hops it took with one
 *     of three number bubbles. A wrong bubble: the arcs count themselves.
 *   • Level 10 (pick). The same with minus too, and the other way round:
 *     the child picks the number of hops first and the rocket proves it.
 *
 * The alien's planet is never marked before the rocket lands right (every
 * planet has a door, the alien comes out of the right one). After two
 * misses the way is drawn as a dashed path. Bonus stars hang between some
 * planets and are collected by flying through them. Everyone picked up
 * looks out of one of the rocket's windows; at the end of the level the
 * rocket takes them all to the moon.
 *
 * Why this: moving a token one field per unit along a linear number line
 * builds the mental number line and measurably helps later arithmetic
 * (Siegler & Ramani 2009); counting on and counting back are the first
 * strategies for adding and taking away (Carpenter & Moser 1984), and the
 * missing addend ("4 + ? = 7") is the harder, later step.
 *
 * Score: sums solved on the first landing (and, in level 9, the first
 * bubble).
 */

const HOP_MS = 430           // one hop of the thrust button
const FAST_MS = 240          // one hop of a flight in one go
const BACK_MS = 700          // back to the start after a miss
const ENTER_MS = 850         // to the start of a new sum
const STAR_COUNT = 2         // bonus stars on the line at a time
let seq = 0

const rec = key => (LINES[key] ? line(key) : null)
// Lumi's lines for this game; silent until they are recorded
const SAY = {
  [PLUS]: 'rakete/plus', [MINUS]: 'rakete/minus', equals: 'rakete/gleich',
  hop: 'rakete/huepf', back: 'rakete/zurueck', tap: 'rakete/tippen', howMany: 'rakete/wie-viele',
  far: 'rakete/zu-weit', short: 'rakete/zu-kurz', wrongway: 'rakete/andersrum',
}
const INTRO = { 1: 'hop', 4: 'back', 5: 'back', 7: 'tap', 9: 'hop', 10: 'howMany' }

export default function RocketMathGame({ level = 1, onComplete }) {
  const plan = useMemo(() => levelPlan(level), [level])
  const [tasks] = useState(() => buildTasks(level))
  const total = tasks.length
  const reduce = useReducedMotion()
  const paused = usePaused()
  const { later, afterSpeech } = useLater()
  const juice = useJuice({ hudSize: 36 })
  const { hit, miss, shake } = juice
  const [bursts, burst] = useBursts()

  const rootRef = useRef(null)
  const [size, setSize] = useState(null)
  const L = useMemo(() => (size ? layout(size.w, size.h) : null), [size])

  const [idx, setIdx] = useState(0)
  const [phase, setPhaseState] = useState('enter')  // enter | play | fly | land | count | won | finale
  const [pos, setPos] = useState(null)              // the planet the rocket stands on
  const [arcs, setArcs] = useState([])              // the hops of this try: [{ id, a, b }]
  const [glow, setGlow] = useState(0)               // the start lights up (planet and number together)
  const [ghost, setGhost] = useState(false)         // after two misses: the way, dashed
  const [badge, setBadge] = useState(null)          // after a miss: how many arcs it was
  const [opPulse, setOpPulse] = useState(0)         // the wrong way: look at the sign
  const [thrustPulse, setThrustPulse] = useState({ op: null, k: 0 })
  const [creature, setCreature] = useState(null)    // who comes out of a planet: { n, kind, art, key, boarding }
  const [waiting, setWaiting] = useState(false)     // levels 9–10: the alien waves from its planet
  const [cheer, setCheer] = useState(0)
  const [filled, setFilled] = useState(false)       // the empty box of the sum is filled
  const [riders, setRiders] = useState([])          // the passengers' colours
  const [stars, setStars] = useState([])            // bonus stars: the gaps they hang over
  const [flame, setFlame] = useState(0)
  const [bubbles, setBubbles] = useState(false)     // "how many hops?"
  const [choices, setChoices] = useState([])
  const [tried, setTried] = useState([])            // bubbles or planets that were wrong
  const [counting, setCounting] = useState(-1)      // a wrong bubble: the arcs count themselves
  const [finale, setFinale] = useState(null)        // { landed }

  const task = tasks[idx]
  const d = dirOf(task.op)
  const missing = plan.mode === 'count' || plan.mode === 'pick'
  const hue = ALIEN_HUES[idx % ALIEN_HUES.length]

  // What the timers and the taps work on; the state above is its picture
  const g = useRef({ phase: 'enter', pos: null, air: false, queue: [], arcs: [], misses: 0, firstTry: 0, stars: [], idx: 0, done: false }).current
  const S = useRef({}).current
  Object.assign(S, { L, task, idx, plan, reduce, paused, hue })
  const setPhase = p => { g.phase = p; setPhaseState(p) }

  // The rocket: where its feet are, how it leans, how squashed it is
  const rx = useMotionValue(-999), ry = useMotionValue(-999), rot = useMotionValue(0), sq = useMotionValue(1)
  const rocketX = useTransform(rx, v => v - (L?.rw ?? 0) / 2)
  const rocketY = useTransform(ry, v => v - (L?.rh ?? 0))
  const rocketRot = useTransform(rot, v => (L?.base ?? 0) + v)
  const anims = useRef(new Set())
  const run = a => { anims.current.add(a); a.then?.(() => anims.current.delete(a)); return a }
  useEffect(() => () => { anims.current.forEach(a => a.stop?.()); leaveGame() }, [])

  const rocketRef = useRef(null)
  const plusRef = useRef(null), minusRef = useRef(null), landRef = useRef(null)
  const bubbleRef = useRef(null), startRef = useRef(null), targetRef = useRef(null)

  // ── The size of the play area ──
  useLayoutEffect(() => {
    const el = rootRef.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setSize(s => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // a new size: the rocket stands where it stood
  useLayoutEffect(() => {
    if (!L || g.air || g.pos == null || g.phase === 'finale') return
    const p = L.P(g.pos, L.pr)
    rx.set(p.x); ry.set(p.y)
  }, [L]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Flying ──────────────────────────────────────────────────────────────

  const squash = (k = 1) => {
    if (S.reduce) return
    run(animate(sq, [1, 1 - 0.22 * k, 1 + 0.08 * k, 1], { duration: 0.32 }))
  }

  // One bow from planet a to planet b (a === b: straight up and down)
  const flight = (a, b, { ms, high = 1, onDone }) => {
    const Lx = S.L
    const path = hopPath(Lx, a, b, high)
    const dir = Math.sign(b - a) || 1
    g.air = true
    setFlame(1)
    if (S.reduce) {
      rx.set(path.b.x); ry.set(path.b.y); rot.set(0)
      later(140, () => { g.air = false; setFlame(0); onDone?.() })
      return
    }
    run(animate(sq, [1, 0.8, 1.12, 1], { duration: Math.min(0.34, ms / 1000) }))
    // leaning into the hop, then back for the landing, upright at both ends
    const fly = run(animate(0, 1, {
      duration: ms / 1000, ease: [0.4, 0, 0.5, 1],
      onUpdate: t => {
        const p = bow(path.a, path.c, path.b, t)
        rx.set(p.x); ry.set(p.y)
        // on a phone held upright the rocket lies on its side on the planet;
        // in the air it turns its nose the way it flies (up for plus)
        if (Lx.vertical) rot.set(a === b ? 0 : -dir * 90 * Math.min(1, 2.5 * Math.sin(Math.PI * t)))
        else rot.set(a === b ? 0 : Lx.lean * dir * 22 * Math.sin(2 * Math.PI * t))
      },
    }))
    later(ms, () => {
      fly.stop()
      rx.set(path.b.x); ry.set(path.b.y); rot.set(0)
      g.air = false
      setFlame(0)
      squash(0.8)
      onDone?.()
    })
  }

  // A star over the gap a hop flies through goes to the counter
  const collect = gap => {
    if (!g.stars.includes(gap)) return
    g.stars = g.stars.filter(x => x !== gap)
    setStars(g.stars)
    const r = rootRef.current.getBoundingClientRect(), p = S.L.P(gap + 0.5, starOff(S.L))
    hit({ x: r.left + p.x, y: r.top + p.y }, { silent: true })
    sfx.sparkle()
  }

  // One hop to the next planet; the arc goes with it (or, back along the
  // last arc, that arc is taken back)
  const hopOnce = (op, ms, onDone) => {
    const a = g.pos, b = a + dirOf(op)
    const last = g.arcs[g.arcs.length - 1]
    if (last && last.b === a && last.a === b) g.arcs = g.arcs.slice(0, -1)
    else g.arcs = [...g.arcs, { id: ++seq, a, b }]
    setArcs(g.arcs)
    sfx.whoosh()
    later(ms * 0.5, () => collect(Math.min(a, b)))
    flight(a, b, {
      ms,
      onDone: () => {
        g.pos = b
        setPos(b)
        sfx.bump()
        onDone?.(b)
      },
    })
  }

  // Many hops in a row, quickly: the flight in one go (levels 7, 8, 10)
  const flyTo = (n, onDone) => {
    const op = n > g.pos ? PLUS : MINUS
    const step = () => {
      if (g.pos === n) { onDone(); return }
      hopOnce(op, FAST_MS, step)
    }
    step()
  }

  // ── The child's moves ───────────────────────────────────────────────────

  const nudge = () => {
    if (S.reduce) return
    run(animate(rot, [0, -8, 8, -4, 0], { duration: 0.4 }))
  }

  const thrust = op => {
    if (g.phase !== 'play' || S.paused) return
    // presses in the air wait their turn: three quick presses are three hops
    if (g.air) { if (g.queue.length < 6) g.queue.push(op); return }
    const b = g.pos + dirOf(op)
    if (b < 0 || b > TOP) { sfx.bonk(); nudge(); return }
    hopOnce(op, HOP_MS, n => {
      narrate([numberWord(n)])
      const q = g.queue.shift()
      if (q === 'land') { g.queue = []; land() }
      else if (q) thrust(q)
    })
  }

  const land = () => {
    if (g.phase !== 'play' || S.paused) return
    if (g.air) { if (!g.queue.includes('land')) g.queue.push('land'); return }
    if (g.pos === S.task.from) { nudge(); return }
    settle(g.pos)
  }

  const tapPlanet = n => {
    if (g.phase !== 'play' || S.paused || g.air) return
    if (n === g.pos) { nudge(); sfx.boing(); return }
    setPhase('fly')
    flyTo(n, () => settle(n))
  }

  const pick = k => {
    if (g.phase !== 'play' || S.paused || g.air) return
    setPhase('fly')
    setBubbles(false)
    g.picked = k
    flyTo(S.task.from + dirOf(S.task.op) * k, () => settle(g.pos))
  }

  // ── Landing: who lives here? ────────────────────────────────────────────

  const settle = n => {
    setPhase('land')
    shake(0.35)
    // a flight in one go says only where it ended (a hop says every planet)
    if (S.plan.mode === 'tap' || S.plan.mode === 'pick') narrate([numberWord(n)])
    const verdict = judge(S.task, n)
    if (verdict === 'right') { right(); return }
    wrong(verdict, n)
  }

  const right = () => {
    if (S.plan.mode === 'count') {
      // at the alien's planet: now how many hops was it?
      setCheer(c => c + 1)
      sfx.slideUp()
      later(700, () => {
        setPhase('count')
        setChoices(countChoices(S.task))
        setBubbles(true)
        afterSpeech(() => narrate([rec(SAY.howMany)]), 200)
      })
      return
    }
    won()
  }

  const won = () => {
    const first = g.misses === 0
    if (first) g.firstTry += 1
    setPhase('won')
    setFilled(true)
    setBadge(null)
    setGhost(false)
    setBubbles(false)
    const { milestone } = hit(rocketRef.current, { stars: first ? 2 : 1 })
    sayRight()
    const t = S.task
    if (!missing) setCreature({ n: t.target, kind: 'alien', key: ++seq })
    else setCheer(c => c + 1)
    sfx.sparkle()
    if (milestone) burst(rocketRef.current, 'confetti', 16)
    // the alien jumps in, then the next sum
    later(1000, () => {
      if (missing) setWaiting('board')
      else setCreature({ n: t.target, kind: 'alien', key: seq, boarding: true })
      later(S.reduce ? 50 : 520, () => {
        setCreature(null)
        setWaiting(false)
        setRiders(r => [...r, S.hue])
        sfx.pop()
        squash(0.6)
        afterSpeech(next, 650)
      })
    })
  }

  const wrong = (verdict, n) => {
    g.misses += 1
    const t = S.task
    miss(rocketRef.current)
    sayWrong()
    const hint = rec(SAY[verdict])
    if (hint) afterSpeech(() => narrate([hint]), 0)
    setCreature({ n, kind: 'resident', art: residentOf(n), key: ++seq })
    // how many hops it was, beside the number it should have been; not in
    // levels 9–10: there that number is the empty box, and counting the hops
    // is the child's task
    const badgeHere = S.plan.mode === 'hop' || S.plan.mode === 'tap'
    if (verdict === 'wrongway') {
      setOpPulse(p => p + 1)
      if (S.plan.mode === 'hop') setThrustPulse(p => ({ op: t.op, k: p.k + 1 }))
    } else if (badgeHere) setBadge({ count: Math.abs(n - t.from), key: seq })
    if (S.plan.mode === 'pick') setTried(l => [...l, g.picked])
    if (S.plan.mode === 'tap') setTried(l => [...l, n])
    later(1900, () => {
      setCreature(null)
      sfx.whoosh()
      flight(n, t.from, {
        ms: BACK_MS, high: 1 + Math.abs(n - t.from) * 0.2,
        onDone: () => {
          g.pos = t.from
          setPos(t.from)
          g.arcs = []
          setArcs([])
          setBadge(null)
          if (g.misses >= 2) setGhost(true)
          if (S.plan.mode === 'pick') setBubbles(true)
          setPhase('play')
        },
      })
    })
  }

  // Level 9: how many hops was it?
  const confirm = (k, el) => {
    if (g.phase !== 'count' || S.paused) return
    if (k === S.task.step) { won(); return }
    g.misses += 1
    setTried(l => [...l, k])
    miss(el)
    sayWrong()
    // the arcs count themselves, one after the other
    setPhase('land')
    afterSpeech(() => {
      const n = g.arcs.length
      for (let i = 0; i < n; i++) later(i * 650, () => { setCounting(i); narrate([numberWord(i + 1)]); sfx.note(i) })
      // the numbers stay now: that is the help
      later(n * 650 + 400, () => { setCounting(99); setPhase('count') })
    }, 200)
  }

  // ── Sums one after the other ────────────────────────────────────────────

  const next = () => {
    if (S.idx + 1 >= total) { toTheMoon(); return }
    setIdx(i => i + 1)
  }

  // A new sum: the rocket flies to its start, the start lights up
  useEffect(() => {
    if (!L) return
    const t = tasks[idx]
    g.arcs = []; g.misses = 0; g.queue = []; g.idx = idx
    setArcs([]); setGhost(false); setBadge(null); setFilled(false); setTried([]); setBubbles(false); setCounting(-1)
    setPhase('enter')
    lockPreviews()
    sayTask()
    // a star or two to fly through
    while (g.stars.length < STAR_COUNT) g.stars = [...g.stars, freeGap(g.stars)]
    setStars(g.stars)
    const from = g.pos ?? -2.5
    if (g.pos == null) { const p = L.P(from, L.pr); rx.set(p.x); ry.set(p.y) }
    sfx.whoosh()
    later(idx === 0 ? 350 : 0, () => flight(from, t.from, {
      ms: g.pos == null ? ENTER_MS + 200 : ENTER_MS, high: g.pos === t.from ? 1.2 : 1 + Math.min(4, Math.abs(t.from - from)) * 0.25,
      onDone: () => {
        g.pos = t.from
        setPos(t.from)
        setGlow(k => k + 1)
        sfx.bump()
        if (plan.mode === 'count' || plan.mode === 'pick') setWaiting(true)
        const intro = idx === 0 && INTRO[level] ? rec(SAY[INTRO[level]]) : null
        const op = rec(SAY[t.op]), eq = rec(SAY.equals)
        const sum = !missing
          ? (op ? [numberWord(t.from), op, numberWord(t.step)] : [numberWord(t.from)])
          : (op && eq ? [numberWord(t.from), op, { ...eq, gap: 350 }, numberWord(t.target)] : [numberWord(t.from)])
        afterSpeech(() => narrate([intro, ...sum]), 0)
        later(250, () => {
          setPhase('play')
          if (plan.mode === 'pick') { setChoices(countChoices(t)); setBubbles(true) }
        })
      },
    }))
  }, [idx, L == null]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The end of the level: everybody to the moon ──
  const toTheMoon = () => {
    setPhase('finale')
    setFinale({ landed: false })
    g.arcs = []
    setArcs([])
    g.stars = []
    setStars([])
    sfx.slideUp()
    const Lx = S.L
    const from = { x: rx.get(), y: ry.get() }
    const to = { x: Lx.moon.x, y: Lx.moon.y - Lx.moon.r * 0.8 }
    const c = { x: (from.x + to.x) / 2, y: Math.max(Lx.rh * 0.9, Math.min(from.y, to.y) - Lx.rh * 1.2) }
    later(500, () => {
      setFlame(1)
      sfx.whoosh()
      if (S.reduce) { rx.set(to.x); ry.set(to.y); rot.set(-Lx.base) }
      else run(animate(0, 1, {
        duration: 1.5, ease: [0.45, 0, 0.4, 1],
        onUpdate: t => { const p = bow(from, c, to, t); rx.set(p.x); ry.set(p.y); rot.set(-Lx.base * Math.min(1, t * 1.4) + 18 * Math.sin(Math.PI * t)) },
      }))
      later(S.reduce ? 200 : 1550, () => {
        setFlame(0)
        squash(1.2)
        shake(0.6)
        sfx.tada()
        setFinale({ landed: true })
        const r = rootRef.current.getBoundingClientRect()
        burst({ x: r.left + to.x, y: r.top + Lx.moon.y }, 'confetti', 26)
        later(800, () => burst({ x: r.left + to.x, y: r.top + Lx.moon.y }, 'stars', 14))
        later(2700, () => afterSpeech(() => { if (!g.done) { g.done = true; onComplete(result(g.firstTry, total)) } }, 0))
      })
    })
  }

  // ── Drawing ─────────────────────────────────────────────────────────────

  const ready = !!L
  const vertical = L?.vertical
  const playing = phase === 'play'
  const hopMode = plan.mode === 'hop' || plan.mode === 'count'
  const showControls = hopMode && !bubbles && phase !== 'finale' && phase !== 'count' && counting < 0
  // the hint hand: the first sum of a level shows the move soon, later only a long wait
  const handDelay = idx === 0 && level <= 7 ? 2500 : 7000
  // the tap levels: at the first sum the hand shows the move once, from the
  // rocket along the line to the planet it lands on; after two misses it
  // taps the end of the dashed way
  const tapDemo = plan.mode === 'tap' && idx === 0 && !ghost
  const handTo = !ready || phase === 'finale' ? null
    : bubbles ? bubbleRef
    : plan.mode === 'tap' ? (ghost || tapDemo ? targetRef : null)
    : ghost && pos === task.target ? landRef
    : ghost ? (task.target > pos ? plusRef : minusRef)
    // the right button only where there is one sign: the sign is the lesson of the mixed levels
    : arcs.length === 0 && plan.ops.length === 1 ? (task.op === PLUS ? plusRef : minusRef)
    : null
  const ghostHops = ghost && L ? Array.from({ length: task.step }, (_, i) => ({ a: task.from + d * i, b: task.from + d * (i + 1) })) : []

  return (
    <div ref={el => { rootRef.current = el; juice.stage.current = el }}
      data-game="rakete" data-phase={phase} data-mode={plan.mode} data-idx={idx} data-pos={pos ?? ''}
      data-from={task.from} data-target={task.target} data-step={task.step} data-op={task.op === PLUS ? 'plus' : 'minus'}
      style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}>
      {ready && (
        <>
          {/* the flight path along the planets */}
          <svg aria-hidden="true" width={L.w} height={L.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
            <line x1={L.P(0).x} y1={L.P(0).y} x2={L.P(TOP).x} y2={L.P(TOP).y} stroke="rgba(255,255,255,0.35)" strokeWidth="4" strokeDasharray="2 10" strokeLinecap="round" />
          </svg>

          {/* the planets */}
          {Array.from({ length: TOP + 1 }, (_, n) => {
            const p = L.P(n)
            const isStart = pos === task.from && n === task.from && phase !== 'finale'
            const tapCell = plan.mode === 'tap' && phase !== 'finale'
            // a finger-wide cell, reaching out to the rocket's side (above, or to the right)
            const box = vertical
              ? { left: p.x - L.pr - 4, top: p.y - L.cell / 2, width: L.pd + 38, height: L.cell, paddingLeft: 4, justifyContent: 'flex-start', alignItems: 'center' }
              : { left: p.x - L.cell / 2, top: p.y - L.pr - 40, width: L.cell, height: L.pd + 40, justifyContent: 'center', alignItems: 'flex-end' }
            const Cell = tapCell ? motion.button : 'div'
            const dim = plan.mode === 'tap' && tried.includes(n)
            return (
              <Cell key={n} data-planet={n}
                {...(tapCell && { type: 'button', 'aria-label': `Planet ${n}`, onClick: () => tapPlanet(n), whileTap: playing ? { scale: 0.9 } : undefined })}
                style={{
                  all: tapCell ? 'unset' : undefined, position: 'absolute', boxSizing: 'border-box', display: 'flex', ...box,
                  cursor: tapCell && playing ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent',
                }}>
                <motion.div key={`${n}-${isStart ? glow : 0}`} style={{ opacity: dim ? 0.55 : 1 }}
                  animate={isStart && !reduce ? { scale: [1, 1.22, 1, 1.12, 1] } : {}} transition={{ duration: 0.9 }}>
                  <Planet n={n} size={L.pd} glow={isStart} home={creature?.n === n} />
                </motion.div>
              </Cell>
            )
          })}
          {/* where the hint hand of the tap levels starts and taps: the start and the alien's planet */}
          <span ref={startRef} aria-hidden="true" style={{ position: 'absolute', left: L.P(task.from).x, top: L.P(task.from).y, width: 2, height: 2 }} />
          <span ref={targetRef} aria-hidden="true" style={{ position: 'absolute', left: L.P(task.target).x, top: L.P(task.target).y, width: 2, height: 2 }} />

          {/* the arcs: the way flown, numbered; after two misses the way to fly, dashed */}
          <svg aria-hidden="true" width={L.w} height={L.h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {ghostHops.map((h, i) => {
              const q = hopPath(L, h.a, h.b)
              return <path key={`g${i}`} d={`M${q.a.x} ${q.a.y} Q${q.c.x} ${q.c.y} ${q.b.x} ${q.b.y}`} fill="none" stroke="#fff" strokeWidth="4" strokeDasharray="7 8" strokeLinecap="round" opacity="0.85" />
            })}
            <AnimatePresence>
              {arcs.map(h => {
                const q = hopPath(L, h.a, h.b)
                return (
                  <motion.path key={h.id} d={`M${q.a.x} ${q.a.y} Q${q.c.x} ${q.c.y} ${q.b.x} ${q.b.y}`} fill="none"
                    stroke={GOLD} strokeWidth="6" strokeLinecap="round" style={{ filter: 'drop-shadow(0 0 5px rgba(255,201,60,0.9))' }}
                    initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1, opacity: 1 }} exit={{ opacity: 0 }}
                    transition={{ pathLength: { duration: (plan.mode === 'hop' || plan.mode === 'count' ? HOP_MS : FAST_MS) / 1000, ease: [0.4, 0, 0.5, 1] } }} />
                )
              })}
            </AnimatePresence>
          </svg>
          {/* the count on the arcs */}
          <AnimatePresence>
            {arcs.map((h, i) => {
              // level 9: the hops are counted by the child; the numbers come
              // when the arcs count themselves (a wrong bubble) or it was right
              if (plan.mode === 'count' && i > counting && phase !== 'won') return null
              const p = L.P((h.a + h.b) / 2, L.pr + L.arcH + 14)
              const s = vertical ? 24 : 28
              return (
                <motion.span key={`n${h.id}`} aria-hidden="true" data-arc={i + 1}
                  initial={reduce ? false : { scale: 0 }} animate={{ scale: counting === i ? [1, 1.6, 1.2] : 1 }} exit={{ scale: 0, opacity: 0 }}
                  transition={{ delay: counting === i ? 0 : (plan.mode === 'hop' || plan.mode === 'count' ? HOP_MS : FAST_MS) / 2000, type: counting === i ? 'tween' : 'spring', stiffness: 500, damping: 18 }}
                  style={{
                    position: 'absolute', left: p.x - s / 2, top: p.y - s / 2, width: s, height: s, borderRadius: '50%', zIndex: 4,
                    background: counting === i ? '#fff' : GOLD, border: `3px solid ${INK}`, boxSizing: 'border-box',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                    fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: s * 0.6, lineHeight: 1, color: INK,
                  }}>{i + 1}</motion.span>
              )
            })}
          </AnimatePresence>

          {/* bonus stars between planets */}
          <AnimatePresence>
            {stars.map(gap => {
              const p = L.P(gap + 0.5, starOff(L))
              const s = clamp(L.cell * 0.42, 26, 38)
              return (
                <motion.div key={`s${gap}`} aria-hidden="true" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 1.8, opacity: 0 }}
                  style={{ position: 'absolute', left: p.x - s / 2, top: p.y - s / 2, width: s, height: s, pointerEvents: 'none', zIndex: 1 }}>
                  <BonusStar size={s} />
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* levels 9–10: the alien waits on its planet, where the rocket will stand */}
          <AnimatePresence>
            {waiting && phase !== 'finale' && (
              <WaitingAlien key={`w${idx}`} L={L} n={task.target} hue={hue} cheer={cheer} rocketHere={pos === task.target} reduce={reduce}
                boarding={waiting === 'board' && seatPoint(L, rx.get(), ry.get(), riders.length, total)} />
            )}
          </AnimatePresence>

          {/* the rocket */}
          <motion.div ref={rocketRef} data-rocket=""
            onPointerDown={() => { if (hopMode && g.phase === 'play' && arcs.length) land() }}
            style={{
              position: 'absolute', left: 0, top: 0, width: L.rw, height: L.rh, x: rocketX, y: rocketY, rotate: rocketRot,
              transformOrigin: '50% 100%', zIndex: 5, cursor: hopMode && playing && arcs.length ? 'pointer' : 'default',
            }}>
            <motion.div style={{ width: '100%', height: '100%', scaleY: sq, transformOrigin: '50% 100%' }}>
              <Rocket w={L.rw} h={L.rh} seats={total} riders={finale?.landed ? [] : riders} flame={flame} upright={vertical && !finale?.landed ? 90 : 0} newest={riders.length - 1} />
            </motion.div>
          </motion.div>

          {/* who comes out of the planet */}
          <AnimatePresence>
            {creature && <Creature key={creature.key} c={creature} L={L} hue={hue} seat={riders.length} seats={total} reduce={reduce} rx={rx} ry={ry} />}
          </AnimatePresence>

          {/* the sum */}
          <AnimatePresence>
            {phase !== 'finale' && (
              <motion.div key="card" exit={{ opacity: 0, y: -30 }}
                style={{ position: 'absolute', left: L.card.x, top: L.card.y, width: L.card.w, height: L.card.h, display: 'flex', alignItems: 'center', justifyContent: L.short ? 'flex-start' : 'center', pointerEvents: 'none', zIndex: 3 }}>
                <SumCard L={L} task={task} idx={idx} missing={missing} guide={plan.guide || ghost} filled={filled}
                  glow={glow} badge={badge} opPulse={opPulse} hue={hue} showAlien={!missing && !(creature?.kind === 'alien')} reduce={reduce} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* the star counter */}
          <div style={{ position: 'absolute', top: L.hud.y, ...(L.hud.align === 'right' ? { right: L.w - L.hud.x } : L.hud.align === 'left' ? { left: L.hud.x } : { left: L.hud.x, transform: 'translateX(-50%)' }), zIndex: 6 }}>
            {juice.hud}
          </div>

          {/* the buttons */}
          <AnimatePresence>
            {showControls && (
              <motion.div key="controls" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
                style={{
                  position: 'absolute', left: L.controls.x, top: L.controls.y, width: L.controls.w, height: L.controls.h, zIndex: 6,
                  display: 'flex', alignItems: 'center', justifyContent: L.controls.justify, gap: vertical ? 12 : clamp(L.w * 0.03, 14, 40),
                }}>
                {vertical ? (
                  <>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {plan.ops.includes(PLUS) && <ThrustButton op={PLUS} way="up" size={L.btn} onPress={() => thrust(PLUS)} btnRef={plusRef} pulse={thrustPulse.op === PLUS ? thrustPulse.k : 0} />}
                      {plan.ops.includes(MINUS) && <ThrustButton op={MINUS} way="down" size={L.btn} onPress={() => thrust(MINUS)} btnRef={minusRef} pulse={thrustPulse.op === MINUS ? thrustPulse.k : 0} />}
                    </div>
                    <LandButton size={L.btn} onPress={land} disabled={!arcs.length || !playing} btnRef={landRef} />
                  </>
                ) : (
                  <>
                    {plan.ops.includes(MINUS) && <ThrustButton op={MINUS} way="left" size={L.btn} onPress={() => thrust(MINUS)} btnRef={minusRef} pulse={thrustPulse.op === MINUS ? thrustPulse.k : 0} />}
                    <LandButton size={L.btn} onPress={land} disabled={!arcs.length || !playing} btnRef={landRef} />
                    {plan.ops.includes(PLUS) && <ThrustButton op={PLUS} way="right" size={L.btn} onPress={() => thrust(PLUS)} btnRef={plusRef} pulse={thrustPulse.op === PLUS ? thrustPulse.k : 0} />}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* how many hops? */}
          <AnimatePresence>
            {bubbles && phase !== 'finale' && (
              <motion.div key={`b${idx}`} exit={{ opacity: 0 }}
                style={{
                  position: 'absolute', left: L.controls.x, top: vertical ? L.h - 3 * (L.btn + 6) - 20 : L.controls.y, width: L.controls.w,
                  height: vertical ? 3 * (L.btn + 6) + 10 : L.controls.h, zIndex: 6,
                  display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: L.controls.justify, gap: vertical ? 6 : 18,
                }}>
                <div style={{ position: 'relative', display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 6 : 18 }}>
                  {/* the hint hand taps beside the row, never on a bubble */}
                  <span ref={bubbleRef} aria-hidden="true" style={{ position: 'absolute', ...(vertical ? { left: '-18%', top: '50%' } : { left: -40, top: '50%' }), width: 2, height: 2 }} />
                  {choices.map(k => (
                    <CountBubble key={k} k={k} size={L.btn} state={tried.includes(k) ? 'tried' : null}
                      onPress={(kk) => (plan.mode === 'pick' ? pick(kk) : confirm(kk, document.querySelector(`[data-count="${kk}"]`)))} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* the finale: the moon, and everybody out to dance on it */}
          <AnimatePresence>
            {finale && (
              <motion.div key="moon" aria-hidden="true" initial={reduce ? false : { scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 160, damping: 14 }}
                style={{ position: 'absolute', left: L.moon.x - L.moon.r, top: L.moon.y - L.moon.r, zIndex: 2, pointerEvents: 'none' }}>
                <Moon r={L.moon.r} />
              </motion.div>
            )}
          </AnimatePresence>
          {finale?.landed && <MoonParty L={L} riders={riders} reduce={reduce} />}

          {handTo && <HintHand key={tapDemo ? 'demo' : 'tap'} from={tapDemo ? startRef : undefined} to={handTo} delay={ghost ? 1500 : handDelay}
            active={(playing || phase === 'count') && !paused} />}
          {juice.layer}
          {bursts}
        </>
      )}
    </div>
  )
}

// How far from the line the bonus stars hang: where the rocket's body passes
const starOff = L => L.pr + L.arcH + L.rh * 0.62

// ── The sum ──────────────────────────────────────────────────────────────

function NumBlock({ n, size, bg, pulse, glowKey, empty, children, dataAttr }) {
  const reduce = useReducedMotion()
  const wide = String(n ?? '').length > 1
  return (
    <motion.span key={glowKey ?? pulse ?? 'still'} {...dataAttr}
      animate={!reduce && (pulse || glowKey) ? { scale: [1, 1.28, 1, 1.18, 1] } : {}} transition={{ duration: 0.9 }}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        minWidth: wide ? size * 1.3 : size, height: size * 1.12, padding: '0 4px', boxSizing: 'border-box', borderRadius: size * 0.24,
        background: empty ? 'rgba(255,255,255,0.35)' : bg, border: empty ? `3px dashed ${INK}` : `3px solid ${INK}`,
        boxShadow: empty ? 'none' : '0 4px 0 rgba(42,27,61,0.35)',
        fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.78, lineHeight: 1, color: INK,
      }}>
      {empty ? null : n}
      {children}
    </motion.span>
  )
}

function SumCard({ L, task, idx, missing, guide, filled, glow, badge, opPulse, hue, showAlien, reduce }) {
  const nb = L.nb
  // the two signs need keys of their own: with one key for both, a pulse
  // of the operator left a stale copy of it behind ("5 + + 4 =")
  const sign = (key, s, pulse, color) => (
    <motion.span key={key} animate={pulse && !reduce ? { scale: [1, 1.6, 1, 1.4, 1] } : {}} transition={{ duration: 1 }}
      style={{ display: 'inline-block', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: nb * 0.95, lineHeight: 1, color: color ?? '#fff', WebkitTextStroke: `2px ${INK}`, padding: '0 2px' }}>{s}</motion.span>
  )
  const stepBlock = (
    <span style={{ position: 'relative', display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <NumBlock n={task.step} size={nb} bg="#ffe08a" pulse={badge?.key} empty={missing && !filled} dataAttr={{ 'data-sum': 'step' }} />
      {/* one little arc per hop, in the first levels and after two misses */}
      {!missing && guide && (
        <span style={{ position: 'absolute', top: '100%', marginTop: 4 }}><HopArcs k={task.step} width={Math.min(nb * 1.5, nb * 0.5 * task.step)} height={nb * 0.3} color={GOLD} /></span>
      )}
      {/* after a miss: how many hops it was, beside the number it should have been */}
      <AnimatePresence>
        {badge && (
          <motion.span key={badge.key} initial={{ scale: 0, x: -10 }} animate={{ scale: 1, x: 0 }} exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 16 }}
            data-badge={badge.count}
            style={{
              position: 'absolute', left: '50%', top: '100%', marginTop: 2, translate: '-50% 0', padding: '3px 8px 2px', borderRadius: 999, background: GOLD,
              border: `3px solid ${INK}`, boxShadow: '0 3px 0 rgba(42,27,61,0.35)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: nb * 0.5, lineHeight: 1, color: INK, zIndex: 2, whiteSpace: 'nowrap',
            }}>
            {badge.count}
            <HopArcs k={badge.count} width={Math.min(nb * 1.1, 11 * badge.count)} height={nb * 0.18} color={INK} />
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
  const sum = (
    <div aria-label={`${task.from} ${task.op} ${missing ? (filled ? task.step : 'wie viel') : task.step} = ${missing || filled ? task.target : 'wie viel'}`}
      style={{ display: 'flex', alignItems: 'center', gap: Math.max(3, nb * 0.1), paddingBottom: !missing && guide ? nb * 0.36 : 0 }}>
      <NumBlock n={task.from} size={nb} bg="#d9ccff" glowKey={glow ? `g${glow}` : null} dataAttr={{ 'data-sum': 'from' }} />
      {sign(`op${opPulse}`, task.op, opPulse, SIGN_COLOR[task.op])}
      {stepBlock}
      {sign('eq', '=', 0)}
      <NumBlock n={task.target} size={nb} bg="#c8f0c0" empty={!missing && !filled} dataAttr={{ 'data-sum': 'result' }} />
    </div>
  )
  return (
    <motion.div key={idx} initial={reduce ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20 }}
      style={{
        display: 'flex', flexDirection: L.card.column ? 'column' : 'row', alignItems: 'center', gap: L.card.column ? 6 : 12,
        padding: L.short ? '4px 14px 4px 6px' : L.card.column ? '8px 10px 14px' : '10px 22px 14px 12px',
        background: 'rgba(255,253,247,0.95)', border: `3px solid ${INK}`, borderRadius: 22, boxShadow: '0 6px 0 rgba(0,0,0,0.3)',
        maxWidth: '100%', boxSizing: 'border-box',
      }}>
      {/* levels 9–10: the alien waits on its planet, not here */}
      {!missing && <div style={{ width: L.alien * (L.card.column ? 1 : 0.86), height: L.alien * (L.card.column ? 0.9 : 0.86), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <AnimatePresence>
          {showAlien && (
            <motion.div key="a" initial={reduce ? false : { scale: 0, rotate: -20 }} animate={reduce ? {} : { scale: 1, rotate: 0, y: [0, -4, 0] }}
              exit={{ scale: 0, opacity: 0 }} transition={{ y: { duration: 2.2, repeat: Infinity }, default: { type: 'spring', stiffness: 260, damping: 14 } }}>
              <AlienPic size={L.alien * (L.card.column ? 0.9 : 0.86)} hue={hue} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>}
      {sum}
    </motion.div>
  )
}

// ── Who comes out of a planet ────────────────────────────────────────────

// The middle of a window of the rocket, on screen, from where its feet are
function seatPoint(L, fx, fy, seat, seats) {
  const s = windowSpots(seats)[Math.min(seat, seats - 1)]
  const dx = (s.x - 50) * (L.rw / 100), dy = (s.y - 160) * (L.rh / 160)
  const a = (L.base * Math.PI) / 180
  return { x: fx + dx * Math.cos(a) - dy * Math.sin(a), y: fy + dx * Math.sin(a) + dy * Math.cos(a), r: s.r * (L.rw / 100) }
}

function Creature({ c, L, hue, seat, seats, reduce, rx, ry }) {
  const size = L.pd * 1.1
  // in front of the planet, a little away from the rocket's side
  const p = L.P(c.n, -L.pd * 0.08)
  const box = { position: 'absolute', left: p.x - size / 2, top: p.y - size / 2, width: size, height: size, zIndex: 7, pointerEvents: 'none' }
  if (c.kind === 'resident') {
    // smaller, peeking out of the door low on the right of the planet: the
    // planet's number stays in sight (where the rocket landed is the news)
    const rs = L.pd * 0.6, q = L.P(c.n)
    return (
      <motion.div data-creature="resident" initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 16 }}
        style={{ ...box, left: q.x + L.pd * 0.46 - rs / 2, top: q.y + L.pd * 0.4 - rs / 2, width: rs, height: rs, transformOrigin: '15% 20%' }}>
        <Critter art={c.art} size={rs} mood="oops" shadow={false} />
      </motion.div>
    )
  }
  const to = seatPoint(L, rx.get(), ry.get(), seat, seats)
  return (
    <motion.div data-creature="alien" initial={reduce ? false : { scale: 0, y: size * 0.3 }}
      animate={c.boarding
        ? { x: to.x - p.x, y: to.y - p.y, scale: (to.r * 2.6) / size, opacity: reduce ? 0 : [1, 1, 0.9] }
        : reduce ? { scale: 1 } : { scale: 1, y: [0, -size * 0.32, 0, -size * 0.14, 0], rotate: [0, -10, 10, 0, 0] }}
      exit={{ opacity: 0 }}
      transition={c.boarding ? { duration: 0.5, ease: 'easeIn' } : { duration: 0.9, scale: { type: 'spring', stiffness: 380, damping: 14 } }}
      style={box}>
      <AlienPic size={size} hue={hue} />
    </motion.div>
  )
}

// Levels 9–10: the alien stands on its planet and waves; it steps aside
// when the rocket comes down there
function WaitingAlien({ L, n, hue, cheer, rocketHere, reduce, boarding }) {
  const size = clamp(L.cell * 0.9, 50, 84)
  const side = n >= 8 ? -1 : 1
  const p = rocketHere ? L.P(n + side * 0.62, L.pr * 0.6) : L.P(n, L.pr - 6)
  const at = L.vertical ? { left: p.x - size * 0.1, top: p.y - size / 2 } : { left: p.x - size / 2, top: p.y - size }
  return (
    <motion.div data-alien-waiting={n} initial={reduce ? false : { scale: 0 }} exit={{ scale: 0, opacity: 0 }}
      animate={boarding
        // into the rocket, through its window
        ? { left: boarding.x - size / 2, top: boarding.y - size / 2, scale: (boarding.r * 2.6) / size, opacity: 0.9 }
        : { scale: 1, left: at.left, top: at.top }}
      transition={boarding ? { duration: reduce ? 0 : 0.5, ease: 'easeIn' } : { type: 'spring', stiffness: 300, damping: 18 }}
      style={{ position: 'absolute', width: size, height: size, zIndex: 6, pointerEvents: 'none', transformOrigin: boarding ? '50% 50%' : '50% 100%' }}>
      <motion.div key={cheer} animate={reduce ? {} : cheer ? { y: [0, -size * 0.4, 0, -size * 0.2, 0], rotate: [0, -12, 12, 0, 0] } : { rotate: [0, -4, 4, 0] }}
        transition={cheer ? { duration: 0.9 } : { duration: 1.8, repeat: Infinity }}>
        <AlienPic size={size} hue={hue} style={{ transform: L.vertical ? 'rotate(0deg)' : undefined }} />
      </motion.div>
    </motion.div>
  )
}

// The finale: everyone picked up hops out onto the moon and dances
function MoonParty({ L, riders, reduce }) {
  const { x, y, r } = L.moon
  const size = clamp(r * 0.62, 34, 60)
  const left = Math.ceil(riders.length / 2)
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, zIndex: 8, pointerEvents: 'none' }}>
      {riders.map((h, i) => {
        // standing round the top of the moon, half left and half right of the rocket
        const side = i < left ? 0 : 1, k = side ? i - left : i, n = side ? riders.length - left : left
        const f = n > 1 ? k / (n - 1) : 0.5
        const deg = side ? -64 + f * 54 : -116 - f * 54
        const a = (deg * Math.PI) / 180
        const ex = x + Math.cos(a) * r * 0.8, ey = y + Math.sin(a) * r * 0.8
        return (
          <motion.div key={i} initial={reduce ? false : { x: x - size / 2, y: y - r - size, scale: 0.2, opacity: 0 }}
            animate={{ x: ex - size / 2, y: ey - size, scale: 1, opacity: 1, rotate: (deg + 90) * 0.6 }}
            transition={{ delay: i * 0.12, type: 'spring', stiffness: 220, damping: 14 }}
            style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, transformOrigin: '50% 100%' }}>
            <motion.div animate={reduce ? {} : { y: [0, -size * 0.3, 0], rotate: [0, i % 2 ? 10 : -10, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: 0.6 + i * 0.09 }}>
              <AlienPic size={size} hue={h} />
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}
