import { useState } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import LumiCharacter from '../components/LumiCharacter.jsx'
import Button from '../components/Button.jsx'

const LANGUAGES = [
  { id: 'de', flag: '🇩🇪', name: 'Deutsch', sub: 'Auf Deutsch lernen', gradient: 'linear-gradient(135deg, #FF6B6B, #EE0979)', shadow: 'rgba(238,9,121,0.35)' },
  { id: 'en', flag: '🇬🇧', name: 'English', sub: 'Learn in English',   gradient: 'linear-gradient(135deg, #4ECDC4, #0099F7)', shadow: 'rgba(0,153,247,0.35)' },
]

export default function LanguageScreen() {
  const { dispatch } = useApp()
  const t = useT()
  const [selected, setSelected] = useState(null)

  const confirm = () => {
    if (!selected) return
    dispatch({ type: 'SET_LANGUAGE', payload: selected })
    dispatch({ type: 'NAVIGATE', payload: 'profile' })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(160deg, #1A0050 0%, #4A00E0 40%, #8E2DE2 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px',
    }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 24 }}>
        <LumiCharacter mood="happy" size={110} />
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(26px, 6vw, 38px)', color: 'white', marginTop: 12 }}>
          Choose your language
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 6 }}>
          Wähle deine Sprache
        </p>
      </motion.div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 36 }}>
        {LANGUAGES.map((lang, i) => {
          const isSelected = selected === lang.id
          return (
            <motion.button
              key={lang.id}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.15 }}
              whileHover={{ scale: 1.04, y: -4 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setSelected(lang.id)}
              style={{
                width: 'clamp(140px, 38vw, 200px)', padding: '28px 20px', borderRadius: 28,
                background: isSelected ? lang.gradient : 'rgba(255,255,255,0.1)',
                border: isSelected ? '3px solid white' : '3px solid transparent',
                boxShadow: isSelected ? `0 12px 40px ${lang.shadow}` : '0 4px 16px rgba(0,0,0,0.2)',
                cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                backdropFilter: 'blur(12px)', transition: 'background 0.3s, border 0.3s, box-shadow 0.3s',
              }}
            >
              <span style={{ fontSize: 52 }}>{lang.flag}</span>
              <span style={{ fontFamily: 'var(--font-heading)', fontSize: 24, color: 'white', fontWeight: 600 }}>{lang.name}</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{lang.sub}</span>
              {isSelected && (
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                  style={{ background: 'white', color: '#4A00E0', fontSize: 12, fontWeight: 700, borderRadius: 99, padding: '3px 12px', fontFamily: 'var(--font-heading)' }}>
                  ✓ Selected
                </motion.div>
              )}
            </motion.button>
          )
        })}
      </div>

      <Button size="lg" variant="gold" disabled={!selected} onClick={confirm}>
        Continue →
      </Button>
    </div>
  )
}
