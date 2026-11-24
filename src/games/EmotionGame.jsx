import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragArea, Draggable, RoundTrail, Art, HintHand, useBursts } from '../components/play/index.js'
import { narrate, stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { BRIGHT, shuffle } from './feelings.js'
import { Stage, FeelLumi, FaceChip, FeelingFace, PicChip, AskFace, AgainButton, FEEL, sceneLength, useAfter, useTrayStart, W } from './feelingStage.jsx'
import { INK, pxButton } from './px.js'

/**
 * Gefühlswelt — „Wie geht's dir, Lumi?“
 *
 * The situation happens in front of the child: the balloon flies away, the
 * present drops from the sky, the spider comes down on its thread. The child
 * hands Lumi the face that fits, and Lumi makes it. Every third round Lumi
 * then does something with the feeling: cuddles the teddy the child hands
 * over, or breathes in and out with three taps.
 *
 * Scientific basis:
 *   • CASEL Framework (Brackett & Rivers, 2014) — emotional literacy is foundational
 *     to academic achievement, social relationships, and mental health.
 *   • RULER Approach (Yale Center for Emotional Intelligence) — Recognizing, Understanding,
 *     Labeling, Expressing, Regulating emotions.
 *   • Theory of Mind (Baron-Cohen) — labeling emotions in others builds empathy.
 *   • Recognizing feelings from faces and situations is the core of PATHS
 *     (Domitrovich et al. 2007); making the face oneself (the mirror) is
 *     optional and never rated.
 */

// Doing something with a feeling (the R of RULER, Regulating), every third
// round and never rated: one small thing Lumi does, shown, not said. Either
// the child hands Lumi something (the teddy to cuddle, the bed …), or taps
// three times (breathe in and out with Lumi, three bursts of celebration).
// The old every-round "how strong" and "what helps" lists were words in a
// row of pictures (🌬️, 🔢, 🗣️) that a child who cannot read could not tell
// apart, three drags per round.
const CALM = {
  'Traurig':      { give: '🧸' },
  'Müde':         { give: '🛏️' },
  'Gelangweilt':  { give: '🎨' },
  'Neugierig':    { give: '🔍' },
  'Dankbar':      { give: '🎁' },
  'Glücklich':    { tap: '🎉' },
  'Stolz':        { tap: '🎉' },
  'Wütend':       { tap: '🌬️' },
  'Ängstlich':    { tap: '🌬️' },
  'Aufgeregt':    { tap: '🌬️' },
  'Verlegen':     { tap: '🌬️' },
  'Überrascht':   { tap: '🌬️' },
  'Eifersüchtig': { tap: '🌬️' },
}
const calmRound = i => i % 3 === 2

// Which feelings may stand next to the right one as the other choices. Many
// situations allow more than one honest feeling — the dentist can make you
// aufgeregt as well as ängstlich, winning makes you stolz and glücklich — and
// a child who picked the second one was told it was wrong. So a feeling's
// other choices are only ones that clearly do not fit any of its situations;
// never one of the same kind (no Stolz next to Glücklich, no Traurig next to
// Wütend, no Gelangweilt next to Müde). A situation can rule out more with
// `near`.
const DECOYS = {
  'Glücklich':    ['Traurig', 'Wütend', 'Ängstlich', 'Müde', 'Verlegen', 'Gelangweilt', 'Eifersüchtig'],
  'Traurig':      ['Glücklich', 'Aufgeregt', 'Stolz', 'Dankbar', 'Müde', 'Neugierig', 'Verlegen'],
  'Wütend':       ['Glücklich', 'Ängstlich', 'Müde', 'Dankbar', 'Stolz', 'Gelangweilt', 'Verlegen', 'Neugierig'],
  'Ängstlich':    ['Glücklich', 'Wütend', 'Müde', 'Stolz', 'Dankbar', 'Gelangweilt', 'Traurig'],
  'Aufgeregt':    ['Traurig', 'Wütend', 'Müde', 'Gelangweilt', 'Eifersüchtig'],
  'Müde':         ['Wütend', 'Ängstlich', 'Aufgeregt', 'Neugierig', 'Eifersüchtig', 'Überrascht'],
  'Verlegen':     ['Glücklich', 'Stolz', 'Dankbar', 'Müde', 'Gelangweilt', 'Neugierig'],
  'Dankbar':      ['Traurig', 'Wütend', 'Ängstlich', 'Gelangweilt', 'Müde', 'Eifersüchtig', 'Verlegen'],
  'Überrascht':   ['Traurig', 'Müde', 'Gelangweilt', 'Wütend', 'Eifersüchtig'],
  'Stolz':        ['Traurig', 'Ängstlich', 'Müde', 'Gelangweilt', 'Wütend', 'Eifersüchtig'],
  'Gelangweilt':  ['Glücklich', 'Stolz', 'Ängstlich', 'Aufgeregt', 'Dankbar', 'Überrascht', 'Neugierig'],
  'Eifersüchtig': ['Glücklich', 'Müde', 'Stolz', 'Dankbar', 'Überrascht', 'Neugierig', 'Ängstlich'],
  'Neugierig':    ['Traurig', 'Wütend', 'Müde', 'Gelangweilt', 'Verlegen', 'Eifersüchtig'],
}

// One thing on the stage (feelingStage.jsx): picture, place, what it does
const t = (a, x, act, o) => ({ a, x, act, ...o })
const kid = (a, x, act, o) => ({ a, x, act, char: true, s: 96, ...o })
// what Lumi holds: just right of Lumi, at hand height
const HAND = 252

// `audio`: the situation as a recording in audio/gefuehlswelt/ (silent while
// only Lumi's own recordings play, narrator.js). The scene itself tells the
// situation: `cast`, `fx` and `lumi` (feelingStage.jsx). The text is only a
// label. No face is part of a scene: the face is the answer.
const SCENARIOS = [
  // Glücklich
  { situation:'Lumi bekommt ein riesiges Geschenk! 🎁', emotion:'Glücklich',
    audio:['lumi-bekommt-ein-riesiges-geschenk'],
    cast:[t('🎁', 400, 'drop', { s: 140, d: 0.6 })] },
  { situation:'Lumi gewinnt beim Wettrennen gegen alle anderen! 🏆', emotion:'Glücklich',
    audio:['lumi-gewinnt-beim-wettrennen-gegen-alle-anderen'],
    lumi:{ x: 330, act: 'run' }, cast:[t('🏁', 440, 'pop', { s: 90 }), kid('🐢', 120, 'inL', { s: 70, d: 1.4 }), kid('🐌', 50, 'inL', { s: 60, d: 1.8 }), t('🏆', 440, 'drop', { s: 70, y: 110, d: 1.2 })] },
  { situation:'Lumi trifft nach langer Zeit den besten Freund wieder! 🤗', emotion:'Glücklich',
    audio:['lumi-trifft-nach-langer-zeit-den-besten-freund-wieder'],
    cast:[kid('🐻', 330, 'in', { s: 130, flip: true, d: 0.4 }), t('❤️', 250, 'pop', { s: 50, y: 150, d: 1.6 })] },
  { situation:'Lumi darf heute so lange aufbleiben, wie Lumi möchte! 🌙', emotion:'Glücklich', fx:'night',
    cast:[t('🌙', 480, 'bob', { s: 80, y: 200 }), t('🎲', 330, 'drop', { s: 70, d: 0.8 }), t('🧸', 420, 'drop', { s: 80, d: 1.1 })] },
  { situation:'Lumi findet beim Spaziergang einen schönen bunten Stein! 🪨✨', emotion:'Glücklich',
    lumi:{ act: 'in' }, cast:[t('🌿', 470, 'pop', { s: 90 }), t('🪨', 330, 'pop', { s: 70, d: 1 }), t('✨', 350, 'bob', { s: 50, y: 60, d: 1.3 })] },
  { situation:'Es hat geschneit! Lumi darf den ganzen Tag im Schnee spielen. ❄️', emotion:'Glücklich', fx:'snow',
    cast:[t('⛄', 400, 'pop', { s: 130, d: 0.8 })] },
  // Traurig
  { situation:'Lumis Lieblings-Eis fällt auf den Boden … 🍦', emotion:'Traurig',
    audio:['lumis-lieblings-eis-faellt-auf-den-boden'],
    cast:[t('🍦', HAND, 'fall', { s: 70, y: 60, d: 1.2 })] },
  { situation:'Lumis bester Freund zieht in eine andere Stadt … 📦', emotion:'Traurig',
    audio:['lumis-bester-freund-zieht-in-eine-andere-stadt'],
    cast:[t('📦', 450, 'out', { s: 90, d: 1.6 }), kid('🐻', 360, 'out', { s: 120, d: 1.4 })] },
  { situation:'Es regnet, und Lumi kann draußen nicht spielen. ☔', emotion:'Traurig', fx:'rain',
    audio:['es-regnet-und-lumi-kann-draussen-nicht-spielen'],
    cast:[t('🌧️', 300, 'bob', { s: 110, y: 170 }), t('⚽', 420, 'pop', { s: 70 })] },
  { situation:'Das Lieblingsspielzeug von Lumi ist kaputtgegangen. 💔', emotion:'Traurig',
    cast:[t('🤖', 340, 'topple', { s: 100, d: 0.8 }), t('🔩', 420, 'drop', { s: 40, d: 1.8 }), t('🔩', 460, 'drop', { s: 34, d: 2 })] },
  { situation:'Lumis Luftballon fliegt davon, hoch in den Himmel. 🎈', emotion:'Traurig',
    cast:[t('🎈', HAND, 'up', { s: 80, y: 110, d: 1 })] },
  { situation:'Lumi ist nicht zum Geburtstag eingeladen. 💌', emotion:'Traurig',
    cast:[t('🎂', 460, 'pop', { s: 80 }), kid('🐰', 390, 'hop', { s: 80 }), kid('🐻', 540, 'hop', { s: 80, d: 0.3, flip: true }), t('💌', 250, 'zoom', { s: 50, y: 150, d: 1 }), t('🎈', 500, 'bob', { s: 60, y: 120 })] },
  { situation:'Lumis Sandburg wird von einer Welle weggespült. 🌊', emotion:'Traurig',
    cast:[t('🏰', 380, 'sink', { s: 110, d: 1.8 }), t('🌊', 380, 'sweep', { s: 150, d: 1, z: 3 })] },
  { situation:'Lumi muss den schönen Urlaub früher beenden. 🏖️', emotion:'Traurig',
    cast:[t('🏖️', 460, 'pop', { s: 130 }), t('🧳', HAND + 20, 'drop', { s: 70, d: 1 }), t('🚗', 340, 'in', { s: 90, d: 1.6 })] },
  // Wütend
  { situation:'Ein Kind nimmt Lumi einfach das Spielzeug weg!', emotion:'Wütend',
    audio:['ein-kind-nimmt-lumi-einfach-das-spielzeug-weg'],
    cast:[t('🚗', HAND, 'grab', { s: 64, to: 300, d: 0.8 }), kid('🐒', 330, 'visit', { s: 110, flip: true, d: 0.8 })] },
  { situation:'Jemand hat die Zeichnung von Lumi zerrissen! 😤', emotion:'Wütend',
    audio:['jemand-hat-die-zeichnung-von-lumi-zerrissen'],
    cast:[t('🖼️', 360, 'topple', { s: 100, d: 1.4 }), kid('🐒', 470, 'visit', { s: 100, flip: true, d: 0.4 }), t('💥', 360, 'bang', { s: 80, y: 40, d: 1.3, z: 3 })] },
  { situation:'Lumi steht in der Reihe, und jemand drängelt sich vor! 😠', emotion:'Wütend',
    cast:[t('🍦', 560, 'pop', { s: 60, y: 60 }), kid('🐧', 480, 'none', { s: 80, flip: true }), kid('🐤', 400, 'none', { s: 70, flip: true }), kid('🐷', 290, 'jack', { s: 100, flip: true, d: 1.2, z: 3 }), t('💨', 330, 'bang', { s: 70, y: 20, d: 1.3 }), t('💥', 250, 'bang', { s: 50, y: 120, d: 1.5 })] },
  { situation:'Lumi hat lange gemalt, und jemand kritzelt absichtlich darüber! 🎨', emotion:'Wütend',
    cast:[t('🖼️', 380, 'pop', { s: 120 }), t('🖍️', 380, 'scribble', { s: 70, y: 40, d: 0.8, z: 3 }), kid('🐒', 520, 'in', { s: 90, flip: true, d: 0.5 })] },
  { situation:'Lumi wird beim Spielen immer beschummelt! 🎲', emotion:'Wütend',
    cast:[t('🎲', 320, 'shake', { s: 60 }), t('🃏', 400, 'pop', { s: 60, d: 0.5 }), kid('🐒', 500, 'hop', { s: 100, flip: true, d: 1 })] },
  { situation:'Niemand hört Lumi zu, obwohl Lumi etwas Wichtiges sagen will. 🗣️', emotion:'Wütend',
    lumi:{ say: ['🗣️', '👂'] }, cast:[kid('🐰', 400, 'none', { s: 90, say: ['📱'] }), kid('🐻', 510, 'none', { s: 100 }), t('📱', 450, 'pop', { s: 50, y: 70, d: 0.6 })] },
  // Ängstlich
  { situation:'Lumi hört mitten in der Nacht ein lautes Geräusch!', emotion:'Ängstlich', fx:'night',
    audio:['lumi-hoert-mitten-in-der-nacht-ein-lautes-geraeusch'],
    cast:[t('🛏️', 320, 'pop', { s: 110 }), t('💥', 480, 'bang', { s: 110, y: 100, d: 1.2 })] },
  { situation:'Lumi soll alleine auf der großen Bühne auftreten. 🎭', emotion:'Ängstlich', fx:'spot',
    audio:['lumi-soll-alleine-auf-der-grossen-buehne-auftreten'],
    cast:[t('🎤', HAND, 'pop', { s: 60, y: 40 }), t('👀', 380, 'pop', { s: 54, y: 10, d: 0.8 }), t('👀', 460, 'pop', { s: 54, y: 10, d: 1 }), t('👀', 540, 'pop', { s: 54, y: 10, d: 1.2 }), t('🎭', 470, 'pop', { s: 70, y: 180 })] },
  { situation:'Lumi sieht eine riesige Spinne im Zimmer! 🕷️', emotion:'Ängstlich',
    audio:['lumi-sieht-eine-riesige-spinne-im-zimmer'],
    cast:[t('🕷️', 340, 'down', { s: 110, y: 120, d: 0.6 })] },
  { situation:'Lumi muss morgen zum Zahnarzt. 🦷', emotion:'Ängstlich',
    lumi:{ say: ['🦷', '🪥'] }, cast:[t('📅', 470, 'drop', { s: 80, y: 130 }), kid('👩', 400, 'in', { s: 130, flip: true, d: 0.6 })] },
  { situation:'Das Licht geht aus, und alles ist stockdunkel! 🌑', emotion:'Ängstlich', fx:'dark',
    cast:[t('💡', 330, 'flicker', { s: 70, y: 210 })] },
  { situation:'Lumi hört draußen ein seltsames Kratzen am Fenster. 🪟', emotion:'Ängstlich', fx:'night',
    cast:[t('🪟', 420, 'shake', { s: 140, y: 70, d: 0.8 }), t('🌳', 540, 'pop', { s: 120 })] },
  { situation:'Lumi soll im Schwimmbad ins tiefe Becken springen! 🏊', emotion:'Ängstlich',
    cast:[t('🌊', 400, 'pop', { s: 170, y: -40 }), t('🛟', 430, 'bob', { s: 60, y: 40 }), t('🪜', 290, 'pop', { s: 100 })] },
  // Aufgeregt
  { situation:'Morgen ist Lumis mega Geburtstagsparty! 🎉', emotion:'Aufgeregt',
    audio:['morgen-ist-lumis-mega-geburtstagsparty'],
    cast:[t('📅', 470, 'drop', { s: 80, y: 150 }), t('🎂', 380, 'pop', { s: 100, d: 0.8 }), t('🎈', 520, 'bob', { s: 70, y: 40, d: 1.1 })] },
  { situation:'Lumi fährt heute zum ersten Mal in den Freizeitpark! 🎡', emotion:'Aufgeregt',
    audio:['lumi-faehrt-heute-zum-ersten-mal-in-den-freizeitpark'],
    cast:[t('🎡', 440, 'pop', { s: 200, d: 0.5 }), t('🎠', 320, 'pop', { s: 80, d: 1 })] },
  { situation:'Lumi darf mit Papa zusammen ein Modell bauen! 🏗️', emotion:'Aufgeregt',
    audio:['lumi-darf-mit-papa-zusammen-ein-modell-bauen'],
    cast:[kid('👨', 470, 'in', { s: 130, flip: true }), t('🧱', 330, 'drop', { s: 60, d: 1 }), t('🔧', 380, 'drop', { s: 50, d: 1.3 })] },
  { situation:'Lumi fliegt heute zum ersten Mal mit dem Flugzeug! ✈️', emotion:'Aufgeregt',
    cast:[t('✈️', 400, 'zoom', { s: 110, y: 190, d: 0.6 }), t('🧳', HAND + 30, 'drop', { s: 70, d: 0.3 })] },
  { situation:'Lumi darf heute Abend mit Freunden zelten! ⛺', emotion:'Aufgeregt',
    cast:[t('⛺', 430, 'pop', { s: 150 }), t('🔦', 300, 'drop', { s: 54, d: 0.8 }), kid('🐻', 540, 'hop', { s: 80, flip: true, d: 1 })] },
  { situation:'Heute kommt Oma zu Besuch! Lumi schaut immer wieder aus dem Fenster. 🪟', emotion:'Aufgeregt',
    lumi:{ act: 'hop', say: ['👵', '🚗'] }, cast:[t('🪟', 400, 'pop', { s: 150, y: 70 }), t('🚗', 400, 'zoom', { s: 50, y: 110, d: 1.6, z: 0 }), t('⏰', 540, 'shake', { s: 60, y: 160, d: 0.6 })] },
  { situation:'Lumi darf beim großen Kindergartenfest Trommel spielen! 🥁', emotion:'Aufgeregt',
    cast:[t('🥁', HAND + 10, 'drop', { s: 80 }), t('🎵', 340, 'bob', { s: 44, y: 150, d: 0.8 }), t('🎵', 420, 'bob', { s: 40, y: 190, d: 1 }), t('🎪', 500, 'pop', { s: 130 })] },
  // Müde
  { situation:'Es ist schon spät am Abend. Lumi hat den ganzen Tag gespielt und gähnt. 🌙', emotion:'Müde', fx:'night',
    cast:[t('🌙', 470, 'bob', { s: 80, y: 200, d: 0.4 }), t('🛏️', 400, 'pop', { s: 120, d: 0.8 })] },
  { situation:'Lumi hat den ganzen Tag im Garten geholfen. Jetzt fallen Lumi die Augen zu. 🌻', emotion:'Müde',
    cast:[t('🌻', 340, 'pop', { s: 90 }), t('🌻', 420, 'pop', { s: 100, d: 0.3 }), t('🌻', 500, 'pop', { s: 90, d: 0.6 }), t('🪣', HAND + 20, 'drop', { s: 60, d: 1 })] },
  { situation:'Lumi hat die ganze Nacht kaum geschlafen. ⭐🌙', emotion:'Müde', fx:'night',
    cast:[t('🌙', 470, 'bob', { s: 80, y: 200 }), kid('🦉', 400, 'pop', { s: 90, y: 60, d: 0.8 }), t('⏰', 300, 'shake', { s: 60, d: 1.6 })] },
  { situation:'Nach dem großen Sportfest fallen Lumi die Augen zu. 🏃', emotion:'Müde',
    cast:[t('🏅', HAND, 'drop', { s: 60, y: 60 }), t('⚽', 380, 'pop', { s: 70, d: 0.6 }), t('🏁', 480, 'pop', { s: 90, d: 0.8 })] },
  { situation:'Lumi ist lange im Auto gefahren. Jetzt gähnt Lumi. 🚗', emotion:'Müde',
    cast:[t('🚗', 400, 'in', { s: 140 }), t('🗺️', 300, 'drop', { s: 60, d: 1 })] },
  // Verlegen
  { situation:'Lumi hat aus Versehen ein Glas umgeworfen. Alle schauen! 🥛', emotion:'Verlegen',
    cast:[t('🥛', HAND + 10, 'fall', { s: 60, y: 50, d: 0.8 }), t('👀', 420, 'pop', { s: 56, y: 60, d: 1.6 }), t('👀', 520, 'pop', { s: 56, y: 60, d: 1.8 })] },
  { situation:'Lumi stolpert in der Turnhalle vor allen Kindern. 😬', emotion:'Verlegen',
    lumi:{ act: 'stumble', d: 0.6 }, cast:[t('🏀', 300, 'drop', { s: 50, d: 0.6 }), kid('🐰', 440, 'pop', { s: 80, d: 1.4, flip: true }), kid('🐻', 530, 'pop', { s: 90, d: 1.6, flip: true })] },
  { situation:'Lumi singt laut mit, aber ganz falsch! Alle lachen. 🎤', emotion:'Verlegen',
    cast:[t('🎤', HAND, 'pop', { s: 60, y: 50 }), t('🎵', 300, 'shake', { s: 50, y: 170, d: 0.5 }), kid('🐰', 440, 'hop', { s: 80, d: 1.2, flip: true }), kid('🐻', 530, 'hop', { s: 90, d: 1.4, flip: true })] },
  { situation:'Lumi sagt zur Erzieherin aus Versehen „Mama“! 😬', emotion:'Verlegen',
    lumi:{ say: 'Mama?' }, cast:[kid('👩', 440, 'in', { s: 140, flip: true })] },
  { situation:'Lumi hatte Spinat zwischen den Zähnen, und alle haben es gesehen! 🥬', emotion:'Verlegen',
    cast:[t('🥬', HAND, 'pop', { s: 54, y: 80 }), t('👀', 420, 'pop', { s: 56, y: 60, d: 1 }), t('👀', 520, 'pop', { s: 56, y: 60, d: 1.2 })] },
  // Dankbar
  { situation:'Lumis bester Freund teilt seine Schokolade mit Lumi! 🍫', emotion:'Dankbar',
    cast:[kid('🐻', 420, 'in', { s: 130, flip: true }), t('🍫', 360, 'give', { s: 60, y: 60, to: HAND, d: 1.5 })] },
  { situation:'Oma hat extra Lumis Lieblingskuchen gebacken! 🎂', emotion:'Dankbar',
    cast:[kid('👵', 440, 'in', { s: 140, flip: true }), t('🎂', 370, 'give', { s: 70, y: 50, to: HAND + 20, d: 1.5 })] },
  { situation:'Jemand hilft Lumi, den schweren Rucksack zu tragen! 🎒', emotion:'Dankbar',
    cast:[t('🎒', HAND + 10, 'give', { s: 80, to: 400, d: 1.6 }), kid('🐘', 450, 'in', { s: 140, flip: true, d: 0.4 })] },
  { situation:'Lumi ist hingefallen. Die Freundin tröstet Lumi. 🤗', emotion:'Dankbar', near:['Traurig'],
    lumi:{ act: 'stumble' }, cast:[kid('🐰', 300, 'in', { s: 110, flip: true, d: 1.2 }), t('❤️', 240, 'pop', { s: 44, y: 170, d: 2.2 })] },
  { situation:'Papa liest Lumi eine extra lange Geschichte vor! 📖', emotion:'Dankbar',
    cast:[kid('👨', 400, 'in', { s: 140, flip: true }), t('📖', 330, 'pop', { s: 70, y: 50, d: 1.2 })] },
  // Überrascht
  { situation:'Lumi macht die Tür auf, und plötzlich springen alle hervor! 🎊', emotion:'Überrascht',
    cast:[t('🚪', 300, 'pop', { s: 150 }), kid('🐰', 400, 'jack', { s: 90, d: 1.2, flip: true }), kid('🐻', 480, 'jack', { s: 100, d: 1.35, flip: true }), kid('🐒', 560, 'jack', { s: 80, d: 1.5, flip: true }), t('🎊', 470, 'bang', { s: 90, y: 160, d: 1.6 })] },
  { situation:'Lumi schaut aus dem Fenster: Über Nacht ist alles weiß vom Schnee! ❄️', emotion:'Überrascht', fx:'snow',
    cast:[t('🪟', 400, 'pop', { s: 160, y: 60 }), t('⛄', 520, 'pop', { s: 90, d: 1.2 })] },
  { situation:'Im Paket ist ein riesiger Stoffdrache! 🐉', emotion:'Überrascht',
    cast:[t('📦', 380, 'drop', { s: 110 }), t('🐉', 380, 'jack', { s: 150, y: 50, d: 1.4 })] },
  { situation:'Auf einmal sagt die Erzieherin: Heute gehen wir in den Zoo! 🦁', emotion:'Überrascht',
    cast:[kid('👩', 360, 'in', { s: 130, flip: true }), kid('🦁', 470, 'jack', { s: 90, y: 80, d: 1.4 }), kid('🦒', 550, 'jack', { s: 110, d: 1.6 })] },
  { situation:'Lumi findet unter dem Kissen einen Brief von der Zahnfee! 🧚', emotion:'Überrascht',
    cast:[t('🛏️', 400, 'pop', { s: 140 }), t('💌', 380, 'jack', { s: 60, y: 70, d: 1 }), kid('🧚', 520, 'bob', { s: 70, y: 170, d: 1.4 })] },
  // Stolz
  { situation:'Lumi kann jetzt alleine Fahrrad fahren! 🚲', emotion:'Stolz',
    lumi:{ x: 260, act: 'run', y: 40 }, cast:[t('🚲', 260, 'inL', { s: 140 })] },
  { situation:'Lumi kann zum ersten Mal ein ganzes Lied auswendig! 🎵', emotion:'Stolz',
    cast:[t('🎤', HAND, 'pop', { s: 60, y: 50 }), t('🎵', 320, 'bob', { s: 44, y: 150, d: 0.4 }), t('🎵', 400, 'bob', { s: 50, y: 190, d: 0.8 }), t('🎵', 480, 'bob', { s: 44, y: 150, d: 1.2 })] },
  { situation:'Lumi schafft das schwierige Puzzle ganz allein! 🧩', emotion:'Stolz',
    cast:[t('🧩', 360, 'drop', { s: 70 }), t('🧩', 430, 'drop', { s: 70, d: 0.5 }), t('🧩', 395, 'drop', { s: 70, y: 60, d: 1 }), t('✨', 470, 'bob', { s: 50, y: 120, d: 1.5 })] },
  { situation:'Lumi hat das Zimmer ganz alleine aufgeräumt! 🧹', emotion:'Stolz',
    cast:[t('🧹', HAND, 'shake', { s: 80 }), t('🧺', 420, 'pop', { s: 100 }), t('🧸', 420, 'drop', { s: 60, y: 50, d: 1 }), t('✨', 500, 'bob', { s: 50, y: 120, d: 1.5 })] },
  { situation:'Lumi bindet zum ersten Mal die Schuhe ganz allein zu! 👟', emotion:'Stolz',
    cast:[t('👟', HAND - 10, 'pop', { s: 70 }), t('✨', HAND + 40, 'bob', { s: 50, y: 70, d: 1 })] },
  // Gelangweilt
  { situation:'Lumi wartet schon lange beim Arzt. Es gibt nichts zu tun. ⏳', emotion:'Gelangweilt',
    cast:[t('🪑', 380, 'pop', { s: 100 }), t('⏳', 470, 'pop', { s: 70, y: 150 }), t('🪰', 360, 'buzz', { s: 36, y: 180, d: 1 })] },
  { situation:'Es regnet den ganzen Tag, und Lumi hat nichts zu tun. 🌧️', emotion:'Gelangweilt', fx:'rain',
    cast:[t('🪟', 420, 'pop', { s: 150, y: 70 }), t('⏳', 300, 'pop', { s: 60, d: 1 })] },
  { situation:'Im Kino passiert lange gar nichts. Lumi rutscht auf dem Sitz hin und her. 🎬', emotion:'Gelangweilt',
    cast:[t('📺', 430, 'pop', { s: 170, y: 60 }), t('🎬', 300, 'pop', { s: 60, y: 160, d: 0.8 })] },
  // Eifersüchtig
  { situation:'Lumis Bruder darf länger am Tablet spielen als Lumi. 📱', emotion:'Eifersüchtig',
    cast:[kid('🐰', 450, 'none', { s: 110, flip: true }), t('📱', 390, 'pop', { s: 54, y: 50, d: 0.6 }), t('⏳', 530, 'pop', { s: 50, y: 160, d: 1.2 })] },
  { situation:'Papa kuschelt mit dem neuen Baby und hat keine Zeit für Lumi. 🍼', emotion:'Eifersüchtig',
    cast:[kid('👨', 450, 'in', { s: 140, flip: true }), t('🍼', 390, 'pop', { s: 54, y: 60, d: 1.2 }), t('❤️', 460, 'pop', { s: 40, y: 160, d: 1.6 })] },
  { situation:'Die Erzieherin lobt das neue Kind, aber nicht Lumi. 🌟', emotion:'Eifersüchtig',
    cast:[kid('👩', 500, 'pop', { s: 140, flip: true }), kid('🐧', 380, 'pop', { s: 90, d: 0.4 }), t('🌟', 380, 'drop', { s: 50, y: 100, d: 1.4 })] },
  { situation:'Das Eis von Lumis Schwester ist viel größer als Lumis! 🍦', emotion:'Eifersüchtig',
    cast:[t('🍦', HAND, 'pop', { s: 44, y: 60 }), kid('🐰', 470, 'pop', { s: 110, flip: true }), t('🍦', 400, 'grow', { s: 120, y: 30, d: 1 })] },
  // Neugierig
  { situation:'Lumi sieht eine geheimnisvolle Kiste. Was ist da wohl drin? 📦', emotion:'Neugierig',
    cast:[t('📦', 380, 'shake', { s: 120, d: 0.6 })] },
  { situation:'Lumi findet im Sand eine glitzernde Muschel. Ob da etwas drin ist? 🐚', emotion:'Neugierig',
    lumi:{ act: 'in' }, cast:[t('🐚', 340, 'pop', { s: 80, d: 1 }), t('✨', 370, 'bob', { s: 44, y: 70, d: 1.4 })] },
  { situation:'Im Garten liegt ein kleines Kästchen mit einem Schloss. 🔒', emotion:'Neugierig',
    cast:[t('🌷', 480, 'pop', { s: 80 }), t('📦', 360, 'pop', { s: 90, d: 0.6 }), t('🔒', 360, 'drop', { s: 44, y: 30, d: 1.2, z: 3 })] },
  { situation:'Mama und Papa tuscheln. Als Lumi hereinkommt, hören sie schnell auf. 🤫', emotion:'Neugierig',
    lumi:{ act: 'in', d: 1 }, cast:[kid('👩', 400, 'none', { s: 130, say: ['🤫'] }), kid('👨', 510, 'none', { s: 140, flip: true }), t('🎁', 460, 'pop', { s: 50, y: 150, d: 0.3 })] },
]

// ─── Voice audio ─────────────────────────────────────────────────────────────
const GEF = 'audio/gefuehlswelt/'
const clip = name => `${GEF}${name}.mp3`

// ─── Levels ──────────────────────────────────────────────────────────────────
// Levels 1-3 used to be identical (five questions, always four choices) and
// so were 4-6. Now each level adds either a choice or a question, and new
// feelings come in at 4 and 7.
const BASIC = ['Glücklich', 'Traurig', 'Wütend', 'Ängstlich', 'Aufgeregt']
const MID   = [...BASIC, 'Müde', 'Verlegen', 'Dankbar']
const ALL   = Object.keys(CALM)
const LEVELS = [
  { feelings: BASIC, options: 2, rounds: 5 },
  { feelings: BASIC, options: 3, rounds: 5 },
  { feelings: BASIC, options: 3, rounds: 6 },
  { feelings: MID,   options: 3, rounds: 6 },
  { feelings: MID,   options: 4, rounds: 7 },
  { feelings: MID,   options: 4, rounds: 8 },
  { feelings: ALL,   options: 4, rounds: 8 },
  { feelings: ALL,   options: 4, rounds: 10 },
  { feelings: ALL,   options: 4, rounds: 10 },
  { feelings: ALL,   options: 4, rounds: 12 },
]

// Spread over the feelings: one situation of each in turn, never the same
// feeling twice in a row. (Picking one per feeling capped levels 1-3 at five
// questions, whatever the level asked for.)
function pickRounds(pool, rounds) {
  const groups = {}
  pool.forEach(s => { (groups[s.emotion] ??= []).push(s) })
  const decks = Object.values(groups).map(shuffle)
  const out = []
  while (out.length < rounds && decks.some(d => d.length)) {
    for (const d of shuffle(decks)) if (d.length && out.length < rounds) out.push(d.pop())
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i].emotion !== out[i - 1].emotion) continue
    const j = out.findIndex((x, k) => k > i && x.emotion !== out[i - 1].emotion)
    if (j > -1) [out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

// The other choices come from the feelings this level is about first; only if
// those run out from the rest.
function choicesFor(s, feelings, count) {
  const fits = DECOYS[s.emotion].filter(e => !s.near?.includes(e))
  const decoys = [
    ...shuffle(fits.filter(e => feelings.includes(e))),
    ...shuffle(fits.filter(e => !feelings.includes(e))),
  ].slice(0, count - 1)
  return shuffle([s.emotion, ...decoys])
}

const plain = s => s.replace(/\s*\p{Extended_Pictographic}️?/gu, '').trim()

const GO = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }
const LUMI_X = 170

export default function EmotionGame({ level = 1, onComplete }) {
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1]
  const [challenges] = useState(() =>
    pickRounds(SCENARIOS.filter(s => cfg.feelings.includes(s.emotion)), cfg.rounds)
      .map(s => ({ ...s, options: choicesFor(s, cfg.feelings, cfg.options) })),
  )
  const [idx,       setIdx]       = useState(0)
  // watch (the scene plays) → pick (hand Lumi a face) → show (Lumi makes
  // it) → [calm (every third round)] → done (next round by itself) → end
  const [phase,     setPhase]     = useState('watch')
  const [worn,      setWorn]      = useState(null)     // the face Lumi wears
  const [firstTry,  setFirstTry]  = useState(0)
  const [streak,    setStreak]    = useState(0)
  const [taps,      setTaps]      = useState(0)        // calm by tapping: breaths or bursts so far
  const [calmed,    setCalmed]    = useState(false)
  const [mirror,    setMirror]    = useState(false)
  const [replay,    setReplay]    = useState(0)
  const [after, cancel] = useAfter()
  const [bursts, burst] = useBursts()
  const trayRef = useRef(null), tapRef = useRef(null)
  const trayStart = useTrayStart(trayRef)
  const [lumiRef] = useState(() => ({ get current() { return document.querySelector('[data-lumi-target] .pl-drop') } }))
  // one answer per round, even from a second tap before the screen caught up
  const answeredRef = useRef(-1)
  const doneRef = useRef(false)

  const ch = challenges[idx]
  const calm = ch && CALM[ch.emotion]
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600

  useEffect(() => () => stopNarration(), [])

  // A round: the scene plays in full, then the faces come. The recorded
  // situation (audio/gefuehlswelt) plays where there is one.
  useEffect(() => {
    if (!ch) return
    narrate(ch.audio ? [{ src: clip(ch.audio[0]) }, { src: clip('wie-fuehlt-sich-lumi-wohl'), gap: 250 }] : [])
    after(() => setPhase(p => (p === 'watch' ? 'pick' : p)), sceneLength(ch.cast, ch.lumi), { quiet: false })
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const lumiAt = () => lumiRef.current ?? undefined
  const afterFace = () => (calmRound(idx) ? setPhase('calm') : next())

  // Only the first answer counts, and there is no second one: Lumi tries the
  // face that was handed over, and if another one fits better, Lumi wonders,
  // shakes it off and makes that one. The old retry made every question a
  // sure point on the second go ("13 von 12 richtig") (EMO-01/02).
  const giveFace = (emotion) => {
    if (answeredRef.current === idx) return false
    answeredRef.current = idx
    const ok = emotion === ch.emotion
    setPhase('show')
    setWorn(emotion)
    if (ok) {
      const n = streak + 1
      setFirstTry(k => k + 1); setStreak(n)
      sayRight()
      burst(lumiAt(), n >= 3 ? 'confetti' : 'stars', n >= 3 ? 16 : 10)
      after(afterFace, 2000, { quiet: false })
    } else {
      setStreak(0)
      sayWrong()
      after(() => {
        setWorn('Neugierig')
        after(() => {
          sfx.boing(); setWorn(ch.emotion)
          after(afterFace, 2000, { quiet: false })
        }, 700, { quiet: false })
      }, 1100, { quiet: false })
    }
    return true
  }

  // Calming down: hand Lumi the thing, or three taps
  const settle = () => {
    setCalmed(true)
    setPhase('done')
    sfx.sparkle()
    burst(lumiAt(), 'hearts')
    after(next, 2000, { quiet: false })
  }
  const tapCalm = () => {
    if (phase !== 'calm') return
    const n = taps + 1
    setTaps(n)
    if (calm.tap === '🎉') { sfx.pop(); burst(lumiAt(), 'confetti', 12) } else { sfx.whoosh(); burst(lumiAt(), 'stars', 5) }
    if (n >= 3) settle()
  }

  const next = () => {
    if (idx + 1 >= challenges.length) { setPhase('end'); sfx.tada(); return }
    setIdx(i => i + 1); setPhase('watch'); setWorn(null); setTaps(0); setCalmed(false); setReplay(0)
  }

  const onDrop = (d) => {
    if (d.kind === 'face' && phase === 'pick') return giveFace(d.feeling)
    if (d.kind === 'calm' && phase === 'calm') { settle(); return true }
    return false
  }

  // Every feeling of this round, once each, for the end
  const met = useMemo(() => [...new Set(challenges.map(c => c.emotion))], [challenges])

  if (!ch) return null
  if (phase === 'end') return <Parade met={met} narrow={narrow} onDone={() => { if (!doneRef.current) { doneRef.current = true; onComplete(result(firstTry, challenges.length)) } }} />

  const answered = phase !== 'watch' && phase !== 'pick'
  const calmStep = phase === 'calm' || (phase === 'done' && calmRound(idx))
  const trayOn = phase === 'pick' || (phase === 'calm' && calm.give)
  // after breathing or cuddling Lumi is calm; after celebrating, beaming
  const lumiFeel = !calmed ? (worn ? FEEL[worn] : 'neutral')
    : calm.tap === '🎉' ? 'excited' : calm.tap || !BRIGHT.has(ch.emotion) ? 'calm' : 'happy'
  const bubble = phase === 'pick' ? <AskFace />
    : phase === 'calm' ? <><Art art={calm.give ?? calm.tap} size={36} />{calm.tap && <Dots n={taps} />}</>
    : worn && !calmed ? <FeelingFace feeling={worn} size={44} /> : null

  return (
    <DragArea autoTarget="lumi" disabled={!trayOn}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px clamp(10px,3vw,28px) 14px', gap: 8, minHeight: 0 }}>
        {/* kept clear of the sun in the backdrop's top right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 820, paddingRight: narrow ? 64 : 150, boxSizing: 'border-box' }}>
          <div style={{ flex: 1, minWidth: 0 }}><RoundTrail total={challenges.length} done={idx + (phase === 'done' ? 1 : 0)} walker="lumi" goal="🌈" size={narrow ? 34 : 42} /></div>
          <AgainButton onClick={() => { setReplay(r => r + 1); sfx.whoosh() }} />
        </div>

        <div data-lumi-target role="img" aria-label={plain(ch.situation)} style={{ flex: 1, width: '100%', maxWidth: 980, display: 'flex', minHeight: 0, position: 'relative' }}>
          <Stage key={`${idx}-${replay}`} playKey={`${idx}-${replay}`}
            lumi={{ x: LUMI_X, size: 160, feel: lumiFeel, strength: 1, pulse: calm?.tap === '🌬️' ? taps : 0, ...ch.lumi, ...(answered ? { act: undefined, say: undefined } : {}) }}
            cast={calmed && calm.give ? [...(ch.cast ?? []), { a: calm.give, x: LUMI_X + 100, y: 20, s: 70, act: 'drop' }] : ch.cast}
            fx={ch.fx}
            drop={{ who: 'lumi', id: 'lumi', onDrop, label: 'Lumi' }}
            bubbles={bubble ? { lumi: bubble } : {}}>
            {mirror && <Mirror feel={FEEL[ch.emotion]} onClose={() => { setMirror(false); after(afterFace, 700, { quiet: false }) }} />}
          </Stage>
          {streak >= 2 && <Rainbow n={streak} />}
          {phase === 'show' && worn === ch.emotion && !mirror && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }} onClick={() => { cancel(); setMirror(true); sfx.sparkle() }}
              aria-label="Spiegel: Mach das Gesicht auch" title="Mach das Gesicht auch!"
              style={{ position: 'absolute', left: 4, bottom: 4, width: 60, height: 60, borderRadius: '50%', border: '3px solid #2a1b3d', background: '#e9f6ff', boxShadow: '0 4px 0 rgba(42,27,61,.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
              <Art art="🪞" size={40} />
            </motion.button>
          )}
        </div>

        {/* clipped: the tray sliding in must not count as content height
            for the FitBox around the game */}
        <div style={{ overflow: 'clip', overflowClipMargin: 12, paddingTop: 10, width: '100%', display: 'flex', justifyContent: 'center', minHeight: narrow ? 118 : 140 }}>
          <AnimatePresence mode="wait">
            {phase !== 'watch' && !calmStep && (
              <motion.div key={`${idx}-face`} ref={trayRef}
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{ display: 'flex', gap: narrow ? 8 : 16, justifyContent: 'center', alignItems: 'flex-end', padding: '10px 14px', borderRadius: 28, background: 'rgba(255,253,247,.55)' }}>
                {ch.options.map(e => (
                  <Draggable key={e} id={e} data={{ kind: 'face', feeling: e }} label={e} disabled={phase !== 'pick'}>
                    <FaceChip feeling={e} size={narrow ? (ch.options.length > 3 ? 48 : 56) : 70} dim={answered && e !== ch.emotion} glow={answered && e === ch.emotion} />
                  </Draggable>
                ))}
              </motion.div>
            )}
            {calmStep && calm.give && (
              <motion.div key={`${idx}-give`} ref={trayRef}
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }}
                style={{ display: 'flex', justifyContent: 'center', padding: '10px 14px', borderRadius: 28, background: 'rgba(255,253,247,.55)', visibility: calmed ? 'hidden' : 'visible' }}>
                <Draggable id="calm" data={{ kind: 'calm' }} label="Lumi geben" disabled={phase !== 'calm'}>
                  <PicChip art={calm.give} size={narrow ? 64 : 80} />
                </Draggable>
              </motion.div>
            )}
            {calmStep && calm.tap && (
              <motion.button key={`${idx}-tap`} ref={tapRef} onClick={tapCalm} aria-label={calm.tap === '🎉' ? 'Feiern' : 'Atmen'}
                initial={{ scale: 0 }} animate={{ scale: calmed ? 0.8 : 1, opacity: calmed ? 0.4 : 1 }} exit={{ scale: 0 }} whileTap={{ scale: 0.85 }}
                style={{ width: 104, height: 104, borderRadius: '50%', border: '4px solid #2a1b3d', background: '#e9f6ff', boxShadow: '0 6px 0 rgba(42,27,61,.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
                <Art art={calm.tap} size={70} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
      <HintHand from={trayStart} to={lumiRef} active={trayOn && !mirror} delay={idx === 0 && phase === 'pick' ? 2000 : 6000} />
      <HintHand to={tapRef} active={phase === 'calm' && !!calm.tap && taps === 0} delay={idx < 3 ? 2000 : 5000} />
      {bursts}
    </DragArea>
  )
}

// Three dots: how many breaths (or bursts) so far
function Dots({ n }) {
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      {[0, 1, 2].map(i => <motion.span key={i} animate={{ scale: i < n ? 1.2 : 1 }}
        style={{ width: 12, height: 12, borderRadius: 6, border: '2.5px solid #2a1b3d', background: i < n ? '#ffc93c' : '#fffdf7', display: 'inline-block' }} />)}
    </span>
  )
}

// Right answers in a row: a rainbow over the stage grows with them
function Rainbow({ n }) {
  return (
    <motion.div key={n} initial={{ scale: 0.4, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 220, damping: 12 }}
      aria-hidden="true" style={{ position: 'absolute', left: 8, top: 4, pointerEvents: 'none', zIndex: 2 }}>
      <Art art="🌈" size={Math.min(110, 40 + n * 14)} />
    </motion.div>
  )
}

// The end of the level: Lumi shows every feeling of the round once more
function Parade({ met, narrow, onDone }) {
  const [k, setK] = useState(0)
  useEffect(() => {
    if (k > met.length) return
    const t = setTimeout(() => { setK(n => n + 1); sfx.pop() }, k === 0 ? 500 : 950)
    return () => clearTimeout(t)
  }, [k, met.length])
  const feel = k === 0 ? 'happy' : k <= met.length ? FEEL[met[k - 1]] : 'excited'
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: 16 }}>
      <FeelLumi feel={feel} size={narrow ? 150 : 220} strength={2} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 640, minHeight: narrow ? 70 : 90 }}>
        {met.slice(0, k).map((e, i) => (
          <motion.div key={e} initial={{ scale: 0, y: -40 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 320, damping: 14 }}>
            <FaceChip feeling={e} size={narrow ? 46 : 64} glow={i === k - 1} />
          </motion.div>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.94 }} onClick={onDone} aria-label="Fertig"
        animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: 1 }}
        style={{ ...GO, padding: '14px 48px', fontSize: 22, minHeight: 64, visibility: k > met.length ? 'visible' : 'hidden' }}>Fertig! 🌟</motion.button>
    </div>
  )
}

// The mirror: Lumi's face, big, to copy
function Mirror({ feel, onClose }) {
  return (
    <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={onClose} aria-label="Spiegel schließen"
      style={{ all: 'unset', cursor: 'pointer', position: 'absolute', left: W / 2 - 110, top: 14, width: 220, height: 280, zIndex: 5,
        borderRadius: '50%', border: '10px solid #c98a52', boxShadow: '0 0 0 4px #2a1b3d, 0 10px 0 rgba(42,27,61,.3)',
        background: 'radial-gradient(ellipse at 35% 30%, #ffffff, #cfeaff 60%, #a9d6f5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <FeelLumi feel={feel} size={170} strength={2} />
    </motion.button>
  )
}
