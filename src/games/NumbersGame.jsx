import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { lockPreviews, leaveGame, narrate, preloadVoice } from '../narrator.js'
import { LINES, line } from '../lib/lumiLines.js'
import { numberWord } from '../lib/words.js'
import { sayRight, announce } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Art, useBursts, HintHand } from '../components/play/index.js'
import { useLater } from './sternbilder/useLater.js'
import { roundsFor, pickOutlines, fitOutline, minGap, skyInset, pictureWord } from './sternbilder/outlines.js'

/**
 * Zahlenland — "Sternbilder": connect the dots in the night sky
 *
 * Numbered stars hide a picture. Lumi sits beside the first one; the child
 * taps the stars in order, or draws a finger through them, and a glowing
 * line follows from star to star. Every star says its number when it is
 * reached (once: Lumi does not call out the first number beforehand) and
 * rings one note higher, so a clean run is a little melody. With the last star the line
 * closes, the constellation lights up, the real picture fades in on exactly
 * that line, hops, and flies into the album at the top. Then the next one.
 *
 * What is learned is the order of the numbers: counting on (1–5 … 1–20),
 * counting back (the rocket countdown of level 8: 10, 9, … 1, lift-off),
 * and counting in steps of two and five (levels 9 and 10).
 *
 * A wrong star wobbles with a dull sound and the line stays where it was;
 * after two misses the right star pulses. A picture counts as solved on the
 * first try when no wrong star was touched. In the first three levels the
 * picture shows through as a faint ghost, so the goal is plain to see.
 *
 * The outlines, the levels and the fitting into the sky: sternbilder/outlines.js
 */

const INK = '#2a1b3d'
const GOLD = '#ffd34d'

// Lumi's one sentence when a new way of counting begins; silent until recorded
const KIND_LINE = {
  up: 'sternbilder/der-reihe-nach', back: 'sternbilder/rueckwaerts',
  twos: 'sternbilder/zweier', fives: 'sternbilder/fuenfer',
}
const optional = key => (LINES[key] ? line(key) : null)

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// how far point p is from the line between a and b
function distToLine(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1)
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}

/**
 * Where the hint hand points for a star: at its lower rim, not its middle.
 * The hand is a picture of a finger pointing up, drawn below its fingertip;
 * with the fingertip in the middle of a star it covered the very number it
 * was showing. (The hand settles on a 24 px grid, so the aim is the middle
 * of the band between "just clear of the digit" and "just below the star".)
 */
const underStar = ref => ({
  getBoundingClientRect() {
    const r = ref.current?.getBoundingClientRect()
    if (!r || (!r.width && !r.height)) return { left: 0, top: 0, width: 0, height: 0 }
    return { left: r.left + r.width / 2 - 1, top: r.top + r.height * 0.7 + 18 - 1, width: 2, height: 2 }
  },
})

export default function NumbersGame(props) {
  // a fresh sky for every level
  return <Sternbilder key={props.level} {...props} />
}

function Sternbilder({ level = 1, onComplete }) {
  const rounds = useMemo(() => roundsFor(level), [level])
  const paused = usePaused()
  const reduce = useReducedMotion()
  const { later, afterSpeech } = useLater()
  const [bursts, burst] = useBursts()

  // On a phone held sideways the album stands at the side: the sky needs
  // every pixel of the little height there is.
  const [side, setSide] = useState(() => innerHeight < 520 && innerWidth > innerHeight)
  useEffect(() => {
    const on = () => setSide(innerHeight < 520 && innerWidth > innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  const skyRef = useRef(null)
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const el = skyRef.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setSize(s => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The pictures of this level, chosen once the sky is measured: those
  // whose stars have room in it.
  const [outlines, setOutlines] = useState(null)
  useEffect(() => {
    if (!size || outlines) return
    const inset = skyInset(size.w, size.h)
    setOutlines(pickOutlines(level, size.w - 2 * inset, size.h - 2 * inset))
  }, [size, outlines, level])

  const [round,   setRound]   = useState(0)
  const [reached, setReached] = useState(0)      // stars connected so far
  const [phase,   setPhase]   = useState('play') // play → closing → lit → reveal → fly | launch … finale
  const [help,    setHelp]    = useState(false)  // two misses: the right star pulses strongly
  const [wobble,  setWobble]  = useState(null)   // the wrong star that was touched
  const [album,   setAlbum]   = useState([])     // finished pictures
  const [flight,  setFlight]  = useState(null)   // the way into the album
  const [shoot,   setShoot]   = useState(0)      // shooting stars so far
  const [drawing, setDrawing] = useState(false)  // a finger is down
  const missRef = useRef(0), cleanRef = useRef(true), firstTryRef = useRef(0), doneRef = useRef(false)
  const lastWrongRef = useRef(-1), downRef = useRef(false)
  const starEls = useRef([]), slotEls = useRef([]), rubberRef = useRef(null)
  const handFrom = useRef(null), handTo = useRef(null)
  const handFromAt = useMemo(() => underStar(handFrom), []), handToAt = useMemo(() => underStar(handTo), [])

  const rd = rounds[round]
  const o = outlines?.[round]

  // Where everything is, in px of the sky
  const lay = useMemo(() => {
    if (!size || !o) return null
    const inset = skyInset(size.w, size.h)
    const f = fitOutline(o, size.w - 2 * inset, size.h - 2 * inset)
    const P = o.pts.map(([x, y]) => ({ x: inset + f.ox + x * f.scale, y: inset + f.oy + y * f.scale }))
    const gap = minGap(o) * f.scale
    const d = Math.round(clamp(gap * 0.84, 34, inset < 30 ? 58 : 68))
    const mid = { x: P.reduce((a, p) => a + p.x, 0) / P.length, y: P.reduce((a, p) => a + p.y, 0) / P.length }
    // Lumi's seat at every star: beside it, where no number is covered —
    // on the outer side of the picture if there is room, else wherever
    // the other stars and the edge of the sky leave the most. Never on the
    // way to the next star (that is where the finger goes and the line is
    // drawn), rather not on a line that is drawn already, and rather not
    // right under the star, where the hint hand comes up.
    const lumi = Math.round(clamp(d * 0.95, 40, 60))
    const n = P.length
    const seats = P.map((p, i) => {
      const reach = d / 2 + lumi * 0.44
      const out = Math.atan2(p.y - mid.y, p.x - mid.x)
      let best = null
      for (let k = 0; k < 12; k++) {
        const turn = k <= 6 ? k : k - 12 // 0, ±30°, ±60° … away from the outer side
        const a = out + (turn * Math.PI) / 6
        const x = p.x + Math.cos(a) * reach, y = p.y + Math.sin(a) * reach
        const inside = x >= lumi / 2 && x <= size.w - lumi / 2 && y >= lumi / 2 && y <= size.h - lumi / 2
        let room = Infinity, lines = Infinity
        P.forEach((q, j) => {
          if (j !== i) room = Math.min(room, Math.hypot(q.x - x, q.y - y))
          if (j !== i) lines = Math.min(lines, distToLine({ x, y }, q, P[(j + 1) % n]))
        })
        const next = distToLine({ x, y }, p, P[(i + 1) % n])
        const hand = Math.hypot(x - (p.x + 16), y - (p.y + d * 0.2 + 42)) < lumi * 0.5 + 24
        const score = (inside ? 0 : -1000) + Math.min(room, d / 2 + lumi / 2 + 6) - Math.abs(turn) * 2
          - Math.max(0, lumi * 0.5 + 8 - next) * 3 - Math.max(0, lumi * 0.4 - lines) - (hand ? 10 : 0)
        if (!best || score > best.score) best = { x, y, score }
      }
      return best
    })
    // How far the rings of a calling star may spread: to the edge of the
    // sky and no further. A star near the edge sent its rings under the top
    // bar and off the screen, where they were cut off.
    const ring = P.map(p => (Math.min(p.x, p.y, size.w - p.x, size.h - p.y) + 4) / (d / 2))
    return { P, gap, d, mid, lumi, seats, ring, img: { left: inset + f.ox, top: inset + f.oy, size: 100 * f.scale } }
  }, [size, o])

  // what the pointer handlers and the timers need, always current
  const live = useRef({})
  Object.assign(live.current, { phase, paused, lay, reached })

  useEffect(() => leaveGame, [])
  useEffect(() => { preloadVoice([...new Set(rounds.flatMap(r => r.numbers))].map(n => numberWord(n)?.src)) }, [rounds])

  // A new picture: once per way of counting Lumi says what is new. The
  // first number is not called out here: its star pulses, and it says its
  // number when it is touched, like every other star ("Eins." came twice
  // at every picture: once now and once on the tap).
  useEffect(() => {
    if (!outlines) return
    lockPreviews()
    const r = rounds[round]
    const fresh = round === 0 || rounds[round - 1].kind !== r.kind
    narrate([fresh ? optional(KIND_LINE[r.kind]) : null])
  }, [outlines, round, rounds])

  // The hand shows the move when the child waits: a tap on the first star,
  // then a stroke from the last star to the next
  useEffect(() => {
    handFrom.current = reached > 0 ? starEls.current[reached - 1] : null
    handTo.current = starEls.current[reached] ?? null
  })

  const center = () => {
    const r = skyRef.current.getBoundingClientRect()
    return { x: r.left + lay.mid.x, y: r.top + lay.mid.y }
  }

  // ── A picture is finished ──────────────────────────────────────────────
  const next = () => {
    if (round + 1 < rounds.length) {
      cleanRef.current = true
      missRef.current = 0
      live.current.reached = 0
      setReached(0); setHelp(false); setFlight(null); setWobble(null)
      setRound(round + 1)
      setPhase('play')
      return
    }
    // the whole album twinkles, picture by picture, a note each
    setPhase('finale')
    sfx.tada()
    rounds.forEach((_, i) => later(350 + i * 240, () => { sfx.note(i * 2); burst(slotEls.current[i], 'stars', 8) }))
    later(900, () => setShoot(s => s + 1))
    later(350 + rounds.length * 240 + 1500, () => {
      if (doneRef.current) return
      doneRef.current = true
      onComplete(result(firstTryRef.current, rounds.length))
    })
  }

  const land = () => {
    setAlbum(a => [...a, o])
    sfx.coin()
    burst(slotEls.current[round], 'stars', 8)
    later(600, next)
  }

  const leave = () => {
    if (rd.launch && !reduce) {
      // countdown over: lift-off
      setPhase('launch')
      sfx.whoosh()
      later(300, () => sfx.slideUp())
      later(1300, land)
      return
    }
    const slot = slotEls.current[round]?.getBoundingClientRect()
    const sky = skyRef.current.getBoundingClientRect()
    if (slot) {
      const cx = sky.left + lay.img.left + lay.img.size / 2, cy = sky.top + lay.img.top + lay.img.size / 2
      setFlight({ dx: slot.left + slot.width / 2 - cx, dy: slot.top + slot.height / 2 - cy, s: (slot.width * 0.9) / lay.img.size })
    }
    setPhase('fly')
    later(reduce ? 120 : 640, land)
  }

  const finish = () => {
    if (cleanRef.current) firstTryRef.current += 1
    setPhase('closing')
    later(reduce ? 60 : 480, () => {
      setPhase('lit')
      sfx.sparkle()
      later(reduce ? 60 : 620, () => {
        setPhase('reveal')
        sfx.tada()
        burst(center(), 'confetti', 18)
        // a clean run: a shooting star crosses the sky
        if (cleanRef.current) later(250, () => { setShoot(s => s + 1); sfx.slideUp() })
        // praise now and then, the picture's name, and off into the album
        afterSpeech(() => {
          sayRight()
          afterSpeech(() => {
            narrate([pictureWord(o)])
            afterSpeech(leave, 1500)
          })
        }, 200)
      })
    })
  }

  // ── Stars ──────────────────────────────────────────────────────────────
  const hit = i => {
    const L = live.current
    if (L.phase !== 'play' || L.paused || i !== L.reached) return
    const n = rd.numbers.length
    L.reached = i + 1 // at once: a quick stroke must not take a star twice
    missRef.current = 0
    lastWrongRef.current = -1
    setReached(i + 1)
    setHelp(false)
    // one note higher with every star; falling when counting back
    sfx.note((n > 12 ? -4 : 0) + (rd.kind === 'back' ? n - 1 - i : i))
    narrate([numberWord(rd.numbers[i])])
    const r = skyRef.current.getBoundingClientRect()
    burst({ x: r.left + lay.P[i].x, y: r.top + lay.P[i].y }, 'stars', 4)
    if (i + 1 === n) { L.phase = 'closing'; finish() }
  }

  const miss = i => {
    const L = live.current
    if (L.phase !== 'play' || L.paused) return
    cleanRef.current = false
    missRef.current += 1
    lastWrongRef.current = i
    sfx.mismatch()
    announce('wrong')
    const k = Date.now()
    setWobble({ i, k })
    later(650, () => setWobble(w => (w?.k === k ? null : w)))
    if (missRef.current >= 2) setHelp(true)
  }

  const at = e => {
    const r = skyRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  // the nearest star that is still to come after the next one
  const nearestWrong = p => {
    const L = live.current
    let best = -1, bd = Infinity
    L.lay.P.forEach((q, i) => { if (i > L.reached) { const dd = dist(p, q); if (dd < bd) { bd = dd; best = i } } })
    return { i: best, d: bd }
  }
  // the line from the last star to the finger
  const rubber = p => {
    const el = rubberRef.current, L = live.current
    if (!el) return
    const from = p && L.phase === 'play' && L.reached > 0 ? L.lay.P[L.reached - 1] : null
    if (!from) { el.style.display = 'none'; return }
    el.setAttribute('x1', from.x); el.setAttribute('y1', from.y)
    el.setAttribute('x2', p.x); el.setAttribute('y2', p.y)
    el.style.display = ''
  }

  const onDown = e => {
    const L = live.current
    if (L.phase !== 'play' || L.paused || !L.lay || e.button > 0) return
    downRef.current = true
    setDrawing(true)
    try { skyRef.current.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    const p = at(e)
    // generous around the right star, so a near miss is no miss
    const reach = Math.max(L.lay.d / 2 + 12, 32)
    if (dist(p, L.lay.P[L.reached]) <= reach) { hit(L.reached); return }
    const w = nearestWrong(p)
    if (w.i >= 0 && w.d <= Math.min(reach, L.lay.gap * 0.5)) miss(w.i)
    rubber(p)
  }
  const onMove = e => {
    const L = live.current
    if (!downRef.current || L.phase !== 'play' || L.paused || !L.lay) return
    const p = at(e)
    const want = L.lay.P[L.reached]
    if (want && dist(p, want) <= L.lay.d / 2 + 4) { hit(L.reached); rubber(p); return }
    rubber(p)
    // a stroke through the middle of a wrong star is a miss, once per star;
    // brushing past one on the way is not
    const core = L.lay.d * 0.3
    const w = nearestWrong(p)
    if (w.i >= 0 && w.d <= core) { if (lastWrongRef.current !== w.i) miss(w.i) }
    else if (w.d > core * 1.7) lastWrongRef.current = -1
  }
  const onUp = () => {
    downRef.current = false
    lastWrongRef.current = -1
    setDrawing(false)
    rubber(null)
  }
  // keyboard and switch access: Enter on a star
  const onKeyStar = i => {
    const L = live.current
    if (i === L.reached) hit(i)
    else if (i > L.reached) miss(i)
  }

  // ── Looks ──────────────────────────────────────────────────────────────
  const n = rd.numbers.length
  const d = lay?.d ?? 52
  const playing = phase === 'play'
  const shown = phase === 'play' || phase === 'closing' || phase === 'lit'   // stars and line
  const closed = phase !== 'play'
  // Lumi sits beside the star reached last (beside the first one to begin with)
  const lumiSize = lay?.lumi ?? 50
  const lumiAt = lay?.seats[Math.max(0, reached - 1)] ?? { x: 0, y: 0 }
  // the way a finished picture takes off: a rocket along its nose, the rest straight up
  const away = (() => {
    if (!o || !size) return { x: 0, y: -600 }
    const a = ((o.pic === 'rocket' ? o.rot + 45 : 0) * Math.PI) / 180
    const far = Math.max(size.w, size.h) + (lay?.img.size ?? 300)
    return { x: Math.sin(a) * far, y: -Math.cos(a) * far }
  })()

  const twinkles = useMemo(() => Array.from({ length: 18 }, (_, i) => ({
    left: `${(i * 61 + 13) % 97 + 1}%`, top: `${(i * 37 + 29) % 93 + 3}%`, s: 2 + (i % 3), delay: -(i % 7) * 0.4,
  })), [])

  const slot = side ? 46 : 54
  const albumRow = (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={rounds.length} aria-valuenow={album.length}
      aria-label={`${album.length} von ${rounds.length} Bildern`}
      style={{
        flexShrink: 0, alignSelf: 'center', display: 'flex', flexDirection: side ? 'column' : 'row', gap: side ? 6 : 8,
        padding: 6, borderRadius: 18, background: 'rgba(16,10,52,0.55)', border: '2px solid rgba(255,255,255,0.28)',
      }}>
      {rounds.map((_, i) => {
        const got = album[i]
        return (
          <motion.div key={i} ref={el => { slotEls.current[i] = el }}
            animate={phase === 'finale' && !reduce ? { y: [0, -8, 0], scale: [1, 1.15, 1] } : { y: 0, scale: 1 }}
            transition={phase === 'finale' ? { duration: 0.6, delay: 0.35 + i * 0.24, repeat: 2, repeatDelay: 0.5 } : { duration: 0.2 }}
            style={{
              width: slot, height: slot, borderRadius: 12, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: got ? `2px solid ${GOLD}` : i === round ? '2px dashed rgba(255,226,122,0.9)' : '2px dashed rgba(255,255,255,0.3)',
              background: got ? 'rgba(255,226,122,0.16)' : 'transparent',
            }}>
            {got
              ? <motion.div initial={reduce ? false : { scale: 0.3 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 420, damping: 14 }} style={{ display: 'flex' }}>
                  <Art art={got.art} alt={got.name} size={slot - 12} style={{ transform: `rotate(${got.rot}deg)` }} />
                </motion.div>
              : <svg viewBox="0 0 24 24" width={slot * 0.36} height={slot * 0.36} aria-hidden="true" style={{ opacity: i === round ? 0.75 : 0.3 }}>
                  <path d="M12 1.5l3.1 6.6 7.2.9-5.3 5 1.4 7.1L12 17.6l-6.4 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="#fff3b0" />
                </svg>}
          </motion.div>
        )
      })}
    </div>
  )

  return (
    <div data-phase={phase} data-round={round}
      style={{
        position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: side ? 'row' : 'column', gap: 6,
        padding: side ? '6px 8px' : '8px 8px 6px', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
        // a little deeper night towards the top, so the stars stand out
        background: 'linear-gradient(rgba(10,6,40,0.5), rgba(10,6,40,0.12) 75%, rgba(10,6,40,0))',
      }}>
      {albumRow}

      <div ref={skyRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, touchAction: 'none', cursor: playing ? 'pointer' : 'default' }}>

        {/* far little stars: no numbers, small and dim */}
        {twinkles.map((t, i) => (
          <span key={i} aria-hidden="true" className="pl-twinkle" style={{
            position: 'absolute', left: t.left, top: t.top, width: t.s, height: t.s, borderRadius: '50%', background: '#fff', opacity: 0.5,
            animationDelay: `${t.delay}s`, animationName: reduce ? 'none' : undefined, pointerEvents: 'none',
          }} />
        ))}

        {lay && (
          <>
            {/* the picture shows through, in the first levels */}
            {rd.ghost > 0 && (
              <motion.div aria-hidden="true" key={`ghost-${round}`} initial={{ opacity: 0 }} animate={{ opacity: shown ? rd.ghost : 0 }} transition={{ duration: 0.5 }}
                style={{ position: 'absolute', left: lay.img.left, top: lay.img.top, width: lay.img.size, height: lay.img.size, pointerEvents: 'none', filter: 'brightness(0) invert(1)' }}>
                <Art art={o.art} size={lay.img.size} style={{ transform: `rotate(${o.rot}deg)` }} />
              </motion.div>
            )}

            {/* the glowing line */}
            <motion.svg aria-hidden="true" key={`line-${round}`} width={size.w} height={size.h}
              animate={{ opacity: shown ? 1 : 0 }} transition={{ duration: 0.5 }}
              style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
              {closed && (
                <motion.polygon points={lay.P.map(p => `${p.x},${p.y}`).join(' ')} fill="#fff3b0"
                  initial={{ opacity: 0 }} animate={{ opacity: phase === 'lit' ? 0.3 : 0 }} transition={{ duration: 0.4 }} />
              )}
              {lay.P.map((p, i) => {
                const q = lay.P[(i + 1) % n]
                // star i to star i+1; the last one closes the picture
                const on = i + 1 < n ? reached > i + 1 : closed
                if (!on) return null
                return (
                  <g key={i}>
                    <motion.line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="rgba(255,226,122,0.4)" strokeWidth={Math.max(8, d * 0.2)} strokeLinecap="round"
                      initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.26, ease: 'easeOut' }} />
                    <motion.line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#fffbe6" strokeWidth={Math.max(3.5, d * 0.08)} strokeLinecap="round"
                      initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.26, ease: 'easeOut' }} />
                  </g>
                )
              })}
              <line ref={rubberRef} stroke="#fffbe6" strokeWidth={3} strokeLinecap="round" strokeDasharray="2 9" opacity={0.75} style={{ display: 'none' }} />
            </motion.svg>

            {/* the numbered stars */}
            <motion.div key={`stars-${round}`} animate={{ opacity: shown ? 1 : 0 }} transition={{ duration: 0.45 }}
              style={{ position: 'absolute', inset: 0, pointerEvents: shown ? undefined : 'none' }}>
              {lay.P.map((p, i) => {
                const state = i < reached ? 'done' : i === reached ? 'next' : 'todo'
                const beacon = playing && state === 'next' && (reached === 0 || help)
                const wrong = wobble?.i === i
                const value = rd.numbers[i]
                // the rings and the glow stay inside the sky
                const far = Math.max(1, Math.min(help ? 2.5 : 2, lay.ring[i]))
                const glow = help ? [Math.min(1.1, far), Math.min(1.55, far)] : [Math.min(1.05, far), Math.min(1.3, far)]
                return (
                  <motion.div key={i} initial={reduce ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.055, type: 'spring', stiffness: 380, damping: 17 }}
                    style={{ position: 'absolute', left: p.x - d / 2, top: p.y - d / 2, width: d, height: d, zIndex: state === 'next' ? 2 : 1 }}>
                    {/* the star to begin with, and the right one after two misses, send out rings */}
                    {beacon && (reduce
                      ? <span aria-hidden="true" style={{ position: 'absolute', inset: -9, borderRadius: '50%', border: `4px solid ${GOLD}` }} />
                      : [0, 1, 2].map(k => k === 2
                        ? <motion.span key={k} aria-hidden="true" animate={{ scale: [glow[0], glow[1], glow[0]], opacity: [0.55, 0.25, 0.55] }}
                            transition={{ duration: help ? 0.7 : 1.2, repeat: Infinity }}
                            style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: GOLD, pointerEvents: 'none' }} />
                        : (
                          <motion.span key={k} aria-hidden="true"
                            initial={{ scale: 1, opacity: 0.9 }} animate={{ scale: far, opacity: 0 }}
                            transition={{ duration: help ? 1 : 1.5, repeat: Infinity, delay: k * (help ? 0.5 : 0.75), ease: 'easeOut' }}
                            style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: `${help ? 5 : 4}px solid ${GOLD}`, pointerEvents: 'none' }} />
                        )))}
                    <motion.button type="button" ref={el => { starEls.current[i] = el }}
                      aria-label={`Stern ${value}`} data-star={state} data-value={value}
                      onClick={e => { if (e.detail === 0) onKeyStar(i) }}
                      animate={reduce ? {}
                        : wrong ? { rotate: [0, -16, 13, -9, 6, 0], x: [0, -6, 6, -4, 3, 0], scale: 1 }
                        : phase === 'lit' ? { scale: [1, 1.25, 1], rotate: 0, x: 0 }
                        : { scale: 1, rotate: 0, x: 0 }}
                      transition={{ duration: wrong ? 0.5 : 0.4 }}
                      style={{
                        all: 'unset', boxSizing: 'border-box', position: 'absolute', inset: 0, borderRadius: '50%', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', WebkitTapHighlightColor: 'transparent',
                        fontFamily: 'var(--font-heading)', fontWeight: 800, lineHeight: 1,
                        fontSize: Math.round(d * (value > 9 ? 0.47 : 0.56)), color: INK,
                        background: wrong ? 'radial-gradient(circle at 35% 30%, #ffe1dc, #ff8a7a)'
                          : state === 'done' ? 'radial-gradient(circle at 35% 30%, #fff3b0, #ffb72e)'
                          : 'radial-gradient(circle at 35% 30%, #ffffff, #ffe9a3)',
                        border: `3px solid ${state === 'done' ? '#fff3b0' : '#ffffff'}`,
                        boxShadow: state === 'done' ? '0 0 16px 6px rgba(255,190,60,0.75)' : '0 0 12px 4px rgba(255,240,180,0.55)',
                        // until the first star is found the others step back
                        opacity: playing && reached === 0 && state === 'todo' ? 0.8 : 1,
                        transition: 'opacity .3s, background .2s, box-shadow .2s',
                      }}>
                      {/* the number itself beats, the star holds still under the finger */}
                      {beacon && !reduce
                        ? <motion.span animate={{ scale: help ? [1, 1.35, 1] : [1, 1.18, 1] }} transition={{ duration: help ? 0.7 : 1.2, repeat: Infinity }}>{value}</motion.span>
                        : value}
                    </motion.button>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Lumi hops along from star to star */}
            <motion.div aria-hidden="true" initial={false}
              animate={{ x: lumiAt.x - lumiSize / 2, y: lumiAt.y - lumiSize / 2, opacity: phase === 'finale' || phase === 'launch' || phase === 'fly' ? 0 : 1 }}
              transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 240, damping: 26 }}
              style={{ position: 'absolute', left: 0, top: 0, width: lumiSize, height: lumiSize, zIndex: 4, pointerEvents: 'none' }}>
              <motion.div key={`${round}-${reached}-${phase === 'reveal'}`}
                animate={reduce ? {} : phase === 'reveal' ? { y: [0, -lumiSize * 0.5, 0, -lumiSize * 0.3, 0] } : { y: [0, -lumiSize * 0.32, 0] }}
                transition={{ duration: phase === 'reveal' ? 0.9 : 0.34 }}>
                <Art art="lumi" mood={wobble ? 'oops' : reached > 0 ? 'happy' : 'idle'} size={lumiSize} />
              </motion.div>
            </motion.div>

            {/* the real picture, on exactly the line that was drawn */}
            <motion.div aria-hidden="true" key={`pic-${round}`} initial={{ opacity: 0, scale: 0.94 }}
              animate={
                phase === 'reveal' ? (reduce ? { opacity: 1, scale: 1 } : { opacity: 1, scale: [0.94, 1.07, 1], y: [0, -lay.img.size * 0.07, 0, -lay.img.size * 0.03, 0], rotate: [0, -4, 4, -2, 0] })
                : phase === 'launch' ? { opacity: 1, scale: 1, rotate: 0, x: [0, -4, 4, -4, 4, 0, away.x], y: [0, 3, -3, 3, -3, 0, away.y] }
                : phase === 'fly' && flight ? { opacity: [1, 1, 0], scale: flight.s, x: flight.dx, y: flight.dy, rotate: 0 }
                : phase === 'fly' ? { opacity: 0 }
                : { opacity: 0, scale: 0.94 }
              }
              transition={
                phase === 'reveal' ? { duration: 0.9, opacity: { duration: 0.5 } }
                : phase === 'launch' ? { duration: 1.25, times: [0, 0.08, 0.16, 0.24, 0.32, 0.4, 1], ease: 'easeIn' }
                : phase === 'fly' ? { duration: reduce ? 0.1 : 0.62, ease: 'easeInOut', opacity: { duration: reduce ? 0.1 : 0.62, times: [0, 0.85, 1] } }
                : { duration: 0.2 }
              }
              style={{ position: 'absolute', left: lay.img.left, top: lay.img.top, width: lay.img.size, height: lay.img.size, zIndex: 5, pointerEvents: 'none' }}>
              <Art art={o.art} size={lay.img.size} style={{ transform: `rotate(${o.rot}deg)` }} />
            </motion.div>
          </>
        )}

        {/* a shooting star for a clean picture */}
        {shoot > 0 && !reduce && size && (
          <motion.div aria-hidden="true" key={shoot}
            initial={{ x: -120, y: size.h * 0.08, opacity: 0 }} animate={{ x: size.w + 120, y: size.h * 0.4, opacity: [0, 1, 1, 0] }}
            transition={{ duration: 0.95, ease: 'easeIn' }}
            style={{ position: 'absolute', left: 0, top: 0, zIndex: 6, pointerEvents: 'none', rotate: `${Math.atan2(size.h * 0.32, size.w + 240) * 57.3}deg` }}>
            <div style={{ width: 110, height: 5, borderRadius: 5, background: 'linear-gradient(90deg, rgba(255,255,255,0), #fff)', boxShadow: '0 0 14px 4px rgba(255,255,255,0.55)' }} />
          </motion.div>
        )}

        {/* the end of the level: all pictures of the album, large, and Lumi */}
        {phase === 'finale' && size && (
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, pointerEvents: 'none' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 10, maxWidth: '96%' }}>
              {album.map((a, i) => {
                // one row where the sky is wide, two on a phone held upright
                const cols = size.w > size.h ? album.length : Math.ceil(album.length / 2)
                const s = Math.round(clamp(Math.min((size.w * 0.94 - (cols - 1) * 10) / cols, (size.h * 0.56) / Math.ceil(album.length / cols)), 60, 190))
                return (
                  <motion.div key={i} initial={reduce ? { opacity: 0 } : { scale: 0, rotate: -25 }}
                    animate={reduce ? { opacity: 1 } : { scale: [0, 1.2, 1], rotate: [-25, 6, 0] }}
                    transition={{ delay: 0.35 + i * 0.24, duration: 0.5 }} style={{ display: 'flex' }}>
                    <Art art={a.art} size={s} style={{ transform: `rotate(${a.rot}deg)`, filter: 'drop-shadow(0 0 10px rgba(255,226,122,0.7))' }} />
                  </motion.div>
                )
              })}
            </div>
            <motion.div animate={reduce ? {} : { y: [0, -16, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>
              <Art art="lumi" mood="happy" size={Math.round(clamp(size.h * 0.2, 56, 110))} />
            </motion.div>
          </div>
        )}
      </div>

      <HintHand key={`${round}-${reached}`} from={reached > 0 ? handFromAt : undefined} to={handToAt}
        active={playing && !drawing && !!lay} delay={round === 0 && reached < 2 ? 2600 : rd.kind !== 'up' && reached === 0 ? 3500 : 9000} />
      {bursts}
    </div>
  )
}
