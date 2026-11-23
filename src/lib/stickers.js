/**
 * Stickers for the album — one from the treasure chest at the end of each
 * day's journey (lib/learning.js).
 *
 * Every finished journey gives one, however many stars the games gave: the
 * sticker thanks the child for coming along, not for being fast or right.
 * Rewards tied to taking part instead of to a score don't turn playing into
 * working for a prize (Deci, Koestner & Ryan 1999), and a surprise — which
 * one is in the chest? — is part of the fun. The album pages make the
 * collection something to look at and talk about with the parents.
 */

export const STICKER_PAGES = [
  { id: 'fantasie', title: 'Zauberwelt', items: [
    ['🦄', 'ein Einhorn'], ['🐉', 'ein Drache'], ['🏰', 'ein Schloss'], ['👑', 'eine Krone'], ['🔮', 'eine Zauberkugel'], ['💎', 'ein Edelstein'],
  ] },
  { id: 'urzeit', title: 'Urzeit', items: [
    ['🦖', 'ein T-Rex'], ['🦕', 'ein Langhals-Dino'], ['🌋', 'ein Vulkan'], ['🏝️', 'eine Insel'], ['🌵', 'ein Kaktus'], ['🍄', 'ein Pilz'],
  ] },
  { id: 'meer', title: 'Im Meer', items: [
    ['🐙', 'ein Oktopus'], ['🦀', 'eine Krabbe'], ['🐠', 'ein Fisch'], ['🐬', 'ein Delfin'], ['🐳', 'ein Wal'], ['🐢', 'eine Schildkröte'],
  ] },
  { id: 'wiese', title: 'Wald und Wiese', items: [
    ['🦋', 'ein Schmetterling'], ['🐞', 'ein Marienkäfer'], ['🐝', 'eine Biene'], ['🐌', 'eine Schnecke'], ['🦉', 'eine Eule'], ['🦔', 'ein Igel'],
    ['🐿️', 'ein Eichhörnchen'], ['🦦', 'ein Otter'], ['🌻', 'eine Sonnenblume'], ['🌷', 'eine Tulpe'],
  ] },
  { id: 'safari', title: 'Safari', items: [
    ['🦁', 'ein Löwe'], ['🐯', 'ein Tiger'], ['🐘', 'ein Elefant'], ['🦒', 'eine Giraffe'], ['🦓', 'ein Zebra'], ['🐼', 'ein Panda'],
    ['🐨', 'ein Koala'], ['🦜', 'ein Papagei'], ['🦚', 'ein Pfau'], ['🐧', 'ein Pinguin'],
  ] },
  { id: 'freunde', title: 'Tierfreunde', items: [
    ['🐶', 'ein Hund'], ['🐱', 'eine Katze'], ['🐰', 'ein Hase'], ['🐹', 'ein Hamster'], ['🐻', 'ein Bär'], ['🐸', 'ein Frosch'],
    ['🐴', 'ein Pferd'], ['🐮', 'eine Kuh'], ['🐷', 'ein Schwein'], ['🦢', 'ein Schwan'],
  ] },
  { id: 'fahrt', title: 'Auf Reisen', items: [
    ['🚀', 'eine Rakete'], ['🛸', 'ein Ufo'], ['🚂', 'eine Lok'], ['🚒', 'ein Feuerwehrauto'], ['🚁', 'ein Hubschrauber'], ['⛵', 'ein Segelboot'],
  ] },
  { id: 'fest', title: 'Fest und Spiel', items: [
    ['🎈', 'ein Luftballon'], ['🎁', 'ein Geschenk'], ['🎠', 'ein Karussell'], ['🎡', 'ein Riesenrad'], ['🪁', 'ein Drachen zum Steigen'], ['⚽', 'ein Ball'],
    ['🧸', 'ein Teddy'], ['🏆', 'ein Pokal'], ['🎸', 'eine Gitarre'], ['🥁', 'eine Trommel'], ['🎺', 'eine Trompete'],
  ] },
  { id: 'lecker', title: 'Lecker', items: [
    ['🍓', 'eine Erdbeere'], ['🍉', 'eine Melone'], ['🍦', 'ein Eis'], ['🧁', 'ein Törtchen'], ['🍩', 'ein Donut'], ['🍭', 'ein Lutscher'],
  ] },
  { id: 'himmel', title: 'Am Himmel', items: [
    ['🌈', 'ein Regenbogen'], ['⭐', 'ein Stern'], ['🌙', 'ein Mond'], ['☀️', 'eine Sonne'],
  ] },
]

export const STICKERS = STICKER_PAGES.flatMap(p => p.items.map(([emoji, name]) => ({ emoji, name, page: p.id })))
export const STICKER_BY_EMOJI = Object.fromEntries(STICKERS.map(s => [s.emoji, s]))

/**
 * The sticker in today's chest: one the child doesn't have yet, picked by
 * the day (the same one after a reload). When the album is full, any.
 */
export function stickerForDay(owned, seedText) {
  const have = new Set(owned)
  const left = STICKERS.filter(s => !have.has(s.emoji))
  const pool = left.length ? left : STICKERS
  let h = 0
  for (const c of seedText) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return pool[h % pool.length]?.emoji ?? null
}
