import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useT, LANGUAGES_OFFERED } from '../i18n.js'
import Button from '../components/Button.jsx'
import { PixelLumi, uiSpr } from '../components/PixelUI.jsx'
import { narrate } from '../narrator.js'

const HELLO = 'Hallo, ich bin Lumi! Tippe auf den gelben Knopf, dann geht es los.'

export default function WelcomeScreen() {
  const { dispatch } = useApp()
  const t = useT()

  // Most children who start the app can't read: Lumi says what to do.
  // Browsers may hold speech back until the first touch, so tapping Lumi
  // says it (again).
  useEffect(() => {
    const id = setTimeout(() => narrate([{ text: HELLO }]), 700)
    return () => clearTimeout(id)
  }, [])

  // With only one language offered (English is hidden, i18n.js) the
  // language step is skipped: one decision less, and one a parent makes.
  const start = () => {
    if (LANGUAGES_OFFERED.length > 1) { dispatch({ type: 'NAVIGATE', payload: 'language' }); return }
    dispatch({ type: 'SET_LANGUAGE', payload: LANGUAGES_OFFERED[0] })
    dispatch({ type: 'NAVIGATE', payload: 'profile' })
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      position: 'relative', overflow: 'hidden', padding: 24, isolation: 'isolate',
    }}>
      {/* Pixel landscape */}
      <div aria-hidden="true" className="px-art" style={{
        position: 'absolute', inset: 0, zIndex: -1,
        backgroundImage: `url(${uiSpr('landscape.png')})`,
        backgroundSize: 'cover', backgroundPosition: 'center 70%', imageRendering: 'pixelated',
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 1 }}
      >
        <div className="px-title" style={{
          fontSize: 'clamp(48px, 11vw, 88px)', lineHeight: 1, marginBottom: 10,
          color: 'var(--px-gold)',
          textShadow: '-3px -3px 0 var(--px-ink), 3px -3px 0 var(--px-ink), -3px 3px 0 var(--px-ink), 3px 3px 0 var(--px-ink), 0 8px 0 var(--px-ink)',
        }}>
          LumiLearn
        </div>
        <div className="px-ribbon" style={{ fontSize: 'clamp(15px, 3vw, 19px)', marginBottom: 26 }}>
          {t('welcome.tagline')}
        </div>

        <button onClick={() => narrate([{ text: HELLO }])} aria-label="Lumi sprechen lassen"
          style={{ padding: 0, background: 'none', border: 'none' }}>
          <PixelLumi size={176} happy />
        </button>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          style={{ marginTop: 26, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}
        >
          <div className="px-panel" style={{
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'clamp(15px, 3.5vw, 19px)',
            color: 'var(--px-ink)', textAlign: 'center', maxWidth: 360, padding: '10px 18px',
          }}>
            {t('welcome.subtitle')}
          </div>
          <Button size="lg" variant="gold" onClick={start}>
            {t('welcome.cta')}
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
