import { useEffect, useRef, useState } from 'react'
import { lockPreviews, afterNarration, stopNarration, onNarrationChange } from '../../narrator.js'
import { sfx } from '../../sfx.js'
import { result } from '../../lib/score.js'
import { usePaused } from '../../lib/pause.js'

/**
 * The round loop the Buchstaben-Welt games share (Buchstaben-Monster,
 * Versteckspiel, Anlaut-Angeln, Reim-Theater).
 *
 *   • The task is said when a round starts, and again after the help closes.
 *   • `win()` / `reveal()` end the round. Its payoff plays while the praise is
 *     spoken; then `leaving` is true for `outroMs` (the monster walks off,
 *     the curtain closes) and the next round comes by itself.
 *   • Nothing moves on while the game is paused (help or quit dialog open).
 *   • Only a round won without a miss counts as first try (lib/score.js).
 */
export function useRounds(total, { onComplete, sayTask, outroMs = 450, minMs = 1200 }) {
  const paused = usePaused()
  const [idx, setIdx] = useState(0)
  const [done, setDone] = useState(false)      // this round is over
  const [leaving, setLeaving] = useState(false) // its outro is playing
  const [tried, setTried] = useState([])       // this round's misses
  const firstTry = useRef(0)
  const task = useRef(sayTask)
  task.current = sayTask

  useEffect(() => { lockPreviews(); return () => stopNarration() }, [])

  useEffect(() => {
    if (paused || done) return
    const t = setTimeout(() => task.current(), 450)
    return () => clearTimeout(t)
  }, [idx, paused, done])

  useEffect(() => {
    if (!done || paused || leaving) return
    return afterNarration(() => {
      if (idx + 1 >= total) {
        sfx.complete()
        onComplete(result(firstTry.current, total))
        return
      }
      setLeaving(true)
    }, { minMs })
  }, [done, paused, leaving]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => {
      lockPreviews()
      setTried([]); setDone(false); setLeaving(false)
      setIdx(i => i + 1)
    }, outroMs)
    return () => clearTimeout(t)
  }, [leaving, outroMs])

  return {
    idx, done, leaving, tried, paused,
    /** a right answer; counts if nothing was missed before */
    win: () => { if (!tried.length) firstTry.current++; setDone(true) },
    /** a miss; returns how many this round has had */
    miss: key => { setTried(t => [...t, key]); return tried.length + 1 },
    /** the answer was shown after the misses */
    reveal: () => setDone(true),
  }
}

/** True while Lumi's voice is speaking (a character's mouth moves along). */
export function useSpeaking() {
  const [on, setOn] = useState(false)
  useEffect(() => onNarrationChange(setOn), [])
  return on
}

export const shuffle = a => [...a].sort(() => Math.random() - 0.5)

/** A random one of a few: small surprises so round twenty is still fun. */
export const chance = p => Math.random() < p

export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
