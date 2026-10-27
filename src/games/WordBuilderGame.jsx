import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import HearOptions from '../components/HearOptions.jsx'
import { sfx } from '../sfx.js'
import { narrate, afterNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import { sayNumber } from '../tts.js'
import { INK, pxCard, pxPanel, pxBubble, pxButton, pxSegment } from './px.js'

/**
 * Silben-Spaß — Silben hören, klatschen und zu Wörtern zusammenbauen
 *
 * Scientific basis:
 *   • Phonological Awareness (Adams 1990; Goswami 2001) — explicit manipulation
 *     of syllable units is the strongest predictor of early reading success.
 *   • Segmentation before blending — for four- to six-year-olds the core skill
 *     is hearing the parts of a spoken word (clapping them), so the first
 *     levels mix clapping rounds with building rounds.
 *   • Blending research — children who practice assembling syllables into
 *     words score significantly higher on later decoding tasks.
 *   • Worked-example effect — the picture of the object is a semantic scaffold
 *     that reduces cognitive load while learning.
 */

// ── Word Data ──────────────────────────────────────────────────────────────────
// 'HO-NIG 🍯': syllables in the right order and the picture. Every picture
// shows exactly its word (KÜCHE was a frying pan, BRUDER any boy, STAUBSAUGER
// a spiral). Words with a syllable that starts with CH or CK are left out:
// spoken on their own those come out wrong ("Che" as "Tsche", "Cke" spelled out).
const parse = list => list.map(spec => {
  const [parts, emoji] = spec.split(' ')
  const syllables = parts.split('-')
  const word = syllables.join('')
  return { word, syllables, emoji, name: word[0] + word.slice(1).toLowerCase() }
})

// 2 syllables, mostly open ones
const P1 = parse([
  'HA-SE 🐰', 'NA-SE 👃', 'RO-SE 🌹', 'HO-SE 👖', 'E-SEL 🫏', 'I-GEL 🦔', 'TI-GER 🐯', 'LÖ-WE 🦁',
  'VO-GEL 🐦', 'RE-GEN 🌧️', 'HO-NIG 🍯', 'BIE-NE 🐝', 'EU-LE 🦉', 'ZIE-GE 🐐', 'KRO-NE 👑', 'BE-SEN 🧹',
  'FE-DER 🪶', 'AU-TO 🚗', 'BLU-ME 🌸', 'RAU-PE 🐛', 'KÄ-SE 🧀', 'SO-FA 🛋️', 'LA-MA 🦙', 'KI-WI 🥝',
  'ZE-BRA 🦓', 'MÖH-RE 🥕', 'DO-SE 🥫',
])
// 2 syllables with a closed first syllable (double consonants)
const P2 = parse([
  'KAT-ZE 🐱', 'SON-NE ☀️', 'AF-FE 🐒', 'EN-TE 🦆', 'AP-FEL 🍎', 'TAS-SE ☕', 'BRIL-LE 👓', 'BIR-NE 🍐',
  'GUR-KE 🥒', 'SPIN-NE 🕷️', 'KER-ZE 🕯️', 'ROB-BE 🦭', 'PIN-SEL 🖌️', 'KOF-FER 🧳', 'TEL-LER 🍽️', 'TROM-MEL 🥁',
  'PAN-DA 🐼', 'PIZ-ZA 🍕', 'WAF-FEL 🧇', 'KÜR-BIS 🎃', 'DEL-FIN 🐬', 'TRAK-TOR 🚜', 'BUT-TER 🧈', 'WOL-KE ☁️',
  'GEI-GE 🎻', 'PAL-ME 🌴', 'TOR-TE 🎂', 'KAK-TUS 🌵',
])
// 3 syllables (no "ng" split across two syllables: KÄN-GU-RU sounds
// different in parts than in the word)
const P3 = parse([
  'BA-NA-NE 🍌', 'E-LE-FANT 🐘', 'TO-MA-TE 🍅', 'ME-LO-NE 🍈', 'ZI-TRO-NE 🍋', 'KA-ME-RA 📷', 'GI-RAF-FE 🦒',
  'A-NA-NAS 🍍', 'RA-KE-TE 🚀', 'RO-BO-TER 🤖', 'PA-PRI-KA 🫑', 'PA-PA-GEI 🦜', 'KRO-KO-DIL 🐊', 'TROM-PE-TE 🎺',
  'GI-TAR-RE 🎸', 'ERD-BEE-RE 🍓', 'SCHMET-TER-LING 🦋', 'SCHILD-KRÖ-TE 🐢', 'LA-TER-NE 🏮',
])
// 3 syllables, longer words and compounds
const P4 = parse([
  'FEU-ER-WEHR 🚒', 'ZAHN-BÜRS-TE 🪥', 'SU-PER-MARKT 🛒', 'TISCH-TEN-NIS 🏓', 'BRIEF-KAS-TEN 📬',
  'LUFT-BAL-LON 🎈', 'RE-GEN-SCHIRM ☂️', 'AS-TRO-NAUT 👨‍🚀', 'KAR-TOF-FEL 🥔', 'HUB-SCHRAU-BER 🚁',
  'PO-LI-ZIST 👮', 'WEIH-NACHTS-MANN 🎅', 'KA-RUS-SELL 🎠', 'HAM-BUR-GER 🍔', 'FLE-DER-MAUS 🦇',
  'GO-RIL-LA 🦍', 'MI-KRO-FON 🎤', 'PRIN-ZES-SIN 👸', 'KO-KOS-NUSS 🥥', 'SPIN-NEN-NETZ 🕸️', 'BROK-KO-LI 🥦',
])
// 4 syllables (never more: five-syllable words were out of reach at this age)
const P5 = parse([
  'TA-SCHEN-LAM-PE 🔦', 'SEI-FEN-BLA-SE 🫧', 'SCHO-KO-LA-DE 🍫', 'SON-NEN-BLU-ME 🌻', 'RE-GEN-BO-GEN 🌈',
  'OS-TER-HA-SE 🐰', 'KRAN-KEN-WA-GEN 🚑', 'A-VO-CA-DO 🥑', 'KO-A-LA-BÄR 🐨', 'AK-KOR-DE-ON 🪗',
  'BA-DE-WAN-NE 🛁', 'MAN-DA-RI-NE 🍊', 'HEI-DEL-BEE-RE 🫐',
])
// One-syllable words, for the clapping rounds
const ONE = parse([
  'HUND 🐕', 'MAUS 🐭', 'FISCH 🐟', 'BAUM 🌳', 'KUH 🐄', 'BALL ⚽', 'STERN ⭐', 'BROT 🍞', 'BUCH 📖',
  'ZUG 🚂', 'MOND 🌙', 'HUT 🎩', 'SCHAF 🐑', 'FROSCH 🐸', 'SCHUH 👟', 'EIS 🍦', 'HAUS 🏠', 'BUS 🚌',
])

// Every level its own mix (before, levels 1+2, 3+4 … played the same list):
// clap = a clapping round before each building round, counting up to that
// many syllables; extra = syllable tiles that do not belong to the word.
const LEVELS = {
  1:  { pool: P1,                clap: 3 },
  2:  { pool: P2,                clap: 3 },
  3:  { pool: P3,                clap: 4 },
  4:  { pool: [...P1, ...P2],    extra: 1 },
  5:  { pool: P3,                extra: 1 },
  6:  { pool: P4 },
  7:  { pool: P5 },
  8:  { pool: [...P4, ...P5],    extra: 1 },
  9:  { pool: P5,                extra: 2 },
  10: { pool: [...P4, ...P5],    extra: 2, clap: 4 },
}
const ROUNDS = 8
const ALL_SYLLABLES = [...new Set([P1, P2, P3, P4, P5].flat().flatMap(w => w.syllables))]

// Spoken on its own, a syllable is read as a word of its own, and the
// voice gets the vowel wrong: "GEL" like hair gel, "GEN" like a gene, "NIG"
// as "Nick". These spellings are only what the voice reads — the tile shows
// the real syllable. A doubled consonant keeps the vowel short, which is
// much closer to the unstressed e in the word.
const SAY = {
  NIG: 'nich', CA: 'ka',
  GEL: 'gell', SEL: 'sell', FEL: 'fell', MEL: 'mell', DEL: 'dell',
  GEN: 'genn', SEN: 'senn', TEN: 'tenn', NEN: 'nenn', SCHEN: 'schenn', KEN: 'kenn', FEN: 'fenn', MEN: 'menn',
}
const say = syl => SAY[syl] ?? syl.toLowerCase()
// Syllables one after another with a short pause, as Lumi would clap them
const syllableParts = (w, gap = 380) => w.syllables.map((s, i) => ({ text: say(s), rate: 0.6, gap: i ? gap : 250 }))
const spokenSyllables = w => w.syllables.map(say).join(', ')

const COUNT_WORDS = ['einmal', 'zweimal', 'dreimal', 'viermal']
const countSentence = n => (n === 1 ? 'Eine Silbe!' : `${sayNumber(n)[0].toUpperCase()}${sayNumber(n).slice(1)} Silben!`)

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

// Clapping words spread over every count from 1 to max, so the answer is not
// always the same number.
function pickClapWords(n, max, usedEmoji) {
  const candidates = [ONE, P1, P2, P3, P4, P5].flat()
    .filter(w => w.syllables.length <= max && !usedEmoji.has(w.emoji))
  const counts = shuffle(Array.from({ length: n }, (_, i) => (i % max) + 1))
  const out = []
  for (const c of counts) {
    const free = candidates.filter(x => !out.some(o => o.emoji === x.emoji))
    const w = shuffle(free.filter(x => x.syllables.length === c))[0] ?? shuffle(free)[0]
    if (w) out.push(w)
  }
  return out
}

function buildRounds(level) {
  const cfg = LEVELS[level] ?? LEVELS[1]
  const buildCount = cfg.clap ? ROUNDS / 2 : ROUNDS
  // one picture per round: no two words with the same picture in a level
  const build = shuffle(cfg.pool)
    .filter((w, i, all) => all.findIndex(x => x.emoji === w.emoji) === i)
    .slice(0, buildCount)
  const seen = new Set(build.map(w => w.emoji))
  const rounds = build.map(w => {
    const extras = shuffle(ALL_SYLLABLES.filter(s => !w.syllables.includes(s))).slice(0, cfg.extra ?? 0)
    return {
      kind: 'build', ...w,
      tiles: shuffle([
        ...w.syllables.map((text, i) => ({ id: i, text })),
        ...extras.map((text, i) => ({ id: 100 + i, text, extra: true })),
      ]),
    }
  })
  if (!cfg.clap) return rounds
  const claps = pickClapWords(ROUNDS / 2, cfg.clap, seen).map(w => ({ kind: 'clap', ...w, max: cfg.clap }))
  return claps.flatMap((c, i) => [c, rounds[i]]).filter(Boolean)
}

// ── Tile ────────────────────────────────────────────────────────────────────
function SyllableTile({ text, used, rejected, hinted, onClick }) {
  return (
    <motion.button
      layout
      initial={{ scale: 0, opacity: 0 }}
      animate={
        rejected ? { x: [0, -9, 9, -7, 7, 0], scale: 1, opacity: 1, y: 0 }
        : used   ? { scale: 0.7, opacity: 0.3, y: 0 }
        : hinted ? { scale: [1, 1.1, 1], opacity: 1, y: 0, transition: { duration: 1.1, repeat: Infinity } }
                 : { scale: 1, opacity: 1, y: 0 }
      }
      whileHover={!used ? { scale: 1.12, y: -5 } : {}}
      whileTap={!used ? { scale: 0.88 } : {}}
      onClick={onClick}
      {...hearable(say(text), { rate: 0.6, enabled: !used })}
      style={{
        // 3px less padding than before: the ink frame takes its place
        minWidth: 64, minHeight: 56, padding: '13px 19px',
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(22px,5vw,32px)', fontWeight: 900,
        letterSpacing: 2,
        ...pxCard(rejected ? 'wrong' : hinted ? 'selected' : undefined),
        ...(hinted && !rejected ? { background: 'var(--px-gold)' } : null),
        ...(used && !rejected ? { background: '#FFF1D6', boxShadow: 'none' } : null),
        color: rejected ? '#C2412D' : used ? 'var(--px-ink-soft)' : INK,
        cursor: used ? 'default' : 'pointer',
        transition: 'background 0.25s, color 0.25s',
        pointerEvents: used ? 'none' : 'auto',
      }}
    >{text}</motion.button>
  )
}

// ── Word slots ─────────────────────────────────────────────────────────────
function WordSlot({ text, isDone, isFirst, isLast, only }) {
  // When merged: remove inner padding so letters sit flush against each other
  const pad = 'clamp(12px,3vw,24px)'
  const pl = isDone && !isFirst && !only ? '0' : pad
  const pr = isDone && !isLast  && !only ? '0' : pad

  const br = isDone
    ? only    ? '12px'
    : isFirst ? '12px 0 0 12px'
    : isLast  ? '0 12px 12px 0'
    : '0'
    : '12px'

  return (
    <motion.div
      transition={{ duration: 0.4 }}
      style={{
        padding: `16px ${pr} 16px ${pl}`,
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(22px,5vw,32px)', fontWeight: 900,
        letterSpacing: isDone ? 0 : 2,
        ...pxCard(isDone ? 'right' : text ? 'selected' : undefined),
        ...(!isDone && !text ? { background: '#FFF1D6', border: `3px dashed ${INK}`, boxShadow: 'inset 0 4px 0 rgba(42,27,61,0.08)' } : null),
        // merged word: one frame around all parts, no seams between them
        ...(isDone && !only ? {
          borderLeftWidth:  isFirst ? 3 : 0,
          borderRightWidth: isLast  ? 3 : 0,
        } : null),
        color: isDone ? '#1F6B2A' : text ? INK : 'var(--px-ink-soft)',
        borderRadius: br,
        outline: 'none',
        transition: 'background 0.35s, border-radius 0.35s, box-shadow 0.35s, border 0.35s, padding 0.35s, letter-spacing 0.35s',
        minHeight: 60, minWidth: isDone ? 0 : 64,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        whiteSpace: 'nowrap', boxSizing: 'border-box',
      }}
    >
      {text || '?'}
    </motion.div>
  )
}

// Hands for the clapping answers: "👏👏👏" reads without reading
function Claps({ n, size }) {
  return <span style={{ fontSize: size, lineHeight: 1, letterSpacing: -2 }}>{'👏'.repeat(n)}</span>
}

// ── Main Game ──────────────────────────────────────────────────────────────
export default function WordBuilderGame({ level = 1, onComplete }) {
  const [rounds]   = useState(() => buildRounds(level))
  const cfg        = LEVELS[level] ?? LEVELS[1]
  const total      = rounds.length

  const [idx,        setIdx]        = useState(0)
  const [placed,     setPlaced]     = useState([])   // tiles placed so far
  const [rejectedId, setRejectedId] = useState(null)
  const [slotMisses, setSlotMisses] = useState(0)    // wrong taps for the current slot
  const [roundMiss,  setRoundMiss]  = useState(false)
  const [wrongClaps, setWrongClaps] = useState([])
  const [solved,     setSolved]     = useState(false)
  const [mood,       setMood]       = useState('happy')
  const [showWeiter, setShowWeiter] = useState(false)
  const feedbackTimeout = useRef(null)
  const firstTryRef     = useRef(0)

  const round = rounds[idx]
  const isBuild = round.kind === 'build'
  const usedIds = useMemo(() => new Set(placed.map(t => t.id)), [placed])
  const expected = isBuild ? round.syllables[placed.length] : null

  // What the word sounds like, for the 🔊 next to the picture
  const wordParts = useMemo(() => (round.kind === 'clap' && round.max === 4
    ? [{ text: round.name }]
    : [{ text: round.name }, ...syllableParts(round)]), [round])

  // The task, at the start of every round. For a child who cannot read the
  // tiles, hearing the word in its parts is what makes it solvable at all.
  useEffect(() => {
    const firstOfKind = rounds.findIndex(r => r.kind === round.kind) === idx
    if (round.kind === 'clap') {
      // Early levels clap along with Lumi; from three-syllable words on the
      // child hears only the word and finds the parts alone.
      const modelled = round.max < 4
      narrate([
        { text: firstOfKind ? 'Hör gut zu und klatsch mit!' : 'Klatsch mit!' },
        { text: round.name, gap: 200 },
        ...(modelled ? syllableParts(round) : []),
        { text: 'Wie oft hast du geklatscht?', gap: 300 },
      ])
    } else {
      const extraNote = cfg.extra === 1 ? ' Eine Silbe gehört nicht dazu.' : cfg.extra > 1 ? ' Zwei Silben gehören nicht dazu.' : ''
      narrate([
        ...(firstOfKind ? [{ text: `Bau das Wort aus den Silben!${extraNote}` }] : []),
        { text: round.name, gap: firstOfKind ? 200 : 0 },
        ...syllableParts(round),
      ])
    }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const roundDone = useCallback((firstTry) => {
    clearTimeout(feedbackTimeout.current)
    if (firstTry) firstTryRef.current += 1
    setSolved(true)
    setMood('excited')
    sfx.correct()
  }, [])

  // ── Building ──
  const clickTile = useCallback((tile) => {
    if (solved) return

    // Check the syllable against the slot it would fill, right now. Comparing
    // by text (not id) keeps words with a repeated syllable working: either
    // PA tile fits either slot of PA-PA-GEI.
    if (tile.text !== expected) {
      clearTimeout(feedbackTimeout.current)
      setRejectedId(tile.id)
      setSlotMisses(m => m + 1)
      setRoundMiss(true)
      setMood('encouraging')
      sfx.wrong()
      // say what the tile was, and what is wanted — that is how a child who
      // cannot read the tiles finds the right one
      sayWrong(tile.extra
        ? `Das ist ${say(tile.text)}. Das gehört nicht zu ${round.name}.`
        : `Das ist ${say(tile.text)}. Hör mal, ${spokenSyllables(round)}. Jetzt kommt ${say(expected)}.`)
      feedbackTimeout.current = setTimeout(() => {
        setRejectedId(null)
        setMood('happy')
      }, 700)
      return
    }

    setRejectedId(null)
    setSlotMisses(0)
    const newPlaced = [...placed, tile]
    setPlaced(newPlaced)

    if (newPlaced.length === round.syllables.length) {
      roundDone(!roundMiss)
      // The last syllable finishes before the whole word is read back — a
      // fixed 600 ms cut it off in almost every round.
      narrate([{ text: say(tile.text), rate: 0.6 }], {
        onEnd: () => sayRight(`${spokenSyllables(round)}, ${round.name}!`),
      })
      afterNarration(() => setShowWeiter(true), { minMs: 1200, maxMs: 9000 })
    } else {
      narrate([{ text: say(tile.text), rate: 0.6 }])
    }
  }, [solved, expected, placed, round, roundMiss, roundDone])

  // ── Clapping ──
  const clickClap = useCallback((n) => {
    if (solved || wrongClaps.includes(n)) return
    if (n !== round.syllables.length) {
      setWrongClaps(w => [...w, n])
      setMood('encouraging')
      sfx.wrong()
      narrate([{ text: 'Hör noch mal genau hin.' }, { text: round.name, gap: 200 }, ...syllableParts(round, 520)])
      setTimeout(() => setMood('happy'), 700)
      return
    }
    roundDone(wrongClaps.length === 0)
    sayRight(`${spokenSyllables(round)}. ${countSentence(n)}`)
    afterNarration(() => setShowWeiter(true), { minMs: 1200, maxMs: 9000 })
  }, [solved, wrongClaps, round, roundDone])

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= total) {
      sfx.complete()
      onComplete(result(firstTryRef.current, total))
      return
    }
    setIdx(i => i + 1)
    setPlaced([])
    setRejectedId(null)
    setSlotMisses(0)
    setRoundMiss(false)
    setWrongClaps([])
    setSolved(false)
    setMood('happy')
  }

  const bubble = round.kind === 'clap'
    ? (solved ? <><strong style={{ color: '#2F8F3A' }}>Richtig!</strong> {countSentence(round.syllables.length)}</>
              : <>Klatsch mit! Wie viele Silben hörst du? 👏</>)
    : (solved ? <><strong style={{ color: '#2F8F3A' }}>Bravo! 🎉</strong>{' ' + round.word + ' — richtig!'}</>
              : <>Bau das Wort aus den Silben! 👇</>)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)',
      gap: 'clamp(12px,2vw,20px)',
      userSelect: 'none',
    }}>

      {/* Flash overlay */}
      <AnimatePresence>
        {solved && (
          <motion.div key={'ok' + idx}
            initial={{ opacity: 0.3 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 150, pointerEvents: 'none',
              background: '#6BCB77',
            }}
          />
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {rounds.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < idx ? 'done' : i === idx ? 'current' : 'todo'),
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi speech bubble */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={72} />
        <AnimatePresence mode="wait">
          <motion.div key={idx}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{
              flex: 1, ...pxBubble,
              padding: '13px 18px',
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3vw,21px)',
              color: 'var(--text-primary)',
            }}
          >
            {bubble}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* The picture, and the word once more to hear */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <AnimatePresence mode="wait">
          <motion.div key={round.emoji + idx}
            initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            style={{
              fontSize: 'clamp(80px,18vw,120px)', lineHeight: 1,
              filter: 'drop-shadow(0 5px 0 rgba(42,27,61,0.22))',
            }}
          >
            {round.emoji}
          </motion.div>
        </AnimatePresence>
        <HearOptions items={wordParts} label="Wort noch einmal hören" size={52} />
      </div>

      {isBuild ? (
        <>
          {/* Word slots — slide together and merge when correct */}
          <div style={{
            display: 'flex', flexWrap: solved ? 'nowrap' : 'wrap',
            gap: solved ? 0 : 10,
            justifyContent: 'center', alignItems: 'center',
            minHeight: 72, maxWidth: '100%',
            transition: 'gap 0.35s ease',
          }}>
            {round.syllables.map((_, i) => (
              <WordSlot key={i}
                text={placed[i]?.text || ''}
                isDone={solved}
                isFirst={i === 0}
                isLast={i === round.syllables.length - 1}
                only={round.syllables.length === 1}
              />
            ))}
          </div>

          {/* Syllable tiles */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 'clamp(8px,2vw,14px)',
            justifyContent: 'center', alignItems: 'center',
            width: '100%', maxWidth: 680, boxSizing: 'border-box',
            ...pxPanel, padding: 'clamp(12px,2vw,20px)',
          }}>
            {round.tiles.map(tile => (
              <SyllableTile
                key={`${idx}-${tile.id}`}
                text={tile.text}
                used={usedIds.has(tile.id)}
                rejected={rejectedId === tile.id}
                // after two wrong taps the right tile shows itself
                hinted={!solved && slotMisses >= 2 && tile.text === expected && !usedIds.has(tile.id)}
                onClick={() => clickTile(tile)}
              />
            ))}
            {!solved && (
              <HearOptions
                items={round.tiles.filter(t => !usedIds.has(t.id)).map(t => ({ text: say(t.text), rate: 0.6 }))}
                label="Silben vorlesen" size={52}
              />
            )}
          </div>
        </>
      ) : (
        <>
          {/* After the answer: the word in its parts, one clap each */}
          <div style={{ minHeight: 64, display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            {solved && round.syllables.map((s, i) => (
              <motion.div key={i}
                initial={{ scale: 0, y: 10 }} animate={{ scale: 1, y: 0 }}
                transition={{ delay: i * 0.35, type: 'spring', stiffness: 300 }}
                style={{
                  ...pxCard('right'), padding: '10px 16px',
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(20px,4.5vw,28px)', fontWeight: 900,
                  color: '#1F6B2A', display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <span>👏</span>{s}
              </motion.div>
            ))}
          </div>

          {/* How many claps? Pictures of hands, so no number has to be read */}
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${round.max},1fr)`,
            gap: 'clamp(8px,2vw,14px)', width: '100%', maxWidth: 680,
          }}>
            {Array.from({ length: round.max }, (_, i) => i + 1).map(n => {
              const wrong = wrongClaps.includes(n)
              const right = solved && n === round.syllables.length
              return (
                <motion.button key={n}
                  whileHover={!solved && !wrong ? { scale: 1.05 } : {}}
                  whileTap={!solved && !wrong ? { scale: 0.93 } : {}}
                  animate={{ opacity: wrong || (solved && !right) ? 0.45 : 1 }}
                  onClick={() => clickClap(n)}
                  aria-label={COUNT_WORDS[n - 1]}
                  {...hearable(COUNT_WORDS[n - 1])}
                  style={{
                    ...pxCard(right ? 'right' : wrong ? 'wrong' : undefined),
                    minHeight: 84, padding: '12px 6px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: solved ? 'default' : 'pointer',
                  }}
                >
                  <Claps n={n} size={n > 3 ? 'clamp(20px,4.4vw,34px)' : 'clamp(24px,5.5vw,40px)'} />
                </motion.button>
              )
            })}
          </div>
        </>
      )}

      {/* Weiter button */}
      {showWeiter && (
        <motion.button
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
          onClick={weiterClick}
          {...hearable(idx + 1 >= total ? 'Fertig' : 'Weiter')}
          style={{
            ...pxButton('green'),
            // dark text: white on the light green was hard to read
            color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)',
            padding:'13px 44px', fontSize:20, minHeight: 52,
          }}
        >
          {idx + 1 >= total ? '🏁 Fertig!' : 'Weiter! →'}
        </motion.button>
      )}
    </div>
  )
}
