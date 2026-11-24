import { motion, AnimatePresence } from 'framer-motion'
import { Art } from '../../components/play/index.js'

/**
 * A basket monster for "Wer will was?" (SortGame): a woven basket with a
 * face and feet that collects one kind of thing. Its sign says what (a
 * picture and a word); what it got peeks out over the rim, so the child
 * sees the group grow. It opens its mouth when something is held over it,
 * grins when it gets the right thing, and pulls a face ("Bäh!") at the
 * wrong one.
 *
 *   <Korbmonster width={200} tint={{ bg, ring }} sign={{ emoji, label }}
 *     (or sign={{ emoji, cross: true }} for "not this", sign={{ colors }})
 *     items={[{ id, emoji }]} mood="idle" look={0} />
 *
 * Without `sign` it collects whatever the child decides.
 * Moods: idle · hungry · happy · bah · burp · point (look, it is me!) · dance
 * `renderItem` lets a game wrap the things in the basket (the free sorting
 * round makes them draggable again).
 */
const INK = '#2a1b3d'
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Where the things in the basket sit: x across the rim (0..1), how far up
const PILE = [[0.5, 0], [0.26, 0.06], [0.74, 0.06], [0.38, -0.2], [0.62, -0.2], [0.5, -0.36]]

const MOTION = {
  idle:   { y: [0, -3, 0], rotate: 0, scale: 1, transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } },
  hungry: { y: -6, rotate: 0, scale: 1.08, transition: { type: 'spring', stiffness: 320, damping: 14 } },
  happy:  { y: [0, -28, 0, -10, 0], rotate: [0, -6, 6, 0, 0], scale: 1, transition: { duration: 0.8 } },
  bah:    { x: [0, -10, 10, -8, 8, 0], rotate: [0, -5, 5, -3, 0], y: 0, scale: 1, transition: { duration: 0.6 } },
  burp:   { scaleY: [1, 0.86, 1.12, 1], scaleX: [1, 1.1, 0.95, 1], y: 0, transition: { duration: 0.6 } },
  point:  { y: [0, -18, 0, -18, 0], scale: [1, 1.06, 1, 1.06, 1], rotate: 0, transition: { duration: 1.1 } },
  dance:  { rotate: [0, -10, 10, -10, 10, 0], y: [0, -14, 0, -14, 0, 0], scale: 1, transition: { duration: 1.1, repeat: 2 } },
}

export default function Korbmonster({ width = 200, tint, sign, items = [], mood = 'idle', look = 0, renderItem }) {
  const W = width
  const signH = W * 0.3
  const H = signH + W * 0.98
  const rimY = signH + W * 0.35      // the rim of the basket on screen
  const s = W * 0.3                  // a thing in the basket
  const id = `km-${look}-${tint.ring.slice(1)}`
  const glow = mood === 'point'

  return (
    <motion.div animate={reduceMotion() ? undefined : MOTION[mood] ?? MOTION.idle}
      style={{ position: 'relative', width: W, height: H, transformOrigin: '50% 100%' }}>
      {/* the sign on its stick: what this monster collects (the board is
          drawn last, so a full basket never hides it) */}
      {sign && <div style={{ position: 'absolute', left: W * 0.5 - 3, top: signH * 0.8, width: 6, height: W * 0.36, background: '#8a4f22', border: `2px solid ${INK}`, borderRadius: 3 }} />}
      {/* inside of the basket, behind what it holds */}
      <svg viewBox="0 0 200 196" width={W} height={W * 0.98} style={{ position: 'absolute', left: 0, top: signH, overflow: 'visible' }} aria-hidden="true">
        <ellipse cx="100" cy="70" rx="72" ry="17" fill="#3b2a4f" />
      </svg>

      {/* what it got, peeking out over the rim */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: renderItem ? 'auto' : 'none' }}>
        <AnimatePresence>
          {items.map((it, i) => {
            const [u, up] = PILE[i % PILE.length]
            return (
              <motion.div key={it.id} initial={{ scale: 0, y: -40 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 16 }}
                style={{ position: 'absolute', left: W * (0.14 + u * 0.72) - s / 2, top: rimY - s * 0.72 + up * W, width: s, height: s }}>
                {renderItem ? renderItem(it, s) : <Art art={it.emoji} size={s} />}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      {/* the basket itself, with its face */}
      <svg viewBox="0 0 200 196" width={W} height={W * 0.98} style={{ position: 'absolute', left: 0, top: signH, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true">
        <defs>
          <pattern id={id} width="20" height="14" patternUnits="userSpaceOnUse">
            <rect width="20" height="14" fill={tint.ring} />
            <rect width="20" height="7" fill="#fff" opacity="0.16" />
            <line x1="10" y1="0" x2="10" y2="7" stroke={INK} strokeOpacity="0.22" strokeWidth="2" />
            <line x1="0" y1="7" x2="0" y2="14" stroke={INK} strokeOpacity="0.22" strokeWidth="2" />
          </pattern>
        </defs>
        {/* feet */}
        <ellipse cx="66" cy="184" rx="20" ry="10" fill="#ffb347" stroke={INK} strokeWidth="3" />
        <ellipse cx="134" cy="184" rx="20" ry="10" fill="#ffb347" stroke={INK} strokeWidth="3" />
        {/* body and the front of the rim */}
        <path d="M26 70 Q28 164 52 178 L148 178 Q172 164 174 70 A74 17 0 0 1 26 70 Z" fill={`url(#${id})`} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
        <path d="M26 70 A74 17 0 0 0 174 70" fill="none" stroke={tint.bg} strokeWidth="9" />
        <path d="M22 70 A78 21 0 0 0 178 70" fill="none" stroke={INK} strokeWidth="3" />
        {/* face plate, so the face reads on any weave */}
        <ellipse cx="100" cy="124" rx="58" ry="40" fill={tint.bg} stroke={INK} strokeWidth="3" />
        <Face mood={mood} look={look} />
        {look === 1 && (
          <g transform="translate(160 66) rotate(18)">
            <path d="M0 0 L-16 -10 L-16 10 Z M0 0 L16 -10 L16 10 Z" fill="#ff5b8a" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <circle r="5" fill="#ff5b8a" stroke={INK} strokeWidth="3" />
          </g>
        )}
        {look === 2 && (
          <g transform="translate(36 64) rotate(-24)">
            <ellipse cx="0" cy="-12" rx="7" ry="15" fill="#5cc45a" stroke={INK} strokeWidth="3" />
            <ellipse cx="12" cy="-6" rx="6" ry="12" fill="#5cc45a" stroke={INK} strokeWidth="3" transform="rotate(40 12 -6)" />
          </g>
        )}
      </svg>

      {/* the sign's board */}
      {sign && (
        <motion.div initial={{ scale: 0 }} animate={glow ? { scale: [1, 1.15, 1, 1.15, 1] } : { scale: 1 }}
          transition={glow ? { duration: 1.1 } : { type: 'spring', stiffness: 380, damping: 16 }}
          style={{
            position: 'absolute', left: '50%', top: 0, x: '-50%', height: signH, maxWidth: W * 1.04, boxSizing: 'border-box',
            display: 'flex', alignItems: 'center', gap: W * 0.03, padding: `0 ${W * 0.05}px`,
            background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 14,
            boxShadow: glow ? `0 0 0 5px ${tint.ring}, 0 4px 0 rgba(42,27,61,0.3)` : '0 4px 0 rgba(42,27,61,0.3)',
            fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: Math.max(13, W * 0.1), lineHeight: 1.05, color: INK,
            whiteSpace: 'nowrap', transition: 'box-shadow .2s',
          }}>
          <SignPicture sign={sign} size={signH * 0.72} />
          {sign.label && W >= 130 && <span style={{ whiteSpace: 'normal', textAlign: 'center' }}>{sign.label}</span>}
        </motion.div>
      )}

      {/* "Bäh!" or a burp, from its mouth */}
      <AnimatePresence>
        {(mood === 'bah' || mood === 'burp') && (
          <motion.div key={mood} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0 }}
            style={{
              position: 'absolute', right: -W * 0.08, top: signH + W * 0.36, padding: '4px 10px',
              background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 14, boxShadow: '0 3px 0 rgba(42,27,61,0.3)',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: Math.max(16, W * 0.12), color: INK, pointerEvents: 'none',
            }}>
            {mood === 'bah' ? 'Bäh!' : 'Rülps!'}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// The picture on a sign: a thing (crossed out for "not this"), or colours
function SignPicture({ sign, size }) {
  if (sign.colors) return (
    <span style={{ display: 'flex', gap: size * 0.08 }}>
      {sign.colors.map(c => <span key={c} style={{ width: size * 0.62, height: size * 0.62, borderRadius: '50%', background: c, border: `3px solid ${INK}` }} />)}
    </span>
  )
  return (
    <span style={{ position: 'relative', display: 'flex' }}>
      <Art art={sign.emoji} size={size} style={sign.cross ? { opacity: 0.55 } : undefined} />
      {sign.cross && (
        <svg viewBox="0 0 20 20" width={size} height={size} style={{ position: 'absolute', inset: 0 }} aria-hidden="true">
          <path d="M3 17 L17 3" stroke={INK} strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      )}
    </span>
  )
}

// Eyes and mouth for each mood
function Face({ mood, look }) {
  const shut = mood === 'happy' || mood === 'dance'
  const squeeze = mood === 'bah'
  const big = mood === 'hungry' || mood === 'point'
  return (
    <g>
      {[72, 128].map((x, i) => (
        <g key={x}>
          {shut ? (
            <path d={`M${x - 12} 112 Q${x} 98 ${x + 12} 112`} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" />
          ) : squeeze ? (
            <path d={i ? `M${x + 10} 100 L${x - 8} 108 L${x + 10} 116` : `M${x - 10} 100 L${x + 8} 108 L${x - 10} 116`} fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <g className="pl-blink">
              <ellipse cx={x} cy="106" rx={big ? 17 : 15} ry={big ? 19 : 17} fill="#fff" stroke={INK} strokeWidth="3" />
              <circle cx={x + (i ? -2 : 2)} cy={big ? 112 : 110} r={big ? 9 : 7} fill={INK} />
              <circle cx={x + (i ? -4 : 0)} cy={big ? 108 : 107} r="2.5" fill="#fff" />
              {look === 1 && <path d={`M${x - 14} 92 l-5 -6 M${x} 88 l0 -7 M${x + 14} 92 l5 -6`} stroke={INK} strokeWidth="3" strokeLinecap="round" />}
            </g>
          )}
        </g>
      ))}
      <circle cx="52" cy="132" r="8" fill="#ff8fb8" opacity="0.7" />
      <circle cx="148" cy="132" r="8" fill="#ff8fb8" opacity="0.7" />
      {mood === 'hungry' || mood === 'point' ? (
        <g>
          <ellipse cx="100" cy="142" rx="20" ry="16" fill="#5a1f2e" stroke={INK} strokeWidth="3" />
          <ellipse cx="100" cy="151" rx="11" ry="6" fill="#ff6b81" />
        </g>
      ) : shut ? (
        <g>
          <path d="M74 132 Q100 166 126 132 Z" fill="#5a1f2e" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
          <path d="M88 150 Q100 158 112 150 Q100 146 88 150" fill="#ff6b81" />
        </g>
      ) : squeeze ? (
        <g>
          <path d="M80 140 Q88 134 96 140 Q104 146 112 140 Q118 136 122 140" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path d="M96 141 Q100 160 108 158 Q114 150 110 142" fill="#ff6b81" stroke={INK} strokeWidth="3" />
        </g>
      ) : mood === 'burp' ? (
        <ellipse cx="100" cy="142" rx="9" ry="8" fill="#5a1f2e" stroke={INK} strokeWidth="3" />
      ) : (
        <path d="M84 136 Q100 150 116 136" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
      )}
    </g>
  )
}
