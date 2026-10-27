/**
 * Wie ein Buchstabe klingt — geschrieben für die Sprachausgabe.
 *
 * Lesen lernt ein Kind über den Laut, nicht über den Buchstabennamen: das F
 * in "Fisch" ist "fff", nicht "Eff", das H in "Hund" ist ein Hauch, nicht
 * "Ha". Aufnahmen der Laute gibt es nicht, deshalb stehen hier Schreibweisen,
 * die eine deutsche Stimme als Laut ausspricht. Angezeigt wird weiter nur der
 * Buchstabe selbst.
 *
 *   • Selbstlaute als Ausruf: "Ah", "Oh" — die liest jede Stimme richtig.
 *   • Gedehnt nur M, S und F. "Www" liest die Stimme als "Weh Weh Weh" (so
 *     klang das alte "W. W. W. Wolf"), "Ttt" stottert, weil sich ein
 *     Verschlusslaut nicht dehnen lässt.
 *   • Alle anderen mit einem kurzen, gemurmelten ö, wie in einer
 *     Anlauttabelle: Bö, Dö, Lö.
 *
 * Die Umlaute klingen wie ihr Selbstlaut. C, Q, V, X und Y haben keinen
 * eigenen Laut; sie stehen mit dem Laut da, mit dem sie ein Wort am häufigsten
 * beginnen (C wie Clown, V wie Vogel, Y wie Yoga).
 *
 * Gebraucht von ABC-Abenteuer, Anlaut-Detektiv und der Anlauttabelle im
 * Buchstabenwald.
 */
export const LETTER_SOUND = {
  A: 'Ah', E: 'Äh', I: 'Ih', O: 'Oh', U: 'Uh',
  M: 'Mmm', S: 'Sss', F: 'Fff',
  L: 'Lö', N: 'Nö', R: 'Rö', W: 'Wö', H: 'Hö', J: 'Jö',
  B: 'Bö', D: 'Dö', G: 'Gö', K: 'Kö', P: 'Pö', T: 'Tö', Z: 'Tsö',
  Ä: 'Äh', Ö: 'Öh', Ü: 'Üh',
  C: 'Kö', Q: 'Kwö', V: 'Fff', X: 'Kss', Y: 'Jö',
}

export const soundOf = L => LETTER_SOUND[L] ?? L
