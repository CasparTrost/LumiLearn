/**
 * Taschenlampen-Jagd (Schattenrätsel): what hides in which room, and how a
 * level is put together. Pure data and pure functions (tests/unit/schatten.test.js).
 *
 * Every thing is shown in the dark room only as its black outline (its
 * picture with brightness 0) and on the cards in colour. `group` holds
 * things whose outlines look alike (dog, wolf and fox; apple, pear and
 * tomato): low levels keep them apart, high levels put them together on
 * purpose. `move` is how it gets about in the dark:
 *   walk · crawl (low and slow) · hop · roll (round things roll over the
 *   floor) · drive (toy cars) · fly · float (a balloon drifts)
 * `word` is the recorded word Lumi says when it is found (lib/lumiLines.js).
 */

export const THINGS = {
  // Kinderzimmer: toys come alive at night
  '🧸': { name: 'Teddy', word: 'wort/teddy', move: 'walk', group: 'teddy' },
  '🚗': { name: 'Auto', word: 'wort/auto', move: 'drive', group: 'wheels' },
  '🚂': { name: 'Lok', word: 'wort/lok', move: 'drive', group: 'wheels' },
  '🚀': { name: 'Rakete', word: 'wort/rakete', move: 'fly', group: 'air' },
  '✈️': { name: 'Flugzeug', word: 'wort/flugzeug', move: 'fly', group: 'air' },
  '🚁': { name: 'Hubschrauber', word: 'wort/hubschrauber', move: 'fly', group: 'air' },
  '🎈': { name: 'Luftballon', word: 'wort/luftballon', move: 'float', group: 'balloon' },
  '🦕': { name: 'Dino', word: 'wort/dino', move: 'walk', group: 'dino' },
  '🦖': { name: 'T-Rex', word: 'wort/t-rex', move: 'walk', group: 'dino' },
  '🐉': { name: 'Drache', word: 'wort/drache', move: 'walk', group: 'dino' },
  // Küche: fruit and vegetables roll off the table
  '🍎': { name: 'Apfel', word: 'wort/apfel', move: 'roll', group: 'round' },
  '🍐': { name: 'Birne', word: 'wort/birne', move: 'roll', group: 'round' },
  '🍊': { name: 'Orange', word: 'wort/orange', move: 'roll', group: 'round' },
  '🍅': { name: 'Tomate', word: 'wort/tomate', move: 'roll', group: 'round' },
  '🧅': { name: 'Zwiebel', word: 'wort/zwiebel', move: 'roll', group: 'round' },
  '🍋': { name: 'Zitrone', word: 'wort/zitrone', move: 'roll', group: 'oval' },
  '🥚': { name: 'Ei', word: 'wort/ei', move: 'roll', group: 'oval' },
  '🍌': { name: 'Banane', word: 'wort/banane', move: 'hop', group: 'long' },
  '🥕': { name: 'Möhre', word: 'wort/moehre', move: 'hop', group: 'long' },
  '🍆': { name: 'Aubergine', word: 'wort/aubergine', move: 'hop', group: 'long' },
  '🥒': { name: 'Gurke', word: 'wort/gurke', move: 'hop', group: 'long' },
  '🍄': { name: 'Pilz', word: 'wort/pilz', move: 'hop', group: 'pilz' },
  '🍇': { name: 'Traube', word: 'wort/traube', move: 'hop', group: 'traube' },
  // Wohnzimmer: animals that sneaked in
  '🐕': { name: 'Hund', word: 'wort/hund', move: 'walk', group: 'dog' },
  '🐺': { name: 'Wolf', word: 'wort/wolf', move: 'walk', group: 'dog' },
  '🦊': { name: 'Fuchs', word: 'wort/fuchs', move: 'walk', group: 'dog' },
  '🐇': { name: 'Hase', word: 'wort/hase', move: 'hop', group: 'hase' },
  '🐿️': { name: 'Eichhörnchen', word: 'wort/eichhoernchen', move: 'hop', group: 'eich' },
  '🐹': { name: 'Hamster', word: 'wort/hamster', move: 'crawl', group: 'rodent' },
  '🐭': { name: 'Maus', word: 'wort/maus', move: 'crawl', group: 'rodent' },
  '🐢': { name: 'Schildkröte', word: 'wort/schildkroete', move: 'crawl', group: 'shell' },
  '🐌': { name: 'Schnecke', word: 'wort/schnecke', move: 'crawl', group: 'shell' },
  '🦔': { name: 'Igel', word: 'wort/igel', move: 'crawl', group: 'igel' },
  '🐸': { name: 'Frosch', word: 'wort/frosch', move: 'hop', group: 'frosch' },
  // Dachboden: what flutters and crawls under the roof
  '🦇': { name: 'Fledermaus', word: 'wort/fledermaus', move: 'fly', group: 'wings' },
  '🦋': { name: 'Schmetterling', word: 'wort/schmetterling', move: 'fly', group: 'wings' },
  '🐝': { name: 'Biene', word: 'wort/biene', move: 'fly', group: 'biene' },
  '🦉': { name: 'Eule', word: 'wort/eule', move: 'fly', group: 'eule' },
  '🕷️': { name: 'Spinne', word: 'wort/spinne', move: 'crawl', group: 'bugs' },
  '🐜': { name: 'Ameise', word: 'wort/ameise', move: 'crawl', group: 'bugs' },
  '🐞': { name: 'Käfer', word: 'wort/kaefer', move: 'crawl', group: 'bugs' },
  '🐛': { name: 'Raupe', word: 'wort/raupe', move: 'crawl', group: 'raupe' },
  // Stall: the farm animals' barn
  '🐄': { name: 'Kuh', word: 'wort/kuh', move: 'walk', group: 'horned' },
  '🐐': { name: 'Ziege', word: 'wort/ziege', move: 'walk', group: 'horned' },
  '🐎': { name: 'Pferd', word: 'wort/pferd', move: 'walk', group: 'horse' },
  '🦄': { name: 'Einhorn', word: 'wort/einhorn', move: 'walk', group: 'horse' },
  '🐖': { name: 'Schwein', word: 'wort/schwein', move: 'walk', group: 'plump' },
  '🐑': { name: 'Schaf', word: 'wort/schaf', move: 'walk', group: 'plump' },
  '🐓': { name: 'Hahn', word: 'wort/hahn', move: 'walk', group: 'hens' },
  '🐔': { name: 'Huhn', word: 'wort/huhn', move: 'walk', group: 'hens' },
  '🦆': { name: 'Ente', word: 'wort/ente', move: 'walk', group: 'ente' },
  '🐤': { name: 'Küken', word: 'wort/kueken', move: 'hop', group: 'kueken' },
}

/** The joke shadow: no card fits it. Caught by the light it meows and runs. */
export const CAT = '🐱'

/** The rooms; each has its own furniture (schatten/Room.jsx) and its own inhabitants. */
export const ROOMS = {
  kinderzimmer: ['🧸', '🚗', '🚂', '🚀', '✈️', '🚁', '🎈', '🦕', '🦖', '🐉'],
  kueche: ['🍎', '🍐', '🍊', '🍅', '🧅', '🍋', '🥚', '🍌', '🥕', '🍆', '🥒', '🍄', '🍇'],
  wohnzimmer: ['🐕', '🐺', '🦊', '🐇', '🐿️', '🐹', '🐭', '🐢', '🐌', '🦔', '🐸'],
  dachboden: ['🦇', '🦋', '🐝', '🦉', '🕷️', '🐜', '🐞', '🐛', '🐭'],
  stall: ['🐄', '🐐', '🐎', '🦄', '🐖', '🐑', '🐓', '🐔', '🦆', '🐤'],
}
export const ROOM_IDS = Object.keys(ROOMS)

/**
 * The ten levels. n: shadows in a room · extra: cards that fit none ·
 * rooms: rooms in the level · beam: size of the light (share of the
 * largest) · speed: how fast they move · eyes: how often their eyes glow
 * in the dark (1 always … 0.2 now and then) · alike: 0 outlines far apart,
 * 1 one look-alike in the room or among the cards, 2 look-alikes on
 * purpose · mirror: a caught shadow keeps facing the way it ran (lower
 * levels turn it to face like its card) · tilt: degrees a caught shadow
 * is tipped over · cat: chance of the cat in a room · hold: seconds a
 * shadow stays lit and still after the light has left it.
 */
export const LEVELS = [
  { n: 3, extra: 0, rooms: 3, beam: 1.0, speed: 0.55, eyes: 1, alike: 0, mirror: false, tilt: 0, cat: 0, hold: 7 },
  { n: 3, extra: 1, rooms: 3, beam: 0.95, speed: 0.65, eyes: 1, alike: 0, mirror: false, tilt: 0, cat: 0.5, hold: 6.5 },
  { n: 3, extra: 1, rooms: 3, beam: 0.9, speed: 0.75, eyes: 0.8, alike: 0, mirror: false, tilt: 0, cat: 0.5, hold: 6 },
  { n: 4, extra: 1, rooms: 3, beam: 0.86, speed: 0.85, eyes: 0.7, alike: 0, mirror: false, tilt: 0, cat: 0.5, hold: 6 },
  { n: 4, extra: 2, rooms: 3, beam: 0.82, speed: 0.95, eyes: 0.6, alike: 1, mirror: false, tilt: 0, cat: 0.5, hold: 5.5 },
  { n: 4, extra: 2, rooms: 3, beam: 0.78, speed: 1.05, eyes: 0.5, alike: 1, mirror: false, tilt: 0, cat: 0.6, hold: 5 },
  { n: 4, extra: 2, rooms: 4, beam: 0.74, speed: 1.15, eyes: 0.4, alike: 2, mirror: true, tilt: 0, cat: 0.6, hold: 5 },
  { n: 5, extra: 2, rooms: 3, beam: 0.7, speed: 1.25, eyes: 0.35, alike: 2, mirror: true, tilt: 0, cat: 0.6, hold: 4.5 },
  { n: 5, extra: 2, rooms: 3, beam: 0.66, speed: 1.35, eyes: 0.3, alike: 2, mirror: true, tilt: 25, cat: 0.6, hold: 4.5 },
  { n: 5, extra: 2, rooms: 4, beam: 0.62, speed: 1.45, eyes: 0.25, alike: 2, mirror: true, tilt: 35, cat: 0.6, hold: 4 },
]

export const levelConfig = level => LEVELS[Math.max(1, Math.min(10, Math.round(level) || 1)) - 1]

const shuffle = (list, rnd) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const groupOf = e => THINGS[e].group

/**
 * One room: which shadows hide in it and which cards lie below.
 * `taken`: things already used in this level (no thing twice in a level).
 */
export function planRoom(theme, cfg, taken = new Set(), rnd = Math.random) {
  const pool = shuffle(ROOMS[theme].filter(e => !taken.has(e)), rnd)
  const byGroup = new Map()
  for (const e of pool) byGroup.set(groupOf(e), [...(byGroup.get(groupOf(e)) ?? []), e])
  const groups = shuffle([...byGroup.keys()], rnd)
  const shadows = []
  const extras = []
  const used = new Set()          // groups among the shadows
  const add = (list, e) => { list.push(e); used.add(groupOf(e)) }

  if (cfg.alike >= 2) {
    // look-alikes on purpose: pairs of one group among the shadows, and
    // the extra cards from the same groups
    for (const g of groups.filter(g => byGroup.get(g).length >= 2)) {
      for (const e of byGroup.get(g)) {
        if (shadows.length < cfg.n && shadows.filter(s => groupOf(s) === g).length < 2) add(shadows, e)
      }
      if (shadows.length >= cfg.n) break
    }
  }
  // the rest of the shadows: each from a group not used yet, as far as there are
  for (const g of groups) {
    if (shadows.length >= cfg.n) break
    if (!used.has(g)) add(shadows, byGroup.get(g).find(e => !shadows.includes(e)))
  }
  for (const e of pool) { if (shadows.length >= cfg.n) break; if (!shadows.includes(e)) add(shadows, e) }

  const free = pool.filter(e => !shadows.includes(e))
  const alikeOf = free.filter(e => used.has(groupOf(e)))
  const farOf = free.filter(e => !used.has(groupOf(e)))
  // alike 0: the extra cards look like none of the shadows; 1: one of them
  // does; 2: as many as there are
  const wantAlike = cfg.alike === 0 ? 0 : cfg.alike === 1 ? 1 : cfg.extra
  for (const e of alikeOf) if (extras.length < Math.min(wantAlike, cfg.extra)) extras.push(e)
  for (const e of [...farOf, ...alikeOf]) if (extras.length < cfg.extra && !extras.includes(e)) extras.push(e)

  return { theme, shadows, cards: shuffle([...shadows, ...extras], rnd), extras }
}

/** A whole level: its rooms in order, each with its shadows, cards and maybe the cat. */
export function planLevel(level, rnd = Math.random) {
  const cfg = levelConfig(level)
  const themes = shuffle(ROOM_IDS, rnd).slice(0, cfg.rooms)
  const taken = new Set()
  return themes.map((theme, i) => {
    const room = planRoom(theme, cfg, taken, rnd)
    for (const e of [...room.shadows, ...room.extras]) taken.add(e)
    // never in the first room of a level: there the game is learned
    return { ...room, cat: i > 0 && rnd() < cfg.cat }
  })
}

/** Tasks in a level: one per shadow. */
export const tasksIn = plan => plan.reduce((n, r) => n + r.shadows.length, 0)
