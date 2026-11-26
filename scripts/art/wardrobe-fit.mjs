// Lumis Kleiderschrank: how things sit on Lumi, as a picture to look at.
// Every chosen thing on all seven of Lumi's pictures, drawn exactly as the
// app draws it (figureLayers in src/lib/wardrobe.js, the same layers
// components/LumiFigure.jsx shows).
//
//   node scripts/art/wardrobe-fit.mjs out.png [size] [what] [debug]
//
//   size   px per Lumi (default 240; 44 is the game bar)
//   what   'all' (default), 'slot:head', 'krone,schal' (each alone) or
//          'combo:krone+schal+umhang;muetze+ballon' (worn together, one row each)
//   debug  'debug': the anchors (red), the tuft (blue) and the parts in
//          front of neck things (green), the holding wing tip (magenta) instead of things
//   DPR=3 in the environment draws at three times the pixels (small sizes).
import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const W = await import(pathToFileURL(join(ROOT, 'src/lib/wardrobe.js')).href)
const [out = 'wardrobe-fit.png', sizeArg = '240', what = 'all', debug = ''] = process.argv.slice(2)
const size = +sizeArg
const rows = what.startsWith('combo:')
  ? what.slice(6).split(';').map(c => Object.fromEntries(c.split('+').map(id => [W.ITEM_BY_ID[id].slot, id])))
  : (what === 'all' ? W.WARDROBE : what.startsWith('slot:') ? W.WARDROBE.filter(t => t.slot === what.slice(5)) : what.split(',').map(id => W.ITEM_BY_ID[id]))
    .map(t => ({ [t.slot]: t.id }))
const file = p => pathToFileURL(join(ROOT, 'public', p)).href

function figure(pose, outfit) {
  const { layers, scale } = W.figureLayers(pose, debug ? null : outfit)
  const inner = layers.map(l => l.kind === 'pose'
    ? `<img src="${file(`sprites/emoji/custom/lumi-${pose}.webp`)}" style="position:absolute;inset:0;width:100%;height:100%;${l.clip ? `clip-path:${l.clip};` : ''}">`
    : `<img src="${file(l.src)}" style="position:absolute;left:${l.left};top:${l.top};width:${l.size};height:${l.h ?? l.size};transform:rotate(${l.rot}deg);transform-origin:${l.origin};${l.clip ? `clip-path:${l.clip};` : ''}">`).join('')
  let marks = ''
  if (debug) {
    const P = W.POSES[pose]
    const pts = a => a.map(([x, y]) => `${x},${y}`).join(' ')
    marks = `<svg viewBox="0 0 384 384" style="position:absolute;inset:0;width:100%;height:100%">${W.SLOTS.map(s => { const a = P[s]; return `<circle cx="${a.x}" cy="${a.y}" r="4" fill="red"/><line x1="${a.x - a.w / 2}" y1="${a.y}" x2="${a.x + a.w / 2}" y2="${a.y}" stroke="red" stroke-width="2" transform="rotate(${a.rot} ${a.x} ${a.y})"/><text x="${a.x + 6}" y="${a.y - 6}" font-size="14" fill="red">${s}</text>` }).join('')}<polygon points="${pts(P.tuft)}" fill="none" stroke="blue" stroke-width="2"/>${P.front ? `<polygon points="${pts(P.front)}" fill="none" stroke="green" stroke-width="2"/>` : ''}${P.grip ? `<polygon points="${pts(P.grip)}" fill="none" stroke="magenta" stroke-width="2"/>` : ''}</svg>`
  }
  return `<div style="position:relative;width:${size}px;height:${size}px;outline:1px dashed #0002"><div style="position:absolute;inset:0;transform:scale(${scale});transform-origin:50% 100%">${inner}</div>${marks}</div>`
}
const html = (debug ? [{}] : rows).map(o => `<div style="display:flex;gap:6px;align-items:center"><div style="width:110px;font:12px sans-serif;overflow-wrap:anywhere">${Object.values(o).join(' + ') || 'anchors'}</div>${W.POSE_IDS.map(p => figure(p, o)).join('')}</div>`).join('')
const page = join(tmpdir(), `wardrobe-fit-${process.pid}.html`)
writeFileSync(page, `<body style="margin:0;padding:6px;background:#bfe3f5;display:flex;flex-direction:column;gap:6px">${html}</body>`)
const browser = await chromium.launch()
const pg = await browser.newPage({ deviceScaleFactor: +(process.env.DPR || 1), viewport: { width: 120 + 7 * (size + 6), height: 400 } })
await pg.goto(pathToFileURL(page).href)
await pg.waitForTimeout(500)
await pg.screenshot({ path: out, fullPage: true })
await browser.close()
console.log('wrote', out)
