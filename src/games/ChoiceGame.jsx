import { useState, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { generateQuestions } from './gameEngine.js'
import { sfx } from '../sfx.js'
import { lockPreviews, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Art, Critter, useMood, DragArea, Draggable, DropZone, RoundTrail, HintHand, useBursts } from '../components/play/index.js'
import { voice, KEY } from './woerter/voice.js'
import Finale from './woerter/Finale.jsx'
import { INK } from './px.js'
import './parade/parade.css'

/**
 * Musterpark: "Tierparade". Animals and things march in time across the
 * meadow behind a drumming giraffe: frog, dog, frog, dog … (the giraffe is
 * no animal of the patterns, so it never looks like part of the row). One
 * place in the parade is empty, a pulsing "?". The child drags the right one from the
 * waiting crowd into the gap (or taps it); then the drum rolls and the
 * parade marches on. A wrong one makes the whole parade stumble over its own
 * feet, and it is sent back to wait. Build rounds: the child lays the whole
 * continuation, place by place. A run of right answers makes the parade
 * louder; at the end everybody comes back for a bow.
 */

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// pictures in a string, without the emoji variation selector
const glyphs = s => [...s].filter(ch => ch !== '️').length
const countOf = (q, opt) => glyphs(opt) / glyphs(q.sym)
// The pictures one token stands for: a growing row's "🐸🐸🐸" is three frogs
const picsOf = (q, token) => (q.kind === 'grow' ? Array(countOf(q, token)).fill(q.sym) : [token])
// A group of a growing row stands in a little wagon, in a grid like the dots
// of a dice (up to two in a line, then two lines), so it is counted at a glance
const colsOf = n => (n <= 2 ? n : Math.ceil(n / 2))
const GROUP_E = 0.6   // a picture in a group, in marchers
// How wide a token is, in marchers
const widthOf = (q, token) => (q.kind !== 'grow' ? 1 : token === '❓' ? 1.4 : colsOf(countOf(q, token)) * GROUP_E + 0.25)
// For screen readers: the name, or how many of them
const labelOf = (q, opt) => (q.kind === 'grow' ? String(countOf(q, opt)) : q.names[opt] ?? '')

// The payoff: everybody hops in turn to the drum, so the pattern can be
// heard (A high, B low, C a pop), then the parade marches off
const BEAT_MS  = 240
const MARCH_MS = 1500
// The round trail stops short of the sun in the scene's top right corner
const SUN_GAP = 'clamp(0px, calc((100vw - 700px) * 0.6), 190px)'
// What a round starts with
const FRESH = { wrong: [], solved: false, marching: false, stumble: 0, placed: [], missesHere: 0, hopAt: -1 }
// The drum for the n-th kind of thing in the row: the pattern becomes a rhythm
const BEAT = [() => sfx.drum(true), () => sfx.drum(false), () => sfx.pop()]

/**
 * One marcher (or a little group of them), stepping in time. It stumbles
 * each time `stumble` goes up — never when it first appears.
 */
function Marcher({ q, token, size, i, stumble, hop = false }) {
  const controls = useAnimationControls()
  const seen = useRef(stumble)
  useEffect(() => {
    if (stumble === seen.current) return
    seen.current = stumble
    if (reduceMotion()) return
    controls.start({
      rotate: [0, i % 2 ? 25 : -25, i % 2 ? -10 : 10, 0], y: [0, size * 0.15, -size * 0.1, 0],
      transition: { duration: 0.8, delay: (i % 4) * 0.05 },
    })
  }, [stumble, controls, i, size])
  // its beat in the drum roll after a right answer: a hop
  useEffect(() => {
    if (!hop || reduceMotion()) return
    controls.start({ y: [0, -size * 0.4, 0], scaleY: [1, 1.12, 1], transition: { duration: 0.26 } })
  }, [hop, controls, size])
  return (
    <motion.div animate={controls} style={{ display: 'flex', alignItems: 'flex-end', transformOrigin: '50% 100%' }}>
      {q.kind === 'grow'
        ? <div className="pa-step" style={{ animationDelay: `${-(i % 2) * 0.3}s` }}><Group q={q} token={token} e={size * GROUP_E} /></div>
        : <div className="pa-step" style={{ animationDelay: `${-(i % 2) * 0.3}s` }}><Art art={token} size={size} /></div>}
    </motion.div>
  )
}

/** A group of a growing row: its pictures in a dice grid, in a wagon. */
function Group({ q, token, e }) {
  const n = countOf(q, token)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${colsOf(n)}, ${e}px)`, gap: 2, padding: e * 0.12, borderRadius: e * 0.3,
      background: 'rgba(255,253,247,0.85)', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.25)',
    }}>
      {picsOf(q, token).map((p, k) => <Art key={k} art={p} size={e} />)}
    </div>
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
  const [idx,      setIdx]      = useState(0)
  const [rs,       setRs]       = useState(FRESH)   // this round's state
  const [firstTry, setFirstTry] = useState(0)
  const [streak,   setStreak]   = useState(0)
  const [ready,    setReady]    = useState(false)   // payoff over: next round
  const [finale,   setFinale]   = useState(false)
  const [leader, setLeader] = useMood()
  const [crowd,  setCrowd]  = useState([])          // who marched into the 🎪 so far
  const timers   = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const stageRef = useRef(null)
  const gapRef   = useRef(null)
  const trayRef  = useRef(null)
  const stageW   = useWidth(stageRef)
  const upd = patch => setRs(r => ({ ...r, ...patch }))

  const q = questions[idx]
  const build = q?.kind === 'build'
  const { wrong, solved, placed, missesHere } = rs

  // New round: the parade marches in; the task is the gap itself
  useEffect(() => {
    if (!q) return
    lockPreviews()
    sayTask()
    if (idx === 0) voice([KEY.task('parade')])
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Right: the drum rolls and the parade marches on, out of the picture
  const win = useCallback(() => {
    const first = !rs.wrong.length
    if (first) setFirstTry(n => n + 1)
    const s = first ? streak + 1 : 0
    setStreak(s)
    upd({ solved: true })
    setLeader('dance', 600 + q.tokens.length * BEAT_MS + 400)
    sayRight()
    if (gapRef.current) burst(gapRef.current, s >= 3 ? 'confetti' : 'stars', s >= 3 ? 20 : 10)
    // the drum roll: each marcher hops on its beat, its sound by its kind
    const kinds = []
    const soundOf = sym => { if (!kinds.includes(sym)) kinds.push(sym); return BEAT[kinds.indexOf(sym) % BEAT.length] }
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    q.tokens.forEach((token, i) => {
      const sym = token !== '❓' ? token : build ? q.fill[i - q.gapAt] : q.answer
      const sound = q.kind === 'grow' ? () => sfx.drum(i % 2 === 0) : soundOf(sym)
      at(500 + i * BEAT_MS, () => { upd({ hopAt: i }); sound() })
    })
    const end = 500 + q.tokens.length * BEAT_MS
    if (s >= 3) at(end, () => sfx.tada())
    // then the parade marches into the tent, and one of it stays in front
    at(end + 150, () => { if (!reduceMotion()) upd({ marching: true, hopAt: -1 }) })
    at(end + 900, () => setCrowd(c => [...c, q.sym ?? q.unit[0]]))
    afterNarration(() => at(0, () => setReady(true)), { minMs: end + MARCH_MS })
  }, [rs.wrong, streak, setLeader, burst, q, build])

  // Wrong: everybody stumbles, the piece goes back to wait
  const trip = useCallback((opt, extra = {}) => {
    setRs(r => ({ ...r, ...extra, wrong: r.wrong.includes(opt) ? r.wrong : [...r.wrong, opt], stumble: r.stumble + 1 }))
    setStreak(0)
    setLeader('oops', 1100)
    sfx.slideDown()
    sayWrong()
  }, [setLeader])

  // Next round once the parade is gone, never while the help is open
  useEffect(() => {
    if (!ready || paused) return
    setReady(false)
    if (idx + 1 >= questions.length) { setFinale(true); return }
    setRs(FRESH)
    setIdx(i => i + 1)
  }, [ready, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // A piece dropped into the gap (next / gap / grow rounds)
  const dropGap = useCallback((opt) => {
    if (solved) return false
    if (opt !== q.answer) { trip(opt); return false }
    win()
    return true
  }, [solved, q, trip, win])

  // Build rounds: a piece goes to the next empty place; a wrong one goes
  // back, and after two misses on one place the right piece lights up.
  const dropSlot = useCallback((opt) => {
    if (solved) return false
    if (opt !== q.fill[placed.length]) { trip(opt, { missesHere: missesHere + 1 }); return false }
    const next = [...placed, opt]
    upd({ placed: next, missesHere: 0 })
    if (next.length < q.fill.length) { sfx.pop(); return true }
    win()
    return true
  }, [solved, q, placed, missesHere, trip, win])

  if (!q) return null

  // Marcher size: the whole parade and the giraffe in front fit one line
  // (the groups of a growing row stand apart, so each can be counted)
  const spread = q.kind === 'grow' ? 0.45 : 0.08
  // the giraffe (1.25 marchers) and its space in front
  const leaderW = 1.35 + 2 * spread
  const unitsOf = list => list.reduce((n, i) => n + widthOf(q, q.tokens[i]) + spread, 0)
  const all = q.tokens.map((_, i) => i)
  // On a phone a long parade goes round the bend: two lines, read like a
  // book, instead of pictures too small to tell apart
  const oneLine = (stageW - 24) / (unitsOf(all) + leaderW)
  // … breaking only between two rounds of the pattern (or two groups)
  const unitLen = q.unit?.length ?? 1
  const half = Math.max(unitLen, Math.round(all.length / 2 / unitLen) * unitLen)
  // (a growing row's pictures are small in their wagons: it bends sooner)
  const bend = q.kind === 'grow' ? oneLine < 70 : oneLine < 46 && all.length > 5
  const lines = bend && half < all.length ? [all.slice(0, half), all.slice(half)] : [all]
  const size = Math.min(104, lines.length > 1
    ? (stageW - 24) / Math.max(unitsOf(lines[0]), unitsOf(lines[1]) + leaderW)
    : oneLine)
  const gap = size * spread
  // the right piece, lit up after two misses on one place
  const showPiece = build && !solved && missesHere >= 2 ? q.fill[placed.length] : null
  const optGap = stageW > 600 ? 36 : 12
  // groups get two to a line on a phone, so their pictures stay countable
  const optPerLine = q.kind === 'grow' && stageW <= 600 ? 2 : q.options.length
  const optCols = q.kind === 'grow' ? Math.max(...q.options.map(o => colsOf(countOf(q, o)))) : 1
  const optRoom = (stageW - (optPerLine - 1) * optGap) / optPerLine - 30
  const optSize = q.kind === 'grow' ? Math.min(46, optRoom / optCols) : Math.min(96, Math.max(48, optRoom))

  // one place in the parade: a marcher, or the gap waiting for one
  const renderToken = (token, i) => {
    if (token !== '❓') return <div role="listitem" key={i} style={{ position: 'relative' }}><Marcher q={q} token={token} size={size} i={i} stumble={rs.stumble} hop={rs.hopAt === i} /></div>
    const slot = i - q.gapAt
    const piece = build ? placed[slot] : solved ? q.answer : null
    const waiting = !solved && (!build || slot === placed.length)
    const zone = build ? `slot-${slot}` : 'gap'
    return (
      <div role="listitem" key={i} ref={waiting || (solved && slot === 0) ? gapRef : undefined} style={{ position: 'relative' }}>
        <DropZone id={zone} onDrop={build ? dropSlot : dropGap} label="Lücke in der Parade" slop={size * 0.4}>
          {hover => piece != null
            ? <motion.div initial={{ scale: 0.3, y: -size }} animate={{ scale: 1, y: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 16 }}>
                <Marcher q={q} token={piece} size={size} i={i} stumble={rs.stumble} hop={rs.hopAt === i} />
              </motion.div>
            : <div className={waiting ? 'pa-ring' : undefined} style={{
                width: size * (q.kind === 'grow' ? 1.4 : 1), height: size, boxSizing: 'border-box', borderRadius: size * 0.3,
                border: `3px dashed ${hover ? '#ff9a3c' : INK}`, background: hover ? 'rgba(255,201,60,0.55)' : 'rgba(255,253,247,0.75)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size * 0.5, color: INK, opacity: waiting ? 1 : 0.55,
              }}>?</div>}
        </DropZone>
      </div>
    )
  }

  // The hand: on the first task of the level (a worked example) and after a
  // miss it drags the right piece into the gap; otherwise it only taps the
  // gap, so it never points at a wrong piece
  const rightPiece = build ? q.fill[placed.length] : q.answer
  const showRight = idx === 0 || wrong.length > 0
  const hintFrom = showRight ? { get current() { return trayRef.current?.querySelector(`[data-opt="${rightPiece}"]`) } } : null

  return (
    <DragArea autoTarget={build ? `slot-${placed.length}` : 'gap'} disabled={solved || finale}>
      <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(10px,2vw,22px) clamp(10px,3vw,32px)', gap: 12 }}>
        <div style={{ position: 'relative', width: '100%', maxWidth: 900, flexShrink: 0, paddingRight: SUN_GAP, boxSizing: 'border-box' }}>
          <RoundTrail total={questions.length} done={idx + (solved ? 1 : 0)} walker="🐘" goal="🎪" />
          {/* the crowd in front of the 🎪: one from every parade so far */}
          <div aria-hidden="true" style={{ position: 'absolute', top: '100%', right: SUN_GAP, display: 'flex', flexDirection: 'row-reverse', paddingRight: 6 }}>
            {crowd.map((c, k) => (
              <motion.div key={k} initial={{ x: -60, y: -30, scale: 0, opacity: 0 }} animate={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={{ marginLeft: -6 }}>
                <div className="pa-wait" style={{ animationDelay: `${-k * 0.3}s` }}><Art art={c} size={30} /></div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* The parade on its road */}
        <div ref={stageRef} data-answer={build ? q.fill.join('|') : q.answer} style={{ position: 'relative', width: '100%', maxWidth: 1100, flex: 1, minHeight: size * 1.9 * lines.length, display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <motion.div key={idx} role="list" aria-label="Parade"
            initial={reduceMotion() ? false : { x: '-110%' }}
            animate={{ x: rs.marching ? '115%' : 0 }}
            transition={rs.marching ? { duration: 1.3, ease: 'easeIn' } : { duration: 0.8, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', gap: size * 0.45, width: '100%' }}>
            {lines.map((line, li) => (
              <div key={li} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap }}>
                <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: -size * 0.14, height: size * 0.4, borderRadius: 99,
                  background: '#e9c98f', border: `3px solid ${INK}`, boxShadow: 'inset 0 -6px 0 rgba(138,79,34,0.25)' }} />
                {line.map(i => renderToken(q.tokens[i], i))}
                {/* the drummer up front */}
                {li === lines.length - 1 && (
                  <div style={{ position: 'relative', marginLeft: gap * 2, flexShrink: 0 }}>
                    <Critter art="🦒" size={size * 1.25} mood={leader} label="Giraffe mit Trommel"
                      accessory={<div aria-hidden="true" style={{ position: 'absolute', left: -size * 0.2, bottom: -size * 0.05 }}><Art art="🥁" size={size * 0.6} /></div>}
                      onTap={() => { sfx.drum(true); setLeader('dance', 1200) }} />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </div>

        {/* Waiting by the road: the pieces to choose from. In build rounds
            each one can be used again and again. */}
        <div ref={trayRef} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'flex-end', gap: optGap, width: '100%', maxWidth: 900, flexShrink: 0, minHeight: optSize + 20 }}>
          {q.options.map((opt, oi) => {
            const tried = !build && wrong.includes(opt)
            const glow = opt === showPiece
            const gone = !build && solved && opt === q.answer
            return (
              <div key={`${idx}-${opt}`} className="pa-wait" style={{ animationDelay: `${-oi * 0.45}s`, visibility: gone ? 'hidden' : 'visible' }}>
                <Draggable id={`${idx}-${oi}`} data={opt} label={labelOf(q, opt)} disabled={tried || solved} data-opt={opt}
                  style={{ opacity: tried ? 0.4 : 1, filter: tried ? 'grayscale(0.7)' : undefined }}>
                  <div style={{
                    padding: 8, borderRadius: 22, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                    minWidth: 68, minHeight: 68,
                    background: glow ? 'rgba(255,201,60,0.9)' : 'rgba(255,253,247,0.7)', border: `3px solid ${glow ? INK : 'rgba(42,27,61,0.25)'}`,
                    boxShadow: glow ? '0 0 0 6px rgba(255,201,60,0.5)' : '0 4px 0 rgba(42,27,61,0.2)',
                  }}>
                    {q.kind === 'grow' ? <Group q={q} token={opt} e={optSize} /> : <Art art={opt} size={optSize} />}
                  </div>
                </Draggable>
              </div>
            )
          })}
        </div>
        <HintHand key={`hand-${idx}`} from={hintFrom} to={gapRef} active={!solved && !finale} delay={idx === 0 ? 2000 : showRight ? 1500 : 6000} />
        {finale && <Finale items={questions.map(x => x.sym ?? x.unit[0])} hero="🦒"
          onDone={() => onComplete(result(firstTry, questions.length))} />}
      </div>
      {bursts}
    </DragArea>
  )
}
