import { describe, it, expect } from 'vitest'
import { reducer, migrateToV2, initialState, saveData, farmPoints, needsHelpFirst } from '../../src/AppContext.jsx'
import { MODULES } from '../../src/modules.js'

const v2 = (profiles, extra = {}) => ({ version: 2, language: 'de', activeProfileId: Object.keys(profiles)[0], settings: {}, profiles, ...extra })
const kid = (id, progress = {}, more = {}) => ({ id, name: 'Mia', age: 5, avatar: '🦊', progress, ...more })

describe('loading saves', () => {
  it('keeps profiles and progress of a v2 save', () => {
    const s = migrateToV2(v2({ p1: kid('p1', { numbers: { currentLevel: 4, levelStars: { 1: 3, 2: 2, 3: 1 }, plays: 5 } }) }))
    expect(s.profiles.p1.name).toBe('Mia')
    expect(s.profiles.p1.progress.numbers.levelStars).toEqual({ 1: 3, 2: 2, 3: 1 })
    expect(s.profiles.p1.progress.numbers.currentLevel).toBe(4)
  })
  it('turns a v1 save (one child, no profiles) into a profile', () => {
    const s = migrateToV2({ profile: { name: 'Ben', age: 6, emoji: '🐻' }, progress: { letters: { currentLevel: 2, levelStars: { 1: 2 } } } })
    const p = Object.values(s.profiles)[0]
    expect(p.name).toBe('Ben')
    expect(p.progress.letters.levelStars[1]).toBe(2)
  })
  it('reads a saved English choice as German while English is hidden', () => {
    expect(migrateToV2(v2({ p1: kid('p1') }, { language: 'en' })).language).toBe('de')
  })
  it('drops retired fields and unknown hidden games, never hides all', () => {
    const s = migrateToV2(v2({ p1: kid('p1', {}, { coins: 50, hiddenGames: ['numbers', 'no-such-game'] }) }))
    expect(s.profiles.p1.coins).toBeUndefined()
    expect(s.profiles.p1.hiddenGames).toEqual(['numbers'])
  })
  it('survives garbage without throwing', () => {
    expect(() => migrateToV2({})).not.toThrow()
    expect(() => migrateToV2({ profiles: null })).not.toThrow()
  })
  it('round-trips through saveData', () => {
    const s = migrateToV2(v2({ p1: kid('p1', { maze: { currentLevel: 2, levelStars: { 1: 3 } } }) }))
    const again = migrateToV2(saveData({ ...initialState, ...s }))
    expect(again.profiles.p1.progress.maze.levelStars).toEqual({ 1: 3 })
  })
})

describe('finishing a game', () => {
  const start = () => ({ ...initialState, ...migrateToV2(v2({ p1: kid('p1') })) })
  const finish = (s, payload) => reducer(s, { type: 'FINISH_GAME', payload: { moduleId: 'numbers', level: 1, stars: 3, score: 8, total: 8, ...payload } })

  it('opens the next level and keeps the best stars', () => {
    let s = finish(start(), { stars: 3 })
    expect(s.profiles.p1.progress.numbers.currentLevel).toBe(2)
    s = finish(s, { stars: 1 })
    expect(s.profiles.p1.progress.numbers.levelStars[1]).toBe(3)
  })
  it('grows the farm with stars', () => {
    const s = finish(start(), { stars: 2 })
    expect(farmPoints(s.profiles.p1)).toBeGreaterThanOrEqual(2)
  })
  it('counts the streak once per day', () => {
    let s = finish(start(), {})
    s = finish(s, {})
    expect(s.profiles.p1.streak.count).toBe(1)
  })
  it('keeps "mastered" when a parent moves the level', () => {
    let s = start()
    for (let l = 1; l <= 10; l++) s = finish(s, { level: l, stars: 3 })
    const mastered = s.profiles.p1.progress.numbers.masteredAt
    expect(mastered).toBeTruthy()
    s = reducer(s, { type: 'SET_MODULE_LEVEL', payload: { id: 'numbers', level: 1 } })
    expect(s.profiles.p1.progress.numbers.masteredAt).toBe(mastered)
    expect(s.profiles.p1.progress.numbers.levelStars[10]).toBe(3)
  })
  it('counts a module without levels as played, with no stars and no results screen', () => {
    const s = finish(start(), { moduleId: 'coloring', stars: 3, score: 1, total: 1 })
    const p = s.profiles.p1
    expect(s.screen).toBe('home')
    expect(p.progress.coloring.plays).toBe(1)
    expect(p.progress.coloring.levelStars).toEqual({})
    expect(p.progress.coloring.completed).toBe(false)
    expect(p.dailyMission.levels).toBe(0)
    expect(p.dailyMission.got3Stars).toBe(false)
    expect(finish(start(), {}).screen).toBe('results')
  })
})

describe('profiles', () => {
  it('cannot hide the last visible game', () => {
    let s = { ...initialState, ...migrateToV2(v2({ p1: kid('p1') })) }
    for (const m of MODULES) s = reducer(s, { type: 'SET_GAME_HIDDEN', payload: { id: m.id, hidden: true, profileId: 'p1' } })
    expect(s.profiles.p1.hiddenGames.length).toBeLessThan(MODULES.length)
  })
  it('deleting the active child switches to another one', () => {
    let s = { ...initialState, ...migrateToV2(v2({ p1: kid('p1'), p2: { ...kid('p2'), name: 'Ben' } })) }
    s = reducer(s, { type: 'DELETE_PROFILE', payload: 'p1' })
    expect(s.profiles.p1).toBeUndefined()
    expect(s.activeProfileId).toBe('p2')
  })
})

describe('the help box the first time a game is played', () => {
  const start = () => migrateToV2(v2({ p1: kid('p1', { numbers: { currentLevel: 2, levelStars: { 1: 3 }, plays: 1 } }) }))
  it('is due for a game never played, not for one the child knows', () => {
    const p = start().profiles.p1
    expect(needsHelpFirst(p, 'maze')).toBe(true)
    expect(needsHelpFirst(p, 'numbers')).toBe(false)
    expect(needsHelpFirst(null, 'maze')).toBe(false)
  })
  it('is ticked off once per child and game, and survives saving', () => {
    let s = reducer(start(), { type: 'HELP_SEEN', payload: 'maze' })
    expect(needsHelpFirst(s.profiles.p1, 'maze')).toBe(false)
    expect(needsHelpFirst(s.profiles.p1, 'clock')).toBe(true)
    s = migrateToV2(JSON.parse(JSON.stringify(saveData(s))))
    expect(needsHelpFirst(s.profiles.p1, 'maze')).toBe(false)
    s = reducer(s, { type: 'ADD_PROFILE', payload: { name: 'Ben', age: 5, avatar: '🐻' } })
    expect(needsHelpFirst(s.profiles[s.activeProfileId], 'maze')).toBe(true)
  })
  it('comes again for a game that was started over', () => {
    let s = reducer(start(), { type: 'HELP_SEEN', payload: 'maze' })
    s = reducer(s, { type: 'RESET_MODULE', payload: 'maze' })
    expect(needsHelpFirst(s.profiles.p1, 'maze')).toBe(true)
    s = reducer(s, { type: 'RESET_MODULE', payload: 'numbers' })
    expect(needsHelpFirst(s.profiles.p1, 'numbers')).toBe(true)
  })
})
