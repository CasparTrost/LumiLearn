import { motion } from 'framer-motion'

// Shared "rain" confetti — pieces fall from the top of their container,
// rotating and fading out. Was duplicated near-verbatim in
// ResultsScreen.jsx and FarmProgress.jsx's LevelUpCelebration; both now
// use this, passing their own count/colors/position to keep their exact
// original look.
//
// Not merged in here: NumbersGame.jsx's Confetti (radiates outward from
// a point, not a rain effect), MazeGame.jsx's Sparkles and MemoryGame's
// SparkBurst (emoji-based radial bursts), and the larger multi-shape
// confetti inside FarmProgress's LevelUpCelebration overlay (bespoke,
// used only for that one big moment) — those are genuinely different
// visual mechanics, not copies of this one.
export default function Confetti({
  count = 30,
  colors = ['#FFD93D', '#FF6B6B', '#6C63FF', '#4ECDC4', '#6BCB77', '#FD79A8'],
  position = 'fixed',
  zIndex = 0,
  xRange = [10, 90],
  sizeRange = [8, 18],
  // Fall distance as explicit CSS length strings, not just parameterized
  // numbers — the two original call sites used different units (vh vs
  // %), and since framer-motion's y resolves percentages against each
  // piece's own (tiny) box rather than the container, swapping units
  // changes how far it visibly falls. Keeping this a caller-supplied
  // pair preserves each site's exact original distance instead of
  // silently picking one unit for both.
  yFrom = '-10%',
  yTo = '110%',
}) {
  const pieces = Array.from({ length: count }, (_, i) => ({
    x: xRange[0] + Math.random() * (xRange[1] - xRange[0]),
    color: colors[i % colors.length],
    size: sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]),
    delay: Math.random() * 0.8,
    duration: 1.5 + Math.random() * 1,
    rotate: Math.random() * 360,
  }))
  return (
    <div style={{ position, inset: 0, pointerEvents: 'none', zIndex, overflow: 'hidden' }}>
      {pieces.map((p, i) => (
        <motion.div
          key={i}
          initial={{ x: `${p.x}vw`, y: yFrom, rotate: 0, opacity: 1 }}
          animate={{ y: yTo, rotate: p.rotate + 720, opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            width: p.size, height: p.size,
            background: p.color,
            borderRadius: i % 3 === 0 ? '50%' : i % 3 === 1 ? 3 : '50% 0',
          }}
        />
      ))}
    </div>
  )
}
