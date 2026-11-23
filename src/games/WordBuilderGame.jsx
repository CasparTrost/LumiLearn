import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HearOptions from '../components/HearOptions.jsx'
import { Art, Critter, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { sayNumber } from '../tts.js'
import { Pad, Water, Bank, Splash } from './frosch/Pond.jsx'

/**
 * Silben-Spaß: "Frosch-Hüpfen". A frog wants to get across the pond, to
 * the thing waiting on the other bank. It hops one lily pad per syllable
 * and says the syllable as it lands ("Ba – na – ne").
 *   • Clapping rounds: the child picks the path with the right number of
 *     pads. Too few, and the frog runs out of pads and splashes into the
 *     water; too many, and the pad left over sinks under it. Then it climbs
 *     out and tries again.
 *   • Building rounds: the child lays the syllable pads in order (drag, or
 *     tap), and the frog hops across them.
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


// Where an element's middle is, in the coordinates of `root` (layout
// pixels: the FitBox scale does not matter)
function centerIn(el, root) {
  let x = el.offsetWidth / 2, y = el.offsetHeight / 2
  for (let e = el; e && e !== root; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop }
  return { x, y }
}

function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

const HOP_MS = 720

// ── Main Game ──────────────────────────────────────────────────────────────
export default function WordBuilderGame({ level = 1, onComplete }) {
  const [rounds]   = useState(() => buildRounds(level))
  const cfg        = LEVELS[level] ?? LEVELS[1]
  const total      = rounds.length
  const paused     = usePaused()
  const [bursts, burst] = useBursts()

  const [idx,        setIdx]        = useState(0)
  const [placed,     setPlaced]     = useState([])   // syllable pads laid so far
  const [slotMisses, setSlotMisses] = useState(0)    // wrong pads for the current place
  const [roundMiss,  setRoundMiss]  = useState(false)
  const [wrongRows,  setWrongRows]  = useState([])   // paths already tried in a clapping round
  const [solved,     setSolved]     = useState(false)
  const [hop,        setHop]        = useState(null) // { route, i, ok } while the frog is on its way
  const [splash,     setSplash]     = useState(null)
  const [sunk,       setSunk]       = useState(null) // the pad that went under
  const [frog,       setFrog]       = useState(null) // { x, y, arc } where the frog is
  const [duck,       setDuck]       = useState(false)
  const [dunk,       setDunk]       = useState(false) // the frog is in the water
  const [frogMood,   setFrogMood]   = useMood()
  const [thingMood,  setThingMood]  = useMood()
  const firstTryRef = useRef(0)
  const waterRef    = useRef(null)
  const homeRef     = useRef(null)
  const goalRef     = useRef(null)
  const padRefs     = useRef({})

  const round = rounds[idx]
  const isBuild = round.kind === 'build'
  const usedIds = useMemo(() => new Set(placed.map(t => t.id)), [placed])
  const expected = isBuild ? round.syllables[placed.length] : null
  const busy = !!hop || solved

  // Sizes from the width of the pond: a phone gets narrower banks
  const waterW = useWidth(waterRef)
  const wide   = waterW > 600
  const bankW  = wide ? 130 : 58
  const frogS  = wide ? 86 : 54
  const laneW  = Math.max(120, waterW - bankW * 2)
  const rowH   = wide ? 78 : 62
  const rows   = isBuild ? 1 : round.max
  const padW   = isBuild
    ? Math.min(wide ? 118 : 96, laneW / round.syllables.length - 6)
    : Math.min(wide ? 86 : 60, laneW / (round.max + 1) - 6)

  // What the word sounds like, for the 🔊 and a tap on the thing
  const wordParts = useMemo(() => (round.kind === 'clap' && round.max === 4
    ? [{ text: round.name }]
    : [{ text: round.name }, ...syllableParts(round)]), [round])

  // The frog sits on its bank, also after the screen changed size
  const frogAt = useCallback((el, arc = false, dx = 0) => {
    if (!el || !waterRef.current) return
    const c = centerIn(el, waterRef.current)
    setFrog(f => ({ x: c.x + dx - frogS / 2, y: c.y - frogS * 0.82, arc, from: f && { x: f.x, y: f.y } }))
  }, [frogS])
  useLayoutEffect(() => { if (!hop) frogAt(homeRef.current) }, [waterW, idx, rows, frogAt]) // eslint-disable-line react-hooks/exhaustive-deps

  // The task, at the start of every round. For a child who cannot read the
  // pads, hearing the word in its parts is what makes it solvable at all.
  useEffect(() => {
    lockPreviews()
    setDuck(Math.random() < 0.3)
    const firstOfKind = rounds.findIndex(r => r.kind === round.kind) === idx
    if (round.kind === 'clap') {
      // Early levels clap along with Lumi; from three-syllable words on the
      // child hears only the word and finds the parts alone.
      const modelled = round.max < 4
      narrate([
        { text: firstOfKind ? 'Hilf dem Frosch über den Teich! Er hüpft bei jeder Silbe einen Stein weit. Hör gut zu und klatsch mit!' : 'Klatsch mit!' },
        { text: round.name, gap: 200 },
        ...(modelled ? syllableParts(round) : []),
        { text: 'Wie viele Steine braucht der Frosch?', gap: 300 },
      ])
    } else {
      const extraNote = cfg.extra === 1 ? ' Eine Silbe gehört nicht dazu.' : cfg.extra > 1 ? ' Zwei Silben gehören nicht dazu.' : ''
      narrate([
        ...(firstOfKind ? [{ text: `Bau dem Frosch einen Weg aus Silben!${extraNote}` }] : []),
        { text: round.name, gap: firstOfKind ? 200 : 0 },
        ...syllableParts(round),
      ])
    }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The frog on its way: one hop per syllable ──
  // route: [{ el | pt, syl, kind: 'pad' | 'bank' | 'water' | 'sink', key }]
  const startHop = (route, ok) => setHop({ route, i: 0, ok })

  useEffect(() => {
    if (!hop || paused) return
    const t = setTimeout(() => {
      const step = hop.route[hop.i]
      if (!step) { hopDone(hop.ok); return }
      // on the far bank the frog lands next to the thing, not on it
      if (step.el) frogAt(step.el, true, step.kind === 'bank' ? -bankW * 0.32 : 0)
      else setFrog(f => ({ x: step.pt.x - frogS / 2, y: step.pt.y - frogS * 0.82, arc: true, from: f && { x: f.x, y: f.y } }))
      if (step.syl) narrate([{ text: say(step.syl), rate: 0.6 }])
      if (step.kind === 'pad') { sfx.drum(hop.i % 2 === 1); if (step.el) burst(step.el, 'stars', 4) }
      if (step.kind === 'bank') sfx.slideUp()
      if (step.kind === 'water' || step.kind === 'sink') {
        setTimeout(() => {
          sfx.splash()
          setSplash({ ...(step.pt ?? centerIn(step.el, waterRef.current)), id: Date.now() })
          if (step.kind === 'sink') setSunk(step.key)
          setDunk(true)
          setFrogMood('oops', 1600)
        }, 380)
      }
      setHop(h => h && { ...h, i: h.i + 1 })
    }, hop.i === 0 ? 150 : HOP_MS)
    return () => clearTimeout(t)
  }, [hop, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready || paused) return
    setReady(false)
    if (idx + 1 >= total) { sfx.complete(); onComplete(result(firstTryRef.current, total)); return }
    setIdx(i => i + 1)
    setPlaced([]); setSlotMisses(0); setRoundMiss(false); setWrongRows([])
    setSolved(false); setSunk(null); setSplash(null)
  }, [ready, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  function hopDone(ok) {
    setHop(null)
    if (ok) {
      setSolved(true)
      setFrogMood('happy', 1600)
      setThingMood('happy', 1600)
      sfx.tada()
      if (goalRef.current) burst(goalRef.current, 'confetti', 16)
      const firstTry = isBuild ? !roundMiss : wrongRows.length === 0
      if (firstTry) firstTryRef.current += 1
      sayRight(isBuild ? `${round.name}!` : `${round.name}. ${countSentence(round.syllables.length)}`)
      afterNarration(() => setReady(true), { minMs: 1400 })
      return
    }
    // back to the start, dripping, and the word once more in its parts
    frogAt(homeRef.current, true)
    setDunk(false)
    setTimeout(() => setSunk(null), 600)
    sayWrong(`Platsch! Hör noch mal genau hin: ${round.name}. ${spokenSyllables(round)}.`)
  }

  // ── Clapping: pick a path ──
  const choosePath = (n) => {
    if (busy || wrongRows.includes(n)) return
    const s = round.syllables.length
    const pads = Array.from({ length: n }, (_, i) => padRefs.current[`${n}-${i}`])
    const route = []
    for (let i = 0; i < Math.min(n, s); i++) route.push({ el: pads[i], syl: round.syllables[i], kind: 'pad' })
    if (n === s) route.push({ el: goalRef.current, kind: 'bank' })
    else if (n < s) {
      // out of pads with syllables left: into the water between the last pad and the bank
      const a = centerIn(pads[n - 1], waterRef.current), b = centerIn(goalRef.current, waterRef.current)
      route.push({ pt: { x: (a.x + b.x) / 2, y: a.y + 6 }, syl: round.syllables[n], kind: 'water' })
    } else route.push({ el: pads[s], kind: 'sink', key: `${n}-${s}` })
    if (n !== s) setWrongRows(w => [...w, n])
    startHop(route, n === s)
  }

  // ── Building: lay the next syllable pad ──
  const dropTile = (tile) => {
    if (busy) return false
    // Check the syllable against the place it would fill. Comparing by text
    // (not id) keeps words with a repeated syllable working: either PA pad
    // fits either place of PA-PA-GEI.
    if (tile.text !== expected) {
      setSlotMisses(m => m + 1)
      setRoundMiss(true)
      setFrogMood('oops', 1000)
      // say what the pad was, and what is wanted — that is how a child who
      // cannot read the pads finds the right one
      sayWrong(tile.extra
        ? `Das ist ${say(tile.text)}. Das gehört nicht zu ${round.name}.`
        : `Das ist ${say(tile.text)}. Hör mal, ${spokenSyllables(round)}. Jetzt kommt ${say(expected)}.`)
      return false
    }
    const next = [...placed, tile]
    setPlaced(next)
    setSlotMisses(0)
    sfx.pop()
    if (next.length < round.syllables.length) {
      narrate([{ text: say(tile.text), rate: 0.6 }])
      return true
    }
    // all laid: the frog hops across, saying each part, and lands on the bank
    setTimeout(() => startHop([
      ...round.syllables.map((syl, i) => ({ el: padRefs.current[`b-${i}`], syl, kind: 'pad' })),
      { el: goalRef.current, kind: 'bank' },
    ], true), 450)
    return true
  }

  // pads across the lane: a path's pads leave room to the banks, the places
  // of a word being built fill the lane
  const lane = (n, i) => ({ left: `${((i + 1) / (n + 1)) * 100}%` })
  const fill = (n, i) => ({ left: `${((i + 0.5) / n) * 100}%` })

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(8px,1.8vw,20px) clamp(10px,3vw,32px)', gap: 'clamp(10px,2vw,20px)', userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 900, flexShrink: 0 }}>
        <RoundTrail total={total} done={idx + (solved ? 1 : 0)} walker="🐸" goal="🌸" style={{ flex: 1 }} />
        <HearOptions items={wordParts} label="Wort noch einmal hören" size={52} />
      </div>

      <DragArea autoTarget={isBuild ? `slot-${placed.length}` : null} disabled={busy}>
        <div ref={waterRef} data-word={round.syllables.join('-')} style={{ position: 'relative', width: '100%', maxWidth: 900, flexShrink: 0 }}>
          <Water>
            {/* The crossing: the frog's bank, the pads, the other bank */}
            <div style={{ position: 'relative', height: rows * rowH + 40, padding: `20px ${bankW}px`, boxSizing: 'border-box' }}>
              <Bank side="left" width={bankW}><div ref={homeRef} style={{ width: 10, height: 10 }} /></Bank>
              <Bank side="right" width={bankW}>
                <div ref={goalRef} style={{ display: 'flex', marginLeft: bankW * 0.25 }}>
                  <Critter art={round.emoji} size={wide ? 96 : 50} mood={thingMood} label={round.name}
                    onTap={() => { setThingMood('wow', 900); narrate(wordParts) }} />
                </div>
              </Bank>

              {isBuild ? (
                <div style={{ position: 'relative', height: rowH }}>
                  {round.syllables.map((_, i) => (
                    <div key={i} style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', ...fill(round.syllables.length, i) }}>
                      <DropZone id={`slot-${i}`} onDrop={dropTile} label={`Platz ${i + 1}`}>
                        {hover => (
                          <div ref={el => { padRefs.current[`b-${i}`] = el }} style={{ transform: hover ? 'scale(1.1)' : undefined, transition: 'transform .15s' }}>
                            <Pad w={padW} h={Math.max(52, padW * 0.6)} text={placed[i]?.text} empty={!placed[i]} glow={solved}
                              flower={i === round.syllables.length - 1 && !!placed[i]} />
                          </div>
                        )}
                      </DropZone>
                    </div>
                  ))}
                </div>
              ) : (
                Array.from({ length: round.max }, (_, r) => r + 1).map(n => {
                  const tried = wrongRows.includes(n)
                  return (
                    <motion.button key={n} type="button" onClick={() => choosePath(n)}
                      aria-label={COUNT_WORDS[n - 1]} {...hearable(COUNT_WORDS[n - 1])}
                      whileHover={busy || tried ? {} : { scale: 1.02 }} whileTap={busy || tried ? {} : { scale: 0.98 }}
                      style={{
                        all: 'unset', position: 'relative', display: 'block', width: '100%', height: rowH, cursor: busy || tried ? 'default' : 'pointer',
                        borderRadius: 30, background: tried ? 'transparent' : 'rgba(255,255,255,0.10)',
                      }}>
                      {Array.from({ length: n }, (_, i) => (
                        <div key={i} ref={el => { padRefs.current[`${n}-${i}`] = el }}
                          style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', ...lane(n, i) }}>
                          <Pad w={padW} dim={tried} sunk={sunk === `${n}-${i}`} flower={(n + i) % 3 === 0} />
                        </div>
                      ))}
                    </motion.button>
                  )
                })
              )}
            </div>

            {/* Building rounds: the syllable pads float in the water below */}
            {isBuild && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: wide ? 18 : 10, justifyContent: 'center', alignItems: 'center', padding: '6px 14px 22px' }}>
                {round.tiles.map((tile, i) => {
                  const used = usedIds.has(tile.id)
                  const hinted = !solved && slotMisses >= 2 && tile.text === expected && !used
                  return (
                    <div key={`${idx}-${tile.id}`} className="fr-bob" style={{ animationDelay: `${i * -0.4}s`, visibility: used ? 'hidden' : 'visible' }}>
                      <Draggable id={`${idx}-${tile.id}`} data={tile} label={say(tile.text)} disabled={used}>
                        <span {...hearable(say(tile.text), { rate: 0.6, enabled: !used })} style={{ display: 'block' }}>
                          <motion.div animate={hinted ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={hinted ? { duration: 1, repeat: Infinity } : {}}>
                            <Pad w={wide ? 112 : 84} h={wide ? 66 : 56} text={tile.text} glow={hinted} />
                          </motion.div>
                        </span>
                      </Draggable>
                    </div>
                  )
                })}
                {!solved && (
                  <HearOptions items={round.tiles.filter(t => !usedIds.has(t.id)).map(t => ({ text: say(t.text), rate: 0.6 }))}
                    label="Silben vorlesen" size={52} />
                )}
              </div>
            )}

            {/* a duck paddles by now and then */}
            {duck && (
              <div key={'duck' + idx} className="fr-swim" aria-hidden="true"
                style={{ position: 'absolute', left: 0, bottom: 2, pointerEvents: 'none', zIndex: 2 }}>
                <Art art="🦆" size={wide ? 44 : 34} />
              </div>
            )}
          </Water>

          {/* The frog, above the water and the banks */}
          {frog && (
            <motion.div aria-hidden={busy}
              initial={false}
              animate={frog.arc && frog.from
                ? { x: [frog.from.x, frog.x], y: [frog.from.y, Math.min(frog.from.y, frog.y) - frogS * 0.7, frog.y] }
                : { x: frog.x, y: frog.y }}
              transition={frog.arc ? { duration: 0.42, ease: 'easeOut', y: { duration: 0.42, times: [0, 0.45, 1] } } : { duration: 0 }}
              style={{ position: 'absolute', left: 0, top: 0, width: frogS, height: frogS, zIndex: 5 }}>
              <motion.div animate={dunk ? { y: frogS * 0.35, scale: 0.75, opacity: 0.55 } : { y: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
                <Critter art="🐸" size={frogS} mood={frogMood} label="Frosch" />
              </motion.div>
            </motion.div>
          )}
          <AnimatePresence>{splash && <Splash key={splash.id} x={splash.x} y={splash.y} />}</AnimatePresence>
        </div>
      </DragArea>
      {bursts}
    </div>
  )
}
