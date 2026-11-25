import { describe, it, expect } from 'vitest'
import { CASES, REACH } from '../../src/games/detektiv/cases.jsx'
import { ACTIONS } from '../../src/games/detektiv/actions.jsx'
import { SCRIPT } from '../../src/games/detektiv/script.js'
import { FEELING_ICON } from '../../src/games/feelings.js'
import { feelingWord } from '../../src/lib/words.js'

describe('Gefühlsdetektiv', () => {
  it('has at least fourteen cases, each with its sentence, a feeling and cards that exist', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(14)
    expect(new Set(CASES.map(k => k.id)).size).toBe(CASES.length)
    for (const k of CASES) {
      expect(SCRIPT[`detektiv/${k.id}`], k.id).toBeTruthy()
      expect(FEELING_ICON[k.feeling], k.id).toBeTruthy()
      expect(feelingWord(k.feeling), k.id).toBeTruthy()
      expect(k.good.length, k.id).toBeGreaterThan(0)
      for (const id of [...k.good, ...k.mean, ...k.odd]) expect(ACTIONS[id], `${k.id}: ${id}`).toBeTruthy()
      for (const id of k.good) expect(ACTIONS[id].mean, `${k.id}: ${id}`).toBeFalsy()
      // a card that helps is never also offered as one that does not
      expect(k.odd.filter(id => k.good.includes(id)), k.id).toEqual([])
      expect(k.mean.length, k.id).toBeGreaterThanOrEqual(2)
      if (k.good.includes('share')) expect(k.gift, k.id).toBeTruthy()
    }
  })

  it('has enough cases of every tier for a level without a repeat, and a second set for the first levels', () => {
    const tier = t => CASES.filter(k => k.tier === t).length
    expect(tier(1)).toBeGreaterThanOrEqual(8)
    expect(tier(2)).toBeGreaterThanOrEqual(3)
    expect(tier(3)).toBeGreaterThanOrEqual(4)
  })

  it('every card says a line of the script, and the script stays short', () => {
    for (const [id, a] of Object.entries(ACTIONS)) {
      expect(SCRIPT[a.say], id).toBe(`${a.label}.`)
      const { steps, hit, end } = a.play({}, { good: [id], gift: '🍪', lamp: null }, true)
      expect(steps.length, id).toBeGreaterThan(0)
      expect(hit, id).toBeLessThan(end)
    }
    for (const key of Object.keys(SCRIPT)) expect(key).toMatch(/^detektiv\/[a-z-]+$/)
    expect(Object.values(SCRIPT).join('').length).toBeLessThan(1200)
    expect(REACH).toBe(235)
  })
})
