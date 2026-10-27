import { motion } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useT, LANGUAGES_OFFERED } from '../i18n.js'
import { PixelLumi, uiSpr } from '../components/PixelUI.jsx'
import { hearable } from '../lib/hearable.js'

// Only shown when more than one language is offered (English is hidden for
// now, see i18n.js). One tap on a language chooses it and goes on — it used
// to take a second tap on "Weiter" for the same decision.
const LANGUAGES = [
  { id: 'de', flag: '🇩🇪', name: 'Deutsch', sub: 'Auf Deutsch lernen', say: 'Deutsch' },
  { id: 'en', flag: '🇬🇧', name: 'English', sub: 'Learn in English',   say: 'English' },
].filter(l => LANGUAGES_OFFERED.includes(l.id))

export default function LanguageScreen() {
  const { dispatch } = useApp()
  const t = useT()

  const choose = (id) => {
    dispatch({ type: 'SET_LANGUAGE', payload: id })
    dispatch({ type: 'NAVIGATE', payload: 'profile' })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: 'var(--px-ink)',
      backgroundImage: `linear-gradient(rgba(42,27,61,0.45), rgba(42,27,61,0.45)), url(${uiSpr('landscape.png')})`,
      backgroundSize: 'cover', backgroundPosition: 'center 70%', imageRendering: 'pixelated',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 16px',
    }}>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 24 }}>
        <PixelLumi size={110} style={{ margin: '0 auto' }} />
        <h1 className="px-title" style={{ fontSize: 'clamp(26px, 6vw, 38px)', marginTop: 12 }}>
          {t('language.title')}
        </h1>
        <p className="px-title" style={{ fontSize: 17, marginTop: 6 }}>
          {t('language.subtitle')}
        </p>
      </motion.div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
        {LANGUAGES.map((lang, i) => (
          <motion.button
            key={lang.id}
            className="px-panel"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            onClick={() => choose(lang.id)}
            {...hearable(lang.say)}
            style={{
              width: 'clamp(140px, 38vw, 200px)', padding: '22px 16px',
              cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
            }}
          >
            <span style={{ fontSize: 52 }}>{lang.flag}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 24, color: 'var(--px-ink)', fontWeight: 700 }}>{lang.name}</span>
            <span style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 600 }}>{lang.sub}</span>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
