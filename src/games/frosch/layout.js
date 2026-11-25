// Frosch-Hüpfer: where everything is. All in the game's own pixels (the
// game screen may show them scaled, see components/FitBox.jsx); points of
// figures are where their feet stand, points of pads their middle.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/**
 * The stage for a room of w × h shown at `scale` (screen pixels per own
 * pixel). A screen held sideways: the frog crosses from the left bank to the
 * right one. Held upright: from the bottom bank up to the top one. The far
 * shore along the top holds what was collected.
 */
export function stageLayout(w, h, scale = 1) {
  const tap = 64 / scale              // the smallest thing a finger must hit
  const wide = w > h * 1.1
  const m = 8
  if (wide) {
    const top = clamp(h * 0.14, 58, 88)
    const bottom = clamp(h * 0.08, 30, 54)
    const frog = clamp(h * 0.24, Math.max(66, tap * 0.95), Math.min(132, w * 0.105))
    const thing = clamp(h * 0.28, Math.max(96, tap * 1.3), 160)
    const left = clamp(w * 0.13, frog * 1.35, 190)
    const right = clamp(w * 0.19, thing * 1.45, 290)
    const water = { x: left, y: top, w: w - left - right, h: h - top - bottom }
    const rowY = water.y + water.h * 0.56
    const slot = clamp(top - 24, 32, 56)
    return {
      wide, w, h, tap, frog, thing, water, slot, m, rowY,
      home: { x: left - frog * 0.62, y: rowY + frog * 0.12 },
      goal: { x: w - right + frog * 0.5, y: rowY + frog * 0.2 },
      thingAt: { x: w - right * 0.4, y: rowY + thing * 0.05 },
      shelf: { cx: water.x + water.w / 2, cy: top / 2 - 1, max: water.w - 8 },
      hud: { right: m, top: Math.max(4, (top - slot) / 2 - 4) },
      hudSize: clamp(slot * 0.82, 28, 42),
      duck: frog * 1.75,
    }
  }
  const slot = clamp((w - 2 * m) / 8 - 5, 30, 50)
  const thing = clamp(h * 0.13, Math.max(84, tap * 1.3), 124)
  const frog = clamp(h * 0.105, Math.max(62, tap * 0.95), 92)
  const top = slot + thing + 30
  const bottom = frog * 0.82 + 30
  const water = { x: m, y: top, w: w - 2 * m, h: h - top - bottom }
  const cx = w / 2
  return {
    wide, w, h, tap, frog, thing, water, slot, m, rowX: cx,
    home: { x: cx, y: water.y + water.h + frog * 0.72 },
    goal: { x: cx - thing * 0.5, y: top - 8 },
    thingAt: { x: cx + thing * 0.36, y: top - 12 },
    shelf: { cx, cy: m + slot / 2 + 2, max: w - 2 * m },
    hud: { right: m, bottom: m },
    hudSize: clamp(frog * 0.42, 28, 38),
    duck: frog * 1.75,
  }
}

/**
 * A hop round with n syllables: where the pads come up and how big they
 * are. One hop is `u` long. Spot n + 1 is still water, a hop's length short
 * of the far bank: a hop too many lands there. The leap ashore from the
 * last pad is a little longer than a hop; from any pad before it the bank
 * is out of reach, and the frog comes down at `short(k)`.
 */
export function hopSpots(L, n) {
  const f = L.frog
  if (L.wide) {
    const a = L.home.x, e = L.water.x + L.water.w - f * 0.6
    const u = (e - a) / (n + 1)
    const pw = Math.min(u - 12, f * 1.4, 160)
    const at = k => ({ x: a + k * u, y: L.rowY })
    return { n, u, at, short: k => at(Math.min(k + 1.5, n + 0.6)), pad: { w: pw, h: pw * 0.6 }, lift: Math.min(u * 0.5, f * 0.9) }
  }
  const a = L.home.y, e = L.water.y + f * 0.8
  const u = (a - e) / (n + 1)
  const ph = Math.min(u - 10, f * 0.82)
  const at = k => ({ x: L.rowX, y: a - k * u })
  return { n, u, at, short: k => at(Math.min(k + 1.5, n + 0.6)), pad: { w: Math.min(ph / 0.6, L.water.w * 0.5), h: ph }, lift: Math.min(u * 0.42, f * 0.7) }
}

/**
 * A build round: the six places pads float at (three by two sideways, two
 * by three upright), the size of a pad, and how far a pad may float from
 * its place without touching its neighbour.
 */
export function padCells(L, drift = 1) {
  const cols = L.wide ? 3 : 2, rows = L.wide ? 2 : 3
  // clear of the banks: the frog sits at the edge of one, the thing on the other
  const inset = L.wide ? { l: L.frog * 0.2, r: L.frog * 0.5, t: L.frog * 0.5, b: 10 } : { l: 6, r: 6, t: L.frog * 0.7, b: L.frog * 0.25 }
  const x0 = L.water.x + inset.l, y0 = L.water.y + inset.t
  const cw = (L.water.w - inset.l - inset.r) / cols, ch = (L.water.h - inset.t - inset.b) / rows
  const amp = clamp(5 + drift * 5, 0, Math.min(cw, ch) * 0.16)
  let pw = Math.min(cw - 2 * amp - 16, 190)
  let ph = pw * 0.6
  const maxH = ch - 2 * amp - 14
  if (ph > maxH) { ph = maxH; pw = ph / 0.6 }
  const room = { x: (cw - pw) / 2 - amp - 4, y: (ch - ph) / 2 - amp - 4 }
  const at = pad => {
    const c = pad.cell % cols, r = Math.floor(pad.cell / cols) % rows
    return { x: x0 + cw * (c + 0.5) + Math.max(0, room.x) * pad.jx, y: y0 + ch * (r + 0.5) + Math.max(0, room.y) * pad.jy }
  }
  return { cols, rows, amp, pad: { w: pw, h: ph }, at }
}

/** The row of collected things on the far shore: the middle of each place. */
export function shelfSlots(L, total) {
  const gap = 5
  const size = Math.min(L.slot, (L.shelf.max - 16) / total - gap)
  const width = total * (size + gap) - gap
  const x0 = L.shelf.cx - width / 2 + size / 2
  return { size, width, slots: Array.from({ length: total }, (_, i) => ({ x: x0 + i * (size + gap), y: L.shelf.cy })) }
}
