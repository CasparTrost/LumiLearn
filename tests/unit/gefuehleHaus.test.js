import { describe, it, expect } from 'vitest'
import { FEELINGS, TOO_CLOSE, levelConfig, pickRounds, step, allDown, GRIDS, ANIMALS } from '../../src/games/gefuehle/rounds.js'
import { feelingWord } from '../../src/lib/words.js'

// a random source that repeats, so a failing run can be played again
function seeded(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

// plays `ms` of a round without any tap and notes what was at the windows
function watch(level, target, ms, seed = 1) {
  const cfg = levelConfig(level), rnd = seeded(seed), mem = {}
  let slots = Array(cfg.windows).fill(null)
  const log = []
  for (let now = 100; now <= ms; now += 100) {
    slots = step(slots, mem, { now, target, cfg, rnd })
    const up = slots.filter(c => c?.state === 'up')
    log.push({ now, up, right: up.filter(c => c.feeling === target) })
  }
  return { cfg, log, slots }
}

describe('Gefühle-Haus', () => {
  it('every feeling of the game has its recorded word', () => {
    expect(FEELINGS.length).toBe(10)
    for (const f of FEELINGS) expect(feelingWord(f), f).toBeTruthy()
  })

  it('the levels grow: more feelings, more windows, less time', () => {
    const cfgs = Array.from({ length: 10 }, (_, i) => levelConfig(i + 1))
    expect(cfgs[0].feelings).toEqual(['Glücklich', 'Traurig', 'Wütend'])
    expect(cfgs[0].windows).toBe(4)
    expect(cfgs[9].feelings.length).toBe(10)
    expect(cfgs[9].windows).toBe(9)
    expect(cfgs[9].hideFace).toBe(true)
    expect(cfgs[7].hideFace).toBe(false)
    for (let i = 1; i < 10; i++) {
      expect(cfgs[i].stay).toBeLessThan(cfgs[i - 1].stay)
      expect(cfgs[i].feelings.length).toBeGreaterThanOrEqual(cfgs[i - 1].feelings.length)
      expect(cfgs[i].windows).toBeGreaterThanOrEqual(cfgs[i - 1].windows)
    }
    for (const c of cfgs) {
      expect(GRIDS[c.windows]).toBeTruthy()
      expect(c.maxUp).toBeLessThan(c.windows)   // a window is always free for the next right one
      expect(c.need).toBeGreaterThanOrEqual(4)
      expect(c.need).toBeLessThanOrEqual(6)
    }
  })

  it('a level has five or six rounds, the new feelings among them, none twice in a row', () => {
    for (let level = 1; level <= 10; level++) {
      const cfg = levelConfig(level)
      for (let seed = 1; seed <= 30; seed++) {
        const rounds = pickRounds(cfg, seeded(seed))
        expect(rounds.length).toBe(cfg.rounds)
        expect([5, 6]).toContain(rounds.length)
        for (const f of rounds) expect(cfg.feelings).toContain(f)
        for (const f of cfg.fresh) expect(rounds, `level ${level}`).toContain(f)
        for (let i = 1; i < rounds.length; i++) expect(rounds[i]).not.toBe(rounds[i - 1])
        if (cfg.feelings.length >= cfg.rounds) expect(new Set(rounds).size).toBe(rounds.length)
      }
    }
  })

  it('a right face is at a window all the time, and others next to it', () => {
    for (const level of [1, 3, 5, 7, 10]) {
      for (let seed = 1; seed <= 12; seed++) {
        const cfg = levelConfig(level)
        const target = cfg.feelings[seed % cfg.feelings.length]
        const { log } = watch(level, target, 40000, seed)
        // the first one up is a right one
        expect(log[0].right.length, `level ${level}`).toBe(1)
        for (const t of log) {
          expect(t.right.length, `level ${level}, seed ${seed}, ${t.now} ms`).toBeGreaterThanOrEqual(1)
          expect(t.up.length).toBeLessThanOrEqual(cfg.maxUp + 1)
        }
        // after the start, a child who taps without looking is wrong at least as often as right
        const later = log.filter(t => t.now > 4000)
        const share = later.reduce((n, t) => n + t.right.length / t.up.length, 0) / later.length
        expect(share, `level ${level}`).toBeLessThan(0.62)
        const lone = later.filter(t => t.up.length < 2).length / later.length
        expect(lone, `level ${level}: alone at the windows`).toBeLessThan(0.1)
      }
    }
  })

  it('who is at the windows: different animals, only feelings of the level', () => {
    const { cfg, log } = watch(10, 'Stolz', 30000, 7)
    for (const t of log) {
      const animals = t.up.map(c => c.animal)
      expect(new Set(animals).size).toBe(animals.length)
      for (const c of t.up) {
        expect(cfg.feelings).toContain(c.feeling)
        expect(c.animal).toBeLessThan(ANIMALS)
        expect(c.variant).toBeLessThan(cfg.variants)
      }
    }
    // level 1 keeps to one face per feeling
    expect(watch(1, 'Traurig', 20000).log.every(t => t.up.every(c => c.variant === 0))).toBe(true)
  })

  it('no face that can be argued for is a wrong answer: happy, proud and excited keep apart', () => {
    expect(TOO_CLOSE['Glücklich']).toEqual(['Stolz', 'Aufgeregt'])
    for (const [target, barred] of Object.entries(TOO_CLOSE)) {
      for (const level of [5, 7, 10]) {
        if (!levelConfig(level).feelings.includes(target)) continue
        for (let seed = 1; seed <= 8; seed++) {
          const { log } = watch(level, target, 40000, seed)
          const seen = new Set(log.flatMap(t => t.up.map(c => c.feeling)))
          for (const f of barred) expect(seen.has(f), `${f} under ${target}, level ${level}, seed ${seed}`).toBe(false)
          expect(seen.size).toBeGreaterThan(2)
        }
      }
    }
  })

  it('nothing changes, nothing is rebuilt; at the end of a round everyone ducks', () => {
    const cfg = levelConfig(1), mem = {}
    let slots = step(Array(4).fill(null), mem, { now: 100, target: 'Traurig', cfg, rnd: seeded(3) })
    expect(mem.born).toBe(1)
    const same = step(slots, mem, { now: 200, target: 'Traurig', cfg, rnd: seeded(3) })
    expect(same).toBe(slots)
    expect(mem.born).toBe(0)
    slots = allDown(slots, 300)
    expect(slots.filter(Boolean).every(c => c.state === 'down')).toBe(true)
    slots = step(slots, mem, { now: 2000, target: 'Traurig', cfg, spawn: false })
    expect(slots.every(c => c === null)).toBe(true)
  })
})
