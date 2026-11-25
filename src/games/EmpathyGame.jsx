import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, MotionConfig, useAnimationControls } from 'framer-motion'
import { Art, HintHand, useBursts } from '../components/play/index.js'
import { narrate, afterNarration, leaveGame } from '../narrator.js'
import { sayRight, sayWrong, announce, newQuestion } from '../lib/feedback.js'
import { feelingWord } from '../lib/words.js'
import { playAnimal } from '../lib/animalSounds.js'
import { usePaused } from '../lib/pause.js'
import { result } from '../lib/score.js'
import { sfx } from '../sfx.js'
import { BRIGHT, shuffle } from './feelings.js'
import { SignFace } from './gefuehle/faces.jsx'
import { INK, pxCard } from './px.js'
import Pal, { reduceMotion } from './detektiv/Pal.jsx'
import { CASES, StageCtx, SH, GROUND, FRIEND, holdNode, squeeze, squeezeFor } from './detektiv/cases.jsx'
import { ACTIONS, CardArt, Haha, Zig } from './detektiv/actions.jsx'
import { say } from './detektiv/script.js'

/**
 * Gefühlsdetektiv — little cases, told and played.
 *
 * Something happens to an animal friend, in front of the child: the ice
 * cream falls off the cone, the tower tumbles, it thunders, a present
 * arrives. Then two questions, always the same two:
 *
 *   1. How does the friend feel?  The child taps the face that fits.
 *   2. What is good now?          The child taps a picture card, and Lumi
 *      does it. Every card plays out: the helpful one makes the friend glad
 *      again, an unkind one visibly makes it worse, one that does not fit
 *      changes nothing — and the child chooses again.
 *
 * Each solved case puts a heart into the detective's case book. A case
 * counts when both the feeling and the help were right at the first try.
 *
 * Gefühlswelt is about spotting a face quickly; here it is the reason for
 * a feeling and what to do about it (perspective taking and the prosocial
 * answer: Wellman's theory of mind; Eisenberg on prosocial behaviour).
 *
 * The cases are in detektiv/cases.jsx, the cards in detektiv/actions.jsx,
 * what Lumi says in detektiv/script.js.
 */

// ── Levels ────────────────────────────────────────────────────────────────
// `cases` how many of each tier (1: glücklich, traurig, wütend, ängstlich;
// 2: traurig, stolz, müde, with überrascht among the faces; 3: verlegen,
// gelangweilt, aufgeregt, neugierig), `chips` faces to choose from, `cards`
// picture cards.
// `contrast`: the other face is the opposite kind of feeling. `odd`: one
// card is kind but does not fit this case.
export const LEVELS = [
  { cases: [4, 0, 0], chips: 2, cards: 2, contrast: true, each: true },
  { cases: [4, 0, 0], chips: 2, cards: 2 },
  { cases: [4, 0, 0], chips: 3, cards: 3 },
  { cases: [3, 2, 0], chips: 3, cards: 3 },
  { cases: [2, 3, 0], chips: 3, cards: 3 },
  { cases: [2, 3, 0], chips: 4, cards: 3 },
  { cases: [2, 2, 2], chips: 4, cards: 3, odd: true },
  { cases: [1, 2, 3], chips: 4, cards: 3, odd: true },
  { cases: [1, 2, 3], chips: 4, cards: 3, odd: true },
  { cases: [0, 2, 4], chips: 4, cards: 3, odd: true },
]
const TIER_FEELINGS = [
  ['Glücklich', 'Traurig', 'Wütend', 'Ängstlich'],
  ['Überrascht', 'Stolz', 'Müde'],
  ['Verlegen', 'Gelangweilt', 'Aufgeregt', 'Neugierig'],
]
// Never offered next to each other: both could be said of the same friend
// (proud is glad, too; a burst balloon startles and frightens; the shy face
// smiles; "aufgeregt" is also the jitters). The same pairs as TOO_CLOSE in
// gefuehle/rounds.js, as the faces are the same. What holds for one case
// only is its `notWith` (detektiv/cases.jsx).
const ALIKE = [['Glücklich', 'Stolz', 'Aufgeregt'], ['Ängstlich', 'Überrascht'], ['Traurig', 'Verlegen'], ['Traurig', 'Gelangweilt'], ['Überrascht', 'Neugierig'],
  ['Glücklich', 'Verlegen'], ['Ängstlich', 'Aufgeregt'], ['Überrascht', 'Aufgeregt'], ['Müde', 'Gelangweilt']]
const alike = (a, b) => ALIKE.some(g => g.includes(a) && g.includes(b))

// Which cases were played last, so a level played again brings other ones
const RECENT_KEY = 'lumilearn_detektiv_recent'
const readRecent = () => { try { const r = JSON.parse(localStorage.getItem(RECENT_KEY)); return Array.isArray(r) ? r : [] } catch { return [] } }
/** Remember the cases of the level that is being played now. */
function remember(ids) {
  try { localStorage.setItem(RECENT_KEY, JSON.stringify([...readRecent().filter(id => !ids.includes(id)), ...ids].slice(-11))) } catch { /* private mode */ }
}

/** The cases of a level: none twice, longest-not-played first, animals and feelings mixed. */
function pickCases(cfg) {
  const recent = readRecent()
  const age = k => recent.lastIndexOf(k.id)                  // -1: not played lately
  const chosen = []
  cfg.cases.forEach((n, t) => {
    const pool = shuffle(CASES.filter(k => k.tier === t + 1)).sort((a, b) => age(a) - age(b))
    for (let i = 0; i < n && pool.length; i++) {
      // at first one case of each feeling; later rather an animal not yet seen in this level
      const fresh = pool.findIndex(k => !chosen.some(c => c.kind === k.kind) && !(cfg.each && chosen.some(c => c.feeling === k.feeling)))
      const byFeeling = cfg.each ? pool.findIndex(k => !chosen.some(c => c.feeling === k.feeling)) : -1
      chosen.push(pool.splice(fresh > -1 ? fresh : byFeeling > -1 ? byFeeling : 0, 1)[0])
    }
  })
  // easier cases first, never the same feeling twice in a row
  const order = shuffle(chosen).sort((a, b) => a.tier - b.tier)
  for (let i = 1; i < order.length; i++) {
    if (order[i].feeling !== order[i - 1].feeling) continue
    const j = order.findIndex((x, n) => n > i && x.feeling !== order[i - 1].feeling)
    if (j > -1) [order[i], order[j]] = [order[j], order[i]]
  }
  return order
}

/** A case with its faces and cards for this level. */
export function buildRound(k, cfg, level) {
  const tiers = level <= 3 ? 1 : level <= 6 ? 2 : 3
  const others = TIER_FEELINGS.slice(0, tiers).flat().filter(f => f !== k.feeling && !alike(f, k.feeling) && !k.notWith.includes(f))
  const opposite = others.filter(f => BRIGHT.has(f) !== BRIGHT.has(k.feeling))
  const wrong = shuffle(cfg.contrast && opposite.length ? opposite : others).slice(0, cfg.chips - 1)
  const good = shuffle(k.good)[0]
  const mean = shuffle(k.mean), odd = shuffle(k.odd)
  const bad = (cfg.odd ? [mean[0], odd[0]] : mean).slice(0, cfg.cards - 1)
  return { ...k, chips: shuffle([k.feeling, ...wrong]), good1: good, cards: shuffle([good, ...bad]) }
}

// ── Time that stands still while the game is paused ───────────────────────
function useClock() {
  const paused = usePaused()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const [clock] = useState(() => {
    let now = 0, queue = [], last = 0, timer = null
    const tick = () => {
      const t = performance.now()
      if (!pausedRef.current) now += t - last
      last = t
      const due = queue.filter(q => q.at <= now).sort((a, b) => a.at - b.at)
      queue = queue.filter(q => q.at > now)
      due.forEach(q => q.fn())
      if (!queue.length) { clearInterval(timer); timer = null }
    }
    return {
      after(ms, fn) {
        if (!timer) { last = performance.now(); timer = setInterval(tick, 40) }
        queue.push({ at: now + ms, fn })
      },
      clear() { queue = []; clearInterval(timer); timer = null },
    }
  })
  useEffect(() => () => clock.clear(), [clock])
  return clock
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => setSize(s => (s.w === el.clientWidth && s.h === el.clientHeight ? s : { w: el.clientWidth, h: el.clientHeight }))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

// the stage is never narrower than this (in its own measure); below 480 the scene is squeezed
const MIN_SW = 400

// Stage beside the cards on a screen that is wide and low (a phone held
// sideways), above them everywhere else
function layout(w, h, chips, cards) {
  const small = w < 500
  const pad = small ? 8 : 14
  if (w / h > 1.9) {
    const trayW = Math.min(520, Math.max(400, w * 0.36))
    const stW = w - trayW - pad * 3, stH = h - pad * 2
    const scale = Math.min(stH / SH, stW / MIN_SW)
    return { wide: true, pad, bookH: 64, trayW, scale, sw: Math.min(760, stW / scale),
      card: Math.min(190, Math.floor((trayW - (cards - 1) * 10) / cards - 4)), chip: Math.min(140, Math.floor((trayW - (chips - 1) * 10) / chips - 2)) }
  }
  const bookH = small ? 54 : 62
  const stW = w - pad * 2, stH = h - bookH - 176 - pad * 4
  const scale = Math.max(0.4, Math.min(stH / SH, stW / MIN_SW, 1.5))
  const trayH = Math.min(300, h - bookH - SH * scale - pad * 4)
  return { wide: false, pad, bookH, trayH, scale, sw: Math.min(760, stW / scale),
    card: Math.floor(Math.min(trayH - 44, (stW - (cards - 1) * 10) / cards - 2, 170)), chip: Math.floor(Math.min(trayH - 60, (stW - (chips - 1) * 8) / chips - 2, 116)) }
}

// ── Things that fly across the screen: a face to the friend, a heart into the book
function useFlies() {
  const [list, setList] = useState([])
  const fly = useCallback((from, to, node, onDone) => {
    const a = from?.getBoundingClientRect?.(), b = to?.getBoundingClientRect?.()
    if (!a || !b || reduceMotion()) { onDone?.(); return }
    const id = Math.random()
    const done = () => { setList(l => l.filter(f => f.id !== id)); onDone?.() }
    setList(l => [...l, { id, node, done, x0: a.left + a.width / 2, y0: a.top + a.height / 2, x1: b.left + b.width / 2, y1: b.top + b.height / 2, s0: a.width, s1: b.width }])
  }, [])
  const layer = typeof document === 'undefined' ? null : createPortal(list.map(f => (
    <motion.div key={f.id} aria-hidden="true" initial={{ x: f.x0, y: f.y0, scale: 1 }} animate={{ x: f.x1, y: [f.y0, Math.min(f.y0, f.y1) - 50, f.y1], scale: f.s1 / f.s0 }}
      transition={{ duration: 0.55, ease: 'easeInOut' }} onAnimationComplete={f.done}
      style={{ position: 'fixed', left: 0, top: 0, width: 0, height: 0, zIndex: 9996, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ flexShrink: 0, width: f.s0, height: f.s0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{f.node}</div>
    </motion.div>
  )), document.body)
  return [layer, fly]
}

// A short move of the whole body on top of the feeling: a hop, a shake of
// the head, leaning over. `react.n` counts up for each one.
const MOVES = {
  hop:   [{ y: [0, -36, 0, -18, 0] }, { duration: 0.75 }],
  no:    [{ rotate: [0, -10, 10, -8, 8, 0] }, { duration: 0.75 }],
  sink:  [{ y: [0, 8, 3], scale: [1, 0.92, 0.96] }, { duration: 0.6 }],
  lean:  [{ rotate: [0, -8, -8, 0], x: [0, -8, -8, 0] }, { duration: 1.5, times: [0, 0.15, 0.85, 1] }],
  reach: [{ rotate: [0, -9, -9, 0], x: [0, -14, -14, 0] }, { duration: 1.4, times: [0, 0.2, 0.8, 1] }],
}
function Mover({ react, children }) {
  const controls = useAnimationControls()
  useEffect(() => {
    if (!react?.n || reduceMotion()) return
    const [to, transition] = MOVES[react.type] ?? MOVES.hop
    controls.start({ ...to, transition })
  }, [react?.n]) // eslint-disable-line react-hooks/exhaustive-deps
  return <motion.div animate={controls} style={{ transformOrigin: '50% 100%' }}>{children}</motion.div>
}

const heldBy = hold => (hold ? { node: holdNode(Array.isArray(hold) ? hold[0] : hold), at: Array.isArray(hold) ? hold[1] : 'holdR' } : undefined)
// the heavy feelings take the colour out of a friend; help brings it back
const PALE = new Set(['sad', 'scared', 'tired', 'shy', 'bored'])
const HELPER = 112

// ── The stage ─────────────────────────────────────────────────────────────
function Stage({ k, sw, scale, pv, friend, react, helper, gift, phase, named, tag, onLook, onPoke, friendRef, slotRef, lookRef }) {
  const fx = sw / 2
  const q = squeezeFor(sw)
  const ctx = useMemo(() => ({ fx, pv, q }), [fx, pv, q])
  const X = dx => fx + squeeze(dx, q)
  // Lumi stays on the stage while it is doing something (further out it is walking in or away)
  const lumiX = dx => (Math.abs(dx) > 300 ? X(dx) : Math.max(HELPER / 2 + 2, Math.min(sw - HELPER / 2 - 2, X(dx))))
  const room = k.bg === 'room'
  const sat = PALE.has(friend.feel) ? (friend.strength >= 2 ? 0.35 : 0.6) : 1
  return (
    <div style={{ width: sw * scale, height: SH * scale, flexShrink: 0, position: 'relative', borderRadius: 26, overflow: 'hidden', boxSizing: 'border-box',
      boxShadow: `0 0 0 4px ${INK}, 0 8px 0 3px rgba(42,27,61,.28)` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: sw, height: SH, transform: `scale(${scale})`, transformOrigin: '0 0',
        background: room ? 'repeating-linear-gradient(90deg, #ffe9c6 0 34px, #ffe1b3 34px 68px)' : 'linear-gradient(#a9deff, #e6f7ff 78%)' }}>
        {!room && <>
          <div style={{ position: 'absolute', left: '-12%', width: '70%', height: 150, bottom: GROUND - 40, borderRadius: '50%', background: '#b5e49a' }} />
          <div style={{ position: 'absolute', right: '-18%', width: '80%', height: 170, bottom: GROUND - 70, borderRadius: '50%', background: '#a4dc8a' }} />
        </>}
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: GROUND + 16, zIndex: 2, boxSizing: 'border-box',
          background: room ? '#d99e62' : '#7fcb5c', borderTop: `6px solid ${room ? '#b87a42' : '#62b545'}` }} />

        <StageCtx.Provider value={ctx}><k.Scene /></StageCtx.Provider>

        {/* the friend */}
        <div ref={friendRef} onClick={onPoke} style={{ position: 'absolute', left: fx - FRIEND / 2, bottom: GROUND - 6, width: FRIEND, zIndex: 5, cursor: 'pointer',
          filter: `saturate(${sat}) brightness(${friend.dim ? 0.5 : 1})`, transition: 'filter .8s' }}>
          <Mover react={react}>
            <Pal kind={k.kind} feel={friend.feel} strength={friend.strength} size={FRIEND} arms={friend.arms} hold={heldBy(friend.hold)} cover={friend.cover} />
          </Mover>
        </div>

        {/* the face the child found for it */}
        {tag && (
          <motion.div ref={slotRef} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 16 }}
            style={{ position: 'absolute', left: fx + (k.tag?.[0] ?? 0) - 31, bottom: GROUND + (k.tag?.[1] ?? 190), width: 62, height: 62, zIndex: 8, borderRadius: '50%', boxSizing: 'border-box',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: named ? '#fffdf7' : 'rgba(255,253,247,.7)', border: named ? `3px solid ${INK}` : `4px dashed ${INK}`,
              boxShadow: named ? '0 0 0 4px #ffc93c, 0 5px 0 rgba(42,27,61,.3)' : 'none' }}>
            {named && <Face feeling={k.feeling} size={58} />}
          </motion.div>
        )}

        {/* Lumi, doing what the child chose */}
        {helper.on && (
          <motion.div initial={false} animate={{ x: lumiX(helper.dx) - HELPER / 2 }} transition={{ duration: helper.slow ? 1.5 : 0.8, ease: 'easeInOut' }}
            style={{ position: 'absolute', left: 0, bottom: GROUND - 8, width: HELPER, zIndex: helper.back ? 3 : 6 }}>
            <motion.div animate={helper.walk && !reduceMotion() ? { y: [0, -9, 0], rotate: [0, -3, 3, 0] } : { y: 0, rotate: 0 }}
              transition={helper.walk ? { duration: 0.34, repeat: Infinity } : { duration: 0.15 }} style={{ transformOrigin: '50% 100%' }}>
              <Mover react={{ type: 'hop', n: helper.hop }}>
                <Pal kind="lumi" hat feel={helper.feel} arms={helper.arms} flip={helper.flip} size={HELPER} hold={heldBy(helper.hold)} />
              </Mover>
            </motion.div>
            {helper.extra === 'haha' && <motion.div animate={{ scale: [0.8, 1.15, 0.8], rotate: [-6, 6, -6] }} transition={{ duration: 0.5, repeat: Infinity }} style={{ position: 'absolute', left: HELPER - 24, top: -34 }}><Haha u={1.25} /></motion.div>}
            {helper.extra === 'zig' && <motion.div animate={{ scale: [0.85, 1.15, 0.85] }} transition={{ duration: 0.35, repeat: Infinity }} style={{ position: 'absolute', left: HELPER - 20, top: -30 }}><Zig u={1.25} /></motion.div>}
            {helper.extra === 'bye' && <div style={{ position: 'absolute', left: HELPER - 30, top: 0 }}><Art art="👋" size={44} /></div>}
          </motion.div>
        )}

        {/* what flies between the two: an ice cream, a ball, a blanket */}
        {gift && (
          <motion.div key={gift.n} initial={{ x: X(gift.from[0]), y: -gift.from[1] }}
            animate={{ x: X(gift.to[0]), y: [-gift.from[1], -(Math.max(gift.from[1], gift.to[1]) + (gift.low ? 34 : 56)), -gift.to[1]] }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            style={{ position: 'absolute', left: 0, bottom: GROUND, width: 0, height: 0, zIndex: 8, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <div style={{ flexShrink: 0 }}>{holdNode(gift.item)}</div>
          </motion.div>
        )}

        {/* the magnifying glass: look closely, and the case begins */}
        <AnimatePresence>
          {phase === 'look' && (
            <motion.button key="look" ref={lookRef} type="button" onClick={onLook} aria-label="Genau hinschauen"
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 2.2, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }}
              style={{ all: 'unset', position: 'absolute', left: fx - 176, bottom: GROUND + 34, width: 124, height: 124, zIndex: 9, cursor: 'pointer', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <motion.span aria-hidden="true" animate={reduceMotion() ? {} : { scale: [1, 1.35], opacity: [0.9, 0] }} transition={{ duration: 1.1, repeat: Infinity }}
                style={{ position: 'absolute', inset: 6, borderRadius: '50%', border: '6px solid #ffc93c' }} />
              <motion.span animate={reduceMotion() ? {} : { rotate: [-8, 8, -8], y: [0, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity }}
                style={{ display: 'flex', filter: 'drop-shadow(0 5px 0 rgba(42,27,61,.3))' }}>
                <Art art="🔍" size={112} style={{ transform: 'scaleX(-1)' }} />
              </motion.span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * The face of a feeling: the face of Lumi's sign in Gefühlswelt, so that a
 * feeling looks the same in both games (the emoji read differently: 😳 as
 * shocked, 🤔 as thinking). Stolz wears its medal.
 */
function Face({ feeling, size }) {
  return (
    <span style={{ display: 'inline-flex', width: size, height: size, flexShrink: 0 }}>
      <SignFace feeling={feeling} size={size} />
    </span>
  )
}

// a face or card that did not fit: greyed out, still there
const TRIED = { background: '#d6d1dc', frame: '#8f889b', inside: { opacity: 0.4, filter: 'grayscale(1)' } }
const LABEL = { fontFamily: 'var(--font-heading)', fontWeight: 700, color: INK, lineHeight: 1.05, textAlign: 'center', textShadow: '0 1px 0 #fff, 0 0 6px #fff' }

/** A face to choose: says its word when tapped. */
function FeelChip({ feeling, size, state, hint, onPick, delay, fits }) {
  const off = state === 'tried' || state === 'locked'
  return (
    <motion.button type="button" onClick={off ? undefined : onPick} disabled={off} aria-label={feeling} data-chip={feeling} data-fits={fits ? '1' : undefined} data-hint={hint ? '' : undefined}
      initial={{ y: 40, opacity: 0, scale: 0.6 }} animate={state === 'miss' ? { y: 0, opacity: 1, scale: 1, x: [0, -9, 9, -7, 7, 0] } : { y: 0, opacity: state === 'gone' ? 0 : 1, scale: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20, delay, x: { duration: 0.45 } }} whileTap={off ? undefined : { scale: 0.9 }}
      style={{ all: 'unset', cursor: off ? 'default' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, WebkitTapHighlightColor: 'transparent' }}>
      <motion.span data-face="" animate={hint && !reduceMotion() ? { scale: [1, 1.1, 1] } : { scale: 1 }} transition={hint ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
        style={{ width: size, height: size, boxSizing: 'border-box', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: state === 'tried' ? TRIED.background : '#fffdf7', border: `3px solid ${state === 'tried' ? TRIED.frame : INK}`,
          boxShadow: hint ? '0 0 0 5px #ffc93c, 0 5px 0 rgba(42,27,61,.3)' : state === 'tried' ? 'none' : '0 5px 0 rgba(42,27,61,.3)' }}>
        <span style={{ display: 'flex', ...(state === 'tried' ? TRIED.inside : null) }}><Face feeling={feeling} size={size * 0.96} /></span>
      </motion.span>
      <span style={{ ...LABEL, fontSize: Math.max(13, Math.min(17, size * 0.19)), opacity: state === 'tried' ? 0.4 : 1 }}>{feeling}</span>
    </motion.button>
  )
}

/** A picture card: what Lumi could do now. */
function HelpCard({ id, k, size, state, hint, onPick, delay }) {
  const off = state !== 'idle'
  const art = Math.round(size * 0.66)
  return (
    <motion.button type="button" onClick={off ? undefined : onPick} disabled={off} aria-label={ACTIONS[id].label} data-card={id} data-fits={id === k.good1 ? '1' : undefined} data-hint={hint ? '' : undefined}
      initial={{ y: 50, opacity: 0, scale: 0.6 }} animate={{ y: state === 'chosen' || state === 'good' ? -8 : 0, opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 20, delay }} whileTap={off ? undefined : { scale: 0.93 }}
      style={{ all: 'unset', cursor: off ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent' }}>
      <motion.div animate={hint && !reduceMotion() ? { scale: [1, 1.06, 1] } : { scale: 1 }} transition={hint ? { duration: 0.8, repeat: Infinity } : { duration: 0.2 }}
        style={{ ...pxCard(state === 'good' ? 'right' : state === 'chosen' ? 'selected' : undefined), width: size, height: size, boxSizing: 'border-box', borderRadius: 18,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', padding: `${Math.round(size * 0.03)}px 2px ${Math.round(size * 0.05)}px`,
          ...(state === 'tried' ? { background: TRIED.background, border: `3px solid ${TRIED.frame}`, boxShadow: 'none' } : null),
          ...(hint ? { boxShadow: '0 0 0 5px #ffc93c, 0 5px 0 rgba(42,27,61,.35)' } : null) }}>
        <div style={state === 'tried' ? TRIED.inside : undefined}><CardArt id={id} k={k} size={art} /></div>
        <span style={{ ...LABEL, textShadow: 'none', opacity: state === 'tried' ? 0.5 : 1, fontSize: Math.max(11, Math.min(15, size * 0.1)), maxWidth: size - 12, minHeight: '2.1em', display: 'flex', alignItems: 'center' }}>{ACTIONS[id].label}</span>
      </motion.div>
    </motion.button>
  )
}

const HEART = 'M10 17 C2 11 0 7 0 4.5 A4.5 4.5 0 0 1 10 3 A4.5 4.5 0 0 1 20 4.5 C20 7 18 11 10 17Z'
const Heart = ({ size, star }) => (
  <svg viewBox="-2 -2 24 22" width={size} height={size * 0.92} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
    <path d={HEART} fill="#ff5b8a" stroke="#2a1b3d" strokeWidth="1.8" strokeLinejoin="round" />
    <ellipse cx="5.4" cy="5" rx="2.4" ry="1.5" fill="#fff" opacity="0.7" transform="rotate(-30 5.4 5)" />
    {star && <path d="M15.5 10 l1.3 2.7 3 .4 -2.2 2 .6 3 -2.7 -1.5 -2.7 1.5 .6 -3 -2.2 -2 3 -.4 z" fill="#ffc93c" stroke="#2a1b3d" strokeWidth="1" strokeLinejoin="round" />}
  </svg>
)

/** The detective's case book: one heart for every friend helped. */
function CaseBook({ total, badges, slotRefs, height }) {
  const s = Math.min(40, height - 20)
  return (
    <div role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={badges.length} aria-label={`${badges.length} von ${total} Fällen gelöst`}
      style={{ height, boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: Math.max(4, s * 0.2), padding: `0 ${s * 0.4}px 0 ${s * 0.25}px`, flexShrink: 0,
        background: '#fff6dd', border: `3px solid ${INK}`, borderRadius: 16, boxShadow: 'inset 0 -5px 0 #f0d9a8, 0 4px 0 rgba(42,27,61,.3)' }}>
      <svg viewBox="0 0 40 40" width={s * 1.05} height={s * 1.05} style={{ flexShrink: 0, marginRight: s * 0.1 }} aria-hidden="true">
        <rect x="6" y="3" width="29" height="34" rx="4" fill="#b7814a" stroke="#2a1b3d" strokeWidth="2.6" />
        <rect x="11" y="3" width="24" height="34" rx="3" fill="#d9a05a" stroke="#2a1b3d" strokeWidth="2.6" />
        <path d="M6 10 H3 M6 20 H3 M6 30 H3" stroke="#2a1b3d" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="22" cy="18" r="6.5" fill="#dff3ff" stroke="#2a1b3d" strokeWidth="2.6" /><path d="M26.5 23 L31 29" stroke="#2a1b3d" strokeWidth="3.4" strokeLinecap="round" />
      </svg>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} ref={el => { slotRefs.current[i] = el }} style={{ width: s, height: s, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {badges[i]
            ? <motion.div initial={{ scale: 1.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}><Heart size={s} star={badges[i].first} /></motion.div>
            : <svg viewBox="-2 -2 24 22" width={s} height={s * 0.92} aria-hidden="true"><path d={HEART} fill="rgba(42,27,61,.08)" stroke="rgba(42,27,61,.4)" strokeWidth="1.6" strokeDasharray="3 2.4" /></svg>}
        </div>
      ))}
    </div>
  )
}

const START_FRIEND = { feel: 'neutral', strength: 1, arms: undefined, hold: null, dim: false, cover: false }
const NO_HELPER = { on: false, dx: -470, feel: 'kind', hop: 0 }

export default function EmpathyGame({ level = 1, onComplete }) {
  const lv = Math.min(Math.max(level, 1), LEVELS.length)
  const cfg = LEVELS[lv - 1]
  const [rounds] = useState(() => pickCases(cfg).map(k => buildRound(k, cfg, lv)))
  const total = rounds.length

  const [idx, setIdx] = useState(0)
  // look → event → feel → named → help → act → thanks, and at last: end
  const [phase, setPhaseState] = useState('look')
  const [pv, setPv] = useState('before')
  const [friend, setFriend] = useState({ ...START_FRIEND, ...rounds[0].start })
  const [react, setReact] = useState({ type: 'hop', n: 0 })
  const [helper, setHelper] = useState(NO_HELPER)
  const [gift, setGift] = useState(null)
  const [named, setNamed] = useState(false)
  const [triedFaces, setTriedFaces] = useState([])
  const [missFace, setMissFace] = useState(null)       // the face that is shaking its head right now
  const [triedCards, setTriedCards] = useState([])
  const [chosen, setChosen] = useState(null)
  const [badges, setBadges] = useState([])

  const k = rounds[idx]
  const game = useRef({ phase: 'look', missed: false, firstTry: 0, gifts: 0, done: false, wait: null })
  // the phase is also kept where a second tap sees it at once, before the screen has caught up
  const setPhase = p => { game.current.phase = p; setPhaseState(p) }
  const now = () => game.current.phase
  const clock = useClock()
  const [bursts, burst] = useBursts()
  const [flies, fly] = useFlies()

  const rootRef = useRef(null), friendRef = useRef(null), slotRef = useRef(null), lookRef = useRef(null), trayRef = useRef(null)
  const bookRefs = useRef([])
  const { w, h } = useSize(rootRef)
  const L = w && h ? layout(w, h, cfg.chips, cfg.cards) : null

  // (not while choosing them: React may run that twice before the game is on screen)
  useEffect(() => { remember(rounds.map(r => r.id)) }, [rounds])
  useEffect(() => () => { game.current.wait?.(); leaveGame() }, [])

  // what the scenes and cards move on the stage
  const c = useMemo(() => ({
    F: p => setFriend(f => ({ ...f, ...p })),
    H: p => setHelper(s => ({ ...s, ...p, hop: p.hop ? s.hop + 1 : s.hop })),
    P: setPv,
    react: type => setReact(r => ({ type, n: r.n + 1 })),
    gift: g => setGift(g && { ...g, n: ++game.current.gifts }),
    sfx: (name, ...a) => sfx[name]?.(...a),
    animal: art => playAnimal(art, { volume: 0.6 }),
    burst: (kind, n) => burst(friendRef.current, kind, n),
  }), [burst])
  const run = steps => steps.forEach(([t, fn]) => clock.after(t, fn))
  // once Lumi has finished the sentence (at once while nothing is recorded)
  const whenQuiet = fn => { game.current.wait?.(); game.current.wait = afterNarration(() => clock.after(0, fn), { minMs: 0, maxMs: 7000 }) }

  // 1. The child looks closely: what happened plays, and Lumi tells it
  const look = () => {
    if (now() !== 'look') return
    setPhase('event')
    sfx.sparkle()
    narrate([say(`detektiv/${k.id}`)])
    clock.after(350, () => setPv('event'))
    run(k.event(c).map(([t, fn]) => [t + 350, fn]))
    clock.after(k.ms + 350, () => whenQuiet(() => { setPhase('feel'); narrate([say('detektiv/wie-fuehlt')]) }))
  }

  // Tapping the friend: it starts the case too, and later it answers with its voice
  const poke = () => {
    if (now() === 'look') { look(); return }
    if (now() !== 'feel' && now() !== 'help') return
    if (!(k.sound && playAnimal(k.sound, { volume: 0.5 }))) sfx.boing()
    c.react('hop')
  }

  // 2. How does the friend feel?
  const pickFace = (f, el) => {
    if (now() !== 'feel' || triedFaces.includes(f)) return
    if (f !== k.feeling) {
      game.current.missed = true
      setMissFace(f)
      setTriedFaces(t => [...t, f])
      // The word alone ("Wütend.") sounded like a yes to a child who cannot
      // read: the miss sound first, the word of the face tapped, then the
      // usual "not this one" ("Nicht ganz.")
      sfx.mismatch()
      sayWrong(null, { lead: [feelingWord(f)], always: true })
      c.react('no')
      clock.after(500, () => setMissFace(null))
      return
    }
    setPhase('named')
    narrate([feelingWord(f)])
    fly(el?.querySelector('[data-face]') ?? el, slotRef.current, <Face feeling={f} size={(el?.querySelector('[data-face]')?.getBoundingClientRect().width ?? 60) * 0.96} />, () => {
      setNamed(true)
      sfx.correct()
      burst(slotRef.current, 'stars', 8)
    })
    // the cards are a new question: a first wrong card is a first miss again
    clock.after(1500, () => whenQuiet(() => { newQuestion(); setPhase('help'); narrate([say('detektiv/was-tut-gut')]) }))
  }

  // 3. What is good now? Lumi does it, and the child sees what it does
  const pickCard = id => {
    if (now() !== 'help') return
    const ok = id === k.good1
    const act = ACTIONS[id]
    setPhase('act')
    setChosen(id)
    setHelper(NO_HELPER)
    narrate([say(act.say)])
    const { steps, hit, end } = act.play(c, k, ok)
    run(steps)
    clock.after(hit, () => (ok ? helped(id) : notHelped(id)))
    clock.after(end, () => {
      if (ok) { thanks(); return }
      setTriedCards(t => [...t, id])
      setChosen(null)
      setPhase('help')
    })
  }

  const helped = id => {
    const glad = k.glad(id)
    setPv('fixed')
    if (id === 'hug') {
      c.F({ feel: 'calm', strength: 1, arms: 'hugL', dim: false })
      clock.after(1200, () => { c.F({ arms: undefined, cover: false, ...glad }); c.H({ arms: undefined, feel: 'happy', dx: -128 }) })
    } else {
      c.F({ arms: undefined, strength: 1, cover: false, dim: false, ...glad })
      if (!glad.cover) c.react('hop')
    }
    // the praise first: Lumi in the top bar counts the sound after it as the same answer
    sayRight()
    sfx.correct()
    c.burst('hearts', 12)
    const voice = k.fixSound ?? (k.quiet ? null : k.sound)
    if (voice) clock.after(650, () => c.animal(voice))
  }

  const notHelped = id => {
    game.current.missed = true
    if (ACTIONS[id].mean) {
      // an unkind card: the friend feels worse, and a glad one is not glad any more
      // That is the answer: no "Hm, noch nicht" and no "mistakes are part of
      // learning" after laughing at a friend
      setFriend(f => ({ ...f, feel: k.bright ? 'sad' : k.face, strength: 2, arms: undefined, hold: k.hurtHold ?? f.hold }))
      c.react('sink')
      sfx.mismatch()
      announce('wrong')
      return
    }
    c.react('no')
    sfx.mismatch()
    sayWrong()
  }

  // 4. The friend says thank you: a heart for the case book
  const thanks = () => {
    setPhase('thanks')
    const first = !game.current.missed
    if (first) game.current.firstTry++
    const at = idx
    c.react('hop')
    fly(friendRef.current, bookRefs.current[at], <Heart size={Math.min(70, friendRef.current?.getBoundingClientRect().width ?? 60)} star={first} />, () => {
      sfx.coin()
      setBadges(b => { const n = [...b]; n[at] = { first }; return n })
      burst(bookRefs.current[at], 'stars', 6)
    })
    clock.after(2300, () => whenQuiet(next))
  }

  const next = () => {
    clock.clear()
    if (idx + 1 >= total) { setPhase('end'); return }
    const n = rounds[idx + 1]
    game.current.missed = false
    setIdx(idx + 1); setPhase('look'); setPv('before'); setFriend({ ...START_FRIEND, ...n.start }); setHelper(NO_HELPER); setGift(null)
    setNamed(false); setTriedFaces([]); setTriedCards([]); setChosen(null); setMissFace(null)
  }

  // The level is done: every friend of it, glad
  useEffect(() => {
    if (phase !== 'end') return
    sfx.complete()
    burst(rootRef.current, 'confetti', 26)
    clock.after(900, () => burst(rootRef.current, 'hearts', 14))
    clock.after(3200, () => whenQuiet(() => {
      if (game.current.done) return
      game.current.done = true
      onComplete(result(game.current.firstTry, total))
    }))
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // After two misses the game helps: the face or card that fits lights up
  const helpFace = phase === 'feel' && triedFaces.length >= 2
  const helpCard = phase === 'help' && triedCards.length >= 2
  // where the hint hand taps: the magnifying glass, then a face or a card
  // (the one that fits only after two misses, otherwise a different one each time)
  const [hintAt] = useState(() => ({
    get current() {
      const fits = trayRef.current?.querySelector('[data-hint]')
      if (fits) return fits
      const items = trayRef.current?.querySelectorAll('button:not([disabled])')
      return items?.length ? items[Math.floor(Date.now() / 7000) % items.length] : null
    },
  }))

  const faces = phase === 'feel' || phase === 'named'
  const cards = phase === 'help' || phase === 'act' || phase === 'thanks'

  return (
    <MotionConfig reducedMotion="user">
      <div ref={rootRef} data-detektiv={phase} data-case={k.id} style={{ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden' }}>
        {L && (
          <div style={{ position: 'absolute', inset: 0, boxSizing: 'border-box', padding: L.pad, display: 'flex', gap: L.pad,
            flexDirection: L.wide ? 'row' : 'column', alignItems: 'center', justifyContent: L.wide ? 'center' : 'space-evenly' }}>
            {!L.wide && <CaseBook total={total} badges={badges} slotRefs={bookRefs} height={L.bookH} />}

            {phase === 'end'
              ? <Finale rounds={rounds} L={L} />
              : <motion.div key={idx} initial={reduceMotion() ? false : { opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }} style={{ flexShrink: 0 }}>
                  <Stage k={k} sw={L.sw} scale={L.scale} pv={pv} friend={friend} react={react} helper={helper} gift={gift} phase={phase} named={named}
                    tag={phase === 'feel' || phase === 'named' || (phase === 'help' && !triedCards.length)} onPoke={poke} onLook={look} friendRef={friendRef} slotRef={slotRef} lookRef={lookRef} />
                </motion.div>}

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: L.pad, flexShrink: 0,
              ...(L.wide ? { width: L.trayW, alignSelf: 'stretch' } : { width: '100%', height: L.trayH }) }}>
              {L.wide && <CaseBook total={total} badges={badges} slotRefs={bookRefs} height={L.bookH} />}
              <div ref={trayRef} style={{ flex: L.wide ? 1 : undefined, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: faces ? (L.chip < 90 ? 8 : 14) : 10, minHeight: L.card + 6 }}>
                {phase !== 'end' && faces && k.chips.map((f, i) => (
                  <FeelChip key={`${idx}-${f}`} feeling={f} size={L.chip} delay={i * 0.07} fits={f === k.feeling}
                    state={missFace === f ? 'miss' : triedFaces.includes(f) ? 'tried' : phase === 'named' ? (f === k.feeling ? 'gone' : 'locked') : 'idle'}
                    hint={helpFace && f === k.feeling} onPick={e => pickFace(f, e.currentTarget)} />
                ))}
                {phase !== 'end' && cards && k.cards.map((id, i) => (
                  <HelpCard key={`${idx}-${id}`} id={id} k={k} size={L.card} delay={i * 0.08}
                    state={triedCards.includes(id) ? 'tried' : chosen === id ? (phase === 'thanks' ? 'good' : 'chosen') : phase === 'help' ? 'idle' : 'wait'}
                    hint={helpCard && id === k.good1} onPick={() => pickCard(id)} />
                ))}
              </div>
            </div>
          </div>
        )}
        <HintHand to={lookRef} active={phase === 'look'} delay={idx === 0 ? 2500 : 5000} />
        <HintHand to={hintAt} active={phase === 'feel' || phase === 'help'} delay={helpFace || helpCard ? 900 : 6500} />
        {bursts}
        {flies}
      </div>
    </MotionConfig>
  )
}

/** The end of the level: every friend of it, glad, around Lumi the detective. */
function Finale({ rounds, L }) {
  const width = L.sw * L.scale
  const size = Math.min(120, (width - 20) / (rounds.length + 1.2))
  return (
    <div style={{ width, height: SH * L.scale, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
        {rounds.map((k, i) => {
          const pal = <motion.div key={k.id} initial={{ y: -300, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 13, delay: 0.12 * i }}>
            <Pal kind={k.kind} feel={i % 2 ? 'excited' : 'happy'} strength={2} size={size} />
          </motion.div>
          return i === Math.floor(rounds.length / 2)
            ? [<motion.div key="lumi" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 12, delay: 0.5 }}><Pal kind="lumi" hat feel="happy" strength={2} size={size * 1.15} hold={{ node: <Heart size={size * 0.4} star />, at: 'holdR' }} /></motion.div>, pal]
            : pal
        })}
      </div>
    </div>
  )
}
