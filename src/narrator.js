/**
 * LumiLearn Narrator — der einzige Kanal für alles Gesprochene.
 *
 * Vorher gab es zwei voneinander unabhängige Abspieler: `voice` für
 * aufgenommene MP3s und `speak` für die Sprachsynthese. `voice.play()` stoppte
 * die laufende Aufnahme, aber nicht die Sprachausgabe; `speak()` brach die
 * Sprachausgabe ab, aber nicht die Aufnahme. Wer beides benutzte — und das tun
 * mehrere Spiele — bekam zwei Stimmen übereinander. Dazu kam, dass eine neue
 * Runde ihre Ansage per setTimeout startete, während der Satz davor noch lief.
 *
 * Jetzt läuft alles durch eine Warteschlange: Wer etwas Neues sagen will,
 * stoppt zuerst alles Laufende. Abschnitte innerhalb *einer* Ansage warten
 * aufeinander, statt sich zu überlagern.
 */

import { asset, BASE } from './lib/assets.js'

let seq      = 0      // wird bei jedem Abbruch erhöht; veraltete Schritte steigen aus
let audioEl  = null
let lastKey  = null   // was gerade läuft — für skipIfSame (Hover-Vorlesen)
let running  = false
let level    = null   // Vorrang dessen, was gerade läuft

// Wer wissen will, ob gerade gesprochen wird (die Hintergrundmusik leiser
// dreht, solange Lumi redet).
const listeners = new Set()
export function onNarrationChange(fn) { listeners.add(fn); return () => listeners.delete(fn) }
function setRunning(v) {
  if (running === v) return
  running = v
  listeners.forEach(fn => { try { fn(v) } catch { /* ignore */ } })
}

function resolveAsset(src) {
  if (!src) return src
  if (src.startsWith('http') || src.startsWith(BASE) || src.startsWith('/')) return src
  return asset(src)
}

// Emojis und Sonderzeichen raus, sonst buchstabiert die Stimme sie aus.
function cleanText(text) {
  return String(text)
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, '')
    .replace(/[^\w\säöüÄÖÜß.,!?-]/g, '')
    .trim()
}

export function stopNarration() {
  seq++
  setRunning(false)
  lastKey = null
  level = null
  if (audioEl) { try { audioEl.pause() } catch { /* ignore */ } audioEl = null }
  if (typeof window !== 'undefined' && window.speechSynthesis) window.speechSynthesis.cancel()
}

/**
 * Sagt eine Folge von Abschnitten nacheinander.
 *
 * @param parts  [{ src?, text?, rate?, pitch?, lang?, gap? }]
 *               `src` ist eine Aufnahme, `text` der gesprochene Ersatz, wenn
 *               die Datei fehlt oder gar keine hinterlegt ist. `gap` ist eine
 *               Pause in Millisekunden *vor* dem Abschnitt.
 * @param opts   { onEnd, skipIfSame, priority }
 *               skipIfSame verhindert das Neustarten derselben Ansage — damit
 *               das Vorlesen beim Darüberfahren nicht bei jeder Mausbewegung
 *               von vorne beginnt.
 *
 *               priority 'preview' ist für alles, was das Kind nebenbei
 *               auslöst, ohne es zu wollen — vor allem das Vorlesen beim
 *               Darüberfahren. Eine Vorschau unterbricht NIE eine laufende
 *               Ansage; sie wird dann einfach verworfen. Damit wird das
 *               Vorlesen faktisch erst nach der Fragestellung wirksam, ohne
 *               dass ein Spiel dafür irgendetwas verwalten muss. Untereinander
 *               dürfen Vorschauen sich ablösen: die Maus wandert weiter, und
 *               das zuletzt berührte Wort gewinnt.
 */
export function narrate(parts, { onEnd, skipIfSame = false, priority = 'normal' } = {}) {
  const list = (Array.isArray(parts) ? parts : [parts]).filter(p => p && (p.src || p.text))
  if (!list.length) { onEnd?.(); return }

  const key = list.map(p => p.src ?? p.text).join('|')
  if (skipIfSame && running && key === lastKey) return
  // Nebenbei ausgelöstes Vorlesen wartet nicht, es entfällt.
  if (priority === 'preview' && running && level !== 'preview') return

  stopNarration()
  const mySeq = ++seq
  lastKey = key
  level = priority
  setRunning(true)

  let i = 0
  const finish = () => {
    if (mySeq !== seq) return
    setRunning(false)
    lastKey = null
    level = null
    onEnd?.()
  }

  const next = () => {
    if (mySeq !== seq) return          // etwas Neueres hat übernommen
    if (i >= list.length) { finish(); return }
    const p = list[i++]
    const go = () => (p.src ? playClip(p, next, mySeq) : speakPart(p, next, mySeq))
    if (p.gap) setTimeout(() => { if (mySeq === seq) go() }, p.gap)
    else go()
  }

  // Ein Abschnitt darf die Kette nicht anhalten, wenn sein Ende-Ereignis
  // ausbleibt: Chrome verschluckt es bei längeren Sätzen gelegentlich, und ohne
  // installierte Stimme kommt es gar nicht. Deshalb bekommt jeder Abschnitt
  // einen Wächter, der nach der geschätzten Dauer weiterschaltet.
  const once = (done, s, ms) => {
    let fired = false
    const t = setTimeout(() => { if (!fired) { fired = true; if (s === seq) done() } }, ms)
    return () => { if (fired) return; fired = true; clearTimeout(t); if (s === seq) done() }
  }

  const playClip = (p, done, s) => {
    try {
      const a = new Audio(resolveAsset(p.src))
      audioEl = a
      let failed = false
      const hand = once(done, s, 15000)
      const onFail = () => {
        failed = true
        if (s !== seq) return
        // Fehlt die Aufnahme, springt die Sprachsynthese ein — lieber eine
        // Roboterstimme als Stille.
        if (p.text) speakPart(p, done, s); else hand()
      }
      a.addEventListener('error', onFail, { once: true })
      a.addEventListener('ended', () => { if (!failed) hand() }, { once: true })
      a.play().catch(onFail)
    } catch { if (p.text) speakPart(p, done, s); else done() }
  }

  const speakPart = (p, done, s) => {
    if (typeof window === 'undefined' || !window.speechSynthesis) { done(); return }
    const clean = cleanText(p.text ?? '')
    if (!clean) { done(); return }
    const rate = p.rate ?? 0.85
    // grobe Schätzung: ~13 Zeichen pro Sekunde bei Tempo 1, plus Puffer
    const hand = once(done, s, Math.min(20000, 900 + (clean.length / 13 / rate) * 1000 + 900))
    const u = new SpeechSynthesisUtterance(clean)
    u.rate  = rate
    u.pitch = p.pitch ?? 1.05
    u.lang  = p.lang || (typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE')
    u.addEventListener('end', hand, { once: true })
    u.addEventListener('error', hand, { once: true })
    window.speechSynthesis.speak(u)
  }

  next()
}
