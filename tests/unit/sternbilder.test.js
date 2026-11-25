import { describe, it, expect } from 'vitest'
import { OUTLINES, roundsFor, pickOutlines, gapIn, minGap, skyInset, fill, MIN_GAP } from '../../src/games/sternbilder/outlines.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'

// The sky of the game (the room below the top bar and the album) as measured
// in the browser, per screen
const SKY = { phone: [374, 682], sideways: [760, 302], tablet: [1008, 602], smallPhone: [344, 578] }
const room = ([w, h]) => { const i = skyInset(w, h); return [w - 2 * i, h - 2 * i] }

// the same pictures every run
function seeded(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

describe('Sternbilder: outlines', () => {
  it('has at least sixteen different pictures, each with an illustrated picture', () => {
    expect(new Set(OUTLINES.map(o => o.pic)).size).toBeGreaterThanOrEqual(16)
    for (const o of OUTLINES) expect(hasEmojiArt(o.art), o.id).toBe(true)
  })

  it('names every outline after its picture and its number of stars', () => {
    const ids = new Set()
    for (const o of OUTLINES) {
      expect(o.id.startsWith(o.pic), o.id).toBe(true)
      expect(Number(o.id.match(/\d+/)[0]), o.id).toBe(o.pts.length)
      expect(ids.has(o.id), o.id).toBe(false)
      ids.add(o.id)
    }
  })

  it('keeps every star inside the box that is fitted into the sky', () => {
    for (const o of OUTLINES) {
      const [x0, y0, x1, y1] = o.box
      for (const [x, y] of o.pts) {
        expect(x >= x0 - 0.01 && x <= x1 + 0.01, `${o.id} x ${x}`).toBe(true)
        expect(y >= y0 - 0.01 && y <= y1 + 0.01, `${o.id} y ${y}`).toBe(true)
      }
      expect(minGap(o), o.id).toBeGreaterThan(8)
    }
  })
})

describe('Sternbilder: levels', () => {
  it('counts on, back and in steps as planned', () => {
    expect(roundsFor(1).map(r => r.numbers.join(' '))).toEqual(Array(4).fill('1 2 3 4 5'))
    expect(roundsFor(2)[0].numbers).toHaveLength(7)
    expect(roundsFor(4)).toHaveLength(5)
    expect(roundsFor(7)[0].numbers.at(-1)).toBe(20)
    expect(roundsFor(8)[0].numbers).toEqual([10, 9, 8, 7, 6, 5, 4, 3, 2, 1])
    expect(roundsFor(9)[0].numbers).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20])
    expect(roundsFor(10)[0].numbers).toEqual([5, 10, 15, 20, 25, 30, 35, 40])
    expect(roundsFor(10).at(-1).numbers[0]).toBe(20)
    expect(roundsFor(10).at(-1).numbers.at(-1)).toBe(1)
    // only numbers Lumi can say (0 to 40)
    for (let l = 1; l <= 10; l++) for (const r of roundsFor(l)) for (const v of r.numbers) expect(v >= 0 && v <= 40).toBe(true)
  })

  it('shows the picture as a ghost in the first levels only, fainter and fainter', () => {
    const ghost = l => roundsFor(l)[0].ghost
    for (let l = 1; l <= 5; l++) expect(ghost(l), `level ${l}`).toBeGreaterThan(0)
    for (let l = 2; l <= 5; l++) expect(ghost(l), `level ${l}`).toBeLessThan(ghost(l - 1))
    for (let l = 6; l <= 10; l++) for (const r of roundsFor(l)) expect(r.ghost).toBe(0)
  })

  it('stands tall pictures in the tall sky of a phone held upright more often', () => {
    const [w, h] = room(SKY.phone)
    let filled = 0, n = 0
    for (let seed = 1; seed <= 40; seed++) for (const o of pickOutlines(6, w, h, seeded(seed))) { filled += fill(o, w, h); n += 1 }
    const all = OUTLINES.filter(o => o.pts.length === 15)
    const even = all.reduce((a, o) => a + fill(o, w, h), 0) / all.length
    expect(filled / n).toBeGreaterThan(even + 0.05)
  })

  for (const [screen, sky] of Object.entries(SKY)) {
    it(`picks a picture with the right number of stars for every round, none twice (${screen})`, () => {
      const [w, h] = room(sky)
      for (let l = 1; l <= 10; l++) {
        for (let seed = 1; seed <= 12; seed++) {
          const picks = pickOutlines(l, w, h, seeded(seed))
          const rounds = roundsFor(l)
          expect(picks).toHaveLength(rounds.length)
          picks.forEach((o, i) => expect(o.pts.length, `level ${l}`).toBe(rounds[i].numbers.length))
          // the last picture of level 10 is the rocket of the countdown, on purpose
          const pics = picks.map(o => o.pic)
          expect(new Set(pics).size, `level ${l}: ${pics.join(' ')}`).toBe(pics.length)
        }
      }
    })
  }

  it('starts the countdowns with a rocket', () => {
    const [w, h] = room(SKY.phone)
    expect(pickOutlines(8, w, h)[0].pic).toBe('rocket')
    expect(pickOutlines(10, w, h).at(-1).pic).toBe('rocket')
    expect(pickOutlines(1, w, h)[0].pic).toBe('house')
  })

  it('keeps the stars at least 60 px apart on a phone held upright and on a tablet', () => {
    for (const screen of ['phone', 'tablet']) {
      const [w, h] = room(SKY[screen])
      for (let l = 1; l <= 10; l++) {
        for (let seed = 1; seed <= 25; seed++) {
          for (const o of pickOutlines(l, w, h, seeded(seed))) expect(gapIn(o, w, h), `${screen} level ${l} ${o.id}`).toBeGreaterThanOrEqual(MIN_GAP)
        }
      }
    }
  })

  it('keeps the stars a fingertip apart on a phone held sideways', () => {
    const [w, h] = room(SKY.sideways)
    for (let l = 1; l <= 10; l++) {
      for (let seed = 1; seed <= 25; seed++) {
        for (const o of pickOutlines(l, w, h, seeded(seed))) expect(gapIn(o, w, h), `level ${l} ${o.id}`).toBeGreaterThanOrEqual(44)
      }
    }
  })
})
