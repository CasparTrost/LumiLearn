import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LINES } from '../../src/lib/lumiLines.js'
import {
  HELD, isHeld, letterKey, soundKey, soundLikeKey, keyWordOf,
} from '../../src/games/buchstaben/voice.js'
import { KEY } from '../../src/games/woerter/voice.js'

// The letters whose recorded sound has a schwa: "Bö", "Lö wie Löwe!"
const SCHWA = [...'bcdghjklnpqrtwyz']
const isSchwaKey = k => {
  const m = /^laute?\/([a-z])(?:-wie-[a-z-]+)?$/.exec(k)
  return !!m && SCHWA.includes(m[1])
}

function files(dir) {
  return readdirSync(dir).flatMap(n => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? files(p) : /\.(jsx?|mjs)$/.test(n) ? [p] : []
  })
}

describe('letter sounds: never "Bö" or "Lö wie Löwe!"', () => {
  it('the helpers give a held sound, a vowel, or the letter\'s name sentence', () => {
    for (const c of 'abcdefghijklmnopqrstuvwxyz') {
      for (const k of [soundKey(c), letterKey(c), KEY.sound(c)]) {
        expect(isSchwaKey(k), `${c}: ${k}`).toBe(false)
        expect(LINES[k], `${c}: ${k}`).toBeTruthy()
      }
      for (const w of ['Löwe', 'Maus', 'Bär', 'Leiter', 'Ufo', 'Jacke', keyWordOf(c) ?? 'Affe']) {
        expect(isSchwaKey(soundLikeKey(c, w)), `${c} ${w}`).toBe(false)
        expect(isSchwaKey(KEY.anlaut(c, w)), `${c} ${w}`).toBe(false)
      }
    }
    expect(isHeld('M') && isHeld('a') && isHeld('Ü') && !isHeld('L') && !isHeld('b')).toBe(true)
    expect(SCHWA.some(c => HELD.includes(c))).toBe(false)
    // L is named with its key word; M is its sound with its key word
    expect(soundKey('L')).toBe('abc/l')
    expect(soundLikeKey('L', 'Löwe')).toBe('abc/l')
    expect(soundLikeKey('L', 'Leiter')).toBe('woerter/leiter')
    expect(soundLikeKey('M', 'Maus')).toBe('laut/m-wie-maus')
    // the owl is "Eule": U is named with the Ufo, not with abc/u ("U wie Uhu")
    expect(letterKey('U')).toBe('laut/u-wie-ufo')
  })

  it('no game file names a schwa sound key itself', () => {
    const bad = []
    for (const f of files('src')) {
      if (f.endsWith('lumiLines.js')) continue
      const text = readFileSync(f, 'utf8')
      // a written key ('laute/l', "laut/l-wie-loewe") …
      for (const m of text.matchAll(/['"`](laute?\/[a-z]+(?:-wie-[a-z-]+)?)['"`]/g)) if (isSchwaKey(m[1])) bad.push(`${f}: ${m[1]}`)
      // … or one built from a letter (`laut/${…}`): only buchstaben/voice.js may
      if (!f.endsWith(join('buchstaben', 'voice.js')) && /`laute?\/\$\{/.test(text)) bad.push(`${f}: builds a laut/laute key`)
    }
    expect(bad).toEqual([])
  })
})
