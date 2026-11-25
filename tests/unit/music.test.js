import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { TRACKS, nextTrack } from '../../src/components/MusicControls.jsx'

describe('background music', () => {
  it('has several pieces, and every file is there', () => {
    expect(TRACKS.length).toBeGreaterThanOrEqual(3)
    for (const t of TRACKS) expect(existsSync(`public/${t}`), t).toBe(true)
    expect(new Set(TRACKS).size).toBe(TRACKS.length)
  })
  it('never plays the same piece twice in a row, and every piece gets its turn', () => {
    const seen = new Set()
    let cur = nextTrack(-1, TRACKS.length)
    for (let i = 0; i < 300; i++) {
      const next = nextTrack(cur, TRACKS.length)
      expect(next).not.toBe(cur)
      seen.add(next)
      cur = next
    }
    expect(seen.size).toBe(TRACKS.length)
    expect(nextTrack(0, 1)).toBe(0)
  })
})
