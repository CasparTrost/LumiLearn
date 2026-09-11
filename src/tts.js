// src/tts.js — Sprachausgabe.
// Spielt selbst nichts mehr ab, sondern reicht an den Erzähler weiter, damit
// Sprache und aufgenommene Ansagen einen gemeinsamen Kanal teilen und sich
// nicht mehr überlagern.

import { narrate, stopNarration } from './narrator.js'

export const speak = (text, { rate = 0.85, pitch = 1.05, lang, onEnd, skipIfSame } = {}) => {
  if (!text) { onEnd?.(); return }
  narrate([{ text, rate, pitch, lang }], { onEnd, skipIfSame })
}

export const cancelSpeech = stopNarration

// ── Zahlen aussprechen ───────────────────────────────────────────────────────
// Eine Ziffer direkt vor einem Punkt liest eine deutsche Stimme als
// Ordnungszahl: aus "4 plus 2. Wo landet die Rakete?" wird "vier plus
// zweite". Das lässt sich nicht global in speak() reparieren, weil die App
// auch echte Ordnungszahlen vorliest ("B ist der 2. Buchstabe des
// Alphabets") — die sind von außen nicht zu unterscheiden. Deshalb schreiben
// die Aufrufer Zahlen aus, wenn eine Zahl einen Satz beendet.
const DE_ONES  = ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf', 'sechs', 'sieben', 'acht', 'neun']
const DE_TEENS = ['zehn', 'elf', 'zwölf', 'dreizehn', 'vierzehn', 'fünfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn']
const DE_TENS  = ['', '', 'zwanzig', 'dreißig', 'vierzig', 'fünfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig']

// Attributiv steht vor einem Substantiv "ein/eine", nicht "eins":
// "ein Feld", "eine Blume" — "eins Feld" ist genau so falsch wie "zweite".
export function sayCount(n, noun, gender = 'm') {
  if (n === 1) return `${gender === 'f' ? 'eine' : 'ein'} ${noun}`
  return `${sayNumber(n)} ${noun}`
}

export function sayNumber(n) {
  if (!Number.isInteger(n) || n < 0 || n > 999) return String(n)
  if (n < 10)  return DE_ONES[n]
  if (n < 20)  return DE_TEENS[n - 10]
  if (n < 100) {
    const t = Math.floor(n / 10), o = n % 10
    return o === 0 ? DE_TENS[t] : `${o === 1 ? 'ein' : DE_ONES[o]}und${DE_TENS[t]}`
  }
  const h = Math.floor(n / 100), r = n % 100
  return `${h === 1 ? '' : DE_ONES[h]}hundert${r === 0 ? '' : sayNumber(r)}`
}
