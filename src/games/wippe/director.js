import { useCallback, useEffect, useRef } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { usePaused } from '../../lib/pause.js'

/**
 * The game's scenes are short scripts — a thing falls, the plank slams, the
 * flyer goes up — written as async functions:
 *
 *   const { tween, wait, alive } = useDirector()
 *   await tween(y, 300, { duration: 0.4, ease: 'easeIn' })
 *   await wait(200)
 *
 * Everything holds still while the game is paused (help or quit dialog open)
 * and ends with the game: a script whose game is gone just never goes on.
 * With reduced motion a tween jumps to its end (after a short beat, so the
 * order of things can still be followed).
 */
export function useDirector() {
  const paused = usePaused()
  const reduce = useReducedMotion()
  const st = useRef({ paused, reduce, anims: new Set(), timers: new Set(), alive: true })
  st.current.reduce = reduce

  useEffect(() => {
    st.current.paused = paused
    st.current.anims.forEach(a => (paused ? a.pause() : a.play()))
  }, [paused])

  useEffect(() => {
    const s = st.current
    s.alive = true
    return () => {
      s.alive = false
      s.anims.forEach(a => a.stop())
      s.anims.clear()
      s.timers.forEach(clearTimeout)
      s.timers.clear()
    }
  }, [])

  const wait = useCallback(ms => new Promise(resolve => {
    const s = st.current
    const run = left => {
      const t = setTimeout(() => {
        s.timers.delete(t)
        if (!s.alive) return
        if (s.paused) run(200)
        else resolve()
      }, left)
      s.timers.add(t)
    }
    run(ms)
  }), [])

  const tween = useCallback((mv, to, opts = {}) => {
    const s = st.current
    if (!s.alive) return new Promise(() => {})
    if (s.reduce) {
      mv.set(Array.isArray(to) ? to[to.length - 1] : to)
      return wait(Math.min(120, ((opts.duration ?? 0.3) * 1000) / 3))
    }
    // a new tween of the same value takes over: the old one counts as done,
    // so a script waiting for it goes on instead of hanging
    s.on ??= new WeakMap()
    s.on.get(mv)?.()
    return new Promise(resolve => {
      let a = null
      const done = () => {
        if (s.on.get(mv) === done) s.on.delete(mv)
        if (a) s.anims.delete(a)
        if (s.alive) resolve()
      }
      s.on.set(mv, done)
      a = animate(mv, to, { ...opts, onComplete: done })
      s.anims.add(a)
      if (s.paused) a.pause()
    })
  }, [wait])

  const alive = useCallback(() => st.current.alive, [])
  return { tween, wait, alive, reduce }
}
