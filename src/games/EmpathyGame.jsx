import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'
import { hearable } from '../lib/hearable.js'
import HearOptions from '../components/HearOptions.jsx'
import { lockPreviews } from '../narrator.js'

/**
 * Gefühlsdetektiv — Gefühle an der Körperhaltung erkennen und helfen
 *
 * Gefühlswelt shows one emoji face plus a sentence that names the situation,
 * so the answer can be read off the face or guessed from the text. Two things
 * are missing there and are the whole point here: reading a feeling from
 * posture alone, and reading it in *someone else* rather than in Lumi.
 *
 * Scientific basis:
 *   • Theory of mind / perspective taking (Wellman) — attributing a feeling
 *     to another person, not oneself, is the developmental step this age is
 *     working on.
 *   • Bodily emotion recognition (de Gelder) — posture carries emotion
 *     independently of facial expression, and children read it earlier and
 *     more reliably than they read subtle faces.
 *   • Prosocial response — naming a feeling is only half of empathy; the
 *     second question asks what to actually do about it.
 */

function speakDE(text) { speak(text, { rate: 0.85, pitch: 1.05, lang: 'de-DE' }) }
function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// ── Ein Kind, dessen Gefühl man wirklich ansieht ────────────────────────────
// Die erste Fassung waren reine Strichmännchen ohne Gesicht — bewusst, damit
// das Gefühl allein aus der Haltung gelesen werden muss. In der Praxis sahen
// alle sechs gleich aus: bei dieser Strichstärke sind ein paar Grad Armwinkel
// nicht zu unterscheiden, und ein Fünfjähriges hat damit keine Chance.
// Jetzt tragen Haltung UND Gesicht dasselbe Gefühl, dazu ein Merkmal, das nur
// zu diesem einen passt (Träne, Dampf, Sterne). Die Haltung bleibt der
// Hauptträger — sie ist aus der Entfernung zuerst zu sehen —, aber sie ist
// nicht mehr der einzige.

const SKIN = '#FFD9B8'
const LINE = '#4A3A6B'

function Brows({ d }) {
  return <path d={d} fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round" />
}

function Eyes({ kind }) {
  if (kind === 'arc')    // zusammengekniffen vor Freude
    return <g fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round">
      <path d="M46 38 Q51 32 56 38" /><path d="M64 38 Q69 32 74 38" /></g>
  if (kind === 'wide')   // aufgerissen
    return <g><circle cx="51" cy="38" r="6.5" fill="white" stroke={LINE} strokeWidth="2" />
      <circle cx="69" cy="38" r="6.5" fill="white" stroke={LINE} strokeWidth="2" />
      <circle cx="51" cy="39" r="3.4" fill={LINE} /><circle cx="69" cy="39" r="3.4" fill={LINE} /></g>
  if (kind === 'narrow') // verengt
    return <g fill={LINE}><rect x="45" y="36" width="12" height="4.6" rx="2.3" />
      <rect x="63" y="36" width="12" height="4.6" rx="2.3" /></g>
  if (kind === 'down')   // gesenkter Blick
    return <g fill="none" stroke={LINE} strokeWidth="3.2" strokeLinecap="round">
      <path d="M46 38 Q51 43 56 38" /><path d="M64 38 Q69 43 74 38" /></g>
  return <g fill={LINE}><circle cx="51" cy="38" r="3.6" /><circle cx="69" cy="38" r="3.6" /></g>
}

const POSES = {
  'fröhlich': {
    tilt: 0, headDy: -3, eyes: 'arc', cheeks: true,
    brows: 'M45 26 Q50 21 55 25   M65 25 Q70 21 75 26',
    arms:  'M44 72 L24 44   M76 72 L96 44',        // beide Arme hoch
    hands: [[24, 44], [96, 44]],
    legs:  'M52 112 L42 142  M68 112 L78 142',
    mouth: <path d="M48 45 Q60 59 72 45" fill="none" stroke={LINE} strokeWidth="3.6" strokeLinecap="round" />,
    extra: <g fill="#FFD93D"><circle cx="16" cy="30" r="3.4" /><circle cx="104" cy="34" r="2.8" /></g>,
  },
  'traurig': {
    tilt: 11, headDy: 6, eyes: 'droop', tear: true,
    brows: 'M46 24 L57 30   M74 24 L63 30',        // innen hoch = traurig
    arms:  'M44 74 L33 106  M76 74 L87 106',       // hängen kraftlos herunter
    hands: [[33, 106], [87, 106]],
    legs:  'M53 112 L49 142 M67 112 L71 142',
    mouth: <path d="M50 53 Q60 44 70 53" fill="none" stroke={LINE} strokeWidth="3.6" strokeLinecap="round" />,
  },
  'wütend': {
    tilt: 4, headDy: 0, eyes: 'narrow', flush: true, fists: true,
    brows: 'M45 23 L59 31   M75 23 L61 31',        // innen runter = wütend
    arms:  'M44 70 L36 100  M76 70 L84 100',       // angespannt, Fäuste geballt
    hands: [[36, 100], [84, 100]],
    legs:  'M52 112 L38 140 M68 112 L82 140',      // breiter, fester Stand
    mouth: <path d="M49 52 L71 52 M53 49 L53 55 M60 49 L60 55 M67 49 L67 55"
             fill="none" stroke={LINE} strokeWidth="2.6" strokeLinecap="round" />,   // zusammengebissen
    extra: <g fill="none" stroke="#FF6B6B" strokeWidth="3.4" strokeLinecap="round">
      <path d="M28 20 q-6 -8 0 -14" /><path d="M92 22 q7 -8 0 -15" /></g>,
  },
  'ängstlich': {
    tilt: 5, headDy: 4, eyes: 'wide', armsOverBody: true,
    brows: 'M45 21 Q51 16 57 21   M63 21 Q69 16 75 21',   // beide hochgezogen
    arms:  'M44 72 Q46 92 70 88   M76 72 Q74 92 50 88',   // umklammert sich selbst
    hands: [[70, 88], [50, 88]],
    legs:  'M56 112 L53 142 M64 112 L67 142',             // Beine eng beieinander
    mouth: <ellipse cx="60" cy="51" rx="5.4" ry="6.6" fill={LINE} />,
    extra: <g fill="none" stroke="#A29BFE" strokeWidth="2.8" strokeLinecap="round">
      <path d="M20 56 q5 -5 10 0" /><path d="M100 58 q-5 -5 -10 0" /></g>,
  },
  'einsam': { seated: true, tilt: 5, eyes: 'down',
    brows: 'M47 24 L57 29   M73 24 L63 29' },
  'stolz': {
    tilt: -3, headDy: -5, eyes: 'arc', armsOverBody: true,
    brows: 'M46 24 Q51 20 56 24   M64 24 Q69 20 74 24',
    arms:  'M44 72 Q26 82 43 94   M76 72 Q94 82 77 94',   // Hände in die Hüften, Brust raus
    legs:  'M52 112 L44 142 M68 112 L76 142',
    mouth: <path d="M50 46 Q60 57 70 46" fill="none" stroke={LINE} strokeWidth="3.6" strokeLinecap="round" />,
    extra: <g fill="#FFD93D">
      <path d="M100 16 l2.6 5.4 5.4 2.6 -5.4 2.6 -2.6 5.4 -2.6 -5.4 -5.4 -2.6 5.4 -2.6 z" />
      <path d="M16 28 l1.8 3.8 3.8 1.8 -3.8 1.8 -1.8 3.8 -1.8 -3.8 -3.8 -1.8 3.8 -1.8 z" /></g>,
  },
}

function Head({ P, dy = 0 }) {
  return (
    <g transform={`translate(0 ${dy})`}>
      <circle cx="60" cy="38" r="23" fill={SKIN} />
      <path d="M37 34 Q60 6 83 34 Q60 24 37 34" fill={LINE} opacity="0.85" />
      {P.flush  && <g fill="#FF6B6B" opacity="0.35"><circle cx="42" cy="46" r="6" /><circle cx="78" cy="46" r="6" /></g>}
      {P.cheeks && <g fill="#FF9FB0" opacity="0.5"><circle cx="43" cy="46" r="5" /><circle cx="77" cy="46" r="5" /></g>}
      <Eyes kind={P.eyes} />
      <Brows d={P.brows} />
      {P.mouth}
      {P.tear && <path d="M51 44 q-3.4 7.5 0 10 q3.4 -2.5 0 -10" fill="#74B9FF" />}
    </g>
  )
}

function Arms({ P }) {
  return (
    <g>
      <path d={P.arms} fill="none" stroke={SKIN} strokeWidth="9" strokeLinecap="round" />
      {P.hands?.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={P.fists ? 6.5 : 5.2} fill={SKIN}
          stroke={P.fists ? LINE : 'none'} strokeWidth={P.fists ? 2 : 0} />
      ))}
    </g>
  )
}

function Figure({ pose, color = '#E84393', size = 150, flip = false }) {
  const P = POSES[pose] ?? POSES['fröhlich']

  // Einsam wird sitzend gezeigt: zusammengekauert, Knie umschlungen, Blick nach
  // unten. Das ist die Haltung, die man auf jedem Spielplatz wiedererkennt —
  // und die einzige, die sich nicht aus Armen und Beinen im Stehen ergibt.
  if (P.seated) {
    return (
      <svg width={size} height={size * 1.15} viewBox="0 0 120 150"
        style={{ display: 'block', transform: flip ? 'scaleX(-1)' : 'none' }}>
        <g transform={`rotate(${P.tilt} 60 104)`}>
          {/* Unterschenkel und Füße unter den angezogenen Knien */}
          <path d="M44 120 L40 136  M76 120 L80 136" fill="none" stroke={LINE} strokeWidth="9" strokeLinecap="round" />
          {/* Oberkörper, dahinter */}
          <rect x="44" y="84" width="32" height="40" rx="13" fill={color} />
          {/* die angezogenen Knie */}
          <circle cx="44" cy="108" r="15" fill={color} />
          <circle cx="76" cy="108" r="15" fill={color} />
          {/* Arme, die die Knie umschließen — die Haltung, um die es geht */}
          <path d="M40 96 Q60 126 80 96" fill="none" stroke={SKIN} strokeWidth="9" strokeLinecap="round" />
          <circle cx="40" cy="96" r="5.2" fill={SKIN} /><circle cx="80" cy="96" r="5.2" fill={SKIN} />
          <Head P={P} dy={28} />
        </g>
      </svg>
    )
  }

  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 120 150"
      style={{ display: 'block', transform: flip ? 'scaleX(-1)' : 'none' }}>
      <g transform={`rotate(${P.tilt} 60 90)`}>
        <path d={P.legs} fill="none" stroke={LINE} strokeWidth="9" strokeLinecap="round" />
        {/* Arme liegen hinter dem Körper, damit die Schulter sauber ansetzt —
            außer da, wo das Umfassen selbst die Haltung ist. */}
        {!P.armsOverBody && <Arms P={P} />}
        <rect x="42" y="64" width="36" height="50" rx="15" fill={color} />
        {P.armsOverBody && <Arms P={P} />}
        <Head P={P} dy={P.headDy ?? 0} />
      </g>
      {P.extra}
    </svg>
  )
}

const FEELINGS = ['traurig', 'wütend', 'ängstlich', 'fröhlich', 'einsam', 'stolz']

// Each scene: what A's posture shows, and what B could do about it. All three
// responses are kind; one fits this feeling best, and that is what is scored.
const SCENES = [
  { pose: 'traurig',   feeling: 'traurig',
    situation: 'Mia sitzt allein auf der Bank. Ihr Bild ist zerrissen.',
    best: 'Ich setze mich dazu und tröste sie.',
    other: ['Ich hole schnell einen Ball zum Spielen.', 'Ich sage ihr, sie soll nicht traurig sein.'] },
  { pose: 'einsam',    feeling: 'einsam',
    situation: 'Ben steht am Rand und schaut den anderen beim Spielen zu.',
    best: 'Ich frage ihn, ob er mitspielen will.',
    other: ['Ich spiele einfach weiter.', 'Ich rufe den anderen zu, dass Ben da steht.'] },
  { pose: 'wütend',    feeling: 'wütend',
    situation: 'Jemand hat Leos Turm umgeworfen.',
    best: 'Ich warte kurz und frage dann, was passiert ist.',
    other: ['Ich baue den Turm schnell neu.', 'Ich sage ihm, er soll sich beruhigen.'] },
  { pose: 'ängstlich', feeling: 'ängstlich',
    situation: 'Es donnert laut und Nele macht sich ganz klein.',
    best: 'Ich bleibe bei ihr und sage, dass ich da bin.',
    other: ['Ich mache das Fenster zu.', 'Ich erkläre ihr, wie Gewitter entstehen.'] },
  { pose: 'fröhlich',  feeling: 'fröhlich',
    situation: 'Tim hat es zum ersten Mal ganz nach oben geschafft.',
    best: 'Ich freue mich mit ihm und klatsche.',
    other: ['Ich klettere auch nach oben.', 'Ich sage, dass ich das auch kann.'] },
  { pose: 'stolz',     feeling: 'stolz',
    situation: 'Ida zeigt ihr fertiges Bild und stellt sich ganz gerade hin.',
    best: 'Ich schaue es mir an und sage, was mir gefällt.',
    other: ['Ich male auch schnell ein Bild.', 'Ich sage, dass es schön ist, und gehe weiter.'] },
  { pose: 'traurig',   feeling: 'traurig',
    situation: 'Jonas hat sein Kuscheltier verloren.',
    best: 'Ich helfe ihm suchen.',
    other: ['Ich leihe ihm meins.', 'Ich sage, dass es sicher wieder auftaucht.'] },
  { pose: 'einsam',    feeling: 'einsam',
    situation: 'Die neue Anna kennt noch niemanden im Kindergarten.',
    best: 'Ich stelle mich vor und zeige ihr alles.',
    other: ['Ich winke ihr von weitem zu.', 'Ich warte, bis sie zu mir kommt.'] },
]

export default function EmpathyGame({ level = 1, onComplete }) {
  const scenes = useState(() => shuffle(SCENES))[0]
  const optionCount = level <= 3 ? 3 : FEELINGS.length >= 4 ? 4 : 3

  const [idx,    setIdx]    = useState(0)
  const [phase,  setPhase]  = useState('feeling')  // feeling → help → done
  const [wrong,  setWrong]  = useState([])
  const [misses, setMisses] = useState(0)
  const [mood,   setMood]   = useState('thinking')
  const [showWeiter, setShowWeiter] = useState(false)

  const sc = scenes[idx]

  const feelingOptions = useState(() => ({}))[0]
  if (sc && !feelingOptions[idx]) {
    feelingOptions[idx] = shuffle([
      sc.feeling,
      ...shuffle(FEELINGS.filter(f => f !== sc.feeling)).slice(0, optionCount - 1),
    ])
  }
  const helpOptions = useState(() => ({}))[0]
  if (sc && !helpOptions[idx]) helpOptions[idx] = shuffle([sc.best, ...sc.other])

  useEffect(() => {
    if (!sc) return
    setPhase('feeling'); setWrong([]); setMood('thinking')
    lockPreviews()
    const id = setTimeout(() => speakDE(`${sc.situation} Wie fühlt sich das Kind?`), 450)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const pickFeeling = useCallback((f) => {
    if (phase !== 'feeling' || !sc) return
    if (f !== sc.feeling) {
      setWrong(w => w.includes(f) ? w : [...w, f])
      setMisses(m => m + 1)
      setMood('encouraging')
      sfx.wrong()
      speakDE('Schau nochmal, wie das Kind dasteht.')
      setTimeout(() => setMood('thinking'), 1000)
      return
    }
    sfx.correct()
    setMood('happy')
    setWrong([])
    setPhase('help')
    speakDE(`Genau, ${sc.feeling}. Was kannst du tun?`)
  }, [phase, sc])

  const pickHelp = useCallback((h) => {
    if (phase !== 'help' || !sc) return
    if (h !== sc.best) {
      setWrong(w => w.includes(h) ? w : [...w, h])
      setMisses(m => m + 1)
      setMood('encouraging')
      sfx.wrong()
      // Not "wrong" as such — kind, but not what this feeling needs.
      speakDE('Das ist nett. Aber was hilft gerade jetzt am meisten?')
      setTimeout(() => setMood('thinking'), 1200)
      return
    }
    sfx.correct()
    setMood('excited')
    setPhase('done')
    speakDE('Das hilft wirklich. Gut gemacht!')
    setTimeout(() => setShowWeiter(true), 800)
  }, [phase, sc])

  const weiterClick = () => {
    setShowWeiter(false)
    if (idx + 1 >= scenes.length) {
      sfx.complete()
      const stars = misses <= 2 ? 3 : misses <= scenes.length * 1.5 ? 2 : 1
      setTimeout(() => onComplete({ score: scenes.length, total: scenes.length, stars }), 300)
    } else setIdx(i => i + 1)
  }

  if (!sc) return null

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(14px,3vw,32px)', gap: 'clamp(10px,2vw,18px)',
    }}>
      <div style={{ display: 'flex', gap: 5, width: '100%', maxWidth: 680 }}>
        {scenes.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 10, borderRadius: 99,
            background: i < idx ? '#6C63FF' : i === idx ? '#FFD93D' : '#ECE8FF',
          }} />
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={64} />
        <div style={{
          flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px', padding: '11px 16px',
          boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,3vw,19px)', color: 'var(--text-primary)',
        }}>
          {sc.situation}
        </div>
        <HearOptions items={phase === 'feeling' ? feelingOptions[idx] : helpOptions[idx]}
          label="Alle Antworten vorlesen" />
      </div>

      {/* The scene: the child in question, and you */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 'clamp(20px,8vw,70px)',
        background: 'linear-gradient(180deg,#F5F2FF,#EDE9FF)', borderRadius: 26,
        padding: 'clamp(12px,2.5vw,20px) clamp(18px,5vw,46px)', width: '100%', maxWidth: 560,
      }}>
        <div style={{ textAlign: 'center' }}>
          <Figure pose={sc.pose} color="#E84393" size={132} />
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#9B8FCC' }}>
            {phase === 'feeling' ? '❓' : sc.feeling}
          </div>
        </div>
        <div style={{ textAlign: 'center', opacity: phase === 'feeling' ? 0.4 : 1, transition: 'opacity 0.4s' }}>
          <Figure pose="fröhlich" color="#4A00E0" size={132} flip />
          <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: '#9B8FCC' }}>du</div>
        </div>
      </div>

      <div style={{
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(15px,3.2vw,20px)',
        color: '#4A00E0', fontWeight: 700, textAlign: 'center',
      }}>
        {phase === 'feeling' ? 'Wie fühlt sich das Kind?'
         : phase === 'help'  ? 'Was kannst du tun?'
         :                     '💛 Das hilft wirklich!'}
      </div>

      {/* Step 1 — the feeling */}
      {phase === 'feeling' && (
        <div style={{ display: 'flex', gap: 'clamp(8px,2vw,14px)', flexWrap: 'wrap', justifyContent: 'center' }}>
          {feelingOptions[idx].map(f => {
            const isWrong = wrong.includes(f)
            return (
              <motion.button key={f}
                whileHover={!isWrong ? { scale: 1.06 } : {}} whileTap={!isWrong ? { scale: 0.94 } : {}}
                onClick={() => { if (!isWrong) pickFeeling(f) }}
                {...hearable(f)}
                aria-label={f}
                style={{
                  background: isWrong ? '#FFE8E8' : 'white',
                  border: `3px solid ${isWrong ? '#FF6B6B' : '#ECE8FF'}`,
                  borderRadius: 18, padding: '10px 20px', cursor: isWrong ? 'default' : 'pointer',
                  fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,3vw,19px)',
                  color: 'var(--text-primary)', opacity: isWrong ? 0.55 : 1,
                }}
              >{f}</motion.button>
            )
          })}
        </div>
      )}

      {/* Step 2 — the response */}
      {phase !== 'feeling' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 520 }}>
          {helpOptions[idx].map(h => {
            const isWrong = wrong.includes(h)
            const isBest  = phase === 'done' && h === sc.best
            return (
              <motion.button key={h}
                whileHover={phase === 'help' && !isWrong ? { scale: 1.02 } : {}}
                whileTap={phase === 'help' && !isWrong ? { scale: 0.98 } : {}}
                onClick={() => { if (!isWrong) pickHelp(h) }}
                {...hearable(h)}
                style={{
                  background: isBest ? '#E8F8EE' : isWrong ? '#FFF4E5' : 'white',
                  border: `3px solid ${isBest ? '#6BCB77' : isWrong ? '#FFD93D' : '#ECE8FF'}`,
                  borderRadius: 18, padding: '12px 16px', textAlign: 'left',
                  cursor: phase === 'help' && !isWrong ? 'pointer' : 'default',
                  fontFamily: 'var(--font-body)', fontSize: 'clamp(13px,2.9vw,17px)',
                  color: 'var(--text-primary)', opacity: isWrong ? 0.7 : 1,
                }}
              >{h}</motion.button>
            )
          })}
        </div>
      )}

      <AnimatePresence>
        {showWeiter && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
            whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
            onClick={weiterClick}
            style={{
              background: 'linear-gradient(135deg,#6C63FF,#4A00E0)', color: 'white',
              border: 'none', borderRadius: 20, padding: '12px 40px', cursor: 'pointer',
              fontFamily: 'var(--font-heading)', fontSize: 'clamp(16px,3.4vw,21px)', fontWeight: 700,
              boxShadow: '0 5px 20px rgba(74,0,224,0.38)',
            }}
          >Weiter! →</motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
