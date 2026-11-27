// Clothes painted onto the figure: cuts a top and a bottom out of a sheet of
// all seven poses that Tripo dressed, one picture per pose and thing, in the
// frame of the figure's own pose picture, so the app draws them over the pose
// picture as they are (no anchors, no stretching): the sleeves follow the
// arms, the trousers the sitting legs.
//
//   node scripts/art/worn-from-sheet.mjs <figure> <top> <bottom> <sheet.png> [--debug <dir>]
//
//   figure  chick, dino, einhorn, drache or roboter
//   top     the id of the top on the sheet (lib/wardrobe/top.js), e.g. ringelshirt
//   bottom  the id of the bottom (lib/wardrobe/bottom.js), e.g. jeansshorts
//   sheet   what Tripo returned for the template of scripts/art/pose-sheet.mjs
//           (2048 × 1024, white, 4 × 2 cells of 512 px: idle, happy, sad, hmm /
//           think, sleep, wave, empty); any multiple of that size is scaled
//   --debug a folder for pictures of every step (zoomed, on a coloured ground)
//   node scripts/art/worn-from-sheet.mjs <figure> --all <folder>   every <figure>-*.png there
//   node scripts/art/worn-from-sheet.mjs <figure> --clean   only the last check (specks) on the written pictures
//
// Writes public/sprites/wardrobe/worn/<figure>/<thing>-<pose>.webp (384 px,
// transparent, the frame of public/sprites/shapes/<figure>-<pose>.webp) for
// the top and the bottom, and adds both to src/lib/shapes/<figure>-worn.js,
// the list the figure's fit file reads (wornFit in src/lib/wardrobe.js marks
// them `worn`: drawn from these pictures, see figureLayers). For the chick the
// list is src/lib/wardrobe/chick-worn.js, read by lib/wardrobe.js itself.
//
// The steps, per pose:
//  1. Registration: Tripo redraws the figure a pixel or two off. The shift and
//     a tiny scale between the template cell and the result cell are found on
//     what stays the same (the outlines of the head and of the feet).
//  2. The clothes: pixels of the result that are no colour of the template
//     nearby (2 px), not the white ground; cleaned (opening, only the large
//     parts, closing), white stripes inside filled; the hands that stick out
//     stay the template's (they are the same colour as before, so not cut).
//     The rim towards the white ground is un-mixed from the white (no halo),
//     the edge towards a hand or the head feathered by a pixel. Where Tripo
//     drew the body a little narrower than the template, the garment's edge
//     is warped out onto the template's outline (no sliver of bare body).
//  3. Top and bottom: the colours of the chest and of the hips are learnt,
//     each pixel goes to the more likely one, smoothed over its
//     neighbourhood; parts cut off from their side change sides. The top's
//     hem over the waistband stays with the top. Top and bottom are always
//     worn together (an outfit), so no line is drawn where they meet.
//  4. What is the figure's own: its feet are cut out of every bottom (the
//     shoes are drawn under the bottom and must show whole; without shoes
//     the pose picture's feet show), the bottom ending there in its outline
//     colour; its parts lying in front of the top (the chick's wings when
//     sad, paws on a jacket) are carried by the top from the pose picture;
//     a mermaid's fin goes whole to the bottom, and the unicorn keeps its
//     rainbow tail over the fin (KEEP_TAIL); sitting, the dino and the
//     dragon keep their own tail and lose the fin Tripo put in its place
//     (SIT_TAIL), so the mermaid reads as one tail. Sitting, on legs Tripo
//     dressed, the figure's own bare leg that the loose foot polygons take
//     in (the robot's white leg beside its boot, the unicorn's white leg
//     under pale leggings) is the trousers' too (legFill), with no outline
//     line drawn on the cloth where the pose picture has none; so is the
//     light leg between a foot and a hand where Tripo painted the trousers
//     there (the robot's white leg beside a jeans patch, the pale stripes
//     of leggings round the unicorn's hoof), so no piece of them is cut off.
//  5. Clean-up: Tripo's pale soft shading on the ground (under a hand,
//     between the legs) is ground; thin bits beyond the figure's outline go;
//     the face (eyes, brows, mouth: tests/unit/face-zones.json) is never
//     clothes, even where Tripo repainted it; of top and bottom together
//     only the garment stays: pieces apart from it (specks between the legs)
//     go, large ones only when they lie on the figure's own arms or wings
//     (a hood's cat ears stay); small holes shut in by the clothes are
//     filled with Tripo's paint (no grey mark of the arm's outline on a
//     white cuff), and so are small gaps past the figure's outline inside a
//     light garment (a white fur collar Tripo painted as white as its
//     ground); Tripo's white in the notch between the legs goes from the top
//     too (a strap's white), and thin lines left in a mermaid's gap go. The
//     check: zero such pieces in all pictures.
//  6. Two sitting pictures as a child should read them: a skirt Tripo
//     spread wide round the legs lies on the lap (LAP_SKIRT: the flaps
//     beyond the legs cut back to a short flare, the cut closed in the
//     skirt's own outline colour; the unicorn's left flap ends in a round
//     hem round its hoof, Tripo's boot bits under the robot's right boot
//     go, and no faint specks stay), and leggings Tripo painted pale are
//     painted again in even stripes of its standing poses, in their order
//     and colours, shaded softly like the figure's own legs, with a clean
//     outline (BRIGHT_LEGS, RAINBOW).
//
// Proof pictures: --debug shows per pose the masks (red top, blue bottom,
// yellow changed but left out), the cut clothes on the pose picture on a
// coloured ground, the clothes alone, and Tripo's picture beside the result
// zoomed twice. Look at them before committing the pictures.
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const POSE_ORDER = ['idle', 'happy', 'sad', 'hmm', 'think', 'sleep', 'wave']
const S = 512, N = S * S, COLS = 4
// how far (in the poses file's 384 px) the top of a standing figure's feet
// lies above its `soles` strip: the robot's boots, the dino's and the
// dragon's toes reach above it; the unicorn's hooves and the chick's toes not
// The pictures written: 384 px (the figure is drawn at most 340 CSS px wide,
// in the wardrobe; side by side with 512 px at 680 device pixels no
// difference shows), webp from quality 0.85 down to 0.7 until at most 6 KB
// (half the download of 512 px at 0.9; the clothes are 1,120 pictures)
const OUT = { size: 384, q0: 0.85, qMin: 0.7, kb: 6 }
// the figures whose own tail stays visible beside a mermaid's fin
const KEEP_TAIL = ['einhorn']
// the figures whose own tail stays beside the mermaid's fin when they sit
const SIT_TAIL = ['dino', 'drache']
// the figures whose top, sitting, loses the bits of the bottom it took
// close round the feet (see cutPose)
const SIT_BITS = ['chick']
// the skirts that, sitting, lie on the figure's lap (per figure, the
// bottom's id): Tripo spread them wide round the unicorn's and the robot's
// legs, and at the app's size the flaps beyond the legs read as stray
// shapes, not a skirt (see lapSkirt in cutPose)
// (`left`: that skirt's flap on the left, beside the unicorn's hoof, ends
// in a round hem instead; `underFoot`: Tripo's boot bits under that foot
// go (0 left, 1 right); `q`: the sitting picture is written at that webp
// quality, the one it had before those two came in (the size loop would
// pick a higher one for the smaller file, and that changes every pixel a
// little, the waistband too): see lapSkirt)
const LAP_SKIRT = { einhorn: { prinzessinnenrock: { left: { flare: 10, close: 14, round: 10 } } }, roboter: { prinzessinnenrock: { underFoot: 1, q: 0.7 } } }
// (the row of the 512 px working picture above which the lap skirt's
// clean-up of specks touches nothing: the waistband)
const LAP_Y = 400
// the leggings that, sitting, Tripo painted pale on the thighs and shins
// (the unicorn's rainbow leggings, nearly white round its hooves): there
// they are painted in the stripes of Tripo's standing poses (see brightLegs)
const BRIGHT_LEGS = { einhorn: ['regenbogenleggings'] }
// the rainbow leggings' stripes as Tripo painted them standing (the
// unicorn's idle, happy and wave pictures as cut, a touch more saturated,
// so that shaded they come out as those; the purple that of Tripo's own
// cuff above the hoof, a little brighter): pink, yellow, green, blue, purple
const RAINBOW = [[240, 130, 155], [250, 233, 150], [166, 231, 188], [128, 200, 242], [156, 120, 236]]
const FEET_UP = { chick: 16, dino: 16, drache: 18, einhorn: 0, roboter: 10 }

// ── pixels in and out (Chromium's canvas: no image library is installed) ──
let page
const mime = f => (f.endsWith('.webp') ? 'image/webp' : 'image/png')
async function decode(file, size) {
  const b64 = readFileSync(file).toString('base64')
  const r = await page.evaluate(async ({ b64, m, size }) => {
    const img = new Image(); img.src = `data:${m};base64,${b64}`; await img.decode()
    const w = size?.[0] ?? img.naturalWidth, h = size?.[1] ?? img.naturalHeight
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, w, h)
    const d = g.getImageData(0, 0, w, h).data
    let s = ''
    for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode.apply(null, d.subarray(i, i + 0x8000))
    return { w, h, b: btoa(s) }
  }, { b64, m: mime(file), size })
  return { w: r.w, h: r.h, data: new Uint8ClampedArray(Buffer.from(r.b, 'base64')) }
}
// (`size`: scaled to that many pixels square first; webp: from quality q0
// down to qMin by 0.05 until the file is at most maxKb)
async function encode(img, file, maxKb = 60, { size = null, q0 = 0.9, qMin = 0.5 } = {}) {
  const b = Buffer.from(img.data.buffer, img.data.byteOffset, img.data.byteLength).toString('base64')
  const url = await page.evaluate(async ({ w, h, b, m, max, size, q0, qMin }) => {
    const s = atob(b); const a = new Uint8ClampedArray(s.length)
    for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i)
    let c = document.createElement('canvas'); c.width = w; c.height = h
    c.getContext('2d').putImageData(new ImageData(a, w, h), 0, 0)
    if (size && size !== w) {
      const o = document.createElement('canvas'); o.width = o.height = size
      const g = o.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, size, size)
      c = o
    }
    if (m === 'image/png') return c.toDataURL(m)
    let q = q0, url
    for (;;) { url = c.toDataURL(m, q); if (url.length * 0.75 <= max || q <= qMin + 1e-6) return url; q -= 0.05 }
  }, { w: img.w, h: img.h, b, m: mime(file), max: maxKb * 1024, size, q0, qMin })
  const buf = Buffer.from(url.split(',')[1], 'base64')
  writeFileSync(file, buf)
  return buf.length
}

// ── masks ──
const n4 = (p, f) => { const x = p % S; if (x > 0) f(p - 1); if (x < S - 1) f(p + 1); if (p >= S) f(p - S); if (p < N - S) f(p + S) }
function flood(seeds, pass) {
  const m = new Uint8Array(N), st = []
  for (const p of seeds) if (!m[p] && pass(p)) { m[p] = 1; st.push(p) }
  while (st.length) n4(st.pop(), q => { if (!m[q] && pass(q)) { m[q] = 1; st.push(q) } })
  return m
}
const disc = r => { const o = []; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r) o.push([dx, dy]); return o }
function dilate(m, r) {
  const o = new Uint8Array(N), D = disc(r)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (m[y * S + x]) for (const [dx, dy] of D) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S && Y < S) o[Y * S + X] = 1 }
  return o
}
const not = m => m.map(v => 1 - v)
const erode = (m, r) => not(dilate(not(m), r))
const and = (a, b) => a.map((v, i) => v & b[i])
function components(m) {
  const lab = new Int32Array(N), comps = [null]
  for (let p = 0; p < N; p++) if (m[p] && !lab[p]) {
    const id = comps.length, px = [p]; lab[p] = id
    for (let k = 0; k < px.length; k++) n4(px[k], q => { if (m[q] && !lab[q]) { lab[q] = id; px.push(q) } })
    comps.push(px)
  }
  return { lab, comps }
}
// the pieces of a picture (alpha over 0, 8 neighbours) in a zone that are
// smaller than min px go: specks, faint as they may be (the last check,
// cleanPair, only sees what is over 100)
function dropBits(D, zone, min) {
  const lab = new Uint8Array(N)
  for (let p = 0; p < N; p++) if (zone[p] && D[p * 4 + 3] && !lab[p]) {
    const px = [p]; lab[p] = 1
    for (let i = 0; i < px.length; i++) {
      const q = px[i], x = q % S
      for (const d of [-S - 1, -S, -S + 1, -1, 1, S - 1, S, S + 1]) { const r = q + d; if (r >= 0 && r < N && Math.abs((r % S) - x) <= 1 && D[r * 4 + 3] && !lab[r]) { lab[r] = 1; px.push(r) } }
    }
    if (px.length < min) for (const q of px) D[q * 4 + 3] = 0
  }
}
const border = p => { const x = p % S; return x === 0 || x === S - 1 || p < S || p >= N - S }
// distance (in steps, up to max) from a mask
function distance(m, max) {
  const d = new Uint8Array(N).fill(255); let front = []
  for (let p = 0; p < N; p++) if (m[p]) { d[p] = 0; front.push(p) }
  for (let k = 1; k <= max && front.length; k++) {
    const next = []
    for (const p of front) n4(p, q => { if (d[q] === 255) { d[q] = k; next.push(q) } })
    front = next
  }
  return d
}

// the pixels inside any of the polygons ([[x, y], …] in pixels), even-odd
function polygons(list) {
  const m = new Uint8Array(N)
  for (const pl of list) {
    for (let y = 0; y < S; y++) {
      const xs = []
      for (let i = 0; i < pl.length; i++) {
        const [x1, y1] = pl[i], [x2, y2] = pl[(i + 1) % pl.length]
        if ((y1 <= y + 0.5) !== (y2 <= y + 0.5)) xs.push(x1 + (y + 0.5 - y1) / (y2 - y1) * (x2 - x1))
      }
      xs.sort((a, b) => a - b)
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, Math.ceil(xs[i] - 0.5)); x <= Math.min(S - 1, Math.floor(xs[i + 1] - 0.5)); x++) m[y * S + x] = 1
    }
  }
  return m
}

// The face is the figure's own: Tripo now and then repainted an eye, a
// brow or the mouth while dressing it (a pale patch over the robot's eye,
// the unicorn's upper lip). The box round the eyes and the mouth of the pose
// (tests/unit/face-zones.json, in the poses file's 384 px) is never clothes.
export function faceBox(zones, figure, pose) {
  const z = zones?.[figure]?.[pose]
  if (!z?.eyes) return new Uint8Array(N)
  // the hull of the eyes (with the brows: 12 px higher) and the mouth, a
  // little wider; not the box round them (a raised sleeve beside the chin)
  const runs = [...z.eyes.flat(), ...(z.mouth ?? [])]
  const ey0 = Math.min(...z.eyes.flat().map(r => r[0]))
  const pts = runs.flatMap(([y, x0, x1]) => [[x0, y], [x1, y]])
  for (const [y, x0, x1] of z.eyes.flat()) if (y === ey0) pts.push([x0, y - 12], [x1, y - 12])
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1])
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const half = list => { const h = []; for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p) } return h }
  const lower = half(pts), upper = half([...pts].reverse())
  const hull = [...lower.slice(0, -1), ...upper.slice(0, -1)]
  const k = S / 384
  return dilate(polygons([hull.map(([x, y]) => [x * k, y * k])]), 8)
}

// Pieces of the clothes apart from the garment (specks between the legs,
// crumbs beside the hands): what of top and bottom together (they are worn
// as one outfit) is not joined to the large parts goes, with its soft rim.
// Large parts apart from the main one stay (a hood's two cat ears above the
// head, the cloth seen between the feet when the figure sits). Nothing is
// left in the face box either.
export const STRAY_MAX = 1000
function dropStray(top, bottom, face, ownParts, neckY) {
  for (const L of [top, bottom]) for (let p = 0; p < N; p++) if (face[p]) L.data[p * 4 + 3] = 0
  // above the neck, thin lines are Tripo's redrawn outline of the head
  // (an arc round the chick's head), no cloth: what does not survive an
  // opening of 2 px there goes (a hood's ears are thick and stay)
  {
    const sol = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (top.data[p * 4 + 3] > 60 || bottom.data[p * 4 + 3] > 60) sol[p] = 1
    const thick = dilate(erode(sol, 2), 3)
    for (let p = 0; p < N && p < neckY * S; p++) if (sol[p] && !thick[p]) { top.data[p * 4 + 3] = 0; bottom.data[p * 4 + 3] = 0 }
  }
  const solid = new Uint8Array(N)
  for (let p = 0; p < N; p++) if (top.data[p * 4 + 3] > 100 || bottom.data[p * 4 + 3] > 100) solid[p] = 1
  const { comps } = components(solid)
  let big = 0
  for (let i = 1; i < comps.length; i++) if (!big || comps[i].length > comps[big].length) big = i
  const gone = new Uint8Array(N), kept = new Uint8Array(N)
  // (a large part lying mostly on the figure's own arms or wings, its
  // dragon's wing that Tripo coloured differently, goes too)
  const mine = c => c.filter(p => ownParts[p]).length > 0.5 * c.length
  for (let i = 1; i < comps.length; i++) for (const p of comps[i]) (i === big || (comps[i].length >= STRAY_MAX && !mine(comps[i])) ? kept : gone)[p] = 1
  const nearGone = dilate(gone, 2), nearKept = dilate(kept, 2)
  for (let p = 0; p < N; p++) if (gone[p] || (nearGone[p] && !nearKept[p])) { top.data[p * 4 + 3] = 0; bottom.data[p * 4 + 3] = 0 }
}

// ── one pose ──
const dist3 = (X, i, Y, j) => Math.abs(X[i] - Y[j]) + Math.abs(X[i + 1] - Y[j + 1]) + Math.abs(X[i + 2] - Y[j + 2])
const lum = (X, i) => 0.3 * X[i] + 0.59 * X[i + 1] + 0.11 * X[i + 2]

function sampler(sheet, cell) {
  const k = sheet.w / (COLS * S), ox = (cell % COLS) * S * k, oy = Math.floor(cell / COLS) * S * k, D = sheet.data, SW = sheet.w
  return (x, y, out, o) => {
    x = ox + x * k; y = oy + y * k
    const x0 = Math.floor(x), y0 = Math.floor(y)
    if (x < ox || y < oy || x0 + 1 >= ox + S * k || y0 + 1 >= oy + S * k) { out[o] = out[o + 1] = out[o + 2] = 255; return }
    const fx = x - x0, fy = y - y0, a = (y0 * SW + x0) * 4, b = a + 4, c = a + SW * 4, d = c + 4
    for (let ch = 0; ch < 3; ch++) out[o + ch] = (D[a + ch] * (1 - fx) + D[b + ch] * fx) * (1 - fy) + (D[c + ch] * (1 - fx) + D[d + ch] * fx) * fy
  }
}

/** Step 1: the shift (dx, dy) and scale s about the middle that lay the result cell on the template. */
export function register(T, A, sample, P) {
  const k = S / 384, neckY = P.neck.y * k
  let ymax = 0
  for (let p = 0; p < N; p++) if (A[p] > 128) ymax = Math.max(ymax, Math.floor(p / S))
  // points on and near the outlines of the head (above the neck) and the feet
  const pts = []
  for (let y = 2; y < S - 2; y += 2) for (let x = 2; x < S - 2; x += 2) {
    if (!(y < neckY - 20 || y > ymax - 28)) continue
    const p = y * S + x
    let edge = false
    for (const q of [p - 3, p + 3, p - 3 * S, p + 3 * S]) if ((A[q] > 128) !== (A[p] > 128) || Math.abs(lum(T, q * 3) - lum(T, p * 3)) > 40) edge = true
    if (edge) pts.push(p)
  }
  const tmp = new Float32Array(3)
  const cost = (list, s, dx, dy) => {
    let c = 0
    for (const p of list) {
      const x = p % S, y = (p - x) / S
      sample(256 + s * (x - 256) + dx, 256 + s * (y - 256) + dy, tmp, 0)
      c += Math.min(150, Math.abs(tmp[0] - T[p * 3]) + Math.abs(tmp[1] - T[p * 3 + 1]) + Math.abs(tmp[2] - T[p * 3 + 2]))
    }
    return c / list.length
  }
  const third = pts.filter((_, j) => j % 3 === 0), half = pts.filter((_, j) => j % 2 === 0)
  let best = { c: cost(third, 1, 0, 0), s: 1, dx: 0, dy: 0 }
  const none = cost(pts, 1, 0, 0)
  for (let dy = -12; dy <= 12; dy++) for (let dx = -12; dx <= 12; dx++) { const c = cost(third, 1, dx, dy); if (c < best.c) best = { c, s: 1, dx, dy } }
  let b = { ...best }; best.c = cost(half, b.s, b.dx, b.dy)
  for (let s = 0.96; s <= 1.0401; s += 0.005) for (let dy = b.dy - 3; dy <= b.dy + 3; dy += 0.5) for (let dx = b.dx - 3; dx <= b.dx + 3; dx += 0.5) { const c = cost(half, s, dx, dy); if (c < best.c) best = { c, s, dx, dy } }
  b = { ...best }; best.c = cost(pts, b.s, b.dx, b.dy)
  for (let s = b.s - 0.004; s <= b.s + 0.0041; s += 0.001) for (let dy = b.dy - 0.5; dy <= b.dy + 0.5; dy += 0.25) for (let dx = b.dx - 0.5; dx <= b.dx + 0.5; dx += 0.25) { const c = cost(pts, s, dx, dy); if (c < best.c) best = { c, s, dx, dy } }
  return { s: +best.s.toFixed(3), dx: best.dx, dy: best.dy, cost: +best.c.toFixed(1), before: +none.toFixed(1) }
}

/** Steps 2 and 3 for one pose: { top, bottom } as RGBA 512², plus what the debug pictures show. */
export function cutPose(T, A, W, P, opts = { bottom: true, erase: false }) {
  const k = S / 384
  // Tripo's ground: the cell's border colour (the median), and what is close
  // to it. Pale clothes (a bee's light blue wing, 235 244 250) are not ground
  // (Tripo's white is about 254)
  const G = [0, 1, 2].map(ch => { const v = []; for (let p = 0; p < N; p++) if (border(p)) v.push(W[p * 3 + ch]); v.sort((a, b) => a - b); return v[v.length >> 1] })
  const white = p => Math.abs(W[p * 3] - G[0]) + Math.abs(W[p * 3 + 1] - G[1]) + Math.abs(W[p * 3 + 2] - G[2]) < 22
  // the ground: white reached from the border
  // (with Tripo's pale soft shading on the ground where the template has no
  // figure: the glow under a hand, the grey edge of a trouser leg between
  // the legs; reached from the ground without crossing a dark outline, so a
  // pale wing or a white coat, drawn with their outline, stay clothes)
  const pale = p => { const r = W[p * 3], g = W[p * 3 + 1], b = W[p * 3 + 2]; return A[p] < 24 && lum(W, p * 3) > 222 && Math.max(r, g, b) - Math.min(r, g, b) < 40 }
  const reach = flood(Array.from({ length: N }, (_, p) => p).filter(border), p => white(p) || pale(p))
  // changed: no template colour within R px is close
  const THR = 50
  const changedWithin = (R, p) => {
    const x = p % S, y = (p - x) / S
    let best = 1e9
    for (let e = -R; e <= R && best > THR; e++) for (let d = -R; d <= R; d++) {
      const X = x + d, Y = y + e
      if (X < 0 || Y < 0 || X >= S || Y >= S) continue
      const v = dist3(W, p * 3, T, (Y * S + X) * 3); if (v < best) best = v
    }
    return best > THR
  }
  const changed = new Uint8Array(N)
  // (where the template has no figure, whatever is not Tripo's ground is new:
  // a pale wing or a white coat over the template's white)
  for (let p = 0; p < N; p++) if (!reach[p] && (changedWithin(2, p) || (A[p] < 24 && !white(p)))) changed[p] = 1
  // A white garment over a cream or pale figure (a chef's jacket on the
  // unicorn): Tripo's white is the ground's own white, the figure's is not
  // (it is warmer or greyer). Where Tripo has the ground's white and the
  // template has nothing that white within 2 px, it is new.
  // Only on the figure's arms (its poses file: a sleeve): Tripo repainted
  // the robot's white legs and hips in its pure white too, no clothes there.
  const dG = (X, i) => Math.abs(X[i] - G[0]) + Math.abs(X[i + 1] - G[1]) + Math.abs(X[i + 2] - G[2])
  const arms = dilate(polygons([...(P.wings ?? []), ...(P.front ? [P.front] : []), ...(P.grip ? [P.grip] : [])].map(pl => pl.map(([x, y]) => [x * k, y * k]))), 4)
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const p = y * S + x
    if (reach[p] || changed[p] || !arms[p] || A[p] < 200 || dG(W, p * 3) > 12) continue
    let near = false
    for (let e = -2; e <= 2 && !near; e++) for (let d = -2; d <= 2; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && dG(T, (Y * S + X) * 3) <= 12) { near = true; break } }
    if (!near) changed[p] = 1
  }
  // white enclosed by the figure is the ground too (a gap between an arm and
  // the body) where the template has no figure either and what encloses it
  // is mostly the figure's own; enclosed by clothes it is clothes (a white
  // coat, the light inside of a bee's wing)
  const bg = reach.slice()
  {
    // (only the white where the template has no figure: the robot's white
    // legs beside a gap between them belong to the figure, not to the gap,
    // and count as its unchanged rim)
    const { comps } = components(reach.map((v, p) => (!v && white(p) && A[p] < 60 ? 1 : 0)))
    for (const c of comps.slice(1)) {
      let rim = 0, ch = 0
      const inC = new Set(c)
      for (const p of c) n4(p, q => { if (!inC.has(q)) { rim++; ch += changed[q] } })
      if (ch < 0.5 * rim) for (const p of c) bg[p] = 1
    }
  }
  for (let p = 0; p < N; p++) if (bg[p]) changed[p] = 0
  // clean: opening, the large parts only, closing, back off the ground
  let m = dilate(erode(changed, 2), 2)
  // (the size is that of the parts lying close together: the blue stripes of
  // a shirt on a blue and white robot are found one by one, each small)
  const near = erode(dilate(m, 5), 5)
  const { lab: nlab, comps } = components(near)
  const big = new Uint8Array(N)
  for (let p = 0; p < N; p++) if (m[p] && nlab[p] && comps[nlab[p]].length >= 900) big[p] = 1
  m = and(erode(dilate(big, 2), 2), not(bg))
  // what is cut off by the closing at the edge comes back where it was changed
  const around = dilate(big, 3)
  m = m.map((v, p) => v | (changed[p] && around[p] ? 1 : 0))
  // thin parts of the clothes the opening took (a wing's thin outline) come
  // back where they join the clothes and are surely new: no template colour
  // within 4 px (Tripo's redrawn outlines of the figure are within that)
  {
    const sure = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (changed[p] && !m[p] && changedWithin(4, p)) sure[p] = 1
    const st = []
    for (let p = 0; p < N; p++) if (m[p]) st.push(p)
    while (st.length) n4(st.pop(), q => { if (sure[q] && !m[q]) { m[q] = 1; st.push(q) } })
  }
  const tailAt = polygons((P.tail ?? []).map(pl => pl.map(([x, y]) => [x * k, y * k])))
  const legNear = new Uint8Array(N)
  const legAt = polygons([...(P.tail ?? []), ...(P.feet ?? [])].map(pl => pl.map(([x, y]) => [x * k, y * k])))
  legNear.set(dilate(legAt, 6))
  const own = dilate(polygons([...(P.wings ?? []), ...(P.feet ?? []), ...(P.tail ?? []), ...(P.front ? [P.front] : []), ...(P.grip ? [P.grip] : [])].map(pl => pl.map(([x, y]) => [x * k, y * k]))), 4)
  // Holes inside the clothes: the parts that Tripo's strokes (every changed
  // pixel, the thin outlines too) cut off from the ground, the head and the
  // figure's own arms, hands and feet. They are clothes in a colour the figure
  // has too: a white coat's sleeve on the white unicorn, a white stripe, a
  // yellow stripe on the yellow chick. A part reaching the ground, or lying
  // above the neck, is the figure's; a part mostly inside its own arms and
  // hands (the polygons of its poses file) stays the figure's too, apart from
  // the bits outside them.
  const face0 = faceBox(opts.zones, opts.figure, opts.pose)
  // A part reaching down to the feet is the figure's legs (Tripo redrew
  // their outline, so they looked cut off: the robot's white legs).
  const feetZone = new Uint8Array(N)
  if (P.feet) feetZone.set(dilate(polygons(P.feet.map(pl => pl.map(([x, y]) => [x * k, y * k]))), 4))
  else if (P.soles) {
    const up = (FEET_UP[opts.figure] ?? 0) * k
    feetZone.set(dilate(polygons([P.soles.map(([x, y]) => [x * k, (y < 383 ? y * k - up : y * k)])]), 4))
  }
  {
    const strokes = dilate(changed, 1), headY = P.neck.y * k - 12
    const holes = components(m.map((v, p) => (!v && !strokes[p] && !bg[p] ? 1 : 0)))
    for (const c of holes.comps.slice(1)) {
      let touchesBg = false
      for (const p of c) n4(p, q => { if (bg[q]) touchesBg = true })
      // (above the neck only small holes, closed in by the clothes and off
      // the face: the gaps in a white fur collar on the white unicorn)
      // (a large one only when much of it lies above: a fur collar's half,
      // reaching a pixel or two over the neck line, is the collar's)
      const above = c.filter(p => p < headY * S).length
      if (touchesBg || c.some(border) || (above && ((c.length >= 600 && above > 0.15 * c.length) || c.some(p => face0[p])))) continue
      if (!opts.erase && c.filter(p => feetZone[p] && A[p] > 200).length > 30) continue
      const mine = c.filter(p => own[p]).length
      // (a mermaid's fin over the old tail: its pale inside, close to the
      // white ground the old tail's rim lay on, is the fin's, not the tail's)
      const finOverTail = opts.erase && c.filter(p => legNear[p]).length > 0.5 * c.length
      // (a small hole is clothes even on the arms: a yellow star of the pyjama
      // on the yellow chick; a hand lying in front is larger)
      if (c.length < 400 || mine < 0.3 * c.length || finOverTail) for (const p of c) m[p] = 1
      else for (const p of c) if (!own[p]) m[p] = 1
    }
  }
  m = and(m, not(bg))
  // short runs between clothes, along a row or a column, are clothes too
  // when they hold no ground and none of the figure's own arms, hands or
  // feet: a stripe in the figure's own colour (the green and the cream of
  // rainbow leggings) that reaches the garment's edge and so is no hole
  {
    const L = 28, add = new Uint8Array(N)
    const scan = (len, at) => {
      for (let i = 0; i < S; i++) {
        let last = -1
        for (let j = 0; j < len; j++) {
          const p = at(i, j)
          if (!m[p]) continue
          if (last >= 0 && j - last > 1 && j - last <= L) {
            let ok = true
            for (let t = last + 1; t < j && ok; t++) { const q = at(i, t); if (bg[q] || own[q] || (white(q) && A[q] < 200)) ok = false }
            if (ok) for (let t = last + 1; t < j; t++) add[at(i, t)] = 1
          }
          last = j
        }
      }
    }
    scan(S, (y, x) => y * S + x)
    scan(S, (x, y) => y * S + x)
    for (let p = 0; p < N; p++) if (add[p]) m[p] = 1
  }
  // slivers along the garment's edge that look like the figure's outline
  // (Tripo's soft edge): thin or tiny bits of "figure" touching the clothes
  // are clothes
  {
    const rest = m.map((v, p) => (!v && !bg[p] ? 1 : 0))
    const solid = dilate(erode(rest, 1), 1), touch = dilate(m, 1)
    const { comps } = components(rest)
    const tiny = new Uint8Array(N)
    for (const c of comps.slice(1)) if (c.length < 80) for (const p of c) tiny[p] = 1
    for (let p = 0; p < N; p++) if (rest[p] && touch[p] && (!solid[p] || tiny[p])) m[p] = 1
  }
  // Small holes still left inside the clothes above the hips (bars of the
  // unicorn's cream neck in a white fur collar, cut apart by Tripo's fur
  // strokes): closed in by the clothes all round, off the figure's own
  // arms and hands and the face, they are clothes
  {
    const headY = P.neck.y * k - 12, hipY = P.bottom.y * k
    const { comps } = components(m.map((v, p) => (!v && !bg[p] ? 1 : 0)))
    for (const c of comps.slice(1)) {
      if (c.length >= 400 || c.some(p => border(p) || face0[p] || own[p] || p < headY * S || p >= hipY * S)) continue
      let open = false
      for (const p of c) n4(p, q => { if (bg[q]) open = true })
      if (!open) for (const p of c) m[p] = 1
    }
  }

  // Thin parts where the template has no figure (Tripo's soft grey shading
  // along a trouser leg in the gap between the legs, a fringe at the hips):
  // no clothes. What is wide there stays (a coat's tails, a bee's wings).
  {
    const out = m.map((v, p) => (v && A[p] < 24 ? 1 : 0))
    const wide = dilate(erode(out, 3), 4)
    for (let p = 0; p < N; p++) if (out[p] && !wide[p]) m[p] = 0
  }

  // ── step 3: top and bottom ──
  const top = { x: P.top.x * k, y: P.top.y * k, w: P.top.w * k }, bot = { x: P.bottom.x * k, y: P.bottom.y * k, w: P.bottom.w * k }
  const q = p => ((W[p * 3] >> 3) << 10) | ((W[p * 3 + 1] >> 3) << 5) | (W[p * 3 + 2] >> 3)
  const hT = new Float32Array(32768), hB = new Float32Array(32768)
  const seedT = [], seedB = []
  // The chest is learnt from a box below the neck; where the figure's own
  // arms lie in front of it (the chick's wings held before its belly when it
  // is sad) the box is mostly arm, and the top's own colour (a pullover's
  // green beside them) was never learnt: the box is then widened to the sides
  let half = 0.3
  {
    let all = 0, arm = 0
    for (let y = Math.ceil(top.y + 13); y < top.y + 12 + 0.22 * top.w; y++) for (let x = Math.ceil(top.x - 0.3 * top.w); x < top.x + 0.3 * top.w; x++) { all++; if (own[y * S + x] && !m[y * S + x]) arm++ }
    if (arm > 0.3 * all) half = 0.48
  }
  // (and the top then hangs lower, over the arms: the hips are learnt lower down)
  const hipY = bot.y + 8 + (half > 0.3 ? 0.16 * bot.w : 0)
  for (let p = 0; p < N; p++) {
    if (!m[p]) continue
    const x = p % S, y = (p - x) / S
    if (y > top.y + 12 && y < top.y + 12 + 0.22 * top.w && Math.abs(x - top.x) < half * top.w) seedT.push(p)
    if (opts.bottom && y > hipY && y < hipY + 0.2 * bot.w && Math.abs(x - bot.x) < 0.3 * bot.w) seedB.push(p)
  }
  // a colour bin and its neighbours count (a soft histogram)
  const add = (h, p) => { const c = q(p), r = c >> 10, g = (c >> 5) & 31, b = c & 31
    for (let dr = -1; dr <= 1; dr++) for (let dg = -1; dg <= 1; dg++) for (let db = -1; db <= 1; db++) {
      const R2 = r + dr, G = g + dg, B = b + db
      if (R2 < 0 || G < 0 || B < 0 || R2 > 31 || G > 31 || B > 31) continue
      h[(R2 << 10) | (G << 5) | B] += dr || dg || db ? 0.3 : 1
    } }
  for (const p of seedT) add(hT, p)
  for (const p of seedB) add(hB, p)
  const nT = seedT.length || 1, nB = seedB.length || 1
  // A white sleeve over a white arm (a chef's jacket on the unicorn or the
  // robot) has the arm's colour, so the arm stayed the figure's. An arm of
  // the figure (its poses file) that Tripo dressed (much of it changed: the
  // sleeve's outline and folds; much of it white in the top's own colours)
  // gives its white and changed part, joined to the clothes, to the top. A
  // hand (pink, blue) is no white and unchanged: it stays the figure's.
  {
    const headY = P.neck.y * k - 12
    const { comps } = components(own.map((v, p) => (v && !bg[p] && !m[p] && p >= headY * S ? 1 : 0)))
    const isWhite = p => { const r = W[p * 3], g = W[p * 3 + 1], b = W[p * 3 + 2]; return Math.min(r, g, b) > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 30 }
    const topLike = p => hT[q(p)] / nT > 0.01 && hT[q(p)] / nT > hB[q(p)] / (seedB.length || 1)
    const added = new Uint8Array(N)
    for (const c of comps.slice(1)) {
      if (c.length < 40) continue
      // an arm Tripo dressed: much of it changed (the sleeve's outline and
      // folds), and white in the top's own colours
      const ch = c.filter(p => changed[p]).length, wh = c.filter(p => isWhite(p) && topLike(p)).length
      if (ch < 0.12 * c.length || wh < 0.3 * c.length) continue
      for (const p of c) if ((isWhite(p) && topLike(p)) || changed[p]) added[p] = 1
    }
    // closed, and only next to the clothes: the sleeve, not a hand
    const shut = erode(dilate(added, 2), 2)
    const st = []
    for (let p = 0; p < N; p++) if (m[p]) st.push(p)
    while (st.length) n4(st.pop(), q2 => { if (shut[q2] && !m[q2] && !bg[q2]) { m[q2] = 1; st.push(q2) } })
  }
  let prob = new Float32Array(N)
  for (let p = 0; p < N; p++) {
    if (!m[p]) continue
    const a = hT[q(p)] / nT, b = hB[q(p)] / nB
    // where neither has the colour: by height between the chest and the hips
    const y = Math.floor(p / S), byY = Math.min(1, Math.max(0, (bot.y - y) / Math.max(1, bot.y - top.y - 20)))
    prob[p] = a + b > 1e-4 ? (a + 0.02 * byY) / (a + b + 0.02) : byY
  }
  // Parts in a colour neither the chest nor the hips have (a bee's wings, a
  // hood's ears, a cape) go whole to one side: to the top when they lie above
  // the waist, else to the bottom. Parts are grown from a pixel to the
  // neighbours of about its colour.
  {
    const seen = new Uint8Array(N)
    for (let p0 = 0; p0 < N; p0++) {
      if (!m[p0] || seen[p0]) continue
      const ref = p0 * 3, part = [p0]; seen[p0] = 1
      for (let i = 0; i < part.length; i++) n4(part[i], q => { if (m[q] && !seen[q] && dist3(W, q * 3, W, ref) < 45) { seen[q] = 1; part.push(q) } })
      if (part.length < 60) continue
      let none = 0, cy = 0, off = 0
      for (const p of part) { if (hT[q(p)] / nT + hB[q(p)] / nB < 0.02) none++; cy += Math.floor(p / S); if (A[p] < 24 || legAt[p]) off++ }
      // (a mermaid's fin lies where the figure has no body, or over its own
      // tail or feet: it is the bottom's, however high it reaches)
      if (opts.erase && off > 0.6 * part.length && cy / part.length > top.y + 0.3 * (bot.y - top.y)) { for (const p of part) prob[p] = 0 }
      else if (none > 0.6 * part.length) { const v = cy / part.length < bot.y ? 1 : 0; for (const p of part) prob[p] = v }
    }
  }
  const prob0 = prob.slice()
  // smoothing over the neighbourhood (inside the clothes)
  const r = 4
  for (let it = 0; it < 3; it++) {
    const o = new Float32Array(N)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x; if (!m[p]) continue
      let s = 0, c = 0
      for (let e = -r; e <= r; e++) for (let d = -r; d <= r; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const qq = Y * S + X; if (m[qq]) { s += prob[qq]; c++ } }
      o[p] = 0.5 * prob[p] + 0.5 * s / c
    }
    prob = o
  }
  let isTop = m.map((v, p) => (v && prob[p] >= 0.5 ? 1 : 0)), isBot = m.map((v, p) => (v && prob[p] < 0.5 ? 1 : 0))
  // the border between them smoothed (a majority over a small disc), so the
  // hem runs smoothly, not in teeth
  for (let it = 0; it < 3; it++) {
    const t2 = isTop.slice()
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x
      if (!m[p]) continue
      let a = 0, n = 0
      for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { if (d * d + e * e > 10) continue; const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const qq = Y * S + X; if (m[qq]) { a += isTop[qq]; n++ } }
      t2[p] = 2 * a > n ? 1 : 2 * a < n ? 0 : isTop[p]
    }
    isTop = t2; isBot = m.map((v, p) => (v && !isTop[p] ? 1 : 0))
  }
  // parts cut off from their side change sides (or go when tiny)
  for (let pass = 0; pass < 2; pass++) {
    for (const [mine, other, seed] of [[isTop, isBot, seedT], [isBot, isTop, seedB]]) {
      const { lab, comps } = components(mine)
      const keep = new Set(seed.map(p => lab[p]).filter(Boolean))
      // the largest part counts as seeded too
      let li = 0; for (let i = 1; i < comps.length; i++) if (!li || comps[i].length > comps[li].length) li = i
      if (li) keep.add(li)
      // (only small ones: a large part keeps its colour's side, like a trouser
      // leg that the sitting feet cut off from the rest)
      for (let i = 1; i < comps.length; i++) {
        if (keep.has(i)) continue
        const c = comps[i], sure = c.reduce((a, p) => a + Math.abs(prob[p] - 0.5), 0) / c.length
        if (c.length < 300 || sure < 0.12) for (const p of c) { mine[p] = 0; other[p] = 1 }
      }
    }
  }
  // With the arms in front, the top's hem hangs below them and a strip of
  // it between and under the arms was taken for the bottom (cut off from
  // the pullover above by the arms): the top is closed over such strips
  if (half > 0.3 && opts.bottom) {
    const shut = erode(dilate(isTop, 10), 10)
    for (let p = 0; p < N; p++) if (shut[p] && isBot[p]) { isBot[p] = 0; isTop[p] = 1 }
  }
  // A mermaid's fin: at its upper edge over the body, what is in the top's
  // colours and in none of the fin's (the jacket's hem) is the top's
  if (opts.erase) {
    // (over the old tail, what is in none of the top's colours is the fin's)
    for (let p = 0; p < N; p++) if (isTop[p] && legNear[p] && hT[q(p)] / nT < 0.004) { isTop[p] = 0; isBot[p] = 1 }
    const yMax = bot.y + 0.2 * bot.w
    for (let p = 0; p < N; p++) {
      if (!isBot[p] || Math.floor(p / S) > yMax || A[p] < 200 || legAt[p]) continue
      const a = hT[q(p)] / nT, b = hB[q(p)] / nB
      if (b < 0.002 && a > 0.004) { isBot[p] = 0; isTop[p] = 1 }
    }
  }
  // Sitting, a bottom in the figure's own colour (clown trousers as yellow
  // as the dragon's belly) was found only by its pattern (the red dots, then
  // reading as a face): the bottom is closed over its gaps on the figure's
  // body, off its own arms, hands and feet, and the cloth taken from Tripo
  if (opts.bottom && !opts.erase && P.feet) {
    const shut = erode(dilate(isBot, 18), 18)
    for (let p = 0; p < N; p++) if (shut[p] && !m[p] && !bg[p] && A[p] > 200 && !own[p]) { isBot[p] = 1; m[p] = 1 }
    // When that is not enough (only the pattern was found), the lap is
    // taken whole as Tripo painted it: from the bottom's pixels over
    // everything that is not a dark line, so the trousers' own dark outline
    // is the edge (with the outline itself), below the top, off the arms,
    // hands and feet. Used only when it adds much (a bottom in the figure's
    // colour); a bottom of its own colour was found whole already.
    const nb = isBot.reduce((a, v) => a + v, 0)
    if (nb) {
      let y0 = S; for (let p = 0; p < N; p++) if (isBot[p]) y0 = Math.min(y0, Math.floor(p / S))
      const darkW = p => lum(W, p * 3) < 75
      const feetHere = dilate(polygons(P.feet.map(pl => pl.map(([x, y]) => [x * k, y * k]))), 2)
      const pass = p => !isBot[p] && !isTop[p] && !darkW(p) && !bg[p] && A[p] > 200 && !own[p] && !feetHere[p] && Math.floor(p / S) >= y0 - 4
      const lap = flood(Array.from({ length: N }, (_, p) => p).filter(p => isBot[p]), p => isBot[p] || pass(p))
      let add = 0; for (let p = 0; p < N; p++) if (lap[p] && !isBot[p]) add++
      if (add > 0.6 * nb && add < 6 * nb) {
        const edge = dilate(lap, 3)
        for (let p = 0; p < N; p++) if (lap[p] || (edge[p] && darkW(p) && !isTop[p] && !bg[p] && !own[p] && !feetHere[p] && A[p] > 200)) { isBot[p] = 1; m[p] = 1 }
      }
    }
  }
  // a sheet with a top only (a pyjama top): only the top
  if (!opts.bottom) {
    // what Tripo changed below it (it redrew the legs or the feet now and
    // then) is no thing to wear: the split is made as usual, the top kept,
    // with what of the "bottom" touches it (the stars at its hem, taken for
    // a bottom by their height)
    const { comps } = components(isBot)
    const nearTop = dilate(isTop, 1)
    for (const c of comps.slice(1)) if (c.some(p => nearTop[p])) for (const p of c) isTop[p] = 1
    isBot = new Uint8Array(N)
    m = m.map((v, p) => (v && isTop[p] ? 1 : 0))
  }

  // The figure's own parts that lie in front of the top (the chick's wings
  // held before its belly when sad, paws resting on a jacket): holes in the
  // clothes, inside its own polygons, framed by the top. The top's picture
  // carries them, from the pose picture with their own outline, so they lie
  // cleanly over the garment whatever bottom is worn (the garment's cut edge
  // and Tripo's outline of them, drawn on them, are gone)
  const inFront = new Uint8Array(N)
  {
    const headY = P.neck.y * k - 12
    const { comps } = components(m.map((v, p) => (!v && !bg[p] && own[p] ? 1 : 0)))
    const seeds = []
    for (const c of comps.slice(1)) {
      if (c.length < 40 || c.some(border) || c.some(p => p < headY * S)) continue
      let top2 = 0, bot2 = 0, open = 0
      const inC = new Set(c)
      for (const p of c) n4(p, q2 => { if (inC.has(q2)) return; if (isTop[q2]) top2++; else if (isBot[q2]) bot2++; else open++ })
      if (top2 < 0.3 * (top2 + bot2 + open) || open > 0.15 * (top2 + bot2 + open)) continue
      for (const p of c) { inFront[p] = 1; seeds.push(p) }
    }
    // out to the part's own outline in the pose picture (its darkest ring),
    // at most 4 px, through what was taken for clothes
    if (seeds.length) {
      let l0 = 0; for (const p of seeds) l0 += lum(T, p * 3); l0 /= seeds.length
      const dark = p => lum(T, p * 3) < 0.8 * l0
      let ring = seeds.filter(p => !dark(p))
      for (let step = 0; step < 4 && ring.length; step++) {
        const next = []
        for (const p of ring) n4(p, q2 => { if (!inFront[q2] && m[q2] && own[q2] && A[q2] > 200) { inFront[q2] = 1; if (!dark(q2)) next.push(q2) } })
        ring = next
      }
    }
  }
  // The figure's own feet are no part of a bottom (Tripo redrew them, and
  // drawn over the shoes they hid them): standing, the soles' strip of the
  // poses file raised to the top of the feet (FEET_UP, per figure) where the
  // figure is; sitting, the feet in front. A little wider; the bottom ends
  // there in its own outline colour (a hem), and the pose picture's feet, or
  // the shoes, show whole
  const feet = new Uint8Array(N)
  // (sitting: whether Tripo dressed the legs, see below)
  let legsDressed = false
  const legFill = new Uint8Array(N), legEdge = new Uint8Array(N)
  if (opts.bottom && !opts.erase) {
    // (sitting, the polygons are loose: the foot as the pose picture draws
    // it, inside its own dark outline, grown from the polygon's middle; not
    // the belly beside it, where the skirt stays)
    if (P.feet) {
      const poly = dilate(polygons(P.feet.map(pl => pl.map(([x, y]) => [x * k, y * k]))), 3)
      const inner = erode(poly, 10)
      const grown = flood(Array.from({ length: N }, (_, p) => p).filter(p => inner[p]), p => poly[p] && A[p] > 24 && lum(T, p * 3) > 110)
      // On the legs, what was taken for the top in none of the top's own
      // colours is the bottom's (the pale rainbow of leggings, given whole
      // to the top by its height)
      const topLike = p => hT[q(p)] / nT > 0.003 && hT[q(p)] / nT > hB[q(p)] / nB
      for (let p = 0; p < N; p++) if (grown[p] && isTop[p] && !inFront[p] && !topLike(p)) { isTop[p] = 0; isBot[p] = 1 }
      let nIn = 0, nBot = 0
      for (let p = 0; p < N; p++) if (grown[p]) { nIn++; if (isBot[p]) nBot++ }
      feet.set(dilate(grown, 4))
      // Where Tripo dressed the legs (the trousers painted over them, round
      // the soles: more than a few per cent of the legs is the bottom), the
      // trousers cover them as painted: what Tripo changed on the legs (off
      // the hands resting on them and the top) is the bottom's, and only
      // what Tripo shows bare stays the figure's (the soles, the paws); the
      // shoes are drawn over the bottom sitting, so they show whole all the
      // same
      if (nBot > 0.03 * nIn) {
        legsDressed = true
        for (let p = 0; p < N; p++) if (grown[p] && changed[p] && !arms[p] && !isTop[p] && !inFront[p] && !bg[p]) { isBot[p] = 1; m[p] = 1 }
        // The loose polygon takes in a strip of the figure's own leg beside
        // the foot too (the robot's white leg between its boot and its
        // mitten, apart from the boot by the boot's outline): a part much
        // smaller than a foot and of another colour. Tripo drew its own
        // boot there, a little bigger, so it was not changed and stayed
        // bare: the trousers ended in a sliver and the white leg showed
        // beside it. On dressed legs that strip is the trousers' too, in
        // their colour from beside it (legFill, see the colours below)
        {
          const gc = components(grown).comps.slice(1)
          const big = gc.reduce((a, c) => Math.max(a, c.length), 0)
          const mean = c => [0, 1, 2].map(ch => c.reduce((a, p) => a + T[p * 3 + ch], 0) / c.length)
          const mains = gc.filter(c => c.length >= 0.25 * big).map(mean)
          // (not a part next to the top: the arm or the sleeve beside the
          // hem, white too on the robot)
          // (nor one inside a foot: the pale pad of the chick's toes; the
          // feet closed over their outlines and gaps)
          const nearBot = dilate(isBot, 2), nearTop = dilate(isTop, 4), legCols = []
          const mainAt = new Uint8Array(N)
          for (const c of gc) if (c.length >= 0.25 * big) for (const p of c) mainAt[p] = 1
          const footShut = erode(dilate(mainAt, 8), 8)
          for (const c of gc) {
            if (c.length < 150 || c.length >= 0.25 * big || !c.some(p => nearBot[p]) || c.filter(p => nearTop[p]).length > 0.05 * c.length || c.filter(p => footShut[p]).length > 0.5 * c.length) continue
            const mc = mean(c)
            if (!mains.every(f => Math.abs(mc[0] - f[0]) + Math.abs(mc[1] - f[1]) + Math.abs(mc[2] - f[2]) > 90)) continue
            for (const p of c) if (!isTop[p] && !inFront[p] && !bg[p] && !isBot[p]) { isBot[p] = 1; m[p] = 1; legFill[p] = 1 }
            // (its middle colour: the mean takes in its soft rim)
            legCols.push([0, 1, 2].map(ch => c.map(p => T[p * 3 + ch]).sort((a, b) => a - b)[c.length >> 1]))
          }
          // The unicorn's white legs lie inside the loose polygons in one
          // part with its hooves (no outline between them): inside a foot,
          // what the pose shows white (no hue, light, far from the foot's
          // own colour) is leg, and where Tripo painted the trousers' own
          // colours there (pale leggings over it, unchanged against the
          // white) and it reaches the trousers, it is the trousers', as
          // painted (it showed as white patches with the hoof's outline
          // between the hooves and the leggings; bare ankles stay bare)
          for (const c of gc) {
            if (c.length < 0.25 * big) continue
            const med = [0, 1, 2].map(ch => c.map(p => T[p * 3 + ch]).sort((a, b) => a - b)[c.length >> 1])
            const isLeg = p => {
              const r = T[p * 3], g = T[p * 3 + 1], b = T[p * 3 + 2]
              return Math.max(r, g, b) - Math.min(r, g, b) < 40 && lum(T, p * 3) > 200 && Math.abs(r - med[0]) + Math.abs(g - med[1]) + Math.abs(b - med[2]) > 120
            }
            const botLike = p => hB[q(p)] / nB > 0.002 && hB[q(p)] / nB > hT[q(p)] / nT
            const legM = new Uint8Array(N)
            for (const p of c) if (isLeg(p) && botLike(p) && !isTop[p] && !inFront[p] && !bg[p] && !nearTop[p] && !isBot[p]) legM[p] = 1
            const st = []
            for (let p = 0; p < N; p++) if (legM[p]) { let nb = false; n4(p, q2 => { if (isBot[q2]) nb = true }); if (nb) st.push(p) }
            const got = new Uint8Array(N)
            for (const p of st) got[p] = 1
            while (st.length) n4(st.pop(), q2 => { if (legM[q2] && !got[q2]) { got[q2] = 1; st.push(q2) } })
            for (let p = 0; p < N; p++) if (got[p]) { isBot[p] = 1; m[p] = 1 }
          }
          // (and the rest of that leg next to the trousers, in its colour, off
          // the feet: the white peeking out above the crescents of cloth)
          if (legCols.length) {
            const legLike = p => A[p] > 200 && !nearTop[p] && !inFront[p] && !bg[p] && !isBot[p] && !mainAt[p] &&
              legCols.some(f => Math.abs(T[p * 3] - f[0]) + Math.abs(T[p * 3 + 1] - f[1]) + Math.abs(T[p * 3 + 2] - f[2]) < 70)
            let front = []
            for (let p = 0; p < N; p++) if (isBot[p]) front.push(p)
            for (let step = 0; step < 10 && front.length; step++) {
              const next = []
              for (const p of front) n4(p, q2 => { if (!legFill[q2] && legLike(q2)) { legFill[q2] = 1; isBot[q2] = 1; m[q2] = 1; next.push(q2) } })
              front = next
            }
            // (and 2 px of the pose picture's own dark outline round that
            // leg, carried as it is: the trousers' edge, soft once scaled,
            // then lies on the outline, not on a white line of leg)
            const white = isBot.map((v, p) => (v && A[p] > 200 && legCols.some(f => Math.abs(T[p * 3] - f[0]) + Math.abs(T[p * 3 + 1] - f[1]) + Math.abs(T[p * 3 + 2] - f[2]) < 70) ? 1 : 0))
            const ring = dilate(white, 2)
            // (an outline that the trousers now lie on both sides of, the
            // leg's own between it and the cloth, is cloth: in their colour)
            const add = []
            for (let p = 0; p < N; p++) if (ring[p] && !isBot[p] && !isTop[p] && !inFront[p] && !bg[p] && A[p] > 200 && lum(T, p * 3) < 120) add.push(p)
            const addM = new Uint8Array(N)
            for (const p of add) addM[p] = 1
            for (const p of add) {
              const x = p % S, y = (p - x) / S
              let edge = false
              for (let e = -2; e <= 2 && !edge; e++) for (let d = -2; d <= 2; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const q2 = Y * S + X; if (!isBot[q2] && !addM[q2] && !bg[q2] && A[q2] > 200) { edge = true; break } }
              isBot[p] = 1; m[p] = 1
              if (edge) legEdge[p] = 1; else legFill[p] = 1
            }
          }
        }
        // The figure's own light leg between a foot and a hand (the robot's
        // white leg between its boot and its mitten), where Tripo painted the
        // trousers there (the jeans and their patch, with its outline): the
        // trousers' as painted, grown out from them. Left bare, it showed as
        // a white sliver beside a patch cut off by the bigger boot, a red
        // block on white
        {
          const near = dilate(polygons(P.feet.map(pl => pl.map(([x, y]) => [x * k, y * k]))), 16), nearTop = dilate(isTop, 4)
          const light = (X, p) => lum(X, p * 3) > 160 && Math.max(X[p * 3], X[p * 3 + 1], X[p * 3 + 2]) - Math.min(X[p * 3], X[p * 3 + 1], X[p * 3 + 2]) < 45
          const botLikeW = p => hB[q(p)] / nB > 0.002 && hB[q(p)] / nB > hT[q(p)] / nT
          const legW = p => near[p] && A[p] > 200 && light(T, p) && (!light(W, p) || botLikeW(p)) && dist3(W, p * 3, T, p * 3) > 50 && !isBot[p] && !isTop[p] && !nearTop[p] && !inFront[p] && !bg[p]
          let front = []
          for (let p = 0; p < N; p++) if (isBot[p]) front.push(p)
          while (front.length) { const next = []; for (const p of front) n4(p, q2 => { if (legW(q2)) { isBot[q2] = 1; m[q2] = 1; next.push(q2) } }); front = next }
          // (and the pose picture's dark outline in a narrow gap between two
          // parts of them, where Tripo's trousers run on under it: the leg's
          // patch of jeans joins the lap, so it is no piece apart)
          const shut = erode(dilate(isBot, 6), 6)
          const hands = polygons((P.wings ?? []).map(pl => pl.map(([x, y]) => [x * k, y * k])))
          for (let p = 0; p < N; p++) if (shut[p] && near[p] && !isBot[p] && !hands[p] && A[p] > 200 && lum(T, p * 3) < 150 && !light(W, p) && !isTop[p] && !nearTop[p] && !inFront[p] && !bg[p]) { isBot[p] = 1; m[p] = 1 }
        }
        // (bare bits of the light leg framed by the trousers, a pale stripe
        // of leggings as light as the unicorn's leg under it: the trousers'
        // as painted; cut out as feet, they cut the band of leggings round
        // the hoof off from the rest, and it went too. Framed: mostly by
        // the trousers, else by the pose's own outline or hoof, never by
        // the ground; a bare ankle framed by its own outline stays bare)
        {
          const lightT = p => lum(T, p * 3) > 160 && Math.max(T[p * 3], T[p * 3 + 1], T[p * 3 + 2]) - Math.min(T[p * 3], T[p * 3 + 1], T[p * 3 + 2]) < 45
          for (const c of components(isBot.map((v, p) => (!v && A[p] > 200 && lightT(p) && ((!isTop[p] && !inFront[p]) || grown[p]) && !bg[p] ? 1 : 0))).comps.slice(1)) {
            if (c.length > 800 || !c.some(p => grown[p])) continue
            const inC = new Set(c)
            let nb = 0, no = 0, open = false
            for (const p of c) n4(p, q2 => { if (inC.has(q2)) return; if (isBot[q2]) nb++; else { no++; if (bg[q2] || A[q2] <= 200) open = true } })
            if (!open && nb >= 0.4 * (nb + no)) for (const p of c) { isBot[p] = 1; isTop[p] = 0; inFront[p] = 0; m[p] = 1 }
          }
        }
        const bare = grown.map((v, p) => (v && !isBot[p] ? 1 : 0))
        // (the largest bare parts only: the soles, not crumbs between stripes)
        const { comps } = components(bare)
        const keep = new Uint8Array(N)
        for (const c of comps.slice(1)) if (c.length >= 150) for (const p of c) keep[p] = 1
        feet.fill(0); feet.set(dilate(keep, 2))
      }
    }
    else if (P.soles) {
      const up = (FEET_UP[opts.figure] ?? 0) * k
      const strip = polygons([P.soles.map(([x, y]) => [x * k, (y < 383 ? y * k - up : y * k)])])
      const body = dilate(A.map(v => (v > 24 ? 1 : 0)), 4)
      for (let p = 0; p < N; p++) if (strip[p] && body[p]) feet[p] = 1
      feet.set(dilate(feet, 2))
    }
  }

  // Sitting, at the feet only the bottom's solid body stays (Tripo's
  // patches and hems around the feet left thin slivers over them). On legs
  // Tripo dressed, the cloth between a sole and a hand is a narrow band as
  // painted, and its patches are the trousers' own (patched jeans): there
  // only the thinnest slivers go
  const nearFeetBits = new Uint8Array(N)
  if (opts.bottom && !opts.erase && P.feet) {
    const RB = legsDressed ? 2 : 6
    const zoneF = dilate(feet, 14), solidB = dilate(erode(isBot.map((v, p) => (v && !feet[p] ? 1 : 0)), RB), RB)
    for (let p = 0; p < N; p++) if (isBot[p] && zoneF[p] && !feet[p] && !solidB[p]) nearFeetBits[p] = 1
    // (and close round the feet, what is in none of the bottom's own colours:
    // Tripo's patches on the knees, cut in half by the feet)
    const ring = dilate(feet, 12)
    if (!legsDressed) for (let p = 0; p < N; p++) if (isBot[p] && ring[p] && !feet[p] && hB[q(p)] / nB < 0.004) nearFeetBits[p] = 1
  }
  // A mermaid's fin: Tripo's white ground caught in a notch of the fin
  // (beside the body, where the old tail was) is ground, not cloth: it is
  // cut away with the old legs, so no white patch and no sliver of the old
  // tail shows there
  if (opts.erase) {
    const { comps } = components(isBot.map((v, p) => (v && white(p) ? 1 : 0)))
    for (const c of comps.slice(1)) if (c.length >= 20) for (const p of c) { isBot[p] = 0; m[p] = 0; bg[p] = 1 }
  }
  // ── the colours and the soft edge ──
  const nearBg = distance(bg, 2)
  // Tripo's figure that is no clothes (head, hands, tail, feet)
  const other = m.map((v, p) => (!v && !bg[p] ? 1 : 0))
  const nearOther = distance(other, 3)
  const cov = (sel, x, y) => {
    let s = 0, c = 0
    for (let e = -1; e <= 1; e++) for (let d = -1; d <= 1; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const w = d || e ? 1 : 2; s += sel[Y * S + X] * w; c += w }
    return s / c
  }
  // the colours inside: as Tripo painted them; the rim towards the white
  // ground un-mixed from the white, against the darkest colour inside nearby
  // (the garment's outline), so no white halo is left
  const RGB = new Float32Array(N * 3), AL = new Float32Array(N)
  for (const sel of [isTop, isBot]) for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const p = y * S + x
    if (!sel[p]) continue
    let rgb = [W[p * 3], W[p * 3 + 1], W[p * 3 + 2]], a = 1
    if (nearBg[p] <= 2) {
      let F = p, fl = 1e9
      for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const qq = Y * S + X; if (sel[qq] && !bg[qq]) { const l = lum(W, qq * 3); if (l < fl) { fl = l; F = qq } } }
      const f = [W[F * 3], W[F * 3 + 1], W[F * 3 + 2]], bw = f.map(v => 255 - v)
      const al = Math.max(0, Math.min(1, ((255 - rgb[0]) * bw[0] + (255 - rgb[1]) * bw[1] + (255 - rgb[2]) * bw[2]) / Math.max(1, bw[0] ** 2 + bw[1] ** 2 + bw[2] ** 2)))
      if (al < 0.999) rgb = rgb.map((v, i) => (al > 0.15 ? Math.max(0, Math.min(255, (v - (1 - al) * 255) / al)) : f[i]))
      // over the template's body the garment covers it whole
      a = A[p] > 200 ? 1 : Math.max(al, A[p] / 255)
    } else if (nearOther[p] <= 1) a = Math.max(0.5, cov(sel, x, y)) // soft towards a hand or the head
    RGB.set(rgb, p * 3); AL[p] = a
  }
  // (the strip of leg the trousers go on over: the trousers' colours from
  // beside it, spread in by averaging the neighbours, opaque)
  for (let p = 0; p < N; p++) if (legEdge[p]) { RGB[p * 3] = T[p * 3]; RGB[p * 3 + 1] = T[p * 3 + 1]; RGB[p * 3 + 2] = T[p * 3 + 2]; AL[p] = 1 }
  if (legFill.some(v => v)) {
    const todo = [], known = isBot.map((v, p) => (v && !legFill[p] && !legEdge[p] ? 1 : 0))
    for (let p = 0; p < N; p++) if (legFill[p]) { todo.push(p); AL[p] = 1 }
    for (let it = 0; it < 60 && todo.length; it++) {
      const now = []
      for (const p of todo) {
        let r = 0, g = 0, b = 0, c = 0
        n4(p, q2 => { if (known[q2]) { r += RGB[q2 * 3]; g += RGB[q2 * 3 + 1]; b += RGB[q2 * 3 + 2]; c++ } })
        if (c) { RGB[p * 3] = r / c; RGB[p * 3 + 1] = g / c; RGB[p * 3 + 2] = b / c; now.push(p) }
      }
      for (const p of now) known[p] = 1
      for (let i = todo.length - 1; i >= 0; i--) if (known[todo[i]]) todo.splice(i, 1)
    }
  }
  // Where Tripo's clothes stop short of the template's outline (its body was
  // drawn a little narrower), a sliver of the bare body would show beside
  // them. There the garment is pushed out to the template's outline by a
  // smooth warp: at the template's outline it moves by the gap (up to GAP
  // px), BAND px inside the garment not at all, in between as smoothly as can
  // be (Laplace's equation); the garment's own dark outline lands on the
  // template's. Not next to the figure's own parts (a hand, the tail).
  const GAP = 10, BAND = 16
  const lab = new Uint8Array(N)
  for (let p = 0; p < N; p++) lab[p] = isTop[p] ? 1 : isBot[p] ? 2 : 0
  const rimPx = []
  for (let p = 0; p < N; p++) if (m[p]) { let r2 = false; n4(p, q => { if (bg[q]) r2 = true }); if (r2) rimPx.push(p) }
  // outwards: the gap, each pixel with its nearest rim pixel
  const srcOut = new Int32Array(N).fill(-1)
  for (const p of rimPx) srcOut[p] = p
  let front = rimPx.slice()
  // A bottom that replaces the legs (a mermaid's tail): Tripo painted no legs,
  // feet or tail of the figure below the neck, so what of the template's
  // figure lies there on Tripo's white ground is cut away (`erase`, a mask
  // for the pose picture) instead of being covered
  // The unicorn's rainbow tail is hair, no leg (KEEP_TAIL): Tripo put the
  // fin where it was, but it stays, over the fin: its pixels in the pose
  // picture (the colours of the tail, grown from its polygon, with their
  // outline) go into the bottom's picture and are not cut away. The dino's
  // and the dragon's tails became the fin.
  const ownTail = new Uint8Array(N)
  if (opts.erase && KEEP_TAIL.includes(opts.figure)) {
    const sat = p => { const r = T[p * 3], g = T[p * 3 + 1], b = T[p * 3 + 2], hi = Math.max(r, g, b); return hi ? (hi - Math.min(r, g, b)) / hi : 0 }
    const hair = p => A[p] > 128 && sat(p) > 0.22 && lum(T, p * 3) > 140
    const near = dilate(tailAt, 20), y0 = P.neck.y * k
    const grown = flood(Array.from({ length: N }, (_, p) => p).filter(p => tailAt[p] && hair(p)), p => near[p] && p > y0 * S && hair(p))
    // only the large part (the tail), with its outline (not the cream body)
    const { comps } = components(grown)
    let big = null; for (const c of comps.slice(1)) if (!big || c.length > big.length) big = c
    if (big) {
      for (const p of big) ownTail[p] = 1
      const ring = dilate(ownTail, 3)
      for (let p = 0; p < N; p++) if (ring[p] && !ownTail[p] && A[p] > 24 && !(A[p] > 200 && lum(T, p * 3) > 170 && sat(p) < 0.22)) ownTail[p] = 1
      // with its pale shine (closed over)
      const shut = erode(dilate(ownTail, 3), 3)
      for (let p = 0; p < N; p++) if (shut[p] && A[p] > 24) ownTail[p] = 1
    }
  }
  // Sitting, Tripo painted the dino's and the dragon's mermaid as a bowl
  // with a fin to each side, one where the figure's own tail was: that fin
  // goes, and the figure keeps its own tail there (SIT_TAIL), so the
  // mermaid reads as one tail with one fin
  const finGone = new Uint8Array(N)
  const sitTail = !!(opts.erase && P.feet && SIT_TAIL.includes(opts.figure) && P.tail)
  if (sitTail) {
    // the tail as the pose picture draws it, with its outline: drawn over
    // the outfit (the top's picture carries it), so its own edge is the edge
    // (grown from the polygon's middle over the tail's light inside, up to
    // the dark outline between it and the body, then with that outline)
    const core = erode(tailAt, 4), zone = dilate(tailAt, 25)
    let l0 = 0, n0 = 0
    for (let p = 0; p < N; p++) if (core[p] && A[p] > 200) { l0 += lum(T, p * 3); n0++ }
    l0 /= n0 || 1
    const light = p => zone[p] && A[p] > 128 && lum(T, p * 3) > 0.72 * l0
    const grown = flood(Array.from({ length: N }, (_, p) => p).filter(p => core[p] && light(p)), light)
    const { comps: tc } = components(grown)
    let big = null; for (const c of tc.slice(1)) if (!big || c.length > big.length) big = c
    if (big) {
      for (const p of big) ownTail[p] = 1
      const ring = dilate(ownTail, 3)
      for (let p = 0; p < N; p++) if (ring[p] && A[p] > 24 && lum(T, p * 3) <= 0.72 * l0) ownTail[p] = 1
      const shut = erode(dilate(ownTail, 2), 2)
      for (let p = 0; p < N; p++) if (shut[p] && A[p] > 24) ownTail[p] = 1
    }
    // the fin on the tail's side: the part of the outfit beyond the figure's
    // outline that reaches the tail, whole
    const { comps } = components(m.map((v, p) => (v && A[p] < 24 ? 1 : 0)))
    const near = dilate(ownTail, 3)
    for (const c of comps.slice(1)) if (c.some(p => near[p])) for (const p of c) finGone[p] = 1
    // and the rest of that fin over the figure's back (its pale colour,
    // above the tail's top)
    let fr = 0, fg = 0, fb = 0, fn = 0
    for (let p = 0; p < N; p++) if (finGone[p]) { fr += W[p * 3]; fg += W[p * 3 + 1]; fb += W[p * 3 + 2]; fn++ }
    if (fn) {
      const fc = [fr / fn, fg / fn, fb / fn], zone2 = dilate(tailAt, 25)
      // (the same hue as the fin: its channels in the same order and spread)
      const near3 = p => { const c = [W[p * 3], W[p * 3 + 1], W[p * 3 + 2]], d = [0, 1, 2].map(i => c[i] - fc[i]); return Math.max(...d) - Math.min(...d) < 45 && c[1] + c[2] > 2.2 * c[0] }
      let ty = S; for (let p = 0; p < N; p++) if (tailAt[p]) ty = Math.min(ty, Math.floor(p / S))
      const cand = m.map((v, p) => (v && zone2[p] && !ownTail[p] && Math.floor(p / S) < ty + 8 && near3(p) ? 1 : 0))
      for (let p = 0; p < N; p++) if (cand[p]) finGone[p] = 1
    }
    const wide = dilate(finGone, 2)
    for (let p = 0; p < N; p++) if (wide[p] && A[p] < 24) finGone[p] = 1
  }
  const gone = new Uint8Array(N)
  if (opts.erase) {
    const y0 = P.neck.y * k - 10
    for (let p = 0; p < N; p++) if (bg[p] && A[p] > 24 && Math.floor(p / S) > y0 && !ownTail[p]) gone[p] = 1
    // and the old legs' outline next to it (Tripo's soft rim is no ground),
    // not the figure's own arms and hands, nor the clothes
    const wide = dilate(gone, 3)
    for (let p = 0; p < N; p++) if (wide[p] && !m[p] && !own[p] && !ownTail[p] && A[p] > 24 && Math.floor(p / S) > y0) gone[p] = 1
    // and the faint outermost rim of the old legs (a dark line on the ground)
    const rim = dilate(gone, 2)
    for (let p = 0; p < N; p++) if (rim[p] && bg[p] && A[p] > 0 && !ownTail[p]) gone[p] = 1
  }
  // (not into the figure's own arms, hands, feet and tail: where its hand
  // is drawn bigger than Tripo's, the hand shows there, not a stretched sleeve)
  const noWarp = sitTail ? dilate(tailAt, 25) : new Uint8Array(N)
  const eligible = q => !m[q] && bg[q] && A[q] > 24 && nearOther[q] > 2 && !gone[q] && !own[q] && !noWarp[q]
  for (let k2 = 1; k2 <= GAP && front.length; k2++) {
    const next = []
    for (const p of front) n4(p, q => { if (srcOut[q] < 0 && eligible(q)) { srcOut[q] = srcOut[p]; next.push(q) } })
    front = next
  }
  // inwards: the band
  const inBand = new Uint8Array(N)
  front = rimPx.slice(); for (const p of rimPx) inBand[p] = 1
  for (let k2 = 1; k2 < BAND && front.length; k2++) {
    const next = []
    for (const p of front) n4(p, q => { if (!inBand[q] && m[q]) { inBand[q] = 1; next.push(q) } })
    front = next
  }
  // the outermost gap pixels (on the template's outline) are fixed: they show the rim pixel they came from
  const gapPx = [], fixed = new Uint8Array(N), DX = new Float32Array(N), DY = new Float32Array(N)
  for (let q = 0; q < N; q++) if (srcOut[q] >= 0 && !m[q]) {
    gapPx.push(q)
    let edge = false
    n4(q, r2 => { if (A[r2] <= 24) edge = true })
    if (edge) { fixed[q] = 1; DX[q] = (q % S) - (srcOut[q] % S); DY[q] = Math.floor(q / S) - Math.floor(srcOut[q] / S) }
  }
  // rim pixels where the clothes reach past the template already stay
  for (const p of rimPx) { let past = false; n4(p, q => { if (bg[q] && A[q] <= 24) past = true }); if (past) fixed[p] = 1 }
  // the fixed shifts smoothed along the outline (the nearest rim pixel jumps)
  const fx0 = gapPx.filter(q => fixed[q])
  const sm = fx0.map(q => {
    const x = q % S, y = (q - x) / S
    let sx = 0, sy = 0, c = 0
    for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const r2 = Y * S + X; if (fixed[r2] && !m[r2]) { sx += DX[r2]; sy += DY[r2]; c++ } }
    return [sx / c, sy / c]
  })
  fx0.forEach((q, i) => { DX[q] = sm[i][0]; DY[q] = sm[i][1] })
  const domain = [...gapPx.filter(q => !fixed[q]), ...Array.from({ length: N }, (_, p) => p).filter(p => inBand[p] && !fixed[p])]
  const inDom = new Uint8Array(N); for (const p of domain) inDom[p] = 1
  if (fx0.length) for (let it = 0; it < 400; it++) {
    for (const p of domain) {
      let sx = 0, sy = 0, c = 0
      n4(p, q => {
        if (inDom[q] || fixed[q]) { sx += DX[q]; sy += DY[q]; c++ }
        else if (m[q]) c++ // deeper inside: not moved
      })
      if (c) { DX[p] = sx / c; DY[p] = sy / c }
    }
  }
  // the colour at a point of the clothes (bilinear over clothes pixels only)
  const at = (fx, fy, out) => {
    const x0 = Math.floor(fx), y0 = Math.floor(fy)
    let r = 0, gg = 0, b = 0, w = 0, best = -1, bw2 = -1
    for (const [X, Y, wt] of [[x0, y0, (1 - (fx - x0)) * (1 - (fy - y0))], [x0 + 1, y0, (fx - x0) * (1 - (fy - y0))], [x0, y0 + 1, (1 - (fx - x0)) * (fy - y0)], [x0 + 1, y0 + 1, (fx - x0) * (fy - y0)]]) {
      if (X < 0 || Y < 0 || X >= S || Y >= S) continue
      const q = Y * S + X
      if (!m[q] || wt <= 0) continue
      r += RGB[q * 3] * wt; gg += RGB[q * 3 + 1] * wt; b += RGB[q * 3 + 2] * wt; w += wt
      if (wt > bw2) { bw2 = wt; best = q }
    }
    if (!w) return -1
    out[0] = r / w; out[1] = gg / w; out[2] = b / w
    return best
  }
  const RGB2 = RGB.slice(), AL2 = AL.slice(), lab2 = lab.slice(), tmp = [0, 0, 0]
  for (const p of [...domain, ...fx0]) {
    if (Math.abs(DX[p]) + Math.abs(DY[p]) < 0.05) continue
    const x = p % S, y = (p - x) / S
    let q = at(x - DX[p], y - DY[p], tmp)
    if (q < 0) { // fell off the clothes: the nearest rim pixel
      const s2 = srcOut[p] >= 0 ? srcOut[p] : -1
      if (s2 < 0 || !m[s2]) continue
      q = s2; tmp[0] = RGB[s2 * 3]; tmp[1] = RGB[s2 * 3 + 1]; tmp[2] = RGB[s2 * 3 + 2]
    }
    RGB2[p * 3] = tmp[0]; RGB2[p * 3 + 1] = tmp[1]; RGB2[p * 3 + 2] = tmp[2]
    if (lab[q]) lab2[p] = lab[q]
    AL2[p] = m[p] ? (A[p] > 200 ? 1 : AL[p]) : A[p] / 255
  }
  // (bits of the fin left beside the tail laid over it: gone)
  const crumbs = new Uint8Array(N)
  if (ownTail.some(v => v)) {
    const { comps } = components(lab2.map((v, p) => (v === 2 && !ownTail[p] && !finGone[p] ? 1 : 0)))
    // (a bit shut in by the top is the top's own: a seam of the sleeve
    // taken for the bottom by its colour; dropped, it left a slit through
    // which the belly showed, a tick on the hem)
    for (const c of comps.slice(1)) if (c.length < 40) {
      const inC = new Set(c)
      let t = 0, o = 0
      for (const p of c) n4(p, q2 => { if (!inC.has(q2)) { if (lab2[q2] === 1) t++; else o++ } })
      if (t > 3 * o) for (const p of c) lab2[p] = 1
      else for (const p of c) crumbs[p] = 1
    }
  }
  // Between the legs, standing: Tripo painted the gap between the trouser
  // legs as a dark shadow or as its white ground where the template has the
  // figure's body (a dark red blob, white specks at the crotch). Low between
  // the feet, what of the bottom is that dark (thick, no mere outline) or
  // that white goes; the pose picture's body shows there.
  const crotch = new Uint8Array(N), crotchT = new Uint8Array(N)
  if (opts.bottom && !opts.erase && !P.feet && P.shoes && P.soles) {
    const cx = P.shoes.x * k, half = P.shoes.step * k * 0.55
    const footTop = Math.min(...P.soles.map(([, y]) => y)) * k - (FEET_UP[opts.figure] ?? 0) * k
    const dark = new Uint8Array(N), pale = new Uint8Array(N)
    for (let p = 0; p < N; p++) {
      if (lab2[p] !== 2) continue
      const x = p % S, y = (p - x) / S
      if (Math.abs(x - cx) > half || y < footTop - 45 || y > footTop + 6) continue
      const l = lum(RGB2, p * 3)
      if (l < 80) dark[p] = 1
      // (white as Tripo painted it, or as the warp at the edge left it)
      const whiteAt = (X, i) => lum(X, i) > 225 && Math.max(X[i], X[i + 1], X[i + 2]) - Math.min(X[i], X[i + 1], X[i + 2]) < 30
      if (A[p] > 200 && lum(T, p * 3) < 225 && (whiteAt(RGB2, p * 3) || whiteAt(W, p * 3))) pale[p] = 1
    }
    // (thick dark only: an outline 2 px wide does not survive the erosion)
    const thick = dilate(erode(dark, 2), 3)
    const cand = new Uint8Array(N)
    for (let p = 0; p < N; p++) if ((dark[p] && thick[p]) || pale[p]) cand[p] = 1
    // only what opens downwards (the gap between the legs reaches the
    // garment's lower edge; a dark pouch or a button inside the cloth not)
    const { comps } = components(cand)
    // and narrow: the gap is a slit, a pouch hanging between the legs is wide
    // (Tripo's white ground in the notch, with the dark round it, may be as
    // wide as the gap between the feet: white is never a pouch)
    const wideOf = c => { let a = S, b = 0; for (const p of c) { a = Math.min(a, p % S); b = Math.max(b, p % S) } return b - a }
    const narrow = c => wideOf(c) < (c.filter(p => pale[p]).length >= 0.4 * c.length ? 2 : 0.45) * half
    for (const c of comps.slice(1)) if (narrow(c) && c.some(p => p + S < N && (lab2[p + S] !== 2 || feet[p + S]) && !cand[p + S])) for (const p of c) crotch[p] = 1
    // Tripo's white ground in the notch at the crotch (the gap between the
    // trouser legs, painted where the template has the body) goes however
    // wide it is (white is never a pouch) when it reaches, within a few
    // pixels (past the trousers' own outline), the ground or the feet
    // below; with the grey of its soft edge. The trousers' dark outline
    // round it stays, as their edge.
    {
      const { comps: pc } = components(pale)
      const open = p => { for (let e = 1; e <= 8; e++) { const q = p + e * S; if (q >= N) return true; if (lab2[q] !== 2 || feet[q]) return true } return false }
      // (not on a white bottom: white shorts are that white at the hips too)
      const wh = p => lum(W, p * 3) > 215 && Math.max(W[p * 3], W[p * 3 + 1], W[p * 3 + 2]) - Math.min(W[p * 3], W[p * 3 + 1], W[p * 3 + 2]) < 30
      const whiteBottom = seedB.filter(wh).length > 0.25 * seedB.length
      if (!whiteBottom) for (const c of pc.slice(1)) if (c.some(open)) {
        for (const p of c) crotch[p] = 1
        const ring = dilate(c.reduce((m2, p) => { m2[p] = 1; return m2 }, new Uint8Array(N)), 1)
        for (let p = 0; p < N; p++) if (ring[p] && lab2[p] === 2 && lum(RGB2, p * 3) > 150 && Math.max(RGB2[p * 3], RGB2[p * 3 + 1], RGB2[p * 3 + 2]) - Math.min(RGB2[p * 3], RGB2[p * 3 + 1], RGB2[p * 3 + 2]) < 30) crotch[p] = 1
      }
      // (and the rest of that white in the notch, joined to it and still
      // white as drawn: what the top took of it, by its colour, a white
      // strap's, and what of the bottom was not taken for it: it stayed as
      // a white tick at the crotch. Not of a white top, a chef's jacket
      // hanging down there; nor what the soft edge drew in the trousers'
      // own colour, a shadow between the legs)
      const whiteTop = seedT.filter(wh).length > 0.25 * seedT.length
      const inZone = p => { const x = p % S, y = (p - x) / S; return Math.abs(x - cx) <= half && y >= footTop - 45 && y <= footTop + 6 }
      const st = []
      for (let p = 0; p < N; p++) if (crotch[p] && pale[p]) st.push(p)
      while (st.length) n4(st.pop(), q2 => {
        if (crotch[q2] || crotchT[q2] || !inZone(q2) || !wh(q2) || !(lum(RGB2, q2 * 3) > 200 && Math.max(RGB2[q2 * 3], RGB2[q2 * 3 + 1], RGB2[q2 * 3 + 2]) - Math.min(RGB2[q2 * 3], RGB2[q2 * 3 + 1], RGB2[q2 * 3 + 2]) < 40)) return
        if (lab2[q2] === 1 && !whiteTop) { crotchT[q2] = 1; st.push(q2) } else if (lab2[q2] === 2 && !whiteBottom) { crotch[q2] = 1; st.push(q2) }
      })
    }
  }
  // Thin bits where the template has no figure, left hanging once the feet
  // are cut out (the soft grey edge of a long trouser leg between the
  // robot's legs): gone. What is wide there stays (a coat's tails, wings).
  const thin = new Uint8Array(N)
  {
    const out = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (A[p] < 24 && (lab2[p] === 1 || (lab2[p] === 2 && !feet[p] && !crumbs[p] && !ownTail[p]))) out[p] = 1
    const wide = dilate(erode(out, 3), 4)
    for (let p = 0; p < N; p++) if (out[p] && !wide[p]) thin[p] = 1
  }
  // (sitting with its own tail beside a mermaid: no rim of the fin's colour
  // round the tail)
  const tailRim = sitTail ? dilate(ownTail, 3).map((v, p) => (v && !ownTail[p] ? 1 : 0)) : new Uint8Array(N)
  // Where the top meets the bottom, each picture's edge is soft once scaled
  // (to 384 px, and again in the app): over each other they let the pose
  // picture through as a thin line (the chick's golden outline across its
  // jacket). The bottom, drawn under the top, goes on 3 px under it, so the
  // top's soft edge lies on cloth
  const underTop = (() => {
    const near = distance(lab2.map(v => (v === 2 ? 1 : 0)), 3)
    return lab2.map((v, p) => (v === 1 && near[p] > 0 && near[p] <= 3 ? 1 : 0))
  })()
  const mk = (layer, rimFrom) => {
    const sel = lab.map(v => (v === layer ? 1 : 0))
    const out = { w: S, h: S, data: new Uint8ClampedArray(N * 4) }
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x
      let rgb, a
      if ((layer === 2 && (feet[p] || crumbs[p] || crotch[p] || nearFeetBits[p] || tailRim[p])) || crotchT[p] || finGone[p] || thin[p]) continue
      // on the figure's own arms and hands: what is in none of the outfit's
      // colours next to the figure's own part is Tripo's redrawn paw edge
      // (a doubled outline round a paw lying on a pyjama); on trousers
      // Tripo painted over the sitting legs a light stroke there is their
      // own shine or seam (the lederhose's stitching beside the robot's
      // boot), no outline: cut out, the leg under it showed as white streaks
      // (light, and unlike the pose picture there: a paw's edge redrawn in
      // the paw's own colour still goes)
      const shine = layer === 2 && legsDressed && lum(W, p * 3) > 110 && dist3(W, p * 3, T, p * 3) > 90
      if (own[p] && !inFront[p] && !legFill[p] && !legEdge[p] && !shine && nearOther[p] <= 3 && hT[q(p)] / nT + hB[q(p)] / nB < 0.004) continue
      if (layer === (sitTail ? 1 : 2) && ownTail[p]) {
        rgb = [T[p * 3], T[p * 3 + 1], T[p * 3 + 2]]; a = A[p] / 255
      } else if (inFront[p]) {
        // (the bottom carries them too: where they lay on it, another top
        // over it has no hole there, and the pose picture's own part shows,
        // not the bare belly)
        rgb = [T[p * 3], T[p * 3 + 1], T[p * 3 + 2]]; a = A[p] > 200 ? 1 : A[p] / 255
      } else if (lab2[p] === layer) { rgb = [RGB2[p * 3], RGB2[p * 3 + 1], RGB2[p * 3 + 2]]; a = AL2[p]; if (rimFrom && rimFrom[p]) rgb = rimFrom[p] }
      else if (layer === 2 && underTop[p]) { rgb = [RGB2[p * 3], RGB2[p * 3 + 1], RGB2[p * 3 + 2]]; a = AL2[p] }
      else if (other[p]) {
        // just outside towards a hand or the head: a faint fringe of the nearest colour inside
        const c = cov(sel, x, y) * 0.6
        if (c <= 0.02) continue
        let bq = -1
        for (let e = -1; e <= 1 && bq < 0; e++) for (let d = -1; d <= 1; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && sel[Y * S + X] && nearBg[Y * S + X] > 2) { bq = Y * S + X; break } }
        if (bq < 0) continue
        rgb = [RGB[bq * 3], RGB[bq * 3 + 1], RGB[bq * 3 + 2]]; a = c
      } else continue
      const o = p * 4
      out.data[o] = rgb[0]; out.data[o + 1] = rgb[1]; out.data[o + 2] = rgb[2]; out.data[o + 3] = Math.round(a * 255)
    }
    return out
  }
  // Where top and bottom meet (the hem over the waistband), each gets a thin
  // rim of its own outline colour, so either worn alone (or with another
  // thing) ends in a line, not in a cut: the bottom where the hem covered it,
  // the top's hem where it lay on the bottom. Worn together it is hidden or
  // the hem's own line.
  const outline = sel => {
    const px = []
    for (let p = 0; p < N; p++) if (sel[p] && nearBg[p] <= 1) px.push(p)
    if (!px.length) return null
    px.sort((u, v) => lum(RGB, u * 3) - lum(RGB, v * 3))
    const q2 = px[Math.floor(px.length * 0.1)]
    return [RGB[q2 * 3], RGB[q2 * 3 + 1], RGB[q2 * 3 + 2]]
  }
  let erase = null
  if (opts.erase) {
    // opaque where the pose picture stays, clear where it is cut away (soft by a pixel)
    erase = { w: S, h: S, data: new Uint8ClampedArray(N * 4) }
    const g2 = dilate(gone, 1)
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const p = y * S + x
      let c = 0
      if (g2[p]) { let n = 0; for (let e = -1; e <= 1; e++) for (let d = -1; d <= 1; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S) { c += gone[Y * S + X]; n++ } } c /= n }
      erase.data[p * 4] = erase.data[p * 4 + 1] = erase.data[p * 4 + 2] = 255; erase.data[p * 4 + 3] = Math.round(255 * (1 - c))
    }
  }
  // Top and bottom are always worn together (an outfit, lib/wardrobe/
  // outfit.js): where they meet no line is drawn (it ran as a dark jagged
  // line across a jacket where the split was not at its hem); only the
  // bottom cut away at the feet ends in its own outline colour
  const botRim = new Array(N)
  {
    const cutAway = feet.map((v, p) => (v && lab2[p] === 2 ? 1 : 0)), near = distance(cutAway, 2), dark = outline(isBot)
    // (on legs Tripo dressed only where the pose picture has an outline
    // there too: else the line ran across the leggings beside the hoof)
    if (dark) for (let p = 0; p < N; p++) if (lab2[p] === 2 && !feet[p] && near[p] > 0 && near[p] <= 2 && !(legsDressed && (legFill[p] || lum(T, p * 3) > 120))) botRim[p] = dark
  }
  const topPic = mk(1, null), botPic = mk(2, botRim)
  // Small holes left inside the clothes (a few pixels
  // of white cuff dropped as no colour of the shirt, so the arm's own
  // outline under them showed as a grey mark on the cuff): shut in by the
  // clothes all round, they are cloth as Tripo painted it, in the picture
  // that holds most of their rim
  {
    const solid = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (topPic.data[p * 4 + 3] > 100 || botPic.data[p * 4 + 3] > 100) solid[p] = 1
    const face1 = faceBox(opts.zones, opts.figure, opts.pose)
    for (const c of components(solid.map(v => 1 - v)).comps.slice(1)) {
      if (c.length > 150 || c.some(p => border(p) || bg[p] || face1[p] || inFront[p] || ownTail[p] || (erase && erase.data[p * 4 + 3] < 128))) continue
      const inC = new Set(c)
      let t = 0, b = 0
      for (const p of c) n4(p, q2 => { if (!inC.has(q2)) { if (topPic.data[q2 * 4 + 3] > 100) t++; else b++ } })
      const L = t >= b ? topPic : botPic
      for (const p of c) { L.data[p * 4] = W[p * 3]; L.data[p * 4 + 1] = W[p * 3 + 1]; L.data[p * 4 + 2] = W[p * 3 + 2]; L.data[p * 4 + 3] = 255 }
      // (and its soft rim, the clothes' edge towards it, whole)
      for (const p of c) { const x = p % S, y = (p - x) / S; for (let e = -2; e <= 2; e++) for (let d = -2; d <= 2; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const q2 = Y * S + X; if (L.data[q2 * 4 + 3] > 0) L.data[q2 * 4 + 3] = 255 } }
    }
  }
  // Small gaps beyond the figure's outline inside a light garment (the
  // robot's white fur collar reaching past its head: Tripo's fur as white
  // as its ground, so taken for the ground, and the dark ground showed
  // through as a mark on the collar): framed partly by the clothes, and in
  // Tripo's picture by light paint all round (no outline: a gap between an
  // arm and the body is framed by Tripo's dark outline and stays, so does
  // Tripo's ground between a bee's wing and a skirt), they
  // are cloth as Tripo painted it (the rest of their frame is the
  // figure's own edge, the head under the collar)
  {
    const solid = new Uint8Array(N), seen = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (topPic.data[p * 4 + 3] > 100 || botPic.data[p * 4 + 3] > 100) solid[p] = 1
    const poseA = p => A[p] * (erase ? erase.data[p * 4 + 3] / 255 : 1)
    const face1 = faceBox(opts.zones, opts.figure, opts.pose)
    const gap = solid.map((v, p) => (!v && poseA(p) <= 24 ? 1 : 0))
    for (const c of components(gap).comps.slice(1)) {
      if (c.length > 300 || c.some(p => border(p) || face1[p] || ownTail[p])) continue
      const inC = new Set(c)
      let t = 0, b = 0, o = 0, light = 0, rim = 0
      for (const p of c) n4(p, q2 => { if (inC.has(q2) || seen[q2]) return; seen[q2] = 1; rim++; if (lum(W, q2 * 3) > 200) light++; if (topPic.data[q2 * 4 + 3] > 100) t++; else if (botPic.data[q2 * 4 + 3] > 100) b++; else o++ })
      for (const p of c) n4(p, q2 => { seen[q2] = 0 })
      if (t + b < 0.25 * rim || light < 0.85 * rim) continue
      // (and no outline of Tripo's a few pixels further out either: the
      // edge of a wing or a skirt round a gap of its white ground)
      {
        const cm = new Uint8Array(N)
        for (const p of c) cm[p] = 1
        const ring = dilate(cm, 4)
        let dark = 0, nr = 0
        for (let p = 0; p < N; p++) if (ring[p] && !cm[p]) { nr++; if (lum(W, p * 3) < 140) dark++ }
        if (dark > 0.05 * nr) continue
      }
      const L = t >= b ? topPic : botPic
      // (with the figure's own edge in it and the clothes' soft rim round
      // it, where Tripo's paint there is as light: the fur goes on over them)
      const fill = new Set(c)
      for (const p of c) { const x = p % S, y = (p - x) / S; for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { const X = x + d, Y = y + e; if (X < 0 || Y < 0 || X >= S || Y >= S) continue; const q2 = Y * S + X; if (!face1[q2] && L.data[q2 * 4 + 3] < 255 && lum(W, q2 * 3) > 200) fill.add(q2) } }
      for (const p of fill) { L.data[p * 4] = W[p * 3]; L.data[p * 4 + 1] = W[p * 3 + 1]; L.data[p * 4 + 2] = W[p * 3 + 2]; L.data[p * 4 + 3] = 255 }
    }
  }
  // A mermaid's fin: Tripo's white ground left as a rim along a gap between
  // the fin and the body (a white U beside the dino's tail): white or pale
  // grey next to the cleared gap is ground, not cloth (the fin's own pale
  // inside is cyan)
  if (opts.erase) {
    const clear = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (botPic.data[p * 4 + 3] < 24) clear[p] = 1
    const nearClear = dilate(clear, 3), wh = new Uint8Array(N)
    for (let p = 0; p < N; p++) {
      const o = p * 4, d = botPic.data
      if (!ownTail[p] && d[o + 3] >= 24 && 0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2] > 185 && Math.max(d[o], d[o + 1], d[o + 2]) - Math.min(d[o], d[o + 1], d[o + 2]) < 30) wh[p] = 1
    }
    const goneW = new Uint8Array(N)
    // (the whitish parts touching the gap, and all of each such part)
    const lab3 = components(wh)
    for (const c of lab3.comps.slice(1)) if (c.length >= 15 && c.some(p => nearClear[p])) for (const p of c) goneW[p] = 1
    const soft = dilate(goneW, 1)
    for (let p = 0; p < N; p++) if (goneW[p]) botPic.data[p * 4 + 3] = 0
    else if (soft[p] && botPic.data[p * 4 + 3] && lum(botPic.data, p * 4) > 170) botPic.data[p * 4 + 3] >>= 1
    // (and the old tail under it, in the pose picture, is cut away with it:
    // no sliver of it shows there instead; the arms and hands stay)
    const wide = dilate(goneW, 3)
    for (let p = 0; p < N; p++) if (wide[p] && !arms[p] && !ownTail[p] && topPic.data[p * 4 + 3] < 100 && Math.floor(p / S) > P.neck.y * k) erase.data[p * 4 + 3] = 0
    // The same white ground caught in the top's picture, where the
    // jacket's hem reaches down beside that gap (a white sliver between the
    // dino's fin and its body): white parts of the top touching the gap
    // where the old body is cut away go, and the pose picture under them too
    const gap = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (erase.data[p * 4 + 3] < 128 && botPic.data[p * 4 + 3] < 24 && topPic.data[p * 4 + 3] < 24 && A[p] > 24) gap[p] = 1
    const nearGap = dilate(gap, 3), whT = new Uint8Array(N)
    for (let p = 0; p < N; p++) {
      const o = p * 4, d = topPic.data
      if (!ownTail[p] && Math.floor(p / S) > P.neck.y * k && d[o + 3] >= 24 && 0.3 * d[o] + 0.59 * d[o + 1] + 0.11 * d[o + 2] > 185 && Math.max(d[o], d[o + 1], d[o + 2]) - Math.min(d[o], d[o + 1], d[o + 2]) < 30) whT[p] = 1
    }
    const goneT = new Uint8Array(N)
    // (lying along the gap, mostly: not the jacket's white zip, which
    // only reaches it at the hem)
    for (const c of components(whT).comps.slice(1)) if (c.length >= 15 && c.filter(p => nearGap[p]).length > 0.5 * c.length) for (const p of c) goneT[p] = 1
    if (goneT.some(v => v)) {
      const softT = dilate(goneT, 1), wideT = dilate(goneT, 3)
      for (let p = 0; p < N; p++) if (goneT[p]) topPic.data[p * 4 + 3] = 0
      else if (softT[p] && topPic.data[p * 4 + 3] && lum(topPic.data, p * 4) > 170) topPic.data[p * 4 + 3] >>= 1
      for (let p = 0; p < N; p++) if (wideT[p] && !arms[p] && !ownTail[p] && topPic.data[p * 4 + 3] < 100 && botPic.data[p * 4 + 3] < 100) erase.data[p * 4 + 3] = 0
    }
    // (and thin lines left in that gap, a pixel or two wide: Tripo's
    // outline of the old body's edge beside the fin, with light specks of
    // its soft rim; the fin's own outline lies on the fin and stays)
    {
      const gap2 = new Uint8Array(N)
      for (let p = 0; p < N; p++) if (erase.data[p * 4 + 3] < 128 && botPic.data[p * 4 + 3] < 24 && topPic.data[p * 4 + 3] < 24 && A[p] > 24) gap2[p] = 1
      const nearGap2 = dilate(gap2, 2)
      for (const L of [botPic, topPic]) {
        const sol = new Uint8Array(N)
        for (let p = 0; p < N; p++) if (L.data[p * 4 + 3] > 24) sol[p] = 1
        const thick = dilate(erode(sol, 1), 1)
        for (let p = 0; p < N; p++) if (sol[p] && !thick[p] && nearGap2[p] && !ownTail[p] && !arms[p]) L.data[p * 4 + 3] = 0
      }
      // (nor specks of the old body at the gap's soft edge, in the pose
      // picture: the gap is cleared a pixel wider where no cloth lies)
      const wide2 = dilate(gap2, 1)
      for (let p = 0; p < N; p++) if (wide2[p] && !arms[p] && !ownTail[p] && topPic.data[p * 4 + 3] < 100 && botPic.data[p * 4 + 3] < 100 && Math.floor(p / S) > P.neck.y * k) erase.data[p * 4 + 3] = 0
    }
  }
  // Sitting, what of the bottom the feet (and the arms resting beside them)
  // cut off from the trousers is jagged bits round the feet (a patch on the
  // knee, a sliver of the hem): gone; the figure's own leg shows there (on
  // legs Tripo dressed only crumbs: a trouser leg cut off from the rest by
  // a hand resting on it is cloth as painted)
  if (opts.bottom && !opts.erase && P.feet) {
    const solid = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (botPic.data[p * 4 + 3] > 100 && !inFront[p]) solid[p] = 1
    const { comps } = components(solid)
    let big = 0
    for (let i = 1; i < comps.length; i++) if (!big || comps[i].length > comps[big].length) big = i
    const zone = dilate(feet, 16), gone = new Uint8Array(N)
    for (let i = 1; i < comps.length; i++) if (i !== big && comps[i].length < (legsDressed ? 300 : 2500) && comps[i].filter(p => zone[p]).length > 0.5 * comps[i].length) for (const p of comps[i]) gone[p] = 1
    const rim = dilate(gone, 2), keep = dilate(solid.map((v, p) => (v && !gone[p] ? 1 : 0)), 1)
    for (let p = 0; p < N; p++) if (!inFront[p] && (gone[p] || (rim[p] && !keep[p]))) botPic.data[p * 4 + 3] = 0
    // (and such bits the top took, under the arms resting on the legs: apart
    // from the top's cloth once the arms it carries are left out)
    const solidT = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (topPic.data[p * 4 + 3] > 100 && !inFront[p]) solidT[p] = 1
    const ct = components(solidT).comps
    let bigT = 0
    for (let i = 1; i < ct.length; i++) if (!bigT || ct[i].length > ct[bigT].length) bigT = i
    const goneT = new Uint8Array(N)
    for (let i = 1; i < ct.length; i++) if (i !== bigT && ct[i].length < 2500 && ct[i].filter(p => zone[p]).length > 0.5 * ct[i].length) for (const p of ct[i]) goneT[p] = 1
    // (the chick, its wings resting on its knees: close round the feet, what
    // is in the bottom's colours rather than the top's, or small bits in
    // none of the top's colours, a knee patch; on the robot the same test
    // cut holes into a hoodie above the boots, so it is the chick's only)
    const ring = SIT_BITS.includes(opts.figure) ? dilate(feet, 10) : new Uint8Array(N)
    const odd = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (solidT[p] && ring[p]) { const a = hT[q(p)] / nT, b = hB[q(p)] / nB; if (b > 0.002 && b > 2 * a) goneT[p] = 1; else if (!(a > 0.003 && a > b)) odd[p] = 1 }
    for (const c of components(odd).comps.slice(1)) if (c.length < 300) for (const p of c) goneT[p] = 1
    const rimT = dilate(goneT, 2), keepT = dilate(solidT.map((v, p) => (v && !goneT[p] ? 1 : 0)), 1)
    for (let p = 0; p < N; p++) if (!inFront[p] && (goneT[p] || (rimT[p] && !keepT[p]))) topPic.data[p * 4 + 3] = 0
  }
  // A skirt that lies on the lap (LAP_SKIRT), sitting: Tripo spread it wide
  // round the legs, and the flaps standing out beyond them read as stray
  // shapes at the app's size. What of it lies further than a short flare
  // (FLARE px) beyond the figure's lap and legs (the figure's outline
  // closed over the notch between its feet, without the tail beside them)
  // goes, softly; the cut edge is closed in the skirt's own outline colour,
  // so it ends in a hem, not in a cut
  if (opts.lapSkirt && opts.bottom && !opts.erase && P.feet) {
    const FLARE = 8, CLOSE = 24, RIM = 4, R = FLARE + 2, LEFT = opts.lapSkirt.left
    const sc = pl => pl.map(([x, y]) => [x * k, y * k])
    const feetP = polygons(P.feet.map(sc)), tailP = polygons((P.tail ?? []).map(sc))
    const lap = erode(dilate(A.map((a, p) => (a > 24 && !(tailP[p] && !feetP[p]) ? 1 : 0)), CLOSE), CLOSE), closed = lap.slice()
    // (with the space between the feet, down to their soles: the skirt's
    // front hanging between the legs is on the lap)
    const each = P.feet.map(pl => polygons([sc(pl)]))
    const between = y => each.map(m => { let lo = S, hi = -1; for (let x = 0; x < S; x++) if (m[y * S + x]) { lo = Math.min(lo, x); hi = x } return [lo, hi] }).filter(([, hi]) => hi >= 0)
    for (let y = 0; y < S; y++) {
      const xs = between(y)
      if (xs.length < 2) continue
      for (let x = Math.min(...xs.map(r => r[0])); x <= Math.max(...xs.map(r => r[1])); x++) lap[y * S + x] = 1
    }
    // (below the top of the feet, less a little: the lap, not the arms)
    let y0 = 0
    for (let p = 0; p < N; p++) if (feetP[p]) { y0 = Math.max(0, Math.floor(p / S) - 20); break }
    const D = botPic.data, cutM = new Uint8Array(N), D0 = D.filter((_, i) => (i & 3) === 3)
    for (let p = y0 * S; p < N; p++) {
      if (!D[p * 4 + 3] || lap[p] || inFront[p]) continue
      const x = p % S, y = (p - x) / S
      let best = R + 1
      for (let e = -R; e <= R; e++) for (let d = -R; d <= R; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && lap[Y * S + X]) best = Math.min(best, Math.hypot(d, e)) }
      if (best > FLARE + 0.5) { cutM[p] = 1; D[p * 4 + 3] = 0 } else if (best > FLARE - 0.5) D[p * 4 + 3] *= FLARE + 0.5 - best
    }
    // (and the thin spikes the cut leaves where it runs close along the
    // flap's own edge: the hem ends smooth)
    {
      const kept = new Uint8Array(N)
      for (let p = 0; p < N; p++) if (D[p * 4 + 3] > 24 && !inFront[p]) kept[p] = 1
      const opened = dilate(erode(kept, 6), 6), nearCut = dilate(cutM, 10)
      for (let p = 0; p < N; p++) if (D[p * 4 + 3] && !inFront[p] && !opened[p] && nearCut[p]) { cutM[p] = 1; D[p * 4 + 3] = 0 }
    }
    // (`left`: the flap left of the feet's middle, below the cut's top,
    // cut again. The left foot's loose outline reaches out beyond the
    // unicorn's hoof, and the flap cut along it ended square, with a notch
    // where it met the skirt's top. Here the space between the feet starts
    // at the left foot's inner side, so the flap is a band of `flare` px
    // round the hoof itself (which the opening above would take whole);
    // then the skirt over the figure, the jacket and the figure together are
    // closed (`close` px: the notch filled with Tripo's skirt again) and
    // opened (`round` px: no corner), and the flap beyond the figure keeps
    // what lies in that, softly: its hem runs in one curve round the hoof)
    if (LEFT) {
      let sx = 0, n = 0
      for (let p = 0; p < N; p++) if (feetP[p]) { sx += p % S; n++ }
      const mid = sx / n, lapL = closed.slice(), F = LEFT.flare, RL = F + 2, r = LEFT.round, TD = topPic.data
      for (let y = 0; y < S; y++) {
        const xs = between(y)
        if (xs.length < 2) continue
        for (let x = xs.reduce((u, v) => (v[0] < u[0] ? v : u))[1]; x <= Math.max(...xs.map(r2 => r2[1])); x++) lapL[y * S + x] = 1
      }
      const mine = p => p >= y0 * S && p % S < mid && D0[p] && !inFront[p]
      for (let p = 0; p < N; p++) {
        if (!mine(p)) continue
        const x = p % S, y = (p - x) / S
        let best = 0
        if (!lapL[p]) {
          best = RL + 1
          for (let e = -RL; e <= RL; e++) for (let d = -RL; d <= RL; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && lapL[Y * S + X]) best = Math.min(best, Math.hypot(d, e)) }
        }
        const a = Math.max(0, Math.min(1, F + 0.5 - best))
        D[p * 4 + 3] = D0[p] * a; cutM[p] = a < 0.5 ? 1 : 0
      }
      let solid = new Uint8Array(N)
      for (let p = 0; p < N; p++) if ((D[p * 4 + 3] > 24 && !inFront[p]) || A[p] > 24 || TD[p * 4 + 3] > 24) solid[p] = 1
      // (closing also shuts the crack where the skirt's cut-out round the
      // hoof meets the hoof's soft edge)
      solid = erode(dilate(solid, LEFT.close), LEFT.close)
      const core = not(dilate(not(solid), r)), zone = dilate(cutM, r + LEFT.close)
      for (let p = 0; p < N; p++) {
        if (!zone[p] || !mine(p) || A[p] > 24) continue
        const x = p % S, y = (p - x) / S
        let best = r + 2
        for (let e = -r - 1; e <= r + 1; e++) for (let d = -r - 1; d <= r + 1; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && core[Y * S + X]) best = Math.min(best, Math.hypot(d, e)) }
        const o = Math.max(0, Math.min(1, r + 0.5 - best))
        D[p * 4 + 3] = D0[p] * o; cutM[p] = o < 0.5 ? 1 : 0
      }
    }
    // (`underFoot`: under that foot (0 left, 1 right), Tripo's own boot
    // drawn a little larger than the pose picture's stayed as light blue
    // and dark jagged bits beside the foot's outline (the robot's right
    // boot): close round the foot's lower half, what of the skirt there is
    // no skirt colour (pink or its white) goes where the figure lies under
    // it (the pose picture's boot shows), and so do the faint remnants
    // beside it)
    if (opts.lapSkirt.underFoot !== undefined) {
      const foot = each.map(m => { let sx = 0, n = 0; for (let p = 0; p < N; p++) if (m[p]) { sx += p % S; n++ } return { m, x: sx / n } }).sort((u, v) => u.x - v.x)[opts.lapSkirt.underFoot]
      const own = and(feet, dilate(foot.m, 12)), ring = and(dilate(own, 10), not(own))
      let sy = 0, n = 0
      for (let p = 0; p < N; p++) if (own[p]) { sy += Math.floor(p / S); n++ }
      const cy = sy / n
      for (let p = Math.ceil(cy) * S; p < N; p++) {
        if (!ring[p] || !D[p * 4 + 3] || inFront[p]) continue
        const r0 = D[p * 4] / 255, g0 = D[p * 4 + 1] / 255, b0 = D[p * 4 + 2] / 255, mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), l = (mx + mn) / 2
        const sat = mx === mn ? 0 : (mx - mn) / (l > 0.5 ? 2 - mx - mn : mx + mn)
        const pink = r0 === mx && r0 > b0 && sat > 0.15 && l > 0.35, pale = sat <= 0.15 && l > 0.75
        if (pink || pale) continue
        if (A[p] > 128 || D[p * 4 + 3] < 160) D[p * 4 + 3] = 0
      }
    }
    const dark = outline(isBot)
    if (dark && cutM.some(v => v)) {
      const near = dilate(cutM, RIM + 1)
      for (let p = 0; p < N; p++) {
        if (!near[p] || cutM[p] || !D[p * 4 + 3] || inFront[p]) continue
        const x = p % S, y = (p - x) / S
        let dc = RIM + 2
        for (let e = -RIM - 1; e <= RIM + 1; e++) for (let d = -RIM - 1; d <= RIM + 1; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && cutM[Y * S + X]) dc = Math.min(dc, Math.hypot(d, e)) }
        const w = Math.max(0, Math.min(1, RIM + 0.5 - dc))
        for (let ch = 0; ch < 3; ch++) D[p * 4 + ch] = D[p * 4 + ch] * (1 - w) + dark[ch] * w
      }
    }
    // (what the cuts left as faint specks beside the flaps and the feet;
    // below LAP_Y only, so the waistband above stays exactly as it was)
    dropBits(D, new Uint8Array(N).fill(1, Math.max(y0, LAP_Y) * S), 40)
  }
  // Leggings Tripo painted pale sitting (BRIGHT_LEGS: the unicorn's
  // rainbow leggings round its hooves, nearly white on the thighs beside
  // the bright band between the legs, blotchy where they met): they are
  // painted again in the stripes of the standing poses (RAINBOW), even,
  // across the leggings as they run from the middle between the legs round
  // each hoof (pink in the middle, then yellow, green, blue, purple and
  // pink again, as they run down a standing leg), shaded softly like the
  // figure's own legs; then a clean outline in their own outline
  // colour where nothing lies beyond them. The top's colour (a hoodie's
  // lavender) on them and the hands stay
  if (opts.brightLegs && opts.bottom && !opts.erase && P.feet) {
    const D = botPic.data, TD = topPic.data
    const feetP = polygons(P.feet.map(pl => pl.map(([x, y]) => [x * k, y * k]))), zone = dilate(feetP, 24)
    // (what the pose picture lends the bottom there that is no hand resting
    // on the lap is the leg itself: the white of the thigh by the hoof)
    const hands = dilate(polygons((P.wings ?? []).map(pl => pl.map(([x, y]) => [x * k, y * k]))), 6).map((v, p) => (v && inFront[p] ? 1 : 0))
    let fy = 0
    for (let p = 0; p < N; p++) if (feetP[p]) { fy = Math.floor(p / S); break }
    const hsl = (R0, G0, B0) => {
      const r = R0 / 255, g = G0 / 255, b = B0 / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2
      if (mx === mn) return [0, 0, l]
      const dd = mx - mn, s = l > 0.5 ? dd / (2 - mx - mn) : dd / (mx + mn)
      const h = mx === r ? (g - b) / dd + (g < b ? 6 : 0) : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4
      return [h * 60, s, l]
    }
    const hslAt = p => hsl(D[p * 4], D[p * 4 + 1], D[p * 4 + 2])
    // (the thin bits of Tripo's white highlight the top took on the thigh's
    // top, a broken line over the leggings: the leggings')
    const moved = new Uint8Array(N)
    {
      const solid = new Uint8Array(N)
      for (let p = 0; p < N; p++) if (TD[p * 4 + 3] > 24 && !hands[p]) solid[p] = 1
      const opened = dilate(erode(solid, 2), 2)
      for (let p = (fy - 12) * S; p < N; p++) {
        if (!zone[p] || !solid[p] || opened[p] || hands[p]) continue
        if (TD[p * 4 + 3] >= D[p * 4 + 3]) for (let ch = 0; ch < 4; ch++) D[p * 4 + ch] = TD[p * 4 + ch]
        TD[p * 4 + 3] = 0; moved[p] = 1
      }
    }
    // the hooves: the two largest pieces cut out of the bottom for the feet
    // there; the leggings round them and between them
    const hooves = components(feet.map((v, p) => (v && zone[p] ? 1 : 0))).comps.slice(1).sort((u, v) => v.length - u.length).slice(0, 2)
      .map(c => { let lo = S, hi = 0; for (const p of c) { const x = p % S; lo = Math.min(lo, x); hi = Math.max(hi, x) } return { lo, hi } }).sort((u, v) => u.lo - v.lo)
    const mid = (hooves[0].hi + hooves[1].lo) / 2, legs = zone.slice()
    for (let p = fy * S; p < N; p++) { const x = p % S; if (x > hooves[0].lo && x < hooves[1].hi) legs[p] = 1 }
    // (the cloth: not the top's lavender, not a hand; of it the outline)
    const cloth = new Uint8Array(N), darkPx = new Uint8Array(N)
    for (let p = 0; p < N; p++) {
      if (!legs[p] || !D[p * 4 + 3] || hands[p]) continue
      const [h, s, l] = hslAt(p)
      if (!moved[p] && h >= 250 && h <= 320 && s > 0.15 && l < 0.85) continue
      cloth[p] = 1
      if (!moved[p] && l < 0.45 && D[p * 4 + 3] > 100) darkPx[p] = 1
    }
    // (how far each pixel lies from the middle, through the cloth: 8
    // neighbours, Dijkstra in buckets of a tenth of a pixel)
    const far = new Float32Array(N).fill(Infinity), Q = []
    const reach = (p, d) => { if (d < far[p]) { far[p] = d; (Q[Math.round(d * 10)] ??= []).push(p) } }
    for (let y = 0; y < S; y++) { const p = y * S + Math.round(mid); if (cloth[p]) reach(p, Math.abs(Math.round(mid) - mid)) }
    const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]]
    for (let b = 0; b < Q.length; b++) for (const p of Q[b] ?? []) {
      if (Math.round(far[p] * 10) !== b) continue
      const x = p % S, y = (p - x) / S
      for (const [dx, dy, w] of NB) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < S && Y < S && cloth[Y * S + X]) reach(Y * S + X, far[p] + w) }
    }
    // (stripes of STRIPE px along that, in the order of the standing
    // poses (ORDER: pink in the middle, then yellow, green, blue, purple and
    // pink again), blended over a pixel and a half at each change)
    const STRIPE = 14, ORDER = [0, 1, 2, 3, 4]
    const band = i => RAINBOW[ORDER[((i % ORDER.length) + ORDER.length) % ORDER.length]]
    const mix = (c0, c1, m) => c0.map((v, ch) => v * (1 - m) + c1[ch] * m)
    const stripe = u => {
      const f = u / STRIPE + 0.5, i = Math.floor(f), t = (f - i) * STRIPE
      if (t > STRIPE - 0.75) return mix(band(i), band(i + 1), (t - (STRIPE - 0.75)) / 1.5)
      if (t < 0.75) return mix(band(i), band(i - 1), (0.75 - t) / 1.5)
      return band(i)
    }
    // (the shading, gently, as the figure's own legs have it: (1) the
    // pose picture's (T) lightness of the legs under them, its light,
    // unsaturated pixels over 7 × 7 against their median (SH.k: soft grey
    // in the folds and towards the outline); (2) across each leg from top
    // to bottom (where a pixel lies between the cloth's upper and lower
    // edge, above and below it): a soft highlight on the upper part (up to
    // SH.hi towards white, round SH.hv), darker towards the lower edge (by
    // SH.lo) and a little right under the hoodie (SH.top); (3) darker
    // within SH.edge px of the ground beyond them (by SH.ed) and round the
    // hooves' cut, the cuff's fold (SH.fold px, by SH.fd); all of it
    // softened over 5 × 5)
    const SH = { k: 1, hi: 0.2, hv: 0.3, lo: 0.15, top: 0.06, edge: 6, ed: 0.1, fold: 5, fd: 0.07 }
    const tl = new Float32Array(N), tok = new Uint8Array(N)
    for (let p = 0; p < N; p++) {
      if (A[p] < 200) continue
      const r = T[p * 3], g = T[p * 3 + 1], b = T[p * 3 + 2], l = lum(T, p * 3)
      if (l > 150 && Math.max(r, g, b) - Math.min(r, g, b) < 50) { tok[p] = 1; tl[p] = l }
    }
    const paintable = p => cloth[p] && !darkPx[p] && far[p] !== Infinity
    const st = new Float32Array(N), sts = []
    for (let p = 0; p < N; p++) {
      if (!paintable(p)) continue
      const x = p % S, y = (p - x) / S
      let sum = 0, c = 0
      for (let e = -3; e <= 3; e++) for (let d = -3; d <= 3; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && tok[Y * S + X]) { sum += tl[Y * S + X]; c++ } }
      if (c) { st[p] = sum / c; sts.push(st[p]) }
    }
    sts.sort((u, v) => u - v)
    const ref = sts[sts.length >> 1] || 1
    const ground = new Uint8Array(N), cuffM = new Uint8Array(N)
    for (let p = 0; p < N; p++) { if (D[p * 4 + 3] < 24 && A[p] < 24 && TD[p * 4 + 3] < 24) ground[p] = 1; if (feet[p] && D[p * 4 + 3] < 24) cuffM[p] = 1 }
    const dG = distance(ground, SH.edge + 1), dH = distance(cuffM, SH.fold + 1)
    const ramp = (d, w) => Math.max(0, Math.min(1, (w - d) / (w - 1)))
    const sstep = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t) }
    const mul = new Float32Array(N), add = new Float32Array(N)
    for (let x = 0; x < S; x++) for (let y = 0; y < S; y++) {
      const p = y * S + x
      if (!paintable(p) || (y > 0 && paintable(p - S))) continue
      let y1 = y
      while (y1 + 1 < S && paintable((y1 + 1) * S + x)) y1++
      const len = y1 - y + 1
      for (let yy = y; yy <= y1; yy++) {
        const q = yy * S + x, v = len < 3 ? 0.5 : (yy - y + 0.5) / len, w = Math.min(1, len / 10)
        const t = st[q] ? st[q] / ref : 1
        mul[q] = (1 + SH.k * (t - 1)) * (1 - w * SH.lo * sstep(0.5, 1, v)) * (1 - w * SH.top * (1 - sstep(0, 0.15, v)))
          * (1 - SH.ed * ramp(dG[q], SH.edge)) * (1 - SH.fd * ramp(dH[q], SH.fold))
        add[q] = w * SH.hi * Math.exp(-(((v - SH.hv) / 0.16) ** 2))
      }
    }
    const paint = new Float32Array(N * 3)
    for (let p = 0; p < N; p++) {
      if (!paintable(p)) continue
      const x = p % S, y = (p - x) / S
      let m = 0, a = 0, c = 0
      for (let e = -2; e <= 2; e++) for (let d = -2; d <= 2; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && paintable(Y * S + X)) { m += mul[Y * S + X]; a += add[Y * S + X]; c++ } }
      m /= c; a /= c
      const col = stripe(far[p])
      for (let ch = 0; ch < 3; ch++) { const v = col[ch] * m; paint[p * 3 + ch] = Math.max(0, Math.min(255, v + (255 - v) * a)) }
    }
    for (let p = 0; p < N; p++) if (cloth[p] && !darkPx[p] && far[p] !== Infinity) for (let ch = 0; ch < 3; ch++) D[p * 4 + ch] = paint[p * 3 + ch]
    // (specks of them apart from them, a pixel or two beside the thigh)
    dropBits(D, legs, 40)
    // (the outline: where nothing lies beyond them, not the hoof, not the
    // top, the leggings' edge is drawn again OW px wide in their outline
    // colour (the median of their dark pixels there); first over the
    // figure's own lighter rim just beyond them, that showed under the
    // outline as a smear)
    const OW = 2.5, RR = 4, out = new Uint8Array(N)
    for (let p = 0; p < N; p++) if (D[p * 4 + 3] < 24 && A[p] < 128 && TD[p * 4 + 3] < 24) out[p] = 1
    const inks = [], nearOut3 = dilate(out, 3)
    for (let p = 0; p < N; p++) if (darkPx[p] && nearOut3[p] && D[p * 4 + 3] > 200) inks.push(p)
    if (inks.length) {
      inks.sort((u, v) => lum(D, u * 4) - lum(D, v * 4))
      const q0 = inks[inks.length >> 1], ink = [D[q0 * 4], D[q0 * 4 + 1], D[q0 * 4 + 2]]
      const solidL = new Uint8Array(N), bare = new Uint8Array(N)
      for (let p = 0; p < N; p++) { if (cloth[p] && D[p * 4 + 3] > 200) solidL[p] = 1; if (A[p] < 24) bare[p] = 1 }
      const nearL = dilate(solidL, 4), nearBare = dilate(bare, 3), hoof = dilate(feet.map((v, p) => (v && D[p * 4 + 3] < 24 ? 1 : 0)), 1)
      for (let p = 0; p < N; p++) {
        if (!legs[p] || !nearL[p] || !nearBare[p] || A[p] <= 24 || D[p * 4 + 3] >= 200 || TD[p * 4 + 3] >= 24 || hoof[p] || hands[p]) continue
        const a = Math.max(D[p * 4 + 3], A[p])
        for (let ch = 0; ch < 3; ch++) D[p * 4 + ch] = ink[ch]
        D[p * 4 + 3] = a; cloth[p] = 1
      }
      out.fill(0)
      for (let p = 0; p < N; p++) if (D[p * 4 + 3] < 24 && A[p] < 24 && TD[p * 4 + 3] < 24) out[p] = 1
      const nearOut = dilate(out, RR)
      for (let p = 0; p < N; p++) {
        if (!cloth[p] || !nearOut[p] || !D[p * 4 + 3]) continue
        const x = p % S, y = (p - x) / S
        let best = RR + 1
        for (let e = -RR; e <= RR; e++) for (let d = -RR; d <= RR; d++) { const X = x + d, Y = y + e; if (X >= 0 && Y >= 0 && X < S && Y < S && out[Y * S + X]) best = Math.min(best, Math.hypot(d, e)) }
        const w = Math.max(0, Math.min(1, OW + 0.5 - best))
        for (let ch = 0; ch < 3; ch++) D[p * 4 + ch] = D[p * 4 + ch] * (1 - w) + ink[ch] * w
      }
    }
  }
  // (on legs Tripo dressed, the trousers seen between the feet and the
  // hands lie on the feet's loose polygons and are cloth, not the feet)
  const ownParts = dilate(polygons([...(P.wings ?? []), ...(P.ownWings ?? []), ...(P.tail ?? []), ...(legsDressed ? [] : P.feet ?? [])].map(pl => pl.map(([x, y]) => [x * k, y * k]))), 4)
  dropStray(topPic, botPic, faceBox(opts.zones, opts.figure, opts.pose), ownParts, P.neck.y * k - 6)
  return { erase, top: topPic, bottom: botPic, masks: { gone, bg, changed, m, isTop, isBot, seedT, seedB, prob: prob0, extra: inFront.map((v, p) => v | feet[p] | ownTail[p]) } }
}

// The last check on the written pictures, exactly as the app shows them
// (scaled to 512, alpha over 100, top and bottom together): pieces apart
// from the garment smaller than SPECK px (a speck left between two pixels
// that the scaling separated) are cleared in both pictures, with a 2 px
// rim, and the pictures written again (twice at most).
const SPECK = 1000
async function cleanPair(files) {
  for (let round = 0; round < 2; round++) {
    const pics = []
    for (const f of files) pics.push(await decode(f, [S, S]))
    const U = new Uint8Array(N)
    for (const p of pics) for (let i = 0; i < N; i++) if (p.data[i * 4 + 3] > 100) U[i] = 1
    const { comps } = components(U)
    let big = 0
    for (let i = 1; i < comps.length; i++) if (!big || comps[i].length > comps[big].length) big = i
    const gone = new Uint8Array(N)
    let n = 0
    for (let i = 1; i < comps.length; i++) if (i !== big && comps[i].length < SPECK) { n++; for (const p of comps[i]) gone[p] = 1 }
    if (!n) return round
    const rim = dilate(gone, 2), keep = dilate(U.map((v, p) => (v && !gone[p] ? 1 : 0)), 1)
    for (const [j, p] of pics.entries()) {
      for (let i = 0; i < N; i++) if (gone[i] || (rim[i] && !keep[i])) p.data[i * 4 + 3] = 0
      await encode(p, files[j], OUT.kb, OUT)
    }
  }
  return 2
}

// ── the command ──
async function main() {
  const args = process.argv.slice(2)
  const di = args.indexOf('--debug')
  const debug = di >= 0 ? args.splice(di, 2)[1] : null
  // --clean: only the last check, on the pictures already written for the
  // outfits of a figure (src/lib/wardrobe/outfit.js)
  if (args[1] === '--clean') {
    const OUTFIT = (await import(pathToFileURL(join(ROOT, 'src/lib/wardrobe/outfit.js')).href)).default
    const browser = await chromium.launch()
    page = await browser.newPage()
    const dir = join(ROOT, 'public/sprites/wardrobe/worn', args[0])
    let fixed = 0
    for (const o of OUTFIT) for (const pose of POSE_ORDER) {
      const r = await cleanPair([o.top, o.bottom].filter(Boolean).map(id => join(dir, `${id}-${pose}.webp`)))
      if (r) { fixed++; console.log('cleaned', o.top, pose) }
    }
    await browser.close()
    console.log(args[0], 'pictures cleaned:', fixed)
    return
  }
  const usage = 'node scripts/art/worn-from-sheet.mjs <figure> <top> [<bottom>] <sheet.png> | <figure> --all <dir> [--debug <dir>] | <figure> --clean'
  const figure = args[0]
  // the sheets: one, or every <figure>-<top>[-<bottom>].png in a folder
  let jobs
  if (args[1] === '--all') {
    jobs = readdirSync(args[2]).filter(f => f.startsWith(figure + '-') && f.endsWith('.png')).sort()
      .map(f => { const [top, bottom = null] = f.slice(figure.length + 1, -4).split('-'); return { top, bottom, file: join(args[2], f) } })
  } else if (args.length === 4) jobs = [{ top: args[1], bottom: args[2] === '-' ? null : args[2], file: args[3] }]
  else if (args.length === 3) jobs = [{ top: args[1], bottom: null, file: args[2] }]
  if (!figure || !jobs?.length) { console.error(usage); process.exit(1) }
  const chick = figure === 'chick'
  const W8 = await import(pathToFileURL(join(ROOT, 'src/lib/wardrobe.js')).href)
  for (const j of jobs) for (const [id, slot] of [[j.top, 'top'], [j.bottom, 'bottom']]) if (id && W8.PART_BY_ID[id]?.part !== slot) throw new Error(`${id} is no ${slot} of an outfit in the wardrobe`)
  const POSES = chick ? W8.POSES : (await import(pathToFileURL(join(ROOT, `src/lib/shapes/${figure}-poses.js`)).href)).default
  const basePic = pose => join(ROOT, 'public/sprites', chick ? `emoji/custom/lumi-${pose}.webp` : `shapes/${figure}-${pose}.webp`)
  const outDir = join(ROOT, 'public/sprites/wardrobe/worn', figure)
  const ZONES = JSON.parse(readFileSync(join(ROOT, 'tests/unit/face-zones.json'), 'utf8')).zones
  mkdirSync(outDir, { recursive: true })
  const browser = await chromium.launch()
  page = await browser.newPage()
  // the figure's own pose pictures, on white (T) and their coverage (A)
  const bases = {}
  for (const pose of POSE_ORDER) {
    const base = await decode(basePic(pose), [S, S])
    const T = new Float32Array(N * 3), A = new Uint8Array(N)
    for (let p = 0; p < N; p++) {
      const a = base.data[p * 4 + 3] / 255; A[p] = base.data[p * 4 + 3]
      for (let ch = 0; ch < 3; ch++) T[p * 3 + ch] = base.data[p * 4 + ch] * a + 255 * (1 - a)
    }
    bases[pose] = { T, A }
  }
  const done = []
  for (const job of jobs) {
    const sheet = await decode(job.file)
    if (Math.abs(sheet.w / sheet.h - 2) > 0.01) throw new Error(`${job.file} is ${sheet.w} × ${sheet.h}, not 2 : 1`)
    const name = [figure, job.top, job.bottom].filter(Boolean).join('-')
    const dbg = debug && join(debug, name)
    if (dbg) mkdirSync(dbg, { recursive: true })
    const report = []
    const tail = !!(job.bottom && W8.PART_BY_ID[job.bottom].feet === false)
    for (let i = 0; i < POSE_ORDER.length; i++) {
      const pose = POSE_ORDER[i], P = POSES[pose], { T, A } = bases[pose]
      const sample = sampler(sheet, i)
      const reg = register(T, A, sample, P)
      const W = new Float32Array(N * 3)
      for (let p = 0; p < N; p++) { const x = p % S, y = (p - x) / S; sample(256 + reg.s * (x - 256) + reg.dx, 256 + reg.s * (y - 256) + reg.dy, W, p * 3) }
      const lap = LAP_SKIRT[figure]?.[job.bottom]
      const cut = cutPose(T, A, W, P, {
        bottom: !!job.bottom, erase: tail, figure, pose, zones: ZONES,
        lapSkirt: lap, brightLegs: !!BRIGHT_LEGS[figure]?.includes(job.bottom),
      })
      const kb = []
      for (const [id, img] of [[job.top, cut.top], [job.bottom, cut.bottom]]) if (id) kb.push(Math.round(await encode(img, join(outDir, `${id}-${pose}.webp`), OUT.kb, id === job.bottom && P.feet && lap?.q ? { ...OUT, q0: lap.q, qMin: lap.q } : OUT) / 1024))
      if (tail) kb.push(Math.round(await encode(cut.erase, join(outDir, `${job.bottom}-${pose}-mask.webp`), OUT.kb, OUT) / 1024))
      await cleanPair([job.top, job.bottom].filter(Boolean).map(id => join(outDir, `${id}-${pose}.webp`)))
      const count = mm => mm.reduce((a, b) => a + b, 0)
      report.push({ pose, s: reg.s, dx: reg.dx, dy: reg.dy, cost: reg.cost, before: reg.before, top: count(cut.masks.isTop), bottom: count(cut.masks.isBot), kb: kb.join('+') })
      if (dbg) await debugPictures(dbg, pose, T, A, W, cut)
    }
    console.log(name); console.table(report)
    done.push(job.top); if (job.bottom) done.push(job.bottom)
  }
  await browser.close()
  // the list the fit file reads
  const listFile = join(ROOT, chick ? 'src/lib/wardrobe/chick-worn.js' : `src/lib/shapes/${figure}-worn.js`)
  let ids = []
  if (existsSync(listFile)) ids = [...readFileSync(listFile, 'utf8').matchAll(/^\s*'([^']+)',$/gm)].map(x => x[1])
  ids = [...new Set([...ids, ...done])].sort()
  writeFileSync(listFile, `// Things ${chick ? 'the chick' : `the ${figure}`} wears as painted on it by Tripo: drawn from\n// public/sprites/wardrobe/worn/${figure}/<id>-<pose>.webp over the pose picture\n// (\`worn\`, see wornFit in ../wardrobe.js). Written by\n// scripts/art/worn-from-sheet.mjs; one line per thing.\nexport default [\n${ids.map(id => `  '${id}',`).join('\n')}\n]\n`)
  console.log('wrote', outDir, 'and', listFile)
}

// zoomed pictures of the steps, on a coloured ground (halos show)
async function debugPictures(dir, pose, T, A, W, cut) {
  const { bg, changed, m, isTop, isBot } = cut.masks
  const img = { w: S * 3, h: S, data: new Uint8ClampedArray(N * 3 * 4) }
  const put = (panel, p, rgb) => { const x = p % S, y = (p - x) / S, o = (y * S * 3 + panel * S + x) * 4; img.data[o] = rgb[0]; img.data[o + 1] = rgb[1]; img.data[o + 2] = rgb[2]; img.data[o + 3] = 255 }
  const ground = [120, 70, 160]
  for (let p = 0; p < N; p++) {
    const g = lum(T, p * 3) * 0.7
    put(0, p, isTop[p] ? [255, g * 0.5, g * 0.5] : isBot[p] ? [g * 0.5, g * 0.5, 255] : changed[p] ? [255, 255, 0] : bg[p] ? [40, 40, 40] : [g, g, g])
    // the base with the cut clothes over it, on a coloured ground
    const a0 = A[p] / 255, a1 = a0 * (cut.erase ? cut.erase.data[p * 4 + 3] / 255 : 1)
    let c = a0 > 0 ? [0, 1, 2].map(ch => (T[p * 3 + ch] - 255 * (1 - a0)) / Math.max(a0, 1e-3) * a1 + ground[ch] * (1 - a1)) : ground
    for (const L of [cut.bottom, cut.top]) { const a = L.data[p * 4 + 3] / 255; if (a) c = c.map((v, ch) => L.data[p * 4 + ch] * a + v * (1 - a)) }
    put(1, p, c)
    // the clothes alone on dark
    let d = [30, 30, 30]
    for (const L of [cut.bottom, cut.top]) { const a = L.data[p * 4 + 3] / 255; if (a) d = d.map((v, ch) => L.data[p * 4 + ch] * a + v * (1 - a)) }
    put(2, p, d)
  }
  void m
  await encode(img, join(dir, `${pose}.png`))
  // zoomed twice: Tripo's picture beside the cut clothes on the pose picture
  const x0 = 60, y0 = 170, cw = 400, ch = 330, Z = 2
  const z = { w: cw * Z * 2 + 8, h: ch * Z, data: new Uint8ClampedArray((cw * Z * 2 + 8) * ch * Z * 4).fill(255) }
  for (let y = 0; y < ch * Z; y++) for (let x = 0; x < cw * Z; x++) {
    const p = (y0 + Math.floor(y / Z)) * S + x0 + Math.floor(x / Z)
    const o1 = (y * z.w + x) * 4, o2 = (y * z.w + x + cw * Z + 8) * 4
    z.data[o1] = W[p * 3]; z.data[o1 + 1] = W[p * 3 + 1]; z.data[o1 + 2] = W[p * 3 + 2]
    const px = p % S, py = (p - px) / S, so = (py * S * 3 + S + px) * 4
    z.data[o2] = img.data[so]; z.data[o2 + 1] = img.data[so + 1]; z.data[o2 + 2] = img.data[so + 2]
  }
  await encode(z, join(dir, `${pose}-zoom.png`))
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main()
