import { motion, AnimatePresence } from 'framer-motion'
import { Art } from '../../components/play/index.js'
import { skyAt, darkness, sunAt, moonAt } from './day.js'
import { useGlide, INK } from './Clock.jsx'

/**
 * The big window beside the clock: Lumi's house, the garden with the
 * swing, the kindergarten on the hill, and the sky over all of it. The sky
 * follows the clock as the child turns it (the sun rises, crosses and
 * sets, the moon and the stars come), and the moment that was set plays
 * here: Lumi has breakfast, goes to kindergarten, swings, takes a bath,
 * goes to bed.
 *
 * Drawn in a box 240 units high (more when the window is tall) and as wide
 * as the window's shape, at least 400: the house stays left, the
 * kindergarten right, the garden in between gets the rest.
 */

const GROUND = 206            // the meadow's edge, from the top of the 240-unit picture
const FLOOR = 226             // the room's floor
const ROOM = { x: 22, y: 120, w: 160, h: 106 }
const STARS = [[0.06, 0.12], [0.16, 0.3], [0.27, 0.08], [0.36, 0.22], [0.47, 0.1], [0.55, 0.3], [0.63, 0.06], [0.72, 0.2], [0.8, 0.1], [0.9, 0.26], [0.95, 0.06], [0.42, 0.38], [0.86, 0.4]]

// Where Lumi is and what is in the room, for each moment
const ROOM_FOR = { wake: 'bed', schlafen: 'bed', baden: 'tub', fruehstueck: 'table', mittagessen: 'table', abendessen: 'table', kindergarten: 'table', spielplatz: 'table' }
const FOOD = { fruehstueck: ['🥐', '🥛'], mittagessen: ['🍝'], abendessen: ['🍲'] }

export default function View({ skyDay, scene, width, height, reduce, lightsOff, hud }) {
  const d = useGlide(skyDay, reduce, { stiffness: 120, damping: 26 })
  // the frame is drawn inside the box; the picture fills what is within it
  const frame = Math.max(6, Math.round(width * 0.016))
  const iw = width - 2 * frame, ih = height - 2 * frame
  const a = Math.max(iw / ih, 0.5)
  const W = Math.max(400, 240 * a)
  const VH = W / a                    // ≥ 240: a tall window shows more sky
  const top = VH - 240                // the picture's 240 units sit at the bottom
  const s = iw / W                    // px per unit
  const sky = skyAt(d)
  const dark = darkness(d)
  const sun = sunAt(d), moon = moonAt(d)
  // sun and moon cross the open sky right of the house: up from behind it in the morning
  const arcX = p => 206 + p * (W - 206 - 26)
  const arcY = up => top + GROUND - 14 - up * (GROUND - 40 + top * 0.7)
  const gx = 194 + (W - 194) * (W > 520 ? 0.32 : 0.36)     // the swing
  const sx = W - 54                                          // the kindergarten
  const where = ROOM_FOR[scene.id] ?? 'table'
  const lampOn = dark > 0.25 && !lightsOff
  const px = v => v * s
  const outside = { filter: `brightness(${1 - dark * 0.5})` }

  // a sprite in picture units: centre x, bottom y, size
  const at = (cx, bottom, size) => ({ position: 'absolute', left: px(cx - size / 2), top: px(top + bottom - size), width: px(size), height: px(size) })

  return (
    <div role="img" aria-label={dark > 0.6 ? 'Nacht' : dark > 0.2 ? 'Abend' : 'Tag'}
      style={{
        position: 'relative', width, height, flexShrink: 0, borderRadius: 18, overflow: 'hidden', boxSizing: 'border-box',
        border: `${frame}px solid #8A4F22`, outline: `3px solid ${INK}`, outlineOffset: -1,
        boxShadow: '0 6px 0 rgba(42,27,61,0.3), inset 0 0 0 3px rgba(42,27,61,0.35)', background: sky.top,
      }}>
      <svg viewBox={`0 0 ${W} ${VH}`} width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" style={{ position: 'absolute', inset: 0, display: 'block' }}>
        <defs>
          <linearGradient id="lt-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={sky.top} />
            <stop offset="1" stopColor={sky.bottom} />
          </linearGradient>
          <radialGradient id="lt-lamp">
            <stop offset="0" stopColor="#FFE9A8" stopOpacity="0.9" />
            <stop offset="1" stopColor="#FFE9A8" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width={W} height={VH} fill="url(#lt-sky)" />
        {/* stars */}
        <g opacity={Math.max(0, dark * 1.2 - 0.2)}>
          {STARS.map(([x, y], i) => (
            <circle key={i} cx={x * W} cy={y * (top + 150)} r={i % 3 ? 1.8 : 2.6} fill="#fff" />
          ))}
        </g>
        {/* the sun: rises left behind the hill, sets right */}
        {sun && (
          <g transform={`translate(${arcX(sun.p)} ${arcY(sun.up)})`}>
            <circle r="24" fill="#FFE27A" opacity="0.35" />
            <circle r="17" fill="#FFD84A" stroke="#F2B632" strokeWidth="3.5" />
            <circle cx="-5.5" cy="-3" r="2.2" fill={INK} /><circle cx="5.5" cy="-3" r="2.2" fill={INK} />
            <path d="M-6 4 Q0 9 6 4" stroke={INK} strokeWidth="2.2" fill="none" strokeLinecap="round" />
          </g>
        )}
        {moon && (
          <g transform={`translate(${arcX(moon.p)} ${arcY(moon.up)})`}>
            <path d="M-4 -16 A16 16 0 1 0 12 10 A13 13 0 1 1 -4 -16 Z" fill="#FFF3B0" stroke="#E8D27A" strokeWidth="2.5" />
          </g>
        )}
        {/* hills, the meadow */}
        <path d={`M0 ${top + 176} Q${W * 0.25} ${top + 150} ${W * 0.5} ${top + 170} T${W} ${top + 160} V${VH} H0 Z`} fill="#9ED982" />
        <path d={`M${W * 0.55} ${top + 200} Q${W * 0.8} ${top + 160} ${W} ${top + 172} V${VH} H${W * 0.55} Z`} fill="#86CC6C" />
        <rect x="0" y={top + GROUND} width={W} height={VH - top - GROUND} fill="#7CC95A" />
        <path d={`M${sx - 40} ${top + 186} Q${(sx + 196) / 2} ${top + 200} 196 ${top + 222}`} stroke="#E9D7A6" strokeWidth="7" fill="none" strokeLinecap="round" />
        {/* the house */}
        <rect x="186" y={top + 196} width="8" height="30" fill="#7A4A22" />
        <rect x="10" y={top + 104} width="184" height="128" rx="6" fill="#F6D7A7" stroke={INK} strokeWidth="3.5" />
        <polygon points={`0,${top + 110} 102,${top + 46} 204,${top + 110}`} fill="#D9534F" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
        <rect x="140" y={top + 58} width="20" height="30" fill="#B5733A" stroke={INK} strokeWidth="3" />
        {/* night over everything outside */}
        <rect width={W} height={VH} fill="#0B0F30" opacity={dark * 0.45} />
        {/* the room, lit by its lamp in the evening */}
        <rect x={ROOM.x} y={top + ROOM.y} width={ROOM.w} height={ROOM.h} fill="#FFF1D6" stroke={INK} strokeWidth="3" />
        <rect x={ROOM.x} y={top + FLOOR - 10} width={ROOM.w} height="10" fill="#D9A066" />
        <rect x={ROOM.x + 12} y={top + ROOM.y + 14} width="30" height="24" rx="3" fill="#BDE6FF" stroke="#B5733A" strokeWidth="2.5" />
        <line x1="102" y1={top + ROOM.y} x2="102" y2={top + ROOM.y + 16} stroke={INK} strokeWidth="2" />
        <path d={`M93 ${top + ROOM.y + 24} Q102 ${top + ROOM.y + 10} 111 ${top + ROOM.y + 24} Z`} fill="#FFC93C" stroke={INK} strokeWidth="2" />
        {lampOn && <circle cx="102" cy={top + ROOM.y + 30} r="62" fill="url(#lt-lamp)" />}
        {!lampOn && dark > 0.25 && <rect x={ROOM.x} y={top + ROOM.y} width={ROOM.w} height={ROOM.h} fill="#141a4a" opacity="0.5" />}
      </svg>

      {/* the kindergarten and the swing, outside */}
      <div style={{ ...at(sx, 184, 86), ...outside }}><Art art="🏫" size={px(86)} /></div>
      <div style={{ ...at(gx, FLOOR + 2, 108), ...outside }}><Art art=":px-schaukel:" size={px(108)} /></div>

      {/* what is in the room */}
      <AnimatePresence initial={false}>
        <motion.div key={where} initial={reduce ? false : { opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none', transformOrigin: `${px(102)}px ${px(top + FLOOR)}px` }}>
          {where === 'table' && (
            <div style={at(140, FLOOR + 4, 82)}><Art art=":px-tisch:" size={px(82)} /></div>
          )}
          {where === 'bed' && (
            <div style={at(110, FLOOR + 6, 124)}><Art art="🛏️" size={px(124)} /></div>
          )}
        </motion.div>
      </AnimatePresence>
      {/* the food on the table, fresh for each meal */}
      <AnimatePresence>
        {FOOD[scene.id] && (
          <motion.div key={`food${scene.n}`} initial={reduce ? false : { y: -px(30), opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 16, delay: 0.25 }}
            style={{ position: 'absolute', left: px(140 - 18 * FOOD[scene.id].length), top: px(top + FLOOR - 76), display: 'flex', gap: px(2), pointerEvents: 'none' }}>
            {FOOD[scene.id].map(f => <Art key={f} art={f} size={px(34)} />)}
          </motion.div>
        )}
      </AnimatePresence>

      <Lumi scene={scene} at={at} px={px} gx={gx} sx={sx} reduce={reduce} />

      {where === 'tub' && (
        <div style={{ ...at(100, FLOOR + 4, 120), pointerEvents: 'none' }}><Art art="🛁" size={px(120)} /></div>
      )}
      {where === 'tub' && !reduce && [0, 1, 2, 3].map(i => (
        <motion.span key={`b${scene.n}-${i}`} aria-hidden="true"
          animate={{ y: [0, -px(46)], opacity: [0, 0.95, 0], scale: [0.6, 1, 1.1] }}
          transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.45 }}
          style={{ position: 'absolute', left: px(70 + i * 16), top: px(top + FLOOR - 54), width: px(12), height: px(12), borderRadius: '50%', background: 'rgba(255,255,255,0.9)', border: `1.5px solid ${INK}`, pointerEvents: 'none' }} />
      ))}

      {hud && <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 3 }}>{hud}</div>}
    </div>
  )
}

// Lumi in the window, doing what the clock says
function Lumi({ scene, at, px, gx, sx, reduce }) {
  const id = scene.id
  let pos, mood = 'idle', act = {}, origin = '50% 100%'
  if (id === 'wake' || id === 'schlafen') {
    pos = at(80, FLOOR - 46, 52); mood = 'sleep'
    act = reduce ? {} : { scaleY: [1, 1.04, 1], transition: { duration: 2.4, repeat: Infinity } }
  } else if (id === 'baden') {
    pos = at(96, FLOOR - 26, 56); mood = 'happy'
    act = reduce ? {} : { rotate: [-5, 5, -5], transition: { duration: 1.2, repeat: Infinity } }
  } else if (id === 'kindergarten') {
    pos = at(sx - 62, 196, 56); mood = 'wave'
    act = reduce ? {} : { y: [0, -px(8), 0], transition: { duration: 0.5, repeat: 3 } }
  } else if (id === 'spielplatz') {
    // on the swing's seat, swinging from its top bar
    pos = at(gx, FLOOR - 24, 50); mood = 'happy'
    origin = `50% ${-px(44)}px`
    act = reduce ? {} : { rotate: [18, -18, 18], transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' } }
  } else {
    // at the table: munch, munch
    pos = at(64, FLOOR, 60); mood = 'eat'
    act = reduce ? {} : { scaleY: [1, 0.9, 1.05, 0.92, 1], transition: { duration: 0.7, repeat: 3 } }
  }
  return (
    <motion.div key={`${id}${scene.n}`} aria-hidden="true"
      initial={reduce ? false : { opacity: 0, y: -px(24), scale: 0.6 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 16 }}
      style={{ ...pos, pointerEvents: 'none' }}>
      <motion.div animate={act} style={{ transformOrigin: origin, position: 'relative', width: '100%', height: '100%' }}>
        <Art art="lumi" mood={mood} size={pos.width} />
        {id === 'kindergarten' && (
          <div style={{ position: 'absolute', right: -px(12), bottom: px(4) }}><Art art="🎒" size={px(24)} /></div>
        )}
      </motion.div>
      {(id === 'wake' || id === 'schlafen') && !reduce && (
        <motion.div animate={{ y: [0, -px(16)], opacity: [0, 1, 0] }} transition={{ duration: 2.2, repeat: Infinity }}
          style={{ position: 'absolute', right: -px(20), top: -px(14) }}>
          <Art art="💤" size={px(22)} />
        </motion.div>
      )}
    </motion.div>
  )
}
