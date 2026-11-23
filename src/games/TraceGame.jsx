import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { hearable } from '../lib/hearable.js'
import { narrate, lockPreviews, afterNarration, stopNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { emojiSrc, hasEmojiArt } from '../lib/emojiArt.jsx'
import { Art, Critter, RoundTrail } from '../components/play/index.js'
import { soundOf } from './letterSounds.js'
import {
  GLYPHS, isDigit, pathOf, lengths, pointAt, guidanceFor, glyphsForLevel, makeTracer,
} from './traceStrokes.js'
import { pxPanel, pxBubble, pxButton, INK } from './px.js'

/**
 * Buchstaben-Spuren — Buchstaben und Ziffern mit dem Finger nachfahren.
 *
 * Scientific basis:
 *   • Writing a letter by hand makes it easier to recognise than typing it or
 *     only looking at it (Longcamp et al. 2005; James & Engelhardt 2012): the
 *     movement itself is what is learned. So the path matters — every stroke
 *     starts at its green dot, runs the way the arrow shows, in the order
 *     children learn in school.
 *   • Show, then do: on the very first letter Lumi's finger draws the stroke
 *     once before the child tries (worked example). After two slips on the
 *     same stroke it is shown again.
 *   • Fading help: from level 7 only one arrow at the start, from level 9 a
 *     paler road, at level 10 only a faint outline and the start dots.
 *   • Once a letter is done, Lumi says its sound with a word and its picture
 *     ("Mmm wie Maus"): the shape, the movement and the sound together.
 *   • And it is a little celebration: the finger leaves a sparkly trail, the
 *     finished letter gets eyes and hops, and its picture pops up next to it.
 */

// How the voice says a letter's NAME in the task ("Fahre das Emm nach"). A
// lone "M" is read in very different ways, so it is spelled out.
const NAME = {
  A: 'Ah', B: 'Beh', C: 'Zeh', D: 'Deh', E: 'Eh', F: 'Eff', G: 'Geh', H: 'Ha', I: 'Ih', J: 'Jott',
  K: 'Ka', L: 'Ell', M: 'Emm', N: 'Enn', O: 'Oh', P: 'Peh', Q: 'Kuh', R: 'Err', S: 'Ess', T: 'Teh',
  U: 'Uh', V: 'Fau', W: 'Weh', X: 'Iks', Y: 'Üpsilon', Z: 'Zett',
}
const NUMBER = ['Null', 'Eins', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun']
const STROKE_NO = ['', 'eins', 'zwei', 'drei', 'vier']   // "Jetzt Strich zwei."

// One word per letter for "Mmm wie Maus": a word that begins with the
// letter's own sound and has a picture in the app (the same words as in
// ABC-Abenteuer and Anlaut-Detektiv). No Giraffe under G (that is "sch").
// X has no word that starts with its sound; it is heard inside Taxi.
const WORD = {
  A: ['Affe', '🐒'],   B: ['Bär', '🐻'],     C: ['Clown', '🤡'],  D: ['Dino', '🦖'],
  E: ['Ente', '🦆'],   F: ['Fisch', '🐟'],   G: ['Gurke', '🥒'],  H: ['Haus', '🏠'],
  I: ['Igel', '🦔'],   J: ['Jacke', '🧥'],   K: ['Katze', '🐱'],  L: ['Löwe', '🦁'],
  M: ['Maus', '🐭'],   N: ['Nase', '👃'],    O: ['Oma', '👵'],    P: ['Pinguin', '🐧'],
  Q: ['Qualle', '🪼'], R: ['Rakete', '🚀'],  S: ['Sonne', '☀️'],  T: ['Tiger', '🐯'],
  U: ['Ufo', '🛸'],    V: ['Vogel', '🐦'],   W: ['Wal', '🐋'],    X: ['Taxi', '🚕'],
  Y: ['Yoga', '🧘'],   Z: ['Zebra', '🦓'],
}

/** "das Emm" / "die Drei" — for the voice */
const spokenName = g => (isDigit(g) ? `die ${NUMBER[+g]}` : `das ${NAME[g]}`)

/** What Lumi says and shows when a glyph is done. */
function praiseOf(g) {
  if (isDigit(g)) {
    const n = +g
    return { say: n ? `Das ist die ${NUMBER[n]}.` : 'Das ist die Null. Null heißt: gar nichts.', show: NUMBER[n] }
  }
  const [w, e] = WORD[g]
  if (g === 'X') return { say: `${soundOf(g)}, wie in ${w}!`, show: `${g} wie in ${w}`, e }
  return { say: `${soundOf(g)} wie ${w}!`, show: `${g} wie ${w}`, e }
}

const HINT = {
  wrongStart: 'Fang beim grünen Punkt an.',
  offPath:    'Bleib auf dem Weg.',
  wrongWay:   'Folge dem Pfeil.',
  short:      'Fahre weiter bis zum Ende.',
}

// Bright inks, one per glyph, each clearly visible on the light road; no
// red, which means "wrong" elsewhere in the app
const INKS = ['#2F7FD8', '#8A4FD0', '#13968C', '#D63A7C', '#E07A10', '#3B9B3B']
const VIEW = { x: -12, y: -8, w: 124, h: 156 }      // the stroke box plus room for dots
const ROAD = 17, INK_W = 11
const ICON_BTN = { ...pxButton('parch'), width: 52, height: 52, padding: 0, fontSize: 24, lineHeight: 1, flexShrink: 0 }
const HAND = hasEmojiArt('👆') ? emojiSrc('👆') : null

/** Where the direction arrows go on a stroke. */
function arrowsOn(stroke, mode) {
  if (mode === 'none') return []
  const cum = lengths(stroke)
  const len = cum[cum.length - 1]
  const first = Math.min(16, len * 0.4)
  if (mode === 'start') return [pointAt(stroke, first, cum)]
  const out = []
  for (let s = first; s < len - 8; s += 32) out.push(pointAt(stroke, s, cum))
  return out
}

/** Part of a stroke, from its start to share t (for the demo finger). */
function partOf(stroke, t) {
  const cum = lengths(stroke)
  const s = cum[cum.length - 1] * t
  const pts = stroke.filter((_, i) => cum[i] <= s)
  const tip = pointAt(stroke, s, cum)
  return { d: pathOf([...pts, tip]), tip }
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setSize(s => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

let fadeIds = 0, sparkIds = 0
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// a little four-pointed star for the sparkly trail
const SPARK = 'M0 -5 L1.3 -1.3 L5 0 L1.3 1.3 L0 5 L-1.3 1.3 L-5 0 L-1.3 -1.3 Z'

export default function TraceGame({ level = 1, onComplete }) {
  const glyphs = useState(() => glyphsForLevel(level))[0]
  const guide = guidanceFor(level)
  const paused = usePaused()

  const [idx,       setIdx]       = useState(0)
  const [strokeIdx, setStrokeIdx] = useState(0)
  const [done,      setDone]      = useState(false)
  const [ink,       setInk]       = useState([])     // the finger's line of this attempt
  const [fading,    setFading]    = useState([])     // slipped attempts, fading away
  const [demo,      setDemo]      = useState(null)   // { id, stroke, t } while Lumi shows the way
  const [mood,      setMood]      = useState('idle')
  const [firstTry,  setFirstTry]  = useState(0)
  const [leaving,   setLeaving]   = useState(false)
  const [sparks,    setSparks]    = useState([])     // the sparkly trail behind the finger
  const [advance,   setAdvance]   = useState(false)  // the praise is over: next glyph

  const rootRef   = useRef(null)
  const areaRef   = useRef(null)
  const svgRef    = useRef(null)
  const tracerRef = useRef(null)
  const pointerRef = useRef(null)   // the finger that draws; others are ignored
  const inkRef    = useRef([])
  const missedRef = useRef(false)   // this glyph had a slip: not first try
  const strokeMissRef = useRef(0)
  const demoT     = useRef(0)
  const demoEnd   = useRef(null)
  const demoShown = useRef(false)

  const root = useSize(rootRef)
  const area = useSize(areaRef)
  const wide = root.w > root.h * 1.15 && root.w >= 640

  const g = glyphs[idx]
  const strokes = GLYPHS[g]
  const color = INKS[idx % INKS.length]
  const praise = praiseOf(g)
  // where the finished glyph gets its eyes: in the middle, near the top
  const face = useMemo(() => {
    const pts = GLYPHS[g].flat()
    const xs = pts.map(p => p.x), ys = pts.map(p => p.y)
    const top = Math.min(...ys), h = Math.max(...ys) - top
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: top + Math.min(30, h * 0.24) }
  }, [g])
  const canTrace = !done && !demo && !paused && !leaving

  useEffect(() => { lockPreviews(); return () => stopNarration() }, [])

  const sayRound = useCallback((prefix = '') => {
    sayTask(`${prefix}Fahre ${spokenName(g)} nach. Fang beim grünen Punkt an.`)
  }, [g])

  const startDemo = useCallback((stroke, after) => {
    tracerRef.current = null
    inkRef.current = []
    setInk([])
    demoT.current = 0
    demoEnd.current = after ?? null
    setDemo({ id: Date.now(), stroke, t: 0 })
  }, [])

  // Round start, and again after the help was closed. The very first letter
  // is shown once before the child tries.
  useEffect(() => {
    if (paused || done || demo) return
    const t = setTimeout(() => {
      if (level === 1 && idx === 0 && !demoShown.current) {
        demoShown.current = true
        narrate([{ text: `Schau mal, so fährt man ${spokenName(g)} nach.` }])
        startDemo(0, () => sayRound('Jetzt du! '))
      } else sayRound()
    }, 400)
    return () => clearTimeout(t)
  }, [idx, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // The demo finger: runs along the stroke, holds still while paused
  useEffect(() => {
    if (!demo || paused) return
    const len = lengths(strokes[demo.stroke]).at(-1)
    const dur = Math.max(1100, len * 13)
    let raf, prev = null, endTimer
    const tick = now => {
      if (prev != null) demoT.current = Math.min(1, demoT.current + (now - prev) / dur)
      prev = now
      setDemo(d => d && { ...d, t: demoT.current })
      if (demoT.current < 1) raf = requestAnimationFrame(tick)
      else endTimer = setTimeout(() => {
        setDemo(null)
        const after = demoEnd.current
        demoEnd.current = null
        after?.()
      }, 500)
    }
    raf = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(raf); clearTimeout(endTimer) }
  }, [demo?.id, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Tracing ───────────────────────────────────────────────────────────────
  const toBox = ev => {
    const m = svgRef.current?.getScreenCTM()
    if (!m) return null
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }

  const clearInk = () => {
    tracerRef.current = null
    const pts = inkRef.current
    inkRef.current = []
    setInk([])
    return pts
  }

  const finishGlyph = () => {
    setDone(true)
    setMood('happy')
    sfx.correct()
    setTimeout(() => sfx.boing(), 450)
    if (!missedRef.current) setFirstTry(n => n + 1)
    sayRight(praise.say)
    afterNarration(() => setAdvance(true), { minMs: 2400 })
  }

  const acceptStroke = () => {
    clearInk()
    strokeMissRef.current = 0
    const next = strokeIdx + 1
    setStrokeIdx(next)
    if (next >= strokes.length) { finishGlyph(); return }
    sfx.coin()
    setMood('idle')
    if (guide.arrows === 'all') narrate([{ text: `Jetzt Strich ${STROKE_NO[next + 1]}.` }])
  }

  const slip = kind => {
    const real = tracerRef.current?.real
    const pts = clearInk()
    if (pts.length > 1) setFading(f => [...f, { id: ++fadeIds, pts }])
    if (!real) { narrate([{ text: HINT.wrongStart }], { skipIfSame: true }); return }
    missedRef.current = true
    setMood('oops')
    if (++strokeMissRef.current >= 2) {
      // twice on the same stroke: show it again instead of letting it fail on
      strokeMissRef.current = 0
      narrate([{ text: 'Schau, so geht es.' }])
      startDemo(strokeIdx, () => { setMood('idle'); narrate([{ text: 'Jetzt du! Fang beim grünen Punkt an.' }]) })
      return
    }
    sayWrong(kind === 'wrongWay' && guide.arrows === 'none' ? 'Fahre andersherum.' : HINT[kind])
  }

  const onPointerDown = e => {
    if (!canTrace || pointerRef.current != null) return
    const p = toBox(e)
    if (!p) return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    pointerRef.current = e.pointerId
    const t = makeTracer(strokes[strokeIdx])
    tracerRef.current = t
    t.down(p)
    inkRef.current = [p]
    setInk([p])
  }

  const onPointerMove = e => {
    if (e.pointerId !== pointerRef.current || !tracerRef.current) return
    const evs = e.nativeEvent.getCoalescedEvents?.()
    for (const ev of evs?.length ? evs : [e.nativeEvent]) {
      const p = toBox(ev)
      if (!p) continue
      inkRef.current.push(p)
      if (inkRef.current.length % 4 === 0 && !reduceMotion()) {
        const a = Math.random() * Math.PI * 2
        setSparks(l => [...l.slice(-14), { id: ++sparkIds, x: p.x, y: p.y, dx: Math.cos(a) * 9, dy: Math.sin(a) * 9 }])
      }
      const r = tracerRef.current.move(p)
      if (r === 'done') { acceptStroke(); return }
      if (r !== 'ok') { slip(r); return }
    }
    setInk([...inkRef.current])
  }

  const onPointerUp = e => {
    if (e.pointerId !== pointerRef.current) return
    pointerRef.current = null
    const t = tracerRef.current
    if (!t) return
    const r = e.type === 'pointercancel' ? 'tap' : t.up()
    if (r === 'done') acceptStroke()
    else if (r === 'tap') {
      clearInk()
      if (!t.started && e.type !== 'pointercancel') narrate([{ text: HINT.wrongStart }], { skipIfSame: true })
    } else slip(r)
  }

  // On to the next glyph once the praise is over — never while the help is open
  useEffect(() => {
    if (!advance || paused) return
    setAdvance(false)
    next()
  }, [advance, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  const next = () => {
    if (leaving) return
    if (idx + 1 >= glyphs.length) {
      setLeaving(true)
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry, glyphs.length)), { minMs: 300 })
      return
    }
    lockPreviews()
    missedRef.current = false
    strokeMissRef.current = 0
    clearInk()
    setFading([])
    setDone(false)
    setStrokeIdx(0)
    setMood('idle')
    setIdx(i => i + 1)
  }

  const replay = () => (done ? sayRight(praise.say) : sayRound())
  const showMe = () => {
    if (!canTrace) return
    narrate([{ text: 'Schau, so geht es.' }])
    startDemo(strokeIdx)
  }

  // ─── Layout ────────────────────────────────────────────────────────────────
  // a little room for the board's drop shadow
  const scale = Math.max(0, Math.min((area.w - 4) / VIEW.w, (area.h - 8) / VIEW.h))
  const cur = strokes[strokeIdx]
  const arrows = cur && !done ? arrowsOn(cur, guide.arrows) : []
  const demoPart = demo && partOf(strokes[demo.stroke], demo.t)
  const lumiSize = wide ? 96 : 56

  const progress = (
    <RoundTrail total={glyphs.length} done={idx + (done ? 1 : 0)} walker="✏️" goal="⭐" size={wide ? 36 : 32}
      style={{ width: wide ? '82%' : 'auto', maxWidth: 520, alignSelf: wide ? 'center' : 'stretch', flexShrink: 0 }} />
  )

  const shown = isDigit(g)
    ? <><strong style={{ fontSize: '1.3em' }}>{g}</strong> · {praise.show}</>
    : <><strong style={{ fontSize: '1.3em', color }}>{g}</strong>{praise.show.slice(1)}</>

  // digits count their stars here; a letter's picture pops up on the board
  const picture = done && isDigit(g) && (
    <motion.div
      key={'pic-' + idx}
      initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 14, delay: 0.15 }}
      style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 2,
        fontSize: wide ? 30 : 20, lineHeight: 1, maxWidth: wide ? 180 : 110, flexShrink: 0,
      }}
    >
      {'⭐'.repeat(+g)}
    </motion.div>
  )

  const bubble = (
    <div style={{
      flex: wide ? 'none' : 1, minWidth: 0, ...pxBubble,
      borderRadius: wide ? '4px 12px 12px 12px' : '12px 12px 12px 4px',
      padding: wide ? '14px 16px' : '8px 12px',
      fontFamily: 'var(--font-heading)', fontSize: wide ? 'clamp(20px,2.2vw,26px)' : 'clamp(16px,4.4vw,22px)',
      color: INK, display: 'flex', alignItems: 'center', gap: 10, minHeight: wide ? 0 : 56,
      flexDirection: wide && done ? 'column' : 'row', textAlign: wide ? 'center' : 'left',
    }}>
      {done
        ? <>{picture}<span>{shown}</span></>
        : <span>Fahre {isDigit(g) ? 'die' : 'das'} <strong style={{ color, fontSize: '1.3em' }}>{g}</strong> nach!</span>}
    </div>
  )

  const buttons = (
    <>
      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
        onClick={replay} aria-label="Noch einmal anhören" style={ICON_BTN}>🔊</motion.button>
      {!done && (
        <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
          onClick={showMe} disabled={!canTrace}
          {...hearable('Zeig es mir')}
          aria-label="Zeig es mir" style={{ ...ICON_BTN, opacity: canTrace ? 1 : 0.5 }}>👆</motion.button>
      )}
    </>
  )

  const board = (
    <div ref={areaRef}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove}
      onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
      style={{
        flex: 1, minHeight: 0, minWidth: 0, width: '100%', position: 'relative',
        // side by side, the board is only as wide as its height allows, and
        // both columns stand together in the middle
        maxWidth: wide ? Math.ceil((root.h * VIEW.w) / VIEW.h) : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none',
        cursor: canTrace ? 'crosshair' : 'default',
      }}>
      {scale > 0 && (
        <svg ref={svgRef}
          viewBox={`${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`}
          width={VIEW.w * scale} height={VIEW.h * scale}
          role="img" aria-label={`${isDigit(g) ? 'Ziffer' : 'Buchstabe'} ${g} zum Nachfahren`}
          style={{ display: 'block', overflow: 'visible', touchAction: 'none', ...pxPanel, boxSizing: 'border-box' }}
        >
          {/* The road: every stroke of the glyph, the current one lit up */}
          <g opacity={guide.road} fill="none" strokeLinecap="round" strokeLinejoin="round">
            {strokes.map((s, i) => <path key={'b' + i} d={pathOf(s)} stroke="rgba(42,27,61,0.32)" strokeWidth={ROAD + 4} />)}
            {strokes.map((s, i) => (
              <path key={'r' + i} d={pathOf(s)} strokeWidth={ROAD}
                stroke={i === strokeIdx && !done && guide.road === 1 ? '#FFF0B8' : '#FFFDF7'} />
            ))}
          </g>

          {/* Marching dots along the current stroke show which way it goes */}
          {cur && !done && guide.arrows === 'all' && (
            <motion.path key={`m${idx}-${strokeIdx}`} d={pathOf(cur)} fill="none"
              stroke="rgba(42,27,61,0.35)" strokeWidth={2.6} strokeLinecap="round" strokeDasharray="0.1 7"
              animate={{ strokeDashoffset: [0, -7.1] }}
              transition={{ duration: 0.7, repeat: Infinity, ease: 'linear' }} />
          )}

          {/* Finished strokes, snapped onto the path. The finished glyph
              comes alive: it gets eyes and a smile and hops. */}
          <motion.g key={`g${idx}`} animate={done && !reduceMotion() ? { y: [0, -16, 0, -8, 0], scaleY: [1, 1.06, 0.94, 1.02, 1] } : { y: 0 }}
            transition={{ duration: 1.1, delay: 0.35 }} style={{ transformBox: 'fill-box', transformOrigin: '50% 100%' }}>
            {strokes.slice(0, strokeIdx).map((s, i) => (
              <motion.path key={`d${idx}-${i}`} d={pathOf(s)} fill="none" stroke={color}
                strokeWidth={INK_W} strokeLinecap="round" strokeLinejoin="round"
                initial={{ opacity: 0.5 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }} />
            ))}
            {done && (
              <motion.g initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 12, delay: 0.15 }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }} pointerEvents="none">
                <g className="pl-blink">
                  {[-9, 9].map(dx => (
                    <g key={dx}>
                      <circle cx={face.x + dx} cy={face.y} r={7.5} fill="#fff" stroke={INK} strokeWidth={2.2} />
                      <circle cx={face.x + dx + 1.5} cy={face.y + 1} r={3.6} fill={INK} />
                      <circle cx={face.x + dx + 2.6} cy={face.y - 0.4} r={1.2} fill="#fff" />
                    </g>
                  ))}
                </g>
                <path d={`M${face.x - 7} ${face.y + 12} Q${face.x} ${face.y + 20} ${face.x + 7} ${face.y + 12}`}
                  fill="none" stroke={INK} strokeWidth={2.6} strokeLinecap="round" />
              </motion.g>
            )}
          </motion.g>

          {/* Direction arrows on the current stroke */}
          {arrows.map((a, i) => (
            <g key={`a${idx}-${strokeIdx}-${i}`} transform={`translate(${a.x} ${a.y}) rotate(${(a.angle * 180) / Math.PI})`}>
              <path d="M-4.5 -5.5 L2.5 0 L-4.5 5.5" fill="none" stroke={INK} strokeWidth={3}
                strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
            </g>
          ))}

          {/* Slipped attempts fade away — no red, no cross */}
          {fading.map(f => (
            <motion.path key={f.id} d={pathOf(f.pts)} fill="none" stroke={color}
              strokeWidth={INK_W} strokeLinecap="round" strokeLinejoin="round"
              initial={{ opacity: 0.6 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }}
              onAnimationComplete={() => setFading(list => list.filter(x => x.id !== f.id))} />
          ))}

          {/* The finger's ink, with a glow and a trail of sparkles */}
          {ink.length > 1 && (
            <>
              <path d={pathOf(ink)} fill="none" stroke="#ffd34d" strokeOpacity={0.55} strokeWidth={INK_W + 8}
                strokeLinecap="round" strokeLinejoin="round" />
              <path d={pathOf(ink)} fill="none" stroke={color} strokeWidth={INK_W}
                strokeLinecap="round" strokeLinejoin="round" />
            </>
          )}
          {sparks.map(sp => (
            <motion.path key={sp.id} d={SPARK} fill="#ffd34d" stroke={INK} strokeWidth={0.7} pointerEvents="none"
              initial={{ x: sp.x, y: sp.y, scale: 0.4, opacity: 1, rotate: 0 }}
              animate={{ x: sp.x + sp.dx, y: sp.y + sp.dy, scale: [0.4, 1.4, 0], opacity: [1, 1, 0], rotate: 120 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              onAnimationComplete={() => setSparks(l => l.filter(x => x.id !== sp.id))} />
          ))}
          {ink.length === 1 && <circle cx={ink[0].x} cy={ink[0].y} r={INK_W / 2} fill={color} />}

          {/* Start dot of the current stroke, with its number */}
          {cur && !done && (
            <g key={`s${idx}-${strokeIdx}`} pointerEvents="none">
              {!demo && (
                <motion.circle cx={cur[0].x} cy={cur[0].y} fill="none" stroke="var(--px-green)" strokeWidth={3}
                  initial={{ r: 9, opacity: 0.9 }} animate={{ r: [9, 17], opacity: [0.9, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }} />
              )}
              <motion.circle cx={cur[0].x} cy={cur[0].y} r={9} fill="var(--px-green)" stroke={INK} strokeWidth={2.2}
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                style={{ transformBox: 'fill-box', transformOrigin: 'center' }} />
              <text x={cur[0].x} y={cur[0].y + 0.4} textAnchor="middle" dominantBaseline="central"
                fontFamily="var(--font-heading)" fontWeight={800} fontSize={11} fill={INK}>{strokeIdx + 1}</text>
            </g>
          )}

          {/* Lumi's demo finger */}
          {demoPart && (
            <g pointerEvents="none">
              <path d={demoPart.d} fill="none" stroke={color} strokeWidth={INK_W} opacity={0.75}
                strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={demoPart.tip.x} cy={demoPart.tip.y} r={6.5} fill="#fff" stroke={INK} strokeWidth={2} />
              {HAND && <image href={HAND} x={demoPart.tip.x - 10} y={demoPart.tip.y + 1} width={20} height={20} />}
            </g>
          )}
        </svg>
      )}

      {/* The letter's picture pops up beside it: "M wie Maus" */}
      {done && !isDigit(g) && (
        <motion.div key={'thing' + idx} aria-hidden="true"
          initial={{ scale: 0, y: 30, rotate: -20 }}
          animate={{ scale: 1, y: reduceMotion() ? 0 : [30, -24, 0, -10, 0], rotate: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.5, y: { duration: 1, delay: 0.5 } }}
          style={{ position: 'absolute', right: '2%', bottom: '2%', pointerEvents: 'none', filter: 'drop-shadow(0 6px 0 rgba(42,27,61,0.25))' }}>
          <Art art={praise.e} size={Math.max(64, Math.min(area.w, area.h) * 0.3)} />
        </motion.div>
      )}

      {/* Sparkles when the glyph is done */}
      <AnimatePresence>
        {done && (
          <div key={'burst' + idx} style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none' }}>
            {Array.from({ length: 12 }, (_, i) => {
              const a = (i / 12) * Math.PI * 2 + 0.3
              const r = Math.min(area.w, area.h) * (0.32 + (i % 3) * 0.06)
              return (
                <motion.span key={i}
                  initial={{ x: 0, y: 0, scale: 0.3, opacity: 1 }}
                  animate={{ x: Math.cos(a) * r, y: Math.sin(a) * r, scale: [0.3, 1.3, 0.9], opacity: [1, 1, 0] }}
                  transition={{ duration: 1.1, ease: 'easeOut', delay: (i % 4) * 0.04 }}
                  style={{ position: 'absolute', left: -18, top: -18, width: 36, height: 36, fontSize: 32, lineHeight: '36px', textAlign: 'center' }}
                >{i % 3 === 0 ? '⭐' : i % 3 === 1 ? '✨' : '🌟'}</motion.span>
              )
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  )

  return (
    // positioned, so it paints above the scene behind it (GameScreen does not
    // wrap NO_SCALE games in a positioned box)
    <div ref={rootRef} style={{
      position: 'relative', flex: 1, minHeight: 0, width: '100%', boxSizing: 'border-box', overflow: 'hidden',
      display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'stretch', justifyContent: 'center',
      padding: wide ? 'clamp(12px,2vw,24px)' : '10px 12px 12px', gap: wide ? 'clamp(14px,2.5vw,32px)' : 10,
    }}>
      {wide ? (
        <div style={{
          width: 'clamp(230px,27vw,340px)', flexShrink: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: 16,
        }}>
          {progress}
          <Critter art="lumi" mood={mood} size={lumiSize} talks />
          {bubble}
          <div style={{ display: 'flex', gap: 12 }}>{buttons}</div>
        </div>
      ) : (
        <>
          {progress}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, width: '100%' }}>
            <Critter art="lumi" mood={mood} size={lumiSize} talks />
            {bubble}
          </div>
        </>
      )}

      {board}

      {!wide && (
        <div style={{ minHeight: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
          {buttons}
        </div>
      )}
    </div>
  )
}
