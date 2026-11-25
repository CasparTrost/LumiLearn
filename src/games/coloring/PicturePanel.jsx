import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { PxIcon } from '../../components/PixelUI.jsx'
import { Art } from '../../components/play/index.js'
import { pxButton, INK } from '../px.js'

const btn = color => ({
  ...pxButton(color), color: INK, textShadow: 'none', minHeight: 48, padding: '4px 14px', fontSize: 16,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
})
const heading = { fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 18, color: INK, display: 'flex', alignItems: 'center', gap: 6 }

/**
 * The Mal-Atelier's pictures, in one place: the empty sheet and the pages to
 * colour (as themselves, not as words: the children choosing can't read),
 * and below them the wall with the child's finished pictures in frames. A
 * framed picture opens big and can be painted on.
 *
 * They used to be a row of emoji above the easel that ran off the right
 * edge without a sign that there was more, plus an album behind 💾.
 */
export default function PicturePanel({ images, current, sheetRatio, album, urls, onPick, onContinue, onEmpty, onClose }) {
  const [viewing, setViewing] = useState(null)
  const canContinue = viewing?.paint && images.some(i => i.id === viewing.imgId)
  // Sideways the pages stand in a block of three by three beside the wall:
  // in one long list the wall was below the edge, out of sight
  const [vp, setVp] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const wide = vp.w > vp.h
  const thumbH = Math.floor(Math.min(160, (Math.min(vp.h, 900) - 2 * Math.min(16, vp.h * 0.03) - 20 - 56 - 2 * 8) / 3))
  const thumbW = Math.floor(thumbH * sheetRatio)

  return createPortal(
    <div className="px-backdrop" onClick={onClose} style={{ zIndex: 2500, padding: 'min(16px, 3vh) 12px' }}>
      <div className="px-panel" role="dialog" aria-label="Bilder" onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 820, maxHeight: '100%', display: 'flex', flexDirection: 'column', gap: 8, padding: 10, overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {viewing
            ? <button onClick={() => setViewing(null)} aria-label="Zurück zu den Bildern" style={btn('parch')}><PxIcon name="back" size={18} /></button>
            : <span style={{ ...heading, flex: 1 }}><Art art="🖼️" size={28} /> Bilder</span>}
          {viewing && <span style={{ flex: 1 }} />}
          <button onClick={onClose} aria-label="Schließen" style={{ ...btn('parch'), minWidth: 48, padding: 0 }}>❌</button>
        </div>

        {viewing ? (
          <>
            <div style={{ flex: 1, minHeight: 0, display: 'flex', justifyContent: 'center' }}>
              <img src={urls.get(viewing.id)} alt="Dein Bild" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', background: '#fff', border: `3px solid ${INK}`, borderRadius: 8 }} />
            </div>
            {canContinue && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <button onClick={() => onContinue(viewing)} style={btn('green')}>🖌️ Weitermalen</button>
              </div>
            )}
          </>
        ) : (
          <div style={{ overflowY: wide ? 'hidden' : 'auto', minHeight: 0, flex: wide ? 1 : undefined, display: 'flex', flexDirection: wide ? 'row' : 'column', gap: 10, padding: 2 }}>
            {/* a new picture */}
            <div style={{
              display: 'grid', gap: 8, flexShrink: 0, alignContent: 'start',
              gridTemplateColumns: wide ? `repeat(3, ${thumbW}px)` : 'repeat(auto-fill, minmax(clamp(58px, 10.5vw, 96px), 1fr))',
            }}>
              {images.map((img, i) => (
                <button key={img.id} onClick={() => onPick(i)} aria-label={img.label} aria-pressed={i === current} style={{
                  padding: 0, cursor: 'pointer', overflow: 'hidden', aspectRatio: `${sheetRatio}`, background: '#fff', borderRadius: 8,
                  border: `3px solid ${INK}`, outline: i === current ? '4px solid var(--px-gold)' : 'none', outlineOffset: 1,
                  boxShadow: '0 3px 0 rgba(42,27,61,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {img.src
                    ? <img src={img.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    : <Art art={img.emoji} size={40} />}
                </button>
              ))}
            </div>

            {/* the wall */}
            <div style={{
              flex: wide ? 1 : undefined, minWidth: 0, overflowY: wide ? 'auto' : undefined,
              borderRadius: 10, border: `3px solid ${INK}`, padding: '8px 10px 12px',
              background: 'repeating-linear-gradient(90deg, #fbefd6 0 22px, #f4e2c0 22px 44px)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ ...heading, flex: 1 }}>Deine Wand</span>
                {album.length > 0 && <button onClick={onEmpty} aria-label="Wand leeren" style={{ ...btn('red'), minWidth: 48, padding: 0 }}>🗑️</button>}
              </div>
              {album.length === 0 ? (
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: INK, padding: '6px 4px' }}>
                  Noch leer. Mal ein Bild und tippe auf ✅ Fertig, dann hängt es hier.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(64px, 12vw, 110px), 1fr))', gap: 16, padding: 6 }}>
                  {album.map((e, i) => (
                    <button key={e.id} onClick={() => setViewing(e)} aria-label="Bild ansehen" style={{
                      padding: 0, cursor: 'pointer', background: '#fff', aspectRatio: `${sheetRatio}`, transform: `rotate(${[-2, 1.5, 2, -1.5][i % 4]}deg)`,
                      border: '6px solid #b8773f', borderColor: '#c98a4e #9c602c #8a5426 #b8773f', borderRadius: 4,
                      boxShadow: `0 0 0 2px ${INK}, 0 4px 0 2px rgba(42,27,61,0.28)`,
                    }}>
                      <img src={urls.get(e.id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
