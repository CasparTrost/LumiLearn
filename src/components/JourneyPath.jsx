import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TileArt from './TileArt.jsx'
import Confetti from './Confetti.jsx'
import { MODULE_BY_ID } from '../modules.js'
import { nextStopIndex } from '../lib/learning.js'
import { STICKER_BY_EMOJI } from '../lib/stickers.js'
import { STOP_LABEL } from '../lib/journeyNav.js'
import { narrate } from '../narrator.js'
import { hearable } from '../lib/hearable.js'
import { sfx } from '../sfx.js'
import { emojiSrc } from '../lib/emojiArt.jsx'

const BASE = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
export const journeyArt = f => `${BASE}/sprites/journey/${f}`
const LUMI = happy => `${BASE}/sprites/maze/${happy ? 'lumi_happy' : 'lumi_idle'}.png`

// Where the stops sit on the meadow, in % of the picture, the chest last.
// Wide: a path winding left to right. Narrow (phone): a snake from the
// bottom up, so the stops stay big enough to tap.
const WIDE = [[8, 74], [24, 50], [40, 74], [56, 50], [72, 74], [90, 48]]
const TALL = [[24, 82], [72, 72], [30, 58], [72, 44], [28, 30], [68, 14]]
function spots(n, tall) {
  const base = tall ? TALL : WIDE
  if (n === base.length) return base
  // other lengths: spread along the same curve
  return Array.from({ length: n }, (_, i) => {
    const t = (i / (n - 1)) * (base.length - 1)
    const a = base[Math.floor(t)], b = base[Math.min(base.length - 1, Math.ceil(t))], f = t - Math.floor(t)
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]
  })
}

// Where Lumi stood when the home screen was last shown, per child: Lumi
// walks from there to the next stop instead of appearing there.
const lumiWasAt = {}

function stopTitle(stop) {
  return stop.kind === 'move' ? 'Bewegungspause' : MODULE_BY_ID[stop.moduleId]?.title ?? ''
}

/** What Lumi says about the journey (the 🔊 button, and the greeting). */
export function journeySay(journey) {
  const stops = journey?.stops ?? []
  const next = nextStopIndex(journey)
  if (next === -1) return journey?.chest ? 'Die Reise für heute ist geschafft! Morgen geht es weiter.' : 'Du hast alle Stationen geschafft! Tippe auf die Schatztruhe!'
  const games = stops.filter(s => s.kind !== 'move').map(s => MODULE_BY_ID[s.moduleId]?.title).filter(Boolean)
  if (!(journey.done ?? []).length) {
    return `Heute reisen wir zusammen! Wir spielen ${games.slice(0, -1).join(', ')} und ${games[games.length - 1]}, und dazwischen bewegen wir uns. Am Ende wartet eine Schatztruhe. Tippe auf die leuchtende Station!`
  }
  return `Weiter geht's! Als Nächstes: ${stopTitle(stops[next])}.`
}

export default function JourneyPath({ journey, profileId, stickers = 0, onStart, onChest, onAlbum }) {
  const stops = journey?.stops ?? []
  const done = new Set(journey?.done ?? [])
  const next = nextStopIndex(journey)
  const finished = next === -1
  const chestOpen = !!journey?.chest
  const n = stops.length + 1

  const [tall, setTall] = useState(() => typeof window !== 'undefined' && window.innerWidth < 600)
  useEffect(() => {
    const on = () => setTall(window.innerWidth < 600)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const pts = useMemo(() => spots(n, tall), [n, tall])

  // Lumi: at the next stop, at the chest when all is done
  const lumiIdx = finished ? n - 1 : next
  const from = lumiWasAt[profileId] ?? lumiIdx
  useEffect(() => { lumiWasAt[profileId] = lumiIdx }, [profileId, lumiIdx])
  const [lumiPos, setLumiPos] = useState(from)
  useEffect(() => {
    if (lumiPos === lumiIdx) return
    const t = setTimeout(() => setLumiPos(p => p + Math.sign(lumiIdx - p)), 450)
    return () => clearTimeout(t)
  }, [lumiPos, lumiIdx])
  const walking = lumiPos !== lumiIdx

  // the path between the stops, as a smooth curve
  const d = useMemo(() => pts.map(([x, y], i) => {
    if (!i) return `M ${x} ${y}`
    const [px, py] = pts[i - 1]
    const mx = (px + x) / 2
    return `C ${mx} ${py}, ${mx} ${y}, ${x} ${y}`
  }).join(' '), [pts])
  // done part of the path
  const doneUpTo = finished ? n - 1 : next
  const dDone = useMemo(() => d.split(' C ').slice(0, doneUpTo + 1).join(' C '), [d, doneUpTo])

  const [chestBurst, setChestBurst] = useState(false)
  const openChest = () => {
    if (!finished) {
      narrate([{ text: 'Die Schatztruhe öffnet sich, wenn du alle Stationen geschafft hast.' }])
      return
    }
    if (chestOpen) { onAlbum(); return }
    sfx.complete()
    setChestBurst(true)
    onChest()
  }

  const nodeSize = tall ? 'clamp(58px, 17vw, 72px)' : 'clamp(62px, 8.4vw, 92px)'
  return (
    <section aria-label="Reise mit Lumi" className="px-panel" style={{ padding: 0, overflow: 'hidden' }}>
      {/* header */}
      <div className="px-wood" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '3px solid var(--px-ink)' }}>
        <img src={journeyArt('flag.png')} alt="" className="px-art" style={{ width: 34, height: 34, imageRendering: 'pixelated' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="px-title" style={{ fontSize: 'clamp(17px,2.6vw,22px)', lineHeight: 1.1 }}>Reise mit Lumi</div>
          <div aria-hidden="true" style={{ display: 'flex', gap: 3, marginTop: 4 }}>
            {stops.map((_, i) => <span key={i} className={`px-pip${done.has(i) ? ' px-pip--gold' : ''}`} style={{ width: 14, height: 10 }} />)}
          </div>
        </div>
        <button className="px-btn px-btn--parch" onClick={() => narrate([{ text: journeySay(journey) }])}
          aria-label="Reise vorlesen" style={{ width: 44, height: 44, padding: 0, fontSize: 20 }}>🔊</button>
        <button className="px-btn px-btn--gold" onClick={onAlbum} aria-label={`Sticker-Album, ${stickers} Sticker`}
          style={{ height: 44, padding: '0 10px', gap: 6, fontSize: 16 }}>
          <img src={journeyArt('album.png')} alt="" style={{ width: 30, height: 30, imageRendering: 'pixelated' }} />
          <span style={{ fontFamily: 'var(--font-heading)' }}>{stickers}</span>
        </button>
      </div>

      {/* the meadow */}
      <div data-journey style={{
        position: 'relative', width: '100%', aspectRatio: tall ? '4 / 5' : '400 / 190', maxHeight: tall ? 'none' : 480,
        backgroundImage: `url(${journeyArt('meadow.webp')})`, backgroundSize: 'cover', backgroundPosition: 'center 65%',
        imageRendering: 'pixelated',
      }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}>
          <path d={d} fill="none" stroke="rgba(120,72,30,0.55)" strokeWidth="14" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={d} fill="none" stroke="#e9c98f" strokeWidth="9" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={dDone} fill="none" stroke="#ffd24a" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 9" vectorEffect="non-scaling-stroke" />
        </svg>

        {stops.map((stop, i) => {
          const [x, y] = pts[i]
          const isDone = done.has(i)
          const isNext = i === next
          const mod = MODULE_BY_ID[stop.moduleId]
          const title = stopTitle(stop)
          return (
            <motion.button key={i}
              data-stop={i}
              onClick={() => onStart(i)}
              {...hearable(`${title}. ${STOP_LABEL[stop.kind] ?? ''}`)}
              aria-label={`Station ${i + 1}: ${title}, ${STOP_LABEL[stop.kind]}${isDone ? ', geschafft' : isNext ? ', jetzt dran' : ''}`}
              initial={{ scale: 0 }}
              animate={{ scale: isNext ? [1, 1.08, 1] : 1 }}
              transition={isNext ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 300, damping: 16, delay: i * 0.06 }}
              whileTap={{ scale: 0.92 }}
              style={{
                position: 'absolute', left: `${x}%`, top: `${y}%`, translate: '-50% -50%',
                width: nodeSize, height: nodeSize, borderRadius: '50%', padding: 0, cursor: 'pointer',
                background: stop.kind === 'move' ? '#bdf0a6' : (mod?.color ?? 'var(--px-parch)'),
                border: `4px solid ${isNext ? '#ffd24a' : 'var(--px-ink)'}`,
                boxShadow: isNext ? '0 0 0 4px var(--px-ink), 0 0 22px 6px rgba(255,210,74,0.85)' : '0 4px 0 rgba(42,27,61,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                filter: isDone ? 'saturate(0.75)' : 'none', zIndex: isNext ? 3 : 2,
              }}>
              {stop.kind === 'move'
                ? <img src={journeyArt('move.png')} alt="" style={{ width: '78%', height: '78%', imageRendering: 'pixelated' }} />
                : mod && <TileArt mod={mod} size={tall ? 46 : 60} bare />}
              {isDone && (
                <span style={{ position: 'absolute', right: -6, bottom: -6, width: 28, height: 28, borderRadius: 14, background: 'var(--px-green, #4caf50)',
                  border: '3px solid var(--px-ink)', color: '#fff', fontWeight: 900, fontSize: 15, lineHeight: '22px', textAlign: 'center' }}>✓</span>
              )}
              <span style={{
                position: 'absolute', top: '100%', left: '50%', translate: '-50% 4px', whiteSpace: 'nowrap',
                background: isNext ? 'var(--px-gold)' : 'var(--px-parch-light, #fff5df)', color: 'var(--px-ink)',
                border: '2px solid var(--px-ink)', borderRadius: 6, padding: '0 6px',
                fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: tall ? 12 : 13, lineHeight: '18px',
              }}>{STOP_LABEL[stop.kind]}</span>
            </motion.button>
          )
        })}

        {/* the treasure chest */}
        {(() => {
          const [x, y] = pts[n - 1]
          return (
            <motion.button data-chest onClick={openChest}
              {...hearable(finished ? (chestOpen ? 'Dein Sticker-Album' : 'Die Schatztruhe! Tippe sie an.') : 'Die Schatztruhe. Sie öffnet sich am Ende der Reise.')}
              aria-label={finished ? (chestOpen ? 'Schatztruhe ist offen. Zum Album' : 'Schatztruhe öffnen') : 'Schatztruhe, noch zu'}
              animate={finished && !chestOpen ? { rotate: [0, -6, 6, -4, 0], scale: [1, 1.1, 1] } : {}}
              transition={finished && !chestOpen ? { duration: 1.1, repeat: Infinity, repeatDelay: 0.6 } : {}}
              style={{
                position: 'absolute', left: `${x}%`, top: `${y}%`, translate: '-50% -50%', background: 'none', border: 'none', padding: 0,
                width: `calc(${nodeSize} * 1.25)`, height: `calc(${nodeSize} * 1.25)`, cursor: 'pointer', zIndex: 2,
                filter: finished && !chestOpen ? 'drop-shadow(0 0 14px rgba(255,210,74,0.95))' : 'drop-shadow(0 4px 0 rgba(42,27,61,0.35))',
              }}>
              <img src={journeyArt(chestOpen ? 'chest-open.png' : 'chest.png')} alt="" draggable={false}
                style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
              {chestOpen && STICKER_BY_EMOJI[journey.chest] && (
                <img src={emojiSrc(journey.chest)} alt="" draggable={false}
                  style={{ position: 'absolute', top: '-22%', left: '50%', translate: '-50% 0', width: '48%', height: '48%', objectFit: 'contain' }} />
              )}
            </motion.button>
          )
        })()}

        {/* Lumi walking along the path */}
        <motion.img src={LUMI(finished || walking)} alt="" aria-hidden="true" draggable={false}
          initial={false}
          animate={{ left: `${pts[lumiPos][0]}%`, top: `${pts[lumiPos][1]}%`, y: walking ? [0, -14, 0] : [0, -5, 0] }}
          transition={{ left: { duration: 0.42, ease: 'easeInOut' }, top: { duration: 0.42, ease: 'easeInOut' },
            y: walking ? { duration: 0.42 } : { duration: 1.8, repeat: Infinity } }}
          style={{ position: 'absolute', width: tall ? 48 : 58, height: tall ? 48 : 58, translate: tall ? '18% -105%' : '-30% -125%', imageRendering: 'pixelated', zIndex: 4, pointerEvents: 'none',
            filter: 'drop-shadow(0 3px 0 rgba(42,27,61,0.35))' }} />
      </div>
      <AnimatePresence>{chestBurst && <ChestReveal key="reveal" emoji={journey?.chest} onClose={() => setChestBurst(false)} />}</AnimatePresence>
    </section>
  )
}

/** The sticker from the chest, big, before it goes into the album. */
function ChestReveal({ emoji, onClose }) {
  const sticker = STICKER_BY_EMOJI[emoji]
  const said = useRef(false)
  useEffect(() => {
    if (said.current || !sticker) return
    said.current = true
    narrate([{ text: `Wow! In der Truhe ist ${sticker.name}! Der Sticker kommt in dein Album. Morgen geht die Reise weiter.` }])
  }, [sticker])
  if (!sticker) return null
  return (
    <motion.div className="px-backdrop" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      role="dialog" aria-modal="true" aria-label="Dein neuer Sticker">
      <Confetti count={50} yFrom="-5vh" yTo="110vh" />
      <motion.div className="px-panel" onClick={e => e.stopPropagation()}
        initial={{ scale: 0.3, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 14 }}
        style={{ padding: '22px 26px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, maxWidth: 360, width: '100%' }}>
        <div className="px-title" style={{ fontSize: 26 }}>Ein neuer Sticker!</div>
        <motion.div animate={{ rotate: [0, -6, 6, 0], scale: [1, 1.08, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
          style={{ width: 150, height: 150, borderRadius: 24, border: '4px solid var(--px-ink)', background: 'radial-gradient(circle, #fff7d1 0%, #ffd24a 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 96, boxShadow: '0 0 30px rgba(255,210,74,0.9)' }}>
          <img src={emojiSrc(emoji)} alt="" draggable={false} style={{ width: '80%', height: '80%', objectFit: 'contain' }} />
        </motion.div>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 700, color: 'var(--px-ink)', textTransform: 'capitalize' }}>{sticker.name.replace(/^(ein|eine) /, '')}</div>
        <button className="px-btn px-btn--green px-btn--md" onClick={onClose}>Toll!</button>
      </motion.div>
    </motion.div>
  )
}
