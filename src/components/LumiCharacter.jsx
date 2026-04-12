import { motion } from 'framer-motion'

const moodColors = {
  idle:        { body: '#FFD93D', ear: '#FFC300', cheek: null },
  happy:       { body: '#4ECDC4', ear: '#38B2AC', cheek: '#FF8FAB' },
  excited:     { body: '#FFD93D', ear: '#FFC300', cheek: '#FF6B9D' },
  thinking:    { body: '#A78BFA', ear: '#8B5CF6', cheek: null },
  encouraging: { body: '#6BCB77', ear: '#48BB78', cheek: '#FF8FAB' },
  sleepy:      { body: '#74B9FF', ear: '#4C8DCC', cheek: null },
}

export default function LumiCharacter({ mood = 'happy', size = 120 }) {
  const colors = moodColors[mood] ?? moodColors.happy
  const s = size
  const cx = s / 2
  const cy = s / 2
  const r = s * 0.36

  const bobAnim = {
    y: [0, -s * 0.05, 0],
    transition: {
      duration: mood === 'excited' ? 0.7 : 2.2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  }

  const glowAnim = {
    scale: [1, 1.08, 1],
    opacity: [0.35, 0.55, 0.35],
    transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' },
  }

  const blinkAnim = {
    scaleY: [1, 1, 0.08, 1, 1],
    transition: {
      duration: 3.5,
      repeat: Infinity,
      times: [0, 0.88, 0.9, 0.92, 1],
      ease: 'easeInOut',
    },
  }

  // mouth path: smile or sleepy line
  let mouthPath
  if (mood === 'sleepy') {
    mouthPath = `M ${cx - r * 0.28} ${cy + r * 0.35} Q ${cx} ${cy + r * 0.42} ${cx + r * 0.28} ${cy + r * 0.35}`
  } else if (mood === 'thinking') {
    mouthPath = `M ${cx - r * 0.25} ${cy + r * 0.38} Q ${cx + r * 0.1} ${cy + r * 0.32} ${cx + r * 0.3} ${cy + r * 0.4}`
  } else {
    mouthPath = `M ${cx - r * 0.32} ${cy + r * 0.28} Q ${cx} ${cy + r * 0.58} ${cx + r * 0.32} ${cy + r * 0.28}`
  }

  return (
    <motion.div animate={bobAnim} style={{ display: 'inline-block', width: s, height: s }}>
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} overflow="visible">
        {/* Glow */}
        <motion.circle
          cx={cx} cy={cy} r={r * 1.35}
          fill={colors.body}
          opacity={0.35}
          animate={glowAnim}
          style={{ originX: '50%', originY: '50%' }}
          filter="url(#blur)"
        />
        <defs>
          <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={s * 0.06} />
          </filter>
        </defs>

        {/* Left ear */}
        <ellipse cx={cx - r * 0.78} cy={cy - r * 0.55} rx={r * 0.22} ry={r * 0.3} fill={colors.ear} />
        <ellipse cx={cx - r * 0.78} cy={cy - r * 0.55} rx={r * 0.12} ry={r * 0.18} fill="#FFE0E0" opacity={0.6} />
        {/* Right ear */}
        <ellipse cx={cx + r * 0.78} cy={cy - r * 0.55} rx={r * 0.22} ry={r * 0.3} fill={colors.ear} />
        <ellipse cx={cx + r * 0.78} cy={cy - r * 0.55} rx={r * 0.12} ry={r * 0.18} fill="#FFE0E0" opacity={0.6} />

        {/* Body */}
        <ellipse cx={cx} cy={cy} rx={r} ry={r * 1.05}
          fill={colors.body}
          stroke="white" strokeWidth={s * 0.022}
        />
        {/* Sheen */}
        <ellipse cx={cx - r * 0.2} cy={cy - r * 0.35} rx={r * 0.28} ry={r * 0.2}
          fill="white" opacity={0.22} transform={`rotate(-20, ${cx}, ${cy})`}
        />

        {/* Cheeks */}
        {colors.cheek && <>
          <circle cx={cx - r * 0.55} cy={cy + r * 0.18} r={r * 0.2} fill={colors.cheek} opacity={0.45} />
          <circle cx={cx + r * 0.55} cy={cy + r * 0.18} r={r * 0.2} fill={colors.cheek} opacity={0.45} />
        </>}

        {/* Left eye — translate wrapper so scaleY origin = eye center */}
        <g transform={`translate(${cx - r * 0.3}, ${cy - r * 0.05})`}>
          <motion.g animate={blinkAnim}>
            <circle cx={0} cy={0} r={r * 0.16} fill="white" />
            <circle cx={r * 0.04} cy={0} r={r * 0.1} fill="#1A1040" />
            <circle cx={r * 0.09} cy={-r * 0.03} r={r * 0.04} fill="white" />
          </motion.g>
        </g>
        {/* Right eye — translate wrapper so scaleY origin = eye center */}
        <g transform={`translate(${cx + r * 0.3}, ${cy - r * 0.05})`}>
          <motion.g animate={blinkAnim}>
            <circle cx={0} cy={0} r={r * 0.16} fill="white" />
            <circle cx={r * 0.04} cy={0} r={r * 0.1} fill="#1A1040" />
            <circle cx={r * 0.09} cy={-r * 0.03} r={r * 0.04} fill="white" />
          </motion.g>
        </g>

        {/* Sleeping eyes */}
        {mood === 'sleepy' && <>
          <path d={`M ${cx - r*0.46} ${cy - r*0.09} Q ${cx - r*0.3} ${cy - r*0.2} ${cx - r*0.14} ${cy - r*0.09}`}
            stroke="#1A1040" strokeWidth={s*0.025} fill="none" strokeLinecap="round" />
          <path d={`M ${cx + r*0.14} ${cy - r*0.09} Q ${cx + r*0.3} ${cy - r*0.2} ${cx + r*0.46} ${cy - r*0.09}`}
            stroke="#1A1040" strokeWidth={s*0.025} fill="none" strokeLinecap="round" />
        </>}

        {/* Mouth */}
        <path d={mouthPath}
          stroke="#1A1040" strokeWidth={s * 0.028} fill="none"
          strokeLinecap="round"
        />
        {/* Teeth for big smile */}
        {(mood === 'happy' || mood === 'excited' || mood === 'encouraging') && (
          <path d={`M ${cx - r*0.18} ${cy + r*0.36} L ${cx - r*0.18} ${cy + r*0.44} L ${cx} ${cy + r*0.44} L ${cx} ${cy + r*0.36}`}
            fill="white" stroke="none"
          />
        )}

        {/* Sparkles for excited */}
        {mood === 'excited' && (
          <g>
            {[[cx + r*1.1, cy - r*0.9, 0.9], [cx - r*1.0, cy - r*0.7, 0.7], [cx + r*0.8, cy + r*0.9, 0.8]].map(([sx, sy, sc], i) => (
              <motion.text key={i} x={sx} y={sy} fontSize={s*0.2*sc} textAnchor="middle"
                animate={{ rotate: [0, 20, -20, 0], scale: [1, 1.2, 1], transition: { duration: 1.5 + i*0.3, repeat: Infinity } }}
              >✨</motion.text>
            ))}
          </g>
        )}

        {/* Zzz for sleepy */}
        {mood === 'sleepy' && (
          <g>
            {[{x: cx+r*0.9, y: cy-r*0.7, f: 0.18}, {x: cx+r*1.15, y: cy-r*1.0, f: 0.24}, {x: cx+r*1.45, y: cy-r*1.35, f: 0.3}].map((z, i) => (
              <motion.text key={i} x={z.x} y={z.y} fontSize={s*z.f} fill="#74B9FF" fontWeight="700" fontFamily="Fredoka, sans-serif"
                animate={{ opacity: [0, 1, 0], y: [0, -s*0.12], transition: { duration: 2, delay: i*0.5, repeat: Infinity } }}
              >z</motion.text>
            ))}
          </g>
        )}
      </svg>
    </motion.div>
  )
}
