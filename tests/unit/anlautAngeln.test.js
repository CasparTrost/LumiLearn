import { describe, it, expect } from 'vitest'
import { WORDS, LEVELS, PARTNER, KEY, levelConfig, pickBuckets, nextWord, keyFor, wordsOf, layoutFor, lanesFor } from '../../src/games/buchstaben/angeln.js'
import { hasEmojiArt, customName } from '../../src/lib/emojiArt.jsx'
import { CUSTOM_ART } from '../../src/lib/emojiArtList.js'
import { wordRec, soundLikeKey, soundLikeRec, letterKey, isHeld } from '../../src/games/buchstaben/voice.js'

describe('Anlaut-Angeln: words', () => {
  it('every word has a picture, a recording and starts with its letter', () => {
    for (const w of WORDS) {
      const custom = customName(w.emoji)
      expect(custom ? CUSTOM_ART.has(custom) : hasEmojiArt(w.emoji), `picture for ${w.word}`).toBe(true)
      expect(wordRec(w.word), `recording for ${w.word}`).toBeTruthy()
      expect(w.word[0]).toBe(w.letter)
    }
    expect(new Set(WORDS.map(w => w.word)).size).toBe(WORDS.length)
  })

  it('every hint picture is a word of its letter, and the frog can say "Mmm wie Maus!" or "L wie Löwe."', () => {
    for (const [L, word] of Object.entries(KEY)) {
      expect(wordsOf(L).some(w => w.word === word), word).toBe(true)
      expect(soundLikeRec(L, word), `${L} ${word}`).toBeTruthy()
      // a held sound with its thing, or the letter's own sentence: never the bare word
      if (isHeld(L)) expect(soundLikeKey(L, word)).toMatch(/^laut\/[a-z]+-wie-/)
      else expect(soundLikeKey(L, word)).toBe(letterKey(L))
    }
  })

  it('the owl is not the U word: it is the "Eule" everywhere else', () => {
    expect(WORDS.some(w => w.emoji === '🦉' || w.word === 'Uhu')).toBe(false)
  })

  it('the hint picture is never the word on the hook', () => {
    for (const w of WORDS) {
      const k = keyFor(w.letter, w.word)
      if (k) { expect(k.word).not.toBe(w.word); expect(k.letter).toBe(w.letter) }
    }
  })
})

describe('Anlaut-Angeln: levels', () => {
  it('has ten levels with more buckets and quicker swimmers towards the top', () => {
    expect(LEVELS).toHaveLength(10)
    expect(levelConfig(1).buckets).toBe(2)
    expect(levelConfig(10).buckets).toBe(4)
    for (let l = 2; l <= 10; l++) {
      expect(levelConfig(l).speed[1]).toBeGreaterThanOrEqual(levelConfig(l - 1).speed[1])
      expect(levelConfig(l).depth).toBeGreaterThanOrEqual(levelConfig(l - 1).depth)
    }
    for (const c of LEVELS) {
      expect(c.catches).toBeGreaterThanOrEqual(6)
      expect(c.catches).toBeLessThanOrEqual(8)
    }
  })

  it('buckets come from the level, have words enough, and partners stand together only at the top', () => {
    for (let level = 1; level <= 10; level++) {
      const cfg = levelConfig(level)
      for (let run = 0; run < 300; run++) {
        const b = pickBuckets(level)
        expect(b).toHaveLength(cfg.buckets)
        expect(new Set(b).size).toBe(b.length)
        for (const L of b) {
          expect(cfg.pool).toContain(L)
          expect(wordsOf(L).length).toBeGreaterThanOrEqual(2)
        }
        const together = b.filter(L => b.includes(PARTNER[L]))
        if (!cfg.pairs) expect(together, b.join('')).toHaveLength(0)
        else {
          expect(together.length).toBeGreaterThanOrEqual(cfg.pairs * 2)
          // side by side
          for (const L of together) expect(Math.abs(b.indexOf(L) - b.indexOf(PARTNER[L]))).toBe(1)
        }
        if (cfg.mix) {
          expect(b.some(L => 'AEIOU'.includes(L))).toBe(true)
          expect(b.some(L => !'AEIOU'.includes(L))).toBe(true)
        }
      }
    }
  })

  it('every letter of a level\'s pool with words enough still gets a bucket now and then', () => {
    for (let level = 1; level <= 10; level++) {
      const seen = new Set()
      for (let run = 0; run < 400; run++) pickBuckets(level).forEach(L => seen.add(L))
      const want = [...levelConfig(level).pool].filter(L => wordsOf(L).length >= 2)
      expect([...seen].sort().join(''), `level ${level}`).toBe(want.sort().join(''))
    }
  })

  it('no thing swims in twice in a level', () => {
    for (let level = 1; level <= 10; level++) {
      const cfg = levelConfig(level)
      for (let run = 0; run < 200; run++) {
        const buckets = pickBuckets(level)
        const swimming = [], used = {}, sorted = {}
        // as in the game: the pond is kept full while words are still to
        // come, but never more words than catches
        const spawn = k => {
          while (swimming.length < cfg.swimmers && k + swimming.length < cfg.catches) {
            const w = nextWord(buckets, { swimming, used, sorted })
            expect(used[w.word] ?? 0, `level ${level} ${buckets.join('')}: ${w.word} again`).toBe(0)
            used[w.word] = 1
            swimming.push(w)
          }
        }
        spawn(0)
        for (let k = 1; k <= cfg.catches; k++) {
          const [caught] = swimming.splice(Math.floor(Math.random() * swimming.length), 1)
          sorted[caught.letter] = (sorted[caught.letter] ?? 0) + 1
          spawn(k)
        }
        expect(swimming).toHaveLength(0)
      }
    }
  })

  // Played the way the game plays it: the pond gets as many words as the
  // level has catches, no more (an earlier version drew twenty, more than
  // some buckets have words, and failed now and then for that alone).
  it('the water is stocked evenly, and no thing comes twice in a level', () => {
    for (let run = 0; run < 200; run++) {
      for (let level = 1; level <= 10; level++) {
        const cfg = levelConfig(level), buckets = pickBuckets(level)
        const swimming = [], used = {}, sorted = {}, all = []
        const add = () => {
          const w = nextWord(buckets, { swimming, used, sorted })
          expect(buckets).toContain(w.letter)
          used[w.word] = (used[w.word] ?? 0) + 1
          swimming.push(w); all.push(w)
        }
        for (let i = 0; i < cfg.swimmers; i++) add()
        for (let k = cfg.swimmers; k < cfg.catches; k++) {
          // one is caught and sorted, the new one swims in
          const caught = swimming.shift()
          sorted[caught.letter] = (sorted[caught.letter] ?? 0) + 1
          add()
        }
        expect(new Set(all.map(w => w.word)).size, `level ${level}`).toBe(all.length)
        const counts = buckets.map(L => all.filter(w => w.letter === L).length)
        expect(Math.max(...counts) - Math.min(...counts), `level ${level}`).toBeLessThanOrEqual(1)
        expect(Math.min(...counts), `level ${level}`).toBeGreaterThanOrEqual(2)
      }
    }
  })
})

describe('Anlaut-Angeln: layout', () => {
  const sizes = [[1024, 690], [390, 760], [844, 316], [1280, 640], [360, 600]]
  it('everything fits: buckets on the screen, swimmers big enough, lanes in the water', () => {
    for (const [w, h] of sizes) {
      for (const n of [2, 3, 4]) {
        for (const lanes of [3, 4]) {
          const L = layoutFor(w, h, n, lanes)
          for (const u of L.units) {
            expect(u.x).toBeGreaterThanOrEqual(0)
            expect(u.x + u.uw).toBeLessThanOrEqual(w)
            expect(u.y + u.uh).toBeLessThanOrEqual(L.side ? h : L.pond.y + 1)
            expect(u.bw).toBeGreaterThanOrEqual(64)
          }
          expect(L.S).toBeGreaterThanOrEqual(52)
          expect(L.surface - L.pond.y).toBeGreaterThanOrEqual(L.C + 30)
          for (const y of lanesFor(L, lanes, 1)) {
            expect(y - L.S / 2).toBeGreaterThanOrEqual(L.surface)
            expect(y + L.S / 2).toBeLessThanOrEqual(L.water.bottom)
          }
        }
      }
    }
  })
  it('a phone on its side puts the bank beside the pond', () => {
    expect(layoutFor(844, 316, 4, 4).side).toBe(true)
    expect(layoutFor(390, 760, 4, 4).side).toBe(false)
    expect(layoutFor(1024, 690, 4, 4).side).toBe(false)
  })
})
