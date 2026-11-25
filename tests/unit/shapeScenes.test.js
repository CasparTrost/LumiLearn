import { describe, it, expect } from 'vitest'
import { SCENES, sceneDeck, sceneShown, timesShown } from '../../src/games/shapeScenes.jsx'
import { SHAPE_IDS, OBJECTS, defensible, objectOptions, shapeBag, onPiece, pieceAt } from '../../src/games/shapeRules.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'

const KINDS = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'rhombus', 'star', 'heart']
const ratio = ([, , w, h]) => Math.max(w, h) / Math.min(w, h)

// Points along the outline of a piece, to see how much of it later pieces hide
function outline(type, [x, y, w, h], n = 120) {
  const along = pts => Array.from({ length: n }, (_, i) => {
    const t = (i / n) * pts.length, k = Math.floor(t), f = t - k
    const [ax, ay] = pts[k], [bx, by] = pts[(k + 1) % pts.length]
    return [ax + (bx - ax) * f, ay + (by - ay) * f]
  })
  if (type === 'circle' || type === 'oval') return Array.from({ length: n }, (_, i) => [x + w / 2 + (w / 2) * Math.cos(i / n * 2 * Math.PI), y + h / 2 + (h / 2) * Math.sin(i / n * 2 * Math.PI)])
  if (type === 'triangle') return along([[x + w / 2, y], [x + w, y + h], [x, y + h]])
  if (type === 'rhombus') return along([[x + w / 2, y], [x + w, y + h / 2], [x + w / 2, y + h], [x, y + h / 2]])
  return along([[x, y], [x + w, y], [x + w, y + h], [x, y + h]])
}

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
            // a rhombus as high as wide is a square on its corner (the fish tails were)
            if (type === 'rhombus') expect(ratio(box), `${type} ${id}`).toBeGreaterThanOrEqual(1.3)
          }
        })
      })

      // A shape half hidden behind another is another shape to look at: the
      // rocket's fins (rhombi behind the hull) were triangles, the big wheel's
      // stand (a triangle behind the wheel) a trapezoid, the car's cabin (a
      // square sunk into the car) a rectangle. Things lying ON a shape (the
      // window on the wall) hide none of its outline and are fine.
      it('shows every circle, square, triangle and rhombus whole', () => {
        for (const [name, boxes] of [['wide', wide], ['upright', tall]]) {
          s.pieces.forEach(([type], id) => {
            if (!['circle', 'square', 'triangle', 'rhombus'].includes(type)) return
            const pts = outline(type, boxes[id])
            const hidden = pts.filter(([px, py]) => s.pieces.some(([t], j) => j > id && onPiece({ type: t }, boxes[j], px, py, -1.5))).length
            // the ringed planet keeps its place: a ring across it hides a fifth
            expect(hidden / pts.length, `${name}: ${type} ${id} is hidden by a later piece`).toBeLessThan(type === 'triangle' ? 0.1 : 0.25)
          })
        }
      })

      it('only sends off pieces it has, each in one way', () => {
        const all = [...s.go.fly, ...s.go.drive, ...s.go.spin, ...s.go.wave]
        for (const id of all) expect(id).toBeLessThan(s.pieces.length)
        expect(new Set(all).size).toBe(all.length)
      })

      it('has its moment when the last shape is found', () => {
        // something leaves or turns: more than a flag that waves
        expect(s.go.fly.length + s.go.drive.length + s.go.spin.length).toBeGreaterThanOrEqual(3)
      })

      it('turns the wheel as one thing, about a point given in both layouts', () => {
        if (!s.go.spin.length) return
        expect(s.spinAt).toHaveLength(2)
        expect(s.tall.spinAt).toHaveLength(2)
        // drawn as one group: its pieces stand together in the list
        s.go.spin.forEach((id, k) => expect(id).toBe(s.go.spin[0] + k))
      })

      it('has strings in both layouts or in none', () => {
        expect(!!s.strings).toBe(!!s.tall.strings)
      })
    })
  })
})

describe('Formen-Land: what counts as right', () => {
  it('never calls a tap a miss that a child could defend to a teacher', () => {
    // a square is a rectangle and a rhombus, a circle an oval
    expect(defensible('square', 'rectangle')).toBe(true)
    expect(defensible('square', 'rhombus')).toBe(true)
    expect(defensible('circle', 'oval')).toBe(true)
    // not the other way round
    expect(defensible('rectangle', 'square')).toBe(false)
    expect(defensible('rhombus', 'square')).toBe(false)
    expect(defensible('oval', 'circle')).toBe(false)
    expect(defensible('triangle', 'rectangle')).toBe(false)
    for (const k of KINDS) expect(defensible(k, k)).toBe(true)
  })

  it('knows the same shapes as the pictures', () => {
    expect(SHAPE_IDS).toEqual(KINDS)
  })

  it('shows only things with a picture, none of them drawn at an angle', () => {
    const things = Object.values(OBJECTS).flat()
    for (const [emoji, name] of things) {
      expect(hasEmojiArt(emoji), name).toBe(true)
      expect(name).toMatch(/^(der|die|das) /)
    }
    const emojis = things.map(t => t[0])
    expect(new Set(emojis).size).toBe(emojis.length)
    // the coin and the target look oval, the tent is drawn in perspective,
    // the flag is a pole and a cloth
    for (const out of ['🪙', '🎯', '⛺', '🚩']) expect(emojis).not.toContain(out)
  })

  it('asks only things whose outline is plainly their shape', () => {
    // the kite was drawn tilted and nearly square: a child calling it a
    // Quadrat was right and got it marked wrong
    expect(Object.values(OBJECTS).flat().map(t => t[0])).not.toContain('🪁')
    for (const [type, things] of Object.entries(OBJECTS)) {
      for (const [, name, outline] of things) {
        if (type === 'triangle') {
          expect(outline, name).toHaveLength(3)
          continue
        }
        const [x, y, w, h] = outline
        expect(x >= 0 && y >= 0 && x + w <= 100 && y + h <= 100, name).toBe(true)
        // a circle and a square as high as wide, a rectangle and an oval
        // clearly longer one way (no square door, no round egg)
        if (type === 'circle' || type === 'square') expect(ratio(outline), name).toBeLessThan(1.06)
        else expect(ratio(outline), name).toBeGreaterThan(1.2)
      }
    }
  })

  it('never offers a Quadrat next to a Raute', () => {
    for (let i = 0; i < 40; i++) {
      const shuffle = a => [...a].sort(() => Math.random() - 0.5)
      expect(objectOptions('rhombus', SHAPE_IDS, shuffle)).not.toContain('square')
    }
  })

  it('never offers a second shape the thing could be called', () => {
    const same = a => a
    for (const type of Object.keys(OBJECTS)) {
      for (let i = 0; i < 40; i++) {
        const shuffle = a => [...a].sort(() => Math.random() - 0.5)
        const options = objectOptions(type, SHAPE_IDS, shuffle)
        expect(options).toHaveLength(3)
        expect(new Set(options).size).toBe(3)
        expect(options).toContain(type)
        expect(options.filter(o => defensible(type, o))).toEqual([type])
        expect(options).not.toContain('star')
        expect(options).not.toContain('heart')
      }
      // the three shapes of level 1 are enough for its things
      if (['circle', 'square', 'triangle'].includes(type)) expect(objectOptions(type, SHAPE_IDS.slice(0, 3), same)).toHaveLength(3)
    }
    expect(objectOptions('square', SHAPE_IDS, same)).not.toContain('rectangle')
    expect(objectOptions('circle', SHAPE_IDS, same)).not.toContain('oval')
  })

  it('asks for every shape of the level before one comes again, never twice in a row', () => {
    for (const pool of [SHAPE_IDS.slice(0, 3), SHAPE_IDS.slice(0, 6), SHAPE_IDS]) {
      for (let run = 0; run < 30; run++) {
        const next = shapeBag(pool)
        const asked = Array.from({ length: 8 }, next)
        asked.forEach((a, i) => { if (i) expect(a).not.toBe(asked[i - 1]) })
        expect(new Set(asked.slice(0, pool.length)).size).toBe(Math.min(8, pool.length))
        const most = Math.max(...pool.map(k => asked.filter(a => a === k).length))
        expect(most).toBeLessThanOrEqual(Math.ceil(8 / pool.length))
      }
    }
  })

  it('takes a tap for the shape that is looked for when one lies under the finger', () => {
    const pieces = [
      { id: 0, type: 'triangle' },   // the roof …
      { id: 1, type: 'circle' },     // … with a round window on it
      { id: 2, type: 'square' },
    ]
    const boxes = [[0, 0, 100, 60], [40, 25, 20, 20], [200, 0, 40, 40]]
    const boxOf = p => boxes[p.id]
    // on the window: the roof when triangles are asked, the window otherwise
    expect(pieceAt(pieces, boxOf, 50, 35, { answer: 'triangle' }).id).toBe(0)
    expect(pieceAt(pieces, boxOf, 50, 35, { answer: 'circle' }).id).toBe(1)
    expect(pieceAt(pieces, boxOf, 50, 35, { answer: 'square' }).id).toBe(1)
    // a little beside a small shape still counts, for the shape asked for only
    expect(pieceAt(pieces, boxOf, 244, 20, { answer: 'square', near: () => 8 }).id).toBe(2)
    expect(pieceAt(pieces, boxOf, 244, 20, { answer: 'circle', near: () => 8 })).toBe(null)
    // nothing there: no piece, so no miss
    expect(pieceAt(pieces, boxOf, 150, 100, { answer: 'circle' })).toBe(null)
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
