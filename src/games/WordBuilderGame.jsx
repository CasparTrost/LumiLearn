import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, motionValue, useAnimationFrame, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { Art, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { leaveGame, lockPreviews } from '../narrator.js'
import { LINES, line } from '../lib/lumiLines.js'
import { announce, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { voice, KEY } from './woerter/voice.js'
import Finale from './woerter/Finale.jsx'
import { Water, Greenery, Pad, HopSpot, Ring, Splash, Drops, Tongue, Stork, STORK_PECK } from './frosch/Pond.jsx'
import { buildRounds, levelConfig } from './frosch/words.js'
import { clamp, stageLayout, hopSpots, padCells, shelfSlots } from './frosch/layout.js'
import { useLater, useStage } from './frosch/hooks.js'

/**
 * Silben-Spaß — "Frosch-Hüpfer": splitting a word into syllables, and
 * building a word from syllables
 *
 * A frog wants to cross the pond to the thing on the far bank (a banana).
 * Lumi says the word once.
 *
 *   • Hop rounds. Every tap on the pond is one hop: a lily pad comes up
 *     under the frog, and Lumi says the next syllable as it lands ("Ba" …
 *     "na" … "ne"). When the word is over, the child taps the thing and the
 *     frog leaps ashore to it. One hop too many: no syllable is left, no pad
 *     comes, splash. The thing tapped too early: the bank is still too far,
 *     the frog falls short, splash. It swims back, climbs out, shakes itself
 *     dry and starts again. From level 5 the hops are silent: the child has
 *     to split the word itself.
 *   • Build rounds. Lily pads with the word's syllables float in the pond
 *     in mixed order (from level 7 with wrong ones among them). A tap makes
 *     Lumi say the pad's syllable; if it is the one that comes next, the
 *     frog hops onto it, and from the last one ashore. A wrong pad dips
 *     under with a "blub" and comes up again. Hearing what a pad says is
 *     free; only tapping a wrong pad a second time counts as a miss.
 *
 * The pond is laid out for the word (frosch/layout.js): the last syllable's
 * pad is always one leap from the bank, so "too early" really is too far.
 * What was reached collects on the far shore, a star for each flies to the
 * counter (components/play/Juice.jsx). Flies cross the pond: a frog in the
 * air near one snaps it, for a bonus star. A child who waits long hears the
 * word again; then a stork wades up and taps what comes next with its beak.
 * After two splashes the pads of the word come up by themselves, each saying
 * its syllable, and stay.
 *
 * Why this: hearing and handling syllables is the first step of
 * phonological awareness and one of the best predictors of learning to read
 * (Adams 1990; Goswami & Bryant 1990). Segmenting comes before blending, and
 * a movement per syllable (clapping, hopping) is how kindergartens teach
 * it; here the hop is the game itself.
 *
 * The result: words crossed without a splash (hop rounds) or without
 * tapping a wrong pad twice (build rounds).
 */

const HOP_MS = 360
const LEAP_MS = 560
const HOME_MS = 720
const SETTLE_MS = 170          // after a landing, before the next hop
const REPEAT_MS = 6500         // waiting this long: Lumi says the word once more
const STORK_MS = 10000         // waiting this long: the stork sets out
const STORK_WALK_S = 4.5       // and takes this long to arrive
// Lines Lumi may get later; silent until they are recorded
const TASK = { hop: 'frosch-huepfen', build: 'frosch-bauen', alone: 'frosch-allein' }
let seq = 0

export default function WordBuilderGame({ level = 1, onComplete }) {
  const cfg = useMemo(() => levelConfig(level), [level])
  const [rounds] = useState(() => buildRounds(level))
  const total = rounds.length
  const paused = usePaused()
  const reduce = useReducedMotion()
  const { later, afterSpeech } = useLater()
  const [bursts, burst] = useBursts()

  const rootRef = useRef(null)
  const size = useStage(rootRef)
  const L = useMemo(() => (size ? stageLayout(size.w, size.h, size.scale) : null), [size])
  const juice = useJuice({ hudSize: L?.hudSize ?? 40 })
  const { hit, miss, shake } = juice   // these three never change

  const [idx, setIdx] = useState(0)
  const [phase, setPhaseState] = useState('intro')   // intro | play | busy | won | finale
  const [hops, setHops] = useState(0)                // syllables behind the frog
  const [up, setUp] = useState(0)                    // hop rounds: pads that have come up
  const [shown, setShown] = useState(0)              // … and how many of them show their syllable
  const [padFx, setPadFx] = useState({})             // per pad: { bump, dip, done }
  const [help, setHelp] = useState(false)            // after two misses: the way is shown
  const [hint, setHint] = useState(null)             // what the stork points at: 'spot' | 'thing' | a pad's id
  const [frogMode, setFrogMode] = useState('sit')    // sit | under | swim
  const [tongue, setTongue] = useState(null)
  const [flyOn, setFlyOn] = useState(false)
  const [stork, setStork] = useState(null)           // { flip, walking, peck }
  const [shelf, setShelf] = useState([])             // what was reached, on the far shore
  const [flyer, setFlyer] = useState(null)           // the thing on its way there
  const [joy, setJoy] = useState(0)
  const [fxs, setFxs] = useState([])                 // rings, splashes, drops

  const round = rounds[idx]
  const n = round.syllables.length
  const isHop = round.kind === 'hop'
  const spots = useMemo(() => (L ? hopSpots(L, n) : null), [L, n])
  const cells = useMemo(() => (L ? padCells(L, cfg.drift) : null), [L, cfg.drift])
  const slots = useMemo(() => (L ? shelfSlots(L, total) : null), [L, total])
  // build pads float about their places
  const drift = useMemo(() => Object.fromEntries((round.pads ?? []).map(p => [p.id, { x: motionValue(0), y: motionValue(0) }])), [round])
  // The hand shows the move in the first round of its kind, in the levels where it is new
  const firstOfKind = rounds.findIndex(r => r.kind === round.kind) === idx
  const hand = firstOfKind && (isHop ? level <= 2 : level <= 4)

  // What the clock, the timers and the taps work on; the state above is its picture
  const g = useRef({
    phase: 'intro', hops: 0, next: 0, misses: 0, wrongRow: 0, heard: new Set(), done: new Set(), help: false,
    air: false, lock: 0, queued: null, at: 'home', t: 0, idle: 0, repeated: false, fly: null, stork: null, firstTry: 0, started: -1,
  }).current
  const S = useRef({}).current
  Object.assign(S, { L, round, n, isHop, spots, cells, slots, drift, cfg, idx, paused, reduce, hand })

  const thingRef = useRef(null)
  const bodyRef = useRef(null)
  const aimRef = useRef(null)
  const padEls = useRef({})

  // The frog: where its feet are, how high it is in the air, how squashed
  const fx = useMotionValue(-999), fy = useMotionValue(-999), lift = useMotionValue(0)
  const sx = useMotionValue(1), sy = useMotionValue(1), rot = useMotionValue(0), zoom = useMotionValue(1)
  const bodyY = useTransform(lift, v => -v)
  const shade = useTransform(lift, v => Math.max(0.45, 1 - v / 240))
  const flyX = useMotionValue(-99), flyY = useMotionValue(-99)
  const storkX = useMotionValue(-999), storkY = useMotionValue(-999)

  useEffect(() => leaveGame, [])

  const setPhase = p => { g.phase = p; setPhaseState(p) }
  const addFx = (kind, pt, sizeOf) => setFxs(l => [...l.slice(-7), { id: ++seq, kind, x: pt.x, y: pt.y, size: sizeOf }])
  const endFx = id => setFxs(l => l.filter(f => f.id !== id))
  const bumpPad = id => setPadFx(f => ({ ...f, [id]: { ...f[id], bump: (f[id]?.bump ?? 0) + 1 } }))

  // Where a place is right now: a bank, a hop spot, a build pad, or a plain point
  const padMiddle = id => {
    const p = S.round.pads.find(x => x.id === id), b = S.cells.at(p), d = S.drift[id]
    return { x: b.x + d.x.get(), y: b.y + d.y.get() }
  }
  const pointOf = at => {
    if (at === 'home') return S.L.home
    if (at === 'goal') return S.L.goal
    // on a pad the frog sits on the back half: the syllable is written on the front rim
    if (at.spot != null) { const p = S.spots.at(at.spot); return { x: p.x, y: p.y - S.spots.pad.h * 0.12 } }
    if (at.pad) { const p = padMiddle(at.pad); return { x: p.x, y: p.y - S.cells.pad.h * 0.12 } }
    return at
  }
  useLayoutEffect(() => {
    if (!L || g.air) return
    const p = pointOf(g.at)
    fx.set(p.x); fy.set(p.y)
  }, [L]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The jump: a springy arc, a squash on landing ──
  const jump = (at, { h = 60, ms = HOP_MS, spin = false, onLand } = {}) => {
    const to = pointOf(at)
    g.air = true
    g.at = at
    if (S.reduce) {
      fx.set(to.x); fy.set(to.y)
      later(120, () => { g.air = false; onLand?.() })
      return
    }
    const d = ms / 1000, T = d + 0.24, land = d / T, rest = 1 - land
    const times = [0, land * 0.2, land * 0.9, land + rest * 0.25, land + rest * 0.65, 1]
    animate(fx, to.x, { duration: d, ease: 'linear' })
    animate(fy, to.y, { duration: d, ease: 'linear' })
    animate(lift, [0, h, 0], { duration: d, times: [0, 0.5, 1], ease: ['easeOut', 'easeIn'] })
    animate(sy, [0.8, 1.16, 1.1, 0.76, 1.06, 1], { duration: T, times })
    animate(sx, [1.16, 0.9, 0.94, 1.2, 0.97, 1], { duration: T, times })
    // seen from above (a screen held upright) a jump comes towards the eye
    if (!S.L.wide) animate(zoom, [1, 1.18, 1], { duration: d, times: [0, 0.5, 1] })
    if (spin) animate(rot, [0, -360], { duration: d * 0.92, ease: 'easeInOut' }).then(() => rot.set(0))
    later(ms, () => { g.air = false; onLand?.() })
  }

  // ── A tap asks for a move; one tap made in the air is kept for the landing ──
  const act = () => {
    g.idle = 0
    const st = g.stork
    if (st && st.state !== 'go') {
      // the child is playing again: the stork turns round and wades off
      st.state = 'go'
      g.pinned = null
      setHint(null)
      setStork({ flip: !st.flip, walking: true, peck: 0 })
    }
  }
  const run = q => (q === 'hop' ? hop() : q === 'leap' ? leap() : tapPad(q.pad))
  const flush = () => {
    const q = g.queued
    g.queued = null
    if (q && g.phase === 'play' && !g.air) run(q)
  }
  const request = q => {
    if (g.phase !== 'play' || S.paused) return
    act()
    if (g.air) { g.queued = q; return }
    const wait = g.lock - g.t
    if (wait > 0) { g.queued = q; later(wait, flush); return }
    run(q)
  }

  // ── Hop rounds ──
  const hop = () => {
    const k = g.hops + 1
    if (k > S.n) {
      // one hop too many: no syllable is left, no pad comes up
      setPhase('busy')
      jump({ spot: k }, { h: S.spots.lift, onLand: splash })
      return
    }
    setUp(u => Math.max(u, k))
    if (S.cfg.speak || g.help) later(HOP_MS * 0.4, () => voice([KEY.syllable(S.round.syllables[k - 1])]))
    jump({ spot: k }, { h: S.spots.lift, onLand: () => {
      g.hops = k
      g.lock = g.t + SETTLE_MS
      setHops(k)
      setShown(s => Math.max(s, k))
      bumpPad(`h${k}`)
      addFx('ring', S.spots.at(k), S.spots.pad.w * 1.25)
      sfx.note(k - 1, S.cfg.speak || g.help ? 0.1 : 0.2)
      later(SETTLE_MS, flush)
    } })
  }

  const leap = () => {
    setPhase('busy')
    sfx.slideUp()
    if (g.hops === S.n) jump('goal', { h: Math.max(S.spots.lift * 1.5, S.L.frog * 0.9), ms: LEAP_MS, spin: true, onLand: landed })
    // too early: the bank is still too far away
    else jump(S.spots.short(g.hops), { h: S.spots.lift * 1.35, ms: 470, onLand: splash })
  }

  // Into the water. The frog swims back to its bank, climbs out, shakes
  // itself dry and starts again.
  const splash = () => {
    const { L } = S
    g.misses += 1
    g.queued = null
    miss(bodyRef.current)
    sfx.splash()
    addFx('splash', { x: fx.get(), y: fy.get() }, L.frog)
    setFrogMode('under')
    if (!g.help) { setUp(0); setShown(0) }   // the wave washes the pads away
    sayWrong(null, { onEnd: () => voice([KEY.word(S.round.name)]) })
    const edge = L.wide ? { x: L.water.x + L.frog * 0.35, y: L.home.y + L.frog * 0.1 } : { x: L.home.x, y: L.water.y + L.water.h - L.frog * 0.05 }
    later(520, () => {
      setFrogMode('swim')
      g.at = edge
      if (S.reduce) { fx.set(edge.x); fy.set(edge.y); return }
      animate(fx, edge.x, { duration: 0.8, ease: 'easeInOut' })
      animate(fy, edge.y, { duration: 0.8, ease: 'easeInOut' })
    })
    later(1400, () => {
      setFrogMode('sit')
      sfx.boing()
      jump('home', { h: S.L.frog * 0.45, ms: 260, onLand: () => {
        if (!S.reduce) animate(rot, [0, -16, 14, -12, 10, -6, 0], { duration: 0.6 })
        addFx('drops', S.L.home, S.L.frog)
        later(650, () => {
          g.hops = 0
          setHops(0)
          if (g.misses >= 2) showWay()
          else setPhase('play')
        })
      } })
    })
  }

  // After two splashes: the pads of the word come up by themselves, each
  // saying its syllable, and stay. Now the child only has to follow them.
  const showWay = () => {
    g.help = true
    setHelp(true)
    const step = k => {
      if (k > S.n) { later(200, () => setPhase('play')); return }
      setUp(u => Math.max(u, k))
      setShown(s => Math.max(s, k))
      bumpPad(`h${k}`)
      addFx('ring', S.spots.at(k), S.spots.pad.w * 1.25)
      sfx.note(k - 1, 0.1)
      voice([KEY.syllable(S.round.syllables[k - 1])])
      later(640, () => step(k + 1))
    }
    later(150, () => step(1))
  }

  // ── Build rounds ──
  const tapPad = id => {
    const { round, cells: C, L: lay } = S
    const p = round.pads.find(x => x.id === id)
    if (!p) return
    if (g.done.has(id)) { voice([KEY.syllable(p.text)]); return }
    // By what it says, not which pad it is: either PA pad fits either place of PA-PA-GEI
    if (p.text === round.syllables[g.next]) {
      const k = ++g.next
      g.done.add(id)
      g.wrongRow = 0
      setHops(k)
      setHelp(g.misses >= 2)
      setPadFx(f => ({ ...f, [id]: { ...f[id], done: true } }))
      voice([KEY.syllable(p.text)])
      const to = padMiddle(id), far = Math.hypot(to.x - fx.get(), to.y - fy.get())
      jump({ pad: id }, { h: clamp(far * (lay.wide ? 0.34 : 0.2), lay.frog * 0.4, lay.frog * 1.2), ms: clamp(250 + far * 0.45, 320, 540), onLand: () => {
        g.lock = g.t + SETTLE_MS
        bumpPad(id)
        addFx('ring', padMiddle(id), C.pad.w * 1.15)
        sfx.note(k - 1, 0.1)
        if (k < S.n) { later(SETTLE_MS, flush); return }
        // the last syllable: from here it leaps ashore by itself
        setPhase('busy')
        later(480, () => {
          sfx.slideUp()
          jump('goal', { h: S.L.frog * 1.1, ms: LEAP_MS, spin: true, onLand: landed })
        })
      } })
      return
    }
    // Not this one (yet): it says what it is, dips under and comes up again.
    // Finding out what a pad says is free; tapping it wrongly again is a miss.
    voice([KEY.syllable(p.text)])
    setPadFx(f => ({ ...f, [id]: { ...f[id], dip: (f[id]?.dip ?? 0) + 1 } }))
    g.wrongRow += 1
    if (g.heard.has(id)) {
      g.misses += 1
      miss(padEls.current[id])
      announce('wrong')
    } else {
      g.heard.add(id)
      sfx.bonk()
    }
    setHelp(g.wrongRow >= 3 || g.misses >= 2)
  }

  // ── Ashore ──
  const landed = () => {
    const { round } = S
    setPhase('won')
    shake(0.6)
    if (g.misses === 0) g.firstTry += 1
    const { milestone } = hit(thingRef.current)
    burst(thingRef.current, milestone ? 'confetti' : 'stars', milestone ? 18 : 9)
    setJoy(j => j + 1)
    const word = KEY.word(round.name) in LINES ? [line(KEY.word(round.name))] : []
    const cheer = () => { sayRight(null, { lead: word }); afterSpeech(collect, 900) }
    // silent hops: now the pads say the syllables, one after the other
    if (S.isHop && !S.cfg.speak && !g.help) recap(1, cheer)
    else cheer()
  }
  const recap = (k, done) => {
    if (k > S.n) { later(100, done); return }
    bumpPad(`h${k}`)
    sfx.note(k - 1, 0.08)
    voice([KEY.syllable(S.round.syllables[k - 1])])
    later(580, () => recap(k + 1, done))
  }
  // The thing joins the others on the far shore
  const collect = () => {
    const { L: lay, slots: sl } = S
    setFlyer({ id: S.idx, emoji: S.round.emoji, from: { x: lay.thingAt.x, y: lay.thingAt.y - lay.thing / 2 }, to: sl.slots[S.idx], size: lay.thing, scale: (sl.size * 0.86) / lay.thing })
  }
  const shelved = () => {
    setFlyer(null)
    setShelf(s => (s.length > S.idx ? s : [...s, S.round.emoji]))
    sfx.pop()
    later(260, () => (S.idx + 1 >= total ? setPhase('finale') : setIdx(i => i + 1)))
  }

  // ── A new word ──
  const ready = !!L
  useEffect(() => {
    if (!ready || g.started === idx) return
    g.started = idx
    Object.assign(g, { hops: 0, next: 0, misses: 0, wrongRow: 0, heard: new Set(), done: new Set(), help: false, queued: null, idle: 0, repeated: false, fly: null, pinned: null })
    setHops(0); setUp(0); setShown(0); setPadFx({}); setHelp(false); setHint(null); setFlyOn(false); setFrogMode('sit')
    if (g.stork) { g.stork.state = 'go'; setStork({ flip: !g.stork.flip, walking: true, peck: 0 }) }
    setPhase('intro')
    lockPreviews()
    const begin = () => {
      const task = firstOfKind ? KEY.task(isHop ? (cfg.speak ? TASK.hop : TASK.alone) : TASK.build) : null
      voice([task, KEY.word(round.name)])
      afterSpeech(() => { if (g.phase === 'intro') setPhase('play') }, 350, 4000)
      // a fly for the frog to snap, in most rounds
      g.fly = (idx === 0 && level <= 2) || Math.random() > 0.62 ? null : { t: -(900 + Math.random() * 2200), life: isHop ? 10000 : 13000, seed: Math.random() * 6, on: false, gone: false }
    }
    if (idx === 0) {
      g.at = 'home'
      fx.set(S.L.home.x); fy.set(S.L.home.y)
      later(450, begin)
    } else {
      // back over the pond in one great leap
      sfx.whoosh()
      const far = Math.hypot(S.L.home.x - fx.get(), S.L.home.y - fy.get())
      jump('home', { h: S.L.wide ? clamp(far * 0.3, S.L.frog, S.L.h * 0.32) : S.L.frog * 0.9, ms: HOME_MS, onLand: begin })
    }
  }, [idx, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const tapThing = () => {
    if (S.paused) return
    if (g.phase === 'play' && S.isHop) { request('leap'); return }
    if (g.phase === 'play' || g.phase === 'intro') {
      // in a build round the thing just says its name again
      act()
      voice([KEY.word(S.round.name)])
      setJoy(j => j + 1)
    }
  }

  // ── What waits for the child: the fly, the stork ──
  const flyAt = f => {
    const { L: lay } = S
    const W = lay.water, q = S.reduce ? 0.5 : f.t / f.life, s = f.t / 1000
    if (S.isHop) {
      // it comes towards the frog along its way, at the height of a jump
      if (lay.wide) return { x: W.x + W.w * (1.04 - 1.1 * q), y: lay.rowY - lay.frog * 1.25 + Math.sin(s * 2.3 + f.seed) * lay.frog * 0.3 }
      return { x: lay.rowX + Math.sin(s * 1.9 + f.seed) * lay.frog * 0.55, y: W.y + W.h * (-0.04 + 1.1 * q) - lay.frog * 0.5 }
    }
    return { x: W.x + W.w * (0.5 + 0.36 * Math.sin(s * 0.45 + f.seed)), y: W.y + W.h * (0.45 + 0.3 * Math.sin(s * 0.62 + f.seed * 2)) - lay.frog * 0.4 }
  }
  const snap = (p, mx, my) => {
    g.fly.gone = true
    setFlyOn(false)
    setTongue({ id: ++seq, dx: p.x - mx, dy: p.y - my, up: lift.get() })
    later(250, () => {
      // a bonus star, nothing to do with the task
      sfx.chomp()
      hit(bodyRef.current, { silent: true })
    })
  }
  const nextTarget = () => {
    const { L: lay } = S
    if (S.isHop) {
      return g.hops < S.n
        ? { id: 'spot', pt: S.spots.at(g.hops + 1) }
        : { id: 'thing', pt: { x: lay.thingAt.x - lay.thing * 0.18, y: lay.thingAt.y - lay.thing * 0.42 } }
    }
    const p = S.round.pads.find(x => x.text === S.round.syllables[g.next] && !g.done.has(x.id))
    return p ? { id: p.id, pt: padMiddle(p.id) } : null
  }
  const callStork = () => {
    const { L: lay } = S
    const t = nextTarget()
    if (!t) return
    const s = lay.stork
    // it stands so that its beak, bent down, is on the target; from the right where the left has no room
    const flip = t.pt.x - STORK_PECK.x * s < s * 0.32
    const dir = flip ? -1 : 1
    const stand = { x: t.pt.x - dir * STORK_PECK.x * s, y: Math.min(lay.h - 4, t.pt.y - STORK_PECK.y * s) }
    const from = { x: flip ? lay.w + s * 0.7 : -s * 0.7, y: lay.h - 6 }
    if (t.id !== 'spot' && t.id !== 'thing') g.pinned = t.id   // the pad holds still for it
    g.stork = { state: S.reduce ? 'peck' : 'come', x: S.reduce ? stand.x : from.x, y: S.reduce ? stand.y : from.y, tx: stand.x, ty: stand.y, ex: from.x, ey: from.y,
      speed: Math.hypot(stand.x - from.x, stand.y - from.y) / STORK_WALK_S, flip, target: t.id, wait: 300, n: 0 }
    storkX.set(g.stork.x); storkY.set(g.stork.y)
    setStork({ flip, walking: !S.reduce, peck: 0 })
    if (S.reduce) setHint(t.id)
  }

  // The game's clock. It stands still while the help is open.
  useAnimationFrame((_, delta) => {
    const { L: lay, round: r, cells: C } = S
    if (!lay || S.paused) return
    const dt = Math.min(delta, 60)
    g.t += dt

    if (!S.isHop && !S.reduce) {
      const w = (g.t / 1000) * (0.45 + S.cfg.drift * 0.3)
      for (const p of r.pads) {
        if (g.done.has(p.id) || g.pinned === p.id) continue
        S.drift[p.id].x.set(Math.sin(w + p.phase) * C.amp)
        S.drift[p.id].y.set(Math.cos(w * 0.8 + p.phase * 1.7) * C.amp * 0.7)
      }
    }

    const f = g.fly
    if (f && !f.gone && g.phase !== 'finale') {
      f.t += dt
      if (f.t >= 0) {
        if (!f.on) { f.on = true; setFlyOn(true) }
        const p = flyAt(f)
        flyX.set(p.x); flyY.set(p.y)
        if (f.t > f.life && !S.reduce) { f.gone = true; setFlyOn(false) }
        else if (g.air && (S.reduce || lift.get() > 12) && g.phase !== 'intro') {
          const mx = fx.get(), my = fy.get() - lift.get() - lay.frog * 0.5
          if (Math.hypot(p.x - mx, p.y - my) < lay.frog * 0.62 + 18) snap(p, mx, my)
        }
      }
    }

    const st = g.stork
    if (st) {
      if (st.state === 'peck') {
        st.wait -= dt
        if (st.wait <= 0) {
          st.wait = 1900
          st.n += 1
          sfx.flip()
          setStork(v => v && { ...v, peck: st.n })
        }
      } else {
        const go = st.state === 'go'
        const tx = go ? st.ex : st.tx, ty = go ? st.ey : st.ty
        const dx = tx - st.x, dy = ty - st.y, d = Math.hypot(dx, dy)
        const stepLen = (st.speed * (go ? 3 : 1) * dt) / 1000
        if (d <= stepLen || S.reduce) {
          st.x = tx; st.y = ty
          if (go) { g.stork = null; setStork(null) }
          else { st.state = 'peck'; st.wait = 250; setHint(st.target); setStork(v => v && { ...v, walking: false }) }
        } else { st.x += (dx / d) * stepLen; st.y += (dy / d) * stepLen }
        storkX.set(st.x); storkY.set(st.y)
      }
    }

    if (g.phase === 'play' && !g.air) {
      g.idle += dt
      if (!g.repeated && g.idle > REPEAT_MS) {
        g.repeated = true
        voice([KEY.word(r.name)])
        setJoy(j => j + 1)
      }
      if (!g.stork && !S.hand && g.idle > STORK_MS) callStork()
    }
  })

  // ── The picture ──
  const F = L?.frog ?? 80
  const playing = phase === 'play'
  const collected = shelf.length > idx || !!flyer
  // where the hand points: the next hop, the thing, the next pad
  let aim = null
  if (L && playing && hand) {
    if (isHop) aim = hops < n ? spots.at(hops + 1) : { x: L.thingAt.x, y: L.thingAt.y - L.thing * 0.45 }
    else {
      const p = round.pads.find(x => x.text === round.syllables[hops] && !padFx[x.id]?.done)
      aim = p ? cells.at(p) : null
    }
  }
  const thingGlow = hint === 'thing' || (help && isHop && playing && hops === n)

  return (
    <div ref={rootRef} data-game="frosch" data-phase={phase} data-kind={round.kind} data-word={round.syllables.join('-')} data-round={idx} data-hops={hops} data-help={help ? 1 : 0}
      style={{
        position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation',
        background: 'linear-gradient(180deg, #a9e47c 0%, #8ad460 50%, #71c14c 100%)',
      }}>
      {L && (
        <div ref={juice.stage} style={{ position: 'absolute', inset: 0 }}>
          <Water box={L.water} wide={L.wide} />
          <Greenery L={L} />

          {/* The pond: in a hop round every tap on it is one hop */}
          <button type="button" aria-label={isHop ? 'Hüpfen' : 'Teich'} onClick={() => S.isHop && request('hop')} tabIndex={isHop ? 0 : -1}
            style={{ all: 'unset', position: 'absolute', inset: 0, zIndex: 1, cursor: isHop && playing ? 'pointer' : 'default', WebkitTapHighlightColor: 'transparent' }} />

          {/* What was reached, on the far shore: one place for each word of the level */}
          <div role="img" aria-label={`${shelf.length} von ${total} geschafft`} data-shelf={shelf.length}
            style={{ position: 'absolute', left: L.shelf.cx - slots.width / 2 - 8, top: L.shelf.cy - slots.size / 2 - 5, width: slots.width + 16, height: slots.size + 10, boxSizing: 'border-box', zIndex: 2,
              background: 'rgba(255,253,247,0.9)', border: '3px solid #2a1b3d', borderRadius: 999, boxShadow: '0 3px 0 rgba(42,27,61,0.3)', pointerEvents: 'none' }}>
            {slots.slots.map((s, i) => (
              <div key={i} style={{ position: 'absolute', left: s.x - (L.shelf.cx - slots.width / 2 - 8) - 3 - slots.size / 2, top: 2, width: slots.size, height: slots.size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: '14%', borderRadius: '50%', border: '2.5px dashed rgba(42,27,61,0.3)', background: 'rgba(42,27,61,0.05)', opacity: i < shelf.length ? 0 : 1 }} />
                {i < shelf.length && (
                  <motion.div initial={reduce ? false : { scale: 1.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 13 }} style={{ display: 'flex' }}>
                    <Art art={shelf[i]} size={slots.size * 0.86} />
                  </motion.div>
                )}
              </div>
            ))}
          </div>

          {/* Hop rounds: rings where the next hop lands, and the pads that came up */}
          {isHop && playing && !help && hops <= n && (
            <HopSpot key={`spot-${hops}`} pt={spots.at(hops + 1)} w={spots.pad.w * 0.9} hint={hint === 'spot'} />
          )}
          <AnimatePresence>
            {isHop && phase !== 'finale' && Array.from({ length: up }, (_, i) => {
              const k = i + 1, pt = spots.at(k)
              return (
                <motion.div key={`${idx}-h${k}`} data-pad={round.syllables[i]}
                  initial={reduce ? { opacity: 0 } : { scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={reduce ? { opacity: 0 } : { scale: 0.5, opacity: 0, y: 14 }}
                  transition={{ type: 'spring', stiffness: 520, damping: 24 }}
                  style={{ position: 'absolute', left: pt.x - spots.pad.w / 2, top: pt.y - spots.pad.h / 2, zIndex: 3, pointerEvents: 'none' }}>
                  <Pad w={spots.pad.w} h={spots.pad.h} text={k <= shown ? round.syllables[i] : null} lit={k <= hops || phase === 'won'}
                    glow={help && playing && k === hops + 1} bump={padFx[`h${k}`]?.bump} reduce={reduce} />
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Build rounds: the syllables float in the pond */}
          {!isHop && phase !== 'finale' && round.pads.map((p, i) => {
            const b = cells.at(p), f = padFx[p.id] ?? {}
            const next = p.text === round.syllables[hops] && !f.done && round.pads.find(x => x.text === p.text && !padFx[x.id]?.done) === p
            return (
              <motion.div key={`${idx}-${p.id}`} style={{ position: 'absolute', left: b.x - cells.pad.w / 2, top: b.y - cells.pad.h / 2, x: drift[p.id].x, y: drift[p.id].y, zIndex: 3 }}>
                <motion.button type="button" ref={el => { padEls.current[p.id] = el }} onClick={() => request({ pad: p.id })}
                  aria-label={p.text} data-pad={p.text} data-state={f.done ? 'done' : 'float'}
                  initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: idx ? 0.3 + i * 0.09 : i * 0.09, type: 'spring', stiffness: 420, damping: 18 }}
                  whileTap={f.done ? undefined : { scale: 0.93 }}
                  style={{ all: 'unset', display: 'block', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
                  <Pad w={cells.pad.w} h={cells.pad.h} text={p.text} lit={!!f.done} bump={f.bump} dip={f.dip}
                    glow={playing && next && (help || hint === p.id)} reduce={reduce} />
                </motion.button>
              </motion.div>
            )
          })}

          {fxs.filter(f => f.kind === 'ring').map(f => (
            <div key={f.id} style={{ position: 'absolute', left: 0, top: 0, zIndex: 3, pointerEvents: 'none' }}><Ring x={f.x} y={f.y} size={f.size} onDone={() => endFx(f.id)} /></div>
          ))}

          {/* The thing on the far bank */}
          {!collected && (
            <motion.button type="button" key={`thing-${idx}`} ref={thingRef} onClick={tapThing} aria-label={round.name} data-thing={round.name}
              initial={reduce ? { opacity: 0 } : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: idx ? 0.35 : 0, type: 'spring', stiffness: 380, damping: 16 }} whileTap={{ scale: 0.92 }}
              style={{ all: 'unset', position: 'absolute', left: L.thingAt.x - L.thing / 2, top: L.thingAt.y - L.thing, width: L.thing, height: L.thing, zIndex: 4, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
              <div aria-hidden="true" style={{ position: 'absolute', left: '18%', right: '18%', bottom: -L.thing * 0.03, height: L.thing * 0.1, borderRadius: '50%', background: 'rgba(42,27,61,0.18)' }} />
              <div className={thingGlow ? 'fr-glow' : playing ? 'fr-bob' : undefined} style={{ width: '100%', height: '100%' }}>
                <motion.div key={joy} animate={joy && !reduce ? { y: [0, -L.thing * 0.24, 0, -L.thing * 0.1, 0], scaleY: [1, 1.08, 0.92, 1.03, 1] } : {}} transition={{ duration: 0.6 }}
                  style={{ display: 'flex', transformOrigin: '50% 100%' }}>
                  <Art art={round.emoji} size={L.thing} />
                </motion.div>
              </div>
            </motion.button>
          )}

          {stork && (
            <motion.div style={{ position: 'absolute', left: 0, top: 0, x: storkX, y: storkY, width: 0, height: 0, zIndex: 5, pointerEvents: 'none' }} data-stork={stork.walking ? 'walk' : 'peck'}>
              <Stork size={L.stork} flip={stork.flip} walking={stork.walking} peck={stork.peck} reduce={reduce} />
            </motion.div>
          )}

          {/* The frog (at the party it dances in the middle, see Finale) */}
          <motion.div aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, x: fx, y: fy, width: 0, height: 0, zIndex: 6, pointerEvents: 'none', visibility: phase === 'finale' ? 'hidden' : 'visible' }}>
            {frogMode === 'sit' && (
              <motion.div style={{ position: 'absolute', left: -F * 0.32, top: -F * 0.07, width: F * 0.64, height: F * 0.15, borderRadius: '50%', background: 'rgba(20,40,80,0.22)', scale: shade }} />
            )}
            {frogMode === 'swim' && (
              <div className="fr-ripple" style={{ position: 'absolute', left: -F * 0.5, top: -F * 0.22, width: F, height: F * 0.4, borderRadius: '50%', border: '3.5px solid #fff' }} />
            )}
            <motion.div style={{ position: 'absolute', left: -F / 2, top: -F * 0.93, width: F, height: F, y: bodyY, rotate: rot, scale: zoom }}>
              <motion.div ref={bodyRef} style={{ position: 'relative', width: F, height: F, scaleX: sx, scaleY: sy, transformOrigin: '50% 94%' }}>
                {frogMode === 'swim'
                  // only its head out of the water
                  ? <div style={{ position: 'absolute', left: 0, top: F * 0.5, width: F, height: F * 0.45, overflow: 'hidden' }}><Art art="🐸" size={F} style={{ display: 'block' }} /></div>
                  : <motion.div animate={frogMode === 'under' ? { opacity: 0, y: F * 0.3, scale: 0.8 } : { opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }}>
                      <Art art="🐸" size={F} style={{ display: 'block' }} />
                    </motion.div>}
              </motion.div>
            </motion.div>
            {tongue && (
              <div style={{ position: 'absolute', left: 0, top: -tongue.up - F * 0.5 }}>
                <Tongue key={tongue.id} dx={tongue.dx} dy={tongue.dy} fly={F * 0.4} onDone={() => setTongue(null)} />
              </div>
            )}
          </motion.div>

          {/* A fly crossing the pond */}
          <AnimatePresence>
            {flyOn && (
              <motion.div key="fly" aria-hidden="true" data-fly initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.12 } }}
                style={{ position: 'absolute', left: 0, top: 0, x: flyX, y: flyY, width: 0, height: 0, zIndex: 7, pointerEvents: 'none' }}>
                <div className="fr-buzz" style={{ position: 'absolute', left: -F * 0.2, top: -F * 0.2 }}><Art art="🪰" size={F * 0.4} /></div>
              </motion.div>
            )}
          </AnimatePresence>

          {fxs.filter(f => f.kind !== 'ring').map(f => (
            <div key={f.id} style={{ position: 'absolute', left: 0, top: 0, zIndex: 8, pointerEvents: 'none' }}>
              {f.kind === 'splash' ? <Splash x={f.x} y={f.y} size={f.size} onDone={() => endFx(f.id)} /> : <Drops x={f.x} y={f.y} size={f.size} onDone={() => endFx(f.id)} />}
            </div>
          ))}

          {flyer && (
            <motion.div key={`flyer-${flyer.id}`} aria-hidden="true"
              initial={{ x: flyer.from.x - flyer.size / 2, y: flyer.from.y - flyer.size / 2, scale: 1, rotate: 0 }}
              animate={{ x: flyer.to.x - flyer.size / 2, y: [flyer.from.y - flyer.size / 2, Math.min(flyer.from.y, flyer.to.y) - flyer.size * 0.3, flyer.to.y - flyer.size / 2], scale: flyer.scale, rotate: reduce ? 0 : 360 }}
              transition={{ duration: reduce ? 0.01 : 0.6, ease: 'easeInOut' }} onAnimationComplete={shelved}
              style={{ position: 'absolute', left: 0, top: 0, width: flyer.size, height: flyer.size, zIndex: 9, pointerEvents: 'none' }}>
              <Art art={flyer.emoji} size={flyer.size} />
            </motion.div>
          )}

          {/* The star counter (Juice) */}
          <div style={{ position: 'absolute', right: L.hud.right, top: L.hud.top, bottom: L.hud.bottom, zIndex: 9, display: 'flex', pointerEvents: 'none' }}>{juice.hud}</div>

          {aim && <div ref={aimRef} aria-hidden="true" style={{ position: 'absolute', left: aim.x, top: aim.y, width: 2, height: 2, pointerEvents: 'none' }} />}
        </div>
      )}

      <HintHand key={`${idx}-${hops}`} to={aimRef} active={playing && hand && !!aim} delay={hops ? 3200 : 2400} />
      {phase === 'finale' && <Finale items={shelf} hero="🐸" onDone={() => onComplete(result(g.firstTry, total))} />}
      {bursts}
      {juice.layer}
    </div>
  )
}
