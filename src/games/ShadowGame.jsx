import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { narrate } from '../narrator.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import { pxCard, pxBubble, pxButton, pxSegment, INK } from './px.js'

/**
 * Schattenrätsel — Visuelle Wahrnehmung & Kategorisierung
 * Scientific basis:
 *   • Visual Perception Development (Gibson, 1969) — recognizing silhouettes trains
 *     figure-ground discrimination, a core pre-reading skill.
 *   • Object Recognition (Biederman, 1987, Recognition by Components) — matching
 *     shadows to objects strengthens categorical shape perception in the brain.
 *   • Stimulating the "what pathway" in the visual cortex helps children map 2D → 3D
 *     representations, critical for geometry and spatial understanding.
 *
 * Mechanic: A dark card hides a silhouette; the child uncovers it bit by bit with a
 * torch (finger or mouse) and picks which real object matches. Higher levels get a
 * narrower beam and a tilted shadow.
 *
 * This game sizes itself (it is not put into the scaling frame, the torch needs real
 * pointer coordinates): the card takes whatever height is left, so the answers stay
 * on screen. They used to sit up to 320 px below the edge on a landscape tablet.
 */

// Every decoy has a clearly different outline from the answer. In a shadow
// colour and pattern are gone, so a zebra was a horse, a panda a bear and a
// small plane a plane: a child who read the shadow correctly was told it was
// wrong. Animals are full-body pictures where possible (a face is a round
// blob in silhouette). Facts are short, true, and without numbers a child of
// five cannot picture. The clue is the sound joker: what the thing sounds
// like or what it is for, without its name.
const CHALLENGES = [
  // Tiere
  { shadow: '🐘', name: 'Elefant',       decoys: ['🐪','🦘','🐢'], fact: 'Mit seinem langen Rüssel kann der Elefant trinken und duschen!',
    clue: 'Es hat eine ganz lange Nase und trompetet: Töröö!' },
  { shadow: '🐪', name: 'Kamel',         decoys: ['🐘','🐢','🐍'], fact: 'Das Kamel kann viele Tage ohne Wasser auskommen!',
    clue: 'Es hat Höcker auf dem Rücken und läuft durch die Wüste.' },
  { shadow: '🐎', name: 'Pferd',         decoys: ['🐢','🦘','🐿️'], fact: 'Pferde können sogar im Stehen schlafen!',
    clue: 'Es wiehert laut, und man kann darauf reiten.' },
  { shadow: '🦘', name: 'Känguru',       decoys: ['🐘','🐢','🐊'], fact: 'Das Känguru-Baby wohnt im Beutel seiner Mama!',
    clue: 'Es hüpft auf zwei großen Beinen ganz weit.' },
  { shadow: '🐇', name: 'Hase',          decoys: ['🐢','🦔','🐌'], fact: 'Hasen haben lange Ohren und hören sehr gut!',
    clue: 'Es hoppelt über die Wiese und knabbert gern Möhren.' },
  { shadow: '🐿️', name: 'Eichhörnchen',  decoys: ['🦔','🐢','🐌'], fact: 'Eichhörnchen verstecken im Herbst Nüsse für den Winter!',
    clue: 'Es klettert flink auf Bäume und sammelt Nüsse.' },
  { shadow: '🦔', name: 'Igel',          decoys: ['🐿️','🐇','🐊'], fact: 'Bei Gefahr rollt sich der Igel zu einer stacheligen Kugel zusammen!',
    clue: 'Es hat Stacheln auf dem Rücken und schnüffelt im Laub.' },
  { shadow: '🐢', name: 'Schildkröte',   decoys: ['🐊','🐇','🐍'], fact: 'Die Schildkröte trägt ihren Panzer immer mit sich herum!',
    clue: 'Es trägt einen harten Panzer und ist ganz langsam.' },
  { shadow: '🐊', name: 'Krokodil',      decoys: ['🐢','🐍','🐘'], fact: 'Krokodile gibt es schon seit der Zeit der Dinosaurier!',
    clue: 'Es schwimmt im Fluss und hat ein riesiges Maul voller Zähne.' },
  { shadow: '🐍', name: 'Schlange',      decoys: ['🐊','🐌','🐢'], fact: 'Schlangen haben keine Beine und schlängeln sich vorwärts!',
    clue: 'Es zischt und kriecht ohne Beine über den Boden.' },
  { shadow: '🦕', name: 'Dinosaurier',   decoys: ['🐊','🐘','🐢'], fact: 'Dinosaurier lebten vor sehr, sehr langer Zeit!',
    clue: 'Es brüllt laut und lebte vor ganz langer Zeit.' },
  { shadow: '🦈', name: 'Hai',           decoys: ['🐙','🦀','🐢'], fact: 'Haie verlieren ständig Zähne, und es wachsen immer neue nach!',
    clue: 'Es schwimmt im Meer und hat eine spitze Flosse auf dem Rücken.' },
  { shadow: '🐬', name: 'Delfin',        decoys: ['🐳','🦀','🐙'], fact: 'Delfine sind sehr klug und schwimmen sehr schnell!',
    clue: 'Es pfeift und klickt und springt hoch aus dem Wasser.' },
  { shadow: '🐳', name: 'Wal',           decoys: ['🐙','🦀','🐢'], fact: 'Wale sind die größten Tiere der Welt!',
    clue: 'Es ist riesengroß und spritzt Wasser aus dem Kopf in die Luft.' },
  { shadow: '🦀', name: 'Krabbe',        decoys: ['🐙','🐌','🐢'], fact: 'Krabben laufen seitwärts!',
    clue: 'Es hat zwei Scheren und krabbelt am Strand.' },
  { shadow: '🐙', name: 'Krake',         decoys: ['🦀','🐌','🐢'], fact: 'Eine Krake hat acht Arme!',
    clue: 'Es lebt im Meer und hat ganz viele Arme.' },
  { shadow: '🦋', name: 'Schmetterling', decoys: ['🐝','🐌','🐢'], fact: 'Bevor er fliegen kann, ist der Schmetterling eine Raupe!',
    clue: 'Es hat bunte Flügel und flattert von Blume zu Blume.' },
  { shadow: '🐝', name: 'Biene',         decoys: ['🦋','🐌','🐢'], fact: 'Bienen machen Honig und bestäuben Blumen!',
    clue: 'Es sammelt süßen Saft aus den Blumen und macht: Summ, summ!' },
  { shadow: '🐌', name: 'Schnecke',      decoys: ['🦋','🐍','🐇'], fact: 'Schnecken kriechen ganz langsam und tragen ihr Haus auf dem Rücken!',
    clue: 'Es trägt sein Haus auf dem Rücken und kriecht ganz langsam.' },
  { shadow: '🐧', name: 'Pinguin',       decoys: ['🦢','🐓','🦜'], fact: 'Pinguine können nicht fliegen, aber super schwimmen!',
    clue: 'Es watschelt über das Eis und kann nicht fliegen.' },
  { shadow: '🦢', name: 'Schwan',        decoys: ['🐧','🐓','🦜'], fact: 'Schwäne haben einen langen, gebogenen Hals!',
    clue: 'Es schwimmt auf dem See und hat einen langen Hals.' },
  { shadow: '🐓', name: 'Hahn',          decoys: ['🐧','🦢','🐿️'], fact: 'Der Hahn kräht am Morgen: Kikeriki!',
    clue: 'Es ruft am Morgen: Kikeriki!' },
  { shadow: '🦜', name: 'Papagei',       decoys: ['🐧','🦢','🦋'], fact: 'Papageien können Wörter nachsprechen!',
    clue: 'Es ist ganz bunt und kann sprechen: Hallo, hallo!' },
  { shadow: '🦅', name: 'Adler',         decoys: ['🐧','🦢','🐓'], fact: 'Adler sehen ganz weit, viel weiter als wir!',
    clue: 'Es kreist hoch am Himmel und hat scharfe Augen.' },
  { shadow: '🐅', name: 'Tiger',         decoys: ['🐘','🦘','🐢'], fact: 'Tiger sind die größten Katzen der Welt!',
    clue: 'Es brüllt laut und hat Streifen im Fell.' },
  { shadow: '🐒', name: 'Affe',          decoys: ['🐘','🐢','🐊'], fact: 'Affen klettern geschickt von Baum zu Baum!',
    clue: 'Es klettert von Ast zu Ast und ruft: Uh-uh-ah-ah!' },
  { shadow: '🦏', name: 'Nashorn',       decoys: ['🐇','🐢','🐊'], fact: 'Das Nashorn hat ein Horn auf der Nase!',
    clue: 'Es ist groß und schwer und hat ein spitzes Horn auf der Nase.' },
  // Fahrzeuge
  { shadow: '🚀', name: 'Rakete',        decoys: ['🚁','🚲','⛵'], fact: 'Raketen fliegen bis ins Weltall!',
    clue: 'Damit kann man bis zum Mond fliegen.' },
  { shadow: '✈️', name: 'Flugzeug',      decoys: ['🚀','🚁','🚲'], fact: 'Flugzeuge fliegen hoch über den Wolken!',
    clue: 'Damit kann man fliegen. Es hat zwei lange Flügel und bringt viele Leute in den Urlaub.' },
  { shadow: '🚁', name: 'Hubschrauber',  decoys: ['🚀','⛵','🚲'], fact: 'Hubschrauber können auf der Stelle fliegen!',
    clue: 'Damit kann man fliegen. Oben dreht sich ein großer Propeller: flapp, flapp, flapp!' },
  { shadow: '🚂', name: 'Lokomotive',    decoys: ['🚁','🚲','⛵'], fact: 'Früher fuhren Lokomotiven mit Dampf: tschu-tschu!',
    clue: 'Es fährt auf Schienen und macht: Tschu-tschu!' },
  { shadow: '⛵', name: 'Segelboot',     decoys: ['🚂','🚲','🚁'], fact: 'Ein Segelboot fährt mit der Kraft des Windes!',
    clue: 'Damit fährt man über das Wasser, und der Wind schiebt es an.' },
  { shadow: '🚲', name: 'Fahrrad',       decoys: ['🛴','🚁','⛵'], fact: 'Beim Fahrradfahren trittst du in die Pedale!',
    clue: 'Es klingelt: Kling, kling! Man tritt in die Pedale.' },
  { shadow: '🛴', name: 'Roller',        decoys: ['🚲','🚁','⛵'], fact: 'Mit dem Roller stößt du dich mit einem Fuß ab!',
    clue: 'Damit fährt man, und man stößt sich mit einem Fuß ab.' },
  { shadow: '🚜', name: 'Traktor',       decoys: ['🚲','⛵','🚁'], fact: 'Der Traktor zieht schwere Sachen auf dem Bauernhof!',
    clue: 'Es tuckert beim Bauern über das Feld.' },
  // Natur
  { shadow: '🌵', name: 'Kaktus',        decoys: ['🌴','🍄','🏠'], fact: 'Kakteen speichern Wasser in der Wüste!',
    clue: 'Es wächst in der Wüste und hat spitze Stacheln.' },
  { shadow: '🍄', name: 'Pilz',          decoys: ['🌵','🌴','🌲'], fact: 'Manche Pilze sind giftig, darum nie einfach einen essen!',
    clue: 'Es wächst im Wald und hat einen Hut.' },
  { shadow: '🌴', name: 'Palme',         decoys: ['🌲','🌵','🍄'], fact: 'Palmen wachsen in warmen Ländern!',
    clue: 'Es ist ein Baum am Strand, an dem Kokosnüsse wachsen.' },
  { shadow: '🌲', name: 'Tanne',         decoys: ['🌴','🍄','🌵'], fact: 'Die Tanne bleibt auch im Winter grün!',
    clue: 'Es ist ein Baum mit Nadeln, den man zu Weihnachten schmückt.' },
  { shadow: '🌋', name: 'Vulkan',        decoys: ['🍄','🏠','🌴'], fact: 'Ein Vulkan kann sehr heiße Lava ausspucken!',
    clue: 'Es ist ein Berg, der rumpelt und heiße Lava spuckt.' },
  // Gebäude
  { shadow: '⛺', name: 'Zelt',          decoys: ['🏰','🗼','🌴'], fact: 'Im Zelt schläft man draußen in der Natur!',
    clue: 'Darin schläft man im Urlaub draußen auf der Wiese.' },
  { shadow: '🏰', name: 'Schloss',       decoys: ['🏠','⛺','🗼'], fact: 'In einem Schloss wohnten früher Könige und Königinnen!',
    clue: 'Darin wohnen der König und die Königin.' },
  { shadow: '🗼', name: 'Turm',          decoys: ['🏠','🏰','⛺'], fact: 'Von einem hohen Turm kann man ganz weit schauen!',
    clue: 'Es ist ganz hoch und schmal. Von oben sieht man ganz weit.' },
  // Instrumente
  { shadow: '🎸', name: 'Gitarre',       decoys: ['🎺','🥁','☂️'], fact: 'Eine Gitarre hat Saiten, an denen man zupft!',
    clue: 'Damit macht man Musik: Man zupft an den Saiten.' },
  { shadow: '🎺', name: 'Trompete',      decoys: ['🎸','🥁','✂️'], fact: 'Die Trompete klingt sehr hell und laut!',
    clue: 'Da bläst man hinein, und es macht Tätärätä!' },
  { shadow: '🎻', name: 'Geige',         decoys: ['🎺','🥁','🔑'], fact: 'Die Geige spielt man mit einem Bogen!',
    clue: 'Damit macht man Musik: Man streicht mit einem Bogen über die Saiten.' },
  { shadow: '🥁', name: 'Trommel',       decoys: ['🎸','🎺','🎻'], fact: 'Auf einer Trommel kann man laut und leise spielen!',
    clue: 'Es macht Bumm, bumm, bumm!' },
  // Dinge
  { shadow: '🔭', name: 'Fernrohr',      decoys: ['🔑','✂️','☂️'], fact: 'Mit einem Fernrohr kann man die Sterne sehen!',
    clue: 'Damit kann man ganz weit weg schauen, bis zu den Sternen.' },
  { shadow: '☂️', name: 'Regenschirm',   decoys: ['🔑','✂️','🎸'], fact: 'Der Regenschirm hält dich bei Regen trocken!',
    clue: 'Damit bleibt man trocken, wenn es regnet.' },
  { shadow: '🔑', name: 'Schlüssel',     decoys: ['✂️','☂️','🔭'], fact: 'Mit einem Schlüssel schließt man die Tür auf!',
    clue: 'Damit schließt man die Tür auf.' },
  { shadow: '✂️', name: 'Schere',        decoys: ['🔑','☂️','🎺'], fact: 'Mit einer Schere schneidet man Papier!',
    clue: 'Damit schneidet man Papier: schnipp, schnapp!' },
  { shadow: '⚓', name: 'Anker',         decoys: ['🔑','✂️','☂️'], fact: 'Der Anker hält das Schiff fest!',
    clue: 'Es hält das Schiff fest, damit es nicht wegtreibt.' },
  { shadow: '🪁', name: 'Drachen',       decoys: ['🎈','☂️','⛵'], fact: 'Im Herbst lässt man Drachen im Wind steigen!',
    clue: 'Es hat einen langen Schwanz und tanzt an einer Schnur im Wind.' },
  { shadow: '🎈', name: 'Luftballon',    decoys: ['🪁','☂️','⚓'], fact: 'Ein Luftballon mit Gas fliegt nach oben!',
    clue: 'Man pustet es ganz dick auf, und wenn es platzt, macht es Peng!' },
  // Obst und Gemüse
  { shadow: '🍌', name: 'Banane',        decoys: ['🍎','🍐','🍦'], fact: 'Bananen wachsen in warmen Ländern!',
    clue: 'Es ist gelb und krumm, und Affen essen es gern.' },
  { shadow: '🍐', name: 'Birne',         decoys: ['🍌','🥕','🍦'], fact: 'Eine Birne ist unten dick und oben schmal!',
    clue: 'Es ist ein saftiges Obst, unten dick und oben schmal.' },
  { shadow: '🥕', name: 'Möhre',         decoys: ['🍌','🍐','🍎'], fact: 'Möhren wachsen unter der Erde!',
    clue: 'Es ist orange, wächst unter der Erde, und Hasen knabbern es gern.' },
]

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// Continue button: dark text, white on the light green was hard to read
const NEXT_BTN = { ...pxButton('green'), color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.45)' }

export default function ShadowGame({ level = 1, onComplete }) {
  const roundCount = level <= 4 ? 8 : level <= 7 ? 10 : 12
  const [challenges] = useState(() => shuffle(CHALLENGES).slice(0, roundCount))
  const [idx,          setIdx]         = useState(0)
  const [selected,     setSelected]    = useState(null)
  const [showFact,     setShowFact]    = useState(false)
  const [revealed,     setRevealed]    = useState(false)
  const [showWeiter,   setShowWeiter]  = useState(false)
  // two-phase reveal — revealed moves the silhouette, colorRevealed colours it
  const [colorRevealed, setColorRevealed] = useState(false)
  const [mood,         setMood]        = useState('thinking')
  const [wrongPicks,   setWrongPicks]  = useState([])
  // after two wrong picks the whole shadow is lit, as a hint
  const [fullLight,    setFullLight]   = useState(false)
  // the hand that shows how to move the torch, until the child does
  const [moved,        setMoved]       = useState(false)
  // the sound joker, once a round
  const [hintUsed,     setHintUsed]    = useState(false)
  const firstTryRef = useRef(0)

  const ch      = challenges[idx]
  // Freeze option order per question
  const options = useMemo(() => ch ? shuffle([ch.shadow, ...ch.decoys]) : [], [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  // On higher levels the shadow rotates more aggressively
  const shadowRotate = level <= 2 ? 0
    : level <= 5 ? (idx % 2 === 0 ? -16 : 16)
    : (idx % 3 === 0 ? -32 : idx % 3 === 1 ? 32 : -16)
  // Where in the card the shadow hides, 0..1 across the free space
  const spot = useMemo(() => ({ u: Math.random(), v: Math.random() }), [idx])

  // Flashlight — direct DOM mutation, zero React re-renders
  const cardRef    = useRef(null)
  const overlayRef = useRef(null)
  const resizeRef  = useRef(null)
  const [card, setCard] = useState({ w: 600, h: 400 })
  // A new card mounts every round (it animates in), so it is measured
  // through the ref callback rather than once
  const setCardEl = useCallback((el) => {
    cardRef.current = el
    resizeRef.current?.disconnect()
    if (!el) return
    const measure = () => setCard(c => (c.w === el.clientWidth && c.h === el.clientHeight ? c : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    resizeRef.current = new ResizeObserver(measure)
    resizeRef.current.observe(el)
  }, [])
  useEffect(() => () => resizeRef.current?.disconnect(), [])

  // The shadow is sized by the card, so it fits on a phone as on a monitor
  const shadowSize = Math.round(Math.max(60, Math.min(card.h * 0.44, card.w * 0.4, 230)))
  const halfW = (shadowSize / 2 / card.w) * 100 + 3
  const halfH = (shadowSize / 2 / card.h) * 100 + 3
  const shadowPos = {
    leftPct: halfW + spot.u * Math.max(0, 100 - 2 * halfW),
    topPct:  halfH + spot.v * Math.max(0, 100 - 2 * halfH),
  }

  // How much of the picture the torch uncovers at once, relative to the card.
  // A narrower beam on higher levels forces the shape to be assembled from
  // parts.
  const beam = Math.round(Math.min(card.w, card.h) * (level <= 2 ? 0.36 : level <= 5 ? 0.27 : level <= 8 ? 0.2 : 0.16))

  // The task, at the start of every round. The first one explains the torch:
  // on a tablet there is no hovering, only dragging a finger, and nothing
  // said so.
  useEffect(() => {
    sayTask(idx === 0
      ? 'Im Dunkeln versteckt sich etwas! Wisch mit dem Finger über das dunkle Feld, dann leuchtet die Taschenlampe. Was ist es? Tipp unten auf das richtige Bild.'
      : 'Was versteckt sich hier? Leuchte mit der Lampe!')
  }, [idx])

  const onPointerMove = useCallback((e) => {
    const overlay = overlayRef.current
    const el      = cardRef.current
    if (!overlay || !el) return
    if (!moved) setMoved(true)
    const rect = el.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1)
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1)
    // mask: black = overlay visible (dark), transparent = overlay hidden (shadow shows through)
    const mask = `radial-gradient(circle ${beam}px at ${x}% ${y}%, transparent 0%, transparent ${Math.round(beam * 0.39)}px, black ${Math.round(beam * 0.89)}px, black ${beam}px)`
    overlay.style.maskImage = mask
    overlay.style.webkitMaskImage = mask
  }, [beam, moved])

  const onPointerLeave = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.style.maskImage = ''
    overlay.style.webkitMaskImage = ''
  }, [])

  const weiterClick = useCallback(() => {
    setShowFact(false)
    setShowWeiter(false)
    if (idx + 1 >= challenges.length) {
      // Stars from the rounds solved at the first pick (lib/score.js), so the
      // result no longer says "8 von 8 richtig" next to two stars.
      onComplete(result(firstTryRef.current, challenges.length))
    } else {
      setIdx(i => i + 1)
      setSelected(null)
      setWrongPicks([])
      setFullLight(false)
      setMoved(false)
      setHintUsed(false)
      setMood('thinking')
      setRevealed(false)
      setColorRevealed(false)
    }
  }, [idx, challenges, onComplete])

  const pick = useCallback((emoji) => {
    if (selected !== null || !ch) return
    const ok = emoji === ch.shadow
    if (!ok) {
      // A wrong pick is marked and the round stays open, so the child can
      // look again with the torch. After the second one the whole shadow is
      // lit.
      const picks = wrongPicks.includes(emoji) ? wrongPicks : [...wrongPicks, emoji]
      setWrongPicks(picks)
      setMood('encouraging')
      if (picks.length >= 2) {
        setFullLight(true)
        sayWrong('Schau, jetzt leuchtet der ganze Schatten. Welches Bild hat diese Form?')
      } else {
        sayWrong('Schau noch mal mit der Lampe!')
      }
      setTimeout(() => setMood('thinking'), 1200)
      return
    }
    // A round solved with the joker is not counted as first try, without a
    // word about it
    if (wrongPicks.length === 0 && !hintUsed) firstTryRef.current += 1
    setSelected(emoji)
    setMood('excited')
    setRevealed(true)
    setTimeout(() => setColorRevealed(true), 700)
    sayRight(`${ch.name}! ${ch.fact}`)
    setShowFact(true)
    setTimeout(() => setShowWeiter(true), 800)
  }, [selected, ch, wrongPicks, hintUsed])

  // The sound joker: Lumi gives a clue without naming the thing. Once a
  // round; pressing it again does nothing.
  const giveHint = useCallback(() => {
    if (hintUsed || selected !== null || !ch) return
    setHintUsed(true)
    narrate([{ text: `Hör mal! ${ch.clue}` }])
  }, [hintUsed, selected, ch])

  if (!ch) return null
  const solved = selected !== null

  return (
    <div style={{
      flex:1, minHeight:0, width:'100%', boxSizing:'border-box',
      display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(10px,2vw,24px) clamp(12px,3vw,32px)',
      gap:'clamp(8px,1.6vh,18px)',
      overflow:'hidden',
    }}>

      {/* Progress */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:700, flexShrink:0 }}>
        {challenges.map((_, i) => (
          <div key={i} style={{
            flex:1, ...pxSegment(i < idx ? 'done' : i === idx ? 'current' : 'todo'),
            transition:'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:820, flexShrink:0 }}>
        <LumiCharacter mood={mood} size={64} />
        <div style={{
          flex:1, ...pxBubble,
          padding:'10px 18px',
          fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.2vw,22px)',
          color:'var(--text-primary)',
        }}>
          {solved ? `Richtig! Das ist: ${ch.name}`
            : hintUsed ? ch.clue
            : 'Leuchte mit der Taschenlampe über den Schatten! 🔦'}
        </div>
        <motion.button
          onClick={giveHint}
          disabled={hintUsed || solved}
          whileTap={hintUsed || solved ? {} : { scale: 0.92 }}
          {...hearable('Tipp', { enabled: !hintUsed && !solved })}
          aria-label="Tipp anhören"
          style={{
            ...pxButton('gold'),
            flexShrink:0, width:64, minHeight:60, padding:'4px 0',
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:2,
            fontSize:15, lineHeight:1,
            opacity: hintUsed || solved ? 0.45 : 1,
            cursor: hintUsed || solved ? 'default' : 'pointer',
          }}
        >
          <span style={{ fontSize:28, lineHeight:1 }}>🔊</span>
          Tipp
        </motion.button>
      </div>

      {/* Shadow display — dark room with flashlight. It takes the height
          that is left, so the answers below always fit. */}
      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ scale:0.85, opacity:0 }} animate={{ scale:1, opacity:1 }}
          exit={{ scale:0.85, opacity:0 }}
          transition={{ type:'spring', stiffness:260, damping:20 }}
          ref={setCardEl}
          onPointerMove={onPointerMove}
          onPointerDown={onPointerMove}
          onPointerLeave={onPointerLeave}
          style={{
            // pure white background so the black silhouette shows in the beam
            background: '#ffffff',
            border:`3px solid ${INK}`,
            borderRadius:14,
            padding:0,
            boxShadow:'0 5px 0 rgba(42,27,61,0.35)',
            width:'100%', maxWidth:820,
            flex:'1 1 0', minHeight:150, maxHeight:560,
            position:'relative', overflow:'hidden',
            cursor: revealed ? 'default' : 'crosshair',
            touchAction:'none',
          }}
        >
          {/* Silhouette — random position, smooth reveal to the upper middle */}
          <motion.div
            animate={revealed
              ? { left: '50%', top: showFact ? '36%' : '50%', x: '-50%', y: '-50%', rotate: 0, scale: 0.9 }
              : { left: `${shadowPos.leftPct}%`, top: `${shadowPos.topPct}%`, x: '-50%', y: '-50%', rotate: shadowRotate, scale: 1 }
            }
            transition={{ type: 'spring', stiffness: 140, damping: 16 }}
            style={{ position: 'absolute', pointerEvents: 'none', lineHeight: 1, userSelect: 'none' }}
          >
            {/* brightness(0) = pure black silhouette, coloured once solved */}
            <motion.span
              animate={{ filter: colorRevealed ? 'brightness(1)' : 'brightness(0)' }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              style={{ fontSize: shadowSize, display: 'block', mixBlendMode: 'multiply' }}
            >
              {ch.shadow}
            </motion.span>
          </motion.div>

          {/* Flashlight overlay: fully opaque, so nothing of the shadow shows
              outside the beam (at 97 % the black shape was visible through it) */}
          {!solved && !revealed && !fullLight && (
            <div
              ref={overlayRef}
              style={{
                position:'absolute', inset:0, borderRadius:11,
                pointerEvents:'none', zIndex:10,
                background:'rgb(6,0,15)',
              }}
            />
          )}

          {/* A hand shows how to move the torch, until the child does */}
          {!solved && !moved && !fullLight && (
            <motion.div
              aria-hidden
              animate={{ x: ['-60%', '60%', '-60%'], y: [0, -14, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position:'absolute', left:'45%', top:'52%', zIndex:11,
                fontSize:'clamp(40px,8vh,64px)', pointerEvents:'none', lineHeight:1,
              }}
            >
              👆
            </motion.div>
          )}

          {/* Fun fact and the way on, inside the card */}
          <AnimatePresence>
            {showFact && (
              <motion.div
                initial={{ opacity:0, y:16 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:8 }}
                transition={{ delay: 0.5 }}
                style={{
                  position:'absolute', bottom:10, left:'4%', width:'92%',
                  zIndex:12, boxSizing:'border-box',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:12, flexWrap:'wrap',
                  background:'#DDF6CF',
                  border:`3px solid #2F8F3A`,
                  borderRadius:12,
                  boxShadow:'0 4px 0 rgba(42,27,61,0.35)',
                  padding:'10px 14px',
                  fontFamily:'var(--font-body)', fontWeight:700,
                  fontSize:'clamp(15px,2.4vw,18px)',
                  color:INK, textAlign:'center',
                }}
              >
                <span style={{ flex:'1 1 220px' }}>{ch.fact}</span>
                {showWeiter && (
                  <motion.button
                    initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }}
                    onClick={weiterClick}
                    {...hearable(idx + 1 >= challenges.length ? 'Fertig' : 'Weiter')}
                    style={{ ...NEXT_BTN, padding:'10px 28px', minHeight:48, fontSize:20, flexShrink:0 }}
                  >
                    {idx + 1 >= challenges.length ? '🏁 Fertig!' : 'Weiter! →'}
                  </motion.button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Options: one row of four, so they never drop below the screen */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(4,1fr)',
        gap:'clamp(8px,1.6vw,16px)',
        width:'100%', maxWidth:820, flexShrink:0,
      }}>
        {options.map((emoji, i) => {
          const isCorrect = emoji === ch.shadow
          const isWrong   = wrongPicks.includes(emoji)

          let cardState
          if (solved && isCorrect) cardState = 'right'
          else if (isWrong)        cardState = 'wrong'

          return (
            <motion.button key={`${idx}-${i}`}
              initial={{ opacity:0, y:14 }}
              transition={{ delay:i*0.06, type:'spring', stiffness:300 }}
              whileHover={!solved && !isWrong ? { scale:1.05 } : {}}
              whileTap={!solved && !isWrong ? { scale:0.95 } : {}}
              animate={{ opacity: isWrong || (solved && !isCorrect) ? 0.5 : 1, y: 0 }}
              onClick={() => { if (!isWrong) pick(emoji) }}
              aria-label={`Bild ${i + 1}`}
              style={{
                height:'clamp(64px,14vh,120px)',
                ...pxCard(cardState),
                fontSize:'min(8vh, 11vw, 64px)',
                cursor:solved ? 'default' : 'pointer',
                transition:'background 0.22s, border 0.22s', lineHeight:1,
                display:'flex', alignItems:'center', justifyContent:'center',
                padding:4,
              }}
            >
              <motion.span
                animate={solved && isCorrect ? { scale:[1,1.3,1], rotate:[0,15,-15,0] } : {}}
                transition={{ duration:0.55 }}
              >
                {emoji}
              </motion.span>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
