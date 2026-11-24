import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Art, DragArea, Draggable, DropZone, HintHand, useBursts, useIdle } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
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
 * light first touches it (now and then a cat's eyes glow in a corner, and
 * the light finds the cat instead). Then the child drags the matching picture
 * into the room (or just taps it). A right one switches the light on: the
 * room turns colourful, the thing waves hello, and it hangs a lit bulb with
 * its picture on the garland of friends above the room. A wrong one bounces
 * back and the shadow shakes its head. The 💡 joker flashes the light on for
 * a moment. Higher levels get a narrower beam and a tilted shadow.
 *
 * Nothing needs words: a hand shows how to sweep the torch and how to drag a
 * picture in when a child waits, and the fact under the found thing is for a
 * grown-up to read aloud.
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
// five cannot picture.
const CHALLENGES = [
  // Tiere
  { shadow: '🐘', name: 'Elefant',       decoys: ['🐪','🦘','🐢'], fact: 'Mit seinem langen Rüssel kann der Elefant trinken und duschen!' },
  { shadow: '🐪', name: 'Kamel',         decoys: ['🐘','🐢','🐍'], fact: 'Das Kamel kann viele Tage ohne Wasser auskommen!' },
  { shadow: '🐎', name: 'Pferd',         decoys: ['🐢','🦘','🐿️'], fact: 'Pferde können sogar im Stehen schlafen!' },
  { shadow: '🦘', name: 'Känguru',       decoys: ['🐘','🐢','🐊'], fact: 'Das Känguru-Baby wohnt im Beutel seiner Mama!' },
  { shadow: '🐇', name: 'Hase',          decoys: ['🐢','🦔','🐌'], fact: 'Hasen haben lange Ohren und hören sehr gut!' },
  { shadow: '🐿️', name: 'Eichhörnchen',  decoys: ['🦔','🐢','🐌'], fact: 'Eichhörnchen verstecken im Herbst Nüsse für den Winter!' },
  { shadow: '🦔', name: 'Igel',          decoys: ['🐿️','🐇','🐊'], fact: 'Bei Gefahr rollt sich der Igel zu einer stacheligen Kugel zusammen!' },
  { shadow: '🐢', name: 'Schildkröte',   decoys: ['🐊','🐇','🐍'], fact: 'Die Schildkröte trägt ihren Panzer immer mit sich herum!' },
  { shadow: '🐊', name: 'Krokodil',      decoys: ['🐢','🐍','🐘'], fact: 'Krokodile gibt es schon seit der Zeit der Dinosaurier!' },
  { shadow: '🐍', name: 'Schlange',      decoys: ['🐊','🐌','🐢'], fact: 'Schlangen haben keine Beine und schlängeln sich vorwärts!' },
  { shadow: '🦕', name: 'Dinosaurier',   decoys: ['🐊','🐘','🐢'], fact: 'Dinosaurier lebten vor sehr, sehr langer Zeit!' },
  { shadow: '🦈', name: 'Hai',           decoys: ['🐙','🦀','🐢'], fact: 'Haie verlieren ständig Zähne, und es wachsen immer neue nach!' },
  { shadow: '🐬', name: 'Delfin',        decoys: ['🐳','🦀','🐙'], fact: 'Delfine sind sehr klug und schwimmen sehr schnell!' },
  { shadow: '🐳', name: 'Wal',           decoys: ['🐙','🦀','🐢'], fact: 'Wale sind die größten Tiere der Welt!' },
  { shadow: '🦀', name: 'Krabbe',        decoys: ['🐙','🐌','🐢'], fact: 'Krabben laufen seitwärts!' },
  { shadow: '🐙', name: 'Krake',         decoys: ['🦀','🐌','🐢'], fact: 'Eine Krake hat acht Arme!' },
  { shadow: '🦋', name: 'Schmetterling', decoys: ['🐝','🐌','🐢'], fact: 'Bevor er fliegen kann, ist der Schmetterling eine Raupe!' },
  { shadow: '🐝', name: 'Biene',         decoys: ['🦋','🐌','🐢'], fact: 'Bienen machen Honig und bestäuben Blumen!' },
  { shadow: '🐌', name: 'Schnecke',      decoys: ['🦋','🐍','🐇'], fact: 'Schnecken kriechen ganz langsam und tragen ihr Haus auf dem Rücken!' },
  { shadow: '🐧', name: 'Pinguin',       decoys: ['🦢','🐓','🦜'], fact: 'Pinguine können nicht fliegen, aber super schwimmen!' },
  { shadow: '🦢', name: 'Schwan',        decoys: ['🐧','🐓','🦜'], fact: 'Schwäne haben einen langen, gebogenen Hals!' },
  { shadow: '🐓', name: 'Hahn',          decoys: ['🐧','🦢','🐿️'], fact: 'Der Hahn kräht am Morgen: Kikeriki!' },
  { shadow: '🦜', name: 'Papagei',       decoys: ['🐧','🦢','🦋'], fact: 'Papageien können Wörter nachsprechen!' },
  { shadow: '🦅', name: 'Adler',         decoys: ['🐧','🦢','🐓'], fact: 'Adler sehen ganz weit, viel weiter als wir!' },
  { shadow: '🐅', name: 'Tiger',         decoys: ['🐘','🦘','🐢'], fact: 'Tiger sind die größten Katzen der Welt!' },
  { shadow: '🐒', name: 'Affe',          decoys: ['🐘','🐢','🐊'], fact: 'Affen klettern geschickt von Baum zu Baum!' },
  { shadow: '🦏', name: 'Nashorn',       decoys: ['🐇','🐢','🐊'], fact: 'Das Nashorn hat ein Horn auf der Nase!' },
  // Fahrzeuge
  { shadow: '🚀', name: 'Rakete',        decoys: ['🚁','🚲','⛵'], fact: 'Raketen fliegen bis ins Weltall!' },
  { shadow: '✈️', name: 'Flugzeug',      decoys: ['🚀','🚁','🚲'], fact: 'Flugzeuge fliegen hoch über den Wolken!' },
  { shadow: '🚁', name: 'Hubschrauber',  decoys: ['🚀','⛵','🚲'], fact: 'Hubschrauber können auf der Stelle fliegen!' },
  { shadow: '🚂', name: 'Lokomotive',    decoys: ['🚁','🚲','⛵'], fact: 'Früher fuhren Lokomotiven mit Dampf: tschu-tschu!' },
  { shadow: '⛵', name: 'Segelboot',     decoys: ['🚂','🚲','🚁'], fact: 'Ein Segelboot fährt mit der Kraft des Windes!' },
  { shadow: '🚲', name: 'Fahrrad',       decoys: ['🛴','🚁','⛵'], fact: 'Beim Fahrradfahren trittst du in die Pedale!' },
  { shadow: '🛴', name: 'Roller',        decoys: ['🚲','🚁','⛵'], fact: 'Mit dem Roller stößt du dich mit einem Fuß ab!' },
  { shadow: '🚜', name: 'Traktor',       decoys: ['🚲','⛵','🚁'], fact: 'Der Traktor zieht schwere Sachen auf dem Bauernhof!' },
  // Natur
  { shadow: '🌵', name: 'Kaktus',        decoys: ['🌴','🍄','🏠'], fact: 'Kakteen speichern Wasser in der Wüste!' },
  { shadow: '🍄', name: 'Pilz',          decoys: ['🌵','🌴','🌲'], fact: 'Manche Pilze sind giftig, darum nie einfach einen essen!' },
  { shadow: '🌴', name: 'Palme',         decoys: ['🌲','🌵','🍄'], fact: 'Palmen wachsen in warmen Ländern!' },
  { shadow: '🌲', name: 'Tanne',         decoys: ['🌴','🍄','🌵'], fact: 'Die Tanne bleibt auch im Winter grün!' },
  { shadow: '🌋', name: 'Vulkan',        decoys: ['🍄','🏠','🌴'], fact: 'Ein Vulkan kann sehr heiße Lava ausspucken!' },
  // Gebäude
  { shadow: '⛺', name: 'Zelt',          decoys: ['🏰','🗼','🌴'], fact: 'Im Zelt schläft man draußen in der Natur!' },
  { shadow: '🏰', name: 'Schloss',       decoys: ['🏠','⛺','🗼'], fact: 'In einem Schloss wohnten früher Könige und Königinnen!' },
  { shadow: '🗼', name: 'Turm',          decoys: ['🏠','🏰','⛺'], fact: 'Von einem hohen Turm kann man ganz weit schauen!' },
  // Instrumente
  { shadow: '🎸', name: 'Gitarre',       decoys: ['🎺','🥁','☂️'], fact: 'Eine Gitarre hat Saiten, an denen man zupft!' },
  { shadow: '🎺', name: 'Trompete',      decoys: ['🎸','🥁','✂️'], fact: 'Die Trompete klingt sehr hell und laut!' },
  { shadow: '🎻', name: 'Geige',         decoys: ['🎺','🥁','🔑'], fact: 'Die Geige spielt man mit einem Bogen!' },
  { shadow: '🥁', name: 'Trommel',       decoys: ['🎸','🎺','🎻'], fact: 'Auf einer Trommel kann man laut und leise spielen!' },
  // Dinge
  { shadow: '🔭', name: 'Fernrohr',      decoys: ['🔑','✂️','☂️'], fact: 'Mit einem Fernrohr kann man die Sterne sehen!' },
  { shadow: '☂️', name: 'Regenschirm',   decoys: ['🔑','✂️','🎸'], fact: 'Der Regenschirm hält dich bei Regen trocken!' },
  { shadow: '🔑', name: 'Schlüssel',     decoys: ['✂️','☂️','🔭'], fact: 'Mit einem Schlüssel schließt man die Tür auf!' },
  { shadow: '✂️', name: 'Schere',        decoys: ['🔑','☂️','🎺'], fact: 'Mit einer Schere schneidet man Papier!' },
  { shadow: '⚓', name: 'Anker',         decoys: ['🔑','✂️','☂️'], fact: 'Der Anker hält das Schiff fest!' },
  { shadow: '🪁', name: 'Drachen',       decoys: ['🎈','☂️','⛵'], fact: 'Im Herbst lässt man Drachen im Wind steigen!' },
  { shadow: '🎈', name: 'Luftballon',    decoys: ['🪁','☂️','⚓'], fact: 'Ein Luftballon mit Gas fliegt nach oben!' },
  // Obst und Gemüse
  { shadow: '🍌', name: 'Banane',        decoys: ['🍎','🍐','🍦'], fact: 'Bananen wachsen in warmen Ländern!' },
  { shadow: '🍐', name: 'Birne',         decoys: ['🍌','🥕','🍦'], fact: 'Eine Birne ist unten dick und oben schmal!' },
  { shadow: '🥕', name: 'Möhre',         decoys: ['🍌','🍐','🍎'], fact: 'Möhren wachsen unter der Erde!' },
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
// its bulb and hangs below it and giggles when tapped; on a run of right
// answers the friends found so far hop one after the other (`wave`: how
// often, and up to which friend, so a friend hung up later does not hop).
function Garland({ total, found, party, wave }) {
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
              <path d="M0 3 Q50 26 100 3" fill="none" stroke="#cfc4ee" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
            <motion.div aria-hidden="true"
              animate={party && f && !reduceMotion() ? { scale: [1, 1.3, 1] } : { scale: 1 }}
              transition={{ duration: 0.6, repeat: party ? Infinity : 0, delay: i * 0.08 }}
              style={{
                marginTop: 9, width: 14, height: 18, borderRadius: '50% 50% 45% 45%', border: `2px solid ${INK}`, boxSizing: 'border-box',
                background: f ? color : '#8d84ab', boxShadow: f ? `0 0 12px 4px ${color}` : 'none', transition: 'background .4s, box-shadow .4s',
              }} />
            {f && (
              <motion.button type="button" aria-label={f.name}
                initial={{ scale: 0, y: -30 }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 14 }}
                whileTap={{ rotate: [0, -15, 15, 0], scale: 1.2 }}
                onClick={() => sfx.giggle()}
                style={{ all: 'unset', cursor: 'pointer', marginTop: 1, width: pic, height: pic, borderRadius: '50%', background: '#fffdf7', border: `2px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <motion.div key={wave.n} animate={wave.n && i < wave.upto && !reduceMotion() ? { y: [0, -pic * 0.4, 0] } : { y: 0 }} transition={{ duration: 0.45, delay: i * 0.06 }}
                  style={{ display: 'flex' }}>
                  <Art art={f.emoji} size={pic - 6} />
                </motion.div>
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

// A cat in a dark corner: two glowing eyes that blink; caught by the
// light, it pops up and ducks away again. A surprise in some rounds.
function CornerCat({ x, y, seen, size }) {
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: `${x}%`, top: `${y}%`, zIndex: 11, pointerEvents: 'none', transform: 'translate(-50%, -50%)' }}>
      <AnimatePresence>
        {seen ? (
          <motion.div key="cat" initial={{ scale: 0, y: size * 0.4 }} animate={{ scale: [0, 1.15, 1, 1, 0], y: [size * 0.4, 0, 0, 0, size * 0.4] }}
            transition={{ duration: 1.8, times: [0, 0.2, 0.3, 0.8, 1] }}>
            <Art art="🐱" size={size} />
          </motion.div>
        ) : (
          <motion.svg key="eyes" viewBox="0 0 40 14" width={size * 0.6} height={size * 0.21} exit={{ opacity: 0 }}
            className="pl-blink" style={{ display: 'block' }}>
            <ellipse cx="9" cy="7" rx="6" ry="5" fill="#ffe14d" />
            <ellipse cx="31" cy="7" rx="6" ry="5" fill="#ffe14d" />
            <ellipse cx="9" cy="7" rx="1.6" ry="4" fill="#2a1b3d" />
            <ellipse cx="31" cy="7" rx="1.6" ry="4" fill="#2a1b3d" />
          </motion.svg>
        )}
      </AnimatePresence>
    </div>
  )
}

// A big round button with a picture
function PicButton({ art, label, onClick }) {
  return (
    <motion.button initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} whileTap={{ scale: 0.9 }}
      onClick={onClick} aria-label={label}
      style={{ ...pxButton('green'), width: 64, height: 64, borderRadius: '50%', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Art art={art} size={38} />
    </motion.button>
  )
}

export default function ShadowGame({ level = 1, onComplete }) {
  const roundCount = level <= 4 ? 8 : level <= 7 ? 10 : 12
  const [challenges] = useState(() => shuffle(CHALLENGES).slice(0, roundCount))
  const [idx,        setIdx]        = useState(0)
  const [solved,     setSolved]     = useState(false)
  const [colored,    setColored]    = useState(false)   // the thing has its colours back
  const [showNext,   setShowNext]   = useState(false)
  const [wrongPicks, setWrongPicks] = useState([])
  // after two wrong picks the whole shadow is lit, as a hint
  const [fullLight,  setFullLight]  = useState(false)
  // the torch was moved this round (until then the hand shows how)
  const [moved,      setMoved]      = useState(false)
  // the light joker, once a round: the light flashes on for a moment
  const [hintUsed,   setHintUsed]   = useState(false)
  const [flash,      setFlash]      = useState(false)
  const [found,      setFound]      = useState([])
  const [wave,       setWave]       = useState({ n: 0, upto: 0 })   // the friends hop (a run of right answers)
  const [catSeen,    setCatSeen]    = useState(false)
  const paused      = usePaused()
  const firstTryRef = useRef(0)
  const streak      = useRef(0)
  const peeked      = useRef(false)                      // the hidden thing giggled this round
  const timers      = useRef([])
  const [bursts, burst] = useBursts()

  const ch      = challenges[idx]
  const last    = idx + 1 >= challenges.length
  // Freeze option order per question
  const options = useMemo(() => ch ? shuffle([ch.shadow, ...ch.decoys]) : [], [idx]) // eslint-disable-line react-hooks/exhaustive-deps
  // On higher levels the shadow rotates more aggressively
  const shadowRotate = level <= 2 ? 0
    : level <= 5 ? (idx % 2 === 0 ? -16 : 16)
    : (idx % 3 === 0 ? -32 : idx % 3 === 1 ? 32 : -16)
  // Where in the room the shadow hides, 0..1 across the free space; and in
  // some rounds (never the first) a cat in the corner furthest from it
  const spot = useMemo(() => {
    const u = Math.random(), v = Math.random()
    const cat = idx > 0 && Math.random() < 0.35
      ? { x: u > 0.5 ? 10 : 90, y: v > 0.5 || u <= 0.5 ? 16 : 84 }
      : null
    return { u, v, cat: cat && (cat.x === 90 && cat.y === 16 ? { x: 90, y: 84 } : cat) }
  }, [idx])

  // Torch — direct DOM mutation, zero React re-renders
  const cardRef    = useRef(null)
  const overlayRef = useRef(null)
  const torchRef   = useRef(null)
  const demoRef    = useRef(null)                      // the finger that shows the torch
  const shadowRef  = useRef(null)
  const resizeRef  = useRef(null)
  const picsRef    = useRef(null)                      // the pictures (the hand drags from here into the room)
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
  useEffect(() => () => { resizeRef.current?.disconnect(); timers.current.forEach(clearTimeout) }, [])
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms))

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

  useEffect(() => { sayTask() }, [idx])

  const onPointerLeave = useCallback(() => {
    const overlay = overlayRef.current
    if (overlay) { overlay.style.maskImage = ''; overlay.style.webkitMaskImage = '' }
    if (torchRef.current) torchRef.current.style.opacity = 0
  }, [])

  // Light the room at a finger (or mouse) point; returns the beam's middle
  const shine = useCallback((px, py, touch) => {
    const overlay = overlayRef.current
    if (!overlay) return null
    // on a touch screen the light shines just above the finger
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
    return { bx, by }
  }, [beam, torchSize])

  const onPointerMove = useCallback((e) => {
    const el = cardRef.current
    if (!el) return
    if (!moved) setMoved(true)
    const rect = el.getBoundingClientRect()
    const lit = shine(e.clientX - rect.left, e.clientY - rect.top, e.pointerType !== 'mouse')
    if (!lit) return
    const { bx, by } = lit
    const near = (xPct, yPct, r) => Math.hypot(bx - (xPct / 100) * rect.width, by - (yPct / 100) * rect.height) < r
    // the first time the light touches it, the hidden thing giggles
    if (!peeked.current && near(shadowPos.leftPct, shadowPos.topPct, shadowSize * 0.4)) {
      peeked.current = true
      sfx.giggle()
      shadowRef.current?.animate?.([{ transform: 'rotate(0)' }, { transform: 'rotate(-12deg)' }, { transform: 'rotate(10deg)' }, { transform: 'rotate(0)' }], { duration: 500 })
    }
    if (spot.cat && !catSeen && near(spot.cat.x, spot.cat.y, beam * 0.5)) {
      setCatSeen(true)
      sfx.slideUp()
    }
  }, [shine, beam, moved, shadowPos.leftPct, shadowPos.topPct, shadowSize, spot.cat, catSeen])

  // Until the torch was moved, after a quiet spell a finger shows it: it
  // sweeps across the room twice, and the light follows it.
  const showTorch = useIdle(idx === 0 ? 1500 : 5000, !solved && !fullLight && !moved && !paused)
  useEffect(() => {
    const el = cardRef.current
    if (!showTorch || !el) return
    let raf
    const t0 = performance.now()
    const hand = demoRef.current
    const step = now => {
      const k = (now - t0) / 2600
      if (k > 2) { onPointerLeave(); if (hand) hand.style.opacity = 0; return }
      const px = el.clientWidth * (0.5 - 0.32 * Math.cos(2 * Math.PI * k))
      const py = el.clientHeight * (0.66 + 0.1 * Math.sin(4 * Math.PI * k))
      shine(px, py, true)
      if (hand) { hand.style.opacity = 1; hand.style.transform = `translate(${px - 14}px, ${py - 4}px)` }
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => { cancelAnimationFrame(raf); if (hand) hand.style.opacity = 0 }
  }, [showTorch, shine]) // eslint-disable-line react-hooks/exhaustive-deps -- onPointerLeave is stable

  // On to the next round, or the end (the ➡️ button, or by itself once the
  // found thing has waved)
  const goOn = useCallback(() => {
    if (!solved) return
    setShowNext(false)
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
    setFlash(false)
    setCatSeen(false)
  }, [solved, last, challenges.length, onComplete])

  // The payoff plays out in full (light on, colours back, a wave), then the
  // next round comes by itself — held while the help is open
  useEffect(() => {
    if (!solved || paused) return
    const t = setTimeout(goOn, last ? 4200 : 2800)
    return () => clearTimeout(t)
  }, [solved, paused, last, goOn])

  // A picture given to the room: taken if it is the hidden thing
  const pick = (emoji) => {
    if (solved || !ch) return false
    if (emoji !== ch.shadow) {
      // A wrong pick bounces back and is marked; the round stays open, so
      // the child can look again with the torch. After the second one the
      // whole shadow is lit.
      const picks = wrongPicks.includes(emoji) ? wrongPicks : [...wrongPicks, emoji]
      setWrongPicks(picks)
      streak.current = 0
      shadowRef.current?.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(-10px)' }, { transform: 'translateX(10px)' }, { transform: 'translateX(-6px)' }, { transform: 'translateX(0)' }], { duration: 500 })
      if (picks.length >= 2) setFullLight(true)
      sayWrong()
      return false
    }
    // A round solved with the joker is not counted as first try
    const first = wrongPicks.length === 0 && !hintUsed
    if (first) firstTryRef.current += 1
    streak.current = first ? streak.current + 1 : 0
    setSolved(true)
    setFound(f => [...f, { emoji: ch.shadow, name: ch.name }])
    sfx.sparkle()
    later(() => setColored(true), 600)
    later(() => { sfx.giggle(); burst(shadowRef.current, last ? 'confetti' : 'stars', last ? 20 : 10) }, 900)
    later(() => setShowNext(true), 800)
    if (streak.current >= 3) {
      const upto = found.length + 1, n = streak.current
      later(() => { setWave(w => ({ n: w.n + 1, upto })); sfx.combo(n) }, 700)
    }
    sayRight()
    return true
  }

  // The light joker: the whole room lights up for a moment. Once a round.
  const giveHint = () => {
    if (hintUsed || solved || !ch) return
    setHintUsed(true)
    setFlash(true)
    sfx.sparkle()
    later(() => setFlash(false), 1100)
  }

  if (!ch) return null
  const dark = !solved && !fullLight && !flash

  return (
    <DragArea autoTarget="room" disabled={solved || paused}>
      <div style={{
        flex:1, minHeight:0, width:'100%', boxSizing:'border-box',
        display:'flex', flexDirection:'column', alignItems:'center',
        padding:'clamp(6px,1.4vw,16px) clamp(12px,3vw,32px) clamp(10px,2vw,20px)',
        gap:'clamp(6px,1.4vh,14px)',
        overflow:'hidden',
      }}>
        <Garland total={challenges.length} found={found} party={solved && last} wave={wave} />

        {/* The room: dark, with a torch. It takes the height that is left,
            so the pictures below always fit. */}
        <DropZone id="room" onDrop={pick} label="Zimmer"
          style={{ flex:'1 1 0', minHeight:150, maxHeight:680, width:'100%', maxWidth:820, display:'flex' }}>
          {hover => (
            <AnimatePresence mode="wait">
              <motion.div key={idx}
                initial={{ scale:0.9, opacity:0 }} animate={{ scale:1, opacity:1 }}
                exit={{ scale:0.92, opacity:0, transition:{ duration:0.22 } }}
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
                    ? { left: '50%', top: last ? '36%' : '44%', x: '-50%', y: '-50%', rotate: 0, scale: last ? 0.75 : 0.9 }
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
                      transition={{ duration: 1.2 }}
                      style={{ position: 'absolute', right: -shadowSize * 0.28, top: -shadowSize * 0.08, transformOrigin: '30% 90%' }}>
                      <Art art="👋" size={Math.round(shadowSize * 0.42)} />
                    </motion.div>
                  )}
                </motion.div>

                {/* the end of the level: all the friends come into the lit room and hop */}
                {colored && last && (
                  <div aria-hidden="true" style={{ position:'absolute', left:'4%', right:'4%', bottom:'22%', zIndex:4, display:'flex', justifyContent:'center', alignItems:'flex-end', pointerEvents:'none' }}>
                    {found.slice(0, -1).map((f, i) => (
                      <motion.div key={f.emoji} initial={{ y: -40, opacity: 0 }}
                        animate={reduceMotion() ? { y: 0, opacity: 1 } : { y: [-40, 0, -16, 0, -16, 0], opacity: 1 }}
                        transition={{ duration: 2.2, delay: i * 0.07 }}>
                        <Art art={f.emoji} size={Math.round(Math.min(64, card.w * 0.92 / found.length))} />
                      </motion.div>
                    ))}
                  </div>
                )}

                {/* Darkness with the torch beam: fully opaque, so nothing of the
                    shadow shows outside the beam */}
                <AnimatePresence>
                  {dark && (
                    <motion.div key="dark" ref={overlayRef} initial={{ opacity: hintUsed ? 0 : 1 }} animate={{ opacity: 1 }}
                      exit={{ opacity: 0, transition: { duration: flash ? 0.15 : 0.5 } }}
                      style={{ position:'absolute', inset:0, pointerEvents:'none', zIndex:10, background:'rgb(6,0,15)' }} />
                  )}
                </AnimatePresence>
                {dark && spot.cat && <CornerCat x={spot.cat.x} y={spot.cat.y} seen={catSeen} size={Math.round(Math.min(90, card.h * 0.22))} />}
                {dark && (
                  <div ref={torchRef} aria-hidden="true"
                    style={{ position:'absolute', left:0, top:0, zIndex:11, opacity:0, pointerEvents:'none', transformOrigin:'50% 50%', filter:'drop-shadow(0 4px 4px rgba(0,0,0,0.5))' }}>
                    <Art art="🔦" size={torchSize} />
                  </div>
                )}
                {/* the finger that shows the torch */}
                {dark && (
                  <div ref={demoRef} aria-hidden="true" style={{ position:'absolute', left:0, top:0, zIndex:12, opacity:0, pointerEvents:'none', filter:'drop-shadow(0 4px 3px rgba(0,0,0,0.5))' }}>
                    <Art art="👆" size={60} />
                  </div>
                )}

                {/* the light joker */}
                <motion.button
                  onClick={giveHint}
                  disabled={hintUsed || solved}
                  whileTap={hintUsed || solved ? {} : { scale: 0.9 }}
                  aria-label="Licht-Tipp"
                  style={{
                    ...pxButton('gold'), position:'absolute', top:8, right:8, zIndex:12, width:52, height:52, padding:0, borderRadius:'50%',
                    display:'flex', alignItems:'center', justifyContent:'center',
                    opacity: hintUsed || solved ? 0.4 : 1, cursor: hintUsed || solved ? 'default' : 'pointer',
                  }}
                >
                  <Art art="💡" size={34} />
                </motion.button>

                {/* the fact (for a grown-up to read aloud) and the way on */}
                <AnimatePresence>
                  {solved && (
                    <motion.div
                      initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:8 }}
                      transition={{ delay: 0.5 }}
                      style={{
                        position:'absolute', bottom:8, left:'4%', width:'92%', zIndex:12, boxSizing:'border-box',
                        display:'flex', alignItems:'center', justifyContent:'center', gap:12,
                        background:'rgba(255,253,247,0.92)', border:`3px solid ${INK}`, borderRadius:14,
                        boxShadow:'0 4px 0 rgba(42,27,61,0.35)', padding:'6px 8px 6px 14px',
                        fontFamily:'var(--font-body)', fontWeight:700, fontSize:'clamp(13px,2vw,16px)', lineHeight:1.25,
                        color:INK, textAlign:'center',
                      }}
                    >
                      <span style={{ flex:1 }}>{ch.fact}</span>
                      {showNext && <PicButton art={last ? '🏁' : '➡️'} label={last ? 'Fertig' : 'Weiter'} onClick={goOn} />}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            </AnimatePresence>
          )}
        </DropZone>

        {/* The pictures: drag the one that fits into the room, or tap it.
            One row of four, so they never drop below the screen. */}
        <div ref={picsRef} style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'clamp(8px,1.6vw,16px)', width:'100%', maxWidth:820, flexShrink:0 }}>
          {options.map((emoji, i) => {
            const isRight = emoji === ch.shadow
            const isWrong = wrongPicks.includes(emoji)
            return (
              <Draggable key={`${idx}-${emoji}`} id={`${idx}-${emoji}`} data={emoji} label={`Bild ${i + 1}`} disabled={isWrong}>
                <motion.div
                  initial={{ opacity:0, y:14 }}
                  animate={{ opacity: isWrong || (solved && !isRight) ? 0.45 : 1, y: 0, scale: solved && isRight ? [1, 1.15, 1] : 1, rotate: isWrong ? [0, -8, 8, -4, 0] : 0 }}
                  transition={{ delay: solved || isWrong ? 0 : i * 0.06, type:'spring', stiffness:300, scale: { duration: 0.5 }, rotate: { duration: 0.5 } }}
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
      {/* once the torch was used: the hand shows how to bring a picture in */}
      <HintHand from={picsRef} to={cardRef} active={moved && !solved} delay={idx === 0 ? 3000 : 6000} />
      {bursts}
    </DragArea>
  )
}
