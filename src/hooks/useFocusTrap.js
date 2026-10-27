import { useEffect, useRef } from 'react'

// Keyboard focus for the shell's modal dialogs (help, level sheet, profile
// switcher, PIN gate, parent area, confirm). Without it Tab walked out of a
// dialog into the tiles behind the backdrop, nothing was focused on opening,
// and after closing the focus was lost on <body>.
//
//   const ref = useFocusTrap(open, { onEscape: close })
//   <div ref={ref} role="dialog" aria-modal="true">…</div>
//
// While `active`: the first button inside (or one marked data-autofocus) gets
// the focus, Tab and Shift+Tab cycle inside, Escape calls onEscape. When it
// ends, the focus goes back to where it was — usually the button that opened
// the dialog. Dialogs can stack (a confirm over the parent area): only the
// top one handles keys.

const FOCUSABLE = [
  'button:not([disabled])', 'a[href]', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',')

const stack = []

const focusables = el => [...el.querySelectorAll(FOCUSABLE)].filter(n => n.getClientRects().length > 0)

export function useFocusTrap(active = true, { onEscape } = {}) {
  const ref = useRef(null)
  const escRef = useRef(onEscape)
  escRef.current = onEscape

  useEffect(() => {
    if (!active) return
    const me = {}
    stack.push(me)
    const opener = document.activeElement

    const el = ref.current
    if (el) {
      const first = el.querySelector('[data-autofocus]') ?? focusables(el).find(n => n.tagName === 'BUTTON') ?? focusables(el)[0]
      if (first) first.focus({ preventScroll: true })
      else { el.tabIndex = -1; el.focus({ preventScroll: true }) }
    }

    const onKey = e => {
      if (stack[stack.length - 1] !== me) return
      const box = ref.current
      if (e.key === 'Escape' && escRef.current) {
        e.preventDefault()
        escRef.current()
      } else if (e.key === 'Tab' && box) {
        const list = focusables(box)
        e.preventDefault()
        if (!list.length) return
        const i = list.indexOf(document.activeElement)
        const next = e.shiftKey
          ? list[i <= 0 ? list.length - 1 : i - 1]
          : list[i < 0 || i === list.length - 1 ? 0 : i + 1]
        next.focus()
      }
    }
    window.addEventListener('keydown', onKey)

    return () => {
      window.removeEventListener('keydown', onKey)
      stack.splice(stack.indexOf(me), 1)
      if (opener?.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true })
    }
  }, [active])

  return ref
}
