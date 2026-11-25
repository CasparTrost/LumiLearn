import { describe, it, expect } from 'vitest'
import { THINGS, FLYERS, TOP, TASKS, BOUNCES, STACK_MAX, tasksFor, modeFor, verdict, sumSolution, isOrdered, lean } from '../../src/games/wippe/levels.js'
import { layoutFor, supplyLayout, stairLayout, onPlank, nearDrop, A } from '../../src/games/wippe/geometry.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'
import { animalSound } from '../../src/lib/animalSounds.js'
import { numberWord } from '../../src/lib/words.js'
import { MAX_LEVELS } from '../../src/AppContext.jsx'

// the same game every run
function seeded(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7 + 1)

describe('Wippe-Katapult: what is thrown, who flies', () => {
  it('has ten levels', () => {
    expect(MAX_LEVELS.weight).toBe(10)
  })

  it('has an illustrated picture for every thing, flyer and treat, and a voice for every flyer', () => {
    for (const [e, name] of THINGS) expect(hasEmojiArt(e), name).toBe(true)
    for (const f of FLYERS) {
      expect(hasEmojiArt(f.art), f.label).toBe(true)
      expect(hasEmojiArt(f.treat), f.treatLabel).toBe(true)
      expect(animalSound(f.art), f.label).toBeTruthy()
    }
    expect(hasEmojiArt('📦')).toBe(true)
  })

  it('gives every thing one weight, the same in every level', () => {
    const seen = new Map()
    for (let l = 1; l <= 9; l++) {
      for (const seed of SEEDS) {
        for (const t of tasksFor(l, seeded(seed))) {
          for (const th of t.things ?? []) {
            if (seen.has(th.e)) expect(th.w, th.label).toBe(seen.get(th.e))
            seen.set(th.e, th.w)
          }
        }
      }
    }
  })

  it('starts every level with the mouse and its cheese', () => {
    for (let l = 1; l <= 10; l++) expect(tasksFor(l, seeded(l))[0].flyer.art).toBe('🐭')
  })

  it('picks the mode by level', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(modeFor)).toEqual(['throw', 'throw', 'throw', 'throw', 'throw', 'throw', 'sum', 'sum', 'order', 'balance'])
  })
})

describe('Wippe-Katapult: levels 1–6, one thing reaches the treat', () => {
  it('has exactly one thing that sends the flyer to the treat, the others too light or too heavy', () => {
    for (let l = 1; l <= 6; l++) {
      for (const seed of SEEDS) {
        const tasks = tasksFor(l, seeded(seed))
        expect(tasks).toHaveLength(TASKS)
        for (const t of tasks) {
          expect(t.things.length).toBe(l <= 2 ? 2 : 3)
          expect(t.things.filter(th => th.w === t.target)).toHaveLength(1)
          expect(new Set(t.things.map(th => th.w)).size).toBe(t.things.length)
          expect(new Set(t.things.map(th => th.e)).size).toBe(t.things.length)
          expect(t.target).toBeLessThanOrEqual(TOP)
        }
      }
    }
  })

  it('wants the heavier of two in level 1, and not always the heaviest from level 3', () => {
    for (const seed of SEEDS) {
      for (const t of tasksFor(1, seeded(seed))) expect(t.target).toBe(Math.max(...t.things.map(th => th.w)))
    }
    for (const l of [3, 4, 5, 6]) {
      const notHeaviest = SEEDS.flatMap(seed => tasksFor(l, seeded(seed))).filter(t => t.target < Math.max(...t.things.map(th => th.w)))
      expect(notHeaviest.length, `level ${l}`).toBeGreaterThan(0)
    }
    // level 4 also wants the light one: the others overshoot
    expect(SEEDS.flatMap(seed => tasksFor(4, seeded(seed))).some(t => t.target <= BOUNCES)).toBe(true)
  })

  it('draws the things the same size from level 5', () => {
    for (const l of [5, 6]) for (const t of tasksFor(l, seeded(3))) for (const th of t.things) expect(th.scale).toBe(1)
  })

  it('judges a throw by the height it reaches', () => {
    expect(verdict(5, 5)).toBe('right')
    expect(verdict(2, 5)).toBe('low')
    expect(verdict(8, 5)).toBe('high')
  })
})

describe('Wippe-Katapult: levels 7–8, parcels add up', () => {
  it('never lets one parcel reach the treat alone, and always lets a few together', () => {
    for (const l of [7, 8]) {
      for (const seed of SEEDS) {
        for (const t of tasksFor(l, seeded(seed))) {
          expect(t.parcels).toHaveLength(4)
          expect(t.parcels.every(p => p.w !== t.target)).toBe(true)
          const sol = sumSolution(t.parcels, t.target)
          expect(sol, `level ${l}, ${t.target}: ${t.parcels.map(p => p.n)}`).toBeTruthy()
          expect(sol.length).toBeGreaterThanOrEqual(2)
          expect(sol.length).toBeLessThanOrEqual(STACK_MAX)
          expect(t.target).toBeLessThanOrEqual(TOP)
          expect(numberWord(t.target)).toBeTruthy()
          if (l === 7) expect(Math.max(...t.parcels.map(p => p.n))).toBeLessThanOrEqual(4)
        }
      }
    }
  })
})

describe('Wippe-Katapult: level 9, light to heavy', () => {
  it('puts three different weights on the stair, never already in order, that together reach the top', () => {
    for (const seed of SEEDS) {
      for (const t of tasksFor(9, seeded(seed))) {
        const ws = t.things.map(th => th.w)
        expect(new Set(ws).size).toBe(3)
        expect(ws.reduce((a, b) => a + b, 0)).toBe(TOP)
        expect(ws.every(w => w < TOP)).toBe(true)
        expect(t.target).toBe(TOP)
        const steps = t.steps.map(id => t.things.find(th => th.id === id))
        expect(isOrdered(steps)).toBe(false)
        expect(isOrdered([...steps].sort((a, b) => a.w - b.w))).toBe(true)
      }
    }
  })
})

describe('Wippe-Katapult: level 10, make it level', () => {
  it('needs a few blocks on the lighter side', () => {
    for (const seed of SEEDS) {
      for (const t of tasksFor(10, seeded(seed))) {
        expect(t.left).toBeLessThanOrEqual(9)
        expect(t.right).toBeGreaterThanOrEqual(1)
        expect(t.need).toBe(t.left - t.right)
        expect(t.need).toBeGreaterThanOrEqual(2)
        expect(t.need).toBeLessThanOrEqual(6)
        expect(lean(t.left, t.right)).toBe(-1)
        expect(lean(t.left, t.right + t.need)).toBe(0)
      }
    }
  })
})

describe('Wippe-Katapult: the stage at the three sizes', () => {
  // the stage's own px for a tablet, a phone upright, a phone sideways
  const SIZES = [[800, 539, true], [440, 869, false], [1110, 420, true]]
  for (const [W, H, wide] of SIZES) {
    it(`fits everything in ${W}×${H}`, () => {
      const g = layoutFor(W, H, wide)
      // the treat at the top step is below the top edge, the flyer's seat above the ground
      expect(g.yAt(TOP) - g.treat / 2).toBeGreaterThanOrEqual(0)
      expect(g.restY + g.FS / 2).toBeLessThanOrEqual(g.ground)
      expect(g.unit).toBeGreaterThanOrEqual(28)
      // the plank's ends stay on the screen
      for (const deg of [-A, A]) {
        const r = onPlank(g, deg, g.L), l = onPlank(g, deg, -g.L)
        expect(l.x).toBeGreaterThan(0)
        expect(r.x).toBeLessThan(W)
      }
      // things on the grass: inside the field, not under the plank
      const tip = onPlank(g, -A, g.L).x
      const { spots, button } = supplyLayout(g, [80, 90, 100, 86], true)
      for (const s of spots) {
        expect(s.x).toBeGreaterThan(0)
        expect(s.x).toBeLessThan(W)
        if (wide) expect(s.x - 50).toBeGreaterThan(tip - 10)
        else expect(s.y - 45).toBeGreaterThan(g.ground)
      }
      expect(button.x + 42).toBeLessThanOrEqual(W)
      // a drop over the raised end counts
      const d = g.dropAt(80)
      expect(nearDrop(g, d.x, d.y - 100, 80)).toBe(true)
      expect(nearDrop(g, d.x + g.L, d.y + 200, 80)).toBe(false)
      // the stair of level 9 stands in the supply
      for (const st of stairLayout(g, 80)) {
        expect(st.x - st.w / 2).toBeGreaterThanOrEqual(0)
        expect(st.x + st.w / 2).toBeLessThanOrEqual(W)
      }
      // the branch is on the screen
      expect(g.branch.x0).toBeGreaterThan(0)
      // level 10: both stumps on the screen
      const b = layoutFor(W, H, wide, 'balance')
      for (const s of b.stumps) {
        expect(s.x - s.w / 2).toBeGreaterThan(0)
        expect(s.x + s.w / 2).toBeLessThan(W)
      }
    })
  }
})
