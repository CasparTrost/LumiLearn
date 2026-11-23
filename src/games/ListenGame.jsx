import { useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { Critter, Art, Wish, RoundTrail, useBursts } from '../components/play/index.js'
import { useRounds, useSpeaking, shuffle, chance, reduceMotion } from './buchstaben/useRounds.js'
import { pxButton, INK } from './px.js'

/**
 * Hörabenteuer: das Versteckspiel — Phonologisches Bewusstsein
 *
 * Hinter Büschen gucken Tiere und Dinge hervor. Lumi ruft ein Wort, das Kind
 * tippt auf den richtigen Busch, und das Gesuchte hüpft lachend heraus. Wer
 * sich irrt, lockt das Falsche hervor: es zeigt sich und sagt, wer es ist.
 * In den Lese-Levels stecken die Dinge ganz im Busch; vor jedem steht ein
 * Schild, und Lumi zeigt das Bild dessen, was gesucht wird.
 *
 * Scientific basis:
 *   • Phonological Awareness (National Reading Panel, 2000) — connecting spoken words to images
 *     is the single strongest predictor of reading readiness.
 *   • Dual Coding Theory (Paivio, 1990) — audio + visual encoding deepens memory traces.
 *   • Peabody Picture Vocabulary Test methodology — hear a word, find the matching picture.
 */

// [article, word, picture]. Every picture shows one thing a child names the
// same way; the wrong answers are other words of this list, so each one has
// a name Lumi can say after a wrong tap ("Das ist der Hai.").
const BANK = {
  tier: [
    ['der','Hund','🐕'], ['die','Katze','🐱'], ['das','Pferd','🐴'], ['die','Kuh','🐄'], ['das','Schaf','🐑'],
    ['das','Schwein','🐖'], ['der','Löwe','🦁'], ['der','Tiger','🐯'], ['der','Bär','🐻'], ['der','Fuchs','🦊'],
    ['der','Elefant','🐘'], ['die','Giraffe','🦒'], ['der','Affe','🐒'], ['der','Pinguin','🐧'], ['die','Eule','🦉'],
    ['der','Frosch','🐸'], ['die','Schildkröte','🐢'], ['die','Biene','🐝'], ['der','Schmetterling','🦋'],
    ['die','Schnecke','🐌'], ['das','Krokodil','🐊'], ['der','Delfin','🐬'], ['der','Hai','🦈'], ['der','Fisch','🐟'],
    ['der','Igel','🦔'], ['der','Regenwurm','🪱'],
  ],
  essen: [
    ['der','Apfel','🍎'], ['die','Banane','🍌'], ['die','Erdbeere','🍓'], ['die','Pizza','🍕'], ['der','Kuchen','🎂'],
    ['das','Eis','🍦'], ['das','Brot','🍞'], ['der','Keks','🍪'], ['die','Milch','🥛'], ['der','Saft','🧃'],
    ['die','Karotte','🥕'], ['die','Tomate','🍅'],
  ],
  ding: [
    ['der','Ball','⚽'], ['das','Buch','📚'], ['die','Schere','✂️'], ['der','Stuhl','🪑'], ['das','Bett','🛏️'],
    ['die','Krone','👑'], ['das','Geschenk','🎁'], ['die','Brille','👓'], ['die','Gitarre','🎸'], ['der','Koffer','🧳'],
    ['die','Kerze','🕯️'], ['der','Schlüssel','🔑'], ['die','Trommel','🥁'], ['der','Anker','⚓'], ['der','Zauberstab','🪄'],
    ['der','Diamant','💎'], ['der','Hut','🎩'], ['der','Eimer','🪣'], ['der','Kompass','🧭'], ['der','Drache','🐉'],
  ],
  fahrzeug: [
    ['die','Rakete','🚀'], ['der','Zug','🚂'], ['das','Auto','🚗'], ['das','Flugzeug','✈️'], ['das','Schiff','🚢'],
    ['das','Fahrrad','🚲'], ['der','Traktor','🚜'], ['die','Straßenbahn','🚊'], ['der','Hubschrauber','🚁'], ['der','Bus','🚌'],
  ],
  natur: [
    ['die','Sonne','☀️'], ['der','Mond','🌙'], ['der','Stern','⭐'], ['der','Regenbogen','🌈'], ['die','Blume','🌸'],
    ['der','Baum','🌳'], ['der','Pilz','🍄'], ['die','Welle','🌊'], ['der','Vulkan','🌋'], ['das','Haus','🏠'],
    ['das','Schloss','🏰'], ['das','Zelt','⛺'],
  ],
}
const item = (cat) => ([art, word, emoji]) => ({ art, word, emoji, cat })
const WORD_BANK = Object.entries(BANK).flatMap(([cat, list]) => list.map(item(cat)))

// Never wrong answers for each other: a shark is a fish, too, and a child
// may well call a cake a biscuit.
const CLOSE = [['Fisch','Hai','Delfin'], ['Kuchen','Keks'], ['Milch','Saft'], ['Haus','Schloss','Zelt'], ['Zug','Straßenbahn']]
const isClose = (a, b) => CLOSE.some(g => g.includes(a) && g.includes(b))

// Words that differ in a single sound. Picking between these is the one
// thing that really needs close listening — the ordinary rounds vary
// meaning, not sound, and can be won on vocabulary alone.
const MINIMAL_SETS = [
  [['das','Haus','🏠'], ['die','Maus','🐭'], ['der','Mais','🌽']],
  [['die','Nase','👃'], ['der','Hase','🐰'], ['die','Vase','🏺']],
  [['die','Rose','🌹'], ['die','Hose','👖'], ['die','Dose','🥫']],
  [['die','Kanne','🫖'], ['die','Tanne','🌲'], ['die','Pfanne','🍳']],
  [['der','Mond','🌙'], ['der','Mund','👄'], ['der','Hund','🐕']],
  [['das','Bein','🦵'], ['das','Schwein','🐖'], ['der','Stein','🪨']],
  [['die','Katze','🐱'], ['die','Tatze',':px-tatze:']],
  [['die','Kuh','🐄'], ['der','Schuh','👟']],
  [['der','Fisch','🐟'], ['der','Tisch',':px-tisch:']],
  [['der','Hahn','🐓'], ['der','Zahn','🦷']],
  [['die','Tasse','☕'], ['die','Tasche','👜']],
  [['der','Wal','🐋'], ['der','Schal','🧣']],
].map(set => set.map(item('paar')))
const PAIR_WORDS = new Set(MINIMAL_SETS.flat().map(w => w.word))

// The steps: pictures from different areas, then from the same area (Hund
// or Katze?), then words that differ in a single sound (Haus, Maus, Mais),
// at last reading — the picture is shown, the word must be read.
// `minimal`: every third round (some) or two of three (most).
const LEVELS = [
  { options:3 },
  { options:4 },
  { options:4, sameCat:true },
  { options:4, sameCat:true, minimal:'some' },
  { options:4, sameCat:true, minimal:'some' },
  { options:3, sameCat:true, minimal:'most' },
  { options:3, sameCat:true, minimal:'most' },
  { options:4, read:true },
  { options:4, read:true, sameCat:true },
  { options:3, read:true, minimal:'all' },
]
const ROUNDS = 8

function buildRounds(level) {
  const cfg = LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))]
  // With sound-pair rounds in play, their words stay out of the others, so
  // no word comes up twice in one level.
  const base = shuffle(WORD_BANK.filter(w => !cfg.minimal || !PAIR_WORDS.has(w.word)))
  const sets = shuffle(MINIMAL_SETS)
  const isMinimal = i => cfg.minimal === 'all' || (cfg.minimal === 'most' ? i % 3 !== 0 : cfg.minimal === 'some' && i % 3 === 2)

  const fill = (target, taken, n) => {
    const free = WORD_BANK.filter(w => w.word !== target.word && !(cfg.minimal && PAIR_WORDS.has(w.word))
      && !isClose(w.word, target.word) && !taken.some(t => t.word === w.word || isClose(t.word, w.word)))
    const same  = free.filter(w => w.cat === target.cat)
    const other = free.filter(w => w.cat !== target.cat)
    return (cfg.sameCat ? [...shuffle(same), ...shuffle(other)] : shuffle(other)).slice(0, n)
  }

  let next = 0
  return Array.from({ length: ROUNDS }, (_, i) => {
    if (isMinimal(i)) {
      const set = sets[i % sets.length]
      const target = shuffle(set)[0]
      const extra = cfg.options > set.length ? fill(target, set, cfg.options - set.length) : []
      return { target, options: shuffle([...set, ...extra]), pair: true }
    }
    const target = base[next++ % base.length]
    return { target, options: shuffle([target, ...fill(target, [target], cfg.options - 1)]) }
  })
}

const the = w => `${w.art} ${w.word}`
const The = w => the(w)[0].toUpperCase() + the(w).slice(1)

export default function ListenGame({ level = 1, onComplete }) {
  const isReading = !!LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))].read
  // now and then a bird flies out of the bush, too
  const rounds = useMemo(() => buildRounds(level).map(r => ({ ...r, bird: chance(0.3) })), [level])
  const [bursts, burst] = useBursts()
  const speaking = useSpeaking()

  // Reading levels never say the word before it is answered — otherwise
  // they would be one more listening task, not reading.
  const idxRef = useRef(0)
  const sayTask = useCallback(() => {
    const i = idxRef.current, target = rounds[i]?.target
    if (!target) return
    if (isReading) narrate([{ text: 'Welches Wort passt zum Bild? Lies genau.' }])
    else narrate([
      { text: i === 0 ? 'Wer hat sich versteckt? Hör gut zu und tippe auf den richtigen Busch.' : 'Such mal!' },
      { text: target.word, rate: 0.72, pitch: 1.1, gap: 200 },
    ])
  }, [rounds, isReading])

  const { idx, done, leaving, tried, win, miss, reveal } = useRounds(rounds.length, { onComplete, sayTask, outroMs: 500 })
  idxRef.current = idx
  const round = rounds[idx]
  const current = round?.target

  // the word alone, for the 🔊 in Lumi's bubble
  const sayWord = () => {
    if (isReading) sayTask()
    else narrate([{ text: current.word, rate: 0.72, pitch: 1.1 }])
  }

  const pick = (opt, el) => {
    if (done || tried.includes(opt.word)) return
    if (opt.word === current.word) {
      win()
      sfx.giggle(); sfx.slideUp()
      burst(el, chance(0.5) ? 'stars' : 'hearts')
      sayRight(`Gefunden! ${The(current)}.`)
      return
    }
    // A wrong bush can be corrected; after the second one Lumi shows the
    // right one instead of letting the child guess on.
    sfx.boing()
    if (miss(opt.word) >= 2) {
      sayWrong(isReading ? `Schau mal, hier steht ${current.word}.` : `Schau mal, das ist ${the(current)}.`)
      reveal()
    } else {
      sayWrong(isReading ? `Da steht ${opt.word}.` : `Das ist ${the(opt)}. Hör noch mal, ${current.word}.`)
    }
  }

  if (!current) return null
  const lumiMood = done ? (tried.length < 2 ? 'happy' : 'idle') : tried.length ? 'oops' : 'idle'

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly',
      padding: 'clamp(10px,2vw,24px) clamp(12px,3vw,32px)', gap: 'clamp(8px,1.5vh,16px)',
    }}>
      <RoundTrail total={rounds.length} done={idx + (done ? 1 : 0)} walker="lumi" goal="🎁" style={{ width: 'calc(100% - 80px)', maxWidth: 560 }} />

      {/* Lumi is the seeker: calls the word, or shows the picture */}
      <div style={{ position: 'relative', alignSelf: 'flex-start', marginLeft: 'clamp(8px,8vw,120px)', marginTop: isReading ? 90 : 60 }}>
        <Critter art="lumi" size={108} talks mood={lumiMood} label="Lumi" />
        <Wish side="right" size={108}>
          {isReading && <Art art={current.emoji} size={84} />}
          <motion.button
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.92 }}
            onClick={sayWord}
            animate={!done && !speaking && !reduceMotion() ? { scale: [1, 1.07, 1] } : { scale: 1 }}
            transition={{ duration: 1.4, repeat: Infinity }}
            aria-label={isReading ? 'Aufgabe noch einmal anhören' : 'Wort anhören'}
            style={{ ...pxButton('gold'), width: 64, height: 64, padding: 0, fontSize: 30, lineHeight: 1 }}
          >🔊</motion.button>
        </Wish>
      </div>

      {/* The bushes */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end',
        gap: 16, width: '100%', maxWidth: 760,
      }}>
        {round.options.map((opt, i) => {
          const isAns = opt.word === current.word
          const state = (done && isAns) ? 'out'
            : tried.includes(opt.word) ? 'tried'
            : (done || leaving || isReading) ? 'hide' : 'peek'
          return (
            <HideBush key={`${idx}-${opt.word}`} i={i} n={round.options.length} item={opt} state={state} sign={isReading ? opt.word : null}
              disabled={done || tried.includes(opt.word)} surprise={isAns && round.bird}
              label={isReading ? opt.word : `Busch ${i + 1}`}
              onTap={el => pick(opt, el)} />
          )
        })}
      </div>
      {bursts}
    </div>
  )
}

/**
 * A bush with something hiding behind it. state: peek (the top shows and
 * bobs), hide (all of it behind the leaves), out (hops out and cheers),
 * tried (a wrong guess: it shows itself and shrugs).
 */
function HideBush({ i, n, item, state, sign, disabled, surprise, label, onTap }) {
  // on a phone four bushes stand two by two, so none gets too small to hit
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600
  const width = narrow && n !== 3 ? 'calc(50% - 8px)' : `calc((100% - ${(n - 1) * 16}px) / ${n})`
  const still = reduceMotion()
  // in parts of the thing's own height: how far it is out of the bush
  const y = { hide: '15%', peek: '-62%', out: '-95%', tried: '-92%' }[state]
  const thing = still ? { y, opacity: state === 'tried' ? 0.6 : 1 }
    : state === 'out' ? { y: ['-62%', '-160%', y], rotate: [0, 0, 360], scale: [1, 1.25, 1.12], opacity: 1 }
    : state === 'tried' ? { y, rotate: [0, -12, 12, -8, 0], scale: 0.92, opacity: 0.6 }
    : state === 'peek' ? { y: [y, '-70%', y], rotate: 0, scale: 1, opacity: 1 }
    : { y, rotate: 0, scale: 0.75, opacity: 1 }
  const tt = state === 'out' ? { duration: 0.9, ease: 'easeOut' }
    : state === 'peek' ? { duration: 1.8 + (i % 3) * 0.4, repeat: Infinity, delay: 0.3 + i * 0.12 }
    : { type: 'spring', stiffness: 260, damping: 16 }

  return (
    <motion.button type="button" aria-label={label} disabled={disabled}
      onClick={e => { sfx.pop(); onTap(e.currentTarget) }}
      whileTap={disabled || still ? undefined : { rotate: [0, -4, 4, -2, 0], scale: 0.97 }}
      style={{
        all: 'unset', position: 'relative', width, maxWidth: 168, minWidth: 96, aspectRatio: '168 / 230',
        cursor: disabled ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent',
      }}>
      {/* the thing, behind the leaves */}
      <motion.div initial={{ y: '15%' }} animate={thing} transition={tt}
        style={{ position: 'absolute', left: '18%', width: '64%', bottom: '14%', aspectRatio: '1', display: 'flex', justifyContent: 'center' }}>
        <Art art={item.emoji} size={110} style={{ width: '100%', height: '100%' }} />
        {state === 'out' && surprise && !still && (
          <motion.div initial={{ x: 0, y: 30, opacity: 1 }} animate={{ x: 260, y: -260, opacity: [1, 1, 0] }} transition={{ duration: 1.4, delay: 0.3 }}
            style={{ position: 'absolute', left: '30%', top: '30%' }} onAnimationStart={() => sfx.whoosh()}>
            <Art art="🐦" size={48} />
          </motion.div>
        )}
      </motion.div>
      {/* the bush */}
      <motion.svg viewBox="0 0 168 150" aria-hidden="true"
        animate={state === 'out' || state === 'tried' ? { rotate: [0, -3, 3, -2, 0], scaleY: [1, 0.94, 1.03, 1] } : {}}
        transition={{ duration: 0.5 }}
        style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 'auto', overflow: 'visible', transformOrigin: '50% 100%' }}>
        <g stroke={INK} strokeWidth="4">
          <ellipse cx="84" cy="140" rx="78" ry="10" fill="rgba(42,27,61,0.18)" stroke="none" />
          <circle cx="40" cy="98" r="38" fill="#3f9a4a" />
          <circle cx="128" cy="98" r="38" fill="#3f9a4a" />
          <circle cx="84" cy="70" r="46" fill="#4caf55" />
          <circle cx="58" cy="60" r="30" fill="#4caf55" />
          <circle cx="112" cy="62" r="30" fill="#4caf55" />
          <rect x="10" y="100" width="148" height="40" rx="20" fill="#3f9a4a" />
        </g>
        {/* inner parts without outline, so the blobs read as one bush */}
        <circle cx="40" cy="98" r="35" fill="#3f9a4a" />
        <circle cx="128" cy="98" r="35" fill="#3f9a4a" />
        <rect x="13" y="103" width="142" height="34" rx="17" fill="#3f9a4a" />
        <circle cx="84" cy="72" r="43" fill="#4caf55" />
        <circle cx="58" cy="62" r="27" fill="#4caf55" />
        <circle cx="112" cy="64" r="27" fill="#4caf55" />
        <path d="M44 56 q10 -10 22 -4 M98 40 q12 -8 22 2 M30 96 q8 -8 18 -2 M118 98 q8 -8 18 -2" stroke="#7fd07e" strokeWidth="5" fill="none" strokeLinecap="round" />
        {[[52, 88], [118, 76], [84, 112], [140, 116]].map(([x, yy]) => <circle key={x} cx={x} cy={yy} r="6" fill="#ff6b8a" stroke={INK} strokeWidth="2.5" />)}
      </motion.svg>
      {/* reading levels: a sign in front */}
      {sign && (
        <div style={{
          position: 'absolute', left: '50%', bottom: '3%', transform: 'translateX(-50%) rotate(-2deg)', maxWidth: '108%',
          background: '#e9b872', border: `3px solid ${INK}`, borderRadius: 8, boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
          padding: '4px 10px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(15px,2.6vw,22px)', color: INK,
          whiteSpace: 'nowrap',
        }}>{sign}</div>
      )}
    </motion.button>
  )
}
