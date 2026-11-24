// Lumi's single words for the number, colour and feelings games (recorded
// in lib/lumiLines.js as zahl/<n>, farbe/<name>, gefuehl/<name>). Each is
// null when there is no recording, so callers can just narrate([…]).
import { LINES, line } from './lumiLines.js'

const slug = w => String(w).toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
const rec = key => (LINES[key] ? line(key) : null)

/** "Drei." for 3 (0–40) */
export const numberWord = n => rec(`zahl/${n}`)
/** "Rot." for 'Rot' */
export const colorWord = name => rec(`farbe/${slug(name)}`)
/** "Traurig." for 'Traurig' */
export const feelingWord = name => rec(`gefuehl/${slug(name)}`)
