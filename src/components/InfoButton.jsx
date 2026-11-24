import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { narrate, stopNarration } from '../narrator.js'
import { MODULE_BY_ID } from '../modules.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { helpLine } from '../lib/lumiLines.js'

// Help per game. Read aloud when the dialog opens (most children who play
// can't read yet), so the texts are written to be heard: short sentences,
// no "lies", no keyboard talk, nothing that depends on seeing the words.
// fresh: rewritten for the rebuilt game (docs/spielideen.md), not recorded yet.
const INFO = {
  'number-intro':  { emoji: '🔢', title: 'Zahlen entdecken', text: 'Ein Tier hat Hunger und zeigt dir auf einem Schild eine Zahl. Leg genau so viele Sachen auf seinen Teller und tippe dann auf den grünen Haken.', fresh: true },
  'letter-intro':  { emoji: '🔡', title: 'ABC-Abenteuer', text: 'Das Buchstaben-Monster hat Hunger, aber es frisst nur Sachen, die mit seinem Laut anfangen. Zieh das richtige Bild zum Monster oder tippe es an.', fresh: true },
  'initial-sound': { emoji: '🕵️', title: 'Anlaut-Detektiv', text: 'Lumi angelt lustige Sachen aus dem Teich. Hör, wie das Wort anfängt, und bring den Fang in den Eimer mit dem richtigen Buchstaben.', fresh: true },
  rhyme:           { emoji: '🎵', title: 'Reim-Rallye', text: 'Im Reim-Theater sucht jede Figur einen Reimpartner. Zieh den passenden Ballon auf die Bühne, dann spielen die beiden eine lustige Szene.', fresh: true },
  numbers:         { emoji: '🛒', title: 'Zahlenland', text: 'Tierkunden kaufen an Lumis Obststand ein. Leg genau so viel Obst in den Korb, wie sich der Kunde wünscht, und tippe dann auf den grünen Haken.', fresh: true },
  letters:         { emoji: '⌨️', title: 'Buchstabenwald', text: 'Lumi will etwas zaubern: Tipp die Buchstaben des Wortes, dann fliegen sie in den Kessel. Ist das Wort fertig, macht es Puff, und das Ding springt heraus.', fresh: true },
  listen:          { emoji: '👂', title: 'Hörabenteuer', text: 'Hinter den Büschen hat sich etwas versteckt. Hör genau hin, welches Wort Lumi ruft, und tippe auf den richtigen Busch.', fresh: true },
  words:           { emoji: '🃏', title: 'Memo-Welt', text: 'Merk dir, wo die Bilder liegen, und mach zwei Geschenke auf. Was zusammengehört, umarmt sich und darf zur Party.', fresh: true },
  patterns:        { emoji: '🔮', title: 'Musterpark', text: 'In der Tierparade ist ein Platz frei. Zieh das passende Bild in die Lücke, dann marschiert die Parade weiter.', fresh: true },
  shapes:          { emoji: '🎨', title: 'Farbenreich', text: 'Ein Tier wünscht sich ein Bild in bestimmten Farben. Zieh den Farbtopf mit der Farbe aus der Sprechblase auf das Bild, dann zieht das Tier ein.', fresh: true },
  emotions:        { emoji: '😊', title: 'Gefühlswelt', text: 'Schau, was Lumi passiert, und gib Lumi das passende Gesicht. Dann zeig, wie stark das Gefühl ist, und gib Lumi etwas, das hilft.', fresh: true },
  empathy:         { emoji: '🕵️‍♀️', title: 'Gefühlsdetektiv', text: 'Schau genau hin, wie es deinem Freund geht, und zieh das passende Gesicht zu ihm. Dann bring ihm, was hilft, damit er wieder froh wird.', fresh: true },
  maze:            { emoji: '🌀', title: 'Lumi-Labyrinth', text: 'Hilf Lumi durch das Labyrinth! Sammle alle Zaubertränke und lauf dann zum leuchtenden Ausgang. Wische oder benutze die Pfeile. Pass auf den Drachen auf! Wenn du stehen bleibst, kann der Drache dir nichts tun. Findest du einen ganz kurzen Weg, bekommt Lumi eine Krone!' },
  shadows:         { emoji: '🌑', title: 'Schattenrätsel', text: 'Wisch mit dem Finger über das dunkle Zimmer, dann leuchtet die Taschenlampe. Zieh das Bild, das zum Schatten passt, ins Zimmer, dann geht das Licht an.', fresh: true },
  bubbles:         { emoji: '🫧', title: 'Blasen-Blitz', text: 'Der Krake wünscht sich Blasen mit einer bestimmten Zahl. Tippe alle passenden Blasen an, dann jongliert der Krake mit den Sternen.', fresh: true },
  stories:         { emoji: '📖', title: 'Lumis Abenteuer', text: 'Schau dir die Geschichte an und gib jedem das Gesicht, das zu seinem Gefühl passt. An der Weggabelung bringst du Lumi zu dem Weg, den Lumi gehen soll.', fresh: true },
  sort:            { emoji: '🧺', title: 'Sortier-Spaß', text: 'Auf dem Förderband kommen Sachen angefahren. Zieh jede Sache zu dem Korbmonster, das sie sammelt; sein Schild zeigt, was es haben will.', fresh: true },
  clock:           { emoji: '🕐', title: 'Uhren-Uhr', text: 'Der Kuckuck will zu einer bestimmten Zeit heraus: Dreh die Zeiger mit dem Finger oder mit Plus und Minus und drück dann auf Fertig. Manchmal raten Tiere die Uhrzeit, dann tippst du, wer recht hat, oder du gibst Lumi das Bild, was um diese Zeit passiert.', fresh: true },
  words2:          { emoji: '🔤', title: 'Silben-Spaß', text: 'Sag das Wort und klatsch dazu: Jedes Klatschen legt ein Seerosenblatt ins Wasser, dann hüpft der Frosch hinüber. Manchmal legst du die Silben-Blätter der Reihe nach.', fresh: true },
  weight:          { emoji: '⚖️', title: 'Waage-Welt', text: 'Zwei Dinge wollen wippen. Tipp an, wer nach unten geht, und schau, ob die Wippe es auch so macht.', fresh: true },
  'rocket-math':   { emoji: '🚀', title: 'Rechen-Rakete', text: 'Ein Alien wartet auf einem Planeten und sagt dir eine Rechnung. Tippe auf den Planeten, wo die Rakete landet, dann hüpft sie hin und zählt mit.', fresh: true },
  'shapes-land':   { emoji: '🔷', title: 'Formen-Land', text: 'Die Eule sucht Formen im Bild: Tippe alle an, die sie sucht. Manchmal stellst du Formen der Größe nach zum Foto auf, setzt eine Parade fort oder legst die passende Form auf ein Ding.', fresh: true },
  'shape-build':   { emoji: '🧩', title: 'Formen-Werkstatt', text: 'Ein Tier wünscht sich etwas: Zieh die Formen in das Bild, bis es fertig ist, dann wird es lebendig. Mit dem Pfeil drehst du eine Form, und manchmal ist ein Teil zu viel.', fresh: true },
  trace:           { emoji: '📝', title: 'Buchstaben-Spuren', text: 'Fahre den Buchstaben mit dem Finger nach, vom grünen Punkt in Pfeilrichtung. Dann wird er lebendig.', fresh: true },
  coloring:        { emoji: '🖍️', title: 'Mal-Atelier', text: 'Hier darfst du frei malen. Wähle eine Farbe und male mit dem Pinsel, oder fülle eine ganze Fläche mit dem Farbeimer. Mit dem Pfeil machst du den letzten Schritt rückgängig.' },
}

export default function InfoButton({ moduleId, onOpenChange }) {
  const [open, setOpenState] = useState(false)
  // Opening reads the help aloud and pauses the game (GameScreen passes
  // onOpenChange to its PauseContext); closing stops the reading.
  const setOpen = v => {
    setOpenState(v)
    onOpenChange?.(v)
    // A game that was rebuilt has a new help text; Lumi's recording of the
    // old one would describe the old game (fresh: browser voice until the
    // new text is recorded)
    if (v) narrate([(!help.fresh && helpLine(moduleId)) || { text: `${info.title}. ${info.text}` }])
    else stopNarration()
  }
  const help = INFO[moduleId] ?? { emoji: '❓', title: 'Wie geht das?', text: 'Schau dir die Aufgabe an und tippe auf die richtige Antwort!' }
  // the name as on the tiles (modules.js), one spelling everywhere
  const info = { ...help, title: MODULE_BY_ID[moduleId]?.title ?? help.title }

  // Escape closes the help, like a tap outside it; the focus stays inside
  // while it is open and goes back to the ? button afterwards
  const trapRef = useFocusTrap(open, { onEscape: () => setOpen(false) })

  return (
    <>
      <button
        className="px-btn px-btn--parch px-btn--icon"
        onClick={() => setOpen(true)}
        aria-label="Spielanleitung anzeigen"
        style={{ flexShrink: 0, fontSize: 24, lineHeight: 1 }}
      >
        ?
      </button>

      {/* In a portal on <body>: inside the screen's animated container a
          fixed overlay is positioned against that container, not the window */}
      {createPortal(<AnimatePresence>
        {open && (
          <motion.div
            key="info-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 900,
              background: 'rgba(42, 27, 61, 0.60)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <motion.div
              ref={trapRef}
              initial={{ scale: 0.72, opacity: 0, y: 32 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.82, opacity: 0, y: 18 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              onClick={e => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-label={info.title}
              className="px-panel"
              style={{
                padding: '36px 28px 28px',
                maxWidth: 420, width: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Emoji */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.08 }}
                style={{
                  fontSize: 72, lineHeight: 1, zIndex: 1,
                  // a hard pixel shadow, like Lumi's (no soft glow)
                  filter: 'drop-shadow(0 4px 0 rgba(42,27,61,0.35))',
                }}
              >
                {info.emoji}
              </motion.div>

              {/* Title */}
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(22px,5vw,28px)',
                fontWeight: 800,
                color: 'var(--px-ink)',
                zIndex: 1,
              }}>
                {info.title}
              </div>

              {/* Text */}
              <div style={{
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: 'clamp(16px,3.5vw,19px)',
                lineHeight: 1.65,
                color: 'var(--text-secondary)',
                maxWidth: 340,
                zIndex: 1,
              }}>
                {info.text}
              </div>

              {/* Close button */}
              <button
                className="px-btn px-btn--green px-btn--md"
                onClick={() => setOpen(false)}
                style={{ marginTop: 6, zIndex: 1 }}
              >
                Alles klar! 👍
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </>
  )
}
