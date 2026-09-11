import { useLayoutEffect, useRef, useState } from 'react'

/**
 * Nutzt die vorhandene Höhe aus, ohne dass gescrollt werden muss.
 *
 * Die Spiele waren in Vielfachen der Fensterbreite bemessen (clamp(…vw…)) und
 * nach oben gedeckelt. Auf einem Monitor lief das so: die Deckel greifen, das
 * Spiel bleibt klein, und darunter bleibt die halbe Seite leer. Alle Deckel
 * einzeln hochzusetzen hätte dasselbe Problem nur verschoben — auf einem
 * flachen Fenster wäre der Inhalt dann unten abgeschnitten (der Spielbereich
 * hat overflow:hidden, es gäbe also nicht einmal eine Bildlaufleiste).
 *
 * Stattdessen wird der fertige Inhalt als Ganzes skaliert: gemessen wird, wie
 * hoch er natürlich ist, und dann so weit vergrößert, wie Höhe und Breite es
 * hergeben. Dadurch kann nichts überlaufen, und auf großen Bildschirmen wird
 * alles deutlich größer.
 *
 * Wichtig für die Messung: die Breite des inneren Kastens hängt NICHT vom
 * Maßstab ab (feste Entwurfsbreite bzw. die verfügbare Breite, je nachdem was
 * kleiner ist). Sonst würde jede Maßstabsänderung den Umbruch ändern, die
 * Höhe ändern und damit den nächsten Maßstab — eine Schleife, die nie zur Ruhe
 * kommt. So bleibt die natürliche Höhe stabil und ein Durchgang genügt.
 */
export default function FitBox({ children, designWidth = 760, maxScale = 1.9, minScale = 0.5 }) {
  const outer = useRef(null)
  const inner = useRef(null)
  const [scale, setScale] = useState(1)
  const [width, setWidth] = useState(null)

  useLayoutEffect(() => {
    const measure = () => {
      const o = outer.current, i = inner.current
      if (!o || !i) return
      const availW = o.clientWidth, availH = o.clientHeight
      if (!availW || !availH) return

      const w = Math.min(designWidth, availW)
      setWidth(prev => (prev === w ? prev : w))

      // offsetHeight ist die Layout-Höhe — von transform: scale unberührt,
      // also die natürliche Höhe, auch während bereits skaliert wird.
      const natH = i.offsetHeight
      if (!natH) return
      const next = Math.max(minScale, Math.min(maxScale, availH / natH, availW / w))
      setScale(prev => (Math.abs(prev - next) < 0.02 ? prev : next))
    }

    measure()
    const ro = new ResizeObserver(measure)
    if (outer.current) ro.observe(outer.current)
    if (inner.current) ro.observe(inner.current)
    return () => ro.disconnect()
  })

  return (
    <div ref={outer} style={{
      flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div ref={inner} style={{
        width: width ?? '100%',
        transform: `scale(${scale})`,
        transformOrigin: 'center center',
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  )
}
