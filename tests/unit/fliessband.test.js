import { describe, it, expect } from 'vitest'
import { GROUPS, RUBBISH, LEVELS, planLevel, wordOf } from '../../src/games/sort/data.js'
import { layoutFor, aimAt, throwArc, arcAt, freeSpot, AIM_MIN } from '../../src/games/sort/layout.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'

// Sortier-Spaß: Fließband-Füttern (src/games/SortGame.jsx)

// a random source that always gives the same numbers
const seeded = seed => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

describe('what rides on the belt', () => {
  it('has a picture for every thing', () => {
    for (const [key, g] of Object.entries(GROUPS)) {
      for (const [art, name] of g.things) {
        expect(hasEmojiArt(art), `${key}: ${name} ${art}`).toBe(true)
        expect(name).toMatch(/^(der|die|das) \S/)
      }
    }
    for (const [art, name] of RUBBISH) expect(art.startsWith('rubbish:') || hasEmojiArt(art), name).toBe(true)
  })
  it('has nothing with an "it depends": no corn, no matryoshka, no clothes as rubbish', () => {
    const arts = Object.values(GROUPS).flatMap(g => g.things.map(t => t[0]))
    expect(arts).not.toContain('🌽')
    expect(arts).not.toContain('🪆')
    for (const [art] of RUBBISH) expect(['🧦', '👟', 'rubbish:schuh']).not.toContain(art)
    expect(RUBBISH.length).toBeGreaterThanOrEqual(Math.max(...LEVELS.map(l => l.rubbish ?? 0)))
  })
  it('draws big things big and small things small on the belt', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const plan = planLevel(7, seeded(seed))
      if (plan.targets[0].key !== 'gross') continue
      for (const t of plan.things) expect(t.size).toBe(plan.targets[t.to].key === 'klein' ? 0.5 : 1)
    }
    expect(planLevel(1, seeded(1)).things.every(t => t.size === 1)).toBe(true)
  })
  it('names nothing twice in a group', () => {
    for (const [key, g] of Object.entries(GROUPS)) expect(new Set(g.things.map(t => t[0])).size, key).toBe(g.things.length)
  })
  it('knows Lumi\'s word for most things', () => {
    const all = Object.values(GROUPS).flatMap(g => g.things.slice(g.signs ?? 3))
    const spoken = all.filter(t => wordOf(t[1]))
    expect(spoken.length / all.length).toBeGreaterThan(0.6)
    expect(wordOf('die Banane')?.src).toBe('audio/lumi/wort/banane.mp3')
    expect(wordOf('die Schildkröte')?.src).toBe('audio/lumi/wort/schildkroete.mp3')
    expect(wordOf('das Gibtesnicht')).toBe(null)
  })
})

describe('a level', () => {
  it('fills every monster exactly, with nothing shown on a sign and nothing twice', () => {
    for (let level = 1; level <= 10; level++) {
      for (let seed = 1; seed <= 40; seed++) {
        const plan = planLevel(level, seeded(seed * 7 + level))
        const cfg = LEVELS[level - 1]
        expect(plan.targets.length).toBeGreaterThanOrEqual(2)
        expect(plan.targets.length).toBeLessThanOrEqual(4)
        plan.targets.forEach((t, i) => {
          expect(plan.things.filter(x => x.to === i).length, `level ${level}: ${t.key}`).toBe(t.need)
          if (t.kind === 'monster') expect(t.sign.length).toBeGreaterThanOrEqual(2)
        })
        const arts = plan.things.map(t => t.art)
        expect(new Set(arts).size).toBe(arts.length)
        const signs = new Set(plan.targets.flatMap(t => t.sign))
        expect(arts.some(a => signs.has(a))).toBe(false)
        expect(new Set(plan.things.map(t => t.id)).size).toBe(plan.things.length)
        // the start shows two different places to go, and no rubbish yet
        expect(plan.things[0].to).not.toBe(plan.things[1].to)
        expect(plan.things[0].rubbish || plan.things[1].rubbish).toBe(false)
        expect(plan.things.filter(t => t.golden).length).toBe(cfg.golden)
        expect(plan.things.some(t => t.golden && t.rubbish)).toBe(false)
        expect(plan.things.filter(t => t.rubbish).length).toBe(cfg.rubbish ?? 0)
      }
    }
  })
  it('grows: more monsters, then a property, then the bin; the belt gets faster and fuller', () => {
    const count = level => planLevel(level, seeded(level)).targets.length
    expect([1, 2].map(count)).toEqual([2, 2])
    expect([3, 4].map(count)).toEqual([3, 3])
    expect([5, 6].map(count)).toEqual([4, 4])
    for (const level of [9, 10]) expect(planLevel(level, seeded(3)).targets.at(-1).kind).toBe('bin')
    for (let level = 1; level <= 8; level++) expect(planLevel(level, seeded(3)).targets.every(t => t.kind === 'monster')).toBe(true)
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].cross).toBeLessThan(LEVELS[i - 1].cross)
      expect(LEVELS[i].cap).toBeGreaterThanOrEqual(LEVELS[i - 1].cap)
    }
    expect(LEVELS[0].cap).toBe(2)
  })
  it('keeps to groups that exist and are big enough', () => {
    for (const cfg of LEVELS) for (const set of cfg.sets) for (const key of set) {
      const g = GROUPS[key]
      expect(g, key).toBeTruthy()
      expect(g.things.length - (g.signs ?? 3), key).toBeGreaterThanOrEqual(cfg.need)
    }
  })
  it('stays inside 1 to 10', () => {
    expect(planLevel(0).level).toBe(1)
    expect(planLevel(99).level).toBe(10)
  })
})

// the play areas of a tablet, a phone held upright and held sideways, and a few others
const AREAS = [[1024, 691], [390, 767], [844, 313], [360, 663], [768, 947], [1440, 823], [667, 298], [600, 600]]

describe('the stage', () => {
  it('fits everything, nothing overlapping, at every size', () => {
    for (const [W, H] of AREAS) for (const n of [2, 3, 4]) {
      const L = layoutFor(W, H, n), at = `${W}×${H}, ${n} targets`
      expect(L.targets.length, at).toBe(n)
      expect(L.S, at).toBeGreaterThanOrEqual(64)
      // the belt, its things and the pipe
      expect(L.belt.rideY - L.S / 2, at).toBeGreaterThanOrEqual(0)
      expect(L.pipe.top + L.pipe.h, at).toBeLessThanOrEqual(H)
      expect(L.pipe.left.x - L.pipe.mouthW / 2, at).toBeGreaterThanOrEqual(0)
      expect(L.pipe.right.x + L.pipe.mouthW / 2, at).toBeLessThanOrEqual(W)
      // two things side by side have room to ride
      expect(L.belt.x1 - L.belt.x0, at).toBeGreaterThanOrEqual(L.S * 2.4)
      L.targets.forEach((t, i) => {
        expect(t.x, at).toBeGreaterThanOrEqual(0)
        expect(t.x + t.w, at).toBeLessThanOrEqual(W)
        expect(t.y, at).toBeGreaterThanOrEqual(0)
        expect(t.y + t.h, at).toBeLessThanOrEqual(H)
        expect(t.w, at).toBeGreaterThanOrEqual(120)
        // not on the star counter
        const underHud = t.x + t.w > L.hud.x - 2 && t.y < L.hud.y + L.hud.h
        expect(underHud, at).toBe(false)
        // not on another target
        L.targets.forEach((o, j) => {
          if (j <= i) return
          const apart = t.x + t.w <= o.x || o.x + o.w <= t.x || t.y + t.h <= o.y || o.y + o.h <= t.y
          expect(apart, at).toBe(true)
        })
        // not on the belt or the pipe (on a small wide screen the things ride in front of the feet)
        const beltBand = [L.small && L.wide ? L.belt.top : L.belt.top - L.S + 3, L.pipe.top + L.pipe.h]
        expect(t.y + t.h <= beltBand[0] + 1 || t.y >= beltBand[1], at).toBe(true)
      })
    }
  })
  it('puts the belt between the rows on a phone held upright, in front of the row otherwise', () => {
    const tall = layoutFor(390, 767, 4)
    expect(tall.wide).toBe(false)
    expect(tall.targets.map(t => t.row)).toEqual([0, 0, 1, 1])
    expect(tall.targets[0].y + tall.targets[0].h).toBeLessThan(tall.belt.top)
    expect(tall.targets[2].y).toBeGreaterThan(tall.belt.top)
    expect(layoutFor(390, 767, 2).targets.map(t => t.row)).toEqual([0, 1])
    expect(layoutFor(390, 767, 3).targets.map(t => t.row)).toEqual([0, 0, 1])
    const wide = layoutFor(1024, 691, 4)
    expect(wide.wide).toBe(true)
    expect(new Set(wide.targets.map(t => t.y)).size).toBe(1)
  })
})

describe('aiming', () => {
  const mid = t => ({ x: t.x + t.w / 2, y: t.y + t.h * 0.6 })
  it('takes the target the finger rests on', () => {
    for (const [W, H] of AREAS) for (const n of [2, 3, 4]) {
      const L = layoutFor(W, H, n)
      const from = { x: (L.belt.x0 + L.belt.x1) / 2, y: L.belt.rideY }
      L.targets.forEach((t, i) => expect(aimAt(L, from, mid(t)), `${W}×${H}`).toBe(i))
    }
  })
  it('takes the target a fling points at, from anywhere on the belt', () => {
    for (const [W, H] of AREAS) for (const n of [2, 3, 4]) {
      const L = layoutFor(W, H, n)
      for (const u of [0, 0.25, 0.5, 0.75, 1]) {
        const from = { x: L.belt.x0 + (L.belt.x1 - L.belt.x0) * u, y: L.belt.rideY }
        L.targets.forEach((t, i) => {
          const to = mid(t), d = Math.hypot(to.x - from.x, to.y - from.y)
          // a short swipe, let go while moving
          const k = (L.S * 0.7) / d
          const finger = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k }
          expect(aimAt(L, from, finger, true), `${W}×${H}, ${n} targets, from ${u}, to ${i}`).toBe(i)
        })
      }
    }
  })
  it('is nothing for a finger that hardly moved, or points nowhere', () => {
    const L = layoutFor(1024, 691, 3)
    const from = { x: 500, y: L.belt.rideY }
    expect(aimAt(L, from, { x: from.x + L.S * AIM_MIN * 0.5, y: from.y - 2 })).toBe(-1)
    // along the belt, and down off the screen
    expect(aimAt(L, from, { x: from.x + 20, y: from.y + 150 })).toBe(-1)
    const tall = layoutFor(390, 767, 2)
    expect(aimAt(tall, { x: 195, y: tall.belt.rideY }, { x: 320, y: tall.belt.rideY })).toBe(-1)
    // up and down are never in doubt on a phone
    expect(aimAt(tall, { x: 120, y: tall.belt.rideY }, { x: 130, y: tall.belt.rideY - 60 }, true)).toBe(0)
    expect(aimAt(tall, { x: 120, y: tall.belt.rideY }, { x: 130, y: tall.belt.rideY + 60 }, true)).toBe(1)
  })
})

describe('flying and landing', () => {
  it('throws in a bow that stays on the stage', () => {
    for (const [W, H] of AREAS) {
      const L = layoutFor(W, H, 4)
      const from = { x: L.belt.x0, y: L.belt.rideY }
      for (const t of L.targets) {
        const c = throwArc(L, from, t.mouth)
        expect(arcAt(from, c, t.mouth, 0)).toEqual(from)
        const end = arcAt(from, c, t.mouth, 1)
        expect(end.x).toBeCloseTo(t.mouth.x)
        expect(end.y).toBeCloseTo(t.mouth.y)
        for (let k = 0; k <= 10; k++) expect(arcAt(from, c, t.mouth, k / 10).y).toBeGreaterThanOrEqual(0)
        // it rises above both ends on the way (unless the ceiling is in the way)
        expect(arcAt(from, c, t.mouth, 0.5).y).toBeLessThanOrEqual(Math.max(L.S * 0.3, Math.min(from.y, t.mouth.y)) + (from.y + t.mouth.y) / 2)
      }
    }
  })
  it('puts a thing back where there is room, never right at the end', () => {
    const L = layoutFor(1024, 691, 2)
    const x = freeSpot(L, 400, [400, 400 + L.S])
    expect(Math.abs(x - 400)).toBeGreaterThanOrEqual(L.S)
    expect(Math.abs(x - 400 - L.S)).toBeGreaterThanOrEqual(L.S)
    expect(freeSpot(L, 5000, [])).toBeLessThanOrEqual(L.belt.x1 - L.S)
    expect(freeSpot(L, -50, [])).toBe(L.belt.x0)
    expect(freeSpot(L, 300, [])).toBe(300)
  })
})
