// Turns square transparent PNGs (the pictures made with Tripo) into the
// app's 512 px webp, through a canvas in Chromium (no image library is
// installed). Half-transparent parts (the lenses of goggles) and real holes
// stay as they are. The quality goes down step by step until the file is
// under the limit. Prints per picture its size and the part that is drawn
// (alpha > 8 %, as [x0, y0, x1, y1] in 0…1: a first `box` for wardrobe.js).
//
//   node scripts/art/png-to-webp.mjs <out-dir> <in.png>[=<id>] …
//   MAX_KB=60 SIZE=512 in the environment change the limits.
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { chromium } from 'playwright'

const [outDir, ...inputs] = process.argv.slice(2)
const MAX = (+process.env.MAX_KB || 60) * 1024, SIZE = +process.env.SIZE || 512
const browser = await chromium.launch()
const page = await browser.newPage()
const report = {}
for (const arg of inputs) {
  const [src, idArg] = arg.split('=')
  const id = idArg || basename(src, '.png')
  const png = readFileSync(src).toString('base64')
  const r = await page.evaluate(async ({ png, size, max }) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + png
    await img.decode()
    const c = document.createElement('canvas')
    c.width = c.height = size
    const g = c.getContext('2d')
    g.imageSmoothingQuality = 'high'
    g.drawImage(img, 0, 0, size, size)
    const d = g.getImageData(0, 0, size, size).data
    let x0 = size, y0 = size, x1 = 0, y1 = 0, half = 0
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const a = d[(y * size + x) * 4 + 3]
      if (a > 20) { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y }
      if (a > 40 && a < 215) half++
    }
    let q = 0.9, url
    for (;;) {
      url = c.toDataURL('image/webp', q)
      if (url.length * 0.75 < max || q <= 0.4) break
      q -= 0.05
    }
    return { url, q: +q.toFixed(2), box: [x0 / size, y0 / size, (x1 + 1) / size, (y1 + 1) / size].map(v => +v.toFixed(3)), half }
  }, { png, size: SIZE, max: MAX })
  const buf = Buffer.from(r.url.split(',')[1], 'base64')
  writeFileSync(join(outDir, `${id}.webp`), buf)
  report[id] = { kb: +(buf.length / 1024).toFixed(1), q: r.q, box: r.box, half: r.half }
  console.log(id.padEnd(18), `${report[id].kb} KB`.padStart(8), `q ${r.q}`, JSON.stringify(r.box), `half-transparent px ${r.half}`)
}
await browser.close()
if (process.env.JSON) writeFileSync(process.env.JSON, JSON.stringify(report, null, 1))
