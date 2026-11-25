import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, useAnimationFrame, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, leaveGame, lockPreviews } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, HintHand, useBursts, useJuice, useMood } from '../components/play/index.js'
import { useLater } from './zahlen/stage.jsx'
import { rec, wordRec, soundRec, slug } from './buchstaben/voice.js'
import { levelConfig, pickBuckets, nextWord, layoutFor, lanesFor, keyFor } from './buchstaben/angeln.js'
import { Pond, Bank, Boat, Boot, Chest, BinFrog, Splash, FrogUnit, BUCKET_COLORS } from './buchstaben/AngelnParts.jsx'

/**
 * Anlaut-Detektiv — "Anlaut-Angeln": hearing the first sound of a word and
 * finding its letter.
 *
 * Lumi sits in a little boat on the pond. Under the surface things swim to
 * and fro at different depths: a fish, but also a sofa, the moon, a rocket.
 * The child fishes: a tap in the water sends the hook there (the boat glides
 * over, the line swings and sinks; a finger held down steers the hook). A
 * thing that touches the hook bites — the float dips, the boat jolts — and
 * comes up dripping, dangling from the rod, and Lumi says its word. On the
 * bank stand frogs on buckets, one letter each (two buckets in level 1,
 * four at the end). The child drags the catch into the bucket of the letter
 * the word begins with, or taps that bucket.
 *   • Right: a splash into the bucket, the frog giggles, dozes or jumps,
 *     and croaks its sound ("Mmm"); the word appears written over the
 *     bucket; the bucket keeps the catch, so the buckets fill over the
 *     level, and a star flies to the counter.
 *   • Wrong: the frog shakes its head and hands the catch back. From then
 *     on every bucket shows a picture that starts with its letter (a little
 *     table of initial sounds: Maus starts like Mond), and its frog says
 *     "Mmm wie Maus!". After two misses the right frog waves and the hand
 *     shows the way.
 *   • Now and then an old boot bites (a frog on a rubbish bin pops up and
 *     takes it) or a treasure chest (it opens: a shower of stars).
 * Tapping a frog always says its sound; tapping the catch says the word.
 * Fishing is never scored and never fails: a hook that catches nothing
 * comes up empty, with a drip. The score is the catches put into the right
 * bucket at the first try.
 *
 * Over the levels: more buckets (2 → 4), swimmers quicker and deeper, the
 * long sounds (M, S, F) first, then vowels, then the short ones (B, D, G)
 * and at the top look-alike sounds side by side (B/P, D/T, G/K)
 * (buchstaben/angeln.js).
 *
 * Why: isolating a word's first sound and giving it its letter is the core
 * of alphabetic decoding (Ehri: the step into the alphabetic phase). The
 * child sees the picture and hears the word; the written word appears only
 * once it is in the right bucket, so it cannot be solved by matching
 * letters without listening. Letters speak as sounds ("Mmm"), never as
 * letter names ("Em").
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const rand = (a, b) => a + Math.random() * (b - a)
const G = 2200            // the pendulum's gravity (px/s²)
const SINK = 430          // how fast the hook sinks in the water (px/s)
const DROP = 1100         // … and falls through the air
const REEL = 560          // how fast it comes up with a catch

export default function InitialSoundGame({ level = 1, onComplete }) {
  const cfg = useMemo(() => levelConfig(level), [level])
  const buckets = useMemo(() => pickBuckets(level), [level])
  const total = cfg.catches
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const reduce = useReducedMotion()
  const { later, afterSpeech } = useLater()
  const juice = useJuice({ hudSize: 34 })
  const { hit, miss, shake } = juice
  const [bursts, burst] = useBursts()
  const [mood, setMood] = useMood()

  const fieldRef = useRef(null)
  const [size, setSize] = useState(null)
  const L = useMemo(() => (size ? layoutFor(size.w, size.h, buckets.length, cfg.swimmers) : null), [size, buckets.length, cfg.swimmers])

  // the picture: what the loop does not move by itself
  const [items, setItems] = useState([])        // what is in the water / on the hook
  const [phase, setPhase] = useState('fish')    // fish | hold | busy | finale
  const [facing, setFacing] = useState(1)
  const [tried, setTried] = useState([])        // buckets missed with this catch
  const [help, setHelp] = useState(false)       // two misses: the right bucket shows itself
  const [hover, setHover] = useState(null)      // the bucket under the dragged catch
  const [piles, setPiles] = useState({})        // letter → the catches in its bucket
  const [landed, setLanded] = useState({})      // letter → how many landed right
  const [nope, setNope] = useState({})          // letter → how often its frog handed one back
  const [label, setLabel] = useState({})        // letter → the word just put in, written
  const [caught, setCaught] = useState([])      // the level's catches so far (the row at the top)
  const [splashes, setSplashes] = useState([])
  const [bin, setBin] = useState(null)          // the frog on the rubbish bin, for the boot
  const [chestOpen, setChestOpen] = useState(null)
  const [chorus, setChorus] = useState(0)
  const [heldWord, setHeldWord] = useState(null) // the word on the hook

  const boatRef = useRef(null), rodRef = useRef(null), rodInRef = useRef(null), lineRef = useRef(null), floatRef = useRef(null), hookRef = useRef(null)
  const aimRef = useRef(null), catchRef = useRef(null), gapRef = useRef(null)
  const bucketEls = useRef({})
  const rightRef = useRef(null)

  // What the clock works on; the state above is its picture
  const g = useRef({
    t: 0, ready: false, seq: 0, items: new Map(), lanes: [],
    boat: { x: 0, v: 0, tx: 0, dir: 1 },
    hook: { st: 'idle', len: 40, th: 0, om: 0, tx: 0, ty: 0, until: 0, prey: null, tug: -9, hy: 0 },
    phase: 'fish', pace: 1, sorted: 0, sortedBy: {}, used: {}, misses: 0, firstTry: 0, tried: new Set(),
    chestDone: false, bootDone: false, spawnAt: 0.2, drag: null, steer: null, done: false, held: null, lastHover: null,
  }).current
  const live = useRef(null)
  live.current = { L, cfg, buckets, reduce }

  const go = p => { g.phase = p; setPhase(p) }

  useEffect(() => { lockPreviews(); return () => leaveGame() }, [])

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

  // A new layout (first, or the screen turned): everything finds its place again
  useEffect(() => {
    if (!L) return
    g.lanes = lanesFor(L, cfg.swimmers, cfg.depth)
    const lo = L.pond.x + L.S * 0.6, hi = L.pond.x + L.pond.w - L.S * 0.6
    for (const it of g.items.values()) it.x = clamp(it.x, lo, hi)
    if (!g.ready) {
      g.ready = true
      g.boat.x = g.boat.tx = L.pond.x + L.pond.w * 0.5
      g.hook.len = idleLen(L)
    } else g.boat.tx = clamp(g.boat.tx, L.pond.x + L.lumi, L.pond.x + L.pond.w - L.lumi)
  }, [L, cfg, g])

  // ── Things in the water ────────────────────────────────────────────────

  const bounds = () => {
    const { L } = live.current
    return [L.pond.x + L.S * 0.6, L.pond.x + L.pond.w - L.S * 0.6]
  }
  const speed = () => {
    const { L, cfg, reduce } = live.current
    if (reduce) return 0
    return rand(cfg.speed[0], cfg.speed[1]) * clamp(L.pond.w / 600, 0.7, 1.4)
  }
  const inWater = it => it.st === 'in' || it.st === 'swim'
  const words = () => [...g.items.values()].filter(it => it.kind === 'word' && it.st !== 'gone' && it.st !== 'leave' && !it.sorted)

  const add = (it, entering) => {
    const [lo, hi] = bounds()
    const id = ++g.seq
    const v = speed()
    const fromLeft = Math.random() < 0.5
    let x = entering ? (fromLeft ? lo : hi) : rand(lo, hi)
    if (!entering || live.current.reduce) {
      // somewhere free, not on top of another one
      const others = [...g.items.values()].filter(inWater)
      for (let k = 0; k < 12; k++) {
        const c = rand(lo, hi)
        if (others.every(o => Math.abs(o.x - c) > live.current.L.S * 1.1 || o.lane !== it.lane)) { x = c; break }
      }
    }
    const thing = { id, x, y: 0, vx: (entering ? (fromLeft ? 1 : -1) : Math.random() < 0.5 ? 1 : -1) * v, a: 0, sc: 1, rot: 0, st: 'in', ph: Math.random() * 6, face: 0, wet: false, ...it }
    g.items.set(id, thing)
    setItems(l => [...l, { id, kind: thing.kind, emoji: thing.emoji, word: thing.word, letter: thing.letter }])
    return thing
  }

  const spawnWord = entering => {
    const { buckets, cfg } = live.current
    const swimming = words()
    const w = nextWord(buckets, { sorted: g.sortedBy, swimming, used: g.used })
    g.used[w.word] = (g.used[w.word] ?? 0) + 1
    // a depth nobody else swims at, if there is one
    const busy = new Set(swimming.filter(inWater).map(s => s.lane))
    const free = [...Array(cfg.swimmers).keys()].filter(k => !busy.has(k))
    const lane = free.length ? free[Math.floor(Math.random() * free.length)] : Math.floor(Math.random() * cfg.swimmers)
    add({ kind: 'word', ...w, lane }, entering)
  }

  const spawnThing = kind => {
    const it = add({ kind, lane: 'bottom', emoji: null, word: null, letter: null }, kind === 'boot')
    if (kind === 'chest') it.vx = 0
    else it.vx = Math.sign(it.vx || 1) * (live.current.reduce ? 0 : 18)
  }

  const drop = id => { g.items.delete(id); setItems(l => l.filter(i => i.id !== id)) }

  const splash = (x, y, big) => {
    const id = ++g.seq
    setSplashes(l => [...l.slice(-4), { id, x, y, big }])
    later(800, () => setSplashes(l => l.filter(s => s.id !== id)))
  }

  // ── Fishing ────────────────────────────────────────────────────────────

  const tip = () => {
    const { L } = live.current
    return { x: g.boat.x + g.boat.dir * reachOf(L), y: L.surface - L.rodUp }
  }

  // The hook goes to (x, y): the boat glides over, the hook sinks there
  const cast = (x, y, retarget = false) => {
    const { L, cfg } = live.current
    const h = g.hook
    if (!retarget && !['idle', 'wait', 'sink', 'reel'].includes(h.st)) return
    if (h.st === 'reel' && h.prey) return
    let tx = clamp(x, L.pond.x + 24, L.pond.x + L.pond.w - 24)
    let ty = clamp(y, L.surface + L.S * 0.3, L.water.bottom - L.S * 0.3)
    // a little help with aiming: a tap close to a swimmer goes where it will be
    if (!retarget) {
      let best = null, bd = L.S * 1.4
      for (const it of g.items.values()) {
        if (it.st !== 'swim') continue
        const d = Math.hypot(it.x - tx, it.y - ty)
        if (d < bd) { bd = d; best = it }
      }
      if (best) {
        const T = Math.abs(best.x - tip().x) / 900 + (best.y - L.surface) / SINK
        const [lo, hi] = bounds()
        tx = clamp(best.x + best.vx * g.pace * T * 0.7, lo, hi)
        ty = best.y
      }
    }
    // which way Lumi faces: towards the spot, unless the boat would leave the pond
    const reach = reachOf(L)
    const half = L.lumi * 0.85
    let dir = Math.abs(tx - tip().x) < 30 ? g.boat.dir : tx >= g.boat.x ? 1 : -1
    let bx = tx - dir * reach
    if (bx < L.pond.x + half || bx > L.pond.x + L.pond.w - half) { dir = -dir; bx = tx - dir * reach }
    g.boat.tx = clamp(bx, L.pond.x + half, L.pond.x + L.pond.w - half)
    if (dir !== g.boat.dir) { g.boat.dir = dir; setFacing(dir) }
    if (h.st === 'idle' || h.st === 'reel') sfx.whoosh()
    h.tx = tx; h.ty = ty
    h.st = 'sink'
    h.until = g.t + cfg.dwell + 0.6
  }

  // Something touched the hook
  const bite = it => {
    const h = g.hook
    h.st = 'bite'; h.prey = it.id; h.tug = g.t
    it.st = 'hooked'
    g.boat.v += g.boat.dir * 40
    shake(0.45)
    sfx.boing()
    setMood('wow', 900)
    later(260, () => { if (h.st === 'bite') h.st = 'reel' })
  }

  // The catch is out of the water and dangles from the rod
  const landedOnHook = it => {
    const h = g.hook
    h.st = 'held'
    it.st = 'held'
    catchRef.current = it.el
    if (it.kind === 'word') {
      g.held = it; g.misses = 0; g.tried = new Set()
      setTried([]); setHelp(false); setHeldWord(it.word)
      go('hold')
      narrate([wordRec(it.word), g.sorted === 0 && rec('anlaut/womit')])
      return
    }
    go('busy')
    if (it.kind === 'chest') {
      g.chestDone = true
      later(250, () => {
        setChestOpen(it.id)
        sfx.sparkle()
        hit(it.el, { stars: 3 })
        burst(it.el, 'stars', 18)
        setMood('happy', 1600)
        narrate([rec('anlaut/schatz')])
      })
      later(1700, () => { it.st = 'leave'; it.vx = 0; h.st = 'idle'; h.prey = null; go('fish') })
      return
    }
    // the boot: a frog on a rubbish bin comes up at the far side and takes it
    g.bootDone = true
    const { L } = live.current
    const left = g.boat.x > L.pond.x + L.pond.w / 2
    const bs = Math.round(L.lumi * 0.9)
    const bx = left ? L.pond.x + bs * 0.75 : L.pond.x + L.pond.w - bs * 0.75
    setMood('oops', 1400)
    sfx.slideDown()
    narrate([rec('anlaut/stiefel')])
    setBin({ x: bx, y: L.surface + 6, size: bs, open: false })
    later(700, () => {
      fly(it, { x: bx, y: L.surface - bs * 0.85 }, 0.5, 0.45, () => {
        drop(it.id)
        setBin(b => b && { ...b, open: true })
        sfx.burp()
        h.st = 'idle'; h.prey = null
        go('fish')
        later(900, () => setBin(null))
      })
    })
  }

  // Fly a thing from where it is to `to` along an arc
  const fly = (it, to, dur, scale, done) => {
    it.st = 'fly'
    it.fly = { x0: it.x, y0: it.y, s0: it.sc, x1: to.x, y1: to.y, s1: scale, t0: g.t, dur: live.current.reduce ? dur * 0.5 : dur, done }
  }

  // ── Sorting ────────────────────────────────────────────────────────────

  const bucketMouth = letter => {
    const { L, buckets } = live.current
    const u = L.units[buckets.indexOf(letter)]
    return { x: u.x + u.uw / 2, y: u.y + u.f * 0.72 + u.bh * 0.12 }
  }

  const deliver = letter => {
    const it = g.held
    if (!it || g.phase !== 'hold' || g.tried.has(letter)) return false
    const { L } = live.current
    const right = letter === it.letter
    const el = bucketEls.current[letter]
    go('busy')
    setHover(null)
    if (right) {
      fly(it, bucketMouth(letter), 0.42, 0.45, () => {
        it.sorted = true
        drop(it.id)
        g.held = null; catchRef.current = null; setHeldWord(null)
        g.hook.st = 'idle'; g.hook.prey = null
        const first = g.misses === 0
        if (first) { g.firstTry += 1; g.pace = Math.min(1.18, g.pace * 1.04) }
        g.sorted += 1
        g.sortedBy[letter] = (g.sortedBy[letter] ?? 0) + 1
        const m = bucketMouth(letter)
        splash(m.x, m.y, false)
        sfx.splash()
        setPiles(p => ({ ...p, [letter]: [...(p[letter] ?? []), it.emoji] }))
        setLanded(p => ({ ...p, [letter]: (p[letter] ?? 0) + 1 }))
        const key = g.seq + 1
        setLabel(p => ({ ...p, [letter]: { key, text: it.word } }))
        later(1500, () => setLabel(p => (p[letter]?.key === key ? { ...p, [letter]: null } : p)))
        setCaught(c => [...c, it.emoji])
        setTried([]); setHelp(false)
        const { milestone } = hit(el)
        if (milestone) { setChorus(c => c + 1); setMood('dance', 1800) } else setMood('happy', 1200)
        // the frog croaks its sound, then (now and then) praise
        sayRight(null, { lead: [soundRec(letter)] })
        if (g.sorted >= total) finale()
        else go('fish')
      })
      return true
    }
    // the wrong bucket: the frog takes a look, shakes its head and hands it back
    const m = bucketMouth(letter)
    fly(it, { x: m.x, y: m.y - L.units[0].f * 0.35 }, 0.36, 0.6, () => {
      it.st = 'rest'
      g.misses += 1
      g.tried.add(letter)
      g.pace = Math.max(0.75, g.pace * 0.9)
      setNope(p => ({ ...p, [letter]: (p[letter] ?? 0) + 1 }))
      setTried([...g.tried])
      miss(el)
      setMood('oops', 1000)
      sayWrong()
      later(700, () => {
        sfx.whoosh()
        fly(it, holdSpot(), 0.45, L.C / L.S, () => {
          it.st = 'held'
          if (g.misses >= 2 || g.tried.size >= live.current.buckets.length - 1) setHelp(true)
          go('hold')
          // the word again, to listen once more
          afterSpeech(() => { if (g.held === it) narrate([wordRec(it.word)]) }, 200)
        })
      })
    })
    return false
  }

  const holdSpot = () => {
    const { L } = live.current
    const t = tip()
    return { x: t.x, y: t.y + holdLen() + L.C / 2 }
  }

  const finale = () => {
    go('finale')
    for (const it of g.items.values()) if (inWater(it)) { it.st = 'leave'; it.vx = (it.vx >= 0 ? 1 : -1) * 160 }
    setChorus(c => c + 1)
    setMood('dance', 3000)
    later(300, () => { sfx.tada(); burst(bucketEls.current[live.current.buckets[0]], 'confetti', 20) })
    afterSpeech(() => later(1500, () => {
      if (g.done) return
      g.done = true
      sfx.complete()
      onComplete(result(g.firstTry, total))
    }), 600)
  }

  // ── The clock ──────────────────────────────────────────────────────────

  useAnimationFrame((_, delta) => {
    const { L, cfg, reduce } = live.current
    if (pausedRef.current || !g.ready || !L) return
    const dt = Math.min(delta / 1000, 0.05)
    g.t += dt
    const h = g.hook, b = g.boat

    // the boat glides to where it is sent
    const v0 = b.v
    if (reduce) { b.x += clamp(b.tx - b.x, -900 * dt, 900 * dt); b.v = 0 }
    else {
      b.v += (55 * (b.tx - b.x) - 13 * b.v) * dt
      b.v = clamp(b.v, -650, 650)
      b.x += b.v * dt
    }
    const ax = (b.v - v0) / dt
    const reach = reachOf(L)
    const tug = g.t - h.tug < 0.3 ? Math.sin(((g.t - h.tug) / 0.3) * Math.PI) * 12 : 0
    const tx0 = b.x + b.dir * reach, ty0 = L.surface - L.rodUp + tug

    // the line: its length by what the hook is doing, the swing by the boat
    const target = h.st === 'sink' || h.st === 'wait' ? Math.max(idleLen(L), h.ty - ty0)
      : h.st === 'held' || (h.st === 'reel' && h.prey) ? holdLen()
      : idleLen(L)
    const under = ty0 + h.len > L.surface
    if (h.st === 'sink' || h.st === 'wait') {
      if (h.len < target) h.len = Math.min(target, h.len + (under ? SINK : DROP) * dt)
      else h.len = Math.max(target, h.len - REEL * dt)
      if (h.st === 'sink' && Math.abs(h.len - target) < 1 && Math.abs(b.tx - b.x) < 20) { h.st = 'wait'; h.until = g.t + cfg.dwell }
      if (h.st === 'wait' && g.t > h.until) h.st = 'reel'
      if (h.st === 'sink' && g.t > h.until + 2) h.st = 'reel'
    } else if (h.st === 'reel') {
      h.len = Math.max(target, h.len - (h.prey ? REEL : 800) * dt)
      if (h.len <= target + 0.5) {
        if (h.prey) { const it = g.items.get(h.prey); if (it) landedOnHook(it); else { h.st = 'idle'; h.prey = null } }
        else h.st = 'idle'
      }
    } else if (h.st === 'idle' || h.st === 'held') {
      h.len += clamp(target - h.len, -600 * dt, 600 * dt)
    }
    if (reduce) { h.th = 0; h.om = 0 }
    else {
      const damp = under ? 7 : 1.6
      h.om += (-(G / Math.max(30, h.len)) * Math.sin(h.th) - damp * h.om - (ax / Math.max(30, h.len)) * Math.cos(h.th) * 0.5) * dt
      h.th = clamp(h.th + h.om * dt, -0.9, 0.9)
    }
    const hx = tx0 + h.len * Math.sin(h.th), hy = ty0 + h.len * Math.cos(h.th)
    // through the surface: a splash going in; a big one when a catch comes out
    if ((h.hy <= L.surface) !== (hy <= L.surface) && h.hy) {
      if (hy > L.surface) { splash(hx, L.surface, false); sfx.pop() }
      else if (h.prey) { splash(hx, L.surface, true); sfx.splash() }
      else { splash(hx, L.surface, false) }
    }
    h.hy = hy
    const wet = hy > L.surface + 4

    // a bite?
    if ((h.st === 'sink' || h.st === 'wait') && wet) {
      let best = null, bd = L.S * 0.62
      for (const it of g.items.values()) {
        if (it.st !== 'swim' || it.a < 0.6) continue
        const d = Math.hypot(it.x - hx, it.y - hy)
        if (d < bd) { bd = d; best = it }
      }
      if (best) bite(best)
    }

    // everything in the water
    const [lo, hi] = bounds()
    for (const it of [...g.items.values()]) {
      if (it.st === 'in' || it.st === 'swim') {
        it.a = Math.min(1, it.a + dt * 2.2)
        if (it.st === 'in' && it.a >= 1) it.st = 'swim'
        it.x += it.vx * g.pace * dt
        if (it.x < lo) { it.x = lo; it.vx = Math.abs(it.vx) }
        if (it.x > hi) { it.x = hi; it.vx = -Math.abs(it.vx) }
        const laneY = it.lane === 'bottom' ? L.water.bottom - L.S * 0.42 : g.lanes[it.lane] ?? L.water.top + L.S
        it.y = laneY + (reduce || it.kind === 'chest' ? 0 : Math.sin(g.t * 1.7 + it.ph) * 5)
        it.rot = reduce || it.kind !== 'word' ? 0 : Math.sin(g.t * 2.3 + it.ph) * 5
        // a word near the hook swims to it: they bite gladly
        if (it.kind === 'word' && wet && (h.st === 'sink' || h.st === 'wait') && !reduce) {
          const dx = hx - it.x, dy = hy - it.y, d = Math.hypot(dx, dy)
          if (d < L.S * 1.6 && d > 1) {
            const p = cfg.pull * clamp(L.S / 80, 0.7, 1.2) * dt
            it.x += (dx / d) * p; it.y += (dy / d) * p
          }
        }
      } else if (it.st === 'hooked') {
        // under water it keeps its size; out of it, it grows to a catch you can take
        it.x = hx; it.sc = hy < L.surface ? Math.min(L.C / L.S, it.sc + dt * 2) : 1
        it.y = hy + (L.S * it.sc) / 2
        it.rot = reduce ? 0 : Math.sin(g.t * 18) * 8
      } else if (it.st === 'held') {
        it.sc = L.C / L.S
        it.x = hx; it.y = hy + L.C / 2
        it.rot = reduce ? 0 : -h.th * 30 + (it.wiggle && g.t - it.wiggle < 0.5 ? Math.sin((g.t - it.wiggle) * 40) * 10 : 0)
      } else if (it.st === 'fly') {
        const f = it.fly, u = clamp((g.t - f.t0) / f.dur, 0, 1)
        const e = u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2
        it.x = f.x0 + (f.x1 - f.x0) * e
        it.y = f.y0 + (f.y1 - f.y0) * e - Math.sin(u * Math.PI) * Math.min(90, Math.hypot(f.x1 - f.x0, f.y1 - f.y0) * 0.3)
        it.sc = f.s0 + (f.s1 - f.s0) * e
        it.rot = 0
        if (u >= 1 && !f.fired) { f.fired = true; f.done?.() }
      } else if (it.st === 'leave') {
        it.x += it.vx * dt
        it.a -= dt * 1.4
        if (it.a <= 0) { drop(it.id); continue }
      }
      paint(it, L)
    }

    // new swimmers, the chest and the boot
    if (g.phase !== 'finale' && g.t >= g.spawnAt) {
      const ws = words().filter(w => inWater(w)).length
      const things = [...g.items.values()].filter(it => it.kind !== 'word' && it.st !== 'leave').length
      if (ws < cfg.swimmers) { spawnWord(g.t > 1); g.spawnAt = g.t + (g.t > 1 ? 0.9 : 0.15) }
      else if (!things && cfg.chestAt != null && !g.chestDone && g.sorted >= cfg.chestAt) { g.chestDone = true; spawnThing('chest'); g.spawnAt = g.t + 1 }
      else if (!things && cfg.bootAt != null && !g.bootDone && g.sorted >= cfg.bootAt) { g.bootDone = true; spawnThing('boot'); g.spawnAt = g.t + 1 }
    }

    // the boat, the rod, the line, the float, the hook
    if (boatRef.current) boatRef.current.style.transform = `translate(${b.x}px, ${L.surface + (reduce ? 0 : Math.sin(g.t * 2) * 2)}px) rotate(${reduce ? 0 : clamp(b.v * 0.012, -5, 5)}deg)`
    const handX = b.x + b.dir * L.lumi * 0.22, handY = L.surface - L.lumi * 0.4
    const rodD = `M${handX} ${handY} Q${(handX + tx0) / 2 - b.dir * 6} ${(handY + ty0) / 2 - 10} ${tx0} ${ty0}`
    rodRef.current?.setAttribute('d', rodD)
    rodInRef.current?.setAttribute('d', rodD)
    const slack = h.st === 'idle' || h.st === 'held' ? 7 : 2
    lineRef.current?.setAttribute('d', `M${tx0} ${ty0} Q${(tx0 + hx) / 2 + slack} ${(ty0 + hy) / 2} ${hx} ${hy}`)
    if (floatRef.current) {
      let fx, fy
      if (hy > L.surface) { const u = (L.surface - ty0) / (hy - ty0); fx = tx0 + (hx - tx0) * u; fy = L.surface - 2 + (h.st === 'bite' ? 10 : 0) }
      else { fx = tx0 + (hx - tx0) * 0.55; fy = ty0 + (hy - ty0) * 0.55 }
      floatRef.current.setAttribute('transform', `translate(${fx} ${fy})`)
    }
    hookRef.current?.setAttribute('transform', `translate(${hx} ${hy}) rotate(${(-h.th * 180) / Math.PI})`)
  })

  // ── The finger ─────────────────────────────────────────────────────────

  const local = e => {
    const r = fieldRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const bucketAt = p => {
    const { L, buckets } = live.current
    let best = null, bd = Infinity
    L.units.forEach((u, i) => {
      if (p.x < u.x - 14 || p.x > u.x + u.uw + 14 || p.y < u.y - 14 || p.y > u.y + u.uh + 14) return
      const d = Math.hypot(p.x - (u.x + u.uw / 2), p.y - (u.y + u.uh / 2))
      if (d < bd) { bd = d; best = buckets[i] }
    })
    return best
  }

  const onDown = e => {
    const { L } = live.current
    if (!L || pausedRef.current || g.phase === 'finale') return
    if (e.target.closest?.('button')) return
    const p = local(e)
    const it = g.held
    if (g.phase === 'hold' && it && it.st === 'held') {
      if (Math.hypot(p.x - it.x, p.y - it.y) < L.C * 0.8) {
        g.drag = { pid: e.pointerId, x0: p.x, y0: p.y, ox: it.x - p.x, oy: it.y - p.y, moved: false }
        it.st = 'drag'
        fieldRef.current.setPointerCapture?.(e.pointerId)
        return
      }
      // a tap anywhere else while a catch hangs there: the catch wiggles
      if (p.y > L.surface) { it.wiggle = g.t; sfx.boing() }
      return
    }
    if (g.phase === 'fish' && p.x >= L.pond.x && p.x <= L.pond.x + L.pond.w && p.y > L.pond.y + 8) {
      cast(p.x, p.y)
      g.steer = e.pointerId
      fieldRef.current.setPointerCapture?.(e.pointerId)
    }
  }
  const onMove = e => {
    const p = local(e)
    const d = g.drag
    if (d && d.pid === e.pointerId && g.held) {
      const it = g.held
      if (Math.hypot(p.x - d.x0, p.y - d.y0) > 8) d.moved = true
      it.x = p.x + d.ox; it.y = p.y + d.oy
      it.sc = live.current.L.C / live.current.L.S
      paint(it, live.current.L)
      const over = bucketAt(p)
      if (over !== g.lastHover) {
        g.lastHover = over
        setHover(over)
        if (over && !g.tried.has(over)) narrate([soundRec(over)], { priority: 'preview' })
      }
      return
    }
    if (g.steer === e.pointerId && (g.hook.st === 'sink' || g.hook.st === 'wait')) cast(p.x, p.y, true)
  }
  const onUp = e => {
    const d = g.drag
    if (d && d.pid === e.pointerId) {
      g.drag = null
      const it = g.held
      const over = g.lastHover
      g.lastHover = null
      setHover(null)
      if (!it) return
      if (over && !g.tried.has(over)) { it.st = 'held'; deliver(over); return }
      if (!d.moved) {
        // a tap on the catch: its word again
        it.st = 'held'; it.wiggle = g.t
        narrate([wordRec(it.word)])
        return
      }
      fly(it, holdSpot(), 0.35, live.current.L.C / live.current.L.S, () => { it.st = 'held' })
      return
    }
    if (g.steer === e.pointerId) g.steer = null
  }

  // keyboard: space casts at the nearest swimmer
  useEffect(() => {
    const key = e => {
      if (e.key !== ' ' || e.target.closest?.('button') || pausedRef.current || g.phase !== 'fish') return
      const it = [...g.items.values()].filter(i => i.st === 'swim').sort((a, b) => Math.abs(a.x - g.boat.x) - Math.abs(b.x - g.boat.x))[0]
      if (it) { e.preventDefault(); cast(it.x, it.y) }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  })

  const onFrog = letter => {
    sfx.pop()
    const hint = tried.length > 0 ? keyFor(letter, heldWord) : null
    const said = hint ? rec(`laut/${slug(letter)}-wie-${slug(hint.word)}`) : null
    narrate([said ?? soundRec(letter)])
  }
  const onBucket = letter => {
    if (g.phase === 'hold' && g.held) { deliver(letter); return }
    onFrog(letter)
  }

  // the hand points at a swimmer when the child waits
  useEffect(() => {
    const iv = setInterval(() => {
      if (g.phase !== 'fish') return
      const { L } = live.current
      if (!L) return
      const it = [...g.items.values()].filter(i => i.kind === 'word' && i.st === 'swim')
        .sort((a, b) => (a.y - b.y) * 0.5 + Math.abs(a.x - g.boat.x) - Math.abs(b.x - g.boat.x))[0]
      aimRef.current = it?.el ?? null
    }, 500)
    return () => clearInterval(iv)
  }, [g])

  // ── The picture ────────────────────────────────────────────────────────

  const held = heldWord ? g.held : null
  rightRef.current = held ? bucketEls.current[held.letter] ?? null : null

  return (
    <div ref={juice.stage} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div ref={fieldRef} data-field="1" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}>
        {L && (
          <>
            <Pond L={L} />
            <Bank L={L} />

            {/* the row of catches so far, and the star counter */}
            <div style={{ position: 'absolute', left: L.strip.x, top: L.strip.y, width: L.strip.w, height: L.strip.h, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 10px', boxSizing: 'border-box', zIndex: 4, gap: 6 }}>
              <Progress total={total} caught={caught} size={Math.max(16, Math.min(30, (L.strip.w - 110) / total - 4))} />
              <div style={{ flexShrink: 0 }}>{juice.hud}</div>
            </div>

            {buckets.map((letter, i) => (
              <FrogUnit key={letter} u={L.units[i]} L={letter} i={i} color={BUCKET_COLORS[i % BUCKET_COLORS.length]}
                state={tried.includes(letter) ? 'tried' : help && held ? (held.letter === letter ? 'help' : 'off') : 'wait'}
                hover={hover === letter} pile={piles[letter] ?? []} landed={landed[letter] ?? 0} nope={nope[letter] ?? 0}
                chorus={chorus} finale={phase === 'finale'}
                hint={tried.length > 0 && heldWord ? keyFor(letter, heldWord) : null}
                word={label[letter] ?? null}
                bucketRef={el => { bucketEls.current[letter] = el }}
                onFrog={onFrog} onBucket={onBucket} />
            ))}
            <span ref={gapRef} aria-hidden="true" style={{ position: 'absolute', left: L.gapAt.x, top: L.gapAt.y, width: 2, height: 2 }} />

            {/* Lumi in the boat */}
            <Boat boatRef={boatRef} size={L.lumi} dir={facing}>
              <Critter art="lumi" size={L.lumi} talks label="Lumi" mood={mood} flip={facing < 0} shadow={false} />
            </Boat>

            {/* what swims, and what hangs on the hook */}
            {items.map(it => (
              <Thing key={it.id} it={it} S={L.S} open={chestOpen === it.id}
                setEl={el => { const r = g.items.get(it.id); if (r) { r.el = el; if (el) paint(r, L) } }} />
            ))}

            {/* the rod and the line, over everything in the water */}
            <svg aria-hidden="true" width={size.w} height={size.h} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 6, overflow: 'visible' }}>
              <path ref={rodRef} d="M0 0" stroke="#2a1b3d" strokeWidth="7" fill="none" strokeLinecap="round" />
              <path ref={rodInRef} d="M0 0" stroke="#c98d4f" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              <path ref={lineRef} d="M0 0" stroke="#2a1b3d" strokeWidth="2" fill="none" />
              <g ref={floatRef}>
                <g className="ang-bob">
                  <ellipse cx="0" cy="-4" rx="7" ry="9" fill="#e8483b" stroke="#2a1b3d" strokeWidth="2.5" />
                  <path d="M-7 -2 A7 9 0 0 0 7 -2 Z" fill="#fffdf7" stroke="#2a1b3d" strokeWidth="2" />
                </g>
              </g>
              <g ref={hookRef}>
                <path d="M0 -2 V10 a6 6 0 0 1 -11 2" stroke="#56566a" strokeWidth="3.5" fill="none" strokeLinecap="round" />
              </g>
            </svg>

            <AnimatePresence>{bin && <BinFrog key="bin" x={bin.x} y={bin.y} size={bin.size} open={bin.open} />}</AnimatePresence>
            {splashes.map(s => <Splash key={s.id} x={s.x} y={s.y} big={s.big} />)}
          </>
        )}
      </div>

      {/* the hand: tap a swimmer; take the catch to the buckets; after two misses, to the right one */}
      <HintHand key={`aim${caught.length}`} to={aimRef} active={phase === 'fish' && !!L} delay={caught.length === 0 ? 2500 : 8000} repeat={2} />
      <HintHand key={`gap${caught.length}`} from={catchRef} to={gapRef} active={phase === 'hold' && !help} delay={caught.length === 0 ? 2500 : 6500} />
      <HintHand key={`help${caught.length}`} from={catchRef} to={rightRef} active={phase === 'hold' && help} delay={0} />
      {bursts}
      {juice.layer}
    </div>
  )
}

const reachOf = L => L.lumi * 0.5 + 24
const idleLen = L => L.rodUp * 0.5
const holdLen = () => 12

/** Put a thing where the clock says. */
function paint(it, L) {
  const el = it.el
  if (!el) return
  el.style.transform = `translate(${it.x - L.S / 2}px, ${it.y - L.S / 2}px) rotate(${it.rot}deg) scale(${it.sc})`
  el.style.opacity = String(clamp(it.a, 0, 1))
  const top = it.st === 'held' || it.st === 'drag' || it.st === 'fly' || it.st === 'rest' || it.st === 'hooked'
  el.style.zIndex = top ? (it.st === 'hooked' ? '5' : '8') : '2'
  const face = it.vx > 0 ? -1 : 1
  if (it.kind === 'word' && face !== it.face && (it.st === 'swim' || it.st === 'in')) {
    it.face = face
    if (el.firstChild) el.firstChild.style.transform = `scaleX(${face})`
  }
  const wet = (it.st === 'held' || it.st === 'drag') && it.kind === 'word'
  if (wet !== it.wet) { it.wet = wet; el.dataset.wet = wet ? '1' : '0' }
  const dry = it.st !== 'swim' && it.st !== 'in'
  if (dry !== it.dry) { it.dry = dry; el.dataset.dry = dry ? '1' : '0' }
}

/** One thing in the pond: a word's picture, the boot or the chest. */
function Thing({ it, S, open, setEl }) {
  return (
    <div ref={setEl} data-swimmer={it.kind} data-letter={it.letter ?? undefined} data-word={it.word ?? undefined}
      role={it.word ? 'img' : undefined} aria-label={it.word ?? undefined}
      style={{ position: 'absolute', left: 0, top: 0, width: S, height: S, pointerEvents: 'none', willChange: 'transform', opacity: 0 }}>
      <div style={{ width: S, height: S }}>
        {it.kind === 'boot' ? <Boot size={S} /> : it.kind === 'chest' ? <Chest size={S} open={open} /> : <Art art={it.emoji} size={S} />}
      </div>
      <span className="ang-bubble" style={{ left: '8%', top: '10%' }} />
      <span className="ang-bubble" style={{ left: '20%', top: '0%', animationDelay: '1.3s' }} />
      {[0.25, 0.5, 0.75].map((x, k) => (
        <span key={k} className="ang-drip" style={{ left: `${x * 100}%`, top: '88%', animationDelay: `${k * 0.37}s` }} />
      ))}
    </div>
  )
}

/** The catches of the level so far: an empty ring for each still to come. */
function Progress({ total, caught, size }) {
  return (
    <div aria-label={`${caught.length} von ${total}`} role="img" style={{ display: 'flex', gap: 4, minWidth: 0, flexWrap: 'nowrap' }}>
      {Array.from({ length: total }, (_, k) => (
        <div key={k} style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, background: caught[k] ? '#fffdf7' : 'rgba(255,253,247,0.55)',
          border: '2.5px solid #2a1b3d', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
          {caught[k] && <Art art={caught[k]} size={size * 0.78} />}
        </div>
      ))}
    </div>
  )
}
