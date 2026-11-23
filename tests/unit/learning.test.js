import { describe, it, expect } from 'vitest'
import { updateSkill, nextLevel, dueSkills, planJourney, addDays, daysBetween, mastery, nextStopIndex, INTERVALS } from '../../src/lib/learning.js'
import { STICKERS, stickerForDay } from '../../src/lib/stickers.js'
import { reducer, migrateToV2, initialState, MAX_LEVELS, todayStr, journeyContext } from '../../src/AppContext.jsx'
import { MODULES, sortForAge } from '../../src/modules.js'
import { EMOJI_ART } from '../../src/lib/emojiArtList.js'
import { emojiCode } from '../../src/lib/emojiArt.jsx'

const T = '2026-11-23'

describe('dates', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02')
    expect(daysBetween('2026-11-23', '2026-12-01')).toBe(8)
  })
})

describe('spaced review', () => {
  it('moves a skill up after a good round and waits longer', () => {
    let s = updateSkill(undefined, { ratio: 1, today: T })
    expect(s.box).toBe(1)
    expect(s.due).toBe(addDays(T, INTERVALS[1]))
    s = updateSkill(s, { ratio: 0.9, today: T })
    expect(s.box).toBe(2)
  })
  it('keeps the box after a middling round, moves down after a hard one', () => {
    const s = { box: 3, recent: [] }
    expect(updateSkill(s, { ratio: 0.7, today: T }).box).toBe(3)
    expect(updateSkill(s, { ratio: 0.3, today: T }).box).toBe(2)
    expect(updateSkill({ box: 0 }, { ratio: 0, today: T }).box).toBe(0)
  })
  it('remembers the last four rounds', () => {
    let s
    for (const r of [0.1, 0.2, 0.3, 0.4, 0.5]) s = updateSkill(s, { ratio: r, today: T })
    expect(s.recent).toEqual([0.2, 0.3, 0.4, 0.5])
  })
  it('lists due skills, most overdue first', () => {
    const progress = {
      a: { skill: { box: 1, due: '2026-11-20' } },
      b: { skill: { box: 1, due: '2026-11-10' } },
      c: { skill: { box: 1, due: '2026-12-01' } },
      d: {},
    }
    expect(dueSkills(progress, T)).toEqual(['b', 'a'])
  })
})

describe('the right difficulty', () => {
  it('goes up after mostly first-try answers', () => {
    expect(nextLevel({ level: 3, currentLevel: 3, maxLevel: 10, ratio: 0.8 })).toBe(4)
    expect(nextLevel({ level: 10, currentLevel: 10, maxLevel: 10, ratio: 1 })).toBe(10)
  })
  it('stays to practise after a hard round', () => {
    expect(nextLevel({ level: 3, currentLevel: 3, maxLevel: 10, ratio: 0.5 })).toBe(3)
  })
  it('goes one down after two very hard rounds on the same level', () => {
    expect(nextLevel({ level: 3, currentLevel: 3, maxLevel: 10, ratio: 0.2, sameLevelRatios: [0.3] })).toBe(2)
    expect(nextLevel({ level: 1, currentLevel: 1, maxLevel: 10, ratio: 0, sameLevelRatios: [0] })).toBe(1)
  })
  it('an easy level played again leaves the suggestion where it was', () => {
    expect(nextLevel({ level: 2, currentLevel: 6, maxLevel: 10, ratio: 1 })).toBe(6)
    expect(nextLevel({ level: 2, currentLevel: 6, maxLevel: 10, ratio: 0.1 })).toBe(6)
  })
})

describe('mastery', () => {
  it('grows from new to sure', () => {
    expect(mastery(undefined)).toBe(0)
    expect(mastery({ plays: 1, skill: { box: 0 } })).toBe(1)
    expect(mastery({ plays: 3, skill: { box: 2 } })).toBe(2)
    expect(mastery({ plays: 9, completed: true, skill: { box: 4 } })).toBe(3)
  })
})

describe('the daily journey', () => {
  const mods = sortForAge(MODULES, { age: 5 })
  const ctx = { mods, maxLevels: MAX_LEVELS, today: T }

  it('gives a new child four different games and a movement break in the middle', () => {
    const stops = planJourney({ ...ctx, progress: {}, age: 5 })
    const games = stops.filter(s => s.kind !== 'move')
    expect(games).toHaveLength(4)
    expect(new Set(games.map(s => s.moduleId)).size).toBe(4)
    expect(stops.findIndex(s => s.kind === 'move')).toBeGreaterThan(0)
    expect(stops.findIndex(s => s.kind === 'move')).toBeLessThan(stops.length - 1)
    expect(games.every(s => s.level === 1)).toBe(true)
    // nothing too old for the child, no free painting
    const byId = Object.fromEntries(MODULES.map(m => [m.id, m]))
    expect(games.every(s => byId[s.moduleId].minAge <= 5 && s.moduleId !== 'coloring')).toBe(true)
  })

  it('mixes worlds', () => {
    const stops = planJourney({ ...ctx, progress: {}, age: 6 }).filter(s => s.moduleId)
    const byId = Object.fromEntries(MODULES.map(m => [m.id, m]))
    expect(new Set(stops.map(s => byId[s.moduleId].world)).size).toBeGreaterThanOrEqual(3)
  })

  it('opens with a due review and continues the game in progress', () => {
    const progress = {
      rhyme: { plays: 4, currentLevel: 5, levelStars: { 1: 3, 2: 3, 3: 2, 4: 2 }, skill: { box: 2, due: '2026-11-20' } },
      numbers: { plays: 2, currentLevel: 3, levelStars: { 1: 2, 2: 1 }, skill: { box: 1, due: '2026-11-30' } },
    }
    const stops = planJourney({ ...ctx, progress, age: 5 })
    expect(stops[0]).toMatchObject({ kind: 'warmup', moduleId: 'rhyme', level: 5 })
    expect(stops[1]).toMatchObject({ kind: 'learn', moduleId: 'numbers', level: 3 })
  })

  it('warms up one level below when nothing is due', () => {
    const progress = { rhyme: { plays: 4, currentLevel: 5, levelStars: { 1: 3 }, skill: { box: 2, due: '2026-12-20' } } }
    expect(planJourney({ ...ctx, progress, age: 5 })[0]).toMatchObject({ kind: 'warmup', moduleId: 'rhyme', level: 4 })
  })

  it('still plans a journey when only one game is left on', () => {
    const one = MODULES.filter(m => m.id === 'rhyme')
    const stops = planJourney({ ...ctx, mods: one, progress: {}, age: 5 })
    expect(stops.some(s => s.moduleId === 'rhyme')).toBe(true)
    expect(stops.some(s => s.kind === 'move')).toBe(true)
  })
})

describe('stickers', () => {
  it('every sticker has a picture and a name', () => {
    for (const s of STICKERS) {
      expect(EMOJI_ART.has(emojiCode(s.emoji)), s.emoji).toBe(true)
      expect(s.name).toMatch(/^(ein|eine) /)
    }
    expect(new Set(STICKERS.map(s => s.emoji)).size).toBe(STICKERS.length)
  })
  it('gives one the child does not have yet, the same one all day', () => {
    const a = stickerForDay([], 'x')
    expect(stickerForDay([], 'x')).toBe(a)
    const owned = STICKERS.slice(0, -1).map(s => s.emoji)
    expect(stickerForDay(owned, 'y')).toBe(STICKERS[STICKERS.length - 1].emoji)
    expect(stickerForDay(STICKERS.map(s => s.emoji), 'z')).toBeTruthy()
  })
})

describe('journey in the app state', () => {
  const start = () => {
    const s = migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: { p1: { id: 'p1', name: 'Mia', age: 5, avatar: '🦄' } } })
    return reducer({ ...initialState, ...s, screen: 'home' }, { type: 'ENSURE_DAILY_MISSION' })
  }
  const finish = (state, stopIdx, score = 5, total = 5) => {
    const stop = state.profiles.p1.journey.stops[stopIdx]
    const playing = reducer(state, { type: 'START_GAME', payload: { moduleId: stop.moduleId, level: stop.level, journeyStop: stopIdx } })
    return reducer(playing, { type: 'FINISH_GAME', payload: { moduleId: stop.moduleId, level: stop.level, stars: 3, score, total } })
  }

  it('plans today\'s journey for the child', () => {
    const s = start()
    expect(s.profiles.p1.journey.date).toBe(todayStr())
    expect(s.profiles.p1.journey.stops.length).toBeGreaterThanOrEqual(5)
    // asking again keeps it
    expect(reducer(s, { type: 'ENSURE_DAILY_MISSION' })).toBe(s)
    expect(journeyContext(s.profiles.p1).today).toBe(todayStr())
  })

  it('marks stops, tells the results screen what comes next, and opens the chest once', () => {
    let s = start()
    const stops = s.profiles.p1.journey.stops
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].kind === 'move') { s = reducer(s, { type: 'JOURNEY_STOP_DONE', payload: i }); continue }
      s = finish(s, i)
      const next = nextStopIndex(s.profiles.p1.journey)
      expect(s.gameResult.journey.next).toBe(next)
    }
    expect(nextStopIndex(s.profiles.p1.journey)).toBe(-1)
    const bonus = s.profiles.p1.farmBonus
    s = reducer(s, { type: 'OPEN_CHEST' })
    expect(s.profiles.p1.stickers).toHaveLength(1)
    expect(s.profiles.p1.farmBonus).toBeGreaterThan(bonus)
    const again = reducer(s, { type: 'OPEN_CHEST' })
    expect(again.profiles.p1.stickers).toHaveLength(1)
  })

  it('counts a planned game the child picked freely on the home screen', () => {
    const s = start()
    const idx = s.profiles.p1.journey.stops.findIndex(st => st.moduleId)
    const id = s.profiles.p1.journey.stops[idx].moduleId
    const playing = reducer(s, { type: 'START_GAME', payload: { moduleId: id, level: 1 } })
    const after = reducer(playing, { type: 'FINISH_GAME', payload: { moduleId: id, level: 1, stars: 3, score: 5, total: 5 } })
    expect(after.profiles.p1.journey.done).toContain(idx)
    expect(after.gameResult.journey).not.toBeNull()
  })

  it('does not open the chest before the journey is done', () => {
    const s = reducer(start(), { type: 'OPEN_CHEST' })
    expect(s.profiles.p1.stickers).toHaveLength(0)
  })

  it('suggests practising after a hard round and schedules a review', () => {
    let s = start()
    const playing = reducer(s, { type: 'START_GAME', payload: { moduleId: 'rhyme', level: 1 } })
    s = reducer(playing, { type: 'FINISH_GAME', payload: { moduleId: 'rhyme', level: 1, stars: 1, score: 2, total: 5 } })
    const p = s.profiles.p1.progress.rhyme
    expect(p.currentLevel).toBe(1)
    expect(p.levelStars[1]).toBe(1)
    expect(p.skill.box).toBe(0)
    expect(s.gameResult.suggestedLevel).toBe(1)
    expect(s.gameResult.journey).toBeNull()
  })
})

describe('journey and switched-off games', () => {
  it('plans an unstarted journey again when one of its games is switched off', () => {
    const s0 = migrateToV2({ version: 2, activeProfileId: 'p1', settings: {}, profiles: { p1: { id: 'p1', name: 'Mia', age: 5, avatar: '🦄' } } })
    const s = reducer({ ...initialState, ...s0, screen: 'home' }, { type: 'ENSURE_DAILY_MISSION' })
    const first = s.profiles.p1.journey.stops.find(st => st.moduleId).moduleId
    const after = reducer(s, { type: 'SET_GAME_HIDDEN', payload: { id: first, hidden: true, profileId: 'p1' } })
    expect(after.profiles.p1.journey.stops.some(st => st.moduleId === first)).toBe(false)
  })
})
