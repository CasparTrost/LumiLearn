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
// word and appears once, and only pictures a child names one way: no paw
// (Tatze or Pfote?), no bang (Knall or Bumm?), no beans (Bohne or Bohnen?).
// `v` is the rhyming vowel: groups with the same one sound alike (Banane –
// Kanne differ only in vowel length) and are kept apart until the last
// levels. `rime` is the part that rhymes, coloured in the name label so a
// grown-up playing along sees it (Ma-us, H-aus).
// The rhyming end of a word: what all words of its group end with, reaching
// back over the vowel (and a silent h) — Boot/Brot → "oot"/"ot", Fahne → "ahne".
function rimeOf(w, group) {
  const low = group.map(x => x.toLowerCase())
  let n = 0
  while (low.every(x => x.length > n && x[x.length - 1 - n] === low[0][low[0].length - 1 - n])) n++
  const vowel = c => 'aeiouäöüy'.includes(c)
  let i = w.length - n
  const lw = w.toLowerCase()
  while (i > 0 && (vowel(lw[i - 1]) || (lw[i - 1] === 'h' && i > 1 && vowel(lw[i - 2])))) i--
  return w.slice(i)
}

const RHYME_GROUPS = [
  { v:'au', words:[['Maus','🐭'], ['Haus','🏠']] },
  { v:'o',  words:[['Hose','👖'], ['Rose','🌹'], ['Dose','🥫']] },
  { v:'u',  words:[['Hund','🐕'], ['Mund','👄']] },
  { v:'i',  words:[['Fisch','🐟'], ['Tisch',':px-tisch:']] },
  { v:'a',  words:[['Nase','👃'], ['Hase','🐰'], ['Vase','🏺']] },
  { v:'u',  words:[['Kuh','🐄'], ['Schuh','👟']] },
  { v:'i',  words:[['Igel','🦔'], ['Spiegel','🪞']] },
  { v:'o',  words:[['Krone','👑'], ['Zitrone','🍋']] },
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
].map(g => ({ ...g, words: g.words.map(([w, e]) => ({ w, e, rime: rimeOf(w, g.words.map(x => x[0])) })) }))

// The little scene a rhyming pair plays on the stage once it has found
// itself: nonsense, because that is what children love about rhymes. The
// word named first climbs onto the other one, and the line hangs over the
// stage as its title (recorded as reim/szene-<erstes>-<zweites>).
const SCENES = Object.fromEntries([
  ['Die Maus im Haus!', 'Maus', 'Haus'],
  ['Die Rose in der Hose!', 'Rose', 'Hose'],
  ['Die Hose in der Dose!', 'Hose', 'Dose'],
  ['Die Rose in der Dose!', 'Rose', 'Dose'],
  ['Der Hund mit dem großen Mund!', 'Hund', 'Mund'],
  ['Der Fisch auf dem Tisch!', 'Fisch', 'Tisch'],
  ['Der Hase mit der langen Nase!', 'Hase', 'Nase'],
  ['Der Hase in der Vase!', 'Hase', 'Vase'],
  ['Die Vase auf der Nase!', 'Vase', 'Nase'],
  ['Die Kuh im Schuh!', 'Kuh', 'Schuh'],
  ['Der Igel vor dem Spiegel!', 'Igel', 'Spiegel'],
  ['Die Zitrone mit der Krone!', 'Zitrone', 'Krone'],
  ['Die Krone auf der Zitrone!', 'Krone', 'Zitrone'],
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
const SCENE_MS = 3600

export default function RhymeGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])
  const [bursts, burst] = useBursts()
  const stageRef = useRef(null)
  const gapRef = useRef(null)
  const answersRef = useRef(null)
  const idxRef = useRef(0)
  const [visitor, setVisitor] = useState(null)   // a wrong one, looking round on the stage
  const [play, setPlay]       = useState(null)   // { i, pair, gone }: the scene of round i

  const sayTask = useCallback(() => {
    const i = idxRef.current, r = rounds[i]
    if (r) narrate(taskOf(r, i === 0))
  }, [rounds])
  const { idx, done, leaving, finale, tried, streak, paused, win, miss, reveal, isOver, hasTried } =
    useRounds(rounds.length, { onComplete, sayTask, outroMs: 650, finaleMs: 2200 })
  idxRef.current = idx
  const r = rounds[idx]
  const scene = play?.i === idx ? play : null

  useEffect(() => { setVisitor(null) }, [idx])

  // The first odd-one-out round starts with a demo: a cardboard figure
  // stands on the stage, and the hook yanks it off — that is what happens
  // to the one that does not rhyme.
  const [demoStep, setDemoStep] = useState(0)   // 0 stands, 1 yanked, 2 over
  const demo = rounds[0]?.mode === 'odd' && idx === 0 && demoStep < 2
  useEffect(() => {
    if (!demo || paused) return
    const t = setTimeout(() => { if (demoStep === 0) sfx.whoosh(); setDemoStep(d => d + 1) }, demoStep === 0 ? 1300 : 900)
    return () => clearTimeout(t)
  }, [demo, demoStep, paused])
  useEffect(() => { if (finale) { sfx.giggle(); burst(stageRef.current, 'confetti', 20) } }, [finale, burst])

  // Curtain up for the pair: the one named first climbs onto the other and
  // bounces three times, the other one squashes under it, and the audience
  // laughs — louder with every scene, and after three in a row.
  const [scenes, setScenes] = useState(0)   // scenes played this level: the laugh grows
  const [lit, setLit] = useState(0)         // audience members won for good (one per right answer)
  const perform = (a, b, gone = null, big = false) => {
    setPlay({ i: idx, pair: [a, b], gone, big })
    setScenes(n => n + 1)
    setTimeout(() => { sfx.slideUp(); burst(stageRef.current, 'confetti', big ? 20 : 10) }, 500)
    ;[1500, 1950, 2400].forEach(ms => setTimeout(() => sfx.boing(), ms))
    setTimeout(() => sfx.giggle(), 2600)
  }
  const won = ms => { win(ms); setLit(n => n + 1) }
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
      won(SCENE_MS)
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
      won(SCENE_MS + 400)
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
    if (yes === r.rhymes) { won(r.rhymes ? SCENE_MS : 1800); sayRight() }
    else { miss(yes); reveal(r.rhymes ? SCENE_MS : 1800); sayWrong() }
    if (r.rhymes) perform(r.base, r.other, null, yes && streaky())
    else setPlay({ i: idx, pair: null })
  }

  // who stands on the stage
  const cast = r.mode === 'odd' ? r.options
    : r.mode === 'yesno' ? [r.base, r.other]
    : scene?.pair ? scene.pair : [r.base, ...(visitor ? [visitor] : [])]
  const onStage = demo ? [] : cast.filter(c => c !== scene?.gone)
  const rider = scene?.pair && (r.mode === 'verse' ? r.base : sceneOf(...scene.pair)?.rider === scene.pair[1].w ? scene.pair[1] : scene.pair[0])
  const title = scene?.pair && r.mode !== 'verse' && sceneOf(...scene.pair)?.line
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
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, width: '100%', maxWidth: 640, minHeight: 168 }}>
            <AnimatePresence initial={false}>
              {balloons.map((opt, i) => (
                <motion.div key={`${idx}-${opt.w}`}
                  initial={reduceMotion() ? { opacity: 0 } : { y: -160, opacity: 0 }}
                  animate={leaving ? { y: -200, opacity: 0, transition: { duration: 0.6, ease: 'easeIn' } } : { y: 0, opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0 } }}
                  transition={{ type: 'spring', stiffness: 90, damping: 12, delay: 0.3 + i * 0.15 }}
                  style={{ position: 'relative', width: `calc((100% - ${(r.options.length - 1) * 12}px) / ${r.options.length})`, maxWidth: 130 }}>
                  {/* between the first and the second: the hint hand points here, never at one answer */}
                  {i === 0 && <span ref={gapRef} aria-hidden="true" style={{ position:'absolute', right: -8, top: '60%', width: 2, height: 2 }} />}
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
                      rime={((r.mode === 'pick' || r.mode === 'verse') && c === r.base) || (done && !!scene?.pair?.includes(c))}
                      shy={tried.includes(c) || (scene && !scene.pair)}
                      visiting={c === visitor}
                      ride={c === rider ? (onStage.indexOf(c) === 0 ? 1 : -1) : 0}
                      seat={!!rider && c !== rider && !!scene?.pair?.includes(c)}
                      onTap={() => shoo(c)} />
                  ))}
                  {asking && <Wanted key={`want-${idx}`} />}
                  {demo && demoStep === 0 && <Decoy key="decoy" />}
                </AnimatePresence>
              </div>

              {/* odd one out: the hook that pulls someone off the stage */}
              {r.mode === 'odd' && <Hook key={`hook-${idx}-${!!scene?.gone || demoStep === 1}`} pull={!!scene?.gone || demoStep === 1} />}

              {/* verse levels: the verse as a card, its gap filled by the answer */}
              {r.mode === 'verse' && <VerseCard verse={r.verse} base={r.base} answer={scene?.pair ? r.correct : null} />}

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
        <HintHand from={r.mode === 'pick' || r.mode === 'verse' ? gapRef : null}
          to={r.mode === 'yesno' ? answersRef : stageRef} active={!done && !leaving && !demo} delay={hintDelay(idx)} />
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
      ) : <Audience laughing={!!scene?.pair || finale} cheer={!!scene?.big || finale} lit={finale ? AUDIENCE.length : lit} loud={scenes} />}
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
    <motion.svg aria-hidden="true" viewBox="0 0 260 90" width="220" height="76"
      initial={{ x: pull ? -90 : -230 }}
      animate={still ? { x: -90 } : pull ? { x: [-90, 70, -260], transition: { duration: 1, times: [0, 0.35, 1] } }
        : { x: [-105, -75, -105], transition: { duration: 1.4, repeat: Infinity, delay: 0.7 } }}
      style={{ position: 'absolute', left: 0, bottom: 192, zIndex: 2, pointerEvents: 'none' }}>
      <path d="M0 64 H196 a32 32 0 1 0 -32 -32" stroke={INK} strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d="M0 64 H196 a32 32 0 1 0 -32 -32" stroke="#c98a52" strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M10 60 H190" stroke="#e0a970" strokeWidth="4" strokeLinecap="round" />
    </motion.svg>
  )
}

/** The cardboard figure of the demo: it stands, wobbles, and is yanked off. */
function Decoy() {
  return (
    <motion.div aria-hidden="true" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1, rotate: [0, -4, 4, 0] }}
      exit={{ x: -700, rotate: -40, transition: { duration: 0.6, ease: 'easeIn', delay: 0.25 } }}
      transition={{ type: 'spring', stiffness: 200, damping: 16, rotate: { duration: 1, repeat: Infinity } }}
      style={{ width: 'min(150px, 26vw)', display: 'flex', justifyContent: 'center', filter: 'sepia(1) saturate(0.6)' }}>
      <Art art="🧸" size={120} style={{ width: '80%', height: 'auto' }} />
    </motion.div>
  )
}

/** A verse level's card: the base, the verse, and the gap the answer fills. */
function VerseCard({ verse, base, answer }) {
  return (
    <div style={{
      position: 'absolute', left: '50%', top: 40, transform: 'translateX(-50%)', zIndex: 2, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 8, maxWidth: '74%', width: 'max-content',
      background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 14, padding: '4px 10px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
    }}>
      <Art art={base.e} size={36} />
      <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(14px,2.4vw,18px)', color: INK, lineHeight: 1.15 }}>
        {verse.line.replace(' …', '')}
      </span>
      <motion.span key={answer ? 'a' : 'q'} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14, delay: answer ? 1 : 0 }}
        style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 10, border: answer ? `3px solid ${INK}` : '3px dashed #d6336c',
          display: 'flex', alignItems: 'center', justifyContent: 'center', background: answer ? '#ffe28a' : 'transparent',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 28, color: '#d6336c' }}>
        {answer ? <Art art={answer.e} size={36} /> : '?'}
      </motion.span>
    </div>
  )
}

/** A name label; `rime` colours the part that rhymes (Ma-us). */
function Name({ item, rime, hidden }) {
  const cut = rime && item.rime ? item.w.length - item.rime.length : item.w.length
  return (
    <span style={{
      marginTop: 2, padding: '1px 10px', borderRadius: 10, background: 'rgba(255,253,247,0.95)', border: `2px solid ${INK}`,
      fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(16px,2.8vw,21px)', color: INK, whiteSpace: 'nowrap',
      visibility: hidden ? 'hidden' : 'visible',
    }}>{item.w.slice(0, cut)}{cut < item.w.length && <span style={{ color: '#d6336c' }}>{item.w.slice(cut)}</span>}</span>
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
        <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'clamp(16px,2.8vw,20px)', color: INK }}>{item.w}</span>
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
function Actor({ item, n, ride, seat, visiting, shy, tappable, rime, onTap }) {
  const still = reduceMotion()
  // the scene: climb on (1.4 s), then bounce three times; the seat squashes along
  const BOUNCE = [0, 0.38, 0.54, 0.62, 0.71, 0.79, 0.88, 1]
  const anim = still ? {}
    : ride ? {
      x: ['0%', `${ride * 50}%`, `${ride * 88}%`, `${ride * 88}%`, `${ride * 88}%`, `${ride * 88}%`, `${ride * 88}%`, `${ride * 88}%`],
      y: ['0%', '-62%', '-44%', '-70%', '-44%', '-70%', '-44%', '-44%'],
      rotate: [0, ride * 20, 0, -8, 0, 8, 0, 0],
      transition: { duration: 2.6, times: BOUNCE, ease: 'easeOut' },
    }
    : seat ? { scaleY: [1, 1, 1, 1, 0.8, 1, 0.8, 1, 0.8, 1], scaleX: [1, 1, 1, 1, 1.12, 1, 1.12, 1, 1.12, 1], transition: { duration: 2.6, times: [0, 0.38, 0.54, 0.6, 0.65, 0.7, 0.75, 0.8, 0.86, 1] } }
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
        <Name item={item} rime={rime} hidden={!!ride} />
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

// one seat for every round: the hall is full by the end
const AUDIENCE = ['🐻', '🐰', '🐱', '🐸', '🦊', '🐶', '🐼', '🐨']

/** The audience: dark heads in a row; when the scene plays the house
 * lights come up on them, and they laugh. Each right answer wins one of
 * them for good (`lit`): it stays in the light. */
function Audience({ laughing, cheer, lit, loud }) {
  const still = reduceMotion()
  // every scene a little louder: higher jumps, more of them shout
  const jump = Math.min(40, 14 + loud * 3) + (cheer ? 10 : 0)
  return (
    <div aria-hidden="true" style={{ display: 'flex', justifyContent: 'center', gap: 'clamp(2px,1.4vw,14px)', marginTop: -6, height: 70 }}>
      {AUDIENCE.map((a, i) => (
        <motion.div key={a + laughing} animate={laughing && !still ? { y: [0, -jump, 0, -jump * 0.7, 0], rotate: [0, -8, 8, 0] } : { y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 + i * 0.07, repeat: laughing ? (cheer || loud > 4 ? 2 : 1) : 0 }}
          style={{ position: 'relative', filter: laughing || i < lit ? 'none' : 'brightness(0.18) saturate(0)', transition: 'filter .5s' }}>
          <Art art={a} size={58} style={{ width: 'min(54px, 10.5vw)', height: 'auto' }} />
          {laughing && (i % 2 === 0 || i < loud - 2) && (
            <motion.span initial={{ opacity: 0, y: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], y: -34, scale: 1 }}
              transition={{ duration: 1.4, delay: 0.7 + i * 0.1 }}
              style={{ position: 'absolute', left: '50%', top: -6, transform: 'translateX(-50%)', fontFamily: 'var(--font-heading)', fontWeight: 700,
                fontSize: 18, color: '#d6336c', WebkitTextStroke: `1px ${INK}`, whiteSpace: 'nowrap' }}>ha ha!</motion.span>
          )}
        </motion.div>
      ))}
    </div>
  )
}
