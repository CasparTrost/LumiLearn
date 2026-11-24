import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DragArea, Draggable, DropZone, RoundTrail, Art, HintHand, useBursts, useDragState } from '../components/play/index.js'
import { stopNarration } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { shuffle } from './feelings.js'
import { Stage, FeelLumi, FaceChip, FeelingFace, AskFace, asPerson, sceneLength, useAfter, useTrayStart } from './feelingStage.jsx'
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
    id: 'forest', tier: 0, souvenir: '🍎', title: 'Lumi im Wald',
    panels: [
      { text: 'Lumi spaziert durch den bunten Herbstwald. Plötzlich hört Lumi ein leises Weinen …',
        lumi: { feel: 'curious', act: 'in' }, cast: [c('🦔', 470, 'pop', { s: 50, feel: 'sad', d: 1.2, z: 0 }), t('🌲', 420, 'pop', { s: 170 }), t('🌳', 540, 'pop', { s: 140, d: 0.2 }), t('🍂', 330, 'drop', { s: 40, d: 0.6 })] },
      { text: 'Da sitzt ein kleiner Igel. „Ich finde den Weg nach Hause nicht!“',
        lumi: { feel: 'neutral' }, cast: [t('🌲', 520, 'none', { s: 160 }), c('🦔', 360, 'pop', { feel: 'sad', s: 100, who: true, say: ['🏠', '❓'] })],
        ask: { who: 'der Igel', feeling: 'Traurig' } },
    ],
    choice: {
      options: [
        { text: '🤝 Lumi hilft dem Igel, den Weg zu finden', value: 'help', pic: ['🤝', '🦔', '🏠'] },
        { text: '🏃 Lumi läuft schnell weiter', value: 'run', pic: ['🏃', '💨'] },
      ],
    },
    outcomes: {
      help: {
        panels: [
          { text: 'Lumi hilft dem Igel. Gemeinsam finden sie den Weg.',
            lumi: { feel: 'happy' }, cast: [c('🦔', 340, 'none', { feel: 'happy', s: 100, who: true }), t('🗺️', 450, 'drop', { s: 70 })],
            ask: { who: 'der Igel', feeling: 'Glücklich' } },
          { text: '„Danke, Lumi!“ Der Igel schenkt Lumi einen glänzenden Apfel.',
            lumi: { feel: 'excited' }, cast: [c('🦔', 340, 'none', { feel: 'happy', s: 100 }), t('🍎', 340, 'give', { s: 54, y: 50, to: HAND, d: 0.6 }), t('🏠', 500, 'pop', { s: 140 })] },
        ],
        lesson: 'Helfen macht froh: den Igel und Lumi!',
      },
      run: {
        panels: [
          { text: 'Lumi läuft weiter … aber der Igel weint immer noch.',
            lumi: { feel: 'neutral', act: 'away', d: 0.4 }, cast: [t('🌲', 520, 'none', { s: 160 }), c('🦔', 360, 'none', { feel: 'sad', s: 100, who: true })],
            ask: { who: 'der Igel', feeling: 'Traurig' } },
          { text: 'Da dreht Lumi um und hilft dem Igel doch noch. Zusammen finden sie den Weg.',
            lumi: { feel: 'happy', act: 'in' }, cast: [c('🦔', 340, 'none', { feel: 'happy', s: 100, d: 1 }), t('🏠', 500, 'pop', { s: 140, d: 1 })] },
        ],
        lesson: 'Umdrehen und doch noch helfen ist auch gut!',
      },
    },
  },
  {
    id: 'bakery', tier: 0, souvenir: '🍰', title: 'Der Kuchenladen',
    panels: [
      { text: 'Lumi steht vor dem Kuchenladen. Es riecht nach frischem Kuchen!',
        lumi: { feel: 'happy', say: ['🍰'] }, cast: [t('🏪', 440, 'pop', { s: 190 })] },
      { text: 'Lumi hat nur noch eine Münze. Daneben sitzt eine kleine Maus und weint: „Ich habe so großen Hunger!“',
        lumi: { feel: 'curious' }, cast: [t('🏪', 480, 'none', { s: 170 }), c('🐭', 340, 'pop', { feel: 'sad', s: 90, who: true, say: ['🍰'] }), t('🪙', HAND, 'pop', { s: 40, y: 70 })],
        ask: { who: 'die Maus', feeling: 'Traurig' } },
    ],
    choice: {
      options: [
        { text: '🍰 Lumi kauft ein Stück Kuchen und teilt es mit der Maus', value: 'share', pic: ['🍰', '➡️', '🐭'] },
        { text: '😋 Lumi kauft das Stück Kuchen für sich allein', value: 'keep', pic: ['😋', '🍰'] },
      ],
    },
    outcomes: {
      share: {
        panels: [
          { text: 'Lumi teilt den Kuchen. Die Maus strahlt: „Danke, Lumi!“',
            lumi: { feel: 'happy' }, cast: [t('🍰', HAND, 'give', { s: 54, y: 40, to: 330, d: 0.4 }), c('🐭', 360, 'none', { feel: 'happy', s: 90, who: true })],
            ask: { who: 'die Maus', feeling: 'Glücklich' } },
          { text: 'Zusammen schmeckt der Kuchen doppelt so gut!',
            lumi: { feel: 'excited' }, cast: [c('🐭', 360, 'hop', { feel: 'excited', s: 90 }), t('🍰', 300, 'pop', { s: 50, y: 10 })] },
        ],
        lesson: 'Teilen macht froh: die Maus und auch Lumi!',
      },
      keep: {
        panels: [
          { text: 'Lumi isst den Kuchen allein. Die Maus schaut zu, und ihr Bauch knurrt.',
            lumi: { feel: 'neutral' }, cast: [t('🍰', HAND, 'pop', { s: 54, y: 60 }), c('🐭', 400, 'none', { feel: 'sad', s: 90, who: true, say: ['🍰'] })],
            ask: { who: 'die Maus', feeling: 'Traurig' } },
          { text: 'Irgendwie schmeckt der Kuchen heute nicht so gut. Da gibt Lumi der Maus das letzte Stück.',
            lumi: { feel: 'calm' }, cast: [t('🍰', HAND, 'give', { s: 50, y: 40, to: 370, d: 1 }), c('🐭', 400, 'none', { feel: 'happy', s: 90 })] },
        ],
        lesson: 'Beim nächsten Mal kann Lumi gleich teilen. Das fühlt sich gut an.',
      },
    },
  },
  {
    id: 'playground', tier: 0, souvenir: '🛝', title: 'Auf dem Spielplatz',
    panels: [
      { text: 'Lumi will rutschen. Aber vor der Rutsche wartet schon eine lange Reihe Kinder.',
        lumi: { feel: 'curious', act: 'in' }, cast: [t('🛝', 520, 'pop', { s: 170 }), c('👦', 440, 'pop', { s: 90 }), c('👧', 375, 'pop', { s: 90, d: 0.2 }), c('🧒', 310, 'pop', { s: 90, d: 0.4 })] },
      { text: 'Ein Kind ganz vorne ruft: „Komm, Lumi, stell dich vor mich!“',
        lumi: { feel: 'neutral' }, cast: [t('🛝', 520, 'none', { s: 170 }), c('👦', 440, 'hop', { s: 90, say: ['👋'] }), c('👧', 375, 'none', { s: 90 }), c('🧒', 310, 'none', { s: 90 })] },
    ],
    choice: {
      options: [
        { text: '⏳ Lumi stellt sich hinten an', value: 'wait', pic: ['⏳', '🛝'] },
        { text: '🏃 Lumi drängelt sich vor', value: 'skip', pic: ['🏃', '💨', '🛝'] },
      ],
    },
    outcomes: {
      wait: {
        panels: [
          { text: 'Lumi wartet, bis Lumi dran ist. Die anderen Kinder lächeln.',
            lumi: { feel: 'calm' }, cast: [t('🛝', 520, 'none', { s: 170 }), c('👦', 440, 'none', { s: 90, feel: 'happy' }), c('👧', 375, 'none', { s: 90, feel: 'happy' }), c('🧒', 310, 'none', { s: 90, feel: 'happy' })] },
          { text: 'Dann rutschen alle nacheinander, immer wieder. Juhu!',
            lumi: { feel: 'excited', act: 'hop' }, cast: [t('🛝', 480, 'none', { s: 170 }), c('👦', 360, 'hop', { s: 90 }), c('👧', 560, 'hop', { s: 90, d: 0.3 })],
            ask: { who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Wenn alle der Reihe nach drankommen, ist es fair.',
      },
      skip: {
        panels: [
          { text: 'Lumi drängelt sich vor. Die Kinder hinten rufen: „Das ist unfair!“',
            lumi: { feel: 'neutral', x: 440 }, cast: [t('🛝', 560, 'none', { s: 150 }), c('👧', 300, 'none', { s: 90, feel: 'angry', who: true }), c('🧒', 220, 'none', { s: 90, feel: 'angry' }), c('👦', 140, 'none', { s: 90, feel: 'angry' })],
            ask: { who: 'die anderen Kinder', plural: true, feeling: 'Wütend' } },
          { text: 'Lumi sieht die Gesichter und sagt: „Entschuldigung!“ Dann stellt sich Lumi hinten an.',
            lumi: { feel: 'shy', say: ['💛'] }, cast: [t('🛝', 520, 'none', { s: 170 }), c('👦', 440, 'none', { s: 90 }), c('👧', 375, 'none', { s: 90 }), c('🧒', 310, 'none', { s: 90 })] },
        ],
        lesson: 'Sich entschuldigen ist mutig. Jeder macht mal Fehler!',
      },
    },
  },
  {
    id: 'kitten', tier: 0, souvenir: '🐾', title: 'Das Kätzchen im Regen',
    panels: [
      { text: 'Es regnet. Auf dem Heimweg hört Lumi ein leises Miauen. Unter einer Bank sitzt ein kleines Kätzchen, ganz nass.', fx: 'rain',
        lumi: { feel: 'curious', act: 'in' }, cast: [t('🪑', 400, 'pop', { s: 140 }), c('🐱', 400, 'pop', { s: 70, d: 0.8, feel: 'scared', z: 0 })] },
      { text: 'Das Kätzchen zittert und duckt sich ganz tief. Es hat kein Halsband.', fx: 'rain',
        lumi: { feel: 'neutral' }, cast: [t('🪑', 400, 'none', { s: 140 }), c('🐱', 400, 'none', { s: 80, feel: 'scared', who: true, z: 0 })],
        ask: { who: 'das Kätzchen', feeling: 'Ängstlich' } },
    ],
    choice: {
      options: [
        // Fremde Tiere fasst man nicht an — man holt einen Erwachsenen.
        { text: '🏠 Lumi holt schnell Mama und zeigt ihr das Kätzchen', value: 'help', pic: ['🐱', '➡️', '👩'] },
        { text: '🚶 Lumi geht weiter. Vielleicht hilft ja jemand anderes.', value: 'leave', pic: ['🚶', '💨'] },
      ],
    },
    outcomes: {
      help: {
        panels: [
          { text: 'Mama wickelt das Kätzchen in ein warmes Handtuch. „Wir suchen den Besitzer“, sagt Mama.',
            lumi: { feel: 'happy' }, cast: [c('👩', 450, 'in', { s: 150 }), c('🐱', 360, 'none', { s: 70 }), t('🧣', 360, 'drop', { s: 60, y: 10, d: 1, z: 3 }), t('🏠', 560, 'pop', { s: 100 })] },
          { text: 'Am nächsten Tag finden sie die Besitzerin. Sie drückt ihr Kätzchen ganz fest an sich.',
            lumi: { feel: 'excited' }, cast: [c('👧', 420, 'in', { s: 140, feel: 'happy', who: true }), c('🐱', 340, 'none', { s: 70, feel: 'happy', d: 0.6 })],
            ask: { who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Wenn ein Tier Hilfe braucht, holen wir einen Erwachsenen.',
      },
      leave: {
        panels: [
          { text: 'Lumi geht weiter … aber das leise Miauen geht Lumi nicht aus dem Kopf.', fx: 'rain',
            lumi: { feel: 'sad', strength: 0 }, cast: [t('🪑', 520, 'none', { s: 110 }), c('🐱', 520, 'none', { s: 60, feel: 'scared', z: 0 })] },
          { text: 'Lumi läuft zurück und holt Mama. Nach einer langen Stunde voller Sorgen liegt das Kätzchen endlich im Warmen.',
            lumi: { feel: 'calm', act: 'run' }, cast: [c('👩', 450, 'in', { s: 150 }), c('🐱', 350, 'none', { s: 70, feel: 'happy', who: true })],
            ask: { who: 'das Kätzchen', feeling: 'Glücklich' } },
        ],
        lesson: 'Auf das eigene Herz zu hören ist eine gute Idee.',
      },
    },
  },
  {
    id: 'rain', tier: 0, souvenir: '🍪', title: 'Der Regentag',
    panels: [
      { text: 'Es regnet! Lumi wollte draußen spielen. Das ist schade …', fx: 'rain',
        lumi: { feel: 'sad', say: ['⚽'] }, cast: [t('🪟', 430, 'pop', { s: 160, y: 60 })],
        ask: { who: 'Lumi', feeling: 'Traurig' } },
      { text: 'Oma fragt: „Lumi, backst du mit mir Plätzchen? Oder schaust du ein Bilderbuch an?“',
        lumi: { feel: 'curious' }, cast: [c('👵', 450, 'in', { s: 150, say: ['🍪', '📚'] })] },
    ],
    choice: {
      options: [
        { text: '🍪 Lumi backt mit Oma Plätzchen', value: 'bake', pic: ['🍪', '👵'] },
        { text: '📚 Lumi schaut gemütlich ein Bilderbuch an', value: 'book', pic: ['📚', '🛋️'] },
      ],
    },
    outcomes: {
      bake: {
        panels: [
          { text: 'Zusammen backen sie Plätzchen für die ganze Familie.',
            lumi: { feel: 'excited' }, cast: [c('👵', 460, 'none', { s: 150 }), t('🍪', 320, 'drop', { s: 50 }), t('🍪', 370, 'drop', { s: 50, d: 0.3 }), t('🍪', 345, 'drop', { s: 50, y: 40, d: 0.6 })] },
          { text: 'Oma erzählt dabei lustige Geschichten. Es ist der schönste Regentag aller Zeiten!',
            lumi: { feel: 'happy' }, cast: [c('👵', 440, 'none', { s: 150, feel: 'happy' }), t('🍪', 330, 'pop', { s: 50 }), t('☔', 560, 'pop', { s: 80, y: 100 })],
            ask: { who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Auch an Regentagen kann man zusammen viel Schönes erleben!',
      },
      book: {
        panels: [
          { text: 'Lumi kuschelt sich aufs Sofa und schaut ein spannendes Bilderbuch an.',
            lumi: { feel: 'curious' }, cast: [t('🛋️', 420, 'pop', { s: 170 }), t('📖', HAND, 'pop', { s: 60, y: 60, d: 0.4 })] },
          { text: '„Lumi, die Plätzchen sind fertig!“ Oma hat trotzdem welche für Lumi gebacken.',
            lumi: { feel: 'excited' }, cast: [c('👵', 450, 'in', { s: 150 }), t('🍪', 380, 'give', { s: 54, y: 60, to: HAND, d: 1 })],
            ask: { who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'In Bilderbüchern kann man tolle Abenteuer erleben!',
      },
    },
  },
  {
    id: 'lunchbox', tier: 1, souvenir: '🥪', title: 'Kein Frühstück',
    panels: [
      { text: 'In der Pause macht Lumi die Brotdose auf. Leckere Butterbrote! Aber Jonas sitzt still daneben und schaut auf den Boden.',
        lumi: { feel: 'happy' }, cast: [t('🥪', HAND, 'pop', { s: 56, y: 50 }), c('👦', 420, 'pop', { s: 130, feel: 'sad', d: 0.8 })] },
      { text: '„Hast du etwas vergessen?“, fragt Lumi. „Meine Brotdose …“, flüstert Jonas.',
        lumi: { feel: 'curious' }, cast: [c('👦', 420, 'none', { s: 130, feel: 'sad', who: true, say: ['🥪', '❓'] }), t('🎒', 520, 'drop', { s: 70 })],
        ask: { who: 'Jonas', feeling: 'Traurig' } },
    ],
    choice: {
      options: [
        { text: '🥪 Lumi teilt das Brot mit Jonas', value: 'share', pic: ['🥪', '➡️', '👦'] },
        { text: '😶 Lumi isst allein. Es ist ja Lumis Brot.', value: 'keep', pic: ['😋', '🥪'] },
      ],
    },
    outcomes: {
      share: {
        panels: [
          { text: '„Möchtest du die Hälfte?“ Jonas strahlt über das ganze Gesicht.',
            lumi: { feel: 'happy' }, cast: [c('👦', 420, 'none', { s: 130, feel: 'happy', who: true }), t('🥪', HAND, 'give', { s: 50, y: 40, to: 360, d: 0.3 })],
            ask: { who: 'Jonas', feeling: 'Glücklich' } },
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
            ask: { who: 'Jonas', feeling: 'Glücklich' } },
        ],
        lesson: 'Es ist nie zu spät, das Richtige zu tun.',
      },
    },
  },
  {
    id: 'vase', tier: 1, souvenir: '🧹', title: 'Die zerbrochene Vase',
    panels: [
      { text: 'Peng! Beim Spielen stößt Lumi aus Versehen Omas Lieblingsvase vom Tisch. Überall liegen Scherben. Vorsicht, die sind scharf! Lumi fasst sie nicht an.',
        lumi: { feel: 'surprised' }, cast: [t(':px-tisch:', 410, 'pop', { s: 150 }), t('🏺', 410, 'fall', { s: 70, y: 110, d: 0.8 }), t('💥', 430, 'bang', { s: 90, y: 10, d: 1.6 })] },
      { text: 'Oma ist noch einkaufen. Lumis Herz klopft ganz schnell. Lumi könnte nichts sagen … oder die Wahrheit sagen.',
        lumi: { feel: 'scared', say: ['🙈', '🗣️'] }, cast: [t(':px-tisch:', 440, 'none', { s: 150 }), t('🏺', 340, 'none', { s: 60, rot: 100 })],
        ask: { who: 'Lumi', feeling: 'Ängstlich' } },
    ],
    choice: {
      options: [
        { text: '🗣️ Lumi erzählt Oma die Wahrheit, sobald sie heimkommt', value: 'truth', pic: ['🗣️', '👵'] },
        { text: '🙈 Lumi sagt nichts und hofft, dass Oma es nicht merkt', value: 'hide', pic: ['🙈', '🏺'] },
      ],
    },
    outcomes: {
      truth: {
        panels: [
          { text: 'Oma kommt nach Hause. „Oma, ich muss dir etwas sagen …“',
            lumi: { feel: 'shy', say: ['🏺', '💥'] }, cast: [c('👵', 450, 'in', { s: 150 }), t('🏺', 340, 'none', { s: 60, rot: 100 })] },
          { text: 'Oma schaut auf die Scherben. Dann nimmt sie Lumi in den Arm: „Danke, dass du ehrlich bist!“ Zusammen kehren sie die Scherben auf.',
            lumi: { feel: 'happy' }, cast: [c('👵', 400, 'none', { s: 150, feel: 'happy' }), t('🧹', 500, 'shake', { s: 80, d: 0.6 }), t('❤️', 300, 'pop', { s: 44, y: 180, d: 0.8 })],
            ask: { who: 'Lumi', feeling: 'Glücklich' } },
        ],
        lesson: 'Die Wahrheit zu sagen ist mutig. Danach ist das Herz viel leichter!',
      },
      hide: {
        panels: [
          { text: 'Lumi sagt nichts. Aber das Geheimnis liegt Lumi wie ein Stein im Bauch.',
            lumi: { feel: 'scared', strength: 2 }, cast: [t(':px-tisch:', 440, 'none', { s: 150 }), t('🪨', HAND + 20, 'drop', { s: 44, y: 60, d: 0.8 })],
            ask: { who: 'Lumi', feeling: 'Ängstlich' } },
          { text: 'Beim Abendessen sagt Lumi: „Oma, ich war das mit der Vase.“ Oma nickt: „Gut, dass du es mir sagst.“',
            lumi: { feel: 'calm', say: ['🏺', '💥'] }, cast: [c('👵', 450, 'none', { s: 150 }), t('🍲', 350, 'pop', { s: 60, y: 10 })] },
        ],
        lesson: 'Ein Geheimnis, das drückt, erzählt man besser. Ehrlich sein macht frei!',
      },
    },
  },
  {
    id: 'newkid', tier: 1, souvenir: '🎀', title: 'Das neue Mädchen',
    panels: [
      { text: 'Im Kindergarten gibt es ein neues Mädchen: Emma. Emma steht ganz allein in der Ecke und schaut auf den Boden.',
        lumi: { feel: 'curious' }, cast: [t('🏫', 520, 'pop', { s: 160 }), c('👧', 390, 'pop', { s: 120, feel: 'sad', who: true, d: 0.4 })],
        ask: { who: 'Emma', feeling: 'Traurig' } },
      { text: 'Lumis Freunde rufen: „Lumi, komm spielen!“ Lumi schaut zu Emma, dann zu den Freunden.',
        lumi: { feel: 'curious' }, cast: [c('🧒', 320, 'hop', { s: 90, say: ['⚽'] }), c('👦', 400, 'hop', { s: 90, d: 0.3 }), c('👧', 540, 'none', { s: 110, feel: 'sad' })] },
    ],
    choice: {
      options: [
        { text: '👋 Lumi geht zu Emma und sagt Hallo', value: 'approach', pic: ['👋', '👧'] },
        { text: '🏃 Lumi rennt zu den anderen Freunden', value: 'ignore', pic: ['🏃', '⚽'] },
      ],
    },
    outcomes: {
      approach: {
        panels: [
          { text: '„Hallo! Ich bin Lumi. Willst du mitspielen?“ Emmas Gesicht leuchtet auf!',
            lumi: { feel: 'happy', say: ['👋'] }, cast: [c('👧', 400, 'none', { s: 120, feel: 'happy', who: true })],
            ask: { who: 'Emma', feeling: 'Glücklich' } },
          { text: 'Am Ende des Tages hat Lumi eine neue Freundin. „Danke, dass du so nett warst!“, sagt Emma.',
            lumi: { feel: 'excited' }, cast: [c('👧', 400, 'hop', { s: 120, feel: 'excited' }), t('💛', 290, 'pop', { s: 50, y: 180, d: 0.4 })] },
        ],
        lesson: 'Ein freundliches Hallo kann für andere ganz viel bedeuten!',
      },
      ignore: {
        panels: [
          { text: 'Lumi spielt … aber Emma steht immer noch allein da und weint.',
            lumi: { feel: 'neutral', act: 'hop' }, cast: [c('🧒', 300, 'hop', { s: 90 }), c('👦', 380, 'hop', { s: 90, d: 0.3 }), c('👧', 530, 'none', { s: 110, feel: 'sad', who: true })],
            ask: { who: 'Emma', feeling: 'Traurig' } },
          { text: 'Da geht Lumi zu Emma: „Willst du mitspielen?“ Emma lächelt. Sie hat lange allein gewartet.',
            lumi: { feel: 'calm', say: ['⚽', '❓'] }, cast: [c('👧', 420, 'none', { s: 120, feel: 'happy' })] },
        ],
        lesson: 'Es ist nie zu spät, freundlich zu sein. Aber früher ist noch besser!',
      },
    },
  },
  {
    id: 'swing', tier: 1, souvenir: '🌸', title: 'Die Schaukel',
    panels: [
      { text: 'Lumi schaukelt hoch in den Himmel. Juhu!',
        lumi: { feel: 'excited', x: 300, y: 40, act: 'swing' }, cast: [t(ROCK, 300, 'none', { s: 230 })] },
      { text: 'Da kommt Ida. Ida möchte auch so gern schaukeln. Aber es gibt nur eine Schaukel.',
        lumi: { feel: 'curious', x: 300, y: 40, size: 130 }, cast: [t(ROCK, 300, 'none', { s: 230 }), c('👧', 500, 'in', { s: 130, say: [ROCK] })] },
    ],
    choice: {
      options: [
        { text: '🔁 Lumi schaukelt noch zehnmal und wechselt dann mit Ida ab', value: 'turns', pic: ['🔁', ':px-schaukel:'] },
        { text: '🤝 Lumi lässt Ida gleich schaukeln und schubst sie an', value: 'now', pic: ['🤝', ':px-schaukel:'] },
      ],
    },
    outcomes: {
      turns: {
        panels: [
          { text: 'Lumi zählt laut bis zehn. Dann darf Ida schaukeln.',
            lumi: { feel: 'happy', x: 300, y: 40, size: 130, act: 'swing', say: '10' }, cast: [t(ROCK, 300, 'none', { s: 230 }), c('👧', 500, 'none', { s: 130 })] },
          { text: 'So wechseln sie sich ab, immer wieder. Ida lacht laut.',
            lumi: { feel: 'happy', x: 140 }, cast: [t(ROCK, 330, 'none', { s: 230 }), c('👧', 330, 'swing', { s: 166, y: 14, z: 2, sit: true, feel: 'happy', who: true })],
            ask: { who: 'Ida', feeling: 'Glücklich' } },
        ],
        lesson: 'Abwechseln ist fair. So kommt jeder dran!',
      },
      now: {
        panels: [
          { text: 'Ida schaukelt, und Lumi schubst sie an. Höher, höher!',
            lumi: { feel: 'happy', x: 140 }, cast: [t(ROCK, 330, 'none', { s: 230 }), c('👧', 330, 'swing', { s: 166, y: 14, z: 2, sit: true, feel: 'happy', who: true })],
            ask: { who: 'Ida', feeling: 'Glücklich' } },
          { text: 'Danach darf Lumi wieder. Jetzt schubst Ida.',
            lumi: { feel: 'excited', x: 300, y: 40, size: 130, act: 'swing' }, cast: [t(ROCK, 300, 'none', { s: 230 }), c('👧', 490, 'none', { s: 130, feel: 'happy' })] },
        ],
        lesson: 'Zusammen schaukeln macht doppelt Spaß!',
      },
    },
  },
  {
    id: 'screentime', tier: 1, souvenir: '🃏', title: 'Das Tablet',
    panels: [
      { text: 'Lumi spielt schon lange auf dem Tablet. Mama sagt: „Noch zehn Minuten, dann ist Pause.“',
        lumi: { feel: 'happy' }, cast: [t('📱', HAND, 'pop', { s: 56, y: 60 }), c('👩', 460, 'in', { s: 150, say: ['⏰'] })] },
      { text: 'Die Zeit ist um. Aber Lumi ist gerade an der spannendsten Stelle!',
        lumi: { feel: 'excited' }, cast: [t('📱', HAND, 'shake', { s: 56, y: 60 }), t('⏰', 420, 'shake', { s: 70, y: 150, d: 0.4 })] },
    ],
    choice: {
      options: [
        { text: '✅ Lumi macht das Tablet aus', value: 'stop', pic: ['📱', '💤'] },
        { text: '🤫 Lumi spielt heimlich weiter', value: 'sneak', pic: ['🤫', '📱'] },
      ],
    },
    outcomes: {
      stop: {
        panels: [
          { text: 'Lumi legt das Tablet weg. Mama lächelt: „Super! Wollen wir zusammen etwas spielen?“',
            lumi: { feel: 'calm' }, cast: [c('👩', 450, 'in', { s: 150, feel: 'happy', who: true }), t('🎲', 340, 'drop', { s: 56, d: 0.8 })],
            ask: { who: 'Mama', feeling: 'Glücklich' } },
          { text: 'Sie spielen ein Kartenspiel. Das macht auch Spaß! Und morgen darf Lumi wieder ein bisschen spielen.',
            lumi: { feel: 'excited' }, cast: [c('👩', 450, 'none', { s: 150, feel: 'happy' }), t('🃏', 320, 'drop', { s: 54 }), t('🃏', 360, 'drop', { s: 54, d: 0.3 }), t('🌟', 300, 'bob', { s: 50, y: 190, d: 0.6 })] },
        ],
        lesson: 'Wer sich an Abmachungen hält, dem kann man vertrauen.',
      },
      sneak: {
        panels: [
          { text: 'Mama kommt herein. „Lumi, das war nicht abgemacht.“ Mama ist enttäuscht. Heute bleibt das Tablet aus.',
            lumi: { feel: 'shy' }, cast: [t('📱', HAND, 'pop', { s: 56, y: 60 }), c('👩', 450, 'in', { s: 150, feel: 'sad', who: true })],
            ask: { who: 'Mama', feeling: 'Traurig' } },
          { text: '„Es tut mir leid, Mama.“ Mama nimmt Lumi in den Arm: „Danke. Morgen probieren wir es nochmal.“',
            lumi: { feel: 'thankful', say: ['💛'] }, cast: [c('👩', 360, 'none', { s: 150, feel: 'happy' }), t('💛', 270, 'pop', { s: 44, y: 200, d: 0.8 })] },
        ],
        lesson: 'Abmachungen halten macht das Leben für alle leichter!',
      },
    },
  },
  {
    id: 'climbingframe', tier: 2, souvenir: '🏆', title: 'Lumi und der große Kletterturm',
    panels: [
      { text: 'Im Park steht ein großer Kletterturm. Alle Kinder klettern hinauf. Lumi bleibt unten. „Das ist so hoch … was ist, wenn ich falle?“',
        lumi: { feel: 'scared' }, cast: [t(':px-klettergeruest:', 430, 'pop', { s: 240 }), c('🧒', 330, 'hop', { s: 70, d: 0.5 }), c('👦', 500, 'hop', { s: 80, d: 0.8 })],
        ask: { who: 'Lumi', feeling: 'Ängstlich' } },
      { text: 'Mia reicht Lumi die Hand: „Ich bin neben dir. Versuch es Schritt für Schritt!“',
        lumi: { feel: 'scared', strength: 0 }, cast: [t(':px-klettergeruest:', 450, 'none', { s: 240 }), c('👧', 310, 'in', { s: 120, say: ['🤝'] })] },
    ],
    choice: {
      options: [
        { text: '🧗 Lumi versucht es, Schritt für Schritt', value: 'brave', pic: ['🧗', ':px-klettergeruest:'] },
        { text: '🌳 Lumi bleibt lieber unten', value: 'stay', pic: ['🌱', ':px-klettergeruest:'] },
      ],
    },
    outcomes: {
      brave: {
        panels: [
          { text: 'Schritt … für … Schritt. Lumi klettert! Von oben sieht die Welt ganz anders aus.',
            lumi: { feel: 'excited', x: 430, act: 'climb', up: 115, size: 100 }, cast: [t(':px-klettergeruest:', 430, 'none', { s: 210, z: 0 }), c('👧', 300, 'none', { s: 110 })] },
          { text: '„Ich habe es geschafft!“ Alle jubeln.',
            lumi: { feel: 'proud', x: 430, y: 115, size: 100 }, cast: [t(':px-klettergeruest:', 430, 'none', { s: 210, z: 0 }), c('👧', 300, 'hop', { s: 100 }), c('🧒', 200, 'hop', { s: 90, d: 0.3 }), t('🏆', 530, 'drop', { s: 60, y: 150, d: 0.6 })],
            ask: { who: 'Lumi', feeling: 'Stolz' } },
        ],
        lesson: 'Mutig sein heißt nicht, keine Angst zu haben. Mutig sein heißt, es trotzdem zu versuchen!',
      },
      stay: {
        panels: [
          { text: 'Lumi bleibt unten. Das ist auch in Ordnung! Lumi weiß: Der große Turm ist heute noch zu hoch.',
            lumi: { feel: 'calm' }, cast: [t(':px-klettergeruest:', 470, 'none', { s: 240 }), t('🌱', 320, 'pop', { s: 60 })] },
          { text: 'Lumi klettert auf den kleinen Turm, bis ganz nach oben: „Nächstes Mal probiere ich den großen!“',
            lumi: { feel: 'proud', x: 330, act: 'climb', up: 80, size: 110 }, cast: [t(':px-klettergeruest:', 330, 'none', { s: 120, z: 0 }), t('✨', 420, 'bob', { s: 50, y: 160, d: 1.6 })],
            ask: { who: 'Lumi', feeling: 'Stolz' } },
        ],
        lesson: 'Jeden Tag ein kleiner Schritt weiter, das ist auch Mut!',
      },
    },
  },
  {
    id: 'promise', tier: 2, souvenir: '⏰', title: 'Das Versprechen',
    panels: [
      { text: 'Lumi spielt beim Nachbarskind Ben. Lumi hat Oma versprochen, zum Abendessen pünktlich heimzukommen.',
        lumi: { feel: 'happy', say: ['👵', '🍲'] }, cast: [t('🏠', 480, 'pop', { s: 180 }), c('👦', 350, 'pop', { s: 120 })] },
      { text: 'Gleich gibt es Essen. Aber Ben ruft: „Bleib doch noch! Wir bauen gerade eine Höhle!“',
        lumi: { feel: 'curious' }, cast: [t('🏠', 500, 'none', { s: 160 }), c('👦', 350, 'hop', { s: 120, say: ['⛺'] }), t('🧸', 430, 'drop', { s: 50 }), t('⏰', 510, 'shake', { s: 50, y: 190 })] },
    ],
    choice: {
      options: [
        { text: '🏠 Lumi geht pünktlich nach Hause, wie versprochen', value: 'promise', pic: ['🏠', '👵'] },
        { text: '🧸 Lumi bleibt noch ein bisschen bei Ben', value: 'stay', pic: ['🧸', '👦'] },
      ],
    },
    outcomes: {
      promise: {
        panels: [
          { text: 'Lumi sagt „Tschüss, bis morgen!“ und geht heim. Oma wartet schon an der Tür und lacht.',
            lumi: { feel: 'happy', act: 'in' }, cast: [t('🏠', 500, 'none', { s: 170 }), c('👵', 380, 'pop', { s: 140, feel: 'happy', who: true })],
            ask: { who: 'Oma', feeling: 'Glücklich' } },
          { text: 'Zum Nachtisch gibt es Kuchen. „Auf dich kann man sich verlassen!“, sagt Oma.',
            lumi: { feel: 'excited' }, cast: [c('👵', 420, 'none', { s: 150, feel: 'happy' }), t('🍰', 300, 'drop', { s: 60, y: 30 })] },
        ],
        lesson: 'Wer ein Versprechen hält, auf den kann man sich verlassen!',
      },
      stay: {
        panels: [
          { text: 'Lumi spielt weiter. Da klingelt bei Ben das Telefon. Es ist Oma. Oma weiß nicht, wo Lumi bleibt.',
            lumi: { feel: 'happy' }, cast: [c('👦', 330, 'hop', { s: 110 }), t('📱', 430, 'shake', { s: 60, y: 60, d: 0.4 }), c('👵', 530, 'pop', { s: 110, feel: 'scared', who: true, d: 0.8, say: ['📱'] })],
            ask: { who: 'Oma', feeling: 'Ängstlich' } },
          { text: 'Lumi läuft schnell nach Hause. Oma und Lumi nehmen sich fest in den Arm.',
            lumi: { feel: 'thankful', act: 'run' }, cast: [c('👵', 330, 'none', { s: 150, feel: 'happy' }), t('💛', 250, 'pop', { s: 44, y: 200, d: 1 })] },
        ],
        lesson: 'Versprechen sind wichtig, besonders für Menschen, die uns lieb haben.',
      },
    },
  },
  {
    id: 'wallet', tier: 2, souvenir: '📷', title: 'Das gefundene Portemonnaie',
    panels: [
      { text: 'Beim Spielen im Park findet Lumi ein Portemonnaie im Gras. Darin sind Geld und ein Foto.',
        lumi: { feel: 'curious', act: 'in' }, cast: [t('🌿', 420, 'pop', { s: 110 }), t(':px-portemonnaie:', 360, 'jack', { s: 64, d: 1 })] },
      { text: 'Mama steht gleich daneben. Lumi könnte das Portemonnaie behalten … oder es Mama zeigen.',
        lumi: { feel: 'curious' }, cast: [t(':px-portemonnaie:', HAND, 'pop', { s: 56, y: 60 }), t('🪑', 420, 'pop', { s: 130 }), c('👩', 540, 'pop', { s: 120, d: 0.3 })] },
    ],
    choice: {
      options: [
        { text: '👮 Lumi bringt das Portemonnaie mit Mama zur Polizei', value: 'return', pic: ['👮', ':px-portemonnaie:'] },
        { text: '💰 Lumi steckt das Portemonnaie in die eigene Tasche', value: 'keep', pic: ['💰', '🎒'] },
      ],
    },
    outcomes: {
      return: {
        panels: [
          { text: 'Lumi und Mama bringen das Portemonnaie zur Polizei. Der Polizist sagt: „Das habt ihr toll gemacht!“',
            lumi: { feel: 'happy' }, cast: [c('👩', 320, 'none', { s: 120 }), c('👮', 480, 'in', { s: 150, say: ['👍'] }), t(':px-portemonnaie:', 320, 'give', { s: 50, y: 60, to: 430, d: 1.2 })] },
          { text: 'Am nächsten Tag ruft die Besitzerin an: „Danke! Da ist das Foto von meinem Enkel drin.“',
            lumi: { feel: 'excited' }, cast: [c('👵', 420, 'pop', { s: 150, feel: 'happy', who: true, say: [':px-portemonnaie:', '❤️'] }), t('💛', 320, 'pop', { s: 50, y: 180, d: 0.6 })],
            ask: { who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Ehrlich sein hilft anderen Menschen!',
      },
      keep: {
        panels: [
          { text: 'Zu Hause fühlt sich das Portemonnaie in der Tasche ganz schwer an.',
            lumi: { feel: 'scared', strength: 0 }, cast: [t('🏠', 470, 'pop', { s: 170 }), t(':px-portemonnaie:', HAND, 'pop', { s: 56, y: 30, d: 0.4 })] },
          { text: 'Lumi erzählt es Mama. Zusammen bringen sie es zum Fundbüro. Die Besitzerin bekommt alles zurück.',
            lumi: { feel: 'calm' }, cast: [c('👩', 360, 'in', { s: 120 }), c('👵', 500, 'in', { s: 130, feel: 'happy', who: true, d: 0.8 })],
            ask: { who: 'die Besitzerin', feeling: 'Glücklich' } },
        ],
        lesson: 'Einen Fehler kann man wiedergutmachen. Das ist mutig!',
      },
    },
  },
  {
    id: 'sweater', tier: 2, souvenir: '🫧', title: 'Der bekleckste Pulli',
    panels: [
      { text: 'Lumi malt mit Wasserfarben. Auf dem Stuhl liegt der Lieblingspulli von Lumis großer Schwester Lea.',
        lumi: { feel: 'happy' }, cast: [t('🎨', HAND, 'pop', { s: 56, y: 50 }), t('🪑', 420, 'pop', { s: 140 }), t('👕', 420, 'pop', { s: 80, y: 60, d: 0.4 })] },
      { text: 'Platsch! Ein dicker blauer Klecks landet auf dem Pulli. Lumi erschrickt. Lea ist nicht da.',
        lumi: { feel: 'scared' }, cast: [t('🪑', 420, 'none', { s: 140 }), t('👕', 420, 'none', { s: 80, y: 60 }), t('💧', 420, 'drop', { s: 44, y: 80, d: 0.3, z: 3 })],
        ask: { who: 'Lumi', feeling: 'Ängstlich' } },
    ],
    choice: {
      options: [
        { text: '🗣️ Lumi erzählt Lea, was passiert ist', value: 'tell', pic: ['🗣️', '👧'] },
        { text: '🙈 Lumi stopft den Pulli ganz hinten in den Schrank', value: 'hide', pic: ['🙈', '👕'] },
      ],
    },
    outcomes: {
      tell: {
        panels: [
          { text: '„Lea, ich habe aus Versehen auf deinen Pulli gekleckst. Es tut mir leid.“',
            lumi: { feel: 'shy', say: ['👕', '💧'] }, cast: [c('👧', 450, 'in', { s: 140 })] },
          { text: 'Lea schaut auf den Fleck und schimpft. Dann waschen sie den Pulli zusammen. Der Fleck geht raus!',
            lumi: { feel: 'calm' }, cast: [c('👧', 450, 'none', { s: 140, feel: 'angry', who: true }), t('🫧', 350, 'bob', { s: 60, y: 110, d: 0.6 }), t('👕', 360, 'pop', { s: 70, y: 30 })],
            ask: { who: 'Lea', feeling: 'Wütend' } },
        ],
        lesson: 'Sagen, was passiert ist, braucht Mut. Dann kann man es zusammen wiedergutmachen!',
      },
      hide: {
        panels: [
          { text: 'Lumi stopft den Pulli in den Schrank. Aber Lumi muss die ganze Zeit daran denken.',
            lumi: { feel: 'scared' }, cast: [t(':px-kleiderschrank:', 440, 'pop', { s: 170 }), t('👕', 440, 'sink', { s: 70, y: 40, d: 0.6 })],
            ask: { who: 'Lumi', feeling: 'Ängstlich' } },
          { text: 'Am Abend sucht Lea den Pulli. Da sagt Lumi: „Ich war das. Es tut mir leid.“ Lea seufzt: „Gut, dass du es sagst. Komm, wir waschen ihn zusammen.“',
            lumi: { feel: 'shy', say: ['👕', '💧'] }, cast: [c('👧', 450, 'in', { s: 140 }), t('🫧', 350, 'bob', { s: 60, y: 120, d: 1 })] },
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
  return { stories: pool.slice(0, count), faces: level <= 3 ? 2 : 3 }
}

const plain = s => s.replace(/\s*\p{Extended_Pictographic}️?/gu, '').trim()
// Before the tap: what already stands there, still, with no feelings yet;
// everything that arrives or happens comes with the tap. The one to tap is
// the one the page is about, else the biggest character, else the biggest
// thing (the shop, the window), else Lumi.
const STILL = new Set(['none', 'pop', 'bob', 'hop', 'shake', undefined])
function beforeOf(panel) {
  const still = panel.cast.filter(x => STILL.has(x.act)).map(x => ({ ...x, act: 'none', d: 0, say: undefined, feel: undefined }))
  const who = still.findIndex(x => x.who)
  const biggest = list => list.reduce((b, i) => (b === -1 || (still[i].s ?? 80) > (still[b].s ?? 80) ? i : b), -1)
  const seen = still.map((x, i) => i).filter(i => still[i].z !== 0)   // not one peeking from behind
  const char = biggest(seen.filter(i => still[i].char))
  const thing = biggest(seen)
  return { cast: still, tap: who > -1 ? who : char > -1 ? char : thing > -1 ? thing : 'lumi' }
}

// Lumi's backpack with a souvenir from every story; the newest drops in
function Backpack({ bag, fresh }) {
  return (
    <div style={{ position: 'relative', width: 70, height: 70 }}>
      <Art art="🎒" size={70} />
      <motion.div key={fresh} initial={{ y: -120, scale: 1.6, opacity: 1 }} animate={{ y: 6, scale: 0.6, opacity: [1, 1, 0] }} transition={{ duration: 1.3, delay: 0.5 }}
        style={{ position: 'absolute', left: 13, top: 0 }}><Art art={fresh} size={44} /></motion.div>
      <div style={{ position: 'absolute', left: -10, right: -10, bottom: -26, display: 'flex', justifyContent: 'center', gap: 1 }}>
        {bag.map(a => <Art key={a} art={a} size={22} />)}
      </div>
    </div>
  )
}

// what is still where it was at the end of a scene (the lesson shows it again)
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const STAYS = new Set(['none', 'pop', 'bob', 'drop', 'shake', 'hop', 'jack', 'bang', undefined])
const GO = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }

export default function StoryGame({ level = 1, onComplete }) {
  const [setup]      = useState(() => levelSetup(level))
  const { stories, faces } = setup
  const [storyIdx,   setStoryIdx]   = useState(0)
  const [phase,      setPhase]      = useState('intro') // intro | choice | outcome | lesson | alt | end
  const [panelIdx,   setPanelIdx]   = useState(0)
  const [chosen,     setChosen]     = useState(null)
  const [sawAlt,     setSawAlt]     = useState(false)
  const [ready,      setReady]      = useState(false)   // the scene has played: the next page or the question
  const [answer,     setAnswer]     = useState(null)
  const [asked,      setAsked]      = useState(0)
  const [firstTry,   setFirstTry]   = useState(0)
  const [touched,    setTouched]    = useState(false)   // the child tapped and made this page happen
  const [fallback,   setFallback]   = useState(false)   // nobody tapped for a while: the arrow does it too
  const [bag,        setBag]        = useState([])      // a souvenir from every story, in Lumi's backpack
  const [after, cancel] = useAfter()
  const [later] = useAfter()
  const [bursts, burst] = useBursts()
  const trayRef = useRef(null), nextRef = useRef(null)
  const trayStart = useTrayStart(trayRef)
  const ref = sel => ({ get current() { return document.querySelector(sel) } })
  const [whoRef] = useState(() => ref('[data-story-stage] .pl-drop'))
  const [lumiRef] = useState(() => ref('[data-fork-lumi]'))
  const [signRef] = useState(() => ref('[data-sign="hint"]'))
  const [actorRef] = useState(() => ref('[data-story-stage] [data-tap-actor]'))
  const narrow = typeof window !== 'undefined' && window.innerWidth < 600

  const story   = stories[storyIdx]
  const outcome = chosen ? story.outcomes[chosen] : null
  const altOption = chosen ? story.choice.options.find(o => o.value !== chosen) : null
  const beats = phase === 'intro' ? story.panels : phase === 'outcome' ? outcome.panels : phase === 'alt' ? story.outcomes[altOption.value].panels : null
  const panel = beats?.[Math.min(panelIdx, beats.length - 1)] ?? null
  // Every question of the story is asked (at level 1 two stories used to
  // give only two rated answers, and the stars jumped). The other path
  // (alt) only shows.
  const ask = panel?.ask && phase !== 'alt' ? panel.ask : null
  const stepKey = `${storyIdx}-${phase}-${panelIdx}`
  const asking = !!ask && ready

  const askFaces = useMemo(() => ask
    ? shuffle([ask.feeling, ...shuffle(DECOYS[ask.feeling]).slice(0, faces - 1)])
    : [], [stepKey]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => stopNarration(), [])

  // A page first stands still: the child taps the one it is about (the
  // hedgehog, the shop, the vase …) and the page happens. Then its question,
  // or the next page by itself. If nobody taps, an arrow comes to do it.
  const before = useMemo(() => (panel ? beforeOf(panel) : null), [stepKey]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    setAnswer(null); setReady(false); setTouched(false); setFallback(false)
    if (panel) later(() => setFallback(true), 6000, { quiet: false })
    if (phase === 'lesson' && !bag.includes(story.souvenir)) setBag(b => [...b, story.souvenir])
  }, [stepKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const happen = () => {
    if (touched || !panel) return
    setTouched(true)
    sfx.pop()
    const len = sceneLength(panel.cast, panel.lumi)
    if (ask) after(() => setReady(true), Math.max(1500, len), { quiet: false })
    else after(advance, Math.max(2800, len + 1800), { quiet: false })
  }

  // once per page: a second tap on the page-turn button (it stays on screen
  // while it shrinks away) turned two pages and ran past the last one
  const turned = useRef(null)
  const advance = () => {
    if (turned.current === stepKey) return
    turned.current = stepKey
    sfx.flip()
    if (panelIdx < beats.length - 1) { setPanelIdx(p => p + 1); return }
    setPanelIdx(0)
    if (phase === 'intro') setPhase('choice')
    else { setPhase('lesson'); if (phase === 'outcome') sfx.tada() }
  }

  // No second try and no red cross: the face that fits shows over them.
  const giveFace = (f) => {
    if (!asking || answer) return false
    const ok = f === ask.feeling
    setAnswer(f)
    setAsked(n => n + 1)
    if (ok) { setFirstTry(n => n + 1); burst(whoRef.current ?? undefined, 'stars'); sayRight() }
    else sayWrong()
    after(advance, ok ? 1800 : 2400, { quiet: false })
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
    if (turned.current === `story-${storyIdx}`) return
    turned.current = `story-${storyIdx}`
    if (storyIdx + 1 >= stories.length) { setPhase('end'); return }
    setStoryIdx(i => i + 1); setPanelIdx(0); setChosen(null); setPhase('intro'); setSawAlt(false)
  }

  const openAlt = () => { setSawAlt(true); setPanelIdx(0); setPhase('alt') }

  if (phase === 'end') return <Finale stories={stories} bag={bag} narrow={narrow} onDone={() => { if (turned.current !== 'end') { turned.current = 'end'; onComplete(result(firstTry, asked)) } }} />

  const whoIdx = panel?.cast?.findIndex(x => x.who) ?? -1
  const target = ask ? (ask.who === 'Lumi' ? 'lumi' : whoIdx) : null
  const last = outcome?.panels[outcome.panels.length - 1]
  const stillPage = panel && !touched

  return (
    <DragArea autoTarget={phase === 'choice' ? null : 'who'} disabled={phase !== 'choice' && (!asking || !!answer)}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px clamp(10px,3vw,28px) 14px', gap: 8, minHeight: 0 }}>
        {/* kept clear of the sun in the backdrop's top right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 820, paddingRight: narrow ? 64 : 150, boxSizing: 'border-box' }}>
          <div style={{ flex: 1, minWidth: 0 }}><RoundTrail total={stories.length} done={storyIdx + (phase === 'lesson' ? 1 : 0)} walker="lumi" goal="🏰" size={narrow ? 34 : 42} /></div>
          {/* this story's pages: where we are in it */}
          {beats && <div role="img" aria-label={story.title} style={{ display: 'flex', gap: 5 }}>
            {beats.map((_, i) => <span key={i} style={{ width: 12, height: 12, borderRadius: 6, border: '2.5px solid #2a1b3d', background: i <= panelIdx ? '#ffc93c' : '#fffdf7' }} />)}
          </div>}
        </div>

        <div data-story-stage role="img" aria-label={panel ? plain(panel.text) : phase === 'lesson' ? outcome.lesson : story.title} style={{ flex: 1, width: '100%', maxWidth: 980, display: 'flex', minHeight: 0 }}>
          {phase === 'choice'
            ? <Fork options={story.choice.options} hint={storyIdx % 2} onChoose={choose} narrow={narrow} />
            : stillPage
              ? <Stage key={`${stepKey}-still`} playKey={`${stepKey}-still`} cast={before.cast} fx={panel.fx}
                  lumi={{ x: 170, size: 150, ...panel.lumi, act: undefined, say: undefined, feel: 'neutral' }}
                  tap={{ who: before.tap, onTap: happen, label: 'Antippen' }} />
            : panel
              ? <Stage key={stepKey} playKey={stepKey} cast={panel.cast} fx={panel.fx}
                  lumi={{ x: 170, size: 150, ...panel.lumi, ...(target === 'lumi' && !answer ? { feel: 'neutral', say: undefined } : {}) }}
                  drop={target != null && target !== -1 ? { who: target, id: 'who', onDrop: d => giveFace(d.feeling), label: ask.who } : undefined}
                  bubbles={asking && target != null ? { [target]: answer ? <FeelingFace feeling={ask.feeling} size={44} /> : <AskFace /> } : {}} />
              : <Stage key={stepKey} playKey={stepKey} cast={last.cast.filter(x => x.char || STAYS.has(x.act)).map(x => ({ ...x, act: 'none', say: undefined, d: 0 }))}
                  lumi={{ x: 170, size: 150, feel: 'happy', hold: <Backpack bag={bag} fresh={story.souvenir} /> }} bubbles={{ lumi: <Art art="💡" size={44} /> }} />}
        </div>

        {/* clipped: the tray sliding in must not count as content height
            for the FitBox around the game */}
        <div style={{ overflow: 'clip', overflowClipMargin: 12, paddingTop: 8, width: '100%', display: 'flex', justifyContent: 'center', minHeight: narrow ? 112 : 132 }}>
          <AnimatePresence mode="wait">
            {asking && (
              <motion.div key={stepKey} ref={trayRef}
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                style={{ display: 'flex', gap: narrow ? 10 : 18, justifyContent: 'center', alignItems: 'flex-end', padding: '10px 14px', borderRadius: 28, background: 'rgba(255,253,247,.55)' }}>
                {askFaces.map(f => (
                  <Draggable key={f} id={f} data={{ feeling: f }} label={f} disabled={!!answer}>
                    <FaceChip feeling={f} size={narrow ? 56 : 70} dim={!!answer && f !== ask.feeling} glow={!!answer && f === ask.feeling} />
                  </Draggable>
                ))}
              </motion.div>
            )}
            {stillPage && fallback && (
              <motion.button key={`next-${stepKey}`} ref={nextRef} onClick={happen} aria-label="Weiter"
                initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, opacity: 0 }} whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                style={{ ...GO, width: 92, height: 92, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Art art="➡️" size={54} />
              </motion.button>
            )}
            {phase === 'lesson' && (
              <motion.div key="lesson" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
                style={{ display: 'flex', gap: 14, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', padding: '6px 0' }}>
                {!sawAlt && (
                  <motion.button whileTap={{ scale: 0.95 }} onClick={openAlt} aria-label="Und wenn Lumi anders entschieden hätte?"
                    style={{ ...pxButton('parch'), padding: '10px 18px', minHeight: 64, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Art art="🔀" size={36} /><Art art={altOption.pic[0]} size={36} />
                  </motion.button>
                )}
                <motion.button whileTap={{ scale: 0.95 }} onClick={nextStory} aria-label={storyIdx + 1 >= stories.length ? 'Fertig' : 'Nächste Geschichte'}
                  animate={{ scale: [1, 1.06, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: 2 }}
                  style={{ ...GO, padding: '10px 34px', minHeight: 64, display: 'flex', alignItems: 'center', gap: 8 }}>
                  {storyIdx + 1 >= stories.length ? <Art art="🏰" size={40} /> : <><Art art="📖" size={40} /><Art art="➡️" size={30} /></>}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
      {asking && !answer && <HintHand from={trayStart} to={whoRef} delay={asked === 0 ? 2000 : 6000} />}
      {stillPage && <HintHand to={actorRef} delay={storyIdx === 0 && phase === 'intro' && panelIdx < 2 ? 1500 : 4000} />}
      {phase === 'choice' && <HintHand from={lumiRef} to={signRef} delay={storyIdx === 0 ? 2500 : 6000} />}
      {bursts}
    </DragArea>
  )
}

// The end of the level: Lumi at the castle with everyone from the stories
function Finale({ stories, bag, narrow, onDone }) {
  useEffect(() => { sfx.tada() }, [])
  // the first character of each story
  const pals = stories.map(s => [...s.panels, ...s.panels].flatMap(p => p.cast).find(x => x.char)?.a).filter(Boolean)
  const size = narrow ? 76 : 120
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 16 }}>
      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 180, damping: 12 }}>
        <Art art="🏰" size={narrow ? 130 : 200} />
      </motion.div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: narrow ? 6 : 16 }}>
        <div style={{ position: 'relative' }}>
          <FeelLumi feel="excited" size={size * 1.3} />
          {/* the backpack, and everything from the stories bouncing out of it */}
          <div style={{ position: 'absolute', right: -size * 0.2, bottom: 0 }}><Art art="🎒" size={size * 0.55} /></div>
          {bag.map((a, i) => (
            <motion.div key={a} initial={{ y: 0, opacity: 0 }} animate={{ y: [0, -size * (0.9 + i * 0.25), -size * (0.7 + i * 0.25)], opacity: 1 }}
              transition={{ delay: 0.8 + i * 0.3, duration: 0.8 }}
              style={{ position: 'absolute', right: -size * 0.1 + (i % 2) * size * 0.3, bottom: size * 0.3, pointerEvents: 'none' }}>
              <Art art={a} size={size * 0.4} />
            </motion.div>
          ))}
        </div>
        {pals.map((a, i) => (
          <motion.div key={i} initial={{ x: 300, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.25, type: 'spring', stiffness: 120, damping: 14 }}>
            <motion.div animate={{ y: [0, -size * 0.35, 0], rotate: [0, -8, 8, 0] }} transition={{ delay: 1.2 + i * 0.2, duration: 0.7, repeat: Infinity, repeatDelay: 0.3 }}>
              <Art art={asPerson(a, size)[0]} size={asPerson(a, size)[1]} />
            </motion.div>
          </motion.div>
        ))}
      </div>
      <motion.button whileTap={{ scale: 0.94 }} onClick={onDone} aria-label="Fertig"
        animate={{ scale: [1, 1.07, 1] }} transition={{ duration: 1.2, repeat: Infinity, delay: 1.5 }}
        style={{ ...GO, padding: '14px 48px', fontSize: 22, minHeight: 64 }}>Fertig! 🏆</motion.button>
    </div>
  )
}

/**
 * The fork in the path: Lumi stands in the middle, a signpost with pictures
 * of each way on either side. Carry Lumi to one, or tap it: the pictures of
 * that way come flying to Lumi, then the story goes on that way.
 */
function Fork({ options, hint, onChoose, narrow }) {
  const [picked, setPicked] = useState(null)
  const size = narrow ? 96 : 150
  const pick = (value) => {
    if (picked) return
    setPicked(value)
    sfx.whoosh()
    setTimeout(() => onChoose(value), reduceMotion() ? 200 : 1100)
  }
  const flying = options.find(o => o.value === picked)
  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: narrow ? 8 : 40, position: 'relative' }}>
      <Sign opt={options[0]} hint={hint === 0} onPick={pick} picked={picked} narrow={narrow} side="left" />
      <Draggable id="lumi" data={{ lumi: true }} label="Lumi" data-fork-lumi="" disabled={!!picked}>
        <motion.div animate={picked ? { y: [0, -40, 0], rotate: [0, 360] } : { y: [0, -10, 0] }}
          transition={picked ? { duration: 0.8 } : { duration: 1.4, repeat: Infinity }}>
          <FeelLumi feel={picked ? 'excited' : 'curious'} size={size} />
        </motion.div>
      </Draggable>
      <Sign opt={options[1]} hint={hint === 1} onPick={pick} picked={picked} narrow={narrow} side="right" />
      {/* the chosen way's pictures fly to Lumi */}
      {flying && flying.pic.map((a, i) => (
        <motion.div key={i} aria-hidden="true"
          initial={{ x: (picked === options[0].value ? -1 : 1) * (narrow ? 120 : 220), y: -20, scale: 1, opacity: 1 }}
          animate={{ x: 0, y: [-20, -120, -60], scale: [1, 1.4, 0.8], opacity: [1, 1, 0], rotate: 360 }}
          transition={{ duration: 1, delay: i * 0.12 }}
          style={{ position: 'absolute', left: '50%', top: '45%', marginLeft: -30, pointerEvents: 'none' }}>
          <Art art={a} size={60} />
        </motion.div>
      ))}
    </div>
  )
}

function Sign({ opt, hint, onPick, picked, narrow, side }) {
  const { picked: carrying } = useDragState()
  const w = narrow ? 120 : 230
  const art = narrow ? (opt.pic.length > 2 ? 34 : 46) : (opt.pic.length > 2 ? 62 : 80)
  return (
    <DropZone id={opt.value} onDrop={() => { onPick(opt.value); return true }} label={plain(opt.text)} slop={30}>
      {hover => (
        <motion.button onClick={() => { if (!carrying) onPick(opt.value) }} aria-label={plain(opt.text)} data-sign={hint ? 'hint' : undefined}
          initial={{ scale: 0 }} animate={{ scale: picked === opt.value ? 1.12 : hover ? 1.08 : picked ? 0.9 : 1, rotate: side === 'left' ? -3 : 3, opacity: picked && picked !== opt.value ? 0.4 : 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14 }}
          style={{ all: 'unset', cursor: 'pointer', width: w, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{
            width: '100%', minHeight: narrow ? 92 : 140, padding: narrow ? '10px 4px' : '16px 10px', borderRadius: 18, background: '#f7d9a3',
            border: '4px solid #8a4f22', boxShadow: hover || picked === opt.value ? '0 0 0 5px #ffc93c, 0 6px 0 rgba(42,27,61,.35)' : '0 6px 0 rgba(42,27,61,.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, boxSizing: 'border-box', flexWrap: 'wrap',
          }}>
            {opt.pic.map((a, i) => <Art key={i} art={a} size={a === '➡️' || a === '💨' ? art * 0.6 : art} />)}
          </div>
          {/* the post */}
          <div style={{ width: 14, height: narrow ? 34 : 60, background: '#8a4f22', borderRadius: '0 0 4px 4px' }} />
        </motion.button>
      )}
    </DropZone>
  )
}
