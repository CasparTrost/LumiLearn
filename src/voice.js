/**
 * LumiLearn Voice — aufgenommene Ansagen.
 * Nur noch eine dünne Hülle um den Erzähler: der besitzt die Warteschlange und
 * sorgt dafür, dass eine neue Ansage alles Laufende stoppt, statt daneben zu
 * spielen.
 */

import { narrate, stopNarration } from './narrator.js'

export const voice = {
  /** Eine Aufnahme abspielen; `fallbackText` springt ein, wenn sie fehlt. */
  play(src, fallbackText) {
    narrate([{ src, text: fallbackText }])
  },

  /** Mehrere Aufnahmen nacheinander — jede startet, wenn die vorige endet. */
  chain(srcs, fallbackTexts) {
    narrate(srcs.map((src, i) => ({ src, text: fallbackTexts?.[i] })))
  },

  /** Alles Gesprochene stoppen. */
  stop: stopNarration,
}
