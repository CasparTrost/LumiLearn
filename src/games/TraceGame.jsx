import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, afterNarration, leaveGame } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { emojiSrc, hasEmojiArt } from '../lib/emojiArt.jsx'
import { Critter, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { voice, KEY } from './woerter/voice.js'
import {
  GLYPHS, isDigit, pathOf, lengths, pointAt, guidanceFor, glyphsForLevel, makeTracer, arrowsAt, starsAt, SNAIL_AT,
} from './traceStrokes.js'
import { praiseOf } from './spuren/words.js'
import { bodyOf } from './spuren/alive.js'
import { VIEW, MINI, INK_W, SPUREN_CSS, GlyphBody, MiniGlyph, Pic } from './spuren/Glyph.jsx'
import Parade from './spuren/Parade.jsx'
import { pxPanel, pxBubble, pxButton, INK } from './px.js'

/**
 * Buchstaben-Spuren — Buchstaben und Ziffern mit dem Finger nachfahren.
 *
 * Scientific basis:
 *   • Writing a letter by hand makes it easier to recognise than typing it or
 *     only looking at it (Longcamp et al. 2005; James & Engelhardt 2012): the
 *     movement itself is what is learned. So the path matters — every stroke
 *     starts at its green dot, runs the way the arrow shows, in the order
 *     children learn in school.
 *   • Show, then do: on the very first letter Lumi's finger draws the stroke
 *     once before the child tries (worked example). After two slips on the
 *     same stroke it is shown again.
 *   • Fading help: from level 7 only one arrow at the start, from level 9 a
 *     paler road, at level 10 only a faint outline and the start dots.
 *   • Once a letter is done, its picture pops out of it and Lumi says the
 *     recorded "L wie Löwe.": the shape, the movement and the sound together.
 *
 * The game around it (docs/game-konzepte.md):
 *   • A snail waits at the green dot, looking the way the stroke goes. The
 *     finger pushes it along the road; it leaves a shining trail and collects
 *     the stars that lie on the stroke. The faster and smoother the ride, the
 *     more the trail glitters — but slow and careful collects every star too.
 *   • Leaving the road is no drama: the ink fades, the snail waits a moment
 *     where the finger left, shakes its head and slides back to the dot.
 *   • At the end of a stroke the collected stars fly to the counter, one
 *     more for a stroke done in one go; strokes in a row without leaving the
 *     road build the streak (components/play/Juice.jsx).
 *   • A finished glyph comes alive: eyes, legs, a shake, and its picture
 *     pops out of it. Then it walks to its place on the shelf, which has one
 *     place for each glyph of the level, and the ones already there wave.
 *   • The level ends with the whole shelf marching across the board.
 */

// Bright inks, one per glyph, each clearly visible on the light road; no
// red, which means "wrong" elsewhere in the app
const INKS = ['#2F7FD8', '#8A4FD0', '#13968C', '#D63A7C', '#E07A10', '#3B9B3B']
const ROAD = 17
const LEAD = SNAIL_AT      // the snail is pushed: it rides this far ahead of the finger
const SNAIL = 26           // its size, in box units
const HAND = hasEmojiArt('👆') ? emojiSrc('👆') : null
const STAR = emojiSrc('⭐')
const SNAIL_ART = emojiSrc('🐌')
const GLITTER = ['#ffd34d', '#ffffff', '#ffb3d9', '#9be7ff']

// A column beside the board: on a pale sheet of its own, so that what stands
// in it is not mixed up with the room behind (the wall shelf with its shapes
// looked like a part of the game)
const SIDE = {
  flexShrink: 0, alignSelf: 'center', boxSizing: 'border-box', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', padding: '12px 10px', borderRadius: 18,
  background: 'rgba(255,249,236,0.88)', boxShadow: '0 0 0 2px rgba(42,27,61,0.1)',
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** Part of a stroke, from its start to share t (for the demo finger). */
function partOf(stroke, t) {
  const cum = lengths(stroke)
  const s = cum[cum.length - 1] * t
  const pts = stroke.filter((_, i) => cum[i] <= s)
  const tip = pointAt(stroke, s, cum)
  return { d: pathOf([...pts, tip]), tip }
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize(s => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

let ids = 0
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// a little four-pointed star for the glitter of the trail
const SPARK = 'M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z'

export default function TraceGame({ level = 1, onComplete }) {
  const glyphs = useState(() => glyphsForLevel(level))[0]
  const guide = guidanceFor(level)
  const paused = usePaused()

  const [idx,       setIdx]       = useState(0)
  const [strokeIdx, setStrokeIdx] = useState(0)
  const [done,      setDone]      = useState(false)
  const [ink,       setInk]       = useState([])     // the finger's line of this attempt
  const [fading,    setFading]    = useState([])     // slipped attempts, fading away
  const [demo,      setDemo]      = useState(null)   // { id, stroke, t } while Lumi shows the way
  const [mood,      setMood]      = useState('idle')
  const [firstTry,  setFirstTry]  = useState(0)
  const [finale,    setFinale]    = useState(false)  // the level is done: the parade before the results
  const [sparks,    setSparks]    = useState([])     // the glitter behind the snail
  const [run,       setRun]       = useState(0)      // glyphs in a row without a slip
  const [startHint, setStartHint] = useState(false)  // the finger started away from the dot
  const [leave,     setLeave]     = useState(false)  // the praise is over: off to the shelf
  const [walk,      setWalk]      = useState(false)  // the finished glyph walks to the shelf
  const [flight,    setFlight]    = useState(null)   // … from where to where, in px
  const [shelf,     setShelf]     = useState([])     // the glyphs done in this level, on the shelf
  const [waves,     setWaves]     = useState(0)      // the shelf waves when the next glyph is done
  const [rideS,     setRideS]     = useState(null)   // how far along the stroke the finger is (null: not on it)
  const [slipAt,    setSlipAt]    = useState(null)   // { s, id }: the snail waits where the finger left
  const [hop,       setHop]       = useState(0)      // the snail hops at the end of a stroke
  const [flow,      setFlow]      = useState(0)      // 0 … 1: how fast and smooth the ride is
  const [soon,      setSoon]      = useState(false)  // Lumi is about to show the stroke again
  const [bursts, burst] = useBursts()

  const rootRef   = useRef(null)
  const dotRef    = useRef(null)    // the green start dot, for the hint hand
  const areaRef   = useRef(null)
  const svgRef    = useRef(null)
  const shelfRef  = useRef(null)
  const picRef    = useRef(null)    // the picture that popped out of the letter
  const tracerRef = useRef(null)
  const pointerRef = useRef(null)   // the finger that draws; others are ignored
  const inkRef    = useRef([])
  const rideRef   = useRef({ got: 0, at: 0, speed: 0, since: 0 })   // this attempt: stars, time, pace
  const missedRef = useRef(false)   // this glyph had a slip: not first try
  const cleanRef  = useRef(true)    // this stroke had no slip yet: done in one go
  const strokeMissRef = useRef(0)
  const demoT     = useRef(0)
  const demoEnd   = useRef(null)
  const demoShown = useRef(false)
  const arrived   = useRef(-1)      // the glyph that has reached the shelf
  const timers    = useRef(new Set())

  const root = useSize(rootRef)
  const area = useSize(areaRef)
  const wide = root.w > root.h * 1.15 && root.w >= 640
  const low  = wide && root.h < 440            // a phone held sideways
  const juice = useJuice({ hudSize: wide ? (low ? 34 : 40) : 30 })
  const { hit, miss } = juice                  // these never change

  const g = glyphs[idx]
  const strokes = GLYPHS[g]
  const color = INKS[idx % INKS.length]
  const praise = praiseOf(g)
  const body = bodyOf(g)
  const cur = strokes[strokeIdx]
  const curCum = useMemo(() => (cur ? lengths(cur) : [0]), [cur])
  const curLen = curCum[curCum.length - 1]
  const stars = useMemo(() => (cur ? starsAt(cur, guide.arrows).map((st, k) => ({ ...st, k, ...pointAt(cur, st.s) })) : []), [cur, guide.arrows])
  const canTrace = !done && !demo && !soon && !paused && !finale

  useEffect(() => { lockPreviews(); return () => leaveGame() }, [])

  // every timer of the game ends with it
  const later = useCallback((fn, ms) => {
    const t = setTimeout(() => { timers.current.delete(t); fn() }, ms)
    timers.current.add(t)
    return t
  }, [])
  useEffect(() => {
    const set = timers.current
    return () => { set.forEach(clearTimeout); set.clear() }
  }, [])

  // The task is the glyph with its green start dot and the snail; Lumi says
  // it once per level, when recorded
  const sayRound = useCallback(() => {
    sayTask()
    if (idx === 0) voice([KEY.task('spuren')])
  }, [idx])

  const startDemo = useCallback((stroke, after) => {
    tracerRef.current = null
    inkRef.current = []
    setInk([])
    setRideS(null)
    setSlipAt(null)
    demoT.current = 0
    demoEnd.current = after ?? null
    setDemo({ id: Date.now(), stroke, t: 0 })
  }, [])

  // Round start, and again after the help was closed. The very first letter
  // is shown once before the child tries.
  useEffect(() => {
    if (paused || done || demo || finale) return
    const t = setTimeout(() => {
      if (level === 1 && idx === 0 && !demoShown.current) {
        demoShown.current = true
        startDemo(0, sayRound)
      } else sayRound()
    }, 400)
    return () => clearTimeout(t)
  }, [idx, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // The demo finger: runs along the stroke, holds still while paused
  useEffect(() => {
    if (!demo || paused) return
    const len = lengths(strokes[demo.stroke]).at(-1)
    const dur = Math.max(1100, len * 13)
    let raf, prev = null, endTimer
    const tick = now => {
      if (prev != null) demoT.current = Math.min(1, demoT.current + (now - prev) / dur)
      prev = now
      setDemo(d => d && { ...d, t: demoT.current })
      if (demoT.current < 1) raf = requestAnimationFrame(tick)
      else endTimer = setTimeout(() => {
        setDemo(null)
        const after = demoEnd.current
        demoEnd.current = null
        after?.()
      }, 500)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(endTimer) }
  }, [demo?.id, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tracing ───────────────────────────────────────────────────────────────
  const toBox = ev => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }
  /** A place in the stroke box, on the screen (for the stars that fly to the counter). */
  const toScreen = p => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return undefined
    const q = new DOMPoint(p.x, p.y).matrixTransform(m)
    return { x: q.x, y: q.y }
  }

  const clearInk = () => {
    tracerRef.current = null
    const pts = inkRef.current
    inkRef.current = []
    setInk([])
    setFlow(0)
    return pts
  }

  const finishGlyph = () => {
    setDone(true)
    setWaves(w => w + 1)
    later(() => sfx.boing(), 350)              // it hops and shakes itself …
    later(() => sfx.pop(), 620)                // … and its picture pops out
    const first = !missedRef.current
    if (first) setFirstTry(n => n + 1)
    // a run of glyphs right at once: a bigger party
    const r = first ? run + 1 : 0
    setRun(r)
    setMood(r >= 3 ? 'dance' : 'wow')
    later(() => { if (areaRef.current) burst(areaRef.current, 'confetti', r >= 3 ? 26 : 12) }, 350)
    // "L wie Löwe." first, as the lion pops out; then the praise
    sayRight(null, { lead: [praise.line] })
    // when Lumi has said it, the glyph walks to its place on the shelf
    afterNarration(() => setLeave(true), { minMs: 2100 })
  }

  const acceptStroke = () => {
    const stroke = strokes[strokeIdx]
    clearInk()
    setRideS(null)
    setSlipAt(null)
    // the stars the snail collected fly to the counter; one more for a
    // stroke done in one go
    hit(toScreen(stroke[stroke.length - 1]), { stars: stars.length + (cleanRef.current ? 1 : 0) })
    cleanRef.current = true
    strokeMissRef.current = 0
    setHop(h => h + 1)
    const next = strokeIdx + 1
    setStrokeIdx(next)
    if (next >= strokes.length) { finishGlyph(); return }
    setMood('idle')
  }

  const slip = kind => {
    const t = tracerRef.current
    const real = t?.real
    const s = t ? t.progress * curLen : 0
    const pts = clearInk()
    if (pts.length > 1) setFading(f => [...f, { id: ++ids, pts }])
    // started away from the green dot: the hand shows where to start
    if (kind === 'wrongStart') setStartHint(true)
    if (!real) { setRideS(null); return }
    missedRef.current = true
    cleanRef.current = false
    // the snail waits where the finger left, then slides back to the dot
    const id = ++ids
    setSlipAt({ s, id })
    setRideS(null)
    later(() => setSlipAt(a => (a?.id === id ? null : a)), 800)
    miss(toScreen(pointAt(cur, s, curCum)))
    if (++strokeMissRef.current >= 2) {
      // twice on the same stroke: show it again instead of letting it fail on
      strokeMissRef.current = 0
      setSoon(true)
      later(() => { setSoon(false); startDemo(strokeIdx) }, 500)
      return
    }
    sayWrong()
  }

  const onPointerDown = e => {
    if (!canTrace || pointerRef.current != null) return
    const p = toBox(e)
    if (!p) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    pointerRef.current = e.pointerId
    setStartHint(false)
    setSlipAt(null)
    let t = makeTracer(cur)
    let pts = [p]
    // The snail waits just past the green dot. A finger put on the snail
    // itself starts the stroke as well: as if it had come from the dot.
    if (t.down(p) !== 'ok' && snail && Math.hypot(p.x - snail.x, p.y - snail.y) <= SNAIL * 0.55) {
      const fromDot = makeTracer(cur)
      fromDot.down(cur[0])
      if (fromDot.move(p) === 'ok') { t = fromDot; pts = [cur[0], p] }
    }
    tracerRef.current = t
    inkRef.current = pts
    rideRef.current = { got: 0, at: e.timeStamp, speed: 0, since: 0 }
    setInk(pts)
    setRideS(t.started ? t.progress * curLen : null)
  }

  const onPointerMove = e => {
    if (e.pointerId !== pointerRef.current || !tracerRef.current) return
    const evs = e.nativeEvent.getCoalescedEvents?.()
    const ride = rideRef.current
    const still = reduceMotion()
    const born = []
    for (const ev of evs?.length ? evs : [e.nativeEvent]) {
      const p = toBox(ev)
      if (!p) continue
      const last = inkRef.current[inkRef.current.length - 1]
      inkRef.current.push(p)
      const t = tracerRef.current
      const r = t.move(p)
      if (r === 'done') { acceptStroke(); return }
      if (r !== 'ok') { slip(r); return }
      if (!t.started) continue
      // the pace of the ride: fast and without stops glitters most
      const dist = Math.hypot(p.x - last.x, p.y - last.y)
      const dt = Math.max(1, ev.timeStamp - ride.at)
      ride.at = ev.timeStamp
      ride.speed = ride.speed * 0.8 + (dist / dt) * 0.2
      const f = clamp((ride.speed - 0.03) / 0.17, 0, 1)
      ride.since += dist
      if (!still && ride.since >= 16 - 11 * f) {
        ride.since = 0
        const a = Math.random() * Math.PI * 2
        born.push({ id: ++ids, x: p.x, y: p.y, dx: Math.cos(a) * (8 + 8 * f), dy: Math.sin(a) * (8 + 8 * f), size: 0.6 + 1.1 * f, fill: f > 0.55 ? GLITTER[ids % GLITTER.length] : GLITTER[0] })
      }
      // the snail reaches a star: a little note, one step up for each
      const at = Math.min(curLen, t.progress * curLen + LEAD)
      const got = stars.filter(st => at >= st.s - 0.5).length
      for (let k = ride.got; k < got; k++) sfx.note(7 + k, 0.08)
      ride.got = Math.max(ride.got, got)
    }
    if (born.length) setSparks(l => [...l.slice(-26), ...born])
    setInk([...inkRef.current])
    setFlow(clamp((ride.speed - 0.03) / 0.17, 0, 1))
    if (tracerRef.current.started) setRideS(tracerRef.current.progress * curLen)
  }

  const onPointerUp = e => {
    if (e.pointerId !== pointerRef.current) return
    pointerRef.current = null
    const t = tracerRef.current
    if (!t) return
    const r = e.type === 'pointercancel' ? 'tap' : t.up()
    if (r === 'done') acceptStroke()
    else if (r === 'tap') {
      clearInk()
      setRideS(null)
      if (!t.started && e.type !== 'pointercancel') setStartHint(true)
    } else slip(r)
  }

  // ─── From the board to the shelf, and on ──────────────────────────────────
  const shelve = i => setShelf(l => (l.some(x => x.i === i) ? l : [...l, { i, g: glyphs[i], color: INKS[i % INKS.length] }]))

  const next = () => {
    if (finale) return
    if (idx + 1 >= glyphs.length) {
      setMood('dance')
      setFinale(true)
      return
    }
    lockPreviews()
    missedRef.current = false
    cleanRef.current = true
    strokeMissRef.current = 0
    clearInk()
    setFading([])
    setDone(false)
    setStrokeIdx(0)
    setStartHint(false)
    setWalk(false)
    setRideS(null)
    setSlipAt(null)
    setMood('idle')
    setIdx(i => i + 1)
  }

  // the glyph has reached the shelf (once): it stays there, the next one comes
  const arrive = () => {
    if (arrived.current === idx) return
    arrived.current = idx
    shelve(idx)
    next()
  }

  // Off to the shelf once the praise is over — never while the help is open
  useEffect(() => {
    if (!leave || paused) return
    setLeave(false)
    if (reduceMotion()) arrive()
    else setWalk(true)
  }, [leave, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Where the walk goes: from the glyph on the board to its place on the shelf
  useLayoutEffect(() => {
    if (!walk) { setFlight(null); return }
    const m = svgRef.current?.getScreenCTM()
    const A = areaRef.current?.getBoundingClientRect()
    const slot = shelfRef.current?.querySelector(`[data-slot="${idx}"]`)
    const G = slot?.querySelector('[data-part="glyph"]')?.getBoundingClientRect()
    if (!m || !A || !G) { arrive(); return }
    const o = new DOMPoint(MINI.x, MINI.y).matrixTransform(m)
    const w = MINI.w * m.a, h = MINI.h * m.d
    const glyph = {
      left: o.x - A.left, top: o.y - A.top, w, h, k: G.width / w,
      dx: G.left + G.width / 2 - (o.x + w / 2), dy: G.top + G.height / 2 - (o.y + h / 2),
    }
    const P = picRef.current?.getBoundingClientRect()
    const T = slot.querySelector('[data-part="pic"]')?.getBoundingClientRect()
    const pic = P?.width && T ? { k: T.width / P.width, dx: T.left + T.width / 2 - (P.left + P.width / 2), dy: T.top + T.height / 2 - (P.top + P.height / 2) } : null
    setFlight({ glyph, pic })
    sfx.whoosh()
  }, [walk]) // eslint-disable-line react-hooks/exhaustive-deps

  const showMe = () => {
    if (!canTrace) return
    startDemo(strokeIdx)
  }

  // ─── Layout ────────────────────────────────────────────────────────────────
  // a little room for the board's drop shadow
  const scale = Math.max(0, Math.min((area.w - 4) / VIEW.w, (area.h - 8) / VIEW.h))
  const W = VIEW.w * scale, H = VIEW.h * scale
  const arrows = cur && !done ? arrowsAt(cur, guide.arrows).map(s => pointAt(cur, s, curCum)) : []
  const demoPart = demo && partOf(strokes[demo.stroke], demo.t)
  const lumiSize = wide ? (low ? 72 : 96) : 56
  // the columns beside the board, and the places on the shelf
  const sideW  = low ? clamp(root.w * 0.22, 150, 220) : clamp(root.w * 0.27, 230, 340)
  const rightW = clamp(root.w * 0.28, 210, 260)
  const shelfW = wide ? (low ? rightW : sideW) - 20 : root.w - 24 - 74
  const slot = Math.max(24, Math.min(wide ? (low ? 48 : 52) : 72, Math.floor((shelfW - 28) / glyphs.length) - 3))

  // The snail: on the road ahead of the finger; before the stroke begins it
  // waits just past the green dot and looks the way the stroke goes. Where
  // the arrows are gone (level 10) it sits on top of the dot and gives
  // nothing away.
  const fingerS = demo ? demo.t * curLen : slipAt ? slipAt.s : rideS
  const riding = fingerS != null
  const snailS = riding ? Math.min(curLen, fingerS + LEAD) : null
  const snail = !cur || done ? null
    : !riding && guide.arrows === 'none' ? { x: cur[0].x, y: cur[0].y - 11, angle: 0, small: true }
    : pointAt(cur, snailS ?? Math.min(LEAD, curLen * 0.5), curCum)

  const shown = isDigit(g)
    ? <><strong style={{ fontSize: '1.3em', color }}>{g}</strong> · {praise.show}</>
    : <><strong style={{ fontSize: '1.3em', color }}>{g}</strong> {praise.show}</>

  const bubble = (
    <div style={{
      flex: wide ? 'none' : 1, ...pxBubble,
      borderRadius: wide ? '4px 12px 12px 12px' : '12px 12px 12px 4px',
      padding: wide ? (low ? '8px 12px' : '14px 16px') : '8px 12px',
      fontFamily: 'var(--font-heading)', fontSize: wide ? (low ? 18 : 'clamp(20px,2.2vw,26px)') : 'clamp(16px,4.4vw,22px)',
      color: INK, display: 'flex', alignItems: 'center', justifyContent: wide ? 'center' : 'flex-start', gap: 10,
      minHeight: wide ? 0 : 56, minWidth: wide ? 84 : 0, boxSizing: 'border-box', maxWidth: wide ? '100%' : 440, textAlign: wide ? 'center' : 'left',
    }}>
      {done || finale
        ? <span>{shown}</span>
        : <strong aria-label={`${g} nachfahren`} style={{ color, fontSize: '1.9em', lineHeight: 1 }}>{g}</strong>}
    </div>
  )

  const shelfRow = <Shelf ref={shelfRef} total={glyphs.length} items={shelf} slot={slot} waves={waves} away={finale} />

  // Lumi shows the stroke once more
  const showButton = (
    <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
      onClick={showMe} disabled={!canTrace} aria-label="Zeig es mir"
      style={{
        ...pxButton('parch'), width: 64, height: 64, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        opacity: canTrace ? 1 : 0.4, visibility: done || finale ? 'hidden' : 'visible',
      }}>
      {HAND ? <img src={HAND} alt="" draggable={false} style={{ width: 40, height: 40 }} /> : '👆'}
    </motion.button>
  )

  // the picture that pops out of the letter lands in the board's corner
  const picSize = Math.max(56, Math.min(W, H) * 0.3)
  const picLeft = (area.w - W) / 2 + W - picSize - W * 0.03
  const picTop  = (area.h - H) / 2 + H - picSize - H * 0.03
  const picFrom = {
    x: (area.w - W) / 2 + (body.centre.x - VIEW.x) * scale - (picLeft + picSize / 2),
    y: (area.h - H) / 2 + (body.centre.y - VIEW.y) * scale - (picTop + picSize / 2),
  }
  const still = reduceMotion()

  const board = (
    <div ref={areaRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      style={{
        flex: 1, minHeight: 0, minWidth: 0, width: '100%', position: 'relative',
        // side by side, the board is only as wide as its height allows, and
        // the columns stand close to it
        maxWidth: wide ? Math.ceil((root.h * VIEW.w) / VIEW.h) : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        cursor: canTrace ? 'crosshair' : 'default',
      }}>
      {scale > 0 && (
        <svg ref={svgRef}
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          width={W} height={H}
          role="img" aria-label={finale ? 'Alle geschafft' : `${isDigit(g) ? 'Ziffer' : 'Buchstabe'} ${g} zum Nachfahren`}
          style={{ display: 'block', overflow: 'visible', touchAction: 'none', ...pxPanel, boxSizing: 'border-box' }}
        >
          {!finale && (
            <>
              {/* The road: every stroke of the glyph, the current one lit up.
                  It fades when the glyph is done: the glyph stands on its own. */}
              <motion.g initial={false} animate={{ opacity: done ? 0 : guide.road }} transition={{ duration: 0.3 }}
                fill="none" strokeLinecap="round" strokeLinejoin="round">
                {strokes.map((s, i) => <path key={'b' + i} d={pathOf(s)} stroke="rgba(42,27,61,0.32)" strokeWidth={ROAD + 4} />)}
                {strokes.map((s, i) => (
                  <path key={'r' + i} d={pathOf(s)} strokeWidth={ROAD}
                    stroke={i === strokeIdx && !done && guide.road === 1 ? '#FFF0B8' : '#FFFDF7'} />
                ))}
              </motion.g>

              {/* Marching dots along the current stroke show which way it goes */}
              {cur && !done && guide.arrows === 'all' && (
                <motion.path key={`m${idx}-${strokeIdx}`} d={pathOf(cur)} fill="none"
                  stroke="rgba(42,27,61,0.35)" strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0.1 7"
                  animate={still ? {} : { strokeDashoffset: [0, -7.1] }}
                  transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
              )}

              {/* Finished strokes, snapped onto the path. The finished glyph
                  comes alive: eyes, legs, it hops and shakes itself. */}
              {!walk && (
                <motion.g key={`g${idx}`}
                  animate={done && !still ? { y: [0, -16, 0, -8, 0, 0], rotate: [0, 0, -7, 7, -5, 0], scaleY: [1, 1.06, 0.94, 1.02, 1, 1] } : { y: 0 }}
                  transition={{ duration: 1.1, delay: 0.3 }}
                  style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
                  <GlyphBody g={g} color={color} count={strokeIdx} alive={done} />
                </motion.g>
              )}

              {/* Direction arrows on the current stroke */}
              {arrows.map((a, i) => (
                <g key={`a${idx}-${strokeIdx}-${i}`} transform={`translate(${a.x} ${a.y}) rotate(${(a.angle * 180) / Math.PI})`}>
                  <path d="M-4.5 -5.5 L2.5 0 L-4.5 5.5" fill="none" stroke={INK} strokeWidth={3}
                    strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
                </g>
              ))}

              {/* The stars on the stroke, until the snail gets there */}
              <AnimatePresence>
                {!done && stars.filter(st => (!st.late || (fingerS ?? 0) > curLen * 0.5) && (snailS == null || snailS < st.s - 0.5)).map(st => (
                  <motion.g key={`st${idx}-${strokeIdx}-${st.k}`} pointerEvents="none"
                    initial={{ scale: 0, opacity: 1 }} animate={{ scale: 1, opacity: 1 }}
                    exit={still ? { opacity: 0 } : { scale: 1.9, opacity: 0, y: -8 }}
                    transition={{ duration: 0.28 }}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
                    <image className="sp-twinkle" href={STAR} x={st.x - 6.5} y={st.y - 6.5} width={13} height={13}
                      style={{ transformBox: 'fill-box', transformOrigin: 'center', animation: `sp-twinkle 1.4s ease-in-out ${-st.k * 0.3}s infinite` }} />
                  </motion.g>
                ))}
              </AnimatePresence>

              {/* Slipped attempts fade away — no red, no cross */}
              {fading.map(f => (
                <motion.path key={f.id} d={pathOf(f.pts)} fill="none" stroke={color}
                  strokeWidth={INK_W} strokeLinecap="round" strokeLinejoin="round"
                  initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }}
                  onAnimationComplete={() => setFading(list => list.filter(x => x.id !== f.id))} />
              ))}

              {/* The snail's trail: the finger's ink, shining the more the
                  faster and smoother the ride is */}
              {ink.length > 1 && (
                <>
                  <path d={pathOf(ink)} fill="none" stroke="#ffd34d" strokeOpacity={0.4 + 0.45 * flow} strokeWidth={INK_W + 6 + 10 * flow}
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d={pathOf(ink)} fill="none" stroke={color} strokeWidth={INK_W}
                    strokeLinecap="round" strokeLinejoin="round" />
                  <path d={pathOf(ink)} fill="none" stroke="#fff" strokeOpacity={0.3 + 0.6 * flow} strokeWidth={2.4}
                    strokeLinecap="round" strokeLinejoin="round" />
                </>
              )}
              {sparks.map(sp => (
                <motion.path key={sp.id} d={SPARK} fill={sp.fill} stroke={INK} strokeWidth={0.7} pointerEvents="none"
                  initial={{ x: sp.x, y: sp.y, scale: 0.4, opacity: 1, rotate: 0 }}
                  animate={{ x: sp.x + sp.dx, y: sp.y + sp.dy, scale: [0.4, 1.3 * sp.size, 0], opacity: [1, 1, 0], rotate: 120 }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  onAnimationComplete={() => setSparks(l => l.filter(x => x.id !== sp.id))} />
              ))}
              {ink.length === 1 && <circle cx={ink[0].x} cy={ink[0].y} r={INK_W / 2} fill={color} />}

              {/* Start dot of the current stroke, with its number */}
              {cur && !done && (
                <g key={`s${idx}-${strokeIdx}`} pointerEvents="none">
                  {!demo && !still && (
                    <motion.circle cx={cur[0].x} cy={cur[0].y} fill="none" stroke="var(--px-green)" strokeWidth={3}
                      initial={{ r: 9, opacity: 0.9 }} animate={{ r: [9, 17], opacity: [0.9, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }} />
                  )}
                  <motion.circle ref={dotRef} cx={cur[0].x} cy={cur[0].y} r={9} fill="var(--px-green)" stroke={INK} strokeWidth={2.2}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                    style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
                  <text x={cur[0].x} y={cur[0].y + 0.4} textAnchor="middle" dominantBaseline="central"
                    fontFamily="var(--font-heading)" fontWeight={800} fontSize={11} fill={INK}>{strokeIdx + 1}</text>
                </g>
              )}

              {/* Lumi's demo: the ink of the hand that pushes the snail */}
              {demoPart && (
                <path d={demoPart.d} fill="none" stroke={color} strokeWidth={INK_W} opacity={0.75}
                  strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />
              )}

              {snail && (
                <Snail key={`sn${idx}`} at={snail} riding={riding && !slipAt} upright={!!snail.small}
                  pose={slipAt ? 'oops' : 'ride'} poseKey={slipAt ? `o${slipAt.id}` : `h${hop}`} still={still} />
              )}

              {demoPart && (
                <g pointerEvents="none">
                  <circle cx={demoPart.tip.x} cy={demoPart.tip.y} r={6.5} fill="#fff" stroke={INK} strokeWidth={2} />
                  {HAND && <image href={HAND} x={demoPart.tip.x - 10} y={demoPart.tip.y + 1} width={20} height={20} />}
                </g>
              )}
            </>
          )}
        </svg>
      )}

      {/* The picture pops out of the finished glyph ("L wie Löwe."), and
          later goes to the shelf with it */}
      {scale > 0 && done && !finale && (
        <motion.div ref={picRef} key={'thing' + idx} aria-hidden="true"
          initial={still ? false : { x: picFrom.x, y: picFrom.y, scale: 0, rotate: -25 }}
          animate={walk && flight?.pic
            ? { x: flight.pic.dx, y: [0, Math.min(0, flight.pic.dy) - 30, flight.pic.dy], scale: flight.pic.k, rotate: 0 }
            : { x: 0, y: still ? 0 : [picFrom.y, picFrom.y - 50, 0], scale: still ? 1 : [0, 1.15, 1], rotate: 0 }}
          transition={walk && flight?.pic ? { duration: 0.85, ease: 'easeInOut' } : { duration: 0.6, delay: 0.5, ease: 'easeOut' }}
          style={{
            position: 'absolute', left: picLeft, top: picTop, width: picSize, height: picSize, zIndex: 4,
            pointerEvents: 'none', filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.25))',
          }}>
          <Pic g={g} color={color} size={picSize} />
        </motion.div>
      )}

      {/* The glyph walks to its place on the shelf */}
      {walk && flight && !finale && (
        <motion.div aria-hidden="true"
          initial={{ x: 0, y: 0, scale: 1 }}
          animate={{ x: flight.glyph.dx, y: [0, Math.min(0, flight.glyph.dy) - 24, flight.glyph.dy], scale: flight.glyph.k }}
          transition={{ duration: 0.85, ease: 'easeInOut' }}
          onAnimationComplete={arrive}
          style={{ position: 'absolute', left: flight.glyph.left, top: flight.glyph.top, width: flight.glyph.w, height: flight.glyph.h, zIndex: 4, pointerEvents: 'none' }}>
          <MiniGlyph g={g} color={color} walking />
        </motion.div>
      )}

      {/* Sparkles when the glyph is done */}
      <AnimatePresence>
        {done && !finale && !still && (
          <div key={'burst' + idx} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}>
            {Array.from({ length: 8 }, (_, i) => {
              const a = (i / 8) * Math.PI * 2 + 0.3
              const r = Math.min(area.w, area.h) * (0.32 + (i % 3) * 0.06)
              return (
                <motion.span key={i}
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
                  animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, scale: [0.3, 1.3, 0.9], opacity: [1, 1, 0] }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: (i % 4) * 0.04 }}
                  style={{ position: 'absolute', left: -18, top: -18, width: 36, height: 36, fontSize: 32, lineHeight: '36px', textAlign: 'center' }}
                >✨</motion.span>
              )
            })}
          </div>
        )}
      </AnimatePresence>

      {/* The end of the level: everyone marches across the board */}
      {finale && scale > 0 && (
        <div style={{ position: 'absolute', left: (area.w - W) / 2 + 3, top: (area.h - H) / 2 + 3, width: W - 6, height: H - 6, borderRadius: 11 }}>
          <Parade items={shelf} w={W - 6} h={H - 6} onDone={() => onComplete(result(firstTry, glyphs.length))} />
        </div>
      )}
    </div>
  )

  const lumi = <Critter art="lumi" mood={mood} size={lumiSize} talks />

  return (
    // positioned, so it paints above the scene behind it (GameScreen does not
    // wrap NO_SCALE games in a positioned box)
    <div ref={rootRef} style={{
      position: 'relative', flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden',
      display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', justifyContent: 'center',
      padding: wide ? (low ? '10px 12px 14px' : 'clamp(12px,2vw,24px)') : '10px 12px 12px', gap: wide ? (low ? 16 : 'clamp(14px,2.5vw,32px)') : 10,
    }}>
      <style>{SPUREN_CSS}</style>
      {wide && !low && (
        <div style={{ ...SIDE, width: sideW, gap: 14 }}>
          {juice.hud}
          {lumi}
          {bubble}
          {showButton}
          {shelfRow}
        </div>
      )}
      {low && (
        <div style={{ ...SIDE, width: sideW, gap: 10 }}>
          {lumi}
          {bubble}
        </div>
      )}
      {!wide && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%' }}>
          {lumi}
          {bubble}
          <div style={{ alignSelf: 'center', flexShrink: 0, marginLeft: 'auto' }}>{juice.hud}</div>
        </div>
      )}

      {board}

      {low && (
        <div style={{ ...SIDE, width: rightW, gap: 10 }}>
          {juice.hud}
          {shelfRow}
          {showButton}
        </div>
      )}
      {!wide && (
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 10 }}>
          {shelfRow}
          {showButton}
        </div>
      )}

      {/* The hand taps the green dot: start here. At once after a start in
          the wrong place, otherwise when the child waits. */}
      <HintHand key={`${idx}-${strokeIdx}-${startHint}`} to={dotRef} active={canTrace && ink.length === 0}
        delay={startHint ? 0 : idx === 0 && strokeIdx === 0 ? 2000 : 6000} />
      {bursts}
      {juice.layer}
    </div>
  )
}

/**
 * The snail on the road. `at` is where it is and which way the road runs
 * there ({ x, y, angle }, in the stroke box). It crawls along the road, head
 * first; on a road that runs to the left it is turned round rather than
 * upside down. While it is being pushed it follows the finger at once;
 * otherwise it slides to its new place.
 */
function Snail({ at, riding, upright, pose, poseKey, still }) {
  const flipped = useRef(null)
  const deg = upright ? 0 : (at.angle * 180) / Math.PI
  // turned round only once the road clearly runs to the left: at a road that
  // runs straight down it would flicker between the two otherwise
  if (flipped.current == null) flipped.current = Math.abs(deg) > 90
  else if (flipped.current && Math.abs(deg) < 78) flipped.current = false
  else if (!flipped.current && Math.abs(deg) > 102) flipped.current = true
  const flip = flipped.current
  const rot = flip ? (deg > 0 ? deg - 180 : deg + 180) : deg
  const s = upright ? SNAIL * 0.8 : SNAIL
  return (
    <g pointerEvents="none" style={{
      transform: `translate(${at.x}px, ${at.y}px) rotate(${rot}deg) scaleX(${flip ? -1 : 1})`,
      transition: still ? 'none' : riding ? 'transform 70ms linear' : 'transform 420ms cubic-bezier(.34,1.3,.64,1)',
    }}>
      <motion.g key={poseKey}
        animate={still ? {} : pose === 'oops'
          ? { rotate: [0, -20, 16, -12, 8, 0], y: 0, scale: 1 }
          : { y: [0, -9, 0, -3, 0], scale: [1, 1.18, 1, 1.05, 1], rotate: 0 }}
        transition={{ duration: pose === 'oops' ? 0.7 : 0.5 }}
        style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <image href={SNAIL_ART} x={-s / 2} y={-s / 2} width={s} height={s} />
      </motion.g>
    </g>
  )
}

/**
 * The shelf: one place for every glyph of the level. A glyph that is done
 * stands there with its picture; the ones already there wave when the next
 * is done; at the end of the level they all hop down for the parade.
 * The places are marked from the start, so the shelf shows how far the
 * level has come (it is the game's progress bar).
 */
function Shelf({ ref, total, items, slot, waves, away }) {
  const still = reduceMotion()
  const pic = Math.round(slot * 0.78)
  const gh = Math.round(slot * (MINI.h / MINI.w))
  return (
    <div ref={ref} role="img" aria-label={`${items.length} von ${total} geschafft`} style={{
      position: 'relative', flex: 'none', boxSizing: 'border-box', width: total * slot + (total - 1) * 3 + 28, maxWidth: '100%',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 3, paddingBottom: 20,
    }}>
      {/* the plank on its two posts */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 8, height: 13, borderRadius: 4, background: '#b9753f', border: `2px solid ${INK}`, boxSizing: 'border-box', boxShadow: 'inset 0 -3px 0 rgba(42,27,61,0.18)' }} />
      {[14, null].map((left, i) => (
        <div key={i} aria-hidden="true" style={{ position: 'absolute', left: left ?? 'auto', right: left == null ? 14 : 'auto', bottom: 0, width: 12, height: 10, background: '#9a5f31', border: `2px solid ${INK}`, borderTop: 'none', borderRadius: '0 0 4px 4px', boxSizing: 'border-box' }} />
      ))}
      {Array.from({ length: total }, (_, k) => {
        const x = items.find(it => it.i === k)
        return (
          <div key={k} data-slot={k} style={{ width: slot, display: 'flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0 }}>
            <motion.div
              animate={away ? (still ? { opacity: 0 } : { y: [0, -22, 10], opacity: [1, 1, 0] }) : { y: 0, opacity: 1 }}
              transition={away ? { duration: 0.45, delay: k * 0.07 } : { duration: 0.2 }}
              style={{ width: slot, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* a wave each time the next glyph is done */}
              <motion.div key={waves} animate={still || !x || waves < 2 ? {} : { rotate: [0, -14, 12, -8, 0] }} transition={{ duration: 0.7, delay: k * 0.06 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transformOrigin: '50% 100%' }}>
                <div data-part="pic" style={{ width: pic, height: pic }}>
                  {x && <Pic g={x.g} color={x.color} size={pic} />}
                </div>
                <div data-part="glyph" style={{ position: 'relative', width: slot, height: gh }}>
                  {x
                    ? <MiniGlyph g={x.g} color={x.color} width={slot} />
                    // a free place
                    : <div aria-hidden="true" style={{ position: 'absolute', inset: '10% 16% 8%', borderRadius: 8, border: '2px dashed rgba(42,27,61,0.3)', background: 'rgba(255,253,247,0.4)', boxSizing: 'border-box' }} />}
                </div>
              </motion.div>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}
