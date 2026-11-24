import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { Art, useBursts } from '../../components/play/index.js'
import { usePaused } from '../../lib/pause.js'
import { sfx } from '../../sfx.js'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * The end of a level, in the game itself, before the results screen:
 * everything the child made in this level comes out and dances in a wave
 * around the hero, with confetti. Then `onDone` (held while paused).
 * Lies over the game's own stage; the game's root must be positioned.
 */
export default function Finale({ items, hero, onDone, ms = 2800 }) {
  const paused = usePaused()
  const [bursts, burst] = useBursts()
  const box = useRef(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    sfx.tada()
    const t = setTimeout(() => sfx.sparkle(), 500)
    const el = box.current
    if (el) {
      const r = el.getBoundingClientRect()
      ;[0.25, 0.5, 0.75].forEach((x, i) => setTimeout(() => burst({ x: r.left + r.width * x, y: r.top + r.height * 0.35 }, 'confetti', 16), i * 220))
    }
    return () => clearTimeout(t)
  }, [burst])

  // the timer starts again after a pause: the child sees the whole party
  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => done.current(), ms)
    return () => clearTimeout(t)
  }, [paused, ms])

  const still = reduceMotion()
  const n = items.length
  // a phone gets smaller dancers, so the arc stays on the screen
  const small = typeof window !== 'undefined' && window.innerWidth < 600
  const itemS = small ? (n > 8 ? 40 : 50) : (n > 8 ? 58 : 72)
  return (
    <div ref={box} aria-hidden="true" style={{
      position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'auto',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(circle at 50% 55%, rgba(255,247,214,0.9) 0%, rgba(255,247,214,0.55) 40%, rgba(255,247,214,0) 70%)',
    }}>
      <div style={{ position: 'relative', width: 'min(92%, 760px)', aspectRatio: '2 / 1' }}>
        {items.map((art, i) => {
          // an arc over the hero, left to right
          const a = Math.PI * (1 - (n === 1 ? 0.5 : i / (n - 1)))
          const x = 50 + Math.cos(a) * 40, y = 62 - Math.sin(a) * 46
          return (
            <motion.div key={i}
              initial={{ scale: 0, opacity: 0 }}
              animate={still ? { scale: 1, opacity: 1 } : { scale: 1, opacity: 1, y: [0, -26, 0], rotate: [0, -10, 10, 0] }}
              transition={{ scale: { delay: i * 0.08, type: 'spring', stiffness: 320, damping: 14 }, opacity: { delay: i * 0.08 },
                y: { delay: 0.4 + i * 0.09, duration: 0.6, repeat: Infinity, repeatDelay: 0.4 }, rotate: { delay: 0.4 + i * 0.09, duration: 0.6, repeat: Infinity, repeatDelay: 0.4 } }}
              style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, translate: '-50% -50%', filter: 'drop-shadow(0 5px 0 rgba(42,27,61,0.22))' }}>
              <Art art={art} size={itemS} />
            </motion.div>
          )
        })}
        {hero && (
          <motion.div
            initial={{ scale: 0, y: 40 }}
            animate={still ? { scale: 1, y: 0 } : { scale: 1, y: [0, -40, 0], rotate: [0, -12, 12, 0] }}
            transition={{ scale: { type: 'spring', stiffness: 260, damping: 12 }, y: { duration: 0.9, delay: 0.5, repeat: Infinity, repeatDelay: 0.5 }, rotate: { duration: 0.9, delay: 0.5, repeat: Infinity, repeatDelay: 0.5 } }}
            style={{ position: 'absolute', left: '50%', top: '72%', translate: '-50% -50%' }}>
            <Art art={hero} size={small ? 100 : 130} />
          </motion.div>
        )}
      </div>
      {bursts}
    </div>
  )
}
