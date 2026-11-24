import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { animalSound } from '../../src/lib/animalSounds.js'

describe('animal sounds', () => {
  it('finds the sound for an animal, with or without the emoji variation mark', () => {
    expect(animalSound('🐮')).toBe('kuh')
    expect(animalSound('🐿️')).toBe('eichhoernchen')
    expect(animalSound('🐢')).toBeNull()
    expect(animalSound('lumi')).toBeNull()
    expect(animalSound(undefined)).toBeNull()
  })

  it('has a recording for every animal it names', () => {
    const src = readFileSync('src/lib/animalSounds.js', 'utf8')
    const names = new Set([...src.matchAll(/: '([a-z]+)'/g)].map(m => m[1]))
    expect(names.size).toBeGreaterThan(25)
    for (const n of names) expect(existsSync(`public/audio/tiere/${n}.mp3`), n).toBe(true)
  })
})
