// Puts the seven poses of one figure side by side on one picture, as the
// template for Tripo ("dress all seven in this shirt"): 4 columns × 2 rows of
// 512 px cells on white, the eighth cell empty. The cells are fixed, so the
// dressed picture Tripo returns can be cut back into the seven poses:
//   node scripts/art/pose-sheet.mjs <figure> out.png
// figure: chick (Lumi's own pictures) or dino, einhorn, drache, roboter
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

export const POSE_ORDER = ['idle', 'happy', 'sad', 'hmm', 'think', 'sleep', 'wave']
export const CELL = 512, COLS = 4

const [figure, out] = process.argv.slice(2)
const file = p => figure === 'chick' ? `public/sprites/emoji/custom/lumi-${p}.webp` : `public/sprites/shapes/${figure}-${p}.webp`
const pics = POSE_ORDER.map(p => 'data:image/webp;base64,' + readFileSync(file(p)).toString('base64'))
const browser = await chromium.launch()
const page = await browser.newPage()
const data = await page.evaluate(async ({ pics, CELL, COLS }) => {
  const c = document.createElement('canvas')
  c.width = CELL * COLS; c.height = CELL * 2
  const g = c.getContext('2d')
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height)
  for (let i = 0; i < pics.length; i++) {
    const img = new Image(); img.src = pics[i]; await img.decode()
    g.drawImage(img, (i % COLS) * CELL, Math.floor(i / COLS) * CELL, CELL, CELL)
  }
  return c.toDataURL('image/png')
}, { pics, CELL, COLS })
await browser.close()
writeFileSync(out, Buffer.from(data.split(',')[1], 'base64'))
console.log('wrote', out)
