import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import Button from '../components/Button.jsx'

const AVATARS = ['🐻', '🐼', '🦁', '🐨', '🦊', '🐧', '🦋', '🐬', '🦄', '🐸', '🐙', '🐯']
const AGES = [3, 4, 5, 6, 7]

function CreateProfileForm({ onSave, onCancel, showCancel }) {
  const [name, setName] = useState('')
  const [age, setAge] = useState(null)
  const [avatar, setAvatar] = useState(null)

  const canSubmit = name.trim().length >= 1 && age !== null && avatar !== null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      {/* Avatar */}
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 12 }}>
          🎭 Choose your avatar
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
          {AVATARS.map((a) => (
            <motion.button
              key={a}
              whileHover={{ scale: 1.15 }}
              whileTap={{ scale: 0.92 }}
              onClick={() => setAvatar(a)}
              style={{
                fontSize: 'clamp(22px, 5vw, 32px)',
                aspectRatio: '1',
                borderRadius: 16,
                background: avatar === a
                  ? 'linear-gradient(135deg, #6C63FF, #A78BFA)'
                  : 'rgba(108,99,255,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: avatar === a ? '2.5px solid #6C63FF' : '2.5px solid transparent',
                transition: 'background 0.2s, border 0.2s',
                boxShadow: avatar === a ? '0 4px 16px rgba(108,99,255,0.35)' : 'none',
              }}
            >
              {a}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Name */}
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 10 }}>
          ✏️ Your name
        </div>
        <input
          type="text"
          placeholder="e.g. Emma, Luca, Mia..."
          value={name}
          maxLength={20}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && canSubmit && onSave({ name: name.trim(), age, avatar })}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: 18,
            fontFamily: 'var(--font-body)',
            borderRadius: 16,
            border: '2.5px solid',
            borderColor: name ? 'var(--violet)' : '#E2DCF8',
            outline: 'none',
            background: 'var(--bg)',
            color: 'var(--text-primary)',
            transition: 'border-color 0.2s',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Age */}
      <div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 10 }}>
          🎂 How old are you?
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {AGES.map(a => (
            <motion.button
              key={a}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setAge(a)}
              style={{
                width: 56, height: 56,
                borderRadius: 18,
                fontFamily: 'var(--font-heading)',
                fontSize: 22,
                fontWeight: 700,
                background: age === a
                  ? 'linear-gradient(135deg, #FFD93D, #FF9F43)'
                  : 'rgba(108,99,255,0.08)',
                color: age === a ? '#1A1040' : 'var(--text-secondary)',
                border: age === a ? '2.5px solid #FFB800' : '2.5px solid transparent',
                boxShadow: age === a ? '0 4px 16px rgba(255,180,0,0.35)' : 'none',
                transition: 'background 0.2s, border 0.2s',
              }}
            >
              {a}
            </motion.button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
        <Button
          variant={canSubmit ? 'coral' : 'ghost'}
          size="lg"
          disabled={!canSubmit}
          onClick={() => canSubmit && onSave({ name: name.trim(), age, avatar })}
          style={{ width: '100%' }}
        >
          {avatar ? `${avatar} Let's go! 🎉` : "Let's go! 🎉"}
        </Button>
        {showCancel && (
          <Button variant="ghost" size="md" onClick={onCancel} style={{ width: '100%' }}>
            ← Back
          </Button>
        )}
      </div>
    </div>
  )
}

export default function ProfileScreen() {
  const { state, dispatch } = useApp()
  const profiles = state.profiles ?? (state.profile ? [state.profile] : [])
  const [mode, setMode] = useState(profiles.length === 0 ? 'create' : 'select')

  const selectProfile = (profile) => {
    dispatch({ type: 'SET_PROFILE', payload: profile })
    dispatch({ type: 'NAVIGATE', payload: 'home' })
  }

  const createProfile = (profileData) => {
    dispatch({ type: 'ADD_PROFILE', payload: profileData })
    dispatch({ type: 'SET_PROFILE', payload: profileData })
    dispatch({ type: 'NAVIGATE', payload: 'home' })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #1A0050 0%, #4A00E0 50%, #8E2DE2 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Header */}
      <div style={{ paddingTop: 40, paddingBottom: 20, textAlign: 'center' }}>
        <LumiCharacter mood="encouraging" size={100} />
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(24px, 5vw, 36px)', color: 'white', marginTop: 10 }}>
          {mode === 'create' ? 'Create your profile' : 'Who is playing?'}
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>
          {mode === 'create' ? 'Set up your learner profile' : 'Choose a profile or create a new one'}
        </p>
      </div>

      {/* White card */}
      <motion.div
        key={mode}
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          background: 'white',
          borderRadius: '38px 38px 0 0',
          padding: 'clamp(24px, 5vw, 40px)',
          paddingBottom: 48,
          flex: 1,
          width: '100%',
          maxWidth: 560,
          alignSelf: 'flex-end',
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          overflowY: 'auto',
        }}
      >
        <AnimatePresence mode="wait">
          {mode === 'select' ? (
            <motion.div key="select" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {/* Existing profiles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
                {profiles.map((p, i) => (
                  <motion.button
                    key={i}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectProfile(p)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 16,
                      padding: '16px 20px',
                      borderRadius: 20,
                      background: 'linear-gradient(135deg, rgba(108,99,255,0.08), rgba(167,139,250,0.12))',
                      border: '2px solid rgba(108,99,255,0.2)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: 40 }}>{p.avatar}</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 20, color: 'var(--text-primary)', fontWeight: 700 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                        Age {p.age}
                      </div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 22 }}>→</span>
                  </motion.button>
                ))}
              </div>

              {/* Add new profile button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setMode('create')}
                style={{
                  width: '100%',
                  padding: '16px 20px',
                  borderRadius: 20,
                  background: 'rgba(108,99,255,0.06)',
                  border: '2px dashed rgba(108,99,255,0.35)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-heading)',
                  fontSize: 17,
                  color: '#6C63FF',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                + Add new profile
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="create" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <CreateProfileForm
                onSave={createProfile}
                onCancel={() => setMode('select')}
                showCancel={profiles.length > 0}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
