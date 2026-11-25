import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import ParentGate from '../../components/ParentGate.jsx'
import { PixelLumi } from '../../components/PixelUI.jsx'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import { pxButton, INK } from '../px.js'
import { readPicture, tracePicture, pageToBlob } from './ownPicture.js'

const btn = (color, extra) => ({
  ...pxButton(color), color: INK, textShadow: 'none', minHeight: 52, padding: '6px 16px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  fontFamily: 'var(--font-heading)', fontSize: 17, ...extra,
})
const TEXT = { fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 15, color: INK, lineHeight: 1.4, textAlign: 'center' }
const DETAIL = ['Weniger Linien', 'Normal', 'Mehr Linien']

/**
 * An own picture for the Mal-Atelier, with a grown-up: the parent gate
 * first (PIN or a question a child can't answer), then a picture from the
 * device — the file picker, which on a phone also offers the camera. Lumi
 * traces it (lineArt.js, in a worker; nothing leaves the device) and shows
 * the page before it is taken, with one choice: fewer or more lines.
 *
 *   settings  the app's settings (parent PIN)
 *   say       (key) Lumi says one of the Mal-Atelier's lines
 *   onTake    (blob, w, h) the page is taken
 *   onClose   closed without a page
 */
export default function OwnPictureDialog({ settings, say, onTake, onClose }) {
  const [step, setStep] = useState('gate')          // gate | pick | working | preview | fail
  const [detail, setDetail] = useState(1)
  const [pages, setPages] = useState({})             // detail -> { url, blob, w, h, ok, reason }
  const [original, setOriginal] = useState(null)     // a small copy of the picture
  const image = useRef(null)
  const inputRef = useRef(null)
  const run = useRef(0)
  const trapRef = useFocusTrap(true, { onEscape: onClose })
  // a phone held sideways: the gate's number pad goes beside the question
  const [sideways, setSideways] = useState(() => window.innerHeight < 520 && window.innerWidth > window.innerHeight)
  useEffect(() => {
    const on = () => setSideways(window.innerHeight < 520 && window.innerWidth > window.innerHeight)
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])

  // The pages' URLs live as long as their picture is in the dialog: all
  // three line settings stay on show (released on every change, a setting
  // seen before came back as a broken image)
  const made = useRef([])
  const release = () => { made.current.forEach(u => URL.revokeObjectURL(u)); made.current = [] }
  useEffect(() => release, [])

  const trace = async (d) => {
    const id = ++run.current
    setStep('working')
    say('atelier/zeichnet')
    const started = Date.now()
    try {
      const res = await tracePicture(image.current, d)
      const blob = res.ok ? await pageToBlob(res) : null
      // Lumi draws for a moment at least: a page that pops up at once looks like nothing happened
      await new Promise(r => setTimeout(r, Math.max(0, 900 - (Date.now() - started))))
      if (id !== run.current) return
      const url = blob ? URL.createObjectURL(blob) : null
      if (url) made.current.push(url)
      const page = { ok: res.ok, reason: res.reason, w: res.w, h: res.h, blob, url }
      setPages(p => ({ ...p, [d]: page }))
      setStep(page.ok ? 'preview' : 'fail')
      if (!page.ok) say('atelier/geht-nicht')
    } catch {
      if (id !== run.current) return
      setStep('fail')
      say('atelier/geht-nicht')
    }
  }

  const picked = async (file) => {
    if (!file) return
    setPages({}); setDetail(1)
    release()
    setStep('working')
    try {
      const img = await readPicture(file)
      image.current = img
      const c = document.createElement('canvas')
      const k = 240 / Math.max(img.width, img.height)
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      const full = document.createElement('canvas')
      full.width = img.width; full.height = img.height
      full.getContext('2d').putImageData(img, 0, 0)
      c.getContext('2d').drawImage(full, 0, 0, c.width, c.height)
      setOriginal(c.toDataURL('image/jpeg', 0.8))
      trace(1)
    } catch {
      setStep('fail')
      say('atelier/geht-nicht')
    }
  }

  const changeDetail = d => {
    if (d < 0 || d > 2) return
    setDetail(d)
    const have = pages[d]
    if (have) setStep(have.ok ? 'preview' : 'fail')
    else trace(d)
  }

  const page = pages[detail]
  const chooseFile = () => { if (inputRef.current) { inputRef.current.value = ''; inputRef.current.click() } }

  return createPortal(
    <div className="px-backdrop" onClick={step === 'working' ? undefined : onClose} style={{ zIndex: 2600, padding: 'min(14px, 2.5vh) 10px' }}>
      <motion.div ref={trapRef} role="dialog" aria-modal="true" aria-label="Eigenes Bild"
        initial={{ scale: 0.9, y: 16 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()} className="px-panel"
        style={{ width: '100%', maxWidth: step === 'gate' ? (sideways ? 600 : 360) : 640, maxHeight: '100%', overflowY: 'auto', padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>

        {/* one input for both: the file picker, and the camera on a phone */}
        <input ref={inputRef} type="file" accept="image/*" hidden data-testid="own-picture-input"
          onChange={e => picked(e.target.files?.[0])} />

        {step === 'gate' && (
          <ParentGate quizOnly sideways={sideways} pinIsDefault={settings?.pinIsDefault ?? true} correctPin={settings?.parentPin}
            onUnlock={() => setStep('pick')} onCancel={onClose} />
        )}

        {step === 'pick' && (
          <>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 22, color: INK }}>📷 Eigenes Bild</div>
            <div style={TEXT}>
              Eine Ausmalvorlage, eine Zeichnung deines Kindes oder ein Foto: Lumi zeichnet daraus Linien zum Ausmalen.
              Das Bild bleibt auf diesem Gerät, es wird nirgends hochgeladen.
            </div>
            <div style={{ ...TEXT, fontSize: 14, fontWeight: 500 }}>
              Tipp: Vorlagen und Zeichnungen gerade von oben und ohne Blitz fotografieren.
            </div>
            <button type="button" onClick={chooseFile} style={btn('green', { minHeight: 60, fontSize: 19 })}>🖼️ Bild wählen oder fotografieren</button>
            <button type="button" onClick={onClose} style={btn('parch', { minHeight: 44, fontSize: 15 })}>Abbrechen</button>
          </>
        )}

        {step === 'working' && (
          <div role="status" aria-live="polite" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '18px 8px' }}>
            <div style={{ position: 'relative' }}>
              <PixelLumi size={110} />
              <motion.div aria-hidden="true" animate={{ x: [0, 26, -10, 18, 0], y: [0, -8, 6, -4, 0], rotate: [0, 18, -12, 10, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                style={{ position: 'absolute', right: -26, bottom: 6, fontSize: 40 }}>✏️</motion.div>
            </div>
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: INK }}>Lumi zeichnet …</div>
          </div>
        )}

        {step === 'preview' && page && (
          <>
            {/* the picture, small, and what Lumi made of it, large: nothing covers the page */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 0, width: '100%' }}>
              {original && (
                <img src={original} alt="Das Foto" style={{
                  width: 'min(20%, 110px)', flexShrink: 0, border: `2px solid ${INK}`, borderRadius: 4,
                  boxShadow: '0 2px 0 rgba(42,27,61,0.35)', background: '#fff',
                }} />
              )}
              {original && <span aria-hidden="true" style={{ fontSize: 22, color: INK, flexShrink: 0 }}>➜</span>}
              <img src={page.url} alt="Das neue Malbild" style={{
                minWidth: 0, maxWidth: original ? '72%' : '100%', maxHeight: 'min(56vh, 620px)', objectFit: 'contain', display: 'block',
                background: '#fff', border: `3px solid ${INK}`, borderRadius: 6,
              }} />
            </div>
            {/* the one choice: fewer or more lines */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={() => changeDetail(detail - 1)} disabled={detail === 0} aria-label="Weniger Linien"
                style={btn('parch', { opacity: detail === 0 ? 0.45 : 1, fontSize: 15 })}><b style={{ fontSize: 22, lineHeight: 1 }}>−</b> Weniger Linien</button>
              <button type="button" onClick={() => changeDetail(detail + 1)} disabled={detail === 2} aria-label="Mehr Linien"
                style={btn('parch', { opacity: detail === 2 ? 0.45 : 1, fontSize: 15 })}>➕ Mehr Linien</button>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={chooseFile} style={btn('parch', { fontSize: 15 })}>🖼️ Anderes Bild</button>
              <button type="button" onClick={() => onTake(page.blob, page.w, page.h)} aria-label="Bild nehmen" style={btn('green', { minWidth: 130 })}>✅ Nehmen</button>
            </div>
          </>
        )}

        {step === 'fail' && (
          <>
            <PixelLumi size={90} />
            <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, color: INK, textAlign: 'center' }}>
              Aus diesem Bild kann Lumi leider kein Malbild machen.
            </div>
            <div style={TEXT}>
              {page?.reason === 'mess'
                ? 'Es wären zu viele Linien. Versuch es mit „Weniger Linien“ oder einem Bild mit weniger Einzelheiten.'
                : page?.reason === 'empty'
                  ? (detail < 2
                    ? 'Lumi findet darin keine Linien. Versuch es mit „Mehr Linien“ oder einem Foto mit mehr Licht.'
                    : 'Lumi findet darin keine Linien. Nimm ein Bild mit kräftigen Linien oder ein Foto mit mehr Licht.')
                  : 'Das Bild ließ sich nicht öffnen. Bitte wähle ein anderes.'}
            </div>
            {page && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                {page.reason === 'mess' && detail > 0 && <button type="button" onClick={() => changeDetail(detail - 1)} style={btn('parch', { fontSize: 15 })}><b style={{ fontSize: 22, lineHeight: 1 }}>−</b> Weniger Linien</button>}
                {page.reason === 'empty' && detail < 2 && <button type="button" onClick={() => changeDetail(detail + 1)} style={btn('parch', { fontSize: 15 })}>➕ Mehr Linien</button>}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button type="button" onClick={onClose} style={btn('parch', { fontSize: 15 })}>Abbrechen</button>
              <button type="button" onClick={chooseFile} style={btn('green')}>🖼️ Anderes Bild</button>
            </div>
          </>
        )}
      </motion.div>
    </div>,
    document.body,
  )
}
