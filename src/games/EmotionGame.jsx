import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragArea, Draggable, RoundTrail, Art, useBursts } from '../components/play/index.js'
import { narrate, lockPreviews, stopNarration } from '../narrator.js'
import { sayRight, sayWrong, announce } from '../lib/feedback.js'
import { sayNumber } from '../tts.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { FEELING_ICON, BRIGHT, shuffle } from './feelings.js'
import { Stage, FeelLumi, FaceChip, PicChip, FEEL, useAfter, ReplayButton, W } from './feelingStage.jsx'
import { INK, pxButton } from './px.js'

/**
 * Gefühlswelt — „Wie geht's dir, Lumi?“
 *
 * The situation happens in front of the child: the balloon flies away, the
 * present drops from the sky, the spider comes down on its thread. The child
 * hands Lumi the face that fits, and Lumi makes it. Then how strong the
 * feeling is, and one thing that helps — each also handed to Lumi.
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

// The module's own docstring names RULER — Recognizing, Understanding,
// Labeling, Expressing, Regulating — but only the first three ever happened.
// Nothing ever asked what to actually do with a feeling. None of these is
// wrong; the point is having a repertoire, not picking a winner. Each one has
// to fit every situation of its feeling ("Licht anmachen" did not fit the
// stage or the dentist).
const COPING = {
  'Glücklich':   [{ i:'🗣️', t:'Davon erzählen' },  { i:'🤗', t:'Freude teilen' },      { i:'🎉', t:'Feiern' }],
  'Traurig':     [{ i:'🤗', t:'Trost holen' },      { i:'🗣️', t:'Darüber reden' },      { i:'🧸', t:'Kuscheln' }],
  'Wütend':      [{ i:'🌬️', t:'Tief durchatmen' },  { i:'🔢', t:'Bis zehn zählen' },    { i:'🗣️', t:'Sagen, was los ist' }],
  'Ängstlich':   [{ i:'🤝', t:'Hilfe holen' },      { i:'🌬️', t:'Langsam atmen' },      { i:'🗣️', t:'Sagen, was Angst macht' }],
  'Aufgeregt':   [{ i:'🌬️', t:'Tief durchatmen' },  { i:'🗣️', t:'Davon erzählen' },     { i:'🤸', t:'Herumhüpfen' }],
  'Müde':        [{ i:'🛏️', t:'Ausruhen' },         { i:'🌙', t:'Schlafen gehen' },     { i:'🧸', t:'Kuscheln' }],
  'Verlegen':    [{ i:'🌬️', t:'Tief durchatmen' },  { i:'😄', t:'Darüber lachen' },     { i:'🗣️', t:'Jemandem erzählen' }],
  'Dankbar':     [{ i:'🗣️', t:'Danke sagen' },      { i:'🤗', t:'Umarmen' },            { i:'🎁', t:'Etwas zurückgeben' }],
  'Überrascht':  [{ i:'🌬️', t:'Kurz durchatmen' },  { i:'🗣️', t:'Davon erzählen' },     { i:'🔍', t:'Genau hinschauen' }],
  'Stolz':       [{ i:'🗣️', t:'Davon erzählen' },   { i:'🎉', t:'Sich freuen' },        { i:'👀', t:'Jemandem zeigen' }],
  'Gelangweilt': [{ i:'🎨', t:'Etwas malen' },      { i:'📖', t:'Bilderbuch anschauen' },{ i:'🤸', t:'Bewegen' }],
  'Eifersüchtig':[{ i:'🗣️', t:'Darüber reden' },    { i:'🌬️', t:'Tief durchatmen' },    { i:'💛', t:'Sagen, was man sich wünscht' }],
  'Neugierig':   [{ i:'❓', t:'Nachfragen' },       { i:'🔍', t:'Genau hinschauen' },   { i:'⏳', t:'Abwarten' }],
}

// How strong — read out as "Lumi ist ein bisschen unsicher." Each step has
// its own face, so the three can be told apart without reading.
const INTENSITY = {
  'Glücklich':   ['ein bisschen glücklich 🙂', 'glücklich 😊', 'sehr glücklich 🤩'],
  'Traurig':     ['ein bisschen traurig 🙁', 'traurig 😢', 'sehr traurig 😭'],
  'Wütend':      ['ein bisschen genervt 😒', 'wütend 😡', 'sehr wütend 🤬'],
  'Ängstlich':   ['ein bisschen unsicher 😬', 'ängstlich 😨', 'sehr ängstlich 😱'],
  'Aufgeregt':   ['ein bisschen aufgeregt 🙂', 'aufgeregt 🤩', 'sehr aufgeregt 🎉'],
  'Müde':        ['ein bisschen müde 🥱', 'müde 😴', 'sehr müde 💤'],
  'Verlegen':    ['ein bisschen verlegen 😳', 'verlegen 🫣', 'sehr verlegen 🙈'],
  'Dankbar':     ['ein bisschen dankbar 🙂', 'dankbar 🥰', 'sehr dankbar 🫶'],
  'Überrascht':  ['ein bisschen überrascht 😮', 'überrascht 😲', 'sehr überrascht 🤯'],
  'Stolz':       ['ein bisschen stolz 🙂', 'stolz 💪', 'sehr stolz 🏆'],
  'Gelangweilt': ['ein bisschen gelangweilt 😐', 'gelangweilt 😑', 'sehr gelangweilt 😶'],
  'Eifersüchtig':['ein bisschen eifersüchtig 😒', 'eifersüchtig 😤', 'sehr eifersüchtig 😾'],
  'Neugierig':   ['ein bisschen neugierig 🤔', 'neugierig 🧐', 'sehr neugierig 🔍'],
}

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

// `audio`: [situation, explanation] as recordings in audio/gefuehlswelt/.
// Only where both match the text word for word — a situation spoken in the
// recorded voice and explained by the speech synthesis sounded like two
// people (EMO-07), so a question is either recorded throughout or not at all.
// `cast`, `fx` and `lumi` are the little scene that plays (feelingStage.jsx).
// No face is part of a scene: the face is the answer.
const SCENARIOS = [
  // Glücklich
  { situation:'Lumi bekommt ein riesiges Geschenk! 🎁', emotion:'Glücklich',
    explain:'Wenn wir etwas toll finden, fühlen wir uns glücklich! 🌟',
    audio:['lumi-bekommt-ein-riesiges-geschenk', 'wenn-wir-etwas-toll-finden-fuehlen-wir-uns-gluecklich'],
    cast:[t('🎁', 400, 'drop', { s: 140, d: 0.6 })] },
  { situation:'Lumi gewinnt beim Wettrennen gegen alle anderen! 🏆', emotion:'Glücklich',
    explain:'Wenn wir etwas Tolles schaffen, werden wir ganz glücklich!',
    audio:['lumi-gewinnt-beim-wettrennen-gegen-alle-anderen', 'wenn-wir-etwas-tolles-schaffen-werden-wir-ganz-gluecklich'],
    lumi:{ x: 330, act: 'run' }, cast:[t('🏁', 440, 'pop', { s: 90 }), kid('🐢', 120, 'inL', { s: 70, d: 1.4 }), kid('🐌', 50, 'inL', { s: 60, d: 1.8 }), t('🏆', 440, 'drop', { s: 70, y: 110, d: 1.2 })] },
  { situation:'Lumi trifft nach langer Zeit den besten Freund wieder! 🤗', emotion:'Glücklich',
    explain:'Freunde wiederzusehen macht uns glücklich! 💛',
    audio:['lumi-trifft-nach-langer-zeit-den-besten-freund-wieder', 'freunde-wiederzusehen-macht-uns-gluecklich'],
    cast:[kid('🐻', 330, 'in', { s: 130, flip: true, d: 0.4 }), t('❤️', 250, 'pop', { s: 50, y: 150, d: 1.6 })] },
  { situation:'Lumi darf heute so lange aufbleiben, wie Lumi möchte! 🌙', emotion:'Glücklich',
    explain:'Wenn wir etwas Besonderes dürfen, sind wir glücklich! 🎉', fx:'night',
    cast:[t('🌙', 480, 'bob', { s: 80, y: 200 }), t('🎲', 330, 'drop', { s: 70, d: 0.8 }), t('🧸', 420, 'drop', { s: 80, d: 1.1 })] },
  { situation:'Lumi findet beim Spaziergang einen schönen bunten Stein! 🪨✨', emotion:'Glücklich',
    explain:'Kleine Entdeckungen machen uns glücklich!',
    lumi:{ act: 'in' }, cast:[t('🌿', 470, 'pop', { s: 90 }), t('🪨', 330, 'pop', { s: 70, d: 1 }), t('✨', 350, 'bob', { s: 50, y: 60, d: 1.3 })] },
  { situation:'Es hat geschneit! Lumi darf den ganzen Tag im Schnee spielen. ❄️', emotion:'Glücklich',
    explain:'Wenn wir etwas Schönes erleben, sind wir glücklich!', fx:'snow',
    cast:[t('⛄', 400, 'pop', { s: 130, d: 0.8 })] },
  // Traurig
  { situation:'Lumis Lieblings-Eis fällt auf den Boden … 🍦', emotion:'Traurig',
    explain:'Wenn etwas schiefgeht, das uns wichtig ist, fühlen wir uns traurig.',
    audio:['lumis-lieblings-eis-faellt-auf-den-boden', 'wenn-etwas-schiefgeht-das-uns-wichtig-ist-fuehlen-wir-uns-traurig'],
    cast:[t('🍦', HAND, 'fall', { s: 70, y: 60, d: 1.2 })] },
  { situation:'Lumis bester Freund zieht in eine andere Stadt … 📦', emotion:'Traurig',
    explain:'Menschen zu vermissen macht uns traurig.',
    audio:['lumis-bester-freund-zieht-in-eine-andere-stadt', 'menschen-zu-vermissen-macht-uns-traurig'],
    cast:[t('📦', 450, 'out', { s: 90, d: 1.6 }), kid('🐻', 360, 'out', { s: 120, d: 1.4 })] },
  { situation:'Es regnet, und Lumi kann draußen nicht spielen. ☔', emotion:'Traurig',
    explain:'Enttäuschungen können uns traurig machen.', fx:'rain',
    audio:['es-regnet-und-lumi-kann-draussen-nicht-spielen', 'enttaeuschungen-koennen-uns-traurig-machen'],
    cast:[t('🌧️', 300, 'bob', { s: 110, y: 170 }), t('⚽', 420, 'pop', { s: 70 })] },
  { situation:'Das Lieblingsspielzeug von Lumi ist kaputtgegangen. 💔', emotion:'Traurig',
    explain:'Wenn etwas kaputtgeht, das wir lieb haben, sind wir traurig.',
    cast:[t('🤖', 340, 'topple', { s: 100, d: 0.8 }), t('🔩', 420, 'drop', { s: 40, d: 1.8 }), t('🔩', 460, 'drop', { s: 34, d: 2 })] },
  { situation:'Lumis Luftballon fliegt davon, hoch in den Himmel. 🎈', emotion:'Traurig',
    explain:'Wenn wir etwas verlieren, das wir mögen, sind wir traurig.',
    cast:[t('🎈', HAND, 'up', { s: 80, y: 110, d: 1 })] },
  { situation:'Lumi ist nicht zum Geburtstag eingeladen. 💌', emotion:'Traurig',
    explain:'Wenn wir nicht dabei sein dürfen, sind wir traurig.',
    cast:[t('🎂', 460, 'pop', { s: 80 }), kid('🐰', 390, 'hop', { s: 80 }), kid('🐻', 540, 'hop', { s: 80, d: 0.3, flip: true }), t('💌', 250, 'zoom', { s: 50, y: 150, d: 1 }), t('🎈', 500, 'bob', { s: 60, y: 120 })] },
  { situation:'Lumis Sandburg wird von einer Welle weggespült. 🌊', emotion:'Traurig',
    explain:'Wenn etwas kaputtgeht, das wir gebaut haben, sind wir traurig.',
    cast:[t('🏰', 380, 'sink', { s: 110, d: 1.8 }), t('🌊', 380, 'sweep', { s: 150, d: 1, z: 3 })] },
  { situation:'Lumi muss den schönen Urlaub früher beenden. 🏖️', emotion:'Traurig',
    explain:'Wenn etwas Schönes zu früh vorbei ist, sind wir traurig.',
    cast:[t('🏖️', 460, 'pop', { s: 130 }), t('🧳', HAND + 20, 'drop', { s: 70, d: 1 }), t('🚗', 340, 'in', { s: 90, d: 1.6 })] },
  // Wütend
  { situation:'Ein Kind nimmt Lumi einfach das Spielzeug weg!', emotion:'Wütend',
    explain:'Wenn wir uns ungerecht behandelt fühlen, werden wir wütend.',
    audio:['ein-kind-nimmt-lumi-einfach-das-spielzeug-weg', 'wenn-wir-uns-ungerecht-behandelt-fuehlen-werden-wir-wuetend'],
    cast:[t('🚗', HAND, 'grab', { s: 64, to: 300, d: 0.8 }), kid('🐒', 330, 'visit', { s: 110, flip: true, d: 0.8 })] },
  { situation:'Jemand hat die Zeichnung von Lumi zerrissen! 😤', emotion:'Wütend',
    explain:'Wenn etwas Wichtiges kaputtgemacht wird, macht uns das wütend.',
    audio:['jemand-hat-die-zeichnung-von-lumi-zerrissen', 'wenn-etwas-wichtiges-kaputt-gemacht-wird-macht-uns-das-wuetend'],
    cast:[t('🖼️', 360, 'topple', { s: 100, d: 1.4 }), kid('🐒', 470, 'visit', { s: 100, flip: true, d: 0.4 }), t('💥', 360, 'bang', { s: 80, y: 40, d: 1.3, z: 3 })] },
  { situation:'Lumi steht in der Reihe, und jemand drängelt sich vor! 😠', emotion:'Wütend',
    explain:'Wenn jemand unfair ist, werden wir wütend.',
    cast:[t('🍦', 560, 'pop', { s: 60, y: 60 }), kid('🐧', 480, 'none', { s: 80, flip: true }), kid('🐤', 400, 'none', { s: 70, flip: true }), kid('🐷', 300, 'in', { s: 90, flip: true, d: 1 })] },
  { situation:'Lumi hat lange gemalt, und jemand kritzelt absichtlich darüber! 🎨', emotion:'Wütend',
    explain:'Wenn jemand absichtlich etwas kaputtmacht, werden wir wütend.',
    cast:[t('🖼️', 380, 'pop', { s: 120 }), t('🖍️', 380, 'scribble', { s: 70, y: 40, d: 0.8, z: 3 }), kid('🐒', 520, 'in', { s: 90, flip: true, d: 0.5 })] },
  { situation:'Lumi wird beim Spielen immer beschummelt! 🎲', emotion:'Wütend',
    explain:'Schummeln macht uns wütend.',
    cast:[t('🎲', 320, 'shake', { s: 60 }), t('🃏', 400, 'pop', { s: 60, d: 0.5 }), kid('🐒', 500, 'hop', { s: 100, flip: true, d: 1 })] },
  { situation:'Niemand hört Lumi zu, obwohl Lumi etwas Wichtiges sagen will. 🗣️', emotion:'Wütend',
    explain:'Wenn uns keiner zuhört, werden wir wütend.',
    lumi:{ say: '…!' }, cast:[kid('🐰', 400, 'none', { s: 90 }), kid('🐻', 500, 'none', { s: 100 }), t('📱', 450, 'pop', { s: 50, y: 70, d: 0.6 })] },
  // Ängstlich
  { situation:'Lumi hört mitten in der Nacht ein lautes Geräusch!', emotion:'Ängstlich',
    explain:'Wenn wir etwas nicht kennen und es unerwartet kommt, werden wir ängstlich.', fx:'night',
    audio:['lumi-hoert-mitten-in-der-nacht-ein-lautes-geraeusch', 'wenn-wir-etwas-nicht-kennen-und-es-unerwartet-kommt-werden-wir-aengstl'],
    cast:[t('🛏️', 320, 'pop', { s: 110 }), t('💥', 480, 'bang', { s: 110, y: 100, d: 1.2 })] },
  { situation:'Lumi soll alleine auf der großen Bühne auftreten. 🎭', emotion:'Ängstlich',
    explain:'Vor einem großen Auftritt haben viele Menschen Angst.', fx:'spot',
    audio:['lumi-soll-alleine-auf-der-grossen-buehne-auftreten', 'vor-einem-grossen-auftritt-haben-viele-menschen-angst'],
    cast:[t('🎤', HAND, 'pop', { s: 60, y: 40 }), t('👀', 380, 'pop', { s: 54, y: 10, d: 0.8 }), t('👀', 460, 'pop', { s: 54, y: 10, d: 1 }), t('👀', 540, 'pop', { s: 54, y: 10, d: 1.2 }), t('🎭', 470, 'pop', { s: 70, y: 180 })] },
  { situation:'Lumi sieht eine riesige Spinne im Zimmer! 🕷️', emotion:'Ängstlich',
    explain:'Dinge, die uns erschrecken, machen uns ängstlich.',
    audio:['lumi-sieht-eine-riesige-spinne-im-zimmer', 'dinge-die-uns-erschrecken-machen-uns-aengstlich'],
    cast:[t('🕷️', 340, 'down', { s: 110, y: 120, d: 0.6 })] },
  { situation:'Lumi muss morgen zum Zahnarzt. 🦷', emotion:'Ängstlich',
    explain:'Vor Dingen, die wehtun könnten, haben wir manchmal Angst.',
    cast:[t('📅', 460, 'drop', { s: 80, y: 130 }), t('🦷', 380, 'pop', { s: 110, d: 0.8 }), t('🪥', 480, 'pop', { s: 60, d: 1.2 })] },
  { situation:'Das Licht geht aus, und alles ist stockdunkel! 🌑', emotion:'Ängstlich',
    explain:'Im Dunkeln haben wir manchmal Angst.', fx:'dark',
    cast:[t('💡', 330, 'flicker', { s: 70, y: 210 })] },
  { situation:'Lumi hört draußen ein seltsames Kratzen am Fenster. 🪟', emotion:'Ängstlich',
    explain:'Unbekannte Geräusche machen uns ängstlich.', fx:'night',
    cast:[t('🪟', 420, 'shake', { s: 140, y: 70, d: 0.8 }), t('🌳', 540, 'pop', { s: 120 })] },
  { situation:'Lumi soll im Schwimmbad ins tiefe Becken springen! 🏊', emotion:'Ängstlich',
    explain:'Vor etwas Neuem und Schwierigem haben wir oft Angst. Das ist ganz normal!',
    cast:[t('🌊', 400, 'pop', { s: 170, y: -40 }), t('🛟', 430, 'bob', { s: 60, y: 40 }), t('🪜', 290, 'pop', { s: 100 })] },
  // Aufgeregt
  { situation:'Morgen ist Lumis mega Geburtstagsparty! 🎉', emotion:'Aufgeregt',
    explain:'Wenn wir uns auf etwas Tolles freuen, sind wir aufgeregt!',
    audio:['morgen-ist-lumis-mega-geburtstagsparty', 'wenn-wir-uns-auf-etwas-tolles-freuen-sind-wir-aufgeregt'],
    cast:[t('📅', 470, 'drop', { s: 80, y: 150 }), t('🎂', 380, 'pop', { s: 100, d: 0.8 }), t('🎈', 520, 'bob', { s: 70, y: 40, d: 1.1 })] },
  { situation:'Lumi fährt heute zum ersten Mal in den Freizeitpark! 🎡', emotion:'Aufgeregt',
    explain:'Etwas zum ersten Mal erleben macht uns ganz aufgeregt!',
    audio:['lumi-faehrt-heute-zum-ersten-mal-in-den-freizeitpark', 'etwas-zum-ersten-mal-erleben-macht-uns-ganz-aufgeregt'],
    cast:[t('🎡', 440, 'pop', { s: 200, d: 0.5 }), t('🎠', 320, 'pop', { s: 80, d: 1 })] },
  { situation:'Lumi darf mit Papa zusammen ein Modell bauen! 🏗️', emotion:'Aufgeregt',
    explain:'Mit jemandem etwas Tolles tun dürfen macht uns aufgeregt!',
    audio:['lumi-darf-mit-papa-zusammen-ein-modell-bauen', 'mit-jemandem-etwas-tolles-tun-duerfen-macht-uns-aufgeregt'],
    cast:[kid('👨', 470, 'in', { s: 130, flip: true }), t('🧱', 330, 'drop', { s: 60, d: 1 }), t('🔧', 380, 'drop', { s: 50, d: 1.3 })] },
  { situation:'Lumi fliegt heute zum ersten Mal mit dem Flugzeug! ✈️', emotion:'Aufgeregt',
    explain:'Neue Abenteuer machen uns aufgeregt!',
    cast:[t('✈️', 400, 'zoom', { s: 110, y: 190, d: 0.6 }), t('🧳', HAND + 30, 'drop', { s: 70, d: 0.3 })] },
  { situation:'Lumi darf heute Abend mit Freunden zelten! ⛺', emotion:'Aufgeregt',
    explain:'Wenn wir etwas Besonderes vorhaben, sind wir aufgeregt!',
    cast:[t('⛺', 430, 'pop', { s: 150 }), t('🔦', 300, 'drop', { s: 54, d: 0.8 }), kid('🐻', 540, 'hop', { s: 80, flip: true, d: 1 })] },
  { situation:'Heute kommt Oma zu Besuch! Lumi schaut immer wieder aus dem Fenster. 🪟', emotion:'Aufgeregt',
    explain:'Wenn wir uns auf etwas Schönes freuen, sind wir aufgeregt!',
    lumi:{ act: 'hop' }, cast:[t('🪟', 380, 'pop', { s: 150, y: 70 }), kid('👵', 380, 'pop', { s: 60, y: 110, d: 1.4, z: 0 })] },
  { situation:'Lumi darf beim großen Kindergartenfest Trommel spielen! 🥁', emotion:'Aufgeregt',
    explain:'Bei etwas Besonderem mitzumachen macht uns aufgeregt!',
    cast:[t('🥁', HAND + 10, 'drop', { s: 80 }), t('🎵', 340, 'bob', { s: 44, y: 150, d: 0.8 }), t('🎵', 420, 'bob', { s: 40, y: 190, d: 1 }), t('🎪', 500, 'pop', { s: 130 })] },
  // Müde
  { situation:'Es ist schon spät am Abend. Lumi hat den ganzen Tag gespielt und gähnt. 🌙', emotion:'Müde',
    explain:'Nach einem langen Tag braucht unser Körper Ruhe. Dann sind wir müde.', fx:'night',
    cast:[t('🌙', 470, 'bob', { s: 80, y: 200, d: 0.4 }), t('🛏️', 400, 'pop', { s: 120, d: 0.8 })] },
  { situation:'Lumi hat den ganzen Tag im Garten geholfen. Jetzt fallen Lumi die Augen zu. 🌻', emotion:'Müde',
    explain:'Wenn wir viel gemacht haben, sind wir müde.',
    cast:[t('🌻', 340, 'pop', { s: 90 }), t('🌻', 420, 'pop', { s: 100, d: 0.3 }), t('🌻', 500, 'pop', { s: 90, d: 0.6 }), t('🪣', HAND + 20, 'drop', { s: 60, d: 1 })] },
  { situation:'Lumi hat die ganze Nacht kaum geschlafen. ⭐🌙', emotion:'Müde',
    explain:'Wenn wir zu wenig schlafen, sind wir müde.', fx:'night',
    cast:[t('🌙', 470, 'bob', { s: 80, y: 200 }), kid('🦉', 400, 'pop', { s: 90, y: 60, d: 0.8 }), t('⏰', 300, 'shake', { s: 60, d: 1.6 })] },
  { situation:'Nach dem großen Sportfest fallen Lumi die Augen zu. 🏃', emotion:'Müde',
    explain:'Viel Bewegung macht unseren Körper müde.',
    cast:[t('🏅', HAND, 'drop', { s: 60, y: 60 }), t('⚽', 380, 'pop', { s: 70, d: 0.6 }), t('🏁', 480, 'pop', { s: 90, d: 0.8 })] },
  { situation:'Lumi ist lange im Auto gefahren. Jetzt gähnt Lumi. 🚗', emotion:'Müde',
    explain:'Lange Fahrten machen uns müde.',
    cast:[t('🚗', 400, 'in', { s: 140 }), t('🗺️', 300, 'drop', { s: 60, d: 1 })] },
  // Verlegen
  { situation:'Lumi hat aus Versehen ein Glas umgeworfen. Alle schauen! 🥛', emotion:'Verlegen',
    explain:'Wenn uns etwas peinlich ist, fühlen wir uns verlegen.',
    cast:[t('🥛', HAND + 10, 'fall', { s: 60, y: 50, d: 0.8 }), t('👀', 420, 'pop', { s: 56, y: 60, d: 1.6 }), t('👀', 520, 'pop', { s: 56, y: 60, d: 1.8 })] },
  { situation:'Lumi stolpert in der Turnhalle vor allen Kindern. 😬', emotion:'Verlegen',
    explain:'Wenn vor anderen etwas schiefgeht, sind wir verlegen.',
    lumi:{ act: 'stumble', d: 0.6 }, cast:[t('🏀', 300, 'drop', { s: 50, d: 0.6 }), kid('🐰', 440, 'pop', { s: 80, d: 1.4, flip: true }), kid('🐻', 530, 'pop', { s: 90, d: 1.6, flip: true })] },
  { situation:'Lumi singt laut mit, aber ganz falsch! Alle lachen. 🎤', emotion:'Verlegen',
    explain:'Wenn andere über uns lachen, sind wir oft verlegen.',
    cast:[t('🎤', HAND, 'pop', { s: 60, y: 50 }), t('🎵', 300, 'shake', { s: 50, y: 170, d: 0.5 }), kid('🐰', 440, 'hop', { s: 80, d: 1.2, flip: true }), kid('🐻', 530, 'hop', { s: 90, d: 1.4, flip: true })] },
  { situation:'Lumi sagt zur Erzieherin aus Versehen „Mama“! 😬', emotion:'Verlegen',
    explain:'Wenn wir uns vor anderen versprechen, sind wir verlegen.',
    lumi:{ say: 'Mama?' }, cast:[kid('👩', 440, 'in', { s: 140, flip: true })] },
  { situation:'Lumi hatte Spinat zwischen den Zähnen, und alle haben es gesehen! 🥬', emotion:'Verlegen',
    explain:'Peinliche Momente machen uns verlegen.',
    cast:[t('🥬', HAND, 'pop', { s: 54, y: 80 }), t('👀', 420, 'pop', { s: 56, y: 60, d: 1 }), t('👀', 520, 'pop', { s: 56, y: 60, d: 1.2 })] },
  // Dankbar
  { situation:'Lumis bester Freund teilt seine Schokolade mit Lumi! 🍫', emotion:'Dankbar',
    explain:'Wenn jemand nett zu uns ist, fühlen wir uns dankbar.',
    cast:[kid('🐻', 420, 'in', { s: 130, flip: true }), t('🍫', 360, 'give', { s: 60, y: 60, to: HAND, d: 1.5 })] },
  { situation:'Oma hat extra Lumis Lieblingskuchen gebacken! 🎂', emotion:'Dankbar',
    explain:'Wenn jemand an uns denkt, sind wir dankbar.',
    cast:[kid('👵', 440, 'in', { s: 140, flip: true }), t('🎂', 370, 'give', { s: 70, y: 50, to: HAND + 20, d: 1.5 })] },
  { situation:'Jemand hilft Lumi, den schweren Rucksack zu tragen! 🎒', emotion:'Dankbar',
    explain:'Wenn uns jemand hilft, sind wir dankbar.',
    cast:[t('🎒', HAND + 10, 'give', { s: 80, to: 400, d: 1.6 }), kid('🐘', 450, 'in', { s: 140, flip: true, d: 0.4 })] },
  { situation:'Lumi ist hingefallen. Die Freundin tröstet Lumi. 🤗', emotion:'Dankbar', near:['Traurig'],
    explain:'Wenn uns jemand tröstet, sind wir dankbar.',
    lumi:{ act: 'stumble' }, cast:[kid('🐰', 300, 'in', { s: 110, flip: true, d: 1.2 }), t('❤️', 240, 'pop', { s: 44, y: 170, d: 2.2 })] },
  { situation:'Papa liest Lumi eine extra lange Geschichte vor! 📖', emotion:'Dankbar',
    explain:'Wenn sich jemand Zeit für uns nimmt, sind wir dankbar.',
    cast:[kid('👨', 400, 'in', { s: 140, flip: true }), t('📖', 330, 'pop', { s: 70, y: 50, d: 1.2 })] },
  // Überrascht
  { situation:'Lumi macht die Tür auf, und plötzlich springen alle hervor! 🎊', emotion:'Überrascht',
    explain:'Wenn etwas ganz unerwartet passiert, sind wir überrascht!',
    cast:[t('🚪', 300, 'pop', { s: 150 }), kid('🐰', 400, 'jack', { s: 90, d: 1.2, flip: true }), kid('🐻', 480, 'jack', { s: 100, d: 1.35, flip: true }), kid('🐒', 560, 'jack', { s: 80, d: 1.5, flip: true }), t('🎊', 470, 'bang', { s: 90, y: 160, d: 1.6 })] },
  { situation:'Lumi schaut aus dem Fenster: Über Nacht ist alles weiß vom Schnee! ❄️', emotion:'Überrascht',
    explain:'Wenn sich etwas auf einmal verändert, sind wir überrascht!', fx:'snow',
    cast:[t('🪟', 400, 'pop', { s: 160, y: 60 }), t('⛄', 520, 'pop', { s: 90, d: 1.2 })] },
  { situation:'Im Paket ist ein riesiger Stoffdrache! 🐉', emotion:'Überrascht',
    explain:'Wenn wir etwas nicht erwartet haben, sind wir überrascht!',
    cast:[t('📦', 380, 'drop', { s: 110 }), t('🐉', 380, 'jack', { s: 150, y: 50, d: 1.4 })] },
  { situation:'Auf einmal sagt die Erzieherin: Heute gehen wir in den Zoo! 🦁', emotion:'Überrascht',
    explain:'Unerwartete gute Nachrichten überraschen uns!',
    cast:[kid('👩', 360, 'in', { s: 130, flip: true }), kid('🦁', 470, 'jack', { s: 90, y: 80, d: 1.4 }), kid('🦒', 550, 'jack', { s: 110, d: 1.6 })] },
  { situation:'Lumi findet unter dem Kissen einen Brief von der Zahnfee! 🧚', emotion:'Überrascht',
    explain:'Geheimnisvolle Entdeckungen überraschen uns!',
    cast:[t('🛏️', 400, 'pop', { s: 140 }), t('💌', 380, 'jack', { s: 60, y: 70, d: 1 }), kid('🧚', 520, 'bob', { s: 70, y: 170, d: 1.4 })] },
  // Stolz
  { situation:'Lumi kann jetzt alleine Fahrrad fahren! 🚲', emotion:'Stolz',
    explain:'Wenn wir etwas Neues schaffen, sind wir stolz auf uns!',
    lumi:{ x: 260, act: 'run', y: 40 }, cast:[t('🚲', 260, 'inL', { s: 140 })] },
  { situation:'Lumi kann zum ersten Mal ein ganzes Lied auswendig! 🎵', emotion:'Stolz',
    explain:'Wenn wir etwas Schwieriges lernen, sind wir stolz!',
    cast:[t('🎤', HAND, 'pop', { s: 60, y: 50 }), t('🎵', 320, 'bob', { s: 44, y: 150, d: 0.4 }), t('🎵', 400, 'bob', { s: 50, y: 190, d: 0.8 }), t('🎵', 480, 'bob', { s: 44, y: 150, d: 1.2 })] },
  { situation:'Lumi schafft das schwierige Puzzle ganz allein! 🧩', emotion:'Stolz',
    explain:'Wenn wir etwas Schwieriges schaffen, sind wir stolz!',
    cast:[t('🧩', 360, 'drop', { s: 70 }), t('🧩', 430, 'drop', { s: 70, d: 0.5 }), t('🧩', 395, 'drop', { s: 70, y: 60, d: 1 }), t('✨', 470, 'bob', { s: 50, y: 120, d: 1.5 })] },
  { situation:'Lumi hat das Zimmer ganz alleine aufgeräumt! 🧹', emotion:'Stolz',
    explain:'Wenn wir etwas allein erledigen, sind wir stolz!',
    cast:[t('🧹', HAND, 'shake', { s: 80 }), t('🧺', 420, 'pop', { s: 100 }), t('🧸', 420, 'drop', { s: 60, y: 50, d: 1 }), t('✨', 500, 'bob', { s: 50, y: 120, d: 1.5 })] },
  { situation:'Lumi bindet zum ersten Mal die Schuhe ganz allein zu! 👟', emotion:'Stolz',
    explain:'Etwas Neues zu können macht uns stolz!',
    cast:[t('👟', HAND - 10, 'pop', { s: 70 }), t('✨', HAND + 40, 'bob', { s: 50, y: 70, d: 1 })] },
  // Gelangweilt
  { situation:'Lumi wartet schon lange beim Arzt. Es gibt nichts zu tun. ⏳', emotion:'Gelangweilt',
    explain:'Wenn nichts passiert, langweilen wir uns.',
    cast:[t('🪑', 380, 'pop', { s: 100 }), t('⏳', 470, 'pop', { s: 70, y: 150 }), t('🪰', 360, 'buzz', { s: 36, y: 180, d: 1 })] },
  { situation:'Es regnet den ganzen Tag, und Lumi hat nichts zu tun. 🌧️', emotion:'Gelangweilt',
    explain:'Wenn wir nichts zu tun haben, langweilen wir uns.', fx:'rain',
    cast:[t('🪟', 420, 'pop', { s: 150, y: 70 }), t('⏳', 300, 'pop', { s: 60, d: 1 })] },
  { situation:'Im Kino passiert lange gar nichts. Lumi rutscht auf dem Sitz hin und her. 🎬', emotion:'Gelangweilt',
    explain:'Wenn uns etwas nicht interessiert, langweilen wir uns.',
    cast:[t('📺', 430, 'pop', { s: 170, y: 60 }), t('🎬', 300, 'pop', { s: 60, y: 160, d: 0.8 })] },
  // Eifersüchtig
  { situation:'Lumis Bruder darf länger am Tablet spielen als Lumi. 📱', emotion:'Eifersüchtig',
    explain:'Wenn andere etwas haben, das wir auch wollen, werden wir manchmal eifersüchtig.',
    cast:[kid('🐰', 450, 'none', { s: 110, flip: true }), t('📱', 390, 'pop', { s: 54, y: 50, d: 0.6 }), t('⏳', 530, 'pop', { s: 50, y: 160, d: 1.2 })] },
  { situation:'Papa kuschelt mit dem neuen Baby und hat keine Zeit für Lumi. 🍼', emotion:'Eifersüchtig',
    explain:'Wenn jemand anderes die ganze Aufmerksamkeit bekommt, werden wir manchmal eifersüchtig.',
    cast:[kid('👨', 450, 'in', { s: 140, flip: true }), t('🍼', 390, 'pop', { s: 54, y: 60, d: 1.2 }), t('❤️', 460, 'pop', { s: 40, y: 160, d: 1.6 })] },
  { situation:'Die Erzieherin lobt das neue Kind, aber nicht Lumi. 🌟', emotion:'Eifersüchtig',
    explain:'Wenn andere mehr gelobt werden, werden wir manchmal eifersüchtig.',
    cast:[kid('👩', 500, 'pop', { s: 140, flip: true }), kid('🐧', 380, 'pop', { s: 90, d: 0.4 }), t('🌟', 380, 'drop', { s: 50, y: 100, d: 1.4 })] },
  { situation:'Das Eis von Lumis Schwester ist viel größer als Lumis! 🍦', emotion:'Eifersüchtig',
    explain:'Wenn jemand anderes mehr bekommt, werden wir manchmal eifersüchtig.',
    cast:[t('🍦', HAND, 'pop', { s: 44, y: 60 }), kid('🐰', 470, 'pop', { s: 110, flip: true }), t('🍦', 400, 'grow', { s: 120, y: 30, d: 1 })] },
  // Neugierig
  { situation:'Lumi sieht eine geheimnisvolle Kiste. Was ist da wohl drin? 📦', emotion:'Neugierig',
    explain:'Wenn wir etwas herausfinden wollen, sind wir neugierig!',
    cast:[t('📦', 380, 'shake', { s: 120, d: 0.6 })] },
  { situation:'Lumi findet im Sand eine glitzernde Muschel. Ob da etwas drin ist? 🐚', emotion:'Neugierig',
    explain:'Wenn wir etwas Neues entdecken, sind wir neugierig!',
    lumi:{ act: 'in' }, cast:[t('🐚', 340, 'pop', { s: 80, d: 1 }), t('✨', 370, 'bob', { s: 44, y: 70, d: 1.4 })] },
  { situation:'Im Garten liegt ein kleines Kästchen mit einem Schloss. 🔒', emotion:'Neugierig',
    explain:'Geheimnisse machen uns neugierig!',
    cast:[t('🌷', 480, 'pop', { s: 80 }), t('📦', 360, 'pop', { s: 90, d: 0.6 }), t('🔒', 360, 'drop', { s: 44, y: 30, d: 1.2, z: 3 })] },
  { situation:'Mama und Papa tuscheln. Als Lumi hereinkommt, hören sie schnell auf. 🤫', emotion:'Neugierig',
    explain:'Wenn etwas geheim ist, sind wir neugierig!',
    lumi:{ act: 'in', d: 1 }, cast:[kid('👩', 400, 'none', { s: 130 }), kid('👨', 510, 'none', { s: 140, flip: true }), t('🎁', 460, 'pop', { s: 50, y: 150, d: 0.3 })] },
]

// ─── Voice audio ─────────────────────────────────────────────────────────────
const GEF = 'audio/gefuehlswelt/'
const EMOTION_AUDIO = {
  'Glücklich':    'lumi-war-gluecklich',
  'Traurig':      'lumi-war-traurig',
  'Wütend':       'lumi-war-wuetend',
  'Ängstlich':    'lumi-war-aengstlich',
  'Aufgeregt':    'lumi-war-aufgeregt',
  'Müde':         'lumi-war-muede',
  'Verlegen':     'lumi-war-verlegen',
  'Dankbar':      'lumi-war-dankbar',
  'Überrascht':   'lumi-war-ueberrascht',
  'Stolz':        'lumi-war-stolz',
  'Gelangweilt':  'lumi-war-gelangweilt',
  'Eifersüchtig': 'lumi-war-eifersuechtig',
  'Neugierig':    'lumi-war-neugierig',
}
const clip = name => `${GEF}${name}.mp3`

// ─── Levels ──────────────────────────────────────────────────────────────────
// Levels 1-3 used to be identical (five questions, always four choices) and
// so were 4-6. Now each level adds either a choice or a question, and new
// feelings come in at 4 and 7.
const BASIC = ['Glücklich', 'Traurig', 'Wütend', 'Ängstlich', 'Aufgeregt']
const MID   = [...BASIC, 'Müde', 'Verlegen', 'Dankbar']
const ALL   = Object.keys(COPING)
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

const word = e => e.toLowerCase()
const plain = s => s.replace(/\s*\p{Extended_Pictographic}️?/gu, '').trim()
const faceOf = s => s.split(' ').pop()

const GO = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }
const LUMI_X = 170

export default function EmotionGame({ level = 1, onComplete }) {
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1]
  const [challenges] = useState(() =>
    pickRounds(SCENARIOS.filter(s => cfg.feelings.includes(s.emotion)), cfg.rounds)
      .map(s => ({ ...s, options: choicesFor(s, cfg.feelings, cfg.options) })),
  )
  const [idx,       setIdx]       = useState(0)
  // pick (hand Lumi a face) → explain (Lumi makes it, the explanation is
  // spoken) → strength → coping → done (next round by itself) → summary
  const [phase,     setPhase]     = useState('pick')
  const [lumiFeel,  setLumiFeel]  = useState('neutral')
  const [firstTry,  setFirstTry]  = useState(0)
  const [intensity, setIntensity] = useState(1)
  const [coping,    setCoping]    = useState(null)
  const [mirror,    setMirror]    = useState(false)
  const [after, cancel] = useAfter()
  const [bursts, burst] = useBursts()

  const ch = challenges[idx]
  const rec = !!ch?.audio
  const strengths = ch ? INTENSITY[ch.emotion] : []
  const helps = ch ? COPING[ch.emotion] : []
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600

  useEffect(() => () => stopNarration(), [])

  // Every question is spoken: the situation and then the question itself.
  const askAgain = () => {
    if (phase === 'strength') return sayStrength()
    if (phase === 'coping') return sayCoping()
    narrate(rec
      ? [{ src: clip(ch.audio[0]), text: ch.situation }, { src: clip('wie-fuehlt-sich-lumi-wohl'), text: 'Wie fühlt sich Lumi wohl?', gap: 250 }]
      : [{ text: ch.situation }, { text: 'Wie fühlt sich Lumi wohl?', gap: 250 }])
  }
  useEffect(() => {
    if (!ch) return
    lockPreviews()
    askAgain()
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const sayStrength = () => narrate([{ text: 'Wie stark ist das Gefühl?' }, ...strengths.map(s => ({ text: plain(s), gap: 300 }))])
  const sayCoping = () => narrate([{ text: 'Was hilft Lumi jetzt? Alles davon ist gut.' }, ...helps.map(c => ({ text: c.t, gap: 300 }))])

  // Only the first answer counts, and there is no second one: Lumi tries the
  // face that was handed over, and if another one fits better, Lumi shakes
  // it off and makes that one. The old retry made every question a sure
  // point on the second go ("13 von 12 richtig") (EMO-01/02).
  const giveFace = (emotion, el) => {
    const ok = emotion === ch.emotion
    setPhase('explain')
    setLumiFeel(FEEL[emotion])
    if (ok) { setFirstTry(n => n + 1); burst(el ?? { x: innerWidth / 2, y: innerHeight / 2 }, 'stars') }
    const lumiIs = `Lumi ist ${ok ? '' : 'eher '}${word(ch.emotion)}.`
    const speak = () => {
      if (rec) {
        announce(ok ? 'right' : 'wrong')
        narrate([
          ok && { src: clip('genau-richtig'), text: 'Genau richtig!' },
          { src: clip(EMOTION_AUDIO[ch.emotion]), text: lumiIs, gap: ok ? 200 : 0 },
          { src: clip(ch.audio[1]), text: ch.explain, gap: 200 },
        ])
      } else if (ok) sayRight(`${lumiIs} ${ch.explain}`)
      else sayWrong(`Ich glaube, ${lumiIs} ${ch.explain}`)
      after(() => { setPhase('strength'); lockPreviews(); sayStrength() }, 300)
    }
    // a miss: the explanation starts once Lumi has switched faces
    if (ok) speak()
    else after(() => { sfx.boing(); setLumiFeel(FEEL[ch.emotion]); speak() }, 1100, { quiet: false })
  }

  const giveStrength = (i) => {
    setIntensity(i)
    setPhase('coping')
    lockPreviews()
    narrate([{ text: `Lumi ist ${plain(strengths[i])}.` }, { text: 'Was hilft Lumi jetzt? Alles davon ist gut.', gap: 300 }, ...helps.map(c => ({ text: c.t, gap: 300 }))])
  }

  const giveCoping = (i, el) => {
    setCoping(i)
    setPhase('done')
    setMirror(false)
    sfx.sparkle()
    burst(el ?? { x: innerWidth / 2, y: innerHeight / 2 }, 'hearts')
    setLumiFeel(BRIGHT.has(ch.emotion) ? FEEL[ch.emotion] : 'calm')
    narrate([{ text: `${helps[i].t}, das ist eine gute Idee!` }])
    after(next, 700)
  }

  const next = () => {
    if (idx + 1 >= challenges.length) {
      setPhase('summary')
      sfx.tada()
      narrate([{ text: `Das hast du gelernt! Du hast ${sayNumber(firstTry)} von ${sayNumber(challenges.length)} Gefühlen gleich richtig erkannt.` }])
    } else {
      setIdx(i => i + 1); setPhase('pick'); setLumiFeel('neutral'); setIntensity(1); setCoping(null)
    }
  }

  // What reaches Lumi: a face, a strength or something that helps
  const onDrop = (d) => {
    const el = document.querySelector('[data-lumi-target]')
    if (d.kind === 'face' && phase === 'pick') giveFace(d.feeling, el)
    else if (d.kind === 'strength' && phase === 'strength') giveStrength(d.i)
    else if (d.kind === 'help' && phase === 'coping') giveCoping(d.i, el)
    else return false
    return true
  }

  // The optional mirror: make the face too. Never rated.
  const openMirror = () => {
    cancel()
    setMirror(true)
    narrate([{ text: `Mach das Gesicht auch! So sieht ${word(ch.emotion)} aus.` }])
    after(() => setMirror(false), 2600)
  }

  // Every feeling of this round, once each, for the summary
  const met = useMemo(() => [...new Set(challenges.map(c => c.emotion))], [challenges])

  if (!ch) return null

  if (phase === 'summary') return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 18, padding: '16px' }}>
      <FeelLumi feel="excited" size={narrow ? 130 : 170} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center', maxWidth: 640 }}>
        {met.map((e, i) => (
          <motion.button key={e} initial={{ scale: 0, y: 30 }} animate={{ scale: 1, y: 0 }} transition={{ delay: 0.15 * i, type: 'spring', stiffness: 300 }}
            onClick={() => narrate([{ text: e }])} aria-label={e}
            style={{ all: 'unset', cursor: 'pointer' }}>
            <FaceChip feeling={e} size={narrow ? 46 : 60} />
          </motion.button>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.94 }}
        onClick={() => onComplete(result(firstTry, challenges.length))}
        style={{ ...GO, padding: '14px 48px', fontSize: 22, minHeight: 60 }}>Fertig! 🌟</motion.button>
    </div>
  )

  const answered = phase !== 'pick'
  // the tray at the bottom: faces, then strengths, then what helps
  const tray = phase === 'pick' || phase === 'explain'
    ? ch.options.map(e => ({ id: e, data: { kind: 'face', feeling: e }, label: e,
        node: <FaceChip feeling={e} size={narrow ? (ch.options.length > 3 ? 48 : 56) : 70} dim={answered && e !== ch.emotion} glow={answered && e === ch.emotion} /> }))
    : phase === 'strength'
      ? strengths.map((s, i) => ({ id: s, data: { kind: 'strength', i }, label: plain(s), node: <PicChip art={faceOf(s)} size={(narrow ? 38 : 46) + i * 14} label={plain(s)} /> }))
      : helps.map((c, i) => ({ id: c.t, data: { kind: 'help', i }, label: c.t,
          node: <PicChip art={c.i} size={narrow ? 50 : 62} label={c.t} dim={coping != null && coping !== i} /> }))
  const trayOn = phase === 'pick' || phase === 'strength' || phase === 'coping'

  return (
    <DragArea autoTarget="lumi" disabled={!trayOn}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px clamp(10px,3vw,28px) 14px', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 820 }}>
          <div style={{ flex: 1, minWidth: 0 }}><RoundTrail total={challenges.length} done={idx + (phase === 'done' ? 1 : 0)} walker="lumi" goal="🌈" size={narrow ? 34 : 42} /></div>
          <ReplayButton onClick={askAgain} />
        </div>

        <div data-lumi-target style={{ flex: 1, width: '100%', maxWidth: 980, display: 'flex', minHeight: 0, position: 'relative' }}>
          <Stage key={idx} playKey={idx}
            lumi={{ x: LUMI_X, size: 160, feel: lumiFeel, strength: phase === 'pick' || phase === 'explain' ? 1 : intensity, ...ch.lumi, ...(answered ? { say: undefined } : {}) }}
            cast={coping != null ? [...(ch.cast ?? []), { a: helps[coping].i, x: LUMI_X + 110, y: 120, s: 60, act: 'bob' }] : ch.cast}
            fx={ch.fx}
            drop={{ who: 'lumi', id: 'lumi', onDrop, label: 'Lumi' }}
            bubbles={answered ? { lumi: <Art art={FEELING_ICON[ch.emotion]} size={44} /> } : {}}>
            {mirror && <Mirror feel={FEEL[ch.emotion]} onClose={() => { cancel(); setMirror(false) }} />}
          </Stage>
          {(phase === 'strength' || phase === 'coping') && !mirror && (
            <motion.button initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }} onClick={openMirror}
              aria-label="Spiegel: Mach das Gesicht auch" title="Mach das Gesicht auch!"
              style={{ position: 'absolute', right: 4, top: 4, width: 64, height: 64, borderRadius: '50%', border: '3px solid #2a1b3d', background: '#e9f6ff', boxShadow: '0 4px 0 rgba(42,27,61,.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Art art="🪞" size={42} />
            </motion.button>
          )}
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: narrow ? 14 : 16, color: INK, textAlign: 'center', margin: 0, maxWidth: 620,
          background: 'rgba(255,253,247,.7)', borderRadius: 14, padding: '4px 12px' }}>{plain(ch.situation)}</p>

        {/* clipped: the tray sliding in must not count as content height
            for the FitBox around the game */}
        <div style={{ overflow: 'clip', overflowClipMargin: 12, paddingTop: 10, width: '100%', display: 'flex', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          <motion.div key={`${idx}-${phase === 'explain' ? 'pick' : phase === 'done' ? 'coping' : phase}`}
            initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            style={{ display: 'flex', gap: narrow ? 8 : 16, justifyContent: 'center', alignItems: 'flex-end', flexWrap: 'nowrap',
              padding: '10px 14px', borderRadius: 28, background: 'rgba(255,253,247,.55)', minHeight: narrow ? 108 : 128 }}>
            {tray.map(it => (
              <Draggable key={it.id} id={it.id} data={it.data} label={it.label} disabled={!trayOn}>{it.node}</Draggable>
            ))}
          </motion.div>
        </AnimatePresence>
        </div>
      </div>
      {bursts}
    </DragArea>
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
