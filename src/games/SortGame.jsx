import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Art, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts, useDragState } from '../components/play/index.js'
import Korbmonster from './sort/Korbmonster.jsx'
import { sfx } from '../sfx.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { usePaused } from '../lib/pause.js'
import { result } from '../lib/score.js'
import { INK, pxPanel, pxBubble, pxButton } from './px.js'

/**
 * Sortier-Spaß: "Wer will was?" — Kategorisieren & Konzeptbildung
 *
 * Each category is a basket monster (sort/Korbmonster.jsx) with a sign: one
 * collects animals (🐾), one food (🍽️), one toys (🧸). Things arrive on a
 * conveyor belt; the child drags (or taps, then taps the monster) each thing
 * to the one that wants it. The right monster grins and the thing peeks out
 * of its basket, so the group visibly grows; the wrong one pulls a face
 * ("Bäh!"), the thing bounces back onto the belt, and the right monster
 * jumps with its sign lit. A run of right answers makes all of them cheer.
 * Nothing here needs words: the signs, the grins and the hand that shows
 * the move when a child waits carry the task.
 *
 * Scientific basis:
 *   • Concept Formation (Bruner, 1956) — categorisation is a core cognitive skill underlying
 *     all higher-order thinking and early science/math literacy.
 *   • Executive Function — sorting requires inhibitory control and cognitive flexibility
 *     (Diamond, 2013).
 *   • Inventing the rule — after a level the child may sort six things any way it likes
 *     and Lumi guesses the rule. Choosing a criterion yourself is the step beyond applying
 *     one (Bruner's concept attainment); it is not rated, there is no wrong answer.
 */

// Monster tints: a light face plate (bg) and a darker weave (ring) of the
// same hue; the ring also lights up the sign of the monster a thing belongs to.
const TINT = {
  green:  { bg: '#E3F6DA', ring: '#2F8F3A' },
  orange: { bg: '#FFEBD2', ring: '#C25E12' },
  blue:   { bg: '#DCEEFF', ring: '#1F6FC7' },
  pink:   { bg: '#FFE4F0', ring: '#C2185B' },
  red:    { bg: '#FFE0DA', ring: '#C2412D' },
  lilac:  { bg: '#E9E3FF', ring: '#6B3FD6' },
  brown:  { bg: '#F1E4D4', ring: '#7A4A2A' },
  grey:   { bg: '#ECEFF1', ring: '#546E7A' },
  yellow: { bg: '#FFF4C2', ring: '#9A7400' },
}

// A monster: the word and picture on its sign, its tint, and what it
// collects. Items are [emoji, name with its article] (the name labels the
// thing for screen readers).
const cat = (label, emoji, tint, items) => ({ label, emoji, ...TINT[tint], items })

// Every item belongs to its basket without an "it depends": no tomato as a
// vegetable, no shark that floats, no glasses that belong to the daytime.
const SETS = {
  'tiere-essen': [
    cat('Tiere', '🐾', 'green', [
      ['🐕', 'der Hund'], ['🐱', 'die Katze'], ['🦁', 'der Löwe'], ['🐸', 'der Frosch'], ['🐬', 'der Delfin'],
      ['🐘', 'der Elefant'], ['🐧', 'der Pinguin'], ['🐯', 'der Tiger'], ['🐢', 'die Schildkröte'], ['🦋', 'der Schmetterling']]),
    cat('Essen', '🍽️', 'orange', [
      ['🍕', 'die Pizza'], ['🍎', 'der Apfel'], ['🥨', 'die Brezel'], ['🍰', 'der Kuchen'], ['🍌', 'die Banane'],
      ['🥕', 'die Karotte'], ['🍉', 'die Melone'], ['🍓', 'die Erdbeere'], ['🧀', 'der Käse'], ['🍞', 'das Brot']]),
  ],
  'tiere-spielzeug': [
    cat('Tiere', '🐾', 'green', [
      ['🐶', 'der Hund'], ['🐰', 'der Hase'], ['🦔', 'der Igel'], ['🐝', 'die Biene'], ['🦆', 'die Ente'],
      ['🐞', 'der Marienkäfer'], ['🐴', 'das Pferd'], ['🐷', 'das Schwein'], ['🐮', 'die Kuh']]),
    cat('Spielzeug', '🧸', 'pink', [
      ['🧸', 'der Teddy'], ['🪀', 'das Jo-Jo'], ['🪁', 'der Drachen'], ['🎲', 'der Würfel'], ['⚽', 'der Ball'],
      ['🪆', 'die Puppe'], ['🎈', 'der Luftballon'], ['🧩', 'das Puzzle'], ['🤖', 'der Roboter']]),
  ],
  'obst-gemuese': [
    cat('Obst', '🍎', 'red', [
      ['🍎', 'der Apfel'], ['🍌', 'die Banane'], ['🍓', 'die Erdbeere'], ['🍇', 'die Traube'], ['🍊', 'die Orange'],
      ['🍒', 'die Kirsche'], ['🍐', 'die Birne'], ['🍑', 'der Pfirsich'], ['🍋', 'die Zitrone'], ['🍍', 'die Ananas']]),
    cat('Gemüse', '🥦', 'green', [
      ['🥦', 'der Brokkoli'], ['🥕', 'die Karotte'], ['🥒', 'die Gurke'], ['🫑', 'die Paprika'], ['🥔', 'die Kartoffel'],
      ['🧅', 'die Zwiebel'], ['🥬', 'der Salat'], ['🍆', 'die Aubergine'], ['🧄', 'der Knoblauch']]),
  ],
  'fahrzeuge-natur': [
    cat('Fahrzeuge', '🚗', 'lilac', [
      ['🚕', 'das Taxi'], ['✈️', 'das Flugzeug'], ['🚂', 'die Lokomotive'], ['🚢', 'das Schiff'], ['🚁', 'der Hubschrauber'],
      ['🚲', 'das Fahrrad'], ['🚌', 'der Bus'], ['🚒', 'das Feuerwehrauto'], ['🚜', 'der Traktor'], ['⛵', 'das Segelboot']]),
    cat('Natur', '🌿', 'green', [
      ['🌲', 'der Tannenbaum'], ['🌸', 'die Blüte'], ['🍄', 'der Pilz'], ['⛰️', 'der Berg'], ['🌻', 'die Sonnenblume'],
      ['🌴', 'die Palme'], ['🌵', 'der Kaktus'], ['🍁', 'das Blatt'], ['🪨', 'der Stein']]),
  ],
  'rund-eckig': [
    cat('Rund', '🔵', 'blue', [
      ['🌕', 'der Vollmond'], ['🏀', 'der Basketball'], ['⚽', 'der Fußball'], ['🍊', 'die Orange'], ['🍪', 'der Keks'],
      ['🕐', 'die Uhr'], ['🍩', 'der Donut']]),
    cat('Eckig', '🟧', 'orange', [
      ['📦', 'das Paket'], ['📱', 'das Handy'], ['🧱', 'der Ziegelstein'], ['🖼️', 'das Bild'], ['📚', 'der Bücherstapel'],
      ['🎁', 'das Geschenk'], ['🎲', 'der Würfel'], ['📺', 'der Fernseher']]),
  ],
  'musik-sport': [
    cat('Musik', '🎵', 'pink', [
      ['🎸', 'die Gitarre'], ['🎹', 'das Klavier'], ['🥁', 'die Trommel'], ['🎺', 'die Trompete'], ['🎻', 'die Geige'],
      ['🪗', 'das Akkordeon']]),
    cat('Sport', '🏅', 'orange', [
      ['⚽', 'der Fußball'], ['🏀', 'der Basketball'], ['🎾', 'der Tennisball'], ['🏓', 'der Tischtennisschläger'],
      ['🏸', 'der Federball'], ['🏐', 'der Volleyball'], ['🛹', 'das Skateboard']]),
  ],
  'drinnen-draussen': [
    cat('Drinnen', '🏠', 'lilac', [
      ['🛏️', 'das Bett'], ['🛁', 'die Badewanne'], ['📺', 'der Fernseher'], ['🛋️', 'das Sofa'], ['🚿', 'die Dusche'],
      ['🍳', 'die Pfanne']]),
    cat('Draußen', '🌳', 'green', [
      ['🛝', 'die Rutsche'], ['⛲', 'der Brunnen'], ['⛰️', 'der Berg'], ['🌳', 'der Baum'], ['🏖️', 'der Strand'],
      ['⛺', 'das Zelt'], ['🌈', 'der Regenbogen']]),
  ],
  'gross-klein': [
    cat('Groß', '🐘', 'pink', [
      ['🐋', 'der Wal'], ['🦒', 'die Giraffe'], ['🐘', 'der Elefant'], ['🦏', 'das Nashorn'], ['🦛', 'das Nilpferd'],
      ['🐪', 'das Kamel'], ['🐻', 'der Bär']]),
    cat('Klein', '🐭', 'blue', [
      ['🐞', 'der Marienkäfer'], ['🐜', 'die Ameise'], ['🐝', 'die Biene'], ['🦋', 'der Schmetterling'], ['🐛', 'die Raupe'],
      ['🐌', 'die Schnecke'], ['🐭', 'die Maus'], ['🐤', 'das Küken']]),
  ],
  'warm-kalt': [
    cat('Warm', '🔥', 'red', [
      ['☀️', 'die Sonne'], ['🍵', 'der Tee'], ['🔥', 'das Feuer'], ['🌋', 'der Vulkan'], ['🍲', 'die Suppe'],
      ['🕯️', 'die Kerze'], ['☕', 'der Kakao']]),
    cat('Kalt', '❄️', 'blue', [
      ['🧊', 'der Eiswürfel'], ['🍦', 'das Eis'], ['⛄', 'der Schneemann'], ['🌨️', 'der Schnee'],
      ['🏔️', 'der Schneeberg'], ['🍧', 'das Wassereis']]),
  ],
  'tag-nacht': [
    cat('Tag', '☀️', 'yellow', [
      ['☀️', 'die Sonne'], ['🌈', 'der Regenbogen'], ['🐓', 'der Hahn'], ['🌻', 'die Sonnenblume'], ['🦋', 'der Schmetterling'],
      ['🐝', 'die Biene']]),
    cat('Nacht', '🌙', 'lilac', [
      ['🌙', 'der Mond'], ['⭐', 'der Stern'], ['🦉', 'die Eule'], ['🦇', 'die Fledermaus'],
      ['🌃', 'die Stadt bei Nacht']]),
  ],
  'suess-salzig': [
    cat('Süß', '🍭', 'pink', [
      ['🍭', 'der Lutscher'], ['🍫', 'die Schokolade'], ['🍰', 'der Kuchen'], ['🍩', 'der Donut'], ['🍪', 'der Keks'],
      ['🍬', 'das Bonbon'], ['🍯', 'der Honig']]),
    cat('Salzig', '🧂', 'grey', [
      ['🧂', 'das Salz'], ['🥨', 'die Brezel'], ['🥓', 'der Speck'], ['🧀', 'der Käse'], ['🍕', 'die Pizza']]),
  ],
  'fluessig-fest': [
    cat('Flüssig', '💧', 'blue', [
      ['💧', 'das Wasser'], ['🥛', 'die Milch'], ['🍵', 'der Tee'], ['🥤', 'der Saft'], ['☕', 'der Kakao']]),
    cat('Fest', '🧱', 'brown', [
      ['🧱', 'der Ziegelstein'], ['🪨', 'der Stein'], ['🍞', 'das Brot'], ['🧊', 'der Eiswürfel'], ['🔑', 'der Schlüssel']]),
  ],
  'wasser-luft': [
    cat('Im Wasser', '🌊', 'blue', [
      ['🐟', 'der Fisch'], ['🐙', 'der Tintenfisch'], ['🐬', 'der Delfin'], ['🐳', 'der Wal'], ['🐠', 'der bunte Fisch'],
      ['🦈', 'der Hai'], ['🐡', 'der Kugelfisch']]),
    cat('In der Luft', '☁️', 'lilac', [
      ['🦅', 'der Adler'], ['🦋', 'der Schmetterling'], ['🦜', 'der Papagei'], ['🐝', 'die Biene'], ['🕊️', 'die Taube'],
      ['🦉', 'die Eule']]),
  ],
  'hof-wild': [
    cat('Bauernhof', '🚜', 'orange', [
      ['🐄', 'die Kuh'], ['🐖', 'das Schwein'], ['🐑', 'das Schaf'], ['🐓', 'der Hahn'], ['🐴', 'das Pferd'],
      ['🐐', 'die Ziege'], ['🐔', 'das Huhn']]),
    cat('Wilde Tiere', '🌴', 'green', [
      ['🦁', 'der Löwe'], ['🐯', 'der Tiger'], ['🐻', 'der Bär'], ['🐺', 'der Wolf'], ['🦓', 'das Zebra'],
      ['🐒', 'der Affe'], ['🦒', 'die Giraffe']]),
  ],
  'pflanzen-fleisch': [
    cat('Frisst Pflanzen', '🌿', 'green', [
      ['🐇', 'das Kaninchen'], ['🐄', 'die Kuh'], ['🦒', 'die Giraffe'], ['🐘', 'der Elefant'], ['🐑', 'das Schaf'],
      ['🦓', 'das Zebra'], ['🐨', 'der Koala']]),
    cat('Frisst Fleisch', '🥩', 'red', [
      ['🦁', 'der Löwe'], ['🐺', 'der Wolf'], ['🐯', 'der Tiger'], ['🦈', 'der Hai'], ['🦅', 'der Adler'],
      ['🐊', 'das Krokodil']]),
  ],
  'lebt-nicht': [
    cat('Lebt', '🌱', 'green', [
      ['🌳', 'der Baum'], ['🐕', 'der Hund'], ['🌸', 'die Blume'], ['🐟', 'der Fisch'], ['🍄', 'der Pilz'],
      ['🐝', 'die Biene'], ['🐌', 'die Schnecke'], ['🌵', 'der Kaktus']]),
    cat('Lebt nicht', '🧱', 'brown', [
      ['📦', 'das Paket'], ['🚗', 'das Auto'], ['🪑', 'der Stuhl'], ['🧲', 'der Magnet'], ['🧱', 'der Ziegelstein'],
      ['🔑', 'der Schlüssel'], ['🪨', 'der Stein'], ['⏰', 'der Wecker']]),
  ],
  'schwimmt-sinkt': [
    cat('Schwimmt oben', '🦆', 'blue', [
      ['🍃', 'das Blatt'], ['🚤', 'das Boot'], ['🦆', 'die Ente'], ['🎈', 'der Luftballon'], ['🧽', 'der Schwamm'],
      ['🪵', 'das Holz'], ['🛟', 'der Rettungsring']]),
    cat('Geht unter', '⚓', 'grey', [
      ['🔑', 'der Schlüssel'], ['🪙', 'die Münze'], ['🔨', 'der Hammer'], ['⚙️', 'das Zahnrad'], ['🪨', 'der Stein'],
      ['⚓', 'der Anker']]),
  ],
  'holz-metall': [
    cat('Aus Holz', '🪵', 'brown', [
      ['🪑', 'der Stuhl'], ['✏️', 'der Bleistift'], ['🛶', 'das Kanu'], ['🪆', 'die Holzpuppe'],
      ['🎻', 'die Geige']]),
    cat('Aus Metall', '🔩', 'grey', [
      ['🔗', 'die Kette'], ['🗝️', 'der Schlüssel'], ['⚓', 'der Anker'], ['🔧', 'der Schraubenschlüssel'], ['⚙️', 'das Zahnrad'],
      ['🔩', 'die Schraube'], ['🪙', 'die Münze']]),
  ],
  // three baskets
  'wasser-luft-land': [
    cat('Im Wasser', '🌊', 'blue', [
      ['🐟', 'der Fisch'], ['🐙', 'der Tintenfisch'], ['🐬', 'der Delfin'], ['🐳', 'der Wal'], ['🦈', 'der Hai']]),
    cat('In der Luft', '☁️', 'lilac', [
      ['🦅', 'der Adler'], ['🦋', 'der Schmetterling'], ['🦜', 'der Papagei'], ['🕊️', 'die Taube'], ['🦉', 'die Eule']]),
    cat('An Land', '⛰️', 'green', [
      ['🐘', 'der Elefant'], ['🐕', 'der Hund'], ['🦁', 'der Löwe'], ['🐄', 'die Kuh'], ['🦔', 'der Igel']]),
  ],
  'tier-pflanze-ding': [
    cat('Tiere', '🐾', 'orange', [
      ['🐕', 'der Hund'], ['🐱', 'die Katze'], ['🐸', 'der Frosch'], ['🐢', 'die Schildkröte'], ['🐌', 'die Schnecke']]),
    cat('Pflanzen', '🌱', 'green', [
      ['🌳', 'der Baum'], ['🌷', 'die Tulpe'], ['🌵', 'der Kaktus'], ['🌻', 'die Sonnenblume'], ['🌴', 'die Palme']]),
    cat('Dinge', '📦', 'grey', [
      ['🚗', 'das Auto'], ['🪑', 'der Stuhl'], ['⏰', 'der Wecker'], ['🔑', 'der Schlüssel'], ['✏️', 'der Bleistift']]),
  ],
  'obst-gemuese-suess': [
    cat('Obst', '🍎', 'red', [
      ['🍌', 'die Banane'], ['🍓', 'die Erdbeere'], ['🍐', 'die Birne'], ['🍒', 'die Kirsche'], ['🍊', 'die Orange']]),
    cat('Gemüse', '🥦', 'green', [
      ['🥕', 'die Karotte'], ['🥒', 'die Gurke'], ['🥔', 'die Kartoffel'], ['🫑', 'die Paprika'], ['🧅', 'die Zwiebel']]),
    cat('Süßes', '🍭', 'pink', [
      ['🍫', 'die Schokolade'], ['🍬', 'das Bonbon'], ['🍩', 'der Donut'], ['🍪', 'der Keks'], ['🧁', 'das Törtchen']]),
  ],
  'kueche-bad-zimmer': [
    cat('Küche', '🍲', 'orange', [
      ['🍳', 'die Pfanne'], ['🍴', 'das Besteck'], ['🫖', 'die Teekanne'], ['🍽️', 'der Teller'], ['🧂', 'der Salzstreuer']]),
    cat('Bad', '🛁', 'blue', [
      ['🚿', 'die Dusche'], ['🪥', 'die Zahnbürste'], ['🧼', 'die Seife'], ['🧽', 'der Schwamm'], ['🧴', 'die Creme']]),
    cat('Kinderzimmer', '🧸', 'pink', [
      ['🪀', 'das Jo-Jo'], ['🧩', 'das Puzzle'], ['🪁', 'der Drachen'], ['🎲', 'der Würfel'], ['🤖', 'der Roboter']]),
  ],
}

// Which sets each level draws from, easy to hard: things a child knows by
// name first, then looks (round, big), then properties you have to know
// (floats, lives, what it eats), and three baskets at the end.
const LEVEL_PLAN = [
  ['tiere-essen', 'tiere-spielzeug'],
  ['obst-gemuese', 'tiere-spielzeug'],
  ['fahrzeuge-natur', 'rund-eckig'],
  ['musik-sport', 'drinnen-draussen'],
  ['gross-klein', 'warm-kalt'],
  ['tag-nacht', 'suess-salzig', 'fluessig-fest'],
  ['wasser-luft', 'hof-wild', 'pflanzen-fleisch'],
  ['lebt-nicht', 'schwimmt-sinkt', 'holz-metall'],
  ['wasser-luft-land', 'tier-pflanze-ding'],
  ['obst-gemuese-suess', 'kueche-bad-zimmer'],
]

function shuffleArr(a) { return [...a].sort(() => Math.random() - 0.5) }

// ── Free sorting: the child invents the rule ────────────────────────────
// Things whose sprite shows one clear colour, each with the properties Lumi
// knows: animal, food, flies, vehicle. Nothing with an "it depends" (a fish
// is an animal and food, a chick may or may not fly), so a guess is fair.
const thing = (emoji, name, color, props = '') => ({
  emoji, name, color, tier: props.includes('t'), essen: props.includes('e'),
  fliegt: props.includes('f'), faehrt: props.includes('v'),
})
const FREE_THINGS = [
  thing('🍎', 'der Apfel', 'rot', 'e'), thing('🍓', 'die Erdbeere', 'rot', 'e'), thing('🍒', 'die Kirschen', 'rot', 'e'),
  thing('🍅', 'die Tomate', 'rot', 'e'), thing('🐞', 'der Marienkäfer', 'rot', 'tf'), thing('🎈', 'der Luftballon', 'rot', 'f'),
  thing('🚗', 'das Auto', 'rot', 'v'), thing('🚒', 'das Feuerwehrauto', 'rot', 'v'),
  thing('🥦', 'der Brokkoli', 'grün', 'e'), thing('🥒', 'die Gurke', 'grün', 'e'), thing('🫑', 'die Paprika', 'grün', 'e'),
  thing('🐸', 'der Frosch', 'grün', 't'), thing('🐢', 'die Schildkröte', 'grün', 't'), thing('🦎', 'die Eidechse', 'grün', 't'),
  thing('🐛', 'die Raupe', 'grün', 't'), thing('🐊', 'das Krokodil', 'grün', 't'), thing('🌵', 'der Kaktus', 'grün'),
  thing('🍀', 'das Kleeblatt', 'grün'),
  thing('🍌', 'die Banane', 'gelb', 'e'), thing('🍋', 'die Zitrone', 'gelb', 'e'), thing('🧀', 'der Käse', 'gelb', 'e'),
  thing('🐝', 'die Biene', 'gelb', 'tf'), thing('🌻', 'die Sonnenblume', 'gelb'), thing('🚕', 'das Taxi', 'gelb', 'v'),
  thing('🚌', 'der Bus', 'gelb', 'v'),
  thing('🫐', 'die Heidelbeeren', 'blau', 'e'), thing('🐳', 'der Wal', 'blau', 't'), thing('🐬', 'der Delfin', 'blau', 't'),
  thing('🐦', 'der Vogel', 'blau', 'tf'), thing('🦋', 'der Schmetterling', 'blau', 'tf'), thing('🧢', 'die Mütze', 'blau'),
  thing('👕', 'das T-Shirt', 'blau'),
]

// What Lumi can recognise, in this order, and the picture of each rule on
// the signs Lumi hangs on the monsters once guessed.
const RULES = [
  { key: 'tier',   emoji: '🐾' },
  { key: 'essen',  emoji: '🍽️' },
  { key: 'fliegt', emoji: '🕊️' },
  { key: 'faehrt', emoji: '🚗' },
  { key: 'color' },
]
const COLOR = { rot: '#E53935', grün: '#43A047', gelb: '#FDD835', blau: '#1E88E5' }

// The split a rule makes of the things, the same whichever basket is which
const splitBy = (things, key) => {
  const first = things[0][key]
  return things.map(t => (t[key] === first ? 'a' : 'b')).join('')
}

// Six things, three in each of two colours, chosen so that animals and food
// both split them and every rule splits them differently: whatever the child
// does matches at most one rule.
function buildFree() {
  for (let n = 0; n < 300; n++) {
    const [c1, c2] = shuffleArr(['rot', 'grün', 'gelb', 'blau'])
    const things = shuffleArr([
      ...shuffleArr(FREE_THINGS.filter(t => t.color === c1)).slice(0, 3),
      ...shuffleArr(FREE_THINGS.filter(t => t.color === c2)).slice(0, 3),
    ])
    const splits = RULES.map(r => splitBy(things, r.key)).filter(s => s.includes('b'))
    const count = key => things.filter(t => t[key]).length
    if (count('tier') >= 2 && count('tier') <= 4 && count('essen') >= 2 && count('essen') <= 4
        && new Set(splits).size === splits.length) return things
  }
  return ['🍎', '🍓', '🐞', '🐸', '🥦', '🍀'].map(e => FREE_THINGS.find(t => t.emoji === e))
}

// Lumi's guess for the child's two baskets, as one sign per basket: the
// rule's picture on the one that has it and crossed out on the other, or
// the colours of each. Null when no rule fits (or all is in one basket).
function guessRule(baskets) {
  if (!baskets[0].length || !baskets[1].length) return null
  const fits = RULES.find(({ key }) => {
    const a = new Set(baskets[0].map(t => t[key]))
    return baskets[1].every(t => !a.has(t[key]))
  })
  if (!fits) return null
  if (fits.key === 'color') return baskets.map(b => ({ colors: [...new Set(b.map(t => COLOR[t.color]))] }))
  return baskets.map(b => ({ emoji: fits.emoji, cross: !b[0][fits.key] }))
}

// A round draws its things from the set's larger pool, so the same level
// played again shows different things: 4 per basket on odd levels, 5 on
// even ones, 3 per basket with three baskets.
function buildRound(level) {
  const plan = LEVEL_PLAN[Math.min(Math.max(level, 1), LEVEL_PLAN.length) - 1]
  const cats = SETS[plan[Math.floor(Math.random() * plan.length)]]
  const per  = cats.length === 3 ? 3 : level % 2 ? 4 : 5
  const items = cats.flatMap((c, ci) => shuffleArr(c.items).slice(0, per)
    .map(([emoji, name]) => ({ id: `${ci}-${emoji}`, emoji, name, cat: ci })))
  return { cats, items: shuffleArr(items) }
}


const FREE_TINT = [TINT.lilac, TINT.brown]
const BIG = 108   // the thing at the front of the belt
const GAP = 124   // from one place on the belt to the next
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// One basket monster as a place to drop things: it opens its mouth while
// something is held over it or picked up, and giggles when tapped with
// empty hands.
function MonsterZone({ id, width, onDrop, label, monsterRef, mood, ...monster }) {
  const { picked } = useDragState()
  const [tickled, setTickled] = useState(false)
  useEffect(() => {
    if (!tickled) return
    const t = setTimeout(() => setTickled(false), 800)
    return () => clearTimeout(t)
  }, [tickled])
  const tap = () => {
    if (picked) return
    sfx.giggle()
    setTickled(true)
  }
  return (
    <DropZone id={id} onDrop={onDrop} label={label}>
      {(hover, { ready }) => (
        <div ref={monsterRef} onClick={tap} style={{ cursor: 'pointer' }}>
          <Korbmonster width={width} mood={hover || ready ? 'hungry' : tickled ? 'happy' : mood} {...monster} />
        </div>
      )}
    </DropZone>
  )
}

// The size of a monster: as large as the space allows, at most 250 wide.
// Three monsters on a narrow, tall screen (a phone) stand in two rows,
// two and one, instead of three tiny ones in a row.
function useMonsterWidth(n) {
  const ref = useRef(null)
  const [w, setW] = useState(160)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = (perRow, rows) => Math.min(250, (el.clientWidth - 18 * (perRow - 1)) / perRow - 1, (el.clientHeight - 10 * (rows - 1)) / rows / 1.3)
    const measure = () => setW(Math.floor(Math.max(90, n === 3 ? Math.max(fit(3, 1), fit(2, 2)) : fit(n, 1))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])
  return [ref, w]
}

// The conveyor belt; the stripes move on by one place per `rolls`. Without
// a `height`, the things on it stand in the flow and set it.
function Belt({ rolls, height = 'auto', children }) {
  return (
    <div style={{ position: 'relative', width: '100%', height, flexShrink: 0, overflow: 'hidden' }}>
      {children}
      <div style={{ position: 'absolute', left: 8, right: 8, bottom: 14, height: 34, background: '#6d6a7c', border: `3px solid ${INK}`, borderRadius: 20, boxShadow: '0 5px 0 rgba(42,27,61,0.35)', overflow: 'hidden' }}>
        <motion.div initial={false} animate={{ backgroundPositionX: -rolls * GAP }} transition={{ duration: 0.6, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, backgroundImage: 'repeating-linear-gradient(90deg, #8d8a9e 0 22px, #5d5a6c 22px 31px)' }} />
      </div>
      {[0.1, 0.3, 0.5, 0.7, 0.9].map(x => (
        <motion.div key={x} initial={false} animate={{ rotate: rolls * 180 }} transition={{ duration: 0.6 }}
          style={{ position: 'absolute', left: `calc(${x * 100}% - 9px)`, bottom: 4, width: 18, height: 18, borderRadius: '50%', background: '#c9c5d6', border: `3px solid ${INK}`, boxSizing: 'border-box', backgroundImage: `linear-gradient(90deg, transparent 6px, ${INK} 6px 9px, transparent 9px)` }} />
      ))}
    </div>
  )
}

// A big round button with a picture: no words needed
function PicButton({ art, label, color = 'green', onClick, btnRef, size = 76 }) {
  return (
    <motion.button ref={btnRef} initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 380, damping: 15 }}
      onClick={onClick} aria-label={label}
      style={{ ...pxButton(color), width: size, height: size, borderRadius: '50%', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Art art={art} size={size * 0.58} />
    </motion.button>
  )
}

// Lumi with a thought bubble: what Lumi thinks of the child's sorting
function ThinkingLumi({ thought }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, flexShrink: 0 }}>
      <Art art="lumi" size={64} />
      <motion.div key={thought} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 360, damping: 14 }}
        style={{ ...pxBubble, borderRadius: 22, padding: 6, display: 'flex' }}>
        <Art art={thought} size={40} />
      </motion.div>
    </div>
  )
}

// The bonus round: six things on the belt, two monsters without a sign. The
// child gives each thing to either monster, and may move one from basket to
// basket. ✅ lets Lumi guess the rule: it hangs a sign on each monster (the
// rule's picture, crossed out on the other one, or the colours). Not rated
// — the level ends with the result of the sorting before.
function FreeSort({ onDone }) {
  const [things] = useState(buildFree)
  const [where,  setWhere] = useState(() => things.map(() => null))   // basket 0 | 1, or null
  const [moods,  setMoods] = useState(['idle', 'idle'])
  const [signs,  setSigns] = useState(null)                              // [sign, sign] once guessed
  const [mw, setMw] = useState(160)
  const rowRef = useRef(null)
  const firstRef = useRef(null)
  const checkRef = useRef(null)
  const moodT = useRef(null)
  const [bursts, burst] = useBursts()
  const allIn = where.every(w => w !== null)
  const guessed = !!signs

  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const measure = () => setMw(Math.floor(Math.max(110, Math.min(230, (el.clientWidth - 24) / 2, el.clientHeight / 1.3))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  useEffect(() => { sayTask(); return () => clearTimeout(moodT.current) }, [])

  const put = (b, t) => {
    const i = things.indexOf(t)
    if (guessed || where[i] === b) return false
    setWhere(where.map((x, j) => (j === i ? b : x)))
    setMoods(m => m.map((x, j) => (j === b ? 'happy' : x)))
    clearTimeout(moodT.current)
    moodT.current = setTimeout(() => setMoods(['idle', 'idle']), 800)
    sfx.pop()
    return true
  }

  const check = () => {
    const g = guessRule([0, 1].map(b => things.filter((_, i) => where[i] === b)))
    setSigns(g ?? [{ emoji: '❓' }, { emoji: '❓' }])
    clearTimeout(moodT.current)
    setMoods(g ? ['dance', 'dance'] : ['point', 'point'])
    if (g) { sfx.match(); burst(rowRef.current, 'confetti', 16) } else sfx.boing()
  }

  const thing = (t, size, ref) => (
    <Draggable id={t.emoji} data={t} label={t.name} disabled={guessed}>
      <div ref={ref}><Art art={t.emoji} size={size} /></div>
    </Draggable>
  )
  const firstLeft = things.findIndex((_, i) => where[i] === null)

  return (
    <DragArea disabled={guessed}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 16px 0', gap: 10, userSelect: 'none' }}>
        <div style={{ width: '100%', maxWidth: 760, display: 'flex' }}>
          <ThinkingLumi thought={!guessed ? '❓' : signs[0].emoji === '❓' ? '❓' : '💡'} />
        </div>

        <div ref={rowRef} style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 24 }}>
          {FREE_TINT.map((tint, b) => (
            <MonsterZone key={b} id={`free${b}`} width={mw} onDrop={t => put(b, t)}
              label={b === 0 ? 'Linkes Korbmonster' : 'Rechtes Korbmonster'}
              tint={tint} look={b + 1} mood={moods[b]} sign={signs?.[b]}
              items={things.filter((_, i) => where[i] === b).map(t => ({ id: t.emoji, emoji: t.emoji, t }))}
              renderItem={guessed ? undefined : (it, s) => thing(it.t, s)} />
          ))}
        </div>

        {/* the belt with what is left, then ✅ / ➡️ in its place */}
        <Belt rolls={where.filter(w => w !== null).length}>
          <div style={{ padding: '4px 0 50px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: '4px 10px', minHeight: 80 }}>
            {things.map((t, i) => where[i] === null && <div key={t.emoji}>{thing(t, 76, i === firstLeft ? firstRef : undefined)}</div>)}
            {allIn && !guessed && <PicButton key="check" art="✅" label="Fertig" onClick={check} btnRef={checkRef} />}
            {guessed && <PicButton key="next" art="➡️" label="Weiter" onClick={onDone} />}
          </div>
        </Belt>
      </div>
      {!allIn && <HintHand from={firstRef} to={rowRef} delay={4000} />}
      {allIn && !guessed && <HintHand to={checkRef} delay={4000} />}
      {bursts}
    </DragArea>
  )
}

export default function SortGame({ level = 1, onComplete }) {
  const [{ cats, items }] = useState(() => buildRound(level))
  const [curIdx, setCurIdx] = useState(0)
  const [sorted, setSorted] = useState(() => cats.map(() => []))
  const [moods,  setMoods]  = useState(() => cats.map(() => 'idle'))
  const [phase,  setPhase]  = useState('playing')    // playing | done | free
  const [busy,   setBusy]   = useState(false)        // the belt is moving on
  const [acted,  setActed]  = useState(false)        // the child gave something (the hand waits longer then)
  const paused   = usePaused()
  const missed   = useRef(new Set())                  // things that needed more than one try
  const final    = useRef(null)                       // the level's result, kept through the bonus round
  const monsters = useRef([])
  const frontRef = useRef(null)                       // the thing at the front of the belt (for the hint)
  const aimRef   = useRef(null)                       // above the monsters (for the hint)
  const streak   = useRef(0)                          // right at the first try in a row
  const timers   = useRef([])
  const moodT    = useRef([])
  const [bursts, burst] = useBursts()
  const [rowRef, mw] = useMonsterWidth(cats.length)
  const total   = items.length
  const current = items[curIdx] ?? null

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => { timers.current.forEach(clearTimeout); moodT.current.forEach(clearTimeout) }, [])
  useEffect(() => { sayTask() }, [])

  // A monster's mood, back to idle after `ms`
  const setMood = useCallback((i, m, ms = 1200) => {
    clearTimeout(moodT.current[i])
    setMoods(list => list.map((x, j) => (j === i ? m : x)))
    if (ms) moodT.current[i] = setTimeout(() => setMoods(list => list.map((x, j) => (j === i ? 'idle' : x))), ms)
  }, [])

  // A thing given to monster `target`: taken if it belongs there
  const give = (target, it) => {
    if (!current || it.id !== current.id) return false
    setActed(true)
    timers.current.forEach(clearTimeout)
    timers.current = []

    if (it.cat !== target) {
      // It goes back onto the belt and can be given again, but no longer
      // counts as right on the first try. The monster pulls a face, then the
      // right one jumps and its sign lights up.
      missed.current.add(it.id)
      streak.current = 0
      setMood(target, 'bah', 1300)
      later(() => setMood(it.cat, 'point', 1400), 500)
      sayWrong()
      return false
    }

    const first = !missed.current.has(it.id)
    streak.current = first ? streak.current + 1 : 0
    sfx.pop()
    setSorted(prev => prev.map((list, i) => (i === target ? [...list, it] : list)))
    setMood(target, 'happy', 900)
    burst(monsters.current[target], 'stars')
    // a run of right answers: the other monsters cheer along, louder and louder
    if (streak.current >= 3) {
      sfx.combo(streak.current)
      cats.forEach((_, i) => i !== target && later(() => setMood(i, 'happy', 900), 150))
      if (streak.current % 5 === 0) burst(monsters.current[target], 'confetti', 18)
    }
    sayRight()
    const next = items[curIdx + 1]
    setCurIdx(curIdx + 1)
    if (next) {
      // now and then a full basket burps (a surprise, not a reward)
      if (Math.random() < 0.2) later(() => { sfx.burp(); setMood(target, 'burp', 900) }, 950)
      setBusy(true)
      later(() => setBusy(false), 700)
    } else {
      // the end: everybody dances before the choice what comes next
      final.current = result(total - missed.current.size, total)
      later(() => {
        setPhase('done')
        sfx.complete()
        cats.forEach((_, i) => setMood(i, 'dance', 3600))
        burst(rowRef.current, 'confetti', 20)
      }, 900)
    }
    return true
  }

  if (phase === 'free') return <FreeSort onDone={() => onComplete(final.current)} />

  const queue = items.slice(curIdx, curIdx + 3)

  return (
    <DragArea disabled={paused || busy || phase !== 'playing'}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 16px 0', gap: 6, userSelect: 'none' }}>
        <div style={{ width: '100%', maxWidth: 760 }}>
          <RoundTrail total={total} done={curIdx} walker="🐭" goal="🧀" />
        </div>

        {/* the monsters, each with the sign of what it collects */}
        <div ref={rowRef} style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', alignContent: 'flex-end', justifyContent: 'center', gap: '10px 18px' }}>
          <div ref={aimRef} aria-hidden="true" style={{ position: 'absolute', left: '50%', bottom: '58%', width: 1, height: 1 }} />
          {cats.map((c, i) => (
            <MonsterZone key={c.label} id={`cat${i}`} width={mw} onDrop={it => give(i, it)}
              monsterRef={el => { monsters.current[i] = el }}
              label={c.label}
              tint={c} sign={{ emoji: c.emoji, label: c.label }} look={i} mood={moods[i]} items={sorted[i]} />
          ))}
        </div>

        {/* the belt: the front thing can be picked up, the next ones wait */}
        <Belt rolls={curIdx} height={BIG + 52}>
          <AnimatePresence>
            {phase === 'playing' && queue.map((it, i) => (
              <motion.div key={it.id} initial={{ x: 640 }} animate={{ x: i * GAP - BIG / 2, scale: i ? 0.72 : 1, opacity: i ? 0.9 : 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={{ type: 'spring', stiffness: 170, damping: 22 }}
                style={{ position: 'absolute', left: '50%', bottom: 40, width: BIG, height: BIG, transformOrigin: '50% 100%' }}>
                {i === 0
                  ? <Draggable id={it.id} data={it} label={it.name}>
                      {/* a little hop when it arrives at the front */}
                      <motion.div ref={frontRef} animate={reduceMotion() ? undefined : { y: [0, -22, 0, -6, 0] }} transition={{ duration: 0.6, delay: 0.35 }}>
                        <Art art={it.emoji} size={BIG} />
                      </motion.div>
                    </Draggable>
                  : <Art art={it.emoji} size={BIG} />}
              </motion.div>
            ))}
          </AnimatePresence>
        </Belt>

        {/* Done: sort any way you like (not rated), or on to the stars */}
        <AnimatePresence>
          {phase === 'done' && (
            <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }}
              style={{ position: 'absolute', left: 0, right: 0, bottom: 22, display: 'flex', justifyContent: 'center', zIndex: 5 }}>
              <div style={{ ...pxPanel, padding: '10px 18px', display: 'flex', gap: 22, alignItems: 'center' }}>
                <PicButton art="🧺" label="Selbst sortieren" color="gold" onClick={() => setPhase('free')} />
                <PicButton art="➡️" label="Weiter" onClick={() => onComplete(final.current)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <HintHand from={frontRef} to={aimRef} active={phase === 'playing' && !busy} delay={acted ? 6000 : 2000} />
      {bursts}
    </DragArea>
  )
}
