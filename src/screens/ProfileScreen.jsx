import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import Button from '../components/Button.jsx'

const AVATARS = ['🐻', '🐼', '🦁', '🐨', '🦊', '🐧', '🦋', '🐬', '🦄', '🐸', '🐙', '🐯']
const AGES = [3, 4, 5, 6, 7]

export default function ProfileScreen() {
  const { dispatch } = useApp()
  const [name, setName] = useState('')
  const [age, setAge] = useState(null)
  const [avatar, setAvatar] = useState(null)

  const canSubmit = name.trim().length >= 1 && age !== null && avatar !== null

  const create = () => {
    if (!canSubmit) return
    dispatch({ type: 'SET_PROFILE', payload: { name: name.trim(), age, avatar } })
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
          Wer bist du?
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>Erstelle dein Profil</p>
      </div>

      {/* White card */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
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
          gap: 28,
        }}
      >
        {/* Avatar */}
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 12 }}>
            🎭 Wähle deinen Avatar
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
            ✏️ Dein Name
          </div>
          <input
            type="text"
            placeholder="z.B. Emma, Luca, Mia..."
            value={name}
            maxLength={20}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && create()}
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
            }}
          />
        </div>

        {/* Age */}
        <div>
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 18, color: 'var(--text-secondary)', marginBottom: 10 }}>
            🎂 Wie alt bist du?
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

        {/* CTA */}
        <Button
          variant={canSubmit ? 'coral' : 'ghost'}
          size="lg"
          disabled={!canSubmit}
          onClick={create}
          style={{ marginTop: 8, width: '100%' }}
        >
          {avatar ? `${avatar} Los geht's! 🎉` : "Los geht's! 🎉"}
        </Button>
      </motion.div>
    </div>
  )
}
