import { useRef } from 'react'

// One swipe = one step. Auto-repeat is intentionally omitted here —
// hold-repeat is provided by the D-Pad buttons instead.
export function useSwipe(onDir, { threshold = 20 } = {}) {
  const st = useRef({ startX: 0, startY: 0, fired: false })

  const stop = () => { st.current.fired = false }

  return {
    onPointerDown: e => {
      st.current.startX = e.clientX
      st.current.startY = e.clientY
      st.current.fired  = false
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    },
    onPointerMove: e => {
      const s = st.current
      if (s.fired) return                   // already fired once for this gesture
      const dx = e.clientX - s.startX
      const dy = e.clientY - s.startY
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return
      s.fired = true                        // latch — only one move per swipe
      const isHoriz = Math.abs(dx) > Math.abs(dy)
      onDir(isHoriz ? Math.sign(dx) : 0, isHoriz ? 0 : Math.sign(dy))
    },
    onPointerUp:     stop,
    onPointerLeave:  stop,   // safety: pointer left element without releasing
    onPointerCancel: stop,
  }
}
