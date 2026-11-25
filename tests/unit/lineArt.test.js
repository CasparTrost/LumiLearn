import { describe, it, expect } from 'vitest'
import { toColoringPage, traceLines, sheetSize, components, joinEnds, thin, evenLight, looksLikeLineArt } from '../../src/games/coloring/lineArt.js'

// ── synthetic pictures ──────────────────────────────────────────────────────
const W = 600, H = 800

function sheet(w = W, h = H, paper = () => 245) {
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = paper(x, y), p = (y * w + x) * 4
    px[p] = v; px[p + 1] = v; px[p + 2] = Math.max(0, v - 6); px[p + 3] = 255
  }
  return px
}
const put = (px, w, x, y, rgb) => {
  if (x < 0 || y < 0 || x >= w || y * w * 4 >= px.length) return
  const p = (y * w + x) * 4
  px[p] = rgb[0]; px[p + 1] = rgb[1]; px[p + 2] = rgb[2]
}
// a ring of radius r and thickness t, with a gap of `gap` pixels at the right
function ring(px, w, cx, cy, r, t, gap = 0, rgb = [30, 30, 30]) {
  for (let y = cy - r - t; y <= cy + r + t; y++) for (let x = cx - r - t; x <= cx + r + t; x++) {
    const d = Math.hypot(x - cx, y - cy)
    if (Math.abs(d - r) > t / 2) continue
    if (gap && x > cx && Math.abs(y - cy) < gap / 2) continue
    put(px, w, x, y, rgb)
  }
}
function disc(px, w, cx, cy, r, rgb) {
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) put(px, w, x, y, rgb)
}
function rect(px, w, x0, y0, x1, y1, rgb) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) put(px, w, x, y, rgb)
}

// the game's paint bucket: 4-connected over what is not line
const area = (res, x, y) => components(res.lines, res.w, res.h, 0, 4).labels[y * res.w + x]
const inkAt = (res, x, y) => res.lines[y * res.w + x] === 1

describe('sheetSize', () => {
  it('fits upright pictures into 1000 × 1500 and wide ones into 1500 × 1000', () => {
    expect(sheetSize(3000, 4000)).toEqual({ w: 1000, h: 1333 })
    expect(sheetSize(4032, 3024)).toEqual({ w: 1333, h: 1000 })
    expect(sheetSize(200, 300)).toEqual({ w: 1000, h: 1500 })      // small pictures grow
  })
})

describe('line art', () => {
  it('a closed shape stays closed, the line stays whole', () => {
    const px = sheet(); ring(px, W, 300, 400, 150, 6)
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(res.ok).toBe(true)
    expect(area(res, 300, 400)).not.toBe(area(res, 20, 20))
    // the line is there all the way round
    for (let a = 0; a < 360; a += 5) {
      const x = Math.round(300 + 150 * Math.cos(a * Math.PI / 180)), y = Math.round(400 + 150 * Math.sin(a * Math.PI / 180))
      expect(inkAt(res, x, y)).toBe(true)
    }
  })

  for (const gap of [4, 10, 18, 26]) {
    it(`a gap of ${gap} pixels is closed: the paint doesn't leak out`, () => {
      const px = sheet(); ring(px, W, 300, 400, 150, 5, gap)
      const res = toColoringPage(px, W, H)
      expect(res.ok).toBe(true)
      expect(area(res, 300, 400)).not.toBe(area(res, 20, 20))
      expect(area(res, 300, 400)).not.toBe(area(res, 550, 400))
    })
  }

  it('a gap is closed in a pencil line too (light grey, thin)', () => {
    const px = sheet(); ring(px, W, 300, 400, 160, 3, 14, [150, 150, 150])
    const res = toColoringPage(px, W, H)
    expect(area(res, 300, 400)).not.toBe(area(res, 20, 20))
  })

  it('a roof that stops just beside the wall\'s corner still closes (a sharp corner is joined)', () => {
    const px = sheet()
    const seg = (x0, y0, x1, y1) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)); for (let s = 0; s <= n; s++) disc(px, W, Math.round(x0 + (x1 - x0) * s / n), Math.round(y0 + (y1 - y0) * s / n), 2, [40, 40, 40]) }
    seg(150, 400, 450, 400); seg(450, 400, 450, 700); seg(450, 700, 150, 700); seg(150, 700, 150, 400)   // the walls
    seg(300, 200, 132, 390); seg(300, 200, 468, 390)                                                  // the roof, ending beside the corners
    const res = toColoringPage(px, W, H)
    expect(area(res, 300, 330)).not.toBe(area(res, 20, 20))      // the roof is its own area
    expect(area(res, 300, 550)).not.toBe(area(res, 300, 330))    // and not one with the house
  })

  it('two shapes side by side are not joined into one', () => {
    const px = sheet(); ring(px, W, 160, 400, 100, 6); ring(px, W, 440, 400, 100, 6)
    const res = toColoringPage(px, W, H)
    expect(area(res, 160, 400)).not.toBe(area(res, 440, 400))
    // the outside between them stays one area with the rest of the page
    expect(area(res, 300, 400)).toBe(area(res, 20, 20))
  })

  it('specks are gone', () => {
    const px = sheet(); ring(px, W, 300, 400, 120, 6)
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const dots = []
    for (let i = 0; i < 120; i++) {
      const x = Math.floor(20 + rnd() * 560), y = Math.floor(20 + rnd() * 760)
      if (Math.hypot(x - 300, y - 400) < 160) continue
      disc(px, W, x, y, 1 + Math.floor(rnd() * 2), [40, 40, 40]); dots.push([x, y])
    }
    const res = toColoringPage(px, W, H)
    expect(dots.length).toBeGreaterThan(40)
    for (const [x, y] of dots) expect(inkAt(res, x, y)).toBe(false)
  })

  it('a lighting gradient does not turn half the page black', () => {
    // from bright paper on the left to a deep shadow on the right
    const px = sheet(W, H, (x, y) => 250 - 140 * (x / W) - 30 * (y / H))
    ring(px, W, 300, 400, 150, 6, 0, [20, 20, 20])
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(res.inkShare).toBeLessThan(0.06)
    expect(area(res, 300, 400)).not.toBe(area(res, 20, 20))
    expect(area(res, 580, 780)).toBe(area(res, 20, 20))
  })

  it('a coloured-in felt-pen area becomes its outline, the yellow line counts too', () => {
    const px = sheet(); disc(px, W, 300, 300, 110, [230, 40, 40]); ring(px, W, 300, 620, 110, 6, 0, [250, 210, 30])
    const res = toColoringPage(px, W, H)
    expect(inkAt(res, 300, 300)).toBe(false)                     // hollow
    expect(area(res, 300, 300)).not.toBe(area(res, 20, 20))
    expect(area(res, 300, 620)).not.toBe(area(res, 20, 20))      // the yellow ring holds
  })

  it('the dark table around the paper goes, the drawing stays', () => {
    const px = sheet(W, H, (x, y) => (x < 40 || y > H - 50 ? 60 : 240))
    ring(px, W, 320, 380, 140, 6)
    const res = toColoringPage(px, W, H)
    expect(inkAt(res, 10, 400)).toBe(false)
    expect(inkAt(res, 300, 790)).toBe(false)
    expect(area(res, 320, 380)).not.toBe(area(res, 300, 20))
  })

  it('fewer lines drops what more lines keeps', () => {
    const px = sheet(); ring(px, W, 300, 400, 150, 6); ring(px, W, 300, 400, 60, 3, 0, [165, 165, 165])
    const few = traceLines(px, W, H, 0), many = traceLines(px, W, H, 2)
    expect(inkAt(many, 360, 400)).toBe(true)
    expect(inkAt(few, 360, 400)).toBe(false)
  })

  it('a blank page is refused kindly instead of shown', () => {
    const res = toColoringPage(sheet(), W, H)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('empty')
  })

  it('tiny areas are filled, so every area can be hit with a finger', () => {
    const px = sheet(); ring(px, W, 300, 400, 150, 6); ring(px, W, 300, 400, 8, 3)
    const res = toColoringPage(px, W, H)
    expect(inkAt(res, 300, 400)).toBe(true)
  })
})

describe('joining line ends', () => {
  it('joins an end to the line it points at, not to itself', () => {
    const w = 120, h = 80, m = new Uint8Array(w * h)
    for (let x = 10; x < 60; x++) m[40 * w + x] = 1                 // a line ending at x 59
    for (let y = 10; y < 70; y++) m[y * w + 75] = 1                 // a wall 16 px further
    const links = joinEnds(thin(m, w, h).map((v, i) => v || m[i]), w, h, 24)
    expect(links[40 * w + 67]).toBe(1)
    // no link backwards along the line itself
    let back = 0
    for (let y = 0; y < h; y++) for (let x = 0; x < 58; x++) if (links[y * w + x] && y !== 40) back++
    expect(back).toBe(0)
  })
})

describe('photos and cartoons', () => {
  function cartoon() {
    let seed = 3
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const px = sheet(W, H, (x, y) => 120 + 80 * (y / H))           // a sky-ish ground
    for (let i = 0; i < px.length; i += 4) { px[i] = 90; px[i + 1] = 150 + 60 * ((i / 4 / W) / H); px[i + 2] = 230 }
    rect(px, W, 0, 560, W, H, [70, 160, 60])                       // grass
    disc(px, W, 450, 140, 70, [250, 210, 40])                      // sun
    rect(px, W, 120, 330, 320, 560, [200, 60, 50])                 // house
    rect(px, W, 190, 430, 250, 560, [110, 70, 40])                 // door
    for (let i = 0; i < px.length; i += 4) {                       // photo noise
      const n = (rnd() - 0.5) * 40
      px[i] += n; px[i + 1] += n; px[i + 2] += n
    }
    return px
  }

  it('become a few closed shapes, not a thousand specks', () => {
    const res = toColoringPage(cartoon(), W, H)
    expect(res.kind).toBe('photo')
    expect(res.ok).toBe(true)
    expect(res.regions).toBeGreaterThanOrEqual(4)
    expect(res.regions).toBeLessThan(15)
    const sky = area(res, 40, 40), sun = area(res, 450, 140), house = area(res, 150, 380), door = area(res, 220, 500), grass = area(res, 500, 700)
    expect(new Set([sky, sun, house, door, grass]).size).toBe(5)
  })

  it('a colour photo is not taken for line art, a page with lines is', () => {
    const px = cartoon()
    expect(looksLikeLineArt(evenLight(px, W, H), px)).toBe(false)
    const page = sheet(); ring(page, W, 300, 400, 150, 6)
    expect(looksLikeLineArt(evenLight(page, W, H), page)).toBe(true)
  })
})
