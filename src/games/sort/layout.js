// Fließband-Füttern: where everything stands, for any size of the play
// area, and which monster a fling is aimed at. Plain numbers, no React, so
// it can be tested (tests/unit/fliessband.test.js).

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

/** A target's box: its sign on top (SIGN_H × width), the basket below. */
export const SIGN_H = 0.38
export const MONSTER_H = SIGN_H + 0.98
/** The middle of the basket's opening, where a thing lands (× width, from the box's top) */
export const RIM_Y = SIGN_H + 0.35
const GAP = 0.1   // between two targets in a row, × width

/**
 * The stage for `n` targets in a play area of W × H px.
 *
 * Wide (a tablet, a phone held sideways): the targets stand in a row, the
 * belt runs in front of them along the bottom. Tall (a phone held upright):
 * the belt runs through the middle, with targets above and below it, so a
 * fling up or down is never in doubt and the monsters stay big.
 *
 *   S        size of a thing on the belt
 *   belt     { x0, x1 } the stretch things ride (their middles), top, thick, rideY (middle of a riding thing)
 *   pipe     the tube that brings things back: top, h, mouthW, left / right { x, y } (the openings)
 *   targets  [{ x, y, w, h, mouth: { x, y }, row }] in the order of the plan
 *   hud      the star counter: { x, y, w, h, size }
 */
export function layoutFor(W, H, n) {
  const wide = W >= H * 1.15
  const small = Math.min(W, H) < 480
  const pad = small ? 6 : 12
  const S = Math.round(clamp(Math.min(W, H) * 0.19, 64, 96))
  const thick = Math.round(S * 0.36)
  const pipeH = Math.round(S * 0.24)
  const size = small ? 30 : 40
  const hud = { size, w: Math.round(size * 2.7), h: size + 14 }
  hud.x = W - pad - hud.w
  hud.y = pad
  const mouthW = Math.round(S * (small ? 0.72 : 0.86))
  const rows = wide ? [n] : n <= 2 ? [1, n - 1] : [2, n - 2]
  const rowWidth = (k, w) => w * (k + GAP * (k - 1))

  let mw, beltTop, rowY, cx = W / 2
  if (wide) {
    beltTop = H - pad - pipeH - 3 - thick
    // on a small screen the monsters stand right behind the belt: what rides
    // past covers their feet, and they can be a good deal bigger
    const feet = small ? beltTop - S * 0.72 : beltTop - S - 14
    const fit = aw => Math.min(clamp(H * 0.42, 140, 300), aw / (n + GAP * (n - 1)), (feet - pad) / MONSTER_H)
    mw = fit(W - 2 * pad)
    // the star counter sits top right: a row that reaches under it moves over
    if (feet - mw * MONSTER_H < hud.y + hud.h + 4 && (W + rowWidth(n, mw)) / 2 > hud.x - 8) {
      const aw = hud.x - 8 - pad
      mw = fit(aw)
      cx = pad + aw / 2
    }
    rowY = [feet - mw * MONSTER_H]
  } else {
    const strip = hud.h + pad
    const g = small ? 8 : 14
    const assembly = S + thick + 3 + pipeH
    const per = Math.max(...rows)
    mw = Math.min(clamp(W * 0.6, 140, 300), (W - 2 * pad) / (per + GAP * (per - 1)), (H - strip - assembly - 2 * g - pad) / 2 / MONSTER_H)
    const used = 2 * mw * MONSTER_H + assembly + 2 * g
    const y0 = strip + Math.max(0, (H - strip - pad - used) / 2)
    beltTop = y0 + mw * MONSTER_H + g + S
    rowY = [y0, beltTop + thick + 3 + pipeH + g]
  }
  mw = Math.floor(mw)

  const targets = []
  rows.forEach((k, r) => {
    const x0 = cx - rowWidth(k, mw) / 2
    for (let i = 0; i < k; i++) {
      const x = Math.round(x0 + i * mw * (1 + GAP)), y = Math.round(rowY[r])
      targets.push({ x, y, w: mw, h: Math.round(mw * MONSTER_H), mouth: { x: x + mw / 2, y: y + mw * RIM_Y }, row: r })
    }
  })

  beltTop = Math.round(beltTop)
  return {
    wide, small, W, H, S, pad, hud, mw, targets,
    belt: { x0: pad + mouthW + S * 0.45, x1: W - pad - mouthW - S * 0.2, left: pad + mouthW - 4, right: W - pad - mouthW + 4, top: beltTop, thick, rideY: beltTop + 3 - S / 2 },
    pipe: { top: beltTop + thick + 3, h: pipeH, mouthW, left: { x: pad + mouthW / 2, y: beltTop }, right: { x: W - pad - mouthW / 2, y: beltTop } },
  }
}

/** How far a finger has to move before a drag counts as a fling (× S) */
export const AIM_MIN = 0.4
const AIM_CONE = (40 * Math.PI) / 180

/**
 * Which target a drag is aimed at, or -1. `from` is where the finger went
 * down, `finger` where it is now. A finger resting on a target means that
 * target. Otherwise, and while the finger is moving `fast` (a fling that
 * may cross another monster on its way), the direction of the drag decides,
 * if it points at a target within 40°. The game shows the answer while the
 * finger moves (the monster opens its mouth), so what is let go is what
 * was shown.
 */
export function aimAt(L, from, finger, fast = false) {
  const dx = finger.x - from.x, dy = finger.y - from.y
  const len = Math.hypot(dx, dy)
  if (len < L.S * AIM_MIN) return -1
  const on = L.targets.findIndex(t => finger.x >= t.x && finger.x <= t.x + t.w && finger.y >= t.y && finger.y <= t.y + t.h)
  if (on >= 0 && !fast) return on
  let best = -1, bestA = AIM_CONE
  L.targets.forEach((t, i) => {
    const vx = t.x + t.w / 2 - from.x, vy = t.y + t.h * 0.6 - from.y
    const a = Math.acos(clamp((dx * vx + dy * vy) / (len * Math.hypot(vx, vy)), -1, 1))
    if (a < bestA) { bestA = a; best = i }
  })
  return best >= 0 ? best : on
}

/**
 * The bow a thrown thing flies: the control point of a quadratic curve,
 * above the higher end, kept inside the stage.
 */
export function throwArc(L, from, to) {
  const d = Math.hypot(to.x - from.x, to.y - from.y)
  const lift = clamp(d * 0.55, L.S * 0.9, L.S * 3.2)
  return { x: (from.x + to.x) / 2, y: Math.max(L.S * 0.3, Math.min(from.y, to.y) - lift) }
}

/** A point on that bow, t from 0 to 1 */
export function arcAt(from, ctrl, to, t) {
  const u = 1 - t
  return { x: u * u * from.x + 2 * u * t * ctrl.x + t * t * to.x, y: u * u * from.y + 2 * u * t * ctrl.y + t * t * to.y }
}

/**
 * A place on the belt near `x` with room for one more thing: `taken` are
 * the middles of the things riding. Never right at the end, so a thing put
 * back does not fall into the pipe at once.
 */
export function freeSpot(L, x, taken) {
  const lo = L.belt.x0, hi = Math.max(lo, L.belt.x1 - L.S * 1.3)
  const want = clamp(x, lo, hi)
  const room = at => taken.every(o => Math.abs(o - at) >= L.S * 1.02)
  for (let k = 0; k < 40; k++) {
    const step = Math.ceil(k / 2) * L.S * 0.3 * (k % 2 ? 1 : -1)
    const at = want + step
    if (at >= lo && at <= hi && room(at)) return at
  }
  return want
}
