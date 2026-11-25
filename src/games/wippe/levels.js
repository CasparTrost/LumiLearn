// Wippe-Katapult: what each level asks for, and what a throw does. Plain
// data and numbers, no React, so it can be tested (tests/unit/wippe.test.js).
//
// Heights are counted in steps of the tree's ruler: 0 is the flyer sitting
// on the seesaw, TOP the highest step on the screen. A thing that lands on
// the seesaw sends the flyer exactly as many steps up as it weighs, so the
// weight of a thing and the height it reaches are the same number.

export const TOP = 10
export const TASKS = 6
/** Up to this much, a thing is too light to push the seesaw down: it bounces off. */
export const BOUNCES = 2
/** At most this many parcels fit on the end of the plank (levels 7–8). */
export const STACK_MAX = 3

/** Who flies, and what it wants. Taking turns, the mouse first. */
export const FLYERS = [
  { art: '🐭', label: 'Maus', treat: '🧀', treatLabel: 'Käse' },
  { art: '🐸', label: 'Frosch', treat: '🪰', treatLabel: 'Fliege' },
  { art: '🐤', label: 'Küken', treat: '🍒', treatLabel: 'Kirsche' },
  { art: '🐿️', label: 'Eichhörnchen', treat: '🌰', treatLabel: 'Kastanie' },
]

// Things to throw: [picture, name, weight in steps]. Every thing weighs the
// same in every level: light things send the flyer two steps up, small ones
// three (only in level 9), middle ones five, heavy ones eight.
const LIGHT = [['🪶', 'Feder', 2], ['🍃', 'Blatt', 2], ['🎈', 'Luftballon', 2], ['🧽', 'Schwamm', 2]]
const SMALL = [['🧸', 'Teddy', 3], ['🧦', 'Socken', 3], ['🍌', 'Banane', 3], ['🍓', 'Erdbeere', 3]]
const MIDDLE = [['🍎', 'Apfel', 5], ['🍐', 'Birne', 5], ['🥔', 'Kartoffel', 5], ['⚽', 'Ball', 5], ['🥥', 'Kokosnuss', 5]]
const HEAVY = [['🪨', 'Stein', 8], ['🧱', 'Ziegelstein', 8], ['🔨', 'Hammer', 8], ['🪵', 'Holzklotz', 8], ['🎃', 'Kürbis', 8], ['📚', 'Bücherstapel', 8]]

// Levels 5–6: drawn the same size, and in each set two that look alike but
// do not weigh the same (a sponge and a brick, a balloon and an apple, a
// potato and a stone). The size of a picture tells nothing any more.
const LOOKALIKE = [
  ['🧽', '🥔', '🧱'],
  ['🎈', '🍎', '🪨'],
  ['🎈', '⚽', '🎃'],
  ['🪶', '🥔', '🪨'],
  ['🧽', '⚽', '🧱'],
  ['🍃', '🍐', '🪵'],
  ['🎈', '🥥', '📚'],
]

/** Every thing that can be thrown: [picture, name, weight in steps]. */
export const THINGS = [...LIGHT, ...SMALL, ...MIDDLE, ...HEAVY]
const ALL = THINGS
const byArt = e => ALL.find(t => t[0] === e)
const CLASS = { light: LIGHT, small: SMALL, middle: MIDDLE, heavy: HEAVY }

export function modeFor(level) {
  if (level <= 6) return 'throw'
  if (level <= 8) return 'sum'
  if (level === 9) return 'order'
  return 'balance'
}

/** Where the treat hangs compared with the thing that reaches it. */
export function verdict(height, target) {
  return height === target ? 'right' : height < target ? 'low' : 'high'
}

const shuffle = (list, rnd) => {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
const pickFrom = (list, rnd) => list[Math.floor(rnd() * list.length)]
const between = (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1))

let seq = 0
const thing = ([e, label, w], extra = {}) => ({ id: `t${++seq}`, e, label, w, ...extra })

// Pictures drawn bigger the heavier the thing is (levels 1–4: the size is a
// fair clue there); from level 5 all are drawn the same.
const SCALE = { light: 0.82, middle: 0.94, heavy: 1.08 }
const classOf = w => (w <= BOUNCES ? 'light' : w <= 3 ? 'small' : w <= 5 ? 'middle' : 'heavy')

// Each set of the level once (in a mixed order), no picture twice in a row
function pool(rnd) {
  const used = new Set()
  return (cls) => {
    const free = CLASS[cls].filter(t => !used.has(t[0]))
    const t = pickFrom(free.length ? free : CLASS[cls], rnd)
    used.add(t[0])
    return t
  }
}

// What is wanted in each of the six tasks: the class of the thing that
// reaches the treat, and which classes lie on the ground.
const THROW_PLAN = {
  1: () => Array.from({ length: TASKS }, () => ({ classes: ['light', 'heavy'], want: 'heavy' })),
  2: rnd => shuffle([
    { classes: ['light', 'heavy'], want: 'heavy' },
    { classes: ['middle', 'heavy'], want: 'heavy' },
    { classes: ['middle', 'heavy'], want: 'heavy' },
    { classes: ['light', 'middle'], want: 'middle' },
    { classes: ['light', 'middle'], want: 'middle' },
    { classes: ['middle', 'heavy'], want: 'heavy' },
  ], rnd),
  3: rnd => [{ classes: ['light', 'middle', 'heavy'], want: 'heavy' }, ...shuffle(['heavy', 'heavy', 'heavy', 'middle', 'middle'], rnd)
    .map(want => ({ classes: ['light', 'middle', 'heavy'], want }))],
  4: rnd => shuffle(['heavy', 'heavy', 'middle', 'middle', 'light', 'light'], rnd).map(want => ({ classes: ['light', 'middle', 'heavy'], want })),
}

function throwTasks(level, rnd) {
  const next = pool(rnd)
  if (level <= 4) {
    return THROW_PLAN[level](rnd).map((p, i) => {
      const things = shuffle(p.classes.map(cls => thing(next(cls), { scale: SCALE[cls] })), rnd)
      const target = things.find(t => classOf(t.w) === p.want).w
      return { mode: 'throw', flyer: FLYERS[i % FLYERS.length], target, things }
    })
  }
  // levels 5–6: look-alike sets, the same size; level 6 wants the light and
  // the middle one more often (the heavy one looks right and overshoots)
  const sets = shuffle(LOOKALIKE, rnd).slice(0, TASKS)
  const wants = level === 5 ? shuffle([0, 1, 2, 0, 1, 2], rnd) : shuffle([0, 0, 1, 1, 1, 2], rnd)
  return sets.map((set, i) => {
    const things = shuffle(set.map(e => thing(byArt(e), { scale: 1 })), rnd)
    const target = byArt(set[wants[i]])[2]
    return { mode: 'throw', flyer: FLYERS[i % FLYERS.length], target, things }
  })
}

// ── Levels 7–8: parcels with numbers, the first sums ─────────────────────

/**
 * Four parcels and the height of the treat. No parcel alone reaches it;
 * two (level 7) or two or three (level 8) together do, and never more than
 * fit on the plank.
 */
export function sumTask(level, rnd, flyer) {
  for (let tries = 0; tries < 200; tries++) {
    const target = level === 7 ? between(3, 6, rnd) : between(6, 10, rnd)
    const maxPart = level === 7 ? 4 : 6
    const parts = level === 8 && rnd() < 0.5 && target >= 6 ? 3 : 2
    // the parcels that make it
    const sol = []
    let left = target
    for (let k = parts; k > 1; k--) {
      const hi = Math.min(maxPart, left - (k - 1))
      const lo = Math.max(1, left - maxPart * (k - 1))
      if (lo > hi) break
      const v = between(lo, hi, rnd)
      sol.push(v)
      left -= v
    }
    sol.push(left)
    if (sol.length !== parts || sol.some(v => v < 1 || v > maxPart || v >= target)) continue
    // the others: no parcel equals the target on its own
    // the others: no parcel equals the target on its own, and as few twins as can be
    const others = []
    for (let k = 0; sol.length + others.length < 4; k++) {
      const v = between(1, maxPart, rnd)
      if (v === target) continue
      if (k < 40 && [...sol, ...others].includes(v)) continue
      others.push(v)
    }
    const values = [...sol, ...others]
    if (values.some(v => v === target)) continue
    const parcels = shuffle(values.map(v => ({ id: `p${++seq}`, n: v, w: v, e: '📦', label: `Paket ${v}` })), rnd)
    return { mode: 'sum', flyer, target, parcels }
  }
  // (never reached with the ranges above)
  return { mode: 'sum', flyer, target: 3, parcels: [1, 2, 4, 1].map(v => ({ id: `p${++seq}`, n: v, w: v, e: '📦', label: `Paket ${v}` })) }
}

/** The parcels that make `target`: ids of one way to do it with at most STACK_MAX, or null. */
export function sumSolution(parcels, target) {
  const n = parcels.length
  let best = null
  for (let mask = 1; mask < 1 << n; mask++) {
    const chosen = parcels.filter((_, i) => mask & (1 << i))
    if (chosen.length > STACK_MAX) continue
    if (chosen.reduce((s, p) => s + p.w, 0) !== target) continue
    if (!best || chosen.length < best.length) best = chosen
  }
  return best && best.map(p => p.id)
}

// ── Level 9: light to heavy ──────────────────────────────────────────────

// A light, a small and a middle thing: 2 + 3 + 5 steps. Each alone stays
// below the treat at the top; all three at once reach it exactly.
export function orderTask(rnd, flyer, next = pool(rnd)) {
  const things = ['light', 'small', 'middle'].map(cls => thing(next(cls), { scale: 1 }))
  // never already in order
  let steps
  do { steps = shuffle(things, rnd) } while (isOrdered(steps))
  return { mode: 'order', flyer, target: TOP, things, steps: steps.map(t => t.id) }
}

/** Light on the lowest step, heavy on the highest. */
export const isOrdered = steps => steps.every((t, i) => i === 0 || steps[i - 1].w < t.w)

// ── Level 10: make it level ──────────────────────────────────────────────

export function balanceTask(rnd, flyer) {
  const left = between(5, 9, rnd)
  const right = between(Math.max(1, left - 6), left - 2, rnd)
  return { mode: 'balance', flyer, left, right, need: left - right }
}

/** The plank's lean: -1 left side down, 0 level, 1 right side down. */
export const lean = (left, right) => Math.sign(right - left)

/** The six tasks of a level. */
export function tasksFor(level, rnd = Math.random) {
  const mode = modeFor(level)
  const flyer = i => FLYERS[i % FLYERS.length]
  if (mode === 'throw') return throwTasks(level, rnd)
  if (mode === 'sum') return Array.from({ length: TASKS }, (_, i) => sumTask(level, rnd, flyer(i)))
  if (mode === 'order') {
    const next = pool(rnd)
    return Array.from({ length: TASKS }, (_, i) => orderTask(rnd, flyer(i), next))
  }
  return Array.from({ length: TASKS }, (_, i) => balanceTask(rnd, flyer(i)))
}
