// Lumis Kleiderschrank: where the eyes and the mouth are on every picture of
// every figure, and the shape of every head and held thing, for the test that
// no hat and nothing held ever lies on an eye or the mouth
// (tests/unit/wardrobe-eyes.test.js).
//
//   node scripts/art/face-zones.mjs            writes tests/unit/face-zones.json
//   node scripts/art/face-zones.mjs out.png    also a picture of the zones found
//   node scripts/art/face-zones.mjs signs      prints the "?" and "Zzz" polygons (`sign`)
//
// Eyes: the two big dark blobs (pupil or closed-eye arc) nearest the face
// anchor's eye points, filled row by row and grown by 2 px (the outline of the
// eye, the lashes). Mouth: below the eyes, the pixels clearly darker than
// the skin (the chick: its orange beak), the part nearest the mouth's usual
// place, filled and grown by 3 px. Things: the picture's alpha on a 128 × 128
// grid (covered where it is more than 30 % opaque). Run it again after a
// figure's or a thing's picture changed; look at the picture it draws.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const W = await import(pathToFileURL(join(ROOT, 'src/lib/wardrobe.js')).href)
const SH = await import(pathToFileURL(join(ROOT, 'src/lib/shapes.js')).href)
const [out] = process.argv.slice(2)
const GRID = 128
const dataUrl = p => `data:image/webp;base64,${readFileSync(join(ROOT, 'public', p)).toString('base64')}`

const page = join(tmpdir(), `face-zones-${process.pid}.html`)
writeFileSync(page, '<canvas id=c width=384 height=384></canvas>')
const browser = await chromium.launch()
const pg = await browser.newPage()
await pg.goto(pathToFileURL(page).href)

// `signs`: the "?" and the "Zzz" painted beside the head on the thinking and
// the sleeping picture (every piece apart from the figure itself): one
// polygon each, its outline grown by up to 3 px but never onto the figure.
// Printed for the `sign` of the poses (lib/wardrobe.js POSES, shapes/<id>-poses.js).
if (out === 'signs') {
  for (const fig of SH.SHAPE_IDS) for (const pose of ['think', 'sleep']) {
    const polys = await pg.evaluate(async src => {
      const img = new Image(); img.src = src; await img.decode()
      const x = document.getElementById('c').getContext('2d'); x.clearRect(0, 0, 384, 384); x.drawImage(img, 0, 0, 384, 384)
      const d = x.getImageData(0, 0, 384, 384).data, N = 384
      const seen = new Int32Array(N * N).fill(-1), comps = []
      for (let i = 0; i < N * N; i++) if (d[4 * i + 3] > 30 && seen[i] < 0) {
        const id = comps.length, q = [i], px = []; seen[i] = id
        while (q.length) {
          const k = q.pop(); px.push(k); const xx = k % N, yy = (k / N) | 0
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const a = xx + dx, b = yy + dy, kk = b * N + a
            if (a >= 0 && b >= 0 && a < N && b < N && d[4 * kk + 3] > 30 && seen[kk] < 0) { seen[kk] = id; q.push(kk) }
          }
        }
        comps.push(px)
      }
      const main = comps.reduce((a, c, i) => (c.length > comps[a].length ? i : a), 0)
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
      const hull = pts => {
        pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]); const lo = [], up = []
        for (const p of pts) { while (lo.length >= 2 && cross(lo.at(-2), lo.at(-1), p) <= 0) lo.pop(); lo.push(p) }
        for (const p of pts.reverse()) { while (up.length >= 2 && cross(up.at(-2), up.at(-1), p) <= 0) up.pop(); up.push(p) }
        return lo.slice(0, -1).concat(up.slice(0, -1))
      }
      const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c } return c }
      // fewer corners: drop the one that adds least (under 6 px²)
      const simple = p => { for (;;) { let bi = -1, ba = 6; p.forEach((b, i) => { const a = p.at(i - 1), c = p[(i + 1) % p.length]; const ar = Math.abs(cross(a, b, c)) / 2; if (ar < ba) { ba = ar; bi = i } }); if (bi < 0 || p.length <= 5) return p; p.splice(bi, 1) } }
      return comps.filter((c, i) => i !== main && c.length >= 25).map(c => {
        const h = hull(c.flatMap(k => { const xx = k % N, yy = (k / N) | 0; return [[xx, yy], [xx + 1, yy], [xx, yy + 1], [xx + 1, yy + 1]] }))
        const cx = h.reduce((s, p) => s + p[0], 0) / h.length, cy = h.reduce((s, p) => s + p[1], 0) / h.length
        for (const g of [3, 2, 1, 0]) {
          const poly = h.map(([x, y]) => { const l = Math.hypot(x - cx, y - cy) || 1; return [Math.round(x + (x - cx) / l * g), Math.round(y + (y - cy) / l * g)] })
          if (g === 0 || !comps[main].some(k => inside(poly, k % N + 0.5, ((k / N) | 0) + 0.5))) return simple(poly)
        }
      })
    }, dataUrl(SH.shapeSrc(fig, pose)))
    console.log(fig, pose, JSON.stringify(polys).replace(/,/g, ', '))
  }
  await browser.close()
  process.exit(0)
}

// eyes and mouth of one picture, as row spans [y, x0, x1] in the 384 square
const findZones = (src, face, chick) => pg.evaluate(async ([src, face, chick]) => {
  const img = new Image(); img.src = src; await img.decode()
  const c = document.getElementById('c'); c.width = c.height = 384
  const x = c.getContext('2d'); x.clearRect(0, 0, 384, 384); x.drawImage(img, 0, 0, 384, 384)
  const d = x.getImageData(0, 0, 384, 384).data
  const N = 384
  const comps = m => {
    const seen = new Uint8Array(N * N), list = []
    for (let i = 0; i < m.length; i++) if (m[i] && !seen[i]) {
      const q = [i], px = []; seen[i] = 1
      while (q.length) {
        const k = q.pop(); px.push(k); const xx = k % N, yy = (k / N) | 0
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const a = xx + dx, b = yy + dy; if (a < 0 || b < 0 || a >= N || b >= N) continue
          const kk = b * N + a; if (m[kk] && !seen[kk]) { seen[kk] = 1; q.push(kk) }
        }
      }
      let sx = 0, sy = 0; for (const k of px) { sx += k % N; sy += (k / N) | 0 }
      list.push({ px, n: px.length, cx: sx / px.length, cy: sy / px.length })
    }
    return list
  }
  // fill each row of a blob between its ends, then grow it by r
  const zone = (px, r) => {
    const rows = new Map()
    for (const k of px) { const xx = k % N, yy = (k / N) | 0; const s = rows.get(yy); if (s) { s[0] = Math.min(s[0], xx); s[1] = Math.max(s[1], xx) } else rows.set(yy, [xx, xx]) }
    const m = new Uint8Array(N * N)
    for (const [yy, [a, b]] of rows) for (let dy = -r; dy <= r; dy++) {
      const y2 = yy + dy; if (y2 < 0 || y2 >= N) continue
      const w = Math.floor(Math.sqrt(r * r - dy * dy))
      for (let xx = Math.max(0, a - w); xx <= Math.min(N - 1, b + w); xx++) m[y2 * N + xx] = 1
    }
    return m
  }
  const spans = m => { const s = []; for (let yy = 0; yy < N; yy++) { let a = -1; for (let xx = 0; xx <= N; xx++) { const on = xx < N && m[yy * N + xx]; if (on && a < 0) a = xx; if (!on && a >= 0) { s.push([yy, a, xx - 1]); a = -1 } } } return s }
  const dark = new Uint8Array(N * N)
  for (let i = 0; i < N * N; i++) dark[i] = d[4 * i + 3] > 160 && Math.max(d[4 * i], d[4 * i + 1], d[4 * i + 2]) < 85 ? 1 : 0
  const blobs = comps(dark).filter(b => b.n > 25)
  let rr = face.rot * Math.PI / 180, ux = Math.cos(rr), uy = Math.sin(rr)
  const want = [-1, 1].map(s => [face.x + s * ux * face.w / 2, face.y + s * uy * face.w / 2])
  const near = (list, [ex, ey], lim) => { let best = null, bd = lim; for (const b of list) { const dd = Math.hypot(b.cx - ex, b.cy - ey); if (dd < bd) { bd = dd; best = b } } return best }
  const eyes = want.map(e => near(blobs, e, face.w * 0.5))
  if (!eyes[0] || !eyes[1]) return { error: 'eyes not found' }
  // the line between the eyes found (the face anchor may sit a little apart)
  const [L, R] = eyes, f = { x: (L.cx + R.cx) / 2, y: (L.cy + R.cy) / 2, w: Math.hypot(R.cx - L.cx, R.cy - L.cy) }
  rr = Math.atan2(R.cy - L.cy, R.cx - L.cx); ux = Math.cos(rr); uy = Math.sin(rr)
  const eyeZones = eyes.map(e => zone(e.px, 2))
  const lum = i => 0.3 * d[4 * i] + 0.59 * d[4 * i + 1] + 0.11 * d[4 * i + 2]
  const at = (u, v) => { const xx = Math.round(f.x + u * ux * f.w - v * uy * f.w), yy = Math.round(f.y + u * uy * f.w + v * ux * f.w); return yy * N + xx }
  const skin = [[-0.3, 0.3], [0.3, 0.3], [-0.35, 0.5], [0.35, 0.5]].map(([u, v]) => lum(at(u, v))).sort((a, b) => a - b)[2]
  const m = new Uint8Array(N * N)
  for (let yy = 0; yy < N; yy++) for (let xx = 0; xx < N; xx++) {
    const i = yy * N + xx, dx = xx - f.x, dy = yy - f.y, u = dx * ux + dy * uy, v = -dx * uy + dy * ux
    if (d[4 * i + 3] < 160 || Math.abs(u) > f.w * 0.42 || v < f.w * 0.08 || v > f.w * 0.7 || eyeZones.some(z => z[i])) continue
    const beak = chick && d[4 * i] > 200 && d[4 * i + 1] > 80 && d[4 * i + 1] < 180 && d[4 * i + 2] < 100
    if (lum(i) < skin * 0.62 || beak) m[i] = 1
  }
  const mt = [f.x - uy * f.w * 0.33, f.y + ux * f.w * 0.33]
  const mouth = comps(m).filter(b => b.n >= 10).sort((a, b) => Math.hypot(a.cx - mt[0], a.cy - mt[1]) - Math.hypot(b.cx - mt[0], b.cy - mt[1]))[0]
  if (!mouth) return { error: 'mouth not found' }
  return { eyes: eyeZones.map(spans), mouth: spans(zone(mouth.px, 3)) }
}, [src, face, chick])

// a thing's alpha on the grid, as base64 bits (row by row)
const alphaBits = src => pg.evaluate(async ([src, G]) => {
  const img = new Image(); img.src = src; await img.decode()
  const c = document.getElementById('c'); c.width = c.height = G
  const x = c.getContext('2d'); x.clearRect(0, 0, G, G); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, G, G)
  const d = x.getImageData(0, 0, G, G).data
  const bytes = new Uint8Array(G * G / 8)
  for (let i = 0; i < G * G; i++) if (d[4 * i + 3] > 77) bytes[i >> 3] |= 1 << (i & 7)
  let s = ''; for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}, [src, GRID])

const zones = {}
for (const fig of SH.SHAPE_IDS) {
  zones[fig] = {}
  for (const pose of SH.SHAPE_POSE_IDS) {
    const z = await findZones(dataUrl(SH.shapeSrc(fig, pose)), SH.posesOf(fig)[pose].face, fig === SH.CHICK)
    if (z.error) throw new Error(`${fig} ${pose}: ${z.error}`)
    zones[fig][pose] = z
  }
}
const things = W.WARDROBE.filter(t => t.slot === 'head' || t.slot === 'hold')
const alpha = {}
for (const t of things) alpha[t.id] = await alphaBits(dataUrl(t.src))
writeFileSync(join(ROOT, 'tests/unit/face-zones.json'), JSON.stringify({ grid: GRID, zones, alpha }))
console.log('wrote tests/unit/face-zones.json:', Object.keys(zones).length, 'figures,', things.length, 'things')

if (out) {
  const rects = sp => sp.map(([y, a, b]) => `<rect x="${a}" y="${y}" width="${b - a + 1}" height="1"/>`).join('')
  const cell = (fig, pose) => `<div style="position:relative;width:384px;height:384px;background:#bfe3f5"><img src="${pathToFileURL(join(ROOT, 'public', SH.shapeSrc(fig, pose))).href}" style="position:absolute;inset:0;width:100%;height:100%"><svg viewBox="0 0 384 384" style="position:absolute;inset:0"><g fill="#f00" opacity=".35">${zones[fig][pose].eyes.map(rects).join('')}</g><g fill="#00f" opacity=".35">${rects(zones[fig][pose].mouth)}</g></svg><span style="position:absolute;font:14px sans-serif">${fig} ${pose}</span></div>`
  writeFileSync(page, `<body style="margin:0;display:grid;grid-template-columns:repeat(7,384px);gap:4px">${SH.SHAPE_IDS.map(f => SH.SHAPE_POSE_IDS.map(p => cell(f, p)).join('')).join('')}</body>`)
  await pg.setViewportSize({ width: 7 * 388, height: 800 })
  await pg.goto(pathToFileURL(page).href); await pg.waitForTimeout(800)
  await pg.screenshot({ path: out, fullPage: true })
  console.log('wrote', out)
}
await browser.close()
