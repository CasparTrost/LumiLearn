// Lumi's shapes (src/lib/shapes.js): brings the pictures of each shape to
// ONE scale and Lumi's size and ground line and writes
// public/sprites/shapes/<id>-<pose>.webp (512 px, transparent), seven poses
// like Lumi's: the six sources and "hmm", which is "think" without the "?"
// (Lumi's face after a miss has no question mark). Run shapes-measure.mjs first.
//
//   node scripts/art/shapes-convert.mjs <folder with <id>-<pose>.png>
//
// The sources were each fitted to their frame on their own, so a sitting
// friend (sleep) came out as tall as a standing one, with a bigger head.
// Here every standing pose gets Lumi's height (HEIGHT of the square, as tall
// as the chick in lumi-*.webp; the median of the shape's standing poses),
// the feet stand on Lumi's ground line (GROUND), the head is centred,
// and shapes-fix.json holds what was corrected by eye (`k`: the sleeping
// pictures drawn smaller so the head keeps its size; `dx`: a shift; `erase`:
// a box [x0, y0, x1, y1] of the source (0…1) cleared for "hmm": the
// unicorn's "?" lies inside its figure's box).
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: node scripts/art/shapes-convert.mjs <png folder>'); process.exit(1) }
const ROOT = join(import.meta.dirname, '..', '..')
const OUT = join(ROOT, 'public/sprites/shapes')
const m = JSON.parse(readFileSync(join(import.meta.dirname, 'shapes-measure.json'), 'utf8'))
const FIX = JSON.parse(readFileSync(join(import.meta.dirname, 'shapes-fix.json'), 'utf8'))
const ids = ['dino', 'einhorn', 'drache', 'roboter'], poses = ['idle', 'happy', 'sad', 'think', 'wave', 'sleep']
const SIZE = 512
const GROUND = 0.969   // Lumi's feet in its square
const HEIGHT = 0.94    // a standing shape's height in its square, as Lumi's

mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const pg = await b.newPage()
for (const id of ids) {
  const stand = poses.filter(p => p !== 'sleep').map(p => m[`${id}-${p}`]).map(v => v.fig[3] - v.fig[1]).sort((a, c) => a - c)
  const ref = stand[Math.floor(stand.length / 2)]
  for (const p of [...poses, 'hmm']) {
    // "hmm" is drawn from "think", without the parts outside the figure (the "?")
    const from = p === 'hmm' ? 'think' : p
    const v = m[`${id}-${from}`], fix = FIX[`${id}-${from}`] ?? {}
    const S = SIZE * HEIGHT / ref * (fix.k ?? 1)
    const hx = v.head.cx + (fix.dx ?? 0) * v.W
    const tx = SIZE / 2 - hx * S, ty = SIZE * GROUND - v.fig[3] * S
    const box = (p === 'hmm' ? v.fig : v.all).map((c, i) => (i % 2 ? ty + c * S : tx + c * S))
    if (box[0] < 0 || box[1] < 0 || box[2] > SIZE || box[3] > SIZE) console.log('OUT OF THE SQUARE', id, p, box.map(Math.round))
    const url = 'data:image/png;base64,' + readFileSync(join(SRC, `${id}-${from}.png`)).toString('base64')
    const data = await pg.evaluate(async ({ url, S, tx, ty, SIZE, fig, erase }) => {
      const img = new Image(); img.src = url; await img.decode()
      let src = img
      if (fig) {
        // keep the figure and what lies inside its box (tears), drop the rest
        const W = img.naturalWidth, H = img.naturalHeight
        const c0 = document.createElement('canvas'); c0.width = W; c0.height = H
        const g0 = c0.getContext('2d'); g0.drawImage(img, 0, 0)
        const im = g0.getImageData(0, 0, W, H), d = im.data
        const seen = new Uint8Array(W * H), st = new Int32Array(W * H)
        for (let i = 0; i < W * H; i++) {
          if (seen[i] || d[i * 4 + 3] <= 40) continue
          let sp = 0, n = 0; st[sp++] = i; seen[i] = 1; const part = []
          let x0 = W, y0 = H, x1 = 0, y1 = 0
          while (sp) {
            const k = st[--sp]; part.push(k); n++
            const x = k % W, y = (k / W) | 0
            if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
            for (const m of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) {
              if (m >= 0 && !seen[m] && d[m * 4 + 3] > 40) { seen[m] = 1; st[sp++] = m }
            }
          }
          const inside = x0 >= fig[0] && x1 <= fig[2] && y0 >= fig[1] && y1 <= fig[3]
          if (!inside) for (const k of part) {
            // the faint edge around a dropped part goes too
            const x = k % W, y = (k / W) | 0
            for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
              const xx = x + dx, yy = y + dy
              if (xx >= 0 && yy >= 0 && xx < W && yy < H) {
                const q = yy * W + xx
                if (d[q * 4 + 3] <= 40) d[q * 4 + 3] = 0
              }
            }
            d[k * 4 + 3] = 0
          }
        }
        // a "?" that touches nothing but lies inside the figure's box: erased by hand
        if (erase) for (let y = Math.round(erase[1] * H); y < erase[3] * H; y++) for (let x = Math.round(erase[0] * W); x < erase[2] * W; x++) d[(y * W + x) * 4 + 3] = 0
        g0.putImageData(im, 0, 0)
        src = c0
      }
      const c = document.createElement('canvas'); c.width = c.height = SIZE
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'
      g.drawImage(src, tx, ty, (img.naturalWidth) * S, (img.naturalHeight) * S)
      return c.toDataURL('image/webp', 0.86)
    }, { url, S, tx, ty, SIZE, fig: p === 'hmm' ? v.fig : null, erase: p === 'hmm' ? fix.erase ?? null : null })
    const f = join(OUT, `${id}-${p}.webp`)
    writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'))
    console.log(id, p, 'box', box.map(Math.round).join(' '), Math.round(statSync(f).size / 1024) + ' KB')
  }
}
await b.close()
