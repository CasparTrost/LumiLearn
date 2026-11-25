import { describe, it, expect } from 'vitest'
import { generateQuestions } from '../../src/games/gameEngine.js'
import {
  BAND, EMPTY, instOf, countOf, slotsOf, wantedAt, seated, membersOf, timeline, tryFrom, finaleTune,
  bpmOf, cheerBpm, REST, FINALE_BEATS,
} from '../../src/games/tierband/band.js'
import { BAND_VOICES } from '../../src/sfx.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'
import { hillSlots } from '../../src/games/tierband/stage.jsx'

const AB = { kind: 'next', tokens: ['🐸', '🐦', '🐸', '🐦', '🐸', EMPTY], gapAt: 5, options: ['🐸', '🐦', '🐱', '🦆'], answer: '🐦', unit: ['🐸', '🐦'] }
const GAP = { kind: 'gap', tokens: ['🐸', '🐦', '🐱', '🐸', EMPTY, '🐱', '🐸'], gapAt: 4, options: ['🐸', '🐦', '🐱', '🦆'], answer: '🐦', unit: ['🐸', '🐦', '🐱'] }
const BUILD = { kind: 'build', tokens: ['🐸', '🐦', '🐸', '🐦', EMPTY, EMPTY, EMPTY, EMPTY], gapAt: 4, fill: ['🐸', '🐦', '🐸', '🐦'], options: ['🐸', '🐦', '🐱'], answer: null, unit: ['🐸', '🐦'] }
const GROW = { kind: 'grow', tokens: ['🐸', '🐸🐸', '🐸🐸🐸', EMPTY], gapAt: 3, options: ['🐸🐸', '🐸🐸🐸', '🐸🐸🐸🐸', '🐸🐸🐸🐸🐸'], answer: '🐸🐸🐸🐸', unit: null, counts: [1, 2, 3, 4], sym: '🐸' }

describe('the band', () => {
  it('every animal has a picture, a name and a sound of its own', () => {
    expect(new Set(BAND.map(b => b.e)).size).toBe(BAND.length)
    expect(new Set(BAND.map(b => b.inst)).size).toBe(BAND.length)
    for (const b of BAND) {
      expect(hasEmojiArt(b.e), `picture for ${b.n}`).toBe(true)
      expect(b.n).toBeTruthy()
      expect(BAND_VOICES, `sound for ${b.n}`).toContain(b.inst)
      expect(instOf(b.e)).toBe(b.inst)
    }
  })

  it('has enough sound families for the longest rows and their wrong answers', () => {
    const families = new Set(BAND.map(b => b.fam ?? b.e))
    expect(families.size).toBeGreaterThanOrEqual(6)
  })

  it('a row never holds two animals whose instruments sound alike', () => {
    const fam = Object.fromEntries(BAND.map(b => [b.e, b.fam ?? b.e]))
    for (let level = 1; level <= 10; level++) {
      for (let run = 0; run < 30; run++) {
        for (const q of generateQuestions('patterns', level, 8)) {
          if (q.kind === 'grow') { expect(instOf(q.sym)).toBeTruthy(); continue }
          const inRow = membersOf(q)
          expect(new Set(inRow.map(e => fam[e])).size, inRow.join('')).toBe(inRow.length)
          // and nothing waits below that sounds like the animal that is missing
          const answers = q.fill ?? [q.answer]
          for (const o of q.options) {
            expect(instOf(o), `instrument for ${o}`).toBeTruthy()
            if (!inRow.includes(o)) for (const a of answers) expect(fam[o]).not.toBe(fam[a])
          }
        }
      }
    }
  })

  it('keeps a tempo a five-year-old can follow', () => {
    for (let level = 1; level <= 10; level++) {
      expect(bpmOf(level)).toBeGreaterThanOrEqual(100)
      expect(bpmOf(level)).toBeLessThanOrEqual(120)
      expect(cheerBpm(level, 6)).toBeGreaterThan(bpmOf(level))
      expect(cheerBpm(level, 10)).toBeLessThanOrEqual(200)
    }
  })
})

describe('a row as a rhythm', () => {
  it('one beat per place, the empty stool silent, then the dark', () => {
    const { events, length } = timeline(AB, [null])
    const notes = events.filter(e => !e.off)
    expect(notes.map(e => e.t)).toEqual([0, 1, 2, 3, 4, 5])
    expect(notes.map(e => e.inst)).toEqual(['drum', 'whistle', 'drum', 'whistle', 'drum', null])
    expect(events.at(-1)).toMatchObject({ t: 6, off: true })
    expect(length).toBe(6 + REST)
  })

  it('plays what the child has put on the stools', () => {
    expect(seated(BUILD, ['🐸', null, null, null]).slice(4)).toEqual(['🐸', null, null, null])
    const filled = timeline(BUILD, ['🐸', '🐦', null, null]).events.filter(e => !e.off).map(e => e.inst)
    expect(filled).toEqual(['drum', 'whistle', 'drum', 'whistle', 'drum', 'whistle', null, null])
    expect(slotsOf(BUILD)).toBe(4)
    expect(wantedAt(BUILD, 2)).toBe('🐸')
    expect(wantedAt(GAP, 0)).toBe('🐦')
  })

  it('after two misses the right animal plays softly for the stool that waits, and only for that one', () => {
    const { events } = timeline(BUILD, ['🐸', null, null, null], { help: '🐦' })
    const ghosts = events.filter(e => e.ghost)
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]).toMatchObject({ place: 5, inst: 'whistle', of: 0 })
    expect(ghosts[0].vol).toBeLessThan(1)
  })

  it('a try-out plays one round before the stool and then the wrong animal', () => {
    expect(tryFrom(AB, 5)).toBe(3)
    expect(tryFrom(GAP, 4)).toBe(1)
    expect(tryFrom(GROW, 3)).toBe(0)
    const { events } = timeline(AB, [null], { trial: { slot: 0, token: '🐱' }, from: tryFrom(AB, 5), upTo: 5, rest: 1 })
    expect(events.filter(e => !e.off).map(e => [e.place, e.inst])).toEqual([[3, 'whistle'], [4, 'drum'], [5, 'bell']])
    expect(events[0].t).toBe(0)
  })

  it('a growing row: every animal of a group plays, and the empty bench gets the time of the right group', () => {
    const { events } = timeline(GROW, [null])
    const per = [0, 1, 2, 3].map(p => events.filter(e => e.place === p && e.inst).length)
    expect(per).toEqual([1, 2, 3, 0])
    const empty = events.find(e => e.place === 3)
    const off = events.at(-1)
    expect(off.off).toBe(true)
    // four notes long, like the group that belongs there
    const note = events.filter(e => e.place === 2)[1].t - events.filter(e => e.place === 2)[0].t
    expect(off.t - empty.t).toBeGreaterThan(4 * note)
    expect(countOf(GROW, '🐸🐸🐸')).toBe(3)
  })

  it('a growing row: too many play on in the dark, too few leave the light waiting', () => {
    const many = timeline(GROW, [null], { trial: { slot: 0, token: '🐸🐸🐸🐸🐸' } }).events.filter(e => e.place === 3)
    expect(many.filter(e => e.inst)).toHaveLength(5)
    expect(many.filter(e => e.dark)).toHaveLength(1)
    expect(many.some(e => e.off)).toBe(true)
    const few = timeline(GROW, [null], { trial: { slot: 0, token: '🐸🐸' } }).events.filter(e => e.place === 3)
    expect(few.filter(e => e.inst)).toHaveLength(2)
    expect(few.some(e => e.wait)).toBe(true)
  })

  it('events come in the order of their time', () => {
    for (let level = 1; level <= 10; level++) {
      for (const q of generateQuestions('patterns', level, 8)) {
        const { events, length } = timeline(q, Array(slotsOf(q)).fill(null))
        for (let i = 1; i < events.length; i++) expect(events[i].t).toBeGreaterThanOrEqual(events[i - 1].t)
        expect(length).toBeGreaterThan(events.at(-1).t)
        expect(membersOf(q).length).toBeGreaterThan(0)
      }
    }
  })
})

describe('the finale', () => {
  it('everybody of the big band plays, and all together on the last note', () => {
    const { events, length } = finaleTune(['drum', 'bell', 'drum', 'quack'])
    expect(length).toBe(FINALE_BEATS)
    for (const inst of ['drum', 'bell', 'quack']) expect(events.some(e => e.inst === inst)).toBe(true)
    expect(events.some(e => e.inst === 'tune' && e.step != null)).toBe(true)
    const last = events.filter(e => e.all)
    expect(last).toHaveLength(1)
    expect(last[0].show.sort()).toEqual(['bell', 'drum', 'quack'])
    expect(last[0].t).toBeLessThan(length)
    for (let i = 1; i < events.length; i++) expect(events[i].t).toBeGreaterThanOrEqual(events[i - 1].t)
  })

  it('a bigger band plays each instrument softer', () => {
    const vol = insts => finaleTune(insts).events.find(e => e.inst === 'drum').vol
    expect(vol(BAND.map(b => b.inst))).toBeLessThan(vol(['drum', 'bell']))
  })
})

describe('the hill', () => {
  it('has room for a level\'s big band at every screen size, nobody outside it', () => {
    for (const [w, h, a, opt] of [[560, 165, 59], [374, 154, 55], [177, 150, 40, { pitch: 0.6, taper: 0.16, tiers: 5 }]]) {
      const slots = hillSlots(w, h, a, opt)
      expect(slots.length).toBeGreaterThanOrEqual(14)
      for (const s of slots) {
        expect(s.x - a / 2).toBeGreaterThanOrEqual(0)
        expect(s.x + a / 2).toBeLessThanOrEqual(w)
        expect(s.y - a).toBeGreaterThanOrEqual(-a * 0.2)
      }
    }
  })
})
