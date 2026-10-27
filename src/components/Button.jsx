// Chunky pixel button (styles/pixel.css). The old variant names stay so
// every screen keeps working; they map onto the pixel colours. A plain
// <button>: framer-motion would write its own inline transform and
// override the CSS press-down.
const VARIANT = {
  primary: 'purple',
  coral:   'red',
  mint:    'green',
  gold:    'gold',
  ghost:   'parch',
  white:   'parch',
  green:   'green',
  blue:    'blue',
  wood:    'wood',
}

export default function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, style = {} }) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className={`px-btn px-btn--${VARIANT[variant] ?? 'gold'} px-btn--${size}`}
      style={style}
    >
      {children}
    </button>
  )
}
