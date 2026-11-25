// What Lumi says in Gefühlsdetektiv: the script to record, key and text.
// A line is spoken once its key is in LINES (lib/lumiLines.js) and its
// recording exists; until then the game plays without it, and what happens
// on the stage has to carry the case on its own.
import { LINES, line } from '../../lib/lumiLines.js'

export const SCRIPT = {
  // the two questions, the same in every case
  'detektiv/wie-fuehlt':         'Wie fühlt sich das Tier?',
  'detektiv/was-tut-gut':        'Was tut jetzt gut?',

  // what happened: one sentence per case
  'detektiv/eis':                'Dem Hasen ist das Eis runtergefallen.',
  'detektiv/turm':               'Der Turm vom Bären ist umgefallen.',
  'detektiv/gewitter':           'Bei der Maus blitzt und donnert es.',
  'detektiv/geschenk':           'Die Katze bekommt ein Geschenk.',
  'detektiv/allein':             'Die anderen spielen ohne den Hund.',
  'detektiv/bellen':             'Ein großer Hund bellt das Schwein an.',
  'detektiv/stift':              'Dem Fuchs ist der Stift abgebrochen.',
  'detektiv/ballon':             'Der Löwe bekommt einen Luftballon.',
  'detektiv/dunkel':             'Beim Panda ist das Licht ausgegangen.',
  'detektiv/platzen':            'Dem Schwein ist der Luftballon geplatzt.',
  'detektiv/bild':               'Die Katze hat ein Bild fertig gemalt.',
  'detektiv/hochturm':           'Die Maus hat einen hohen Turm gebaut.',
  'detektiv/spaet':              'Der Löwe hat den ganzen Tag gespielt.',
  'detektiv/saft':               'Dem Hund ist der Saft umgekippt.',
  'detektiv/regen':              'Es regnet, und der Bär kann nicht raus.',
  'detektiv/geburtstag':         'Der Hase hat heute Geburtstag.',
  'detektiv/busch':              'Beim Fuchs raschelt etwas im Busch.',

  // what you can do: the name of each picture card
  'detektiv/hilfe-arm':          'In den Arm nehmen.',
  'detektiv/hilfe-teilen':       'Teilen.',
  'detektiv/hilfe-bauen':        'Zusammen neu bauen.',
  'detektiv/hilfe-licht':        'Das Licht anmachen.',
  'detektiv/hilfe-spielen':      'Zusammen spielen.',
  'detektiv/hilfe-mitfreuen':    'Mitfreuen.',
  'detektiv/hilfe-klatschen':    'Klatschen.',
  'detektiv/hilfe-zudecken':     'Zudecken.',
  'detektiv/hilfe-nachschauen':  'Zusammen nachschauen.',
  'detektiv/hilfe-aufwischen':   'Zusammen aufwischen.',
  'detektiv/hilfe-auslachen':    'Auslachen.',
  'detektiv/hilfe-weggehen':     'Weggehen.',
  'detektiv/hilfe-schimpfen':    'Schimpfen.',
}

/** The recording of a script line for narrate(), or null while it is not recorded. */
export const say = key => (LINES[key] ? line(key) : null)
