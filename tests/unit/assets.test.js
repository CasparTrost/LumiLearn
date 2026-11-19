// The code and the files in public/ must agree. Each of these broke once:
// pictures missing for emoji the games show, recordings renamed, coloring
// pages replaced, a game without help text.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODULES } from '../../src/modules.js'
import { MAX_LEVELS } from '../../src/AppContext.jsx'
import { emojiCode } from '../../src/lib/emojiArt.jsx'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const PUBLIC = join(ROOT, 'public')

function sources(dir = join(ROOT, 'src')) {
  return readdirSync(dir).flatMap(f => {
    const p = join(dir, f)
    if (statSync(p).isDirectory()) return sources(p)
    return /\.(js|jsx)$/.test(f) && f !== 'emojiArtList.js' ? [[p, readFileSync(p, 'utf8')]] : []
  })
}
const SRC = sources()
// comments may name an emoji without showing it ("instead of ◀▶")
const code = text => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/.*$/gm, '$1')
const rel = p => p.slice(ROOT.length + 1)

// same marks scripts/generate-emoji-art.py leaves out: typographic, not pictures
const SKIP = new Set(['✦', '✧', '〰', '↔', '⌫'])
const EMOJI = /\p{Regional_Indicator}{2}|\p{Extended_Pictographic}️?\p{Emoji_Modifier}?(?:‍\p{Extended_Pictographic}️?\p{Emoji_Modifier}?)*/gu

describe('pictures', () => {
  it('every emoji in the code has a picture', () => {
    const missing = new Set()
    for (const [p, text] of SRC) {
      for (const [e] of code(text).matchAll(EMOJI)) {
        if (SKIP.has(e.replace('️', ''))) continue
        if (!existsSync(join(PUBLIC, 'sprites', 'emoji', emojiCode(e) + '.webp'))) missing.add(`${e} (${rel(p)})`)
      }
    }
    expect([...missing]).toEqual([])
  })
  it('every :px-name: picture exists', () => {
    const missing = new Set()
    for (const [p, text] of SRC) for (const [, n] of text.matchAll(/:px-([a-z0-9-]+):/g)) {
      if (!existsSync(join(PUBLIC, 'sprites', 'emoji', 'custom', n + '.webp'))) missing.add(`${n} (${rel(p)})`)
    }
    expect([...missing]).toEqual([])
  })
})

describe('recordings', () => {
  it('every audio path written in the code exists', () => {
    const missing = []
    for (const [p, text] of SRC) for (const [path] of text.matchAll(/audio\/[a-z0-9/_-]+\.mp3/g)) {
      if (!existsSync(join(PUBLIC, path))) missing.push(`${path} (${rel(p)})`)
    }
    expect(missing).toEqual([])
  })
  it('every Gefühlswelt clip name exists', () => {
    const text = readFileSync(join(ROOT, 'src/games/EmotionGame.jsx'), 'utf8')
    const names = new Set([
      ...[...text.matchAll(/audio:\s*\[([^\]]*)\]/g)].flatMap(m => [...m[1].matchAll(/'([a-z0-9-]+)'/g)].map(x => x[1])),
      ...[...text.matchAll(/clip\('([a-z0-9-]+)'\)/g)].map(m => m[1]),
      ...[...(text.match(/const EMOTION_AUDIO = \{[^}]*\}/)?.[0] ?? '').matchAll(/:\s*'([a-z0-9-]+)'/g)].map(m => m[1]),
    ])
    expect(names.size).toBeGreaterThan(5)
    const missing = [...names].filter(n => !existsSync(join(PUBLIC, 'audio', 'gefuehlswelt', n + '.mp3')))
    expect(missing).toEqual([])
  })
  it('every number and letter question clip exists', () => {
    for (const n of ['eins', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sieben', 'acht', 'neun', 'zehn'])
      expect(existsSync(join(PUBLIC, 'audio', 'zahlen-entdecken', n + '.mp3')), n).toBe(true)
    // ABC-Abenteuer asks "Welches Wort beginnt mit …" for the letters it uses
    const abc = readFileSync(join(ROOT, 'src/games/LetterIntroGame.jsx'), 'utf8')
    const letters = new Set([...abc.matchAll(/letter:\s*'([A-Z])'/g)].map(m => m[1].toLowerCase()))
    const missing = [...letters].filter(l => !existsSync(join(PUBLIC, 'audio', 'abc-abenteuer', `welches-wort-beginnt-mit-${l}.mp3`)))
    // letters without a recording fall back to speech; there must not be more than before
    expect(missing.sort()).toEqual(missing.filter(l => 'cqxy'.includes(l)).sort())
  })
})

describe('games', () => {
  const read = f => readFileSync(join(ROOT, f), 'utf8')
  const gameScreen = read('src/screens/GameScreen.jsx')
  const help = read('src/components/InfoButton.jsx')
  for (const m of MODULES) {
    it(`${m.id}: playable, with levels and help`, () => {
      expect(gameScreen).toMatch(new RegExp(`['\\s]${m.id}'?\\s*:`))
      expect(MAX_LEVELS[m.id], 'MAX_LEVELS').toBeGreaterThan(0)
      expect(help).toMatch(new RegExp(`['\\s]${m.id}'?\\s*:\\s*\\{`))
    })
  }
  it('every coloring page exists', () => {
    const text = read('src/games/ColoringGame.jsx')
    const files = [...text.matchAll(/images\/coloring\/([a-z0-9-]+\.png)/g)].map(m => m[1])
    expect(files.length).toBeGreaterThanOrEqual(6)
    for (const f of files) expect(existsSync(join(PUBLIC, 'images', 'coloring', f)), f).toBe(true)
  })
})
