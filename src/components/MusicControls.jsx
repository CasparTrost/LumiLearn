import { createContext, useContext, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { asset } from '../lib/assets.js'
import { onNarrationChange } from '../narrator.js'
import { useStoredState } from '../hooks/safeStorage.js'

const DUCK       = 0.35   // so leise wird die Musik, während geredet wird
const RELEASE_MS = 800    // so lange bleibt sie unten, bevor sie wieder hochfährt

const LS_ENABLED = 'lumi_music_enabled'
const LS_VOLUME  = 'lumi_music_volume'

const MusicContext = createContext({ enabled: false, setEnabled() {}, volume: 0.15, setVolume() {} })
export const useMusic = () => useContext(MusicContext)

/**
 * The background music, once for the whole app.
 *
 * Settings are read through safeStorage: with storage blocked the unguarded
 * read used to throw while rendering and the app stayed white.
 *
 * The file is only fetched when the music is on and the child has touched
 * the screen once (browsers do not play sound before that anyway). It used
 * to be created right away with the default preload, so every first visit
 * downloaded it, even with the music switched off.
 */
export function MusicProvider({ children }) {
  const [enabled, setEnabled] = useStoredState(LS_ENABLED, true, v => v === 'true')   // default on
  const [volume, setVolume]   = useStoredState(LS_VOLUME, 0.15, parseFloat)            // default quiet
  const audioRef  = useRef(null)
  // Musik und Lumis Stimme liefen gleich laut übereinander. Solange geredet
  // wird, geht die Musik in den Hintergrund.
  //
  // Der erste Anlauf schaltete hart um, sobald eine Ansage begann oder endete.
  // Beim Mitzählen in "Zahlen entdecken" ist das ein Ton pro Antippen — die
  // Musik sprang dann im Sekundentakt hoch und runter, teils zweimal in
  // derselben Millisekunde. Deshalb jetzt: weich überblenden, und nach dem
  // Ende erst nach einer Nachlaufzeit wieder hochfahren. Folgt die nächste
  // Ansage innerhalb dieser Zeit, bleibt die Musik unten und es pumpt nicht.
  const duckingRef = useRef(false)
  const releaseRef = useRef(null)
  const fadeRef    = useRef(null)
  const volumeRef  = useRef(volume)
  volumeRef.current = volume

  const getAudio = () => {
    if (!audioRef.current) {
      const audio = new Audio()
      audio.preload = 'none'
      audio.loop    = true
      audio.volume  = volumeRef.current * (duckingRef.current ? DUCK : 1)
      audio.src     = asset('music/background.mp3')
      audioRef.current = audio
    }
    return audioRef.current
  }

  useEffect(() => () => {
    const audio = audioRef.current
    if (audio) { audio.pause(); audio.src = '' }
  }, [])

  // Play or pause; while off, nothing is loaded at all
  useEffect(() => {
    if (!enabled) { audioRef.current?.pause(); return }
    const start = () => { getAudio().play().catch(() => {}) }
    if (navigator.userActivation?.hasBeenActive) { start(); return }
    // Browsers block sound until the first touch; load and start then
    window.addEventListener('pointerdown', start, { once: true })
    return () => window.removeEventListener('pointerdown', start)
  }, [enabled]) // eslint-disable-line react-hooks/exhaustive-deps

  const fadeTo = (target, ms = 280) => {
    const audio = audioRef.current
    if (!audio) return
    cancelAnimationFrame(fadeRef.current)
    const from = audio.volume
    const t0 = performance.now()
    const step = () => {
      const p = Math.min(1, (performance.now() - t0) / ms)
      audio.volume = Math.max(0, Math.min(1, from + (target - from) * p))
      if (p < 1) fadeRef.current = requestAnimationFrame(step)
    }
    step()
  }

  // Duck the music while something is being narrated
  useEffect(() => {
    const off = onNarrationChange(active => {
      clearTimeout(releaseRef.current)
      if (active) {
        duckingRef.current = true
        fadeTo(volume * DUCK)
      } else {
        releaseRef.current = setTimeout(() => {
          duckingRef.current = false
          fadeTo(volume)
        }, RELEASE_MS)
      }
    })
    return () => { off(); clearTimeout(releaseRef.current); cancelAnimationFrame(fadeRef.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [volume])

  // Sync volume
  useEffect(() => {
    const audio = audioRef.current
    if (audio) audio.volume = volume * (duckingRef.current ? DUCK : 1)
  }, [volume])

  return (
    <MusicContext.Provider value={{ enabled, setEnabled, volume, setVolume }}>
      {children}
    </MusicContext.Provider>
  )
}

/**
 * The music switch. It sits in the HUD bar next to "?" (or in the corner of
 * screens without one): fixed at the bottom right it covered paint buckets,
 * "Fertig" buttons and memo cards. The volume is set in the parent area.
 */
export default function MusicButton({ style }) {
  const { enabled, setEnabled } = useMusic()
  return (
    <button
      className={`px-btn px-btn--icon ${enabled ? 'px-btn--purple' : 'px-btn--parch'}`}
      onClick={() => setEnabled(!enabled)}
      title={enabled ? 'Musik ausschalten' : 'Musik einschalten'}
      aria-label={enabled ? 'Musik ausschalten' : 'Musik einschalten'}
      style={{ fontSize: 22, flexShrink: 0, ...style }}
    >
      <motion.span
        key={enabled ? 'on' : 'off'}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
      >
        {enabled ? '🎵' : '🔇'}
      </motion.span>
    </button>
  )
}
