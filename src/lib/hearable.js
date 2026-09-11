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
 */

import { narrate } from '../narrator.js'

/**
 * Props für eine Antwort-Schaltfläche, die sich vorlesen lässt.
 * `text` ist das Gesprochene, `src` optional eine Aufnahme.
 */
export function hearable(text, { src, rate, pitch, enabled = true } = {}) {
  if (!enabled || (!text && !src)) return {}
  // priority 'preview': unterbricht nie die laufende Frage. Dadurch wirkt das
  // Vorlesen erst, wenn die Fragestellung durch ist — genau so, wie ein Kind
  // es erwartet, und ohne dass jedes Spiel das selbst verwalten müsste.
  const say = () => narrate([{ text, src, rate, pitch }], { skipIfSame: true, priority: 'preview' })
  return {
    // Auf Touch-Geräten löst pointerenter beim Tippen mit aus — dort ist der
    // Lautsprecher an der Frage der Weg, nicht dieser.
    onPointerEnter: e => { if (e.pointerType !== 'touch') say() },
    onFocus: say,
  }
}
