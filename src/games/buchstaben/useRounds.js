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
 *   • `win(holdMs)` / `reveal(holdMs)` end the round. Its payoff plays for at
 *     least `holdMs` (and until Lumi has finished speaking); then `leaving`
 *     is true for `outroMs` (the monster walks off, the curtain closes) and
 *     the next round comes by itself. Most sentences have no recording yet,
 *     so the hold — not the speech — is what lets the child see the result.
 *   • After the last round `finale` is true for `finaleMs`: the game's own
 *     little party before the results screen.
 *   • Nothing moves on while the game is paused (help or quit dialog open).
 *   • Only a round won without a miss counts as first try (lib/score.js);
 *     `streak` counts those in a row, for a payoff that grows.
 */
export function useRounds(total, { onComplete, sayTask, outroMs = 450, finaleMs = 1800 }) {
  const paused = usePaused()
  const [idx, setIdx] = useState(0)
  const [hold, setHold] = useState(0)          // > 0: this round is over, show its payoff this long
  const [leaving, setLeaving] = useState(false) // its outro is playing
  const [finale, setFinale] = useState(false)
  const [tried, setTried] = useState([])       // this round's misses
  const [streak, setStreak] = useState(0)
  const firstTry = useRef(0)
  const task = useRef(sayTask)
  task.current = sayTask
  const done = hold > 0

  useEffect(() => { lockPreviews(); return () => stopNarration() }, [])

  useEffect(() => {
    if (paused || done) return
    const t = setTimeout(() => task.current(), 450)
    return () => clearTimeout(t)
  }, [idx, paused, done])

  useEffect(() => {
    if (!done || paused || leaving || finale) return
    return afterNarration(() => {
      if (idx + 1 >= total) setFinale(true)
      else setLeaving(true)
    }, { minMs: hold, maxMs: hold + 9000 })
  }, [done, paused, leaving, finale]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => {
      lockPreviews()
      setTried([]); setHold(0); setLeaving(false)
      setIdx(i => i + 1)
    }, outroMs)
    return () => clearTimeout(t)
  }, [leaving, outroMs])

  useEffect(() => {
    if (!finale || paused) return
    sfx.tada()
    const t = setTimeout(() => { sfx.complete(); onComplete(result(firstTry.current, total)) }, finaleMs)
    return () => clearTimeout(t)
  }, [finale, paused]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    idx, done, leaving, finale, tried, paused, streak,
    /** a right answer; counts if nothing was missed before */
    win: (holdMs = 1500) => {
      if (!tried.length) { firstTry.current++; setStreak(s => s + 1) }
      setHold(holdMs)
    },
    /** a miss; returns how many this round has had */
    miss: key => { setStreak(0); setTried(t => [...t, key]); return tried.length + 1 },
    /** the answer was shown after the misses */
    reveal: (holdMs = 2500) => setHold(holdMs),
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

/** How long the hint hand waits: soon on a level's first task, later after that. */
export const hintDelay = idx => (idx === 0 ? 2000 : 6000)
