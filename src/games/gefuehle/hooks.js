import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { afterNarration } from '../../narrator.js'
import { usePaused } from '../../lib/pause.js'

/**
 * Timers that hold still while the help or the quit question is open, and
 * end with the game. `later(ms, fn)` runs fn after ms (and after any pause),
 * `afterSpeech(fn, minMs)` once Lumi is done talking.
 */
export function useLater() {
  const paused = usePaused()
  const st = useRef({ paused, timers: new Set(), waits: new Set() })
  st.current.paused = paused
  useEffect(() => {
    const s = st.current
    return () => {
      s.timers.forEach(clearTimeout); s.timers.clear()
      s.waits.forEach(stop => stop()); s.waits.clear()
    }
  }, [])
  const later = useCallback(function run(ms, fn) {
    const t = setTimeout(() => {
      st.current.timers.delete(t)
      if (st.current.paused) run(250, fn)
      else fn()
    }, ms)
    st.current.timers.add(t)
  }, [])
  const afterSpeech = useCallback((fn, minMs = 0) => {
    const stop = afterNarration(() => { st.current.waits.delete(stop); later(0, fn) }, { minMs })
    st.current.waits.add(stop)
  }, [later])
  return { later, afterSpeech }
}

/** The room an element has, in its own (unscaled) pixels. */
export function useSize(ref) {
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setSize(s => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/**
 * The middle of `el` in the coordinates of `root`. The game screen scales
 * its games to fit (FitBox), so what the browser measures on screen has to
 * be divided by that scale again.
 */
export function pointIn(root, el) {
  const r = root.getBoundingClientRect(), b = el.getBoundingClientRect()
  const k = r.width / (root.offsetWidth || r.width) || 1
  return { x: (b.left + b.width / 2 - r.left) / k, y: (b.top + b.height / 2 - r.top) / k, w: b.width / k }
}
