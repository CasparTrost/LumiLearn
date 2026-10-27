import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import HearOptions from '../components/HearOptions.jsx'
import { sfx } from '../sfx.js'
import { narrate, afterNarration, lockPreviews } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import { INK, pxCard, pxPanel, pxBubble, pxButton, pxSegment } from './px.js'

/**
 * Sortier-Spaß — Kategorisieren & Konzeptbildung
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

const ZONE_DROP = '0 5px 0 rgba(42,27,61,0.35)'

// Basket tints: light enough for ink text on top (the titles used to be
// written in the category colour itself, 1.8:1 on the tint), with a darker
// ring of the same hue for "it flies in here" and "this is where it goes".
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
const FREE_TASK = 'Jetzt bestimmst du! Sortiere die Sachen in die zwei Körbe, ganz wie du willst. Dann rät Lumi, wie du sortiert hast.'

// The bonus round: tap a thing (the next one is already chosen), then a
// basket. Once all are in, tap a thing in a basket and then the other basket
// to move it; before that, a tap on a basket's things counts as a tap on the
// basket. "Fertig" lets Lumi guess. Not rated — the level ends with the
// result of the sorting before.
function FreeSort({ onDone }) {
  const [things] = useState(buildFree)
  const [where,  setWhere]  = useState(() => things.map(() => null))   // basket 0 | 1, or null
  const [sel,    setSel]    = useState(0)
  const [guess,  setGuess]  = useState(null)
  const allIn = where.every(w => w !== null)

  useEffect(() => {
    lockPreviews()
    const id = setTimeout(() => sayTask(`${FREE_TASK} Zuerst: ${things[0].name}.`), 400)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const put = useCallback((b) => {
    if (guess || sel === null) return
    const next = where.map((x, j) => (j === sel ? b : x))
    const nextSel = next.indexOf(null)
    setWhere(next)
    setSel(nextSel === -1 ? null : nextSel)
    sfx.pop()
    narrate([{ text: nextSel === -1 ? 'Fertig? Dann tippe auf den grünen Haken.' : `Und jetzt: ${things[nextSel].name}.` }])
  }, [guess, sel, where, things])

  const pick = (i, e) => {
    e?.stopPropagation()
    if (guess) return
    if (where[i] !== null && sel !== null && where[sel] === null) { put(where[i]); return }
    setSel(i)
    narrate([{ text: `${cap(things[i].name)}.` }], { skipIfSame: true })
  }

  const check = () => {
    const g = guessRule([0, 1].map(b => things.filter((_, i) => where[i] === b)))
    setGuess(g)
    sfx.match()
    lockPreviews()
    narrate([{ text: g }])
  }

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); put(0) }
      if (e.key === 'ArrowRight') { e.preventDefault(); put(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [put])

  const bubble = guess ?? (allIn && sel === null ? 'Fertig? Tippe auf den Haken!' : 'Sortiere, wie du willst!')

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(10px,2vw,20px) clamp(12px,3vw,28px)', gap:'clamp(10px,1.8vw,16px)', userSelect:'none' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:700 }}>
        <LumiCharacter mood={guess ? 'excited' : 'happy'} size={66} />
        <div style={{ flex:1, ...pxBubble, padding:'10px 16px', fontFamily:'var(--font-heading)', fontSize:'clamp(15px,3vw,20px)', color:'var(--text-primary)' }}>
          {bubble}
        </div>
        <HearOptions items={[guess ?? FREE_TASK]} label="Vorlesen" size={48} />
      </div>

      {/* The six things; a placed one leaves an empty slot */}
      <div style={{ width:'100%', maxWidth:700, display:'grid', gridTemplateColumns:'repeat(6, minmax(0, 1fr))', gap:'clamp(6px,1.4vw,12px)' }}>
        {things.map((t, i) => (
          where[i] === null ? (
            <motion.button key={t.emoji} onClick={e => pick(i, e)} aria-label={t.name}
              whileTap={{ scale:0.94 }}
              animate={{ scale: sel === i ? 1.08 : 1 }}
              style={{
                aspectRatio:'1', minWidth:44, padding:0, cursor:'pointer',
                ...pxCard(sel === i ? 'selected' : undefined),
                ...(sel === i ? { boxShadow:`inset 0 0 0 3px ${INK}, ${ZONE_DROP}` } : {}),
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'clamp(28px,7vw,60px)', lineHeight:1,
              }}>
              {t.emoji}
            </motion.button>
          ) : (
            <div key={t.emoji} style={{ aspectRatio:'1', borderRadius:12, border:'3px dashed rgba(42,27,61,0.25)' }} />
          )
        ))}
      </div>

      {/* Two baskets, no names: the child decides what goes where */}
      <div style={{ width:'100%', maxWidth:700, display:'grid', gridTemplateColumns:'1fr 1fr', gap:'clamp(8px,2.4vw,20px)' }}>
        {FREE_TINT.map((c, b) => (
          <motion.div key={b} role="button" tabIndex={0}
            aria-label={b === 0 ? 'Linker Korb' : 'Rechter Korb'}
            onClick={() => put(b)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); put(b) } }}
            whileTap={!guess && sel !== null ? { scale:0.97 } : {}}
            style={{
              minHeight:'clamp(150px,26vw,220px)', minWidth:0, cursor: guess || sel === null ? 'default' : 'pointer',
              background:c.bg, border:`3px solid ${INK}`, borderRadius:14,
              boxShadow:`inset 0 -6px 0 ${c.ring}33, ${ZONE_DROP}`,
              display:'flex', flexDirection:'column', alignItems:'center', gap:8,
              padding:'clamp(8px,1.5vw,14px) 6px',
            }}>
            <span style={{ fontSize:'clamp(34px,6.5vw,48px)', lineHeight:1 }}>{'🧺'}</span>
            <span style={{ display:'flex', flexWrap:'wrap', gap:6, justifyContent:'center' }}>
              <AnimatePresence>
                {things.map((t, i) => where[i] === b && (
                  <motion.button key={t.emoji} onClick={e => pick(i, e)} aria-label={t.name}
                    initial={{ scale:0, y:-10 }} animate={{ scale:1, y:0 }} exit={{ scale:0 }}
                    transition={{ type:'spring', stiffness:420, damping:18 }}
                    disabled={!!guess}
                    style={{ minWidth:44, minHeight:44, padding:2, borderRadius:10, cursor: guess ? 'default' : 'pointer',
                      background: sel === i ? '#FFF0B8' : 'transparent', border: sel === i ? `3px solid ${INK}` : '3px solid transparent',
                      display:'flex', alignItems:'center', justifyContent:'center', fontSize:'clamp(28px,5.5vw,40px)', lineHeight:1 }}>
                    {t.emoji}
                  </motion.button>
                ))}
              </AnimatePresence>
            </span>
          </motion.div>
        ))}
      </div>

      {/* Fixed slot: "Fertig" when everything is in a basket, then "Weiter" */}
      <div style={{ height:62, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {allIn && !guess && (
          <motion.button key="check" initial={{ scale:0 }} animate={{ scale:1 }} whileTap={{ scale:0.94 }}
            onClick={check} {...hearable('Fertig')} aria-label="Fertig"
            style={{ ...pxButton('green'), padding:'10px 34px', minHeight:52, fontSize:'clamp(17px,3.4vw,21px)' }}>
            {'✅ Fertig!'}
          </motion.button>
        )}
        {guess && (
          <motion.button key="next" initial={{ scale:0 }} animate={{ scale:1 }} transition={{ delay:0.4 }} whileTap={{ scale:0.94 }}
            onClick={onDone} {...hearable('Weiter')} aria-label="Weiter"
            style={{ ...pxButton('green'), padding:'10px 40px', minHeight:52, fontSize:'clamp(17px,3.4vw,21px)' }}>
            {'Weiter! ➡️'}
          </motion.button>
        )}
      </div>
    </div>
  )
}

export default function SortGame({ level = 1, onComplete }) {
  const [{ cats, items }] = useState(() => buildRound(level))
  const [curIdx,   setCurIdx]   = useState(0)
  const [sorted,   setSorted]   = useState(() => cats.map(() => []))
  // Which basket the item actually belonged to, shown after a mis-sort.
  const [revealCat, setRevealCat] = useState(null)
  const [fly,      setFly]      = useState(null)    // { cat, dx, dy } while the item flies in
  const [feedback, setFeedback] = useState(null)    // 'ok' | 'wrong'
  const [mood,     setMood]     = useState('happy')
  const [phase,    setPhase]    = useState('playing')
  const missed     = useRef(new Set())               // items that needed more than one try
  const final      = useRef(null)                     // the level's result, kept through the bonus round
  const itemRef    = useRef(null)
  const basketRefs = useRef([])
  const busy       = useRef(false)
  const total   = items.length
  const current = items[curIdx] ?? null

  const sortItem = useCallback((target) => {
    if (!current || busy.current || phase !== 'playing') return
    busy.current = true
    const c = cats[current.cat]
    const sentence = `${cap(current.name)} ${c.says}.`

    if (current.cat === target) {
      sfx.correct()
      setFeedback('ok')
      setMood('excited')
      // fly into the basket that was tapped; `k` undoes the FitBox scale,
      // the measured rects are on screen, the motion is in the game's units
      const from = itemRef.current?.getBoundingClientRect()
      const to   = basketRefs.current[target]?.getBoundingClientRect()
      const k    = from?.width ? itemRef.current.offsetWidth / from.width : 1
      setFly(from && to
        ? { cat: target, dx: (to.left + to.width / 2 - (from.left + from.width / 2)) * k, dy: (to.top + to.height / 2 - (from.top + from.height / 2)) * k }
        : { cat: target, dx: 0, dy: 120 })
      const next = items[curIdx + 1]
      lockPreviews()
      sayRight(next ? `${sentence} Und jetzt: ${next.name}.` : sentence)
      setTimeout(() => {
        setSorted(prev => prev.map((list, i) => (i === target ? [...list, current] : list)))
        setFly(null)
        setFeedback(null)
        setMood('happy')
        busy.current = false
        if (!next) {
          final.current = result(total - missed.current.size, total)
          setPhase('done')
          sfx.complete()
          afterNarration(() => {
            narrate([{ text: 'Geschafft! Alles ist sortiert. Möchtest du jetzt selbst sortieren, ganz wie du willst? Dann tippe auf den Korb. Sonst tippe auf den Pfeil.' }])
          }, { minMs: 300 })
        } else {
          setCurIdx(curIdx + 1)
        }
      }, 650)
    } else {
      // The item stays and can be sorted again, but it no longer counts as
      // right on the first try — before, every level ended "Alles richtig!".
      missed.current.add(current.id)
      sfx.wrong()
      setFeedback('wrong')
      setMood('encouraging')
      setRevealCat(current.cat)
      sayWrong(sentence)
      setTimeout(() => {
        setFeedback(null)
        setRevealCat(null)
        setMood('happy')
        busy.current = false
      }, 1300)
    }
  }, [current, cats, items, curIdx, phase, total])

  // Keyboard for desktop: ← first basket, → last, ↓ the middle one
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowLeft')  { e.preventDefault(); sortItem(0) }
      if (e.key === 'ArrowRight') { e.preventDefault(); sortItem(cats.length - 1) }
      if (e.key === 'ArrowDown' && cats.length === 3) { e.preventDefault(); sortItem(1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [sortItem, cats.length])

  // The task, then the first thing by name
  useEffect(() => {
    lockPreviews()
    const id = setTimeout(() => sayTask(`Was gehört wohin? ${cats.map(c => c.label).join(' oder ')}? Das ist ${items[0].name}.`), 400)
    return () => clearTimeout(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const sayItem = () => current && narrate([{ text: `${cap(current.name)}.` }], { skipIfSame: true })
  const three = cats.length === 3

  if (phase === 'free') return <FreeSort onDone={() => onComplete(final.current)} />

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(10px,2vw,20px) clamp(12px,3vw,28px)', gap:'clamp(10px,1.8vw,16px)', userSelect:'none' }}>

      {/* Progress bar */}
      <div style={{ display:'flex', gap:4, width:'100%', maxWidth:700 }}>
        {items.map((_, i) => (
          <div key={i} style={{ flex:1, ...pxSegment(i < curIdx || phase === 'done' ? 'done' : i === curIdx ? 'current' : 'todo'), transition:'background 0.3s' }} />
        ))}
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'center', gap:12, width:'100%', maxWidth:700 }}>
        <LumiCharacter mood={mood} size={66} />
        <div style={{ flex:1, ...pxBubble, padding:'10px 16px', fontFamily:'var(--font-heading)', fontSize:'clamp(15px,3vw,20px)', color:'var(--text-primary)' }}>
          {phase === 'done' ? '🎉 Geschafft! Alles ist sortiert.' : `Wohin gehört ${current?.name}?`}
        </div>
        <HearOptions items={cats.map(c => c.label)} label="Körbe vorlesen" size={48} />
      </div>

      {/* The thing to sort — tap it to hear its name again */}
      <div style={{ width:'clamp(116px,24vw,168px)', height:'clamp(116px,24vw,168px)', position:'relative', zIndex:10 }}>
        <AnimatePresence mode="wait">
          {current && phase === 'playing' && (
            <motion.button
              key={current.id}
              ref={itemRef}
              onClick={sayItem}
              aria-label={current.name}
              initial={{ scale:0, opacity:0, x:0, y:0 }}
              animate={
                fly ? { x: fly.dx, y: fly.dy, scale:0.35, opacity:0 } :
                feedback === 'wrong' ? { x:[0,-20,20,-16,16,-10,10,-5,5,0], y:0, scale:1, opacity:1 } :
                { scale:1, opacity:1, x:0, y:0 }
              }
              exit={{ scale:0, opacity:0, transition:{ duration:0.12 } }}
              transition={feedback === 'wrong' ? { duration:0.55, ease:'easeInOut' } : { type:'spring', stiffness:300, damping:26 }}
              style={{
                width:'100%', height:'100%', padding:0, cursor:'pointer',
                ...pxCard(feedback === 'wrong' ? 'wrong' : feedback === 'ok' ? 'right' : undefined),
                borderRadius:14,
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'clamp(60px,13vw,100px)', lineHeight:1,
              }}
            >
              {current.emoji}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Baskets — tap the one it belongs in */}
      <div style={{ width:'100%', maxWidth:700, display:'grid', gridTemplateColumns:`repeat(${cats.length}, 1fr)`, gap:'clamp(8px,2.4vw,20px)' }}>
        {cats.map((c, i) => {
          const revealed = revealCat === i
          const target   = fly?.cat === i
          return (
            <motion.button
              key={c.label}
              ref={el => { basketRefs.current[i] = el }}
              whileTap={{ scale:0.96 }}
              onClick={() => sortItem(i)}
              aria-label={c.label}
              {...hearable(c.label)}
              animate={revealed ? { scale:[1, 1.05, 1, 1.05, 1] } : { scale:1 }}
              transition={{ duration:0.9 }}
              style={{
                minHeight:'clamp(150px,26vw,220px)', minWidth:0, cursor:'pointer',
                background:c.bg, border:`3px solid ${INK}`, borderRadius:14,
                boxShadow: revealed ? `inset 0 0 0 5px ${c.ring}, 0 0 0 4px ${c.ring}, ${ZONE_DROP}`
                         : target   ? `inset 0 0 0 5px ${c.ring}, ${ZONE_DROP}`
                         : `inset 0 -6px 0 ${c.ring}33, ${ZONE_DROP}`,
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-start', gap:6,
                padding:'clamp(8px,1.5vw,14px) 6px',
                transition:'box-shadow 0.2s',
                color:INK,
              }}
            >
              <span style={{ fontSize: three ? 'clamp(30px,6vw,44px)' : 'clamp(34px,6.5vw,48px)', lineHeight:1 }}>{c.emoji}</span>
              <span style={{ fontFamily:'var(--font-heading)', fontSize: three ? 'clamp(14px,3.2vw,22px)' : 'clamp(17px,3.8vw,26px)', fontWeight:700, lineHeight:1.15, textAlign:'center', overflowWrap:'anywhere' }}>
                {c.label}
              </span>
              <span style={{ display:'flex', flexWrap:'wrap', gap:4, justifyContent:'center' }}>
                <AnimatePresence>
                  {sorted[i].map(it => (
                    <motion.span key={it.id} initial={{ scale:0, y:-10 }} animate={{ scale:1, y:0 }} transition={{ type:'spring', stiffness:420, damping:18 }}
                      style={{ fontSize: three ? 'clamp(22px,4.6vw,34px)' : 'clamp(26px,5.5vw,40px)', lineHeight:1 }}>
                      {it.emoji}
                    </motion.span>
                  ))}
                </AnimatePresence>
              </span>
            </motion.button>
          )
        })}
      </div>

      {/* Done */}
      <AnimatePresence>
        {phase === 'done' && (
          <motion.div
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(42,27,61,0.25)', zIndex:50 }}
          >
            <motion.div initial={{ scale:0.7 }} animate={{ scale:1 }}
              style={{ ...pxPanel, padding:'24px clamp(16px,4vw,36px)', margin:16, display:'flex', flexDirection:'column', alignItems:'center', gap:10 }}>
              <div style={{ fontSize:72, lineHeight:1 }}>{'🎉'}</div>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(26px,7vw,44px)', fontWeight:800, color:INK }}>
                {'Geschafft!'}
              </div>
              {/* Bonus: sort any way you like (not rated) — or on to the stars */}
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center', marginTop:6 }}>
                <motion.button whileTap={{ scale:0.94 }} onClick={() => setPhase('free')}
                  {...hearable('Selbst sortieren')} aria-label="Selbst sortieren"
                  style={{ ...pxButton('gold'), padding:'10px 20px', minHeight:52, fontSize:'clamp(16px,3.2vw,20px)' }}>
                  {'🧺 Selbst sortieren'}
                </motion.button>
                <motion.button whileTap={{ scale:0.94 }} onClick={() => onComplete(final.current)}
                  {...hearable('Weiter')} aria-label="Weiter"
                  style={{ ...pxButton('green'), padding:'10px 28px', minHeight:52, fontSize:'clamp(16px,3.2vw,20px)' }}>
                  {'Weiter ➡️'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
