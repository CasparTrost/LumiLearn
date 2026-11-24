// Sternbilder: makes the dot-to-dot outlines from the app's illustrated
// pictures and writes them into ../outlines.js (between the markers).
//
//   node src/games/sternbilder/tools/trace.mjs            (needs Playwright's Chromium)
//   node src/games/sternbilder/tools/gallery.mjs out.png  (look at every outline!)
//
// specs.json lists the outlines: { id, name, art, rot?, and fixed | auto }
//   id     picture + number of stars (+ v/h for a turned variant): "rocket20v"
//   art    code of the picture in public/sprites/emoji
//   rot    degrees the picture is turned clockwise (a rocket standing upright)
//   fixed  the stars, placed by hand, in units (0..100) of the unturned picture:
//          for few stars only the corners that make the thing recognisable work
//   auto   the stars are searched: the polygon on the silhouette's contour that
//          covers it best while no two stars come closer than a fingertip
//
// A new outline is only good if the bare line still shows what it is: check
// it in the gallery before it goes into the game.
import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const here = p => fileURLToPath(new URL(p, import.meta.url))
const ART = here('../../../../public/sprites/emoji/')
const TARGET = here('../outlines.js')
const specs = JSON.parse(fs.readFileSync(here('./specs.json'), 'utf8'))

// The room for star centres on a phone held upright and sideways (px), and
// how far apart the stars should be there. See skyInset() in outlines.js.
const UPRIGHT = [320, 636, 66], SIDEWAYS = [716, 262, 54]

// In the page: the silhouette of a picture (S × S px), its contour, and for
// `n` the best polygon on the contour whose corners keep `need` px apart.
const pageFn = async ({ src, n, need }) => {
  const S = 200, OPEN = 2
  const img = new Image()
  img.src = src
  await img.decode()
  const cv = document.createElement('canvas'); cv.width = cv.height = S
  const cx = cv.getContext('2d')
  cx.drawImage(img, 0, 0, S, S)
  const data = cx.getImageData(0, 0, S, S).data
  let mask = new Uint8Array(S * S)
  for (let i = 0; i < S * S; i++) mask[i] = data[i * 4 + 3] > 110 ? 1 : 0
  const at = (m, x, y) => (x < 0 || y < 0 || x >= S || y >= S ? 0 : m[y * S + x])

  // thin bits (strings, stems, sparkles) go: erode, then dilate
  const disc = []
  for (let dy = -OPEN; dy <= OPEN; dy++) for (let dx = -OPEN; dx <= OPEN; dx++) if (dx * dx + dy * dy <= OPEN * OPEN) disc.push([dx, dy])
  const morph = (m, erode) => {
    const o = new Uint8Array(S * S)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let v = erode ? 1 : 0
      for (const [dx, dy] of disc) { const a = at(m, x + dx, y + dy); if (erode && !a) { v = 0; break } if (!erode && a) { v = 1; break } }
      o[y * S + x] = v
    }
    return o
  }
  mask = morph(morph(mask, true), false)

  // the largest piece only, holes filled
  const lab = new Int32Array(S * S); let best = 0, bestN = 0, cur = 0
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]]
  for (let i = 0; i < S * S; i++) {
    if (!mask[i] || lab[i]) continue
    cur++; let cnt = 0; const st = [i]; lab[i] = cur
    while (st.length) {
      const p = st.pop(); cnt++; const x = p % S, y = (p / S) | 0
      for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const q = Y * S + X; if (mask[q] && !lab[q]) { lab[q] = cur; st.push(q) } }
    }
    if (cnt > bestN) { bestN = cnt; best = cur }
  }
  for (let i = 0; i < S * S; i++) mask[i] = lab[i] === best ? 1 : 0
  const out = new Uint8Array(S * S); const st = []
  for (let k = 0; k < S; k++) for (const p of [k, (S - 1) * S + k, k * S, k * S + S - 1]) if (!mask[p] && !out[p]) { out[p] = 1; st.push(p) }
  while (st.length) {
    const p = st.pop(); const x = p % S, y = (p / S) | 0
    for (const [dx, dy] of N4) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const q = Y * S + X; if (!mask[q] && !out[q]) { out[q] = 1; st.push(q) } }
  }
  for (let i = 0; i < S * S; i++) mask[i] = out[i] ? 0 : 1

  // the contour, clockwise (Moore neighbourhood tracing)
  let sx = -1, sy = -1
  outer: for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (mask[y * S + x]) { sx = x; sy = y; break outer }
  const N8 = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]
  const contour = []
  let x = sx, y = sy, dir = 6
  for (let guard = 0; guard < 20000; guard++) {
    contour.push([x, y])
    let found = false
    for (let k = 0; k < 8; k++) {
      const d = (dir + 6 + k) % 8
      const X = x + N8[d][0], Y = y + N8[d][1]
      if (at(mask, X, Y)) { x = X; y = Y; dir = d; found = true; break }
    }
    if (!found || (x === sx && y === sy)) break
  }
  const L = contour.length
  const thin = contour.filter((_, i) => i % 3 === 0)
  if (!n) return { contour: thin }

  // how well a polygon covers the silhouette (intersection over union)
  const G = 100, gs = S / G
  const gm = new Uint8Array(G * G); let gmN = 0
  for (let gy = 0; gy < G; gy++) for (let gx = 0; gx < G; gx++) { const v = mask[Math.floor((gy + 0.5) * gs) * S + Math.floor((gx + 0.5) * gs)]; gm[gy * G + gx] = v; gmN += v }
  const iou = pts => {
    let inter = 0, polyN = 0
    const m = pts.length
    for (let gy = 0; gy < G; gy++) {
      const yy = (gy + 0.5) * gs
      const xs = []
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[(i + 1) % m]
        if ((a[1] <= yy && b[1] > yy) || (b[1] <= yy && a[1] > yy)) xs.push(a[0] + ((yy - a[1]) / (b[1] - a[1])) * (b[0] - a[0]))
      }
      xs.sort((p, q) => p - q)
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.max(0, Math.ceil(xs[k] / gs - 0.5)), x1 = Math.min(G - 1, Math.floor(xs[k + 1] / gs - 0.5))
        for (let gx = x0; gx <= x1; gx++) { polyN++; inter += gm[gy * G + gx] }
      }
    }
    return inter / (gmN + polyN - inter)
  }
  const minDist = pts => {
    let d = Infinity
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) d = Math.min(d, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]))
    return d
  }
  const P = ix => ix.map(i => contour[((i % L) + L) % L])
  const score = ix => { const pts = P(ix); return iou(pts) - 12 * Math.max(0, (need - minDist(pts)) / need) }

  // from a few even starts: move each corner along the contour to where the
  // score is best, until nothing improves
  let bestIdx = null, bestAll = -1e9
  for (let phase = 0; phase < 5; phase++) {
    const idx = Array.from({ length: n }, (_, i) => Math.round(((i + phase / 5) * L) / n))
    let bestS = score(idx)
    for (let sweep = 0; sweep < 40; sweep++) {
      let improved = false
      for (let i = 0; i < n; i++) {
        const lo = idx[(i - 1 + n) % n] - (i === 0 ? L : 0), hi = idx[(i + 1) % n] + (i === n - 1 ? L : 0)
        const old = idx[i]; let bestC = old
        for (let cand = lo + 2; cand < hi - 1; cand += 2) {
          if (cand === old) continue
          idx[i] = cand
          const s = score(idx)
          if (s > bestS + 1e-6) { bestS = s; bestC = cand; improved = true }
        }
        idx[i] = bestC
      }
      if (!improved) break
    }
    if (bestS > bestAll) { bestAll = bestS; bestIdx = idx.slice() }
  }
  bestIdx.sort((a, b) => (((a % L) + L) % L) - (((b % L) + L) % L))
  return { contour: thin, pts: P(bestIdx) }
}

const browser = await chromium.launch()
const page = await browser.newPage()
const r1 = v => Math.round(v * 10) / 10
const emoji = code => String.fromCodePoint(...code.split('-').map(c => parseInt(c, 16)))
const lines = []
for (const sp of specs) {
  const src = `data:image/webp;base64,${fs.readFileSync(ART + sp.art + '.webp').toString('base64')}`
  const rot = sp.rot ?? 0
  const rad = (rot * Math.PI) / 180, co = Math.cos(rad), si = Math.sin(rad)
  const turn = ([px, py]) => [50 + (px - 50) * co - (py - 50) * si, 50 + (px - 50) * si + (py - 50) * co]
  const units = list => list.map(([x, y]) => turn([x / 2, y / 2]))
  // the silhouette, turned, in units
  const cont = units((await page.evaluate(pageFn, { src })).contour)
  let pts
  if (sp.fixed) pts = sp.fixed.map(turn)
  else {
    const xs = cont.map(p => p[0]), ys = cont.map(p => p[1])
    const bw = Math.max(...xs) - Math.min(...xs), bh = Math.max(...ys) - Math.min(...ys)
    const need = Math.min(...[UPRIGHT, SIDEWAYS].map(([w, h, px]) => px / Math.min(w / bw, h / bh)))
    pts = units((await page.evaluate(pageFn, { src, n: Number(sp.id.match(/\d+/)[0]), need: Math.round(need * 2 * 10) / 10 })).pts)
    // begin at the top
    const s0 = pts.reduce((b, p, i) => (p[1] < pts[b][1] ? i : b), 0)
    pts = pts.map((_, i) => pts[(i + s0) % pts.length])
  }
  pts = pts.map(p => p.map(r1))
  const all = [...pts, ...cont], xs = all.map(p => p[0]), ys = all.map(p => p[1])
  const box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(r1)
  const pic = sp.id.replace(/\d+[vh]?$/, '')
  lines.push(`  { id: '${sp.id}', pic: '${pic}', name: '${sp.name}', art: '${emoji(sp.art)}', rot: ${rot}, box: [${box.join(', ')}], pts: [${pts.map(p => `[${p.join(', ')}]`).join(', ')}] },`)
  console.log(sp.id)
}
await browser.close()

const js = fs.readFileSync(TARGET, 'utf8')
const a = js.indexOf('// <outlines>'), b = js.indexOf('// </outlines>')
if (a < 0 || b < 0) throw new Error('markers not found in outlines.js')
fs.writeFileSync(TARGET, js.slice(0, a) + '// <outlines>\n' + lines.join('\n') + '\n  ' + js.slice(b))
console.log(lines.length, 'outlines written')
