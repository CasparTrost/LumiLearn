import { useState } from 'react'
import { createPortal } from 'react-dom'
import { pxButton, INK } from '../px.js'
import { savePicture, printPicture, toPng, pictureName } from './keepPicture.js'

// Drawn icons (the emoji set has no printer and no arrow down)
export function SaveIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 V14 M7 10 L12 15 L17 10" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16 V20 H20 V16" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
export function PrintIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 9 V3 H17 V9" fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <rect x="2.5" y="9" width="19" height="9" rx="2" fill="#B9C3D6" stroke={INK} strokeWidth="2.4" />
      <path d="M7 14 H17 V21 H7 Z" fill="#fff" stroke={INK} strokeWidth="2.4" strokeLinejoin="round" />
      <circle cx="18" cy="12" r="1.2" fill="#3FAE4A" />
    </svg>
  )
}

const btn = (size, color = 'parch') => ({
  ...pxButton(color), color: INK, textShadow: 'none', minWidth: size, minHeight: size, padding: '2px 10px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
  fontFamily: 'var(--font-heading)', fontSize: size >= 56 ? 16 : 14,
})

/**
 * Keep a picture: save it as a PNG (download or share sheet) and print it.
 * With the page's lines (`linesSrc`), printing asks first, with two
 * pictures: in colour, or only the lines to colour on paper.
 *
 *   picture   the painted picture: a Blob or a URL
 *   linesSrc  the page without paint (URL), or null for the empty sheet
 *   size      button size
 *   labels    words under the icons (for grown-ups; the icons speak for themselves)
 */
export default function KeepButtons({ picture, linesSrc, size = 56, labels = true, style }) {
  const [choose, setChoose] = useState(null)       // { color, lines } URLs while asking
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (busy) return
    setBusy(true)
    try { await savePicture(await toPng(picture), pictureName()) } catch { /* nothing kept */ }
    setBusy(false)
  }
  const colorUrl = () => (picture instanceof Blob ? URL.createObjectURL(picture) : picture)
  const print = async () => {
    if (linesSrc) { setChoose({ color: colorUrl(), lines: linesSrc }); return }
    await printPicture(colorUrl()).catch(() => {})
  }
  const printOne = async src => {
    setChoose(null)
    await printPicture(src).catch(() => {})
  }

  return (
    <div style={{ display: 'flex', gap: 10, ...style }}>
      <button type="button" onClick={save} aria-label="Bild speichern" disabled={busy} style={btn(size)}>
        <SaveIcon size={Math.round(size * 0.5)} />{labels && 'Speichern'}
      </button>
      <button type="button" onClick={print} aria-label="Bild drucken" style={btn(size)}>
        <PrintIcon size={Math.round(size * 0.52)} />{labels && 'Drucken'}
      </button>
      {choose && createPortal(
        <div className="px-backdrop" onClick={() => setChoose(null)} style={{ zIndex: 3200, padding: 12 }}>
          <div className="px-panel" role="dialog" aria-label="Was drucken?" onClick={e => e.stopPropagation()}
            style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center', maxWidth: 520, width: '100%', maxHeight: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, alignSelf: 'stretch' }}>
              <PrintIcon size={30} />
              <span style={{ flex: 1, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: INK }}>Drucken</span>
              <button type="button" onClick={() => setChoose(null)} aria-label="Schließen" style={{ ...btn(48), padding: 0 }}>❌</button>
            </div>
            <div style={{ display: 'flex', gap: 14, justifyContent: 'center', minHeight: 0 }}>
              {[['color', 'In Farbe'], ['lines', 'Nur die Linien']].map(([k, label]) => (
                <button key={k} type="button" onClick={() => printOne(choose[k])} aria-label={label} style={{
                  ...pxButton('parch'), padding: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  color: INK, textShadow: 'none', fontFamily: 'var(--font-heading)', fontSize: 15,
                }}>
                  <img src={choose[k]} alt="" style={{ width: 'min(36vw, 200px)', maxHeight: '48vh', objectFit: 'contain', background: '#fff', border: `2px solid ${INK}` }} />
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
