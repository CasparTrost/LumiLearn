import { describe, it, expect } from 'vitest'
import { LINES } from '../../src/lib/lumiLines.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'
import {
  RHYME_GROUPS, SCENES, VERSES, LEVELS, rimeOf, wordVoice, voiced, sceneOf, groupOf, buildRounds, verseReady, playableGroups,
} from '../../src/games/buchstaben/rhymes.js'

function seeded(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

describe('Reim-Theater: words', () => {
  it('colours the rhyme from the stressed vowel on', () => {
    expect(rimeOf('Krone')).toBe('one')
    expect(rimeOf('Zitrone')).toBe('one')
    expect(rimeOf('Maus')).toBe('aus')
    expect(rimeOf('Spiegel')).toBe('iegel')
    expect(rimeOf('Igel')).toBe('Igel')
    expect(rimeOf('Hahn')).toBe('ahn')
    expect(rimeOf('Fahne')).toBe('ahne')
    expect(rimeOf('Banane')).toBe('ane')
    expect(rimeOf('Schwein')).toBe('ein')
    expect(rimeOf('Eis')).toBe('Eis')
  })

  it('gives every word in a group the same rhyme', () => {
    for (const g of RHYME_GROUPS) {
      const ends = new Set(g.words.map(x => x.rime.toLowerCase().replace(/^(ie|i)/, 'i').replace(/h(?=[nl])/, '').replace(/oo/, 'o')))
      expect(ends.size, g.words.map(x => x.w).join('/')).toBe(1)
    }
  })

  it('has a picture for every word', () => {
    for (const g of RHYME_GROUPS) for (const x of g.words) expect(hasEmojiArt(x.e) || x.e.startsWith(':px-'), x.w).toBe(true)
  })

  it('falls back to the older wort/ recordings', () => {
    expect(wordVoice('Maus').src).toMatch(/woerter\/maus\.mp3$/)
    for (const w of ['Spiegel', 'Ziege', 'Trompete', 'Boot', 'Hand', 'Fahne', 'Turm']) expect(wordVoice(w)?.src, w).toMatch(/wort\//)
  })

  it('leaves out only the words that are recorded nowhere', () => {
    const silent = RHYME_GROUPS.flatMap(g => g.words).filter(x => !voiced(x.w)).map(x => x.w)
    // to be recorded as woerter/fliege, woerter/reis, woerter/strand
    expect(silent.every(w => ['Fliege', 'Reis', 'Strand'].includes(w))).toBe(true)
    for (const g of playableGroups()) for (const x of g.words) expect(voiced(x.w), x.w).toBe(true)
  })
})

describe('Reim-Theater: scenes and verses', () => {
  it('has each pair once, recorded with the text on the stage', () => {
    const seen = new Set()
    for (const s of SCENES) {
      const k = [s.first, s.second].sort().join('|')
      expect(seen.has(k), k).toBe(false)
      seen.add(k)
      expect(LINES[s.key], s.key).toBe(s.line)
      expect([s.first, s.second]).toContain(s.mover)
      expect(groupOf(s.first)).toBe(groupOf(s.second))
    }
  })

  it('has a scene for every two words that rhyme', () => {
    for (const g of RHYME_GROUPS) for (const a of g.words) for (const b of g.words) if (a !== b) expect(sceneOf(a.w, b.w), `${a.w}/${b.w}`).toBeTruthy()
  })

  it('places the pair as its line says', () => {
    const how = line => (/ auf /.test(line) ? 'on' : / (im|in) /.test(line) ? ['in', 'peek'] : / vor /.test(line) ? 'front' : / mit /.test(line) ? 'wear' : 'beside')
    for (const s of SCENES) {
      const want = how(s.line)
      if (Array.isArray(want)) expect(want, s.line).toContain(s.place.how)
      else expect(s.place.how, s.line).toBe(want)
    }
  })

  it('has every verse recorded, and its answer rhymes with its base', () => {
    for (const v of VERSES) {
      expect(LINES[`reim/vers-${v.slug}`], v.base).toBe(v.line)
      expect(LINES[`reim/vers-${v.slug}-ganz`], v.base).toBe(v.line.replace(' …', ` ${v.answer}!`))
      expect(groupOf(v.base)).toBe(groupOf(v.answer))
      expect([v.base, v.answer]).toContain(v.mover)
    }
  })
})

describe('Reim-Theater: rounds', () => {
  const rhymes = (a, b) => groupOf(a.w) === groupOf(b.w)
  it('Ja/Nein: exactly half of the pairs rhyme, not always in the same order', () => {
    const orders = new Set()
    for (let seed = 1; seed <= 60; seed++) {
      const rounds = buildRounds(4, { rnd: seeded(seed) })
      expect(rounds.filter(r => r.rhymes)).toHaveLength(4)
      orders.add(rounds.map(r => (r.rhymes ? 'j' : 'n')).join(''))
    }
    expect(orders.size).toBeGreaterThan(10)
  })

  for (let level = 1; level <= LEVELS.length; level++) {
    it(`level ${level}: every round can be heard and has one right answer`, () => {
      for (let seed = 1; seed <= 60; seed++) {
        const rounds = buildRounds(level, { rnd: seeded(seed) })
        expect(rounds).toHaveLength(8)
        for (const r of rounds) {
          if (r.mode === 'yesno') {
            expect(voiced(r.base.w) && voiced(r.other.w)).toBe(true)
            expect(rhymes(r.base, r.other)).toBe(r.rhymes)
            if (r.rhymes) expect(sceneOf(r.base.w, r.other.w)).toBeTruthy()
            continue
          }
          expect(new Set(r.options.map(o => o.w)).size).toBe(r.options.length)
          for (const o of r.options) expect(voiced(o.w), o.w).toBe(true)
          if (r.mode === 'odd') {
            expect(r.options.filter(o => !rhymes(o, r.base))).toEqual([r.correct])
            expect(rhymes(r.base, r.partner) && r.base !== r.partner).toBe(true)
            continue
          }
          expect(r.options.filter(o => rhymes(o, r.correct))).toEqual([r.correct])
          expect(r.options).toHaveLength(LEVELS[level - 1].options)
          if (r.mode === 'pick') {
            expect(voiced(r.base.w)).toBe(true)
            expect(r.correct.said, r.correct.w).toBe(false)
            expect(rhymes(r.base, r.correct) && r.base !== r.correct).toBe(true)
          } else {
            expect(verseReady(r.verse)).toBe(true)
            for (const o of r.options) expect(r.verse.not, `${r.verse.line} ${o.w}`).not.toContain(o.w)
          }
        }
      }
    })
  }
})
