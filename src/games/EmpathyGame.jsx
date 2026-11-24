import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragArea, Draggable, RoundTrail, Art, HintHand, useBursts } from '../components/play/index.js'
import { leaveGame } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { shuffle } from './feelings.js'
import { Stage, FeelLumi, FaceChip, FeelingFace, AskFace, FEEL, sceneLength, useAfter, useTrayStart } from './feelingStage.jsx'
import { INK, pxButton } from './px.js'

/**
 * Gefühlsdetektiv — „Freunde trösten“
 *
 * A friend is sad, angry, scared … and what happened plays on the stage:
 * the ice cream drops, the tower tumbles, the dog barks. The child first
 * hands the friend the face that fits — read from posture and face — and
 * then drags over a way to help: a hug, a question, the light switched on.
 * The right help brings the colour back into the friend, who thanks the
 * child. Kind help that is not what is needed most is never "wrong".
 *
 * Gefühlswelt asks how Lumi feels; here it is *someone else*, read from the
 * body, and the second step asks what to actually do about it.
 *
 * Scientific basis:
 *   • Theory of mind / perspective taking (Wellman) — attributing a feeling
 *     to another person, not oneself, is the developmental step this age is
 *     working on.
 *   • Bodily emotion recognition (de Gelder) — posture carries emotion
 *     independently of facial expression, and children read it earlier and
 *     more reliably than they read subtle faces.
 *   • Prosocial response — naming a feeling is only half of empathy; the
 *     second question asks what to actually do about it.
 */

// ── Friends whose feeling you can see ──────────────────────────────────────
// The first version were stick figures without faces, then stick figures
// with faces: next to the cartoon world they looked thin and grey, and a few
// degrees of arm angle were hard to tell apart. Now the friends are drawn
// like Lumi (feelingStage.jsx), each with its own colour and ears, and carry
// the feeling in face, arms and the whole body: arms up and a big laugh,
// hanging arms and tears, fists and steam, holding itself and trembling.
const LOOKS = [
  { body: '#ff9fc4', shade: '#ee6fa2', ears: 'bunny' },
  { body: '#8fd0ff', shade: '#4fa3e8', ears: 'bear' },
  { body: '#9be38a', shade: '#5cbf52', ears: 'cat' },
  { body: '#c9a6ff', shade: '#9a6ee8', ears: 'antenna' },
  { body: '#ffbf6e', shade: '#f08c2e', ears: 'bear' },
  { body: '#8ff0d6', shade: '#3fc1a8', ears: 'bunny' },
  { body: '#ff9a8a', shade: '#e8604e', ears: 'cat' },
]

// The same words and faces as in Gefühlswelt (feelings.js)
const FEELINGS = ['Glücklich', 'Traurig', 'Wütend', 'Ängstlich', 'Einsam', 'Stolz', 'Müde']

// Never offered next to each other: they look alike and often both fit.
// "Tim hat es ganz nach oben geschafft" was graded fröhlich, and the child
// who said stolz heard the error buzz.
const NEAR = {
  'Glücklich': ['Stolz'],
  'Stolz':     ['Glücklich'],
  'Traurig':   ['Einsam', 'Müde'],
  'Einsam':    ['Traurig', 'Müde'],
  'Müde':      ['Traurig', 'Einsam'],
}

// Each scene: who, what the posture shows, what happened, and three ways to
// respond. `best` fits this feeling best; `kind` ones are friendly but not
// what is needed most (taken gladly, no point lost); the unkind ones fly
// back. The sentences are labels; `i` is the picture the child drags,
// `props` what happened (feelingStage.jsx; the friend stands at x 300),
// `then` how it looks once helped (the teddy is back, the light is on).
const t = (a, x, act, o) => ({ a, x, act, ...o })
const pal = (a, x, act, o) => ({ a, x, act, char: true, s: 90, ...o })
const SCENES = [
  { feeling: 'Traurig', name: 'Mia',
    situation: 'Mias Bild ist zerrissen. Mia weint.',
    props: [t('🖼️', 430, 'topple', { s: 90, d: 0.4 })],
    best: 'Ich setze mich zu Mia und tröste sie.', bi: ['🤗'],
    other: [
      { t: 'Ich hole schnell einen Ball zum Spielen.', i: ['⚽'], kind: true },
      { t: 'Ich sage ihr, sie soll nicht traurig sein.', i: ['🗣️', '😠'] },
    ] },
  { feeling: 'Einsam', name: 'Ben',
    situation: 'Ben sitzt allein am Rand und schaut den anderen beim Spielen zu.',
    props: [pal('🐰', 470, 'hop', { flip: true }), pal('🐻', 550, 'hop', { d: 0.3, flip: true }), t('⚽', 510, 'bob', { s: 50, y: 90 })],
    best: 'Ich frage Ben, ob er mitspielen will.', bi: ['🤝', '⚽'],
    other: [
      { t: 'Ich spiele einfach weiter.', i: ['🙈'] },
      { t: 'Ich winke Ben kurz zu.', i: ['👋'], kind: true },
    ] },
  { feeling: 'Wütend', name: 'Leo',
    situation: 'Jemand hat Leos Turm umgeworfen. Leo ballt die Fäuste.',
    props: [t('🧱', 420, 'drop', { s: 50 }), t('🧱', 470, 'drop', { s: 50, d: 0.2 }), t('🧱', 520, 'drop', { s: 50, d: 0.4 })],
    best: 'Ich warte kurz und frage dann, was passiert ist.', bi: ['⏳', '👂'],
    other: [
      { t: 'Ich baue den Turm schnell neu.', i: ['🧱'], kind: true },
      { t: 'Ich sage ihm, er soll sich nicht so anstellen.', i: ['🗣️', '😠'] },
    ] },
  { feeling: 'Ängstlich', name: 'Nele',
    situation: 'Es donnert laut, und Nele macht sich ganz klein.',
    props: [t('🌧️', 440, 'bob', { s: 110, y: 170 }), t('⚡', 470, 'bang', { s: 70, y: 100, d: 0.6 })],
    best: 'Ich bleibe bei Nele und sage, dass ich da bin.', bi: ['🤗'],
    other: [
      { t: 'Ich mache das Fenster zu.', i: ['🪟'], kind: true },
      { t: 'Ich lache, weil Gewitter doch nicht schlimm ist.', i: ['🤡'] },
    ] },
  { feeling: 'Glücklich', name: 'Tim',
    situation: 'Tim bekommt einen großen Luftballon geschenkt und hüpft vor Freude.',
    props: [t('🎈', 370, 'bob', { s: 80, y: 150 })],
    best: 'Ich freue mich mit Tim.', bi: ['🎉'],
    other: [
      { t: 'Ich will den Luftballon auch haben.', i: ['✋', '🎈'] },
      { t: 'Ich schaue kurz hin und spiele weiter.', i: ['👀', '⚽'], kind: true },
    ] },
  { feeling: 'Stolz', name: 'Ida',
    situation: 'Ida zeigt ihr fertiges Bild und stellt sich ganz gerade hin.',
    props: [t('🖼️', 410, 'pop', { s: 90, y: 40 })],
    best: 'Ich schaue mir das Bild an und sage, was mir gefällt.', bi: ['👀', '👏'],
    other: [
      { t: 'Ich male auch schnell ein Bild.', i: ['🖍️'], kind: true },
      { t: 'Ich sage, dass meins schöner ist.', i: ['🗣️', '😠'] },
    ] },
  { feeling: 'Traurig', name: 'Jonas',
    situation: 'Jonas hat sein Kuscheltier verloren. Jonas weint.',
    props: [t('🌳', 500, 'pop', { s: 150 }), t('🧸', 470, 'pop', { s: 40, y: 20, d: 1, z: 0 })],
    then: [t('🌳', 500, 'pop', { s: 150 }), t('🧸', 470, 'give', { s: 60, to: 380, d: 0.3 })],
    best: 'Ich helfe Jonas beim Suchen.', bi: ['🔍', '🧸'],
    other: [
      { t: 'Ich leihe ihm mein Kuscheltier.', i: ['🧸', '➡️'], kind: true },
      { t: 'Ich sage, dass Kuscheltiere nur für Babys sind.', i: ['🗣️', '😠'] },
    ] },
  { feeling: 'Einsam', name: 'Anna',
    situation: 'Anna ist neu im Kindergarten und kennt noch niemanden. Anna sitzt ganz allein.',
    props: [t('🏫', 480, 'pop', { s: 150 })],
    best: 'Ich sage Hallo und zeige Anna alles.', bi: ['🤝', '🏫'],
    other: [
      { t: 'Ich winke ihr von Weitem zu.', i: ['👋'], kind: true },
      { t: 'Ich warte, bis sie zu mir kommt.', i: ['⏳'], kind: true },
    ] },
  { feeling: 'Wütend', name: 'Paul',
    situation: 'Ein Kind hat Paul das Spielauto weggenommen. Paul stampft mit dem Fuß.',
    props: [t('🚗', 400, 'grab', { s: 56, to: 420, d: 0.3 }), pal('🐒', 450, 'visit', { flip: true, d: 0.3 })],
    best: 'Ich frage Paul, was los ist, und höre zu.', bi: ['👂'],
    other: [
      { t: 'Ich lache über Paul.', i: ['🤡'] },
      { t: 'Ich gebe Paul mein Auto.', i: ['🚗', '➡️'], kind: true },
    ] },
  { feeling: 'Ängstlich', name: 'Emil',
    situation: 'Ein großer Hund bellt laut. Emil hält sich ganz fest.',
    props: [pal('🐕', 470, 'shake', { s: 130, flip: true })],
    best: 'Ich nehme Emils Hand, und wir holen einen Erwachsenen.', bi: ['🤝', '👩'],
    other: [
      { t: 'Ich laufe schnell weg.', i: ['🏃', '💨'] },
      { t: 'Ich sage, dass er keine Angst haben muss.', i: ['🗣️', '💛'], kind: true },
    ] },
  { feeling: 'Glücklich', name: 'Lea',
    situation: 'Heute hat Lea Geburtstag! Lea lacht und tanzt.',
    props: [t('🎂', 430, 'pop', { s: 90 }), t('🎈', 500, 'bob', { s: 70, y: 120 })],
    best: 'Ich gratuliere Lea und freue mich mit ihr.', bi: ['🎁', '🎂'],
    other: [
      { t: 'Ich frage, ob ich auch ein Geschenk bekomme.', i: ['✋', '🎁'] },
      { t: 'Ich sage einfach Hallo.', i: ['👋'], kind: true },
    ] },
  { feeling: 'Stolz', name: 'Max',
    situation: 'Max hat zum ersten Mal die Schuhe allein zugebunden.',
    props: [t('👟', 390, 'pop', { s: 60 }), t('✨', 410, 'bob', { s: 44, y: 60, d: 0.5 })],
    best: 'Ich sage: Toll, das hast du allein geschafft!', bi: ['👏'],
    other: [
      { t: 'Ich binde meine Schuhe auch zu.', i: ['👟'], kind: true },
      { t: 'Ich sage, das ist doch ganz leicht.', i: ['🗣️', '😠'] },
    ] },
  { feeling: 'Müde', name: 'Ella',
    situation: 'Nach dem langen Ausflug gähnt Ella. Ihre Augen fallen zu.',
    props: [t('🎒', 400, 'drop', { s: 70 }), t('🌙', 470, 'bob', { s: 70, y: 190 })],
    best: 'Ich frage Ella, ob sie sich ausruhen möchte.', bi: ['🛏️'],
    other: [
      { t: 'Ich will mit Ella Fangen spielen.', i: ['⚽'], kind: true },
      { t: 'Ich rufe ganz laut ihren Namen.', i: ['🔊'] },
    ] },
  { feeling: 'Müde', name: 'Finn',
    situation: 'Finn hat heute ganz viel getobt. Jetzt gähnt Finn.',
    props: [t('⚽', 410, 'pop', { s: 60 }), t('🛝', 500, 'pop', { s: 130 })],
    best: 'Ich bringe Finn eine Decke und bin leise.', bi: ['🛏️', '🤫'],
    other: [
      { t: 'Ich mache laute Musik an.', i: ['🎸', '🔊'] },
      { t: 'Ich erzähle Finn eine lange Geschichte.', i: ['📖'], kind: true },
    ] },
  { feeling: 'Traurig', name: 'Lina',
    situation: 'Linas Eis ist auf den Boden gefallen. Lina weint.',
    props: [t('🍦', 370, 'fall', { s: 60, y: 70, d: 0.6 })],
    best: 'Ich tröste Lina.', bi: ['🤗'],
    other: [
      { t: 'Ich esse schnell mein Eis auf.', i: ['😋', '🍦'] },
      { t: 'Ich sage: Das ist doch nur ein Eis.', i: ['🗣️', '😠'] },
    ] },
  { feeling: 'Einsam', name: 'Mo',
    situation: 'Alle Kinder spielen Fangen. Mo sitzt allein auf der Treppe.',
    props: [pal('🐰', 450, 'hop', { flip: true }), pal('🐒', 540, 'hop', { d: 0.25, flip: true })],
    best: 'Ich frage Mo, ob er mit mir spielt.', bi: ['🤝', '⚽'],
    other: [
      { t: 'Ich schaue weg.', i: ['🙈'] },
      { t: 'Ich bringe Mo ein Bilderbuch.', i: ['📖'], kind: true },
    ] },
  { feeling: 'Ängstlich', name: 'Clara',
    situation: 'Im Zimmer ist es plötzlich dunkel. Clara hält sich ganz fest.', fx: 'night',
    props: [t('💡', 420, 'flicker', { s: 60, y: 200 })],
    then: [t('💡', 420, 'bang', { s: 70, y: 200 })],
    best: 'Ich mache das Licht an und bleibe bei Clara.', bi: ['💡', '🤗'],
    other: [
      { t: 'Ich erschrecke Clara zum Spaß.', i: ['👻'] },
      { t: 'Ich sage „Gute Nacht“ und gehe.', i: ['🌙', '🚪'], kind: true },
    ] },
  { feeling: 'Wütend', name: 'Sara',
    situation: 'Sara hat beim Spiel verloren. Sara stampft auf.',
    props: [t('🎲', 410, 'shake', { s: 60 }), pal('🐻', 500, 'hop', { s: 100, flip: true }), t('🏆', 500, 'pop', { s: 50, y: 110 })],
    best: 'Ich sage: Das ärgert dich. Wollen wir nochmal spielen?', bi: ['🔁', '🎲'],
    other: [
      { t: 'Ich jubele laut, weil ich gewonnen habe.', i: ['🏆', '🔊'] },
      { t: 'Ich räume das Spiel schnell weg.', i: ['🧺'], kind: true },
    ] },
  { feeling: 'Glücklich', name: 'Noah',
    situation: 'Noahs Oma ist zu Besuch gekommen. Noah strahlt.',
    props: [pal('👵', 520, 'in', { s: 118, flip: true })],
    best: 'Ich sage: Schön, dass deine Oma da ist!', bi: ['🗣️', '💛'],
    other: [
      { t: 'Ich sage, dass meine Oma netter ist.', i: ['🗣️', '😠'] },
      { t: 'Ich spiele allein weiter.', i: ['🧸'], kind: true },
    ] },
  { feeling: 'Stolz', name: 'Emma',
    situation: 'Emma hat einen hohen Turm gebaut und zeigt ihn allen.',
    props: [t('🧱', 420, 'drop', { s: 54 }), t('🧱', 420, 'drop', { s: 54, y: 44, d: 0.3 }), t('🧱', 420, 'drop', { s: 54, y: 88, d: 0.6 }), t('🧱', 420, 'drop', { s: 54, y: 132, d: 0.9 })],
    best: 'Ich sage: Wow, dein Turm ist so hoch!', bi: ['👏'],
    other: [
      { t: 'Ich puste den Turm um.', i: ['💨'] },
      { t: 'Ich baue gleich daneben.', i: ['🧱'], kind: true },
    ] },
]

// Levels 4-10 used to be the same eight scenes with four choices. Now:
// 1-3 two feelings to choose from, 4-6 three, and from 7 on four — and the
// child has to read the feeling from the figure alone, before seeing and
// hearing what happened (the "posture alone" the docstring promises).
const LEVELS = [
  { options: 2, rounds: 6 }, { options: 2, rounds: 6 }, { options: 2, rounds: 7 },
  { options: 3, rounds: 7 }, { options: 3, rounds: 8 }, { options: 3, rounds: 8 },
  { options: 4, rounds: 8, postureOnly: true }, { options: 4, rounds: 9, postureOnly: true },
  { options: 4, rounds: 10, postureOnly: true }, { options: 4, rounds: 10, postureOnly: true },
]

// Shuffled, but the same feeling never twice in a row
function pickScenes(rounds) {
  const s = shuffle(SCENES).slice(0, rounds)
  for (let i = 1; i < s.length; i++) {
    if (s[i].feeling !== s[i - 1].feeling) continue
    const j = s.findIndex((x, k) => k > i && x.feeling !== s[i - 1].feeling)
    if (j > -1) [s[i], s[j]] = [s[j], s[i]]
  }
  return s
}

// The heavy feelings start pale; help brings the colour back
const GREY = new Set(['Traurig', 'Einsam', 'Wütend', 'Ängstlich', 'Müde'])
const FRIEND_X = 300
// How each kind of help plays out once it is given: where Lumi stands
// (`dx` left of the friend), what moves between them, what bursts out.
// Lumi stands at `lx`; things fly between Lumi and the friend.
const ACTS = {
  hug:    { dx: 95, burst: 'hearts', items: lx => [t('❤️', (lx + FRIEND_X) / 2, 'bang', { s: 50, y: 170, d: 1.2 }), t('❤️', (lx + FRIEND_X) / 2 + 30, 'bang', { s: 40, y: 200, d: 1.5 })] },
  play:   { dx: 190, burst: 'stars', items: lx => [t('⚽', lx + 50, 'pass', { s: 44, to: FRIEND_X - 50, d: 1.2 })] },
  dice:   { dx: 190, burst: 'stars', items: lx => [t('🎲', lx + 50, 'pass', { s: 44, to: FRIEND_X - 50, d: 1.2 })] },
  words:  { dx: 150, burst: 'hearts', items: lx => [t('💛', lx + 40, 'give', { s: 44, y: 120, to: FRIEND_X - 20, d: 1.2 }), t('💛', lx + 40, 'give', { s: 36, y: 140, to: FRIEND_X - 10, d: 1.6 })] },
  listen: { dx: 100, burst: 'hearts', items: () => [t('🗣️', FRIEND_X - 50, 'bang', { s: 40, y: 190, d: 1.2 })] },
  clap:   { dx: 150, burst: 'stars', items: lx => [t('👏', lx + 30, 'shake', { s: 50, y: 150, d: 1.1 })] },
  light:  { dx: 150, burst: 'stars', fx: 'glow', items: () => [] },
  rest:   { dx: 160, burst: null, items: () => [t('🛏️', FRIEND_X + 20, 'drop', { s: 90, d: 1.1, z: 1 }), t('💤', FRIEND_X + 50, 'bob', { s: 40, y: 170, d: 1.6 })] },
  party:  { dx: 150, burst: 'confetti', items: lx => [t('🎉', lx + 30, 'shake', { s: 50, y: 150, d: 1.1 })] },
  walk:   { dx: 95, burst: 'hearts', items: () => [] },
  search: { dx: 150, burst: 'stars', items: () => [] },
}
const actOf = arts => ACTS[
  arts.includes('⚽') ? 'play' : arts.includes('🎲') ? 'dice' : arts.includes('💡') ? 'light'
  : arts[0] === '🤗' ? 'hug' : arts[0] === '🗣️' ? 'words' : arts.includes('👂') ? 'listen'
  : arts[0] === '👏' || arts[0] === '👀' ? 'clap' : arts[0] === '🛏️' ? 'rest'
  : arts[0] === '🎉' || arts[0] === '🎁' ? 'party' : arts[0] === '🔍' ? 'search' : 'walk']
// where the friends helped earlier stand at the back
const BACK_X = [60, 545, 120, 485, 20, 590]

// once helped, the friend is visibly glad; glad friends get gladder
const GLAD = { 'Stolz': 'proud', 'Müde': 'calm', 'Glücklich': 'excited' }

export default function EmpathyGame({ level = 1, onComplete }) {
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1]
  const [scenes] = useState(() => pickScenes(cfg.rounds).map((sc, n) => ({
    ...sc,
    look: LOOKS[n % LOOKS.length],
    feelings: shuffle([sc.feeling, ...shuffle(FEELINGS.filter(f => f !== sc.feeling && !NEAR[sc.feeling]?.includes(f)))
      .slice(0, cfg.options - 1)]),
    helps: shuffle([{ t: sc.best, i: sc.bi, best: true }, ...sc.other]),
  })))

  const [idx,      setIdx]      = useState(0)
  // watch (what happened plays) → feeling → named (the face sits) → help → done → end
  const [phase,    setPhase]    = useState('watch')
  const [tried,    setTried]    = useState([])         // faces or helps that did not fit
  const [given,    setGiven]    = useState([])         // kind helps the friend got
  const [missed,   setMissed]   = useState(false)      // this scene no longer counts as first try
  const [react,    setReact]    = useState(null)
  const [cheering, setCheering] = useState([])         // friends helped so far, waving at the back       // a short reaction: 'more' (the feeling, stronger), 'smile', 'away'
  // a ref: the round ends from a callback scheduled before the last point is counted
  const firstTry = useRef(0)
  const [after] = useAfter()
  const [later] = useAfter()
  const [bursts, burst] = useBursts()
  const trayRef = useRef(null)
  const trayStart = useTrayStart(trayRef)
  const [friendRef] = useState(() => ({ get current() { return document.querySelector('[data-empathy-stage] .pl-drop') } }))
  // the best help counts once, even from a second tap before the screen caught up
  const helpedRef = useRef(-1)
  const doneRef = useRef(false)

  const sc = scenes[idx]
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600
  const friendAt = () => document.querySelector('[data-friend]') ?? undefined

  useEffect(() => () => leaveGame(), [])

  // A new friend: what happened plays (from level 7 only the friend, alone)
  useEffect(() => {
    if (!sc) return
    setPhase('watch'); setTried([]); setGiven([]); setMissed(false); setReact(null)
    after(() => setPhase('feeling'), cfg.postureOnly ? 900 : sceneLength(sc.props), { quiet: false })
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const flash = (r, ms) => { setReact(r); later(() => setReact(null), ms, { quiet: false }) }

  // A face that does not fit flies back, and the friend shows the feeling
  // even more clearly: the tears, the fists, the yawn.
  const giveFace = (f) => {
    if (f !== sc.feeling) {
      setTried(t => [...t, f])
      setMissed(true)
      sayWrong()
      flash('more', 1800)
      return false
    }
    setTried([])
    setPhase('named')
    sayRight()
    burst(friendAt(), 'stars')
    // from level 7 the friend stood alone: now what happened plays
    after(() => setPhase('help'), cfg.postureOnly ? Math.max(1500, sceneLength(sc.props)) : 1500, { quiet: false })
    return true
  }

  // Kindness is never wrong: a kind-but-not-best way to help is taken
  // gladly and costs nothing. Only an unkind one flies back and costs the
  // scene its first-try point.
  const giveHelp = (h) => {
    if (helpedRef.current === idx) return false
    if (h.best) {
      helpedRef.current = idx
      setPhase('done')
      if (!missed) firstTry.current++
      sfx.tada()
      sayRight()
      burst(friendAt(), 'hearts', 14)
      // the help plays out (Lumi walks over, then hugs, plays, listens …)
      const kind = actOf(h.i)
      if (kind.burst) later(() => burst(friendAt(), kind.burst, 16), 1500, { quiet: false })
      after(next, 3400, { quiet: false })
      return true
    }
    setTried(t => [...t, h.t])
    if (h.kind) {
      setGiven(g => [...g, h])
      sfx.sparkle()
      flash('smile', 1300)
      return true
    }
    setMissed(true)
    sayWrong()
    flash('away', 1500)
    return false
  }

  const next = () => {
    setCheering(c => [...c, sc.look].slice(-6))
    if (idx + 1 >= scenes.length) setPhase('end')
    else setIdx(i => i + 1)
  }

  const onDrop = (d) => {
    if (d.kind === 'face' && phase === 'feeling') return giveFace(d.feeling)
    if (d.kind === 'help' && phase === 'help') return giveHelp(d.help)
    return false
  }

  if (!sc) return null
  if (phase === 'end') return <Thanks scenes={scenes} narrow={narrow} onDone={() => { if (!doneRef.current) { doneRef.current = true; onComplete(result(firstTry.current, scenes.length)) } }} />

  const helped = phase === 'done'
  const feel = helped ? GLAD[sc.feeling] ?? 'happy' : react === 'smile' ? 'calm' : FEEL[sc.feeling]
  const sat = !GREY.has(sc.feeling) || helped ? 1 : Math.min(1, 0.3 + given.length * 0.25 + (react === 'smile' ? 0.15 : 0))
  const showProps = !cfg.postureOnly || (phase !== 'watch' && phase !== 'feeling')
  const friend = {
    x: FRIEND_X, s: 150, act: 'none', z: 2,
    node: (
      <motion.div data-friend animate={react === 'away' ? { rotate: [0, -12, 12, -8, 0], x: [0, 10, -10, 0] } : react === 'smile' ? { y: [0, -18, 0] } : { rotate: 0, x: 0, y: 0 }}
        transition={{ duration: 0.7 }}
        style={{ width: 150, height: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transformOrigin: '50% 100%' }}>
        <FeelLumi feel={feel} look={sc.look} size={140} strength={helped || react === 'more' || react === 'away' ? 2 : 1} />
      </motion.div>
    ),
    say: helped ? ['💛'] : undefined,
  }
  const props = helped && sc.then ? sc.then : showProps ? sc.props : []
  // the best help: Lumi comes and does it with the friend
  const best = sc.helps.find(h => h.best)
  const doing = actOf(best.i)
  const helper = helped ? { x: FRIEND_X - doing.dx, size: 120, act: 'in', feel: 'happy', say: best.i } : undefined
  // friends helped earlier wave from the back of the meadow
  const back = cheering.map((look, n) => ({ x: BACK_X[n], y: 70, s: 60, act: 'none', z: 0,
    node: <motion.div animate={{ y: [0, -10, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: n * 0.2 }}><FeelLumi feel="happy" look={look} size={58} /></motion.div> }))
  const cast = [friend, ...props, ...(helped ? doing.items(FRIEND_X - doing.dx) : []), ...back]

  const step = phase === 'help' || phase === 'done' ? 'help' : 'feeling'
  const trayOn = phase === 'feeling' || phase === 'help'
  const tray = step === 'feeling'
    ? sc.feelings.map(f => ({ id: f, label: f, data: { kind: 'face', feeling: f }, off: tried.includes(f),
        node: <FaceChip feeling={f} size={narrow ? (sc.feelings.length > 3 ? 48 : 56) : 70} dim={tried.includes(f)} glow={phase === 'named' && f === sc.feeling} /> }))
    : sc.helps.filter(h => !given.includes(h)).map(h => ({ id: h.t, label: h.t, data: { kind: 'help', help: h }, off: tried.includes(h.t) || helped,
        node: <HelpChip arts={h.i} size={narrow ? 40 : 58} dim={(tried.includes(h.t) && !h.kind) || (helped && !h.best)} glow={helped && h.best} /> }))
  // over the friend: which face? then the face, and "what helps?"
  const bubble = phase === 'feeling' ? <AskFace />
    : phase === 'watch' || helped ? null
    : <><FeelingFace feeling={sc.feeling} size={44} />
        {/* what the friend got already (kind, but not what helps most) */}
        {given.map(h => <Art key={h.t} art={h.i[0]} size={30} />)}
        {phase === 'help' && <AskFace size={38} art="💛" />}</>

  return (
    <DragArea autoTarget="friend" disabled={!trayOn}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px clamp(10px,3vw,28px) 14px', gap: 8, minHeight: 0 }}>
        {/* kept clear of the sun in the backdrop's top right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 820, paddingRight: narrow ? 64 : 150, boxSizing: 'border-box' }}>
          <div style={{ flex: 1, minWidth: 0 }}><RoundTrail total={scenes.length} done={idx + (helped ? 1 : 0)} walker="lumi" goal="💛" size={narrow ? 34 : 42} /></div>
        </div>

        <div data-empathy-stage role="img" aria-label={sc.situation} style={{ flex: 1, width: '100%', maxWidth: 980, display: 'flex', minHeight: 0 }}>
          <Stage key={idx} playKey={idx} cast={cast} lumi={helper} fx={helped ? doing.fx ?? (sc.then ? undefined : sc.fx) : showProps ? sc.fx : undefined}
            drop={{ who: 0, id: 'friend', onDrop, label: sc.name }}
            tint={{ 0: sat }}
            bubbles={bubble ? { 0: bubble } : {}} />
        </div>

        {/* clipped: the tray sliding in must not count as content height
            for the FitBox around the game */}
        <div style={{ overflow: 'clip', overflowClipMargin: 12, paddingTop: 10, width: '100%', display: 'flex', justifyContent: 'center', minHeight: narrow ? 112 : 136 }}>
          <AnimatePresence mode="wait">
            {phase !== 'watch' && (
              <motion.div key={`${idx}-${step}`} ref={trayRef}
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{ display: 'flex', gap: narrow ? 8 : 18, justifyContent: 'center', alignItems: 'flex-end',
                  padding: '10px 14px', borderRadius: 28, background: 'rgba(255,253,247,.55)' }}>
                {tray.map(it => (
                  <Draggable key={it.id} id={it.id} data={it.data} label={it.label} disabled={it.off || !trayOn}>{it.node}</Draggable>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      <HintHand from={trayStart} to={friendRef} active={trayOn && !react} delay={idx === 0 && step === 'feeling' ? 2000 : 6000} />
      {bursts}
    </DragArea>
  )
}

// The end of the level: every friend of the round, glad again, dancing
function Thanks({ scenes, narrow, onDone }) {
  useEffect(() => { sfx.tada() }, [])
  const size = narrow ? 64 : 92
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: narrow ? 4 : 10, justifyContent: 'center', alignItems: 'flex-end', maxWidth: 760 }}>
        {scenes.map((sc, i) => (
          <motion.div key={i} initial={{ y: -260, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 13, delay: 0.15 * i }}>
            <FeelLumi feel={GLAD[sc.feeling] ?? 'happy'} look={sc.look} size={size} strength={2} />
          </motion.div>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.94 }} onClick={onDone} aria-label="Fertig"
        initial={{ scale: 0 }} animate={{ scale: [1, 1.07, 1] }} transition={{ scale: { duration: 1.2, repeat: Infinity, delay: 0.15 * scenes.length + 0.6 } }}
        style={{ ...pxButton('green'), color: INK, padding: '14px 48px', fontSize: 22, minHeight: 64 }}>Fertig! 💛</motion.button>
    </div>
  )
}

// A way to help as pictures: what you do, and with what or how (🗣️💛 kind
// words, 🗣️😠 mean words, ✋🎈 wanting it, 🤝⚽ playing together). The same
// pictures mean the same thing in every scene.
function HelpChip({ arts, size, dim, glow }) {
  return (
    <motion.div animate={glow ? { scale: 1.1 } : { scale: 1 }}
      style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '8px 10px', borderRadius: 999, background: '#fffdf7', border: '3px solid #2a1b3d',
        boxShadow: glow ? '0 0 0 5px #ffc93c, 0 5px 0 rgba(42,27,61,.3)' : '0 5px 0 rgba(42,27,61,.3)', opacity: dim ? 0.35 : 1, transition: 'opacity .3s',
        minHeight: size + 16, minWidth: size + 16, justifyContent: 'center', boxSizing: 'border-box' }}>
      {arts.map((a, i) => <Art key={i} art={a} size={arts.length > 1 ? size * 0.85 : size} />)}
    </motion.div>
  )
}
