import { motion } from 'framer-motion'

// Lumi as the pixel sprite (same as in the maze and on the home screen).
// Same API as the old SVG Lumi, so every game keeps calling it with a mood:
// a cheering mood shows the beaming frame and bounces livelier.
const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const CHEER = new Set(['happy', 'excited', 'encouraging'])

export default function LumiCharacter({ mood = 'happy', size = 120 }) {
  const cheer = CHEER.has(mood) && mood !== 'happy'
  const src = `${BASE}/sprites/maze/${cheer ? 'lumi_happy' : 'lumi_idle'}.png`
  return (
    <motion.div
      animate={{ y: [0, -size * (mood === 'excited' ? 0.1 : 0.05), 0] }}
      transition={{ duration: mood === 'excited' ? 0.6 : 2.2, repeat: Infinity, ease: 'easeInOut' }}
      style={{ display: 'inline-block', width: size, height: size, flexShrink: 0 }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          width: size, height: size, display: 'block', imageRendering: 'pixelated',
          filter: mood === 'sleepy' ? 'saturate(0.6) brightness(0.92)' : 'drop-shadow(0 3px 0 rgba(42,27,61,0.3))',
        }}
      />
    </motion.div>
  )
}
