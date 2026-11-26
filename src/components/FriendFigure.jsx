import { useContext, useEffect } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { AppContext } from '../AppContext.jsx'
import { asset } from '../lib/assets.js'
import { FRIEND_BY_ID, cleanAlong, friendLayers, friendPose } from '../lib/friends.js'

/**
 * One of Lumi's friends (lib/friends.js) in one of its six pictures.
 * Drawn in layers like LumiFigure (the picture now; the wardrobe's clothes
 * on the friend's anchors later), in a square: a friend in a square as big
 * as Lumi's stands on the same ground line and is a little smaller.
 *
 * `mood` is one of Lumi's moods: the friend is glad, sad, thinking, asleep
 * or waving with Lumi (lib/friends.js friendPose).
 */
export function FriendFigure({ id, mood = 'idle', size = 120, style, className, alt = '' }) {
  const pose = friendPose(mood)
  const { layers, scale } = friendLayers(id, pose)
  if (!layers.length) return null
  return (
    <span className={className} role={alt ? 'img' : undefined} aria-label={alt || undefined} data-friend-pose={pose} data-friend={id}
      style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0, maxWidth: 'none', ...style }}>
      <span style={{ position: 'absolute', inset: 0, ...(scale < 1 ? { transform: `scale(${scale})`, transformOrigin: '50% 100%' } : null) }}>
        {layers.map((l, i) => (
          <img key={i} src={asset(l.src)} alt="" draggable={false}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', maxWidth: 'none', objectFit: 'contain' }} />
        ))}
      </span>
    </span>
  )
}

/** The friend that comes along with the playing child, or null. */
export function useFriendAlong() {
  const ctx = useContext(AppContext)
  const s = ctx?.state
  const p = s?.profiles?.[s.activeProfileId]
  return p ? cleanAlong(p.friendAlong, p.friends) : null
}

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * The friend that comes along, beside Lumi: it follows Lumi's mood a moment
 * later (glad when Lumi is glad, thinking, asleep), breathes when nothing
 * happens, a little out of step with Lumi. It is only to look at: no
 * border, no shadow of a button, no tap (pointer events pass through).
 * `id` left out: the friend the playing child chose (nothing without one).
 */
export function FriendCompanion({ id, mood = 'idle', size = 100, delay = 0.18, style }) {
  const own = useFriendAlong()
  const who = id === undefined ? own : id
  const controls = useAnimationControls()
  const pose = friendPose(mood)
  useEffect(() => {
    if (reduceMotion() || !who) return
    const s = size
    const A = {
      happy: { y: [0, -s * 0.16, 0, -s * 0.06, 0], rotate: 0, scaleY: [1, 0.94, 1.04, 1], transition: { duration: 0.9, delay, ease: 'easeOut' } },
      sad: { y: s * 0.02, rotate: [0, -3, 3, 0], transition: { duration: 1.4, delay } },
      think: { rotate: [0, -6, 4, 0], y: 0, transition: { duration: 0.9, delay } },
      wave: { rotate: [0, 3, -3, 0], y: 0, transition: { duration: 1.6, repeat: Infinity, delay } },
      sleep: { scaleY: [1, 1.04, 1], y: 0, rotate: 0, transition: { duration: 3.8, repeat: Infinity } },
      idle: { y: [0, -s * 0.02, 0], scaleY: [1, 1.025, 1], rotate: 0, transition: { duration: 2.9, repeat: Infinity, ease: 'easeInOut', delay: 0.7 } },
    }
    controls.set({ rotate: 0 })
    controls.start(A[pose] ?? A.idle)
  }, [pose, size, who, controls, delay])
  if (!who || !FRIEND_BY_ID[who]) return null
  return (
    <motion.div aria-hidden="true" data-companion={who} animate={controls}
      style={{ width: size, height: size, flexShrink: 0, pointerEvents: 'none', transformOrigin: '50% 100%', ...style }}>
      <FriendFigure id={who} mood={mood} size={size} style={{ display: 'block' }} />
    </motion.div>
  )
}

/** The picture of the place: two friends side by side (the home button and the bar). */
export function FriendsIcon({ size = 44 }) {
  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block', width: size, height: size, flexShrink: 0 }}>
      <FriendFigure id="einhorn" size={size * 0.78} style={{ position: 'absolute', left: -size * 0.1, bottom: 0 }} />
      <FriendFigure id="dino" size={size * 0.82} style={{ position: 'absolute', right: -size * 0.12, bottom: -size * 0.02 }} />
    </span>
  )
}
