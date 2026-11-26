// The hook that lets another figure (lib/shapes.js) wear the wardrobe:
// its own anchors (shapes/<id>-poses.js) and corrections per thing
// (shapes/<id>-fit.js) going into figureLayers (lib/wardrobe.js).
import { describe, it, expect } from 'vitest'
import { POSES, WARDROBE, figureLayers, fitted, placeItem, ITEM_BY_ID } from '../../src/lib/wardrobe.js'
import { SHAPES, CHICK, posesComplete, wearsClothes, posesOf, fitOf, shapeLayers } from '../../src/lib/shapes.js'

const items = layers => layers.filter(l => l.kind === 'item').map(l => l.id)

describe('another figure wears the wardrobe', () => {
  it('a correction is merged over the thing, per pose too; hide leaves it out', () => {
    const t = ITEM_BY_ID.muetze
    const f = fitted(t, { muetze: { size: 2, pose: { sleep: { dy: 5 } } } })
    expect(f.size).toBe(2)
    expect(f.pose.sleep.dy).toBe(5)
    // the thing's own per-pose fields stay where the figure says nothing
    expect(f.pose.hmm).toEqual(t.pose.hmm)
    expect(fitted(t, {})).toBe(t)
    expect(items(figureLayers('idle', { head: 'muetze' }, POSES, { muetze: { hide: true } }).layers)).toEqual([])
  })
  it('the figure\'s anchors place the things', () => {
    const moved = Object.fromEntries(Object.entries(POSES).map(([p, P]) => [p, { ...P, head: { ...P.head, x: P.head.x + 20 } }]))
    const a = placeItem(ITEM_BY_ID.krone, 'idle', 'l', moved), b = placeItem(ITEM_BY_ID.krone, 'idle')
    expect(a.x - b.x).toBeCloseTo(20)
    const L = figureLayers('idle', { head: 'krone' }, moved).layers.find(l => l.id === 'krone')
    expect(L.left).not.toBe(figureLayers('idle', { head: 'krone' }).layers.find(l => l.id === 'krone').left)
  })
  it('own wings are cut away under wings worn; a tail is drawn again over clothes', () => {
    const P = { ...POSES, idle: { ...POSES.idle, ownWings: [[[0, 0], [10, 0], [10, 10]]], tail: [[[300, 300], [320, 300], [320, 320]]] } }
    const wings = figureLayers('idle', { back: 'schmetterling' }, P).layers[2]
    expect(wings.kind).toBe('pose')
    expect(wings.clip).toMatch(/^polygon\(evenodd/)
    expect(figureLayers('idle', { back: 'pfau' }, P).layers.find(l => l.kind === 'pose').clip).toBe(null)
    const dressed = figureLayers('idle', { bottom: 'jeansshorts' }, P).layers
    expect(dressed.at(-1)).toMatchObject({ kind: 'pose' })
    expect(dressed.at(-1).clip).toContain('83.333%')
    expect(figureLayers('idle', { head: 'muetze' }, P).layers.filter(l => l.kind === 'pose' && l.clip?.includes('83.333%'))).toEqual([])
  })
  it('a shape wears clothes only once all seven poses have all eight anchors', () => {
    expect(posesComplete(POSES)).toBe(true)
    expect(posesComplete({})).toBe(false)
    expect(posesComplete({ ...POSES, wave: { ...POSES.wave, shoes: undefined } })).toBe(false)
    expect(wearsClothes(CHICK)).toBe(true)
    for (const s of SHAPES.filter(x => x.id !== CHICK)) {
      expect(wearsClothes(s.id), s.id).toBe(posesComplete(s.poses))
      expect(posesOf(s.id)).toBe(s.poses)
      expect(fitOf(s.id)).toBe(s.fit)
    }
    expect(posesOf(CHICK)).toBe(POSES)
    // without clothes: the picture alone, even with an outfit
    const bare = SHAPES.find(s => s.id !== CHICK && !wearsClothes(s.id))
    if (bare) expect(shapeLayers(bare.id, 'idle', { head: 'muetze' }).layers).toHaveLength(1)
  })
  it('the dino and the dragon wear clothes (one missing anchor would silently take them all off)', () => {
    for (const id of ['dino', 'drache']) expect(wearsClothes(id), id).toBe(true)
  })
})

// Every shape that wears clothes: each thing on each pose stays in the
// square, the shape shrinks no more than the chick may, asleep nothing on
// the face and nothing held.
const TALL = ['zauberhut', 'zylinder', 'kochmuetze', 'partyhut', 'hasenohren', 'einhornreif']
for (const s of SHAPES.filter(x => x.id !== CHICK && wearsClothes(x.id))) {
  describe(`${s.id} wears every thing`, () => {
    it('in the square, within the shrink limits', () => {
      for (const p of Object.keys(s.poses)) for (const t of WARDROBE) {
        if (p === 'sleep' && ['face', 'hold'].includes(t.slot)) continue
        const { scale } = figureLayers(p, { [t.slot]: t.id }, s.poses, s.fit)
        expect(scale, `${t.id} on ${p}`).toBeGreaterThanOrEqual(TALL.includes(t.id) ? 0.82 : 0.88)
      }
    })
    it('asleep: no face thing, nothing held', () => {
      const ids = items(figureLayers('sleep', { face: 'sonnenbrille', hold: 'ballon', head: 'krone' }, s.poses, s.fit).layers)
      expect(ids).toEqual(['krone'])
    })
  })
}
