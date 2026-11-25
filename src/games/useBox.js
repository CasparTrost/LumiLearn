import { useLayoutEffect, useRef, useState } from 'react'

/**
 * The room a game really has: width and height of its own root element, in
 * the game's own pixels.
 *
 * A game inside the FitBox (components/FitBox.jsx) is drawn scaled, down to
 * 60 % on a phone held sideways, so `vw` and `dvh` say nothing about the
 * room it has: a picture sized `100dvh - 250px` came out 85 px high there.
 * The box is measured instead, and the game lays itself out from it: it
 * always fits, and it knows when it is wide and flat (a phone held sideways)
 * or narrow and upright.
 *
 *   const [rootRef, box] = useBox()
 *   <div ref={rootRef} style={{ flex: 1, minHeight: 0 }}>…</div>
 */
export function useBox(initial = { w: 720, h: 680 }) {
  const ref = useRef(null)
  const [box, setBox] = useState(initial)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setBox(b => (b.w === w && b.h === h ? b : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box]
}

/** Narrow and upright: a phone held upright. */
export const isUpright = box => box.w < 560 && box.h > box.w
/** Wide and flat: a phone held sideways. Everything stands side by side there. */
export const isFlat = box => !isUpright(box) && box.h < 640 && box.w > box.h * 1.6
