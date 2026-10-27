import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { narrate } from '../narrator.js'
import { PixelLumi, PxIcon } from './PixelUI.jsx'
import { useFocusTrap } from '../hooks/useFocusTrap.js'

/**
 * A question with two big answers, in the pixel style.
 *
 * For children (`kid`): Lumi asks aloud and the answers are big buttons
 * with a picture — "Wirklich aufhören?" before leaving a game. For parents
 * (resetting, deleting) the same dialog replaces window.confirm, which a
 * child could tap away without reading.
 */
export default function ConfirmDialog({
  title, text, say, kid = false, danger = false,
  yesLabel = 'Ja', noLabel = 'Nein', onYes, onNo,
}) {
  useEffect(() => {
    if (say) narrate([{ text: say }])
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // the safe answer (the first button) gets the focus; Escape means "no"
  const trapRef = useFocusTrap(true, { onEscape: onNo })

  return createPortal(
    <div className="px-backdrop" onClick={onNo} style={{ zIndex: 3000 }}>
      <motion.div
        ref={trapRef}
        role="alertdialog" aria-modal="true" aria-label={title}
        initial={{ scale: 0.85, y: 20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        onClick={e => e.stopPropagation()}
        className="px-panel"
        style={{
          width: '100%', maxWidth: kid ? 440 : 400, padding: kid ? '22px 20px' : '20px 18px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center',
        }}
      >
        {kid && <PixelLumi size={88} />}
        <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--px-ink)', fontSize: kid ? 28 : 21, lineHeight: 1.2 }}>
          {title}
        </div>
        {text && (
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 600, color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.45 }}>
            {text}
          </div>
        )}
        <div style={{ display: 'flex', gap: 12, width: '100%', flexDirection: 'column' }}>
          {/* The safe answer is the big, first one */}
          <button className={`px-btn px-btn--green ${kid ? 'px-btn--lg' : 'px-btn--md'}`} onClick={onNo}
            style={{ whiteSpace: 'normal', padding: '10px 16px' }}>
            {kid && <PxIcon name="play" size={22} />} {noLabel}
          </button>
          <button className={`px-btn ${danger ? 'px-btn--red' : 'px-btn--parch'} ${kid ? 'px-btn--lg' : 'px-btn--md'}`} onClick={onYes}
            style={{ whiteSpace: 'normal', padding: '10px 16px' }}>
            {kid && <PxIcon name="close" size={20} />} {yesLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  )
}
