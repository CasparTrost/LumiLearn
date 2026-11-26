// Clothes painted onto a figure (lib/wardrobe.js wornFit): cut per pose out of
// a sheet Tripo dressed (scripts/art/worn-from-sheet.mjs) and drawn over the
// pose picture whole, in the right layer, the figure's arms and tail not drawn
// again over them.
import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { POSES, figureLayers, wornFit, wornSrc, ITEM_BY_ID } from '../../src/lib/wardrobe.js'
import { SHAPES, posesOf, fitOf, shapeLayers } from '../../src/lib/shapes.js'
import DINO_WORN from '../../src/lib/shapes/dino-worn.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const POSE_IDS = ['idle', 'happy', 'sad', 'hmm', 'think', 'sleep', 'wave']
const ids = layers => layers.map(l => (l.kind === 'item' ? l.id : l.clip ? 'clip' : 'pose'))
const PILOT = { top: 'ringelshirt', bottom: 'jeansshorts' }

describe('clothes painted onto the figure', () => {
  it('the pilot: the dino wears the ringelshirt and the jeansshorts painted, a picture for every pose', () => {
    expect(DINO_WORN).toEqual(expect.arrayContaining(['ringelshirt', 'jeansshorts']))
    for (const id of DINO_WORN) {
      expect(ITEM_BY_ID[id], id).toBeTruthy()
      expect(fitOf('dino')[id].worn).toBe('dino')
      for (const pose of POSE_IDS) {
        const f = join(ROOT, 'public', wornSrc({ id, worn: 'dino' }, pose))
        expect(existsSync(f), f).toBe(true)
        expect(statSync(f).size, f).toBeLessThan(60 * 1024)
      }
    }
    // the dino's other corrections for the thing stay (where no picture would be found)
    expect(fitOf('dino').ringelshirt.src).toBe('sprites/wardrobe/shapes/dino/ringelshirt.webp')
  })

  it('drawn over the whole square from its own picture, the bottom under the top, no arms or tail over them', () => {
    for (const pose of POSE_IDS) {
      const { layers, scale } = shapeLayers('dino', pose, PILOT)
      const top = layers.find(l => l.id === 'ringelshirt'), bottom = layers.find(l => l.id === 'jeansshorts')
      expect(top).toMatchObject({ src: `sprites/wardrobe/worn/dino/ringelshirt-${pose}.webp`, left: '0%', top: '0%', size: '100%', h: '100%', rot: 0 })
      expect(bottom.src).toBe(`sprites/wardrobe/worn/dino/jeansshorts-${pose}.webp`)
      expect(layers.indexOf(bottom)).toBeLessThan(layers.indexOf(top))
      // only the pose picture itself, then the two: no polygon drawn again over them
      expect(ids(layers)).toEqual(['pose', 'jeansshorts', 'ringelshirt'])
      expect(scale).toBe(1)
    }
  })

  it('stays combinable: a painted top over a laid bottom, with shoes, a hat and a scarf', () => {
    const outfit = { top: 'ringelshirt', bottom: 'tutu', shoes: 'turnschuhe', head: 'muetze', neck: 'schal' }
    const stand = shapeLayers('dino', 'idle', outfit).layers
    const o = ids(stand)
    // the tutu laid by its anchors, the arms and the tail drawn over it, the painted top over them
    expect(stand.find(l => l.id === 'tutu').size).not.toBe('100%')
    expect(o.indexOf('turnschuhe')).toBeLessThan(o.indexOf('tutu'))
    expect(o.indexOf('tutu')).toBeLessThan(o.lastIndexOf('clip'))
    expect(o.lastIndexOf('clip')).toBeLessThan(o.indexOf('ringelshirt'))
    expect(o.indexOf('ringelshirt')).toBeLessThan(o.indexOf('schal'))
    expect(o.indexOf('schal')).toBeLessThan(o.indexOf('muetze'))
    // a painted bottom under a laid top: the arms over the laid top as before
    const laid = ids(shapeLayers('dino', 'idle', { top: 'heldenshirt', bottom: 'jeansshorts' }).layers)
    expect(laid.slice(0, 3)).toEqual(['pose', 'jeansshorts', 'heldenshirt'])
    expect(laid.slice(3).every(x => x === 'clip')).toBe(true)
    expect(laid.length).toBeGreaterThan(3)
    // sitting: the shoes again in front of the painted top
    const sit = ids(shapeLayers('dino', 'sleep', { ...PILOT, shoes: 'turnschuhe' }).layers)
    expect(sit.indexOf('ringelshirt')).toBeLessThan(sit.lastIndexOf('turnschuhe-again'))
  })

  it('where there is no painted picture, everything stays as it was', () => {
    // the chick, and the other figures
    expect(ids(figureLayers('idle', PILOT).layers)).not.toEqual(['pose', 'jeansshorts', 'ringelshirt'])
    expect(figureLayers('idle', PILOT).layers.find(l => l.id === 'ringelshirt').src).toBe('sprites/wardrobe/ringelshirt.webp')
    for (const s of SHAPES.filter(s => s.id !== 'dino' && s.fit)) {
      for (const l of shapeLayers(s.id, 'idle', PILOT).layers) expect(l.src ?? '', s.id).not.toMatch(/worn/)
    }
    // the same figure without the mark: laid as before
    const fit = { ...fitOf('dino') }
    for (const id of DINO_WORN) { fit[id] = { ...fit[id] }; delete fit[id].worn }
    const before = figureLayers('idle', PILOT, posesOf('dino'), fit).layers
    expect(before.find(l => l.id === 'ringelshirt').size).not.toBe('100%')
    expect(before.filter(l => l.clip).length).toBeGreaterThan(0)
    // wornFit marks only the things listed
    const f = wornFit('dino', ['tutu'], { tutu: { size: 2 }, muetze: { size: 3 } })
    expect(f).toEqual({ tutu: { size: 2, worn: 'dino' }, muetze: { size: 3 } })
    expect(POSES.idle).toBeTruthy()
  })
})
