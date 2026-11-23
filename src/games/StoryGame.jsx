import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragArea, Draggable, DropZone, RoundTrail, Art, useBursts, useDragState } from '../components/play/index.js'
import { narrate, lockPreviews, stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { FEELING_ICON, shuffle } from './feelings.js'
import { Stage, FeelLumi, FaceChip, useAfter, ReplayButton } from './feelingStage.jsx'
import { INK, pxButton } from './px.js'

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
 * Mechanic: a picture story plays on a little stage, scene after scene, read
 * aloud — Lumi and the others act it out. At a fork the child carries Lumi
 * to one of two paths (or taps a path), and the story goes on with what
 * follows from it.
 *
 * The choice itself is not rated. It used to give three stars for the "good"
 * and two for the "bad" option, which taught "pick the well-behaved answer"
 * rather than weighing anything, and some stories have two good ways. What
 * is rated is understanding: at a turn in the story the child is asked how
 * someone feels (`ask`) and hands that one the face that fits; those
 * answers, first try, make the stars.
 */

// One thing on the stage (feelingStage.jsx): a thing, or a character (`c`).
// `who` marks the one a feeling question is about.
const t = (a, x, act, o) => ({ a, x, act, ...o })
const c = (a, x, act, o) => ({ a, x, act, char: true, s: 120, ...o })
const HAND = 252
const ROCK = ':px-schaukel:'

// tier: 0 = levels 1-3 (short, one clear helper situation), 1 = levels 4-6,
// 2 = levels 7-10 (honesty and promises, harder to weigh). Three stories
// (rain, swing, climbing tower) have two good ways on purpose.
// Each panel: what is read (`text`), Lumi's face (`lumi`), the others (`cast`).
const STORIES = [
  {
    id: 'forest', tier: 0, title: 'Lumi im Wald',
    panels: [
      { text: 'Lumi spaziert durch den bunten Herbstwald. Plötzlich hört Lumi ein leises Weinen …',
        lumi: { feel: 'curious', act: 'in' }, cast: [t('🌲', 420, 'pop', { s: 170 }), t('🌳', 540, 'pop', { s: 140, d: 0.2 }), t('🍂', 330, 'drop', { s: 40, d: 0.6 })] },
      { text: 'Da sitzt ein kleiner Igel. „Ich finde den Weg nach Hause nicht!“',
        lumi: { feel: 'neutral' }, cast: [t('🌲', 520, 'none', { s: 160 }), c('🦔', 360, 'pop', { feel: 'sad', s: 100, who: true })],
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
          { text: 'Lumi hilft dem Igel. Gemeinsam finden sie den Weg.',
            lumi: { feel: 'happy' }, cast: [c('🦔', 340, 'none', { feel: 'happy', s: 100, who: true }), t('🗺️', 450, 'drop', { s: 70 })],
            ask: { q: 'Wie fühlt sich der Igel jetzt?', who: 'der Igel', feeling: 'Glücklich' } },
          { text: '„Danke, Lumi!“ Der Igel schenkt Lumi einen glänzenden Apfel.',
            lumi: { feel: 'excited' }, cast: [c('🦔', 340, 'none', { feel: 'happy', s: 100 }), t('🍎', 340, 'give', { s: 54, y: 50, to: HAND, d: 0.6 }), t('🏠', 500, 'pop', { s: 140 })] },
        ],
        lesson: 'Helfen macht froh: den Igel und Lumi!',
      },
      run: {
        panels: [
          { text: 'Lumi läuft weiter … aber der Igel weint immer noch.',
            lumi: { feel: 'neutral', act: 'away', d: 0.4 }, cast: [t('🌲', 520, 'none', { s: 160 }), c('🦔', 360, 'none', { feel: 'sad', s: 100, who: true })],
            ask: { q: 'Wie fühlt sich der Igel?', who: 'der Igel', feeling: 'Traurig' } },
          { text: 'Da dreht Lumi um und hilft dem Igel doch noch. Zusammen finden sie den Weg.',
            lumi: { feel: 'happy', act: 'in' }, cast: [c('🦔', 340, 'none', { feel: 'happy', s: 100, d: 1 }), t('🏠', 500, 'pop', { s: 140, d: 1 })] },
        ],
        lesson: 'Umdrehen und doch noch helfen ist auch gut!',
      },
    },
  },
  {
    id: 'bakery', tier: 0, title: 'Der Kuchenladen',
    panels: [
      { text: 'Lumi steht vor dem Kuchenladen. Es riecht nach frischem Kuchen!',
        lumi: { feel: 'happy' }, cast: [t('🏪', 440, 'pop', { s: 190 }), t('🍰', 330, 'bob', { s: 60, y: 160, d: 0.5 })] },
      { text: 'Lumi hat nur noch eine Münze. Daneben sitzt eine kleine Maus und weint: „Ich habe so großen Hunger!“',
        lumi: { feel: 'curious' }, cast: [t('🏪', 480, 'none', { s: 170 }), c('🐭', 340, 'pop', { feel: 'sad', s: 90, who: true }), t('🪙', HAND, 'pop', { s: 40, y: 70 })],
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
          { text: 'Lumi teilt den Kuchen. Die Maus strahlt: „Danke, Lumi!“',
            lumi: { feel: 'happy' }, cast: [t('🍰', HAND, 'give', { s: 54, y: 40, to: 330, d: 0.4 }), c('🐭', 360, 'none', { feel: 'happy', s: 90, who: true })],
            ask: { q: 'Wie fühlt sich die Maus jetzt?', who: 'die Maus', feeling: 'Glücklich' } },
          { text: 'Zusammen schmeckt der Kuchen doppelt so gut!',
            lumi: { feel: 'excited' }, cast: [c('🐭', 360, 'hop', { feel: 'excited', s: 90 }), t('🍰', 300, 'pop', { s: 50, y: 10 })] },
        ],
        lesson: 'Teilen macht froh: die Maus und auch Lumi!',
      },
      keep: {
        panels: [
          { text: 'Lumi isst den Kuchen allein. Die Maus schaut zu, und ihr Bauch knurrt.',
            lumi: { feel: 'neutral' }, cast: [t('🍰', HAND, 'pop', { s: 54, y: 60 }), c('🐭', 400, 'none', { feel: 'sad', s: 90, who: true })],
            ask: { q: 'Wie fühlt sich die Maus?', who: 'die Maus', feeling: 'Traurig' } },
          { text: 'Irgendwie schmeckt der Kuchen heute nicht so gut. Da gibt Lumi der Maus das letzte Stück.',
            lumi: { feel: 'calm' }, cast: [t('🍰', HAND, 'give', { s: 50, y: 40, to: 370, d: 1 }), c('🐭', 400, 'none', { feel: 'happy', s: 90 })] },
        ],
        lesson: 'Beim nächsten Mal kann Lumi gleich teilen. Das fühlt sich gut an.',
      },
    },
  },
  {
    id: 'playground', tier: 0, title: 'Auf dem Spielplatz',
    panels: [
      { text: 'Lumi will rutschen. Aber vor der Rutsche wartet schon eine lange Reihe Kinder.',
        lumi: { feel: 'curious', act: 'in' }, cast: [t('🛝', 520, 'pop', { s: 170 }), c('👦', 440, 'pop', { s: 90 }), c('👧', 375, 'pop', { s: 90, d: 0.2 }), c('🧒', 310, 'pop', { s: 90, d: 0.4 })] },
      { text: 'Ein Kind ganz vorne ruft: „Komm, Lumi, stell dich vor mich!“',
        lumi: { feel: 'neutral' }, cast: [t('🛝', 520, 'none', { s: 170 }), c('👦', 440, 'hop', { s: 90, say: 'Komm!' }), c('👧', 375, 'none', { s: 90 }), c('🧒', 310, 'none', { s: 90 })] },
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
          { text: 'Lumi wartet, bis Lumi dran ist. Die anderen Kinder lächeln.',
            lumi: { feel: 'calm' }, cast: [t('🛝', 520, 'none', { s: 170 }), c('👦', 440, 'none', { s: 90, feel: 'happy' }), c('👧', 375, 'none', { s: 90, feel: 'happy' }), c('🧒', 310, 'none', { s: 90, feel: 'happy' })] },
          { text: 'Dann rutschen alle nacheinander, immer wieder. Juhu!',
            lumi: { feel: 'excited', act: 'hop' }, cast: [t('🛝', 480, 'none', { s: 170 }), c('👦', 360, 'hop', { s: 90 }), c('👧', 560, 'hop', { s: 90, d: 0.3 })],
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Wenn alle der Reihe nach drankommen, ist es fair.',
      },
      skip: {
        panels: [
          { text: 'Lumi drängelt sich vor. Die Kinder hinten rufen: „Das ist unfair!“',
            lumi: { feel: 'neutral', x: 440 }, cast: [t('🛝', 560, 'none', { s: 150 }), c('👧', 300, 'none', { s: 90, feel: 'angry', who: true }), c('🧒', 220, 'none', { s: 90, feel: 'angry' }), c('👦', 140, 'none', { s: 90, feel: 'angry' })],
            ask: { q: 'Wie fühlen sich die anderen Kinder?', who: 'die anderen Kinder', plural: true, feeling: 'Wütend' } },
          { text: 'Lumi sieht die Gesichter und sagt: „Entschuldigung!“ Dann stellt sich Lumi hinten an.',
            lumi: { feel: 'shy', say: 'Entschuldigung!' }, cast: [t('🛝', 520, 'none', { s: 170 }), c('👦', 440, 'none', { s: 90 }), c('👧', 375, 'none', { s: 90 }), c('🧒', 310, 'none', { s: 90 })] },
        ],
        lesson: 'Sich entschuldigen ist mutig. Jeder macht mal Fehler!',
      },
    },
  },
  {
    id: 'kitten', tier: 0, title: 'Das Kätzchen im Regen',
    panels: [
      { text: 'Es regnet. Auf dem Heimweg hört Lumi ein leises Miauen. Unter einer Bank sitzt ein kleines Kätzchen, ganz nass.', fx: 'rain',
        lumi: { feel: 'curious', act: 'in' }, cast: [t('🪑', 400, 'pop', { s: 140 }), c('🐱', 400, 'pop', { s: 70, d: 0.8, feel: 'scared', z: 0 })] },
      { text: 'Das Kätzchen zittert und duckt sich ganz tief. Es hat kein Halsband.', fx: 'rain',
        lumi: { feel: 'neutral' }, cast: [t('🪑', 400, 'none', { s: 140 }), c('🐱', 400, 'none', { s: 80, feel: 'scared', who: true, z: 0 })],
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
          { text: 'Mama wickelt das Kätzchen in ein warmes Handtuch. „Wir suchen den Besitzer“, sagt Mama.',
            lumi: { feel: 'happy' }, cast: [c('👩', 450, 'in', { s: 150 }), c('🐱', 360, 'none', { s: 70 }), t('🏠', 560, 'pop', { s: 100 })] },
          { text: 'Am nächsten Tag finden sie die Besitzerin. Sie drückt ihr Kätzchen ganz fest an sich.',
            lumi: { feel: 'excited' }, cast: [c('👧', 420, 'in', { s: 140, feel: 'happy', who: true }), c('🐱', 340, 'none', { s: 70, feel: 'happy', d: 0.6 })],
            ask: { q: 'Wie fühlt sich die Besitzerin?', who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Wenn ein Tier Hilfe braucht, holen wir einen Erwachsenen.',
      },
      leave: {
        panels: [
          { text: 'Lumi geht weiter … aber das leise Miauen geht Lumi nicht aus dem Kopf.', fx: 'rain',
            lumi: { feel: 'sad', strength: 0 }, cast: [t('🪑', 520, 'none', { s: 110 }), c('🐱', 520, 'none', { s: 60, feel: 'scared', z: 0 })] },
          { text: 'Lumi läuft zurück und holt Mama. Nach einer langen Stunde voller Sorgen liegt das Kätzchen endlich im Warmen.',
            lumi: { feel: 'calm', act: 'run' }, cast: [c('👩', 450, 'in', { s: 150 }), c('🐱', 350, 'none', { s: 70, feel: 'happy', who: true })],
            ask: { q: 'Wie fühlt sich das Kätzchen jetzt?', who: 'das Kätzchen', feeling: 'Glücklich' } },
        ],
        lesson: 'Auf das eigene Herz zu hören ist eine gute Idee.',
      },
    },
  },
  {
    id: 'rain', tier: 0, title: 'Der Regentag',
    panels: [
      { text: 'Es regnet! Lumi wollte draußen spielen. Das ist schade …', fx: 'rain',
        lumi: { feel: 'sad' }, cast: [t('🪟', 430, 'pop', { s: 160, y: 60 }), t('⚽', 330, 'pop', { s: 60 })],
        ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Traurig' } },
      { text: 'Oma fragt: „Lumi, backst du mit mir Plätzchen? Oder schaust du ein Bilderbuch an?“',
        lumi: { feel: 'curious' }, cast: [c('👵', 450, 'in', { s: 150 }), t('🍪', 340, 'bob', { s: 54, y: 170, d: 0.8 }), t('📚', 550, 'bob', { s: 54, y: 170, d: 1 })] },
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
          { text: 'Zusammen backen sie Plätzchen für die ganze Familie.',
            lumi: { feel: 'excited' }, cast: [c('👵', 460, 'none', { s: 150 }), t('🍪', 320, 'drop', { s: 50 }), t('🍪', 370, 'drop', { s: 50, d: 0.3 }), t('🍪', 345, 'drop', { s: 50, y: 40, d: 0.6 })] },
          { text: 'Oma erzählt dabei lustige Geschichten. Es ist der schönste Regentag aller Zeiten!',
            lumi: { feel: 'happy' }, cast: [c('👵', 440, 'none', { s: 150, feel: 'happy' }), t('🍪', 330, 'pop', { s: 50 }), t('☔', 560, 'pop', { s: 80, y: 100 })],
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Auch an Regentagen kann man zusammen viel Schönes erleben!',
      },
      book: {
        panels: [
          { text: 'Lumi kuschelt sich aufs Sofa und schaut ein spannendes Bilderbuch an.',
            lumi: { feel: 'curious' }, cast: [t('🛋️', 420, 'pop', { s: 170 }), t('📖', HAND, 'pop', { s: 60, y: 60, d: 0.4 })] },
          { text: '„Lumi, die Plätzchen sind fertig!“ Oma hat trotzdem welche für Lumi gebacken.',
            lumi: { feel: 'excited' }, cast: [c('👵', 450, 'in', { s: 150 }), t('🍪', 380, 'give', { s: 54, y: 60, to: HAND, d: 1 })],
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'In Bilderbüchern kann man tolle Abenteuer erleben!',
      },
    },
  },
  {
    id: 'lunchbox', tier: 1, title: 'Kein Frühstück',
    panels: [
      { text: 'In der Pause macht Lumi die Brotdose auf. Leckere Butterbrote! Aber Jonas sitzt still daneben und schaut auf den Boden.',
        lumi: { feel: 'happy' }, cast: [t('🥪', HAND, 'pop', { s: 56, y: 50 }), c('👦', 420, 'pop', { s: 130, feel: 'sad', d: 0.8 })] },
      { text: '„Hast du etwas vergessen?“, fragt Lumi. „Meine Brotdose …“, flüstert Jonas.',
        lumi: { feel: 'curious' }, cast: [c('👦', 420, 'none', { s: 130, feel: 'sad', who: true }), t('🎒', 520, 'drop', { s: 70 })],
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
          { text: '„Möchtest du die Hälfte?“ Jonas strahlt über das ganze Gesicht.',
            lumi: { feel: 'happy' }, cast: [c('👦', 420, 'none', { s: 130, feel: 'happy', who: true }), t('🥪', HAND, 'give', { s: 50, y: 40, to: 360, d: 0.3 })],
            ask: { q: 'Wie fühlt sich Jonas jetzt?', who: 'Jonas', feeling: 'Glücklich' } },
          { text: 'Nach der Pause spielen Lumi und Jonas zusammen. Die beiden werden richtig gute Freunde!',
            lumi: { feel: 'excited', act: 'hop' }, cast: [c('👦', 400, 'hop', { s: 130, feel: 'excited' }), t('⚽', 300, 'bob', { s: 50, y: 120 })] },
        ],
        lesson: 'Teilen macht beide satt und froh!',
      },
      keep: {
        panels: [
          { text: 'Lumi isst … aber irgendwie schmeckt das Brot heute nicht so gut.',
            lumi: { feel: 'sad', strength: 0 }, cast: [t('🥪', HAND, 'pop', { s: 56, y: 50 }), c('👦', 430, 'none', { s: 130, feel: 'sad' })] },
          { text: 'Jonas hat großen Hunger. Da gibt Lumi Jonas doch noch ein Brot ab.',
            lumi: { feel: 'calm' }, cast: [t('🥪', HAND, 'give', { s: 50, y: 40, to: 370, d: 0.4 }), c('👦', 430, 'none', { s: 130, feel: 'happy', who: true })],
            ask: { q: 'Wie fühlt sich Jonas jetzt?', who: 'Jonas', feeling: 'Glücklich' } },
        ],
        lesson: 'Es ist nie zu spät, das Richtige zu tun.',
      },
    },
  },
  {
    id: 'vase', tier: 1, title: 'Die zerbrochene Vase',
    panels: [
      { text: 'Peng! Beim Spielen stößt Lumi aus Versehen Omas Lieblingsvase vom Tisch. Überall liegen Scherben. Vorsicht, die sind scharf! Lumi fasst sie nicht an.',
        lumi: { feel: 'surprised' }, cast: [t(':px-tisch:', 410, 'pop', { s: 150 }), t('🏺', 410, 'fall', { s: 70, y: 110, d: 0.8 }), t('💥', 430, 'bang', { s: 90, y: 10, d: 1.6 })] },
      { text: 'Oma ist noch einkaufen. Lumis Herz klopft ganz schnell. Lumi könnte nichts sagen … oder die Wahrheit sagen.',
        lumi: { feel: 'scared' }, cast: [t(':px-tisch:', 420, 'none', { s: 150 }), t('🏺', 330, 'none', { s: 60, rot: 100 }), t('❤️', HAND - 10, 'bob', { s: 44, y: 180 })],
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
          { text: 'Oma kommt nach Hause. „Oma, ich muss dir etwas sagen …“',
            lumi: { feel: 'shy', say: 'Oma …' }, cast: [c('👵', 450, 'in', { s: 150 }), t('🏺', 340, 'none', { s: 60, rot: 100 })] },
          { text: 'Oma schaut auf die Scherben. Dann nimmt sie Lumi in den Arm: „Danke, dass du ehrlich bist!“ Zusammen kehren sie die Scherben auf.',
            lumi: { feel: 'happy' }, cast: [c('👵', 400, 'none', { s: 150, feel: 'happy' }), t('🧹', 500, 'shake', { s: 80, d: 0.6 }), t('❤️', 300, 'pop', { s: 44, y: 180, d: 0.8 })],
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Die Wahrheit zu sagen ist mutig. Danach ist das Herz viel leichter!',
      },
      hide: {
        panels: [
          { text: 'Lumi sagt nichts. Aber das Geheimnis liegt Lumi wie ein Stein im Bauch.',
            lumi: { feel: 'scared', strength: 2 }, cast: [t(':px-tisch:', 440, 'none', { s: 150 }), t('🪨', HAND + 20, 'drop', { s: 44, y: 60, d: 0.8 })],
            ask: { q: 'Wie fühlt sich Lumi mit dem Geheimnis?', who: 'Lumi', feeling: 'Ängstlich' } },
          { text: 'Beim Abendessen sagt Lumi: „Oma, ich war das mit der Vase.“ Oma nickt: „Gut, dass du es mir sagst.“',
            lumi: { feel: 'calm', say: 'Ich war das.' }, cast: [c('👵', 450, 'none', { s: 150 }), t('🍲', 350, 'pop', { s: 60, y: 10 })] },
        ],
        lesson: 'Ein Geheimnis, das drückt, erzählt man besser. Ehrlich sein macht frei!',
      },
    },
  },
  {
    id: 'newkid', tier: 1, title: 'Das neue Mädchen',
    panels: [
      { text: 'Im Kindergarten gibt es ein neues Mädchen: Emma. Emma steht ganz allein in der Ecke und schaut auf den Boden.',
        lumi: { feel: 'curious' }, cast: [t('🏫', 520, 'pop', { s: 160 }), c('👧', 390, 'pop', { s: 120, feel: 'sad', who: true, d: 0.4 })],
        ask: { q: 'Wie fühlt sich Emma?', who: 'Emma', feeling: 'Traurig' } },
      { text: 'Lumis Freunde rufen: „Lumi, komm spielen!“ Lumi schaut zu Emma, dann zu den Freunden.',
        lumi: { feel: 'curious' }, cast: [c('🧒', 320, 'hop', { s: 90, say: 'Komm!' }), c('👦', 400, 'hop', { s: 90, d: 0.3 }), c('👧', 540, 'none', { s: 110, feel: 'sad' })] },
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
          { text: '„Hallo! Ich bin Lumi. Willst du mitspielen?“ Emmas Gesicht leuchtet auf!',
            lumi: { feel: 'happy', say: 'Hallo!' }, cast: [c('👧', 400, 'none', { s: 120, feel: 'happy', who: true })],
            ask: { q: 'Wie fühlt sich Emma jetzt?', who: 'Emma', feeling: 'Glücklich' } },
          { text: 'Am Ende des Tages hat Lumi eine neue Freundin. „Danke, dass du so nett warst!“, sagt Emma.',
            lumi: { feel: 'excited' }, cast: [c('👧', 400, 'hop', { s: 120, feel: 'excited' }), t('💛', 290, 'pop', { s: 50, y: 180, d: 0.4 })] },
        ],
        lesson: 'Ein freundliches Hallo kann für andere ganz viel bedeuten!',
      },
      ignore: {
        panels: [
          { text: 'Lumi spielt … aber Emma steht immer noch allein da und weint.',
            lumi: { feel: 'neutral', act: 'hop' }, cast: [c('🧒', 300, 'hop', { s: 90 }), c('👦', 380, 'hop', { s: 90, d: 0.3 }), c('👧', 530, 'none', { s: 110, feel: 'sad', who: true })],
            ask: { q: 'Wie fühlt sich Emma?', who: 'Emma', feeling: 'Traurig' } },
          { text: 'Da geht Lumi zu Emma: „Willst du mitspielen?“ Emma lächelt. Sie hat lange allein gewartet.',
            lumi: { feel: 'calm', say: 'Spielst du mit?' }, cast: [c('👧', 420, 'none', { s: 120, feel: 'happy' })] },
        ],
        lesson: 'Es ist nie zu spät, freundlich zu sein. Aber früher ist noch besser!',
      },
    },
  },
  {
    id: 'swing', tier: 1, title: 'Die Schaukel',
    panels: [
      { text: 'Lumi schaukelt hoch in den Himmel. Juhu!',
        lumi: { feel: 'excited', x: 300, y: 40, act: 'swing' }, cast: [t(ROCK, 300, 'none', { s: 230 })] },
      { text: 'Da kommt Ida. Ida möchte auch so gern schaukeln. Aber es gibt nur eine Schaukel.',
        lumi: { feel: 'curious', x: 300, y: 40, size: 130 }, cast: [t(ROCK, 300, 'none', { s: 230 }), c('👧', 500, 'in', { s: 130 })] },
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
          { text: 'Lumi zählt laut bis zehn. Dann darf Ida schaukeln.',
            lumi: { feel: 'happy', x: 300, y: 40, size: 130, act: 'swing', say: '… zehn!' }, cast: [t(ROCK, 300, 'none', { s: 230 }), c('👧', 500, 'none', { s: 130 })] },
          { text: 'So wechseln sie sich ab, immer wieder. Ida lacht laut.',
            lumi: { feel: 'happy', x: 140 }, cast: [t(ROCK, 330, 'none', { s: 230 }), c('👧', 330, 'swing', { s: 110, y: 40, feel: 'happy', who: true })],
            ask: { q: 'Wie fühlt sich Ida jetzt?', who: 'Ida', feeling: 'Glücklich' } },
        ],
        lesson: 'Abwechseln ist fair. So kommt jeder dran!',
      },
      now: {
        panels: [
          { text: 'Ida schaukelt, und Lumi schubst sie an. Höher, höher!',
            lumi: { feel: 'happy', x: 140 }, cast: [t(ROCK, 330, 'none', { s: 230 }), c('👧', 330, 'swing', { s: 110, y: 40, feel: 'happy', who: true })],
            ask: { q: 'Wie fühlt sich Ida?', who: 'Ida', feeling: 'Glücklich' } },
          { text: 'Danach darf Lumi wieder. Jetzt schubst Ida.',
            lumi: { feel: 'excited', x: 300, y: 40, size: 130, act: 'swing' }, cast: [t(ROCK, 300, 'none', { s: 230 }), c('👧', 490, 'none', { s: 130, feel: 'happy' })] },
        ],
        lesson: 'Zusammen schaukeln macht doppelt Spaß!',
      },
    },
  },
  {
    id: 'screentime', tier: 1, title: 'Das Tablet',
    panels: [
      { text: 'Lumi spielt schon lange auf dem Tablet. Mama sagt: „Noch zehn Minuten, dann ist Pause.“',
        lumi: { feel: 'happy' }, cast: [t('📱', HAND, 'pop', { s: 56, y: 60 }), c('👩', 460, 'in', { s: 150, say: 'Noch zehn Minuten!' })] },
      { text: 'Die Zeit ist um. Aber Lumi ist gerade an der spannendsten Stelle!',
        lumi: { feel: 'excited' }, cast: [t('📱', HAND, 'shake', { s: 56, y: 60 }), t('⏰', 420, 'shake', { s: 70, y: 150, d: 0.4 })] },
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
          { text: 'Lumi legt das Tablet weg. Mama lächelt: „Super! Wollen wir zusammen etwas spielen?“',
            lumi: { feel: 'calm' }, cast: [c('👩', 450, 'in', { s: 150, feel: 'happy', who: true }), t('🎲', 340, 'drop', { s: 56, d: 0.8 })],
            ask: { q: 'Wie fühlt sich Mama?', who: 'Mama', feeling: 'Glücklich' } },
          { text: 'Sie spielen ein Kartenspiel. Das macht auch Spaß! Und morgen darf Lumi wieder ein bisschen spielen.',
            lumi: { feel: 'excited' }, cast: [c('👩', 450, 'none', { s: 150, feel: 'happy' }), t('🃏', 320, 'drop', { s: 54 }), t('🃏', 360, 'drop', { s: 54, d: 0.3 }), t('🌟', 300, 'bob', { s: 50, y: 190, d: 0.6 })] },
        ],
        lesson: 'Wer sich an Abmachungen hält, dem kann man vertrauen.',
      },
      sneak: {
        panels: [
          { text: 'Mama kommt herein. „Lumi, das war nicht abgemacht.“ Mama ist enttäuscht. Heute bleibt das Tablet aus.',
            lumi: { feel: 'shy' }, cast: [t('📱', HAND, 'pop', { s: 56, y: 60 }), c('👩', 450, 'in', { s: 150, feel: 'sad', who: true })],
            ask: { q: 'Wie fühlt sich Mama?', who: 'Mama', feeling: 'Traurig' } },
          { text: '„Es tut mir leid, Mama.“ Mama nimmt Lumi in den Arm: „Danke. Morgen probieren wir es nochmal.“',
            lumi: { feel: 'thankful', say: 'Es tut mir leid.' }, cast: [c('👩', 360, 'none', { s: 150, feel: 'happy' }), t('💛', 270, 'pop', { s: 44, y: 200, d: 0.8 })] },
        ],
        lesson: 'Abmachungen halten macht das Leben für alle leichter!',
      },
    },
  },
  {
    id: 'climbingframe', tier: 2, title: 'Lumi und der große Kletterturm',
    panels: [
      { text: 'Im Park steht ein großer Kletterturm. Alle Kinder klettern hinauf. Lumi bleibt unten. „Das ist so hoch … was ist, wenn ich falle?“',
        lumi: { feel: 'scared' }, cast: [t('🪜', 430, 'pop', { s: 240 }), c('🧒', 430, 'pop', { s: 70, y: 170, d: 0.5 }), c('👦', 500, 'hop', { s: 80, d: 0.8 })],
        ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Ängstlich' } },
      { text: 'Mia reicht Lumi die Hand: „Ich bin neben dir. Versuch es Schritt für Schritt!“',
        lumi: { feel: 'scared', strength: 0 }, cast: [t('🪜', 450, 'none', { s: 240 }), c('👧', 310, 'in', { s: 120, say: 'Ich bin da!' })] },
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
          { text: 'Schritt … für … Schritt. Lumi klettert! Von oben sieht die Welt ganz anders aus.',
            lumi: { feel: 'excited', x: 430, act: 'climb', up: 150, size: 110 }, cast: [t('🪜', 430, 'none', { s: 240, z: 0 }), c('👧', 300, 'none', { s: 110 })] },
          { text: '„Ich habe es geschafft!“ Alle jubeln.',
            lumi: { feel: 'proud', x: 430, y: 150, size: 110 }, cast: [t('🪜', 430, 'none', { s: 240, z: 0 }), c('👧', 300, 'hop', { s: 100 }), c('🧒', 200, 'hop', { s: 90, d: 0.3 }), t('🏆', 520, 'drop', { s: 60, y: 200, d: 0.6 })],
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Stolz' } },
        ],
        lesson: 'Mutig sein heißt nicht, keine Angst zu haben. Mutig sein heißt, es trotzdem zu versuchen!',
      },
      stay: {
        panels: [
          { text: 'Lumi bleibt unten. Das ist auch in Ordnung! Lumi weiß: Der große Turm ist heute noch zu hoch.',
            lumi: { feel: 'calm' }, cast: [t('🪜', 470, 'none', { s: 240 }), t('🌱', 320, 'pop', { s: 60 })] },
          { text: 'Lumi klettert auf den kleinen Turm, bis ganz nach oben: „Nächstes Mal probiere ich den großen!“',
            lumi: { feel: 'proud', x: 330, act: 'climb', up: 80, size: 110 }, cast: [t('🪜', 330, 'none', { s: 120, z: 0 }), t('✨', 420, 'bob', { s: 50, y: 160, d: 1.6 })],
            ask: { q: 'Wie fühlt sich Lumi jetzt?', who: 'Lumi', feeling: 'Stolz' } },
        ],
        lesson: 'Jeden Tag ein kleiner Schritt weiter, das ist auch Mut!',
      },
    },
  },
  {
    id: 'promise', tier: 2, title: 'Das Versprechen',
    panels: [
      { text: 'Lumi spielt beim Nachbarskind Ben. Lumi hat Oma versprochen, zum Abendessen pünktlich heimzukommen.',
        lumi: { feel: 'happy' }, cast: [t('🏠', 480, 'pop', { s: 180 }), c('👦', 350, 'pop', { s: 120 })] },
      { text: 'Gleich gibt es Essen. Aber Ben ruft: „Bleib doch noch! Wir bauen gerade eine Höhle!“',
        lumi: { feel: 'curious' }, cast: [t('🏠', 500, 'none', { s: 160 }), c('👦', 350, 'hop', { s: 120, say: 'Bleib doch!' }), t('🧸', 430, 'drop', { s: 50 }), t('⏰', 510, 'shake', { s: 50, y: 190 })] },
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
          { text: 'Lumi sagt „Tschüss, bis morgen!“ und geht heim. Oma wartet schon an der Tür und lacht.',
            lumi: { feel: 'happy', act: 'in' }, cast: [t('🏠', 500, 'none', { s: 170 }), c('👵', 380, 'pop', { s: 140, feel: 'happy', who: true })],
            ask: { q: 'Wie fühlt sich Oma?', who: 'Oma', feeling: 'Glücklich' } },
          { text: 'Zum Nachtisch gibt es Kuchen. „Auf dich kann man sich verlassen!“, sagt Oma.',
            lumi: { feel: 'excited' }, cast: [c('👵', 420, 'none', { s: 150, feel: 'happy' }), t('🍰', 300, 'drop', { s: 60, y: 30 })] },
        ],
        lesson: 'Wer ein Versprechen hält, auf den kann man sich verlassen!',
      },
      stay: {
        panels: [
          { text: 'Lumi spielt weiter. Da klingelt bei Ben das Telefon. Es ist Oma. Oma weiß nicht, wo Lumi bleibt.',
            lumi: { feel: 'happy' }, cast: [c('👦', 330, 'hop', { s: 110 }), t('📱', 430, 'shake', { s: 60, y: 60, d: 0.4 }), c('👵', 520, 'pop', { s: 120, y: 90, feel: 'scared', who: true, d: 0.8 })],
            ask: { q: 'Wie fühlt sich Oma?', who: 'Oma', feeling: 'Ängstlich' } },
          { text: 'Lumi läuft schnell nach Hause. Oma und Lumi nehmen sich fest in den Arm.',
            lumi: { feel: 'thankful', act: 'run' }, cast: [c('👵', 330, 'none', { s: 150, feel: 'happy' }), t('💛', 250, 'pop', { s: 44, y: 200, d: 1 })] },
        ],
        lesson: 'Versprechen sind wichtig, besonders für Menschen, die uns lieb haben.',
      },
    },
  },
  {
    id: 'wallet', tier: 2, title: 'Das gefundene Portemonnaie',
    panels: [
      { text: 'Beim Spielen im Park findet Lumi ein Portemonnaie im Gras. Darin sind Geld und ein Foto.',
        lumi: { feel: 'curious', act: 'in' }, cast: [t('🌿', 420, 'pop', { s: 110 }), t(':px-portemonnaie:', 360, 'jack', { s: 64, d: 1 })] },
      { text: 'Mama sitzt auf der Bank gleich daneben. Lumi könnte das Portemonnaie behalten … oder es Mama zeigen.',
        lumi: { feel: 'curious' }, cast: [t(':px-portemonnaie:', HAND, 'pop', { s: 56, y: 60 }), t('🪑', 470, 'pop', { s: 150 }), c('👩', 470, 'pop', { s: 120, y: 40, d: 0.3 })] },
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
          { text: 'Lumi und Mama bringen das Portemonnaie zur Polizei. Der Polizist sagt: „Das habt ihr toll gemacht!“',
            lumi: { feel: 'happy' }, cast: [c('👩', 320, 'none', { s: 120 }), c('👮', 480, 'in', { s: 150, say: 'Toll gemacht!' }), t(':px-portemonnaie:', 320, 'give', { s: 50, y: 60, to: 430, d: 1.2 })] },
          { text: 'Am nächsten Tag ruft die Besitzerin an: „Danke! Da ist das Foto von meinem Enkel drin.“',
            lumi: { feel: 'excited' }, cast: [c('👵', 420, 'pop', { s: 150, feel: 'happy', who: true }), t('💛', 320, 'pop', { s: 50, y: 180, d: 0.6 })],
            ask: { q: 'Wie fühlt sich die Besitzerin?', who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Ehrlich sein hilft anderen Menschen!',
      },
      keep: {
        panels: [
          { text: 'Zu Hause fühlt sich das Portemonnaie in der Tasche ganz schwer an.',
            lumi: { feel: 'scared', strength: 0 }, cast: [t('🏠', 470, 'pop', { s: 170 }), t(':px-portemonnaie:', HAND, 'pop', { s: 56, y: 30, d: 0.4 })] },
          { text: 'Lumi erzählt es Mama. Zusammen bringen sie es zum Fundbüro. Die Besitzerin bekommt alles zurück.',
            lumi: { feel: 'calm' }, cast: [c('👩', 360, 'in', { s: 120 }), c('👵', 500, 'in', { s: 130, feel: 'happy', who: true, d: 0.8 })],
            ask: { q: 'Wie fühlt sich die Besitzerin?', who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Einen Fehler kann man wiedergutmachen. Das ist mutig!',
      },
    },
  },
  {
    id: 'sweater', tier: 2, title: 'Der bekleckste Pulli',
    panels: [
      { text: 'Lumi malt mit Wasserfarben. Auf dem Stuhl liegt der Lieblingspulli von Lumis großer Schwester Lea.',
        lumi: { feel: 'happy' }, cast: [t('🎨', HAND, 'pop', { s: 56, y: 50 }), t('🪑', 420, 'pop', { s: 140 }), t('👕', 420, 'pop', { s: 80, y: 60, d: 0.4 })] },
      { text: 'Platsch! Ein dicker blauer Klecks landet auf dem Pulli. Lumi erschrickt. Lea ist nicht da.',
        lumi: { feel: 'scared' }, cast: [t('🪑', 420, 'none', { s: 140 }), t('👕', 420, 'none', { s: 80, y: 60 }), t('💧', 420, 'drop', { s: 44, y: 80, d: 0.3, z: 3 })],
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
          { text: '„Lea, ich habe aus Versehen auf deinen Pulli gekleckst. Es tut mir leid.“',
            lumi: { feel: 'shy', say: 'Es tut mir leid.' }, cast: [c('👧', 450, 'in', { s: 140 }), t('👕', 360, 'pop', { s: 70, y: 40 })] },
          { text: 'Lea schaut auf den Fleck und schimpft. Dann waschen sie den Pulli zusammen. Der Fleck geht raus!',
            lumi: { feel: 'calm' }, cast: [c('👧', 450, 'none', { s: 140, feel: 'angry', who: true }), t('🫧', 350, 'bob', { s: 60, y: 110, d: 0.6 }), t('👕', 360, 'pop', { s: 70, y: 30 })],
            ask: { q: 'Wie fühlt sich Lea, als sie den Fleck sieht?', who: 'Lea', feeling: 'Wütend' } },
        ],
        lesson: 'Sagen, was passiert ist, braucht Mut. Dann kann man es zusammen wiedergutmachen!',
      },
      hide: {
        panels: [
          { text: 'Lumi stopft den Pulli in den Schrank. Aber Lumi muss die ganze Zeit daran denken.',
            lumi: { feel: 'scared' }, cast: [t('🚪', 440, 'pop', { s: 170 }), t('👕', 440, 'sink', { s: 70, y: 40, d: 0.6 })],
            ask: { q: 'Wie fühlt sich Lumi?', who: 'Lumi', feeling: 'Ängstlich' } },
          { text: 'Am Abend sucht Lea den Pulli. Da sagt Lumi: „Ich war das. Es tut mir leid.“ Lea seufzt: „Gut, dass du es sagst. Komm, wir waschen ihn zusammen.“',
            lumi: { feel: 'shy', say: 'Ich war das.' }, cast: [c('👧', 450, 'in', { s: 140 }), t('🫧', 350, 'bob', { s: 60, y: 120, d: 1 })] },
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
const plain = s => s.replace(/\s*\p{Extended_Pictographic}️?/gu, '').trim()
const iconOf = s => s.match(/^\p{Extended_Pictographic}️?/u)?.[0] ?? '⭐'
// what is still where it was at the end of a scene (the lesson shows it again)
const STAYS = new Set(['none', 'pop', 'bob', 'drop', 'shake', 'hop', 'jack', 'bang', undefined])
const GO = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }

export default function StoryGame({ level = 1, onComplete }) {
  const [setup]      = useState(() => levelSetup(level))
  const { stories, faces, allAsks } = setup
  const [storyIdx,   setStoryIdx]   = useState(0)
  const [phase,      setPhase]      = useState('intro') // intro | choice | outcome | lesson | alt
  const [panelIdx,   setPanelIdx]   = useState(0)
  const [chosen,     setChosen]     = useState(null)
  const [sawAlt,     setSawAlt]     = useState(false)
  const [asking,     setAsking]     = useState(false)   // the faces are out for this panel's question
  const [answer,     setAnswer]     = useState(null)
  const [reading,    setReading]    = useState(null)    // the path being read out
  const [asked,      setAsked]      = useState(0)
  const [firstTry,   setFirstTry]   = useState(0)
  const [after, cancel] = useAfter()
  const [bursts, burst] = useBursts()
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600

  const story   = stories[storyIdx]
  const outcome = chosen ? story.outcomes[chosen] : null
  const altOption = chosen ? story.choice.options.find(o => o.value !== chosen) : null
  const beats = phase === 'intro' ? story.panels : phase === 'outcome' ? outcome.panels : phase === 'alt' ? story.outcomes[altOption.value].panels : null
  const panel = beats?.[panelIdx] ?? null
  // Levels 1-3 ask once per story: in the opening if it has a question,
  // otherwise after the choice. The other path (alt) only shows.
  const ask = panel?.ask && phase !== 'alt' && (allAsks || phase === 'intro' || !story.panels.some(p => p.ask)) ? panel.ask : null
  const stepKey = `${storyIdx}-${phase}-${panelIdx}`

  const askFaces = useMemo(() => ask
    ? shuffle([ask.feeling, ...shuffle(DECOYS[ask.feeling]).slice(0, faces - 1)])
    : [], [stepKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopNarration(), [])

  const advance = () => {
    if (panelIdx < beats.length - 1) { setPanelIdx(p => p + 1); return }
    setPanelIdx(0)
    if (phase === 'intro') setPhase('choice')
    else { setPhase('lesson'); if (phase === 'outcome') sfx.tada() }
  }

  const sayAsk = () => narrate([{ text: ask.q }, ...askFaces.map(f => ({ text: f, gap: 300 }))])
  const sayChoice = () => {
    let i = -1
    const step = () => {
      i++
      if (i >= story.choice.options.length) { setReading(null); return }
      setReading(i)
      narrate([{ text: plain(story.choice.options[i].text), gap: 300 }], { onEnd: step })
    }
    narrate([{ text: story.choice.question }], { onEnd: step })
  }
  // Everything is read aloud: the title, each scene, the question with its
  // faces, the two paths and the lesson.
  const tell = () => {
    if (panel) narrate([phase === 'intro' && panelIdx === 0 && { text: `${story.title}.` }, { text: panel.text, gap: 200 }])
    else if (phase === 'choice') sayChoice()
    else if (phase === 'lesson') narrate([{ text: outcome.lesson }])
  }

  // A scene plays and is read; then its question, or the next scene by itself
  useEffect(() => {
    setAnswer(null); setAsking(false); setReading(null)
    lockPreviews()
    if (phase === 'alt' && panelIdx === 0) narrate([{ text: `Der andere Weg: ${plain(altOption.text)}.` }, { text: panel.text, gap: 300 }])
    else tell()
    if (!panel) return
    if (ask) after(() => { setAsking(true); sayAsk() }, 300)
    else after(advance, 1400)
  }, [stepKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const giveFace = (f) => {
    if (!asking || answer) return false
    const ok = f === ask.feeling
    setAnswer(f)
    setAsked(n => n + 1)
    const who = `${ask.who} ${ask.plural ? 'sind' : 'ist'}`
    // No second try and no red cross: the face that fits shows over them,
    // and Lumi says it.
    if (ok) { setFirstTry(n => n + 1); burst(document.querySelector('[data-story-stage]') ?? undefined, 'stars'); sayRight(`${cap(who)} ${word(ask.feeling)}.`) }
    else sayWrong(`Ich glaube, ${who} eher ${word(ask.feeling)}.`)
    after(advance, 900)
    return true
  }

  const choose = (value) => {
    if (phase !== 'choice') return
    cancel()
    sfx.whoosh()
    setChosen(value)
    setPhase('outcome')
    setPanelIdx(0)
  }

  const nextStory = () => {
    if (storyIdx + 1 >= stories.length) { onComplete(result(firstTry, asked)); return }
    setStoryIdx(i => i + 1); setPanelIdx(0); setChosen(null); setPhase('intro'); setSawAlt(false)
  }

  const openAlt = () => { setSawAlt(true); setPanelIdx(0); setPhase('alt') }

  const whoIdx = panel?.cast?.findIndex(x => x.who) ?? -1
  const target = ask ? (ask.who === 'Lumi' ? 'lumi' : whoIdx) : null
  const last = outcome?.panels[outcome.panels.length - 1]
  const caption = panel ? plain(panel.text) : phase === 'lesson' ? outcome.lesson : plain(story.choice.question)

  return (
    <DragArea autoTarget={phase === 'choice' ? null : 'who'} disabled={phase !== 'choice' && (!asking || !!answer)}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px clamp(10px,3vw,28px) 14px', gap: 8, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 820 }}>
          <div style={{ flex: 1, minWidth: 0 }}><RoundTrail total={stories.length} done={storyIdx + (phase === 'lesson' ? 1 : 0)} walker="lumi" goal="🏰" size={narrow ? 34 : 42} /></div>
          <ReplayButton onClick={() => (asking && !answer ? sayAsk() : tell())} />
        </div>

        <div data-story-stage style={{ flex: 1, width: '100%', maxWidth: 980, display: 'flex', minHeight: 0 }}>
          {phase === 'choice'
            ? <Fork options={story.choice.options} reading={reading} onChoose={choose} narrow={narrow} />
            : panel
              ? <Stage key={stepKey} playKey={stepKey} cast={panel.cast} fx={panel.fx}
                  lumi={{ x: 170, size: 150, ...panel.lumi }}
                  drop={target != null && target !== -1 ? { who: target, id: 'who', onDrop: d => giveFace(d.feeling), label: ask.who } : undefined}
                  bubbles={answer && target != null ? { [target]: <Art art={FEELING_ICON[ask.feeling]} size={44} /> } : {}} />
              : <Stage key={stepKey} playKey={stepKey} cast={last.cast.filter(x => x.char || STAYS.has(x.act)).map(x => ({ ...x, act: 'none', say: undefined, d: 0 }))}
                  lumi={{ x: 170, size: 150, feel: 'happy' }} bubbles={{ lumi: <Art art="💡" size={44} /> }} />}
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: narrow ? 14 : 17, color: INK, textAlign: 'center', margin: 0, maxWidth: 680,
          background: 'rgba(255,253,247,.75)', borderRadius: 14, padding: '5px 14px', minHeight: 24 }}>{caption}</p>

        {/* clipped: the tray sliding in must not count as content height
            for the FitBox around the game */}
        <div style={{ overflow: 'clip', overflowClipMargin: 12, paddingTop: 8, width: '100%', display: 'flex', justifyContent: 'center', minHeight: narrow ? 112 : 132 }}>
          <AnimatePresence mode="wait">
            {asking && (
              <motion.div key={stepKey}
                initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{ display: 'flex', gap: narrow ? 10 : 18, justifyContent: 'center', alignItems: 'flex-end', padding: '10px 14px', borderRadius: 28, background: 'rgba(255,253,247,.55)' }}>
                {askFaces.map(f => (
                  <Draggable key={f} id={f} data={{ feeling: f }} label={f} disabled={!!answer}>
                    <FaceChip feeling={f} size={narrow ? 56 : 70} dim={!!answer && f !== ask.feeling} glow={!!answer && f === ask.feeling} />
                  </Draggable>
                ))}
              </motion.div>
            )}
            {phase === 'lesson' && (
              <motion.div key="lesson" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: '6px 0' }}>
                {!sawAlt && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={openAlt} aria-label="Und wenn Lumi anders entschieden hätte?"
                    style={{ ...pxButton('parch'), padding: '10px 18px', minHeight: 60, display: 'flex', alignItems: 'center', gap: 10, fontSize: narrow ? 15 : 17 }}>
                    <Art art="🔀" size={34} /><Art art={iconOf(altOption.text)} size={34} />
                    {!narrow && 'Der andere Weg'}
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.95 }} onClick={nextStory}
                  animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: 2 }}
                  style={{ ...GO, padding: '12px 34px', minHeight: 60, fontSize: narrow ? 18 : 22 }}>
                  {storyIdx + 1 >= stories.length ? 'Fertig! 🏆' : 'Weiter ➡️'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {bursts}
    </DragArea>
  )
}

/**
 * The fork in the path: Lumi stands in the middle, a signpost with a picture
 * on either side. Carry Lumi to one, or tap it.
 */
function Fork({ options, reading, onChoose, narrow }) {
  const size = narrow ? 96 : 150
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: narrow ? 8 : 40 }}>
      <Sign opt={options[0]} lit={reading === 0} onChoose={onChoose} narrow={narrow} side="left" />
      <Draggable id="lumi" data={{ lumi: true }} label="Lumi">
        <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>
          <FeelLumi feel="curious" size={size} />
        </motion.div>
      </Draggable>
      <Sign opt={options[1]} lit={reading === 1} onChoose={onChoose} narrow={narrow} side="right" />
    </div>
  )
}

function Sign({ opt, lit, onChoose, narrow, side }) {
  const { picked } = useDragState()
  const w = narrow ? 112 : 220
  return (
    <DropZone id={opt.value} onDrop={() => { onChoose(opt.value); return true }} label={plain(opt.text)} slop={30}>
      {hover => (
        <motion.button onClick={() => { if (!picked) onChoose(opt.value) }} aria-label={plain(opt.text)}
          animate={{ scale: hover || lit ? 1.08 : 1, rotate: side === 'left' ? -3 : 3 }}
          style={{ all: 'unset', cursor: 'pointer', width: w, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '100%', padding: narrow ? '10px 6px' : '14px 12px', borderRadius: 18, background: '#f7d9a3',
            border: '4px solid #8a4f22', boxShadow: lit || hover ? '0 0 0 5px #ffc93c, 0 6px 0 rgba(42,27,61,.35)' : '0 6px 0 rgba(42,27,61,.35)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, boxSizing: 'border-box',
          }}>
            <Art art={iconOf(opt.text)} size={narrow ? 56 : 90} />
            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: narrow ? 13 : 16, lineHeight: 1.15, color: '#2a1b3d', textAlign: 'center' }}>{plain(opt.text)}</span>
          </div>
          {/* the post */}
          <div style={{ width: 14, height: narrow ? 34 : 60, background: '#8a4f22', borderRadius: '0 0 4px 4px' }} />
        </motion.button>
      )}
    </DropZone>
  )
}
