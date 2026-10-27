import React, { useState, useEffect, useMemo, Suspense } from 'react'
import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import { useApp } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import { MAX_LEVELS } from '../AppContext.jsx'
import { PxStar, PxStars, HudBar, uiSpr } from '../components/PixelUI.jsx'
import TileArt from '../components/TileArt.jsx'
import FarmProgress from '../components/FarmProgress.jsx'
import ProfileSwitcher from '../components/ProfileSwitcher.jsx'
import LevelPicker, { unlockedUpTo } from '../components/LevelPicker.jsx'
import { useProfile } from '../hooks/useProfile.js'
import { speak } from '../tts.js'
import { lazyWithReload } from '../lib/lazyWithReload.js'

// Rarely opened (only via the settings gear) and pulls in its own sizeable
// UI (PIN gate, stats, error log, profile management) — no reason to ship
// it in the initial bundle every kid loading the home screen pays for.
const ParentScreen = lazyWithReload(() => import('./ParentScreen.jsx'))

// ── All modules ───────────────────────────────────────────────────────────────
const MODULES = [
  { id:'number-intro', title:'Zahlen entdecken', sub:'Zahlen 1–10',          emoji:'🧮', sciTag:'🔢 Zahlenverständnis',            gradient:'linear-gradient(135deg,#FFD93D,#FF9F43)', shadow:'rgba(255,217,61,0.45)'  },
  { id:'letter-intro', title:'ABC-Abenteuer',    sub:'Das Alphabet erleben', emoji:'🔡', sciTag:'✏️ Buchstabenerkennung',           gradient:'linear-gradient(135deg,#74B9FF,#6C63FF)', shadow:'rgba(116,185,255,0.45)'  },
  { id:'emotions',     title:'Gefühlswelt',      sub:'Emotionen erkennen',   emoji:'😊', sciTag:'❤️ Sozial-Emotionales Lernen',    gradient:'linear-gradient(135deg,#A29BFE,#6C63FF)', shadow:'rgba(162,155,254,0.45)'             },
  { id:'listen',       title:'Hörabenteuer',     sub:'Hören & Erkennen',     emoji:'🔊', sciTag:'👂 Phonologisches Bewusstsein',    gradient:'linear-gradient(135deg,#FF6B6B,#FF8E53)', shadow:'rgba(255,107,107,0.45)'  },
  { id:'shadows',      title:'Schattenrätsel',   sub:'Silhouetten erkennen', emoji:'🌑', sciTag:'👁️ Visuelle Wahrnehmung',          gradient:'linear-gradient(135deg,#1a0533,#4A00E0)', shadow:'rgba(26,5,51,0.5)'  },
  { id:'shapes',       title:'Farbenreich',      sub:'Formen bemalen',       emoji:'🎨', sciTag:'🎨 Dual-Coding & Kreativität',    gradient:'linear-gradient(135deg,#74B9FF,#0984E3)', shadow:'rgba(116,185,255,0.45)'             },
  { id:'numbers',      title:'Zahlenland',       sub:'Zählen & Rechnen',     emoji:'🔢', sciTag:'🧠 Logik & Mathematik',            gradient:'linear-gradient(135deg,#6BCB77,#44D498)', shadow:'rgba(107,203,119,0.45)'             },
  { id:'letters',      title:'Buchstabenwald',   sub:'Buchstaben tippen',    emoji:'⌨️', sciTag:'✏️ Schreibbereitschaft',           gradient:'linear-gradient(135deg,#6C63FF,#A78BFA)', shadow:'rgba(108,99,255,0.45)'              },
  { id:'words2',       title:'Silben-Spaß',      sub:'Wörter zusammenbauen', emoji:'🔤', sciTag:'📖 Phonologisches Bewusstsein',    gradient:'linear-gradient(135deg,#6BCB77,#0984E3)', shadow:'rgba(107,203,119,0.45)'  },
  { id:'bubbles',      title:'Blasen-Blitz',     sub:'Zahlen-Blasen poppen', emoji:'🫧', sciTag:'⚡ Subitizing & Reaktion',          gradient:'linear-gradient(135deg,#FF6B6B,#FFD93D)', shadow:'rgba(255,107,107,0.45)'  },
  { id:'words',        title:'Memo-Welt',        sub:'Paare finden',         emoji:'🃏', sciTag:'💭 Arbeitsgedächtnis',             gradient:'linear-gradient(135deg,#FD79A8,#E84393)', shadow:'rgba(253,121,168,0.45)'             },
  { id:'patterns',     title:'Musterpark',       sub:'Reihen & Logik',       emoji:'🔮', sciTag:'🔄 Mustererkennung',               gradient:'linear-gradient(135deg,#FF9F43,#EE5A24)', shadow:'rgba(255,159,67,0.45)'              },
  { id:'sort',         title:'Sortier-Spaß',     sub:'Alles an seinen Platz',emoji:'🧺', sciTag:'🧩 Kategorisieren & Konzeptbildung',gradient:'linear-gradient(135deg,#FF9F43,#6BCB77)',shadow:'rgba(255,159,67,0.45)'  },
  { id:'weight',       title:'Waage-Welt',       sub:'Was ist schwerer?',    emoji:'⚖️', sciTag:'⚖️ Größen & Messen',              gradient:'linear-gradient(135deg,#A29BFE,#FF9F43)', shadow:'rgba(162,155,254,0.45)'  },
  { id:'clock',        title:'Uhren-Uhr',        sub:'Zeit lesen & stellen', emoji:'🕐', sciTag:'⏰ Zeitgefühl & Sequenzierung',    gradient:'linear-gradient(135deg,#FF9F43,#FF6B6B)', shadow:'rgba(255,159,67,0.45)'  },
  { id:'maze',         title:'Lumi-Labyrinth',   sub:'Weg durchs Labyrinth', emoji:'🌀', sciTag:'🧭 Räumliches Denken & Planung',   gradient:'linear-gradient(135deg,#4A00E0,#6C3FAC)', shadow:'rgba(74,0,224,0.45)'  },
  { id:'stories',      title:'Lumis Abenteuer',  sub:'Entscheide die Story', emoji:'📖', sciTag:'🧡 Moralisches Denken & Empathie', gradient:'linear-gradient(135deg,#44D498,#6C63FF)', shadow:'rgba(68,212,152,0.45)'  },
  { id:'rocket-math', title:'Rechen-Rakete', sub:'Plus & Minus am Zahlenstrahl', emoji:'🚀', sciTag:'➕ Zahlenstrahl & Rechnen', gradient:'linear-gradient(135deg,#6C63FF,#00B894)', shadow:'rgba(108,99,255,0.45)' },
  { id:'shapes-land', title:'Formen-Land', sub:'Formen, Größen & Muster', emoji:'🔷', sciTag:'📐 Geometrie & Seriation', gradient:'linear-gradient(135deg,#00B894,#74B9FF)', shadow:'rgba(0,184,148,0.45)' },
  { id:'rhyme', title:'Reim-Rallye', sub:'Was reimt sich?', emoji:'🎵', sciTag:'🎶 Reimbewusstsein', gradient:'linear-gradient(135deg,#FD79A8,#FF9F43)', shadow:'rgba(253,121,168,0.45)' },
  { id:'initial-sound', title:'Anlaut-Detektiv', sub:'Welcher Buchstabe klingt so?', emoji:'🕵️', sciTag:'🔤 Laut-Buchstaben-Zuordnung', gradient:'linear-gradient(135deg,#74B9FF,#44D498)', shadow:'rgba(116,185,255,0.45)' },
  { id:'empathy', title:'Gefühlsdetektiv', sub:'Gefühle sehen & helfen', emoji:'🕵️‍♀️', sciTag:'💛 Perspektivübernahme & Empathie', gradient:'linear-gradient(135deg,#E84393,#A29BFE)', shadow:'rgba(232,67,147,0.45)' },
  { id:'shape-build', title:'Formen-Werkstatt', sub:'Aus Formen bauen', emoji:'🧩', sciTag:'🧱 Teil-Ganzes & Komposition', gradient:'linear-gradient(135deg,#FF9F43,#A29BFE)', shadow:'rgba(255,159,67,0.45)' },
  { id:'coloring',     title:'Mal-Atelier',       sub:'Ausmalen & Kreativ',   emoji:'🖍️', sciTag:'🎨 Kreativität & Feinmotorik',   gradient:'linear-gradient(135deg,#FD79A8,#E84393)', shadow:'rgba(253,121,168,0.45)' },
]

const CATEGORIES = [
  { id: 'all',      label: '⭐ Alle',    color: '#6C63FF' },
  { id: 'math',     label: '🔢 Mathe',   color: '#6BCB77' },
  { id: 'language', label: '✏️ Sprache', color: '#74B9FF' },
  { id: 'creative', label: '🎨 Kreativ', color: '#FD79A8' },
  { id: 'think',    label: '🧩 Denken',  color: '#FF9F43' },
  { id: 'social',   label: '😊 Sozial',  color: '#A29BFE' },
]

const CATEGORY_MAP = {
  math:     ['shapes-land', 'rocket-math', 'numbers', 'number-intro', 'bubbles', 'weight', 'clock'],
  language: ['initial-sound', 'rhyme', 'letters', 'letter-intro', 'words', 'words2', 'listen', 'shadows'],
  creative: ['shapes', 'coloring'],
  think:    ['shape-build', 'patterns', 'sort', 'maze'],
  social:   ['empathy', 'emotions', 'stories'],
}

const cardVariants = {
  hidden:  { opacity:0, y:44, scale:0.88 },
  visible: (i) => ({ opacity:1, y:0, scale:1, transition:{ delay: i*0.055, type:'spring', stiffness:340, damping:18 } }),
}

// Module-level (not component state): HomeScreen remounts fresh every time
// the router switches state.screen back to 'home' (App.jsx keys the screen
// on state.screen inside AnimatePresence), so a plain useEffect([]) fires
// on every return trip, not just the app's initial load. This flag lives
// outside the component so it survives those remounts and only resets on
// an actual page reload — i.e. once per app open, as intended.
let hasGreetedThisSession = false

export default function HomeScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  const { profile: activeProfile, progress, streak, dailyMission, lastPlayed } = useProfile()
  const profile = activeProfile ?? { name: 'Lumi', avatar: '🦊' }
  const [showParent, setShowParent] = useState(false)
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [pickerMod, setPickerMod]       = useState(null)
  const [activeCategory, setActiveCategory] = useState('all')
  const completedCount = Object.values(progress).filter(p => p?.completed).length

  const getGreeting = () => {
    const h = new Date().getHours()
    if (h < 12) return t('home.morning')
    if (h < 17) return t('home.afternoon')
    return t('home.evening')
  }

  const filteredModules = useMemo(() => {
    if (activeCategory === 'all') return MODULES
    return MODULES.filter(m => (CATEGORY_MAP[activeCategory] ?? []).includes(m.id))
  }, [activeCategory])

  const lastPlayedModule = lastPlayed?.moduleId
    ? MODULES.find(m => m.id === lastPlayed.moduleId)
    : null

  // Greeting TTS — once per app open, not on every return to this screen
  // (see hasGreetedThisSession above).
  useEffect(() => {
    if (hasGreetedThisSession) return
    hasGreetedThisSession = true
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Guten Morgen' : hour < 17 ? 'Hallo' : 'Guten Abend'
    setTimeout(() => {
      speak(`${greeting}, ${profile.name}! Was möchtest du heute lernen?`, { rate: 0.85, pitch: 1.1, lang: 'de-DE' })
    }, 800)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps



  const getModuleTitle = (id, fallback) => t('module.' + id, fallback)
  const getModuleSub = (id) => {
    const subs = {
      de: {
        'number-intro':'Zahlen 1–10','letter-intro':'Das Alphabet erleben',
        'emotions':'Emotionen erkennen','listen':'Hören & Erkennen',
        'shadows':'Silhouetten erkennen','shapes':'Formen bemalen',
        'numbers':'Zählen & Rechnen','letters':'Buchstaben tippen',
        'words2':'Wörter zusammenbauen','bubbles':'Zahlen-Blasen poppen',
        'words':'Paare finden','patterns':'Reihen & Logik',
        'sort':'Alles an seinen Platz','weight':'Was ist schwerer?',
        'clock':'Zeit lesen & stellen','maze':'Weg durchs Labyrinth',
        'stories':'Entscheide die Story',
      },
      en: {
        'number-intro':'Numbers 1–10','letter-intro':'Explore the Alphabet',
        'emotions':'Recognize Emotions','listen':'Listen & Identify',
        'shadows':'Identify Silhouettes','shapes':'Paint Shapes',
        'numbers':'Count & Calculate','letters':'Type Letters',
        'words2':'Build Words','bubbles':'Pop Number Bubbles',
        'words':'Find Pairs','patterns':'Sequences & Logic',
        'sort':'Sort Everything','weight':'What is heavier?',
        'clock':'Read & Set Clocks','maze':'Find the Path',
        'stories':'Choose the Story',
      }
    }
    const lang = state.language ?? 'en'
    return (subs[lang] ?? subs.en)[id] ?? ''
  }
  const startModule = (mod) => {
    const p = progress[mod.id] ?? { currentLevel:1 }
    dispatch({ type:'START_GAME', payload:{ moduleId: mod.id, level: p.currentLevel ?? 1 } })
  }
  // Kachel: sobald mehr als Level 1 freigespielt ist, erst die Levelauswahl;
  // beim allerersten Spielen geht es ohne Umweg los.
  const openModule = (mod) => {
    if (unlockedUpTo(progress[mod.id], MAX_LEVELS[mod.id] ?? 10) > 1) setPickerMod(mod)
    else startModule(mod)
  }

  const totalStars = Object.values(progress)
    .reduce((sum, p) => sum + Object.values(p?.levelStars ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0)

  return (
    // isolation: the page gets its own stacking context, so the landscape
    // layers (negative z-index) sit above its background colour, not below.
    <div className="home-bg" style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', position:'relative', overflowX:'hidden', isolation:'isolate' }}>

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
      <HudBar style={{ position:'sticky', top:0 }}>
        <button
          className="px-btn px-btn--parch"
          onClick={() => setShowSwitcher(true)}
          style={{ width:56, height:56, padding:0, fontSize:32, lineHeight:1 }}
          title="Profil wechseln"
          aria-label="Profil wechseln"
        >{profile.avatar}</button>
        <div style={{ minWidth:0 }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(12px,2.4vw,15px)', color:'rgba(255,255,255,0.9)', textShadow:'0 2px 0 rgba(0,0,0,0.35)' }}>
            {getGreeting()},
          </div>
          <div className="px-title" style={{ fontSize:'clamp(18px,3.6vw,26px)', lineHeight:1.1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
            {profile.name}!
          </div>
        </div>
        <div style={{ flex:1 }} />
        <div className="px-chip" title="Gesammelte Sterne" aria-label={`${totalStars} Sterne`}>
          <PxStar size={22} /> {totalStars}
        </div>
        {streak.count >= 1 && (
          <div className="px-chip hud-hide-sm" title="Tage in Folge gespielt" aria-label={`${streak.count} Tage in Folge`}>
            <span className="px-chip-icon" style={{ fontSize:18, lineHeight:'22px', textAlign:'center' }}>🔥</span> {streak.count}
          </div>
        )}
        <div className="px-chip hud-hide-sm" title="Gemeisterte Spiele" aria-label={`${completedCount} von ${MODULES.length} Spielen gemeistert`}>
          <span className="px-chip-icon" style={{ fontSize:18, lineHeight:'22px', textAlign:'center' }}>🏆</span> {completedCount}/{MODULES.length}
        </div>
        <button
          className="px-btn px-btn--wood px-btn--icon"
          onClick={() => setShowParent(true)}
          title="Einstellungen"
          aria-label="Einstellungen (Elternbereich)"
        >
          <Settings size={22} color="white" />
        </button>
      </HudBar>

      {/* ── Title over the sky ── */}
      <div style={{ textAlign:'center', padding:'clamp(18px,3.5vw,34px) 16px clamp(10px,2vw,18px)' }}>
        <h1 className="px-title" style={{ fontSize:'clamp(24px,5vw,42px)', lineHeight:1.15 }}>
          Was möchtest du heute lernen?
        </h1>
      </div>

      {/* ── Tagesaufgaben ── */}
      {(dailyMission.missions ?? []).length > 0 && (
        <div style={{
          display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap',
          padding:'0 clamp(12px,3vw,24px)', marginBottom:12,
        }}>
          {(dailyMission.missions ?? []).map(m => {
            if (!m) return null
            const done = (dailyMission.completedIds ?? []).includes(m.id)
            return (
              <div key={m.id} className="px-panel" style={{
                display:'flex', alignItems:'center', gap:6, padding:'5px 12px',
                background: done ? '#d9f5c8' : undefined,
              }}>
                <span style={{ fontSize:15 }}>{done ? '✅' : m.icon}</span>
                <span style={{
                  fontFamily:'var(--font-heading)', fontWeight:600,
                  color:'var(--px-ink)', fontSize:'clamp(12px,2.5vw,14px)',
                  textDecoration: done ? 'line-through' : 'none', whiteSpace:'nowrap',
                }}>{t('mission.' + m.id)}</span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Farm Progress ── */}
      <div style={{ padding:'0 clamp(16px,4vw,40px)', marginBottom:16 }}>
        <FarmProgress completedCount={completedCount} totalModules={MODULES.length} profile={profile} />
      </div>

      {/* ── Weiterspielen ── */}
      {lastPlayedModule && (
        <motion.div
          initial={{ opacity:0, y:-12 }}
          animate={{ opacity:1, y:0 }}
          transition={{ delay:0.2 }}
          style={{ padding:'0 clamp(16px,4vw,40px)', marginBottom:14, display:'flex', justifyContent:'center' }}
        >
          <button
            className="px-panel"
            onClick={() => startModule(lastPlayedModule)}
            style={{
              width:'100%', maxWidth:720, cursor:'pointer', textAlign:'left',
              padding:'10px 12px', display:'flex', alignItems:'center', gap:14,
            }}
          >
            <TileArt mod={lastPlayedModule} size={52} />
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(12px,2.5vw,14px)', color:'var(--text-secondary)', fontWeight:600 }}>
                {t('home.continue')}
              </div>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(17px,3.2vw,21px)', color:'var(--px-ink)', fontWeight:700, lineHeight:1.15, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                {getModuleTitle(lastPlayedModule.id, lastPlayedModule.title)}
              </div>
            </div>
            <span className="px-btn px-btn--green px-btn--sm">▶ Weiter</span>
          </button>
        </motion.div>
      )}

      {/* ── Category filter ── */}
      <div style={{
        display:'flex', gap:10, overflowX:'auto', overflowY:'hidden',
        padding:'2px clamp(16px,4vw,40px) 14px', justifyContent:'safe center',
        scrollbarWidth:'none', WebkitOverflowScrolling:'touch',
      }}>
        {CATEGORIES.map(cat => {
          const active = activeCategory === cat.id
          return (
            <button
              key={cat.id}
              className={`px-btn px-btn--sm ${active ? '' : 'px-btn--parch'}`}
              aria-pressed={active}
              onClick={() => setActiveCategory(cat.id)}
              style={{
                flexShrink:0,
                ...(active ? { '--btn': cat.color, '--btn-text': '#fff', textShadow:'0 2px 0 rgba(0,0,0,0.3)' } : null),
              }}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

      {/* ── Card grid ── */}
      <div style={{
        flex:1,
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill, minmax(min(100%, 230px), 1fr))',
        gap:'clamp(14px,2.5vw,22px)',
        padding:'clamp(4px,1vw,10px) clamp(16px,4vw,40px) clamp(28px,4vw,44px)',
        alignContent:'start',
      }}>
        {filteredModules.map((mod, i) => {
          const p          = progress[mod.id] ?? { currentLevel:1, levelStars:{}, completed:false }
          const maxLvl     = MAX_LEVELS[mod.id] ?? 10
          const levelStars = p.levelStars  ?? {}
          const isCompleted= p.completed   ?? false
          const curLevel   = p.currentLevel ?? 1
          const vals       = Object.values(levelStars)
          const bestStars  = vals.length ? Math.max(...vals) : 0
          const pipColor   = mod.gradient.match(/#[0-9A-Fa-f]{6}/g)?.[0] ?? 'var(--px-green)'

          return (
            <motion.button
              key={mod.id}
              className="px-panel lumi-card"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={{ y:-6 }}
              whileTap={{ y:2 }}
              onClick={() => openModule(mod)}
              style={{
                padding:0, overflow:'hidden', cursor:'pointer',
                display:'flex', flexDirection:'column', textAlign:'left', minWidth:0,
                position:'relative',
              }}
            >
              {/* Bild */}
              <div className="card-header-shine" style={{
                background: mod.gradient,
                borderBottom:'3px solid var(--px-ink)',
                height:'clamp(92px,13vw,124px)',
                display:'flex', alignItems:'center', justifyContent:'center',
                position:'relative', overflow:'hidden',
              }}>
                <div aria-hidden="true" style={{
                  position:'absolute', inset:0,
                  background:'repeating-linear-gradient(45deg, rgba(255,255,255,0.07) 0 10px, transparent 10px 20px)',
                }} />
                <div className="emoji-float" style={{ '--float-dur': `${2.6 + (i % 4) * 0.55}s`, zIndex:1 }}>
                  <TileArt mod={mod} size={96} bare />
                </div>
                {isCompleted && (
                  <div className="px-chip" style={{ position:'absolute', top:8, right:8, fontSize:14, minHeight:28, padding:'2px 8px', zIndex:2, fontFamily:'var(--font-heading)' }}>
                    🏆 Meister
                  </div>
                )}
              </div>

              {/* Text + Fortschritt */}
              <div style={{ padding:'clamp(10px,2vw,14px) clamp(12px,2.4vw,16px) clamp(14px,2.4vw,18px)', display:'flex', flexDirection:'column', gap:8, flex:1 }}>
                <div>
                  <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(17px,2.6vw,21px)', color:'var(--px-ink)', fontWeight:700, lineHeight:1.15 }}>
                    {getModuleTitle(mod.id, mod.title)}
                  </div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:'clamp(12px,2vw,14px)', color:'var(--text-secondary)', marginTop:2, fontWeight:600 }}>
                    {getModuleSub(mod.id) || mod.sub}
                  </div>
                </div>

                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <PxStars filled={bestStars} size={20} />
                  <span style={{ fontFamily:'var(--font-heading)', fontSize:15, fontWeight:600, color:'var(--text-secondary)', whiteSpace:'nowrap' }}>
                    {isCompleted ? 'Alle Level' : `Level ${curLevel}/${maxLvl}`}
                  </span>
                </div>

                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }} aria-hidden="true">
                  {Array.from({ length: maxLvl }).map((_, li) => {
                    const lv = li + 1
                    const s  = levelStars[lv] ?? 0
                    return (
                      <div key={li}
                        className={`px-pip${s >= 3 ? ' px-pip--gold' : s >= 1 ? ' px-pip--done' : ''}${lv === curLevel && !isCompleted ? ' px-pip--current' : ''}`}
                        style={{ '--pip': pipColor }}
                      />
                    )
                  })}
                </div>

                <span className="px-btn px-btn--green px-btn--sm" style={{ marginTop:'auto', width:'100%' }}>
                  ▶ Spielen
                </span>
              </div>
            </motion.button>
          )
        })}
      </div>
      {showParent && (
        <Suspense fallback={
          <div style={{
            position:'fixed', inset:0, zIndex:50,
            background:'rgba(0,0,0,0.35)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <div style={{
              width:46, height:46, borderRadius:'50%',
              border:'4px solid rgba(255,255,255,0.35)',
              borderTopColor:'white',
              animation:'spin 0.8s linear infinite',
            }} />
          </div>
        }>
          <ParentScreen onClose={() => setShowParent(false)} />
        </Suspense>
      )}
      {showSwitcher && <ProfileSwitcher onClose={() => setShowSwitcher(false)} />}
      {pickerMod && (
        <LevelPicker
          mod={pickerMod}
          title={getModuleTitle(pickerMod.id, pickerMod.title)}
          progress={progress[pickerMod.id]}
          maxLevel={MAX_LEVELS[pickerMod.id] ?? 10}
          onPick={level => {
            setPickerMod(null)
            dispatch({ type:'START_GAME', payload:{ moduleId: pickerMod.id, level } })
          }}
          onClose={() => setPickerMod(null)}
        />
      )}
    </div>
  )
}
