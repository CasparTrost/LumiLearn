import React from 'react'
import { motion } from 'framer-motion'
import { Settings } from 'lucide-react'
import { useApp } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import { MAX_LEVELS } from '../AppContext.jsx'
import StarRow from '../components/StarRow.jsx'
import FarmProgress from '../components/FarmProgress.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'

// ── All modules ───────────────────────────────────────────────────────────────
const MODULES = [
  { id:'number-intro', title:'Zahlen entdecken', sub:'Zahlen 1–10',          emoji:'🧮', sciTag:'🔢 Zahlenverständnis',            gradient:'linear-gradient(135deg,#FFD93D,#FF9F43)', shadow:'rgba(255,217,61,0.45)',  isNew:true  },
  { id:'letter-intro', title:'ABC-Abenteuer',    sub:'Das Alphabet erleben', emoji:'🔡', sciTag:'✏️ Buchstabenerkennung',           gradient:'linear-gradient(135deg,#74B9FF,#6C63FF)', shadow:'rgba(116,185,255,0.45)', isNew:true  },
  { id:'emotions',     title:'Gefühlswelt',      sub:'Emotionen erkennen',   emoji:'😊', sciTag:'❤️ Sozial-Emotionales Lernen',    gradient:'linear-gradient(135deg,#A29BFE,#6C63FF)', shadow:'rgba(162,155,254,0.45)'             },
  { id:'listen',       title:'Hörabenteuer',     sub:'Hören & Erkennen',     emoji:'🔊', sciTag:'👂 Phonologisches Bewusstsein',    gradient:'linear-gradient(135deg,#FF6B6B,#FF8E53)', shadow:'rgba(255,107,107,0.45)', isNew:true  },
  { id:'shadows',      title:'Schattenrätsel',   sub:'Silhouetten erkennen', emoji:'🌑', sciTag:'👁️ Visuelle Wahrnehmung',          gradient:'linear-gradient(135deg,#1a0533,#4A00E0)', shadow:'rgba(26,5,51,0.5)',      isNew:true  },
  { id:'shapes',       title:'Farbenreich',      sub:'Formen bemalen',       emoji:'🎨', sciTag:'🎨 Dual-Coding & Kreativität',    gradient:'linear-gradient(135deg,#74B9FF,#0984E3)', shadow:'rgba(116,185,255,0.45)'             },
  { id:'numbers',      title:'Zahlenland',       sub:'Zählen & Rechnen',     emoji:'🔢', sciTag:'🧠 Logik & Mathematik',            gradient:'linear-gradient(135deg,#6BCB77,#44D498)', shadow:'rgba(107,203,119,0.45)'             },
  { id:'letters',      title:'Buchstabenwald',   sub:'Buchstaben tippen',    emoji:'⌨️', sciTag:'✏️ Schreibbereitschaft',           gradient:'linear-gradient(135deg,#6C63FF,#A78BFA)', shadow:'rgba(108,99,255,0.45)'              },
  { id:'words2',       title:'Silben-Spaß',      sub:'Wörter zusammenbauen', emoji:'🔤', sciTag:'📖 Phonologisches Bewusstsein',    gradient:'linear-gradient(135deg,#6BCB77,#0984E3)', shadow:'rgba(107,203,119,0.45)', isNew:true  },
  { id:'bubbles',      title:'Blasen-Blitz',     sub:'Zahlen-Blasen poppen', emoji:'🫧', sciTag:'⚡ Subitizing & Reaktion',          gradient:'linear-gradient(135deg,#FF6B6B,#FFD93D)', shadow:'rgba(255,107,107,0.45)', isNew:true  },
  { id:'words',        title:'Memo-Welt',        sub:'Paare finden',         emoji:'🃏', sciTag:'💭 Arbeitsgedächtnis',             gradient:'linear-gradient(135deg,#FD79A8,#E84393)', shadow:'rgba(253,121,168,0.45)'             },
  { id:'patterns',     title:'Musterpark',       sub:'Reihen & Logik',       emoji:'🔮', sciTag:'🔄 Mustererkennung',               gradient:'linear-gradient(135deg,#FF9F43,#EE5A24)', shadow:'rgba(255,159,67,0.45)'              },
  { id:'sort',         title:'Sortier-Spaß',     sub:'Alles an seinen Platz',emoji:'🧺', sciTag:'🧩 Kategorisieren & Konzeptbildung',gradient:'linear-gradient(135deg,#FF9F43,#6BCB77)',shadow:'rgba(255,159,67,0.45)',  isNew:true  },
  { id:'weight',       title:'Waage-Welt',       sub:'Was ist schwerer?',    emoji:'⚖️', sciTag:'⚖️ Größen & Messen',              gradient:'linear-gradient(135deg,#A29BFE,#FF9F43)', shadow:'rgba(162,155,254,0.45)', isNew:true  },
  { id:'clock',        title:'Uhren-Uhr',        sub:'Zeit lesen & stellen', emoji:'🕐', sciTag:'⏰ Zeitgefühl & Sequenzierung',    gradient:'linear-gradient(135deg,#FF9F43,#FF6B6B)', shadow:'rgba(255,159,67,0.45)',  isNew:true  },
  { id:'maze',         title:'Lumi-Labyrinth',   sub:'Weg durchs Labyrinth', emoji:'🌀', sciTag:'🧭 Räumliches Denken & Planung',   gradient:'linear-gradient(135deg,#4A00E0,#6C3FAC)', shadow:'rgba(74,0,224,0.45)',    isNew:true  },
  { id:'stories',      title:'Lumis Abenteuer',  sub:'Entscheide die Story', emoji:'📖', sciTag:'🧡 Moralisches Denken & Empathie', gradient:'linear-gradient(135deg,#44D498,#6C63FF)', shadow:'rgba(68,212,152,0.45)',  isNew:true  },
]

const cardVariants = {
  hidden:  { opacity:0, y:44, scale:0.88 },
  visible: (i) => ({ opacity:1, y:0, scale:1, transition:{ delay: i*0.055, type:'spring', stiffness:340, damping:18 } }),
}

// ── Lumi with orbiting completion stars ───────────────────────────────────────
function LumiWithOrbit({ completedCount, size }) {
  const cap   = Math.min(completedCount, 10)
  const orbit = size * 0.78
  return (
    <div style={{ position:'relative', width: size, height: size, flexShrink:0 }}>
      <LumiCharacter mood="happy" size={size} />
      {Array.from({ length: cap }).map((_, i) => {
        const startAngle = (i / Math.max(cap, 1)) * 360
        const dur        = 4 + (i % 3) * 0.7
        const r          = orbit + (i % 2) * (size * 0.12)
        return (
          <motion.div
            key={i}
            style={{ position:'absolute', left:'50%', top:'50%', width:0, height:0, zIndex:10 }}
            animate={{ rotate: [startAngle, startAngle + 360] }}
            transition={{ duration: dur, repeat: Infinity, ease:'linear' }}
          >
            <div style={{
              position:'absolute',
              left: r, top: -(size * 0.1),
              fontSize: size * 0.18, lineHeight:1,
              filter:'drop-shadow(0 0 5px #FFD93D)',
              userSelect:'none', pointerEvents:'none',
            }}>⭐</div>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function HomeScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  const profile  = state.profile  ?? { name:'Lumi', avatar:'🦊' }
  const progress = state.progress ?? {}
  const completedCount = Object.values(progress).filter(p => p?.completed).length

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

  return (
    <div className="home-bg" style={{ minHeight:'100dvh', display:'flex', flexDirection:'column', position:'relative' }}>

      {/* ── Animated background orbs ── */}
      <div style={{ position:'fixed', inset:0, zIndex:-1, overflow:'hidden', pointerEvents:'none' }}>
        {[
          { clr:'rgba(108,99,255,0.22)',  sz:560, left:'2%',  top:'5%',  dx:55,  dy:45,  dur:16 },
          { clr:'rgba(107,203,119,0.16)', sz:400, left:'68%', top:'3%',  dx:-42, dy:58,  dur:21 },
          { clr:'rgba(255,107,107,0.14)', sz:440, left:'48%', top:'54%', dx:65,  dy:-38, dur:14 },
          { clr:'rgba(255,217,61,0.15)',  sz:320, left:'3%',  top:'65%', dx:-48, dy:-52, dur:19 },
          { clr:'rgba(116,185,255,0.14)', sz:280, left:'82%', top:'40%', dx:-36, dy:34,  dur:12 },
        ].map((o, idx) => (
          <motion.div
            key={idx}
            animate={{ x:[0,o.dx,0,-o.dx/2,0], y:[0,o.dy,o.dy/2,0] }}
            transition={{ duration:o.dur, repeat:Infinity, ease:'easeInOut' }}
            style={{
              position:'absolute', left:o.left, top:o.top,
              width:o.sz, height:o.sz, borderRadius:'50%',
              background:`radial-gradient(circle, ${o.clr}, transparent 70%)`,
              willChange:'transform',
            }}
          />
        ))}
      </div>

      {/* ── Header ── */}
      <div style={{
        background:'linear-gradient(135deg,#4A00E0,#8E2DE2)',
        padding:'clamp(14px,2.5vw,22px) clamp(20px,4vw,40px)',
        display:'flex', alignItems:'center', gap:16,
        borderRadius:'0 0 28px 28px',
        boxShadow:'0 6px 28px rgba(74,0,224,0.3)',
      }}>
        <div style={{ fontSize:'clamp(36px,7vw,52px)', lineHeight:1 }}>{profile.avatar}</div>
        <div style={{ flex:1 }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(14px,2.8vw,20px)', color:'rgba(255,255,255,0.75)' }}>
            Hallo,
          </div>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(20px,4.5vw,30px)', color:'white', fontWeight:700, lineHeight:1.1 }}>
            {profile.name}! 👋
          </div>
        </div>
        <LumiWithOrbit completedCount={completedCount} size={64} />
        <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
          style={{ width:44,height:44,borderRadius:'50%',background:'rgba(255,255,255,0.18)',display:'flex',alignItems:'center',justifyContent:'center' }}
          onClick={() => dispatch({ type:'NAVIGATE', payload:'welcome' })}
        >
          <Settings size={20} color="white" />
        </motion.button>
      </div>

      {/* ── Tagline ── */}
      <div style={{ textAlign:'center', padding:'clamp(16px,3vw,28px) clamp(20px,4vw,40px) clamp(8px,1.5vw,16px)' }}>
        <h1 className="title-flow" style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(22px,5vw,36px)', fontWeight:700, lineHeight:1.2 }}>
          Was möchtest du heute lernen? ✨
        </h1>
      </div>

      {/* Farm Progress */}
      <div style={{ padding:'0 clamp(12px,3vw,24px)', paddingBottom:8 }}>
        <FarmProgress completedCount={completedCount} totalModules={17} profile={profile} />
      </div>

      {/* ── Card grid ── */}
      <div style={{
        flex:1,
        display:'grid',
        gridTemplateColumns:'repeat(auto-fill,minmax(clamp(240px,28vw,320px),1fr))',
        gap:'clamp(14px,2.5vw,24px)',
        padding:'clamp(10px,2vw,20px) clamp(20px,4vw,40px) clamp(24px,4vw,40px)',
        alignContent:'start',
      }}>
        {MODULES.map((mod, i) => {
          const p          = progress[mod.id] ?? { currentLevel:1, levelStars:{}, completed:false }
          const maxLvl     = MAX_LEVELS[mod.id] ?? 10
          const levelStars = p.levelStars  ?? {}
          const isCompleted= p.completed   ?? false
          const curLevel   = p.currentLevel ?? 1
          const doneCount  = Object.keys(levelStars).filter(l => (levelStars[l] ?? 0) >= 1).length
          const vals       = Object.values(levelStars)
          const bestStars  = vals.length ? Math.max(...vals) : 0

          return (
            <motion.button
              key={mod.id}
              className="lumi-card"
              custom={i}
              initial="hidden"
              animate="visible"
              variants={cardVariants}
              whileHover={{ scale:1.05, y:-9, rotate:0.7 }}
              whileTap={{ scale:0.96, rotate:0 }}
              onClick={() => startModule(mod)}
              style={{
                background:'white', borderRadius:28, border:'none', cursor:'pointer',
                boxShadow:`0 8px 28px ${mod.shadow}`, overflow:'hidden',
                display:'flex', flexDirection:'column', textAlign:'left',
                transition:'box-shadow 0.2s', position:'relative',
              }}
            >
              {/* Completed badge */}
              {isCompleted && (
                <motion.div
                  animate={{ rotate:[-4,4,-4], scale:[1,1.08,1] }}
                  transition={{ duration:2.4, repeat:Infinity, ease:'easeInOut' }}
                  style={{
                    position:'absolute', top:12, right:12, zIndex:4,
                    background:'linear-gradient(135deg,#FFD93D,#FF9F43)', color:'white',
                    fontFamily:'var(--font-heading)', fontSize:12, fontWeight:700,
                    padding:'3px 10px', borderRadius:99, letterSpacing:0.5,
                    boxShadow:'0 2px 12px rgba(255,217,61,0.7)',
                  }}
                >🏆 Meister!</motion.div>
              )}

              {/* NEW badge */}
              {mod.isNew && !isCompleted && doneCount === 0 && (
                <div className="badge-wiggle" style={{
                  position:'absolute', top:14, right:14, zIndex:4,
                  background:'linear-gradient(135deg,#FF6B6B,#FF8E53)', color:'white',
                  fontFamily:'var(--font-heading)', fontSize:12, fontWeight:700,
                  padding:'3px 10px', borderRadius:99, letterSpacing:0.5,
                  boxShadow:'0 2px 12px rgba(255,107,107,0.65)',
                }}>✨ NEU</div>
              )}

              {/* Gradient header */}
              <div className="card-header-shine" style={{
                background: mod.gradient,
                padding:'clamp(20px,3.5vw,30px) clamp(20px,3.5vw,28px) clamp(16px,2.5vw,22px)',
                display:'flex', alignItems:'center', gap:16,
                position:'relative', overflow:'hidden',
                minHeight:'clamp(90px,14vw,120px)',
              }}>
                <div style={{ position:'absolute', top:-20, right:-20, width:90, height:90, borderRadius:'50%', background:'rgba(255,255,255,0.12)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', bottom:-30, right:40, width:70, height:70, borderRadius:'50%', background:'rgba(255,255,255,0.08)', pointerEvents:'none' }} />
                <div style={{ position:'absolute', top:10, right:55, width:30, height:30, borderRadius:'50%', background:'rgba(255,255,255,0.15)', pointerEvents:'none' }} />

                <div className="emoji-float" style={{
                  '--float-dur': `${2.6 + (i % 4) * 0.55}s`,
                  width:'clamp(56px,10vw,72px)', height:'clamp(56px,10vw,72px)',
                  background:'rgba(255,255,255,0.22)', borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:'clamp(28px,6vw,40px)', lineHeight:1, flexShrink:0,
                  boxShadow:'0 4px 16px rgba(0,0,0,0.12)', backdropFilter:'blur(4px)', zIndex:1,
                }}>
                  {mod.emoji}
                </div>

                <div style={{ zIndex:1 }}>
                  <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(17px,3.8vw,24px)', color:'white', fontWeight:700, lineHeight:1.1 }}>
                    {getModuleTitle(mod.id, mod.title)}
                  </div>
                  <div style={{ fontFamily:'var(--font-body)', fontSize:'clamp(12px,2.5vw,15px)', color:'rgba(255,255,255,0.85)', marginTop:3 }}>
                    {getModuleSub(mod.id) || mod.sub}
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div style={{ padding:'clamp(12px,2.5vw,18px) clamp(18px,3.5vw,24px)', display:'flex', flexDirection:'column', gap:10 }}>
                {/* Stars + level row */}
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
                  <StarRow filled={bestStars} total={3} size={18} />
                  <div style={{
                    background:'var(--bg)', borderRadius:99, padding:'3px 10px',
                    fontFamily:'var(--font-heading)', fontSize:12, color:'var(--text-secondary)',
                    border:'1.5px solid var(--border)', whiteSpace:'nowrap',
                  }}>
                    {isCompleted ? '✅ Alle Level' : `Lv. ${curLevel} / ${maxLvl}`}
                  </div>
                </div>

                {/* Level progress dots */}
                <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
                  {Array.from({ length: maxLvl }).map((_, li) => {
                    const lvNum = li + 1
                    const s     = levelStars[lvNum] ?? 0
                    const dotColor = s >= 3 ? '#FFD93D'
                                   : s >= 1 ? (mod.gradient.match(/#[0-9A-Fa-f]{6}/g)?.[0] ?? '#6BCB77')
                                   : 'var(--border)'
                    return (
                      <div key={li} style={{
                        width:10, height:10, borderRadius:'50%',
                        background: dotColor, flexShrink:0,
                        boxShadow: s >= 1 ? '0 0 4px rgba(107,203,119,0.5)' : 'none',
                        border: lvNum === curLevel && !isCompleted ? '2px solid #6C63FF' : '2px solid transparent',
                        transition:'background 0.3s',
                      }} />
                    )
                  })}
                  <span style={{ fontFamily:'var(--font-body)', fontSize:10, color:'var(--text-muted)', marginLeft:2 }}>
                    {doneCount}/{maxLvl}
                  </span>
                </div>

                {/* Science tag */}
                <div style={{
                  fontFamily:'var(--font-body)', fontSize:'clamp(11px,1.8vw,12px)',
                  color:'var(--text-muted)', background:'var(--bg)',
                  padding:'5px 10px', borderRadius:99,
                  display:'inline-block', border:'1.5px solid var(--border)',
                  alignSelf:'flex-start',
                }}>
                  {mod.sciTag}
                </div>

                {/* Play CTA */}
                <div className="play-cta-bob" style={{
                  marginTop:2, background: mod.gradient,
                  borderRadius:99, padding:'9px 18px',
                  fontFamily:'var(--font-heading)', fontSize:'clamp(13px,2.5vw,15px)',
                  color:'white', fontWeight:700, textAlign:'center',
                  boxShadow:`0 4px 18px ${mod.shadow}`, letterSpacing:0.3,
                }}>
                  ▶ Spielen
                </div>
              </div>
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
