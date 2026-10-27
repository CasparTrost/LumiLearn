import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { PxStars, PxIcon } from './PixelUI.jsx'
import TileArt from './TileArt.jsx'
import { hearable } from '../lib/hearable.js'
import { narrate, lockPreviews } from '../narrator.js'
import { sayNumber } from '../tts.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

/**
 * Levelauswahl für ein Spiel.
 *
 * Bisher startete jede Kachel immer beim aktuellen Level; ein früheres Level
 * nochmal zu spielen ging nur über den Elternbereich, der dabei den
 * Fortschritt zurücksetzt. Hier lässt sich jedes freigespielte Level direkt
 * wählen, ohne dass sich am Fortschritt etwas ändert.
 *
 * Freigespielt ist alles bis zum aktuellen Level, und alles, was schon
 * einmal mindestens einen Stern bekommen hat.
 */
export function unlockedUpTo(progress, maxLevel) {
  if (progress?.completed) return maxLevel
  const stars = progress?.levelStars ?? {}
  const starred = Object.keys(stars).filter(l => (stars[l] ?? 0) >= 1).map(Number)
  return Math.min(maxLevel, Math.max(progress?.currentLevel ?? 1, ...starred, 1))
}

export default function LevelPicker({ mod, title, progress, maxLevel, onPick, onClose }) {
  const levelStars = progress?.levelStars ?? {}
  const current    = Math.min(progress?.currentLevel ?? 1, maxLevel)
  const unlocked   = unlockedUpTo(progress, maxLevel)

  // The sheet says what it is for; on a tablet the level buttons can't be
  // heard by pointing at them.
  useEffect(() => {
    narrate([{ text: `${title}. Welches Level möchtest du spielen? Der grüne Knopf spielt Level ${sayNumber(current)}.` }])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Tab stays in the sheet, Escape closes it
  const trapRef = useFocusTrap(true, { onEscape: onClose })

  // A click focuses the button, and focus starts the hover preview, which
  // then ran into the game's first task — so no previews from here on.
  const pick = lv => { lockPreviews(); onPick(lv) }

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(42,27,61,0.5)',
          zIndex: 200,
        }}
      />

      <motion.div
        key="sheet"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${title}: Level wählen`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 201,
          background: 'var(--px-parch)',
          borderTop: '4px solid var(--px-ink)',
          borderRadius: '14px 14px 0 0',
          boxShadow: 'inset 0 4px 0 var(--px-parch-light), 0 -6px 0 rgba(42,27,61,0.25)',
          padding: 'clamp(20px,4vw,32px)',
          paddingBottom: 'calc(clamp(20px,4vw,32px) + env(safe-area-inset-bottom, 0px))',
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {/* Kopfzeile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <TileArt mod={mod} size={56} />
            <div style={{
              flex: 1, minWidth: 0,
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px,4vw,24px)',
              fontWeight: 700, color: 'var(--px-ink)', lineHeight: 1.2,
            }}>
              {title}
            </div>
            <button
              className="px-btn px-btn--parch px-btn--icon"
              onClick={onClose}
              aria-label="Schließen"
              style={{ flexShrink: 0 }}
            >
              <PxIcon name="close" size={20} color="var(--px-ink)" />
            </button>
          </div>

          {/* Weiterspielen */}
          <button
            className="px-btn px-btn--green px-btn--lg"
            onClick={() => pick(current)}
            {...hearable(`Weiter mit Level ${sayNumber(current)}`)}
            style={{ width: '100%', marginBottom: 22 }}
          >
            <PxIcon name="play" size={22} /> Weiter mit Level {current}
          </button>

          {/* Alle Level */}
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 17, fontWeight: 700, color: 'var(--text-secondary)',
            marginBottom: 10,
          }}>
            Oder ein anderes Level:
          </div>
          {/* four to five small tiles a row on a phone (it used to be two
              big ones, and most levels were scrolled out of the sheet) */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(62px, 1fr))',
            gap: 10,
          }}>
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map(lv => {
              const open  = lv <= unlocked
              const stars = levelStars[lv] ?? 0
              const isCur = lv === current
              return (
                <button
                  key={lv}
                  className={`px-btn ${isCur ? 'px-btn--gold' : 'px-btn--parch'}`}
                  disabled={!open}
                  onClick={() => open && pick(lv)}
                  {...hearable(`Level ${sayNumber(lv)}`, { enabled: open })}
                  aria-label={open ? `Level ${lv}, ${stars} von 3 Sternen` : `Level ${lv}, noch gesperrt`}
                  style={{
                    height: 76, padding: 4,
                    flexDirection: 'column', gap: 5,
                  }}
                >
                  {open ? (
                    <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 30, fontWeight: 700, lineHeight: 1 }}>{lv}</span>
                  ) : (
                    <PxIcon name="lock" size={24} color="var(--px-ink)" />
                  )}
                  {open && <PxStars filled={stars} size={16} gap={1} />}
                </button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
