import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, MAX_LEVELS, farmPoints, liveStreak, todayStr, saveData } from '../AppContext.jsx'
import { getFarmLevel, FARM_LEVEL_LABELS } from '../components/FarmProgress.jsx'
import { PxIcon } from '../components/PixelUI.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import { useMusic } from '../components/MusicControls.jsx'
import { AVATARS, AGES, avatarName } from './ProfileScreen.jsx'
import { MODULES, moduleTitle } from '../modules.js'
import { ENGLISH_ENABLED } from '../i18n.js'
import { readStore, removeStore } from '../hooks/safeStorage.js'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

// ── Styles of the parent area: pixel panels, ink text, ≥4.5:1 contrast ──
const H2 = { fontFamily:'var(--font-heading)', fontSize:19, fontWeight:700, color:'var(--px-ink)', margin:'0 0 10px' }
const SMALL = { fontFamily:'var(--font-body)', fontSize:15, fontWeight:600, color:'var(--text-secondary)' }
const SECTION = { padding:'16px 14px', marginBottom:14 }
const INPUT = {
  padding:'8px 10px', minHeight:44, borderRadius:8, border:'3px solid var(--px-ink)',
  background:'var(--px-parch-light)', color:'var(--px-ink)', fontFamily:'var(--font-heading)', fontSize:16,
}

const minutes = ms => Math.round((ms ?? 0) / 60000)
const tage = n => n ? `${n} ${n === 1 ? 'Tag' : 'Tage'} in Folge gespielt` : 'gerade keine Serie'
// todayStr() is for today only; the play log of the last seven days
function localDate(d) {
  const pad = x => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function weekMs(profile) {
  let ms = 0
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() - i)
    ms += profile.playLog?.[localDate(d)]?.ms ?? 0
  }
  return ms
}

// ── Number pad (PIN and the parent gate) ────────────────────────────────────
function NumberPad({ value, onChange, length, onEnter }) {
  // digits from the keyboard as well
  useEffect(() => {
    const onKey = e => {
      if (/^\d$/.test(e.key) && value.length < length) onChange(value + e.key)
      else if (e.key === 'Backspace') onChange(value.slice(0, -1))
      else if (e.key === 'Enter') {
        // Enter on another focused button (OK, Abbrechen) is that button's;
        // on a digit it sends, and doesn't type the digit as well
        if (e.target.closest?.('button') && !e.target.closest('[data-pad]')) return
        e.preventDefault()
        onEnter?.()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [value, length, onChange, onEnter])

  const press = n => {
    if (n === '⌫') onChange(value.slice(0, -1))
    else if (value.length < length) onChange(value + n)
  }
  return (
    <div data-pad style={{ display:'grid', gridTemplateColumns:'repeat(3, 64px)', gap:10, justifyContent:'center' }}>
      {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((n, i) => n === '' ? <span key={i} /> : (
        <button key={i} className="px-btn px-btn--parch" onClick={() => press(String(n))}
          aria-label={n === '⌫' ? 'Löschen' : String(n)}
          style={{ height:56, fontSize:24, fontFamily:'var(--font-pixel)' }}>{n}</button>
      ))}
    </div>
  )
}

function Dots({ count, filled }) {
  return (
    <div style={{ display:'flex', justifyContent:'center', gap:12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <span key={i} className={`px-pip${i < filled ? ' px-pip--gold' : ''}`} style={{ width:22, height:22 }} />
      ))}
    </div>
  )
}

// A question a 4- to 7-year-old can't answer, as a gate where no own PIN
// is set yet (and for a forgotten PIN). The dialog used to show
// "Standard: 1234" — readable for a six-year-old.
function makeQuestion(hard) {
  const r = (a, b) => a + Math.floor(Math.random() * (b - a + 1))
  const a = hard ? r(12, 19) : r(6, 9), b = r(hard ? 3 : 6, 9)
  return { text: `${a} × ${b}`, answer: String(a * b) }
}

function Gate({ pinIsDefault, correctPin, onUnlock, onCancel, onNewPin }) {
  // 'pin' → enter the PIN; 'quiz' → parent question; 'set' → choose a PIN
  const [mode, setMode] = useState(pinIsDefault ? 'quiz' : 'pin')
  const [q, setQ] = useState(() => makeQuestion(!pinIsDefault))
  const [value, setValue] = useState('')
  const [first, setFirst] = useState(null)
  const [shake, setShake] = useState(false)
  const [error, setError] = useState('')

  const fail = (msg) => { setError(msg); setShake(true); setTimeout(() => { setValue(''); setShake(false) }, 500) }

  const length = mode === 'quiz' ? q.answer.length : 4
  const submit = useCallback((v = value) => {
    if (mode === 'pin') {
      if (v === correctPin) onUnlock()
      else fail('Falscher PIN')
    } else if (mode === 'quiz') {
      if (v === q.answer) { setMode('set'); setValue(''); setError('') }
      else { fail('Das stimmt nicht.'); setQ(makeQuestion(!pinIsDefault)) }
    } else if (!first) {
      setFirst(v); setValue('')
    } else if (v === first) {
      onNewPin(v); onUnlock()
    } else {
      setFirst(null); fail('Die beiden PINs waren verschieden. Bitte noch einmal.')
    }
  }, [mode, value, q, first, correctPin]) // eslint-disable-line react-hooks/exhaustive-deps

  const change = v => {
    setValue(v); setError('')
    if (v.length === length && mode !== 'quiz') setTimeout(() => submit(v), 120)
  }

  const title = mode === 'pin' ? 'Eltern-PIN' : mode === 'quiz' ? 'Nur für Eltern' : (first ? 'PIN wiederholen' : 'Eigene PIN festlegen')
  const hint = mode === 'pin' ? 'Bitte gib deine PIN ein.'
    : mode === 'quiz' ? `Wie viel ist ${q.text}?`
    : first ? 'Bitte die neue PIN noch einmal eingeben.' : 'Lege eine PIN mit vier Ziffern fest. Sie schützt den Elternbereich.'

  return (
    <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ fontSize:42 }}>🔐</div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:23, fontWeight:700, color:'var(--px-ink)' }}>{title}</div>
      <div style={{ ...SMALL, fontSize: mode === 'quiz' ? 20 : 15, color: mode === 'quiz' ? 'var(--px-ink)' : SMALL.color }}>{hint}</div>
      <motion.div animate={shake ? { x:[-8,8,-6,6,-4,4,0] } : {}} transition={{ duration:0.4 }}>
        {mode === 'quiz'
          ? <div style={{ ...INPUT, display:'inline-block', minWidth:120, fontSize:26, textAlign:'center' }}>{value || ' '}</div>
          : <Dots count={4} filled={value.length} />}
      </motion.div>
      {error && <div role="alert" style={{ ...SMALL, color:'#a02c1f' }}>{error}</div>}
      <NumberPad value={value} onChange={change} length={length} onEnter={() => submit()} />
      {mode === 'quiz' && (
        <button className="px-btn px-btn--green px-btn--md" onClick={() => submit()} disabled={!value} style={{ alignSelf:'center' }}>
          OK
        </button>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
        <button className="px-btn px-btn--parch px-btn--sm" onClick={onCancel}>Abbrechen</button>
        {mode === 'pin' && (
          <button className="px-btn px-btn--parch px-btn--sm" onClick={() => { setQ(makeQuestion(true)); setMode('quiz'); setValue(''); setError('') }}>
            PIN vergessen?
          </button>
        )}
        {mode === 'set' && pinIsDefault && (
          <button className="px-btn px-btn--parch px-btn--sm" onClick={onUnlock}>Später</button>
        )}
      </div>
    </div>
  )
}

// ── Edit a child's profile (moved here from the children's switcher) ──────
function EditProfile({ profile, onSave, onCancel }) {
  const [name, setName]     = useState(profile.name)
  const [age, setAge]       = useState(profile.age)
  const [avatar, setAvatar] = useState(profile.avatar)
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12, marginTop:10 }}>
      <label style={{ display:'flex', flexDirection:'column', gap:4 }}>
        <span style={SMALL}>Name</span>
        <input type="text" value={name} maxLength={20} onChange={e => setName(e.target.value)} style={INPUT} />
      </label>
      <div>
        <div style={{ ...SMALL, marginBottom:4 }}>Alter</div>
        <div style={{ display:'flex', gap:8 }}>
          {AGES.map(a => (
            <button key={a} className={`px-btn ${age === a ? 'px-btn--gold' : 'px-btn--parch'}`} onClick={() => setAge(a)}
              aria-pressed={age === a} style={{ flex:1, minHeight:48, fontSize:20 }}>{a}</button>
          ))}
        </div>
      </div>
      <div>
        <div style={{ ...SMALL, marginBottom:4 }}>Bild</div>
        {/* fixed tile size: six columns of aspect-ratio 1 made 225 px tiles
            with a 22 px emoji on a desktop */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(52px, 1fr))', gap:8, maxWidth:520 }}>
          {AVATARS.map(a => (
            <button key={a} className={`px-btn ${avatar === a ? 'px-btn--gold' : 'px-btn--parch'}`} onClick={() => setAvatar(a)}
              aria-label={avatarName(a)} aria-pressed={avatar === a}
              style={{ height:52, padding:0, fontSize:30 }}>{a}</button>
          ))}
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button className="px-btn px-btn--parch px-btn--md" onClick={onCancel} style={{ flex:1 }}>Abbrechen</button>
        <button className="px-btn px-btn--green px-btn--md" disabled={!name.trim()} style={{ flex:1 }}
          onClick={() => name.trim() && onSave({ name: name.trim(), age, avatar })}>Speichern</button>
      </div>
    </div>
  )
}

export default function ParentScreen({ onClose }) {
  const { state, dispatch } = useApp()
  const music = useMusic()
  const profiles = Object.values(state.profiles ?? {})
  const [viewId, setViewId] = useState(state.activeProfileId ?? profiles[0]?.id)
  const view = state.profiles[viewId] ?? profiles[0]
  const progress = view?.progress ?? {}
  const currentPin = state.settings?.parentPin ?? '1234'
  const pinIsDefault = state.settings?.pinIsDefault ?? true
  const [unlocked, setUnlocked] = useState(false)
  const [toast, setToast] = useState(null)
  const [confirm, setConfirm] = useState(null)   // { title, text, yesLabel, onYes }
  const [editingId, setEditingId] = useState(null)
  // ErrorBoundary.jsx has always written crashes here for "parent panel
  // debugging" per its own comment — nothing ever read it back until now.
  const [errorLog, setErrorLog] = useState(() => {
    try { return JSON.parse(readStore('lumilearn_errors', '[]')) } catch { return [] }
  })
  const [showErrors, setShowErrors] = useState(false)
  // PIN change state
  const [showPinChange, setShowPinChange] = useState(false)
  const [pinCurrent, setPinCurrent] = useState('')
  const [pinNew, setPinNew] = useState('')
  const [pinRepeat, setPinRepeat] = useState('')
  const [pinError, setPinError] = useState('')
  const fileRef = useRef(null)

  const toastTimer = useRef(null)
  const showToast = (msg) => { setToast(msg); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 2400) }
  useEffect(() => () => clearTimeout(toastTimer.current), [])

  // PIN gate, then the parent area: Tab stays inside, Escape closes, and the
  // focus goes back to the ⚙️ button (a confirm on top takes the keys first)
  const gateRef  = useFocusTrap(!unlocked, { onEscape: onClose })
  const panelRef = useFocusTrap(unlocked, { onEscape: onClose })

  const name = view?.name ?? 'Kind'

  // Resetting a game took one tap on a red button next to the level select.
  const resetModule = (id) => setConfirm({
    title: `${moduleTitle(id)} zurücksetzen?`,
    text: `Alle Sterne und Level von ${name} in diesem Spiel werden gelöscht.`,
    yesLabel: 'Zurücksetzen',
    onYes: () => { dispatch({ type: 'RESET_MODULE', payload: { id, profileId: view.id } }); showToast(`${moduleTitle(id)} zurückgesetzt`) },
  })

  // Switched-off games disappear from the child's home screen and missions
  const hiddenGames = view?.hiddenGames ?? []
  const shownCount = MODULES.length - MODULES.filter(m => hiddenGames.includes(m.id)).length
  const setGameShown = (id, shown) => {
    dispatch({ type: 'SET_GAME_HIDDEN', payload: { id, hidden: !shown, profileId: view.id } })
    showToast(shown ? `${moduleTitle(id)} wird wieder gezeigt` : `${moduleTitle(id)} ausgeblendet`)
  }

  const setModuleLevel = (id, level) => {
    dispatch({ type: 'SET_MODULE_LEVEL', payload: { id, level, profileId: view.id } })
    showToast(`${moduleTitle(id)}: Start bei Level ${level}`)
  }

  const deleteProfile = (p) => setConfirm({
    title: `${p.name} löschen?`,
    text: `Das Profil und alle Spielstände, Sterne und der Hof von ${p.name} werden gelöscht. Das lässt sich nicht rückgängig machen.`,
    yesLabel: 'Löschen',
    onYes: () => {
      dispatch({ type: 'DELETE_PROFILE', payload: p.id })
      showToast(`${p.name} gelöscht`)
      if (p.id === viewId) setViewId(profiles.find(x => x.id !== p.id)?.id)
      if (profiles.length <= 1) onClose()
    },
  })

  const resetProfile = () => setConfirm({
    title: `${name} komplett zurücksetzen?`,
    text: `Alle Spielstände, Sterne, die Serie und der Hof von ${name} werden gelöscht. Andere Kinder sind nicht betroffen.`,
    yesLabel: 'Zurücksetzen',
    onYes: () => { dispatch({ type: 'RESET_PROFILE', payload: view.id }); showToast(`${name} zurückgesetzt`) },
  })

  const handlePinChange = () => {
    setPinError('')
    // without an own PIN yet there is nothing to confirm
    if (!pinIsDefault && pinCurrent !== currentPin) { setPinError('Falscher aktueller PIN'); return }
    if (!/^\d{4}$/.test(pinNew)) { setPinError('PIN muss 4 Ziffern haben'); return }
    if (pinNew !== pinRepeat) { setPinError('PIN stimmt nicht überein'); return }
    dispatch({ type: 'SET_PARENT_PIN', payload: pinNew })
    setPinCurrent(''); setPinNew(''); setPinRepeat(''); setShowPinChange(false)
    showToast('PIN geändert')
  }

  // Backup: the progress lives only in this browser
  const exportSave = () => {
    const blob = new Blob([JSON.stringify(saveData(state), null, 1)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `lumilearn-sicherung-${todayStr()}.json`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  }
  const importSave = (file) => {
    if (!file) return
    file.text().then(txt => {
      let data
      try { data = JSON.parse(txt) } catch { showToast('Die Datei ist keine LumiLearn-Sicherung'); return }
      if (!data?.profiles) { showToast('Die Datei ist keine LumiLearn-Sicherung'); return }
      setConfirm({
        title: 'Sicherung laden?',
        text: 'Der jetzige Spielstand aller Kinder wird durch die Sicherung ersetzt.',
        yesLabel: 'Laden',
        onYes: () => { dispatch({ type: 'IMPORT_SAVE', payload: data }); onClose() },
      })
    })
  }

  const overview = useMemo(() => profiles.map(p => {
    const prog = p.progress ?? {}
    const stars = Object.values(prog).reduce((s, m) => s + Object.values(m?.levelStars ?? {}).reduce((a, b) => a + (b ?? 0), 0), 0)
    const mastered = Object.values(prog).filter(m => m?.completed).length
    // games where the last rounds went badly: worth playing together
    const struggling = Object.entries(prog).filter(([, m]) => (m?.plays ?? 0) >= 2 && (m?.lastStars ?? 3) <= 1).map(([id]) => moduleTitle(id))
    const last = p.lastPlayed?.ts ? new Date(p.lastPlayed.ts) : null
    return {
      p, stars, mastered, struggling,
      hidden: MODULES.filter(m => (p.hiddenGames ?? []).includes(m.id)).length,
      today: minutes(p.playLog?.[todayStr()]?.ms), gamesToday: p.playLog?.[todayStr()]?.games ?? 0,
      week: minutes(weekMs(p)),
      last: last ? `${last.toLocaleDateString('de-DE')} · ${moduleTitle(p.lastPlayed.moduleId)}` : 'noch nicht gespielt',
      streak: liveStreak(p.streak),
      farm: FARM_LEVEL_LABELS[getFarmLevel(farmPoints(p))],
    }
  }), [state.profiles]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!unlocked) {
    return createPortal(
      // keyed: gate and parent area are different dialogs, not one reused
      // element (its ref would stay with the gate's focus trap)
      <div key="gate" className="px-backdrop" onClick={onClose}>
        <motion.div ref={gateRef} initial={{scale:0.85,y:20}} animate={{scale:1,y:0}}
          role="dialog" aria-modal="true" aria-label="Elternbereich öffnen"
          onClick={e => e.stopPropagation()}
          className="px-panel"
          style={{ padding:'22px 18px', maxWidth:360, width:'100%', maxHeight:'94dvh', overflowY:'auto' }}>
          <Gate pinIsDefault={pinIsDefault} correctPin={currentPin}
            onUnlock={() => setUnlocked(true)} onCancel={onClose}
            onNewPin={pin => dispatch({ type: 'SET_PARENT_PIN', payload: pin })} />
        </motion.div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div key="panel" className="px-backdrop" style={{ alignItems:'flex-start', overflowY:'auto', padding:'16px 12px' }}>
      <motion.div ref={panelRef} initial={{scale:0.95,y:20}} animate={{scale:1,y:0}}
        role="dialog" aria-modal="true" aria-label="Elternbereich"
        style={{ width:'100%', maxWidth:640, margin:'0 auto' }}>

        {/* Header */}
        <div className="px-wood" style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:10, border:'3px solid var(--px-ink)', marginBottom:14 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <div className="px-title" style={{ fontSize:24 }}>Elternbereich</div>
          </div>
          <button className="px-btn px-btn--parch px-btn--icon" onClick={onClose} aria-label="Elternbereich schließen">
            <PxIcon name="close" size={20} color="var(--px-ink)" />
          </button>
        </div>

        {state._saveFailed && (
          <div role="alert" className="px-panel" style={{ ...SECTION, background:'#ffe3c2' }}>
            <div style={H2}>⚠️ Speichern klappt nicht</div>
            <div style={SMALL}>Der Browser lässt LumiLearn gerade nichts speichern (Speicher voll oder gesperrt). Nach dem Schließen wäre der Fortschritt weg. Bitte unten eine Sicherung herunterladen.</div>
          </div>
        )}

        {/* Kinder */}
        <div className="px-panel" style={SECTION}>
          <div style={H2}>Kinder</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {overview.map(o => (
              <div key={o.p.id} style={{ border:'3px solid var(--px-ink)', borderRadius:10, padding:'10px 12px', background: o.p.id === viewId ? '#fff1c2' : 'var(--px-parch-light)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:34, lineHeight:1 }}>{o.p.avatar}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:'var(--font-heading)', fontSize:19, fontWeight:700, color:'var(--px-ink)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {o.p.name}{o.p.age ? `, ${o.p.age} Jahre` : ''}
                    </div>
                    <div style={SMALL}>Zuletzt: {o.last}</div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:6, marginTop:8, ...SMALL, color:'var(--px-ink)' }}>
                  <span>⏱️ Heute {o.today} Min. ({o.gamesToday} {o.gamesToday === 1 ? 'Runde' : 'Runden'})</span>
                  <span>📅 7 Tage: {o.week} Min.</span>
                  <span>⭐ {o.stars} Sterne</span>
                  <span>🏆 {o.mastered} von {MODULES.length} gemeistert</span>
                  <span>🔥 {tage(o.streak)}</span>
                  <span>🌾 {o.farm}</span>
                  {o.hidden > 0 && <span>🙈 {o.hidden} {o.hidden === 1 ? 'Spiel' : 'Spiele'} ausgeblendet</span>}
                </div>
                {o.struggling.length > 0 && (
                  <div style={{ ...SMALL, marginTop:6 }}>Fällt gerade schwer: {o.struggling.join(', ')}</div>
                )}
                {editingId === o.p.id ? (
                  <EditProfile profile={o.p} onCancel={() => setEditingId(null)}
                    onSave={data => { dispatch({ type: 'UPDATE_PROFILE', payload: { id: o.p.id, ...data } }); setEditingId(null); showToast('Gespeichert') }} />
                ) : (
                  <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
                    <button className="px-btn px-btn--parch px-btn--sm" onClick={() => setViewId(o.p.id)} aria-pressed={o.p.id === viewId}>🎮 Spiele</button>
                    <button className="px-btn px-btn--parch px-btn--sm" onClick={() => setEditingId(o.p.id)}>✏️ Bearbeiten</button>
                    <button className="px-btn px-btn--parch px-btn--sm" onClick={() => deleteProfile(o.p)}>🗑️ Löschen</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Einstellungen */}
        <div className="px-panel" style={SECTION}>
          <div style={H2}>Einstellungen</div>
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <label style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ ...SMALL, color:'var(--px-ink)', minWidth:130 }}>🎵 Musik</span>
              <button className={`px-btn px-btn--sm ${music.enabled ? 'px-btn--green' : 'px-btn--parch'}`} onClick={() => music.setEnabled(!music.enabled)} aria-pressed={music.enabled}>
                {music.enabled ? 'An' : 'Aus'}
              </button>
              <input type="range" min={0} max={0.5} step={0.01} value={music.volume} aria-label="Lautstärke der Musik"
                onChange={e => music.setVolume(parseFloat(e.target.value))} style={{ flex:1, minWidth:120, accentColor:'var(--px-wood)' }} />
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ ...SMALL, color:'var(--px-ink)', minWidth:130 }}>🔊 Lumis Stimme</span>
              <input type="range" min={0.2} max={1} step={0.05} value={state.settings?.voiceVolume ?? 1} aria-label="Lautstärke von Lumis Stimme"
                onChange={e => dispatch({ type: 'SET_SETTING', payload: { voiceVolume: parseFloat(e.target.value) } })} style={{ flex:1, minWidth:120, accentColor:'var(--px-wood)' }} />
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              <span style={{ ...SMALL, color:'var(--px-ink)', minWidth:130 }}>⏱️ Spielzeit am Tag</span>
              <select value={state.settings?.dailyLimitMin ?? 0} style={INPUT}
                onChange={e => dispatch({ type: 'SET_SETTING', payload: { dailyLimitMin: parseInt(e.target.value, 10) } })}>
                <option value={0}>ohne Grenze</option>
                {[15, 20, 30, 45, 60, 90].map(m => <option key={m} value={m}>{m} Minuten</option>)}
              </select>
            </label>
            <div style={SMALL}>Ist die Zeit um, sagt Lumi „Für heute ist Schluss“. Eine laufende Runde wird nicht unterbrochen.</div>
            {ENGLISH_ENABLED && (
              <label style={{ display:'flex', alignItems:'center', gap:10 }}>
                <span style={{ ...SMALL, color:'var(--px-ink)', minWidth:130 }}>Sprache</span>
                <select value={state.language} style={INPUT} onChange={e => dispatch({ type: 'SET_LANGUAGE', payload: e.target.value })}>
                  <option value="de">Deutsch</option>
                  <option value="en">English</option>
                </select>
              </label>
            )}
          </div>
        </div>

        {/* Spiele des gewählten Kindes */}
        {view && (
          <div className="px-panel" style={SECTION}>
            <div style={H2}>Spiele von {name}</div>
            <div style={{ ...SMALL, marginBottom:10 }}>
              An oder Aus: ob {name} das Spiel auf der Startseite sieht. Mindestens ein Spiel bleibt an.
              Die Zahl ist das Level, mit dem das Spiel beginnt; Sterne bleiben dabei erhalten. 🔄 setzt ein Spiel ganz zurück.
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {MODULES.map(({ id, title }) => {
                const prog = progress[id]
                const curLv = prog?.currentLevel ?? 1
                const maxLv = MAX_LEVELS[id] ?? 10
                const stars = Object.values(prog?.levelStars ?? {}).reduce((a,b) => a+b, 0)
                const shown = !hiddenGames.includes(id)
                const last = shown && shownCount <= 1
                return (
                  // wraps on a phone: switch and name on top, level and reset below
                  <div key={id} style={{
                    display:'flex', flexWrap:'wrap', alignItems:'center', gap:8,
                    padding:'8px 10px', borderRadius:8, border:'2px solid var(--px-parch-dark)',
                    background: shown ? 'var(--px-parch-light)' : 'var(--px-parch-dark)',
                  }}>
                    <button className={`px-btn px-btn--sm ${shown ? 'px-btn--green' : 'px-btn--parch'}`}
                      role="switch" aria-checked={shown} aria-label={`${title} anzeigen`}
                      disabled={last} title={last ? 'Ein Spiel bleibt immer an' : undefined}
                      onClick={() => setGameShown(id, !shown)} style={{ width:64, flexShrink:0 }}>
                      {shown ? 'An' : 'Aus'}
                    </button>
                    <div style={{ flex:'1 1 140px', minWidth:0 }}>
                      <div style={{ fontFamily:'var(--font-heading)', fontSize:16, fontWeight:700, color:'var(--px-ink)', overflowWrap:'anywhere' }}>
                        {title}{prog?.completed ? ' 🏆' : ''}
                      </div>
                      <div style={{ ...SMALL, fontSize:14, color: shown ? SMALL.color : 'var(--px-ink)' }}>
                        {shown ? '' : 'Ausgeblendet · '}Level {curLv} von {maxLv} · {stars} ⭐
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:8, marginLeft:'auto' }}>
                      {/* numbers only: "Level 1" options squeezed the game's name */}
                      <select value={curLv} aria-label={`${title}: Start-Level`} title="Start-Level"
                        onChange={e => setModuleLevel(id, parseInt(e.target.value, 10))} style={{ ...INPUT, minHeight:44, width:64 }}>
                        {Array.from({length: maxLv}, (_,i) => i+1).map(l => (
                          <option key={l} value={l}>{l}</option>
                        ))}
                      </select>
                      <button className="px-btn px-btn--parch px-btn--sm" onClick={() => resetModule(id)} aria-label={`${title} zurücksetzen`}>
                        🔄
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* PIN ändern */}
        <div className="px-panel" style={SECTION}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div style={{ ...H2, margin:0 }}>🔑 PIN {pinIsDefault ? 'festlegen' : 'ändern'}</div>
            <button className="px-btn px-btn--parch px-btn--sm" onClick={() => { setShowPinChange(v => !v); setPinError('') }}>
              {showPinChange ? 'Abbrechen' : 'Ändern'}
            </button>
          </div>
          <AnimatePresence>
            {showPinChange && (
              <motion.div initial={{height:0,opacity:0}} animate={{height:'auto',opacity:1}} exit={{height:0,opacity:0}} style={{ overflow:'hidden' }}>
                <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:12 }}>
                  {[
                    ...(pinIsDefault ? [] : [{ label:'Aktueller PIN', value:pinCurrent, setter:setPinCurrent }]),
                    { label:'Neuer PIN (4 Ziffern)', value:pinNew, setter:setPinNew },
                    { label:'Neuen PIN wiederholen', value:pinRepeat, setter:setPinRepeat },
                  ].map(({ label, value, setter }) => (
                    <label key={label} style={{ display:'flex', flexDirection:'column', gap:4 }}>
                      <span style={SMALL}>{label}</span>
                      <input type="password" inputMode="numeric" value={value} maxLength={4}
                        onChange={e => setter(e.target.value.replace(/\D/g,'').slice(0,4))}
                        style={{ ...INPUT, letterSpacing:8, fontSize:20 }} />
                    </label>
                  ))}
                  {pinError && <div role="alert" style={{ ...SMALL, color:'#a02c1f' }}>⚠️ {pinError}</div>}
                  <button className="px-btn px-btn--green px-btn--md" onClick={handlePinChange}>
                    PIN speichern
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Sicherung */}
        <div className="px-panel" style={SECTION}>
          <div style={H2}>💾 Sicherung</div>
          <div style={{ ...SMALL, marginBottom:10 }}>Der Fortschritt liegt nur in diesem Browser. Eine Sicherung bewahrt ihn auf, etwa für ein neues Gerät.</div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button className="px-btn px-btn--parch px-btn--sm" onClick={exportSave}>Sicherung herunterladen</button>
            <button className="px-btn px-btn--parch px-btn--sm" onClick={() => fileRef.current?.click()}>Sicherung laden</button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden
              onChange={e => { importSave(e.target.files?.[0]); e.target.value = '' }} />
          </div>
        </div>

        {/* Error log — collected by ErrorBoundary.jsx whenever a game
            crashes, previously never surfaced anywhere. */}
        <div className="px-panel" style={SECTION}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:10 }}>
            <div style={{ ...H2, margin:0, display:'flex', alignItems:'center', gap:8 }}>
              🐞 Fehler-Log
              {errorLog.length > 0 && <span className="px-chip" style={{ fontSize:14, minHeight:28 }}>{errorLog.length}</span>}
            </div>
            <button className="px-btn px-btn--parch px-btn--sm" onClick={() => setShowErrors(v => !v)}>
              {showErrors ? 'Verbergen' : 'Anzeigen'}
            </button>
          </div>
          {showErrors && (
            errorLog.length === 0 ? (
              <div style={{ ...SMALL, marginTop:10 }}>Keine Fehler aufgezeichnet.</div>
            ) : (
              <>
                <div style={{ display:'flex', flexDirection:'column', gap:8, maxHeight:280, overflowY:'auto', marginTop:10 }}>
                  {errorLog.map((e, i) => (
                    <div key={i} style={{ border:'2px solid var(--px-parch-dark)', borderRadius:8, padding:'8px 10px', background:'var(--px-parch-light)' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', gap:8, fontFamily:'var(--font-heading)', fontSize:14, color:'var(--px-ink)', fontWeight:700 }}>
                        <span>{moduleTitle(e.module) ?? 'Unbekannt'}</span>
                        <span style={{ ...SMALL, fontSize:13 }}>{e.ts ? new Date(e.ts).toLocaleString('de-DE') : ''}</span>
                      </div>
                      <div style={{ ...SMALL, fontSize:14, wordBreak:'break-word' }}>{e.message || 'Unbekannter Fehler'}</div>
                    </div>
                  ))}
                </div>
                <button className="px-btn px-btn--parch px-btn--sm" style={{ marginTop:10 }}
                  onClick={() => { removeStore('lumilearn_errors'); setErrorLog([]); showToast('Fehler-Log geleert') }}>
                  🗑️ Log leeren
                </button>
              </>
            )
          )}
        </div>

        {/* Full reset — scoped to one child. RESET_ALL used to be
            dispatched here, which wipes every profile in the whole family. */}
        {view && (
          <div className="px-panel" style={{ ...SECTION, background:'#ffe9e4' }}>
            <div style={H2}>{name} zurücksetzen</div>
            <div style={{ ...SMALL, marginBottom:10 }}>
              Löscht alle Spielstände, Sterne, die Serie und den Hof von {name}. Andere Kinder sind nicht betroffen.
            </div>
            <button className="px-btn px-btn--red px-btn--md" onClick={resetProfile}>{name} zurücksetzen</button>
          </div>
        )}
      </motion.div>

      {confirm && (
        <ConfirmDialog danger
          title={confirm.title} text={confirm.text}
          noLabel="Abbrechen" yesLabel={confirm.yesLabel}
          onNo={() => setConfirm(null)}
          onYes={() => { const c = confirm; setConfirm(null); c.onYes() }}
        />
      )}

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div initial={{y:40,opacity:0}} animate={{y:0,opacity:1}} exit={{y:40,opacity:0}}
            role="status"
            className="px-chip"
            style={{
              position:'fixed', bottom:24, left:'50%', x:'-50%',
              fontFamily:'var(--font-heading)', fontSize:17, zIndex:3100, padding:'8px 18px',
            }}>
            ✅ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>,
    document.body,
  )
}
