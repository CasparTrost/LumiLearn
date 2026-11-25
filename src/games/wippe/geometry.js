// Wippe-Katapult: where everything stands, for any size of the play field
// (in the stage's own px, see zahlen/stage.jsx). Plain numbers, no React.
//
//   wide  a tablet or a phone held sideways: the tree and the seesaw on the
//         left, the things to throw on the grass to the right
//   tall  a phone held upright: the tree and the seesaw above, the things
//         on a strip of grass below
//
// The plank turns about its pivot by an angle in degrees, + is the right
// end down. At rest the flyer sits on the left end, which is down on the
// grass (-A); a heavy landing on the right end swings it to +A.

import { TOP } from './levels.js'

export const A = 16                  // the plank's tilt at either end, degrees
export const THICK = 18              // the plank
const rad = d => (d * Math.PI) / 180
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/**
 * A point on the plank: `along` px from the pivot along the plank (− left),
 * `lift` px above its top surface, at angle `deg`.
 */
export function onPlank(g, deg, along, lift = 0) {
  const t = rad(deg), up = THICK / 2 + lift
  return { x: g.px + along * Math.cos(t) + up * Math.sin(t), y: g.py + along * Math.sin(t) - up * Math.cos(t) }
}

/** Places for n things of size s in a box, bottom row first, centred. */
export function grid(n, s, box, gap = 10) {
  const w = box.x1 - box.x0
  const cols = Math.max(1, Math.min(n, Math.floor((w + gap) / (s + gap))))
  const rows = Math.ceil(n / cols)
  const out = []
  for (let i = 0; i < n; i++) {
    const r = Math.floor(i / cols)
    const inRow = Math.min(cols, n - r * cols)
    const c = i - r * cols
    const rowW = inRow * s + (inRow - 1) * gap
    out.push({ x: (box.x0 + box.x1) / 2 - rowW / 2 + s / 2 + c * (s + gap), y: box.y1 - s / 2 - r * (s + gap * 1.6) })
  }
  return { spots: out, rows, cols }
}

export function layoutFor(W, H, wide, mode = 'throw') {
  const g = { W, H, wide }
  const balance = mode === 'balance'
  if (wide) {
    g.ground = H - 18
    g.trunk = { x0: 22, x1: 72 }
    g.treatX = 136
    g.treat = 52
    g.cx = 194
    g.FS = 86
    g.L = 170
    g.thing = 88
    g.parcel = 74
    g.topY = 46
    g.px = balance ? 330 : g.cx + 0.75 * g.L
  } else {
    g.ground = H - 196
    g.trunk = { x0: 12, x1: 50 }
    g.treatX = 100
    g.treat = 46
    g.cx = 146
    g.FS = 78
    g.L = balance ? 150 : 160
    g.thing = 80
    g.parcel = 72
    g.topY = 168
    g.px = balance ? W / 2 : g.cx + 0.75 * g.L
  }
  g.py = g.ground - g.L * Math.sin(rad(A)) - (THICK / 2) * Math.cos(rad(A))
  g.seat = -0.78 * g.L                    // where the flyer sits, along the plank
  g.load = 0.78 * g.L                     // where a thing lands
  g.sink = 6                              // the flyer sits a little into the plank

  // The flyer's middle when it sits on the plank at angle deg
  g.seatAt = deg => {
    const p = onPlank(g, deg, g.seat, 0)
    return { x: p.x, y: p.y - g.FS / 2 + g.sink }
  }
  g.restY = g.seatAt(-A).y
  g.unit = (g.restY - g.topY) / TOP
  /** The flyer's middle at a height in steps */
  g.yAt = step => g.restY - step * g.unit

  // The raised end, where things are dropped: the middle of a thing of size s on it
  g.dropAt = (s, deg = -A, lift = 0) => {
    const p = onPlank(g, deg, g.load, lift + s / 2)
    return p
  }

  // The things on the grass, the green tick, the crate or the stair
  const tipX = g.px + g.L * Math.cos(rad(A))
  g.supply = wide
    ? { x0: tipX + 26, x1: W - 14, y0: 128, y1: g.ground - 2 }
    : { x0: 12, x1: W - 12, y0: g.ground + 16, y1: H - 12 }

  // The branch where everyone who got its treat sits, under the star counter
  g.hud = { x: W - 12, y: 8 }
  const seatW = wide ? 48 : 38
  g.branch = wide
    ? { x0: W - 12 - seatW * 6 - 14, x1: W - 4, y: 112, seat: seatW }
    : { x0: W - 8 - seatW * 6 - 10, x1: W - 2, y: 108, seat: seatW }

  // Level 10: two stumps, the plank between them is a bridge when level
  if (balance) {
    const top = g.py - THICK / 2
    g.stumps = [g.px - g.L - 24, g.px + g.L + 24].map(x => ({ x, top, w: 46 }))
    if (wide) g.supply = { x0: g.stumps[1].x + 46, x1: W - 14, y0: 128, y1: g.ground - 2 }
  }
  return g
}

/** Is a point (field px) close enough to the raised end to count as a drop there? */
export function nearDrop(g, x, y, s) {
  const d = g.dropAt(s)
  return Math.abs(x - d.x) < g.L * 0.55 && y < d.y + s * 0.6 && y > d.y - s * 3.2
}

/**
 * Spots for the things on the grass: one row, standing on the ground line,
 * shrunk (k < 1) when they do not fit; the green tick beside them when
 * there is room, else above them on the right.
 */
export function supplyLayout(g, sizes, withButton) {
  const B = 84, gap = 12
  const box = { ...g.supply }
  const total = sizes.reduce((a, b) => a + b, 0) + gap * Math.max(0, sizes.length - 1)
  let button = null
  if (withButton) {
    if (!g.wide || box.x1 - box.x0 >= total + B + gap * 2) {
      button = { x: box.x1 - B / 2, y: box.y1 - B / 2 - 2 }
      box.x1 -= B + gap * 1.5
    } else {
      button = { x: box.x1 - B / 2, y: box.y0 + B / 2 }
    }
  }
  const k = Math.min(1, (box.x1 - box.x0) / Math.max(1, total))
  let x = (box.x0 + box.x1) / 2 - (total * k) / 2
  const spots = sizes.map(s => {
    const spot = { x: x + (s * k) / 2, y: box.y1 - (s * k) / 2 }
    x += (s + gap) * k
    return spot
  })
  return { spots, button, B, k }
}

/** The stair of level 9: three steps rising to the right, each holding a thing of size s. */
export function stairLayout(g, s) {
  const box = g.supply
  const stepW = s + 12
  const rise = clamp((box.y1 - box.y0 - s - 20) / 3, 22, 40)
  const w = stepW * 3
  const x0 = Math.min(box.x0 + 6, (box.x0 + box.x1) / 2 - w / 2 - (g.wide ? 0 : 50))
  return Array.from({ length: 3 }, (_, i) => {
    const top = box.y1 - rise * (i + 1)
    return { x: x0 + stepW * i + stepW / 2, top, w: stepW, y: top - s / 2 + 4 }
  })
}
