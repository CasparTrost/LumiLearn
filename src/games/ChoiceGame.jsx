import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { generateQuestions } from './gameEngine.js'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, lockPreviews, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import HearOptions from '../components/HearOptions.jsx'
import { Art, Critter, useMood, DragArea, Draggable, DropZone, RoundTrail, useBursts } from '../components/play/index.js'
import { INK } from './px.js'
import './parade/parade.css'

/**
 * Musterpark: "Tierparade". Animals and things march in time across the
 * meadow behind a drumming bear: frog, dog, frog, dog … One place in the
 * parade is empty. The child drags the right one from the waiting crowd
 * into the gap (or taps it); then the drum rolls and the parade marches on.
 * A wrong one makes the whole parade stumble over its own feet, and it is
 * sent back to wait. Build rounds: the child lays the whole continuation,
 * place by place.
 */

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// What the voice says about a question.
const nameOf = (q, e) => q.names[e] ?? ''
// pictures in a string, without the emoji variation selector
const glyphs = s => [...s].filter(ch => ch !== '️').length
const countOf = (q, opt) => glyphs(opt) / glyphs(q.sym)
// The pictures one token stands for: a growing row's "🐸🐸🐸" is three frogs
const picsOf = (q, token) => (q.kind === 'grow' ? Array(countOf(q, token)).fill(q.sym) : [token])
// How wide a token is, in marchers (a group of three stands close together)
const widthOf = (q, token) => (q.kind === 'grow' && token !== '❓' ? 0.15 + countOf(q, token) * 0.85 : 1)

function optionName(q, opt) {
  return q.kind === 'grow' ? sayNumber(countOf(q, opt)) : nameOf(q, opt)
}

// "Genau! Immer wieder Frosch, Frosch, Hund."
function praiseFor(q) {
  if (q.kind === 'grow') return `${q.counts.map(sayNumber).join(', ')}. Es wird immer eins mehr.`
  if (q.kind === 'build') return `${q.fill.map(e => nameOf(q, e)).join(', ')}!`
  return `Immer wieder ${q.unit.map(e => nameOf(q, e)).join(', ')}.`
}

// After a miss the row is read out, so the child can hear the rhythm:
// "Hör mal! Frosch, Hund, Frosch, Hund, Frosch – und dann?"
function hintFor(q, placed = []) {
  if (q.kind === 'build') return `Hör mal! ${[...q.tokens.slice(0, q.gapAt), ...placed].map(e => nameOf(q, e)).join(', ')}, und dann?`
  if (q.kind === 'grow') return `Hör mal! ${q.counts.slice(0, 3).map(sayNumber).join(', ')}, und dann?`
  if (q.kind === 'gap') {
    const said = q.tokens.map(t => (t === '❓' ? 'und hier?' : nameOf(q, t)))
    return `Hör mal! ${said.join(', ')}.`
  }
  return `Hör mal! ${q.tokens.slice(0, -1).map(e => nameOf(q, e)).join(', ')}, und dann?`
}

/** One marcher (or a little group of them), stepping in time. */
function Marcher({ q, token, size, i, stumble }) {
  const pics = picsOf(q, token)
  return (
    <motion.div
      animate={stumble && !reduceMotion()
        ? { rotate: [0, i % 2 ? 25 : -25, i % 2 ? -10 : 10, 0], y: [0, size * 0.15, -size * 0.1, 0] }
        : { rotate: 0, y: 0 }}
      transition={{ duration: 0.8, delay: (i % 4) * 0.05 }}
      style={{ display: 'flex', alignItems: 'flex-end', transformOrigin: '50% 100%' }}>
      {pics.map((p, k) => (
        <div key={k} className="pa-step" style={{ animationDelay: `${-((i + k) % 2) * 0.3}s`, marginLeft: k ? -size * 0.15 : 0 }}>
          <Art art={p} size={size} />
        </div>
      ))}
    </motion.div>
  )
}

function useWidth(ref) {
  const [w, setW] = useState(0)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setW(el.clientWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return w
}

export default function ChoiceGame({ moduleId, level, onComplete }) {
  const [questions]   = useState(() => generateQuestions(moduleId, level))
  const paused        = usePaused()
  const [bursts, burst] = useBursts()
  const [idx,         setIdx]         = useState(0)
  const [wrong,       setWrong]       = useState([])      // options already tried this round
  const [solved,      setSolved]      = useState(false)
  const [marching,    setMarching]    = useState(false)   // the parade moves on
  const [stumble,     setStumble]     = useState(0)       // the parade trips over a wrong one
  const [firstTry,    setFirstTry]    = useState(0)
  const [ready,       setReady]       = useState(false)   // payoff over: next round
  // build rounds: the pieces laid so far and the misses on the current place
  const [placed,      setPlaced]      = useState([])
  const [missesHere,  setMissesHere]  = useState(0)
  const [leader, setLeader] = useMood()
  const stageRef = useRef(null)
  const gapRef   = useRef(null)
  const stageW   = useWidth(stageRef)

  const q = questions[idx]
  const build = q?.kind === 'build'

  // New round: clear the board, then ask once the parade has marched in
  useEffect(() => {
    setWrong([]); setSolved(false); setMarching(false)
    setPlaced([]); setMissesHere(0)
    if (!q) return
    lockPreviews()
    const say = q.say ?? q.prompt
    const id = setTimeout(() => sayTask(idx === 0
      ? `Die Parade zieht vorbei! Ein Platz ist noch frei. ${say}${build ? '' : ' Zieh das passende Bild in die Lücke.'}`
      : say), 1100)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Right: the drum rolls and the parade marches on, out of the picture
  const win = useCallback(() => {
    setSolved(true)
    if (!wrong.length) setFirstTry(n => n + 1)
    setLeader('happy', 1400)
    sayRight(praiseFor(q))
    if (gapRef.current) burst(gapRef.current, 'stars')
    if (!reduceMotion()) setTimeout(() => setMarching(true), 700)
    ;[0, 1, 2, 3, 4, 5].forEach(i => setTimeout(() => sfx.drum(i % 2 === 1), 700 + i * 260))
    afterNarration(() => setReady(true), { minMs: 2300 })
  }, [q, wrong, setLeader, burst])

  // Wrong: everybody stumbles, the piece goes back to wait
  const trip = useCallback((opt, hint) => {
    setWrong(w => (w.includes(opt) ? w : [...w, opt]))
    setStumble(n => n + 1)
    setLeader('oops', 1100)
    sfx.slideDown()
    sayWrong(hint)
  }, [setLeader])

  // Next round once the parade is gone, never while the help is open
  useEffect(() => {
    if (!ready || paused) return
    setReady(false)
    if (idx + 1 >= questions.length) {
      sfx.complete()
      onComplete(result(firstTry, questions.length))
    } else setIdx(i => i + 1)
  }, [ready, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // A piece dropped into the gap (next / gap / grow rounds)
  const dropGap = useCallback((opt) => {
    if (solved) return false
    if (opt !== q.answer) { trip(opt, hintFor(q)); return false }
    win()
    return true
  }, [solved, q, trip, win])

  // Build rounds: a piece goes to the next empty place. Lumi says the pieces
  // laid so far; a wrong one goes back, and after two misses on one place
  // the right piece lights up and is named.
  const dropSlot = useCallback((opt) => {
    if (solved) return false
    const want = q.fill[placed.length]
    if (opt !== want) {
      const n = missesHere + 1
      setMissesHere(n)
      trip(opt, n >= 2 ? `Als Nächstes kommt ${nameOf(q, want)}.` : hintFor(q, placed))
      return false
    }
    const next = [...placed, opt]
    setPlaced(next)
    setMissesHere(0)
    if (next.length < q.fill.length) {
      sfx.pop()
      narrate([{ text: `${next.map(e => nameOf(q, e)).join(', ')}!` }])
      return true
    }
    win()
    return true
  }, [solved, q, placed, missesHere, trip, win])

  if (!q) return null

  // Marcher size: the whole parade and the bear in front fit one line
  // (the groups of a growing row stand apart, so each can be counted)
  const spread = q.kind === 'grow' ? 0.45 : 0.08
  const bear = stageW > 600 ? 1.5 : 1.1
  const unitsOf = list => list.reduce((n, i) => n + widthOf(q, q.tokens[i]) + spread, 0)
  const all = q.tokens.map((_, i) => i)
  // On a phone a long parade goes round the bend: two lines, read like a
  // book, instead of pictures too small to tell apart
  const oneLine = (stageW - 24) / (unitsOf(all) + bear)
  const half = Math.ceil(all.length / 2)
  const lines = oneLine < 46 && all.length > 5 ? [all.slice(0, half), all.slice(half)] : [all]
  const size = Math.min(104, lines.length > 1
    ? (stageW - 24) / Math.max(unitsOf(lines[0]), unitsOf(lines[1]) + bear)
    : oneLine)
  const gap = size * spread
  // the right piece, lit up after two misses on one place
  const showPiece = build && !solved && missesHere >= 2 ? q.fill[placed.length] : null
  const optW = Math.max(...q.options.map(o => widthOf(q, o)))
  const optGap = stageW > 600 ? 36 : 12
  const optSize = Math.min(96, Math.max(44, ((stageW - (q.options.length - 1) * optGap) / q.options.length - 24) / optW))

  // one place in the parade: a marcher, or the gap waiting for one
  const renderToken = (token, i) => {
    if (token !== '❓') return <div role="listitem" key={i} style={{ position: 'relative' }}><Marcher q={q} token={token} size={size} i={i} stumble={stumble} /></div>
    const slot = i - q.gapAt
    const piece = build ? placed[slot] : solved ? q.answer : null
    const waiting = !solved && (!build || slot === placed.length)
    const zone = build ? `slot-${slot}` : 'gap'
    return (
      <div role="listitem" key={i} ref={waiting ? gapRef : undefined} style={{ position: 'relative' }}>
        <DropZone id={zone} onDrop={build ? dropSlot : dropGap} label="Lücke in der Parade" slop={size * 0.4}>
          {hover => piece != null
            ? <motion.div initial={{ scale: 0.3, y: -size }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }}>
                <Marcher q={q} token={piece} size={size} i={i} stumble={0} />
              </motion.div>
            : <div className={waiting ? 'pa-ring' : undefined} style={{
                width: size * (q.kind === 'grow' ? 1.6 : 1), height: size, boxSizing: 'border-box', borderRadius: size * 0.3,
                border: `3px dashed ${hover ? '#ff9a3c' : INK}`, background: hover ? 'rgba(255,201,60,0.55)' : 'rgba(255,253,247,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.5, color: INK, opacity: waiting ? 1 : 0.55,
              }}>?</div>}
        </DropZone>
      </div>
    )
  }

  return (
    <DragArea autoTarget={build ? `slot-${placed.length}` : 'gap'} disabled={solved}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(10px,2vw,22px) clamp(10px,3vw,32px)', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', maxWidth: 900, flexShrink: 0 }}>
          <RoundTrail total={questions.length} done={idx + (solved ? 1 : 0)} walker="🐘" goal="🎪" style={{ flex: 1 }} />
          <HearOptions size={52} label="Aufgabe und Antworten vorlesen" items={[q.prompt, ...q.options.map(o => optionName(q, o))]} />
        </div>

        {/* The parade on its road */}
        <div ref={stageRef} data-answer={build ? q.fill.join('|') : q.answer} style={{ position: 'relative', width: '100%', maxWidth: 1100, flex: 1, minHeight: size * 1.9 * lines.length, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <motion.div key={idx} role="list" aria-label="Parade"
            initial={reduceMotion() ? false : { x: '-110%' }}
            animate={{ x: marching ? '115%' : 0 }}
            transition={marching ? { duration: 1.6, ease: 'easeIn' } : { duration: 1, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: size * 0.45, width: '100%' }}>
            {lines.map((line, li) => (
              <div key={li} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap }}>
                <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: -size * 0.14, height: size * 0.4, borderRadius: 99,
                  background: '#e9c98f', border: `3px solid ${INK}`, boxShadow: 'inset 0 -6px 0 rgba(138,79,34,0.25)' }} />
                {line.map(i => renderToken(q.tokens[i], i))}
                {/* the drummer up front */}
                {li === lines.length - 1 && (
                  <div style={{ position: 'relative', marginLeft: gap * 2, flexShrink: 0 }}>
                    <Critter art="🐻" size={size * 1.25} mood={leader} label="Bär mit Trommel" talks
                      onTap={() => { sfx.drum(true); setLeader('dance', 1200) }} />
                    <div aria-hidden="true" style={{ position: 'absolute', left: -size * 0.2, bottom: -size * 0.05 }}><Art art="🥁" size={size * 0.6} /></div>
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Waiting by the road: the pieces to choose from. In build rounds
            each one can be used again and again. */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: optGap, width: '100%', maxWidth: 900, flexShrink: 0, minHeight: optSize + 20 }}>
          {q.options.map((opt, oi) => {
            const tried = !build && wrong.includes(opt)
            const glow = opt === showPiece
            const gone = !build && solved && opt === q.answer
            return (
              <div key={`${idx}-${opt}`} className="pa-wait" style={{ animationDelay: `${-oi * 0.45}s`, visibility: gone ? 'hidden' : 'visible' }}>
                <Draggable id={`${idx}-${oi}`} data={opt} label={optionName(q, opt)} disabled={tried || solved}
                  style={{ opacity: tried ? 0.4 : 1, filter: tried ? 'grayscale(0.7)' : undefined }}>
                  <div data-opt={opt} {...hearable(optionName(q, opt))} style={{
                    padding: 8, borderRadius: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    minWidth: 64, minHeight: 64,
                    background: glow ? 'rgba(255,201,60,0.9)' : 'rgba(255,253,247,0.7)', border: `3px solid ${glow ? INK : 'rgba(42,27,61,0.25)'}`,
                    boxShadow: glow ? '0 0 0 6px rgba(255,201,60,0.5)' : '0 4px 0 rgba(42,27,61,0.2)',
                  }}>
                    {picsOf(q, opt).map((p, k) => <div key={k} style={{ marginLeft: k ? -optSize * 0.15 : 0 }}><Art art={p} size={optSize} /></div>)}
                  </div>
                </Draggable>
              </div>
            )
          })}
        </div>
      </div>
      {bursts}
    </DragArea>
  )
}
