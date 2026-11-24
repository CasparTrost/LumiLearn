import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, afterNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { Art, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts } from '../components/play/index.js'
import { useRounds, reduceMotion, shuffle, hintDelay } from './buchstaben/useRounds.js'
import { rec, slug, wordRec, hearWord } from './buchstaben/voice.js'
import { pxButton, INK } from './px.js'

/**
 * Reim-Rallye: das Reim-Theater — hören, was sich reimt
 *
 * Auf einer kleinen Bühne steht eine Figur (die Maus). Reimkandidaten
 * schweben an Luftballons herein; das Kind zieht den richtigen auf die
 * Bühne (das Haus), und die beiden spielen eine Unsinnsszene: "Die Maus im
 * Haus!" Wer nicht passt, schaut sich kurz um und schwebt wieder davon.
 * Bei "Welches reimt sich nicht?" stehen drei auf der Bühne, und das Kind
 * tippt den an, der nicht dazugehört — ein Haken zieht ihn von der Bühne.
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

// The little scene a rhyming pair plays on the stage once it has found
// itself: nonsense, because that is what children love about rhymes. The
// word named first climbs onto the other one, and the line hangs over the
// stage as its title (recorded as reim/szene-<erstes>-<zweites>).
const SCENES = Object.fromEntries([
  ['Die Maus im Haus!', 'Maus', 'Haus'],
  ['Die Rose in der Hose!', 'Rose', 'Hose'],
  ['Die Hose in der Dose!', 'Hose', 'Dose'],
  ['Die Rose in der Dose!', 'Rose', 'Dose'],
  ['Die Katze mit der Tatze!', 'Katze', 'Tatze'],
  ['Der Hund mit dem großen Mund!', 'Hund', 'Mund'],
  ['Der Fisch auf dem Tisch!', 'Fisch', 'Tisch'],
  ['Der Ball macht Knall!', 'Ball', 'Knall'],
  ['Der Hase mit der langen Nase!', 'Hase', 'Nase'],
  ['Der Hase in der Vase!', 'Hase', 'Vase'],
  ['Die Vase auf der Nase!', 'Vase', 'Nase'],
  ['Die Kuh im Schuh!', 'Kuh', 'Schuh'],
  ['Der Igel vor dem Spiegel!', 'Igel', 'Spiegel'],
  ['Die Bohne mit der Krone!', 'Bohne', 'Krone'],
  ['Die Zitrone mit der Krone!', 'Zitrone', 'Krone'],
  ['Die Bohne auf der Zitrone!', 'Bohne', 'Zitrone'],
  ['Die Kanne auf der Tanne!', 'Kanne', 'Tanne'],
  ['Die Kanne in der Pfanne!', 'Kanne', 'Pfanne'],
  ['Die Pfanne auf der Tanne!', 'Pfanne', 'Tanne'],
  ['Die Fliege auf der Ziege!', 'Fliege', 'Ziege'],
  ['Die Trompete auf der Rakete!', 'Trompete', 'Rakete'],
  ['Die Fahne auf der Banane!', 'Fahne', 'Banane'],
  ['Das Eis auf dem Reis!', 'Eis', 'Reis'],
  ['Das Schwein auf einem Bein!', 'Schwein', 'Bein'],
  ['Das Bein auf dem Stein!', 'Bein', 'Stein'],
  ['Das Schwein auf dem Stein!', 'Schwein', 'Stein'],
  ['Der Hahn mit dem Zahn!', 'Hahn', 'Zahn'],
  ['Das Brot im Boot!', 'Brot', 'Boot'],
  ['Die Hand am Strand!', 'Hand', 'Strand'],
  ['Der Wurm auf dem Turm!', 'Wurm', 'Turm'],
  ['Der Wal mit dem Schal!', 'Wal', 'Schal'],
].map(([line, rider, seat]) => [[rider, seat].sort().join('|'), { line, rider }]))
const sceneOf = (a, b) => SCENES[[a.w, b.w].sort().join('|')]

// Little verses whose last word rhymes with an earlier one (recorded as
// reim/vers-<base>, read up to the gap; the finished line is the title of
// its scene).
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

// What a round says, once Lumi has recorded it: the words, and on the first
// round the question.
function taskOf(r, first) {
  const ask = key => first && rec(key)
  if (r.mode === 'yesno') return [wordRec(r.base.w), wordRec(r.other.w), ask('reim/reimt-sich-das')]
  if (r.mode === 'odd')   return [...r.options.map(o => wordRec(o.w)), ask('reim/welches-nicht')]
  if (r.mode === 'verse') return [rec(`reim/vers-${slug(r.base.w)}`)]
  return [wordRec(r.base.w), ask('reim/was-reimt')]
}

const BALLOONS = ['#ff6b5b', '#4aa3ff', '#ffc93c', '#5cc45a']
// how long a scene plays before the curtain closes
const SCENE_MS = 3000

export default function RhymeGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])
  const [bursts, burst] = useBursts()
  const stageRef = useRef(null)
  const balloonsRef = useRef(null)
  const answersRef = useRef(null)
  const idxRef = useRef(0)
  const [visitor, setVisitor] = useState(null)   // a wrong one, looking round on the stage
  const [play, setPlay]       = useState(null)   // { i, pair, gone }: the scene of round i

  const sayTask = useCallback(() => {
    const i = idxRef.current, r = rounds[i]
    if (r) narrate(taskOf(r, i === 0))
  }, [rounds])
  const { idx, done, leaving, finale, tried, streak, win, miss, reveal, isOver, hasTried } =
    useRounds(rounds.length, { onComplete, sayTask, outroMs: 650, finaleMs: 2200 })
  idxRef.current = idx
  const r = rounds[idx]
  const scene = play?.i === idx ? play : null

  useEffect(() => { setVisitor(null) }, [idx])
  useEffect(() => { if (finale) { sfx.giggle(); burst(stageRef.current, 'confetti', 20) } }, [finale, burst])

  // Curtain up for the pair: the one named first climbs onto the other,
  // the audience laughs — louder after three in a row.
  const perform = (a, b, gone = null, big = false) => {
    setPlay({ i: idx, pair: [a, b], gone, big })
    setTimeout(() => { sfx.slideUp(); burst(stageRef.current, 'confetti', big ? 20 : 10) }, 500)
    setTimeout(() => sfx.giggle(), 1300)
  }
  const streaky = () => !tried.length && streak + 1 >= 3
  // praise, then the scene's line once it is recorded
  const cheer = (key) => {
    sayRight()
    const line = rec(key)
    if (line) afterNarration(() => narrate([line]))
  }

  if (!r) return null

  // pick and verse: a balloon was brought onto the stage
  const bring = (opt) => {
    if (isOver() || hasTried(opt)) return false
    if (opt === r.correct) {
      win(SCENE_MS)
      perform(r.base, opt, null, streaky())
      cheer(sceneKey(r, r.base, opt))
      return true
    }
    setVisitor(opt)
    setTimeout(() => setVisitor(v => (v === opt ? null : v)), 1600)
    sayWrong()
    if (miss(opt) >= 2) {
      reveal(1700 + SCENE_MS)
      setTimeout(() => perform(r.base, r.correct), 1700)
    }
    return true
  }

  // odd one out: tap who has to leave the stage
  const shoo = (opt) => {
    if (isOver() || hasTried(opt)) return
    const [a, b] = [r.base, r.partner]
    if (opt === r.correct) {
      win(SCENE_MS + 400)
      sfx.whoosh()
      perform(a, b, opt, streaky())
      cheer(sceneKey(r, a, b))
      return
    }
    sfx.boing()
    sayWrong()
    if (miss(opt) >= 2) {
      reveal(1400 + SCENE_MS + 400)
      setTimeout(() => { sfx.whoosh(); perform(a, b, r.correct) }, 1400)
    }
  }

  // Ja / Nein: one chance, then the answer
  const answer = (yes) => {
    if (isOver()) return
    if (yes === r.rhymes) { win(r.rhymes ? SCENE_MS : 1800); sayRight() }
    else { miss(yes); reveal(r.rhymes ? SCENE_MS : 1800); sayWrong() }
    if (r.rhymes) perform(r.base, r.other, null, yes && streaky())
    else setPlay({ i: idx, pair: null })
  }

  // who stands on the stage
  const cast = r.mode === 'odd' ? r.options
    : r.mode === 'yesno' ? [r.base, r.other]
    : scene?.pair ? scene.pair : [r.base, ...(visitor ? [visitor] : [])]
  const onStage = cast.filter(c => c !== scene?.gone)
  const rider = scene?.pair && (r.mode === 'verse' ? r.base : sceneOf(...scene.pair)?.rider === scene.pair[1].w ? scene.pair[1] : scene.pair[0])
  const title = scene?.pair && (r.mode === 'verse' ? `${r.verse.line.replace(' …', '')} ${r.correct.w}!` : sceneOf(...scene.pair)?.line)
  const balloons = (r.mode === 'pick' || r.mode === 'verse') ? r.options.filter(o => !tried.includes(o) && o !== scene?.pair?.[1]) : []
  const asking = (r.mode === 'pick' || r.mode === 'verse') && !scene && !visitor
  const voiced = taskOf(r, idx === 0).some(Boolean)
  const heard = (r.options ?? []).map(o => wordRec(o.w)).filter(Boolean)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-evenly',
      padding: 'clamp(8px,2vw,20px) clamp(10px,3vw,28px)', gap: 'clamp(6px,1.2vh,12px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 640 }}>
        <RoundTrail total={rounds.length} done={idx + (done ? 1 : 0)} walker="🎈" goal="🎭" style={{ flex: 1 }} />
        {voiced && (
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={sayTask}
            aria-label="Aufgabe noch einmal anhören"
            style={{ ...pxButton('parch'), width: 52, height: 52, padding: 0, fontSize: 24, lineHeight: 1, flexShrink: 0 }}>🔊</motion.button>
        )}
        {heard.length > 0 && <HearOptions items={heard} label="Alle Antworten anhören" size={52} />}
      </div>

      <DragArea autoTarget="stage" disabled={done}>
        {/* the candidates, floating in on balloons */}
        {(r.mode === 'pick' || r.mode === 'verse') && (
          <div ref={balloonsRef} style={{ display: 'flex', justifyContent: 'center', gap: 12, width: '100%', maxWidth: 640, minHeight: 168 }}>
            <AnimatePresence initial={false}>
              {balloons.map((opt, i) => (
                <motion.div key={`${idx}-${opt.w}`}
                  initial={reduceMotion() ? { opacity: 0 } : { y: -160, opacity: 0 }}
                  animate={leaving ? { y: -200, opacity: 0, transition: { duration: 0.6, ease: 'easeIn' } } : { y: 0, opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0 } }}
                  transition={{ type: 'spring', stiffness: 90, damping: 12, delay: 0.3 + i * 0.15 }}
                  style={{ width: `calc((100% - ${(r.options.length - 1) * 12}px) / ${r.options.length})`, maxWidth: 130 }}>
                  <Draggable id={opt.w} data={opt} label={opt.w}>
                    <Balloon item={opt} color={BALLOONS[r.options.indexOf(opt) % BALLOONS.length]} i={i} />
                  </Draggable>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* the stage */}
        <DropZone id="stage" onDrop={bring} label="Bühne" slop={10}>
          {hover => (
            <div ref={stageRef} style={{
              position: 'relative', width: 'min(640px, calc(100vw - 32px))', height: 300, overflow: 'hidden',
              background: hover ? '#5b2f6b' : '#4a2457', border: `4px solid ${INK}`, borderRadius: '18px 18px 8px 8px',
              boxShadow: '0 8px 0 rgba(42,27,61,0.35)', transition: 'background .2s',
            }}>
              {/* spotlight and floor */}
              <div aria-hidden="true" style={{ position: 'absolute', left: '15%', right: '15%', top: 0, bottom: 40, background: 'radial-gradient(ellipse at 50% 100%, rgba(255,240,180,0.45), transparent 70%)' }} />
              <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48, background: 'repeating-linear-gradient(90deg, #b9753f 0 46px, #a8652f 46px 50px)', borderTop: `4px solid ${INK}` }} />

              {/* the actors, and the empty place the partner is wanted for */}
              {/* key: a new round's cast stands there at once, the old one does not walk off through it */}
              <div key={idx} style={{ position: 'absolute', left: '14%', right: '14%', bottom: 30, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
                <AnimatePresence mode="popLayout">
                  {onStage.map(c => (
                    <Actor key={`${idx}-${c.w}`} item={c} n={Math.max(2, onStage.length)}
                      tappable={r.mode === 'odd' && !done && !tried.includes(c)}
                      shy={tried.includes(c) || (scene && !scene.pair)}
                      visiting={c === visitor}
                      ride={c === rider ? (onStage.indexOf(c) === 0 ? 1 : -1) : 0}
                      onTap={() => shoo(c)} />
                  ))}
                  {asking && <Wanted key={`want-${idx}`} />}
                </AnimatePresence>
              </div>

              {/* odd one out: the hook that pulls someone off the stage */}
              {r.mode === 'odd' && <Hook key={`hook-${idx}`} pull={!!scene?.gone} />}

              {/* the scene's title */}
              <AnimatePresence>
                {title && !leaving && (
                  <motion.div key={'t' + idx} initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
                    transition={{ delay: 1.1, type: 'spring', stiffness: 260, damping: 16 }}
                    style={{
                      position: 'absolute', left: '50%', top: 40, x: '-50%', zIndex: 2, pointerEvents: 'none', width: 'max-content', maxWidth: '70%', textAlign: 'center',
                      background: '#ffc93c', border: `3px solid ${INK}`, borderRadius: 12, padding: '3px 14px',
                      fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(15px,2.6vw,20px)', color: INK,
                    }}>{title}</motion.div>
                )}
              </AnimatePresence>

              <Curtains closed={leaving} k={idx} />
              {/* the valance */}
              <svg aria-hidden="true" viewBox="0 0 640 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 34, zIndex: 4 }}>
                <path d="M0 0 H640 V22 Q620 40 600 22 Q580 40 560 22 Q540 40 520 22 Q500 40 480 22 Q460 40 440 22 Q420 40 400 22 Q380 40 360 22 Q340 40 320 22 Q300 40 280 22 Q260 40 240 22 Q220 40 200 22 Q180 40 160 22 Q140 40 120 22 Q100 40 80 22 Q60 40 40 22 Q20 40 0 22 Z" fill="#c62f45" stroke={INK} strokeWidth="3" />
                <path d="M0 18 H640" stroke="#ffc93c" strokeWidth="3" />
              </svg>
            </div>
          )}
        </DropZone>
        <HintHand from={r.mode === 'pick' || r.mode === 'verse' ? balloonsRef : null}
          to={r.mode === 'yesno' ? answersRef : stageRef} active={!done && !leaving} delay={hintDelay(idx)} />
      </DragArea>

      {/* Ja / Nein — or the audience */}
      {r.mode === 'yesno' && !done ? (
        <div ref={answersRef} style={{ display: 'flex', gap: 'clamp(14px,4vw,32px)' }}>
          {[true, false].map(yes => (
            <motion.button key={String(yes)}
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => answer(yes)}
              aria-label={yes ? 'Ja, das reimt sich' : 'Nein, das reimt sich nicht'}
              style={{ ...pxButton(yes ? 'green' : 'parch'), display: 'flex', alignItems: 'center', gap: 10, minHeight: 68, padding: '8px clamp(22px,5vw,40px)', fontSize: 'clamp(20px,4vw,26px)', color: INK }}>
              <span style={{ display: 'inline-block', transform: yes ? 'none' : 'rotate(180deg)' }}><Art art="👍" size={44} /></span>
              {yes ? 'Ja' : 'Nein'}
            </motion.button>
          ))}
        </div>
      ) : <Audience laughing={!!scene?.pair || finale} cheer={!!scene?.big || finale} />}
      {bursts}
    </div>
  )
}

// The recording of a pair's scene line, by the words in the order of the line
const sceneKey = (r, a, b) => {
  if (r.mode === 'verse') return `reim/vers-${slug(r.base.w)}-ganz`
  const sc = sceneOf(a, b)
  if (!sc) return ''
  const [first, second] = sc.rider === a.w ? [a, b] : [b, a]
  return `reim/szene-${slug(first.w)}-${slug(second.w)}`
}

/** The empty place on the stage: someone is wanted here. */
function Wanted() {
  const still = reduceMotion()
  return (
    <motion.div aria-hidden="true" layout initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
      transition={{ delay: 0.6, type: 'spring', stiffness: 260, damping: 16 }}
      style={{ width: 'min(170px, 30vw)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <motion.div animate={still ? {} : { scale: [1, 1.08, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
        style={{
          width: '74%', aspectRatio: '1', borderRadius: '50%', border: '5px dashed #ffc93c', background: 'rgba(255,201,60,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'min(70px, 12vw)', color: '#ffc93c',
        }}>?</motion.div>
      <div style={{ height: 28 }} />
    </motion.div>
  )
}

/** A cane from the wing: it wiggles while waiting, and yanks the odd one off. */
function Hook({ pull }) {
  const still = reduceMotion()
  return (
    <motion.svg aria-hidden="true" viewBox="0 0 200 60" width="220" height="66"
      initial={{ x: -220 }}
      animate={still ? { x: -90 } : pull ? { x: [-90, 60, -260], transition: { duration: 0.9, times: [0, 0.35, 1] } }
        : { x: [-100, -80, -100], transition: { duration: 1.6, repeat: Infinity, delay: 0.8 } }}
      style={{ position: 'absolute', left: 0, bottom: 150, zIndex: 2, pointerEvents: 'none' }}>
      <path d="M0 40 H160 a20 20 0 1 0 -20 -20" stroke={INK} strokeWidth="14" fill="none" strokeLinecap="round" />
      <path d="M0 40 H160 a20 20 0 1 0 -20 -20" stroke="#c98a52" strokeWidth="8" fill="none" strokeLinecap="round" />
    </motion.svg>
  )
}

/** A candidate hanging from a balloon; it bobs while it waits. */
function Balloon({ item, color, i }) {
  const still = reduceMotion()
  return (
    <motion.div animate={still ? {} : { y: [0, -8, 0], rotate: [0, i % 2 ? 2 : -2, 0] }} transition={{ duration: 2.4 + i * 0.3, repeat: Infinity }}
      {...hearWord(item.w)}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg viewBox="0 0 54 82" width="46" height="70" aria-hidden="true" style={{ overflow: 'visible' }}>
        <path d="M27 60 q-5 10 2 22" stroke={INK} strokeWidth="2" fill="none" />
        <ellipse cx="27" cy="30" rx="24" ry="29" fill={color} stroke={INK} strokeWidth="3" />
        <path d="M23 59 h8 l-4 -5z" fill={color} stroke={INK} strokeWidth="2" />
        <ellipse cx="18" cy="18" rx="6" ry="9" fill="#fff" opacity="0.55" />
      </svg>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', padding: '6px 4px 4px', marginTop: -2,
        background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 14, boxShadow: '0 4px 0 rgba(42,27,61,0.25)', boxSizing: 'border-box',
      }}>
        <Art art={item.e} size={62} />
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(13px,2.4vw,16px)', color: INK }}>{item.w}</span>
      </div>
    </motion.div>
  )
}

/**
 * Someone on the stage. `ride` (1 or -1): climbs onto the neighbour on that
 * side for the scene. `visiting`: a wrong one, here for a moment, then it
 * floats off. `tappable`: odd-one-out rounds; the odd one is yanked off by
 * a hook when it leaves.
 */
function Actor({ item, n, ride, visiting, shy, tappable, onTap }) {
  const still = reduceMotion()
  const anim = still ? {}
    : ride ? { x: ['0%', `${ride * 50}%`, `${ride * 88}%`], y: ['0%', '-62%', '-44%'], rotate: [0, ride * 20, 0, -6, 6, 0], transition: { duration: 1.4, ease: 'easeOut' } }
    : visiting ? { y: [0, -10, 0], rotate: [0, -8, 8, 0], transition: { duration: 0.9 } }
    : shy ? { rotate: [0, -10, 10, -6, 0], scale: 0.92, transition: { duration: 0.7 } }
    : { y: [0, -6, 0], transition: { duration: 2.2, repeat: Infinity } }
  const size = n >= 3 ? 'min(150px, 26vw)' : 'min(170px, 30vw)'
  return (
    <motion.button type="button" layout aria-label={item.w} disabled={!tappable}
      onClick={tappable ? onTap : undefined}
      {...hearWord(item.w, tappable)}
      initial={visiting ? { y: -220, opacity: 0 } : { scale: 0.6, opacity: 0 }}
      animate={{ y: 0, scale: 1, opacity: 1 }}
      exit={visiting ? { y: -320, opacity: 0, transition: { duration: 0.8, ease: 'easeIn' } } : { x: -700, rotate: -30, transition: { duration: 0.6, ease: 'easeIn' } }}
      transition={{ type: 'spring', stiffness: 200, damping: 16 }}
      style={{ all: 'unset', position: 'relative', width: size, zIndex: ride ? 2 : 1, cursor: tappable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <motion.div animate={anim} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', transformOrigin: '50% 100%' }}>
        {visiting && (
          <svg viewBox="0 0 54 70" width="40" height="52" aria-hidden="true">
            <path d="M27 60 v10" stroke={INK} strokeWidth="2" />
            <ellipse cx="27" cy="30" rx="24" ry="29" fill="#b98cff" stroke={INK} strokeWidth="3" />
          </svg>
        )}
        <Art art={item.e} size={140} style={{ width: '82%', height: 'auto', opacity: shy ? 0.75 : 1 }} />
        <span style={{
          marginTop: 2, padding: '1px 10px', borderRadius: 10, background: 'rgba(255,253,247,0.92)', border: `2px solid ${INK}`,
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(14px,2.6vw,18px)', color: INK,
          visibility: ride ? 'hidden' : 'visible',
        }}>{item.w}</span>
      </motion.div>
    </motion.button>
  )
}

/** Red curtains: they open when a round starts and close at its end. */
function Curtains({ closed, k }) {
  const still = reduceMotion()
  return [-1, 1].map(side => (
    <motion.div key={`${k}${side}`} aria-hidden="true"
      initial={still ? false : { width: '51%' }} animate={{ width: closed ? '51%' : '13%' }}
      transition={{ duration: 0.55, ease: 'easeInOut', delay: closed ? 0 : 0.15 }}
      style={{
        position: 'absolute', top: 0, bottom: 0, [side < 0 ? 'left' : 'right']: 0, zIndex: 3,
        background: 'repeating-linear-gradient(90deg, #c62f45 0 18px, #a8233a 18px 30px)',
        borderRight: side < 0 ? `3px solid ${INK}` : undefined, borderLeft: side > 0 ? `3px solid ${INK}` : undefined,
        borderRadius: side < 0 ? '0 0 40% 0' : '0 0 0 40%',
      }} />
  ))
}

/** The audience: dark heads in a row; they laugh when the scene is played. */
function Audience({ laughing, cheer }) {
  const still = reduceMotion()
  return (
    <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(4px,2vw,18px)', marginTop: -6, height: 70 }}>
      {['🐻', '🐰', '🐱', '🐸', '🦊', '🐶'].map((a, i) => (
        <motion.div key={a} animate={laughing && !still ? { y: cheer ? [0, -30, 0, -24, 0] : [0, -16, 0, -10, 0], rotate: [0, -6, 6, 0] } : { y: 0 }}
          transition={{ duration: 0.9, delay: 0.9 + i * 0.07, repeat: laughing ? (cheer ? 2 : 1) : 0 }}
          style={{ position: 'relative', filter: 'brightness(0.18) saturate(0)' }}>
          <Art art={a} size={58} style={{ width: 'min(58px, 12vw)', height: 'auto' }} />
        </motion.div>
      ))}
    </div>
  )
}
