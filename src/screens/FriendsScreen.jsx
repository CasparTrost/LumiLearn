import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, profileWardrobeStars } from '../AppContext.jsx'
import { HudBar, PxIcon, PxStar } from '../components/PixelUI.jsx'
import MusicButton from '../components/MusicControls.jsx'
import Confetti from '../components/Confetti.jsx'
import { FriendFigure, FriendCompanion, FriendsIcon } from '../components/FriendFigure.jsx'
import { Critter, Art, useMood, useBursts } from '../components/play/index.js'
import { FRIENDS, FRIEND_BY_ID, STEPS, cleanFriends, cleanAlong, friendsOwed, friendsToCome } from '../lib/friends.js'
import { narrate, stopNarration } from '../narrator.js'
import { sfx } from '../sfx.js'
import { LINES, line } from '../lib/lumiLines.js'

/**
 * Lumis Freunde (lib/friends.js): a dino, a unicorn, a dragon and a robot
 * the child earns with its stars.
 *
 * Choosing (a friend may move in): the friends not there yet stand side by
 * side and wave. A tap brings one forward (it hops, the others step back);
 * a big green tick under it confirms. A tap on another friend changes the
 * choice, so a mis-tap decides nothing. Then the friend moves in with a
 * little show and comes along at once. All four come in the end: no choice
 * is ever wrong.
 *
 * The place: Lumi on a rug with the friend that comes along, and all four
 * friends. The ones there are tapped to come along (a ring and a tick, as
 * in the wardrobe) or, tapped again, stay at home: one at a time or none.
 * The ones not there yet are grey shadows with a present and the stars the
 * next friend needs (a star with a number, as in the wardrobe).
 *
 * Lumi's sentences here (freunde/…) are not recorded yet: the narrator
 * skips them while their file is missing; the screen works without words.
 */
const rec = key => (LINES[key] ? line(key) : null)

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

export default function FriendsScreen() {
  const { state, dispatch } = useApp()
  const profile = state.profiles[state.activeProfileId]
  const stars = profileWardrobeStars(profile)
  const friends = cleanFriends(profile?.friends)
  const along = cleanAlong(profile?.friendAlong, profile?.friends)
  const owed = friendsOwed(profile, stars)
  const toCome = friendsToCome(profile)
  // the friend moving in right now (the show), then the place
  const [show, setShow] = useState(null)
  const choosing = !show && owed > 0 && toCome.length > 0

  const home = () => { stopNarration(); dispatch({ type: 'NAVIGATE', payload: 'home' }) }
  useEffect(() => () => stopNarration(), [])

  const { w, h } = useViewport()
  const hud = w < 521 ? 72 : 80

  return (
    <div data-friends-screen={choosing ? 'choose' : show ? 'show' : 'place'}
      style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <HudBar style={{ position: 'relative', zIndex: 10, minHeight: hud }}>
        <button className="px-btn px-btn--wood px-btn--icon" onClick={home} aria-label="Zur Startseite"><PxIcon name="back" size={20} color="#fff" /></button>
        <FriendsIcon size={44} />
        <span className="px-title hud-hide-sm" style={{ flex: 1, minWidth: 0, fontSize: 'clamp(18px,3vw,28px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Lumis Freunde</span>
        <span className="hud-only-sm" style={{ flex: 1 }} />
        <span className="px-chip" aria-label={`${stars} Sterne`} style={{ fontFamily: 'var(--font-heading)', flexShrink: 0 }}>
          <PxStar size={22} /> {stars}
        </span>
        <MusicButton />
      </HudBar>
      {choosing
        ? <Choose key="choose" candidates={toCome} w={w} h={h - hud} onChosen={id => { dispatch({ type: 'FRIEND_CHOOSE', payload: id }); setShow(id) }} />
        : show
          ? <MoveIn key="show" id={show} w={w} h={h - hud} onDone={() => setShow(null)} />
          : <Place key="place" friends={friends} along={along} stars={stars} w={w} h={h - hud} dispatch={dispatch} />}
    </div>
  )
}

// ── Choosing ───────────────────────────────────────────────────────────────
function Choose({ candidates, w, h, onChosen }) {
  const [picked, setPicked] = useState(null)
  const [mood, setMood] = useMood('wave')
  const told = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => narrate([rec('freunde/einzug')]), 500)
    return () => clearTimeout(t)
  }, [])

  const wide = w > h || w >= 700
  const n = candidates.length
  const lumiSize = Math.round(wide ? Math.min(220, h * 0.42, w * 0.2) : Math.min(140, h * 0.18))
  // the friends: in a row, or two rows where that makes them bigger (a
  // phone held upright always two by two)
  const size = c => {
    const roomW = (wide ? w - lumiSize - 60 : w - 24) / c - 12
    const roomH = (wide ? h - 30 : h - lumiSize - 60) / Math.ceil(n / c) - 84
    return Math.min(240, roomW, roomH)
  }
  const cols = !wide ? Math.min(2, n) : size(n) >= size(Math.ceil(n / 2)) ? n : Math.ceil(n / 2)
  const cell = Math.round(Math.max(96, size(cols)))

  const pick = id => {
    if (id === picked) return
    sfx.boing()
    setPicked(id)
    setMood('hop', 1000)
    if (!told.current) { told.current = true; narrate([rec('freunde/sicher')]) }
  }
  const confirm = () => {
    if (!picked) return
    stopNarration()
    onChosen(picked)
  }

  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: wide ? 24 : 6, padding: wide ? '8px 16px' : '10px 12px',
      background: 'radial-gradient(circle at 50% 40%, #fff8e2 0%, #ffeec2 45%, #f3d79e 100%)' }}>
      <div style={{ flexShrink: 0 }}>
        <Critter art="lumi" size={lumiSize} mood={mood} label="Lumi" shadow={false} talks />
      </div>
      <div role="radiogroup" aria-label="Welcher Freund zieht ein?"
        style={{ display: 'flex', flexWrap: 'wrap', width: cols * cell + (cols - 1) * 12, gap: '6px 12px', justifyContent: 'center' }}>
        {candidates.map((f, i) => (
          <Candidate key={f.id} friend={f} size={cell} index={i} picked={picked === f.id} dim={!!picked && picked !== f.id}
            onTap={() => pick(f.id)} onConfirm={confirm} />
        ))}
      </div>
    </div>
  )
}

function Candidate({ friend, size, index, picked, dim, onTap, onConfirm }) {
  return (
    <div style={{ position: 'relative', width: size, height: size + 78, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* its shadow on the floor, and a spot of light under the chosen one */}
      <span aria-hidden="true" style={{ position: 'absolute', top: size * 0.93, width: size * 0.55, height: size * 0.08, borderRadius: '50%', background: 'rgba(42,27,61,0.16)' }} />
      <motion.span aria-hidden="true" animate={{ opacity: picked ? 1 : 0, scale: picked ? 1 : 0.6 }}
        style={{ position: 'absolute', top: size * 0.8, width: size * 0.95, height: size * 0.26, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(255,214,90,0.95) 0%, rgba(255,214,90,0.4) 60%, rgba(255,214,90,0) 100%)' }} />
      <motion.button type="button" role="radio" aria-checked={picked} aria-label={friend.name} data-candidate={friend.id}
        onClick={onTap} whileTap={{ scale: 0.94 }}
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: dim ? 0.55 : 1, scale: picked ? 1.12 : dim ? 0.86 : 1 }}
        transition={{ delay: picked || dim ? 0 : 0.15 + index * 0.12, type: 'spring', stiffness: 300, damping: 18 }}
        style={{ all: 'unset', cursor: 'pointer', position: 'relative', width: size, height: size, transformOrigin: '50% 100%' }}>
        <motion.div key={picked ? 'hop' : 'wave'}
          animate={picked ? { y: [0, -size * 0.18, 0, -size * 0.07, 0] } : { rotate: [0, 2.5, -2.5, 0] }}
          transition={picked ? { duration: 0.8, ease: 'easeOut' } : { duration: 1.8 + index * 0.2, repeat: Infinity }}
          style={{ width: size, height: size, transformOrigin: '50% 100%', filter: 'drop-shadow(0 4px 0 rgba(42,27,61,0.25))' }}>
          <FriendFigure id={friend.id} mood={picked ? 'happy' : 'wave'} size={size} style={{ display: 'block' }} />
        </motion.div>
      </motion.button>
      {/* the second step: a big green tick under the chosen one */}
      <AnimatePresence>
        {picked && (
          <motion.button type="button" key="ok" onClick={onConfirm} aria-label={`${friend.name} zieht ein`} data-confirm={friend.id}
            initial={{ scale: 0, y: -16 }} animate={{ scale: [1, 1.1, 1], y: 0 }} exit={{ scale: 0, transition: { duration: 0.15 } }}
            transition={{ scale: { duration: 1.1, repeat: Infinity, delay: 0.35 }, y: { type: 'spring', stiffness: 400, damping: 16 } }}
            whileTap={{ scale: 0.9 }}
            style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', marginTop: 8, width: 68, height: 68, borderRadius: '50%', background: 'radial-gradient(circle at 35% 30%, #8fe87e, #3aa63a 70%)', border: '4px solid var(--px-ink)', boxShadow: '0 5px 0 rgba(42,27,61,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2 }}>
            <svg viewBox="0 0 24 24" width="40" height="40" aria-hidden="true"><path d="M4.5 12.5 L10 18 L19.5 6.5" stroke="#fff" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Moving in: a little show ─────────────────────────────────────────────────
function MoveIn({ id, w, h, onDone }) {
  const [bursts, burst] = useBursts()
  const spot = useRef(null)
  const wide = w > h || w >= 700
  const size = Math.round(Math.min(wide ? 300 : 230, h * (wide ? 0.62 : 0.4), w * (wide ? 0.32 : 0.55)))
  useEffect(() => {
    sfx.tada()
    const t1 = setTimeout(() => { sfx.sparkle(); burst(spot.current, 'hearts', 10) }, 650)
    const t2 = setTimeout(() => narrate([rec(`freunde/hallo-${id}`)]), 400)
    const t3 = setTimeout(onDone, 3600)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    // a tap anywhere goes on to the place at once
    <div onClick={onDone} aria-label={`${FRIEND_BY_ID[id]?.name} ist eingezogen`} role="status" data-move-in={id}
      style={{ cursor: 'pointer', flex: 1, minHeight: 0, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'radial-gradient(circle at 50% 45%, #fffbe8 0%, #ffe7a8 55%, #f6c86a 100%)', overflow: 'hidden' }}>
      <Confetti count={50} yFrom="-5vh" yTo="110vh" />
      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', gap: 0 }}>
        <Critter art="lumi" size={Math.round(size * 0.9)} mood="dance" shadow={false} />
        <motion.div ref={spot} initial={{ x: w * 0.6, y: -size * 0.4, rotate: 20 }} animate={{ x: 0, y: [-size * 0.4, 0, -size * 0.12, 0], rotate: 0 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}>
          <FriendCompanion id={id} mood="happy" size={size} delay={0.9} />
        </motion.div>
      </div>
      {bursts}
    </div>
  )
}

// ── The place ──────────────────────────────────────────────────────────────
function Place({ friends, along, stars, w, h, dispatch }) {
  const [mood, setMood] = useMood('wave')
  const [wish, setWish] = useState(false)
  const [shake, setShake] = useState(null)
  const wishTimer = useRef(null)
  const toldWrapped = useRef(false)
  const [bursts, burst] = useBursts()
  const stageRef = useRef(null)
  useEffect(() => {
    const t = setTimeout(() => { if (friends.length >= 2) narrate([rec('freunde/wer-kommt-mit')]) }, 600)
    return () => { clearTimeout(t); clearTimeout(wishTimer.current) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const wide = w > h || w >= 700
  const stageW = wide ? Math.min(420, Math.max(220, w * 0.38)) : w
  const stageH = wide ? h : Math.min(300, Math.round(h * 0.34))
  const lumi = Math.round(wide ? Math.min(stageW * 0.5, h * 0.42, 210) : stageH * 0.62)
  // the cards: four in a row where there is room, else two by two
  const areaW = (wide ? w - stageW : w) - 28, areaH = (wide ? h : h - stageH) - 28
  const fit = cols => Math.min(areaW / cols - 14, areaH / Math.ceil(4 / cols) - 14)
  const cols = fit(4) >= fit(2) ? 4 : 2
  const card = Math.round(Math.max(96, Math.min(200, fit(cols))))
  // the stars the next friend needs: the step of the friend after the ones
  // there (reached already when it waits for the next game: the bar is full)
  const next = STEPS[friends.length] ?? null
  const from = STEPS[friends.length - 1] ?? 0

  const tapFriend = id => {
    setWish(false)
    const on = along !== id
    dispatch({ type: 'FRIEND_ALONG', payload: id })
    if (on) {
      sfx.boing()
      setTimeout(() => sfx.sparkle(), 220)
      setMood('hop', 1100)
      setTimeout(() => burst(stageRef.current, 'stars', 10), 150)
    } else {
      sfx.pop()
      setMood('wave', 1200)
    }
  }
  const tapShadow = id => {
    setShake(id + Date.now())
    sfx.bump()
    setMood('hmm', 1500)
    setWish(true)
    clearTimeout(wishTimer.current)
    wishTimer.current = setTimeout(() => setWish(false), 2600)
    if (!toldWrapped.current) { toldWrapped.current = true; narrate([rec('schrank/eingepackt')]) }
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column' }}>
      {/* Lumi and the friend that comes along, on a rug */}
      <div style={{
        position: 'relative', flexShrink: 0, width: wide ? stageW : '100%', height: wide ? '100%' : stageH,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(circle at 50% 45%, #fff8e2 0%, #ffeec2 38%, #f6dca8 70%, #ecc98c 100%)',
        borderRight: wide ? '4px solid var(--px-ink)' : 'none', borderBottom: wide ? 'none' : '4px solid var(--px-ink)',
      }}>
        <div ref={stageRef} style={{ position: 'relative', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: lumi * 0.06 }}>
          <div aria-hidden="true" style={{ position: 'absolute', bottom: 0, left: '2%', right: '2%', height: lumi * 0.18, borderRadius: '50%', background: 'radial-gradient(ellipse, #b8ec8c 0%, #8fd26a 60%, #6fb54c 100%)', border: '3px solid var(--px-ink)' }} />
          <AnimatePresence>
            {along && (
              <motion.div key={along} initial={{ x: -lumi * 0.4, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -lumi * 0.4, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }} style={{ position: 'relative', marginRight: -lumi * 0.12 }}>
                <FriendCompanion id={along} mood={mood} size={Math.round(lumi * 0.95)} />
              </motion.div>
            )}
          </AnimatePresence>
          <div style={{ position: 'relative' }}>
            <Critter art="lumi" size={lumi} mood={mood} label="Lumi" shadow={false} talks />
            {wish && next && (
              <div style={{ position: 'absolute', left: '50%', bottom: -lumi * 0.06, transform: 'translateX(-50%)', zIndex: 5 }}>
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }} data-wish={next - stars}
                  style={{ position: 'relative', background: '#fffdf7', border: '3px solid var(--px-ink)', borderRadius: 16, padding: '6px 10px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)' }}>
                  <StarsNeeded need={next} stars={stars} from={from} />
                </motion.div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* all four friends */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14 }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${card}px)`, gap: 14 }}>
          {FRIENDS.map(f => friends.includes(f.id)
            ? <FriendCard key={f.id} friend={f} size={card} along={along === f.id} onTap={() => tapFriend(f.id)} />
            : <ShadowCard key={f.id} friend={f} size={card} need={next} stars={stars} from={from} shake={shake?.startsWith(f.id) ? shake : null} onTap={() => tapShadow(f.id)} />)}
        </div>
      </div>
      {bursts}
    </div>
  )
}

/** A friend that lives with Lumi: a tap takes it along (ring and tick), a second leaves it at home. */
function FriendCard({ friend, size, along, onTap }) {
  return (
    <motion.button type="button" onClick={onTap} aria-pressed={along} aria-label={`${friend.name}${along ? ', kommt mit' : ''}`}
      data-friend-card={friend.id} data-state={along ? 'along' : 'home'} whileTap={{ scale: 0.93 }}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'relative', width: size, height: size, borderRadius: 22,
        background: along ? 'radial-gradient(circle, #e9ffe0 0%, #b9ecaa 100%)' : 'radial-gradient(circle, #fffdf5 0%, #fff1d0 100%)',
        border: along ? '5px solid #3aa63a' : '3px solid var(--px-ink)',
        boxShadow: along ? '0 0 0 3px #fff, 0 5px 0 rgba(42,27,61,0.35)' : '0 4px 0 rgba(42,27,61,0.3)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'visible',
      }}>
      <motion.div key={along ? 'on' : 'off'} animate={along ? { y: [0, -size * 0.1, 0] } : { y: 0 }} transition={{ duration: 0.6 }}
        style={{ width: size * 0.9, height: size * 0.9, transformOrigin: '50% 100%' }}>
        <FriendFigure id={friend.id} mood={along ? 'wave' : 'idle'} size={Math.round(size * 0.9)} style={{ display: 'block' }} />
      </motion.div>
      {along && (
        <span aria-hidden="true" style={{ position: 'absolute', right: -8, top: -8, width: 32, height: 32, borderRadius: '50%', background: '#3aa63a', border: '3px solid #fff', color: '#fff', fontWeight: 800, fontSize: 19, lineHeight: '26px', textAlign: 'center', boxShadow: '0 2px 0 rgba(42,27,61,0.35)' }}>✓</span>
      )}
    </motion.button>
  )
}

/** A friend not there yet: a grey shadow with a present and the stars the next friend needs. */
function ShadowCard({ friend, size, need, stars, from, shake, onTap }) {
  const span = Math.max(1, (need ?? 0) - from)
  const share = Math.max(0, Math.min(1, (stars - from) / span))
  return (
    <motion.button type="button" onClick={onTap} aria-label={need ? `Geschenk, ${need} Sterne` : 'Geschenk'} data-friend-card={friend.id} data-state="shadow"
      whileTap={{ scale: 0.93 }} key={shake ?? 'still'} animate={shake ? { rotate: [0, -10, 9, -6, 4, 0] } : { rotate: 0 }} transition={{ duration: 0.5 }}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'relative', width: size, height: size, borderRadius: 22,
        background: 'rgba(255,255,255,0.45)', border: '3px dashed rgba(42,27,61,0.4)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
      <FriendFigure id={friend.id} size={Math.round(size * 0.9)} style={{ display: 'block', filter: 'brightness(0)', opacity: 0.22 }} />
      <span aria-hidden="true" style={{ position: 'absolute', right: 4, bottom: size * 0.2 }}><Art art="🎁" size={Math.round(size * 0.36)} /></span>
      {need && (<>
        <span aria-hidden="true" style={{
          position: 'absolute', left: '50%', bottom: 20, transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 2,
          background: 'var(--px-ink)', color: '#fff', borderRadius: 10, padding: '1px 8px 1px 4px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 16, lineHeight: '22px',
        }}><PxStar size={16} />{need}</span>
        <span aria-hidden="true" data-progress={`${stars - from}/${span}`} style={{ position: 'absolute', left: 10, right: 10, bottom: 6, height: 11, borderRadius: 6, background: '#fff', overflow: 'hidden', border: '2px solid var(--px-ink)' }}>
          <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, background: 'linear-gradient(90deg, #ffe680, #ffc93c)' }} />
        </span>
      </>)}
    </motion.button>
  )
}

/** The stars still missing: up to five as outlines to count, more as a bar up to the number. */
function StarsNeeded({ need, stars, from }) {
  const n = need - stars
  const share = Math.max(0, Math.min(1, (stars - from) / Math.max(1, need - from)))
  // (reached already, the friend waits for the next game: a full bar)
  if (n > 5 || n <= 0) return (
    <span role="img" aria-label={n > 0 ? `Noch ${n} Sterne` : 'Nach dem nächsten Spiel'} style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, lineHeight: '24px', color: 'var(--px-ink)', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'block', width: 64, height: 12, borderRadius: 6, background: '#fff', overflow: 'hidden', border: '2px solid var(--px-ink)' }}>
        <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, background: 'linear-gradient(90deg, #ffe680, #ffc93c)' }} />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><PxStar size={22} />{need}</span>
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
