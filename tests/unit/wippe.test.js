import { describe, it, expect } from 'vitest'
import { THINGS, CLASSES, SCALE, FLYERS, TOP, TASKS, LIGHT_W, FULL, STACK_MAX, tasksFor, modeFor, verdict, sumSolution, isOrdered, proveOrder, pairToCompare, sinks, balanceHint, classOf, lean } from '../../src/games/wippe/levels.js'
import { layoutFor, supplyLayout, stairLayout, onPlank, nearDrop, nearPan, A } from '../../src/games/wippe/geometry.js'
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

  it('keeps the weight classes believable: one weight per class, the classes apart, nothing that floats', () => {
    const order = ['light', 'small', 'middle', 'heavy']
    expect(Object.keys(CLASSES)).toEqual(order)
    const weights = order.map(cls => {
      const ws = new Set(CLASSES[cls].map(t => t[2]))
      // every thing of a class weighs the same, and the class knows its own things
      expect(ws.size, cls).toBe(1)
      for (const t of CLASSES[cls]) expect(classOf(t[2]), t[1]).toBe(cls)
      return [...ws][0]
    })
    // lighter class, smaller weight; the light ones are LIGHT_W
    for (let i = 1; i < weights.length; i++) expect(weights[i]).toBeGreaterThan(weights[i - 1])
    expect(weights[0]).toBe(LIGHT_W)
    // the classes clearly apart: each at least half as heavy again as the one before
    for (let i = 1; i < weights.length; i++) expect(weights[i] / weights[i - 1]).toBeGreaterThanOrEqual(1.5)
    // middle and heavy push the plank right down, light and small only part of the way
    expect(weights[0]).toBeLessThan(FULL)
    expect(weights[2]).toBeGreaterThanOrEqual(FULL)
    // every thing once, and nothing that floats or flutters instead of falling
    expect(new Set(THINGS.map(t => t[0])).size).toBe(THINGS.length)
    for (const e of ['🎈', '🪶', '🍃', '🫧', '🪁', '☁️']) expect(THINGS.some(t => t[0] === e), e).toBe(false)
    // the disputed ones of the second logic check are gone from where they were
    const named = name => THINGS.find(t => t[1] === name)
    for (const gone of ['Kokosnuss', 'Teddy', 'Banane', 'Hammer']) expect(named(gone), gone).toBeUndefined()
    expect(named('Erdbeere')[2]).toBeLessThan(named('Apfel')[2])
  })

  it('keeps the small class clearly between light and middle (third logic check, N9)', () => {
    const named = name => THINGS.find(t => t[1] === name)
    // a tomato weighs like a potato, a lemon nearly like an orange: not "small"
    for (const gone of ['Tomate', 'Zitrone']) expect(CLASSES.small.some(t => t[1] === gone), gone).toBe(false)
    expect(CLASSES.small.map(t => t[1]).sort()).toEqual(['Ei', 'Kiwi', 'Knoblauch', 'Muffin'])
    // the shell looked like a snail's house: gone, a biscuit instead
    expect(THINGS.some(t => t[0] === '🐚')).toBe(false)
    expect(named('Keks')[2]).toBe(LIGHT_W)
  })

  it('draws the things bigger the heavier they are in levels 1–4, an apple clearly smaller than a pumpkin', () => {
    expect(SCALE.light).toBeLessThan(SCALE.small)
    expect(SCALE.small).toBeLessThan(SCALE.middle)
    expect(SCALE.middle).toBeLessThan(SCALE.heavy)
    expect(SCALE.middle / SCALE.heavy).toBeLessThanOrEqual(0.75)
    for (let l = 1; l <= 4; l++) {
      for (const seed of SEEDS) {
        for (const t of tasksFor(l, seeded(seed))) {
          const bySize = [...t.things].sort((a, b) => a.scale - b.scale).map(th => th.w)
          expect(bySize).toEqual([...bySize].sort((a, b) => a - b))
        }
      }
    }
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
    expect(SEEDS.flatMap(seed => tasksFor(4, seeded(seed))).some(t => t.target <= LIGHT_W)).toBe(true)
  })

  it('draws a light, a middle and a heavy thing the same size from level 5', () => {
    for (const l of [5, 6]) {
      for (const seed of SEEDS) {
        for (const t of tasksFor(l, seeded(seed))) {
          for (const th of t.things) expect(th.scale).toBe(1)
          expect(t.things.map(th => classOf(th.w)).sort()).toEqual(['heavy', 'light', 'middle'])
        }
      }
    }
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

describe('Wippe-Katapult: level 9, light to heavy on the balance', () => {
  const th = (id, w) => ({ id, w })
  const light = th('l', 2), small = th('s', 3), middle = th('m', 5)

  it('puts a light, a small and a middle thing on the stair, never already in order, and throws nothing at a treat', () => {
    for (const seed of SEEDS) {
      for (const t of tasksFor(9, seeded(seed))) {
        expect(t.things.map(x => classOf(x.w)).sort()).toEqual(['light', 'middle', 'small'])
        // all drawn the same size: the picture neither gives the order away nor contradicts it
        for (const x of t.things) expect(x.scale).toBe(1)
        expect(t.treats).toBeUndefined()
        expect(t.target).toBeUndefined()
        const steps = t.steps.map(id => t.things.find(x => x.id === id))
        expect(isOrdered(steps)).toBe(false)
        expect(isOrdered([...steps].sort((a, b) => a.w - b.w))).toBe(true)
      }
    }
  })

  it('lets the heavier end of the seesaw go down', () => {
    expect(sinks(light, middle)).toBe(1)
    expect(sinks(middle, light)).toBe(-1)
    expect(sinks(small, null)).toBe(-1)
    expect(sinks(null, small)).toBe(1)
    expect(sinks(null, null)).toBe(0)
  })

  it('accepts the tick only for light to heavy, proving it neighbour against neighbour', () => {
    const ok = proveOrder([light, small, middle])
    expect(ok.ok).toBe(true)
    expect(ok.wrong).toBe(-1)
    expect(ok.pairs.map(p => [p.a, p.b, p.sinks])).toEqual([['l', 's', 1], ['s', 'm', 1]])
    const perms = l => (l.length <= 1 ? [l] : l.flatMap((x, i) => perms([...l.slice(0, i), ...l.slice(i + 1)]).map(p => [x, ...p])))
    for (const p of perms([light, small, middle])) {
      const name = p.map(x => x.id).join('')
      const proof = proveOrder(p)
      expect(proof.ok, name).toBe(name === 'lsm')
      // every pair before the wrong one sinks to the right; the wrong one tips the other way and ends the proof
      if (!proof.ok) {
        expect(proof.pairs.at(-1).sinks, name).toBe(-1)
        expect(proof.pairs.slice(0, -1).every(q => q.sinks === 1), name).toBe(true)
      }
    }
  })

  it('marks the first pair that tips the wrong way, and the help weighs exactly that pair', () => {
    // heavy at the bottom: the first pair is wrong
    expect(proveOrder([middle, light, small]).wrong).toBe(0)
    expect(pairToCompare([middle, light, small])).toEqual(['m', 'l'])
    // the first pair right, the second wrong
    expect(proveOrder([light, middle, small]).wrong).toBe(1)
    expect(pairToCompare([light, middle, small])).toEqual(['m', 's'])
    expect(proveOrder([small, middle, light]).wrong).toBe(1)
    // in order: nothing to compare, the tick
    expect(pairToCompare([light, small, middle])).toBeNull()
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

  it('shows the next right move after two misses: one off, one on, or the tick', () => {
    expect(balanceHint(5, 3)).toBe('take')
    expect(balanceHint(4, 3)).toBe('take')
    expect(balanceHint(1, 3)).toBe('add')
    expect(balanceHint(0, 3)).toBe('add')
    expect(balanceHint(3, 3)).toBe('done')
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
      // level 9: a balance with room for the animal on its left, a thing on each end on the screen
      const o = layoutFor(W, H, wide, 'order')
      expect(o.watch.x - o.FS / 2).toBeGreaterThanOrEqual(0)
      for (const deg of [-A, 0, A]) {
        const l = onPlank(o, deg, -o.L), r = onPlank(o, deg, o.L)
        expect(l.x).toBeGreaterThan(o.watch.x + o.FS / 2 - 10)
        expect(r.x).toBeLessThan(W)
        expect(onPlank(o, deg, o.load).x + o.thing / 2).toBeLessThan(W)
        expect(Math.max(l.y, r.y)).toBeLessThanOrEqual(o.ground)
      }
      for (const side of [-1, 1]) {
        const p = onPlank(o, A * side, side * o.load, 40)
        expect(nearPan(o, A * side, p.x, p.y - 10, 80)).toBe(side)
      }
      expect(nearPan(o, 0, o.px, o.ground + 200, 80)).toBe(0)
      // level 10: both stumps on the screen
      const b = layoutFor(W, H, wide, 'balance')
      for (const s of b.stumps) {
        expect(s.x - s.w / 2).toBeGreaterThan(0)
        expect(s.x + s.w / 2).toBeLessThan(W)
      }
    })
  }
})
