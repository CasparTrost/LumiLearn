// Sternbilder: every outline as a picture, to look at before it goes into
// the game — the bare closed line (can you tell what it is?) and the
// numbered stars over the picture.
//
//   node src/games/sternbilder/tools/gallery.mjs out-prefix
//   → out-prefix-a-5-7-8-stars.png, -b-10-stars.png, -c-15-stars.png, -d-20-stars.png
import { chromium } from 'playwright'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { OUTLINES } from '../outlines.js'

const ART = fileURLToPath(new URL('../../../../public/sprites/emoji/', import.meta.url))
const code = e => [...e].filter(c => c !== '‍' && c !== '️').map(c => c.codePointAt(0).toString(16)).join('-')
const src = o => `data:image/webp;base64,${fs.readFileSync(`${ART}${code(o.art)}.webp`).toString('base64')}`
const prefix = process.argv[2] ?? 'sternbilder'

const cell = o => {
  const [x0, y0, x1, y1] = o.box
  const pad = 9, vb = `${x0 - pad} ${y0 - pad} ${x1 - x0 + 2 * pad} ${y1 - y0 + 2 * pad}`
  const poly = o.pts.map(q => q.join(',')).join(' ')
  return `<div style="width:300px;margin:5px;color:#fff;font:13px sans-serif;text-align:center">
    <div style="display:flex;gap:4px">
    <svg viewBox="${vb}" width="148" height="148"><polygon points="${poly}" fill="none" stroke="#fffbe6" stroke-width="2" stroke-linejoin="round"/></svg>
    <svg viewBox="${vb}" width="148" height="148"><image href="${src(o)}" x="0" y="0" width="100" height="100" opacity="0.55" transform="rotate(${o.rot} 50 50)"/>
      <polygon points="${poly}" fill="none" stroke="#ffe27a" stroke-width="1"/>
      ${o.pts.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="4.2" fill="#fff3b0"/><text x="${q[0]}" y="${q[1] + 2.2}" font-size="6" font-weight="bold" text-anchor="middle" fill="#2a1b3d">${i + 1}</text>`).join('')}
    </svg></div>${o.name} · ${o.id}</div>`
}
const groups = { 'a-5-7-8-stars': o => o.pts.length <= 8, 'b-10-stars': o => o.pts.length === 10, 'c-15-stars': o => o.pts.length === 15, 'd-20-stars': o => o.pts.length === 20 }
const browser = await chromium.launch()
for (const [name, f] of Object.entries(groups)) {
  const page = await browser.newPage({ viewport: { width: 1250, height: 100 } })
  await page.setContent(`<body style="margin:0;background:#1b1446;display:flex;flex-wrap:wrap;width:1250px">${OUTLINES.filter(f).map(cell).join('')}</body>`)
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${prefix}-${name}.png`, fullPage: true })
  await page.close()
}
await browser.close()
