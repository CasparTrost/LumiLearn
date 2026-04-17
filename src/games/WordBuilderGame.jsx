import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

function speakDE(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'de-DE'; u.rate = 0.7; u.pitch = 1.1
  window.speechSynthesis.speak(u)
}
import { voice } from '../voice.js'

/**
 * Silben-Spaß — Wörter aus Silben zusammenbauen
 *
 * Scientific basis:
 *   • Phonological Awareness (Adams 1990; Goswami 2001) — explicit manipulation
 *     of syllable units is the strongest predictor of early reading success.
 *   • Blending / Segmentation research — children who practice assembling
 *     syllables into words score significantly higher on later decoding tasks.
 *   • Worked-example effect — showing silhouette of the object provides a
 *     semantic scaffold that reduces cognitive load while learning.
 */

// ── Word Data ──────────────────────────────────────────────────────────────────
// emoji field is shown as image + hint.
// syllables in CORRECT order; we shuffle them at runtime.

const WORDS_L1 = [
  { word: 'MAMA',   syllables: ['MA','MA'],      emoji: '👩',  hint: 'Mama' },
  { word: 'PAPA',   syllables: ['PA','PA'],      emoji: '👨',  hint: 'Papa' },
  { word: 'HUND',   syllables: ['HU','ND'],      emoji: '🐶',  hint: 'Hund' },
  { word: 'KATZE',  syllables: ['KAT','ZE'],     emoji: '🐱',  hint: 'Katze' },
  { word: 'BAUM',   syllables: ['BA','UM'],      emoji: '🌳',  hint: 'Baum' },
  { word: 'AUTO',   syllables: ['AU','TO'],      emoji: '🚗',  hint: 'Auto' },
  { word: 'MOND',   syllables: ['MO','ND'],      emoji: '🌙',  hint: 'Mond' },
  { word: 'BETT',   syllables: ['BE','TT'],      emoji: '🛏️', hint: 'Bett' },
  { word: 'BALL',   syllables: ['BA','LL'],      emoji: '⚽',  hint: 'Ball' },
  { word: 'BUCH',   syllables: ['BU','CH'],      emoji: '📚',  hint: 'Buch' },
  { word: 'BOOT',   syllables: ['BO','OT'],      emoji: '⛵',  hint: 'Boot' },
  { word: 'MAUS',   syllables: ['MA','US'],      emoji: '🐭',  hint: 'Maus' },
  { word: 'FISCH',  syllables: ['FI','SCH'],     emoji: '🐟',  hint: 'Fisch' },
  { word: 'HAUS',   syllables: ['HA','US'],      emoji: '🏠',  hint: 'Haus' },
  { word: 'ROSE',   syllables: ['RO','SE'],      emoji: '🌹',  hint: 'Rose' },
  { word: 'ZELT',   syllables: ['ZE','LT'],      emoji: '⛺',  hint: 'Zelt' },
  { word: 'PILZ',   syllables: ['PI','LZ'],      emoji: '🍄',  hint: 'Pilz' },
  { word: 'ESEL',   syllables: ['E','SEL'],      emoji: '🫏',  hint: 'Esel' },
  { word: 'AFFE',   syllables: ['AF','FE'],      emoji: '🐒',  hint: 'Affe' },
  { word: 'PFERD',  syllables: ['PFER','D'],     emoji: '🐴',  hint: 'Pferd' },
  { word: 'IGEL',   syllables: ['I','GEL'],      emoji: '🦔',  hint: 'Igel' },
  { word: 'ENTE',   syllables: ['EN','TE'],      emoji: '🦆',  hint: 'Ente' },
  { word: 'WOLF',   syllables: ['WO','LF'],      emoji: '🐺',  hint: 'Wolf' },
  { word: 'NASE',   syllables: ['NA','SE'],      emoji: '👃',  hint: 'Nase' },
  { word: 'HAND',   syllables: ['HA','ND'],      emoji: '✋',  hint: 'Hand' },
  { word: 'WALD',   syllables: ['WA','LD'],      emoji: '🌲',  hint: 'Wald' },
  { word: 'BIENE',  syllables: ['BI','E','NE'],  emoji: '🐝',  hint: 'Biene' },
  { word: 'LAMPE',  syllables: ['LAM','PE'],     emoji: '💡',  hint: 'Lampe' },
  { word: 'SCHAF',  syllables: ['SCHA','F'],     emoji: '🐑',  hint: 'Schaf' },
  { word: 'TIGER',  syllables: ['TI','GER'],     emoji: '🐯',  hint: 'Tiger' },
  { word: 'LÖWE',   syllables: ['LÖ','WE'],      emoji: '🦁',  hint: 'Löwe' },
  { word: 'KEKS',   syllables: ['KE','KS'],      emoji: '🍪',  hint: 'Keks' },
  { word: 'STERN',  syllables: ['STER','N'],     emoji: '⭐',  hint: 'Stern' },
  { word: 'VOGEL',  syllables: ['VO','GEL'],     emoji: '🐦',  hint: 'Vogel' },
  { word: 'ZAHN',   syllables: ['ZA','HN'],      emoji: '🦷',  hint: 'Zahn' },
  { word: 'REGEN',  syllables: ['RE','GEN'],     emoji: '🌧️', hint: 'Regen' },
  { word: 'KAKAO',  syllables: ['KA','KA','O'],  emoji: '🍫',  hint: 'Kakao' },
  { word: 'SALZ',   syllables: ['SA','LZ'],      emoji: '🧂',  hint: 'Salz' },
  { word: 'TISCH',  syllables: ['TI','SCH'],     emoji: '🪑',  hint: 'Tisch' },
  { word: 'HERZ',   syllables: ['HER','Z'],      emoji: '❤️',  hint: 'Herz' },
]

const WORDS_L2 = [
  { word: 'BANANE',   syllables: ['BA','NA','NE'],      emoji: '🍌', hint: 'Banane' },
  { word: 'ELEFANT',  syllables: ['E','LE','FANT'],     emoji: '🐘', hint: 'Elefant' },
  { word: 'TOMATE',   syllables: ['TO','MA','TE'],      emoji: '🍅', hint: 'Tomate' },
  { word: 'RAUPE',    syllables: ['RAU','PE'],          emoji: '🐛', hint: 'Raupe' },
  { word: 'PINSEL',   syllables: ['PIN','SEL'],         emoji: '🖌️',hint: 'Pinsel' },
  { word: 'DRACHEN',  syllables: ['DRA','CHEN'],        emoji: '🐉', hint: 'Drachen' },
  { word: 'KÜCHE',    syllables: ['KÜ','CHE'],          emoji: '🍳', hint: 'Küche' },
  { word: 'WOLKE',    syllables: ['WOL','KE'],          emoji: '⛅', hint: 'Wolke' },
  { word: 'APFEL',    syllables: ['AP','FEL'],          emoji: '🍎', hint: 'Apfel' },
  { word: 'SCHIFF',   syllables: ['SCHIFF'],            emoji: '🚢', hint: 'Schiff' },
  { word: 'KATZE',    syllables: ['KAT','ZE'],          emoji: '🐱', hint: 'Katze' },
  { word: 'TRAUBE',   syllables: ['TRAU','BE'],         emoji: '🍇', hint: 'Traube' },
  { word: 'KUGEL',    syllables: ['KU','GEL'],          emoji: '🔮', hint: 'Kugel' },
  { word: 'SPIEGEL',  syllables: ['SPIE','GEL'],        emoji: '🪞', hint: 'Spiegel' },
  { word: 'TASCHE',   syllables: ['TA','SCHE'],         emoji: '👜', hint: 'Tasche' },
  { word: 'KERZE',    syllables: ['KER','ZE'],          emoji: '🕯️',hint: 'Kerze' },
  { word: 'SCHERE',   syllables: ['SCHE','RE'],         emoji: '✂️', hint: 'Schere' },
  { word: 'BUTTER',   syllables: ['BUT','TER'],         emoji: '🧈', hint: 'Butter' },
  { word: 'NUDELN',   syllables: ['NU','DELN'],         emoji: '🍝', hint: 'Nudeln' },
  { word: 'SUPPE',    syllables: ['SUP','PE'],          emoji: '🍲', hint: 'Suppe' },
  { word: 'BRUDER',   syllables: ['BRU','DER'],         emoji: '👦', hint: 'Bruder' },
  { word: 'SCHWEIN',  syllables: ['SCHWEIN'],           emoji: '🐷', hint: 'Schwein' },
  { word: 'KIRCHE',   syllables: ['KIR','CHE'],         emoji: '⛪', hint: 'Kirche' },
  { word: 'DACKEL',   syllables: ['DA','CKEL'],         emoji: '🐕', hint: 'Dackel' },
  { word: 'HAMSTER',  syllables: ['HAM','STER'],        emoji: '🐹', hint: 'Hamster' },
  { word: 'ZIEGE',    syllables: ['ZIE','GE'],          emoji: '🐐', hint: 'Ziege' },
  { word: 'KAMEL',    syllables: ['KA','MEL'],          emoji: '🐪', hint: 'Kamel' },
  { word: 'TELLER',   syllables: ['TEL','LER'],         emoji: '🍽️',hint: 'Teller' },
  { word: 'BLUME',    syllables: ['BLU','ME'],          emoji: '🌸', hint: 'Blume' },
  { word: 'FALKE',    syllables: ['FAL','KE'],          emoji: '🦅', hint: 'Falke' },
  { word: 'MÜTZE',    syllables: ['MÜT','ZE'],          emoji: '🧢', hint: 'Mütze' },
  { word: 'STIEFEL',  syllables: ['STIE','FEL'],        emoji: '🥾', hint: 'Stiefel' },
  { word: 'WASSER',   syllables: ['WAS','SER'],         emoji: '💧', hint: 'Wasser' },
  { word: 'ABEND',    syllables: ['A','BEND'],          emoji: '🌆', hint: 'Abend' },
  { word: 'FREUND',   syllables: ['FREUND'],            emoji: '🤝', hint: 'Freund' },
  { word: 'KOFFER',   syllables: ['KOF','FER'],         emoji: '🧳', hint: 'Koffer' },
  { word: 'TASSE',    syllables: ['TAS','SE'],          emoji: '☕', hint: 'Tasse' },
  { word: 'BIRNE',    syllables: ['BIR','NE'],          emoji: '🍐', hint: 'Birne' },
  { word: 'KISSEN',   syllables: ['KIS','SEN'],         emoji: '🛏️',hint: 'Kissen' },
  { word: 'GARTEN',   syllables: ['GAR','TEN'],         emoji: '🌻', hint: 'Garten' },
  { word: 'KUCHEN',   syllables: ['KU','CHEN'],         emoji: '🎂', hint: 'Kuchen' },
]

const WORDS_L3 = [
  { word: 'SCHMETTERLING', syllables: ['SCHMET','TER','LING'],      emoji: '🦋', hint: 'Schmetterling' },
  { word: 'SCHOKOLADE',    syllables: ['SCHO','KO','LA','DE'],       emoji: '🍫', hint: 'Schokolade' },
  { word: 'FAHRRAD',       syllables: ['FAHR','RAD'],               emoji: '🚲', hint: 'Fahrrad' },
  { word: 'ERDBEERE',      syllables: ['ERD','BEE','RE'],            emoji: '🍓', hint: 'Erdbeere' },
  { word: 'FENSTER',       syllables: ['FENS','TER'],               emoji: '🪟', hint: 'Fenster' },
  { word: 'GIRAFFE',       syllables: ['GI','RAF','FE'],             emoji: '🦒', hint: 'Giraffe' },
  { word: 'ANANAS',        syllables: ['A','NA','NAS'],              emoji: '🍍', hint: 'Ananas' },
  { word: 'REGENBOGEN',    syllables: ['RE','GEN','BO','GEN'],       emoji: '🌈', hint: 'Regenbogen' },
  { word: 'GURKE',         syllables: ['GUR','KE'],                 emoji: '🥒', hint: 'Gurke' },
  { word: 'RAKETE',        syllables: ['RA','KE','TE'],              emoji: '🚀', hint: 'Rakete' },
  { word: 'PINGUIN',       syllables: ['PIN','GUIN'],               emoji: '🐧', hint: 'Pinguin' },
  { word: 'POLIZEI',       syllables: ['PO','LI','ZEI'],             emoji: '👮', hint: 'Polizei' },
  { word: 'ROBOTER',       syllables: ['RO','BO','TER'],             emoji: '🤖', hint: 'Roboter' },
  { word: 'PAPRIKA',       syllables: ['PAP','RI','KA'],             emoji: '🫑', hint: 'Paprika' },
  { word: 'KAROTTE',       syllables: ['KA','ROT','TE'],             emoji: '🥕', hint: 'Karotte' },
  { word: 'LATERNE',       syllables: ['LA','TER','NE'],             emoji: '🏮', hint: 'Laterne' },
  { word: 'SCHAUKEL',      syllables: ['SCHAU','KEL'],              emoji: '🎠', hint: 'Schaukel' },
  { word: 'TRAKTOR',       syllables: ['TRAK','TOR'],               emoji: '🚜', hint: 'Traktor' },
  { word: 'SCHILDKRÖTE',   syllables: ['SCHILD','KRÖ','TE'],        emoji: '🐢', hint: 'Schildkröte' },
  { word: 'EICHHÖRNCHEN',  syllables: ['EICH','HÖRN','CHEN'],       emoji: '🐿️',hint: 'Eichhörnchen' },
  { word: 'KÜRBIS',        syllables: ['KÜR','BIS'],                emoji: '🎃', hint: 'Kürbis' },
  { word: 'KROKODIL',      syllables: ['KRO','KO','DIL'],           emoji: '🐊', hint: 'Krokodil' },
  { word: 'BLAUBEERE',     syllables: ['BLAU','BEE','RE'],           emoji: '🫐', hint: 'Blaubeere' },
  { word: 'SPINNE',        syllables: ['SPIN','NE'],                emoji: '🕷️',hint: 'Spinne' },
  { word: 'TROMPETE',      syllables: ['TROM','PE','TE'],            emoji: '🎺', hint: 'Trompete' },
  { word: 'GITARRE',       syllables: ['GI','TAR','RE'],             emoji: '🎸', hint: 'Gitarre' },
  { word: 'KLAVIER',       syllables: ['KLA','VIER'],               emoji: '🎹', hint: 'Klavier' },
  { word: 'DELFIN',        syllables: ['DEL','FIN'],                emoji: '🐬', hint: 'Delfin' },
  { word: 'PIRATEN',       syllables: ['PI','RA','TEN'],             emoji: '🏴‍☠️',hint: 'Piraten' },
  { word: 'BALKON',        syllables: ['BAL','KON'],                emoji: '🏠', hint: 'Balkon' },
]

const WORDS_L4 = [
  { word: 'UNTERWASSER',   syllables: ['UN','TER','WAS','SER'],     emoji: '🐟', hint: 'Unterwasser' },
  { word: 'NACHMITTAG',    syllables: ['NACH','MIT','TAG'],          emoji: '☀️', hint: 'Nachmittag' },
  { word: 'ABENTEUER',     syllables: ['A','BEN','TEU','ER'],        emoji: '🧭', hint: 'Abenteuer' },
  { word: 'GEBURTSTAG',    syllables: ['GE','BURTS','TAG'],          emoji: '🎂', hint: 'Geburtstag' },
  { word: 'SONNENSCHEIN',  syllables: ['SON','NEN','SCHEIN'],        emoji: '🌞', hint: 'Sonnenschein' },
  { word: 'TASCHENLAMPE',  syllables: ['TA','SCHEN','LAM','PE'],     emoji: '🔦', hint: 'Taschenlampe' },
  { word: 'ZAHNBÜRSTE',    syllables: ['ZAHN','BÜRS','TE'],          emoji: '🪥', hint: 'Zahnbürste' },
  { word: 'SUPERMARKT',    syllables: ['SU','PER','MARKT'],          emoji: '🛒', hint: 'Supermarkt' },
  { word: 'SPIELPLATZ',    syllables: ['SPIEL','PLATZ'],             emoji: '🛝', hint: 'Spielplatz' },
  { word: 'FEUERWEHR',     syllables: ['FEU','ER','WEHR'],           emoji: '🚒', hint: 'Feuerwehr' },
  { word: 'TRAMPOLIN',     syllables: ['TRAM','PO','LIN'],           emoji: '🤸', hint: 'Trampolin' },
  { word: 'FLUGZEUG',      syllables: ['FLUG','ZEUG'],              emoji: '✈️', hint: 'Flugzeug' },
  { word: 'OSTERHASE',     syllables: ['OS','TER','HA','SE'],        emoji: '🐰', hint: 'Osterhase' },
  { word: 'SANDKASTEN',    syllables: ['SAND','KAS','TEN'],          emoji: '🏖️',hint: 'Sandkasten' },
  { word: 'SCHLAFSACK',    syllables: ['SCHLAF','SACK'],             emoji: '💤', hint: 'Schlafsack' },
  { word: 'WACKELZAHN',    syllables: ['WA','CKEL','ZAHN'],          emoji: '🦷', hint: 'Wackelzahn' },
  { word: 'TISCHTENNIS',   syllables: ['TISCH','TEN','NIS'],         emoji: '🏓', hint: 'Tischtennis' },
  { word: 'BLUMENSTRAUSS',  syllables: ['BLU','MEN','STRAUSS'],        emoji: '💐', hint: 'Blumenstrauß' },
  { word: 'WASSERHAHN',    syllables: ['WAS','SER','HAHN'],          emoji: '🚿', hint: 'Wasserhahn' },
  { word: 'SCHLAFANZUG',   syllables: ['SCHLAF','AN','ZUG'],         emoji: '😴', hint: 'Schlafanzug' },
  { word: 'STAUBSAUGER',   syllables: ['STAUB','SAU','GER'],         emoji: '🌀', hint: 'Staubsauger' },
  { word: 'BÜCHERREGAL',   syllables: ['BÜ','CHER','RE','GAL'],      emoji: '📚', hint: 'Bücherregal' },
  { word: 'BRIEFKASTEN',   syllables: ['BRIEF','KAS','TEN'],         emoji: '📬', hint: 'Briefkasten' },
  { word: 'KÜHLSCHRANK',   syllables: ['KÜHL','SCHRANK'],            emoji: '🧊', hint: 'Kühlschrank' },
  { word: 'SEIFENBLASE',   syllables: ['SEI','FEN','BLA','SE'],      emoji: '🫧', hint: 'Seifenblase' },
]

const WORDS_L5 = [
  { word: 'WINTERLANDSCHAFT',   syllables: ['WIN','TER','LAND','SCHAFT'],       emoji: '❄️', hint: 'Winterlandschaft' },
  { word: 'KINDERGARTEN',       syllables: ['KIN','DER','GAR','TEN'],           emoji: '🏫', hint: 'Kindergarten' },
  { word: 'WEIHNACHTSMANN',     syllables: ['WEIH','NACHTS','MANN'],            emoji: '🎅', hint: 'Weihnachtsmann' },
  { word: 'JAHRESZEITEN',       syllables: ['JAH','RES','ZEI','TEN'],           emoji: '🍂', hint: 'Jahreszeiten' },
  { word: 'SCHWIMMBECKEN',      syllables: ['SCHWIMM','BE','CKEN'],             emoji: '🏊', hint: 'Schwimmbecken' },
  { word: 'GEBURTSTAGSPARTY',   syllables: ['GE','BURTS','TAGS','PAR','TY'],    emoji: '🎉', hint: 'Geburtstagsparty' },
  { word: 'SEEPFERDCHEN',       syllables: ['SEE','PFERD','CHEN'],              emoji: '🦄', hint: 'Seepferdchen' },
  { word: 'NIKOLAUSSTIEFEL',    syllables: ['NI','KO','LAUS','STIE','FEL'],     emoji: '🎁', hint: 'Nikolausstiefel' },
  { word: 'FUSSBALLSPIELER',     syllables: ['FUß','BALL','SPIE','LER'],         emoji: '⚽', hint: 'Fußballspieler' },
  { word: 'MEERESSCHILDKRÖTE',  syllables: ['MEE','RES','SCHILD','KRÖ','TE'],   emoji: '🐢', hint: 'Meeresschildkröte' },
  { word: 'RAUMSCHIFF',         syllables: ['RAUM','SCHIFF'],                  emoji: '🛸', hint: 'Raumschiff' },
  { word: 'UNTERWASSERWELT',    syllables: ['UN','TER','WAS','SER','WELT'],     emoji: '🌊', hint: 'Unterwasserwelt' },
  { word: 'STRASSENLATERNE',     syllables: ['STRA','ßEN','LA','TER','NE'],      emoji: '🌃', hint: 'Straßenlaterne' },
  { word: 'BLUMENWIESE',        syllables: ['BLU','MEN','WIE','SE'],            emoji: '🌷', hint: 'Blumenwiese' },
  { word: 'SCHAUKELPFERD',      syllables: ['SCHAU','KEL','PFERD'],             emoji: '🎠', hint: 'Schaukelpferd' },
  { word: 'FAHRRADHELM',        syllables: ['FAHR','RAD','HELM'],               emoji: '🚲', hint: 'Fahrradhelm' },
  { word: 'ZIRKUSDIREKTOR',     syllables: ['ZIR','KUS','DI','REK','TOR'],      emoji: '🎪', hint: 'Zirkusdirektor' },
  { word: 'SPIELZEUGAUTO',      syllables: ['SPIEL','ZEUG','AU','TO'],          emoji: '🚗', hint: 'Spielzeugauto' },
]

function getWordPool(level) {
  if (level <= 2) return WORDS_L1
  if (level <= 4) return WORDS_L2
  if (level <= 6) return WORDS_L3
  if (level <= 8) return WORDS_L4
  return WORDS_L5
}

function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5) }

function buildRound(words, idx) {
  const w = words[idx % words.length]
  return {
    ...w,
    tiles: shuffle(w.syllables.map((s, i) => ({ id: i, text: s }))),
  }
}

// ── Tile ────────────────────────────────────────────────────────────────────
function SyllableTile({ text, used, index, onClick }) {
  return (
    <motion.button
      layout
      key={text + index}
      initial={{ scale: 0, opacity: 0 }}
      animate={used ? { scale: 0.7, opacity: 0.3, y: 0 } : { scale: 1, opacity: 1, y: 0 }}
      whileHover={!used ? { scale: 1.12, y: -5 } : {}}
      whileTap={!used ? { scale: 0.88 } : {}}
      onClick={onClick}
      style={{
        minWidth: 64, padding: '18px 24px',
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(22px,5vw,32px)', fontWeight: 900,
        letterSpacing: 2,
        background: used ? '#F0EEFF' : 'linear-gradient(135deg,#6C63FF,#4A00E0)',
        color: used ? '#C0B8E8' : 'white',
        border: 'none', borderRadius: 18,
        boxShadow: used ? 'none' : '0 6px 22px rgba(74,0,224,0.38)',
        cursor: used ? 'default' : 'pointer',
        transition: 'background 0.25s, color 0.25s',
        pointerEvents: used ? 'none' : 'auto',
      }}
    >{text}</motion.button>
  )
}

// ── Word slots ─────────────────────────────────────────────────────────────
function WordSlot({ text, shake, isDone, isFirst, isLast, only }) {
  // When merged: remove inner padding so letters sit flush against each other
  const pt = '18px'
  const pb = '18px'
  const pl = isDone && !isFirst && !only ? '0'  : '24px'
  const pr = isDone && !isLast  && !only ? '0'  : '24px'

  const br = isDone
    ? only    ? '18px'
    : isFirst ? '18px 0 0 18px'
    : isLast  ? '0 18px 18px 0'
    : '0'
    : '18px'

  return (
    <motion.div
      animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : { x: 0 }}
      transition={{ duration: 0.4 }}
      style={{
        padding: `${pt} ${pr} ${pb} ${pl}`,
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(22px,5vw,32px)', fontWeight: 900,
        letterSpacing: isDone ? 0 : 2,
        background: isDone
          ? '#52C87A'
          : text ? 'linear-gradient(135deg,#FFD93D,#F7A428)' : 'white',
        color: text || isDone ? 'white' : '#C0B8E8',
        border: isDone ? 'none' : `3.5px dashed ${text ? 'transparent' : '#A29BFE'}`,
        borderRadius: br,
        outline: 'none',
        // box-shadow only on the leftmost tile when merged, to avoid doubled shadows
        boxShadow: isDone
          ? (isFirst || only ? '0 8px 32px rgba(82,200,122,0.45)' : 'none')
          : text ? '0 5px 18px rgba(0,0,0,0.15)' : '0 2px 8px rgba(162,155,254,0.14)',
        transition: 'background 0.35s, border-radius 0.35s, box-shadow 0.35s, border 0.35s, padding 0.35s, letter-spacing 0.35s',
        minHeight: 60, minWidth: isDone ? 0 : 64,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        whiteSpace: 'nowrap',
      }}
    >
      {text || '?'}
    </motion.div>
  )
}

// ── Main Game ──────────────────────────────────────────────────────────────
export default function WordBuilderGame({ level = 1, onComplete }) {
  const TOTAL = 8
  const wordPool = useState(() => shuffle(getWordPool(level)))[0]

  const [idx,      setIdx]      = useState(0)
  const [round,    setRound]    = useState(() => buildRound(wordPool, 0))
  const [placed,   setPlaced]   = useState([])   // syllable ids placed so far
  const [usedIds,  setUsedIds]  = useState(new Set())
  const [shake,    setShake]    = useState(false)
  const [feedback, setFeedback] = useState(null)  // null | 'ok' | 'wrong'
  const [score,    setScore]    = useState(0)
  const [mood,     setMood]     = useState('happy')
  const [showHint, setShowHint] = useState(true)
  const [showWeiter, setShowWeiter] = useState(false)
  const feedbackTimeout         = useRef(null)

  // Reset on new round
  useEffect(() => {
    setRound(buildRound(wordPool, idx))
    setPlaced([])
    setUsedIds(new Set())
    setFeedback(null)
    setShake(false)
    setShowHint(true)
  }, [idx])  // wordPool is stable

  const clickTile = useCallback((tile) => {
    if (feedback) return
    setShowHint(false)
    setUsedIds(s => new Set([...s, tile.id]))
    const newPlaced = [...placed, tile]

    // Check if complete
    if (newPlaced.length === round.syllables.length) {
      const built = newPlaced.map(t => t.text).join('')
      const correct = round.word
      clearTimeout(feedbackTimeout.current)

      if (built === correct) {
        setFeedback('ok')
        setMood('excited')
        setPlaced(newPlaced)
        sfx.correct()
        setTimeout(() => speakDE(current.word.toLowerCase()), 300)
        feedbackTimeout.current = setTimeout(() => setShowWeiter(true), 800)
      } else {
        setFeedback('wrong')
        setMood('encouraging')
        sfx.wrong()
        setShake(true)
        feedbackTimeout.current = setTimeout(() => {
          setPlaced([])
          setUsedIds(new Set())
          setFeedback(null)
          setShake(false)
          setMood('happy')
        }, 900)
      }
    } else {
      setPlaced(newPlaced)
    }
  }, [feedback, placed, round, score, idx, TOTAL, onComplete])

  // Remove last tile
  const clickSlot = useCallback((slotIdx) => {
    if (feedback) return
    const tile = placed[slotIdx]
    if (!tile) return
    const newPlaced = placed.slice(0, slotIdx)
    setPlaced(newPlaced)
    setUsedIds(s => { const ns = new Set(s); ns.delete(tile.id); return ns })
  }, [feedback, placed])

  const isDone = feedback === 'ok'

  const weiterClick = () => {
    setShowWeiter(false)
    const ns = score + 1
    setScore(ns)
    setFeedback(null)
    setPlaced([])
    setUsedIds(new Set())
    setShake(false)
    setMood('happy')
    if (idx + 1 >= TOTAL) {
      sfx.complete()
      setTimeout(() => onComplete({ score: ns, total: TOTAL }), 300)
    } else {
      setIdx(i => i + 1)
    }
  }

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)',
      gap: 'clamp(12px,2vw,20px)',
      userSelect: 'none',
    }}>

      {/* Flash overlay */}
      <AnimatePresence>
        {feedback && (
          <motion.div key={feedback + idx}
            initial={{ opacity: 0.3 }} animate={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 150, pointerEvents: 'none',
              background: feedback === 'ok' ? '#6BCB77' : '#FF6B6B',
            }}
          />
        )}
      </AnimatePresence>

      {/* Progress bar */}
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {Array.from({ length: TOTAL }, (_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < idx ? '#6C63FF' : i === idx ? '#FFD93D' : '#ECE8FF',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Score */}
      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 15, color: 'var(--text-muted)' }}>
        {'✅ ' + score + ' / ' + TOTAL}
      </div>

      {/* Lumi speech bubble */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={72} />
        <AnimatePresence mode="wait">
          <motion.div key={idx}
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            style={{
              flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px',
              padding: '13px 18px',
              boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px,3vw,20px)',
              color: 'var(--text-primary)',
            }}
          >
            {isDone
              ? <><strong style={{ color: '#6BCB77' }}>{'Bravo! 🎉'}</strong>{' ' + round.word + ' — richtig!'}</>
              : <>Setze die Silben zusammen: Was zeigt das Bild? 👇</>
            }
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Emoji "image" */}
      <AnimatePresence mode="wait">
        <motion.div key={round.emoji + idx}
          initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          style={{
            fontSize: 'clamp(80px,18vw,120px)', lineHeight: 1,
            filter: showHint ? 'none' : 'blur(0px)',
            textShadow: '0 8px 28px rgba(0,0,0,0.15)',
          }}
        >
          {round.emoji}
        </motion.div>
      </AnimatePresence>

      {/* Word slots — slide together and merge when correct */}
      <div style={{
        display: 'flex', flexWrap: 'nowrap',
        gap: isDone ? 0 : 10,
        justifyContent: 'center', alignItems: 'center',
        minHeight: 72,
        transition: 'gap 0.35s ease',
      }}>
        {round.syllables.map((_, i) => (
          <div key={i}
            onClick={() => !isDone && clickSlot(i)}
            style={{ cursor: !isDone && placed[i] ? 'pointer' : 'default' }}
          >
            <WordSlot
              text={placed[i]?.text || ''}
              shake={shake && !!placed[i]}
              isDone={isDone}
              isFirst={i === 0}
              isLast={i === round.syllables.length - 1}
              only={round.syllables.length === 1}
            />
          </div>
        ))}
      </div>

      {/* Syllable tiles */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 'clamp(8px,2vw,14px)',
        justifyContent: 'center', alignItems: 'center',
        width: '100%', maxWidth: 680,
        background: 'rgba(162,155,254,0.1)', borderRadius: 22, padding: 'clamp(12px,2vw,20px)',
      }}>
        {round.tiles.map(tile => (
          <SyllableTile
            key={tile.id}
            text={tile.text}
            used={usedIds.has(tile.id)}
            index={tile.id}
            onClick={() => clickTile(tile)}
          />
        ))}
      </div>

      {/* Weiter button */}
      {showWeiter && (
        <motion.button
          initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
          onClick={weiterClick}
          style={{
            padding:'13px 44px', borderRadius:50,
            background:'linear-gradient(135deg,#6BCB77,#44D498)',
            color:'white', fontFamily:'var(--font-heading)', fontSize:20, fontWeight:700,
            border:'none', cursor:'pointer', boxShadow:'0 4px 18px rgba(107,203,119,0.5)',
          }}
        >
          {idx + 1 >= TOTAL ? '🏁 Fertig!' : 'Weiter! →'}
        </motion.button>
      )}

      {/* Tip */}
      <div style={{
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(12px,2vw,14px)',
        color: 'var(--text-muted)', textAlign: 'center',
        opacity: 0.7,
      }}>
        Tipp: Tippe auf eine Silbe im Wort, um sie wieder zu entfernen.
      </div>
    </div>
  )
}
