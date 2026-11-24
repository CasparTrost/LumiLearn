// Animal voices (made with ElevenLabs sound effects, trimmed and evened out):
// an animal the child taps, or one that is happy about a right answer, makes
// its own sound. Animals that make no sound (a turtle, a fish) stay silent.
import { asset } from './assets.js'

const SOUND = {
  '🐮': 'kuh', '🐄': 'kuh', '🐱': 'katze', '🐶': 'hund', '🐕': 'hund',
  '🐸': 'frosch', '🐘': 'elefant', '🐻': 'baer', '🐭': 'maus',
  '🐒': 'affe', '🐝': 'biene', '🐧': 'pinguin', '🦁': 'loewe',
  '🐦': 'vogel', '🦉': 'eule', '🦆': 'ente', '🐓': 'hahn', '🐬': 'delfin',
  '🐿': 'eichhoernchen', '🦜': 'papagei', '🐷': 'schwein', '🐖': 'schwein',
  '🐯': 'tiger', '🐅': 'tiger', '🐑': 'schaf', '🐉': 'drache',
  '🐍': 'schlange', '🐳': 'wal', '🐋': 'wal', '🦖': 'dino', '🦕': 'dino',
  '🐔': 'huhn', '🐺': 'wolf', '🐴': 'pferd', '🐎': 'pferd', '🦄': 'pferd',
  '🐤': 'kueken', '🐐': 'ziege', '🦛': 'nilpferd',
  '🦔': 'igel', '🐙': 'krake',
}

/** The sound file name for a picture, or null when the animal is silent */
export function animalSound(art) {
  if (typeof art !== 'string') return null
  return SOUND[art.replace(/️/g, '')] ?? null
}

const cache = new Map()
let last = 0
const lastOf = new Map()
// the same animal's sound not again within this time
const SAME_MS = 4000

/**
 * Plays the animal's sound. Never two at once: a whole party of happy
 * animals makes one sound, not a din. Returns true when a sound played.
 */
export function playAnimal(art, { volume = 0.75 } = {}) {
  const name = animalSound(art)
  if (!name || typeof Audio === 'undefined') return false
  const now = Date.now()
  if (now - last < 900 || now - (lastOf.get(name) ?? 0) < SAME_MS) return false
  last = now
  lastOf.set(name, now)
  try {
    let a = cache.get(name)
    if (!a) { a = new Audio(asset(`audio/tiere/${name}.mp3`)); a.preload = 'auto'; cache.set(name, a) }
    a.volume = volume
    a.currentTime = 0
    const p = a.play()
    if (p?.catch) p.catch(() => {})
    return true
  } catch {
    return false
  }
}
