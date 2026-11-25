import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationFrame, useReducedMotion } from 'framer-motion'
import { narrate, leaveGame, lockPreviews } from '../narrator.js'
import { LINES, line } from '../lib/lumiLines.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { sfx } from '../sfx.js'
import { playAnimal } from '../lib/animalSounds.js'
import { Art, useBursts, useJuice, HintHand } from '../components/play/index.js'
import { useLater } from './zahlen/stage.jsx'
import { pxCard } from './px.js'
import { THINGS, CAT, planLevel, levelConfig, tasksIn, tiltOf, glints } from './schatten/data.js'
import { layoutFor } from './schatten/layout.js'
import { makeRoom, spawn, step, flee, gait, inLight, lookOf, floorOf, placeApart, tapTarget, inBeam, nextFocus, torchCatches, lampDrop, lampSize } from './schatten/sim.js'
import { Backdrop, Furniture, hidesOf } from './schatten/Room.jsx'
import { Garland, Eyes, CeilingLamp, Bunting, Joker, slotAt } from './schatten/parts.jsx'
import { gasp, lampOn, wakeSound } from './schatten/sound.js'

/**
 * Schattenrätsel — "Taschenlampen-Jagd": recognising things by their outline
 *
 * A dark room. Several shadows creep, scurry, roll and flutter about in it
 * (three at first, five at the top); in the dark only their eyes glow now
 * and then. The child shines a torch into the room (the light follows the
 * finger and sits just above it on a touch screen, or follows the mouse).
 * In the light a thing shows only as a black outline. A shadow caught in
 * the light gasps, freezes and trembles, and it stays softly lit and still
 * for a few seconds after the light has moved on, so one finger can go and
 * fetch a card.
 *
 * The cards below show the things in colour. Drag a card onto a lit
 * shadow, or just tap the card: it flies to the focus, the lit shadow the
 * child pointed the torch at or touched last (it wears a bright rim, the
 * other lit ones are dimmer), never to the one it happens to fit
 * (schatten/sim.js nextFocus, tapTarget).
 *   • Right: a lamp comes down over it and clicks on, the thing turns
 *     colourful, Lumi says its name, it waves and climbs up the cord onto
 *     the garland of friends above the room (a star flies to the counter).
 *   • Wrong: the card's own outline shows white over the shadow for a
 *     moment (two outlines that do not fit), the shadow shakes its head and the card flies back.
 *     After two wrong cards on one shadow it stays lit and the hand shows
 *     the right card.
 * Every shadow found, the whole room lights up and its friends come down
 * from the garland and dance. Then the next room (three or four per level:
 * nursery, kitchen, living room, attic, barn).
 *
 * The cat with the glowing yellow eyes is a joke: it has no card; caught by
 * the light it meows and runs out of the room. The 💡 joker lights the
 * whole room for a moment, once a room.
 *
 * Levels (schatten/data.js): more shadows and more cards than shadows, a
 * narrower light, look-alikes (dog, wolf and fox; apple, pear and tomato),
 * shadows that stay mirrored and then tipped over when caught, quicker
 * movement, fewer glowing eyes. Score: shadows matched with the first card.
 *
 * Game feel: the play kit's useJuice (a note and a star per match, the
 * streak and its flame); the light, the dust in it and the darkness are a
 * canvas drawn by the game's clock, the shadows move without React renders.
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const optional = key => (LINES[key] ? line(key) : null)
const wordOf = e => optional(THINGS[e]?.say) ?? optional(THINGS[e]?.word)
const nameOf = e => THINGS[e]?.name ?? 'Katze'
// the focus: a bright rim round its black outline (the shape stays the one to read)
const FOCUS_RIM = 'brightness(0) drop-shadow(0 0 2px #fff6c0) drop-shadow(0 0 2px #fff6c0) drop-shadow(0 0 9px #ffc93c)'
let seq = 0

// The dust in the light: specks in a unit circle, drifting
const DUST = Array.from({ length: 28 }, () => {
  const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random())
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, vx: (Math.random() - 0.5) * 0.08, vy: -0.03 - Math.random() * 0.07, s: 0.8 + Math.random() * 1.6 }
})

export default function ShadowGame({ level = 1, onComplete }) {
  const [plan] = useState(() => planLevel(level))
  const cfg = levelConfig(level)
  const total = useMemo(() => tasksIn(plan), [plan])
  const maxCards = Math.max(...plan.map(r => r.cards.length))
  const reduce = useReducedMotion()
  const { later, paused } = useLater()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [bursts, burst] = useBursts()

  // The play area, measured (the game is not scaled: real pointer coordinates)
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
  const L = useMemo(() => box && layoutFor(box.w, box.h, maxCards, total), [box, maxCards, total])
  const juice = useJuice({ hudSize: L?.hud.size ?? 32 })
  const { hit, miss } = juice   // these never change

  const [roomIdx, setRoomIdx] = useState(0)
  const room = plan[roomIdx]
  const last = roomIdx + 1 >= plan.length
  const [phase, setPhase] = useState('play')        // play · party
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  const [cardsLeft, setCardsLeft] = useState(room.cards)
  const [busy, setBusy] = useState([])              // cards in the air
  const [found, setFound] = useState([])            // { e, name, slot, room }
  const [away, setAway] = useState([])              // garland places whose friend is down at the party
  const [hop, setHop] = useState(0)
  const [flights, setFlights] = useState([])        // cards flying to a shadow or back
  const [climbers, setClimbers] = useState([])      // found things on their way to the garland
  const [lamps, setLamps] = useState([])            // { id, x }
  const [nope, setNope] = useState(null)            // the outline of a card that did not fit
  const [jokerUsed, setJokerUsed] = useState(false)
  const [drag, setDrag] = useState(null)            // { e, size }
  const [help, setHelp] = useState(null)            // a shadow missed twice: the hand shows its card
  const [caughtId, setCaughtId] = useState(null)    // the shadow caught last
  const [demo, setDemo] = useState(false)           // a finger shows the torch
  // a mouse: the light sits on the pointer, so the demo shows no finger
  const mouse = useRef(typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches)
  const [, setVer] = useState(0)
  const bump = useCallback(() => setVer(v => v + 1), [])
  const firstTry = useRef(0)
  const slotSeq = useRef(0)
  const roomDone = useRef(0)
  const handedIn = useRef(false)
  const saidCard = useRef(false)

  // Elements the clock moves
  const roomEl = useRef(null), canvasRef = useRef(null), torchRef = useRef(null), fingerRef = useRef(null), ghostRef = useRef(null)
  const shadowEls = useRef({}), innerEls = useRef({}), eyeEls = useRef({}), cardEls = useRef({}), cardsBoxRef = useRef(null)

  // The world of the room: the shadows, the light, the lamps (no renders)
  const W = useRef(null)
  const S = L?.S ?? 80
  const beamR = L ? Math.round(Math.max(S * 0.66, L.beam * cfg.beam)) : 100
  const torchSize = Math.round(clamp(beamR * 0.5, 44, 78))
  // where the torch lies when put down (its middle), and the room it takes there
  const torchRest = geo => ({ x: geo.W / 2, y: geo.H - torchSize * 0.83, r: geo.S * 0.5 + torchSize * 0.6 })

  useEffect(() => leaveGame, [])
  useEffect(() => {
    lockPreviews()
    narrate([optional('schatten/leuchte')])
  }, [])

  // A new room (or a new size): its shadows, spread out; on a resize the
  // shadows keep their places in proportion
  useEffect(() => {
    if (!L) return
    const { w: RW, h: RH } = L.room
    const geo = makeRoom(RW, RH, L.S, hidesOf(room.theme, RW, RH))
    const old = W.current
    if (old && old.roomIdx === roomIdx) {
      const fx = RW / old.geo.W, fy = RH / old.geo.H
      for (const s of old.shadows) { s.x *= fx; s.tx *= fx; s.y *= fy; s.ty *= fy }
      old.geo = geo
      return
    }
    const shadows = []
    room.shadows.forEach((e, i) => shadows.push(spawn(`${roomIdx}-${i}`, e, geo, Math.random, shadows)))
    if (room.cat) shadows.push(spawn(`${roomIdx}-cat`, CAT, geo, Math.random, shadows))
    for (const s of shadows) { s.sx = lookOf(s.e) === 0 ? 1 : s.face * lookOf(s.e); s.eyePhase = Math.random() * 4 }
    W.current = {
      roomIdx, geo, shadows, t: 0,
      // the torch lies ready at the front of the room until a finger picks it up
      beam: { on: false, a: 0, x: RW / 2, y: RH / 2 }, input: null, used: false,
      lastInput: performance.now(), demo: null, flashUntil: -1, lamps: [], dragging: false,
      // focus: the lit shadow a tapped card goes to · pin: a lit shadow a finger rests on
      // caughtOnce: the child caught one here (no more demo) · torch: where the torch is drawn
      focus: null, pin: null, caughtOnce: false, torch: null,
    }
    bump()
  }, [L, roomIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Positions in the game's own px ─────────────────────────────────────
  const rootPoint = (cx, cy) => {
    const r = rootRef.current.getBoundingClientRect()
    return { x: cx - r.left, y: cy - r.top }
  }
  const shadowPoint = s => ({ x: L.room.x + s.x, y: L.room.y + s.y })
  const cardPoint = e => {
    const el = cardEls.current[e]
    if (!el) return { x: L.cards.x + L.cards.w / 2, y: L.cards.y + L.cards.h / 2 }
    const r = el.getBoundingClientRect()
    return rootPoint(r.left + r.width / 2, r.top + r.height / 2)
  }

  // ── What happens ───────────────────────────────────────────────────────

  const lift = (s, geo) => {
    // caught while crouching behind the furniture: it pops up over it
    let y = s.y
    for (const h of geo.hides) {
      if (Math.abs(s.x - h.x) < h.w / 2 + geo.S * 0.3 && s.y + geo.S * 0.45 > h.top) y = Math.min(y, h.top - geo.S * 0.42)
    }
    return y
  }

  const catRuns = s => {
    const w = W.current
    s.state = 'run'
    s.tx = s.x < w.geo.W / 2 ? -w.geo.S : w.geo.W + w.geo.S
    s.ty = s.y
    s.dash = 99
    if (!playAnimal(CAT)) sfx.slideUp()
    bump()
  }

  const catchIt = (s, { quiet = false } = {}) => {
    const w = W.current
    if (s.e === CAT) { catRuns(s); return }
    s.state = 'caught'
    s.caughtAt = w.t
    s.litUntil = w.t + cfg.hold
    s.sxCaught = cfg.mirror ? (s.sx < 0 ? -1 : 1) : 1
    s.tiltTo = (Math.random() < 0.5 ? -1 : 1) * tiltOf(s.e, cfg)
    // over the furniture, and apart from the other lit ones (both ways),
    // so every outline shows on its own
    const held = w.shadows.filter(o => o !== s && (o.state === 'caught' || o.state === 'flying' || o.state === 'found'))
    const p = placeApart({ x: s.x, y: lift(s, w.geo) }, held.map(o => ({ x: o.slideTo ?? o.x, y: o.liftTo ?? o.y })), w.geo, undefined, [torchRest(w.geo)])
    s.slideTo = p.x
    s.liftTo = p.y
    s.hiding = false
    w.caughtOnce = true
    // the joker lights them all, but the child has not looked at them yet
    s.seenAt = quiet ? null : w.t
    if (!quiet) gasp(s.move === 'crawl' || s.move === 'fly' ? 1.25 : 1)
    if (!saidCard.current && level <= 3) {
      saidCard.current = true
      const say = optional('schatten/welches-bild')
      if (say) narrate([say])
    }
    bump()
  }

  // a shadow that keeps its light: one with help, and the focus after a wrong card (it waits for the next)
  const keepsLit = s => s.help || (s.missed && W.current?.focus === s.id)
  const setFocus = id => {
    const w = W.current
    if (!w || w.focus === id) return
    // the one it leaves, waiting after a wrong card, fades out gently, not at once
    const was = w.shadows.find(s => s.id === w.focus)
    if (was?.state === 'caught' && was.missed && !was.help) was.litUntil = Math.max(was.litUntil, w.t + 2)
    w.focus = id
    setCaughtId(id)
  }

  const letGo = s => {
    const w = W.current
    flee(s, w.beam, w.geo)
    s.liftTo = null
    s.slideTo = null
    s.seenAt = null
    sfx.giggle()
    bump()
  }

  // A card goes off: to a shadow (judged on arrival) or back to its place
  const launch = (e, from, s) => {
    s.state = 'flying'
    setBusy(b => (b.includes(e) ? b : [...b, e]))
    setFlights(l => [...l, { id: ++seq, e, from, to: shadowPoint(s), sid: s.id }])
    bump()
  }
  const flyBack = (e, from) => {
    setBusy(b => (b.includes(e) ? b : [...b, e]))
    setFlights(l => [...l, { id: ++seq, e, from, to: cardPoint(e), back: true }])
  }

  const party = () => {
    const w = W.current
    setPhase('party')
    phaseRef.current = 'party'
    w.beam.on = false
    for (const s of w.shadows) if (s.state !== 'gone') s.state = 'gone'
    setCaughtId(null)
    setHelp(null)
    lampOn()
    sfx.tada()
    narrate([optional('schatten/licht-an')])
    setAway([...foundNow.current])
    burst(roomEl.current, 'confetti', last ? 30 : 18)
    later(reduce ? 2200 : 3800, () => {
      setAway([])
      setHop(h => h + 1)
      if (last) {
        later(1500, () => {
          if (handedIn.current) return
          handedIn.current = true
          onComplete?.(result(firstTry.current, total))
        })
      } else later(900, nextRoom)
    })
  }
  // the places filled in this room (state may lag behind by a render)
  const foundNow = useRef([])

  const nextRoom = () => {
    const i = roomIdx + 1
    roomDone.current = 0
    foundNow.current = []
    setRoomIdx(i)
    setCardsLeft(plan[i].cards)
    setBusy([])
    setLamps([])
    setNope(null)
    setJokerUsed(false)
    setHelp(null)
    setCaughtId(null)
    setPhase('play')
  }

  // Found: up the cord onto the garland
  const climb = s => {
    const slot = slotSeq.current++
    const from = shadowPoint(s)
    s.state = 'gone'
    setClimbers(l => [...l, { id: s.id, e: s.e, from, to: slotAt(L.garland, slot, total), top: L.room.y, slot }])
    bump()
  }
  const landed = c => {
    setClimbers(l => l.filter(x => x.id !== c.id))
    setFound(f => [...f, { e: c.e, name: nameOf(c.e), slot: c.slot, room: roomIdx }])
    foundNow.current.push(c.slot)
    sfx.pop()
    roomDone.current += 1
    if (roomDone.current >= room.shadows.length) later(350, party)
  }

  const right = (s, f) => {
    const w = W.current
    s.state = 'found'
    s.foundAt = w.t
    const first = !s.missed
    if (first) firstTry.current += 1
    setBusy(b => b.filter(x => x !== f.e))
    setCardsLeft(l => l.filter(x => x !== f.e))
    // a lamp over the spot, a little to the side if another one hangs there
    const gap = clamp(S * 0.5, 34, 58) * 1.05
    let lx = s.x
    for (let k = 0; k < 6 && w.lamps.some(lp => Math.abs(lp.x - lx) < gap); k++) lx += (s.x < w.geo.W / 2 ? 1 : -1) * gap * 0.5
    lx = clamp(lx, gap / 2, w.geo.W - gap / 2)
    setLamps(l => [...l, { id: s.id, x: lx }])
    w.lamps.push({ x: lx, t0: w.t })
    lampOn()
    // a star only for a match with the first card: the counter and the results count the same
    hit(innerEls.current[s.id] ?? shadowEls.current[s.id], { stars: first ? 1 : 0 })
    burst(shadowEls.current[s.id], 'stars', 10)
    sayRight(null, { lead: [wordOf(s.e)].filter(Boolean) })
    setHelp(h => (h === s.id ? null : h))
    bump()
    later(1250, () => { if (s.move !== 'roll' && s.move !== 'hop') playAnimal(s.e) })
    later(reduce ? 1300 : 2300, () => climb(s))
  }

  const wrong = (s, f) => {
    const w = W.current
    s.missed = (s.missed ?? 0) + 1
    s.state = 'caught'
    s.litUntil = w.t + cfg.hold
    const inner = innerEls.current[s.id]
    miss(inner)
    if (!reduce) inner?.animate?.([{ rotate: '0deg' }, { rotate: '-14deg' }, { rotate: '12deg' }, { rotate: '-8deg' }, { rotate: '0deg' }], { duration: 650 })
    setNope({ k: ++seq, id: s.id, e: f.e, x: s.x, y: s.y })
    sayWrong()
    if (s.missed >= 2) { s.help = true; setHelp(s.id) }
    bump()
    later(reduce ? 200 : 650, () => { setNope(n => (n?.id === s.id ? null : n)); flyBack(f.e, shadowPoint(s)) })
  }

  const arrived = f => {
    setFlights(l => l.filter(x => x.id !== f.id))
    if (f.back) { setBusy(b => b.filter(x => x !== f.e)); return }
    const s = W.current?.shadows.find(x => x.id === f.sid)
    if (!s || s.state !== 'flying') { flyBack(f.e, f.to); return }
    if (s.e === f.e) right(s, f)
    else wrong(s, f)
  }

  // ── The torch ──────────────────────────────────────────────────────────

  const aim = (cx, cy, touch) => {
    const w = W.current
    const el = roomEl.current
    if (!w || !el) return
    const r = el.getBoundingClientRect()
    const px = cx - r.left, py = cy - r.top
    // on a touch screen the light shines just above the finger
    w.beam.x = px
    w.beam.y = touch ? py - beamR * 0.75 : py
    w.beam.touch = touch
    w.used = true
    w.lastInput = performance.now()
    if (w.demo) { w.demo = null; setDemo(false) }
  }
  const onRoomDown = e => {
    wakeSound()
    mouse.current = e.pointerType === 'mouse'
    const w = W.current
    if (!w || phaseRef.current !== 'play') return
    const touch = e.pointerType !== 'mouse'
    w.input = { id: e.pointerId, touch }
    // touching a lit shadow makes it the focus (the light shines above a finger, not on it)
    const lit = shadowAt(e.clientX, e.clientY)
    w.pin = lit ? { id: lit.id, x: e.clientX, y: e.clientY } : null
    if (lit) { lit.seenAt = w.t; setFocus(lit.id) }
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not capturable */ }
    w.beam.on = true
    aim(e.clientX, e.clientY, touch)
  }
  const onRoomMove = e => {
    const w = W.current
    if (!w || phaseRef.current !== 'play') return
    // the finger goes off the shadow it touched: the torch decides again
    if (w.pin && Math.hypot(e.clientX - w.pin.x, e.clientY - w.pin.y) > 24) w.pin = null
    if (e.pointerType === 'mouse') { w.beam.on = true; aim(e.clientX, e.clientY, false) }
    else if (w.input?.id === e.pointerId) aim(e.clientX, e.clientY, true)
  }
  const onRoomUp = e => {
    const w = W.current
    if (!w) return
    if (w.input?.id === e.pointerId) {
      w.input = null
      // a mouse goes on pointing; a finger's light fades where it was (the pin holds till it is out)
      if (e.pointerType === 'mouse') w.pin = null
      else w.beam.on = false
    }
  }
  const onRoomLeave = e => {
    const w = W.current
    if (w && e.pointerType === 'mouse' && !w.input) w.beam.on = false
  }

  // The joker: the whole room lights up for a moment and everything in it holds still
  const joker = () => {
    const w = W.current
    if (!w || jokerUsed || phaseRef.current !== 'play') return
    setJokerUsed(true)
    w.flashUntil = w.t + 1.6
    sfx.sparkle()
    for (const s of w.shadows) {
      if (s.state === 'dark') { catchIt(s, { quiet: true }); if (s.state === 'caught') s.litUntil = w.flashUntil + cfg.hold }
    }
    // a tapped card goes to the lit one nearest the torch, until the child shines on another
    const lit = w.shadows.filter(s => s.state === 'caught')
    if (!lit.some(s => s.seenAt != null)) {
      const near = lit.reduce((m, s) => (!m || Math.hypot(s.x - w.beam.x, s.y - w.beam.y) < Math.hypot(m.x - w.beam.x, m.y - w.beam.y) ? s : m), null)
      if (near) near.seenAt = w.t
    }
  }

  // ── The cards: drag one onto a lit shadow, or tap it ──────────────────

  const press = useRef(null)
  const shadowAt = (cx, cy) => {
    const el = roomEl.current, w = W.current
    if (!el || !w) return null
    const r = el.getBoundingClientRect()
    const x = cx - r.left, y = cy - r.top
    let best = null
    for (const s of w.shadows) {
      if (s.state !== 'caught') continue
      const d = Math.hypot(s.x - x, (s.liftTo ?? s.y) - y)
      if (d < w.geo.S * 0.8 && (!best || d < best.d)) best = { s, d }
    }
    return best?.s ?? null
  }
  const onCardDown = (ev, e) => {
    wakeSound()
    mouse.current = ev.pointerType === 'mouse'
    if (phaseRef.current !== 'play' || busy.includes(e) || !W.current) return
    try { ev.currentTarget.setPointerCapture(ev.pointerId) } catch { /* not capturable */ }
    press.current = { e, id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, moved: false }
  }
  const onCardMove = ev => {
    const p = press.current
    if (!p || p.id !== ev.pointerId) return
    if (!p.moved && Math.hypot(ev.clientX - p.x0, ev.clientY - p.y0) > 12) {
      p.moved = true
      W.current.dragging = true
      setDrag({ e: p.e })
    }
    if (p.moved && ghostRef.current) {
      const q = rootPoint(ev.clientX, ev.clientY)
      ghostRef.current.style.transform = `translate(${q.x}px, ${q.y}px) translate(-50%, -50%) scale(1.08)`
    }
  }
  const onCardUp = ev => {
    const p = press.current
    if (!p || p.id !== ev.pointerId) return
    press.current = null
    const w = W.current
    if (w) w.dragging = false
    if (phaseRef.current !== 'play' || !w) { setDrag(null); return }
    if (p.moved) {
      setDrag(null)
      const from = rootPoint(ev.clientX, ev.clientY)
      const s = shadowAt(ev.clientX, ev.clientY)
      if (s) { s.seenAt = w.t; setFocus(s.id); launch(p.e, from, s) }
      else flyBack(p.e, from)
      return
    }
    // a tap: the card flies to the lit shadow the child is looking at, and is judged there
    const s = tapTarget(w.shadows, w.focus)
    if (!s) {
      // nothing lit to go to: the card hops (before the first catch, the finger shows the torch)
      const el = cardEls.current[p.e]
      if (!reduce) el?.animate?.([{ translate: '0 0' }, { translate: '0 -14px' }, { translate: '0 0' }], { duration: 320 })
      sfx.boing()
      w.lastInput = 0
      return
    }
    launch(p.e, cardPoint(p.e), s)
  }

  // ── The clock: the shadows, the light, the darkness ───────────────────

  useAnimationFrame((_, delta) => {
    const w = W.current
    if (!w || !L || pausedRef.current) return
    const dt = Math.min(delta / 1000, 0.05)
    w.t += dt
    const { geo } = w
    const RS = geo.S
    const play = phaseRef.current === 'play'
    const beam = w.beam
    beam.r = beamR
    // at rest the torch lies at the front of the room, all of it inside
    const rest = { x: geo.W / 2, y: geo.H - torchSize * 0.95 - beamR * 0.75 }
    if (!w.used && !w.demo) { beam.x = rest.x; beam.y = rest.y }

    // A child who has not found out how yet: a finger sweeps the torch
    // through the room. Only before the first catch in a room; its light
    // catches nothing (the child does that).
    const idleMs = roomIdx === 0 && level <= 2 ? 2500 : 7000
    if (play && !w.demo && !w.caughtOnce && !w.input && !beam.on && performance.now() - w.lastInput > idleMs) {
      w.demo = { t0: w.t }
      setDemo(true)
    }
    let demoOn = false
    if (w.demo) {
      const k = (w.t - w.demo.t0) / 2.8
      if (k > 2 || !play || w.caughtOnce) { w.demo = null; w.lastInput = performance.now(); setDemo(false) }
      else {
        demoOn = true
        beam.x = geo.W * (0.5 - 0.36 * Math.cos(2 * Math.PI * k))
        beam.y = geo.H * (0.5 + 0.22 * Math.sin(4 * Math.PI * k))
        beam.touch = true
        const f = fingerRef.current
        if (f) f.style.transform = `translate(${beam.x - 14}px, ${beam.y + beamR * 0.75 - 6}px)`
      }
    }
    const on = play && (beam.on || demoOn)
    beam.a += ((on ? 1 : 0) - beam.a) * Math.min(1, dt * (on ? 14 : 6))
    // where the torch is: in the hand under its light, or back at its place at the front
    const hand = on ? beam : rest
    const want = { x: hand.x, y: hand.y + beamR * 0.75 - torchSize * 0.3 }
    if (!w.torch || on) w.torch = want
    else { const k = Math.min(1, dt * 9); w.torch = { x: w.torch.x + (want.x - w.torch.x) * k, y: w.torch.y + (want.y - w.torch.y) * k } }

    // The shadows
    const speed = cfg.speed * (reduce ? 0.7 : 1)
    const around = w.shadows.filter(s => s.state !== 'gone' && s.state !== 'run')
    // the lit ones: the dark ones keep out of their glow
    const litAt = w.shadows.filter(s => s.state === 'caught' || s.state === 'flying' || s.state === 'found').map(s => ({ x: s.slideTo ?? s.x, y: s.liftTo ?? s.y }))
    for (const s of w.shadows) {
      if (s.state === 'dark') {
        step(s, dt, geo, speed, Math.random, around.filter(o => o !== s), litAt)
        // only a child's torch catches: not the demo's light, nor its light fading out
        if (play && torchCatches(beam, demoOn) && inLight(s, beam, RS)) catchIt(s)
      } else if (s.state === 'caught') {
        s.t += dt
        if (beam.a > 0.5 && inLight({ x: s.x, y: s.liftTo ?? s.y }, { ...beam, r: beam.r * 1.15 }, RS)) s.litUntil = Math.max(s.litUntil, w.t + cfg.hold)
        else if (!keepsLit(s) && !w.dragging && w.t > s.litUntil) letGo(s)
      } else if (s.state === 'run') {
        s.t += dt
        const dx = s.tx - s.x
        s.x += Math.sign(dx) * Math.min(Math.abs(dx), geo.W * 0.6 * dt)
        s.face = Math.sign(dx) || 1
        if (Math.abs(dx) < 2) { s.state = 'gone'; bump() }
      } else s.t += dt
    }

    // The focus: the lit one the child pointed the torch at or touched last (sim.js nextFocus)
    if (play) {
      if (w.pin && !w.input && beam.a < 0.5) w.pin = null
      const now = inBeam(w.shadows, beam, RS)
      if (now) now.seenAt = w.t
      setFocus(nextFocus(w.focus, w.shadows, beam, RS, w.pin?.id ?? null))
    }

    // Drawing them: place, gait, a tremble in the light, the turn to face like the card
    const still = !!reduce
    for (const s of w.shadows) {
      const el = shadowEls.current[s.id]
      if (!el) continue
      let dy = 0, rot = 0, jx = 0
      const look = lookOf(s.e)
      if (s.state === 'dark' || s.state === 'run') {
        const g = gait(s, RS, still)
        dy = g.dy; rot = g.rot
        const want = look === 0 ? 1 : s.face * look
        s.sx += (want - s.sx) * Math.min(1, dt * 10)
        s.rotNow = rot
      } else if (s.state === 'caught' || s.state === 'flying') {
        if (s.liftTo != null) s.y += (s.liftTo - s.y) * Math.min(1, dt * 10)
        if (s.slideTo != null) s.x += (s.slideTo - s.x) * Math.min(1, dt * 8)
        s.sx += (s.sxCaught - s.sx) * Math.min(1, dt * 8)
        s.rotNow = (s.rotNow ?? 0) + (s.tiltTo - (s.rotNow ?? 0)) * Math.min(1, dt * 8)
        rot = s.rotNow
        if (!still) {
          const since = w.t - s.caughtAt
          if (since < 0.32) dy = -Math.sin((since / 0.32) * Math.PI) * RS * 0.14
          jx = Math.sin(s.t * 57) * 1.3
          rot += Math.sin(s.t * 43) * 1.6
        }
      } else if (s.state === 'found') {
        s.sx += (1 - s.sx) * Math.min(1, dt * 8)
        s.rotNow = (s.rotNow ?? 0) * Math.max(0, 1 - dt * 8)
        rot = s.rotNow
        const since = w.t - s.foundAt
        if (!still && since > 0.5 && since < 1.9) dy = -Math.abs(Math.sin((since - 0.5) * 6.7)) * RS * 0.14
      }
      const sx = Math.abs(s.sx) < 0.04 ? 0.04 * Math.sign(s.sx || 1) : s.sx
      el.style.transform = `translate(${s.x - RS / 2 + jx}px, ${s.y - RS / 2 + dy}px) rotate(${rot.toFixed(1)}deg) scaleX(${sx.toFixed(3)})`
      el.style.zIndex = String(10 + Math.round(s.y))
      if (el.dataset.state !== s.state) el.dataset.state = s.state
      const focus = w.focus === s.id ? '1' : '0'
      if (el.dataset.focus !== focus) el.dataset.focus = focus
      // its eyes in the dark (now and then, more seldom on higher levels)
      const eye = eyeEls.current[s.id]
      if (eye) {
        let o = 0
        if (play && (s.state === 'dark' || s.state === 'run') && !(beam.a > 0.3 && inLight(s, { ...beam, r: beam.r * 1.2 }, RS))) {
          o = s.e === CAT || cfg.eyes >= 1 ? 1 : ((w.t + s.eyePhase) % 4) / 4 < cfg.eyes ? 1 : 0
        }
        s.eyeO = (s.eyeO ?? 0) + (o - (s.eyeO ?? 0)) * Math.min(1, dt * 6)
        const dir = look === 0 ? 0 : Math.sign(s.sx) * look
        eye.style.opacity = s.eyeO.toFixed(2)
        eye.style.transform = `translate(${s.x + dir * RS * 0.16 - RS * 0.21}px, ${s.y - RS * 0.2 + dy - RS * 0.07}px)`
      }
    }

    // The darkness, with the light cut out of it
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (ctx && play) {
      const dpr = cv.width / geo.W
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, geo.W, geo.H)
      ctx.fillStyle = '#0a0518'
      ctx.fillRect(0, 0, geo.W, geo.H)
      ctx.globalCompositeOperation = 'destination-out'
      const hole = (x, y, r, a, core = 0.45) => {
        const gr = ctx.createRadialGradient(x, y, 0, x, y, r)
        gr.addColorStop(0, `rgba(0,0,0,${a})`)
        gr.addColorStop(core, `rgba(0,0,0,${a})`)
        gr.addColorStop(1, 'rgba(0,0,0,0)')
        ctx.fillStyle = gr
        ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
      }
      // the lamps that are on: a cone of light down to the floor
      const drop = lampDrop(geo.H)
      for (const lp of w.lamps) {
        const k = clamp((w.t - lp.t0) / 0.3, 0, 1)
        const top = drop + 22
        const gr = ctx.createLinearGradient(0, top, 0, geo.H)
        gr.addColorStop(0, `rgba(0,0,0,${0.85 * k})`)
        gr.addColorStop(1, `rgba(0,0,0,${0.35 * k})`)
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.moveTo(lp.x - 14, top); ctx.lineTo(lp.x + 14, top)
        ctx.lineTo(lp.x + RS * 0.85, geo.H); ctx.lineTo(lp.x - RS * 0.85, geo.H)
        ctx.closePath(); ctx.fill()
        hole(lp.x, top, 46, 0.9 * k)
      }
      // shadows held in the light: a soft glow that fades out at the end
      for (const s of w.shadows) {
        if (s.state === 'caught' || s.state === 'flying' || s.state === 'found') {
          const left = s.state === 'caught' && !keepsLit(s) ? clamp((s.litUntil - w.t) / 1.2, 0.25, 1) : 1
          // the focus bright, the other lit ones dimmer
          const dim = s.state === 'found' || w.focus === s.id ? 1 : 0.42
          hole(s.x, s.liftTo ?? s.y, RS * 0.95, 0.92 * left * dim, 0.5)
        }
      }
      // the joker: everything lit for a moment
      if (w.t < w.flashUntil) {
        ctx.fillStyle = `rgba(0,0,0,${clamp((w.flashUntil - w.t) / 0.4, 0, 0.94)})`
        ctx.fillRect(0, 0, geo.W, geo.H)
      }
      // the torch light: a soft cone from the torch and a round spot
      if (beam.a > 0.01) {
        const { x: hx, y: hy } = w.torch
        const gr = ctx.createLinearGradient(hx, hy, beam.x, beam.y)
        gr.addColorStop(0, `rgba(0,0,0,${0.55 * beam.a})`)
        gr.addColorStop(1, `rgba(0,0,0,${0.15 * beam.a})`)
        ctx.fillStyle = gr
        ctx.beginPath()
        ctx.moveTo(hx - torchSize * 0.14, hy)
        ctx.lineTo(beam.x - beamR * 0.55, beam.y)
        ctx.lineTo(beam.x + beamR * 0.55, beam.y)
        ctx.lineTo(hx + torchSize * 0.14, hy)
        ctx.closePath(); ctx.fill()
        hole(beam.x, beam.y, beamR, beam.a, 0.42)
      }
      // dust in the light
      ctx.globalCompositeOperation = 'source-over'
      if (beam.a > 0.05 && !still) {
        for (const d of DUST) {
          d.x += d.vx * dt; d.y += d.vy * dt
          if (d.x * d.x + d.y * d.y > 1) { d.x = (Math.random() - 0.5) * 1.4; d.y = 0.9 }
          const fade = 1 - Math.sqrt(d.x * d.x + d.y * d.y)
          ctx.fillStyle = `rgba(255,250,220,${(0.55 * fade * beam.a).toFixed(3)})`
          ctx.beginPath(); ctx.arc(beam.x + d.x * beamR * 0.85, beam.y + d.y * beamR * 0.85, d.s, 0, Math.PI * 2); ctx.fill()
        }
      }
      // a warm glow where the lamps shine
      for (const lp of w.lamps) {
        ctx.fillStyle = 'rgba(255,214,120,0.10)'
        ctx.beginPath()
        ctx.moveTo(lp.x - 14, drop + 22); ctx.lineTo(lp.x + 14, drop + 22)
        ctx.lineTo(lp.x + RS * 0.85, geo.H); ctx.lineTo(lp.x - RS * 0.85, geo.H)
        ctx.closePath(); ctx.fill()
      }
    }

    // the torch
    const tr = torchRef.current
    if (tr) {
      // in use it is bright; put down, it goes back to its place at the front, a little dimmer
      // (no caught shadow stands there: catchIt keeps them clear of it)
      tr.style.opacity = (play ? 0.7 + 0.3 * beam.a : 0).toFixed(2)
      const { x: hx, y: hy } = w.torch
      // the picture's lamp head is up and to the right: turned, it points up
      tr.style.transform = `translate(${hx - torchSize / 2}px, ${hy - torchSize * 0.08}px) rotate(-45deg)`
    }
  })

  // The canvas follows the room's size
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !L) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    cv.width = Math.round(L.room.w * dpr)
    cv.height = Math.round(L.room.h * dpr)
  }, [L, roomIdx])

  // ── Drawing ────────────────────────────────────────────────────────────

  const w = W.current
  const ready = L && w && w.roomIdx === roomIdx
  const shadows = ready ? w.shadows : []
  const lit = phase === 'party'
  const caughtEl = caughtId && { current: shadowEls.current[caughtId] }
  // the help (hand and pulsing card) while that shadow is the focus: a tapped card goes there
  const helpS = help && help === caughtId && shadows.find(s => s.id === help)
  const showCardHand = ready && phase === 'play' && !drag && !flights.length && caughtId && !help && shadows.some(s => s.id === caughtId && s.state === 'caught')
  // the friends down at the party; they fly back up before the next room shows
  const dancers = lit ? found.filter(f => f.room === roomIdx && away.includes(f.slot)) : []
  const drop = L ? lampDrop(L.room.h) : 40
  const lampPx = lampSize(S)

  return (
    <div ref={rootRef} data-game="schatten" data-phase={phase} data-room={roomIdx}
      style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}>
      {L && (
        <>
          <Garland box={L.garland} total={total} found={found} away={away} hop={hop} reduce={reduce} />
          <div style={{ position: 'absolute', left: L.hud.x, top: L.hud.y }}>{juice.hud}</div>

          {/* The room */}
          <div ref={juice.stage} style={{ position: 'absolute', left: L.room.x, top: L.room.y, width: L.room.w, height: L.room.h }}>
            <div ref={roomEl}
              onPointerDown={onRoomDown} onPointerMove={onRoomMove} onPointerUp={onRoomUp} onPointerCancel={onRoomUp} onPointerLeave={onRoomLeave}
              style={{
                position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 14, border: '3px solid #2a1b3d', boxSizing: 'content-box', margin: -3,
                boxShadow: '0 5px 0 rgba(42,27,61,0.35)', background: '#0a0518', cursor: phase === 'play' ? 'none' : 'default', touchAction: 'none',
              }}>
              <div style={{ position: 'absolute', left: 0, top: 0, width: L.room.w, height: L.room.h }}>
                <Backdrop theme={room.theme} W={L.room.w} H={L.room.h} mode={lit ? 'lit' : 'shade'} />
                <Furniture theme={room.theme} W={L.room.w} H={L.room.h} mode={lit ? 'lit' : 'shade'} layer="back" />
                {/* the shadows */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', isolation: 'isolate' }}>
                  {shadows.filter(s => s.state !== 'gone').map(s => (
                    <div key={s.id} ref={el => { shadowEls.current[s.id] = el }} data-shadow={s.e} data-state={s.state} aria-hidden="true"
                      style={{ position: 'absolute', left: 0, top: 0, width: S, height: S, willChange: 'transform', transform: `translate(${s.x - S / 2}px, ${s.y - S / 2}px)` }}>
                      <div ref={el => { innerEls.current[s.id] = el }} style={{ width: S, height: S, display: 'flex', transformOrigin: '50% 80%' }}>
                        <Art art={s.e} size={S} style={{ filter: s.state === 'found' ? 'none' : s.id === caughtId && (s.state === 'caught' || s.state === 'flying') ? FOCUS_RIM : 'brightness(0)', transition: 'filter .55s ease-in-out' }} />
                      </div>
                      {s.state === 'found' && (
                        <motion.div initial={{ scale: 0, rotate: 0 }} animate={reduce ? { scale: 1 } : { scale: 1, rotate: [0, 25, -10, 25, -10, 0] }}
                          transition={{ delay: 0.6, duration: 1.1 }}
                          style={{ position: 'absolute', right: -S * 0.3, top: -S * 0.12, transformOrigin: '30% 90%' }}>
                          <Art art="👋" size={Math.round(S * 0.42)} />
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
                <Furniture theme={room.theme} W={L.room.w} H={L.room.h} mode={lit ? 'lit' : 'shade'} layer="front" />

                {/* the darkness and the light */}
                <motion.canvas ref={canvasRef} aria-hidden="true" initial={false} animate={{ opacity: lit ? 0 : 1 }} transition={{ duration: lit ? 0.7 : 0.3 }}
                  style={{ position: 'absolute', left: 0, top: 0, width: L.room.w, height: L.room.h, pointerEvents: 'none' }} />
                {!lit && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                  <div style={{ position: 'absolute', left: 0, right: 0, top: floorOf(L.room.w, L.room.h), borderTop: '3px solid rgba(190,178,240,0.22)' }} />
                  <Furniture theme={room.theme} W={L.room.w} H={L.room.h} mode="ghost" />
                </div>}
                {lit && <Bunting w={L.room.w} />}

                {/* a card that did not fit: its own outline in white over the black shadow, two shapes that differ */}
                <AnimatePresence>
                  {nope && (
                    <motion.div key={nope.k} aria-hidden="true" initial={{ opacity: 0, scale: 1.2 }} animate={{ opacity: 0.88, scale: 1, x: reduce ? 0 : [0, -8, 8, -4, 0] }} exit={{ opacity: 0 }}
                      transition={{ duration: 0.35 }}
                      style={{ position: 'absolute', left: nope.x - S * 0.5, top: nope.y - S * 0.5, width: S, height: S, pointerEvents: 'none', zIndex: 2 }}>
                      <Art art={nope.e} size={S} style={{ filter: 'brightness(0) invert(1) drop-shadow(0 0 2px #ff3b2f) drop-shadow(0 0 5px #ff3b2f)' }} />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* glowing eyes in the dark */}
                {!lit && shadows.filter(s => s.state !== 'gone').map((s, i) => (
                  <div key={s.id} ref={el => { eyeEls.current[s.id] = el }} aria-hidden="true"
                    style={{ position: 'absolute', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: 3 }}>
                    <Eyes size={Math.round(S * 0.42)} cat={s.e === CAT} glint={glints(s.e)} delay={i * 0.9} />
                  </div>
                ))}

                {/* the lamps that came down */}
                {lamps.map(lp => <CeilingLamp key={lp.id} x={lp.x} drop={drop} size={lampPx} reduce={reduce} />)}

                {/* the friends, down from the garland, dancing in the lit room */}
                <AnimatePresence>
                  {dancers.map((f, i) => {
                    const n = dancers.length
                    const size = Math.round(Math.min(S * 1.05, (L.room.w * 0.9) / n))
                    const x = (L.room.w * (i + 1)) / (n + 1) - size / 2
                    return (
                      <motion.div key={`${f.slot}-d`} aria-hidden="true"
                        initial={{ y: -L.room.h, opacity: 1 }}
                        animate={reduce ? { y: 0 } : { y: [-L.room.h, 0, -size * 0.3, 0, -size * 0.3, 0, -size * 0.3, 0], rotate: [0, 0, -12, 12, -12, 12, -8, 0] }}
                        exit={{ y: -L.room.h, transition: { duration: 0.5, delay: i * 0.05 } }}
                        transition={{ duration: 3.2, delay: i * 0.12, times: [0, 0.18, 0.3, 0.42, 0.54, 0.66, 0.8, 1] }}
                        style={{ position: 'absolute', left: x, top: L.room.h - size * 1.12, width: size, height: size, pointerEvents: 'none', zIndex: 4 }}>
                        <Art art={f.e} size={size} />
                      </motion.div>
                    )
                  })}
                </AnimatePresence>

                {/* the torch, and the finger that shows it */}
                <div ref={torchRef} aria-hidden="true"
                  style={{ position: 'absolute', left: 0, top: 0, opacity: 0, pointerEvents: 'none', zIndex: 5, filter: 'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }}>
                  <Art art="🔦" size={torchSize} />
                </div>
                {demo && !mouse.current && (
                  <div ref={fingerRef} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 6, filter: 'drop-shadow(0 4px 3px rgba(0,0,0,0.5))' }}>
                    <Art art="👆" size={58} />
                  </div>
                )}
              </div>
              {/* a new room: the door opens on the dark */}
              <motion.div key={`door-${roomIdx}`} aria-hidden="true" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.6 }}
                style={{ position: 'absolute', inset: 0, background: '#0a0518', pointerEvents: 'none', zIndex: 7 }} />
            </div>
          </div>
          {/* the light joker, outside the room: it covers no shadow */}
          <Joker used={jokerUsed || phase !== 'play'} onClick={joker} x={L.joker.x} y={L.joker.y} size={L.joker.size} />

          {/* The cards */}
          <Cards L={L} cards={room.cards} left={cardsLeft} busy={busy} drag={drag} help={helpS?.e} done={lit} boxRef={cardsBoxRef} cardEls={cardEls}
            onDown={onCardDown} onMove={onCardMove} onUp={onCardUp} reduce={reduce} />

          {/* in the air: cards, the found ones climbing to the garland, the dragged card */}
          {flights.map(f => (
            <motion.div key={f.id} aria-hidden="true" initial={{ x: f.from.x, y: f.from.y, scale: f.back ? 0.7 : 1 }}
              animate={{ x: f.to.x, y: f.to.y, scale: f.back ? 1 : 0.7 }} transition={{ duration: reduce ? 0.15 : f.back ? 0.4 : 0.32, ease: 'easeOut' }}
              onAnimationComplete={() => arrived(f)}
              style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none' }}>
              <div style={{ transform: 'translate(-50%, -50%)', width: L.cards.size, height: L.cards.size, ...pxCard(), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Art art={f.e} size={Math.round(L.cards.size * 0.74)} />
              </div>
            </motion.div>
          ))}
          {climbers.map(c => (
            <motion.div key={c.id} aria-hidden="true" initial={{ x: c.from.x, y: c.from.y, scale: 1 }}
              animate={reduce ? { x: c.to.x, y: c.to.y, scale: (L.garland.pic - 6) / S } : { x: [c.from.x, c.from.x, c.to.x], y: [c.from.y, c.top + S * 0.3, c.to.y], scale: [1, 0.85, (L.garland.pic - 6) / S] }}
              transition={{ duration: reduce ? 0.3 : 1.1, times: reduce ? undefined : [0, 0.55, 1], ease: 'easeInOut' }}
              onAnimationComplete={() => landed(c)}
              style={{ position: 'absolute', left: 0, top: 0, zIndex: 21, pointerEvents: 'none' }}>
              <div style={{ transform: 'translate(-50%, -50%)', display: 'flex' }}><Art art={c.e} size={S} /></div>
            </motion.div>
          ))}
          {drag && (
            <div ref={ghostRef} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, zIndex: 22, pointerEvents: 'none', transform: 'translate(-999px,-999px)' }}>
              <div style={{ width: L.cards.size, height: L.cards.size, ...pxCard('selected'), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 18px rgba(0,0,0,0.35)' }}>
                <Art art={drag.e} size={Math.round(L.cards.size * 0.74)} />
              </div>
            </div>
          )}

          {/* the hand: how to bring a card to a lit shadow; after two misses, which card. One hand at a
              time: none while the demo finger shows the torch. It comes well before a shadow lets go. */}
          <HintHand from={helpS ? { current: cardEls.current[helpS.e] } : cardsBoxRef} to={helpS ? { current: shadowEls.current[helpS.id] } : caughtEl}
            active={!!(helpS || showCardHand) && phase === 'play' && !flights.length && !demo}
            delay={helpS ? 400 : level <= 2 ? 2500 : Math.min(4000, (cfg.hold - 1.5) * 1000)} />
        </>
      )}
      {juice.layer}
      {bursts}
    </div>
  )
}

/**
 * The cards: the things in colour, in fixed places (a card that found its
 * shadow leaves an empty place). Press and drag, or tap.
 */
function Cards({ L, cards, left, busy, drag, help, done, boxRef, cardEls, onDown, onMove, onUp, reduce }) {
  const { size, cols: maxCols } = L.cards
  const cols = L.side ? L.cards.cols : Math.min(maxCols, cards.length)
  const rows = Math.ceil(cards.length / cols)
  const gw = cols * size + (cols - 1) * 8, gh = rows * size + (rows - 1) * 8
  return (
    <div ref={boxRef} style={{
      position: 'absolute', left: L.cards.x + (L.cards.w - gw) / 2, top: L.cards.y + (L.cards.h - gh) / 2, width: gw, height: gh,
      display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'center', gap: 8,
    }}>
      {cards.map(e => {
        const here = left.includes(e)
        const away = busy.includes(e) || drag?.e === e
        if (!here) {
          return <div key={e} aria-hidden="true" style={{ width: size, height: size, boxSizing: 'border-box', borderRadius: 14, border: '3px dashed rgba(255,255,255,0.28)' }} />
        }
        return (
          <motion.button key={e} type="button" data-card={e} aria-label={THINGS[e].name}
            ref={el => { cardEls.current[e] = el }}
            onPointerDown={ev => onDown(ev, e)} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
            animate={help === e && !reduce ? { scale: [1, 1.1, 1], boxShadow: ['0 0 0 0px #ffc93c', '0 0 0 7px #ffc93c', '0 0 0 0px #ffc93c'] } : { scale: 1 }}
            transition={help === e ? { duration: 0.9, repeat: Infinity } : { duration: 0.2 }}
            style={{
              ...pxCard(), width: size, height: size, padding: 0, boxSizing: 'border-box', cursor: 'grab', touchAction: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: away ? 0.25 : done ? 0.45 : 1, transition: 'opacity .4s',
            }}>
            <Art art={e} size={Math.round(size * 0.74)} />
          </motion.button>
        )
      })}
    </div>
  )
}
