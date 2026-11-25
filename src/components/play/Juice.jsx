import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, animate, useAnimationControls, useMotionValue, useReducedMotion, useTransform } from 'framer-motion'
import { sfx } from '../../sfx.js'
import { usePaused } from '../../lib/pause.js'
import { Art } from './Critter.jsx'

/**
 * Juice — what makes one good action feel good, the same in every game:
 * a note that climbs with the streak, a star that flies to a counter, a
 * flame for three, five and eight in a row, a soft bonk for a miss, a
 * shake for a heavy landing.
 *
 *   const juice = useJuice()
 *   const tap = (card, e) => {
 *     if (card.right) juice.hit(e.currentTarget)    // note, a star flies to the counter, streak + 1
 *     else            juice.miss(e.currentTarget)   // soft bonk, the card wiggles, streak over
 *   }
 *   const onCrateLanded = () => juice.shake()       // shakes the element with ref={juice.stage}
 *   return (
 *     <div ref={juice.stage} style={{ position: 'relative', flex: 1 }}>
 *       <div style={{ position: 'absolute', top: 8, right: 8 }}>{juice.hud}</div>
 *       {cards.map(c => <button key={c.id} onClick={e => tap(c, e)}>…</button>)}
 *       {juice.layer}
 *     </div>
 *   )
 *
 * useJuice({ hudSize = 40 })   size of the star in the counter, in px
 *
 *   hit(at?, { stars = 1, silent = false })   → { streak, milestone }
 *       A good action at `at`: an element, a ref to one, or { x, y } on
 *       screen (clientX / clientY). The streak grows, a note sounds (one
 *       step higher per hit in a row, the same top note from the eighth
 *       on; `silent` skips it), and `stars` stars fly in an arc to the
 *       counter, which counts each one as it lands. `milestone` is true at
 *       a streak of 3, 5 and 8, when the flame banner shows — the moment
 *       for the game's own extra (a dance, a cheer).
 *   miss(at?)
 *       The streak is over: a soft bonk, and `at`, if it is an element,
 *       wiggles. Nothing else: no red, no buzzer, no banner, nothing is
 *       taken away.
 *   shake(strength = 1)
 *       A short shake of the element that carries `ref={juice.stage}`, for
 *       something heavy landing. 0.5 is a nudge, 2 an earthquake.
 *   streak, stars
 *       Hits in a row, and stars collected since the game was opened.
 *   hud
 *       The star counter, to be placed by the game (usually top right,
 *       where nothing playable is). Without it no star flies.
 *   layer
 *       The flying stars and the banner: a portal over everything that
 *       takes no taps. Render it once, anywhere.
 *
 * Good to know
 *   • hit, miss and shake never change. In a useCallback take them out
 *     first — `const { hit, miss, shake } = juice` — and list those; the
 *     `juice` object itself is new on every render.
 *   • The banner carries no number: in a game about numbers a second
 *     number beside the task's would be wrong. One flame at 3, two at 5,
 *     three at 8.
 *   • The streak ends only with miss(). It runs on from task to task and
 *     round to round; what counts as a miss is the game's decision.
 *   • The wiggle and the shake move the CSS property `translate`, so they
 *     add to any transform the element has (framer-motion's x / scale, a
 *     scaled stage) — but a bare inline <span> cannot be moved: give it
 *     `display: inline-block`.
 *   • The kit plays the note and the bonk. The game's own sound for the
 *     thing itself (a pop, a splash) goes well with the note; a second
 *     "right!" jingle (sfx.correct, sfx.combo, sfx.coin) does not.
 *   • The stars are a reward, not a score: what a level reports with
 *     onComplete stays the game's business.
 *   • With prefers-reduced-motion nothing flies or shakes: the counter
 *     counts at once, the notes play, the banner only fades in and out.
 *   • While the help dialog is open (lib/pause.js) nothing is drawn over
 *     it; stars in the air are counted at once.
 *   • Everything that moves is an animation that ends with its element:
 *     there are no timers to leak. Never more than MAX_FLYING stars are in
 *     the air; any more are counted without a flight.
 *   • For tests: the counter is `[data-juice="hud"]` (aria-label "7 Sterne"),
 *     the layer `[data-juice="layer"]`.
 */

/** Streaks that show the flame banner. */
export const STREAK_MILESTONES = [3, 5, 8]
export const isStreakMilestone = streak => STREAK_MILESTONES.includes(streak)

/** The scale has this many steps for a streak; from then on the top note stays. */
export const NOTE_STEPS = 8
/** The step of sfx.pluck for the hit that made the streak `streak` long (1 = the first). */
export const noteStepFor = streak => Math.max(0, Math.min(NOTE_STEPS - 1, Math.floor(streak) - 1))

/** How many flames the banner shows for a milestone streak: 1, 2, 3. */
export const flamesFor = streak => Math.max(1, STREAK_MILESTONES.filter(m => m <= streak).length)

export const MAX_FLYING = 6

const INK = '#2a1b3d'
const PARCH = '#fffdf7'
const GOLD = '#ffc93c'
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
let seq = 0

/**
 * The bow a star flies: the control point of a quadratic curve from `from`
 * to `to`, pushed off the straight line to the side that is further up,
 * by more the longer the way is.
 */
export function arcControl(from, to, bend = 1) {
  const dx = to.x - from.x, dy = to.y - from.y
  const d = Math.hypot(dx, dy) || 1
  let nx = -dy / d, ny = dx / d
  if (ny > 0) { nx = -nx; ny = -ny }
  const push = clamp(d * 0.32, 40, 190) * bend
  return { x: (from.x + to.x) / 2 + nx * push, y: (from.y + to.y) / 2 + ny * push }
}

/** Where on that bow the star is at `t` (0 = start, 1 = there). */
export function arcPoint(from, ctrl, to, t) {
  const u = 1 - t
  return {
    x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x,
    y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y,
  }
}

// The middle of an element (or of what a ref holds), or a point as given
function pointOf(at) {
  const it = at && typeof at === 'object' && 'current' in at ? at.current : at
  if (!it) return null
  if (typeof it.getBoundingClientRect === 'function') {
    const r = it.getBoundingClientRect()
    return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null
  }
  return Number.isFinite(it.x) && Number.isFinite(it.y) ? { x: it.x, y: it.y } : null
}
const elementOf = at => {
  const it = at && typeof at === 'object' && 'current' in at ? at.current : at
  return it && typeof it.animate === 'function' && typeof it.getBoundingClientRect === 'function' ? it : null
}

// Somewhere to start from when the game names no place
const middleOf = stage => pointOf(stage) ?? { x: innerWidth / 2, y: innerHeight * 0.4 }

// The banner pops up just above the finger; near the top, below it. Never
// under the top bar: it floats up 40 px as it goes, so its middle stays
// 90 px below where the game begins (.pl-game, screens/GameScreen.jsx).
function bannerSpot(p) {
  const x = clamp(p.x, 104, Math.max(104, innerWidth - 104))
  const top = (typeof document !== 'undefined' && document.querySelector('.pl-game')?.getBoundingClientRect().top) || 0
  const ceil = top + 90
  const y = p.y - 104 < ceil ? p.y + 104 : p.y - 104
  return { x, y: clamp(y, ceil, Math.max(ceil, innerHeight - 60)) }
}

export function useJuice({ hudSize = 40 } = {}) {
  const paused = usePaused()
  const reduce = useReducedMotion()
  const reduceRef = useRef(reduce)
  reduceRef.current = reduce

  const live = useRef({ streak: 0, stars: 0, flying: 0 })   // the truth, also between two renders
  const [streak, setStreak] = useState(0)
  const [stars, setStars] = useState(0)
  const [shown, setShown] = useState(0)        // what the counter says: the stars that have landed
  const [flyers, setFlyers] = useState([])
  const [banner, setBanner] = useState(null)

  const stage = useRef(null)
  const hudStar = useRef(null)
  const layerEl = useRef(null)
  const running = useRef(new Set())            // shakes and wiggles under way

  // A shake or wiggle moves `translate`, which adds to whatever transform
  // the element already has (framer-motion's x/y/scale, a scaled stage).
  const move = useCallback((el, frames, ms) => {
    if (!el?.animate || reduceRef.current) return
    try {
      const a = el.animate({ translate: frames }, { duration: ms, easing: 'ease-out' })
      running.current.add(a)
      a.onfinish = a.oncancel = () => running.current.delete(a)
    } catch { /* an old browser without `translate`: no shake */ }
  }, [])
  useEffect(() => {
    const set = running.current
    return () => { set.forEach(a => a.cancel()); set.clear() }
  }, [])

  const hit = useCallback((at, { stars: n = 1, silent = false } = {}) => {
    const L = live.current
    const count = Math.max(0, Math.round(n))
    L.streak += 1
    L.stars += count
    setStreak(L.streak)
    setStars(L.stars)
    if (!silent) sfx.pluck(noteStepFor(L.streak))

    const from = pointOf(at) ?? middleOf(stage)
    const to = pointOf(hudStar)
    const fly = !reduceRef.current && to && layerEl.current ? Math.min(count, MAX_FLYING - L.flying) : 0
    if (count > fly) setShown(s => s + count - fly)   // nowhere to fly, or the air is full: counted at once
    if (fly > 0) {
      L.flying += fly
      setFlyers(l => [...l, ...Array.from({ length: fly }, (_, i) => (
        { id: ++seq, from, to, delay: i * 0.09, bend: 1 + (i % 3) * 0.35 }
      ))])
    }
    const milestone = isStreakMilestone(L.streak)
    if (milestone) setBanner({ id: ++seq, flames: flamesFor(L.streak), ...bannerSpot(from) })
    return { streak: L.streak, milestone }
  }, [])

  const miss = useCallback((at) => {
    live.current.streak = 0
    setStreak(0)
    sfx.bonk()
    move(elementOf(at), ['0 0', '-8px 0', '7px 0', '-5px 0', '3px 0', '0 0'], 340)
  }, [move])

  const shake = useCallback((strength = 1) => {
    const a = 7 * clamp(Number(strength) || 0, 0.2, 3)
    const f = (x, y) => `${(a * x).toFixed(1)}px ${(a * y).toFixed(1)}px`
    // mostly down and up, like a thud, dying away
    move(stage.current, ['0 0', f(0.2, 1), f(-0.5, -0.7), f(0.4, 0.45), f(-0.2, -0.25), '0 0'], 320)
  }, [move])

  const land = useCallback((id) => {
    live.current.flying = Math.max(0, live.current.flying - 1)
    setFlyers(l => l.filter(f => f.id !== id))
    setShown(s => s + 1)
  }, [])

  // The help dialog opened: whatever is in the air has landed, nothing
  // of ours is drawn on top of it
  useEffect(() => {
    if (!paused) return
    live.current.flying = 0
    setFlyers([])
    setBanner(null)
    setShown(live.current.stars)
  }, [paused])

  const hud = <Hud count={shown} size={hudSize} starRef={hudStar} reduce={reduce} />
  const layer = typeof document === 'undefined' ? null : createPortal(
    <div ref={layerEl} data-juice="layer" aria-hidden="true" style={{ position: 'fixed', inset: 0, zIndex: 9996, pointerEvents: 'none', overflow: 'hidden' }}>
      {banner && <Banner key={banner.id} {...banner} reduce={reduce} onDone={id => setBanner(b => (b?.id === id ? null : b))} />}
      {flyers.map(f => <FlyingStar key={f.id} {...f} size={hudSize * 1.1} onLand={land} />)}
    </div>, document.body)

  return { hit, miss, shake, streak, stars, hud, layer, stage }
}

// The star counter: a star and how many, in a pill like the hearts'
function Hud({ count, size, starRef, reduce }) {
  const star = useAnimationControls()
  const pill = useAnimationControls()
  const was = useRef(count)
  useEffect(() => {
    if (was.current === count) return
    was.current = count
    pill.start({ backgroundColor: [GOLD, PARCH], transition: { duration: 0.5 } })
    if (!reduce) star.start({ scale: [1, 1.5, 0.92, 1], rotate: [0, -16, 6, 0], transition: { duration: 0.4 } })
  }, [count, reduce, star, pill])
  return (
    <motion.div animate={pill} data-juice="hud" role="img" aria-label={`${count} ${count === 1 ? 'Stern' : 'Sterne'}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: size * 0.1, flexShrink: 0, boxSizing: 'border-box',
        padding: `4px ${size * 0.34}px 4px ${size * 0.16}px`, borderRadius: 999,
        backgroundColor: PARCH, border: `3px solid ${INK}`, boxShadow: '0 3px 0 rgba(42,27,61,0.3)',
        userSelect: 'none', WebkitUserSelect: 'none',
      }}>
      <motion.span ref={starRef} animate={star} style={{ display: 'inline-flex' }}>
        <Art art="⭐" size={size} />
      </motion.span>
      <motion.span key={count} initial={reduce || count === 0 ? false : { y: -size * 0.3, scale: 1.4 }} animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 500, damping: 16 }}
        style={{
          display: 'inline-block', minWidth: `${Math.max(1, String(count).length)}ch`, textAlign: 'center',
          fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.8, lineHeight: 1, color: INK,
          fontVariantNumeric: 'tabular-nums',
        }}>{count}</motion.span>
    </motion.div>
  )
}

// One star on its way to the counter: it pops out, hangs for a moment and
// is then pulled in, faster and faster
function FlyingStar({ id, from, to, delay, bend, size, onLand }) {
  const t = useMotionValue(0)
  const opacity = useMotionValue(0)
  // the bow stays on the screen (the curve never leaves the triangle of its three points)
  const bow = arcControl(from, to, bend)
  const ctrl = { x: clamp(bow.x, size, Math.max(size, innerWidth - size)), y: clamp(bow.y, size, Math.max(size, innerHeight - size)) }
  const x = useTransform(t, v => arcPoint(from, ctrl, to, v).x - size / 2)
  const y = useTransform(t, v => arcPoint(from, ctrl, to, v).y - size / 2)
  const scale = useTransform(t, [0, 0.12, 1], [0.4, 1.3, 0.8])
  const rotate = useTransform(t, [0, 1], [-30, 330])
  const done = useRef(onLand)
  done.current = onLand
  useEffect(() => {
    t.set(0)
    const duration = clamp(0.5 + Math.hypot(to.x - from.x, to.y - from.y) / 1800, 0.55, 0.9)
    const show = animate(opacity, 1, { duration: 0.01, delay })
    const fly = animate(t, 1, { duration, delay, ease: [0.3, 0, 0.85, 0.5], onComplete: () => done.current(id) })
    return () => { show.stop(); fly.stop() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div style={{ position: 'absolute', left: 0, top: 0, x, y, scale, rotate, opacity, willChange: 'transform' }}>
      <Art art="⭐" size={size} />
    </motion.div>
  )
}

// 🔥, 🔥🔥, 🔥🔥🔥: read without reading, and no number. Up in a pop, gone
// within a second.
function Banner({ id, flames, x, y, reduce, onDone }) {
  // a little smaller on a phone, where it would hide half the stage
  const s = clamp(Math.min(innerWidth, innerHeight) / 420, 0.7, 1)
  const flame = 68 * s
  const D = 0.9
  const show = reduce
    ? { opacity: [0, 1, 1, 0], transition: { duration: D, times: [0, 0.1, 0.75, 1] } }
    : { opacity: [0, 1, 1, 1, 0], scale: [0.2, 1.3, 1, 1, 0.9], y: [16, 0, 0, 0, -40], rotate: [-14, -5, -5, -5, -5], transition: { duration: D, times: [0, 0.18, 0.32, 0.72, 1] } }
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <motion.div initial={{ opacity: 0 }} animate={show} onAnimationComplete={() => onDone(id)}
        style={{
          flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 0,
          padding: `${4 * s}px ${14 * s}px`, borderRadius: 999,
          background: GOLD, border: `4px solid ${INK}`,
          boxShadow: `inset 0 ${-6 * s}px 0 rgba(42,27,61,0.12), 0 ${6 * s}px 0 rgba(42,27,61,0.35)`,
        }}>
        {Array.from({ length: flames }, (_, i) => {
          // the middle flame of three is the tallest
          const f = flame * (flames === 3 && i === 1 ? 1.12 : flames > 1 ? 0.88 : 1)
          return (
            <div key={i} style={{ width: f * 0.82, height: f, marginTop: -f * 0.22, display: 'flex', justifyContent: 'center' }}>
              <motion.div
                animate={reduce ? {} : { scale: [1, 1.12, 0.96, 1.08, 1], transition: { duration: D * 0.7, delay: D * 0.2 + i * 0.06 } }}
                style={{ display: 'flex', transformOrigin: '50% 90%' }}>
                <Art art="🔥" size={f} />
              </motion.div>
            </div>
          )
        })}
      </motion.div>
    </div>
  )
}
