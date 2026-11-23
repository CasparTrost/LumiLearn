import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HearOptions from '../components/HearOptions.jsx'
import { Art, DragArea, Draggable, DropZone, RoundTrail, useBursts, useDragState } from '../components/play/index.js'
import Korbmonster from './sort/Korbmonster.jsx'
import { sfx } from '../sfx.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { usePaused } from '../lib/pause.js'
import { result } from '../lib/score.js'
import { INK, pxPanel, pxBubble, pxButton } from './px.js'

/**
 * Sortier-Spaß: "Wer will was?" — Kategorisieren & Konzeptbildung
 *
 * Each category is a basket monster (sort/Korbmonster.jsx) with a sign: one
 * collects animals, one food, one toys. Things arrive on a conveyor belt;
 * the child drags (or taps, then taps the monster) each thing to the one
 * that wants it. The right monster grins and the thing peeks out of its
 * basket, so the group visibly grows; the wrong one pulls a face ("Bäh!"),
 * the thing bounces back onto the belt, and the right monster jumps.
 *
 * Scientific basis:
 *   • Concept Formation (Bruner, 1956) — categorisation is a core cognitive skill underlying
 *     all higher-order thinking and early science/math literacy.
 *   • Vocabulary in context — every thing is named when it appears and again, with its
 *     category, after it is sorted ("Der Hund ist ein Tier."), so the child hears the word
 *     and the concept together instead of only matching pictures.
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

// A basket: what it says, its picture, its tint, and how Lumi explains that a
// thing belongs in it ("Der Hund" + " ist ein Tier."). Items are [emoji, name
// with its article in the nominative].
const cat = (label, emoji, tint, says, items) => ({ label, emoji, ...TINT[tint], says, items })

// Every item belongs to its basket without an "it depends": no tomato as a
// vegetable, no shark that floats, no glasses that belong to the daytime.
const SETS = {
  'tiere-essen': [
    cat('Tiere', '🐾', 'green', 'ist ein Tier', [
      ['🐕', 'der Hund'], ['🐱', 'die Katze'], ['🦁', 'der Löwe'], ['🐸', 'der Frosch'], ['🐬', 'der Delfin'],
      ['🐘', 'der Elefant'], ['🐧', 'der Pinguin'], ['🐯', 'der Tiger'], ['🐢', 'die Schildkröte'], ['🦋', 'der Schmetterling']]),
    cat('Essen', '🍽️', 'orange', 'ist etwas zum Essen', [
      ['🍕', 'die Pizza'], ['🍎', 'der Apfel'], ['🥨', 'die Brezel'], ['🍰', 'der Kuchen'], ['🍌', 'die Banane'],
      ['🥕', 'die Karotte'], ['🍉', 'die Melone'], ['🍓', 'die Erdbeere'], ['🧀', 'der Käse'], ['🍞', 'das Brot']]),
  ],
  'tiere-spielzeug': [
    cat('Tiere', '🐾', 'green', 'ist ein Tier', [
      ['🐶', 'der Hund'], ['🐰', 'der Hase'], ['🦔', 'der Igel'], ['🐝', 'die Biene'], ['🦆', 'die Ente'],
      ['🐞', 'der Marienkäfer'], ['🐴', 'das Pferd'], ['🐷', 'das Schwein'], ['🐮', 'die Kuh']]),
    cat('Spielzeug', '🧸', 'pink', 'ist ein Spielzeug', [
      ['🧸', 'der Teddy'], ['🪀', 'das Jo-Jo'], ['🪁', 'der Drachen'], ['🎲', 'der Würfel'], ['⚽', 'der Ball'],
      ['🪆', 'die Puppe'], ['🎈', 'der Luftballon'], ['🧩', 'das Puzzle'], ['🤖', 'der Roboter']]),
  ],
  'obst-gemuese': [
    cat('Obst', '🍎', 'red', 'ist Obst', [
      ['🍎', 'der Apfel'], ['🍌', 'die Banane'], ['🍓', 'die Erdbeere'], ['🍇', 'die Traube'], ['🍊', 'die Orange'],
      ['🍒', 'die Kirsche'], ['🍐', 'die Birne'], ['🍑', 'der Pfirsich'], ['🍋', 'die Zitrone'], ['🍍', 'die Ananas']]),
    cat('Gemüse', '🥦', 'green', 'ist Gemüse', [
      ['🥦', 'der Brokkoli'], ['🥕', 'die Karotte'], ['🥒', 'die Gurke'], ['🫑', 'die Paprika'], ['🥔', 'die Kartoffel'],
      ['🧅', 'die Zwiebel'], ['🥬', 'der Salat'], ['🍆', 'die Aubergine'], ['🧄', 'der Knoblauch']]),
  ],
  'fahrzeuge-natur': [
    cat('Fahrzeuge', '🚗', 'lilac', 'ist ein Fahrzeug', [
      ['🚕', 'das Taxi'], ['✈️', 'das Flugzeug'], ['🚂', 'die Lokomotive'], ['🚢', 'das Schiff'], ['🚁', 'der Hubschrauber'],
      ['🚲', 'das Fahrrad'], ['🚌', 'der Bus'], ['🚒', 'das Feuerwehrauto'], ['🚜', 'der Traktor'], ['⛵', 'das Segelboot']]),
    cat('Natur', '🌿', 'green', 'gehört zur Natur', [
      ['🌲', 'der Tannenbaum'], ['🌸', 'die Blüte'], ['🍄', 'der Pilz'], ['⛰️', 'der Berg'], ['🌻', 'die Sonnenblume'],
      ['🌴', 'die Palme'], ['🌵', 'der Kaktus'], ['🍁', 'das Blatt'], ['🪨', 'der Stein']]),
  ],
  'rund-eckig': [
    cat('Rund', '🔵', 'blue', 'ist rund', [
      ['🌕', 'der Vollmond'], ['🏀', 'der Basketball'], ['⚽', 'der Fußball'], ['🍊', 'die Orange'], ['🍪', 'der Keks'],
      ['🕐', 'die Uhr'], ['🍩', 'der Donut']]),
    cat('Eckig', '🟧', 'orange', 'ist eckig', [
      ['📦', 'das Paket'], ['📱', 'das Handy'], ['🧱', 'der Ziegelstein'], ['🖼️', 'das Bild'], ['📚', 'der Bücherstapel'],
      ['🎁', 'das Geschenk'], ['🎲', 'der Würfel'], ['📺', 'der Fernseher']]),
  ],
  'musik-sport': [
    cat('Musik', '🎵', 'pink', 'ist ein Musikinstrument', [
      ['🎸', 'die Gitarre'], ['🎹', 'das Klavier'], ['🥁', 'die Trommel'], ['🎺', 'die Trompete'], ['🎻', 'die Geige'],
      ['🪗', 'das Akkordeon']]),
    cat('Sport', '🏅', 'orange', 'gehört zum Sport', [
      ['⚽', 'der Fußball'], ['🏀', 'der Basketball'], ['🎾', 'der Tennisball'], ['🏓', 'der Tischtennisschläger'],
      ['🏸', 'der Federball'], ['🏐', 'der Volleyball'], ['🛹', 'das Skateboard']]),
  ],
  'drinnen-draussen': [
    cat('Drinnen', '🏠', 'lilac', 'ist drinnen im Haus', [
      ['🛏️', 'das Bett'], ['🛁', 'die Badewanne'], ['📺', 'der Fernseher'], ['🛋️', 'das Sofa'], ['🚿', 'die Dusche'],
      ['🍳', 'die Pfanne']]),
    cat('Draußen', '🌳', 'green', 'ist draußen', [
      ['🛝', 'die Rutsche'], ['⛲', 'der Brunnen'], ['⛰️', 'der Berg'], ['🌳', 'der Baum'], ['🏖️', 'der Strand'],
      ['⛺', 'das Zelt'], ['🌈', 'der Regenbogen']]),
  ],
  'gross-klein': [
    cat('Groß', '🐘', 'pink', 'ist groß', [
      ['🐋', 'der Wal'], ['🦒', 'die Giraffe'], ['🐘', 'der Elefant'], ['🦏', 'das Nashorn'], ['🦛', 'das Nilpferd'],
      ['🐪', 'das Kamel'], ['🐻', 'der Bär']]),
    cat('Klein', '🐭', 'blue', 'ist klein', [
      ['🐞', 'der Marienkäfer'], ['🐜', 'die Ameise'], ['🐝', 'die Biene'], ['🦋', 'der Schmetterling'], ['🐛', 'die Raupe'],
      ['🐌', 'die Schnecke'], ['🐭', 'die Maus'], ['🐤', 'das Küken']]),
  ],
  'warm-kalt': [
    cat('Warm', '🔥', 'red', 'ist warm', [
      ['☀️', 'die Sonne'], ['🍵', 'der Tee'], ['🔥', 'das Feuer'], ['🌋', 'der Vulkan'], ['🍲', 'die Suppe'],
      ['🕯️', 'die Kerze'], ['☕', 'der Kakao']]),
    cat('Kalt', '❄️', 'blue', 'ist kalt', [
      ['🧊', 'der Eiswürfel'], ['🍦', 'das Eis'], ['⛄', 'der Schneemann'], ['🌨️', 'der Schnee'],
      ['🏔️', 'der Schneeberg'], ['🍧', 'das Wassereis']]),
  ],
  'tag-nacht': [
    cat('Tag', '☀️', 'yellow', 'gehört zum Tag', [
      ['☀️', 'die Sonne'], ['🌈', 'der Regenbogen'], ['🐓', 'der Hahn'], ['🌻', 'die Sonnenblume'], ['🦋', 'der Schmetterling'],
      ['🐝', 'die Biene']]),
    cat('Nacht', '🌙', 'lilac', 'gehört zur Nacht', [
      ['🌙', 'der Mond'], ['⭐', 'der Stern'], ['🦉', 'die Eule'], ['🦇', 'die Fledermaus'],
      ['🌃', 'die Stadt bei Nacht']]),
  ],
  'suess-salzig': [
    cat('Süß', '🍭', 'pink', 'schmeckt süß', [
      ['🍭', 'der Lutscher'], ['🍫', 'die Schokolade'], ['🍰', 'der Kuchen'], ['🍩', 'der Donut'], ['🍪', 'der Keks'],
      ['🍬', 'das Bonbon'], ['🍯', 'der Honig']]),
    cat('Salzig', '🧂', 'grey', 'schmeckt salzig', [
      ['🧂', 'das Salz'], ['🥨', 'die Brezel'], ['🥓', 'der Speck'], ['🧀', 'der Käse'], ['🍕', 'die Pizza']]),
  ],
  'fluessig-fest': [
    cat('Flüssig', '💧', 'blue', 'ist flüssig', [
      ['💧', 'das Wasser'], ['🥛', 'die Milch'], ['🍵', 'der Tee'], ['🥤', 'der Saft'], ['☕', 'der Kakao']]),
    cat('Fest', '🧱', 'brown', 'ist fest', [
      ['🧱', 'der Ziegelstein'], ['🪨', 'der Stein'], ['🍞', 'das Brot'], ['🧊', 'der Eiswürfel'], ['🔑', 'der Schlüssel']]),
  ],
  'wasser-luft': [
    cat('Im Wasser', '🌊', 'blue', 'lebt im Wasser', [
      ['🐟', 'der Fisch'], ['🐙', 'der Tintenfisch'], ['🐬', 'der Delfin'], ['🐳', 'der Wal'], ['🐠', 'der bunte Fisch'],
      ['🦈', 'der Hai'], ['🐡', 'der Kugelfisch']]),
    cat('In der Luft', '☁️', 'lilac', 'fliegt durch die Luft', [
      ['🦅', 'der Adler'], ['🦋', 'der Schmetterling'], ['🦜', 'der Papagei'], ['🐝', 'die Biene'], ['🕊️', 'die Taube'],
      ['🦉', 'die Eule']]),
  ],
  'hof-wild': [
    cat('Bauernhof', '🚜', 'orange', 'lebt auf dem Bauernhof', [
      ['🐄', 'die Kuh'], ['🐖', 'das Schwein'], ['🐑', 'das Schaf'], ['🐓', 'der Hahn'], ['🐴', 'das Pferd'],
      ['🐐', 'die Ziege'], ['🐔', 'das Huhn']]),
    cat('Wilde Tiere', '🌴', 'green', 'ist ein wildes Tier', [
      ['🦁', 'der Löwe'], ['🐯', 'der Tiger'], ['🐻', 'der Bär'], ['🐺', 'der Wolf'], ['🦓', 'das Zebra'],
      ['🐒', 'der Affe'], ['🦒', 'die Giraffe']]),
  ],
  'pflanzen-fleisch': [
    cat('Frisst Pflanzen', '🌿', 'green', 'frisst Pflanzen', [
      ['🐇', 'das Kaninchen'], ['🐄', 'die Kuh'], ['🦒', 'die Giraffe'], ['🐘', 'der Elefant'], ['🐑', 'das Schaf'],
      ['🦓', 'das Zebra'], ['🐨', 'der Koala']]),
    cat('Frisst Fleisch', '🥩', 'red', 'frisst Fleisch', [
      ['🦁', 'der Löwe'], ['🐺', 'der Wolf'], ['🐯', 'der Tiger'], ['🦈', 'der Hai'], ['🦅', 'der Adler'],
      ['🐊', 'das Krokodil']]),
  ],
  'lebt-nicht': [
    cat('Lebt', '🌱', 'green', 'lebt', [
      ['🌳', 'der Baum'], ['🐕', 'der Hund'], ['🌸', 'die Blume'], ['🐟', 'der Fisch'], ['🍄', 'der Pilz'],
      ['🐝', 'die Biene'], ['🐌', 'die Schnecke'], ['🌵', 'der Kaktus']]),
    cat('Lebt nicht', '🧱', 'brown', 'lebt nicht', [
      ['📦', 'das Paket'], ['🚗', 'das Auto'], ['🪑', 'der Stuhl'], ['🧲', 'der Magnet'], ['🧱', 'der Ziegelstein'],
      ['🔑', 'der Schlüssel'], ['🪨', 'der Stein'], ['⏰', 'der Wecker']]),
  ],
  'schwimmt-sinkt': [
    cat('Schwimmt oben', '🦆', 'blue', 'schwimmt oben auf dem Wasser', [
      ['🍃', 'das Blatt'], ['🚤', 'das Boot'], ['🦆', 'die Ente'], ['🎈', 'der Luftballon'], ['🧽', 'der Schwamm'],
      ['🪵', 'das Holz'], ['🛟', 'der Rettungsring']]),
    cat('Geht unter', '⚓', 'grey', 'geht im Wasser unter', [
      ['🔑', 'der Schlüssel'], ['🪙', 'die Münze'], ['🔨', 'der Hammer'], ['⚙️', 'das Zahnrad'], ['🪨', 'der Stein'],
      ['⚓', 'der Anker']]),
  ],
  'holz-metall': [
    cat('Aus Holz', '🪵', 'brown', 'ist aus Holz', [
      ['🪑', 'der Stuhl'], ['✏️', 'der Bleistift'], ['🛶', 'das Kanu'], ['🪆', 'die Holzpuppe'],
      ['🎻', 'die Geige']]),
    cat('Aus Metall', '🔩', 'grey', 'ist aus Metall', [
      ['🔗', 'die Kette'], ['🗝️', 'der Schlüssel'], ['⚓', 'der Anker'], ['🔧', 'der Schraubenschlüssel'], ['⚙️', 'das Zahnrad'],
      ['🔩', 'die Schraube'], ['🪙', 'die Münze']]),
  ],
  // three baskets
  'wasser-luft-land': [
    cat('Im Wasser', '🌊', 'blue', 'lebt im Wasser', [
      ['🐟', 'der Fisch'], ['🐙', 'der Tintenfisch'], ['🐬', 'der Delfin'], ['🐳', 'der Wal'], ['🦈', 'der Hai']]),
    cat('In der Luft', '☁️', 'lilac', 'fliegt durch die Luft', [
      ['🦅', 'der Adler'], ['🦋', 'der Schmetterling'], ['🦜', 'der Papagei'], ['🕊️', 'die Taube'], ['🦉', 'die Eule']]),
    cat('An Land', '⛰️', 'green', 'lebt an Land', [
      ['🐘', 'der Elefant'], ['🐕', 'der Hund'], ['🦁', 'der Löwe'], ['🐄', 'die Kuh'], ['🦔', 'der Igel']]),
  ],
  'tier-pflanze-ding': [
    cat('Tiere', '🐾', 'orange', 'ist ein Tier', [
      ['🐕', 'der Hund'], ['🐱', 'die Katze'], ['🐸', 'der Frosch'], ['🐢', 'die Schildkröte'], ['🐌', 'die Schnecke']]),
    cat('Pflanzen', '🌱', 'green', 'ist eine Pflanze', [
      ['🌳', 'der Baum'], ['🌷', 'die Tulpe'], ['🌵', 'der Kaktus'], ['🌻', 'die Sonnenblume'], ['🌴', 'die Palme']]),
    cat('Dinge', '📦', 'grey', 'ist ein Ding', [
      ['🚗', 'das Auto'], ['🪑', 'der Stuhl'], ['⏰', 'der Wecker'], ['🔑', 'der Schlüssel'], ['✏️', 'der Bleistift']]),
  ],
  'obst-gemuese-suess': [
    cat('Obst', '🍎', 'red', 'ist Obst', [
      ['🍌', 'die Banane'], ['🍓', 'die Erdbeere'], ['🍐', 'die Birne'], ['🍒', 'die Kirsche'], ['🍊', 'die Orange']]),
    cat('Gemüse', '🥦', 'green', 'ist Gemüse', [
      ['🥕', 'die Karotte'], ['🥒', 'die Gurke'], ['🥔', 'die Kartoffel'], ['🫑', 'die Paprika'], ['🧅', 'die Zwiebel']]),
    cat('Süßes', '🍭', 'pink', 'ist etwas Süßes', [
      ['🍫', 'die Schokolade'], ['🍬', 'das Bonbon'], ['🍩', 'der Donut'], ['🍪', 'der Keks'], ['🧁', 'das Törtchen']]),
  ],
  'kueche-bad-zimmer': [
    cat('Küche', '🍲', 'orange', 'gehört in die Küche', [
      ['🍳', 'die Pfanne'], ['🍴', 'das Besteck'], ['🫖', 'die Teekanne'], ['🍽️', 'der Teller'], ['🧂', 'der Salzstreuer']]),
    cat('Bad', '🛁', 'blue', 'gehört ins Bad', [
      ['🚿', 'die Dusche'], ['🪥', 'die Zahnbürste'], ['🧼', 'die Seife'], ['🧽', 'der Schwamm'], ['🧴', 'die Creme']]),
    cat('Kinderzimmer', '🧸', 'pink', 'gehört ins Kinderzimmer', [
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
const cap = s => s[0].toUpperCase() + s.slice(1)

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

// What Lumi can recognise, in this order. `says` is the guess.
const RULES = [
  { key: 'tier',   says: 'Ich glaube, du hast nach Tieren sortiert! In einem Korb sind die Tiere.' },
  { key: 'essen',  says: 'Ich glaube, du hast nach Essen sortiert! In einem Korb ist alles, was man essen kann.' },
  { key: 'fliegt', says: 'Ich glaube, du hast sortiert, was fliegen kann! In einem Korb ist alles, was fliegt.' },
  { key: 'faehrt', says: 'Ich glaube, du hast nach Fahrzeugen sortiert! In einem Korb ist alles, was fährt.' },
  { key: 'color',  says: ([a, b]) => {
    const ca = new Set(a.map(t => t.color)), cb = new Set(b.map(t => t.color))
    return ca.size === 1 && cb.size === 1
      ? `Ich glaube, du hast nach Farben sortiert! In einem Korb ist alles ${[...ca][0]}, im anderen alles ${[...cb][0]}.`
      : 'Ich glaube, du hast nach Farben sortiert!'
  } },
]

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

// Lumi's guess for the child's two baskets
function guessRule(baskets) {
  if (!baskets[0].length || !baskets[1].length) return 'Alles in einen Korb! Das ist auch eine Idee.'
  const fits = RULES.find(({ key }) => {
    const a = new Set(baskets[0].map(t => t[key]))
    return baskets[1].every(t => !a.has(t[key]))
  })
  if (fits) return typeof fits.says === 'function' ? fits.says(baskets) : fits.says
  return 'Spannend! Wie hast du sortiert? Erzähl es mal!'
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
const FREE_TASK = 'Jetzt bestimmst du! Gib den zwei Korbmonstern die Sachen, ganz wie du willst. Dann rät Lumi, wie du sortiert hast.'
const BIG = 108   // the thing at the front of the belt
const GAP = 124   // from one place on the belt to the next

// One basket monster as a place to drop things: it opens its mouth while
// something is held over it or picked up, and says what it collects when
// tapped with empty hands.
function MonsterZone({ id, width, onDrop, label, say, monsterRef, mood, ...monster }) {
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
    if (say) narrate([{ text: say }], { skipIfSame: true })
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

// The size of a monster: as large as the row allows, at most 250 wide
function useMonsterWidth(n) {
  const ref = useRef(null)
  const [w, setW] = useState(160)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(Math.floor(Math.max(90, Math.min(250, (el.clientWidth - 18 * (n - 1)) / n, el.clientHeight / 1.3))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])
  return [ref, w]
}

// Says a thing's name when the child picks it up with a tap
function SayPicked({ name }) {
  const { picked } = useDragState()
  const id = picked?.id
  useEffect(() => { if (id) narrate([{ text: `${cap(name(id))}.` }], { skipIfSame: true }) }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
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

// The bonus round: six things on the belt, two monsters without a sign. The
// child gives each thing to either monster, and may move one from basket to
// basket. "Fertig" lets Lumi guess the rule. Not rated — the level ends with
// the result of the sorting before.
function FreeSort({ onDone }) {
  const [things] = useState(buildFree)
  const [where,  setWhere] = useState(() => things.map(() => null))   // basket 0 | 1, or null
  const [moods,  setMoods] = useState(['idle', 'idle'])
  const [guess,  setGuess] = useState(null)
  const [mw, setMw] = useState(160)
  const rowRef = useRef(null)
  const allIn = where.every(w => w !== null)

  useLayoutEffect(() => {
    const el = rowRef.current
    if (!el) return
    const measure = () => setMw(Math.floor(Math.max(110, Math.min(230, (el.clientWidth - 24) / 2, el.clientHeight / 1.3))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    lockPreviews()
    const id = setTimeout(() => sayTask(FREE_TASK), 400)
    return () => clearTimeout(id)
  }, [])

  const put = (b, t) => {
    const i = things.indexOf(t)
    if (guess || where[i] === b) return false
    const next = where.map((x, j) => (j === i ? b : x))
    setWhere(next)
    setMoods(m => m.map((x, j) => (j === b ? 'happy' : x)))
    setTimeout(() => setMoods(['idle', 'idle']), 800)
    sfx.pop()
    if (next.every(w => w !== null)) narrate([{ text: 'Fertig? Dann tippe auf den grünen Haken.' }])
    return true
  }

  const check = () => {
    const g = guessRule([0, 1].map(b => things.filter((_, i) => where[i] === b)))
    setGuess(g)
    setMoods(['dance', 'dance'])
    sfx.match()
    lockPreviews()
    narrate([{ text: g }])
  }

  const thing = (t, size) => (
    <Draggable id={t.emoji} data={t} label={t.name} disabled={!!guess}>
      <Art art={t.emoji} size={size} />
    </Draggable>
  )

  return (
    <DragArea disabled={!!guess}>
      <SayPicked name={id => things.find(t => t.emoji === id).name} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 16px 0', gap: 10, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 760 }}>
          <Art art="lumi" size={60} />
          <div style={{ flex: 1, ...pxBubble, padding: '10px 16px', fontFamily: 'var(--font-heading)', fontSize: 19, color: INK }}>
            {guess ?? (allIn ? 'Fertig? Tippe auf den Haken!' : 'Sortiere, wie du willst!')}
          </div>
          <HearOptions items={[guess ?? FREE_TASK]} label="Vorlesen" size={52} />
        </div>

        <div ref={rowRef} style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 24 }}>
          {FREE_TINT.map((tint, b) => (
            <MonsterZone key={b} id={`free${b}`} width={mw} onDrop={t => put(b, t)}
              label={b === 0 ? 'Linkes Korbmonster' : 'Rechtes Korbmonster'}
              tint={tint} look={b + 1} mood={moods[b]}
              items={things.filter((_, i) => where[i] === b).map(t => ({ id: t.emoji, emoji: t.emoji, t }))}
              renderItem={guess ? undefined : (it, s) => thing(it.t, s)} />
          ))}
        </div>

        {/* the belt with what is left, then "Fertig" / "Weiter" in its place */}
        <Belt rolls={where.filter(w => w !== null).length}>
          <div style={{ padding: '4px 0 50px', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: '4px 10px' }}>
            {things.map((t, i) => where[i] === null && <div key={t.emoji}>{thing(t, 76)}</div>)}
            {allIn && !guess && (
              <motion.button key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.94 }}
                onClick={check} {...hearable('Fertig')} aria-label="Fertig"
                style={{ ...pxButton('green'), padding: '8px 34px', minHeight: 52, fontSize: 21 }}>
                {'✅ Fertig!'}
              </motion.button>
            )}
            {guess && (
              <motion.button key="next" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 }} whileTap={{ scale: 0.94 }}
                onClick={onDone} {...hearable('Weiter')} aria-label="Weiter"
                style={{ ...pxButton('green'), padding: '8px 40px', minHeight: 52, fontSize: 21 }}>
                {'Weiter! ➡️'}
              </motion.button>
            )}
          </div>
        </Belt>
      </div>
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
  const paused   = usePaused()
  const missed   = useRef(new Set())                  // things that needed more than one try
  const final    = useRef(null)                       // the level's result, kept through the bonus round
  const monsters = useRef([])
  const timers   = useRef([])
  const moodT    = useRef([])
  const [bursts, burst] = useBursts()
  const [rowRef, mw] = useMonsterWidth(cats.length)
  const total   = items.length
  const current = items[curIdx] ?? null

  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))
  useEffect(() => () => { timers.current.forEach(clearTimeout); moodT.current.forEach(clearTimeout) }, [])

  // A monster's mood, back to idle after `ms`
  const setMood = useCallback((i, m, ms = 1200) => {
    clearTimeout(moodT.current[i])
    setMoods(list => list.map((x, j) => (j === i ? m : x)))
    if (ms) moodT.current[i] = setTimeout(() => setMoods(list => list.map((x, j) => (j === i ? 'idle' : x))), ms)
  }, [])

  const task = cur => `Die Korbmonster sammeln: ${cats.map(c => c.label).join(' und ')}. Wer bekommt ${cur.name}?`

  // The task, then the first thing by name
  useEffect(() => {
    lockPreviews()
    const id = setTimeout(() => sayTask(task(items[0])), 400)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // A thing given to monster `target`: taken if it belongs there
  const give = (target, it) => {
    if (!current || it.id !== current.id) return false
    const sentence = `${cap(it.name)} ${cats[it.cat].says}.`

    if (it.cat !== target) {
      // It goes back onto the belt and can be given again, but no longer
      // counts as right on the first try.
      missed.current.add(it.id)
      setMood(target, 'bah', 1300)
      later(() => setMood(it.cat, 'point', 1400), 450)
      sayWrong(sentence)
      return false
    }

    sfx.pop()
    setSorted(prev => prev.map((list, i) => (i === target ? [...list, it] : list)))
    setMood(target, 'happy', 900)
    burst(monsters.current[target], 'stars')
    // now and then a full basket burps (a surprise, not a reward)
    if (Math.random() < 0.2) later(() => { sfx.burp(); setMood(target, 'burp', 900) }, 950)
    const next = items[curIdx + 1]
    sayRight(next ? `${sentence} Und jetzt: ${next.name}.` : sentence)
    setCurIdx(curIdx + 1)
    if (next) {
      setBusy(true)
      later(() => setBusy(false), 650)
    } else {
      final.current = result(total - missed.current.size, total)
      later(() => {
        setPhase('done')
        sfx.complete()
        cats.forEach((_, i) => setMood(i, 'dance', 3600))
        afterNarration(() => {
          narrate([{ text: 'Geschafft! Alles ist sortiert. Möchtest du jetzt selbst sortieren, ganz wie du willst? Dann tippe auf den Korb. Sonst tippe auf den Pfeil.' }])
        }, { minMs: 300 })
      }, 900)
    }
    return true
  }

  if (phase === 'free') return <FreeSort onDone={() => onComplete(final.current)} />

  const queue = items.slice(curIdx, curIdx + 3)

  return (
    <DragArea disabled={paused || busy || phase !== 'playing'}>
      <SayPicked name={id => items.find(it => it.id === id).name} />
      <div style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 16px 0', gap: 6, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 760 }}>
          <RoundTrail total={total} done={curIdx} walker="🐭" goal="🧀" style={{ flex: 1 }} />
          <HearOptions items={[current ? task(current) : cats.map(c => c.label).join(' und ')]} label="Aufgabe anhören" size={52} />
        </div>

        {/* the monsters, each with the sign of what it collects */}
        <div ref={rowRef} style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 18 }}>
          {cats.map((c, i) => (
            <MonsterZone key={c.label} id={`cat${i}`} width={mw} onDrop={it => give(i, it)}
              monsterRef={el => { monsters.current[i] = el }}
              label={c.label} say={`${c.label}!`}
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
                  ? <Draggable id={it.id} data={it} label={it.name}><Art art={it.emoji} size={BIG} /></Draggable>
                  : <Art art={it.emoji} size={BIG} />}
              </motion.div>
            ))}
          </AnimatePresence>
        </Belt>

      {/* Done: on to the stars, or sort any way you like (not rated) */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
            style={{ position: 'absolute', left: 0, right: 0, bottom: 18, display: 'flex', justifyContent: 'center', zIndex: 5 }}>
            <div style={{ ...pxPanel, padding: '12px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
              <motion.button whileTap={{ scale: 0.94 }} onClick={() => setPhase('free')}
                {...hearable('Selbst sortieren')} aria-label="Selbst sortieren"
                style={{ ...pxButton('gold'), padding: '10px 20px', minHeight: 56, fontSize: 20 }}>
                {'🧺 Selbst sortieren'}
              </motion.button>
              <motion.button whileTap={{ scale: 0.94 }} onClick={() => onComplete(final.current)}
                {...hearable('Weiter')} aria-label="Weiter"
                style={{ ...pxButton('green'), padding: '10px 28px', minHeight: 56, fontSize: 20 }}>
                {'Weiter ➡️'}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
      {bursts}
    </DragArea>
  )
}
