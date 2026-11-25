# Game-Konzepte: aus jedem Lernspiel ein echtes Spiel

Stand: November 2026. Dieses Dokument ist die Vorlage für den Umbau aller
24 Spiele. Es ersetzt für die genannten Spiele die Ideen in `spielideen.md`.

## Befund

Fast jedes Spiel folgt demselben Muster: Eine Figur wünscht sich etwas, das
Kind wählt aus zwei bis vier Möglichkeiten, die Figur freut sich. Das ist ein
verkleidetes Quiz. Was fehlt, ist das, was ein Spiel ausmacht:

- **Das Kind steuert nichts.** Es wählt nur aus. In einem Spiel bewegt man
  etwas: fangen, lenken, werfen, angeln, hüpfen, leuchten.
- **Es steht nichts auf dem Spiel.** Kein Tempo, kein „gerade noch geschafft".
- **Es wächst nichts.** Keine Serie, kein Zähler, der sich füllt, nichts, das
  man in dieser Runde gesammelt hat.
- **Manche Aufgaben muss man erklären** („?" in einer Sprechblase).

## Die Regeln für jedes Spiel

1. **Drei-Sekunden-Regel:** Wer den Bildschirm drei Sekunden ohne Ton sieht,
   weiß, was zu tun ist.
2. **Ein Tätigkeitswort:** Jedes Spiel hat eine Handlung, die das Kind selbst
   ausführt und die Spaß macht, auch ohne Lernziel (fangen, füttern, hüpfen).
3. **Das Lernen ist die Spielregel:** Ob die Handlung gelingt, entscheidet
   der Lerninhalt. Wer richtig zählt, fängt genau genug.
4. **Sofort spürbar:** Jede Handlung hat sofort eine sichtbare und hörbare
   Folge. Serien bauen sich auf (Töne steigen, Flamme mit Zahl).
5. **Es wird schwerer:** Tempo, Menge und Ähnlichkeit steigen über die zehn
   Level. Das Spiel wird schneller, wenn es gut läuft, und langsamer nach
   Fehlern.
6. **Freundliches Scheitern:** Kein „Game over". Ein Fehler ist lustig und
   zeigt, was richtig gewesen wäre. Nach zwei Fehlern hilft das Spiel.
7. **Kein Lesen nötig.** Lumi spricht kurz: ein Wort oder ein kurzer Satz.
8. **Sammeln:** In jedem Level füllt sich etwas (Sterne-Zähler, eine Reihe
   geretteter Figuren), und am Ende gibt es ein kleines Fest.

Gemeinsamer Baukasten dafür: `src/components/play/Juice.jsx` (Sterne-Zähler,
Serie mit steigenden Tönen, Treffer und Fehlschlag, Wackeln).

## Die Spiele

Reihenfolge: Welle 1 läuft, dann Welle 2 bis 4.

### Welle 1 (im Bau)

| Spiel | Tätigkeit | Das Game | Lerneffekt |
|---|---|---|---|
| **Farbenreich** | mischen | *Monster-Farbdusche.* Ein graues Monster zeigt, welche Farbe es sein will. Farben in den Tank tippen, Hebel ziehen, das Monster wird genau so bunt wie gemischt. Jede Mischung ergibt etwas. | Farbwörter, Farben mischen |
| **Gefühlswelt** | schnappen | *Gefühle-Haus.* Lumi zeigt ein Gesicht. Aus den Fenstern schauen Figuren: alle antippen, die sich so fühlen, bevor sie sich ducken. | Gefühle im Gesicht lesen und benennen |
| **Gefühlsdetektiv** | ermitteln | *Kleine Fälle, von Lumi erzählt.* Was ist passiert, wie fühlt sich der Freund, was hilft? Man sieht, was die gewählte Hilfe bewirkt. | Einfühlen, helfen |
| **Zahlenland** | verbinden | *Sternbilder.* Nummerierte Sterne der Reihe nach verbinden, daraus wird ein Bild. Später rückwärts (Raketenstart) und in Schritten. | Zahlenreihe, weiterzählen, rückwärts, Schritte |

### Welle 2

**Zahlen entdecken → „Bruno fängt"** (fangen)
- *Heute:* n Dinge auf einen Teller legen, Haken antippen.
- *Das Game:* Vom Baum fällt Futter. Das Kind zieht Bruno mit dem Korb hin
  und her und fängt. Brunos Schild zeigt die Zahl. Jeder Fang zählt laut mit
  („eins, zwei, drei"). Genau so viele fangen, dann den „Mampf"-Knopf
  drücken. Zu wenig: Bruno hat noch Hunger. Zu viel: Er ist pappsatt, der
  Rest kullert weg.
- *Level:* 1–3 Korb mit so vielen Fächern wie die Zahl, voller Korb wird von
  selbst gegessen. 4–6 kein Fach mehr, das Kind entscheidet, wann genug ist.
  7–8 zwei Sorten fallen, nur die gewünschte fangen, dem Stiefel ausweichen.
  9–10 zwei Mengen zugleich („2 Äpfel und 3 Birnen"), schneller.
- *Lerneffekt:* abzählen und rechtzeitig aufhören (Mengenverständnis),
  Ziffer und Menge verbinden.

**ABC-Abenteuer → „Monster-Mampf"** (füttern im Vorbeiflug)
- *Heute:* dem Buchstaben-Monster aus drei Bildern das passende geben.
- *Das Game:* Dinge schweben an Ballons vorbei. Das Kind tippt die an, die
  mit dem Laut des Monsters anfangen: Sie fliegen ins Maul, das Monster
  wächst mit jedem Bissen. Falsches spuckt es im hohen Bogen aus und zeigt
  dessen Buchstaben. Nach fünf Bissen ist es satt, rülpst Buchstaben-Blasen
  und stellt sich in die Reihe.
- *Level:* erst zwei Dinge gleichzeitig und langsam, dann mehr und schneller,
  ähnliche Laute (B/P, D/T), zuletzt zwei Monster zugleich.
- *Lerneffekt:* Buchstabe, Laut, Anlaut heraushören.

**Silben-Spaß → „Frosch-Hüpfer"** (hüpfen)
- *Heute:* ein Klatsch-Knopf mit Rätselbild, Silben-Blätter legen.
- *Das Game:* Der Frosch will über den Teich zu dem Ding am anderen Ufer.
  Hüpf-Runden: Jeder Tipp ist ein Hüpfer, und Lumi spricht dabei die nächste
  Silbe („Ba – na – ne"). Ist das Wort zu Ende, das Ding antippen: Der Frosch
  springt ans Ufer. Ein Hüpfer zu viel: platsch. Bau-Runden: Seerosen mit
  Silben treiben im Teich, Antippen spricht die Silbe, in der richtigen
  Reihenfolge hüpft der Frosch hinüber. Unterwegs schnappt er Fliegen.
- *Level:* zwei Silben, dann drei und vier; später ohne mitgesprochene
  Silben; zuletzt mit falschen Silben dazwischen.
- *Lerneffekt:* Wörter in Silben gliedern und aus Silben bauen.

**Musterpark → „Tier-Band"** (Rhythmus)
- *Heute:* eine Parade mit Lücke.
- *Das Game:* Jedes Tier spielt ein Instrument. Ein Lichtkegel läuft im Takt
  über die Reihe, das Muster ist als Rhythmus zu hören: „bum – tschak – bum –
  tschak – bum – …" Die Lücke bleibt still. Das Kind setzt das fehlende Tier
  ein (Antippen lässt es vorspielen). Richtig: Die Band spielt die Schleife
  ganz und tanzt. Jedes gelöste Muster kommt in die große Band fürs Finale.
- *Level:* AB, AAB, ABB, ABC, AABB, wachsende Muster, mehrere Lücken.
- *Lerneffekt:* Muster erkennen und fortsetzen, jetzt mit Auge und Ohr.

**Sortier-Spaß → „Fließband-Füttern"** (werfen)
- *Heute:* ein Ding nach dem anderen zum Korbmonster ziehen.
- *Das Game:* Das Band läuft ununterbrochen, mehrere Dinge gleichzeitig. Das
  Kind schnippt jedes zum richtigen Monster (oder tippt Ding, dann Monster),
  bevor es hinten herunterfällt und noch eine Runde dreht. Die Monster
  werden mit jedem Bissen dicker. Läuft es gut, wird das Band schneller.
- *Level:* zwei Monster, dann drei und vier; später Eigenschaften statt
  Gruppen (rund/eckig, lebt/lebt nicht) und ein Mülleimer für Dinge, die zu
  keinem passen.
- *Lerneffekt:* Oberbegriffe bilden, nach Merkmalen ordnen.

### Welle 3

**Rechen-Rakete → „Planeten-Hüpfer"** (starten und landen)
- *Das Game:* Die Rakete steht auf dem Planeten der ersten Zahl. Jeder Druck
  auf den Schub-Knopf ist ein Hüpfer zum nächsten Planeten, Lumi zählt mit.
  Bei „4 + 2" also zweimal Schub, dann landen. Minus: Rückwärts-Schub.
  Auf dem Zielplaneten wartet der Außerirdische und steigt ein.
- *Level:* 1–3 plus bis 5, 4–6 minus, 7–8 das Ziel direkt antippen (im Kopf),
  9–10 „4 + ? = 7": Wie viele Hüpfer?
- *Lerneffekt:* Plus und Minus als Weiterzählen am Zahlenstrahl.

**Anlaut-Detektiv → „Anlaut-Angeln"** (angeln)
- *Das Game:* Unter Wasser schwimmen Dinge. Das Kind lässt den Haken im
  richtigen Moment hinunter und zieht etwas heraus, Lumi sagt das Wort. Dann
  in den Eimer mit dem Anfangsbuchstaben. Ab und zu hängt ein alter Stiefel
  oder eine Schatzkiste am Haken.
- *Lerneffekt:* Anlaut heraushören und dem Buchstaben zuordnen.

**Schattenrätsel → „Taschenlampen-Jagd"** (leuchten und fangen)
- *Das Game:* Im dunklen Zimmer huschen mehrere Schatten. Mit der Lampe
  finden; ein Schatten im Licht bleibt stehen. Dann das passende Bild darauf
  ziehen: Licht an für dieses Ding. Alle gefunden: Das ganze Zimmer wird hell.
- *Lerneffekt:* Umrisse erkennen (Formwahrnehmung).

**Hörabenteuer → „Hütchenspiel im Gebüsch"** (verfolgen)
- *Das Game:* Die Dinge verstecken sich, dann tauschen die Büsche die Plätze.
  Lumi ruft ein Ding beim Namen: Wo steckt es jetzt?
- *Level:* erst kein Tausch, dann einer, dann mehrere und schneller.
- *Lerneffekt:* Wort hören und verstehen, merken, mit den Augen verfolgen.

**Kuckucksuhr → „Lumis Tag"** (drehen)
- *Das Game:* Draußen vor dem Fenster wandert die Sonne mit dem Stundenzeiger:
  Dreht das Kind die Uhr, wird es Morgen, Mittag, Abend, Nacht. Eine Karte
  zeigt, wann etwas passiert (erst als kleine Uhr zum Nachstellen, später als
  Zahl). Stimmt die Zeit, ruft der Kuckuck so oft wie die Stunde, und die
  Szene spielt (Frühstück, Spielplatz, Schlafen).
- *Lerneffekt:* Uhr lesen und stellen, Tageszeiten.

**Waage-Welt → „Wippe-Katapult"** (schleudern)
- *Das Game:* Die Maus will an den Käse im Baum. Welches der Dinge ist schwer
  genug, um sie hochzuschleudern? Später drei Dinge nach Gewicht ordnen und
  mit Zahlen-Gewichten ausgleichen.
- *Lerneffekt:* schwerer und leichter, ordnen, erste Summen.

### Welle 4 (schon spielartig, gezielt aufwerten)

| Spiel | Was dazukommt |
|---|---|
| **Memo-Welt** | Gegen Lumi spielen (abwechselnd, Lumi vergisst auch mal), Joker-Karte |
| **Reim-Rallye** | Reimkandidaten an Ballons abschießen statt ziehen, Serie |
| **Buchstabenwald** | Zauber-Duell am Level-Ende, gezauberte Dinge sammeln |
| **Buchstaben-Spuren** | Lumi fährt auf dem Roller die Spur entlang und sammelt Sterne ein |
| **Blasen-Blitz** | Baukasten (Serie, Zähler), Riesenblase als Bonus |
| **Formen-Werkstatt** | Teile drehen, freies Bauen als Bonus |
| **Lumi-Labyrinth** | ist ein Spiel; Feinschliff |
| **Formen-Land** | Wimmelbild ist ein Spiel; Baukasten einbauen |
| **Mal-Atelier** | bleibt ein freies Malwerkzeug |
