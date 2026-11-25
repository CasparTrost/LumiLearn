import { describe, it, expect } from 'vitest'
import { THINGS, ROOMS, ROOM_IDS, LEVELS, CAT, planLevel, planRoom, levelConfig, tasksIn } from '../../src/games/schatten/data.js'
import { layoutFor, MIN_CARD } from '../../src/games/schatten/layout.js'
import { makeRoom, spawn, step, flee, inLight, lookOf } from '../../src/games/schatten/sim.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'
import { LINES } from '../../src/lib/lumiLines.js'

// Schattenrätsel: Taschenlampen-Jagd (src/games/ShadowGame.jsx)

const seeded = seed => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}
const group = e => THINGS[e].group

describe('what hides in the rooms', () => {
  it('has a picture and a recorded word for every thing', () => {
    for (const [e, t] of Object.entries(THINGS)) {
      expect(hasEmojiArt(e), `${t.name} ${e}`).toBe(true)
      expect(LINES[t.word], `${t.name}: ${t.word}`).toBeTruthy()
    }
    expect(hasEmojiArt(CAT)).toBe(true)
    for (const e of ['🔦', '💡', '👋', '👆']) expect(hasEmojiArt(e)).toBe(true)
  })

  it('puts only known things into the rooms, each room with enough kinds for the top level', () => {
    for (const id of ROOM_IDS) {
      for (const e of ROOMS[id]) expect(THINGS[e], `${id}: ${e}`).toBeTruthy()
      const most = Math.max(...LEVELS.map(l => l.n + l.extra))
      expect(ROOMS[id].length).toBeGreaterThanOrEqual(most)
    }
  })
})

describe('a level', () => {
  it('has the rooms, shadows and cards its level asks for, with no thing twice', () => {
    for (let level = 1; level <= 10; level++) {
      const cfg = levelConfig(level)
      for (let seed = 1; seed <= 50; seed++) {
        const plan = planLevel(level, seeded(seed * 31 + level))
        expect(plan).toHaveLength(cfg.rooms)
        expect(new Set(plan.map(r => r.theme)).size).toBe(cfg.rooms)
        const all = plan.flatMap(r => r.cards)
        expect(new Set(all).size).toBe(all.length)
        expect(tasksIn(plan)).toBe(cfg.rooms * cfg.n)
        for (const r of plan) {
          expect(r.shadows).toHaveLength(cfg.n)
          expect(r.cards).toHaveLength(cfg.n + cfg.extra)
          for (const e of r.shadows) expect(r.cards).toContain(e)
          for (const e of r.cards) expect(ROOMS[r.theme]).toContain(e)
        }
        expect(plan[0].cat).toBe(false)
      }
    }
  }, 30000)

  it('keeps look-alikes apart at the start and puts them together at the top', () => {
    let alike = 0, extras = 0
    for (let seed = 1; seed <= 100; seed++) {
      for (const level of [1, 2, 3, 4]) {
        for (const r of planLevel(level, seeded(seed + level * 1000))) {
          const groups = r.cards.map(group)
          expect(new Set(groups).size, `${level} ${r.cards.join('')}`).toBe(groups.length)
        }
      }
      for (const level of [7, 8, 9, 10]) {
        for (const r of planLevel(level, seeded(seed + level * 1000))) {
          const groups = r.shadows.map(group)
          // at least one pair of look-alikes among the shadows
          expect(new Set(groups).size, `${level} ${r.shadows.join('')}`).toBeLessThan(groups.length)
          // and the extra cards look like the shadows, as far as the room has partners left
          alike += r.extras.filter(e => groups.includes(group(e))).length
          extras += r.extras.length
          expect(r.extras.some(e => groups.includes(group(e))), `${level} extras ${r.extras.join('')}`).toBe(true)
        }
      }
    }
    expect(alike / extras).toBeGreaterThan(0.7)
  }, 30000)

  it('makes a level 5 room with exactly one look-alike extra card', () => {
    const cfg = levelConfig(5)
    for (let seed = 1; seed <= 60; seed++) {
      const r = planRoom('wohnzimmer', cfg, new Set(), seeded(seed))
      const sg = r.shadows.map(group)
      expect(new Set(sg).size).toBe(sg.length)
      expect(r.extras.filter(e => sg.includes(group(e)))).toHaveLength(1)
    }
  })

  it('gets harder: narrower light, quicker, fewer eyes, longer in the light at the start', () => {
    for (let i = 1; i < LEVELS.length; i++) {
      expect(LEVELS[i].beam).toBeLessThan(LEVELS[i - 1].beam)
      expect(LEVELS[i].speed).toBeGreaterThan(LEVELS[i - 1].speed)
      expect(LEVELS[i].eyes).toBeLessThanOrEqual(LEVELS[i - 1].eyes)
      expect(LEVELS[i].hold).toBeLessThanOrEqual(LEVELS[i - 1].hold)
      expect(LEVELS[i].n).toBeGreaterThanOrEqual(LEVELS[i - 1].n)
    }
  })
})

describe('the screen', () => {
  const sizes = { tablet: [1024, 698], phone: [390, 774], side: [844, 320], small: [360, 670] }
  for (const [name, [w, h]] of Object.entries(sizes)) {
    it(`fits at ${name} size`, () => {
      for (const cards of [3, 4, 6, 7]) {
        const L = layoutFor(w, h, cards, 20)
        expect(L.cards.size).toBeGreaterThanOrEqual(MIN_CARD)
        expect(L.cards.cols * L.cards.rows).toBeGreaterThanOrEqual(cards)
        const boxes = [L.garland, L.room, { x: L.cards.x, y: L.cards.y, w: L.cards.w, h: L.cards.h }]
        for (const b of boxes) {
          expect(b.x).toBeGreaterThanOrEqual(0)
          expect(b.y).toBeGreaterThanOrEqual(0)
          expect(b.x + b.w).toBeLessThanOrEqual(w + 0.5)
          expect(b.y + b.h).toBeLessThanOrEqual(h + 0.5)
        }
        // the room does not run into the cards
        if (L.side) expect(L.room.x + L.room.w).toBeLessThanOrEqual(L.cards.x)
        else expect(L.room.y + L.room.h).toBeLessThanOrEqual(L.cards.y)
        expect(L.room.h).toBeGreaterThan(L.S * 2)
      }
    })
  }
})

describe('the shadows in the dark', () => {
  it('stay in the room while they creep, hide and flee', () => {
    const rnd = seeded(7)
    const room = makeRoom(600, 380, 90, [{ x: 200, w: 120, top: 320 }])
    const list = Object.keys(THINGS).slice(0, 12).map((e, i) => spawn(i, e, room, rnd))
    for (let f = 0; f < 3000; f++) {
      for (const s of list) {
        if (f === 1500) flee(s, { x: 300, y: 200 }, room, rnd)
        step(s, 1 / 60, room, 1.5, rnd, list.filter(o => o !== s))
        expect(s.x).toBeGreaterThanOrEqual(room.x0 - 0.01)
        expect(s.x).toBeLessThanOrEqual(room.x1 + 0.01)
        expect(s.y).toBeGreaterThanOrEqual(room.S * 0.3)
        expect(s.y).toBeLessThanOrEqual(room.H - room.S * 0.3 + 0.01)
      }
    }
  })

  it('are caught when the light is on them, not when it is far away', () => {
    const s = { x: 100, y: 100 }
    expect(inLight(s, { x: 110, y: 95, r: 100 }, 80)).toBe(true)
    expect(inLight(s, { x: 400, y: 300, r: 100 }, 80)).toBe(false)
  })

  it('knows which way the pictures look', () => {
    expect(lookOf('🐕')).toBe(-1)
    expect(lookOf('🐌')).toBe(1)
    expect(lookOf('🍎')).toBe(0)
    expect(lookOf('🦋')).toBe(0)
  })
})
