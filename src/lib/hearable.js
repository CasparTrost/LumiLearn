/**
 * Antwortmöglichkeiten hörbar machen, ohne sie zu wählen.
 *
 * Ein Kind, das noch nicht liest, sieht bei "Was reimt sich auf Fliege?" drei
 * Wörter, die es nicht entziffern kann — die Frage ist dann nicht lösbar,
 * sondern nur zu erraten. Antippen scheidet als Weg zum Hören aus, weil das
 * bereits die Antwort ist.
 *
 * Zwei Wege, die sich ergänzen:
 *   • Maus/Tastatur: darüberfahren oder hintabben liest die Option vor.
 *   • Finger: der Lautsprecher an der Frage liest alle Optionen der Reihe nach.
 *
 * Zwei Regeln, damit daraus kein Stottern wird:
 *   • Vorrang "preview" — unterbricht nie eine laufende Ansage und ist
 *     gesperrt, solange die Frage einer neuen Aufgabe noch aussteht.
 *   • Eine kurze Ruhezeit, bevor gesprochen wird. Wandert der Zeiger nur über
 *     die Antworten hinweg, fing vorher jede berührte Option an zu sprechen und
 *     wurde von der nächsten sofort abgewürgt — ein Stakkato aus Wortanfängen.
 */

import { narrate } from '../narrator.js'

const REST_MS = 260

export function hearable(text, { src, rate, pitch, enabled = true } = {}) {
  if (!enabled || (!text && !src)) return {}

  let timer = null
  const start = () => {
    clearTimeout(timer)
    timer = setTimeout(
      () => narrate([{ text, src, rate, pitch }], { skipIfSame: true, priority: 'preview' }),
      REST_MS,
    )
  }
  const stop = () => clearTimeout(timer)

  return {
    // Auf Touch-Geräten löst pointerenter beim Tippen mit aus — dort ist der
    // Lautsprecher an der Frage der Weg, nicht dieser.
    onPointerEnter: e => { if (e.pointerType !== 'touch') start() },
    onPointerLeave: stop,
    onPointerDown: stop,      // beim Antippen zählt die Antwort, nicht die Vorschau
    onFocus: start,
    onBlur: stop,
  }
}
