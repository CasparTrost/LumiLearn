import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayRight } from '../lib/feedback.js'
import { sayNumber } from '../tts.js'
import { result } from '../lib/score.js'
import { FEELING_ICON, BRIGHT, shuffle } from './feelings.js'
import { INK, pxCard, pxPanel, pxBubble, pxButton, pxSegment } from './px.js'

/**
 * Gefühlswelt — Emotionale Intelligenz
 * Scientific basis:
 *   • CASEL Framework (Brackett & Rivers, 2014) — emotional literacy is foundational
 *     to academic achievement, social relationships, and mental health.
 *   • RULER Approach (Yale Center for Emotional Intelligence) — Recognizing, Understanding,
 *     Labeling, Expressing, Regulating emotions.
 *   • Theory of Mind (Baron-Cohen) — labeling emotions in others builds empathy.
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

// `audio`: [situation, explanation] as recordings in audio/gefuehlswelt/.
// Only where both match the text word for word — a situation spoken in the
// recorded voice and explained by the speech synthesis sounded like two
// people (EMO-07), so a question is either recorded throughout or not at all.
const SCENARIOS = [
  // Glücklich
  { situation:'Lumi bekommt ein riesiges Geschenk! 🎁', emotion:'Glücklich',
    explain:'Wenn wir etwas toll finden, fühlen wir uns glücklich! 🌟',
    audio:['lumi-bekommt-ein-riesiges-geschenk', 'wenn-wir-etwas-toll-finden-fuehlen-wir-uns-gluecklich'] },
  { situation:'Lumi gewinnt beim Wettrennen gegen alle anderen! 🏆', emotion:'Glücklich',
    explain:'Wenn wir etwas Tolles schaffen, werden wir ganz glücklich!',
    audio:['lumi-gewinnt-beim-wettrennen-gegen-alle-anderen', 'wenn-wir-etwas-tolles-schaffen-werden-wir-ganz-gluecklich'] },
  { situation:'Lumi trifft nach langer Zeit den besten Freund wieder! 🤗', emotion:'Glücklich',
    explain:'Freunde wiederzusehen macht uns glücklich! 💛',
    audio:['lumi-trifft-nach-langer-zeit-den-besten-freund-wieder', 'freunde-wiederzusehen-macht-uns-gluecklich'] },
  { situation:'Lumi darf heute so lange aufbleiben, wie Lumi möchte! 🌙', emotion:'Glücklich',
    explain:'Wenn wir etwas Besonderes dürfen, sind wir glücklich! 🎉' },
  { situation:'Lumi findet beim Spaziergang einen schönen bunten Stein! 🪨✨', emotion:'Glücklich',
    explain:'Kleine Entdeckungen machen uns glücklich!' },
  { situation:'Es hat geschneit! Lumi darf den ganzen Tag im Schnee spielen. ❄️', emotion:'Glücklich',
    explain:'Wenn wir etwas Schönes erleben, sind wir glücklich!' },
  // Traurig
  { situation:'Lumis Lieblings-Eis fällt auf den Boden … 🍦', emotion:'Traurig',
    explain:'Wenn etwas schiefgeht, das uns wichtig ist, fühlen wir uns traurig.',
    audio:['lumis-lieblings-eis-faellt-auf-den-boden', 'wenn-etwas-schiefgeht-das-uns-wichtig-ist-fuehlen-wir-uns-traurig'] },
  { situation:'Lumis bester Freund zieht in eine andere Stadt … 📦', emotion:'Traurig',
    explain:'Menschen zu vermissen macht uns traurig.',
    audio:['lumis-bester-freund-zieht-in-eine-andere-stadt', 'menschen-zu-vermissen-macht-uns-traurig'] },
  { situation:'Es regnet, und Lumi kann draußen nicht spielen. ☔', emotion:'Traurig',
    explain:'Enttäuschungen können uns traurig machen.',
    audio:['es-regnet-und-lumi-kann-draussen-nicht-spielen', 'enttaeuschungen-koennen-uns-traurig-machen'] },
  { situation:'Das Lieblingsspielzeug von Lumi ist kaputtgegangen. 💔', emotion:'Traurig',
    explain:'Wenn etwas kaputtgeht, das wir lieb haben, sind wir traurig.' },
  { situation:'Lumis Luftballon fliegt davon, hoch in den Himmel. 🎈', emotion:'Traurig',
    explain:'Wenn wir etwas verlieren, das wir mögen, sind wir traurig.' },
  { situation:'Lumi ist nicht zum Geburtstag eingeladen. 💌', emotion:'Traurig',
    explain:'Wenn wir nicht dabei sein dürfen, sind wir traurig.' },
  { situation:'Lumis Sandburg wird von einer Welle weggespült. 🌊', emotion:'Traurig',
    explain:'Wenn etwas kaputtgeht, das wir gebaut haben, sind wir traurig.' },
  { situation:'Lumi muss den schönen Urlaub früher beenden. 🏖️', emotion:'Traurig',
    explain:'Wenn etwas Schönes zu früh vorbei ist, sind wir traurig.' },
  // Wütend
  { situation:'Ein Kind nimmt Lumi einfach das Spielzeug weg!', emotion:'Wütend',
    explain:'Wenn wir uns ungerecht behandelt fühlen, werden wir wütend.',
    audio:['ein-kind-nimmt-lumi-einfach-das-spielzeug-weg', 'wenn-wir-uns-ungerecht-behandelt-fuehlen-werden-wir-wuetend'] },
  { situation:'Jemand hat die Zeichnung von Lumi zerrissen! 😤', emotion:'Wütend',
    explain:'Wenn etwas Wichtiges kaputtgemacht wird, macht uns das wütend.',
    audio:['jemand-hat-die-zeichnung-von-lumi-zerrissen', 'wenn-etwas-wichtiges-kaputt-gemacht-wird-macht-uns-das-wuetend'] },
  { situation:'Lumi steht in der Reihe, und jemand drängelt sich vor! 😠', emotion:'Wütend',
    explain:'Wenn jemand unfair ist, werden wir wütend.' },
  { situation:'Lumi hat lange gemalt, und jemand kritzelt absichtlich darüber! 🎨', emotion:'Wütend',
    explain:'Wenn jemand absichtlich etwas kaputtmacht, werden wir wütend.' },
  { situation:'Lumi wird beim Spielen immer beschummelt! 🎲', emotion:'Wütend',
    explain:'Schummeln macht uns wütend.' },
  { situation:'Niemand hört Lumi zu, obwohl Lumi etwas Wichtiges sagen will. 🗣️', emotion:'Wütend',
    explain:'Wenn uns keiner zuhört, werden wir wütend.' },
  // Ängstlich
  { situation:'Lumi hört mitten in der Nacht ein lautes Geräusch!', emotion:'Ängstlich',
    explain:'Wenn wir etwas nicht kennen und es unerwartet kommt, werden wir ängstlich.',
    audio:['lumi-hoert-mitten-in-der-nacht-ein-lautes-geraeusch', 'wenn-wir-etwas-nicht-kennen-und-es-unerwartet-kommt-werden-wir-aengstl'] },
  { situation:'Lumi soll alleine auf der großen Bühne auftreten. 🎭', emotion:'Ängstlich',
    explain:'Vor einem großen Auftritt haben viele Menschen Angst.',
    audio:['lumi-soll-alleine-auf-der-grossen-buehne-auftreten', 'vor-einem-grossen-auftritt-haben-viele-menschen-angst'] },
  { situation:'Lumi sieht eine riesige Spinne im Zimmer! 🕷️', emotion:'Ängstlich',
    explain:'Dinge, die uns erschrecken, machen uns ängstlich.',
    audio:['lumi-sieht-eine-riesige-spinne-im-zimmer', 'dinge-die-uns-erschrecken-machen-uns-aengstlich'] },
  { situation:'Lumi muss morgen zum Zahnarzt. 🦷', emotion:'Ängstlich',
    explain:'Vor Dingen, die wehtun könnten, haben wir manchmal Angst.' },
  { situation:'Das Licht geht aus, und alles ist stockdunkel! 🌑', emotion:'Ängstlich',
    explain:'Im Dunkeln haben wir manchmal Angst.' },
  { situation:'Lumi hört draußen ein seltsames Kratzen am Fenster. 🪟', emotion:'Ängstlich',
    explain:'Unbekannte Geräusche machen uns ängstlich.' },
  { situation:'Lumi soll im Schwimmbad ins tiefe Becken springen! 🏊', emotion:'Ängstlich',
    explain:'Vor etwas Neuem und Schwierigem haben wir oft Angst. Das ist ganz normal!' },
  // Aufgeregt
  { situation:'Morgen ist Lumis mega Geburtstagsparty! 🎉', emotion:'Aufgeregt',
    explain:'Wenn wir uns auf etwas Tolles freuen, sind wir aufgeregt!',
    audio:['morgen-ist-lumis-mega-geburtstagsparty', 'wenn-wir-uns-auf-etwas-tolles-freuen-sind-wir-aufgeregt'] },
  { situation:'Lumi fährt heute zum ersten Mal in den Freizeitpark! 🎡', emotion:'Aufgeregt',
    explain:'Etwas zum ersten Mal erleben macht uns ganz aufgeregt!',
    audio:['lumi-faehrt-heute-zum-ersten-mal-in-den-freizeitpark', 'etwas-zum-ersten-mal-erleben-macht-uns-ganz-aufgeregt'] },
  { situation:'Lumi darf mit Papa zusammen ein Modell bauen! 🏗️', emotion:'Aufgeregt',
    explain:'Mit jemandem etwas Tolles tun dürfen macht uns aufgeregt!',
    audio:['lumi-darf-mit-papa-zusammen-ein-modell-bauen', 'mit-jemandem-etwas-tolles-tun-duerfen-macht-uns-aufgeregt'] },
  { situation:'Lumi fliegt heute zum ersten Mal mit dem Flugzeug! ✈️', emotion:'Aufgeregt',
    explain:'Neue Abenteuer machen uns aufgeregt!' },
  { situation:'Lumi darf heute Abend mit Freunden zelten! ⛺', emotion:'Aufgeregt',
    explain:'Wenn wir etwas Besonderes vorhaben, sind wir aufgeregt!' },
  { situation:'Heute kommt Oma zu Besuch! Lumi schaut immer wieder aus dem Fenster. 🪟', emotion:'Aufgeregt',
    explain:'Wenn wir uns auf etwas Schönes freuen, sind wir aufgeregt!' },
  { situation:'Lumi darf beim großen Kindergartenfest Trommel spielen! 🥁', emotion:'Aufgeregt',
    explain:'Bei etwas Besonderem mitzumachen macht uns aufgeregt!' },
  // Müde
  { situation:'Es ist schon spät am Abend. Lumi hat den ganzen Tag gespielt und gähnt. 🌙', emotion:'Müde',
    explain:'Nach einem langen Tag braucht unser Körper Ruhe. Dann sind wir müde.' },
  { situation:'Lumi hat den ganzen Tag im Garten geholfen. Jetzt fallen Lumi die Augen zu. 🌻', emotion:'Müde',
    explain:'Wenn wir viel gemacht haben, sind wir müde.' },
  { situation:'Lumi hat die ganze Nacht kaum geschlafen. ⭐🌙', emotion:'Müde',
    explain:'Wenn wir zu wenig schlafen, sind wir müde.' },
  { situation:'Nach dem großen Sportfest fallen Lumi die Augen zu. 🏃', emotion:'Müde',
    explain:'Viel Bewegung macht unseren Körper müde.' },
  { situation:'Lumi ist lange im Auto gefahren. Jetzt gähnt Lumi. 🚗', emotion:'Müde',
    explain:'Lange Fahrten machen uns müde.' },
  // Verlegen
  { situation:'Lumi hat aus Versehen ein Glas umgeworfen. Alle schauen! 🥛', emotion:'Verlegen',
    explain:'Wenn uns etwas peinlich ist, fühlen wir uns verlegen.' },
  { situation:'Lumi stolpert in der Turnhalle vor allen Kindern. 😬', emotion:'Verlegen',
    explain:'Wenn vor anderen etwas schiefgeht, sind wir verlegen.' },
  { situation:'Lumi singt laut mit, aber ganz falsch! Alle lachen. 🎤', emotion:'Verlegen',
    explain:'Wenn andere über uns lachen, sind wir oft verlegen.' },
  { situation:'Lumi sagt zur Erzieherin aus Versehen „Mama“! 😬', emotion:'Verlegen',
    explain:'Wenn wir uns vor anderen versprechen, sind wir verlegen.' },
  { situation:'Lumi hatte Spinat zwischen den Zähnen, und alle haben es gesehen! 🥬', emotion:'Verlegen',
    explain:'Peinliche Momente machen uns verlegen.' },
  // Dankbar
  { situation:'Lumis bester Freund teilt seine Schokolade mit Lumi! 🍫', emotion:'Dankbar',
    explain:'Wenn jemand nett zu uns ist, fühlen wir uns dankbar.' },
  { situation:'Oma hat extra Lumis Lieblingskuchen gebacken! 🎂', emotion:'Dankbar',
    explain:'Wenn jemand an uns denkt, sind wir dankbar.' },
  { situation:'Jemand hilft Lumi, den schweren Rucksack zu tragen! 🎒', emotion:'Dankbar',
    explain:'Wenn uns jemand hilft, sind wir dankbar.' },
  { situation:'Lumi ist hingefallen. Die Freundin tröstet Lumi. 🤗', emotion:'Dankbar', near:['Traurig'],
    explain:'Wenn uns jemand tröstet, sind wir dankbar.' },
  { situation:'Papa liest Lumi eine extra lange Geschichte vor! 📖', emotion:'Dankbar',
    explain:'Wenn sich jemand Zeit für uns nimmt, sind wir dankbar.' },
  // Überrascht
  { situation:'Lumi macht die Tür auf, und plötzlich springen alle hervor! 🎊', emotion:'Überrascht',
    explain:'Wenn etwas ganz unerwartet passiert, sind wir überrascht!' },
  { situation:'Lumi schaut aus dem Fenster: Über Nacht ist alles weiß vom Schnee! ❄️', emotion:'Überrascht',
    explain:'Wenn sich etwas auf einmal verändert, sind wir überrascht!' },
  { situation:'Im Paket ist ein riesiger Stoffdrache! 🐉', emotion:'Überrascht',
    explain:'Wenn wir etwas nicht erwartet haben, sind wir überrascht!' },
  { situation:'Auf einmal sagt die Erzieherin: Heute gehen wir in den Zoo! 🦁', emotion:'Überrascht',
    explain:'Unerwartete gute Nachrichten überraschen uns!' },
  { situation:'Lumi findet unter dem Kissen einen Brief von der Zahnfee! 🧚', emotion:'Überrascht',
    explain:'Geheimnisvolle Entdeckungen überraschen uns!' },
  // Stolz
  { situation:'Lumi kann jetzt alleine Fahrrad fahren! 🚲', emotion:'Stolz',
    explain:'Wenn wir etwas Neues schaffen, sind wir stolz auf uns!' },
  { situation:'Lumi kann zum ersten Mal ein ganzes Lied auswendig! 🎵', emotion:'Stolz',
    explain:'Wenn wir etwas Schwieriges lernen, sind wir stolz!' },
  { situation:'Lumi schafft das schwierige Puzzle ganz allein! 🧩', emotion:'Stolz',
    explain:'Wenn wir etwas Schwieriges schaffen, sind wir stolz!' },
  { situation:'Lumi hat das Zimmer ganz alleine aufgeräumt! 🧹', emotion:'Stolz',
    explain:'Wenn wir etwas allein erledigen, sind wir stolz!' },
  { situation:'Lumi bindet zum ersten Mal die Schuhe ganz allein zu! 👟', emotion:'Stolz',
    explain:'Etwas Neues zu können macht uns stolz!' },
  // Gelangweilt
  { situation:'Lumi wartet schon lange beim Arzt. Es gibt nichts zu tun. ⏳', emotion:'Gelangweilt',
    explain:'Wenn nichts passiert, langweilen wir uns.' },
  { situation:'Es regnet den ganzen Tag, und Lumi hat nichts zu tun. 🌧️', emotion:'Gelangweilt',
    explain:'Wenn wir nichts zu tun haben, langweilen wir uns.' },
  { situation:'Im Kino passiert lange gar nichts. Lumi rutscht auf dem Sitz hin und her. 🎬', emotion:'Gelangweilt',
    explain:'Wenn uns etwas nicht interessiert, langweilen wir uns.' },
  // Eifersüchtig
  { situation:'Lumis Bruder darf länger am Tablet spielen als Lumi. 📱', emotion:'Eifersüchtig',
    explain:'Wenn andere etwas haben, das wir auch wollen, werden wir manchmal eifersüchtig.' },
  { situation:'Papa kuschelt mit dem neuen Baby und hat keine Zeit für Lumi. 🍼', emotion:'Eifersüchtig',
    explain:'Wenn jemand anderes die ganze Aufmerksamkeit bekommt, werden wir manchmal eifersüchtig.' },
  { situation:'Die Erzieherin lobt das neue Kind, aber nicht Lumi. 🌟', emotion:'Eifersüchtig',
    explain:'Wenn andere mehr gelobt werden, werden wir manchmal eifersüchtig.' },
  { situation:'Das Eis von Lumis Schwester ist viel größer als Lumis! 🍦', emotion:'Eifersüchtig',
    explain:'Wenn jemand anderes mehr bekommt, werden wir manchmal eifersüchtig.' },
  // Neugierig
  { situation:'Lumi sieht eine geheimnisvolle Kiste. Was ist da wohl drin? 📦', emotion:'Neugierig',
    explain:'Wenn wir etwas herausfinden wollen, sind wir neugierig!' },
  { situation:'Lumi findet im Sand eine glitzernde Muschel. Ob da etwas drin ist? 🐚', emotion:'Neugierig',
    explain:'Wenn wir etwas Neues entdecken, sind wir neugierig!' },
  { situation:'Im Garten liegt ein kleines Kästchen mit einem Schloss. 🔒', emotion:'Neugierig',
    explain:'Geheimnisse machen uns neugierig!' },
  { situation:'Mama und Papa tuscheln. Als Lumi hereinkommt, hören sie schnell auf. 🤫', emotion:'Neugierig',
    explain:'Wenn etwas geheim ist, sind wir neugierig!' },
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

const GO = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }

export default function EmotionGame({ level = 1, onComplete }) {
  const cfg = LEVELS[Math.min(Math.max(level, 1), LEVELS.length) - 1]
  const [challenges] = useState(() =>
    pickRounds(SCENARIOS.filter(s => cfg.feelings.includes(s.emotion)), cfg.rounds)
      .map(s => ({ ...s, options: choicesFor(s, cfg.feelings, cfg.options) })),
  )
  const [idx,       setIdx]       = useState(0)
  // ask → feedback (the explanation is spoken) → strength → coping → done
  const [phase,     setPhase]     = useState('ask')
  const [picked,    setPicked]    = useState(null)
  const [firstTry,  setFirstTry]  = useState(0)
  const [intensity, setIntensity] = useState(null)
  const [coping,    setCoping]    = useState(null)
  const [showWeiter, setShowWeiter] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const waitRef = useRef(null)

  const ch = challenges[idx]
  const rec = !!ch?.audio
  const strengths = ch ? INTENSITY[ch.emotion] : []
  const helps = ch ? COPING[ch.emotion] : []

  // Next step once Lumi has finished talking. The panels used to appear while
  // the explanation was still playing, and the first tap cut it off.
  const whenQuiet = (fn, opts) => {
    waitRef.current?.()
    waitRef.current = afterNarration(fn, { minMs: 250, maxMs: 15000, ...opts })
  }
  useEffect(() => () => { waitRef.current?.(); stopNarration() }, [])

  // Every question is spoken: the situation and then the question itself.
  useEffect(() => {
    if (!ch) return
    lockPreviews()
    narrate(rec
      ? [{ src: clip(ch.audio[0]), text: ch.situation }, { src: clip('wie-fuehlt-sich-lumi-wohl'), text: 'Wie fühlt sich Lumi wohl?', gap: 250 }]
      : [{ text: ch.situation }, { text: 'Wie fühlt sich Lumi wohl?', gap: 250 }])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Only the first answer counts, and there is no second one: after a pick
  // Lumi says which feeling fits and why, and the round goes on with it. The
  // old retry made every question a sure point on the second go ("13 von 12
  // richtig") and a stray timer reset the right answer (EMO-01/02).
  const pick = (emotion) => {
    if (phase !== 'ask') return
    const ok = emotion === ch.emotion
    setPicked(emotion)
    setPhase('feedback')
    if (ok) setFirstTry(n => n + 1)
    const lumiIs = `Lumi ist ${ok ? '' : 'eher '}${word(ch.emotion)}.`
    if (rec) {
      narrate([
        ok && { src: clip('genau-richtig'), text: 'Genau richtig!' },
        { src: clip(EMOTION_AUDIO[ch.emotion]), text: lumiIs, gap: ok ? 200 : 0 },
        { src: clip(ch.audio[1]), text: ch.explain, gap: 200 },
      ])
    } else if (ok) {
      sayRight(`${lumiIs} ${ch.explain}`)
    } else {
      narrate([{ text: `Hm, ich glaube, ${lumiIs} ${ch.explain}` }])
    }
    whenQuiet(() => {
      setPhase('strength')
      lockPreviews()
      narrate([{ text: 'Wie stark ist das Gefühl?' }, ...strengths.map(s => ({ text: s, gap: 300 }))])
    })
  }

  const pickStrength = (i) => {
    if (phase !== 'strength') return
    setIntensity(i)
    setPhase('coping')
    lockPreviews()
    narrate([{ text: 'Was hilft Lumi jetzt? Alles davon ist gut.' }, ...helps.map(c => ({ text: c.t, gap: 300 }))])
  }

  const pickCoping = (i) => {
    if (phase !== 'coping') return
    setCoping(i)
    setPhase('done')
    narrate([{ text: `Lumi ist ${plain(strengths[intensity])}. ${helps[i].t}, das ist eine gute Idee!` }])
    whenQuiet(() => setShowWeiter(true), { minMs: 150 })
  }

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= challenges.length) {
      setShowSummary(true)
      narrate([{ text: `Das hast du gelernt! Du hast ${sayNumber(firstTry)} von ${sayNumber(challenges.length)} Gefühlen gleich richtig erkannt.` }])
    } else {
      setIdx(i => i + 1); setPicked(null); setPhase('ask'); setIntensity(null); setCoping(null)
    }
  }

  // Every feeling of this round, once each, for the summary card
  const met = useMemo(() => [...new Set(challenges.map(c => c.emotion))], [challenges])

  if (!ch) return null

  const answered = phase !== 'ask'
  // After the answer only the chosen and the fitting feeling stay — room for
  // the explanation without shrinking the whole screen
  const shown = answered ? ch.options.filter(e => e === ch.emotion || e === picked) : ch.options
  const cols = shown.length === 4 ? 2 : shown.length
  const bubble = !answered ? 'Wie fühlt sich Lumi wohl? 🤔'
    : picked === ch.emotion ? `Genau! Lumi ist ${word(ch.emotion)}. 🌟`
    : `Lumi ist hier eher ${word(ch.emotion)}.`

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(12px,2vw,20px)',
    }}>

      {/* Progress dots */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
        {challenges.map((_, i) => (
          <motion.div key={i}
            animate={{ scale: i === idx ? 1.4 : 1 }}
            style={{
              ...pxSegment(i < idx ? 'done' : i === idx ? 'current' : 'todo'),
              width:14, height:14,
            }}
          />
        ))}
      </div>

      {/* Lumi + question bubble */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={!answered ? 'happy' : BRIGHT.has(ch.emotion) ? 'excited' : 'thinking'} size={84} />
        <div style={{
          flex:1, minWidth:0, ...pxBubble,
          padding:'14px 20px',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(18px,3.8vw,26px)',
          color:'var(--text-primary)',
        }}>
          {bubble}
        </div>
        {phase === 'ask' && (
          <HearOptions items={ch.options} label="Alle Gefühle vorlesen" size={48} />
        )}
      </div>

      {/* Face card + situation */}
      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
          exit={{ scale:0.9, opacity:0 }}
          transition={{ type:'spring', stiffness:280, damping:22 }}
          style={{
            ...pxPanel,
            padding:'clamp(16px,3vw,24px) clamp(18px,5vw,40px)',
            textAlign:'center',
            display:'flex', flexDirection:'column', alignItems:'center', gap:12,
            width:'100%', maxWidth:560,
          }}
        >
          {/* The face only shows after the answer — before, it would give it away */}
          <AnimatePresence mode="wait">
            {answered ? (
              <motion.div
                key="face"
                initial={{ scale:0, rotate:-15, opacity:0 }}
                animate={{ scale:1, rotate:0, opacity:1 }}
                transition={{ type:'spring', stiffness:320, damping:18 }}
                // smaller than the blank face: the explanation and the next
                // steps need the room
                style={{ fontSize:56, lineHeight:1 }}
              >
                {FEELING_ICON[ch.emotion]}
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity:0 }} animate={{ opacity:1 }}
                style={{ fontSize:'clamp(64px,14vw,96px)', lineHeight:1, filter:'grayscale(1) opacity(0.15)' }}
              >🙂</motion.div>
            )}
          </AnimatePresence>
          <p style={{
            fontFamily:'var(--font-body)', fontWeight:600,
            fontSize:'clamp(17px,3.6vw,22px)',
            color:'var(--text-primary)', lineHeight:1.4,
            maxWidth:440,
          }}>
            {ch.situation}
          </p>

          {phase === 'feedback' && (
            <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
              style={{
                ...pxCard('selected'),
                padding:'10px 16px',
                fontFamily:'var(--font-body)', fontSize:'clamp(15px,3vw,18px)',
                color:'var(--text-primary)', maxWidth:420,
              }}
            >
              {ch.explain}
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* The feelings to choose from — big faces with the word below */}
      {(phase === 'ask' || phase === 'feedback') && (
        <div style={{
          display:'grid', gridTemplateColumns:`repeat(${cols},1fr)`,
          gap:'clamp(10px,2vw,16px)',
          width:'100%', maxWidth: shown.length <= 2 ? 480 : 640,
        }}>
          {shown.map((emotion) => {
            const isRight  = answered && emotion === ch.emotion
            const isChosen = answered && emotion === picked && !isRight
            return (
              <motion.button key={emotion}
                whileHover={!answered ? { scale:1.04 } : {}}
                whileTap={!answered ? { scale:0.96 } : {}}
                onClick={() => pick(emotion)}
                {...hearable(emotion, { enabled: !answered })}
                aria-label={emotion}
                style={{
                  // A feeling is never "wrong": the chosen one stays gold, the
                  // one that fits best turns green
                  ...pxCard(isRight ? 'right' : isChosen ? 'selected' : undefined),
                  padding:'clamp(8px,1.6vw,14px) 8px', minHeight:88,
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
                  cursor: answered ? 'default' : 'pointer',
                }}
              >
                <span style={{ fontSize:'clamp(36px,7vw,48px)', lineHeight:1 }}>
                  {FEELING_ICON[emotion]}
                </span>
                <span style={{
                  fontFamily:'var(--font-heading)',
                  fontSize:'clamp(16px,3.4vw,21px)',
                  color:'var(--text-primary)', fontWeight:700,
                }}>
                  {emotion}
                </span>
              </motion.button>
            )
          })}
        </div>
      )}

      {/* Named the feeling — now how strong it is and what helps. One step
          after the other, each read aloud, each with its own speaker. */}
      {(phase === 'strength' || phase === 'coping' || phase === 'done') && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            ...pxPanel, padding: '14px clamp(12px,3vw,20px)',
            width: '100%', maxWidth: 560,
            display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
          }}
        >
          {phase === 'strength' ? (
            <>
              <StepTitle hear={strengths}>Wie stark ist das Gefühl?</StepTitle>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {strengths.map((s, i) => (
                  <motion.button key={i}
                    whileTap={{ scale: 0.94 }}
                    onClick={() => pickStrength(i)}
                    {...hearable(plain(s))}
                    style={{
                      ...pxCard(), padding: '8px 14px', minHeight: 52,
                      fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,2.8vw,17px)',
                      cursor: 'pointer', color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {/* the face grows with the strength */}
                    <span style={{ fontSize: 18 + i * 7, lineHeight: 1 }}>{s.split(' ').pop()}</span>
                    {plain(s)}
                  </motion.button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* the strength just picked, as a line — the row of three
                  would make the screen too tall for a phone */}
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: 17, color: 'var(--text-secondary)' }}>
                Lumi ist {strengths[intensity]}
              </div>
              <StepTitle hear={helps.map(c => c.t)}>Was hilft Lumi jetzt?</StepTitle>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {helps.map((c, i) => (
                  <motion.button key={i}
                    whileHover={phase === 'coping' ? { scale: 1.05 } : {}} whileTap={phase === 'coping' ? { scale: 0.94 } : {}}
                    onClick={() => pickCoping(i)}
                    {...hearable(c.t, { enabled: phase === 'coping' })}
                    style={{
                      ...pxCard(coping === i ? 'selected' : undefined), padding: '8px 14px', minHeight: 52,
                      fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,2.8vw,17px)',
                      cursor: phase === 'coping' ? 'pointer' : 'default', color: 'var(--text-primary)',
                      display: 'flex', alignItems: 'center', gap: 7,
                      opacity: phase === 'done' && coping !== i ? 0.55 : 1,
                    }}
                  ><span style={{ fontSize: 22, lineHeight: 1 }}>{c.i}</span>{c.t}</motion.button>
                ))}
              </div>
              {phase === 'coping' && (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--text-secondary)' }}>
                  Alles davon ist gut. Such dir etwas aus. 💛
                </div>
              )}
            </>
          )}
        </motion.div>
      )}

      {showWeiter && (
        <motion.button
          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ type:'spring', stiffness:300 }}
          whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
          onClick={weiterClick}
          {...hearable('Weiter')}
          style={{ ...GO, padding:'14px 40px', fontSize:20, minHeight:56 }}
        >Weiter! →</motion.button>
      )}

      {/* Summary — what was learned, before the level is done */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 400,
              background: 'rgba(255,245,223,0.97)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 18, padding: 'clamp(20px,4vw,40px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(22px,5vw,32px)',
              fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>
              🎉 Das hast du gelernt!
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.2vw,20px)',
              color: 'var(--text-secondary)', textAlign: 'center' }}>
              Du hast {firstTry} von {challenges.length} Gefühlen gleich richtig erkannt!
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
              maxWidth: 560 }}>
              {met.map(emotion => (
                <motion.div key={emotion}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380 }}
                  {...hearable(emotion)}
                  tabIndex={0}
                  style={{
                    ...pxCard(),
                    padding: '10px 18px',
                    display: 'flex', alignItems: 'center', gap: 10,
                  }}
                >
                  <span style={{ fontSize: 32, lineHeight: 1 }}>{FEELING_ICON[emotion]}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 17,
                    fontWeight: 700, color: 'var(--text-primary)' }}>{emotion}</span>
                </motion.div>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={() => onComplete(result(firstTry, challenges.length))}
              style={{
                ...GO,
                padding: 'clamp(12px,2vw,16px) clamp(32px,6vw,56px)',
                fontSize: 'clamp(17px,3.5vw,22px)', minHeight: 56,
                marginTop: 8,
              }}
            >Fertig! 🌟</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// A step's question with its own speaker: on a tablet there is no hover.
function StepTitle({ hear, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.2vw,19px)', color: 'var(--text-primary)' }}>
        {children}
      </div>
      <HearOptions items={[children, ...hear.map(plain)]} label="Frage und Antworten vorlesen" size={48} />
    </div>
  )
}
