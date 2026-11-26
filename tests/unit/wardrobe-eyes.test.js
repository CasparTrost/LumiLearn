// Lumis Kleiderschrank: no hat and nothing held ever lies on an eye or the
// mouth, on any figure, in any pose. The eyes and the mouth of every picture
// and the shape of every thing come from tests/unit/face-zones.json (made by
// scripts/art/face-zones.mjs from the pictures; run it again when a picture
// changes); here every thing is placed exactly as figureLayers draws it and
// every pixel of an eye or the mouth is looked up in the thing's picture.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WARDROBE, placeItem, fitted, ASLEEP_OFF } from '../../src/lib/wardrobe.js'
import { SHAPE_IDS, SHAPE_POSE_IDS, posesOf, fitOf } from '../../src/lib/shapes.js'

const DATA = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'face-zones.json'), 'utf8'))
const G = DATA.grid
const bits = Object.fromEntries(Object.entries(DATA.alpha).map(([id, b]) => [id, Buffer.from(b, 'base64')]))
const opaque = (id, u, v) => {
  if (u < 0 || v < 0 || u >= 1 || v >= 1) return false
  const i = Math.floor(v * G) * G + Math.floor(u * G)
  return !!(bits[id][i >> 3] & (1 << (i & 7)))
}
const inside = (pts, x, y) => {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j]
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c
  }
  return c
}

/** The pixels of an eye or the mouth that a thing covers on a figure in a pose. */
export function covered(fig, pose, item) {
  const poses = posesOf(fig), P = poses[pose]
  const t = fitted(item, fitOf(fig))
  if (t.hide) return { eyes: 0, mouth: 0 }
  const p = placeItem(t, pose, 'l', poses)
  const r = -p.rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r)
  const top = t.pose?.[pose]?.cutTop ?? t.cutTop ?? 0, cut = t.pose?.[pose]?.cut ?? t.cut ?? 1
  // the figure's own picture drawn again over the thing: the holding hoof or
  // wing tip over a held thing, the tuft over a crown
  const again = t.slot === 'hold' ? (P.grip ? [P.grip] : []) : (t.tuft === 'front' && P.tuft ? [P.tuft] : [])
  const count = spans => {
    let n = 0
    for (const [y, x0, x1] of spans) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5
      if (again.some(a => inside(a, px, py))) continue
      const dx = px - p.x, dy = py - p.y
      const qx = p.x + dx * c - dy * s, qy = p.y + dx * s + dy * c
      const u = (qx - p.left) / p.size, v = (qy - p.top) / p.h
      if (v < top || v > cut) continue
      if (opaque(item.id, u, v)) n++
    }
    return n
  }
  const z = DATA.zones[fig][pose]
  return { eyes: z.eyes.reduce((a, e) => a + count(e), 0), mouth: count(z.mouth) }
}

const THINGS = WARDROBE.filter(t => t.slot === 'head' || t.slot === 'hold')

describe('nothing on the eyes or the mouth', () => {
  it('the zones and pictures are there for every figure, pose and thing', () => {
    for (const f of SHAPE_IDS) for (const p of SHAPE_POSE_IDS) {
      expect(DATA.zones[f]?.[p]?.eyes, `${f} ${p}`).toHaveLength(2)
      expect(DATA.zones[f][p].mouth.length, `${f} ${p}`).toBeGreaterThan(0)
    }
    for (const t of THINGS) expect(bits[t.id], t.id).toBeTruthy()
  })
  it('a thing that does lie on an eye is found (the test sees)', () => {
    // a crown pulled down over the face
    const low = { ...WARDROBE.find(t => t.id === 'krone'), dy: 0.45 }
    expect(covered('chick', 'idle', low).eyes).toBeGreaterThan(100)
  })
  for (const slot of ['head', 'hold']) {
    it(`no ${slot} thing covers an eye or the mouth (${THINGS.filter(t => t.slot === slot).length} things × 5 figures × 7 poses)`, () => {
      const hits = []
      for (const f of SHAPE_IDS) for (const p of SHAPE_POSE_IDS) for (const t of THINGS.filter(x => x.slot === slot)) {
        if (p === 'sleep' && ASLEEP_OFF.includes(t.slot)) continue
        const h = covered(f, p, t)
        if (h.eyes || h.mouth) hits.push(`${f} ${p} ${t.id}: eyes ${h.eyes} px, mouth ${h.mouth} px`)
      }
      expect(hits).toEqual([])
    })
  }
})
