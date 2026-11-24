/**
 * Buchstaben-Spuren: the strokes of every glyph, the level plan, and the
 * check whether a finger followed a stroke.
 *
 * Coordinates live in a box 100 wide and 140 high (y grows downwards). Capitals
 * and digits stand on the baseline y = 130 and reach up to y = 10. Each glyph
 * is a list of strokes in the order a child learns to write them in German
 * school print (Druckschrift): top to bottom, left to right, straight lines
 * before the bowl. Each stroke runs in its writing direction — the start dot
 * sits on its first point.
 *
 * Strokes are written as segments (straight lines and elliptic arcs) and then
 * resampled every STEP units, so a round letter is as smooth as a straight one
 * and the check below can count points along the way.
 */

export const BOX  = { w: 100, h: 140 }
export const STEP = 2.5

// ─── Building blocks ─────────────────────────────────────────────────────────
const line = (...pts) => ({ line: pts })
/** Elliptic arc. Angles in degrees, 0 = right, 90 = down (screen y). a0 → a1
 *  in either direction: decreasing runs counter-clockwise on screen. */
const arc  = (cx, cy, rx, ry, a0, a1) => ({ arc: [cx, cy, rx, ry, a0, a1] })

function rawPoints(segments) {
  const out = []
  const push = (x, y) => {
    const l = out[out.length - 1]
    if (!l || Math.hypot(l.x - x, l.y - y) > 1e-6) out.push({ x, y })
  }
  for (const s of segments) {
    if (s.line) s.line.forEach(([x, y]) => push(x, y))
    else {
      const [cx, cy, rx, ry, a0, a1] = s.arc
      const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / 2))
      for (let i = 0; i <= n; i++) {
        const a = ((a0 + (a1 - a0) * i / n) * Math.PI) / 180
        push(cx + rx * Math.cos(a), cy + ry * Math.sin(a))
      }
    }
  }
  return out
}

/** Even spacing along the path, no gap longer than `step`, ends kept exactly. */
function resample(pts, step = STEP) {
  const cum = [0]
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  const total = cum[cum.length - 1]
  const n = Math.max(1, Math.ceil(total / step))
  const out = []
  let j = 1
  for (let k = 0; k <= n; k++) {
    const s = (total * k) / n
    while (j < pts.length - 1 && cum[j] < s) j++
    const a = pts[j - 1], b = pts[j]
    const t = cum[j] > cum[j - 1] ? Math.min(1, (s - cum[j - 1]) / (cum[j] - cum[j - 1])) : 0
    out.push({ x: +(a.x + (b.x - a.x) * t).toFixed(2), y: +(a.y + (b.y - a.y) * t).toFixed(2) })
  }
  return out
}

// ─── The glyphs ──────────────────────────────────────────────────────────────
// T, E, F, H: the upright first ("erst runter"), then the bars from the left.
// V, W, Z, N's slant and U are one stroke each, without lifting the pen.
// B: the upright, then both bowls in one go (Grundschrift, Druckschrift): the
// pen runs into the upright at the waist and out again, it is not lifted.
const DEFS = {
  A: [[line([50, 10], [16, 130])], [line([50, 10], [84, 130])], [line([28, 90], [72, 90])]],
  B: [
    [line([24, 10], [24, 130])],
    [
      line([24, 10], [44, 10]), arc(44, 38, 27, 28, 270, 450), line([44, 66], [24, 66]),
      line([24, 66], [46, 66]), arc(46, 98, 32, 32, 270, 450), line([46, 130], [24, 130]),
    ],
  ],
  C: [[arc(56, 70, 40, 60, 320, 40)]],
  D: [[line([24, 10], [24, 130])], [line([24, 10], [42, 10]), arc(42, 70, 38, 60, 270, 450), line([42, 130], [24, 130])]],
  E: [[line([28, 10], [28, 130])], [line([28, 10], [76, 10])], [line([28, 70], [68, 70])], [line([28, 130], [76, 130])]],
  F: [[line([28, 10], [28, 130])], [line([28, 10], [76, 10])], [line([28, 70], [68, 70])]],
  G: [[arc(56, 70, 38, 60, 320, 0), line([94, 70], [62, 70])]],
  H: [[line([24, 10], [24, 130])], [line([76, 10], [76, 130])], [line([24, 70], [76, 70])]],
  I: [[line([50, 10], [50, 130])]],
  J: [[line([66, 10], [66, 96]), arc(43, 96, 23, 34, 0, 165)]],
  K: [[line([24, 10], [24, 130])], [line([78, 10], [26, 72], [80, 130])]],
  L: [[line([30, 10], [30, 130], [76, 130])]],
  M: [[line([16, 10], [16, 130])], [line([16, 10], [50, 90], [84, 10], [84, 130])]],
  N: [[line([20, 10], [20, 130])], [line([20, 10], [80, 130], [80, 10])]],
  O: [[arc(50, 70, 40, 60, 270, -90)]],
  P: [[line([24, 10], [24, 130])], [line([24, 10], [46, 10]), arc(46, 40, 30, 30, 270, 450), line([46, 70], [24, 70])]],
  Q: [[arc(50, 70, 40, 60, 270, -90)], [line([58, 98], [88, 136])]],
  R: [[line([24, 10], [24, 130])], [line([24, 10], [46, 10]), arc(46, 40, 30, 30, 270, 450), line([46, 70], [30, 70], [80, 130])]],
  S: [[arc(50, 41, 29, 31, 335, 90), arc(50, 101, 31, 29, 270, 505)]],
  T: [[line([50, 10], [50, 130])], [line([18, 10], [82, 10])]],
  U: [[line([20, 10], [20, 92]), arc(50, 92, 30, 38, 180, 0), line([80, 92], [80, 10])]],
  V: [[line([16, 10], [50, 130], [84, 10])]],
  W: [[line([6, 10], [28, 130], [50, 10], [72, 130], [94, 10])]],
  X: [[line([18, 10], [82, 130])], [line([82, 10], [18, 130])]],
  Y: [[line([16, 10], [50, 70])], [line([84, 10], [50, 70], [50, 130])]],
  Z: [[line([18, 10], [82, 10], [18, 130], [82, 130])]],

  // Digits as taught in German schools: the 1 with its up-stroke and no foot,
  // the open 4 in two strokes, the 5 with its hat last, and the 7 with its
  // cross stroke (as in all three Ausgangsschriften: next to a 1 with an
  // up-stroke, the cross stroke is what tells the two apart).
  0: [[arc(50, 70, 32, 60, 270, -90)]],
  1: [[line([32, 42], [60, 10], [60, 130])]],
  2: [[arc(50, 42, 30, 32, 195, 400), line([73, 62.6], [20, 130], [82, 130])]],
  3: [[arc(48, 40, 28, 30, 205, 450), arc(48, 100, 32, 30, 270, 500)]],
  4: [[line([52, 10], [18, 92], [82, 92])], [line([64, 48], [64, 130])]],
  5: [[line([30, 10], [30, 66]), arc(48, 95, 32, 35, 236, 500)], [line([30, 10], [76, 10])]],
  6: [[arc(62, 98, 42, 88, 285, 180), arc(50, 98, 30, 32, 180, -170)]],
  7: [[line([20, 10], [80, 10], [40, 130])], [line([42, 74], [76, 74])]],
  8: [[arc(50, 40, 26, 30, 270, 90), arc(50, 100, 31, 30, 270, 630), arc(50, 40, 26, 30, 90, -90)]],
  9: [[arc(50, 42, 28, 32, 0, -360), line([78, 42], [74, 130])]],
}

/** { A: [[{x,y}, …], …], … } — every stroke sampled every STEP units. */
export const GLYPHS = Object.fromEntries(
  Object.entries(DEFS).map(([g, strokes]) => [g, strokes.map(s => resample(rawPoints(s)))])
)

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
export const DIGITS  = '0123456789'.split('')
export const isDigit = g => DIGITS.includes(g)

/** SVG path data of one stroke. */
export const pathOf = stroke => stroke.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')

/** Length of a stroke, and the running length at every sample. */
export function lengths(stroke) {
  const cum = [0]
  for (let i = 1; i < stroke.length; i++)
    cum.push(cum[i - 1] + Math.hypot(stroke[i].x - stroke[i - 1].x, stroke[i].y - stroke[i - 1].y))
  return cum
}

/** Point and direction (radians) at arc length s along a stroke. */
export function pointAt(stroke, s, cum = lengths(stroke)) {
  const total = cum[cum.length - 1]
  s = Math.max(0, Math.min(total, s))
  let i = 1
  while (i < cum.length - 1 && cum[i] < s) i++
  const a = stroke[i - 1], b = stroke[i]
  const t = cum[i] > cum[i - 1] ? (s - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, angle: Math.atan2(b.y - a.y, b.x - a.x) }
}

// ─── Level plan ──────────────────────────────────────────────────────────────
// Straight lines first, then slants, the round ones, curves and lines mixed,
// the digits; from level 7 on everything mixed, with less help each time.
// `learn` keeps its order (the easiest of a level comes first), from level 4
// on one glyph of an earlier level comes back in between.
export const ROUNDS = 5
const PLAN = [
  { learn: 'ILTHEF' },
  { learn: 'AVWMNKXZY' },
  { learn: 'COUJS' },
  { learn: 'DPBRGQ',   review: 1 },
  { learn: '147023',   review: 1 },
  { learn: '5689',     review: 1 },
]

/**
 * How much help a level gives.
 *   arrows: 'all' along the stroke, 'start' only one at its beginning, 'none'
 *   road:   how strongly the path is drawn (1 = full)
 */
export function guidanceFor(level) {
  if (level >= 10) return { arrows: 'none',  road: 0.32 }
  if (level >= 9)  return { arrows: 'start', road: 0.5 }
  if (level >= 7)  return { arrows: 'start', road: 1 }
  return { arrows: 'all', road: 1 }
}

const shuffle = (arr, rand) => {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** The five glyphs of a level. */
export function glyphsForLevel(level, rand = Math.random) {
  const lv = Math.max(1, Math.min(10, Math.round(level) || 1))
  const all = [...LETTERS, ...DIGITS]
  if (lv > PLAN.length) {
    // Mixed review: mostly letters, always at least one digit
    const digit = shuffle(DIGITS, rand)[0]
    return shuffle([digit, ...shuffle(LETTERS, rand).slice(0, ROUNDS - 1)], rand)
  }
  const cfg = PLAN[lv - 1]
  const review = cfg.review ?? 0
  const learn = [...cfg.learn]
  // a random choice from the level's glyphs, in their easy-to-hard order
  const keep = new Set(shuffle(learn, rand).slice(0, ROUNDS - review))
  const picked = learn.filter(g => keep.has(g))
  if (!review) return picked
  const earlier = PLAN.slice(0, lv - 1).flatMap(p => [...p.learn])
  const back = shuffle(earlier.filter(g => all.includes(g)), rand).slice(0, review)
  // never first: the round opens with something new
  const at = 1 + Math.floor(rand() * picked.length)
  picked.splice(at, 0, ...back)
  return picked
}

// ─── Following a stroke ──────────────────────────────────────────────────────
// All in box units. 12 % of the box height: a road about a finger wide on a
// phone, wide enough for a four-year-old's wobble.
export const TOL        = 17
export const START_TOL  = 21     // how close to the green dot a stroke may start
const AHEAD      = 22            // how far along the path one move may reach
const BACK       = 30            // … and how far behind the finger is still looked for
const JUMP       = 8             // a longer jump does not count the points skipped
const STALL      = 42            // finger travel away from the progress: wrong way
const MIN_COVER  = 0.8           // share of the stroke's points passed in order
const END_AUTO   = 4             // this close to the end, the stroke is done
const END_UP     = 12            // … or this close when the finger is lifted
const TAP        = 10            // shorter than this is a tap, not an attempt

// Where a stroke runs back along itself (the waist of the B: into the stem
// and out again), a finger is exactly as near to the way in as to the way
// out. `from` is the progress so far: of two equally near places the one
// ahead of it counts, or the finger would never get out of the stem again.
function nearestOnSegments(stroke, cum, q, i0, i1, from = null) {
  let best = { d: Infinity, s: 0 }, ahead = null
  for (let i = i0; i <= i1; i++) {
    const a = stroke[i], b = stroke[i + 1]
    const dx = b.x - a.x, dy = b.y - a.y
    const len2 = dx * dx + dy * dy
    const t = len2 ? Math.max(0, Math.min(1, ((q.x - a.x) * dx + (q.y - a.y) * dy) / len2)) : 0
    const d = Math.hypot(q.x - (a.x + dx * t), q.y - (a.y + dy * t))
    const s = cum[i] + (cum[i + 1] - cum[i]) * t
    if (d < best.d) best = { d, s }
    if (from != null && s > from && (!ahead || d < ahead.d)) ahead = { d, s }
  }
  return ahead && best.s <= from && ahead.d <= best.d + 1e-3 ? ahead : best
}

/**
 * Follows one attempt at one stroke.
 *
 *   const t = makeTracer(stroke)
 *   t.down(p)  → 'ok' | 'wrongStart'
 *   t.move(p)  → 'ok' | 'done' | 'offPath' | 'wrongWay' | 'wrongStart'
 *   t.up()     → 'done' | 'tap' | 'short' | 'wrongStart'
 *
 * Progress only moves forward along the path, and only a little ahead of the
 * finger's last place on it: a finger that wanders off, starts at the far end
 * or runs backwards never gets there. 'done' needs the end of the stroke and
 * at least 80 % of its points passed in order.
 */
export function makeTracer(stroke, { tol = TOL, startTol = START_TOL } = {}) {
  const cum = lengths(stroke)
  const n = stroke.length
  const total = cum[n - 1]
  const covered = new Uint8Array(n)
  const segAt = s => {
    let i = 0
    while (i < n - 2 && cum[i + 1] < s) i++
    return i
  }
  let last = null, startOk = false, pos = 0, travel = 0, sinceAdvance = 0, offRun = 0

  const coverage = () => covered.reduce((a, b) => a + b, 0) / n
  const complete = slack => pos >= total - slack && coverage() >= MIN_COVER

  // The finger's place on the path, searched only near the progress so far:
  // a little behind (an acute corner, a wobble) and a little ahead.
  function advance(q, step) {
    const r = nearestOnSegments(stroke, cum, q, segAt(pos - BACK), segAt(pos + AHEAD), pos)
    if (r.d > tol) { sinceAdvance += step; return }        // on another part of the path
    if (r.s > pos + 0.3) {
      const from = r.s - pos <= JUMP ? pos : r.s - STEP
      for (let i = 0; i < n; i++) if (cum[i] > from && cum[i] <= r.s) covered[i] = 1
      pos = r.s
      sinceAdvance = 0
    } else if (r.s < pos - BACK / 2) sinceAdvance += step   // running backwards
  }

  return {
    get progress() { return total ? pos / total : 1 },
    get real() { return travel >= TAP },
    get started() { return startOk },
    down(p) {
      last = p
      startOk = Math.hypot(p.x - stroke[0].x, p.y - stroke[0].y) <= startTol
      if (!startOk) return 'wrongStart'
      covered[0] = 1
      advance(p, 0)
      return 'ok'
    },
    move(p) {
      if (!last) return 'ok'
      const dist = Math.hypot(p.x - last.x, p.y - last.y)
      const steps = Math.max(1, Math.ceil(dist / 1.5))
      for (let k = 1; k <= steps; k++) {
        const q = { x: last.x + (p.x - last.x) * k / steps, y: last.y + (p.y - last.y) * k / steps }
        const step = dist / steps
        travel += step
        if (!startOk) { if (travel > TAP) return 'wrongStart'; continue }
        const d = nearestOnSegments(stroke, cum, q, 0, n - 2).d
        if (d > tol * 1.6) return 'offPath'
        if (d > tol) { offRun += step; if (offRun > 6) return 'offPath' } else offRun = 0
        advance(q, step)
        if (sinceAdvance > STALL) return 'wrongWay'
        if (complete(END_AUTO)) { last = p; return 'done' }
      }
      last = p
      return 'ok'
    },
    up() {
      if (startOk && complete(END_UP)) return 'done'
      if (travel < TAP) return 'tap'
      return startOk ? 'short' : 'wrongStart'
    },
  }
}
