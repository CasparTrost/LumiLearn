import { motion } from 'framer-motion'
import { ArrowLeft } from 'lucide-react'
import { useApp, MAX_LEVELS } from '../AppContext.jsx'
import InfoButton from '../components/InfoButton.jsx'
import ChoiceGame    from '../games/ChoiceGame.jsx'
import TyperGame     from '../games/TyperGame.jsx'
import MemoryGame    from '../games/MemoryGame.jsx'
import PainterGame   from '../games/PainterGame.jsx'
import ListenGame    from '../games/ListenGame.jsx'
import EmotionGame   from '../games/EmotionGame.jsx'
import MazeGame      from '../games/MazeGame.jsx'
import ShadowGame    from '../games/ShadowGame.jsx'
import BubblePopGame from '../games/BubblePopGame.jsx'
import StoryGame     from '../games/StoryGame.jsx'
import SortGame        from '../games/SortGame.jsx'
import ClockGame       from '../games/ClockGame.jsx'
import WordBuilderGame from '../games/WordBuilderGame.jsx'
import WeightGame        from '../games/WeightGame.jsx'
import NumberIntroGame   from '../games/NumberIntroGame.jsx'
import LetterIntroGame   from '../games/LetterIntroGame.jsx'
import NumbersGame       from '../games/NumbersGame.jsx'
import ColoringGame      from '../games/ColoringGame.jsx'

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
}

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
}

export default function GameScreen() {
  const { state, dispatch } = useApp()
  const { moduleId, level } = state.currentGame ?? { moduleId: 'numbers', level: 1 }

  const meta          = MODULE_META[moduleId] ?? MODULE_META.numbers
  const GameComponent = GAME_MAP[moduleId]    ?? ChoiceGame

  const handleComplete = ({ score, total }) => {
    const pct   = total > 0 ? score / total : 0
    const stars = pct >= 0.85 ? 3 : pct >= 0.6 ? 2 : pct >= 0.35 ? 1 : 0
    dispatch({ type: 'FINISH_GAME', payload: { moduleId, level, stars, score, total } })
  }

  const quit = () => dispatch({ type: 'NAVIGATE', payload: 'home' })

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
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
        <span style={{
          display:'flex', alignItems:'center', gap:4,
          background:'rgba(255,217,61,0.2)', borderRadius:10, padding:'4px 10px',
          border:'1px solid rgba(255,217,61,0.4)',
        }}>
          <span style={{ fontSize:16 }}>🪙</span>
          <span style={{ fontFamily:'var(--font-heading)', color:'#FFD93D', fontWeight:700, fontSize:15 }}>{state.coins ?? 0}</span>
        </span>
        <span style={{ fontFamily:'var(--font-heading)', fontSize:16, color:'rgba(255,255,255,0.75)' }}>
          Level {level} / {MAX_LEVELS[moduleId] ?? 5}
        </span>
        <InfoButton moduleId={moduleId} />
      </div>

      {/* Game */}
      <GameComponent moduleId={moduleId} level={level} onComplete={handleComplete} />
    </div>
  )
}
