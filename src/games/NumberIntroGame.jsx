import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationFrame, useAnimationControls, useMotionValue, motionValue, useReducedMotion } from 'framer-motion'
import { lockPreviews, leaveGame, narrate, afterNarration } from '../narrator.js'
import { numberWord } from '../lib/words.js'
import { LINES, line } from '../lib/lumiLines.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { sfx } from '../sfx.js'
import { Critter, useMood, useBursts, useJuice, HintHand } from '../components/play/index.js'
import { isStreakMilestone } from '../components/play/Juice.jsx'
import { animalSound } from '../lib/animalSounds.js'
import { asset } from '../lib/assets.js'
import { Stage, useLater, usePops, Finale } from './zahlen/stage.jsx'
import { levelConfig, tasksFor, capacity, isRight, judge, nextDrop, dropX, paceAfter, slotOf, colsFor } from './zahlen/fangen.js'
import { Basket, Nest, Fruit, Boot, Crown, Trunk, Sign, MampfButton, Picnic, CompareBoard, boardLayout, treeSpans, BASKET_H, BASKET_FLOOR } from './zahlen/fangenParts.jsx'

/**
 * Zahlen entdecken — "Bruno fängt": counting out exactly n and stopping;
 * numeral and amount
 *
 * Fruit falls from a tree. The child moves Bruno the bear with his basket
 * (he follows the finger anywhere on the screen) and catches it. The sign
 * says how many: the numeral, the fruit, the amount as dots. Every catch
 * lands in the basket where it can be counted, its number pops up and Lumi
 * counts along ("eins, zwei, drei"). Fruit that is not caught lands on the
 * grass and bounces away; that is never a miss.
 *
 *   • Levels 1–3: the basket has one hollow per fruit wanted; a full basket
 *     is eaten at once. One fruit at a time, slowly, always within reach.
 *   • Levels 4–6: no hollows. Fruit keeps falling, and the child decides
 *     when it is enough and presses "Mampf" (a face with its mouth open).
 *       – exactly right: the animal eats and sits down at the picnic
 *       – too few: the basket is laid against the sign's dots, one fruit
 *         on each dot; the empty dots are what is missing. Go on catching.
 *       – too many: the same board; the fruit without a dot rolls away one
 *         by one, then the animal eats (not a first try).
 *   • Levels 7–8: two kinds fall, only the one on the sign is wanted (the
 *     other bounces off the rim, the animal shakes its head), and an old
 *     boot is to be dodged (caught: it hops out again, the streak is over).
 *   • Levels 9–10: two amounts at once ("2 apples and 3 pears"), both the
 *     animal's own food, a basket with two halves, a little faster. Lumi
 *     does not count along here (two counts at once ran into "eins, eins,
 *     zwei, zwei"); the count pops up over each half, and Lumi says both
 *     amounts when the animal eats.
 *
 * Two kinds (levels 7–10) grow on two trees, each falling from its own.
 *
 * After two wrong presses in a task the hollows come back for that task.
 * Different animals take turns; everyone who has eaten sits down on the
 * picnic blanket, which has one place per task: that is the collection and
 * the progress of the level. The result is the number of tasks eaten right
 * on the first "Mampf" (or the first full basket).
 *
 * Game feel (components/play/Juice.jsx): every catch that was still wanted
 * is a hit (a note that climbs, a star to the counter); a catch too many
 * only thuds. A golden fruit now and then counts as one like any other and
 * showers stars. The fall speed eases up after a miss and picks up a little
 * after a task done right (zahlen/fangen.js, paceAfter).
 *
 * Why this: giving exactly n of more things and stopping is the "give me
 * n" task, the measure of whether a child knows what a number word means
 * (cardinality; Wynn 1992, Sarnecka & Carey 2008). Here stopping is the
 * game: the fruit keeps coming.
 */

const FS = 54                 // a falling fruit
const ANIMAL = 124
const ANIMAL_UP = 60          // the animal stands behind the basket, this far up
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

// How long an animal's own sound lasts: it makes it when it turns happy
// (Critter), and Lumi's praise waits for it instead of talking over it
const soundMs = {}
function measureSound(art) {
  const name = animalSound(art)
  if (!name || name in soundMs || typeof Audio === 'undefined') return
  soundMs[name] = 1000
  try {
    const a = new Audio(asset(`audio/tiere/${name}.mp3`))
    a.preload = 'metadata'
    a.addEventListener('loadedmetadata', () => { if (Number.isFinite(a.duration)) soundMs[name] = a.duration * 1000 }, { once: true })
  } catch { /* no audio: the guess stays */ }
}
const soundOf = art => { const name = animalSound(art); return name ? soundMs[name] ?? 1000 : 0 }

// Lines Lumi may get later; the game is silent there until they are recorded
const optional = key => (LINES[key] ? line(key) : null)
const SAY = {
  nests: 'bruno/fang-so-viele',
  free: 'bruno/genug-dann-mampf',
  other: 'bruno/nur-vom-schild',
  pair: 'bruno/zwei-sorten',
  few: 'bruno/zu-wenig',
  many: 'bruno/zu-viel',
}

export default function NumberIntroGame({ level = 1, onComplete }) {
  // wide: sign and "Mampf" left, picnic right · tall: sign above, picnic and "Mampf" below
  return (
    <Stage wide={[800, 410]} tall={[440, 760]}>
      {wide => <Play wide={wide} level={level} onComplete={onComplete} />}
    </Stage>
  )
}

function Play({ wide, level, onComplete }) {
  const cfg = useMemo(() => levelConfig(level), [level])
  const tasks = useMemo(() => tasksFor(level), [level])
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const reduce = useReducedMotion()
  const { later, afterSpeech } = useLater()
  const juice = useJuice({ hudSize: 36 })
  const { hit, miss, shake } = juice   // these three never change
  const [bursts, burst] = useBursts()
  const [mood, setMood] = useMood()
  const [pops, pop] = usePops({ size: 62 })
  const nope = useAnimationControls()
  const squash = useAnimationControls()

  const fieldRef = useRef(null), basketRef = useRef(null), animalRef = useRef(null), mampfRef = useRef(null), anchorRef = useRef(null)
  const [size, setSize] = useState(null)        // the field, in its own (unscaled) px

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState('enter')   // enter | play | check | eat | leave | finale
  const [air, setAir] = useState([])            // what is falling
  const [basket, setBasket] = useState([[], []]) // what was caught, per kind
  const [guests, setGuests] = useState([])      // who has eaten and sits at the picnic
  const [misses, setMisses] = useState(0)       // wrong presses in this task
  const [cmp, setCmp] = useState(null)          // the basket laid against the dots
  const [eating, setEating] = useState(false)
  const [stuffed, setStuffed] = useState(false)
  const [facing, setFacing] = useState(1)
  const [boot, setBoot] = useState(null)        // a boot that landed in the basket
  const [bump, setBump] = useState(0)           // the sign hops
  const [aim, setAim] = useState(null)          // where the hand points: { x } | 'mampf'
  const firstTry = useRef(0)

  const bx = useMotionValue(-400), tilt = useMotionValue(0), lag = useMotionValue(0), fade = useMotionValue(0)

  // What the clock works on; the state above is its picture
  const g = useRef({
    t: 0, phase: 'enter', bx: -400, bv: 0, target: 0, locked: false, facing: 1, ready: false,
    items: new Map(), seq: 0, nextSpawn: 0, sinceWanted: 0, goldDone: false, first: true,
    counts: [0, 0], misses: 0, pace: 1, rightSince: null, lastInput: 0, done: false, streak: 0,
  }).current

  const task = tasks[idx]
  const pair = task.wants.length > 1
  const free = cfg.mode !== 'nests'
  const nests = !free || misses >= 2
  const BW = pair ? 230 : 190
  const cols = colsFor(task, nests)
  const cell = pair ? 32 : cols <= 4 ? 40 : 34
  const fw = size?.w ?? 0, fh = size?.h ?? 0
  const crownH = !wide ? 84 : fh < 450 ? 66 : 76
  const groundY = fh - 12
  const halfX = k => (pair ? (k === 0 ? -1 : 1) * (BW / 4 + 1) : 0)
  const boardCell = pair ? 40 : wide ? 46 : 44
  // two kinds, two trees: which tree each kind (want 0, want 1 or other) falls from
  const kinds = task.wants.length + (task.other ? 1 : 0)
  const sides = useMemo(() => (Math.random() < 0.5 ? [0, 1] : [1, 0]), [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const go = p => { g.phase = p; setPhase(p) }

  useEffect(() => leaveGame, [])

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

  // A new animal comes in with an empty basket: Lumi says the number
  useEffect(() => {
    lockPreviews()
    measureSound(task.eater.art)
    sayTask()
    const intro = idx === 0 ? optional(SAY[pair ? 'pair' : task.other ? 'other' : free ? 'free' : 'nests']) : null
    const words = task.wants.map((w, k) => { const p = numberWord(w.n); return p && k > 0 ? { ...p, gap: 250 } : p })
    // after any praise still being spoken, not over it
    return afterNarration(() => narrate([intro, ...words]))
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── What happens ────────────────────────────────────────────────────────

  // A good catch: the star starts at the basket. When the flame banner is
  // due (three, five, eight in a row) it would cover the catcher's face and
  // the count, so that hit is placed above them.
  const good = opts => {
    g.streak += 1
    let at = basketRef.current
    const a = animalRef.current?.getBoundingClientRect()
    if (isStreakMilestone(g.streak) && a?.height) at = { x: a.left + a.width / 2, y: a.top - (a.height / ANIMAL) * 109 + 59 }
    return hit(at, opts)
  }
  const bad = at => { g.streak = 0; miss(at) }

  const dropItem = id => { g.items.delete(id); setAir(l => l.filter(a => a.id !== id)) }

  // Everything still in the air is gone in a puff (the basket is being looked at)
  const clearAir = () => { for (const it of g.items.values()) if (it.state !== 'poof') { it.state = 'poof'; it.t0 = g.t } }

  const leave = () => {
    go('leave')
    g.locked = true
    g.target = g.fw + 420
    later(reduce ? 300 : 650, () => {
      setGuests(l => [...l, { art: task.eater.art, label: task.eater.label }])
      sfx.pop()
      if (idx + 1 >= tasks.length) { go('finale'); return }
      g.counts = [0, 0]; g.misses = 0; g.first = true; g.goldDone = false; g.sinceWanted = 0; g.rightSince = null
      g.bx = -420; g.bv = 0; g.target = g.fw / 2; g.locked = false
      setBasket([[], []]); setMisses(0); setMood('idle'); setIdx(idx + 1); setBump(b => b + 1)
      go('enter')
    })
  }

  // The animal eats what is in the basket, one after the other. `rolled`:
  // the game rolled the ones too many out itself; nothing to praise then.
  const eat = (clean, { rolled = false } = {}) => {
    go('eat')
    g.locked = true
    g.target = g.bx
    clearAir()
    const total = g.counts[0] + g.counts[1]
    setEating(true)
    setMood('eat', 400 + total * 130)
    for (let i = 0; i < Math.ceil(total / 2); i++) later(120 + i * 260, () => sfx.chomp())
    // two kinds: no count along the way, so both amounts now
    if (pair) narrate(task.wants.map((w, k) => { const p = numberWord(w.n); return p && k > 0 ? { ...p, gap: 250 } : p }))
    afterSpeech(() => {
      setEating(false)
      setBasket([[], []])
      let big = false
      if (clean) {
        firstTry.current += 1
        g.pace = paceAfter(g.pace, 'right')
        // two stars more for the animal fed right on the first try
        big = good({ stars: 2, silent: true }).milestone
        sfx.slideUp()
      }
      // the animal is happy and makes its sound; Lumi's praise follows it
      setMood(big ? 'dance' : 'happy', big ? 2200 : 1300)
      burst(animalRef.current, big ? 'confetti' : 'hearts', big ? 18 : 10)
      if (rolled) { afterSpeech(leave, Math.max(1100, soundOf(task.eater.art) + 300)); return }
      later(soundOf(task.eater.art) + 150, () => {
        sayRight()
        afterSpeech(leave, big ? 1900 : 1100)
      })
    }, 420 + total * 130)
  }

  // "Mampf" with the wrong amount: the basket is laid against the sign's dots
  const wrong = verdict => {
    go('check')
    g.locked = true
    g.target = g.bx
    g.misses += 1
    g.pace = paceAfter(g.pace, 'miss')
    g.rightSince = null
    setMisses(g.misses)
    clearAir()
    bad(mampfRef.current)
    // "Noch nicht ganz.", then what was wrong ("Das war zu viel."): one after the other
    const said = optional(SAY[verdict === 'few' ? 'few' : 'many'])
    sayWrong(undefined, said ? { onEnd: () => narrate([said]) } : {})
    const counts = [...g.counts]
    const most = Math.max(...counts)
    const L = boardLayout(task.wants, counts, boardCell)
    const top = crownH + 16
    setCmp({ counts, rolled: [0, 0], show: false, top, from: { x: g.bx - (g.fw / 2 - L.width / 2), y: groundY - BASKET_H / 2 - top } })
    const flown = (reduce ? 300 : 520) + most * 80
    if (verdict === 'few') setMood('hungry', flown + 1900)
    later(flown, () => {
      setCmp(c => c && { ...c, show: true })
      setBump(b => b + 1)
      if (verdict !== 'few') { setStuffed(true); shake(0.6) }
    })
    const back = () => {
      setCmp(null)
      setStuffed(false)
      g.locked = false
      g.nextSpawn = g.t + 0.5
      go('play')
    }
    // (each step waits for Lumi to finish what she is saying)
    if (verdict === 'few') { afterSpeech(back, flown + 1900); return }
    // the ones too many roll away, one by one, and Lumi counts back
    const extras = task.wants.flatMap((w, k) => Array.from({ length: Math.max(0, counts[k] - w.n) }, () => k))
    afterSpeech(() => {
      extras.forEach((k, e) => later(e * 560, () => {
        g.counts[k] -= 1
        setCmp(c => c && { ...c, rolled: c.rolled.map((r, j) => (j === k ? r + 1 : r)) })
        setBasket(b => b.map((list, j) => (j === k ? list.slice(0, -1) : list)))
        sfx.boing()
        narrate([numberWord(g.counts[k])])
      }))
      later(extras.length * 560 + 500, () => {
        if (verdict === 'many') {
          setCmp(null)
          setStuffed(false)
          sfx.burp()
          // the game put it right, not the child: no praise for it
          later(350, () => eat(false, { rolled: true }))
        } else back()
      })
    }, flown + 800)
  }

  const mampf = () => {
    if (g.phase !== 'play' || pausedRef.current) return
    g.lastInput = Date.now()
    const { verdict } = judge(g.counts, task.wants)
    if (verdict === 'right') eat(g.misses === 0)
    else wrong(verdict)
  }

  // Something reached the basket. → true when it is in, false when it bounced off
  const caught = (it, dx) => {
    const off = () => {
      it.state = 'bounce'
      it.vy = -430
      it.vx = (dx >= 0 ? 1 : -1) * 170 + g.bv * 0.25
      it.vr = (dx >= 0 ? 1 : -1) * 420
      sfx.boing()
    }
    if (it.kind === 'boot') {
      // an old boot: in, and out again
      dropItem(it.id)
      setBoot({ id: it.id, dir: dx >= 0 ? 1 : -1, x: clamp(dx, -BW / 3, BW / 3) })
      bad(basketRef.current)
      shake(0.8)
      sfx.slideDown()
      g.pace = paceAfter(g.pace, 'miss')
      shakeHead()
      return true
    }
    const k = it.which
    const want = task.wants[k]
    const cap = nests ? want.n : capacity(task, k)
    if (it.kind === 'other' || g.counts[k] >= cap) {
      off()
      if (it.kind === 'other') shakeHead()
      return false
    }
    g.counts[k] += 1
    const c = g.counts[k]
    const s = slotOf(c - 1, cols)
    const sx = s.x * cell + halfX(k), sy = BASKET_FLOOR - cell * s.row - cell / 2
    dropItem(it.id)
    setBasket(b => b.map((list, j) => (j === k ? [...list, { id: it.id, gold: it.gold, fx: dx - sx, fy: it.y - (groundY - BASKET_H) - sy }] : list)))
    sfx.drum()
    if (!reduce) squash.start({ scaleY: [1, 0.86, 1.05, 1], scaleX: [1, 1.05, 0.98, 1], transition: { duration: 0.32 } })
    pop(c, halfX(k))
    // two kinds: no counting along, it would run the two counts into each other
    if (!pair) narrate([numberWord(c)])
    if (c <= want.n) {
      // one that was still wanted: a note, a star
      good({ stars: it.gold ? 3 : 1 })
      if (it.gold) { burst(basketRef.current, 'stars', 16); sfx.sparkle() }
    }
    const right = isRight(g.counts, task.wants)
    g.rightSince = right ? g.t : null
    if (cfg.gap == null) g.nextSpawn = g.t + 0.5
    // a basket with hollows is eaten as soon as it is full
    if (nests && right) later(520, () => { if (g.phase === 'play') eat(g.misses === 0) })
    return true
  }

  const shakeHead = () => { if (!reduce) nope.start({ rotate: [0, -10, 9, -7, 5, 0], transition: { duration: 0.5 } }) }

  // The loop reads the newest of all this
  const live = useRef(null)
  live.current = { task, cfg, nests, BW, caught, reduce, crownH, groundY, level, idx, kinds, sides, wide }

  // ── The clock: the catcher, what falls ──────────────────────────────────

  useAnimationFrame((_, delta) => {
    const L = live.current
    if (pausedRef.current || !g.ready) return
    const dt = Math.min(delta / 1000, 0.05)
    g.t += dt
    const half = L.BW / 2

    // The catcher follows the finger with a little lag; the basket leans and trails
    const lo = half + 4, hi = g.fw - half - 4
    const tx = g.locked ? g.target : clamp(g.target, lo, hi)
    g.bv += (110 * (tx - g.bx) - 21 * g.bv) * dt
    const vmax = g.phase === 'enter' || g.phase === 'leave' ? 680 : 1500
    g.bv = clamp(g.bv, -vmax, vmax)
    g.bx += g.bv * dt
    bx.set(g.bx)
    const trail = L.reduce ? 0 : clamp(-g.bv * 0.02, -12, 12)
    lag.set(trail)
    tilt.set(L.reduce ? 0 : clamp(g.bv * 0.022, -9, 9))
    // wide: the field ends at the sign and the picnic, so the animal is
    // whole only inside it (it is clipped at the edges, see the field)
    const edge = L.wide ? half : -60
    fade.set(clamp(1 - Math.max(edge - g.bx, g.bx - g.fw + edge, 0) / (L.wide ? 120 : 90), 0, 1))
    if (Math.abs(g.bv) > 50 && g.phase !== 'leave') {
      const f = g.bv > 0 ? 1 : -1
      if (f !== g.facing) { g.facing = f; setFacing(f) }
    }
    if (g.phase === 'enter' && g.bx > lo - 20) { g.nextSpawn = g.t + 0.4; go('play') }

    // Something new in the tree
    const active = []
    for (const it of g.items.values()) if (it.state === 'hang' || it.state === 'fall') active.push(it)
    if (g.phase === 'play' && g.t >= g.nextSpawn && (L.cfg.gap == null ? active.length === 0 : active.length < 4)) {
      const right = isRight(g.counts, L.task.wants)
      const d = nextDrop(L.cfg, { counts: g.counts, wants: L.task.wants, hasOther: !!L.task.other, sinceWanted: g.sinceWanted, goldDone: g.goldDone, first: g.first })
      // two trees: a fruit falls from its own kind's tree (a boot from anywhere)
      const tree = L.kinds > 1 && d.kind !== 'boot' ? L.sides[d.kind === 'other' ? 1 : d.which] : null
      const [lo, hi] = tree == null ? [46, g.fw - 46] : treeSpans(g.fw, 2)[tree].map((v, j) => v + (j ? -34 : 34))
      const x = dropX({
        lo, hi, bx: g.bx, reach: L.cfg.reach, width: g.fw, taken: active.map(i => i.x), half, spread: tree != null,
        avoid: right && Math.random() < L.cfg.safe, onto: g.first && L.idx === 0 && L.level <= 3,
      })
      const id = ++g.seq
      const y = L.crownH - 10
      const fruit = d.kind === 'boot' ? null : d.kind === 'other' ? L.task.other : L.task.wants[d.which].fruit
      g.items.set(id, {
        id, kind: d.kind, which: d.which, gold: d.gold, x, y, vx: 0, vy: 0, rot: 0, vr: (Math.random() - 0.5) * 160, state: 'hang', t0: g.t,
        until: g.t + (L.level <= 3 ? 0.8 : 0.55), bounced: false,
        mx: motionValue(x), my: motionValue(y), mr: motionValue(0), ms: motionValue(1),
      })
      setAir(l => [...l, { id, kind: d.kind, which: d.which, gold: d.gold, fruit }])
      g.first = false
      g.sinceWanted = d.kind === 'want' ? 0 : g.sinceWanted + 1
      if (d.gold) g.goldDone = true
      g.nextSpawn = L.cfg.gap == null ? g.t : g.t + (L.cfg.gap / g.pace) * (0.85 + Math.random() * 0.3)
    }

    // What is in the air
    const rimY = L.groundY - BASKET_H + 30, landY = L.groundY - FS / 2 + 4
    const speed = ((rimY - (L.crownH - 10)) / L.cfg.fall) * g.pace * (L.reduce ? 0.85 : 1)
    const catchHalf = half - 14 + (L.level <= 3 ? 12 : 4)
    const basketX = g.bx + trail
    for (const it of [...g.items.values()]) {
      if (it.state === 'hang') {
        // it wiggles before it lets go, so the child sees where the next one comes from
        it.rot = L.reduce ? 0 : Math.sin((g.t - it.t0) * 24) * 10
        if (g.t >= it.until) { it.state = 'fall'; it.t0 = g.t; it.rot = 0 }
      } else if (it.state === 'fall') {
        it.y += speed * Math.min(1, 0.3 + (g.t - it.t0) * 2.4) * dt
        if (!L.reduce) it.rot += it.vr * dt
        if (g.phase === 'play' && it.y >= rimY && it.y <= rimY + 30) {
          const dx = it.x - basketX
          if (Math.abs(dx) <= catchHalf) { if (L.caught(it, dx)) continue }
          else if (!it.rim && Math.abs(dx) <= half + FS * 0.3) {
            // off the rim: so close
            it.rim = true; it.state = 'bounce'; it.vy = -380; it.vx = Math.sign(dx) * 190; it.vr = Math.sign(dx) * 400
            sfx.step()
          }
        }
        if (it.state === 'fall' && it.y >= landY) {
          // on the grass: a bounce, and away. Never a miss.
          if (L.reduce) { it.state = 'poof'; it.t0 = g.t }
          else { it.state = 'roll'; it.vy = -260; it.vx = (Math.random() < 0.5 ? -1 : 1) * (60 + Math.random() * 60); it.vr = Math.sign(it.vx) * 300 }
          sfx.step()
          if (L.cfg.gap == null) g.nextSpawn = g.t + 0.45
        }
      } else if (it.state === 'roll' || it.state === 'bounce') {
        it.vy += 1500 * dt
        it.x += it.vx * dt
        it.y += it.vy * dt
        it.rot += it.vr * dt
        if (it.state === 'roll' && it.y >= landY && it.vy > 0) {
          if (it.bounced) { it.state = 'poof'; it.t0 = g.t }
          else { it.bounced = true; it.y = landY; it.vy = -150 }
        }
        if (it.y > g.fh + 80) { g.items.delete(it.id); setAir(l => l.filter(a => a.id !== it.id)); if (L.cfg.gap == null) g.nextSpawn = g.t + 0.3; continue }
      } else if (it.state === 'poof') {
        const s = 1 - (g.t - it.t0) / 0.18
        if (s <= 0) { g.items.delete(it.id); setAir(l => l.filter(a => a.id !== it.id)); continue }
        it.ms.set(s)
      }
      it.mx.set(it.x); it.my.set(it.y); it.mr.set(it.rot)
    }
  })

  // The field got its size (or a new one): the catcher comes in from the left
  useEffect(() => {
    if (!size) return
    g.fw = size.w; g.fh = size.h
    if (!g.ready) { g.ready = true; g.target = size.w / 2; g.lastInput = Date.now() }
    else if (!g.locked) g.target = clamp(g.target, 0, size.w)
  }, [size, g])

  // ── The finger ──────────────────────────────────────────────────────────

  const steer = e => {
    if (e.target.closest?.('[data-nosteer]')) return
    const el = fieldRef.current
    const r = el.getBoundingClientRect()
    if (!r.width) return
    g.lastInput = Date.now()
    if (!g.locked) g.target = ((e.clientX - r.left) / r.width) * el.clientWidth
  }
  useEffect(() => {
    const key = e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      g.lastInput = Date.now()
      if (!g.locked && g.phase === 'play') g.target = clamp(g.bx + (e.key === 'ArrowLeft' ? -110 : 110), 0, g.fw)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [g])

  // A child that waits is shown the move: the hand drags the basket under
  // a falling fruit; and when the basket is right, it taps "Mampf".
  useEffect(() => {
    const iv = setInterval(() => {
      if (pausedRef.current || g.phase !== 'play') { setAim(null); return }
      const L = live.current
      const mampfAfter = L.level === 4 && L.idx < 2 ? 2.5 : 7
      if (!L.nests && g.rightSince != null && g.t - g.rightSince > mampfAfter) { setAim('mampf'); return }
      const idleFor = Date.now() - g.lastInput
      if (idleFor < (L.idx === 0 && L.level <= 4 ? 2600 : 7000)) { setAim(null); return }
      // a wanted fruit that still has a while to fall
      const rimY = L.groundY - BASKET_H + 30
      let best = null
      for (const it of g.items.values()) {
        if (it.kind !== 'want' || (it.state !== 'hang' && it.state !== 'fall')) continue
        if (L.nests ? false : g.counts[it.which] >= L.task.wants[it.which].n) continue
        if (it.y < rimY * 0.55 && (!best || it.y > best.y)) best = it
      }
      setAim(a => (best ? (a && a !== 'mampf' && Math.abs(a.x - best.x) < 4 ? a : { x: best.x }) : (a === 'mampf' ? null : a)))
    }, 400)
    return () => clearInterval(iv)
  }, [g])

  // ── The picture ─────────────────────────────────────────────────────────

  const counts = basket.map(l => l.length)
  const canPress = phase === 'play' && counts[0] + counts[1] > 0
  const seats = tasks.length
  const kindFruits = [...task.wants.map(w => w.fruit), ...(task.other ? [task.other] : [])]
  // the crown's fruit in tree order (left, right)
  const fruits = kinds > 1 ? sides.map((_, t) => kindFruits[sides.indexOf(t)]) : kindFruits
  const board = cmp && boardLayout(task.wants, cmp.counts, boardCell)

  // a tap on the sign: Lumi says the number again
  const sayNumber = () => { setBump(b => b + 1); narrate(task.wants.map((w, k) => { const p = numberWord(w.n); return p && k > 0 ? { ...p, gap: 250 } : p })) }
  const sign = <Sign wants={task.wants} row={!wide} bump={bump} onTap={sayNumber} />
  const button = free && (
    <MampfButton innerRef={mampfRef} size={wide ? 118 : 112} fruit={task.wants[0].fruit} disabled={!canPress}
      hint={aim === 'mampf'} onPress={mampf} />
  )
  const picnic = wide
    ? <Picnic seats={seats} guests={guests} size={60} cols={2} />
    : <Picnic seats={seats} guests={guests} size={free ? 58 : 60} cols={free ? Math.ceil(seats / 2) : seats} />

  const field = (
    <div ref={fieldRef} data-field="1" style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, maxWidth: wide ? 720 : undefined, overflowX: wide ? 'clip' : undefined }}>
      {size && (
        <>
          {treeSpans(fw, kinds).map(([a, b]) => <Trunk key={a} x={(a + b) / 2} top={crownH * 0.6} bottom={groundY - 6} />)}

          {/* The catcher: the animal behind, its basket in front */}
          <motion.div style={{ position: 'absolute', left: 0, top: groundY, width: 0, height: 0, x: bx, opacity: fade, zIndex: 3 }}>
            <motion.div animate={nope} role="img" aria-label={task.eater.label}
              style={{ position: 'absolute', left: -ANIMAL / 2, top: -(ANIMAL_UP + ANIMAL), width: ANIMAL, height: ANIMAL, transformOrigin: '50% 100%', pointerEvents: 'none' }}>
              <motion.div ref={animalRef}
                animate={stuffed && !reduce ? { scaleX: 1.24, rotate: [0, -5, 5, -3, 0] } : { scaleX: stuffed ? 1.24 : 1, rotate: 0 }}
                transition={stuffed ? { rotate: { duration: 0.9, repeat: Infinity }, scaleX: { type: 'spring', stiffness: 300, damping: 10 } } : { duration: 0.25 }}
                style={{ transformOrigin: '50% 100%' }}>
                <Critter key={idx} art={task.eater.art} size={ANIMAL} mood={mood} flip={facing > 0} shadow={false} />
              </motion.div>
            </motion.div>
            <motion.div ref={basketRef} data-basket="1" data-count={counts.slice(0, task.wants.length).join(',')}
              style={{ position: 'absolute', left: -BW / 2, top: -BASKET_H, width: BW, x: lag, rotate: tilt, transformOrigin: '50% 100%' }}>
              <motion.div animate={squash} style={{ transformOrigin: '50% 100%' }}>
                <Basket width={BW} split={pair}>
                  {nests && task.wants.map((w, k) => Array.from({ length: Math.max(0, w.n - counts[k]) }, (_, j) => {
                    const s = slotOf(counts[k] + j, cols)
                    return (
                      <span key={`n${k}-${counts[k] + j}`} style={{ position: 'absolute', left: s.x * cell + halfX(k) - cell / 2, top: BASKET_FLOOR - cell * (s.row + 1), display: 'flex' }}>
                        <Nest size={cell} />
                      </span>
                    )
                  }))}
                  {!cmp && basket.map((list, k) => list.map((b, i) => {
                    const s = slotOf(i, cols)
                    const sx = s.x * cell + halfX(k), top = BASKET_FLOOR - cell * (s.row + 1)
                    const order = k === 0 ? i : basket[0].length + i
                    return (
                      <motion.div key={b.id}
                        initial={reduce ? { opacity: 0 } : { x: b.fx, y: b.fy, scale: (FS / cell) * 0.9 }}
                        animate={eating ? { x: -sx, y: -(ANIMAL_UP + ANIMAL * 0.4) - top, scale: 0.25, opacity: 0 } : { x: 0, y: 0, scale: 1, opacity: 1 }}
                        transition={eating ? { duration: 0.26, delay: order * 0.13, ease: 'easeIn' } : { type: 'spring', stiffness: 520, damping: 24 }}
                        style={{ position: 'absolute', left: sx - cell / 2, top, width: cell, height: cell, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 - s.row }}>
                        <Fruit fruit={task.wants[k].fruit} size={cell + 2} gold={b.gold} />
                      </motion.div>
                    )
                  }))}
                  {boot && (
                    <motion.div key={boot.id} initial={{ x: boot.x, y: -30, rotate: 0, opacity: 1 }}
                      animate={reduce ? { opacity: [1, 1, 0] } : { x: [boot.x, boot.x, boot.x + boot.dir * 60, boot.x + boot.dir * 150], y: [-30, 14, -90, 70], rotate: [0, -8, boot.dir * 120, boot.dir * 260], opacity: [1, 1, 1, 0] }}
                      transition={{ duration: 1.05, times: [0, 0.18, 0.6, 1] }}
                      onAnimationComplete={() => setBoot(null)}
                      style={{ position: 'absolute', left: -32, top: 0, zIndex: 12 }}>
                      <Boot size={64} />
                    </motion.div>
                  )}
                </Basket>
              </motion.div>
              {/* the count pops up over the catcher's head */}
              <div style={{ position: 'absolute', left: BW / 2, top: BASKET_H - ANIMAL_UP - ANIMAL - 6, width: 0, height: 0 }}>{pops}</div>
            </motion.div>
          </motion.div>

          {/* What is falling */}
          {air.map(a => {
            const it = g.items.get(a.id)
            if (!it) return null
            return (
              <motion.div key={a.id} data-drop={a.kind === 'want' ? `want${a.which}` : a.kind} data-gold={a.gold ? '1' : undefined} aria-hidden="true"
                style={{ position: 'absolute', left: -FS / 2, top: -FS / 2, width: FS, height: FS, x: it.mx, y: it.my, rotate: it.mr, scale: it.ms, zIndex: 4, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {a.kind === 'boot' ? <Boot size={FS + 10} /> : <Fruit fruit={a.fruit} size={FS} gold={a.gold} />}
              </motion.div>
            )
          })}

          <div style={{ position: 'absolute', left: 0, top: 0, zIndex: 5 }}><Crown width={fw} height={crownH} fruits={fruits} /></div>

          {/* The basket against the sign's dots */}
          <AnimatePresence>
            {cmp && (
              <div key="cmp" style={{ position: 'absolute', left: fw / 2 - board.width / 2, top: cmp.top, zIndex: 20 }}>
                <CompareBoard wants={task.wants} counts={cmp.counts} cell={boardCell} from={cmp.from} rolled={cmp.rolled} show={cmp.show} />
              </div>
            )}
          </AnimatePresence>

          {aim && aim !== 'mampf' && <div ref={anchorRef} aria-hidden="true" style={{ position: 'absolute', left: aim.x, top: groundY - BASKET_H * 0.6, width: 2, height: 2 }} />}
        </>
      )}
    </div>
  )

  return (
    <div ref={juice.stage} data-game="bruno" data-phase={phase} data-task={idx} data-level={level}
      onPointerDown={steer} onPointerMove={steer}
      style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column', justifyContent: 'center', overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {wide ? (
        <>
          <div style={{ width: 204, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '0 6px 18px', boxSizing: 'border-box', zIndex: 6 }}>
            {sign}
            {button}
          </div>
          {field}
          <div style={{ width: 156, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: '12px 6px 18px', boxSizing: 'border-box', zIndex: 6 }}>
            {juice.hud}
            {picnic}
          </div>
        </>
      ) : (
        <>
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, padding: '0 10px 4px', zIndex: 6 }}>
            {sign}
            <div style={{ paddingTop: 8 }}>{juice.hud}</div>
          </div>
          {field}
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: free ? 'space-between' : 'center', gap: 10, padding: '6px 12px 10px', zIndex: 6 }}>
            {picnic}
            {button}
          </div>
        </>
      )}

      {/* The hand shows the move */}
      <HintHand key={`h${idx}-${aim && aim !== 'mampf' ? Math.round(aim.x) : ''}`} from={basketRef} to={anchorRef} active={!!aim && aim !== 'mampf' && phase === 'play'} delay={0} repeat={2} />
      <HintHand key={`m${idx}`} to={mampfRef} active={aim === 'mampf' && phase === 'play'} delay={0} />

      {phase === 'finale' && (
        <Finale cast={[...new Set(tasks.map(t => t.eater.art))]} size={wide ? 104 : 84}
          onDone={() => { if (!g.done) { g.done = true; onComplete(result(firstTry.current, tasks.length)) } }} />
      )}
      {bursts}
      {juice.layer}
    </div>
  )
}
