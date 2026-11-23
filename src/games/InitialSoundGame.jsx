import { useCallback, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { soundOf } from './letterSounds.js'
import { Critter, Art, DragArea, Draggable, DropZone, RoundTrail, useBursts, useDragState } from '../components/play/index.js'
import { useRounds, reduceMotion, shuffle } from './buchstaben/useRounds.js'
import { pxButton, ACCENT, INK } from './px.js'

/**
 * Anlaut-Detektiv: Anlaut-Angeln — welcher Buchstabe macht diesen Laut?
 *
 * Lumi angelt am Teich, und am Haken hängt jedes Mal etwas Überraschendes:
 * eine Maus, ein Sofa, ein Mond, tropfnass. Am Ufer sitzen Frösche, jeder
 * mit einem Eimer, auf dem sein Buchstabe steht. Das Kind bringt den Fang
 * in den Eimer mit dem Buchstaben, mit dem das Wort anfängt (ziehen, oder
 * erst den Fang und dann den Eimer antippen). Ein Frosch, den man antippt,
 * quakt seinen Laut.
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
  return Array.from({ length: count }, (_, i) => {
    const letter = targets[i % targets.length]
    // a word not seen yet in this level, if this letter still has one
    const at = unused.findIndex(w => w[0] === letter)
    const [, word, emoji] = at >= 0 ? unused.splice(at, 1)[0] : shuffle(WORDS.filter(w => w[0] === letter))[0]
    const partner = PARTNER[letter]
    let others = shuffle(pool.filter(l => l !== letter && l !== partner))
    if (cfg.pairs && partner && pool.includes(partner)) others = [partner, ...others]
    return { letter, word, emoji, options: shuffle([letter, ...others.slice(0, cfg.options - 1)]) }
  })
}

const BUCKET_COLORS = ['#e8483b', '#2f7fd8', '#e07a10', '#8a4fd0', '#13968c']
const HOOK = 150   // how far below the rod tip the catch hangs

export default function InitialSoundGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])
  const [bursts, burst] = useBursts()
  const [gotIn, setGot] = useState(null)   // { i, L }: the catch of round i is in bucket L
  const idxRef = useRef(0)

  // The word, then the question. Slower than normal speech, so the first
  // sound can be heard — but not so slow that it drags.
  const sayTask = useCallback(() => {
    const r = rounds[idxRef.current]
    if (r) narrate([{ text: `${r.word}. Mit welchem Laut fängt ${r.word} an?`, rate: 0.75 }])
  }, [rounds])

  const { idx, done, leaving, tried, win, miss, reveal } = useRounds(rounds.length, { onComplete, sayTask, outroMs: 450 })
  idxRef.current = idx
  const r = rounds[idx]
  const got = gotIn?.i === idx ? gotIn.L : null

  if (!r) return null
  const answer = `${r.word} fängt mit ${soundOf(r.letter)} an. Das ist das ${r.letter}.`

  const drop = (L, el) => {
    if (done || tried.includes(L)) return false
    if (L === r.letter) {
      setGot({ i: idx, L })
      win()
      sfx.splash()
      burst(el, 'stars')
      sayRight(answer)
      return true
    }
    if (miss(L) >= 2) {
      // After two misses Lumi shows the answer instead of letting the
      // child guess through the rest.
      sayWrong(`Hör mal, ${answer}`)
      reveal()
      setTimeout(() => { sfx.whoosh(); setGot({ i: idx, L: r.letter }) }, 1200)
    } else {
      sayWrong(`Das ist ${soundOf(L)}. Hör noch mal, ${r.word}.`)
    }
    return false
  }

  // After solving: the word, its first letter picked out
  const spelled = <><strong style={{ color: ACCENT, fontSize: '1.3em' }}>{r.word[0]}</strong>{r.word.slice(1)}</>

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
      padding: 'clamp(10px,2vw,22px) clamp(12px,3vw,32px) clamp(14px,3vh,30px)', gap: 8,
    }}>
      <RoundTrail total={rounds.length} done={idx + (done ? 1 : 0)} walker="🐟" goal="🐸" style={{ width: 'calc(100% - 80px)', maxWidth: 560 }} />

      <DragArea disabled={done}>
        {/* Lumi fishing: the rod, the line, and what hangs on the hook */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 760, height: HOOK + 190, overflow: 'hidden', flexShrink: 0 }}>
          <svg aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <line x1="17%" y1="118" x2="50%" y2="6" stroke="#8a5a2b" strokeWidth="7" strokeLinecap="round" />
            <line x1="17%" y1="118" x2="50%" y2="6" stroke="#b88450" strokeWidth="3" strokeLinecap="round" />
            <circle cx="22%" cy="101" r="7" fill="#555" stroke={INK} strokeWidth="2" />
          </svg>
          <div style={{ position: 'absolute', left: 'max(4px, calc(17% - 70px))', top: 70 }}>
            <Critter art="lumi" size={92} talks label="Lumi" mood={done && tried.length < 2 ? 'happy' : 'idle'} />
          </div>

          <AnimatePresence mode="popLayout">
            {!got && !leaving && (
              <Catch key={idx} item={r} />
            )}
          </AnimatePresence>
          {/* solved: the word, written, where the catch was */}
          <AnimatePresence>
            {got && (
              <motion.div key={'w' + idx} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 360, damping: 16, delay: 0.25 }}
                style={{
                  position: 'absolute', left: '50%', top: HOOK - 10, x: '-50%', display: 'flex', alignItems: 'center', gap: 10,
                  background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: '0 5px 0 rgba(42,27,61,0.3)',
                  padding: '6px 18px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(26px,5vw,36px)', color: INK,
                }}>
                <Art art={r.emoji} size={52} /><span>{spelled}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={sayTask}
            aria-label="Wort noch einmal anhören"
            style={{ ...pxButton('gold'), position: 'absolute', right: 'clamp(4px,4%,40px)', top: HOOK, width: 60, height: 60, padding: 0, fontSize: 28, lineHeight: 1 }}>🔊</motion.button>
        </div>

        {/* The frogs with their buckets, at the edge of the pond */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 820 }}>
          {r.options.map((L, i) => (
            <FrogBucket key={`${idx}-${L}`} L={L} i={i} n={r.options.length}
              color={BUCKET_COLORS[i % BUCKET_COLORS.length]}
              state={got === L ? 'got' : tried.includes(L) ? 'tried' : 'wait'}
              item={got === L ? r.emoji : null}
              onDrop={drop} />
          ))}
        </div>
      </DragArea>
      {bursts}
    </div>
  )
}

/** What hangs on the hook: it comes up out of the water, drips and swings. */
function Catch({ item }) {
  const still = reduceMotion()
  return (
    <motion.div
      initial={still ? { opacity: 0 } : { y: 240, opacity: 0, rotate: 0 }}
      animate={still ? { y: 0, opacity: 1 } : { y: 0, opacity: 1, rotate: [0, -5, 4, -3, 0] }}
      exit={{ scale: 0.4, opacity: 0, y: 60 }}
      transition={{ y: { type: 'spring', stiffness: 120, damping: 13, delay: 0.15 }, opacity: { duration: 0.2, delay: 0.15 }, rotate: { duration: 3.2, repeat: Infinity, delay: 1 } }}
      onAnimationStart={() => sfx.splash()}
      style={{ position: 'absolute', left: '50%', top: HOOK, marginLeft: -75, width: 150, transformOrigin: `50% -${HOOK}px` }}>
      {/* the line up to the rod, and the hook */}
      <div aria-hidden="true" style={{ position: 'absolute', left: 74, bottom: '100%', width: 2, height: HOOK + 260, background: INK }} />
      <svg aria-hidden="true" width="26" height="30" viewBox="0 0 26 30" style={{ position: 'absolute', left: 62, top: -14 }}>
        <path d="M13 0 V18 a7 7 0 0 1 -12 2" stroke="#6b6b7a" strokeWidth="4" fill="none" strokeLinecap="round" />
      </svg>
      <Draggable id="catch" data={item} label={`Der Fang am Haken`}>
        <div style={{ padding: 4 }}>
          <Art art={item.emoji} size={140} />
        </div>
      </Draggable>
      {/* drips */}
      {!still && [0, 1, 2].map(k => (
        <motion.div key={k} aria-hidden="true" initial={{ y: 0, opacity: 0 }} animate={{ y: [0, 70], opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, repeat: Infinity, delay: 0.6 + k * 0.45 }}
          style={{ position: 'absolute', left: 40 + k * 34, top: 120, width: 9, height: 13, borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: '#4aa3ff', border: `2px solid ${INK}`, pointerEvents: 'none' }} />
      ))}
    </motion.div>
  )
}

/**
 * A frog with a bucket that has its letter on it. The catch goes into the
 * bucket; tapping the frog (with nothing picked up) makes it say its sound.
 */
function FrogBucket({ L, i, n, color, state, item, onDrop }) {
  const { picked } = useDragState()
  const [croak, setCroak] = useState(0)
  const ref = useRef(null)
  const still = reduceMotion()
  const sayIt = () => {
    if (picked) return
    sfx.pop()
    setCroak(c => c + 1)
    narrate([{ text: soundOf(L) }], { priority: 'preview' })
  }
  const frog = still ? {}
    : state === 'got' ? { y: [0, -70, 0, -24, 0], rotate: [0, 0, 360, 360, 360] }
    : state === 'tried' ? { y: 30, rotate: [0, -10, 10, 0] }
    : { y: [0, -4, 0], scaleY: croak % 2 ? [1, 0.8, 1.15, 1] : [1, 1.04, 1] }
  return (
    <div ref={ref} style={{ width: `calc((100% - ${(n - 1) * 12}px) / ${n})`, maxWidth: 150, minWidth: 0 }}>
      <DropZone id={`eimer-${L}`} label={`Eimer ${L}`} onDrop={() => onDrop(L, ref.current)} slop={16}>
        {hover => (
          <div onClick={sayIt} style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer' }}>
            <motion.div key={croak}
              animate={hover && !still ? { y: -14, scale: 1.12 } : frog}
              transition={state === 'got' ? { duration: 1 } : hover || state === 'tried' ? { type: 'spring', stiffness: 300, damping: 14 } : { duration: 2 + i * 0.3, repeat: croak % 2 ? 0 : Infinity }}
              style={{ width: '70%', aspectRatio: '1', marginBottom: '-18%', zIndex: 0, filter: state === 'tried' ? 'grayscale(0.8) brightness(0.9)' : undefined }}>
              <Art art="🐸" size={100} style={{ width: '100%', height: '100%' }} />
            </motion.div>
            <svg viewBox="0 0 100 92" style={{ width: '88%', height: 'auto', position: 'relative', zIndex: 1, overflow: 'visible', opacity: state === 'tried' ? 0.7 : 1 }} aria-hidden="true">
              <path d="M10 14 Q50 -10 90 14" stroke={INK} strokeWidth="4" fill="none" />
              <path d="M8 18 L18 86 Q50 96 82 86 L92 18 Z" fill={color} stroke={INK} strokeWidth="4" strokeLinejoin="round" />
              <ellipse cx="50" cy="18" rx="42" ry="9" fill={color} stroke={INK} strokeWidth="4" style={{ filter: 'brightness(0.75)' }} />
              <circle cx="50" cy="54" r="27" fill="#fffdf7" stroke={INK} strokeWidth="3" />
              <text x="50" y="55" textAnchor="middle" dominantBaseline="central" fontFamily="Fredoka, Nunito, sans-serif" fontWeight="700" fontSize="40" fill={INK}>{L}</text>
            </svg>
            {/* the catch, peeking out of the bucket it went into */}
            <AnimatePresence>
              {item && (
                <motion.div initial={{ y: -60, scale: 0.3, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                  style={{ position: 'absolute', left: '50%', bottom: '58%', width: '50%', marginLeft: '-25%', zIndex: 0 }}>
                  <Art art={item} size={70} style={{ width: '100%', height: 'auto' }} />
                </motion.div>
              )}
            </AnimatePresence>
            {/* lily pad */}
            <div aria-hidden="true" style={{ width: '104%', height: 18, marginTop: -10, borderRadius: '50%', background: '#5cc45a', border: `3px solid ${INK}`, zIndex: 0 }} />
          </div>
        )}
      </DropZone>
    </div>
  )
}
