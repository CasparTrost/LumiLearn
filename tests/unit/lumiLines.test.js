import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { LINES, line, gameLine, helpLine } from '../../src/lib/lumiLines.js'
import { MODULES, WORLDS } from '../../src/modules.js'
import { ALL_MISSIONS } from '../../src/AppContext.jsx'
import { translations } from '../../src/i18n.js'

const ROOT = join(import.meta.dirname, '..', '..')
const list = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? list(p) : [p]
})

describe("Lumi's recorded sentences", () => {
  it('every sentence has its recording, and every recording a sentence', () => {
    for (const key of Object.keys(LINES)) {
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

  it('the daily tasks say what the mission text says', () => {
    for (const m of ALL_MISSIONS.filter(x => !x.retired)) {
      expect(LINES[`tagesaufgaben/aufgabe-${m.id}`], m.id).toBe(translations.de['mission.say.' + m.id])
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
