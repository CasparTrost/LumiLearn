import React, { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AppProvider, useApp } from './AppContext.jsx'
import MusicControls from './components/MusicControls.jsx'
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

function Router() {
  const { state, dispatch } = useApp()

  // Android back button — navigate to home instead of leaving app
  useEffect(() => {
    // Push a state entry so back button has something to pop
    window.history.pushState({ screen: state.screen }, '')
    const onPop = (e) => {
      // Re-push so back always works
      window.history.pushState({ screen: 'home' }, '')
      if (state.screen === 'game' || state.screen === 'results') {
        dispatch({ type: 'NAVIGATE', payload: 'home' })
      }
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [state.screen])

  const screens = {
    welcome:  <WelcomeScreen />,
    language: <LanguageScreen />,
    profile:  <ProfileScreen />,
    home:     <HomeScreen />,
    game:     <GameScreen />,
    results:  <ResultsScreen />,
  }

  return (
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
  )
}

export default function App() {
  return (
    <AppProvider>
      <Router />
      <MusicControls />
    </AppProvider>
  )
}
