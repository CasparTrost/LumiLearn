import { describe, it, expect } from 'vitest'
import { SCENES, sceneDeck, sceneShown, timesShown } from '../../src/games/shapeScenes.jsx'

const KINDS = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'rhombus', 'star', 'heart']
const ratio = ([, , w, h]) => Math.max(w, h) / Math.min(w, h)

describe('Formen-Land pictures', () => {
  it('has many different pictures', () => {
    expect(SCENES.length).toBeGreaterThanOrEqual(8)
  })

  SCENES.forEach((s, n) => {
    describe(`picture ${n}`, () => {
      const wide = s.pieces.map(([, x, y, w, h]) => [x, y, w, h])
      const tall = s.tall.boxes

      it('has every kind at least twice, so "find all" always means more than one', () => {
        for (const k of KINDS) expect(s.pieces.filter(p => p[0] === k).length, k).toBeGreaterThanOrEqual(2)
      })

      it('lays out every piece upright too, all inside the board', () => {
        expect(tall.length).toBe(s.pieces.length)
        for (const [x, y, w, h] of wide) expect(x >= 0 && y >= 0 && x + w <= 480 && y + h <= 300, `${[x, y, w, h]}`).toBe(true)
        for (const [x, y, w, h] of tall) expect(x >= 0 && y >= 0 && x + w <= 300 && y + h <= 420, `${[x, y, w, h]}`).toBe(true)
        for (const [b, W, H] of [[s.bug, 480, 300], [s.tall.bug, 300, 420]]) expect(b[0] >= 0 && b[1] >= 0 && b[0] + 26 <= W && b[1] + 26 <= H).toBe(true)
      })

      it('draws each shape true to its name in both layouts', () => {
        s.pieces.forEach(([type], id) => {
          for (const box of [wide[id], tall[id]]) {
            if (type === 'circle' || type === 'square') expect(ratio(box), `${type} ${id}`).toBe(1)
            if (type === 'rectangle' || type === 'oval') expect(ratio(box), `${type} ${id}`).toBeGreaterThanOrEqual(1.25)
          }
        })
      })

      it('only sends off pieces it has', () => {
        for (const id of [...s.go.fly, ...s.go.drive]) expect(id).toBeLessThan(s.pieces.length)
      })
    })
  })
})

describe('Formen-Land picture order', () => {
  it('shows every picture before one comes back, then in another look', () => {
    const first = sceneDeck()
    expect([...first].sort((a, b) => a - b)).toEqual(SCENES.map((_, i) => i))
    // a level of eight pictures
    first.slice(0, 8).forEach(sceneShown)
    const next = sceneDeck()
    // the next level opens with the ones not seen yet …
    expect(next.slice(0, SCENES.length - 8)).toEqual(expect.arrayContaining(first.slice(8)))
    // … then the others, in a new order
    expect(next.slice(SCENES.length - 8)).toEqual(expect.arrayContaining(first.slice(0, 8)))
    expect(next[0]).not.toBe(first[0])
    expect(timesShown(first[0])).toBe(1)
    // once all were seen, the order is new each time
    next.slice(0, SCENES.length - 8).forEach(sceneShown)
    const orders = new Set(Array.from({ length: 20 }, () => sceneDeck().join()))
    expect(orders.size).toBeGreaterThan(1)
  })
})
