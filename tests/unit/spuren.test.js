import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { GLYPHS, LETTERS, DIGITS, lengths, arrowsAt, starsAt, SNAIL_AT } from '../../src/games/traceStrokes.js'
import { WORD, praiseOf, praiseKey } from '../../src/games/spuren/words.js'
import { bodyOf } from '../../src/games/spuren/alive.js'
import { LINES } from '../../src/lib/lumiLines.js'
import { emojiCode } from '../../src/lib/emojiArt.jsx'
import { EMOJI_ART } from '../../src/lib/emojiArtList.js'

const ALL = [...LETTERS, ...DIGITS]

describe('Buchstaben-Spuren: what a finished glyph says and shows', () => {
  it('says the recorded sentence with the letter\'s name, never the "Lö wie Löwe" ones', () => {
    for (const g of LETTERS) {
      expect(praiseKey(g)).toBe(`abc/${g.toLowerCase()}`)
      expect(praiseOf(g).line?.src, g).toBe(`audio/lumi/abc/${g.toLowerCase()}.mp3`)
      expect(existsSync(`public/audio/lumi/abc/${g.toLowerCase()}.mp3`), g).toBe(true)
      // the sentence begins with the letter itself: "L wie …", "X klingt …"
      expect(LINES[praiseKey(g)].startsWith(g + ' '), g).toBe(true)
    }
    for (const d of DIGITS) {
      expect(praiseOf(d).line?.src).toBe(`audio/lumi/ziffer/${d}.mp3`)
      expect(existsSync(`public/audio/lumi/ziffer/${d}.mp3`), d).toBe(true)
    }
  })

  it('shows the word of the recording, and the picture of that word', () => {
    for (const g of LETTERS) {
      const [word] = WORD[g]
      const said = LINES[praiseKey(g)]
      // every word shown is in the sentence Lumi says ("Hexe und Taxi" too)
      expect(said, g).toContain(word)
      expect(praiseOf(g).show, g).toContain(word)
      // "wie Löwe", but "wie in Taxi": X and Y are not at the beginning
      expect(praiseOf(g).show.startsWith('wie in '), g).toBe(!said.includes(`${g} wie `))
    }
  })

  it('has a picture for every letter, and no two letters share one', () => {
    const arts = LETTERS.map(g => WORD[g][1])
    expect(new Set(arts).size).toBe(26)
    for (const g of LETTERS) {
      const art = WORD[g][1]
      const custom = /^:px-([a-z0-9-]+):$/.exec(art)?.[1]
      if (custom) expect(existsSync(`public/sprites/emoji/custom/${custom}.webp`), g).toBe(true)
      else expect(EMOJI_ART.has(emojiCode(art)), `${g} ${art}`).toBe(true)
    }
    // the jacket is not the coat emoji, the owl is the Uhu, the dog the Hund
    expect(WORD.J[1]).toBe(':px-jacke:')
    expect(WORD.G).toEqual(['Giraffe', '🦒'])
    expect(WORD.H).toEqual(['Hund', '🐶'])
    expect(WORD.U).toEqual(['Uhu', '🦉'])
  })

  it('shows a digit with its number word and no picture (its dots are drawn)', () => {
    expect(praiseOf('3')).toMatchObject({ show: 'Drei', art: null })
    expect(praiseOf('0')).toMatchObject({ show: 'Null', art: null })
  })
})

describe('Buchstaben-Spuren: stars and arrows on a stroke', () => {
  for (const mode of ['all', 'start', 'none']) {
    it(`${mode}: the last star lies on the end of every stroke, the stars are in order`, () => {
      for (const g of ALL) {
        for (const stroke of GLYPHS[g]) {
          const len = lengths(stroke).at(-1)
          const stars = starsAt(stroke, mode)
          expect(stars.length, g).toBeGreaterThanOrEqual(1)
          expect(stars.length, g).toBeLessThanOrEqual(6)
          expect(stars.at(-1).s, g).toBeCloseTo(len)
          for (let i = 1; i < stars.length; i++) expect(stars[i].s - stars[i - 1].s, g).toBeGreaterThanOrEqual(16)
          // none under the snail that waits at the start
          expect(stars[0].s, g).toBeGreaterThanOrEqual(Math.min(len, SNAIL_AT + 13))
        }
      }
    })
  }

  it('gives fewer stars where the level shows fewer arrows', () => {
    const count = mode => ALL.reduce((n, g) => n + GLYPHS[g].reduce((m, s) => m + starsAt(s, mode).length, 0), 0)
    expect(count('all')).toBeGreaterThan(count('start'))
    expect(count('start')).toBeGreaterThan(count('none'))
    for (const g of ALL) for (const s of GLYPHS[g]) expect(starsAt(s, 'none')).toHaveLength(1)
  })

  it('keeps stars off the arrows', () => {
    for (const g of ALL) {
      for (const stroke of GLYPHS[g]) {
        const arrows = arrowsAt(stroke, 'all')
        for (const st of starsAt(stroke, 'all').slice(0, -1)) {
          for (const a of arrows) expect(Math.abs(a - st.s), g).toBeGreaterThanOrEqual(12)
        }
      }
    }
  })

  it('holds back the star on the start dot of a stroke that ends where it began', () => {
    for (const g of ['O', '0', '8']) expect(starsAt(GLYPHS[g][0], 'all').at(-1).late, g).toBe(true)
    for (const g of ['I', 'C', 'S', 'U', '9']) expect(starsAt(GLYPHS[g][0], 'all').at(-1).late, g).toBe(false)
    // only ever the last one
    for (const g of ALL) for (const s of GLYPHS[g]) expect(starsAt(s, 'all').slice(0, -1).some(st => st.late), g).toBe(false)
  })
})

describe('Buchstaben-Spuren: a finished glyph comes alive', () => {
  const inkNear = (g, p, r) => GLYPHS[g].flat().some(q => Math.hypot(q.x - p.x, q.y - p.y) <= r)

  it('has its eyes on the glyph or inside it, never in the air beside it', () => {
    for (const g of ALL) {
      const { face } = bodyOf(g)
      const pts = GLYPHS[g].flat()
      const on = inkNear(g, face, 8.5)
      const sides = [
        pts.some(p => p.x < face.x && Math.abs(p.y - face.y) <= 5),
        pts.some(p => p.x > face.x && Math.abs(p.y - face.y) <= 5),
        pts.some(p => p.y < face.y && Math.abs(p.x - face.x) <= 5),
        pts.some(p => p.y > face.y && Math.abs(p.x - face.x) <= 5),
      ].filter(Boolean).length
      expect(on || sides >= 3, g).toBe(true)
      // in the upper half, and inside the picture with both eyes
      expect(face.y, g).toBeLessThan(75)
      expect(face.x - 17, g).toBeGreaterThan(-2)
      expect(face.x + 17, g).toBeLessThan(102)
    }
    // the L and the J: on the upright
    expect(bodyOf('L').face.x).toBeCloseTo(30, 0)
    expect(bodyOf('J').face.x).toBeCloseTo(66, 0)
  })

  it('stands on two legs under its lowest ink, with the feet in the picture', () => {
    for (const g of ALL) {
      const { legs, box } = bodyOf(g)
      expect(legs, g).toHaveLength(2)
      expect(legs[1].x - legs[0].x, g).toBeGreaterThanOrEqual(13)
      for (const l of legs) {
        expect(inkNear(g, l, 9), g).toBe(true)
        expect(l.y, g).toBeGreaterThanOrEqual(box.y1 - 8)
        expect(l.y + 14.3, g).toBeLessThanOrEqual(148)     // the foot, inside the view (down to 148)
        expect(l.x - 3, g).toBeGreaterThan(0)
        expect(l.x + 7, g).toBeLessThan(104)
      }
    }
    // one under each foot of the A, side by side under the I
    expect(bodyOf('A').legs.map(l => Math.round(l.x))).toEqual([20, 80])
    expect(bodyOf('I').legs.map(l => Math.round(l.x))).toEqual([43, 57])
    // the Q stands under its bowl and its tail, not on the tail alone
    expect(bodyOf('Q').legs[0].x).toBeLessThan(50)
  })
})
