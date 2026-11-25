import { LINES, line } from '../../lib/lumiLines.js'
import { isDigit } from '../traceStrokes.js'
import { letterKey } from '../buchstaben/voice.js'

/**
 * Buchstaben-Spuren: what a finished glyph says and shows.
 *
 * Lumi says the recorded sentence that names the letter (letterKey in
 * buchstaben/voice.js: `abc/<letter>`, "L wie Löwe."), with the letter's
 * name, not its sound ("Lö wie Löwe" was what the owner objected to). U is
 * the Ufo, "Uh wie Ufo!": the owl is "Eule" everywhere in the app. The picture that pops out of the letter is the
 * thing that sentence names, so the word and the picture here follow the
 * recordings (tests/unit/spuren.test.js checks the two against each other).
 *
 * X and Y have no child's word that starts with them; their recordings say
 * where they are heard: "X klingt wie in Hexe und Taxi." (the taxi is shown)
 * and "Y klingt oft wie J, so wie in Yoga.".
 * The jacket is a picture of its own: the 🧥 emoji is drawn as a long coat.
 */
export const WORD = {
  A: ['Affe', '🐒'],    B: ['Bär', '🐻'],    C: ['Clown', '🤡'],  D: ['Dino', '🦖'],
  E: ['Ente', '🦆'],    F: ['Fisch', '🐟'],  G: ['Giraffe', '🦒'], H: ['Hund', '🐶'],
  I: ['Igel', '🦔'],    J: ['Jacke', ':px-jacke:'], K: ['Katze', '🐱'], L: ['Löwe', '🦁'],
  M: ['Maus', '🐭'],    N: ['Nase', '👃'],   O: ['Oma', '👵'],    P: ['Pinguin', '🐧'],
  Q: ['Qualle', '🪼'],  R: ['Rakete', '🚀'], S: ['Sonne', '☀️'],  T: ['Tiger', '🐯'],
  U: ['Ufo', '🛸'],     V: ['Vogel', '🐦'],  W: ['Wal', '🐋'],    X: ['Hexe und Taxi', '🚕'],
  Y: ['Yoga', '🧘'],    Z: ['Zebra', '🦓'],
}

// the letter is heard inside these words, or only sounds like another one
const INSIDE = new Set(['X', 'Y'])

const NUMBER = ['Null', 'Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun']

/** The key of the sentence Lumi says for a finished glyph. */
export const praiseKey = g => (isDigit(g) ? `ziffer/${g}` : letterKey(g))

/**
 * What is shown and said when a glyph is done.
 *   show  the words after the glyph in Lumi's bubble ("wie Löwe", "Drei")
 *   art   the letter's picture (digits show their amount as dots instead)
 *   line  the recording, or null while it is missing: then nothing is said
 */
export function praiseOf(g) {
  const key = praiseKey(g)
  const rec = key in LINES ? line(key) : null
  if (isDigit(g)) return { key, line: rec, show: NUMBER[+g], art: null }
  const [word, art] = WORD[g]
  return { key, line: rec, show: `wie${INSIDE.has(g) ? ' in' : ''} ${word}`, art }
}
