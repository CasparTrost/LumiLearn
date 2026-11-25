import { describe, it, expect } from 'vitest'
import { levelRules, buildRounds, makeDistractor } from '../../src/games/ShapeBuildGame.jsx'

describe('Formen-Werkstatt levels', () => {
  it('every level brings something new: no two levels alike', () => {
    const rules = Array.from({ length: 10 }, (_, i) => JSON.stringify(levelRules(i + 1)))
    expect(new Set(rules).size).toBe(10)
  })

  it("the level's new figures are really there", () => {
    for (let run = 0; run < 40; run++) {
      const parts = level => buildRounds(level).map(f => f.parts.length)
      expect(Math.max(...parts(1))).toBe(2)
      expect(Math.max(...parts(3))).toBe(3)                   // three parts are new
      expect(Math.max(...parts(5))).toBeGreaterThanOrEqual(4) // the big figures are new
      expect(Math.min(...parts(10))).toBeGreaterThanOrEqual(3)
    }
  })

  it('never brings the same figure twice in a row', () => {
    for (let level = 1; level <= 10; level++) {
      for (let run = 0; run < 40; run++) {
        const r = buildRounds(level)
        // six wishes; the last level has one for each of its big figures, none twice
        if (level < 10) expect(r).toHaveLength(6)
        else expect(new Set(r.map(f => f.name)).size, 'level 10').toBe(r.length)
        expect(r.length).toBeGreaterThanOrEqual(5)
        r.forEach((f, i) => { if (i) expect(f.name, `level ${level}`).not.toBe(r[i - 1].name) })
      }
    }
  })

  it('a piece too many fits nowhere, and "near" ones are a shape of the figure in another size', () => {
    for (let level = 2; level <= 10; level++) {
      for (const fig of buildRounds(level)) {
        for (let run = 0; run < 10; run++) {
          const extra = makeDistractor(fig, levelRules(level).extra)
          expect(fig.parts.some(p => p.shape === extra.shape && p.w === extra.w && p.h === extra.h)).toBe(false)
          for (const p of fig.parts.filter(q => q.shape === extra.shape)) {
            const close = Math.abs(extra.w / p.w - 1) < 0.25 && Math.abs(extra.h / p.h - 1) < 0.25
            expect(close, `${fig.name}: ${extra.shape} ${extra.w}x${extra.h}`).toBe(false)
          }
        }
      }
    }
    const house = buildRounds(1).find(f => f.name === 'Haus') ?? { parts: [{ shape: 'triangle', w: 56, h: 28 }, { shape: 'square', w: 40, h: 40 }] }
    const near = makeDistractor(house, 'near')
    expect(['triangle', 'square']).toContain(near.shape)
  })
})
