import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import { PixelLumi, PxIcon, uiSpr } from '../components/PixelUI.jsx'
import { narrate, stopNarration, afterNarration } from '../narrator.js'
import { hearable } from '../lib/hearable.js'
import { sayNumber } from '../tts.js'
import { line } from '../lib/lumiLines.js'
import { ChildLumi } from '../components/ShapeFigure.jsx'
import { Ring } from './ShapesScreen.jsx'
import { LINES } from '../lib/lumiLines.js'

// The app is made for children from 4 to 7
export const AGES = [4, 5, 6, 7]

const SAY_AGE  = line('menue/wie-alt')
// Lumi's sentences for the choice (looked up: a missing one is left out)
const SAY_SHAPE = LINES['gestalt/aussuchen'] ? line('gestalt/aussuchen') : null
// a new child: the chick says it is a chick (not "again": that is for turning back)
const firstKey = id => (id === 'chick' && LINES['gestalt/kueken-neu'] ? 'gestalt/kueken-neu' : `gestalt/${id}`)
const SAY_SHAPE_IS = id => (LINES[firstKey(id)] ? line(firstKey(id)) : null)
const SAY_WHO  = line('menue/wer-spielt-heute')
// the ages as recorded numbers (public/audio/zahlen-entdecken)
const AGE_CLIP = { 4: 'vier', 5: 'fuenf', 6: 'sechs', 7: 'sieben' }

// Creating a child: first it chooses its Lumi on the ring (ShapeStart,
// full screen; this is the free first choice of lib/shapes.js), then the
// age and "Los geht's!". The name is for the parents and may stay empty —
// typing it was impossible for a child who can't write yet, and blocked
// the start. (The animal pictures to choose from are gone: the child's
// picture is its Lumi now.)
function ShapeStart({ onChosen, onCancel }) {
  const { w, h } = useViewport()
  const [poof, setPoof] = useState(null)
  const lock = useRef(0)
  useEffect(() => {
    const id = setTimeout(() => narrate([SAY_SHAPE]), 400)
    return () => clearTimeout(id)
  }, [])
  const choose = id => {
    if (Date.now() - lock.current < 1200) return
    lock.current = Date.now()
    stopNarration()
    setPoof({ id, at: Date.now() })
    // the shape's sentence is said to its end before the next screen speaks
    setTimeout(() => {
      narrate([SAY_SHAPE_IS(id)])
      afterNarration(() => onChosen(id), { minMs: 900, maxMs: 6000 })
    }, 400)
  }
  const top = w < 521 ? 64 : 76
  return (
    <div data-shape-start style={{ position:'fixed', inset:0, zIndex:5, display:'flex', flexDirection:'column', overflow:'hidden', overscrollBehavior:'contain',
      background:'radial-gradient(ellipse at 50% 70%, #fff6d6 0%, #ffe2a6 45%, #e9b873 100%)' }}>
      <div style={{ height: top, display:'flex', alignItems:'center', justifyContent:'center', gap:10, padding:'0 12px', position:'relative' }}>
        {onCancel && (
          <button className="px-btn px-btn--parch px-btn--icon" onClick={onCancel} aria-label="Abbrechen" style={{ position:'absolute', left:12 }}>
            <PxIcon name="back" size={20} color="var(--px-ink)" />
          </button>
        )}
        <span className="px-title" style={{ fontSize:'clamp(20px,4.5vw,30px)', textAlign:'center' }}>Wie sieht dein Lumi aus?</span>
      </div>
      <Ring w={w} h={h - top} start={0} kind={() => 'free'} poof={poof} onChoose={choose} outfit={null} />
    </div>
  )
}

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

function CreateProfileForm({ shape, onBack, onSave, onCancel, showCancel, defaultName = 'Kind' }) {
  const t = useT()
  const [name, setName] = useState('')
  const [age, setAge] = useState(null)

  useEffect(() => {
    const id = setTimeout(() => narrate([SAY_AGE]), 350)
    return () => clearTimeout(id)
  }, [])

  const pickAge = (a) => {
    setAge(a)
    narrate([{ src: AGE_CLIP[a] && `audio/zahlen-entdecken/${AGE_CLIP[a]}.mp3`, text: `${sayNumber(a)}!` }])
  }
  // no name typed: "Kind", "Kind 2" … (not the shape's name: that changes
  // when Lumi changes, and "Einhorn" as a child's name confused parents)
  const save = () => onSave({ name: name.trim() || defaultName, age, shape })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'clamp(12px,2.5dvh,22px)' }}>
      <motion.div key="age"
        initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }}
        transition={{ duration:0.25 }}
        style={{ display:'flex', flexDirection:'column', gap:'clamp(12px,2.5dvh,20px)' }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14 }}>
          {/* the Lumi just chosen; a tap goes back to the ring */}
          <button className="px-btn px-btn--gold" onClick={onBack}
            aria-label={t('profile.back')} title={t('profile.back')}
            style={{ width:84, height:84, padding:0, overflow:'hidden' }}>
            <ChildLumi profile={{ id: 'new', shape, shapes: [shape] }} size={74} />
          </button>
          <div style={{ textAlign:'left' }}>
            <div className="px-title" style={{ fontSize:'clamp(21px,5vw,30px)', lineHeight:1.15 }}>
              {t('profile.almostThere')}
            </div>
            <div className="px-title" style={{ fontSize:17, marginTop:4 }}>
              {t('profile.tellUs')}
            </div>
          </div>
        </div>

        {/* Age */}
        <div style={{ display:'flex', gap:10 }}>
          {AGES.map(a => (
            <button key={a}
              className={`px-btn ${age === a ? 'px-btn--gold' : 'px-btn--parch'}`}
              onClick={() => pickAge(a)}
              {...hearable(sayNumber(a))}
              aria-pressed={age === a}
              style={{ flex:1, minHeight:'clamp(56px,9dvh,72px)', fontSize:30 }}
            >
              {a}
            </button>
          ))}
        </div>

        {/* Name, for the parents */}
        <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <span className="px-title" style={{ fontSize:15 }}>{t('profile.whatsName')}</span>
          <input
            type="text" value={name} maxLength={20}
            placeholder={t('profile.namePlaceholder')}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && save()}
            style={{
              width:'100%', padding:'12px 16px', fontSize:20, minHeight:52,
              fontFamily:'var(--font-heading)', fontWeight:600, borderRadius:10,
              border:'3px solid var(--px-ink)', outline:'none',
              background:'var(--px-parch)', color:'var(--px-ink)', boxSizing:'border-box',
              boxShadow:'inset 0 3px 0 rgba(42,27,61,0.12)',
            }}
          />
        </label>

        <button className="px-btn px-btn--green px-btn--lg" onClick={save} style={{ width:'100%' }}>
          <PxIcon name="play" size={20} /> {t('profile.letsGo')}
        </button>
      </motion.div>

      {showCancel && (
        <button className="px-btn px-btn--parch px-btn--sm" onClick={onCancel} style={{ alignSelf:'center' }}>
          {t('profile.cancel')}
        </button>
      )}
    </div>
  )
}

// A child without a typed name: "Kind", then "Kind 2", "Kind 3" … (the first free one)
export function nextKidName(profiles) {
  const names = new Set(profiles.map(p => p.name))
  if (!names.has('Kind')) return 'Kind'
  let n = 2
  while (names.has(`Kind ${n}`)) n++
  return `Kind ${n}`
}

export default function ProfileScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  // Support both old array format and new object format
  const profilesObj = state.profiles ?? {}
  const profiles = Array.isArray(profilesObj) ? profilesObj : Object.values(profilesObj)
  // "Neues Kind" in the profile switcher goes straight to the form
  const [mode, setMode] = useState(profiles.length === 0 || state.profileCreate ? 'create' : 'select')
  // the Lumi the new child chose on the ring (then the age)
  const [newShape, setNewShape] = useState(null)
  // a phone held sideways: the children side by side in two columns, a
  // smaller heading, so the list fits without scrolling
  const { w: vw, h: vh } = useViewport()
  const flat = vh < 500 && vw > vh

  useEffect(() => {
    if (mode !== 'select') return
    const id = setTimeout(() => narrate([SAY_WHO]), 500)
    return () => clearTimeout(id)
  }, [mode])

  const selectProfile = (p) => {
    dispatch({ type: 'SET_ACTIVE_PROFILE', payload: p.id })
    dispatch({ type: 'NAVIGATE', payload: 'home' })
  }

  const createProfile = (data) => {
    dispatch({ type: 'ADD_PROFILE', payload: data })
    dispatch({ type: 'NAVIGATE', payload: 'home' })
  }

  const cancelCreate = () => {
    setNewShape(null)
    if (state.profileCreate && state.activeProfileId) dispatch({ type: 'NAVIGATE', payload: 'home' })
    else setMode('select')
  }

  // creating a child starts with its Lumi, on the whole screen
  if (mode === 'create' && !newShape) return <ShapeStart onChosen={setNewShape} onCancel={profiles.length > 0 ? cancelCreate : null} />

  return (
    <div style={{
      minHeight:'100dvh',
      backgroundColor: 'var(--px-ink)',
      backgroundImage: `linear-gradient(rgba(42,27,61,0.45), rgba(42,27,61,0.45)), url(${uiSpr('landscape.png')})`,
      backgroundSize: 'cover', backgroundPosition: 'center 70%', imageRendering: 'pixelated',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding: flat ? '8px 16px' : 'clamp(16px,3dvh,32px) 16px', position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth: flat && mode === 'select' ? 760 : 480 }}>
        <AnimatePresence mode="wait">
          {mode === 'select' ? (
            <motion.div key="select"
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
              style={{ display:'flex', flexDirection:'column', gap: flat ? 8 : 14 }}
            >
              <div style={{ textAlign:'center', marginBottom: flat ? 0 : 4 }}>
                {!flat && <PixelLumi size={84} outfit={null} style={{ margin: '0 auto' }} />}
                <h1 className="px-title" style={{ fontSize: flat ? 24 : 'clamp(24px,6vw,36px)', marginTop: flat ? 0 : 10, marginBottom: flat ? 2 : 6 }}>
                  {t('profile.who')}
                </h1>
                <p className="px-title" style={{ fontSize: flat ? 15 : 17, margin: flat ? 0 : undefined }}>
                  {t('profile.tapName')}
                </p>
              </div>

              <div data-picker-list style={flat
                ? { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, maxHeight:'calc(100dvh - 124px)', overflowY:'auto', padding:'2px 2px 6px' }
                : { display:'flex', flexDirection:'column', gap:12, maxHeight:'58dvh', overflowY:'auto', padding:'2px 2px 8px' }}>
                {profiles.map((p, i) => (
                  <motion.button key={p.id ?? i}
                    className="px-panel"
                    initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
                    onClick={() => selectProfile(p)}
                    {...hearable(p.name)}
                    style={{ display:'flex', alignItems:'center', gap: flat ? 12 : 16, padding: flat ? '6px 12px' : '12px 16px', cursor:'pointer', textAlign:'left', flexShrink:0 }}
                  >
                    <div className="px-btn px-btn--gold" aria-hidden="true" style={{ width:60, height:60, padding:0, flexShrink:0, pointerEvents:'none' }}>
                      <ChildLumi profile={p} size={50} />
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'var(--font-heading)', fontSize:24, color:'var(--px-ink)', fontWeight:700, lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                      {p.age ? <div style={{ fontSize:16, color:'var(--text-secondary)', fontWeight:600, marginTop:2 }}>{p.age} {t('profile.ageLabel')}</div> : null}
                    </div>
                    <PxIcon name="play" size={22} color="var(--px-ink)" />
                  </motion.button>
                ))}
              </div>

              <button className="px-btn px-btn--parch px-btn--md" onClick={() => setMode('create')} style={{ alignSelf:'center', ...(flat ? { padding:'6px 16px', minHeight:44 } : null) }}>
                ➕ {t('profile.addLearner')}
              </button>
            </motion.div>
          ) : (
            <motion.div key="create"
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
              style={{ display:'flex', flexDirection:'column', alignItems:'stretch', gap:'clamp(8px,1.6dvh,14px)' }}
            >
              <CreateProfileForm shape={newShape} onBack={() => setNewShape(null)} onSave={createProfile} onCancel={cancelCreate} showCancel={profiles.length > 0} defaultName={nextKidName(profiles)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
