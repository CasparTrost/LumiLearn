// Clothes painted onto a figure (lib/wardrobe.js wornFit): cut per pose out of
// a sheet Tripo dressed (scripts/art/worn-from-sheet.mjs) and drawn over the
// pose picture whole, in the right layer, the figure's arms and tail not drawn
// again over them.
import { describe, it, expect, vi } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { POSES, WARDROBE, figureLayers, wornFit, wornSrc, ITEM_BY_ID } from '../../src/lib/wardrobe.js'
import { posesOf, fitOf, shapeLayers } from '../../src/lib/shapes.js'
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

  it('a laid thing still works beside a painted one (a figure without the mark): the arms and the tail over the laid one', () => {
    // the dino's fit with the tutu and the heldenshirt laid again
    const fit = { ...fitOf('dino') }
    for (const id of ['tutu', 'heldenshirt']) { fit[id] = { ...fit[id] }; delete fit[id].worn }
    const outfit = { top: 'ringelshirt', bottom: 'tutu', shoes: 'turnschuhe', head: 'muetze', neck: 'schal' }
    const stand = figureLayers('idle', outfit, posesOf('dino'), fit).layers
    const o = ids(stand)
    expect(stand.find(l => l.id === 'tutu').size).not.toBe('100%')
    expect(o.indexOf('turnschuhe')).toBeLessThan(o.indexOf('tutu'))
    expect(o.indexOf('tutu')).toBeLessThan(o.lastIndexOf('clip'))
    expect(o.lastIndexOf('clip')).toBeLessThan(o.indexOf('ringelshirt'))
    expect(o.indexOf('ringelshirt')).toBeLessThan(o.indexOf('schal'))
    expect(o.indexOf('schal')).toBeLessThan(o.indexOf('muetze'))
    const laid = ids(figureLayers('idle', { top: 'heldenshirt', bottom: 'jeansshorts' }, posesOf('dino'), fit).layers)
    expect(laid.slice(0, 3)).toEqual(['pose', 'jeansshorts', 'heldenshirt'])
    expect(laid.slice(3).every(x => x === 'clip')).toBe(true)
    expect(laid.length).toBeGreaterThan(3)
    // sitting: the shoes again in front of the painted top
    const sit = ids(shapeLayers('dino', 'sleep', { ...PILOT, shoes: 'turnschuhe' }).layers)
    expect(sit.indexOf('ringelshirt')).toBeLessThan(sit.lastIndexOf('turnschuhe-again'))
  })

  it('without the mark a thing is laid as before; wornFit marks only the things listed', () => {
    const fit = { ...fitOf('dino') }
    for (const id of DINO_WORN) { fit[id] = { ...fit[id] }; delete fit[id].worn }
    const before = figureLayers('idle', PILOT, posesOf('dino'), fit).layers
    expect(before.find(l => l.id === 'ringelshirt').size).not.toBe('100%')
    expect(before.filter(l => l.clip).length).toBeGreaterThan(0)
    expect(figureLayers('idle', PILOT, POSES, {}).layers.find(l => l.id === 'ringelshirt').src).toBe('sprites/wardrobe/ringelshirt.webp')
    const f = wornFit('dino', ['tutu'], { tutu: { size: 2 }, muetze: { size: 3 } })
    expect(f).toEqual({ tutu: { size: 2, worn: 'dino' }, muetze: { size: 3 } })
  })
})

describe('every figure wears every top and bottom painted on it (none laid the old way)', () => {
  const FIGURES = ['chick', 'dino', 'einhorn', 'drache', 'roboter']
  const layersOf = (f, pose, outfit) => (f === 'chick' ? figureLayers(pose, outfit) : shapeLayers(f, pose, outfit)).layers
  const CLOTHES = WARDROBE.filter(t => t.slot === 'top' || t.slot === 'bottom')
  for (const f of FIGURES) {
    it(`${f}: every top and bottom from its own pictures, over the whole square, in every pose`, () => {
      for (const t of CLOTHES) for (const pose of POSE_IDS) {
        const L = layersOf(f, pose, { [t.slot]: t.id }).find(l => l.id === t.id)
        expect(L?.src, `${f} ${t.id} ${pose}`).toBe(`sprites/wardrobe/worn/${f}/${t.id}-${pose}.webp`)
        expect(L.size).toBe('100%')
        const file = join(ROOT, 'public', L.src)
        expect(existsSync(file), file).toBe(true)
        expect(statSync(file).size, file).toBeLessThan(60 * 1024)
      }
    })
    it(`${f}: a top and a bottom from two different pictures, with shoes, a hat and a scarf: bottom under top, no arms drawn between`, () => {
      const outfit = { top: 'heldenshirt', bottom: 'tutu', shoes: 'gummistiefel', head: 'krone', neck: 'schal' }
      for (const pose of POSE_IDS) {
        const o = ids(layersOf(f, pose, outfit))
        // (sitting, the shoes on the feet lie between them)
        expect(o.slice(o.indexOf('tutu') + 1, o.indexOf('heldenshirt')).every(x => x.startsWith('gummistiefel')), pose).toBe(true)
        expect(o.indexOf('heldenshirt')).toBeLessThan(o.indexOf('schal'))
        expect(o.indexOf('schal')).toBeLessThan(o.indexOf('krone'))
      }
    })
    it(`${f}: the mermaid's tail cuts the legs away with its own mask, and takes the shoes off`, () => {
      for (const pose of POSE_IDS) {
        const L = layersOf(f, pose, { top: 'ringelshirt', bottom: 'meerjungfrau', shoes: 'turnschuhe' })
        const mask = `sprites/wardrobe/worn/${f}/meerjungfrau-${pose}-mask.webp`
        expect(L.filter(l => l.kind === 'pose').every(l => l.mask === mask)).toBe(true)
        expect(existsSync(join(ROOT, 'public', mask)), mask).toBe(true)
        expect(L.some(l => l.id === 'turnschuhe')).toBe(false)
      }
    })
  }
})

describe('every figure reads its list, so a new sheet needs only the one command', () => {
  const FIGURES = ['chick', 'dino', 'einhorn', 'drache', 'roboter']
  const listOf = f => (f === 'chick' ? '../../src/lib/wardrobe/chick-worn.js' : `../../src/lib/shapes/${f}-worn.js`)
  it('a list per figure, where scripts/art/worn-from-sheet.mjs writes it', () => {
    for (const f of FIGURES) expect(existsSync(join(ROOT, 'tests/unit', listOf(f))), f).toBe(true)
  })
  for (const f of FIGURES) {
    it(`a thing in the ${f}'s list is drawn from its painted pictures`, async () => {
      vi.resetModules()
      vi.doMock(listOf(f), () => ({ default: ['ringelshirt', 'tutu'] }))
      try {
        const Wm = await import('../../src/lib/wardrobe.js')
        const Sm = await import('../../src/lib/shapes.js')
        const outfit = { top: 'ringelshirt', bottom: 'tutu' }
        const { layers } = f === 'chick' ? Wm.figureLayers('sad', outfit) : Sm.shapeLayers(f, 'sad', outfit)
        const src = id => layers.find(l => l.id === id).src
        expect(src('ringelshirt')).toBe(`sprites/wardrobe/worn/${f}/ringelshirt-sad.webp`)
        expect(src('tutu')).toBe(`sprites/wardrobe/worn/${f}/tutu-sad.webp`)
        expect(ids(layers)).toEqual(['pose', 'tutu', 'ringelshirt'])
      } finally {
        vi.doUnmock(listOf(f))
        vi.resetModules()
      }
    })
  }
})
