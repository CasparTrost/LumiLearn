import { describe, it, expect } from 'vitest'
import {
  MOMENTS, planDay, stepFor, handsFor, cardFor, readingAt, readingOptions, offHand, callsFor,
  digital, spoken, hardToRead, faceOf, hourOf, sameFace, towards, skyFix, darkness, sunAt, moonAt, skyAt, DAWN, TASKS,
} from '../../src/games/lumistag/day.js'
import { hasEmojiArt, customName } from '../../src/lib/emojiArt.jsx'
import { CUSTOM_ART } from '../../src/lib/emojiArtList.js'

function seeded(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}
const at = (h, m = 0) => h * 60 + m

describe('Lumis Tag: the day of a level', () => {
  it('has a picture for every moment', () => {
    for (const m of MOMENTS) {
      const name = customName(m.art)
      expect(name ? CUSTOM_ART.has(name) : hasEmojiArt(m.art), m.id).toBe(true)
    }
  })

  it('gives six moments in the order of the day, from breakfast to bed, on the level\'s step', () => {
    for (let level = 1; level <= 10; level++) {
      for (let seed = 1; seed < 60; seed++) {
        const day = planDay(level, seeded(seed * 7 + level))
        expect(day).toHaveLength(TASKS)
        expect(day[0].moment).toBe('fruehstueck')
        expect(day[TASKS - 1].moment).toBe('schlafen')
        let prev = DAWN
        for (const t of day) {
          const m = MOMENTS.find(x => x.id === t.moment)
          expect(t.time).toBeGreaterThanOrEqual(m.from)
          expect(t.time).toBeLessThanOrEqual(m.to)
          expect(t.time % stepFor(level)).toBe(0)
          // the hands always have to move, at least an hour on the hour levels
          expect(t.time - prev).toBeGreaterThanOrEqual(stepFor(level) === 60 ? 60 : 45)
          prev = t.time
        }
        expect(new Set(day.map(t => t.moment)).size).toBe(TASKS)
      }
    }
  })

  it('brings in the new step of a level often', () => {
    const halves = Array.from({ length: 40 }, (_, i) => planDay(5, seeded(i + 3))).flat().filter(t => t.time % 60 === 30).length
    expect(halves).toBeGreaterThan(40 * 6 * 0.4)
  })

  it('grows over the levels: one hand, then both; picture clock, number, digital; reading rounds at the end', () => {
    expect([1, 2, 3, 4].map(handsFor)).toEqual(['hour', 'hour', 'hour', 'hour'])
    expect([5, 8, 10].map(handsFor)).toEqual(['both', 'both', 'both'])
    expect([1, 2, 3, 4, 5, 6, 7, 10].map(cardFor)).toEqual(['clock', 'clock', 'number', 'number', 'clock', 'digital', 'digital', 'digital'])
    expect([1, 4, 5, 7, 9].map(stepFor)).toEqual([60, 60, 30, 15, 5])
    expect(readingAt(8)).toEqual([])
    expect(readingAt(9)).toEqual([2, 4])
    const day = planDay(10, seeded(5))
    expect(day.filter(t => t.read).length).toBe(2)
    expect(day[0].read || day[5].read).toBe(false)
  })

  it('level 9 reads only clear faces; level 10 may ask the hard ones', () => {
    expect(hardToRead(at(12, 55))).toBe(true)  // the hour hand almost on 1
    expect(hardToRead(at(6, 45))).toBe(true)
    expect(hardToRead(at(4, 25))).toBe(true)   // the hands on top of each other
    expect(hardToRead(at(8, 10))).toBe(false)
    expect(hardToRead(at(12, 40))).toBe(false)
    let hard10 = 0
    for (let seed = 1; seed < 400; seed++) {
      for (const t of planDay(9, seeded(seed)).filter(t => t.read)) expect(hardToRead(t.time), digital(t.time)).toBe(false)
      hard10 += planDay(10, seeded(seed)).filter(t => t.read && hardToRead(t.time)).length
    }
    expect(hard10).toBeGreaterThan(0)
  })
})

describe('Lumis Tag: the clock', () => {
  it('reads a day time on a twelve-hour face', () => {
    expect(faceOf(at(19, 30))).toBe(at(7, 30))
    expect(hourOf(at(12, 15))).toBe(12)
    expect(hourOf(at(0, 5))).toBe(12)
    expect(hourOf(at(13))).toBe(1)
    expect(sameFace(at(7), at(19))).toBe(true)
    expect(sameFace(at(7), at(7, 5))).toBe(false)
  })

  it('names the hand that is off', () => {
    expect(offHand(at(9, 30), at(8, 30))).toBe('hour')
    expect(offHand(at(8), at(8, 30))).toBe('minute')
    expect(offHand(at(10, 15), at(8, 30))).toBe('both')
  })

  it('lets the cuckoo call the hour, and once at any other time', () => {
    expect(callsFor(at(7))).toBe(7)
    expect(callsFor(at(12))).toBe(12)
    expect(callsFor(at(20))).toBe(8)
    expect(callsFor(at(13, 30))).toBe(1)
  })

  it('writes and says the time like a child hears it', () => {
    expect(digital(at(19, 5))).toBe('7:05')
    expect(digital(at(12, 45))).toBe('12:45')
    expect(spoken(at(13))).toBe('ein Uhr')
    expect(spoken(at(7, 30))).toBe('halb acht')
    expect(spoken(at(8, 15))).toBe('Viertel nach acht')
    expect(spoken(at(11, 45))).toBe('Viertel vor zwölf')
    expect(spoken(at(8, 25))).toBe('fünf vor halb neun')
    expect(spoken(at(8, 40))).toBe('zwanzig vor neun')
  })

  it('offers two wrong times in a reading round, on the step and all different', () => {
    for (let seed = 1; seed < 200; seed++) {
      const rnd = seeded(seed)
      const time = at(7 + Math.floor(rnd() * 13), Math.floor(rnd() * 12) * 5)
      const opts = readingOptions(time, 5, rnd)
      expect(opts).toHaveLength(3)
      expect(new Set(opts.map(faceOf)).size).toBe(3)
      expect(opts.filter(o => sameFace(o, time))).toHaveLength(1)
      for (const o of opts) expect(o % 5).toBe(0)
    }
  })

  it('keeps the sky on the moment\'s time of day when the hands went round to the other half', () => {
    expect(skyFix(at(19), at(19))).toBe(0)
    expect(skyFix(at(7), at(19))).toBe(720)
    expect(skyFix(at(7) + 1440, at(7))).toBe(0)
    expect(towards(at(23), at(1))).toBe(120)
    expect(towards(at(1), at(23))).toBe(-120)
  })
})

describe('Lumis Tag: the sky', () => {
  it('is dark at night, light by day, and the sun is up only by day', () => {
    expect(darkness(at(2))).toBeGreaterThan(0.95)
    expect(darkness(at(12))).toBeLessThan(0.05)
    expect(darkness(at(21))).toBeGreaterThan(0.95)
    expect(darkness(at(6))).toBeGreaterThan(0.1)
    expect(darkness(at(6))).toBeLessThan(0.7)
    expect(sunAt(at(12)).up).toBeGreaterThan(0.95)
    expect(sunAt(at(2))).toBe(null)
    expect(moonAt(at(0))).not.toBe(null)
    expect(moonAt(at(12))).toBe(null)
  })

  it('has its colours at every minute of the day', () => {
    for (let t = 0; t < 1440; t += 7) {
      const s = skyAt(t)
      expect(s.top).toMatch(/^#[0-9a-f]{6}$/i)
      expect(s.bottom).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
