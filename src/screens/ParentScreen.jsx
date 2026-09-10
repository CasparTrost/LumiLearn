import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, MAX_LEVELS } from '../AppContext.jsx'
import { useProfile } from '../hooks/useProfile.js'

const MODULE_NAMES = {
  'number-intro': 'Zahlen entdecken',
  'letter-intro': 'ABC-Abenteuer',
  numbers:        'Zahlen-Markt',
  letters:        'Buchstabenwald',
  listen:         'Hörabenteuer',
  words:          'Wörter-Quiz',
  patterns:       'Muster-Meister',
  shapes:         'Formen-Welt',
  emotions:       'Gefühlswelt',
  maze:           'Lumi-Labyrinth',
  shadows:        'Schattenrätsel',
  bubbles:        'Blasen-Blitz',
  stories:        'Lumis Abenteuer',
  sort:           'Sortier-Spaß',
  clock:          'Uhren-Uhr',
  words2:         'Silben-Spaß',
  weight:         'Waage-Welt',
  coloring:        'Mal-Atelier',
}

function PinPad({ onSuccess, onCancel, correctPin = '1234' }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  const press = (n) => {
    if (n === '⌫') { setPin(p => p.slice(0, -1)); return }
    const next = pin + n
    setPin(next)
    if (next.length === 4) {
      if (next === correctPin) { onSuccess() }
      else { setShake(true); setTimeout(() => { setPin(''); setShake(false) }, 600) }
    }
  }

  return (
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:48, marginBottom:8 }}>🔐</div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:22, fontWeight:700, marginBottom:4 }}>Eltern-PIN</div>
      <div style={{ fontFamily:'var(--font-body)', fontSize:13, color:'#888', marginBottom:20 }}>Standard: 1234</div>
      <motion.div animate={shake ? { x:[-8,8,-6,6,-4,4,0] } : {}} transition={{ duration:0.4 }}
        style={{ display:'flex', justifyContent:'center', gap:12, marginBottom:24 }}>
        {[0,1,2,3].map(i => (
          <div key={i} style={{
            width:48, height:48, borderRadius:14,
            background: pin.length > i ? '#6C63FF' : '#ECE8FF',
            border:'2px solid #A29BFE',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:22, color:'white', transition:'background 0.15s',
          }}>{pin.length > i ? '●' : ''}</div>
        ))}
      </motion.div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, maxWidth:220, margin:'0 auto 16px' }}>
        {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => (
          <motion.button key={i} whileTap={n !== '' ? { scale:0.88 } : {}}
            onClick={() => n !== '' && press(String(n))}
            style={{
              padding:'14px 0', borderRadius:12,
              background: n === '' ? 'transparent' : '#F0EEFF',
              border: n === '' ? 'none' : '2px solid #E0D5FF',
              fontFamily:'var(--font-heading)', fontSize:20, fontWeight:700,
              color:'#4A00E0', cursor: n === '' ? 'default' : 'pointer',
            }}>{n}</motion.button>
        ))}
      </div>
      <button onClick={onCancel}
        style={{ background:'none', border:'none', color:'#999', fontFamily:'var(--font-body)', fontSize:14, cursor:'pointer' }}>
        Abbrechen
      </button>
    </div>
  )
}

export default function ParentScreen({ onClose }) {
  const { state, dispatch } = useApp()
  const { progress, coins, farmLevel, streak } = useProfile()
  const currentPin = state.settings?.parentPin ?? '1234'
  const pinIsDefault = state.settings?.pinIsDefault ?? true
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState(null)
  // PIN change state
  const [showPinChange, setShowPinChange] = useState(false)
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinRepeat, setPinRepeat] = useState('')
  const [pinError, setPinError] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2200) }

  const resetModule = useCallback((id) => {
    dispatch({ type: 'RESET_MODULE', payload: id })
    showToast(`${MODULE_NAMES[id]} zurückgesetzt`)
  }, [dispatch])

  const setModuleLevel = useCallback((id, level) => {
    dispatch({ type: 'SET_MODULE_LEVEL', payload: { id, level } })
    showToast(`${MODULE_NAMES[id]} → Level ${level}`)
  }, [dispatch])

  const resetFarm = useCallback((targetLevel) => {
    showToast(targetLevel === 0 ? 'Hof komplett zurückgesetzt' : `Hof → Level ${targetLevel}`)
  }, [])

  const currentFarmLevel = farmLevel ?? 1

  const handlePinChange = () => {
    setPinError('')
    if (pinCurrent !== currentPin) { setPinError('Falscher aktueller PIN'); return }
    if (!/^\d{4}$/.test(pinNew)) { setPinError('PIN muss 4 Ziffern haben'); return }
    if (pinNew !== pinRepeat) { setPinError('PIN stimmt nicht überein'); return }
    dispatch({ type: 'SET_PARENT_PIN', payload: pinNew })
    setPinCurrent(''); setPinNew(''); setPinRepeat(''); setShowPinChange(false)
    showToast('PIN erfolgreich geändert!')
  }

  if (!unlocked) {
    return (
      <div style={{
        position:'fixed', inset:0, zIndex:2000,
        background:'rgba(0,0,0,0.7)',
        display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      }} onClick={onClose}>
        <motion.div initial={{scale:0.85,y:20}} animate={{scale:1,y:0}}
          onClick={e => e.stopPropagation()}
          style={{ background:'white', borderRadius:28, padding:'32px 28px', maxWidth:340, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
          <PinPad onSuccess={() => setUnlocked(true)} onCancel={onClose} correctPin={currentPin} />
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{
      position:'fixed', inset:0, zIndex:2000,
      background:'rgba(0,0,0,0.7)', overflowY:'auto',
      padding:'24px 16px',
    }}>
      <motion.div initial={{scale:0.95,y:20}} animate={{scale:1,y:0}}
        style={{
          background:'#f8f7ff', borderRadius:28, maxWidth:600,
          margin:'0 auto', padding:'28px 24px',
          boxShadow:'0 20px 60px rgba(0,0,0,0.3)',
        }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <div style={{ fontFamily:'var(--font-heading)', fontSize:24, fontWeight:800, color:'#333' }}>
              🔐 Elternbereich
            </div>
            <div style={{ fontFamily:'var(--font-body)', fontSize:13, color:'#888' }}>
              Spiele & Hof verwalten
            </div>
          </div>
          <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
            onClick={onClose}
            style={{ background:'#ECE8FF', border:'none', borderRadius:12, width:40, height:40,
              fontSize:18, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
            ✕
          </motion.button>
        </div>

        {/* Default PIN warning */}
        {pinIsDefault && (
          <div style={{ background:'#fff8e1', border:'2px solid #FFD93D', borderRadius:16, padding:'12px 16px', marginBottom:16, fontFamily:'var(--font-body)', fontSize:14, color:'#b8860b', display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:20 }}>⚠️</span>
            <span>Bitte ändere die Standard-PIN 1234!</span>
          </div>
        )}

        {/* Gamification stats */}
        <div style={{ background:'white', borderRadius:20, padding:16, marginBottom:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', display:'flex', gap:12, flexWrap:'wrap' }}>
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,217,61,0.12)', borderRadius:12, padding:'8px 14px', border:'1.5px solid rgba(255,217,61,0.4)' }}>
            <span style={{ fontSize:20 }}>🪙</span>
            <span style={{ fontFamily:'var(--font-heading)', color:'#b8860b', fontWeight:700, fontSize:16 }}>{coins} Coins</span>
          </div>
          {streak.count >= 1 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(255,107,107,0.1)', borderRadius:12, padding:'8px 14px', border:'1.5px solid rgba(255,107,107,0.4)' }}>
              <span style={{ fontSize:20 }}>🔥</span>
              <span style={{ fontFamily:'var(--font-heading)', color:'#c0392b', fontWeight:700, fontSize:16 }}>{streak.count} Tage Streak</span>
            </div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(107,203,119,0.1)', borderRadius:12, padding:'8px 14px', border:'1.5px solid rgba(107,203,119,0.4)' }}>
            <span style={{ fontSize:20 }}>🏕️</span>
            <span style={{ fontFamily:'var(--font-heading)', color:'#2d7a3a', fontWeight:700, fontSize:16 }}>Farm Level {farmLevel}</span>
          </div>
        </div>

        {/* Farm section */}
        <div style={{ background:'white', borderRadius:20, padding:20, marginBottom:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:17, fontWeight:700, marginBottom:12, color:'#2d5a1a' }}>
            🌾 Bauernhof (aktuell: Level {currentFarmLevel})
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
            {[0,1,2,3,4,5,6].map(lv => (
              <motion.button key={lv} whileTap={{scale:0.92}}
                onClick={() => resetFarm(lv)}
                style={{
                  padding:'8px 16px', borderRadius:12,
                  background: lv === currentFarmLevel ? '#2d5a1a' : '#f0faf0',
                  color: lv === currentFarmLevel ? 'white' : '#2d5a1a',
                  border:'2px solid #6BCB77',
                  fontFamily:'var(--font-heading)', fontSize:14, fontWeight:700, cursor:'pointer',
                }}>
                {lv === 0 ? 'Komplett zurück' : `Level ${lv}`}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Games section */}
        <div style={{ background:'white', borderRadius:20, padding:20, marginBottom:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:17, fontWeight:700, marginBottom:12, color:'#333' }}>
            🎮 Spiele
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {Object.entries(MODULE_NAMES).map(([id, name]) => {
              const prog = progress[id]
              const curLv = prog?.currentLevel ?? 1
              const maxLv = MAX_LEVELS[id] ?? 10
              const stars = Object.values(prog?.levelStars ?? {}).reduce((a,b) => a+b, 0)
              return (
                <div key={id} style={{
                  display:'flex', alignItems:'center', gap:12,
                  padding:'10px 14px', borderRadius:14,
                  background:'#f8f7ff', border:'1.5px solid #ECE8FF',
                }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:'var(--font-heading)', fontSize:14, fontWeight:700, color:'#333' }}>{name}</div>
                    <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'#888' }}>
                      Level {curLv}/{maxLv} · {stars} ⭐
                    </div>
                  </div>
                  {/* Level selector */}
                  <select
                    value={curLv}
                    onChange={e => setModuleLevel(id, parseInt(e.target.value))}
                    style={{
                      padding:'6px 10px', borderRadius:10,
                      border:'2px solid #A29BFE', fontFamily:'var(--font-heading)',
                      fontSize:13, color:'#4A00E0', background:'white', cursor:'pointer',
                    }}>
                    {Array.from({length: maxLv}, (_,i) => i+1).map(l => (
                      <option key={l} value={l}>Lv {l}</option>
                    ))}
                  </select>
                  <motion.button whileTap={{scale:0.88}}
                    onClick={() => resetModule(id)}
                    style={{
                      padding:'6px 12px', borderRadius:10,
                      background:'#FFE8E8', border:'2px solid #FF6B6B',
                      fontFamily:'var(--font-heading)', fontSize:12, color:'#e74c3c',
                      cursor:'pointer', fontWeight:700, whiteSpace:'nowrap',
                    }}>Reset</motion.button>
                </div>
              )
            })}
          </div>
        </div>

        {/* PIN change section */}
        <div style={{ background:'white', borderRadius:20, padding:20, marginBottom:16, boxShadow:'0 2px 12px rgba(0,0,0,0.06)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:showPinChange ? 16 : 0 }}>
            <div style={{ fontFamily:'var(--font-heading)', fontSize:16, fontWeight:700, color:'#333' }}>🔑 PIN ändern</div>
            <motion.button whileTap={{scale:0.92}}
              onClick={() => { setShowPinChange(v => !v); setPinError('') }}
              style={{ background:'#ECE8FF', border:'none', borderRadius:10, padding:'6px 14px', fontFamily:'var(--font-heading)', fontSize:14, color:'#4A00E0', cursor:'pointer', fontWeight:700 }}>
              {showPinChange ? 'Abbrechen' : 'Ändern'}
            </motion.button>
          </div>
          <AnimatePresence>
            {showPinChange && (
              <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}}>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[
                    { label:'Aktueller PIN', value:pinCurrent, setter:setPinCurrent },
                    { label:'Neuer PIN (4 Ziffern)', value:pinNew, setter:setPinNew },
                    { label:'Neuen PIN wiederholen', value:pinRepeat, setter:setPinRepeat },
                  ].map(({ label, value, setter }) => (
                    <div key={label}>
                      <div style={{ fontFamily:'var(--font-body)', fontSize:12, color:'#888', marginBottom:4 }}>{label}</div>
                      <input
                        type="password" value={value} maxLength={4}
                        onChange={e => setter(e.target.value.replace(/\D/g,'').slice(0,4))}
                        style={{ width:'100%', padding:'10px 14px', borderRadius:12, border:'2px solid #A29BFE', fontFamily:'var(--font-heading)', fontSize:18, letterSpacing:8, outline:'none', boxSizing:'border-box' }}
                      />
                    </div>
                  ))}
                  {pinError && <div style={{ color:'#e74c3c', fontFamily:'var(--font-body)', fontSize:13 }}>⚠️ {pinError}</div>}
                  <motion.button whileTap={{scale:0.95}} onClick={handlePinChange}
                    style={{ background:'linear-gradient(135deg,#4A00E0,#8E2DE2)', color:'white', border:'none', borderRadius:14, padding:'12px', fontFamily:'var(--font-heading)', fontSize:16, fontWeight:700, cursor:'pointer', marginTop:4 }}>
                    PIN ändern
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Full reset */}
        <div style={{ background:'#fff5f5', borderRadius:20, padding:20, boxShadow:'0 2px 12px rgba(0,0,0,0.06)', border:'2px solid #FFE0E0' }}>
          <div style={{ fontFamily:'var(--font-heading)', fontSize:16, fontWeight:700, marginBottom:8, color:'#e74c3c' }}>
            ⚠️ Alles zurücksetzen
          </div>
          <div style={{ fontFamily:'var(--font-body)', fontSize:13, color:'#888', marginBottom:12 }}>
            Löscht alle Spielstände, Sterne und den Hof-Fortschritt.
          </div>
          <motion.button whileTap={{scale:0.95}}
            onClick={() => {
              dispatch({ type:'RESET_ALL' })
              showToast('Alles zurückgesetzt')
              setTimeout(onClose, 1500)
            }}
            style={{
              background:'linear-gradient(135deg,#FF6B6B,#e74c3c)',
              color:'white', border:'none', borderRadius:14,
              padding:'12px 28px', fontFamily:'var(--font-heading)',
              fontSize:16, fontWeight:700, cursor:'pointer',
              boxShadow:'0 4px 16px rgba(231,76,60,0.35)',
            }}>Alles zurücksetzen</motion.button>
        </div>
      </motion.div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}}
            style={{
              position:'fixed', bottom:32, left:'50%', transform:'translateX(-50%)',
              background:'#333', color:'white', borderRadius:14, padding:'10px 24px',
              fontFamily:'var(--font-heading)', fontSize:15, zIndex:3000,
              boxShadow:'0 4px 20px rgba(0,0,0,0.3)',
            }}>
            ✅ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
