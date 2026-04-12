import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const INFO = {
  'number-intro': {
    emoji: '🔢',
    title: 'Zahlen entdecken',
    text: 'Du siehst Objekte auf dem Bildschirm – tippe sie nacheinander an und zähle laut mit! So lernst du die Zahlen 1 bis 10 kennen. 🌟',
  },
  'letter-intro': {
    emoji: '🔡',
    title: 'ABC-Abenteuer',
    text: 'Ein Buchstabe erscheint groß auf dem Bildschirm – lerne etwas über ihn! Tippe dann auf das Bild, dessen Wort mit diesem Buchstaben beginnt. ✏️',
  },
  numbers: {
    emoji: '🛒',
    title: 'Zahlenland',
    text: 'Ein Kunde kommt in den Laden und bestellt etwas! Lege genau die richtige Anzahl in den Korb – hör gut hin und zähle mit. 🔢',
  },
  letters: {
    emoji: '⌨️',
    title: 'Buchstabenwald',
    text: 'Ein Wort wird angezeigt – tippe jeden Buchstaben in der richtigen Reihenfolge! Der goldene Buchstabe ist als nächstes dran. In höheren Leveln fallen die Buchstaben vom Himmel – tippe sie, bevor sie landen! ⌨️',
  },
  listen: {
    emoji: '👂',
    title: 'Hörabenteuer',
    text: 'Hör genau hin! Du hörst ein Wort – tippe dann auf das Bild, das dazu passt. Du kannst es dir auch zweimal anhören! 🎵',
  },
  words: {
    emoji: '🃏',
    title: 'Memo-Welt',
    text: 'Drehe die Karten um und merke dir, was drauf war! Finde zwei Karten, die dasselbe zeigen. Wer findet alle Paare? 🧠',
  },
  patterns: {
    emoji: '🔮',
    title: 'Musterpark',
    text: 'Schau dir das Muster genau an – was kommt als nächstes? Tippe auf die richtige Antwort! 🔍',
  },
  shapes: {
    emoji: '🎨',
    title: 'Farbenreich',
    text: 'Wähle zuerst einen Farbtopf aus – dann tippe auf den Teil des Bildes, den du anmalen möchtest! Die Aufkleber zeigen dir, welche Farbe wohin gehört. 🖌️',
  },
  emotions: {
    emoji: '😊',
    title: 'Gefühlswelt',
    text: 'Lumi erlebt etwas! Lies die Situation und denke nach: Wie fühlt sich Lumi dabei wohl? Tippe auf das passende Gefühl! 💛',
  },
  maze: {
    emoji: '🌀',
    title: 'Lumi-Labyrinth',
    text: 'Lumi ist im Labyrinth! Sammle alle Edelsteine und finde dann den Weg zum Schloss. Nutze die Pfeiltasten oder die Buttons auf dem Bildschirm. 🏰',
  },
  shadows: {
    emoji: '🌑',
    title: 'Schattenrätsel',
    text: 'Hinter einem Schatten versteckt sich ein Tier! Fahre mit der Taschenlampe über den Schatten und tippe dann auf das Tier, das du erkennst. 🔦',
  },
  bubbles: {
    emoji: '🫧',
    title: 'Blasen-Blitz',
    text: 'Blasen steigen auf! Tippe schnell auf alle Blasen mit der richtigen Zahl. Lass keine entkommen – die Zeit läuft! ⚡',
  },
  stories: {
    emoji: '📖',
    title: 'Lumis Abenteuer',
    text: 'Lumi erlebt eine Geschichte! Lies mit und entscheide am Ende: Was soll Lumi tun? Deine Wahl verändert alles! 🌈',
  },
  sort: {
    emoji: '🧺',
    title: 'Sortier-Spaß',
    text: 'Sortiere die Dinge in die richtige Gruppe! Tippe auf einen Gegenstand und dann auf die Gruppe, zu der er gehört. Alles muss an den richtigen Platz! 📦',
  },
  clock: {
    emoji: '🕐',
    title: 'Uhren-Uhr',
    text: 'Lerne die Uhr kennen! Beim Lesen: schau, wohin die Zeiger zeigen, und tippe auf die richtige Uhrzeit. Beim Stellen: ziehe die Zeiger auf die richtige Stelle! ⏰',
  },
  words2: {
    emoji: '🔤',
    title: 'Silben-Spaß',
    text: 'Schau auf das Bild – was siehst du? Tippe auf die Silben in der richtigen Reihenfolge, um das Wort zusammenzusetzen. Die Silben rücken wie Puzzleteile zusammen! 🧩',
  },
  weight: {
    emoji: '⚖️',
    title: 'Waage-Welt',
    text: 'Schau dir die zwei Dinge an – welches ist wohl schwerer? Tippe auf die schwerere Seite! In höheren Leveln musst du die Gewichte ausrechnen. 💪',
  },
}

export default function InfoButton({ moduleId }) {
  const [open, setOpen] = useState(false)
  const info = INFO[moduleId] ?? { emoji: '❓', title: 'Wie geht das?', text: 'Schau dir die Aufgabe an und tippe auf die richtige Antwort!' }

  return (
    <>
      <motion.button
        whileHover={{ scale: 1.12 }}
        whileTap={{ scale: 0.93 }}
        onClick={() => setOpen(true)}
        aria-label="Spielanleitung anzeigen"
        style={{
          width: 38, height: 38, borderRadius: '50%',
          background: 'rgba(255,255,255,0.22)',
          border: '2.5px solid rgba(255,255,255,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', flexShrink: 0, color: 'white',
          fontFamily: 'var(--font-heading)', fontSize: 19, fontWeight: 800,
          lineHeight: 1,
        }}
      >
        ?
      </motion.button>

      <AnimatePresence>
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
              background: 'rgba(20, 5, 50, 0.60)',
              backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.72, opacity: 0, y: 32 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.82, opacity: 0, y: 18 }}
              transition={{ type: 'spring', stiffness: 420, damping: 30 }}
              onClick={e => e.stopPropagation()}
              style={{
                background: 'white',
                borderRadius: 36,
                padding: '40px 32px 32px',
                maxWidth: 420, width: '100%',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
                boxShadow: '0 28px 90px rgba(0,0,0,0.35)',
                textAlign: 'center',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Decorative background circles */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 130, height: 130, borderRadius: '50%',
                background: 'linear-gradient(135deg,#ECE8FF,#C4B5FF)',
                opacity: 0.6, pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', bottom: -30, left: -30,
                width: 100, height: 100, borderRadius: '50%',
                background: 'linear-gradient(135deg,#D4F5E2,#A8EDCA)',
                opacity: 0.55, pointerEvents: 'none',
              }} />

              {/* Emoji */}
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.08 }}
                style={{
                  fontSize: 72, lineHeight: 1, zIndex: 1,
                  filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.15))',
                }}
              >
                {info.emoji}
              </motion.div>

              {/* Title */}
              <div style={{
                fontFamily: 'var(--font-heading)',
                fontSize: 'clamp(22px,5vw,28px)',
                fontWeight: 800,
                color: '#4A00E0',
                zIndex: 1,
              }}>
                {info.title}
              </div>

              {/* Text */}
              <div style={{
                fontFamily: 'var(--font-body, sans-serif)',
                fontSize: 'clamp(16px,3.5vw,19px)',
                lineHeight: 1.65,
                color: '#3a3a5c',
                maxWidth: 340,
                zIndex: 1,
              }}>
                {info.text}
              </div>

              {/* Close button */}
              <motion.button
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setOpen(false)}
                style={{
                  marginTop: 6, zIndex: 1,
                  background: 'linear-gradient(135deg,#6C63FF,#A78BFA)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 99,
                  padding: '15px 44px',
                  fontFamily: 'var(--font-heading)', fontSize: 19, fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 6px 28px rgba(108,99,255,0.50)',
                }}
              >
                Alles klar! 👍
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
