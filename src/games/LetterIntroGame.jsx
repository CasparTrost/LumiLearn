import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { motion, motionValue, useAnimationFrame, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, lockPreviews, leaveGame } from '../narrator.js'
import { sayRight, sayWrong, announce } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Art, useBursts, useJuice, HintHand } from '../components/play/index.js'
import { useLater, useSize } from './gefuehle/hooks.js'
import { rec, slug, wordRec, soundRec } from './buchstaben/voice.js'
import Monster, { Balloon } from './buchstaben/Monster.jsx'
import { planLevel, pickThing, layoutFor, spitSpot, scaleAt, MOUTH_Y, EYES_Y, MONSTER_RATIO, BADGE } from './buchstaben/mampf.js'
import './buchstaben/mampf.css'

/**
 * ABC-Abenteuer — "Monster-Mampf": a letter, its sound, and hearing the
 * first sound of a word
 *
 * A letter monster stands at the bottom, mouth open, its letter big on the
 * belly; Lumi says it once ("A wie Affe."). Things float past on balloons.
 * The child taps the ones that begin with the monster's sound: the balloon
 * pops, the thing drops into the mouth, the monster chomps and grows. What
 * does not fit is spat out in a high arc and shows its own first letter as
 * it flies. Lumi says the word of every thing that is tapped, so the first
 * sound is heard each time. After five bites the monster is full, burps
 * bubbles with its letter and walks to the row of full monsters; the next
 * one comes.
 *
 *   • Levels 1–2: two things in the air, slow, the wrong ones sound very
 *     different. 3–6: three and four things, quicker, the other letters.
 *   • Levels 7–8: the wrong things are the sounds that are easy to mix up
 *     (B/P, D/T, G/K, M/N …); in level 8 the small letter is on the belly.
 *   • Levels 9–10: two monsters at once. The child drags a thing to the
 *     monster it belongs to, or taps the thing and then the monster.
 *
 * A fitting thing that floats off is no miss: the next one is on its way.
 * The stream gets a little quicker on a streak and eases after a miss; the
 * monster's eyes follow the nearest thing that fits; after two misses the
 * fitting things glow. Stars, streak and notes come from the play kit's
 * Juice. The result: monsters fed without a wrong bite.
 *
 * The game lays itself out in real pixels (GameScreen: NO_SCALE); the
 * words, levels and layout are in buchstaben/mampf.js.
 */

const INK = '#2a1b3d'
const CREAM = '#fffdf7'
const GOLD = '#ffc93c'
const TINTS = ['#ff6b5b', '#ffc93c', '#4aa3ff', '#5cc45a', '#b388ff', '#ff8fb8', '#2fb8a6', '#ff9f43']
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Spoken once per level, as soon as Lumi has recorded them (see the report)
const SAY_START = 'abc/mampf-start'
const SAY_DUO = 'abc/mampf-zwei'

export default function LetterIntroGame(props) {
  // a fresh stage for every level
  return <MonsterMampf key={props.level} {...props} />
}

function MonsterMampf({ level = 1, onComplete }) {
  const { cfg, groups } = useMemo(() => planLevel(level), [level])
  const total = groups.reduce((n, grp) => n + grp.length, 0)
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const reduce = useReducedMotion()
  const { later, afterSpeech } = useLater()
  const [bursts, burst] = useBursts()
  const [, bump] = useReducer(n => n + 1, 0)

  const rootRef = useRef(null)
  const monEls = useRef({})
  const size = useSize(rootRef)
  const lay = useMemo(() => (size ? layoutFor(size.w, size.h, { duo: !!cfg.duo, slots: total }) : null), [size, cfg.duo, total])
  const layRef = useRef(lay)
  layRef.current = lay
  const juice = useJuice({ hudSize: lay?.hud ?? 36 })
  const { hit, miss, shake } = juice   // these three never change

  // The game itself lives here, outside React's state: the loop and the
  // timers always see what is true right now. `bump()` draws it.
  const [g] = useState(() => ({
    phase: 'start',      // start → intro → play → full → (intro …) → finale
    gi: 0,               // which group of monsters is on stage
    mons: [],            // the monsters on stage
    things: [],          // what floats
    flyers: [],          // things on their way into a mouth
    spat: [],            // things that were spat out, lying on the ground
    bubbles: [],         // burped letter bubbles
    pops: [],            // balloons that just popped
    row: [],             // the full monsters
    clean: 0,            // monsters fed without a wrong bite
    pace: 1, paceTo: 1,  // how fast the stream is: up on a streak, down after a miss
    picked: null,        // two monsters: the thing that was tapped and waits for its monster
    over: null,          // two monsters: the one a dragged thing is held over
    help: false,         // after two misses the fitting things glow
    cheer: false,        // the row hops when a monster joins it
    drag: null, recent: [], tapSeq: 0, uid: 0, topUp: 0,
  }))

  useEffect(() => leaveGame, [])

  const hungry = () => g.mons.filter(m => m.state === 'hungry' && m.bites + m.incoming < m.need)
  const monX = m => layRef.current.monX[Math.min(m.pos, layRef.current.monX.length - 1)]
  const topOf = (m, part) => {
    const L = layRef.current
    return { x: monX(m), y: L.h - L.ground - L.mh * scaleAt(m.bites, m.need) * (1 - part) }
  }
  const setMood = (m, mood, ms) => {
    m.mood = mood
    const k = ++m.moodSeq
    bump()
    if (ms) later(ms, () => { if (m.moodSeq === k && m.state === 'hungry') { m.mood = 'hungry'; bump() } })
  }

  // ── The stream of things ──────────────────────────────────────────────────

  // With reduced motion nothing floats: a new thing appears in the place
  // with the most room, never on top of another one
  const freeSpot = () => {
    const L = layRef.current
    // not right at the edge, where the hint hand would not point at it
    const edge = L.fw * 0.75, inner = Math.max(0, L.w - 2 * edge)
    const n = Math.max(2, Math.floor(inner / (L.fw + 12)) + 1)
    let best = null
    L.lanes.forEach((_, lane) => {
      for (let k = 0; k < n; k++) {
        const x = edge + (inner * k) / (n - 1)
        const room = Math.min(L.w, ...g.things.filter(t => t.lane === lane && !t.away).map(t => Math.abs(t.x - x)))
        const score = room + Math.random() * 20
        if (!best || score > best.score) best = { lane, x, room, score }
      }
    })
    return best && best.room >= L.fw + 8 ? best : null
  }

  // One more thing: at `lane`/`x` if given, otherwise it floats in from the
  // side, in the lane with the most room at its entrance. If every entrance
  // is taken right now, nothing is added (the loop tries again in a moment).
  const addThing = ({ lane, x, first = false } = {}) => {
    const L = layRef.current
    const targets = hungry().map(m => m.letter)
    if (!L || !targets.length) return
    if (lane == null && reduce) {
      const spot = freeSpot()
      if (!spot) return
      ;({ lane, x } = spot)
    }
    if (lane == null) {
      const gates = L.lanes.map((_, i) => {
        const dir = L.dir(i), gate = dir > 0 ? -L.fw / 2 - 6 : L.w + L.fw / 2 + 6
        const room = Math.min(L.w, ...g.things.filter(t => t.lane === i && !t.away).map(t => Math.abs(t.x - gate)))
        return { lane: i, gate, room, score: room + Math.random() * 30 }
      }).sort((a, b) => b.score - a.score)
      if (gates[0].room < L.fw * 2.3) return
      lane = gates[0].lane
      x = gates[0].gate
    }
    const spec = pickThing({ targets, afloat: g.things, avoid: g.recent, count: cfg.count, near: cfg.near, first })
    if (!spec) return
    const y = L.lanes[Math.min(lane, L.lanes.length - 1)]
    const id = ++g.uid
    g.things.push({
      id, ...spec, tint: TINTS[id % TINTS.length], lane, x, y, oy: 0, held: false, away: false, vy: 0,
      t: 0, ph: Math.random() * 6.28, freq: 1.3 + Math.random() * 0.6, sway: Math.random() * 3,
      mx: motionValue(x), my: motionValue(y),
    })
  }

  // The first things for new monsters: spread over the sky, the word from
  // Lumi's sentence among them, at the start of its way across.
  const launch = () => {
    const L = layRef.current
    g.things = []
    const n = cfg.count, lanes = L.lanes.length
    // evenly over each lane, the lanes staggered, none right at the edge
    const edge = L.fw * 0.75, inner = Math.max(0, L.w - 2 * edge)
    for (let k = 0; k < n; k++) {
      const lane = k % lanes, j = Math.floor(k / lanes)
      const inLane = Math.ceil((n - lane) / lanes)
      const shift = lanes > 1 ? (lane % 2 ? 0.75 : 0.25) : 0.5
      addThing({ lane, x: edge + (inner * (j + shift)) / inLane, first: k === 0 })
    }
    bump()
  }

  // The balloons are let go: everything still in the air flies up and away
  const release = () => {
    g.picked = null
    g.drag = null
    if (reduce) g.things = []
    else g.things.forEach(t => { t.away = true; t.held = false })
  }

  useAnimationFrame((_, delta) => {
    const L = layRef.current
    if (!L || pausedRef.current) return
    const dt = Math.min(delta / 1000, 0.05)
    g.pace += (g.paceTo - g.pace) * Math.min(1, dt * 1.2)
    const v = L.speed(cfg.cross) * g.pace
    // while a thing is picked up (two monsters) the sky waits for the child
    const drift = !reduce && g.phase === 'play' && g.picked == null
    let changed = false
    for (const t of [...g.things]) {
      t.t += dt
      if (t.away) {
        t.vy += 1400 * dt
        t.y -= t.vy * dt
        if (t.y < -L.fh) { g.things = g.things.filter(x => x !== t); changed = true; continue }
      } else if (!t.held) {
        const dir = L.dir(t.lane)
        if (drift) {
          // it comes in quickly and slows down to a float once it is in
          const inside = (dir > 0 ? t.x : L.w - t.x) / (L.fw * 0.6)
          t.x += dir * v * (inside < 1 ? 1 + 7 * (1 - Math.max(-1, inside)) : 1) * dt
        }
        t.oy *= Math.exp(-4 * dt)
        t.y = L.lanes[Math.min(t.lane, L.lanes.length - 1)] + t.oy + (reduce ? 0 : Math.sin(t.t * t.freq + t.ph) * L.bob)
        const gone = dir > 0 ? t.x > L.w + L.fw / 2 + 8 : t.x < -L.fw / 2 - 8
        // with reduced motion nothing drifts off: a thing nobody wants makes room after a while
        const stale = reduce && g.phase === 'play' && t.t > 9 && !hungry().some(m => m.letter === t.letter)
        if (gone || stale) {
          g.things = g.things.filter(x => x !== t)
          if (stale) addThing()
          changed = true
          continue
        }
      }
      t.mx.set(t.x)
      t.my.set(t.y)
    }
    // As many in the air as the level wants: when one was eaten or has
    // floated off, the next comes in from the side
    g.topUp += dt
    if (g.phase === 'play' && g.topUp > (reduce ? 1.2 : 0.12) && g.things.length < cfg.count) {
      g.topUp = 0
      const n = g.things.length
      addThing()
      if (g.things.length !== n) changed = true
    }
    // the eyes follow the nearest thing that fits
    for (const m of g.mons) {
      let tx = 0, ty = 0
      if (m.state === 'hungry') {
        const eye = topOf(m, EYES_Y)
        let best = null
        for (const t of g.things) {
          if (t.letter !== m.letter || t.away) continue
          const d = Math.hypot(t.x - eye.x, t.y - eye.y)
          if (!best || d < best.d) best = { d, t }
        }
        if (best) { tx = (best.t.x - eye.x) / (best.d || 1); ty = (best.t.y - eye.y) / (best.d || 1) }
      }
      const k = Math.min(1, dt * 7)
      m.look.x.set(m.look.x.get() + (tx - m.look.x.get()) * k)
      m.look.y.set(m.look.y.get() + (ty - m.look.y.get()) * k)
    }
    if (changed) bump()
  })

  // ── Monsters come and go ──────────────────────────────────────────────────

  const startGroup = (i) => {
    g.gi = i
    g.phase = 'intro'
    g.spat = []
    g.help = false
    g.picked = null
    g.mons = groups[i].map((d, pos) => ({
      ...d, pos, bites: 0, incoming: 0, mood: 'walk', moodSeq: 0, state: 'wait', clean: true, missRow: 0, spits: 0,
      look: { x: motionValue(0), y: motionValue(0) },
    }))
    lockPreviews()
    bump()
    introduce(0)
  }

  // A monster walks in, and Lumi says its letter once
  const introduce = (k) => {
    const m = g.mons[k]
    m.state = 'in'
    bump()
    if (!reduce) [0, 280, 560].forEach(ms => later(ms, () => sfx.step()))
    later(reduce ? 250 : 950, () => {
      m.mood = 'hungry'
      m.moodSeq++
      bump()
      narrate([g.gi === 0 && k === 0 ? rec(cfg.duo ? SAY_DUO : SAY_START) : null, rec(`abc/${slug(m.letter)}`)])
      afterSpeech(() => (k + 1 < g.mons.length ? introduce(k + 1) : begin()), reduce ? 200 : 600)
    })
  }

  const begin = () => {
    g.mons.forEach(m => { m.state = 'hungry' })
    g.phase = 'play'
    launch()
  }

  useEffect(() => {
    if (lay) startGroup(0)
  }, [!!lay]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Feeding ───────────────────────────────────────────────────────────────

  const feed = (t, m) => {
    const L = layRef.current
    if (m.state !== 'hungry' || m.bites + m.incoming >= m.need || t.away) return
    const fit = t.letter === m.letter
    g.things = g.things.filter(x => x !== t)
    if (g.picked === t.id) g.picked = null
    g.over = null
    if (fit) m.incoming++
    const seq = ++g.tapSeq
    sfx.pop()
    g.pops.push({ id: ++g.uid, x: t.x, y: t.y - L.fh / 2 + L.bh / 2, tint: t.tint })
    g.flyers.push({ id: ++g.uid, thing: t, m, fit, seq, from: { x: t.x, y: t.y + L.fh / 2 - L.disc / 2 }, to: topOf(m, MOUTH_Y) })
    g.recent = [...g.recent.slice(-3), t.word]
    // Lumi says the word, right or wrong: the first sound is heard every time
    if (fit) sayRight(undefined, { lead: [wordRec(t.word)] })
    else narrate([wordRec(t.word)])
    if (m.mood === 'hungry') m.mood = 'beg'
    // the next one floats in by itself (with reduced motion it appears in a free place)
    if (reduce) later(450, () => { if (g.phase === 'play' && g.things.length < cfg.count) { addThing(); bump() } })
    g.topUp = 0
    bump()
  }

  // The thing has reached the mouth
  const arrive = (f) => {
    g.flyers = g.flyers.filter(x => x !== f)
    const m = f.m
    if (f.fit) m.incoming = Math.max(0, m.incoming - 1)
    if (m.state !== 'hungry') { bump(); return }
    const el = monEls.current[m.slot]
    sfx.chomp()
    if (f.fit) {
      m.bites++
      m.missRow = 0
      g.help = false
      const last = m.bites >= m.need
      // the note, the star to the counter, the flame for a streak (Juice)
      const { milestone } = hit(el, { stars: last ? 3 : 1 })
      g.paceTo = Math.min(1.35, Math.max(g.paceTo, 0.9) + 0.06)
      if (last) { fill(m); return }
      if (milestone) burst(el, 'stars', 10)
      setMood(m, milestone ? 'dance' : 'eat', milestone ? 1100 : 620)
      return
    }
    // It chews once, then: bäh! Out it comes, in a high arc
    m.clean = false
    m.missRow++
    setMood(m, 'eat', 2000)
    later(reduce ? 60 : 380, () => {
      if (m.state !== 'hungry') return
      setMood(m, 'yuck', 950)
      sfx.boing()
      miss(el)
      g.paceTo = 0.78
      const L = layRef.current
      const from = topOf(m, MOUTH_Y)
      const to = spitSpot(L, g.mons.map(monX), m.pos, m.spits++)
      g.spat = [...g.spat.filter(s => Math.abs(s.to.x - to.x) > to.size * 0.6),
        { id: ++g.uid, thing: f.thing, from, to, peak: Math.max(L.top + to.size * 0.7, from.y - L.h * 0.4) }]
      if (m.missRow >= 2) g.help = true
      // Lumi's gentle word, unless the child is already at the next thing
      if (g.tapSeq === f.seq) afterSpeech(() => (g.tapSeq === f.seq ? sayWrong() : announce('wrong')))
      else announce('wrong')
      bump()
    })
  }

  // Full: a burp of letter bubbles, then off to the row
  const fill = (m) => {
    m.state = 'full'
    m.mood = 'full'
    m.moodSeq++
    if (m.clean) g.clean++
    g.picked = null
    shake(0.7)
    burst(monEls.current[m.slot], 'stars', 12)
    if (!g.mons.some(x => x.state === 'hungry')) { g.phase = 'full'; release() }
    bump()
    later(reduce ? 200 : 700, () => {
      const L = layRef.current, at = topOf(m, MOUTH_Y)
      m.mood = 'burp'
      sfx.burp()
      for (let i = 0; i < 5; i++) {
        g.bubbles.push({
          id: ++g.uid, letter: m.shown, color: m.color, delay: i * 0.14,
          x: at.x + (i - 2) * L.mw * 0.12, y: at.y, size: Math.round(L.mw * (0.2 + (i % 3) * 0.045)),
          rise: Math.min(at.y - L.top + 20, L.h * 0.5) * (0.75 + (i % 2) * 0.25), drift: (i % 2 ? 1 : -1) * L.mw * 0.08,
        })
      }
      bump()
    })
    later(reduce ? 700 : 2300, () => { m.state = 'leaving'; m.mood = 'walk'; sfx.slideUp(); bump() })
    later(reduce ? 1000 : 3150, () => {
      m.state = 'gone'
      g.row.push({ slot: m.slot, letter: m.letter, shown: m.shown, color: m.color })
      g.cheer = true
      sfx.sparkle()
      later(1200, () => { g.cheer = false; bump() })
      bump()
      if (g.mons.every(x => x.state === 'gone')) {
        if (g.gi + 1 < groups.length) later(reduce ? 100 : 350, () => startGroup(g.gi + 1))
        else later(reduce ? 100 : 500, finale)
      }
    })
  }

  // The end of the level: all full monsters dance, then the results
  const finale = () => {
    g.phase = 'finale'
    g.mons = []
    g.spat = []
    bump()
    sfx.tada()
    const r = rootRef.current?.getBoundingClientRect()
    const mid = r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.45 } : undefined
    later(150, () => burst(mid, 'confetti', 24))
    later(900, () => burst(mid, 'stars', 14))
    later(reduce ? 1600 : 3200, () => onComplete(result(g.clean, total)))
  }

  // ── Fingers ───────────────────────────────────────────────────────────────

  const stagePoint = (e) => {
    const r = rootRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  // The hungry monster at this point of the stage (with a generous edge)
  const monAt = (x, y) => hungry().find(m => {
    const L = layRef.current, s = scaleAt(m.bites, m.need)
    return Math.abs(x - monX(m)) < (L.mw * s) / 2 + 26 && y > L.h - L.ground - L.mh * s - 26
  })

  const playing = () => g.phase === 'play' && !pausedRef.current
  const pick = (t) => {
    g.picked = g.picked === t.id ? null : t.id
    sfx.flip()
    bump()
  }

  // One monster: a tap feeds it. Two monsters: drag the thing to one of
  // them, or tap the thing and then the monster.
  const onDown = (t, e) => {
    if (!playing() || t.away) return
    const hs = hungry()
    if (!hs.length) return
    if (hs.length === 1) { feed(t, hs[0]); return }
    e.currentTarget.setPointerCapture?.(e.pointerId)
    g.drag = { id: t.id, x0: e.clientX, y0: e.clientY, tx: t.x, ty: t.y, moved: false }
  }
  const onMove = (t, e) => {
    const d = g.drag
    if (!d || d.id !== t.id) return
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 10) return
      d.moved = true
      t.held = true
      g.picked = t.id
      sfx.flip()
    }
    t.x = d.tx + dx
    t.y = d.ty + dy
    const p = stagePoint(e)
    const over = monAt(p.x, p.y)?.slot ?? null
    if (over !== g.over || !d.drawn) { d.drawn = true; g.over = over; bump() }
  }
  const onUp = (t, e) => {
    const d = g.drag
    g.drag = null
    if (!d || d.id !== t.id) return
    if (!d.moved) { if (playing()) pick(t); return }
    t.held = false
    g.over = null
    const L = layRef.current, p = stagePoint(e)
    const m = monAt(p.x, p.y) ?? monAt(t.x, t.y + L.fh / 2 - L.disc / 2)
    if (m && playing()) { feed(t, m); return }
    // let go in the air: it floats on from where it is, or, if it would
    // cover another thing there, from where it was picked up
    const lane = L.lanes.reduce((best, y, i) => (Math.abs(y - t.y) < Math.abs(L.lanes[best] - t.y) ? i : best), 0)
    const covers = g.things.some(o => o !== t && !o.away && o.lane === lane && Math.abs(o.x - t.x) < L.fw + 4)
    if (covers) { t.x = d.tx; t.y = d.ty } else t.lane = lane
    t.oy = t.y - L.lanes[t.lane]
    g.picked = null
    bump()
  }
  const onKey = (t, e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    e.preventDefault()
    if (!playing() || t.away) return
    const hs = hungry()
    if (hs.length === 1) feed(t, hs[0])
    else if (hs.length) pick(t)
  }

  // A tap on a monster: it takes the thing that was picked; otherwise it is
  // tickled, giggles, and Lumi says its letter again
  const tapMonster = (m) => {
    if (!playing() || m.state !== 'hungry') return
    const t = g.picked != null && g.things.find(x => x.id === g.picked)
    if (t) { feed(t, m); return }
    sfx.giggle()
    setMood(m, 'dance', 800)
    narrate([rec(`abc/${slug(m.letter)}`)])
  }
  const tapRow = (r) => {
    sfx.giggle()
    narrate([soundRec(r.letter)])
    r.tickle = (r.tickle ?? 0) + 1
    bump()
  }

  // ── The hint hand ─────────────────────────────────────────────────────────
  // When the child waits, the hand shows the move on a thing that fits: a
  // tap, or (two monsters) the way to its monster.
  const hint = useMemo(() => {
    const choice = () => {
      const L = layRef.current
      if (!L || g.phase !== 'play') return null
      const hs = g.mons.filter(m => m.state === 'hungry')
      let best = null
      for (const t of g.things) {
        const m = hs.find(x => x.letter === t.letter)
        if (!m || t.away || !t.el || t.x < L.fw * 0.7 || t.x > L.w - L.fw * 0.7) continue
        const d = t.id === g.picked ? -1 : Math.abs(t.x - L.w / 2)
        if (!best || d < best.d) best = { d, t, m }
      }
      return best
    }
    return {
      // the plate, not the balloon
      thing: { get current() { return choice()?.t.el?.querySelector('.mm-plate') ?? null } },
      monster: { get current() { const c = choice(); return c ? monEls.current[c.m.slot] ?? null : null } },
    }
  }, [g])

  const single = g.mons.filter(m => m.state === 'hungry').length < 2
  const firstTime = level <= 2 && g.gi === 0
  const setRoot = (el) => { rootRef.current = el; juice.stage.current = el }

  return (
    <div ref={setRoot} data-phase={g.phase} data-clean={g.clean}
      style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation' }}>
      {lay && (
        <>
          {/* The row of full monsters, with a free place for each one still to come */}
          {g.phase !== 'finale' && Array.from({ length: total }, (_, i) => {
            const r = g.row.find(x => x.slot === i), at = lay.slotAt(i)
            const box = { position: 'absolute', left: at.x - lay.mini / 2, top: at.y - lay.mini * MONSTER_RATIO, width: lay.mini, zIndex: 2 }
            if (!r) return <div key={i} aria-hidden="true" style={box}><Monster ghost width={lay.mini} /></div>
            return (
              <motion.div key={i} role="button" tabIndex={0} aria-label={`Sattes Monster ${r.shown}`} className="mm-monster"
                initial={reduce ? false : { scale: 1.25 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 12 }}
                onClick={() => tapRow(r)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapRow(r) } }}
                style={{ ...box, transformOrigin: '50% 100%' }}>
                <Monster key={r.tickle ?? 0} letter={r.shown} color={r.color} width={lay.mini} still={reduce} mood={g.cheer || r.tickle ? 'dance' : 'full'} />
              </motion.div>
            )
          })}

          {/* The star counter (Juice): where no balloon comes */}
          <div style={{ position: 'absolute', right: 10, zIndex: 6, ...(lay.wide ? { bottom: lay.ground + 2 } : { top: 10 }) }}>{juice.hud}</div>

          {/* The hungry monsters */}
          {g.mons.filter(m => m.state !== 'wait' && m.state !== 'gone').map(m => {
            const cx = monX(m), s = scaleAt(m.bites, m.need)
            const slot = lay.slotAt(m.slot)
            const leaving = m.state === 'leaving'
            const dy = slot.y - (lay.h - lay.ground)
            const fromX = (m.pos === 0 ? -1 : 1) * ((m.pos === 0 ? cx : lay.w - cx) + lay.mw)
            const begging = m.state === 'hungry' && m.mood === 'hungry' && !single && (g.over === m.slot || (g.picked != null && g.over == null))
            return (
              <motion.div key={m.slot} ref={el => { monEls.current[m.slot] = el }} className="mm-monster"
                role="button" tabIndex={0} aria-label={`Monster ${m.shown}`}
                data-monster={m.letter} data-state={m.state} data-bites={m.bites} data-need={m.need}
                onClick={() => tapMonster(m)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tapMonster(m) } }}
                initial={reduce ? { opacity: 0, x: 0, y: 0, scale: s } : { x: fromX, y: 0, scale: s, opacity: 1 }}
                animate={leaving
                  ? { x: slot.x - cx, y: reduce || dy < -40 ? dy : [0, -lay.mh * 0.45, dy], scale: lay.mini / lay.mw, opacity: 1 }
                  : { x: 0, y: 0, scale: s, opacity: 1 }}
                transition={leaving
                  ? { duration: reduce ? 0.2 : 0.8, ease: 'easeInOut' }
                  : { x: { duration: reduce ? 0.01 : 0.9, ease: 'easeOut' }, opacity: { duration: 0.2 }, scale: reduce ? { duration: 0.15 } : { type: 'spring', stiffness: 300, damping: 9 } }}
                style={{ position: 'absolute', left: cx - lay.mw / 2, bottom: lay.ground, width: lay.mw, height: lay.mh, transformOrigin: '50% 100%', zIndex: 3 }}>
                <Monster letter={m.shown} tag={m.tag} color={m.color} width={lay.mw} mood={begging ? 'beg' : m.mood} look={m.look} still={reduce} />
              </motion.div>
            )
          })}

          {/* Spat out: each lies where it landed and shows its own letter */}
          {g.spat.map(s => <Spat key={s.id} s={s} reduce={reduce} lower={!!cfg.lower} />)}

          {/* What floats past */}
          {g.things.map(t => {
            const m = g.help && !t.away ? g.mons.find(x => x.state === 'hungry' && x.letter === t.letter) : null
            return (
              <Thing key={t.id} t={t} lay={lay} reduce={reduce} paused={paused} picked={g.picked === t.id}
                glow={m ? (g.mons.length > 1 ? m.color : GOLD) : null}
                onDown={onDown} onMove={onMove} onUp={onUp} onKey={onKey} />
            )
          })}

          {g.pops.map(p => (
            <motion.div key={p.id} aria-hidden="true" initial={{ scale: 0.7, opacity: 0.95 }} animate={{ scale: 1.9, opacity: 0 }} transition={{ duration: reduce ? 0.01 : 0.3, ease: 'easeOut' }}
              onAnimationComplete={() => { g.pops = g.pops.filter(x => x !== p); bump() }}
              style={{ position: 'absolute', left: p.x - lay.bw / 2, top: p.y - lay.bh / 2, width: lay.bw, height: lay.bh, borderRadius: '50%', border: `5px solid ${p.tint}`, boxSizing: 'border-box', zIndex: 7, pointerEvents: 'none' }} />
          ))}

          {g.flyers.map(f => <Flyer key={f.id} f={f} lay={lay} reduce={reduce} onDone={arrive} />)}

          {g.bubbles.map(b => (
            <motion.div key={b.id} aria-hidden="true"
              initial={{ x: b.x, y: b.y, scale: 0.2, opacity: 0 }}
              animate={reduce ? { x: b.x, y: b.y - b.rise * 0.5, scale: 1, opacity: [0, 1, 1, 0] }
                : { x: [b.x, b.x + b.drift, b.x - b.drift * 0.6, b.x + b.drift * 0.4], y: [b.y, b.y - b.rise * 0.3, b.y - b.rise * 0.75, b.y - b.rise], scale: [0.2, 1, 1, 1.3], opacity: [0, 1, 1, 0] }}
              transition={{ duration: 1.7, delay: reduce ? 0 : b.delay, times: [0, 0.2, 0.8, 1], ease: 'easeOut' }}
              onAnimationComplete={() => { g.bubbles = g.bubbles.filter(x => x !== b); bump() }}
              style={{
                position: 'absolute', left: -b.size / 2, top: -b.size / 2, width: b.size, height: b.size, borderRadius: '50%', zIndex: 7, pointerEvents: 'none',
                background: `radial-gradient(circle at 34% 28%, rgba(255,255,255,0.95), ${b.color}66 55%, ${b.color}aa)`, border: `2.5px solid ${INK}`, boxSizing: 'border-box',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: b.size * 0.58, lineHeight: 1, color: INK,
              }}>{b.letter}</motion.div>
          ))}

          {g.phase === 'finale' && <Party row={g.row} lay={lay} reduce={reduce} />}
        </>
      )}

      {single
        ? <HintHand to={hint.thing} active={g.phase === 'play' && !paused} delay={firstTime ? 3500 : 8000} />
        : <HintHand from={hint.thing} to={hint.monster} active={g.phase === 'play' && !paused} delay={g.gi === 0 ? 5000 : 9000} />}
      {bursts}
      {juice.layer}
    </div>
  )
}

// A plate with a picture on it: what hangs on a balloon, flies into a
// mouth and comes back out again
function Plate({ art, size, pic, ring = INK, className, style }) {
  return (
    <div className={className} style={{
      width: size, height: size, borderRadius: '50%', boxSizing: 'border-box', flexShrink: 0,
      background: CREAM, border: `3px solid ${ring}`, boxShadow: '0 4px 0 rgba(42,27,61,0.28)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', ...style,
    }}>
      <Art art={art} size={pic} />
    </div>
  )
}

// A thing on its balloon. The whole of it takes the finger; the loop moves
// it through its two motion values.
function Thing({ t, lay, reduce, paused, picked, glow, onDown, onMove, onUp, onKey }) {
  return (
    <motion.div ref={el => { t.el = el }} className="mm-thing" role="button" tabIndex={0} aria-label={t.word} aria-pressed={picked || undefined}
      data-thing={t.letter}
      initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.3 }} animate={{ opacity: 1, scale: picked ? 1.14 : 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      onPointerDown={e => onDown(t, e)} onPointerMove={e => onMove(t, e)} onPointerUp={e => onUp(t, e)} onPointerCancel={e => onUp(t, e)}
      onKeyDown={e => onKey(t, e)}
      style={{ position: 'absolute', left: -lay.fw / 2, top: -lay.fh / 2, width: lay.fw, height: lay.fh, x: t.mx, y: t.my, zIndex: picked ? 6 : 5 }}>
      <div className={picked ? undefined : 'mm-sway'} style={{ animationDelay: `${-t.sway}s`, animationPlayState: paused ? 'paused' : undefined, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Balloon w={lay.bw} h={lay.bh} str={lay.str} tint={t.tint} />
        <Plate art={t.emoji} size={lay.disc} pic={lay.pic} ring={picked ? GOLD : INK}
          className={`mm-plate${glow ? ' mm-glow' : ''}`}
          style={{ '--mm-glow': glow ?? undefined, boxShadow: picked ? `0 0 0 5px ${GOLD}, 0 6px 0 rgba(42,27,61,0.28)` : undefined }} />
      </div>
    </motion.div>
  )
}

// The tapped thing drops into the mouth
function Flyer({ f, lay, reduce, onDone }) {
  const { from, to } = f
  return (
    <motion.div aria-hidden="true"
      initial={{ x: from.x, y: from.y, scale: 1, rotate: 0 }}
      animate={{ x: [from.x, (from.x + to.x) / 2, to.x], y: [from.y, Math.min(from.y, to.y) - lay.disc * 0.35, to.y], scale: [1, 0.9, 0.42], rotate: [0, 25, 70] }}
      transition={{ duration: reduce ? 0.02 : 0.44, times: [0, 0.5, 1], ease: 'easeIn' }}
      onAnimationComplete={() => onDone(f)}
      style={{ position: 'absolute', left: -lay.disc / 2, top: -lay.disc / 2, zIndex: 8, pointerEvents: 'none' }}>
      <Plate art={f.thing.emoji} size={lay.disc} pic={lay.pic} />
    </motion.div>
  )
}

// Spat out: a high arc to the ground. The picture tumbles, the badge with
// its first letter stays upright so it can be read in flight.
function Spat({ s, reduce, lower }) {
  const { from, to, peak, thing } = s
  const D = reduce ? 0.02 : 1.15
  const letter = lower ? thing.letter.toLowerCase() : thing.letter
  const badge = Math.round(to.size * BADGE)
  return (
    <motion.div aria-hidden="true" data-spat={thing.letter}
      initial={{ x: from.x, y: from.y, scale: 0.4 }}
      animate={{ x: to.x, y: [from.y, peak, to.y], scale: [0.4, 1.1, 1] }}
      transition={{ x: { duration: D, ease: 'linear' }, y: { duration: D, times: [0, 0.45, 1], ease: ['easeOut', 'easeIn'] }, scale: { duration: D, times: [0, 0.4, 1] } }}
      style={{ position: 'absolute', left: -to.size / 2, top: -to.size / 2, width: to.size, height: to.size, zIndex: 4, pointerEvents: 'none' }}>
      <motion.div initial={{ rotate: 0 }} animate={{ rotate: reduce ? 0 : to.side * 720 + (s.id % 2 ? 14 : -14) }} transition={{ duration: D, ease: 'easeOut' }}>
        <Plate art={thing.emoji} size={to.size} pic={Math.round(to.size * 0.78)} />
      </motion.div>
      <motion.div initial={reduce ? false : { scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 13, delay: reduce ? 0 : 0.12 }}
        style={{
          // on the side away from the monster, so it is never mistaken for part of its belly
          position: 'absolute', [to.side < 0 ? 'left' : 'right']: -badge * 0.42, top: -badge * 0.42, width: badge, height: badge, borderRadius: '50%', boxSizing: 'border-box',
          // cream and ink, like the letter on a monster's belly
          background: CREAM, border: `3px solid ${INK}`, boxShadow: '0 3px 0 rgba(42,27,61,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: badge * 0.68, lineHeight: 1, color: INK,
        }}>{letter}</motion.div>
    </motion.div>
  )
}

// The little party before the results: every full monster of the level dances
function Party({ row, lay, reduce }) {
  // side by side, in two rows where the screen is narrow
  const n = Math.max(1, lay.wide ? row.length : Math.ceil(row.length / 2))
  const width = Math.round(clamp((lay.w - 32) / n - 8, 56, lay.h * (lay.wide ? 0.34 : 0.24)))
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 55%, rgba(255,253,247,0.92), rgba(255,253,247,0.7) 70%)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 8, maxWidth: n * (width + 8) + 8 }}>
        {row.map((r, i) => (
          <motion.div key={r.slot} initial={reduce ? { opacity: 0 } : { y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ delay: i * 0.09, type: 'spring', stiffness: 260, damping: 16 }}>
            <Monster letter={r.shown} color={r.color} width={width} mood="dance" party still={reduce} />
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
