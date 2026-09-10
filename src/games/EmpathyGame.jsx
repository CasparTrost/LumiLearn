import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'

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

// ── Stick figure whose POSTURE carries the feeling (no face) ────────────────
function Figure({ pose, color = '#4A00E0', size = 150, flip = false }) {
  const P = {
    // head y-offset, body, arms, legs — each pose is a different silhouette
    traurig:   { hy: 34, arms: 'M30 60 L18 84 M70 60 L82 84', legs: 'M50 88 L34 118 M50 88 L66 118', tilt: 12 },
    wütend:    { hy: 26, arms: 'M30 56 L14 42 M70 56 L86 42', legs: 'M50 88 L32 118 M50 88 L68 118', tilt: 0 },
    ängstlich: { hy: 32, arms: 'M32 58 L50 70 M68 58 L50 70', legs: 'M50 88 L40 118 M50 88 L60 118', tilt: 6 },
    fröhlich:  { hy: 24, arms: 'M30 56 L16 30 M70 56 L84 30', legs: 'M50 88 L32 118 M50 88 L68 118', tilt: 0 },
    einsam:    { hy: 40, arms: 'M34 66 L34 86 M66 66 L66 86', legs: 'M50 88 L38 112 M50 88 L62 112', tilt: 8 },
    stolz:     { hy: 22, arms: 'M30 58 L20 76 M70 58 L80 76', legs: 'M50 88 L34 118 M50 88 L66 118', tilt: -3 },
  }[pose] ?? {}
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 100 130"
      style={{ display: 'block', transform: flip ? 'scaleX(-1)' : 'none' }}>
      <g transform={`rotate(${P.tilt ?? 0} 50 70)`}>
        <circle cx="50" cy={P.hy ?? 26} r="16" fill="none" stroke={color} strokeWidth="6" />
        <path d={`M50 ${(P.hy ?? 26) + 16} L50 88`} stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d={P.arms} stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d={P.legs} stroke={color} strokeWidth="6" strokeLinecap="round" fill="none" />
      </g>
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
