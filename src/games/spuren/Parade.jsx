import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useBursts } from '../../components/play/index.js'
import { usePaused } from '../../lib/pause.js'
import { sfx } from '../../sfx.js'
import { MINI, MiniGlyph, Pic } from './Glyph.jsx'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * The end of a level of Buchstaben-Spuren: the glyphs of the level come
 * down from the shelf and march across the board in a row, each with its
 * picture above it — in from the left, a jump in the middle, out to the
 * right. Then `onDone` (held while paused).
 *
 * It fills its parent (the board, which clips it), so nothing dances over
 * Lumi, the bubble or the shelf.
 *
 *   items   [{ i, g, color }]   the glyphs, in the order they were traced
 *   w, h    the board, in px
 */
export default function Parade({ items, w, h, onDone }) {
  const paused = usePaused()
  const [bursts, burst] = useBursts()
  const box = useRef(null)
  const done = useRef(onDone)
  done.current = onDone
  const still = reduceMotion()
  const MS = still ? 2400 : 4000

  useEffect(() => {
    sfx.tada()
    const el = box.current
    const timers = []
    if (el) {
      const r = el.getBoundingClientRect()
      ;[0.25, 0.5, 0.75].forEach((x, i) => timers.push(setTimeout(() => burst({ x: r.left + r.width * x, y: r.top + r.height * 0.3 }, 'confetti', 14), 1300 + i * 180)))
    }
    return () => timers.forEach(clearTimeout)
  }, [burst])

  // the beat of the march
  useEffect(() => {
    if (paused || still) return
    let n = 0
    const id = setInterval(() => sfx.drum(n++ % 2 === 1), 300)
    const stop = setTimeout(() => clearInterval(id), MS - 400)
    return () => { clearInterval(id); clearTimeout(stop) }
  }, [paused, still, MS])

  // the timer starts again after a pause: the child sees the whole parade
  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => done.current(), MS)
    return () => clearTimeout(t)
  }, [paused, MS])

  const n = Math.max(1, items.length)
  const gap = Math.max(2, w * 0.012)
  const slot = Math.min(110, (w * 0.92 - gap * (n - 1)) / n)
  const rowW = slot * n + gap * (n - 1)
  const mid = (w - rowW) / 2
  const pic = slot * 0.74
  const rowH = pic + slot * (MINI.h / MINI.w)
  return (
    <div ref={box} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 'inherit', pointerEvents: 'none' }}>
      <motion.div
        initial={still ? { x: mid } : { x: -rowW - 8 }}
        animate={still ? { x: mid } : { x: [-rowW - 8, mid, mid, w + 8] }}
        transition={{ duration: MS / 1000 - 0.15, times: [0, 0.36, 0.64, 1], ease: 'linear' }}
        style={{ position: 'absolute', left: 0, top: Math.max(0, (h - rowH) * 0.5), display: 'flex', gap, alignItems: 'flex-end' }}>
        {items.map((it, k) => (
          // the march: a bob at every step, and a jump all together in the middle
          <motion.div key={it.i}
            animate={still ? {} : { y: [0, -slot * 0.07, 0, -slot * 0.07, 0, -slot * 0.07, 0, -slot * 0.07, 0, -slot * 0.42, 0, -slot * 0.3, 0, -slot * 0.07, 0, -slot * 0.07, 0, -slot * 0.07, 0, -slot * 0.07, 0] }}
            transition={{ duration: MS / 1000 - 0.15, ease: 'easeInOut', delay: k * 0.03 }}
            style={{ width: slot, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
            <motion.div animate={still ? {} : { rotate: [-7, 7] }} transition={{ duration: 0.3, repeat: Infinity, repeatType: 'reverse', delay: k * 0.07 }}
              style={{ width: pic, height: pic, filter: 'drop-shadow(0 3px 0 rgba(42,27,61,0.22))' }}>
              <Pic g={it.g} color={it.color} size={pic} />
            </motion.div>
            <MiniGlyph g={it.g} color={it.color} width={slot} walking={!still} />
          </motion.div>
        ))}
      </motion.div>
      {bursts}
    </div>
  )
}
