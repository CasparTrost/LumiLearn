import { useLayoutEffect, useRef, useState } from 'react'

export function useBoardSize(cols, rows, maxCell = 52) {
  const containerRef = useRef(null)
  const [cellSize, setCellSize] = useState(24)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const calc = () => {
      const { width, height } = el.getBoundingClientRect()
      const raw = Math.min(width / cols, height / rows, maxCell)
      // Snap to multiples of 4 for crisp pixel art rendering
      setCellSize(Math.max(14, Math.floor(raw / 4) * 4))
    }

    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cols, rows, maxCell])

  return { containerRef, cellSize }
}
