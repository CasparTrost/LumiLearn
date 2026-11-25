import { useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'

// The parent gate: the parents' PIN, or (no own PIN yet, or a forgotten
// one) a question a 4- to 7-year-old can't answer. The parent area uses
// it, and the games where a grown-up helps (the Mal-Atelier's own picture).
const SMALL = { fontFamily:'var(--font-body)', fontSize:15, fontWeight:600, color:'var(--text-secondary)' }
const INPUT = {
  padding:'8px 10px', minHeight:44, borderRadius:8, border:'3px solid var(--px-ink)',
  background:'var(--px-parch-light)', color:'var(--px-ink)', fontFamily:'var(--font-heading)', fontSize:16,
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

export default function Gate({ pinIsDefault, correctPin, onUnlock, onCancel, onNewPin, quizOnly = false, sideways = false }) {
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
      if (v === q.answer) {
        // a grown-up helps in a game (quizOnly): no PIN to set up there
        if (quizOnly) onUnlock()
        else { setMode('set'); setValue(''); setError('') }
      }
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

  // sideways (a phone held sideways): the number pad beside the question
  const pad = <NumberPad value={value} onChange={change} length={length} onEnter={() => submit()} />
  return (
    <div style={{ display:'flex', flexDirection: sideways ? 'row' : 'column', alignItems: sideways ? 'center' : undefined, gap: sideways ? 20 : 0, justifyContent:'center' }}>
    <div style={{ textAlign:'center', display:'flex', flexDirection:'column', gap: sideways ? 10 : 14 }}>
      <div style={{ fontSize: sideways ? 30 : 42 }}>🔐</div>
      <div style={{ fontFamily:'var(--font-heading)', fontSize:23, fontWeight:700, color:'var(--px-ink)' }}>{title}</div>
      <div style={{ ...SMALL, fontSize: mode === 'quiz' ? 20 : 15, color: mode === 'quiz' ? 'var(--px-ink)' : SMALL.color }}>{hint}</div>
      <motion.div animate={shake ? { x:[-8,8,-6,6,-4,4,0] } : {}} transition={{ duration:0.4 }}>
        {mode === 'quiz'
          ? <div style={{ ...INPUT, display:'inline-block', minWidth:120, fontSize:26, textAlign:'center' }}>{value || ' '}</div>
          : <Dots count={4} filled={value.length} />}
      </motion.div>
      {error && <div role="alert" style={{ ...SMALL, color:'#a02c1f' }}>{error}</div>}
      {!sideways && pad}
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
    {sideways && pad}
    </div>
  )
}

