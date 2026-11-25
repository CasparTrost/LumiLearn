/**
 * Lumi as a Memo player: a fair, beatable opponent.
 *
 * Lumi only knows what it has seen. The game hands it a VIEW of the board
 * (`viewOf`): where the cards are, which are face up and which are gone,
 * and the picture of a card only while it is face up. What lies under a
 * face-down card Lumi can only know from its own memory, and its memory is
 * patchy: a card shown face up is noticed with a probability that rises
 * with the level (`skillFor`); sometimes Lumi notices the picture but puts
 * it one place off (the card next to the right one, the mistake a child
 * makes too), otherwise it simply does not take it in.
 *
 * During the preview at the start Lumi sleeps, and when the child turns
 * the joker Lumi does not look: neither shows it anything.
 */

/** How well Lumi remembers at a level (3–10): noticed, put one place off. */
export function skillFor(level) {
  const l = Math.max(3, Math.min(10, level))
  // level 3: a forgetful Lumi an attentive child nearly always beats;
  // level 10: a good player, still beatable
  const notice = [0.12, 0.22, 0.32, 0.42, 0.52, 0.6, 0.68, 0.75][l - 3]
  return { notice, slip: 0.3 }
}

/** What Lumi may see of the cards: the picture only of a face-up card. */
export function viewOf(cards) {
  return cards.map(c => ({
    id: c.id,
    gone: !!(c.matched || c.gone),
    up: !!c.flipped,
    pairKey: c.flipped ? c.pairKey : undefined,
  }))
}

const pick = (list, rng) => list[Math.floor(rng() * list.length)]

// The cards next to a place (left, right, above, below) that are still there
function neighbours(view, id, cols) {
  const r = Math.floor(id / cols), c = id % cols
  return [[r, c - 1], [r, c + 1], [r - 1, c], [r + 1, c]]
    .filter(([y, x]) => y >= 0 && x >= 0 && x < cols)
    .map(([y, x]) => view[y * cols + x])
    .filter(v => v && !v.gone && v.id !== id)
}

/**
 * Lumi sees a card face up (its own, the child's or a joker's peek for
 * Lumi). `memory` is a Map id -> pairKey and is changed in place.
 */
export function observe(memory, shown, view, cols, { notice, slip }, rng = Math.random) {
  if (shown.pairKey === undefined) return memory
  const r = rng()
  if (r < notice) {
    memory.set(shown.id, shown.pairKey)
  } else if (r < notice + (1 - notice) * slip) {
    // the right picture, one place off
    const near = neighbours(view, shown.id, cols).filter(v => !v.up)
    if (near.length) {
      if (memory.get(shown.id) === shown.pairKey) memory.delete(shown.id)
      memory.set(pick(near, rng).id, shown.pairKey)
    }
  }
  return memory
}

/** Cards that left the board are forgotten. */
export function forget(memory, ids) {
  ids.forEach(id => memory.delete(id))
  return memory
}

const downIds = view => view.filter(v => !v.gone && !v.up).map(v => v.id)

/**
 * The first card of Lumi's turn: one of a pair it believes it knows both
 * cards of, otherwise a card it knows nothing about.
 */
export function chooseFirst(memory, view, rng = Math.random) {
  const down = downIds(view)
  if (!down.length) return null
  const byPair = new Map()
  for (const id of down) {
    const k = memory.get(id)
    if (k === undefined) continue
    byPair.set(k, [...(byPair.get(k) ?? []), id])
  }
  const known = [...byPair.values()].filter(ids => ids.length >= 2)
  if (known.length) return pick(known, rng)[0]
  const unknown = down.filter(id => !memory.has(id))
  return pick(unknown.length ? unknown : down, rng)
}

/**
 * The second card, now that the first one (`first`: { id, pairKey }) is
 * face up: where Lumi believes its partner is, otherwise a card it knows
 * nothing about (not one it believes is something else).
 */
export function chooseSecond(memory, view, first, rng = Math.random) {
  const down = downIds(view).filter(id => id !== first.id)
  if (!down.length) return null
  const partner = down.filter(id => memory.get(id) === first.pairKey)
  if (partner.length) return pick(partner, rng)
  const unknown = down.filter(id => !memory.has(id))
  return pick(unknown.length ? unknown : down, rng)
}
