import { describe, it, expect } from 'vitest'
import { PAINTS, COLORS, LEVELS, MAX_SQUIRTS, mixOf, recipeOf, hexOf, planLevel } from '../../src/games/farbdusche/colors.js'
import { layoutFor, slotAt } from '../../src/games/farbdusche/layout.js'
import { LINES } from '../../src/lib/lumiLines.js'

// Farbenreich: the paint shower (src/games/PainterGame.jsx)

describe('mixing paint', () => {
  it('gives the recipes a child should learn', () => {
    const want = {
      'rot': 'rot', 'gelb': 'gelb', 'blau': 'blau', 'weiß': 'weiß', 'schwarz': 'schwarz',
      'rot+gelb': 'orange', 'gelb+blau': 'grün', 'rot+blau': 'lila', 'rot+weiß': 'pink', 'blau+weiß': 'hellblau',
      'gelb+blau+weiß': 'hellgrün', 'weiß+schwarz': 'grau', 'rot+gelb+blau': 'braun', 'rot+gelb+schwarz': 'braun',
      'rot+schwarz': 'dunkelrot', 'blau+schwarz': 'dunkelblau',
    }
    for (const [mix, color] of Object.entries(want)) expect(mixOf(mix.split('+')), mix).toBe(color)
  })
  it('does not care about the order, and the same paint twice is that paint', () => {
    expect(mixOf(['gelb', 'rot'])).toBe('orange')
    expect(mixOf(['blau', 'blau'])).toBe('blau')
    expect(mixOf(['weiß', 'blau', 'gelb'])).toBe('hellgrün')
    expect(mixOf(['rot', 'gelb', 'rot'])).toBe('orange')
    expect(mixOf([])).toBe(null)
  })
  it('shows something for every tank a child can fill', () => {
    const tanks = []
    for (const a of PAINTS) for (const b of PAINTS) for (const c of PAINTS) tanks.push([a], [a, b], [a, b, c])
    for (const tank of tanks) {
      const color = mixOf(tank)
      expect(COLORS[color], tank.join('+')).toBeTruthy()
      expect(hexOf(color)).toMatch(/^#[0-9a-f]{6}$/)
    }
  })
  it('has a recipe that really makes each colour', () => {
    for (const id of Object.keys(COLORS)) expect(mixOf(recipeOf(id)), id).toBe(id)
  })
  it('gives every colour its own look', () => {
    const hexes = Object.values(COLORS).map(c => c.hex)
    expect(new Set(hexes).size).toBe(hexes.length)
  })
})

describe('levels of the paint shower', () => {
  const plans = LEVELS.flatMap((_, i) => Array.from({ length: 30 }, () => ({ level: i + 1, plan: planLevel(i + 1) })))
  it('asks only for colours the taps of the level can mix', () => {
    for (const { level, plan } of plans) {
      for (const m of plan.monsters) {
        const recipe = recipeOf(m.target)
        expect(recipe.length, `level ${level} ${m.target}`).toBeLessThanOrEqual(MAX_SQUIRTS)
        expect(recipe.every(p => plan.taps.includes(p)), `level ${level} ${m.target}`).toBe(true)
      }
    }
  })
  it('has five to eight monsters, never the same wish twice in a row', () => {
    for (const { level, plan } of plans) {
      expect(plan.monsters.length).toBe(LEVELS[level - 1].n)
      expect(plan.monsters.length).toBeGreaterThanOrEqual(5)
      expect(plan.monsters.length).toBeLessThanOrEqual(8)
      plan.monsters.forEach((m, i) => { if (i) expect(m.target === plan.monsters[i - 1].target, `level ${level}`).toBe(false) })
    }
  })
  it('grows: one squirt first, mixes of two, then white, black and three squirts', () => {
    const most = level => Math.max(...plans.filter(p => p.level === level).flatMap(p => p.plan.monsters.map(m => recipeOf(m.target).length)))
    expect(most(1)).toBe(1)
    expect(most(2)).toBe(1)
    expect(most(3)).toBe(2)
    expect(most(4)).toBe(2)
    expect(most(5)).toBe(3)
    expect(most(10)).toBe(3)
    for (const { level, plan } of plans) expect(plan.line).toBe(level >= 9)
  })
  it('shows the recipe of a new colour once, in the teaching levels only', () => {
    for (const { level, plan } of plans) {
      const shown = plan.monsters.filter(m => m.recipe).map(m => m.target)
      expect(new Set(shown).size).toBe(shown.length)
      if (![3, 5, 7].includes(level)) expect(shown.length, `level ${level}`).toBe(0)
      else {
        expect(shown.length).toBe(LEVELS[level - 1].must.length)
        expect(plan.monsters[0].recipe, `level ${level} opens with something known`).toBe(false)
      }
    }
  })
  it('wishes almost only for colours Lumi can say', () => {
    const silent = new Set()
    for (const { plan } of plans) for (const m of plan.monsters) {
      const key = `farbe/${COLORS[m.target].word.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')}`
      if (!LINES[key]) silent.add(m.target)
    }
    // these follow the rule "white makes it lighter, black darker"; their
    // words are asked for and the game stays silent until they are recorded
    for (const id of silent) expect(['hellblau', 'dunkelrot', 'dunkelblau', 'helllila', 'dunkelgrün']).toContain(id)
  })
})

describe('layout of the paint shower', () => {
  // play areas: tablet, phone upright, phone sideways, a small phone both ways
  const areas = [[1024, 692], [390, 772], [844, 314], [360, 668], [740, 284], [768, 948], [1440, 824]]
  const cases = areas.flatMap(([w, h]) => [[3, 5, false], [5, 6, false], [5, 8, true]].map(([taps, total, line]) => ({ w, h, taps, total, line, L: layoutFor(w, h, taps, total, line) })))
  it('keeps everything on the canvas', () => {
    for (const { w, h, taps, L } of cases) {
      const where = `${w}×${h}, ${taps} taps`
      const rects = [
        ...L.taps.map(t => ({ x: t.x, y: t.y, w: t.size, h: t.size * 1.1 })),
        { x: L.lever.x, y: L.lever.y, w: L.lever.size, h: L.lever.size },
        { x: L.drain.x, y: L.drain.y, w: L.drain.size, h: L.drain.size },
        { x: L.machine.x, y: L.machine.y, w: L.machine.w, h: L.machine.h },
        L.bubble, L.bubbleCmp,
        ...(L.queue ? [{ x: L.queue.x, y: L.queue.y, w: L.queue.size, h: L.queue.size }, L.queueBubble] : []),
      ]
      for (const r of rects) {
        expect(r.x, where).toBeGreaterThanOrEqual(0)
        expect(r.y, where).toBeGreaterThanOrEqual(0)
        expect(r.x + r.w, where).toBeLessThanOrEqual(L.cw + 0.5)
        expect(r.y + r.h, where).toBeLessThanOrEqual(L.ch + 0.5)
      }
    }
  })
  it('makes taps and lever big enough for a small finger', () => {
    for (const { w, h, L } of cases) {
      for (const t of L.taps) expect(t.size * L.s, `${w}×${h} tap`).toBeGreaterThanOrEqual(64)
      expect(L.lever.size * L.s, `${w}×${h} lever`).toBeGreaterThanOrEqual(64)
    }
  })
  it('gives every monster of the level a place in the parade', () => {
    for (const { total, L } of cases) {
      const places = Array.from({ length: total }, (_, i) => slotAt(L.shelf, i))
      for (const p of places) {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x + p.size).toBeLessThanOrEqual(L.cw + 0.5)
        expect(p.y + p.size).toBeLessThan(L.ch)
      }
      expect(new Set(places.map(p => `${Math.round(p.x)}/${Math.round(p.y)}`)).size).toBe(total)
    }
  })
})
