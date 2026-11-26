import { useEffect, useRef, useState } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { PxStar } from './PixelUI.jsx'
import LumiFigure from './LumiFigure.jsx'
import { FriendCompanion, useFriendAlong } from './FriendFigure.jsx'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')

/**
 * Lumi in a game's top bar, playing along: a jump and a burst of stars for
 * a right answer, a thoughtful face and a tilt for a miss (no "?" bubble:
 * nobody could say what it asked), a big cheer for a right
 * answer after a miss (the child kept going), a somersault for three right
 * in a row.
 *
 * A friendly character that reacts to what the child does keeps young
 * children engaged and helps them learn from a screen (Calvert et al. 2014,
 * Gola et al. 2013: children learn more from characters they feel close
 * to). Lumi sits in the bar, never over the game.
 *
 * Listens to 'lumi:feedback' (lib/feedback.js, sfx.js). A game that both
 * plays the sound and speaks the praise sends two signals for one answer:
 * the second within 400 ms is ignored.
 *
 * The friend that comes along (Lumis Freunde) sits beside Lumi and is glad
 * or thoughtful with it, but only where the bar has room for it: from
 * FRIEND_MIN_WIDTH on (a tablet held upright, a phone held sideways). On a
 * phone held upright the bar has about 36 px left (back, game picture,
 * Lumi, level, music, help), not enough for a friend without squeezing the
 * rest; below 768 px the friend cut the game's name in half of the games.
 */
export const FRIEND_MIN_WIDTH = 768
const roomForFriend = () => typeof window !== 'undefined' && window.innerWidth >= FRIEND_MIN_WIDTH
export default function LumiBuddy({ size = 48 }) {
  const controls = useAnimationControls()
  const [mood, setMood] = useState('idle')
  const [bursts, setBursts] = useState([])
  const last = useRef({ t: 0, kind: '' })
  const inRow = useRef(0)
  const timer = useRef(null)
  const along = useFriendAlong()
  const [room, setRoom] = useState(roomForFriend)
  useEffect(() => {
    const on = () => setRoom(roomForFriend())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const friend = along && room ? along : null

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const onFeedback = e => {
      const kind = e.detail
      const now = Date.now()
      const sameAnswer = now - last.current.t < 400 &&
        (kind === last.current.kind || (kind !== 'wrong') === (last.current.kind !== 'wrong'))
      // 'persist' outranks the 'right' of the sound that came first
      if (sameAnswer && !(kind === 'persist' && last.current.kind === 'right')) return
      last.current = { t: now, kind }
      clearTimeout(timer.current)

      if (kind === 'wrong') {
        inRow.current = 0
        setMood('oops')
        if (!reduce) controls.start({ rotate: [0, -12, 8, -4, 0], y: 0, transition: { duration: 0.7 } })
      } else {
        inRow.current = sameAnswer ? inRow.current : inRow.current + 1
        setMood('happy')
        const big = kind === 'persist' || inRow.current % 3 === 0
        setBursts(b => [...b.slice(-2), { id: now, big }])
        if (!reduce) {
          // the bar is at the very top: small hops, the rest is a squash,
          // a stretch and a spin, so Lumi never leaves the screen
          controls.start(inRow.current % 3 === 0 && kind !== 'persist'
            ? { y: [0, -size * 0.18, 0], scale: [1, 1.2, 1], rotate: [0, 360], transition: { duration: 0.7, ease: 'easeOut' } }
            : { y: [0, -size * 0.15, 0], scaleX: [1, 1.18, 0.92, 1], scaleY: [1, 0.85, 1.15, 1], rotate: 0, transition: { duration: 0.5, ease: 'easeOut' } })
        }
      }
      timer.current = setTimeout(() => setMood('idle'), 1600)
    }
    window.addEventListener('lumi:feedback', onFeedback)
    return () => { window.removeEventListener('lumi:feedback', onFeedback); clearTimeout(timer.current) }
  }, [controls, size])

  const buddy = (
    <div aria-hidden="true" data-lumi-buddy={mood} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* Lumi wears what the child chose in the wardrobe */}
      <motion.div animate={controls} style={{ width: size, height: size, filter: 'drop-shadow(0 3px 0 rgba(42,27,61,0.35))' }}>
        <LumiFigure mood={mood} size={size} style={{ display: 'block' }} />
      </motion.div>
      {bursts.map(b => <Burst key={b.id} big={b.big} size={size} onDone={() => setBursts(x => x.filter(y => y.id !== b.id))} />)}
    </div>
  )
  if (!friend) return buddy
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', flexShrink: 0 }}>
      <FriendCompanion id={friend} mood={mood} size={Math.round(size * 0.95)} style={{ marginRight: -size * 0.08, filter: 'drop-shadow(0 3px 0 rgba(42,27,61,0.3))' }} />
      {buddy}
    </div>
  )
}

function Burst({ big, size, onDone }) {
  const n = big ? 9 : 6
  return (
    <div style={{ position: 'absolute', left: '50%', top: '45%', pointerEvents: 'none', zIndex: 3 }}>
      {Array.from({ length: n }, (_, i) => {
        // a fan below and beside Lumi: above is the edge of the screen
        const a = Math.PI * (-0.1 + 1.2 * (i / (n - 1)))
        const r = size * (big ? 1.25 : 0.95)
        return (
          <motion.div key={i}
            initial={{ x: -8, y: -8, scale: 0.2, opacity: 1 }}
            animate={{ x: Math.cos(a) * r - 8, y: Math.sin(a) * r * 0.75 + (big ? 6 : 0) - 8, scale: big ? 1.1 : 0.85, opacity: 0 }}
            transition={{ duration: big ? 0.95 : 0.75, ease: 'easeOut' }}
            onAnimationComplete={i === 0 ? onDone : undefined}
            style={{ position: 'absolute' }}>
            <PxStar size={16} />
          </motion.div>
        )
      })}
    </div>
  )
}
