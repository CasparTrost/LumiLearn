import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { pxCard, pxPanel, pxBubble, pxButton, pxSegment, ACCENT, INK } from './px.js'

/**
 * Reim-Rallye — hören, was sich reimt
 *
 * Rhyme awareness is among the best-established predictors of later reading,
 * and no module covered it: Hörabenteuer tests vocabulary (which picture is
 * a "Katze"), Silben-Spaß works on syllables, ABC-Abenteuer on letters —
 * none of them on the sound at the end of a word.
 *
 * Scientific basis:
 *   • Rhyme/onset-rime awareness (Bradley & Bryant, 1983; Goswami) — hearing
 *     that Maus and Haus share an ending precedes phoneme-level analysis and
 *     predicts decoding skill years later.
 *   • The task is deliberately picture-based: no reading is required, so it
 *     measures the sound and not the spelling.
 *   • The levels step from recognising a rhyme to judging one (Ja/Nein),
 *     spotting the odd one out and finally completing a rhyme in a little
 *     verse — the usual order in which children master rhyme.
 */

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

const say = (text, opts) => narrate([{ text, rate: 0.8 }], opts)

// Words inside a group rhyme with each other (matching from the stressed
// vowel onward, not merely a shared last letter). Every picture shows its
// word and appears once. `v` is the rhyming vowel: groups with the same one
// sound alike (Banane – Kanne differ only in vowel length) and are kept
// apart until the last levels.
const RHYME_GROUPS = [
  { v:'au', words:[['Maus','🐭'], ['Haus','🏠']] },
  { v:'o',  words:[['Hose','👖'], ['Rose','🌹'], ['Dose','🥫']] },
  { v:'a',  words:[['Katze','🐱'], ['Tatze',':px-tatze:']] },
  { v:'u',  words:[['Hund','🐕'], ['Mund','👄']] },
  { v:'i',  words:[['Fisch','🐟'], ['Tisch',':px-tisch:']] },
  { v:'a',  words:[['Ball','⚽'], ['Knall','💥']] },
  { v:'a',  words:[['Nase','👃'], ['Hase','🐰'], ['Vase','🏺']] },
  { v:'u',  words:[['Kuh','🐄'], ['Schuh','👟']] },
  { v:'i',  words:[['Igel','🦔'], ['Spiegel','🪞']] },
  { v:'o',  words:[['Krone','👑'], ['Bohne','🫘'], ['Zitrone','🍋']] },
  { v:'a',  words:[['Kanne','🫖'], ['Tanne','🌲'], ['Pfanne','🍳']] },
  { v:'i',  words:[['Ziege','🐐'], ['Fliege','🪰']] },
  { v:'e',  words:[['Rakete','🚀'], ['Trompete','🎺']] },
  { v:'a',  words:[['Banane','🍌'], ['Fahne','🚩']] },
  { v:'ei', words:[['Eis','🍦'], ['Reis','🍚']] },
  { v:'ei', words:[['Bein','🦵'], ['Schwein','🐖'], ['Stein','🪨']] },
  { v:'a',  words:[['Hahn','🐓'], ['Zahn','🦷']] },
  { v:'o',  words:[['Boot','⛵'], ['Brot','🍞']] },
  { v:'a',  words:[['Hand','✋'], ['Strand','🏖️']] },
  { v:'u',  words:[['Wurm','🪱'], ['Turm','🗼']] },
  { v:'a',  words:[['Wal','🐋'], ['Schal','🧣']] },
].map(g => ({ ...g, words: g.words.map(([w, e]) => ({ w, e })) }))

// Little verses whose last word rhymes with an earlier one.
const VERSES = [
  { line:'Die Maus wohnt in einem …',          base:'Maus',    answer:'Haus' },
  { line:'Die Kuh trägt einen …',              base:'Kuh',     answer:'Schuh' },
  { line:'Die Ziege fängt eine …',             base:'Ziege',   answer:'Fliege' },
  { line:'Der Fisch sitzt am …',               base:'Fisch',   answer:'Tisch' },
  { line:'Der Hase hat eine rote …',           base:'Hase',    answer:'Nase' },
  { line:'Das Schwein sitzt auf einem …',      base:'Schwein', answer:'Stein' },
  { line:'Der Igel schaut in den …',           base:'Igel',    answer:'Spiegel' },
  { line:'Auf der Rakete spielt Lumi …',       base:'Rakete',  answer:'Trompete' },
  { line:'Der Hahn putzt sich den …',          base:'Hahn',    answer:'Zahn' },
  { line:'Im Boot isst Lumi …',                base:'Boot',    answer:'Brot' },
  { line:'Der Hund hat ein Eis im …',          base:'Hund',    answer:'Mund' },
  { line:'Die Krone ist so gelb wie eine …',   base:'Krone',   answer:'Zitrone' },
  { line:'Der Wal trägt einen …',              base:'Wal',     answer:'Schal' },
  { line:'Der Wurm klettert auf den …',        base:'Wurm',    answer:'Turm' },
  { line:'Die Katze leckt sich die …',         base:'Katze',   answer:'Tatze' },
  { line:'Die Rose wächst in einer …',         base:'Rose',    answer:'Dose' },
]

// pick: Was reimt sich auf …?  yesno: Reimt sich das?  odd: Welches reimt
// sich nicht?  verse: Reim ergänzen.  near: sound-alike wrong answers.
const LEVELS = [
  { mode:'pick',  options:2 },
  { mode:'pick',  options:3 },
  { mode:'pick',  options:4 },
  { mode:'yesno' },
  { mode:'odd',   options:3 },
  { mode:'pick',  options:4, near:true },
  { mode:'odd',   options:3, near:true },
  { mode:'verse', options:3 },
  { mode:'verse', options:4 },
  { mode:'verse', options:4, near:true },
]

const groupOf = w => RHYME_GROUPS.find(g => g.words.some(x => x.w === w))
const wordOf  = w => groupOf(w).words.find(x => x.w === w)

/** Words that do not rhyme with `g` (and don't start like `first`). */
function nonRhymes(g, n, { near, first }) {
  const others = RHYME_GROUPS.filter(x => x !== g)
  // one word per group, so no two wrong answers rhyme with each other
  const pickFrom = list => shuffle(list).map(x => shuffle(x.words)[0]).filter(o => o.w[0] !== first)
  const alike = pickFrom(others.filter(x => x.v === g.v))
  const rest  = pickFrom(others.filter(x => x.v !== g.v))
  // with `near`, one of them sounds almost like a rhyme — that is the step up
  return (near ? [...alike.slice(0, 1), ...rest] : rest).slice(0, n)
}

function buildRounds(level, count = 8) {
  const cfg = LEVELS[Math.max(0, Math.min(level - 1, LEVELS.length - 1))]
  if (cfg.mode === 'verse') {
    return shuffle(VERSES).slice(0, count).map(v => {
      const g = groupOf(v.answer), correct = wordOf(v.answer)
      return { mode:'verse', verse:v, base:wordOf(v.base), correct,
        options: shuffle([correct, ...nonRhymes(g, cfg.options - 1, { near: cfg.near, first: v.base[0] })]) }
    })
  }
  const groups = shuffle(RHYME_GROUPS)
  return Array.from({ length: count }, (_, i) => {
    const g = groups[i % groups.length]
    const [base, partner] = shuffle(g.words)
    if (cfg.mode === 'yesno') {
      // half of them rhyme; the others are clearly different
      const rhymes = Math.random() < 0.5
      return { mode:'yesno', base, other: rhymes ? partner : nonRhymes(g, 1, { first: base.w[0] })[0], rhymes }
    }
    if (cfg.mode === 'odd') {
      const odd = nonRhymes(g, 1, { near: cfg.near, first: base.w[0] })[0]
      return { mode:'odd', base, partner, correct: odd, options: shuffle([base, partner, odd]) }
    }
    return { mode:'pick', base, correct: partner,
      options: shuffle([partner, ...nonRhymes(g, cfg.options - 1, { near: cfg.near, first: base.w[0] })]) }
  })
}

function taskOf(r) {
  if (r.mode === 'yesno') return [{ text: `Hör gut zu, ${r.base.w} und ${r.other.w}. Reimt sich das?`, rate: 0.8 }]
  if (r.mode === 'odd')   return [{ text: `Hör gut zu, ${r.options.map(o => o.w).join(', ')}. Welches Wort reimt sich nicht?`, rate: 0.8 }]
  if (r.mode === 'verse') return [
    { text: r.verse.line, rate: 0.8 },
    { text: `Was reimt sich auf ${r.base.w}?`, rate: 0.8, gap: 450 },
  ]
  return [{ text: `${r.base.w}. Was reimt sich auf ${r.base.w}?`, rate: 0.8 }]
}

const NEXT_BTN = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.4)' }

function Picture({ item, size }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:4 }}>
      <div style={{ fontSize:size, lineHeight:1, minHeight:'1em' }}>{item.e}</div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(20px,4.2vw,28px)', fontWeight:800, color:INK }}>{item.w}</div>
    </div>
  )
}

export default function RhymeGame({ level = 1, onComplete }) {
  const rounds = useState(() => buildRounds(level))[0]
  const paused = usePaused()
  const [idx,      setIdx]      = useState(0)
  const [wrong,    setWrong]    = useState([])
  const [solved,   setSolved]   = useState(false)
  const [mood,     setMood]     = useState('happy')
  const [firstTry, setFirstTry] = useState(0)
  const [leaving,  setLeaving]  = useState(false)

  const r = rounds[idx]

  const sayTask = useCallback(() => { if (r) narrate(taskOf(r)) }, [r])

  useEffect(() => { lockPreviews(); return () => stopNarration() }, [])

  // Round start, and again after the help dialog was closed.
  useEffect(() => {
    if (paused || solved) return
    const id = setTimeout(sayTask, 450)
    return () => clearTimeout(id)
  }, [idx, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const win = (text) => {
    if (!wrong.length) setFirstTry(n => n + 1)
    setSolved(true)
    setMood('excited')
    sfx.correct()
    sayRight(text)
  }
  const miss = (opt, hint, reveal) => {
    const misses = [...wrong, opt]
    setWrong(misses)
    setMood('encouraging')
    sfx.wrong()
    // After two misses (or the one chance of a Ja/Nein) Lumi says the answer.
    if (r.mode === 'yesno' || misses.length >= 2) {
      narrate([{ text: reveal, rate: 0.8 }])
      setSolved(true)
    } else {
      sayWrong(hint)
      setTimeout(() => setMood('happy'), 1100)
    }
  }

  const pick = (opt) => {
    if (solved || !r || wrong.includes(opt)) return
    if (r.mode === 'odd') {
      const [a, b] = [r.base, r.partner]
      if (opt === r.correct) win(`${r.correct.w} reimt sich nicht. ${a.w} und ${b.w} reimen sich.`)
      else {
        const other = opt === a ? b : a
        miss(opt, `${opt.w} und ${other.w} reimen sich doch. Welches klingt anders?`,
          `${a.w} und ${b.w} reimen sich. ${r.correct.w} klingt anders.`)
      }
      return
    }
    const done = r.mode === 'verse' ? `${r.verse.line.replace(' …', '')} ${r.correct.w}.` : `${r.base.w} und ${r.correct.w} reimen sich.`
    if (opt === r.correct) win(done)
    else miss(opt, `${r.base.w} und ${opt.w}, das klingt am Ende anders. Hör noch mal, ${r.base.w}.`,
      `Hör mal, ${done}`)
  }

  const answerYesNo = (yes) => {
    if (solved) return
    const what = `${r.base.w} und ${r.other.w} reimen sich${r.rhymes ? '' : ' nicht'}.`
    if (yes === r.rhymes) win(what)
    else miss(yes, '', `${what} Hör mal, ${r.base.w}, ${r.other.w}.`)
  }

  const weiterClick = () => {
    if (leaving) return
    if (idx + 1 >= rounds.length) {
      setLeaving(true)
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry, rounds.length)), { minMs: 300 })
    } else {
      lockPreviews()
      setWrong([]); setSolved(false); setMood('happy')
      setIdx(i => i + 1)
    }
  }

  if (!r) return null

  const bubble = solved
    ? (r.mode === 'yesno'
        ? <><strong style={{ color: ACCENT }}>{r.base.w}</strong> und <strong style={{ color: ACCENT }}>{r.other.w}</strong> reimen sich{r.rhymes ? '!' : ' nicht.'}</>
        : r.mode === 'odd'
          ? <><strong style={{ color: ACCENT }}>{r.correct.w}</strong> reimt sich nicht.</>
          : <>⭐ <strong style={{ color: ACCENT }}>{r.base.w}</strong> und <strong style={{ color: ACCENT }}>{r.correct.w}</strong> reimen sich!</>)
    : r.mode === 'yesno' ? <>Reimt sich das? 🎵</>
    : r.mode === 'odd'   ? <>Welches Wort reimt sich <strong>nicht</strong>? 🎵</>
    : r.mode === 'verse' ? <>{r.verse.line}</>
    : <>Was reimt sich auf <strong style={{ color: ACCENT }}>{r.base.w}</strong>? 🎵</>

  const options = r.options ?? []
  const cols = options.length === 4 ? 2 : options.length

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(12px,2vh,20px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {rounds.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < idx || (i === idx && solved) ? 'done' : i === idx ? 'current' : 'todo'),
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={68} />
        <div style={{
          flex: 1, ...pxBubble, padding: '12px 18px',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(17px,3.4vw,23px)', color: INK,
        }}>
          {bubble}
        </div>
        <motion.button
          whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          onClick={sayTask}
          aria-label="Aufgabe noch einmal anhören"
          style={{ ...pxButton('parch'), width: 52, height: 52, padding: 0, fontSize: 24, lineHeight: 1, flexShrink: 0 }}
        >🔊</motion.button>
      </div>

      {/* The word to rhyme with (Ja/Nein: both words) */}
      {r.mode !== 'odd' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'clamp(16px,5vw,44px)',
          ...pxPanel, padding: 'clamp(14px,2.5vw,22px) clamp(24px,6vw,48px)',
        }}>
          <Picture item={r.base} size="clamp(72px,15vw,110px)" />
          {r.mode === 'yesno' && <>
            <span style={{ fontFamily: 'var(--font-heading)', fontSize: 40, fontWeight: 800, color: INK }}>+</span>
            <Picture item={r.other} size="clamp(72px,15vw,110px)" />
          </>}
        </div>
      )}

      {/* Ja / Nein */}
      {r.mode === 'yesno' && (
        <div style={{ display: 'flex', gap: 'clamp(14px,4vw,32px)' }}>
          {[true, false].map(yes => {
            const right = solved && yes === r.rhymes
            const isWrong = wrong.includes(yes)
            return (
              <motion.button key={String(yes)}
                whileHover={!solved ? { scale: 1.06 } : {}} whileTap={!solved ? { scale: 0.94 } : {}}
                onClick={() => answerYesNo(yes)}
                {...hearable(yes ? 'Ja, das reimt sich.' : 'Nein, das reimt sich nicht.', { enabled: !solved })}
                aria-label={yes ? 'Ja, das reimt sich' : 'Nein, das reimt sich nicht'}
                style={{
                  ...pxCard(right ? 'right' : isWrong ? 'wrong' : undefined),
                  display: 'flex', alignItems: 'center', gap: 10, minHeight: 72,
                  padding: '12px clamp(22px,5vw,40px)', cursor: solved ? 'default' : 'pointer',
                  fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 'clamp(20px,4vw,26px)', color: INK,
                }}
              >
                <span style={{ fontSize: 40, lineHeight: 1, display: 'inline-block', transform: yes ? 'none' : 'rotate(180deg)' }}>👍</span>
                {yes ? 'Ja' : 'Nein'}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Candidates */}
      {options.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: cols * 180 + 64 }}>
          <div style={{
            flex: 1, display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            gap: 'clamp(10px,2.5vw,18px)',
          }}>
            {options.map(opt => {
              const isWrong = wrong.includes(opt)
              const isRight = solved && opt === r.correct
              const live = !solved && !isWrong
              return (
                <motion.button key={opt.w}
                  whileHover={live ? { scale: 1.05 } : {}}
                  whileTap={live ? { scale: 0.95 } : {}}
                  animate={isRight ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  onClick={() => pick(opt)}
                  {...hearable(opt.w, { enabled: !solved })}
                  aria-label={opt.w}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    ...pxCard(isRight ? 'right' : isWrong ? 'wrong' : undefined),
                    padding: 'clamp(12px,2.2vw,18px) 8px', minWidth: 0,
                    cursor: live ? 'pointer' : 'default',
                    opacity: isWrong && !solved ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: 'clamp(52px,10vw,76px)', lineHeight: 1, minHeight: '1em' }}>{opt.e}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px,2.9vw,19px)', fontWeight: 700, color: INK }}>
                    {opt.w}
                  </span>
                </motion.button>
              )
            })}
          </div>
          {/* Auf dem Tablet gibt es kein Darüberfahren — hier hört das Kind alle
              Möglichkeiten nacheinander, ohne schon zu antworten. */}
          <HearOptions items={options.map(o => o.w)} label="Alle Antworten vorlesen" size={52} />
        </div>
      )}

      <div style={{ minHeight: 60, display: 'flex', alignItems: 'center' }}>
        <AnimatePresence>
          {solved && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ delay: 0.5 }}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={weiterClick}
              {...hearable('Weiter')}
              style={{ ...NEXT_BTN, padding: '12px 40px', minHeight: 56, fontSize: 'clamp(17px,3.4vw,21px)' }}
            >Weiter! →</motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
