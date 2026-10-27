import { Suspense, useEffect, useRef, useState } from 'react'
import { useApp, MAX_LEVELS } from '../AppContext.jsx'
import { HudBar, PxIcon, PixelLumi } from '../components/PixelUI.jsx'
import InfoButton from '../components/InfoButton.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import MusicButton from '../components/MusicControls.jsx'
import TileArt from '../components/TileArt.jsx'
import { stopNarration, lockPreviews } from '../narrator.js'
import FitBox from '../components/FitBox.jsx'
import { lazyWithReload } from '../lib/lazyWithReload.js'
import { PauseContext } from '../lib/pause.js'
import { result } from '../lib/score.js'
import { MODULE_BY_ID } from '../modules.js'

const LOADERS = {
  numbers:         () => import('../games/NumbersGame.jsx'),
  letters:         () => import('../games/TyperGame.jsx'),
  listen:          () => import('../games/ListenGame.jsx'),
  words:           () => import('../games/MemoryGame.jsx'),
  patterns:        () => import('../games/ChoiceGame.jsx'),
  shapes:          () => import('../games/PainterGame.jsx'),
  emotions:        () => import('../games/EmotionGame.jsx'),
  maze:            () => import('../games/MazeGame.jsx'),
  shadows:         () => import('../games/ShadowGame.jsx'),
  bubbles:         () => import('../games/BubblePopGame.jsx'),
  stories:         () => import('../games/StoryGame.jsx'),
  sort:            () => import('../games/SortGame.jsx'),
  clock:           () => import('../games/ClockGame.jsx'),
  words2:          () => import('../games/WordBuilderGame.jsx'),
  weight:          () => import('../games/WeightGame.jsx'),
  'number-intro':  () => import('../games/NumberIntroGame.jsx'),
  'letter-intro':  () => import('../games/LetterIntroGame.jsx'),
  coloring:        () => import('../games/ColoringGame.jsx'),
  'shape-build':   () => import('../games/ShapeBuildGame.jsx'),
  'empathy':       () => import('../games/EmpathyGame.jsx'),
  'initial-sound': () => import('../games/InitialSoundGame.jsx'),
  'rhyme':         () => import('../games/RhymeGame.jsx'),
  'shapes-land':   () => import('../games/ShapeLandGame.jsx'),
  'rocket-math':   () => import('../games/RocketMathGame.jsx'),
}

// Games whose code is in the browser already: they start without a
// connection, too.
const loaded = new Set()
const load = id => (LOADERS[id] ?? LOADERS.patterns)().then(m => { loaded.add(id); return m })
export const isGameLoaded = id => loaded.has(id)

// A lazy component remembers a failed load for good, so "Nochmal" after a
// lost connection needs a fresh one: one per game and attempt.
const lazyCache = {}
function gameComponent(id, attempt) {
  const key = `${id}:${attempt}`
  return lazyCache[key] ??= lazyWithReload(() => load(id))
}

/** Fetch a game's code ahead (tile hover, recommendations), quietly. */
export function prefetchGame(id) {
  if (loaded.has(id) || (typeof navigator !== 'undefined' && navigator.onLine === false)) return
  load(id).catch(() => {})
}

function GameLoadingFallback() {
  return (
    <div style={{
      flex:1, display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:16, background:'var(--bg)',
    }}>
      <PixelLumi size={96} />
      <div style={{ fontFamily:'var(--font-heading)', fontSize:20, fontWeight:700, color:'var(--px-ink)' }}>
        Spiel wird geladen …
      </div>
    </div>
  )
}

// Diese Spiele rechnen mit echten Zeigerkoordinaten oder zeichnen auf eine
// Leinwand — ein Maßstab würde dort Treffer verschieben oder Pixel verwaschen.
// Sie bemessen sich stattdessen selbst an ihrem Container.
const NO_SCALE = new Set(['bubbles', 'clock', 'coloring', 'numbers', 'shapes', 'shadows', 'maze'])

const SAY_QUIT = 'Möchtest du wirklich aufhören? Tippe auf den grünen Knopf, dann spielst du weiter.'

export default function GameScreen() {
  const { state, dispatch } = useApp()
  const { moduleId, level } = state.currentGame ?? { moduleId: 'numbers', level: 1 }
  const mod = MODULE_BY_ID[moduleId] ?? MODULE_BY_ID.numbers
  const maxLevel = MAX_LEVELS[moduleId] ?? 5

  // Ein Satz aus dem vorigen Spiel lief bisher weiter, während das nächste
  // schon seine Ansage startete — zwei Stimmen übereinander. Beim Wechsel und
  // beim Verlassen wird alles Gesprochene gestoppt.
  // Beim Betreten und beim Wechsel gilt dasselbe wie bei einer neuen Aufgabe:
  // erst die Ansage, dann darf das Darüberfahren vorlesen.
  useEffect(() => { lockPreviews(); return stopNarration }, [moduleId, level])

  // Time in the game, for the parent area and the daily time limit
  const startedAt = useRef(Date.now())
  useEffect(() => {
    startedAt.current = Date.now()
    return () => dispatch({ type: 'ADD_PLAYTIME', payload: { ms: Date.now() - startedAt.current } })
  }, [moduleId, level, dispatch])

  // While the help or the "really stop?" question is open the game is
  // paused (timers, spawning, the dragon …): games read it with usePaused()
  // from lib/pause.js.
  const [helpOpen, setHelpOpen] = useState(false)
  const [askQuit, setAskQuit] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => { setHelpOpen(false); setAskQuit(false) }, [moduleId, level])

  // The system back button asks too (App.jsx)
  useEffect(() => {
    const onBack = () => setAskQuit(true)
    window.addEventListener('lumi:back', onBack)
    return () => window.removeEventListener('lumi:back', onBack)
  }, [])

  const GameComponent = gameComponent(moduleId, attempt)

  const handleComplete = ({ score, total, stars: providedStars }) => {
    // Games that rate by something other than first-try answers (Memo by
    // moves) pass their own stars, the number they show the child; all
    // others are rated the same way (lib/score.js), score kept in 0..total.
    const r = result(score, total)
    dispatch({ type: 'FINISH_GAME', payload: { moduleId, level, stars: providedStars ?? r.stars, score: r.score, total } })
  }

  const quit = () => { stopNarration(); dispatch({ type: 'NAVIGATE', payload: 'home' }) }

  return (
    <div style={{
      height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      // Parchment with a faint pixel grid, the table the game is played on
      background: 'var(--bg)',
      backgroundImage: 'linear-gradient(rgba(138,79,34,0.05) 2px, transparent 2px), linear-gradient(90deg, rgba(138,79,34,0.05) 2px, transparent 2px)',
      backgroundSize: '32px 32px',
    }}>
      {/* HUD. On a phone the game's picture stands for its name: the title
          was cut off in 22 of 24 games ("Zahlen entdec…") */}
      <HudBar>
        <button
          className="px-btn px-btn--wood px-btn--icon"
          onClick={() => setAskQuit(true)}
          aria-label="Spiel verlassen"
          style={{ flexShrink: 0 }}
        >
          <PxIcon name="back" size={20} color="#fff" />
        </button>
        <TileArt mod={mod} size={44} />
        <span className="px-title hud-hide-sm" style={{ fontSize: 'clamp(16px,3vw,28px)', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {mod.title}
        </span>
        <span className="hud-only-sm" style={{ flex: 1 }} />
        <span className="px-chip" style={{ fontFamily: 'var(--font-heading)', fontSize: 17, flexShrink: 0 }}
          aria-label={`Level ${level} von ${maxLevel}`}>
          <span className="hud-hide-sm">Level&nbsp;</span>{level}/{maxLevel}
        </span>
        <MusicButton />
        <InfoButton moduleId={moduleId} onOpenChange={setHelpOpen} />
      </HudBar>

      {/* Game */}
      <ErrorBoundary key={`${moduleId}-${attempt}`} moduleId={moduleId}
        onRetry={() => setAttempt(a => a + 1)}
        onHome={() => dispatch({ type: 'NAVIGATE', payload: 'home' })}>
        <PauseContext.Provider value={helpOpen || askQuit}>
        <Suspense fallback={<GameLoadingFallback />}>
          {NO_SCALE.has(moduleId)
            ? <GameComponent moduleId={moduleId} level={level} onComplete={handleComplete} />
            // key: jedes Spiel misst seine nötige Höhe neu, statt die des
            // vorigen zu erben
            : <FitBox key={`${moduleId}-${level}`}>
                <GameComponent moduleId={moduleId} level={level} onComplete={handleComplete} />
              </FitBox>}
        </Suspense>
        </PauseContext.Provider>
      </ErrorBoundary>

      {/* The back arrow sits where small hands hold a tablet: it asks first
          instead of ending the round at once */}
      {askQuit && (
        <ConfirmDialog kid
          title="Wirklich aufhören?"
          say={SAY_QUIT}
          noLabel="Weiterspielen"
          yesLabel="Aufhören"
          onNo={() => { stopNarration(); setAskQuit(false) }}
          onYes={quit}
        />
      )}
    </div>
  )
}
