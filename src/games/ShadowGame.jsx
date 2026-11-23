import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import HearOptions from '../components/HearOptions.jsx'
import { Art, DragArea, Draggable, DropZone, useBursts } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { narrate, afterNarration } from '../narrator.js'
import { hearable } from '../lib/hearable.js'
import { usePaused } from '../lib/pause.js'
import { result } from '../lib/score.js'
import { pxCard, pxButton, INK } from './px.js'

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
 * Mechanic: something hides in a dark room. The child shines a torch over it
 * (finger or mouse; on a touch screen the light sits just above the finger,
 * so the finger does not cover it), and the hidden thing giggles when the
 * light first touches it. Then the child drags the matching picture into the
 * room (or just taps it). A right one switches the light on: the room turns
 * colourful, the thing waves hello and tells its fact, and it hangs a lit
 * bulb with its picture on the garland of friends above the room. A wrong one
 * bounces back and the shadow shakes its head. Higher levels get a narrower
 * beam and a tilted shadow.
 *
 * This game sizes itself (it is not put into the scaling frame, the torch needs real
 * pointer coordinates): the room takes whatever height is left, so the answers stay
 * on screen.
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

const BULBS = ['#ffc93c', '#ff6b5b', '#4aa3ff', '#3fc1a8', '#5cc45a', '#ff8fb8', '#b98cff']
// The room with the light on: striped wallpaper, a warm glow from the lamp, a floor
const ROOM_LIT = [
  'radial-gradient(ellipse at 50% 4%, rgba(255,250,215,0.95), rgba(255,250,215,0) 58%)',
  'linear-gradient(to top, #c98a52 0 13%, #8a4f22 13% 14%, transparent 14%)',
  'repeating-linear-gradient(90deg, #ffe3f1 0 34px, #d9f1ff 34px 68px, #fff2c2 68px 102px)',
].join(', ')
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Width of an element, kept up to date
function useWidth() {
  const ref = useRef(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setW(el.clientWidth))
    ro.observe(el)
    setW(el.clientWidth)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

// The garland above the room: one bulb per round. Each found thing lights
// its bulb and hangs below it; tapped, it giggles and says its name.
function Garland({ total, found, party }) {
  const [ref, w] = useWidth()
  const pic = Math.max(18, Math.min(44, Math.floor(w / total) - 6))
  return (
    <div ref={ref} role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={found.length}
      aria-label={`${found.length} von ${total} gefunden`}
      style={{ width: '100%', maxWidth: 820, height: pic + 30, display: 'flex', flexShrink: 0 }}>
      {Array.from({ length: total }, (_, i) => {
        const f = found[i]
        const color = BULBS[i % BULBS.length]
        return (
          <div key={i} style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <svg viewBox="0 0 100 24" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 20 }}>
              <path d="M0 3 Q50 26 100 3" fill="none" stroke={INK} strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
            <motion.div aria-hidden="true"
              animate={party && f && !reduceMotion() ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, repeat: party ? Infinity : 0, delay: i * 0.08 }}
              style={{
                marginTop: 9, width: 14, height: 18, borderRadius: '50% 50% 45% 45%', border: `2px solid ${INK}`, boxSizing: 'border-box',
                background: f ? color : '#5b5470', boxShadow: f ? `0 0 12px 4px ${color}` : 'none', transition: 'background .4s, box-shadow .4s',
              }} />
            {f && (
              <motion.button type="button" aria-label={f.name}
                initial={{ scale: 0, y: -30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                whileTap={{ rotate: [0, -15, 15, 0], scale: 1.2 }}
                onClick={() => { sfx.giggle(); narrate([{ text: `${f.name}!` }], { skipIfSame: true }) }}
                style={{ all: 'unset', cursor: 'pointer', marginTop: 1, width: pic, height: pic, borderRadius: '50%', background: '#fffdf7', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Art art={f.emoji} size={pic - 6} />
              </motion.button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// The ceiling lamp: dark until the thing is found, then it swings and glows
function Lamp({ on }) {
  return (
    <motion.div aria-hidden="true" animate={on && !reduceMotion() ? { rotate: [0, 14, -10, 6, 0] } : { rotate: 0 }} transition={{ duration: 1.4 }}
      style={{ position: 'absolute', left: '50%', top: 0, marginLeft: -22, width: 44, transformOrigin: '50% 0', zIndex: 2 }}>
      <div style={{ width: 3, height: 18, margin: '0 auto', background: INK }} />
      <svg viewBox="0 0 44 28" width="44" height="28" style={{ display: 'block', overflow: 'visible' }}>
        {on && <ellipse cx="22" cy="30" rx="30" ry="10" fill="#fff7c2" opacity="0.8" />}
        <path d="M4 24 Q22 -8 40 24 Z" fill={on ? '#ff6b5b' : '#4a4260'} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <circle cx="22" cy="25" r="6" fill={on ? '#fff3a0' : '#6d6585'} stroke={INK} strokeWidth="2" />
      </svg>
    </motion.div>
  )
}

// Bunting along the ceiling, once the light is on
function Bunting() {
  return (
    <motion.svg viewBox="0 0 200 16" preserveAspectRatio="none" aria-hidden="true" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
      style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: 26, zIndex: 1 }}>
      <path d="M0 2 Q100 10 200 2" fill="none" stroke={INK} strokeWidth="1" vectorEffect="non-scaling-stroke" />
      {Array.from({ length: 12 }, (_, i) => {
        const x = 4 + i * 16.5, y = 2 + 8 * Math.sin(Math.PI * (x / 200)) * 0.9
        return <path key={i} d={`M${x} ${y} L${x + 10} ${y} L${x + 5} ${y + 11} Z`} fill={BULBS[i % BULBS.length]} stroke={INK} strokeWidth="0.6" />
      })}
    </motion.svg>
  )
}

export default function ShadowGame({ level = 1, onComplete }) {
  const roundCount = level <= 4 ? 8 : level <= 7 ? 10 : 12
  const [challenges] = useState(() => shuffle(CHALLENGES).slice(0, roundCount))
  const [idx,        setIdx]        = useState(0)
  const [solved,     setSolved]     = useState(false)
  const [colored,    setColored]    = useState(false)   // the thing has its colours back
  const [showWeiter, setShowWeiter] = useState(false)
  const [wrongPicks, setWrongPicks] = useState([])
  // after two wrong picks the whole shadow is lit, as a hint
  const [fullLight,  setFullLight]  = useState(false)
  // the hand that shows how to move the torch, until the child does
  const [moved,      setMoved]      = useState(false)
  // the sound joker, once a round
  const [hintUsed,   setHintUsed]   = useState(false)
  const [found,      setFound]      = useState([])
  const [advance,    setAdvance]    = useState(false)   // the fact was told, go on when not paused
  const paused      = usePaused()
  const firstTryRef = useRef(0)
  const stopWait    = useRef(null)
  const peeked      = useRef(false)                      // the hidden thing giggled this round
  const [bursts, burst] = useBursts()

  const ch      = challenges[idx]
  const last    = idx + 1 >= challenges.length
  // Freeze option order per question
  const options = useMemo(() => ch ? shuffle([ch.shadow, ...ch.decoys]) : [], [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  // On higher levels the shadow rotates more aggressively
  const shadowRotate = level <= 2 ? 0
    : level <= 5 ? (idx % 2 === 0 ? -16 : 16)
    : (idx % 3 === 0 ? -32 : idx % 3 === 1 ? 32 : -16)
  // Where in the room the shadow hides, 0..1 across the free space
  const spot = useMemo(() => ({ u: Math.random(), v: Math.random() }), [idx]) // eslint-disable-line react-hooks/exhaustive-deps -- a new place each round

  // Torch — direct DOM mutation, zero React re-renders
  const cardRef    = useRef(null)
  const overlayRef = useRef(null)
  const torchRef   = useRef(null)
  const shadowRef  = useRef(null)
  const resizeRef  = useRef(null)
  const [card, setCard] = useState({ w: 600, h: 400 })
  // A new room mounts every round (it animates in), so it is measured
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
  useEffect(() => () => { resizeRef.current?.disconnect(); stopWait.current?.() }, [])

  // The shadow is sized by the room, so it fits on a phone as on a monitor
  const shadowSize = Math.round(Math.max(60, Math.min(card.h * 0.44, card.w * 0.4, 230)))
  const halfW = (shadowSize / 2 / card.w) * 100 + 3
  const halfH = (shadowSize / 2 / card.h) * 100 + 3
  const shadowPos = {
    leftPct: halfW + spot.u * Math.max(0, 100 - 2 * halfW),
    topPct:  halfH + spot.v * Math.max(0, 100 - 2 * halfH),
  }

  // How much of the picture the torch uncovers at once, relative to the room.
  // A narrower beam on higher levels forces the shape to be assembled from
  // parts.
  const beam = Math.round(Math.min(card.w, card.h) * (level <= 2 ? 0.36 : level <= 5 ? 0.27 : level <= 8 ? 0.2 : 0.16))
  const torchSize = Math.round(Math.max(48, Math.min(92, beam * 0.62)))

  // The task, at the start of every round. The first one explains the torch:
  // on a tablet there is no hovering, only dragging a finger.
  const task = idx === 0
    ? 'Im Dunkeln versteckt sich etwas! Wisch mit dem Finger über das dunkle Zimmer, dann leuchtet die Taschenlampe. Was ist es? Zieh das richtige Bild ins Zimmer.'
    : 'Was versteckt sich hier? Leuchte mit der Lampe!'
  useEffect(() => { sayTask(task) }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const onPointerMove = useCallback((e) => {
    const overlay = overlayRef.current
    const el      = cardRef.current
    if (!overlay || !el) return
    if (!moved) setMoved(true)
    const rect = el.getBoundingClientRect()
    const px = e.clientX - rect.left, py = e.clientY - rect.top
    // on a touch screen the light shines just above the finger
    const touch = e.pointerType !== 'mouse'
    const bx = px, by = py - (touch ? beam * 0.7 : 0)
    // mask: black = overlay visible (dark), transparent = overlay hidden (shadow shows through)
    const mask = `radial-gradient(circle ${beam}px at ${bx}px ${by}px, transparent 0%, transparent ${Math.round(beam * 0.39)}px, black ${Math.round(beam * 0.89)}px, black ${beam}px)`
    overlay.style.maskImage = mask
    overlay.style.webkitMaskImage = mask
    const torch = torchRef.current
    if (torch) {
      torch.style.opacity = 1
      torch.style.transform = touch
        ? `translate(${px - torchSize / 2}px, ${py - torchSize * 0.3}px) rotate(-45deg)`
        : `translate(${px}px, ${py}px) rotate(-90deg)`
    }
    // the first time the light touches it, the hidden thing giggles
    const dx = bx - (shadowPos.leftPct / 100) * rect.width, dy = by - (shadowPos.topPct / 100) * rect.height
    if (!peeked.current && Math.hypot(dx, dy) < shadowSize * 0.4) {
      peeked.current = true
      sfx.giggle()
      shadowRef.current?.animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }], { duration: 500 })
    }
  }, [beam, moved, torchSize, shadowPos.leftPct, shadowPos.topPct, shadowSize])

  const onPointerLeave = useCallback(() => {
    const overlay = overlayRef.current
    if (overlay) { overlay.style.maskImage = ''; overlay.style.webkitMaskImage = '' }
    if (torchRef.current) torchRef.current.style.opacity = 0
  }, [])

  // On to the next round, or the end (the "Weiter" button, or by itself
  // once the fact was told)
  const goOn = useCallback(() => {
    if (!solved) return
    stopWait.current?.()
    setAdvance(false)
    setShowWeiter(false)
    if (last) {
      // Stars from the rounds solved at the first pick (lib/score.js)
      onComplete(result(firstTryRef.current, challenges.length))
      return
    }
    peeked.current = false
    setIdx(i => i + 1)
    setSolved(false)
    setColored(false)
    setWrongPicks([])
    setFullLight(false)
    setMoved(false)
    setHintUsed(false)
  }, [solved, last, challenges.length, onComplete])

  useEffect(() => {
    if (!advance || paused) return
    const t = setTimeout(goOn, 300)
    return () => clearTimeout(t)
  }, [advance, paused, goOn])

  // A picture given to the room: taken if it is the hidden thing
  const pick = (emoji) => {
    if (solved || !ch) return false
    if (emoji !== ch.shadow) {
      // A wrong pick bounces back and is marked; the round stays open, so
      // the child can look again with the torch. After the second one the
      // whole shadow is lit.
      const picks = wrongPicks.includes(emoji) ? wrongPicks : [...wrongPicks, emoji]
      setWrongPicks(picks)
      shadowRef.current?.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }], { duration: 500 })
      if (picks.length >= 2) {
        setFullLight(true)
        sayWrong('Schau, jetzt leuchtet der ganze Schatten. Welches Bild hat diese Form?')
      } else {
        sayWrong('Schau noch mal mit der Lampe!')
      }
      return false
    }
    // A round solved with the joker is not counted as first try, without a
    // word about it
    if (wrongPicks.length === 0 && !hintUsed) firstTryRef.current += 1
    setSolved(true)
    setFound(f => [...f, { emoji: ch.shadow, name: ch.name }])
    sfx.sparkle()
    setTimeout(() => setColored(true), 600)
    setTimeout(() => { sfx.giggle(); burst(shadowRef.current, last ? 'confetti' : 'stars') }, 900)
    setTimeout(() => setShowWeiter(true), 800)
    sayRight(`${ch.name}! ${ch.fact}`)
    stopWait.current = afterNarration(() => setAdvance(true), { minMs: 2600, maxMs: 15000 })
    return true
  }

  // The sound joker: Lumi gives a clue without naming the thing. Once a
  // round; pressing it again does nothing.
  const giveHint = useCallback(() => {
    if (hintUsed || solved || !ch) return
    setHintUsed(true)
    narrate([{ text: `Hör mal! ${ch.clue}` }])
  }, [hintUsed, solved, ch])

  if (!ch) return null
  const dark = !solved && !fullLight

  return (
    <DragArea autoTarget="room" disabled={solved || paused}>
      {/* relative + zIndex: above GameScreen's backdrop, which is positioned */}
      <div style={{
        position:'relative', zIndex:1,
        flex:1, minHeight:0, width:'100%', boxSizing:'border-box',
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'clamp(6px,1.4vw,16px) clamp(12px,3vw,32px) clamp(10px,2vw,20px)',
        gap:'clamp(6px,1.4vh,14px)',
        overflow:'hidden',
      }}>
        <Garland total={challenges.length} found={found} party={solved && last} />

        {/* The room: dark, with a torch. It takes the height that is left,
            so the pictures below always fit. */}
        <DropZone id="room" onDrop={pick} label="Zimmer"
          style={{ flex:'1 1 0', minHeight:150, maxHeight:680, width:'100%', maxWidth:820, display:'flex' }}>
          {hover => (
            <AnimatePresence mode="wait">
              <motion.div key={idx}
                initial={{ scale:0.85, opacity:0 }} animate={{ scale:1, opacity:1 }}
                exit={{ scale:0.85, opacity:0 }}
                transition={{ type:'spring', stiffness:260, damping:20 }}
                ref={setCardEl}
                onPointerMove={dark ? onPointerMove : undefined}
                onPointerDown={dark ? onPointerMove : undefined}
                onPointerLeave={onPointerLeave}
                style={{
                  // pure white so the black silhouette shows in the beam
                  background:'#ffffff',
                  border:`3px solid ${INK}`, borderRadius:14,
                  boxShadow: hover ? '0 0 0 5px #ffc93c, 0 5px 0 rgba(42,27,61,0.35)' : '0 5px 0 rgba(42,27,61,0.35)',
                  flex:1, position:'relative', overflow:'hidden',
                  cursor: dark ? 'none' : 'default',
                  touchAction:'none',
                }}
              >
                {/* the light is on: wallpaper, bunting, a lamp */}
                <motion.div aria-hidden="true" initial={false} animate={{ opacity: solved ? 1 : 0 }} transition={{ duration: 0.5 }}
                  style={{ position:'absolute', inset:0, background: ROOM_LIT }} />
                {solved && <Bunting />}
                <Lamp on={solved} />

                {/* The thing: in its hiding place as a shadow, then in colour in the middle */}
                <motion.div
                  animate={solved
                    ? { left: '50%', top: '46%', x: '-50%', y: '-50%', rotate: 0, scale: 0.9 }
                    : { left: `${shadowPos.leftPct}%`, top: `${shadowPos.topPct}%`, x: '-50%', y: '-50%', rotate: shadowRotate, scale: 1 }
                  }
                  transition={{ type: 'spring', stiffness: 140, damping: 16 }}
                  style={{ position: 'absolute', pointerEvents: 'none', lineHeight: 1, userSelect: 'none', zIndex: 3 }}
                >
                  {/* brightness(0) = pure black silhouette, coloured once found */}
                  <motion.span ref={shadowRef}
                    animate={{ filter: colored ? 'brightness(1)' : 'brightness(0)' }}
                    transition={{ duration: 0.6, ease: 'easeInOut' }}
                    style={{ fontSize: shadowSize, display: 'block', mixBlendMode: solved ? 'normal' : 'multiply' }}
                  >
                    {ch.shadow}
                  </motion.span>
                  {/* found: it waves hello */}
                  {colored && (
                    <motion.div aria-hidden="true"
                      initial={{ scale: 0, rotate: 0 }}
                      animate={reduceMotion() ? { scale: 1 } : { scale: 1, rotate: [0, 25, -10, 25, -10, 0] }}
                      transition={{ duration: 1.3, repeat: 1 }}
                      style={{ position: 'absolute', right: -shadowSize * 0.28, top: -shadowSize * 0.08, transformOrigin: '30% 90%' }}>
                      <Art art="👋" size={Math.round(shadowSize * 0.42)} />
                    </motion.div>
                  )}
                </motion.div>

                {/* Darkness with the torch beam: fully opaque, so nothing of the
                    shadow shows outside the beam */}
                <AnimatePresence>
                  {dark && (
                    <motion.div key="dark" ref={overlayRef} exit={{ opacity: 0, transition: { duration: 0.5 } }}
                      style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:10, background:'rgb(6,0,15)' }} />
                  )}
                </AnimatePresence>
                {dark && (
                  <div ref={torchRef} aria-hidden="true"
                    style={{ position:'absolute', left:0, top:0, zIndex:11, opacity:0, pointerEvents:'none', transformOrigin:'50% 50%', filter:'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }}>
                    <Art art="🔦" size={torchSize} />
                  </div>
                )}

                {/* A hand shows how to move the torch, until the child does */}
                {dark && !moved && (
                  <motion.div aria-hidden
                    animate={{ x: ['-60%', '60%', '-60%'], y: [0, -14, 0] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ position:'absolute', left:'45%', top:'52%', zIndex:11, pointerEvents:'none' }}>
                    <Art art="👆" size={Math.round(Math.min(64, card.h * 0.16))} />
                  </motion.div>
                )}

                {/* The task again, and the sound joker */}
                <div style={{ position:'absolute', top:8, right:8, zIndex:12, display:'flex', gap:8 }}>
                  <HearOptions items={[task]} label="Aufgabe anhören" size={48} />
                  <motion.button
                    onClick={giveHint}
                    disabled={hintUsed || solved}
                    whileTap={hintUsed || solved ? {} : { scale: 0.92 }}
                    {...hearable('Tipp', { enabled: !hintUsed && !solved })}
                    aria-label="Tipp anhören"
                    style={{
                      ...pxButton('gold'), width:48, height:48, padding:0,
                      display:'flex', alignItems:'center', justifyContent:'center',
                      opacity: hintUsed || solved ? 0.45 : 1,
                      cursor: hintUsed || solved ? 'default' : 'pointer',
                    }}
                  >
                    <Art art="💡" size={32} />
                  </motion.button>
                </div>

                {/* The fact and the way on, inside the room */}
                <AnimatePresence>
                  {solved && (
                    <motion.div
                      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }}
                      transition={{ delay: 0.5 }}
                      style={{
                        position:'absolute', bottom:10, left:'4%', width:'92%', zIndex:12, boxSizing:'border-box',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:12, flexWrap:'wrap',
                        background:'#fffdf7', border:`3px solid ${INK}`, borderRadius:12,
                        boxShadow:'0 4px 0 rgba(42,27,61,0.35)', padding:'8px 12px',
                        fontFamily:'var(--font-body)', fontWeight:700, fontSize:'clamp(15px,2.4vw,18px)',
                        color:INK, textAlign:'center',
                      }}
                    >
                      <span style={{ flex:'1 1 220px' }}>{ch.fact}</span>
                      {showWeiter && (
                        <motion.button
                          initial={{ opacity:0, scale:0.8 }} animate={{ opacity:1, scale:1 }}
                          onClick={goOn}
                          {...hearable(last ? 'Fertig' : 'Weiter')}
                          aria-label={last ? 'Fertig' : 'Weiter'}
                          style={{ ...pxButton('green'), padding:'8px 26px', minHeight:48, fontSize:20, flexShrink:0 }}
                        >
                          {last ? '🏁 Fertig!' : 'Weiter! ➡️'}
                        </motion.button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          )}
        </DropZone>

        {/* The pictures: drag the one that fits into the room, or tap it.
            One row of four, so they never drop below the screen. */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'clamp(8px,1.6vw,16px)', width:'100%', maxWidth:820, flexShrink:0 }}>
          {options.map((emoji, i) => {
            const isRight = emoji === ch.shadow
            const isWrong = wrongPicks.includes(emoji)
            return (
              <Draggable key={`${idx}-${emoji}`} id={`${idx}-${emoji}`} data={emoji} label={`Bild ${i + 1}`} disabled={isWrong}>
                <motion.div
                  initial={{ opacity:0, y:14 }}
                  animate={{ opacity: isWrong || (solved && !isRight) ? 0.45 : 1, y: 0, scale: solved && isRight ? [1, 1.15, 1] : 1 }}
                  transition={{ delay: solved ? 0 : i * 0.06, type:'spring', stiffness:300, scale: { duration: 0.5 } }}
                  style={{
                    height:'clamp(64px,14vh,120px)',
                    ...pxCard(solved && isRight ? 'right' : undefined),
                    fontSize:'min(8vh, 11vw, 64px)', lineHeight:1,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    filter: isWrong ? 'grayscale(0.7)' : undefined,
                  }}
                >
                  {emoji}
                </motion.div>
              </Draggable>
            )
          })}
        </div>
      </div>
      {bursts}
    </DragArea>
  )
}
