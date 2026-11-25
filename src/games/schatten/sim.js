/**
 * Taschenlampen-Jagd: how the shadows get about in the dark room. Pure
 * functions on plain objects (tests/unit/schatten.test.js); the game's
 * clock calls `step` once a frame for every shadow that is free.
 *
 * A shadow picks a spot, goes there in its own way (walks, crawls, hops,
 * rolls, drives, flies, floats), waits a moment and picks the next. Now
 * and then it dashes, and things on the floor like to hide behind the
 * low furniture in front, where only their top half shows. Caught by the
 * light it holds still (the game handles that); let go, it scurries away
 * from where the light was.
 */
import { THINGS, CAT } from './data.js'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Pictures that look to the right; those that look at us are not turned
// round when they change direction. All the others look to the left.
const LOOKS_RIGHT = new Set(['🐌', '🚀'])
const LOOKS_AT_US = new Set(['🧸', '🐹', '🐸', '🦇', '🦋', '🦉', '🕷️', '🐞', '🎈', '🐝'])
/** +1: the picture looks right, -1: left, 0: at us (never mirrored when it turns). */
export function lookOf(e) {
  if (LOOKS_RIGHT.has(e)) return 1
  const t = THINGS[e]
  if (LOOKS_AT_US.has(e) || (t && (t.move === 'roll' || (t.move === 'hop' && t.group !== 'hase' && t.group !== 'eich' && t.group !== 'kueken')))) return 0
  return -1
}

// How fast each way of moving is, against a walk
const PACE = { walk: 1, crawl: 0.55, hop: 1.1, roll: 1.25, drive: 1.5, fly: 1.2, float: 0.5 }
const AIRBORNE = new Set(['fly', 'float'])
export const isAirborne = move => AIRBORNE.has(move)

/**
 * The room as the shadows see it. W, H: its size; S: a shadow's size;
 * floor: where wall and floor meet (y); hides: the low furniture in front
 * ({ x, w, top }), behind which a thing on the floor can crouch.
 */
export function makeRoom(W, H, S, hides = []) {
  const floor = Math.round(H * 0.6)
  return {
    W, H, S, floor, hides,
    x0: S * 0.55, x1: W - S * 0.55,
    // things on the floor: from just below the skirting to the front edge
    ground: [Math.min(floor + S * 0.05, H - S * 0.6), H - S * 0.55],
    // things in the air: under the ceiling to above the floor
    air: [S * 0.6, Math.max(S * 0.6, floor - S * 0.15)],
  }
}

function randomSpot(s, room, rnd, others = []) {
  const [y0, y1] = isAirborne(s.move) ? room.air : room.ground
  let best = null
  for (let k = 0; k < 6; k++) {
    const p = { x: room.x0 + rnd() * (room.x1 - room.x0), y: y0 + rnd() * Math.max(0, y1 - y0) }
    // not onto a spot another shadow is heading for, and a real walk away
    const near = others.reduce((m, o) => Math.min(m, Math.hypot(o.tx - p.x, o.ty - p.y)), Infinity)
    const far = Math.hypot(p.x - s.x, p.y - s.y)
    const score = Math.min(near, room.S * 1.4) + Math.min(far, room.W * 0.4) * 0.5
    if (!best || score > best.score) best = { ...p, score }
  }
  return best
}

/** Where a thing hides behind a piece of furniture: its top half shows. */
export function hideSpot(hide, room) {
  return { x: clamp(hide.x, room.x0, room.x1), y: clamp(hide.top + room.S * 0.12, room.ground[0], room.H - room.S * 0.3) }
}

/** A new shadow somewhere in the room. */
export function spawn(id, e, room, rnd = Math.random, others = []) {
  const move = e === CAT ? 'walk' : THINGS[e].move
  const s = {
    id, e, move, x: 0, y: 0, tx: 0, ty: 0, vx: 0, face: rnd() < 0.5 ? -1 : 1, rot: 0, t: rnd() * 10,
    wait: 0.4 + rnd() * 0.8, dash: 0, hiding: false, state: 'dark',
  }
  const p = randomSpot(s, room, rnd, others)
  s.x = s.tx = p.x
  s.y = s.ty = p.y
  return s
}

/**
 * One frame for a free shadow (state 'dark'): `dt` seconds, `speed` the
 * level's pace, `others` the other shadows (not to bump into them).
 */
export function step(s, dt, room, speed, rnd = Math.random, others = []) {
  s.t += dt
  if (s.wait > 0) {
    s.wait -= dt
    s.vx = 0
    if (s.wait <= 0) {
      const hides = room.hides
      // things on the floor sometimes crouch behind the furniture in front
      if (!isAirborne(s.move) && hides.length && !s.hiding && rnd() < 0.3) {
        const p = hideSpot(hides[Math.floor(rnd() * hides.length)], room)
        s.tx = p.x; s.ty = p.y; s.hiding = true
      } else {
        const p = randomSpot(s, room, rnd, others)
        s.tx = p.x; s.ty = p.y; s.hiding = false
        if (rnd() < 0.22) s.dash = 0.5 + rnd() * 0.5
      }
    }
    return s
  }
  const v = room.W * 0.09 * speed * PACE[s.move] * (s.dash > 0 ? 2.6 : 1)
  if (s.dash > 0) s.dash -= dt
  const dx = s.tx - s.x, dy = s.ty - s.y
  const d = Math.hypot(dx, dy)
  if (d < 2) {
    s.vx = 0
    s.wait = s.hiding ? 1.6 + rnd() * 2 : 0.3 + rnd() * 1.2
    return s
  }
  const k = Math.min(1, (v * dt) / d)
  const mx = dx * k, my = dy * k
  s.x += mx
  s.y += my
  s.vx = mx / Math.max(dt, 1e-3)
  if (Math.abs(dx) > 4) s.face = dx > 0 ? 1 : -1
  // round things roll: they turn as far as they go
  if (s.move === 'roll') s.rot += (mx / (room.S * 0.45)) * (180 / Math.PI)
  // keep a little apart from the others
  for (const o of others) {
    const ox = s.x - o.x, oy = s.y - o.y, od = Math.hypot(ox, oy)
    if (od > 0 && od < room.S * 0.7) { s.x += (ox / od) * 20 * dt; s.y += (oy / od) * 10 * dt }
  }
  const [y0, y1] = isAirborne(s.move) ? room.air : room.ground
  s.x = clamp(s.x, room.x0, room.x1)
  s.y = clamp(s.y, Math.min(y0, s.ty), Math.max(y1, s.ty))
  return s
}

/** Let go by the light: off, away from where the light was, in a hurry. */
export function flee(s, from, room, rnd = Math.random) {
  const [y0, y1] = isAirborne(s.move) ? room.air : room.ground
  const left = from.x > room.W / 2
  s.tx = left ? room.x0 + rnd() * room.W * 0.25 : room.x1 - rnd() * room.W * 0.25
  s.ty = y0 + rnd() * Math.max(0, y1 - y0)
  s.dash = 0.9
  s.wait = 0
  s.hiding = false
  s.state = 'dark'
  return s
}

/**
 * How it bobs while it goes (drawn, not moved): { dy, rot } on top of its
 * place. Nothing with reduced motion.
 */
export function gait(s, S, still) {
  if (still) return { dy: 0, rot: s.move === 'roll' ? s.rot : 0 }
  const going = Math.abs(s.vx) > 1 || s.wait <= 0
  const t = s.t
  switch (s.move) {
    case 'walk': return { dy: going ? -Math.abs(Math.sin(t * 9)) * S * 0.04 : 0, rot: going ? Math.sin(t * 9) * 3 : 0 }
    case 'crawl': return { dy: 0, rot: going ? Math.sin(t * 6) * 2 : 0 }
    case 'hop': return { dy: going ? -Math.abs(Math.sin(t * 5.5)) * S * 0.28 : 0, rot: 0 }
    case 'roll': return { dy: 0, rot: s.rot }
    case 'drive': return { dy: going ? Math.sin(t * 40) * 0.8 : 0, rot: 0 }
    case 'fly': return { dy: Math.sin(t * 3) * S * 0.08, rot: clamp(s.vx * 0.05, -12, 12) }
    case 'float': return { dy: Math.sin(t * 1.3) * S * 0.1, rot: Math.sin(t * 0.9) * 6 }
    default: return { dy: 0, rot: 0 }
  }
}

/** Is a shadow in the light? The light must cover a good part of it. */
export const inLight = (s, beam, S) => Math.hypot(s.x - beam.x, s.y - beam.y) < beam.r * 0.62 + S * 0.18
