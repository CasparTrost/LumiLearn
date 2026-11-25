import { describe, it, expect } from 'vitest'
import { FRUITS, EATERS, LEVELS, NUM_COLORS, levelConfig, tasksFor, capacity, isRight, judge, nextDrop, dropX, paceAfter, slotOf, colsFor } from '../../src/games/zahlen/fangen.js'
import { hasEmojiArt } from '../../src/lib/emojiArt.jsx'
import { animalSound } from '../../src/lib/animalSounds.js'
import { numberWord } from '../../src/lib/words.js'
import { MAX_LEVELS } from '../../src/AppContext.jsx'

// the same game every run
function seeded(seed) {
  let s = seed
  return () => (s = (s * 9301 + 49297) % 233280) / 233280
}

describe('Bruno fängt: who catches what', () => {
  it('has an illustrated picture for every fruit and every animal', () => {
    for (const f of Object.values(FRUITS)) expect(hasEmojiArt(f.art), f.name).toBe(true)
    for (const e of EATERS) {
      expect(hasEmojiArt(e.art), e.label).toBe(true)
      for (const f of e.fruits) expect(FRUITS[f], `${e.label}: ${f}`).toBeTruthy()
    }
  })

  it('starts every level with Bruno and his apples', () => {
    expect(EATERS[0].art).toBe('🐻')
    expect(animalSound('🐻')).toBeTruthy()
    for (let l = 1; l <= 10; l++) {
      const t = tasksFor(l, seeded(l))[0]
      expect(t.eater.art).toBe('🐻')
      expect(t.wants[0].fruit).toBe('apfel')
    }
  })

  it('lets a different animal catch in every task', () => {
    for (let l = 1; l <= 10; l++) {
      const arts = tasksFor(l, seeded(l * 7)).map(t => t.eater.art)
      expect(new Set(arts).size, `level ${l}`).toBe(arts.length)
    }
  })
})

describe('Bruno fängt: the ten levels', () => {
  it('has ten levels, as the app expects', () => {
    expect(LEVELS).toHaveLength(10)
    expect(MAX_LEVELS['number-intro']).toBe(10)
    expect(levelConfig(0)).toBe(LEVELS[0])
    expect(levelConfig(99)).toBe(LEVELS[9])
  })

  it('has five to seven tasks per level', () => {
    for (let l = 1; l <= 10; l++) {
      const n = tasksFor(l, seeded(l)).length
      expect(n, `level ${l}`).toBeGreaterThanOrEqual(5)
      expect(n, `level ${l}`).toBeLessThanOrEqual(7)
    }
  })

  it('keeps the numbers of the plan: 1–3, to 5, to 7, to 10, then two amounts', () => {
    const top = l => Math.max(...tasksFor(l, seeded(l + 3)).flatMap(t => t.wants.map(w => w.n)))
    expect(top(1)).toBe(3)
    expect(top(2)).toBeLessThanOrEqual(5)
    expect(top(3)).toBe(5)
    expect(top(4)).toBeLessThanOrEqual(7)
    expect(top(5)).toBe(7)
    expect(top(6)).toBe(10)
    expect(top(8)).toBeLessThanOrEqual(10)
    for (let l = 1; l <= 10; l++) {
      for (const t of tasksFor(l, seeded(l * 11))) {
        expect(t.wants).toHaveLength(l >= 9 ? 2 : 1)
        for (const w of t.wants) {
          expect(w.n).toBeGreaterThanOrEqual(1)
          expect(w.n).toBeLessThanOrEqual(10)
          expect(numberWord(w.n), `Lumi can say ${w.n}`).toBeTruthy()
          expect(w.color).toBe(NUM_COLORS[w.n])
        }
      }
    }
    // every level opens with the amount set for it, an easy one
    for (let l = 1; l <= 8; l++) {
      expect(tasksFor(l, seeded(l))[0].wants[0].n, `level ${l}`).toBe(LEVELS[l - 1].first)
      expect(LEVELS[l - 1].first, `level ${l}`).toBeLessThanOrEqual(5)
    }
  })

  it('has hollows in levels 1–3 and "Mampf" from level 4', () => {
    expect(LEVELS.slice(0, 3).every(c => c.mode === 'nests')).toBe(true)
    // one thing at a time: strictly in level 1, and a gap about as long as the fall after it
    expect(LEVELS[0].gap).toBeNull()
    expect(LEVELS[1].gap).toBeGreaterThanOrEqual(LEVELS[1].fall)
    expect(LEVELS[2].gap).toBeGreaterThanOrEqual(LEVELS[2].fall - 0.5)
    expect(LEVELS.slice(3, 8).every(c => c.mode === 'free' && c.gap > 0)).toBe(true)
    expect(LEVELS.slice(8).every(c => c.mode === 'pair')).toBe(true)
  })

  it('gets faster and wider, never slower', () => {
    for (let l = 1; l < 10; l++) {
      // (level 7 brings a second kind and gives a little time back for it)
      if (l !== 6) expect(LEVELS[l].fall, `fall ${l + 1}`).toBeLessThanOrEqual(LEVELS[l - 1].fall)
      expect(LEVELS[l].reach, `reach ${l + 1}`).toBeGreaterThanOrEqual(LEVELS[l - 1].reach)
    }
    expect(LEVELS[0].fall).toBeGreaterThanOrEqual(4)
    expect(LEVELS[9].fall).toBeGreaterThanOrEqual(2.2)
  })

  it('has a second kind that cannot be mixed up, only where the plan says', () => {
    for (let l = 1; l <= 10; l++) {
      for (const t of tasksFor(l, seeded(l * 5))) {
        if (l === 7 || l === 8) {
          expect(t.other, `level ${l}`).toBeTruthy()
          expect(FRUITS[t.other].look).not.toBe(FRUITS[t.wants[0].fruit].look)
          // the kind not wanted is one the animal does not eat
          expect(t.eater.fruits).not.toContain(t.other)
        } else expect(t.other, `level ${l}`).toBeNull()
        if (l >= 9) {
          expect(t.wants[0].fruit).not.toBe(t.wants[1].fruit)
          expect(FRUITS[t.wants[0].fruit].look).not.toBe(FRUITS[t.wants[1].fruit].look)
          // both kinds are the animal's own food
          expect(t.eater.fruits).toContain(t.wants[0].fruit)
          expect(t.eater.fruits).toContain(t.wants[1].fruit)
          // two different amounts, so the two numerals differ in colour too
          expect(t.wants[0].n).not.toBe(t.wants[1].n)
        }
      }
    }
    expect(LEVELS.slice(0, 6).every(c => c.boot === 0 && c.other === 0)).toBe(true)
    expect(LEVELS.slice(6).every(c => c.boot > 0)).toBe(true)
  })
})

describe('Bruno fängt: Mampf', () => {
  const wants = [{ n: 3 }], two = [{ n: 2 }, { n: 3 }]

  it('eats only what is exactly right', () => {
    expect(isRight([3, 0], wants)).toBe(true)
    expect(isRight([2, 0], wants)).toBe(false)
    expect(isRight([2, 3], two)).toBe(true)
    expect(isRight([2, 4], two)).toBe(false)
    expect(judge([3, 0], wants).verdict).toBe('right')
  })

  it('says what is missing and what is too many', () => {
    expect(judge([1, 0], wants)).toEqual({ verdict: 'few', kinds: [{ need: 3, have: 1, missing: 2, extra: 0 }] })
    expect(judge([5, 0], wants)).toEqual({ verdict: 'many', kinds: [{ need: 3, have: 5, missing: 0, extra: 2 }] })
    expect(judge([0, 0], wants).verdict).toBe('few')
    const j = judge([3, 1], two)
    expect(j.verdict).toBe('mixed')
    expect(j.kinds.map(k => [k.missing, k.extra])).toEqual([[0, 1], [2, 0]])
    expect(judge([2, 5], two).verdict).toBe('many')
    expect(judge([1, 3], two).verdict).toBe('few')
  })

  it('lets a basket hold a few too many, but not endlessly', () => {
    const one = { wants: [{ n: 3 }] }, ten = { wants: [{ n: 10 }] }, pair = { wants: [{ n: 2 }, { n: 5 }] }
    expect(capacity(one, 0)).toBe(8)
    expect(capacity(ten, 0)).toBe(15)
    expect(capacity(pair, 0)).toBe(6)
    // a half of the two-kind basket: two rows of three, nothing over the rim
    expect(capacity(pair, 1)).toBe(6)
  })
})

describe('Bruno fängt: what falls', () => {
  it('never makes the child wait long for something wanted', () => {
    const rnd = seeded(42)
    for (const level of [7, 8, 9, 10]) {
      const cfg = levelConfig(level)
      const st = { counts: [0, 0], wants: [{ n: 4 }], hasOther: level < 9, sinceWanted: 0, goldDone: false, first: true }
      let dry = 0, kinds = new Set()
      for (let i = 0; i < 600; i++) {
        const d = nextDrop(cfg, st, rnd)
        if (i === 0) expect(d).toEqual({ kind: 'want', which: 0, gold: false })
        kinds.add(d.kind)
        st.first = false
        if (d.kind === 'want') dry = 0
        else dry += 1
        st.sinceWanted = dry
        expect(dry, `level ${level}`).toBeLessThanOrEqual(2)
      }
      expect(kinds.has('boot')).toBe(true)
      expect(kinds.has('other')).toBe(level < 9)
    }
  })

  it('drops nothing but the wanted fruit in levels 1–6', () => {
    const rnd = seeded(3)
    for (let level = 1; level <= 6; level++) {
      const st = { counts: [0, 0], wants: [{ n: 4 }], hasOther: false, sinceWanted: 0, goldDone: false, first: false }
      for (let i = 0; i < 100; i++) expect(nextDrop(levelConfig(level), st, rnd).kind).toBe('want')
    }
  })

  it('brings a golden one at most once per task', () => {
    const rnd = seeded(9)
    const st = { counts: [0, 0], wants: [{ n: 4 }], hasOther: false, sinceWanted: 0, goldDone: false, first: false }
    let gold = 0
    for (let i = 0; i < 200; i++) { if (nextDrop(levelConfig(4), st, rnd).gold) { gold += 1; st.goldDone = true } }
    expect(gold).toBe(1)
  })

  it('sends more of the kind that is still missing', () => {
    const rnd = seeded(17)
    const st = { counts: [2, 0], wants: [{ n: 2 }, { n: 4 }], hasOther: false, sinceWanted: 0, goldDone: true, first: false }
    let second = 0
    for (let i = 0; i < 400; i++) if (nextDrop({ ...levelConfig(9), boot: 0 }, st, rnd).which === 1) second += 1
    expect(second).toBeGreaterThan(300)
    expect(second).toBeLessThan(400)   // the full kind still comes: it has to be dodged
  })

  it('lets things fall inside the field, within reach, apart from each other', () => {
    const rnd = seeded(5)
    for (let i = 0; i < 300; i++) {
      const bx = 60 + rnd() * 320
      const x = dropX({ lo: 46, hi: 394, bx, reach: 0.4, width: 440, taken: [200] }, rnd)
      expect(x).toBeGreaterThanOrEqual(46)
      expect(x).toBeLessThanOrEqual(394)
      expect(Math.abs(x - bx)).toBeLessThanOrEqual(0.4 * 440 + 0.001)
    }
    expect(dropX({ lo: 46, hi: 394, bx: 10, reach: 0.4, width: 440, onto: true }, rnd)).toBe(46)
    expect(dropX({ lo: 46, hi: 394, bx: 222, reach: 0.4, width: 440, onto: true }, rnd)).toBe(222)
  })

  it('keeps things off the basket while it holds the right number (level 4)', () => {
    const rnd = seeded(8)
    for (let i = 0; i < 300; i++) {
      const bx = 95 + rnd() * 250
      const x = dropX({ lo: 46, hi: 394, bx, reach: 0.6, width: 440, avoid: true, half: 95 }, rnd)
      expect(Math.abs(x - bx), `bx ${bx} x ${x}`).toBeGreaterThanOrEqual(95 + 40)
    }
  })

  it('eases up after a miss and picks up after a clean task, within limits', () => {
    expect(paceAfter(1, 'miss')).toBeLessThan(1)
    expect(paceAfter(1, 'right')).toBeGreaterThan(1)
    let p = 1
    for (let i = 0; i < 20; i++) p = paceAfter(p, 'right')
    expect(p).toBe(1.25)
    for (let i = 0; i < 20; i++) p = paceAfter(p, 'miss')
    expect(p).toBe(0.75)
    expect(paceAfter(1.1, 'whatever')).toBe(1.1)
  })
})

describe('Bruno fängt: the basket', () => {
  it('fills in rows of five from the bottom, centred', () => {
    expect(slotOf(0, 5)).toEqual({ x: -2, row: 0 })
    expect(slotOf(4, 5)).toEqual({ x: 2, row: 0 })
    expect(slotOf(5, 5)).toEqual({ x: -2, row: 1 })
    expect(slotOf(0, 1)).toEqual({ x: 0, row: 0 })
    expect(slotOf(1, 2)).toEqual({ x: 0.5, row: 0 })
  })

  it('has as many hollows in a row as the number, five at most', () => {
    expect(colsFor({ wants: [{ n: 1 }] }, true)).toBe(1)
    expect(colsFor({ wants: [{ n: 3 }] }, true)).toBe(3)
    expect(colsFor({ wants: [{ n: 8 }] }, true)).toBe(5)
    expect(colsFor({ wants: [{ n: 3 }] }, false)).toBe(5)
    expect(colsFor({ wants: [{ n: 2 }, { n: 3 }] }, false)).toBe(3)
  })
})
