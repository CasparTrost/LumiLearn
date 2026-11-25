import { describe, it, expect } from 'vitest'
import { CASES, REACH } from '../../src/games/detektiv/cases.jsx'
import { ACTIONS } from '../../src/games/detektiv/actions.jsx'
import { SCRIPT } from '../../src/games/detektiv/script.js'
import { FEELING_ICON } from '../../src/games/feelings.js'
import { feelingWord } from '../../src/lib/words.js'
import { LEVELS, buildRound } from '../../src/games/EmpathyGame.jsx'

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

describe('Gefühlsdetektiv: no wrong face a child could argue for', () => {
  // Faces a child could defend in a case (logic check, round 2). They must
  // never be offered as a wrong answer, through ALIKE or the case's notWith.
  const DEFENSIBLE = {
    eis: ['Wütend', 'Überrascht'],
    turm: ['Traurig', 'Überrascht'],
    stift: ['Traurig', 'Überrascht'],
    allein: ['Wütend', 'Überrascht'],
    geschenk: ['Überrascht', 'Neugierig', 'Stolz', 'Aufgeregt', 'Verlegen'],
    ballon: ['Überrascht', 'Stolz', 'Aufgeregt', 'Verlegen'],
    gewitter: ['Überrascht', 'Aufgeregt'],
    bellen: ['Überrascht', 'Aufgeregt'],
    dunkel: ['Überrascht', 'Aufgeregt'],
    platzen: ['Überrascht', 'Ängstlich', 'Wütend', 'Verlegen'],
    bild: ['Glücklich', 'Aufgeregt'],
    hochturm: ['Glücklich', 'Aufgeregt'],
    spaet: ['Gelangweilt'],
    saft: ['Ängstlich', 'Traurig', 'Überrascht'],
    regen: ['Müde', 'Traurig', 'Wütend'],
    geburtstag: ['Überrascht', 'Neugierig', 'Glücklich', 'Stolz', 'Ängstlich'],
    busch: ['Ängstlich', 'Überrascht', 'Aufgeregt'],
  }

  it('the balloon that pops leaves a sad friend, and comfort or a new balloon helps', () => {
    const k = CASES.find(c => c.id === 'platzen')
    expect(k.feeling).toBe('Traurig')
    expect(k.face).toBe('sad')
    expect(k.good).toEqual(expect.arrayContaining(['hug', 'share']))
  })

  it('every case, at every level it is played in, is offered only faces that are wrong', () => {
    LEVELS.forEach((cfg, i) => {
      const level = i + 1
      for (const k of CASES.filter(c => cfg.cases[c.tier - 1] > 0)) {
        const barred = [...k.notWith, ...(DEFENSIBLE[k.id] ?? [])]
        for (let n = 0; n < 150; n++) {
          const r = buildRound(k, cfg, level)
          const where = `${k.id}, level ${level}: ${r.chips.join(', ')}`
          expect(r.chips.length, where).toBe(cfg.chips)
          expect(new Set(r.chips).size, where).toBe(cfg.chips)
          expect(r.chips, where).toContain(k.feeling)
          for (const f of r.chips) if (f !== k.feeling) expect(barred, where).not.toContain(f)
        }
      }
    })
  })
})
