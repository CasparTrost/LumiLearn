import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useProfile } from '../hooks/useProfile.js'
import { useT } from '../i18n.js'
import { PxIcon } from './PixelUI.jsx'
import { narrate } from '../narrator.js'
import { hearable } from '../lib/hearable.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

// The children's switcher: tap your picture to play. Editing and deleting
// profiles moved into the PIN-protected parent area — here a tap on 🗑️
// and "OK" in the browser's confirm box deleted a sibling with all its
// progress.
export default function ProfileSwitcher({ onClose }) {
  const t = useT()
  const { state, dispatch } = useApp()
  const { profile: activeProfile } = useProfile()
  const profiles = Object.values(state.profiles ?? {})

  useEffect(() => { narrate([{ text: 'Wer spielt? Tippe auf dein Bild.' }]) }, [])
  // Tab stays in the sheet, Escape closes it
  const trapRef = useFocusTrap(true, { onEscape: onClose })

  const switchTo = (id) => {
    dispatch({ type: 'SET_ACTIVE_PROFILE', payload: id })
    onClose()
  }

  const addProfile = () => {
    dispatch({ type: 'NAVIGATE', payload: 'profile', create: true })
    onClose()
  }

  return createPortal(
    <AnimatePresence>
      {/* Backdrop */}
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

      {/* Sheet */}
      <motion.div
        key="sheet"
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label="Profil wechseln"
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
          padding: 'clamp(16px,4vw,28px)',
          paddingBottom: `calc(clamp(16px,4vw,28px) + env(safe-area-inset-bottom, 0px))`,
          maxHeight: '80dvh',
          overflowY: 'auto',
        }}
      >
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <div style={{
              flex: 1,
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(20px,4vw,26px)',
              color: 'var(--px-ink)',
              fontWeight: 700,
            }}>
              Wer spielt?
            </div>
            <button className="px-btn px-btn--parch px-btn--icon" onClick={onClose} aria-label="Schließen">
              <PxIcon name="close" size={20} color="var(--px-ink)" />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {profiles.map((p) => {
              const isActive = p.id === activeProfile?.id
              return (
                <button
                  key={p.id}
                  className="px-panel"
                  onClick={() => switchTo(p.id)}
                  {...hearable(p.name)}
                  aria-current={isActive ? 'true' : undefined}
                  style={{
                    width: '100%', cursor: 'pointer', textAlign: 'left',
                    padding: '10px 14px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    ...(isActive ? { background: '#fff1c2', borderColor: 'var(--px-ink)', outline: '3px solid var(--px-gold)', outlineOffset: -6 } : null),
                  }}
                >
                  <span className={`px-btn ${isActive ? 'px-btn--gold' : 'px-btn--parch'}`} aria-hidden="true"
                    style={{ width: 56, height: 56, padding: 0, fontSize: 34, flexShrink: 0, pointerEvents: 'none' }}>
                    {p.avatar}
                  </span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      display: 'block',
                      fontFamily: 'var(--font-heading)',
                      fontSize: 'clamp(18px,3.5vw,22px)',
                      fontWeight: 700,
                      color: 'var(--px-ink)',
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      {p.name}
                    </span>
                    {p.age ? (
                      <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 2 }}>
                        {p.age} Jahre
                      </span>
                    ) : null}
                  </span>
                  {isActive && <PxIcon name="check" size={22} color="var(--px-ink)" title="Spielt gerade" />}
                </button>
              )
            })}

            <button className="px-btn px-btn--parch px-btn--md" onClick={addProfile} style={{ alignSelf: 'center', marginTop: 4 }}>
              ➕ {t('profile.addLearner')}
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}
