# LumiLearn – To-do-Liste aus dem Gesamt-Audit (Oktober 2026)

Grundlage: fünf parallele Prüfungen gegen den Produktions-Build (Stand nach PR #33):

- **Optik:** 5 Bildschirmgrößen, alle Bildschirme und alle 24 Spiele in Level 1, Mitte und Maximum, 1.360 geprüfte Zustände, 1.435 Screenshots.
- **App-Rahmen:** Onboarding, Start, Level, Ergebnis, Profile, Eltern, Robustheit.
- **Drei Inhalts- und UX-Prüfungen** für alle Spiele: jeder Dateneintrag geprüft, jede Sprachausgabe mitgeschnitten.

Ergebnis: **347 Einzelbefunde** in [`befunde.json`](befunde.json), jeder mit Beleg (Datei:Zeile, Mitschnitt, Screenshot-Messung) und Korrekturvorschlag. Die IDs hinter jeder Aufgabe verweisen darauf (V = Optik, S = App-Rahmen, G1 = Sprachspiele, NI/NUM/RR/BB/WW/UU/FL/MP/LL/X = Mathe & Logik, EMO/EMP/STO/SRT/FAR/MAL/FWS/ALL = Gefühle & Kreativ).

Stichproben der schwersten Befunde wurden direkt im Code nachgeprüft (Buchstabenwald-Absturz, Rakete-Wertung, Zahlenland-Punktzahl, Nintendo-Bilder, PIN-Anzeige, localStorage, Tagesaufgaben-Zähler, Serie) – alle bestätigt.

Aufwand: **S** = Stunden, **M** = ein Arbeitstag, **L** = mehrere Tage.

---

## Stand (27.10.2026)

Phasen 0–6 sind umgesetzt: alle Aufgaben unten abgehakt. Offen oder nur teilweise erledigt:

- **Aussprache auf einem echten Gerät anhören.** Die Testumgebung hat keine Stimmen. Die Silben-Umschreibungen in `WordBuilderGame.jsx` und die Laute in `src/games/letterSounds.js` sind nur nach Schrift geprüft.
- **Zwei Stimmen** (Aufnahme oder TTS) bleiben wie vereinbart. Die Lautstärke der Sprache ist jetzt im Elternbereich einstellbar.
- **Nicht gebaut:**
  - Einzelne Spiele im Elternbereich ausblenden.
  - Fokus-Falle in Dialogen.
  - Null-Runde in „Zahlen entdecken“.
  - Wackeln der Waage vor der Antwort.
  - Bonus-Stern für kurze Wege im Labyrinth.
  - Klang-Joker im Schattenrätsel.
  - Anlauttabelle im Buchstabenwald.
- **Ideen** (unten):
  - Umgesetzt: Gefühlswelt mit großen Gesichtern, freies Bauen in der Formen-Werkstatt, Lumi kommentiert die Farben im Mal-Atelier, selbst wiegen in der Waage-Welt (Level 10), Zahlen-Paare mit Verwechslungsgefahr im Blasen-Blitz.
  - Offen: Muster selbst legen, Sortier-Regel erfinden, Formen in der Umgebung.
- **Alte Aufnahmen**, deren Text nicht mehr passt (Gefühlswelt, ABC-Merksätze), liegen noch in `public/audio`. Sie werden nicht mehr abgespielt.

---

## Phase 0 – Sofort: Abstürze, falsche Wertungen, Rechtsrisiko

- [x] **Ausmalbilder ersetzen** (L, rechtlich): alle 6 Bilder im Mal-Atelier sind offizielle Nintendo-Vorlagen (Mario, Peach, Daisy, Rosalina) mit „Play Nintendo“-Logo. Eigene Lumi-Ausmalbilder erzeugen (gpt-image-2, ein Bogen) und Bildnamen passend benennen. — V05, MAL-01, MAL-02
- [x] **Buchstabenwald stürzt ab** nach 3 verlorenen Herzen (Level 4–10): `afterNarration` wird aufgerufen, aber nicht importiert (Regression aus PR #22). Außerdem zählt Antippen der fallenden Kachel als richtig. — G1-043, G1-044 (S)
- [x] **Gefühlswelt hängt**: ein nicht gelöschter 5-s-Timer setzt die richtige Antwort zurück; Punktzahl kann die Fragenzahl übersteigen („13 von 12“). — EMO-01, EMO-02 (S)
- [x] **Rechen-Rakete wertet falsch**: beim Ergänzen („12 plus wie viel ergibt 17?“) gilt nur das Feld 17 als richtig (`t.kind === 'missing' ? t.target : t.target`); bei Minus sind „zu weit / nicht weit genug“ vertauscht; auf dem Handy sind Felder abgeschnitten und unerreichbar. — RR-01, RR-02, RR-03, V02 (M)
- [x] **Uhren-Uhr**: Tipp nach 2 Fehlern verrät die Lösung der *nächsten* Aufgaben; Stundenzeiger rastet bei „halb“/„Viertel vor“ falsch ein; Digitalanzeige beim Stellen macht die Zeiger überflüssig. — UU-01, UU-02, UU-03 (M)
- [x] **Sortier-Spaß gibt immer 3 Sterne** („Alles richtig!“ auch nach 7 Fehlern). — SRT-01 (S)
- [x] **Zahlenland** meldet eine Antwort zu viel („9 von 8“, `score + 1`); „Es sollen 2 sein.“ (Ziffer vor Punkt = „zweite“); „ein Apfel“ statt „einen Apfel“. — NUM-01, NUM-02, NUM-03 (S)
- [x] **Hörabenteuer Level 8–10**: Wort-Optionen werden bei jedem Render neu gemischt – nach jedem Fehltipp stehen andere Wörter da. — G1-052 (S)
- [x] **Blasen-Blitz verrät die Lösung**: nur die Zielblasen leuchten und haben einen Ring. — BB-01 (S)
- [x] **Hilfe-Dialog pausiert das Spiel nicht** (Blasen steigen weiter und werden über dem Dialog gezeichnet). — S17 (S)
- [x] **Weiße App bei gesperrtem localStorage** (MusicControls liest ohne try/catch); voller Speicher verliert den Spielstand still. — S44, S45 (S)
- [x] **Emoji-Plugin erfasst `motion.*` nicht**: 483 Stellen (Musik-Knopf, Avatare, Gefühlswelt-Gesichter, Schattenrätsel, Musterpark …) zeigen noch System-Emoji, obwohl 238 von 240 Pixel-Bilder existieren; 🃏 und 🌅 fehlen. — V07, G1-066 (S)
- [x] **Fehlende Aufnahme → Ersatztext doppelt gesprochen** (`onFail` hängt an error-Ereignis und an `play().catch`). — G1-077 (S)
- [x] **Silben-Spaß** schneidet die zuletzt gelegte Silbe nach festen 600 ms ab. — G1-035 (S)

## Phase 1 – Für Nichtleser spielbar machen (Sprache)

Das größte übergreifende Problem: die App ist für Leser gebaut. Ein Kind von 4–7, das nicht liest, weiß in vielen Spielen nicht, was zu tun ist.

- [x] **Jede Aufgabe beim Rundenstart sprechen** – fehlt in Silben-Spaß, Schattenrätsel, Memo-Welt, Buchstabenwald, Hörabenteuer, Zahlen entdecken (Aufnahmen existieren ungenutzt), Gefühlswelt („Wie fühlt sich Lumi wohl?“ liegt als mp3 vor). — G1-032, G1-045, G1-054, G1-059, G1-070, NI-02, EMO-05 (M)
- [x] **Gemeinsamer Lob-/Hinweis-Baustein** und gesprochene Rückmeldung nach jeder Antwort – fehlt in 5 von 9 Mathe-Spielen (Waage, Uhr, Blasen, Musterpark, Zahlen entdecken), ABC-Abenteuer, Gefühlswelt (falsche Antwort), Buchstabenwald. Bei Fehlern die richtige Lösung zeigen und sagen. — X-01, WW-08, UU-04, BB-03, MP-01, NI-03, G1-011, EMO-04, G1-046 (M)
- [x] **Lumis Abenteuer vorlesen**: Geschichten, Frage und Antworten werden nie gesprochen – auf dem Tablet unspielbar. — STO-01 (M)
- [x] **Optionen auf dem Tablet hörbar machen**: HearOptions dort einsetzen, wo es fehlt (Gefühlswelt importiert es, nutzt es aber nicht), Sortier-Gegenstände benennen, Farbnamen in Farbenreich sprechen, Formnamen in Formen-Werkstatt, Mal-Atelier begleiten. — EMO-03, SRT-02, FAR-01, FWS-01, MAL-05, EMP-06 (M)
- [x] **Hilfe „?“ vorlesen** und für die 7 Spiele ohne eigenen Text schreiben (initial-sound, rhyme, rocket-math, shapes-land, coloring, empathy, shape-build); veraltete Texte korrigieren (Blasen „steigen auf“, Labyrinth „Edelsteine/Schloss“, Zahlen entdecken „zähle laut“). — S16, G1-022, G1-075, RR-07, FL-05, ALL-02, BB-05, LL-02, NI-06 (M)
- [x] **Onboarding und Startseite sprechen**: Willkommen, Sprache, Profil, Spielkacheln beim Antippen/Darüberfahren, Kategorien, Tagesaufgaben, Level-Auswahl. — S01, S06, S08, S10 (M)
- [x] **Silben richtig vertonen**: isolierte TTS-Silben klingen falsch („Che“ → „Tsche“, „Cher“ → „Schär“, „Vier“ als Zahl, „Cke“). Silben einmal einsprechen lassen (Aufnahme) oder phonetische Schreibweise für die TTS hinterlegen; das ganze Wort am Ende sprechen. — G1-034 (M)
- [x] **Anlaut-Detektiv spricht Laute statt Buchstabennamen**; Wort erst nach dem Lösen zeigen (sonst löst man es durch Buchstabenvergleich ohne Hinhören). — G1-018, G1-019, G1-023 (M)
- [x] **cleanText verstümmelt Sonderzeichen**: „×“, „/“, „:“, „km/h“ werden ersatzlos gelöscht („Frösche können 20 ihre Körpergröße springen“). Vorher in Wörter umwandeln. — G1-062, G1-074 (S)
- [x] **Rückkehr-Begrüßung** abwechslungsreicher; die vorhandene Aufnahme „Willkommen zurück“ nutzen. — S07 (S)

## Phase 2 – Inhalte bereinigen (Daten)

Alle Einträge mit Korrektur stehen in `befunde.json`.

- [x] **Bilder, die nicht das Wort zeigen** (über 30 Fälle), u. a.:
  - 🪑 für „Tisch“ in 4 Spielen
  - 🦔 für „Eichhörnchen“
  - 🥛 für „Joghurt“
  - 🎹/🎼 für „Xylofon“
  - 🪁 als „Schleuder“
  - 🍐 für „Wassermelone“
  - 🫃 für „Bauch“
  - 💦 für „Wasserfall“
  - 🐉 als „Drachen“ statt „Drache“
  - Silben-Spaß: KÜCHE 🍳, BRUDER 👦, Seepferdchen 🐠, Staubsauger 🌀 …

  Pro Wort ein eindeutiges Bild, kein Bild doppelt in einer Runde, fehlende Bilder (Tisch, Joghurt, Xylofon …) mit gpt-image-2 nachgenerieren. — G1-001…006, G1-017, G1-026, G1-027, G1-036, G1-037, G1-049, G1-055, G1-056, V26 (M)
- [x] **Doppelte Bilder in einer Runde ausschließen** (Eule/Uhu 🦉, Ente/Quaken 🦆, Traum/Schlaf 💤): Distraktoren nach Bild filtern, nicht nur nach Wort. — G1-002, G1-009, G1-025 (S)
- [x] **Laut ≠ Buchstabe**:
  - „Vogel“ unter V entfernen.
  - In ABC-Abenteuer beginnen 5 von 6 S-Wörtern mit /ʃ/, obwohl der Merksatz „S zischt“ lautet.
  - „Pferd“ = /pf/.
  - V-Merksatz und Beispiele widersprechen sich.

  — G1-007, G1-008, G1-016, G1-020 (S)
- [x] **Waage-Welt-Daten**:
  - Fehlerhafte Paare korrigieren: Diamant 12 vs. Teddy 4, Gitarre vs. Akkordeon, Softeis vs. Croissant.
  - Linke Seite zufällig wählen (sie ist in 45 von 50 Paaren schwerer – immer links tippen gibt 3 Sterne).
  - Ab Level 3 neutrale Pakete statt echter Gegenstände mit Zufallsgewichten („Auto 2 kg“).
  - Bei Gleichstand nicht links gewinnen lassen.
  - Keine Multiplikation in Level 10.

  — WW-01…07, WW-10, WW-11 (M)
- [x] **Gefühlswelt-Szenarien**:
  - Mehrdeutige Distraktoren entfernen: Stolz/Glücklich, Aufgeregt/Ängstlich, Eifersüchtig/Wütend, Müde/Gelangweilt.
  - Sprachfehler und Anglizismen korrigieren („Goldfish“, „vom Zahnfee“, kaputte Sätze, „ein bisschen mulmig“).
  - Antwort nicht im Aufgabentext verraten.
  - Gefühle nie mit rotem ❌ als „falsch“ markieren.

  — EMO-09…24 (M)
- [x] **Gefühlsdetektiv**:
  - Ähnliche Gefühle nicht als falsch werten (stolz/fröhlich, einsam/traurig).
  - „Das ist nett.“ nicht nach unfreundlichen Antworten.
  - Kein Fehlerton für freundliche Hilfe.
  - Text und Zeichnung angleichen (Ben steht/sitzt).
  - Die „du“-Figur nicht jubeln lassen neben einem weinenden Kind.

  — EMP-01…07, EMP-10 (M)
- [x] **Lumis Abenteuer**:
  - „Die gefälschte Note“ ersetzen (ungeeignet).
  - Portemonnaie-Geschichte entwirren.
  - Fremdes Kätzchen nicht mitnehmen lassen.
  - „ever“, „1 Münze“ und Pronomen korrigieren.

  — STO-03…14 (M)
- [x] **Sortier-Spaß**:
  - Falsch oder mehrdeutig einsortierte Gegenstände korrigieren: 🎪, 👓, 🫙, 🎯🪓🏘️, 🦈, 🌊, 🐟🐦🐰 als Haustiere, 🦊, 🍅.
  - Gerade/Ungerade bis 24 ist zu schwer.
  - Die Stufen sind unlogisch angeordnet.
  - Neuere Emoji werden mit den Pixel-Bildern ohnehin ersetzt.

  — SRT-04…16 (M)
- [x] **Schattenrätsel**:
  - Falsche Fakten korrigieren: „Giraffe größtes Tier der Welt“, Wolf und Mond, Dampflok-Jahr.
  - Nicht unterscheidbare Silhouetten-Paare austauschen (Zebra/Pferd, Panda/Bär, ✈️/🛩️).
  - Silhouette darf ohne Taschenlampe nicht sichtbar sein.

  — G1-060, G1-061, G1-063, G1-064, G1-065 (S)
- [x] **Buchstabenwald-Wortlisten**:
  - Nicht-Wörter und ungeeignete Wörter entfernen: SANDBURGREITER, NACHTSTIMMUNG, DRÜSE, SAG.
  - „0 von 0 Wörtern“.

  — G1-048, G1-050 (S)
- [x] **Memo-Welt**: Assoziationspaare prüfen (📚–🤓 „Streber“-Klischee), 104 nie genutzte Emoji, englisches „MATCH!“. — G1-069, G1-071 (S)
- [x] **Farbenreich**:
  - Pinguinbauch soll weiß sein, nicht grau.
  - Weiß auf weißem Grund ist unsichtbar.

  — FAR-04, FAR-06 (S)
- [x] **Formen-Werkstatt**: Raketenflossen und Blume geometrisch sauber; Blütenblatt und Mitte deutlich unterschiedlich groß. — FWS-02, FWS-07 (S)
- [x] **Lumi festlegen**: Pronomen (Text nutzt teils „er/sein“), Gestalt (in Geschichten 🦊, sonst Küken-Sprite) – einheitlich entscheiden und überall angleichen. — ALL-01, EMO-22, STO-07 (S, Entscheidung nötig)

## Phase 3 – Optik und Layout

- [x] **Abgeschnittene Inhalte in den 7 Spielen ohne FitBox** (NO_SCALE):
  - Schattenrätsel: Antworten 222 px unter dem Rand am Desktop, auf dem Tablet quer unspielbar.
  - Uhren-Uhr: Antworten und „Fertig“ fehlen.
  - Farbenreich: Farbeimer abgeschnitten.
  - Mal-Atelier und Zahlenland: Knöpfe unter dem Rand auf 360 px.
  - Zahlenland: Einkaufswagen ragt über den Rand.

  — V01, V03, V04 (M)
- [x] **Restliche Bildschirme im alten Design**:
  - Sprachauswahl, Profil erstellen, „Wer spielt?“, Elternbereich, PIN-Pad, Profil-Umschalter (aktive Zeile, kaputtes Avatar-Raster).
  - Kachelköpfe und „Alle“-Filter in #6C63FF.
  - Lila in Sortier-Spaß und Uhr.
  - Weiche Glows in den Hilfe-Dialogen.

  — V08, V09, V10, V12, V15, V16, V17 (M)
- [x] **Kontrast**:
  - Gelbe und orange Wörter auf Pergament (Zahlenland 1,35:1, ABC-Buchstaben, Sortier-Kategorien).
  - Weiß auf `--px-green` nur 2,2:1 – Grün abdunkeln oder dunkle Schrift.
  - Kleine Hinweistexte zu blass.

  — V18, V19, V20, S49 (S)
- [x] **Memo-Welt-Merkphase ohne abgedunkeltes Overlay** – die Karten sind kaum zu sehen. — V06, G1-073 (S)
- [x] **Startseite**:
  - Hof-Tiere über dem Profil-Sheet (`.farm-scene` ohne Stacking-Kontext).
  - Sticky-HUD scrollt weg (`overflow-x: hidden` → `clip`).
  - Kein einziges Spiel ohne Scrollen sichtbar am Desktop.
  - Mobil-CSS `.home-bg [style*="grid"]` zwingt fremde Raster auf 2 Spalten.

  — V13, V14, S05, S39 (S)
- [x] **Tap-Ziele ≥ 44 px**: Buchstabenwald-Tastatur, Rakete-Felder, Mal-Atelier (12–32 px), Uhr ± (38 px), 🔊-Knöpfe, Filter. — V22, MAL-04, UU-08 (M)
- [x] **Musik-Knopf** überdeckt Bedienelemente (Farbenreich „Rot“, Mal-Atelier „Fertig“) – in die HUD-Leiste verlegen. — V23, S19, MAL-10 (S)
- [x] **Spieltitel im HUD abgeschnitten** auf dem Handy (22 von 24) – kürzere Titel, Schrift skalieren oder Titel weglassen. — V21, S18 (S)
- [x] **Leere Flächen und winzige Bilder**: Formen-Land, Anlaut-Detektiv nutzen nur ein Drittel der Fläche; Musterpark-Antworten nur 18 px groß. — V24, V25, MP-04 (S)
- [x] **Ergebnis**: „7 von 7 richtig“ bei 1 Stern widersprüchlich; Überschrift wechselt nach 1,4 s zufällig; Scrollen auf 360 px. — V27, S20, S22, V28 (S)
- [x] Kleinere Punkte:
  - Level-Pips brechen einzeln um.
  - Kategorie-Leiste scrollt unsichtbar.
  - Lucide-Line-Icons im Pixel-Look.
  - ▶ als Schriftzeichen.
  - Lumi wirkt in der Gefühlswelt entsättigt.

  — V29–V37 (S)

## Phase 4 – Spiele sinnvoller machen (Didaktik, Schwierigkeit)

- [x] **Echte Schwierigkeitsstufen statt nur mehr Optionen**:
  - Anlaut, Reim, Hörabenteuer, Gefühlsdetektiv (Level 4–10 identisch).
  - Formen-Werkstatt (keine Drehung, keine Distraktor-Teile).
  - Silben-Spaß (je 2 Level teilen eine Wortliste).
  - Zahlen entdecken (Zähler verrät das Ende).
  - Musterpark (L4 = L5).

  Höchstens 8–10 Runden pro Level (ABC-Abenteuer Level 5 hat 26 Runden, rund 6 Minuten).

  — G1-010, G1-021, G1-029, G1-040, EMP-08, FWS-03, NI-05, MP-07, STO-15, EMO-26 (L)
- [x] **Blasen-Blitz ehrlich machen**: Punktmengen statt Ziffern (dann stimmt „Subitizing“) oder sciTag ändern; 3 Fehler beenden nicht das ganze Spiel; kein Zeitdruck in Level 1. — BB-02, BB-04 (M)
- [x] **Uhren-Uhr**:
  - Level 9–10: die richtige Antwort ist die einzige Nicht-5er-Zeit.
  - Level 7–10 sind zu schwer.
  - Der Tagesablauf ist immer derselbe.

  — UU-05, UU-06, UU-07 (M)
- [x] **Formen-Land**: Musterlösung ist immer das erste Element; irreführender Größen-Hinweis. — FL-01, FL-02 (S)
- [x] **Musterpark**: zweiter Versuch nach Fehler; „Lücken-Muster“ verständlich formulieren; Dino-Szene lenkt ab. — MP-02, MP-03, MP-05 (M)
- [x] **Silben-Spaß**: phonologisches Silbenbewusstsein üben (Klatschen, Silben hören), nicht nur Silben lesen. — G1-033 (M)
- [x] **Hörabenteuer-Lese-Modus**: Zielwort nicht vorsprechen (sonst ist es keine Lesestufe). — G1-053 (S)
- [x] **Memo-Welt**: Regelwechsel zu Assoziationspaaren ab Level 5 erklären und benennen. — G1-068 (S)
- [x] **Lumis Abenteuer**: Moral nicht mit Sternen benoten; echte Dilemmata; Gefühlsfragen in der Geschichte. — STO-02, STO-16, STO-17 (M)
- [x] **Farbenreich**: Antippen füllt die Fläche (statt 90 % wischen); Rückmeldung bei falscher Farbe; Anleitung stimmt mit Bedienung überein. — FAR-02, FAR-03, FAR-07 (M)
- [x] **Sortier-Spaß**: Körbe und Gegenstände direkt antippbar (Hinweise sprechen von Pfeiltasten). — SRT-03 (S)
- [x] **Mal-Atelier**: Rückgängig; Rückfrage vor „Neu“/„Album leeren“; Album pro Profil und in voller Größe; keine Level-Sperre für Ausmalbilder. — MAL-03, MAL-06, MAL-08 (M)
- [x] **Labyrinth**: Hinweis, wenn Lumi ohne alle Tränke am Ausgang steht; größere Felder auf dem Handy; nach einem Treffer nicht zurück zum Start. — LL-01, LL-03, LL-04 (S)
- [x] **Zahlenland**: „Zurücklegen“ nimmt von der richtigen Ware; Zähler-Badges nehmen das Zählen ab; Untertitel „Rechnen“ stimmt nicht. — NUM-04, NUM-05, NUM-06 (S)
- [x] **Rechen-Rakete**: hörbares Mitzählen beim Hüpfen; nach Fehlern vorfliegen. — RR-04, RR-05 (S)
- [x] **Einheitliche Sterne-Logik** über alle Spiele (heute mal Fehlversuche, mal richtige Antworten, mal Runden). — G1-076, ALL-03, NUM-06 (M)

## Phase 5 – Belohnung, Fortschritt, Struktur

- [x] **Hof wächst ab Tag 1**: das erste Tier erscheint heute erst nach 3 gemeisterten Spielen (≈ 30 erfolgreiche Runden). Tiere an Sterne oder Tagesaufgaben koppeln und ansagen. — S26, S25, S32 (M)
- [x] **Tagesaufgaben pro Kind und Tag** speichern (heute sitzungsweit global, Geschwister erben sie, nach Neuladen weg); **Serie zählt Spielen, nicht App-Öffnen**; Hof-Feier nicht beim Profilwechsel; Level-Setzen im Elternbereich hebt „gemeistert“ nicht auf. — S27, S28, S29, S30, S31 (M)
- [x] **Faire Rückmeldung**: 1 Stern = bestanden, aber Text „Üb weiter!“; nach 0 Sternen ein leichteres Angebot statt nur „Nochmal“. — S22, S23, S24 (S)
- [x] **Weniger Auswahl, schneller ins Spiel**: 24 Spiele gleichzeitig überfordern; oben 3–6 Empfehlungen (Alter nutzen – es wird abgefragt, aber nie verwendet), Rest in Themenwelten; Hof kompakter. — S52, S05, S03, S13 (L)
- [x] **Onboarding kürzen** (heute 5 Schritte, mind. 7 Taps + Tastatur). — S02, S04 (S)
- [x] **Versehentliches Verlassen verhindern**: kindgerechte Rückfrage beim Zurück-Pfeil, Browser-Zurück über die History, Pull-to-refresh unterbinden. — S15, S47 (S)

## Phase 6 – Eltern, Robustheit, Performance

- [x] **Elternbereich schützen**: „Standard: 1234“ nicht im PIN-Dialog anzeigen; Profile löschen nur mit PIN; „Reset“ mit Rückfrage. — S34, S35, S36 (S)
- [x] **Elternbereich nützlicher**:
  - Spielzeit und Übersicht über alle Kinder.
  - Einstellungen für Sprache, Stimme, Zeitlimit.
  - Texte korrigieren: „1 Tage Streak“, „Münzen“, abweichende Spielnamen.

  — S37, S38, V11, S51 (M)
- [x] **„English“** ist nur eine Fassade (Startseite, Spiele, Ergebnis bleiben deutsch) – entweder vollständig übersetzen oder die Option entfernen; Sprache später änderbar machen. — S50 (M/L, Entscheidung nötig)
- [x] **Ladegewicht**: Startseite lädt 5,3 MB (Musik 2,9 MB wird sofort geladen, auch wenn sie aus ist; Hof-Bild 1,6 MB) – Musik erst bei Bedarf laden, Bilder verkleinern. — S53, S54 (S)
- [x] **Offline**: Kachel-Tap lädt kommentarlos neu, danach „Fehler im Spiel“ – freundliche Offline-Meldung. — S46 (S)
- [x] **Zwei Stimmen** (Aufnahme vs. TTS) in Gefühlswelt und Startseite – laut Absprache vorerst so lassen; Lautstärke der Sprache einstellbar machen. — EMO-07, S41, S42 (niedrig)
- [x] Toter Code: `gameEngine.js numbersQ`, `seenEmotions`, Farbenreich `region.label`. — MP-08, EMO-27, FAR-05 (S)

## Ideen für später

- **Gefühlswelt:** große Gesichter mit 🔊 als Optionen, „Und du? Wie würdest du dich fühlen?“, Gefühle-Album. — EMO-28
- **Formen-Werkstatt:** freies Bauen, und Lumi rät, was es ist. — FWS-06
- **Mal-Atelier:** Lumi kommentiert das Bild mit Farbwörtern. — MAL-11
- **Waage-Welt:** selbst wiegen statt nur vorhersagen. — WW-13
- **Musterpark:** Muster selbst legen. — MP-09
- **Sortier-Spaß:** das Kind erfindet die Regel. — SRT-17
- **Formen-Land:** Formen in der Umgebung entdecken. — FL-06
- **Blasen-Blitz:** Zahlen-Paare mit Verwechslungsgefahr (12/21, 6/9). — BB-07
