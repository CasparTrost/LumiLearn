import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { FEELING_ICON, shuffle } from './feelings.js'
import { INK, pxCard, pxPanel, pxBubble, pxButton, pxSegment, ACCENT } from './px.js'

/**
 * Gefühlsdetektiv — Gefühle an der Körperhaltung erkennen und helfen
 *
 * Gefühlswelt shows one emoji face plus a sentence that names the situation,
 * so the answer can be read off the face or guessed from the text. Two things
 * are missing there and are the whole point here: reading a feeling from
 * posture alone, and reading it in *someone else* rather than in Lumi.
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

// ── Ein Kind, dessen Gefühl man wirklich ansieht ────────────────────────────
// Die erste Fassung waren reine Strichmännchen ohne Gesicht — bewusst, damit
// das Gefühl allein aus der Haltung gelesen werden muss. In der Praxis sahen
// alle sechs gleich aus: bei dieser Strichstärke sind ein paar Grad Armwinkel
// nicht zu unterscheiden, und ein Fünfjähriges hat damit keine Chance.
// Jetzt tragen Haltung UND Gesicht dasselbe Gefühl, dazu ein Merkmal, das nur
// zu diesem einen passt (Träne, Dampf, Sterne). Die Haltung bleibt der
// Hauptträger — sie ist aus der Entfernung zuerst zu sehen —, aber sie ist
// nicht mehr der einzige.

const SKIN = '#FFD9B8'
const LINE = '#4A3A6B'

function Brows({ d }) {
  return <path d={d} fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round" />
}

function Eyes({ kind }) {
  if (kind === 'arc')    // zusammengekniffen vor Freude
    return <g fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round">
      <path d="M46 38 Q51 32 56 38" /><path d="M64 38 Q69 32 74 38" /></g>
  if (kind === 'wide')   // aufgerissen
    return <g><circle cx="51" cy="38" r="6.5" fill="white" stroke={LINE} strokeWidth="2" />
      <circle cx="69" cy="38" r="6.5" fill="white" stroke={LINE} strokeWidth="2" />
      <circle cx="51" cy="39" r="3.4" fill={LINE} /><circle cx="69" cy="39" r="3.4" fill={LINE} /></g>
  if (kind === 'narrow') // verengt
    return <g fill={LINE}><rect x="45" y="36" width="12" height="4.6" rx="2.3" />
      <rect x="63" y="36" width="12" height="4.6" rx="2.3" /></g>
  if (kind === 'down')   // gesenkter Blick
    return <g fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round">
      <path d="M46 38 Q51 43 56 38" /><path d="M64 38 Q69 43 74 38" /></g>
  if (kind === 'sleepy') // Lider fallen zu
    return <g fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round">
      <path d="M45 39 L57 39" /><path d="M63 39 L75 39" />
      <path d="M47 39 Q51 42 55 39" /><path d="M65 39 Q69 42 73 39" /></g>
  return <g fill={LINE}><circle cx="51" cy="38" r="3.6" /><circle cx="69" cy="38" r="3.6" /></g>
}

const SMILE = d => <path d={d} fill="none" stroke={LINE} strokeWidth="3.6" strokeLinecap="round" />

const POSES = {
  'glücklich': {
    tilt: 0, headDy: -3, eyes: 'arc', cheeks: true,
    brows: 'M45 26 Q50 21 55 25   M65 25 Q70 21 75 26',
    arms:  'M44 72 L24 44   M76 72 L96 44',        // beide Arme hoch
    hands: [[24, 44], [96, 44]],
    legs:  'M52 112 L42 142  M68 112 L78 142',
    mouth: SMILE('M48 45 Q60 59 72 45'),
    extra: <g fill="#FFD93D"><circle cx="16" cy="30" r="3.4" /><circle cx="104" cy="34" r="2.8" /></g>,
  },
  'traurig': {
    tilt: 11, headDy: 6, eyes: 'droop', tear: true,
    brows: 'M46 24 L57 30   M74 24 L63 30',        // innen hoch = traurig
    arms:  'M44 74 L33 106  M76 74 L87 106',       // hängen kraftlos herunter
    hands: [[33, 106], [87, 106]],
    legs:  'M53 112 L49 142 M67 112 L71 142',
    mouth: SMILE('M50 53 Q60 44 70 53'),
  },
  'wütend': {
    tilt: 4, headDy: 0, eyes: 'narrow', flush: true, fists: true,
    brows: 'M45 23 L59 31   M75 23 L61 31',        // innen runter = wütend
    arms:  'M44 70 L36 100  M76 70 L84 100',       // angespannt, Fäuste geballt
    hands: [[36, 100], [84, 100]],
    legs:  'M52 112 L38 140 M68 112 L82 140',      // breiter, fester Stand
    mouth: <path d="M49 52 L71 52 M53 49 L53 55 M60 49 L60 55 M67 49 L67 55"
             fill="none" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" />,   // zusammengebissen
    extra: <g fill="none" stroke="#FF6B6B" strokeWidth="3.4" strokeLinecap="round">
      <path d="M28 20 q-6 -8 0 -14" /><path d="M92 22 q7 -8 0 -15" /></g>,
  },
  'ängstlich': {
    tilt: 5, headDy: 4, eyes: 'wide', armsOverBody: true,
    brows: 'M45 21 Q51 16 57 21   M63 21 Q69 16 75 21',   // beide hochgezogen
    arms:  'M44 72 Q46 92 70 88   M76 72 Q74 92 50 88',   // umklammert sich selbst
    hands: [[70, 88], [50, 88]],
    legs:  'M56 112 L53 142 M64 112 L67 142',             // Beine eng beieinander
    mouth: <ellipse cx="60" cy="51" rx="5.4" ry="6.6" fill={LINE} />,
    extra: <g fill="none" stroke="#8e6cf0" strokeWidth="2.8" strokeLinecap="round">
      <path d="M20 56 q5 -5 10 0" /><path d="M100 58 q-5 -5 -10 0" /></g>,
  },
  'einsam': { seated: true, tilt: 5, eyes: 'down',
    brows: 'M47 24 L57 29   M73 24 L63 29' },
  'stolz': {
    tilt: -3, headDy: -5, eyes: 'arc', armsOverBody: true,
    brows: 'M46 24 Q51 20 56 24   M64 24 Q69 20 74 24',
    arms:  'M44 72 Q26 82 43 94   M76 72 Q94 82 77 94',   // Hände in die Hüften, Brust raus
    legs:  'M52 112 L44 142 M68 112 L76 142',
    mouth: SMILE('M50 46 Q60 57 70 46'),
    extra: <g fill="#FFD93D">
      <path d="M100 16 l2.6 5.4 5.4 2.6 -5.4 2.6 -2.6 5.4 -2.6 -5.4 -5.4 -2.6 5.4 -2.6 z" />
      <path d="M16 28 l1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8 z" /></g>,
  },
  'müde': {
    tilt: 9, headDy: 6, eyes: 'sleepy',
    brows: 'M46 28 L56 28   M64 28 L74 28',
    arms:  'M44 74 L37 104  M76 74 L83 104',       // schlaff
    hands: [[37, 104], [83, 104]],
    legs:  'M53 112 L50 142 M67 112 L70 142',
    mouth: <ellipse cx="60" cy="53" rx="4.4" ry="5.6" fill={LINE} />,   // gähnt
    extra: <g fill="none" stroke="#4aa3ff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M88 16 h9 l-9 10 h9" /><path d="M101 3 h6 l-6 7 h6" /></g>,
  },
  // "du": ruhig und zugewandt. Vorher stand "du" mit hochgerissenen Armen
  // neben jedem Kind — jubelnd, während das andere weint.
  'zugewandt': {
    tilt: -4, headDy: 0, eyes: 'dot',
    brows: 'M46 26 Q51 24 56 26   M64 26 Q69 24 74 26',
    arms:  'M44 72 L38 102  M76 72 L88 96',        // eine Hand ein wenig nach vorn
    hands: [[38, 102], [88, 96]],
    legs:  'M53 112 L47 142 M67 112 L73 142',
    mouth: SMILE('M52 48 Q60 53 68 48'),
  },
  // Wie es dem anderen Kind geht, wenn die Hilfe angekommen ist
  'froh': {
    tilt: 0, headDy: -2, eyes: 'arc', cheeks: true,
    brows: 'M46 25 Q51 22 56 25   M64 25 Q69 22 74 25',
    arms:  'M44 72 L36 100  M76 72 L84 100',
    hands: [[36, 100], [84, 100]],
    legs:  'M53 112 L47 142 M67 112 L73 142',
    mouth: SMILE('M49 46 Q60 56 71 46'),
  },
}

function Head({ P, dy = 0 }) {
  return (
    <g transform={`translate(0 ${dy})`}>
      <circle cx="60" cy="38" r="23" fill={SKIN} />
      <path d="M37 34 Q60 6 83 34 Q60 24 37 34" fill={LINE} opacity="0.85" />
      {P.flush  && <g fill="#FF6B6B" opacity="0.35"><circle cx="42" cy="46" r="6" /><circle cx="78" cy="46" r="6" /></g>}
      {P.cheeks && <g fill="#FF9FB0" opacity="0.5"><circle cx="43" cy="46" r="5" /><circle cx="77" cy="46" r="5" /></g>}
      <Eyes kind={P.eyes} />
      <Brows d={P.brows} />
      {P.mouth}
      {P.tear && <path d="M51 44 q-3.4 7.5 0 10 q3.4 -2.5 0 -10" fill="#74B9FF" />}
    </g>
  )
}

function Arms({ P }) {
  return (
    <g>
      <path d={P.arms} fill="none" stroke={SKIN} strokeWidth="9" strokeLinecap="round" />
      {P.hands?.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={P.fists ? 6.5 : 5.2} fill={SKIN}
          stroke={P.fists ? LINE : 'none'} strokeWidth={P.fists ? 2 : 0} />
      ))}
    </g>
  )
}

function Figure({ pose, color = '#E84393', size = 150, flip = false }) {
  const P = POSES[pose] ?? POSES['zugewandt']

  // Einsam wird sitzend gezeigt: zusammengekauert, Knie umschlungen, Blick nach
  // unten. Das ist die Haltung, die man auf jedem Spielplatz wiedererkennt —
  // und die einzige, die sich nicht aus Armen und Beinen im Stehen ergibt.
  if (P.seated) {
    return (
      <svg width={size} height={size * 1.15} viewBox="0 0 120 150"
        style={{ display: 'block', transform: flip ? 'scaleX(-1)' : 'none' }}>
        <g transform={`rotate(${P.tilt} 60 104)`}>
          {/* Unterschenkel und Füße unter den angezogenen Knien */}
          <path d="M44 120 L40 136  M76 120 L80 136" fill="none" stroke={LINE} strokeWidth="9" strokeLinecap="round" />
          {/* Oberkörper, dahinter */}
          <rect x="44" y="84" width="32" height="40" rx="13" fill={color} />
          {/* die angezogenen Knie */}
          <circle cx="44" cy="108" r="15" fill={color} />
          <circle cx="76" cy="108" r="15" fill={color} />
          {/* Arme, die die Knie umschließen — die Haltung, um die es geht */}
          <path d="M40 96 Q60 126 80 96" fill="none" stroke={SKIN} strokeWidth="9" strokeLinecap="round" />
          <circle cx="40" cy="96" r="5.2" fill={SKIN} /><circle cx="80" cy="96" r="5.2" fill={SKIN} />
          <Head P={P} dy={28} />
        </g>
      </svg>
    )
  }

  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 120 150"
      style={{ display: 'block', transform: flip ? 'scaleX(-1)' : 'none' }}>
      <g transform={`rotate(${P.tilt} 60 90)`}>
        <path d={P.legs} fill="none" stroke={LINE} strokeWidth="9" strokeLinecap="round" />
        {/* Arme liegen hinter dem Körper, damit die Schulter sauber ansetzt —
            außer da, wo das Umfassen selbst die Haltung ist. */}
        {!P.armsOverBody && <Arms P={P} />}
        <rect x="42" y="64" width="36" height="50" rx="15" fill={color} />
        {P.armsOverBody && <Arms P={P} />}
        <Head P={P} dy={P.headDy ?? 0} />
      </g>
      {P.extra}
    </svg>
  )
}

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
  'Glücklich': 'Die Arme sind hoch, und der Mund lacht.',
  'Traurig':   'Da ist eine Träne, und die Arme hängen herunter.',
  'Wütend':    'Die Hände sind zu Fäusten geballt.',
  'Ängstlich': 'Die Augen sind ganz groß, und die Arme halten sich fest.',
  'Einsam':    'Das Kind sitzt ganz allein und schaut nach unten.',
  'Stolz':     'Die Hände sind in den Hüften, und das Kind steht ganz gerade.',
  'Müde':      'Die Augen fallen zu, und das Kind gähnt.',
}

// Each scene: who, what the posture shows, what happened, and three ways to
// respond. `best` fits this feeling best; `why` says why, so the choice does
// not look arbitrary. The others carry their own answer: `kind` ones are
// friendly but not what is needed most (gentle, gold, no buzz); the unkind
// ones are named as such — "Das ist nett." after "Ich spiele einfach weiter."
// praised ignoring someone.
const SCENES = [
  { feeling: 'Traurig', name: 'Mia',
    situation: 'Mias Bild ist zerrissen. Mia weint.',
    best: 'Ich setze mich zu Mia und tröste sie.',
    why: 'Wer traurig ist, braucht zuerst Trost.',
    other: [
      { t: 'Ich hole schnell einen Ball zum Spielen.', kind: true, fb: 'Das ist lieb gemeint. Aber Mia ist gerade traurig. Was tröstet sie?' },
      { t: 'Ich sage ihr, sie soll nicht traurig sein.', fb: 'Traurig sein ist okay. Was tröstet Mia wirklich?' },
    ] },
  { feeling: 'Einsam', name: 'Ben',
    situation: 'Ben sitzt allein am Rand und schaut den anderen beim Spielen zu.',
    best: 'Ich frage Ben, ob er mitspielen will.',
    why: 'Wer allein ist, freut sich, wenn jemand fragt: Spielst du mit?',
    other: [
      { t: 'Ich spiele einfach weiter.', fb: 'Dann bleibt Ben allein. Was würde ihn freuen?' },
      { t: 'Ich winke Ben kurz zu.', kind: true, fb: 'Winken ist nett. Aber Ben sitzt dann immer noch allein. Was würde ihn freuen?' },
    ] },
  { feeling: 'Wütend', name: 'Leo',
    situation: 'Jemand hat Leos Turm umgeworfen. Leo ballt die Fäuste.',
    best: 'Ich warte kurz und frage dann, was passiert ist.',
    why: 'Wer wütend ist, braucht kurz Zeit, und dann jemanden, der zuhört. Danach könnt ihr den Turm zusammen neu bauen!',
    other: [
      { t: 'Ich baue den Turm schnell neu.', kind: true, fb: 'Das ist hilfsbereit! Aber Leo ist gerade noch wütend. Was hilft zuerst?' },
      { t: 'Ich sage ihm, er soll sich nicht so anstellen.', fb: 'Wütend sein ist okay. Was hilft Leo, damit es ihm besser geht?' },
    ] },
  { feeling: 'Ängstlich', name: 'Nele',
    situation: 'Es donnert laut, und Nele macht sich ganz klein.',
    best: 'Ich bleibe bei Nele und sage, dass ich da bin.',
    why: 'Wer Angst hat, fühlt sich sicherer, wenn jemand da ist.',
    other: [
      { t: 'Ich mache das Fenster zu.', kind: true, fb: 'Das ist eine gute Idee! Aber Nele hat immer noch Angst. Was hilft ihr am meisten?' },
      { t: 'Ich lache, weil Gewitter doch nicht schlimm ist.', fb: 'Auslachen tut weh. Was hilft Nele, wenn sie Angst hat?' },
    ] },
  { feeling: 'Glücklich', name: 'Tim',
    situation: 'Tim bekommt einen großen Luftballon geschenkt und hüpft vor Freude.',
    best: 'Ich freue mich mit Tim.',
    why: 'Freude wird noch größer, wenn man sie teilt!',
    other: [
      { t: 'Ich will den Luftballon auch haben.', fb: 'Dann ist Tims Freude schnell vorbei. Was macht Tim noch froher?' },
      { t: 'Ich schaue kurz hin und spiele weiter.', kind: true, fb: 'Das ist okay. Aber Tim möchte seine Freude teilen. Was kannst du tun?' },
    ] },
  { feeling: 'Stolz', name: 'Ida',
    situation: 'Ida zeigt ihr fertiges Bild und stellt sich ganz gerade hin.',
    best: 'Ich schaue mir das Bild an und sage, was mir gefällt.',
    why: 'Wer stolz ist, freut sich, wenn andere genau hinschauen.',
    other: [
      { t: 'Ich male auch schnell ein Bild.', kind: true, fb: 'Malen ist toll! Aber Ida möchte jetzt ihr Bild zeigen. Was freut sie?' },
      { t: 'Ich sage, dass meins schöner ist.', fb: 'Das macht Ida traurig. Was freut sie?' },
    ] },
  { feeling: 'Traurig', name: 'Jonas',
    situation: 'Jonas hat sein Kuscheltier verloren. Jonas weint.',
    best: 'Ich helfe Jonas beim Suchen.',
    why: 'Zusammen suchen tröstet. Dann ist Jonas nicht allein mit seinem Kummer.',
    other: [
      { t: 'Ich leihe ihm mein Kuscheltier.', kind: true, fb: 'Das ist sehr lieb! Aber Jonas vermisst sein eigenes Kuscheltier. Was hilft ihm noch mehr?' },
      { t: 'Ich sage, dass Kuscheltiere nur für Babys sind.', fb: 'Das tut Jonas weh. Was hilft ihm, wenn er traurig ist?' },
    ] },
  { feeling: 'Einsam', name: 'Anna',
    situation: 'Anna ist neu im Kindergarten und kennt noch niemanden. Anna sitzt ganz allein.',
    best: 'Ich sage Hallo und zeige Anna alles.',
    why: 'Wer neu ist, freut sich über jemanden, der Hallo sagt.',
    other: [
      { t: 'Ich winke ihr von Weitem zu.', kind: true, fb: 'Winken ist nett. Aber Anna kennt noch niemanden. Was hilft ihr mehr?' },
      { t: 'Ich warte, bis sie zu mir kommt.', kind: true, fb: 'Vielleicht traut sich Anna nicht. Was kannst du tun?' },
    ] },
  { feeling: 'Wütend', name: 'Paul',
    situation: 'Ein Kind hat Paul das Spielauto weggenommen. Paul stampft mit dem Fuß.',
    best: 'Ich frage Paul, was los ist, und höre zu.',
    why: 'Wer wütend ist, fühlt sich besser, wenn jemand zuhört.',
    other: [
      { t: 'Ich lache über Paul.', fb: 'Auslachen macht Paul noch wütender. Was hilft ihm?' },
      { t: 'Ich gebe Paul mein Auto.', kind: true, fb: 'Das ist lieb! Aber Paul ist noch wütend. Was hilft ihm zuerst?' },
    ] },
  { feeling: 'Ängstlich', name: 'Emil',
    situation: 'Ein großer Hund bellt laut. Emil hält sich ganz fest.',
    best: 'Ich nehme Emils Hand, und wir holen einen Erwachsenen.',
    why: 'Wer Angst hat, braucht jemanden an seiner Seite. Und bei fremden Hunden holen wir einen Erwachsenen.',
    other: [
      { t: 'Ich laufe schnell weg.', fb: 'Dann ist Emil allein mit seiner Angst. Was hilft ihm?' },
      { t: 'Ich sage, dass er keine Angst haben muss.', kind: true, fb: 'Das ist lieb gemeint. Aber Emil hat trotzdem Angst. Was hilft ihm wirklich?' },
    ] },
  { feeling: 'Glücklich', name: 'Lea',
    situation: 'Heute hat Lea Geburtstag! Lea lacht und tanzt.',
    best: 'Ich gratuliere Lea und freue mich mit ihr.',
    why: 'Wer sich freut, freut sich noch mehr, wenn andere mitfeiern.',
    other: [
      { t: 'Ich frage, ob ich auch ein Geschenk bekomme.', fb: 'Heute ist Leas Tag. Was macht Lea froh?' },
      { t: 'Ich sage einfach Hallo.', kind: true, fb: 'Hallo ist nett. Aber heute ist Leas Geburtstag! Was kannst du noch sagen?' },
    ] },
  { feeling: 'Stolz', name: 'Max',
    situation: 'Max hat zum ersten Mal die Schuhe allein zugebunden.',
    best: 'Ich sage: Toll, das hast du allein geschafft!',
    why: 'Wer stolz ist, freut sich, wenn jemand sieht, was er geschafft hat.',
    other: [
      { t: 'Ich binde meine Schuhe auch zu.', kind: true, fb: 'Gute Idee! Aber Max möchte zeigen, was er kann. Was freut ihn?' },
      { t: 'Ich sage, das ist doch ganz leicht.', fb: 'Für Max war es schwer. Das macht ihn traurig. Was freut ihn?' },
    ] },
  { feeling: 'Müde', name: 'Ella',
    situation: 'Nach dem langen Ausflug gähnt Ella. Ihre Augen fallen zu.',
    best: 'Ich frage Ella, ob sie sich ausruhen möchte.',
    why: 'Wer müde ist, braucht Ruhe.',
    other: [
      { t: 'Ich will mit Ella Fangen spielen.', kind: true, fb: 'Spielen ist toll. Aber Ella ist müde. Was braucht sie jetzt?' },
      { t: 'Ich rufe ganz laut ihren Namen.', fb: 'Das ist zu laut für Ella. Was braucht sie, wenn sie müde ist?' },
    ] },
  { feeling: 'Müde', name: 'Finn',
    situation: 'Finn hat heute ganz viel getobt. Jetzt gähnt Finn.',
    best: 'Ich bringe Finn eine Decke und bin leise.',
    why: 'Wer müde ist, freut sich, wenn es ruhig ist.',
    other: [
      { t: 'Ich mache laute Musik an.', fb: 'Laute Musik stört Finn. Was hilft ihm, wenn er müde ist?' },
      { t: 'Ich erzähle Finn eine lange Geschichte.', kind: true, fb: 'Das ist lieb. Aber Finn ist sehr müde. Was hilft ihm am meisten?' },
    ] },
  { feeling: 'Traurig', name: 'Lina',
    situation: 'Linas Eis ist auf den Boden gefallen. Lina weint.',
    best: 'Ich tröste Lina.',
    why: 'Wer traurig ist, braucht Trost. Vielleicht könnt ihr danach dein Eis teilen.',
    other: [
      { t: 'Ich esse schnell mein Eis auf.', fb: 'Dann ist Lina noch trauriger. Was tröstet sie?' },
      { t: 'Ich sage: Das ist doch nur ein Eis.', fb: 'Für Lina ist das schlimm. Was tröstet sie?' },
    ] },
  { feeling: 'Einsam', name: 'Mo',
    situation: 'Alle Kinder spielen Fangen. Mo sitzt allein auf der Treppe.',
    best: 'Ich frage Mo, ob er mit mir spielt.',
    why: 'Wer allein ist, freut sich, wenn jemand ihn zum Spielen holt.',
    other: [
      { t: 'Ich schaue weg.', fb: 'Dann bleibt Mo allein. Was würde ihn freuen?' },
      { t: 'Ich bringe Mo ein Bilderbuch.', kind: true, fb: 'Das ist nett! Aber Mo möchte gern mitspielen. Was kannst du tun?' },
    ] },
  { feeling: 'Ängstlich', name: 'Clara',
    situation: 'Im Zimmer ist es plötzlich dunkel. Clara hält sich ganz fest.',
    best: 'Ich mache das Licht an und bleibe bei Clara.',
    why: 'Wer Angst hat, fühlt sich mit Licht und jemandem in der Nähe sicherer.',
    other: [
      { t: 'Ich erschrecke Clara zum Spaß.', fb: 'Das macht Clara noch mehr Angst. Was hilft ihr?' },
      { t: 'Ich sage „Gute Nacht“ und gehe.', kind: true, fb: 'Das ist freundlich. Aber Clara hat Angst. Was hilft ihr?' },
    ] },
  { feeling: 'Wütend', name: 'Sara',
    situation: 'Sara hat beim Spiel verloren. Sara stampft auf.',
    best: 'Ich sage: Das ärgert dich. Wollen wir nochmal spielen?',
    why: 'Wer wütend ist, fühlt sich verstanden, wenn jemand sagt, was los ist.',
    other: [
      { t: 'Ich jubele laut, weil ich gewonnen habe.', fb: 'Das macht Sara noch wütender. Was hilft ihr?' },
      { t: 'Ich räume das Spiel schnell weg.', kind: true, fb: 'Aufräumen ist nett. Aber Sara ist noch wütend. Was hilft ihr?' },
    ] },
  { feeling: 'Glücklich', name: 'Noah',
    situation: 'Noahs Oma ist zu Besuch gekommen. Noah strahlt.',
    best: 'Ich sage: Schön, dass deine Oma da ist!',
    why: 'Wer sich freut, freut sich noch mehr, wenn andere sich mitfreuen.',
    other: [
      { t: 'Ich sage, dass meine Oma netter ist.', fb: 'Das macht Noahs Freude kaputt. Was freut ihn?' },
      { t: 'Ich spiele allein weiter.', kind: true, fb: 'Das ist okay. Aber Noah möchte seine Freude teilen. Was kannst du sagen?' },
    ] },
  { feeling: 'Stolz', name: 'Emma',
    situation: 'Emma hat einen hohen Turm gebaut und zeigt ihn allen.',
    best: 'Ich sage: Wow, dein Turm ist so hoch!',
    why: 'Wer stolz ist, freut sich über ein Lob.',
    other: [
      { t: 'Ich puste den Turm um.', fb: 'Dann ist Emmas Turm kaputt. Was freut sie?' },
      { t: 'Ich baue gleich daneben.', kind: true, fb: 'Gute Idee! Aber zuerst möchte Emma ihren Turm zeigen. Was freut sie?' },
    ] },
]

// Levels 4-10 used to be the same eight scenes with four choices. Now:
// 1-3 two feelings to choose from, 4-6 three, and from 7 on four — and the
// child has to read the feeling from the figure alone, before hearing what
// happened (the "posture alone" the docstring promises).
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
const GO = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }
const DU = '#3a8ee6'
const BRIGHT_POSE = new Set(['Glücklich', 'Stolz'])

export default function EmpathyGame({ level = 1, onComplete }) {
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1]
  const [scenes] = useState(() => pickScenes(cfg.rounds).map(sc => ({
    ...sc,
    feelings: shuffle([sc.feeling, ...shuffle(FEELINGS.filter(f => f !== sc.feeling && !NEAR[sc.feeling]?.includes(f)))
      .slice(0, cfg.options - 1)]),
    helps: shuffle([{ t: sc.best, best: true }, ...sc.other]),
  })))

  const [idx,      setIdx]      = useState(0)
  const [phase,    setPhase]    = useState('feeling')  // feeling → help → done
  const [tried,    setTried]    = useState([])         // options tapped this phase
  const [missed,   setMissed]   = useState(false)      // this scene no longer counts as first try
  const [firstTry, setFirstTry] = useState(0)
  const [mood,     setMood]     = useState('thinking')
  const [reading,  setReading]  = useState(null)       // the help being read out
  const [showWeiter, setShowWeiter] = useState(false)
  const waitRef = useRef(null)

  const sc = scenes[idx]
  const hideStory = cfg.postureOnly && phase === 'feeling'

  useEffect(() => () => { waitRef.current?.(); stopNarration() }, [])

  useEffect(() => {
    if (!sc) return
    setPhase('feeling'); setTried([]); setMissed(false); setMood('thinking'); setReading(null)
    lockPreviews()
    narrate([{ text: cfg.postureOnly
      ? `Schau dir ${sc.name} genau an. Wie fühlt sich ${sc.name}?`
      : `${sc.situation} Wie fühlt sich ${sc.name}?` }])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // After the right feeling the three ways to help are read out one by one,
  // each card lit while it is read — they are long sentences, and a child
  // who cannot read used to have to find the small speaker first.
  const readHelps = (intro) => {
    let i = -1
    const step = () => {
      i++
      if (i >= sc.helps.length) { setReading(null); return }
      setReading(i)
      narrate([{ text: sc.helps[i].t, gap: 300 }], { onEnd: step })
    }
    lockPreviews()
    narrate([{ text: intro }], { onEnd: step })
  }

  // A feeling guessed wrong is not "wrong" in red with a buzz: the card fades,
  // and Lumi says what to look at.
  const pickFeeling = (f) => {
    if (phase !== 'feeling' || tried.includes(f)) return
    if (f !== sc.feeling) {
      setTried(t => [...t, f])
      setMissed(true)
      setMood('encouraging')
      sfx.mismatch()
      sayWrong(`Schau noch einmal genau hin. ${CUE[sc.feeling]}`)
      return
    }
    sfx.correct()
    setMood('happy')
    setTried([])
    setPhase('help')
    readHelps(`Genau, ${sc.name} ist ${word(sc.feeling)}.${cfg.postureOnly ? ` ${sc.situation}` : ''} Was kannst du tun?`)
  }

  // Kindness is never wrong: a kind-but-not-best way to help stays gold with
  // no buzz and still counts. Only a wrong feeling or an unkind way to "help"
  // costs the scene its first-try point.
  const pickHelp = (h) => {
    if (phase !== 'help' || tried.includes(h.t)) return
    setReading(null)
    if (!h.best) {
      setTried(t => [...t, h.t])
      if (!h.kind) { setMissed(true); sfx.wrong() }
      setMood('encouraging')
      narrate([{ text: h.fb }])
      return
    }
    sfx.correct()
    setMood('excited')
    setPhase('done')
    // first try = the feeling right at once, and no unkind help on the way
    if (!missed) setFirstTry(n => n + 1)
    narrate([{ text: `Das hilft ${sc.name} wirklich! ${sc.why}` }])
    waitRef.current?.()
    waitRef.current = afterNarration(() => setShowWeiter(true), { minMs: 200, maxMs: 15000 })
  }

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= scenes.length) {
      sfx.complete()
      onComplete(result(firstTry, scenes.length))
    } else setIdx(i => i + 1)
  }

  if (!sc) return null

  const options = phase === 'feeling' ? sc.feelings : sc.helps.map(h => h.t)
  // Once helped, the other child feels better
  const childPose = phase === 'done' && !BRIGHT_POSE.has(sc.feeling) && sc.feeling !== 'Müde' ? 'froh' : word(sc.feeling)

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(10px,2vw,18px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {scenes.map((_, i) => (
          <div key={i} style={{
            flex: 1, ...pxSegment(i < idx ? 'done' : i === idx ? 'current' : 'todo'),
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={64} />
        <div style={{
          flex: 1, minWidth: 0, ...pxBubble, padding: '11px 16px',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.2vw,20px)', color: 'var(--text-primary)',
        }}>
          {hideStory ? `Schau dir ${sc.name} genau an. 🔍` : sc.situation}
        </div>
        <HearOptions items={options} label="Alle Antworten vorlesen" size={48} />
      </div>

      {/* The scene: the child in question, and you */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(20px,8vw,70px)',
        ...pxPanel,
        padding: 'clamp(12px,2.5vw,20px) clamp(18px,5vw,46px)', width: '100%', maxWidth: 560,
      }}>
        <div style={{ textAlign: 'center' }}>
          <Figure pose={childPose} color="#E84393" size={132} />
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: INK, minHeight: 24 }}>
            {phase === 'feeling' ? `${sc.name} ❓` : `${sc.name}: ${word(sc.feeling)}`}
          </div>
        </div>
        <motion.div
          animate={{ x: phase === 'done' ? -18 : 0 }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
          style={{ textAlign: 'center' }}
        >
          <Figure pose="zugewandt" color={DU} size={132} flip />
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: INK, minHeight: 24 }}>du</div>
        </motion.div>
      </div>

      <div style={{
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.4vw,21px)',
        color: ACCENT, fontWeight: 700, textAlign: 'center',
      }}>
        {phase === 'feeling' ? `Wie fühlt sich ${sc.name}?`
         : phase === 'help'  ? 'Was kannst du tun?'
         :                     '💛 Das hilft wirklich!'}
      </div>

      {/* Step 1 — the feeling, with the same faces as in Gefühlswelt */}
      {phase === 'feeling' && (
        <div style={{ display: 'flex', gap: 'clamp(8px,2vw,14px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {sc.feelings.map(f => {
            const out = tried.includes(f)
            return (
              <motion.button key={f}
                whileHover={!out ? { scale: 1.06 } : {}} whileTap={!out ? { scale: 0.94 } : {}}
                onClick={() => pickFeeling(f)}
                {...hearable(f, { enabled: !out })}
                aria-label={f}
                style={{
                  ...pxCard(),
                  padding: '8px 18px', minHeight: 56, cursor: out ? 'default' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8,
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px,3vw,19px)',
                  color: 'var(--text-primary)', opacity: out ? 0.4 : 1,
                }}
              >
                <span style={{ fontSize: 28, lineHeight: 1 }}>{FEELING_ICON[f]}</span>
                {f}
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Step 2 — the response */}
      {phase !== 'feeling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 520 }}>
          {sc.helps.map((h, i) => {
            const out     = tried.includes(h.t)
            const isBest  = phase === 'done' && h.best
            return (
              <motion.button key={h.t}
                animate={{ scale: reading === i ? 1.03 : 1 }}
                whileHover={phase === 'help' && !out ? { scale: 1.02 } : {}}
                whileTap={phase === 'help' && !out ? { scale: 0.98 } : {}}
                onClick={() => pickHelp(h)}
                {...hearable(h.t, { enabled: phase === 'help' && !out })}
                style={{
                  // a kind-but-not-best way to help stays gentle gold —
                  // being kind is never "wrong"; only an unkind one is red
                  ...pxCard(isBest ? 'right' : out ? (h.kind ? 'selected' : 'wrong') : reading === i ? 'selected' : undefined),
                  padding: '12px 16px', minHeight: 52, textAlign: 'left',
                  cursor: phase === 'help' && !out ? 'pointer' : 'default',
                  fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 'clamp(15px,3vw,18px)',
                  color: 'var(--text-primary)', opacity: out && !h.kind ? 0.6 : phase === 'done' && !isBest ? 0.6 : 1,
                }}
              >{h.t}</motion.button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showWeiter && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={weiterClick}
            {...hearable('Weiter')}
            style={{ ...GO, padding: '12px 40px', minHeight: 56, fontSize: 'clamp(17px,3.4vw,21px)' }}
          >Weiter! →</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
