// Tier-Band (Musterpark): who is in the band, what each one plays, and how
// a row of animals becomes a rhythm.
//
// Every animal has one instrument with its own short sound (sfx.band). The
// sounds of one family (`fam`) are close to each other: a row never has
// two animals of one family (games/gameEngine.js picks by family), so what
// is different to the eye is always different to the ear, too.

export const BAND = [
  { e: '🐸', n: 'Frosch',  inst: 'drum',    fam: 'low' },
  { e: '🐻', n: 'Bär',     inst: 'bass',    fam: 'low' },
  { e: '🐷', n: 'Schwein', inst: 'maraca',  fam: 'noise' },
  { e: '🐒', n: 'Affe',    inst: 'cymbal',  fam: 'noise' },
  { e: '🐱', n: 'Katze',   inst: 'bell',    fam: 'bell' },
  { e: '🐭', n: 'Maus',    inst: 'xylo',    fam: 'bell' },
  { e: '🦆', n: 'Ente',    inst: 'quack',   fam: 'horn' },
  { e: '🐘', n: 'Elefant', inst: 'trumpet', fam: 'horn' },
  { e: '🐦', n: 'Vogel',   inst: 'whistle' },
  { e: '🐰', n: 'Hase',    inst: 'wood' },
  { e: '🐮', n: 'Kuh',     inst: 'cowbell' },
  { e: '🦁', n: 'Löwe',    inst: 'guitar' },
]

const BY_ART = Object.fromEntries(BAND.map(b => [b.e, b]))
/** The instrument an animal plays ('drum', 'bell' …), or null for anything else. */
export const instOf = art => BY_ART[art]?.inst ?? null
export const nameOf = art => BY_ART[art]?.n ?? ''

// ── Tokens ──────────────────────────────────────────────────────────────────
// A place of the row is a token: one animal, or in a growing row a group
// ("🐸🐸🐸" is three frogs). '❓' is a stool that is still empty.
export const EMPTY = '❓'
const glyphs = s => [...s].filter(ch => ch !== '️' && ch !== '‍').length
/** How many animals a token is. */
export const countOf = (q, token) => (q.kind === 'grow' ? glyphs(token) / glyphs(q.sym) : 1)
/** The animal a token is made of. */
export const artOf = (q, token) => (q.kind === 'grow' ? q.sym : token)
/** How many stools are empty at the start of a round. */
export const slotsOf = q => (q.kind === 'build' ? q.fill.length : 1)
/** What belongs on stool `slot`. */
export const wantedAt = (q, slot) => (q.kind === 'build' ? q.fill[slot] : q.answer)
/** Which stool a place of the row is (0, 1 …), or -1 for a place that was never empty. */
export const slotAt = (q, place) => (q.tokens[place] === EMPTY ? place - q.gapAt : -1)

/** The row as it stands: what sits on every place (null = an empty stool). */
export function seated(q, seats, trial = null) {
  return q.tokens.map((token, place) => {
    if (token !== EMPTY) return token
    const slot = place - q.gapAt
    return seats[slot] ?? (trial && trial.slot === slot ? trial.token : null)
  })
}

/** The different animals of a row, in the order they first appear: who joins the big band. */
export function membersOf(q) {
  const out = []
  const add = art => { if (art && !out.includes(art)) out.push(art) }
  if (q.kind === 'grow') add(q.sym)
  else {
    q.tokens.forEach(t => { if (t !== EMPTY) add(t) })
    ;(q.fill ?? [q.answer]).forEach(add)
  }
  return out
}

// ── Time ────────────────────────────────────────────────────────────────────
// Everything is counted in beats; the game says how long a beat is.

/** Beats per minute of a level: slow enough to follow at four, a little brisker at the end. */
export const bpmOf = level => 100 + 2 * (Math.max(1, Math.min(10, level)) - 1)
/** The band plays a finished row faster; long rows faster still, so the fun stays short. */
export const cheerBpm = (level, places) => Math.min(190, Math.round(bpmOf(level) * (places > 7 ? 1.75 : 1.5)))

export const REST = 2        // beats of dark between two rounds of the loop
const GROW_NOTE = 0.72       // a growing row: every animal of a group, one after the other
const GROW_GAP = 0.9         // … and a breath between two groups

/**
 * The row as a rhythm: a list of things that happen, each at `t` beats.
 *
 *   { t, place, sub, of, inst }  the light is on `place`, and its animal
 *                                number `sub` of `of` plays `inst` (null: an
 *                                empty stool, the light passes in silence)
 *   { t, place, wait: true }     the light stays where it is, nobody plays
 *   { t, off: true }             the light goes out
 *
 * Options
 *   seats, trial   what the child has put on the stools (see seated())
 *   help           the right animal for the first empty stool: it plays
 *                  softly from where it waits (`ghost`), so the loop is
 *                  heard whole (after two misses)
 *   from, upTo     only these places (the part played to try one out)
 *   rest           beats of dark after the row
 *
 * A group of a growing row gets as long as the right group would take. A
 * wrong group that is too big plays on after the light has gone (`dark`),
 * one that is too small leaves the light waiting.
 */
export function timeline(q, seats = [], { trial = null, help = null, from = 0, upTo = null, rest = REST } = {}) {
  const row = seated(q, seats, trial)
  const last = upTo ?? row.length - 1
  const firstEmpty = row.findIndex(t => t == null)
  const events = []
  let t = 0
  for (let place = from; place <= last; place++) {
    const token = row[place]
    const ghost = token == null && place === firstEmpty && help ? help : null
    if (q.kind !== 'grow') {
      const played = token ?? ghost
      events.push({ t, place, sub: 0, of: token ? 1 : 0, inst: played ? instOf(played) : null, ghost: !!ghost, vol: ghost ? 0.6 : 1 })
      t += 1
      continue
    }
    const inst = instOf(q.sym)
    const slot = slotAt(q, place)
    const need = slot >= 0 ? countOf(q, wantedAt(q, slot)) : countOf(q, token)
    const n = token ? countOf(q, token) : ghost ? countOf(q, ghost) : 0
    if (!n) events.push({ t, place, sub: 0, of: 0, inst: null })
    for (let k = 0; k < n; k++) {
      events.push({ t: t + k * GROW_NOTE, place, sub: k, of: token ? n : 0, inst, ghost: !!ghost, vol: ghost ? 0.6 : 1, dark: k >= need })
    }
    if (n && n < need) events.push({ t: t + n * GROW_NOTE, place, wait: true })
    if (n > need) events.push({ t: t + need * GROW_NOTE - 0.01, place, off: true })
    t += Math.max(n, need) * GROW_NOTE + GROW_GAP
  }
  events.push({ t, off: true })
  events.sort((a, b) => a.t - b.t)
  return { events, length: t + rest }
}

/**
 * Where a try-out starts: the place the round of the pattern before the
 * stool begins, so the child hears one round as it should be and then the
 * round with the animal it chose. (A growing row is short: all of it.)
 */
export function tryFrom(q, place) {
  if (q.kind === 'grow' || !q.unit?.length) return 0
  const u = q.unit.length
  return Math.max(0, place - (place % u) - u)
}

// ── The finale ──────────────────────────────────────────────────────────────
// Sixteen beats, eight steps to a bar of four. A marimba plays the tune (on
// the scale of sfx.pluck: 0 = C5, 1 = D5, 2 = E5, 3 = G5, 4 = A5, 5 = C6),
// and every animal of the big band adds its own sound in the places its
// instrument has in a bar. All of it is pentatonic: any band sounds good.
const TUNE = [
  2, null, 3, null, 4, null, 3, null,     // E G A G
  5, null, 4, 3, 2, null, null, null,     // C' A-G E
  2, null, 3, null, 4, null, 5, null,     // E G A C'
  4, 3, 4, null, 5, null, null, null,     // A-G A C'
]
const PARTS = {
  drum:    'x...x...',
  bass:    'x.....x.',
  maraca:  '..x...x.',
  cymbal:  '......x.',
  bell:    'x.......',
  xylo:    '.x...x..',
  cowbell: '....x..x',
  whistle: '.......x',
  quack:   '...x....',
  trumpet: 'x.......',
  wood:    '..xx..x.',
  guitar:  'x..x..x.',
}
export const FINALE_BPM = 124
export const FINALE_BEATS = 17
const STEP = 0.5
const LAST = 28            // the step of the tune's last note

/**
 * The finale for the instruments that are in the big band. Besides the
 * notes there is one `{ t, show: [instruments], all }` per step for the
 * eye: who hops now (`all`: the last note, everybody at once).
 */
export function finaleTune(insts) {
  const set = [...new Set(insts)].filter(i => PARTS[i])
  // the more play together, the softer each one
  const vol = Math.max(0.4, Math.min(0.9, 1.6 / Math.sqrt(set.length || 1)))
  const events = []
  for (let i = 0; i <= LAST; i++) {
    const t = i * STEP
    if (TUNE[i] != null) events.push({ t, inst: 'tune', step: TUNE[i], vol: 0.9 })
    const who = set.filter(inst => i === LAST || PARTS[inst][i % 8] === 'x')
    for (const inst of who) events.push({ t, inst, vol })
    if (who.length) events.push({ t, show: who, all: i === LAST })
  }
  return { events, length: FINALE_BEATS }
}
