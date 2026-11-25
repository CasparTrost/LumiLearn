import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TOP, PLUS, MINUS, levelPlan, buildTasks, countChoices, judge, gapsBetween, freeGap, RESIDENTS, dirOf, starsWon, landingLead, tapHelp } from '../../src/games/rakete/tasks.js'
import { layout, hopPath, bow, clamp, moonFlight, lineAt, feetFor } from '../../src/games/rakete/layout.js'
import { FLY_MAX, REST_S, flyStep, flyHeight, flyDown, crossings, releaseAt, reachOf, hopArcs, hushed, holdTarget, setDownAnswers } from '../../src/games/rakete/fly.js'
import { windowSpots, ThrustButton } from '../../src/games/rakete/parts.jsx'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'

const LEVELS = Array.from({ length: 10 }, (_, i) => i + 1)

describe('Planeten-Hüpfer: the sums', () => {
  it('every sum is right and stays on the line 0 … 10', () => {
    for (let run = 0; run < 40; run++) {
      for (const level of LEVELS) {
        const p = levelPlan(level)
        const tasks = buildTasks(level)
        expect(tasks).toHaveLength(p.count)
        for (const t of tasks) {
          expect(p.ops).toContain(t.op)
          expect(t.target).toBe(t.from + dirOf(t.op) * t.step)
          expect(t.step).toBeGreaterThanOrEqual(p.steps[0])
          expect(t.step).toBeLessThanOrEqual(p.steps[1])
          expect(t.from).toBeGreaterThanOrEqual(0)
          expect(t.from).toBeLessThanOrEqual(TOP)
          expect(t.target).toBeGreaterThanOrEqual(0)
          expect(t.target).toBeLessThanOrEqual(p.most)
        }
      }
    }
  })

  it('level 1 stays within five; the curve: plus, minus, mixed, in the head, the missing hops', () => {
    expect(levelPlan(1).most).toBe(5)
    expect(LEVELS.map(l => levelPlan(l).mode)).toEqual(['hop', 'hop', 'hop', 'hop', 'hop', 'hop', 'tap', 'tap', 'count', 'pick'])
    expect(levelPlan(4).ops).toEqual([MINUS])
    expect(levelPlan(5).ops).toEqual([PLUS, MINUS])
    expect(levelPlan(9).ops).toEqual([PLUS])
  })

  it('no sum twice in a level, and a mixed level has both signs half and half', () => {
    for (let run = 0; run < 40; run++) {
      for (const level of LEVELS) {
        const tasks = buildTasks(level)
        const keys = tasks.map(t => `${t.from}${t.op}${t.step}`)
        expect(new Set(keys).size).toBe(keys.length)
        if (levelPlan(level).ops.length === 2) expect(tasks.filter(t => t.op === PLUS).length).toBe(tasks.length / 2)
      }
    }
  })

  it('three hop bubbles: the answer among them, all of them hops that stay on the line', () => {
    for (let run = 0; run < 60; run++) {
      for (const level of [9, 10]) {
        for (const t of buildTasks(level)) {
          const c = countChoices(t)
          expect(c).toHaveLength(3)
          expect(c).toContain(t.step)
          expect(c[1]).toBe(c[0] + 1)
          expect(c[2]).toBe(c[0] + 2)
          for (const k of c) {
            const end = t.from + dirOf(t.op) * k
            expect(k).toBeGreaterThanOrEqual(1)
            expect(end).toBeGreaterThanOrEqual(0)
            expect(end).toBeLessThanOrEqual(TOP)
          }
        }
      }
    }
  })

  it('judges a landing', () => {
    const t = { op: PLUS, from: 4, step: 2, target: 6 }
    expect(judge(t, 6)).toBe('right')
    expect(judge(t, 7)).toBe('far')
    expect(judge(t, 5)).toBe('short')
    expect(judge(t, 3)).toBe('wrongway')
    expect(judge(t, 4)).toBe('none')
    const m = { op: MINUS, from: 7, step: 3, target: 4 }
    expect(judge(m, 3)).toBe('far')
    expect(judge(m, 5)).toBe('short')
    expect(judge(m, 8)).toBe('wrongway')
  })

  it('stars hang over free gaps; a hop flies over the gaps between its planets', () => {
    expect(gapsBetween(4, 6)).toEqual([4, 5])
    expect(gapsBetween(6, 4)).toEqual([4, 5])
    expect(freeGap([0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(9)
    expect(freeGap(Array.from({ length: TOP }, (_, i) => i))).toBe(null)
  })

  it('a new star hangs only where a sum still to come flies through', () => {
    const ahead = [{ op: PLUS, from: 3, step: 2, target: 5 }, { op: PLUS, from: 6, step: 1, target: 7 }]
    for (let i = 0; i < 200; i++) expect([3, 4, 6]).toContain(freeGap([], Math.random, ahead))
    expect(freeGap([3, 4, 6], Math.random, ahead)).toBe(null)
    for (let level = 1; level <= 10; level++) {
      const tasks = buildTasks(level)
      tasks.forEach((_, i) => {
        const g = freeGap([], Math.random, tasks.slice(i))
        expect(tasks.slice(i).some(t => gapsBetween(t.from, t.target).includes(g)), `level ${level}`).toBe(true)
      })
    }
  })

  it('bonus stars count only on the flight of a right answer, and only those on its way', () => {
    const t = { op: PLUS, from: 4, step: 2, target: 6 }
    expect(starsWon([4, 8], t, 6)).toEqual([4])
    expect(starsWon([4, 5], t, 6)).toEqual([4, 5])
    // a miss wins nothing: too far, too short, the wrong way
    expect(starsWon([4, 5, 6], t, 7)).toEqual([])
    expect(starsWon([4], t, 5)).toEqual([])
    expect(starsWon([3], t, 3)).toEqual([])
    const m = { op: MINUS, from: 7, step: 3, target: 4 }
    expect(starsWon([4, 6, 7], m, 4)).toEqual([4, 6])
    expect(starsWon([7], m, 8)).toEqual([])
  })

  it('the landing planet is said with the feedback, unless the hop has said it already', () => {
    // a flight in one go says only where it ended, always in the feedback's narration
    expect(landingLead('tap', false)).toBe(true)
    expect(landingLead('pick', false)).toBe(true)
    // a hop has said it, unless the tick was pressed while it was in the air
    expect(landingLead('hop', true)).toBe(false)
    expect(landingLead('count', true)).toBe(false)
    expect(landingLead('hop', false)).toBe(true)
    expect(landingLead('count', false)).toBe(true)
  })

  it('the tap levels never point at the answer before two misses', () => {
    expect(tapHelp('tap', false)).toBe('wave')
    expect(tapHelp('tap', true)).toBe('target')
    for (const mode of ['hop', 'count', 'pick']) expect(tapHelp(mode, false)).toBe(null)
  })

  it('every resident has a picture', () => {
    for (const r of RESIDENTS) expect(hasEmojiArt(r), r).toBe(true)
    expect(hasEmojiArt('⭐')).toBe(true)
  })
})

describe('Planeten-Hüpfer: the layout', () => {
  const SIZES = [[1024, 692], [390, 772], [844, 314], [360, 668], [768, 950], [1440, 824]]

  it('the line runs across when eleven planets fit, upright on a phone held upright', () => {
    expect(layout(1024, 692).vertical).toBe(false)
    expect(layout(844, 314).vertical).toBe(false)
    expect(layout(390, 772).vertical).toBe(true)
  })

  it('every planet, the rocket in the air and the buttons are on the screen; the cells are a finger wide', () => {
    for (const [w, h] of SIZES) {
      const L = layout(w, h)
      for (let n = 0; n <= TOP; n++) {
        const p = L.P(n)
        expect(p.x - L.pr, `${w}x${h} planet ${n}`).toBeGreaterThanOrEqual(0)
        expect(p.x + L.pr).toBeLessThanOrEqual(w)
        expect(p.y - L.pr).toBeGreaterThanOrEqual(0)
        expect(p.y + L.pr).toBeLessThanOrEqual(h)
      }
      // the rocket's nose at the top of a hop
      const q = hopPath(L, 4, 5), top = bow(q.a, q.c, q.b, 0.5)
      const nose = L.vertical ? { x: top.x + L.rh, y: top.y } : { x: top.x, y: top.y - L.rh }
      expect(nose.y, `${w}x${h} nose`).toBeGreaterThanOrEqual(0)
      expect(nose.x).toBeLessThanOrEqual(w)
      expect(L.controls.x + L.controls.w).toBeLessThanOrEqual(w)
      expect(L.controls.y + L.controls.h).toBeLessThanOrEqual(h)
      if (w >= 390 && h >= 314) {
        expect(L.cell, `${w}x${h} cell`).toBeGreaterThanOrEqual(62)
        expect(L.btn).toBeGreaterThanOrEqual(64)
      }
      // the moon of the finale, with the rocket standing on it, is on the screen
      expect(L.moon.y - L.moon.r - L.rh).toBeGreaterThanOrEqual(0)
      expect(L.moon.x + L.moon.r).toBeLessThanOrEqual(w)
    }
  })

  it('the star counter covers neither the sum nor the rocket and the dancers on the moon', () => {
    // the counter: a star of 36 px and two digits in a pill (components/play/Juice.jsx)
    const HUD_W = 100, HUD_H = 50
    const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
    for (const [w, h] of SIZES) {
      const L = layout(w, h)
      const box = c => ({ x: c.align === 'right' ? c.x - HUD_W : c.align === 'left' ? c.x : c.x - HUD_W / 2, y: c.y, w: HUD_W, h: HUD_H })
      let hud = box(L.hud)
      expect(hud.x, `${w}x${h} counter on screen`).toBeGreaterThanOrEqual(0)
      expect(hud.x + hud.w).toBeLessThanOrEqual(w)
      // during play: beside the sum on a short screen (it has the left half), below it on a phone held upright
      if (L.short) expect(hud.x, `${w}x${h} counter beside the sum`).toBeGreaterThanOrEqual(L.card.x + L.card.w)
      if (L.vertical) expect(hud.y).toBeGreaterThanOrEqual(L.card.y + L.card.h)
      // the finale (the sum is gone): the rocket stands upright on the top of the moon, the dancers round it
      hud = box(L.hudFinale)
      expect(hud.y + hud.h).toBeLessThanOrEqual(h)
      const { x, y, r } = L.moon
      const feet = { x, y: y - r * 0.8 }
      const rocket = { x: feet.x - L.rw / 2, y: feet.y - L.rh, w: L.rw, h: L.rh }
      expect(overlap(hud, rocket), `${w}x${h} counter over the rocket on the moon`).toBe(false)
      // and on its way there from any planet
      for (let n = 0; n <= TOP; n++) {
        const from = L.P(n, L.pr)
        const { to, c } = moonFlight(L, from)
        for (let t = 0; t <= 1; t += 0.05) {
          const p = bow(from, c, to, t)
          // the rocket turns about its feet as in toTheMoon: the box round its turned outline
          const deg = L.base - L.base * Math.min(1, t * 1.4) + 18 * Math.sin(Math.PI * t), a = (deg * Math.PI) / 180
          const pts = [[-L.rw / 2, 0], [L.rw / 2, 0], [-L.rw / 2, -L.rh], [L.rw / 2, -L.rh]]
            .map(([dx, dy]) => [p.x + dx * Math.cos(a) - dy * Math.sin(a), p.y + dx * Math.sin(a) + dy * Math.cos(a)])
          const xs = pts.map(q => q[0]), ys = pts.map(q => q[1])
          const box = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
          expect(overlap(hud, box), `${w}x${h} counter over the flying rocket from ${n} at t=${t.toFixed(2)}`).toBe(false)
        }
      }
      const size = clamp(r * 0.62, 34, 60)
      for (const deg of [-10, -37, -64, -116, -143, -170]) {
        const a = (deg * Math.PI) / 180
        const ex = x + Math.cos(a) * r * 0.8, ey = y + Math.sin(a) * r * 0.8
        expect(overlap(hud, { x: ex - size / 2, y: ey - size, w: size, h: size }), `${w}x${h} counter over a dancer at ${deg}°`).toBe(false)
      }
    }
  })

  it('the thrust button shows a flame, its round front the way of the hop', () => {
    for (const [op, way] of [[PLUS, 'right'], [MINUS, 'left'], [PLUS, 'up'], [MINUS, 'down']]) {
      const html = renderToStaticMarkup(createElement(ThrustButton, { op, way, size: 80, onPress: () => {} }))
      expect(html).toContain('data-flame-part="outer"')
      expect(html).toContain(`data-flame="${way}"`)
      // no white arrow any more
      expect(html).not.toContain('fill="#fff"')
    }
  })

  it('the rocket has a window for every passenger of a level', () => {
    for (const level of LEVELS) {
      const spots = windowSpots(levelPlan(level).count)
      expect(spots).toHaveLength(levelPlan(level).count)
      for (let i = 1; i < spots.length; i++) {
        for (let j = 0; j < i; j++) {
          const a = spots[i], b = spots[j]
          expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r)
        }
      }
    }
  })
})

describe('Planeten-Hüpfer: flying by hand, and hopping back', () => {
  // the frame loop of RocketMathGame (flyFrame), without the drawing: the
  // finger at `finger(t)`, 60 frames a second, let go after `seconds` where
  // the finger is then; `clip`: how long each planet's number plays. Returns
  // what the buttons would have made of it (arcs, where the rocket is, the
  // planets said and when, where it was when the finger let go)
  const fly = ({ start, finger, seconds, reach = { lo: 0, hi: TOP }, arcs = [], release = true, clip = 0 }) => {
    let x = start, cell = start, id = 0, t = 0, still = 0, ft = null, hush = -1
    const said = [], when = [], dt = 1 / 60
    const pass = (target, glide) => {
      let nx = flyStep(x, target, dt)
      if (glide && Math.abs(nx - target) < 0.04) nx = target
      nx = hushed(nx, cell, hush > t)
      const c = crossings(cell, nx)
      let from = cell
      for (const m of c.passed) { arcs = hopArcs(arcs, from, m, ++id); said.push(m); when.push(t); hush = t + clip; from = m }
      cell = c.cell; x = nx; t += dt
    }
    while (t < seconds) {
      const want = clamp(finger(t), reach.lo, reach.hi)
      still = ft != null && Math.abs(want - ft) < 0.03 ? still + dt : 0
      ft = want
      pass(holdTarget(want, still), false)
    }
    const atRelease = { x, cell, said: [...said] }
    let goal = null
    if (release) {
      goal = releaseAt(finger(t), reach)
      for (let i = 0; i < 1200 && x !== goal; i++) pass(goal, true)
    }
    return { x, cell, arcs, said, when, goal, atRelease }
  }

  it('follows the finger with a lag, and never faster than the top speed', () => {
    // one frame never moves more than FLY_MAX · dt, however far the finger is
    for (const dt of [1 / 120, 1 / 60, 1 / 30, 0.1, 5]) {
      const step = flyStep(0, 10, dt)
      expect(step).toBeLessThanOrEqual(FLY_MAX * Math.min(dt, 0.1) + 1e-9)
      expect(step).toBeGreaterThan(0)
    }
    // the finger at the end of the line at once: after a second the rocket is only FLY_MAX planets on
    const r = fly({ start: 0, finger: () => 10, seconds: 1, release: false })
    expect(r.x).toBeLessThanOrEqual(FLY_MAX + 1e-6)
    expect(r.x).toBeGreaterThan(FLY_MAX * 0.9)
    // a lag: a small way is not done in one frame
    expect(flyStep(3, 3.5, 1 / 60)).toBeLessThan(3.5)
    expect(flyStep(3, 3.5, 1 / 60)).toBeGreaterThan(3)
    // and it gets there
    let y = 3
    for (let i = 0; i < 180; i++) y = flyStep(y, 3.5, 1 / 60)
    expect(y).toBe(3.5)
  })

  it('every planet on the way is a hop, in order, said and counted as the buttons do', () => {
    const r = fly({ start: 2, finger: () => 9, seconds: 3.3, release: false })
    // 3.3 s at 1.25 planets a second: over 3, 4, 5, 6 (and on to 7), none skipped
    expect(r.said).toEqual([3, 4, 5, 6])
    expect(r.arcs.map(h => [h.a, h.b])).toEqual([[2, 3], [3, 4], [4, 5], [5, 6]])
    // a planet counts when the rocket is over it, not half way there
    expect(crossings(3, 3.6)).toEqual({ cell: 3, passed: [] })
    expect(crossings(3, 4)).toEqual({ cell: 4, passed: [4] })
    expect(crossings(3, 5.2)).toEqual({ cell: 5, passed: [4, 5] })
    expect(crossings(5, 4.4)).toEqual({ cell: 5, passed: [] })
    expect(crossings(5, 4)).toEqual({ cell: 4, passed: [4] })
  })

  it('letting go over a planet sets it down there; between planets it glides to the nearer one', () => {
    expect(releaseAt(4, { lo: 0, hi: TOP })).toBe(4)
    expect(releaseAt(4.4, { lo: 0, hi: TOP })).toBe(4)
    expect(releaseAt(4.6, { lo: 0, hi: TOP })).toBe(5)
    expect(releaseAt(-0.4, { lo: 0, hi: TOP })).toBe(0)
    expect(releaseAt(2.2, { lo: 3, hi: TOP })).toBe(3)
    // let go at 5.6 (coming from 3): it glides on to 6, and that is the third hop
    const r = fly({ start: 3, finger: () => 5.6, seconds: 4 })
    expect(r.goal).toBe(6)
    expect(r.x).toBe(6)
    expect(r.arcs).toHaveLength(3)
    expect(r.said).toEqual([4, 5, 6])
    // let go at 5.3: back to 5, two hops
    const s = fly({ start: 3, finger: () => 5.3, seconds: 4 })
    expect(s.x).toBe(5)
    expect(s.arcs.map(h => h.b)).toEqual([4, 5])
  })

  it('a quick swipe lands where the finger let go, not where the lagging rocket was (R1)', () => {
    // from 3, the finger at 7 at once and lifted there after 0.3 s
    const r = fly({ start: 3, finger: () => 7, seconds: 0.3 })
    expect(r.atRelease.x).toBeLessThan(4)          // the rocket had not even reached 4
    expect(r.goal).toBe(7)
    expect(r.x).toBe(7)
    // it flew on there, counting each planet on the way
    expect(r.said).toEqual([4, 5, 6, 7])
    expect(r.arcs.map(h => h.b)).toEqual([4, 5, 6, 7])
    expect(judge({ op: PLUS, from: 3, step: 4, target: 7 }, r.x)).toBe('right')
    // lifted past the end of what it may reach: the last planet it may
    expect(fly({ start: 3, finger: () => 14, seconds: 0.2 }).x).toBe(TOP)
    expect(fly({ start: 3, finger: () => -3, seconds: 0.2, reach: reachOf(levelPlan(1), { op: PLUS, from: 3 }) }).x).toBe(3)
  })

  it('held still over a planet, the rocket settles onto it and counts it before it is let go (R3)', () => {
    expect(holdTarget(6.8, 0)).toBe(6.8)
    expect(holdTarget(6.8, REST_S)).toBe(7)
    expect(holdTarget(6.3, REST_S + 1)).toBe(6)
    // the finger rests a little short of 7: 7 is counted while it is held
    const r = fly({ start: 3, finger: () => 6.8, seconds: 5, release: false })
    expect(r.x).toBe(7)
    expect(r.said).toEqual([4, 5, 6, 7])
    // held over the start: nothing to count
    expect(fly({ start: 3, finger: () => 3.2, seconds: 3, release: false }).said).toEqual([])
  })

  it('every planet number is heard to its end, however fast the finger (R5)', () => {
    // the clips are up to 0.8 s long; the finger at 0 at once, from 9
    const r = fly({ start: 9, finger: () => 0, seconds: 12, release: false, clip: 0.8 })
    expect(r.said).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 0])
    for (let i = 1; i < r.when.length; i++) expect(r.when[i] - r.when[i - 1]).toBeGreaterThanOrEqual(0.8)
    // the same after letting go: the glide waits for the numbers too
    const s = fly({ start: 2, finger: () => 8, seconds: 0.2, clip: 0.8 })
    expect(s.said).toEqual([3, 4, 5, 6, 7, 8])
    for (let i = 1; i < s.when.length; i++) expect(s.when[i] - s.when[i - 1]).toBeGreaterThanOrEqual(0.8)
    // and the top speed alone is slow: one planet takes longer than a short number
    expect(1 / FLY_MAX).toBeGreaterThanOrEqual(0.75)
    // the wait: just short of the next planet, never on to it
    expect(hushed(4.99, 4, true)).toBeCloseTo(4.97, 6)
    expect(hushed(3.01, 4, true)).toBeCloseTo(3.03, 6)
    expect(hushed(4.5, 4, true)).toBe(4.5)
    expect(hushed(5, 4, false)).toBe(5)
  })

  it('set down by hand is the answer anywhere but the start of the sum, also after a flame hop (R4)', () => {
    const t = { op: PLUS, from: 1, step: 1, target: 2 }
    expect(setDownAnswers(t, 2)).toBe(true)        // hopped to 2 with the flame, picked up and set down there
    expect(setDownAnswers(t, 3)).toBe(true)
    expect(setDownAnswers(t, 1)).toBe(false)       // back on the start: nothing was done
  })

  it('going back takes a hop off the count, by hand and with the buttons alike', () => {
    // with the buttons: 3 → 4 → 5 → 6, one too far, back to 5
    let arcs = []
    for (const [a, b] of [[3, 4], [4, 5], [5, 6], [6, 5]]) arcs = hopArcs(arcs, a, b, arcs.length + 1)
    expect(arcs.map(h => [h.a, h.b])).toEqual([[3, 4], [4, 5]])
    // by hand: on to 6, then back to 5 before letting go
    const r = fly({ start: 3, finger: t => (t < 3.2 ? 6 : 5), seconds: 5.5 })
    expect(r.x).toBe(5)
    expect(r.said).toEqual([4, 5, 6, 5])
    expect(r.arcs.map(h => [h.a, h.b])).toEqual([[3, 4], [4, 5]])
    // so the count, the badge and the verdict are those of the place: 3 + 2 is right at 5
    const t = { op: PLUS, from: 3, step: 2, target: 5 }
    expect(judge(t, r.x)).toBe('right')
    expect(r.arcs.length).toBe(Math.abs(r.x - t.from))
    // in a minus sum it is the other way round: forward takes a minus hop off
    let m = []
    for (const [a, b] of [[7, 6], [6, 5], [5, 4], [4, 5]]) m = hopArcs(m, a, b, m.length + 1)
    expect(m.map(h => [h.a, h.b])).toEqual([[7, 6], [6, 5]])
    expect(judge({ op: MINUS, from: 7, step: 2, target: 5 }, 5)).toBe('right')
  })

  it('a level with one sign cannot go behind the start; a mixed level can go the wrong way', () => {
    const plus = { op: PLUS, from: 3, step: 2, target: 5 }, minus = { op: MINUS, from: 7, step: 2, target: 5 }
    for (const level of [1, 2, 3, 9]) expect(reachOf(levelPlan(level), plus)).toEqual({ lo: 3, hi: TOP })
    expect(reachOf(levelPlan(4), minus)).toEqual({ lo: 0, hi: 7 })
    for (const level of [5, 6]) {
      expect(reachOf(levelPlan(level), plus)).toEqual({ lo: 0, hi: TOP })
      expect(reachOf(levelPlan(level), minus)).toEqual({ lo: 0, hi: TOP })
    }
    // by hand in level 1: the finger pulls behind the start, the rocket stays at 3, no hop
    const r = fly({ start: 3, finger: () => 0, seconds: 2, reach: reachOf(levelPlan(1), plus) })
    expect(r.x).toBe(3)
    expect(r.arcs).toEqual([])
    // in level 5 the same pull is the wrong way: hops back, and the verdict says so
    const w = fly({ start: 3, finger: () => 1, seconds: 3, reach: reachOf(levelPlan(5), plus) })
    expect(w.x).toBe(1)
    expect(w.arcs).toHaveLength(2)
    expect(judge(plus, w.x)).toBe('wrongway')
  })

  it('the finger is found on the line whichever way it runs, and the rocket held up stays on the screen', () => {
    for (const [w, h] of [[1024, 692], [390, 772], [844, 314]]) {
      const L = layout(w, h)
      for (const n of [0, 3.5, 10]) {
        expect(lineAt(L, L.P(n)), `${w}x${h}`).toBeCloseTo(n, 6)
        // off the line (above it, or to its side) it is the same place
        expect(lineAt(L, L.P(n, 80))).toBeCloseTo(n, 6)
      }
      // held up: the feet at pr + arcH + 27 (with the bob), nose up (or the way it flies)
      for (let n = 0; n <= TOP; n++) {
        const f = L.P(n, L.pr + L.arcH + 27)
        if (L.vertical) {
          expect(f.x + L.rw / 2, `${w}x${h} held rocket beside the column`).toBeLessThanOrEqual(L.card.x)
        } else {
          expect(f.y - L.rh, `${w}x${h} nose at ${n}`).toBeGreaterThanOrEqual(L.short ? 0 : L.card.y + L.card.h)
        }
      }
    }
  })

  it('flown by hand, the body is over the planet that counts, at every size and lean, and on the screen (R2)', () => {
    for (const [w, h] of [[1024, 692], [390, 772], [844, 314]]) {
      const L = layout(w, h)
      const hover = (L.arcH + 24) * 0.55
      for (const n of [0, 2.5, 4, 10]) {
        for (const lean of [-22, 0, 22]) {
          const deg = L.base + L.lean * lean
          const f = feetFor(L, n, L.pr + hover, deg)
          const a = (deg * Math.PI) / 180
          // the middle of the body, from the feet along the nose
          const mid = { x: f.x + (L.rh / 2) * Math.sin(a), y: f.y - (L.rh / 2) * Math.cos(a) }
          expect(lineAt(L, mid), `${w}x${h} n=${n} lean=${lean}`).toBeCloseTo(n, 6)
          // the four corners of the rocket stay on the screen
          for (const [u, v] of [[-L.rw / 2, 0], [L.rw / 2, 0], [-L.rw / 2, -L.rh], [L.rw / 2, -L.rh]]) {
            const cx = f.x + u * Math.cos(a) - v * Math.sin(a), cy = f.y + u * Math.sin(a) + v * Math.cos(a)
            expect(cx, `${w}x${h} n=${n} lean=${lean}`).toBeGreaterThanOrEqual(0)
            expect(cx).toBeLessThanOrEqual(w)
            expect(cy, `${w}x${h} n=${n} lean=${lean}`).toBeGreaterThanOrEqual(0)
            expect(cy).toBeLessThanOrEqual(h)
          }
        }
        // upright (no lean) the feet are where they stand on the planet, only higher
        const f = feetFor(L, n, L.pr, L.base)
        expect(f.x).toBeCloseTo(L.P(n, L.pr).x, 6)
        expect(f.y).toBeCloseTo(L.P(n, L.pr).y, 6)
      }
    }
  })

  it('in a level with one sign the button back is plain: no sign, its own name', () => {
    const html = renderToStaticMarkup(createElement(ThrustButton, { op: MINUS, way: 'left', size: 64, onPress: () => {}, undo: true, disabled: true }))
    expect(html).toContain('aria-label="Zurück hüpfen"')
    expect(html).toContain('data-undo')
    expect(html).toContain('aria-disabled="true"')
    expect(html).not.toContain('>−<')
    const full = renderToStaticMarkup(createElement(ThrustButton, { op: MINUS, way: 'left', size: 64, onPress: () => {} }))
    expect(full).toContain('aria-label="Rückwärts hüpfen"')
    expect(full).toContain('>−<')
  })
})

describe('Rechen-Rakete: free flight', () => {
  const sky = { hover: 30, top: 300 }
  it('the rocket rises and sinks with the finger, between the hover and the edge of the sky', () => {
    let h = 0
    for (let i = 0; i < 120; i++) h = flyHeight(h, 0, 1 / 60, sky)
    expect(h).toBeCloseTo(30, 0)                       // held still: a low hover
    for (let i = 0; i < 120; i++) h = flyHeight(h, 150, 1 / 60, sky)
    expect(h).toBeCloseTo(180, 0)                      // the finger went up 150 px
    for (let i = 0; i < 120; i++) h = flyHeight(h, 900, 1 / 60, sky)
    expect(h).toBeCloseTo(300, 0)                      // never out of the sky
    for (let i = 0; i < 120; i++) h = flyHeight(h, -500, 1 / 60, sky)
    expect(h).toBeCloseTo(30, 0)                       // never into the planets
  })
  it('follows with a little lag, not in one jump', () => {
    const h = flyHeight(30, 200, 1 / 60, sky)
    expect(h).toBeGreaterThan(30)
    expect(h).toBeLessThan(230)
  })
  it('let go, it comes down onto the planet and stops there', () => {
    let h = 200, frames = 0
    while (h > 0 && frames < 600) { h = flyDown(h, 1 / 60, 400); frames++ }
    expect(h).toBe(0)
    expect(frames).toBeGreaterThan(20)                 // a descent to see, about half a second
    expect(frames).toBeLessThan(60)
  })
})
