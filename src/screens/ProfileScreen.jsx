import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import { PixelLumi, PxIcon, uiSpr } from '../components/PixelUI.jsx'
import { narrate } from '../narrator.js'
import { hearable } from '../lib/hearable.js'
import { sayNumber } from '../tts.js'

// The animals a child can be, with the name Lumi says when it is tapped and
// the name a profile gets when nobody types one in.
export const AVATAR_INFO = [
  { e: '🐻', name: 'Bär',   art: 'der' }, { e: '🐼', name: 'Panda',   art: 'der' },
  { e: '🦁', name: 'Löwe',  art: 'der' }, { e: '🐨', name: 'Koala',   art: 'der' },
  { e: '🦊', name: 'Fuchs', art: 'der' }, { e: '🐧', name: 'Pinguin', art: 'der' },
  { e: '🦋', name: 'Schmetterling', art: 'der' }, { e: '🐬', name: 'Delfin', art: 'der' },
  { e: '🦄', name: 'Einhorn', art: 'das' }, { e: '🐸', name: 'Frosch', art: 'der' },
  { e: '🐙', name: 'Krake', art: 'die' }, { e: '🐯', name: 'Tiger',  art: 'der' },
  { e: '🐮', name: 'Kuh',   art: 'die' }, { e: '🐷', name: 'Schwein', art: 'das' },
  { e: '🐔', name: 'Huhn',  art: 'das' }, { e: '🦉', name: 'Eule',    art: 'die' },
]
export const AVATARS = AVATAR_INFO.map(a => a.e)
export const avatarName = e => AVATAR_INFO.find(a => a.e === e)?.name ?? 'Kind'
const sayAvatar = e => { const a = AVATAR_INFO.find(x => x.e === e); return a ? `${a.art[0].toUpperCase()}${a.art.slice(1)} ${a.name}!` : '' }
// The app is made for children from 4 to 7
export const AGES = [4, 5, 6, 7]

const SAY_PICK = 'Welches Tier möchtest du sein? Tippe auf ein Bild.'
const SAY_AGE  = 'Wie alt bist du? Tippe auf die Zahl. Dann tippe auf den grünen Knopf.'
const SAY_WHO  = 'Wer spielt heute? Tippe auf dein Bild.'

// Avatar tiles are sized by the height as well, so the grid fits on a small
// phone without scrolling
const TILE = 'min(19vw, 10dvh, 88px)'

// Two short steps: tap an animal (that already moves on), then the age and
// "Los geht's!". The name is for the parents and may stay empty — typing it
// was impossible for a child who can't write yet, and blocked the start.
function CreateProfileForm({ onSave, onCancel, showCancel }) {
  const t = useT()
  const [name, setName] = useState('')
  const [age, setAge] = useState(null)
  const [avatar, setAvatar] = useState(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const id = setTimeout(() => narrate([{ text: step === 0 ? SAY_PICK : SAY_AGE }]), 350)
    return () => clearTimeout(id)
  }, [step])

  const pickAvatar = (a) => {
    setAvatar(a)
    narrate([{ text: sayAvatar(a) }])
    setTimeout(() => setStep(1), 650)
  }
  const pickAge = (a) => {
    setAge(a)
    narrate([{ text: `${sayNumber(a)}!` }])
  }
  const save = () => onSave({ name: name.trim() || avatarName(avatar), age, avatar })

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'clamp(12px,2.5dvh,22px)' }}>
      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="step0"
            initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}
            transition={{ duration:0.25 }}
            style={{ display:'flex', flexDirection:'column', gap:'clamp(10px,2dvh,18px)', alignItems:'center' }}
          >
            <div style={{ textAlign:'center' }}>
              <div className="px-title" style={{ fontSize:'clamp(21px,5vw,30px)', lineHeight:1.15 }}>
                {t('profile.pickCharacter')}
              </div>
              <div className="px-title" style={{ fontSize:17, marginTop:6 }}>
                {t('profile.whoDoYouWant')}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:`repeat(4, ${TILE})`, gap:'clamp(8px,1.6dvh,12px)' }}>
              {AVATARS.map(a => {
                const sel = avatar === a
                return (
                  <button key={a}
                    className={`px-btn ${sel ? 'px-btn--gold' : 'px-btn--parch'}`}
                    onClick={() => pickAvatar(a)}
                    {...hearable(sayAvatar(a))}
                    aria-label={avatarName(a)}
                    aria-pressed={sel}
                    style={{ width:TILE, height:TILE, padding:0, fontSize:`calc(${TILE} * 0.5)`, lineHeight:1 }}
                  >
                    {a}
                  </button>
                )
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="step1"
            initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}
            transition={{ duration:0.25 }}
            style={{ display:'flex', flexDirection:'column', gap:'clamp(12px,2.5dvh,20px)' }}
          >
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:14 }}>
              <button className="px-btn px-btn--gold" onClick={() => setStep(0)}
                aria-label={t('profile.back')} title={t('profile.back')}
                style={{ width:76, height:76, padding:0, fontSize:42, lineHeight:1 }}>
                {avatar}
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
        )}
      </AnimatePresence>

      {showCancel && (
        <button className="px-btn px-btn--parch px-btn--sm" onClick={onCancel} style={{ alignSelf:'center' }}>
          {t('profile.cancel')}
        </button>
      )}
    </div>
  )
}

export default function ProfileScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  // Support both old array format and new object format
  const profilesObj = state.profiles ?? {}
  const profiles = Array.isArray(profilesObj) ? profilesObj : Object.values(profilesObj)
  // "Neues Kind" in the profile switcher goes straight to the form
  const [mode, setMode] = useState(profiles.length === 0 || state.profileCreate ? 'create' : 'select')

  useEffect(() => {
    if (mode !== 'select') return
    const id = setTimeout(() => narrate([{ text: SAY_WHO }]), 500)
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
    if (state.profileCreate && state.activeProfileId) dispatch({ type: 'NAVIGATE', payload: 'home' })
    else setMode('select')
  }

  return (
    <div style={{
      minHeight:'100dvh',
      backgroundColor: 'var(--px-ink)',
      backgroundImage: `linear-gradient(rgba(42,27,61,0.45), rgba(42,27,61,0.45)), url(${uiSpr('landscape.png')})`,
      backgroundSize: 'cover', backgroundPosition: 'center 70%', imageRendering: 'pixelated',
      display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
      padding:'clamp(16px,3dvh,32px) 16px', position:'relative', overflow:'hidden',
    }}>
      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:480 }}>
        <AnimatePresence mode="wait">
          {mode === 'select' ? (
            <motion.div key="select"
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
              style={{ display:'flex', flexDirection:'column', gap:14 }}
            >
              <div style={{ textAlign:'center', marginBottom:4 }}>
                <PixelLumi size={84} style={{ margin: '0 auto' }} />
                <h1 className="px-title" style={{ fontSize:'clamp(24px,6vw,36px)', marginTop:10, marginBottom:6 }}>
                  {t('profile.who')}
                </h1>
                <p className="px-title" style={{ fontSize:17 }}>
                  {t('profile.tapName')}
                </p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12, maxHeight:'58dvh', overflowY:'auto', padding:'2px 2px 8px' }}>
                {profiles.map((p, i) => (
                  <motion.button key={p.id ?? i}
                    className="px-panel"
                    initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
                    onClick={() => selectProfile(p)}
                    {...hearable(p.name)}
                    style={{ display:'flex', alignItems:'center', gap:16, padding:'12px 16px', cursor:'pointer', textAlign:'left', flexShrink:0 }}
                  >
                    <div className="px-btn px-btn--gold" aria-hidden="true" style={{ width:60, height:60, padding:0, fontSize:36, flexShrink:0, pointerEvents:'none' }}>
                      {p.avatar}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontFamily:'var(--font-heading)', fontSize:24, color:'var(--px-ink)', fontWeight:700, lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                      {p.age ? <div style={{ fontSize:16, color:'var(--text-secondary)', fontWeight:600, marginTop:2 }}>{p.age} {t('profile.ageLabel')}</div> : null}
                    </div>
                    <PxIcon name="play" size={22} color="var(--px-ink)" />
                  </motion.button>
                ))}
              </div>

              <button className="px-btn px-btn--parch px-btn--md" onClick={() => setMode('create')} style={{ alignSelf:'center' }}>
                ➕ {t('profile.addLearner')}
              </button>
            </motion.div>
          ) : (
            <motion.div key="create"
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
              style={{ display:'flex', flexDirection:'column', alignItems:'stretch', gap:'clamp(8px,1.6dvh,14px)' }}
            >
              <PixelLumi size={64} style={{ margin:'0 auto' }} />
              <CreateProfileForm onSave={createProfile} onCancel={cancelCreate} showCancel={profiles.length > 0} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
