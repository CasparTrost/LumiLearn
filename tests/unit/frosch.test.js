import { describe, it, expect } from 'vitest'
import { POOLS, FOUR_SOURCE, levelConfig, buildRounds, decoys, CELLS } from '../../src/games/frosch/words.js'
import { stageLayout, hopSpots, padCells, shelfSlots } from '../../src/games/frosch/layout.js'
import { KEY } from '../../src/games/woerter/voice.js'
import { LINES } from '../../src/lib/lumiLines.js'
import { hasEmojiArt, customName } from '../../src/lib/emojiArt.jsx'
import { CUSTOM_ART } from '../../src/lib/emojiArtList.js'

// the same words every run
function seeded(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
const ALL = Object.values(POOLS).flat()
// an emoji with its picture, or a :px-…: token with its drawn picture
const hasPicture = e => (customName(e) ? CUSTOM_ART.has(customName(e)) : hasEmojiArt(e))
const sound = s => LINES[KEY.syllable(s)].toLowerCase().replace(/[^a-zäöüß]/g, '')

describe('Frosch-Hüpfer: words', () => {
  it('only has words Lumi can say whole and in syllables, each with a picture', () => {
    expect(ALL.length).toBeGreaterThan(100)
    for (const w of ALL) {
      expect(KEY.word(w.name) in LINES, w.name).toBe(true)
      for (const s of w.syllables) expect(KEY.syllable(s) in LINES, `${w.name}: ${s}`).toBe(true)
      expect(hasPicture(w.emoji), w.name).toBe(true)
    }
  })

  it('never shows the same picture for two words', () => {
    // 🐰 was "Hase" in level 1 and "Osterhase" in level 8: a child who knows
    // the picture as "Hase" hops twice where the game wants four
    const pic = e => e.replace(/️/g, '')
    const byPic = new Map()
    for (const w of ALL) {
      expect(byPic.get(pic(w.emoji)), `${w.emoji} ${w.name}`).toBeUndefined()
      byPic.set(pic(w.emoji), w.name)
    }
    expect(new Set(ALL.map(w => w.name)).size).toBe(ALL.length)
  })

  it('has a picture for every four-syllable word, recorded yet or not', () => {
    // the pool drops words whose recordings are missing: a missing picture
    // must not hide behind a missing recording
    expect(FOUR_SOURCE.length).toBeGreaterThanOrEqual(19)
    const pic = e => e.replace(/️/g, '')
    const others = new Set(ALL.filter(w => w.syllables.length !== 4).map(w => pic(w.emoji)))
    for (const w of FOUR_SOURCE) {
      expect(w.syllables.length, w.name).toBe(4)
      expect(hasPicture(w.emoji), `${w.name} ${w.emoji}`).toBe(true)
      expect(others.has(pic(w.emoji)), `${w.name} ${w.emoji}`).toBe(false)
    }
    expect(new Set(FOUR_SOURCE.map(w => pic(w.emoji))).size).toBe(FOUR_SOURCE.length)
    // the recorded ones are the pool
    expect(POOLS.FOUR.every(w => FOUR_SOURCE.some(s => s.name === w.name))).toBe(true)
  })

  it('sorts the words by their number of syllables', () => {
    for (const w of POOLS.ONE) expect(w.syllables.length).toBe(1)
    for (const w of [...POOLS.TWO_OPEN, ...POOLS.TWO_CLOSED]) expect(w.syllables.length).toBe(2)
    for (const w of [...POOLS.THREE, ...POOLS.THREE_LONG]) expect(w.syllables.length).toBe(3)
    for (const w of POOLS.FOUR) expect(w.syllables.length).toBe(4)
  })
})

describe('Frosch-Hüpfer: levels', () => {
  it('has six to eight words in every level and enough words for each', () => {
    for (let level = 1; level <= 10; level++) {
      const cfg = levelConfig(level)
      expect(cfg.plan.length, `level ${level}`).toBeGreaterThanOrEqual(6)
      expect(cfg.plan.length, `level ${level}`).toBeLessThanOrEqual(8)
      for (const n of new Set(cfg.plan.map(p => p.n))) {
        const need = cfg.plan.filter(p => p.n === n).length
        expect(new Set(cfg.pools[n].map(w => w.emoji)).size, `level ${level}, ${n} syllables`).toBeGreaterThanOrEqual(need)
      }
    }
  })

  it('keeps the curve: hopping first, building from 3, silent hops from 5, wrong pads from 7, four syllables at the end', () => {
    const kinds = l => new Set(levelConfig(l).plan.map(p => p.kind))
    expect([...kinds(1)]).toEqual(['hop'])
    expect([...kinds(2)]).toEqual(['hop'])
    for (let l = 3; l <= 10; l++) expect(kinds(l).has('build'), `level ${l}`).toBe(true)
    for (let l = 1; l <= 4; l++) expect(levelConfig(l).speak).toBe(true)
    for (let l = 5; l <= 10; l++) expect(levelConfig(l).speak).toBe(false)
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => levelConfig(l).extra)).toEqual([0, 0, 0, 0, 0, 0, 1, 1, 2, 2])
    expect(levelConfig(1).plan.every(p => p.n === 2)).toBe(true)
    expect(Math.max(...levelConfig(4).plan.map(p => p.n))).toBe(3)
    expect(Math.max(...levelConfig(5).plan.map(p => p.n))).toBe(4)
    for (const l of [9, 10]) expect(levelConfig(l).plan.every(p => p.n === 4)).toBe(true)
    // the pond gets livelier, never calmer
    const drift = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(l => levelConfig(l).drift)
    expect([...drift].sort((a, b) => a - b)).toEqual(drift)
  })

  it('builds rounds as planned: no picture twice, pads on places of their own', () => {
    for (let level = 1; level <= 10; level++) {
      for (let seed = 1; seed <= 40; seed++) {
        const cfg = levelConfig(level)
        const rounds = buildRounds(level, seeded(seed * 7 + level))
        expect(rounds.map(r => r.kind)).toEqual(cfg.plan.map(p => p.kind))
        expect(rounds.map(r => r.syllables.length)).toEqual(cfg.plan.map(p => p.n))
        expect(new Set(rounds.map(r => r.emoji)).size).toBe(rounds.length)
        for (const r of rounds.filter(x => x.kind === 'build')) {
          expect(r.pads.length).toBe(r.syllables.length + cfg.extra)
          expect(r.pads.length).toBeLessThanOrEqual(CELLS)
          expect(new Set(r.pads.map(p => p.cell)).size).toBe(r.pads.length)
          expect(new Set(r.pads.map(p => p.id)).size).toBe(r.pads.length)
          expect(r.pads.filter(p => p.real).map(p => p.text)).toEqual(r.syllables)
          // a wrong pad never sounds like one of the word's syllables, nor like another wrong one
          const own = r.syllables.map(sound), wrong = r.pads.filter(p => !p.real).map(p => sound(p.text))
          for (const s of wrong) expect(own.includes(s), `${r.word}: ${s}`).toBe(false)
          expect(new Set(wrong).size).toBe(wrong.length)
        }
      }
    }
  }, 30000)   // 400 levels built: give a busy machine time

  it('gives wrong syllables that can be said', () => {
    for (const w of POOLS.FOUR) for (const s of decoys(w, 2, seeded(3))) expect(KEY.syllable(s) in LINES, s).toBe(true)
  })
})

// The stage as the game gets it (own pixels, scale): a tablet, a phone held
// upright, a small phone, a phone held sideways (shown at 0.6)
const SCREENS = { tablet: [1004, 682, 1.02], phone: [390, 772, 1], small: [360, 668, 1], sideways: [1407, 543, 0.6] }

describe('Frosch-Hüpfer: the pond', () => {
  for (const [name, [w, h, scale]] of Object.entries(SCREENS)) {
    const L = stageLayout(w, h, scale)
    const inside = (p, m = 0) => p.x >= m && p.x <= w - m && p.y >= m && p.y <= h - m
    const inWater = (p, m = 0) => p.x >= L.water.x + m && p.x <= L.water.x + L.water.w - m && p.y >= L.water.y + m && p.y <= L.water.y + L.water.h - m

    it(`${name}: frog, thing and shelf are on the stage, and big enough for a finger`, () => {
      expect(L.wide).toBe(name === 'tablet' || name === 'sideways')
      for (const p of [L.home, L.goal, L.thingAt]) expect(inside(p, 4), JSON.stringify(p)).toBe(true)
      expect(inWater(L.home)).toBe(false)
      expect(inWater(L.goal)).toBe(false)
      expect(L.thing * scale).toBeGreaterThanOrEqual(64)
      expect(L.thingAt.x - L.thing / 2).toBeGreaterThanOrEqual(0)
      expect(L.thingAt.x + L.thing / 2).toBeLessThanOrEqual(w)
      expect(L.thingAt.y - L.thing).toBeGreaterThanOrEqual(0)
      const s = shelfSlots(L, 8)
      expect(s.slots[0].x - s.size / 2 - 8).toBeGreaterThanOrEqual(0)
      expect(s.slots[7].x + s.size / 2 + 8).toBeLessThanOrEqual(w)
      expect(s.size).toBeGreaterThanOrEqual(26)
    })

    it(`${name}: every pad of a hop round lies in the water, and so does a hop too many`, () => {
      for (let n = 1; n <= 4; n++) {
        const sp = hopSpots(L, n)
        for (let k = 1; k <= n; k++) {
          const p = sp.at(k)
          expect(inWater({ x: p.x - sp.pad.w / 2, y: p.y - sp.pad.h / 2 }), `${n}/${k}`).toBe(true)
          expect(inWater({ x: p.x + sp.pad.w / 2, y: p.y + sp.pad.h / 2 }), `${n}/${k}`).toBe(true)
        }
        expect(inWater(sp.at(n + 1), 4), `trap ${n}`).toBe(true)
        // pads do not touch
        expect(sp.u).toBeGreaterThan((L.wide ? sp.pad.w : sp.pad.h) + 6)
        // the leap ashore is longer than a hop, but not twice as long; too early it ends in the water
        const last = sp.at(n), leap = Math.hypot(L.goal.x - last.x, L.goal.y - last.y)
        expect(leap).toBeGreaterThan(sp.u)
        expect(leap).toBeLessThan(sp.u * 2.1)
        for (let k = 0; k < n; k++) expect(inWater(sp.short(k), 4), `short ${n}/${k}`).toBe(true)
      }
    })

    it(`${name}: six build pads fit into the pond without touching, each big enough for a finger`, () => {
      for (const drift of [1, 1.6, 2.7]) {
        const C = padCells(L, drift)
        expect(C.pad.w * scale).toBeGreaterThanOrEqual(64)
        expect(C.pad.h * scale).toBeGreaterThanOrEqual(56)
        const pads = Array.from({ length: 6 }, (_, cell) => [-1, 1].flatMap(jx => [-1, 1].map(jy => C.at({ cell, jx, jy }))))
        for (const corners of pads) for (const p of corners) {
          expect(inWater({ x: p.x - C.pad.w / 2 - C.amp, y: p.y - C.pad.h / 2 - C.amp }), `drift ${drift}`).toBe(true)
          expect(inWater({ x: p.x + C.pad.w / 2 + C.amp, y: p.y + C.pad.h / 2 + C.amp }), `drift ${drift}`).toBe(true)
        }
        // the nearest two neighbours, each as far towards the other as it gets
        for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) for (const pa of pads[a]) for (const pb of pads[b]) {
          const dx = Math.abs(pa.x - pb.x), dy = Math.abs(pa.y - pb.y)
          expect(dx >= C.pad.w + 2 * C.amp || dy >= C.pad.h + 2 * C.amp * 0.7, `${a}/${b} drift ${drift}`).toBe(true)
        }
      }
    })
  }
})
