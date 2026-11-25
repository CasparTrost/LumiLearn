import { LINES } from '../../lib/lumiLines.js'
import { KEY, slug } from '../woerter/voice.js'

// Buchstabenwald: the words Lumi conjures and the pictures on the keys.

// Every word is a concrete thing with its own picture: the picture and the
// spoken word are the only anchors a child who cannot read yet has. A word
// is here only if a five-year-old names its picture with exactly this word
// at a glance, and Lumi has recorded it.
//
// Taken out after the logic check (a teacher would reject them): WURST (a
// hot dog), NUDEL (a plate of spaghetti), TORTE and KUCHEN (the one could be
// the other), ARM (a biceps), GELD (a sack with "$"), SOCKE (two socks), UHR
// (an alarm clock), FUSS (misspells Fuß), JACKE (drawn as a coat), the rare
// OTTER, TRUTHAHN, PFAU and AXT, and on the same grounds MUND (lips), HOLZ
// (a log), SALZ (a salt shaker), BURG (a Schloss to most children), SCHULE
// (a house), ZIRKUS (a tent, next to ZELT), INSEL (a palm, next to PALME),
// BRÜCKE (a city at night), PFANNE (a fried egg), KREBS (a Krabbe), KÄFER (a
// Marienkäfer), KLAVIER (a row of keys) and MUSCHEL (a Schneckenhaus).
export const WORDS = {
  // 3 letters
  OMA:'👵', OPA:'👴', EIS:'🍦', ZUG:'🚂', BUS:'🚌', HUT:'🎩', FEE:'🧚', OHR:'👂',
  KUH:'🐄', HAI:'🦈', BÄR:'🐻', TOR:'🥅', WAL:'🐋', TÜR:'🚪', UFO:'🛸',
  // 4 letters
  HUND:'🐕', BALL:'⚽', BUCH:'📖', HAND:'✋', NASE:'👃', WOLF:'🐺', IGEL:'🦔', HERZ:'❤️',
  BOOT:'⛵', GANS:'🪿', HAHN:'🐓', HASE:'🐰', KEKS:'🍪', MAUS:'🐭', MOND:'🌙', PILZ:'🍄',
  ROSE:'🌹', SOFA:'🛋️', ZELT:'⛺', BEIN:'🦵', AFFE:'🐒', ESEL:'🫏', RING:'💍', BROT:'🍞',
  AUTO:'🚗', HAUS:'🏠', BAUM:'🌳', LÖWE:'🦁', KIWI:'🥝', LAMA:'🦙', ENTE:'🦆', EULE:'🦉',
  KÄSE:'🧀', MAIS:'🌽', DINO:'🦖', TAXI:'🚕', NEST:'🪺', ZAHN:'🦷', BETT:'🛏️', HOSE:'👖',
  WURM:'🪱',
  // 5 letters
  KATZE:'🐱', VOGEL:'🐦', STERN:'⭐', APFEL:'🍎', SCHUH:'👟', PIZZA:'🍕', FEUER:'🔥',
  TASSE:'☕', KERZE:'🕯️', ADLER:'🦅', BIRNE:'🍐', SEIFE:'🧼', KRONE:'👑', ZIEGE:'🐐',
  KAMEL:'🐪', PFERD:'🐴', TIGER:'🐯', GURKE:'🥒', GEIGE:'🎻', SCHAF:'🐑', BIENE:'🐝',
  ANKER:'⚓', FISCH:'🐟', WOLKE:'☁️', EIMER:'🪣', ZEBRA:'🦓', PANDA:'🐼', KOALA:'🐨',
  HONIG:'🍯', MILCH:'🥛', MÖHRE:'🥕', KÜKEN:'🐤', SONNE:'☀️', BLUME:'🌸', ROBBE:'🦭',
  RAUPE:'🐛', KRAKE:'🐙', PALME:'🌴', FEDER:'🪶', BESEN:'🧹', TEDDY:'🧸', BLITZ:'⚡',
  TULPE:'🌷', FUCHS:'🦊', GEIST:'👻', CLOWN:'🤡', STUHL:'🪑', TISCH:':px-tisch:', SCHAL:'🧣',
  STEIN:'🪨', SALAT:'🥗',
  // 6 letters
  TRAUBE:'🍇', RAKETE:'🚀', AMEISE:'🐜', SPINNE:'🕷️', PINSEL:'🖌️', TASCHE:'👜',
  SCHERE:'✂️', BREZEL:'🥨', KIRCHE:'⛪', KOFFER:'🧳', TELLER:'🍽️', BANANE:'🍌',
  TOMATE:'🍅', MELONE:'🍈', KAMERA:'📷', BRILLE:'👓', KÜRBIS:'🎃', DELFIN:'🐬',
  DRACHE:'🐉', ROLLER:'🛴', KAKTUS:'🌵', FROSCH:'🐸', SCHWAN:'🦢', BALLON:'🎈',
  ANANAS:'🍍', WAFFEL:'🧇', QUALLE:'🪼', ORANGE:'🍊', SCHIFF:'🚢', VULKAN:'🌋', LEITER:'🪜',
  // 7 letters
  ROBOTER:'🤖', ELEFANT:'🐘', ZITRONE:'🍋', GITARRE:'🎸', PINGUIN:'🐧', KÄNGURU:'🦘',
  HAMSTER:'🐹', TROMMEL:'🥁', PAPAGEI:'🦜', TRAKTOR:'🚜', GIRAFFE:'🦒',
  SPIEGEL:'🪞', FENSTER:'🪟', EINHORN:'🦄', FAHRRAD:'🚲', ZWIEBEL:'🧅', PAPRIKA:'🫑',
  SCHWEIN:'🐷', KNOCHEN:'🦴', DIAMANT:'💎', TROPFEN:'💧', XYLOFON:':px-xylofon:',
  // 8 letters
  KROKODIL:'🐊', FLUGZEUG:'✈️', SCHNECKE:'🐌', ZAUBERER:'🧙', ERDBEERE:'🍓',
  GESCHENK:'🎁', SCHLANGE:'🐍', TROMPETE:'🎺', BROKKOLI:'🥦', MIKROFON:'🎤',
}

// "ZUG" -> "Zug": what is spoken and named, while the tiles stay in capitals
export const nameOf = w => w[0] + w.slice(1).toLowerCase()

/**
 * The recording of a word: "Banane." (`wort/…`), else the same word from
 * the word games' list (`woerter/…`: QUALLE, FUCHS, TÜR, XYLOFON and the
 * others that came in for the words taken out), else null.
 */
export function wordKey(word) {
  const k = KEY.word(nameOf(word))
  if (k in LINES) return k
  const alt = `woerter/${slug(nameOf(word))}`
  return alt in LINES ? alt : null
}

export function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

/** `n` different words with a length in [min, max], none of `not`. */
export function pickWords([min, max], n, not = []) {
  return shuffle(Object.keys(WORDS).filter(w => w.length >= min && w.length <= max && !not.includes(w))).slice(0, n)
}

export const ROWS = [
  ['Q','W','E','R','T','Z','U','I','O','P','Ü'],
  ['A','S','D','F','G','H','J','K','L','Ö'],
  ['Y','X','C','V','B','N','M','Ä'],
]
export const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÜ'.split('')

// Anlauttabelle for levels 1–3: every key shows a word that starts with its
// sound, the key with the dog is the H of "Hund". The words are those of
// the app's recorded alphabet (`abc/<letter>`: "A wie Affe.", the one
// Buchstaben-Spuren and the ABC-Abenteuer use), with two exceptions:
//   • U is the Ufo, not the Uhu: the owl is the picture of the word EULE,
//     and a child looking for the owl's key would press U for EULE;
//   • J is the Jo-Jo: the jacket is drawn as a long coat.
// Y, Ä, Ö and Ü show only their letter: no word a child knows starts with
// them and has a clear picture (Yoga was a sitting person, Ähre an unknown
// word, the Ölkanne a watering can, "überrascht" a face next to the O).
// No picture here is the picture of a word that starts with another letter
// (tests/unit/kessel.test.js).
export const ANLAUT = {
  A:['Affe','🐒'],   B:['Bär','🐻'],     C:['Clown','🤡'],  D:['Dino','🦖'],    E:['Ente','🦆'],
  F:['Fisch','🐟'],  G:['Giraffe','🦒'], H:['Hund','🐕'],   I:['Igel','🦔'],    J:['Jo-Jo','🪀'],
  K:['Katze','🐱'],  L:['Löwe','🦁'],    M:['Maus','🐭'],   N:['Nase','👃'],    O:['Oma','👵'],
  P:['Pinguin','🐧'], Q:['Qualle','🪼'], R:['Rakete','🚀'], S:['Sonne','☀️'],   T:['Tiger','🐯'],
  U:['Ufo','🛸'],    V:['Vogel','🐦'],   W:['Wal','🐋'],    X:['Xylofon',':px-xylofon:'],
  Z:['Zebra','🦓'],
}

// How a conjured thing moves when it comes out of the cauldron and on the
// forest floor. Animals hop, unless they fly, swim or crawl; things that
// stand (a house, a tree, a tent) grow out of the ground; round things
// spin; the rest bounces in place.
export const MOVE_OF = Object.fromEntries([
  ['drive', 'ZUG BUS AUTO TAXI TRAKTOR FAHRRAD ROLLER'],
  ['fly',   'VOGEL ADLER EULE BIENE RAKETE FLUGZEUG BALLON FEE DRACHE PAPAGEI FEDER WOLKE SCHWAN ZAUBERER UFO GEIST'],
  ['swim',  'FISCH HAI DELFIN KRAKE ROBBE ENTE BOOT WAL QUALLE GANS SCHIFF'],
  ['crawl', 'SCHNECKE RAUPE SCHLANGE AMEISE SPINNE KROKODIL WURM'],
  ['spin',  'BALL STERN SONNE KRONE RING TELLER PIZZA KEKS MOND BREZEL WAFFEL DIAMANT ORANGE'],
  ['grow',  'HAUS BAUM ZELT KIRCHE PALME KAKTUS BLUME ROSE TULPE PILZ FENSTER SPIEGEL BETT SOFA TOR NEST TÜR STUHL TISCH LEITER VULKAN'],
  ['hop',   'OMA OPA KUH BÄR HUND WOLF IGEL HAHN HASE MAUS AFFE ESEL LÖWE LAMA DINO KATZE KAMEL PFERD TIGER SCHAF ZEBRA PANDA KOALA KÜKEN ZIEGE ELEFANT PINGUIN KÄNGURU HAMSTER SCHWEIN FROSCH ROBOTER EINHORN TEDDY FUCHS CLOWN'],
].flatMap(([move, words]) => words.split(' ').map(w => [w, move])))
export const moveOf = word => MOVE_OF[word] ?? 'bounce'
