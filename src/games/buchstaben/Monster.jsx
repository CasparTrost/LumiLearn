import { motion, useTransform, useMotionValue } from 'framer-motion'

const INK = '#2a1b3d'
const CREAM = '#fffdf7'
const REST = { x: 0, y: 0, rotate: 0, scaleX: 1, scaleY: 1 }

/**
 * The letter monster of Monster-Mampf: a round, hungry thing with its
 * letter big on the belly, eyes on stalks and a mouth that is open as long
 * as it is hungry.
 *
 *   mood   walk   it waddles in, mouth shut
 *          hungry mouth open, breathing (the default)
 *          beg    hops, mouth wide: something is on its way, or "give it to me!"
 *          eat    chomp, chomp
 *          yuck   shakes itself, tongue out: bäh!
 *          full   pats the full belly, happy eyes
 *          burp   a round mouth, the bubbles come from the game
 *          dance  a short dance (a streak, the end of the level: `party`)
 *   look   { x, y } motion values from -1 to 1: where the pupils look.
 *          The game points them at the nearest thing that fits.
 *   tag    the other case of the letter, on a little sign
 *   ghost  only the outline: a free place in the row
 *
 * Drawn 120 × 132 (mampf.js: MONSTER_RATIO, MOUTH_Y); `width` scales it.
 */
export default function Monster({ letter, tag = null, color = '#3aa845', width = 160, mood = 'hungry', look, still = false, ghost = false, party = false }) {
  const w = width, h = (width * 132) / 120
  const zero = useMotionValue(0)
  const px = useTransform(look?.x ?? zero, v => v * 4.2)
  const py = useTransform(look?.y ?? zero, v => v * 4.2)

  if (ghost) {
    return (
      <svg viewBox="0 0 120 132" width={w} height={h} aria-hidden="true" style={{ display: 'block' }}>
        <path d={BODY} fill="rgba(255,253,247,0.35)" stroke={INK} strokeOpacity="0.45" strokeWidth="4" strokeDasharray="7 7" strokeLinecap="round" />
      </svg>
    )
  }

  const body = still ? REST : ({
    walk:   { ...REST, rotate: [0, -6, 6, -6, 6, 0], y: [0, -5, 0, -5, 0, 0], transition: { duration: 0.9 } },
    hungry: { ...REST, scaleY: [1, 1.035, 1], transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } },
    beg:    { ...REST, y: [0, -w * 0.07, 0], scaleY: [1, 1.06, 0.97], transition: { duration: 0.46, repeat: Infinity } },
    eat:    { ...REST, scaleY: [1, 0.86, 1.08, 0.9, 1.03, 1], scaleX: [1, 1.1, 0.95, 1.07, 0.99, 1], transition: { duration: 0.6 } },
    yuck:   { ...REST, rotate: [0, -11, 10, -8, 6, 0], x: [0, -5, 5, -3, 2, 0], transition: { duration: 0.7 } },
    full:   { ...REST, scaleX: [1, 1.09, 1], scaleY: [1, 0.93, 1], transition: { duration: 0.6 } },
    burp:   { ...REST, scaleX: [1, 1.1, 1], scaleY: [1, 1.1, 1], y: [0, -w * 0.04, 0], transition: { duration: 0.5 } },
    dance:  { ...REST, rotate: [0, -10, 10, -10, 10, 0], y: [0, -w * 0.12, 0, -w * 0.12, 0, 0], transition: { duration: 1.1, repeat: party ? Infinity : 0 } },
  })[mood] ?? REST

  const shut = mood === 'walk' || mood === 'full' || mood === 'dance'
  const glad = mood === 'full' || mood === 'burp' || mood === 'dance'
  const yuck = mood === 'yuck'
  const mouth = still ? { scaleY: 1, scaleX: 1 }
    : mood === 'eat' ? { scaleX: 1, scaleY: [1, 0.12, 1, 0.12, 0.9, 1], transition: { duration: 0.6 } }
    : mood === 'beg' ? { scaleX: 1.12, scaleY: 1.22, transition: { type: 'spring', stiffness: 400, damping: 12 } }
    : mood === 'burp' ? { scaleX: 0.62, scaleY: 1.05, transition: { type: 'spring', stiffness: 400, damping: 12 } }
    : mood === 'yuck' ? { scaleX: 0.9, scaleY: 0.8, transition: { duration: 0.15 } }
    : { scaleX: 1, scaleY: [1, 1.1, 1], transition: { duration: 2.2, repeat: Infinity, ease: 'easeInOut' } }
  const lower = letter && letter === letter.toLowerCase() && letter !== letter.toUpperCase()

  return (
    <motion.div animate={body} style={{ width: w, height: h, transformOrigin: '50% 100%' }}>
      <svg viewBox="0 0 120 132" width={w} height={h} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
        <ellipse cx="60" cy="128" rx="38" ry="4" fill="rgba(42,27,61,0.22)" />
        {/* feet */}
        {[42, 78].map(x => (
          <g key={x}>
            <ellipse cx={x} cy="125" rx="14" ry="6.5" fill={color} stroke={INK} strokeWidth="3" />
            <ellipse cx={x} cy="125" rx="14" ry="6.5" fill={INK} opacity="0.2" />
          </g>
        ))}
        {/* arms, up in the air */}
        {[-1, 1].map(d => (
          <g key={d}>
            <path d={`M${60 + d * 44} 88 q${d * 13} -6 ${d * 10} -24`} fill="none" stroke={INK} strokeWidth="10" strokeLinecap="round" />
            <path d={`M${60 + d * 44} 88 q${d * 13} -6 ${d * 10} -24`} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" />
          </g>
        ))}
        {/* eye stalks: drawn first, so the body covers their ends */}
        {[-1, 1].map(d => (
          <g key={d}>
            <path d={`M${60 + d * 13} 44 Q${60 + d * 19} 32 ${60 + d * 22} 20`} fill="none" stroke={INK} strokeWidth="9" strokeLinecap="round" />
            <path d={`M${60 + d * 13} 44 Q${60 + d * 19} 32 ${60 + d * 22} 20`} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
        <path d={BODY} fill={color} stroke={INK} strokeWidth="3.5" />
        {/* a lighter top and a few freckles */}
        <path d="M30 60 Q36 44 54 41" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="5" strokeLinecap="round" />
        <circle cx="22" cy="92" r="3.5" fill={INK} opacity="0.16" />
        <circle cx="98" cy="84" r="4.5" fill={INK} opacity="0.16" />
        <circle cx="94" cy="110" r="3" fill={INK} opacity="0.16" />

        {/* belly with the letter */}
        <ellipse cx="60" cy="99" rx="31" ry="24" fill={CREAM} stroke={INK} strokeWidth="2.5" />
        <text x="60" y={lower ? 97.5 : 100} textAnchor="middle" dominantBaseline="central"
          style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 40, fill: INK, userSelect: 'none' }}>{letter}</text>

        {/* mouth */}
        {shut
          ? <path d="M42 54 Q60 70 78 54" fill="none" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          : (
            <motion.g animate={mouth}>
              <ellipse cx="60" cy="56" rx="25" ry="15" fill="#5a1830" stroke={INK} strokeWidth="3" />
              <ellipse cx="60" cy="65" rx="12" ry="5.5" fill="#ff7a9a" />
              <path d="M45 46.5 h9 v5 q-4.5 3 -9 0 z M66 46.5 h9 v5 q-4.5 3 -9 0 z" fill="#fff" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
            </motion.g>
          )}
        {/* bäh: the tongue hangs out */}
        {yuck && <path d="M53 66 h14 v11 a7 7 0 0 1 -14 0 z" fill="#ff7a9a" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />}

        {/* eyes */}
        {[-1, 1].map(d => {
          const cx = 60 + d * 22, cy = 15
          return (
            <g key={d}>
              <circle cx={cx} cy={cy} r="11.5" fill="#fff" stroke={INK} strokeWidth="3" />
              {glad ? <path d={`M${cx - 6} ${cy + 2} Q${cx} ${cy - 7} ${cx + 6} ${cy + 2}`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
                : yuck ? <path d={`M${cx - d * 5} ${cy - 5} L${cx + d * 4} ${cy} L${cx - d * 5} ${cy + 5}`} fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                : (
                  <motion.g style={{ x: px, y: py }}>
                    <circle cx={cx} cy={cy} r="5.2" fill={INK} />
                    <circle cx={cx - 1.6} cy={cy - 1.8} r="1.7" fill="#fff" />
                  </motion.g>
                )}
            </g>
          )
        })}

        {/* the other case, on a little sign */}
        {tag && (
          <g>
            <rect x="88" y="100" width="26" height="24" rx="7" fill={CREAM} stroke={INK} strokeWidth="2.5" />
            <text x="101" y="113" textAnchor="middle" dominantBaseline="central"
              style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 18, fill: color, stroke: INK, strokeWidth: 0.8 }}>{tag}</text>
          </g>
        )}
      </svg>
    </motion.div>
  )
}

const BODY = 'M60 36 C92 36 108 62 108 90 C108 114 90 126 60 126 C30 126 12 114 12 90 C12 62 28 36 60 36 Z'

/** A balloon with its string, `w` wide; the thing hangs right below it. */
export function Balloon({ w, h, str, tint }) {
  return (
    <svg viewBox={`0 0 40 ${48 + (str / h) * 48}`} width={w} height={h + str} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <line x1="20" y1="46" x2="20" y2={48 + (str / h) * 48} stroke={INK} strokeWidth="1.8" />
      <ellipse cx="20" cy="21" rx="17.5" ry="20" fill={tint} stroke={INK} strokeWidth="2.6" />
      <path d="M17 41 h6 l-3 -3.5 z" fill={tint} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M9 19 A11 13 0 0 1 17 7" fill="none" stroke="#fff" strokeOpacity="0.85" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
