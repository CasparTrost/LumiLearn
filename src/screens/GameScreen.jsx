import { Suspense, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useApp, MAX_LEVELS } from '../AppContext.jsx'
import InfoButton from '../components/InfoButton.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { stopNarration, lockPreviews } from '../narrator.js'
import FitBox from '../components/FitBox.jsx'
import { lazyWithReload } from '../lib/lazyWithReload.js'

const ChoiceGame    = lazyWithReload(() => import('../games/ChoiceGame.jsx'))
const TyperGame     = lazyWithReload(() => import('../games/TyperGame.jsx'))
const MemoryGame    = lazyWithReload(() => import('../games/MemoryGame.jsx'))
const PainterGame   = lazyWithReload(() => import('../games/PainterGame.jsx'))
const ListenGame    = lazyWithReload(() => import('../games/ListenGame.jsx'))
const EmotionGame   = lazyWithReload(() => import('../games/EmotionGame.jsx'))
const MazeGame      = lazyWithReload(() => import('../games/MazeGame.jsx'))
const ShadowGame    = lazyWithReload(() => import('../games/ShadowGame.jsx'))
const BubblePopGame = lazyWithReload(() => import('../games/BubblePopGame.jsx'))
const StoryGame     = lazyWithReload(() => import('../games/StoryGame.jsx'))
const SortGame        = lazyWithReload(() => import('../games/SortGame.jsx'))
const ClockGame       = lazyWithReload(() => import('../games/ClockGame.jsx'))
const WordBuilderGame = lazyWithReload(() => import('../games/WordBuilderGame.jsx'))
const WeightGame        = lazyWithReload(() => import('../games/WeightGame.jsx'))
const NumberIntroGame   = lazyWithReload(() => import('../games/NumberIntroGame.jsx'))
const LetterIntroGame   = lazyWithReload(() => import('../games/LetterIntroGame.jsx'))
const NumbersGame       = lazyWithReload(() => import('../games/NumbersGame.jsx'))
const ColoringGame      = lazyWithReload(() => import('../games/ColoringGame.jsx'))
const ShapeBuildGame = lazyWithReload(() => import('../games/ShapeBuildGame.jsx'))
const EmpathyGame = lazyWithReload(() => import('../games/EmpathyGame.jsx'))
const InitialSoundGame = lazyWithReload(() => import('../games/InitialSoundGame.jsx'))
const RhymeGame = lazyWithReload(() => import('../games/RhymeGame.jsx'))
const ShapeLandGame = lazyWithReload(() => import('../games/ShapeLandGame.jsx'))
const RocketMathGame = lazyWithReload(() => import('../games/RocketMathGame.jsx'))

function GameLoadingFallback({ gradient }) {
  return (
    <div style={{
      flex:1, display:'flex', alignItems:'center', justifyContent:'center',
      flexDirection:'column', gap:16,
      background: gradient ?? 'var(--bg)',
    }}>
      <div style={{
        width:52, height:52, borderRadius:'50%',
        border:'4px solid rgba(255,255,255,0.3)',
        borderTopColor:'white',
        animation:'spin 0.8s linear infinite',
      }} />
      <div style={{
        fontFamily:'var(--font-heading)', fontSize:18, color:'white',
        textShadow:'0 1px 8px rgba(0,0,0,0.3)',
      }}>Spiel wird geladen…</div>
    </div>
  )
}

const MODULE_META = {
  numbers:  { label: 'Zahlenland 🔢',         gradient: 'linear-gradient(135deg, #6BCB77, #44D498)' },
  letters:  { label: 'Buchstabenwald ⌨️',      gradient: 'linear-gradient(135deg, #6C63FF, #A78BFA)' },
  listen:   { label: 'Hörabenteuer 🔊',        gradient: 'linear-gradient(135deg, #FF6B6B, #FF8E53)' },
  words:    { label: 'Memo-Welt 🃏',           gradient: 'linear-gradient(135deg, #FD79A8, #E84393)' },
  patterns: { label: 'Musterpark 🔮',          gradient: 'linear-gradient(135deg, #FF9F43, #EE5A24)' },
  shapes:   { label: 'Farbenreich 🎨',         gradient: 'linear-gradient(135deg, #74B9FF, #0984E3)' },
  emotions: { label: 'Gefühlswelt 😊',         gradient: 'linear-gradient(135deg, #A29BFE, #6C63FF)' },
  maze:     { label: 'Lumi-Labyrinth 🌀',      gradient: 'linear-gradient(135deg, #4A00E0, #6C3FAC)' },
  shadows:  { label: 'Schattenrätsel 🌑',      gradient: 'linear-gradient(135deg, #1a0533, #4A00E0)' },
  bubbles:  { label: 'Blasen-Blitz 🫧',        gradient: 'linear-gradient(135deg, #FF6B6B, #FFD93D)' },
  stories:  { label: 'Lumis Abenteuer 📖',     gradient: 'linear-gradient(135deg, #44D498, #6C63FF)' },
  sort:     { label: 'Sortier-Spaß 🧺',          gradient: 'linear-gradient(135deg, #FF9F43, #6BCB77)' },
  clock:    { label: 'Uhren-Uhr 🕐',               gradient: 'linear-gradient(135deg, #FF9F43, #FF6B6B)' },
  words2:   { label: 'Silben-Spaß 🔤',             gradient: 'linear-gradient(135deg, #6BCB77, #0984E3)' },
  weight:        { label: 'Waage-Welt ⚖️',          gradient: 'linear-gradient(135deg, #A29BFE, #FF9F43)' },
  'number-intro': { label: 'Zahlen entdecken 🧮',    gradient: 'linear-gradient(135deg, #FFD93D, #FF9F43)' },
  'letter-intro': { label: 'ABC-Abenteuer 🔡',       gradient: 'linear-gradient(135deg, #74B9FF, #6C63FF)' },
  coloring:       { label: 'Mal-Atelier 🖍️',           gradient: 'linear-gradient(135deg, #FD79A8, #E84393)' },
  'shape-build': { label: 'Formen-Werkstatt 🧩', gradient: 'linear-gradient(135deg,#FF9F43,#A29BFE)' },
  'empathy': { label: 'Gefühlsdetektiv 🕵️‍♀️', gradient: 'linear-gradient(135deg,#E84393,#A29BFE)' },
  'initial-sound': { label: 'Anlaut-Detektiv 🕵️', gradient: 'linear-gradient(135deg,#74B9FF,#44D498)' },
  'rhyme': { label: 'Reim-Rallye 🎵', gradient: 'linear-gradient(135deg,#FD79A8,#FF9F43)' },
  'shapes-land': { label: 'Formen-Land 🔷', gradient: 'linear-gradient(135deg,#00B894,#74B9FF)' },
  'rocket-math': { label: 'Rechen-Rakete 🚀', gradient: 'linear-gradient(135deg,#6C63FF,#00B894)' },
}

// Diese Spiele rechnen mit echten Zeigerkoordinaten oder zeichnen auf eine
// Leinwand — ein Maßstab würde dort Treffer verschieben oder Pixel verwaschen.
// Sie bemessen sich stattdessen selbst an ihrem Container.
const NO_SCALE = new Set(['bubbles', 'clock', 'coloring', 'numbers', 'shapes', 'shadows', 'maze'])

const GAME_MAP = {
  numbers:  NumbersGame,
  letters:  TyperGame,
  listen:   ListenGame,
  words:    MemoryGame,
  patterns: ChoiceGame,
  shapes:   PainterGame,
  emotions: EmotionGame,
  maze:     MazeGame,
  shadows:  ShadowGame,
  bubbles:  BubblePopGame,
  stories:  StoryGame,
  sort:     SortGame,
  clock:    ClockGame,
  words2:   WordBuilderGame,
  weight:        WeightGame,
  'number-intro': NumberIntroGame,
  'letter-intro': LetterIntroGame,
  coloring:       ColoringGame,
  'shape-build': ShapeBuildGame,
  'empathy': EmpathyGame,
  'initial-sound': InitialSoundGame,
  'rhyme': RhymeGame,
  'shapes-land': ShapeLandGame,
  'rocket-math': RocketMathGame,
}

export default function GameScreen() {
  const { state, dispatch } = useApp()
  const { moduleId, level } = state.currentGame ?? { moduleId: 'numbers', level: 1 }

  const meta          = MODULE_META[moduleId] ?? MODULE_META.numbers
  const GameComponent = GAME_MAP[moduleId]    ?? ChoiceGame

  // Ein Satz aus dem vorigen Spiel lief bisher weiter, während das nächste
  // schon seine Ansage startete — zwei Stimmen übereinander. Beim Wechsel und
  // beim Verlassen wird alles Gesprochene gestoppt.
  // Beim Betreten und beim Wechsel gilt dasselbe wie bei einer neuen Aufgabe:
  // erst die Ansage, dann darf das Darüberfahren vorlesen.
  useEffect(() => { lockPreviews(); return stopNarration }, [moduleId, level])

  const handleComplete = ({ score, total, stars: providedStars }) => {
    // Some games (e.g. MemoryGame) compute their own star rating from a
    // metric other than score/total (move efficiency) and show it to the
    // child directly — respect that instead of silently recomputing a
    // different number from score/total, which used to award 3 stars
    // regardless of what was actually displayed.
    const pct   = total > 0 ? score / total : 0
    const stars = providedStars ?? (pct >= 0.85 ? 3 : pct >= 0.6 ? 2 : pct >= 0.35 ? 1 : 0)
    dispatch({ type: 'FINISH_GAME', payload: { moduleId, level, stars, score, total } })
  }

  const quit = () => { stopNarration(); dispatch({ type: 'NAVIGATE', payload: 'home' }) }

  return (
    <div style={{ height: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: meta.gradient,
        padding: 'clamp(12px,2.5vw,20px) clamp(16px,3vw,28px)',
        display: 'flex', alignItems: 'center', gap: 16,
        borderRadius: '0 0 28px 28px',
        boxShadow: '0 6px 24px rgba(0,0,0,0.15)',
        flexShrink: 0,
      }}>
        <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.92}} onClick={quit}
          aria-label="Spiel verlassen"
          style={{
            width: 44, height: 44, borderRadius:'50%',
            background:'rgba(255,255,255,0.22)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}
        >
          <ArrowLeft size={20} color="white" />
        </motion.button>
        <span style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(18px,3.5vw,26px)', color:'white', fontWeight:600, flex:1 }}>
          {meta.label}
        </span>
        <span style={{ fontFamily:'var(--font-heading)', fontSize:16, color:'rgba(255,255,255,0.75)' }}>
          Level {level} / {MAX_LEVELS[moduleId] ?? 5}
        </span>
        <InfoButton moduleId={moduleId} />
      </div>

      {/* Game */}
      <ErrorBoundary moduleId={moduleId} onHome={() => dispatch({ type: 'NAVIGATE', payload: 'home' })}>
        <Suspense fallback={<GameLoadingFallback gradient={meta.gradient} />}>
          {NO_SCALE.has(moduleId)
            ? <GameComponent moduleId={moduleId} level={level} onComplete={handleComplete} />
            // key: jedes Spiel misst seine nötige Höhe neu, statt die des
            // vorigen zu erben
            : <FitBox key={`${moduleId}-${level}`}>
                <GameComponent moduleId={moduleId} level={level} onComplete={handleComplete} />
              </FitBox>}
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
