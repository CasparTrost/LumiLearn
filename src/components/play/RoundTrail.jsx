import { motion } from 'framer-motion'
import { Art } from './Critter.jsx'

/**
 * How far the round has come, as a little walk instead of a progress bar:
 * stepping stones, a walker hopping one stone on per task, and a goal
 * waiting at the end (a house, a present, a cake). Children see "nearly
 * there!" without counting bars.
 *
 *   <RoundTrail total={8} done={round} walker="🐌" goal="🎁" />
 */
export default function RoundTrail({ total, done, walker = 'lumi', goal = '🎁', size = 40, style }) {
  const n = Math.max(1, total)
  const pos = Math.min(done, n)
  const pct = i => `${(i / n) * 100}%`
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={n} aria-valuenow={pos} aria-label={`${pos} von ${n} geschafft`}
      style={{ position: 'relative', height: size * 1.35, margin: `0 ${size * 1.1}px 0 ${size * 0.5}px`, ...style }}>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: size * 0.18, height: size * 0.16, borderRadius: 99, background: 'rgba(42,27,61,0.12)' }} />
      <motion.div initial={false} animate={{ width: pct(pos) }} transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        style={{ position: 'absolute', left: 0, bottom: size * 0.18, height: size * 0.16, borderRadius: 99, background: '#ffc93c', boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.12)' }} />
      {Array.from({ length: n + 1 }, (_, i) => (
        <div key={i} style={{
          position: 'absolute', left: pct(i), bottom: size * 0.1, width: size * 0.32, height: size * 0.32, marginLeft: -size * 0.16, borderRadius: '50%',
          background: i <= pos ? '#ffc93c' : '#fffdf7', border: '3px solid #2a1b3d', boxSizing: 'border-box',
        }} />
      ))}
      <motion.div aria-hidden="true" style={{ position: 'absolute', bottom: size * 0.32, left: pct(n), marginLeft: -size * 0.1 }}
        animate={pos >= n ? { y: [0, -size * 0.4, 0], rotate: [0, -10, 10, 0] } : { y: 0 }}
        transition={{ duration: 0.8, repeat: pos >= n ? 2 : 0 }}>
        <Art art={goal} size={size * 0.95} />
      </motion.div>
      <motion.div aria-hidden="true" initial={false} animate={{ left: pct(pos) }}
        transition={{ type: 'spring', stiffness: 160, damping: 16 }}
        style={{ position: 'absolute', bottom: size * 0.26, marginLeft: -size * 0.45 }}>
        <motion.div key={pos} initial={{ y: 0 }} animate={{ y: [0, -size * 0.5, 0] }} transition={{ duration: 0.45 }}>
          <Art art={walker} size={size * 0.9} />
        </motion.div>
      </motion.div>
    </div>
  )
}
