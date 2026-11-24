import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { sfx, pluckFreq } from '../../sfx.js'
import { usePaused } from '../../lib/pause.js'

/**
 * The band's conductor: plays a list of things that happen at beats (see
 * tierband/band.js timeline()) in steady time.
 *
 *   const band = useBand({ on: !paused && !speaking, mute: !music.enabled, onStep })
 *   band.play({ events, length, beat: 0.55, loop: true })
 *   band.play({ events, length, beat: 0.36, passes: 2, onEnd })   // twice, then onEnd()
 *   band.stop()
 *
 * The sounds are put on the audio clock a moment ahead (sfx.band with a
 * time), so the rhythm does not depend on how busy the page is; what is
 * seen (`onStep(event, pass)`: the light moves, an animal hops) follows the
 * same clock. Only a fifth of a second is ever laid ahead: stop() or
 * `on: false` silences the band at once, and nothing can pile up.
 *
 * While `on` is false (the help is open, Lumi speaks, the tab is hidden)
 * nothing plays; when it turns true the piece starts again from its first
 * beat. `mute` (the app's music is switched off) keeps the light running
 * without the band's sound. Where no sound can play at all (no audio, or
 * not yet unlocked by a touch) the page's own clock keeps the time, and the
 * band comes in as soon as it can.
 */
const AHEAD = 0.2     // seconds of sound laid on the audio clock ahead of time
const LEAD = 0.18     // a breath before the first beat
const SLEPT = 0.7     // a gap this long between two looks at the clock: the page slept

const pageClock = () => performance.now() / 1000

export function useBand({ on = true, mute = false, onStep }) {
  const S = useRef({ piece: null, raf: 0, on, mute, onStep, audio: false, t0: 0, last: 0, a: 0, v: 0 }).current
  S.onStep = onStep
  S.mute = mute

  const halt = useCallback(() => {
    cancelAnimationFrame(S.raf)
    S.raf = 0
    sfx.bandHush()
  }, [S])

  const start = useCallback(() => {
    cancelAnimationFrame(S.raf)
    S.raf = 0
    if (!S.piece || !S.on) return
    const clock = sfx.bandClock()
    S.audio = clock != null
    const now = S.audio ? clock : pageClock()
    S.t0 = now + LEAD
    S.last = now
    S.a = 0   // the next event to be laid on the audio clock (counted through all passes)
    S.v = 0   // the next event to be shown
    const tick = () => {
      const p = S.piece
      if (!p) return
      const clock = sfx.bandClock()
      // the sound came (the first touch unlocked it) or went: from the top, on the right clock
      if ((clock != null) !== S.audio) { start(); return }
      const now = S.audio ? clock : pageClock()
      if (now - S.last > SLEPT) { sfx.bandHush(); start(); return }
      S.last = now
      const n = p.events.length
      const total = p.loop ? Infinity : n * (p.passes ?? 1)
      const timeOf = i => S.t0 + (Math.floor(i / n) * p.length + p.events[i % n].t) * p.beat
      if (n) {
        while (S.audio && S.a < total && timeOf(S.a) < now + AHEAD) {
          const ev = p.events[S.a % n], when = timeOf(S.a)
          if (ev.inst && !S.mute && when > now - 0.05) sfx.band(ev.inst, when, ev.vol ?? 1, ev.step != null ? pluckFreq(ev.step) : undefined)
          S.a++
        }
        // what is seen comes when the sound is heard
        const seen = now - (S.audio ? sfx.bandLatency() : 0)
        while (S.v < total && timeOf(S.v) <= seen) {
          S.onStep?.(p.events[S.v % n], Math.floor(S.v / n))
          S.v++
          if (S.piece !== p) return   // the step started something else
        }
      }
      if (!p.loop && now >= S.t0 + (p.passes ?? 1) * p.length * p.beat) {
        S.piece = null
        S.raf = 0
        p.onEnd?.()
        return
      }
      S.raf = requestAnimationFrame(tick)
    }
    S.raf = requestAnimationFrame(tick)
  }, [S])

  // on / off: the help dialog, Lumi's voice, a hidden tab
  useLayoutEffect(() => {
    S.on = on
    if (on) start()
    else halt()
  }, [on, S, start, halt])

  // the music switch: what is already on the clock falls silent, too
  useEffect(() => { if (mute) sfx.bandHush() }, [mute])

  useEffect(() => () => { S.piece = null; halt() }, [S, halt])

  const play = useCallback((piece) => {
    sfx.bandHush()
    S.piece = piece
    start()
  }, [S, start])

  const stop = useCallback(() => {
    S.piece = null
    halt()
  }, [S, halt])

  /** One sound right now, outside the piece (an animal that is tapped). */
  const sound = useCallback((inst, n = 1, gap = 0.3, vol = 1) => {
    const clock = sfx.bandClock()
    for (let k = 0; k < n; k++) sfx.band(inst, clock == null ? 0 : clock + 0.01 + k * gap, vol)
  }, [])

  return { play, stop, sound }
}

/** True while this tab can be seen. */
export function useVisible() {
  const [visible, setVisible] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden')
  useEffect(() => {
    const on = () => setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', on)
    return () => document.removeEventListener('visibilitychange', on)
  }, [])
  return visible
}

/**
 * Timers that hold still while the help or the quit question is open, and
 * end with the game: `later(ms, fn)`.
 */
export function useLater() {
  const paused = usePaused()
  const st = useRef({ paused, timers: new Set() })
  st.current.paused = paused
  useEffect(() => {
    const s = st.current
    return () => { s.timers.forEach(clearTimeout); s.timers.clear() }
  }, [])
  return useCallback(function run(ms, fn) {
    const t = setTimeout(() => {
      st.current.timers.delete(t)
      if (st.current.paused) run(250, fn)
      else fn()
    }, ms)
    st.current.timers.add(t)
  }, [])
}

/** The room an element has, in pixels. */
export function useSize(ref) {
  const [size, setSize] = useState(null)
  useLayoutEffect(() => {
    const el = ref.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setSize(s => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}
