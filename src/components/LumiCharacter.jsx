import { motion } from 'framer-motion'
import LumiFigure from './LumiFigure.jsx'

// Lumi in its cartoon poses, wearing what the child chose (LumiFigure). Same API as before, so
// every screen keeps calling it with a mood; an excited Lumi bounces livelier.

export default function LumiCharacter({ mood = 'happy', size = 120 }) {
  return (
    <motion.div
      animate={{ y: [0, -size * (mood === 'excited' ? 0.1 : 0.05), 0] }}
      transition={{ duration: mood === 'excited' ? 0.6 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ display: 'inline-block', width: size, height: size, flexShrink: 0 }}
    >
      <LumiFigure mood={mood === 'happy' ? 'idle' : mood} size={size}
        style={{ display: 'block', filter: 'drop-shadow(0 3px 0 rgba(42,27,61,0.3))' }} />
    </motion.div>
  )
}
