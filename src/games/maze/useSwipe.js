import { useRef } from 'react'

// One swipe = one step. Auto-repeat is intentionally omitted here —
// hold-repeat is provided by the D-Pad buttons instead.
//
// Touch and pen only, and only while the finger is down. pointermove also
// fires for a mouse that is merely hovering; without the `active` latch
// Lumi used to follow the mouse around the board while a click did
// nothing. With a mouse the arrow keys and the D-Pad are the way to move.
export function useSwipe(onDir, { threshold = 20 } = {}) {
  const st = useRef({ startX: 0, startY: 0, active: false, fired: false })

  const stop = () => {
    st.current.active = false
    st.current.fired  = false
  }

  return {
    onPointerDown: e => {
      if (e.pointerType === 'mouse') return
      st.current.startX = e.clientX
      st.current.startY = e.clientY
      st.current.active = true
      st.current.fired  = false
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    },
    onPointerMove: e => {
      const s = st.current
      if (!s.active || s.fired) return      // no finger down, or already fired for this gesture
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
