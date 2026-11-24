import { describe, it, expect, vi } from 'vitest'
import { isLumiVoice, narrate } from '../../src/narrator.js'
import { line } from '../../src/lib/lumiLines.js'

describe('only Lumi\'s recorded voice speaks', () => {
  it('knows Lumi\'s recordings from everything else', () => {
    expect(isLumiVoice(line('rueckmeldung/richtig-1'))).toBe(true)
    expect(isLumiVoice({ src: 'audio/allgemein/ja-super.mp3' })).toBe(false)
    expect(isLumiVoice({ text: 'Tippe auf den Apfel.' })).toBe(false)
  })
  it('says nothing for text alone, and whoever waits goes on at once', () => {
    const done = vi.fn()
    narrate([{ text: 'Ein langer Satz der Browserstimme.' }, { src: 'audio/zahlen-entdecken/eins.mp3' }], { onEnd: done })
    expect(done).toHaveBeenCalledOnce()
  })
})
