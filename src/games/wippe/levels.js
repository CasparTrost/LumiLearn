// Wippe-Katapult: what each level asks for, and what a throw does. Plain
// data and numbers, no React, so it can be tested (tests/unit/wippe.test.js).
//
// Heights are counted in steps of the tree's ruler: 0 is the flyer sitting
// on the seesaw, TOP the highest step on the screen. A thing that lands on
// the seesaw sends the flyer exactly as many steps up as it weighs, so the
// weight of a thing and the height it reaches are the same number. One
// physics for everything: what lands pushes the plank down, a light thing a
// little way, from FULL on right down to the grass.

export const TOP = 10
export const TASKS = 6
/** The weight of the light things (the lightest class). */
export const LIGHT_W = 2
/** From this weight on, a thing pushes the plank right down to the grass. */
export const FULL = 5
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
// three (only in level 9), middle ones five, heavy ones eight. Read with a
// parent's eyes: the things of a class weigh about the same in real life
// (light: a few grams; small: about an egg, 40–90 g, clearly lighter than
// an apple; middle: an apple, 150–250 g; heavy: kilos), and the classes are
// clearly apart. Nothing that floats (no balloon, feather or leaf):
// everything here falls when it is dropped. Every picture is one a child
// names in one word (no shell that looks like a snail's house).
const LIGHT = [['🍓', 'Erdbeere', 2], ['🧽', 'Schwamm', 2], ['🥜', 'Erdnüsse', 2], ['🔑', 'Schlüssel', 2], ['🍪', 'Keks', 2]]
const SMALL = [['🥚', 'Ei', 3], ['🥝', 'Kiwi', 3], ['🧁', 'Muffin', 3], ['🧄', 'Knoblauch', 3]]
const MIDDLE = [['🍎', 'Apfel', 5], ['🍐', 'Birne', 5], ['🥔', 'Kartoffel', 5], ['🍊', 'Orange', 5]]
const HEAVY = [['🪨', 'Stein', 8], ['🧱', 'Ziegelstein', 8], ['🪵', 'Holzklotz', 8], ['🎃', 'Kürbis', 8], ['📚', 'Bücherstapel', 8]]

/** The things by class, lightest first (tests/unit/wippe.test.js checks them). */
export const CLASSES = { light: LIGHT, small: SMALL, middle: MIDDLE, heavy: HEAVY }
/** Every thing that can be thrown: [picture, name, weight in steps]. */
export const THINGS = [...LIGHT, ...SMALL, ...MIDDLE, ...HEAVY]
const CLASS = CLASSES

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

// Pictures drawn bigger the heavier the thing is, in sizes that fit (an
// apple clearly smaller than a pumpkin): levels 1–4, the size is a fair clue
// there; from level 5 all are drawn the same.
export const SCALE = { light: 0.6, small: 0.7, middle: 0.78, heavy: 1.12 }
export const classOf = w => (w <= LIGHT_W ? 'light' : w <= 3 ? 'small' : w <= 5 ? 'middle' : 'heavy')

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
  // levels 5–6: a light, a middle and a heavy thing, all drawn the same
  // size: the picture's size tells nothing any more, what the child knows of
  // the things does (a strawberry as big as a pumpkin). Level 6 wants the
  // light and the middle one more often (the heavy one overshoots)
  const wants = level === 5
    ? shuffle(['light', 'middle', 'heavy', 'light', 'middle', 'heavy'], rnd)
    : shuffle(['light', 'light', 'middle', 'middle', 'middle', 'heavy'], rnd)
  return wants.map((want, i) => {
    const things = shuffle(['light', 'middle', 'heavy'].map(cls => thing(next(cls), { scale: 1 })), rnd)
    const target = things.find(t => classOf(t.w) === want).w
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

// A light, a small and a middle thing (all drawn the same size) on a stair
// of three steps, never already in order. Nothing is thrown here: the
// seesaw is a balance. Any two things go on its two ends as often as the
// child likes, and the heavier end goes down. The child puts them on the
// stair, light on the lowest step, heavy on the highest, and taps the tick,
// which proves the order on the seesaw, neighbour against neighbour (see
// proveOrder).
export function orderTask(rnd, flyer, next = pool(rnd)) {
  const things = ['light', 'small', 'middle'].map(cls => thing(next(cls), { scale: 1 }))
  let steps
  do { steps = shuffle(things, rnd) } while (isOrdered(steps))
  return { mode: 'order', flyer, things, steps: steps.map(t => t.id) }
}

/** The seesaw as a balance: -1 the left end goes down, 1 the right end, 0 it stays level (nothing on it, or the same weight). */
export const sinks = (left, right) => lean(left?.w ?? 0, right?.w ?? 0)

/**
 * The tick of level 9: the things on the stair (lowest step first) are
 * weighed neighbour against neighbour, the lower step's on the left end,
 * the higher step's on the right. Right order: the right end sinks every
 * time. → { ok, pairs: [{ i, a, b, sinks }], wrong: the index of the first
 * pair where it does not (the proof stops there), or -1 }.
 */
export function proveOrder(steps) {
  const pairs = []
  for (let i = 0; i < steps.length - 1; i++) {
    const s = sinks(steps[i], steps[i + 1])
    pairs.push({ i, a: steps[i].id, b: steps[i + 1].id, sinks: s })
    if (s <= 0) return { ok: false, pairs, wrong: i }
  }
  return { ok: true, pairs, wrong: -1 }
}

/** Light on the lowest step, heavy on the highest. */
export const isOrdered = steps => proveOrder(steps).ok

/**
 * Level 9, the help after two misses: the two things to weigh against each
 * other (the first neighbours in the wrong order), not where they belong.
 * → [id of the lower step's, id of the higher step's], or null when in order.
 */
export function pairToCompare(steps) {
  const p = proveOrder(steps)
  return p.ok ? null : [steps[p.wrong].id, steps[p.wrong + 1].id]
}

// ── Level 10: make it level ──────────────────────────────────────────────

export function balanceTask(rnd, flyer) {
  const left = between(5, 9, rnd)
  const right = between(Math.max(1, left - 6), left - 2, rnd)
  return { mode: 'balance', flyer, left, right, need: left - right }
}

/** The plank's lean: -1 left side down, 0 level, 1 right side down. */
export function lean(left, right) { return Math.sign(right - left) }

/**
 * Level 10, the help after two misses: the next right move for the blocks on
 * the lighter parcel. 'take' one off (too many), 'add' one (too few), or
 * 'done' (as many as needed: tap the tick).
 */
export const balanceHint = (blocks, need) => (blocks > need ? 'take' : blocks < need ? 'add' : 'done')

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
