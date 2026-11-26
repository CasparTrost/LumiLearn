// Clothes painted onto the figure: cuts a top and a bottom out of a sheet of
// all seven poses that Tripo dressed, one picture per pose and thing, in the
// frame of the figure's own pose picture, so the app draws them over the pose
// picture as they are (no anchors, no stretching): the sleeves follow the
// arms, the trousers the sitting legs.
//
//   node scripts/art/worn-from-sheet.mjs <figure> <top> <bottom> <sheet.png> [--debug <dir>]
//
//   figure  chick, dino, einhorn, drache or roboter
//   top     the id of the top on the sheet (lib/wardrobe/top.js), e.g. ringelshirt
//   bottom  the id of the bottom (lib/wardrobe/bottom.js), e.g. jeansshorts
//   sheet   what Tripo returned for the template of scripts/art/pose-sheet.mjs
//           (2048 × 1024, white, 4 × 2 cells of 512 px: idle, happy, sad, hmm /
//           think, sleep, wave, empty); any multiple of that size is scaled
//   --debug a folder for pictures of every step (zoomed, on a coloured ground)
//
// Writes public/sprites/wardrobe/worn/<figure>/<thing>-<pose>.webp (512 px,
// transparent, the frame of public/sprites/shapes/<figure>-<pose>.webp) for
// the top and the bottom, and adds both to src/lib/shapes/<figure>-worn.js,
// the list the figure's fit file reads (wornFit in src/lib/wardrobe.js marks
// them `worn`: drawn from these pictures, see figureLayers). For the chick the
// list is src/lib/wardrobe/chick-worn.js, read by lib/wardrobe.js itself.
//
// The steps, per pose:
//  1. Registration: Tripo redraws the figure a pixel or two off. The shift and
//     a tiny scale between the template cell and the result cell are found on
//     what stays the same (the outlines of the head and of the feet).
//  2. The clothes: pixels of the result that are no colour of the template
//     nearby (2 px), not the white ground; cleaned (opening, only the large
//     parts, closing), white stripes inside filled; the hands that stick out
//     stay the template's (they are the same colour as before, so not cut).
//     The rim towards the white ground is un-mixed from the white (no halo),
//     the edge towards a hand or the head feathered by a pixel. Where Tripo
//     drew the body a little narrower than the template, the garment's edge
//     is warped out onto the template's outline (no sliver of bare body).
//  3. Top and bottom: the colours of the chest and of the hips are learnt,
//     each pixel goes to the more likely one, smoothed over its
//     neighbourhood; parts cut off from their side change sides. The top's
//     hem over the waistband stays with the top. Where they meet, each gets
//     a thin rim of its own outline colour (seen when one is worn without
//     the other).
//
// Proof pictures: --debug shows per pose the masks (red top, blue bottom,
// yellow changed but left out), the cut clothes on the pose picture on a
// coloured ground, the clothes alone, and Tripo's picture beside the result
// zoomed twice. Look at them before committing the pictures.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const POSE_ORDER = ['idle', 'happy', 'sad', 'hmm', 'think', 'sleep', 'wave']
const S = 512, N = S * S, COLS = 4

// ── pixels in and out (Chromium's canvas: no image library is installed) ──
let page
const mime = f => (f.endsWith('.webp') ? 'image/webp' : 'image/png')
async function decode(file, size) {
  const b64 = readFileSync(file).toString('base64')
  const r = await page.evaluate(async ({ b64, m, size }) => {
    const img = new Image(); img.src = `data:${m};base64,${b64}`; await img.decode()
    const w = size?.[0] ?? img.naturalWidth, h = size?.[1] ?? img.naturalHeight
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h)
    const d = g.getImageData(0, 0, w, h).data
    let s = ''
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000))
    return { w, h, b: btoa(s) }
  }, { b64, m: mime(file), size })
  return { w: r.w, h: r.h, data: new Uint8ClampedArray(Buffer.from(r.b, 'base64')) }
}
async function encode(img, file, maxKb = 60) {
  const b = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength).toString('base64')
  const url = await page.evaluate(async ({ w, h, b, m, max }) => {
    const s = atob(b); const a = new Uint8ClampedArray(s.length)
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i)
    const c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d').putImageData(new ImageData(a, w, h), 0, 0)
    if (m === 'image/png') return c.toDataURL(m)
    let q = 0.9, url
    for (;;) { url = c.toDataURL(m, q); if (url.length * 0.75 <= max || q <= 0.5) return url; q -= 0.05 }
  }, { w: img.w, h: img.h, b, m: mime(file), max: maxKb * 1024 })
  const buf = Buffer.from(url.split(',')[1], 'base64')
  writeFileSync(file, buf)
  return buf.length
}

// ── masks ──
const n4 = (p, f) => { const x = p % S; if (x > 0) f(p - 1); if (x < S - 1) f(p + 1); if (p >= S) f(p - S); if (p < N - S) f(p + S) }
function flood(seeds, pass) {
  const m = new Uint8Array(N), st = []
  for (const p of seeds) if (!m[p] && pass(p)) { m[p] = 1; st.push(p) }
  while (st.length) n4(st.pop(), q => { if (!m[q] && pass(q)) { m[q] = 1; st.push(q) } })
  return m
}
const disc = r => { const o = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) o.push([dx, dy]); return o }
function dilate(m, r) {
  const o = new Uint8Array(N), D = disc(r)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (m[y * S + x]) for (const [dx, dy] of D) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S && Y < S) o[Y * S + X] = 1 }
  return o
}
const not = m => m.map(v => 1 - v)
const erode = (m, r) => not(dilate(not(m), r))
const and = (a, b) => a.map((v, i) => v & b[i])
function components(m) {
  const lab = new Int32Array(N), comps = [null]
  for (let p = 0; p < N; p++) if (m[p] && !lab[p]) {
    const id = comps.length, px = [p]; lab[p] = id
    for (let k = 0; k < px.length; k++) n4(px[k], q => { if (m[q] && !lab[q]) { lab[q] = id; px.push(q) } })
    comps.push(px)
  }
  return { lab, comps }
}
const border = p => { const x = p % S; return x === 0 || x === S - 1 || p < S || p >= N - S }
// distance (in steps, up to max) from a mask
function distance(m, max) {
  const d = new Uint8Array(N).fill(255); let front = []
  for (let p = 0; p < N; p++) if (m[p]) { d[p] = 0; front.push(p) }
  for (let k = 1; k <= max && front.length; k++) {
    const next = []
    for (const p of front) n4(p, q => { if (d[q] === 255) { d[q] = k; next.push(q) } })
    front = next
  }
  return d
}

// the pixels inside any of the polygons ([[x, y], …] in pixels), even-odd
function polygons(list) {
  const m = new Uint8Array(N)
  for (const pl of list) {
    for (let y = 0; y < S; y++) {
      const xs = []
      for (let i = 0; i < pl.length; i++) {
        const [x1, y1] = pl[i], [x2, y2] = pl[(i + 1) % pl.length]
        if ((y1 <= y + 0.5) !== (y2 <= y + 0.5)) xs.push(x1 + (y + 0.5 - y1) / (y2 - y1) * (x2 - x1))
      }
      xs.sort((a, b) => a - b)
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, Math.ceil(xs[i] - 0.5)); x <= Math.min(S - 1, Math.floor(xs[i + 1] - 0.5)); x++) m[y * S + x] = 1
    }
  }
  return m
}

// ── one pose ──
const dist3 = (X, i, Y, j) => Math.abs(X[i] - Y[j]) + Math.abs(X[i + 1] - Y[j + 1]) + Math.abs(X[i + 2] - Y[j + 2])
const lum = (X, i) => 0.3 * X[i] + 0.59 * X[i + 1] + 0.11 * X[i + 2]

function sampler(sheet, cell) {
  const k = sheet.w / (COLS * S), ox = (cell % COLS) * S * k, oy = Math.floor(cell / COLS) * S * k, D = sheet.data, SW = sheet.w
  return (x, y, out, o) => {
    x = ox + x * k; y = oy + y * k
    const x0 = Math.floor(x), y0 = Math.floor(y)
    if (x < ox || y < oy || x0 + 1 >= ox + S * k || y0 + 1 >= oy + S * k) { out[o] = out[o + 1] = out[o + 2] = 255; return }
    const fx = x - x0, fy = y - y0, a = (y0 * SW + x0) * 4, b = a + 4, c = a + SW * 4, d = c + 4
    for (let ch = 0; ch < 3; ch++) out[o + ch] = (D[a + ch] * (1 - fx) + D[b + ch] * fx) * (1 - fy) + (D[c + ch] * (1 - fx) + D[d + ch] * fx) * fy
  }
}

/** Step 1: the shift (dx, dy) and scale s about the middle that lay the result cell on the template. */
export function register(T, A, sample, P) {
  const k = S / 384, neckY = P.neck.y * k
  let ymax = 0
  for (let p = 0; p < N; p++) if (A[p] > 128) ymax = Math.max(ymax, Math.floor(p / S))
  // points on and near the outlines of the head (above the neck) and the feet
  const pts = []
  for (let y = 2; y < S - 2; y += 2) for (let x = 2; x < S - 2; x += 2) {
    if (!(y < neckY - 20 || y > ymax - 28)) continue
    const p = y * S + x
    let edge = false
    for (const q of [p - 3, p + 3, p - 3 * S, p + 3 * S]) if ((A[q] > 128) !== (A[p] > 128) || Math.abs(lum(T, q * 3) - lum(T, p * 3)) > 40) edge = true
    if (edge) pts.push(p)
  }
  const tmp = new Float32Array(3)
  const cost = (list, s, dx, dy) => {
    let c = 0
    for (const p of list) {
      const x = p % S, y = (p - x) / S
      sample(256 + s * (x - 256) + dx, 256 + s * (y - 256) + dy, tmp, 0)
      c += Math.min(150, Math.abs(tmp[0] - T[p * 3]) + Math.abs(tmp[1] - T[p * 3 + 1]) + Math.abs(tmp[2] - T[p * 3 + 2]))
    }
    return c / list.length
  }
  const third = pts.filter((_, j) => j % 3 === 0), half = pts.filter((_, j) => j % 2 === 0)
  let best = { c: cost(third, 1, 0, 0), s: 1, dx: 0, dy: 0 }
  const none = cost(pts, 1, 0, 0)
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const c = cost(third, 1, dx, dy); if (c < best.c) best = { c, s: 1, dx, dy } }
  let b = { ...best }; best.c = cost(half, b.s, b.dx, b.dy)
  for (let s = 0.96; s <= 1.0401; s += 0.005) for (let dy = b.dy - 3; dy <= b.dy + 3; dy += 0.5) for (let dx = b.dx - 3; dx <= b.dx + 3; dx += 0.5) { const c = cost(half, s, dx, dy); if (c < best.c) best = { c, s, dx, dy } }
  b = { ...best }; best.c = cost(pts, b.s, b.dx, b.dy)
  for (let s = b.s - 0.004; s <= b.s + 0.0041; s += 0.001) for (let dy = b.dy - 0.5; dy <= b.dy + 0.5; dy += 0.25) for (let dx = b.dx - 0.5; dx <= b.dx + 0.5; dx += 0.25) { const c = cost(pts, s, dx, dy); if (c < best.c) best = { c, s, dx, dy } }
  return { s: +best.s.toFixed(3), dx: best.dx, dy: best.dy, cost: +best.c.toFixed(1), before: +none.toFixed(1) }
}

/** Steps 2 and 3 for one pose: { top, bottom } as RGBA 512², plus what the debug pictures show. */
export function cutPose(T, A, W, P, opts = { bottom: true, erase: false }) {
  const k = S / 384
  // Tripo's ground: the cell's border colour (the median), and what is close
  // to it. Pale clothes (a bee's light blue wing, 235 244 250) are not ground
  // (Tripo's white is about 254)
  const G = [0, 1, 2].map(ch => { const v = []; for (let p = 0; p < N; p++) if (border(p)) v.push(W[p * 3 + ch]); v.sort((a, b) => a - b); return v[v.length >> 1] })
  const white = p => Math.abs(W[p * 3] - G[0]) + Math.abs(W[p * 3 + 1] - G[1]) + Math.abs(W[p * 3 + 2] - G[2]) < 22
  // the ground: white reached from the border
  const reach = flood(Array.from({ length: N }, (_, p) => p).filter(border), white)
  // changed: no template colour within R px is close
  const THR = 50
  const changedWithin = (R, p) => {
    const x = p % S, y = (p - x) / S
    let best = 1e9
    for (let e = -R; e <= R && best > THR; e++) for (let d = -R; d <= R; d++) {
      const X = x + d, Y = y + e
      if (X < 0 || Y < 0 || X >= S || Y >= S) continue
      const v = dist3(W, p * 3, T, (Y * S + X) * 3); if (v < best) best = v
    }
    return best > THR
  }
  const changed = new Uint8Array(N)
  // (where the template has no figure, whatever is not Tripo's ground is new:
  // a pale wing or a white coat over the template's white)
  for (let p = 0; p < N; p++) if (!reach[p] && (changedWithin(2, p) || (A[p] < 24 && !white(p)))) changed[p] = 1
  // A white garment over a cream or pale figure (a chef's jacket on the
  // unicorn): Tripo's white is the ground's own white, the figure's is not
  // (it is warmer or greyer). Where Tripo has the ground's white and the
  // template has nothing that white within 2 px, it is new.
  const dG = (X, i) => Math.abs(X[i] - G[0]) + Math.abs(X[i + 1] - G[1]) + Math.abs(X[i + 2] - G[2])
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const p = y * S + x
    if (reach[p] || changed[p] || A[p] < 200 || dG(W, p * 3) > 12) continue
    let near = false
    for (let e = -2; e <= 2 && !near; e++) for (let d = -2; d <= 2; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && dG(T, (Y * S + X) * 3) <= 12) { near = true; break } }
    if (!near) changed[p] = 1
  }
  // white enclosed by the figure is the ground too (a gap between an arm and
  // the body) where the template has no figure either and what encloses it
  // is mostly the figure's own; enclosed by clothes it is clothes (a white
  // coat, the light inside of a bee's wing)
  const bg = reach.slice()
  {
    const { comps } = components(reach.map((v, p) => (!v && white(p) ? 1 : 0)))
    for (const c of comps.slice(1)) {
      let a = 0, rim = 0, ch = 0
      const inC = new Set(c)
      for (const p of c) { a += A[p]; n4(p, q => { if (!inC.has(q) && !white(q)) { rim++; ch += changed[q] } }) }
      if (a / c.length < 100 && ch < 0.5 * rim) for (const p of c) bg[p] = 1
    }
  }
  for (let p = 0; p < N; p++) if (bg[p]) changed[p] = 0
  // clean: opening, the large parts only, closing, back off the ground
  let m = dilate(erode(changed, 2), 2)
  // (the size is that of the parts lying close together: the blue stripes of
  // a shirt on a blue and white robot are found one by one, each small)
  const near = erode(dilate(m, 5), 5)
  const { lab: nlab, comps } = components(near)
  const big = new Uint8Array(N)
  for (let p = 0; p < N; p++) if (m[p] && nlab[p] && comps[nlab[p]].length >= 900) big[p] = 1
  m = and(erode(dilate(big, 2), 2), not(bg))
  // what is cut off by the closing at the edge comes back where it was changed
  const around = dilate(big, 3)
  m = m.map((v, p) => v | (changed[p] && around[p] ? 1 : 0))
  // thin parts of the clothes the opening took (a wing's thin outline) come
  // back where they join the clothes and are surely new: no template colour
  // within 4 px (Tripo's redrawn outlines of the figure are within that)
  {
    const sure = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (changed[p] && !m[p] && changedWithin(4, p)) sure[p] = 1
    const st = []
    for (let p = 0; p < N; p++) if (m[p]) st.push(p)
    while (st.length) n4(st.pop(), q => { if (sure[q] && !m[q]) { m[q] = 1; st.push(q) } })
  }
  const own = dilate(polygons([...(P.wings ?? []), ...(P.feet ?? []), ...(P.tail ?? []), ...(P.front ? [P.front] : []), ...(P.grip ? [P.grip] : [])].map(pl => pl.map(([x, y]) => [x * k, y * k]))), 4)
  // Holes inside the clothes: the parts that Tripo's strokes (every changed
  // pixel, the thin outlines too) cut off from the ground, the head and the
  // figure's own arms, hands and feet. They are clothes in a colour the figure
  // has too: a white coat's sleeve on the white unicorn, a white stripe, a
  // yellow stripe on the yellow chick. A part reaching the ground, or lying
  // above the neck, is the figure's; a part mostly inside its own arms and
  // hands (the polygons of its poses file) stays the figure's too, apart from
  // the bits outside them.
  {
    const strokes = dilate(changed, 1), headY = P.neck.y * k - 12
    const holes = components(m.map((v, p) => (!v && !strokes[p] && !bg[p] ? 1 : 0)))
    for (const c of holes.comps.slice(1)) {
      let touchesBg = false
      for (const p of c) n4(p, q => { if (bg[q]) touchesBg = true })
      if (touchesBg || c.some(border) || c.some(p => p < headY * S)) continue
      const mine = c.filter(p => own[p]).length
      if (c.length < 160 || mine < 0.3 * c.length) for (const p of c) m[p] = 1
      else for (const p of c) if (!own[p]) m[p] = 1
    }
  }
  m = and(m, not(bg))
  // short runs between clothes, along a row or a column, are clothes too
  // when they hold no ground and none of the figure's own arms, hands or
  // feet: a stripe in the figure's own colour (the green and the cream of
  // rainbow leggings) that reaches the garment's edge and so is no hole
  {
    const L = 28, add = new Uint8Array(N)
    const scan = (len, at) => {
      for (let i = 0; i < S; i++) {
        let last = -1
        for (let j = 0; j < len; j++) {
          const p = at(i, j)
          if (!m[p]) continue
          if (last >= 0 && j - last > 1 && j - last <= L) {
            let ok = true
            for (let t = last + 1; t < j && ok; t++) { const q = at(i, t); if (bg[q] || own[q]) ok = false }
            if (ok) for (let t = last + 1; t < j; t++) add[at(i, t)] = 1
          }
          last = j
        }
      }
    }
    scan(S, (y, x) => y * S + x)
    scan(S, (x, y) => y * S + x)
    for (let p = 0; p < N; p++) if (add[p]) m[p] = 1
  }
  // slivers along the garment's edge that look like the figure's outline
  // (Tripo's soft edge): thin or tiny bits of "figure" touching the clothes
  // are clothes
  {
    const rest = m.map((v, p) => (!v && !bg[p] ? 1 : 0))
    const solid = dilate(erode(rest, 1), 1), touch = dilate(m, 1)
    const { comps } = components(rest)
    const tiny = new Uint8Array(N)
    for (const c of comps.slice(1)) if (c.length < 80) for (const p of c) tiny[p] = 1
    for (let p = 0; p < N; p++) if (rest[p] && touch[p] && (!solid[p] || tiny[p])) m[p] = 1
  }

  // ── step 3: top and bottom ──
  const top = { x: P.top.x * k, y: P.top.y * k, w: P.top.w * k }, bot = { x: P.bottom.x * k, y: P.bottom.y * k, w: P.bottom.w * k }
  const q = p => ((W[p * 3] >> 3) << 10) | ((W[p * 3 + 1] >> 3) << 5) | (W[p * 3 + 2] >> 3)
  const hT = new Float32Array(32768), hB = new Float32Array(32768)
  const seedT = [], seedB = []
  for (let p = 0; p < N; p++) {
    if (!m[p]) continue
    const x = p % S, y = (p - x) / S
    if (y > top.y + 12 && y < top.y + 12 + 0.22 * top.w && Math.abs(x - top.x) < 0.3 * top.w) seedT.push(p)
    if (opts.bottom && y > bot.y + 8 && y < bot.y + 8 + 0.2 * bot.w && Math.abs(x - bot.x) < 0.3 * bot.w) seedB.push(p)
  }
  // a colour bin and its neighbours count (a soft histogram)
  const add = (h, p) => { const c = q(p), r = c >> 10, g = (c >> 5) & 31, b = c & 31
    for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) {
      const R2 = r + dr, G = g + dg, B = b + db
      if (R2 < 0 || G < 0 || B < 0 || R2 > 31 || G > 31 || B > 31) continue
      h[(R2 << 10) | (G << 5) | B] += dr || dg || db ? 0.3 : 1
    } }
  for (const p of seedT) add(hT, p)
  for (const p of seedB) add(hB, p)
  const nT = seedT.length || 1, nB = seedB.length || 1
  // A white sleeve over a white arm (a chef's jacket on the unicorn or the
  // robot) has the arm's colour, so the arm stayed the figure's. An arm of
  // the figure (its poses file) that Tripo dressed (much of it changed: the
  // sleeve's outline and folds; much of it white in the top's own colours)
  // gives its white and changed part, joined to the clothes, to the top. A
  // hand (pink, blue) is no white and unchanged: it stays the figure's.
  {
    const headY = P.neck.y * k - 12
    const { comps } = components(own.map((v, p) => (v && !bg[p] && !m[p] && p >= headY * S ? 1 : 0)))
    const isWhite = p => { const r = W[p * 3], g = W[p * 3 + 1], b = W[p * 3 + 2]; return Math.min(r, g, b) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 30 }
    const topLike = p => hT[q(p)] / nT > 0.01 && hT[q(p)] / nT > hB[q(p)] / (seedB.length || 1)
    const added = new Uint8Array(N)
    for (const c of comps.slice(1)) {
      if (c.length < 40) continue
      // an arm Tripo dressed: much of it changed (the sleeve's outline and
      // folds), and white in the top's own colours
      const ch = c.filter(p => changed[p]).length, wh = c.filter(p => isWhite(p) && topLike(p)).length
      if (ch < 0.12 * c.length || wh < 0.3 * c.length) continue
      for (const p of c) if ((isWhite(p) && topLike(p)) || changed[p]) added[p] = 1
    }
    // closed, and only next to the clothes: the sleeve, not a hand
    const shut = erode(dilate(added, 2), 2)
    const st = []
    for (let p = 0; p < N; p++) if (m[p]) st.push(p)
    while (st.length) n4(st.pop(), q2 => { if (shut[q2] && !m[q2] && !bg[q2]) { m[q2] = 1; st.push(q2) } })
  }
  let prob = new Float32Array(N)
  for (let p = 0; p < N; p++) {
    if (!m[p]) continue
    const a = hT[q(p)] / nT, b = hB[q(p)] / nB
    // where neither has the colour: by height between the chest and the hips
    const y = Math.floor(p / S), byY = Math.min(1, Math.max(0, (bot.y - y) / Math.max(1, bot.y - top.y - 20)))
    prob[p] = a + b > 1e-4 ? (a + 0.02 * byY) / (a + b + 0.02) : byY
  }
  // Parts in a colour neither the chest nor the hips have (a bee's wings, a
  // hood's ears, a cape) go whole to one side: to the top when they lie above
  // the waist, else to the bottom. Parts are grown from a pixel to the
  // neighbours of about its colour.
  {
    const seen = new Uint8Array(N)
    for (let p0 = 0; p0 < N; p0++) {
      if (!m[p0] || seen[p0]) continue
      const ref = p0 * 3, part = [p0]; seen[p0] = 1
      for (let i = 0; i < part.length; i++) n4(part[i], q => { if (m[q] && !seen[q] && dist3(W, q * 3, W, ref) < 45) { seen[q] = 1; part.push(q) } })
      if (part.length < 60) continue
      let none = 0, cy = 0
      for (const p of part) { if (hT[q(p)] / nT + hB[q(p)] / nB < 0.02) none++; cy += Math.floor(p / S) }
      if (none > 0.6 * part.length) { const v = cy / part.length < bot.y ? 1 : 0; for (const p of part) prob[p] = v }
    }
  }
  // smoothing over the neighbourhood (inside the clothes)
  const r = 4
  for (let it = 0; it < 3; it++) {
    const o = new Float32Array(N)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x; if (!m[p]) continue
      let s = 0, c = 0
      for (let e = -r; e <= r; e++) for (let d = -r; d <= r; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const qq = Y * S + X; if (m[qq]) { s += prob[qq]; c++ } }
      o[p] = 0.5 * prob[p] + 0.5 * s / c
    }
    prob = o
  }
  let isTop = m.map((v, p) => (v && prob[p] >= 0.5 ? 1 : 0)), isBot = m.map((v, p) => (v && prob[p] < 0.5 ? 1 : 0))
  // the border between them smoothed (a majority over a small disc), so the
  // hem runs smoothly, not in teeth
  for (let it = 0; it < 3; it++) {
    const t2 = isTop.slice()
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x
      if (!m[p]) continue
      let a = 0, n = 0
      for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { if (d * d + e * e > 10) continue; const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const qq = Y * S + X; if (m[qq]) { a += isTop[qq]; n++ } }
      t2[p] = 2 * a > n ? 1 : 2 * a < n ? 0 : isTop[p]
    }
    isTop = t2; isBot = m.map((v, p) => (v && !isTop[p] ? 1 : 0))
  }
  // parts cut off from their side change sides (or go when tiny)
  for (let pass = 0; pass < 2; pass++) {
    for (const [mine, other, seed] of [[isTop, isBot, seedT], [isBot, isTop, seedB]]) {
      const { lab, comps } = components(mine)
      const keep = new Set(seed.map(p => lab[p]).filter(Boolean))
      // the largest part counts as seeded too
      let li = 0; for (let i = 1; i < comps.length; i++) if (!li || comps[i].length > comps[li].length) li = i
      if (li) keep.add(li)
      // (only small ones: a large part keeps its colour's side, like a trouser
      // leg that the sitting feet cut off from the rest)
      for (let i = 1; i < comps.length; i++) {
        if (keep.has(i)) continue
        const c = comps[i], sure = c.reduce((a, p) => a + Math.abs(prob[p] - 0.5), 0) / c.length
        if (c.length < 300 || sure < 0.12) for (const p of c) { mine[p] = 0; other[p] = 1 }
      }
    }
  }
  // a sheet with a top only (a pyjama top): only the top
  if (!opts.bottom) {
    // what Tripo changed below it (it redrew the legs or the feet now and
    // then) is no thing to wear: the split is made as usual, the top kept
    isBot = new Uint8Array(N)
    m = m.map((v, p) => (v && isTop[p] ? 1 : 0))
  }

  // ── the colours and the soft edge ──
  const nearBg = distance(bg, 2)
  // Tripo's figure that is no clothes (head, hands, tail, feet)
  const other = m.map((v, p) => (!v && !bg[p] ? 1 : 0))
  const nearOther = distance(other, 3)
  const cov = (sel, x, y) => {
    let s = 0, c = 0
    for (let e = -1; e <= 1; e++) for (let d = -1; d <= 1; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const w = d || e ? 1 : 2; s += sel[Y * S + X] * w; c += w }
    return s / c
  }
  // the colours inside: as Tripo painted them; the rim towards the white
  // ground un-mixed from the white, against the darkest colour inside nearby
  // (the garment's outline), so no white halo is left
  const RGB = new Float32Array(N * 3), AL = new Float32Array(N)
  for (const sel of [isTop, isBot]) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const p = y * S + x
    if (!sel[p]) continue
    let rgb = [W[p * 3], W[p * 3 + 1], W[p * 3 + 2]], a = 1
    if (nearBg[p] <= 2) {
      let F = p, fl = 1e9
      for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const qq = Y * S + X; if (sel[qq] && !bg[qq]) { const l = lum(W, qq * 3); if (l < fl) { fl = l; F = qq } } }
      const f = [W[F * 3], W[F * 3 + 1], W[F * 3 + 2]], bw = f.map(v => 255 - v)
      const al = Math.max(0, Math.min(1, ((255 - rgb[0]) * bw[0] + (255 - rgb[1]) * bw[1] + (255 - rgb[2]) * bw[2]) / Math.max(1, bw[0] ** 2 + bw[1] ** 2 + bw[2] ** 2)))
      if (al < 0.999) rgb = rgb.map((v, i) => (al > 0.15 ? Math.max(0, Math.min(255, (v - (1 - al) * 255) / al)) : f[i]))
      // over the template's body the garment covers it whole
      a = A[p] > 200 ? 1 : Math.max(al, A[p] / 255)
    } else if (nearOther[p] <= 1) a = Math.max(0.5, cov(sel, x, y)) // soft towards a hand or the head
    RGB.set(rgb, p * 3); AL[p] = a
  }
  // Where Tripo's clothes stop short of the template's outline (its body was
  // drawn a little narrower), a sliver of the bare body would show beside
  // them. There the garment is pushed out to the template's outline by a
  // smooth warp: at the template's outline it moves by the gap (up to GAP
  // px), BAND px inside the garment not at all, in between as smoothly as can
  // be (Laplace's equation); the garment's own dark outline lands on the
  // template's. Not next to the figure's own parts (a hand, the tail).
  const GAP = 10, BAND = 16
  const lab = new Uint8Array(N)
  for (let p = 0; p < N; p++) lab[p] = isTop[p] ? 1 : isBot[p] ? 2 : 0
  const rimPx = []
  for (let p = 0; p < N; p++) if (m[p]) { let r2 = false; n4(p, q => { if (bg[q]) r2 = true }); if (r2) rimPx.push(p) }
  // outwards: the gap, each pixel with its nearest rim pixel
  const srcOut = new Int32Array(N).fill(-1)
  for (const p of rimPx) srcOut[p] = p
  let front = rimPx.slice()
  // A bottom that replaces the legs (a mermaid's tail): Tripo painted no legs,
  // feet or tail of the figure below the neck, so what of the template's
  // figure lies there on Tripo's white ground is cut away (`erase`, a mask
  // for the pose picture) instead of being covered
  const gone = new Uint8Array(N)
  if (opts.erase) {
    const y0 = P.neck.y * k - 10
    for (let p = 0; p < N; p++) if (bg[p] && A[p] > 24 && Math.floor(p / S) > y0) gone[p] = 1
    // and the old legs' outline next to it (Tripo's soft rim is no ground),
    // not the figure's own arms and hands, nor the clothes
    const wide = dilate(gone, 3)
    for (let p = 0; p < N; p++) if (wide[p] && !m[p] && !own[p] && A[p] > 24 && Math.floor(p / S) > y0) gone[p] = 1
  }
  const eligible = q => !m[q] && bg[q] && A[q] > 24 && nearOther[q] > 2 && !gone[q]
  for (let k2 = 1; k2 <= GAP && front.length; k2++) {
    const next = []
    for (const p of front) n4(p, q => { if (srcOut[q] < 0 && eligible(q)) { srcOut[q] = srcOut[p]; next.push(q) } })
    front = next
  }
  // inwards: the band
  const inBand = new Uint8Array(N)
  front = rimPx.slice(); for (const p of rimPx) inBand[p] = 1
  for (let k2 = 1; k2 < BAND && front.length; k2++) {
    const next = []
    for (const p of front) n4(p, q => { if (!inBand[q] && m[q]) { inBand[q] = 1; next.push(q) } })
    front = next
  }
  // the outermost gap pixels (on the template's outline) are fixed: they show the rim pixel they came from
  const gapPx = [], fixed = new Uint8Array(N), DX = new Float32Array(N), DY = new Float32Array(N)
  for (let q = 0; q < N; q++) if (srcOut[q] >= 0 && !m[q]) {
    gapPx.push(q)
    let edge = false
    n4(q, r2 => { if (A[r2] <= 24) edge = true })
    if (edge) { fixed[q] = 1; DX[q] = (q % S) - (srcOut[q] % S); DY[q] = Math.floor(q / S) - Math.floor(srcOut[q] / S) }
  }
  // rim pixels where the clothes reach past the template already stay
  for (const p of rimPx) { let past = false; n4(p, q => { if (bg[q] && A[q] <= 24) past = true }); if (past) fixed[p] = 1 }
  // the fixed shifts smoothed along the outline (the nearest rim pixel jumps)
  const fx0 = gapPx.filter(q => fixed[q])
  const sm = fx0.map(q => {
    const x = q % S, y = (q - x) / S
    let sx = 0, sy = 0, c = 0
    for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const r2 = Y * S + X; if (fixed[r2] && !m[r2]) { sx += DX[r2]; sy += DY[r2]; c++ } }
    return [sx / c, sy / c]
  })
  fx0.forEach((q, i) => { DX[q] = sm[i][0]; DY[q] = sm[i][1] })
  const domain = [...gapPx.filter(q => !fixed[q]), ...Array.from({ length: N }, (_, p) => p).filter(p => inBand[p] && !fixed[p])]
  const inDom = new Uint8Array(N); for (const p of domain) inDom[p] = 1
  if (fx0.length) for (let it = 0; it < 400; it++) {
    for (const p of domain) {
      let sx = 0, sy = 0, c = 0
      n4(p, q => {
        if (inDom[q] || fixed[q]) { sx += DX[q]; sy += DY[q]; c++ }
        else if (m[q]) c++ // deeper inside: not moved
      })
      if (c) { DX[p] = sx / c; DY[p] = sy / c }
    }
  }
  // the colour at a point of the clothes (bilinear over clothes pixels only)
  const at = (fx, fy, out) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    let r = 0, gg = 0, b = 0, w = 0, best = -1, bw2 = -1
    for (const [X, Y, wt] of [[x0, y0, (1 - (fx - x0)) * (1 - (fy - y0))], [x0 + 1, y0, (fx - x0) * (1 - (fy - y0))], [x0, y0 + 1, (1 - (fx - x0)) * (fy - y0)], [x0 + 1, y0 + 1, (fx - x0) * (fy - y0)]]) {
      if (X < 0 || Y < 0 || X >= S || Y >= S) continue
      const q = Y * S + X
      if (!m[q] || wt <= 0) continue
      r += RGB[q * 3] * wt; gg += RGB[q * 3 + 1] * wt; b += RGB[q * 3 + 2] * wt; w += wt
      if (wt > bw2) { bw2 = wt; best = q }
    }
    if (!w) return -1
    out[0] = r / w; out[1] = gg / w; out[2] = b / w
    return best
  }
  const RGB2 = RGB.slice(), AL2 = AL.slice(), lab2 = lab.slice(), tmp = [0, 0, 0]
  for (const p of [...domain, ...fx0]) {
    if (Math.abs(DX[p]) + Math.abs(DY[p]) < 0.05) continue
    const x = p % S, y = (p - x) / S
    let q = at(x - DX[p], y - DY[p], tmp)
    if (q < 0) { // fell off the clothes: the nearest rim pixel
      const s2 = srcOut[p] >= 0 ? srcOut[p] : -1
      if (s2 < 0 || !m[s2]) continue
      q = s2; tmp[0] = RGB[s2 * 3]; tmp[1] = RGB[s2 * 3 + 1]; tmp[2] = RGB[s2 * 3 + 2]
    }
    RGB2[p * 3] = tmp[0]; RGB2[p * 3 + 1] = tmp[1]; RGB2[p * 3 + 2] = tmp[2]
    if (lab[q]) lab2[p] = lab[q]
    AL2[p] = m[p] ? (A[p] > 200 ? 1 : AL[p]) : A[p] / 255
  }
  const mk = (layer, rimFrom) => {
    const sel = lab.map(v => (v === layer ? 1 : 0))
    const out = { w: S, h: S, data: new Uint8ClampedArray(N * 4) }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x
      let rgb, a
      if (lab2[p] === layer) { rgb = [RGB2[p * 3], RGB2[p * 3 + 1], RGB2[p * 3 + 2]]; a = AL2[p]; if (rimFrom && rimFrom[p]) rgb = rimFrom[p] }
      else if (other[p]) {
        // just outside towards a hand or the head: a faint fringe of the nearest colour inside
        const c = cov(sel, x, y) * 0.6
        if (c <= 0.02) continue
        let bq = -1
        for (let e = -1; e <= 1 && bq < 0; e++) for (let d = -1; d <= 1; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && sel[Y * S + X] && nearBg[Y * S + X] > 2) { bq = Y * S + X; break } }
        if (bq < 0) continue
        rgb = [RGB[bq * 3], RGB[bq * 3 + 1], RGB[bq * 3 + 2]]; a = c
      } else continue
      const o = p * 4
      out.data[o] = rgb[0]; out.data[o + 1] = rgb[1]; out.data[o + 2] = rgb[2]; out.data[o + 3] = Math.round(a * 255)
    }
    return out
  }
  // Where top and bottom meet (the hem over the waistband), each gets a thin
  // rim of its own outline colour, so either worn alone (or with another
  // thing) ends in a line, not in a cut: the bottom where the hem covered it,
  // the top's hem where it lay on the bottom. Worn together it is hidden or
  // the hem's own line.
  const outline = sel => {
    const px = []
    for (let p = 0; p < N; p++) if (sel[p] && nearBg[p] <= 1) px.push(p)
    if (!px.length) return null
    px.sort((u, v) => lum(RGB, u * 3) - lum(RGB, v * 3))
    const q2 = px[Math.floor(px.length * 0.1)]
    return [RGB[q2 * 3], RGB[q2 * 3 + 1], RGB[q2 * 3 + 2]]
  }
  const seam = (mine, other, below) => {
    const rim = new Array(N), near = distance(other, 2), dark = outline(mine)
    if (!dark) return rim
    for (let p = 0; p < N; p++) if (mine[p] && near[p] > 0 && near[p] <= 2) {
      // only across the hem (the other above, or below), not beside it (a sleeve)
      const q2 = p + (below ? 3 : -3) * S
      if (q2 >= 0 && q2 < N && other[q2]) rim[p] = dark
    }
    return rim
  }
  let erase = null
  if (opts.erase) {
    // opaque where the pose picture stays, clear where it is cut away (soft by a pixel)
    erase = { w: S, h: S, data: new Uint8ClampedArray(N * 4) }
    const g2 = dilate(gone, 1)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x
      let c = 0
      if (g2[p]) { let n = 0; for (let e = -1; e <= 1; e++) for (let d = -1; d <= 1; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S) { c += gone[Y * S + X]; n++ } } c /= n }
      erase.data[p * 4] = erase.data[p * 4 + 1] = erase.data[p * 4 + 2] = 255; erase.data[p * 4 + 3] = Math.round(255 * (1 - c))
    }
  }
  return { erase, top: mk(1, seam(isTop, isBot, true)), bottom: mk(2, seam(isBot, isTop, false)), masks: { bg, changed, m, isTop, isBot, seedT, seedB } }
}

// ── the command ──
async function main() {
  const args = process.argv.slice(2)
  const di = args.indexOf('--debug')
  const debug = di >= 0 ? args.splice(di, 2)[1] : null
  const usage = 'node scripts/art/worn-from-sheet.mjs <figure> <top> [<bottom>] <sheet.png> | <figure> --all <dir> [--debug <dir>]'
  const figure = args[0]
  // the sheets: one, or every <figure>-<top>[-<bottom>].png in a folder
  let jobs
  if (args[1] === '--all') {
    jobs = readdirSync(args[2]).filter(f => f.startsWith(figure + '-') && f.endsWith('.png')).sort()
      .map(f => { const [top, bottom = null] = f.slice(figure.length + 1, -4).split('-'); return { top, bottom, file: join(args[2], f) } })
  } else if (args.length === 4) jobs = [{ top: args[1], bottom: args[2] === '-' ? null : args[2], file: args[3] }]
  else if (args.length === 3) jobs = [{ top: args[1], bottom: null, file: args[2] }]
  if (!figure || !jobs?.length) { console.error(usage); process.exit(1) }
  const chick = figure === 'chick'
  const W8 = await import(pathToFileURL(join(ROOT, 'src/lib/wardrobe.js')).href)
  for (const j of jobs) for (const [id, slot] of [[j.top, 'top'], [j.bottom, 'bottom']]) if (id && W8.ITEM_BY_ID[id]?.slot !== slot) throw new Error(`${id} is no ${slot} in the wardrobe`)
  const POSES = chick ? W8.POSES : (await import(pathToFileURL(join(ROOT, `src/lib/shapes/${figure}-poses.js`)).href)).default
  const basePic = pose => join(ROOT, 'public/sprites', chick ? `emoji/custom/lumi-${pose}.webp` : `shapes/${figure}-${pose}.webp`)
  const outDir = join(ROOT, 'public/sprites/wardrobe/worn', figure)
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  page = await browser.newPage()
  // the figure's own pose pictures, on white (T) and their coverage (A)
  const bases = {}
  for (const pose of POSE_ORDER) {
    const base = await decode(basePic(pose), [S, S])
    const T = new Float32Array(N * 3), A = new Uint8Array(N)
    for (let p = 0; p < N; p++) {
      const a = base.data[p * 4 + 3] / 255; A[p] = base.data[p * 4 + 3]
      for (let ch = 0; ch < 3; ch++) T[p * 3 + ch] = base.data[p * 4 + ch] * a + 255 * (1 - a)
    }
    bases[pose] = { T, A }
  }
  const done = []
  for (const job of jobs) {
    const sheet = await decode(job.file)
    if (Math.abs(sheet.w / sheet.h - 2) > 0.01) throw new Error(`${job.file} is ${sheet.w} × ${sheet.h}, not 2 : 1`)
    const name = [figure, job.top, job.bottom].filter(Boolean).join('-')
    const dbg = debug && join(debug, name)
    if (dbg) mkdirSync(dbg, { recursive: true })
    const report = []
    const tail = !!(job.bottom && W8.ITEM_BY_ID[job.bottom].feet === false)
    for (let i = 0; i < POSE_ORDER.length; i++) {
      const pose = POSE_ORDER[i], P = POSES[pose], { T, A } = bases[pose]
      const sample = sampler(sheet, i)
      const reg = register(T, A, sample, P)
      const W = new Float32Array(N * 3)
      for (let p = 0; p < N; p++) { const x = p % S, y = (p - x) / S; sample(256 + reg.s * (x - 256) + reg.dx, 256 + reg.s * (y - 256) + reg.dy, W, p * 3) }
      const cut = cutPose(T, A, W, P, { bottom: !!job.bottom, erase: tail })
      const kb = []
      for (const [id, img] of [[job.top, cut.top], [job.bottom, cut.bottom]]) if (id) kb.push(Math.round(await encode(img, join(outDir, `${id}-${pose}.webp`)) / 1024))
      if (tail) kb.push(Math.round(await encode(cut.erase, join(outDir, `${job.bottom}-${pose}-mask.webp`)) / 1024))
      const count = mm => mm.reduce((a, b) => a + b, 0)
      report.push({ pose, s: reg.s, dx: reg.dx, dy: reg.dy, cost: reg.cost, before: reg.before, top: count(cut.masks.isTop), bottom: count(cut.masks.isBot), kb: kb.join('+') })
      if (dbg) await debugPictures(dbg, pose, T, A, W, cut)
    }
    console.log(name); console.table(report)
    done.push(job.top); if (job.bottom) done.push(job.bottom)
  }
  await browser.close()
  // the list the fit file reads
  const listFile = join(ROOT, chick ? 'src/lib/wardrobe/chick-worn.js' : `src/lib/shapes/${figure}-worn.js`)
  let ids = []
  if (existsSync(listFile)) ids = [...readFileSync(listFile, 'utf8').matchAll(/^\s*'([^']+)',$/gm)].map(x => x[1])
  ids = [...new Set([...ids, ...done])].sort()
  writeFileSync(listFile, `// Things ${chick ? 'the chick' : `the ${figure}`} wears as painted on it by Tripo: drawn from\n// public/sprites/wardrobe/worn/${figure}/<id>-<pose>.webp over the pose picture\n// (\`worn\`, see wornFit in ../wardrobe.js). Written by\n// scripts/art/worn-from-sheet.mjs; one line per thing.\nexport default [\n${ids.map(id => `  '${id}',`).join('\n')}\n]\n`)
  console.log('wrote', outDir, 'and', listFile)
}

// zoomed pictures of the steps, on a coloured ground (halos show)
async function debugPictures(dir, pose, T, A, W, cut) {
  const { bg, changed, m, isTop, isBot } = cut.masks
  const img = { w: S * 3, h: S, data: new Uint8ClampedArray(N * 3 * 4) }
  const put = (panel, p, rgb) => { const x = p % S, y = (p - x) / S, o = (y * S * 3 + panel * S + x) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255 }
  const ground = [120, 70, 160]
  for (let p = 0; p < N; p++) {
    const g = lum(T, p * 3) * 0.7
    put(0, p, isTop[p] ? [255, g * 0.5, g * 0.5] : isBot[p] ? [g * 0.5, g * 0.5, 255] : changed[p] ? [255, 255, 0] : bg[p] ? [40, 40, 40] : [g, g, g])
    // the base with the cut clothes over it, on a coloured ground
    const a0 = A[p] / 255, a1 = a0 * (cut.erase ? cut.erase.data[p * 4 + 3] / 255 : 1)
    let c = a0 > 0 ? [0, 1, 2].map(ch => (T[p * 3 + ch] - 255 * (1 - a0)) / Math.max(a0, 1e-3) * a1 + ground[ch] * (1 - a1)) : ground
    for (const L of [cut.bottom, cut.top]) { const a = L.data[p * 4 + 3] / 255; if (a) c = c.map((v, ch) => L.data[p * 4 + ch] * a + v * (1 - a)) }
    put(1, p, c)
    // the clothes alone on dark
    let d = [30, 30, 30]
    for (const L of [cut.bottom, cut.top]) { const a = L.data[p * 4 + 3] / 255; if (a) d = d.map((v, ch) => L.data[p * 4 + ch] * a + v * (1 - a)) }
    put(2, p, d)
  }
  void m
  await encode(img, join(dir, `${pose}.png`))
  // zoomed twice: Tripo's picture beside the cut clothes on the pose picture
  const x0 = 60, y0 = 170, cw = 400, ch = 330, Z = 2
  const z = { w: cw * Z * 2 + 8, h: ch * Z, data: new Uint8ClampedArray((cw * Z * 2 + 8) * ch * Z * 4).fill(255) }
  for (let y = 0; y < ch * Z; y++) for (let x = 0; x < cw * Z; x++) {
    const p = (y0 + Math.floor(y / Z)) * S + x0 + Math.floor(x / Z)
    const o1 = (y * z.w + x) * 4, o2 = (y * z.w + x + cw * Z + 8) * 4
    z.data[o1] = W[p * 3]; z.data[o1 + 1] = W[p * 3 + 1]; z.data[o1 + 2] = W[p * 3 + 2]
    const px = p % S, py = (p - px) / S, so = (py * S * 3 + S + px) * 4
    z.data[o2] = img.data[so]; z.data[o2 + 1] = img.data[so + 1]; z.data[o2 + 2] = img.data[so + 2]
  }
  await encode(z, join(dir, `${pose}-zoom.png`))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
