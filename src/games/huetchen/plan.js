/**
 * Hütchenspiel im Gebüsch — what each level asks, and the words and swaps
 * of one shuffle. Pure: no React, no sound (tests/unit/huetchen.test.js).
 *
 * A shuffle: n things stand on n bushes, hop in one after the other (each
 * says its word), the bushes swap places (`swaps` times, two at a time),
 * then Lumi calls one by its name (in the reading levels she shows it
 * written on a sign) and the child taps the bush it is in now. From level 5
 * Lumi calls a second one from the same bushes before the next shuffle.
 */

// Every word has Lumi's recording (woerter/<slug>) and an illustrated
// picture; a test checks both. One picture, one name: nothing a child might
// call by another word. (Left out for that reason: Socke, drawn as a pair;
// Kanne, a teapot; Vase, an amphora; Wolf, which looks like a husky; Zug, a
// steam engine a child calls Lok. No body parts either: a nose or a mouth
// hiding in a bush is odd.)
const W = (word, emoji, cat) => ({ word, emoji, cat })
export const BANK = [
  // animals
  W('Hund', '🐕', 'tier'), W('Katze', '🐱', 'tier'), W('Pferd', '🐴', 'tier'), W('Kuh', '🐄', 'tier'), W('Schaf', '🐑', 'tier'),
  W('Schwein', '🐖', 'tier'), W('Löwe', '🦁', 'tier'), W('Tiger', '🐯', 'tier'), W('Bär', '🐻', 'tier'), W('Fuchs', '🦊', 'tier'),
  W('Elefant', '🐘', 'tier'), W('Giraffe', '🦒', 'tier'), W('Affe', '🐒', 'tier'), W('Pinguin', '🐧', 'tier'), W('Eule', '🦉', 'tier'),
  W('Frosch', '🐸', 'tier'), W('Schildkröte', '🐢', 'tier'), W('Biene', '🐝', 'tier'), W('Schmetterling', '🦋', 'tier'),
  W('Schnecke', '🐌', 'tier'), W('Krokodil', '🐊', 'tier'), W('Igel', '🦔', 'tier'), W('Maus', '🐭', 'tier'), W('Hase', '🐰', 'tier'),
  W('Ente', '🦆', 'tier'), W('Hahn', '🐓', 'tier'), W('Zebra', '🦓', 'tier'), W('Panda', '🐼', 'tier'), W('Koala', '🐨', 'tier'),
  W('Lama', '🦙', 'tier'), W('Papagei', '🦜', 'tier'), W('Dino', '🦕', 'tier'), W('Fisch', '🐟', 'tier'),
  W('Wal', '🐋', 'tier'), W('Hai', '🦈', 'tier'),
  // food
  W('Apfel', '🍎', 'essen'), W('Banane', '🍌', 'essen'), W('Erdbeere', '🍓', 'essen'), W('Pizza', '🍕', 'essen'), W('Kuchen', '🍰', 'essen'),
  W('Eis', '🍦', 'essen'), W('Brot', '🍞', 'essen'), W('Keks', '🍪', 'essen'), W('Karotte', '🥕', 'essen'), W('Käse', '🧀', 'essen'),
  W('Ananas', '🍍', 'essen'), W('Zitrone', '🍋', 'essen'), W('Gurke', '🥒', 'essen'), W('Mais', '🌽', 'essen'), W('Tomate', '🍅', 'essen'),
  // things
  W('Ball', '⚽', 'ding'), W('Buch', '📖', 'ding'), W('Schere', '✂️', 'ding'), W('Krone', '👑', 'ding'), W('Geschenk', '🎁', 'ding'),
  W('Brille', '👓', 'ding'), W('Gitarre', '🎸', 'ding'), W('Koffer', '🧳', 'ding'), W('Kerze', '🕯️', 'ding'), W('Schlüssel', '🔑', 'ding'),
  W('Trommel', '🥁', 'ding'), W('Anker', '⚓', 'ding'), W('Zauberstab', '🪄', 'ding'), W('Hut', '🎩', 'ding'), W('Eimer', '🪣', 'ding'),
  W('Schuh', '👟', 'ding'), W('Hose', '👖', 'ding'), W('Roboter', '🤖', 'ding'), W('Tasse', '☕', 'ding'),
  W('Tasche', '👜', 'ding'), W('Schal', '🧣', 'ding'), W('Dose', '🥫', 'ding'),
  W('Stein', '🪨', 'ding'), W('Feder', '🪶', 'ding'),
  // vehicles
  W('Rakete', '🚀', 'fahrt'), W('Auto', '🚗', 'fahrt'), W('Flugzeug', '✈️', 'fahrt'), W('Schiff', '🚢', 'fahrt'),
  W('Fahrrad', '🚲', 'fahrt'), W('Traktor', '🚜', 'fahrt'), W('Hubschrauber', '🚁', 'fahrt'), W('Bus', '🚌', 'fahrt'), W('Ufo', '🛸', 'fahrt'),
  // nature
  W('Sonne', '☀️', 'natur'), W('Mond', '🌙', 'natur'), W('Stern', '⭐', 'natur'), W('Regenbogen', '🌈', 'natur'), W('Blume', '🌸', 'natur'),
  W('Pilz', '🍄', 'natur'), W('Wolke', '☁️', 'natur'), W('Rose', '🌹', 'natur'), W('Haus', '🏠', 'natur'),
]
const byWord = Object.fromEntries(BANK.map(w => [w.word, w]))
export const wordOf = word => byWord[word]

// The first levels: words every four-year-old knows, from different areas
const EASY = ['Hund', 'Katze', 'Kuh', 'Schwein', 'Löwe', 'Bär', 'Elefant', 'Affe', 'Frosch', 'Maus', 'Ente', 'Fisch', 'Hase',
  'Apfel', 'Banane', 'Eis', 'Kuchen', 'Pizza', 'Karotte', 'Ball', 'Buch', 'Auto', 'Schuh', 'Hut', 'Geschenk', 'Krone',
  'Sonne', 'Mond', 'Stern', 'Blume', 'Rakete', 'Bus', 'Schiff', 'Trommel', 'Brille', 'Tiger', 'Giraffe', 'Pinguin']

// Words that sound alike (one sound apart): in levels 6 and 7 one such set
// hides in every shuffle, and one of it is called. Here a child has to
// listen to the whole word, not only guess from what it means.
export const SOUND_SETS = [
  ['Maus', 'Haus', 'Mais'], ['Hase', 'Hose'], ['Rose', 'Hose', 'Dose'], ['Kuh', 'Schuh'], ['Fisch', 'Tisch'],
  ['Tasse', 'Tasche'], ['Wal', 'Schal'],
]

// Reading: short words that are read the way they are written (no final
// d or g said as t or k, no silent h, no v said as f, no st said as scht)
const READ_SHORT = ['Maus', 'Ball', 'Eis', 'Bus', 'Hut', 'Auto', 'Igel', 'Ente', 'Hase', 'Rose', 'Hose', 'Wal', 'Buch',
  'Brot', 'Pilz', 'Lama', 'Ufo', 'Affe', 'Haus', 'Dose', 'Dino', 'Keks']
const READ_MID = [...READ_SHORT, 'Hund', 'Mond', 'Kuh', 'Hai', 'Stern', 'Sonne', 'Tiger', 'Zebra', 'Panda', 'Fisch', 'Tasse', 'Wolke', 'Apfel', 'Pizza', 'Kerze',
  'Krone', 'Banane', 'Tomate', 'Rakete', 'Gurke', 'Eule', 'Biene', 'Katze', 'Schaf', 'Schuh', 'Hahn', 'Koala']
// Look-alike words for the last level: one letter decides
export const LOOK_SETS = [
  ['Maus', 'Haus'], ['Maus', 'Mais'], ['Hase', 'Hose'], ['Rose', 'Hose', 'Dose'], ['Fisch', 'Tisch'],
  ['Tasse', 'Tasche'], ['Wal', 'Schal'],
]
// Words only the sets above use (pictures that do not stand alone well)
const EXTRA = [W('Tisch', ':px-tisch:', 'ding')]
for (const w of EXTRA) byWord[w.word] = w
export const ALL_WORDS = [...BANK, ...EXTRA]

// Pairs that are never in one shuffle by chance: too alike in meaning
// (a cake or a biscuit?) or in sound, outside the levels that ask for it
const CLOSE = [['Fisch', 'Hai', 'Wal'], ['Kuchen', 'Keks'], ['Maus', 'Hase'], ['Löwe', 'Tiger'],
  ['Rose', 'Blume'], ['Hund', 'Fuchs'], ['Schaf', 'Lama'], ['Mond', 'Stern'], ['Hut', 'Krone']]
const soundAlike = (a, b) => [...SOUND_SETS, ...LOOK_SETS].some(s => s.includes(a) && s.includes(b))
export const tooClose = (a, b) => a !== b && (CLOSE.some(g => g.includes(a) && g.includes(b)) || soundAlike(a, b))

/**
 * The ten levels.
 *   bushes   how many (five only where the screen is wide enough)
 *   swaps    swaps per shuffle (always two neighbours: a swap over a
 *            third bush hid that one behind the bush in front for a moment,
 *            and the eye lost which was which)
 *   ms       how long one swap takes (made quicker or slower by how it goes)
 *   finds    things called per shuffle
 *   shuffles per level
 *   words    'easy' | 'all' | 'sound' (a sound-alike set in each) |
 *            'read-short' | 'read' | 'read-look' (look-alike words)
 *   gap      the time between two things hopping into their bushes
 */
export const LEVELS = [
  { bushes: 3, swaps: 0, ms: 0,    finds: 1, shuffles: 6, words: 'easy', gap: 1150 },
  { bushes: 3, swaps: 1, ms: 1400, finds: 1, shuffles: 6, words: 'easy', gap: 1100 },
  { bushes: 4, swaps: 2, ms: 1200, finds: 1, shuffles: 6, words: 'easy', gap: 1050 },
  { bushes: 4, swaps: 2, ms: 1100, finds: 1, shuffles: 6, words: 'all',  gap: 1000 },
  { bushes: 4, swaps: 3, ms: 1000, finds: 2, shuffles: 5, words: 'all',  gap: 950 },
  { bushes: 4, swaps: 3, ms: 900,  finds: 2, shuffles: 5, words: 'sound', gap: 950 },
  { bushes: 5, swaps: 4, ms: 850,  finds: 2, shuffles: 5, words: 'sound', gap: 900 },
  { bushes: 4, swaps: 2, ms: 1100, finds: 1, shuffles: 6, words: 'read-short', gap: 1000, read: true },
  { bushes: 4, swaps: 3, ms: 1000, finds: 2, shuffles: 5, words: 'read', gap: 950, read: true },
  { bushes: 5, swaps: 3, ms: 950,  finds: 2, shuffles: 5, words: 'read-look', gap: 900, read: true },
]
export const levelConfig = level => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (level | 0) - 1))]
/** What a level counts: every find, once */
export const findsIn = cfg => cfg.shuffles * cfg.finds

/**
 * Five bushes need a wide screen. On a phone held upright three: with four
 * they were a thin strip, too small to follow the swaps.
 */
export const bushesFor = (cfg, width) => Math.min(cfg.bushes, width < 600 ? 3 : 5)

const shuffled = (a, rnd) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}

function pool(cfg) {
  switch (cfg.words) {
    case 'easy': return EASY
    case 'read-short': return READ_SHORT
    case 'read': case 'read-look': return READ_MID
    default: return BANK.map(w => w.word)
  }
}

/**
 * The swaps of one shuffle: pairs of neighbouring places [a, a + 1].
 * Never the same pair twice in a row (that would undo it).
 */
export function makeSwaps(cfg, n, rnd = Math.random) {
  const out = []
  for (let k = 0; k < cfg.swaps; k++) {
    let pair
    for (let t = 0; t < 30; t++) {
      const a = Math.floor(rnd() * (n - 1))
      const p = [a, a + 1]
      const last = out[out.length - 1]
      pair = p
      if (!last || last[0] !== p[0] || last[1] !== p[1]) break
    }
    out.push(pair)
  }
  return out
}

/** Where each thing (by its first place) is after the swaps: place → thing index */
export function afterSwaps(n, swaps) {
  const at = Array.from({ length: n }, (_, i) => i)
  for (const [a, b] of swaps) [at[a], at[b]] = [at[b], at[a]]
  return at
}

/**
 * One shuffle: `n` words (in their first places), the swaps, and the
 * words Lumi calls (`finds` of them). `used`: the words this level has
 * shown so far (they come back only if the list runs out); `called`: those
 * already called. The first one called has moved, if anything moved.
 */
export function makeShuffle(cfg, n, { used = new Set(), called = new Set(), rnd = Math.random } = {}) {
  const fresh = shuffled(pool(cfg).filter(w => !used.has(w)), rnd)
  const spare = shuffled(pool(cfg).filter(w => used.has(w) && !called.has(w)), rnd)
  const words = []
  const fits = w => !words.includes(w) && words.every(o => !tooClose(o, w))

  // levels 6, 7 and 10: a set of words that sound or look alike
  let set = null
  if (cfg.words === 'sound' || cfg.words === 'read-look') {
    const sets = shuffled(cfg.words === 'sound' ? SOUND_SETS : LOOK_SETS, rnd)
    set = sets.find(s => s.every(w => !called.has(w))) ?? sets[0]
    set = shuffled(set, rnd).slice(0, Math.min(set.length, n - 1))
    words.push(...set)
  }
  // the first levels: things from different areas (an animal, a food, a toy)
  const cats = new Set(words.map(w => byWord[w].cat))
  if (cfg.words === 'easy') {
    for (const w of fresh) {
      if (words.length >= n) break
      if (!cats.has(byWord[w].cat) && fits(w)) { words.push(w); cats.add(byWord[w].cat) }
    }
  }
  for (const list of [fresh, spare, shuffled(pool(cfg), rnd)]) {
    for (const w of list) {
      if (words.length >= n) break
      if (fits(w) && !called.has(w)) words.push(w)
    }
  }
  const things = shuffled(words, rnd).slice(0, n)
  const swaps = makeSwaps(cfg, n, rnd)
  const at = afterSwaps(n, swaps)
  const moved = new Set(at.filter((thing, place) => thing !== place))

  // who is called: from the alike set if there is one, the first one that moved
  const callable = things.map((w, i) => ({ w, i })).filter(({ w }) => !called.has(w))
  const rank = ({ w, i }) => (set?.includes(w) ? 0 : 2) + (moved.size && !moved.has(i) ? 1 : 0) + rnd() * 0.5
  const order = [...callable].sort((a, b) => rank(a) - rank(b))
  const calls = [order[0]]
  // the second call: from what is left, best not the other of the alike pair
  // (its bush is a one-in-two guess then)
  const rest = order.slice(1)
  const second = rest.find(({ w }) => !set?.includes(w)) ?? rest[0]
  if (cfg.finds > 1 && second) calls.push(second)
  return {
    things: things.map(w => byWord[w]),
    swaps,
    calls: calls.filter(Boolean).map(c => byWord[c.w]),
  }
}
