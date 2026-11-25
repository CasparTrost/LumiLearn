// Blasen-Blitz: what goes into the sea, as plain functions (no React), so
// the rules can be tested: how big the bubbles are, how many the sea on
// this screen can carry, which values they get, and the giant bubble.

export const TINTS = ['#4aa3ff', '#ff6b5b', '#ffc93c', '#5cc45a', '#8e6cf0', '#fd79a8', '#2fb8a6', '#ff9f43']

/** Never smaller than a fingertip */
export const MIN_BUBBLE = 64

export function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

// Numbers easy to take for the target: digits swapped, neighbours, 6 and 9.
export function confusables(v, maxNum) {
  const out = [v - 1, v + 1]
  if (v > 9) out.push(Number(String(v).split('').reverse().join('')))
  if (v % 10 === 6) out.push(v + 3)
  if (v % 10 === 9) out.push(v - 3)
  return out.filter(x => x >= 1 && x <= maxNum && x !== v)
}

/**
 * The sizes a bubble may have in a sea of W × H px: a little smaller in a
 * small sea (a phone, or a phone held sideways), never below MIN_BUBBLE.
 */
export function bubbleSizes(W, H, dots) {
  const k = Math.max(0.75, Math.min(1, W / 560, H / 380))
  const lo = Math.max(MIN_BUBBLE, Math.round((dots ? 72 : 66) * k))
  const hi = Math.max(lo + 6, Math.round((dots ? 96 : 90) * k))
  return { lo, hi }
}

/** The giant bubble's size in a sea of W × H px */
export function giantSize(W, H) {
  return Math.round(Math.max(96, Math.min(150, H * 0.55, W * 0.34)))
}

// Free water each bubble needs around it, in bubble areas: below this the
// sea is a crowd where bubbles overlap and cover each other.
const ROOM = 3.6

/**
 * How many bubbles the sea carries in this round: the level's number, but
 * no more than fit with room to spare (a phone held sideways takes about
 * eight), and never so few that the wished-for ones have no others to be
 * told apart from. With the giant it counts as the bubbles it displaces.
 */
export function seaCount(cfg, W, H, { giant = false } = {}) {
  const { lo, hi } = bubbleSizes(W, H, cfg.dots)
  const avg = (lo + hi) / 2
  const free = W * H - (giant ? 1.3 * giantSize(W, H) ** 2 : 0)
  const fits = Math.floor(free / (ROOM * avg * avg))
  return Math.max(cfg.maxT + 2, Math.min(cfg.count, fits))
}

/**
 * One round's bubbles, spread over a sea of W × H px. `target` is the
 * wished-for value; with `all` every bubble has it (the party: target 0,
 * every bubble a star bubble).
 */
export function spawnRound(target, cfg, W, H, { giant = false, all = false } = {}) {
  const count = seaCount(all ? { ...cfg, maxT: 0 } : cfg, W, H, { giant })
  // at least two others, so a wish is never "all of them"
  const targetCount = all ? count : Math.min(count - 2, rand(cfg.minT, cfg.maxT))
  const near = cfg.dots ? [] : confusables(target, cfg.maxNum)
  const { lo, hi } = bubbleSizes(W, H, cfg.dots)
  const placed = []
  return Array.from({ length: count }, (_, i) => {
    let value = target
    if (i >= targetCount) {
      if (near.length && Math.random() < 0.5) value = near[rand(0, near.length - 1)]
      else do { value = rand(1, cfg.maxNum) } while (value === target)
    }
    const size = rand(lo, hi)
    const r = size / 2 + 4
    // Inside the water by at least the radius, so no bubble is cut off, and
    // apart from the others: of a few random spots the one with the most
    // room is taken, so the bubbles spread over the whole sea instead of
    // clumping where chance put them.
    let best = null
    for (let k = 0; k < 24; k++) {
      const x = r + Math.random() * Math.max(0, W - 2 * r), y = r + Math.random() * Math.max(0, H - 2 * r)
      const room = Math.min(Infinity, ...placed.map(p => Math.hypot(p.x - x, p.y - y) - p.r - r))
      if (!best || room > best.room) best = { x, y, room }
    }
    placed.push({ x: best.x, y: best.y, r })
    return {
      id: `${i}-${Math.random().toString(36).slice(2)}`,
      value, tint: TINTS[rand(0, TINTS.length - 1)],
      left: (best.x / W) * 100, top: (best.y / H) * 100, size,
    }
  })
}

/**
 * The giant bubble of a round with this target: wished-for (most of the
 * time) or a near miss. In the dot levels its value is shown as two dice
 * faces, `parts` [a, b] with a + b = value, each 1 to 6; the target of the
 * giant's round is at least 2, so a wished-for sum always exists.
 */
export function makeGiant(target, cfg, wished = Math.random() < 0.7) {
  let value = target
  if (!wished) {
    const near = cfg.dots
      ? [target - 1, target + 1].filter(v => v >= 2 && v <= 12)
      : confusables(target, cfg.maxNum)
    value = near.length ? near[rand(0, near.length - 1)] : target + 1
  }
  let parts = null
  if (cfg.dots) {
    const a = rand(Math.max(1, value - 6), Math.min(6, value - 1))
    parts = [a, value - a]
  }
  return { id: `giant-${Math.random().toString(36).slice(2)}`, giant: true, value, parts, tint: '#8fd3ff' }
}
