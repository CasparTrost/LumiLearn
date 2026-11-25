import { useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import Confetti from '../../components/Confetti.jsx'
import { Art } from '../../components/play/index.js'
import { PxIcon } from '../../components/PixelUI.jsx'

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// How each stamp comes alive in the frame: the butterfly flaps, the rocket
// lifts, the star spins
const ALIVE = {
  '🦋': { scaleX: [1, 0.3, 1, 0.3, 1, 0.3, 1] },
  '🚀': { y: [0, -14, -4, -18, 0], rotate: [0, -4, 4, -2, 0] },
  '⭐': { rotate: [0, 180, 360], scale: [1, 1.25, 1] },
  '❤️': { scale: [1, 1.3, 1, 1.3, 1] },
  '🐟': { x: [0, -10, 10, -10, 0], rotate: [0, -8, 8, -8, 0] },
  '🐱': { y: [0, -16, 0, -10, 0] },
  '🦄': { y: [0, -16, 0, -10, 0], rotate: [0, -6, 6, 0, 0] },
  '🌸': { rotate: [0, 90, 180] },
  '🌞': { rotate: [0, 120, 240, 360], scale: [1, 1.1, 1, 1] },
  '🌈': { scaleY: [1, 1.15, 0.95, 1.1, 1] },
  '⚡': { opacity: [1, 0.2, 1, 0.2, 1], scale: [1, 1.2, 1, 1.2, 1] },
  '☁️': { x: [0, 12, -12, 0] },
}

// A wooden picture frame
const frame = b => ({
  position: 'absolute', inset: -b, borderRadius: Math.max(4, b * 0.3), pointerEvents: 'none',
  border: `${b}px solid #b8773f`,
  borderColor: '#c98a4e #9c602c #8a5426 #b8773f',
  boxShadow: '0 0 0 3px var(--px-ink), inset 0 0 0 2px rgba(42,27,61,0.55), 0 8px 0 3px rgba(42,27,61,0.28)',
})

/**
 * "Fertig" in the Mal-Atelier: the picture flies from the easel onto the
 * wall of the child's pictures, a frame closes around it, the stamps come
 * alive, Lumi claps next to it (not on it) and confetti falls. The picture
 * stays until the child taps the big green arrow (`onDone`), no reading
 * needed. The sounds and Lumi's voice are the game's.
 *
 *   picture   the painted picture (a data URL)
 *   from      where the easel's sheet was on screen (DOMRect)
 *   sheet     { w, h } of the sheet in picture pixels
 *   stamps    [{ e, x, y, size }] in picture pixels
 *   earlier   up to four earlier pictures (URLs), hung beside it
 *   onDone    the arrow was tapped: on to the home screen
 */
export default function FinishWall({ picture, from, sheet, stamps = [], earlier = [], onDone }) {
  const ref = useRef(null)
  const picRef = useRef(null)
  const [box, setBox] = useState(null)
  const [party, setParty] = useState(false)

  useLayoutEffect(() => {
    const r = ref.current.getBoundingClientRect()
    setBox({ w: r.width, h: r.height })
    const t = setTimeout(() => setParty(true), 750)
    return () => clearTimeout(t)
  }, [])

  // The flight: from the easel to the wall
  useLayoutEffect(() => {
    const el = picRef.current
    if (!box || !el || !from || reduceMotion() || !el.animate) return
    const to = el.getBoundingClientRect()
    if (!to.width) return
    el.animate([
      { transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width})` },
      { transform: 'none' },
    ], { duration: 650, easing: 'cubic-bezier(.25,.8,.3,1)', fill: 'backwards' })
  }, [box, from])

  if (!box) return <div ref={ref} style={{ position: 'absolute', inset: 0 }} />

  const wide = box.w > box.h
  const floor = Math.round(box.h * 0.11)
  const ratio = sheet.w / sheet.h
  // the new picture, as large as the wall allows, above the floor
  let ph = wide ? box.h * 0.72 : Math.min(box.h * 0.5, (box.w * 0.7) / ratio)
  let pw = ph * ratio
  if (pw > box.w * 0.62) { pw = box.w * 0.62; ph = pw / ratio }
  const b = Math.max(7, Math.round(pw * 0.06))                 // frame width
  const px = (box.w - pw) / 2
  const py = wide ? (box.h - floor - ph) / 2 + 6 : box.h * 0.2 + b
  // Lumi stands on the floor beside the picture, never on it
  const lumi = Math.round(Math.min(wide ? box.h * 0.4 : box.w * 0.3, 160, wide ? (box.w - pw) / 2 - b - 16 : 999))
  const lumiX = wide ? px + pw + b + Math.max(8, ((box.w - px - pw - b) - lumi) / 2) : box.w - lumi - 10
  // the earlier pictures: left of it (wide) or in a row above it
  const old = earlier.slice(0, 4)
  let eh, cells
  if (wide) {
    // a grid of one or two columns, centred in the room left of the frame;
    // each small picture with its frame is 1.16 times its size
    const room = px - b - 16
    const cols = old.length > 2 ? 2 : 1
    const rowsN = Math.ceil(old.length / cols)
    const gap = 20
    const ew = Math.min((room - 24 - (cols - 1) * gap) / cols / 1.16, ((box.h - floor - 24 - (rowsN - 1) * gap) / rowsN / 1.16) * ratio, 150)
    eh = ew / ratio
    const cw = ew * 1.16, ch = eh * 1.16
    const x0 = (room - (cols * cw + (cols - 1) * gap)) / 2 + ew * 0.08
    const y0 = (box.h - floor - (rowsN * ch + (rowsN - 1) * gap)) / 2 + eh * 0.08
    cells = ew < 40 ? [] : old.map((url, i) => ({
      url, w: ew, h: eh, x: x0 + (i % cols) * (cw + gap), y: y0 + Math.floor(i / cols) * (ch + gap),
    }))
  } else {
    eh = Math.min(box.h * 0.12, py - b - 30)
    const ew = eh * ratio
    const span = old.length * (ew + 18)
    cells = eh < 40 ? [] : old.map((url, i) => ({ url, w: ew, h: eh, x: (box.w - span) / 2 + i * (ew + 18) + 9, y: 14 }))
  }
  const k = pw / sheet.w
  const still = reduceMotion()
  const btn = Math.round(Math.min(84, Math.max(64, box.h * 0.13)))

  return (
    <div ref={ref} style={{
      position: 'absolute', inset: 0, zIndex: 30, overflow: 'hidden',
      background: 'repeating-linear-gradient(90deg, #fbefd6 0 26px, #f4e2c0 26px 52px)',
    }}>
      {/* the floor */}
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: floor, background: 'linear-gradient(#c58b55, #a4693a)', borderTop: '3px solid var(--px-ink)' }} />

      {/* the pictures already on the wall */}
      {cells.map((c, i) => (
        <div key={i} style={{ position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h, transform: `rotate(${[-3, 2, 3, -2][i]}deg)` }}>
          <img src={c.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#fff' }} />
          <div style={frame(Math.max(4, Math.round(c.w * 0.07)))} />
        </div>
      ))}

      {/* the new one: the cord, the picture, the frame that closes round it */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        style={{ position: 'absolute', left: px + pw / 2 - pw * 0.22, top: py - b - pw * 0.16, width: pw * 0.44, height: pw * 0.16 }}>
        <svg width="100%" height="100%" viewBox="0 0 100 36" preserveAspectRatio="none">
          <path d="M2 36 L50 4 L98 36" fill="none" stroke="#6b4226" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <circle cx="50" cy="4" r="4" fill="var(--px-ink)" />
        </svg>
      </motion.div>
      <div ref={picRef} style={{ position: 'absolute', left: px, top: py, width: pw, height: ph, transformOrigin: '0 0' }}>
        <img src={picture} alt="Dein Bild" style={{ width: '100%', height: '100%', display: 'block', background: '#fff' }} />
        {/* the stamps come alive */}
        {party && stamps.map((st, i) => (
          <motion.div key={i} animate={still ? undefined : ALIVE[st.e] ?? { y: [0, -10, 0] }}
            transition={{ duration: 1.2, repeat: 1, delay: 0.3 + (i % 5) * 0.12 }}
            style={{ position: 'absolute', left: (st.x - st.size / 2) * k, top: (st.y - st.size / 2) * k, width: st.size * k, height: st.size * k }}>
            <Art art={st.e} size={st.size * k} />
          </motion.div>
        ))}
        <motion.div initial={still ? false : { scale: 1.35, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring', stiffness: 320, damping: 16 }}
          style={frame(b)} />
      </div>

      {/* Lumi claps */}
      <motion.div initial={still ? false : { x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.35, type: 'spring', stiffness: 220, damping: 16 }}
        style={{ position: 'absolute', left: lumiX, bottom: floor * 0.45, width: lumi, height: lumi }}>
        <motion.div animate={still ? undefined : { y: [0, -lumi * 0.12, 0] }} transition={{ delay: 1, duration: 0.35, repeat: 5 }}>
          <Art art="lumi" mood="happy" size={lumi} />
        </motion.div>
        <motion.div initial={{ scale: 0 }} animate={{ scale: still ? 1 : [0, 1.3, 0.9, 1.3, 0.9, 1.3, 1] }} transition={{ delay: 0.95, duration: 1.2 }}
          style={{ position: 'absolute', left: '30%', top: '52%', width: lumi * 0.38, height: lumi * 0.38 }}>
          <Art art="👏" size={lumi * 0.38} />
        </motion.div>
      </motion.div>

      {party && !still && <Confetti position="absolute" count={44} zIndex={2} yFrom="-5vh" yTo="105vh" />}

      {/* on: a big green arrow on the floor, once the party is under way */}
      {onDone && (
        <motion.button type="button" className="px-btn px-btn--green" aria-label="Weiter" onClick={onDone}
          initial={still ? false : { scale: 0, opacity: 0 }} animate={still ? { opacity: 1 } : { scale: [0, 1.15, 1, 1.08, 1], opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.9 }}
          style={{ position: 'absolute', left: wide ? 16 : 12, bottom: Math.max(10, floor * 0.25), zIndex: 3,
            width: btn, height: btn, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <PxIcon name="play" size={Math.round(btn * 0.5)} />
        </motion.button>
      )}
    </div>
  )
}
