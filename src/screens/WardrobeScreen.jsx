import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, profileWardrobeStars } from '../AppContext.jsx'
import { HudBar, PxIcon, PxStar } from '../components/PixelUI.jsx'
import MusicButton from '../components/MusicControls.jsx'
import { Critter, Art, useMood, useBursts } from '../components/play/index.js'
import { asset } from '../lib/assets.js'
import { SLOTS, WARDROBE, isUnlocked, nextLocked, stepBefore, cleanOutfit } from '../lib/wardrobe.js'
import { narrate, stopNarration } from '../narrator.js'
import { sfx } from '../sfx.js'
import { LINES, line } from '../lib/lumiLines.js'

/**
 * Lumis Kleiderschrank (lib/wardrobe.js): the stars a child collected
 * unlock things for Lumi to wear. Lumi stands large on the left (on top on
 * a phone held upright) and the wardrobe holds three shelves, from the top
 * down where a thing is worn: head, face, neck. A tap puts a thing on with
 * a little show, a second tap takes it off. Things still to come are
 * wrapped presents with the stars they need; the next one shows how far
 * there is to go. Nothing is spent, nothing can be lost.
 *
 * Lumi's sentences here are not recorded yet: they are looked up and left
 * out while missing (the screen works without words).
 */
const rec = key => (LINES[key] ? line(key) : null)
const REACTIONS = ['schrank/anziehen-1', 'schrank/anziehen-2', 'schrank/anziehen-3', 'schrank/anziehen-4']
const nameLine = item => rec(`schrank/name-${item.id}`) ?? (item.say ? rec(item.say) : null)
const SHELF_LABEL = { head: 'Für den Kopf', face: 'Fürs Gesicht', neck: 'Für den Hals', back: 'Für den Rücken', hold: 'Zum Festhalten' }

function useViewport() {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [v, setV] = useState(get)
  useEffect(() => {
    const on = () => setV(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

export default function WardrobeScreen() {
  const { state, dispatch } = useApp()
  const profile = state.profiles[state.activeProfileId]
  const stars = profileWardrobeStars(profile)
  const outfit = cleanOutfit(profile?.outfit)
  const tried = profile?.wardrobeTried ?? []
  const next = nextLocked(stars)
  const [mood, setMood] = useMood('wave')
  const [wish, setWish] = useState(null)       // the stars still missing for a tapped present
  const [shake, setShake] = useState(null)
  const [bursts, burst] = useBursts()
  const lumiRef = useRef(null)
  const wishTimer = useRef(null)
  const reaction = useRef(Math.floor(Math.random() * REACTIONS.length))

  const { w, h } = useViewport()
  const wide = w > h || w >= 700
  const hud = w < 521 ? 72 : 80
  const stageW = wide ? Math.min(440, Math.max(220, w * 0.4), Math.max(220, h - hud)) : w
  const stageH = wide ? h - hud : Math.min(300, Math.round(h * 0.34))
  const lumi = Math.round(wide ? Math.min(stageW * 0.8, stageH * 0.7, 340) : stageH * 0.78)
  // the places: as big as fits, the longest shelf in one row where it can
  const shelfW = Math.min(640, (wide ? w - stageW : w) - 2 * Math.min(22, Math.max(10, w * 0.02))) - 2 * (4 + 12) - 2 * (3 + 8)
  const most = Math.max(...SLOTS.map(sl => WARDROBE.filter(t => t.slot === sl).length))
  const tile = Math.round(Math.max(h < 430 ? 58 : 68, Math.min(92, (shelfW - (most - 1) * 10) / most)))

  // Opened: what is unlocked is seen now (the sign on the home button goes),
  // Lumi waves and says what to do
  useEffect(() => {
    dispatch({ type: 'WARDROBE_SEEN' })
    const t = setTimeout(() => narrate([rec('schrank/willkommen')]), 500)
    return () => { clearTimeout(t); clearTimeout(wishTimer.current); stopNarration() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const home = () => { stopNarration(); dispatch({ type: 'NAVIGATE', payload: 'home' }) }

  const headPoint = () => {
    const r = lumiRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.3 } : undefined
  }

  const tap = item => {
    setWish(null)
    if (!isUnlocked(item, stars)) {
      // still wrapped: it shakes, and Lumi shows how many stars are missing
      setShake(item.id + Date.now())
      sfx.bump()
      setMood('hmm', 1600)
      setWish(item.stars - stars)
      clearTimeout(wishTimer.current)
      wishTimer.current = setTimeout(() => setWish(null), 2600)
      narrate([rec('schrank/eingepackt')])
      return
    }
    const on = outfit[item.slot] !== item.id
    dispatch({ type: 'WARDROBE_WEAR', payload: item.id })
    if (on) {
      sfx.boing()
      setTimeout(() => sfx.sparkle(), 220)
      setMood('happy', 1500)
      setTimeout(() => burst(headPoint(), 'stars', 12), 120)
      reaction.current = (reaction.current + 1) % REACTIONS.length
      narrate([nameLine(item), rec(REACTIONS[reaction.current])])
    } else {
      sfx.pop()
      setMood('wow', 900)
      narrate([rec('schrank/ausziehen')])
    }
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <HudBar style={{ position: 'relative', zIndex: 10, minHeight: hud }}>
        <button className="px-btn px-btn--wood px-btn--icon" onClick={home} aria-label="Zur Startseite"><PxIcon name="back" size={20} color="#fff" /></button>
        <img src={asset('sprites/emoji/custom/kleiderschrank.webp')} alt="" style={{ width: 44, height: 44, flexShrink: 0 }} />
        <span className="px-title hud-hide-sm" style={{ flex: 1, minWidth: 0, fontSize: 'clamp(18px,3vw,28px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Lumis Kleiderschrank</span>
        <span className="hud-only-sm" style={{ flex: 1 }} />
        <span className="px-chip" aria-label={`${stars} Sterne`} style={{ fontFamily: 'var(--font-heading)', flexShrink: 0 }}>
          <PxStar size={22} /> {stars}
        </span>
        <MusicButton />
      </HudBar>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column' }}>
        {/* ── Lumi on a little rug, in the light ── */}
        <div style={{
          position: 'relative', zIndex: 2, flexShrink: 0, width: wide ? stageW : '100%', height: wide ? '100%' : stageH,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 45%, #fff8e2 0%, #ffeec2 38%, #f6dca8 70%, #ecc98c 100%)',
          borderRight: wide ? '4px solid var(--px-ink)' : 'none', borderBottom: wide ? 'none' : '4px solid var(--px-ink)',
        }}>
          <div style={{ position: 'relative', width: lumi, height: lumi * 1.06, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {/* the rug */}
            <div aria-hidden="true" style={{ position: 'absolute', bottom: 0, left: '6%', width: '88%', height: lumi * 0.16, borderRadius: '50%', background: 'radial-gradient(ellipse, #ff9fb8 0%, #f2789a 55%, #d95f82 100%)', border: '3px solid var(--px-ink)' }} />
            <div ref={lumiRef} style={{ position: 'relative', marginBottom: lumi * 0.05 }}>
              <Critter art="lumi" size={lumi} mood={mood} label="Lumi" shadow={false} />
              {/* a tapped present: the stars still missing, in a bubble beside Lumi's head */}
              {wish && (
                <motion.div key={wish} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                  style={{ position: 'absolute', left: '74%', top: '6%', zIndex: 5, transformOrigin: '0% 60%', background: '#fffdf7', border: '3px solid var(--px-ink)', borderRadius: 16, padding: '6px 8px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)' }}>
                  <MissingStars n={wish} />
                  <span aria-hidden="true" style={{ position: 'absolute', left: -13, top: '50%', marginTop: -9, width: 0, height: 0, borderStyle: 'solid', borderWidth: '9px 13px 9px 0', borderColor: 'transparent #2a1b3d transparent transparent' }} />
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* ── The wardrobe: three shelves, head to neck ── */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, overflow: 'auto', padding: 'clamp(10px,2vw,22px)' }}>
          <div style={{
            maxWidth: 640, margin: '0 auto', borderRadius: 22, border: '4px solid var(--px-ink)', padding: 'clamp(8px,1.4vw,12px)',
            background: 'linear-gradient(90deg, #a8652c 0%, #c27a3a 12%, #c98443 50%, #c27a3a 88%, #a8652c 100%)',
            boxShadow: '0 6px 0 rgba(42,27,61,0.3)', display: 'flex', flexDirection: 'column', gap: 'clamp(8px,1.4vw,12px)',
          }}>
            {SLOTS.map(slot => (
              <section key={slot} aria-label={SHELF_LABEL[slot]} style={{
                position: 'relative', borderRadius: 12, border: '3px solid var(--px-ink)', overflow: 'hidden',
                background: 'linear-gradient(180deg, #f4dcb4 0%, #fbeacb 60%, #f2d6a6 100%)',
                padding: `10px 8px ${8 + 12}px`,
              }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 10px', justifyContent: 'flex-start', position: 'relative', zIndex: 1 }}>
                  {WARDROBE.filter(t => t.slot === slot).map(item => (
                    <Thing key={item.id} item={item} size={tile} stars={stars}
                      worn={outfit[slot] === item.id} fresh={isUnlocked(item, stars) && !tried.includes(item.id)}
                      next={next?.id === item.id} shake={shake?.startsWith(item.id) ? shake : null} onTap={() => tap(item)} />
                  ))}
                </div>
                {/* the shelf board the things stand on */}
                <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 14, background: 'linear-gradient(180deg, #d99a5a 0%, #b06c32 60%, #8a4f22 100%)', borderTop: '3px solid var(--px-ink)' }} />
              </section>
            ))}
          </div>
        </div>
      </div>
      {bursts}
    </div>
  )
}

/** The stars still missing for a present: as many stars as are missing (five and a "+" for more). */
function MissingStars({ n }) {
  return (
    <span role="img" aria-label={`Noch ${n} Sterne`} style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(n, 3)}, 22px)`, gap: 3, alignItems: 'center' }}>
      {Array.from({ length: Math.min(n, 5) }, (_, i) => <PxStar key={i} size={22} />)}
      {n > 5 && <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, lineHeight: '22px', textAlign: 'center', color: 'var(--px-ink)' }}>+</span>}
    </span>
  )
}

/** A thing's picture, the drawn part (item.box) filling the tile. */
export function ThingPic({ item, size }) {
  const [x0, y0, x1, y1] = item.box ?? [0, 0, 1, 1]
  const k = Math.min(1 / (x1 - x0), 1 / (y1 - y0), 2.4) * 0.86
  const S = size * k
  return (
    <span style={{ position: 'relative', display: 'block', width: size, height: size, overflow: 'hidden', pointerEvents: 'none' }}>
      <img src={asset(item.src)} alt="" draggable={false}
        style={{ position: 'absolute', width: S, height: S, maxWidth: 'none', left: size / 2 - (x0 + x1) / 2 * S, top: size / 2 - (y0 + y1) / 2 * S }} />
    </span>
  )
}

/**
 * One place in the wardrobe: a thing to put on (a ring and a tick while
 * Lumi wears it, a glow while it is new) or a present still wrapped, with
 * the stars it needs; the next present fills up as the stars come.
 */
function Thing({ item, size, stars, worn, fresh, next, shake, onTap }) {
  const open = isUnlocked(item, stars)
  const from = stepBefore(item)
  const share = next ? Math.max(0.08, Math.min(1, (stars - from) / (item.stars - from))) : 0
  return (
    <motion.button type="button" onClick={onTap}
      aria-label={open ? `${item.name}${worn ? ', trägt Lumi' : ''}${fresh ? ', neu' : ''}` : `Geschenk, ${item.stars} Sterne`}
      aria-pressed={open ? worn : undefined}
      data-thing={item.id} data-state={open ? (worn ? 'worn' : fresh ? 'new' : 'open') : next ? 'next' : 'locked'}
      whileTap={{ scale: 0.9 }}
      animate={shake ? { rotate: [0, -14, 12, -8, 6, 0] } : next ? { rotate: [0, 0, 0, -5, 5, -3, 0] } : { rotate: 0 }}
      transition={shake ? { duration: 0.5 } : next ? { duration: 3, repeat: Infinity } : { duration: 0.2 }}
      key={shake ?? 'still'}
      style={{
        all: 'unset', boxSizing: 'border-box', position: 'relative', cursor: 'pointer', width: size, height: size,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0,
      }}>
      <span style={{
        position: 'relative', width: size, height: size, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: worn ? 'radial-gradient(circle, #e9ffe0 0%, #b9ecaa 100%)' : open ? 'radial-gradient(circle, #fffdf5 0%, #fff1d0 100%)' : 'rgba(255,255,255,0.35)',
        border: worn ? '4px solid #3aa63a' : open ? '3px solid var(--px-ink)' : '3px dashed rgba(42,27,61,0.35)',
        boxShadow: worn ? '0 0 0 3px #fff, 0 4px 0 rgba(42,27,61,0.35)' : open ? '0 4px 0 rgba(42,27,61,0.3)' : 'none',
        opacity: open || next ? 1 : 0.8,
      }}>
        {fresh && !worn && (
          <motion.span aria-hidden="true" animate={{ opacity: [0.35, 0.95, 0.35], scale: [0.96, 1.06, 0.96] }} transition={{ duration: 1.6, repeat: Infinity }}
            style={{ position: 'absolute', inset: -6, borderRadius: 22, boxShadow: '0 0 14px 6px rgba(255,201,60,0.9)', border: '3px solid #ffc93c', pointerEvents: 'none' }} />
        )}
        {open ? <ThingPic item={item} size={size - 10} /> : <Art art="🎁" size={Math.round(size * (next ? 0.66 : 0.58))} style={{ marginTop: -6, pointerEvents: 'none' }} />}
        {worn && (
          <span aria-hidden="true" style={{ position: 'absolute', right: -6, top: -6, width: 26, height: 26, borderRadius: '50%', background: '#3aa63a', border: '3px solid #fff', color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: '20px', textAlign: 'center', boxShadow: '0 2px 0 rgba(42,27,61,0.35)' }}>✓</span>
        )}
        {fresh && !worn && (
          <motion.span aria-hidden="true" animate={{ rotate: [0, 20, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
            style={{ position: 'absolute', right: -8, top: -10, fontSize: 24, lineHeight: 1, pointerEvents: 'none' }}>✨</motion.span>
        )}
        {!open && (
          // the stars it needs, on a little tag
          <span aria-hidden="true" style={{
            position: 'absolute', bottom: next ? 16 : 5, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--px-ink)', color: '#fff', borderRadius: 10, padding: '1px 7px 1px 4px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, lineHeight: '20px',
          }}><PxStar size={15} />{item.stars}</span>
        )}
        {next && (
          // almost there: the bar fills with the stars collected since the last present
          <span aria-hidden="true" data-progress={Math.round(share * 100)} style={{ position: 'absolute', left: 7, right: 7, bottom: 4, height: 11, borderRadius: 6, background: '#fff', overflow: 'hidden', border: '2px solid var(--px-ink)' }}>
            <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, background: 'linear-gradient(90deg, #ffe680, #ffc93c)' }} />
          </span>
        )}
      </span>
    </motion.button>
  )
}
