import { describe, it, expect } from 'vitest'
import { TOP, PLUS, MINUS, levelPlan, buildTasks, countChoices, judge, gapsBetween, freeGap, RESIDENTS, dirOf } from '../../src/games/rakete/tasks.js'
import { layout, hopPath, bow } from '../../src/games/rakete/layout.js'
import { windowSpots } from '../../src/games/rakete/parts.jsx'
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
