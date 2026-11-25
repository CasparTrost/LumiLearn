import { describe, it, expect } from 'vitest'
import { pluckFreq } from '../../src/sfx.js'
import {
  STREAK_MILESTONES, isStreakMilestone, flamesFor, NOTE_STEPS, noteStepFor, arcControl, arcPoint,
} from '../../src/components/play/Juice.jsx'

const C5 = 523.25
const semitones = f => 12 * Math.log2(f / C5)

describe('streak', () => {
  it('shows the flame at three, five and eight in a row, and only then', () => {
    expect(STREAK_MILESTONES).toEqual([3, 5, 8])
    const shown = Array.from({ length: 20 }, (_, i) => i + 1).filter(isStreakMilestone)
    expect(shown).toEqual([3, 5, 8])
    expect(isStreakMilestone(0)).toBe(false)
  })
  it('shows more flames, never a number, for a longer streak', () => {
    expect(STREAK_MILESTONES.map(flamesFor)).toEqual([1, 2, 3])
  })
})

describe('the note of a hit', () => {
  it('climbs one step per hit in a row and stays on the top step', () => {
    expect(noteStepFor(1)).toBe(0)
    expect(noteStepFor(2)).toBe(1)
    expect(noteStepFor(NOTE_STEPS)).toBe(NOTE_STEPS - 1)
    expect(noteStepFor(NOTE_STEPS + 1)).toBe(NOTE_STEPS - 1)
    expect(noteStepFor(500)).toBe(NOTE_STEPS - 1)
    // a hit always has a note, whatever the game passes
    expect(noteStepFor(0)).toBe(0)
    expect(noteStepFor(-3)).toBe(0)
  })
  it('never goes down while the streak grows', () => {
    for (let s = 1; s < 30; s++) expect(pluckFreq(noteStepFor(s + 1))).toBeGreaterThanOrEqual(pluckFreq(noteStepFor(s)))
  })
})

describe('sfx.pluck scale', () => {
  it('is a major pentatonic scale from C5', () => {
    const got = Array.from({ length: 8 }, (_, step) => Math.round(semitones(pluckFreq(step))))
    // C D E G A, then the same an octave up
    expect(got).toEqual([0, 2, 4, 7, 9, 12, 14, 16])
    expect(pluckFreq(0)).toBeCloseTo(C5, 2)
    expect(pluckFreq(5)).toBeCloseTo(C5 * 2, 2)
  })
  it('rises strictly, step by step, up to its top note', () => {
    for (let step = 0; step < 10; step++) expect(pluckFreq(step + 1)).toBeGreaterThan(pluckFreq(step))
    expect(pluckFreq(10)).toBeCloseTo(C5 * 4, 2)
  })
  it('never squeaks and never fails on odd input', () => {
    expect(pluckFreq(99)).toBe(pluckFreq(10))
    expect(pluckFreq(-1)).toBe(pluckFreq(0))
    expect(pluckFreq(2.9)).toBe(pluckFreq(2))
    expect(pluckFreq(undefined)).toBe(pluckFreq(0))
    expect(pluckFreq(NaN)).toBe(pluckFreq(0))
  })
  it('keeps a whole streak within the plucks that still sound round', () => {
    expect(pluckFreq(noteStepFor(1000))).toBeLessThan(1400)
  })
})

describe("a star's way to the counter", () => {
  const from = { x: 100, y: 500 }, to = { x: 900, y: 40 }
  it('starts at the hit and ends at the counter', () => {
    const c = arcControl(from, to)
    expect(arcPoint(from, c, to, 0)).toEqual(from)
    expect(arcPoint(from, c, to, 1)).toEqual(to)
  })
  it('bows upwards, whichever way it flies', () => {
    for (const [a, b] of [[from, to], [to, from], [{ x: 0, y: 300 }, { x: 600, y: 300 }], [{ x: 600, y: 300 }, { x: 0, y: 300 }]]) {
      const c = arcControl(a, b)
      const mid = arcPoint(a, c, b, 0.5)
      expect(mid.y).toBeLessThan((a.y + b.y) / 2)
    }
  })
  it('bows by a bounded amount, and has a bow even for the shortest way', () => {
    const far = arcControl({ x: 0, y: 0 }, { x: 4000, y: 0 })
    expect(Math.abs(far.y)).toBeLessThanOrEqual(190)
    const near = arcControl({ x: 10, y: 10 }, { x: 12, y: 10 })
    expect(Math.abs(near.y - 10)).toBeGreaterThanOrEqual(40)
    const same = arcControl({ x: 5, y: 5 }, { x: 5, y: 5 })
    expect(Number.isFinite(same.x) && Number.isFinite(same.y)).toBe(true)
  })
})
