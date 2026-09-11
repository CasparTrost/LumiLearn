import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
import { speak } from '../tts.js'

/**
 * Lumis Spielbrett — würfeln, mitzählen, vorrücken
 *
 * Nothing in the app connected a number to a movement. Blasen-Blitz is pure
 * recognition, Lumi-Labyrinth is pure navigation without any number, and the
 * counting games count objects that sit still. Moving a token one field per
 * pip is one-to-one correspondence in its most physical form.
 *
 * Scientific basis:
 *   • Linear board games (Ramani & Siegler, 2008) — playing a numbered linear
 *     board measurably improves number-line estimation and later arithmetic,
 *     more than the same time spent on other number activities.
 *   • One-to-one correspondence — the child taps once per field, so the count
 *     is produced rather than watched; the die shows pips, not a numeral, so
 *     the quantity has to be read as a quantity.
 */

function speakDE(text) { speak(text, { rate: 0.85, pitch: 1.08, lang: 'de-DE' }) }
function rand(a, b) { return Math.floor(Math.random() * (b - a + 1)) + a }

// Pip layout per face — the die never shows a digit, so the number has to be
// taken from the pattern.
const PIPS = {
  1: [[50, 50]],
  2: [[28, 28], [72, 72]],
  3: [[28, 28], [50, 50], [72, 72]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]],
  5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
  6: [[28, 25], [72, 25], [28, 50], [72, 50], [28, 75], [72, 75]],
}

function Die({ face, rolling }) {
  return (
    <motion.div
      animate={rolling ? { rotate: [0, 90, 180, 270, 360], scale: [1, 1.12, 1] } : { rotate: 0 }}
      transition={rolling ? { duration: 0.7 } : { duration: 0.2 }}
      style={{
        width: 'clamp(64px,14vw,96px)', height: 'clamp(64px,14vw,96px)',
        background: 'white', borderRadius: 18,
        boxShadow: '0 6px 22px rgba(0,0,0,0.18)', border: '3px solid #ECE8FF',
      }}
    >
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>
        {(PIPS[face] ?? []).map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="9" fill="#4A00E0" />
        ))}
      </svg>
    </motion.div>
  )
}

const EVENTS = {
  bonus: { icon: '⭐', text: 'Ein Feld weiter!',   delta: 1 },
  back:  { icon: '🌀', text: 'Zwei Felder zurück!', delta: -2 },
  star:  { icon: '🍀', text: 'Glücksfeld!',         delta: 0 },
}

function buildBoard(level) {
  const size = level <= 3 ? 16 : level <= 6 ? 22 : 28
  const maxPip = level <= 2 ? 3 : level <= 5 ? 4 : 6
  const fields = Array.from({ length: size }, (_, i) => {
    if (i === 0 || i === size - 1) return { i, event: null }
    const r = (i * 7 + 3) % 11
    return { i, event: r === 0 ? 'bonus' : r === 4 ? 'back' : r === 8 ? 'star' : null }
  })
  return { fields, size, maxPip }
}

export default function BoardGame({ level = 1, onComplete }) {
  const board = useMemo(() => buildBoard(level), [level])

  const [pos,      setPos]      = useState(0)
  const [face,     setFace]     = useState(1)
  const [rolling,  setRolling]  = useState(false)
  const [stepsLeft, setStepsLeft] = useState(0)   // taps still to make
  const [rolls,    setRolls]    = useState(0)
  const [note,     setNote]     = useState(null)
  const [mood,     setMood]     = useState('happy')
  const [done,     setDone]     = useState(false)

  useEffect(() => {
    const id = setTimeout(() => speakDE('Würfle und zähle mit! Tippe auf den Würfel.'), 500)
    return () => clearTimeout(id)
  }, [])

  const roll = useCallback(() => {
    if (rolling || stepsLeft > 0 || done) return
    setRolling(true)
    setNote(null)
    sfx.click?.()
    const n = rand(1, board.maxPip)
    setTimeout(() => {
      setFace(n)
      setRolling(false)
      setStepsLeft(n)
      setRolls(r => r + 1)
      speakDE(`${n}. Zähle ${n} ${n === 1 ? 'Feld' : 'Felder'}!`)
    }, 700)
  }, [rolling, stepsLeft, done, board.maxPip])

  // One tap = one field = one number said out loud. That is the whole
  // exercise, so it is deliberately not animated away for the child.
  const stepOnce = useCallback(() => {
    if (stepsLeft <= 0 || done) return
    const nextPos = Math.min(pos + 1, board.size - 1)
    const said = face - stepsLeft + 1
    setPos(nextPos)
    setStepsLeft(s => s - 1)
    sfx.pop?.()
    speakDE(String(said))

    if (stepsLeft === 1) {
      // landed — resolve the field
      setTimeout(() => {
        if (nextPos >= board.size - 1) {
          setDone(true)
          setMood('excited')
          sfx.complete()
          speakDE('Geschafft! Du bist im Ziel!')
          const stars = rolls <= board.size / 2.2 ? 3 : rolls <= board.size / 1.5 ? 2 : 1
          setTimeout(() => onComplete({ score: board.size, total: board.size, stars }), 1400)
          return
        }
        const ev = board.fields[nextPos]?.event
        if (!ev) return
        const e = EVENTS[ev]
        setNote(e)
        setMood(e.delta < 0 ? 'encouraging' : 'excited')
        speakDE(e.text)
        if (e.delta !== 0) {
          setTimeout(() => {
            setPos(p => Math.max(0, Math.min(board.size - 1, p + e.delta)))
            setMood('happy')
          }, 900)
        } else {
          setTimeout(() => setMood('happy'), 900)
        }
        setTimeout(() => setNote(null), 2000)
      }, 260)
    }
  }, [stepsLeft, done, pos, face, board, rolls, onComplete])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(14px,2.5vw,28px) clamp(12px,3vw,28px)', gap: 'clamp(10px,2vw,18px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, width: '100%', maxWidth: 680 }}>
        <LumiCharacter mood={mood} size={64} />
        <div style={{
          flex: 1, background: 'white', borderRadius: '22px 22px 22px 5px', padding: '11px 16px',
          boxShadow: '0 4px 20px rgba(108,99,255,0.14)',
          fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,3vw,19px)', color: 'var(--text-primary)',
        }}>
          {done ? '🏁 Im Ziel! Super gezählt!'
           : note ? `${note.icon} ${note.text}`
           : stepsLeft > 0 ? `Noch ${stepsLeft} ${stepsLeft === 1 ? 'Feld' : 'Felder'} — tippe weiter!`
           : 'Tippe auf den Würfel! 🎲'}
        </div>
      </div>

      {/* Board */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${board.size <= 16 ? 8 : board.size <= 22 ? 11 : 14}, 1fr)`,
        gap: 'clamp(3px,0.9vw,7px)', width: '100%', maxWidth: 660,
      }}>
        {board.fields.map(f => {
          const here   = pos === f.i
          const passed = pos > f.i
          const ev     = f.event ? EVENTS[f.event] : null
          const isGoal = f.i === board.size - 1
          return (
            <motion.button
              key={f.i}
              onClick={stepOnce}
              disabled={stepsLeft <= 0}
              aria-label={`Feld ${f.i + 1}${ev ? ' ' + ev.text : ''}`}
              whileTap={stepsLeft > 0 ? { scale: 0.9 } : {}}
              style={{
                aspectRatio: '1', borderRadius: 10, position: 'relative',
                border: `2.5px solid ${here ? '#4A00E0' : isGoal ? '#6BCB77' : '#E0D9F5'}`,
                background: here ? '#EDE9FF' : isGoal ? '#E8F8EE' : passed ? '#F6F3FF' : 'white',
                cursor: stepsLeft > 0 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'clamp(11px,2.4vw,17px)', padding: 0,
              }}
            >
              {here ? '🦊' : isGoal ? '🏁' : ev ? ev.icon : (
                <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(8px,1.8vw,12px)', color: '#C0B8E8' }}>
                  {f.i + 1}
                </span>
              )}
            </motion.button>
          )
        })}
      </div>

      {/* Die */}
      <motion.button
        whileHover={stepsLeft === 0 && !done ? { scale: 1.06 } : {}}
        whileTap={stepsLeft === 0 && !done ? { scale: 0.92 } : {}}
        onClick={roll}
        aria-label="Würfeln"
        disabled={stepsLeft > 0 || done}
        style={{
          background: 'none', border: 'none', padding: 0,
          cursor: stepsLeft === 0 && !done ? 'pointer' : 'default',
          opacity: stepsLeft > 0 || done ? 0.5 : 1,
        }}
      >
        <Die face={face} rolling={rolling} />
      </motion.button>

      <div style={{ fontFamily: 'var(--font-heading)', fontSize: 13, color: 'var(--text-muted)' }}>
        {stepsLeft > 0 ? 'Tippe die Felder einzeln an ➡️' : `Feld ${pos + 1} von ${board.size} · ${rolls} Würfe`}
      </div>
    </div>
  )
}
