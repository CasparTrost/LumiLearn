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

describe('what kind of picture', () => {
  it('a bold line stays one line (hollowed out it was two, with a strip between)', () => {
    const px = sheet(); ring(px, W, 300, 400, 150, 22); rect(px, W, 60, 700, 540, 720, [20, 20, 20])
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(inkAt(res, 450, 400)).toBe(true)                      // the middle of the stroke
    expect(inkAt(res, 300, 710)).toBe(true)
    expect(res.regions).toBe(2)                                  // inside the ring, and the rest
  })

  it('white lines on a dark ground are a drawing like any other', () => {
    const px = sheet(W, H, () => 22); ring(px, W, 300, 400, 150, 5, 0, [240, 240, 240])
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(res.ok).toBe(true)
    expect(res.regions).toBe(2)
    expect(area(res, 300, 400)).not.toBe(area(res, 20, 20))
  })

  it('a sheet on a brown table, at an angle: the table and the sheet\'s edge are gone, the drawing stays', () => {
    const px = sheet(W, H, () => 0)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      // the table, with a grain; the sheet, turned a little and darker towards one corner
      const u = (x - 300) * 0.97 + (y - 400) * 0.24, v = -(x - 300) * 0.24 + (y - 400) * 0.97
      const on = Math.abs(u) < 210 && Math.abs(v) < 300
      put(px, W, x, y, on ? [235 - 40 * (x / W), 232 - 40 * (x / W), 222 - 40 * (x / W)] : [92 + (y % 9 === 0 ? -18 : 0), 60, 34])
    }
    ring(px, W, 300, 380, 110, 4, 0, [70, 70, 80])               // a pencil circle
    ring(px, W, 265, 350, 9, 3, 0, [70, 70, 80]); ring(px, W, 335, 350, 9, 3, 0, [70, 70, 80])   // two eyes
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(res.ok).toBe(true)
    expect(area(res, 300, 420)).not.toBe(area(res, 300, 200))    // the circle is closed
    expect(area(res, 8, 8)).toBe(area(res, 300, 200))            // table and paper: one white ground, no frame
    expect(area(res, 590, 790)).toBe(area(res, 300, 200))
    expect(inkAt(res, 265, 350) || inkAt(res, 265, 341)).toBe(true)   // the eyes are there
    expect(res.regions).toBeLessThan(5)
  })

  it('a felt-pen picture with coloured-in areas: roof and wall are two areas, the window drawn on the wall is one', () => {
    const px = sheet(W, H, () => 248)
    rect(px, W, 150, 380, 450, 640, [250, 214, 70])              // the wall, yellow
    for (let y = 250; y < 380; y++) rect(px, W, Math.round(300 - (y - 250) * 1.3), y, Math.round(300 + (y - 250) * 1.3), y + 1, [222, 70, 70])   // the roof, red
    // a window: a blue line on the yellow wall
    rect(px, W, 200, 430, 290, 438, [40, 80, 200]); rect(px, W, 200, 512, 290, 520, [40, 80, 200])
    rect(px, W, 200, 430, 208, 520, [40, 80, 200]); rect(px, W, 282, 430, 290, 520, [40, 80, 200])
    // a stick: a purple line on the paper, and the ground, a green line that runs off the paper
    rect(px, W, 520, 500, 528, 640, [130, 60, 190]); rect(px, W, 0, 640, W, 650, [60, 160, 70])
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('mixed')
    expect(res.ok).toBe(true)
    const paper = area(res, 60, 100), roof = area(res, 300, 330), wall = area(res, 400, 580), win = area(res, 245, 475)
    expect(new Set([paper, roof, wall, win]).size).toBe(4)
    expect(inkAt(res, 524, 570)).toBe(true)                      // the stick is a line
    expect(area(res, 60, 720)).not.toBe(paper)                   // the ground line parts above from below
  })

  it('a head in front of a grainy gradient: the background is one area, the head has one outline', () => {
    let seed = 11
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const px = sheet()
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) put(px, W, x, y, [196 - 60 * (y / H), 206 - 60 * (y / H), 216 - 56 * (y / H)])
    disc(px, W, 300, 400, 170, [92, 54, 28])                     // dark hair
    disc(px, W, 300, 440, 120, [232, 186, 150])                  // the face
    disc(px, W, 255, 420, 20, [250, 250, 250]); disc(px, W, 345, 420, 20, [250, 250, 250])   // the eyes
    for (let pass = 0; pass < 2; pass++) {                       // a photo is never sharp
      const src = px.slice()
      for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sum += src[((y + dy) * W + x + dx) * 4 + c]
        px[(y * W + x) * 4 + c] = sum / 25
      }
    }
    for (let i = 0; i < px.length; i += 4) { const n = (rnd() - 0.5) * 34; px[i] += n; px[i + 1] += n; px[i + 2] += n }
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('photo')
    expect(area(res, 30, 30)).toBe(area(res, 30, 770))           // no seam across the background
    expect(area(res, 570, 400)).toBe(area(res, 30, 30))
    const hair = area(res, 300, 260), face = area(res, 300, 500)
    expect(new Set([area(res, 30, 30), hair, face]).size).toBe(3)
    expect(area(res, 255, 420)).not.toBe(face)                   // both eyes are there
    expect(area(res, 345, 420)).not.toBe(face)
    expect(res.regions).toBeLessThan(9)                          // no strip along the hair
  })
})

describe('paper and light', () => {
  it('the pale blue squares of an exercise book are not drawn; with more lines they are', () => {
    const px = sheet(W, H, () => 250)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (x % 30 < 3 || y % 30 < 3) put(px, W, x, y, [186, 208, 236])
    ring(px, W, 300, 400, 150, 5, 0, [70, 70, 78])
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(res.regions).toBe(2)
    expect(inkAt(res, 301, 15)).toBe(false)                      // on a grid line, away from the drawing
    expect(inkAt(res, 15, 601)).toBe(false)
    expect(toColoringPage(px, W, H, 2).regions).toBeGreaterThan(20)
  })

  it('a drawing in a pale blue crayon is a drawing, not a ruling', () => {
    const px = sheet(W, H, () => 250)
    ring(px, W, 300, 400, 150, 6, 0, [176, 208, 240]); ring(px, W, 300, 400, 40, 6, 0, [176, 208, 240])
    const res = toColoringPage(px, W, H)
    expect(res.ok).toBe(true)
    expect(res.regions).toBe(3)
  })

  it('a red and an orange shape that overlap stay two areas', () => {
    const px = sheet(W, H, () => 250)
    disc(px, W, 230, 400, 140, [224, 62, 62]); rect(px, W, 260, 290, 520, 520, [232, 98, 56])
    const res = toColoringPage(px, W, H)
    expect(area(res, 150, 400)).not.toBe(area(res, 450, 400))
    expect(area(res, 150, 400)).not.toBe(area(res, 20, 20))
  })

  it('a very light pencil is drawn whole at the normal setting', () => {
    const px = sheet(W, H, () => 250)
    ring(px, W, 220, 300, 120, 4, 0, [208, 208, 210]); ring(px, W, 420, 560, 90, 4, 0, [212, 212, 214])
    const res = toColoringPage(px, W, H)
    expect(res.ok).toBe(true)
    expect(res.regions).toBe(3)
    expect(area(res, 220, 300)).not.toBe(area(res, 20, 20))
    expect(area(res, 420, 560)).not.toBe(area(res, 20, 20))
  })

  it('a blank page with a grain stays blank (it is not made darker until the grain shows)', () => {
    let seed = 5
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const res = toColoringPage(sheet(W, H, () => 244 + rnd() * 10), W, H)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('empty')
  })

  it('the soft shadow of a hand across the page is no shape; the line under it stays', () => {
    const px = sheet(W, H, () => 244)
    ring(px, W, 300, 400, 150, 5, 0, [60, 60, 66])
    // a shadow like a finger: half the light in its middle, fading out over 45 pixels
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const u = (x - 430) * 0.8 + (y - 470) * 0.6, v = -(x - 430) * 0.6 + (y - 470) * 0.8
      const d = Math.hypot(u / 2.6, v) - 28                      // outside the finger's core
      const k = d <= 0 ? 0.5 : d >= 45 ? 1 : 0.5 + 0.5 * (d / 45)
      const p = (y * W + x) * 4
      px[p] *= k; px[p + 1] *= k; px[p + 2] *= k
    }
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(res.regions).toBe(2)                                  // inside the ring and outside: no third shape
    expect(area(res, 300, 400)).not.toBe(area(res, 20, 20))      // the ring is whole under the shadow
    expect(inkAt(res, 520, 560)).toBe(false)                     // in the shadow, off the ring
  })

  it('a coloured-in dress in stripes is an area to paint, not a black shape', () => {
    const px = sheet(W, H, () => 250)
    for (let y = 250; y < 600; y++) {
      const half = Math.round((y - 250) * 0.45), stripe = Math.floor((y - 250) / 16) % 2
      rect(px, W, 300 - half, y, 300 + half, y + 1, stripe ? [255, 105, 180] : [255, 150, 205])
    }
    ring(px, W, 300, 190, 55, 5, 0, [25, 25, 25])                // a head, black
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('mixed')
    expect(res.inkShare).toBeLessThan(0.08)
    expect(inkAt(res, 300, 498)).toBe(false)                     // inside the dress, in the middle of a stripe
    expect(area(res, 300, 498)).not.toBe(area(res, 20, 20))
    expect(area(res, 300, 190)).not.toBe(area(res, 20, 20))      // the head
  })

  it('a sun\'s ray near the edge is not drawn on to the edge; a horizon that stops short of it is', () => {
    const px = sheet(W, H, () => 250)
    rect(px, W, 520, 100, 570, 105, [30, 30, 30])                // a short ray, 30 pixels from the right edge
    rect(px, W, 0, 500, 575, 505, [30, 30, 30])                  // a horizon that stops 25 pixels short
    const res = toColoringPage(px, W, H)
    expect(inkAt(res, 590, 102)).toBe(false)
    expect(inkAt(res, 590, 502)).toBe(true)
    expect(area(res, 300, 300)).not.toBe(area(res, 300, 700))
  })
})

describe('what is not the drawing', () => {
  it('highlighter strokes beside a pen drawing are not drawn round; with more lines they are', () => {
    const px = sheet(W, H, () => 250)
    ring(px, W, 300, 330, 150, 5, 0, [25, 25, 25])
    rect(px, W, 120, 318, 480, 346, [255, 246, 165])             // one stroke across the ring
    rect(px, W, 150, 640, 450, 668, [255, 246, 165])             // one below it
    ring(px, W, 300, 330, 150, 5, 0, [25, 25, 25])               // (the pen lies over the highlighter)
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('lines')
    expect(res.regions).toBe(2)                                  // inside the ring and outside
    expect(area(res, 300, 654)).toBe(area(res, 20, 20))          // the lower stroke is no box
    expect(area(res, 300, 332)).toBe(area(res, 300, 250))        // the ring is not cut in two
    for (let x = 160; x < 440; x += 20) expect(inkAt(res, x, 640)).toBe(false)
    const more = toColoringPage(px, W, H, 2)
    expect(area(more, 300, 654)).not.toBe(area(more, 20, 20))
  })

  it('a phone\'s shadow over the corner of a coloured-in drawing on a table leaves no line in the sky', () => {
    const px = sheet(W, H, () => 0)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const on = x >= 50 && x < 550 && y >= 60 && y < 740
      put(px, W, x, y, on ? [246, 245, 240] : [118 + (y % 9 === 0 ? -20 : 0), 78, 44])
    }
    disc(px, W, 420, 250, 60, [250, 205, 40])                    // a sun, coloured in
    ring(px, W, 420, 250, 60, 5, 0, [25, 25, 25])
    rect(px, W, 220, 480, 400, 640, [60, 120, 220])              // a blue house
    for (const [x0, y0, x1, y1] of [[216, 476, 404, 482], [216, 638, 404, 644], [216, 476, 222, 644], [398, 476, 404, 644]]) rect(px, W, x0, y0, x1, y1, [25, 25, 25])
    // the shadow: from the top left corner, over table and sheet, fading out over 60 pixels
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 60, y - 70) - 150
      const k = d <= 0 ? 0.45 : d >= 60 ? 1 : 0.45 + 0.55 * (d / 60)
      const p = (y * W + x) * 4
      px[p] *= k; px[p + 1] *= k; px[p + 2] *= k
    }
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('mixed')
    // nothing drawn where only the shadow is: along its rim and inside it
    let ink = 0
    for (let y = 70; y < 330; y++) for (let x = 60; x < 330; x++) if (inkAt(res, x, y)) ink++
    expect(ink).toBe(0)
    expect(area(res, 100, 110)).toBe(area(res, 300, 700))        // one white ground, table and shadow included
    expect(area(res, 420, 250)).not.toBe(area(res, 300, 700))    // the sun
    expect(area(res, 310, 560)).not.toBe(area(res, 300, 700))    // the house
  })
})

describe('a shadow over the drawing itself', () => {
  it('a shadow across table and sheet does not take the house under it away', () => {
    const px = sheet(W, H, () => 0)
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const on = x >= 50 && x < 550 && y >= 60 && y < 740
      put(px, W, x, y, on ? [246, 245, 240] : [118 + (y % 9 === 0 ? -20 : 0), 78, 44])
    }
    disc(px, W, 150, 200, 60, [250, 205, 40])                    // a sun, coloured in
    ring(px, W, 150, 200, 60, 5, 0, [25, 25, 25])
    rect(px, W, 300, 480, 480, 640, [250, 235, 150])             // a yellow house near the lower right corner
    for (const [x0, y0, x1, y1] of [[296, 476, 484, 482], [296, 638, 484, 644], [296, 476, 302, 644], [478, 476, 484, 644]]) rect(px, W, x0, y0, x1, y1, [25, 25, 25])
    // the shadow: from the lower right corner, over table, sheet and half the house
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - 560, y - 740) - 190
      const k = d <= 0 ? 0.45 : d >= 60 ? 1 : 0.45 + 0.55 * (d / 60)
      const p = (y * W + x) * 4
      px[p] *= k; px[p + 1] *= k; px[p + 2] *= k
    }
    const res = toColoringPage(px, W, H)
    expect(res.kind).toBe('mixed')
    expect(area(res, 340, 520)).not.toBe(area(res, 300, 300))    // the house is an area of its own
    for (let y = 500; y < 630; y += 10) expect(inkAt(res, 299, y) || inkAt(res, 297, y) || inkAt(res, 301, y)).toBe(true)   // its left wall
    let wall = 0
    for (let y = 500; y < 630; y++) if ([478, 480, 482].some(x => inkAt(res, x, y))) wall++
    expect(wall).toBeGreaterThan(60)                             // most of its right wall, under the shadow
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

  it('a dark tree in front of a meadow of nearly its colour is a shape of its own, the sky\'s gradient is one', () => {
    // a landscape with many colours: the few colours the page is made of
    // are used up by sky, sun and house, and tree and meadow are one "green"
    let seed = 7
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
    const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * Math.min(1, Math.max(0, t)))
    const w = 800, h = 600
    const px = sheet(w, h)
    const horizon = x => 345 - 45 * Math.sin((x / w) * Math.PI * 1.6)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      put(px, w, x, y, y < horizon(x)
        ? mix([120, 180, 240], [210, 230, 220], y / h)             // the sky, deep to pale
        : mix([111, 176, 96], [61, 122, 58], (y - 310) / 290))     // the meadow, light to dark
    }
    disc(px, w, 655, 105, 55, [255, 220, 80])                      // the sun
    rect(px, w, 260, 260, 450, 430, [214, 160, 110])               // the house
    for (let y = 165; y < 260; y++) rect(px, w, Math.round(355 - (y - 165) * 1.2), y, Math.round(355 + (y - 165) * 1.2), y + 1, [170, 60, 50])
    rect(px, w, 330, 340, 380, 430, [110, 70, 40])
    rect(px, w, 280, 290, 320, 330, [170, 215, 240]); rect(px, w, 395, 290, 435, 330, [170, 215, 240])
    rect(px, w, 565, 320, 590, 450, [105, 70, 40])                 // the trunk
    // the crown: lit from the upper left, dark below, standing on the horizon
    for (let y = 210; y <= 350; y++) for (let x = 510; x <= 650; x++) {
      if (Math.hypot(x - 580, y - 280) <= 70) put(px, w, x, y, mix([80, 150, 82], [36, 98, 46], (Math.hypot(x - 560, y - 260) - 15) / 65))
    }
    // a photo is never sharp: soften it (5 × 5, twice)
    for (let pass = 0; pass < 2; pass++) {
      const src = px.slice()
      for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) sum += src[((y + dy) * w + x + dx) * 4 + c]
        px[(y * w + x) * 4 + c] = sum / 25
      }
    }
    for (let i = 0; i < px.length; i += 4) { const n = (rnd() - 0.5) * 30; px[i] += n; px[i + 1] += n; px[i + 2] += n }
    // with fewer lines there are five colours at most: one green for certain
    const res = toColoringPage(px, w, h, 0)
    expect(res.kind).toBe('photo')
    expect(res.ok).toBe(true)
    const crown = area(res, 580, 270), meadow = area(res, 150, 520), sky = area(res, 150, 60)
    expect(new Set([crown, meadow, sky]).size).toBe(3)
    expect(area(res, 730, 250)).toBe(sky)                          // the sky: one area, no band across it
    expect(area(res, 700, 460)).toBe(meadow)
    expect(res.regions).toBeLessThan(14)
  })

  it('a colour photo is not taken for line art, a page with lines is', () => {
    const px = cartoon()
    expect(looksLikeLineArt(evenLight(px, W, H), px)).toBe(false)
    const page = sheet(); ring(page, W, 300, 400, 150, 6)
    expect(looksLikeLineArt(evenLight(page, W, H), page)).toBe(true)
  })
})
