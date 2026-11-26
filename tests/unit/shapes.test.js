// Lumi verwandelt sich (src/lib/shapes.js): the shapes, the pictures, the
// free first choice, the steps, who is owed, and what the reducer keeps.
import { describe, it, expect } from 'vitest'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SHAPES, SHAPE_IDS, CHICK, SHAPE_POSE_IDS, STEPS, shapesEarned, cleanShapes, cleanShape, drawnShape, firstChoiceOwed,
  shapesOwed, shapesToCome, comingSteps, shapeLayers, shapeSrc, wearsClothes, setCurrentShape, currentShape, offerFirstByItself,
} from '../../src/lib/shapes.js'
import { WARDROBE, POSE_IDS } from '../../src/lib/wardrobe.js'
import { lumiArt } from '../../src/lib/assets.js'
import { reducer, migrateToV2, initialState, profileWardrobeStars } from '../../src/AppContext.jsx'
import { LINES } from '../../src/lib/lumiLines.js'
import { nextKidName } from '../../src/screens/ProfileScreen.jsx'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// the size of a webp picture from its header (VP8X, VP8 or VP8L)
function webpSize(buf) {
  const kind = buf.toString('ascii', 12, 16)
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)] }
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff]
}

describe('the shapes and their pictures', () => {
  it("five shapes, the chick first; every shape in Lumi's seven poses, 512 px, small", () => {
    expect(SHAPE_IDS).toEqual([CHICK, 'dino', 'einhorn', 'drache', 'roboter'])
    expect(SHAPE_POSE_IDS.slice().sort()).toEqual(POSE_IDS.slice().sort())
    for (const s of SHAPES.filter(x => x.id !== CHICK)) for (const p of SHAPE_POSE_IDS) {
      const file = join(ROOT, 'public', shapeSrc(s.id, p))
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size, file).toBeLessThan(60 * 1024)
      expect(webpSize(readFileSync(file)), file).toEqual([512, 512])
    }
    expect(shapeSrc(CHICK, 'hmm')).toBe('sprites/emoji/custom/lumi-hmm.webp')
    expect(shapeSrc(null, 'idle')).toBe('sprites/emoji/custom/lumi-idle.webp')
  })
  it('the maze has its pixel sprites for every shape (idle, happy, a 10-frame walk)', () => {
    for (const s of SHAPES) {
      const id = s.id === CHICK ? 'lumi' : s.id
      for (const [k, w] of [['idle', 64], ['happy', 64], ['walk', 640]]) {
        const f = join(ROOT, 'public/sprites/maze', `${id}_${k}.png`)
        expect(existsSync(f), f).toBe(true)
        const buf = readFileSync(f)
        expect([buf.readUInt32BE(16), buf.readUInt32BE(20)], f).toEqual([w, 64])
      }
    }
  })
  it('the drawing is layered like the chick\'s; clothes only on a shape with anchors (one switch)', () => {
    expect(shapeLayers('dino', 'wave')).toEqual({ layers: [{ kind: 'pose', src: 'sprites/shapes/dino-wave.webp' }], scale: 1 })
    expect(shapeLayers('dino', 'nope').layers[0].src).toBe('sprites/shapes/dino-idle.webp')
    expect(wearsClothes(CHICK)).toBe(true)
    expect(wearsClothes(null)).toBe(true)
    // (a shape wears clothes once its anchors are measured: tests/unit/shape-fit.test.js)
  })
  it("lumiArt (pictures outside React) follows the playing child's shape", () => {
    setCurrentShape('drache')
    expect(currentShape()).toBe('drache')
    expect(lumiArt('oops')).toMatch(/sprites\/shapes\/drache-hmm\.webp$/)
    setCurrentShape(CHICK)
    expect(lumiArt('happy')).toMatch(/sprites\/emoji\/custom\/lumi-happy\.webp$/)
    setCurrentShape(null)
  })
  it('Lumi speaks: at most eight new sentences, one per shape, all recorded', () => {
    const keys = Object.keys(LINES).filter(k => k.startsWith('gestalt/'))
    expect(keys.length).toBeLessThanOrEqual(8)
    for (const s of SHAPES) expect(LINES[`gestalt/${s.id}`], s.id).toContain(s.name)
    // recorded
    for (const k of keys) expect(existsSync(join(ROOT, 'public', `audio/lumi/${k}.mp3`)), k).toBe(true)
    expect(Object.keys(LINES).some(k => k.startsWith('freunde/'))).toBe(false)
  })
})

describe('the steps', () => {
  it('four steps, the first within the first days, none on a step of the wardrobe', () => {
    expect(STEPS.length).toBe(SHAPES.length - 1)
    expect(STEPS[0]).toBeLessThanOrEqual(25)
    for (let i = 1; i < STEPS.length; i++) expect(STEPS[i] - STEPS[i - 1]).toBeGreaterThanOrEqual(40)
    const wardrobe = new Set(WARDROBE.map(t => t.stars))
    for (const s of STEPS) expect(wardrobe.has(s), `step ${s}`).toBe(false)
    expect(shapesEarned(19)).toBe(0)
    expect(shapesEarned(20)).toBe(1)
    expect(shapesEarned(1000)).toBe(4)
  })
  it('cleaning: known ids once; Lumi is a shape owned or nothing yet', () => {
    expect(cleanShapes(['dino', 'x', 'dino', CHICK])).toEqual(['dino', CHICK])
    expect(cleanShapes('dino')).toEqual([])
    expect(cleanShape('dino', ['dino'])).toBe('dino')
    expect(cleanShape('drache', ['dino'])).toBe(null)
    expect(drawnShape({ shape: CHICK, shapes: [CHICK] })).toBe(null)
    expect(drawnShape({ shape: 'dino', shapes: ['dino'] })).toBe('dino')
    expect(drawnShape(null)).toBe(null)
  })
  it('each shape to come shows ITS step; only the next fills; reached but waiting has its own sign', () => {
    const p = { shapePicked: true, shapes: ['dino'], shape: 'dino' }
    const c = comingSteps(p, 30)
    expect(Object.keys(c)).toEqual([CHICK, 'einhorn', 'drache', 'roboter'])
    expect(Object.values(c).map(x => x.step)).toEqual([20, 70, 155, 260])
    expect(Object.values(c).map(x => x.next)).toEqual([true, false, false, false])
    expect(c[CHICK].waits).toBe(false)
    // its step reached, but the next waits for a game
    expect(comingSteps({ ...p, shapeWait: true }, 30)[CHICK]).toMatchObject({ step: 20, waits: true })
    const two = comingSteps({ shapePicked: true, shapes: ['dino', 'einhorn'] }, 30)
    expect(Object.values(two).map(x => x.step)).toEqual([70, 155, 260])
    expect(two[CHICK]).toMatchObject({ from: 20, next: true, waits: false })
  })
})

// ── the reducer ──────────────────────────────────────────────────────────────
const kid = (stars, more = {}) => {
  const levelStars = {}
  for (let l = 1, left = stars; left > 0; l++) { levelStars[l] = Math.min(3, left); left -= 3 }
  return { id: 'p1', name: 'Mia', age: 5, avatar: '🦊', progress: { 'shapes-land': { currentLevel: 1, levelStars, plays: 1 } }, ...more }
}
const load = p => ({ ...initialState, ...migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: { p1: p } }), screen: 'home' })
const me = s => s.profiles.p1
const first = (s, id) => reducer(s, { type: 'SHAPE_FIRST', payload: id })
const choose = (s, id) => reducer(s, { type: 'SHAPE_CHOOSE', payload: id })
const set = (s, id) => reducer(s, { type: 'SHAPE_SET', payload: id })
const finish = (s, stars, moduleId = 'numbers', level = 1) => reducer({ ...s, currentGame: { moduleId, level } },
  { type: 'FINISH_GAME', payload: { moduleId, level, stars, score: stars === 3 ? 4 : 2, total: 4 } })
const owed = s => shapesOwed(me(s), profileWardrobeStars(me(s)))

describe('the shapes in the reducer', () => {
  it('a new child chooses its Lumi when it is created; its avatar stays in the save', () => {
    const s = reducer(initialState, { type: 'ADD_PROFILE', payload: { name: 'Ben', age: 5, shape: 'drache' } })
    const p = s.profiles[s.activeProfileId]
    expect([p.shapes, p.shape, p.shapePicked]).toEqual([['drache'], 'drache', true])
    expect(firstChoiceOwed(p)).toBe(false)
    expect(drawnShape(p)).toBe('drache')
    expect(p.avatar).toBe('😊')
    // created without a choice (an older caller): the free first choice is owed
    const q = reducer(initialState, { type: 'ADD_PROFILE', payload: { name: 'Ben', age: 5 } })
    expect(firstChoiceOwed(q.profiles[q.activeProfileId])).toBe(true)
  })
  it('an old save: the chick until the free first choice, then its stars come one game at a time', () => {
    let s = load(kid(300))
    expect(me(s).shapes).toEqual([])
    expect(me(s).shape).toBe(null)
    expect(firstChoiceOwed(me(s))).toBe(true)
    expect(owed(s)).toBe(0)
    expect(choose(s, 'dino')).toBe(s)
    expect(set(s, 'dino')).toBe(s)
    s = first(s, 'einhorn')
    expect([me(s).shapes, me(s).shape]).toEqual([['einhorn'], 'einhorn'])
    expect(first(s, 'dino')).toBe(s)          // once
    expect(owed(s)).toBe(0)                   // waits for a game
    s = finish(s, 1)
    expect(s.gameResult.newShape).toBe(true)
    expect(owed(s)).toBe(4)
    s = choose(s, CHICK)                       // the chick is unlocked like the others
    expect(me(s).shape).toBe(CHICK)
    expect(owed(s)).toBe(0)
    s = finish(choose(finish(s, 1, 'numbers', 2), 'dino'), 1, 'numbers', 3)
    s = choose(s, 'roboter')
    s = finish(s, 1, 'numbers', 4)
    s = choose(s, 'drache')
    expect(me(s).shapes).toEqual(['einhorn', CHICK, 'dino', 'roboter', 'drache'])
    expect(owed(finish(s, 1, 'numbers', 5))).toBe(0)
  })
  it('a save of the first version (Lumis Freunde): the friends stay owned, the first choice is still offered', () => {
    let s = load(kid(80, { friends: ['dino', 'nope'], friendAlong: 'dino', friendWait: true }))
    const p = me(s)
    expect(p.shapes).toEqual(['dino'])
    expect(p.shape).toBe(null)
    expect(p.shapePicked).toBe(false)
    expect('friends' in p || 'friendAlong' in p || 'friendWait' in p).toBe(false)
    s = first(s, 'drache')
    expect(me(s).shapes).toEqual(['dino', 'drache'])
    // two steps reached (80 stars), one shape won besides the first: one more owed after a game
    s = finish(s, 1)
    expect(owed(s)).toBe(1)
  })
  it('the four steps after a start as a dino: the chick and the other three, chosen one at a time', () => {
    let s = reducer(initialState, { type: 'ADD_PROFILE', payload: { name: 'Ben', age: 5, shape: 'dino' } })
    const id = s.activeProfileId
    const p = () => s.profiles[id]
    const play = (n, lv) => { s = reducer({ ...s, currentGame: { moduleId: 'shapes-land', level: lv } }, { type: 'FINISH_GAME', payload: { moduleId: 'shapes-land', level: lv, stars: n, score: 4, total: 4 } }) }
    for (let lv = 1; lv <= 6; lv++) play(3, lv)              // 18 stars
    expect(shapesOwed(p(), profileWardrobeStars(p()))).toBe(0)
    play(3, 7)                                               // 21: the first step
    expect(s.gameResult.newShape).toBe(true)
    expect(Object.keys(comingSteps(p(), 21))).toEqual([CHICK, 'einhorn', 'drache', 'roboter'])
    s = reducer(s, { type: 'SHAPE_CHOOSE', payload: CHICK })
    expect(p().shapes).toEqual(['dino', CHICK])
    expect(shapesToCome(p()).map(x => x.id)).toEqual(['einhorn', 'drache', 'roboter'])
    expect(Object.values(comingSteps(p(), 21)).map(x => x.step)).toEqual([70, 155, 260])
  })
  it('the free first choice stops opening by itself after it was closed twice; choosing ends it', () => {
    let s = load(kid(30))
    expect(offerFirstByItself(me(s))).toBe(true)
    s = reducer(s, { type: 'SHAPE_OFFER_CLOSED' })
    expect(offerFirstByItself(me(s))).toBe(true)
    s = reducer(s, { type: 'SHAPE_OFFER_CLOSED' })
    expect(offerFirstByItself(me(s))).toBe(false)
    expect(firstChoiceOwed(me(s))).toBe(true)          // the present still offers it
    expect(me(load(me(s))).shapeOffersClosed).toBe(2)  // saved
    s = first(s, 'dino')
    expect(reducer(s, { type: 'SHAPE_OFFER_CLOSED' })).toBe(s)
    expect(offerFirstByItself(me(s))).toBe(false)
    expect(me(reducer(s, { type: 'RESET_PROFILE', payload: 'p1' })).shapeOffersClosed).toBe(0)
  })
  it('a child without a typed name is "Kind", then "Kind 2" …, never its shape', () => {
    expect(nextKidName([])).toBe('Kind')
    expect(nextKidName([{ name: 'Kind' }])).toBe('Kind 2')
    expect(nextKidName([{ name: 'Kind' }, { name: 'Kind 2' }, { name: 'Mia' }])).toBe('Kind 3')
  })
  it('choosing who Lumi is: only a shape owned; the same again changes nothing', () => {
    let s = first(load(kid(10)), 'dino')
    s = reducer(s, { type: 'SHAPE_FIRST', payload: 'dino' })
    expect(set(s, 'drache')).toBe(s)
    expect(set(s, 'dino')).toBe(s)
    s = load(kid(10, { shapePicked: true, shapes: ['dino', CHICK], shape: 'dino' }))
    s = set(s, CHICK)
    expect(me(s).shape).toBe(CHICK)
    expect(drawnShape(me(s))).toBe(null)
  })
  it('the outfit is one per child, whatever the shape', () => {
    let s = load(kid(10, { shapePicked: true, shapes: ['dino', CHICK], shape: CHICK, outfit: { head: 'muetze' } }))
    s = set(s, 'dino')
    expect(me(s).outfit.head).toBe('muetze')
    s = set(s, CHICK)
    expect(me(s).outfit.head).toBe('muetze')
  })
  it('"Kind zurücksetzen" gives the free first choice again; resetting one game loses nothing', () => {
    let s = load(kid(30, { shapePicked: true, shapes: ['dino', CHICK], shape: 'dino', shapeWait: true }))
    const r = reducer(s, { type: 'RESET_MODULE', payload: 'shapes-land' })
    expect([me(r).shapes, me(r).shape, me(r).shapePicked]).toEqual([['dino', CHICK], 'dino', true])
    s = reducer(s, { type: 'RESET_PROFILE', payload: 'p1' })
    expect([me(s).shapes, me(s).shape, me(s).shapePicked, me(s).shapeWait]).toEqual([[], null, false, false])
    expect(firstChoiceOwed(me(s))).toBe(true)
  })
  it('a save that says otherwise is cleaned, and the shapes are saved with the rest', () => {
    const p = me(load(kid(30, { shapePicked: true, shapes: ['dino', 'yeti', 'dino'], shape: 'drache', shapeWait: 'yes' })))
    expect([p.shapes, p.shape, p.shapeWait]).toEqual([['dino'], null, false])
    const s = first(load(kid(30)), 'roboter')
    const again = migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: s.profiles })
    expect([again.profiles.p1.shapes, again.profiles.p1.shape, again.profiles.p1.shapePicked]).toEqual([['roboter'], 'roboter', true])
  })
})
