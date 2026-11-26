import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence, animate, useMotionValue, useTransform, useMotionValueEvent } from 'framer-motion'
import { useApp, profileWardrobeStars } from '../AppContext.jsx'
import { HudBar, PxIcon, PxStar } from '../components/PixelUI.jsx'
import MusicButton from '../components/MusicControls.jsx'
import LumiFigure from '../components/LumiFigure.jsx'
import { ShapeFigure } from '../components/ShapeFigure.jsx'
import { Art, useBursts } from '../components/play/index.js'
import { SHAPES, CHICK, cleanShapes, cleanShape, comingSteps, firstChoiceOwed, shapesOwed, offeredFirst, shapeSrc } from '../lib/shapes.js'
import { asset } from '../lib/assets.js'
import { narrate, stopNarration } from '../narrator.js'
import { sfx } from '../sfx.js'
import { LINES, line } from '../lib/lumiLines.js'

/**
 * Lumi verwandelt sich (lib/shapes.js): who Lumi is. All five shapes stand
 * on a turntable seen a little from above: the one in front is big and in
 * the light, the others smaller and further back. The ring turns with the
 * two big arrows, by dragging or swiping it, with a tap on a shape at the
 * side, and with the arrow keys, endlessly both ways. Turning never changes
 * who Lumi is: under the shape in front a big green tick does (one clear
 * second step); the shape Lumi is now has a ring and a tick instead.
 *
 * One screen for three moments:
 *   first   the free first choice (a new child, a child from before the
 *           shapes): all five in colour, any can be taken
 *   choose  a shape won with stars: the ones not owned are in colour and
 *           can be taken; the ones owned can be chosen as always
 *   place   the shapes owned can be chosen; the ones to come are grey
 *           shadows with a present and the stars at which they come (the
 *           next one's bar fills); one whose stars are reached but that
 *           waits for the next game shows a "play" sign instead
 *
 * Lumi's sentences here (gestalt/…) are recorded; the screen works without
 * them as well (a missing recording is skipped).
 */
const rec = key => (LINES[key] ? line(key) : null)
const N = SHAPES.length
const mod = (a, n) => ((a % n) + n) % n
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

export default function ShapesScreen() {
  const { state, dispatch } = useApp()
  const profile = state.profiles[state.activeProfileId]
  const stars = profileWardrobeStars(profile)
  const owned = cleanShapes(profile?.shapes)
  const current = cleanShape(profile?.shape, profile?.shapes)
  const first = firstChoiceOwed(profile)
  const owed = shapesOwed(profile, stars)
  // fixed when the screen opens: a choice made here turns it into the place
  const [mode, setMode] = useState(() => (first ? 'first' : owed > 0 ? 'choose' : 'place'))
  const coming = comingSteps(profile, stars)

  const chosen = useRef(false)
  const home = () => {
    stopNarration()
    // the free first choice closed without choosing (counted: it stops opening by itself)
    if (mode === 'first' && !chosen.current) dispatch({ type: 'SHAPE_OFFER_CLOSED' })
    dispatch({ type: 'NAVIGATE', payload: 'home' })
  }
  useEffect(() => {
    if (first && profile) offeredFirst.add(profile.id)
    const t = setTimeout(() => { if (mode !== 'place') narrate([rec('gestalt/aussuchen')]) }, 500)
    return () => { clearTimeout(t); stopNarration() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // what a shape is on the ring now
  const kind = id => {
    if (mode === 'first') return 'free'
    if (owned.includes(id)) return id === current ? 'current' : 'owned'
    return mode === 'choose' ? 'free' : 'shadow'
  }

  const [poof, setPoof] = useState(null)
  // a quick second tap on the tick does nothing: the show runs at least 1.2 s
  const lock = useRef(0)
  const choose = id => {
    const k = kind(id)
    if (k === 'current' || k === 'shadow' || Date.now() - lock.current < 1200) return
    lock.current = Date.now()
    stopNarration()
    chosen.current = true
    if (mode === 'first') dispatch({ type: 'SHAPE_FIRST', payload: id })
    else if (k === 'free') dispatch({ type: 'SHAPE_CHOOSE', payload: id })
    else dispatch({ type: 'SHAPE_SET', payload: id })
    setPoof({ id, at: Date.now() })
    setTimeout(() => narrate([rec(`gestalt/${id}`)]), 450)
    if (mode === 'first') setTimeout(home, 2800)
    else if (mode === 'choose') setMode('place')
  }

  const { w, h } = useViewport()
  const hud = w < 521 ? 72 : 80
  const start = Math.max(0, SHAPES.findIndex(s => s.id === (mode === 'choose' ? SHAPES.find(x => !owned.includes(x.id))?.id : current ?? CHICK)))

  return (
    <div data-shapes-screen={mode}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden', overscrollBehavior: 'contain',
        background: 'radial-gradient(ellipse at 50% 70%, #fff6d6 0%, #ffe2a6 45%, #e9b873 100%)' }}>
      <HudBar style={{ position: 'relative', zIndex: 10, minHeight: hud }}>
        <button className="px-btn px-btn--wood px-btn--icon" onClick={home} aria-label="Zur Startseite"><PxIcon name="back" size={20} color="#fff" /></button>
        {/* who Lumi is now */}
        <motion.span key={current ?? 'none'} initial={poof ? { scale: 0.3 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14 }} data-hud-lumi>
          <LumiFigure size={44} style={{ display: 'block' }} />
        </motion.span>
        <span className="px-title hud-hide-sm" style={{ flex: 1, minWidth: 0, fontSize: 'clamp(18px,3vw,28px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Lumi verwandelt sich</span>
        <span className="hud-only-sm" style={{ flex: 1 }} />
        <span className="px-chip" aria-label={`${stars} Sterne`} style={{ fontFamily: 'var(--font-heading)', flexShrink: 0 }}>
          <PxStar size={22} /> {stars}
        </span>
        <MusicButton />
      </HudBar>
      <Ring w={w} h={h - hud} start={start} kind={kind} coming={coming} stars={stars} poof={poof} onChoose={choose} />
    </div>
  )
}

// ── The turntable ───────────────────────────────────────────────────────────
export function Ring({ w, h, start, kind, coming = {}, stars = 0, poof, onChoose, outfit }) {
  const sideways = w > h && h < 500
  const wide = !sideways && (w > h || w >= 700)
  const ACTION = 92
  const stageH = h - ACTION - (sideways ? 6 : 16)
  // the shape in front, and how far the ones behind rise (seen from above;
  // flatter on a phone held sideways)
  const upright = !sideways && !wide
  const front = Math.round(Math.max(110, Math.min(sideways ? stageH * 0.86 : stageH / 1.45, wide ? Math.min(w * 0.36, 380) : w * 0.64, 380)))
  const lift = sideways ? front * 0.1 : upright ? front * 0.56 : front * 0.22
  const R = sideways ? Math.min(w * 0.3, 300)   : wide ? Math.min(w * 0.32, 400) : w * 0.31
  const step = Math.max(80, R * 0.9)    // pixels of drag for one shape

  // the pictures a shape shows when it comes to the front, loaded at once
  // (a shape arriving in front blinked away while its waving picture loaded)
  useEffect(() => {
    for (const s of SHAPES) for (const p of ['idle', 'wave', 'happy']) { const im = new Image(); im.src = asset(shapeSrc(s.id, p)) }
  }, [])
  const rot = useMotionValue(start)
  const [at, setAt] = useState(start)        // the shape in front (index, endless)
  useMotionValueEvent(rot, 'change', v => { const r = Math.round(v); if (r !== at) setAt(r) })
  const frontIdx = mod(at, N)
  const frontShape = SHAPES[frontIdx]
  const reduce = reduceMotion()

  const turnTo = target => {
    sfx.pop()
    if (reduce) { rot.set(target); return }
    animate(rot, target, { type: 'spring', stiffness: 170, damping: 22 })
  }
  const turn = d => turnTo(Math.round(rot.get()) + d)
  // a shape at the side: the shortest way round to it
  const bring = i => {
    const r = Math.round(rot.get())
    let d = mod(i - r, N)
    if (d > N / 2) d -= N
    if (d) turnTo(r + d)
  }

  // keys
  useEffect(() => {
    const on = e => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); turn(-1) }
      if (e.key === 'ArrowRight') { e.preventDefault(); turn(1) }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  })

  // dragging: the ring follows the finger and snaps to the nearest shape; a
  // quick swipe turns it by one; a touch that hardly moves is a tap
  const drag = useRef(null)
  const down = e => {
    if (e.button !== undefined && e.button !== 0) return
    drag.current = { x: e.clientX, r: rot.get(), t: Date.now(), moved: false, target: e.target }
    rot.stop()
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }
  const move = e => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x
    if (Math.abs(dx) > 8) d.moved = true
    if (d.moved) rot.set(d.r - dx / step)
  }
  const up = e => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) {
      const item = d.target?.closest?.('[data-ring-item]')
      if (item) {
        const i = +item.dataset.ringItem
        if (i === mod(Math.round(rot.get()), N)) frontTap(SHAPES[i].id)
        else bring(i)
      }
      return
    }
    const dx = e.clientX - d.x
    let target = Math.round(rot.get())
    const quick = Date.now() - d.t < 350 && Math.abs(dx) > 30
    if (quick && target === Math.round(d.r)) target = Math.round(d.r) - Math.sign(dx)
    turnTo(target)
  }

  // the shape in front tapped: a shadow shakes and shows the missing stars
  const [shake, setShake] = useState(null)
  const [wish, setWish] = useState(null)
  const wishTimer = useRef(null)
  const told = useRef(false)
  useEffect(() => () => clearTimeout(wishTimer.current), [])
  const frontTap = id => {
    if (kind(id) !== 'shadow') return
    setShake(id + Date.now())
    sfx.bump()
    setWish(id)
    clearTimeout(wishTimer.current)
    wishTimer.current = setTimeout(() => setWish(null), 2600)
    if (!told.current) { told.current = true; narrate([rec('schrank/eingepackt')]) }
  }
  useEffect(() => { setWish(null) }, [frontIdx])

  const [bursts, burst] = useBursts()
  const frontRef = useRef(null)
  useEffect(() => {
    if (!poof) return
    sfx.whoosh()
    const t = setTimeout(() => { sfx.sparkle(); burst(frontRef.current, 'stars', 14) }, 250)
    return () => clearTimeout(t)
  }, [poof]) // eslint-disable-line react-hooks/exhaustive-deps

  const k = kind(frontShape.id)
  // the feet of the shape in front: the ring in the middle of its room
  const above = Math.max(front * 1.04, 2 * lift + front * 0.5), below = front * 0.16
  const base = Math.round(Math.min(stageH - below, (stageH + above - below) / 2 + (upright ? stageH * 0.12 : 0)))
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div data-ring={frontShape.id} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; turn(0) }}
        role="group" aria-roledescription="Karussell" aria-label="Lumis Figuren"
        style={{ position: 'relative', height: stageH, marginTop: sideways ? 4 : 12, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', cursor: 'grab', overflow: 'visible' }}>
        {/* the turntable */}
        <div aria-hidden="true" style={{
          position: 'absolute', left: '50%', top: base - lift * 2 - front * 0.13, width: Math.min(w - 12, R * 2 + front * 0.7), height: lift * 2 + front * 0.27, transform: 'translateX(-50%)',
          borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 40%, #d8f0b8 0%, #a8d982 60%, #7fb85c 100%)', border: '4px solid var(--px-ink)', boxShadow: '0 8px 0 rgba(42,27,61,0.25)',
        }} />
        {/* the light on the one in front */}
        <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: base - front * 0.12, width: front * 0.9, height: front * 0.22, transform: 'translateX(-50%)', borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,240,170,0.95) 0%, rgba(255,240,170,0) 72%)' }} />
        {SHAPES.map((s, i) => (
          <RingItem key={s.id} i={i} shape={s} rot={rot} R={R} fall={upright ? 2 : 1.3} lift={lift} size={front} base={base} cx={w / 2} reduce={reduce}
            front={i === frontIdx} kind={kind(s.id)} coming={coming[s.id]} stars={stars} shake={shake?.startsWith(s.id) ? shake : null}
            poof={poof?.id === s.id ? poof.at : null} innerRef={i === frontIdx ? frontRef : null} outfit={outfit} />
        ))}
        {/* the stars still missing, beside the shadow in front */}
        {wish && coming[wish]?.step && (
          <div style={{ position: 'absolute', left: '50%', top: Math.max(4, base - front - 46), transform: 'translateX(-50%)', zIndex: 300, pointerEvents: 'none' }}>
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }} data-wish={coming[wish].step - stars}
              style={{ background: '#fffdf7', border: '3px solid var(--px-ink)', borderRadius: 16, padding: '6px 10px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)' }}>
              <StarsNeeded c={coming[wish]} stars={stars} />
            </motion.div>
          </div>
        )}
        {/* the arrows beside the ring; on a phone held upright they sit in the row of the tick */}
        {!upright && <Arrow side="left" onClick={() => turn(-1)} top={base - front * 0.55} sideways={sideways} />}
        {!upright && <Arrow side="right" onClick={() => turn(1)} top={base - front * 0.55} sideways={sideways} />}
      </div>
      {/* under the shape in front: the green tick, or nothing for Lumi now */}
      <div style={{ height: ACTION, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 20 }}>
        {upright && <Arrow side="left" onClick={() => turn(-1)} top={ACTION / 2} sideways />}
        {upright && <Arrow side="right" onClick={() => turn(1)} top={ACTION / 2} sideways />}
        <AnimatePresence mode="wait">
          {(k === 'free' || k === 'owned') && (
            <motion.button key={`ok-${frontShape.id}`} type="button" onClick={() => onChoose(frontShape.id)} aria-label={`${frontShape.name}: so soll Lumi aussehen`} data-confirm={frontShape.id}
              initial={{ scale: 0 }} animate={{ scale: [1, 1.08, 1] }} exit={{ scale: 0, transition: { duration: 0.12 } }}
              transition={{ scale: { duration: 1.2, repeat: Infinity, delay: 0.3 } }} whileTap={{ scale: 0.9 }}
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', width: 76, height: 76, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #8fe87e, #3aa63a 70%)', border: '4px solid var(--px-ink)', boxShadow: '0 5px 0 rgba(42,27,61,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg viewBox="0 0 24 24" width="44" height="44" aria-hidden="true"><path d="M4.5 12.5 L10 18 L19.5 6.5" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      {bursts}
    </div>
  )
}

/** A big arrow that turns the ring by one. */
function Arrow({ side, onClick, top, sideways }) {
  const left = side === 'left'
  return (
    <motion.button type="button" onClick={onClick} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
      aria-label={left ? 'Nach links drehen' : 'Nach rechts drehen'} data-turn={side} whileTap={{ scale: 0.88 }}
      style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'absolute', top: top - 32, [side]: sideways ? 14 : 'clamp(8px, 2.5vw, 28px)', zIndex: 250,
        width: 64, height: 64, borderRadius: '50%', background: '#ffc93c', border: '4px solid var(--px-ink)', boxShadow: '0 5px 0 rgba(42,27,61,0.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg viewBox="0 0 24 24" width="36" height="36" aria-hidden="true">
        <path d={left ? 'M15 4.5 L7.5 12 L15 19.5' : 'M9 4.5 L16.5 12 L9 19.5'} stroke="#2a1b3d" strokeWidth="3.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </motion.button>
  )
}

/** One shape on the ring: placed by its angle, always upright, never mirrored. */
function RingItem({ i, shape, rot, R, fall, lift, size, base, cx, reduce, front, kind, coming, stars, shake, poof, innerRef, outfit }) {
  const ang = v => (i - v) * 2 * Math.PI / N
  const depth = v => (Math.cos(ang(v)) + 1) / 2              // 1 in front, 0 at the back
  const x = useTransform(rot, v => cx + Math.sin(ang(v)) * R - size / 2)
  const y = useTransform(rot, v => base - size - (1 - depth(v)) * 2 * lift)
  const scale = useTransform(rot, v => 0.42 + 0.58 * Math.pow(depth(v), fall))
  const zIndex = useTransform(rot, v => Math.round(depth(v) * 100))
  const shadow = kind === 'shadow'
  const mood = front ? (kind === 'current' ? 'happy' : 'wave') : 'idle'
  return (
    <motion.div data-ring-item={i} data-shape={shape.id} data-kind={kind} data-front={front ? '1' : undefined} ref={innerRef}
      aria-label={shadow ? `Geschenk${coming?.step ? `, ${coming.step} Sterne` : ''}` : `${shape.name}${kind === 'current' ? ', das ist Lumi' : ''}`}
      style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, x, y, scale, zIndex, transformOrigin: '50% 100%', cursor: front ? 'default' : 'pointer' }}>
      <motion.div key={front ? `f${reduce ? i : ''}` : 'b'} initial={reduce && front ? { opacity: 0 } : false} animate={reduce ? { opacity: 1 } : undefined}
        style={{ width: '100%', height: '100%', position: 'relative' }}>
        {/* Lumi now: a green ring on the floor and a tick */}
        {kind === 'current' && (
          <span aria-hidden="true" style={{ position: 'absolute', left: '12%', right: '12%', bottom: '-3%', height: '13%', borderRadius: '50%', border: '5px solid #3aa63a', boxShadow: '0 0 0 3px #fff' }} />
        )}
        <motion.div key={shake ?? (front ? 'front' : 'side')}
          animate={shake ? { rotate: [0, -10, 9, -6, 4, 0] } : front && !shadow && !reduce ? { y: [0, -size * 0.1, 0, -size * 0.04, 0] } : {}}
          transition={{ duration: shake ? 0.5 : 0.8, ease: 'easeOut' }}
          style={{ width: '100%', height: '100%', transformOrigin: '50% 100%', filter: shadow ? 'none' : 'drop-shadow(0 4px 0 rgba(42,27,61,0.2))' }}>
          {shadow
            // a shape to come: a light grey shadow, smaller than the shapes owned
            ? <ShapeFigure id={shape.id} size={size} style={{ display: 'block', filter: 'brightness(0) invert(0.86)', transform: 'scale(0.84)', transformOrigin: '50% 100%' }} />
            : shape.id === CHICK
              ? <LumiFigure shape={null} outfit={outfit} mood={mood} size={size} style={{ display: 'block' }} />
              : <ShapeFigure id={shape.id} mood={mood} size={size} style={{ display: 'block' }} />}
        </motion.div>
        {kind === 'current' && (
          <span aria-hidden="true" style={{ position: 'absolute', right: '6%', top: '8%', width: Math.max(30, size * 0.16), height: Math.max(30, size * 0.16), borderRadius: '50%', background: '#3aa63a', border: '3px solid #fff', color: '#fff', fontWeight: 800, fontSize: Math.max(18, size * 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 0 rgba(42,27,61,0.35)' }}>✓</span>
        )}
        {shadow && <ShadowSign c={coming} stars={stars} size={size} />}
        {poof && <Poof key={poof} size={size} />}
      </motion.div>
    </motion.div>
  )
}

/** A shape still to come: a present, and the stars at which it comes (or "after a game"). */
function ShadowSign({ c, stars, size }) {
  if (!c) return null
  const share = c.next ? Math.max(0, Math.min(1, (stars - c.from) / Math.max(1, c.step - c.from))) : 0
  return (
    <>
      <motion.span aria-hidden="true" animate={c.waits ? { scale: [1, 1.08, 1] } : {}} transition={{ duration: 1.2, repeat: Infinity }}
        style={{ position: 'absolute', right: '8%', bottom: '18%', filter: c.waits ? 'drop-shadow(0 0 10px rgba(255,214,90,1))' : undefined }}>
        <Art art="🎁" size={Math.round(size * 0.3)} />
      </motion.span>
      {c.waits ? (
        // its stars are there: it comes after the next game (a play sign, as on the home screen's "Spielen!")
        <span aria-hidden="true" data-waits style={{ position: 'absolute', left: '50%', bottom: '8%', transform: 'translateX(-50%)', width: Math.max(44, size * 0.2), height: Math.max(44, size * 0.2), borderRadius: '50%', background: '#5cc45a', border: '4px solid var(--px-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 0 rgba(42,27,61,0.35)' }}>
          <PxIcon name="play" size={Math.max(20, size * 0.09)} color="#fff" />
        </span>
      ) : c.step ? (
        <>
          <span aria-hidden="true" data-step={c.step} style={{
            position: 'absolute', left: '50%', bottom: c.next ? '11%' : '6%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--px-ink)', color: '#fff', borderRadius: 12, padding: '2px 10px 2px 5px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: Math.max(16, size * 0.08), lineHeight: 1.3,
          }}><PxStar size={Math.max(16, size * 0.08)} />{c.step}</span>
          {c.next && (
            <span aria-hidden="true" data-progress={`${Math.round(share * 100)}%`} style={{ position: 'absolute', left: '22%', right: '22%', bottom: '3%', height: Math.max(10, size * 0.045), borderRadius: 6, background: '#fff', overflow: 'hidden', border: '2px solid var(--px-ink)' }}>
              <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, background: 'linear-gradient(90deg, #ffe680, #ffc93c)' }} />
            </span>
          )}
        </>
      ) : null}
    </>
  )
}

/** Lumi turns into another shape: a puff of cloud. */
function Poof({ size }) {
  const puffs = [[-0.28, -0.1], [0.26, -0.14], [0, -0.32], [-0.18, 0.12], [0.2, 0.1], [0, 0]]
  return (
    <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, pointerEvents: 'none', zIndex: 5 }}>
      {puffs.map(([dx, dy], i) => (
        <motion.span key={i} initial={{ scale: 0.2, opacity: 0.95, x: -size * 0.17, y: -size * 0.17 }}
          animate={{ scale: [0.2, 1.25, 1.4], opacity: [0.95, 0.9, 0], x: dx * size - size * 0.17, y: dy * size - size * 0.17 }}
          transition={{ duration: 0.9, delay: i * 0.03, ease: 'easeOut' }}
          style={{ position: 'absolute', width: size * 0.34, height: size * 0.34, borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%, #fff 0%, #f4f1ff 60%, #d9d2f0 100%)' }} />
      ))}
    </div>
  )
}

/** The stars still missing: up to five as outlines to count, more as a bar up to the number. */
function StarsNeeded({ c, stars }) {
  const n = c.step - stars
  const share = Math.max(0, Math.min(1, (stars - c.from) / Math.max(1, c.step - c.from)))
  if (c.waits) return (
    <span role="img" aria-label="Nach dem nächsten Spiel" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 34, height: 34, borderRadius: '50%', background: '#5cc45a', border: '3px solid var(--px-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><PxIcon name="play" size={16} color="#fff" /></span>
    </span>
  )
  if (n > 5 || !c.next) return (
    <span role="img" aria-label={`Noch ${n} Sterne`} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, lineHeight: '24px', color: 'var(--px-ink)', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'block', width: 64, height: 12, borderRadius: 6, background: '#fff', overflow: 'hidden', border: '2px solid var(--px-ink)' }}>
        <span style={{ display: 'block', height: '100%', width: `${(c.next ? share : 0) * 100}%`, background: 'linear-gradient(90deg, #ffe680, #ffc93c)' }} />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><PxStar size={22} />{c.step}</span>
    </span>
  )
  return (
    <span role="img" aria-label={`Noch ${n} Sterne`} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: n }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" width={24} height={24} style={{ display: 'block' }}>
          <path d="M12 2l3 6.3 6.9.9-5 4.8 1.3 6.8L12 17.5l-6.2 3.3 1.3-6.8-5-4.8 6.9-.9z" fill="#fff" stroke="#2a1b3d" strokeWidth="2" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
}

