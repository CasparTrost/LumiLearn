import { describe, it, expect } from 'vitest'
import {
  WORDS, LETTERS, LEVELS, SAME, NEAR, PARTNER, levelConfig, planLevel, pickThing, needOf, thingsOf,
  layoutFor, spitSpot, scaleAt, START_SCALE,
} from '../../src/games/buchstaben/mampf.js'
import { wordRec, rec, slug } from '../../src/games/buchstaben/voice.js'
import { hasEmojiArt, customName } from '../../src/lib/emojiArt.jsx'
import { CUSTOM_ART } from '../../src/lib/emojiArtList.js'

// a random source that repeats, so a failing run can be played again
function seeded(seed) {
  let s = seed
  return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296 }
}

describe('Monster-Mampf: the words', () => {
  it('every letter has a monster sentence, and every word a picture and a recording', () => {
    expect(LETTERS.length).toBe(26)
    const seen = new Set()
    for (const L of LETTERS) {
      expect(rec(`abc/${slug(L)}`), `abc/${L}`).toBeTruthy()
      for (const [word, emoji] of WORDS[L]) {
        expect(word[0].toUpperCase(), word).toBe(L)
        expect(wordRec(word), word).toBeTruthy()
        const custom = customName(emoji)
        expect(custom ? CUSTOM_ART.has(custom) : hasEmojiArt(emoji), `${word} ${emoji}`).toBe(true)
        expect(seen.has(emoji), `${emoji} twice`).toBe(false)
        seen.add(emoji)
      }
    }
  })

  it('the first word of a letter is the one from Lumi\'s sentence', () => {
    expect(WORDS.A[0][0]).toBe('Affe')
    expect(WORDS.M[0][0]).toBe('Maus')
    expect(WORDS.Z[0][0]).toBe('Zebra')
  })

  it('a monster is full after five bites, sooner where a letter has few words', () => {
    expect(needOf('B')).toBe(5)
    expect(needOf('I')).toBe(4)
    expect(needOf('X')).toBe(3)
  })
})

describe('Monster-Mampf: the levels', () => {
  it('ten levels, four or five monsters each, the letters of the old game in its order', () => {
    expect(LEVELS.length).toBe(10)
    for (let level = 1; level <= 10; level++) {
      for (let seed = 1; seed <= 20; seed++) {
        const { cfg, groups } = planLevel(level, seeded(seed * 7 + level))
        const mons = groups.flat()
        expect(mons.length, `level ${level}`).toBeGreaterThanOrEqual(4)
        expect(mons.length, `level ${level}`).toBeLessThanOrEqual(5)
        expect(new Set(mons.map(m => m.letter)).size).toBe(mons.length)
        expect(mons.map(m => m.slot)).toEqual(mons.map((_, i) => i))
        for (const g of groups) expect(g.length).toBe(cfg.duo ? 2 : 1)
        if (!cfg.duo) for (const m of mons) expect((cfg.letters + (cfg.review ?? '')).includes(m.letter)).toBe(true)
        for (const m of mons) expect(m.shown).toBe(cfg.lower ? m.letter.toLowerCase() : m.letter)
      }
    }
    expect(planLevel(2, seeded(3)).groups.flat().map(m => m.letter).filter(L => 'EIU'.includes(L)).length).toBe(3)
  })

  it('it gets harder: more in the air, quicker, then similar sounds, then two monsters', () => {
    const c = Array.from({ length: 10 }, (_, i) => levelConfig(i + 1))
    expect(c[0].count).toBe(2)
    for (let i = 1; i < 8; i++) {
      expect(c[i].count).toBeGreaterThanOrEqual(c[i - 1].count)
      expect(c[i].cross).toBeLessThanOrEqual(c[i - 1].cross)
    }
    expect(c.slice(0, 6).some(x => x.near || x.duo)).toBe(false)
    expect(c[6].near && c[7].near).toBe(true)
    expect(c[8].duo && c[9].duo).toBe(true)
    expect(Math.max(...c.map(x => x.count))).toBeLessThanOrEqual(4)
  })

  it('two monsters on stage have letters that sound apart, except the last pair of level 10', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const level of [9, 10]) {
        const { groups } = planLevel(level, seeded(seed))
        groups.forEach((g, i) => {
          const [a, b] = g.map(m => m.letter)
          expect(g[0].color).not.toBe(g[1].color)
          expect((SAME[a] ?? '').includes(b)).toBe(false)
          if (level === 10 && i === groups.length - 1) expect(PARTNER[a]).toBe(b)
          else expect((NEAR[a] ?? '').includes(b) || (NEAR[b] ?? '').includes(a)).toBe(false)
        })
      }
    }
  })
})

describe('Monster-Mampf: what floats in', () => {
  it('a hungry monster with nothing of its own in the air gets something first', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const t = pickThing({ targets: ['M'], afloat: [{ word: 'Sonne', letter: 'S' }], count: 3 }, seeded(seed))
      expect(t.letter).toBe('M')
    }
    expect(pickThing({ targets: ['A'], afloat: [], count: 2, first: true }, seeded(1)).word).toBe('Affe')
  })

  it('two monsters: both find something for themselves', () => {
    const t = pickThing({ targets: ['S', 'R'], afloat: [{ word: 'Sonne', letter: 'S' }], count: 4 }, seeded(5))
    expect(t.letter).toBe('R')
  })

  it('never more than half of what is in the air fits, and nothing is there twice', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const rnd = seeded(seed)
      for (const count of [2, 3, 4]) {
        const afloat = []
        for (let i = 0; i < count; i++) afloat.push(pickThing({ targets: ['B'], afloat, count }, rnd))
        expect(new Set(afloat.map(t => t.word)).size).toBe(count)
        const fits = afloat.filter(t => t.letter === 'B').length
        expect(fits).toBeGreaterThanOrEqual(1)
        expect(fits).toBeLessThanOrEqual(Math.ceil(count / 2))
      }
    }
  })

  it('a wrong thing is fair: never the same sound, never a picture with another name that fits', () => {
    for (const T of LETTERS) {
      const rnd = seeded(T.charCodeAt(0))
      const own = thingsOf(T)[0]
      for (let i = 0; i < 80; i++) {
        const t = pickThing({ targets: [T], afloat: [own], count: 1 }, rnd)   // count 1: only wrong things come
        expect(t, T).toBeTruthy()
        expect(t.letter).not.toBe(T)
        expect((SAME[T] ?? '').includes(t.letter), `${t.word} for ${T}`).toBe(false)
        const never = WORDS[t.letter].find(w => w[0] === t.word)[2] ?? ''
        expect(never === '*' || never.includes(T), `${t.word} for ${T}`).toBe(false)
        // in the early levels the wrong sound is far away
        expect((NEAR[T] ?? '').includes(t.letter), `${t.word} for ${T}`).toBe(false)
        if ('AEIOU'.includes(T)) expect('AEIOU'.includes(t.letter), `${t.word} for ${T}`).toBe(false)
      }
    }
  })

  it('from level 7 the partner sound floats past (B for P, D for T …)', () => {
    const rnd = seeded(11)
    const letters = []
    for (let i = 0; i < 200; i++) letters.push(pickThing({ targets: ['P'], afloat: [thingsOf('P')[0]], count: 1, near: true }, rnd).letter)
    const partner = letters.filter(L => L === 'B').length
    expect(partner).toBeGreaterThan(90)
    expect(partner).toBeLessThan(170)
  })

  it('words seen a moment ago wait their turn', () => {
    const rnd = seeded(3)
    for (let i = 0; i < 40; i++) {
      const t = pickThing({ targets: ['L'], afloat: [], avoid: ['Löwe', 'Lama'], count: 2 }, rnd)
      expect(t.word).toBe('Leiter')
    }
  })
})

describe('Monster-Mampf: the stage', () => {
  const sizes = { tablet: [1024, 698], phone: [390, 774], sideways: [844, 320], small: [360, 670], desktop: [1440, 830] }

  it('a thing is at least 64 px to tap and everything is on the stage', () => {
    for (const [name, [w, h]] of Object.entries(sizes)) {
      for (const duo of [false, true]) {
        const L = layoutFor(w, h, { duo, slots: duo ? 4 : 5 })
        expect(L.disc, name).toBeGreaterThanOrEqual(64)
        expect(L.lanes.length, name).toBeGreaterThanOrEqual(1)
        for (const y of L.lanes) {
          expect(y - L.fh / 2 - L.bob, name).toBeGreaterThanOrEqual(L.top)
          expect(y + L.fh / 2 + L.bob, name).toBeLessThanOrEqual(h)
        }
        for (const x of L.monX) {
          expect(x - L.mw / 2, name).toBeGreaterThanOrEqual(0)
          expect(x + L.mw / 2, name).toBeLessThanOrEqual(w)
        }
        expect(L.mh, name).toBeLessThanOrEqual(h * 0.7)
        if (duo) expect(L.monX[1] - L.monX[0], name).toBeGreaterThanOrEqual(L.mw)
        // the row of full monsters fits beside the star counter
        expect(L.slotAt((duo ? 4 : 5) - 1).x + L.mini / 2, name).toBeLessThanOrEqual(w - (L.wide ? 0 : L.hud * 2.7))
        expect(L.speed(19), name).toBeGreaterThanOrEqual(30)
        expect(L.speed(12), name).toBeLessThanOrEqual(130)
      }
    }
  })

  it('a tablet has two lanes, a phone held sideways one', () => {
    expect(layoutFor(1024, 698).lanes.length).toBe(2)
    expect(layoutFor(390, 774).lanes.length).toBe(2)
    expect(layoutFor(844, 320).lanes.length).toBe(1)
  })

  it('a spat-out thing lands on the stage, beside its monster where there is room', () => {
    for (const [name, [w, h]] of Object.entries(sizes)) {
      const L = layoutFor(w, h)
      for (let n = 0; n < 4; n++) {
        const s = spitSpot(L, L.monX, 0, n)
        expect(s.x - s.size / 2, name).toBeGreaterThanOrEqual(0)
        expect(s.x + s.size / 2, name).toBeLessThanOrEqual(w)
        expect(s.y + s.size / 2, name).toBeLessThanOrEqual(h)
      }
      const D = layoutFor(w, h, { duo: true, slots: 4 })
      expect(spitSpot(D, D.monX, 0, 0).x, name).toBeLessThan(D.monX[0])
      expect(spitSpot(D, D.monX, 1, 0).x, name).toBeGreaterThan(D.monX[1])
    }
  })

  it('the monster grows with every bite', () => {
    expect(scaleAt(0, 5)).toBe(START_SCALE)
    expect(scaleAt(5, 5)).toBe(1)
    for (let b = 1; b <= 5; b++) expect(scaleAt(b, 5) - scaleAt(b - 1, 5)).toBeGreaterThan(0.05)
  })
})
