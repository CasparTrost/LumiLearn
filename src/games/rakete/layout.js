// Planeten-Hüpfer: where everything is, in screen pixels of the play area
// (the game lays itself out: it is in NO_SCALE in screens/GameScreen.jsx).
//
// The number line runs left to right when eleven planets of a finger's
// width fit side by side (a tablet, a phone held sideways). On a phone held
// upright it runs from the bottom up, 0 at the bottom: the rocket climbs
// for plus. Everything about the line is written in two numbers, the place
// on the line (n) and the distance from it (off, towards the rocket's
// side), so the game itself never asks which way the line runs.

import { TOP } from './tasks.js'

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const N = TOP + 1

export function layout(w, h) {
  const m = 10
  const vertical = (w - 2 * m) / N < 62 && h > w
  return vertical ? tall(w, h, m) : wide(w, h, m)
}

// The line across, the sum above it; on a short screen (a phone held
// sideways) the sum and the buttons share one band at the top.
function wide(w, h, m) {
  const cell = Math.min((w - 2 * m) / N, 100)
  const x0 = (w - cell * N) / 2
  const pd = Math.min(cell * 0.8, 78), pr = pd / 2
  const rw = clamp(cell * 0.72, 40, 70), rh = rw * 1.62
  const arcH = clamp(cell * 0.5, 26, 50)
  const short = h < 520
  const btn = short ? clamp(h * 0.25, 66, 80) : clamp(h * 0.14, 80, 104)
  let lineY, band, card, controls, hud
  if (short) {
    band = btn + 12
    card = { x: m, y: 6, w: w * 0.5 - m, h: band - 6 }
    controls = { x: w * 0.5, y: 6, w: w * 0.5 - m, h: band - 6, justify: 'flex-end' }
    // the star counter at the start of the buttons' half, never over the sum
    hud = { x: w * 0.5 + 6, y: 10, size: 30, align: 'left' }
    lineY = h - m - pr - 2
  } else {
    const cardH = clamp(h * 0.2, 104, 150)
    card = { x: m, y: 10, w: w - 2 * m, h: cardH }
    controls = { x: m, y: h - btn - 22, w: w - 2 * m, h: btn + 12, justify: 'center' }
    hud = { x: w - m, y: 12, size: 40, align: 'right' }
    // the rocket in the air and the planet, in the middle of what is left
    const block = rh + arcH + pd + 24
    const top = card.y + card.h, bottom = controls.y
    lineY = top + Math.max(0, (bottom - top - block) / 2) + rh + arcH + 24 + pr
  }
  const P = (n, off = 0) => ({ x: x0 + (n + 0.5) * cell, y: lineY - off })
  return {
    vertical: false, short, w, h, m, cell, pd, pr, rw, rh, arcH, btn, P, base: 0, lean: 1,
    card, controls, hud,
    nb: short ? clamp(card.h * 0.56, 40, 52) : clamp(card.h * 0.48, 50, 70),
    alien: short ? card.h * 0.9 : clamp(card.h * 0.95, 96, 140),
    // the moon of the finale, high enough for the rocket to stand on it
    moon: short
      ? { x: w * 0.6, y: rh + 54 + 12, r: 54 }
      : { x: w / 2, y: card.y + rh + clamp(h * 0.12, 56, 96) + 10, r: clamp(h * 0.12, 56, 96) },
  }
}

// A phone held upright: the line up the left side, 0 at the bottom; the
// sum and the buttons in the column to its right.
function tall(w, h, m) {
  const cell = Math.min((h - 2 * m) / N, 84)
  const y0 = h - (h - cell * N) / 2
  const pd = Math.min(cell * 0.84, 70), pr = pd / 2
  const rw = clamp(cell * 0.7, 36, 56), rh = rw * 1.62
  const arcH = clamp(cell * 0.46, 22, 40)
  const lineX = m + pr + 2
  const px = lineX + pr + rh + 10           // the column right of the rocket
  const pw = w - m - px
  const btn = clamp(Math.min(pw / 2 - 8, h * 0.12), 64, 92)
  const cardH = clamp(h * 0.3, 150, 250)
  const card = { x: px, y: 10, w: pw, h: cardH, column: true }
  const controls = { x: px, y: h - 2 * btn - 34, w: pw, h: 2 * btn + 24, justify: 'center' }
  const P = (n, off = 0) => ({ x: lineX + off, y: y0 - (n + 0.5) * cell })
  const hud = { x: px + pw / 2, y: card.y + card.h + 10, size: 32, align: 'center' }
  // the moon of the finale below the star counter: the rocket and the
  // dancers stand on its top, the counter stays above them
  const moonR = Math.min(80, pw * 0.36)
  return {
    vertical: true, short: false, w, h, m, cell, pd, pr, rw, rh, arcH, btn, P, base: 90, lean: -1,
    card, controls, hud,
    // the longest sum ("10 − 3 = ▢", about five numbers wide) fits the card
    nb: clamp((pw - 40) / 5, 32, 46),
    alien: clamp(cardH * 0.5, 64, 116),
    moon: { x: px + pw / 2, y: Math.max(hud.y + 70 + rh + moonR * 0.8, h * 0.36), r: moonR },
  }
}

/** A point on the quadratic bow from a to b at t (0 … 1). */
export function bow(a, c, b, t) {
  const u = 1 - t
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y }
}

/** One hop from planet a to planet b: start, control point, end (the rocket's feet). */
export function hopPath(L, a, b, high = 1) {
  const mid = (a + b) / 2
  return { a: L.P(a, L.pr), c: L.P(mid, L.pr + 2 * L.arcH * high), b: L.P(b, L.pr) }
}
