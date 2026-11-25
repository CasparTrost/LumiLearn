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
 *   laute/<b>        the sound of a letter, "Mmm", "Ah" (only through soundKey)
 *   abc/…, hoeren/…, anlaut/…, reim/…   the few sentences of each game
 */
export const rec = key => (LINES[key] ? line(key) : null)

export const slug = w => w.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

/** The recording of a word, or null */
export const wordRec = w => rec(`woerter/${slug(w)}`)
// ─── How a letter is spoken: the one rule for every game ─────────────────────
// Only sounds one can hold, and the vowels, are said as sounds: "Mmm", "Sss",
// "Fff", "Ah". The other consonants were recorded with a schwa ("Bö", "Lö",
// "Lö wie Löwe!"), which the owner rejected: "Lö" is not what one hears in
// "Löwe". For them Lumi names the letter with its key word instead, abc/<c>
// ("L wie Löwe."). No game builds a laute/… or laut/… key itself
// (tests/unit/letterVoice.test.js checks that): it asks these helpers.
export const HELD = 'aeiouäöüfmsvx'
export const isHeld = L => HELD.includes(String(L).toLowerCase())

// The sentence that names a letter. abc/u says "U wie Uhu", but the owl is
// the "Eule" everywhere in the app: U is named with its sound and the Ufo.
const NAMED = { u: 'laut/u-wie-ufo' }
/** The key of the sentence that names a letter: "L wie Löwe.", "Uh wie Ufo!" */
export const letterKey = L => NAMED[slug(L)] ?? `abc/${slug(L)}`
/** The key of a letter's sound: the held sound ("Mmm"), else its name sentence */
export const soundKey = L => (isHeld(L) ? `laute/${slug(L)}` : letterKey(L))
/** The thing a letter's name sentence names ("Löwe" for L), or null */
export const keyWordOf = L => / wie ([^ .,!]+)[.!]$/.exec(LINES[letterKey(L)] ?? '')?.[1] ?? null
/**
 * The key of a letter's sound together with a thing that starts with it:
 * "Mmm wie Maus!" for a held sound (just "Mmm" where that pair is not
 * recorded); for the other letters the name sentence when it names that
 * very thing ("L wie Löwe."), else only the thing's word.
 */
export const soundLikeKey = (L, word) => {
  if (isHeld(L)) {
    const k = `laut/${slug(L)}-wie-${slug(word)}`
    return k in LINES ? k : soundKey(L)
  }
  return keyWordOf(L) === word ? letterKey(L) : `woerter/${slug(word)}`
}

/** The recording that names a letter ("L wie Löwe."), or null */
export const letterRec = L => rec(letterKey(L))
/** The recording of a letter's sound, or null */
export const soundRec = L => rec(soundKey(L))
/** The recording of a letter's sound with a thing ("Mmm wie Maus!"), or null */
export const soundLikeRec = (L, word) => rec(soundLikeKey(L, word))

/** Hover or keyboard focus reads the word aloud — once it is recorded. */
export const hearWord = (w, enabled = true) => {
  const r = wordRec(w)
  return r ? hearable(r.text, { src: r.src, enabled }) : {}
}
