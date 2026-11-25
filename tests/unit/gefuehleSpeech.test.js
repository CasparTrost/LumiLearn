import { describe, it, expect, vi, beforeEach } from 'vitest'

// what Lumi would say: every narrate call, as the keys of its parts
const calls = []
vi.mock('../../src/narrator.js', () => ({
  narrate: (parts, opts = {}) => { calls.push({ keys: parts.filter(Boolean).map(p => p.src ?? p.text), opts }); opts.onEnd?.() },
  preloadVoice: () => {},
}))
const { newDeal, sayMiss, sayFeeling } = await import('../../src/games/gefuehle/speech.js')
const { sayRight } = await import('../../src/lib/feedback.js')

const said = () => calls.splice(0).map(c => c.keys.join(' '))
const isNochNicht = k => /rueckmeldung\/noch-nicht-/.test(k)
const isLernen = k => /rueckmeldung\/fehler-lernen/.test(k)

describe('Gefühlswelt: the misses count per deal (E1)', () => {
  beforeEach(() => { sayRight(); newDeal(); calls.length = 0 })

  it('a miss in a later deal is a first miss again: "noch nicht", not "Fehler gehören zum Lernen"', () => {
    sayMiss()                      // deal 1: one wrong tap
    newDeal()                      // a right tap, the next deal (no praise in between)
    sayMiss()                      // deal 2: the first wrong tap
    sayMiss()                      // … and the second
    const [a, b, c] = said()
    expect(isNochNicht(a)).toBe(true)
    expect(isNochNicht(b)).toBe(true)
    expect(isLernen(c)).toBe(true)
  })

  it('every wrong tap of a deal is answered, the third and later too', () => {
    for (let i = 0; i < 5; i++) sayMiss()
    const s = said()
    expect(s).toHaveLength(5)
    expect(isLernen(s[1])).toBe(true)
    for (const k of [s[0], ...s.slice(2)]) expect(isNochNicht(k)).toBe(true)
  })

  it('the feeling word is not started again while it is being said', () => {
    sayFeeling('Traurig')
    const [c] = calls.splice(0)
    expect(c.keys).toHaveLength(1)
    expect(c.keys[0]).toMatch(/traurig/i)
    expect(c.opts.skipIfSame).toBe(true)
  })
})
