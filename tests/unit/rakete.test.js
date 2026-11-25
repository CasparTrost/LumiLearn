import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { TOP, PLUS, MINUS, levelPlan, buildTasks, countChoices, judge, gapsBetween, freeGap, RESIDENTS, dirOf, starsWon, landingLead, tapHelp } from '../../src/games/rakete/tasks.js'
import { layout, hopPath, bow, clamp, moonFlight } from '../../src/games/rakete/layout.js'
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
