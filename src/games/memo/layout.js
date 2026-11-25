/**
 * Memo-Welt: levels and the board's layout.
 */

// Picture pairs by theme, one theme per level. Every picture has its name
// (said when the card is turned over). No present among them: every card's
// back is a present, so a 🎁 face was a card that looked face-down.
const ANIMALS = [
  ['🐕','Hund'], ['🐱','Katze'], ['🐟','Fisch'], ['🦋','Schmetterling'],
  ['🐸','Frosch'], ['🐮','Kuh'], ['🐷','Schwein'], ['🐑','Schaf'],
  ['🐔','Huhn'], ['🐧','Pinguin'], ['🦉','Eule'], ['🐝','Biene'],
  ['🐢','Schildkröte'], ['🐘','Elefant'], ['🦁','Löwe'], ['🐒','Affe'],
  ['🐰','Hase'], ['🐭','Maus'], ['🦆','Ente'], ['🐌','Schnecke'],
]
const FOOD = [
  ['🍎','Apfel'], ['🍌','Banane'], ['🍓','Erdbeere'], ['🍇','Traube'],
  ['🍐','Birne'], ['🍒','Kirsche'], ['🥕','Möhre'], ['🍕','Pizza'],
  ['🍦','Eis'], ['🍪','Keks'], ['🥨','Brezel'], ['🍋','Zitrone'],
  ['🥒','Gurke'], ['🍅','Tomate'], ['🥚','Ei'], ['🍞','Brot'],
]
const THINGS = [
  ['🚗','Auto'], ['🚂','Lok'], ['✈️','Flugzeug'], ['🚀','Rakete'],
  ['🚁','Hubschrauber'], ['🚲','Fahrrad'], ['⛵','Segelboot'], ['🚜','Traktor'],
  ['🚌','Bus'], ['🛴','Roller'], ['🎈','Luftballon'], ['⚽','Ball'],
  ['🧸','Teddy'], ['⭐','Stern'], ['🌙','Mond'],
  ['☂️','Schirm'], ['🔑','Schlüssel'], ['🎸','Gitarre'], ['🥁','Trommel'],
  ['👑','Krone'], ['🏠','Haus'],
]
// Every level has pairs of two the same: a pair must be seen at a glance.
// Harder by more cards, and by one theme per board, whose pictures look
// more alike than a mixed board's.
const MIXED = [...ANIMALS, ...FOOD, ...THINGS]
export const PICTURE_POOLS = { 1: ANIMALS, 2: FOOD, 3: THINGS, 4: MIXED, 5: MIXED, 6: ANIMALS, 7: MIXED, 8: THINGS, 9: MIXED, 10: MIXED }
export const ALL_PICTURES = MIXED

/**
 * What a level is.
 *   1–2   alone, to learn the game: 4 pairs
 *   3–4   against Lumi, 6 pairs
 *   5–10  against Lumi with a joker card, 8, 10, 12 pairs
 * The preview shows every card at the start, half a second per card (Lumi
 * sleeps through it: it is the child's head start). From level 7 it is
 * shorter, a third of a second per card, so the top levels are a fair
 * game against a Lumi who remembers more.
 */
export function levelConfig(level) {
  const pairs = level <= 2 ? 4 : level <= 4 ? 6 : level <= 6 ? 8 : level <= 8 ? 10 : 12
  const versus = level >= 3
  const joker = level >= 5
  const cards = pairs * 2 + (joker ? 1 : 0)
  const preview = level >= 7
    ? Math.round(Math.max(5, cards / 3))
    : Math.round(Math.max(4, 1 + cards * 0.5))
  return { level, pairs, versus, joker, cards, preview, pool: PICTURE_POOLS[level] ?? MIXED }
}

const shuffleWith = (a, rng) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** The cards of a level, shuffled; a card's id is its place on the board. */
export function buildCards(cfg, rng = Math.random) {
  const chosen = shuffleWith(cfg.pool, rng).slice(0, cfg.pairs)
  const flat = chosen.flatMap(([emoji, name], i) => [0, 1].map(() => ({ emoji, name, pairKey: `p${i}` })))
  if (cfg.joker) flat.push({ emoji: '👀', name: null, pairKey: 'joker', joker: true })
  return shuffleWith(flat, rng).map((c, id) => ({ id, ...c, flipped: false, matched: false, gone: false }))
}

/**
 * The grid that gives `n` cards the largest size in a w × h room. A
 * landscape phone gets 8 × 2 instead of 4 × 4 (53 px cards in the middle
 * of an empty wide screen before). The last row is centred.
 */
export function bestGrid(n, w, h, gap, maxS = 170) {
  let best = null
  for (let cols = 1; cols <= n; cols++) {
    const rows = Math.ceil(n / cols)
    if ((rows - 1) * cols >= n) continue
    const s = Math.floor(Math.min((w - gap * (cols - 1)) / cols, (h - gap * (rows - 1)) / rows, maxS))
    const empty = rows * cols - n
    if (!best || s > best.s + 2 || (s >= best.s - 2 && empty < best.empty)) best = { cols, rows, s, empty }
  }
  return { ...best, s: Math.max(24, best.s) }
}

/** Where card `i` of `n` sits in the grid, from the grid's top left corner. */
export function cellPos(i, n, { cols, rows, s }, gap) {
  const r = Math.floor(i / cols), c = i % cols
  const inRow = r === rows - 1 ? n - cols * (rows - 1) : cols
  const shift = ((cols - inRow) * (s + gap)) / 2
  return { x: shift + c * (s + gap), y: r * (s + gap) }
}

/**
 * The stars of a level.
 *
 * Alone (levels 1–2) as always: perfect play is one try per pair, and the
 * slack grows with the board (3 stars up to 1.5 tries per pair, 2 up to
 * 2.5).
 *
 * Against Lumi the same idea, pairs against tries, but only the child's
 * own tries count, and only the tries it could have got right: a try is
 * counted against the child when its second card was wrong although the
 * first card's partner had been face up before (turned by the child or
 * by Lumi, or shown by the child's joker), or although that second card
 * itself had been (the child could know it was not the one). A guess at
 * cards nobody has seen yet is no mistake, and the pairs Lumi takes are
 * never counted:
 * a child who forgets nothing gets three stars even if Lumi wins.
 *   3 stars: at most a quarter of the pairs forgotten (at least 1)
 *   2 stars: at most 60 % (at least 2)
 */
export function starsFor({ versus, pairs, tries, forgotten }) {
  if (!versus) return tries <= Math.round(pairs * 1.5) ? 3 : tries <= Math.round(pairs * 2.5) ? 2 : 1
  return forgotten <= Math.max(1, Math.round(pairs * 0.25)) ? 3
    : forgotten <= Math.max(2, Math.round(pairs * 0.6)) ? 2 : 1
}
