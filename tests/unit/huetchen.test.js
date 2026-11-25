import { describe, it, expect } from 'vitest'
import { LINES } from '../../src/lib/lumiLines.js'
import { hasEmojiArt, customName } from '../../src/lib/emojiArt.jsx'
import { slug } from '../../src/games/buchstaben/voice.js'
import {
  ALL_WORDS, LEVELS, SOUND_SETS, LOOK_SETS, levelConfig, findsIn, bushesFor, makeSwaps, afterSwaps, makeShuffle, tooClose, wordOf,
} from '../../src/games/huetchen/plan.js'
import { layoutFor, thingY } from '../../src/games/huetchen/layout.js'

// a little random generator that repeats, so a failure can be found again
const seeded = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }

describe('Hütchenspiel: the words', () => {
  it('every word is recorded by Lumi and has its picture', () => {
    for (const w of ALL_WORDS) {
      expect(LINES[`woerter/${slug(w.word)}`], `recording of ${w.word}`).toBeTruthy()
      expect(customName(w.emoji) || hasEmojiArt(w.emoji), `picture of ${w.word}`).toBeTruthy()
    }
  })

  it('no word or picture twice', () => {
    expect(new Set(ALL_WORDS.map(w => w.word)).size).toBe(ALL_WORDS.length)
    expect(new Set(ALL_WORDS.map(w => w.emoji)).size).toBe(ALL_WORDS.length)
  })

  it('the sound-alike and look-alike sets use known words', () => {
    for (const set of [...SOUND_SETS, ...LOOK_SETS]) for (const w of set) expect(wordOf(w), w).toBeTruthy()
  })
})

describe('Hütchenspiel: the levels', () => {
  it('ten levels that grow: more bushes, more swaps, quicker, more finds', () => {
    expect(LEVELS).toHaveLength(10)
    expect(levelConfig(0)).toBe(LEVELS[0])
    expect(levelConfig(99)).toBe(LEVELS[9])
    expect(LEVELS[0].swaps).toBe(0)
    expect(LEVELS[1].swaps).toBe(1)
    for (let i = 1; i < 7; i++) {
      expect(LEVELS[i].swaps).toBeGreaterThanOrEqual(LEVELS[i - 1].swaps)
      expect(LEVELS[i].bushes).toBeGreaterThanOrEqual(LEVELS[i - 1].bushes)
      if (LEVELS[i - 1].ms) expect(LEVELS[i].ms).toBeLessThanOrEqual(LEVELS[i - 1].ms)
    }
    expect(LEVELS.slice(0, 7).every(l => !l.read)).toBe(true)
    expect(LEVELS.slice(7).every(l => l.read)).toBe(true)
    for (const l of LEVELS) {
      expect(l.shuffles).toBeGreaterThanOrEqual(5)
      expect(l.shuffles).toBeLessThanOrEqual(6)
      expect(findsIn(l)).toBe(l.shuffles * l.finds)
    }
  })

  it('five bushes only on a wide screen, three on a phone held upright', () => {
    expect(bushesFor(LEVELS[6], 1024)).toBe(5)
    expect(bushesFor(LEVELS[6], 390)).toBe(3)
    expect(bushesFor(LEVELS[0], 390)).toBe(3)
  })
})

describe('Hütchenspiel: a shuffle', () => {
  it('swaps two neighbours at a time, never the same two twice in a row', () => {
    const rnd = seeded(7)
    for (let run = 0; run < 300; run++) {
      const n = 3 + (run % 3)
      const sw = makeSwaps({ swaps: 4 }, n, rnd)
      expect(sw).toHaveLength(4)
      sw.forEach(([a, b], i) => {
        expect(b - a).toBe(1)
        expect(a).toBeGreaterThanOrEqual(0)
        expect(b).toBeLessThan(n)
        if (i) expect(sw[i - 1]).not.toEqual([a, b])
      })
    }
  })

  it('follows the things through the swaps', () => {
    expect(afterSwaps(3, [])).toEqual([0, 1, 2])
    expect(afterSwaps(3, [[0, 1]])).toEqual([1, 0, 2])
    expect(afterSwaps(3, [[0, 1], [1, 2]])).toEqual([1, 2, 0])
  })

  it('every level: different things, the right number called, none called twice in a level', () => {
    const rnd = seeded(42)
    for (let level = 1; level <= 10; level++) {
      const cfg = levelConfig(level)
      for (const width of [390, 1024]) {
        for (let run = 0; run < 12; run++) {
          const used = new Set(), called = new Set()
          const n = bushesFor(cfg, width)
          for (let k = 0; k < cfg.shuffles; k++) {
            const sh = makeShuffle(cfg, n, { used, called, rnd })
            const words = sh.things.map(t => t.word)
            expect(sh.things).toHaveLength(n)
            expect(new Set(words).size).toBe(n)
            expect(sh.swaps).toHaveLength(cfg.swaps)
            expect(sh.calls).toHaveLength(cfg.finds)
            expect(new Set(sh.calls.map(c => c.word)).size).toBe(cfg.finds)
            for (const c of sh.calls) {
              expect(words).toContain(c.word)
              expect(called.has(c.word), `${c.word} called twice in level ${level}`).toBe(false)
            }
            // nothing alike by chance; the alike set is there on purpose
            const set = [...SOUND_SETS, ...LOOK_SETS]
            for (const a of words) for (const b of words) {
              if (a < b && tooClose(a, b)) {
                expect(['sound', 'read-look'], `${a} and ${b} in level ${level}`).toContain(cfg.words)
                expect(set.some(s => s.includes(a) && s.includes(b))).toBe(true)
              }
            }
            // levels 6, 7 and 10: one of the alike set is called first
            if (cfg.words === 'sound' || cfg.words === 'read-look') {
              const first = sh.calls[0].word
              expect(words.some(w => w !== first && tooClose(w, first)), `${first} in ${words}`).toBe(true)
            }
            // when the bushes swap, the first one called has moved
            if (cfg.swaps) {
              const at = afterSwaps(n, sh.swaps)
              const i = words.indexOf(sh.calls[0].word)
              const moved = at.some((thing, place) => thing !== place)
              if (moved && !(cfg.words === 'sound' || cfg.words === 'read-look')) expect(at.indexOf(i)).not.toBe(i)
            }
            words.forEach(w => used.add(w))
            sh.calls.forEach(c => called.add(c.word))
          }
        }
      }
    }
  }, 30000)

  it('the reading levels use short words first', () => {
    const rnd = seeded(3)
    const sh = makeShuffle(levelConfig(8), 4, { rnd })
    for (const t of sh.things) expect(t.word.length).toBeLessThanOrEqual(5)
  })
})

describe('Hütchenspiel: the layout', () => {
  // the field under the top bar at tablet, phone upright and phone sideways
  const SIZES = [[1024, 690, 5], [1024, 690, 3], [390, 770, 4], [390, 770, 3], [844, 320, 5], [844, 320, 3]]
  it('bushes big enough to hit, side by side, on the screen', () => {
    for (const [W, H, n] of SIZES) {
      const L = layoutFor(W, H, n, 10)
      expect(L.B, `${W}x${H}`).toBeGreaterThanOrEqual(64)
      expect(L.bh).toBeGreaterThanOrEqual(50)
      expect(L.slots[0] - L.B / 2).toBeGreaterThanOrEqual(0)
      expect(L.slots[n - 1] + L.B / 2).toBeLessThanOrEqual(W)
      for (let i = 1; i < n; i++) expect(L.slots[i] - L.slots[i - 1]).toBeGreaterThanOrEqual(L.B)
      expect(L.ground).toBeLessThanOrEqual(H)
      // a thing standing on a bush stays under the row of finds
      expect(L.ground - L.bh + thingY(L.bh, L.T).top).toBeGreaterThan(L.strip.y + L.strip.h)
    }
  })

  it('Lumi and her bubble on the screen, not on the bushes', () => {
    for (const [W, H, n] of SIZES) {
      const L = layoutFor(W, H, n, 10)
      expect(L.lumi.x).toBeGreaterThanOrEqual(0)
      expect(L.lumi.x + L.lumi.s).toBeLessThanOrEqual(W)
      expect(L.lumi.y).toBeGreaterThan(L.strip.y + L.strip.h)
      expect(L.bubble.maxW, `${W}x${H}`).toBeGreaterThanOrEqual(150)
      if (L.side) {
        expect(L.bubble.ax - L.bubble.maxW / 2).toBeGreaterThanOrEqual(0)
        expect(L.lumi.x + L.lumi.s).toBeLessThanOrEqual(L.slots[0] - L.B / 2 + 4)
      } else {
        expect(L.bubble.ax + 14 + L.bubble.maxW).toBeLessThanOrEqual(W)
        expect(L.lumi.y + L.lumi.s).toBeLessThanOrEqual(L.ground - L.bh + thingY(L.bh, L.T).top)
      }
    }
  })

  it('on a phone held upright the bushes are raised and bigger than Lumi', () => {
    const L = layoutFor(390, 770, 3, 10)
    expect(L.ground).toBeLessThan(770 * 0.85)
    expect(L.meadow).toBeLessThan(L.ground)
    expect(L.B).toBeGreaterThan(110)
    expect(L.lumi.s).toBeLessThan(L.B * 1.1)
    expect(layoutFor(1024, 690, 4, 10).meadow).toBe(null)
  })

  it('the stump stands between the things on the first two bushes', () => {
    for (const [W, H, n] of SIZES) {
      const L = layoutFor(W, H, n, 10)
      if (!L.stump) continue
      expect(L.stump.x - L.stump.w / 2, `${W}x${H}`).toBeGreaterThanOrEqual(L.slots[0] + L.T / 2)
      expect(L.stump.x + L.stump.w / 2, `${W}x${H}`).toBeLessThanOrEqual(L.slots[1] - L.T / 2)
    }
  })

  it('a ring for every find, all in the row', () => {
    for (const [W, H, n] of SIZES) {
      const L = layoutFor(W, H, n, 10)
      expect(L.rings).toHaveLength(10)
      expect(L.rings[9].x + L.ring / 2).toBeLessThan(W - 92)
    }
  })
})
