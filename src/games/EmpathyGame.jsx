import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragArea, Draggable, RoundTrail, Art, useBursts } from '../components/play/index.js'
import { narrate, lockPreviews, stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { FEELING_ICON, shuffle } from './feelings.js'
import { Stage, FeelLumi, FaceChip, PicChip, FEEL, useAfter, ReplayButton } from './feelingStage.jsx'
import { INK } from './px.js'

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

// What to look at, said after a wrong guess
const CUE = {
  'Glücklich': () => 'Die Arme sind hoch, und der Mund lacht.',
  'Traurig':   () => 'Da sind Tränen, und die Arme hängen herunter.',
  'Wütend':    () => 'Die Hände sind zu Fäusten geballt, und es dampft.',
  'Ängstlich': () => 'Die Augen sind ganz groß, und die Arme halten sich fest.',
  'Einsam':    n => `${n} sitzt ganz allein und schaut nach unten.`,
  'Stolz':     n => `Die Hände sind in den Hüften, und ${n} steht ganz gerade.`,
  'Müde':      n => `Die Augen fallen zu, und ${n} gähnt.`,
}

// Each scene: who, what the posture shows, what happened, and three ways to
// respond. `best` fits this feeling best; `why` says why, so the choice does
// not look arbitrary. The others carry their own answer: `kind` ones are
// friendly but not what is needed most (gentle, no buzz, no point lost); the
// unkind ones are named as such — "Das ist nett." after "Ich spiele einfach
// weiter." praised ignoring someone. `i` is the picture the child drags,
// `props` what happened (feelingStage.jsx; the friend stands at x 300),
// `then` how it looks once helped (the teddy is back, the light is on).
const t = (a, x, act, o) => ({ a, x, act, ...o })
const pal = (a, x, act, o) => ({ a, x, act, char: true, s: 90, ...o })
const SCENES = [
  { feeling: 'Traurig', name: 'Mia',
    situation: 'Mias Bild ist zerrissen. Mia weint.',
    props: [t('🖼️', 430, 'topple', { s: 90, d: 0.4 })],
    best: 'Ich setze mich zu Mia und tröste sie.', bi: '🤗',
    why: 'Wer traurig ist, braucht zuerst Trost.',
    other: [
      { t: 'Ich hole schnell einen Ball zum Spielen.', i: '⚽', kind: true, fb: 'Das ist lieb gemeint. Aber Mia ist gerade traurig. Was tröstet sie?' },
      { t: 'Ich sage ihr, sie soll nicht traurig sein.', i: '🗣️', fb: 'Traurig sein ist okay. Was tröstet Mia wirklich?' },
    ] },
  { feeling: 'Einsam', name: 'Ben',
    situation: 'Ben sitzt allein am Rand und schaut den anderen beim Spielen zu.',
    props: [pal('🐰', 470, 'hop', { flip: true }), pal('🐻', 550, 'hop', { d: 0.3, flip: true }), t('⚽', 510, 'bob', { s: 50, y: 90 })],
    best: 'Ich frage Ben, ob er mitspielen will.', bi: '🤝',
    why: 'Wer allein ist, freut sich, wenn jemand fragt: Spielst du mit?',
    other: [
      { t: 'Ich spiele einfach weiter.', i: '🏃', fb: 'Dann bleibt Ben allein. Was würde ihn freuen?' },
      { t: 'Ich winke Ben kurz zu.', i: '👋', kind: true, fb: 'Winken ist nett. Aber Ben sitzt dann immer noch allein. Was würde ihn freuen?' },
    ] },
  { feeling: 'Wütend', name: 'Leo',
    situation: 'Jemand hat Leos Turm umgeworfen. Leo ballt die Fäuste.',
    props: [t('🧱', 420, 'drop', { s: 50 }), t('🧱', 470, 'drop', { s: 50, d: 0.2 }), t('🧱', 520, 'drop', { s: 50, d: 0.4 })],
    best: 'Ich warte kurz und frage dann, was passiert ist.', bi: '👂',
    why: 'Wer wütend ist, braucht kurz Zeit, und dann jemanden, der zuhört. Danach könnt ihr den Turm zusammen neu bauen!',
    other: [
      { t: 'Ich baue den Turm schnell neu.', i: '🧱', kind: true, fb: 'Das ist hilfsbereit! Aber Leo ist gerade noch wütend. Was hilft zuerst?' },
      { t: 'Ich sage ihm, er soll sich nicht so anstellen.', i: '🗣️', fb: 'Wütend sein ist okay. Was hilft Leo, damit es ihm besser geht?' },
    ] },
  { feeling: 'Ängstlich', name: 'Nele',
    situation: 'Es donnert laut, und Nele macht sich ganz klein.',
    props: [t('🌧️', 440, 'bob', { s: 110, y: 170 }), t('⚡', 470, 'bang', { s: 70, y: 100, d: 0.6 })],
    best: 'Ich bleibe bei Nele und sage, dass ich da bin.', bi: '🤗',
    why: 'Wer Angst hat, fühlt sich sicherer, wenn jemand da ist.',
    other: [
      { t: 'Ich mache das Fenster zu.', i: '🪟', kind: true, fb: 'Das ist eine gute Idee! Aber Nele hat immer noch Angst. Was hilft ihr am meisten?' },
      { t: 'Ich lache, weil Gewitter doch nicht schlimm ist.', i: '🤡', fb: 'Auslachen tut weh. Was hilft Nele, wenn sie Angst hat?' },
    ] },
  { feeling: 'Glücklich', name: 'Tim',
    situation: 'Tim bekommt einen großen Luftballon geschenkt und hüpft vor Freude.',
    props: [t('🎈', 370, 'bob', { s: 80, y: 150 })],
    best: 'Ich freue mich mit Tim.', bi: '🎉',
    why: 'Freude wird noch größer, wenn man sie teilt!',
    other: [
      { t: 'Ich will den Luftballon auch haben.', i: '✋', fb: 'Dann ist Tims Freude schnell vorbei. Was macht Tim noch froher?' },
      { t: 'Ich schaue kurz hin und spiele weiter.', i: '👀', kind: true, fb: 'Das ist okay. Aber Tim möchte seine Freude teilen. Was kannst du tun?' },
    ] },
  { feeling: 'Stolz', name: 'Ida',
    situation: 'Ida zeigt ihr fertiges Bild und stellt sich ganz gerade hin.',
    props: [t('🖼️', 410, 'pop', { s: 90, y: 40 })],
    best: 'Ich schaue mir das Bild an und sage, was mir gefällt.', bi: '👀',
    why: 'Wer stolz ist, freut sich, wenn andere genau hinschauen.',
    other: [
      { t: 'Ich male auch schnell ein Bild.', i: '🖍️', kind: true, fb: 'Malen ist toll! Aber Ida möchte jetzt ihr Bild zeigen. Was freut sie?' },
      { t: 'Ich sage, dass meins schöner ist.', i: '🗣️', fb: 'Das macht Ida traurig. Was freut sie?' },
    ] },
  { feeling: 'Traurig', name: 'Jonas',
    situation: 'Jonas hat sein Kuscheltier verloren. Jonas weint.',
    props: [t('🌳', 500, 'pop', { s: 150 }), t('🧸', 470, 'pop', { s: 40, y: 20, d: 1, z: 0 })],
    then: [t('🌳', 500, 'pop', { s: 150 }), t('🧸', 470, 'give', { s: 60, to: 380, d: 0.3 })],
    best: 'Ich helfe Jonas beim Suchen.', bi: '🔍',
    why: 'Zusammen suchen tröstet. Dann ist Jonas nicht allein mit seinem Kummer.',
    other: [
      { t: 'Ich leihe ihm mein Kuscheltier.', i: '🧸', kind: true, fb: 'Das ist sehr lieb! Aber Jonas vermisst sein eigenes Kuscheltier. Was hilft ihm noch mehr?' },
      { t: 'Ich sage, dass Kuscheltiere nur für Babys sind.', i: '🍼', fb: 'Das tut Jonas weh. Was hilft ihm, wenn er traurig ist?' },
    ] },
  { feeling: 'Einsam', name: 'Anna',
    situation: 'Anna ist neu im Kindergarten und kennt noch niemanden. Anna sitzt ganz allein.',
    props: [t('🏫', 480, 'pop', { s: 150 })],
    best: 'Ich sage Hallo und zeige Anna alles.', bi: '👋',
    why: 'Wer neu ist, freut sich über jemanden, der Hallo sagt.',
    other: [
      { t: 'Ich winke ihr von Weitem zu.', i: '✋', kind: true, fb: 'Winken ist nett. Aber Anna kennt noch niemanden. Was hilft ihr mehr?' },
      { t: 'Ich warte, bis sie zu mir kommt.', i: '⏳', kind: true, fb: 'Vielleicht traut sich Anna nicht. Was kannst du tun?' },
    ] },
  { feeling: 'Wütend', name: 'Paul',
    situation: 'Ein Kind hat Paul das Spielauto weggenommen. Paul stampft mit dem Fuß.',
    props: [t('🚗', 400, 'grab', { s: 56, to: 420, d: 0.3 }), pal('🐒', 450, 'visit', { flip: true, d: 0.3 })],
    best: 'Ich frage Paul, was los ist, und höre zu.', bi: '👂',
    why: 'Wer wütend ist, fühlt sich besser, wenn jemand zuhört.',
    other: [
      { t: 'Ich lache über Paul.', i: '🤡', fb: 'Auslachen macht Paul noch wütender. Was hilft ihm?' },
      { t: 'Ich gebe Paul mein Auto.', i: '🚗', kind: true, fb: 'Das ist lieb! Aber Paul ist noch wütend. Was hilft ihm zuerst?' },
    ] },
  { feeling: 'Ängstlich', name: 'Emil',
    situation: 'Ein großer Hund bellt laut. Emil hält sich ganz fest.',
    props: [pal('🐕', 470, 'shake', { s: 130, flip: true })],
    best: 'Ich nehme Emils Hand, und wir holen einen Erwachsenen.', bi: '🤝',
    why: 'Wer Angst hat, braucht jemanden an seiner Seite. Und bei fremden Hunden holen wir einen Erwachsenen.',
    other: [
      { t: 'Ich laufe schnell weg.', i: '🏃', fb: 'Dann ist Emil allein mit seiner Angst. Was hilft ihm?' },
      { t: 'Ich sage, dass er keine Angst haben muss.', i: '🗣️', kind: true, fb: 'Das ist lieb gemeint. Aber Emil hat trotzdem Angst. Was hilft ihm wirklich?' },
    ] },
  { feeling: 'Glücklich', name: 'Lea',
    situation: 'Heute hat Lea Geburtstag! Lea lacht und tanzt.',
    props: [t('🎂', 430, 'pop', { s: 90 }), t('🎈', 500, 'bob', { s: 70, y: 120 })],
    best: 'Ich gratuliere Lea und freue mich mit ihr.', bi: '🎁',
    why: 'Wer sich freut, freut sich noch mehr, wenn andere mitfeiern.',
    other: [
      { t: 'Ich frage, ob ich auch ein Geschenk bekomme.', i: '✋', fb: 'Heute ist Leas Tag. Was macht Lea froh?' },
      { t: 'Ich sage einfach Hallo.', i: '👋', kind: true, fb: 'Hallo ist nett. Aber heute ist Leas Geburtstag! Was kannst du noch sagen?' },
    ] },
  { feeling: 'Stolz', name: 'Max',
    situation: 'Max hat zum ersten Mal die Schuhe allein zugebunden.',
    props: [t('👟', 390, 'pop', { s: 60 }), t('✨', 410, 'bob', { s: 44, y: 60, d: 0.5 })],
    best: 'Ich sage: Toll, das hast du allein geschafft!', bi: '👏',
    why: 'Wer stolz ist, freut sich, wenn jemand sieht, was er geschafft hat.',
    other: [
      { t: 'Ich binde meine Schuhe auch zu.', i: '👟', kind: true, fb: 'Gute Idee! Aber Max möchte zeigen, was er kann. Was freut ihn?' },
      { t: 'Ich sage, das ist doch ganz leicht.', i: '🗣️', fb: 'Für Max war es schwer. Das macht ihn traurig. Was freut ihn?' },
    ] },
  { feeling: 'Müde', name: 'Ella',
    situation: 'Nach dem langen Ausflug gähnt Ella. Ihre Augen fallen zu.',
    props: [t('🎒', 400, 'drop', { s: 70 }), t('🌙', 470, 'bob', { s: 70, y: 190 })],
    best: 'Ich frage Ella, ob sie sich ausruhen möchte.', bi: '🛏️',
    why: 'Wer müde ist, braucht Ruhe.',
    other: [
      { t: 'Ich will mit Ella Fangen spielen.', i: '🏃', kind: true, fb: 'Spielen ist toll. Aber Ella ist müde. Was braucht sie jetzt?' },
      { t: 'Ich rufe ganz laut ihren Namen.', i: '🔊', fb: 'Das ist zu laut für Ella. Was braucht sie, wenn sie müde ist?' },
    ] },
  { feeling: 'Müde', name: 'Finn',
    situation: 'Finn hat heute ganz viel getobt. Jetzt gähnt Finn.',
    props: [t('⚽', 410, 'pop', { s: 60 }), t('🛝', 500, 'pop', { s: 130 })],
    best: 'Ich bringe Finn eine Decke und bin leise.', bi: '🛏️',
    why: 'Wer müde ist, freut sich, wenn es ruhig ist.',
    other: [
      { t: 'Ich mache laute Musik an.', i: '🎸', fb: 'Laute Musik stört Finn. Was hilft ihm, wenn er müde ist?' },
      { t: 'Ich erzähle Finn eine lange Geschichte.', i: '📖', kind: true, fb: 'Das ist lieb. Aber Finn ist sehr müde. Was hilft ihm am meisten?' },
    ] },
  { feeling: 'Traurig', name: 'Lina',
    situation: 'Linas Eis ist auf den Boden gefallen. Lina weint.',
    props: [t('🍦', 370, 'fall', { s: 60, y: 70, d: 0.6 })],
    best: 'Ich tröste Lina.', bi: '🤗',
    why: 'Wer traurig ist, braucht Trost. Vielleicht könnt ihr danach dein Eis teilen.',
    other: [
      { t: 'Ich esse schnell mein Eis auf.', i: '🍦', fb: 'Dann ist Lina noch trauriger. Was tröstet sie?' },
      { t: 'Ich sage: Das ist doch nur ein Eis.', i: '🗣️', fb: 'Für Lina ist das schlimm. Was tröstet sie?' },
    ] },
  { feeling: 'Einsam', name: 'Mo',
    situation: 'Alle Kinder spielen Fangen. Mo sitzt allein auf der Treppe.',
    props: [pal('🐰', 450, 'hop', { flip: true }), pal('🐒', 540, 'hop', { d: 0.25, flip: true })],
    best: 'Ich frage Mo, ob er mit mir spielt.', bi: '🤝',
    why: 'Wer allein ist, freut sich, wenn jemand ihn zum Spielen holt.',
    other: [
      { t: 'Ich schaue weg.', i: '🙈', fb: 'Dann bleibt Mo allein. Was würde ihn freuen?' },
      { t: 'Ich bringe Mo ein Bilderbuch.', i: '📖', kind: true, fb: 'Das ist nett! Aber Mo möchte gern mitspielen. Was kannst du tun?' },
    ] },
  { feeling: 'Ängstlich', name: 'Clara',
    situation: 'Im Zimmer ist es plötzlich dunkel. Clara hält sich ganz fest.', fx: 'night',
    props: [t('💡', 420, 'flicker', { s: 60, y: 200 })],
    then: [t('💡', 420, 'bang', { s: 70, y: 200 })],
    best: 'Ich mache das Licht an und bleibe bei Clara.', bi: '💡',
    why: 'Wer Angst hat, fühlt sich mit Licht und jemandem in der Nähe sicherer.',
    other: [
      { t: 'Ich erschrecke Clara zum Spaß.', i: '👻', fb: 'Das macht Clara noch mehr Angst. Was hilft ihr?' },
      { t: 'Ich sage „Gute Nacht“ und gehe.', i: '🌙', kind: true, fb: 'Das ist freundlich. Aber Clara hat Angst. Was hilft ihr?' },
    ] },
  { feeling: 'Wütend', name: 'Sara',
    situation: 'Sara hat beim Spiel verloren. Sara stampft auf.',
    props: [t('🎲', 410, 'shake', { s: 60 }), pal('🐻', 500, 'hop', { s: 100, flip: true }), t('🏆', 500, 'pop', { s: 50, y: 110 })],
    best: 'Ich sage: Das ärgert dich. Wollen wir nochmal spielen?', bi: '🔁',
    why: 'Wer wütend ist, fühlt sich verstanden, wenn jemand sagt, was los ist.',
    other: [
      { t: 'Ich jubele laut, weil ich gewonnen habe.', i: '🏆', fb: 'Das macht Sara noch wütender. Was hilft ihr?' },
      { t: 'Ich räume das Spiel schnell weg.', i: '🧺', kind: true, fb: 'Aufräumen ist nett. Aber Sara ist noch wütend. Was hilft ihr?' },
    ] },
  { feeling: 'Glücklich', name: 'Noah',
    situation: 'Noahs Oma ist zu Besuch gekommen. Noah strahlt.',
    props: [pal('👵', 440, 'in', { s: 130, flip: true })],
    best: 'Ich sage: Schön, dass deine Oma da ist!', bi: '💛',
    why: 'Wer sich freut, freut sich noch mehr, wenn andere sich mitfreuen.',
    other: [
      { t: 'Ich sage, dass meine Oma netter ist.', i: '🗣️', fb: 'Das macht Noahs Freude kaputt. Was freut ihn?' },
      { t: 'Ich spiele allein weiter.', i: '🧸', kind: true, fb: 'Das ist okay. Aber Noah möchte seine Freude teilen. Was kannst du sagen?' },
    ] },
  { feeling: 'Stolz', name: 'Emma',
    situation: 'Emma hat einen hohen Turm gebaut und zeigt ihn allen.',
    props: [t('🧱', 420, 'drop', { s: 54 }), t('🧱', 420, 'drop', { s: 54, y: 44, d: 0.3 }), t('🧱', 420, 'drop', { s: 54, y: 88, d: 0.6 }), t('🧱', 420, 'drop', { s: 54, y: 132, d: 0.9 })],
    best: 'Ich sage: Wow, dein Turm ist so hoch!', bi: '👏',
    why: 'Wer stolz ist, freut sich über ein Lob.',
    other: [
      { t: 'Ich puste den Turm um.', i: '💨', fb: 'Dann ist Emmas Turm kaputt. Was freut sie?' },
      { t: 'Ich baue gleich daneben.', i: '🧱', kind: true, fb: 'Gute Idee! Aber zuerst möchte Emma ihren Turm zeigen. Was freut sie?' },
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

const word = f => f.toLowerCase()
// The heavy feelings start pale; help brings the colour back
const GREY = new Set(['Traurig', 'Einsam', 'Wütend', 'Ängstlich', 'Müde'])
const FRIEND_X = 300

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
  const [phase,    setPhase]    = useState('feeling')  // feeling → help → done
  const [tried,    setTried]    = useState([])         // faces or helps that did not fit
  const [given,    setGiven]    = useState([])         // kind helps the friend got
  const [missed,   setMissed]   = useState(false)      // this scene no longer counts as first try
  // a ref: the round ends from a callback scheduled before the last point is counted
  const firstTry = useRef(0)
  const [reading,  setReading]  = useState(null)       // the help being read out
  const [shake,    setShake]    = useState(0)          // the friend turns away from an unkind "help"
  const [after] = useAfter()
  const [bursts, burst] = useBursts()

  const sc = scenes[idx]
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600

  useEffect(() => () => stopNarration(), [])

  const ask = () => narrate([{ text: cfg.postureOnly
    ? `Schau dir ${sc.name} genau an. Wie fühlt sich ${sc.name}?`
    : `${sc.situation} Wie fühlt sich ${sc.name}?` }])

  useEffect(() => {
    if (!sc) return
    setPhase('feeling'); setTried([]); setGiven([]); setMissed(false); setReading(null)
    lockPreviews()
    ask()
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // The three ways to help are read out one by one, each lit while it is
  // read — they are whole sentences, and a child who cannot read needs them.
  const readHelps = (say) => {
    let i = -1
    const step = () => {
      i++
      if (i >= sc.helps.length) { setReading(null); return }
      setReading(i)
      narrate([{ text: sc.helps[i].t, gap: 300 }], { onEnd: step })
    }
    lockPreviews()
    say(step)
  }
  const again = () => (phase === 'feeling' ? ask() : phase === 'help' ? readHelps(go => narrate([{ text: 'Was kannst du tun?' }], { onEnd: go })) : null)

  // A face guessed wrong flies back with a boing, and Lumi says what to look at.
  const giveFace = (f) => {
    if (f !== sc.feeling) {
      setTried(t => [...t, f])
      setMissed(true)
      setShake(n => n + 1)
      sayWrong(CUE[sc.feeling](sc.name))
      return false
    }
    setTried([])
    setPhase('help')
    burst(document.querySelector('[data-friend]') ?? undefined, 'stars')
    readHelps(go => sayRight(`${sc.name} ist ${word(sc.feeling)}.${cfg.postureOnly ? ` ${sc.situation}` : ''} Was kannst du tun?`, { onEnd: go }))
    return true
  }

  // Kindness is never wrong: a kind-but-not-best way to help is taken
  // gladly and costs nothing. Only an unkind one flies back and costs the
  // scene its first-try point.
  const giveHelp = (h) => {
    setReading(null)
    if (h.best) {
      setPhase('done')
      if (!missed) firstTry.current++
      sfx.tada()
      burst(document.querySelector('[data-friend]') ?? undefined, 'hearts')
      sayRight(`Das hilft ${sc.name} wirklich! ${sc.why}`)
      after(next, 900)
      return true
    }
    setTried(t => [...t, h.t])
    if (h.kind) {
      setGiven(g => [...g, h])
      sfx.sparkle()
      narrate([{ text: h.fb }])
      return true
    }
    setMissed(true)
    setShake(n => n + 1)
    sayWrong(h.fb)
    return false
  }

  const next = () => {
    if (idx + 1 >= scenes.length) onComplete(result(firstTry.current, scenes.length))
    else setIdx(i => i + 1)
  }

  const onDrop = (d) => {
    if (d.kind === 'face' && phase === 'feeling') return giveFace(d.feeling)
    if (d.kind === 'help' && phase === 'help') return giveHelp(d.help)
    return false
  }

  if (!sc) return null

  const helped = phase === 'done'
  // once helped, the friend is visibly glad; glad friends get gladder
  const feel = !helped ? FEEL[sc.feeling]
    : sc.feeling === 'Stolz' ? 'proud' : sc.feeling === 'Müde' ? 'calm' : sc.feeling === 'Glücklich' ? 'excited' : 'happy'
  const sat = !GREY.has(sc.feeling) || helped ? 1 : 0.3 + given.length * 0.25
  const showProps = !cfg.postureOnly || phase !== 'feeling'
  const friend = {
    x: FRIEND_X, s: 150, act: 'none', z: 2,
    node: (
      <motion.div key={shake} data-friend animate={shake ? { rotate: [0, -10, 10, -6, 0] } : {}} transition={{ duration: 0.6 }}
        style={{ width: 150, height: 150, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', transformOrigin: '50% 100%' }}>
        <FeelLumi feel={feel} look={sc.look} size={140} strength={helped ? 2 : 1} />
      </motion.div>
    ),
    say: helped ? 'Danke!' : undefined,
  }
  const gifts = [...given, ...(helped ? [sc.helps.find(h => h.best)] : [])]
    .map((h, n) => t(h.i, FRIEND_X - 120 - n * 60, 'pop', { s: 56 }))
  const props = helped && sc.then ? sc.then : showProps ? sc.props : []
  const cast = [friend, ...props, ...gifts]

  const tray = phase === 'feeling'
    ? sc.feelings.map(f => ({ id: f, label: f, data: { kind: 'face', feeling: f }, off: tried.includes(f),
        node: <FaceChip feeling={f} size={narrow ? (sc.feelings.length > 3 ? 48 : 56) : 70} dim={tried.includes(f)} /> }))
    : sc.helps.map((h, i) => ({ id: h.t, label: h.t, data: { kind: 'help', help: h }, off: tried.includes(h.t) || helped,
        node: <PicChip art={h.i} size={narrow ? 54 : 68} dim={(tried.includes(h.t) && !h.kind) || (helped && !h.best)} glow={reading === i || (helped && h.best)} /> }))
  const caption = phase === 'help' && reading != null ? sc.helps[reading].t
    : phase === 'feeling' && cfg.postureOnly ? `Wie fühlt sich ${sc.name}?` : sc.situation

  return (
    <DragArea autoTarget="friend" disabled={helped}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px clamp(10px,3vw,28px) 14px', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 820 }}>
          <div style={{ flex: 1, minWidth: 0 }}><RoundTrail total={scenes.length} done={idx + (helped ? 1 : 0)} walker="lumi" goal="💛" size={narrow ? 34 : 42} /></div>
          <ReplayButton onClick={again} />
        </div>

        <div style={{ flex: 1, width: '100%', maxWidth: 980, display: 'flex', minHeight: 0 }}>
          <Stage key={idx} playKey={idx} cast={cast} fx={showProps && !(helped && sc.then) ? sc.fx : undefined}
            drop={{ who: 0, id: 'friend', onDrop, label: sc.name }}
            tint={{ 0: sat }}
            bubbles={phase !== 'feeling' ? { 0: <Art art={FEELING_ICON[sc.feeling]} size={44} /> } : {}} />
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: narrow ? 14 : 16, color: INK, textAlign: 'center', margin: 0, maxWidth: 620,
          background: 'rgba(255,253,247,.7)', borderRadius: 14, padding: '4px 12px', minHeight: 24 }}>{caption}</p>

        {/* clipped: the tray sliding in must not count as content height
            for the FitBox around the game */}
        <div style={{ overflow: 'clip', overflowClipMargin: 12, paddingTop: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
          <AnimatePresence mode="wait">
            <motion.div key={`${idx}-${phase === 'done' ? 'help' : phase}`}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              style={{ display: 'flex', gap: narrow ? 8 : 18, justifyContent: 'center', alignItems: 'flex-end',
                padding: '10px 14px', borderRadius: 28, background: 'rgba(255,253,247,.55)', minHeight: narrow ? 100 : 120 }}>
              {tray.map(it => (
                <Draggable key={it.id} id={it.id} data={it.data} label={it.label} disabled={it.off}>{it.node}</Draggable>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      {bursts}
    </DragArea>
  )
}
