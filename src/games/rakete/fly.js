// Planeten-Hüpfer: flying the rocket by hand, and the one rule of the hops.
// No React here, so it can be tested (tests/unit/rakete.test.js).
//
// The rocket's place along the line is a number x (planet 3 is 3, half way
// to 4 is 3.5); its height over the line is free. While the child holds it,
// it follows the finger anywhere in the sky with a little lag, along the
// line never faster than FLY_MAX planets a second, so every planet on the
// way registers: when x reaches the next planet, that is one hop, the same
// hop a press on the flame makes (its arc, its number, its count). Where the
// child lets go, the rocket comes down, and that planet is the answer.

import { MINUS, TOP } from './tasks.js'

/** Top speed by hand, in planets per second: slow enough to hear each number. */
export const FLY_MAX = 2
/** How quickly the rocket closes the distance to the finger (per second). */
export const FLY_LAG = 6
/** How far a finger moves (px) before a touch on the rocket is a flight, not a tap. */
export const DRAG_PX = 10

/**
 * One frame of the flight: from x towards the finger's place, with lag,
 * never more than FLY_MAX · dt.
 */
export function flyStep(x, target, dt) {
  const t = Math.max(0, Math.min(0.1, dt))
  const want = (target - x) * Math.min(1, FLY_LAG * t)
  const most = FLY_MAX * t
  const move = Math.max(-most, Math.min(most, want))
  // the last little bit: arrive rather than creep for ever
  if (Math.abs(target - x) < 0.01) return target
  return x + move
}

/**
 * The planets passed when the rocket moves to x, coming from planet `cell`
 * (the last one it was over): [cell ± 1, …] in order, and the new cell.
 * A planet counts when the rocket is over it, not half way there.
 */
export function crossings(cell, x) {
  const passed = []
  let c = cell
  while (x >= c + 1) passed.push(++c)
  while (x <= c - 1) passed.push(--c)
  return { cell: c, passed }
}

/** How quickly the rocket follows the finger up and down (per second). */
export const FLY_RISE = 9
/**
 * The rocket's height over the line of planets while it is flown by hand:
 * free, wherever the finger goes (with a little lag), between a low hover
 * and the edge of the sky. `finger`: how far the finger has moved away from
 * the line since it took hold.
 */
export function flyHeight(h, finger, dt, { hover, top }) {
  const want = Math.max(hover, Math.min(top, hover + finger))
  const t = Math.max(0, Math.min(0.1, dt))
  return h + (want - h) * Math.min(1, FLY_RISE * t)
}
/** Coming down after the finger let go: `speed` px a second, never below the planet. */
export const flyDown = (h, dt, speed) => Math.max(0, h - speed * Math.max(0, Math.min(0.1, dt)))

/** Letting go: the nearer planet, within reach. */
export function releaseAt(x, reach) {
  return Math.max(reach.lo, Math.min(reach.hi, Math.round(x)))
}

/**
 * How far the rocket can go in a sum, by hand and with the buttons alike.
 * A level with one sign (1–4, 9): from the start the sign's way to the end
 * of the line; the other button only takes hops back. A mixed level (5, 6):
 * the whole line, the wrong way too (the sign is the lesson there).
 */
export function reachOf(plan, task) {
  if (plan.ops.length > 1) return { lo: 0, hi: TOP }
  return task.op === MINUS ? { lo: 0, hi: task.from } : { lo: task.from, hi: TOP }
}

/**
 * The one rule of the hops (buttons and hand): a hop adds an arc, a hop
 * back along the last arc takes that arc off again. So the arcs are always
 * the way from the start to the rocket, and their number is how far it is
 * from the start: going back takes a hop off the count.
 */
export function hopArcs(arcs, a, b, id, extra = {}) {
  const last = arcs[arcs.length - 1]
  if (last && last.b === a && last.a === b) return arcs.slice(0, -1)
  return [...arcs, { id, a, b, ...extra }]
}
