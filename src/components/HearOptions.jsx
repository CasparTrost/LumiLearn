import { motion } from 'framer-motion'
import { narrate } from '../narrator.js'

/**
 * Liest alle Antwortmöglichkeiten nacheinander vor.
 *
 * Der Weg fürs Tablet: Darüberfahren gibt es dort nicht, und Antippen einer
 * Option wäre schon die Antwort. `items` ist [{ text, src }] oder eine Liste
 * von Zeichenketten.
 */
export default function HearOptions({ items, label = 'Antworten vorlesen', size = 38, style }) {
  const parts = (items ?? [])
    .map(it => (typeof it === 'string' ? { text: it } : it))
    .filter(p => p && (p.text || p.src))
    // kleine Pause dazwischen, damit zwei Wörter nicht wie eines klingen
    .map((p, i) => (i === 0 ? p : { ...p, gap: 280 }))

  if (!parts.length) return null

  return (
    <motion.button
      whileHover={{ scale: 1.12 }} whileTap={{ scale: 0.9 }}
      onClick={() => narrate(parts)}
      aria-label={label}
      title={label}
      style={{
        width: size, height: size, flexShrink: 0,
        // pixel button (styles/pixel.css colours)
        background: 'var(--px-gold)', border: '3px solid var(--px-ink)', borderRadius: 12,
        boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.45), inset 0 -5px 0 rgba(0,0,0,0.2), 0 4px 0 var(--px-ink)',
        cursor: 'pointer', fontSize: Math.round(size * 0.5), lineHeight: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        ...style,
      }}
    >🔊</motion.button>
  )
}
