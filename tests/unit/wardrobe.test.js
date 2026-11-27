// Lumis Kleiderschrank (src/lib/wardrobe.js): the steps that unlock things,
// the pictures and anchors, and what the reducer keeps per child.
import { describe, it, expect } from 'vitest'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  WARDROBE, ITEM_BY_ID, SLOTS, ANCHORS, PART_BY_ID, ORDER, stepStars, POSES, POSE_IDS, POSE_SIZE, unlockedItems, unlockedBetween, nextLocked, stepBefore,
  figureLayers, itemCorners, placeItem, cleanOutfit, wornItems, lumiPose, unseenItems, knownIds, tilePictures,
} from '../../src/lib/wardrobe.js'
import { reducer, migrateToV2, initialState, profileWardrobeStars, MAX_LEVELS, hasLevels } from '../../src/AppContext.jsx'
import { LINES } from '../../src/lib/lumiLines.js'
import HEAD from '../../src/lib/wardrobe/head.js'
import FACE from '../../src/lib/wardrobe/face.js'
import NECK from '../../src/lib/wardrobe/neck.js'
import BACK from '../../src/lib/wardrobe/back.js'
import HOLD from '../../src/lib/wardrobe/hold.js'
import OUTFIT from '../../src/lib/wardrobe/outfit.js'
import TOP from '../../src/lib/wardrobe/top.js'
import BOTTOM from '../../src/lib/wardrobe/bottom.js'
import SHOES from '../../src/lib/wardrobe/shoes.js'

const NONE = { head: null, face: null, neck: null, back: null, hold: null, outfit: null, shoes: null }
// every star the games can give: three a level
const MAX_STARS = Object.entries(MAX_LEVELS).filter(([id]) => hasLevels(id)).reduce((a, [, n]) => a + 3 * n, 0)

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

describe('the steps', () => {
  it('one file per place, every thing once, in its own place', () => {
    for (const [slot, list] of [['head', HEAD], ['face', FACE], ['neck', NECK], ['back', BACK], ['hold', HOLD], ['outfit', OUTFIT], ['shoes', SHOES]]) {
      expect(list.length, slot).toBeGreaterThanOrEqual(1)
      for (const t of list) expect(t.slot, t.id).toBe(slot)
    }
    expect(new Set(WARDROBE.map(t => t.id)).size).toBe(WARDROBE.length)
    expect(WARDROBE.length).toBe(HEAD.length + FACE.length + NECK.length + BACK.length + HOLD.length + OUTFIT.length + SHOES.length)
    for (const id of ORDER) expect(ITEM_BY_ID[id], `ORDER names ${id}`).toBeTruthy()
    expect(new Set(ORDER).size).toBe(ORDER.length)
  })
  it('an outfit is the top and the bottom Tripo painted together on one sheet; each top and bottom in one outfit', () => {
    // the pairs of the sheets: docs/kleiderschrank-bilder.md, "Die Paare"
    const doc = readFileSync(join(ROOT, 'docs', 'kleiderschrank-bilder.md'), 'utf8')
    const table = doc.slice(doc.indexOf('## Die Paare'), doc.indexOf('## Die Bilder'))
    const pairs = [...table.matchAll(/^\| \d+ \| (\w+) \| (\w+|–) \|/gm)].map(m => [m[1], m[2] === '–' ? undefined : m[2]])
    expect(pairs.length).toBe(16)
    expect(OUTFIT.map(o => [o.top, o.bottom])).toEqual(pairs)
    for (const o of OUTFIT) {
      expect(o.id, o.id).toBe(`outfit-${o.top}`)
      expect(o.name.length, o.id).toBeGreaterThan(3)
      expect(PART_BY_ID[o.top]?.part, o.id).toBe('top')
      if (o.bottom) expect(PART_BY_ID[o.bottom]?.part, o.id).toBe('bottom')
    }
    // every top and every bottom belongs to exactly one outfit
    const used = OUTFIT.flatMap(o => [o.top, o.bottom]).filter(Boolean).sort()
    expect(used).toEqual([...TOP, ...BOTTOM].map(t => t.id).sort())
    expect(new Set(used).size).toBe(used.length)
    // the parts are no things of their own: nobody wears a top without its bottom
    for (const id of used) expect(ITEM_BY_ID[id], id).toBeUndefined()
    // the mermaid's tail: its outfit has no feet
    expect(WARDROBE.filter(t => t.feet === false).map(t => t.id)).toEqual(['outfit-skijacke'])
  })
  it('the stars come from the order: a thing not in the order yet comes last', () => {
    WARDROBE.forEach((t, i) => expect(t.stars, t.id).toBe(stepStars(i)))
    const listed = WARDROBE.filter(t => ORDER.includes(t.id)).map(t => t.id)
    expect(listed).toEqual(ORDER)
    expect(WARDROBE.slice(0, ORDER.length).map(t => t.id)).toEqual(ORDER)
  })
  it('the first thing of each place is the picture on its tab: one that says the place', () => {
    // (the tab shows it in colour once it is owned: it is the first thing
    // of its place a child gets, and for the back it is wings, not the cape)
    const first = Object.fromEntries(SLOTS.map(s => [s, WARDROBE.find(t => t.slot === s)]))
    for (const s of SLOTS) expect(first[s].stars, s).toBe(Math.min(...WARDROBE.filter(t => t.slot === s).map(t => t.stars)))
    expect(SLOTS.map(s => first[s].id)).toEqual(['muetze', 'sonnenbrille', 'schal', 'schmetterling', 'ballon', 'outfit-ringelshirt', 'turnschuhe'])
  })
  it('two things at once from the start, in different places: the wardrobe is never empty', () => {
    const free = unlockedItems(0)
    expect(free.length).toBe(2)
    expect(new Set(free.map(t => t.slot)).size).toBe(2)
  })
  it('the rule: quickly at first (a good game each), slower later, the last at about 60 % of all stars', () => {
    expect(stepStars(0)).toBe(0)
    expect(stepStars(1)).toBe(0)
    expect(stepStars(2)).toBe(3)
    // the first dozen steps are one good game each
    for (let i = 3; i < 14; i++) expect(stepStars(i) - stepStars(i - 1)).toBe(3)
    for (let i = 3; i < 100; i++) {
      expect(stepStars(i)).toBeGreaterThan(stepStars(i - 1))
      expect(stepStars(i) - stepStars(i - 1)).toBeGreaterThanOrEqual(stepStars(i - 1) - stepStars(Math.max(1, i - 2)))
    }
    expect(MAX_STARS).toBeGreaterThan(600)
    // the last thing of the seven places needs 55 to 65 % of all stars
    const last = WARDROBE.at(-1).stars / MAX_STARS
    expect(last).toBeGreaterThanOrEqual(0.55)
    expect(last).toBeLessThanOrEqual(0.65)
  })
  it('the order mixes the places: never two of one place in a row, red hats apart, no place waits too long, the crown last', () => {
    for (let i = 1; i < WARDROBE.length; i++) expect(WARDROBE[i].slot === WARDROBE[i - 1].slot, WARDROBE[i].id).toBe(false)
    const at = id => WARDROBE.findIndex(t => t.id === id)
    const red = ['muetze', 'feuerwehrhelm', 'weihnachtsmuetze'].map(at).filter(i => i >= 0).sort((a, b) => a - b)
    for (let i = 1; i < red.length; i++) expect(red[i] - red[i - 1]).toBeGreaterThanOrEqual(10)
    expect(WARDROBE.filter(t => ORDER.includes(t.id)).at(-1).id).toBe('krone')
    for (const sl of SLOTS) {
      const st = WARDROBE.filter(t => ORDER.includes(t.id) && t.slot === sl).map(t => t.stars)
      // (the back has the fewest things: it comes every 45 to 75 stars)
      for (let i = 1; i < st.length; i++) expect(st[i] - st[i - 1], `${sl} at ${st[i]}`).toBeLessThanOrEqual(sl === 'back' ? 75 : sl === 'hold' ? 65 : 46)
      // a child gets something of every place within the first 40 stars
      expect(WARDROBE.find(t => t.slot === sl).stars, sl).toBeLessThanOrEqual(40)
    }
    // the first outfit within the first 15 stars
    expect(WARDROBE.find(t => t.slot === 'outfit').stars).toBeLessThanOrEqual(15)
  })
  it('what a new total unlocks, the next present and where its bar starts', () => {
    const [a, b, c] = [WARDROBE[2], WARDROBE[3], WARDROBE[4]]
    expect(unlockedBetween(a.stars - 1, a.stars).map(t => t.id)).toEqual([a.id])
    expect(unlockedBetween(a.stars, a.stars)).toEqual([])
    expect(unlockedBetween(0, c.stars).map(t => t.id)).toEqual([a.id, b.id, c.id])
    expect(nextLocked(b.stars).id).toBe(c.id)
    expect(stepBefore(c)).toBe(b.stars)
    expect(nextLocked(10_000)).toBe(null)
    expect(unseenItems({ wardrobeSeen: [WARDROBE[0].id] }, a.stars).map(t => t.id)).toEqual([WARDROBE[1].id, a.id])
  })
})

describe('the pictures', () => {
  it('every place has its recorded announcement', () => {
    for (const slot of SLOTS) {
      expect(LINES[`schrank/platz-${slot}`], slot).toBeTruthy()
      expect(existsSync(join(ROOT, 'public', 'audio', 'lumi', 'schrank', `platz-${slot}.mp3`)), slot).toBe(true)
    }
    expect(LINES['schrank/platz-outfit']).toBe('Etwas zum Anziehen!')
  })
  it('every thing has its picture: made with Tripo, or still drawn (until its Tripo picture comes)', () => {
    const drawn = ['ballon', 'umhang', 'zauberstab', 'lolli', 'engel', 'blume', 'fee', 'faehnchen', 'drache', 'windrad', 'pfau']
    for (const t of WARDROBE.filter(x => x.slot !== 'outfit')) {
      const file = join(ROOT, 'public', t.src)
      expect(existsSync(file), t.src).toBe(true)
      // 512 px webp, small (a Tripo picture is about 15 to 45 KB)
      expect(statSync(file).size, t.src).toBeLessThan(60 * 1024)
      expect(existsSync(join(ROOT, 'scripts', 'art', `schrank-${t.id}.svg`)), t.id).toBe(drawn.includes(t.id))
      expect(SLOTS).toContain(t.slot)
      for (const v of [...t.at, ...t.box]) expect(v >= 0 && v <= 1, t.id).toBe(true)
    }
  })
  it('an outfit\'s tile: its top\'s picture over its bottom\'s, together filling the tile, the top above, the hem over the waistband', () => {
    for (const o of WARDROBE.filter(t => t.slot === 'outfit')) {
      const pics = tilePictures(o)
      const parts = [o.bottom, o.top].filter(Boolean).map(id => PART_BY_ID[id])
      // drawn in that order: the top last, over the bottom
      expect(pics.map(p => p.src), o.id).toEqual(parts.map(t => t.src))
      for (const t of parts) {
        expect(existsSync(join(ROOT, 'public', t.src)), t.src).toBe(true)
        expect(statSync(join(ROOT, 'public', t.src)).size, t.src).toBeLessThan(60 * 1024)
      }
      // the drawn parts on the tile (0…1)
      const drawn = pics.map((p, i) => { const [x0, y0, x1, y1] = parts[i].box; return [p.x + x0 * p.size, p.y + y0 * p.size, p.x + x1 * p.size, p.y + y1 * p.size] })
      for (const d of drawn) for (const v of d) expect(v >= 0.05 && v <= 0.95, `${o.id} ${d}`).toBe(true)
      const span = [Math.min(...drawn.map(d => d[0])), Math.min(...drawn.map(d => d[1])), Math.max(...drawn.map(d => d[2])), Math.max(...drawn.map(d => d[3]))]
      expect(Math.max(span[2] - span[0], span[3] - span[1]), o.id).toBeCloseTo(0.86, 2)
      if (drawn.length === 2) {
        const [b, t] = drawn
        expect(t[1], o.id).toBeLessThan(b[1])
        expect(b[1], o.id).toBeLessThan(t[3])
        expect(t[3], o.id).toBeLessThan(b[3])
        // the bottom centred under the top
        expect((b[0] + b[2]) / 2, o.id).toBeCloseTo((t[0] + t[2]) / 2, 3)
      }
    }
    // a thing: one picture, its drawn part filling the tile as before
    const [k] = tilePictures(ITEM_BY_ID.krone), kr = Math.min(1 / 0.9, 1 / 0.68, 2.4) * 0.86
    expect(k).toEqual({ src: ITEM_BY_ID.krone.src, x: 0.5 - 0.5 * kr, y: 0.5 - 0.5 * kr, size: kr })
  })
  it('every one of Lumi\'s seven pictures exists and has all anchors and the tuft', () => {
    expect(POSE_IDS.sort()).toEqual(['happy', 'hmm', 'idle', 'sad', 'sleep', 'think', 'wave'])
    for (const p of POSE_IDS) {
      expect(existsSync(join(ROOT, 'public', 'sprites', 'emoji', 'custom', `lumi-${p}.webp`)), p).toBe(true)
      for (const s of ANCHORS) {
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
  it('every thing on every picture stays in the square (Lumi gets at most 12 % smaller, 18 % under a tall hat)', () => {
    // (a tall hat worn at its true size: a doll's hat perched on the head looked wrong)
    const TALL = ['zauberhut', 'zylinder', 'kochmuetze', 'partyhut', 'hasenohren', 'einhornreif']
    for (const p of POSE_IDS) for (const t of WARDROBE) {
      if (p === 'sleep' && ['face', 'hold'].includes(t.slot)) continue
      const { scale } = figureLayers(p, { [t.slot]: t.id })
      // (an outfit is painted onto the chick in its own square: tests/unit/worn.test.js)
      if (t.slot === 'outfit') { expect(scale).toBe(1); continue }
      expect(scale, `${t.id} on ${p}`).toBeGreaterThanOrEqual(TALL.includes(t.id) ? 0.82 : 0.88)
      for (const [x, y] of itemCorners(t, p)) {
        // scaled about the middle of the bottom edge
        const sx = POSE_SIZE / 2 + (x - POSE_SIZE / 2) * scale, sy = POSE_SIZE - (POSE_SIZE - y) * scale
        expect(sx >= 0 && sx <= POSE_SIZE && sy >= 0 && sy <= POSE_SIZE, `${t.id} on ${p}: ${sx},${sy}`).toBe(true)
      }
    }
  })
  it('a thing sits where it belongs: hats on the head, glasses on the eyes, the rest at the neck', () => {
    for (const p of POSE_IDS) for (const t of WARDROBE.filter(x => x.slot !== 'outfit')) {
      const pl = placeItem(t, p), A = POSES[p][t.slot]
      // (shoes: from the left foot, a step beside the middle; a shoe is
      // placed by its sole, a little below the anchor; sitting, on the foot in front)
      const ax = t.slot === 'shoes' ? A.x - A.step : A.x
      expect(Math.hypot(pl.x - ax, pl.y - A.y), `${t.id} on ${p}`).toBeLessThan(A.w * (t.slot === 'shoes' ? 0.55 : 0.3))
    }
  })
  it('wings sit on the back: below the eyes, at the sides of the body, drawn in two halves', () => {
    // (the rocket pack is spread a little too, but stands up beside the head)
    const wings = WARDROBE.filter(t => t.slot === 'back' && t.spread && t.id !== 'rakete')
    expect(wings.map(t => t.id).sort()).toEqual(['drache', 'engel', 'fee', 'schmetterling'])
    for (const p of POSE_IDS) for (const t of wings) {
      // the outer top corners of the two turned halves (the inner ones lie
      // behind Lumi): an earlier pair rose beside the head and read as two
      // big ears. (Corners of the picture: a little above the wing itself.)
      const P = POSES[p], c = itemCorners(t, p)
      expect(c.length).toBe(8)
      expect(Math.min(c[0][1], c[5][1]), `${t.id} on ${p}`).toBeGreaterThan(P.face.y - 10)
      // and they stand out at both sides of the body
      expect(c[0][0], `${t.id} on ${p}`).toBeLessThan(P.back.x - P.back.w * 0.6)
      expect(c[5][0], `${t.id} on ${p}`).toBeGreaterThan(P.back.x + P.back.w * 0.6)
      const back = figureLayers(p, { back: t.id }).layers.filter(l => l.kind === 'item')
      expect(back.map(l => l.id), p).toEqual([t.id, `${t.id}-right`])
      expect(back[0].rot).toBeLessThan(back[1].rot)
    }
  })
  it('clothes: standing, the shoes under the trousers under the top; sitting, the shoes in front', () => {
    const outfit = { outfit: 'outfit-ringelshirt', shoes: 'turnschuhe' }
    const at = (layers, id) => layers.findIndex(l => l.id === id)
    const lastAt = (layers, id) => layers.map(l => l.id).lastIndexOf(id)
    for (const p of POSE_IDS.filter(p => !POSES[p].feet)) {
      const L = figureLayers(p, outfit).layers
      expect(at(L, 'turnschuhe'), p).toBeGreaterThan(-1)
      expect(at(L, 'turnschuhe-right'), p).toBeLessThan(at(L, 'jeansshorts'))
      expect(at(L, 'jeansshorts'), p).toBeLessThan(at(L, 'ringelshirt'))
      // nothing of a shoe is drawn again over the clothes
      expect(L.filter(l => String(l.id).startsWith('turnschuhe')).length, p).toBe(2)
    }
    const S = figureLayers('sleep', outfit).layers
    const shoeLast = Math.max(...S.map((l, i) => (String(l.id).startsWith('turnschuhe') ? i : -1)))
    expect(shoeLast).toBeGreaterThan(at(S, 'jeansshorts'))
    expect(shoeLast).toBeGreaterThan(lastAt(S, 'ringelshirt'))
    // the mermaid's tail: no shoes at all
    expect(figureLayers('idle', { outfit: 'outfit-skijacke', shoes: 'turnschuhe' }).layers.some(l => String(l.id).startsWith('turnschuhe'))).toBe(false)
  })
  it('asleep, Lumi wears no glasses or masks and holds nothing; hat, neck and clothes stay', () => {
    const all = { head: 'muetze', face: 'sonnenbrille', neck: 'schal', back: 'schmetterling', hold: 'ballon', outfit: 'outfit-ringelshirt', shoes: 'turnschuhe' }
    const ids = figureLayers('sleep', all).layers.filter(l => l.kind === 'item').map(l => l.id)
    expect(ids).not.toContain('sonnenbrille')
    expect(ids).not.toContain('ballon')
    for (const id of ['muetze', 'schal', 'schmetterling', 'ringelshirt', 'jeansshorts', 'turnschuhe']) expect(ids, id).toContain(id)
    const awake = figureLayers('idle', all).layers.map(l => l.id)
    expect(awake).toContain('sonnenbrille')
    expect(awake).toContain('ballon')
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
    expect(cleanOutfit({ head: 'krone', face: 'krone', neck: 'nope', back: 'umhang' })).toEqual({ ...NONE, head: 'krone', back: 'umhang' })
    expect(cleanOutfit(null)).toEqual(NONE)
    expect(wornItems({ head: 'muetze', neck: 'schal' }).map(t => t.id)).toEqual(['muetze', 'schal'])
  })
})

// ── the reducer ──
// Written against the order, not against names: the order changes as the
// wardrobe grows.
const kid = (stars, more = {}) => {
  const levelStars = {}
  for (let l = 1, left = stars; left > 0; l++) { levelStars[l] = Math.min(3, left); left -= 3 }
  return { id: 'p1', name: 'Mia', age: 5, avatar: '🦊', progress: { 'shapes-land': { currentLevel: 1, levelStars, plays: 1 } }, ...more }
}
const load = p => ({ ...initialState, ...migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: { p1: p } }), screen: 'home' })
const wear = (s, id) => reducer(s, { type: 'WARDROBE_WEAR', payload: id })
const me = s => s.profiles.p1
const free = WARDROBE[0]
// the first thing of each place, and the stars that open all five
const firstOf = slot => WARDROBE.find(t => t.slot === slot)
const allFive = Math.max(...SLOTS.map(sl => firstOf(sl).stars))
// a second thing for the place of `t`, opened later
const laterIn = t => WARDROBE.find(x => x.slot === t.slot && x.stars > t.stars)

describe('wearing', () => {
  it('a tap puts a thing on, a second tap takes it off; it counts as tried', () => {
    let s = load(kid(0))
    s = wear(s, free.id)
    expect(me(s).outfit).toEqual({ ...NONE, [free.slot]: free.id })
    expect(me(s).wardrobeTried).toEqual([free.id])
    s = wear(s, free.id)
    expect(me(s).outfit[free.slot]).toBe(null)
    expect(me(s).wardrobeTried).toEqual([free.id])
  })
  it('one thing per place, seven places at once, and everything off at once', () => {
    const second = laterIn(free)
    let s = load(kid(Math.max(allFive, second.stars)))
    for (const sl of SLOTS) s = wear(s, firstOf(sl).id)
    expect(me(s).outfit).toEqual(Object.fromEntries(SLOTS.map(sl => [sl, firstOf(sl).id])))
    s = wear(s, second.id)
    expect(me(s).outfit[free.slot]).toBe(second.id)
    s = reducer(s, { type: 'WARDROBE_UNDRESS' })
    expect(me(s).outfit).toEqual(NONE)
    expect(reducer(s, { type: 'WARDROBE_UNDRESS' })).toBe(s)
  })
  it('shoes and the mermaid outfit take each other off: nothing is worn that does not show', () => {
    let s = load(kid(1000))
    s = wear(s, 'turnschuhe')
    s = wear(s, 'outfit-skijacke')
    expect(me(s).outfit.outfit).toBe('outfit-skijacke')
    expect(me(s).outfit.shoes).toBe(null)
    s = wear(s, 'gummistiefel')
    expect(me(s).outfit.shoes).toBe('gummistiefel')
    expect(me(s).outfit.outfit).toBe(null)
    // other outfits keep the shoes
    s = wear(s, 'outfit-ringelshirt')
    expect(me(s).outfit).toMatchObject({ outfit: 'outfit-ringelshirt', shoes: 'gummistiefel' })
    s = wear(s, 'outfit-heldenshirt')
    expect(me(s).outfit).toMatchObject({ outfit: 'outfit-heldenshirt', shoes: 'gummistiefel' })
    // a save with both keeps the tail
    expect(cleanOutfit({ outfit: 'outfit-skijacke', shoes: 'turnschuhe' })).toMatchObject({ outfit: 'outfit-skijacke', shoes: null })
  })
  it('a top or a bottom alone cannot be put on: only the outfit', () => {
    const s = load(kid(1000))
    for (const id of ['ringelshirt', 'jeansshorts', 'tutu', 'meerjungfrau']) expect(wear(s, id), id).toBe(s)
  })
  it('a wrapped present cannot be put on, nor an unknown thing', () => {
    const s = load(kid(5))
    expect(wear(s, WARDROBE.at(-1).id)).toBe(s)
    expect(wear(s, 'no-such-thing')).toBe(s)
  })
  it('opening the wardrobe marks the unlocked things seen (the sign goes)', () => {
    const n = 4, stars = WARDROBE[n - 1].stars
    let s = load(kid(stars))
    expect(unseenItems(me(s), profileWardrobeStars(me(s))).length).toBe(n)
    s = reducer(s, { type: 'WARDROBE_SEEN' })
    expect(me(s).wardrobeSeen).toEqual(WARDROBE.slice(0, n).map(t => t.id))
    expect(reducer(s, { type: 'WARDROBE_SEEN' })).toBe(s)
  })
})

describe('stars and saves', () => {
  const finish = (s, stars, moduleId = 'numbers', level = 1) => reducer({ ...s, currentGame: { moduleId, level } },
    { type: 'FINISH_GAME', payload: { moduleId, level, stars, score: stars === 3 ? 4 : 2, total: 4 } })
  const step = WARDROBE[3]   // 3 stars before it is reached by a 3-star round from 2 below
  it('a round that reaches a step tells the results screen what is new', () => {
    const s = finish(load(kid(step.stars - 2)), 3)
    expect(s.gameResult.newWear).toEqual([step.id])
    expect(me(s).starsEver).toBe(step.stars + 1)
    expect(finish(s, 1, 'numbers', 2).gameResult.newWear).toEqual(unlockedBetween(step.stars + 1, step.stars + 2).map(t => t.id))
  })
  it('a better result on a level counts only the stars it adds', () => {
    const s1 = finish(load(kid(step.stars - 3)), 1)
    expect(s1.gameResult.newWear).toEqual([])
    const s = finish(s1, 3)
    expect(profileWardrobeStars(me(s))).toBe(step.stars)
    expect(s.gameResult.newWear).toEqual([step.id])
  })
  it('a game started over in the parent area takes nothing away', () => {
    const t = WARDROBE[6]
    let s = wear(load(kid(t.stars)), t.id)
    s = reducer(s, { type: 'RESET_MODULE', payload: 'shapes-land' })
    expect(profileWardrobeStars(me(s))).toBe(t.stars)
    expect(me(s).outfit[t.slot]).toBe(t.id)
    expect(wear(s, WARDROBE[5].id)).not.toBe(s)
  })
  it('the wardrobe counts the stars ever earned: a reset game played again moves it on at once', () => {
    let s = load(kid(30))
    expect(profileWardrobeStars(me(s))).toBe(30)
    s = reducer(s, { type: 'RESET_MODULE', payload: 'shapes-land' })
    expect(profileWardrobeStars(me(s))).toBe(30)
    // the same level of the reset game again: its stars count again
    s = finish(s, 2, 'shapes-land', 1)
    expect(profileWardrobeStars(me(s))).toBe(32)
    expect(s.gameResult.newWear).toEqual(unlockedBetween(30, 32).map(t => t.id))
    // plain play and a better result add what they add, a worse one nothing
    s = finish(s, 3, 'shapes-land', 1)
    expect(profileWardrobeStars(me(s))).toBe(33)
    s = finish(s, 1, 'shapes-land', 1)
    expect(profileWardrobeStars(me(s))).toBe(33)
    s = finish(s, 2, 'numbers', 1)
    expect(profileWardrobeStars(me(s))).toBe(35)
  })
  it('an old save with a stored count starts from the larger of it and the stars it has', () => {
    expect(me(load(kid(20, { starsEver: 50 }))).starsEver).toBe(50)
    expect(me(load(kid(20, { starsEver: 5 }))).starsEver).toBe(20)
  })
  it('"start over" for the child (parent area) empties the wardrobe too', () => {
    const t = WARDROBE[6]
    let s = wear(load(kid(t.stars)), t.id)
    s = reducer(reducer(s, { type: 'WARDROBE_SEEN' }), { type: 'RESET_PROFILE', payload: 'p1' })
    expect(me(s).outfit).toEqual(NONE)
    expect(me(s).wardrobeSeen).toEqual([])
    expect(me(s).wardrobeTried).toEqual([])
    expect(profileWardrobeStars(me(s))).toBe(0)
  })
  it('an old save without a wardrobe loads with Lumi wearing nothing and its stars counted', () => {
    const p = me(load(kid(20)))
    expect(p.outfit).toEqual(NONE)
    expect(p.wardrobeSeen).toEqual([])
    expect(profileWardrobeStars(p)).toBe(20)
  })
  it('a save that says otherwise is cleaned: unknown things, wrong places, things not unlocked', () => {
    const open = WARDROBE[2], locked = WARDROBE.at(-1)
    const wrongPlace = SLOTS.find(sl => sl !== open.slot && sl !== locked.slot)
    const p = me(load(kid(open.stars, { outfit: { [locked.slot]: locked.id, [wrongPlace]: open.id, [open.slot]: open.id }, wardrobeSeen: [open.id, 'nope'], wardrobeTried: 'x', starsEver: 'lots' })))
    expect(p.outfit).toEqual({ ...NONE, [open.slot]: open.id })
    expect(p.wardrobeSeen).toEqual([open.id])
    expect(p.wardrobeTried).toEqual([])
    // a broken count starts from the stars the child has
    expect(p.starsEver).toBe(open.stars)
  })
  it('a thing taken out of the wardrobe (the umbrella) simply goes from an old save', () => {
    const p = me(load(kid(400, { outfit: { hold: 'schirm', head: 'muetze' }, wardrobeSeen: ['schirm', 'muetze'], wardrobeTried: ['schirm'] })))
    expect(p.outfit).toEqual({ ...NONE, head: 'muetze' })
    expect(p.wardrobeSeen).toEqual(['muetze'])
    expect(p.wardrobeTried).toEqual([])
    expect(ITEM_BY_ID.schirm).toBeUndefined()
    // the lantern that took its place leaves Lumi almost its size
    for (const pose of POSE_IDS) expect(figureLayers(pose, { hold: 'laterne' }).scale, pose).toBeGreaterThanOrEqual(0.94)
  })
  it('an old save with a top and a bottom of their own: Lumi wears the outfit of the top, else of the bottom', () => {
    expect(cleanOutfit({ top: 'heldenshirt', bottom: 'tutu', head: 'muetze' })).toEqual({ ...NONE, outfit: 'outfit-heldenshirt', head: 'muetze' })
    expect(cleanOutfit({ top: null, bottom: 'tutu' })).toEqual({ ...NONE, outfit: 'outfit-bienenkostuem' })
    expect(cleanOutfit({ top: 'sternenpyjama', bottom: 'pyjamahose' })).toEqual({ ...NONE, outfit: 'outfit-sternenpyjama' })
    expect(cleanOutfit({ top: 'nope', bottom: 'jeansshorts' })).toEqual({ ...NONE, outfit: 'outfit-ringelshirt' })
    // a part in the wrong place counts for nothing
    expect(cleanOutfit({ top: 'jeansshorts', bottom: 'ringelshirt' })).toEqual(NONE)
    // the mermaid's tail and shoes: the tail stays, its outfit takes the shoes off
    expect(cleanOutfit({ bottom: 'meerjungfrau', shoes: 'turnschuhe' })).toEqual({ ...NONE, outfit: 'outfit-skijacke' })
    expect(cleanOutfit({ top: 'smoking', bottom: 'meerjungfrau', shoes: 'turnschuhe' })).toEqual({ ...NONE, outfit: 'outfit-smoking', shoes: 'turnschuhe' })
    // an outfit already saved wins over old fields
    expect(cleanOutfit({ outfit: 'outfit-smoking', top: 'ringelshirt' }).outfit).toBe('outfit-smoking')
    // the seen and tried lists: each part counts as its outfit, once
    expect(knownIds(['ringelshirt', 'muetze', 'jeansshorts', 'tutu', 'nope', 'outfit-bienenkostuem'])).toEqual(['outfit-ringelshirt', 'muetze', 'outfit-bienenkostuem'])
    // loaded: with all stars the outfit is worn, the lists are outfits
    const p = me(load(kid(1000, { starsEver: 1000, outfit: { top: 'regenjacke', bottom: 'lederhose', shoes: 'gummistiefel' }, wardrobeSeen: ['regenjacke', 'lederhose', 'krone'], wardrobeTried: ['lederhose'] })))
    expect(p.outfit).toEqual({ ...NONE, outfit: 'outfit-regenjacke', shoes: 'gummistiefel' })
    expect(p.wardrobeSeen).toEqual(['outfit-regenjacke', 'krone'])
    expect(p.wardrobeTried).toEqual(['outfit-regenjacke'])
    // an outfit not unlocked yet is not worn (its stars come from the new
    // order): the child keeps clothes on, the cheapest unlocked outfit
    const few = me(load(kid(ITEM_BY_ID['outfit-regenjacke'].stars - 1, { outfit: { top: 'regenjacke', head: 'muetze' } })))
    expect(few.outfit).toEqual({ ...NONE, outfit: 'outfit-ringelshirt', head: 'muetze' })
  })
  it('an old save keeps what it wore where a part of it is unlocked, and never wears or "sees" a wrapped outfit', () => {
    const at = id => ITEM_BY_ID[id].stars
    // the old cheap shorts belong to the smoking now (much later): below it
    // the child keeps clothes on, the cheapest unlocked outfit; from its
    // stars on the smoking
    expect(cleanOutfit({ bottom: 'fussballshorts' }, 50)).toEqual({ ...NONE, outfit: 'outfit-ringelshirt' })
    expect(cleanOutfit({ bottom: 'fussballshorts', head: 'muetze' }, 50)).toEqual({ ...NONE, outfit: 'outfit-ringelshirt', head: 'muetze' })
    expect(cleanOutfit({ bottom: 'fussballshorts' }, at('outfit-smoking'))).toEqual({ ...NONE, outfit: 'outfit-smoking' })
    // no outfit unlocked yet at all (below the first, 15 stars): none, never a wrapped one
    expect(at('outfit-ringelshirt')).toBe(Math.min(...WARDROBE.filter(t => t.slot === 'outfit').map(t => t.stars)))
    expect(cleanOutfit({ bottom: 'fussballshorts', head: 'muetze' }, at('outfit-ringelshirt') - 1)).toEqual({ ...NONE, head: 'muetze' })
    expect(cleanOutfit({ top: 'smoking', bottom: 'jeansshorts' }, at('outfit-ringelshirt') - 1)).toEqual(NONE)
    expect(cleanOutfit({ bottom: 'fussballshorts' }, 0)).toEqual(NONE)
    // the top's outfit wrapped, the bottom's unlocked: the bottom's, not the
    // cheapest of all
    expect(cleanOutfit({ top: 'rentierpulli', bottom: 'tutu' }, at('outfit-bienenkostuem'))).toEqual({ ...NONE, outfit: 'outfit-bienenkostuem' })
    expect(cleanOutfit({ top: 'smoking', bottom: 'lederhose' }, at('outfit-skijacke'))).toEqual({ ...NONE, outfit: 'outfit-regenjacke' })
    // only the bottom, its outfit wrapped, others unlocked: the cheapest (the ringelshirt, 15 stars), not a later one
    expect(cleanOutfit({ bottom: 'pyjamahose' }, at('outfit-smoking'))).toEqual({ ...NONE, outfit: 'outfit-ringelshirt' })
    // a part in the wrong place or not known: nothing was worn, nothing is put on
    expect(cleanOutfit({ top: 'fussballshorts' }, 50)).toEqual(NONE)
    expect(cleanOutfit({ top: 'bogus', bottom: 'nope' }, 690)).toEqual(NONE)
    // whatever an old save wore, at any stars: never anything wrapped
    for (const top of [null, ...TOP.map(t => t.id)]) for (const bottom of [null, ...BOTTOM.map(t => t.id)]) for (const stars of [0, 14, 15, 50, 200, 365, 690]) {
      const o = cleanOutfit({ top, bottom }, stars).outfit
      if (top || bottom) expect(!!o, `${top}+${bottom}@${stars}`).toBe(stars >= at('outfit-ringelshirt'))
      if (o) expect(ITEM_BY_ID[o].stars, `${top}+${bottom}@${stars}`).toBeLessThanOrEqual(stars)
    }
    // the top's outfit still wrapped: the bottom's (unlocked) outfit instead
    expect(at('outfit-rentierpulli')).toBeGreaterThan(at('outfit-ringelshirt'))
    expect(cleanOutfit({ top: 'rentierpulli', bottom: 'jeansshorts' }, 50)).toEqual({ ...NONE, outfit: 'outfit-ringelshirt' })
    // both unlocked: the top's outfit, as before
    expect(cleanOutfit({ top: 'heldenshirt', bottom: 'jeansshorts' }, 50)).toEqual({ ...NONE, outfit: 'outfit-heldenshirt' })
    // neither unlocked: the cheapest unlocked outfit, the rest is kept
    expect(cleanOutfit({ top: 'smoking', bottom: 'tutu', head: 'muetze' }, 100)).toEqual({ ...NONE, outfit: 'outfit-ringelshirt', head: 'muetze' })
    // a mermaid's tail still wrapped takes no shoes off (the outfit put on instead has legs)
    expect(cleanOutfit({ bottom: 'meerjungfrau', shoes: 'turnschuhe' }, 100)).toEqual({ ...NONE, outfit: 'outfit-ringelshirt', shoes: 'turnschuhe' })
    expect(cleanOutfit({ bottom: 'meerjungfrau', shoes: 'turnschuhe' }, at('outfit-skijacke'))).toEqual({ ...NONE, outfit: 'outfit-skijacke' })
    // the lists: a part of a wrapped outfit counts for nothing yet
    expect(knownIds(['tutu', 'jeansshorts', 'muetze'], 50)).toEqual(['outfit-ringelshirt', 'muetze'])
    expect(knownIds(['tutu'], at('outfit-bienenkostuem'))).toEqual(['outfit-bienenkostuem'])

    // loaded at 50 stars (the old shorts unlocked at 42 before the outfits)
    const old = { outfit: { top: 'rentierpulli', bottom: 'fussballshorts', head: 'muetze' }, wardrobeSeen: ['tutu', 'fussballshorts', 'jeansshorts', 'muetze'], wardrobeTried: ['tutu', 'jeansshorts'] }
    let s = load(kid(50, old))
    // both old parts' outfits wrapped: clothes on all the same, the cheapest unlocked
    expect(me(s).outfit).toEqual({ ...NONE, outfit: 'outfit-ringelshirt', head: 'muetze' })
    // the same with the old shorts alone (the case of the check: shorts and a cap at 50)
    expect(me(load(kid(50, { outfit: { bottom: 'fussballshorts', head: 'muetze' } }))).outfit).toEqual({ ...NONE, outfit: 'outfit-ringelshirt', head: 'muetze' })
    // below the first outfit's stars nothing is put on, and nothing wrapped is seen
    const tiny = me(load(kid(10, { outfit: { bottom: 'fussballshorts', head: 'muetze' }, wardrobeSeen: ['fussballshorts', 'jeansshorts', 'muetze'] })))
    expect(tiny.outfit).toEqual({ ...NONE, head: 'muetze' })
    expect(tiny.wardrobeSeen).toEqual(['muetze'])
    expect(me(s).wardrobeSeen).toEqual(['outfit-ringelshirt', 'muetze'])
    expect(me(s).wardrobeTried).toEqual(['outfit-ringelshirt'])
    // nothing locked worn anywhere
    for (const id of Object.values(me(s).outfit).filter(Boolean)) expect(ITEM_BY_ID[id].stars).toBeLessThanOrEqual(50)
    // the bee costume is not seen while wrapped: when its stars come, it is
    // new (the sign on the home button), and seen once the wardrobe opens
    expect(unseenItems(me(s), 50).map(t => t.id)).not.toContain('outfit-bienenkostuem')
    s = load({ ...me(s), starsEver: at('outfit-bienenkostuem') })
    expect(unseenItems(me(s), at('outfit-bienenkostuem')).map(t => t.id)).toContain('outfit-bienenkostuem')
    s = reducer(s, { type: 'WARDROBE_SEEN' })
    expect(me(s).wardrobeSeen).toContain('outfit-bienenkostuem')
    // with the stars of both, the old top's outfit is worn
    expect(me(load(kid(at('outfit-rentierpulli'), old))).outfit).toEqual({ ...NONE, outfit: 'outfit-rentierpulli', head: 'muetze' })
  })
  it('what Lumi wears is saved with the rest', () => {
    const t = WARDROBE[2]
    const s = wear(load(kid(t.stars)), t.id)
    const again = migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: s.profiles })
    expect(again.profiles.p1.outfit[t.slot]).toBe(t.id)
  })
})
