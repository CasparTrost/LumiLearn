import { useCallback, useEffect, useRef } from 'react'
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
  const afterSpeech = useCallback((fn, minMs = 0) => {
    const stop = afterNarration(() => { st.current.waits.delete(stop); later(0, fn) }, { minMs })
    st.current.waits.add(stop)
  }, [later])
  return { later, afterSpeech }
}
