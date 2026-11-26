// Lumis Freunde: brings the six pictures of each friend to ONE scale and ONE
// ground line and writes public/sprites/friends/<id>-<pose>.webp (512 px,
// transparent). Run friends-measure.mjs first.
//
//   node scripts/art/friends-convert.mjs <folder with <id>-<pose>.png>
//
// The sources were each fitted to their frame on their own, so a sitting
// friend (sleep) came out as tall as a standing one, with a bigger head.
// Here every standing pose gets the same height (HEIGHT of the square, the
// median of the friend's standing poses), the feet stand on Lumi's ground
// line (GROUND: where Lumi's feet are in lumi-*.webp), the head is centred,
// and friends-fix.json holds what was corrected by eye (`k`: the sleeping
// pictures drawn smaller so the head keeps its size; `dx`: a shift).
import { chromium } from 'playwright'
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = process.argv[2]
if (!SRC) { console.error('usage: node scripts/art/friends-convert.mjs <png folder>'); process.exit(1) }
const ROOT = join(import.meta.dirname, '..', '..')
const OUT = join(ROOT, 'public/sprites/friends')
const m = JSON.parse(readFileSync(join(import.meta.dirname, 'friends-measure.json'), 'utf8'))
const FIX = JSON.parse(readFileSync(join(import.meta.dirname, 'friends-fix.json'), 'utf8'))
const ids = ['dino', 'einhorn', 'drache', 'roboter'], poses = ['idle', 'happy', 'sad', 'think', 'wave', 'sleep']
const SIZE = 512
const GROUND = 0.969   // Lumi's feet in its square
const HEIGHT = 0.86    // a standing friend's height in its square (Lumi: 0.94)

mkdirSync(OUT, { recursive: true })
const b = await chromium.launch()
const pg = await b.newPage()
for (const id of ids) {
  const stand = poses.filter(p => p !== 'sleep').map(p => m[`${id}-${p}`]).map(v => v.fig[3] - v.fig[1]).sort((a, c) => a - c)
  const ref = stand[Math.floor(stand.length / 2)]
  for (const p of poses) {
    const v = m[`${id}-${p}`], fix = FIX[`${id}-${p}`] ?? {}
    const S = SIZE * HEIGHT / ref * (fix.k ?? 1)
    const hx = v.head.cx + (fix.dx ?? 0) * v.W
    const tx = SIZE / 2 - hx * S, ty = SIZE * GROUND - v.fig[3] * S
    const box = v.all.map((c, i) => (i % 2 ? ty + c * S : tx + c * S))
    if (box[0] < 0 || box[1] < 0 || box[2] > SIZE || box[3] > SIZE) console.log('OUT OF THE SQUARE', id, p, box.map(Math.round))
    const url = 'data:image/png;base64,' + readFileSync(join(SRC, `${id}-${p}.png`)).toString('base64')
    const data = await pg.evaluate(async ({ url, S, tx, ty, SIZE }) => {
      const img = new Image(); img.src = url; await img.decode()
      const c = document.createElement('canvas'); c.width = c.height = SIZE
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'
      g.drawImage(img, tx, ty, img.naturalWidth * S, img.naturalHeight * S)
      return c.toDataURL('image/webp', 0.86)
    }, { url, S, tx, ty, SIZE })
    const f = join(OUT, `${id}-${p}.webp`)
    writeFileSync(f, Buffer.from(data.split(',')[1], 'base64'))
    console.log(id, p, 'box', box.map(Math.round).join(' '), Math.round(statSync(f).size / 1024) + ' KB')
  }
}
await b.close()
