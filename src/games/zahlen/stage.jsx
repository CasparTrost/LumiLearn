import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { afterNarration } from '../../narrator.js'
import { usePaused } from '../../lib/pause.js'
import { sfx } from '../../sfx.js'
import { Critter, useBursts } from '../../components/play/index.js'

/**
 * The play stage of the number games (Bruno, Obststand, Kraken-Party,
 * Wippe): a layout drawn for a fixed size, scaled to fill the space it is
 * given. A wide one for a tablet held sideways, a tall one for a tablet
 * held upright or a phone. The stage keeps the scale and stretches the
 * other side, so flex rows spread over the whole width or height.
 *
 *   <Stage wide={[760, 540]} tall={[440, 700]}>
 *     {wide => …}
 *   </Stage>
 *
 * The play kit's drag and drop measures on screen, so it works scaled.
 */
export function Stage({ wide = [760, 540], tall = [440, 700], max = 1.7, children }) {
  const ref = useRef(null)
  const [fit, setFit] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (!w || !h) return
      // between the two shapes: the one closer to the screen's
      const isWide = w / h > Math.sqrt((wide[0] / wide[1]) * (tall[0] / tall[1]))
      const [dw, dh] = isWide ? wide : tall
      const scale = Math.min(max, w / dw, h / dh)
      const next = { wide: isWide, scale, w: w / scale, h: h / scale }
      setFit(f => (f && f.wide === next.wide && Math.abs(f.scale - scale) < 0.001 && Math.abs(f.w - next.w) < 1 && Math.abs(f.h - next.h) < 1 ? f : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div ref={ref} style={{ flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {fit && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%', width: fit.w, height: fit.h,
          transform: `translate(-50%, -50%) scale(${fit.scale})`,
          display: 'flex', flexDirection: 'column',
        }}>
          {children(fit.wide)}
        </div>
      )}
    </div>
  )
}

/**
 * Timers that hold still while the help or the quit question is open, and
 * end with the game. `later(ms, fn)` runs fn after ms (and after any pause);
 * `afterSpeech(fn, minMs)` once Lumi is done talking; `clear()` drops all.
 */
export function useLater() {
  const paused = usePaused()
  const st = useRef({ paused, timers: new Set(), waits: new Set() })
  st.current.paused = paused
  const clear = useCallback(() => {
    st.current.timers.forEach(clearTimeout); st.current.timers.clear()
    st.current.waits.forEach(stop => stop()); st.current.waits.clear()
  }, [])
  useEffect(() => clear, [clear])
  const later = useCallback(function run(ms, fn) {
    const t = setTimeout(() => {
      st.current.timers.delete(t)
      if (st.current.paused) run(250, fn)
      else fn()
    }, ms)
    st.current.timers.add(t)
  }, [])
  const afterSpeech = useCallback((fn, minMs = 0) => {
    const stop = afterNarration(() => { st.current.waits.delete(stop); later(0, fn) }, { minMs })
    st.current.waits.add(stop)
  }, [later])
  return { later, afterSpeech, clear, paused }
}

const round = (size, bg) => ({
  all: 'unset', boxSizing: 'border-box', width: size, height: size, borderRadius: '50%', flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  background: `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 55%), ${bg}`,
  border: '4px solid #2a1b3d', boxShadow: 'inset 0 -6px 0 rgba(0,0,0,0.18), 0 5px 0 rgba(42,27,61,0.35)',
  WebkitTapHighlightColor: 'transparent',
})

/**
 * The big round tick: "I am done, have a look". The same in every number
 * game, so a child learns it once. Faded while there is nothing to check.
 */
export function DoneButton({ onClick, disabled, size = 84 }) {
  return (
    <motion.button type="button" onClick={disabled ? undefined : onClick} aria-label="Fertig" aria-disabled={!!disabled}
      animate={{ opacity: disabled ? 0.45 : 1, scale: disabled ? 0.92 : 1 }}
      whileTap={disabled ? undefined : { scale: 0.85 }}
      style={{ ...round(size, '#5cc45a'), cursor: disabled ? 'default' : 'pointer' }}>
      <svg viewBox="0 0 40 40" width={size * 0.55} height={size * 0.55} aria-hidden="true">
        <path d="M8 21 L17 30 L33 11" fill="none" stroke="#2a1b3d" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M8 21 L17 30 L33 11" fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  )
}

// Dice patterns for one to six: small amounts in a familiar picture are
// seen at once rather than counted (subitizing).
const DICE = [
  [],
  [[50, 50]],
  [[27, 27], [73, 73]],
  [[25, 25], [50, 50], [75, 75]],
  [[27, 27], [73, 27], [27, 73], [73, 73]],
  [[25, 25], [75, 25], [50, 50], [25, 75], [75, 75]],
  [[27, 23], [73, 23], [27, 50], [73, 50], [27, 77], [73, 77]],
]

/**
 * A number as a picture: dice dots up to six, a ten frame from seven on
 * (five per row makes "five and some more" visible instead of forcing a
 * one-by-one count). `fill` dots of `n` are coloured, the rest stay empty.
 */
export function Pips({ n, size = 80, color = '#ff6b5b', fill = n, face = true }) {
  if (n > 6) {
    return (
      <svg width={size * 1.9} height={size * 0.88} viewBox="0 0 220 102" aria-hidden="true" style={{ display: 'block' }}>
        {Array.from({ length: 10 }, (_, i) => {
          const x = 6 + (i % 5) * 42, y = 6 + Math.floor(i / 5) * 46
          return (
            <g key={i}>
              <rect x={x} y={y} width={38} height={42} rx={6} fill="#fffdf7" stroke="#2a1b3d" strokeWidth={3} />
              {i < n && <circle cx={x + 19} cy={y + 21} r={13} fill={i < fill ? color : 'rgba(42,27,61,0.12)'} stroke="#2a1b3d" strokeWidth={2.5} />}
            </g>
          )
        })}
      </svg>
    )
  }
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true" style={{ display: 'block' }}>
      {face && <rect x={4} y={4} width={92} height={92} rx={16} fill="#fffdf7" stroke="#2a1b3d" strokeWidth={5} />}
      {DICE[n].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r={11} fill={i < fill ? color : 'rgba(42,27,61,0.12)'} stroke="#2a1b3d" strokeWidth={3} />
      ))}
    </svg>
  )
}

/**
 * Counting you can see: a number that pops up where a thing was laid down
 * and floats away ("1", "2", "3" …). The voice used to count along; only
 * recorded sentences are spoken now, so the count is shown instead.
 *
 *   const [pops, pop] = usePops()
 *   pop(3)              // somewhere in an event
 *   <div style={{ position: 'relative' }}>{pops}</div>
 */
export function usePops({ color = '#2a1b3d', size = 44 } = {}) {
  const [list, setList] = useState([])
  const reduce = useReducedMotion()
  const pop = useCallback((n, dx = 0) => {
    const id = Math.random()
    setList(l => [...l.slice(-4), { id, n, dx }])
    setTimeout(() => setList(l => l.filter(p => p.id !== id)), 1000)
  }, [])
  const node = (
    <AnimatePresence>
      {list.map(p => (
        <motion.span key={p.id} aria-hidden="true"
          initial={{ opacity: 0, scale: 0.3, y: 0, x: p.dx }}
          animate={reduce ? { opacity: [0, 1, 0] } : { opacity: [0, 1, 1, 0], scale: [0.3, 1.25, 1, 0.9], y: [0, -30, -60, -80], x: p.dx }}
          transition={{ duration: 0.95, times: [0, 0.2, 0.6, 1] }}
          style={{
            position: 'absolute', left: '50%', top: 0, marginLeft: -size / 2, width: size, zIndex: 6, pointerEvents: 'none',
            textAlign: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: size, lineHeight: 1, color,
            WebkitTextStroke: '2px #2a1b3d', textShadow: '0 3px 0 rgba(42,27,61,0.35)',
          }}>{p.n}</motion.span>
      ))}
    </AnimatePresence>
  )
  return [node, pop]
}

/**
 * The end of a level, in the game itself: everyone of the level comes out
 * and dances, confetti flies, and only then the results screen opens.
 */
export function Finale({ cast, onDone, ms = 2800, size = 110 }) {
  const { later } = useLater()
  const [bursts, burst] = useBursts()
  const ref = useRef(null)
  useEffect(() => {
    sfx.tada()
    later(150, () => burst(ref.current, 'confetti', 24))
    later(900, () => burst(ref.current, 'stars', 14))
    later(ms, onDone)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 55%, rgba(255,253,247,0.92), rgba(255,253,247,0.7) 70%)' }}>
      <div ref={ref} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 8, maxWidth: '92%' }}>
        {cast.map((art, i) => (
          <motion.div key={i} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 16 }}>
            <Critter art={art} size={size} mood={i % 2 ? 'happy' : 'dance'} />
          </motion.div>
        ))}
      </div>
      {bursts}
    </motion.div>
  )
}
