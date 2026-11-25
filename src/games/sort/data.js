// Sortier-Spaß, the belt (SortGame.jsx): the groups, what belongs to each,
// and what every level brings on the belt. The basket monsters collect
// things: everything hops into a basket, nothing is eaten.
import { LINES, line } from '../../lib/lumiLines.js'

// Monster tints: a light face plate (bg) and a darker weave (ring)
export const TINT = {
  green:  { bg: '#E3F6DA', ring: '#2F8F3A' },
  orange: { bg: '#FFEBD2', ring: '#C25E12' },
  blue:   { bg: '#DCEEFF', ring: '#1F6FC7' },
  pink:   { bg: '#FFE4F0', ring: '#C2185B' },
  red:    { bg: '#FFE0DA', ring: '#C2412D' },
  lilac:  { bg: '#E9E3FF', ring: '#6B3FD6' },
  grey:   { bg: '#ECEFF1', ring: '#546E7A' },
  yellow: { bg: '#FFF4C2', ring: '#9A7400' },
}

// A group: the word for the parents, its tint, and its things as
// [picture, name with its article]. The first things are the examples on
// the monster's sign and never come down the belt, so a child has to carry
// the idea over ("a lion is an animal too") instead of matching pictures.
// Every thing belongs to its group without an "it depends": no tomato as a
// vegetable, no scooter among the vehicles when there are toys, no duck on
// the farm, no corn among the vegetables (a grain), no matryoshka for a doll.
const group = (label, tint, things, opts = {}) => ({ label, tint, things, ...opts })

export const GROUPS = {
  tiere: group('Tiere', 'green', [
    ['🐕', 'der Hund'], ['🐱', 'die Katze'], ['🐘', 'der Elefant'],
    ['🦁', 'der Löwe'], ['🐸', 'der Frosch'], ['🐧', 'der Pinguin'], ['🐯', 'der Tiger'], ['🐢', 'die Schildkröte'],
    ['🦋', 'der Schmetterling'], ['🐰', 'der Hase'], ['🦔', 'der Igel'], ['🦆', 'die Ente'], ['🐴', 'das Pferd'],
    ['🐷', 'das Schwein'], ['🐮', 'die Kuh'], ['🐒', 'der Affe'], ['🦒', 'die Giraffe'], ['🦊', 'der Fuchs'], ['🐼', 'der Panda']]),
  essen: group('Essen', 'orange', [
    ['🍕', 'die Pizza'], ['🍎', 'der Apfel'], ['🍞', 'das Brot'],
    ['🥨', 'die Brezel'], ['🍰', 'der Kuchen'], ['🍌', 'die Banane'], ['🥕', 'die Möhre'], ['🍉', 'die Melone'],
    ['🍓', 'die Erdbeere'], ['🧀', 'der Käse'], ['🥐', 'das Hörnchen'], ['🍔', 'der Hamburger'], ['🧇', 'die Waffel'],
    ['🥚', 'das Ei'], ['🍝', 'die Nudeln']]),
  fahrzeuge: group('Fahrzeuge', 'blue', [
    ['🚗', 'das Auto'], ['✈️', 'das Flugzeug'], ['🚂', 'die Lok'],
    ['🚕', 'das Taxi'], ['🚢', 'das Schiff'], ['🚁', 'der Hubschrauber'], ['🚌', 'der Bus'], ['🚒', 'die Feuerwehr'],
    ['⛵', 'das Segelboot'], ['🚑', 'der Krankenwagen'], ['🚤', 'das Boot']]),
  spielzeug: group('Spielzeug', 'lilac', [
    ['🧸', 'der Teddy'], ['🎲', 'der Würfel'], ['🪀', 'das Jo-Jo'],
    ['🪁', 'der Drachen'], ['⚽', 'der Ball'], ['🎈', 'der Luftballon'], ['🧩', 'das Puzzle'],
    ['🤖', 'der Roboter']]),
  obst: group('Obst', 'red', [
    ['🍎', 'der Apfel'], ['🍌', 'die Banane'], ['🍓', 'die Erdbeere'],
    ['🍇', 'die Traube'], ['🍊', 'die Orange'], ['🍒', 'die Kirsche'], ['🍐', 'die Birne'], ['🍑', 'der Pfirsich'],
    ['🍋', 'die Zitrone'], ['🍍', 'die Ananas'], ['🥝', 'die Kiwi'], ['🍉', 'die Melone'], ['🫐', 'die Heidelbeere']]),
  gemuese: group('Gemüse', 'green', [
    ['🥕', 'die Möhre'], ['🥦', 'der Brokkoli'], ['🥒', 'die Gurke'],
    ['🫑', 'die Paprika'], ['🥔', 'die Kartoffel'], ['🧅', 'die Zwiebel'], ['🥬', 'der Salat'], ['🍆', 'die Aubergine'],
    ['🧄', 'der Knoblauch']]),
  suesses: group('Süßes', 'pink', [
    ['🍫', 'die Schokolade'], ['🍬', 'das Bonbon'], ['🍩', 'der Donut'],
    ['🍪', 'der Keks'], ['🧁', 'das Törtchen'], ['🍭', 'der Lutscher'], ['🍦', 'das Eis'], ['🍯', 'der Honig']]),
  hof: group('Bauernhof', 'yellow', [
    ['🐄', 'die Kuh'], ['🐖', 'das Schwein'], ['🐑', 'das Schaf'],
    ['🐓', 'der Hahn'], ['🐴', 'das Pferd'], ['🐐', 'die Ziege'], ['🐔', 'das Huhn'], ['🫏', 'der Esel'],
    ['🦃', 'der Truthahn'], ['🪿', 'die Gans']]),
  wild: group('Wilde Tiere', 'green', [
    ['🦁', 'der Löwe'], ['🐘', 'der Elefant'], ['🐒', 'der Affe'],
    ['🐯', 'der Tiger'], ['🐻', 'der Bär'], ['🐺', 'der Wolf'], ['🦓', 'das Zebra'], ['🦒', 'die Giraffe'],
    ['🦊', 'der Fuchs'], ['🐊', 'das Krokodil'], ['🦍', 'der Gorilla'], ['🦘', 'das Känguru'], ['🐍', 'die Schlange'],
    ['🐼', 'der Panda']]),
  // A property instead of a group. Round and with corners show the bare
  // shape first; big and small draw their things big and small, on the
  // sign, on the belt and in the basket (`size`), so the child sees the
  // size instead of knowing it.
  rund: group('Rund', 'blue', [
    ['🔵', 'der Kreis'], ['⚽', 'der Ball'], ['🍪', 'der Keks'],
    ['🏐', 'der Volleyball'], ['🪙', 'die Münze'], ['🕐', 'die Uhr'], ['🌕', 'der Mond'], ['🍊', 'die Orange'],
    ['🍩', 'der Donut']]),
  eckig: group('Eckig', 'orange', [
    ['🟧', 'das Viereck'], ['📦', 'das Paket'], ['🧱', 'der Ziegelstein'],
    ['🖼️', 'das Bild'], ['🎁', 'das Geschenk'], ['📺', 'der Fernseher'], ['🧊', 'der Eiswürfel'], ['🚪', 'die Tür'],
    ['📱', 'das Handy']]),
  gross: group('Groß', 'pink', [
    ['🐘', 'der Elefant'], ['🦒', 'die Giraffe'],
    ['🐋', 'der Wal'], ['🦏', 'das Nashorn'], ['🦛', 'das Nilpferd'], ['🐪', 'das Kamel'], ['🐻', 'der Bär'],
    ['🦍', 'der Gorilla'], ['🐊', 'das Krokodil']], { signs: 2, signScale: 1, size: 1 }),
  klein: group('Klein', 'blue', [
    ['🐭', 'die Maus'], ['🐜', 'die Ameise'],
    ['🐞', 'der Käfer'], ['🐝', 'die Biene'], ['🦋', 'der Schmetterling'], ['🐛', 'die Raupe'], ['🐌', 'die Schnecke'],
    ['🐤', 'das Küken'], ['🕷️', 'die Spinne']], { signs: 2, signScale: 0.65, size: 0.5 }),
  lebt: group('Lebt', 'green', [
    ['🌳', 'der Baum'], ['🐕', 'der Hund'], ['🌸', 'die Blume'],
    ['🐟', 'der Fisch'], ['🍄', 'der Pilz'], ['🐝', 'die Biene'], ['🐌', 'die Schnecke'], ['🌵', 'der Kaktus'],
    ['🌷', 'die Tulpe'], ['🌻', 'die Sonnenblume'], ['🐸', 'der Frosch'], ['🐱', 'die Katze'], ['🦋', 'der Schmetterling']]),
  lebtnicht: group('Lebt nicht', 'grey', [
    ['🪑', 'der Stuhl'], ['🔑', 'der Schlüssel'], ['🪨', 'der Stein'],
    ['📦', 'das Paket'], ['🚗', 'das Auto'], ['🧲', 'der Magnet'], ['🧱', 'der Ziegelstein'], ['⏰', 'der Wecker'],
    ['📱', 'das Handy'], ['🎁', 'das Geschenk'], ['⚽', 'der Ball'], ['🧸', 'der Teddy'], ['🤖', 'der Roboter']]),
}

// Rubbish: it belongs to no monster and goes into the bin. Only what is
// plainly rubbish (no clothes, nothing that could still be used). The
// pictures starting with "rubbish:" are drawn in sort/parts.jsx; all of
// them stink (wavy lines).
export const RUBBISH = [
  ['rubbish:graete', 'die Gräte'], ['rubbish:papier', 'das Papier'], ['rubbish:dose', 'die Dose'],
  ['rubbish:tasse', 'die Scherben'], ['🦴', 'der Knochen'],
]

// The ten levels. `sets`: the groups to choose from (one set per play);
// `need`: bites until a monster is full; `rubbish`: things for the bin;
// `cap`: things on the belt at once; `cross`: seconds a thing rides from
// one end of the belt to the other; `golden`: golden things (a star shower).
//   1–2  two monsters, groups far apart        3–4  three monsters
//   5–6  four monsters, groups close together  7–8  a property instead of a group
//   9–10 a bin for what belongs to nobody
export const LEVELS = [
  { sets: [['tiere', 'essen']], need: 4, cap: 2, cross: 15, golden: 1 },
  { sets: [['tiere', 'fahrzeuge'], ['essen', 'fahrzeuge'], ['tiere', 'essen']], need: 5, cap: 2, cross: 14, golden: 1 },
  { sets: [['tiere', 'essen', 'fahrzeuge']], need: 4, cap: 3, cross: 13, golden: 1 },
  { sets: [['essen', 'fahrzeuge', 'spielzeug'], ['tiere', 'essen', 'fahrzeuge']], need: 4, cap: 3, cross: 12, golden: 1 },
  { sets: [['obst', 'gemuese', 'fahrzeuge', 'spielzeug']], need: 3, cap: 3, cross: 11.5, golden: 2 },
  { sets: [['obst', 'gemuese', 'suesses', 'spielzeug'], ['hof', 'wild', 'fahrzeuge', 'spielzeug']], need: 4, cap: 3, cross: 11, golden: 2 },
  { sets: [['rund', 'eckig'], ['gross', 'klein']], need: 5, cap: 3, cross: 10.5, golden: 2 },
  { sets: [['lebt', 'lebtnicht']], need: 6, cap: 3, cross: 10, golden: 2 },
  { sets: [['obst', 'gemuese'], ['hof', 'wild']], need: 5, rubbish: 4, cap: 4, cross: 9.5, golden: 2 },
  { sets: [['obst', 'gemuese', 'suesses'], ['hof', 'wild', 'fahrzeuge']], need: 4, rubbish: 4, cap: 4, cross: 9, golden: 2 },
]

const slug = w => w.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-')
/** Lumi's recording of a thing's name ("Banane."), or null: 'die Banane' → wort/banane */
export const wordOf = name => {
  const key = `wort/${slug(name.replace(/^(der|die|das) /, ''))}`
  return LINES[key] ? line(key) : null
}
/** Lumi's recording of a group's word ("Tiere."), once it exists: fliessband/gruppe-<group> */
export const groupWord = key => (LINES[`fliessband/gruppe-${key}`] ? line(`fliessband/gruppe-${key}`) : null)
/** A sentence of this game (korb · schilder · tonne), or null while it is not recorded */
export const gameLine = key => (LINES[`fliessband/${key}`] ? line(`fliessband/${key}`) : null)

function shuffle(list, rng) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * One play of a level: the targets (monsters, and the bin last) and the
 * things for the belt in the order they come.
 *   targets: [{ key, kind: 'monster' | 'bin', label, tint, sign: [art], signScale, need, look }]
 *   things:  [{ id, art, name, to (index of its target), golden, rubbish, size }]
 *   (size: how big the thing is drawn, 1 = full; the small animals 0.5)
 */
export function planLevel(level, rng = Math.random) {
  const cfg = LEVELS[Math.min(Math.max(Math.round(level) || 1, 1), LEVELS.length) - 1]
  const set = cfg.sets[Math.floor(rng() * cfg.sets.length)]
  const targets = [], things = []
  // never the same picture twice on one belt (a ball is round and a toy),
  // and nothing on the belt that another monster shows on its sign
  const used = new Set(set.flatMap(key => GROUPS[key].things.slice(0, GROUPS[key].signs ?? 3).map(t => t[0])))
  set.forEach((key, ti) => {
    const g = GROUPS[key]
    const signs = g.signs ?? 3
    targets.push({ key, kind: 'monster', label: g.label, tint: TINT[g.tint], sign: g.things.slice(0, signs).map(t => t[0]), signScale: g.signScale ?? 1, need: cfg.need, look: ti % 3 })
    const pick = shuffle(g.things.slice(signs).filter(t => !used.has(t[0])), rng).slice(0, cfg.need)
    pick.forEach(([art, name]) => { used.add(art); things.push({ art, name, to: ti, size: g.size ?? 1 }) })
  })
  if (cfg.rubbish) {
    const ti = targets.length
    targets.push({ key: 'muell', kind: 'bin', label: 'Müll', tint: TINT.grey, sign: [], signScale: 1, need: cfg.rubbish, look: 0 })
    shuffle(RUBBISH, rng).slice(0, cfg.rubbish).forEach(([art, name]) => things.push({ art, name, to: ti, rubbish: true, size: 1 }))
  }
  // Mixed, but the first two things are for two different monsters and are
  // not rubbish: the start shows that there is more than one place to go.
  let order = shuffle(things, rng)
  for (let tries = 0; tries < 30 && (order[0].rubbish || order[1].rubbish || order[0].to === order[1].to); tries++) order = shuffle(things, rng)
  const gold = new Set(shuffle(order.map((t, i) => i).filter(i => i > 0 && !order[i].rubbish), rng).slice(0, cfg.golden ?? 0))
  return {
    level: Math.min(Math.max(Math.round(level) || 1, 1), LEVELS.length),
    cap: cfg.cap, cross: cfg.cross, targets,
    things: order.map((t, i) => ({ ...t, id: `t${i}`, golden: gold.has(i), rubbish: !!t.rubbish })),
  }
}
