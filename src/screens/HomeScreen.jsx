import { useState, useEffect, useMemo, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useApp, MAX_LEVELS, todayMs } from '../AppContext.jsx'
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
import { journeyArt } from '../lib/assets.js'
import { WORLDS, MODULE_BY_ID, recommend, sortForAge, visibleModules } from '../modules.js'
import { prefetchGame, isGameLoaded, ensureGame } from './GameScreen.jsx'
import { line, gameLine } from '../lib/lumiLines.js'
import { mastery } from '../lib/learning.js'

// Rarely opened (only via the settings gear) and pulls in its own sizeable
// UI (PIN gate, stats, error log, profile management) — no reason to ship
// it in the initial bundle every kid loading the home screen pays for.
const ParentScreen = lazyWithReload(() => import('./ParentScreen.jsx'))

const cardVariants = {
  hidden:  { opacity:0, y:44, scale:0.88 },
  visible: (i) => ({ opacity:1, y:0, scale:1, transition:{ delay: i*0.04, type:'spring', stiffness:340, damping:18 } }),
}

const WELCOME_BACK = 'audio/allgemein/hallo-du-willkommen-zurueck-zu-lumi-mach-direkt-da-weiter-wo-wir-aufge.mp3'

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
    // the recording "Hallo du, willkommen zurück zu Lumi! …"
    [{ src: WELCOME_BACK, text: 'Hallo du, willkommen zurück! Mach direkt da weiter, wo wir aufgehört haben, oder versuche etwas Neues.' }],
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

// ── A game on its world's stage ─────────────────────────────────────────────
// A round, gently bobbing picture instead of a text card: the picture says
// what the game is (most children here can't read), the little stars how
// sure the child already is (lib/learning.js mastery). The tile starts the
// game at the current level; ★ picks another level.
function GameBubble({ mod, p, index, onPlay, onLevels }) {
  const maxLvl    = MAX_LEVELS[mod.id] ?? 10
  const curLevel  = p.currentLevel ?? 1
  const canPick   = unlockedUpTo(p, maxLvl) > 1
  const bestTotal = Object.values(p.levelStars ?? {}).reduce((a, b) => a + (b ?? 0), 0)
  const sure      = mastery(p)

  return (
    <motion.div custom={index} initial="hidden" animate="visible" variants={cardVariants}
      style={{ position:'relative', width:'clamp(96px, 12vw, 120px)', display:'flex', flexDirection:'column', alignItems:'center' }}>
      <motion.button
        whileHover={{ scale:1.06, y:-4 }} whileTap={{ scale:0.92 }}
        onClick={() => onPlay(mod)}
        onPointerEnter={() => prefetchGame(mod.id)}
        onFocus={() => prefetchGame(mod.id)}
        {...hearable(mod.say, { src: gameLine(mod.id)?.src })}
        aria-label={`${mod.title}, Level ${curLevel} von ${maxLvl}, ${bestTotal} Sterne. Spielen`}
        style={{ all:'unset', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:6, width:'100%' }}>
        <div className="emoji-float" style={{
          '--float-dur': `${2.6 + (index % 4) * 0.5}s`,
          width:'clamp(80px, 10vw, 100px)', aspectRatio:'1', borderRadius:'50%',
          background:`radial-gradient(circle at 35% 30%, rgba(255,255,255,0.55), transparent 55%), ${mod.color}`,
          border:'4px solid var(--px-ink)', boxShadow:'inset 0 -6px 0 rgba(0,0,0,0.18), 0 6px 0 rgba(42,27,61,0.35)',
          display:'flex', alignItems:'center', justifyContent:'center',
        }}>
          <TileArt mod={mod} size={64} bare />
        </div>
        <span style={{
          fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'clamp(13px,1.6vw,15px)', lineHeight:1.15,
          color:'var(--px-ink)', textAlign:'center', background:'rgba(255,253,247,0.92)', borderRadius:10,
          padding:'3px 8px', border:'2px solid rgba(42,27,61,0.25)',
        }}>{mod.title}</span>
        <span aria-hidden="true" style={{ display:'flex', gap:2, minHeight:16 }}>
          {[1, 2, 3].map(i => <PxStar key={i} size={15} off={i > sure} />)}
        </span>
      </motion.button>

      {canPick && (
        <button className="px-btn px-btn--parch" onClick={() => onLevels(mod)}
          aria-label={`${mod.title}: Level wählen`}
          style={{ position:'absolute', top:-6, right:-4, height:44, minWidth:44, padding:'0 6px', fontSize:14, gap:2 }}>
          <PxStar size={14} /> {curLevel}
        </button>
      )}
    </motion.div>
  )
}

// Each world plays on its own little stage (components/play/Scene.jsx)
const WORLD_SCENE = { zahlen: 'market', buchstaben: 'forest', denken: 'night', gefuehle: 'meadow', malen: 'room' }

function WorldStage({ world, mods, progress, onPlay, onLevels, offset }) {
  return (
    <section aria-label={world.label} style={{
      position:'relative', overflow:'hidden', borderRadius:20, border:'4px solid var(--px-ink)',
      boxShadow:'0 6px 0 rgba(42,27,61,0.35)', minHeight:220, display:'flex', flexDirection:'column',
    }}>
      <Scene theme={WORLD_SCENE[world.id] ?? 'meadow'} />
      <button className="px-ribbon" onClick={() => narrate([line(`menue/welt-${world.id}`)])}
        aria-label={`${world.label}-Welt vorlesen`}
        style={{ position:'relative', alignSelf:'flex-start', margin:'12px 0 0 12px', fontSize:18, padding:'4px 16px 6px', cursor:'pointer', border:'none' }}>
        {world.emoji} {world.label}
      </button>
      <div style={{ position:'relative', display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'clamp(10px,2vw,18px)', padding:'16px 12px 18px' }}>
        {mods.map((mod, i) => (
          <GameBubble key={mod.id} mod={mod} p={progress[mod.id] ?? {}} index={offset + i} onPlay={onPlay} onLevels={onLevels} />
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
function LumiIdea({ idea, plan, onPlay, onAlbum, stickers, narrow }) {
  const allDone = !idea
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'wrap',
      gap:'clamp(12px,3vw,40px)', padding:'clamp(8px,2vw,20px) 16px 0',
    }}>
      <div style={{ paddingTop: narrow ? 70 : 84 }}>
        <Critter art="lumi" size={narrow ? 120 : 170} mood={allDone ? 'dance' : 'idle'} talks label="Lumi"
          wish={idea ? <TileArt mod={idea.mod} size={narrow ? 48 : 60} bare /> : <Art art="⭐" size={narrow ? 40 : 52} />}
          wishSide={narrow ? 'top' : 'right'} />
      </div>
      <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }} transition={{ type:'spring', stiffness:260, damping:18, delay:0.2 }}
        className="px-panel" style={{ padding:'14px 18px', display:'flex', flexDirection:'column', alignItems:'center', gap:10, minWidth:'min(100%, 280px)' }}>
        {idea ? (<>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <TileArt mod={idea.mod} size={narrow ? 56 : 72} />
            <div style={{ fontFamily:'var(--font-heading)', fontWeight:700, fontSize:'clamp(20px,3vw,28px)', color:'var(--px-ink)', lineHeight:1.1 }}>
              {idea.mod.title}
            </div>
          </div>
          <button className="px-btn px-btn--green px-btn--lg" onClick={onPlay}
            aria-label={`Lumis Idee: ${idea.mod.title} spielen`} style={{ width:'100%' }}>
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
        <button onClick={() => narrate([{ text: allDone
            ? 'Du hast alle Ideen von heute gespielt! Morgen hat Lumi neue.'
            : 'Das sind Lumis Ideen für heute. Wenn du alle gespielt hast, bekommst du einen Sticker für dein Album!' }])}
          aria-label={`${plan.done} von ${plan.total} Ideen gespielt, ${stickers} Sticker`}
          style={{ all:'unset', cursor:'pointer', display:'flex', alignItems:'center', gap:6, minHeight:44 }}>
          {Array.from({ length: plan.total }, (_, i) => (
            <span key={i} className={`px-pip${i < plan.done ? ' px-pip--gold' : ''}`} style={{ width:16, height:16 }} />
          ))}
          <img src={journeyArt(allDone ? 'chest-open.png' : 'chest.png')} alt="" style={{ width:30, height:30, imageRendering:'pixelated' }} />
        </button>
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

  return (
    // overflow-x clip, not hidden: hidden made this div a scroll container,
    // and the sticky HUD stuck to it instead of the window — it scrolled away.
    <div className="home-bg" style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', position:'relative', overflowX:'clip', isolation:'isolate' }}>

      {/* ── A living meadow behind everything: the sun and the clouds can be tapped ── */}
      <div style={{ position:'fixed', inset:0, zIndex:-1 }}>
        <Scene theme="meadow" interactive />
      </div>

      {/* ── HUD ── */}
      <HudBar style={{ position:'sticky', top:0, zIndex:20 }}>
        <button
          className="px-btn px-btn--parch"
          onClick={() => setShowSwitcher(true)}
          style={{ width:56, height:56, padding:0, fontSize:32, lineHeight:1, flexShrink:0 }}
          title="Profil wechseln"
          aria-label="Profil wechseln"
        >{profile.avatar}</button>
        <div style={{ minWidth:0, flex:1 }}>
          <div className="px-title hud-hide-sm" style={{ fontSize:'clamp(14px,2.4vw,16px)', lineHeight:1.2, letterSpacing:0, textShadow:'-1px -1px 0 var(--px-ink), 1px -1px 0 var(--px-ink), -1px 1px 0 var(--px-ink), 1px 2px 0 var(--px-ink)' }}>
            {timeGreeting(t)},
          </div>
          <div className="px-title" style={{ fontSize:'clamp(18px,3.6vw,26px)', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {profile.name}!
          </div>
        </div>
        <div className="px-chip hud-hide-sm" title="Gesammelte Sterne" aria-label={`${totalStarsCount} Sterne`} style={{ flexShrink:0 }}>
          <PxStar size={22} /> {totalStarsCount}
        </div>
        {/* the streak from day two on, on every device */}
        {streak.count >= 2 && (
          <div className="px-chip" title="Tage in Folge gespielt" aria-label={`${streak.count} Tage in Folge`} style={{ flexShrink:0 }}>
            <span className="px-chip-icon" style={{ fontSize:18, lineHeight:'22px', textAlign:'center' }}>🔥</span> {streak.count}
          </div>
        )}
        <button className="px-btn px-btn--parch px-btn--icon" onClick={openAlbum}
          aria-label={`Mein Album, ${stickers} Sticker`} title="Mein Album" style={{ flexShrink:0, width:56, height:56, padding:0 }}>
          <img src={journeyArt('album.png')} alt="" style={{ width:36, height:36, imageRendering:'pixelated' }} />
        </button>
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
        <LumiIdea idea={idea} plan={plan} onPlay={playIdea} onAlbum={openAlbum} stickers={stickers} narrow={narrow} />

        {/* ── The worlds, each on its own little stage ── */}
        <div style={{
          display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 340px), 1fr))',
          gap:'clamp(14px,2.4vw,24px)', padding:'clamp(18px,3vw,30px) clamp(12px,4vw,40px) clamp(28px,4vw,44px)', alignItems:'start',
          maxWidth:1280, width:'100%', alignSelf:'center',
        }}>
          {worlds.map(({ world, mods }, wi) => (
            <WorldStage key={world.id} world={world} mods={mods} progress={progress}
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
