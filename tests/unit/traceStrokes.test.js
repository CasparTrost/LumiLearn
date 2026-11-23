import { describe, it, expect } from 'vitest'
import {
  GLYPHS, BOX, STEP, LETTERS, DIGITS, TOL, lengths, pointAt, glyphsForLevel, guidanceFor, makeTracer,
} from '../../src/games/traceStrokes.js'

const ALL = [...LETTERS, ...DIGITS]

/** Simple seeded random, so a failing case can be repeated */
function rng(seed) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

/** Feed a whole path to a tracer, as a finger would: down, moves, up. */
function trace(stroke, path) {
  const t = makeTracer(stroke)
  let r = t.down(path[0])
  if (r !== 'ok') r = 'ok'          // a wrong start shows up once the finger moves
  for (const p of path.slice(1)) {
    r = t.move(p)
    if (r !== 'ok') return r
  }
  return t.up()
}

/** Points along a stroke every `step` units, pushed sideways by `wobble`. */
function along(stroke, { from = 0, to = 1, step = 3, wobble = () => 0 } = {}) {
  const cum = lengths(stroke)
  const len = cum[cum.length - 1]
  const out = []
  for (let s = from * len; s <= to * len + 1e-9; s += step) {
    const p = pointAt(stroke, s, cum)
    const w = wobble(s)
    out.push({ x: p.x - Math.sin(p.angle) * w, y: p.y + Math.cos(p.angle) * w })
  }
  if (to === 1) out.push(stroke[stroke.length - 1])
  return out
}

describe('trace glyphs', () => {
  it('has every capital and every digit', () => {
    for (const g of ALL) expect(GLYPHS[g], g).toBeDefined()
    expect(Object.keys(GLYPHS).sort()).toEqual([...ALL].sort())
  })

  for (const g of ALL) {
    it(`${g}: strokes in the box, evenly sampled, smooth`, () => {
      const strokes = GLYPHS[g]
      expect(strokes.length).toBeGreaterThanOrEqual(1)
      expect(strokes.length).toBeLessThanOrEqual(4)
      for (const s of strokes) {
        expect(s.length).toBeGreaterThanOrEqual(8)
        for (const p of s) {
          expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(BOX.w)
          expect(p.y).toBeGreaterThanOrEqual(0); expect(p.y).toBeLessThanOrEqual(BOX.h)
        }
        for (let i = 1; i < s.length; i++) {
          const d = Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y)
          expect(d).toBeLessThanOrEqual(STEP + 0.05)
          expect(d).toBeGreaterThan(0)
        }
      }
      // the glyph fills the writing lines: cap height from 10 to 130
      const ys = strokes.flat().map(p => p.y)
      expect(Math.min(...ys)).toBeLessThanOrEqual(14)
      expect(Math.max(...ys)).toBeGreaterThanOrEqual(126)
    })
  }

  it('draws round glyphs without corners', () => {
    for (const g of ['O', 'C', '0']) {
      const s = GLYPHS[g][0]
      for (let i = 2; i < s.length - 1; i++) {
        const a = Math.atan2(s[i - 1].y - s[i - 2].y, s[i - 1].x - s[i - 2].x)
        const b = Math.atan2(s[i].y - s[i - 1].y, s[i].x - s[i - 1].x)
        const turn = Math.abs(((b - a + 3 * Math.PI) % (2 * Math.PI)) - Math.PI)
        expect(turn, `${g} at ${i}`).toBeLessThan(0.2)
      }
    }
  })

  it('writes in school direction: downstrokes go down, O and C counter-clockwise', () => {
    for (const g of ['I', 'L', 'T', 'H', 'E', 'F', 'B', 'D', 'P', 'R', 'K']) {
      const s = GLYPHS[g][0]
      expect(s[s.length - 1].y, g).toBeGreaterThan(s[0].y)
    }
    for (const g of ['O', 'C']) {
      const s = GLYPHS[g][0]
      // starting at the top or upper right, the pen first moves to the left
      expect(s[4].x, g).toBeLessThan(s[0].x)
    }
  })
})

describe('trace levels', () => {
  for (let level = 1; level <= 10; level++) {
    it(`level ${level}: five different glyphs, all drawable`, () => {
      for (let seed = 1; seed <= 40; seed++) {
        const gs = glyphsForLevel(level, rng(seed))
        expect(gs).toHaveLength(5)
        expect(new Set(gs).size).toBe(5)
        for (const g of gs) expect(GLYPHS[g]).toBeDefined()
      }
    })
  }

  it('begins with the straight lines and a one-stroke letter', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const gs = glyphsForLevel(1, rng(seed))
      expect(gs.every(g => 'ILTHEF'.includes(g))).toBe(true)
      expect(['I', 'L']).toContain(gs[0])
    }
  })

  it('brings back an earlier glyph from level 4 on, never as the first', () => {
    const learn = { 4: 'DPBRGQ', 5: '147023', 6: '5689' }
    for (const lv of [4, 5, 6]) {
      for (let seed = 1; seed <= 40; seed++) {
        const gs = glyphsForLevel(lv, rng(seed))
        const back = gs.filter(g => !learn[lv].includes(g))
        expect(back).toHaveLength(1)
        expect(learn[lv]).toContain(gs[0])
      }
    }
  })

  it('takes the help away step by step', () => {
    expect(guidanceFor(1)).toEqual({ arrows: 'all', road: 1 })
    expect(guidanceFor(7).arrows).toBe('start')
    expect(guidanceFor(9).road).toBeLessThan(1)
    expect(guidanceFor(10).arrows).toBe('none')
  })
})

describe('following a stroke', () => {
  for (const g of ALL) {
    it(`${g}: an exact trace is accepted, every stroke`, () => {
      for (const s of GLYPHS[g]) expect(trace(s, along(s))).toBe('done')
    })
  }

  it('accepts a wobbly trace that stays near the road', () => {
    for (const g of ALL) {
      for (const s of GLYPHS[g]) {
        const r = trace(s, along(s, { wobble: x => Math.sin(x / 6) * TOL * 0.6 }))
        expect(r, g).toBe('done')
      }
    }
  })

  it('rejects starting at the wrong end', () => {
    for (const g of ALL) {
      for (const s of GLYPHS[g]) {
        const back = along(s).reverse()
        expect(trace(s, back), g).not.toBe('done')
      }
    }
  })

  it('rejects running the wrong way round a closed stroke', () => {
    // O starts and ends at the top: starting right, but going clockwise
    for (const g of ['O', '0']) {
      const s = GLYPHS[g][0]
      const r = trace(s, [s[0], ...along(s).reverse()])
      expect(['wrongWay', 'offPath']).toContain(r)
    }
  })

  it('rejects leaving the road', () => {
    const s = GLYPHS.L[0]
    expect(trace(s, along(s, { wobble: x => (x > 40 ? TOL * 2 : 0) }))).toBe('offPath')
  })

  it('does not accept a stroke lifted halfway', () => {
    for (const g of ['I', 'O', 'S', 'M']) {
      const s = GLYPHS[g][GLYPHS[g].length - 1]
      expect(trace(s, along(s, { to: 0.5 })), g).toBe('short')
    }
  })

  it('does not accept a shortcut that skips most of the stroke', () => {
    // C: from the start straight across to the end
    const s = GLYPHS.C[0]
    const a = s[0], b = s[s.length - 1]
    const path = Array.from({ length: 30 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / 29, y: a.y + (b.y - a.y) * i / 29 }))
    expect(trace(s, path)).not.toBe('done')
  })

  it('treats a short touch as a tap, not as an attempt', () => {
    const s = GLYPHS.I[0]
    const t = makeTracer(s)
    t.down({ x: 50, y: 120 })
    t.move({ x: 50, y: 118 })
    expect(t.up()).toBe('tap')
    expect(t.started).toBe(false)
    expect(t.real).toBe(false)
  })
})
