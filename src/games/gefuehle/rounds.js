// The rules of the Gefühle-Haus, without any drawing: which feelings a
// level knows, and who is dealt to which window. Kept apart from the game
// so the promises can be tested (tests/unit/gefuehleHaus.test.js).
//
// The house plays in deals: all shutters open, every window has an animal,
// and exactly one of them feels like the sign. A right tap closes all
// shutters, and when they open again everyone is dealt anew, the right one
// somewhere else. (It used to be a stream of animals popping up and down,
// and the next right one came up in the window just tapped: the owner
// found that "keine Herausforderung".) A wrong tap changes nothing, so
// guessing never reshuffles the house.

// Every feeling here has a recorded word (lib/words.js feelingWord) and a
// face that can be told from the others at window size (gefuehle/faces.jsx).
// Dankbar, Eifersüchtig, Einsam and Neugierig are left out: no face shows
// them without a story around it.
const TIERS = [
  ['Glücklich', 'Traurig', 'Wütend'],
  ['Ängstlich', 'Überrascht'],
  ['Müde', 'Stolz'],
  ['Verlegen', 'Gelangweilt', 'Aufgeregt'],
]
export const FEELINGS = TIERS.flat()

// Faces a child easily takes for one another. From level 5 the other
// windows favour these, so the child has to look twice.
const LOOKALIKE = {
  'Aufgeregt':   ['Überrascht'],
  'Stolz':       ['Verlegen'],
  'Traurig':     ['Ängstlich', 'Müde', 'Verlegen'],
  'Ängstlich':   ['Überrascht', 'Traurig'],
  'Überrascht':  ['Ängstlich', 'Aufgeregt'],
  'Müde':        ['Gelangweilt', 'Traurig'],
  'Gelangweilt': ['Müde', 'Wütend'],
  'Wütend':      ['Gelangweilt', 'Ängstlich'],
  'Verlegen':    ['Traurig', 'Stolz'],
}

// Faces a child may rightly call by the word on the sign. While that word
// is asked, these stay away from the windows, so that no tap that can be
// argued for is called wrong. Every asked feeling, against every face:
// - Glücklich: the proud, the excited and the shy face all smile, and a
//   smile is "glücklich" (the shy one with a big blush reads happiest).
// - Traurig: the bored face's pout (variant 2) is a small frown.
// - Wütend: no other face has angry brows or a red forehead.
// - Ängstlich / Überrascht: wide eyes and an open mouth are "erschrocken",
//   both at once; the two are the pair grown-ups mix up most, too.
// - Überrascht / Aufgeregt: a star-eyed open grin is a happy surprise.
// - Müde / Gelangweilt: both have heavy lids; a yawn is bored, a head
//   propped on a paw is tired.
// - Stolz / Aufgeregt: both beam as Glücklich does (Gefühlsdetektiv keeps
//   the three apart as well).
// - Aufgeregt: "aufgeregt" is also the jittery feeling before a show, which
//   is the sweating, teeth-chattering Ängstlich face.
// - Verlegen: no other face looks down and away under a blush.
export const TOO_CLOSE = {
  'Glücklich':   ['Stolz', 'Aufgeregt', 'Verlegen'],
  'Traurig':     ['Gelangweilt'],
  'Ängstlich':   ['Überrascht'],
  'Überrascht':  ['Ängstlich', 'Aufgeregt'],
  'Müde':        ['Gelangweilt'],
  'Gelangweilt': ['Müde'],
  'Stolz':       ['Glücklich', 'Aufgeregt'],
  'Aufgeregt':   ['Glücklich', 'Stolz', 'Überrascht', 'Ängstlich'],
}

export const DUCK_MS = 350
// After a right tap: from the tap until the shutters open on the new deal
// (the animals duck and the shutters close in about 400 ms of it, then they
// stay shut a moment, so the child sees that everything is new). Short, so
// it never drags.
export const SHUT_MS = 950
export const ANIMALS = 10

export function shuffle(list, rnd = Math.random) {
  const s = [...list]
  for (let i = s.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [s[i], s[j]] = [s[j], s[i]]
  }
  return s
}
const pick = (list, rnd) => list[Math.floor(rnd() * list.length)]

/** What a level asks: feelings, windows, how many to find. */
export function levelConfig(level) {
  const L = Math.max(1, Math.min(10, Math.round(level) || 1))
  const tier = L <= 2 ? 0 : L <= 4 ? 1 : L <= 6 ? 2 : 3
  const windows = L <= 2 ? 4 : L <= 6 ? 6 : 9
  return {
    level: L,
    feelings: TIERS.slice(0, tier + 1).flat(),
    fresh: L <= 8 ? TIERS[tier] : [],              // new on this step: they get a round for sure
    windows,                                       // each deal fills every window
    need: L <= 4 ? 4 : L <= 8 ? 5 : 6,             // right ones to find in a round: the meter's stars
    rounds: L <= 4 ? 5 : 6,
    // level 1 shows each feeling with one face only; from level 2 the same
    // feeling comes with a second face (other eyes, other mouth)
    variants: L === 1 ? 1 : 2,
    lookalikes: L >= 5,
    hideFace: L >= 9,                              // the sign turns away: go by the word
  }
}

/** The feelings of a level's rounds: the new ones for sure, never the same twice in a row. */
export function pickRounds(cfg, rnd = Math.random) {
  const { feelings, fresh, rounds } = cfg
  const rest = shuffle(feelings.filter(f => !fresh.includes(f)), rnd)
  let list = shuffle([...fresh, ...rest].slice(0, rounds), rnd)
  // fewer feelings than rounds (levels 1 and 2): some come a second time
  while (list.length < rounds) {
    const last = list[list.length - 1]
    const seen = f => list.filter(x => x === f).length
    const least = Math.min(...feelings.filter(f => f !== last).map(seen))
    list = [...list, pick(feelings.filter(f => f !== last && seen(f) === least), rnd)]
  }
  return list
}

function otherFeeling(target, cfg, shown, rnd) {
  const barred = TOO_CLOSE[target] ?? []
  const others = cfg.feelings.filter(f => f !== target && !barred.includes(f))
  const near = (LOOKALIKE[target] ?? []).filter(f => others.includes(f))
  if (cfg.lookalikes && near.length && rnd() < 0.5) return pick(near, rnd)
  // rather a feeling that is not at a window already
  const unseen = others.filter(f => !shown.includes(f))
  return pick(unseen.length ? unseen : others, rnd)
}

// How good a deal is as a search. 0: not allowed (the right one in the
// window just tapped, or the animal just caught again). Better: the others
// show at least two feelings, and one of them is alone as well, so the
// right one cannot be found as "the odd one out" without reading its face;
// no other feeling fills more than half the other windows; and no window
// keeps the animal it had.
function quality(cast, at, { avoid, lastAnimal, before }) {
  if (avoid != null && at === avoid) return 0
  if (lastAnimal != null && cast[at].animal === lastAnimal) return 0
  const counts = {}
  cast.forEach((c, i) => { if (i !== at) counts[c.feeling] = (counts[c.feeling] ?? 0) + 1 })
  const n = Object.values(counts)
  let score = 1
  if (n.length >= 2) score += 2
  if (n.includes(1)) score += 2
  // a mix, not a wall of one look-alike
  if (Math.max(...n) <= Math.ceil((cast.length - 1) / 2)) score += 1
  if (!before || cast.every((c, i) => !before[i] || before[i].animal !== c.animal)) score += 1
  return score
}
const BEST_DEAL = 7

let uid = 0

/**
 * A new deal: every window gets an animal, ten animals, none twice, and
 * exactly one of them feels like the sign. `avoid` is the window just
 * tapped (the right one never comes there again straight away, so it is
 * never twice running in the same window), `lastAnimal` the animal just
 * caught (the next right one is another animal: it is the face that
 * counts), `before` the deal before (every window gets a new animal).
 *
 * A character is { id, animal, feeling, variant, state: 'up' }. Faces that
 * can be argued for as the sign's feeling (TOO_CLOSE) never come.
 */
export function deal(cfg, target, { avoid = null, lastAnimal = null, before = null, rnd = Math.random } = {}) {
  const windows = Array.from({ length: cfg.windows }, (_, i) => i)
  const spots = windows.filter(i => i !== avoid)
  let best = null, bestScore = -1
  for (let tries = 0; tries < 60 && bestScore < BEST_DEAL; tries++) {
    const at = pick(spots, rnd)
    const animals = shuffle(Array.from({ length: ANIMALS }, (_, i) => i), rnd)
    const shown = []
    const cast = windows.map(i => {
      const feeling = i === at ? target : otherFeeling(target, cfg, shown, rnd)
      if (i !== at) shown.push(feeling)
      return { id: ++uid, animal: animals[i], feeling, variant: Math.floor(rnd() * cfg.variants), state: 'up' }
    })
    const score = quality(cast, at, { avoid, lastAnimal, before })
    if (score > bestScore) { best = cast; bestScore = score }
  }
  return best
}

/** One tick of the house: whoever has ducked away is gone. The same array when nothing changed. */
export function settle(slots, now) {
  let out = slots
  slots.forEach((c, i) => {
    if (c && c.state !== 'up' && now >= c.gone) {
      if (out === slots) out = [...slots]
      out[i] = null
    }
  })
  return out
}

/** Everyone ducks and the shutters close: after a right tap, and at the end of a round. */
export function allDown(slots, now) {
  return slots.map(c => (c && c.state === 'up' ? { ...c, state: 'down', gone: now + DUCK_MS } : c))
}

// Window grids that fit a count; the game takes the one with the biggest windows
export const GRIDS = { 4: [[2, 2], [4, 1]], 6: [[3, 2], [2, 3]], 9: [[3, 3], [5, 2]] }
