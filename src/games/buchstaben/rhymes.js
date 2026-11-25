import { LINES, line } from '../../lib/lumiLines.js'
import { slug } from './voice.js'

/**
 * What the Reim-Theater plays with: the rhyming words, the little scenes a
 * pair plays once it has found itself, the verses, and the rounds of each
 * level. No React here, so all of it is checked in tests/unit/reim.test.js.
 */

// ── Hearing a word ─────────────────────────────────────────────────────────
// A rhyme is heard, not seen: a word Lumi cannot say must never be the one
// a round depends on. The Buchstaben-Welt words live under woerter/<wort>;
// several of ours were recorded earlier for other games under wort/<wort>.
// Words recorded nowhere yet (Fliege, Reis, Strand) stay out of every round
// until they are, and then come in by themselves.
export const wordVoice = w => {
  const s = slug(w)
  for (const key of [`woerter/${s}`, `wort/${s}`]) if (LINES[key]) return line(key)
  return null
}
export const voiced = w => !!wordVoice(w)

// ── The rhyme ──────────────────────────────────────────────────────────────
const VOWELS = 'aeiouäöüy'
// vowel groups of a word: [start, end) of each run of vowels ("ie", "au", "ei")
function vowelGroups(w) {
  const low = w.toLowerCase(), out = []
  for (let i = 0; i < low.length; i++) {
    if (!VOWELS.includes(low[i])) continue
    let j = i
    while (j < low.length && VOWELS.includes(low[j])) j++
    out.push([i, j]); i = j - 1
  }
  return out
}

/**
 * The part of a word that rhymes: from its stressed vowel to the end
 * (Maus → aus, Zitrone → one, Spiegel → iegel, Hahn → ahn). All our words
 * are stressed on the last syllable, or on the one before an unstressed
 * -e / -el ending (Rose, Igel).
 */
export function rimeOf(w) {
  const g = vowelGroups(w)
  if (!g.length) return w
  const schwa = /(e|el|en|er)$/i.test(w) && g.length > 1
  return w.slice(g[g.length - (schwa ? 2 : 1)][0])
}

// Words inside a group rhyme with each other (from the stressed vowel on,
// not merely a shared last letter). Every picture shows its word and
// appears once. `v` is the rhyming vowel: groups with the same one sound
// alike (Banane – Kanne differ only in vowel length) and are kept apart
// until the "near" levels.
// `said: true`: a picture a child may name differently (the lips a
// "Kussmund", the amphora a "Krug", the fir a "Baum", the sailing boat a
// "Schiff", the flag a "Flagge"). A balloon's word is not spoken before the
// child taps (only on hover or with the speaker), so such a word is never
// the right answer that has to be found among the balloons; it is used
// where Lumi says it (the word on the stage, Ja/Nein, odd one out) or where
// the verse makes it clear. The pan is drawn empty: with an egg in it, it
// was a "Spiegelei" and stood next to the Spiegel.
export const RHYME_GROUPS = [
  { v: 'au', words: [['Maus', '🐭'], ['Haus', '🏠']] },
  { v: 'o',  words: [['Hose', '👖'], ['Rose', '🌹'], ['Dose', '🥫']] },
  { v: 'u',  words: [['Hund', '🐕'], ['Mund', '👄', true]] },
  { v: 'i',  words: [['Fisch', '🐟'], ['Tisch', ':px-tisch:']] },
  { v: 'a',  words: [['Nase', '👃'], ['Hase', '🐰'], ['Vase', '🏺', true]] },
  { v: 'u',  words: [['Kuh', '🐄'], ['Schuh', '👟']] },
  { v: 'i',  words: [['Igel', '🦔'], ['Spiegel', '🪞']] },
  { v: 'o',  words: [['Krone', '👑'], ['Zitrone', '🍋']] },
  { v: 'a',  words: [['Kanne', '🫖'], ['Tanne', '🌲', true], ['Pfanne', ':px-pfanne:']] },
  { v: 'i',  words: [['Ziege', '🐐'], ['Fliege', '🪰']] },
  { v: 'e',  words: [['Rakete', '🚀'], ['Trompete', '🎺']] },
  { v: 'a',  words: [['Banane', '🍌'], ['Fahne', '🚩', true]] },
  { v: 'ei', words: [['Eis', '🍦'], ['Reis', '🍚']] },
  { v: 'ei', words: [['Bein', '🦵'], ['Schwein', '🐖'], ['Stein', '🪨']] },
  { v: 'a',  words: [['Hahn', '🐓'], ['Zahn', '🦷']] },
  { v: 'o',  words: [['Boot', '⛵', true], ['Brot', '🍞']] },
  { v: 'a',  words: [['Hand', '✋'], ['Strand', '🏖️', true]] },
  { v: 'u',  words: [['Wurm', '🪱'], ['Turm', '🗼']] },
  { v: 'a',  words: [['Wal', '🐋'], ['Schal', '🧣']] },
].map(g => ({ ...g, words: g.words.map(([w, e, said]) => ({ w, e, said: !!said, rime: rimeOf(w) })) }))

/** The groups as far as Lumi can say them: only words with a recording. */
export const playableGroups = () => RHYME_GROUPS
  .map(g => ({ ...g, words: g.words.filter(x => voiced(x.w)) }))
  .filter(g => g.words.length > 0)

export const groupOf = w => RHYME_GROUPS.find(g => g.words.some(x => x.w === w))
export const wordOf  = w => groupOf(w).words.find(x => x.w === w)

// ── Where the pair goes in its scene ───────────────────────────────────────
// The scene must show what its sentence says. One of the two moves (the
// "mover"), the other stays (the "seat"); `at` is where the mover's middle
// ends up, in parts of the seat's size from the seat's middle (x right,
// y down), `size` its size in parts of the seat's.
//   on     sits on top and bounces (auf)
//   in     sinks into it: everything below `rim` is hidden (in, im)
//   peek   goes in and looks out of a window (im Haus)
//   front  stands in front; `mirror`: its reflection shows in the glass (vor)
//   wear   is put on the seat or held by it (mit, trägt, hat)
// `prop`: a third thing the line names, held by the mover (the ice cream in
// the mouth): placed like `at`/`size`, but in parts of the mover's size.
//   beside stands next to it (am, so … wie)
// `act` is how it plays: bounce, wobble, sink, peek, grow, brush, wave, glow.
const P = {
  mausHaus:     { how: 'peek',   at: [0.16, 0.11], size: 0.22, act: 'peek' },
  inHose:       { how: 'in',     at: [0, -0.5],  size: 0.6, rim: -0.4, act: 'sink' },
  inDose:       { how: 'in',     at: [0, -0.5],  size: 0.62, rim: -0.36, act: 'sink' },
  hoseInDose:   { how: 'in',     at: [0, -0.48], size: 0.58, rim: -0.36, act: 'sink' },
  roseGrows:    { how: 'in',     at: [0, -0.58], size: 0.66, rim: -0.36, act: 'grow' },
  grosserMund:  { how: 'wear',   at: [-0.2, -0.06], size: 0.4, act: 'grow' },
  mundEis:      { how: 'wear',   at: [-0.2, -0.06], size: 0.34, act: 'bounce', prop: { art: '🍦', at: [-0.62, -0.18], size: 0.9, rotate: -70 } },
  fischTisch:   { how: 'on',     at: [0, -0.5],  size: 0.62, act: 'bounce' },
  fischAmTisch: { how: 'beside', at: [0.66, -0.02], size: 0.6, act: 'bounce' },
  langeNase:    { how: 'wear',   at: [-0.17, -0.02], size: 0.24, act: 'grow' },
  roteNase:     { how: 'wear',   at: [-0.17, -0.02], size: 0.22, act: 'glow', red: true },
  haseInVase:   { how: 'in',     at: [0, -0.62], size: 0.62, rim: -0.42, act: 'sink' },
  vaseAufNase:  { how: 'on',     at: [0, -0.66], size: 0.5, act: 'wobble' },
  kuhImSchuh:   { how: 'in',     at: [0.06, -0.3], size: 0.56, rim: -0.1, act: 'sink' },
  schuhAnKuh:   { how: 'wear',   at: [-0.22, 0.36], size: 0.32, act: 'bounce' },
  igelSpiegel:  { how: 'front',  at: [0.3, 0.24], size: 0.56, mirror: [0, -0.16, 0.36], act: 'peek' },
  kroneAuf:     { how: 'wear',   at: [-0.06, -0.52], size: 0.5, act: 'bounce' },
  gelbWie:      { how: 'beside', at: [0.72, 0], size: 0.8, act: 'glow' },
  aufTanne:     { how: 'on',     at: [0, -0.56], size: 0.46, act: 'wobble' },
  kanneInPfanne:{ how: 'in',     at: [-0.12, -0.14], size: 0.5, act: 'wobble', flat: true },
  fliegeAufZiege:{ how: 'on',    at: [0.08, -0.34], size: 0.34, act: 'bounce' },
  fliegeFangen: { how: 'wear',   at: [-0.34, -0.24], size: 0.3, act: 'brush' },
  aufRakete:    { how: 'on',     at: [0.18, -0.58], size: 0.5, act: 'bounce' },
  fahneBanane:  { how: 'on',     at: [0.36, -0.6], size: 0.5, act: 'wave' },
  eisReis:      { how: 'on',     at: [0, -0.5],  size: 0.52, act: 'bounce' },
  schweinBein:  { how: 'on',     at: [0.04, -0.6], size: 0.56, act: 'wobble' },
  beinStein:    { how: 'on',     at: [0, -0.48], size: 0.6, act: 'bounce' },
  schweinStein: { how: 'on',     at: [0, -0.44], size: 0.66, act: 'bounce' },
  hahnZahn:     { how: 'wear',   at: [-0.36, -0.22], size: 0.26, act: 'bounce' },
  zahnPutzen:   { how: 'wear',   at: [-0.36, -0.22], size: 0.26, act: 'brush' },
  brotBoot:     { how: 'in',     at: [0.18, 0.18], size: 0.38, rim: 0.25, act: 'sink' },
  handStrand:   { how: 'beside', at: [0.16, 0.3], size: 0.38, act: 'wave' },
  wurmTurm:     { how: 'on',     at: [0, -0.53], size: 0.42, act: 'bounce' },
  schalWal:     { how: 'wear',   at: [-0.12, 0.06], size: 0.5, act: 'wobble' },
}

// The little scene a pair plays: nonsense, because that is what children
// love about rhymes. `first`/`second` are the words in the order of the
// line (its recording is reim/szene-<first>-<second>); `mover` is the one
// that moves, `place` where it goes.
export const SCENES = [
  { line: 'Die Maus im Haus!',               first: 'Maus',     second: 'Haus',    mover: 'Maus',     place: P.mausHaus },
  { line: 'Die Rose in der Hose!',           first: 'Rose',     second: 'Hose',    mover: 'Rose',     place: P.inHose },
  { line: 'Die Hose in der Dose!',           first: 'Hose',     second: 'Dose',    mover: 'Hose',     place: P.hoseInDose },
  { line: 'Die Rose in der Dose!',           first: 'Rose',     second: 'Dose',    mover: 'Rose',     place: P.inDose },
  { line: 'Der Hund mit dem großen Mund!',   first: 'Hund',     second: 'Mund',    mover: 'Mund',     place: P.grosserMund },
  { line: 'Der Fisch auf dem Tisch!',        first: 'Fisch',    second: 'Tisch',   mover: 'Fisch',    place: P.fischTisch },
  { line: 'Der Hase mit der langen Nase!',   first: 'Hase',     second: 'Nase',    mover: 'Nase',     place: P.langeNase },
  { line: 'Der Hase in der Vase!',           first: 'Hase',     second: 'Vase',    mover: 'Hase',     place: P.haseInVase },
  { line: 'Die Vase auf der Nase!',          first: 'Vase',     second: 'Nase',    mover: 'Vase',     place: P.vaseAufNase },
  { line: 'Die Kuh im Schuh!',               first: 'Kuh',      second: 'Schuh',   mover: 'Kuh',      place: P.kuhImSchuh },
  { line: 'Der Igel vor dem Spiegel!',       first: 'Igel',     second: 'Spiegel', mover: 'Igel',     place: P.igelSpiegel },
  { line: 'Die Zitrone mit der Krone!',      first: 'Zitrone',  second: 'Krone',   mover: 'Krone',    place: P.kroneAuf },
  { line: 'Die Kanne auf der Tanne!',        first: 'Kanne',    second: 'Tanne',   mover: 'Kanne',    place: P.aufTanne },
  { line: 'Die Kanne in der Pfanne!',        first: 'Kanne',    second: 'Pfanne',  mover: 'Kanne',    place: P.kanneInPfanne },
  { line: 'Die Pfanne auf der Tanne!',       first: 'Pfanne',   second: 'Tanne',   mover: 'Pfanne',   place: P.aufTanne },
  { line: 'Die Fliege auf der Ziege!',       first: 'Fliege',   second: 'Ziege',   mover: 'Fliege',   place: P.fliegeAufZiege },
  { line: 'Die Trompete auf der Rakete!',    first: 'Trompete', second: 'Rakete',  mover: 'Trompete', place: P.aufRakete },
  { line: 'Die Fahne auf der Banane!',       first: 'Fahne',    second: 'Banane',  mover: 'Fahne',    place: P.fahneBanane },
  { line: 'Das Eis auf dem Reis!',           first: 'Eis',      second: 'Reis',    mover: 'Eis',      place: P.eisReis },
  { line: 'Das Schwein auf einem Bein!',     first: 'Schwein',  second: 'Bein',    mover: 'Schwein',  place: P.schweinBein },
  { line: 'Das Bein auf dem Stein!',         first: 'Bein',     second: 'Stein',   mover: 'Bein',     place: P.beinStein },
  { line: 'Das Schwein auf dem Stein!',      first: 'Schwein',  second: 'Stein',   mover: 'Schwein',  place: P.schweinStein },
  { line: 'Der Hahn mit dem Zahn!',          first: 'Hahn',     second: 'Zahn',    mover: 'Zahn',     place: P.hahnZahn },
  { line: 'Das Brot im Boot!',               first: 'Brot',     second: 'Boot',    mover: 'Brot',     place: P.brotBoot },
  { line: 'Die Hand am Strand!',             first: 'Hand',     second: 'Strand',  mover: 'Hand',     place: P.handStrand },
  { line: 'Der Wurm auf dem Turm!',          first: 'Wurm',     second: 'Turm',    mover: 'Wurm',     place: P.wurmTurm },
  { line: 'Der Wal mit dem Schal!',          first: 'Wal',      second: 'Schal',   mover: 'Schal',    place: P.schalWal },
].map(s => ({ ...s, key: `reim/szene-${slug(s.first)}-${slug(s.second)}` }))

const pairKey = (a, b) => [a, b].sort().join('|')
const SCENE_BY_PAIR = Object.fromEntries(SCENES.map(s => [pairKey(s.first, s.second), s]))
/** The scene of two rhyming words (in any order) */
export const sceneOf = (a, b) => SCENE_BY_PAIR[pairKey(a, b)] ?? null

// Little verses whose last word rhymes with an earlier one (recorded as
// reim/vers-<base> up to the gap, reim/vers-<base>-ganz complete). `not`:
// words that would finish the sentence well without rhyming ("Der Hase hat
// eine rote … Rose"); they are never offered for this verse. `mover` and
// `place`: the verse's own picture.
export const VERSES = [
  { line: 'Die Maus wohnt in einem …',        base: 'Maus',    answer: 'Haus',     mover: 'Maus',     place: P.mausHaus,
    not: ['Boot', 'Turm', 'Schuh', 'Tanne', 'Dose', 'Vase', 'Kanne', 'Stein'] },
  { line: 'Die Kuh trägt einen …',            base: 'Kuh',     answer: 'Schuh',    mover: 'Schuh',    place: P.schuhAnKuh,
    not: ['Schal', 'Krone', 'Hose', 'Fahne', 'Kanne', 'Eis', 'Stein', 'Brot'] },
  { line: 'Die Ziege fängt eine …',           base: 'Ziege',   answer: 'Fliege',   mover: 'Fliege',   place: P.fliegeFangen,
    not: ['Fisch', 'Maus', 'Wurm', 'Hase', 'Wal'] },
  { line: 'Der Fisch sitzt am …',             base: 'Fisch',   answer: 'Tisch',    mover: 'Fisch',    place: P.fischAmTisch,
    not: ['Strand', 'Boot', 'Stein', 'Turm', 'Haus', 'Tanne'] },
  { line: 'Der Hase hat eine rote …',         base: 'Hase',    answer: 'Nase',     mover: 'Nase',     place: P.roteNase,
    not: ['Rose', 'Hose', 'Fahne', 'Dose', 'Rakete', 'Schal', 'Mund', 'Zitrone', 'Krone', 'Kanne'] },
  { line: 'Das Schwein sitzt auf einem …',    base: 'Schwein', answer: 'Stein',    mover: 'Schwein',  place: P.schweinStein,
    not: ['Tisch', 'Turm', 'Boot', 'Tanne', 'Haus', 'Schuh', 'Strand'] },
  { line: 'Der Igel schaut in den …',         base: 'Igel',    answer: 'Spiegel',  mover: 'Igel',     place: P.igelSpiegel,
    not: ['Mund', 'Schuh', 'Haus', 'Dose', 'Kanne', 'Vase', 'Boot', 'Turm', 'Pfanne'] },
  { line: 'Auf der Rakete spielt Lumi …',     base: 'Rakete',  answer: 'Trompete', mover: 'Trompete', place: P.aufRakete,
    not: [] },
  { line: 'Der Hahn putzt sich den …',        base: 'Hahn',    answer: 'Zahn',     mover: 'Zahn',     place: P.zahnPutzen,
    not: ['Nase', 'Mund', 'Bein', 'Hand', 'Schuh', 'Hose', 'Schal'] },
  { line: 'Im Boot isst Lumi …',              base: 'Boot',    answer: 'Brot',     mover: 'Brot',     place: P.brotBoot,
    not: ['Banane', 'Fisch', 'Eis', 'Reis', 'Zitrone'] },
  { line: 'Der Hund hat ein Eis im …',        base: 'Hund',    answer: 'Mund',     mover: 'Mund',     place: P.mundEis,
    not: ['Schuh', 'Haus', 'Boot', 'Dose', 'Vase', 'Kanne', 'Hand', 'Pfanne', 'Turm'] },
  { line: 'Die Krone ist so gelb wie eine …', base: 'Krone',   answer: 'Zitrone',  mover: 'Zitrone',  place: P.gelbWie,
    not: ['Banane', 'Eis', 'Strand', 'Fahne'] },
  { line: 'Der Wal trägt einen …',            base: 'Wal',     answer: 'Schal',    mover: 'Schal',    place: P.schalWal,
    not: ['Krone', 'Hose', 'Schuh', 'Fahne', 'Kanne', 'Stein', 'Eis', 'Brot'] },
  { line: 'Der Wurm klettert auf den …',      base: 'Wurm',    answer: 'Turm',     mover: 'Wurm',     place: P.wurmTurm,
    not: ['Tanne', 'Stein', 'Tisch', 'Haus', 'Boot', 'Schuh', 'Rakete'] },
  { line: 'Die Rose wächst in einer …',       base: 'Rose',    answer: 'Dose',     mover: 'Rose',     place: P.roseGrows,
    not: ['Vase', 'Kanne', 'Schuh', 'Pfanne', 'Boot', 'Tanne'] },
].map(v => ({ ...v, slug: slug(v.base) }))

/** A verse can be played once its two recordings and its answer's word exist. */
export const verseReady = v => !!LINES[`reim/vers-${v.slug}`] && !!LINES[`reim/vers-${v.slug}-ganz`] && voiced(v.answer)

// ── Levels ─────────────────────────────────────────────────────────────────
// pick: Was reimt sich auf …? (shoot the balloon)   yesno: Reimt sich das?
// (the trapeze)   odd: Welches reimt sich nicht? (the hook)   verse: finish
// the verse (shoot the balloon). `near`: one wrong answer sounds almost
// like a rhyme. `drift`: how fast the balloons drift (1 = calm).
export const LEVELS = [
  { mode: 'pick',  options: 2, drift: 0.6 },
  { mode: 'pick',  options: 3, drift: 0.8 },
  { mode: 'pick',  options: 4, drift: 1 },
  { mode: 'yesno' },
  { mode: 'odd',   options: 3 },
  { mode: 'pick',  options: 5, near: true, drift: 1.35 },
  { mode: 'odd',   options: 3, near: true },
  { mode: 'verse', options: 3, drift: 1.1 },
  { mode: 'verse', options: 4, drift: 1.4 },
  { mode: 'verse', options: 5, near: true, drift: 1.8 },
]
export const levelCfg = level => LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))]

export const shuffle = (a, rnd = Math.random) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]] }
  return b
}

/**
 * Words that do not rhyme with group `g`: one per other group, so no two of
 * them rhyme with each other; none starting like `first`, none in `not`.
 * With `near`, the first one has the same vowel (Kanne for Banane).
 */
export function nonRhymes(g, n, { near = false, first, not = [], groups = playableGroups(), rnd = Math.random } = {}) {
  const own = groupOf(g.words[0].w)
  const others = groups.filter(x => groupOf(x.words[0].w) !== own)
  const pickFrom = list => shuffle(list, rnd)
    .map(x => shuffle(x.words.filter(o => o.w[0] !== first && !not.includes(o.w)), rnd)[0])
    .filter(Boolean)
  const alike = pickFrom(others.filter(x => x.v === g.v))
  const rest  = pickFrom(others.filter(x => x.v !== g.v))
  return (near ? [...alike.slice(0, 1), ...rest] : rest).slice(0, n)
}

/** The rounds of a level. */
export function buildRounds(level, { count = 8, rnd = Math.random } = {}) {
  const cfg = levelCfg(level)
  const groups = playableGroups()
  if (cfg.mode === 'verse') {
    const verses = shuffle(VERSES.filter(verseReady), rnd)
    return Array.from({ length: count }, (_, i) => {
      const v = verses[i % verses.length]
      const g = groupOf(v.answer), correct = wordOf(v.answer)
      const wrong = nonRhymes(g, cfg.options - 1, { near: cfg.near, first: v.base[0], not: v.not, groups, rnd })
      return { mode: 'verse', verse: v, base: wordOf(v.base), correct, options: shuffle([correct, ...wrong], rnd), drift: cfg.drift }
    })
  }
  // a group can carry a round once two of its words can be said
  const pairs = shuffle(groups.filter(g => g.words.length >= 2), rnd)
  // Ja/Nein: exactly half of the pairs rhyme, in random order (a child who
  // always says "Nein" must not win); the others are clearly different
  const halves = shuffle(Array.from({ length: count }, (_, i) => i < count / 2), rnd)
  return Array.from({ length: count }, (_, i) => {
    const g = pairs[i % pairs.length]
    if (cfg.mode === 'yesno') {
      const [base, partner] = shuffle(g.words, rnd)
      const rhymes = halves[i]
      return { mode: 'yesno', base, other: rhymes ? partner : nonRhymes(g, 1, { first: base.w[0], groups, rnd })[0], rhymes }
    }
    if (cfg.mode === 'odd') {
      const [base, partner] = shuffle(g.words, rnd)
      const odd = nonRhymes(g, 1, { near: cfg.near, first: base.w[0], groups, rnd })[0]
      return { mode: 'odd', base, partner, correct: odd, options: shuffle([base, partner, odd], rnd) }
    }
    // pick: the one to be found among the balloons must be nameable at a glance
    const partner = shuffle(g.words.filter(x => !x.said), rnd)[0]
    const base = shuffle(g.words.filter(x => x !== partner), rnd)[0]
    return { mode: 'pick', base, correct: partner, drift: cfg.drift,
      options: shuffle([partner, ...nonRhymes(g, cfg.options - 1, { near: cfg.near, first: base.w[0], groups, rnd })], rnd) }
  })
}
