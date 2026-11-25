import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, motionValue, AnimatePresence, useMotionValue, useTransform, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, leaveGame, narrate, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { LINES, line } from '../lib/lumiLines.js'
import { numberWord } from '../lib/words.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { playAnimal } from '../lib/animalSounds.js'
import { Critter, Art, useMood, useBursts, useJuice, HintHand } from '../components/play/index.js'
import { Stage, DoneButton, Finale } from './zahlen/stage.jsx'
import { tasksFor, modeFor, verdict, sumSolution, isOrdered, lean, TOP, TASKS, BOUNCES, STACK_MAX } from './wippe/levels.js'
import { layoutFor, onPlank, supplyLayout, stairLayout, nearDrop, A, THICK } from './wippe/geometry.js'
import { useDirector } from './wippe/director.js'
import { Tree, TreatBranch, Stand, Plank, Prop, Parachute, Parcel, Glow, Block, Crate, Stair, Stump, Branch, Mark } from './wippe/parts.jsx'

/**
 * Waage-Welt — "Wippe-Katapult": heavier and lighter, ordering by weight,
 * weights as numbers.
 *
 * The seesaw is a catapult. An animal sits on its left end, which rests on
 * the grass; what it wants (a cheese, a fly, a cherry, a chestnut) hangs in
 * the tree above it. The child drops a thing onto the raised right end —
 * drag it there and let go, or tap it. It falls, the plank slams down and
 * the animal flies up: exactly as many steps of the tree's ruler as the
 * thing weighs. Reached the treat: it grabs it and floats down on a little
 * parachute. Too light: a small hop, a mark on the tree shows how high, and
 * the thing bounces off. Too heavy: it sails past the treat (out of the top
 * of the picture when it is very heavy) and comes down on the parachute.
 * Whatever leaves the seesaw goes off sideways, out of the picture.
 *
 *   • Levels 1–2: two things, very different; the treat hangs where the
 *     heavier one sends the animal ("which is heavier?").
 *   • Levels 3–4: three things; the treat hangs at the height of the heavy,
 *     the middle or (level 4) the light one — so the heaviest is not always
 *     right. The marks on the tree let the child compare.
 *   • Levels 5–6: drawn the same size, and two in each set look alike (a
 *     sponge and a brick, a balloon and an apple): size tells nothing.
 *   • Levels 7–8: parcels with numbers, and a prop holds the plank up. The
 *     treat hangs at a numbered step; parcels go on (several are allowed)
 *     until their numbers make that step, then the green tick knocks the
 *     prop away. The first sums.
 *   • Level 9: three things on a stair. Tap one to try it (it hops back to
 *     its step), drag them so the lightest is on the lowest step, tick. In
 *     the right order all three jump on together and reach the treat at the
 *     top.
 *   • Level 10: the plank is a bridge between two stumps, held level by
 *     props. A parcel on each side; put one-kilo blocks on the right one
 *     until both sides weigh the same, tick: the props fall, and if the
 *     plank stays level the animal walks over to its treat.
 *
 * Six tasks a level; every animal that got its treat sits on the branch at
 * the top. Score: tasks solved with the first throw (the first release, the
 * first order, the first check). After two misses the game helps (the right
 * thing glows, the blocks needed are drawn in dashes). A miss is never more
 * than a funny flight and a mark on the tree.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const BLK = 40                // a one-kilo block (level 10)
const BRIDGE = 0.7            // the parcels of level 10, this far out along the plank
const optional = key => (LINES[key] ? line(key) : null)
const INTRO = { throw: 'wippe/schwer-genug', sum: 'wippe/pakete', order: 'wippe/ordnen', balance: 'wippe/gerade' }

export default function WeightGame({ level = 1, onComplete }) {
  return (
    <Stage wide={[800, 420]} tall={[440, 780]}>
      {wide => <Play wide={wide} level={level} onComplete={onComplete} />}
    </Stage>
  )
}

function Play({ wide, level, onComplete }) {
  const mode = modeFor(level)
  const [tasks] = useState(() => tasksFor(level))
  const paused = usePaused()
  const reduce = useReducedMotion()
  const { tween, wait, alive } = useDirector()
  const juice = useJuice({ hudSize: wide ? 36 : 32 })
  const { hit, miss, shake } = juice
  const [bursts, burst] = useBursts()

  const fieldRef = useRef(null)
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const el = fieldRef.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setSize(s => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const g = useMemo(() => (size ? layoutFor(size.w, size.h, wide, mode) : null), [size, wide, mode])
  const G = useRef(g)
  G.current = g

  // ── What the picture shows ──────────────────────────────────────────────
  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState('enter')     // enter | aim | busy | finale
  const [where, setWhere] = useState({})          // item id → 'ground' | 'plank' | 'air' | 'gone'
  const [marks, setMarks] = useState([])          // { key, step, art, n }
  const [blink, setBlink] = useState([])          // marks of things on the wrong step
  const [guests, setGuests] = useState([])        // who got its treat, on the branch
  const [misses, setMisses] = useState(0)
  const [chute, setChute] = useState(false)
  const [trail, setTrail] = useState(false)
  const [treatOn, setTreatOn] = useState('hang')  // hang | held | gone
  const [, setSteps] = useState(null)            // level 9: the item id on each step
  const [blocks, setBlocks] = useState(0)         // level 10
  const [, setLive] = useState(false)             // level 10, after a miss: the plank shows the weights
  const [wiggle, setWiggle] = useState(0)
  const [flyerMood, setFlyerMood] = useMood()
  const [showFlyer, setShowFlyer] = useState(true)
  const [aim, setAim] = useState(null)            // what the hand shows

  const task = tasks[idx]
  const flyer = task.flyer
  const items = useMemo(() => (task.mode === 'sum' ? task.parcels.map(p => ({ ...p, kind: 'parcel' })) : task.mode === 'balance' ? [] : task.things.map(t => ({ ...t, kind: 'thing' }))), [task])
  const byId = useMemo(() => Object.fromEntries(items.map(i => [i.id, i])), [items])

  // ── What moves (motion values) ──────────────────────────────────────────
  const ang = useMotionValue(mode === 'balance' ? 0 : -A)
  const fx = useMotionValue(-200), fy = useMotionValue(0), fr = useMotionValue(0), fs = useMotionValue(1)
  const tx = useMotionValue(0), ty = useMotionValue(0), ts = useMotionValue(0)
  const propR = useMotionValue(0)                 // the prop(s): 0 standing, 90 knocked over
  const propL = useTransform(propR, r => -r)
  const flyBlock = { x: useMotionValue(0), y: useMotionValue(0), o: useMotionValue(0) }
  const mvs = useRef(new Map())                   // item id → { x, y, r, s }
  const M = id => mvs.current.get(id)
  const attach = useRef(new Map())                // item id → { along, lift } : rides on the plank
  const seated = useRef(false)                    // the flyer rides on its end of the plank
  const holding = useRef(false)                   // the treat is in the flyer's paws

  // Live values the scripts read
  const S = useRef({ phase: 'enter', misses: 0, firstTry: 0, stack: [], steps: null, blocks: 0, live: false, fired: new Set(), done: false, lastInput: Date.now(), firstMiss: true }).current
  const go = p => { S.phase = p; setPhase(p) }

  const flyerRef = useRef(null), dropRef = useRef(null), doneRef = useRef(null), crateRef = useRef(null), stackRef = useRef(null)
  const itemRefs = useRef(new Map())
  const refOf = id => {
    let r = itemRefs.current.get(id)
    if (!r) { r = { current: null }; itemRefs.current.set(id, r) }
    return r
  }
  const stepRefs = [useRef(null), useRef(null), useRef(null)]

  useEffect(() => leaveGame, [])

  // ── Where things stand ─────────────────────────────────────────────────
  // a thing's size as drawn: by its class (levels 1–4), shrunk to fit the row
  const nominal = it => (!g ? 80 : it.kind === 'parcel' ? g.parcel : Math.round(g.thing * (it.scale ?? 1)))
  const withButton = mode !== 'throw'
  const lay = useMemo(() => {
    if (!g) return null
    if (mode === 'order') {
      const b = g.supply
      const s = Math.min(g.thing, Math.floor((b.x1 - b.x0 - (wide ? 24 : 120)) / 3 - 12))
      const stair = stairLayout(g, s)
      // the tick: above the thing on the highest step (wide), beside the stair (tall)
      return { stair, k: s / g.thing, button: wide ? { x: stair[2].x, y: stair[2].top - s - 58 } : { x: b.x1 - 44, y: b.y1 - 46 } }
    }
    if (mode === 'balance') {
      const { spots, button } = supplyLayout(g, [120], true)
      return { crate: spots[0], button, k: 1 }
    }
    return supplyLayout(g, items.map(nominal), withButton)
  }, [g, mode, items]) // eslint-disable-line react-hooks/exhaustive-deps
  const L = useRef(lay)
  L.current = lay
  const sizeOf = it => Math.round(nominal(it) * (L.current?.k ?? 1))

  // the home of an item: its spot on the grass, or its step on the stair
  const homeOf = useCallback(id => {
    const l = L.current
    if (!l) return { x: 0, y: 0 }
    if (mode === 'order') {
      const k = S.steps ? S.steps.indexOf(id) : 0
      const st = l.stair[Math.max(0, k)]
      return { x: st.x, y: st.top - sizeOf(byId[id]) / 2 + 2 }
    }
    return l.spots[items.findIndex(i => i.id === id)]
  }, [items, byId, mode]) // eslint-disable-line react-hooks/exhaustive-deps

  // make sure every item has its motion values
  for (const it of items) {
    if (!mvs.current.has(it.id)) {
      mvs.current.set(it.id, { x: motionValueOf(0), y: motionValueOf(0), r: motionValueOf(0), s: motionValueOf(0) })
    }
  }

  // Everything that rides on the plank follows it
  const follow = useCallback(() => {
    const gg = G.current
    if (!gg) return
    const a = ang.get()
    if (seated.current) { const p = gg.seatAt(a); fx.set(p.x); fy.set(p.y) }
    for (const [id, at] of attach.current) {
      const m = id === 'blocks' ? stackMv : M(id)
      if (!m) continue
      const p = onPlank(gg, a, at.along, at.lift)
      m.x.set(p.x); m.y.set(p.y); m.r.set(a)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const stackMv = { x: useMotionValue(0), y: useMotionValue(0), r: useMotionValue(0) }
  useEffect(() => ang.on('change', follow), [ang, follow])
  useEffect(() => {
    const f = () => {
      if (!holding.current || !G.current) return
      tx.set(fx.get() - G.current.FS * 0.3); ty.set(fy.get() + G.current.FS * 0.02)
    }
    const a = fx.on('change', f), b = fy.on('change', f)
    return () => { a(); b() }
  }, [fx, fy, tx, ty])

  // the treat's place: in the tree, or on the far stump (level 10)
  const treatHome = () => {
    const gg = G.current
    if (task.mode === 'balance') return { x: gg.stumps[1].x, y: gg.stumps[1].top - gg.treat / 2 + 2 }
    return { x: gg.treatX, y: gg.yAt(task.target) }
  }
  const flyerHome = () => {
    const gg = G.current
    if (task.mode === 'balance') return { x: gg.stumps[0].x, y: gg.stumps[0].top - gg.FS / 2 + gg.sink }
    return gg.seatAt(ang.get())
  }

  // A new size (turned the phone): everything at rest goes to its new place
  useEffect(() => {
    if (!g || S.phase === 'finale') return
    for (const it of items) {
      const w = S.where?.[it.id]
      const m = M(it.id)
      if (w === 'ground') { const h = homeOf(it.id); m.x.set(h.x); m.y.set(h.y) }
    }
    follow()
    if (S.phase !== 'busy' && S.phase !== 'enter') {
      if (!seated.current && task.mode === 'balance') { const h = flyerHome(); fx.set(h.x); fy.set(h.y) }
      if (treatOn === 'hang') { const h = treatHome(); tx.set(h.x); ty.set(h.y) }
    }
  }, [g, lay]) // eslint-disable-line react-hooks/exhaustive-deps

  const setPlace = (id, w) => { S.where = { ...S.where, [id]: w }; setWhere(S.where) }

  // ── A task begins ──────────────────────────────────────────────────────
  const started = useRef(-1)
  useEffect(() => {
    if (!g || !lay || started.current === idx) return
    started.current = idx
    begin()
  }, [g, lay, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  async function begin() {
    const gg = G.current
    go('enter')
    S.misses = 0; S.stack = []; S.fired = new Set(); S.blocks = 0; S.live = false; S.firstMiss = true
    setMisses(0); setMarks([]); setBlink([]); setBlocks(0); setLive(false); setChute(false); setTrail(false)
    attach.current.clear()
    holding.current = false
    S.where = Object.fromEntries(items.map(i => [i.id, 'ground']))
    setWhere(S.where)
    if (task.mode === 'order') { S.steps = [...task.steps]; setSteps(S.steps) }
    // the plank and its props
    ang.jump(task.mode === 'balance' ? 0 : -A)
    propR.jump(0)
    // the things pop up on the grass, one after the other
    items.forEach((it, i) => {
      const m = M(it.id), h = homeOf(it.id)
      m.x.jump(h.x); m.y.jump(h.y); m.r.jump(0); m.s.jump(0)
      tween(m.s, 1, { type: 'spring', stiffness: 420, damping: 15, delay: 0.25 + i * 0.12 })
    })
    if (task.mode === 'balance') {
      for (const [id, along, n] of [['left', -BRIDGE * gg.L, task.left], ['right', BRIDGE * gg.L, task.right]]) {
        if (!mvs.current.has(id)) mvs.current.set(id, { x: motionValueOf(0), y: motionValueOf(0), r: motionValueOf(0), s: motionValueOf(0) })
        attach.current.set(id, { along, lift: gg.parcel / 2 })
        const m = M(id)
        m.s.jump(0)
        void n
        tween(m.s, 1, { type: 'spring', stiffness: 420, damping: 15, delay: 0.3 })
      }
      // the blocks go on top of the right parcel: the same place, the same pull
      attach.current.set('blocks', { along: BRIDGE * gg.L, lift: gg.parcel - 6 })
    }
    follow()
    // the treat appears where it hangs
    setTreatOn('hang')
    const th = treatHome()
    tx.jump(th.x); ty.jump(th.y); ts.jump(0)
    tween(ts, 1, { type: 'spring', stiffness: 380, damping: 12, delay: 0.2 })
    // the animal hops in from the left
    seated.current = false
    setShowFlyer(true)
    setFlyerMood('idle')
    fs.jump(1); fr.jump(0)
    const home = flyerHome()
    fx.jump(-gg.FS); fy.jump(home.y)
    await Promise.all([
      tween(fx, home.x, { duration: 0.9, ease: 'easeOut' }),
      tween(fy, [home.y, home.y - 60, home.y, home.y - 34, home.y], { duration: 0.9, times: [0, 0.3, 0.6, 0.8, 1] }),
    ])
    if (task.mode !== 'balance') { seated.current = true; follow() }
    sfx.step()
    // Lumi: the first time, what to do; with parcels, the number of the step
    lockPreviews()
    sayTask()
    const intro = idx === 0 ? optional(INTRO[task.mode]) : null
    const num = task.mode === 'sum' ? numberWord(task.target) : null
    afterNarration(() => narrate([intro, num && intro ? { ...num, gap: 300 } : num]))
    S.lastInput = Date.now()
    go('aim')
  }

  const addMark = (step, art, n) => {
    if (step < 1) return
    setMarks(l => [...l.filter(m => m.step !== Math.min(step, TOP + 0.6)), { key: `${idx}-${step}-${l.length}`, step: Math.min(step, TOP + 0.6), art, n }])
  }

  // ── The flight ─────────────────────────────────────────────────────────
  // The flyer goes up `h` steps and comes down again. → the verdict
  async function flight(h, { test = false, label } = {}) {
    const gg = G.current
    const v = test ? 'test' : verdict(h, task.target)
    seated.current = false
    playAnimal(flyer.art, { volume: 0.7 })
    sfx.whoosh()
    setFlyerMood('wow', 900)
    const out = h > TOP
    const apexY = out ? -gg.FS * 1.3 : gg.yAt(h)
    const up = 0.3 + 0.045 * Math.min(h, TOP + 2)
    setTrail(h >= 3)
    if (h >= 5 && !reduce) tween(fr, [0, -14, 8, 0], { duration: up + 0.2 })
    await tween(fy, apexY, { duration: up, ease: [0.12, 0.8, 0.3, 1] })
    setTrail(false)
    if (task.mode === 'sum') addMark(h, null, h)
    else if (label) addMark(h, label)
    if (task.mode === 'sum') { const w = numberWord(h); if (w) narrate([w]) }
    if (v === 'right') {
      // got it: the treat jumps into its paws
      sfx.sparkle()
      burst(flyerRef.current, 'stars', 10)
      holding.current = true
      setTreatOn('held')
      await Promise.all([tween(tx, fx.get() - gg.FS * 0.3, { duration: 0.18 }), tween(ty, fy.get() + gg.FS * 0.02, { duration: 0.18 })])
      setFlyerMood('happy', 1400)
    } else if (v === 'low' || (v === 'test' && h < TOP)) {
      // so close: a look up at the treat, a shrug
      setFlyerMood('oops', 1200)
      await wait(260)
    } else {
      await wait(out ? 260 : 160)
    }
    // down: a parachute for anything but a little hop
    const land = () => gg.seatAt(ang.get())
    if (h >= 4 || v === 'right') {
      if (out) { fy.set(-gg.FS * 1.2) }
      setChute(true)
      sfx.pop()
      const from = fy.get(), to = land().y
      const dur = clamp((to - from) / 230, 0.9, 2.1)
      const x0 = fx.get()
      if (!reduce) {
        tween(fx, [x0, x0 + 12, x0 - 10, x0 + 6, x0], { duration: dur })
        tween(fr, [0, 7, -7, 5, 0], { duration: dur })
      }
      await tween(fy, to, { duration: dur, ease: [0.3, 0.1, 0.6, 1] })
      fx.set(x0)
      setChute(false)
    } else {
      await tween(fy, land().y, { duration: 0.3, ease: 'easeIn' })
    }
    seated.current = true
    follow()
    sfx.step()
    return v
  }

  // Something lands on the raised end with `load` steps of weight.
  // `riders`: the ids that stay on the plank. → resolves when the plank has swung.
  async function slam(load) {
    sfx.drum()
    shake(clamp(0.25 + load / 9, 0.3, 1.6))
    if (load <= BOUNCES) {
      // too light to push it down: the plank only dips
      tween(ang, [-A, -A + 7, -A - 1, -A], { duration: 0.5 })
      await wait(60)
    } else {
      // the flyer goes up the moment the plank hits the ground, while it still rocks
      tween(ang, A, { type: 'spring', stiffness: 520, damping: 17, restDelta: 0.2 })
      await wait(reduce ? 0 : 110)
    }
  }

  // ── Levels 1–6: one thing at a time ────────────────────────────────────
  async function throwThing(id, fromDrag) {
    const gg = G.current
    const it = byId[id], m = M(id), s = sizeOf(it)
    go('busy')
    setPlace(id, 'air')
    S.lastInput = Date.now()
    const rest = gg.dropAt(s)
    if (!fromDrag) {
      // up in a bow over the raised end
      const above = rest.y - Math.max(110, gg.unit * 3.2)
      await Promise.all([
        tween(m.x, rest.x, { duration: 0.5, ease: 'easeInOut' }),
        tween(m.y, [m.y.get(), Math.min(m.y.get(), above) - 40, above], { duration: 0.5, times: [0, 0.6, 1], ease: 'easeOut' }),
        tween(m.r, [0, -12, 0], { duration: 0.5 }),
      ])
    } else {
      await tween(m.x, rest.x, { duration: 0.12 })
    }
    // it falls, faster and faster
    const fall = Math.max(10, rest.y - m.y.get())
    await tween(m.y, rest.y, { duration: clamp(Math.sqrt(fall) / 30, 0.16, 0.42), ease: 'easeIn' })
    setPlace(id, 'plank')
    const light = it.w <= BOUNCES
    if (light) {
      // boing — it bounces off, sideways out of the picture
      sfx.boing()
      slam(it.w)
      offSide(id, s, true)
    } else {
      attach.current.set(id, { along: gg.load, lift: s / 2 })
      follow()
      await slam(it.w)
    }
    const flying = flight(it.w, { label: it.e })
    // the heavy one rolls down the sloping plank and away to the right
    if (!light) { await wait(380); attach.current.delete(id); offSide(id, s, false) }
    const v = await flying
    await afterFlight(v, [id])
  }

  // A thing leaves the seesaw: sideways, out of the picture on the right
  async function offSide(id, s, bounce) {
    const gg = G.current, m = M(id)
    setPlace(id, 'gone')
    const x0 = m.x.get(), y0 = m.y.get()
    const far = gg.W + s * 1.5
    if (bounce) {
      await Promise.all([
        tween(m.x, [x0, x0 + 60, far], { duration: 1.0, times: [0, 0.3, 1], ease: 'easeOut' }),
        tween(m.y, [y0, y0 - 120, y0 - 40], { duration: 1.0, times: [0, 0.35, 1] }),
        tween(m.r, [0, 200, 420], { duration: 1.0 }),
      ])
    } else {
      sfx.slideDown()
      const tip = onPlank(gg, A, gg.L, s / 2)
      const ground = gg.ground - s / 2
      const turns = (far - x0) / (Math.PI * s) * 360
      await Promise.all([
        tween(m.x, [x0, tip.x, far], { duration: 1.1, times: [0, 0.3, 1], ease: 'easeIn' }),
        tween(m.y, [y0, tip.y, ground], { duration: 1.1, times: [0, 0.3, 0.42] }),
        tween(m.r, [A, A + turns * 0.3, turns], { duration: 1.1, ease: 'easeIn' }),
      ])
    }
    if (S.where?.[id] === 'gone') setPlace(id, 'out')
  }

  // After the flyer is down again: right — eat and go to the branch; wrong — try again
  async function afterFlight(v, ids) {
    if (v === 'right') {
      // what is still on the plank slides off, then the plank tips back
      // under the flyer's weight
      const on = [...attach.current.keys()]
      on.forEach((id, i) => { attach.current.delete(id); wait(i * 120).then(() => offSide(id, sizeOf(byId[id]), false)) })
      if (on.length) await wait(450)
      if (ang.get() > 0) await tween(ang, -A, { type: 'spring', stiffness: 260, damping: 16, restDelta: 0.2 })
      await feast()
      return
    }
    // a miss: a mark shows how high, the flyer shrugs, the plank comes back
    if (ang.get() > 0 && task.mode !== 'sum') tween(ang, -A, { type: 'spring', stiffness: 260, damping: 16, restDelta: 0.2 })
    missed(v)
    void ids
    await wait(500)
    go('aim')
    S.lastInput = Date.now()
  }

  function missed(v) {
    S.misses += 1
    setMisses(S.misses)
    setFlyerMood('oops', 1300)
    miss(flyerRef.current)
    sayWrong()
    if (S.firstMiss && (v === 'low' || v === 'high')) {
      S.firstMiss = false
      const said = optional(v === 'low' ? 'wippe/zu-leicht' : 'wippe/zu-schwer')
      if (said) afterNarration(() => narrate([said]))
    }
  }

  // The treat is eaten, the flyer goes up to the branch, the next task
  async function feast() {
    const gg = G.current
    const clean = S.misses === 0
    if (clean) S.firstTry += 1
    setFlyerMood('eat', 1000)
    sfx.chomp()
    wait(330).then(() => sfx.chomp())
    await tween(ts, 0, { duration: 0.7, ease: 'easeIn' })
    holding.current = false
    setTreatOn('gone')
    const big = hit(flyerRef.current, { stars: clean ? 2 : 1 }).milestone
    sayRight()
    setFlyerMood(big ? 'dance' : 'happy', 1500)
    if (big) burst(flyerRef.current, 'confetti', 16)
    await wait(big ? 1300 : 800)
    // off to the branch
    const k = guests.length
    const seat = gg.branch.seat
    const bx = gg.branch.x0 + 10 + k * seat + seat / 2, by = gg.branch.y - seat / 2 - 4
    seated.current = false
    const x0 = fx.get(), y0 = fy.get()
    const peak = Math.min(y0, by) - 70
    sfx.slideUp()
    await Promise.all([
      tween(fx, bx, { duration: 0.8, ease: 'easeInOut' }),
      tween(fy, [y0, peak, by], { duration: 0.8, times: [0, 0.55, 1], ease: 'easeOut' }),
      tween(fs, (seat - 2) / gg.FS, { duration: 0.8 }),
    ])
    void x0
    setShowFlyer(false)
    setGuests(l => [...l, { art: flyer.art, label: flyer.label }])
    sfx.pop()
    // whatever is still on the plank goes off sideways
    const left = [...attach.current.keys()].filter(id => id !== 'blocks')
    if (left.length) {
      if (task.mode === 'balance') clearBridge(left)
      else left.forEach(id => { attach.current.delete(id); offSide(id, sizeOf(byId[id]), false) })
      await wait(task.mode === 'balance' ? 900 : 600)
    }
    // the things nobody needed hop away
    const rest = items.filter(i => S.where?.[i.id] === 'ground')
    rest.forEach(i => tween(M(i.id).s, 0, { duration: 0.25, ease: 'easeIn' }))
    await afterSpeechQuiet(400)
    if (!alive()) return
    if (idx + 1 >= TASKS) { go('finale'); return }
    setIdx(i => i + 1)
  }

  // wait for Lumi to finish the praise (never longer than a few seconds)
  const afterSpeechQuiet = ms => new Promise(res => { afterNarration(() => wait(0).then(res), { minMs: ms, maxMs: 3500 }) })

  // ── Levels 7–8: parcels ─────────────────────────────────────────────────
  async function loadParcel(id, fromDrag) {
    const gg = G.current
    if (S.stack.length >= STACK_MAX) { nudge(id); return }
    const it = byId[id], m = M(id), s = sizeOf(it)
    S.stack = [...S.stack, id]
    setPlace(id, 'air')
    S.lastInput = Date.now()
    const lift = s / 2 + (S.stack.length - 1) * (s - 6)
    const rest = gg.dropAt(s, -A, (S.stack.length - 1) * (s - 6))
    if (!fromDrag) {
      await Promise.all([
        tween(m.x, rest.x, { duration: 0.45, ease: 'easeInOut' }),
        tween(m.y, [m.y.get(), Math.min(m.y.get(), rest.y) - 70, rest.y], { duration: 0.45, times: [0, 0.55, 1] }),
      ])
    } else {
      await Promise.all([tween(m.x, rest.x, { duration: 0.15 }), tween(m.y, rest.y, { duration: 0.2, ease: 'easeIn' })])
    }
    attach.current.set(id, { along: gg.load, lift })
    follow()
    setPlace(id, 'plank')
    sfx.drum(true)
    // the prop holds: the plank only trembles
    tween(ang, [-A, -A + 1.6, -A], { duration: 0.25 })
  }

  async function unloadParcel(id) {
    const gg = G.current
    const k = S.stack.indexOf(id)
    if (k < 0) return
    S.stack = S.stack.filter(x => x !== id)
    attach.current.delete(id)
    S.lastInput = Date.now()
    // the ones above settle down
    S.stack.forEach((sid, i) => {
      const s = sizeOf(byId[sid])
      const at = attach.current.get(sid)
      if (at) at.lift = s / 2 + i * (s - 6)
    })
    follow()
    setPlace(id, 'air')
    const m = M(id), h = homeOf(id)
    await Promise.all([
      tween(m.x, h.x, { duration: 0.4, ease: 'easeInOut' }),
      tween(m.y, [m.y.get(), Math.min(m.y.get(), h.y) - 60, h.y], { duration: 0.4, times: [0, 0.5, 1] }),
      tween(m.r, 0, { duration: 0.3 }),
    ])
    setPlace(id, 'ground')
    void gg
  }

  // The green tick: the prop is knocked away and the load comes down
  async function release() {
    const gg = G.current
    if (!S.stack.length) return
    go('busy')
    S.lastInput = Date.now()
    const load = S.stack.reduce((s, id) => s + byId[id].w, 0)
    sfx.bump()
    await tween(propR, 90, { duration: 0.28, ease: 'easeIn' })
    await slam(load)
    const v = await flight(load)
    if (v === 'right') {
      // the parcels slide off, the flyer's end goes down
      S.stack.forEach((id, i) => { attach.current.delete(id); wait(i * 120).then(() => offSide(id, sizeOf(byId[id]), false)) })
      S.stack = []
      await wait(500)
      await tween(ang, -A, { type: 'spring', stiffness: 260, damping: 16, restDelta: 0.2 })
      propR.jump(0)
      await feast()
      return
    }
    missed(v)
    await wait(600)
    // wound back: the plank goes up again (click, click, click) and the prop stands
    for (let i = 0; i < 4; i++) wait(i * 170).then(() => sfx.step())
    await tween(ang, -A, { duration: 0.8, ease: 'easeInOut' })
    await tween(propR, 0, { duration: 0.3, ease: 'easeOut' })
    void gg
    go('aim')
    S.lastInput = Date.now()
  }

  // ── Level 9: the stair ──────────────────────────────────────────────────
  async function testFire(id) {
    const gg = G.current
    const it = byId[id], m = M(id), s = sizeOf(it)
    go('busy')
    setPlace(id, 'air')
    S.lastInput = Date.now()
    S.fired.add(id)
    const rest = gg.dropAt(s)
    const above = rest.y - Math.max(110, gg.unit * 3.2)
    await Promise.all([
      tween(m.x, rest.x, { duration: 0.5, ease: 'easeInOut' }),
      tween(m.y, [m.y.get(), Math.min(m.y.get(), above) - 40, above], { duration: 0.5, times: [0, 0.6, 1], ease: 'easeOut' }),
    ])
    await tween(m.y, rest.y, { duration: 0.3, ease: 'easeIn' })
    const light = it.w <= BOUNCES
    if (!light) { attach.current.set(id, { along: gg.load, lift: s / 2 }); follow() }
    else sfx.boing()
    const slammed = slam(it.w)
    if (!light) await slammed
    const flying = flight(it.w, { test: true, label: it.e })
    // it hops back to its step
    await wait(light ? 120 : 420)
    attach.current.delete(id)
    const h = homeOf(id)
    await Promise.all([
      tween(m.x, h.x, { duration: 0.6, ease: 'easeInOut' }),
      tween(m.y, [m.y.get(), Math.min(m.y.get(), h.y) - 90, h.y], { duration: 0.6, times: [0, 0.45, 1] }),
      tween(m.r, 0, { duration: 0.4 }),
    ])
    setPlace(id, 'ground')
    await flying
    if (ang.get() > 0) await tween(ang, -A, { type: 'spring', stiffness: 260, damping: 16, restDelta: 0.2 })
    go('aim')
    S.lastInput = Date.now()
  }

  // a thing dragged onto another step changes places with the one there
  async function swapTo(id, k) {
    const from = S.steps.indexOf(id)
    if (from === k || k < 0) { await backHome(id); return }
    const other = S.steps[k]
    const next = [...S.steps]
    next[k] = id; next[from] = other
    S.steps = next
    setSteps(next)
    setBlink([])
    sfx.pop()
    S.lastInput = Date.now()
    const a = M(id), b = M(other)
    const ha = homeOf(id), hb = homeOf(other)
    await Promise.all([
      tween(a.x, ha.x, { duration: 0.3 }), tween(a.y, ha.y, { duration: 0.3 }),
      tween(b.x, hb.x, { duration: 0.45, ease: 'easeInOut' }), tween(b.y, [b.y.get(), Math.min(b.y.get(), hb.y) - 50, hb.y], { duration: 0.45 }),
    ])
  }

  async function checkOrder() {
    const gg = G.current
    go('busy')
    S.lastInput = Date.now()
    const list = S.steps.map(id => byId[id])
    if (!isOrdered(list)) {
      // the ones on the wrong step wiggle; their marks on the tree blink
      const sorted = [...list].sort((a, b) => a.w - b.w)
      const wrong = list.filter((t, i) => sorted[i].id !== t.id)
      setBlink(wrong.map(t => t.e))
      setWiggle(w => w + 1)
      missed('order')
      await wait(900)
      go('aim')
      S.lastInput = Date.now()
      return
    }
    // right: the stair lights up from low to high, then all three jump on
    for (let i = 0; i < 3; i++) {
      sfx.note(i * 2, 0.22)
      const m = M(S.steps[i])
      tween(m.y, [m.y.get(), m.y.get() - 24, m.y.get()], { duration: 0.3 })
      burst(refOf(S.steps[i]).current, 'stars', 6)
      await wait(260)
    }
    // the heaviest first, at the bottom of the pile
    let lift = 0
    const jumps = [...S.steps].reverse().map((id, i) => {
      const s = sizeOf(byId[id]), m = M(id)
      const rest = gg.dropAt(s, -A, lift)
      const at = { along: gg.load, lift: lift + s / 2 }
      lift += s - 8
      setPlace(id, 'air')
      return wait(i * 90).then(() => Promise.all([
        tween(m.x, rest.x, { duration: 0.55, ease: 'easeInOut' }),
        tween(m.y, [m.y.get(), rest.y - 150, rest.y], { duration: 0.55, times: [0, 0.55, 1], ease: 'easeIn' }),
      ])).then(() => { attach.current.set(id, at); setPlace(id, 'plank') })
    })
    await Promise.all(jumps)
    follow()
    await slam(TOP)
    const v = await flight(TOP)
    await afterFlight(v, S.steps)
  }

  // ── Level 10: the bridge ────────────────────────────────────────────────
  const leanNow = n => lean(task.left, task.right + n) * A * 0.8
  async function addBlock() {
    if (S.phase !== 'aim' || S.blocks >= 9) return
    const gg = G.current
    S.lastInput = Date.now()
    const from = L.current.crate
    const n = S.blocks
    const top = stackTop(n)
    flyBlock.x.jump(from.x); flyBlock.y.jump(from.y - 30); flyBlock.o.jump(1)
    S.blocks = n + 1
    await Promise.all([
      tween(flyBlock.x, top.x, { duration: 0.38, ease: 'easeInOut' }),
      tween(flyBlock.y, [from.y - 30, Math.min(from.y, top.y) - 70, top.y], { duration: 0.38, times: [0, 0.5, 1] }),
    ])
    flyBlock.o.jump(0)
    setBlocks(S.blocks)
    sfx.drum(true)
    if (S.live) tween(ang, leanNow(S.blocks), { type: 'spring', stiffness: 160, damping: 11 })
    else tween(ang, [0, 1.2, 0], { duration: 0.22 })
    void gg
  }
  function takeBlock() {
    if (S.phase !== 'aim' || !S.blocks) return
    S.lastInput = Date.now()
    S.blocks -= 1
    setBlocks(S.blocks)
    sfx.slideUp()
    if (S.live) tween(ang, leanNow(S.blocks), { type: 'spring', stiffness: 160, damping: 11 })
  }
  // where the next block lands (two columns, bottom up)
  const stackTop = n => {
    const gg = G.current
    const col = n % 2, row = Math.floor(n / 2)
    return onPlank(gg, ang.get(), BRIDGE * gg.L + (col - 0.5) * (BLK + 2), gg.parcel - 6 + BLK / 2 + row * (BLK + 2))
  }

  async function checkBalance() {
    if (S.phase !== 'aim') return
    const gg = G.current
    go('busy')
    S.lastInput = Date.now()
    const level0 = lean(task.left, task.right + S.blocks) === 0
    if (!S.live) {
      sfx.bump()
      await tween(propR, 90, { duration: 0.3, ease: 'easeIn' })
    }
    if (!level0) {
      sfx.slideDown()
      await tween(ang, leanNow(S.blocks), { type: 'spring', stiffness: 150, damping: 9, restDelta: 0.2 })
      shake(0.6)
      S.live = true
      setLive(true)
      missed('balance')
      await wait(700)
      go('aim')
      S.lastInput = Date.now()
      return
    }
    // it stays level: the flyer walks across, hopping over the parcels
    await tween(ang, [ang.get(), 1.5, -1, 0], { duration: 0.6 })
    const top = gg.py - THICK / 2 - gg.FS / 2 + gg.sink
    const x0 = fx.get(), x1 = gg.stumps[1].x - gg.FS * 0.35
    const hop = gg.parcel + 16
    const tower = gg.parcel + Math.ceil(S.blocks / 2) * (BLK + 2) + 16
    const xs = [x0, gg.px - BRIDGE * gg.L, gg.px, gg.px + BRIDGE * gg.L, x1]
    const ys = [fy.get(), top - hop, top, top - tower, top]
    sfx.slideUp()
    await Promise.all([
      tween(fx, xs, { duration: 2.2, ease: 'linear' }),
      tween(fy, ys, { duration: 2.2, times: [0, 0.25, 0.5, 0.75, 1], ease: 'easeInOut' }),
    ])
    sfx.step()
    // the treat on the stump goes into its paws
    holding.current = true
    setTreatOn('held')
    await Promise.all([tween(tx, fx.get() - gg.FS * 0.3, { duration: 0.2 }), tween(ty, fy.get(), { duration: 0.2 })])
    await feast()
  }

  // Level 10, a task done: the parcels and blocks go off sideways, the props stand up again
  async function clearBridge(ids) {
    const gg = G.current
    const all = [...ids]
    all.forEach((id, i) => {
      attach.current.delete(id)
      const m = M(id)
      const x0 = m.x.get(), y0 = m.y.get()
      wait(i * 140).then(() => Promise.all([
        tween(m.x, [x0, gg.W + 120], { duration: 0.9, ease: 'easeIn' }),
        tween(m.y, [y0, y0 - 90, y0 + 20], { duration: 0.9 }),
        tween(m.r, [0, 280], { duration: 0.9 }),
      ]))
    })
    const sx = stackMv.x.get()
    attach.current.delete('blocks')
    await wait(220)
    tween(stackMv.x, [sx, gg.W + 140], { duration: 0.9, ease: 'easeIn' })
    sfx.whoosh()
    await wait(700)
    setBlocks(0)
    S.blocks = 0
    tween(propR, 0, { duration: 0.3 })
    tween(ang, 0, { duration: 0.4 })
  }

  // ── Taps and drags ─────────────────────────────────────────────────────
  const drag = useRef(null)
  const toField = e => {
    const el = fieldRef.current, r = el.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * el.clientWidth, y: ((e.clientY - r.top) / r.height) * el.clientHeight }
  }
  const canTouch = id => S.phase === 'aim' && !paused && (S.where?.[id] === 'ground' || (mode === 'sum' && S.where?.[id] === 'plank'))

  const tap = id => {
    if (!canTouch(id)) return
    S.lastInput = Date.now()
    setAim(null)
    if (mode === 'throw') throwThing(id)
    else if (mode === 'sum') (S.where[id] === 'plank' ? unloadParcel(id) : loadParcel(id))
    else if (mode === 'order') testFire(id)
  }

  const onDown = e => {
    S.lastInput = Date.now()
    const el = e.target.closest?.('[data-item]')
    if (!el) return
    const id = el.getAttribute('data-item')
    if (!canTouch(id)) return
    const p = toField(e)
    const m = M(id)
    drag.current = { id, x0: p.x, y0: p.y, dx: m.x.get() - p.x, dy: m.y.get() - p.y, moved: false, pid: e.pointerId }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* no capture */ }
  }
  const onMove = e => {
    const d = drag.current
    if (!d || d.pid !== e.pointerId) return
    const p = toField(e)
    if (!d.moved && Math.hypot(p.x - d.x0, p.y - d.y0) < 12) return
    if (!d.moved) { d.moved = true; setPlace(d.id, 'held'); sfx.pop() }
    const m = M(d.id)
    m.x.set(p.x + d.dx); m.y.set(p.y + d.dy - 10)
  }
  const onUp = e => {
    const d = drag.current
    if (!d || d.pid !== e.pointerId) return
    drag.current = null
    if (!d.moved) { tap(d.id); return }
    const gg = G.current, m = M(d.id), it = byId[d.id], s = sizeOf(it)
    const x = m.x.get(), y = m.y.get()
    if (mode === 'order') {
      // onto a step: change places; onto the seesaw: try it
      const st = L.current.stair
      let best = -1, bd = Infinity
      st.forEach((t, k) => { const dd = Math.hypot(x - t.x, y - (t.top - s / 2)); if (dd < bd) { bd = dd; best = k } })
      if (nearDrop(gg, x, y, s)) { setPlace(d.id, 'ground'); testFire(d.id); return }
      setPlace(d.id, 'ground')
      swapTo(d.id, bd < s * 1.1 ? best : -1)
      return
    }
    if (nearDrop(gg, x, y, s)) {
      setPlace(d.id, 'ground')
      if (mode === 'throw') throwThing(d.id, true)
      else if (S.stack.includes(d.id)) backHome(d.id)
      else loadParcel(d.id, true)
      return
    }
    if (mode === 'sum' && S.stack.includes(d.id)) { setPlace(d.id, 'plank'); unloadParcel(d.id); return }
    setPlace(d.id, 'ground')
    backHome(d.id)
  }
  async function backHome(id) {
    const m = M(id), h = homeOf(id)
    if (S.stack.includes(id)) { follow(); return }
    await Promise.all([tween(m.x, h.x, { type: 'spring', stiffness: 300, damping: 20 }), tween(m.y, h.y, { type: 'spring', stiffness: 300, damping: 20 })])
  }
  function nudge(id) {
    const m = M(id)
    sfx.bonk()
    tween(m.r, [0, -10, 9, -6, 0], { duration: 0.4 })
  }

  // keyboard: arrow keys pick nothing here — every item is a button (Enter)
  const keyTap = id => e => { if (e.detail === 0) tap(id) }

  // ── The hand ───────────────────────────────────────────────────────────
  useEffect(() => {
    const iv = setInterval(() => {
      if (paused || S.phase !== 'aim') { setAim(null); return }
      const idle = Date.now() - S.lastInput
      const after = idx === 0 && level <= 2 ? 1800 : idx === 0 ? 3500 : 7000
      if (idle < after && !(S.misses >= 2 && idle > 2500)) { setAim(null); return }
      const next = hintFor()
      setAim(a => (JSON.stringify(a) === JSON.stringify(next) ? a : next))
    }, 400)
    return () => clearInterval(iv)
  })

  function hintFor() {
    const ground = items.filter(i => S.where?.[i.id] === 'ground').map(i => i.id)
    if (mode === 'throw') {
      const right = items.find(i => i.w === task.target)
      const id = S.misses >= 2 && ground.includes(right.id) ? right.id : ground[0]
      return id ? { from: id, to: 'drop' } : null
    }
    if (mode === 'sum') {
      const sol = sumSolution(task.parcels, task.target) ?? []
      if (S.misses >= 2) {
        const extra = S.stack.find(id => !sol.includes(id))
        if (extra) return { tap: extra }
        const need = sol.find(id => !S.stack.includes(id))
        if (need) return { from: need, to: 'drop' }
        return { tap: 'done' }
      }
      if (!S.stack.length) return { from: ground[0], to: 'drop' }
      return { tap: 'done' }
    }
    if (mode === 'order') {
      const unfired = S.steps.find(id => !S.fired.has(id))
      if (unfired && S.misses < 2) return { tap: unfired }
      const list = S.steps.map(id => byId[id])
      if (!isOrdered(list)) {
        const sorted = [...list].sort((a, b) => a.w - b.w)
        const k = list.findIndex((t, i) => sorted[i].id !== t.id)
        if (S.misses >= 1 || !unfired) return { from: sorted[k].id, toStep: k }
      }
      return { tap: 'done' }
    }
    // balance
    if (S.blocks === 0) return { from: 'crate', to: 'stack' }
    return { tap: 'done' }
  }

  const refFor = key => (key === 'drop' ? dropRef : key === 'done' ? doneRef : key === 'crate' ? crateRef : key === 'stack' ? stackRef : refOf(key))

  // ── The picture ─────────────────────────────────────────────────────────
  const finished = useRef(false)
  const glowIds = useMemo(() => {
    if (misses < 2) return []
    if (mode === 'throw') return items.filter(i => i.w === task.target).map(i => i.id)
    if (mode === 'sum') return sumSolution(task.parcels, task.target) ?? []
    return []
  }, [misses, mode, items, task])

  const field = (
    <div ref={fieldRef} data-field="1" style={{ position: 'absolute', inset: 0 }}>
      {g && lay && (
        <>
          {mode !== 'balance' && <Tree g={g} numbers={mode === 'sum'} target={mode === 'sum' ? task.target : null} />}
          {mode !== 'balance' && treatOn === 'hang' && <TreatBranch g={g} step={task.target} />}
          {mode !== 'balance' && marks.map(mk => <Mark key={mk.key} g={g} step={mk.step} art={mk.art} n={mk.n} blink={blink.includes(mk.art)} />)}
          {mode === 'balance' && g.stumps.map((s, i) => <Stump key={i} x={s.x} top={s.top} bottom={g.ground + 4} w={s.w} />)}
          <Branch g={g} guests={guests} seats={TASKS} />
          <div style={{ position: 'absolute', right: 12, top: 8, zIndex: 8 }}>{juice.hud}</div>

          <Stand g={g} />
          {mode === 'sum' && (() => {
            const p = onPlank(g, -A, g.load, 0)
            const foot = g.ground + 2
            const x = g.px + g.load * Math.cos((A * Math.PI) / 180)
            return <Prop x={x} foot={foot} height={foot - (p.y + THICK)} rot={propR} />
          })()}
          {mode === 'balance' && [-1, 1].map(side => {
            const foot = g.ground + 2
            return <Prop key={side} x={g.px + side * 0.55 * g.L} foot={foot} height={foot - (g.py + THICK / 2)} rot={side < 0 ? propL : propR} />
          })}
          <Plank g={g} ang={ang} seat={mode !== 'balance'} />

          {/* where things are dropped: the raised end */}
          {(() => {
            const d = g.dropAt(g.thing * 0.6)
            return <div ref={dropRef} data-drop="1" aria-hidden="true" style={{ position: 'absolute', left: d.x - 2, top: d.y - 2, width: 4, height: 4 }} />
          })()}

          {/* the stair (level 9) */}
          {mode === 'order' && (
            <>
              <Stair steps={lay.stair} bottom={g.supply.y1 + 8} />
              {lay.stair.map((s, k) => <div key={k} ref={stepRefs[k]} aria-hidden="true" style={{ position: 'absolute', left: s.x - 2, top: s.top - g.thing / 2, width: 4, height: 4 }} />)}
            </>
          )}

          {/* the treat */}
          {treatOn !== 'gone' && (
            <motion.div aria-hidden="true" style={{ position: 'absolute', left: -g.treat / 2, top: -g.treat / 2, x: tx, y: ty, scale: ts, zIndex: treatOn === 'held' ? 7 : 4, width: g.treat, height: g.treat, pointerEvents: 'none' }}>
              <Art art={flyer.treat} size={g.treat} />
            </motion.div>
          )}

          {/* the flyer */}
          {showFlyer && (
            <motion.div data-flyer={flyer.label} style={{ position: 'absolute', left: -g.FS / 2, top: -g.FS / 2, width: g.FS, height: g.FS, x: fx, y: fy, rotate: fr, scale: fs, zIndex: 6 }}>
              {trail && <Trail fy={fy} size={g.FS} />}
              <AnimatePresence>
                {chute && (
                  <motion.div key="chute" initial={{ scale: 0.1, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.3, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 380, damping: 14 }}
                    style={{ position: 'absolute', left: -g.FS * 0.25, top: -g.FS * 0.98, transformOrigin: '50% 100%', pointerEvents: 'none' }}>
                    <Parachute size={g.FS} />
                  </motion.div>
                )}
              </AnimatePresence>
              <div ref={flyerRef}>
                <Critter art={flyer.art} size={g.FS} mood={flyerMood} label={flyer.label} shadow={false} />
              </div>
            </motion.div>
          )}

          {/* things to throw, parcels: each with its shadow on the grass */}
          {mode !== 'order' && items.map(it => {
            if (where[it.id] !== 'ground' && where[it.id] !== 'held') return null
            const h = homeOf(it.id), s = sizeOf(it)
            return <div key={`sh${it.id}`} aria-hidden="true" style={{ position: 'absolute', left: h.x - s * 0.36, top: h.y + s / 2 - 8, width: s * 0.72, height: 12, borderRadius: '50%', background: 'rgba(42,27,61,0.18)', zIndex: 2 }} />
          })}
          {items.map(it => {
            const m = M(it.id), s = sizeOf(it)
            const w = where[it.id]
            if (w === 'out') return null
            const up = w === 'air' || w === 'held'
            // a small thing still gets a finger-sized place to tap
            const hitS = Math.max(s, wide ? 88 : 76)
            return (
              <motion.button key={it.id} ref={el => { refOf(it.id).current = el }} type="button" data-item={it.id} data-w={it.w}
                data-where={w} data-step={mode === 'order' && S.steps ? S.steps.indexOf(it.id) : undefined}
                aria-label={it.kind === 'parcel' ? `Paket ${it.n}` : it.label} onClick={keyTap(it.id)}
                style={{
                  all: 'unset', position: 'absolute', left: -hitS / 2, top: -hitS / 2, width: hitS, height: hitS, x: m.x, y: m.y, rotate: m.r, scale: m.s,
                  zIndex: up ? 9 : w === 'plank' ? 5 : w === 'gone' ? 3 : 6, cursor: 'pointer', touchAction: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', WebkitTapHighlightColor: 'transparent',
                }}>
                <motion.div key={`w${wiggle}`} animate={wiggle && blink.includes(it.e) && !reduce ? { rotate: [0, -12, 10, -8, 5, 0] } : {}} transition={{ duration: 0.6 }}
                  style={{ position: 'relative', width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center', filter: w === 'held' ? 'drop-shadow(0 10px 6px rgba(42,27,61,0.3))' : undefined }}>
                  {it.kind === 'parcel'
                    ? <Parcel n={it.n} size={s} glow={glowIds.includes(it.id)} />
                    : <>{glowIds.includes(it.id) && <Glow size={s} />}<Art art={it.e} size={s} /></>}
                </motion.div>
              </motion.button>
            )
          })}

          {/* level 10: the parcels on the plank, the blocks, the crate */}
          {mode === 'balance' && (
            <>
              {[['left', task.left], ['right', task.right]].map(([id, n]) => {
                const m = M(id)
                if (!m) return null
                return (
                  <motion.div key={`${id}${idx}`} aria-hidden="true" style={{ position: 'absolute', left: -g.parcel / 2, top: -g.parcel / 2, x: m.x, y: m.y, rotate: m.r, scale: m.s, zIndex: 5 }}>
                    <Parcel n={n} size={g.parcel} />
                  </motion.div>
                )
              })}
              {phase !== 'finale' && <motion.button ref={stackRef} type="button" aria-label="Klotz wegnehmen" onClick={takeBlock}
                style={{ all: 'unset', position: 'absolute', left: -(BLK + 2), top: -BLK * 5, width: BLK * 2 + 4, height: BLK * 5, x: stackMv.x, y: stackMv.y, rotate: stackMv.r, zIndex: 5, cursor: 'pointer', transformOrigin: '50% 100%' }}>
                <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', display: 'flex', flexWrap: 'wrap-reverse', gap: 2, alignContent: 'flex-start' }}>
                  {Array.from({ length: Math.max(blocks, misses >= 2 ? task.need : 0) }, (_, i) => (
                    <motion.div key={i} initial={i < blocks ? { scale: 1.3 } : false} animate={{ scale: 1 }}>
                      <Block size={BLK} ghost={i >= blocks} />
                    </motion.div>
                  ))}
                </div>
              </motion.button>}
              <motion.div aria-hidden="true" style={{ position: 'absolute', left: -BLK / 2, top: -BLK / 2, x: flyBlock.x, y: flyBlock.y, opacity: flyBlock.o, zIndex: 9, pointerEvents: 'none' }}>
                <Block size={BLK} />
              </motion.div>
              <button ref={crateRef} type="button" aria-label="Klotz drauflegen" onClick={addBlock}
                style={{ all: 'unset', position: 'absolute', left: lay.crate.x - 60, top: lay.crate.y - 50, width: 120, height: 104, cursor: 'pointer', zIndex: 6, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                <Crate size={112} />
              </button>
            </>
          )}

          {/* the green tick */}
          {withButton && lay.button && (
            <div ref={doneRef} style={{ position: 'absolute', left: lay.button.x - 42, top: lay.button.y - 42, zIndex: 8 }}>
              <DoneButton size={84} onClick={() => { if (S.phase !== 'aim') return; setAim(null); if (mode === 'sum') release(); else if (mode === 'order') checkOrder(); else checkBalance() }}
                disabled={phase !== 'aim' || (mode === 'sum' && !items.some(i => where[i.id] === 'plank'))} />
            </div>
          )}
        </>
      )}
    </div>
  )

  return (
    <div ref={juice.stage} data-game="wippe" data-mode={mode} data-phase={phase} data-task={idx} data-level={level}
      data-target={task.mode === 'balance' ? task.need : task.target} data-misses={misses} data-guests={guests.length}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
      style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {field}
      {aim && (aim.tap
        ? <HintHand key={`t${idx}-${aim.tap}`} to={refFor(aim.tap)} active delay={0} repeat={2} />
        : <HintHand key={`d${idx}-${aim.from}-${aim.to ?? aim.toStep}`} from={refFor(aim.from)} to={aim.toStep != null ? stepRefs[aim.toStep] : refFor(aim.to)} active delay={0} repeat={2} />)}
      {phase === 'finale' && (
        <Finale cast={[...new Set(tasks.map(t => t.flyer.art))]} size={wide ? 104 : 84}
          onDone={() => { if (!finished.current) { finished.current = true; onComplete(result(S.firstTry, TASKS)) } }} />
      )}
      {bursts}
      {juice.layer}
    </div>
  )
}

// Speed lines under the flyer while it shoots up
function Trail({ fy, size }) {
  const h = useTransform(fy, () => clamp(-fy.getVelocity() * 0.16, 0, size * 2.2))
  const o = useTransform(h, v => clamp(v / (size * 0.8), 0, 0.85))
  return (
    <motion.div aria-hidden="true" style={{ position: 'absolute', left: size * 0.22, top: size * 0.8, width: size * 0.56, height: h, opacity: o, pointerEvents: 'none', display: 'flex', justifyContent: 'space-between' }}>
      {[0.55, 1, 0.7].map((k, i) => (
        <div key={i} style={{ width: 6, height: `${k * 100}%`, marginTop: i === 1 ? 0 : 10, borderRadius: 3, background: 'linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0))' }} />
      ))}
    </motion.div>
  )
}

// motion values made outside a hook, for the items of a task
const motionValueOf = v => motionValue(v)
