import { useState, useEffect, useMemo, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useApp, MAX_LEVELS, missionDef, farmPoints, todayMs } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import { PxStar, PxIcon, HudBar, uiSpr } from '../components/PixelUI.jsx'
import TileArt from '../components/TileArt.jsx'
import FarmProgress, { animalsFor, einTier } from '../components/FarmProgress.jsx'
import ProfileSwitcher from '../components/ProfileSwitcher.jsx'
import LevelPicker, { unlockedUpTo } from '../components/LevelPicker.jsx'
import MusicButton from '../components/MusicControls.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import ErrorBoundary from '../components/ErrorBoundary.jsx'
import { useProfile } from '../hooks/useProfile.js'
import { readStore, writeStore } from '../hooks/safeStorage.js'
import { narrate, stopNarration } from '../narrator.js'
import { sayNumber } from '../tts.js'
import { hearable } from '../lib/hearable.js'
import { lazyWithReload } from '../lib/lazyWithReload.js'
import { MODULES, WORLDS, MODULE_BY_ID, recommend, sortForAge } from '../modules.js'
import { prefetchGame, isGameLoaded } from './GameScreen.jsx'

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

/** What Lumi says when a child arrives — not the same sentence every time. */
function greetingParts({ t, profile, streak, lastPlayed, openMission, animals }) {
  const name = profile.name
  const hello = `${timeGreeting(t)}, ${name}!`
  const isNew = !lastPlayed
  if (isNew) {
    const farm = animals.length ? ` Auf deinem Hof wohnt schon ${einTier(animals[0])}.` : ''
    return [{ text: `${hello} Ich bin Lumi. Tippe auf ein Spiel, dann spielen wir zusammen.${farm}` }]
  }
  const n = parseInt(readStore('lumi_greet_n', '0'), 10) || 0
  writeStore('lumi_greet_n', n + 1)
  const lastTitle = MODULE_BY_ID[lastPlayed.moduleId]?.title
  const options = [
    // the recording "Hallo du, willkommen zurück zu Lumi! …"
    [{ src: WELCOME_BACK, text: `Hallo ${name}, willkommen zurück! Mach direkt da weiter, wo wir aufgehört haben, oder versuche etwas Neues.` }],
    [{ text: `${hello} Schön, dass du wieder da bist.${lastTitle ? ` Beim letzten Mal hast du ${lastTitle} gespielt.` : ''}` }],
    streak >= 2 && [{ text: `${hello} Du spielst schon ${sayNumber(streak)} Tage hintereinander. Super!` }],
    openMission && [{ text: `${hello} Heute wartet eine Aufgabe auf dich. ${t('mission.say.' + openMission.id)}` }],
  ].filter(Boolean)
  return options[n % options.length]
}

// ── A game tile ─────────────────────────────────────────────────────────────
// The tile starts the game at the current level (the level sheet used to
// come first, one tap more every time). 🔊 says what the game is — on a
// tablet there is no pointing at a tile to hear it.
function GameTile({ mod, p, index, badge, onPlay, onLevels, big = false }) {
  const maxLvl     = MAX_LEVELS[mod.id] ?? 10
  const levelStars = p.levelStars ?? {}
  const isCompleted= p.completed ?? false
  const curLevel   = p.currentLevel ?? 1
  const canPick    = unlockedUpTo(p, maxLvl) > 1
  const bestTotal  = Object.values(levelStars).reduce((a, b) => a + (b ?? 0), 0)
  const headH = big ? 'clamp(96px,12vw,124px)' : 'clamp(84px,11vw,112px)'

  return (
    <motion.div
      className="px-panel lumi-card"
      custom={index}
      initial="hidden"
      animate="visible"
      variants={cardVariants}
      whileHover={{ y:-6 }}
      style={{ padding:0, overflow:'hidden', display:'flex', flexDirection:'column', minWidth:0, position:'relative' }}
    >
      <button
        onClick={() => onPlay(mod)}
        onPointerEnter={() => prefetchGame(mod.id)}
        onFocus={() => prefetchGame(mod.id)}
        {...hearable(mod.say)}
        aria-label={`${mod.title}, Level ${curLevel} von ${maxLvl}, ${bestTotal} Sterne. Spielen`}
        style={{ display:'flex', flexDirection:'column', textAlign:'left', flex:1, padding:0, background:'none', border:'none', minHeight:0, cursor:'pointer' }}
      >
        {/* Bild */}
        <div className="card-header-shine" style={{
          background: mod.color,
          borderBottom:'3px solid var(--px-ink)',
          height: headH, width:'100%',
          display:'flex', alignItems:'center', justifyContent:'center',
          position:'relative', overflow:'hidden',
        }}>
          <div aria-hidden="true" style={{
            position:'absolute', inset:0,
            background:'repeating-linear-gradient(45deg, rgba(255,255,255,0.10) 0 10px, transparent 10px 20px)',
          }} />
          <div className="emoji-float" style={{ '--float-dur': `${2.6 + (index % 4) * 0.55}s`, zIndex:1, marginTop:8 }}>
            <TileArt mod={mod} size={big ? 84 : 76} bare />
          </div>
        </div>

        {/* Text + Fortschritt */}
        <div style={{ padding:'10px 12px 12px', display:'flex', flexDirection:'column', gap:8, flex:1, width:'100%' }}>
          <div>
            <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(17px,2.4vw,21px)', color:'var(--px-ink)', fontWeight:700, lineHeight:1.15 }}>
              {mod.title}
            </div>
            <div style={{ fontFamily:'var(--font-body)', fontSize:15, color:'var(--text-secondary)', marginTop:2, fontWeight:700, lineHeight:1.25 }}>
              {mod.sub}
            </div>
          </div>

          {/* one pip per level, all in one row (they broke 9 + 1) */}
          <div aria-hidden="true" style={{ display:'grid', gridTemplateColumns:`repeat(${maxLvl}, minmax(0, 16px))`, gap:3 }}>
            {Array.from({ length: maxLvl }).map((_, li) => {
              const lv = li + 1
              const s  = levelStars[lv] ?? 0
              return (
                <div key={li}
                  className={`px-pip${s >= 3 ? ' px-pip--gold' : s >= 1 ? ' px-pip--done' : ''}${lv === curLevel && !isCompleted ? ' px-pip--current' : ''}`}
                  style={{ width:'100%', height:12 }}
                />
              )
            })}
          </div>

          <span className="px-btn px-btn--green px-btn--sm" style={{ marginTop:'auto', width:'100%' }}>
            <PxIcon name="play" size={16} /> Spielen
          </span>
        </div>
      </button>

      {/* Hear the game */}
      <button className="px-btn px-btn--parch" onClick={() => narrate([{ text: mod.say }])}
        aria-label={`${mod.title} vorlesen`}
        style={{ position:'absolute', top:6, left:6, width:44, height:44, padding:0, fontSize:20, zIndex:2 }}>
        🔊
      </button>

      {/* Another level */}
      {canPick && (
        <button className="px-btn px-btn--parch" onClick={() => onLevels(mod)}
          aria-label={`${mod.title}: Level wählen`}
          style={{ position:'absolute', top:6, right:6, height:44, minWidth:44, padding:'0 8px', fontSize:15, zIndex:2, gap:3 }}>
          <PxStar size={16} /> {curLevel}
        </button>
      )}

      {(badge || isCompleted) && (
        <div className="px-chip" style={{
          position:'absolute', top:`calc(${headH} - 16px)`, right:8, fontSize:14, minHeight:28, padding:'2px 8px', zIndex:2,
          fontFamily:'var(--font-heading)', pointerEvents:'none',
          ...(badge === 'continue' || badge === 'new' ? { background:'var(--px-gold)', color:'var(--px-ink)', textShadow:'none' } : null),
        }}>
          {isCompleted ? '🏆 Meister' : badge === 'continue' ? 'Weiter' : 'Neu'}
        </div>
      )}
    </motion.div>
  )
}

// ── Today's missions ────────────────────────────────────────────────────────
// Pictures with progress (🎮 ■■□), spoken when tapped — they were text chips
// a child who can't read could do nothing with.
function MissionChip({ m, day, t }) {
  const def = missionDef(m.id)
  if (!def) return null
  const have = Math.min(def.goal, def.count(day))
  const done = (day.completedIds ?? []).includes(m.id) || have >= def.goal
  const say = () => narrate([{ text: done
    ? `${t('mission.say.' + m.id)} Geschafft! Super!`
    : `${t('mission.say.' + m.id)}${def.goal > 1 ? ` Du hast schon ${sayNumber(have)} von ${sayNumber(def.goal)}.` : ''}` }])
  return (
    <button className="px-panel" onClick={say}
      aria-label={`${t('mission.' + m.id)}: ${done ? 'geschafft' : `${have} von ${def.goal}`}`}
      style={{
        display:'flex', alignItems:'center', gap:8, padding:'6px 12px', minHeight:44, cursor:'pointer',
        background: done ? '#d9f5c8' : undefined,
      }}>
      <span style={{ fontSize:20 }}>{done ? '✅' : m.icon}</span>
      <span aria-hidden="true" style={{ display:'flex', gap:3 }}>
        {Array.from({ length: def.goal }).map((_, i) => (
          <span key={i} className={`px-pip${i < have ? ' px-pip--gold' : ''}`} style={{ width:14, height:14 }} />
        ))}
      </span>
      {/* on a phone picture and boxes only, in one row; tapping says it */}
      <span className="hud-hide-sm" style={{
        fontFamily:'var(--font-heading)', fontWeight:600,
        color:'var(--px-ink)', fontSize:15, whiteSpace:'nowrap',
        textDecoration: done ? 'line-through' : 'none',
      }}>{t('mission.' + m.id)}</span>
    </button>
  )
}

export default function HomeScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  const { profile: activeProfile, progress, streak, dailyMission, lastPlayed } = useProfile()
  const profile = activeProfile ?? { name: 'Kind', avatar: '😊' }
  const [showParent, setShowParent] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [pickerMod, setPickerMod]       = useState(null)
  const [activeWorld, setActiveWorld]   = useState('all')
  const [offline, setOffline]           = useState(false)

  const points  = farmPoints(activeProfile)
  const animals = animalsFor(points)
  const totalStarsCount = Object.values(progress)
    .reduce((sum, p) => sum + Object.values(p?.levelStars ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0)

  const day = dailyMission ?? {}
  const openMission = (day.missions ?? []).find(m => !(day.completedIds ?? []).includes(m.id))

  // Three to six games first, chosen by age and progress, instead of all
  // 24 at once (the age was asked and never used)
  const picks = useMemo(() => recommend({
    progress, profile: activeProfile, lastPlayed,
    playedToday: day.playedIds ?? [],
  }), [activeProfile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const worldModules = useMemo(() => sortForAge(
    activeWorld === 'all' ? MODULES : MODULES.filter(m => m.world === activeWorld), activeProfile,
  ), [activeWorld, activeProfile?.age]) // eslint-disable-line react-hooks/exhaustive-deps

  // Daily time limit (parent area)
  const limitMin = state.settings?.dailyLimitMin ?? 0
  const timeUp = limitMin > 0 && todayMs(activeProfile) >= limitMin * 60000

  // Greeting — once per app open and child
  useEffect(() => {
    if (!activeProfile || greeted.has(activeProfile.id)) return
    greeted.add(activeProfile.id)
    const id = setTimeout(() => {
      if (timeUp) return
      narrate(greetingParts({ t, profile, streak: streak.count, lastPlayed, openMission, animals }))
    }, 800)
    return () => clearTimeout(id)
  }, [activeProfile?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Time is up: Lumi says so, kindly
  useEffect(() => {
    if (!timeUp) return
    const id = setTimeout(() => narrate([{ text: 'Für heute ist die Spielzeit vorbei. Lumi ruht sich jetzt aus. Morgen spielen wir weiter!' }]), 600)
    return () => clearTimeout(id)
  }, [timeUp])

  // The games recommended here can be started without waiting, even offline
  useEffect(() => {
    const idle = window.requestIdleCallback ?? (cb => setTimeout(cb, 2500))
    const cancel = window.cancelIdleCallback ?? clearTimeout
    const id = idle(() => picks.forEach(({ mod }) => prefetchGame(mod.id)))
    return () => cancel(id)
  }, [picks])

  const startModule = (mod, level) => {
    // Without a connection a game that is not loaded yet can't start; the
    // page used to reload silently and then show "Fehler im Spiel".
    if (navigator.onLine === false && !isGameLoaded(mod.id)) {
      setOffline(true)
      narrate([{ text: 'Oh, Lumi braucht Internet, um dieses Spiel zu holen. Spiel solange ein anderes Spiel, oder versuch es gleich noch einmal.' }])
      return
    }
    // the greeting ran on into the game (it ended after the game was shown)
    stopNarration()
    const p = progress[mod.id] ?? { currentLevel:1 }
    dispatch({ type:'START_GAME', payload:{ moduleId: mod.id, level: level ?? p.currentLevel ?? 1 } })
  }

  const chooseWorld = (id) => {
    setActiveWorld(id)
    const w = WORLDS.find(x => x.id === id)
    narrate([{ text: w ? w.say : 'Alle Spiele.' }])
  }

  const greetingLine = timeGreeting(t)

  return (
    // isolation: the page gets its own stacking context, so the landscape
    // layers (negative z-index) sit above its background colour, not below.
    // overflow-x clip, not hidden: hidden made this div a scroll container,
    // and the sticky HUD stuck to it instead of the window — it scrolled away.
    <div className="home-bg" style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', position:'relative', overflowX:'clip', isolation:'isolate' }}>

      {/* ── Pixel landscape behind everything ── */}
      <div aria-hidden="true" className="px-art" style={{
        position:'fixed', inset:0, zIndex:-2,
        backgroundImage:`url(${uiSpr('landscape.png')})`,
        backgroundSize:'cover', backgroundPosition:'center 70%',
        imageRendering:'pixelated',
      }} />
      <div aria-hidden="true" style={{
        position:'fixed', inset:0, zIndex:-1, pointerEvents:'none',
        background:'linear-gradient(180deg, rgba(255,244,218,0) 0%, rgba(255,244,218,0.18) 45%, rgba(255,244,218,0.55) 100%)',
      }} />

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
            {greetingLine},
          </div>
          <div className="px-title" style={{ fontSize:'clamp(18px,3.6vw,26px)', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {profile.name}!
          </div>
        </div>
        {/* on a phone the stars give way: the farm shows what they are for */}
        <div className="px-chip hud-hide-sm" title="Gesammelte Sterne" aria-label={`${totalStarsCount} Sterne`} style={{ flexShrink:0 }}>
          <PxStar size={22} /> {totalStarsCount}
        </div>
        {/* the streak from day two on, on every device */}
        {streak.count >= 2 && (
          <div className="px-chip" title="Tage in Folge gespielt" aria-label={`${streak.count} Tage in Folge`} style={{ flexShrink:0 }}>
            <span className="px-chip-icon" style={{ fontSize:18, lineHeight:'22px', textAlign:'center' }}>🔥</span> {streak.count}
          </div>
        )}
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
              onClick={() => narrate([{ text: 'Für heute ist die Spielzeit vorbei. Lumi ruht sich jetzt aus. Morgen spielen wir weiter!' }])}>
              🔊 Nochmal hören
            </button>
          </div>
        </div>
      ) : (<>

      {/* ── Title over the sky ── */}
      <div style={{ textAlign:'center', padding:'clamp(12px,2.4vw,24px) 16px clamp(8px,1.4vw,14px)' }}>
        <h1 className="px-title" style={{ fontSize:'clamp(24px,4.4vw,38px)', lineHeight:1.15 }}>
          Was möchtest du heute spielen?
        </h1>
      </div>

      {/* ── Tagesaufgaben ── */}
      {(day.missions ?? []).length > 0 && (
        <div style={{
          display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap',
          padding:'0 16px', marginBottom:14,
        }}>
          {(day.missions ?? []).map(m => m && <MissionChip key={m.id} m={m} day={day} t={t} />)}
        </div>
      )}

      {/* ── Für dich ── */}
      <section aria-label="Für dich" style={{ padding:'0 clamp(16px,4vw,40px)', marginBottom:18, maxWidth:1240, width:'100%', alignSelf:'center' }}>
        <div className="px-ribbon" style={{ fontSize:18, padding:'4px 16px 6px', marginBottom:10 }}>⭐ Für dich</div>
        <div className="module-grid" style={{
          display:'grid',
          // four in a row from a tablet up (three columns left one alone)
          gridTemplateColumns:'repeat(auto-fit, minmax(min(100%, 168px), 1fr))',
          gap:'clamp(12px,2vw,20px)',
        }}>
          {picks.map(({ mod, why }, i) => (
            <GameTile key={mod.id} mod={mod} p={progress[mod.id] ?? {}} index={i} big
              badge={why === 'continue' ? 'continue' : why === 'new' ? 'new' : null}
              onPlay={m => startModule(m)} onLevels={setPickerMod} />
          ))}
        </div>
      </section>

      {/* ── Farm Progress (compact) ── */}
      <div style={{ padding:'0 16px', marginBottom:18, display:'flex', justifyContent:'center' }}>
        <div style={{ width:'100%', maxWidth:560 }}>
          <FarmProgress points={points} />
        </div>
      </div>

      {/* ── Themenwelten ── */}
      <section aria-label="Alle Spiele" style={{ padding:'0 clamp(16px,4vw,40px)', maxWidth:1240, width:'100%', alignSelf:'center' }}>
        <div className="px-ribbon" style={{ fontSize:18, padding:'4px 16px 6px', marginBottom:10 }}>🗺️ Alle Spiele</div>
        {/* wraps instead of scrolling sideways out of sight */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:14 }}>
          {[{ id:'all', label:'Alle', emoji:'⭐' }, ...WORLDS].map(w => {
            const active = activeWorld === w.id
            return (
              <button
                key={w.id}
                className={`px-btn px-btn--sm ${active ? 'px-btn--gold' : 'px-btn--parch'}`}
                aria-pressed={active}
                onClick={() => chooseWorld(w.id)}
                style={{ flex:'1 1 auto', minWidth:96 }}
              >
                {w.emoji} {w.label}
              </button>
            )
          })}
        </div>
      </section>

      <div className="module-grid" style={{
        flex:1,
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 200px), 1fr))',
        gap:'clamp(12px,2vw,20px)',
        padding:'0 clamp(16px,4vw,40px) clamp(28px,4vw,44px)',
        alignContent:'start', maxWidth:1240, width:'100%', alignSelf:'center',
      }}>
        {worldModules.map((mod, i) => (
          <GameTile key={mod.id} mod={mod} p={progress[mod.id] ?? {}} index={i}
            onPlay={m => startModule(m)} onLevels={setPickerMod} />
        ))}
      </div>
      </>)}

      {offline && (
        <div className="px-backdrop" onClick={() => setOffline(false)}>
          <div className="px-panel" role="alertdialog" aria-label="Keine Internetverbindung" onClick={e => e.stopPropagation()}
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
