import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

/**
 * Sortier-Spaß — Kategorisieren & Konzeptbildung
 * Scientific basis:
 *   • Concept Formation (Bruner, 1956) — categorisation is a core cognitive skill underlying
 *     all higher-order thinking and early science/math literacy.
 *   • Embodied Cognition (Wilson, 2002) — physical drag-and-drop gestures strengthen the
 *     mental model of category membership.
 *   • Executive Function — sorting requires inhibitory control and cognitive flexibility
 *     (Diamond, 2013).
 */

// Each outer array = one difficulty tier. Game picks a random set within the tier.
const LEVEL_SETS = [
  // ── Tier 1 ─────────────────────────────────────────────────────────────────
  [
    {
      categoryA: { label: 'Tiere', emoji: '🐾', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      categoryB: { label: 'Essen', emoji: '🍽️', color: '#FF9F43', bg: '#FFF3E0', border: '#FF9F43' },
      items: [
        { id:1, emoji:'🐕', cat:'A' }, { id:2, emoji:'🍕', cat:'B' },
        { id:3, emoji:'🐱', cat:'A' }, { id:4, emoji:'🍎', cat:'B' },
        { id:5, emoji:'🦁', cat:'A' }, { id:6, emoji:'🌮', cat:'B' },
        { id:7, emoji:'🐸', cat:'A' }, { id:8, emoji:'🍩', cat:'B' },
        { id:9, emoji:'🦊', cat:'A' }, { id:10, emoji:'🍗', cat:'B' },
        { id:11, emoji:'🐬', cat:'A' }, { id:12, emoji:'🍓', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Tiere', emoji: '🐾', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      categoryB: { label: 'Essen', emoji: '🍽️', color: '#FF9F43', bg: '#FFF3E0', border: '#FF9F43' },
      items: [
        { id:1, emoji:'🐘', cat:'A' }, { id:2, emoji:'🍔', cat:'B' },
        { id:3, emoji:'🐧', cat:'A' }, { id:4, emoji:'🍌', cat:'B' },
        { id:5, emoji:'🐯', cat:'A' }, { id:6, emoji:'🎂', cat:'B' },
        { id:7, emoji:'🦋', cat:'A' }, { id:8, emoji:'🍦', cat:'B' },
        { id:9, emoji:'🐢', cat:'A' }, { id:10, emoji:'🥕', cat:'B' },
        { id:11, emoji:'🐙', cat:'A' }, { id:12, emoji:'🍉', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Tiere', emoji: '🐾', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      categoryB: { label: 'Spielzeug', emoji: '🧸', color: '#FD79A8', bg: '#FFF0F8', border: '#FD79A8' },
      items: [
        { id:1, emoji:'🐶', cat:'A' }, { id:2, emoji:'🧸', cat:'B' },
        { id:3, emoji:'🐰', cat:'A' }, { id:4, emoji:'🪀', cat:'B' },
        { id:5, emoji:'🦔', cat:'A' }, { id:6, emoji:'🎮', cat:'B' },
        { id:7, emoji:'🐦', cat:'A' }, { id:8, emoji:'🪁', cat:'B' },
        { id:9, emoji:'🐝', cat:'A' }, { id:10, emoji:'🎲', cat:'B' },
        { id:11, emoji:'🦆', cat:'A' }, { id:12, emoji:'🎪', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Obst', emoji: '🍎', color: '#FF6B6B', bg: '#FFE8E8', border: '#FF6B6B' },
      categoryB: { label: 'Gemüse', emoji: '🥦', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      items: [
        { id:1, emoji:'🍎', cat:'A' }, { id:2, emoji:'🥦', cat:'B' },
        { id:3, emoji:'🍌', cat:'A' }, { id:4, emoji:'🥕', cat:'B' },
        { id:5, emoji:'🍓', cat:'A' }, { id:6, emoji:'🌽', cat:'B' },
        { id:7, emoji:'🍇', cat:'A' }, { id:8, emoji:'🥒', cat:'B' },
        { id:9, emoji:'🍊', cat:'A' }, { id:10, emoji:'🍅', cat:'B' },
        { id:11, emoji:'🍒', cat:'A' }, { id:12, emoji:'🫑', cat:'B' },
      ],
    },
  ],
  // ── Tier 2 ─────────────────────────────────────────────────────────────────
  [
    {
      categoryA: { label: 'Fahrzeuge', emoji: '🚗', color: '#6C63FF', bg: '#F0EEFF', border: '#6C63FF' },
      categoryB: { label: 'Natur',     emoji: '🌿', color: '#44D498', bg: '#E6FBF3', border: '#44D498' },
      items: [
        { id:1, emoji:'🚕', cat:'A' }, { id:2, emoji:'🌲', cat:'B' },
        { id:3, emoji:'✈️', cat:'A' }, { id:4, emoji:'🌸', cat:'B' },
        { id:5, emoji:'🚂', cat:'A' }, { id:6, emoji:'🍄', cat:'B' },
        { id:7, emoji:'🚀', cat:'A' }, { id:8, emoji:'⛰️', cat:'B' },
        { id:9, emoji:'🚢', cat:'A' }, { id:10, emoji:'🌊', cat:'B' },
        { id:11, emoji:'🚁', cat:'A' }, { id:12, emoji:'🌻', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Fahrzeuge', emoji: '🚗', color: '#6C63FF', bg: '#F0EEFF', border: '#6C63FF' },
      categoryB: { label: 'Natur',     emoji: '🌿', color: '#44D498', bg: '#E6FBF3', border: '#44D498' },
      items: [
        { id:1, emoji:'🚲', cat:'A' }, { id:2, emoji:'🌴', cat:'B' },
        { id:3, emoji:'🚌', cat:'A' }, { id:4, emoji:'🌺', cat:'B' },
        { id:5, emoji:'🏎️', cat:'A' }, { id:6, emoji:'🌾', cat:'B' },
        { id:7, emoji:'⛵', cat:'A' }, { id:8, emoji:'🌵', cat:'B' },
        { id:9, emoji:'🛸', cat:'A' }, { id:10, emoji:'🍂', cat:'B' },
        { id:11, emoji:'🚒', cat:'A' }, { id:12, emoji:'🌿', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Im Wasser', emoji: '🌊', color: '#74B9FF', bg: '#EBF6FF', border: '#74B9FF' },
      categoryB: { label: 'In der Luft', emoji: '☁️', color: '#A29BFE', bg: '#F0EEFF', border: '#A29BFE' },
      items: [
        { id:1, emoji:'🐟', cat:'A' }, { id:2, emoji:'🦅', cat:'B' },
        { id:3, emoji:'🐙', cat:'A' }, { id:4, emoji:'✈️', cat:'B' },
        { id:5, emoji:'🦈', cat:'A' }, { id:6, emoji:'🦋', cat:'B' },
        { id:7, emoji:'🐬', cat:'A' }, { id:8, emoji:'🚀', cat:'B' },
        { id:9, emoji:'🦀', cat:'A' }, { id:10, emoji:'🪂', cat:'B' },
        { id:11, emoji:'🐊', cat:'A' }, { id:12, emoji:'🦜', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Musikinstrumente', emoji: '🎵', color: '#E84393', bg: '#FFF0F8', border: '#E84393' },
      categoryB: { label: 'Sportgeräte', emoji: '⚽', color: '#FF9F43', bg: '#FFF3E0', border: '#FF9F43' },
      items: [
        { id:1, emoji:'🎸', cat:'A' }, { id:2, emoji:'⚽', cat:'B' },
        { id:3, emoji:'🎹', cat:'A' }, { id:4, emoji:'🏀', cat:'B' },
        { id:5, emoji:'🥁', cat:'A' }, { id:6, emoji:'🎾', cat:'B' },
        { id:7, emoji:'🎺', cat:'A' }, { id:8, emoji:'🏈', cat:'B' },
        { id:9, emoji:'🎻', cat:'A' }, { id:10, emoji:'🏓', cat:'B' },
        { id:11, emoji:'🪗', cat:'A' }, { id:12, emoji:'🏸', cat:'B' },
      ],
    },
  ],
  // ── Tier 3 ─────────────────────────────────────────────────────────────────
  [
    {
      categoryA: { label: 'Groß', emoji: '🐘', color: '#E84393', bg: '#FFF0F8', border: '#E84393' },
      categoryB: { label: 'Klein', emoji: '🐭', color: '#74B9FF', bg: '#EBF6FF', border: '#74B9FF' },
      items: [
        { id:1, emoji:'🦁', cat:'A' }, { id:2, emoji:'🐞', cat:'B' },
        { id:3, emoji:'🐋', cat:'A' }, { id:4, emoji:'🐜', cat:'B' },
        { id:5, emoji:'🦒', cat:'A' }, { id:6, emoji:'🐝', cat:'B' },
        { id:7, emoji:'🐘', cat:'A' }, { id:8, emoji:'🦗', cat:'B' },
        { id:9, emoji:'🦏', cat:'A' }, { id:10, emoji:'🦋', cat:'B' },
        { id:11, emoji:'🐊', cat:'A' }, { id:12, emoji:'🐛', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Haustiere', emoji: '🏠', color: '#FF9F43', bg: '#FFF3E0', border: '#FF9F43' },
      categoryB: { label: 'Wildtiere', emoji: '🌳', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      items: [
        { id:1, emoji:'🐕', cat:'A' }, { id:2, emoji:'🦁', cat:'B' },
        { id:3, emoji:'🐱', cat:'A' }, { id:4, emoji:'🐯', cat:'B' },
        { id:5, emoji:'🐹', cat:'A' }, { id:6, emoji:'🐻', cat:'B' },
        { id:7, emoji:'🐰', cat:'A' }, { id:8, emoji:'🦊', cat:'B' },
        { id:9, emoji:'🐟', cat:'A' }, { id:10, emoji:'🐺', cat:'B' },
        { id:11, emoji:'🐦', cat:'A' }, { id:12, emoji:'🦅', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Süß', emoji: '🍭', color: '#FD79A8', bg: '#FFF0F8', border: '#FD79A8' },
      categoryB: { label: 'Salzig', emoji: '🧂', color: '#74B9FF', bg: '#EBF6FF', border: '#74B9FF' },
      items: [
        { id:1, emoji:'🍭', cat:'A' }, { id:2, emoji:'🧂', cat:'B' },
        { id:3, emoji:'🍫', cat:'A' }, { id:4, emoji:'🥨', cat:'B' },
        { id:5, emoji:'🍰', cat:'A' }, { id:6, emoji:'🍟', cat:'B' },
        { id:7, emoji:'🍩', cat:'A' }, { id:8, emoji:'🥓', cat:'B' },
        { id:9, emoji:'🧁', cat:'A' }, { id:10, emoji:'🫙', cat:'B' },
        { id:11, emoji:'🍪', cat:'A' }, { id:12, emoji:'🥜', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Tagsüber', emoji: '☀️', color: '#FFD93D', bg: '#FFFDE0', border: '#FFD93D' },
      categoryB: { label: 'Nachts', emoji: '🌙', color: '#6C63FF', bg: '#F0EEFF', border: '#6C63FF' },
      items: [
        { id:1, emoji:'☀️', cat:'A' }, { id:2, emoji:'🌙', cat:'B' },
        { id:3, emoji:'🌈', cat:'A' }, { id:4, emoji:'⭐', cat:'B' },
        { id:5, emoji:'🦋', cat:'A' }, { id:6, emoji:'🦉', cat:'B' },
        { id:7, emoji:'🐝', cat:'A' }, { id:8, emoji:'🦇', cat:'B' },
        { id:9, emoji:'👓', cat:'A' }, { id:10, emoji:'😴', cat:'B' },
        { id:11, emoji:'🌻', cat:'A' }, { id:12, emoji:'🌃', cat:'B' },
      ],
    },
  ],
  // ── Tier 4 ─────────────────────────────────────────────────────────────────
  [
    {
      categoryA: { label: 'Gerade',   emoji: '2️⃣', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      categoryB: { label: 'Ungerade', emoji: '1️⃣', color: '#FF6B6B', bg: '#FFE8E8', border: '#FF6B6B' },
      items: [
        { id:1, emoji:'2', cat:'A' }, { id:2, emoji:'1', cat:'B' },
        { id:3, emoji:'4', cat:'A' }, { id:4, emoji:'3', cat:'B' },
        { id:5, emoji:'6', cat:'A' }, { id:6, emoji:'5', cat:'B' },
        { id:7, emoji:'8', cat:'A' }, { id:8, emoji:'7', cat:'B' },
        { id:9, emoji:'10', cat:'A' }, { id:10, emoji:'9', cat:'B' },
        { id:11, emoji:'12', cat:'A' }, { id:12, emoji:'11', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Gerade',   emoji: '2️⃣', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      categoryB: { label: 'Ungerade', emoji: '1️⃣', color: '#FF6B6B', bg: '#FFE8E8', border: '#FF6B6B' },
      items: [
        { id:1, emoji:'14', cat:'A' }, { id:2, emoji:'13', cat:'B' },
        { id:3, emoji:'16', cat:'A' }, { id:4, emoji:'15', cat:'B' },
        { id:5, emoji:'18', cat:'A' }, { id:6, emoji:'17', cat:'B' },
        { id:7, emoji:'20', cat:'A' }, { id:8, emoji:'19', cat:'B' },
        { id:9, emoji:'22', cat:'A' }, { id:10, emoji:'21', cat:'B' },
        { id:11, emoji:'24', cat:'A' }, { id:12, emoji:'23', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Flüssig', emoji: '💧', color: '#74B9FF', bg: '#EBF6FF', border: '#74B9FF' },
      categoryB: { label: 'Fest',   emoji: '🧱', color: '#795548', bg: '#EFEBE9', border: '#795548' },
      items: [
        { id:1, emoji:'💧', cat:'A' }, { id:2, emoji:'🧱', cat:'B' },
        { id:3, emoji:'🥛', cat:'A' }, { id:4, emoji:'⛰️', cat:'B' },
        { id:5, emoji:'🍵', cat:'A' }, { id:6, emoji:'🪨', cat:'B' },
        { id:7, emoji:'🧃', cat:'A' }, { id:8, emoji:'🍞', cat:'B' },
        { id:9, emoji:'🌊', cat:'A' }, { id:10, emoji:'🧊', cat:'B' },
        { id:11, emoji:'🍹', cat:'A' }, { id:12, emoji:'🏠', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Rund', emoji: '⭕', color: '#A29BFE', bg: '#F0EEFF', border: '#A29BFE' },
      categoryB: { label: 'Eckig', emoji: '⬛', color: '#636E72', bg: '#F0F0F0', border: '#636E72' },
      items: [
        { id:1, emoji:'🌕', cat:'A' }, { id:2, emoji:'📦', cat:'B' },
        { id:3, emoji:'🏀', cat:'A' }, { id:4, emoji:'📱', cat:'B' },
        { id:5, emoji:'🟠', cat:'A' }, { id:6, emoji:'⬛', cat:'B' },
        { id:7, emoji:'🔵', cat:'A' }, { id:8, emoji:'🔲', cat:'B' },
        { id:9, emoji:'🍊', cat:'A' }, { id:10, emoji:'🧱', cat:'B' },
        { id:11, emoji:'⚽', cat:'A' }, { id:12, emoji:'🖼️', cat:'B' },
      ],
    },
  ],
  // ── Tier 5 ─────────────────────────────────────────────────────────────────
  [
    {
      categoryA: { label: 'Lebt', emoji: '🌱', color: '#4CAF50', bg: '#E8F5E9', border: '#4CAF50' },
      categoryB: { label: 'Lebt nicht', emoji: '🪨', color: '#795548', bg: '#EFEBE9', border: '#795548' },
      items: [
        { id:1, emoji:'🌳', cat:'A' }, { id:2, emoji:'📦', cat:'B' },
        { id:3, emoji:'🐕', cat:'A' }, { id:4, emoji:'🚗', cat:'B' },
        { id:5, emoji:'🌸', cat:'A' }, { id:6, emoji:'🪑', cat:'B' },
        { id:7, emoji:'🐟', cat:'A' }, { id:8, emoji:'🧲', cat:'B' },
        { id:9, emoji:'🍄', cat:'A' }, { id:10, emoji:'💻', cat:'B' },
        { id:11, emoji:'🐝', cat:'A' }, { id:12, emoji:'🧱', cat:'B' },
        { id:13, emoji:'🌾', cat:'A' }, { id:14, emoji:'🔑', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Europa', emoji: '🇪🇺', color: '#2196F3', bg: '#E3F2FD', border: '#2196F3' },
      categoryB: { label: 'Nicht Europa', emoji: '🌍', color: '#FF9F43', bg: '#FFF3E0', border: '#FF9F43' },
      items: [
        { id:1, emoji:'🗼', cat:'A' }, { id:2, emoji:'🗽', cat:'B' },
        { id:3, emoji:'🏰', cat:'A' }, { id:4, emoji:'🏯', cat:'B' },
        { id:5, emoji:'❄️', cat:'A' }, { id:6, emoji:'🏜️', cat:'B' },
        { id:7, emoji:'🥐', cat:'A' }, { id:8, emoji:'🍜', cat:'B' },
        { id:9, emoji:'⚽', cat:'A' }, { id:10, emoji:'🏏', cat:'B' },
        { id:11, emoji:'🎻', cat:'A' }, { id:12, emoji:'🪘', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Pflanzenfresser', emoji: '🌿', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      categoryB: { label: 'Fleischfresser', emoji: '🥩', color: '#FF6B6B', bg: '#FFE8E8', border: '#FF6B6B' },
      items: [
        { id:1, emoji:'🐇', cat:'A' }, { id:2, emoji:'🦁', cat:'B' },
        { id:3, emoji:'🐮', cat:'A' }, { id:4, emoji:'🐺', cat:'B' },
        { id:5, emoji:'🦒', cat:'A' }, { id:6, emoji:'🦊', cat:'B' },
        { id:7, emoji:'🐘', cat:'A' }, { id:8, emoji:'🐯', cat:'B' },
        { id:9, emoji:'🐑', cat:'A' }, { id:10, emoji:'🦈', cat:'B' },
        { id:11, emoji:'🦓', cat:'A' }, { id:12, emoji:'🦅', cat:'B' },
      ],
    },
  ],
  // ── Tier 6 ─────────────────────────────────────────────────────────────────
  [
    {
      categoryA: { label: 'Warm / Heiß', emoji: '🔥', color: '#FF5722', bg: '#FBE9E7', border: '#FF5722' },
      categoryB: { label: 'Kalt / Kühl', emoji: '❄️', color: '#2196F3', bg: '#E3F2FD', border: '#2196F3' },
      items: [
        { id:1, emoji:'☀️', cat:'A' }, { id:2, emoji:'🧊', cat:'B' },
        { id:3, emoji:'🍵', cat:'A' }, { id:4, emoji:'🍦', cat:'B' },
        { id:5, emoji:'🔥', cat:'A' }, { id:6, emoji:'⛄', cat:'B' },
        { id:7, emoji:'🌋', cat:'A' }, { id:8, emoji:'🏔️', cat:'B' },
        { id:9, emoji:'🍲', cat:'A' }, { id:10, emoji:'🍧', cat:'B' },
        { id:11, emoji:'♨️', cat:'A' }, { id:12, emoji:'🌨️', cat:'B' },
        { id:13, emoji:'🌞', cat:'A' }, { id:14, emoji:'🌊', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Erneuerbar', emoji: '♻️', color: '#6BCB77', bg: '#E8F8EE', border: '#6BCB77' },
      categoryB: { label: 'Nicht erneuerbar', emoji: '⛽', color: '#795548', bg: '#EFEBE9', border: '#795548' },
      items: [
        { id:1, emoji:'☀️', cat:'A' }, { id:2, emoji:'⛽', cat:'B' },
        { id:3, emoji:'💨', cat:'A' }, { id:4, emoji:'🏭', cat:'B' },
        { id:5, emoji:'🌊', cat:'A' }, { id:6, emoji:'🚗', cat:'B' },
        { id:7, emoji:'🌱', cat:'A' }, { id:8, emoji:'🔋', cat:'B' },
        { id:9, emoji:'♻️', cat:'A' }, { id:10, emoji:'🗑️', cat:'B' },
        { id:11, emoji:'🍃', cat:'A' }, { id:12, emoji:'💨', cat:'B' },
      ],
    },
    {
      categoryA: { label: 'Vergangen', emoji: '⏮️', color: '#6C63FF', bg: '#F0EEFF', border: '#6C63FF' },
      categoryB: { label: 'Gegenwart', emoji: '▶️', color: '#FF9F43', bg: '#FFF3E0', border: '#FF9F43' },
      items: [
        { id:1, emoji:'🏰', cat:'A' }, { id:2, emoji:'🏙️', cat:'B' },
        { id:3, emoji:'⚔️', cat:'A' }, { id:4, emoji:'📱', cat:'B' },
        { id:5, emoji:'🦕', cat:'A' }, { id:6, emoji:'🚀', cat:'B' },
        { id:7, emoji:'🕯️', cat:'A' }, { id:8, emoji:'💡', cat:'B' },
        { id:9, emoji:'📜', cat:'A' }, { id:10, emoji:'💻', cat:'B' },
        { id:11, emoji:'🐎', cat:'A' }, { id:12, emoji:'🚗', cat:'B' },
      ],
    },
  ],
]

// Pick a random variant set for the given level (1-based), cycling through tiers
function pickLevelSet(level) {
  const tierIdx = Math.min(Math.floor((level - 1) / 2), LEVEL_SETS.length - 1)
  const variants = LEVEL_SETS[tierIdx]
  return variants[Math.floor(Math.random() * variants.length)]
}

function shuffleArr(a) { return [...a].sort(() => Math.random() - 0.5) }

export default function SortGame({ level = 1, onComplete }) {
  const [cfg]      = useState(() => pickLevelSet(level))
  const [items]    = useState(() => shuffleArr(cfg.items))
  const [curIdx,   setCurIdx]   = useState(0)
  const [sorted,   setSorted]   = useState({ A: [], B: [] })
  const [flyDir,   setFlyDir]   = useState(null)   // 'A' | 'B' | null
  const [feedback, setFeedback] = useState(null)   // 'ok' | 'wrong'
  const [score,    setScore]    = useState(0)
  const [lastCorrect, setLastCorrect] = useState(null)
  const [mood,     setMood]     = useState('happy')
  const [phase,    setPhase]    = useState('playing')
  const total = items.length
  const current = items[curIdx] ?? null

  const sortItem = useCallback((targetCat) => {
    if (!current || flyDir !== null) return
    const isCorrect = current.cat === targetCat
    setFlyDir(targetCat)

    if (isCorrect) {
      sfx.correct()
      setFeedback('ok')
      setMood('excited')
      const ns = score + 1
      setScore(ns)
      setSorted(prev => ({ ...prev, [targetCat]: [...prev[targetCat], current.id] }))
      setTimeout(() => {
        setFlyDir(null)
        setFeedback(null)
        setMood('happy')
        const nextIdx = curIdx + 1
        if (nextIdx >= total) {
          setPhase('done')
          sfx.complete()
          setTimeout(() => onComplete({ score: ns, total }), 1000)
        } else {
          setCurIdx(nextIdx)
        }
      }, 620)
    } else {
      sfx.wrong()
      setFeedback('wrong')
      setMood('encouraging')
      // fly to wrong basket then bounce back
      setTimeout(() => {
        setFlyDir(null)
        setFeedback(null)
        setMood('happy')
      }, 700)
    }
  }, [current, flyDir, score, curIdx, total, onComplete])

  // Keyboard: ArrowLeft → A, ArrowRight → B
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); sortItem('A') }
      if (e.key === 'ArrowRight') { e.preventDefault(); sortItem('B') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sortItem])

  const catA = cfg.categoryA
  const catB = cfg.categoryB
  const catC = cfg.categoryC || null

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(10px,2vw,20px) clamp(12px,3vw,28px)', gap:'clamp(10px,1.8vw,16px)', userSelect:'none' }}>

      {/* Progress bar */}
      <div style={{ display:'flex', gap:4, width:'100%', maxWidth:700 }}>
        {items.map((_, i) => (
          <div key={i} style={{ flex:1, height:9, borderRadius:99, background: i < curIdx ? '#6BCB77' : i === curIdx ? '#FFD93D' : '#ECE8FF', transition:'background 0.3s' }} />
        ))}
      </div>

      {/* Score */}
      <div style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'var(--text-muted)' }}>
        {'✅ ' + score + ' / ' + total}
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:700 }}>
        <LumiCharacter mood={mood} size={66} />
        <div style={{ flex:1, background:'white', borderRadius:'24px 24px 24px 6px', padding:'10px 16px', boxShadow:'0 4px 16px rgba(107,203,119,0.12)', fontFamily:'var(--font-heading)', fontSize:'clamp(14px,3vw,19px)', color:'var(--text-primary)' }}>
          {phase === 'done'
            ? '🎉 Super! Alles richtig sortiert!'
            : catC ? ('Wohin gehört es? ← ' + catA.label + '  · ↑ ' + catB.label + '  · → ' + catC.label) : ('Wohin gehört es? Pfeiltaste ← ' + catA.label + '  oder  ' + catB.label + ' →')}
        </div>
      </div>

      {/* Main area: baskets + flying card */}
      <div style={{ position:'relative', width:'100%', maxWidth:700, display:'flex', gap:'clamp(10px,3vw,24px)', alignItems:'stretch' }}>

        {/* Basket A (left) */}
        <div style={{
          flex:1, minHeight:'clamp(130px,22vw,190px)',
          background: catA.bg, border: '3px dashed ' + catA.border,
          borderRadius:22, display:'flex', flexDirection:'column', alignItems:'center', gap:6,
          padding:'clamp(8px,1.5vw,14px)',
          boxShadow: flyDir === 'A' ? '0 0 0 5px ' + catA.border + '66, 0 4px 20px rgba(0,0,0,0.08)' : '0 3px 14px rgba(0,0,0,0.06)',
          transition:'box-shadow 0.2s',
        }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(18px,3.8vw,26px)', fontWeight:700, color:catA.color, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:'clamp(28px,6vw,42px)' }}>{catA.emoji}</span>
            {catA.label}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center' }}>
            <AnimatePresence>
              {sorted.A.map(id => {
                const it = cfg.items.find(x => x.id === id)
                return (
                  <motion.span key={id} initial={{ scale:0, y:-10 }} animate={{ scale:1, y:0 }} transition={{ type:'spring', stiffness:420, damping:18 }}
                    style={{ fontSize:'clamp(28px,6.5vw,48px)', lineHeight:1 }}>
                    {it?.emoji}
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Current item — floats in center, flies left or right on sort */}
        <div style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)', zIndex:10, pointerEvents:'none', width:'clamp(110px,24vw,170px)', height:'clamp(110px,24vw,170px)' }}>
          <AnimatePresence mode="wait">
            {current && phase === 'playing' && (
              <motion.div
                key={current.id}
                initial={{ scale:0, opacity:0, x:0, y:0 }}
                animate={
                  flyDir === 'A' && feedback === 'ok'    ? { x:-260, y:-40, scale:0.5, opacity:0 } :
                  flyDir === 'B' && feedback === 'ok'    ? { x: 260, y:-40, scale:0.5, opacity:0 } :
                  feedback === 'wrong' ? { x:[0,-20,20,-16,16,-10,10,-5,5,0], y:0, scale:1, opacity:1 } :
                  { scale:1, opacity:1, x:0, y:0 }
                }
                exit={{ scale:0, opacity:0 }}
                transition={
                  feedback === 'wrong'
                    ? { duration:0.55, ease:'easeInOut' }
                    : { type:'spring', stiffness:340, damping:24 }
                }
                style={{
                  width:'100%', height:'100%',
                  borderRadius:24,
                  background: feedback === 'wrong' ? '#FFCDD2'
                            : feedback === 'ok'    ? '#E8F8EE'
                            : 'white',
                  border: '3.5px solid ' + (feedback === 'wrong' ? '#F44336' : feedback === 'ok' ? '#6BCB77' : '#ECE8FF'),
                  boxShadow: feedback === 'wrong'
                    ? '0 0 0 4px #F4433655, 0 8px 32px rgba(0,0,0,0.13)'
                    : '0 8px 32px rgba(0,0,0,0.13)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'clamp(56px,13vw,96px)', lineHeight:1,
                }}
              >
                {current.emoji}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Basket B (right) */}
        <div style={{
          flex:1, minHeight:'clamp(180px,30vw,280px)',
          background: catB.bg, border: '3px dashed ' + catB.border,
          borderRadius:22, display:'flex', flexDirection:'column', alignItems:'center', gap:6,
          padding:'clamp(8px,1.5vw,14px)',
          boxShadow: flyDir === 'B' ? '0 0 0 5px ' + catB.border + '66, 0 4px 20px rgba(0,0,0,0.08)' : '0 3px 14px rgba(0,0,0,0.06)',
          transition:'box-shadow 0.2s',
        }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(18px,3.8vw,26px)', fontWeight:700, color:catB.color, display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:'clamp(28px,6vw,42px)' }}>{catB.emoji}</span>
            {catB.label}
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:5, justifyContent:'center' }}>
            <AnimatePresence>
              {sorted.B.map(id => {
                const it = cfg.items.find(x => x.id === id)
                return (
                  <motion.span key={id} initial={{ scale:0, y:-10 }} animate={{ scale:1, y:0 }} transition={{ type:'spring', stiffness:420, damping:18 }}
                    style={{ fontSize:'clamp(28px,6.5vw,48px)', lineHeight:1 }}>
                    {it?.emoji}
                  </motion.span>
                )
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Arrow buttons */}
      <div style={{ display:'flex', gap:'clamp(16px,6vw,60px)', alignItems:'center', marginTop:4 }}>
        <motion.button
          whileTap={{ scale:0.88 }}
          onClick={() => sortItem('A')}
          style={{
            width:'clamp(90px,19vw,130px)', height:'clamp(90px,19vw,130px)',
            borderRadius:26, background: catA.bg,
            border: '3px solid ' + catA.border,
            boxShadow: '0 4px 18px ' + catA.border + '55',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            cursor:'pointer', gap:6,
          }}
        >
          <span style={{ fontSize:'clamp(32px,7vw,48px)' }}>{'◀'}</span>
          <span style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(14px,2.8vw,20px)', color:catA.color, fontWeight:700 }}>{catA.label}</span>
        </motion.button>

        <div style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'var(--text-muted)', textAlign:'center', lineHeight:1.5 }}>
          {'← / →\nPfeiltasten'}
        </div>

        <motion.button
          whileTap={{ scale:0.88 }}
          onClick={() => sortItem('B')}
          style={{
            width:'clamp(90px,19vw,130px)', height:'clamp(90px,19vw,130px)',
            borderRadius:26, background: catB.bg,
            border: '3px solid ' + catB.border,
            boxShadow: '0 4px 18px ' + catB.border + '55',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            cursor:'pointer', gap:6,
          }}
        >
          <span style={{ fontSize:'clamp(32px,7vw,48px)' }}>{'▶'}</span>
          <span style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(14px,2.8vw,20px)', color:catB.color, fontWeight:700 }}>{catB.label}</span>
        </motion.button>
      </div>

      {/* Done overlay */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            initial={{ scale:0.7, opacity:0 }} animate={{ scale:1, opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(107,203,119,0.18)', backdropFilter:'blur(6px)', zIndex:50, flexDirection:'column', gap:16 }}
          >
            <div style={{ fontSize:72, lineHeight:1 }}>{'🎉'}</div>
            <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(26px,7vw,48px)', fontWeight:800, color:'#2C8C50', textShadow:'0 3px 18px rgba(0,0,0,0.15)' }}>
              {'Alles richtig!'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
        {/* Basket C (bottom-right) — only shown when catC exists */}
        {catC && (
          <motion.div
            animate={flyDir === 'C' ? { scale: [1, 1.04, 1] } : {}}
            transition={{ duration: 0.25 }}
            style={{
              position: 'absolute', right: 0, bottom: '-clamp(80px,16vw,130px)',
              width: '45%',
              minHeight: 'clamp(80px,14vw,120px)',
              background: catC.bg, border: '3px dashed ' + catC.border,
              borderRadius: 22, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
              padding: 'clamp(6px,1.2vw,12px)',
              boxShadow: flyDir === 'C' ? '0 0 0 5px ' + catC.border + '66, 0 4px 20px rgba(0,0,0,0.08)' : '0 3px 14px rgba(0,0,0,0.07)',
              zIndex: 5,
            }}
          >
            <span style={{ fontSize: 'clamp(26px,5.5vw,40px)', lineHeight: 1 }}>{catC.emoji}</span>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(12px,2.5vw,17px)', color: catC.color, fontWeight: 700, textAlign: 'center' }}>{catC.label}</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', marginTop: 2 }}>
              {droppedC.map((em, i) => <span key={i} style={{ fontSize: 'clamp(18px,4vw,28px)' }}>{em}</span>)}
            </div>
          </motion.div>
        )}
