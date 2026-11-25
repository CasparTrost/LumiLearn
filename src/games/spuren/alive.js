import { GLYPHS } from '../traceStrokes.js'

/**
 * Buchstaben-Spuren: where a finished glyph gets its eyes and its legs.
 * All in the glyph's own box (100 × 140, see traceStrokes.js).
 *
 *   face   the middle between the two eyes. Near the top and in the middle
 *          of the glyph when that place is on the glyph or inside it (the O,
 *          the bay of the E, between the posts of the H); otherwise on the
 *          nearest stroke — the eyes of an L floated in the air beside it.
 *   legs   [{ x, y }, { x, y }] the two hips, on the lowest ink: under the
 *          two feet of an A, side by side under the single foot of an I.
 *   centre the middle of the glyph (where its picture pops out)
 */
const cache = {}

export function bodyOf(g) {
  if (cache[g]) return cache[g]
  const pts = GLYPHS[g].flat()
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)

  let face = { x: (x0 + x1) / 2, y: y0 + Math.min(30, (y1 - y0) * 0.24) }
  let near = pts[0], best = Infinity
  for (const p of pts) {
    const d = Math.hypot(p.x - face.x, p.y - face.y)
    if (d < best) { best = d; near = p }
  }
  // ink on how many of the four sides (looking along a narrow corridor)
  const sides = [
    pts.some(p => p.x < face.x - 4 && Math.abs(p.y - face.y) <= 5),
    pts.some(p => p.x > face.x + 4 && Math.abs(p.y - face.y) <= 5),
    pts.some(p => p.y < face.y - 4 && Math.abs(p.x - face.x) <= 5),
    pts.some(p => p.y > face.y + 4 && Math.abs(p.x - face.x) <= 5),
  ].filter(Boolean).length
  if (best > 8 && sides < 3) face = { x: near.x, y: near.y }

  const low = pts.filter(p => p.y >= y1 - 8)
  const lx0 = Math.min(...low.map(p => p.x)), lx1 = Math.max(...low.map(p => p.x))
  const mid = (lx0 + lx1) / 2
  const at = lx1 - lx0 < 16 ? [mid - 7, mid + 7] : [lx0 + 4, lx1 - 4]
  const legs = at.map(x => {
    const under = pts.filter(p => Math.abs(p.x - x) <= 8).map(p => p.y)
    // never lower than the tail of the Q: the feet stay in the picture
    return { x, y: Math.min(133, under.length ? Math.max(...under) : y1) }
  })

  return (cache[g] = { face, legs, centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 }, box: { x0, y0, x1, y1 } })
}

/**
 * Where the picture that pops out of a finished glyph lands: a square in
 * the board's `view` that covers no ink and no foot, so the letter just
 * written stays whole. A corner if one is free (bottom right first), else a
 * place along a side; as big as `size` allows, never under `min`. Returns
 * { x, y, s } (top left and side, in the glyph box's units).
 */
const spots = {}
export function picSpot(g, view, size, min = size * 0.6) {
  const id = [g, view.x, view.y, view.w, view.h, size, min].join()
  return (spots[id] ??= findSpot(g, view, size, min))
}
function findSpot(g, view, size, min) {
  const ink = GLYPHS[g].flat()
  const { legs } = bodyOf(g)
  // what must stay visible: the stroke with its outline, the legs and feet
  const keep = [
    ...ink.map(p => ({ ...p, r: 8.5 })),
    ...legs.flatMap(l => [{ x: l.x, y: l.y + 6, r: 3 }, { x: l.x + 2.2, y: l.y + 11.6, r: 6 }]),
  ]
  const clear = (x, y, s) => keep.every(p => {
    const dx = Math.max(x - p.x, 0, p.x - (x + s)), dy = Math.max(y - p.y, 0, p.y - (y + s))
    return dx * dx + dy * dy > p.r * p.r
  })
  const edge = 1
  for (let s = size; s >= min; s -= 2) {
    const left = view.x + edge, right = view.x + view.w - edge - s
    const top = view.y + edge, bottom = view.y + view.h - edge - s
    const tries = [[right, bottom], [left, bottom], [right, top], [left, top]]
    for (let y = bottom - 4; y > top; y -= 4) tries.push([right, y], [left, y])
    const at = tries.find(([x, y]) => clear(x, y, s))
    if (at) return { x: at[0], y: at[1], s }
  }
  return { x: view.x + view.w - edge - min, y: view.y + view.h - edge - min, s: min }
}
