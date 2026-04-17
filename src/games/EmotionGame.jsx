import { useState, useCallback, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { voice } from '../voice.js'

/**
 * Gefühlswelt — Emotionale Intelligenz
 * Scientific basis:
 *   • CASEL Framework (Brackett & Rivers, 2014) — emotional literacy is foundational
 *     to academic achievement, social relationships, and mental health.
 *   • RULER Approach (Yale Center for Emotional Intelligence) — Recognizing, Understanding,
 *     Labeling, Expressing, Regulating emotions.
 *   • Theory of Mind (Baron-Cohen) — labeling emotions in others builds empathy.
 */

const SCENARIOS = [
  // Glücklich
  { face:'😄', situation:'Lumi bekommt ein riesiges Geschenk! 🎁',                    emotion:'Glücklich',  lumiMood:'happy',      faceColor:'#FFD93D', decoys:['Traurig','Wütend','Ängstlich'],    explain:'Wenn wir etwas toll finden, fühlen wir uns glücklich! 🌟' },
  { face:'😄', situation:'Lumi gewinnt beim Wettrennen gegen alle anderen! 🏆',       emotion:'Glücklich',  lumiMood:'excited',    faceColor:'#FFD93D', decoys:['Traurig','Verlegen','Müde'],       explain:'Wenn wir etwas Tolles schaffen, werden wir ganz glücklich!' },
  { face:'😄', situation:'Lumi trifft nach langer Zeit den besten Freund wieder! 🤗', emotion:'Glücklich',  lumiMood:'happy',      faceColor:'#FFD93D', decoys:['Traurig','Ängstlich','Wütend'],    explain:'Freunde wiederzusehen macht uns glücklich! 💛' },
  { face:'😄', situation:'Lumi darf heute so lange aufbleiben wie er möchte! 🌙',     emotion:'Glücklich',  lumiMood:'excited',    faceColor:'#FFD93D', decoys:['Müde','Traurig','Verlegen'],       explain:'Unerwartete Freuden machen uns glücklich! 🎉' },
  // Traurig
  { face:'😢', situation:'Lumis Lieblings-Eis fällt auf den Boden... 😿',            emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Glücklich','Wütend','Aufgeregt'],  explain:'Wenn etwas schiefgeht, das uns wichtig ist, fühlen wir uns traurig.' },
  { face:'😢', situation:'Lumis bester Freund zieht in eine andere Stadt... 📦',      emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Wütend','Aufgeregt','Verlegen'],   explain:'Menschen zu vermissen macht uns traurig.' },
  { face:'😢', situation:'Das Lieblingsspielzeug von Lumi ist kaputt gegangen. 💔',   emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Glücklich','Ängstlich','Verlegen'], explain:'Wenn wir etwas Liebgewonnenes verlieren, werden wir traurig.' },
  { face:'😢', situation:'Es regnet und Lumi kann draußen nicht spielen. ☔',         emotion:'Traurig',    lumiMood:'sleepy',     faceColor:'#74B9FF', decoys:['Wütend','Glücklich','Aufgeregt'],  explain:'Enttäuschungen können uns traurig machen.' },
  // Wütend
  { face:'😡', situation:'Ein Kind nimmt Lumi einfach das Spielzeug weg!',           emotion:'Wütend',     lumiMood:'thinking',   faceColor:'#FF6B6B', decoys:['Glücklich','Traurig','Überrascht'], explain:'Wenn wir uns ungerecht behandelt fühlen, werden wir wütend.' },
  { face:'😡', situation:'Jemand hat die Zeichnung von Lumi zerrissen! 😤',          emotion:'Wütend',     lumiMood:'thinking',   faceColor:'#FF6B6B', decoys:['Glücklich','Traurig','Verlegen'],  explain:'Wenn etwas Wichtiges kaputt gemacht wird, macht uns das wütend.' },
  { face:'😡', situation:'Lumi steht in der Reihe und jemand drängelt sich vor! 😠', emotion:'Wütend',     lumiMood:'thinking',   faceColor:'#FF6B6B', decoys:['Traurig','Überrascht','Müde'],     explain:'Unfairheit macht uns wütend.' },
  // Ängstlich  
  { face:'😨', situation:'Lumi hört mitten in der Nacht ein lautes Geräusch!',      emotion:'Ängstlich',  lumiMood:'thinking',   faceColor:'#A29BFE', decoys:['Wütend','Aufgeregt','Glücklich'], explain:'Wenn wir etwas nicht kennen und es unerwartet kommt, werden wir ängstlich.' },
  { face:'😨', situation:'Lumi soll alleine auf der großen Bühne auftreten. 🎭',     emotion:'Ängstlich',  lumiMood:'thinking',   faceColor:'#A29BFE', decoys:['Aufgeregt','Glücklich','Wütend'],  explain:'Vor einem großen Auftritt haben viele Menschen Angst.' },
  { face:'😨', situation:'Lumi sieht eine riesige Spinne im Zimmer! 🕷️',             emotion:'Ängstlich',  lumiMood:'thinking',   faceColor:'#A29BFE', decoys:['Wütend','Traurig','Verlegen'],    explain:'Dinge die uns erschrecken machen uns ängstlich.' },
  // Aufgeregt
  { face:'🤩', situation:'Morgen ist Lumis mega Geburtstagsparty! 🎉',               emotion:'Aufgeregt',  lumiMood:'excited',    faceColor:'#FD79A8', decoys:['Traurig','Wütend','Ängstlich'],   explain:'Wenn wir uns auf etwas Tolles freuen, sind wir aufgeregt!' },
  { face:'🤩', situation:'Lumi fährt heute zum ersten Mal in den Freizeitpark! 🎡',  emotion:'Aufgeregt',  lumiMood:'excited',    faceColor:'#FD79A8', decoys:['Ängstlich','Traurig','Müde'],     explain:'Etwas zum ersten Mal erleben macht uns ganz aufgeregt!' },
  { face:'🤩', situation:'Lumi darf mit Papa zusammen ein Modell bauen! 🏗️',         emotion:'Aufgeregt',  lumiMood:'excited',    faceColor:'#FD79A8', decoys:['Ängstlich','Traurig','Verlegen'], explain:'Mit jemandem etwas Tolles tun dürfen macht uns aufgeregt!' },
  // Müde
  { face:'😴', situation:'Es ist 21 Uhr und Lumi hatte einen langen spielreichen Tag.', emotion:'Müde',    lumiMood:'sleepy',     faceColor:'#B2BEC3', decoys:['Glücklich','Aufgeregt','Wütend'],  explain:'Nach einem langen Tag braucht unser Körper Erholung — dann sind wir müde.' },
  { face:'😴', situation:'Lumi hat den ganzen Tag Lesen geübt. Jetzt fallen die Augen zu. 📚', emotion:'Müde', lumiMood:'sleepy', faceColor:'#B2BEC3', decoys:['Traurig','Ängstlich','Verlegen'], explain:'Viel Konzentration macht uns müde.' },
  // Verlegen
  { face:'😳', situation:'Lumi hat versehentlich ein Glas umgeworfen. Alle schauen!', emotion:'Verlegen', lumiMood:'thinking',   faceColor:'#FFA07A', decoys:['Glücklich','Wütend','Traurig'],   explain:'Wenn uns etwas peinlich ist, fühlen wir uns verlegen.' },
  { face:'😳', situation:'Lumi stolpert vor allen Kindern im Turnsaal. 😬',          emotion:'Verlegen',   lumiMood:'thinking',   faceColor:'#FFA07A', decoys:['Glücklich','Wütend','Aufgeregt'], explain:'Wenn etwas Ungewolltes vor anderen passiert, werden wir verlegen.' },
  // Dankbar
  { face:'🥰', situation:'Lumis bester Freund teilt seine Schokolade! 🍫',           emotion:'Dankbar',    lumiMood:'happy',      faceColor:'#6BCB77', decoys:['Traurig','Ängstlich','Wütend'],   explain:'Wenn jemand nett zu uns ist, fühlen wir uns dankbar.' },
  { face:'🥰', situation:'Oma hat heimlich Lumis Lieblingskuchen gebacken! 🎂',      emotion:'Dankbar',    lumiMood:'happy',      faceColor:'#6BCB77', decoys:['Aufgeregt','Verlegen','Traurig'], explain:'Wenn jemand an uns denkt, sind wir dankbar.' },
  // Überrascht
  { face:'😮', situation:'Plötzlich klingeln alle: "Überraschung!" schreit die Familie! 🎊', emotion:'Überrascht', lumiMood:'excited', faceColor:'#FFB347', decoys:['Glücklich','Ängstlich','Wütend'], explain:'Wenn etwas Unerwartetes passiert, sind wir überrascht!' },
  { face:'😮', situation:'In der Geburtstagskiste ist ein Hund! 🐕',                 emotion:'Überrascht', lumiMood:'excited',    faceColor:'#FFB347', decoys:['Glücklich','Aufgeregt','Dankbar'], explain:'Unerwartete Dinge lassen uns staunen und überraschen!' },
  // Stolz
  { face:'😊', situation:'Lumi kann jetzt alleine Fahrrad fahren! 🚲',               emotion:'Stolz',      lumiMood:'happy',      faceColor:'#44D498', decoys:['Glücklich','Aufgeregt','Traurig'], explain:'Wenn wir etwas Neues schaffen, sind wir stolz auf uns!' },
  { face:'😊', situation:'Lumi hat sein erstes Gedicht auswendig gelernt. 📜',        emotion:'Stolz',      lumiMood:'happy',      faceColor:'#44D498', decoys:['Dankbar','Verlegen','Glücklich'],  explain:'Etwas Schwieriges zu meistern macht uns stolz!' },
  // Gelangweilt
  { face:'😑', situation:'Lumi wartet schon eine Stunde beim Arzt... ⏳',            emotion:'Gelangweilt', lumiMood:'sleepy',    faceColor:'#95A5A6', decoys:['Müde','Traurig','Ängstlich'],      explain:'Wenn nichts Interessantes passiert, werden wir gelangweilt.' },
  // Eifersüchtig
  { face:'😒', situation:'Das Geschwister bekommt mehr Spielzeit als Lumi. 📱',      emotion:'Eifersüchtig', lumiMood:'thinking', faceColor:'#F39C12', decoys:['Wütend','Traurig','Verlegen'],    explain:'Wenn andere etwas haben, das wir auch wollen, können wir eifersüchtig werden.' },
  // Neugierig
  { face:'🤔', situation:'Lumi sieht eine geheimnisvolle Box — was ist da wohl drin? 📦', emotion:'Neugierig', lumiMood:'thinking', faceColor:'#3498DB', decoys:['Aufgeregt','Ängstlich','Glücklich'], explain:'Wenn wir etwas herausfinden wollen, sind wir neugierig!' },
  // Glücklich (extra)
  { face:'😄', situation:'Lumi findet beim Spaziergang einen schönen bunten Stein! 🪨✨',     emotion:'Glücklich',  lumiMood:'happy',    faceColor:'#FFD93D', decoys:['Traurig','Ängstlich','Müde'],      explain:'Kleine überraschende Entdeckungen machen uns glücklich!' },
  { face:'😄', situation:'Lumi darf heute zum ersten Mal alleine einkaufen gehen! 🛍️',        emotion:'Glücklich',  lumiMood:'excited',  faceColor:'#FFD93D', decoys:['Ängstlich','Verlegen','Traurig'],  explain:'Vertrauen geschenkt zu bekommen macht uns glücklich!' },
  { face:'😄', situation:'Lumi schafft das schwierige Puzzle auf Anhieb! 🧩',                 emotion:'Glücklich',  lumiMood:'excited',  faceColor:'#FFD93D', decoys:['Stolz','Überrascht','Aufgeregt'],   explain:'Etwas Schwieriges zu lösen macht uns glücklich!' },
  { face:'😄', situation:'Es schneit und Schule fällt aus! ❄️🎉',                             emotion:'Glücklich',  lumiMood:'excited',  faceColor:'#FFD93D', decoys:['Überrascht','Aufgeregt','Müde'],    explain:'Unerwartete freie Zeit macht uns glücklich!' },
  // Traurig (extra)
  { face:'😢', situation:'Lumis Goldfish schwimmt nicht mehr... 🐟',                          emotion:'Traurig',    lumiMood:'sleepy',   faceColor:'#74B9FF', decoys:['Wütend','Ängstlich','Verlegen'],   explain:'Den Verlust von einem Lebewesen zu erleben macht uns traurig.' },
  { face:'😢', situation:'Lumi wird nicht zum Geburtstag eingeladen. 💌',                     emotion:'Traurig',    lumiMood:'sleepy',   faceColor:'#74B9FF', decoys:['Wütend','Eifersüchtig','Verlegen'], explain:'Ausgeschlossen zu sein macht uns traurig.' },
  { face:'😢', situation:'Lumis Sandburg wird von einer Welle weggespült. 🌊',                emotion:'Traurig',    lumiMood:'sleepy',   faceColor:'#74B9FF', decoys:['Wütend','Überrascht','Ängstlich'],  explain:'Wenn etwas das wir gemacht haben zerstört wird, macht uns das traurig.' },
  { face:'😢', situation:'Lumi muss den besten Urlaub aller Zeiten früher abbrechen. 🏖️',    emotion:'Traurig',    lumiMood:'sleepy',   faceColor:'#74B9FF', decoys:['Wütend','Verlegen','Müde'],         explain:'Schöne Dinge zu früh zu beenden macht uns traurig.' },
  // Wütend (extra)
  { face:'😡', situation:'Lumi hat stundenlang gemalt und jemand schmiert es kaputt! 🎨',     emotion:'Wütend',     lumiMood:'thinking', faceColor:'#FF6B6B', decoys:['Traurig','Verlegen','Überrascht'],  explain:'Wenn jemand unsere Arbeit absichtlich ruiniert, macht uns das wütend.' },
  { face:'😡', situation:'Lumi wird beim Spielen immer beschummelt! 🎲',                      emotion:'Wütend',     lumiMood:'thinking', faceColor:'#FF6B6B', decoys:['Traurig','Überrascht','Ängstlich'], explain:'Betrug macht uns wütend.' },
  { face:'😡', situation:'Lumi wird nicht zugehört obwohl Lumi etwas Wichtiges sagt. 🗣️',   emotion:'Wütend',     lumiMood:'thinking', faceColor:'#FF6B6B', decoys:['Traurig','Verlegen','Müde'],         explain:'Nicht ernst genommen zu werden macht uns wütend.' },
  { face:'😡', situation:'Das Eis der Schwester ist viel größer als Lumis! 🍦',               emotion:'Wütend',     lumiMood:'thinking', faceColor:'#FF6B6B', decoys:['Eifersüchtig','Traurig','Verlegen'], explain:'Ungleiche Behandlung macht uns wütend.' },
  // Ängstlich (extra)
  { face:'😨', situation:'Lumi muss morgen zum Zahnarzt. 🦷',                                 emotion:'Ängstlich',  lumiMood:'thinking', faceColor:'#A29BFE', decoys:['Traurig','Müde','Aufgeregt'],       explain:'Vor unbekannten oder schmerzhaften Dingen haben wir Angst.' },
  { face:'😨', situation:'Das Licht geht aus und alles ist stockdunkel! 🌑',                  emotion:'Ängstlich',  lumiMood:'thinking', faceColor:'#A29BFE', decoys:['Überrascht','Wütend','Traurig'],    explain:'Dunkelheit kann uns ängstlich machen.' },
  { face:'😨', situation:'Lumi hört draußen ein seltsames Kratzen an der Fensterscheibe. 👻', emotion:'Ängstlich',  lumiMood:'thinking', faceColor:'#A29BFE', decoys:['Neugierig','Überrascht','Wütend'],  explain:'Unbekannte Geräusche machen uns ängstlich.' },
  { face:'😨', situation:'Lumi soll im Schulschwimmbad ins tiefe Becken springen! 🏊',        emotion:'Ängstlich',  lumiMood:'thinking', faceColor:'#A29BFE', decoys:['Aufgeregt','Traurig','Verlegen'],   explain:'Angst vor dem Unbekannten ist ganz normal!' },
  // Aufgeregt (extra)
  { face:'🤩', situation:'Lumi reist heute zum ersten Mal mit dem Flugzeug! ✈️',              emotion:'Aufgeregt',  lumiMood:'excited',  faceColor:'#FD79A8', decoys:['Ängstlich','Glücklich','Überrascht'], explain:'Neue Abenteuer machen uns aufgeregt!' },
  { face:'🤩', situation:'Lumi darf heute Abend mit Freunden zelten! ⛺',                     emotion:'Aufgeregt',  lumiMood:'excited',  faceColor:'#FD79A8', decoys:['Glücklich','Traurig','Müde'],        explain:'Besondere gemeinsame Erlebnisse machen uns aufgeregt!' },
  { face:'🤩', situation:'Das neue Computerspiel wird heute endlich geliefert! 🎮',            emotion:'Aufgeregt',  lumiMood:'excited',  faceColor:'#FD79A8', decoys:['Glücklich','Ungeduldig','Neugierig'], explain:'Auf etwas Lang-Ersehntes warten macht uns aufgeregt!' },
  { face:'🤩', situation:'Lumi darf beim großen Schulkonzert mitspielen! 🎵',                 emotion:'Aufgeregt',  lumiMood:'excited',  faceColor:'#FD79A8', decoys:['Ängstlich','Stolz','Glücklich'],     explain:'Bei etwas Besonderem dabei zu sein macht uns aufgeregt!' },
  // Müde (extra)
  { face:'😴', situation:'Lumi hat die ganze Nacht kaum geschlafen. ⭐🌙',                    emotion:'Müde',       lumiMood:'sleepy',   faceColor:'#B2BEC3', decoys:['Traurig','Gelangweilt','Ängstlich'], explain:'Schlafmangel macht uns müde.' },
  { face:'😴', situation:'Nach dem großen Sportfest fallen Lumi die Augen zu. 🏃',            emotion:'Müde',       lumiMood:'sleepy',   faceColor:'#B2BEC3', decoys:['Glücklich','Traurig','Verlegen'],    explain:'Viel Bewegung macht unseren Körper müde.' },
  { face:'😴', situation:'Lumi hat stundenlang im Auto gesessen. 🚗',                          emotion:'Müde',       lumiMood:'sleepy',   faceColor:'#B2BEC3', decoys:['Gelangweilt','Traurig','Ängstlich'], explain:'Langes Sitzen und Nichtstun macht uns müde.' },
  // Verlegen (extra)
  { face:'😳', situation:'Lumi singt laut mit — aber falsch! Alle lachen. 🎤',                emotion:'Verlegen',   lumiMood:'thinking', faceColor:'#FFA07A', decoys:['Traurig','Wütend','Aufgeregt'],      explain:'Wenn wir uns blamieren, fühlen wir uns verlegen.' },
  { face:'😳', situation:'Lumi nennt die Lehrerin aus Versehen "Mama"! 😬',                   emotion:'Verlegen',   lumiMood:'thinking', faceColor:'#FFA07A', decoys:['Glücklich','Traurig','Überrascht'],  explain:'Versehentliche Fehler vor anderen machen uns verlegen.' },
  { face:'😳', situation:'Lumi hat Spinat in den Zähnen — und hat es erst nach dem Essen gemerkt! 🥬', emotion:'Verlegen', lumiMood:'thinking', faceColor:'#FFA07A', decoys:['Glücklich','Wütend','Traurig'], explain:'Peinliche Momente machen uns verlegen.' },
  // Dankbar (extra)
  { face:'🥰', situation:'Jemand hilft Lumi den schweren Schulranzen zu tragen! 🎒',           emotion:'Dankbar',    lumiMood:'happy',    faceColor:'#6BCB77', decoys:['Glücklich','Überrascht','Verlegen'], explain:'Wenn uns jemand hilft, fühlen wir uns dankbar.' },
  { face:'🥰', situation:'Die Freundin tröstet Lumi als Lumi weint. 🤗',                      emotion:'Dankbar',    lumiMood:'happy',    faceColor:'#6BCB77', decoys:['Traurig','Glücklich','Überrascht'],  explain:'Fürsorge der anderen macht uns dankbar.' },
  { face:'🥰', situation:'Papa liest Lumi eine extra lange Geschichte vor! 📖',                emotion:'Dankbar',    lumiMood:'happy',    faceColor:'#6BCB77', decoys:['Glücklich','Aufgeregt','Stolz'],     explain:'Zeit die jemand für uns nimmt macht uns dankbar.' },
  // Überrascht (extra)
  { face:'😮', situation:'Lumi öffnet das Paket — ein Hoverboard! 🛹',                        emotion:'Überrascht', lumiMood:'excited',  faceColor:'#FFB347', decoys:['Aufgeregt','Glücklich','Dankbar'],   explain:'Unerwartete tolle Dinge überraschen uns!' },
  { face:'😮', situation:'Der Lehrer sagt: Heute kein Unterricht, wir gehen in den Zoo! 🦁',  emotion:'Überrascht', lumiMood:'excited',  faceColor:'#FFB347', decoys:['Aufgeregt','Glücklich','Neugierig'], explain:'Unerwartete gute Nachrichten überraschen uns!' },
  { face:'😮', situation:'Lumi findet unter dem Kissen einen Brief vom Zahnfee! 🧚',           emotion:'Überrascht', lumiMood:'excited',  faceColor:'#FFB347', decoys:['Glücklich','Neugierig','Dankbar'],   explain:'Geheimnisvolle Entdeckungen überraschen uns!' },
  // Stolz (extra)
  { face:'😊', situation:'Lumi gewinnt beim Schulwettbewerb den 1. Platz! 🏆',                emotion:'Stolz',      lumiMood:'happy',    faceColor:'#44D498', decoys:['Glücklich','Aufgeregt','Überrascht'], explain:'Etwas zu gewinnen macht uns stolz!' },
  { face:'😊', situation:'Lumi hat das Zimmer ganz alleine aufgeräumt! 🧹',                   emotion:'Stolz',      lumiMood:'happy',    faceColor:'#44D498', decoys:['Glücklich','Dankbar','Verlegen'],     explain:'Aufgaben selbstständig erledigen macht uns stolz!' },
  { face:'😊', situation:'Lumi liest zum ersten Mal ein ganzes Buch alleine! 📚',             emotion:'Stolz',      lumiMood:'happy',    faceColor:'#44D498', decoys:['Glücklich','Aufgeregt','Überrascht'], explain:'Neue Fähigkeiten zu erreichen macht uns stolz!' },
  // Gelangweilt (extra)
  { face:'😑', situation:'Es regnet den ganzen Tag und Lumi hat nichts zu tun. 🌧️',           emotion:'Gelangweilt', lumiMood:'sleepy',  faceColor:'#95A5A6', decoys:['Traurig','Müde','Ängstlich'],         explain:'Wenn es nichts Spannendes gibt, werden wir gelangweilt.' },
  { face:'😑', situation:'Der Film im Kino ist viel zu lang und langweilig. 🎬',              emotion:'Gelangweilt', lumiMood:'sleepy',  faceColor:'#95A5A6', decoys:['Müde','Traurig','Verlegen'],           explain:'Dinge die uns nicht interessieren lassen uns sich langweilen.' },
  // Eifersüchtig (extra)
  { face:'😒', situation:'Alle spielen mit Mia — aber niemand mit Lumi. 👥',                  emotion:'Eifersüchtig', lumiMood:'thinking', faceColor:'#F39C12', decoys:['Traurig','Wütend','Verlegen'],     explain:'Ausgeschlossen zu werden und andere bevorzugt zu sehen kann Eifersucht wecken.' },
  { face:'😒', situation:'Das neue Kind bekommt mehr Lob vom Lehrer als Lumi. 🌟',            emotion:'Eifersüchtig', lumiMood:'thinking', faceColor:'#F39C12', decoys:['Wütend','Traurig','Verlegen'],      explain:'Wenn andere mehr Anerkennung bekommen, können wir eifersüchtig werden.' },
  // Neugierig (extra)
  { face:'🤔', situation:'Lumi findet einen Tunnel im Park — wo führt er hin? 🕳️',            emotion:'Neugierig',  lumiMood:'thinking', faceColor:'#3498DB', decoys:['Aufgeregt','Ängstlich','Überrascht'], explain:'Unbekannte Orte wecken unsere Neugier!' },
  { face:'🤔', situation:'Im Bücherregal steht ein Buch mit einem geheimen Titel. 🔍',        emotion:'Neugierig',  lumiMood:'thinking', faceColor:'#3498DB', decoys:['Aufgeregt','Überrascht','Glücklich'], explain:'Geheimnisse und Rätsel machen uns neugierig!' },
  { face:'🤔', situation:'Lumi hört Mama und Papa tuscheln und schnell aufhören wenn Lumi reinkommt. 🤫', emotion:'Neugierig', lumiMood:'thinking', faceColor:'#3498DB', decoys:['Ängstlich','Überrascht','Verlegen'], explain:'Geheimnisse um uns herum machen uns neugierig!' },
]

const EMOTION_ICON = {
  'Glücklich':'😄', 'Traurig':'😢',       'Wütend':'😡',       'Ängstlich':'😨',
  'Aufgeregt':'🤩', 'Müde':'😴',          'Verlegen':'😳',     'Dankbar':'🥰',
  'Überrascht':'😮','Stolz':'😊',          'Gelangweilt':'😑', 'Eifersüchtig':'😒',
  'Neugierig':'🤔',
}

// ─── Voice audio ─────────────────────────────────────────────────────────────
const GEF = 'audio/gefuehlswelt/'
const EMOTION_AUDIO = {
  'Glücklich':    GEF + 'lumi-war-gluecklich.mp3',
  'Traurig':      GEF + 'lumi-war-traurig.mp3',
  'Wütend':       GEF + 'lumi-war-wuetend.mp3',
  'Ängstlich':    GEF + 'lumi-war-aengstlich.mp3',
  'Aufgeregt':    GEF + 'lumi-war-aufgeregt.mp3',
  'Müde':         GEF + 'lumi-war-muede.mp3',
  'Verlegen':     GEF + 'lumi-war-verlegen.mp3',
  'Dankbar':      GEF + 'lumi-war-dankbar.mp3',
  'Überrascht':   GEF + 'lumi-war-ueberrascht.mp3',
  'Stolz':        GEF + 'lumi-war-stolz.mp3',
  'Gelangweilt':  GEF + 'lumi-war-gelangweilt.mp3',
  'Eifersüchtig': GEF + 'lumi-war-eifersuechtig.mp3',
  'Neugierig':    GEF + 'lumi-war-neugierig.mp3',
}

// [situationAudio, explainAudio] parallel to SCENARIOS — null where no file exists
const SCENARIO_AUDIO = [
  [GEF+'lumi-bekommt-ein-riesiges-geschenk.mp3',           GEF+'wenn-wir-etwas-toll-finden-fuehlen-wir-uns-gluecklich.mp3'],
  [GEF+'lumi-gewinnt-beim-wettrennen-gegen-alle-anderen.mp3', GEF+'wenn-wir-etwas-tolles-schaffen-werden-wir-ganz-gluecklich.mp3'],
  [GEF+'lumi-trifft-nach-langer-zeit-den-besten-freund-wieder.mp3', GEF+'freunde-wiederzusehen-macht-uns-gluecklich.mp3'],
  [GEF+'lumi-darf-heute-so-lange-aufbleiben-wie-er-moechte.mp3', GEF+'unerwartete-freuden-machen-uns-gluecklich.mp3'],
  [GEF+'lumis-lieblings-eis-faellt-auf-den-boden.mp3',     GEF+'wenn-etwas-schiefgeht-das-uns-wichtig-ist-fuehlen-wir-uns-traurig.mp3'],
  [GEF+'lumis-bester-freund-zieht-in-eine-andere-stadt.mp3', GEF+'menschen-zu-vermissen-macht-uns-traurig.mp3'],
  [GEF+'das-lieblingsspielzeug-von-lumi-ist-kaputt-gegangen.mp3', GEF+'wenn-wir-etwas-liebgewonnenes-verlieren-werden-wir-traurig.mp3'],
  [GEF+'es-regnet-und-lumi-kann-draussen-nicht-spielen.mp3', GEF+'enttaeuschungen-koennen-uns-traurig-machen.mp3'],
  [GEF+'ein-kind-nimmt-lumi-einfach-das-spielzeug-weg.mp3', GEF+'wenn-wir-uns-ungerecht-behandelt-fuehlen-werden-wir-wuetend.mp3'],
  [GEF+'jemand-hat-die-zeichnung-von-lumi-zerrissen.mp3',   GEF+'wenn-etwas-wichtiges-kaputt-gemacht-wird-macht-uns-das-wuetend.mp3'],
  [GEF+'lumi-steht-in-der-reihe-und-jemand-draengelt-sich-vor.mp3', GEF+'unfairheit-macht-uns-wuetend.mp3'],
  [GEF+'lumi-hoert-mitten-in-der-nacht-ein-lautes-geraeusch.mp3', GEF+'wenn-wir-etwas-nicht-kennen-und-es-unerwartet-kommt-werden-wir-aengstl.mp3'],
  [GEF+'lumi-soll-alleine-auf-der-grossen-buehne-auftreten.mp3', GEF+'vor-einem-grossen-auftritt-haben-viele-menschen-angst.mp3'],
  [GEF+'lumi-sieht-eine-riesige-spinne-im-zimmer.mp3',      GEF+'dinge-die-uns-erschrecken-machen-uns-aengstlich.mp3'],
  [GEF+'morgen-ist-lumis-mega-geburtstagsparty.mp3',        GEF+'wenn-wir-uns-auf-etwas-tolles-freuen-sind-wir-aufgeregt.mp3'],
  [GEF+'lumi-faehrt-heute-zum-ersten-mal-in-den-freizeitpark.mp3', GEF+'etwas-zum-ersten-mal-erleben-macht-uns-ganz-aufgeregt.mp3'],
  [GEF+'lumi-darf-mit-papa-zusammen-ein-modell-bauen.mp3',  GEF+'mit-jemandem-etwas-tolles-tun-duerfen-macht-uns-aufgeregt.mp3'],
  [GEF+'es-ist-21-uhr-und-lumi-hatte-einen-langen-spielreichen-tag.mp3', GEF+'nach-einem-langen-tag-braucht-unser-koerper-erholung-dann-sind-wir-mue.mp3'],
  [null, null], // Müde: Lesen geübt
  [null, null], // Verlegen: Glas umgeworfen
  [null, null], // Verlegen: stolpert
  [null, null], // Dankbar: Schokolade
  [null, null], // Dankbar: Kuchen
  [null, null], // Überrascht: Überraschungsparty
  [null, null], // Überrascht: Hund in der Kiste
  [null, null], // Stolz: Fahrrad
  [null, null], // Stolz: Gedicht
  [null, null], // Gelangweilt: Arzt
  [null, null], // Eifersüchtig: Geschwister
  [null, null], // Neugierig: geheimnisvolle Box
]

const EMOTION_PASTEL = {
  'Glücklich':'#FFFBEA','Traurig':'#EFF6FF','Wütend':'#FFF0F0','Ängstlich':'#F3F0FF',
  'Aufgeregt':'#FFF0F8','Müde':'#F5F5F5','Verlegen':'#FFF4EE','Dankbar':'#F0FAF2',
  'Überrascht':'#FFF8EE','Stolz':'#EDFAF3','Gelangweilt':'#F7F7F7',
  'Eifersüchtig':'#FFF9EE','Neugierig':'#EFF8FF',
}

function speakDE(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.82; u.pitch = 1.05
  window.speechSynthesis.speak(u)
}

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Shuffle but never put same emotion twice in a row
function shuffleNoRepeat(arr) {
  const s = shuffle(arr)
  for (let i = 1; i < s.length; i++) {
    if (s[i].emotion === s[i-1].emotion) {
      // find next different
      const j = s.findIndex((x, k) => k > i && x.emotion !== s[i-1].emotion)
      if (j > -1) { const tmp = s[i]; s[i] = s[j]; s[j] = tmp }
    }
  }
  return s
}

export default function EmotionGame({ level = 1, onComplete }) {
  const BASIC = ['Glücklich','Traurig','Wütend','Ängstlich','Aufgeregt']
  const MID   = [...BASIC,'Müde','Verlegen','Dankbar']
  const pool  = level <= 3 ? SCENARIOS.filter(s => BASIC.includes(s.emotion))
              : level <= 6 ? SCENARIOS.filter(s => MID.includes(s.emotion))
              : SCENARIOS
  const qCount = level <= 3 ? 6 : level <= 6 ? 8 : level <= 8 ? 10 : 12
  const [challenges] = useState(() => {
    // Pick max 1 scenario per emotion per session, spread across emotions
    const byEmotion = {}
    pool.forEach(s => { if (!byEmotion[s.emotion]) byEmotion[s.emotion] = []; byEmotion[s.emotion].push(s) })
    // Pick one random scenario per emotion, then shuffle the emotion groups
    const picked = Object.values(byEmotion).map(group => shuffle(group)[0])
    const selected = shuffleNoRepeat(shuffle(picked)).slice(0, qCount)
    return selected.map(s => {
      const ai = SCENARIOS.indexOf(s)
      const [sa, ea] = ai >= 0 ? SCENARIO_AUDIO[ai] : [null, null]
      return { ...s, sa, ea }
    })
  })
  const [idx,        setIdx]      = useState(0)
  const [selected,   setSelected] = useState(null)
  const [correct,    setCorrect]  = useState(0)
  const [showInfo,   setShowInfo] = useState(false)
  const [showWeiter, setShowWeiter] = useState(false)
  const [seenCorrect, setSeenCorrect] = useState([])

  // Stop narration when game unmounts
  useEffect(() => () => voice.stop(), [])

  // Speak the situation when a new scenario appears — use TTS fallback if no audio
  useEffect(() => {
    const ch = challenges[idx]
    if (!ch) return
    if (ch.sa) {
      voice.play(ch.sa)
    } else {
      setTimeout(() => speakDE(ch.situation.replace(/[🎁🤗🌙🏆😿📦💔☔😤😠😨🎭🕷️🎉🎡🏗️⏳📱📦🔍🕳️📖🤫]/gu, '')), 400)
    }
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps // eslint-disable-line react-hooks/exhaustive-deps

  const ch      = challenges[idx]
  // Freeze option order per question — useMemo keyed on idx so it only shuffles when the question changes
  const options = useMemo(() => ch ? shuffle([ch.emotion, ...ch.decoys]) : [], [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pick = useCallback((emotion) => {
    if (selected !== null || !ch) return
    const ok = emotion === ch.emotion
    const nc = correct + (ok ? 1 : 0)
    setSelected(emotion)
    if (ok) { setCorrect(nc); setSeenCorrect(prev => prev.includes(ch.emotion) ? prev : [...prev, ch.emotion]) }
    setShowInfo(true)

    if (ok) {
      voice.chain([EMOTION_AUDIO[ch.emotion], ch.ea])
      setShowWeiter(true)
    } else {
      // Wrong: show explanation 5s, then let them try again
      setTimeout(() => {
        setShowInfo(false)
        setSelected(null)
      }, 5000)
    }
  }, [selected, ch, correct, idx, challenges, onComplete])

  const [showSummary, setShowSummary] = useState(false)
  const [intensity, setIntensity] = useState(1)
  const INTENSITY_MAP = {"Glücklich": ["ein bisschen glücklich 😊", "glücklich 😄", "sehr glücklich 🤩"], "Traurig": ["ein bisschen traurig 🙁", "traurig 😢", "sehr traurig 😭"], "Wütend": ["ein bisschen genervt 😒", "wütend 😡", "sehr wütend 🤬"], "Ängstlich": ["ein bisschen mulmig 😬", "ängstlich 😨", "sehr ängstlich 😱"], "Aufgeregt": ["ein bisschen aufgeregt 🙂", "aufgeregt 🤩", "sehr aufgeregt 🥳"], "Müde": ["ein bisschen müde 😑", "müde 😴", "sehr müde 🥱"], "Verlegen": ["ein bisschen verlegen 😳", "verlegen 🫣", "sehr verlegen 🙈"], "Dankbar": ["ein bisschen dankbar 🙂", "dankbar 🥰", "sehr dankbar 🫶"], "Überrascht": ["ein bisschen überrascht 😮", "überrascht 😲", "sehr überrascht 🤯"], "Stolz": ["ein bisschen stolz 😊", "stolz 🦁", "sehr stolz 🏆"], "Gelangweilt": ["ein bisschen gelangweilt 😑", "gelangweilt 😶", "sehr gelangweilt 🥱"], "Eifersüchtig": ["ein bisschen eifersüchtig 😒", "eifersüchtig 😤", "sehr eifersüchtig 😾"], "Neugierig": ["ein bisschen neugierig 🤔", "neugierig 🧐", "sehr neugierig 🔍"]}

  const weiterClick = useCallback(() => {
    setShowInfo(false)
    setShowWeiter(false)
    if (idx + 1 >= challenges.length) {
      setShowSummary(true) // show emotion card before completing
    } else {
      setIdx(i => i + 1); setSelected(null)
    }
  }, [idx, challenges.length, correct, seenCorrect, onComplete])

  const finishGame = useCallback(() => {
    onComplete({ score: correct, total: challenges.length, seenEmotions: seenCorrect })
  }, [correct, challenges.length, seenCorrect, onComplete])

  if (!ch) return null

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(12px,2vw,22px)',
      background: selected ? (EMOTION_PASTEL[ch.emotion] || 'transparent') : 'transparent',
      transition:'background 0.6s ease',
      borderRadius:20,
    }}>

      {/* Progress dots */}
      <div style={{ display:'flex', gap:8 }}>
        {challenges.map((_, i) => (
          <motion.div key={i}
            animate={{ scale: i === idx ? 1.4 : 1 }}
            style={{
              width:13, height:13, borderRadius:'50%',
              background: i < idx ? '#FD79A8' : i === idx ? '#FFD93D' : '#ECE8FF',
            }}
          />
        ))}
      </div>

      {/* Lumi + question bubble */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:14, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={selected ? ch.lumiMood : 'happy'} size={88} />
        <div style={{
          flex:1, background:'white', borderRadius:'24px 24px 24px 6px',
          padding:'16px 22px',
          boxShadow:'0 4px 24px rgba(253,121,168,0.12)',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(18px,3.8vw,26px)',
          color:'var(--text-primary)',
        }}>
          {selected === null ? 'Wie fühlt sich Lumi wohl? 🤔' : selected === ch.emotion ? 'Genau richtig! 🌟' : `Es war: ${ch.emotion}!`}
        </div>
      </div>

      {/* Face card + situation */}
      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ scale:0.82, opacity:0 }} animate={{ scale:1, opacity:1 }}
          exit={{ scale:0.82, opacity:0 }}
          transition={{ type:'spring', stiffness:280, damping:20 }}
          style={{
            background:'white', borderRadius:30,
            padding:'24px clamp(20px,5vw,44px)',
            boxShadow:`0 10px 36px ${ch.faceColor}35`,
            textAlign:'center',
            display:'flex', flexDirection:'column', alignItems:'center', gap:14,
            width:'100%', maxWidth:520,
          }}
        >
          {/* Face hidden before answer — only revealed after picking */}
          <AnimatePresence mode="wait">
            {selected !== null ? (
              <motion.div
                key="face"
                initial={{ scale:0, rotate:-15, opacity:0 }}
                animate={{ scale:1, rotate:0, opacity:1 }}
                transition={{ type:'spring', stiffness:320, damping:18 }}
                style={{ fontSize:'clamp(70px,16vw,104px)', lineHeight:1 }}
              >
                {ch.face}
              </motion.div>
            ) : (
              <motion.div
                key="placeholder"
                initial={{ opacity:0 }} animate={{ opacity:1 }}
                style={{ fontSize:'clamp(70px,16vw,104px)', lineHeight:1, filter:'grayscale(1) opacity(0.15)' }}
              >🙂</motion.div>
            )}
          </AnimatePresence>
          <p style={{
            fontFamily:'var(--font-body)',
            fontSize:'clamp(15px,3.5vw,20px)',
            color:'var(--text-secondary)',
            maxWidth:380,
          }}>
            {ch.situation}
          </p>

          {/* Explanation flash */}
          <AnimatePresence>
            {showInfo && (
              <motion.div initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
                style={{
                  background: selected === ch.emotion ? '#E8F8EE' : '#FFF4E5',
                  border: `2px solid ${selected === ch.emotion ? '#6BCB77' : '#FFD93D'}`,
                  borderRadius:16, padding:'10px 16px',
                  fontFamily:'var(--font-body)', fontSize:'clamp(13px,2.8vw,16px)',
                  color:'var(--text-secondary)', maxWidth:360,
                }}
              >
                {ch.explain}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Emotion option grid */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(2,1fr)',
        gap:'clamp(10px,2vw,18px)',
        width:'100%', maxWidth:760,
      }}>
        {options.map((emotion) => {
          const isCorrect = emotion === ch.emotion
          const isChosen  = emotion === selected
          const done      = selected !== null

          let bg     = '#FAFAFF'
          let border = '3px solid #ECE8FF'
          let shadow = '0 4px 16px rgba(108,99,255,0.07)'

          if (done && isCorrect)       { bg='#E8F8EE'; border='3px solid #6BCB77'; shadow='0 6px 24px rgba(107,203,119,0.35)' }
          else if (done && isChosen)   { bg='#FFE8E8'; border='3px solid #FF6B6B' }

          return (
            <motion.button key={emotion}
              whileHover={!done ? { scale:1.04 } : {}}
              whileTap={!done ? { scale:0.97 } : {}}
              onClick={() => pick(emotion)}
              style={{
                padding:'clamp(14px,3vw,22px) clamp(12px,2.5vw,20px)',
                borderRadius:22, background:bg, border, boxShadow:shadow,
                display:'flex', alignItems:'center', gap:14,
                cursor:done ? 'default' : 'pointer',
                transition:'all 0.22s',
              }}
            >
              <span style={{ fontSize:'clamp(28px,6vw,40px)', lineHeight:1 }}>
                {EMOTION_ICON[emotion] ?? '😶'}
              </span>
              <span style={{
                fontFamily:'var(--font-heading)',
                fontSize:'clamp(16px,3.8vw,22px)',
                color:'var(--text-primary)', fontWeight:600,
                flex:1, textAlign:'left',
              }}>
                {emotion}
              </span>
              {done && isCorrect && <span style={{ fontSize:22 }}>✅</span>}
              {done && isChosen && !isCorrect && <span style={{ fontSize:22 }}>❌</span>}
            </motion.button>
          )
        })}
      </div>

      {/* Intensity slider — shown after correct answer */}
      {showWeiter && selected === ch.emotion && (
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'white', borderRadius: 20, padding: '14px 20px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.09)',
            width: '100%', maxWidth: 480,
            display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center',
          }}
        >
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15,
            color: 'var(--text-muted)' }}>Wie stark war das Gefühl?</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
            {[0,1,2].map(i => (
              <motion.button key={i}
                whileTap={{ scale: 0.94 }}
                onClick={() => setIntensity(i)}
                style={{
                  background: intensity === i ? (EMOTION_PASTEL[ch.emotion]||'#EEE') : 'white',
                  border: `2px solid ${intensity === i ? ch.faceColor : '#ECE8FF'}`,
                  borderRadius: 14, padding: '8px 14px',
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(12px,2.5vw,15px)',
                  cursor: 'pointer', color: 'var(--text-primary)',
                  transition: 'all 0.18s',
                }}
              >{(INTENSITY_MAP[ch.emotion]||['gering','mittel','stark'])[i]}</motion.button>
            ))}
          </div>
        </motion.div>
      )}
      {/* Weiter button */}
      {showWeiter && (
        <motion.button
          initial={{ scale:0, opacity:0 }} animate={{ scale:1, opacity:1 }}
          transition={{ type:'spring', stiffness:300, delay:0.3 }}
          whileHover={{ scale:1.06 }} whileTap={{ scale:0.94 }}
          onClick={weiterClick}
          style={{
            background:'linear-gradient(135deg,#FD79A8,#e84393)',
            color:'white', border:'none', borderRadius:20,
            padding:'14px 40px',
            fontFamily:'var(--font-heading)', fontSize:20, fontWeight:700,
            cursor:'pointer', boxShadow:'0 5px 20px rgba(253,121,168,0.45)',
          }}
        >Weiter! →</motion.button>
      )}

      <p style={{ fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-muted)' }}>
        ✅ {correct} von {Math.min(idx + (selected !== null ? 1 : 0), challenges.length)} richtig
      </p>

      {/* Emotion summary overlay */}
      <AnimatePresence>
        {showSummary && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 400,
              background: 'rgba(255,255,255,0.97)',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 18, padding: 'clamp(20px,4vw,40px)',
              overflowY: 'auto',
            }}
          >
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(22px,5vw,32px)',
              fontWeight: 800, color: 'var(--text-primary)', textAlign: 'center' }}>
              🎉 Das hast du gelernt!
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,3vw,18px)',
              color: 'var(--text-muted)', textAlign: 'center' }}>
              Du hast {correct} von {challenges.length} Gefühle richtig erkannt
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center',
              maxWidth: 560 }}>
              {seenCorrect.map(emotion => (
                <motion.div key={emotion}
                  initial={{ scale: 0 }} animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 380 }}
                  style={{
                    background: EMOTION_PASTEL[emotion] || '#F5F5F5',
                    borderRadius: 18, padding: '12px 20px',
                    display: 'flex', alignItems: 'center', gap: 10,
                    boxShadow: '0 3px 12px rgba(0,0,0,0.08)',
                    border: '2px solid rgba(0,0,0,0.07)',
                  }}
                >
                  <span style={{ fontSize: 32 }}>{EMOTION_ICON[emotion]}</span>
                  <span style={{ fontFamily: 'var(--font-heading)', fontSize: 16,
                    fontWeight: 700, color: 'var(--text-primary)' }}>{emotion}</span>
                </motion.div>
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
              onClick={finishGame}
              style={{
                background: 'linear-gradient(135deg,#FD79A8,#e84393)',
                color: 'white', border: 'none', borderRadius: 20,
                padding: 'clamp(12px,2vw,16px) clamp(32px,6vw,56px)',
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(17px,3.5vw,22px)', fontWeight: 700,
                cursor: 'pointer', boxShadow: '0 5px 20px rgba(253,121,168,0.45)',
                marginTop: 8,
              }}
            >Fertig! 🌟</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
// v1776457951
