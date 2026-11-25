import { GLYPHS, isDigit, pathOf } from '../traceStrokes.js'
import { Art } from '../../components/play/index.js'
import { bodyOf } from './alive.js'
import { WORD } from './words.js'
import { INK } from '../px.js'

/**
 * Buchstaben-Spuren: how a glyph is drawn once it is traced — on the board,
 * walking to the shelf, on the shelf and in the parade. Always from the very
 * strokes the child has traced, never from a font.
 */

/** The board's view of the stroke box: the box plus room for dots and feet. */
export const VIEW = { x: -12, y: -8, w: 124, h: 156 }
/** The part of it a finished glyph needs, with its feet: the small pictures. */
export const MINI = { x: -2, y: 1, w: 104, h: 148 }
export const INK_W = 11

// The legs swing while a glyph walks. In a <style> of the game's own, because
// play.css belongs to all games.
export const SPUREN_CSS = `
@keyframes sp-leg { from { transform: rotate(-30deg); } to { transform: rotate(30deg); } }
@keyframes sp-twinkle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.18); } }
@media (prefers-reduced-motion: reduce) { .sp-leg, .sp-twinkle { animation: none !important; } }
`

/**
 * The traced strokes of a glyph, as SVG. `count` strokes are drawn (all by
 * default). `alive`: the glyph is finished — it gets a dark outline, eyes, a
 * smile and two legs; `walking` swings the legs.
 */
export function GlyphBody({ g, color, count, alive = false, walking = false }) {
  const strokes = GLYPHS[g].slice(0, count ?? GLYPHS[g].length)
  const { face, legs } = bodyOf(g)
  return (
    <>
      {alive && legs.map((l, i) => (
        <g key={'leg' + i} className="sp-leg" style={{
          transformBox: 'fill-box', transformOrigin: '30% 0%',
          animation: walking ? `sp-leg .24s ease-in-out infinite ${i ? 'alternate-reverse' : 'alternate'}` : 'none',
        }}>
          <path d={`M${l.x} ${l.y + 1} V${l.y + 10.5}`} stroke={INK} strokeWidth={3.4} strokeLinecap="round" fill="none" />
          <ellipse cx={l.x + 2.2} cy={l.y + 11.6} rx={4.8} ry={2.7} fill={INK} />
        </g>
      ))}
      {alive && strokes.map((s, i) => (
        <path key={'o' + i} d={pathOf(s)} fill="none" stroke={INK} strokeWidth={INK_W + 4.4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {strokes.map((s, i) => (
        <path key={'c' + i} d={pathOf(s)} fill="none" stroke={color} strokeWidth={INK_W} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {/* the snail's trail shines */}
      {strokes.map((s, i) => (
        <path key={'s' + i} d={pathOf(s)} fill="none" stroke="#fff" strokeOpacity={0.3} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {alive && (
        <g pointerEvents="none">
          <g className="pl-blink">
            {[-9, 9].map(dx => (
              <g key={dx}>
                <circle cx={face.x + dx} cy={face.y} r={7.5} fill="#fff" stroke={INK} strokeWidth={2.2} />
                <circle cx={face.x + dx + 1.5} cy={face.y + 1} r={3.6} fill={INK} />
                <circle cx={face.x + dx + 2.6} cy={face.y - 0.4} r={1.2} fill="#fff" />
              </g>
            ))}
          </g>
          <path d={`M${face.x - 7} ${face.y + 12} Q${face.x} ${face.y + 20} ${face.x + 7} ${face.y + 12}`}
            fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}
    </>
  )
}

/** A finished glyph as a small picture of its own (shelf, parade, the walk to the shelf). */
export function MiniGlyph({ g, color, width = '100%', walking = false, style }) {
  return (
    <svg viewBox={`${MINI.x} ${MINI.y} ${MINI.w} ${MINI.h}`} width={width} aria-hidden="true"
      style={{ display: 'block', overflow: 'visible', ...style }}>
      <GlyphBody g={g} color={color} alive walking={walking} />
    </svg>
  )
}

// which of the nine places of a 3 × 3 field carry a dot, for 0 … 9
const DOTS = [
  [], [4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8],
  [0, 2, 3, 5, 6, 8], [0, 2, 3, 4, 5, 6, 8], [0, 1, 2, 3, 5, 6, 7, 8], [0, 1, 2, 3, 4, 5, 6, 7, 8],
]

/** A digit's picture: a card with that many dots (none on the card of the 0). */
export function Dots({ n, color, size }) {
  return (
    <svg viewBox="0 0 44 44" width={size} height={size} role="img" aria-label={`${n} ${n === 1 ? 'Punkt' : 'Punkte'}`}
      style={{ display: 'block', flexShrink: 0 }}>
      <rect x={3} y={5} width={38} height={38} rx={8} fill="rgba(42,27,61,0.25)" />
      <rect x={3} y={2} width={38} height={38} rx={8} fill="#FFFDF7" stroke={INK} strokeWidth={2.6} />
      {DOTS[n].map(i => (
        <circle key={i} cx={11.5 + (i % 3) * 10.5} cy={10.5 + Math.floor(i / 3) * 10.5} r={4} fill={color} stroke={INK} strokeWidth={1.4} />
      ))}
    </svg>
  )
}

/** What belongs to a glyph: the letter's picture, or the digit's dots. */
export function Pic({ g, color, size }) {
  return isDigit(g) ? <Dots n={+g} color={color} size={size} /> : <Art art={WORD[g][1]} size={size} />
}
