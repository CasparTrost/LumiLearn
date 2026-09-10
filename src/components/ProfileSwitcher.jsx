import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useProfile } from '../hooks/useProfile.js'
import { useT } from '../i18n.js'

export default function ProfileSwitcher({ onClose }) {
  const t = useT()
  const { state, dispatch } = useApp()
  const { profile: activeProfile } = useProfile()

  const profilesObj = state.profiles ?? {}
  const profiles = Object.values(profilesObj)

  const switchTo = (id) => {
    dispatch({ type: 'SET_ACTIVE_PROFILE', payload: id })
    onClose()
  }

  const addProfile = () => {
    dispatch({ type: 'NAVIGATE', payload: 'profile' })
    onClose()
  }

  return (
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
          background: 'rgba(0,0,0,0.45)',
          zIndex: 200,
          backdropFilter: 'blur(3px)',
        }}
      />

      {/* Sheet */}
      <motion.div
        key="sheet"
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
          paddingBottom: `calc(clamp(20px,4vw,32px) + env(safe-area-inset-bottom, 0px))`,
          maxHeight: '80dvh',
          overflowY: 'auto',
        }}
      >
        {/* Handle */}
        <div style={{
          width: 44, height: 5, borderRadius: 99,
          background: 'rgba(108,99,255,0.22)',
          margin: '0 auto 20px',
        }} />

        <div style={{
          fontFamily: 'var(--font-heading)',
          fontSize: 'clamp(18px,4vw,24px)',
          color: 'var(--text-primary)',
          fontWeight: 700,
          marginBottom: 16,
          textAlign: 'center',
        }}>
          👤 Profil wechseln
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {profiles.map((p) => {
            const isActive = p.id === activeProfile?.id
            return (
              <motion.button
                key={p.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => switchTo(p.id)}
                style={{
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  background: isActive
                    ? 'linear-gradient(135deg,rgba(74,0,224,0.1),rgba(142,45,226,0.1))'
                    : 'rgba(255,255,255,0.9)',
                  borderRadius: 18,
                  padding: '14px 18px',
                  display: 'flex', alignItems: 'center', gap: 14,
                  border: isActive
                    ? '2px solid var(--violet-mid)'
                    : '1.5px solid var(--border)',
                  boxShadow: isActive
                    ? '0 4px 18px rgba(74,0,224,0.15)'
                    : '0 2px 8px rgba(0,0,0,0.06)',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{
                  fontSize: 'clamp(28px,6vw,38px)',
                  lineHeight: 1,
                  width: 52, height: 52,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '50%',
                  background: isActive
                    ? 'linear-gradient(135deg,#8E2DE2,#4A00E0)'
                    : 'var(--bg)',
                  flexShrink: 0,
                }}>
                  {p.avatar}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-heading)',
                    fontSize: 'clamp(15px,3.5vw,20px)',
                    fontWeight: 700,
                    color: isActive ? 'var(--violet-mid)' : 'var(--text-primary)',
                    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                  }}>
                    {p.name}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 'clamp(11px,2.5vw,14px)',
                    color: 'var(--text-muted)',
                    marginTop: 2,
                  }}>
                    🪙 {p.coins ?? 0} · {p.age ? `${p.age} Jahre` : ''}
                  </div>
                </div>
                {isActive && (
                  <div style={{
                    background: 'var(--violet-mid)', color: 'white',
                    borderRadius: 99, padding: '4px 12px',
                    fontFamily: 'var(--font-heading)', fontSize: 12, fontWeight: 700,
                    flexShrink: 0,
                  }}>Aktiv</div>
                )}
              </motion.button>
            )
          })}

          {/* Add profile button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            onClick={addProfile}
            style={{
              width: '100%', cursor: 'pointer',
              background: 'rgba(108,99,255,0.06)',
              borderRadius: 18,
              padding: '14px 18px',
              display: 'flex', alignItems: 'center', gap: 14,
              border: '2px dashed rgba(108,99,255,0.3)',
              transition: 'all 0.2s',
            }}
          >
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'rgba(108,99,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, flexShrink: 0,
            }}>➕</div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(14px,3vw,18px)',
              color: 'var(--violet-mid)', fontWeight: 600,
            }}>
              Neues Profil anlegen
            </div>
          </motion.button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
