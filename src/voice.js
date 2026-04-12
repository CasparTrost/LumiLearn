/**
 * LumiLearn Voice — Narrator MP3 playback.
 * Singleton that cancels the current clip before starting a new one.
 * Works within existing user-gesture context (no AudioContext needed).
 */

let _current = null

function _stop() {
  if (_current) {
    try { _current.pause() } catch { /* ignore */ }
    _current = null
  }
}

export const voice = {
  /** Play a single audio file. Cancels any currently playing narration. */
  play(src) {
    _stop()
    if (!src) return
    try {
      const a = new Audio(src)
      _current = a
      a.play().catch(() => {})
    } catch { /* ignore */ }
  },

  /**
   * Play multiple audio files in sequence, each starting after the previous ends.
   * Null/undefined entries are silently skipped.
   */
  chain(srcs) {
    const list = srcs.filter(Boolean)
    if (!list.length) return
    _stop()
    let i = 0
    const playNext = () => {
      if (i >= list.length) { _current = null; return }
      try {
        const a = new Audio(list[i++])
        _current = a
        a.addEventListener('ended', playNext, { once: true })
        a.play().catch(playNext)  // skip on error (e.g. missing file)
      } catch { playNext() }
    }
    playNext()
  },

  /** Stop any currently playing narration. */
  stop: _stop,
}
