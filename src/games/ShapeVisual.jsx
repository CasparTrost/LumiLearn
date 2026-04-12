// ShapeVisual — renders SVG shapes.
// color = 'transparent' → outline only (for PainterGame's unpainted state)
// color = '#hex'        → filled shape with white sheen
export default function ShapeVisual({ shape, color = '#6C63FF', size = 100 }) {
  const c   = size / 2
  const r   = size * 0.4
  const transparent = color === 'transparent'
  const fill        = transparent ? 'rgba(240,244,255,0.5)' : color
  const stroke      = transparent ? '#C0B8E8' : 'rgba(255,255,255,0.55)'
  const strokeW     = transparent ? size * 0.03 : size * 0.022
  const sheen       = !transparent

  if (shape === 'circle') {
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={c} cy={c} r={r} fill={fill} stroke={stroke} strokeWidth={strokeW} />
        {sheen && <ellipse cx={c - r*0.22} cy={c - r*0.32} rx={r*0.32} ry={r*0.2}
          fill="white" opacity={0.28} transform={`rotate(-22 ${c} ${c})`} />}
      </svg>
    )
  }

  if (shape === 'square') {
    const s = r * 1.65
    const x = c - s / 2
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={x} y={x} width={s} height={s} rx={size * 0.07} fill={fill} stroke={stroke} strokeWidth={strokeW} />
        {sheen && <rect x={x + s*0.1} y={x + s*0.1} width={s*0.38} height={s*0.18} rx={5}
          fill="white" opacity={0.28} />}
      </svg>
    )
  }

  if (shape === 'rectangle') {
    const w = r * 2.28, h = r * 1.25
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x={c - w/2} y={c - h/2} width={w} height={h} rx={size * 0.07} fill={fill} stroke={stroke} strokeWidth={strokeW} />
        {sheen && <rect x={c - w/2 + w*0.08} y={c - h/2 + h*0.1} width={w*0.35} height={h*0.28} rx={5}
          fill="white" opacity={0.28} />}
      </svg>
    )
  }

  if (shape === 'triangle') {
    const pts = `${c},${c - r}  ${c + r},${c + r * 0.72}  ${c - r},${c + r * 0.72}`
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        {sheen && <ellipse cx={c} cy={c - r*0.2} rx={r*0.28} ry={r*0.15}
          fill="white" opacity={0.28} />}
      </svg>
    )
  }

  if (shape === 'star') {
    const points = Array.from({ length: 5 }, (_, i) => {
      const outer = (i * 72 - 90) * Math.PI / 180
      const inner = (i * 72 + 36 - 90) * Math.PI / 180
      return `${c + r * Math.cos(outer)},${c + r * Math.sin(outer)} ${c + r * 0.42 * Math.cos(inner)},${c + r * 0.42 * Math.sin(inner)}`
    }).join(' ')
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={points} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        {sheen && <circle cx={c - r*0.1} cy={c - r*0.35} r={r*0.18}
          fill="white" opacity={0.28} />}
      </svg>
    )
  }

  if (shape === 'heart') {
    const d = `M ${c} ${c + r * 0.58}
               C ${c - r*0.08} ${c + r*0.38}, ${c - r} ${c + r*0.12}, ${c - r} ${c - r*0.15}
               C ${c - r} ${c - r*0.62}, ${c - r*0.28} ${c - r*0.82}, ${c} ${c - r*0.46}
               C ${c + r*0.28} ${c - r*0.82}, ${c + r} ${c - r*0.62}, ${c + r} ${c - r*0.15}
               C ${c + r} ${c + r*0.12}, ${c + r*0.08} ${c + r*0.38}, ${c} ${c + r*0.58} Z`
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <path d={d} fill={fill} stroke={stroke} strokeWidth={strokeW} />
        {sheen && <circle cx={c - r*0.35} cy={c - r*0.28} r={r*0.2}
          fill="white" opacity={0.28} />}
      </svg>
    )
  }

  if (shape === 'diamond') {
    // Classic 4-point diamond (rhombus)
    const pts = `${c},${c - r}  ${c + r * 0.7},${c}  ${c},${c + r}  ${c - r * 0.7},${c}`
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        {sheen && <ellipse cx={c - r*0.12} cy={c - r*0.28} rx={r*0.28} ry={r*0.16}
          fill="white" opacity={0.28} transform={`rotate(-15 ${c} ${c})`} />}
      </svg>
    )
  }

  if (shape === 'pentagon') {
    const pts = Array.from({ length: 5 }, (_, i) => {
      const a = (i * 72 - 90) * Math.PI / 180
      return `${c + r * Math.cos(a)},${c + r * Math.sin(a)}`
    }).join(' ')
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        {sheen && <ellipse cx={c} cy={c - r*0.35} rx={r*0.3} ry={r*0.16}
          fill="white" opacity={0.28} />}
      </svg>
    )
  }

  // Fallback — should never be reached with valid shape names
  return <span style={{ fontSize: size * 0.5 }}>🔵</span>
}
