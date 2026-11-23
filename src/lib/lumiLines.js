/**
 * Lumi's recorded sentences: the menus, praise, "geschafft", the journey,
 * the movement break and the help of every game, spoken by the cloned Lumi
 * voice (ElevenLabs, voice "Lumi", model multilingual v2). One key per
 * sentence; the recording is public/audio/lumi/<key>.mp3, made from exactly
 * this text, cut to the speech and brought to the loudness of the older
 * recordings (-17 LUFS, ffmpeg silenceremove + loudnorm, mono 96 kbit/s).
 *
 *   narrate([line('ergebnis/meister')])     // { src, text }
 *
 * Change a text here and the recording no longer fits: make it again.
 * The text is also what the browser voice says if the file can't be played.
 */
export const LINES = {
  // menue
  'menue/hallo': 'Hallo, ich bin Lumi! Tippe auf den gelben Knopf, dann geht es los.',
  'menue/welches-tier': 'Welches Tier möchtest du sein? Tippe auf ein Bild.',
  'menue/wie-alt': 'Wie alt bist du? Tippe auf die Zahl. Dann tippe auf den grünen Knopf.',
  'menue/wer-spielt-heute': 'Wer spielt heute? Tippe auf dein Bild.',
  'menue/wer-spielt': 'Wer spielt? Tippe auf dein Bild.',
  'menue/wirklich-aufhoeren': 'Möchtest du wirklich aufhören? Tippe auf den grünen Knopf, dann spielst du weiter.',
  'menue/welches-level': 'Welches Level möchtest du spielen? Der grüne Knopf spielt das nächste Level.',
  'menue/alle-spiele': 'Alle Spiele.',
  'menue/spielzeit-vorbei': 'Für heute ist die Spielzeit vorbei. Lumi ruht sich jetzt aus. Morgen spielen wir weiter!',
  'menue/internet-spiel': 'Oh, Lumi braucht Internet, um dieses Spiel zu holen. Spiel solange ein anderes Spiel, oder versuch es gleich noch einmal.',
  'menue/internet-fehler': 'Oh, Lumi braucht Internet, um dieses Spiel zu holen. Versuch es gleich noch einmal.',
  'menue/gestolpert': 'Ups, Lumi ist gestolpert. Versuch es noch einmal.',
  'menue/welt-zahlen': 'Die Zahlen-Welt. Hier zählst und rechnest du.',
  'menue/welt-buchstaben': 'Die Buchstaben-Welt. Hier geht es um Laute, Wörter und Buchstaben.',
  'menue/welt-denken': 'Die Knobel-Welt. Hier löst du Rätsel.',
  'menue/welt-gefuehle': 'Die Gefühle-Welt. Hier geht es um Gefühle und Freunde.',
  'menue/welt-malen': 'Die Mal-Welt. Hier malst du.',
  // spielnamen
  'spielnamen/spiel-number-intro': 'Zahlen entdecken. Zähle Dinge und lerne die Zahlen.',
  'spielnamen/spiel-letter-intro': 'ABC-Abenteuer. Lerne die Buchstaben kennen.',
  'spielnamen/spiel-emotions': 'Gefühlswelt. Wie fühlt sich Lumi?',
  'spielnamen/spiel-listen': 'Hörabenteuer. Hör genau hin und finde das Bild.',
  'spielnamen/spiel-shadows': 'Schattenrätsel. Was versteckt sich im Dunkeln?',
  'spielnamen/spiel-shapes': 'Farbenreich. Male Bilder mit den richtigen Farben an.',
  'spielnamen/spiel-numbers': 'Zahlenland. Kaufe im Laden genau richtig ein.',
  'spielnamen/spiel-letters': 'Buchstabenwald. Schreibe Wörter mit Buchstaben.',
  'spielnamen/spiel-words2': 'Silben-Spaß. Baue Wörter aus Silben.',
  'spielnamen/spiel-bubbles': 'Blasen-Blitz. Tippe die richtigen Blasen an.',
  'spielnamen/spiel-words': 'Memo-Welt. Finde die Paare.',
  'spielnamen/spiel-patterns': 'Musterpark. Was kommt als Nächstes?',
  'spielnamen/spiel-sort': 'Sortier-Spaß. Räume alles an den richtigen Platz.',
  'spielnamen/spiel-weight': 'Waage-Welt. Was ist schwerer?',
  'spielnamen/spiel-clock': 'Uhren-Uhr. Lerne die Uhr lesen.',
  'spielnamen/spiel-maze': 'Lumi-Labyrinth. Hilf Lumi durch das Labyrinth.',
  'spielnamen/spiel-stories': 'Lumis Abenteuer. Hör eine Geschichte und entscheide mit.',
  'spielnamen/spiel-rocket-math': 'Rechen-Rakete. Rechne mit der Rakete auf dem Zahlenstrahl.',
  'spielnamen/spiel-shapes-land': 'Formen-Land. Finde Kreise, Dreiecke und Quadrate.',
  'spielnamen/spiel-rhyme': 'Reim-Rallye. Finde Wörter, die gleich klingen.',
  'spielnamen/spiel-initial-sound': 'Anlaut-Detektiv. Mit welchem Laut fängt das Wort an?',
  'spielnamen/spiel-empathy': 'Gefühlsdetektiv. Wie geht es dem Kind, und wie kannst du helfen?',
  'spielnamen/spiel-shape-build': 'Formen-Werkstatt. Baue Bilder aus Formen.',
  'spielnamen/spiel-trace': 'Buchstaben-Spuren. Fahre die Buchstaben mit dem Finger nach.',
  'spielnamen/spiel-coloring': 'Mal-Atelier. Male, was du möchtest.',
  // begruessung
  'begruessung/morgen': 'Guten Morgen! Schön, dass du da bist.',
  'begruessung/tag': 'Hallo! Schön, dass du da bist.',
  'begruessung/abend': 'Guten Abend! Schön, dass du da bist.',
  'begruessung/neu': 'Hallo! Ich bin Lumi. Ich freue mich, dass wir zusammen spielen.',
  'begruessung/wieder-da': 'Schön, dass du wieder da bist!',
  // bewegung
  'bewegung/frosch': 'Spring wie ein Frosch! Fünfmal. Los geht\'s!',
  'bewegung/baum': 'Streck dich ganz hoch, wie ein großer Baum! Die Arme nach oben, so hoch du kannst.',
  'bewegung/vogel': 'Flieg wie ein Vogel! Breite die Arme aus und flattere.',
  'bewegung/klatschen': 'Klatsch mit Lumi in die Hände! Sechsmal.',
  'bewegung/drehen': 'Dreh dich einmal ganz langsam im Kreis.',
  'bewegung/elefant': 'Stampf wie ein Elefant! Viermal, ganz fest.',
  'bewegung/atmen': 'Und jetzt ganz ruhig. Atme tief ein … und langsam wieder aus.',
  'bewegung/fertig': 'Super gemacht! Jetzt sind wir wieder fit für die Reise.',
  // rueckmeldung
  'rueckmeldung/richtig-1': 'Super!',
  'rueckmeldung/richtig-2': 'Richtig!',
  'rueckmeldung/richtig-3': 'Genau!',
  'rueckmeldung/richtig-4': 'Klasse!',
  'rueckmeldung/richtig-5': 'Prima!',
  'rueckmeldung/richtig-6': 'Ja, richtig!',
  'rueckmeldung/richtig-7': 'Gut überlegt!',
  'rueckmeldung/richtig-8': 'Gut aufgepasst!',
  'rueckmeldung/richtig-9': 'Genau hingeschaut!',
  'rueckmeldung/drangeblieben-1': 'Du hast nicht aufgegeben. Super!',
  'rueckmeldung/drangeblieben-2': 'Drangeblieben! Jetzt stimmt es.',
  'rueckmeldung/drangeblieben-3': 'Siehst du? Weiterprobieren hilft!',
  'rueckmeldung/drangeblieben-4': 'Geschafft! Gut, dass du weitergemacht hast.',
  'rueckmeldung/noch-nicht-1': 'Hm, noch nicht.',
  'rueckmeldung/noch-nicht-2': 'Fast!',
  'rueckmeldung/noch-nicht-3': 'Nicht ganz.',
  'rueckmeldung/noch-nicht-4': 'Hm, das war es nicht.',
  'rueckmeldung/noch-nicht-5': 'Schau mal genau.',
  'rueckmeldung/fehler-lernen': 'Nicht schlimm, Fehler gehören zum Lernen.',
  // ergebnis
  'ergebnis/meister': 'Du hast alle Level geschafft. Du bist ein Meister!',
  'ergebnis/alle-level': 'Du hast alle Level geschafft! Hol dir noch mehr Sterne.',
  'ergebnis/level-offen': 'Ein neues Level ist offen!',
  'ergebnis/nochmal-leichter': 'Versuch es noch einmal, oder spiel das leichtere Level.',
  'ergebnis/nochmal': 'Versuch es noch einmal.',
  'ergebnis/ueben': 'Noch einmal üben, dann wirst du richtig sicher.',
  'ergebnis/leichter': 'Probier mal das leichtere Level. Das macht dich sicherer, und dann geht es weiter.',
  // hilfe
  'hilfe/hilfe-number-intro': 'Zahlen entdecken. Lumi sagt dir eine Zahl. Tippe genau so viele Dinge an. Jedes Mal, wenn du tippst, zählt Lumi mit. Bist du fertig, tippe auf Fertig.',
  'hilfe/hilfe-letter-intro': 'ABC-Abenteuer. Ein Buchstabe kommt groß ins Bild, und Lumi erzählt dir etwas über ihn. Dann tippst du auf das Bild, dessen Wort mit diesem Buchstaben anfängt.',
  'hilfe/hilfe-initial-sound': 'Anlaut-Detektiv. Du siehst ein Bild und hörst das Wort. Hör genau auf den ersten Laut! Dann tippe auf den Buchstaben, mit dem das Wort anfängt.',
  'hilfe/hilfe-rhyme': 'Reim-Rallye. Lumi sagt dir ein Wort. Welches Bild reimt sich darauf? Wörter reimen sich, wenn sie am Ende gleich klingen, so wie Maus und Haus. Später sagst du Ja oder Nein, findest das Wort, das sich nicht reimt, oder ergänzt einen kleinen Reim.',
  'hilfe/hilfe-numbers': 'Zahlenland. Ein Kunde kommt in den Laden und sagt, was er möchte. Tippe die Sachen an, dann wandern sie in den Einkaufswagen. Zähle gut mit und tippe auf den grünen Haken, wenn es genau stimmt.',
  'hilfe/hilfe-letters': 'Buchstabenwald. Du siehst ein Bild und hörst das Wort. Tippe die Buchstaben auf der Tastatur in der richtigen Reihenfolge. Der leuchtende Platz zeigt dir, welcher Buchstabe als Nächstes dran ist. Auf jeder Taste ist ein Bild: M wie Maus. So findest du den richtigen Laut. Später fallen die Buchstaben herunter: Tippe sie auf der Tastatur, bevor sie unten sind.',
  'hilfe/hilfe-listen': 'Hörabenteuer. Hör genau hin! Lumi sagt ein Wort. Tippe auf das Bild, das dazu passt. Mit dem Lautsprecher hörst du das Wort noch einmal. In den letzten Leveln siehst du ein Bild und liest, welches Wort dazu passt.',
  'hilfe/hilfe-words': 'Memo-Welt. Merk dir die Karten, bevor sie sich umdrehen. Dann deckst du immer zwei Karten auf. Findest du zwei, die zusammengehören, bleiben sie liegen.',
  'hilfe/hilfe-patterns': 'Musterpark. Schau dir die Reihe genau an. Sie wiederholt sich immer gleich. Was kommt als Nächstes? Manchmal fehlt ein Bild mitten in der Reihe, oder die Reihe wird immer länger. Tippe auf das Bild, das passt. Manchmal sind mehrere Plätze leer: Dann legst du die Reihe selbst weiter, Bild für Bild.',
  'hilfe/hilfe-shapes': 'Farbenreich. Lumi sagt dir, welche Farbe wohin gehört. Tippe zuerst auf den Farbeimer und dann auf die Fläche im Bild, die leuchtet.',
  'hilfe/hilfe-emotions': 'Gefühlswelt. Lumi erzählt dir, was passiert ist. Wie fühlt sich Lumi wohl dabei? Tippe auf das Gesicht, das dazu passt. Mit dem Lautsprecher hörst du alle Gefühle.',
  'hilfe/hilfe-empathy': 'Gefühlsdetektiv. Schau dir das Kind genau an: sein Gesicht und seine Haltung. Wie fühlt es sich? Und dann: Was kannst du tun, damit es ihm besser geht?',
  'hilfe/hilfe-maze': 'Lumi-Labyrinth. Hilf Lumi durch das Labyrinth! Sammle alle Zaubertränke und lauf dann zum leuchtenden Ausgang. Wische oder benutze die Pfeile. Pass auf den Drachen auf! Wenn du stehen bleibst, kann der Drache dir nichts tun. Findest du einen ganz kurzen Weg, bekommt Lumi eine Krone!',
  'hilfe/hilfe-shadows': 'Schattenrätsel. Im Dunkeln versteckt sich etwas. Fahre mit der Taschenlampe über das Bild. Was ist es? Tippe auf das richtige Bild. Tippe auf den Tipp-Knopf, dann verrät Lumi dir etwas über das Versteckte.',
  'hilfe/hilfe-bubbles': 'Blasen-Blitz. Lumi sagt dir eine Zahl. Tippe alle Blasen an, auf denen so viele Punkte sind oder die diese Zahl zeigen. Lass dir Zeit und schau genau hin.',
  'hilfe/hilfe-stories': 'Lumis Abenteuer. Lumi erlebt eine Geschichte, und Lumi liest sie dir vor. Am Ende entscheidest du: Was soll Lumi tun? Danach erfährst du, wie es weitergeht.',
  'hilfe/hilfe-sort': 'Sortier-Spaß. Lumi zeigt dir ein Ding und sagt dir, was es ist. In welchen Korb gehört es? Tippe auf den richtigen Korb.',
  'hilfe/hilfe-clock': 'Uhren-Uhr. Der kurze Zeiger zeigt die Stunde, der lange Zeiger die Minuten. Schau, wohin die Zeiger zeigen, und tippe auf die richtige Uhrzeit. Manchmal stellst du die Uhr selbst: Zieh die Zeiger oder tippe auf Plus und Minus. Und manchmal fragt Lumi, was um diese Zeit passiert.',
  'hilfe/hilfe-words2': 'Silben-Spaß. Schau auf das Bild und hör das Wort. Jedes Stück des Wortes ist eine Silbe, wie beim Klatschen: Ho, nig. Tippe die Silben in der richtigen Reihenfolge. Manchmal klatschst du mit und zählst, wie viele Silben du hörst.',
  'hilfe/hilfe-weight': 'Waage-Welt. Zwei Dinge liegen auf der Waage. Welches ist schwerer? Tippe auf die schwerere Seite. Später stehen Zahlen auf den Paketen: Die größere Zahl ist schwerer. Ganz am Ende legst du Klötze auf die Waage, bis sie gerade ist.',
  'hilfe/hilfe-rocket-math': 'Rechen-Rakete. Die Rakete hüpft auf dem Zahlenstrahl. Lumi sagt dir die Aufgabe. Tippe auf das Feld, wo die Rakete landet.',
  'hilfe/hilfe-shapes-land': 'Formen-Land. Lumi nennt eine Form. Tippe sie an! Manchmal sollst du Formen nach der Größe ordnen oder ein Muster weiterlegen.',
  'hilfe/hilfe-shape-build': 'Formen-Werkstatt. Lumi möchte etwas bauen. Tippe unten auf eine Form und dann auf den Platz im Bild, wo sie hingehört. Liegt eine Form falsch herum, tippe sie noch einmal an, dann dreht sie sich. Manchmal ist ein Teil zu viel.',
  'hilfe/hilfe-trace': 'Buchstaben-Spuren. Ein Buchstabe ist groß zu sehen. Leg deinen Finger auf den grünen Punkt und fahre den Weg nach, so wie der Pfeil zeigt. Jeder Strich hat seinen eigenen Punkt. Lumi sagt dir, wie der Buchstabe klingt.',
  'hilfe/hilfe-coloring': 'Mal-Atelier. Hier darfst du frei malen. Wähle eine Farbe und male mit dem Pinsel, oder fülle eine ganze Fläche mit dem Farbeimer. Mit dem Pfeil machst du den letzten Schritt rückgängig.',
}

/** The recording of a sentence, with its text for the browser voice. */
export function line(key) {
  const text = LINES[key]
  if (text === undefined) throw new Error('unknown Lumi line: ' + key)
  return { src: `audio/lumi/${key}.mp3`, text }
}

/** The line of a game's tile ("Zahlen entdecken. Zähle Dinge …"). */
export const gameLine = id => (LINES[`spielnamen/spiel-${id}`] ? line(`spielnamen/spiel-${id}`) : null)
/** The help of a game (the ? button). */
export const helpLine = id => (LINES[`hilfe/hilfe-${id}`] ? line(`hilfe/hilfe-${id}`) : null)
