import { useState, useContext, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AppContext, MAX_LEVELS } from '../AppContext.jsx'

const PIN = '1234'

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
}

function PinPad({ onSuccess, onCancel }) {
  const [pin, setPin] = useState('')
  const [shake, setShake] = useState(false)

  const press = (n) => {
    if (n === '⌫') { setPin(p => p.slice(0, -1)); return }
    const next = pin + n
    setPin(next)
    if (next.length === 4) {
      if (next === PIN) { onSuccess() }
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
  const { state, dispatch } = useContext(AppContext)
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState(null)

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
    try {
      if (targetLevel === 0) {
        localStorage.removeItem('lumilearn_farm_level')
      } else {
        localStorage.setItem('lumilearn_farm_level', String(targetLevel))
      }
    } catch {}
    showToast(targetLevel === 0 ? 'Hof komplett zurückgesetzt' : `Hof → Level ${targetLevel}`)
  }, [])

  const currentFarmLevel = (() => {
    try { return parseInt(localStorage.getItem('lumilearn_farm_level') || '0', 10) } catch { return 0 }
  })()

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
          <PinPad onSuccess={() => setUnlocked(true)} onCancel={onClose} />
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
              const prog = state.progress[id]
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
              try { localStorage.removeItem('lumilearn_farm_level') } catch {}
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
