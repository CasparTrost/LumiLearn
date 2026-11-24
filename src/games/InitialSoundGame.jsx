import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { Critter, Art, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts, useDragState } from '../components/play/index.js'
import { useRounds, reduceMotion, shuffle, chance, hintDelay } from './buchstaben/useRounds.js'
import { rec, wordRec, soundRec } from './buchstaben/voice.js'
import { pxButton, ACCENT, INK } from './px.js'

/**
 * Anlaut-Detektiv: Anlaut-Angeln — welcher Buchstabe macht diesen Laut?
 *
 * Lumi angelt am Teich, und am Haken hängt jedes Mal etwas Überraschendes:
 * eine Maus, ein Sofa, ein Mond, tropfnass. Am Ufer sitzen Frösche, jeder
 * mit einem Eimer, auf dem sein Buchstabe steht. Das Kind bringt den Fang
 * in den Eimer mit dem Buchstaben, mit dem das Wort anfängt (ziehen, oder
 * erst den Fang und dann den Eimer antippen). Ein Frosch, den man antippt,
 * quakt seinen Buchstaben. Der Fang bleibt im Eimer: Über das Level füllen
 * sich die Eimer, und jeder Frosch reagiert auf das, was bei ihm landet —
 * er kichert, wird schläfrig oder springt vor Schreck vom Eimer. Einmal je
 * Level hängt etwas Schweres am Haken und reißt Lumi fast ins Wasser. Nach einem Fehler zeigt jeder Eimer ein Bild,
 * das mit seinem Buchstaben anfängt — eine kleine Anlauttabelle, die ohne
 * Worte hilft: Maus fängt an wie Mond.
 *
 * Fills the gap between two existing modules: Hörabenteuer stops at meaning
 * (hear a word, find its picture) and ABC-Abenteuer starts from the letter
 * (see a B, pick a word beginning with it). Neither ever asks the question
 * that actually links sound to writing — which letter makes this sound? —
 * even though that mapping is what reading is built on.
 *
 * Scientific basis:
 *   • Grapheme-phoneme correspondence — isolating a word's first sound and
 *     assigning it a letter is the core skill of alphabetic decoding
 *     (Ehri's phase theory: this is the step into the alphabetic phase).
 *   • The child only sees the picture and hears the word; the written word
 *     appears once the round is solved. Shown beforehand, it could be solved
 *     by matching its first letter without listening at all.
 *   • Letters speak as sounds ("Fff", "Mmm"), never as letter names ("Eff",
 *     "Em") — the name of a letter is not the sound at the start of a word.
 */

// Only words whose first sound really is the letter's own sound, with a
// picture that shows just that word: no Vogel under V (that is an F sound),
// no Pferd (pf), no chair for "Tisch", no light bulb for "Lampe".
const WORDS = [
  ['A','Apfel','🍎'], ['A','Affe','🐒'], ['A','Ameise','🐜'], ['A','Ananas','🍍'],
  ['E','Ente','🦆'],  ['E','Elefant','🐘'], ['E','Esel','🫏'],
  ['I','Igel','🦔'],  ['I','Insel','🏝️'],
  ['O','Ohr','👂'],   ['O','Oma','👵'], ['O','Orange','🍊'],
  ['U','Ufo','🛸'],   ['U','Uhu','🦉'],
  ['M','Maus','🐭'],  ['M','Mond','🌙'], ['M','Milch','🥛'], ['M','Möhre','🥕'],
  ['S','Sonne','☀️'], ['S','Socke','🧦'], ['S','Sofa','🛋️'], ['S','Seife','🧼'],
  ['F','Fisch','🐟'], ['F','Fuchs','🦊'], ['F','Feder','🪶'], ['F','Fuß','🦶'],
  ['L','Löwe','🦁'],  ['L','Leiter','🪜'], ['L','Lama','🦙'],
  ['N','Nase','👃'],  ['N','Nest','🪺'], ['N','Nudeln','🍝'],
  ['R','Rose','🌹'],  ['R','Rakete','🚀'], ['R','Roboter','🤖'],
  ['W','Wolke','☁️'], ['W','Wolf','🐺'], ['W','Wal','🐋'], ['W','Wurm','🪱'],
  ['H','Hund','🐕'],  ['H','Haus','🏠'], ['H','Hase','🐰'], ['H','Hahn','🐓'],
  ['B','Banane','🍌'], ['B','Biene','🐝'], ['B','Bär','🐻'], ['B','Baum','🌳'],
  ['P','Pilz','🍄'],  ['P','Pinguin','🐧'], ['P','Panda','🐼'], ['P','Pinsel','🖌️'],
  ['D','Dose','🥫'],  ['D','Dino','🦖'], ['D','Delfin','🐬'],
  ['T','Tomate','🍅'], ['T','Tiger','🐯'], ['T','Tür','🚪'],
  ['G','Giraffe','🦒'], ['G','Gurke','🥒'], ['G','Geist','👻'], ['G','Geschenk','🎁'],
  ['K','Katze','🐱'], ['K','Koala','🐨'], ['K','Kuh','🐄'], ['K','Käse','🧀'],
  ['Z','Zebra','🦓'], ['Z','Zahn','🦷'], ['Z','Zitrone','🍋'], ['Z','Zelt','⛺'],
  ['J','Jo-Jo','🪀'],
]
const ALL = [...new Set(WORDS.map(w => w[0]))].join('')

// Sounds that are easy to mix up. Kept apart in the early levels, offered
// side by side at the end — telling B from P is the hard part.
const PARTNER = { B:'P', P:'B', D:'T', T:'D', G:'K', K:'G', M:'N', N:'M' }

// The steps: long sounds you can hold (mmm, sss, fff), then the vowels, then
// the short ones (b, d, g …), and last the look-alike pairs.
// `targets` are asked, `extra` letters only appear as wrong answers.
const LEVELS = [
  { targets:'MSF',                              options:3 },
  { targets:'MSFLNR',                           options:3 },
  { targets:'MSFLNRWH',                         options:4 },
  { targets:'AEO',      extra:'MSFL',           options:3 },
  { targets:'AEIOU',    extra:'MSFLNR',         options:4 },
  { targets:'AEIOUMSFLNRWH',                    options:4 },
  { targets:'BDGKPT',   extra:'MSFLNR',         options:4 },
  { targets:'BDGKPTZJ', extra:'AEIOUMSFLNRWH',  options:4 },
  { targets:'BDGKPTMN',                         options:4, pairs:true },
  { targets:ALL,                                options:5, pairs:true },
]

function buildRounds(level, count = 8) {
  const cfg = LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))]
  const targets = shuffle([...cfg.targets])
  const pool = [...new Set([...cfg.targets, ...(cfg.extra ?? '')])]
  const unused = shuffle(WORDS)
  // the round with the heavy catch: once per level, never the first
  const heavy = 1 + Math.floor(Math.random() * (count - 1))
  return Array.from({ length: count }, (_, i) => {
    const letter = targets[i % targets.length]
    // a word not seen yet in this level, if this letter still has one
    const at = unused.findIndex(w => w[0] === letter)
    const [, word, emoji] = at >= 0 ? unused.splice(at, 1)[0] : shuffle(WORDS.filter(w => w[0] === letter))[0]
    const partner = PARTNER[letter]
    let others = shuffle(pool.filter(l => l !== letter && l !== partner))
    if (cfg.pairs && partner && pool.includes(partner)) others = [partner, ...others]
    return { letter, word, emoji, fish: chance(0.3), options: shuffle([letter, ...others.slice(0, cfg.options - 1)]) }
  }).map((r, i) => ({ ...r, heavy: i === heavy }))
}
// What a frog does when something lands in its bucket, in turn
const REACTIONS = ['giggle', 'sleepy', 'jump']
// Where the catches peek out of a bucket: beside the frog, left and right
const PILE_AT = [{ x: 22, y: 52, r: -14 }, { x: 78, y: 52, r: 12 }, { x: 10, y: 44, r: -24 }, { x: 90, y: 44, r: 22 }]

// The picture a bucket shows as a hint: another word with its letter
const keyOf = (L, word) => WORDS.find(w => w[0] === L && w[1] !== word)?.[2] ?? null

const BUCKET_COLORS = ['#e8483b', '#2f7fd8', '#e07a10', '#8a4fd0', '#13968c']
const HOOK = 150   // how far below the rod tip the catch hangs

export default function InitialSoundGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])
  const [bursts, burst] = useBursts()
  const [gotIn, setGot] = useState(null)   // { i, L }: the catch of round i is in bucket L
  const [piles, setPiles] = useState({})   // letter -> the catches in its bucket, over the level
  const idxRef = useRef(0)
  const catchRef = useRef(null)
  const pondRef = useRef(null)
  const gapRef = useRef(null)

  // The word, and on the first catch the question — once Lumi has recorded them.
  const sayTask = useCallback(() => {
    const i = idxRef.current, r = rounds[i]
    if (r) narrate([wordRec(r.word), i === 0 && rec('anlaut/womit')])
  }, [rounds])

  const { idx, done, leaving, finale, tried, streak, win, miss, reveal, isOver, hasTried } =
    useRounds(rounds.length, { onComplete, sayTask, outroMs: 450 })
  idxRef.current = idx
  const r = rounds[idx]
  const got = gotIn?.i === idx ? gotIn.L : null
  const land = L => {
    setGot({ i: idx, L })
    setPiles(p => ({ ...p, [L]: [...(p[L] ?? []), r.emoji] }))
  }
  // the heavy catch: Lumi is yanked forward, a big splash, then it surfaces
  useEffect(() => {
    if (!rounds[idx]?.heavy || reduceMotion()) return
    const t = [setTimeout(() => sfx.whoosh(), 250), setTimeout(() => sfx.splash(), 650), setTimeout(() => sfx.splash(), 1150)]
    return () => t.forEach(clearTimeout)
  }, [idx, rounds])
  // three in a row, and the end: all frogs jump together
  const [chorus, setChorus] = useState(0)
  useEffect(() => { if (finale) { setChorus(c => c + 1); burst(pondRef.current, 'confetti', 18) } }, [finale, burst])

  if (!r) return null

  const drop = (L, el) => {
    if (isOver() || hasTried(L)) return false
    if (L === r.letter) {
      land(L)
      const streaky = !tried.length && streak + 1 >= 3
      win(streaky ? 2600 : 2200)
      sfx.splash()
      burst(el, streaky ? 'confetti' : 'stars', streaky ? 16 : 10)
      if (streaky) setTimeout(() => setChorus(c => c + 1), 500)
      sayRight()
      return true
    }
    sayWrong()
    if (miss(L) >= 2) {
      // After two misses the catch goes into the right bucket by itself.
      reveal(3000)
      setTimeout(() => { sfx.whoosh(); land(r.letter) }, 1200)
    }
    return false
  }

  // After solving: the word, its first letter picked out
  const spelled = <><strong style={{ color: ACCENT, fontSize: '1.3em' }}>{r.word[0]}</strong>{r.word.slice(1)}</>
  const voiced = !!wordRec(r.word)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: 'clamp(10px,2vw,22px) clamp(12px,3vw,32px) clamp(14px,3vh,30px)', gap: 8,
    }}>
      <RoundTrail total={rounds.length} done={idx + (done ? 1 : 0)} walker="🐟" goal="🐸" style={{ width: 'calc(100% - 80px)', maxWidth: 560 }} />

      <DragArea disabled={done}>
        {/* Lumi fishing: the rod, the line, and what hangs on the hook */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 760, height: HOOK + 225, overflow: 'hidden', flexShrink: 0 }}>
          <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <line x1="17%" y1="118" x2="50%" y2="6" stroke="#8a5a2b" strokeWidth="7" strokeLinecap="round" />
            <line x1="17%" y1="118" x2="50%" y2="6" stroke="#b88450" strokeWidth="3" strokeLinecap="round" />
            <circle cx="22%" cy="101" r="7" fill="#555" stroke={INK} strokeWidth="2" />
          </svg>
          <motion.div key={'lumi' + idx} style={{ position: 'absolute', left: 'max(4px, calc(17% - 70px))', top: 70, transformOrigin: '50% 100%' }}
            animate={r.heavy && !reduceMotion() ? { x: [0, 0, 46, 40, 0], rotate: [0, 0, 22, 16, 0] } : {}}
            transition={{ duration: 1.8, times: [0, 0.12, 0.3, 0.7, 1] }}>
            <Critter art="lumi" size={92} talks label="Lumi" mood={finale ? 'dance' : r.heavy && !done ? 'wow' : done && tried.length < 2 ? 'happy' : 'idle'} />
          </motion.div>
          {/* the heavy catch: a big splash where the line goes in */}
          {r.heavy && !reduceMotion() && !got && (
            <div key={'splash' + idx} aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: 6, width: 0, height: 0, pointerEvents: 'none' }}>
              {Array.from({ length: 10 }, (_, k) => (
                <motion.div key={k} initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                  animate={{ x: (k - 4.5) * 22, y: [0, -110 - (k % 3) * 30, 20], opacity: [0, 1, 0], scale: 1 }}
                  transition={{ duration: 0.9, delay: 0.6 + (k % 2) * 0.45, ease: 'easeOut' }}
                  style={{ position: 'absolute', left: -8, top: -8, width: 16, height: 20, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: '#4aa3ff', border: `2px solid ${INK}` }} />
              ))}
            </div>
          )}
          {/* where the catch hangs, for the hint hand */}
          <div ref={catchRef} aria-hidden="true" style={{ position: 'absolute', left: '50%', top: HOOK + 80, width: 2, height: 2 }} />

          <AnimatePresence mode="popLayout">
            {!got && !leaving && <Catch key={idx} item={r} heavy={r.heavy} />}
          </AnimatePresence>
          {/* solved: the word, written, where the catch was */}
          <AnimatePresence>
            {got && !leaving && (
              <motion.div key={'w' + idx} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ type: 'spring', stiffness: 360, damping: 16, delay: 0.25 }}
                style={{
                  position: 'absolute', left: '50%', top: HOOK - 10, x: '-50%', display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none',
                  background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: '0 5px 0 rgba(42,27,61,0.3)',
                  padding: '6px 18px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(26px,5vw,36px)', color: INK,
                }}>
                <Art art={r.emoji} size={52} /><span>{spelled}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {voiced && (
            <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={sayTask}
              aria-label="Wort noch einmal anhören"
              style={{ ...pxButton('gold'), position: 'absolute', right: 'clamp(4px,4%,40px)', top: HOOK, width: 60, height: 60, padding: 0, fontSize: 28, lineHeight: 1 }}>🔊</motion.button>
          )}
        </div>

        {/* The frogs with their buckets, at the edge of the pond */}
        <div ref={pondRef} style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 820 }}>
          {r.options.map((L, i) => (
            <FrogBucket key={`${idx}-${L}`} gapRef={i === 0 ? gapRef : null} L={L} i={i} n={r.options.length}
              color={BUCKET_COLORS[i % BUCKET_COLORS.length]}
              state={got === L ? 'got' : tried.includes(L) ? 'tried' : 'wait'}
              pile={piles[L] ?? []} landed={got === L}
              hint={tried.length > 0 && !got ? keyOf(L, r.word) : null}
              chorus={chorus}
              onDrop={drop} />
          ))}
          {/* the running gag: now and then a fish leaps over the pond */}
          {r.fish && !reduceMotion() && (
            <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              <motion.div key={'fish' + idx} initial={{ left: '-8%', y: 0, opacity: 0, rotate: -30 }}
                animate={{ left: ['-8%', '45%', '100%'], y: [0, -90, 0], opacity: [0, 1, 0], rotate: [-30, 0, 40] }}
                transition={{ duration: 1.6, delay: 1.2, ease: 'easeInOut' }}
                onAnimationComplete={() => sfx.splash()}
                style={{ position: 'absolute', bottom: 4, width: 48, height: 48 }}>
                <Art art="🐟" size={48} />
              </motion.div>
            </div>
          )}
        </div>
        <HintHand from={catchRef} to={gapRef} active={!done && !leaving} delay={hintDelay(idx)} />
      </DragArea>
      {bursts}
    </div>
  )
}

/** What hangs on the hook: it comes up out of the water, drips and swings. */
function Catch({ item, heavy }) {
  const still = reduceMotion()
  // the heavy one surfaces later, slowly, after Lumi was yanked
  const late = heavy && !still ? 1.5 : 0
  useEffect(() => { const t = setTimeout(sfx.splash, 150 + late * 1000); return () => clearTimeout(t) }, [late])
  return (
    <motion.div
      initial={still ? { opacity: 0 } : { y: 240, opacity: 0, rotate: 0 }}
      animate={still ? { y: 0, opacity: 1 } : { y: 0, opacity: 1, rotate: [0, -5, 4, -3, 0] }}
      exit={{ scale: 0.4, opacity: 0, y: 60 }}
      transition={{ y: { duration: late ? 0.8 : 0.35, delay: late, ease: [0.2, 1.4, 0.5, 1] }, opacity: { duration: 0.15, delay: late }, rotate: { duration: 3.2, repeat: Infinity, delay: 1 + late } }}
      style={{ position: 'absolute', left: '50%', top: HOOK, marginLeft: -95, width: 190, transformOrigin: `50% -${HOOK}px` }}>
      {/* the line up to the rod, and the hook */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 94, bottom: '100%', width: 2, height: HOOK + 260, background: INK }} />
      <svg aria-hidden="true" width="26" height="30" viewBox="0 0 26 30" style={{ position: 'absolute', left: 82, top: -14 }}>
        <path d="M13 0 V18 a7 7 0 0 1 -12 2" stroke="#6b6b7a" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <Draggable id="catch" data={item} label={`Der Fang am Haken`}>
        <div style={{ padding: 4 }}>
          <Art art={item.emoji} size={180} />
        </div>
      </Draggable>
      {/* drips */}
      {!still && [0, 1, 2].map(k => (
        <motion.div key={k} aria-hidden="true" initial={{ y: 0, opacity: 0 }} animate={{ y: [0, 70], opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: 0.6 + k * 0.45 }}
          style={{ position: 'absolute', left: 50 + k * 44, top: 160, width: 9, height: 13, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: '#4aa3ff', border: `2px solid ${INK}`, pointerEvents: 'none' }} />
      ))}
    </motion.div>
  )
}

/**
 * A frog with a bucket that has its letter on it. The catch goes into the
 * bucket; tapping the frog (with nothing picked up) makes it croak its
 * letter. `hint` is a picture that starts with that letter (after a miss).
 * `pile`: what landed in this bucket over the level; the frog reacts to
 * each new one (`landed`).
 */
function FrogBucket({ gapRef, L, i, n, color, state, pile, landed, hint, chorus, onDrop }) {
  const { picked } = useDragState()
  const [croak, setCroak] = useState(0)
  const ref = useRef(null)
  const still = reduceMotion()
  const sayIt = () => {
    if (picked) return
    sfx.pop()
    setCroak(c => c + 1)
    narrate([soundRec(L)], { priority: 'preview' })
  }
  const spring = { type: 'spring', stiffness: 300, damping: 14 }
  const react = landed ? REACTIONS[(pile.length - 1) % REACTIONS.length] : null
  useEffect(() => {
    if (react === 'giggle') { const t = setTimeout(sfx.giggle, 500); return () => clearTimeout(t) }
    if (react === 'jump') { const t = setTimeout(sfx.splash, 900); return () => clearTimeout(t) }
  }, [react])
  return (
    <div ref={ref} style={{ position: 'relative', width: `calc((100% - ${(n - 1) * 12}px) / ${n})`, maxWidth: 190, minWidth: 0 }}>
      {/* between the first bucket and the next: the hint hand drags here, never into one answer */}
      {gapRef && <span ref={gapRef} aria-hidden="true" style={{ position: 'absolute', right: -7, top: '45%', width: 2, height: 2 }} />}
      <DropZone id={`eimer-${L}`} label={`Eimer ${L}`} onDrop={() => onDrop(L, ref.current)} slop={16}>
        {hover => (
          <div onClick={sayIt} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            {/* the frog: bobs, leans out when the catch comes near, flips when it gets it */}
            <motion.div
              animate={still ? {}
                : react === 'jump' ? { x: [0, 30, 90, 90, 0], y: [0, -90, 30, 30, 0], rotate: [0, 20, 40, 40, 0], scale: 1, transition: { duration: 1.6, times: [0, 0.25, 0.5, 0.7, 1] } }
                : react === 'sleepy' ? { y: [0, 6], scaleY: [1, 0.9], rotate: [0, -8], scale: 1, transition: { duration: 1.2 } }
                : state === 'got' ? { y: [0, -70, 0, -24, 0], rotate: [0, 0, 360, 360, 360], scale: 1, transition: { duration: 1 } }
                : state === 'tried' ? { y: 30, rotate: [0, -10, 10, 0], scale: 1, transition: spring }
                : hover ? { y: -14, scale: 1.12, rotate: 0, transition: spring }
                : { y: [0, -4, 0], scale: 1, rotate: 0, transition: { duration: 2 + i * 0.3, repeat: Infinity } }}
              style={{ width: '70%', aspectRatio: '1', marginBottom: '-18%', zIndex: 0, filter: state === 'tried' ? 'grayscale(0.8) brightness(0.9)' : undefined }}>
              {/* a hop of its own: tapped, or all frogs together */}
              <motion.div key={croak + chorus * 1000} style={{ width: '100%', height: '100%', transformOrigin: '50% 100%' }}
                animate={still || croak + chorus === 0 ? {} : { y: [0, -36, 0], scaleY: [1, 0.85, 1.12, 1] }}
                transition={{ duration: 0.55, delay: chorus && !croak ? i * 0.08 : 0 }}>
                <Art art="🐸" size={100} style={{ width: '100%', height: '100%' }} />
              </motion.div>
            </motion.div>
            {/* tapped: it croaks its letter */}
            <AnimatePresence>
              {croak > 0 && (
                <motion.div key={croak} aria-hidden="true" initial={{ scale: 0.3, opacity: 0, y: 0 }}
                  animate={{ scale: [0.3, 1.15, 1], opacity: [0, 1, 0], y: -40 }} transition={{ duration: 1 }}
                  style={{ position: 'absolute', top: '-8%', left: '62%', zIndex: 2, pointerEvents: 'none', fontFamily: 'var(--font-heading)',
                    fontWeight: 700, fontSize: 34, color, WebkitTextStroke: `2px ${INK}`, paintOrder: 'stroke fill' }}>{L}!</motion.div>
              )}
            </AnimatePresence>
            <svg viewBox="0 0 100 92" style={{ width: '88%', height: 'auto', position: 'relative', zIndex: 1, overflow: 'visible', opacity: state === 'tried' ? 0.7 : 1 }} aria-hidden="true">
              <path d="M10 14 Q50 -10 90 14" stroke={INK} strokeWidth="4" fill="none" />
              <path d="M8 18 L18 86 Q50 96 82 86 L92 18 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
              <ellipse cx="50" cy="18" rx="42" ry="9" fill={color} stroke={INK} strokeWidth="4" style={{ filter: 'brightness(0.75)' }} />
              <circle cx="50" cy="54" r="27" fill="#fffdf7" stroke={INK} strokeWidth="3" />
              <text x="50" y="55" textAnchor="middle" dominantBaseline="central" fontFamily="Fredoka, Nunito, sans-serif" fontWeight="700" fontSize="40" fill={INK}>{L}</text>
            </svg>
            {/* the hint: a picture that starts like the letter */}
            <AnimatePresence>
              {hint && state !== 'tried' && (
                <motion.div key="hint" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }} transition={spring}
                  style={{ position: 'absolute', right: '-4%', bottom: 12, zIndex: 2, width: '42%', maxWidth: 52, aspectRatio: '1', borderRadius: '50%',
                    background: '#fffdf7', border: `3px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Art art={hint} size={40} style={{ width: '78%', height: '78%' }} />
                </motion.div>
              )}
            </AnimatePresence>
            {/* the catches of the level, peeking out of the bucket beside the frog */}
            {pile.map((e, k) => {
              const at = PILE_AT[k % PILE_AT.length], up = Math.floor(k / PILE_AT.length) * 10
              return (
                <motion.div key={k} initial={{ y: -80, scale: 0.3, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={spring}
                  style={{ position: 'absolute', left: `${at.x}%`, bottom: `${at.y + up}%`, width: '34%', marginLeft: '-17%', zIndex: 0, rotate: `${at.r}deg` }}>
                  <Art art={e} size={60} style={{ width: '100%', height: 'auto' }} />
                </motion.div>
              )
            })}
            {/* sleepy: Zzz */}
            {react === 'sleepy' && !still && (
              <motion.div aria-hidden="true" initial={{ opacity: 0, y: 0 }} animate={{ opacity: [0, 1, 1, 0], y: -40 }} transition={{ duration: 2, delay: 0.6 }}
                style={{ position: 'absolute', top: '-4%', right: '8%', zIndex: 2, pointerEvents: 'none', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: '#4aa3ff' }}>Zzz</motion.div>
            )}
            {/* lily pad */}
            <div aria-hidden="true" style={{ width: '104%', height: 18, marginTop: -10, borderRadius: '50%', background: '#5cc45a', border: `3px solid ${INK}`, zIndex: 0 }} />
          </div>
        )}
      </DropZone>
    </div>
  )
}
