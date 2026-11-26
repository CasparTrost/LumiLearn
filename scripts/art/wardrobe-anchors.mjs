// Lumis Kleiderschrank: the anchors of a figure, checked with plain test
// shapes (a top hat, glasses as two rings and a bar, a neck ring, a back
// plate, a stick in the wing, a T-shirt, shorts, two shoes) on every pose.
// A test shape that sits right and symmetric means the anchor is right; then
// the things are fitted one by one (scripts/art/wardrobe-fit.mjs).
//
//   node scripts/art/wardrobe-anchors.mjs <slot> out.png [anchors.json]
//   anchors.json { pose: { slot: { x, y, rot, w } } } tries new values over
//   the figure's own. FIGURE=<shape id> (lib/shapes.js), SIZE=400 px a pose.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import { chromium } from 'playwright'
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const W = await import(pathToFileURL(join(ROOT, 'src/lib/wardrobe.js')).href)
const SH = await import(pathToFileURL(join(ROOT, 'src/lib/shapes.js')).href)
const FIG = process.env.FIGURE || 'chick'
const SET = SH.SHAPE_BY_ID?.[FIG]?.poses && Object.keys(SH.SHAPE_BY_ID[FIG].poses).length ? SH.SHAPE_BY_ID[FIG].poses : W.POSES
const base = pose => SH.shapeSrc(FIG, pose)
const [slot, out, aFile] = process.argv.slice(2)
const OV = aFile ? JSON.parse(readFileSync(aFile, 'utf8')) : {}
const SIZE = +(process.env.SIZE || 400)
const shape = (slot, a) => {
  const w = a.w
  const g = body => `<g transform="translate(${a.x} ${a.y}) rotate(${a.rot ?? 0})" opacity=".6">${body}</g><g transform="translate(${a.x} ${a.y}) rotate(${a.rot ?? 0})"><circle r="3" fill="red"/><line x1="${-w / 2}" y1="0" x2="${w / 2}" y2="0" stroke="red" stroke-width="1.5"/></g>`
  switch (slot) {
    case 'head': return g(`<rect x="${-w * 0.42}" y="-6" width="${w * 0.84}" height="8" fill="#222"/><rect x="${-w * 0.28}" y="-70" width="${w * 0.56}" height="66" fill="#333"/>`)
    case 'face': return g(`<circle cx="${-w * 0.47}" r="${w * 0.3}" fill="none" stroke="#000" stroke-width="5"/><circle cx="${w * 0.47}" r="${w * 0.3}" fill="none" stroke="#000" stroke-width="5"/><line x1="${-w * 0.17}" x2="${w * 0.17}" y1="-4" y2="-4" stroke="#000" stroke-width="5"/>`)
    case 'neck': return g(`<ellipse cx="0" cy="${w * 0.06}" rx="${w * 0.42}" ry="${w * 0.1}" fill="none" stroke="#c00" stroke-width="9"/>`)
    case 'back': return g(`<rect x="${-w * 0.75}" y="${-w * 0.25}" width="${w * 1.5}" height="${w * 0.5}" rx="20" fill="#06c"/>`)
    case 'hold': return g(`<rect x="-4" y="${-w * 1.1}" width="8" height="${w * 1.2}" fill="#630"/><circle cx="0" cy="${-w * 1.1}" r="${w * 0.25}" fill="#c00"/>`)
    case 'top': return g(`<path d="M ${-w * 0.2} 0 L ${-w * 0.5} ${w * 0.08} L ${-w * 0.62} ${w * 0.3} L ${-w * 0.46} ${w * 0.34} L ${-w * 0.44} ${w * 0.5} L ${w * 0.44} ${w * 0.5} L ${w * 0.46} ${w * 0.34} L ${w * 0.62} ${w * 0.3} L ${w * 0.5} ${w * 0.08} L ${w * 0.2} 0 Q 0 ${w * 0.12} ${-w * 0.2} 0 Z" fill="#0a7"/>`)
    case 'bottom': return g(`<path d="M ${-w * 0.42} 0 L ${w * 0.42} 0 L ${w * 0.46} ${w * 0.34} L ${w * 0.06} ${w * 0.34} L 0 ${w * 0.16} L ${-w * 0.06} ${w * 0.34} L ${-w * 0.46} ${w * 0.34} Z" fill="#36c"/>`)
    case 'shoes': {
      const r = (a.rot ?? 0) * Math.PI / 180
      return [-1, 1].map(s => `<g transform="translate(${a.x + s * a.step * Math.cos(r)} ${a.y + s * a.step * Math.sin(r)}) rotate(${a.rot ?? 0})" opacity=".6"><ellipse cx="0" cy="0" rx="${w * 0.5}" ry="${w * 0.28}" fill="#c00"/></g>`).join('') + `<circle cx="${a.x}" cy="${a.y}" r="3" fill="red"/>`
    }
  }
}
const cell = pose => {
  const a = { ...SET[pose][slot], ...(OV[pose]?.[slot] ?? {}) }
  let grid = ''
  for (let v = 0; v <= 384; v += 32) grid += `<line x1="${v}" y1="0" x2="${v}" y2="384" stroke="#f003" stroke-width=".5"/><line x1="0" y1="${v}" x2="384" y2="${v}" stroke="#f003" stroke-width=".5"/><text x="${v + 1}" y="7" font-size="6" fill="#c00">${v}</text><text x="1" y="${v - 1}" font-size="6" fill="#c00">${v}</text>`
  return `<div style="position:relative;width:${SIZE}px;height:${SIZE}px;background:#bfe3f5"><img src="${pathToFileURL(join(ROOT, 'public', base(pose))).href}" style="position:absolute;inset:0;width:100%;height:100%"><svg viewBox="0 0 384 384" style="position:absolute;inset:0;width:100%;height:100%">${grid}${shape(slot, a)}</svg><div style="position:absolute;left:4px;bottom:2px;font:12px sans-serif">${pose} ${slot} ${JSON.stringify(a)}</div></div>`
}
const html = `<body style="margin:0;display:flex;flex-wrap:wrap;width:${4 * SIZE + 12}px;gap:4px">${W.POSE_IDS.map(cell).join('')}</body>`
const page = join(tmpdir(), `wardrobe-anchors-${process.pid}.html`)
writeFileSync(page, html)
const b = await chromium.launch(); const pg = await b.newPage({ viewport: { width: 4 * SIZE + 12, height: 400 } })
await pg.goto(pathToFileURL(page).href); await pg.waitForTimeout(500); await pg.screenshot({ path: out, fullPage: true }); await b.close()
console.log('wrote', out)
