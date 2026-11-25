// Turns a picture from the device into a colouring page: clean black lines
// on white with closed areas, so the Mal-Atelier's paint bucket works on it
// exactly as on its own pages. Pure functions on typed arrays (no DOM): the
// game runs them in a worker, the unit tests in node.
//
// Two ways in, chosen from the picture itself:
//   • line art (a colouring page, scanned, photographed with a shadow and a
//     grey uneven paper; a child's pencil or felt-pen drawing): even out the
//     lighting, threshold with hysteresis, drop what touches the edge as a
//     dark mass (the table around the paper), hollow out solid areas, remove
//     specks, close gaps (morphologically, then line ends are joined to the
//     nearest line they point at);
//   • a photo or a cartoon: smooth, a few colours (k-means), small regions
//     merged into their neighbours, and the borders between the regions are
//     the lines — borders of regions are closed by construction.
// Both end the same way: tiny white areas are filled black (nobody can hit
// them with a finger), and a picture with nothing to colour is refused.

// The sheet: as the Mal-Atelier's own pages (1000 × 1500), upright or wide
export const SHEET_SHORT = 1000, SHEET_LONG = 1500

export function sheetSize(w, h) {
  const upright = h >= w
  const maxW = upright ? SHEET_SHORT : SHEET_LONG, maxH = upright ? SHEET_LONG : SHEET_SHORT
  const k = Math.min(maxW / w, maxH / h)
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) }
}

// detail: 0 fewer lines, 1 normal, 2 more lines. Sizes are in sheet pixels
// (a sheet has 1.5 million); they scale with the picture's area.
const LEVELS = [
  { t: 168, speck: 160, gap: 30, tiny: 700, k: 5, minRegion: 0.006,  merge: 20, edge: 22, out: 28, ruled: true },
  { t: 192, speck: 80,  gap: 40, tiny: 420, k: 7, minRegion: 0.0028, merge: 15, edge: 14, out: 20, ruled: true },
  { t: 214, speck: 40,  gap: 40, tiny: 260, k: 9, minRegion: 0.0013, merge: 10, edge: 10, out: 16 },
]
export const LINE_WIDTH = 5          // the thinnest a line ends up (the pages' lines are 5–9)

// ── small tools ─────────────────────────────────────────────────────────────

// Chamfer (3-4) distance of every pixel to the nearest pixel where
// mask === target, in thirds of a pixel
function chamfer(mask, w, h, target) {
  const INF = 1 << 29
  const d = new Int32Array(w * h)
  for (let i = 0; i < d.length; i++) d[i] = mask[i] === target ? 0 : INF
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) {
      const i = row + x
      let v = d[i]
      if (!v) continue
      if (x > 0 && d[i - 1] + 3 < v) v = d[i - 1] + 3
      if (y > 0) {
        if (d[i - w] + 3 < v) v = d[i - w] + 3
        if (x > 0 && d[i - w - 1] + 4 < v) v = d[i - w - 1] + 4
        if (x < w - 1 && d[i - w + 1] + 4 < v) v = d[i - w + 1] + 4
      }
      d[i] = v
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    const row = y * w
    for (let x = w - 1; x >= 0; x--) {
      const i = row + x
      let v = d[i]
      if (!v) continue
      if (x < w - 1 && d[i + 1] + 3 < v) v = d[i + 1] + 3
      if (y < h - 1) {
        if (d[i + w] + 3 < v) v = d[i + w] + 3
        if (x < w - 1 && d[i + w + 1] + 4 < v) v = d[i + w + 1] + 4
        if (x > 0 && d[i + w - 1] + 4 < v) v = d[i + w - 1] + 4
      }
      d[i] = v
    }
  }
  return d
}

// grows a mask by r pixels (round)
export function dilate(mask, w, h, r) {
  const d = chamfer(mask, w, h, 1), lim = Math.round(r * 3), out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = d[i] <= lim ? 1 : 0
  return out
}

// shrinks a mask by r pixels (round)
export function erode(mask, w, h, r) {
  const d = chamfer(mask, w, h, 0), lim = Math.round(r * 3), out = new Uint8Array(w * h)
  for (let i = 0; i < out.length; i++) out[i] = d[i] > lim ? 1 : 0
  return out
}

// Connected areas of pixels with mask[i] === value. 4- or 8-connected.
export function components(mask, w, h, value = 1, conn = 4) {
  const labels = new Int32Array(w * h).fill(-1)
  const areas = [], border = []
  const stack = new Int32Array(w * h)
  let count = 0
  for (let s = 0; s < labels.length; s++) {
    if (mask[s] !== value || labels[s] >= 0) continue
    let top = 0, area = 0, edge = false
    stack[top++] = s
    labels[s] = count
    while (top) {
      const p = stack[--top]
      area++
      const x = p % w, y = (p - x) / w
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) edge = true
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy
        if (ny < 0 || ny >= h) continue
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue
          if (conn === 4 && dx && dy) continue
          const nx = x + dx
          if (nx < 0 || nx >= w) continue
          const n = ny * w + nx
          if (mask[n] === value && labels[n] < 0) { labels[n] = count; stack[top++] = n }
        }
      }
    }
    areas.push(area); border.push(edge)
    count++
  }
  return { labels, count, areas, border }
}

// Mean over a (2r+1)² box, separable, for one channel (Float32Array)
function boxBlur(src, w, h, r) {
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let x = -r; x <= r; x++) sum += src[row + Math.min(w - 1, Math.max(0, x))]
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / (2 * r + 1)
      sum += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let y = -r; y <= r; y++) sum += tmp[Math.min(h - 1, Math.max(0, y)) * w + x]
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / (2 * r + 1)
      sum += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]
    }
  }
  return out
}

// ── lighting ────────────────────────────────────────────────────────────────

// The paper's brightness everywhere: the brightest in each block, spread a
// little and smoothed. Lines (thin and dark) don't count; a shadow or a
// gradient across the page does.
function paperLight(v, w, h, block = 16) {
  const bw = Math.ceil(w / block), bh = Math.ceil(h / block)
  let small = new Float32Array(bw * bh)
  for (let y = 0; y < h; y++) {
    const by = (y / block) | 0
    for (let x = 0; x < w; x++) {
      const b = by * bw + ((x / block) | 0)
      if (v[y * w + x] > small[b]) small[b] = v[y * w + x]
    }
  }
  // the brightest in a 5 × 5 block neighbourhood
  const spread = new Float32Array(bw * bh)
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    let m = 0
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const yy = y + dy, xx = x + dx
      if (yy >= 0 && yy < bh && xx >= 0 && xx < bw && small[yy * bw + xx] > m) m = small[yy * bw + xx]
    }
    spread[y * bw + x] = m
  }
  small = boxBlur(boxBlur(spread, bw, bh, 2), bw, bh, 2)
  // back to full size (bilinear)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / block - 0.5))
    const y0 = fy | 0, y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / block - 0.5))
      const x0 = fx | 0, x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0
      const a = small[y0 * bw + x0] * (1 - tx) + small[y0 * bw + x1] * tx
      const b = small[y1 * bw + x0] * (1 - tx) + small[y1 * bw + x1] * tx
      out[y * w + x] = a * (1 - ty) + b * ty
    }
  }
  return out
}

// How dark each pixel is against the paper around it: 255 is paper, 0 ink.
// The darkest channel: a yellow felt pen is as much a line as a black one.
export function evenLight(rgba, w, h) {
  const v = new Float32Array(w * h)
  for (let i = 0, p = 0; i < v.length; i++, p += 4) {
    const a = rgba[p + 3] / 255
    // transparent pixels are paper
    v[i] = 255 - (255 - Math.min(rgba[p], rgba[p + 1], rgba[p + 2])) * a
  }
  const bg = paperLight(v, w, h)
  softShadows(v, bg, w, h)
  const out = new Float32Array(w * h)
  for (let i = 0; i < v.length; i++) out[i] = Math.min(255, v[i] * 255 / Math.max(48, bg[i]))
  return out
}

// The shadow of a hand or of the phone across the page: darker than the
// paper round it and too narrow for `paperLight` to follow (that takes the
// brightest far around, so that lines don't count). What tells a shadow from
// a coloured-in area or a bold line is its edge: a shadow fades out. Where a
// dark patch has such a soft edge, the paper's light is taken from the patch
// itself, with its lines closed over, and the shadow is gone while the lines
// in it stay. Changes `bg` in place.
function softShadows(v, bg, w, h) {
  const B = 4
  const bw = Math.ceil(w / B), bh = Math.ceil(h / B), n = bw * bh
  // the brightest in each block, then closed (lines up to some 24 pixels wide go)
  let top = new Float32Array(n)
  for (let y = 0; y < h; y++) {
    const row = ((y / B) | 0) * bw
    for (let x = 0; x < w; x++) { const b = row + ((x / B) | 0); if (v[y * w + x] > top[b]) top[b] = v[y * w + x] }
  }
  const sweep = (src, pick) => {
    const a = new Float32Array(n), out = new Float32Array(n)
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let m = src[y * bw + x]
      for (let d = -3; d <= 3; d++) { const xx = x + d; if (xx >= 0 && xx < bw) m = pick(m, src[y * bw + xx]) }
      a[y * bw + x] = m
    }
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
      let m = a[y * bw + x]
      for (let d = -3; d <= 3; d++) { const yy = y + d; if (yy >= 0 && yy < bh) m = pick(m, a[yy * bw + x]) }
      out[y * bw + x] = m
    }
    return out
  }
  const closed = sweep(sweep(top, Math.max), Math.min)
  // how dark against the paper far around
  const ratio = new Float32Array(n)
  const dark = new Uint8Array(n)
  let any = false
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const b = y * bw + x
    const paper = bg[Math.min(h - 1, y * B + 2) * w + Math.min(w - 1, x * B + 2)]
    ratio[b] = closed[b] / Math.max(48, paper)
    if (ratio[b] < 0.88) { dark[b] = 1; any = true }
  }
  if (!any) return
  const cc = components(dark, bw, bh, 1, 4)
  // each patch: how deep, and how much of that depth lies across its edge
  const deepest = new Float32Array(cc.count).fill(1)
  for (let b = 0; b < n; b++) if (dark[b] && ratio[b] < deepest[cc.labels[b]]) deepest[cc.labels[b]] = ratio[b]
  const steps = Array.from({ length: cc.count }, () => [])
  for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
    const b = y * bw + x
    if (!dark[b]) continue
    if (!((x > 0 && !dark[b - 1]) || (x < bw - 1 && !dark[b + 1]) || (y > 0 && !dark[b - bw]) || (y < bh - 1 && !dark[b + bw]))) continue
    let lo = 2, hi = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy, xx = x + dx
      if (yy < 0 || yy >= bh || xx < 0 || xx >= bw) continue
      const r = ratio[yy * bw + xx]
      if (r < lo) lo = r
      if (r > hi) hi = r
    }
    steps[cc.labels[b]].push(hi - lo)
  }
  const soft = new Uint8Array(n)
  let found = false
  for (let c = 0; c < cc.count; c++) {
    if (cc.areas[c] < 40 || !steps[c].length) continue
    const st = steps[c].sort((a, b) => a - b)
    const depth = 1 - deepest[c]
    if (st[st.length >> 1] < 0.55 * depth) { found = true; for (let b = 0; b < n; b++) if (dark[b] && cc.labels[b] === c) soft[b] = 1 }
  }
  if (!found) return
  const wide = dilate(soft, bw, bh, 4)
  const level = boxBlur(closed, bw, bh, 1)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(bh - 1, Math.max(0, (y + 0.5) / B - 0.5)), y0 = fy | 0, y1 = Math.min(bh - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(bw - 1, Math.max(0, (x + 0.5) / B - 0.5)), x0 = fx | 0, x1 = Math.min(bw - 1, x0 + 1), tx = fx - x0
      if (!wide[y0 * bw + x0] && !wide[y1 * bw + x1]) continue
      const l = (level[y0 * bw + x0] * (1 - tx) + level[y0 * bw + x1] * tx) * (1 - ty) + (level[y1 * bw + x0] * (1 - tx) + level[y1 * bw + x1] * tx) * ty
      if (l < bg[y * w + x]) bg[y * w + x] = l
    }
  }
}

// ── line art ────────────────────────────────────────────────────────────────

// Zhang–Suen thinning: a line one pixel wide down its middle
export function thin(mask, w, h) {
  const m = mask.slice()
  let list = []
  for (let i = 0; i < m.length; i++) {
    if (!m[i]) continue
    const x = i % w, y = (i - x) / w
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1) { m[i] = 0; continue }
    list.push(i)
  }
  const del = []
  let changed = true
  while (changed) {
    changed = false
    for (let step = 0; step < 2; step++) {
      del.length = 0
      for (const i of list) {
        if (!m[i]) continue
        const p2 = m[i - w], p3 = m[i - w + 1], p4 = m[i + 1], p5 = m[i + w + 1]
        const p6 = m[i + w], p7 = m[i + w - 1], p8 = m[i - 1], p9 = m[i - w - 1]
        const b = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
        if (b < 2 || b > 6) continue
        const a = (!p2 && p3) + (!p3 && p4) + (!p4 && p5) + (!p5 && p6) + (!p6 && p7) + (!p7 && p8) + (!p8 && p9) + (!p9 && p2)
        if (a !== 1) continue
        if (step === 0 ? (p2 && p4 && p6) || (p4 && p6 && p8) : (p2 && p4 && p8) || (p2 && p6 && p8)) continue
        del.push(i)
      }
      for (const i of del) m[i] = 0
      if (del.length) changed = true
    }
    list = list.filter(i => m[i])
  }
  return m
}

const N8 = w => [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]
const neighbours = (m, i, w) => {
  let n = 0
  for (const d of N8(w)) n += m[i + d] ? 1 : 0
  return n
}

// Short twigs of the thinned line (a bump on a thick line) come off: an end
// that reaches a fork within `len` pixels is a twig.
function pruneTwigs(skel, w, h, len) {
  const off = N8(w)
  for (let i = 0; i < skel.length; i++) {
    if (!skel[i] || neighbours(skel, i, w) !== 1) continue
    const path = [i]
    let prev = -1, cur = i, fork = false
    for (let s = 0; s < len; s++) {
      let next = -1, n = 0
      for (const d of off) {
        const j = cur + d
        if (j !== prev && skel[j] && !path.includes(j)) { n++; if (next < 0) next = j }
      }
      if (n === 0) break
      if (n > 1 || neighbours(skel, next, w) > 2) { fork = true; break }
      prev = cur; cur = next; path.push(cur)
    }
    if (fork) for (const p of path) skel[p] = 0
  }
}

function drawLine(mask, w, h, x0, y0, x1, y1) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1)
  for (let s = 0; s <= n; s++) {
    const x = Math.round(x0 + (x1 - x0) * s / n), y = Math.round(y0 + (y1 - y0) * s / n)
    if (x >= 0 && y >= 0 && x < w && y < h) mask[y * w + x] = 1
  }
}

// Sharp corners of the thinned lines, with the way they point (away from
// both arms). A roof drawn by a child stops just beside the wall's corner:
// that corner is where the gap is, not a line end.
function corners(skel, w, h, avoid) {
  const off = N8(w)
  const found = []
  const seen = new Int32Array(w * h)
  let stamp = 0
  for (let i = 0; i < skel.length; i++) {
    if (!skel[i] || avoid?.[i]) continue
    const n = neighbours(skel, i, w)
    if (n < 2 || n > 3) continue
    // the pixels 14 steps along the line from here: two arms
    stamp++
    seen[i] = stamp
    let frontier = [i]
    for (let s = 0; s < 14 && frontier.length; s++) {
      const next = []
      for (const p of frontier) for (const d of off) {
        const q = p + d
        if (q >= 0 && q < skel.length && skel[q] && seen[q] !== stamp) { seen[q] = stamp; next.push(q) }
      }
      frontier = next
    }
    if (frontier.length < 2 || frontier.length > 4) continue
    const x = i % w, y = (i - x) / w
    const a = frontier[0]
    let b = -1, bd = 0
    for (const q of frontier) {
      const d = Math.hypot(q % w - a % w, ((q - q % w) - (a - a % w)) / w)
      if (d > bd) { bd = d; b = q }
    }
    if (bd < 4) continue
    let ax = a % w - x, ay = (a - a % w) / w - y, bx = b % w - x, by = (b - b % w) / w - y
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by)
    ax /= la; ay /= la; bx /= lb; by /= lb
    const cos = ax * bx + ay * by
    if (cos < -0.45) continue                                  // straight on, or a gentle bend
    const ox = -(ax + bx), oy = -(ay + by), lo = Math.hypot(ox, oy)
    if (lo < 1e-6) continue
    found.push({ p: i, cos, dx: ox / lo, dy: oy / lo })
  }
  // the sharpest of each corner only
  found.sort((u, v) => v.cos - u.cos)
  const kept = []
  for (const c of found) {
    const cx = c.p % w, cy = (c.p - cx) / w
    if (kept.every(k => Math.hypot(k.p % w - cx, (k.p - k.p % w) / w - cy) > 12)) kept.push(c)
  }
  return kept
}

// An open line end is joined to the nearest line it points at (or to the
// edge of the sheet), up to `gap` pixels away: an almost closed shape then
// holds the paint. A line is not joined to itself close to the end (that is
// the same stroke), but its other end far along the stroke counts: an
// almost closed circle closes. A sharp corner is joined the same way to a
// line just beyond its tip (a little closer only). Nothing starts or ends
// in `avoid` (round the dots of eyes: a face is not to be tied together).
export function joinEnds(skel, w, h, gap, avoid = null) {
  const off = N8(w)
  const sources = []
  for (let i = 0; i < skel.length; i++) if (skel[i] && !avoid?.[i] && neighbours(skel, i, w) === 1) sources.push({ p: i, end: true })
  const isEnd = new Uint8Array(w * h)
  for (const e of sources) isEnd[e.p] = 1
  for (const c of corners(skel, w, h, avoid)) sources.push({ p: c.p, dx: c.dx, dy: c.dy })
  const seen = new Int32Array(w * h)
  const links = new Uint8Array(w * h)
  const reach = Math.round(gap * 3 + 12)
  let stamp = 0
  for (const src of sources) {
    const e = src.p
    stamp++
    const ex = e % w, ey = (e - ex) / w
    // walk along the stroke: marks it as "self" and gives its direction
    let frontier = [e], steps = 0, back = e
    seen[e] = stamp
    while (frontier.length && steps < reach) {
      const nextF = []
      for (const p of frontier) for (const d of off) {
        const q = p + d
        if (q >= 0 && q < skel.length && skel[q] && seen[q] !== stamp) { seen[q] = stamp; nextF.push(q) }
      }
      steps++
      if (steps === 12 && nextF.length) back = nextF[0]
      frontier = nextF
    }
    let dx = 0, dy = 0
    if (!src.end) { dx = src.dx; dy = src.dy }
    else if (back !== e) {
      const bx = back % w
      dx = ex - bx; dy = ey - (back - bx) / w
      const l = Math.hypot(dx, dy); dx /= l; dy /= l
    }
    const range = src.end ? gap : Math.round(gap * 0.6)
    const minCos = src.end ? 0.3 : 0.5
    const aims = (vx, vy, dist) => (dx || dy ? (vx * dx + vy * dy) / dist : 1)
    let best = -1, bestScore = Infinity
    for (let y = Math.max(0, ey - range); y <= Math.min(h - 1, ey + range); y++) {
      for (let x = Math.max(0, ex - range); x <= Math.min(w - 1, ex + range); x++) {
        const q = y * w + x
        if (!skel[q] || seen[q] === stamp || avoid?.[q]) continue
        const vx = x - ex, vy = y - ey, dist = Math.hypot(vx, vy)
        if (dist > range) continue
        const cos = aims(vx, vy, dist)
        if (cos < minCos) continue
        const score = dist * (2 - cos) * (isEnd[q] ? 0.75 : 1)
        if (score < bestScore) { bestScore = score; best = q }
      }
    }
    // the edge of the sheet, straight ahead (from a line end; a little
    // further). Only for a line of some length, the horizon that stops short
    // of the edge: a sun's ray near the edge was drawn on to it.
    let edge = null
    if (src.end && steps >= reach) {
      for (const [ddist, tx, ty] of [[ex, 0, ey], [w - 1 - ex, w - 1, ey], [ey, ex, 0], [h - 1 - ey, ex, h - 1]]) {
        if (ddist > gap * 1.5) continue          // lines often stop short of the edge
        const dist = Math.max(1, ddist)
        const cos = aims(tx - ex, ty - ey, dist)
        if (cos < 0.5) continue
        const score = dist * (2 - cos)
        if (score < bestScore) { bestScore = score; edge = [tx, ty] }
      }
    }
    if (edge) drawLine(links, w, h, ex, ey, edge[0], edge[1])
    else if (best >= 0) { const bx = best % w; drawLine(links, w, h, ex, ey, bx, (best - bx) / w) }
  }
  return links
}

// Areas a finger can't hit become line; returns the colourable areas
export function fillTinyAreas(lines, w, h, tiny) {
  const { labels, areas } = components(lines, w, h, 0, 4)
  const small = areas.map(a => a < tiny)
  for (let i = 0; i < lines.length; i++) if (!lines[i] && small[labels[i]]) lines[i] = 1
  return areas.filter(a => a >= tiny).length
}

function removeSpecks(ink, w, h, min) {
  const { labels, areas } = components(ink, w, h, 1, 8)
  for (let i = 0; i < ink.length; i++) if (ink[i] && areas[labels[i]] < min) ink[i] = 0
}

// What is drawn on the paper, from the evened light: hysteresis (faint
// pixels count where they touch a clearly dark line), without the dark mass
// around the paper.
function inkOf(light, w, h, L, tableIsDark = false, rgba = null) {
  const norm = boxBlur(light, w, h, 1)
  const weak = new Uint8Array(w * h), strong = new Uint8Array(w * h)
  for (let i = 0; i < norm.length; i++) { weak[i] = norm[i] < L.t ? 1 : 0; strong[i] = norm[i] < L.t - 30 ? 1 : 0 }
  // The pale blue squares of an exercise book are the paper's, not the
  // drawing's: light and coloured (a pencil is grey, a felt pen dark). With
  // "more lines" they come too.
  // A ruling is all over the page; a drawing in a pale crayon is somewhere
  // on it (taken for a ruling, the whole drawing was refused).
  if (rgba && L.ruled) {
    const pale = new Uint8Array(w * h)
    const G = 8, cells = new Float64Array(G * G)
    for (let y = 0; y < h; y++) {
      const gy = Math.min(G - 1, ((y * G) / h) | 0) * G
      for (let x = 0; x < w; x++) {
        const i = y * w + x
        if (!weak[i]) continue
        const p = i * 4, mx = Math.max(rgba[p], rgba[p + 1], rgba[p + 2]), mn = Math.min(rgba[p], rgba[p + 1], rgba[p + 2])
        if (mn > 150 && mx - mn > 24) { pale[i] = 1; cells[gy + Math.min(G - 1, ((x * G) / w) | 0)]++ }
      }
    }
    const filled = Array.from(cells).filter(c => c > 0).sort((a, b) => a - b)
    const typical = filled.length ? filled[filled.length >> 1] : 0
    const even = filled.filter(c => c >= 0.3 * typical).length
    if (even >= 0.8 * G * G) for (let i = 0; i < pale.length; i++) if (pale[i]) weak[i] = strong[i] = 0
  }
  const wc = components(weak, w, h, 1, 8)
  const keep = new Uint8Array(wc.count)
  for (let i = 0; i < strong.length; i++) if (strong[i]) keep[wc.labels[i]] = 1
  const ink = new Uint8Array(w * h)
  for (let i = 0; i < ink.length; i++) ink[i] = weak[i] && keep[wc.labels[i]] ? 1 : 0
  // a dark mass at the edge is what lies around the paper: away with it.
  // (`tableIsDark`, for a picture with coloured-in areas: clearly dark only.
  // With "more lines" the grain of the paper counts as faint ink, and as one
  // mass from the edge to a coloured-in house it took the drawing along.)
  const mass = erode(tableIsDark ? strong : ink, w, h, 7)
  const mc = components(mass, w, h, 1, 8)
  if (mc.border.some(Boolean)) {
    const out = new Uint8Array(w * h)
    for (let i = 0; i < out.length; i++) out[i] = mass[i] && mc.border[mc.labels[i]] ? 1 : 0
    const gone = dilate(out, w, h, 10)
    for (let i = 0; i < ink.length; i++) if (gone[i]) ink[i] = 0
  }
  // what is left of it: slivers along the edge that never reach inside
  {
    const m = Math.max(24, Math.round(0.035 * Math.min(w, h)))
    const ec = components(ink, w, h, 1, 8)
    const inside = new Uint8Array(ec.count)
    for (let y = m; y < h - m; y++) for (let x = m; x < w - m; x++) {
      const i = y * w + x
      if (ink[i]) inside[ec.labels[i]] = 1
    }
    for (let i = 0; i < ink.length; i++) if (ink[i] && ec.border[ec.labels[i]] && !inside[ec.labels[i]]) ink[i] = 0
  }
  return ink
}

// Solid areas in the ink (a coloured-in felt-pen sun): what is still there
// seven pixels in, large, and somewhere thick. A bold line is no area: it is
// thick all along but never deep (hollowed out, every stroke of a small
// picture enlarged came back as two lines with a strip between them).
//
// And a bold line is black. A coloured mass that is not deep is a coloured-in
// area all the same, in stripes (a striped dress: kept as "bold lines" it was
// a black dress nobody could paint).
function solidCores(ink, w, h, rgba = null) {
  const core = erode(ink, w, h, 7)
  const cc = components(core, w, h, 1, 8)
  const deep = erode(core, w, h, 14)
  const thick = new Uint8Array(cc.count)
  for (let i = 0; i < deep.length; i++) if (deep[i]) thick[cc.labels[i]] = 1
  const black = new Float64Array(cc.count)
  if (rgba) for (let i = 0, p = 0; i < core.length; i++, p += 4) if (core[i] && Math.max(rgba[p], rgba[p + 1], rgba[p + 2]) < 120) black[cc.labels[i]]++
  const coloured = c => !!rgba && black[c] < 0.6 * cc.areas[c]
  return {
    core, cc,
    solid: i => core[i] && cc.areas[cc.labels[i]] >= 900 && (thick[cc.labels[i]] || coloured(cc.labels[i])),
    // any coloured mass, small ones too: no stroke
    mass: i => core[i] && cc.areas[cc.labels[i]] >= 300 && coloured(cc.labels[i]),
    // how much of the picture is coloured-in (not black) mass
    colouredShare: () => { let a = 0; for (let c = 0; c < cc.count; c++) if (cc.areas[c] >= 900 && coloured(c)) a += cc.areas[c]; return a / (w * h) },
  }
}

// From ink to lines: specks away, gaps closed, line ends joined, a line
// never thinner than the pages' lines
function inkToLines(ink, w, h, L, s, avoid) {
  removeSpecks(ink, w, h, L.speck * Math.max(s, 0.5))
  // small gaps: close them
  ink = erode(dilate(ink, w, h, 2), w, h, 2)
  // larger gaps: join the line ends
  const skel = thin(ink, w, h)
  pruneTwigs(skel, w, h, 10)
  const links = joinEnds(skel, w, h, L.gap, avoid)
  for (let i = 0; i < skel.length; i++) if (links[i]) skel[i] = 1
  const thick = dilate(skel, w, h, (LINE_WIDTH - 1) / 2)
  const lines = new Uint8Array(w * h)
  for (let i = 0; i < lines.length; i++) lines[i] = ink[i] || thick[i] ? 1 : 0
  return lines
}

export function traceLines(rgba, w, h, detail = 1, light = evenLight(rgba, w, h)) {
  const L = LEVELS[detail] ?? LEVELS[1]
  const s = (w * h) / (SHEET_SHORT * SHEET_LONG)                 // area scale
  const ink = inkOf(light, w, h, L, false, rgba)
  // solid areas become their outline; small ones (the dot of an eye) stay
  // solid, and no line is joined there
  const { core, solid } = solidCores(ink, w, h, rgba)
  const dots = new Uint8Array(w * h)
  for (let i = 0; i < ink.length; i++) {
    if (!core[i]) continue
    if (solid(i)) ink[i] = 0
    else dots[i] = 1
  }
  const avoid = dilate(dots, w, h, 12)
  return finish(inkToLines(ink, w, h, L, s, avoid), w, h, L.tiny * s, 'lines')
}

// The strokes on a picture with paper and coloured-in areas: the ink
// without its solid areas (their borders come from the colours).
function strokesOf(rgba, light, w, h, L, s) {
  const ink = inkOf(light, w, h, L, true, rgba)
  const { core, solid, mass } = solidCores(ink, w, h, rgba)
  const areas = new Uint8Array(w * h)
  let any = false
  for (let i = 0; i < ink.length; i++) if (solid(i) || mass(i)) { areas[i] = 1; any = true }
  if (any) {
    const gone = dilate(areas, w, h, 12)
    for (let i = 0; i < ink.length; i++) if (gone[i]) ink[i] = 0
  }
  // What is left and is no stroke: the pale skirt of a soft-shaded shape (a
  // cat's fur), wide and coloured. A stroke is narrow, or black.
  {
    const ic = components(ink, w, h, 1, 8)
    const skel = thin(ink, w, h)
    const len = new Float64Array(ic.count), black = new Float64Array(ic.count)
    for (let i = 0, p = 0; i < ink.length; i++, p += 4) {
      if (!ink[i]) continue
      if (skel[i]) len[ic.labels[i]]++
      if (Math.max(rgba[p], rgba[p + 1], rgba[p + 2]) < 120) black[ic.labels[i]]++
    }
    for (let i = 0; i < ink.length; i++) {
      if (!ink[i]) continue
      const c = ic.labels[i]
      if (ic.areas[c] > 14 * Math.max(1, len[c]) && black[c] < 0.6 * ic.areas[c]) ink[i] = 0
    }
  }
  const dots = new Uint8Array(w * h)
  for (let i = 0; i < ink.length; i++) if (core[i] && ink[i]) dots[i] = 1
  return inkToLines(ink, w, h, L, s, dilate(dots, w, h, 12))
}

// ── photos and cartoons ─────────────────────────────────────────────────────

function toLab(r, g, b) {
  const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const R = lin(r), G = lin(g), B = lin(b)
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const X = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.9505)
  const Y = f(0.2126 * R + 0.7152 * G + 0.0722 * B)
  const Z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.089)
  return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)]
}

// a fixed sequence of "random" numbers: the same picture gives the same page
function rng(seed) {
  let s = seed >>> 0
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
}

function kmeans(lab, n, k) {
  const rand = rng(12345)
  const idx = []
  const stepS = Math.max(1, Math.floor(n / 24000))
  for (let i = 0; i < n; i += stepS) idx.push(i)
  const C = []
  C.push(idx[Math.floor(rand() * idx.length)])
  const centers = [[lab[C[0] * 3], lab[C[0] * 3 + 1], lab[C[0] * 3 + 2]]]
  const d2 = new Float64Array(idx.length).fill(Infinity)
  while (centers.length < k) {
    const c = centers[centers.length - 1]
    let sum = 0
    for (let j = 0; j < idx.length; j++) {
      const p = idx[j] * 3
      const d = (lab[p] - c[0]) ** 2 + (lab[p + 1] - c[1]) ** 2 + (lab[p + 2] - c[2]) ** 2
      if (d < d2[j]) d2[j] = d
      sum += d2[j]
    }
    if (!sum) break
    let t = rand() * sum, j = 0
    for (; j < idx.length - 1; j++) { t -= d2[j]; if (t <= 0) break }
    const p = idx[j] * 3
    centers.push([lab[p], lab[p + 1], lab[p + 2]])
  }
  const nearest = p => {
    let best = 0, bd = Infinity
    for (let c = 0; c < centers.length; c++) {
      const d = (lab[p] - centers[c][0]) ** 2 + (lab[p + 1] - centers[c][1]) ** 2 + (lab[p + 2] - centers[c][2]) ** 2
      if (d < bd) { bd = d; best = c }
    }
    return best
  }
  for (let it = 0; it < 10; it++) {
    const acc = centers.map(() => [0, 0, 0, 0])
    for (const i of idx) { const c = nearest(i * 3), a = acc[c]; a[0] += lab[i * 3]; a[1] += lab[i * 3 + 1]; a[2] += lab[i * 3 + 2]; a[3]++ }
    acc.forEach((a, c) => { if (a[3]) centers[c] = [a[0] / a[3], a[1] / a[3], a[2] / a[3]] })
  }
  const labels = new Int32Array(n)
  for (let i = 0; i < n; i++) labels[i] = nearest(i * 3)
  return labels
}

// the commonest label in each 3 × 3 neighbourhood: no salt and pepper
function majority(labels, w, h) {
  const out = new Int32Array(labels.length)
  const votes = new Map()
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    votes.clear()
    let best = labels[y * w + x], bn = 0
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = Math.min(h - 1, Math.max(0, y + dy)), xx = Math.min(w - 1, Math.max(0, x + dx))
      const l = labels[yy * w + xx], n = (votes.get(l) ?? 0) + 1
      votes.set(l, n)
      if (n > bn) { bn = n; best = l }
    }
    out[y * w + x] = best
  }
  return out
}

// A few colours are not enough: a dark green tree in front of a light green
// meadow is "green" twice, one colour, one region, and its crown was left
// open at the bottom. So every area of one colour is cut where a clear edge
// runs through it. The edge is a barrier; what it separates completely gets
// a label of its own (an edge that ends in the middle of an area separates
// nothing, so no line ends in the open), and the barrier's pixels then go to
// the side they touch. `min`: the smallest area worth a cut.
function splitAtEdges(labels, lab, w, h, strong, min) {
  const n = w * h
  const dE = (p, q) => Math.hypot(lab[p * 3] - lab[q * 3], lab[p * 3 + 1] - lab[q * 3 + 1], lab[p * 3 + 2] - lab[q * 3 + 2])
  // The step across a pixel, three to each side (the picture was smoothed,
  // an edge is some pixels wide) and seven to each side as well: where two
  // areas meet, the colour is different near and far. A drawn line, an eye,
  // a wrinkle has the same colour on both sides a little further out; it is
  // no border between two areas and cuts nothing.
  const barrier = new Uint8Array(n)
  const step = (x, y, dx, dy, k) => dE(Math.max(0, y - k * dy) * w + Math.max(0, x - k * dx), Math.min(h - 1, y + k * dy) * w + Math.min(w - 1, x + k * dx))
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = Math.min(step(x, y, 1, 0, 3), step(x, y, 1, 0, 7))
    const gy = Math.min(step(x, y, 0, 1, 3), step(x, y, 0, 1, 7))
    if (Math.max(gx, gy) >= strong) barrier[y * w + x] = 1
  }
  const out = new Int32Array(n).fill(-1)
  const stack = new Int32Array(n)
  let count = 0
  // connected pixels of one colour; `open`: only those off the barrier
  const flood = (s, open) => {
    let top = 0
    stack[top++] = s; out[s] = count
    while (top) {
      const p = stack[--top], x = p % w
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]) {
        if (q >= 0 && q < n && out[q] < 0 && !(open && barrier[q]) && labels[q] === labels[s]) { out[q] = count; stack[top++] = q }
      }
    }
    count++
  }
  for (let s = 0; s < n; s++) if (out[s] < 0 && !barrier[s]) flood(s, true)
  // the barrier goes to the sides it touches, within its own colour: the
  // border between two colours stays exactly where it was
  for (let pass = 0, moved = 1; pass < 60 && moved; pass++) {
    moved = 0
    const prev = out.slice()
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (prev[p] >= 0) continue
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && prev[q] >= 0 && labels[q] === labels[p]) { out[p] = prev[q]; moved++; break }
      }
    }
  }
  // what lies in the barrier altogether (the blend of two colours along
  // their border): a region of its own, as before
  for (let s = 0; s < n; s++) if (out[s] < 0) flood(s, false)
  // Only a cut with a real area on both sides counts. A busy picture is
  // full of edges that pinch off crumbs; each crumb goes back to the area
  // of its colour it was cut from (left alone, the crumbs were handed to
  // any neighbour and tore the shapes apart).
  const parent = Int32Array.from({ length: count }, (_, i) => i)
  const find = a => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a }
  for (let round = 0; round < 12; round++) {
    const area = new Float64Array(count)
    for (let p = 0; p < n; p++) area[find(out[p])]++
    const shared = new Map()
    const note = (a, b) => {
      if (area[a] >= min) return
      let m = shared.get(a)
      if (!m) shared.set(a, m = new Map())
      m.set(b, (m.get(b) ?? 0) + 1)
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, a = find(out[p])
      for (const q of [x < w - 1 ? p + 1 : -1, y < h - 1 ? p + w : -1]) {
        if (q < 0 || labels[q] !== labels[p]) continue
        const b = find(out[q])
        if (b !== a) { note(a, b); note(b, a) }
      }
    }
    if (!shared.size) break
    for (const [a, m] of shared) {
      let best = -1, bn = 0
      for (const [b, k] of m) if (k > bn) { bn = k; best = b }
      const ra = find(a), rb = find(best)
      if (ra !== rb) parent[ra] = rb
    }
  }
  for (let p = 0; p < n; p++) out[p] = find(out[p])
  // And a cut is an edge along its whole length. Eyes, nose and mouth in a
  // row wall off half a face, with nothing but skin between them: where a
  // quarter of the cut or more shows no step in colour, it is taken back.
  const cuts = new Map()         // pair of parts -> [samples, samples with a clear step]
  const across = (p, q, a, b, dp) => {
    let pa = p, pb = q
    for (let k = 1; k <= 3; k++) {
      const na = p - k * dp, nb = q + k * dp
      if (na < 0 || nb >= n || out[na] !== a || out[nb] !== b) break
      if (dp === 1 && (((na / w) | 0) !== ((p / w) | 0) || ((nb / w) | 0) !== ((q / w) | 0))) break
      pa = na; pb = nb
    }
    const key = a < b ? a * count + b : b * count + a
    let e = cuts.get(key)
    if (!e) cuts.set(key, e = [0, 0])
    e[0]++
    if (dE(pa, pb) >= strong * 0.75) e[1]++
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, a = out[p]
    if (x < w - 1 && out[p + 1] !== a && labels[p + 1] === labels[p]) across(p, p + 1, a, out[p + 1], 1)
    if (y < h - 1 && out[p + w] !== a && labels[p + w] === labels[p]) across(p, p + w, a, out[p + w], w)
  }
  let undone = false
  for (const [key, [all, clear]] of cuts) {
    if (clear >= 0.75 * all) continue
    const ra = find(Math.floor(key / count)), rb = find(key % count)
    if (ra !== rb) { parent[ra] = rb; undone = true }
  }
  if (undone) for (let p = 0; p < n; p++) out[p] = find(out[p])
  return out
}

// Regions smaller than `min` pixels go into the neighbour they share the
// longest border with, until there are only regions worth colouring. What
// is small and stands out from everything around it stays, down to `keep`
// pixels: the eyes in a face.
function mergeSmall(labels, lab, w, h, min, keep = min, standsOut = 20) {
  for (let round = 0; round < 12; round++) {
    // regions: connected pixels of one label
    const reg = new Int32Array(w * h).fill(-1)
    const areas = []
    const stack = new Int32Array(w * h)
    let count = 0
    for (let s = 0; s < reg.length; s++) {
      if (reg[s] >= 0) continue
      let top = 0, area = 0
      stack[top++] = s; reg[s] = count
      while (top) {
        const p = stack[--top]; area++
        const x = p % w
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, p - w, p + w]
        for (const q of nb) if (q >= 0 && q < reg.length && reg[q] < 0 && labels[q] === labels[s]) { reg[q] = count; stack[top++] = q }
      }
      areas.push(area); count++
    }
    const little = areas.map(a => a < min)
    if (!little.some(Boolean)) return reg
    // shared borders of the little regions
    const shared = new Map()
    const note = (a, b) => {
      if (!little[a]) return
      let m = shared.get(a)
      if (!m) shared.set(a, m = new Map())
      m.set(b, (m.get(b) ?? 0) + 1)
    }
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x, a = reg[p]
      if (x < w - 1 && reg[p + 1] !== a) { note(a, reg[p + 1]); note(reg[p + 1], a) }
      if (y < h - 1 && reg[p + w] !== a) { note(a, reg[p + w]); note(reg[p + w], a) }
    }
    // which of them stand out: far in colour from every neighbour
    const mean = new Float64Array(count * 3)
    for (let p = 0; p < reg.length; p++) { const r = reg[p] * 3; mean[r] += lab[p * 3]; mean[r + 1] += lab[p * 3 + 1]; mean[r + 2] += lab[p * 3 + 2] }
    for (let r = 0; r < count; r++) for (let c = 0; c < 3; c++) mean[r * 3 + c] /= areas[r]
    const small = little.slice()
    for (const [a, m] of shared) {
      if (areas[a] < keep) continue
      let near = Infinity
      for (const b of m.keys()) near = Math.min(near, Math.hypot(mean[a * 3] - mean[b * 3], mean[a * 3 + 1] - mean[b * 3 + 1], mean[a * 3 + 2] - mean[b * 3 + 2]))
      if (near >= standsOut) small[a] = false
    }
    if (!small.some(Boolean)) return reg
    // each small region takes the label of its best neighbour (the
    // largest small one first, so chains of small ones settle)
    const into = new Int32Array(count).fill(-1)
    for (const [a, m] of shared) {
      if (!small[a]) continue
      let best = -1, bn = -1
      for (const [b, n] of m) {
        const score = n + (small[b] ? 0 : 0.5)
        if (score > bn) { bn = score; best = b }
      }
      into[a] = best
    }
    const regLabel = new Int32Array(count)
    for (let p = 0; p < reg.length; p++) regLabel[reg[p]] = labels[p]
    for (let p = 0; p < reg.length; p++) {
      const r = into[reg[p]]
      if (r >= 0) labels[p] = regLabel[r]
    }
  }
  return null
}
const STROKE_STANDS_OUT = 20

const THIN = 3

// What is thin goes into what lies beside it: a cartoon's black outline, a
// drawn line, the blend of two colours along their border, and the halo of
// that blend round a dark shape (it has the colour of something else in the
// picture and hangs on to it by a thread: the two halves of a background
// were kept apart by the halo round a head between them). Thin is what is
// up to six pixels wide, a whole region or a part of one (smoothed, a drawn
// line is that wide; left as a region it came back as a row of black pills). Its two sides
// would be two lines with a strip between them that nobody can colour; one
// line is left where it was.
//
// Then neighbouring regions with no edge between them become one (the bands
// of a sky's gradient).
//
// Returns the regions and the drawn lines among the thin parts (`strokes`):
// with the same area on both sides no border is left of such a line, so its
// middle is kept.
function simplifyRegions(reg, lab, w, h, maxDiff, soft = lab, edge = maxDiff) {
  const n = w * h
  let count = 0
  for (let i = 0; i < n; i++) if (reg[i] + 1 > count) count = reg[i] + 1
  // thin: what an opening takes away (three pixels in, three pixels out again)
  const core = new Uint8Array(n)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, a = reg[p]
    let all = true
    for (let dy = -THIN; dy <= THIN && all; dy++) for (let dx = -THIN; dx <= THIN; dx++) {
      const yy = Math.min(h - 1, Math.max(0, y + dy)), xx = Math.min(w - 1, Math.max(0, x + dx))
      if (reg[yy * w + xx] !== a) { all = false; break }
    }
    core[p] = all ? 1 : 0
  }
  const thinPart = new Uint8Array(n)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, a = reg[p]
    let near = false
    for (let dy = -THIN; dy <= THIN && !near; dy++) for (let dx = -THIN; dx <= THIN; dx++) {
      const yy = y + dy, xx = x + dx
      if (yy < 0 || yy >= h || xx < 0 || xx >= w) continue
      const q = yy * w + xx
      if (core[q] && reg[q] === a) { near = true; break }
    }
    thinPart[p] = near ? 0 : 1
  }
  // the regions' colours, without their thin parts
  const area = new Float64Array(count), mean = new Float64Array(count * 3)
  for (let p = 0; p < n; p++) {
    if (thinPart[p]) continue
    const r = reg[p]
    area[r]++
    mean[r * 3] += lab[p * 3]; mean[r * 3 + 1] += lab[p * 3 + 1]; mean[r * 3 + 2] += lab[p * 3 + 2]
  }
  for (let r = 0; r < count; r++) if (area[r]) for (let c = 0; c < 3; c++) mean[r * 3 + c] /= area[r]
  // the thin parts, piece by piece: a drawn line stands out from what lies
  // beside it; the ragged seam of two bands of a grainy gradient does not
  const pieces = components(thinPart, w, h, 1, 8)
  const pm = new Float64Array(pieces.count * 3), pa = new Float64Array(pieces.count)
  for (let p = 0; p < n; p++) {
    if (!thinPart[p]) continue
    const k = pieces.labels[p]
    pa[k]++
    pm[k * 3] += lab[p * 3]; pm[k * 3 + 1] += lab[p * 3 + 1]; pm[k * 3 + 2] += lab[p * 3 + 2]
  }
  for (let k = 0; k < pieces.count; k++) if (pa[k]) for (let c = 0; c < 3; c++) pm[k * 3 + c] /= pa[k]
  const faint = new Uint8Array(pieces.count)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x
    if (!thinPart[p]) continue
    const k = pieces.labels[p]
    for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
      if (q < 0 || thinPart[q]) continue
      const b = reg[q]
      if (Math.hypot(pm[k * 3] - mean[b * 3], pm[k * 3 + 1] - mean[b * 3 + 1], pm[k * 3 + 2] - mean[b * 3 + 2]) < STROKE_STANDS_OUT) faint[k] = 1
    }
  }
  // the thin parts go to the sides they touch
  const out = Int32Array.from(reg)
  const open = Uint8Array.from(thinPart)
  for (let pass = 0, left = 1; pass < 40 && left; pass++) {
    left = 0
    const prev = out.slice(), was = open.slice()
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const p = y * w + x
      if (!was[p]) continue
      let got = -1
      for (const q of [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1]) {
        if (q >= 0 && !was[q]) { got = prev[q]; break }
      }
      if (got >= 0) { out[p] = got; open[p] = 0 } else left++
    }
  }
  // Neighbours without a visible edge between them become one region. What
  // counts is the step in colour across their shared border, a few pixels to
  // each side: the bands of a sky's gradient differ in their mean colours and
  // have no edge between them; a dark tree in front of a meadow has nearly the
  // meadow's mean colour and a clear edge all round (by mean colours the two
  // ran into one, and the tree's crown stayed open).
  const parent = Int32Array.from({ length: count }, (_, i) => i)
  const find = a => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a }
  const REACH = 3
  const steps = new Map()        // pair of regions -> [sum of steps, samples]
  const sample = (p, q, a, b, dp) => {
    // (not in a thin part: its pixels have a line's or a blend's colour, not
    // the area's; two areas that meet only there are parted by a drawn line)
    if (thinPart[p] || thinPart[q]) return
    // out from the border, as far as both sides stay in their regions
    let pa = p, pb = q
    for (let k = 1; k <= REACH; k++) {
      const na = p - k * dp, nb = q + k * dp
      if (na < 0 || nb >= n || out[na] !== a || out[nb] !== b || thinPart[na] || thinPart[nb]) break
      if (dp === 1 && (((na / w) | 0) !== ((p / w) | 0) || ((nb / w) | 0) !== ((q / w) | 0))) break
      pa = na; pb = nb
    }
    const d = Math.hypot(soft[pa * 3] - soft[pb * 3], soft[pa * 3 + 1] - soft[pb * 3 + 1], soft[pa * 3 + 2] - soft[pb * 3 + 2])
    const key = a < b ? a * count + b : b * count + a
    const e = steps.get(key)
    if (e) { e[0] += d; e[1]++ } else steps.set(key, [d, 1])
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, a = out[p]
    if (x < w - 1 && out[p + 1] !== a) sample(p, p + 1, a, out[p + 1], 1)
    if (y < h - 1 && out[p + w] !== a) sample(p, p + w, a, out[p + w], w)
  }
  // no edge at all: one region, whatever the colours (a gradient). A faint
  // edge: one region if the colours are close too (a soft-edged eye in a
  // face keeps its outline, the two differ enough).
  const apart = (a, b) => Math.hypot(mean[a * 3] - mean[b * 3], mean[a * 3 + 1] - mean[b * 3 + 1], mean[a * 3 + 2] - mean[b * 3 + 2])
  // (what is edge enough to cut an area in two is edge enough to keep two
  // areas apart: a red and an orange shape that overlap were cut and then
  // joined again)
  const faintStep = Math.min(maxDiff, 0.8 * edge)
  for (const [key, [sum, k]] of steps) {
    const a = Math.floor(key / count), b = key % count, step = sum / k
    if (!(step < 0.4 * maxDiff || (step < faintStep && apart(a, b) < 1.2 * maxDiff))) continue
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (let p = 0; p < n; p++) out[p] = find(out[p])
  // the drawn lines: the middle of the thin parts that stand out
  const band = new Uint8Array(n)
  for (let p = 0; p < n; p++) band[p] = thinPart[p] && !faint[pieces.labels[p]] ? 1 : 0
  const mid = thin(band, w, h)
  const strokes = new Uint8Array(n)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x
    if (!mid[p]) continue
    // where a border runs along the band (two different areas), the border is the line
    let border = false
    for (let dy = -3; dy <= 3 && !border; dy++) for (let dx = -3; dx <= 3; dx++) {
      const yy = y + dy, xx = x + dx
      if (yy >= 0 && yy < h && xx >= 0 && xx < w && out[yy * w + xx] !== out[p]) { border = true; break }
    }
    if (!border) strokes[p] = 1
  }
  // a scrap of a line (a piece of a whisker, of a streak) is a crumb
  const sc = components(strokes, w, h, 1, 8)
  for (let p = 0; p < n; p++) if (strokes[p] && sc.areas[sc.labels[p]] < 14) strokes[p] = 0
  return { reg: out, strokes }
}

export function traceShapes(rgba, w, h, detail = 1, extra = null) {
  const L = LEVELS[detail] ?? LEVELS[1]
  // work small: the shapes, not the texture
  const f = Math.max(1, Math.max(w, h) / 480)
  const sw = Math.max(1, Math.round(w / f)), sh = Math.max(1, Math.round(h / f))
  const ch = [new Float32Array(sw * sh), new Float32Array(sw * sh), new Float32Array(sw * sh)]
  const cnt = new Float32Array(sw * sh)
  for (let y = 0; y < h; y++) {
    const sy = Math.min(sh - 1, (y / f) | 0)
    for (let x = 0; x < w; x++) {
      const si = sy * sw + Math.min(sw - 1, (x / f) | 0), p = (y * w + x) * 4
      const a = rgba[p + 3] / 255
      for (let c = 0; c < 3; c++) ch[c][si] += 255 - (255 - rgba[p + c]) * a
      cnt[si]++
    }
  }
  for (let c = 0; c < 3; c++) {
    for (let i = 0; i < cnt.length; i++) ch[c][i] /= cnt[i] || 1
    ch[c] = boxBlur(boxBlur(ch[c], sw, sh, 1), sw, sh, 1)
  }
  const lab = new Float32Array(sw * sh * 3)
  for (let i = 0; i < sw * sh; i++) lab.set(toLab(ch[0][i], ch[1][i], ch[2][i]), i * 3)
  let labels = kmeans(lab, sw * sh, L.k)
  labels = majority(majority(labels, sw, sh), sw, sh)
  const minRegion = Math.max(12, L.minRegion * sw * sh)
  labels = splitAtEdges(labels, lab, sw, sh, L.edge, minRegion)
  let reg = mergeSmall(labels, lab, sw, sh, minRegion, Math.max(12, minRegion / (detail === 0 ? 4 : 8)), L.out) ?? labels
  // (the step between two areas is read from a smoothed picture: in a
  // grainy photo the border of two bands of a gradient is ragged, and the
  // pixels either side of it differ by the grain, which is no edge)
  const soft = new Float32Array(lab.length)
  for (let c = 0; c < 3; c++) {
    let one = new Float32Array(sw * sh)
    for (let i = 0; i < one.length; i++) one[i] = lab[i * 3 + c]
    one = boxBlur(one, sw, sh, 2)
    for (let i = 0; i < one.length; i++) soft[i * 3 + c] = one[i]
  }
  const simple = simplifyRegions(reg, lab, sw, sh, L.merge, soft, L.edge)
  reg = simple.reg
  // the borders between regions, both sides, smoothed and back at full size
  const edge = new Float32Array(sw * sh)
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const p = y * sw + x, a = reg[p]
    if ((x > 0 && reg[p - 1] !== a) || (x < sw - 1 && reg[p + 1] !== a) || (y > 0 && reg[p - sw] !== a) || (y < sh - 1 && reg[p + sw] !== a)) edge[p] = 1
  }
  // and the drawn lines (a little wider: a line one pixel wide breaks apart
  // on the way back to full size)
  // Where the strokes on the paper come with the picture (`extra`), they
  // are the better drawing of the same line: the middle found here lies a
  // pixel or two beside it, and both together made a lumpy line.
  let seen = null
  if (extra) {
    const small = new Uint8Array(sw * sh)
    for (let y = 0; y < h; y++) {
      const row = Math.min(sh - 1, (y / f) | 0) * sw
      for (let x = 0; x < w; x++) if (extra[y * w + x]) small[row + Math.min(sw - 1, (x / f) | 0)] = 1
    }
    seen = dilate(small, sw, sh, 3)
  }
  const wide = dilate(simple.strokes, sw, sh, 1)
  for (let p = 0; p < edge.length; p++) if (wide[p] && !(seen && seen[p])) edge[p] = 1
  const lines = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const fy = Math.min(sh - 1, Math.max(0, (y + 0.5) / f - 0.5))
    const y0 = fy | 0, y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0
    for (let x = 0; x < w; x++) {
      const fx = Math.min(sw - 1, Math.max(0, (x + 0.5) / f - 0.5))
      const x0 = fx | 0, x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0
      const v = (edge[y0 * sw + x0] * (1 - tx) + edge[y0 * sw + x1] * tx) * (1 - ty) + (edge[y1 * sw + x0] * (1 - tx) + edge[y1 * sw + x1] * tx) * ty
      lines[y * w + x] = v >= 0.5 ? 1 : 0
    }
  }
  // a line never thinner than the pages' lines
  const skel = thin(lines, w, h)
  const thick = dilate(skel, w, h, (LINE_WIDTH - 1) / 2)
  for (let i = 0; i < lines.length; i++) if (thick[i]) lines[i] = 1
  const s = (w * h) / (SHEET_SHORT * SHEET_LONG)
  removeSpecks(lines, w, h, L.speck * s)
  if (!extra) return finish(lines, w, h, L.tiny * s, 'photo')
  // with the strokes drawn on the paper (traceMixed): one picture; where a
  // stroke ends just short of an area's border, the gap is closed
  for (let i = 0; i < lines.length; i++) if (extra[i]) lines[i] = 1
  const closed = erode(dilate(lines, w, h, 3), w, h, 3)
  return finish(closed, w, h, L.tiny * s, 'mixed')
}

// Paper with coloured-in areas (a felt-pen drawing): the areas from their
// colours, the strokes from their darkness against the paper. By darkness
// alone a red roof on a yellow house was one dark mass, and blue windows on
// the yellow wall were not there at all.
export function traceMixed(rgba, w, h, detail = 1, light = evenLight(rgba, w, h)) {
  const L = LEVELS[detail] ?? LEVELS[1]
  return traceShapes(rgba, w, h, detail, strokesOf(rgba, light, w, h, L, (w * h) / (SHEET_SHORT * SHEET_LONG)))
}

// ── both ────────────────────────────────────────────────────────────────────

function finish(lines, w, h, tiny, kind) {
  const regions = fillTinyAreas(lines, w, h, tiny)
  let ink = 0
  for (let i = 0; i < lines.length; i++) ink += lines[i]
  const inkShare = ink / lines.length
  // nothing to colour (a blank page, all dark) or a mess of lines
  const reason = regions < 2 ? 'empty' : inkShare > 0.42 ? 'mess' : null
  return { lines, w, h, kind, regions, inkShare, ok: !reason, reason }
}

// How much of the picture is paper once the light is even, and how much of
// it is coloured
function shares(light, rgba) {
  let paper = 0, colourful = 0, n = 0
  const step = Math.max(1, Math.floor(light.length / 60000))
  for (let i = 0; i < light.length; i += step) {
    n++
    if (light[i] > 228) paper++
    const p = i * 4, mx = Math.max(rgba[p], rgba[p + 1], rgba[p + 2]), mn = Math.min(rgba[p], rgba[p + 1], rgba[p + 2])
    if (mx - mn > 60) colourful++
  }
  return { paper: paper / n, colourful: colourful / n }
}

// Line art or a photo? Line art is mostly paper once the light is even.
export function looksLikeLineArt(light, rgba) {
  const { paper, colourful } = shares(light, rgba)
  return paper > 0.62 && colourful < 0.3
}

// Light lines on a dark ground (chalk on a board, a white pen on black
// card): mostly dark, a little bright, hardly any colour between. Turned
// round it is a drawing like any other.
function inverted(rgba) {
  let dark = 0, bright = 0, n = 0
  const step = Math.max(1, Math.floor(rgba.length / 4 / 60000)) * 4
  for (let p = 0; p < rgba.length; p += step) {
    n++
    const mx = Math.max(rgba[p], rgba[p + 1], rgba[p + 2])
    if (mx < 80) dark++
    else if (Math.min(rgba[p], rgba[p + 1], rgba[p + 2]) > 170) bright++
  }
  if (!(dark / n > 0.6 && bright / n > 0.004 && bright / n < 0.25 && (dark + bright) / n > 0.85)) return null
  const out = new Uint8ClampedArray(rgba.length)
  for (let p = 0; p < rgba.length; p += 4) { out[p] = 255 - rgba[p]; out[p + 1] = 255 - rgba[p + 1]; out[p + 2] = 255 - rgba[p + 2]; out[p + 3] = rgba[p + 3] }
  return out
}

// A sheet of paper photographed on a table: the table is not part of the
// drawing. The paper is the bright, colourless part; what is darker, a mass
// (a drawn line that runs off the paper carries nothing along) and reaches
// the picture's edge lies around it. Returns that surround as a mask at
// full size (with the paper's own edge, which would be drawn as a crooked
// frame), or null where there is no such sheet.
export function surroundOf(rgba, w, h) {
  const st = Math.max(1, Math.round(Math.max(w, h) / 220))
  const sw = Math.ceil(w / st), sh = Math.ceil(h / st), n = sw * sh
  const v = new Uint8Array(n), grey = new Uint8Array(n)
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const p = (Math.min(h - 1, y * st + (st >> 1)) * w + Math.min(w - 1, x * st + (st >> 1))) * 4
    const a = rgba[p + 3] / 255
    const r = 255 - (255 - rgba[p]) * a, g = 255 - (255 - rgba[p + 1]) * a, b = 255 - (255 - rgba[p + 2]) * a
    v[y * sw + x] = Math.min(r, g, b)
    grey[y * sw + x] = Math.max(r, g, b) - Math.min(r, g, b) < 60 ? 1 : 0
  }
  // the brightness that parts paper from table best (Otsu)
  const hist = new Float64Array(256)
  for (let i = 0; i < n; i++) hist[v[i]]++
  let sum = 0
  for (let t = 0; t < 256; t++) sum += t * hist[t]
  let wB = 0, sumB = 0, best = 0, cut = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; sumB += t * hist[t]
    const wF = n - wB
    if (!wB || !wF) continue
    const between = wB * wF * (sumB / wB - (sum - sumB) / wF) ** 2
    if (between > best) { best = between; cut = t }
  }
  const bright = new Uint8Array(n)
  let nBright = 0
  for (let i = 0; i < n; i++) if (v[i] > cut && grey[i]) { bright[i] = 1; nBright++ }
  if (nBright < 0.2 * n || nBright > 0.92 * n) return null
  // what is not paper, is a mass and hangs on the picture's edge
  const notPaper = new Uint8Array(n)
  for (let i = 0; i < n; i++) notPaper[i] = bright[i] ? 0 : 1
  const mass = erode(notPaper, sw, sh, 1)
  let around = new Uint8Array(n)
  const stack = []
  const push = i => { if (mass[i] && !around[i]) { around[i] = 1; stack.push(i) } }
  for (let x = 0; x < sw; x++) { push(x); push((sh - 1) * sw + x) }
  for (let y = 0; y < sh; y++) { push(y * sw); push(y * sw + sw - 1) }
  while (stack.length) {
    const i = stack.pop(), x = i % sw
    if (x > 0) push(i - 1)
    if (x < sw - 1) push(i + 1)
    if (i >= sw) push(i - sw)
    if (i < n - sw) push(i + sw)
  }
  // (back to its full width)
  const grown = dilate(around, sw, sh, 1)
  for (let i = 0; i < n; i++) around[i] = grown[i] && notPaper[i] ? 1 : 0
  let nAround = 0, dark = 0
  for (let i = 0; i < n; i++) if (around[i]) { nAround++; dark += v[i] }
  if (nAround < 0.06 * n || nAround > 0.7 * n) return null
  if (dark / nAround > cut - 25) return null                   // hardly darker: no table
  // a table ends at the paper's edge with a step; a shadow that falls
  // across the paper grows dark little by little and is no table
  let step = 0, edges = 0
  for (let y = 0; y < sh; y++) for (let x = 0; x < sw; x++) {
    const i = y * sw + x
    if (!around[i]) continue
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const x1 = x + dx, y1 = y + dy, x2 = x + 3 * dx, y2 = y + 3 * dy, x0 = x - 2 * dx, y0 = y - 2 * dy
      if (x2 < 0 || x2 >= sw || y2 < 0 || y2 >= sh || x0 < 0 || x0 >= sw || y0 < 0 || y0 >= sh) continue
      if (!bright[y1 * sw + x1] || !bright[y2 * sw + x2] || !around[y0 * sw + x0]) continue
      step += v[y2 * sw + x2] - v[y0 * sw + x0]; edges++
    }
  }
  if (!edges || step / edges < 45) return null
  // the sheet itself: mostly paper
  let inPaper = 0
  for (let i = 0; i < n; i++) if (!around[i] && bright[i]) inPaper++
  if (inPaper < 0.75 * (n - nAround)) return null
  const gone = dilate(around, sw, sh, 3)
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    const row = Math.min(sh - 1, (y / st) | 0) * sw
    for (let x = 0; x < w; x++) out[y * w + x] = gone[row + Math.min(sw - 1, (x / st) | 0)]
  }
  return out
}

// On how many of the picture's four sides the surround lies (along half
// the side or more)
function sidesOf(around, w, h) {
  let top = 0, bottom = 0, left = 0, right = 0
  for (let x = 0; x < w; x++) { top += around[x]; bottom += around[(h - 1) * w + x] }
  for (let y = 0; y < h; y++) { left += around[y * w]; right += around[y * w + w - 1] }
  return (top >= w / 2) + (bottom >= w / 2) + (left >= h / 2) + (right >= h / 2)
}

/**
 * The whole way from a picture to a colouring page.
 *   rgba    RGBA pixels at sheet size (sheetSize), Uint8ClampedArray
 *   detail  0 fewer lines, 1 normal, 2 more lines
 * Returns { lines (Uint8Array, 1 = black), w, h, kind, regions, ok, reason }.
 *
 * Three ways, chosen from the picture: pure line art, paper with
 * coloured-in areas, a photo.
 */
export function toColoringPage(rgba, w, h, detail = 1) {
  const picture = inverted(rgba) ?? rgba
  const light = evenLight(picture, w, h)
  // Paper with coloured-in areas, or lines only? Coloured mass in the ink
  // says so (not colour as such: an exercise book's squares are coloured,
  // and so is yellow paper).
  // (Judged at the normal setting, so that all three settings of one
  // picture go the same way.)
  const colouredIn2 = (lt, pic) => solidCores(inkOf(lt, w, h, LEVELS[1], true, pic), w, h, pic).colouredShare() > 0.004
  const colouredIn = lt => colouredIn2(lt, picture)
  // A drawing on a sheet that lies on a table: the sheet alone. The light
  // is evened first (against the table the paper is bright to its edge),
  // then the table counts as paper. Only for a drawing without coloured-in
  // areas: in a colourful one the dark mass at the edge may be drawn grass.
  const around = surroundOf(picture, w, h)
  if (around) {
    const onSheet = Float32Array.from(light)
    const blank = new Uint8ClampedArray(picture)
    for (let i = 0; i < around.length; i++) if (around[i]) { onSheet[i] = 255; blank[i * 4] = blank[i * 4 + 1] = blank[i * 4 + 2] = 255 }
    if (shares(onSheet, blank).paper > 0.62 && !colouredIn(onSheet)) {
      const res = traceLines(picture, w, h, detail, darker(onSheet))
      if (res.ok) return res
    } else if (sidesOf(around, w, h) >= 3) {
      // A coloured-in drawing with something dark round it on three sides
      // or four: that is a table (drawn grass lies along one). The table
      // takes the paper's colour and the picture goes its way without it.
      let r = 0, g = 0, b = 0, k = 0
      for (let i = 0; i < around.length; i += 7) if (!around[i] && light[i] > 228) { r += picture[i * 4]; g += picture[i * 4 + 1]; b += picture[i * 4 + 2]; k++ }
      if (k) {
        for (let i = 0; i < around.length; i++) if (around[i]) { blank[i * 4] = r / k; blank[i * 4 + 1] = g / k; blank[i * 4 + 2] = b / k }
        const lt = evenLight(blank, w, h)
        if (shares(lt, blank).paper > 0.45 && colouredIn2(lt, blank)) {
          const res = traceMixed(blank, w, h, detail, lt)
          if (res.ok) return res
        }
      }
    }
  }
  const { paper } = shares(light, picture)
  if (paper > 0.45 && colouredIn(light)) return traceMixed(picture, w, h, detail, light)
  if (paper > 0.62) return traceLines(picture, w, h, detail, darker(light))
  return traceShapes(picture, w, h, detail)
}

// A very light pencil: the darkest lines on the page are still pale, and
// half the drawing fell under the threshold. The whole page is made darker
// until its darkest lines are as dark as a pencil's (the grain of the paper
// stays well above the threshold). Changes `light` in place and returns it.
function darker(light) {
  const hist = new Uint32Array(256)
  for (let i = 0; i < light.length; i++) hist[Math.max(0, Math.min(255, light[i] | 0))]++
  // the darkest three in a thousand pixels: a line drawing has more ink than that
  let seen = 0, darkest = 255
  for (let v = 0; v < 256; v++) { seen += hist[v]; if (seen >= 0.003 * light.length) { darkest = v; break } }
  if (darkest <= 150 || darkest > 222) return light
  const k = Math.min(3.2, 135 / (255 - darkest))
  for (let i = 0; i < light.length; i++) light[i] = Math.max(0, 255 - (255 - light[i]) * k)
  return light
}
