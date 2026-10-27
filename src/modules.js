// The games, in one place.
//
// Names, pictures and colours were kept in four lists (HomeScreen,
// GameScreen, ParentScreen, InfoButton) and had drifted apart: the parent
// area called "Zahlenland" "Zahlen-Markt" and "Memo-Welt" "Wörter-Quiz".
// Every screen now reads them from here.
//
//   world   the theme world a game belongs to on the home screen
//   minAge  from which age the game is a good first choice; younger
//           children can still play it, it is only not recommended
//   say     what Lumi says about the game when a child points at its tile

export const WORLDS = [
  { id: 'zahlen',     label: 'Zahlen',     emoji: '🔢', say: 'Die Zahlen-Welt. Hier zählst und rechnest du.' },
  { id: 'buchstaben', label: 'Buchstaben', emoji: '🔤', say: 'Die Buchstaben-Welt. Hier geht es um Laute, Wörter und Buchstaben.' },
  { id: 'denken',     label: 'Knobeln',    emoji: '🧩', say: 'Die Knobel-Welt. Hier löst du Rätsel.' },
  { id: 'gefuehle',   label: 'Gefühle',    emoji: '💛', say: 'Die Gefühle-Welt. Hier geht es um Gefühle und Freunde.' },
  { id: 'malen',      label: 'Malen',      emoji: '🎨', say: 'Die Mal-Welt. Hier malst du.' },
]

// Flat colours from the pixel palette (styles/pixel.css) for the tile heads.
export const MODULES = [
  { id: 'number-intro',  title: 'Zahlen entdecken', sub: 'Zahlen 1 bis 10',        emoji: '🧮', world: 'zahlen',     minAge: 4, color: 'var(--px-gold)',   say: 'Zahlen entdecken. Zähle Dinge und lerne die Zahlen.' },
  { id: 'letter-intro',  title: 'ABC-Abenteuer',    sub: 'Das Alphabet',           emoji: '🔡', world: 'buchstaben', minAge: 4, color: 'var(--px-sky)',    say: 'ABC-Abenteuer. Lerne die Buchstaben kennen.' },
  { id: 'emotions',      title: 'Gefühlswelt',      sub: 'Gefühle erkennen',       emoji: '😊', world: 'gefuehle',   minAge: 4, color: 'var(--px-pink)',   say: 'Gefühlswelt. Wie fühlt sich Lumi?' },
  { id: 'listen',        title: 'Hörabenteuer',     sub: 'Hören und finden',       emoji: '🔊', world: 'buchstaben', minAge: 4, color: 'var(--px-orange)', say: 'Hörabenteuer. Hör genau hin und finde das Bild.' },
  { id: 'shadows',       title: 'Schattenrätsel',   sub: 'Was ist im Dunkeln?',    emoji: '🌑', world: 'denken',     minAge: 4, color: 'var(--px-night)',  say: 'Schattenrätsel. Was versteckt sich im Dunkeln?' },
  { id: 'shapes',        title: 'Farbenreich',      sub: 'Bilder anmalen',         emoji: '🎨', world: 'malen',      minAge: 4, color: 'var(--px-blue)',   say: 'Farbenreich. Male Bilder mit den richtigen Farben an.' },
  { id: 'numbers',       title: 'Zahlenland',       sub: 'Einkaufen und zählen',   emoji: '🔢', world: 'zahlen',     minAge: 5, color: 'var(--px-green)',  say: 'Zahlenland. Kaufe im Laden genau richtig ein.' },
  { id: 'letters',       title: 'Buchstabenwald',   sub: 'Wörter schreiben',       emoji: '⌨️', world: 'buchstaben', minAge: 6, color: 'var(--px-teal)',   say: 'Buchstabenwald. Schreibe Wörter mit Buchstaben.' },
  { id: 'words2',        title: 'Silben-Spaß',      sub: 'Wörter aus Silben',      emoji: '🔤', world: 'buchstaben', minAge: 5, color: 'var(--px-green)',  say: 'Silben-Spaß. Baue Wörter aus Silben.' },
  { id: 'bubbles',       title: 'Blasen-Blitz',     sub: 'Blasen antippen',        emoji: '🫧', world: 'zahlen',     minAge: 5, color: 'var(--px-sky)',    say: 'Blasen-Blitz. Tippe die richtigen Blasen an.' },
  { id: 'words',         title: 'Memo-Welt',        sub: 'Paare finden',           emoji: '🃏', world: 'denken',     minAge: 4, color: 'var(--px-pink)',   say: 'Memo-Welt. Finde die Paare.' },
  { id: 'patterns',      title: 'Musterpark',       sub: 'Was kommt als Nächstes?', emoji: '🔮', world: 'denken',    minAge: 4, color: 'var(--px-orange)', say: 'Musterpark. Was kommt als Nächstes?' },
  { id: 'sort',          title: 'Sortier-Spaß',     sub: 'Alles an seinen Platz',  emoji: '🧺', world: 'denken',     minAge: 4, color: 'var(--px-wood-light)', say: 'Sortier-Spaß. Räume alles an den richtigen Platz.' },
  { id: 'weight',        title: 'Waage-Welt',       sub: 'Was ist schwerer?',      emoji: '⚖️', world: 'zahlen',     minAge: 5, color: 'var(--px-parch-dark)', say: 'Waage-Welt. Was ist schwerer?' },
  { id: 'clock',         title: 'Uhren-Uhr',        sub: 'Die Uhr lesen',          emoji: '🕐', world: 'zahlen',     minAge: 6, color: 'var(--px-red)',    say: 'Uhren-Uhr. Lerne die Uhr lesen.' },
  { id: 'maze',          title: 'Lumi-Labyrinth',   sub: 'Den Weg finden',         emoji: '🌀', world: 'denken',     minAge: 4, color: 'var(--px-purple)', say: 'Lumi-Labyrinth. Hilf Lumi durch das Labyrinth.' },
  { id: 'stories',       title: 'Lumis Abenteuer',  sub: 'Geschichten mit dir',    emoji: '📖', world: 'gefuehle',   minAge: 5, color: 'var(--px-teal)',   say: 'Lumis Abenteuer. Hör eine Geschichte und entscheide mit.' },
  { id: 'rocket-math',   title: 'Rechen-Rakete',    sub: 'Plus und minus',         emoji: '🚀', world: 'zahlen',     minAge: 6, color: 'var(--px-blue)',   say: 'Rechen-Rakete. Rechne mit der Rakete auf dem Zahlenstrahl.' },
  { id: 'shapes-land',   title: 'Formen-Land',      sub: 'Formen finden',          emoji: '🔷', world: 'denken',     minAge: 4, color: 'var(--px-teal)',   say: 'Formen-Land. Finde Kreise, Dreiecke und Quadrate.' },
  { id: 'rhyme',         title: 'Reim-Rallye',      sub: 'Was reimt sich?',        emoji: '🎵', world: 'buchstaben', minAge: 5, color: 'var(--px-pink)',   say: 'Reim-Rallye. Finde Wörter, die gleich klingen.' },
  { id: 'initial-sound', title: 'Anlaut-Detektiv',  sub: 'Der erste Laut',         emoji: '🕵️', world: 'buchstaben', minAge: 5, color: 'var(--px-gold)',   say: 'Anlaut-Detektiv. Mit welchem Laut fängt das Wort an?' },
  { id: 'empathy',       title: 'Gefühlsdetektiv',  sub: 'Anderen helfen',         emoji: '🕵️‍♀️', world: 'gefuehle', minAge: 5, color: 'var(--px-red)',    say: 'Gefühlsdetektiv. Wie geht es dem Kind, und wie kannst du helfen?' },
  { id: 'shape-build',   title: 'Formen-Werkstatt', sub: 'Aus Formen bauen',       emoji: '🧩', world: 'denken',     minAge: 5, color: 'var(--px-orange)', say: 'Formen-Werkstatt. Baue Bilder aus Formen.' },
  { id: 'coloring',      title: 'Mal-Atelier',      sub: 'Frei malen',             emoji: '🖍️', world: 'malen',      minAge: 4, color: 'var(--px-purple)', say: 'Mal-Atelier. Male, was du möchtest.' },
]

export const MODULE_BY_ID = Object.fromEntries(MODULES.map(m => [m.id, m]))
export const moduleTitle = id => MODULE_BY_ID[id]?.title ?? id

// The order in which a child new to the app meets the games: first
// counting, letters and feelings, the clock and the number line last.
const PATH = [
  'number-intro', 'letter-intro', 'emotions', 'listen', 'shapes', 'shapes-land',
  'words', 'sort', 'patterns', 'shadows', 'maze', 'coloring', 'rhyme', 'initial-sound',
  'numbers', 'words2', 'bubbles', 'weight', 'empathy', 'stories', 'shape-build',
  'letters', 'clock', 'rocket-math',
]
const pathIndex = id => { const i = PATH.indexOf(id); return i < 0 ? PATH.length : i }

// The age was asked in the onboarding and then never used. A child counts
// as 4 at the least (the app is made for 4 to 7).
const ageOf = profile => Math.max(4, Math.min(7, profile?.age ?? 5))

/** All games, the ones that suit the child's age first. */
export function sortForAge(mods, profile) {
  const age = ageOf(profile)
  return [...mods].sort((a, b) =>
    (a.minAge > age) - (b.minAge > age) || pathIndex(a.id) - pathIndex(b.id))
}

/**
 * Three to six games for the top of the home screen ("Für dich"), instead of
 * all 24 at once: the game the child played last, games it has started and
 * not finished, then new games that suit its age — at most two from the
 * same world, so the row stays varied.
 */
export function recommend({ progress = {}, profile, lastPlayed, playedToday = [], count = 4 }) {
  const age = ageOf(profile)
  const fits = m => m.minAge <= age
  const started = m => Object.values(progress[m.id]?.levelStars ?? {}).some(s => s >= 1)
  const done = m => !!progress[m.id]?.completed
  // how close a game is to the age (a 7-year-old gets the 6+ games first)
  const nearness = m => Math.abs(age - (m.minAge + 1))
  const byPath = (a, b) => pathIndex(a.id) - pathIndex(b.id)

  const picked = []
  const perWorld = {}
  const take = (m, why, cap = 2) => {
    if (!m || picked.some(p => p.mod.id === m.id)) return
    if ((perWorld[m.world] ?? 0) >= cap) return
    perWorld[m.world] = (perWorld[m.world] ?? 0) + 1
    picked.push({ mod: m, why })
  }

  const last = MODULE_BY_ID[lastPlayed?.moduleId]
  if (last && !done(last)) take(last, 'continue')

  MODULES.filter(m => fits(m) && started(m) && !done(m) && !playedToday.includes(m.id))
    .sort(byPath).forEach(m => picked.length < Math.ceil(count / 2) && take(m, 'started'))

  MODULES.filter(m => fits(m) && !started(m))
    .sort((a, b) => nearness(a) - nearness(b) || byPath(a, b))
    .forEach(m => picked.length < count && take(m, 'new'))

  // Few new games left (an older child who has tried everything): whatever
  // is not mastered yet, then anything.
  ;[...MODULES].sort(byPath).forEach(m => picked.length < count && !done(m) && take(m, 'started', 9))
  ;[...MODULES].sort(byPath).forEach(m => picked.length < count && take(m, 'again', 9))
  return picked
}
