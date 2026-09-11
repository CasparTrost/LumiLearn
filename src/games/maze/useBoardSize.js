import { useLayoutEffect, useRef, useState } from 'react'

// maxCell deckelt die Kachelgröße. Der Deckel lag bei 52, womit das Labyrinth
// auf einem Monitor klein blieb, obwohl darunter Platz war — die Kachelgröße
// ist ohnehin durch die Containergröße begrenzt, der Deckel verhindert nur,
// dass ein 5x5-Labyrinth bildschirmfüllend wird.
export function useBoardSize(cols, rows, maxCell = 76) {
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
