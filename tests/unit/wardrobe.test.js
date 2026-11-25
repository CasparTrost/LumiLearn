// Lumis Kleiderschrank (src/lib/wardrobe.js): the steps that unlock things,
// the pictures and anchors, and what the reducer keeps per child.
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WARDROBE, ITEM_BY_ID, SLOTS, POSES, POSE_IDS, POSE_SIZE, unlockedItems, unlockedBetween, nextLocked, stepBefore,
  figureLayers, itemCorners, placeItem, cleanOutfit, wornItems, lumiPose, unseenItems,
} from '../../src/lib/wardrobe.js'
import { reducer, migrateToV2, initialState, profileWardrobeStars } from '../../src/AppContext.jsx'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const steps = WARDROBE.map(t => t.stars)

describe('the steps', () => {
  it('twelve things to begin with, a few for each place', () => {
    expect(WARDROBE.length).toBeGreaterThanOrEqual(12)
    for (const s of SLOTS) expect(WARDROBE.filter(t => t.slot === s).length, s).toBeGreaterThanOrEqual(3)
    expect(new Set(WARDROBE.map(t => t.id)).size).toBe(WARDROBE.length)
  })
  it('two things at once from the start, in different places: the wardrobe is never empty', () => {
    const free = unlockedItems(0)
    expect(free.length).toBe(2)
    expect(new Set(free.map(t => t.slot)).size).toBe(2)
  })
  it('then quickly (a game or two: up to six stars), slower later', () => {
    const paid = steps.filter(s => s > 0)
    expect(paid[0]).toBeLessThanOrEqual(3)
    expect(paid[1]).toBeLessThanOrEqual(6)
    for (let i = 1; i < paid.length; i++) expect(paid[i], `step ${i}`).toBeGreaterThan(paid[i - 1])
    const gaps = paid.map((s, i) => s - (paid[i - 1] ?? 0))
    for (let i = 1; i < gaps.length; i++) expect(gaps[i], `gap ${i}`).toBeGreaterThanOrEqual(gaps[i - 1])
  })
  it('what a new total unlocks, the next present and where its bar starts', () => {
    expect(unlockedBetween(5, 8).map(t => t.id)).toEqual(['partyhut'])
    expect(unlockedBetween(8, 8)).toEqual([])
    expect(unlockedBetween(0, 12).map(t => t.id)).toEqual(['schal', 'partyhut', 'herzbrille'])
    expect(nextLocked(12).id).toBe('blumenkranz')
    expect(stepBefore(ITEM_BY_ID.blumenkranz)).toBe(10)
    expect(nextLocked(10_000)).toBe(null)
    expect(unseenItems({ wardrobeSeen: ['muetze'] }, 3).map(t => t.id)).toEqual(['sonnenbrille', 'schal'])
  })
})

describe('the pictures', () => {
  it('every thing has its picture and its drawing', () => {
    for (const t of WARDROBE) {
      expect(existsSync(join(ROOT, 'public', t.src)), t.src).toBe(true)
      expect(existsSync(join(ROOT, 'scripts', 'art', `schrank-${t.id}.svg`)), t.id).toBe(true)
      expect(SLOTS).toContain(t.slot)
      for (const v of [...t.at, ...t.box]) expect(v >= 0 && v <= 1, t.id).toBe(true)
    }
  })
  it('every one of Lumi\'s seven pictures exists and has all anchors and the tuft', () => {
    expect(POSE_IDS.sort()).toEqual(['happy', 'hmm', 'idle', 'sad', 'sleep', 'think', 'wave'])
    for (const p of POSE_IDS) {
      expect(existsSync(join(ROOT, 'public', 'sprites', 'emoji', 'custom', `lumi-${p}.webp`)), p).toBe(true)
      for (const s of SLOTS) {
        const a = POSES[p][s]
        for (const k of ['x', 'y', 'rot', 'w']) expect(Number.isFinite(a[k]), `${p}.${s}.${k}`).toBe(true)
        expect(a.x > 0 && a.x < POSE_SIZE && a.y > 0 && a.y < POSE_SIZE && a.w > 40, `${p}.${s}`).toBe(true)
      }
      expect(POSES[p].tuft.length).toBeGreaterThanOrEqual(3)
      // head above the eyes above the neck
      expect(POSES[p].head.y).toBeLessThan(POSES[p].face.y)
      expect(POSES[p].face.y).toBeLessThan(POSES[p].neck.y)
    }
  })
  it('every thing on every picture stays in the square (Lumi gets a little smaller for a tall hat, never tiny)', () => {
    for (const p of POSE_IDS) for (const t of WARDROBE) {
      const { scale } = figureLayers(p, { [t.slot]: t.id })
      expect(scale, `${t.id} on ${p}`).toBeGreaterThan(0.7)
      for (const [x, y] of itemCorners(t, p)) {
        // scaled about the middle of the bottom edge
        const sx = POSE_SIZE / 2 + (x - POSE_SIZE / 2) * scale, sy = POSE_SIZE - (POSE_SIZE - y) * scale
        expect(sx >= 0 && sx <= POSE_SIZE && sy >= 0 && sy <= POSE_SIZE, `${t.id} on ${p}: ${sx},${sy}`).toBe(true)
      }
    }
  })
  it('a thing sits where it belongs: hats on the head, glasses on the eyes, the rest at the neck', () => {
    for (const p of POSE_IDS) for (const t of WARDROBE) {
      const pl = placeItem(t, p), A = POSES[p][t.slot]
      expect(Math.hypot(pl.x - A.x, pl.y - A.y), `${t.id} on ${p}`).toBeLessThan(A.w * 0.3)
    }
  })
  it('the layers: a covering hat cuts the tuft out, a crown draws it again on top', () => {
    const hat = figureLayers('idle', { head: 'muetze' }).layers
    expect(hat[0].clip).toMatch(/^polygon\(evenodd/)
    const crown = figureLayers('idle', { head: 'krone' }).layers
    expect(crown[0].clip).toBe(null)
    expect(crown.at(-1)).toMatchObject({ kind: 'pose' })
    // the wing at the chin lies over the scarf when Lumi thinks
    const think = figureLayers('think', { neck: 'schal', face: 'rundbrille' }).layers.map(l => l.kind + (l.id ?? ''))
    expect(think).toEqual(['pose', 'itemschal', 'pose', 'itemrundbrille'])
    expect(figureLayers('idle', null)).toEqual({ layers: [{ kind: 'pose', clip: null }], scale: 1 })
  })
  it('moods map to the seven pictures like lib/assets.js', () => {
    expect(lumiPose('dance')).toBe('happy')
    expect(lumiPose('oops')).toBe('hmm')
    expect(lumiPose('talk')).toBe('idle')
    expect(lumiPose(undefined)).toBe('idle')
  })
  it('an outfit is cleaned: unknown things and things in the wrong place go', () => {
    expect(cleanOutfit({ head: 'krone', face: 'krone', neck: 'nope' })).toEqual({ head: 'krone', face: null, neck: null })
    expect(cleanOutfit(null)).toEqual({ head: null, face: null, neck: null })
    expect(wornItems({ head: 'muetze', neck: 'schal' }).map(t => t.id)).toEqual(['muetze', 'schal'])
  })
})

// ── the reducer ──
const kid = (stars, more = {}) => {
  const levelStars = {}
  for (let l = 1, left = stars; left > 0; l++) { levelStars[l] = Math.min(3, left); left -= 3 }
  return { id: 'p1', name: 'Mia', age: 5, avatar: '🦊', progress: { 'shapes-land': { currentLevel: 1, levelStars, plays: 1 } }, ...more }
}
const load = p => ({ ...initialState, ...migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: { p1: p } }), screen: 'home' })
const wear = (s, id) => reducer(s, { type: 'WARDROBE_WEAR', payload: id })
const me = s => s.profiles.p1

describe('wearing', () => {
  it('a tap puts a thing on, a second tap takes it off; it counts as tried', () => {
    let s = load(kid(0))
    s = wear(s, 'muetze')
    expect(me(s).outfit).toEqual({ head: 'muetze', face: null, neck: null })
    expect(me(s).wardrobeTried).toEqual(['muetze'])
    s = wear(s, 'muetze')
    expect(me(s).outfit.head).toBe(null)
    expect(me(s).wardrobeTried).toEqual(['muetze'])
  })
  it('one thing per place, three places at once', () => {
    let s = load(kid(12))
    s = wear(wear(wear(wear(s, 'muetze'), 'sonnenbrille'), 'schal'), 'partyhut')
    expect(me(s).outfit).toEqual({ head: 'partyhut', face: 'sonnenbrille', neck: 'schal' })
  })
  it('a wrapped present cannot be put on, nor an unknown thing', () => {
    const s = load(kid(5))
    expect(wear(s, 'krone')).toBe(s)
    expect(wear(s, 'no-such-thing')).toBe(s)
  })
  it('opening the wardrobe marks the unlocked things seen (the sign goes)', () => {
    let s = load(kid(6))
    expect(unseenItems(me(s), profileWardrobeStars(me(s))).length).toBe(4)
    s = reducer(s, { type: 'WARDROBE_SEEN' })
    expect(me(s).wardrobeSeen).toEqual(['muetze', 'sonnenbrille', 'schal', 'partyhut'])
    expect(reducer(s, { type: 'WARDROBE_SEEN' })).toBe(s)
  })
})

describe('stars and saves', () => {
  const finish = (s, stars, moduleId = 'numbers', level = 1) => reducer({ ...s, currentGame: { moduleId, level } },
    { type: 'FINISH_GAME', payload: { moduleId, level, stars, score: stars === 3 ? 4 : 2, total: 4 } })
  it('a round that reaches a step tells the results screen what is new', () => {
    const s = finish(load(kid(5)), 3)
    expect(s.gameResult.newWear).toEqual(['partyhut'])
    expect(me(s).starsEver).toBe(8)
    expect(finish(s, 1, 'numbers', 2).gameResult.newWear).toEqual([])
  })
  it('a better result on a level counts only the stars it adds', () => {
    const s1 = finish(load(kid(4)), 1)
    expect(s1.gameResult.newWear).toEqual([])
    const s = finish(s1, 3)
    expect(profileWardrobeStars(me(s))).toBe(7)
    expect(s.gameResult.newWear).toEqual(['partyhut'])
  })
  it('a game started over in the parent area takes nothing away', () => {
    let s = wear(load(kid(16)), 'blumenkranz')
    s = reducer(s, { type: 'RESET_MODULE', payload: 'shapes-land' })
    expect(profileWardrobeStars(me(s))).toBe(16)
    expect(me(s).outfit.head).toBe('blumenkranz')
    expect(wear(s, 'herzbrille')).not.toBe(s)
  })
  it('"start over" for the child (parent area) empties the wardrobe too', () => {
    let s = wear(wear(load(kid(16)), 'blumenkranz'), 'schal')
    s = reducer(reducer(s, { type: 'WARDROBE_SEEN' }), { type: 'RESET_PROFILE', payload: 'p1' })
    expect(me(s).outfit).toEqual({ head: null, face: null, neck: null })
    expect(me(s).wardrobeSeen).toEqual([])
    expect(me(s).wardrobeTried).toEqual([])
    expect(profileWardrobeStars(me(s))).toBe(0)
  })
  it('an old save without a wardrobe loads with Lumi wearing nothing and its stars counted', () => {
    const p = me(load(kid(20)))
    expect(p.outfit).toEqual({ head: null, face: null, neck: null })
    expect(p.wardrobeSeen).toEqual([])
    expect(profileWardrobeStars(p)).toBe(20)
  })
  it('a save that says otherwise is cleaned: unknown things, wrong places, things not unlocked', () => {
    const p = me(load(kid(4, { outfit: { head: 'krone', face: 'schal', neck: 'schal' }, wardrobeSeen: ['schal', 'nope'], wardrobeTried: 'x', starsEver: 'lots' })))
    expect(p.outfit).toEqual({ head: null, face: null, neck: 'schal' })
    expect(p.wardrobeSeen).toEqual(['schal'])
    expect(p.wardrobeTried).toEqual([])
    expect(p.starsEver).toBe(0)
  })
  it('what Lumi wears is saved with the rest', () => {
    const s = wear(load(kid(3)), 'schal')
    const again = migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: s.profiles })
    expect(again.profiles.p1.outfit.neck).toBe('schal')
  })
})
