import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LINES, line, gameLine, helpLine, RECORD_LATER } from '../../src/lib/lumiLines.js'
import { MODULES, WORLDS } from '../../src/modules.js'

const ROOT = join(import.meta.dirname, '..', '..')
const list = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? list(p) : [p]
})

describe("Lumi's recorded sentences", () => {
  it('every sentence has its recording, and every recording a sentence', () => {
    for (const key of Object.keys(LINES)) {
      // (Lumis Freunde: written, to be recorded; skipped while missing)
      if (RECORD_LATER.test(key) && !existsSync(join(ROOT, 'public', line(key).src))) continue
      expect(existsSync(join(ROOT, 'public', line(key).src)), key).toBe(true)
    }
    const files = list(join(ROOT, 'public', 'audio', 'lumi'))
      .map(p => p.split(join('audio', 'lumi') + '/')[1].replace(/\.mp3$/, ''))
    expect(files.filter(k => !(k in LINES))).toEqual([])
  })

  it('a game tile says what modules.js says, the help names the game', () => {
    for (const m of MODULES) {
      expect(gameLine(m.id)?.text, m.id).toBe(m.say)
      expect(helpLine(m.id)?.text.startsWith(`${m.title}. `), m.id).toBe(true)
    }
    for (const w of WORLDS) expect(LINES[`menue/welt-${w.id}`], w.id).toBe(w.say)
  })

  // The help dialog shows a text and Lumi reads the recording: they have to
  // be the same sentence (four recordings had fallen a sentence behind the
  // dialog). An entry marked `fresh` is new text waiting for its recording.
  it('the help Lumi reads is the help the dialog shows', () => {
    const src = readFileSync(join(ROOT, 'src', 'components', 'InfoButton.jsx'), 'utf8')
    const entries = [...src.matchAll(/\n {2}'?([\w-]+)'?:\s+\{ emoji: '[^']*', title: '([^']*)', text: '((?:[^'\\]|\\.)*)'(, fresh: true)? \},/g)]
    expect(entries.length).toBe(MODULES.length)
    for (const [, id, title, text, fresh] of entries) {
      expect(MODULES.find(m => m.id === id)?.title, id).toBe(title)
      if (!fresh) expect(LINES[`hilfe/hilfe-${id}`], id).toBe(`${title}. ${text}`)
    }
  })

  it('every sentence the code asks for exists', () => {
    const keys = new Set()
    for (const f of list(join(ROOT, 'src')).filter(p => /\.(js|jsx)$/.test(p))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/line\('([a-z]+\/[a-z0-9-]+)'\)/g)) keys.add(m[1])
    }
    expect(keys.size).toBeGreaterThan(20)
    expect([...keys].filter(k => !(k in LINES))).toEqual([])
    expect(() => line('nope/nope')).toThrow()
  })
})
