// Lumis Freunde: measures the source pictures of the friends (and Lumi's own
// pictures for comparison) and writes scripts/art/friends-measure.json, which
// friends-convert.mjs reads.
//
//   node scripts/art/friends-measure.mjs <folder with <id>-<pose>.png>
//
// Per picture: the figure (the biggest connected opaque part; the "?" and the
// "Zzz" are separate parts and left out), its box, the box of everything, and
// the head (the widest row between 10 % and 30 % of the figure's height).
// The sources (about 1024 px, transparent) are on the branch tripo-kleiderschrank.
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: node scripts/art/friends-measure.mjs <png folder>'); process.exit(1) }
const ROOT = join(import.meta.dirname, '..', '..')
const ids = ['dino', 'einhorn', 'drache', 'roboter'], poses = ['idle', 'happy', 'sad', 'think', 'wave', 'sleep']
const files = []
for (const p of ['idle', 'happy', 'sad', 'hmm', 'think', 'wave', 'sleep']) files.push({ key: `lumi-${p}`, url: 'data:image/webp;base64,' + readFileSync(join(ROOT, `public/sprites/emoji/custom/lumi-${p}.webp`)).toString('base64') })
for (const id of ids) for (const p of poses) files.push({ key: `${id}-${p}`, url: 'data:image/png;base64,' + readFileSync(join(SRC, `${id}-${p}.png`)).toString('base64') })

const b = await chromium.launch()
const pg = await b.newPage()
const out = {}
for (const f of files) {
  out[f.key] = await pg.evaluate(async ({ url }) => {
    const img = new Image(); img.src = url; await img.decode()
    const W = img.naturalWidth, H = img.naturalHeight
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, W, H).data
    const on = new Uint8Array(W * H)
    for (let i = 0; i < W * H; i++) on[i] = d[i * 4 + 3] > 40 ? 1 : 0
    // connected parts (4 neighbours); the biggest is the figure
    const lab = new Int32Array(W * H); let n = 0; const sizes = [0]; const boxes = [null]
    const st = new Int32Array(W * H)
    for (let i = 0; i < W * H; i++) {
      if (!on[i] || lab[i]) continue
      n++; let sp = 0; st[sp++] = i; lab[i] = n; let cnt = 0
      let x0 = W, y0 = H, x1 = 0, y1 = 0
      while (sp) {
        const k = st[--sp]; cnt++
        const x = k % W, y = (k / W) | 0
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
        for (const m of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, y > 0 ? k - W : -1, y < H - 1 ? k + W : -1]) {
          if (m >= 0 && on[m] && !lab[m]) { lab[m] = n; st[sp++] = m }
        }
      }
      sizes.push(cnt); boxes.push([x0, y0, x1, y1])
    }
    let big = 1; for (let k = 1; k <= n; k++) if (sizes[k] > sizes[big]) big = k
    const fb = boxes[big]
    let all = [...fb]
    for (let k = 1; k <= n; k++) if (k !== big && sizes[k] > sizes[big] * 0.002) {
      const bx = boxes[k]
      all = [Math.min(all[0], bx[0]), Math.min(all[1], bx[1]), Math.max(all[2], bx[2]), Math.max(all[3], bx[3])]
    }
    const fh = fb[3] - fb[1]
    let head = { w: 0 }
    for (let y = Math.round(fb[1] + fh * 0.1); y <= Math.round(fb[1] + fh * 0.3); y++) {
      let a = -1, z = -1
      for (let x = 0; x < W; x++) if (lab[y * W + x] === big) { if (a < 0) a = x; z = x }
      if (z - a > head.w) head = { w: z - a, y, cx: (a + z) / 2 }
    }
    return { W, fig: fb, all, head }
  }, f)
}
await b.close()
writeFileSync(join(import.meta.dirname, 'friends-measure.json'), JSON.stringify(out, null, 1) + '\n')
console.log('wrote scripts/art/friends-measure.json')
