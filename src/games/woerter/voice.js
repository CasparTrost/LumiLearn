import { LINES, line } from '../../lib/lumiLines.js'
import { narrate } from '../../narrator.js'

// Recorded sentences for the word games (Zauberkessel, Frosch-Hüpfen,
// Tierparty, Buchstaben-Spuren). Only Lumi's recorded voice speaks, so the
// games call these keys and say whatever is recorded already; a key that
// is not in lib/lumiLines.js yet is simply skipped: add the key with its
// text there and record it, and the game speaks it.

/** 'Möhre' -> 'moehre': the file name part of a key */
export const slug = s => s.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// The keys, one place for all games
export const KEY = {
  word:     w => `wort/${slug(w)}`,          // "Banane."
  syllable: s => `silbe/${slug(s)}`,         // "Na."
  sound:    c => `laut/${slug(c)}`,          // "Mmm." (the letter's sound)
  letter:   c => `buchstabe/${slug(c)}`,     // "Be." (the letter's name)
  anlaut:   (c, w) => `laut/${slug(c)}-wie-${slug(w)}`, // "Mmm wie Maus!"
  digit:    n => `ziffer/${n}`,              // "Drei!"
  noise:    w => `geraeusch/${slug(w)}`,     // "Muuh!"
  task:     name => `woerter/${name}`,       // the task of a game, once per level
}

/**
 * Lumi says the recorded ones of these keys, in order. Returns whether
 * anything is said; `onEnd` comes at once when nothing is.
 */
export function voice(keys, opts = {}) {
  const parts = keys.filter(k => k && k in LINES).map(line)
  if (!parts.length) { opts.onEnd?.(); return false }
  narrate(parts, opts)
  return true
}
