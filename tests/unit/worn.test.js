// Outfits painted onto a figure (lib/wardrobe.js wornFit): their top and their
// bottom cut per pose out of a sheet Tripo dressed (scripts/art/worn-from-sheet.mjs)
// and drawn over the pose picture whole, in the right layer, the figure's arms
// and tail not drawn again over them. Nothing of an outfit is laid on by
// anchors the old way.
import { describe, it, expect, vi } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WARDROBE, PART_BY_ID, figureLayers, wornFit, wornSrc } from '../../src/lib/wardrobe.js'
import { posesOf, fitOf, shapeLayers } from '../../src/lib/shapes.js'
import DINO_WORN from '../../src/lib/shapes/dino-worn.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const POSE_IDS = ['idle', 'happy', 'sad', 'hmm', 'think', 'sleep', 'wave']
const ids = layers => layers.map(l => (l.kind === 'item' ? l.id : l.clip ? 'clip' : 'pose'))
const PILOT = { outfit: 'outfit-ringelshirt' }

describe('outfits painted onto the figure', () => {
  it('the pilot: the dino wears the ringelshirt and the jeansshorts painted, a picture for every pose', () => {
    expect(DINO_WORN).toEqual(expect.arrayContaining(['ringelshirt', 'jeansshorts']))
    for (const id of DINO_WORN) {
      expect(PART_BY_ID[id], id).toBeTruthy()
      expect(fitOf('dino')[id].worn).toBe('dino')
      for (const pose of POSE_IDS) {
        const f = join(ROOT, 'public', wornSrc({ id, worn: 'dino' }, pose))
        expect(existsSync(f), f).toBe(true)
        expect(statSync(f).size, f).toBeLessThan(60 * 1024)
      }
    }
  })

  it('drawn over the whole square from its own pictures, the bottom under the top, no arms or tail over them', () => {
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

  it('a part not painted for a figure is not drawn at all (never laid on by anchors)', () => {
    // the dino's fit without the mark on the tutu: the bee costume alone
    const fit = { ...fitOf('dino') }
    fit.tutu = { ...fit.tutu }
    delete fit.tutu.worn
    for (const pose of POSE_IDS) {
      const L = figureLayers(pose, { outfit: 'outfit-bienenkostuem', shoes: 'turnschuhe' }, posesOf('dino'), fit).layers
      expect(L.some(l => l.id === 'tutu'), pose).toBe(false)
      expect(L.find(l => l.id === 'bienenkostuem').size, pose).toBe('100%')
    }
    // a figure without any marks: nothing of the outfit, the rest as ever
    const bare = ids(figureLayers('idle', { outfit: 'outfit-ringelshirt', head: 'muetze' }, posesOf('dino'), {}).layers)
    expect(bare.filter(x => x !== 'pose' && x !== 'clip')).toEqual(['muetze'])
    const f = wornFit('dino', ['tutu'], { tutu: { size: 2 }, muetze: { size: 3 } })
    expect(f).toEqual({ tutu: { size: 2, worn: 'dino' }, muetze: { size: 3 } })
  })
})

describe('every figure wears every outfit painted on it (no top or bottom laid on the old way)', () => {
  const FIGURES = ['chick', 'dino', 'einhorn', 'drache', 'roboter']
  const layersOf = (f, pose, outfit) => (f === 'chick' ? figureLayers(pose, outfit) : shapeLayers(f, pose, outfit)).layers
  const OUTFITS = WARDROBE.filter(t => t.slot === 'outfit')
  for (const f of FIGURES) {
    it(`${f}: every outfit's top and bottom from its own pictures, over the whole square, the bottom under the top, in every pose`, () => {
      for (const o of OUTFITS) for (const pose of POSE_IDS) {
        const L = layersOf(f, pose, { outfit: o.id })
        const parts = [o.bottom, o.top].filter(Boolean)
        // the parts and nothing else of the outfit, in that order
        expect(L.filter(l => l.kind === 'item').map(l => l.id), `${f} ${o.id} ${pose}`).toEqual(parts)
        for (const id of parts) {
          const l = L.find(x => x.id === id)
          expect(l.src, `${f} ${id} ${pose}`).toBe(`sprites/wardrobe/worn/${f}/${id}-${pose}.webp`)
          expect(l.size).toBe('100%')
          const file = join(ROOT, 'public', l.src)
          expect(existsSync(file), file).toBe(true)
          expect(statSync(file).size, file).toBeLessThan(60 * 1024)
        }
        // no arms or tail drawn again over a painted outfit
        expect(L.filter(l => l.kind === 'pose').length, `${f} ${o.id} ${pose}`).toBe(1)
      }
    })
    it(`${f}: an outfit with shoes, a hat and a scarf: bottom under top, only the shoes between`, () => {
      const outfit = { outfit: 'outfit-heldenshirt', shoes: 'gummistiefel', head: 'krone', neck: 'schal' }
      for (const pose of POSE_IDS) {
        const o = ids(layersOf(f, pose, outfit))
        // (sitting, the shoes on the feet lie between them)
        expect(o.indexOf('skihose'), pose).toBeLessThan(o.indexOf('heldenshirt'))
        expect(o.slice(o.indexOf('skihose') + 1, o.indexOf('heldenshirt')).every(x => x.startsWith('gummistiefel')), pose).toBe(true)
        expect(o.indexOf('heldenshirt')).toBeLessThan(o.indexOf('schal'))
        expect(o.indexOf('schal')).toBeLessThan(o.indexOf('krone'))
      }
    })
    it(`${f}: the mermaid outfit cuts the legs away with its own mask, and takes the shoes off`, () => {
      for (const pose of POSE_IDS) {
        const L = layersOf(f, pose, { outfit: 'outfit-skijacke', shoes: 'turnschuhe' })
        const mask = `sprites/wardrobe/worn/${f}/meerjungfrau-${pose}-mask.webp`
        expect(L.filter(l => l.kind === 'pose').every(l => l.mask === mask)).toBe(true)
        expect(existsSync(join(ROOT, 'public', mask)), mask).toBe(true)
        expect(L.some(l => String(l.id).startsWith('turnschuhe'))).toBe(false)
        expect(ids(L).filter(x => x !== 'pose')).toEqual(['meerjungfrau', 'skijacke'])
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
    it(`a part in the ${f}'s list is drawn from its painted pictures, one not listed is not drawn`, async () => {
      vi.resetModules()
      vi.doMock(listOf(f), () => ({ default: ['ringelshirt'] }))
      try {
        const Wm = await import('../../src/lib/wardrobe.js')
        const Sm = await import('../../src/lib/shapes.js')
        const outfit = { outfit: 'outfit-ringelshirt' }
        const { layers } = f === 'chick' ? Wm.figureLayers('sad', outfit) : Sm.shapeLayers(f, 'sad', outfit)
        expect(layers.find(l => l.id === 'ringelshirt').src).toBe(`sprites/wardrobe/worn/${f}/ringelshirt-sad.webp`)
        expect(ids(layers)).toEqual(['pose', 'ringelshirt'])
      } finally {
        vi.doUnmock(listOf(f))
        vi.resetModules()
      }
    })
  }
})
