// Draws an SVG into a transparent webp, the format of the custom pictures:
//   node scripts/art/render-svg.mjs scripts/art/jacke.svg public/sprites/emoji/custom/jacke.webp 512
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const [src, out, size = '512'] = process.argv.slice(2)
const svg = readFileSync(src, 'utf8')
const browser = await chromium.launch()
const page = await browser.newPage()
const data = await page.evaluate(async ({ svg, size }) => {
  const img = new Image()
  img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
  await img.decode()
  const c = document.createElement('canvas')
  c.width = c.height = size
  c.getContext('2d').drawImage(img, 0, 0, size, size)
  return c.toDataURL('image/webp', 0.92)
}, { svg, size: +size })
await browser.close()
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'))
console.log('wrote', out)
