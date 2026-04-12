import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../AppContext.jsx'
import { useT } from '../i18n.js'
import LumiCharacter from '../components/LumiCharacter.jsx'
import Button from '../components/Button.jsx'

const AVATARS = ['🐻','🐼','🦁','🐨','🦊','🐧','🦋','🐬','🦄','🐸','🐙','🐯','🐮','🐷','🐔','🦉']
const AGES = [3, 4, 5, 6, 7]

const AVATAR_COLORS = [
  '#FF6B6B','#FF9F43','#FFD93D','#6BCB77','#4ECDC4',
  '#74B9FF','#A29BFE','#FD79A8','#FF6B6B','#00B894',
  '#6C63FF','#E17055','#0984E3','#00CEC9','#FDCB6E','#E84393',
]

function AvatarPicker({ value, onChange }) {
  return (
    <div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'rgba(255,255,255,0.7)', marginBottom:14, letterSpacing:0.5, textTransform:'uppercase' }}>
        Pick your character
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:12 }}>
        {AVATARS.map((a, i) => {
          const isSelected = value === a
          return (
            <motion.button
              key={a}
              whileHover={{ scale: 1.12, y: -4 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => onChange(a)}
              style={{
                aspectRatio: '1',
                borderRadius: 24,
                background: isSelected
                  ? `linear-gradient(135deg, ${AVATAR_COLORS[i % AVATAR_COLORS.length]}, ${AVATAR_COLORS[(i+3) % AVATAR_COLORS.length]})`
                  : 'rgba(255,255,255,0.1)',
                border: isSelected ? '3px solid white' : '3px solid transparent',
                boxShadow: isSelected ? `0 8px 24px rgba(0,0,0,0.3)` : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 'clamp(24px, 6vw, 36px)',
                cursor: 'pointer',
                position: 'relative',
                backdropFilter: 'blur(8px)',
                transition: 'background 0.25s, border 0.25s',
              }}
            >
              {a}
              {isSelected && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  style={{
                    position:'absolute', top:-8, right:-8,
                    background:'#FFD93D', borderRadius:'50%',
                    width:22, height:22, fontSize:13,
                    display:'flex', alignItems:'center', justifyContent:'center',
                    boxShadow:'0 2px 8px rgba(0,0,0,0.3)',
                  }}
                >✓</motion.div>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

function NameInput({ value, onChange }) {
  return (
    <div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'rgba(255,255,255,0.7)', marginBottom:10, letterSpacing:0.5, textTransform:'uppercase' }}>
        What's your name?
      </div>
      <div style={{ position:'relative' }}>
        <input
          type="text"
          placeholder={t('profile.namePlaceholder')}
          value={value}
          maxLength={20}
          onChange={e => onChange(e.target.value)}
          style={{
            width:'100%',
            padding:'16px 20px',
            fontSize:20,
            fontFamily:'var(--font-heading)',
            fontWeight:600,
            borderRadius:20,
            border: value ? '3px solid #FFD93D' : '3px solid rgba(255,255,255,0.2)',
            outline:'none',
            background: 'rgba(255,255,255,0.12)',
            color:'white',
            backdropFilter:'blur(8px)',
            transition:'border-color 0.2s',
            boxSizing:'border-box',
          }}
        />
        {value && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            style={{
              position:'absolute', right:16, top:'50%', transform:'translateY(-50%)',
              fontSize:22,
            }}
          >
            ✨
          </motion.div>
        )}
      </div>
    </div>
  )
}

function AgePicker({ value, onChange }) {
  return (
    <div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'rgba(255,255,255,0.7)', marginBottom:10, letterSpacing:0.5, textTransform:'uppercase' }}>
        How old are you?
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {AGES.map(a => (
          <motion.button
            key={a}
            whileHover={{ scale:1.1, y:-4 }}
            whileTap={{ scale:0.92 }}
            onClick={() => onChange(a)}
            style={{
              flex:1,
              padding:'14px 0',
              borderRadius:20,
              fontFamily:'var(--font-heading)',
              fontSize:24,
              fontWeight:800,
              background: value === a
                ? 'linear-gradient(135deg, #FFD93D, #FF9F43)'
                : 'rgba(255,255,255,0.1)',
              color: value === a ? '#1A1040' : 'rgba(255,255,255,0.8)',
              border: value === a ? '3px solid white' : '3px solid transparent',
              boxShadow: value === a ? '0 8px 24px rgba(255,180,0,0.4)' : 'none',
              cursor:'pointer',
              backdropFilter:'blur(8px)',
              transition:'all 0.2s',
            }}
          >
            {a}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

function CreateProfileForm({ onSave, onCancel, showCancel }) {
  const t = useT()
  const [name, setName] = useState('')
  const [age, setAge] = useState(null)
  const [avatar, setAvatar] = useState(null)
  const [step, setStep] = useState(0) // 0=avatar, 1=name+age

  const canProceed = avatar !== null
  const canSubmit = name.trim().length >= 1 && age !== null && avatar !== null

  const steps = [
    {
      title: 'Choose your character',
      subtitle: t('profile.whoDoYouWant'),
      content: <AvatarPicker value={avatar} onChange={setAvatar} />,
      canNext: canProceed,
    },
    {
      title: avatar ? `Hi, ${avatar}!` : t('profile.almostThere'),
      subtitle: t('profile.tellUs'),
      content: (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          <NameInput value={name} onChange={setName} />
          <AgePicker value={age} onChange={setAge} />
        </div>
      ),
      canNext: canSubmit,
    },
  ]

  const currentStep = steps[step]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:28 }}>
      {/* Step indicator */}
      <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
        {steps.map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === step ? 32 : 10, background: i === step ? '#FFD93D' : 'rgba(255,255,255,0.3)' }}
            style={{ height:10, borderRadius:99, transition:'all 0.3s' }}
          />
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity:0, x:40 }}
          animate={{ opacity:1, x:0 }}
          exit={{ opacity:0, x:-40 }}
          transition={{ duration:0.3, ease:[0.22,1,0.36,1] }}
          style={{ display:'flex', flexDirection:'column', gap:20 }}
        >
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(20px,5vw,28px)', color:'white', fontWeight:700 }}>
              {currentStep.title}
            </div>
            <div style={{ color:'rgba(255,255,255,0.65)', fontSize:15, marginTop:4 }}>
              {currentStep.subtitle}
            </div>
          </div>
          {currentStep.content}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:8 }}>
        {step < steps.length - 1 ? (
          <motion.button
            whileHover={{ scale:1.02 }}
            whileTap={{ scale:0.97 }}
            disabled={!currentStep.canNext}
            onClick={() => setStep(s => s + 1)}
            style={{
              padding:'18px',
              borderRadius:22,
              background: currentStep.canNext
                ? 'linear-gradient(135deg, #FFD93D, #FF9F43)'
                : 'rgba(255,255,255,0.15)',
              color: currentStep.canNext ? '#1A1040' : 'rgba(255,255,255,0.4)',
              fontFamily:'var(--font-heading)',
              fontSize:18,
              fontWeight:700,
              border:'none',
              cursor: currentStep.canNext ? 'pointer' : 'not-allowed',
              boxShadow: currentStep.canNext ? '0 8px 24px rgba(255,180,0,0.35)' : 'none',
              transition:'all 0.2s',
            }}
          >
            Next →
          </motion.button>
        ) : (
          <motion.button
            whileHover={{ scale:1.02 }}
            whileTap={{ scale:0.97 }}
            disabled={!canSubmit}
            onClick={() => canSubmit && onSave({ name: name.trim(), age, avatar })}
            style={{
              padding:'18px',
              borderRadius:22,
              background: canSubmit
                ? 'linear-gradient(135deg, #6BCB77, #00B894)'
                : 'rgba(255,255,255,0.15)',
              color: canSubmit ? 'white' : 'rgba(255,255,255,0.4)',
              fontFamily:'var(--font-heading)',
              fontSize:18,
              fontWeight:700,
              border:'none',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              boxShadow: canSubmit ? '0 8px 24px rgba(0,184,148,0.4)' : 'none',
              transition:'all 0.2s',
            }}
          >
            {t('profile.letsGo')}
          </motion.button>
        )}

        <div style={{ display:'flex', gap:8 }}>
          {step > 0 && (
            <motion.button
              whileHover={{ scale:1.02 }}
              whileTap={{ scale:0.97 }}
              onClick={() => setStep(s => s - 1)}
              style={{
                flex:1, padding:'14px',
                borderRadius:18,
                background:'rgba(255,255,255,0.1)',
                color:'rgba(255,255,255,0.7)',
                fontFamily:'var(--font-heading)',
                fontSize:16,
                border:'none', cursor:'pointer',
              }}
            >
              ← Back
            </motion.button>
          )}
          {showCancel && (
            <motion.button
              whileHover={{ scale:1.02 }}
              whileTap={{ scale:0.97 }}
              onClick={onCancel}
              style={{
                flex:1, padding:'14px',
                borderRadius:18,
                background:'rgba(255,255,255,0.08)',
                color:'rgba(255,255,255,0.55)',
                fontFamily:'var(--font-heading)',
                fontSize:16,
                border:'none', cursor:'pointer',
              }}
            >
              Cancel
            </motion.button>
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

  const selectProfile = (profile) => {
    dispatch({ type: 'SET_PROFILE', payload: profile })
    dispatch({ type: 'NAVIGATE', payload: 'home' })
  }

  const createProfile = (profileData) => {
    dispatch({ type: 'ADD_PROFILE', payload: profileData })
    dispatch({ type: 'SET_PROFILE', payload: profileData })
    dispatch({ type: 'NAVIGATE', payload: 'home' })
  }

  return (
    <div style={{
      minHeight:'100dvh',
      background:'linear-gradient(160deg, #1A0050 0%, #4A00E0 50%, #8E2DE2 100%)',
      display:'flex',
      flexDirection:'column',
      alignItems:'center',
      justifyContent: mode === 'create' ? 'flex-start' : 'center',
      padding:'32px 24px',
      paddingBottom:48,
      position:'relative',
      overflow:'hidden',
    }}>
      {/* Background orbs */}
      {[
        { x:'5%', y:'8%', size:180, color:'rgba(167,139,250,0.2)', delay:0 },
        { x:'70%', y:'15%', size:130, color:'rgba(255,107,107,0.15)', delay:1 },
        { x:'60%', y:'65%', size:220, color:'rgba(108,99,255,0.18)', delay:0.6 },
      ].map((orb, i) => (
        <motion.div key={i}
          animate={{ y:[0,-16,0], x:[0,8,0] }}
          transition={{ duration:5+orb.delay, repeat:Infinity, ease:'easeInOut', delay:orb.delay }}
          style={{
            position:'absolute', left:orb.x, top:orb.y,
            width:orb.size, height:orb.size, borderRadius:'50%',
            background:orb.color, filter:`blur(${orb.size*0.35}px)`,
            pointerEvents:'none', zIndex:0,
          }}
        />
      ))}

      <div style={{ position:'relative', zIndex:1, width:'100%', maxWidth:480 }}>
        <AnimatePresence mode="wait">
          {mode === 'select' ? (
            <motion.div
              key="select"
              initial={{ opacity:0, y:20 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-20 }}
              style={{ display:'flex', flexDirection:'column', gap:16 }}
            >
              {/* Header */}
              <div style={{ textAlign:'center', marginBottom:8 }}>
                <LumiCharacter mood="happy" size={90} />
                <h1 style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(24px,6vw,36px)', color:'white', marginTop:12, marginBottom:4 }}>
                  Who's playing? 👋
                </h1>
                <p style={{ color:'rgba(255,255,255,0.65)', fontSize:15 }}>
                  Tap your name to start
                </p>
              </div>

              {/* Profile cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {profiles.map((p, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity:0, y:20 }}
                    animate={{ opacity:1, y:0 }}
                    transition={{ delay:i*0.07 }}
                    whileHover={{ scale:1.03, y:-3 }}
                    whileTap={{ scale:0.97 }}
                    onClick={() => selectProfile(p)}
                    style={{
                      display:'flex', alignItems:'center', gap:16,
                      padding:'18px 22px',
                      borderRadius:26,
                      background:'rgba(255,255,255,0.12)',
                      border:'2px solid rgba(255,255,255,0.18)',
                      backdropFilter:'blur(16px)',
                      cursor:'pointer',
                      textAlign:'left',
                      boxShadow:'0 4px 20px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div style={{
                      width:60, height:60, borderRadius:20,
                      background:'linear-gradient(135deg, rgba(255,217,61,0.3), rgba(108,99,255,0.3))',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      fontSize:34, flexShrink:0,
                      border:'2px solid rgba(255,255,255,0.2)',
                    }}>
                      {p.avatar}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:'var(--font-heading)', fontSize:22, color:'white', fontWeight:700, lineHeight:1.2 }}>
                        {p.name}
                      </div>
                      <div style={{ fontSize:13, color:'rgba(255,255,255,0.55)', marginTop:2 }}>
                        Age {p.age} · Ready to learn! ⭐
                      </div>
                    </div>
                    <motion.div
                      animate={{ x:[0,4,0] }}
                      transition={{ duration:1.5, repeat:Infinity, ease:'easeInOut' }}
                      style={{ fontSize:22, color:'rgba(255,255,255,0.6)' }}
                    >
                      →
                    </motion.div>
                  </motion.button>
                ))}
              </div>

              {/* Add new */}
              <motion.button
                whileHover={{ scale:1.02 }}
                whileTap={{ scale:0.97 }}
                onClick={() => setMode('create')}
                style={{
                  padding:'18px',
                  borderRadius:26,
                  background:'rgba(255,255,255,0.07)',
                  border:'2px dashed rgba(255,255,255,0.25)',
                  cursor:'pointer',
                  fontFamily:'var(--font-heading)',
                  fontSize:17,
                  color:'rgba(255,255,255,0.7)',
                  display:'flex', alignItems:'center', justifyContent:'center', gap:10,
                  backdropFilter:'blur(8px)',
                }}
              >
                <span style={{ fontSize:22 }}>+</span>
                Add new learner
              </motion.button>
            </motion.div>
          ) : (
            <motion.div
              key="create"
              initial={{ opacity:0, y:20 }}
              animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-20 }}
            >
              <div style={{ textAlign:'center', marginBottom:28 }}>
                <LumiCharacter mood="encouraging" size={80} />
                <h1 style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(22px,5vw,32px)', color:'white', marginTop:10, marginBottom:4 }}>
                  Create your profile
                </h1>
              </div>
              <CreateProfileForm
                onSave={createProfile}
                onCancel={() => setMode('select')}
                showCancel={profiles.length > 0}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
