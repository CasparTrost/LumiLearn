import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
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
 * the move a few times; any touch hides it, and after the next quiet spell
 * it comes again. `active`
 * false (the task is solved, an animation runs) keeps it away. While the
 * game is paused (help open) it stays away too.
 */
export default function HintHand({ from, to, active = true, delay = 5000, repeat = 3 }) {
  const idle = useIdle(delay, active)
  const paused = usePaused()
  const [box, setBox] = useState(null)
  const show = active && idle && !paused

  useEffect(() => {
    if (!show) { setBox(null); return }
    const measure = () => {
      const t = rectOf(to)
      if (!t) { setBox(null); return }
      const f = from ? rectOf(from) : null
      setBox({ f, t })
    }
    measure()
    const id = setInterval(measure, 500)
    return () => clearInterval(id)
  }, [show, from, to])

  if (!show || !box || typeof document === 'undefined') return null
  const tx = box.t.x, ty = box.t.y
  const fx = box.f?.x ?? tx, fy = box.f?.y ?? ty
  const drag = !!box.f
  return createPortal(
    <motion.div aria-hidden="true" key={`${fx}-${fy}-${tx}-${ty}`}
      initial={{ x: fx, y: fy, opacity: 0, scale: 1 }}
      animate={drag
        ? { x: [fx, fx, tx, tx], y: [fy, fy, ty, ty], opacity: [0, 1, 1, 0], scale: [1, 0.85, 0.85, 1] }
        : { x: tx, y: ty, opacity: [0, 1, 1, 1, 0], scale: [1, 1, 0.8, 1, 1] }}
      transition={{ duration: drag ? 2 : 1.4, times: drag ? [0, 0.2, 0.75, 1] : [0, 0.2, 0.45, 0.7, 1], repeat: repeat - 1, repeatDelay: 0.5, ease: 'easeInOut' }}
      style={{ position: 'fixed', left: 0, top: 0, zIndex: 9997, pointerEvents: 'none', marginLeft: -14, marginTop: -6, filter: 'drop-shadow(0 4px 3px rgba(42,27,61,0.35))' }}>
      <Art art="👆" size={60} />
    </motion.div>,
    document.body,
  )
}

// Middle of an element (a ref or an element) on screen
function rectOf(t) {
  const el = t?.current ?? t
  if (!el?.getBoundingClientRect) return null
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
