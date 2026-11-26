import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useAnimationControls } from 'framer-motion'
import { emojiSrc, hasEmojiArt, customName, customArtSrc } from '../../lib/emojiArt.jsx'
import { onNarrationChange } from '../../narrator.js'
import { lumiArt } from '../../lib/assets.js'
import { sfx } from '../../sfx.js'
import { playAnimal } from '../../lib/animalSounds.js'
import LumiFigure, { useOutfit } from '../LumiFigure.jsx'
import './play.css'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** The picture for an emoji, a custom-art token (lib/emojiArt.jsx), 'lumi' or a plain URL. */
export function artSrc(art, mood = 'idle') {
  if (art === 'lumi') return lumiArt(mood)
  const name = customName(art)
  if (name) return customArtSrc(name)
  if (typeof art === 'string' && (art.startsWith('/') || art.startsWith('http'))) return art
  return hasEmojiArt(art) ? emojiSrc(art) : null
}

/** A picture of a thing: the cartoon art for an emoji, or the emoji itself. */
export function Art({ art, size = 64, style, alt = '', mood }) {
  // Lumi wears what the child chose in the wardrobe (components/LumiFigure.jsx)
  if (art === 'lumi') return <LumiFigure mood={mood} size={size} style={style} alt={alt} />
  const src = artSrc(art, mood)
  if (!src) return <span role={alt ? 'img' : undefined} aria-label={alt || undefined} style={{ fontSize: size * 0.82, lineHeight: 1, ...style }}>{art}</span>
  return <img src={src} alt={alt} draggable={false}
    style={{ width: size, height: size, maxWidth: 'none', flexShrink: 0, objectFit: 'contain', ...style }} />
}

/**
 * A character the child plays with: it wants something, gets it, and
 * shows how it feels about it. The heart of the play kit — in good
 * children's TV the learning is a favour for a character, not a test.
 *
 *   const [mood, setMood] = useMood()
 *   <Critter art="🐻" mood={mood} wish={<Art art="🍎" />} />
 *   setMood('eat') … setMood('happy')     // back to 'idle' after a while
 *
 * Moods
 *   idle   breathes, blinks now and then
 *   talk   bobs along while Lumi's voice is speaking (automatic with `talks`)
 *   hungry leans forward, eager (something is being dragged near it)
 *   eat    munch, munch, crumbs fly
 *   happy  jumps, spins, hearts float up
 *   dance  a longer party dance
 *   sad    droops, sways; a little rain cloud
 *   oops   a miss, shown once and kindly: the character shakes its head
 *          a little (Lumi with a thoughtful face). No mark: a "?" over
 *          the head was a question nobody could answer, and with the one
 *          drawn into Lumi's old picture there were two
 *   wow    stretches up, an exclamation mark
 *   sleep  slow breathing, Zzz
 *
 * Tapping it tickles it (a giggle and a wiggle) unless `onTap` says
 * otherwise. `wish` shows a speech bubble with a picture of what it wants;
 * `accessory` (a hat, a wand) is drawn on the character and moves with it.
 */
export default function Critter({
  art = '🐻', size = 140, mood = 'idle', flip = false, wish = null, wishSide = 'top',
  onTap, talks = false, label, style, children, accessory = null, shadow = true,
  quiet = false,   // no sound of its own when it turns glad (the game plays it when it fits)
}) {
  const controls = useAnimationControls()
  const [tickle, setTickle] = useState(0)
  const speaking = useSpeaking(talks)
  // a hat reaches up to the top of Lumi's square: the bubble keeps clear of it
  const hatOn = !!useOutfit()?.head && art === 'lumi'
  const shown = mood === 'idle' && speaking ? 'talk' : mood

  useEffect(() => {
    if (reduceMotion()) return
    const s = size
    const A = {
      idle:   { y: [0, -s * 0.02, 0], scaleY: [1, 1.03, 1], transition: { duration: 2.6, repeat: Infinity, ease: 'easeInOut' } },
      talk:   { y: [0, -s * 0.04, 0], rotate: [0, -2, 2, 0], transition: { duration: 0.5, repeat: Infinity } },
      hungry: { y: -s * 0.04, scale: 1.12, rotate: flip ? 6 : -6, transition: { type: 'spring', stiffness: 300, damping: 12 } },
      eat:    { scaleY: [1, 0.82, 1.1, 0.86, 1.06, 1], scaleX: [1, 1.12, 0.94, 1.1, 0.97, 1], y: 0, rotate: 0, transition: { duration: 0.8 } },
      happy:  { y: [0, -s * 0.22, 0, -s * 0.08, 0], rotate: [0, 0, 360, 360, 360], scale: 1, transition: { duration: 1.1, ease: 'easeOut' } },
      dance:  { rotate: [0, -12, 12, -12, 12, 0], y: [0, -s * 0.1, 0, -s * 0.1, 0, 0], scale: 1, transition: { duration: 1.2, repeat: 2 } },
      sad:    { y: s * 0.03, scaleY: 0.93, rotate: [0, -4, 4, -3, 0], transition: { duration: 1.4 } },
      oops:   { rotate: [0, -14, 10, -6, 0], y: 0, scale: 1, transition: { duration: 0.8 } },
      wow:    { scaleY: [1, 1.2, 1], y: [0, -s * 0.1, 0], rotate: 0, transition: { duration: 0.6 } },
      sleep:  { scaleY: [1, 1.04, 1], y: 0, transition: { duration: 3.6, repeat: Infinity } },
    }
    // Upright first: 'happy' ends turned once round (360°), and an endless
    // idle that animated back to 0° spun the character on every loop
    if (shown !== 'hungry') controls.set({ rotate: 0 })
    controls.start(A[shown] ?? A.idle)
  }, [shown, size, flip, controls])

  // An animal that becomes happy (a right answer) makes its own
  // sound; not when it first appears already happy
  // (a figure that just appeared, like a guest sitting down, stays quiet)
  const seen = useRef(mood)
  const born = useRef(0)
  useEffect(() => { born.current = Date.now() }, [])
  useEffect(() => {
    const was = seen.current
    seen.current = mood
    if (!quiet && was !== mood && (mood === 'happy' || mood === 'dance') && Date.now() - born.current > 1500) playAnimal(art, { volume: 0.6 })
  }, [mood, art, quiet])

  const tap = e => {
    if (onTap) { playAnimal(art, { volume: 0.6 }); onTap(e); return }
    if (!playAnimal(art)) sfx.giggle()
    setTickle(t => t + 1)
    if (!reduceMotion()) controls.start({ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.08, 1], transition: { duration: 0.6 } })
      .then(() => { controls.set({ rotate: 0 }); controls.start({ y: [0, -size * 0.02, 0], transition: { duration: 2.6, repeat: Infinity } }) })
  }

  return (
    <div className="pl-critter" style={{ width: size, height: size, ...style }}>
      {shadow && <div aria-hidden="true" style={{ position: 'absolute', bottom: -size * 0.03, width: size * 0.6, height: size * 0.08, borderRadius: '50%', background: 'rgba(42,27,61,0.18)' }} />}
      <motion.button type="button" onClick={tap} aria-label={label} tabIndex={label ? 0 : -1}
        animate={controls}
        style={{ all: 'unset', position: 'relative', cursor: 'pointer', width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transformOrigin: '50% 100%' }}>
        <div style={{ width: '100%', height: '100%', transform: flip ? 'scaleX(-1)' : undefined, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <Art art={art} size={size} mood={shown} style={{ filter: mood === 'sad' && art !== 'lumi' ? 'saturate(0.55)' : undefined, transition: 'filter .4s' }} />
        </div>
        {accessory}
      </motion.button>
      {/* Lumi's sleeping picture has its own Zzz: a second one sat on top of it */}
      <MoodMark mood={art === 'lumi' && shown === 'sleep' ? 'idle' : shown} size={size} tickle={tickle} />
      {wish && <Wish side={wishSide} size={size} style={hatOn && wishSide === 'top' ? { marginBottom: size * 0.11 } : undefined}>{wish}</Wish>}
      {children}
    </div>
  )
}

/** Mood with automatic return to idle: setMood('happy') → idle after `ms`. */
export function useMood(initial = 'idle') {
  const [mood, set] = useState(initial)
  const t = useRef(null)
  useEffect(() => () => clearTimeout(t.current), [])
  const setMood = useCallback((m, ms = 1400) => {
    clearTimeout(t.current)
    set(m)
    if (m !== 'idle' && ms) t.current = setTimeout(() => set('idle'), ms)
  }, [])
  return [mood, setMood]
}

function useSpeaking(on) {
  const [v, setV] = useState(false)
  useEffect(() => (on ? onNarrationChange(setV) : undefined), [on])
  return on && v
}

// Little marks at the head: hearts, an exclamation mark, Zzz, crumbs, rain.
// Each says what the character feels; a miss ('oops') has none.
// They stay inside the character's own box, never above it: a game that
// clips its stage (Zahlen entdecken) cut off hearts above the head.
function MoodMark({ mood, size, tickle }) {
  const s = size
  return (
    <AnimatePresence>
      {mood === 'happy' || mood === 'dance' ? (
        <motion.div key={`h${tickle}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} exit={{ opacity: 0 }}>
          {[-0.3, 0, 0.3].map((dx, i) => (
            <motion.svg key={i} viewBox="-2 -2.5 24 22" width={s * 0.18} height={s * 0.16}
              initial={{ x: s * 0.41 + dx * s, y: s * 0.3, opacity: 0, scale: 0.5 }}
              animate={{ y: s * (0.1 - i * 0.035), opacity: [0, 1, 0], scale: 1 }}
              transition={{ duration: 1.2, delay: i * 0.12 }}
              style={{ position: 'absolute', left: 0, top: 0 }}>
              <path d="M10 17 C2 11 0 7 0 4.5 A4.5 4.5 0 0 1 10 3 A4.5 4.5 0 0 1 20 4.5 C20 7 18 11 10 17Z" fill="#ff5b8a" stroke="#2a1b3d" strokeWidth="1.5" />
            </motion.svg>
          ))}
        </motion.div>
      ) : mood === 'wow' ? (
        <motion.div key="w" initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          style={{ position: 'absolute', top: s * 0.01, right: s * 0.04, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: s * 0.3, color: '#ffc93c', WebkitTextStroke: '2px #2a1b3d', pointerEvents: 'none' }}>!</motion.div>
      ) : mood === 'sleep' ? (
        <motion.div key="z" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 1, 0.3], y: [0, -8, 0] }} transition={{ duration: 2.4, repeat: Infinity }} exit={{ opacity: 0 }}
          style={{ position: 'absolute', top: 0, right: 0, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: s * 0.18, color: '#4aa3ff', pointerEvents: 'none' }}>Zzz</motion.div>
      ) : mood === 'eat' ? (
        <motion.div key={`c${tickle}`} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} exit={{ opacity: 0 }}>
          {[0, 1, 2, 3, 4].map(i => (
            <motion.span key={i} initial={{ x: s * 0.5, y: s * 0.55, opacity: 1 }}
              animate={{ x: s * (0.5 + (i - 2) * 0.16), y: s * (0.35 + (i % 2) * 0.1), opacity: 0 }}
              transition={{ duration: 0.7, delay: 0.1 + i * 0.04 }}
              style={{ position: 'absolute', left: 0, top: 0, width: 8, height: 8, borderRadius: 2, background: ['#e8a85a', '#ffd34d', '#c98a52'][i % 3] }} />
          ))}
        </motion.div>
      ) : mood === 'sad' ? (
        <motion.svg key="r" viewBox="0 0 60 40" width={s * 0.45} height={s * 0.3} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
          style={{ position: 'absolute', top: -s * 0.04, left: s * 0.27, pointerEvents: 'none' }}>
          <ellipse cx="30" cy="12" rx="22" ry="10" fill="#b8c4d6" /><circle cx="18" cy="10" r="9" fill="#b8c4d6" /><circle cx="40" cy="9" r="8" fill="#b8c4d6" />
          {[18, 30, 42].map((x, i) => <motion.rect key={x} x={x} y="24" width="3" height="7" rx="1.5" fill="#4aa3ff" animate={{ y: [22, 34], opacity: [1, 0] }} transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.2 }} />)}
        </motion.svg>
      ) : null}
    </AnimatePresence>
  )
}

/** A speech bubble next to a character, holding pictures of what it wants. */
export function Wish({ children, side = 'top', size = 140, style }) {
  const pos = side === 'right'
    ? { left: '92%', bottom: '55%' }
    : side === 'left'
      ? { right: '92%', bottom: '55%' }
      : { left: '50%', bottom: '100%', x: '-50%' }
  const tail = side === 'right'
    ? { left: -12, bottom: 14, borderWidth: '10px 14px 10px 0', borderColor: 'transparent #2a1b3d transparent transparent' }
    : side === 'left'
      ? { right: -12, bottom: 14, borderWidth: '10px 0 10px 14px', borderColor: 'transparent transparent transparent #2a1b3d' }
      : { left: '50%', bottom: -13, marginLeft: -10, borderWidth: '13px 10px 0 10px', borderColor: '#2a1b3d transparent transparent transparent' }
  const { x, ...rest } = pos
  return (
    <motion.div initial={{ scale: 0, opacity: 0, x }} animate={{ scale: 1, opacity: 1, x }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
      style={{
        position: 'absolute', ...rest, marginBottom: side === 'top' ? size * 0.06 : 0, zIndex: 3,
        background: '#fffdf7', border: '3px solid #2a1b3d', borderRadius: 18, padding: '8px 12px',
        boxShadow: '0 5px 0 rgba(42,27,61,0.3)', display: 'flex', alignItems: 'center', gap: 6,
        whiteSpace: 'nowrap', width: 'max-content', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: Math.max(18, size * 0.16), color: '#2a1b3d',
        transformOrigin: side === 'right' ? '0% 100%' : side === 'left' ? '100% 100%' : '50% 100%', ...style,
      }}>
      {children}
      <span aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0, borderStyle: 'solid', ...tail }} />
    </motion.div>
  )
}
