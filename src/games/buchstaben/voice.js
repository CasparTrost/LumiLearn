import { LINES, line } from '../../lib/lumiLines.js'
import { hearable } from '../../lib/hearable.js'

/**
 * What these four games say — only once Lumi has recorded it.
 *
 * Only Lumi's recorded voice speaks (narrator.js). The words, letter sounds
 * and little task sentences of the Buchstaben-Welt are not recorded yet, so
 * the games show everything as pictures. Each sentence has a key here; as
 * soon as lib/lumiLines.js has that key (and audio/lumi/<key>.mp3 exists),
 * it plays, with no change in the games:
 *
 *   woerter/<wort>   the bare word, "Maus" (wort: lower case, ä → ae, ß → ss)
 *   laute/<b>        the sound of a letter, "Mmm", "Bö" (letterSounds.js)
 *   abc/…, hoeren/…, anlaut/…, reim/…   the few sentences of each game
 */
export const rec = key => (LINES[key] ? line(key) : null)

export const slug = w => w.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The recording of a word, or null */
export const wordRec = w => rec(`woerter/${slug(w)}`)
/** The recording of a letter's sound, or null */
export const soundRec = L => rec(`laute/${slug(L)}`)

/** Hover or keyboard focus reads the word aloud — once it is recorded. */
export const hearWord = (w, enabled = true) => {
  const r = wordRec(w)
  return r ? hearable(r.text, { src: r.src, enabled }) : {}
}
