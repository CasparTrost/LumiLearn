import { useLayoutEffect, useRef, useState } from 'react'

// Unter diese gedachte Breite geht der Innenraum nie — sie ist der Maßstab,
// für den die Spiele gebaut sind (etwa ein hochkant gehaltenes Tablet).
const MIN_W     = 720
const MIN_H     = 680
const MAX_SCALE = 1.5
// Passt der Inhalt selbst ungestreckt nicht in die Höhe, wird lieber etwas
// verkleinert als abgeschnitten — der Spielbereich hat overflow:hidden, ein zu
// tiefer "Fertig!"-Knopf wäre sonst schlicht weg statt erreichbar.
const MIN_SCALE = 0.6

/**
 * Nutzt die vorhandene Fläche aus, ohne die Anordnung zu verändern.
 *
 * Die Spiele sind in Vielfachen der Fensterbreite bemessen (clamp(…vw…)) und
 * nach oben gedeckelt. Auf einem Monitor greifen die Deckel, das Spiel bleibt
 * klein, und darunter bleibt die halbe Seite leer.
 *
 * Der Kasten innen bekommt Breite/Maßstab × Höhe/Maßstab und wird dann um den
 * Maßstab vergrößert — nach dem Skalieren füllt er die Fläche exakt aus. Damit
 * bleibt die Anordnung Pixel für Pixel dieselbe wie ohne Maßstab, nur größer:
 * flex:1 verteilt weiter über die volle Höhe, nichts rutscht in die Mitte.
 *
 * Zwei Fehler aus dem ersten Anlauf, beide im Betrieb aufgefallen:
 *
 *   • Der Maßstab hing an der jeweils aktuellen Inhaltshöhe. Sobald sich die
 *     änderte — ein "Weiter!"-Knopf erscheint —, sprang der Maßstab und damit
 *     die ganze Anordnung. Deshalb wächst die gemerkte Inhaltshöhe jetzt nur
 *     (`neededRef`): der Maßstab kann dadurch nur kleiner werden, nie größer,
 *     und ist nach spätestens einem Schritt endgültig. Kein Hin und Her.
 *
 *   • Eine feste gedachte Höhe schnitt Spiele ab, die mehr brauchen — der
 *     "Fertig!"-Knopf in "Zahlen entdecken" lag halb außerhalb. Deshalb wird
 *     die tatsächlich benötigte Höhe gemessen und der Maßstab danach begrenzt.
 *
 * Verkleinert wird nie (Maßstab mindestens 1): das würde die Darstellung auf
 * kleinen Fenstern gegenüber früher verändern, und darum ging es nicht.
 */
export default function FitBox({ children }) {
  const outer     = useRef(null)
  const inner     = useRef(null)
  const neededRef = useRef(MIN_H)          // wächst nur
  const appliedRef = useRef(false)
  const [box, setBox] = useState(null)     // { scale, w, h }

  useLayoutEffect(() => {
    const measure = () => {
      const o = outer.current, i = inner.current
      if (!o || !i) return
      const availW = o.clientWidth, availH = o.clientHeight
      if (!availW || !availH) return

      // Wie hoch der Inhalt wirklich ist — auch der Teil, der gerade
      // abgeschnitten wäre. Das Spiel selbst ist das einzige Kind.
      //
      // Erst messen, wenn der Kasten schon seine gedachte Höhe hat: solange er
      // die volle Fläche füllt, füllt ihn auch jedes Spiel mit flex:1 restlos
      // aus, und die Messung würde immer "genau passend" sagen.
      if (appliedRef.current) {
        const child = i.firstElementChild
        const content = Math.max(child?.scrollHeight ?? 0, i.scrollHeight)
        if (content > neededRef.current) neededRef.current = content
      }

      // Die Breite begrenzt nur das Vergrößern (sonst würde der gedachte Raum
      // beim Hochskalieren schmaler als das, wofür die Spiele gebaut sind).
      // Auf einem schmalen Handy darf sie nicht zum Verkleinern zwingen —
      // dort ist die Höhe das einzige, was zählt.
      const byWidth  = Math.max(1, availW / MIN_W)
      const byHeight = availH / neededRef.current
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, byWidth, byHeight))
      const next = { scale, w: Math.round(availW / scale), h: Math.round(availH / scale) }
      appliedRef.current = true
      setBox(prev => (prev && prev.w === next.w && prev.h === next.h ? prev : next))
    }

    measure()
    const ro = new ResizeObserver(measure)
    if (outer.current) ro.observe(outer.current)
    if (inner.current?.firstElementChild) ro.observe(inner.current.firstElementChild)
    return () => ro.disconnect()
  })

  return (
    <div ref={outer} style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', position: 'relative' }}>
      <div ref={inner} style={{
        position: 'absolute', top: '50%', left: '50%',
        width: box?.w ?? '100%', height: box?.h ?? MIN_H,
        transform: `translate(-50%, -50%) scale(${box?.scale ?? 1})`,
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </div>
    </div>
  )
}
