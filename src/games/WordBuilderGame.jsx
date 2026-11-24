import { useState, useCallback, useEffect, useLayoutEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Art, Critter, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useIdle, useBursts } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Pad, Water, Bank, Splash } from './frosch/Pond.jsx'
import { voice, KEY } from './woerter/voice.js'
import Finale from './woerter/Finale.jsx'

/**
 * Silben-Spaß: "Frosch-Hüpfen". A frog wants to get across the pond, to
 * the thing waiting on the other bank. It hops one lily pad per syllable,
 * and each pad shows its syllable as the frog lands ("BA – NA – NE").
 *   • Clapping rounds: the child says the word and claps it on the big clap
 *     button; every clap drops a lily pad into the pond. A moment after the
 *     last clap the frog sets off. Too few pads, and it splashes into the
 *     water; too many, and the pad left over sinks under it. Then it climbs
 *     out, the pads are washed away, and the child claps again.
 *   • Building rounds: the card above the pond shows the word with an arc
 *     under each syllable; the child lays the syllable pads in that order
 *     (drag, or tap) and the frog hops across them.
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
// on their own those sound wrong ("Che" as "Tsche").
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

// A ref that looks its element up when it is needed (for the hint hand)
const lazy = find => ({ get current() { return find() } })

const HOP_MS = 720
// The round trail stops short of the sun in the scene's top right corner
const SUN_GAP = 'clamp(0px, calc((100vw - 700px) * 0.6), 190px)'
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// After the last clap the frog waits this long, then jumps
const CLAP_WAIT_MS = 1300
// What a round starts with
// (`demo`: after a wrong count the frog hops the right number of pads once;
// `showClaps`: then the hand claps that many times)
// (`carry`: the frog carries the thing home; `gone`: it left the far bank)
const FRESH = { placed: [], slotMisses: 0, missed: false, claps: 0, solved: false, sunk: false, splash: null, dunk: false, demo: false, showClaps: 0, carry: false, gone: false }

/**
 * The task as a picture card above the pond: the thing, and either a clap
 * with a "?" (how many claps?) or the word in its syllables with an arc
 * under each, the way first-graders mark syllables (Silbenbögen). Laid
 * syllables light up; after two misses the next one glows.
 */
function TaskCard({ round, placed, glowNext, wide }) {
  const pic = wide ? 64 : 48
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: wide ? 14 : 8, padding: '6px 16px', borderRadius: 22, flexShrink: 0,
      background: '#fffdf7', border: '3px solid #2a1b3d', boxShadow: '0 5px 0 rgba(42,27,61,0.25)',
    }}>
      <Art art={round.emoji} size={pic} />
      {round.kind === 'clap' ? (
        <div aria-label="Wie oft klatschen?" style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: pic * 0.6, color: '#2a1b3d' }}>
          <Art art=":px-klatschen:" size={pic * 0.8} />?
        </div>
      ) : (
        <div aria-label={round.syllables.join('-')} style={{ display: 'flex', gap: 4 }}>
          {round.syllables.map((syl, i) => {
            const laid = i < placed, next = i === placed && glowNext
            return (
              <motion.div key={i} animate={next ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={next ? { duration: 0.9, repeat: Infinity } : {}}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 3px', borderRadius: 8, background: next ? '#ffd34d' : 'transparent' }}>
                <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 900, fontSize: wide ? 26 : 18, letterSpacing: 1, color: laid ? '#2f8f3a' : '#2a1b3d' }}>{syl}</span>
                <svg viewBox="0 0 40 10" width="100%" height={9} preserveAspectRatio="none" aria-hidden="true">
                  <path d="M3 2 Q20 12 37 2" fill="none" stroke={laid ? '#2f8f3a' : '#ff8fb8'} strokeWidth={3} strokeLinecap="round" />
                </svg>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Main Game ──────────────────────────────────────────────────────────────
export default function WordBuilderGame({ level = 1, onComplete }) {
  const [rounds]   = useState(() => buildRounds(level))
  const total      = rounds.length
  const paused     = usePaused()
  const [bursts, burst] = useBursts()

  const [idx,     setIdx]     = useState(0)
  const [rs,      setRs]      = useState(FRESH)       // this round's state
  const [hop,     setHop]     = useState(null)        // { route, i, ok } while the frog is on its way
  const [frog,    setFrog]    = useState(null)        // { x, y, arc, from } where the frog is
  const [said,    setSaid]    = useState({})          // pad key -> syllable shown once the frog landed on it
  const [duck,    setDuck]    = useState(false)
  const [streak,  setStreak]  = useState(0)
  const [ready,   setReady]   = useState(false)       // the payoff is over: next round
  const [finale,  setFinale]  = useState(false)
  const [pile,    setPile]    = useState([])          // the things the frog brought home
  const [beat,    setBeat]    = useState(0)           // the thing claps its word back, one bounce per syllable
  const [frogMood,  setFrogMood]  = useMood()
  const [thingMood, setThingMood] = useMood()
  const firstTryRef = useRef(0)
  const waterRef    = useRef(null)
  const homeRef     = useRef(null)
  const goalRef     = useRef(null)   // where the frog lands on the far bank
  const thingRef    = useRef(null)
  const clapRef     = useRef(null)
  const trayRef     = useRef(null)
  const padRefs     = useRef({})
  const upd = patch => setRs(r => ({ ...r, ...patch }))

  const round = rounds[idx]
  const isBuild = round.kind === 'build'
  const usedIds = useMemo(() => new Set(rs.placed.map(t => t.id)), [rs.placed])
  const expected = isBuild ? round.syllables[rs.placed.length] : null
  const busy = !!hop || rs.solved || rs.demo || finale

  // Sizes from the width of the pond: a phone gets narrower banks
  const waterW = useWidth(waterRef)
  const wide   = waterW > 600
  const bankW  = wide ? 130 : 48
  const frogS  = wide ? 84 : 48
  const thingS = wide ? 84 : 44
  const laneW  = Math.max(120, waterW - bankW * 2)
  // a phone has room below: a taller crossing, so the thing stands above
  // the frog's landing place on the narrow bank
  const rowH   = wide ? 86 : 92
  const n      = isBuild ? round.syllables.length : rs.claps
  const padW   = isBuild
    ? Math.min(wide ? 118 : 96, laneW / n - 6)
    : Math.min(wide ? 86 : 62, laneW / (round.max + 1) - 6)

  // The frog on a pad, a bank or a point in the water
  const frogTo = useCallback((pt, arc) => {
    setFrog(f => ({ x: pt.x - frogS / 2, y: pt.y - frogS * 0.82, arc, from: f && { x: f.x, y: f.y } }))
  }, [frogS])
  const frogAt = useCallback((el, arc = false, dx = 0) => {
    if (!el || !waterRef.current) return
    const c = centerIn(el, waterRef.current)
    frogTo({ x: c.x + dx, y: c.y }, arc)
  }, [frogTo])
  // On its bank at the start, after a change of size, and with a big jump
  // home from the far bank when a new round starts
  useLayoutEffect(() => { if (!hop) frogAt(homeRef.current) }, [waterW]) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (idx) frogAt(homeRef.current, true) }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // The task, at the start of every round: the card shows it; Lumi says the
  // task once per kind of round and the word, when they are recorded
  useEffect(() => {
    lockPreviews()
    sayTask()
    setDuck(Math.random() < 0.3)
    const firstOfKind = rounds.findIndex(r => r.kind === round.kind) === idx
    voice([firstOfKind && KEY.task(isBuild ? 'frosch-bauen' : 'frosch-klatschen'), KEY.word(round.name)])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The frog on its way: one hop per syllable ──
  // route: [{ el | pt, syl, kind: 'pad' | 'bank' | 'water' | 'sink', key }]
  useEffect(() => {
    if (!hop || paused) return
    const t = setTimeout(() => {
      const step = hop.route[hop.i]
      if (!step) { hopDone(hop.ok); return }
      if (step.kind === 'clapback') {
        // the thing bounces once per syllable, to a drum
        setBeat(b => b + 1)
        sfx.drum(step.n % 2 === 1)
      } else if (step.kind === 'grab') {
        upd({ carry: true, gone: true })
        sfx.boing()
      } else if (step.el) frogAt(step.el, true)
      else frogTo(step.pt, true)
      if (step.kind === 'back') sfx.step()
      if (step.syl) {
        voice([KEY.syllable(step.syl)])
        if (step.key) setTimeout(() => setSaid(s => ({ ...s, [step.key]: step.syl })), 380)
      }
      if (step.kind === 'pad') {
        sfx.drum(hop.i % 2 === 1)
        if (step.el) setTimeout(() => burst(step.el, 'stars', 4), 380)
      }
      if (step.kind === 'bank') sfx.slideUp()
      if (step.kind === 'water' || step.kind === 'sink') {
        setTimeout(() => {
          sfx.splash()
          upd({ splash: { ...(step.pt ?? centerIn(step.el, waterRef.current)), id: Date.now() }, sunk: step.kind === 'sink' ? step.key : false, dunk: true })
          setFrogMood('oops', 1600)
        }, 380)
      }
      setHop(h => h && { ...h, i: h.i + 1 })
    }, hop.route[hop.i]?.ms ?? (hop.i === 0 ? 150 : HOP_MS))
    return () => clearTimeout(t)
  }, [hop, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // Next round once the payoff has been seen, never while the help is open
  useEffect(() => {
    if (!ready || paused) return
    setReady(false)
    if (idx + 1 >= total) { setFinale(true); return }
    setSaid({})
    setBeat(0)
    setRs(FRESH)
    setIdx(i => i + 1)
  }, [ready, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  function hopDone(ok) {
    setHop(null)
    if (ok === 'demo') {
      // the right number shown: back home, and now the child claps it
      frogAt(homeRef.current, true)
      setTimeout(() => { upd({ claps: 0, demo: false, showClaps: round.syllables.length }); setSaid({}) }, 600)
      return
    }
    if (ok) {
      upd({ solved: true })
      const firstTry = !rs.missed
      if (firstTry) firstTryRef.current += 1
      const s = firstTry ? streak + 1 : 0
      setStreak(s)
      setFrogMood(s >= 3 ? 'dance' : 'wow', 1800)
      setThingMood('dance', 1600)
      sfx.tada()
      if (thingRef.current) burst(thingRef.current, 'confetti', s >= 3 ? 26 : 14)
      sayRight(null, { onEnd: () => voice([KEY.word(round.name)]) })
      // the thing claps its word back, the frog grabs it and hops home with it
      const n = round.syllables.length
      const pad = i => padRefs.current[isBuild ? `b-${i}` : `c-${i}`]
      setHop({ ok: 'home', i: 0, route: [
        ...round.syllables.map((_, i) => ({ kind: 'clapback', n: i, ms: i ? 380 : 700 })),
        { kind: 'grab', ms: 500 },
        ...Array.from({ length: n }, (_, k) => ({ el: pad(n - 1 - k), kind: 'back', ms: k ? 400 : 500 })),
        { el: homeRef.current, kind: 'back', ms: 400 },
      ] })
      return
    }
    if (ok === 'home') {
      // the thing joins the pile on the home bank
      upd({ carry: false })
      setPile(p => [...p, round.emoji])
      sfx.coin()
      if (homeRef.current) burst(homeRef.current, 'stars', 8)
      afterNarration(() => setReady(true), { minMs: 700 })
      return
    }
    // back to the start, dripping; the claps are washed away …
    frogAt(homeRef.current, true)
    sayWrong()
    if (isBuild) return
    // … and the right number of pads appears, and the frog shows the way
    const s = round.syllables.length
    setTimeout(() => { upd({ dunk: false, sunk: false, claps: s, demo: true }); setSaid({}) }, 500)
    setTimeout(() => setHop({ route: [
      ...round.syllables.map((syl, i) => ({ el: padRefs.current[`c-${i}`], syl, kind: 'pad', key: `c-${i}` })),
      { el: goalRef.current, kind: 'bank' },
    ], i: 0, ok: 'demo' }), 1300)
  }

  // ── Clapping: every clap drops a lily pad into the pond ──
  const clap = () => {
    if (busy) return
    if (rs.claps >= round.max) { sfx.boing(); return }
    sfx.drum(rs.claps % 2 === 1)
    if (clapRef.current) burst(clapRef.current, 'stars', 5)
    upd({ claps: rs.claps + 1 })
  }
  // A moment after the last clap, the frog sets off
  useEffect(() => {
    if (isBuild || busy || !rs.claps || paused) return
    const t = setTimeout(() => {
      const s = round.syllables.length, c = rs.claps
      const pads = Array.from({ length: c }, (_, i) => padRefs.current[`c-${i}`])
      const route = []
      for (let i = 0; i < Math.min(c, s); i++) route.push({ el: pads[i], syl: round.syllables[i], kind: 'pad', key: `c-${i}` })
      if (c === s) route.push({ el: goalRef.current, kind: 'bank' })
      else if (c < s) {
        // out of pads with syllables left: into the water between the last pad and the bank
        const a = centerIn(pads[c - 1], waterRef.current), b = centerIn(goalRef.current, waterRef.current)
        route.push({ pt: { x: (a.x + b.x) / 2, y: a.y + 6 }, syl: round.syllables[c], kind: 'water' })
      } else route.push({ el: pads[s], kind: 'sink', key: `c-${s}` })
      if (c !== s) upd({ missed: true })
      setHop({ route, i: 0, ok: c === s })
    }, CLAP_WAIT_MS)
    return () => clearTimeout(t)
  }, [rs.claps, busy, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Building: lay the next syllable pad ──
  const dropTile = (tile) => {
    if (busy) return false
    // Check the syllable against the place it would fill. Comparing by text
    // (not id) keeps words with a repeated syllable working: either PA pad
    // fits either place of PA-PA-GEI.
    if (tile.text !== expected) {
      upd({ slotMisses: rs.slotMisses + 1, missed: true })
      setFrogMood('oops', 1000)
      sayWrong()
      return false
    }
    const next = [...rs.placed, tile]
    upd({ placed: next, slotMisses: 0 })
    sfx.pop()
    voice([KEY.syllable(tile.text)])
    if (next.length < round.syllables.length) return true
    // all laid: the frog hops across them and lands on the bank
    setTimeout(() => setHop({ route: [
      ...round.syllables.map((syl, i) => ({ el: padRefs.current[`b-${i}`], syl, kind: 'pad' })),
      { el: goalRef.current, kind: 'bank' },
    ], i: 0, ok: true }), 450)
    return true
  }

  const lane = (count, i) => ({ left: `${((i + 1) / (count + 1)) * 100}%` })
  const fill = (count, i) => ({ left: `${((i + 0.5) / count) * 100}%` })
  const glowTile = isBuild && !rs.solved && rs.slotMisses >= 2
    ? round.tiles.find(t => t.text === expected && !usedIds.has(t.id)) : null
  const firstRound = idx === 0 || (isBuild && rounds.findIndex(r => r.kind === 'build') === idx)
  // the tile the next place needs, for the hint hand
  const needed = isBuild && !rs.solved ? round.tiles.find(t => t.text === expected && !usedIds.has(t.id)) : null
  // Clapping rounds: before a miss the clap button only wiggles when the
  // child waits (a hand tapping it would suggest a number); after a miss
  // the hand claps exactly the right number of times
  const clapIdle = useIdle(firstRound ? 2000 : 6000, !isBuild && !busy && rs.claps === 0 && !rs.showClaps)

  return (
    <div style={{
      position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(8px,1.8vw,20px) clamp(10px,3vw,32px)', gap: 'clamp(10px,2vw,18px)', userSelect: 'none',
    }}>
      <div style={{ width: '100%', maxWidth: 860, flexShrink: 0, paddingRight: SUN_GAP, boxSizing: 'border-box' }}>
        <RoundTrail total={total} done={idx + (rs.solved ? 1 : 0)} walker="🐸" goal="🌸" />
      </div>

      <div style={{ marginBottom: 8 }}>
        <TaskCard key={idx} round={round} placed={rs.placed.length} glowNext={!!glowTile} wide={wide} />
      </div>

      <DragArea autoTarget={isBuild ? `slot-${rs.placed.length}` : null} disabled={busy}>
        <div ref={waterRef} data-word={round.syllables.join('-')} data-round={idx} style={{ position: 'relative', width: '100%', maxWidth: 900, flexShrink: 0 }}>
          <Water>
            {/* The crossing: the frog's bank, the pads, the other bank */}
            <div style={{ position: 'relative', height: rowH + 40, padding: `20px ${bankW}px`, boxSizing: 'border-box' }}>
              <Bank side="left" width={bankW}>
                <div ref={homeRef} style={{ width: 10, height: 10 }} />
                {/* what the frog brought home so far, a heap at its feet */}
                <div aria-hidden="true" style={{ position: 'absolute', left: 2, right: 6, bottom: 4, display: 'flex', flexWrap: 'wrap-reverse', justifyContent: 'center', gap: 0 }}>
                  {pile.map((e, i) => (
                    <motion.div key={i} initial={{ y: -30, scale: 0.4 }} animate={{ y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}
                      style={{ rotate: `${(i % 3 - 1) * 12}deg` }}>
                      <Art art={e} size={wide ? 32 : 20} />
                    </motion.div>
                  ))}
                </div>
              </Bank>
              <Bank side="right" width={bankW}>
                {/* the thing, and the place next to (tablet) or below (phone) it where the frog lands */}
                <div style={{ display: 'flex', flexDirection: wide ? 'row-reverse' : 'column', alignItems: 'center', gap: wide ? 0 : 4 }}>
                  <motion.div ref={thingRef} key={`b${beat}`}
                    animate={beat && !reduceMotion() ? { y: [0, -thingS * 0.35, 0], scaleY: [1, 1.1, 0.9, 1] } : {}}
                    transition={{ duration: 0.34 }}
                    style={{ display: 'flex', visibility: rs.gone ? 'hidden' : 'visible' }}>
                    <Critter art={round.emoji} size={thingS} mood={thingMood} label={round.name}
                      onTap={() => { setThingMood('wow', 900); voice([KEY.word(round.name)]) }} />
                  </motion.div>
                  <div ref={goalRef} style={{ width: wide ? 40 : 10, height: wide ? 10 : frogS * 0.9 }} />
                </div>
              </Bank>

              <div style={{ position: 'relative', height: rowH }}>
                {isBuild
                  ? round.syllables.map((_, i) => (
                    <div key={i} style={{ position: 'absolute', top: '50%', transform: 'translate(-50%, -50%)', ...fill(n, i) }}>
                      <DropZone id={`slot-${i}`} onDrop={dropTile} label={`Platz ${i + 1}`}>
                        {hover => (
                          <div ref={el => { padRefs.current[`b-${i}`] = el }} style={{ transform: hover ? 'scale(1.1)' : undefined, transition: 'transform .15s' }}>
                            <Pad w={padW} h={Math.max(60, padW * 0.6)} text={rs.placed[i]?.text} empty={!rs.placed[i]} glow={rs.solved}
                              flower={i === n - 1 && !!rs.placed[i]} />
                          </div>
                        )}
                      </DropZone>
                    </div>
                  ))
                  : Array.from({ length: rs.claps }, (_, i) => (
                    <motion.div key={`${idx}-${i}`} ref={el => { padRefs.current[`c-${i}`] = el }}
                      initial={{ scale: 0, y: -30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 14 }}
                      style={{ position: 'absolute', top: '50%', marginTop: -padW * 0.31, marginLeft: -padW / 2, transition: 'left .3s ease-out', ...lane(rs.claps, i) }}>
                      <Pad w={padW} sunk={!!rs.sunk} text={said[`c-${i}`]} glow={rs.solved} flower={i % 3 === 1} />
                    </motion.div>
                  ))}
              </div>
            </div>

            {/* Clapping rounds: the clap button drops a pad per clap */}
            {!isBuild && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0 22px' }}>
                <motion.button ref={clapRef} type="button" onClick={clap} aria-label="Klatschen"
                  whileTap={busy ? {} : { scale: 0.8, rotate: -8 }}
                  animate={clapIdle && !reduceMotion()
                    ? { opacity: 1, scale: [1, 1.14, 0.94, 1.08, 1], rotate: [0, -8, 8, -4, 0] }
                    : { opacity: busy ? 0.5 : 1, scale: 1, rotate: 0 }}
                  transition={clapIdle ? { duration: 0.9, repeat: Infinity, repeatDelay: 0.8 } : { duration: 0.2 }}
                  style={{
                    all: 'unset', cursor: busy ? 'default' : 'pointer', width: wide ? 112 : 92, height: wide ? 112 : 92, borderRadius: '50%',
                    background: 'radial-gradient(circle at 40% 35%, #fff3b0, #ffc93c 70%)', border: '4px solid #2a1b3d',
                    boxShadow: '0 6px 0 rgba(42,27,61,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  <Art art=":px-klatschen:" size={wide ? 70 : 58} />
                </motion.button>
              </div>
            )}

            {/* Building rounds: the syllable pads float in the water below */}
            {isBuild && (
              <div ref={trayRef} style={{ display: 'flex', flexWrap: 'wrap', gap: wide ? 18 : 10, justifyContent: 'center', alignItems: 'center', padding: '6px 14px 22px' }}>
                {round.tiles.map((tile, i) => {
                  const used = usedIds.has(tile.id)
                  const hinted = tile === glowTile
                  return (
                    <div key={`${idx}-${tile.id}`} className="fr-bob" style={{ animationDelay: `${i * -0.4}s`, visibility: used ? 'hidden' : 'visible' }}>
                      <Draggable id={`${idx}-${tile.id}`} data={tile} label={tile.text} disabled={used} data-tile={tile.text}>
                        <motion.div animate={hinted ? { scale: [1, 1.12, 1] } : { scale: 1 }} transition={hinted ? { duration: 1, repeat: Infinity } : {}}>
                          <Pad w={wide ? 112 : 92} h={wide ? 66 : 62} text={tile.text} glow={hinted} />
                        </motion.div>
                      </Draggable>
                    </div>
                  )
                })}
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
                // the hop's peak stays in the pond, clear of the card above
                ? { x: [frog.from.x, frog.x], y: [frog.from.y, Math.max(Math.min(frog.from.y, frog.y) - frogS * 0.6, -frogS * 0.25), frog.y] }
                : { x: frog.x, y: frog.y }}
              transition={frog.arc ? { duration: 0.42, ease: 'easeOut', y: { duration: 0.42, times: [0, 0.45, 1] } } : { duration: 0 }}
              style={{ position: 'absolute', left: 0, top: 0, width: frogS, height: frogS, zIndex: 5 }}>
              <motion.div animate={rs.dunk ? { y: frogS * 0.35, scale: 0.75, opacity: 0.55 } : { y: 0, scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}>
                <Critter art="🐸" size={frogS} mood={frogMood} label="Frosch"
                  accessory={rs.carry && (
                    <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: -frogS * 0.42, marginLeft: -frogS * 0.32 }}>
                      <Art art={round.emoji} size={frogS * 0.64} />
                    </div>
                  )} />
              </motion.div>
            </motion.div>
          )}
          <AnimatePresence>{rs.splash && <Splash key={rs.splash.id} x={rs.splash.x} y={rs.splash.y} />}</AnimatePresence>
        </div>
      </DragArea>

      {/* The hand: clap (clapping rounds), or lay a pad (building rounds) */}
      {isBuild
        ? <HintHand key={`hand-${idx}`} from={lazy(() => trayRef.current?.querySelector(`[data-tile="${needed?.text}"]`))}
            to={lazy(() => padRefs.current[`b-${rs.placed.length}`])}
            active={!busy && !!needed} delay={glowTile ? 800 : firstRound ? 2000 : 6000} />
        : <HintHand key={`clap-${idx}-${rs.showClaps}`} to={clapRef} repeat={rs.showClaps || 1}
            active={!busy && rs.claps === 0 && rs.showClaps > 0} delay={1200} />}
      {finale && <Finale items={rounds.map(r => r.emoji)} hero="🐸" onDone={() => onComplete(result(firstTryRef.current, total))} />}
      {bursts}
    </div>
  )
}
