/**
 * Bruno fängt — everything of the game that needs no screen: who catches
 * what, how many per level, what falls next and where, and what a press on
 * "Mampf" means. Kept apart from the drawing so it can be tested
 * (tests/unit/brunoFaengt.test.js).
 */

// Only fruit that grows on a tree and is one thing in its picture (no
// cherry pairs, no melon with a slice): every picture counts as one.
// `look`: fruit of the same look is never the "other kind" of each other.
export const FRUITS = {
  apfel:    { art: '🍎', name: 'Apfel',    many: 'Äpfel',     look: 'round' },
  birne:    { art: '🍐', name: 'Birne',    many: 'Birnen',    look: 'green' },
  orange:   { art: '🍊', name: 'Orange',   many: 'Orangen',   look: 'round' },
  zitrone:  { art: '🍋', name: 'Zitrone',  many: 'Zitronen',  look: 'yellow' },
  pfirsich: { art: '🍑', name: 'Pfirsich', many: 'Pfirsiche', look: 'round' },
  banane:   { art: '🍌', name: 'Banane',   many: 'Bananen',   look: 'yellow' },
  kastanie: { art: '🌰', name: 'Kastanie', many: 'Kastanien', look: 'brown' },
}

// Who catches. Bruno opens every level; the others follow in a new order.
// Each eats two kinds a child would believe it eats, of two different
// looks: in the levels with two amounts the second kind is the animal's
// other food. Nobody eats lemons; they only fall as the kind not wanted.
export const EATERS = [
  { art: '🐻', label: 'Bruno, der Bär', fruits: ['apfel', 'birne'] },
  { art: '🐒', label: 'Affe',           fruits: ['banane', 'orange'] },
  { art: '🐿️', label: 'Eichhörnchen',   fruits: ['kastanie', 'apfel'] },
  { art: '🦔', label: 'Igel',           fruits: ['birne', 'apfel'] },
  { art: '🐘', label: 'Elefant',        fruits: ['orange', 'banane'] },
  { art: '🐷', label: 'Schwein',        fruits: ['pfirsich', 'kastanie'] },
  { art: '🦛', label: 'Nilpferd',       fruits: ['apfel', 'banane'] },
  { art: '🐭', label: 'Maus',           fruits: ['kastanie', 'birne'] },
  { art: '🐰', label: 'Hase',           fruits: ['apfel', 'birne'] },
  { art: '🐼', label: 'Panda',          fruits: ['apfel', 'banane'] },
]

// Content colours of the numerals 0–10 (the ink outline keeps even the
// light ones readable); the sign's dots and the count use the same.
export const NUM_COLORS = ['#9AB0CC', '#FF6B5B', '#FF9F43', '#FFC93C', '#5CC45A', '#4AA3FF', '#8E6CF0', '#FD79A8', '#2FB8A6', '#E8663A', '#3E7BD6']

export function shuffle(list, rnd = Math.random) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * The ten levels.
 *   mode   'nests': the basket has one hollow per thing wanted and is eaten
 *          when full · 'free': the child decides when it is enough and
 *          presses "Mampf" · 'pair': two amounts at once, also with "Mampf"
 *   first  the amount of the first task; `rest` follow in a new order
 *   fall   seconds from the leaves to the basket
 *   gap    seconds between two things; null = the next one only comes when
 *          the one before is caught or has landed (in levels 2 and 3 the gap
 *          is about as long as the fall: mostly one thing in the air)
 *   reach  how far from the catcher things may fall, as a share of the width
 *   safe   chance that a thing avoids the catcher while the basket is right
 *          (so standing still to press "Mampf" is safe in the first of these levels)
 *   other  share of the kind that is not wanted (bounces off)
 *   boot   share of old boots
 */
export const LEVELS = [
  { mode: 'nests', first: 1, rest: [2, 3, 2, 3],    fall: 4.0, gap: null, reach: 0.4, safe: 1,   other: 0,    boot: 0 },
  { mode: 'nests', first: 2, rest: [1, 3, 4, 4],    fall: 3.7, gap: 3.8,  reach: 0.5, safe: 1,   other: 0,    boot: 0 },
  { mode: 'nests', first: 3, rest: [1, 2, 4, 5, 5], fall: 3.4, gap: 3.0,  reach: 0.6, safe: 1,   other: 0,    boot: 0 },
  { mode: 'free',  first: 2, rest: [3, 4, 5, 6],    fall: 3.4, gap: 2.4,  reach: 0.6, safe: 1,   other: 0,    boot: 0 },
  { mode: 'free',  first: 3, rest: [4, 5, 6, 7, 7], fall: 3.1, gap: 1.8,  reach: 0.7, safe: 0.6, other: 0,    boot: 0 },
  { mode: 'free',  first: 5, rest: [7, 8, 9, 10],   fall: 2.9, gap: 1.6,  reach: 0.8, safe: 0.3, other: 0,    boot: 0 },
  { mode: 'free',  first: 3, rest: [2, 4, 5, 6],    fall: 3.0, gap: 1.5,  reach: 0.8, safe: 0.3, other: 0.33, boot: 0.08 },
  { mode: 'free',  first: 4, rest: [3, 5, 6, 8],    fall: 2.7, gap: 1.3,  reach: 0.9, safe: 0,   other: 0.33, boot: 0.12 },
  { mode: 'pair',  first: [1, 2], rest: [[2, 1], [2, 3], [3, 1], [3, 2]],         fall: 2.7, gap: 1.5, reach: 0.9, safe: 0, other: 0, boot: 0.06 },
  { mode: 'pair',  first: [2, 3], rest: [[3, 2], [2, 4], [4, 3], [3, 5], [5, 2]], fall: 2.4, gap: 1.3, reach: 1,   safe: 0, other: 0, boot: 0.1 },
]

export const levelConfig = level => LEVELS[Math.max(1, Math.min(LEVELS.length, Math.round(level) || 1)) - 1]

// A kind that cannot be taken for `key`, preferably one of `from`
function contrastFor(key, rnd, from = []) {
  const ok = k => k !== key && FRUITS[k].look !== FRUITS[key].look
  const own = from.filter(ok)
  const pool = own.length ? own : Object.keys(FRUITS).filter(ok)
  return pool[Math.floor(rnd() * pool.length)]
}
// A kind the animal does not eat (it falls, and is not wanted)
const notEatenBy = eater => Object.keys(FRUITS).filter(k => !eater.fruits.includes(k))

/**
 * The tasks of a level: who catches, how many of what.
 * → [{ eater, wants: [{ n, fruit, color }], other }]
 *   wants  one entry, or two in the 'pair' levels
 *   other  a second kind that falls but is not wanted (levels 7 and 8), or null
 */
export function tasksFor(level, rnd = Math.random) {
  const cfg = levelConfig(level)
  const amounts = [cfg.first, ...shuffle(cfg.rest, rnd)].map(a => (Array.isArray(a) ? a : [a]))
  const [bruno, ...friends] = EATERS
  const eaters = [bruno, ...shuffle(friends, rnd)]
  return amounts.map((ns, i) => {
    const eater = eaters[i % eaters.length]
    // Bruno eats apples; the others take one of theirs
    const fruit = i === 0 ? eater.fruits[0] : eater.fruits[Math.floor(rnd() * eater.fruits.length)]
    // two amounts: the animal's other food · a kind not wanted: one it does not eat
    const second = ns.length > 1 ? contrastFor(fruit, rnd, eater.fruits)
      : cfg.other > 0 ? contrastFor(fruit, rnd, notEatenBy(eater)) : null
    const kinds = [fruit, second]
    return {
      eater,
      wants: ns.map((n, k) => ({ n, fruit: kinds[k], color: NUM_COLORS[n] })),
      other: ns.length === 1 && cfg.other > 0 ? second : null,
    }
  })
}

/**
 * How many things of one kind the basket takes before more bounce off. A
 * half of the two-kind basket holds two rows of three: a third row would
 * stand over the rim and hide the animal.
 */
export const capacity = (task, k) => (task.wants.length > 1 ? Math.min(6, task.wants[k].n + 4) : Math.min(15, task.wants[k].n + 5))

/** True when every kind in the basket is exactly what the sign says. */
export const isRight = (counts, wants) => wants.every((w, k) => (counts[k] ?? 0) === w.n)

/**
 * A press on "Mampf": per kind how many are missing and how many are too
 * many, and what that makes of the whole basket.
 *   'right'  eat · 'few'  go on catching · 'many'  the extra ones roll
 *   out, then eat · 'mixed'  (two kinds) the extra ones roll out, go on catching
 */
export function judge(counts, wants) {
  const kinds = wants.map((w, k) => {
    const c = counts[k] ?? 0
    return { need: w.n, have: c, missing: Math.max(0, w.n - c), extra: Math.max(0, c - w.n) }
  })
  const few = kinds.some(k => k.missing > 0), many = kinds.some(k => k.extra > 0)
  return { kinds, verdict: few && many ? 'mixed' : few ? 'few' : many ? 'many' : 'right' }
}

/**
 * What falls next.
 *   st: { counts, wants, hasOther, sinceWanted, goldDone, first }
 * → { kind: 'want' | 'other' | 'boot', which, gold }
 * A wanted thing is never more than two drops away, so nobody waits; of two
 * wanted kinds the one that is further from its number comes more often.
 */
export function nextDrop(cfg, st, rnd = Math.random) {
  const { counts, wants } = st
  const patient = st.sinceWanted < 2 && !st.first
  if (patient && cfg.boot > 0 && rnd() < cfg.boot) return { kind: 'boot', which: 0, gold: false }
  if (patient && st.hasOther && rnd() < cfg.other) return { kind: 'other', which: 0, gold: false }
  let which = 0
  if (wants.length > 1) {
    const lack = wants.map((w, k) => Math.max(0, w.n - (counts[k] ?? 0)))
    const sum = lack[0] + lack[1]
    which = sum === 0 ? (rnd() < 0.5 ? 0 : 1) : rnd() < (lack[0] + 0.35) / (sum + 0.7) ? 0 : 1
  }
  // a golden one now and then: at most one per task, never the very first thing
  const gold = !st.first && !st.goldDone && rnd() < 0.14
  return { kind: 'want', which, gold }
}

/**
 * Where the next thing falls: inside [lo, hi], within reach of the catcher
 * at `bx`, away from things already in the air at `taken` — and, with
 * `avoid`, not onto the basket (`half` is half its width). With `spread`
 * anywhere in [lo, hi] (one tree of two: its own half of the field).
 */
export function dropX({ lo, hi, bx, reach, width, taken = [], avoid = false, half = 0, onto = false, spread = false }, rnd = Math.random) {
  const clamp = v => Math.max(lo, Math.min(hi, v))
  if (onto) return clamp(bx)
  let best = null
  for (let i = 0; i < 8; i++) {
    let x = spread ? lo + rnd() * (hi - lo) : clamp(bx + (rnd() * 2 - 1) * reach * width)
    if (avoid) {
      const gapWanted = half + 44
      if (Math.abs(x - bx) < gapWanted) {
        // to the side with more room
        const side = bx - lo > hi - bx ? -1 : 1
        x = clamp(bx + side * (gapWanted + rnd() * reach * width * 0.5))
        if (Math.abs(x - bx) < gapWanted) x = clamp(bx - side * gapWanted)
      }
    }
    const room = Math.min(400, ...taken.map(t => Math.abs(t - x)))
    if (!best || room > best.room) best = { x, room }
    if (room >= 90) break
  }
  return best.x
}

/**
 * The fall speed follows the child: a little faster after a task done
 * right on the first try, clearly slower after a miss.
 */
export function paceAfter(pace, event) {
  if (event === 'right') return Math.min(1.25, pace + 0.05)
  if (event === 'miss') return Math.max(0.75, pace - 0.12)
  return pace
}

/**
 * The place of thing number `i` in a basket (or on the board): rows of
 * `cols` from the bottom up, centred.
 * → { x, row }: x from the middle in cells, row 0 = the bottom one
 */
export function slotOf(i, cols) {
  return { x: (i % cols) - (cols - 1) / 2, row: Math.floor(i / cols) }
}

/** Columns of the basket for a task (a row of five shows "five and some more"). */
export function colsFor(task, nests) {
  if (task.wants.length > 1) return 3
  return nests ? Math.min(5, Math.max(1, task.wants[0].n)) : 5
}
