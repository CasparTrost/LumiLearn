import { motion, AnimatePresence } from 'framer-motion'
import { reduceMotion } from './useRounds.js'

const INK = '#2a1b3d'

// Where the mouth sits on a letter whose middle is empty or off to a side
// (an L has its body on the left), as [x, y] shifts in letter sizes, and
// the thin letters that get a smaller mouth.
const MOUTH_AT = {
  L: [-0.11, 0.06], F: [-0.08, 0.04], E: [-0.05, 0], P: [-0.03, -0.1], J: [0.05, 0.04], T: [0, 0.06], Y: [0, 0.1], K: [-0.06, 0],
  b: [0.05, 0], d: [-0.05, 0], h: [0.02, 0.02], k: [-0.06, 0], l: [0, 0], r: [-0.06, 0], f: [-0.02, 0.02], t: [-0.02, 0.02], p: [0.04, -0.04], q: [-0.04, -0.04],
}
const THIN = new Set(['I', 'J', 'L', 'T', 'F', 'i', 'j', 'l', 't', 'f', 'r'])

/**
 * A letter that is a hungry monster (Buchstaben-Monster): the letter itself
 * is the body, with eyes on stalks, a big mouth and two feet.
 *
 * Moods: idle · talk (mouth moves) · hungry (mouth wide open, leans in) ·
 * eat (chomp chomp) · yuck (tongue out, shakes its head) · happy (jumps,
 * happy eyes) · burp · dance (three in a row, and the end of a level).
 *
 * The stalks meet behind the middle of the letter, so the eyes sit on any
 * letter, a wide M as well as a thin I or a small a.
 */
export default function LetterMonster({ letter, small, color, mood = 'idle', size = 260 }) {
  const s = size
  const lower = letter === letter.toLowerCase()
  const still = reduceMotion()
  // where the mouth sits: the middle of a capital, lower on a small letter
  const [dx, dy] = MOUTH_AT[letter] ?? [0, 0]
  const mouthTop = (lower ? 0.64 : 0.55) + dy
  const mw = THIN.has(letter) ? 0.26 : 0.36

  const body = still ? {} : {
    idle:   { y: [0, -s * 0.015, 0], scaleY: [1, 1.025, 1], rotate: 0, transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
    talk:   { y: [0, -s * 0.025, 0], rotate: [0, -2, 2, 0], transition: { duration: 0.45, repeat: Infinity } },
    hungry: { y: -s * 0.03, scale: 1.08, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 12 } },
    eat:    { scaleY: [1, 0.86, 1.08, 0.88, 1.04, 1], scaleX: [1, 1.1, 0.95, 1.08, 0.98, 1], y: 0, rotate: 0, transition: { duration: 0.8 } },
    yuck:   { rotate: [0, -9, 9, -7, 7, 0], y: 0, scale: 1, transition: { duration: 0.8 } },
    happy:  { y: [0, -s * 0.2, 0, -s * 0.06, 0], scaleY: [1, 1.1, 0.9, 1.04, 1], rotate: 0, scale: 1, transition: { duration: 1 } },
    burp:   { scale: [1, 1.12, 1], y: 0, rotate: 0, transition: { duration: 0.5 } },
    dance:  { rotate: [0, -12, 12, -12, 12, 0], y: [0, -s * 0.12, 0, -s * 0.12, 0, 0], scale: 1, transition: { duration: 1.3 } },
  }[mood] ?? {}

  const open = mood === 'hungry' || mood === 'dance' ? 1 : mood === 'eat' ? 0.7 : mood === 'burp' ? 0.8 : mood === 'talk' ? 0.45 : 0
  const mouthAnim = still ? { scaleY: open ? 1 : 0.25 }
    : mood === 'eat' ? { scaleY: [1, 0.15, 1, 0.15, 1, 0.25], transition: { duration: 0.8 } }
    : mood === 'talk' ? { scaleY: [0.25, 0.8, 0.3, 0.7, 0.25], transition: { duration: 0.6, repeat: Infinity } }
    : { scaleY: open ? 1 : 0.25, transition: { type: 'spring', stiffness: 400, damping: 15 } }
  const happyEyes = mood === 'happy' || mood === 'burp' || mood === 'dance'

  return (
    <motion.div animate={body} style={{ position: 'relative', width: s, height: s, transformOrigin: '50% 100%' }}>
      {/* feet */}
      {[-1, 1].map(d => (
        <div key={d} style={{
          position: 'absolute', bottom: 0, left: s * 0.5 + d * s * 0.14 - s * 0.09, width: s * 0.18, height: s * 0.09,
          borderRadius: '50% 50% 40% 40%', background: color, border: `4px solid ${INK}`, boxSizing: 'border-box',
          filter: 'brightness(0.85)',
        }} />
      ))}

      {/* eyes on stalks: drawn first, so the letter covers their ends */}
      <svg viewBox="0 0 100 100" width={s} height={s} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }} aria-hidden="true">
        {[-1, 1].map(d => (
          <g key={d}>
            <path d={`M${50 + d * 3} 50 Q${50 + d * 12} 30 ${50 + d * 15} 10`} stroke={INK} strokeWidth="6" fill="none" strokeLinecap="round" />
            <path d={`M${50 + d * 3} 50 Q${50 + d * 12} 30 ${50 + d * 15} 10`} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </svg>
      {[-1, 1].map(d => (
        <motion.div key={d}
          animate={still ? {} : { rotate: mood === 'yuck' ? [0, 20 * d, -10 * d, 0] : [0, 4 * d, 0, -3 * d, 0] }}
          transition={{ duration: mood === 'yuck' ? 0.6 : 3, repeat: mood === 'yuck' ? 0 : Infinity }}
          style={{
            position: 'absolute', left: s * (0.5 + d * 0.15) - s * 0.09, top: s * 0.01, width: s * 0.18, height: s * 0.18,
            borderRadius: '50%', background: '#fff', border: `4px solid ${INK}`, boxSizing: 'border-box', overflow: 'hidden',
          }}>
          {happyEyes
            ? <svg viewBox="0 0 20 20" width="100%" height="100%"><path d="M4 13 Q10 4 16 13" stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" /></svg>
            : mood === 'yuck'
              ? <svg viewBox="0 0 20 20" width="100%" height="100%"><path d={d < 0 ? 'M5 6 L15 10 L5 14' : 'M15 6 L5 10 L15 14'} stroke={INK} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              : <motion.div
                  animate={still ? {} : mood === 'hungry' ? { x: 0, y: s * 0.035 } : { x: [0, s * 0.02, 0, -s * 0.02, 0], y: [0, 0, s * 0.01, 0, 0] }}
                  transition={{ duration: mood === 'hungry' ? 0.2 : 4, repeat: mood === 'hungry' ? 0 : Infinity }}
                  style={{ position: 'absolute', left: '28%', top: '26%', width: '46%', height: '46%', borderRadius: '50%', background: INK }}>
                  <div style={{ position: 'absolute', left: '18%', top: '14%', width: '32%', height: '32%', borderRadius: '50%', background: '#fff' }} />
                </motion.div>}
        </motion.div>
      ))}

      {/* the letter is the body */}
      <div style={{
        position: 'absolute', left: 0, right: 0, top: s * 0.1, height: s * 0.9, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: s * 0.92, lineHeight: 1, color,
        WebkitTextStroke: `${Math.max(5, s * 0.025)}px ${INK}`, paintOrder: 'stroke fill', userSelect: 'none',
        filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.3))',
      }}>{letter}</div>

      {/* mouth */}
      <motion.div animate={mouthAnim} style={{
        position: 'absolute', left: s * (0.5 + dx), top: s * mouthTop, width: s * mw, height: s * 0.24, marginLeft: -s * mw / 2, marginTop: -s * 0.12,
        borderRadius: '45% 45% 50% 50%', background: '#5a1830', border: `4px solid ${INK}`, boxSizing: 'border-box', overflow: 'hidden',
        transformOrigin: '50% 30%',
      }}>
        {/* teeth */}
        <div style={{ position: 'absolute', top: -2, left: '18%', width: '20%', height: '26%', background: '#fff', borderRadius: '0 0 6px 6px', borderBottom: `2px solid ${INK}` }} />
        <div style={{ position: 'absolute', top: -2, right: '18%', width: '20%', height: '26%', background: '#fff', borderRadius: '0 0 6px 6px', borderBottom: `2px solid ${INK}` }} />
        {/* tongue */}
        <div style={{ position: 'absolute', bottom: -s * 0.03, left: '25%', width: '50%', height: '50%', borderRadius: '50% 50% 40% 40%', background: '#ff7a9a' }} />
      </motion.div>
      {/* tongue out: bäh! */}
      <AnimatePresence>
        {mood === 'yuck' && (
          <motion.div key="t" initial={{ scaleY: 0 }} animate={{ scaleY: 1 }} exit={{ scaleY: 0 }}
            style={{
              position: 'absolute', left: s * (0.5 + dx), top: s * (mouthTop + 0.04), width: s * 0.14, height: s * 0.16, marginLeft: -s * 0.07,
              background: '#ff7a9a', border: `4px solid ${INK}`, borderTop: 'none', borderRadius: '0 0 50% 50%', transformOrigin: '50% 0',
            }} />
        )}
      </AnimatePresence>

      {/* the other case, on a little name tag */}
      {small && (
        <div style={{
          position: 'absolute', right: -s * 0.02, bottom: s * 0.02, padding: `2px ${s * 0.04}px`, borderRadius: 10,
          background: '#fffdf7', border: `3px solid ${INK}`, boxShadow: '0 3px 0 rgba(42,27,61,0.3)',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: s * 0.14, color, lineHeight: 1.1,
          WebkitTextStroke: `1.5px ${INK}`, paintOrder: 'stroke fill',
        }}>{small}</div>
      )}
    </motion.div>
  )
}
