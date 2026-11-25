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
 * Where the wall meets the floor: lower in a wide room, higher in a tall
 * one (a phone held upright), so the floor has room for everything on it.
 */
export const floorOf = (W, H) => H * (W / H < 1 ? 0.46 : W / H < 1.4 ? 0.53 : 0.6)

/** How far a lamp's cord hangs down from the ceiling, and how big its shade is. */
export const lampDrop = H => Math.round(clamp(H * 0.06, 10, 36))
export const lampSize = S => Math.round(clamp(S * 0.5, 34, 58))
/** The band under the ceiling where the lamps of the found things hang: no shadow goes there. */
export const ceilingOf = (H, S) => lampDrop(H) + Math.round(lampSize(S) * 0.68) + 4

/**
 * The room as the shadows see it. W, H: its size; S: a shadow's size;
 * floor: where wall and floor meet (y); hides: the low furniture in front
 * ({ x, w, top }), behind which a thing on the floor can crouch.
 */
export function makeRoom(W, H, S, hides = []) {
  const floor = Math.round(floorOf(W, H))
  // things in the air keep below the lamps (their bobbing included)
  const top = Math.max(S * 0.6, ceilingOf(H, S) + S * 0.55)
  return {
    W, H, S, floor, hides, top,
    x0: S * 0.55, x1: W - S * 0.55,
    // things on the floor: from just below the skirting to the front edge
    ground: [Math.min(floor + S * 0.05, H - S * 0.6), H - S * 0.55],
    // things in the air: under the lamps to above the floor
    air: [top, Math.max(top, floor - S * 0.15)],
  }
}

/** Would a thing at p crouch behind a piece of the furniture in front (only its top half showing)? */
export const behindFurniture = (p, room) => room.hides.some(h => Math.abs(p.x - h.x) < h.w / 2 + room.S * 0.3 && p.y + room.S * 0.45 > h.top)

/**
 * Where a caught shadow holds still: at p, or the nearest place from
 * which it stands at least `gap` (1.1 shadows) from every other held
 * shadow (`others`: their places), in the room, under the lamps and not
 * behind the furniture, so every outline shows on its own. `avoid`:
 * places it keeps clear of besides ({ x, y, r }: the torch lying at rest).
 */
export function placeApart(p, others, room, gap = room.S * 1.1, avoid = []) {
  const lo = room.top, hi = room.H - room.S * 0.5
  const inRoom = q => ({ x: clamp(q.x, room.x0, room.x1), y: clamp(q.y, lo, Math.max(lo, hi)) })
  const nearest = q => others.reduce((m, o) => Math.min(m, Math.hypot(o.x - q.x, o.y - q.y)), Infinity)
  // how far it is from being in the way (>= 0: clear of everything)
  const clear = q => Math.min(nearest(q) - gap, ...avoid.map(a => Math.hypot(a.x - q.x, a.y - q.y) - a.r))
  const start = inRoom(p)
  if (clear(start) >= 0) return start
  let best = null
  for (let ring = 1; ring <= 8; ring++) {
    let found = null
    for (let k = 0; k < 24; k++) {
      const a = (k / 24) * Math.PI * 2
      const q = inRoom({ x: start.x + Math.cos(a) * gap * ring * 0.5, y: start.y + Math.sin(a) * gap * ring * 0.5 })
      const far = clear(q), dist = Math.hypot(q.x - start.x, q.y - start.y)
      if (far >= 0 && !behindFurniture(q, room)) { if (!found || dist < found.dist) found = { ...q, dist } }
      if (!best || far > best.far) best = { ...q, far }
    }
    if (found) return { x: found.x, y: found.y }
  }
  // the room is full: the place farthest from the others
  return { x: best.x, y: best.y }
}

const held = s => !!s && (s.state === 'caught' || s.state === 'flying')

/**
 * The focus: the lit shadow a tapped card flies to (its id, or null). It
 * is the one the child pointed the torch at or touched last, and it does
 * not move by itself:
 *   - `pin`: a lit shadow a finger rests on (touched) wins;
 *   - else the lit one in the torch light now (the nearest to its middle);
 *     one with a card on its way to it counts too, so the light lingering
 *     there does not hand the focus to a neighbour while the card flies;
 *   - else the focus stays where it is while that shadow is lit (also
 *     after a wrong card, while it waits for the next);
 *   - only when it has gone (found, or let go) does it pass to the lit one
 *     looked at last (`seenAt`). Shadows lit only by the light joker and
 *     not looked at since get no focus.
 * Never the one a card fits: what goes where is the child's work.
 */
export function nextFocus(focus, shadows, beam, S, pin = null) {
  const byId = id => shadows.find(s => s.id === id)
  if (pin != null && held(byId(pin))) return pin
  const now = inBeam(shadows, beam, S)
  if (now) return now.state === 'caught' || !held(byId(focus)) ? now.id : focus
  if (held(byId(focus))) return focus
  let best = null
  for (const s of shadows) {
    if (s.state === 'caught' && s.seenAt != null && (!best || s.seenAt > best.seenAt)) best = s
  }
  return best?.id ?? null
}

/**
 * How long the light must rest on another lit shadow before it takes the
 * focus (seconds). Short: a child shines on a shadow, looks, and goes for
 * the card; with 0.4 s the focus had often not arrived when the pointer left.
 * What keeps a crossed shadow from taking it is that the light must REST.
 */
export const FOCUS_DWELL = 0.12
/** The light counts as resting while it moves slower than this many beam radii a second. */
export const REST_SPEED = 0.45
/**
 * The focus the child means. `want` is what nextFocus picks. It takes over
 * at once when the old focus is gone or a finger rests on a shadow (`pinned`).
 * While the old focus is still lit, another shadow takes it only after the
 * light has RESTED on it (`still`: the pointer hardly moves) for FOCUS_DWELL.
 * A light that is travelling never moves the focus: with a mouse it follows
 * the pointer, and on its way to the cards (however slowly) it crosses other
 * lit shadows and catches dark ones; a finger sliding down to the cards does
 * the same. None of them may take the card that is about to be tapped.
 * → { focus, dwell } (dwell: the shadow the light is resting on, and since when)
 */
export function settleFocus(focus, want, shadows, dwell, t, pinned = false, still = true) {
  if (want === focus) return { focus, dwell: null }
  if (pinned || !held(shadows.find(s => s.id === focus))) return { focus: want, dwell: null }
  if (!still) return { focus, dwell: null }
  if (!dwell || dwell.id !== want) return { focus, dwell: { id: want, t } }
  return t - dwell.t >= FOCUS_DWELL ? { focus: want, dwell: null } : { focus, dwell }
}

/**
 * Which shadow a tapped card flies to: the focus, when it is lit and free
 * (a card on its way to it: a second quick tap waits). null: none.
 */
export function tapTarget(shadows, focus) {
  const s = shadows.find(x => x.id === focus)
  return s?.state === 'caught' ? s : null
}
/** The lit shadow in the torch light now (the nearest to its middle; one a card flies to included), or null. */
export function inBeam(shadows, beam, S) {
  if (!(beam.a > 0.5)) return null
  let best = null
  for (const s of shadows) {
    if (!held(s)) continue
    const p = { x: s.slideTo ?? s.x, y: s.liftTo ?? s.y }
    if (!inLight(p, { ...beam, r: beam.r * 1.15 }, S)) continue
    const d = Math.hypot(p.x - beam.x, p.y - beam.y)
    if (!best || d < best.d) best = { s, d }
  }
  return best?.s ?? null
}

/** How far a dark shadow keeps from a lit one, so it never shows inside that one's glow. */
export const keepAway = S => S * 1.3

const nearLit = (p, lit, S) => lit.some(o => Math.hypot(o.x - p.x, o.y - p.y) < keepAway(S) * 1.1)
// how near the way from a to b comes to o
const passes = (a, b, o) => {
  const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy
  const k = l2 ? clamp(((o.x - a.x) * dx + (o.y - a.y) * dy) / l2, 0, 1) : 0
  return Math.hypot(a.x + dx * k - o.x, a.y + dy * k - o.y)
}
const wayThroughLit = (a, b, lit, S) => lit.some(o => passes(a, b, o) < keepAway(S) * 0.98)

function randomSpot(s, room, rnd, others = [], lit = []) {
  const [y0, y1] = isAirborne(s.move) ? room.air : room.ground
  let best = null
  for (let k = 0; k < 10; k++) {
    const p = { x: room.x0 + rnd() * (room.x1 - room.x0), y: y0 + rnd() * Math.max(0, y1 - y0) }
    // not onto a spot another shadow is heading for, and a real walk away
    const near = others.reduce((m, o) => Math.min(m, Math.hypot(o.tx - p.x, o.ty - p.y)), Infinity)
    const far = Math.hypot(p.x - s.x, p.y - s.y)
    // and never into the glow round a lit one
    const score = Math.min(near, room.S * 1.4) + Math.min(far, room.W * 0.4) * 0.5 - (nearLit(p, lit, room.S) ? 1e6 : 0) - (wayThroughLit(s, p, lit, room.S) ? 1e5 : 0)
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
 * level's pace, `others` the other shadows (not to bump into them), `lit`
 * the places of the lit ones: a dark one keeps out of their glow
 * (`keepAway`), going round it, so the outline to read there stays alone.
 */
export function step(s, dt, room, speed, rnd = Math.random, others = [], lit = []) {
  s.t += dt
  if (s.wait > 0) {
    s.wait -= dt
    s.vx = 0
    if (s.wait <= 0) {
      const hides = room.hides
      // things on the floor sometimes crouch behind the furniture in front
      const hide = !isAirborne(s.move) && hides.length && !s.hiding && rnd() < 0.3 && hideSpot(hides[Math.floor(rnd() * hides.length)], room)
      if (hide && !nearLit(hide, lit, room.S)) {
        s.tx = hide.x; s.ty = hide.y; s.hiding = true
      } else {
        const p = randomSpot(s, room, rnd, others, lit)
        s.tx = p.x; s.ty = p.y; s.hiding = false
        if (rnd() < 0.22) s.dash = 0.5 + rnd() * 0.5
      }
    }
    return keepOut(s, dt, room, lit, 0)
  }
  const v = room.W * 0.09 * speed * PACE[s.move] * (s.dash > 0 ? 2.6 : 1)
  if (s.dash > 0) s.dash -= dt
  const dx = s.tx - s.x, dy = s.ty - s.y
  const d = Math.hypot(dx, dy)
  if (d < 2) {
    s.vx = 0
    s.wait = s.hiding ? 1.6 + rnd() * 2 : 0.3 + rnd() * 1.2
    return keepOut(s, dt, room, lit, 0)
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
    const gap = room.S
    if (od > 0 && od < gap) { const push = (gap - od) * 4 * dt; s.x += (ox / od) * push; s.y += (oy / od) * push * 0.5 }
  }
  const [y0, y1] = isAirborne(s.move) ? room.air : room.ground
  s.x = clamp(s.x, room.x0, room.x1)
  s.y = clamp(s.y, Math.min(y0, s.ty), Math.max(y1, s.ty))
  return keepOut(s, dt, room, lit, Math.hypot(mx, my))
}

/** Out of a lit one's glow, quickly, then round it (`along`: its step this frame): never through it. */
function keepOut(s, dt, room, lit, along) {
  const [y0, y1] = isAirborne(s.move) ? room.air : room.ground
  const fit = () => {
    s.x = clamp(s.x, room.x0, room.x1)
    s.y = clamp(s.y, Math.min(y0, s.ty), Math.max(y1, s.ty))
  }
  const keep = keepAway(room.S), fast = room.W * 0.6 * dt
  for (const o of lit) {
    let ox = s.x - o.x, oy = s.y - o.y
    const od = Math.hypot(ox, oy)
    if (od >= keep) continue
    if (od < 0.01) { ox = s.x < room.W / 2 ? -1 : 1; oy = 0 }
    const nx = ox / Math.hypot(ox, oy), ny = oy / Math.hypot(ox, oy)
    let tx = -ny, ty = nx
    if ((s.tx - o.x) * tx + (s.ty - o.y) * ty < 0) { tx = -tx; ty = -ty }
    const out = Math.min(keep - od, fast)
    s.x += nx * out + tx * along
    s.y += ny * out + ty * along
    fit()
    // held in by the floor or a wall: sideways out of it
    const hx = s.x - o.x, hy = s.y - o.y
    if (Math.hypot(hx, hy) < keep) {
      const need = Math.sqrt(Math.max(0, keep * keep - hy * hy)) - Math.abs(hx)
      let side = (hx || nx) < 0 ? -1 : 1
      // no way out at the wall: out on the other side
      if (side > 0 && o.x + keep > room.x1) side = -1
      else if (side < 0 && o.x - keep < room.x0) side = 1
      s.x += side * Math.min(need, fast)
      fit()
    }
    // its way leads through the glow: it stops and picks another place to go
    if (passes(s, { x: s.tx, y: s.ty }, o) < keep * 0.98 || nearLit({ x: s.tx, y: s.ty }, [o], room.S)) { s.tx = s.x; s.ty = s.y; s.hiding = false }
  }
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

/**
 * Does the torch light catch a dark shadow now? Only the child's own torch
 * (on: a finger or the mouse holds it), bright enough: never the demo's
 * light, nor a light fading out after the demo or after a finger lifted.
 */
export const torchCatches = (beam, demoOn) => !!beam.on && !demoOn && beam.a > 0.5

/** Is a shadow in the light? The light must cover a good part of it. */
export const inLight = (s, beam, S) => Math.hypot(s.x - beam.x, s.y - beam.y) < beam.r * 0.62 + S * 0.18
