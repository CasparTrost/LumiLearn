/**
 * Pause while the help dialog is open.
 *
 * Opening "?" in Blasen-Blitz let the bubbles keep rising — they were even
 * drawn on top of the dialog. GameScreen provides `paused`; games with a
 * clock (timers, falling letters, the dragon) read it with usePaused() and
 * hold still.
 */
import { createContext, useContext } from 'react'

export const PauseContext = createContext(false)
export const usePaused = () => useContext(PauseContext)
