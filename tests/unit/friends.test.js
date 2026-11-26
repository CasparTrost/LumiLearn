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
