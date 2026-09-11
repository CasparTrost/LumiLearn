import { lazy } from 'react'

const RELOAD_KEY = 'lumi_chunk_reload'

/**
 * `lazy()`, das eine veraltete Seite selbst repariert.
 *
 * Die Spiele werden erst beim Öffnen nachgeladen, und ihre Dateinamen
 * enthalten eine Prüfsumme. Nach einem neuen Stand auf dem Server zeigt eine
 * im Browser zwischengespeicherte index.html auf Dateinamen, die es dort nicht
 * mehr gibt. Das Nachladen scheitert dann — und weil jedes Spiel so geladen
 * wird, landet man überall im Fehlerbildschirm, obwohl nichts kaputt ist. Die
 * Startseite läuft weiter, weil sie schon geladen war; genau dieses Bild hatte
 * ein Nutzer nach einem Update.
 *
 * Deshalb: schlägt das Nachladen fehl, wird die Seite einmal neu geladen. Dann
 * holt der Browser die aktuelle index.html mit den richtigen Dateinamen. Der
 * Merker in sessionStorage sorgt dafür, dass daraus keine Schleife wird, falls
 * es doch ein echter Fehler war — beim zweiten Mal gewinnt der Fehlerbildschirm.
 */
export function lazyWithReload(load) {
  return lazy(() => load().then(
    mod => {
      try { sessionStorage.removeItem(RELOAD_KEY) } catch { /* ignore */ }
      return mod
    },
    err => {
      let alreadyTried = true
      try {
        alreadyTried = !!sessionStorage.getItem(RELOAD_KEY)
        if (!alreadyTried) sessionStorage.setItem(RELOAD_KEY, '1')
      } catch { /* Sitzungsspeicher gesperrt: dann lieber den Fehler zeigen */ }
      if (!alreadyTried && typeof window !== 'undefined') {
        window.location.reload()
        // Nie auflösen — die Seite wird gerade ersetzt, und ein aufgelöstes
        // Versprechen würde vorher noch den Fehlerbildschirm zeigen.
        return new Promise(() => {})
      }
      throw err
    },
  ))
}
