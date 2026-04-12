import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const LS_ENABLED = 'lumi_music_enabled'
const LS_VOLUME  = 'lumi_music_volume'

export default function MusicControls() {
  const audioRef  = useRef(null)
  const [enabled, setEnabled] = useState(() => {
    const v = localStorage.getItem(LS_ENABLED)
    return v === null ? true : v === 'true'   // default on
  })
  const [volume, setVolume] = useState(() => {
    const v = parseFloat(localStorage.getItem(LS_VOLUME))
    return isNaN(v) ? 0.15 : v               // default quiet
  })
  const [showSlider, setShowSlider] = useState(false)

  // Create audio element once
  useEffect(() => {
    const audio = new Audio('/music/background.mp3')
    audio.loop   = true
    audio.volume = volume
    audioRef.current = audio

    if (enabled) {
      // Browsers block auto-play until user interacts; retry on first click
      const tryPlay = () => {
        audio.play().catch(() => {})
        window.removeEventListener('pointerdown', tryPlay)
      }
      audio.play().catch(() => {
        window.addEventListener('pointerdown', tryPlay, { once: true })
      })
    }

    return () => {
      audio.pause()
      audio.src = ''
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Sync enabled state
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    localStorage.setItem(LS_ENABLED, String(enabled))
    if (enabled) {
      audio.play().catch(() => {})
    } else {
      audio.pause()
    }
  }, [enabled])

  // Sync volume
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.volume = volume
    localStorage.setItem(LS_VOLUME, String(volume))
  }, [volume])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 18,
        right: 18,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        zIndex: 999,
      }}
    >
      {/* Volume slider — slides in when music is on */}
      <AnimatePresence>
        {showSlider && (
          <motion.div
            initial={{ opacity: 0, width: 0, x: 20 }}
            animate={{ opacity: 1, width: 100, x: 0 }}
            exit={{ opacity: 0, width: 0, x: 20 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(8px)',
              borderRadius: 20,
              padding: '6px 12px',
              boxShadow: '0 4px 18px rgba(0,0,0,0.14)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}>
              <span style={{ fontSize: 13 }}>🔈</span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={e => setVolume(parseFloat(e.target.value))}
                style={{
                  width: 64,
                  accentColor: 'var(--primary, #6C63FF)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: 13 }}>🔊</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toggle button */}
      <motion.button
        onClick={() => {
          if (enabled) {
            setEnabled(false)
            setShowSlider(false)
          } else {
            setEnabled(true)
            setShowSlider(true)
          }
        }}
        title={enabled ? 'Musik an – Klick zum Ausschalten' : 'Musik einschalten'}
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.93 }}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: enabled
            ? 'linear-gradient(135deg, #a28bfa, #6C63FF)'
            : 'rgba(200,200,220,0.7)',
          backdropFilter: 'blur(6px)',
          boxShadow: enabled
            ? '0 4px 18px rgba(108,99,255,0.38)'
            : '0 2px 8px rgba(0,0,0,0.12)',
          transition: 'background 0.3s, box-shadow 0.3s',
        }}
      >
        <motion.span
          key={enabled ? 'on' : 'off'}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          {enabled ? '🎵' : '🔇'}
        </motion.span>
      </motion.button>
    </div>
  )
}
