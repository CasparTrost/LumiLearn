# Spielideen: Lernen, das sich wie Spielen anfühlt

Vorbild ist das Gefühl guter Kindersendungen und ihrer Spiele-Apps: Figuren, die etwas wollen, Witz, Überraschungen und eine Welt, die auf jedes Antippen antwortet. Figuren, Namen und Aussehen dieser Sendungen übernehmen wir nicht.

## Leitideen für alle Spiele

1. **Eine Figur will etwas, das Kind hilft.** Die Aufgabe ist kein Test, sondern ein Gefallen.
   - Statt „Wie viele sind es? A/B/C“ heißt es „Bruno hat Hunger auf drei Äpfel!“, und das Kind füttert ihn.
   - Kinder strengen sich für eine Figur, die sie mögen, mehr an und lernen von ihr mehr (Calvert et al. 2014; Gola et al. 2013).
2. **Hände statt Knöpfe.** Das Kind zieht, füttert, wirft ein, baut und sortiert.
   - Dinge an ihren Platz zu bringen, ist das Spiel von Vier- bis Siebenjährigen. Handeln mit Objekten unterstützt das Verstehen (Embodied Cognition; Hirsh-Pasek et al. 2015: „active, engaged, meaningful, socially interactive“).
   - Jede Ziehen-Aufgabe geht auch durch Antippen. Wer nicht ziehen kann oder mag, kommt genauso weiter.
3. **Alles antwortet.** Figuren kichern, wenn man sie antippt. Die Sonne lacht, Blumen hüpfen bei jedem Erfolg.
   - Ein Fehler ist lustig, nie peinlich. Die Figur spuckt die Socke wieder aus („Bäh, Socken schmecken nicht!“), statt dass ein rotes X erscheint.
4. **Die Antwort ist die Belohnung.** Was richtig ist, wird lebendig: die gebaute Rakete fliegt los, der Kunde zahlt, das Reimpaar spielt eine kleine Szene.
   - Keine Punkte-Flut, keine Lootboxen (Deci, Koestner & Ryan 1999).
5. **Gleiches Lernziel, gleiche Levels.** Die Lernlogik, die Inhalte und die Steigerung über die Levels bleiben. Ebenso die Auswertung: erste Antwort richtig, `lib/score.js`, Leitner-Wiederholung.
   - Neu ist, *wie* gespielt wird.

## Der Baukasten (`src/components/play/`)

| Teil | Was er tut |
|---|---|
| `Scene` | Lebendiger Hintergrund je Welt: Wiese, Meer, Nacht, Weltraum, Zimmer, Wald, Markt, Teich. Jubelt bei richtigen Antworten mit. Im Spielrahmen automatisch (`modules.js` → `scene`). |
| `Critter` | Eine Figur, gebaut aus einem der Bilder in `public/sprites/emoji/`, oder Lumi. Hat die Stimmungen idle, talk, hungry, eat, happy, dance, sad, oops, wow und sleep. Zeigt in einer Sprechblase (`wish`), was sie sich wünscht. Kichert beim Antippen. |
| `DragArea` / `Draggable` / `DropZone` | Ziehen und Ablegen mit dem Finger, als Tippen-dann-Tippen oder mit der Tastatur. Mit `autoTarget` genügt ein Tipp. |
| `RoundTrail` | Fortschritt als kleiner Weg: Eine Figur hüpft pro Aufgabe einen Stein weiter bis zum Ziel. |
| `useBursts` | Sterne, Herzen oder Konfetti an der Stelle, wo der Finger war. |
| `sfx` | Neue Spielzeug-Geräusche: boing, chomp, giggle, whoosh, splash, slideUp, slideDown, drum, burp, tada und sparkle. |

## Die Spiele

### Zahlen-Welt

**Zahlen entdecken: „Bruno hat Hunger“** (`NumberIntroGame`)
- **Bisher:** Ziffer ansehen, dann Äpfel antippen und „Fertig“ drücken.
- **Neu:** Ein Bär (oder ein anderes Tier je Zahl) hält ein Schild mit Ziffer und Punkten hoch: „Ich hab Hunger auf DREI Erdbeeren!“
  - Das Kind füttert ihn. Jeder Bissen wird laut mitgezählt („eins … zwei … drei“), und der Bauch wird runder.
  - Bei genau richtig: ein kleiner Rülpser, ein Kichern, ein Tanz.
  - Bei zu viel: „Uff, ich bin pappsatt!“ Die letzte Erdbeere kullert zurück. Mitzählen und Eins-zu-eins-Zuordnung bleiben der Kern.
- **Später:** Die Zahl kommt nur gesprochen oder nur als Ziffer. Zwei Tiere wollen verschiedene Mengen.

**Zahlenland: „Lumis Obststand“** (`NumbersGame`)
- **Bisher:** ein Kunde, eine Bestellung, Obst antippen.
- **Neu:** Tierkunden stellen sich am Marktstand an. Jeder sagt, was er möchte („Vier Zitronen bitte!“, in der Sprechblase als Bild mit Zahl).
  - Das Kind legt das Obst in den Korb des Kunden, jedes Stück wird mitgezählt. Der Kunde zahlt mit Münzen, die klimpern, und watschelt glücklich davon. Der Nächste kommt.
  - Ist es falsch, schaut der Kunde in den Korb und zählt nach: „Hm, das sind fünf, ich wollte vier.“
- **Später:** zwei Sorten pro Bestellung, „noch zwei mehr“, Bezahlen abzählen.

**Blasen-Blitz: „Kraken-Party“** (`BubblePopGame`)
- **Bisher:** Blasen mit Punkten antippen.
- **Neu:** Unter Wasser wünscht sich ein Krake Blasen mit genau drei Punkten. Jede richtige Blase platzt, und ein Stern schwimmt zum Kraken, der damit jongliert.
  - Eine falsche Blase wird zum Kugelfisch, der sich aufbläst und beleidigt davonschwimmt. Das ist lustig, aber nicht hart. Serien lassen den Kraken tanzen.

**Waage-Welt: „Die Wippe“** (`WeightGame`)
- **Bisher:** eine Waage mit zwei Dingen; das Kind tippt das Schwerere an.
- **Neu:** Auf dem Spielplatz wollen zwei Dinge oder Tiere wippen. Das Kind tippt, wer nach unten geht.
  - Dann kippt die Wippe mit Schwung, und das Leichte fliegt mit „Huiii!“ ein Stück hoch und plumpst zurück.
  - Erst schätzen, dann sehen: Vorhersagen und Überprüfen ist der Kern des Naturforschens im Vorschulalter.
- **Später:** Dinge auf die Wippe legen, bis sie gerade ist.

**Uhren-Uhr: „Kuckucks-Uhr“** (`ClockGame`)
- **Bisher:** Uhr ablesen, vier Knöpfe.
- **Neu:** Ein Kuckuck will um eine bestimmte Zeit herauskommen („Um drei Uhr gibt es Kuchen!“). Das Kind *dreht die Zeiger* selbst mit dem Finger.
  - Ist die Zeit erreicht, springt der Kuckuck heraus, ruft „Kuckuck!“ so oft wie die Stunde, und der Kuchen erscheint.
  - Zwischendurch läuft es umgekehrt: Die Uhr zeigt eine Zeit, das Kind wählt, was dann passiert (Bild).

**Rechen-Rakete: „Planeten-Taxi“** (`RocketMathGame`)
- **Bisher:** Rechnung, Zahlenstrahl, Feld antippen.
- **Neu:** Ein Alien winkt auf Planet 5 und will abgeholt werden. Die Rakete steht bei 4, die Rechnung heißt 4 + 1.
  - Das Kind tippt das Zielfeld an. Nach Countdown und Start hüpft die Rakete Feld für Feld mit Mitzählen. Das Alien steigt ein und jubelt.
  - Daneben liegt die Rechnung als Klötzchen. Minus heißt rückwärts fliegen.

### Buchstaben-Welt

**ABC-Abenteuer: „Buchstaben-Monster“** (`LetterIntroGame`)
- **Bisher:** Buchstabe mit Wort, dann „Welches Wort beginnt mit A?“ mit drei Kärtchen.
- **Neu:** Jeder Buchstabe ist ein Monster mit Augen und Mund. Es sagt seinen Laut („Aaa wie Affe!“) und hat Hunger nur auf Dinge mit seinem Anlaut.
  - Das Kind füttert es. Ein falsches Ding spuckt es aus: „Bäh! Banane fängt mit B an!“

**Hörabenteuer: „Versteckspiel“** (`ListenGame`)
- **Bisher:** Wort hören und Bild antippen.
- **Neu:** Hinter Büschen gucken Tiere und Dinge ein Stück hervor. Lumi ruft ein Wort, das Kind tippt den richtigen Busch an, und das Gesuchte hüpft lachend heraus.
  - In höheren Levels sieht man die Dinge zuerst kurz, dann verstecken sie sich ganz. Das ist Hören plus Merken.

**Anlaut-Detektiv: „Anlaut-Angeln“** (`InitialSoundGame`)
- **Bisher:** Bild ansehen, Buchstaben wählen.
- **Neu:** Am Teich hält ein Eimer-Frosch ein Schild mit einem Buchstaben: „Ich will Sachen mit M!“ Fische schwimmen mit Bildern vorbei.
  - Das Kind angelt den richtigen Fisch per Antippen: Die Angel fällt, der Fisch zappelt am Haken und plumpst mit Platsch in den Eimer.
  - Falsche Fische winken und tauchen weg.
- **Andere Runden:** Ein Bild wird geangelt, und das Kind wirft es in den Eimer mit dem passenden Buchstaben.

**Reim-Rallye: „Reim-Theater“** (`RhymeGame`)
- **Bisher:** Wort hören, Reimwort antippen.
- **Neu:** Im Kasperle-Theater steht eine Figur auf der Bühne (Maus). Reimkandidaten schweben an Luftballons herein, und das Kind zieht den richtigen auf die Bühne (Haus).
  - Dann spielen beide eine Unsinnsszene: „Die Maus im Haus!“ Die Maus klettert ins Haus, das Publikum lacht.
  - Unsinnsreime sind das, was Kinder an Reimen lieben, und sie schärfen das Hören auf Laute.

**Buchstabenwald: „Zauberkessel“** (`TyperGame`)
- **Bisher:** Wort schreiben mit einer Tastatur aus Bildern.
- **Neu:** Eine kleine Hexe (Lumi mit Hut) braut: Das Kind tippt Buchstaben, die in den Kessel fliegen und blubbern.
  - Ist das Wort fertig, macht es *Puff*, und das Ding erscheint lebendig: Die KUH muht, der BALL hüpft.
  - Ein falscher Buchstabe färbt den Dampf kurz lila, und die Hexe hustet lustig.

**Silben-Spaß: „Frosch-Hüpfen“** (`WordBuilderGame`)
- **Bisher:** Silben klatschen, 1, 2 oder 3 Hände wählen.
- **Neu:** Ein Frosch will über den Teich. Er hüpft pro Silbe einen Seerosen-Stein weit, und das Kind spricht und klatscht mit („Ba – na – ne“).
  - Das Kind wählt den Weg mit der richtigen Zahl an Steinen. Bei zu wenig Steinen landet der Frosch platschend im Wasser und probiert es nochmal.
  - In höheren Levels baut das Kind Wörter aus Silben-Steinen.

**Buchstaben-Spuren** (`TraceGame`)
- **Bisher:** fertig umgebaut.
- **Neu:** Die Spur funkelt. Ist der Buchstabe fertig, bekommt er Augen, hüpft, und das Beispielding erscheint daneben.

### Knobel-Welt

**Schattenrätsel** (`ShadowGame`)
- **Bisher:** Die Taschenlampe gibt es schon.
- **Neu:** Gefundene Tiere winken, das Licht geht an, und der Raum wird bunt.

**Memo-Welt: „Tierparty“** (`MemoryGame`)
- **Neu:** Aufgedeckte Karten geben einen Laut, und das Tier bewegt sich. Ein gefundenes Paar umarmt sich und tanzt auf eine Partywiese am Rand.
  - Am Ende feiern alle zusammen.

**Musterpark: „Tierparade“** (`ChoiceGame`)
- **Bisher:** Muster mit Lücke, vier Kärtchen.
- **Neu:** Tiere marschieren im Takt in einer Parade (Frosch, Hund, Frosch, Hund, …). Ein Platz ist leer.
  - Das Kind zieht das richtige Tier in die Lücke, und die Parade marschiert mit Trommel weiter.
  - Bei einem falschen Tier stolpert die Parade lustig.
- **Bau-Runden:** Das Kind setzt die ganze Fortsetzung selbst.

**Sortier-Spaß: „Wer isst was?“** (`SortGame`)
- **Bisher:** Ein Ding, zwei Kategorie-Kästen.
- **Neu:** Kategorien sind Figuren mit Hunger. Der Hase will nur Gemüse, der Spielzeugkorb (ein Monster mit Mund) nur Spielzeug.
  - Dinge kommen auf einem Förderband, das Kind füttert die richtige Figur. Falsch heißt: „Bäh, das ist doch kein Gemüse!“, und das Ding fliegt zurück.

**Lumi-Labyrinth** (`MazeGame`)
- Ist schon ein echtes Spiel. Es bekommt den Bühnen-Rahmen, sonst bleibt es.

**Formen-Land: „Formen-Suchbild“** (`ShapeLandGame`)
- **Bisher:** Drei Formen; das Kind tippt die gesuchte.
- **Neu:** Ein Wimmelbild, zum Beispiel eine Straße mit Haus, Rädern, Sonne und Fenstern, alles aus Formen.
  - „Finde alle Kreise!“ Jeder gefundene Kreis leuchtet auf und kichert, das Rad dreht sich, die Sonne lacht.
  - Formen im Alltag zu entdecken ist Formen-Lernen, wie es Kinder wirklich brauchen.

**Formen-Werkstatt** (`ShapeBuildGame`)
- **Bisher:** Formen in eine Umriss-Vorlage tippen.
- **Neu:** Das Kind zieht die Formen in den Umriss. Ist das Ding fertig, wird es lebendig: Die Rakete startet, das Boot segelt, das Haus macht Licht an.

### Gefühle-Welt

**Gefühlswelt: „Wie geht's dir, Lumi?“** (`EmotionGame`)
- **Bisher:** Text-Szene, zwei Gefühls-Knöpfe.
- **Neu:** Die Szene passiert vor den Augen des Kindes. Der Ballon platzt, das Geschenk kommt, der Hund leckt das Gesicht.
  - Das Kind wählt das passende Gesicht, und Lumi macht es nach.
  - Dazu kommt eine freiwillige Spiegel-Runde: „Mach das Gesicht auch!“ Das wird nicht bewertet.
  - Gefühle am Gesicht und an der Situation zu erkennen ist der Kern der Emotionserziehung (PATHS, Domitrovich et al. 2007).

**Gefühlsdetektiv: „Freunde trösten“** (`EmpathyGame`)
- **Neu:** Ein Freund ist traurig, weil sein Eis heruntergefallen ist; die Szene wird gezeigt. Das Kind wählt, wie es hilft, und zieht etwas zu ihm: Taschentuch, Umarmung oder teilen.
  - Die Figur wird sichtbar froh, die Farbe kommt zurück, und sie bedankt sich.
  - Freundliche Antworten werden nie mit „falsch“ bestraft.

**Lumis Abenteuer** (`StoryGame`)
- **Neu:** Bildergeschichten mit Bühne und Figuren statt Textkarten. Entscheidungen zeigen sichtbare Folgen.

### Mal-Welt

**Farbenreich: „Malerauftrag“** (`PainterGame`)
- **Neu:** Eine Figur wohnt im Haus und wünscht sich: „Ich möchte ein ROTES Dach!“ Das Kind malt, und die Figur freut sich und zieht ein.

**Mal-Atelier** (`ColoringGame`)
- Freies Malen bleibt frei. Es bekommt den Bühnen-Rahmen.

## Startseite

- **Weg:** Hof, Lernweg und Missionen sind entfernt. Die Startseite war zu voll.
- **Neu:** Eine lebendige Welt mit einem großen „Spielen!“-Knopf. Dahinter steht Lumis Vorschlag, den das Lerngedächtnis aussucht: fällige Wiederholung, das Spiel, in dem das Kind steckt, oder etwas Neues.
- **Darunter:** Die Welten mit ihren Spielen als hüpfende Bilder. Jede Welt liegt auf ihrer eigenen Bühne.
- **Belohnung:** Sticker gibt es als Überraschung nach geschafften Spielen.
- **Bewegungspause:** Nach etwa zehn Minuten Spielzeit schlägt Lumi eine Pause vor.
