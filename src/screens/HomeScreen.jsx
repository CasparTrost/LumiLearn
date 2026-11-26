import { useState, useEffect, useMemo, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useApp, MAX_LEVELS, hasLevels, todayMs, profileWardrobeStars } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import { PxStar, PxIcon, HudBar } from '../components/PixelUI.jsx'
import TileArt from '../components/TileArt.jsx'
import ProfileSwitcher from '../components/ProfileSwitcher.jsx'
import LevelPicker, { unlockedUpTo } from '../components/LevelPicker.jsx'
import MusicButton from '../components/MusicControls.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { Scene, Critter, Art } from '../components/play/index.js'
import { useProfile } from '../hooks/useProfile.js'
import { readStore, writeStore } from '../hooks/safeStorage.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import { narrate, stopNarration } from '../narrator.js'
import { hearable } from '../lib/hearable.js'
import { lazyWithReload } from '../lib/lazyWithReload.js'
import { journeyArt, asset } from '../lib/assets.js'
import { unseenItems } from '../lib/wardrobe.js'
import { shapesOwed, firstChoiceOwed, offeredFirst, offerFirstByItself } from '../lib/shapes.js'
import { ShapesIcon, ChildLumi } from '../components/ShapeFigure.jsx'
import { WORLDS, MODULE_BY_ID, recommend, sortForAge, visibleModules } from '../modules.js'
import { prefetchGame, isGameLoaded, ensureGame } from './GameScreen.jsx'
import { line, gameLine } from '../lib/lumiLines.js'

// Rarely opened (only via the settings gear) and pulls in its own sizeable
// UI (PIN gate, stats, error log, profile management) — no reason to ship
// it in the initial bundle every kid loading the home screen pays for.
const ParentScreen = lazyWithReload(() => import('./ParentScreen.jsx'))

const cardVariants = {
  hidden:  { opacity:0, y:44, scale:0.88 },
  visible: (i) => ({ opacity:1, y:0, scale:1, transition:{ delay: i*0.04, type:'spring', stiffness:340, damping:18 } }),
}


// Module-level (not component state): HomeScreen remounts fresh every time
// the router switches state.screen back to 'home', so a plain useEffect([])
// fires on every return trip. Greeted once per app open and per child — a
// sibling who takes over is greeted too (the flag used to be global).
const greeted = new Set()

function timeGreeting(t) {
  const h = new Date().getHours()
  return h < 12 ? t('home.morning') : h < 17 ? t('home.afternoon') : t('home.evening')
}
// the same in Lumi's recorded voice
const timeLine = () => {
  const h = new Date().getHours()
  return line(h < 12 ? 'begruessung/morgen' : h < 17 ? 'begruessung/tag' : 'begruessung/abend')
}

/**
 * What Lumi says when a child arrives — not the same sentence every time —
 * and then Lumi's idea for the first game. All in Lumi's recorded voice
 * (lib/lumiLines.js); a recording can't say the child's name, so the
 * greeting doesn't either — a name read by the browser voice in the
 * middle of Lumi's sentence sounded like a second speaker.
 */
function greetingParts({ lastPlayed, idea }) {
  const say = idea && gameLine(idea.mod.id)
  if (!lastPlayed) return [line('begruessung/neu'), ...(say ? [say] : [])]
  const n = parseInt(readStore('lumi_greet_n', '0'), 10) || 0
  writeStore('lumi_greet_n', n + 1)
  const options = [
    [line('begruessung/wieder-da'), ...(say ? [say] : [])],
    [timeLine(), ...(say ? [say] : [])],
  ]
  return options[n % options.length]
}

/** The next game of today's plan (skipping the movement break), or null. */
export function nextIdea(journey) {
  const stops = journey?.stops ?? []
  const done = journey?.done ?? []
  const idx = stops.findIndex((st, i) => st.moduleId && !done.includes(i))
  return idx === -1 ? null : { idx, stop: stops[idx], mod: MODULE_BY_ID[stops[idx].moduleId] }
}

// Where a one-word title breaks on a narrow tile: at the joint of the two
// words ("Gefühls-detektiv"). The browser's own hyphenation made
// "Gefühlsdetek-tiv" and "Schattenrät-sel" of them.
const JOINT = /^(Gefühls|Schatten|Buchstaben|Zahlen|Farben|Muster|Kuckucks|Hör)(?=[a-zäöü])/
const tileTitle = title => title.replace(JOINT, '$1\u00ad')

// ── A game tile ─────────────────────────────────────────────────────────────
// All tiles the same size, in rows: the round picture says what the game is
// (most children here can't read). The tile starts the game at the current
// level; the small ★ button under it picks another level.
function GameTile({ mod, p, index, onPlay, onLevels }) {
  const maxLvl    = MAX_LEVELS[mod.id] ?? 10
  const curLevel  = p.currentLevel ?? 1
  const canPick   = unlockedUpTo(p, maxLvl) > 1
  const bestTotal = Object.values(p.levelStars ?? {}).reduce((a, b) => a + (b ?? 0), 0)

  return (
    <motion.div custom={index} initial="hidden" animate="visible" variants={cardVariants}
      style={{
        display:'flex', flexDirection:'column', alignItems:'center', gap:6, padding:'12px 8px 8px',
        background:'#fffdf7', border:'3px solid var(--px-ink)', borderRadius:16,
        boxShadow:'0 4px 0 rgba(42,27,61,0.3)', minWidth:0,
      }}>
      <motion.button
        whileHover={{ y:-3 }} whileTap={{ scale:0.94 }}
        onClick={() => onPlay(mod)}
        onPointerEnter={() => prefetchGame(mod.id)}
        onFocus={() => prefetchGame(mod.id)}
        {...hearable(mod.say, { src: gameLine(mod.id)?.src })}
        aria-label={hasLevels(mod.id) ? `${mod.title}, Level ${curLevel} von ${maxLvl}, ${bestTotal} Sterne. Spielen` : `${mod.title}. Spielen`}
        style={{ all:'unset', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:8, width:'100%' }}>
        <div style={{
          width:'min(84px, 100%)', aspectRatio:'1', borderRadius:'50%', flexShrink:0,
          background:`radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 55%), ${mod.color}`,
          border:'3px solid var(--px-ink)', boxShadow:'inset 0 -5px 0 rgba(0,0,0,0.16)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <TileArt mod={mod} size={58} bare />
        </div>
        {/* two lines' room for every title, so the rows line up */}
        <span style={{
          fontFamily:'var(--font-heading)', fontWeight:700, fontSize:14, lineHeight:1.15, minHeight:'2.3em', hyphens:'manual', overflowWrap:'anywhere',
          color:'var(--px-ink)', textAlign:'center', display:'flex', alignItems:'center', justifyContent:'center',
        }}>{tileTitle(mod.title)}</span>
      </motion.button>
      {/* another level, once there is more than one to choose from */}
      {canPick && (
        <button className="px-btn px-btn--parch" onClick={() => onLevels(mod)}
          aria-label={`${mod.title}: Level wählen`}
          style={{ height:38, minWidth:56, padding:'0 8px', fontSize:15, gap:3, marginTop:'auto' }}>
          <PxStar size={14} /> {curLevel}
        </button>
      )}
    </motion.div>
  )
}

// Lumis Kleiderschrank, next to the album. Something new in it: a sparkle
// on the button and a little wiggle now and then — nothing more.
function WardrobeButton({ fresh, onClick, small }) {
  return (
    <motion.button className="px-btn px-btn--parch px-btn--icon" onClick={onClick} data-wardrobe-new={fresh ? '1' : undefined}
      aria-label={fresh ? 'Lumis Kleiderschrank, etwas Neues' : 'Lumis Kleiderschrank'} title="Lumis Kleiderschrank"
      animate={fresh ? { rotate: [0, 0, 0, 0, -8, 8, -5, 0] } : { rotate: 0 }}
      transition={fresh ? { duration: 2.6, repeat: Infinity } : { duration: 0.2 }}
      style={{ flexShrink:0, width: small ? 44 : 56, height: small ? 44 : 56, padding:0, position:'relative', overflow:'visible' }}>
      <img src={asset('sprites/emoji/custom/kleiderschrank.webp')} alt="" style={{ width: small ? 34 : 42, height: small ? 34 : 42 }} />
      {fresh && (
        <motion.span aria-hidden="true" animate={{ scale:[1, 1.25, 1] }} transition={{ duration:1.2, repeat:Infinity }}
          style={{ position:'absolute', right:-8, top:-8, width:26, height:26, borderRadius:'50%', background:'#ff5b8a', border:'3px solid #fff',
            boxShadow:'0 2px 0 rgba(42,27,61,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, lineHeight:1 }}>
          ✨
        </motion.span>
      )}
    </motion.button>
  )
}

// Lumi verwandelt sich, beside the wardrobe: who Lumi is. A new shape may
// be won: the same sign and wiggle as the wardrobe's, until it is chosen.
function ShapesButton({ owed, onClick, small }) {
  return (
    <motion.button className="px-btn px-btn--parch px-btn--icon" onClick={onClick} data-shapes-owed={owed ? '1' : undefined}
      aria-label={owed ? 'Lumi verwandeln, eine neue Figur wartet' : 'Lumi verwandeln'} title="Lumi verwandeln"
      animate={owed ? { rotate: [0, 0, 0, 0, -8, 8, -5, 0] } : { rotate: 0 }}
      transition={owed ? { duration: 2.6, repeat: Infinity, delay: 1.3 } : { duration: 0.2 }}
      style={{ flexShrink:0, width: small ? 44 : 56, height: small ? 44 : 56, padding:0, position:'relative', overflow:'visible' }}>
      <ShapesIcon size={small ? 36 : 42} />
      {owed && (
        <motion.span aria-hidden="true" animate={{ scale:[1, 1.25, 1] }} transition={{ duration:1.2, repeat:Infinity }}
          style={{ position:'absolute', right:-8, top:-8, width:26, height:26, borderRadius:'50%', background:'#ff5b8a', border:'3px solid #fff',
            boxShadow:'0 2px 0 rgba(42,27,61,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, lineHeight:1 }}>
          ✨
        </motion.span>
      )}
    </motion.button>
  )
}

// A new shape for Lumi may be won: a present beside Lumi that wiggles and
// sparkles until the child has chosen (a tap opens the place to choose)
function ShapePresent({ size, onClick }) {
  return (
    <motion.button type="button" onClick={onClick} aria-label="Lumi kann sich verwandeln" data-shape-present
      initial={{ scale: 0 }} animate={{ scale: 1, rotate: [0, 0, -9, 9, -6, 4, 0] }}
      transition={{ scale: { type:'spring', stiffness:260, damping:14, delay:0.6 }, rotate: { duration:1.6, repeat:Infinity, repeatDelay:0.8 } }}
      whileTap={{ scale: 0.9 }}
      style={{ all:'unset', cursor:'pointer', position:'relative', width:size, height:size, flexShrink:0, display:'flex', alignItems:'flex-end', justifyContent:'center', transformOrigin:'50% 100%' }}>
      <span aria-hidden="true" style={{ position:'absolute', inset:'8% 4% 0', borderRadius:'50%', background:'radial-gradient(circle, rgba(255,226,120,0.85) 0%, rgba(255,226,120,0) 70%)' }} />
      <Art art="🎁" size={Math.round(size * 0.78)} style={{ position:'relative' }} />
      <motion.span aria-hidden="true" animate={{ scale:[0.8, 1.2, 0.8], opacity:[0.6, 1, 0.6] }} transition={{ duration:1.2, repeat:Infinity }}
        style={{ position:'absolute', right:0, top:'4%', fontSize: Math.round(size * 0.26), lineHeight:1 }}>✨</motion.span>
    </motion.button>
  )
}

// The counters under the name on a narrow phone
const SMALL_CHIP = { minHeight:26, fontSize:15, gap:3, padding:'1px 6px 1px 4px' }

// A soft colour per world, so the rows are easy to tell apart
const WORLD_TINT = { zahlen: '#fff0c4', buchstaben: '#dcefff', denken: '#ebe3ff', gefuehle: '#ffe1ec', malen: '#e2f5d6' }

// One world: a full-width row, its name to tap (Lumi says it), its games
function WorldRow({ world, mods, progress, onPlay, onLevels, offset }) {
  return (
    <section aria-label={world.label} style={{
      background: WORLD_TINT[world.id] ?? '#fffdf7', border:'3px solid var(--px-ink)', borderRadius:20,
      boxShadow:'0 5px 0 rgba(42,27,61,0.3)', padding:'12px clamp(8px,1.4vw,14px) 14px',
    }}>
      <button className="px-ribbon" onClick={() => narrate([line(`menue/welt-${world.id}`)])}
        aria-label={`${world.label}-Welt vorlesen`}
        style={{ fontSize:18, padding:'4px 16px 6px', marginBottom:12, cursor:'pointer', border:'none' }}>
        {world.emoji} {world.label}
      </button>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(clamp(94px, 26vw, 118px), 1fr))', gap:'clamp(8px,1.2vw,12px)' }}>
        {mods.map((mod, i) => (
          <GameTile key={mod.id} mod={mod} p={progress[mod.id] ?? {}} index={offset + i} onPlay={onPlay} onLevels={onLevels} />
        ))}
      </div>
    </section>
  )
}

// ── Lumi's idea: the next game the learning plan picked ─────────────────────
// Today's plan (lib/learning.js planJourney): a due review to warm up, the
// game in progress, something new, another review, and a movement break in
// the middle. It is no longer a map to walk: Lumi just has the next idea,
// and after all of them a sticker for the album as a surprise.
function LumiIdea({ idea, plan, tileLevel, onPlay, onAlbum, stickers, narrow, shapeOwed, onShapes }) {
  const allDone = !idea
  // The first idea of a day is a warm-up, one level below the game's tile, so
  // that the day starts with a success (lib/learning.js). The card says
  // which level it starts: it used to start a lower one without a word.
  const warmup = idea?.stop.kind === 'warmup' && idea.stop.level < tileLevel
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent: narrow ? 'flex-start' : 'center', flexWrap: narrow ? 'nowrap' : 'wrap',
      gap:'clamp(8px,3vw,40px)', padding:'clamp(8px,2vw,20px) clamp(10px,3vw,16px) 0',
    }}>
      <div style={{ paddingTop: narrow ? 62 : 90, paddingLeft: narrow ? 4 : 0, flexShrink: 0, display:'flex', alignItems:'flex-end' }}>
        {/* a new shape Lumi may take waits beside Lumi as a present */}
        {shapeOwed && (
          <div style={{ marginRight: narrow ? -24 : 4, position:'relative', zIndex:2 }}>
            <ShapePresent size={narrow ? 74 : 104} onClick={onShapes} />
          </div>
        )}
        <div style={{ position:'relative', zIndex:1 }}>
          <Critter art="lumi" size={narrow ? 92 : 170} mood={allDone ? 'dance' : 'idle'} talks label="Lumi"
            wish={idea ? <TileArt mod={idea.mod} size={narrow ? 40 : 60} bare /> : <Art art="⭐" size={narrow ? 34 : 52} />}
            wishSide="top" />
        </div>
      </div>
      <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:'spring', stiffness:260, damping:18, delay:0.2 }}
        className="px-panel" style={{ padding: narrow ? '10px 12px' : '14px 18px', display:'flex', flexDirection:'column', alignItems:'center', gap:10, minWidth: narrow ? 0 : 280, flex: narrow ? '1 1 0' : undefined }}>
        {idea ? (<>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <TileArt mod={idea.mod} size={narrow ? 44 : 72} />
            <div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize: narrow ? 18 : 'clamp(20px,3vw,28px)', color:'var(--px-ink)', lineHeight:1.1 }}>
              {idea.mod.title}
              <div style={{ fontSize: narrow ? 14 : 16, fontWeight:600, lineHeight:1.2, marginTop:3, opacity:0.72 }}>
                Level {idea.stop.level}{warmup ? ' zum Aufwärmen' : ''}
              </div>
            </div>
          </div>
          <button className="px-btn px-btn--green px-btn--lg" onClick={onPlay}
            aria-label={`Lumis Idee: ${idea.mod.title}, Level ${idea.stop.level}${warmup ? ' zum Aufwärmen' : ''}, spielen`} style={{ width:'100%' }}>
            <PxIcon name="play" size={22} /> Spielen!
          </button>
        </>) : (<>
          <div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'clamp(20px,3vw,26px)', color:'var(--px-ink)', textAlign:'center' }}>
            Alle Ideen geschafft!
          </div>
          <button className="px-btn px-btn--gold px-btn--md" onClick={onAlbum} style={{ width:'100%' }}>
            <img src={journeyArt('album.png')} alt="" style={{ width:28, height:28, imageRendering:'pixelated' }} /> Mein Album
          </button>
        </>)}
        {/* how many of today's ideas are played: a sticker waits at the end */}
        <div role="img" aria-label={`${plan.done} von ${plan.total} Ideen gespielt, ${stickers} Sticker`}
          style={{ display:'flex', alignItems:'center', gap:6, minHeight:44 }}>
          {Array.from({ length: plan.total }, (_, i) => (
            <span key={i} className={`px-pip${i < plan.done ? ' px-pip--gold' : ''}`} style={{ width:16, height:16 }} />
          ))}
          <img src={journeyArt(allDone ? 'chest-open.png' : 'chest.png')} alt="" style={{ width:30, height:30, imageRendering:'pixelated' }} />
        </div>
      </motion.div>
    </div>
  )
}

// A phone in portrait: Lumi and the idea stack, a little smaller
function useNarrow() {
  const q = '(max-width: 600px)'
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia?.(q).matches)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const on = () => setNarrow(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return narrow
}

export default function HomeScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  const { profile: activeProfile, progress, streak, dailyMission, lastPlayed } = useProfile()
  const profile = activeProfile ?? { name: 'Kind', avatar: '😊' }
  const [showParent, setShowParent] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [pickerMod, setPickerMod]       = useState(null)
  const [offline, setOffline]           = useState(false)
  const offlineRef = useFocusTrap(offline, { onEscape: () => setOffline(false) })
  const narrow = useNarrow()

  const day = dailyMission ?? {}

  // Games the parents switched off don't show anywhere here
  const hiddenKey = (activeProfile?.hiddenGames ?? []).join()
  const shown = useMemo(() => visibleModules(activeProfile), [hiddenKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lumi's idea: the next game of today's plan; with the plan played
  // through, a game the child would like next (age and progress)
  const journey = activeProfile?.journey
  const planned = nextIdea(journey)
  const picks = useMemo(() => recommend({
    progress, profile: activeProfile, lastPlayed,
    playedToday: day.playedIds ?? [],
  }), [activeProfile?.id, hiddenKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const idea = planned?.mod ? planned : null
  const gameStops = (journey?.stops ?? []).map((st, i) => [st, i]).filter(([st]) => st.moduleId)
  const plan = { total: gameStops.length, done: gameStops.filter(([, i]) => (journey?.done ?? []).includes(i)).length }

  // every world that has a game left in it, its games in learning order
  const worlds = WORLDS.map(w => ({ world: w, mods: sortForAge(shown.filter(m => m.world === w.id), activeProfile) }))
    .filter(w => w.mods.length)

  const totalStarsCount = Object.values(progress)
    .reduce((sum, p) => sum + Object.values(p?.levelStars ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0)

  // Daily time limit (parent area)
  const limitMin = state.settings?.dailyLimitMin ?? 0
  const timeUp = limitMin > 0 && todayMs(activeProfile) >= limitMin * 60000

  // Greeting — once per app open and child
  // A child from before Lumi's shapes is offered the free first choice once
  // per app open: after the home screen was there for a moment, the ring
  // opens by itself. Leaving it keeps the chick for now and the present
  // beside Lumi stays; closed twice, it no longer opens by itself.
  useEffect(() => {
    if (!activeProfile || !offerFirstByItself(activeProfile) || offeredFirst.has(activeProfile.id) || timeUp) return
    const id = setTimeout(() => {
      offeredFirst.add(activeProfile.id)
      stopNarration()
      dispatch({ type:'NAVIGATE', payload:'shapes' })
    }, 1500)
    return () => clearTimeout(id)
  }, [activeProfile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeProfile || greeted.has(activeProfile.id)) return
    greeted.add(activeProfile.id)
    const id = setTimeout(() => {
      if (timeUp) return
      narrate(greetingParts({ lastPlayed, idea }))
    }, 800)
    return () => clearTimeout(id)
  }, [activeProfile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Time is up: Lumi says so, kindly
  useEffect(() => {
    if (!timeUp) return
    const id = setTimeout(() => narrate([line('menue/spielzeit-vorbei')]), 600)
    return () => clearTimeout(id)
  }, [timeUp])

  // Lumi's ideas and the recommended games start without waiting, even offline
  useEffect(() => {
    const idle = window.requestIdleCallback ?? (cb => setTimeout(cb, 2500))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const id = idle(() => {
      (journey?.stops ?? []).forEach(st => st.moduleId && prefetchGame(st.moduleId))
      picks.forEach(({ mod }) => prefetchGame(mod.id))
    })
    return () => cancel(id)
  }, [journey?.date, picks]) // eslint-disable-line react-hooks/exhaustive-deps

  const startModule = (mod, level, journeyStop) => {
    // Without a connection a game's code may still be saved for offline play
    // (public/sw.js): try it, and only if it isn't there say so — the page
    // used to reload silently and then show "Fehler im Spiel".
    if (navigator.onLine === false && !isGameLoaded(mod.id)) {
      ensureGame(mod.id).then(() => startModule(mod, level, journeyStop), () => {
        setOffline(true)
        narrate([line('menue/internet-spiel')])
      })
      return
    }
    // the greeting ran on into the game (it ended after the game was shown)
    stopNarration()
    const p = progress[mod.id] ?? { currentLevel:1 }
    dispatch({ type:'START_GAME', payload:{ moduleId: mod.id, level: level ?? p.currentLevel ?? 1, journeyStop } })
  }
  const playIdea = () => idea && startModule(idea.mod, idea.stop.level, idea.idx)
  const openAlbum = () => { stopNarration(); dispatch({ type:'NAVIGATE', payload:'album' }) }
  const stickers = (activeProfile?.stickers ?? []).length
  // Lumis Kleiderschrank: the one sign on its button when something new waits
  const newWear = activeProfile ? unseenItems(activeProfile, profileWardrobeStars(activeProfile)).length : 0
  const openWardrobe = () => { stopNarration(); dispatch({ type:'NAVIGATE', payload:'wardrobe' }) }
  // Lumi verwandelt sich: a new shape that may be won now
  // (the free first choice of a child from before the shapes counts too)
  const shapeOwed = activeProfile ? firstChoiceOwed(activeProfile) || shapesOwed(activeProfile, profileWardrobeStars(activeProfile)) > 0 : false
  const openShapes = () => { stopNarration(); dispatch({ type:'NAVIGATE', payload:'shapes' }) }

  return (
    // overflow-x clip, not hidden: hidden made this div a scroll container,
    // and the sticky HUD stuck to it instead of the window — it scrolled away.
    <div className="home-bg" style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', position:'relative', overflowX:'clip', isolation:'isolate' }}>

      {/* ── A living meadow behind everything: the sun and the clouds can be tapped ── */}
      <div style={{ position:'fixed', inset:0, zIndex:-1 }}>
        <Scene theme="meadow" interactive />
      </div>

      {/* ── HUD ── */}
      {/* on a phone the buttons are 44 px and closer together: with Lumi's
          shapes beside the wardrobe the name had no room left */}
      <HudBar style={{ position:'sticky', top:0, zIndex:20, ...(narrow ? { gap:5, paddingLeft:8, paddingRight:8 } : null) }}>
        <button
          className="px-btn px-btn--parch"
          onClick={() => setShowSwitcher(true)}
          style={{ width: narrow ? 44 : 56, height: narrow ? 44 : 56, padding:0, lineHeight:1, flexShrink:0, overflow:'hidden' }}
          title="Profil wechseln"
          aria-label="Profil wechseln"
        >{/* the child's picture: its own Lumi, in its shape and clothes */}
          <ChildLumi profile={activeProfile} size={narrow ? 36 : 46} /></button>
        <div style={{ minWidth:0, flex:1 }}>
          <div className="px-title" style={{ fontSize:'clamp(14px,2.4vw,16px)', lineHeight:1.2, letterSpacing:0, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', textShadow:'-1px -1px 0 var(--px-ink), 1px -1px 0 var(--px-ink), -1px 1px 0 var(--px-ink), 1px 2px 0 var(--px-ink)' }}>
            {timeGreeting(t)},
          </div>
          <div className="px-title" style={{ fontSize:'clamp(18px,3.6vw,26px)', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {profile.name}!
          </div>
          {/* A narrow phone has no room for the counters beside the name
              (the greeting and the stars were simply left out there): they
              sit under it, a little smaller. */}
          <div className="hud-only-sm">
            <div style={{ display:'flex', flexWrap:'wrap', gap:4, marginTop:4 }}>
              <div className="px-chip" aria-label={`${totalStarsCount} Sterne`} style={SMALL_CHIP}>
                <PxStar size={16} /> {totalStarsCount}
              </div>
              {streak.count >= 2 && (
                <div className="px-chip" aria-label={`${streak.count} Tage in Folge`} style={SMALL_CHIP}>
                  <span className="px-chip-icon" style={{ width:16, height:16, fontSize:14, lineHeight:'16px', textAlign:'center' }}>🔥</span> {streak.count}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="px-chip hud-hide-sm" title="Gesammelte Sterne" aria-label={`${totalStarsCount} Sterne`} style={{ flexShrink:0 }}>
          <PxStar size={22} /> {totalStarsCount}
        </div>
        {/* the streak from day two on, on every device */}
        {streak.count >= 2 && (
          <div className="px-chip hud-hide-sm" title="Tage in Folge gespielt" aria-label={`${streak.count} Tage in Folge`} style={{ flexShrink:0 }}>
            <span className="px-chip-icon" style={{ fontSize:18, lineHeight:'22px', textAlign:'center' }}>🔥</span> {streak.count}
          </div>
        )}
        <button className="px-btn px-btn--parch px-btn--icon" onClick={openAlbum}
          aria-label={`Mein Album, ${stickers} Sticker`} title="Mein Album" style={{ flexShrink:0, width: narrow ? 44 : 56, height: narrow ? 44 : 56, padding:0 }}>
          <img src={journeyArt('album.png')} alt="" style={{ width: narrow ? 30 : 36, height: narrow ? 30 : 36, imageRendering:'pixelated' }} />
        </button>
        <WardrobeButton fresh={newWear > 0} onClick={openWardrobe} small={narrow} />
        <ShapesButton owed={shapeOwed} onClick={openShapes} small={narrow} />
        <MusicButton />
        <button
          className="px-btn px-btn--wood px-btn--icon"
          onClick={() => setShowParent(true)}
          title="Elternbereich"
          aria-label="Elternbereich"
          style={{ fontSize:24, flexShrink:0 }}
        >
          ⚙️
        </button>
      </HudBar>

      {state._saveFailed && (
        <div role="status" className="px-panel" style={{ margin:'10px auto 0', padding:'6px 12px', maxWidth:620, fontSize:15, fontWeight:700, color:'var(--px-ink)', background:'#ffe3c2' }}>
          ⚠️ Der Spielstand kann gerade nicht gespeichert werden. Eltern: bitte im Elternbereich nachsehen.
        </div>
      )}

      {timeUp ? (
        // ── Daily time is up ──
        <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}>
          <div className="px-panel" style={{ maxWidth:440, width:'100%', padding:'24px 20px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
            <LumiCharacter mood="sleepy" size={120} />
            <div style={{ fontFamily:'var(--font-heading)', fontSize:28, fontWeight:700, color:'var(--px-ink)' }}>
              Für heute ist Schluss!
            </div>
            <div style={{ fontSize:17, fontWeight:600, color:'var(--text-secondary)', lineHeight:1.45 }}>
              Lumi ruht sich jetzt aus. Morgen spielen wir weiter!
            </div>
            <button className="px-btn px-btn--gold px-btn--md"
              onClick={() => narrate([line('menue/spielzeit-vorbei')])}>
              🔊 Nochmal hören
            </button>
          </div>
        </div>
      ) : (<>
        <LumiIdea idea={idea} plan={plan} tileLevel={idea ? progress[idea.mod.id]?.currentLevel ?? 1 : 1} onPlay={playIdea} onAlbum={openAlbum} stickers={stickers} narrow={narrow}
          shapeOwed={shapeOwed} onShapes={openShapes} />

        {/* ── The worlds, one row each ── */}
        <div style={{
          display:'flex', flexDirection:'column', gap:'clamp(14px,2.4vw,22px)',
          padding:'clamp(18px,3vw,30px) clamp(10px,2.5vw,28px) clamp(28px,4vw,44px)',
          maxWidth:1100, width:'100%', alignSelf:'center',
        }}>
          {worlds.map(({ world, mods }, wi) => (
            <WorldRow key={world.id} world={world} mods={mods} progress={progress}
              offset={wi * 3} onPlay={m => startModule(m)} onLevels={setPickerMod} />
          ))}
        </div>
      </>)}

      {offline && (
        <div className="px-backdrop" onClick={() => setOffline(false)}>
          <div ref={offlineRef} className="px-panel" role="alertdialog" aria-modal="true" aria-label="Keine Internetverbindung" onClick={e => e.stopPropagation()}
            style={{ maxWidth:400, width:'100%', padding:'22px 18px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
            <LumiCharacter mood="thinking" size={96} />
            <div style={{ fontFamily:'var(--font-heading)', fontSize:24, fontWeight:700, color:'var(--px-ink)' }}>Keine Internetverbindung</div>
            <div style={{ fontSize:17, fontWeight:600, color:'var(--text-secondary)' }}>
              Lumi braucht Internet, um dieses Spiel zu holen. Lumi wartet auf dich!
            </div>
            <button className="px-btn px-btn--green px-btn--md" onClick={() => setOffline(false)}>Alles klar</button>
          </div>
        </div>
      )}

      {showParent && (
        <ErrorBoundary moduleId="parent" onHome={() => setShowParent(false)} onRetry={() => setShowParent(false)}>
          <Suspense fallback={<div className="px-backdrop"><LumiCharacter size={96} /></div>}>
            <ParentScreen onClose={() => setShowParent(false)} />
          </Suspense>
        </ErrorBoundary>
      )}
      {showSwitcher && <ProfileSwitcher onClose={() => setShowSwitcher(false)} />}
      {pickerMod && (
        <LevelPicker
          mod={pickerMod}
          title={pickerMod.title}
          progress={progress[pickerMod.id]}
          maxLevel={MAX_LEVELS[pickerMod.id] ?? 10}
          onPick={level => {
            setPickerMod(null)
            startModule(pickerMod, level)
          }}
          onClose={() => setPickerMod(null)}
        />
      )}
    </div>
  )
}
