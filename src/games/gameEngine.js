// gameEngine.js — question generator for ChoiceGame (Musterpark)
// Every call uses fresh Math.random() so each game session is unique.
//
// A question is { kind, prompt, tokens, gapAt, options, answer, unit, names }:
//   tokens  the row, one entry per place; '❓' marks the place asked for
//   unit    the repeating part, for the spoken feedback ("Frosch, Hund")
//   names   emoji → spoken name, for every symbol in the row and the options

export function generateQuestions(moduleId, level, count = 10) {
  if (moduleId === 'patterns') return Array.from({ length: count }, () => patternsQ(level))
  return []
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function shuffle(arr)    { return [...arr].sort(() => Math.random() - 0.5) }

// ─── Patterns ────────────────────────────────────────────────────────────────
// Every symbol once, each with the word a child would use for it, so the
// feedback can say the pattern out loud. The pool used to hold duplicates
// (🐸, 🌸, 🏆 twice: the same picture twice among the answers) and
// look-alikes (🔷/🔹, ⭐/🌟, 🍁/🍂, 🔵/💙). Symbols that still look alike in
// the pixel pictures share a family (`fam`); a question takes at most one
// symbol per family.
const PATTERN_POOL = [
  { e: '🔴', n: 'Rot',        fam: 'red' },
  { e: '🔵', n: 'Blau' },
  { e: '🟡', n: 'Gelb',       fam: 'yellow' },
  { e: '🟢', n: 'Grün' },
  { e: '🟠', n: 'Orange',     fam: 'orange' },
  { e: '🟣', n: 'Lila',       fam: 'purple' },
  { e: '⭐', n: 'Stern',      fam: 'yellow' },
  { e: '🌙', n: 'Mond',       fam: 'yellow' },
  { e: '☀️', n: 'Sonne',      fam: 'yellow' },
  { e: '❤️', n: 'Herz',       fam: 'red' },
  { e: '🐸', n: 'Frosch' },
  { e: '🐶', n: 'Hund' },
  { e: '🐱', n: 'Katze' },
  { e: '🐻', n: 'Bär' },
  { e: '🐼', n: 'Panda' },
  { e: '🐰', n: 'Hase' },
  { e: '🐯', n: 'Tiger' },
  { e: '🦁', n: 'Löwe' },
  { e: '🐮', n: 'Kuh' },
  { e: '🐷', n: 'Schwein' },
  { e: '🐔', n: 'Huhn' },
  { e: '🦄', n: 'Einhorn' },
  { e: '🐙', n: 'Krake' },
  { e: '🦋', n: 'Schmetterling' },
  { e: '🐝', n: 'Biene' },
  { e: '🐢', n: 'Schildkröte' },
  { e: '🦀', n: 'Krebs',      fam: 'red' },
  { e: '🐟', n: 'Fisch',      fam: 'sea' },
  { e: '🐳', n: 'Wal',        fam: 'sea' },
  { e: '🦆', n: 'Ente' },
  { e: '🐘', n: 'Elefant' },
  { e: '🐞', n: 'Marienkäfer', fam: 'red' },
  { e: '🌸', n: 'Blüte' },
  { e: '🌻', n: 'Sonnenblume' },
  { e: '🍀', n: 'Kleeblatt' },
  { e: '🍁', n: 'Blatt' },
  { e: '🌵', n: 'Kaktus' },
  { e: '🍄', n: 'Pilz' },
  { e: '🌈', n: 'Regenbogen' },
  { e: '⛄', n: 'Schneemann' },
  { e: '🍎', n: 'Apfel',      fam: 'red' },
  { e: '🍊', n: 'Orange',     fam: 'orange' },
  { e: '🍋', n: 'Zitrone',    fam: 'yellow' },
  { e: '🍇', n: 'Trauben',    fam: 'purple' },
  { e: '🍓', n: 'Erdbeere',   fam: 'red' },
  { e: '🍒', n: 'Kirschen',   fam: 'red' },
  { e: '🍌', n: 'Banane' },
  { e: '🥕', n: 'Möhre' },
  { e: '🌽', n: 'Mais' },
  { e: '🍕', n: 'Pizza' },
  { e: '🎂', n: 'Torte' },
  { e: '🍦', n: 'Eis' },
  { e: '🍪', n: 'Keks' },
  { e: '🥨', n: 'Brezel' },
  { e: '🎈', n: 'Luftballon', fam: 'red' },
  { e: '🎁', n: 'Geschenk' },
  { e: '🔑', n: 'Schlüssel' },
  { e: '🎵', n: 'Note' },
  { e: '🚀', n: 'Rakete' },
  { e: '🏠', n: 'Haus' },
  { e: '⚽', n: 'Ball' },
  { e: '🎲', n: 'Würfel' },
  { e: '🧩', n: 'Puzzle' },
  { e: '🚗', n: 'Auto',       fam: 'red' },
]

// Symbols for one question: all different, never two of one family.
function pickSymbols(count) {
  const out = [], fams = new Set()
  for (const s of shuffle(PATTERN_POOL)) {
    if (s.fam && fams.has(s.fam)) continue
    out.push(s)
    if (s.fam) fams.add(s.fam)
    if (out.length === count) break
  }
  return out
}

// Each level adds something new. L4 and L5 used to be identical; ABCA
// ("A B C A A B C A") reads like a broken ABC to a child and now only comes
// at the very end.
//   gap  — a place in the middle of the row is missing
//   grow — a growing row: one, two, three …
const TYPES_BY_LEVEL = [
  ['AB', 'AB', 'ABB'],                          // L1
  ['AB', 'ABB', 'AAB', 'ABC'],                  // L2
  ['AAB', 'ABB', 'ABC', 'AABB'],                // L3
  ['ABC', 'AABB', 'ABBC', 'gap'],               // L4
  ['ABC', 'AABB', 'ABBC', 'gap', 'grow'],       // L5
  ['AABB', 'ABBC', 'ABAC', 'gap', 'grow'],      // L6
  ['ABBC', 'ABAC', 'ABCD', 'gap', 'grow'],      // L7
  ['ABAC', 'ABCD', 'AABC', 'gap', 'grow'],      // L8
  ['ABCD', 'AABC', 'ABCA', 'gap', 'grow'],      // L9
  ['ABCD', 'ABCA', 'AABBC', 'gap', 'grow'],     // L10
]
// The units a gap row is built from: simple ones first.
const GAP_UNITS = level => (level <= 5 ? ['AB', 'ABC'] : ['AB', 'ABB', 'AAB', 'ABC', 'AABB'])

const LETTER = { A: 0, B: 1, C: 2, D: 3 }

// The unit, started at a random place of the cycle: otherwise a row of two
// full rounds always asks for the unit's first symbol, and "tap the first
// picture of the row" wins every time.
function unitOf(type, syms) {
  const unit = [...type].map(ch => syms[LETTER[ch]].e)
  const o = rand(0, unit.length - 1)
  return [...unit.slice(o), ...unit.slice(0, o)]
}

function namesOf(syms) {
  return Object.fromEntries(syms.map(s => [s.e, s.n]))
}

// Wrong options: the other symbols of the row, padded with fresh ones from
// other families, three in all.
function wrongOptions(answer, rowSyms) {
  const others = rowSyms.filter(s => s.e !== answer)
  const fams = new Set(rowSyms.map(s => s.fam).filter(Boolean))
  const pad = shuffle(PATTERN_POOL)
    .filter(s => !rowSyms.some(r => r.e === s.e) && !(s.fam && fams.has(s.fam)))
    .slice(0, Math.max(0, 3 - others.length))
  return [...others, ...pad].slice(0, 3)
}

function patternsQ(level) {
  const pool = TYPES_BY_LEVEL[Math.min(level - 1, TYPES_BY_LEVEL.length - 1)]
  const type = pool[rand(0, pool.length - 1)]

  if (type === 'grow') return growQ(level)

  if (type === 'gap') {
    const units = GAP_UNITS(level)
    const uType = units[rand(0, units.length - 1)]
    const syms  = pickSymbols(new Set(uType).size)
    const unit  = unitOf(uType, syms)
    // Two full rounds and a bit more, so the row goes on after the gap
    const len   = Math.max(unit.length * 2 + 1, Math.min(10, unit.length * 2 + rand(1, unit.length)))
    const row   = Array.from({ length: len }, (_, i) => unit[i % unit.length])
    // Never in the first round (the pattern has to be visible before the
    // gap) and never the last place (that would be "what comes next")
    const gapAt = rand(unit.length, len - 2)
    const answer = row[gapAt]
    const opts = [syms.find(s => s.e === answer), ...wrongOptions(answer, syms)]
    return {
      kind:    'gap',
      prompt:  'Welches Bild fehlt in der Lücke?',
      tokens:  row.map((e, i) => (i === gapAt ? '❓' : e)),
      gapAt,
      options: shuffle(opts.map(s => s.e)),
      answer,
      unit,
      names:   namesOf([...syms, ...opts]),
    }
  }

  const syms   = pickSymbols(new Set(type).size)
  const unit   = unitOf(type, syms)
  // Two full rounds plus at most a part of one, and no more than nine
  // places: longer rows broke into two or three lines on a phone, right in
  // the middle of the pattern.
  const len    = Math.min(Math.max(9, unit.length * 2), unit.length * 2 + rand(0, unit.length - 1))
  const row    = Array.from({ length: len }, (_, i) => unit[i % unit.length])
  const answer = unit[len % unit.length]
  const opts   = [syms.find(s => s.e === answer), ...wrongOptions(answer, syms)]
  return {
    kind:    'next',
    prompt:  'Was kommt als Nächstes?',
    tokens:  [...row, '❓'],
    gapAt:   row.length,
    options: shuffle(opts.map(s => s.e)),
    answer,
    unit,
    names:   namesOf([...syms, ...opts]),
  }
}

// One, two, three … of the same thing: the step from repeating to growing
// patterns. The answer is the next amount.
function growQ(level) {
  const [sym] = pickSymbols(1)
  const start = level <= 7 ? 1 : rand(1, 2)
  const steps = [start, start + 1, start + 2]
  const next  = start + 3
  const group = n => sym.e.repeat(n)
  const wrong = shuffle([next - 1, next + 1, next - 2].filter(n => n >= 1)).slice(0, 3)
  return {
    kind:    'grow',
    prompt:  'Was kommt als Nächstes?',
    tokens:  [...steps.map(group), '❓'],
    gapAt:   steps.length,
    options: shuffle([next, ...wrong].map(group)),
    answer:  group(next),
    unit:    null,
    names:   {},
    counts:  [...steps, next],
    sym:     sym.e,
  }
}
