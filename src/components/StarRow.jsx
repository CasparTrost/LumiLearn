import { motion } from 'framer-motion'
import { Star } from 'lucide-react'

export default function StarRow({ filled = 0, total = 3, size = 22 }) {
  return (
    <div style={{ display: 'flex', gap: 3 }}>
      {Array.from({ length: total }).map((_, i) => (
        <motion.div
          key={i}
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: i * 0.1, type: 'spring', stiffness: 400, damping: 12 }}
        >
          <Star
            size={size}
            fill={i < filled ? '#FFD93D' : 'transparent'}
            stroke={i < filled ? '#FFB800' : '#C0B8E8'}
            strokeWidth={2}
          />
        </motion.div>
      ))}
    </div>
  )
}
