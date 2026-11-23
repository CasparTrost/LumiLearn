import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { afterNarration } from '../../narrator.js'
import { usePaused } from '../../lib/pause.js'
import { hearable } from '../../lib/hearable.js'
import { Art } from '../../components/play/index.js'

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
      {...hearable('Fertig')}
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

/** The speaker: hear the task again. */
export function HearButton({ onClick, size = 56, label = 'Aufgabe noch einmal hören', style }) {
  return (
    <motion.button type="button" onClick={onClick} aria-label={label} whileTap={{ scale: 0.88 }}
      style={{ ...round(size, '#ffc93c'), ...style }}>
      <Art art="🔊" size={size * 0.6} />
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
