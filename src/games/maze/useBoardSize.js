import { useLayoutEffect, useRef, useState } from 'react'

// maxCell deckelt die Kachelgröße. Der Deckel lag bei 52, womit das Labyrinth
// auf einem Monitor klein blieb, obwohl darunter Platz war — die Kachelgröße
// ist ohnehin durch die Containergröße begrenzt, der Deckel verhindert nur,
// dass ein 5x5-Labyrinth bildschirmfüllend wird.
//
// minCell: Passt das ganze Labyrinth nur mit kleineren Kacheln hinein, zeigt
// das Brett einen Ausschnitt um Lumi (viewCols × viewRows) statt alles. Auf dem
// Handy wurden die 19×19-Labyrinthe sonst 16 px klein — Lumi, Tränke und
// Drache waren kaum zu erkennen.
//
// fitCell ist die Kachelgröße für das ganze Labyrinth, ohne Ausschnitt.
export function useBoardSize(cols, rows, maxCell = 76, minCell = 30) {
  const containerRef = useRef(null)
  const [size, setSize] = useState({ cellSize: 24, fitCell: 24, viewCols: cols, viewRows: rows })

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    // Snap to multiples of 4 for crisp pixel art rendering — only above
    // 24 px; below, snapping would throw away up to a sixth of the board
    const snap = raw => (raw > 24 ? Math.floor(raw / 4) * 4 : Math.floor(raw))

    const calc = () => {
      const { width, height } = el.getBoundingClientRect()
      const fit = Math.min(width / cols, height / rows, maxCell)
      let viewCols = cols, viewRows = rows, raw = fit
      if (fit < minCell) {
        viewCols = Math.max(7, Math.min(cols, Math.floor(width / minCell)))
        viewRows = Math.max(7, Math.min(rows, Math.floor(height / minCell)))
        raw = Math.min(width / viewCols, height / viewRows, maxCell)
      }
      const next = { cellSize: Math.max(14, snap(raw)), fitCell: Math.max(8, snap(fit)), viewCols, viewRows }
      setSize(s => (s.cellSize === next.cellSize && s.fitCell === next.fitCell
        && s.viewCols === next.viewCols && s.viewRows === next.viewRows ? s : next))
    }

    calc()
    const ro = new ResizeObserver(calc)
    ro.observe(el)
    return () => ro.disconnect()
  }, [cols, rows, maxCell, minCell])

  return { containerRef, ...size }
}
