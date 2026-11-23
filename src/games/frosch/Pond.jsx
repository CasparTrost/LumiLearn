import { motion } from 'framer-motion'
import { INK } from '../px.js'
import './frosch.css'

// Frosch-Hüpfen: the pieces of the pond — lily pads, the water, a splash.

/**
 * A lily pad, round with its notch. With `text` it is a syllable stone the
 * child lays; `empty` is a place still waiting for one (dashed ring);
 * `sunk` lets it dip under after the frog jumped on a pad too many.
 */
export function Pad({ w = 72, h = w * 0.62, text, empty = false, glow = false, sunk = false, flower = false, dim = false }) {
  return (
    <motion.div
      animate={sunk ? { y: 10, scale: 0.6, opacity: 0.2 } : { y: 0, scale: 1, opacity: dim ? 0.45 : 1 }}
      transition={{ duration: 0.4 }}
      style={{ position: 'relative', width: w, height: h, flexShrink: 0 }}>
      <svg viewBox="0 0 100 62" width={w} height={h} aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {empty
          ? <ellipse cx={50} cy={31} rx={47} ry={28} fill="rgba(255,253,247,0.25)" stroke="#fffdf7" strokeWidth={3.5} strokeDasharray="8 7" />
          : <>
              <ellipse cx={50} cy={35} rx={48} ry={27} fill="#2f8f3a" opacity={0.45} />
              <path d="M50 31 L64 5 A47 28 0 1 1 36 5 Z" fill={glow ? '#ffd34d' : '#7ccf5a'} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
              <path d="M50 31 L22 44 M50 31 L78 44 M50 31 L50 56" stroke="#4f9e3a" strokeWidth={2.5} strokeLinecap="round" opacity={text ? 0.25 : 0.8} />
              {flower && <g transform="translate(76 14)">
                {[0, 72, 144, 216, 288].map(a => <ellipse key={a} cx={0} cy={-7} rx={4.5} ry={8} fill="#ff8fb8" stroke={INK} strokeWidth={1.5} transform={`rotate(${a})`} />)}
                <circle r={4} fill="#ffd34d" stroke={INK} strokeWidth={1.5} />
              </g>}
            </>}
      </svg>
      {text && (
        <span style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: h * 0.08,
          fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: Math.min(28, h * 0.42, (w * 1.5) / Math.max(2.5, text.length)),
          color: INK, letterSpacing: 1, textShadow: '0 2px 0 rgba(255,255,255,0.5)', whiteSpace: 'nowrap',
        }}>{text}</span>
      )}
    </motion.div>
  )
}

/** The pond: water with gentle waves, banks of grass at both ends. */
export function Water({ children, style }) {
  return (
    <div style={{
      position: 'relative', borderRadius: 40, border: `4px solid ${INK}`, overflow: 'hidden',
      background: 'linear-gradient(180deg, #5ec4f0 0%, #3aa2dc 100%)',
      boxShadow: 'inset 0 8px 0 rgba(255,255,255,0.25), 0 6px 0 rgba(42,27,61,0.3)', containerType: 'inline-size', ...style,
    }}>
      <svg className="fr-wave" aria-hidden="true" viewBox="0 0 400 100" preserveAspectRatio="none"
        style={{ position: 'absolute', left: 0, top: 0, width: 'calc(100% + 24px)', height: '100%', pointerEvents: 'none' }}>
        {[22, 50, 78].map((y, i) => (
          <path key={y} d={`M0 ${y} q 20 -8 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`}
            fill="none" stroke="#fff" strokeOpacity={0.25 - i * 0.05} strokeWidth={3} />
        ))}
      </svg>
      {children}
    </div>
  )
}

/** A bank of grass at one end of the pond. */
export function Bank({ side, width, children }) {
  return (
    <div style={{
      position: 'absolute', top: 0, bottom: 0, [side]: 0, width, zIndex: 1,
      background: 'linear-gradient(180deg, #8bd65e, #5cb23e)',
      borderRadius: side === 'left' ? '0 46% 46% 0 / 0 30% 30% 0' : '46% 0 0 46% / 30% 0 0 30%',
      [side === 'left' ? 'borderRight' : 'borderLeft']: `4px solid ${INK}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</div>
  )
}

/** Splash: a ring and drops where the frog went in. */
export function Splash({ x, y }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, zIndex: 6, pointerEvents: 'none' }}>
      <motion.div initial={{ scale: 0.3, opacity: 0.9 }} animate={{ scale: 2.2, opacity: 0 }} transition={{ duration: 0.9 }}
        style={{ position: 'absolute', left: -30, top: -14, width: 60, height: 28, borderRadius: '50%', border: '4px solid #fff' }} />
      {[-3, -2, -1, 0, 1, 2, 3].map(i => (
        <motion.div key={i} initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: i * 16, y: [0, -50 - Math.abs(3 - Math.abs(i)) * 12, 10], opacity: [1, 1, 0] }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ position: 'absolute', left: -6, top: -6, width: 12, height: 14, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: '#dff4ff', border: '2px solid #2a7fc0' }} />
      ))}
    </div>
  )
}
