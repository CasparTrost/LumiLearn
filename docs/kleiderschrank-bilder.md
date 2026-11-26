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

## Eingebaut (Stand: Tripo-Bilder im Kleiderschrank)

Von den 69 Tripo-Bildern sind die der fünf alten Plätze eingebaut: 40 gemalte Dinge sind durch ihr Tripo-Bild
ersetzt (`schmetterlingsfluegel.png` → `schmetterling`, `jetpack.png` → `rakete`, `eistuete.png` → `eis`), dazu
17 neue Dinge: Propellermütze, Eierschale, Einhorn-Haarreif (`einhorn.png`), Tortenhut, Fliegenpilz-Hut, Antennen,
Diadem, Heiligenschein, Doktorhut (Kopf); Spiralbrille, 3D-Brille, Federmaske (`maske-venedig.png`) (Gesicht);
Kopfhörer, Halskrause, Kamera (Hals); Zuckerwatte, Ukulele (Hand). Umgewandelt mit
`node scripts/art/png-to-webp.mjs public/sprites/wardrobe <bild.png>=<id> …` (512 px webp, unter 60 KB, die
durchscheinenden Gläser und die Löcher bleiben). Eingepasst auf alle sieben Bilder von Lumi in
`src/lib/wardrobe/*.js`; ansehen mit `node scripts/art/wardrobe-fit.mjs out.png 240 <id>`.

Flügel (Schmetterling, Engel, Fee, Drache) werden in zwei Hälften seitlich nach außen gedreht (`spread` in
`src/lib/wardrobe.js`): aufrecht neben dem Kopf sahen sie wie Ohren aus.

## Neue Plätze: Oberteil, Unterteil, Schuhe

Eingebaut als drei eigene Plätze (`top`, `bottom`, `shoes` in `src/lib/wardrobe/top.js`, `bottom.js`, `shoes.js`),
frei kombinierbar mit den fünf alten: 16 Oberteile, 15 Hosen und Röcke, 15 Paar Schuhe. Die Bilder werden nicht
neu gemalt, sondern auf Lumi gestaucht (`sy`: Oberteil und Hose werden flacher, damit sie zum runden Küken passen).
Die Flügel werden über das Oberteil noch einmal gezeichnet (`wings` je Bild in `POSES`), die Hose liegt unter dem
Saum des Oberteils, die Schuhe sind das Paarbild in zwei Hälften, je eine auf einem Fuß (`step` in `POSES`). Im
Sitzen (Schlafen) liegen Lumis Füße vor dem Bauch und werden mit den Schuhen über die Kleider gezeichnet. Der
Meerjungfrauen-Schwanz hat keine Füße: mit ihm bleiben die Schuhe im Schrank (`feet: false`). Die Reiter-Bilder
sagen den Platz: Ringelshirt, Jeansshorts, Turnschuhe. Die Handschuhe (Boxhandschuhe, Ofenhandschuhe) sind noch
nicht eingebaut.

## Noch bestellen

Elf Dinge sind noch gemalt und wirken neben den Tripo-Bildern flacher (dicke braune Kontur, kaum Glanz). Am
meisten fallen Umhang (liest sich wie ein Rock), Drachen-, Engels- und Feenflügel und die Pfauenfedern auf;
Ballon, Lolli, Sonnenblume, Windrad, Zauberstab und Fähnchen gehen zur Not. Gleiche Regeln wie oben, Lumi als
Stil-Vorbild, Ablage `tripo-in/wardrobe/<name>.png`. Flügel: ausgebreitet zur Seite, sie werden hinter Lumi
gezeichnet und in der Mitte geteilt.

### Luftballon (Hand) → `tripo-in/wardrobe/ballon.png`

Prompt:

```
a shiny round red party balloon with a soft glossy highlight, a small knot and a thin curly string hanging straight down, the string as long as the balloon is tall. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Umhang (Rücken) → `tripo-in/wardrobe/umhang.png`

Prompt:

```
a superhero cape seen from the front as if worn, a short golden collar with a round gold star clasp in the middle, the bright red cape spreading out wide to both sides with yellow lining showing at the edges, flowing wider towards a wavy hem. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Zauberstab (Hand) → `tripo-in/wardrobe/zauberstab.png`

Prompt:

```
a magic wand, a slim purple stick with a gold tip at the bottom and a big glossy gold star on top, three tiny sparkles around the star, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Lolli (Hand) → `tripo-in/wardrobe/lolli.png`

Prompt:

```
a big round flat lollipop with a pink and white swirl and a glossy highlight on a white stick, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Engelsflügel (Rücken) → `tripo-in/wardrobe/engel.png`

Prompt:

```
a pair of soft white angel wings with layered rounded feathers and gentle pale blue shading, spread out to both sides and slightly upwards, symmetrical, a small gap in the middle. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Sonnenblume (Hand) → `tripo-in/wardrobe/blume.png`

Prompt:

```
a sunflower with bright yellow petals, a brown seed centre and a long green stem with two leaves, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Feenflügel (Rücken) → `tripo-in/wardrobe/fee.png`

Prompt:

```
a pair of delicate see-through fairy wings in mint and lilac with tiny white glitter dots, two tall upper wings and two short lower wings, spread out to both sides, the wings half transparent. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Fähnchen (Hand) → `tripo-in/wardrobe/faehnchen.png`

Prompt:

```
a little pennant flag, a wavy turquoise triangle with a yellow star on a wooden stick with a gold knob on top, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Drachenflügel (Rücken) → `tripo-in/wardrobe/drache.png`

Prompt:

```
a pair of friendly little green dragon wings with rounded scalloped edges, light green membranes and darker green ribs, no claws or spikes, spread out to both sides, symmetrical. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Windrad (Hand) → `tripo-in/wardrobe/windrad.png`

Prompt:

```
a paper pinwheel with four curled blades in red, blue, yellow and green and a gold pin in the middle, on a wooden stick, upright. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
```

### Pfauenfedern (Rücken) → `tripo-in/wardrobe/pfau.png`

Prompt:

```
a peacock tail fan, nine long green-teal feathers spread in a half wheel, each with a gold, blue and navy eye spot at its tip, the fan wider than tall. cute children's app cartoon illustration in the style of a soft storybook sticker, soft shading with gentle highlights, clean thin slightly darker outline, friendly rounded shapes, bright warm colors, single object only, nobody wearing it, no head, no mannequin, straight front view at eye level, symmetrical, centered, fills most of the picture, transparent background, no ground shadow, no text.
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

---

# Probe: Oberteile passend für jede Figur

Oberteile wirken auf den Figuren oft aufgeklebt, weil ein flach gemaltes Hemd nicht zur Körperform eines Kükens,
Dinos oder Roboters passt. Probe: zwei Oberteile, je einmal für jede der fünf Figuren gemalt (10 Bilder). Erst
wenn die Probe gut aussieht, folgen die übrigen 14 Oberteile (weitere 70 Bilder).

## So sollen die Bilder aussehen

- **Vorbild-Bild:** das stehende Bild der Figur (Tabelle unten) als Bild-Vorlage an Tripo geben.
- **Nur das Kleidungsstück**, ohne die Figur: so, wie es aussähe, wenn genau diese Figur es von vorn trägt.
  Breite, Länge und Rundung passen zu Brust und Bauch dieser Figur; die Ärmel sitzen dort, wo die Arme bzw.
  Flügel der Figur ansetzen; der Halsausschnitt sitzt unter ihrem Kopf.
- Gleicher Stil wie die bisherigen Tripo-Bilder (weiche Cartoon-Optik, dünne etwas dunklere Kontur).
- PNG, transparenter Hintergrund, quadratisch, mindestens 512 × 512 Pixel, das Kleidungsstück mittig.
- Ablage: `tripo-in/tops/<figur>-<oberteil>.png`, im Zweig `tripo-kleiderschrank`, committen und pushen.
- Nichts kaufen; reicht das Guthaben nicht, aufhören und dem Nutzer sagen, wie viele fehlen.

## Die Figuren (Vorbild-Bilder)

| Figur | Datei | Körper |
|---|---|---|
| kueken | `public/sprites/emoji/custom/lumi-idle.webp` | rundes Küken, Flügel seitlich, kein Hals |
| dino | `public/sprites/shapes/dino-idle.webp` | runder Bauch, kurze Ärmchen vorn, Rückenzacken |
| einhorn | `public/sprites/shapes/einhorn-idle.webp` | steht aufrecht, schmaler Oberkörper, Vorderbeine als Arme |
| drache | `public/sprites/shapes/drache-idle.webp` | runder Bauch, Arme seitlich, Flügel am Rücken |
| roboter | `public/sprites/shapes/roboter-idle.webp` | runder Rumpf mit Brustlicht, Arme als Röhren mit Fäustlingen |

## Die zehn Probebilder

Für jede Figur (kueken, dino, einhorn, drache, roboter) je eins:

- `tripo-in/tops/<figur>-ringelshirt.png`

```
a blue and white striped long sleeve sailor shirt, only the shirt, shaped exactly to be worn by the character in the reference image, seen from the front: width, length and roundness of the shirt follow that character's chest and belly, the sleeves start where its arms start, the neckline sits right under its head; no character visible, cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, centered, transparent background, no ground shadow, no text.
```

- `tripo-in/tops/<figur>-hawaiihemd.png`

```
a turquoise hawaiian shirt with red and orange hibiscus flowers, short sleeves, open collar, only the shirt, shaped exactly to be worn by the character in the reference image, seen from the front: width, length and roundness of the shirt follow that character's chest and belly, the sleeves start where its arms start, the neckline sits right under its head; no character visible, cute children's app cartoon illustration, soft flat shading with gentle highlights, clean thin slightly darker outline, centered, transparent background, no ground shadow, no text.
```

---

# Probe 2: Oberteil und Hose direkt auf die Figur gemalt, alle sieben Posen auf einem Bild

Darübergelegte Oberteile und Hosen passen nicht zu den Posen: Ärmel folgen den Armen nicht, Hosenbeine nicht den
Beinen. Deshalb sollen Oberteil und Hose jetzt **direkt auf die Figur gemalt** werden, und zwar alle sieben Posen
einer Figur **auf einem einzigen Bild**. Aus dem fertigen Bild schneidet die Cloud-Sitzung die Kleidung pro Pose
heraus.

## Die Vorlage

`docs/tripo-vorlagen/<figur>-posen.png` (2048 × 1024 Pixel, weißer Hintergrund): die sieben Posen der Figur in einem
festen Raster, 4 Spalten × 2 Reihen zu je 512 × 512 Pixeln. Reihe 1: steht, jubelt, traurig, überlegt (hmm);
Reihe 2: überlegt (denkt), schläft (sitzt), winkt; das achte Feld bleibt leer.
Figuren: `chick` (Lumi, das Küken), `dino`, `einhorn`, `drache`, `roboter`.

## So soll das Ergebnis sein (sehr wichtig)

- **Die Vorlage bearbeiten, nicht neu malen:** Das Ergebnis ist genau die Vorlage, nur dass jede der sieben Figuren
  jetzt das Oberteil und die Hose trägt. Jede Figur bleibt in Größe, Lage, Pose, Gesicht, Farben und Umriss genau
  gleich und an genau derselben Stelle im Raster. Bildgröße 2048 × 1024, weißer Hintergrund, nichts kommt dazu.
  Kann Tripo ein Bild so nicht bearbeiten (es malt die Figuren neu, verschiebt oder verändert sie), dann aufhören
  und dem Nutzer genau das sagen.
- **Die Kleidung folgt dem Körper in jeder Pose:**
  - Das Oberteil bedeckt Brust und Bauch bis zur Hüfte; der Kragen sitzt direkt unter dem Kopf.
  - Jeder Ärmel liegt auf seinem Arm, so wie der Arm in dieser Pose liegt: beim Jubeln und Winken geht der Ärmel
    mit dem erhobenen Arm nach oben, beim Überlegen liegt der Ärmel auf dem Arm an der Wange, beim Traurigsein auf
    den Armen vor dem Bauch. Hände und Pfoten schauen aus dem Ärmel heraus.
  - Die Hose sitzt an Hüfte und Beinen, jedes Hosenbein auf seinem Bein; die Füße schauen unten heraus. Beim
    Schlafen sitzt die Figur: die Hose liegt auf dem Schoß, die Hosenbeine folgen den Beinen nach vorn.
  - Ein Schwanz, Rückenzacken und Flügel bleiben frei und liegen über der Kleidung, wo sie vor dem Körper sind.
- Gleicher Stil wie bisher: weiche Cartoon-Optik, dünne etwas dunklere Kontur, keine Schatten auf dem Boden.
- Höchstens zwei Versuche; das bessere Ergebnis speichern.

## Probe (1 Bild)

- Vorlage: `docs/tripo-vorlagen/dino-posen.png`
- Kleidung: das **Ringelshirt** (blau-weiß gestreift, lange Ärmel, Vorbild `tripo-in/tops/dino-ringelshirt.png`
  im Zweig `tripo-kleiderschrank`) und die **Jeans-Shorts** (Vorbild `tripo-in/wardrobe/jeansshorts.png`).
- Speichern unter `tripo-in/dressed/dino-ringelshirt-jeansshorts.png`, im Zweig `tripo-kleiderschrank` committen und
  pushen, dem Nutzer Bescheid geben.

Prompt (mit der Vorlage als zu bearbeitendem Bild und den beiden Kleidungsstücken als Vorbildern):

```
Edit this image, do not redraw it: the seven cartoon dinosaurs stay exactly the same - same size, same position in the grid, same pose, same face, same colors and outline, white background, image size unchanged. Only dress each of the seven in the blue-and-white striped long-sleeve sailor shirt and the blue denim shorts from the reference images. In every pose the clothes follow the body: the shirt covers chest and belly down to the hips with the collar right under the head; each sleeve lies on its arm exactly as the arm is posed (raised arm: the sleeve goes up with it; hand at the cheek: the sleeve lies along that arm), the hands stick out of the sleeves; the shorts sit on the hips and each leg of the shorts on its leg, the feet stick out below; the sitting dinosaur wears the shorts on its lap. Tail and back spikes stay uncovered. Same soft cartoon style with a thin darker outline, no ground shadow, no text.
```

Wenn die Probe gut aussieht, folgen pro Figur 16 Bilder (jedes Oberteil zusammen mit einer Hose), also 80 Bilder
für alle fünf Figuren.

---

# Alle Oberteile und Hosen direkt auf die Figuren gemalt (79 Bilder)

Probe 2 hat funktioniert: Die Kleidung lässt sich aus dem gemalten Bild sauber ausschneiden, die Ärmel folgen den
Armen, die Hosen den Beinen. Jetzt alle übrigen Bilder **genau wie in Probe 2** (Vorlage bearbeiten, nicht neu malen,
weißer Hintergrund, Bildgröße 2048 × 1024, gleiches Raster, Figuren unverändert an derselben Stelle).

## Zusätzlich beachten (damit das Ausschneiden klappt)

- Kopf, Hände, Füße, Schwanz und Flügel bleiben genau wie in der Vorlage, auch das „?" und das „Zzz".
- Den Körper nicht schmaler malen. Die Hände schauen deutlich aus den Ärmeln heraus.
- Das Oberteil reicht nur bis über den Bund der Hose, nicht tiefer.
- Jedes Kleidungsstück hat eine klare, geschlossene dunklere Kontur.
- Bei zwei Bildern ist die Figur selbst ähnlich gefärbt wie die Kleidung (Bienenkostüm und Clownshose auf dem
  gelben Küken): dort die Kontur besonders deutlich.

## Ablage

`tripo-in/dressed/<figur>-<oberteil>-<hose>.png` (beim Sternenpyjama ohne Hose: `<figur>-sternenpyjama.png`), im Zweig
`tripo-kleiderschrank`. Nach jeder Figur committen und pushen, dann sieht die Cloud-Sitzung die Bilder sofort.
Nichts kaufen; reicht das Guthaben nicht, aufhören und dem Nutzer sagen, wie viele fehlen.

## Reihenfolge

Zuerst das Küken (Lumi, die meisten Kinder), dann Dino, Einhorn, Drache, Roboter. Beim Dino ist Nr. 1 schon fertig.

## Prompt (für jedes Bild; `<FIGURE>`, `<TOP>` und `<BOTTOM>` aus der Liste einsetzen)

```
Edit this image, do not redraw it: the seven <FIGURE>s stay exactly the same - same size, same position in the grid, same pose, same face, same hands, feet, tail and wings, same colors and outline, keep the "?" and the "Zzz", white background, image size unchanged, do not make the bodies narrower. Only dress each of the seven in <TOP> and <BOTTOM>. In every pose the clothes follow the body: the top covers chest and belly down to just over the waistband with the collar right under the head; each sleeve lies on its arm exactly as the arm is posed (raised arm: the sleeve goes up with it; hand at the cheek: the sleeve lies along that arm), the hands stick out of the sleeves; the bottom sits on the hips and follows the legs, the feet stick out below; the sitting figure wears it on its lap. Every piece of clothing has a clear, closed, slightly darker outline. Same soft cartoon style, no ground shadow, no text.
```

Ohne Hose (Nr. 16) den Teil „and <BOTTOM>" und die Sätze über die Hose weglassen.

## Die Paare

| Nr. | Oberteil | Hose / Rock | `<TOP>` | `<BOTTOM>` |
|---|---|---|---|---|
| 1 | ringelshirt | jeansshorts | a blue-and-white striped long-sleeve sailor shirt | blue denim shorts with rolled hems |
| 2 | heldenshirt | skihose | a red superhero T-shirt with a yellow lightning bolt | puffy pink ski trousers |
| 3 | fussballtrikot | flickenjeans | a green football jersey with a white star | long blue jeans with colourful patches |
| 4 | hawaiihemd | bastrock | a turquoise hawaiian shirt with red and orange hibiscus flowers | a green hula grass skirt with small pink flowers |
| 5 | katzenhoodie | regenbogenleggings | a purple hoodie with little cat ears on the hood (hood down on the back) | rainbow-striped leggings |
| 6 | regenjacke | lederhose | a red rain jacket with buttons | brown short leather trousers (Lederhosen) with braces |
| 7 | bienenkostuem | tutu | a yellow-and-black striped bee costume top with tiny wings on the back | a pink ballet tutu |
| 8 | ritterruestung | piratenhose | a silver knight breastplate with a golden star | red-and-white striped pirate trousers with a rope belt |
| 9 | rettungsweste | entenbadehose | an orange life jacket | light blue swim shorts with little yellow ducks |
| 10 | kochjacke | schottenrock | a white chef jacket with two rows of buttons | a red tartan kilt with a small sporran |
| 11 | arztkittel | clownshose | a white doctor coat with a stethoscope | baggy yellow clown trousers with red dots and braces |
| 12 | astronautenjacke | prinzessinnenrock | a white-and-grey astronaut suit top with colourful buttons | a long pink princess skirt |
| 13 | skijacke | meerjungfrau | a pink puffy ski jacket with a fur collar | a turquoise mermaid tail with fins (instead of the legs; the feet are hidden in the tail) |
| 14 | smoking | fussballshorts | a black tuxedo jacket with a white shirt and a red bow tie | green football shorts |
| 15 | rentierpulli | pyjamahose | a green christmas sweater with a reindeer | dark blue pyjama trousers with yellow stars and moons |
| 16 | sternenpyjama | – | a dark blue pyjama top with yellow stars | – |

## Die Bilder

### Lumi, das Küken: Vorlage `docs/tripo-vorlagen/chick-posen.png`, `<FIGURE>` = `cartoon chick`

- [x] 1. `tripo-in/dressed/chick-ringelshirt-jeansshorts.png`
- [x] 2. `tripo-in/dressed/chick-heldenshirt-skihose.png`
- [x] 3. `tripo-in/dressed/chick-fussballtrikot-flickenjeans.png`
- [x] 4. `tripo-in/dressed/chick-hawaiihemd-bastrock.png`
- [x] 5. `tripo-in/dressed/chick-katzenhoodie-regenbogenleggings.png`
- [x] 6. `tripo-in/dressed/chick-regenjacke-lederhose.png`
- [x] 7. `tripo-in/dressed/chick-bienenkostuem-tutu.png`
- [x] 8. `tripo-in/dressed/chick-ritterruestung-piratenhose.png`
- [x] 9. `tripo-in/dressed/chick-rettungsweste-entenbadehose.png`
- [x] 10. `tripo-in/dressed/chick-kochjacke-schottenrock.png`
- [x] 11. `tripo-in/dressed/chick-arztkittel-clownshose.png`
- [x] 12. `tripo-in/dressed/chick-astronautenjacke-prinzessinnenrock.png`
- [x] 13. `tripo-in/dressed/chick-skijacke-meerjungfrau.png`
- [x] 14. `tripo-in/dressed/chick-smoking-fussballshorts.png`
- [x] 15. `tripo-in/dressed/chick-rentierpulli-pyjamahose.png`
- [x] 16. `tripo-in/dressed/chick-sternenpyjama.png`

### Dino: Vorlage `docs/tripo-vorlagen/dino-posen.png`, `<FIGURE>` = `cartoon dinosaur`

- [x] 1. `tripo-in/dressed/dino-ringelshirt-jeansshorts.png` (fertig)
- [x] 2. `tripo-in/dressed/dino-heldenshirt-skihose.png`
- [x] 3. `tripo-in/dressed/dino-fussballtrikot-flickenjeans.png`
- [x] 4. `tripo-in/dressed/dino-hawaiihemd-bastrock.png`
- [x] 5. `tripo-in/dressed/dino-katzenhoodie-regenbogenleggings.png`
- [x] 6. `tripo-in/dressed/dino-regenjacke-lederhose.png`
- [x] 7. `tripo-in/dressed/dino-bienenkostuem-tutu.png`
- [x] 8. `tripo-in/dressed/dino-ritterruestung-piratenhose.png`
- [x] 9. `tripo-in/dressed/dino-rettungsweste-entenbadehose.png`
- [x] 10. `tripo-in/dressed/dino-kochjacke-schottenrock.png`
- [x] 11. `tripo-in/dressed/dino-arztkittel-clownshose.png`
- [x] 12. `tripo-in/dressed/dino-astronautenjacke-prinzessinnenrock.png`
- [x] 13. `tripo-in/dressed/dino-skijacke-meerjungfrau.png`
- [x] 14. `tripo-in/dressed/dino-smoking-fussballshorts.png`
- [x] 15. `tripo-in/dressed/dino-rentierpulli-pyjamahose.png`
- [x] 16. `tripo-in/dressed/dino-sternenpyjama.png`

### Einhorn: Vorlage `docs/tripo-vorlagen/einhorn-posen.png`, `<FIGURE>` = `cartoon unicorn`

- [x] 1. `tripo-in/dressed/einhorn-ringelshirt-jeansshorts.png`
- [x] 2. `tripo-in/dressed/einhorn-heldenshirt-skihose.png`
- [x] 3. `tripo-in/dressed/einhorn-fussballtrikot-flickenjeans.png`
- [x] 4. `tripo-in/dressed/einhorn-hawaiihemd-bastrock.png`
- [x] 5. `tripo-in/dressed/einhorn-katzenhoodie-regenbogenleggings.png`
- [x] 6. `tripo-in/dressed/einhorn-regenjacke-lederhose.png`
- [x] 7. `tripo-in/dressed/einhorn-bienenkostuem-tutu.png`
- [x] 8. `tripo-in/dressed/einhorn-ritterruestung-piratenhose.png`
- [x] 9. `tripo-in/dressed/einhorn-rettungsweste-entenbadehose.png`
- [x] 10. `tripo-in/dressed/einhorn-kochjacke-schottenrock.png`
- [x] 11. `tripo-in/dressed/einhorn-arztkittel-clownshose.png`
- [x] 12. `tripo-in/dressed/einhorn-astronautenjacke-prinzessinnenrock.png`
- [x] 13. `tripo-in/dressed/einhorn-skijacke-meerjungfrau.png`
- [x] 14. `tripo-in/dressed/einhorn-smoking-fussballshorts.png`
- [x] 15. `tripo-in/dressed/einhorn-rentierpulli-pyjamahose.png`
- [x] 16. `tripo-in/dressed/einhorn-sternenpyjama.png`

### Drache: Vorlage `docs/tripo-vorlagen/drache-posen.png`, `<FIGURE>` = `cartoon dragon`

- [ ] 1. `tripo-in/dressed/drache-ringelshirt-jeansshorts.png`
- [ ] 2. `tripo-in/dressed/drache-heldenshirt-skihose.png`
- [ ] 3. `tripo-in/dressed/drache-fussballtrikot-flickenjeans.png`
- [ ] 4. `tripo-in/dressed/drache-hawaiihemd-bastrock.png`
- [ ] 5. `tripo-in/dressed/drache-katzenhoodie-regenbogenleggings.png`
- [ ] 6. `tripo-in/dressed/drache-regenjacke-lederhose.png`
- [ ] 7. `tripo-in/dressed/drache-bienenkostuem-tutu.png`
- [ ] 8. `tripo-in/dressed/drache-ritterruestung-piratenhose.png`
- [ ] 9. `tripo-in/dressed/drache-rettungsweste-entenbadehose.png`
- [ ] 10. `tripo-in/dressed/drache-kochjacke-schottenrock.png`
- [ ] 11. `tripo-in/dressed/drache-arztkittel-clownshose.png`
- [ ] 12. `tripo-in/dressed/drache-astronautenjacke-prinzessinnenrock.png`
- [ ] 13. `tripo-in/dressed/drache-skijacke-meerjungfrau.png`
- [ ] 14. `tripo-in/dressed/drache-smoking-fussballshorts.png`
- [ ] 15. `tripo-in/dressed/drache-rentierpulli-pyjamahose.png`
- [ ] 16. `tripo-in/dressed/drache-sternenpyjama.png`

### Roboter: Vorlage `docs/tripo-vorlagen/roboter-posen.png`, `<FIGURE>` = `cartoon robot`

- [ ] 1. `tripo-in/dressed/roboter-ringelshirt-jeansshorts.png`
- [ ] 2. `tripo-in/dressed/roboter-heldenshirt-skihose.png`
- [ ] 3. `tripo-in/dressed/roboter-fussballtrikot-flickenjeans.png`
- [ ] 4. `tripo-in/dressed/roboter-hawaiihemd-bastrock.png`
- [ ] 5. `tripo-in/dressed/roboter-katzenhoodie-regenbogenleggings.png`
- [ ] 6. `tripo-in/dressed/roboter-regenjacke-lederhose.png`
- [ ] 7. `tripo-in/dressed/roboter-bienenkostuem-tutu.png`
- [ ] 8. `tripo-in/dressed/roboter-ritterruestung-piratenhose.png`
- [ ] 9. `tripo-in/dressed/roboter-rettungsweste-entenbadehose.png`
- [ ] 10. `tripo-in/dressed/roboter-kochjacke-schottenrock.png`
- [ ] 11. `tripo-in/dressed/roboter-arztkittel-clownshose.png`
- [ ] 12. `tripo-in/dressed/roboter-astronautenjacke-prinzessinnenrock.png`
- [ ] 13. `tripo-in/dressed/roboter-skijacke-meerjungfrau.png`
- [ ] 14. `tripo-in/dressed/roboter-smoking-fussballshorts.png`
- [ ] 15. `tripo-in/dressed/roboter-rentierpulli-pyjamahose.png`
- [ ] 16. `tripo-in/dressed/roboter-sternenpyjama.png`

