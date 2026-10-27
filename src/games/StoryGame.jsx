import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { PxIcon } from '../components/PixelUI.jsx'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayRight } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { FEELING_ICON, shuffle } from './feelings.js'
import { INK, ACCENT, pxCard, pxPanel, pxButton } from './px.js'

/**
 * Lumis Abenteuer — Narratives Lernen & Kausaldenken
 * Scientific basis:
 *   • Narrative Cognition (Bruner, 1991) — children understand and remember information
 *     embedded in stories 22x better than isolated facts (Willingham, 2009).
 *   • Causal Reasoning (Gopnik, 2004) — "What happens next?" questions train the
 *     causal inference system, a cornerstone of scientific and logical thinking.
 *   • Social Learning (Bandura, 1977) — character-driven dilemmas build moral reasoning
 *     and perspective-taking (Theory of Mind).
 *   • Choice-based narratives increase intrinsic motivation (self-determination theory).
 *
 * Mechanic: An illustrated mini-story unfolds panel by panel and is read
 * aloud. At a key moment the child picks what Lumi should do. The story
 * continues based on their choice and shows what follows from it.
 *
 * The choice itself is not rated. It used to give three stars for the "good"
 * and two for the "bad" option, which taught "pick the well-behaved answer"
 * rather than weighing anything, and some stories have two good ways. What
 * is rated is understanding: at a turn in the story the child is asked how
 * someone feels (`ask`), and those answers, first try, make the stars.
 */

// tier: 0 = levels 1-3 (short, one clear helper situation), 1 = levels 4-6,
// 2 = levels 7-10 (honesty and promises, harder to weigh). Three stories
// (rain, swing, climbing tower) have two good ways on purpose.
const STORIES = [
  {
    id: 'forest', tier: 0,
    title: 'Lumi im Wald',
    panels: [
      { text: 'Lumi spaziert durch den bunten Herbstwald. 🌲🍂\nPlötzlich hört Lumi ein leises Weinen …', emoji: '🌲', mood: 'thinking' },
      { text: 'Da sitzt ein kleiner Igel. „Ich finde den Weg nach Hause nicht!“', emoji: '🦔', mood: 'encouraging',
        ask: { q: 'Wie fühlt sich der Igel?', who: 'der Igel', feeling: 'Traurig' } },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🤝 Lumi hilft dem Igel, den Weg zu finden', value: 'help' },
        { text: '🏃 Lumi läuft schnell weiter', value: 'run' },
      ],
    },
    outcomes: {
      help: {
        panels: [
          { text: 'Lumi hilft dem Igel. Gemeinsam finden sie den Weg. 🗺️✨', emoji: '🦔❤️', mood: 'happy',
            ask: { q: 'Wie fühlt sich der Igel jetzt?', who: 'der Igel', feeling: 'Glücklich' } },
          { text: '„Danke, Lumi!“ Der Igel schenkt Lumi einen glänzenden Apfel.', emoji: '🍎', mood: 'excited' },
        ],
        lesson: 'Helfen macht froh: den Igel und Lumi!',
      },
      run: {
        panels: [
          { text: 'Lumi läuft weiter … aber der Igel weint immer noch.', emoji: '🦔', mood: 'thinking',
            ask: { q: 'Wie fühlt sich der Igel?', who: 'der Igel', feeling: 'Traurig' } },
          { text: 'Da dreht Lumi um und hilft dem Igel doch noch. Zusammen finden sie den Weg. 🔄', emoji: '🦔❤️', mood: 'encouraging' },
        ],
        lesson: 'Umdrehen und doch noch helfen ist auch gut!',
      },
    },
  },
  {
    id: 'bakery', tier: 0,
    title: 'Der Kuchenladen',
    panels: [
      { text: 'Lumi steht vor dem Kuchenladen. Es riecht nach frischem Kuchen! 🍰', emoji: '🏪', mood: 'happy' },
      { text: 'Lumi hat nur noch eine Münze. Daneben sitzt eine kleine Maus und weint: „Ich habe so großen Hunger!“', emoji: '🐭', mood: 'thinking',
        ask: { q: 'Wie fühlt sich die Maus?', who: 'die Maus', feeling: 'Traurig' } },
    ],
    choice: {
      question: 'Was macht Lumi mit der Münze?',
      options: [
        { text: '🍰 Lumi kauft ein Stück Kuchen und teilt es mit der Maus', value: 'share' },
        { text: '😋 Lumi kauft das Stück Kuchen für sich allein', value: 'keep' },
      ],
    },
    outcomes: {
      share: {
        panels: [
          { text: 'Lumi teilt den Kuchen. Die Maus strahlt: „Danke, Lumi!“ 🎉', emoji: '🐭', mood: 'excited',
            ask: { q: 'Wie fühlt sich die Maus jetzt?', who: 'die Maus', feeling: 'Glücklich' } },
          { text: 'Zusammen schmeckt der Kuchen doppelt so gut!', emoji: '🍰', mood: 'happy' },
        ],
        lesson: 'Teilen macht froh: die Maus und auch Lumi!',
      },
      keep: {
        panels: [
          { text: 'Lumi isst den Kuchen allein. Die Maus schaut zu, und ihr Bauch knurrt.', emoji: '🐭', mood: 'thinking',
            ask: { q: 'Wie fühlt sich die Maus?', who: 'die Maus', feeling: 'Traurig' } },
          { text: 'Irgendwie schmeckt der Kuchen heute nicht so gut. Da gibt Lumi der Maus das letzte Stück.', emoji: '🍰', mood: 'encouraging' },
        ],
        lesson: 'Beim nächsten Mal kann Lumi gleich teilen. Das fühlt sich gut an.',
      },
    },
  },
  {
    id: 'playground', tier: 0,
    title: 'Auf dem Spielplatz',
    panels: [
      { text: 'Lumi will rutschen. Aber vor der Rutsche wartet schon eine lange Reihe Kinder. 🧒🧒🧒', emoji: '🛝', mood: 'thinking' },
      { text: 'Ein Kind ganz vorne ruft: „Komm, Lumi, stell dich vor mich!“', emoji: '👦', mood: 'happy' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '⏳ Lumi stellt sich hinten an', value: 'wait' },
        { text: '🏃 Lumi drängelt sich vor', value: 'skip' },
      ],
    },
    outcomes: {
      wait: {
        panels: [
          { text: 'Lumi wartet, bis Lumi dran ist. Die anderen Kinder lächeln.', emoji: '🧒', mood: 'happy' },
          { text: 'Dann rutschen alle nacheinander, immer wieder. Juhu! 🎉', emoji: '🛝', mood: 'excited',
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Wenn alle der Reihe nach drankommen, ist es fair.',
      },
      skip: {
        panels: [
          { text: 'Lumi drängelt sich vor. Die Kinder hinten rufen: „Das ist unfair!“', emoji: '😠', mood: 'thinking',
            ask: { q: 'Wie fühlen sich die anderen Kinder?', who: 'die anderen Kinder', plural: true, feeling: 'Wütend' } },
          { text: 'Lumi sieht die Gesichter und sagt: „Entschuldigung!“ Dann stellt sich Lumi hinten an. 💛', emoji: '💛', mood: 'encouraging' },
        ],
        lesson: 'Sich entschuldigen ist mutig. Jeder macht mal Fehler!',
      },
    },
  },
  {
    id: 'kitten', tier: 0,
    title: 'Das Kätzchen im Regen',
    panels: [
      { text: 'Es regnet. Auf dem Heimweg hört Lumi ein leises Miauen. 🌧️\nUnter einer Bank sitzt ein kleines Kätzchen, ganz nass.', emoji: '🐱', mood: 'thinking' },
      { text: 'Das Kätzchen zittert und duckt sich ganz tief. Es hat kein Halsband.', emoji: '🐾', mood: 'encouraging',
        ask: { q: 'Wie fühlt sich das Kätzchen?', who: 'das Kätzchen', feeling: 'Ängstlich' } },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        // Fremde Tiere fasst man nicht an — man holt einen Erwachsenen.
        { text: '🏠 Lumi holt schnell Mama und zeigt ihr das Kätzchen', value: 'help' },
        { text: '🚶 Lumi geht weiter. Vielleicht hilft ja jemand anderes.', value: 'leave' },
      ],
    },
    outcomes: {
      help: {
        panels: [
          { text: 'Mama wickelt das Kätzchen in ein warmes Handtuch. „Wir suchen den Besitzer“, sagt Mama.', emoji: '🏠', mood: 'happy' },
          { text: 'Am nächsten Tag finden sie die Besitzerin. Sie drückt ihr Kätzchen ganz fest an sich. 🐱❤️', emoji: '🐱', mood: 'excited',
            ask: { q: 'Wie fühlt sich die Besitzerin?', who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Wenn ein Tier Hilfe braucht, holen wir einen Erwachsenen.',
      },
      leave: {
        panels: [
          { text: 'Lumi geht weiter … aber das leise Miauen geht Lumi nicht aus dem Kopf.', emoji: '😟', mood: 'thinking' },
          { text: 'Lumi läuft zurück und holt Mama. Nach einer langen Stunde voller Sorgen liegt das Kätzchen endlich im Warmen. 💛', emoji: '🐱', mood: 'encouraging',
            ask: { q: 'Wie fühlt sich das Kätzchen jetzt?', who: 'das Kätzchen', feeling: 'Glücklich' } },
        ],
        lesson: 'Auf das eigene Herz zu hören ist eine gute Idee.',
      },
    },
  },
  {
    id: 'rain', tier: 0,
    title: 'Der Regentag',
    panels: [
      { text: 'Es regnet! 🌧️ Lumi wollte draußen spielen. Das ist schade …', emoji: '🌧️', mood: 'thinking',
        ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Traurig' } },
      { text: 'Oma fragt: „Lumi, backst du mit mir Plätzchen? Oder schaust du ein Bilderbuch an?“ 🍪📚', emoji: '👵', mood: 'happy' },
    ],
    choice: {
      question: 'Was möchte Lumi?',
      options: [
        { text: '🍪 Lumi backt mit Oma Plätzchen', value: 'bake' },
        { text: '📚 Lumi schaut gemütlich ein Bilderbuch an', value: 'book' },
      ],
    },
    outcomes: {
      bake: {
        panels: [
          { text: 'Zusammen backen sie Plätzchen für die ganze Familie. 🍪', emoji: '🍪', mood: 'excited' },
          { text: 'Oma erzählt dabei lustige Geschichten. Es ist der schönste Regentag aller Zeiten! ☔❤️', emoji: '☔', mood: 'happy',
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Auch an Regentagen kann man zusammen viel Schönes erleben!',
      },
      book: {
        panels: [
          { text: 'Lumi kuschelt sich aufs Sofa und schaut ein spannendes Bilderbuch an. 📖✨', emoji: '📖', mood: 'happy' },
          { text: '„Lumi, die Plätzchen sind fertig!“ Oma hat trotzdem welche für Lumi gebacken. 🍪', emoji: '🍪', mood: 'excited',
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'In Bilderbüchern kann man tolle Abenteuer erleben!',
      },
    },
  },
  {
    id: 'lunchbox', tier: 1,
    title: 'Kein Frühstück',
    panels: [
      { text: 'In der Pause macht Lumi die Brotdose auf. Leckere Butterbrote! 🥪\nAber Jonas sitzt still daneben und schaut auf den Boden.', emoji: '🥪', mood: 'happy' },
      { text: '„Hast du etwas vergessen?“, fragt Lumi. „Meine Brotdose …“, flüstert Jonas.', emoji: '🎒', mood: 'thinking',
        ask: { q: 'Wie fühlt sich Jonas?', who: 'Jonas', feeling: 'Traurig' } },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🥪 Lumi teilt das Brot mit Jonas', value: 'share' },
        { text: '😶 Lumi isst allein. Es ist ja Lumis Brot.', value: 'keep' },
      ],
    },
    outcomes: {
      share: {
        panels: [
          { text: '„Möchtest du die Hälfte?“ Jonas strahlt über das ganze Gesicht.', emoji: '🤝', mood: 'excited',
            ask: { q: 'Wie fühlt sich Jonas jetzt?', who: 'Jonas', feeling: 'Glücklich' } },
          { text: 'Nach der Pause spielen Lumi und Jonas zusammen. Die beiden werden richtig gute Freunde! ✨', emoji: '🏠', mood: 'happy' },
        ],
        lesson: 'Teilen macht beide satt und froh!',
      },
      keep: {
        panels: [
          { text: 'Lumi isst … aber irgendwie schmeckt das Brot heute nicht so gut.', emoji: '🥪', mood: 'thinking' },
          { text: 'Jonas hat großen Hunger. Da gibt Lumi Jonas doch noch ein Brot ab. 💛', emoji: '💛', mood: 'encouraging',
            ask: { q: 'Wie fühlt sich Jonas jetzt?', who: 'Jonas', feeling: 'Glücklich' } },
        ],
        lesson: 'Es ist nie zu spät, das Richtige zu tun.',
      },
    },
  },
  {
    id: 'vase', tier: 1,
    title: 'Die zerbrochene Vase',
    panels: [
      { text: 'Peng! 💥 Beim Spielen stößt Lumi aus Versehen Omas Lieblingsvase vom Tisch.\nÜberall liegen Scherben. Vorsicht, die sind scharf! Lumi fasst sie nicht an.', emoji: '🏺', mood: 'thinking' },
      { text: 'Oma ist noch einkaufen. Lumis Herz klopft ganz schnell. Lumi könnte nichts sagen … oder die Wahrheit sagen.', emoji: '💓', mood: 'thinking',
        ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Ängstlich' } },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🗣️ Lumi erzählt Oma die Wahrheit, sobald sie heimkommt', value: 'truth' },
        { text: '🙈 Lumi sagt nichts und hofft, dass Oma es nicht merkt', value: 'hide' },
      ],
    },
    outcomes: {
      truth: {
        panels: [
          { text: 'Oma kommt nach Hause. „Oma, ich muss dir etwas sagen …“', emoji: '👵', mood: 'encouraging' },
          { text: 'Oma schaut auf die Scherben. Dann nimmt sie Lumi in den Arm: „Danke, dass du ehrlich bist!“ Zusammen kehren sie die Scherben auf. ❤️', emoji: '❤️', mood: 'excited',
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Die Wahrheit zu sagen ist mutig. Danach ist das Herz viel leichter!',
      },
      hide: {
        panels: [
          { text: 'Lumi sagt nichts. Aber das Geheimnis liegt Lumi wie ein Stein im Bauch.', emoji: '😟', mood: 'thinking',
            ask: { q: 'Wie fühlt sich Lumi mit dem Geheimnis?', who: 'Lumi', feeling: 'Ängstlich' } },
          { text: 'Beim Abendessen sagt Lumi: „Oma, ich war das mit der Vase.“ Oma nickt: „Gut, dass du es mir sagst.“ 💛', emoji: '💛', mood: 'happy' },
        ],
        lesson: 'Ein Geheimnis, das drückt, erzählt man besser. Ehrlich sein macht frei!',
      },
    },
  },
  {
    id: 'newkid', tier: 1,
    title: 'Das neue Mädchen',
    panels: [
      { text: 'Im Kindergarten gibt es ein neues Mädchen: Emma. Emma steht ganz allein in der Ecke und schaut auf den Boden.', emoji: '👧', mood: 'thinking',
        ask: { q: 'Wie fühlt sich Emma?', who: 'Emma', feeling: 'Traurig' } },
      { text: 'Lumis Freunde rufen: „Lumi, komm spielen!“ Lumi schaut zu Emma, dann zu den Freunden. 🤔', emoji: '🧒', mood: 'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '👋 Lumi geht zu Emma und sagt Hallo', value: 'approach' },
        { text: '🏃 Lumi rennt zu den anderen Freunden', value: 'ignore' },
      ],
    },
    outcomes: {
      approach: {
        panels: [
          { text: '„Hallo! Ich bin Lumi. Willst du mitspielen?“ Emmas Gesicht leuchtet auf!', emoji: '👧', mood: 'happy',
            ask: { q: 'Wie fühlt sich Emma jetzt?', who: 'Emma', feeling: 'Glücklich' } },
          { text: 'Am Ende des Tages hat Lumi eine neue Freundin. „Danke, dass du so nett warst!“, sagt Emma. 💛', emoji: '💛', mood: 'excited' },
        ],
        lesson: 'Ein freundliches Hallo kann für andere ganz viel bedeuten!',
      },
      ignore: {
        panels: [
          { text: 'Lumi spielt … aber Emma steht immer noch allein da und weint.', emoji: '👧', mood: 'thinking',
            ask: { q: 'Wie fühlt sich Emma?', who: 'Emma', feeling: 'Traurig' } },
          { text: 'Da geht Lumi zu Emma: „Willst du mitspielen?“ Emma lächelt. Sie hat lange allein gewartet. 💛', emoji: '💛', mood: 'encouraging' },
        ],
        lesson: 'Es ist nie zu spät, freundlich zu sein. Aber früher ist noch besser!',
      },
    },
  },
  {
    id: 'swing', tier: 1,
    title: 'Die Schaukel',
    panels: [
      { text: 'Lumi schaukelt hoch in den Himmel. Juhu!', emoji: ':px-schaukel:', mood: 'excited' },
      { text: 'Da kommt Ida. Ida möchte auch so gern schaukeln. Aber es gibt nur eine Schaukel.', emoji: '👧', mood: 'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🔁 Lumi schaukelt noch zehnmal und wechselt dann mit Ida ab', value: 'turns' },
        { text: '🤝 Lumi lässt Ida gleich schaukeln und schubst sie an', value: 'now' },
      ],
    },
    outcomes: {
      turns: {
        panels: [
          { text: 'Lumi zählt laut bis zehn. Dann darf Ida schaukeln.', emoji: ':px-schaukel:', mood: 'happy' },
          { text: 'So wechseln sie sich ab, immer wieder. Ida lacht laut.', emoji: '👧', mood: 'excited',
            ask: { q: 'Wie fühlt sich Ida jetzt?', who: 'Ida', feeling: 'Glücklich' } },
        ],
        lesson: 'Abwechseln ist fair. So kommt jeder dran!',
      },
      now: {
        panels: [
          { text: 'Ida schaukelt, und Lumi schubst sie an. Höher, höher!', emoji: ':px-schaukel:', mood: 'happy',
            ask: { q: 'Wie fühlt sich Ida?', who: 'Ida', feeling: 'Glücklich' } },
          { text: 'Danach darf Lumi wieder. Jetzt schubst Ida. 💛', emoji: '💛', mood: 'excited' },
        ],
        lesson: 'Zusammen schaukeln macht doppelt Spaß!',
      },
    },
  },
  {
    id: 'screentime', tier: 1,
    title: 'Das Tablet',
    panels: [
      { text: 'Lumi spielt schon lange auf dem Tablet. Mama sagt: „Noch zehn Minuten, dann ist Pause.“', emoji: '📱', mood: 'thinking' },
      { text: 'Die Zeit ist um. Aber Lumi ist gerade an der spannendsten Stelle!', emoji: '🎮', mood: 'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '✅ Lumi macht das Tablet aus', value: 'stop' },
        { text: '🤫 Lumi spielt heimlich weiter', value: 'sneak' },
      ],
    },
    outcomes: {
      stop: {
        panels: [
          { text: 'Lumi legt das Tablet weg. Mama lächelt: „Super! Wollen wir zusammen etwas spielen?“', emoji: '🎲', mood: 'happy',
            ask: { q: 'Wie fühlt sich Mama?', who: 'Mama', feeling: 'Glücklich' } },
          { text: 'Sie spielen ein Kartenspiel. Das macht auch Spaß! Und morgen darf Lumi wieder ein bisschen spielen. 🌟', emoji: '🌟', mood: 'excited' },
        ],
        lesson: 'Wer sich an Abmachungen hält, dem kann man vertrauen.',
      },
      sneak: {
        panels: [
          { text: 'Mama kommt herein. „Lumi, das war nicht abgemacht.“ Mama ist enttäuscht. Heute bleibt das Tablet aus.', emoji: '📱', mood: 'thinking',
            ask: { q: 'Wie fühlt sich Mama?', who: 'Mama', feeling: 'Traurig' } },
          { text: '„Es tut mir leid, Mama.“ Mama nimmt Lumi in den Arm: „Danke. Morgen probieren wir es nochmal.“ 💛', emoji: '💛', mood: 'encouraging' },
        ],
        lesson: 'Abmachungen halten macht das Leben für alle leichter!',
      },
    },
  },
  {
    id: 'climbingframe', tier: 2,
    title: 'Lumi und der große Kletterturm',
    panels: [
      { text: 'Im Park steht ein großer Kletterturm. Alle Kinder klettern hinauf. Lumi bleibt unten.\n„Das ist so hoch … was ist, wenn ich falle?“', emoji: '🧗', mood: 'thinking',
        ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Ängstlich' } },
      { text: 'Mia reicht Lumi die Hand: „Ich bin neben dir. Versuch es Schritt für Schritt!“ 🤝', emoji: '🤝', mood: 'encouraging' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🧗 Lumi versucht es, Schritt für Schritt', value: 'brave' },
        { text: '🌳 Lumi bleibt lieber unten', value: 'stay' },
      ],
    },
    outcomes: {
      brave: {
        panels: [
          { text: 'Schritt … für … Schritt. Lumi klettert! 💪 Von oben sieht die Welt ganz anders aus.', emoji: '🌟', mood: 'excited' },
          { text: '„Ich habe es geschafft!“ Alle jubeln. 🎉', emoji: '🏆', mood: 'excited',
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Stolz' } },
        ],
        lesson: 'Mutig sein heißt nicht, keine Angst zu haben. Mutig sein heißt, es trotzdem zu versuchen!',
      },
      stay: {
        panels: [
          { text: 'Lumi bleibt unten. Das ist auch in Ordnung! Lumi weiß: Der große Turm ist heute noch zu hoch.', emoji: '🌱', mood: 'happy' },
          { text: 'Lumi klettert auf den kleinen Turm, bis ganz nach oben: „Nächstes Mal probiere ich den großen!“ ✨', emoji: '✨', mood: 'excited',
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Stolz' } },
        ],
        lesson: 'Jeden Tag ein kleiner Schritt weiter, das ist auch Mut!',
      },
    },
  },
  {
    id: 'promise', tier: 2,
    title: 'Das Versprechen',
    panels: [
      { text: 'Lumi spielt beim Nachbarskind Ben. Lumi hat Oma versprochen, zum Abendessen pünktlich heimzukommen.', emoji: '🏠', mood: 'happy' },
      { text: 'Gleich gibt es Essen. Aber Ben ruft: „Bleib doch noch! Wir bauen gerade eine Höhle!“', emoji: '🧸', mood: 'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🏠 Lumi geht pünktlich nach Hause, wie versprochen', value: 'promise' },
        { text: '🧸 Lumi bleibt noch ein bisschen bei Ben', value: 'stay' },
      ],
    },
    outcomes: {
      promise: {
        panels: [
          { text: 'Lumi sagt „Tschüss, bis morgen!“ und geht heim. Oma wartet schon an der Tür und lacht. 💜', emoji: '👵', mood: 'happy',
            ask: { q: 'Wie fühlt sich Oma?', who: 'Oma', feeling: 'Glücklich' } },
          { text: 'Zum Nachtisch gibt es Kuchen. „Auf dich kann man sich verlassen!“, sagt Oma. 🍰', emoji: '🍰', mood: 'excited' },
        ],
        lesson: 'Wer ein Versprechen hält, auf den kann man sich verlassen!',
      },
      stay: {
        panels: [
          { text: 'Lumi spielt weiter. Da klingelt bei Ben das Telefon. Es ist Oma. Oma weiß nicht, wo Lumi bleibt.', emoji: '📱', mood: 'thinking',
            ask: { q: 'Wie fühlt sich Oma?', who: 'Oma', feeling: 'Ängstlich' } },
          { text: 'Lumi läuft schnell nach Hause. Oma und Lumi nehmen sich fest in den Arm. 💛', emoji: '💛', mood: 'encouraging' },
        ],
        lesson: 'Versprechen sind wichtig, besonders für Menschen, die uns lieb haben.',
      },
    },
  },
  {
    id: 'wallet', tier: 2,
    title: 'Das gefundene Portemonnaie',
    panels: [
      { text: 'Beim Spielen im Park findet Lumi ein Portemonnaie im Gras.\nDarin sind Geld und ein Foto.', emoji: ':px-portemonnaie:', mood: 'thinking' },
      { text: 'Mama sitzt auf der Bank gleich daneben. Lumi könnte das Portemonnaie behalten … oder es Mama zeigen.', emoji: '🤔', mood: 'thinking' },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '👮 Lumi bringt das Portemonnaie mit Mama zur Polizei', value: 'return' },
        { text: '💰 Lumi steckt das Portemonnaie in die eigene Tasche', value: 'keep' },
      ],
    },
    outcomes: {
      return: {
        panels: [
          { text: 'Lumi und Mama bringen das Portemonnaie zur Polizei. Der Polizist sagt: „Das habt ihr toll gemacht!“', emoji: '👮', mood: 'happy' },
          { text: 'Am nächsten Tag ruft die Besitzerin an: „Danke! Da ist das Foto von meinem Enkel drin.“ 💛', emoji: '💛', mood: 'excited',
            ask: { q: 'Wie fühlt sich die Besitzerin?', who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Ehrlich sein hilft anderen Menschen!',
      },
      keep: {
        panels: [
          { text: 'Zu Hause fühlt sich das Portemonnaie in der Tasche ganz schwer an.', emoji: '😟', mood: 'thinking' },
          { text: 'Lumi erzählt es Mama. Zusammen bringen sie es zum Fundbüro. Die Besitzerin bekommt alles zurück. 💛', emoji: '💛', mood: 'encouraging',
            ask: { q: 'Wie fühlt sich die Besitzerin?', who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Einen Fehler kann man wiedergutmachen. Das ist mutig!',
      },
    },
  },
  {
    id: 'sweater', tier: 2,
    title: 'Der bekleckste Pulli',
    panels: [
      { text: 'Lumi malt mit Wasserfarben. Auf dem Stuhl liegt der Lieblingspulli von Lumis großer Schwester Lea. 🎨', emoji: '👕', mood: 'happy' },
      { text: 'Platsch! Ein dicker blauer Klecks landet auf dem Pulli. Lumi erschrickt. Lea ist nicht da.', emoji: '💧', mood: 'thinking',
        ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Ängstlich' } },
    ],
    choice: {
      question: 'Was macht Lumi?',
      options: [
        { text: '🗣️ Lumi erzählt Lea, was passiert ist', value: 'tell' },
        { text: '🙈 Lumi stopft den Pulli ganz hinten in den Schrank', value: 'hide' },
      ],
    },
    outcomes: {
      tell: {
        panels: [
          { text: '„Lea, ich habe aus Versehen auf deinen Pulli gekleckst. Es tut mir leid.“', emoji: '👕', mood: 'encouraging' },
          { text: 'Lea schaut auf den Fleck und schimpft. Dann waschen sie den Pulli zusammen. Der Fleck geht raus! 🫧', emoji: '🫧', mood: 'happy',
            ask: { q: 'Wie fühlt sich Lea, als sie den Fleck sieht?', who: 'Lea', feeling: 'Wütend' } },
        ],
        lesson: 'Sagen, was passiert ist, braucht Mut. Dann kann man es zusammen wiedergutmachen!',
      },
      hide: {
        panels: [
          { text: 'Lumi stopft den Pulli in den Schrank. Aber Lumi muss die ganze Zeit daran denken.', emoji: '😟', mood: 'thinking',
            ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Ängstlich' } },
          { text: 'Am Abend sucht Lea den Pulli. Da sagt Lumi: „Ich war das. Es tut mir leid.“ Lea seufzt: „Gut, dass du es sagst. Komm, wir waschen ihn zusammen.“ 💛', emoji: '💛', mood: 'encouraging' },
        ],
        lesson: 'Verstecken macht es nicht besser. Ehrlich sein schon!',
      },
    },
  },
]

// The other faces next to the right one: never a feeling of the same kind,
// so there is exactly one that fits ("die Kinder sind traurig und sauer" —
// both would be right).
const DECOYS = {
  'Glücklich': ['Traurig', 'Wütend', 'Ängstlich', 'Müde'],
  'Traurig':   ['Glücklich', 'Stolz'],
  'Wütend':    ['Glücklich', 'Stolz', 'Müde'],
  'Ängstlich': ['Glücklich', 'Stolz', 'Müde'],
  'Stolz':     ['Traurig', 'Ängstlich', 'Müde', 'Wütend'],
}

// Levels used to differ only in the number of stories, drawn at random from
// all of them — level 1 could start with the forged report card. Now the
// stories are graded too, and from level 4 there are two feeling questions
// per story with three faces instead of one with two.
function levelSetup(level) {
  const tier = level <= 3 ? 0 : level <= 6 ? 1 : 2
  const count = level <= 2 ? 2 : level <= 8 ? 3 : 4
  const pool = [
    ...shuffle(STORIES.filter(s => s.tier === tier)),
    ...shuffle(STORIES.filter(s => s.tier === tier - 1)),
  ]
  return { stories: pool.slice(0, count), faces: level <= 3 ? 2 : 3, allAsks: level >= 4 }
}

const word = f => f.toLowerCase()
const cap = s => s[0].toUpperCase() + s.slice(1)
const GO = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }

export default function StoryGame({ level = 1, onComplete }) {
  const [setup]      = useState(() => levelSetup(level))
  const { stories, faces, allAsks } = setup
  const [storyIdx,   setStoryIdx]   = useState(0)
  const [panelIdx,   setPanelIdx]   = useState(0)
  const [chosen,     setChosen]     = useState(null)
  const [outPanel,   setOutPanel]   = useState(0)
  const [phase,      setPhase]      = useState('intro') // intro | choice | outcome | lesson
  const [showAlt,    setShowAlt]    = useState(false)
  const [answer,     setAnswer]     = useState(null)    // the face picked for this panel's question
  const [asked,      setAsked]      = useState(0)
  const [firstTry,   setFirstTry]   = useState(0)
  const [spoken,     setSpoken]     = useState(false)   // the step has been read to the end
  const waitRef = useRef(null)

  const story   = stories[storyIdx]
  const outcome = chosen ? story.outcomes[chosen] : null
  const altOption  = chosen ? story.choice.options.find(o => o.value !== chosen) : null
  const altOutcome = altOption ? story.outcomes[altOption.value] : null

  const currentPanel = phase === 'intro' ? story.panels[panelIdx]
                     : phase === 'outcome' ? outcome?.panels[outPanel]
                     : null
  // Levels 1-3 ask once per story: in the opening if it has a question,
  // otherwise after the choice.
  const ask = currentPanel?.ask && (allAsks || phase === 'intro' || !story.panels.some(p => p.ask))
    ? currentPanel.ask : null
  const stepKey = `${storyIdx}-${phase}-${panelIdx}-${outPanel}`

  const askFaces = useMemo(() => ask
    ? shuffle([ask.feeling, ...shuffle(DECOYS[ask.feeling]).slice(0, faces - 1)])
    : [], [stepKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const whenQuiet = (fn) => {
    waitRef.current?.()
    waitRef.current = afterNarration(fn, { minMs: 200, maxMs: 20000 })
  }
  useEffect(() => () => { waitRef.current?.(); stopNarration() }, [])

  // Everything is read aloud: the title, each panel, the question with its
  // faces, the choice with its options and the lesson. Before, only the
  // lesson was spoken, and the game could not be played without reading.
  useEffect(() => {
    setAnswer(null)
    setSpoken(false)
    lockPreviews()
    let parts
    if (currentPanel) {
      parts = [
        phase === 'intro' && panelIdx === 0 && { text: `${story.title}.` },
        { text: currentPanel.text, gap: 200 },
        ask && { text: ask.q, gap: 400 },
        ...askFaces.map(f => ({ text: f, gap: 300 })),
      ]
    } else if (phase === 'choice') {
      parts = [{ text: story.choice.question }, ...story.choice.options.map(o => ({ text: o.text, gap: 350 }))]
    } else if (phase === 'lesson') {
      parts = [{ text: outcome.lesson }]
    }
    narrate(parts)
    whenQuiet(() => setSpoken(true))
  }, [stepKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickFace = (f) => {
    if (!ask || answer) return
    const ok = f === ask.feeling
    setAnswer(f)
    setAsked(n => n + 1)
    if (ok) setFirstTry(n => n + 1)
    const who = `${ask.who} ${ask.plural ? 'sind' : 'ist'}`
    // No second try and no red cross: the face that fits turns green, and
    // Lumi says it.
    if (ok) sayRight(`${cap(who)} ${word(ask.feeling)}.`)
    else narrate([{ text: `Hm, ich glaube, ${who} eher ${word(ask.feeling)}.` }])
    setSpoken(false)
    whenQuiet(() => setSpoken(true))
  }

  const nextPanel = () => {
    if (ask && !answer) return
    if (phase === 'intro') {
      if (panelIdx < story.panels.length - 1) setPanelIdx(p => p + 1)
      else setPhase('choice')
    } else if (phase === 'outcome') {
      if (outPanel < outcome.panels.length - 1) setOutPanel(p => p + 1)
      else setPhase('lesson')
    }
  }

  const makeChoice = (value) => {
    setChosen(value)
    setPhase('outcome')
    setOutPanel(0)
  }

  const openAlt = () => {
    setShowAlt(true)
    lockPreviews()
    narrate([
      { text: `Der andere Weg: ${altOption.text}.` },
      ...altOutcome.panels.map(p => ({ text: p.text, gap: 300 })),
    ])
  }

  const nextStory = () => {
    if (storyIdx + 1 >= stories.length) {
      onComplete(result(firstTry, asked))
    } else {
      setStoryIdx(i => i + 1)
      setPanelIdx(0)
      setChosen(null)
      setOutPanel(0)
      setPhase('intro')
      setShowAlt(false)
    }
  }

  // The Weiter button can always be pressed; once Lumi has finished reading
  // it starts to bounce, so the child knows it is their turn.
  const nudge = spoken ? { scale: [1, 1.06, 1], transition: { duration: 1.1, repeat: Infinity } } : { scale: 1 }
  const bigBtn = { padding: '14px clamp(28px,6vw,52px)', minHeight: 56, fontSize: 'clamp(18px,4vw,24px)' }

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(12px,2vw,20px)',
    }}>

      {/* Story progress */}
      <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', justifyContent:'center' }}>
        {stories.map((s, i) => (
          <div key={i} style={{ display:'flex', alignItems:'center', gap:4 }}>
            <div style={{
              width:32, height:32, borderRadius:8, border:`3px solid ${INK}`,
              background: i < storyIdx ? 'var(--px-green)' : i === storyIdx ? 'var(--px-gold)' : '#FFFDF7',
              boxShadow:'0 3px 0 rgba(42,27,61,0.35)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--font-heading)', fontSize:15, fontWeight:700, color: INK,
            }}>
              {i < storyIdx ? '✓' : i + 1}
            </div>
            {i < stories.length - 1 && <div style={{ width:20, height:3, background: i < storyIdx ? '#2F8F3A' : 'var(--px-parch-dark)', borderRadius:1 }} />}
          </div>
        ))}
        <span style={{ fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-primary)', marginLeft:6 }}>
          {story.title}
        </span>
      </div>

      {/* Story card — fades in place: sliding in from the side cut it off at
          the right edge for a moment */}
      <AnimatePresence mode="wait">
        {phase !== 'choice' && <motion.div key={stepKey}
          initial={{ opacity:0, scale:0.96 }} animate={{ opacity:1, scale:1 }}
          exit={{ opacity:0, scale:0.96 }}
          transition={{ duration:0.2 }}
          style={{
            ...pxPanel,
            padding:'clamp(18px,4vw,32px)',
            width:'100%', maxWidth:680,
            display:'flex', flexDirection:'column', alignItems:'center', gap:16,
            position:'relative',
          }}
        >
          {currentPanel && (
            <>
              <div style={{ fontSize: ask ? 'clamp(52px,11vw,72px)' : 'clamp(56px,14vw,88px)', lineHeight:1, textAlign:'center', minHeight:'1em' }}>
                {currentPanel.emoji}
              </div>
              <p style={{
                fontFamily:'var(--font-body)', fontWeight:600, fontSize:'clamp(17px,3.4vw,23px)',
                color:'var(--text-primary)', textAlign:'center', lineHeight:1.5,
                whiteSpace:'pre-line',
              }}>
                {currentPanel.text}
              </p>
              {/* in the corner, so it costs the card no height */}
              <HearOptions items={[currentPanel.text, ...(ask ? [ask.q, ...askFaces] : [])]} label="Nochmal vorlesen"
                style={{ position:'absolute', top:10, right:10 }} />
            </>
          )}

          {phase === 'lesson' && (
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14, width:'100%' }}>
              <LumiCharacter mood="happy" size={showAlt ? 56 : 80} />
              <div style={{
                background:'#FFF1D6',
                border:`3px solid ${INK}`, boxShadow:'inset 0 -4px 0 var(--px-parch-dark)',
                borderRadius:12, padding:'16px 22px',
                fontFamily:'var(--font-heading)', fontSize:'clamp(17px,3.6vw,23px)',
                color:ACCENT, textAlign:'center',
                display:'flex', alignItems:'center', gap:12,
              }}>
                <span>💡 {outcome.lesson}</span>
                <HearOptions items={[outcome.lesson]} label="Nochmal vorlesen" />
              </div>

              {/* The other path, side by side with the chosen one — and read
                  aloud like the rest */}
              {!showAlt && (
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={openAlt}
                  {...hearable('Und wenn Lumi anders entschieden hätte?')}
                  style={{
                    ...pxButton('parch'),
                    padding: '10px 24px', minHeight: 52,
                    fontSize: 'clamp(15px,3vw,17px)',
                  }}
                >🔀 Und wenn Lumi anders entschieden hätte?</motion.button>
              )}
              {showAlt && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: '#FFF8E8', border: `3px solid ${INK}`,
                    boxShadow: 'inset 0 -4px 0 var(--px-parch-dark), 0 4px 0 rgba(42,27,61,0.35)',
                    borderRadius: 12, padding: '14px 18px', maxWidth: 480,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-heading)', fontSize: 16, color: INK }}>
                    Der andere Weg: {altOption.text}
                  </div>
                  {altOutcome.panels.map((pn, i) => (
                    <div key={i} style={{
                      fontFamily: 'var(--font-body)', fontSize: 'clamp(15px,3vw,17px)',
                      color: 'var(--text-secondary)', whiteSpace: 'pre-line',
                    }}>{pn.text}</div>
                  ))}
                </motion.div>
              )}
            </div>
          )}
        </motion.div>}
      </AnimatePresence>

      {/* Lumi herself, not a fox emoji */}
      {((currentPanel && !ask) || phase === 'choice') && (
        <LumiCharacter mood={currentPanel?.mood ?? 'thinking'} size={phase === 'choice' ? 96 : 72} />
      )}

      {/* A feeling question at a turn of the story */}
      {ask && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, width:'100%', maxWidth:600 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:10 }}>
            <LumiCharacter mood="thinking" size={56} />
            <p style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(18px,4vw,24px)', color:ACCENT, textAlign:'center' }}>
              {ask.q}
            </p>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:`repeat(${askFaces.length},1fr)`, gap:'clamp(8px,2vw,14px)', width:'100%' }}>
            {askFaces.map(f => {
              const isRight  = answer && f === ask.feeling
              const isChosen = answer && f === answer && !isRight
              return (
                <motion.button key={f}
                  whileHover={!answer ? { scale:1.04 } : {}} whileTap={!answer ? { scale:0.96 } : {}}
                  onClick={() => pickFace(f)}
                  {...hearable(f, { enabled: !answer })}
                  aria-label={f}
                  style={{
                    ...pxCard(isRight ? 'right' : isChosen ? 'selected' : undefined),
                    padding:'10px 6px', minHeight:88,
                    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4,
                    cursor: answer ? 'default' : 'pointer',
                    opacity: answer && !isRight && !isChosen ? 0.55 : 1,
                  }}
                >
                  <span style={{ fontSize:'clamp(34px,7vw,44px)', lineHeight:1 }}>{FEELING_ICON[f]}</span>
                  <span style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(15px,3.2vw,19px)', fontWeight:700, color:'var(--text-primary)' }}>{f}</span>
                </motion.button>
              )
            })}
          </div>
        </div>
      )}

      {/* CTA buttons */}
      {(phase === 'intro' || phase === 'outcome') && (!ask || answer) && (
        <motion.button whileTap={{scale:0.96}} onClick={nextPanel} animate={nudge}
          {...hearable('Weiter')}
          style={{ ...GO, ...bigBtn }}
        >
          Weiter <PxIcon name="play" size={18} />
        </motion.button>
      )}

      {phase === 'choice' && (
        <div style={{
          display:'flex', flexDirection:'column', gap:'clamp(10px,2vw,16px)',
          width:'100%', maxWidth:600,
        }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12 }}>
            <p style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(19px,4vw,25px)', color:ACCENT, textAlign:'center' }}>
              {story.choice.question}
            </p>
            <HearOptions items={story.choice.options.map(o => o.text)} label="Alle Antworten vorlesen" size={48} />
          </div>
          {story.choice.options.map((opt) => (
            <motion.button key={opt.value}
              whileHover={{scale:1.03}} whileTap={{scale:0.97}}
              onClick={() => makeChoice(opt.value)}
              {...hearable(opt.text)}
              style={{
                ...pxButton('parch'),
                padding:'clamp(14px,3vw,20px) clamp(16px,4vw,28px)', minHeight:60,
                fontSize:'clamp(17px,3.5vw,22px)',
                textAlign:'left',
              }}
            >
              {opt.text}
            </motion.button>
          ))}
        </div>
      )}

      {phase === 'lesson' && (
        <motion.button whileTap={{scale:0.96}} onClick={nextStory} animate={nudge}
          {...hearable(storyIdx + 1 >= stories.length ? 'Fertig' : 'Nächste Geschichte')}
          style={{ ...GO, ...bigBtn }}
        >
          {storyIdx + 1 >= stories.length ? '🏆 Fertig!' : 'Nächste Geschichte ➡️'}
        </motion.button>
      )}
    </div>
  )
}
