# Bilder für Lumis Kleiderschrank (Tripo)

Diese Datei ist der Auftrag für eine lokale Claude-Sitzung mit Browser-Zugriff auf Tripo (Tripo Studio, angemeldet im
Chrome des Nutzers). Ziel: für jedes Ding unten EIN Bild erzeugen und unter dem angegebenen Namen speichern.

## So sollen alle Bilder aussehen

- **Nur das Ding allein:** niemand trägt es, kein Kopf, keine Puppe. Es wird später auf Lumi gesetzt.
- **Genau von vorn**, auf Augenhöhe, gerade und symmetrisch.
- **Stil wie Lumi** (`public/sprites/emoji/custom/lumi-idle.webp`): weiche Cartoon-Optik mit sanften Glanzlichtern,
  dünne, etwas dunklere Kontur, runde freundliche Formen. Nimmt Tripo ein Vorbild-Bild an, Lumi als Stil-Vorbild geben.
- **Format:** PNG mit transparentem Hintergrund, quadratisch, mindestens 512 × 512 Pixel, das Ding mittig und groß.
- Kein Bodenschatten, kein Text.
- Erzeugt Tripo ein 3D-Modell statt eines Bildes: genau von vorn rendern, als PNG mit transparentem Hintergrund.

## Ablage

- Speichern unter `tripo-in/wardrobe/<name>.png` (Ordner anlegen).
- Bei mehreren Ergebnissen das nehmen, das am besten von vorn, vollständig und im Stil ist; schlechte neu erzeugen.
- Nichts kaufen und kein Abo abschließen. Reicht das Guthaben nicht, aufhören und dem Nutzer sagen, wie viele fehlen.
- Am Ende: neuen Zweig `tripo-kleiderschrank` anlegen, nur den Ordner `tripo-in/wardrobe` committen und pushen.
  Keinen Pull Request öffnen. Eingebaut und auf Lumi angepasst werden die Bilder in der Cloud-Sitzung.

## Die Dinge

Alle 51 Dinge des Kleiderschranks: Kopf, Gesicht, Hals, Rücken (wird HINTER Lumi gezeichnet) und Hand.
Vor dem Start `git pull` ausführen und diese Datei neu lesen.

### 1. Bommelmütze (Kopf) → `tripo-in/wardrobe/muetze.png`

Rot-weiß geringelte Strickmütze mit dickem weißem Bommel und umgeschlagenem Rand. Unten gerade abgeschnitten, damit sie auf Lumis Kopf sitzt.

Prompt:

```
a red and white striped knitted winter beanie with a big fluffy white pompom on top and a folded ribbed brim, the lower edge is a gentle flat curve, the opening is not visible. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 2. Sonnenbrille (Gesicht) → `tripo-in/wardrobe/sonnenbrille.png`

Orange Sonnenbrille mit dunklen Gläsern, genau von vorn. Die Bügel sind nicht zu sehen.

Prompt:

```
a pair of chunky orange sunglasses with dark blue-grey lenses and a small white shine on each lens, the temples are not visible, two lenses side by side with a short bridge. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 3. Schal (Hals) → `tripo-in/wardrobe/schal.png`

Grün-weiß gestreifter Strickschal, einmal um einen unsichtbaren Hals gelegt: ein breiter waagerechter Bogen, vorn hängt ein kurzes Ende mit Fransen herunter.

Prompt:

```
a green and white striped knitted scarf wrapped once around an invisible neck, forming one wide horizontal band that curves slightly downwards, one short end with fringes hanging down in front on the left. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 4. Partyhut (Kopf) → `tripo-in/wardrobe/partyhut.png`

Spitzer Partyhut, blau mit bunten Punkten und Streifen, goldener Bommel an der Spitze, Fransen am unteren Rand.

Prompt:

```
a cone-shaped party hat, light blue with pink stripes and colourful dots, a golden pompom on the tip, a golden fringe along the lower rim, standing upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 5. Herzbrille (Gesicht) → `tripo-in/wardrobe/herzbrille.png`

Brille mit zwei rosa Herzen als Gläser, genau von vorn, ohne Bügel.

Prompt:

```
a pair of glasses with two heart-shaped pink lenses in a darker pink frame, a small white shine on each heart, the temples are not visible. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 6. Blumenkranz (Kopf) → `tripo-in/wardrobe/blumenkranz.png`

Blumenkranz von vorn gesehen: ein sanft nach oben gewölbter Bogen aus Blüten und Blättern (kein ganzer Kreis von oben).

Prompt:

```
a flower crown seen from the front as one gently arched band, not a full circle, made of white daisies, pink blossoms, small yellow flowers and green leaves. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 7. Fliege (Hals) → `tripo-in/wardrobe/fliege.png`

Rote Fliege mit weißen Punkten, genau von vorn.

Prompt:

```
a red bow tie with small white polka dots and a knot in the middle. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 8. Piratenhut (Kopf) → `tripo-in/wardrobe/piratenhut.png`

Dunkelblauer Piratenhut mit goldener Borte, kleinem freundlichem Totenkopf und roter Feder. Unten ein flacher Bogen.

Prompt:

```
a dark navy pirate captain hat with a golden trim, a small friendly cartoon skull with crossed bones on the front and one red feather on the right side, the lower edge is a gentle flat curve. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 9. Runde Brille (Gesicht) → `tripo-in/wardrobe/rundbrille.png`

Runde Brille mit dünnem Rahmen. Wichtig: nur der Rahmen, die Gläser sind leer, damit man Lumis Augen sieht.

Prompt:

```
a pair of round glasses with a thin dark blue frame and a short bridge, empty frames without lenses, the inside of both circles is fully transparent, the temples are not visible. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 10. Zauberhut (Kopf) → `tripo-in/wardrobe/zauberhut.png`

Lila Zauberhut mit gelben Sternen, die Spitze knickt zur Seite, breite Krempe.

Prompt:

```
a purple wizard hat with yellow stars, a wide round brim seen from the front as a flat ellipse, the pointed tip bends to the right, a golden band above the brim. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 11. Medaille (Hals) → `tripo-in/wardrobe/medaille.png`

Goldene Medaille mit Stern an einem rot-blauen Band. Das Band bildet oben ein V.

Prompt:

```
a round golden medal with a star on it, hanging on a red and blue ribbon that forms a V shape above the medal. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 12. Krone (Kopf) → `tripo-in/wardrobe/krone.png`

Goldene Krone mit fünf Zacken, kleinen Kugeln auf den Spitzen und drei Edelsteinen (rot, blau, grün).

Prompt:

```
a golden crown with five points, a small golden ball on each point and three round gems in red, blue and green on the band, the lower edge is a gentle flat curve. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 13. Cowboyhut (Kopf) → `tripo-in/wardrobe/cowboyhut.png`

Brauner Cowboyhut mit hochgebogener Krempe und einem Band mit Stern.

Prompt:

```
a brown cowboy hat with a curved brim turned up at the sides and a hat band with a small golden star, the lower edge is a gentle flat curve. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 14. Kochmütze (Kopf) → `tripo-in/wardrobe/kochmuetze.png`

Weiße, bauschige Kochmütze mit geradem Bund.

Prompt:

```
a white puffy chef hat with a straight band at the bottom, the lower edge is flat. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 15. Feuerwehrhelm (Kopf) → `tripo-in/wardrobe/feuerwehrhelm.png`

Roter Feuerwehrhelm mit gelbem Schild vorn, ohne Schrift.

Prompt:

```
a red firefighter helmet with a yellow shield badge on the front without any letters, a short brim, the lower edge is a gentle flat curve. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 16. Matrosenmütze (Kopf) → `tripo-in/wardrobe/matrosenmuetze.png`

Weiße Matrosenmütze mit blauem Band und kleinem Anker.

Prompt:

```
a white sailor cap with a navy blue band and a small golden anchor on the front, flat lower edge. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 17. Basecap (Kopf) → `tripo-in/wardrobe/basecap.png`

Blaue Schirmmütze von vorn, der Schirm zeigt nach vorn unten, kein Logo.

Prompt:

```
a blue baseball cap seen from the front, the visor points forward and slightly down, a small button on top, no logo, no letters. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 18. Zylinder (Kopf) → `tripo-in/wardrobe/zylinder.png`

Schwarzer, niedriger Zylinder mit rotem Band.

Prompt:

```
a short black top hat with a red band and a flat round brim seen from the front as a flat ellipse. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 19. Hasenohren (Kopf) → `tripo-in/wardrobe/hasenohren.png`

Zwei weiße Hasenohren mit rosa Innenseite an einem Haarreif.

Prompt:

```
a hairband with two upright white bunny ears with pink insides, the hairband is a thin arc at the bottom. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 20. Katzenohren (Kopf) → `tripo-in/wardrobe/katzenohren.png`

Zwei graue Katzenohren mit rosa Innenseite an einem Haarreif.

Prompt:

```
a hairband with two small grey cat ears with pink insides, the hairband is a thin arc at the bottom. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 21. Strohhut (Kopf) → `tripo-in/wardrobe/strohhut.png`

Gelber Strohhut mit breiter Krempe und rotem Band.

Prompt:

```
a yellow straw sun hat with a wide brim seen from the front as a flat ellipse and a red ribbon band. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 22. Weihnachtsmütze (Kopf) → `tripo-in/wardrobe/weihnachtsmuetze.png`

Rote Weihnachtsmütze mit weißem Rand und weißem Bommel, die Spitze hängt zur Seite.

Prompt:

```
a red Santa hat with a white fluffy rim and a white pompom, the tip hangs down to the right, the lower edge is a gentle flat curve. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 23. Sternbrille (Gesicht) → `tripo-in/wardrobe/sternbrille.png`

Brille mit zwei gelben Sternen als Rahmen, die Gläser sind leer.

Prompt:

```
a pair of glasses with two star-shaped yellow frames and a short bridge, empty frames without lenses, the inside of both stars is fully transparent, the temples are not visible. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 24. Taucherbrille (Gesicht) → `tripo-in/wardrobe/taucherbrille.png`

Blaue Taucherbrille, ein großes durchsichtiges Glas, ohne Band.

Prompt:

```
a blue diving mask with one wide lens area that is fully transparent, thick rounded frame, no strap visible. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 25. Clownsnase (Gesicht) → `tripo-in/wardrobe/clownsnase.png`

Eine runde rote Clownsnase mit Glanzlicht.

Prompt:

```
a single round shiny red clown nose with a white highlight. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 26. Heldenmaske (Gesicht) → `tripo-in/wardrobe/heldenmaske.png`

Rote Augenmaske eines Superhelden mit zwei Augenlöchern.

Prompt:

```
a red superhero eye mask with two eye holes that are fully transparent, pointed outer corners, no strap visible. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 27. Monokel (Gesicht) → `tripo-in/wardrobe/monokel.png`

Ein goldenes Monokel mit kurzer Kette, das Glas ist leer.

Prompt:

```
a single golden monocle with a short golden chain hanging from its side, empty frame without lens. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 28. Skibrille (Gesicht) → `tripo-in/wardrobe/skibrille.png`

Skibrille mit orange getöntem, durchscheinendem Glas und grünem Rahmen.

Prompt:

```
a pair of ski goggles with a green frame and one wide lightly orange tinted translucent lens, no strap visible. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 29. Schnurrbart (Gesicht) → `tripo-in/wardrobe/schnurrbart.png`

Ein brauner, geschwungener Schnurrbart.

Prompt:

```
a brown curly handlebar moustache. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 30. Perlenkette (Hals) → `tripo-in/wardrobe/perlenkette.png`

Kette aus weißen Perlen, als Bogen von vorn.

Prompt:

```
a white pearl necklace seen from the front as one open arc curving downwards. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 31. Blumenkette (Hals) → `tripo-in/wardrobe/blumenkette.png`

Bunte Blumenkette (Lei), als Bogen von vorn.

Prompt:

```
a colourful flower lei necklace seen from the front as one open arc curving downwards, pink, yellow and orange flowers. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 32. Halstuch (Hals) → `tripo-in/wardrobe/halstuch.png`

Rotes Halstuch mit weißen Punkten, vorn als Dreieck gebunden.

Prompt:

```
a red bandana with white polka dots tied around an invisible neck, hanging as a triangle in front. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 33. Krawatte (Hals) → `tripo-in/wardrobe/krawatte.png`

Kurze blau-gelb gestreifte Krawatte mit Knoten.

Prompt:

```
a short necktie with a knot, diagonal blue and yellow stripes. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 34. Glöckchen (Hals) → `tripo-in/wardrobe/gloeckchen.png`

Goldenes Glöckchen an einem roten Band.

Prompt:

```
a small golden bell hanging on a red ribbon that forms an open arc. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 35. Herzkette (Hals) → `tripo-in/wardrobe/herzkette.png`

Rotes Herz an einer feinen goldenen Kette.

Prompt:

```
a red heart pendant hanging on a thin golden chain that forms a V shape. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 36. Sternabzeichen (Hals) → `tripo-in/wardrobe/sternabzeichen.png`

Goldener Stern an einem blauen Band.

Prompt:

```
a golden star badge hanging on a blue ribbon that forms a V shape. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 37. Umhang (Rücken) → `tripo-in/wardrobe/umhang.png`

Roter Superhelden-Umhang mit gelbem Futter und kleinem Goldstern am Kragen.

Prompt:

```
a superhero cape, bright red outside with a yellow lining and a small gold star clasp at the collar, flaring wide towards a slightly wavy hem. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 38. Schmetterlingsflügel (Rücken) → `tripo-in/wardrobe/schmetterling.png`

Orange Schmetterlingsflügel mit rosa Unterflügeln und cremefarbenen Punkten.

Prompt:

```
a pair of butterfly wings, large orange upper wings and small pink lower wings with round cream spots, spread symmetrically. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 39. Engelsflügel (Rücken) → `tripo-in/wardrobe/engel.png`

Weiche weiße Engelsflügel.

Prompt:

```
a pair of soft white angel wings with gentle blue feather shading, rising up and out symmetrically. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 40. Feenflügel (Rücken) → `tripo-in/wardrobe/fee.png`

Zarte, durchscheinende Feenflügel in Mint und Flieder mit Glitzerpunkten.

Prompt:

```
a pair of delicate see-through fairy wings in mint and lilac with tiny white glitter dots, tall upper wings and short lower wings. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 41. Drachenflügel (Rücken) → `tripo-in/wardrobe/drache.png`

Kleine grüne, freundliche Drachenflügel mit runden Kanten.

Prompt:

```
a pair of friendly little green dragon wings with rounded scalloped edges and light green membranes, no claws or spikes, spread symmetrically. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 42. Raketenrucksack (Rücken) → `tripo-in/wardrobe/rakete.png`

Zwei kleine weiße Raketen mit roten Spitzen an einem blauen Gurt, darunter Flammen.

Prompt:

```
a rocket backpack, two small white rockets with red tips and red fins joined by a blue strap, soft orange flames below. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 43. Pfauenfedern (Rücken) → `tripo-in/wardrobe/pfau.png`

Ein Fächer aus neun grün-blauen Pfauenfedern mit Augen an den Spitzen.

Prompt:

```
a peacock tail fan, nine long green-teal feathers spread in a half wheel, each with a gold, blue and navy eye spot at its tip. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 44. Luftballon (Hand) → `tripo-in/wardrobe/ballon.png`

Roter Luftballon mit Schnur.

Prompt:

```
a shiny red party balloon with a small knot and a curly brown string hanging straight down. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 45. Zauberstab (Hand) → `tripo-in/wardrobe/zauberstab.png`

Lila Stab mit goldenem Stern und drei Funken.

Prompt:

```
a magic wand, a purple stick with a glossy gold star on top and three tiny sparkles around it, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 46. Sonnenblume (Hand) → `tripo-in/wardrobe/blume.png`

Sonnenblume mit langem grünem Stiel und zwei Blättern.

Prompt:

```
a sunflower with bright yellow petals, a brown seed centre and a long green stem with two leaves, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 47. Lolli (Hand) → `tripo-in/wardrobe/lolli.png`

Großer runder Lolli, rosa-weiß gedreht, am weißen Stiel.

Prompt:

```
a big round lollipop with a pink and white swirl on a white stick, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 48. Fähnchen (Hand) → `tripo-in/wardrobe/faehnchen.png`

Türkises Wimpel-Fähnchen mit gelbem Stern an einem Holzstab.

Prompt:

```
a little pennant flag, a wavy turquoise triangle with a yellow star on a wooden stick with a gold knob on top, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 49. Eis (Hand) → `tripo-in/wardrobe/eis.png`

Eiswaffel mit einer mintgrünen und einer rosa Kugel und einer Kirsche.

Prompt:

```
an ice cream cone with a waffle cone, a mint scoop and a pink scoop and a cherry on top, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 50. Windrad (Hand) → `tripo-in/wardrobe/windrad.png`

Windrad mit vier Flügeln in Rot, Blau, Gelb und Grün am Holzstab.

Prompt:

```
a paper pinwheel with four blades in red, blue, yellow and green on a wooden stick, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### 51. Laterne (Hand) → `tripo-in/wardrobe/laterne.png`

Runde Kinderlaterne aus Papier, warm gelb-orange mit lachendem Sonnengesicht, an einem kurzen Holzstab hängend.

Prompt:

```
a round children's paper lantern, warm yellow and orange with a smiling sun face and gold caps on top and bottom, hanging on a short wire from the tip of a short wooden stick. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

---

# Lumis Freunde (vier neue Figuren)

Vier Freunde, die Kinder sich mit ihren Sternen als Begleiter aussuchen können. Lumi bleibt die Figur, die spricht und
erklärt; die Freunde spielen mit. Jeder Freund braucht dieselben sechs Bilder wie Lumi.

## So sollen die Figuren aussehen

- **Wie Lumi gebaut:** klein, rund, großer Kopf, steht aufrecht, ganze Figur von vorn, große dunkle Augen mit
  Glanzlicht, rosige Wangen. Stil-Vorbild: `public/sprites/emoji/custom/lumi-idle.webp`.
- **Alle sechs Bilder einer Figur zeigen dieselbe Figur:** gleiche Form, Farben und Proportionen. Deshalb zuerst das
  Bild „steht" erzeugen und, wenn Tripo ein Vorbild-Bild annimmt, dieses Bild als Vorbild für die anderen fünf geben.
- **Format wie Lumis Bilder:** PNG mit transparentem Hintergrund, quadratisch, mindestens 512 × 512 Pixel, die Figur
  mittig, etwa 85 % der Höhe, kein Bodenschatten, kein Text (das kleine Fragezeichen und das Zzz gehören zum Bild).
- **Ablage:** `tripo-in/friends/<figur>-<pose>.png`, im selben Zweig `tripo-kleiderschrank` committen und pushen.
- Reihenfolge: erst von JEDER Figur das Bild „steht" machen und dem Nutzer zeigen; die übrigen Posen erst, wenn er
  die vier Figuren gut findet.

## Dino

Ein kleiner, runder Baby-Dino: hellgrün mit cremefarbenem Bauch, kleine runde orange Zacken vom Kopf über den Rücken, kurzer Schwanz.

### Dino – steht, freundlich → `tripo-in/friends/dino-idle.png`

```
a small chubby baby dinosaur mascot standing upright on two short legs, light green body with a cream belly, a row of small rounded orange spikes from the top of its head down its back, short tail, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, neutral standing pose, gentle smile, arms at its sides, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Dino – jubelt → `tripo-in/friends/dino-happy.png`

```
a small chubby baby dinosaur mascot standing upright on two short legs, light green body with a cream belly, a row of small rounded orange spikes from the top of its head down its back, short tail, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, cheering with both arms raised, eyes closed in joy, big open smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Dino – traurig → `tripo-in/friends/dino-sad.png`

```
a small chubby baby dinosaur mascot standing upright on two short legs, light green body with a cream belly, a row of small rounded orange spikes from the top of its head down its back, short tail, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, sad, head slightly down, teary eyes, small frown, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Dino – überlegt → `tripo-in/friends/dino-think.png`

```
a small chubby baby dinosaur mascot standing upright on two short legs, light green body with a cream belly, a row of small rounded orange spikes from the top of its head down its back, short tail, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, thinking, one hand at its chin, eyes looking up, a small question mark next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Dino – winkt → `tripo-in/friends/dino-wave.png`

```
a small chubby baby dinosaur mascot standing upright on two short legs, light green body with a cream belly, a row of small rounded orange spikes from the top of its head down its back, short tail, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, waving hello with one raised hand, big smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Dino – schläft → `tripo-in/friends/dino-sleep.png`

```
a small chubby baby dinosaur mascot standing upright on two short legs, light green body with a cream belly, a row of small rounded orange spikes from the top of its head down its back, short tail, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, sleeping, sitting on the ground, eyes closed, a little Zzz next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

## Einhorn

Ein kleines, rundes Baby-Einhorn, das aufrecht steht: weiß, Mähne und Schweif in Pastell-Regenbogenfarben, kleines goldenes Horn.

### Einhorn – steht, freundlich → `tripo-in/friends/einhorn-idle.png`

```
a small chubby baby unicorn mascot standing upright on two short hind legs, white body, fluffy pastel rainbow mane and tail in pink, purple and light blue, a small golden spiral horn, small pink hooves, short front legs like arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, neutral standing pose, gentle smile, arms at its sides, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Einhorn – jubelt → `tripo-in/friends/einhorn-happy.png`

```
a small chubby baby unicorn mascot standing upright on two short hind legs, white body, fluffy pastel rainbow mane and tail in pink, purple and light blue, a small golden spiral horn, small pink hooves, short front legs like arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, cheering with both arms raised, eyes closed in joy, big open smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Einhorn – traurig → `tripo-in/friends/einhorn-sad.png`

```
a small chubby baby unicorn mascot standing upright on two short hind legs, white body, fluffy pastel rainbow mane and tail in pink, purple and light blue, a small golden spiral horn, small pink hooves, short front legs like arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, sad, head slightly down, teary eyes, small frown, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Einhorn – überlegt → `tripo-in/friends/einhorn-think.png`

```
a small chubby baby unicorn mascot standing upright on two short hind legs, white body, fluffy pastel rainbow mane and tail in pink, purple and light blue, a small golden spiral horn, small pink hooves, short front legs like arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, thinking, one hand at its chin, eyes looking up, a small question mark next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Einhorn – winkt → `tripo-in/friends/einhorn-wave.png`

```
a small chubby baby unicorn mascot standing upright on two short hind legs, white body, fluffy pastel rainbow mane and tail in pink, purple and light blue, a small golden spiral horn, small pink hooves, short front legs like arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, waving hello with one raised hand, big smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Einhorn – schläft → `tripo-in/friends/einhorn-sleep.png`

```
a small chubby baby unicorn mascot standing upright on two short hind legs, white body, fluffy pastel rainbow mane and tail in pink, purple and light blue, a small golden spiral horn, small pink hooves, short front legs like arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, sleeping, sitting on the ground, eyes closed, a little Zzz next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

## Drache

Ein kleiner, runder Baby-Drache: rot-orange mit gelbem Bauch, zwei winzige Flügel, zwei kleine runde Hörner, kurzer Schwanz mit Pfeilspitze. Freundlich, kein Feuer.

### Drache – steht, freundlich → `tripo-in/friends/drache-idle.png`

```
a small chubby baby dragon mascot standing upright on two short legs, red-orange body with a yellow belly, two tiny wings on its back, two small rounded horns, short tail with a small arrow tip, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, not scary, no fire, neutral standing pose, gentle smile, arms at its sides, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Drache – jubelt → `tripo-in/friends/drache-happy.png`

```
a small chubby baby dragon mascot standing upright on two short legs, red-orange body with a yellow belly, two tiny wings on its back, two small rounded horns, short tail with a small arrow tip, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, not scary, no fire, cheering with both arms raised, eyes closed in joy, big open smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Drache – traurig → `tripo-in/friends/drache-sad.png`

```
a small chubby baby dragon mascot standing upright on two short legs, red-orange body with a yellow belly, two tiny wings on its back, two small rounded horns, short tail with a small arrow tip, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, not scary, no fire, sad, head slightly down, teary eyes, small frown, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Drache – überlegt → `tripo-in/friends/drache-think.png`

```
a small chubby baby dragon mascot standing upright on two short legs, red-orange body with a yellow belly, two tiny wings on its back, two small rounded horns, short tail with a small arrow tip, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, not scary, no fire, thinking, one hand at its chin, eyes looking up, a small question mark next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Drache – winkt → `tripo-in/friends/drache-wave.png`

```
a small chubby baby dragon mascot standing upright on two short legs, red-orange body with a yellow belly, two tiny wings on its back, two small rounded horns, short tail with a small arrow tip, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, not scary, no fire, waving hello with one raised hand, big smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Drache – schläft → `tripo-in/friends/drache-sleep.png`

```
a small chubby baby dragon mascot standing upright on two short legs, red-orange body with a yellow belly, two tiny wings on its back, two small rounded horns, short tail with a small arrow tip, tiny arms, big dark eyes with white highlights, rosy cheeks, friendly little smile, not scary, no fire, sleeping, sitting on the ground, eyes closed, a little Zzz next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

## Roboter

Ein kleiner, runder Spielzeug-Roboter: hellblau und weiß, runder Kopf mit kleiner Antenne und gelber Kugel, große runde Augen, kurze Arme und Beine.

### Roboter – steht, freundlich → `tripo-in/friends/roboter-idle.png`

```
a small round friendly toy robot mascot standing upright, light blue and white rounded body, big round head with a little antenna with a yellow ball on top, big round dark eyes with white highlights, two small pink cheek lights, short arms with round mitten hands, short legs, friendly little smile, neutral standing pose, gentle smile, arms at its sides, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Roboter – jubelt → `tripo-in/friends/roboter-happy.png`

```
a small round friendly toy robot mascot standing upright, light blue and white rounded body, big round head with a little antenna with a yellow ball on top, big round dark eyes with white highlights, two small pink cheek lights, short arms with round mitten hands, short legs, friendly little smile, cheering with both arms raised, eyes closed in joy, big open smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Roboter – traurig → `tripo-in/friends/roboter-sad.png`

```
a small round friendly toy robot mascot standing upright, light blue and white rounded body, big round head with a little antenna with a yellow ball on top, big round dark eyes with white highlights, two small pink cheek lights, short arms with round mitten hands, short legs, friendly little smile, sad, head slightly down, teary eyes, small frown, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Roboter – überlegt → `tripo-in/friends/roboter-think.png`

```
a small round friendly toy robot mascot standing upright, light blue and white rounded body, big round head with a little antenna with a yellow ball on top, big round dark eyes with white highlights, two small pink cheek lights, short arms with round mitten hands, short legs, friendly little smile, thinking, one hand at its chin, eyes looking up, a small question mark next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Roboter – winkt → `tripo-in/friends/roboter-wave.png`

```
a small round friendly toy robot mascot standing upright, light blue and white rounded body, big round head with a little antenna with a yellow ball on top, big round dark eyes with white highlights, two small pink cheek lights, short arms with round mitten hands, short legs, friendly little smile, waving hello with one raised hand, big smile, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```

### Roboter – schläft → `tripo-in/friends/roboter-sleep.png`

```
a small round friendly toy robot mascot standing upright, light blue and white rounded body, big round head with a little antenna with a yellow ball on top, big round dark eyes with white highlights, two small pink cheek lights, short arms with round mitten hands, short legs, friendly little smile, sleeping, sitting on the ground, eyes closed, a little Zzz next to its head, full body. cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, friendly rounded proportions, big head, bright warm colors, front view, centered, transparent background, no ground shadow, no text.
```
