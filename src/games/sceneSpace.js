import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Where the backdrop's corner picture begins (the moon of the night scene,
 * the window of the room), measured in the game's own units: a game that
 * fills the play area can keep its progress trail or its board left of it,
 * so they never sit on the moon or the window.
 *
 * The scene (components/play/Scene.jsx) is a 1000 × 600 picture that covers
 * the play area (xMidYMax slice). `vx` is the left edge of the corner
 * picture in its coordinates, `vy` its lower edge. On a portrait screen the
 * picture is cut off at the sides and the corner is off screen: then the
 * result is null and nothing needs to make room.
 *
 *   const [ref, clear] = useSceneClear(750, 240)   // the moon
 *   <div ref={ref}> … <Trail style={{ maxWidth: clear?.x }} /> … </div>
 *
 * `ref` goes on the game's root element, which fills the play area.
 */
export function useSceneClear(vx, vy) {
  const ref = useRef(null)
  const [clear, setClear] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const W = el.clientWidth, H = el.clientHeight
      if (!W || !H) return
      const s = Math.max(W / 1000, H / 600)
      const x = Math.round(vx * s + (W - 1000 * s) / 2)
      const y = Math.round(vy * s - (600 * s - H))
      const next = x < W - 40 && y > 0 ? { x, y } : null
      setClear(c => (c?.x === next?.x && c?.y === next?.y ? c : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [vx, vy])
  return [ref, clear]
}
