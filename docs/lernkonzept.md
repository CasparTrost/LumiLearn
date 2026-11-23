# Lernkonzept von LumiLearn

LumiLearn ist für Kinder von 4 bis 7 Jahren, von denen die meisten noch nicht lesen.
Jede Entscheidung darüber, *was* ein Kind wann spielt und *wie* die App reagiert, folgt
einem belegten Mechanismus aus der Lern- oder Entwicklungspsychologie. Diese Seite sagt,
welcher es ist, wo er im Code steckt und worauf er sich stützt.

## 1. Die tägliche Reise („Reise mit Lumi“)

Die Startseite zeigt keine Wand aus 25 Spielen mehr, sondern eine kurze **Reise** über eine Wiese.
Die Reise hat diese Stationen:

1. **Aufwärmen.** Eine Fähigkeit, deren Wiederholung fällig ist. Ist keine fällig, kommt eine, die das Kind sicher kann, ein Level tiefer.
2. **Üben.** Das Spiel, in dem das Kind gerade steckt.
3. **Bewegungspause.** Drei kurze Bewegungen und eine Atemübung.
4. **Neu.** Ein Spiel, das zum Alter passt und noch nicht gespielt wurde.
5. **Wiederholen.** Eine weitere fällige Fähigkeit aus einem anderen Bereich.
6. **Schatztruhe.** Ein Sticker fürs Album.

| Mechanismus | Umsetzung | Quelle |
|---|---|---|
| Zu viel Auswahl lähmt | Vier Stationen statt 25 Kacheln. Alle Spiele bleiben darunter frei wählbar. | Iyengar & Lepper 2000 |
| Interleaving | Die Stationen kommen aus verschiedenen Welten. | Rohrer & Taylor 2007 |
| Selbstwirksamkeit | Die Reise beginnt mit einem sicheren Erfolg. | Bandura 1977 |
| Bewegungspausen | Eine Station in der Mitte ist Bewegung. | Mahar et al. 2006; Donnelly & Lambourne 2011 |
| Gesunde Mediennutzung | Die Reise hat ein Ende („Morgen geht es weiter“), etwa 15 bis 20 Minuten. | AAP Council on Communications and Media 2016 |
| Belohnung ohne Leistungsdruck | Der Sticker gibt es fürs Mitmachen, nicht für Sterne, und welcher es ist, bleibt eine Überraschung. | Deci, Koestner & Ryan 1999 |

Code: `src/lib/learning.js` (`planJourney`), `src/components/JourneyPath.jsx`,
`src/screens/MoveBreakScreen.jsx`, `src/screens/AlbumScreen.jsx`, `src/lib/stickers.js`.

## 2. Wiederholen im Abstand (Spaced Retrieval)

Jedes Spiel ist eine Fähigkeit in einer Leitner-Box (0–5).

- **Box nach einer Runde:** Mit mindestens 85 % auf Anhieb rückt die Fähigkeit eine Box höher. Unter 60 % geht sie eine Box tiefer.
- **Wartezeit:** Die Box bestimmt, wann das Spiel wiederkommt: nach 1, 2, 4, 7, 14 oder 30 Tagen.
- **Was die Reise daraus macht:** Fällige Fähigkeiten kommen als „Aufwärmen“ und „Wiederholen“ auf die Reise.

Quellen: Cepeda et al. 2006 (Metaanalyse zum verteilten Lernen); Roediger & Karpicke 2006
(Testeffekt); Fritz et al. 2007 (Abrufübung bei Kindern).

Code: `updateSkill`, `dueSkills` in `src/lib/learning.js`. Gespeichert wird das in `profile.progress[id].skill`.

## 3. Die richtige Schwierigkeit

Kinder lernen am meisten, wenn sie etwa 80–85 % der Aufgaben schaffen
(Wilson et al. 2019, „The eighty-five percent rule“; Wygotskis Zone der nächsten Entwicklung).

- **Höher:** Das nächste Level wird erst vorgeschlagen nach einer Runde mit **mindestens 60 % auf Anhieb**. Früher reichte jedes Ende einer Runde.
- **Gleich:** Nach einer schweren Runde heißt es „Nochmal üben 💪“. Das nächste Level ist trotzdem offen, das Kind darf wählen.
- **Leichter:** Nach **zwei Runden unter 40 %** auf demselben Level schlägt Lumi das Level davor vor.

Code: `nextLevel` in `src/lib/learning.js`, Knöpfe in `src/screens/ResultsScreen.jsx`.

## 4. Rückmeldung: Prozess-Lob und Fehlerfreundlichkeit

- **Was Lumi lobt:** Was das Kind getan hat („Gut überlegt!“, „Genau hingeschaut!“), nie, wie klug es ist (Mueller & Dweck 1998; Gunderson et al. 2013).
- **Nach einem Fehler:** Klappt danach die richtige Antwort, lobt Lumi das Dranbleiben („Du hast nicht aufgegeben!“).
- **Beim zweiten Fehler hintereinander:** Lumi sagt „Nicht schlimm, Fehler gehören zum Lernen.“
- **Nach jeder falschen Antwort:** Das Spiel zeigt und sagt die richtige Antwort oder gibt einen Hinweis. Das kam schon aus dem Audit.

Code: `src/lib/feedback.js`.

## 5. Lumi als Begleiter

Lumi sitzt in jedem Spiel in der oberen Leiste:

- Bei einer richtigen Antwort springt Lumi, und Sterne sprühen.
- Bei drei richtigen Antworten in Folge macht Lumi einen Salto.
- Bei einem Fehler legt Lumi nachdenklich den Kopf schief.

Kinder lernen mehr von Figuren, zu denen sie eine Beziehung haben (parasoziale Beziehungen: Calvert et al. 2014; Gola et al. 2013).
Lumi verdeckt nie das Spiel.

Code: `src/components/LumiBuddy.jsx` hört auf das Ereignis `lumi:feedback` aus `feedback.js` und `sfx.js`.

## 6. Buchstaben mit dem Finger schreiben

Das neue Spiel **Buchstaben-Spuren** lässt Großbuchstaben und Ziffern nachspuren:

- Es gibt einen Startpunkt, eine Richtung und die richtige Strich-Reihenfolge.
- Zum Schluss sagt Lumi den Laut mit einem Beispielwort.
- Buchstaben selbst zu schreiben verankert sie besser als Ansehen oder Tippen (Longcamp et al. 2005; James & Engelhardt 2012).
- Am Anfang zeigt Lumi den ersten Strich vor, bevor das Kind es selbst versucht (Worked-Example-Effekt).

Code: `src/games/TraceGame.jsx`, `src/games/traceStrokes.js`.

## 7. Eltern

Der Elternbereich zeigt einen **Lernbericht** mit diesen Teilen:

- **Je Spiel:** wie sicher das Kind ist, auf welchem Level es steht und wann das Spiel wiederkommt.
- **Je Tag:** was heute fällig ist.
- **Ausklappbar:** die Begründungen von dieser Seite, in Alltagssprache.
- **Tipps zum Mitspielen:** Gemeinsames Spielen und Darüber-Reden verstärkt den Lerneffekt (Joint Media Engagement, Takeuchi & Stevens 2011; Hirsh-Pasek et al. 2015).

Code: `src/components/LearningReport.jsx`.

## Quellen

- American Academy of Pediatrics, Council on Communications and Media (2016). Media and Young Minds. *Pediatrics*, 138(5).
- Bandura, A. (1977). Self-efficacy: Toward a unifying theory of behavioral change. *Psychological Review*, 84(2).
- Calvert, S. L., Richards, M. N., & Kent, C. C. (2014). Personalized interactive characters for toddlers' learning of seriation from a video presentation. *Journal of Applied Developmental Psychology*, 35(3).
- Cepeda, N. J., Pashler, H., Vul, E., Wixted, J. T., & Rohrer, D. (2006). Distributed practice in verbal recall tasks. *Psychological Bulletin*, 132(3).
- Deci, E. L., Koestner, R., & Ryan, R. M. (1999). A meta-analytic review of experiments examining the effects of extrinsic rewards on intrinsic motivation. *Psychological Bulletin*, 125(6).
- Donnelly, J. E., & Lambourne, K. (2011). Classroom-based physical activity, cognition, and academic achievement. *Preventive Medicine*, 52.
- Fritz, C. O., Morris, P. E., Nolan, D., & Singleton, J. (2007). Expanding retrieval practice: An effective aid to preschool children's learning. *Quarterly Journal of Experimental Psychology*, 60(7).
- Gola, A. A. H., Richards, M. N., Lauricella, A. R., & Calvert, S. L. (2013). Building meaningful parasocial relationships between toddlers and media characters to teach early mathematical skills. *Media Psychology*, 16(4).
- Gunderson, E. A., et al. (2013). Parent praise to 1- to 3-year-olds predicts children's motivational frameworks 5 years later. *Child Development*, 84(5).
- Hirsh-Pasek, K., et al. (2015). Putting education in "educational" apps. *Psychological Science in the Public Interest*, 16(1).
- Iyengar, S. S., & Lepper, M. R. (2000). When choice is demotivating. *Journal of Personality and Social Psychology*, 79(6).
- James, K. H., & Engelhardt, L. (2012). The effects of handwriting experience on functional brain development in pre-literate children. *Trends in Neuroscience and Education*, 1(1).
- Longcamp, M., Zerbato-Poudou, M.-T., & Velay, J.-L. (2005). The influence of writing practice on letter recognition in preschool children. *Acta Psychologica*, 119(1).
- Mahar, M. T., et al. (2006). Effects of a classroom-based program on physical activity and on-task behavior. *Medicine & Science in Sports & Exercise*, 38(12).
- Mueller, C. M., & Dweck, C. S. (1998). Praise for intelligence can undermine children's motivation and performance. *Journal of Personality and Social Psychology*, 75(1).
- Roediger, H. L., & Karpicke, J. D. (2006). Test-enhanced learning. *Psychological Science*, 17(3).
- Rohrer, D., & Taylor, K. (2007). The shuffling of mathematics problems improves learning. *Instructional Science*, 35(6).
- Takeuchi, L., & Stevens, R. (2011). *The new coviewing: Designing for learning through joint media engagement.* Joan Ganz Cooney Center.
- Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D. (2019). The eighty five percent rule for optimal learning. *Nature Communications*, 10.

## Warum keine Game-Engine (Godot o. Ä.)

Die App läuft als Web-App (React, offline-fähig, installierbar) auf jedem Tablet, Handy und Rechner ohne App-Store.
Was Kinder hier fesselt, sind keine 3D-Effekte, sondern drei Dinge:

- eine klare Struktur,
- unmittelbare, freundliche Rückmeldung,
- sichtbarer Fortschritt.

Das ist mit React und framer-motion ohne Abstriche machbar. Eine Game-Engine würde den Download vervielfachen, den Offline-Modus und die Barrierefreiheit (Vorlesen, Tastatur) erschweren und die 25 Spiele zu einem Neubau machen, ohne dass Kinder mehr lernen.
