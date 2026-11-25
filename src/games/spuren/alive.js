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
