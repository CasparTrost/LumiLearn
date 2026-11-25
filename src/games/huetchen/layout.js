/**
 * Where everything of Hütchenspiel im Gebüsch stands, for a field of W × H
 * px and `n` bushes. Pure numbers (tests/unit/huetchen.test.js).
 *
 *   strip    the row of found things and the star counter, at the top
 *   bushes   B wide, bh high, standing on `ground`; slots[i] is the middle
 *            of place i. T: the size of a thing.
 *   lumi     Lumi; on a screen held upright she stands on a tree stump
 *            behind the bushes (`stump`), on a wide one beside them
 *   bubble   where her speech bubble (or, when reading, her sign) goes:
 *            `ax, ay` the point the tail touches, `maxW` the room it has
 */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

export const BUSH_RATIO = 0.8   // bush height : width
export const THING_RATIO = 0.62 // thing size : bush width
// The thing's top, relative to the bush's top, in bush heights and thing
// sizes: standing on the bush, and hidden in it
export const thingY = (bh, T) => ({ top: bh * 0.3 - T, hidden: bh * 0.37 })

export function layoutFor(W, H, n, total) {
  const pad = 8
  const stripH = clamp(H * 0.075, 36, 50)
  const strip = { x: pad, y: 6, w: W - pad * 2, h: stripH }
  const top = strip.y + stripH + 6
  const mainH = H - top - pad
  const side = W > mainH * 1.9

  const lw = side ? clamp(W * 0.23, 140, 250) : 0
  const zone = { x: pad + lw, y: top, w: W - pad * 2 - lw, h: mainH }
  const gap = clamp(zone.w * 0.018, 4, 16)
  // a bush with its thing standing on top and room for a jump: 1.85 B high
  let B = Math.min(210, (zone.w - (n - 1) * gap) / n)
  B = Math.min(B, side ? (zone.h - 6) / 1.85 : (mainH - 170) / 1.85)
  B = Math.max(B, 64)
  const bh = B * BUSH_RATIO, T = B * THING_RATIO
  const ground = zone.y + zone.h - 4
  const rowW = n * B + (n - 1) * gap
  const x0 = zone.x + (zone.w - rowW) / 2
  const slots = Array.from({ length: n }, (_, i) => x0 + i * (B + gap) + B / 2)
  // the highest a thing standing on a bush reaches
  const thingTop = ground - bh + thingY(bh, T).top - 6

  let lumi, bubble, stump = null
  if (side) {
    const s = clamp(Math.min(lw * 0.7, mainH * 0.46), 76, 170)
    lumi = { x: pad + (lw - s) / 2, y: ground - s, s }
    const room = lumi.y - top - 16
    bubble = { side: 'top', ax: lumi.x + s * 0.62, ay: lumi.y + s * 0.06, maxW: lw + 40, maxH: Math.max(76, room), size: clamp(Math.min(room, lw * 0.62), 76, 140) }
  } else {
    const room = thingTop - top
    const s = clamp(room * 0.62, 90, 190)
    const size = clamp(s * 0.8, 76, 150)
    const groupW = s + 18 + size
    const gx = Math.max(pad, (W - groupW) / 2)
    const y = Math.max(top + 4, thingTop - s - clamp(room * 0.12, 6, 40))
    lumi = { x: gx, y, s }
    bubble = { side: 'left', ax: gx + s * 0.94, ay: y + s * 0.42, maxW: W - pad - (gx + s + 14), maxH: s * 1.2, size }
    // the stump Lumi stands on, down behind the bushes
    stump = { x: gx + s / 2, top: y + s * 0.93, bottom: ground - bh * 0.5, w: clamp(s * 0.62, 56, 110) }
  }

  // the found things: a ring for each, from the left; the stars on the right
  const hudW = 92
  const ring = clamp(Math.min(stripH - 8, (strip.w - hudW - 16) / total - 4), 16, 42)
  const rings = Array.from({ length: total }, (_, k) => ({ x: strip.x + 10 + k * (ring + 4) + ring / 2, y: strip.y + stripH / 2 }))

  return { W, H, n, side, strip, ring, rings, zone, B, bh, T, gap, ground, slots, lumi, bubble, stump }
}
