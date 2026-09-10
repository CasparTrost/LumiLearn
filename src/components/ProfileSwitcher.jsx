import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useProfile } from '../hooks/useProfile.js'
import { useT } from '../i18n.js'
import { AVATARS, AGES } from '../screens/ProfileScreen.jsx'

// Inline edit form — rename/avatar/age, matching ProfileSwitcher's light
// sheet theme (ProfileScreen's own CreateProfileForm assumes a dark
// purple backdrop, so it isn't reused here as-is).
function EditProfileForm({ profile, onSave, onCancel }) {
  const [name, setName]     = useState(profile.name)
  const [age, setAge]       = useState(profile.age)
  const [avatar, setAvatar] = useState(profile.avatar)
  const canSave = name.trim().length >= 1

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Name
        </div>
        <input
          type="text" value={name} maxLength={20}
          onChange={e => setName(e.target.value)}
          style={{
            width: '100%', padding: '12px 16px', fontSize: 18, boxSizing: 'border-box',
            fontFamily: 'var(--font-heading)', fontWeight: 600, borderRadius: 16,
            border: '2px solid var(--border)', outline: 'none',
          }}
        />
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Alter
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {AGES.map(a => (
            <motion.button key={a} whileTap={{ scale: 0.92 }} onClick={() => setAge(a)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 14,
                fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800,
                background: age === a ? 'linear-gradient(135deg,#FFD93D,#FF9F43)' : 'var(--bg)',
                color: age === a ? '#1A1040' : 'var(--text-secondary)',
                border: age === a ? '2px solid #FF9F43' : '2px solid transparent',
                cursor: 'pointer',
              }}
            >{a}</motion.button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Avatar
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6 }}>
          {AVATARS.map(a => (
            <motion.button key={a} whileTap={{ scale: 0.9 }} onClick={() => setAvatar(a)}
              aria-label={`Avatar ${a}`}
              style={{
                aspectRatio: '1', borderRadius: 12, fontSize: 22,
                background: avatar === a ? 'linear-gradient(135deg,rgba(108,99,255,0.18),rgba(142,45,226,0.18))' : 'var(--bg)',
                border: avatar === a ? '2px solid var(--violet-mid)' : '2px solid transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >{a}</motion.button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <motion.button whileTap={{ scale: 0.96 }} onClick={onCancel}
          style={{ flex: 1, padding: '12px', borderRadius: 16, border: '2px solid var(--border)', background: 'white', color: 'var(--text-secondary)', fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}
        >Abbrechen</motion.button>
        <motion.button whileTap={{ scale: canSave ? 0.96 : 1 }} disabled={!canSave}
          onClick={() => canSave && onSave({ name: name.trim(), age, avatar })}
          style={{
            flex: 1, padding: '12px', borderRadius: 16, border: 'none',
            background: canSave ? 'linear-gradient(135deg,#6BCB77,#00B894)' : 'var(--border)',
            color: canSave ? 'white' : 'var(--text-muted)',
            fontFamily: 'var(--font-heading)', fontSize: 15, fontWeight: 700,
            cursor: canSave ? 'pointer' : 'not-allowed',
          }}
        >Speichern</motion.button>
      </div>
    </div>
  )
}

export default function ProfileSwitcher({ onClose }) {
  const t = useT()
  const { state, dispatch } = useApp()
  const { profile: activeProfile } = useProfile()
  const [editingId, setEditingId] = useState(null)

  const profilesObj = state.profiles ?? {}
  const profiles = Object.values(profilesObj)
  const editingProfile = editingId ? profilesObj[editingId] : null

  const switchTo = (id) => {
    dispatch({ type: 'SET_ACTIVE_PROFILE', payload: id })
    onClose()
  }

  const addProfile = () => {
    dispatch({ type: 'NAVIGATE', payload: 'profile' })
    onClose()
  }

  const saveEdit = (id, data) => {
    dispatch({ type: 'UPDATE_PROFILE', payload: { id, ...data } })
    setEditingId(null)
  }

  const deleteProfile = (p) => {
    if (!window.confirm(`${p.name} wirklich löschen? Alle Spielstände und Sterne von ${p.name} gehen dabei verloren.`)) return
    dispatch({ type: 'DELETE_PROFILE', payload: p.id })
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

        {editingProfile ? (
          <>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: 'clamp(18px,4vw,24px)',
              color: 'var(--text-primary)',
              fontWeight: 700,
              marginBottom: 16,
              textAlign: 'center',
            }}>
              {editingProfile.avatar} {editingProfile.name} bearbeiten
            </div>
            <EditProfileForm
              profile={editingProfile}
              onSave={(data) => saveEdit(editingProfile.id, data)}
              onCancel={() => setEditingId(null)}
            />
          </>
        ) : (
          <>
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
                  <div
                    key={p.id}
                    style={{
                      width: '100%',
                      background: isActive
                        ? 'linear-gradient(135deg,rgba(74,0,224,0.1),rgba(142,45,226,0.1))'
                        : 'rgba(255,255,255,0.9)',
                      borderRadius: 18,
                      padding: '14px 18px',
                      display: 'flex', alignItems: 'center', gap: 10,
                      border: isActive
                        ? '2px solid var(--violet-mid)'
                        : '1.5px solid var(--border)',
                      boxShadow: isActive
                        ? '0 4px 18px rgba(74,0,224,0.15)'
                        : '0 2px 8px rgba(0,0,0,0.06)',
                      transition: 'all 0.2s',
                    }}
                  >
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => switchTo(p.id)}
                      style={{
                        flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer',
                        background: 'none', border: 'none', padding: 0,
                        display: 'flex', alignItems: 'center', gap: 14,
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
                    <motion.button
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                      onClick={() => setEditingId(p.id)}
                      aria-label={`${p.name} bearbeiten`}
                      title="Bearbeiten"
                      style={{
                        width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                        background: 'rgba(108,99,255,0.08)', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                      }}
                    >✏️</motion.button>
                    {profiles.length > 1 && (
                      <motion.button
                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                        onClick={() => deleteProfile(p)}
                        aria-label={`${p.name} löschen`}
                        title="Löschen"
                        style={{
                          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                          background: 'rgba(255,107,107,0.1)', border: 'none', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                        }}
                      >🗑️</motion.button>
                    )}
                  </div>
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
          </>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
