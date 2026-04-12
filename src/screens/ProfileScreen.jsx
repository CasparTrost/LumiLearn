import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import LumiCharacter from '../components/LumiCharacter.jsx'

const AVATARS = ['🐻','🐼','🦁','🐨','🦊','🐧','🦋','🐬','🦄','🐸','🐙','🐯','🐮','🐷','🐔','🦉']
const AGES = [3, 4, 5, 6, 7]
const COLORS = ['#FF6B6B','#FF9F43','#FFD93D','#6BCB77','#4ECDC4','#74B9FF','#A29BFE','#FD79A8','#FF6B6B','#00B894','#6C63FF','#E17055','#0984E3','#00CEC9','#FDCB6E','#E84393']

function SimpleBtn({ onClick, disabled, gold, green, ghost, small, children }) {
  const bg = disabled ? 'rgba(255,255,255,0.15)'
    : gold ? 'linear-gradient(135deg,#FFD93D,#FF9F43)'
    : green ? 'linear-gradient(135deg,#6BCB77,#00B894)'
    : 'rgba(255,255,255,0.08)'
  const color = disabled ? 'rgba(255,255,255,0.4)' : (gold ? '#1A1040' : 'white')
  const shadow = disabled ? 'none' : gold ? '0 8px 24px rgba(255,180,0,0.35)' : green ? '0 8px 24px rgba(0,184,148,0.4)' : 'none'

  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.97 }}
      onClick={disabled ? undefined : onClick}
      style={{
        flex: 1, padding: small ? '14px' : '18px', borderRadius: 22,
        fontFamily: 'var(--font-heading)', fontSize: small ? 16 : 18,
        fontWeight: 700, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: bg, color, boxShadow: shadow, transition: 'all 0.2s', width: '100%',
      }}
    >
      {children}
    </motion.button>
  )
}

function CreateProfileForm({ onSave, onCancel, showCancel }) {
  const t = useT()
  const [name, setName] = useState('')
  const [age, setAge] = useState(null)
  const [avatar, setAvatar] = useState(null)
  const [step, setStep] = useState(0)

  const canStep1 = avatar !== null
  const canSubmit = name.trim().length >= 1 && age !== null && avatar !== null

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
      {/* Step indicator */}
      <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
        {[0,1].map(i => (
          <motion.div key={i}
            animate={{ width: i === step ? 32 : 10, background: i === step ? '#FFD93D' : 'rgba(255,255,255,0.3)' }}
            style={{ height:10, borderRadius:99 }}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        {step === 0 ? (
          <motion.div key="step0"
            initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}
            transition={{ duration:0.3 }}
            style={{ display:'flex', flexDirection:'column', gap:20 }}
          >
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(20px,5vw,28px)', color:'white', fontWeight:700 }}>
                {t('profile.pickCharacter')}
              </div>
              <div style={{ color:'rgba(255,255,255,0.65)', fontSize:15, marginTop:4 }}>
                {t('profile.whoDoYouWant')}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
              {AVATARS.map((a, i) => {
                const sel = avatar === a
                return (
                  <motion.button key={a} whileHover={{ scale:1.12, y:-4 }} whileTap={{ scale:0.9 }}
                    onClick={() => setAvatar(a)}
                    style={{
                      aspectRatio:'1', borderRadius:24, fontSize:'clamp(24px,6vw,36px)',
                      background: sel ? `linear-gradient(135deg,${COLORS[i%16]},${COLORS[(i+3)%16]})` : 'rgba(255,255,255,0.1)',
                      border: sel ? '3px solid white' : '3px solid transparent',
                      boxShadow: sel ? '0 8px 24px rgba(0,0,0,0.3)' : 'none',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      cursor:'pointer', backdropFilter:'blur(8px)', position:'relative',
                    }}
                  >
                    {a}
                    {sel && (
                      <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
                        style={{ position:'absolute', top:-8, right:-8, background:'#FFD93D', borderRadius:'50%', width:22, height:22, fontSize:13, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(0,0,0,0.3)' }}>
                        ✓
                      </motion.div>
                    )}
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        ) : (
          <motion.div key="step1"
            initial={{ opacity:0, x:40 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-40 }}
            transition={{ duration:0.3 }}
            style={{ display:'flex', flexDirection:'column', gap:24 }}
          >
            <div style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(20px,5vw,28px)', color:'white', fontWeight:700 }}>
                {avatar ? avatar + ' ' + t('profile.almostThere') : t('profile.almostThere')}
              </div>
              <div style={{ color:'rgba(255,255,255,0.65)', fontSize:15, marginTop:4 }}>
                {t('profile.tellUs')}
              </div>
            </div>

            {/* Name */}
            <div>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'rgba(255,255,255,0.7)', marginBottom:10, letterSpacing:0.5, textTransform:'uppercase' }}>
                {t('profile.whatsName')}
              </div>
              <div style={{ position:'relative' }}>
                <input
                  type="text" value={name} maxLength={20}
                  placeholder={t('profile.namePlaceholder')}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && canSubmit && onSave({ name:name.trim(), age, avatar })}
                  style={{
                    width:'100%', padding:'16px 20px', fontSize:20,
                    fontFamily:'var(--font-heading)', fontWeight:600, borderRadius:20,
                    border: name ? '3px solid #FFD93D' : '3px solid rgba(255,255,255,0.2)',
                    outline:'none', background:'rgba(255,255,255,0.12)', color:'white',
                    backdropFilter:'blur(8px)', transition:'border-color 0.2s', boxSizing:'border-box',
                  }}
                />
                {name && <div style={{ position:'absolute', right:16, top:'50%', transform:'translateY(-50%)', fontSize:22 }}>✨</div>}
              </div>
            </div>

            {/* Age */}
            <div>
              <div style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'rgba(255,255,255,0.7)', marginBottom:10, letterSpacing:0.5, textTransform:'uppercase' }}>
                {t('profile.howOld')}
              </div>
              <div style={{ display:'flex', gap:10 }}>
                {AGES.map(a => (
                  <motion.button key={a} whileHover={{ scale:1.1, y:-4 }} whileTap={{ scale:0.92 }}
                    onClick={() => setAge(a)}
                    style={{
                      flex:1, padding:'14px 0', borderRadius:20,
                      fontFamily:'var(--font-heading)', fontSize:24, fontWeight:800,
                      background: age === a ? 'linear-gradient(135deg,#FFD93D,#FF9F43)' : 'rgba(255,255,255,0.1)',
                      color: age === a ? '#1A1040' : 'rgba(255,255,255,0.8)',
                      border: age === a ? '3px solid white' : '3px solid transparent',
                      boxShadow: age === a ? '0 8px 24px rgba(255,180,0,0.4)' : 'none',
                      cursor:'pointer', backdropFilter:'blur(8px)',
                    }}
                  >
                    {a}
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation buttons */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
        {step === 0 ? (
          <SimpleBtn gold disabled={!canStep1} onClick={() => setStep(1)}>
            {t('profile.next')}
          </SimpleBtn>
        ) : (
          <SimpleBtn green disabled={!canSubmit} onClick={() => canSubmit && onSave({ name:name.trim(), age, avatar })}>
            {avatar && name ? avatar + ' ' + t('profile.letsGo') : t('profile.letsGo')}
          </SimpleBtn>
        )}
        <div style={{ display:'flex', gap:8 }}>
          {step > 0 && (
            <SimpleBtn ghost small onClick={() => setStep(0)}>
              {t('profile.back')}
            </SimpleBtn>
          )}
          {showCancel && (
            <SimpleBtn ghost small onClick={onCancel}>
              {t('profile.cancel')}
            </SimpleBtn>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ProfileScreen() {
  const t = useT()
  const { state, dispatch } = useApp()
  const profiles = state.profiles ?? (state.profile ? [state.profile] : [])
  const [mode, setMode] = useState(profiles.length === 0 ? 'create' : 'select')

  const selectProfile = (p) => {
    dispatch({ type:'SET_PROFILE', payload:p })
    dispatch({ type:'NAVIGATE', payload:'home' })
  }

  const createProfile = (data) => {
    dispatch({ type:'ADD_PROFILE', payload:data })
    dispatch({ type:'SET_PROFILE', payload:data })
    dispatch({ type:'NAVIGATE', payload:'home' })
  }

  return (
    <div style={{
      minHeight:'100dvh',
      background:'linear-gradient(160deg,#1A0050 0%,#4A00E0 50%,#8E2DE2 100%)',
      display:'flex', flexDirection:'column', alignItems:'center',
      justifyContent: mode === 'create' ? 'flex-start' : 'center',
      padding:'32px 24px 48px', position:'relative', overflow:'hidden',
    }}>
      {/* Background orbs */}
      {[{x:'5%',y:'8%',s:180,c:'rgba(167,139,250,0.2)',d:0},{x:'70%',y:'15%',s:130,c:'rgba(255,107,107,0.15)',d:1},{x:'60%',y:'65%',s:220,c:'rgba(108,99,255,0.18)',d:0.6}].map((o,i) => (
        <motion.div key={i}
          animate={{ y:[0,-16,0], x:[0,8,0] }}
          transition={{ duration:5+o.d, repeat:Infinity, ease:'easeInOut', delay:o.d }}
          style={{ position:'absolute', left:o.x, top:o.y, width:o.s, height:o.s, borderRadius:'50%', background:o.c, filter:`blur(${o.s*0.35}px)`, pointerEvents:'none', zIndex:0 }}
        />
      ))}

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:480 }}>
        <AnimatePresence mode="wait">
          {mode === 'select' ? (
            <motion.div key="select"
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
              style={{ display:'flex', flexDirection:'column', gap:16 }}
            >
              <div style={{ textAlign:'center', marginBottom:8 }}>
                <LumiCharacter mood="happy" size={90} />
                <h1 style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(24px,6vw,36px)', color:'white', marginTop:12, marginBottom:4 }}>
                  {t('profile.who')}
                </h1>
                <p style={{ color:'rgba(255,255,255,0.65)', fontSize:15 }}>
                  {t('profile.tapName')}
                </p>
              </div>

              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {profiles.map((p, i) => (
                  <motion.button key={i}
                    initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay:i*0.07 }}
                    whileHover={{ scale:1.03, y:-3 }} whileTap={{ scale:0.97 }}
                    onClick={() => selectProfile(p)}
                    style={{
                      display:'flex', alignItems:'center', gap:16, padding:'18px 22px', borderRadius:26,
                      background:'rgba(255,255,255,0.12)', border:'2px solid rgba(255,255,255,0.18)',
                      backdropFilter:'blur(16px)', cursor:'pointer', textAlign:'left',
                      boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{ width:60, height:60, borderRadius:20, background:'linear-gradient(135deg,rgba(255,217,61,0.3),rgba(108,99,255,0.3))', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, flexShrink:0, border:'2px solid rgba(255,255,255,0.2)' }}>
                      {p.avatar}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'var(--font-heading)', fontSize:22, color:'white', fontWeight:700, lineHeight:1.2 }}>{p.name}</div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginTop:2 }}>{p.age} {t('profile.ageLabel')}</div>
                    </div>
                    <motion.div animate={{ x:[0,4,0] }} transition={{ duration:1.5, repeat:Infinity, ease:'easeInOut' }} style={{ fontSize:22, color:'rgba(255,255,255,0.6)' }}>
                      →
                    </motion.div>
                  </motion.button>
                ))}
              </div>

              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={() => setMode('create')}
                style={{ padding:'18px', borderRadius:26, background:'rgba(255,255,255,0.07)', border:'2px dashed rgba(255,255,255,0.25)', cursor:'pointer', fontFamily:'var(--font-heading)', fontSize:17, color:'rgba(255,255,255,0.7)', display:'flex', alignItems:'center', justifyContent:'center', gap:10, backdropFilter:'blur(8px)' }}>
                <span style={{ fontSize:22 }}>+</span> {t('profile.addLearner')}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div key="create"
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-20 }}
            >
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <LumiCharacter mood="encouraging" size={80} />
                <h1 style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(22px,5vw,32px)', color:'white', marginTop:10, marginBottom:4 }}>
                  {t('profile.create')}
                </h1>
              </div>
              <CreateProfileForm onSave={createProfile} onCancel={() => setMode('select')} showCancel={profiles.length > 0} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
