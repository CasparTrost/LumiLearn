/**
 * LumiLearn Voice — Narrator MP3 playback.
 * Singleton that cancels the current clip before starting a new one.
 * Works within existing user-gesture context (no AudioContext needed).
 */

import { asset, BASE } from './lib/assets.js'
import { speak } from './tts.js'

function resolveAsset(src) {
  if (!src) return src
  if (src.startsWith('http') || src.startsWith(BASE) || src.startsWith('/')) return src
  return asset(src)
}

let _current = null

function _stop() {
  if (_current) {
    try { _current.pause() } catch { /* ignore */ }
    _current = null
  }
}

export const voice = {
  /**
   * Play a single audio file. Cancels any currently playing narration.
   * Pass `fallbackText` to fall back to browser speech synthesis if the
   * file 404s or otherwise fails to play — recorded narration is nicer,
   * but a silent failure (a missing file some content list didn't know
   * about) is worse than a robotic voice reading the word.
   */
  play(src, fallbackText) {
    _stop()
    if (!src) { if (fallbackText) speak(fallbackText); return }
    try {
      const a = new Audio(resolveAsset(src))
      _current = a
      const onFail = () => { if (fallbackText) speak(fallbackText) }
      a.addEventListener('error', onFail, { once: true })
      a.play().catch(onFail)
    } catch { if (fallbackText) speak(fallbackText) }
  },

  /**
   * Play multiple audio files in sequence, each starting after the previous ends.
   * Null/undefined entries are silently skipped. `fallbackTexts` (optional,
   * same length as `srcs`) is spoken via TTS for any entry that fails.
   */
  chain(srcs, fallbackTexts) {
    const entries = srcs
      .map((src, i) => ({ src, fallback: fallbackTexts?.[i] }))
      .filter(e => e.src)
    if (!entries.length) return
    _stop()
    let i = 0
    const playNext = () => {
      if (i >= entries.length) { _current = null; return }
      const { src, fallback } = entries[i++]
      try {
        const a = new Audio(resolveAsset(src))
        _current = a
        let failed = false
        const onFail = () => { failed = true; if (fallback) speak(fallback); playNext() }
        a.addEventListener('error', onFail, { once: true })
        a.addEventListener('ended', () => { if (!failed) playNext() }, { once: true })
        a.play().catch(onFail)
      } catch { if (fallback) speak(fallback); playNext() }
    }
    playNext()
  },

  /** Stop any currently playing narration. */
  stop: _stop,
}
