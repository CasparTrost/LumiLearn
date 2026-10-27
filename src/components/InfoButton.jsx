import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { narrate, stopNarration } from '../narrator.js'
import { MODULE_BY_ID } from '../modules.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

// Help per game. Read aloud when the dialog opens (most children who play
// can't read yet), so the texts are written to be heard: short sentences,
// no "lies", no keyboard talk, nothing that depends on seeing the words.
const INFO = {
  'number-intro':  { emoji: '🔢', title: 'Zahlen entdecken', text: 'Lumi sagt dir eine Zahl. Tippe genau so viele Dinge an. Jedes Mal, wenn du tippst, zählt Lumi mit. Bist du fertig, tippe auf Fertig.' },
  'letter-intro':  { emoji: '🔡', title: 'ABC-Abenteuer', text: 'Ein Buchstabe kommt groß ins Bild, und Lumi erzählt dir etwas über ihn. Dann tippst du auf das Bild, dessen Wort mit diesem Buchstaben anfängt.' },
  'initial-sound': { emoji: '🕵️', title: 'Anlaut-Detektiv', text: 'Du siehst ein Bild und hörst das Wort. Hör genau auf den ersten Laut! Dann tippe auf den Buchstaben, mit dem das Wort anfängt.' },
  rhyme:           { emoji: '🎵', title: 'Reim-Rallye', text: 'Lumi sagt dir ein Wort. Welches Bild reimt sich darauf? Wörter reimen sich, wenn sie am Ende gleich klingen, so wie Maus und Haus. Später sagst du Ja oder Nein, findest das Wort, das sich nicht reimt, oder ergänzt einen kleinen Reim.' },
  numbers:         { emoji: '🛒', title: 'Zahlenland', text: 'Ein Kunde kommt in den Laden und sagt, was er möchte. Tippe die Sachen an, dann wandern sie in den Einkaufswagen. Zähle gut mit und tippe auf den grünen Haken, wenn es genau stimmt.' },
  letters:         { emoji: '⌨️', title: 'Buchstabenwald', text: 'Du siehst ein Bild und hörst das Wort. Tippe die Buchstaben auf der Tastatur in der richtigen Reihenfolge. Der leuchtende Platz zeigt dir, welcher Buchstabe als Nächstes dran ist. Auf jeder Taste ist ein Bild: M wie Maus. So findest du den richtigen Laut. Später fallen die Buchstaben herunter: Tippe sie auf der Tastatur, bevor sie unten sind.' },
  listen:          { emoji: '👂', title: 'Hörabenteuer', text: 'Hör genau hin! Lumi sagt ein Wort. Tippe auf das Bild, das dazu passt. Mit dem Lautsprecher hörst du das Wort noch einmal. In den letzten Leveln siehst du ein Bild und liest, welches Wort dazu passt.' },
  words:           { emoji: '🃏', title: 'Memo-Welt', text: 'Merk dir die Karten, bevor sie sich umdrehen. Dann deckst du immer zwei Karten auf. Findest du zwei, die zusammengehören, bleiben sie liegen.' },
  patterns:        { emoji: '🔮', title: 'Musterpark', text: 'Schau dir die Reihe genau an. Sie wiederholt sich immer gleich. Was kommt als Nächstes? Manchmal fehlt ein Bild mitten in der Reihe, oder die Reihe wird immer länger. Tippe auf das Bild, das passt. Manchmal sind mehrere Plätze leer: Dann legst du die Reihe selbst weiter, Bild für Bild.' },
  shapes:          { emoji: '🎨', title: 'Farbenreich', text: 'Lumi sagt dir, welche Farbe wohin gehört. Tippe zuerst auf den Farbeimer und dann auf die Fläche im Bild, die leuchtet.' },
  emotions:        { emoji: '😊', title: 'Gefühlswelt', text: 'Lumi erzählt dir, was passiert ist. Wie fühlt sich Lumi wohl dabei? Tippe auf das Gesicht, das dazu passt. Mit dem Lautsprecher hörst du alle Gefühle.' },
  empathy:         { emoji: '🕵️‍♀️', title: 'Gefühlsdetektiv', text: 'Schau dir das Kind genau an: sein Gesicht und seine Haltung. Wie fühlt es sich? Und dann: Was kannst du tun, damit es ihm besser geht?' },
  maze:            { emoji: '🌀', title: 'Lumi-Labyrinth', text: 'Hilf Lumi durch das Labyrinth! Sammle alle Zaubertränke und lauf dann zum leuchtenden Ausgang. Wische oder benutze die Pfeile. Pass auf den Drachen auf! Wenn du stehen bleibst, kann der Drache dir nichts tun. Findest du einen ganz kurzen Weg, bekommt Lumi eine Krone!' },
  shadows:         { emoji: '🌑', title: 'Schattenrätsel', text: 'Im Dunkeln versteckt sich etwas. Fahre mit der Taschenlampe über das Bild. Was ist es? Tippe auf das richtige Bild. Tippe auf den Tipp-Knopf, dann verrät Lumi dir etwas über das Versteckte.' },
  bubbles:         { emoji: '🫧', title: 'Blasen-Blitz', text: 'Lumi sagt dir eine Zahl. Tippe alle Blasen an, auf denen so viele Punkte sind oder die diese Zahl zeigen. Lass dir Zeit und schau genau hin.' },
  stories:         { emoji: '📖', title: 'Lumis Abenteuer', text: 'Lumi erlebt eine Geschichte, und Lumi liest sie dir vor. Am Ende entscheidest du: Was soll Lumi tun? Danach erfährst du, wie es weitergeht.' },
  sort:            { emoji: '🧺', title: 'Sortier-Spaß', text: 'Lumi zeigt dir ein Ding und sagt dir, was es ist. In welchen Korb gehört es? Tippe auf den richtigen Korb.' },
  clock:           { emoji: '🕐', title: 'Uhren-Uhr', text: 'Der kurze Zeiger zeigt die Stunde, der lange Zeiger die Minuten. Schau, wohin die Zeiger zeigen, und tippe auf die richtige Uhrzeit. Manchmal stellst du die Uhr selbst: Zieh die Zeiger oder tippe auf Plus und Minus. Und manchmal fragt Lumi, was um diese Zeit passiert.' },
  words2:          { emoji: '🔤', title: 'Silben-Spaß', text: 'Schau auf das Bild und hör das Wort. Jedes Stück des Wortes ist eine Silbe, wie beim Klatschen: Ho, nig. Tippe die Silben in der richtigen Reihenfolge. Manchmal klatschst du mit und zählst, wie viele Silben du hörst.' },
  weight:          { emoji: '⚖️', title: 'Waage-Welt', text: 'Zwei Dinge liegen auf der Waage. Welches ist schwerer? Tippe auf die schwerere Seite. Später stehen Zahlen auf den Paketen: Die größere Zahl ist schwerer. Ganz am Ende legst du Klötze auf die Waage, bis sie gerade ist.' },
  'rocket-math':   { emoji: '🚀', title: 'Rechen-Rakete', text: 'Die Rakete hüpft auf dem Zahlenstrahl. Lumi sagt dir die Aufgabe. Tippe auf das Feld, wo die Rakete landet.' },
  'shapes-land':   { emoji: '🔷', title: 'Formen-Land', text: 'Lumi nennt eine Form. Tippe sie an! Manchmal sollst du Formen nach der Größe ordnen oder ein Muster weiterlegen.' },
  'shape-build':   { emoji: '🧩', title: 'Formen-Werkstatt', text: 'Lumi möchte etwas bauen. Tippe unten auf eine Form und dann auf den Platz im Bild, wo sie hingehört. Liegt eine Form falsch herum, tippe sie noch einmal an, dann dreht sie sich. Manchmal ist ein Teil zu viel.' },
  coloring:        { emoji: '🖍️', title: 'Mal-Atelier', text: 'Hier darfst du frei malen. Wähle eine Farbe und male mit dem Pinsel, oder fülle eine ganze Fläche mit dem Farbeimer. Mit dem Pfeil machst du den letzten Schritt rückgängig.' },
}

export default function InfoButton({ moduleId, onOpenChange }) {
  const [open, setOpenState] = useState(false)
  // Opening reads the help aloud and pauses the game (GameScreen passes
  // onOpenChange to its PauseContext); closing stops the reading.
  const setOpen = v => {
    setOpenState(v)
    onOpenChange?.(v)
    if (v) narrate([{ text: `${info.title}. ${info.text}` }])
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
