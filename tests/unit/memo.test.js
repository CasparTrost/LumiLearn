import { describe, it, expect } from 'vitest'
import { levelConfig, buildCards, bestGrid, cellPos, starsFor, ALL_PICTURES } from '../../src/games/memo/layout.js'
import { skillFor, viewOf, observe, forget, chooseFirst, chooseSecond } from '../../src/games/memo/lumi.js'

// the same numbers every run
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('Memo-Welt: levels and cards', () => {
  it('plays alone at 1–2, against Lumi from 3, with a joker from 5', () => {
    for (let l = 1; l <= 10; l++) {
      const c = levelConfig(l)
      expect(c.versus).toBe(l >= 3)
      expect(c.joker).toBe(l >= 5)
      expect(c.cards).toBe(c.pairs * 2 + (c.joker ? 1 : 0))
      expect(c.preview).toBeGreaterThanOrEqual(4)
    }
    expect([1, 3, 5, 7, 9].map(l => levelConfig(l).pairs)).toEqual([4, 6, 8, 10, 12])
  })

  it('has no present among the pictures: every card back is one', () => {
    expect(ALL_PICTURES.some(([e]) => e === '🎁')).toBe(false)
  })

  it('deals pairs of two the same, and one joker from level 5', () => {
    for (let l = 1; l <= 10; l++) {
      const cards = buildCards(levelConfig(l), rng(l))
      const byPair = {}
      cards.forEach((c, i) => { expect(c.id).toBe(i); (byPair[c.pairKey] ??= []).push(c) })
      expect(cards.filter(c => c.joker).length).toBe(l >= 5 ? 1 : 0)
      Object.entries(byPair).filter(([k]) => k !== 'joker').forEach(([, two]) => {
        expect(two.length).toBe(2)
        expect(two[0].emoji).toBe(two[1].emoji)
      })
    }
  })
})

describe('Memo-Welt: the board', () => {
  it('lays 16 cards out 8 × 2 on a wide low screen, 4 × 4 on a square one', () => {
    expect(bestGrid(16, 1300, 380, 14)).toMatchObject({ cols: 8, rows: 2 })
    expect(bestGrid(16, 600, 600, 14)).toMatchObject({ cols: 4, rows: 4 })
  })

  it('keeps every card inside the grid and centres the last row', () => {
    const g = bestGrid(17, 900, 500, 14)
    const w = g.cols * g.s + (g.cols - 1) * 14, h = g.rows * g.s + (g.rows - 1) * 14
    const ps = Array.from({ length: 17 }, (_, i) => cellPos(i, 17, g, 14))
    ps.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x + g.s).toBeLessThanOrEqual(w + 0.5)
      expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y + g.s).toBeLessThanOrEqual(h + 0.5)
    })
    const last = ps.filter(p => p.y === (g.rows - 1) * (g.s + 14))
    const left = last[0].x, right = w - (last[last.length - 1].x + g.s)
    expect(Math.abs(left - right)).toBeLessThan(1)
  })
})

// A whole game: the child (who remembers `kid` of what it sees, and keeps
// `preview` cards from the preview) against Lumi at `level`
function play(level, kid, preview, seed) {
  const r = rng(seed)
  const cfg = { ...levelConfig(level), joker: false }
  const cards = buildCards(cfg, r)
  const cols = 5
  const lumi = new Map(), child = new Map()
  const lumiSkill = skillFor(level), childSkill = { notice: kid, slip: 0.1 }
  cards.slice().sort(() => r() - 0.5).slice(0, preview).forEach(c => child.set(c.id, c.pairKey))
  let turn = 'child'
  const score = { child: 0, lumi: 0 }
  for (let left = cfg.pairs, guard = 0; left && guard < 2000; guard++) {
    const mem = turn === 'child' ? child : lumi
    const show = id => {
      cards[id].flipped = true
      observe(child, { id, pairKey: cards[id].pairKey }, viewOf(cards), cols, childSkill, r)
      observe(lumi, { id, pairKey: cards[id].pairKey }, viewOf(cards), cols, lumiSkill, r)
    }
    const a = chooseFirst(mem, viewOf(cards), r); show(a)
    const b = chooseSecond(mem, viewOf(cards), { id: a, pairKey: cards[a].pairKey }, r); show(b)
    if (cards[a].pairKey === cards[b].pairKey) {
      cards[a].matched = cards[b].matched = true
      forget(child, [a, b]); forget(lumi, [a, b])
      score[turn]++; left--
    } else turn = turn === 'child' ? 'lumi' : 'child'
    cards[a].flipped = cards[b].flipped = false
  }
  return score
}

describe('Memo-Welt: Lumi as an opponent', () => {
  it('sees no picture of a face-down card', () => {
    const cards = buildCards(levelConfig(5), rng(3))
    cards[2].flipped = true
    const view = viewOf(cards)
    view.forEach((v, i) => expect(v.pairKey).toBe(i === 2 ? cards[2].pairKey : undefined))
  })

  it('guesses at chance when it has seen nothing (it never uses what it cannot know)', () => {
    let hits = 0, n = 4000
    for (let i = 0; i < n; i++) {
      const r = rng(1000 + i)
      const cards = buildCards(levelConfig(3), r)   // 12 cards
      const mem = new Map()
      const a = chooseFirst(mem, viewOf(cards), r)
      cards[a].flipped = true
      const b = chooseSecond(mem, viewOf(cards), { id: a, pairKey: cards[a].pairKey }, r)
      if (cards[a].pairKey === cards[b].pairKey) hits++
    }
    // one partner among 11 cards
    expect(hits / n).toBeGreaterThan(1 / 11 - 0.02)
    expect(hits / n).toBeLessThan(1 / 11 + 0.02)
  })

  it('takes a pair it remembers, and its mistakes are the card next to the right one', () => {
    const cards = buildCards(levelConfig(3), rng(9))
    const view = viewOf(cards)
    const [x, y] = cards.filter(c => c.pairKey === cards[0].pairKey).map(c => c.id)
    const mem = new Map([[x, cards[x].pairKey], [y, cards[y].pairKey]])
    expect([x, y]).toContain(chooseFirst(mem, view, rng(1)))
    // a slip: noticed one place off
    const m2 = observe(new Map(), { id: 5, pairKey: 'p9' }, view, 4, { notice: 0, slip: 1 }, rng(2))
    const [[where]] = [...m2.entries()]
    expect([1, 4, 6, 9]).toContain(where)
  })

  it('is nearly always beaten by an attentive child at level 3, and a fair match at level 10', () => {
    const rate = (level, kid, preview) => {
      let won = 0
      for (let i = 0; i < 400; i++) { const s = play(level, kid, preview, i * 7 + level); if (s.child > s.lumi) won++ }
      return won / 400
    }
    expect(rate(3, 0.9, 0)).toBeGreaterThan(0.9)
    const top = rate(10, 0.6, 2)
    expect(top).toBeGreaterThan(0.25)
    expect(top).toBeLessThan(0.8)
    // Lumi gets better with the level
    expect(rate(10, 0.6, 2)).toBeLessThan(rate(3, 0.6, 2))
  })
})

describe('Memo-Welt: stars', () => {
  it('alone: by tries, as before', () => {
    expect(starsFor({ versus: false, pairs: 4, tries: 6 })).toBe(3)
    expect(starsFor({ versus: false, pairs: 4, tries: 10 })).toBe(2)
    expect(starsFor({ versus: false, pairs: 4, tries: 11 })).toBe(1)
  })
  it('against Lumi: only the tries the child could have got right count', () => {
    expect(starsFor({ versus: true, pairs: 8, tries: 30, forgotten: 0 })).toBe(3)
    expect(starsFor({ versus: true, pairs: 8, tries: 30, forgotten: 2 })).toBe(3)
    expect(starsFor({ versus: true, pairs: 8, tries: 30, forgotten: 5 })).toBe(2)
    expect(starsFor({ versus: true, pairs: 8, tries: 30, forgotten: 6 })).toBe(1)
  })
})
