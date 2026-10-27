// Pixel-Abenteuer building blocks for the games (see styles/pixel.css):
// style objects, so every game keeps its own layout and motion and only
// trades its look. Feedback colours stay readable at a glance: green frame
// = right, red frame = wrong, gold = chosen.

export const INK      = 'var(--px-ink)'
export const ACCENT   = '#6b3fd6'                 // highlighted words in a question
const DROP            = '0 5px 0 rgba(42,27,61,0.35)'
const BEVEL           = 'inset 0 -5px 0 rgba(42,27,61,0.10)'

const FILL  = { right: '#DDF6CF', wrong: '#FFDCD6', selected: '#FFF0B8', idle: '#FFFDF7' }
const FRAME = { right: '#2F8F3A', wrong: '#C2412D', selected: INK, idle: INK }

/** Answer card / tile. state: 'right' | 'wrong' | 'selected' | undefined */
export function pxCard(state) {
  const s = state ?? 'idle'
  return {
    background:   FILL[s],
    border:       `3px solid ${FRAME[s]}`,
    borderRadius: 12,
    boxShadow:    s === 'right' ? `${BEVEL}, 0 5px 0 #2F8F3A` : `${BEVEL}, ${DROP}`,
  }
}

/** Larger content area (the picture of the task, a board). */
export const pxPanel = {
  background:   'var(--px-parch-light)',
  border:       `3px solid ${INK}`,
  borderRadius: 14,
  boxShadow:    `inset 0 -6px 0 var(--px-parch-dark), ${DROP}`,
}

/** Lumi's speech bubble with the question. */
export const pxBubble = {
  background:   '#FFFDF7',
  border:       `3px solid ${INK}`,
  borderRadius: '12px 12px 12px 4px',
  boxShadow:    DROP,
}

/** Chunky button in one of the pixel colours: gold | green | blue | red | purple | wood | parch */
export function pxButton(color = 'purple') {
  // Ink on the light colours, like .px-btn--green/--red/--blue in pixel.css:
  // white on these was too weak (green 2.2:1)
  const light = !['purple', 'wood'].includes(color)
  return {
    background:   color === 'purple' ? 'var(--px-purple-deep)' : `var(--px-${color})`,
    color:        light ? INK : '#fff',
    border:       `3px solid ${INK}`,
    borderRadius: 12,
    boxShadow:    `inset 0 3px 0 rgba(255,255,255,0.4), inset 0 -5px 0 rgba(0,0,0,0.22), 0 5px 0 ${INK}`,
    textShadow:   light ? '0 1px 0 rgba(255,255,255,0.4)' : '0 2px 0 rgba(0,0,0,0.3)',
    fontFamily:   'var(--font-heading)',
    fontWeight:   700,
    cursor:       'pointer',
  }
}

/** One segment of a round-progress bar: done | current | todo */
export function pxSegment(kind) {
  return {
    height:       12,
    borderRadius: 3,
    border:       `2px solid ${INK}`,
    background:   kind === 'done' ? 'var(--px-green)' : kind === 'current' ? 'var(--px-gold)' : 'rgba(42,27,61,0.12)',
  }
}
