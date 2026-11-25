// ── What counts as right in Formen-Land ──────────────────────────────────────
// Kept apart from the drawing so it can be tested (tests/unit/shapeScenes.test.js).
//
// The standard: a tap a child could defend to a teacher is never a miss,
// and a thing that is asked as a circle looks like a circle as it is drawn.

export const SHAPE_IDS = ['circle', 'square', 'triangle', 'rectangle', 'oval', 'rhombus', 'star', 'heart']

// A square is a rectangle, and a rhombus (four equal sides) too; a circle
// is an oval that is as high as it is wide. The other way round it is not
// true: a rectangle is no square, an oval no circle.
const ALSO = { square: ['rectangle', 'rhombus'], circle: ['oval'] }

/** Is a `tapped` shape a fair answer when `asked` is looked for? */
export const defensible = (tapped, asked) => tapped === asked || (ALSO[tapped]?.includes(asked) ?? false)

// Shapes around us: things whose picture shows the shape plainly, each
// checked against its picture in public/sprites/emoji (outline measured:
// the window 1:1, the door 2:3). Out are all whose outline is not one
// shape as drawn: the coin and the target (drawn at an angle, they look
// oval), the flag (a pole and a cloth), the tent (drawn in perspective),
// the open book, the cake slice, the gift, the waffle (drawn round), the
// framed picture (not square) and the potato (lying at a slant).
// Names (for screen readers) with their article.
export const OBJECTS = {
  circle:    [['🕐', 'die Uhr'], ['🍪', 'der Keks'], ['🌕', 'der Vollmond'], ['⚽', 'der Ball']],
  square:    [['🪟', 'das Fenster']],
  triangle:  [['🍕', 'das Pizzastück'], ['⚠️', 'das Warnschild'], ['📐', 'das Geodreieck']],
  rectangle: [['🚪', 'die Tür'], ['📱', 'das Handy'], ['💌', 'der Brief']],
  oval:      [['🥚', 'das Ei'], ['🪞', 'der Spiegel']],
  rhombus:   [['🪁', 'der Drachen']],
}

/**
 * The shapes to choose from for a thing of shape `type`: the right one and
 * two others from the level's `pool`. Never one the thing could be called
 * too (no rectangle next to the window, no oval next to the cookie), and
 * never a star or a heart: no thing here has their shape, but some carry
 * one (the letter with its heart).
 */
export function objectOptions(type, pool, shuffle) {
  const others = pool.filter(t => t !== 'star' && t !== 'heart' && !defensible(type, t))
  return shuffle([type, ...shuffle(others).slice(0, 2)])
}

/**
 * Which shape the next picture asks for: every kind of the level once
 * before one comes again, never the same twice in a row. (Drawn at random,
 * level 1 asked for triangles in five of eight pictures.)
 */
export function shapeBag(pool, random = Math.random) {
  let left = [], last = null
  return () => {
    if (!left.length) {
      left = [...pool]
      for (let i = left.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [left[i], left[j]] = [left[j], left[i]]
      }
      if (left[0] === last && left.length > 1) left.push(left.shift())
    }
    last = left.shift()
    return last
  }
}

// ── Is a point on a piece? ───────────────────────────────────────────────────
// (px, py) in the picture's units, `pad` units around the edge included.
// The piece may hang at a slant (`rot`, about its middle).
export function onPiece({ type, rot }, [x, y, w, h], px, py, pad = 0) {
  const cx = x + w / 2, cy = y + h / 2
  const a = -(rot || 0) * Math.PI / 180
  const dx = (px - cx) * Math.cos(a) - (py - cy) * Math.sin(a)
  const dy = (px - cx) * Math.sin(a) + (py - cy) * Math.cos(a)
  const rx = w / 2 + pad, ry = h / 2 + pad
  switch (type) {
    case 'circle':
    case 'oval':     return (dx / rx) ** 2 + (dy / ry) ** 2 <= 1
    case 'rhombus':  return Math.abs(dx) / rx + Math.abs(dy) / ry <= 1
    case 'triangle': return Math.abs(dy) <= ry && Math.abs(dx) <= (w / 2) * ((dy + h / 2) / h) + pad * 1.4
    case 'star':     return Math.hypot(dx / w, dy / h) <= 0.44 + pad / Math.min(w, h)
    case 'heart':    return (dx / (w * 0.46 + pad)) ** 2 + ((dy + h * 0.04) / (h * 0.44 + pad)) ** 2 <= 1
    default:         return Math.abs(dx) <= rx && Math.abs(dy) <= ry
  }
}

/**
 * Which piece a tap at (px, py) means. Not the shape that happens to lie on
 * top: the roof's middle has the round window on it, the wall has the door.
 * If a shape of the kind being sought is under the finger (`near(piece)`
 * units around it too: small ones are hard to hit), the tap is for it, one
 * not found yet first. Otherwise it is for the topmost shape right under
 * the finger, or for none.
 */
export function pieceAt(pieces, boxOf, px, py, { answer, found = [], near = () => 0 } = {}) {
  const top = list => list[list.length - 1]
  const sought = pieces.filter(p => p.type === answer && onPiece(p, boxOf(p), px, py, near(p)))
  const fresh = sought.filter(p => !found.includes(p.id))
  if (fresh.length) return top(fresh)
  if (sought.length) return top(sought)
  return top(pieces.filter(p => onPiece(p, boxOf(p), px, py))) ?? null
}
