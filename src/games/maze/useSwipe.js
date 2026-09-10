import { useRef } from 'react'

export function useSwipe(onDir, { threshold = 20, repeatMs = 160 } = {}) {
  const st = useRef({ x: 0, y: 0, dir: null, timer: null })

  const stop = () => {
    clearInterval(st.current.timer)
    st.current.timer = null
    st.current.dir = null
  }

  return {
    onPointerDown: e => {
      st.current.x = e.clientX
      st.current.y = e.clientY
      st.current.dir = null
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    },
    onPointerMove: e => {
      const s = st.current
      if (s.dir) return
      const dx = e.clientX - s.x
      const dy = e.clientY - s.y
      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return
      const isHoriz = Math.abs(dx) > Math.abs(dy)
      s.dir = isHoriz ? [Math.sign(dx), 0] : [0, Math.sign(dy)]
      onDir(s.dir[0], s.dir[1])
      s.timer = setInterval(() => onDir(s.dir[0], s.dir[1]), repeatMs)
    },
    onPointerUp:     stop,
    onPointerCancel: stop,
  }
}
