import { useState, useCallback, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'

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
 * Mechanic: A large colorful silhouette is shown. Child picks which real object matches.
 * The shadow rotates slightly for extra challenge on higher levels.
 */

const CHALLENGES = [
  // Tiere
  { shadow: '🦁', name: 'Löwe',          decoys: ['🐘','🦒','🐬'],     fact: 'Der Löwe ist der König der Tiere! 🦁👑' },
  { shadow: '🐘', name: 'Elefant',        decoys: ['🦏','🦛','🦒'],     fact: 'Elefanten haben das größte Gehirn aller Landtiere! 🧠' },
  { shadow: '🦒', name: 'Giraffe',        decoys: ['🐘','🦓','🦏'],     fact: 'Die Giraffe ist das größte Tier der Welt! 📏' },
  { shadow: '🐯', name: 'Tiger',          decoys: ['🦁','🐆','🐻'],     fact: 'Tiger sind die größten wilden Katzen der Welt! 🐯' },
  { shadow: '🐺', name: 'Wolf',           decoys: ['🦊','🐕','🐻'],     fact: 'Wölfe leben in Rudeln und heulen den Mond an! 🌕' },
  { shadow: '🦊', name: 'Fuchs',          decoys: ['🐺','🐕','🦝'],     fact: 'Füchse sind sehr schlau und geschickt! 🦊' },
  { shadow: '🐻', name: 'Bär',            decoys: ['🦁','🐺','🦊'],     fact: 'Bären schlafen im Winter einen langen Schlaf! ❄️' },
  { shadow: '🦋', name: 'Schmetterling',  decoys: ['🐝','🐞','🦗'],     fact: 'Schmetterlinge kommen aus einer Raupe! 🐛→🦋' },
  { shadow: '🐙', name: 'Tintenfisch',    decoys: ['🦑','🦀','🐡'],     fact: 'Ein Tintenfisch hat 8 Arme und ist sehr klug! 🧠' },
  { shadow: '🦜', name: 'Papagei',        decoys: ['🦚','🦅','🦢'],     fact: 'Papageien können Wörter nachsprechen! 🗣️' },
  { shadow: '🦕', name: 'Dinosaurier',    decoys: ['🐊','🦎','🐢'],     fact: 'Dinosaurier lebten vor über 65 Millionen Jahren! 🦕' },
  { shadow: '🐊', name: 'Krokodil',       decoys: ['🦎','🐢','🐍'],     fact: 'Krokodile zählen zu den ältesten Tieren der Erde! ⏳' },
  { shadow: '🦈', name: 'Hai',            decoys: ['🐬','🐳','🐟'],     fact: 'Haie haben bis zu 5 Reihen Zähne! 🦷' },
  { shadow: '🐬', name: 'Delfin',         decoys: ['🦈','🐳','🐟'],     fact: 'Delfine sind sehr klug und schwimmen sehr schnell! 🌊' },
  { shadow: '🦔', name: 'Igel',           decoys: ['🐭','🐀','🐿️'],    fact: 'Igel haben bis zu 8000 Stacheln! 🌿' },
  { shadow: '🐸', name: 'Frosch',         decoys: ['🦎','🐢','🦗'],     fact: 'Frösche können 20× ihre Körpergröße springen! 🏆' },
  { shadow: '🦉', name: 'Eule',           decoys: ['🐦','🦜','🦅'],     fact: 'Eulen können ihren Kopf fast komplett drehen! 🔄' },
  { shadow: '🦅', name: 'Adler',          decoys: ['🦜','🦢','🦉'],     fact: 'Adler können Dinge aus 3 km Entfernung sehen! 👁️' },
  { shadow: '🐝', name: 'Biene',          decoys: ['🦋','🐞','🦗'],     fact: 'Bienen machen Honig und bestäuben Blumen! 🌸' },
  { shadow: '🦀', name: 'Krabbe',         decoys: ['🦞','🦐','🦑'],     fact: 'Krabben laufen seitwärts! ↔️' },
  { shadow: '🐧', name: 'Pinguin',        decoys: ['🦆','🦢','🐦'],     fact: 'Pinguine können nicht fliegen, aber super schwimmen! 🏊' },
  { shadow: '🦓', name: 'Zebra',          decoys: ['🐴','🦒','🐎'],     fact: 'Jedes Zebra hat ein einzigartiges Streifenmuster! ✨' },
  { shadow: '🐨', name: 'Koala',          decoys: ['🐻','🐼','🐒'],     fact: 'Koalas schlafen täglich bis zu 22 Stunden! 😴' },
  { shadow: '🐼', name: 'Panda',          decoys: ['🐻','🐨','🦝'],     fact: 'Pandas fressen fast nur Bambus! 🎋' },
  // Fahrzeuge & Technik
  { shadow: '🚀', name: 'Rakete',         decoys: ['✈️','🚁','🛸'],     fact: 'Raketen fliegen bis ins Weltall! 🌙✨' },
  { shadow: '✈️', name: 'Flugzeug',       decoys: ['🚀','🚁','🛩️'],    fact: 'Flugzeuge fliegen bis zu 900 km/h schnell! ⚡' },
  { shadow: '🚂', name: 'Lokomotive',     decoys: ['🚃','🚌','🚗'],     fact: 'Die erste Dampflokomotive fuhr 1825! 🏭' },
  { shadow: '🚁', name: 'Hubschrauber',   decoys: ['✈️','🚀','🛸'],     fact: 'Hubschrauber können auf der Stelle fliegen! 🪁' },
  { shadow: '🚢', name: 'Schiff',         decoys: ['⛵','🚤','🛶'],     fact: 'Das größte Schiff ist länger als 4 Fußballfelder! ⚽' },
  { shadow: '🚲', name: 'Fahrrad',        decoys: ['🛴','🛵','🏍️'],    fact: 'Fahrradfahren ist gut für Umwelt und Gesundheit! 💚' },
  // Natur & Pflanzen
  { shadow: '🌵', name: 'Kaktus',         decoys: ['🌲','🌺','🍄'],     fact: 'Kakteen speichern Wasser in der Wüste! 💧' },
  { shadow: '🍄', name: 'Pilz',           decoys: ['🌵','🌳','🌺'],     fact: 'Einige Pilze leuchten im Dunkeln! 💡' },
  { shadow: '🌴', name: 'Palme',          decoys: ['🌲','🎋','🌵'],     fact: 'Palmen wachsen in warmen Ländern! ☀️' },
  { shadow: '🌋', name: 'Vulkan',         decoys: ['⛰️','🏔️','🗻'],    fact: 'Ein Vulkan kann sehr heiße Lava ausspucken! 🔥' },
  // Gebäude & Strukturen
  { shadow: '⛺', name: 'Zelt',           decoys: ['🏠','🏰','🛖'],     fact: 'Im Zelt schläft man draußen in der Natur! 🌲' },
  { shadow: '🏰', name: 'Burg',           decoys: ['🏠','⛺','🏛️'],    fact: 'In Burgen wohnten früher Ritter und Könige! ⚔️' },
  { shadow: '🗼', name: 'Turm',           decoys: ['🏗️','🗽','⛩️'],    fact: 'Der Eiffelturm in Paris ist über 300 Meter hoch! 🇫🇷' },
  { shadow: '🗽', name: 'Freiheitsstatue', decoys: ['🏛️','🗼','⛪'],   fact: 'Die Freiheitsstatue steht in New York! 🇺🇸' },
  // Instrumente
  { shadow: '🎸', name: 'Gitarre',        decoys: ['🎺','🥁','🎹'],     fact: 'Auf einer Gitarre kann man tolle Musik spielen! 🎵' },
  { shadow: '🥁', name: 'Schlagzeug',     decoys: ['🎸','🎹','🎺'],     fact: 'Schlagzeuge haben bis zu 20 verschiedene Teile! 🎶' },
  { shadow: '🎹', name: 'Klavier',        decoys: ['🎸','🥁','🎺'],     fact: 'Ein Klavier hat 88 Tasten! 🎼' },
  { shadow: '🎺', name: 'Trompete',       decoys: ['🎸','🥁','🎻'],     fact: 'Die Trompete klingt sehr hell und laut! 📯' },
  // Wissenschaft
  { shadow: '🔭', name: 'Teleskop',       decoys: ['🔬','📡','💡'],     fact: 'Mit einem Teleskop können wir die Sterne sehen! ⭐' },
  { shadow: '🔬', name: 'Mikroskop',      decoys: ['🔭','📡','🧪'],     fact: 'Mit einem Mikroskop sieht man winzig kleine Dinge riesig! 🦠' },
  // Sport
  { shadow: '🏄', name: 'Surfer',         decoys: ['🏊','🚣','🤿'],     fact: 'Beim Surfen reitet man auf Wellen! 🌊' },
  { shadow: '⛷️', name: 'Skifahrer',      decoys: ['🏂','🤸','🏄'],     fact: 'Beim Skifahren geht es sehr schnell den Berg runter! 🏔️' },
  { shadow: '🤸', name: 'Turner',         decoys: ['🏊','⛷️','🏋️'],    fact: 'Turner können sich perfekt bewegen wie Akrobaten! 🎪' },
]

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

export default function ShadowGame({ level = 1, onComplete }) {
  const roundCount = level <= 4 ? 8 : level <= 7 ? 10 : 12
  const [challenges] = useState(() => shuffle(CHALLENGES).slice(0, roundCount))
  const [idx,          setIdx]         = useState(0)
  const [selected,     setSelected]    = useState(null)
  const [correct,      setCorrect]     = useState(0)
  const [showFact,     setShowFact]    = useState(false)
  const [revealed,     setRevealed]    = useState(false)   // moves to center
  const [colorShown,   setColorShown]  = useState(false)   // becomes colorful
  const [mood,         setMood]        = useState('thinking')

  const ch      = challenges[idx]
  const options = useMemo(() => ch ? shuffle([ch.shadow, ...ch.decoys]) : [], [idx]) // eslint-disable-line
  const shadowRotate = level <= 2 ? 0
    : level <= 5 ? (idx % 2 === 0 ? -16 : 16)
    : (idx % 3 === 0 ? -32 : idx % 3 === 1 ? 32 : -16)
  const shadowPos = useMemo(() => ({
    leftPct: 22 + Math.random() * 56,  // 22%–78%
    topPct:  18 + Math.random() * 44,  // 18%–62%
  }), [idx]) // eslint-disable-line

  const cardRef    = useRef(null)
  const overlayRef = useRef(null)

  const onPointerMove = useCallback((e) => {
    const overlay = overlayRef.current
    const card    = cardRef.current
    if (!overlay || !card) return
    const rect = card.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1)
    const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1)
    const mask = `radial-gradient(circle 90px at ${x}% ${y}%, transparent 0%, transparent 35px, black 80px, black 90px)`
    overlay.style.maskImage = mask
    overlay.style.webkitMaskImage = mask
  }, [])

  const onPointerLeave = useCallback(() => {
    const overlay = overlayRef.current
    if (!overlay) return
    overlay.style.maskImage = ''
    overlay.style.webkitMaskImage = ''
  }, [])

  const pick = useCallback((emoji) => {
    if (selected !== null || !ch) return
    const ok = emoji === ch.shadow
    const nc = correct + (ok ? 1 : 0)
    setSelected(emoji)
    setMood(ok ? 'excited' : 'encouraging')
    if (ok) {
      setCorrect(nc)
      setRevealed(true)                          // phase 1: move to center
      setTimeout(() => setColorShown(true), 700) // phase 2: become colorful
    }
    setShowFact(true)

    setTimeout(() => {
      setShowFact(false)
      setTimeout(() => {
        if (idx + 1 >= challenges.length) {
          onComplete({ score: nc, total: challenges.length })
        } else {
          setIdx(i => i + 1)
          setSelected(null)
          setMood('thinking')
          setRevealed(false)
          setColorShown(false)
        }
      }, 200)
    }, 3200)
  }, [selected, ch, correct, idx, challenges, onComplete])

  if (!ch) return null

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(12px,2vw,22px)',
    }}>

      {/* Progress */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:700 }}>
        {challenges.map((_, i) => (
          <div key={i} style={{
            flex:1, height:10, borderRadius:99,
            background: i < idx ? '#A29BFE' : i === idx ? '#FFD93D' : '#ECE8FF',
            transition:'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={mood} size={80} />
        <div style={{
          flex:1, background:'white', borderRadius:'22px 22px 22px 6px',
          padding:'14px 20px',
          fontFamily:'var(--font-heading)', fontSize:'clamp(17px,3.5vw,24px)',
          color:'var(--text-primary)',
          boxShadow:'0 4px 20px rgba(162,155,254,0.15)',
        }}>
          {selected === null
            ? 'Leuchte mit der Taschenlampe über den Schatten! 🔦'
            : showFact
              ? (selected === ch.shadow ? '✅ Richtig erkannt!' : `❌ Es war: ${ch.shadow} ${ch.name}`)
              : '...'}
        </div>
      </div>

      {/* Shadow card */}
      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ scale:0.75, opacity:0 }} animate={{ scale:1, opacity:1 }}
          exit={{ scale:0.75, opacity:0 }}
          transition={{ type:'spring', stiffness:260, damping:20 }}
          ref={cardRef}
          onPointerMove={!revealed ? onPointerMove : undefined}
          onPointerLeave={!revealed ? onPointerLeave : undefined}
          style={{
            background: '#ffffff',
            transition: 'background 0.4s ease',
            borderRadius:32,
            boxShadow:'0 12px 44px rgba(74,0,224,0.45)',
            width:'100%', maxWidth:820,
            height:'clamp(340px,52vw,560px)',
            position:'relative', overflow:'hidden',
            cursor: revealed ? 'default' : 'crosshair',
            touchAction:'none',
          }}
        >
          {/* Silhouette — random pos, animates to center on correct */}
          <motion.div
            animate={revealed
              ? { left:'50%', top:'50%', x:'-50%', y:'-50%', rotate:0, scale:1.2 }
              : { left:`${shadowPos.leftPct}%`, top:`${shadowPos.topPct}%`, x:'-50%', y:'-50%', rotate:shadowRotate, scale:1 }
            }
            transition={{ type:'spring', stiffness:140, damping:16 }}
            style={{ position:'absolute', pointerEvents:'none', lineHeight:1, userSelect:'none' }}
          >
            {/* Colored emoji — only visible after colorShown */}
            <span style={{
              fontSize:'clamp(140px,25vw,220px)', display:'block', lineHeight:1,
              opacity: colorShown ? 1 : 0,
              transition: colorShown ? 'opacity 0.6s ease' : 'none',
              position: colorShown ? 'relative' : 'absolute',
            }}>
              {ch.shadow}
            </span>
            {/* True black silhouette via text-shadow trick — color:transparent hides emoji colors,
                text-shadow fills the exact shape with solid black */}
            {!colorShown && (
              <span style={{
                fontSize:'clamp(140px,25vw,220px)', display:'block', lineHeight:1,
                color: 'transparent',
                textShadow: '0 0 0 #000000',
                WebkitTextStroke: '0px transparent',
              }}>
                {ch.shadow}
              </span>
            )}
          </motion.div>

          {/* Dark overlay with flashlight — only before answer */}
          {!revealed && (
            <div
              ref={overlayRef}
              style={{
                position:'absolute', inset:0, borderRadius:32,
                pointerEvents:'none', zIndex:10,
                background:'rgba(6,0,15,0.97)',
              }}
            />
          )}

          {/* Torch hint */}
          {selected === null && (
            <div style={{
              position:'absolute', bottom:18, right:22, zIndex:11,
              fontSize:28, opacity:0.5, pointerEvents:'none',
              fontFamily:'var(--font-heading)', color:'white',
              display:'flex', alignItems:'center', gap:6,
            }}>
              <span>🔦</span>
              <span style={{ fontSize:13 }}>bewegen</span>
            </div>
          )}

          {/* Fact text — direct child of card, always bottom-center */}
          <AnimatePresence>
            {showFact && (
              <motion.div
                initial={{ opacity:0, y:16 }}
                animate={{ opacity:1, y:0 }}
                exit={{ opacity:0, y:8 }}
                transition={{ delay: selected === ch.shadow ? 0.8 : 0 }}
                style={{
                  position:'absolute',
                  bottom:16,
                  left:'6%',
                  width:'88%',
                  zIndex:20,
                  background: selected === ch.shadow ? 'rgba(30,70,30,0.95)' : 'rgba(80,20,20,0.95)',
                  border:`2px solid ${selected === ch.shadow ? '#6BCB77' : '#FF6B6B'}`,
                  borderRadius:16,
                  padding:'12px 20px',
                  fontFamily:'var(--font-body)',
                  fontSize:'clamp(12px,2.5vw,15px)',
                  color:'white',
                  textAlign:'center',
                  backdropFilter:'blur(8px)',
                }}
              >
                {selected === ch.shadow
                  ? <><strong>✅ Richtig!</strong> {ch.fact}</>
                  : <><strong>❌ Es war: {ch.shadow} {ch.name}.</strong> {ch.fact}</>
                }
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </AnimatePresence>

      {/* Options */}
      <div style={{
        display:'grid', gridTemplateColumns:'repeat(2,1fr)',
        gap:'clamp(10px,2vw,18px)', width:'100%', maxWidth:700,
      }}>
        {options.map((emoji, i) => {
          const isCorrect = emoji === ch.shadow
          const isChosen  = emoji === selected
          const done      = selected !== null
          let bg     = 'white'
          let border = '3px solid #ECE8FF'
          let shadow = '0 4px 16px rgba(0,0,0,0.06)'
          if (done && isCorrect)     { bg='#E8F8EE'; border='3px solid #6BCB77'; shadow='0 8px 28px rgba(107,203,119,0.4)' }
          else if (done && isChosen) { bg='#FFE8E8'; border='3px solid #FF6B6B' }
          return (
            <motion.button key={`${idx}-${i}`}
              initial={{ opacity:0, y:14 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:i*0.06, type:'spring', stiffness:300 }}
              whileHover={!done ? { scale:1.05 } : {}}
              whileTap={!done ? { scale:0.95 } : {}}
              onClick={() => pick(emoji)}
              style={{
                padding:'clamp(16px,3.5vw,28px) 12px',
                borderRadius:22, background:bg, border, boxShadow:shadow,
                fontSize:'clamp(44px,10vw,72px)',
                cursor:done ? 'default' : 'pointer',
                transition:'all 0.22s', lineHeight:1,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}
            >
              <motion.span
                animate={done && isCorrect ? { scale:[1,1.3,1], rotate:[0,15,-15,0] } : {}}
                transition={{ duration:0.55 }}
              >
                {emoji}
              </motion.span>
            </motion.button>
          )
        })}
      </div>

      <p style={{ fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-muted)', textAlign:'center', width:'100%' }}>
        ✅ {correct} von {Math.min(idx + (selected !== null ? 1 : 0), challenges.length)} richtig
      </p>
    </div>
  )
}
