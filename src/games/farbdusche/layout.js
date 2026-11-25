/**
 * Where everything stands in the paint shower, for three shapes of screen:
 * `wide` (a tablet held sideways), `tall` (a phone held upright) and `flat`
 * (a phone held sideways). The game draws on a canvas in design units that
 * is scaled to the play area (`s`), so a tap is never smaller than a
 * finger; the canvas keeps the scale and stretches the other side.
 *
 * All rects are { x, y, … } in canvas units. The machine is drawn in a
 * 240 × 400 box (parts.jsx); `u` is one of its units.
 */
export const MACHINE_RATIO = 400 / 240
const TAP_RATIO = 1.1 // a tap is a little taller than wide

// Taps in a grid; an incomplete last row is centred
function tapGrid(n, cols, t, gap, x0, y0) {
  const rows = Math.ceil(n / cols)
  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols), col = i % cols
    const inRow = row === rows - 1 ? n - row * cols : cols
    const shift = ((cols - inRow) * (t + gap)) / 2
    return { x: x0 + shift + col * (t + gap), y: y0 + row * (t * TAP_RATIO + gap), size: t }
  })
}

function wide(cw, ch, n, total, line) {
  const slot = Math.min(88, 700 / total)
  const shelf = { x: cw / 2 - (total * slot) / 2, y: 4, slot, cols: total, rows: 1, pad: 16 }
  const top = shelf.y + slot + shelf.pad + 8
  const mh = Math.min(ch - top - 6, 580), mw = mh / MACHINE_RATIO, u = mw / 240
  const mx = cw / 2 - mw / 2 - 10
  const machine = { x: mx, y: top, w: mw, h: mh }
  const drain = { size: 76, x: mx + 30 * u - 72, y: top + 119 * u - 38 }
  const lever = { size: 132, x: mx + mw - 10, y: top + 155 * u - 96 }
  const bubble = { x: mx + mw - 16, y: top + 198 * u, w: 204, h: 190 }
  const t = n <= 3 ? 128 : 110, cols = n <= 3 ? 1 : 2, gap = 12
  const gridW = cols * t + (cols - 1) * gap, rows = Math.ceil(n / cols)
  const gridH = rows * t * TAP_RATIO + (rows - 1) * gap
  const taps = tapGrid(n, cols, t, gap, Math.max(8, drain.x - 18 - gridW), top + (ch - top - gridH) / 2)
  const floorY = top + 380 * u
  const qx = Math.min(bubble.x + bubble.w + 26, cw - 112)
  const queue = line ? { size: 104, x: qx, y: top + 388 * u - 104 } : null
  const queueBubble = line ? { x: qx - 6, y: queue.y - 106, w: 114, h: 100, tail: 'down' } : null
  return { shelf, machine, drain, lever, bubble, taps, queue, queueBubble, floorY }
}

function tall(cw, ch, n, total, line) {
  const rows = total <= 6 ? 1 : 2, perRow = Math.ceil(total / rows)
  const slot = Math.min(68, (cw - 36) / perRow)
  const shelf = { x: cw / 2 - (perRow * slot) / 2, y: 4, slot, cols: perRow, rows, pad: 12 }
  const top = shelf.y + rows * (slot + shelf.pad) + 8
  const gap = n <= 3 ? 14 : 6, t = Math.min(n <= 3 ? 92 : 80, (cw - 12 - (n - 1) * gap) / n)
  const tapsY = ch - t * TAP_RATIO - 10
  const taps = tapGrid(n, n, t, gap, (cw - (n * t + (n - 1) * gap)) / 2, tapsY)
  const bottom = tapsY - 10
  const room = bottom - top - (line ? 98 : 0)
  const mw = Math.min(cw * 0.55, room / MACHINE_RATIO), mh = mw * MACHINE_RATIO, u = mw / 240
  const mx = Math.max(46, (cw - mw - 136) / 2 + 20)
  const my = top + Math.max(0, room - mh) * 0.5
  const machine = { x: mx, y: my, w: mw, h: mh }
  const drain = { size: 70, x: mx + 30 * u - 67, y: my + 119 * u - 35 }
  const lever = { size: 112, x: mx + mw - 12, y: my + 155 * u - 82 }
  const bx = mx + mw - 20
  const bubble = { x: bx, y: my + 198 * u, w: Math.min(156, cw - 6 - bx), h: 150 }
  const queue = line ? { size: 86, x: cw - 100, y: my + mh + 6 } : null
  const queueBubble = line ? { x: queue.x - 98, y: queue.y, w: 94, h: 84, tail: 'right' } : null
  return { shelf, machine, drain, lever, bubble, taps, queue, queueBubble, floorY: my + 380 * u }
}

function flat(cw, ch, n, total, line) {
  const rows = Math.ceil(total / 2), pad = 11
  const slot = Math.min(74, (ch - 10) / rows - pad)
  const shelf = { x: cw - 2 * slot - 16, y: 4, slot, cols: 2, rows, pad }
  const cols = n <= 3 ? 1 : 2, tRows = Math.ceil(n / cols), gap = 6
  const t = Math.min(86, (ch - 12 - (tRows - 1) * gap) / tRows / TAP_RATIO)
  const gridW = cols * t + (cols - 1) * gap, gridH = tRows * t * TAP_RATIO + (tRows - 1) * gap
  const taps = tapGrid(n, cols, t, gap, 10, (ch - gridH) / 2)
  const mh = ch - 8, mw = mh / MACHINE_RATIO, u = mw / 240
  // drain, machine, bubble and the one waiting stand between taps and rack
  const left = 10 + gridW + 8, right = shelf.x - 10
  const need = 72 + mw - 30 * u + 136 + (line ? 84 : 0)
  const x0 = left + Math.max(0, right - left - need) / 2
  const mx = x0 + 69 - 30 * u, my = 4
  const machine = { x: mx, y: my, w: mw, h: mh }
  const drain = { size: 72, x: x0, y: my + 119 * u - 36 }
  const lever = { size: 98, x: mx + mw - 10, y: my + 155 * u - 71 }
  const bubble = { x: mx + mw - 14, y: my + 200 * u, w: 146, h: mh - 200 * u - 4 }
  const queue = line ? { size: 74, x: bubble.x + bubble.w + 8, y: my + 388 * u - 74 } : null
  const queueBubble = line ? { x: queue.x - 4, y: queue.y - 80, w: 84, h: 76, tail: 'down' } : null
  return { shelf, machine, drain, lever, bubble, taps, queue, queueBubble, floorY: my + 380 * u }
}

const DESIGN = { wide: [1000, 650], tall: [390, 690], flat: [844, 300] }
const BUILD = { wide, tall, flat }

export function layoutFor(W, H, nTaps, total, line) {
  const r = W / H
  const mode = r >= 2 ? 'flat' : r <= 0.95 ? 'tall' : 'wide'
  const [dw, dh] = DESIGN[mode]
  const s = Math.min(W / dw, H / dh, 1.8)
  const cw = W / s, ch = H / s
  const g = BUILD[mode](cw, ch, nTaps, total, line)
  const { machine: m } = g, u = m.w / 240
  // where the monster stands under the shower, and where the paint goes in
  const mon = { size: 160 * u, x: m.x + 40 * u, y: m.y + 208 * u }
  const mouth = { x: m.x + 120 * u, y: m.y + 24 * u }
  // after a miss the wish comes next to the monster, as big as the monster
  const cmpW = mon.size * 1.36
  const cmpX = Math.min(mon.x + mon.size * 0.98, cw - 6 - cmpW)
  const bubbleCmp = { x: cmpX, y: mon.y - cmpW * 0.15, w: cmpW, h: cmpW }
  const monCmpX = Math.min(mon.x, cmpX - mon.size * 0.94)
  return { mode, s, cw, ch, u, mon, mouth, bubbleCmp, monCmpX, entryX: cw + 30, ...g }
}

/** The place of the i-th monster of the parade: { x, y, size } */
export function slotAt(shelf, i) {
  const col = i % shelf.cols, row = Math.floor(i / shelf.cols)
  const size = shelf.slot * 0.92
  return {
    x: shelf.x + col * shelf.slot + (shelf.slot - size) / 2,
    y: shelf.y + row * (shelf.slot + shelf.pad) + (shelf.slot - size) + 2,
    size,
  }
}
