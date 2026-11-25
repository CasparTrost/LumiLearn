/**
 * Taschenlampen-Jagd: where everything goes on the screen. Pure (tested).
 *
 * The game sizes itself (it is in NO_SCALE: the torch needs real pointer
 * coordinates). Two shapes:
 *   • stacked (a tablet, a phone held upright): the garland of friends on
 *     top, the dark room in the middle, the cards in one or two rows below
 *   • side (a phone on its side, little height): the garland on top, the
 *     room on the left, the cards in one or two columns on the right
 * The star counter sits at the right end of the garland row, the light
 * joker beside it (or under it, when the garland needs two rows).
 */

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const MIN_CARD = 64
export const GAP = 8

/** The best grid for `n` cards in a box `bw` × `bh`, cards at most `max` px. */
export function cardGrid(n, bw, bh, max, { maxLines = 3, rows: byRows = true } = {}) {
  let best = null
  for (let lines = 1; lines <= maxLines; lines++) {
    const across = Math.ceil(n / lines)
    const [cols, rows] = byRows ? [across, lines] : [lines, across]
    const size = Math.floor(Math.min(max, (bw - (cols - 1) * GAP) / cols, (bh - (rows - 1) * GAP) / rows))
    // fewer lines while the cards stay big enough; more when they would be too small
    if (!best || (best.size < MIN_CARD + 12 && size > best.size)) best = { cols, rows, size }
  }
  return { ...best, w: best.cols * best.size + (best.cols - 1) * GAP, h: best.rows * best.size + (best.rows - 1) * GAP }
}

/**
 * w, h: the play area · cards: how many cards (the most a room of the level
 * has) · slots: places on the garland (one per shadow of the level)
 */
export function layoutFor(w, h, cards, slots) {
  const pad = clamp(Math.round(Math.min(w, h) * 0.025), 8, 18)
  const side = h < 500 && w / h > 1.45
  const hud = side || w < 560 ? 30 : 36
  const hudW = hud * 2.3 + 12
  // the light joker sits outside the room, beside the star counter
  const J = side || w < 560 ? 44 : 52
  // the garland: a bulb and a friend per shadow; in two rows when one
  // row would make the friends tiny (many shadows on a narrow screen),
  // and then the joker goes under the star counter
  const full = w - 2 * pad - hudW - GAP
  const max = side ? 34 : 44
  let rows = 1, gw = full - J - GAP
  let pic = clamp(Math.floor(gw / slots) - 6, 16, max)
  if (!side && slots >= 12 && pic < 24) {
    rows = 2
    gw = full
    pic = clamp(Math.floor(gw / Math.ceil(slots / 2)) - 6, 16, max)
  }
  const rowH = pic + 24
  const gh = rows === 1 ? Math.max(rowH, J + 6) : Math.max(rows * rowH - 4, hud + 24 + J)
  const garland = { x: pad, y: Math.round(pad * 0.5), w: gw, h: gh, pic, rows, rowH }
  const hudBox = { x: w - pad - hudW, y: garland.y + (rows === 1 ? Math.max(0, (gh - hud - 10) / 2) : 0), size: hud }
  const joker = rows === 1
    ? { x: w - pad - hudW - GAP - J, y: garland.y + (gh - J) / 2, size: J }
    : { x: w - pad - hudW + (hudW - J) / 2, y: hudBox.y + hud + 12, size: J }
  const top = garland.y + gh + GAP

  if (side) {
    const bh = h - top - pad
    const grid = cardGrid(cards, w * 0.32, bh, clamp(bh * 0.4, MIN_CARD, 104), { maxLines: 3, rows: false })
    const cw = grid.w
    const room = { x: pad, y: top, w: w - 3 * pad - cw, h: bh }
    const cardBox = { x: w - pad - cw, y: top + Math.max(0, (bh - grid.h) / 2), ...grid }
    return { side, pad, garland, hud: hudBox, joker, room, cards: cardBox, ...sizes(room) }
  }
  const maxCard = clamp(Math.round(h * 0.15), MIN_CARD + 8, 120)
  const grid = cardGrid(cards, w - 2 * pad, h * 0.3, maxCard, { maxLines: 2 })
  const roomH = h - top - grid.h - GAP - pad
  const room = { x: pad, y: top, w: w - 2 * pad, h: roomH }
  const cardBox = { x: (w - grid.w) / 2, y: top + roomH + GAP, ...grid }
  return { side, pad, garland, hud: hudBox, joker, room, cards: cardBox, ...sizes(room) }
}

/** The size of a shadow and of the torch light in a room. */
function sizes(room) {
  const S = Math.round(clamp(Math.min(room.w * 0.22, room.h * 0.3), 60, 150))
  const beam = Math.round(clamp(Math.min(room.w, room.h) * 0.36, 84, 200))
  return { S, beam }
}
