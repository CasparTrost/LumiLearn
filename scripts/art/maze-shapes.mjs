// Lumi's shapes in the maze (src/games/MazeGame.jsx): pixel sprites made
// from the shapes' pictures (public/sprites/shapes/<id>-<pose>.webp) in the
// look of the chick's maze sprites (public/sprites/maze/lumi_*.png):
//
//   <id>_idle.png   64 × 64   from the idle picture
//   <id>_happy.png  64 × 64   from the happy picture
//   <id>_walk.png  640 × 64   10 frames of a waddle (bob, tilt, a squash on
//                             each step, like the chick's walk cycle)
//
// Each frame: the picture cut to its figure, scaled to the chick sprite's
// figure height (a little taller, see H) and ground line, drawn at 64 px with smoothing (that keeps
// the colours), then made pixel art: hard alpha, the colours reduced to one
// small palette per shape (the same for all its frames, so nothing flickers),
// and a dark 1-px outline round the figure like the chick's. The eyes are
// darkened back where the downscale greyed them (KEEP_DARK).
//
//   node scripts/art/maze-shapes.mjs
import { chromium } from 'playwright'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..', '..')
const MAZE = join(ROOT, 'public/sprites/maze')
const SHAPES = join(ROOT, 'public/sprites/shapes')
const IDS = ['dino', 'einhorn', 'drache', 'roboter']
const COLOURS = 18
// per shape: a light rim outside the outline and a lighter body (the green
// dino vanished on the green maze path)
// (the rim 2 px wide: the maze draws the 64 px sprite at about 30 px, and a
// 1-px rim fell apart into dots)
const LOOK = { dino: { rim: [255, 248, 222], rimW: 2, lighten: [[255, 240, 150], 0.45] } }
const FRAMES = 10
const url = f => 'data:image/png;base64,' + readFileSync(f).toString('base64')
const webp = f => 'data:image/webp;base64,' + readFileSync(f).toString('base64')

const b = await chromium.launch()
const pg = await b.newPage()

// the chick sprite: its figure's box and its outline colour
const chick = await pg.evaluate(async src => {
  const img = new Image(); img.src = src; await img.decode()
  const c = document.createElement('canvas'); c.width = c.height = 64
  const g = c.getContext('2d'); g.drawImage(img, 0, 0)
  const d = g.getImageData(0, 0, 64, 64).data
  let x0 = 64, y0 = 64, x1 = 0, y1 = 0
  const count = {}
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const i = (y * 64 + x) * 4
    if (d[i + 3] < 128) continue
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
    const lum = d[i] + d[i + 1] + d[i + 2]
    if (lum < 200) { const k = `${d[i]},${d[i + 1]},${d[i + 2]}`; count[k] = (count[k] ?? 0) + 1 }
  }
  const ink = Object.entries(count).sort((a, c2) => c2[1] - a[1])[0]?.[0].split(',').map(Number) ?? [74, 31, 31]
  return { box: [x0, y0, x1, y1], ink }
}, url(join(MAZE, 'lumi_idle.png')))
console.log('chick figure', chick.box, 'outline', chick.ink)

for (const id of IDS) {
  const out = await pg.evaluate(async ({ srcs, box, ink, FRAMES, COLOURS, id, look }) => {
    const load = async s => { const i = new Image(); i.src = s; await i.decode(); return i }
    const pics = { idle: await load(srcs.idle), happy: await load(srcs.happy) }
    // the figure's box in the 512 picture (alpha)
    const figBox = img => {
      const c = document.createElement('canvas'); c.width = c.height = 512
      const g = c.getContext('2d'); g.drawImage(img, 0, 0, 512, 512)
      const d = g.getImageData(0, 0, 512, 512).data
      let x0 = 512, y0 = 512, x1 = 0, y1 = 0
      for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) if (d[(y * 512 + x) * 4 + 3] > 100) {
        x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
      }
      return [x0, y0, x1, y1]
    }
    // a little taller than the chick (55 of 64 px): the chick is a round
    // ball as wide as it is tall, the shapes are narrow and looked smaller
    const H = Math.min(55, Math.round((box[3] - box[1] + 1) * 1.06)), ground = box[3] + 1, W = 62
    // one smooth 64 frame: the figure scaled to the chick's height (or 60 wide), standing on its ground
    const frame = (img, { rot = 0, bob = 0, sx = 1, sy = 1 } = {}) => {
      const [x0, y0, x1, y1] = figBox(img)
      const fw = x1 - x0 + 1, fh = y1 - y0 + 1
      const k = Math.min(H / fh, W / fw)
      const c = document.createElement('canvas'); c.width = c.height = 64
      const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'
      g.translate(32, ground + bob)
      g.rotate(rot * Math.PI / 180)
      g.scale(sx, sy)
      g.drawImage(img, x0, y0, fw, fh, -fw * k / 2, -fh * k, fw * k, fh * k)
      return g.getImageData(0, 0, 64, 64)
    }
    // palette: k-means over the opaque pixels of idle and happy
    const smoothIdle = frame(pics.idle), smoothHappy = frame(pics.happy)
    const px = []
    for (const im of [smoothIdle, smoothHappy]) for (let i = 0; i < im.data.length; i += 4) if (im.data[i + 3] >= 128) px.push([im.data[i], im.data[i + 1], im.data[i + 2]])
    let cent = Array.from({ length: COLOURS }, (_, j) => px[Math.floor((j + 0.5) * px.length / COLOURS)])
    // sort the seeds by brightness so the darks are kept
    px.sort((a, c2) => a[0] + a[1] + a[2] - (c2[0] + c2[1] + c2[2]))
    cent = Array.from({ length: COLOURS }, (_, j) => px[Math.floor((j + 0.5) * px.length / COLOURS)].slice())
    const near = p => { let best = 0, bd = 1e9; for (let j = 0; j < cent.length; j++) { const c2 = cent[j]; const d = (p[0] - c2[0]) ** 2 + (p[1] - c2[1]) ** 2 + (p[2] - c2[2]) ** 2; if (d < bd) { bd = d; best = j } } return best }
    for (let it = 0; it < 12; it++) {
      const sum = cent.map(() => [0, 0, 0, 0])
      for (const p of px) { const j = near(p); sum[j][0] += p[0]; sum[j][1] += p[1]; sum[j][2] += p[2]; sum[j][3]++ }
      cent = sum.map((s, j) => (s[3] ? [s[0] / s[3], s[1] / s[3], s[2] / s[3]] : cent[j]))
    }
    cent = cent.map(c2 => c2.map(Math.round))
    // a lighter body: green colours mixed a step towards cream/yellow
    if (look.lighten) {
      const [to, k] = look.lighten
      cent = cent.map(c2 => (c2[1] > c2[0] + 15 && c2[1] > c2[2] + 15 ? c2.map((v, j) => Math.round(v + (to[j] - v) * k)) : c2))
    }
    // pixel art of a smooth frame: hard alpha, the palette, the outline
    const pixel = im => {
      const d = new Uint8ClampedArray(im.data)
      const on = new Uint8Array(64 * 64)
      for (let i = 0; i < 64 * 64; i++) {
        if (d[i * 4 + 3] < 128) { d[i * 4 + 3] = 0; continue }
        on[i] = 1
        const p = cent[near([d[i * 4], d[i * 4 + 1], d[i * 4 + 2]])]
        // dark pixels (eyes, lines) are drawn in the outline colour, as the chick's
        const lum = p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11
        const q = lum < 70 ? ink : p
        d[i * 4] = q[0]; d[i * 4 + 1] = q[1]; d[i * 4 + 2] = q[2]; d[i * 4 + 3] = 255
      }
      // the outline: every figure pixel at the edge of the figure
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        const i = y * 64 + x
        if (!on[i]) continue
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx < 0 || yy < 0 || xx > 63 || yy > 63 || !on[yy * 64 + xx] })
        if (edge) { d[i * 4] = ink[0]; d[i * 4 + 1] = ink[1]; d[i * 4 + 2] = ink[2] }
      }
      // a light rim outside the outline
      if (look.rim) {
        const rim = []
        for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
          const i = y * 64 + x
          if (on[i]) continue
          if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < 64 && yy < 64 && on[yy * 64 + xx] })) rim.push(i)
        }
        for (const i of rim) { d[i * 4] = look.rim[0]; d[i * 4 + 1] = look.rim[1]; d[i * 4 + 2] = look.rim[2]; d[i * 4 + 3] = 255 }
        if ((look.rimW ?? 1) > 1) {
          const two = []
          const isRim = new Uint8Array(64 * 64); for (const i of rim) isRim[i] = 1
          for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
            const i = y * 64 + x
            if (on[i] || isRim[i]) continue
            if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const xx = x + dx, yy = y + dy; return xx >= 0 && yy >= 0 && xx < 64 && yy < 64 && isRim[yy * 64 + xx] })) two.push(i)
          }
          for (const i of two) { d[i * 4] = look.rim[0]; d[i * 4 + 1] = look.rim[1]; d[i * 4 + 2] = look.rim[2]; d[i * 4 + 3] = 255 }
        }
      }
      return d
    }
    const toUrl = (frames) => {
      const c = document.createElement('canvas'); c.width = 64 * frames.length; c.height = 64
      const g = c.getContext('2d')
      frames.forEach((d, i) => g.putImageData(new ImageData(d, 64, 64), i * 64, 0))
      return c.toDataURL('image/png')
    }
    // the walk: the chick's cycle is a bob over two steps with a tilt to
    // each side and a squash when a foot lands
    const walk = []
    for (let f = 0; f < FRAMES; f++) {
      const t = f / FRAMES * 2 * Math.PI
      const step = Math.abs(Math.sin(t))          // 0 when a foot lands, 1 between
      walk.push(pixel(frame(pics.idle, { rot: 5 * Math.sin(t), bob: -Math.round(2 * step), sx: 1 + 0.03 * (1 - step), sy: 1 - 0.04 * (1 - step) })))
    }
    return { idle: toUrl([pixel(smoothIdle)]), happy: toUrl([pixel(smoothHappy)]), walk: toUrl(walk), colours: cent.length }
  }, { srcs: { idle: webp(join(SHAPES, `${id}-idle.webp`)), happy: webp(join(SHAPES, `${id}-happy.webp`)) }, box: chick.box, ink: chick.ink, FRAMES, COLOURS, id, look: LOOK[id] ?? {} })
  for (const k of ['idle', 'happy', 'walk']) writeFileSync(join(MAZE, `${id}_${k}.png`), Buffer.from(out[k].split(',')[1], 'base64'))
  console.log('wrote', id, 'idle, happy, walk')
}
await b.close()
