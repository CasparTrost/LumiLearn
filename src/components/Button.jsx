import { motion } from 'framer-motion'

export default function Button({ children, onClick, variant = 'primary', size = 'md', disabled = false, style = {} }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    border: 'none',
    borderRadius: 99,
    fontFamily: 'var(--font-heading)',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: 'box-shadow 0.2s',
    userSelect: 'none',
    whiteSpace: 'nowrap',
  }

  const sizes = {
    sm:  { padding: '10px 22px', fontSize: 15 },
    md:  { padding: '14px 32px', fontSize: 18 },
    lg:  { padding: '18px 44px', fontSize: 22 },
  }

  const variants = {
    primary: {
      background: 'linear-gradient(135deg, #6C63FF, #A78BFA)',
      color: 'white',
      boxShadow: '0 6px 24px rgba(108,99,255,0.4)',
    },
    coral: {
      background: 'linear-gradient(135deg, #FF6B6B, #FF8E53)',
      color: 'white',
      boxShadow: '0 6px 24px rgba(255,107,107,0.4)',
    },
    mint: {
      background: 'linear-gradient(135deg, #4ECDC4, #44E5B3)',
      color: 'white',
      boxShadow: '0 6px 24px rgba(78,205,196,0.4)',
    },
    gold: {
      background: 'linear-gradient(135deg, #FFD93D, #FF9F43)',
      color: '#1A1040',
      boxShadow: '0 6px 24px rgba(255,217,61,0.4)',
    },
    ghost: {
      background: 'rgba(108,99,255,0.08)',
      color: 'var(--violet)',
      boxShadow: 'none',
      border: '2px solid rgba(108,99,255,0.25)',
    },
    white: {
      background: 'white',
      color: 'var(--violet)',
      boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
    },
  }

  const disabledStyle = disabled ? { opacity: 0.45, filter: 'grayscale(0.5)' } : {}

  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.04, y: -2 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      style={{ ...base, ...sizes[size], ...variants[variant], ...disabledStyle, ...style }}
    >
      {children}
    </motion.button>
  )
}
