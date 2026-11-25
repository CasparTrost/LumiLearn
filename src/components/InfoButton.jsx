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
  'number-intro':  { emoji: '🔢', title: 'Zahlen entdecken', text: 'Zieh das Tier mit dem Finger unter das Obst und fang genau so viele, wie auf dem Schild stehen. Hast du genug, drück auf den gelben Mund. Dann wird gegessen.' },
  'letter-intro':  { emoji: '🔡', title: 'ABC-Abenteuer', text: 'Das Monster frisst nur Sachen, die mit seinem Buchstaben anfangen. Tippe sie an, wenn sie vorbeifliegen. Sind zwei Monster da, zieh jede Sache zu ihrem Monster.' },
  'initial-sound': { emoji: '🎣', title: 'Anlaut-Detektiv', text: 'Lumi angelt lustige Sachen aus dem Teich. Womit fängt das Wort an? Bring den Fang in den Eimer mit dem richtigen Buchstaben. Tippst du einen Frosch an, quakt er seinen Buchstaben.', fresh: true },
  rhyme:           { emoji: '🎭', title: 'Reim-Rallye', text: 'Tippe auf den Ballon, der sich reimt, dann spielen die zwei eine lustige Szene. Auf dem Trapez drückst du Grün, wenn es sich reimt, und Rot, wenn nicht. Später tippst du den an, der sich nicht reimt: Den holt der Haken von der Bühne.', fresh: true },
  numbers:         { emoji: '🌟', title: 'Zahlenland', text: 'Am Himmel verstecken sich Bilder. Tippe die Sterne der Reihe nach an oder fahre mit dem Finger von Stern zu Stern. Beim letzten Stern erscheint das Bild.' },
  letters:         { emoji: '⌨️', title: 'Buchstabenwald', text: 'Tippe die Buchstaben, die am Ast hängen, dann zaubert Lumi das Ding aus dem Kessel. Später fallen die Buchstaben von den Bäumen: Tippe sie, bevor der Igel sie holt. Am Ende hat ein Rabe das letzte Wort geklaut: Jeder Buchstabe kostet ihn eine Feder.' },
  listen:          { emoji: '👂', title: 'Hörabenteuer', text: 'Die Dinge hüpfen in die Büsche, dann tauschen die Büsche die Plätze. Lumi ruft eins, oder sie zeigt sein Wort auf einem Schild. Tipp auf den Busch, in dem es jetzt steckt!', fresh: true },
  words:           { emoji: '🃏', title: 'Memo-Welt', text: 'Dreh immer zwei Karten um: Zwei gleiche gehören dir. Ab Level drei spielst du abwechselnd mit Lumi. Wer mehr Paare hat, gewinnt.', fresh: true },
  patterns:        { emoji: '🥁', title: 'Musterpark', text: 'Die Tiere spielen der Reihe nach, ein Hocker ist leer. Hör gut zu: Wer fehlt? Setz das passende Tier auf den Hocker.' },
  shapes:          { emoji: '🎨', title: 'Farbenreich', text: 'Das Monster zeigt in seiner Denkblase, welche Farbe es haben möchte. Tippe auf die Farbflaschen, bis der Tank diese Farbe hat, und zieh dann am Hebel. Am Rad am Tank lässt du die Farbe wieder ab.' },
  emotions:        { emoji: '😊', title: 'Gefühlswelt', text: 'Lumi zeigt dir ein Gesicht und sagt das Gefühl. Tippe alle Tiere an, die sich genauso fühlen. Tippst du auf das Schild, sagt Lumi das Gefühl noch einmal.' },
  empathy:         { emoji: '🕵️‍♀️', title: 'Gefühlsdetektiv', text: 'Tippe auf die Lupe und schau, was passiert. Dann tippe auf das Gesicht, das passt. Und such aus, was dem Tier jetzt gut tut. Du siehst gleich, ob es hilft.' },
  maze:            { emoji: '🌀', title: 'Lumi-Labyrinth', text: 'Sammle alle Zaubertränke, dann geht das Tor auf. Pass auf den Drachen auf. Findest du auch die drei Münzen, öffnet sich die Schatztruhe am Tor.', fresh: true },
  shadows:         { emoji: '🌑', title: 'Schattenrätsel', text: 'Leuchte mit der Taschenlampe ins dunkle Zimmer. Ein Schatten im Licht bleibt stehen: Zieh das passende Bild darauf oder tippe es an.', fresh: true },
  bubbles:         { emoji: '🫧', title: 'Blasen-Blitz', text: 'Der Krake wünscht sich Blasen mit einer Zahl. Tippe alle Blasen an, die so viele Punkte oder diese Zahl zeigen. Kommt eine Riesenblase vorbei und passt, regnet es Sterne.' },
  sort:            { emoji: '🧺', title: 'Sortier-Spaß', text: 'Auf dem Förderband kommen Sachen angefahren. Zieh jede Sache zu dem Korbmonster, das sie sammelt; sein Schild zeigt, was es haben will.', fresh: true },
  clock:           { emoji: '🕐', title: 'Kuckucksuhr', text: 'Dreh die Zeiger, bis die Uhr die Zeit von der Karte zeigt. Bei zwei Zeigern drückst du danach auf den Haken. Stehen drei Zeiten zur Wahl, tippst du die an, die die Uhr zeigt.', fresh: true },
  words2:          { emoji: '🐸', title: 'Silben-Spaß', text: 'Sag das Wort und klatsch dazu: Jedes Klatschen legt ein Seerosenblatt ins Wasser, dann hüpft der Frosch hinüber. Manchmal legst du die Silben-Blätter der Reihe nach.', fresh: true },
  weight:          { emoji: '⚖️', title: 'Waage-Welt', text: 'Wirf etwas auf die Wippe: Je schwerer es ist, desto höher fliegt die Maus. Sie soll genau bis zum Käse kommen. Später zählst du Pakete zusammen, ordnest von leicht nach schwer und machst die Wippe gerade.', fresh: true },
  'rocket-math':   { emoji: '🚀', title: 'Rechen-Rakete', text: 'Jeder Druck auf die Flamme ist ein Hüpfer zum nächsten Planeten. Hüpf so oft, wie die Rechnung sagt, und lande mit dem grünen Haken. Auf dem richtigen Planeten wohnt der Außerirdische.', fresh: true },
  'shapes-land':   { emoji: '🔷', title: 'Formen-Land', text: 'Die Eule zeigt dir in ihrer Lupe eine Form. Tippe im Bild alle Formen an, die so aussehen. Manchmal stellst du Formen der Größe nach auf, setzt eine Parade fort oder legst die passende Form auf ein Ding.' },
  'shape-build':   { emoji: '🧩', title: 'Formen-Werkstatt', text: 'Ein Tier wünscht sich etwas. Zieh die Formen an ihren Platz, bis es fertig ist. Mit dem Pfeil drehst du eine Form, und manchmal ist ein Teil zu viel. Am Ende darfst du selbst bauen.' },
  trace:           { emoji: '📝', title: 'Buchstaben-Spuren', text: 'Leg den Finger auf den grünen Punkt und fahre den Weg nach. Die Schnecke fährt mit und sammelt die Sterne. Fertige Buchstaben und Zahlen werden lebendig.' },
  coloring:        { emoji: '🖍️', title: 'Mal-Atelier', text: 'Tippe auf eine Farbe und mal mit dem Finger, oder fülle eine Fläche mit dem Eimer. Probier den Regenbogen-Pinsel, den Glitzer und die Stempel! Mit Fertig hängt dein Bild an deiner Wand.', fresh: true },
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

  // A phone held sideways is lower than the dialog was tall (its picture
  // was cut off at the top and the button touched the edge): there the
  // picture stands beside the title and the dialog is wider and flatter.
  const low = open && typeof window !== 'undefined' && window.innerHeight <= 480

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
              padding: low ? 8 : 24,
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
                padding: low ? '14px 24px' : '36px 28px 28px',
                maxWidth: low ? 700 : 420, width: '100%',
                maxHeight: '100%', overflowX: 'hidden', overflowY: 'auto',
                display: 'flex', flexDirection: low ? 'row' : 'column', flexWrap: low ? 'wrap' : 'nowrap',
                alignItems: 'center', justifyContent: 'center', gap: low ? '8px 14px' : 18,
                textAlign: 'center',
                position: 'relative',
              }}
            >
              {/* Emoji */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.08 }}
                style={{
                  fontSize: low ? 44 : 72, lineHeight: 1, zIndex: 1,
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
                color: 'var(--text-secondary)',
                maxWidth: low ? 'none' : 340, flexBasis: low ? '100%' : 'auto',
                lineHeight: low ? 1.45 : 1.65,
                zIndex: 1,
              }}>
                {info.text}
              </div>

              {/* Close button */}
              <button
                className="px-btn px-btn--green px-btn--md"
                onClick={() => setOpen(false)}
                style={{ marginTop: low ? 2 : 6, zIndex: 1 }}
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
