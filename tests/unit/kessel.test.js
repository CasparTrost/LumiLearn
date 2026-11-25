import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { WORDS, ANLAUT, ALPHABET, ROWS, wordKey, pickWords, moveOf } from '../../src/games/kessel/words.js'
import { LINES } from '../../src/lib/lumiLines.js'
import { emojiCode, customName } from '../../src/lib/emojiArt.jsx'
import { EMOJI_ART } from '../../src/lib/emojiArtList.js'

const hasPicture = art => (customName(art)
  ? existsSync(`public/sprites/emoji/custom/${customName(art)}.webp`)
  : EMOJI_ART.has(emojiCode(art)))

describe('Buchstabenwald: words and key pictures', () => {
  it('has a picture and a recording for every word', () => {
    for (const [w, art] of Object.entries(WORDS)) {
      expect(hasPicture(art), w).toBe(true)
      const key = wordKey(w)
      expect(key, w).not.toBeNull()
      expect(existsSync(`public/audio/lumi/${key}.mp3`), w).toBe(true)
    }
  })

  it('only has words a child can type on the keyboard, of three to eight letters', () => {
    const keys = new Set(ROWS.flat())
    for (const w of Object.keys(WORDS)) {
      expect(w.length, w).toBeGreaterThanOrEqual(3)
      expect(w.length, w).toBeLessThanOrEqual(8)
      for (const c of w) expect(keys.has(c), `${w}: ${c}`).toBe(true)
    }
    expect(new Set(ROWS.flat())).toEqual(new Set(ALPHABET))
  })

  it('has none of the words the logic check rejected', () => {
    for (const w of ['FUSS', 'WURST', 'NUDEL', 'TORTE', 'ARM', 'GELD', 'SOCKE', 'UHR', 'JACKE', 'OTTER', 'TRUTHAHN', 'PFAU', 'AXT']) {
      expect(WORDS[w], w).toBeUndefined()
    }
  })

  it('never shows one picture for two words', () => {
    const arts = Object.values(WORDS)
    expect(new Set(arts).size).toBe(arts.length)
  })

  it('has enough words for every level', () => {
    for (const [min, max, n] of [[3, 3, 6], [4, 4, 6], [5, 5, 6], [4, 5, 6], [5, 6, 6], [6, 7, 6], [7, 8, 6]]) {
      expect(pickWords([min, max], n).length, `${min}-${max}`).toBe(n)
    }
    expect(pickWords([3, 3], 6, ['OMA'])).not.toContain('OMA')
  })

  it('shows a picture of a word that starts with the key\'s letter, and none of another letter\'s word', () => {
    const owner = Object.fromEntries(Object.entries(WORDS).map(([w, art]) => [art, w]))
    for (const [c, [name, art]] of Object.entries(ANLAUT)) {
      expect(name[0].toUpperCase(), c).toBe(c)
      expect(hasPicture(art), c).toBe(true)
      // a child looking for the picture of the word must land on its first letter
      if (owner[art]) expect(owner[art][0], `${c}: ${owner[art]}`).toBe(c)
    }
    // two keys never share a picture
    const arts = Object.values(ANLAUT).map(([, a]) => a)
    expect(new Set(arts).size).toBe(arts.length)
    // the doubtful ones have no picture at all
    for (const c of ['Y', 'Ä', 'Ö', 'Ü']) expect(ANLAUT[c], c).toBeUndefined()
  })

  it('follows the app\'s recorded alphabet where it can', () => {
    for (const [c, [name]] of Object.entries(ANLAUT)) {
      const said = LINES[`abc/${c.toLowerCase()}`]
      if (['J', 'U', 'X'].includes(c)) continue
      expect(said, c).toBe(`${c} wie ${name}.`)
    }
  })

  it('lets houses grow and snails crawl', () => {
    expect(moveOf('HAUS')).toBe('grow')
    expect(moveOf('BAUM')).toBe('grow')
    expect(moveOf('SCHNECKE')).toBe('crawl')
    expect(moveOf('MUSCHEL')).not.toBe('swim')
    expect(moveOf('BUCH')).toBe('bounce')
  })
})
