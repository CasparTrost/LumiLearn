import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { afterNarration } from '../../narrator.js'
import { usePaused } from '../../lib/pause.js'

/**
 * Timers that hold still while the help or the quit question is open, and
 * end with the game. `later(ms, fn)` runs fn after ms (and after any pause);
 * `afterSpeech(fn, minMs)` once Lumi is done talking, but not before minMs.
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
  const afterSpeech = useCallback((fn, minMs = 0, maxMs = 6000) => {
    const stop = afterNarration(() => { st.current.waits.delete(stop); later(0, fn) }, { minMs, maxMs })
    st.current.waits.add(stop)
  }, [later])
  return { later, afterSpeech }
}

/**
 * The room the stage has, in its own pixels, and the scale it is shown at
 * (the game screen scales games to fit: what is 64 pixels here may be 40 on
 * the glass).
 */
export function useStage(ref) {
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      const scale = Math.round((el.getBoundingClientRect().width / w) * 100) / 100 || 1
      setSize(s => (s && s.w === w && s.h === h && s.scale === scale ? s : { w, h, scale }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [ref])
  return size
}
