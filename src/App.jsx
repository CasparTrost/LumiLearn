import { useEffect, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './AppContext.jsx'
import MusicButton, { MusicProvider } from './components/MusicControls.jsx'
import WelcomeScreen from './screens/WelcomeScreen.jsx'
import LanguageScreen from './screens/LanguageScreen.jsx'
import ProfileScreen from './screens/ProfileScreen.jsx'
import HomeScreen from './screens/HomeScreen.jsx'
import GameScreen from './screens/GameScreen.jsx'
import ResultsScreen from './screens/ResultsScreen.jsx'

const slideVariants = {
  initial: { opacity: 0, y: 40, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -20, scale: 0.97, transition: { duration: 0.25, ease: 'easeIn' } },
}

// Screens that sit "above" the home screen. The system back button used to
// leave the whole app (the app never added a history entry); now it leads
// back to the home screen, and in a game it first asks (GameScreen listens
// for "lumi:back").
const DEEP = new Set(['game', 'results'])
// Screens with a HUD bar carry the music switch in it
const HAS_HUD = new Set(['home', 'game'])

function useBackButton() {
  const { state, dispatch } = useApp()
  const screenRef = useRef(state.screen)
  screenRef.current = state.screen
  const ignorePop = useRef(false)

  useEffect(() => {
    const deep = DEEP.has(state.screen)
    if (deep && !window.history.state?.lumi) window.history.pushState({ lumi: true }, '')
    else if (!deep && window.history.state?.lumi) { ignorePop.current = true; window.history.back() }
  }, [state.screen])

  useEffect(() => {
    const onPop = () => {
      if (ignorePop.current) { ignorePop.current = false; return }
      if (screenRef.current === 'game') {
        window.history.pushState({ lumi: true }, '')
        window.dispatchEvent(new Event('lumi:back'))
      } else if (DEEP.has(screenRef.current)) {
        dispatch({ type: 'NAVIGATE', payload: 'home' })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [dispatch])
}

function Router() {
  const { state } = useApp()
  useBackButton()

  // Keep <html lang="…"> in sync with the selected language
  useEffect(() => {
    if (state.language) {
      document.documentElement.lang = state.language
    }
  }, [state.language])

  const screens = {
    welcome:  <WelcomeScreen />,
    language: <LanguageScreen />,
    profile:  <ProfileScreen />,
    home:     <HomeScreen />,
    game:     <GameScreen />,
    results:  <ResultsScreen />,
  }

  return (
    <>
      <AnimatePresence mode="wait">
        <motion.div
          key={state.screen}
          variants={slideVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ minHeight: '100dvh', width: '100%' }}
        >
          {screens[state.screen] ?? <WelcomeScreen />}
        </motion.div>
      </AnimatePresence>
      {!HAS_HUD.has(state.screen) && (
        <MusicButton style={{ position: 'fixed', top: 12, right: 12, zIndex: 50 }} />
      )}
    </>
  )
}

export default function App() {
  return (
    <AppProvider>
      <MusicProvider>
        <Router />
      </MusicProvider>
    </AppProvider>
  )
}
