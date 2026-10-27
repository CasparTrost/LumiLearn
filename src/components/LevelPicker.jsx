import { motion, AnimatePresence } from 'framer-motion'
import { Lock, X } from 'lucide-react'
import StarRow from './StarRow.jsx'
import { hearable } from '../lib/hearable.js'

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
  const accent     = mod.gradient.match(/#[0-9A-Fa-f]{6}/g)?.[0] ?? '#6C63FF'

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.45)',
          zIndex: 200,
          backdropFilter: 'blur(3px)',
        }}
      />

      <motion.div
        key="sheet"
        role="dialog"
        aria-label={`${title}: Level wählen`}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 201,
          background: 'linear-gradient(180deg,#f8f5ff 0%,#fff 100%)',
          borderRadius: '28px 28px 0 0',
          boxShadow: '0 -8px 40px rgba(74,0,224,0.18)',
          padding: 'clamp(20px,4vw,32px)',
          paddingBottom: 'calc(clamp(20px,4vw,32px) + env(safe-area-inset-bottom, 0px))',
          maxHeight: '85dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          {/* Kopfzeile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
              background: mod.gradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, boxShadow: `0 4px 14px ${mod.shadow}`,
            }}>{mod.emoji}</div>
            <div style={{
              flex: 1, minWidth: 0,
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(18px,4vw,24px)',
              fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2,
            }}>
              {title}
            </div>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onClose}
              aria-label="Schließen"
              style={{
                width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                background: 'var(--bg)', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <X size={20} color="var(--text-secondary)" />
            </motion.button>
          </div>

          {/* Weiterspielen */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onPick(current)}
            {...hearable(`Weiter mit Level ${current}`)}
            style={{
              width: '100%', border: 'none', cursor: 'pointer',
              background: mod.gradient, color: 'white',
              borderRadius: 99, padding: '14px 20px', marginBottom: 20,
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.5vw,19px)', fontWeight: 700,
              boxShadow: `0 6px 20px ${mod.shadow}`,
            }}
          >
            ▶ Weiter mit Level {current}
          </motion.button>

          {/* Alle Level */}
          <div style={{
            fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--text-muted)',
            marginBottom: 10, letterSpacing: 0.5, textTransform: 'uppercase',
          }}>
            Level wählen
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))',
            gap: 10,
          }}>
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map(lv => {
              const open  = lv <= unlocked
              const stars = levelStars[lv] ?? 0
              const isCur = lv === current
              return (
                <motion.button
                  key={lv}
                  disabled={!open}
                  whileHover={open ? { scale: 1.05, y: -2 } : undefined}
                  whileTap={open ? { scale: 0.94 } : undefined}
                  onClick={() => open && onPick(lv)}
                  {...hearable(`Level ${lv}`, { enabled: open })}
                  aria-label={open ? `Level ${lv}, ${stars} von 3 Sternen` : `Level ${lv}, noch gesperrt`}
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 20,
                    cursor: open ? 'pointer' : 'default',
                    background: open ? 'white' : 'var(--bg)',
                    border: isCur ? `3px solid ${accent}` : '2px solid var(--border)',
                    boxShadow: open ? '0 4px 14px rgba(74,0,224,0.10)' : 'none',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 6,
                    opacity: open ? 1 : 0.55,
                  }}
                >
                  {open ? (
                    <span style={{
                      fontFamily: 'var(--font-heading)', fontSize: 30, fontWeight: 800,
                      color: isCur ? accent : 'var(--text-primary)', lineHeight: 1,
                    }}>{lv}</span>
                  ) : (
                    <Lock size={26} color="var(--text-muted)" />
                  )}
                  {open && <StarRow filled={stars} total={3} size={13} />}
                </motion.button>
              )
            })}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
