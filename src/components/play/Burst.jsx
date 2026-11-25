import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * One-shot bursts of stars, hearts or confetti from a point on screen —
 * the "it worked!" sparkle, where the child's finger just was.
 *
 *   const [bursts, burst] = useBursts()
 *   burst(e.currentTarget, 'stars')   // an element, or { x, y } on screen
 *   … {bursts}
 */
const COLORS = ['#ffc93c', '#ff6b5b', '#4aa3ff', '#3fc1a8', '#5cc45a', '#ff8fb8']
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function useBursts() {
  const [list, setList] = useState([])
  const burst = useCallback((at, kind = 'stars', n = 10) => {
    if (reduceMotion()) return
    let x, y
    if (at?.getBoundingClientRect) { const r = at.getBoundingClientRect(); x = r.left + r.width / 2; y = r.top + r.height / 2 }
    else ({ x, y } = at ?? { x: innerWidth / 2, y: innerHeight / 2 })
    const id = Math.random()
    setList(l => [...l.slice(-3), { id, x, y, kind, n }])
    setTimeout(() => setList(l => l.filter(b => b.id !== id)), 1300)
  }, [])
  const node = typeof document === 'undefined' ? null : createPortal(
    <AnimatePresence>{list.map(b => <BurstAt key={b.id} {...b} />)}</AnimatePresence>, document.body)
  return [node, burst]
}

function BurstAt({ x, y, kind, n }) {
  return (
    <div aria-hidden="true" style={{ position: 'fixed', left: x, top: y, width: 0, height: 0, zIndex: 9998, pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
        const d = 60 + Math.random() * 70
        const s = kind === 'confetti' ? 10 : 22 + Math.random() * 10
        return (
          <motion.div key={i} initial={{ x: 0, y: 0, scale: 0.3, opacity: 1, rotate: 0 }}
            animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d + (kind === 'confetti' ? 40 : 0), scale: 1, opacity: 0, rotate: kind === 'hearts' ? 0 : 200 }}
            transition={{ duration: 0.9 + Math.random() * 0.3, ease: 'easeOut' }}
            style={{ position: 'absolute', left: -s / 2, top: -s / 2 }}>
            <Piece kind={kind} s={s} color={COLORS[i % COLORS.length]} />
          </motion.div>
        )
      })}
    </div>
  )
}

function Piece({ kind, s, color }) {
  if (kind === 'confetti') return <div style={{ width: s, height: s * 0.6, background: color, borderRadius: 2 }} />
  if (kind === 'hearts') return (
    <svg viewBox="-2 -2.5 24 22" width={s} height={s * 0.9}>
      <path d="M10 17 C2 11 0 7 0 4.5 A4.5 4.5 0 0 1 10 3 A4.5 4.5 0 0 1 20 4.5 C20 7 18 11 10 17Z" fill="#ff5b8a" stroke="#2a1b3d" strokeWidth="1.5" />
    </svg>
  )
  return (
    <svg viewBox="0 0 24 24" width={s} height={s}>
      <path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill={color} stroke="#2a1b3d" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}
