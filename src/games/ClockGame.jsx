import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, leaveGame, lockPreviews } from '../narrator.js'
import { LINES, line } from '../lib/lumiLines.js'
import { numberWord } from '../lib/words.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { useBursts, useJuice, HintHand } from '../components/play/index.js'
import { useLater, DoneButton } from './zahlen/stage.jsx'
import {
  planDay, stepFor, handsFor, cardFor, minuteLabels, checksOnRelease, readingOptions,
  sameFace, offHand, callsFor, hourOf, minuteOf, towards, skyFix, DAWN,
} from './lumistag/day.js'
import { ClockFace, CuckooHouse, cuckooCall, HOUSE_W, HOUSE_H } from './lumistag/Clock.jsx'
import View from './lumistag/View.jsx'
import { TaskCard, DayStrip, ReadChoice } from './lumistag/Cards.jsx'

/**
 * Kuckucksuhr — "Lumis Tag": reading and setting the clock, and what the
 * time of day means.
 *
 * Beside a cuckoo clock is a big window onto Lumi's house and garden. The
 * sky in it follows the clock: as the child turns the hands the sun rises,
 * crosses the sky and sets, the moon and the stars come out. Each task is a
 * moment of Lumi's day (breakfast, kindergarten, lunch, the swing, dinner,
 * the bath, bed) on a picture card with its time. The child sets the clock
 * to it. When the time is right the cuckoo bangs its door open and calls as
 * often as the hour says while the numbers on the face light up one by one,
 * and the moment plays in the window. Its picture fills its place in the
 * day strip, which goes from morning to night over the six tasks.
 *
 * The clock never jumps between tasks: the day goes on from the last
 * moment, so turning forward is turning the day on, and whether seven is
 * morning or evening is plain from the sky and the strip.
 *
 *   • Levels 1–2: whole hours; the card shows a small clock to copy. Only
 *     the short hand turns (the long one stays on the 12), and letting go
 *     of it is the answer.
 *   • Levels 3–4: whole hours; the card shows the hour as a big blue number.
 *   • Levels 5–6: half hours; both hands turn, the long one takes the short
 *     one along. The card shows the small clock (5), then the digital
 *     time (6). The green tick says "look now".
 *   • Levels 7–8: quarter hours, digital.
 *   • Levels 9–10: five minutes, digital; two of the six tasks are reading
 *     rounds: the clock runs to a time and the child picks it from three.
 *
 * A miss: the cuckoo pops out at the wrong time, cries sourly and drops
 * back, and the hand that is off pulses. After a second miss the right
 * hands show faintly on the face and a hand shows the move. The result
 * counts the moments set right at the first try.
 *
 * Game feel from components/play/Juice.jsx: every moment set is a hit (a
 * note that climbs with the streak, a star to the counter in the window),
 * a miss ends the streak.
 */

// Lines Lumi may get later; until they are recorded the game is silent there
const optional = key => (LINES[key] ? line(key) : null)
const SAY = {
  set: 'lumistag/stell-die-uhr',      // "Stell die Uhr wie auf der Karte."
  tick: 'lumistag/haken',             // "Stell die Uhr. Dann drück auf den Haken."
  read: 'lumistag/welche-zeit',       // "Wie spät ist es? Tippe auf die Uhrzeit."
}
// "Sieben Uhr." — or the number alone while that is not recorded
const hourWord = h => optional(`lumistag/uhr-${h}`) ?? numberWord(h)

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// Where everything goes, for the room the game has
function layoutFor(w, h) {
  if (w > h * 1.1) {
    const pad = 10, gap = 12
    const face = Math.min(400, Math.min(w * 0.5, (h - 2 * pad) / HOUSE_H * HOUSE_W) / HOUSE_W)
    const colW = w - 2 * pad - gap - face * HOUSE_W
    const colH = h - 2 * pad
    const slot = Math.floor(Math.min((colW - 30) / 6, 80, colH * 0.17))
    const cardH = Math.round(clamp(colH * 0.22, 70, 128))
    const panelH = Math.floor(Math.min(colH - slot - 12 - cardH - 2 * gap, colW / 1.45))
    const panelW = Math.floor(Math.min(colW, panelH * 3.2))
    return { wide: true, pad, gap, face, colW, slot, cardH, panelW, panelH }
  }
  const pad = 8, gap = 8
  const slot = Math.floor(Math.min((w - 2 * pad - 30) / 6, 72, h * 0.09))
  const cardH = Math.round(clamp(h * 0.13, 76, 112))
  const panelH = Math.floor(clamp(h * 0.24, 110, (w - 2 * pad) / 1.55))
  const avail = h - 2 * pad - 3 * gap - slot - 12 - cardH - panelH
  const face = Math.max(120, Math.min(400, avail / HOUSE_H, (w - 2 * pad) / HOUSE_W))
  const panelW = Math.floor(Math.min(w - 2 * pad, panelH * 3.2))
  return { wide: false, pad, gap, face, colW: w - 2 * pad, slot, cardH, panelW, panelH }
}

export default function ClockGame({ level = 1, onComplete }) {
  const [tasks] = useState(() => planDay(level))
  const step = stepFor(level)
  const hands = handsFor(level)
  const kind = cardFor(level)
  const onRelease = checksOnRelease(level)
  const reduce = useReducedMotion()
  const { later, afterSpeech, paused } = useLater()
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const juice = useJuice({ hudSize: 30 })
  const { hit, miss } = juice
  const [bursts, burst] = useBursts()

  // the room
  const rootRef = useRef(null)
  const [box, setBox] = useState(null)
  useLayoutEffect(() => {
    const el = rootRef.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setBox(b => (b && b.w === w && b.h === h ? b : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState('play')     // play · run (the clock runs to a time) · cheer · oops · finale
  const [day, setDay] = useState(DAWN)           // the hands: day minutes, never wrapped
  const [shift, setShift] = useState(0)          // the sky is at day + shift (half a day off when turned round)
  const [misses, setMisses] = useState(0)
  const [pulse, setPulse] = useState(null)
  const [moved, setMoved] = useState(false)
  const [bird, setBird] = useState('in')
  const [call, setCall] = useState(0)
  const [lit, setLit] = useState(0)
  const [scene, setScene] = useState({ id: 'wake', n: 0 })
  const [done, setDone] = useState(0)
  const [tried, setTried] = useState([])
  const [picked, setPicked] = useState(null)
  const [hop, setHop] = useState(-1)
  const firstTry = useRef(0)
  const finished = useRef(false)
  const dayRef = useRef(day)
  dayRef.current = day
  const phaseRef = useRef(phase)
  phaseRef.current = phase
  // the ref at once, so a second touch in the same moment sees it
  const go = p => { phaseRef.current = p; setPhase(p) }

  const houseRef = useRef(null), viewRef = useRef(null), tickRef = useRef(null), stripRefs = useRef([])
  const handFrom = useRef(null), handTo = useRef(null), rightRef = useRef(null)

  const task = tasks[idx]
  const reading = task.read
  const options = useMemo(() => (reading ? readingOptions(task.time, step) : []), [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => leaveGame, [])

  // The clock runs on by itself to a time (a reading round): the hands
  // whirl, the sky goes along, a soft tick now and then
  const raf = useRef(0)
  const runTo = useCallback((to, then) => {
    cancelAnimationFrame(raf.current)
    const from = dayRef.current
    if (reduce || from === to) { setDay(to); then(); return }
    const ms = clamp(Math.abs(to - from) * 6, 700, 1800)
    let t0 = null, last = from, acc = 0
    const tick = now => {
      if (pausedRef.current) { t0 = null; raf.current = requestAnimationFrame(tick); return }
      if (t0 == null) t0 = now - (acc * ms)
      const k = Math.min(1, (now - t0) / ms)
      acc = k
      const e = k < 0.5 ? 2 * k * k : 1 - (2 - 2 * k) ** 2 / 2
      const v = Math.round(from + (to - from) * e)
      if (Math.floor(v / 30) !== Math.floor(last / 30)) sfx.step()
      last = v
      setDay(v)
      if (k < 1) raf.current = requestAnimationFrame(tick)
      else then()
    }
    raf.current = requestAnimationFrame(tick)
  }, [reduce])
  useEffect(() => () => cancelAnimationFrame(raf.current), [])

  // A new moment: its card, and for a reading round the clock runs there
  useLayoutEffect(() => {
    setMisses(0); setPulse(null); setMoved(false); setTried([]); setPicked(null)
    lockPreviews()
    sayTask()
    const first = idx === 0 || (reading && !tasks.slice(0, idx).some(t => t.read))
    if (reading) {
      go('run')
      const target = dayRef.current + towards(dayRef.current + shift, task.time)
      later(500, () => runTo(target, () => {
        go('play')
        if (first) narrate([optional(SAY.read)])
      }))
      return
    }
    go('play')
    const parts = []
    if (idx === 0) parts.push(optional(hands === 'hour' ? SAY.set : SAY.tick))
    if (kind === 'number') parts.push(hourWord(hourOf(task.time)))
    if (parts.some(Boolean)) afterSpeech(() => narrate(parts), 300)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── The end of the level ─────────────────────────────────────────────────
  const finale = useCallback(() => {
    go('finale')
    sfx.tada()
    burst(viewRef.current, 'confetti', 22)
    // the day strip, one picture after the other, a little tune going up
    tasks.forEach((_, i) => later(500 + i * 260, () => { setHop(i); sfx.note(i * 2) }))
    later(500 + tasks.length * 260 + 300, () => setHop(-1))
    later(500 + tasks.length * 260 + 1400, () => {
      if (finished.current) return
      finished.current = true
      onComplete(result(firstTry.current, tasks.length))
    })
  }, [tasks, later, burst, onComplete])

  // ── Right ────────────────────────────────────────────────────────────────
  const right = useCallback(at => {
    go('cheer')
    setPulse(null)
    const clean = misses === 0
    if (clean) firstTry.current += 1
    const { milestone } = hit(at ?? houseRef.current)
    // the sky is the moment's time of day, even if the hands went round
    setShift(s => s + skyFix(dayRef.current + s, task.time))
    // the door bangs open, the cuckoo calls, the numbers light up
    const full = minuteOf(task.time) === 0
    const n = callsFor(task.time)
    const gap = clamp(2000 / n, 190, 420)
    sfx.bump()
    setBird('out')
    for (let k = 1; k <= n; k++) {
      later(320 + (k - 1) * gap, () => { setCall(k); if (full) setLit(k); cuckooCall() })
    }
    // meanwhile Lumi does it in the window
    later(260, () => {
      setScene({ id: task.moment, n: idx + 1 })
      if (task.moment === 'spielplatz') sfx.whoosh()
      else if (task.moment === 'baden') sfx.splash()
      else if (task.moment === 'kindergarten') sfx.giggle()
      else if (task.moment !== 'schlafen') { sfx.chomp(); later(420, () => sfx.chomp()) }
    })
    if (milestone) later(500, () => burst(viewRef.current, 'confetti', 14))
    const end = 320 + n * gap + 350
    later(end, () => {
      setBird('in'); sfx.bump()
      setLit(0); setCall(0)
      // its picture takes its place in the day
      setDone(idx + 1)
      sfx.pop()
      const lead = full && kind !== 'number' ? [hourWord(hourOf(task.time))] : []
      sayRight(undefined, { lead })
      afterSpeech(() => {
        if (idx + 1 >= tasks.length) finale()
        else setIdx(idx + 1)
      }, task.moment === 'schlafen' ? 900 : 1300)
    })
  }, [misses, hit, task, idx, tasks.length, kind, later, afterSpeech, burst, finale])

  // ── Wrong ────────────────────────────────────────────────────────────────
  const oops = useCallback((at, off) => {
    go('oops')
    setMisses(m => m + 1)
    miss(at ?? houseRef.current)
    sayWrong()
    // the cuckoo pops out — not yet! — cries and drops back in
    setBird('flop')
    cuckooCall(true)
    if (off) setPulse(off)
    later(reduce ? 400 : 850, () => { setBird('in'); sfx.bump(); go('play') })
  }, [miss, later, reduce])

  const check = useCallback(() => {
    if (phaseRef.current !== 'play') return
    if (sameFace(dayRef.current, task.time)) right(houseRef.current)
    else oops(houseRef.current, offHand(dayRef.current, task.time))
  }, [task, right, oops])

  // ── The hands ────────────────────────────────────────────────────────────
  const canTurn = phase === 'play' && !reading
  const onTurn = useCallback(delta => {
    if (phaseRef.current !== 'play') return
    dayRef.current += delta
    setDay(d => d + delta)
    setMoved(true)
    setPulse(null)
    sfx.step()
  }, [])
  const onLetGo = useCallback(movedNow => {
    if (onRelease && movedNow) check()
  }, [onRelease, check])

  // ── A reading round ──────────────────────────────────────────────────────
  const pick = (opt, i, e) => {
    if (phase !== 'play' || tried.includes(i)) return
    setPicked(i)
    if (sameFace(opt, task.time)) right(e.currentTarget)
    else { setTried(t => [...t, i]); oops(e.currentTarget, null) }
  }

  // ── Layout ───────────────────────────────────────────────────────────────
  const L = box && layoutFor(box.w, box.h)
  const helpOn = misses >= 2
  const ghost = helpOn && !reading && phase === 'play' ? task.time : null
  // which hand the hint hand turns: with both off, the short one first (to the
  // hour, the minutes kept), then the long one
  const handToMove = hands === 'hour' || offHand(day, task.time) !== 'minute' ? 'hour' : 'minute'
  const hintTarget = handToMove === 'hour' ? (hourOf(task.time) % 12) * 60 + minuteOf(day) : task.time

  const clock = L && (
    <CuckooHouse size={L.face} bird={bird} call={call} paused={paused} reduce={reduce} houseRef={houseRef}>
      <ClockFace day={day} hands={canTurn ? hands : null} step={step} onTurn={onTurn} onLetGo={onLetGo}
        lit={lit} pulse={phase === 'play' || phase === 'oops' ? pulse : null} ghost={ghost} labels={minuteLabels(level)}
        size={L.face} reduce={reduce}
        anchors={{ from: handFrom, to: handTo, hand: handToMove, target: hintTarget }} />
    </CuckooHouse>
  )

  // a reading round: the picture and three times side by side, as wide as there is room
  const readCardH = L ? Math.min(L.cardH, L.wide ? 96 : 76) : 0
  const choiceGap = L?.wide ? 10 : 6
  const choiceW = L ? Math.floor(Math.min(130, (L.colW - readCardH * 0.92 - 6 - (L.wide ? 14 : 8) - 2 * choiceGap) / 3)) : 0
  const choiceH = L ? Math.max(64, Math.min(L.cardH * 0.8, 84)) : 0
  const cardRow = L && (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: L.wide ? 14 : 8, flexShrink: 0, width: '100%', minHeight: L.cardH }}>
      {phase !== 'finale' && <TaskCard key={idx} task={task} kind={kind} height={reading ? readCardH : L.cardH} reading={reading} reduce={reduce} />}
      {reading && (
        <div style={{ display: 'flex', gap: choiceGap }}>
          {options.map((o, i) => {
            const isRight = sameFace(o, task.time)
            return (
              <span key={`${idx}-${o}`} ref={isRight ? rightRef : undefined} style={{ display: 'flex' }}>
                <ReadChoice time={o} height={choiceH} width={choiceW} reduce={reduce}
                  state={tried.includes(i) ? 'tried' : picked === i && phase === 'cheer' ? 'right' : null}
                  glow={helpOn && isRight && phase === 'play'}
                  onPick={e => pick(o, i, e)} />
              </span>
            )
          })}
        </div>
      )}
      {!reading && hands === 'both' && phase !== 'finale' && (
        <span ref={tickRef} style={{ display: 'flex' }}>
          <DoneButton onClick={check} disabled={!moved || phase !== 'play'} size={Math.min(84, Math.max(66, L.cardH * 0.8))} />
        </span>
      )}
    </div>
  )

  const view = L && (
    <div ref={viewRef} style={{ display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
      <View skyDay={day + shift} scene={scene} width={L.panelW} height={L.panelH} reduce={reduce}
        lightsOff={scene.id === 'wake' || scene.id === 'schlafen'} hud={juice.hud} />
    </div>
  )
  const strip = L && (
    <DayStrip tasks={tasks} done={done} current={phase === 'finale' ? -1 : idx} slot={L.slot} slotRefs={stripRefs} reduce={reduce} hop={hop} />
  )

  return (
    <div ref={rootRef} style={{
      flex: 1, minHeight: 0, width: '100%', position: 'relative', overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none',
      // Lumi's room: the clock hangs on the wallpaper, the window beside it
      background: 'linear-gradient(180deg, transparent 88%, #C98A52 88%), repeating-linear-gradient(90deg, #FFE8C4 0 30px, #FFDCAE 30px 44px)',
    }}>
      {L && (
        <div ref={juice.stage} style={{
          position: 'absolute', inset: 0, padding: L.pad, boxSizing: 'border-box',
          display: 'flex', flexDirection: L.wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: L.gap,
        }}>
          {L.wide ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{clock}</div>
              <div style={{ width: L.colW, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: L.gap }}>
                {view}{cardRow}{strip}
              </div>
            </>
          ) : (
            <>{view}{cardRow}<div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{clock}</div>{strip}</>
          )}
        </div>
      )}

      {/* the hand shows the move: the first time, and after two misses */}
      <HintHand key={`set${idx}-${handToMove}`} from={handFrom} to={handTo}
        active={canTurn && (helpOn || (idx === 0 && (level <= 2 || level === 5) && !moved))} delay={helpOn ? 600 : 5000} repeat={2} />
      <HintHand key={`tick${idx}`} to={tickRef} active={canTurn && hands === 'both' && moved && !helpOn} delay={7000} />
      <HintHand key={`read${idx}`} to={rightRef} active={reading && phase === 'play' && helpOn} delay={400} />
      {bursts}
      {juice.layer}
    </div>
  )
}
