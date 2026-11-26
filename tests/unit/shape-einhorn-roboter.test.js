// Lumi as the unicorn and as the robot wears the wardrobe (src/lib/shapes/
// einhorn-*.js, roboter-*.js): anchors in order, every thing inside the
// square, the shrink limits, the sleep rule, the eyes not covered by a hat.
import { describe, it, expect } from 'vitest'
import { WARDROBE, POSE_IDS, POSE_SIZE, SLOTS, figureLayers, itemCorners, fitted, placeItem } from '../../src/lib/wardrobe.js'
import { wearsClothes, posesOf, fitOf } from '../../src/lib/shapes.js'

const TALL = ['zauberhut', 'zylinder', 'kochmuetze', 'partyhut', 'hasenohren', 'einhornreif']
const SHAPES = ['einhorn', 'roboter'].filter(id => wearsClothes(id))

describe.each(SHAPES)('%s wears the wardrobe', id => {
  const P = posesOf(id), F = fitOf(id)
  const shown = t => !fitted(t, F).hide
  it('anchors in order: head above the eyes above the neck above the waist above the feet', () => {
    for (const p of POSE_IDS) {
      for (const s of SLOTS) expect(Number.isFinite(P[p][s].x), `${p} ${s}`).toBe(true)
      expect(P[p].head.y).toBeLessThan(P[p].face.y)
      expect(P[p].face.y).toBeLessThan(P[p].neck.y)
      expect(P[p].neck.y).toBeLessThan(P[p].bottom.y)
      expect(P[p].bottom.y).toBeLessThan(P[p].shoes.y)
    }
  })
  it('every thing on every picture stays in the square (at most 12 % smaller, 18 % under a tall hat)', () => {
    for (const p of POSE_IDS) for (const t0 of WARDROBE) {
      if (!shown(t0) || (p === 'sleep' && ['face', 'hold'].includes(t0.slot))) continue
      const t = fitted(t0, F)
      const { scale } = figureLayers(p, { [t.slot]: t.id }, P, F)
      expect(scale, `${t.id} on ${p}`).toBeGreaterThanOrEqual(TALL.includes(t.id) ? 0.82 : 0.88)
      for (const [x, y] of itemCorners(t, p, P)) {
        const sx = POSE_SIZE / 2 + (x - POSE_SIZE / 2) * scale, sy = POSE_SIZE - (POSE_SIZE - y) * scale
        expect(sx >= 0 && sx <= POSE_SIZE && sy >= 0 && sy <= POSE_SIZE, `${t.id} on ${p}: ${sx},${sy}`).toBe(true)
      }
    }
  })
  it('asleep: no face thing and nothing held', () => {
    for (const t of WARDROBE.filter(x => ['face', 'hold'].includes(x.slot))) {
      expect(figureLayers('sleep', { [t.slot]: t.id }, P, F).layers.filter(l => l.kind === 'item')).toEqual([])
    }
  })
  it('a hat sits on the head: its anchor point within the head, above the eyes', () => {
    for (const p of POSE_IDS) for (const t0 of WARDROBE.filter(x => x.slot === 'head' && shown(x))) {
      const t = fitted(t0, F), pl = placeItem(t, p, 'l', P)
      expect(Math.abs(pl.x - P[p].head.x), `${t.id} on ${p}`).toBeLessThan(P[p].head.w * 0.35)
      expect(pl.y, `${t.id} on ${p}`).toBeLessThan(P[p].face.y)
    }
  })
  it('the corrections name known things only', () => {
    const ids = new Set(WARDROBE.map(t => t.id))
    for (const k of Object.keys(F)) expect(ids.has(k), k).toBe(true)
  })
})
