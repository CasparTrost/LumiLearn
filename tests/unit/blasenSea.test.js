import { describe, it, expect } from 'vitest'
import { bubbleSizes, giantSize, seaCount, spawnRound, makeGiant, MIN_BUBBLE } from '../../src/games/blasen/sea.js'

// The seas as they are on screen (measured in the browser)
const SEAS = { tablet: [780, 600], phone: [374, 490], sideways: [600, 230] }
const dots = { maxNum: 6, count: 9, minT: 2, maxT: 4, dots: true }
const numerals = { maxNum: 40, count: 15, minT: 3, maxT: 6 }

describe('Blasen-Blitz: the sea', () => {
  it('never makes a bubble smaller than a fingertip', () => {
    for (const [W, H] of Object.values(SEAS)) {
      for (const cfg of [dots, numerals]) {
        expect(bubbleSizes(W, H, cfg.dots).lo).toBeGreaterThanOrEqual(MIN_BUBBLE)
        for (const b of spawnRound(5, cfg, W, H)) expect(b.size).toBeGreaterThanOrEqual(MIN_BUBBLE)
      }
    }
  })

  it('puts no more bubbles into a sea than it carries', () => {
    const [W, H] = SEAS.sideways
    // a phone held sideways: about eight, not fifteen
    expect(seaCount(numerals, W, H)).toBeLessThanOrEqual(9)
    // with the giant it takes even fewer, but enough to choose from
    expect(seaCount(numerals, W, H, { giant: true })).toBeLessThan(seaCount(numerals, W, H) + 1)
    expect(seaCount(numerals, W, H, { giant: true })).toBeGreaterThanOrEqual(numerals.maxT + 2)
    // a tablet keeps the level's full number
    expect(seaCount(numerals, ...SEAS.tablet)).toBe(numerals.count)
  })

  it('always leaves at least two bubbles that are not wished for', () => {
    for (let i = 0; i < 200; i++) {
      const list = spawnRound(7, numerals, ...SEAS.sideways, { giant: true })
      expect(list.filter(b => b.value !== 7).length).toBeGreaterThanOrEqual(2)
      expect(list.filter(b => b.value === 7).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('fills a party sea with star bubbles only', () => {
    const list = spawnRound(0, { ...dots, count: 14, maxNum: 0 }, ...SEAS.phone, { all: true })
    expect(list.length).toBeGreaterThan(2)
    expect(list.every(b => b.value === 0)).toBe(true)
  })
})

describe('Blasen-Blitz: the giant bubble', () => {
  it('is big, but leaves room in a small sea', () => {
    expect(giantSize(...SEAS.tablet)).toBe(150)
    expect(giantSize(...SEAS.sideways)).toBeLessThanOrEqual(Math.round(0.55 * SEAS.sideways[1]))
  })

  it('shows a sum of two dice faces that adds up to its value', () => {
    for (let t = 2; t <= 6; t++) {
      for (const wished of [true, false]) {
        const g = makeGiant(t, dots, wished)
        expect(g.parts[0] + g.parts[1]).toBe(g.value)
        expect(g.parts.every(n => n >= 1 && n <= 6)).toBe(true)
        expect(g.value === t).toBe(wished)
      }
    }
  })

  it('is a near miss when not wished for, a plain number in the numeral levels', () => {
    for (let i = 0; i < 100; i++) {
      const g = makeGiant(12, numerals, false)
      expect(g.value).not.toBe(12)
      expect(Math.abs(g.value - 12) <= 1 || g.value === 21).toBe(true)
      expect(g.parts).toBe(null)
    }
  })
})
