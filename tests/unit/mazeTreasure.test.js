import { describe, it, expect } from 'vitest'
import { genMaze, shortestTour, bfsDistance } from '../../src/games/maze/mazeGen.js'
import { coinSpots, bestTour } from '../../src/games/maze/treasure.js'
import { initState, mazeReducer } from '../../src/games/maze/mazeReducer.js'

// The sizes of the ten levels: 11, 13, 15 and 19 cells, patrols of 5 to 7
const KINDS = [[11, 5], [13, 5], [15, 6], [19, 7]]
const mazes = KINDS.flatMap(([n, patrol]) => Array.from({ length: 40 }, (_, i) => genMaze(n, n, 1000 + i * 7919, patrol)))
const key = p => `${p.x},${p.y}`

describe('Lumi-Labyrinth: the coins', () => {
  it('lays three coins in every maze, on open floor, apart from everything else', () => {
    for (const m of mazes) {
      const coins = coinSpots(m)
      expect(coins.length).toBe(3)
      const taken = new Set([m.start, m.exit, ...m.potions, ...m.dragonWps].map(key))
      for (const c of coins) {
        expect(m.g[c.y][c.x]).toBe(0)
        expect(taken.has(key(c))).toBe(false)
      }
      expect(new Set(coins.map(key)).size).toBe(coins.length)
    }
  })

  it('never hides a coin where only the gate leads (stepping on it ends the level)', () => {
    for (const m of mazes) {
      const closed = m.g.map((row, y) => row.map((v, x) => (x === m.exit.x && y === m.exit.y ? 1 : v)))
      for (const c of coinSpots(m)) expect(bfsDistance(closed, m.start, c)).toBeLessThan(999)
    }
  })

  it('makes the rich way a real choice: all coins cost the crown for the short way, mostly', () => {
    let rich = 0
    for (const m of mazes) {
      const short = shortestTour(m)
      const all = bestTour(m, [...m.potions, ...coinSpots(m)]).steps
      expect(all).toBeGreaterThanOrEqual(short)
      if (all > short * 1.3) rich++   // SHORT_WAY in MazeGame.jsx
    }
    expect(rich / mazes.length).toBeGreaterThan(0.8)
  })

  it('finds the same shortest tour as the old count', () => {
    for (const m of mazes.slice(0, 30)) expect(bestTour(m, m.potions).steps).toBe(shortestTour(m))
  })
})

describe('Lumi-Labyrinth: the dragon guards its path', () => {
  it('never walks onto a Lumi who stands still', () => {
    const m = genMaze(13, 13, 4242, 5)
    const s = { ...initState(m), pos: { ...m.dragonWps[2] } }
    // its step onto Lumi is refused: it stays where it was
    const after = mazeReducer(s, { type: 'DRAGON_STEP', pos: m.dragonWps[2], now: 0 })
    expect(after).toBe(s)
    // a step elsewhere is taken
    expect(mazeReducer(s, { type: 'DRAGON_STEP', pos: m.dragonWps[1], now: 0 }).dragon).toEqual(m.dragonWps[1])
  })
})

describe('Lumi-Labyrinth: the dragon never blocks the way', () => {
  it('lets every potion and the gate be reached without setting foot on the patrol', () => {
    for (const m of mazes) {
      const closed = m.g.map((row, y) => row.map((v, x) => (m.dragonWps.some(p => p.x === x && p.y === y) ? 1 : v)))
      for (const p of [...m.potions, m.exit]) expect(bfsDistance(closed, m.start, p)).toBeLessThan(999)
    }
  })
})
