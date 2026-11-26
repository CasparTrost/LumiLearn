// Lumis Freunde (src/lib/friends.js): the steps, the pictures, who is owed,
// and what the reducer keeps per child.
import { describe, it, expect } from 'vitest'
import { existsSync, statSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  FRIENDS, FRIEND_IDS, FRIEND_POSE_IDS, STEPS, friendsEarned, nextStep, stepBefore, cleanFriends, cleanAlong,
  friendsOwed, friendsToCome, friendPose, friendLayers, friendSrc,
} from '../../src/lib/friends.js'
import { WARDROBE, lumiPose } from '../../src/lib/wardrobe.js'
import { reducer, migrateToV2, initialState, profileWardrobeStars } from '../../src/AppContext.jsx'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

// the size of a webp picture from its header (VP8X, VP8 or VP8L)
function webpSize(buf) {
  const kind = buf.toString('ascii', 12, 16)
  if (kind === 'VP8X') return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)]
  if (kind === 'VP8L') { const b = buf.readUInt32LE(21); return [1 + (b & 0x3fff), 1 + ((b >> 14) & 0x3fff)] }
  return [buf.readUInt16LE(26) & 0x3fff, buf.readUInt16LE(28) & 0x3fff]
}

describe('the friends and their pictures', () => {
  it('four friends, six pictures each, 512 px, small', () => {
    expect(FRIEND_IDS).toEqual(['dino', 'einhorn', 'drache', 'roboter'])
    for (const f of FRIENDS) for (const p of FRIEND_POSE_IDS) {
      const file = join(ROOT, 'public', friendSrc(f.id, p))
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size, file).toBeLessThan(60 * 1024)
      expect(webpSize(readFileSync(file)), file).toEqual([512, 512])
    }
  })
  it("a friend follows Lumi's mood; there is no hmm picture, think stands for it", () => {
    for (const mood of ['idle', 'happy', 'dance', 'hop', 'sad', 'oops', 'hmm', 'think', 'sleep', 'wave', 'whatever']) {
      const lp = lumiPose(mood)
      expect(friendPose(mood), mood).toBe(lp === 'hmm' ? 'think' : lp)
    }
    expect(FRIEND_POSE_IDS).toContain(friendPose('hmm'))
  })
  it('the drawing is layered like Lumi\'s, ready for clothes later', () => {
    const { layers, scale } = friendLayers('dino', 'wave')
    expect(scale).toBe(1)
    expect(layers).toEqual([{ kind: 'pose', src: 'sprites/friends/dino-wave.webp' }])
    expect(friendLayers('dino', 'hmm').layers[0].src).toBe('sprites/friends/dino-idle.webp')
    expect(friendLayers('nobody', 'idle').layers).toEqual([])
    for (const f of FRIENDS) expect(typeof f.poses).toBe('object')
  })
})

describe('the steps', () => {
  it('four steps, the first within the first days, none on a step of the wardrobe', () => {
    expect(STEPS.length).toBe(FRIENDS.length)
    expect(STEPS[0]).toBeLessThanOrEqual(25)
    for (let i = 1; i < STEPS.length; i++) expect(STEPS[i] - STEPS[i - 1]).toBeGreaterThanOrEqual(40)
    const wardrobe = new Set(WARDROBE.map(t => t.stars))
    for (const s of STEPS) expect(wardrobe.has(s), `step ${s}`).toBe(false)
  })
  it('earned, next, the step before', () => {
    expect(friendsEarned(0)).toBe(0)
    expect(friendsEarned(19)).toBe(0)
    expect(friendsEarned(20)).toBe(1)
    expect(friendsEarned(1000)).toBe(4)
    expect(nextStep(0)).toBe(20)
    expect(nextStep(20)).toBe(70)
    expect(nextStep(260)).toBe(null)
    expect(stepBefore(10)).toBe(0)
    expect(stepBefore(80)).toBe(70)
  })
  it('owed: one at a time, waiting for the next game after a friend moved in', () => {
    expect(friendsOwed({}, 10)).toBe(0)
    expect(friendsOwed({}, 25)).toBe(1)
    expect(friendsOwed({ friends: ['dino'] }, 25)).toBe(0)
    expect(friendsOwed({ friends: ['dino'] }, 300)).toBe(3)
    expect(friendsOwed({ friends: ['dino'], friendWait: true }, 300)).toBe(0)
    expect(friendsToCome({ friends: ['drache'] }).map(f => f.id)).toEqual(['dino', 'einhorn', 'roboter'])
  })
  it('cleaning: known ids once, the one along must have moved in', () => {
    expect(cleanFriends(['dino', 'x', 'dino', 'roboter'])).toEqual(['dino', 'roboter'])
    expect(cleanFriends('dino')).toEqual([])
    expect(cleanAlong('dino', ['dino'])).toBe('dino')
    expect(cleanAlong('drache', ['dino'])).toBe(null)
    expect(cleanAlong('x', ['x'])).toBe(null)
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
const choose = (s, id) => reducer(s, { type: 'FRIEND_CHOOSE', payload: id })
const along = (s, id) => reducer(s, { type: 'FRIEND_ALONG', payload: id })
const finish = (s, stars, moduleId = 'numbers', level = 1) => reducer({ ...s, currentGame: { moduleId, level } },
  { type: 'FINISH_GAME', payload: { moduleId, level, stars, score: stars === 3 ? 4 : 2, total: 4 } })
const owed = s => friendsOwed(me(s), profileWardrobeStars(me(s)))

describe('the friends in the reducer', () => {
  it('an old save loads cleanly: no friends, nobody along, nothing waiting', () => {
    const p = me(load(kid(10)))
    expect(p.friends).toEqual([])
    expect(p.friendAlong).toBe(null)
    expect(p.friendWait).toBe(false)
  })
  it('a save that says otherwise is cleaned', () => {
    const p = me(load(kid(30, { friends: ['dino', 'nope', 'dino'], friendAlong: 'drache', friendWait: 'yes' })))
    expect(p.friends).toEqual(['dino'])
    expect(p.friendAlong).toBe(null)
    expect(p.friendWait).toBe(false)
    expect(me(load(kid(30, { friends: ['dino'], friendAlong: 'dino' }))).friendAlong).toBe('dino')
  })
  it('a round that reaches the first step says so; the child chooses, the friend comes along', () => {
    let s = finish(load(kid(STEPS[0] - 2)), 3)
    expect(s.gameResult.newFriend).toBe(true)
    expect(owed(s)).toBe(1)
    // a round more without choosing: no second announcement
    expect(finish(s, 1, 'numbers', 2).gameResult.newFriend).toBe(false)
    s = choose(s, 'drache')
    expect(me(s).friends).toEqual(['drache'])
    expect(me(s).friendAlong).toBe('drache')
    expect(owed(s)).toBe(0)
    // nobody else may move in now, and the same one not twice
    expect(choose(s, 'dino')).toBe(s)
    expect(choose(s, 'drache')).toBe(s)
  })
  it('choosing without a step reached, or an unknown friend, does nothing', () => {
    const s = load(kid(5))
    expect(choose(s, 'dino')).toBe(s)
    const t = load(kid(30))
    expect(choose(t, 'yeti')).toBe(t)
  })
  it('a child with many stars from before is given its friends one game apart', () => {
    let s = load(kid(300))
    expect(owed(s)).toBe(4)
    s = choose(s, 'einhorn')
    // the next waits for a game
    expect(owed(s)).toBe(0)
    expect(choose(s, 'dino')).toBe(s)
    s = finish(s, 1)
    expect(s.gameResult.newFriend).toBe(true)
    expect(owed(s)).toBe(3)
    s = choose(s, 'roboter')
    s = finish(choose(finish(s, 1, 'numbers', 2), 'dino'), 1, 'numbers', 3)
    expect(s.gameResult.newFriend).toBe(true)
    s = choose(s, 'drache')
    expect(me(s).friends).toEqual(['einhorn', 'roboter', 'dino', 'drache'])
    expect(owed(finish(s, 1, 'numbers', 4))).toBe(0)
    expect(finish(s, 1, 'numbers', 4).gameResult.newFriend).toBe(false)
  })
  it('one comes along at a time, or none; a tap on the one along leaves it at home', () => {
    let s = load(kid(300, { friends: ['dino', 'drache'], friendAlong: 'dino' }))
    s = along(s, 'drache')
    expect(me(s).friendAlong).toBe('drache')
    s = along(s, 'drache')
    expect(me(s).friendAlong).toBe(null)
    expect(along(s, null)).toBe(s)
    // only a friend that moved in
    expect(along(s, 'roboter')).toBe(s)
    s = along(s, 'dino')
    expect(me(s).friendAlong).toBe('dino')
    expect(me(along(s, null)).friendAlong).toBe(null)
  })
  it('"Kind zurücksetzen" clears the friends; resetting one game loses nothing', () => {
    let s = load(kid(30, { friends: ['dino'], friendAlong: 'dino', friendWait: true }))
    const r = reducer(s, { type: 'RESET_MODULE', payload: 'shapes-land' })
    expect(me(r).friends).toEqual(['dino'])
    expect(me(r).friendAlong).toBe('dino')
    expect(owed(r)).toBe(0)
    s = reducer(s, { type: 'RESET_PROFILE', payload: 'p1' })
    expect(me(s).friends).toEqual([])
    expect(me(s).friendAlong).toBe(null)
    expect(me(s).friendWait).toBe(false)
  })
  it('a new child starts without friends; they are saved with the rest', () => {
    const s0 = reducer(initialState, { type: 'ADD_PROFILE', payload: { name: 'Ben', age: 5 } })
    const p0 = s0.profiles[s0.activeProfileId]
    expect([p0.friends, p0.friendAlong, p0.friendWait]).toEqual([[], null, false])
    const s = choose(load(kid(30)), 'roboter')
    const again = migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: s.profiles })
    expect(again.profiles.p1.friends).toEqual(['roboter'])
    expect(again.profiles.p1.friendAlong).toBe('roboter')
    expect(again.profiles.p1.friendWait).toBe(true)
  })
})
