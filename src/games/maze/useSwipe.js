import { useEffect, useRef } from 'react'

// One swipe = one step. Keeping the finger down after the swipe keeps
// walking in that direction: onDir is called again every REPEAT_MS with
// repeat = true for as long as it returns true (MazeGame stops the run at a
// wall, at a fork and in front of the dragon). Without that, a long corridor
// took one swipe per cell.
//
// Touch and pen only, and only while the finger is down. pointermove also
// fires for a mouse that is merely hovering; without the `active` latch
// Lumi used to follow the mouse around the board while a click did
// nothing. With a mouse the arrow keys and the D-Pad are the way to move.
const REPEAT_MS = 180

export function useSwipe(onDir, { threshold = 20 } = {}) {
  const st = useRef({ startX: 0, startY: 0, active: false, fired: false, timer: null })
  const cb = useRef(onDir)
  cb.current = onDir

  const stop = () => {
    st.current.active = false
    st.current.fired  = false
    clearInterval(st.current.timer)
    st.current.timer = null
  }
  useEffect(() => () => clearInterval(st.current.timer), [])

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
      s.fired = true                        // latch — only one swipe per gesture
      const isHoriz = Math.abs(dx) > Math.abs(dy)
      const dir = [isHoriz ? Math.sign(dx) : 0, isHoriz ? 0 : Math.sign(dy)]
      cb.current(dir[0], dir[1], false)
      clearInterval(s.timer)
      s.timer = setInterval(() => {
        if (!st.current.active || !cb.current(dir[0], dir[1], true)) stop()
      }, REPEAT_MS)
    },
    onPointerUp:     stop,
    onPointerLeave:  stop,   // safety: pointer left element without releasing
    onPointerCancel: stop,
  }
}
