/**
 * Monster-Mampf (ABC-Abenteuer): the words, the levels, what floats in
 * next, and where everything stands. No React in here, so it can be tested.
 */

// ─── Words ────────────────────────────────────────────────────────────────────
// [word, picture, never a wrong thing for the monsters with these letters].
//
// Every word has a picture and Lumi's recording (woerter/<word>), and it
// starts with the sound of its letter: no "Stern" under S (that is "scht"),
// no "Ei" or "Eule" under E, no "Auto" under A, no "Pferd" under P.
// The first word of a letter is the one from Lumi's sentence ("A wie Affe"):
// it floats in first, so the first bite is the one the child just heard.
//
// The third entry keeps a miss fair. A child who sees the rabbit and thinks
// "Kaninchen" is right to feed it to the K monster, so the rabbit never
// floats past a hungry K. '*' marks pictures a small child may not know by
// name: they only ever come for their own monster.
export const WORDS = {
  A: [['Affe', '🐒'], ['Apfel', '🍎'], ['Ananas', '🍍'], ['Anker', '⚓', '*'], ['Ameise', '🐜', 'K'], ['Adler', '🦅', 'V']],
  B: [['Bär', '🐻'], ['Banane', '🍌'], ['Biene', '🐝'], ['Blume', '🌸'], ['Baum', '🌳'], ['Buch', '📖'], ['Bus', '🚌'], ['Brot', '🍞', 'T'], ['Bett', '🛏️'], ['Brille', '👓', 'S'], ['Ball', '⚽', 'F']],
  C: [['Clown', '🤡'], ['Computer', '💻', 'L'], ['Croissant', '🥐', 'H']],
  D: [['Dino', '🦖'], ['Drache', '🐉'], ['Dose', '🥫', 'BKT'], ['Delfin', '🐬', 'F']],
  E: [['Ente', '🦆'], ['Elefant', '🐘'], ['Erdbeere', '🍓'], ['Esel', '🫏', 'P']],
  F: [['Fisch', '🐟'], ['Frosch', '🐸'], ['Fuchs', '🦊'], ['Feder', '🪶'], ['Fuß', '🦶'], ['Flugzeug', '✈️'], ['Fahrrad', '🚲', 'R']],
  G: [['Giraffe', '🦒'], ['Geist', '👻'], ['Gurke', '🥒'], ['Gitarre', '🎸'], ['Geschenk', '🎁', 'P']],
  H: [['Hund', '🐶'], ['Haus', '🏠'], ['Hut', '🎩', 'Z'], ['Hose', '👖', 'J'], ['Hubschrauber', '🚁'], ['Hahn', '🐓', 'G'], ['Hase', '🐰', 'K'], ['Hai', '🦈', 'F']],
  I: [['Igel', '🦔'], ['Insel', '🏝️', 'PS']],
  J: [['Jacke', '🧥', 'MA'], ['Jo-Jo', '🪀', '*']],
  K: [['Katze', '🐱'], ['Kuh', '🐄'], ['Käse', '🧀'], ['Kerze', '🕯️'], ['Krokodil', '🐊'], ['Krone', '👑'], ['Keks', '🍪', 'P'], ['Koala', '🐨', 'B'], ['Koffer', '🧳', 'T']],
  L: [['Löwe', '🦁'], ['Leiter', '🪜'], ['Lama', '🦙', 'SA']],
  M: [['Maus', '🐭', 'R'], ['Mond', '🌙'], ['Mais', '🌽'], ['Milch', '🥛', 'GW']],
  N: [['Nase', '👃'], ['Nest', '🪺', 'EV'], ['Nudeln', '🍝', 'ST']],
  O: [['Oma', '👵', 'FG'], ['Ohr', '👂'], ['Orange', '🍊', 'AM']],
  P: [['Pinguin', '🐧'], ['Pilz', '🍄', 'F'], ['Pizza', '🍕'], ['Pinsel', '🖌️'], ['Panda', '🐼', 'B'], ['Papagei', '🦜', 'V']],
  Q: [['Qualle', '🪼', '*'], ['Quadrat', '🟥', '*']],
  R: [['Rakete', '🚀'], ['Roboter', '🤖'], ['Regenbogen', '🌈', 'W'], ['Rose', '🌹', 'B']],
  S: [['Sonne', '☀️'], ['Socke', '🧦'], ['Sofa', '🛋️', 'CKL'], ['Salat', '🥗', 'G'], ['Seife', '🧼', '*']],
  T: [['Tiger', '🐯'], ['Tomate', '🍅'], ['Trommel', '🥁'], ['Traktor', '🚜'], ['Tür', '🚪'], ['Tisch', ':px-tisch:']],
  U: [['Uhu', '🦉', 'E'], ['Ufo', '🛸', 'R']],
  V: [['Vogel', '🐦'], ['Vase', '🏺', '*'], ['Vulkan', '🌋', 'B']],
  W: [['Wal', '🐋', 'F'], ['Wolke', '☁️'], ['Wolf', '🐺', 'HF'], ['Wurm', '🪱', 'R']],
  X: [['Xylofon', ':px-xylofon:', '*']],
  Y: [['Yoga', '🧘', '*']],
  Z: [['Zebra', '🦓', 'P'], ['Zahn', '🦷'], ['Zitrone', '🍋'], ['Zelt', '⛺'], ['Zug', '🚂', 'EL'], ['Zauberstab', '🪄', 'S']],
}
export const LETTERS = Object.keys(WORDS)

const thing = (letter, [word, emoji]) => ({ word, emoji, letter })
/** All things of a letter, as { word, emoji, letter }. */
export const thingsOf = L => WORDS[L].map(w => thing(L, w))

// ─── Sounds ───────────────────────────────────────────────────────────────────
// Letters that can sound the same at the start of a word. Their words are
// never a wrong thing: who hears "Fff" in "Vogel" and feeds it to the F
// monster has listened well.
export const SAME = { F: 'V', V: 'FW', W: 'V', K: 'CQ', C: 'KQZ', Q: 'KC', Z: 'C', J: 'Y', Y: 'J' }

// Sounds that are easy to mix up. In the early levels they are kept apart
// ("first sounds that sound very different"); from level 7 on the partner
// is exactly what floats past.
export const NEAR = {
  B: 'PDG', D: 'TBG', G: 'KBDC', P: 'BTK', T: 'DPKZ', K: 'GPTX',
  M: 'N', N: 'ML', L: 'NR', R: 'L', F: 'W', W: 'F', S: 'ZX', Z: 'STX', C: 'GX', Q: 'G', X: 'KSZC',
  H: 'AEIOU', A: 'H', E: 'HI', I: 'HEJY', O: 'HU', U: 'HO', J: 'I', Y: 'I',
}
export const PARTNER = { B: 'P', P: 'B', D: 'T', T: 'D', G: 'K', K: 'G', M: 'N', N: 'M', S: 'Z', Z: 'S', F: 'W', W: 'F' }
const VOWELS = 'AEIOU'

/** A wrong thing with letter `L` is fair for a monster with letter `T`. */
const fair = (L, T) => L !== T && !(SAME[T] ?? '').includes(L)
/** … and it sounds clearly different. */
const far = (L, T) => fair(L, T) && !(NEAR[T] ?? '').includes(L) && !(NEAR[L] ?? '').includes(T) && !(VOWELS.includes(L) && VOWELS.includes(T))

// ─── Levels ───────────────────────────────────────────────────────────────────
// The letters follow the old ABC-Abenteuer: first the vowels and the sounds
// one can hold (mmm, sss), then the short ones, then the rare ones.
//   count  things in the air at a time
//   cross  seconds a thing takes to cross the stage (smaller = quicker)
//   near   the wrong things are mostly the sound that is easy to mix up
//   lower  the small letter is the big one on the belly
//   duo    two monsters at once
export const LEVELS = [
  { letters: 'AMOLS', monsters: 4, count: 2, cross: 19 },
  { letters: 'EIU', review: 'AMOLS', monsters: 4, count: 2, cross: 18 },
  { letters: 'BDFH', monsters: 4, count: 3, cross: 17 },
  { letters: 'KNRT', monsters: 4, count: 3, cross: 16 },
  { letters: 'GJPWZ', monsters: 5, count: 3, cross: 15 },
  { letters: 'VCQXY', monsters: 5, count: 4, cross: 15 },
  { letters: 'BPDTGK', monsters: 5, count: 4, cross: 14, near: true },
  { letters: 'MNSZFW', monsters: 5, count: 4, cross: 13, near: true, lower: true },
  { duo: true, pairs: 2, count: 4, cross: 15 },
  { duo: true, pairs: 2, count: 4, cross: 13, lower: true, nearPair: true },
]
export const levelConfig = level => LEVELS[Math.max(1, Math.min(LEVELS.length, Math.round(level) || 1)) - 1]

// Strong colours with a dark outline: easy to see in front of the meadow
export const COLORS = ['#e8483b', '#f08a1c', '#3aa845', '#2f8fe0', '#8e5bd8', '#e0468c', '#17a79a', '#d9a514']
const colorIndex = L => LETTERS.indexOf(L) % COLORS.length

/** Bites until a monster is full: five, fewer for a letter with one or two words. */
export const needOf = L => (WORDS[L].length >= 3 ? 5 : WORDS[L].length === 2 ? 4 : 3)

export function shuffle(list, rnd = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Letters with enough words for a monster that shares the stage
const DUO_POOL = 'ABDEFGHKLMPRSTZ'
const NEAR_PAIRS = ['BP', 'DT', 'GK', 'MN']

/**
 * The monsters of a level, in the groups in which they come on stage (one
 * at a time, or two at once): [[{ slot, letter, shown, tag, color, need }]].
 */
export function planLevel(level, rnd = Math.random) {
  const cfg = levelConfig(level)
  let groups
  if (cfg.duo) {
    const pairs = []
    let last = null
    if (cfg.nearPair) last = [...NEAR_PAIRS[Math.floor(rnd() * NEAR_PAIRS.length)]]
    const pool = shuffle([...DUO_POOL].filter(L => !last?.includes(L)), rnd)
    while (pairs.length < cfg.pairs - (last ? 1 : 0) && pool.length > 1) {
      const a = pool.shift()
      const i = pool.findIndex(b => far(a, b) && far(b, a))
      if (i < 0) continue
      pairs.push([a, pool.splice(i, 1)[0]])
    }
    groups = last ? [...pairs, shuffle(last, rnd)] : pairs
  } else {
    let letters = shuffle([...cfg.letters], rnd)
    if (cfg.review) letters = shuffle([...letters, ...shuffle([...cfg.review], rnd).slice(0, cfg.monsters - letters.length)], rnd)
    groups = letters.slice(0, cfg.monsters).map(L => [L])
  }
  let slot = 0
  return {
    cfg,
    groups: groups.map(g => g.map((L, i) => {
      // two monsters on stage never wear the same colour
      let c = colorIndex(L)
      if (i > 0 && c === colorIndex(g[0])) c = (c + 3) % COLORS.length
      const small = L.toLowerCase()
      return { slot: slot++, letter: L, shown: cfg.lower ? small : L, tag: cfg.lower ? L : null, color: COLORS[c], need: needOf(L) }
    })),
  }
}

/**
 * What floats in next.
 *
 *   targets  letters of the monsters that are still hungry
 *   afloat   the things in the air right now ({ word, letter })
 *   avoid    words seen a moment ago (eaten, spat out): not again at once
 *   count    how many things the level keeps in the air
 *   near     the wrong things are mostly the easily mixed-up sound
 *   first    the very first thing for a new monster: the word from its sentence
 *
 * A hungry monster with nothing of its own in the air gets something first,
 * so a fitting thing that floated off is back within a moment. Otherwise
 * about half of what is in the air fits somebody, never more.
 */
export function pickThing({ targets, afloat = [], avoid = [], count = 3, near = false, first = false }, rnd = Math.random) {
  const pick = a => a[Math.floor(rnd() * a.length)]
  const up = new Set(afloat.map(t => t.word))
  // not seen a moment ago; if everything was, the one that is longest ago
  const rested = all => {
    const unseen = all.filter(t => !avoid.includes(t.word))
    if (unseen.length || !all.length) return unseen
    return [all.reduce((a, b) => (avoid.lastIndexOf(b.word) < avoid.lastIndexOf(a.word) ? b : a))]
  }
  const fresh = L => rested(thingsOf(L).filter(t => !up.has(t.word)))
  const inAir = L => afloat.filter(t => t.letter === L).length

  const starving = targets.filter(L => inAir(L) === 0 && fresh(L).length)
  if (starving.length) {
    const L = starving[0]
    const head = thing(L, WORDS[L][0])
    return first && !up.has(head.word) ? head : pick(fresh(L))
  }
  const fits = targets.reduce((n, L) => n + inAir(L), 0)
  const more = targets.filter(L => fresh(L).length)
  if (more.length && fits < Math.ceil(count / 2) && rnd() < 0.45) return pick(fresh(pick(more)))

  // a wrong thing: fair for every hungry monster, not in the air already
  const usable = L => WORDS[L]
    .filter(([w, , never = '']) => never !== '*' && !targets.some(T => never.includes(T)) && !up.has(w))
    .map(w => thing(L, w))
  let letters = []
  if (near && rnd() < 0.65) letters = targets.map(T => PARTNER[T]).filter(L => L && targets.every(T => fair(L, T)))
  letters = letters.filter(L => usable(L).length)
  if (!letters.length) letters = LETTERS.filter(L => targets.every(T => far(L, T)) && usable(L).length)
  if (!letters.length) letters = LETTERS.filter(L => targets.every(T => fair(L, T)) && usable(L).length)
  if (!letters.length) return null
  return pick(rested(usable(pick(letters))))
}

// ─── Layout ───────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** The monster is drawn 120 wide and 132 high; its mouth and eyes are here. */
export const MONSTER_RATIO = 132 / 120
export const MOUTH_Y = 56 / 132
export const EYES_Y = 15 / 132
/** A new monster is this size, a full one 1. */
export const START_SCALE = 0.7
export const scaleAt = (bites, need) => START_SCALE + (1 - START_SCALE) * Math.min(1, bites / need)

/**
 * Where everything is, for a stage of w × h pixels (the game is not scaled:
 * a finger is the same size on every screen).
 *
 *   wide   a screen held sideways: the row of full monsters stands on the
 *          ground at the left, the star counter at the right. Upright, both
 *          are in a strip at the top and the ground belongs to the monster.
 *   disc   the plate a thing hangs on: what a finger has to hit
 *   lanes  heights (middle of balloon and thing) at which things float
 */
export function layoutFor(w, h, { duo = false, slots = 5 } = {}) {
  const wide = w > h * 1.15
  const m = Math.min(w, h)
  // as big as the screen allows: the picture has to be told at a glance
  const disc = clamp(Math.round(Math.min(w * 0.23, h * 0.155)), 72, 108)
  const pic = Math.round(disc * 0.82)
  const bw = Math.round(disc * 0.6), bh = Math.round(disc * 0.7), str = Math.round(disc * 0.13)
  const fw = disc + 8, fh = bh + str + disc
  const mini = clamp(Math.round(m * 0.115), 44, 64)
  // Two monsters on an upright phone fill the ground from edge to edge:
  // they stand a little higher, and what they spit out lands in front of them
  const front = !wide && duo && w < 560 ? Math.round(disc * 0.66) : 0
  const ground = (wide ? 8 : 12) + front
  const top = wide ? 0 : mini + 20
  const hud = clamp(Math.round(m * 0.085), 30, 42)
  const hudW = hud * 2.7

  // the row of full monsters, and the ground left for the hungry ones
  const step = mini + 4
  const rowW = slots * step
  const band = wide ? [8 + rowW + 12, w - hudW - 20] : [0, w]
  const bandW = band[1] - band[0]

  // On a phone held sideways the monster takes more of the height, or its
  // letter would be too small; the things then pass right before its eyes.
  let mh = wide ? Math.min(clamp(h * 0.47, 190, 380), h * 0.66) : clamp(h * 0.36, 150, 320)
  mh = Math.min(mh, (bandW * (duo ? 0.46 : 0.62)) * MONSTER_RATIO)
  mh = Math.round(mh)
  const mw = Math.round(mh / MONSTER_RATIO)
  const mid = w / 2
  const fitsMid = mid - mw / 2 >= band[0] && mid + mw / 2 <= band[1]
  const monX = duo
    ? [band[0] + bandW * 0.26, band[0] + bandW * 0.74]
    : [fitsMid ? mid : band[0] + bandW / 2]

  // the sky: from under the top strip to the monster's eyes
  const skyTop = top + 4
  const skyBottom = Math.max(skyTop + fh + 12, h - ground - mh * 0.8)
  const n = clamp(Math.floor((skyBottom - skyTop) / (fh + 8)), 1, 3)
  const lanes = Array.from({ length: n }, (_, i) => Math.round(skyTop + ((skyBottom - skyTop) * (i + 0.5)) / n))

  const slotAt = i => ({
    x: 8 + step * i + step / 2,
    // the feet of a monster in the row, measured from the top of the stage
    y: wide ? h - ground : 8 + mini * MONSTER_RATIO,
  })

  return {
    w, h, wide, disc, pic, bw, bh, str, fw, fh, mini, ground, front, top, hud, mw, mh, monX, lanes, slotAt, band,
    bob: clamp(Math.round(disc * 0.08), 5, 9),
    /** pixels per second for a level whose things cross in `cross` seconds */
    speed: cross => clamp(w / cross, 30, 130),
    /** lanes take turns: left to right, right to left */
    dir: lane => (lane % 2 === 0 ? 1 : -1),
  }
}

/**
 * Where a spat-out thing lands: on the ground beside its monster, on the
 * side away from the other one, as far out as there is room.
 * `cx` are the middles of the monsters on stage, `i` the one that spat,
 * `n` how many it has spat so far.
 */
export function spitSpot(lay, cx, i, n) {
  const side = cx.length > 1 ? (i === 0 ? -1 : 1) : (n % 2 === 0 ? 1 : -1)
  if (lay.front) {
    // no room beside it: on the grass in front of its feet
    const size = lay.front - 4
    return { x: clamp(cx[i] + side * lay.mw * 0.24, size / 2 + 4, lay.w - size * 0.8), y: lay.h - 6 - size / 2, size, side }
  }
  const size = Math.round(lay.disc * 0.72)
  const edge = cx[i] + side * (lay.mw / 2 + size / 2 + 2)
  const lo = lay.band[0] + size / 2, hi = lay.band[1] - size / 2
  // beside the monster where there is room, otherwise at its feet, at the edge
  const x = clamp(edge, Math.min(lo, hi), Math.max(lo, hi))
  return { x: clamp(x, size / 2 + 2, lay.w - size / 2 - 2), y: lay.h - lay.ground - size / 2, size, side }
}
