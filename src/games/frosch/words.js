import { LINES } from '../../lib/lumiLines.js'
import { KEY } from '../woerter/voice.js'

// Frosch-Hüpfer: the words, and what each level asks for.

// 'HO-NIG 🍯': syllables in the right order and the picture. Every picture
// shows exactly its word, the word a five-year-old says when it sees it:
// from level 5 the hops are silent, and a picture the child names with
// another number of syllables (⚽ "Fußball", 🥕 "Karotte", 🦍 "Affe",
// ☂️ "Schirm", 🫐 "Blaubeere", 🚒 "Feuerwehrauto", 🍊 "Orange") makes it
// hop wrong. So those are left out, and no picture is used for two words
// (🐰 was both "Hase" and "Osterhase": the Osterhase now has its own picture
// with a basket of eggs; 🎈 "Luftballon" and, to most children, "Ballon").
// Hard words with hard pictures
// (Akkordeon, Butter) are out too. Words with a syllable that starts with
// CH or CK are left out: on their own those sound wrong ("Che" as "Tsche").
const parse = list => list.map(spec => {
  const [parts, emoji] = spec.split(' ')
  const syllables = parts.split('-')
  const word = syllables.join('')
  return { word, syllables, emoji, name: word[0] + word.slice(1).toLowerCase() }
})

// Only words Lumi can say whole and in parts
const recorded = w => KEY.word(w.name) in LINES && w.syllables.every(s => KEY.syllable(s) in LINES)
const pool = list => parse(list).filter(recorded)

// one syllable
const ONE = pool([
  'HUND 🐕', 'MAUS 🐭', 'FISCH 🐟', 'BAUM 🌳', 'KUH 🐄', 'STERN ⭐', 'BROT 🍞', 'BUCH 📖',
  'ZUG 🚂', 'MOND 🌙', 'HUT 🎩', 'SCHAF 🐑', 'SCHUH 👟', 'EIS 🍦', 'HAUS 🏠', 'BUS 🚌',
])
// two syllables, mostly open ones
const TWO_OPEN = pool([
  'HA-SE 🐰', 'NA-SE 👃', 'RO-SE 🌹', 'HO-SE 👖', 'E-SEL 🫏', 'I-GEL 🦔', 'TI-GER 🐯', 'LÖ-WE 🦁',
  'VO-GEL 🐦', 'RE-GEN 🌧️', 'HO-NIG 🍯', 'BIE-NE 🐝', 'EU-LE 🦉', 'ZIE-GE 🐐', 'KRO-NE 👑', 'BE-SEN 🧹',
  'FE-DER 🪶', 'AU-TO 🚗', 'BLU-ME 🌸', 'RAU-PE 🐛', 'KÄ-SE 🧀', 'SO-FA 🛋️', 'LA-MA 🦙', 'KI-WI 🥝',
  'ZE-BRA 🦓', 'DO-SE 🥫',
])
// two syllables with a closed first syllable (double consonants)
const TWO_CLOSED = pool([
  'KAT-ZE 🐱', 'SON-NE ☀️', 'AF-FE 🐒', 'EN-TE 🦆', 'AP-FEL 🍎', 'TAS-SE ☕', 'BRIL-LE 👓', 'BIR-NE 🍐',
  'GUR-KE 🥒', 'SPIN-NE 🕷️', 'KER-ZE 🕯️', 'ROB-BE 🦭', 'PIN-SEL 🖌️', 'KOF-FER 🧳', 'TEL-LER 🍽️', 'TROM-MEL 🥁',
  'PAN-DA 🐼', 'PIZ-ZA 🍕', 'WAF-FEL 🧇', 'KÜR-BIS 🎃', 'DEL-FIN 🐬', 'TRAK-TOR 🚜', 'BAL-LON 🎈', 'WOL-KE ☁️',
  'GEI-GE 🎻', 'PAL-ME 🌴', 'TOR-TE 🎂', 'KAK-TUS 🌵',
])
// three syllables (no "ng" split across two syllables: KÄN-GU-RU sounds
// different in parts than in the word)
const THREE = pool([
  'BA-NA-NE 🍌', 'E-LE-FANT 🐘', 'TO-MA-TE 🍅', 'ME-LO-NE 🍈', 'ZI-TRO-NE 🍋', 'KA-ME-RA 📷', 'GI-RAF-FE 🦒',
  'A-NA-NAS 🍍', 'RA-KE-TE 🚀', 'RO-BO-TER 🤖', 'PA-PRI-KA 🫑', 'PA-PA-GEI 🦜', 'KRO-KO-DIL 🐊', 'TROM-PE-TE 🎺',
  'GI-TAR-RE 🎸', 'ERD-BEE-RE 🍓', 'SCHMET-TER-LING 🦋', 'SCHILD-KRÖ-TE 🐢', 'LA-TER-NE 🏮', 'KO-A-LA 🐨',
])
// three syllables, longer words and compounds
const THREE_LONG = pool([
  'ZAHN-BÜRS-TE 🪥', 'TISCH-TEN-NIS 🏓', 'BRIEF-KAS-TEN 📬', 'AS-TRO-NAUT 👨‍🚀', 'KAR-TOF-FEL 🥔',
  'HUB-SCHRAU-BER 🚁', 'PO-LI-ZIST 👮', 'WEIH-NACHTS-MANN 🎅', 'KA-RUS-SELL 🎠', 'HAM-BUR-GER 🍔',
  'FLE-DER-MAUS 🦇', 'MI-KRO-FON 🎤', 'PRIN-ZES-SIN 👸', 'KO-KOS-NUSS 🥥', 'SPIN-NEN-NETZ 🕸️', 'BROK-KO-LI 🥦',
])
// four syllables (never more: five were out of reach at this age). Levels 9
// and 10 take seven or eight of them, so the list is long; the :px-…:
// pictures are drawn for exactly these words (scripts/art/).
const FOUR_LIST = [
  'TA-SCHEN-LAM-PE 🔦', 'SEI-FEN-BLA-SE 🫧', 'SCHO-KO-LA-DE 🍫', 'SON-NEN-BLU-ME 🌻', 'RE-GEN-BO-GEN 🌈',
  'KRAN-KEN-WA-GEN 🚑', 'A-VO-CA-DO 🥑', 'BA-DE-WAN-NE 🛁', 'SON-NEN-BRIL-LE 🕶️',
  'EIN-KAUFS-WA-GEN 🛒', 'KLET-TER-GE-RÜST :px-klettergeruest:', 'OS-TER-HA-SE :px-osterhase:',
  'FEU-ER-LÖ-SCHER :px-feuerloescher:', 'WERK-ZEUG-KAS-TEN :px-werkzeugkasten:', 'PUS-TE-BLU-ME :px-pusteblume:',
  'GUM-MI-STIE-FEL :px-gummistiefel:', 'PA-PIER-FLIE-GER :px-papierflieger:', 'WASCH-MA-SCHI-NE :px-waschmaschine:',
  'RA-DIER-GUM-MI :px-radiergummi:', 'KIN-DER-WA-GEN :px-kinderwagen:',
]
const FOUR = pool(FOUR_LIST)

/** Every four-syllable word, recorded or not: each must have its picture. */
export const FOUR_SOURCE = parse(FOUR_LIST)

export const POOLS = { ONE, TWO_OPEN, TWO_CLOSED, THREE, THREE_LONG, FOUR }
const ALL = [ONE, TWO_OPEN, TWO_CLOSED, THREE, THREE_LONG, FOUR].flat()
const ALL_SYLLABLES = [...new Set(ALL.flatMap(w => w.syllables))]

/**
 * The ten levels. `plan` is the level's words in order: h = a hop round
 * (one hop per syllable, then the leap ashore), b = a build round (the
 * syllables float in the pond as lily pads), the digit = syllables.
 *   speak   Lumi says each syllable as the frog lands on it (hop rounds)
 *   extra   lily pads in a build round that do not belong to the word
 *   drift   how far and fast the build pads float about (1 = gently)
 *
 * The curve: two syllables with every hop said along (1), a word of one
 * and of three syllables among them, so the child has to listen for the
 * end (2), building joins in (3–4), three and four syllables and no
 * syllable said along any more (5–6), wrong pads among the right ones
 * (7–8), four syllables, two wrong pads and a livelier pond (9–10).
 */
const LEVELS = {
  1:  { plan: 'h2 h2 h2 h2 h2 h2',           speak: true,  pools: { 2: TWO_OPEN } },
  2:  { plan: 'h2 h2 h1 h2 h3 h2 h2',        speak: true,  pools: { 1: ONE, 2: TWO_CLOSED, 3: THREE } },
  3:  { plan: 'h2 b2 h3 b2 h1 b3 h3',        speak: true,  pools: { 1: ONE, 2: [...TWO_OPEN, ...TWO_CLOSED], 3: THREE } },
  4:  { plan: 'b2 h3 b3 h2 b3 h3 b3 h3',     speak: true,  pools: { 2: TWO_CLOSED, 3: [...THREE, ...THREE_LONG] } },
  5:  { plan: 'h3 b3 h3 b4 h4 b3 h4',        speak: false, pools: { 3: [...THREE, ...THREE_LONG], 4: FOUR } },
  6:  { plan: 'h3 b4 h4 b3 h4 b4 h3 b4',     speak: false, pools: { 3: THREE_LONG, 4: FOUR }, drift: 1.3 },
  7:  { plan: 'b3 b3 h4 b4 b3 h3 b4',        speak: false, pools: { 3: [...THREE, ...THREE_LONG], 4: FOUR }, extra: 1, drift: 1.3 },
  8:  { plan: 'b4 h4 b3 b4 h3 b4 b3 b4',     speak: false, pools: { 3: THREE_LONG, 4: FOUR }, extra: 1, drift: 1.6 },
  9:  { plan: 'b4 b4 h4 b4 b4 h4 b4',        speak: false, pools: { 4: FOUR }, extra: 2, drift: 2.1 },
  10: { plan: 'b4 b4 h4 b4 b4 b4 h4 b4',     speak: false, pools: { 4: FOUR }, extra: 2, drift: 2.7 },
}

export function levelConfig(level) {
  const c = LEVELS[level] ?? LEVELS[1]
  return {
    level, speak: c.speak, extra: c.extra ?? 0, drift: c.drift ?? 1, pools: c.pools,
    plan: c.plan.split(' ').map(s => ({ kind: s[0] === 'b' ? 'build' : 'hop', n: Number(s[1]) })),
  }
}

export function shuffle(arr, rnd = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// How a syllable sounds when Lumi says it ('SEL' and 'SELL' sound the same)
const sound = s => String(LINES[KEY.syllable(s)] ?? s).toLowerCase().replace(/[^a-zäöüß]/g, '')
const VOWELS = /[aeiouäöü]+/i

/**
 * Wrong syllables for a build round: none that sounds like one of the
 * word's own, and rather ones that are easy to mix up with them (the same
 * first letter or the same vowel) than any at all.
 */
export function decoys(word, count, rnd = Math.random) {
  if (!count) return []
  const own = new Set(word.syllables.map(sound))
  const firsts = new Set(word.syllables.map(s => s[0]))
  const vowels = new Set(word.syllables.map(s => s.match(VOWELS)?.[0]))
  const scored = shuffle(ALL_SYLLABLES.filter(s => !own.has(sound(s))), rnd)
    .map(s => ({ s, near: (firsts.has(s[0]) ? 1 : 0) + (vowels.has(s.match(VOWELS)?.[0]) ? 1 : 0) }))
    .sort((a, b) => b.near - a.near)
  const out = [], taken = new Set()
  for (const { s } of scored) {
    if (taken.has(sound(s))) continue
    taken.add(sound(s))
    out.push(s)
    if (out.length === count) break
  }
  return out
}

/** How many places a build round's pads can float at (see layout.js). */
export const CELLS = 6

// The places are three by two on a screen held sideways and two by three on
// one held upright. Of a few random picks the one whose pads lie furthest
// apart on both: two pads never end up side by side in one corner.
const GRIDS = [3, 2]
function spread(count, rnd) {
  let best = null
  for (let t = 0; t < 12; t++) {
    const pick = shuffle(Array.from({ length: CELLS }, (_, i) => i), rnd).slice(0, count)
    let room = 0
    for (const cols of GRIDS) {
      let near = Infinity
      for (let a = 0; a < pick.length; a++) for (let b = a + 1; b < pick.length; b++) {
        near = Math.min(near, Math.hypot(pick[a] % cols - pick[b] % cols, Math.floor(pick[a] / cols) - Math.floor(pick[b] / cols)))
      }
      room += near
    }
    if (!best || room > best.room) best = { pick, room }
  }
  return best.pick
}

/**
 * The words of a level, in order. No picture comes twice. A build round
 * also gets its lily pads: the word's syllables and the wrong ones, each
 * with the place in the pond it floats at.
 */
export function buildRounds(level, rnd = Math.random) {
  const cfg = levelConfig(level)
  const used = new Set()
  return cfg.plan.map(({ kind, n }) => {
    const free = shuffle(cfg.pools[n] ?? [], rnd).filter(w => !used.has(w.emoji))
    // a pool that has run dry: any word of that length
    const w = free[0] ?? shuffle(ALL.filter(x => x.syllables.length === n && !used.has(x.emoji)), rnd)[0]
    used.add(w.emoji)
    if (kind === 'hop') return { kind, ...w }
    const wrong = decoys(w, cfg.extra, rnd)
    const cells = spread(w.syllables.length + wrong.length, rnd)
    const pads = [
      ...w.syllables.map((text, i) => ({ id: `s${i}`, text, real: true })),
      ...wrong.map((text, i) => ({ id: `x${i}`, text, real: false })),
    ].map((p, i) => ({ ...p, cell: cells[i], jx: rnd() * 2 - 1, jy: rnd() * 2 - 1, phase: rnd() * Math.PI * 2 }))
    return { kind, ...w, pads }
  })
}
