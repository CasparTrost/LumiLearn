import { describe, it, expect } from 'vitest'
import { FEELINGS, TOO_CLOSE, levelConfig, pickRounds, deal, settle, allDown, GRIDS, ANIMALS, DUCK_MS, SHUT_MS } from '../../src/games/gefuehle/rounds.js'
import { feelingWord } from '../../src/lib/words.js'

// a random source that repeats, so a failing run can be played again
function seeded(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

// plays a round as a child who always finds the right one: deal, tap the
// right one, deal again, and notes every deal and where the right one was
function play(level, target, deals, seed = 1) {
  const cfg = levelConfig(level), rnd = seeded(seed)
  let lastAt = null, lastAnimal = null, prev = null
  const log = []
  for (let k = 0; k < deals; k++) {
    const cast = deal(cfg, target, { avoid: lastAt, lastAnimal, before: prev, rnd })
    const at = cast.findIndex(c => c.feeling === target)
    log.push({ cast, at, lastAt, lastAnimal, prev })
    lastAt = at; lastAnimal = cast[at].animal; prev = cast
  }
  return { cfg, log }
}

describe('Gefühle-Haus', () => {
  it('every feeling of the game has its recorded word', () => {
    expect(FEELINGS.length).toBe(10)
    for (const f of FEELINGS) expect(feelingWord(f), f).toBeTruthy()
  })

  it('the levels grow: more feelings, more windows', () => {
    const cfgs = Array.from({ length: 10 }, (_, i) => levelConfig(i + 1))
    expect(cfgs[0].feelings).toEqual(['Glücklich', 'Traurig', 'Wütend'])
    expect(cfgs[0].windows).toBe(4)
    expect(cfgs[9].feelings.length).toBe(10)
    expect(cfgs[9].windows).toBe(9)
    expect(cfgs[9].hideFace).toBe(true)
    expect(cfgs[7].hideFace).toBe(false)
    for (let i = 1; i < 10; i++) {
      expect(cfgs[i].feelings.length).toBeGreaterThanOrEqual(cfgs[i - 1].feelings.length)
      expect(cfgs[i].windows).toBeGreaterThanOrEqual(cfgs[i - 1].windows)
    }
    for (const c of cfgs) {
      expect(GRIDS[c.windows]).toBeTruthy()
      expect(c.windows).toBeLessThanOrEqual(ANIMALS)   // a different animal in every window
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

  it('a deal: every window has an animal, all different, and exactly one right one', () => {
    for (let level = 1; level <= 10; level++) {
      const cfg = levelConfig(level)
      for (let seed = 1; seed <= 10; seed++) {
        const target = cfg.feelings[seed % cfg.feelings.length]
        for (const { cast } of play(level, target, 8, seed).log) {
          expect(cast.length).toBe(cfg.windows)
          expect(cast.every(c => c && c.state === 'up')).toBe(true)
          expect(cast.filter(c => c.feeling === target).length, `level ${level}`).toBe(1)
          expect(new Set(cast.map(c => c.animal)).size).toBe(cast.length)
          expect(new Set(cast.map(c => c.id)).size).toBe(cast.length)
          for (const c of cast) {
            expect(cfg.feelings).toContain(c.feeling)
            expect(c.animal).toBeLessThan(ANIMALS)
            expect(c.variant).toBeLessThan(cfg.variants)
          }
        }
      }
    }
    // level 1 keeps to one face per feeling
    expect(play(1, 'Traurig', 10).log.every(d => d.cast.every(c => c.variant === 0))).toBe(true)
  })

  it('after a right tap the next right one is somewhere else, and another animal', () => {
    // the owner: "wenn ich die anklicke, tauchen die zwei weiteren traurigen
    // gesichter auch in den selben Fenstern auf. Das ist dann keine Herausforderung."
    for (const level of [1, 3, 5, 7, 10]) {
      const cfg = levelConfig(level)
      const where = Array(cfg.windows).fill(0)
      for (let seed = 1; seed <= 20; seed++) {
        const target = cfg.feelings[seed % cfg.feelings.length]
        for (const d of play(level, target, 6, seed).log) {
          where[d.at] += 1
          if (d.lastAt == null) continue
          expect(d.at, `level ${level}, seed ${seed}`).not.toBe(d.lastAt)
          expect(d.cast[d.at].animal).not.toBe(d.lastAnimal)
          // everyone is dealt anew: no window keeps its animal
          d.cast.forEach((c, i) => expect(c.animal, `level ${level} window ${i}`).not.toBe(d.prev[i].animal))
        }
      }
      // the right one turns up in every window, not in a favourite one
      for (const n of where) expect(n, `level ${level}: ${where}`).toBeGreaterThan(0)
      expect(Math.max(...where) / (20 * 6), `level ${level}`).toBeLessThan(0.5)
    }
  })

  it('the right one cannot be found without reading its face', () => {
    // a tap without looking is wrong more often than right, and the right
    // one is never simply the odd one out: the others show two feelings or
    // more, and one of them is alone at the windows as well
    for (const level of [1, 2, 3, 5, 7, 10]) {
      const cfg = levelConfig(level)
      for (let seed = 1; seed <= 12; seed++) {
        const target = cfg.feelings[seed % cfg.feelings.length]
        for (const { cast, at } of play(level, target, 6, seed).log) {
          expect(1 / cast.length).toBeLessThanOrEqual(0.25)
          const counts = {}
          cast.forEach((c, i) => { if (i !== at) counts[c.feeling] = (counts[c.feeling] ?? 0) + 1 })
          const n = Object.values(counts)
          expect(n.length, `level ${level}, ${target}`).toBeGreaterThanOrEqual(2)
          expect(n, `level ${level}, ${target}: ${JSON.stringify(counts)}`).toContain(1)
          // and a mix: no look-alike fills more than half of the other windows
          expect(Math.max(...n), `level ${level}, ${target}: ${JSON.stringify(counts)}`).toBeLessThanOrEqual(Math.ceil((cast.length - 1) / 2))
        }
      }
    }
  })

  it('from level 5 a look-alike is next to the right one, so the child looks twice', () => {
    const near = { 'Traurig': ['Ängstlich', 'Müde', 'Verlegen'], 'Wütend': ['Gelangweilt', 'Ängstlich'] }
    for (const [target, faces] of Object.entries(near)) {
      const deals = play(7, target, 30, 5).log
      const with_ = deals.filter(d => d.cast.some(c => faces.includes(c.feeling))).length
      expect(with_ / deals.length, target).toBeGreaterThan(0.9)
    }
  })

  it('no face that can be argued for is a wrong answer', () => {
    // for every asked feeling, the drawn faces a child could defend as it
    // (logic check, round 2): they never come up in its rounds
    const DEFENSIBLE = {
      'Glücklich':   ['Stolz', 'Aufgeregt', 'Verlegen'],
      'Traurig':     ['Gelangweilt'],
      'Ängstlich':   ['Überrascht'],
      'Überrascht':  ['Ängstlich', 'Aufgeregt'],
      'Müde':        ['Gelangweilt'],
      'Gelangweilt': ['Müde'],
      'Stolz':       ['Glücklich', 'Aufgeregt'],
      'Aufgeregt':   ['Glücklich', 'Stolz', 'Überrascht', 'Ängstlich'],
    }
    for (const [target, faces] of Object.entries(DEFENSIBLE)) expect(TOO_CLOSE[target], target).toEqual(expect.arrayContaining(faces))
    for (const [target, barred] of Object.entries(TOO_CLOSE)) {
      for (const level of [3, 5, 7, 10]) {
        if (!levelConfig(level).feelings.includes(target)) continue
        for (let seed = 1; seed <= 8; seed++) {
          const { log } = play(level, target, 10, seed)
          const seen = new Set(log.flatMap(d => d.cast.map(c => c.feeling)))
          for (const f of barred) expect(seen.has(f), `${f} under ${target}, level ${level}, seed ${seed}`).toBe(false)
          expect(seen.size).toBeGreaterThan(2)
        }
      }
    }
  })

  it('shutting: everyone ducks, is gone after the duck, and the pause stays short', () => {
    const cfg = levelConfig(1)
    let slots = deal(cfg, 'Traurig', { rnd: seeded(3) })
    expect(settle(slots, 5000)).toBe(slots)                 // nobody leaves by themselves
    const at = slots.findIndex(c => c.feeling === 'Traurig')
    slots = allDown(slots.map((c, i) => (i === at ? { ...c, state: 'out', gone: 300 } : c)), 0)
    expect(slots.every(c => c.state !== 'up')).toBe(true)
    expect(settle(slots, 100)).toBe(slots)
    expect(settle(slots, DUCK_MS).every(c => c === null)).toBe(true)
    // closed long enough to be seen, short enough not to drag
    expect(SHUT_MS).toBeGreaterThan(DUCK_MS + 300)
    expect(SHUT_MS).toBeLessThanOrEqual(1200)
  })
})
