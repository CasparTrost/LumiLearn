import { describe, it, expect } from 'vitest'
import { starsFor, result } from '../../src/lib/score.js'
import { cleanText } from '../../src/narrator.js'
import { genMaze, shortestTour, bfsDistance } from '../../src/games/maze/mazeGen.js'
import { generateQuestions } from '../../src/games/gameEngine.js'
import { MODULES, visibleModules, recommend } from '../../src/modules.js'

describe('stars', () => {
  it('rates by the share right on the first try', () => {
    expect(starsFor(10, 10)).toBe(3)
    expect(starsFor(7, 8)).toBe(3)    // 87.5 %
    expect(starsFor(6, 8)).toBe(2)    // 75 %
    expect(starsFor(4, 8)).toBe(1)
    expect(starsFor(0, 8)).toBe(1)    // finishing a level is never 0 stars
  })
  it('never reports more right than asked ("9 von 8")', () => {
    expect(result(9, 8)).toEqual({ score: 8, total: 8, stars: 3 })
    expect(result(-1, 8).score).toBe(0)
  })
})

describe('speech text', () => {
  it('drops pictures and picture tokens', () => {
    expect(cleanText('Der Tisch :px-tisch: 🍎').trim()).toBe('Der Tisch')
  })
  it('reads maths signs as words instead of dropping them', () => {
    expect(cleanText('3 + 4 = 7')).toMatch(/3 plus 4 ist 7/)
    expect(cleanText('5 − 2')).toMatch(/5 minus 2/)
    expect(cleanText('20 × größer')).toMatch(/mal/)
    expect(cleanText('50 km/h')).toMatch(/Kilometer pro Stunde/)
  })
})

describe('maze', () => {
  for (const [cols, rows] of [[7, 7], [11, 9], [15, 13]]) {
    it(`${cols}×${rows}: every potion and the exit can be reached`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const m = genMaze(cols, rows, seed)
        for (const p of m.potions) expect(bfsDistance(m.g, m.start, p)).toBeGreaterThan(0)
        expect(bfsDistance(m.g, m.start, m.exit)).toBeGreaterThan(0)
        const tour = shortestTour(m)
        expect(Number.isFinite(tour)).toBe(true)
        expect(tour).toBeGreaterThanOrEqual(bfsDistance(m.g, m.start, m.exit))
      }
    })
  }
})

describe('pattern park questions', () => {
  for (let level = 1; level <= 10; level++) {
    it(`level ${level}: 10 rounds, each answerable`, () => {
      for (let run = 0; run < 40; run++) {
        const qs = generateQuestions('patterns', level, 10)
        expect(qs).toHaveLength(10)
        for (const q of qs) {
          expect(new Set(q.options).size).toBe(q.options.length)          // no picture twice
          if (q.answer != null) expect(q.options).toContain(q.answer)
          else expect(q.fill.every(f => q.options.includes(f))).toBe(true) // build rounds
          // every answer can be said: by name, or by how many (growing rows)
          if (q.kind === 'grow') expect(q.counts).toHaveLength(4)
          else for (const e of q.options) expect(q.names[e], `name for ${e}`).toBeTruthy()
        }
      }
    })
  }
})

describe('game list', () => {
  it('has unique ids and all 25 games', () => {
    expect(new Set(MODULES.map(m => m.id)).size).toBe(MODULES.length)
    expect(MODULES.length).toBe(25)
  })
  it('never hides every game', () => {
    const all = MODULES.map(m => m.id)
    expect(visibleModules({ hiddenGames: all }).length).toBeGreaterThan(0)
    expect(visibleModules({ hiddenGames: all.slice(1) }).map(m => m.id)).toEqual([all[0]])
  })
  it('recommends only visible games', () => {
    const hidden = MODULES.slice(0, 20).map(m => m.id)
    for (let i = 0; i < 20; i++) {
      const picks = recommend({ profile: { age: 5, hiddenGames: hidden } })
      for (const p of picks) expect(hidden).not.toContain(p.mod.id)
    }
  })
})
