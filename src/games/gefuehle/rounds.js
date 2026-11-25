// The rules of the Gefühle-Haus, without any drawing: which feelings a
// level knows, how long a character stays at its window, and who pops up
// next. Kept apart from the game so the promises can be tested
// (tests/unit/gefuehleHaus.test.js): a right face is always on screen.

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

// Feelings a child may rightly take for the one on the sign: someone proud
// or excited is beaming, and beaming is "glücklich"; and a beaming face
// under the proud sign differs from it only by a medal, which is no
// expression. While the sign shows the key, these stay away from the
// windows, so that no tap that can be argued for is called wrong.
export const TOO_CLOSE = {
  'Glücklich': ['Stolz', 'Aufgeregt'],
  'Stolz':     ['Glücklich'],
  'Aufgeregt': ['Glücklich'],
}

const STAY_MS = [5500, 5000, 4500, 4000, 3400, 3000, 2800, 2500, 2300, 2000]
export const DUCK_MS = 350
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

/** What a level asks: feelings, windows, tempo. */
export function levelConfig(level) {
  const L = Math.max(1, Math.min(10, Math.round(level) || 1))
  const tier = L <= 2 ? 0 : L <= 4 ? 1 : L <= 6 ? 2 : 3
  const windows = L <= 2 ? 4 : L <= 6 ? 6 : 9
  return {
    level: L,
    feelings: TIERS.slice(0, tier + 1).flat(),
    fresh: L <= 8 ? TIERS[tier] : [],              // new on this step: they get a round for sure
    windows,
    maxUp: windows === 4 ? 3 : windows === 6 ? 4 : L >= 9 ? 6 : 5, // characters at the windows at once
    maxRight: 2,                                   // of them, right ones
    share: L <= 4 ? 0.5 : 0.4,                     // how often the next one up is a right one
    stay: STAY_MS[L - 1],                          // ms at the window
    gap: L <= 4 ? [500, 1100] : [300, 800],        // ms a window rests before the next one comes
    stagger: L <= 2 ? 650 : L <= 6 ? 500 : 380,    // ms between two pop-ups
    need: L <= 4 ? 4 : L <= 8 ? 5 : 6,             // stars that fill the meter
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

function otherFeeling(target, cfg, up, rnd) {
  const barred = TOO_CLOSE[target] ?? []
  const others = cfg.feelings.filter(f => f !== target && !barred.includes(f))
  const near = (LOOKALIKE[target] ?? []).filter(f => others.includes(f))
  if (cfg.lookalikes && near.length && rnd() < 0.5) return pick(near, rnd)
  // rather a feeling that is not at a window already
  const shown = new Set(up.map(c => c.feeling))
  const unseen = others.filter(f => !shown.has(f))
  return pick(unseen.length ? unseen : others, rnd)
}

let uid = 0

/**
 * One tick of the house. `slots` is one entry per window: null (nobody
 * there) or a character { id, animal, feeling, variant, state, until, gone }
 * with state 'up' (at the window), 'down' (ducking away) or 'out' (caught,
 * on its way to the meter). `mem` keeps what is not drawn: when the next
 * one may come, and how long each window rests.
 *
 * Returns the same array when nothing changed, a new one otherwise, and
 * counts the newcomers in `mem.born`.
 */
export function step(slots, mem, { now, target, cfg, spawn = true, rnd = Math.random }) {
  let out = slots
  const set = (i, v) => { if (out === slots) out = [...slots]; out[i] = v }
  mem.freeAt ??= []
  mem.nextAt ??= 0
  mem.born = 0

  slots.forEach((c, i) => {
    if (!c) return
    if (c.state === 'up' && now >= c.until) set(i, { ...c, state: 'down', gone: now + DUCK_MS })
    else if (c.state !== 'up' && now >= c.gone) {
      set(i, null)
      mem.freeAt[i] = now + cfg.gap[0] + rnd() * (cfg.gap[1] - cfg.gap[0])
    }
  })
  if (!spawn) return out

  const up = out.filter(c => c?.state === 'up')
  const right = up.filter(c => c.feeling === target)
  const free = out.map((c, i) => (c ? -1 : i)).filter(i => i >= 0)
  if (!free.length) return out
  const rested = free.filter(i => now >= (mem.freeAt[i] ?? 0))

  let feeling = null, at = -1
  // Never without a right face: when none is up, or the last one is about
  // to duck, the next right one comes at once, in any empty window.
  if (!right.some(c => c.until - now > 900)) {
    feeling = target
    at = pick(rested.length ? rested : free, rnd)
  } else if (up.length < cfg.maxUp && rested.length && now >= mem.nextAt) {
    // a second right one only among more others: a child who taps every
    // window without looking must be wrong more often than right
    const room = right.length < cfg.maxRight && up.length - right.length > right.length
    feeling = room && rnd() < cfg.share ? target : otherFeeling(target, cfg, up, rnd)
    at = pick(rested, rnd)
  }
  if (feeling == null) return out

  // another animal than those at the windows right now
  const taken = new Set(out.filter(Boolean).map(c => c.animal))
  const animals = Array.from({ length: ANIMALS }, (_, i) => i).filter(i => !taken.has(i))
  const isRight = feeling === target
  set(at, {
    id: ++uid,
    animal: animals.length ? pick(animals, rnd) : Math.floor(rnd() * ANIMALS),
    feeling,
    variant: Math.floor(rnd() * cfg.variants),
    state: 'up',
    // a right one stays a little longer than the others
    until: now + cfg.stay * (0.9 + rnd() * 0.25) * (isRight ? 1.15 : 1),
  })
  mem.nextAt = now + cfg.stagger
  mem.born = 1
  return out
}

/** Everyone ducks: the round is over. */
export function allDown(slots, now) {
  return slots.map(c => (c && c.state === 'up' ? { ...c, state: 'down', gone: now + DUCK_MS } : c))
}

// Window grids that fit a count; the game takes the one with the biggest windows
export const GRIDS = { 4: [[2, 2], [4, 1]], 6: [[3, 2], [2, 3]], 9: [[3, 3], [5, 2]] }
