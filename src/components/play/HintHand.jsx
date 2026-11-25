import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Art } from './Critter.jsx'
import { usePaused } from '../../lib/pause.js'

/**
 * A hand that shows what to do — no words needed. Most children here can't
 * read, and Lumi only speaks the sentences that are recorded: so when a
 * child waits a few seconds without doing anything, the hand comes and
 * shows the move. It drags from one thing to another, or taps one.
 *
 *   const apple = useRef(), bear = useRef()
 *   <HintHand from={apple} to={bear} />          // drag the apple to the bear
 *   <HintHand to={bushRef} />                    // tap the bush
 *   <HintHand from={apple} to={bear} delay={0} /> // show it right away
 *
 * It appears after `delay` ms of no tapping or dragging anywhere and shows
 * the move a few times, rests a moment and shows it again, as long as the
 * child waits; any touch hides it, and after the next quiet spell it comes
 * again. `active`
 * false (the task is solved, an animation runs) keeps it away. While the
 * game is paused (help open) it stays away too.
 *
 * The hand is where its target is, in every frame. It used to look for the
 * target twice a second: on something that moves or changes (an animal that
 * leaves its window, a floating bubble) it pointed at the old place for up
 * to half a second. Now it reads the target's place while it is on screen
 * (and only then: no hand, no work) and moves itself without a render. When
 * the target is gone or hidden the hand is gone in the same frame; when
 * `to` is another element now, it starts over there.
 */
const REST_MS = 4000

// One showing of the move: [share of the time, value] steps, eased between.
// `go` is the way from `from` to `to` (0 → 1).
const DRAG = {
  ms: 2000, pause: 500,
  go:      [[0, 0], [0.2, 0], [0.75, 1], [1, 1]],
  opacity: [[0, 0], [0.2, 1], [0.75, 1], [1, 0]],
  scale:   [[0, 1], [0.2, 0.85], [0.75, 0.85], [1, 1]],
}
const TAP = {
  ms: 1400, pause: 500,
  go:      [[0, 1], [1, 1]],
  opacity: [[0, 0], [0.2, 1], [0.45, 1], [0.7, 1], [1, 0]],
  scale:   [[0, 1], [0.2, 1], [0.45, 0.8], [0.7, 1], [1, 1]],
}
const ease = u => (u < 0.5 ? 2 * u * u : 1 - (2 - 2 * u) ** 2 / 2)
function at(steps, u) {
  for (let i = 1; i < steps.length; i++) {
    const [u0, v0] = steps[i - 1], [u1, v1] = steps[i]
    if (u <= u1) return v0 + (v1 - v0) * ease((u - u0) / (u1 - u0))
  }
  return steps[steps.length - 1][1]
}

export default function HintHand({ from, to, active = true, delay = 5000, repeat = 3 }) {
  const idle = useIdle(delay, active)
  const paused = usePaused()
  const shown = active && idle && !paused
  // Shows the move `repeat` times, rests a few seconds, shows it again —
  // for as long as the child waits (a lost child who just waits needs it most)
  const [round, setRound] = useState(0)
  const [resting, setResting] = useState(false)
  useEffect(() => {
    if (!shown) { setResting(false); return }
    const showMs = repeat * (from ? 2500 : 1900)
    let t = setTimeout(function cycle() {
      setResting(true)
      t = setTimeout(() => { setResting(false); setRound(r => r + 1); t = setTimeout(cycle, showMs) }, REST_MS)
    }, showMs)
    return () => clearTimeout(t)
  }, [shown, repeat, from])
  const show = shown && !resting

  const outer = useRef(null), inner = useRef(null)
  // read in every frame: many games pass a new `to` object with each render
  const ends = useRef({ from, to })
  ends.current = { from, to }
  const drag = !!from

  useEffect(() => {
    if (!show) return
    const move = drag ? DRAG : TAP
    const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0, began = 0, seen = null, last = ''
    const put = (el, key, v) => { if (el.style[key] !== v) el.style[key] = v }
    const frame = now => {
      raf = requestAnimationFrame(frame)
      const box = outer.current, hand = inner.current
      if (!box || !hand) return
      const target = elOf(ends.current.to)
      const t = middle(target)
      // nothing to point at (gone, hidden): no hand, until there is again
      if (!t) { seen = null; put(hand, 'opacity', '0'); return }
      // a new target: the showing starts over there
      if (target !== seen) { seen = target; began = now }
      const f = (ends.current.from && middle(elOf(ends.current.from))) || t
      const gone = now - began, len = move.ms + move.pause
      const n = Math.floor(gone / len)
      const u = n >= repeat ? 1 : Math.min(1, (gone - n * len) / move.ms)
      const k = still ? 1 : at(move.go, u)
      const pos = `translate(${Math.round(f.x + (t.x - f.x) * k)}px, ${Math.round(f.y + (t.y - f.y) * k)}px)`
      if (pos !== last) { last = pos; box.style.transform = pos }
      put(hand, 'opacity', String(Math.round(at(move.opacity, u) * 100) / 100))
      put(hand, 'transform', `scale(${still ? 1 : Math.round(at(move.scale, u) * 1000) / 1000})`)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [show, round, repeat, drag])

  if (!show || typeof document === 'undefined') return null
  return createPortal(
    <div ref={outer} aria-hidden="true" data-hint-hand={drag ? 'drag' : 'tap'}
      style={{ position: 'fixed', left: 0, top: 0, zIndex: 9997, pointerEvents: 'none', marginLeft: -14, marginTop: -6, filter: 'drop-shadow(0 4px 3px rgba(42,27,61,0.35))', willChange: 'transform' }}>
      <div ref={inner} style={{ opacity: 0 }}>
        <Art art="👆" size={60} />
      </div>
    </div>,
    document.body,
  )
}

const elOf = t => t?.current ?? t

// Middle of an element on screen, or null when there is nothing to point
// at: it is not in the page any more, has no size, or cannot be seen
// (display, visibility or opacity of it or of something around it)
function middle(el) {
  if (!el?.getBoundingClientRect || el.isConnected === false) return null
  if (el.checkVisibility && !el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return null
  const r = el.getBoundingClientRect()
  if (!r.width && !r.height) return null
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/** True after `ms` without a touch, a click or a key anywhere. */
export function useIdle(ms, active = true) {
  const [idle, setIdle] = useState(false)
  const t = useRef(null)
  useEffect(() => {
    if (!active) { setIdle(false); return }
    const arm = () => { clearTimeout(t.current); setIdle(false); t.current = setTimeout(() => setIdle(true), ms) }
    arm()
    const events = ['pointerdown', 'keydown']
    events.forEach(e => window.addEventListener(e, arm, true))
    return () => { clearTimeout(t.current); events.forEach(e => window.removeEventListener(e, arm, true)) }
  }, [ms, active])
  return idle
}
