import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { HudBar, PxIcon } from '../components/PixelUI.jsx'
import { journeyArt } from '../components/JourneyPath.jsx'
import { STICKER_PAGES, STICKERS } from '../lib/stickers.js'
import { narrate, stopNarration } from '../narrator.js'
import { emojiSrc } from '../lib/emojiArt.jsx'
import { line, LINES } from '../lib/lumiLines.js'

/**
 * The sticker album: every finished journey adds one (lib/stickers.js).
 * Empty places show the sticker's shadow — a little mystery what will come.
 * Tapping a sticker says what it is, a chance to name things together.
 */
export default function AlbumScreen() {
  const { state, dispatch } = useApp()
  const profile = state.profiles[state.activeProfileId]
  const owned = new Set(profile?.stickers ?? [])
  const home = () => { stopNarration(); dispatch({ type: 'NAVIGATE', payload: 'home' }) }

  useEffect(() => {
    const n = owned.size
    narrate([line(n ? 'reise/album' : 'reise/album-leer')])
    return stopNarration
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      <HudBar style={{ position: 'sticky', top: 0, zIndex: 10 }}>
        <button className="px-btn px-btn--wood px-btn--icon" onClick={home} aria-label="Zur Startseite"><PxIcon name="back" size={20} color="#fff" /></button>
        <img src={journeyArt('album.png')} alt="" style={{ width: 40, height: 40, imageRendering: 'pixelated' }} />
        <span className="px-title" style={{ flex: 1, fontSize: 'clamp(18px,3vw,28px)' }}>Mein Album</span>
        <span className="px-chip" aria-label={`${owned.size} von ${STICKERS.length} Stickern`} style={{ fontFamily: 'var(--font-heading)' }}>
          {owned.size} / {STICKERS.length}
        </span>
      </HudBar>
      <div style={{ padding: 'clamp(12px,3vw,32px)', display: 'grid', gap: 18, gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))', maxWidth: 1240, width: '100%', alignSelf: 'center' }}>
        {STICKER_PAGES.map(page => {
          const have = page.items.filter(([e]) => owned.has(e)).length
          return (
            <section key={page.id} className="px-panel" aria-label={page.title} style={{ padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 19, color: 'var(--px-ink)' }}>{page.title}</div>
                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--text-secondary)' }}>{have === page.items.length ? '⭐ voll!' : `${have} / ${page.items.length}`}</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(64px, 1fr))', gap: 8 }}>
                {page.items.map(([emoji, name]) => {
                  const got = owned.has(emoji)
                  return (
                    <motion.button key={emoji} whileTap={{ scale: 0.9 }}
                      onClick={() => narrate([{ text: got ? `${name[0].toUpperCase()}${name.slice(1)}!` : LINES['reise/sticker-fehlt'], src: got ? undefined : line('reise/sticker-fehlt').src }])}
                      aria-label={got ? name : 'Noch nicht gefunden'}
                      style={{
                        aspectRatio: '1', borderRadius: 12, cursor: 'pointer', padding: 6,
                        border: got ? '3px solid var(--px-ink)' : '3px dashed rgba(42,27,61,0.3)',
                        background: got ? 'radial-gradient(circle, #fffbe8 0%, #ffe9a8 100%)' : 'rgba(42,27,61,0.05)',
                        boxShadow: got ? '0 3px 0 rgba(42,27,61,0.35)' : 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      <img src={emojiSrc(emoji)} alt="" draggable={false}
                        style={{ width: '82%', height: '82%', objectFit: 'contain', filter: got ? 'none' : 'brightness(0) opacity(0.16)' }} />
                    </motion.button>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
