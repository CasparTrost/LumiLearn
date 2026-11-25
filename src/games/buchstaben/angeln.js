/**
 * Anlaut-Angeln: the words, the levels and the layout (no React here, so
 * the rules can be tested on their own: tests/unit/anlautAngeln.test.js).
 */
import { shuffle } from './useRounds.js'

// Only words whose first sound really is the letter's own sound, with a
// picture that shows just that word: no Vogel under V (that is an F sound),
// no Pferd (pf), no chair for "Tisch", no light bulb for "Lampe", no Eule
// or Eis (eu, ei), no cup that could be "Kaffee".
export const WORDS = [
  ['A','Apfel','🍎'], ['A','Affe','🐒'], ['A','Ameise','🐜'], ['A','Ananas','🍍'], ['A','Anker','⚓'],
  ['E','Ente','🦆'],  ['E','Elefant','🐘'], ['E','Esel','🫏'],
  ['I','Igel','🦔'],  ['I','Insel','🏝️'],
  ['O','Ohr','👂'],   ['O','Oma','👵'], ['O','Orange','🍊'],
  ['U','Ufo','🛸'],   ['U','Uhu','🦉'],
  ['M','Maus','🐭'],  ['M','Mond','🌙'], ['M','Milch','🥛'], ['M','Möhre','🥕'], ['M','Mais','🌽'],
  ['S','Sonne','☀️'], ['S','Socke','🧦'], ['S','Sofa','🛋️'], ['S','Seife','🧼'],
  ['F','Fisch','🐟'], ['F','Fuchs','🦊'], ['F','Feder','🪶'], ['F','Fuß','🦶'],
  ['L','Löwe','🦁'],  ['L','Leiter','🪜'], ['L','Lama','🦙'],
  ['N','Nase','👃'],  ['N','Nest','🪺'], ['N','Nudeln','🍝'],
  ['R','Rose','🌹'],  ['R','Rakete','🚀'], ['R','Roboter','🤖'],
  ['W','Wolke','☁️'], ['W','Wolf','🐺'], ['W','Wal','🐋'], ['W','Wurm','🪱'],
  ['H','Hund','🐕'],  ['H','Haus','🏠'], ['H','Hase','🐰'], ['H','Hahn','🐓'], ['H','Hai','🦈'],
  ['B','Banane','🍌'], ['B','Biene','🐝'], ['B','Bär','🐻'], ['B','Baum','🌳'], ['B','Bus','🚌'], ['B','Buch','📖'],
  ['P','Pilz','🍄'],  ['P','Pinguin','🐧'], ['P','Panda','🐼'], ['P','Pinsel','🖌️'], ['P','Pizza','🍕'],
  ['D','Dose','🥫'],  ['D','Dino','🦖'], ['D','Delfin','🐬'],
  ['T','Tomate','🍅'], ['T','Tiger','🐯'], ['T','Tür','🚪'],
  ['G','Giraffe','🦒'], ['G','Gurke','🥒'], ['G','Geist','👻'], ['G','Geschenk','🎁'],
  ['K','Katze','🐱'], ['K','Koala','🐨'], ['K','Kuh','🐄'], ['K','Käse','🧀'],
  ['Z','Zebra','🦓'], ['Z','Zahn','🦷'], ['Z','Zitrone','🍋'], ['Z','Zelt','⛺'],
  ['J','Jo-Jo','🪀'],
].map(([letter, word, emoji]) => ({ letter, word, emoji }))

export const wordsOf = L => WORDS.filter(w => w.letter === L)
export const ALL = [...new Set(WORDS.map(w => w.letter))].join('')
const VOWELS = 'AEIOU'

// Sounds that are easy to mix up. Kept apart in the early levels, side by
// side at the end — telling B from P is the hard part.
export const PARTNER = { B:'P', P:'B', D:'T', T:'D', G:'K', K:'G', M:'N', N:'M' }

// The picture a bucket shows after a miss: the word of Lumi's recorded
// "Mmm wie Maus!" (laut/m-wie-maus), so the frog can say it too.
export const KEY = {
  A:'Affe', B:'Bär', D:'Dino', E:'Ente', F:'Fisch', G:'Gurke', H:'Haus', I:'Igel', K:'Katze', L:'Löwe',
  M:'Maus', N:'Nase', O:'Oma', P:'Pinguin', R:'Rakete', S:'Sonne', T:'Tiger', U:'Ufo', W:'Wal', Z:'Zebra',
}

/** The hint picture for bucket L while `word` hangs on the hook: never that word itself. */
export function keyFor(L, word) {
  const key = KEY[L] && KEY[L] !== word ? WORDS.find(w => w.word === KEY[L]) : null
  return key ?? wordsOf(L).find(w => w.word !== word) ?? null
}

/**
 * The steps: long sounds you can hold (mmm, sss, fff), then the vowels, then
 * the short ones (b, d, g …), and last the look-alike pairs side by side.
 *   pool       the letters a level's buckets come from
 *   buckets    how many buckets stand on the bank (fixed for the level)
 *   catches    how many catches are sorted in the level
 *   swimmers   words in the water at the same time
 *   speed      px/s of the swimmers (for a pond 600 px wide)
 *   depth      how far down the water they swim (share of the water)
 *   dwell      s the hook waits down there before it comes up empty
 *   pull       how strongly a swimmer near the hook swims to it (px/s)
 *   chestAt / bootAt   after this many catches the chest / the boot swims in
 *   pairs      partner pairs placed side by side (B/P, D/T, G/K, M/N)
 *   mix        at least one vowel and one consonant
 */
export const LEVELS = [
  { pool: 'MSF',           buckets: 2, catches: 6, swimmers: 3, speed: [24, 34],  depth: 0.5,  dwell: 1.8, pull: 70, chestAt: 2 },
  { pool: 'MSFLNR',        buckets: 2, catches: 6, swimmers: 3, speed: [28, 40],  depth: 0.6,  dwell: 1.7, pull: 64, chestAt: 3, bootAt: 1 },
  { pool: 'MSFLNRWH',      buckets: 3, catches: 7, swimmers: 3, speed: [32, 46],  depth: 0.7,  dwell: 1.6, pull: 58, chestAt: 4, bootAt: 2 },
  { pool: 'AEO',           buckets: 3, catches: 7, swimmers: 3, speed: [36, 52],  depth: 0.75, dwell: 1.5, pull: 52, chestAt: 3, bootAt: 1 },
  { pool: 'AEIOU',         buckets: 3, catches: 7, swimmers: 3, speed: [40, 58],  depth: 0.8,  dwell: 1.4, pull: 48, chestAt: 4, bootAt: 2 },
  { pool: 'AEIOUMSFLNRWH', buckets: 4, catches: 8, swimmers: 4, speed: [44, 64],  depth: 0.9,  dwell: 1.3, pull: 44, chestAt: 3, bootAt: 5, mix: true },
  { pool: 'BDGKPT',        buckets: 3, catches: 8, swimmers: 3, speed: [50, 72],  depth: 0.95, dwell: 1.2, pull: 40, chestAt: 5, bootAt: 2 },
  { pool: 'BDGKPTZJ',      buckets: 4, catches: 8, swimmers: 4, speed: [56, 80],  depth: 1,    dwell: 1.1, pull: 36, chestAt: 2, bootAt: 5 },
  { pool: 'BDGKPTMN',      buckets: 4, catches: 8, swimmers: 4, speed: [62, 90],  depth: 1,    dwell: 1.0, pull: 32, chestAt: 4, bootAt: 1, pairs: 2 },
  { pool: ALL,             buckets: 4, catches: 8, swimmers: 4, speed: [70, 100], depth: 1,    dwell: 1.0, pull: 30, chestAt: 5, bootAt: 3, pairs: 1 },
]

export const levelConfig = level => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, (level | 0) - 1))]

/**
 * The letters on the buckets for a level, left to right. A letter needs two
 * words at least (J has only the yo-yo); partners are kept apart unless the
 * level is about them, and then they stand side by side.
 */
export function pickBuckets(level) {
  const cfg = levelConfig(level)
  const usable = [...cfg.pool].filter(L => wordsOf(L).length >= 2)
  const n = Math.min(cfg.buckets, usable.length)
  for (let tries = 0; tries < 400; tries++) {
    if (cfg.pairs) {
      const pairs = shuffle(usable.filter(L => usable.includes(PARTNER[L]) && L < PARTNER[L]))
        .slice(0, cfg.pairs).map(L => shuffle([L, PARTNER[L]]))
      const taken = pairs.flat()
      const rest = []
      for (const L of shuffle(usable)) {
        if (taken.length + rest.length >= n) break
        if (![...taken, ...rest].some(o => o === L || o === PARTNER[L])) rest.push(L)
      }
      // a lone letter goes to one end, the pairs stay together
      const groups = shuffle([...pairs, ...rest.map(L => [L])])
      const out = groups.flat()
      if (out.length === n) return out
      continue
    }
    const out = shuffle(usable).slice(0, n)
    if (out.some(L => out.includes(PARTNER[L]))) continue
    if (cfg.mix && (!out.some(L => VOWELS.includes(L)) || out.every(L => VOWELS.includes(L)))) continue
    return out
  }
  return usable.slice(0, n)
}

/**
 * The next word to swim in: for the bucket that has least so far (sorted
 * and swimming), a word not in the water now and used least in this level.
 */
export function nextWord(buckets, { sorted = {}, swimming = [], used = {} } = {}) {
  const load = L => (sorted[L] ?? 0) + swimming.filter(w => w.letter === L).length
  const low = Math.min(...buckets.map(load))
  const letter = shuffle(buckets.filter(L => load(L) === low))[0]
  const free = wordsOf(letter).filter(w => !swimming.some(s => s.word === w.word))
  const pool = free.length ? free : wordsOf(letter)
  const least = Math.min(...pool.map(w => used[w.word] ?? 0))
  return shuffle(pool.filter(w => (used[w.word] ?? 0) === least))[0]
}

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** The parts of one bucket on the bank for a unit `uw` wide: the frog sits on the bucket's rim. */
export function unitOf(uw) {
  const f = uw * 0.66, bw = uw * 0.9, bh = bw * 0.78
  return { uw, f, bw, bh, uh: Math.round(f * 0.72 + bh + 12) }
}

export const STRIP = 46

/**
 * Where everything goes in a field w × h px.
 *   tall / tablet: the bank with the buckets on top, the pond under it
 *   wide and low (a phone on its side): the pond left, the bank right
 * The pond has a band of surface on top (seen from above, the boat floats
 * at its front edge, the catch dangles over it) and the water below, with
 * `lanes` depths for the swimmers. S is a swimmer, C the catch on the hook.
 */
export function layoutFor(w, h, n, lanes) {
  const side = w > h * 1.25 && h < 560
  let strip, bank, units, pond, gapAt
  if (!side) {
    const gap = 10
    const uw = Math.min(156, (w - 24 - (n - 1) * gap) / n)
    const u = unitOf(uw)
    strip = { x: 0, y: 0, w, h: STRIP }
    bank = { x: 0, y: STRIP - 6, w, h: u.uh + 20 }
    const x0 = (w - (n * uw + (n - 1) * gap)) / 2
    units = Array.from({ length: n }, (_, i) => ({ ...u, x: x0 + i * (uw + gap), y: STRIP + 4 }))
    gapAt = { x: x0 + uw + gap / 2, y: STRIP + 4 + u.uh * 0.55 }
    pond = { x: 0, y: bank.y + bank.h, w, h: h - bank.y - bank.h }
  } else {
    const cw = clamp(w * 0.31, 210, 320)
    const cols = n <= 2 ? 1 : 2, rows = Math.ceil(n / cols), gap = 8
    const availH = h - STRIP - 8 - (rows - 1) * gap
    let uw = Math.min(150, (cw - 20 - (cols - 1) * gap) / cols)
    while (uw > 56 && unitOf(uw).uh > availH / rows) uw -= 2
    const u = unitOf(uw)
    const x1 = w - cw, gy = STRIP + Math.max(0, (availH - rows * u.uh) / 2)
    units = Array.from({ length: n }, (_, i) => {
      const r = Math.floor(i / cols), inRow = Math.min(cols, n - r * cols), c = i % cols
      const rowW = inRow * uw + (inRow - 1) * gap
      return { ...u, x: x1 + (cw - rowW) / 2 + c * (uw + gap), y: gy + r * (u.uh + gap) }
    })
    gapAt = cols === 1
      ? { x: x1 + cw / 2, y: gy + u.uh + gap / 2 }
      : { x: units[0].x + uw + gap / 2, y: units[0].y + u.uh * 0.55 }
    strip = { x: x1, y: 0, w: cw, h: STRIP }
    bank = { x: x1, y: 0, w: cw, h }
    pond = { x: 0, y: 0, w: x1, h }
  }
  const sand = 12, k = 0.8
  // the surface band is C + 36 high and C = 1.3 S; the water holds the lanes and a strip of sand
  const S = Math.round(clamp(Math.min((pond.h - sand - 36) / (1.3 + 0.75 + k * lanes), pond.w / 4.4), 52, 96))
  const C = Math.round(S * 1.3)
  const rodUp = C + 22
  const surface = pond.y + rodUp + 14
  const water = { top: surface, bottom: pond.y + pond.h - sand }
  return { side, strip, bank, units, gapAt, pond, S, C, rodUp, surface, water, lumi: Math.round(clamp(S * 0.95, 54, 88)) }
}

/** The depths (y) of the lanes: shallow ones first, deeper ones in the later levels. */
export function lanesFor(L, lanes, depth) {
  // the first lane below the boat's keel
  const top = L.water.top + Math.max(L.S * 0.62, L.lumi * 0.26 + L.S * 0.5)
  // the bottom is for the chest and the boot
  const deepest = L.water.bottom - L.S * 1.25
  const want = top + (deepest - top) * depth
  const bottom = Math.min(deepest, Math.max(want, top + (lanes - 1) * L.S * 0.8))
  if (lanes <= 1) return [top]
  return Array.from({ length: lanes }, (_, i) => top + ((bottom - top) * i) / (lanes - 1))
}
