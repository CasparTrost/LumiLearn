import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, motionValue } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { Art, RoundTrail, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { useRounds, reduceMotion, hintDelay } from './buchstaben/useRounds.js'
import { rec } from './buchstaben/voice.js'
import { buildRounds, sceneOf, wordVoice, groupOf } from './buchstaben/rhymes.js'
import { pxButton, INK } from './px.js'

/**
 * Reim-Theater — hören, was sich reimt (module `rhyme`)
 *
 * A little theatre. On the stage stands a figure (the mouse) and waits for
 * its rhyme partner. Candidates drift over the stage on balloons; the child
 * shoots: a tap pops the balloon and the thing drops onto the stage. The
 * right one lands next to the figure and the two play a nonsense scene that
 * shows what its line says ("Die Maus im Haus!": the mouse looks out of the
 * house's window); a wrong one bounces off the boards and floats away on a
 * new balloon. Right pops in a row light the footlights one by one; with
 * all five lit comes a shower of rhyming balloons to pop for fun. The
 * audience below claps for a rhyme and laughs at the scene.
 *
 *   Levels 1–3   pop the rhyme (2, 3, 4 balloons; they drift faster)
 *   Level 4      Ja/Nein quick-fire: two swing in on a trapeze — the green or
 *                the red buzzer. Rhyming pairs hug and say their line; the
 *                others shrug, turn their backs and swing apart.
 *   Levels 5, 7  three on the stage: tap the one that does not rhyme, the
 *                hook yanks it off
 *   Level 6      five balloons, one sounds almost like it
 *   Levels 8–10  finish the verse Lumi starts, by popping its last word
 *
 * Rhyme awareness is among the best-established predictors of later reading
 * (Bradley & Bryant, 1983; Goswami): hearing that Maus and Haus share an
 * ending precedes phoneme-level analysis. Everything is picture-based and
 * every word a round depends on is spoken (buchstaben/rhymes.js), so it
 * measures the sound and not the spelling. The levels step from recognising
 * a rhyme to judging one, spotting the odd one out and completing a rhyme in
 * a little verse — the usual order in which children master rhyme.
 */

const BALLOONS = ['#ff6b5b', '#4aa3ff', '#ffc93c', '#5cc45a', '#c77dff']
const LAMPS = 5
const FRAME = 4            // the theatre's frame, px
// how long things take, ms
const DROP_MS = 620       // a popped thing falls onto the stage
const SCENE_MS = 3600     // the pair's scene, until the curtain closes
const YANK_MS = 1000      // the hook pulls the odd one off
const BONUS_MS = 7600     // the balloon shower
const GLOW_MS = 900       // after two misses: the right balloon glows, then pops by itself

const PURPLE = '#4a2457'
const GOLD = '#ffc93c'
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))

// What a round says: the words, and on the first round the question.
function taskOf(r, first) {
  const ask = key => first && rec(key)
  const gap = p => p && { ...p, gap: 300 }
  if (r.mode === 'yesno') return [wordVoice(r.base.w), gap(wordVoice(r.other.w)), ask('reim/reimt-sich-das')]
  if (r.mode === 'odd')   return [...r.options.map((o, i) => (i ? gap(wordVoice(o.w)) : wordVoice(o.w))), ask('reim/welches-nicht')]
  if (r.mode === 'verse') return [rec(`reim/vers-${r.verse.slug}`)]
  return [wordVoice(r.base.w), ask('reim/was-reimt')]
}

/** Hover or keyboard focus reads the word (mouse only; a tap is the answer). */
const hearIt = (w, enabled = true) => {
  const v = wordVoice(w)
  return v ? hearable(v.text, { src: v.src, enabled }) : {}
}

/**
 * Where everything goes in a theatre of w × h px. Tall enough: the audience
 * sits in a row below the stage. Short (a phone held sideways): it sits in
 * the two front corners, and the balloon cards lose their names.
 */
export function stageLayout(w, h, { verse = false, n = 0, balloons = true } = {}) {
  const row = h >= 380
  const W = w, H = h
  const valH = row ? clamp(H * 0.07, 28, 40) + (verse ? 16 : 0) : clamp(H * 0.1, 26, 34) + (verse ? 8 : 0)
  const audH = row ? clamp(H * 0.12, 46, 74) : 0
  const open = { left: W * 0.08, right: W * 0.92 }
  // Short: four heads in each front corner, between the open curtain and the
  // footlights, so nobody sits on the curtain or on a lamp.
  const lampHalf = ((LAMPS - 1) / 2) * clamp(W * 0.07, 24, 70) + (row ? 14 : 12)
  const corner = W / 2 - lampHalf - 8 - (open.left + 6)
  const head = row ? audH * 0.74 : clamp(Math.min(H * 0.17, corner / 4.08), 22, 46)
  const labelH = row ? 24 : 20
  const lampH = row ? 14 : 12
  const floorH = labelH + lampH + 8
  const floorBottom = H - audH
  const floorTop = floorBottom - floorH
  // the figures leave room above them for the balloons; without balloons
  // (Ja/Nein, odd one out) they take the stage
  const S = clamp(Math.min((H - valH - audH - floorH) * (!balloons ? 0.62 : row ? 0.4 : 0.42), W * 0.3), 56, 170)
  const flyTop = valH + 6, flyBottom = floorTop - S - 6
  const flyH = Math.max(0, flyBottom - flyTop)
  const nameH = row ? 22 : 0
  const itemH = c => c * 1.42 + nameH
  const laneW = open.right - open.left - 16
  // as many lanes as make the balloons biggest (more lanes when it is a tie: more to watch)
  const cwFor = L => {
    const k = Math.max(1, Math.ceil(n / L))
    return Math.min(clamp(Math.min(H * 0.17, W * 0.22), 64, 116), ((flyH - (L - 1) * 8) / L - nameH) / 1.42, (laneW - (k - 1) * 12) / k)
  }
  let L = 1
  for (let l = 2; l <= Math.min(n, 3); l++) if (cwFor(l) >= cwFor(L) - 2) L = l
  const k = Math.max(1, Math.ceil(n / L))
  const cw = Math.max(56, cwFor(L))
  return { W, H, row, valH, audH, head, labelH, lampH, floorH, floorTop, floorBottom, feetY: floorTop + 2, S, open, flyTop, flyBottom, flyH, cw, cardH: itemH(cw), nameH, lanes: L, perLane: k, laneW, cx: W / 2 }
}

/** The balloons' resting places: lanes over the stage, one shared sway per lane. */
function balloonSpots(lay, items) {
  const { lanes: L, laneW, open, cw, cardH, flyTop, flyH } = lay
  return items.map((item, i) => {
    const lane = i % L, slot = Math.floor(i / L)
    const inLane = items.filter((_, j) => j % L === lane).length
    const sp = laneW / inLane
    const x = open.left + 8 + sp * (slot + 0.5) - cw / 2
    const y = flyTop + (L === 1 ? Math.max(0, flyH - cardH) / 2 : lane * Math.max(0, flyH - cardH) / (L - 1))
    return { x, y, lane, amp: Math.max(0, (sp - cw) / 2 - 6), bob: clamp((flyH - L * cardH) / (2 * L), 3, 14) }
  })
}

export default function RhymeGame({ level = 1, onComplete }) {
  const rounds = useMemo(() => buildRounds(level), [level])
  const [bursts, burst] = useBursts()
  const juice = useJuice({ hudSize: 30 })
  const { hit: juiceHit, miss: juiceMiss } = juice
  const idxRef = useRef(0)

  const sayTask = useCallback(() => {
    const i = idxRef.current, r = rounds[i]
    if (r) narrate(taskOf(r, i === 0))
  }, [rounds])
  const { idx, done, leaving, finale, paused, win, miss, reveal, isOver, hasTried, tried } =
    useRounds(rounds.length, { onComplete, sayTask, outroMs: 650, finaleMs: 2400 })
  idxRef.current = idx
  const r = rounds[Math.min(idx, rounds.length - 1)]

  // ── real pixels ──
  // The game screen scales every game to a box of at least 720 × 680 (FitBox);
  // on a phone held sideways that shrinks it to 0.6, and the stage, the
  // balloons and the speaker came out tiny (the stage cut off below). This
  // game lays itself out for the room it really has, so it undoes the scale:
  // inside, one px is one px on the screen.
  const outerRef = useRef(null)
  const [fit, setFit] = useState({ k: 1, w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = outerRef.current
    if (!el) return
    const measure = () => {
      const r = el.getBoundingClientRect()
      const k = el.clientWidth ? r.width / el.clientWidth : 1
      setFit(f => (Math.abs(f.k - k) < 0.001 && Math.abs(f.w - r.width) < 0.5 && Math.abs(f.h - r.height) < 0.5 ? f : { k, w: r.width, h: r.height }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // ── the room the theatre has ──
  const regionRef = useRef(null)
  const [room, setRoom] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = regionRef.current
    if (!el) return
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  // Ja/Nein: the buzzers beside the theatre on a wide, low screen, below it otherwise
  const yesno = r?.mode === 'yesno'
  const sideBuzzers = yesno && room.w > room.h * 1.6
  const bz = yesno ? (sideBuzzers ? clamp(room.h * 0.34, 72, 110) : clamp(Math.min(room.w * 0.22, room.h * 0.15), 76, 110)) : 0
  const tw = Math.min(980, room.w - (sideBuzzers ? 2 * (bz + 16) : 0))
  const th = Math.min(room.h - (yesno && !sideBuzzers ? bz + 14 : 0), Math.max(300, tw * 1.9))
  // the layout is for the inside of the frame: laid out for the outer box,
  // the frame cut the footlights and the front row off at the bottom
  const lay = useMemo(() => stageLayout(Math.max(0, tw - 2 * FRAME), Math.max(0, th - 2 * FRAME), { verse: r.mode === 'verse', n: r.options?.length ?? 0, balloons: r.mode === 'pick' || r.mode === 'verse' }), [tw, th, r])

  // ── state of the round ──
  const [popped, setPopped] = useState([])     // balloons popped this round
  const [fallers, setFallers] = useState([])   // things dropping onto the stage
  const [play, setPlay] = useState(null)       // { i, kind: 'scene'|'hug'|'apart', … }
  const [nope, setNope] = useState(0)          // the figure shakes its head
  const [glow, setGlow] = useState(null)       // the right balloon, glowing before it pops by itself
  const [pulse, setPulse] = useState(null)     // the right buzzer, after a wrong one
  const [lamps, setLamps] = useState(0)
  const [bonus, setBonus] = useState(null)     // { i, words }
  const [crowd, setCrowd] = useState({ kind: null, n: 0 })
  const [won, setWon] = useState(0)            // audience members won for good
  const [demoStep, setDemoStep] = useState(0)  // odd one out, first round: 0 stands, 1 tapped, 2 yanked, 3 over
  const timers = useRef([])
  const later = useCallback((ms, fn) => { timers.current.push(setTimeout(fn, ms)) }, [])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  useEffect(() => { setPopped([]); setFallers([]); setNope(0); setGlow(null); setPulse(null) }, [idx])

  const scene = play?.i === idx ? play : null
  const optionAt = useBalloonPositions(lay, r, idx, paused || done)
  // the audience reacts for a moment, then sits down again
  const cheerCrowd = useCallback(kind => {
    setCrowd(c => ({ kind, n: c.n + 1 }))
    later(kind === 'cheer' ? 2600 : 1700, () => setCrowd(c => (c.kind === kind ? { ...c, kind: null } : c)))
  }, [later])
  const demo = r?.mode === 'odd' && idx === 0 && demoStep < 3
  useEffect(() => {
    if (!demo || paused) return
    const t = setTimeout(() => {
      if (demoStep === 1) sfx.whoosh()
      setDemoStep(d => d + 1)
    }, [1100, 1300, 900][demoStep])
    return () => clearTimeout(t)
  }, [demo, demoStep, paused])
  useEffect(() => {
    if (!finale) return
    sfx.giggle()
    cheerCrowd('cheer')
    burst(regionRef.current, 'confetti', 24)
  }, [finale, burst, cheerCrowd])

  // A right one: a star, a lamp, and with the fifth lamp the shower comes
  // after the scene (the round's payoff is held that much longer)
  const scored = (at) => {
    juiceHit(at)
    setWon(n => n + 1)
    const full = lamps + 1 >= LAMPS
    setLamps(full ? LAMPS : lamps + 1)
    return full
  }
  const missed = (at) => { juiceMiss(at); setLamps(0) }
  const startBonus = (words, delay) => later(delay, () => {
    setBonus({ i: idx, words })
    sfx.tada()
    // "Ballonregen! Lass sie platzen!" — silent until it is recorded
    narrate([rec('reim/ballonregen')])
  })
  const endBonus = () => { setBonus(null); setLamps(0); cheerCrowd('cheer') }

  // The pair's scene: line on the valance, the line said after the praise
  const perform = (pair, from) => {
    const [a, b] = pair
    const sc = r.mode === 'verse' ? { ...r.verse, line: r.verse.line.replace(' …', ` ${r.verse.answer}!`), key: `reim/vers-${r.verse.slug}-ganz` } : sceneOf(a.w, b.w)
    const mover = sc.mover === a.w ? a : b
    const seat = mover === a ? b : a
    // the names in the order of the line
    const first = r.mode === 'verse' ? r.base.w : sc.first
    const names = first === a.w ? [a, b] : [b, a]
    setPlay({ i: idx, kind: 'scene', mover, seat, place: sc.place, line: sc.line, from, names })
    cheerCrowd('laugh')
    sfx.slideUp()
    burst(regionRef.current, 'confetti', 12)
    return sc.key
  }

  // ── pick and verse: pop a balloon ──
  const pop = (opt, el) => {
    if (isOver() || hasTried(opt) || popped.includes(opt) || demo) return
    const pos = optionAt.current(opt)
    sfx.pop()
    burst(el, 'confetti', 6)
    setPopped(p => [...p, opt])
    const from = { x: pos.x + lay.cw / 2, y: pos.y + lay.cw * 0.62 + lay.cw * 0.36 }
    if (opt === r.correct) {
      const full = scored(el)
      cheerCrowd('clap')
      win(DROP_MS + SCENE_MS + (full ? BONUS_MS : 0))
      dropRight(opt, from, 0, full)
      return
    }
    missed(el)
    sayWrong()
    dropWrong(opt, from)
    if (miss(opt) >= 2) {
      reveal(1200 + GLOW_MS + DROP_MS + SCENE_MS)
      later(1200, () => setGlow(r.correct))
      later(1200 + GLOW_MS, () => {
        const p = optionAt.current(r.correct)
        sfx.pop()
        setPopped(list => [...list, r.correct])
        setGlow(null)
        dropRight(r.correct, { x: p.x + lay.cw / 2, y: p.y + lay.cw }, 0, false)
      })
    }
  }
  const baseX = lay.cx - lay.S * 0.62, slotX = lay.cx + lay.S * 0.62
  const dropRight = (opt, from, delay, full) => {
    setFallers(f => [...f, { id: `${idx}-${opt.w}`, item: opt, from, to: { x: slotX, y: lay.feetY - lay.S / 2 }, right: true }])
    later(DROP_MS, () => {
      sfx.boing()
      setFallers(f => f.filter(x => x.item !== opt))
      const key = perform([r.base, opt], { [r.base.w]: baseX, [opt.w]: slotX })
      sayRight(null, { lead: [rec(key)] })
      if (full) startBonus(groupOf(r.base.w).words.filter(x => wordVoice(x.w)), SCENE_MS)
    })
  }
  const dropWrong = (opt, from) => {
    // it lands where no one stands
    const near = Math.abs(from.x - baseX) < lay.S * 0.9 || Math.abs(from.x - slotX) < lay.S * 0.9
    const edge = lay.S * 0.6
    const side = from.x < lay.cx ? lay.open.left + edge : lay.open.right - edge
    const landX = near ? side : clamp(from.x, lay.open.left + edge, lay.open.right - edge)
    const color = BALLOONS[r.options.indexOf(opt) % BALLOONS.length]
    setFallers(f => [...f, { id: `${idx}-${opt.w}`, item: opt, from, to: { x: landX, y: lay.feetY - lay.S * 0.35 }, color }])  // to.y: its middle on the boards
    later(600, () => { sfx.boing(); setNope(n => n + 1) })
    later(1650, () => sfx.whoosh())
    later(3100, () => setFallers(f => f.filter(x => x.item !== opt)))
  }

  // ── odd one out: tap the one that has to leave ──
  const S3 = Math.min(lay.S * 0.9, (lay.open.right - lay.open.left) / 3.5)
  const oddX = i => lay.cx + (i - 1) * S3 * 1.15
  const shoo = (opt, el) => {
    if (isOver() || hasTried(opt) || demo) return
    if (opt === r.correct) {
      const full = scored(el)
      cheerCrowd('clap')
      win(YANK_MS + SCENE_MS + (full ? BONUS_MS : 0))
      yank(opt, full)
      return
    }
    missed(el)
    sfx.boing()
    sayWrong()
    if (miss(opt) >= 2) {
      reveal(1400 + YANK_MS + SCENE_MS)
      later(1400, () => yank(r.correct, false))
    }
  }
  const yank = (odd, full) => {
    sfx.whoosh()
    setPlay({ i: idx, kind: 'yank', gone: odd })
    const stay = r.options.filter(o => o !== odd)
    later(YANK_MS, () => {
      const key = perform(stay, Object.fromEntries(stay.map(o => [o.w, oddX(r.options.indexOf(o))])))
      sayRight(null, { lead: [rec(key)] })
      if (full) startBonus(groupOf(r.base.w).words.filter(x => wordVoice(x.w)), SCENE_MS)
    })
  }

  // ── Ja / Nein: one buzz, then the answer shows itself ──
  const buzz = (yes, el) => {
    if (isOver()) return
    const right = yes === r.rhymes
    sfx.drum(true)
    const hold = r.rhymes ? 3200 : 2000
    if (right) {
      const full = scored(el)
      cheerCrowd('clap')
      win(hold + (full ? BONUS_MS : 0))
      if (full) startBonus(groupOf(r.base.w).words.filter(x => wordVoice(x.w)), hold - 400)
    } else {
      missed(el)
      miss(yes)
      reveal(hold + 700)
      setPulse(r.rhymes)
    }
    later(right ? 0 : 700, () => {
      if (r.rhymes) {
        const sc = sceneOf(r.base.w, r.other.w)
        setPlay({ i: idx, kind: 'hug', line: sc?.line })
        sfx.slideUp()
        later(500, () => cheerCrowd('laugh'))
        if (right) sayRight(null, { lead: [sc && rec(sc.key)] })
        else narrate([sc && rec(sc.key)])
      } else {
        setPlay({ i: idx, kind: 'apart' })
        sfx.slideDown()
        if (right) sayRight()
        else sayWrong()
      }
    })
  }

  // ── what the hint hand taps ──
  const els = useRef({})
  const ref = key => el => { if (el) els.current[key] = el; else delete els.current[key] }
  const hintRef = useMemo(() => ({
    get current() {
      const R = rounds[idxRef.current]
      if (!R) return null
      // A four-year-old taps where the hand taps, so it never shows a wrong
      // answer: until the child has tried, it taps the speaker (hear the
      // words again); after a miss it shows the right one. Ja/Nein has one
      // buzz only, so there it always taps the speaker.
      const key = R.mode === 'yesno' || !els.current.missedOnce ? 'speaker'
        : R.mode === 'odd' ? `actor-${R.correct.w}` : `balloon-${R.correct.w}`
      return els.current[key] ?? null
    },
  }), [rounds])
  els.current.missedOnce = tried.length > 0

  const balloonsUp = (r.mode === 'pick' || r.mode === 'verse') ? r.options.filter(o => !popped.includes(o)) : []
  const speaker = [...taskOf(r, true), ...balloonsUp.map(o => wordVoice(o.w) && { ...wordVoice(o.w), gap: 300 })]
  const verseLine = r.mode === 'verse' ? r.verse.line : null
  const title = scene?.line ?? null
  const ready = lay.W > 0 && lay.H > 0

  // they stay while the answer plays: after a miss the right one pulses
  const buzzers = yesno && (
    [true, false].map(yes => (
      <Buzzer key={String(yes)} yes={yes} size={bz} pulse={pulse === yes} off={done} onPress={e => buzz(yes, e.currentTarget)} btnRef={ref(yes ? 'yes' : 'no')} />
    ))
  )

  return (
    <div ref={outerRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
    <div data-rhyme="root" style={{
      position: 'absolute', left: 0, top: 0, width: fit.w || '100%', height: fit.h || '100%', transform: `scale(${1 / fit.k})`, transformOrigin: '0 0',
      display: 'flex', flexDirection: 'column', alignItems: 'center', boxSizing: 'border-box',
      padding: 'clamp(4px,1.2vh,12px) clamp(8px,2.5vw,24px)', gap: 'clamp(4px,1vh,10px)', userSelect: 'none',
    }}>
      {/* the rounds, the stars, the speaker */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', maxWidth: 760, flexShrink: 0 }}>
        <RoundTrail total={rounds.length} done={idx + (done ? 1 : 0)} walker="🎈" goal="🎭" size={room.h && room.h < 330 ? 28 : 36} style={{ flex: 1 }} />
        {juice.hud}
        <motion.button ref={ref('speaker')} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => narrate(speaker)}
          aria-label="Noch einmal anhören"
          style={{ ...pxButton('gold'), width: 52, height: 52, padding: 0, fontSize: 26, lineHeight: 1, flexShrink: 0 }}>🔊</motion.button>
      </div>

      <div ref={regionRef} style={{
        position: 'relative', flex: 1, minHeight: 0, width: '100%', display: 'flex',
        flexDirection: sideBuzzers ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: sideBuzzers ? 16 : 14,
      }}>
        {sideBuzzers && buzzers && buzzers[0]}
        {ready && (
          <div ref={juice.stage} data-stage={lay.row ? 'row' : 'corners'} style={{
            position: 'relative', width: lay.W + 2 * FRAME, height: lay.H + 2 * FRAME, flexShrink: 0, overflow: 'hidden',
            background: PURPLE, border: `${FRAME}px solid ${INK}`, borderRadius: '18px 18px 10px 10px', boxSizing: 'border-box',
            boxShadow: '0 6px 0 rgba(42,27,61,0.35)',
          }}>
            {/* spotlight, boards */}
            <div aria-hidden="true" style={{ position: 'absolute', left: '12%', right: '12%', top: 0, bottom: lay.audH + lay.floorH, background: 'radial-gradient(ellipse at 50% 100%, rgba(255,240,180,0.42), transparent 70%)' }} />
            <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: lay.floorTop, height: lay.floorH, background: 'repeating-linear-gradient(90deg, #b9753f 0 46px, #a8652f 46px 50px)', borderTop: `4px solid ${INK}`, boxSizing: 'border-box' }} />
            {lay.row && <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: lay.audH, background: '#2a1b3d' }} />}
            <Footlights lay={lay} lit={finale || bonus ? LAMPS : lamps} />

            {/* the stage, by mode */}
            <div key={idx} style={{ position: 'absolute', inset: 0 }}>
              {(r.mode === 'pick' || r.mode === 'verse') && (
                <>
                  {!(scene?.kind === 'scene') && (
                    <Actor item={r.base} lay={lay} x={baseX} size={lay.S} rime nope={nope} onTap={() => narrate([wordVoice(r.base.w)])} />
                  )}
                  {!scene && !fallers.some(f => f.right) && <Wanted lay={lay} x={slotX} />}
                </>
              )}
              {r.mode === 'odd' && !demo && scene?.kind !== 'scene' && (
                <AnimatePresence>
                  {r.options.filter(o => o !== scene?.gone).map((o, i) => (
                    <Actor key={o.w} item={o} lay={lay} x={oddX(r.options.indexOf(o))} size={S3} tappable={!done} shy={hasTried(o)}
                      enter={i} btnRef={ref(`actor-${o.w}`)} onTap={e => shoo(o, e.currentTarget)} yanked />
                  ))}
                </AnimatePresence>
              )}
              {r.mode === 'odd' && scene?.kind !== 'scene' && <Hook lay={lay} size={S3} targetX={scene?.gone ? oddX(r.options.indexOf(scene.gone)) : demo && demoStep === 2 ? lay.cx : null} />}
              {demo && <Decoy lay={lay} size={S3} step={demoStep} />}
              {yesno && <Trapezes lay={lay} round={r} play={scene} />}
              {scene?.kind === 'scene' && <Tableau lay={lay} {...scene} />}

              {/* things falling */}
              {fallers.map(f => <Faller key={f.id} lay={lay} {...f} />)}

              {/* the balloons */}
              {/* once the round is decided the others float up and away */}
              {balloonsUp.map(o => (
                <motion.div key={o.w} animate={{ y: done && o !== r.correct ? -lay.H : 0 }} transition={{ duration: 1.6, ease: 'easeIn', delay: 0.3 }}
                  style={{ position: 'absolute', inset: 0, zIndex: 4, pointerEvents: 'none' }}>
                  <Balloon item={o} lay={lay} pos={optionAt.mv(o)} color={BALLOONS[r.options.indexOf(o) % BALLOONS.length]}
                    glow={glow === o} btnRef={ref(`balloon-${o.w}`)} onPop={e => pop(o, e.currentTarget)} />
                </motion.div>
              ))}
            </div>

            <Curtains closed={leaving} k={idx} />
            <Valance lay={lay} title={title} verse={verseLine && { line: verseLine, base: r.base, answer: scene ? r.correct : null }} bonus={bonus?.i === idx ? bonus.words : null} />
            <Audience lay={lay} crowd={crowd} lit={finale ? 8 : won} />
            {bonus?.i === idx && <BonusShower lay={lay} words={bonus.words} paused={paused} onDone={endBonus} burst={burst} />}
          </div>
        )}
        {sideBuzzers ? buzzers && buzzers[1] : buzzers && <div style={{ display: 'flex', gap: 'clamp(24px,8vw,64px)', flexShrink: 0 }}>{buzzers}</div>}
      </div>

      <HintHand to={hintRef} active={!done && !leaving && !demo && !scene && !bonus} delay={hintDelay(idx)} />
      {bursts}
      {juice.layer}
    </div>
    </div>
  )
}

/**
 * The balloons' motion: each drifts with its lane and bobs; the motion
 * values are written in every frame, without a render. Returns `mv(item)`
 * (its x / y) and `current(item)` (where it is now).
 */
function useBalloonPositions(lay, r, idx, stopped) {
  const items = useMemo(() => ((r.mode === 'pick' || r.mode === 'verse') ? r.options : []), [r])
  const spots = useMemo(() => balloonSpots(lay, items), [lay, items])
  const mvs = useMemo(() => Object.fromEntries(items.map((o, i) => [o.w, { x: motionValue(spots[i]?.x ?? 0), y: motionValue(spots[i]?.y ?? 0) }])), [items]) // eslint-disable-line react-hooks/exhaustive-deps
  const t = useRef(0)
  useEffect(() => { t.current = 0 }, [idx])
  const stoppedRef = useRef(stopped)
  stoppedRef.current = stopped
  useEffect(() => {
    const still = reduceMotion()
    const period = 8 / (r.drift || 1)
    let raf = 0, last = performance.now()
    const place = () => items.forEach((o, i) => {
      const s = spots[i]; if (!s) return
      const phase = s.lane * Math.PI + (s.lane % 2 ? 0.6 : 0)
      mvs[o.w].x.set(s.x + s.amp * Math.sin((2 * Math.PI * t.current) / period + phase))
      mvs[o.w].y.set(s.y + s.bob * Math.sin((2 * Math.PI * t.current) / 2.6 + i * 1.7))
    })
    place()
    if (still) return
    const frame = now => {
      raf = requestAnimationFrame(frame)
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      if (!stoppedRef.current) { t.current += dt; place() }
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [items, spots, mvs, r.drift])
  const ref = useRef(null)
  ref.current = o => ({ x: mvs[o.w]?.x.get() ?? 0, y: mvs[o.w]?.y.get() ?? 0 })
  return { current: o => ref.current(o), mv: o => mvs[o.w] }
}

/** A name label; `rime` colours the part that rhymes (H-aus, Zitr-one). */
function Name({ item, rime, size = 18 }) {
  const cut = rime && item.rime ? item.w.length - item.rime.length : item.w.length
  return (
    <span style={{
      padding: '0 8px', borderRadius: 9, background: 'rgba(255,253,247,0.95)', border: `2px solid ${INK}`,
      fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: size, lineHeight: 1.2, color: INK, whiteSpace: 'nowrap',
    }}>{item.w.slice(0, cut)}{cut < item.w.length && <span style={{ color: '#d6336c' }}>{item.w.slice(cut)}</span>}</span>
  )
}

/** A candidate hanging from a balloon. A tap pops the balloon. */
function Balloon({ item, lay, pos, color, glow, onPop, btnRef }) {
  const { cw, nameH } = lay
  const bw = cw * 0.62, bh = cw * 0.72
  return (
    <motion.button ref={btnRef} type="button" aria-label={item.w} data-role="balloon" onClick={onPop} {...hearIt(item.w)}
      initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: 1, scale: glow ? [1, 1.12, 1] : 1 }}
      exit={{ opacity: 0 }}
      transition={glow ? { duration: 0.45, repeat: 1 } : { type: 'spring', stiffness: 220, damping: 15 }}
      style={{
        all: 'unset', position: 'absolute', left: 0, top: 0, x: pos?.x, y: pos?.y, width: cw, height: lay.cardH, zIndex: 4, pointerEvents: 'auto',
        cursor: 'crosshair', display: 'flex', flexDirection: 'column', alignItems: 'center', WebkitTapHighlightColor: 'transparent',
      }}>
      <svg viewBox="0 0 54 70" width={bw} height={bh} aria-hidden="true" style={{ overflow: 'visible', flexShrink: 0 }}>
        <ellipse cx="27" cy="29" rx="24" ry="28" fill={color} stroke={INK} strokeWidth="3" />
        <path d="M23 57 h8 l-4 -5z" fill={color} stroke={INK} strokeWidth="2" />
        <ellipse cx="18" cy="17" rx="6" ry="9" fill="#fff" opacity="0.55" />
        <path d="M27 58 q-4 6 0 12" stroke={INK} strokeWidth="2" fill="none" />
      </svg>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: cw, height: cw * 0.8 + nameH, marginTop: -cw * 0.1,
        background: '#fffdf7', border: `3px solid ${INK}`, borderRadius: 14, boxSizing: 'border-box',
        boxShadow: glow ? `0 0 0 5px ${GOLD}, 0 0 18px 6px rgba(255,201,60,0.8)` : '0 4px 0 rgba(42,27,61,0.25)',
      }}>
        <Art art={item.e} size={Math.round(cw * 0.62)} />
        {nameH > 0 && <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: clamp(cw * 0.17, 13, 18), lineHeight: 1.1, color: INK }}>{item.w}</span>}
      </div>
    </motion.button>
  )
}

/** A popped thing falling onto the stage: into the gap (right) or off the boards and away. */
function Faller({ lay, item, from, to, right, color }) {
  const still = reduceMotion()
  if (right) {
    const s0 = (lay.cw * 0.62) / lay.S
    return (
      <motion.div aria-hidden="true"
        initial={{ x: from.x - lay.S / 2, y: from.y - lay.S / 2, scale: s0, rotate: 0 }}
        animate={{ x: to.x - lay.S / 2, y: to.y - lay.S / 2, scale: 1, rotate: [0, 12, 0] }}
        transition={still ? { duration: 0 } : { duration: DROP_MS / 1000, ease: [0.5, 0, 0.9, 0.6] }}
        style={{ position: 'absolute', left: 0, top: 0, width: lay.S, height: lay.S, zIndex: 3 }}>
        <Art art={item.e} size={140} style={{ width: '100%', height: 'auto' }} />
      </motion.div>
    )
  }
  const s = lay.S * 0.7
  const fy = lay.feetY - s / 2, up = -s * 1.8
  return (
    <motion.div aria-hidden="true"
      initial={{ x: from.x - s / 2, y: from.y - s / 2 }}
      animate={{
        x: [from.x - s / 2, to.x - s / 2, to.x - s / 2, to.x - s / 2, to.x - s / 2, to.x - s / 2, to.x - s / 2],
        y: [from.y - s / 2, fy - s / 2, fy - s / 2 - s * 0.45, fy - s / 2, fy - s / 2, fy - s / 2 - 10, up],
        rotate: [0, 20, -10, 8, 0, 0, -6],
      }}
      transition={still ? { duration: 0 } : { duration: 3, times: [0, 0.18, 0.27, 0.36, 0.5, 0.55, 1], ease: 'easeInOut' }}
      style={{ position: 'absolute', left: 0, top: 0, width: s, height: s, zIndex: 3 }}>
      {/* a new balloon, the same colour as the old one, carries it away */}
      <motion.svg viewBox="0 0 54 70" width={s * 0.5} height={s * 0.65} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: still ? 0 : 1.2, type: 'spring', stiffness: 300, damping: 14 }}
        style={{ position: 'absolute', left: s * 0.25, bottom: '92%', overflow: 'visible', transformOrigin: '50% 100%' }}>
        <ellipse cx="27" cy="29" rx="24" ry="28" fill={color} stroke={INK} strokeWidth="3" />
        <path d="M27 57 v13" stroke={INK} strokeWidth="2" />
      </motion.svg>
      <Art art={item.e} size={120} style={{ width: '100%', height: 'auto', opacity: 0.85 }} />
    </motion.div>
  )
}

/** Someone standing on the stage. */
function Actor({ item, lay, x, size, rime, nope = 0, tappable = true, shy, onTap, btnRef, enter = 0, yanked }) {
  const still = reduceMotion()
  return (
    <motion.button ref={btnRef} type="button" aria-label={item.w} data-role={yanked ? 'actor' : 'base'} onClick={onTap} disabled={!tappable}
      {...hearIt(item.w, !!yanked && tappable)}
      initial={still ? false : { scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      exit={yanked && !still ? { x: -lay.W, rotate: -40, transition: { duration: 0.6, ease: 'easeIn', delay: 0.3 } } : { opacity: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.15 + enter * 0.12 }}
      style={{
        all: 'unset', position: 'absolute', left: x - size / 2, top: lay.feetY - size, width: size, zIndex: 2,
        cursor: tappable ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', alignItems: 'center', WebkitTapHighlightColor: 'transparent',
      }}>
      <motion.div key={nope} animate={still ? {} : nope ? { rotate: [0, -12, 12, -10, 10, 0] } : { y: [0, -5, 0] }}
        transition={nope ? { duration: 0.7 } : { duration: 2.2, repeat: Infinity }}
        style={{ width: size, height: size, transformOrigin: '50% 100%', opacity: shy ? 0.6 : 1, filter: shy ? 'grayscale(0.6)' : 'none' }}>
        <Art art={item.e} size={140} style={{ width: '100%', height: 'auto' }} />
      </motion.div>
      <div style={{ position: 'absolute', top: size + 4, left: '50%', transform: 'translateX(-50%)' }}>
        <Name item={item} rime={rime} size={lay.labelH * 0.72} />
      </div>
    </motion.button>
  )
}

/** The empty place beside the figure: a spot of light, someone is wanted here (no "?": nobody here reads it). */
function Wanted({ lay, x }) {
  const still = reduceMotion()
  const d = lay.S * 0.78
  return (
    <motion.div aria-hidden="true" initial={{ scale: 0, opacity: 0 }} animate={still ? { scale: 1, opacity: 1 } : { scale: [1, 1.08, 1], opacity: 1 }}
      transition={still ? {} : { scale: { duration: 1.4, repeat: Infinity, delay: 0.6 }, opacity: { delay: 0.6 } }}
      style={{
        position: 'absolute', left: x - d / 2, top: lay.feetY - lay.S / 2 - d / 2, width: d, height: d, borderRadius: '50%', zIndex: 1,
        border: `5px dashed ${GOLD}`, background: 'radial-gradient(circle, rgba(255,240,180,0.55), rgba(255,201,60,0.12) 70%)', boxSizing: 'border-box',
      }} />
  )
}

/**
 * The pair's scene, as its line says. The mover hops from where it stood to
 * its place on (in, before, beside) the seat and plays its act there.
 */
function Tableau({ lay, mover, seat, place, from, names = [seat, mover] }) {
  const still = reduceMotion()
  const S = lay.S
  const [settled, setSettled] = useState(still)
  useEffect(() => { if (still) return; const t = setTimeout(() => setSettled(true), 900); return () => clearTimeout(t) }, [still])
  const seatX = lay.cx - (place.how === 'beside' ? place.at[0] * S * 0.5 : 0)
  const seatY = lay.feetY - S / 2
  const tx = seatX + place.at[0] * S, ty = seatY + place.at[1] * S
  const m0 = { x: from?.[mover.w] ?? lay.cx - S * 0.62, y: seatY }
  const s0 = { x: from?.[seat.w] ?? lay.cx + S * 0.62 }
  const clip = place.how === 'in' && !place.flat
  // above its place first: the apex of the hop, where something going *in* is still whole
  const apexY = Math.min(m0.y, ty) - S * (clip ? 0.55 : 0.4)
  const size = place.size
  const box = { position: 'absolute', left: 0, top: 0, width: S, height: S }
  const pic = <Art art={mover.e} size={140} style={{ width: '100%', height: 'auto', filter: place.red ? 'grayscale(1) brightness(0.8) sepia(1) hue-rotate(-45deg) saturate(12)' : undefined }} />
  const act = still ? {} : ACTS[place.act]?.(S) ?? {}
  // the seat squashes when something lands on it
  const seatAct = still ? {} : place.how === 'on' ? { scaleY: [1, 0.86, 1, 0.9, 1], scaleX: [1, 1.08, 1, 1.05, 1] } : place.act === 'glow' && place.how === 'beside' ? GLOW : {}
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
      <motion.div initial={{ x: s0.x - S / 2, y: seatY - S / 2 }} animate={{ x: seatX - S / 2, y: seatY - S / 2 }}
        transition={{ duration: 0.5, ease: 'easeInOut' }} style={{ ...box, zIndex: 1 }}>
        <motion.div animate={settled ? seatAct : {}} transition={{ duration: 1.6, delay: 0.1, repeat: 1 }} style={{ width: '100%', height: '100%', transformOrigin: '50% 100%' }}>
          <Art art={seat.e} size={140} style={{ width: '100%', height: 'auto' }} />
        </motion.div>
      </motion.div>
      {place.mirror && settled && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.5 }} transition={{ duration: 0.6 }}
          style={{ ...box, zIndex: 1, x: seatX + place.mirror[0] * S - S / 2, y: seatY + place.mirror[1] * S - S / 2, scaleX: -place.mirror[2], scaleY: place.mirror[2] }}>
          {pic}
        </motion.div>
      )}
      {!settled ? (
        <motion.div key="hop" initial={{ x: m0.x - S / 2, y: m0.y - S / 2, scale: 1 }}
          animate={place.how === 'peek'
            ? { x: [m0.x - S / 2, seatX - S * 0.62, seatX - S * 0.52], y: [m0.y - S / 2, apexY - S / 2, seatY - S * 0.35], scale: [1, 0.6, 0.2], opacity: [1, 1, 0] }
            : { x: [m0.x - S / 2, (m0.x + tx) / 2 - S / 2, tx - S / 2], y: [m0.y - S / 2, apexY - S / 2, (clip ? apexY + S * 0.05 : ty) - S / 2], scale: [1, (1 + size) / 2, size], rotate: [0, -15, 0] }}
          transition={{ duration: 0.9, times: [0, 0.5, 1], ease: 'easeOut' }}
          style={{ ...box, zIndex: 3 }}>{pic}</motion.div>
      ) : clip ? (
        // into it: what is below the rim is inside
        <div key="in" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: seatY + place.rim * S, overflow: 'hidden', zIndex: 3 }}>
          <motion.div initial={{ x: tx - S / 2, y: apexY + S * 0.05 - S / 2, scale: size }}
            animate={{ y: ty - S / 2 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }} style={box}>
            <motion.div animate={act} transition={{ duration: 1.4, delay: 0.4, repeat: 1 }} style={{ width: '100%', height: '100%' }}>{pic}</motion.div>
          </motion.div>
        </div>
      ) : (
        <motion.div key="there" initial={{ x: tx - S / 2, y: ty - S / 2, scale: place.how === 'peek' ? 0 : size }}
          animate={{ scale: size }} transition={{ type: 'spring', stiffness: 260, damping: 14 }} style={{ ...box, zIndex: 3 }}>
          <motion.div animate={act} transition={{ duration: 1.4, delay: 0.25, repeat: 1 }} style={{ width: '100%', height: '100%', transformOrigin: '50% 60%' }}>
            {pic}
            {place.prop && (
              <div style={{ position: 'absolute', left: S * (0.5 + place.prop.at[0] - place.prop.size / 2), top: S * (0.5 + place.prop.at[1] - place.prop.size / 2),
                width: S * place.prop.size, height: S * place.prop.size, transform: `rotate(${place.prop.rotate ?? 0}deg)` }}>
                <Art art={place.prop.art} size={140} style={{ width: '100%', height: 'auto' }} />
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
      {/* both names, the rhyme coloured, under the pair */}
      <div style={{ position: 'absolute', left: seatX, top: lay.feetY + 4, transform: 'translateX(-50%)', display: 'flex', gap: 6, zIndex: 4 }}>
        {names.map(x => <Name key={x.w} item={x} rime size={lay.labelH * 0.72} />)}
      </div>
    </div>
  )
}

const GLOW = { filter: ['drop-shadow(0 0 0px #ffe14d)', 'drop-shadow(0 0 16px #ffe14d)', 'drop-shadow(0 0 4px #ffe14d)'] }
// What the mover does in its place, by the line: S is the seat's size
const ACTS = {
  bounce: S => ({ y: [0, -S * 0.16, 0, -S * 0.1, 0] }),
  wobble: () => ({ rotate: [0, -12, 10, -8, 6, 0] }),
  sink:   () => ({ rotate: [0, -6, 6, 0] }),
  peek:   S => ({ y: [0, -S * 0.08, 0, -S * 0.08, 0], rotate: [0, -8, 0, 8, 0] }),
  grow:   () => ({ scaleY: [1, 1.5, 1.3, 1.5, 1.3] }),
  brush:  S => ({ x: [0, -S * 0.1, S * 0.1, -S * 0.1, S * 0.1, 0] }),
  wave:   () => ({ rotate: [0, 16, -12, 16, -12, 0] }),
  glow:   () => GLOW,
}

/** A cane from the left wing: it waits, and yanks the odd one off. */
function Hook({ lay, size, targetX }) {
  const still = reduceMotion()
  const w = size * 1.5, h = w * 0.35
  const y = lay.feetY - size * 0.72 - h / 2
  // its crook (the right end) reaches round the one it takes
  const reach = targetX != null ? targetX + size * 0.18 - w : null
  const rest = lay.open.left + size * 0.42 - w
  return (
    <motion.svg aria-hidden="true" viewBox="0 0 260 90" width={w} height={h}
      initial={{ x: rest }}
      animate={still ? { x: rest } : reach != null
        ? { x: [rest, reach, reach, -w - 40], transition: { duration: YANK_MS / 1000, times: [0, 0.35, 0.45, 1] } }
        : { x: [rest, rest + size * 0.18, rest], transition: { duration: 1.4, repeat: Infinity, delay: 0.7 } }}
      style={{ position: 'absolute', left: 0, top: y, zIndex: 4, pointerEvents: 'none', overflow: 'visible' }}>
      <path d="M0 64 H196 a32 32 0 1 0 -32 -32" stroke={INK} strokeWidth="22" fill="none" strokeLinecap="round" />
      <path d="M0 64 H196 a32 32 0 1 0 -32 -32" stroke="#c98a52" strokeWidth="13" fill="none" strokeLinecap="round" />
      <path d="M10 60 H190" stroke="#e0a970" strokeWidth="4" strokeLinecap="round" />
    </motion.svg>
  )
}

/** The demo of the first odd-one-out round: a teddy stands, a finger taps it, the hook takes it. */
function Decoy({ lay, size, step }) {
  const still = reduceMotion()
  return (
    <>
      <AnimatePresence>
        {step < 2 && (
          <motion.div key="teddy" aria-hidden="true" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={still ? { opacity: 0 } : { x: -lay.W, rotate: -40, transition: { duration: 0.6, ease: 'easeIn', delay: 0.3 } }}
            style={{ position: 'absolute', left: lay.cx - size / 2, top: lay.feetY - size, width: size, zIndex: 2 }}>
            <Art art="🧸" size={140} style={{ width: '100%', height: 'auto' }} />
          </motion.div>
        )}
      </AnimatePresence>
      {step === 1 && (
        <motion.div aria-hidden="true" initial={{ opacity: 0, y: 30 }} animate={{ opacity: [0, 1, 1, 0], y: [30, 0, 8, 0], scale: [1, 1, 0.85, 1] }}
          transition={{ duration: 1.2, times: [0, 0.3, 0.55, 1] }}
          style={{ position: 'absolute', left: lay.cx - 20, top: lay.feetY - size * 0.5, zIndex: 6 }}>
          <Art art="👆" size={Math.round(size * 0.45)} />
        </motion.div>
      )}
    </>
  )
}

/**
 * Ja/Nein: two swing in on a trapeze. A rhyming pair swings together and
 * hugs; the others shrug, turn their backs on each other and swing apart.
 */
function Trapezes({ lay, round, play }) {
  const still = reduceMotion()
  const S = lay.S * 0.9
  const top = lay.valH - 6
  const barY = lay.feetY - lay.S * 0.32
  const L = barY - top
  const d = Math.min(lay.S * 1.0, (lay.open.right - lay.open.left) / 4)
  const hug = play?.kind === 'hug', apart = play?.kind === 'apart'
  const meet = Math.asin(clamp((d - S * 0.36) / L, 0, 0.9)) * 180 / Math.PI
  return [round.base, round.other].map((it, side) => {
    const sgn = side ? -1 : 1   // left one: positive rotation swings its bar to the left
    const swing = still ? { rotate: 0 }
      : hug ? { rotate: -sgn * meet, transition: { type: 'spring', stiffness: 60, damping: 9 } }
      : apart ? { rotate: [0, 0, sgn * 85], opacity: [1, 1, 0], transition: { duration: 1.6, times: [0, 0.45, 1], ease: 'easeIn' } }
      : { rotate: [sgn * 70, -sgn * 8, sgn * 5, -sgn * 3, 0], transition: { duration: 1.6, ease: 'easeOut', delay: side * 0.15 } }
    return (
      <motion.div key={it.w} aria-hidden="true" data-trapeze={it.w} initial={still ? false : { rotate: sgn * 70 }} animate={swing}
        style={{ position: 'absolute', left: lay.cx + (side ? d : -d) - S * 0.6, top, width: S * 1.2, height: L + 10, transformOrigin: '50% 0', zIndex: 2 }}>
        <svg width={S * 1.2} height={L + 10} viewBox={`0 0 ${S * 1.2} ${L + 10}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <path d={`M${S * 0.6} 0 L${S * 0.06} ${L} M${S * 0.6} 0 L${S * 1.14} ${L}`} stroke={INK} strokeWidth="5" />
          <path d={`M${S * 0.6} 0 L${S * 0.06} ${L} M${S * 0.6} 0 L${S * 1.14} ${L}`} stroke="#e9d8b4" strokeWidth="2.5" />
        </svg>
        <div style={{ position: 'absolute', left: 0, right: 0, top: L, height: 10, background: '#c98a52', border: `3px solid ${INK}`, borderRadius: 6, boxSizing: 'border-box' }} />
        <motion.div
          animate={still ? {} : hug ? { rotate: sgn * 12, y: [0, -8, 0], transition: { y: { duration: 0.5, repeat: 3, delay: 0.6 } } }
            : apart ? { scaleX: [1, -1], y: [0, -10, 0, -10, 0], transition: { duration: 0.7 } }
            : { y: [0, -4, 0], transition: { duration: 1.8, repeat: Infinity } }}
          style={{ position: 'absolute', left: S * 0.1, top: L - S, width: S, height: S, transformOrigin: '50% 100%' }}>
          <Art art={it.e} size={140} style={{ width: '100%', height: 'auto' }} />
        </motion.div>
        <div style={{ position: 'absolute', left: '50%', top: L + 12, transform: 'translateX(-50%)', opacity: hug ? 0 : 1, transition: 'opacity .3s' }}>
          <Name item={it} size={lay.labelH * 0.66} />
        </div>
        {hug && side === 0 && !still && (
          <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1.3, 1], opacity: 1, y: [0, -S * 0.3] }} transition={{ delay: 0.9, duration: 0.8 }}
            style={{ position: 'absolute', left: S * 1.05, top: L - S * 1.05 }}>
            <Art art="❤️" size={Math.round(S * 0.36)} />
          </motion.div>
        )}
      </motion.div>
    )
  })
}

/** A big round buzzer: green for yes, red for no. */
function Buzzer({ yes, size, pulse, off, onPress, btnRef }) {
  return (
    <motion.button ref={btnRef} type="button" onClick={onPress} disabled={off}
      aria-label={yes ? 'Ja, das reimt sich' : 'Nein, das reimt sich nicht'}
      whileTap={{ scale: 0.9, y: 4 }}
      animate={pulse ? { scale: [1, 1.15, 1, 1.15, 1], boxShadow: [`0 6px 0 ${INK}`, `0 6px 0 ${INK}, 0 0 0 10px ${GOLD}`, `0 6px 0 ${INK}`] } : { scale: 1 }}
      transition={pulse ? { duration: 1.1 } : {}}
      style={{
        all: 'unset', width: size, height: size, borderRadius: '50%', flexShrink: 0, cursor: off ? 'default' : 'pointer', boxSizing: 'border-box',
        opacity: off && !pulse ? 0.55 : 1, transition: 'opacity .3s',
        background: yes ? 'radial-gradient(circle at 40% 32%, #8ee07a, #2fa84f 60%, #1f7a38)' : 'radial-gradient(circle at 40% 32%, #ff9a8a, #e5484d 60%, #a8232e)',
        border: `4px solid ${INK}`, boxShadow: `0 6px 0 ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        WebkitTapHighlightColor: 'transparent',
      }}>
      <span style={{ display: 'inline-flex', transform: yes ? 'none' : 'rotate(180deg)', filter: 'drop-shadow(0 2px 0 rgba(42,27,61,0.4))' }}>
        <Art art="👍" size={Math.round(size * 0.52)} />
      </span>
    </motion.button>
  )
}

/** The footlights: right pops in a row light them one by one. */
function Footlights({ lay, lit }) {
  const still = reduceMotion()
  const d = lay.lampH
  const gap = clamp(lay.W * 0.07, 24, 70)
  const y = lay.floorBottom - d - 3
  return Array.from({ length: LAMPS }, (_, i) => {
    const on = i < lit
    return (
      <motion.div key={i} aria-hidden="true" data-lamp={on ? 'on' : 'off'}
        animate={on && !still ? { scale: [1, 1.5, 1] } : { scale: 1 }} transition={{ duration: 0.4 }}
        style={{
          position: 'absolute', left: lay.cx + (i - (LAMPS - 1) / 2) * gap - d, top: y, width: d * 2, height: d, zIndex: 5,
          borderRadius: `${d}px ${d}px 3px 3px`, border: `2px solid ${INK}`, boxSizing: 'border-box',
          background: on ? '#fff3a0' : '#5a4a3a', boxShadow: on ? `0 0 14px 6px rgba(255,225,90,0.75)` : 'none', transition: 'background .3s, box-shadow .3s',
        }} />
    )
  })
}

/** The valance; the scene's line hangs on it, or the verse with its gap. */
function Valance({ lay, title, verse, bonus }) {
  const h = lay.valH
  const fs = clamp(h * 0.42, 13, 19)
  return (
    <div style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: h + 10, zIndex: 7, pointerEvents: 'none' }}>
      <svg aria-hidden="true" viewBox="0 0 640 40" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: h + 10 }}>
        <path d="M0 0 H640 V28 Q620 40 600 28 Q580 40 560 28 Q540 40 520 28 Q500 40 480 28 Q460 40 440 28 Q420 40 400 28 Q380 40 360 28 Q340 40 320 28 Q300 40 280 28 Q260 40 240 28 Q220 40 200 28 Q180 40 160 28 Q140 40 120 28 Q100 40 80 28 Q60 40 40 28 Q20 40 0 28 Z" fill="#c62f45" stroke={INK} strokeWidth="3" vectorEffect="non-scaling-stroke" />
      </svg>
      <div style={{ position: 'absolute', inset: `3px 0 10px`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <AnimatePresence mode="wait">
          {verse ? (
            <motion.div key="verse" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={plaque(fs)}>
              <Art art={verse.base.e} size={Math.round(fs * 1.5)} />
              <span>{verse.line.replace(' …', '')}</span>
              <motion.span key={verse.answer ? 'a' : 'q'} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 14, delay: verse.answer ? 0.6 : 0 }}
                style={{ flexShrink: 0, width: fs * 1.8, height: fs * 1.6, borderRadius: 8, border: verse.answer ? `2px solid ${INK}` : '3px dashed #d6336c',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', background: verse.answer ? '#ffe28a' : 'transparent', color: '#d6336c', boxSizing: 'border-box' }}>
                {verse.answer && <Art art={verse.answer.e} size={Math.round(fs * 1.4)} />}
              </motion.span>
            </motion.div>
          ) : bonus ? (
            <motion.div key="bonus" initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} style={plaque(fs)}>
              {bonus.map(x => <Art key={x.w} art={x.e} size={Math.round(fs * 1.5)} />)}
            </motion.div>
          ) : title ? (
            <motion.div key={title} initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.15 } }}
              transition={{ delay: 0.7, type: 'spring', stiffness: 260, damping: 16 }} style={plaque(fs)}>{title}</motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
const plaque = fs => ({
  display: 'flex', alignItems: 'center', gap: 6, maxWidth: '84%', padding: '1px 12px', boxSizing: 'border-box',
  background: GOLD, border: `3px solid ${INK}`, borderRadius: 10,
  fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: fs, lineHeight: 1.15, color: INK, textAlign: 'center',
})

/** Red curtains: they open when a round starts and close at its end. */
function Curtains({ closed, k }) {
  const still = reduceMotion()
  return [-1, 1].map(side => (
    <motion.div key={`${k}${side}`} aria-hidden="true"
      initial={still ? false : { width: '51%' }} animate={{ width: closed ? '51%' : '8%' }}
      transition={{ duration: 0.55, ease: 'easeInOut', delay: closed ? 0 : 0.15 }}
      style={{
        position: 'absolute', top: 0, bottom: 0, [side < 0 ? 'left' : 'right']: 0, zIndex: 6,
        background: 'repeating-linear-gradient(90deg, #c62f45 0 18px, #a8233a 18px 30px)',
        borderRight: side < 0 ? `3px solid ${INK}` : undefined, borderLeft: side > 0 ? `3px solid ${INK}` : undefined,
        borderRadius: side < 0 ? '0 0 40% 0' : '0 0 0 40%',
      }} />
  ))
}

// one seat for every round: the hall is full by the end
const AUDIENCE = ['🐻', '🐰', '🐱', '🐸', '🦊', '🐶', '🐼', '🐨']

/**
 * The audience: dark until won (one per right answer). It claps for a
 * rhyme found, laughs at the scene, and cheers at the shower and the end.
 * In a row below the stage, or in the two front corners (inside the open
 * curtains) when the screen is low.
 */
function Audience({ lay, crowd, lit }) {
  const still = reduceMotion()
  const h = lay.head
  const pos = i => {
    if (lay.row) {
      const gap = Math.min(h * 1.25, (lay.W - 24) / AUDIENCE.length)
      return { left: lay.cx + (i - (AUDIENCE.length - 1) / 2) * gap - h / 2, top: lay.H - lay.audH + (lay.audH - h) * 0.55 }
    }
    const k = i % 4, right = i >= 4
    const edge = lay.open.left + 6
    return { left: right ? lay.W - edge - (4 - k) * h * 1.02 : edge + k * h * 1.02, top: lay.H - h * 0.92 }
  }
  const { kind, n } = crowd
  return AUDIENCE.map((a, i) => {
    const awake = !!kind || i < lit
    const jump = kind === 'cheer' ? h * 0.5 : h * 0.32
    return (
      <motion.div key={`${a}${n}`} aria-hidden="true"
        animate={!still && kind ? { y: [0, -jump, 0, -jump * 0.7, 0], rotate: kind === 'laugh' ? [0, -10, 10, 0] : 0 } : { y: 0 }}
        transition={{ duration: 0.7, delay: 0.05 * i, repeat: kind === 'cheer' ? 2 : 1 }}
        style={{ position: 'absolute', ...pos(i), width: h, height: h, zIndex: 8, filter: awake ? 'none' : 'brightness(0.2) saturate(0)', transition: 'filter .5s' }}>
        <Art art={a} size={64} style={{ width: '100%', height: 'auto' }} />
        {kind && i % 2 === (n % 2) && (
          <motion.span initial={{ opacity: 0, y: 0, scale: 0.5 }} animate={{ opacity: [0, 1, 1, 0], y: -h * 0.6, scale: 1 }}
            transition={{ duration: 1.3, delay: 0.1 + i * 0.06 }}
            style={{ position: 'absolute', left: '50%', top: -h * 0.2, transform: 'translateX(-50%)', whiteSpace: 'nowrap',
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: clamp(h * 0.36, 14, 20), color: '#ff6fa3', WebkitTextStroke: `1px ${INK}` }}>
            {kind === 'clap' ? <Art art="👏" size={Math.round(h * 0.7)} /> : kind === 'laugh' ? 'ha ha!' : <Art art="🎉" size={Math.round(h * 0.7)} />}
          </motion.span>
        )}
      </motion.div>
    )
  })
}

/**
 * The bonus for a full row of lamps: balloons rise all over the stage, each
 * carrying a word that rhymes with the one just played. Pop as many as you
 * like; it is not counted.
 */
function BonusShower({ lay, words, paused, onDone, burst }) {
  const still = reduceMotion()
  const n = 12
  const list = useMemo(() => Array.from({ length: n }, (_, i) => ({
    id: i, item: words[i % words.length], color: BALLOONS[i % BALLOONS.length],
    x: lay.open.left + 10 + ((i * 0.618) % 1) * (lay.open.right - lay.open.left - lay.cw - 20),
    delay: (i * 0.42) % 5, dur: 3.4 + ((i * 0.37) % 1.2),
  })), [words, lay])
  const [gone, setGone] = useState([])
  const [step, setStep] = useState(0)
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    if (paused) return
    const t = setTimeout(() => done.current(), BONUS_MS - 600)
    return () => clearTimeout(t)
  }, [paused])
  const pop = (b, el) => {
    sfx.pop()
    sfx.pluck(step)
    setStep(s => s + 1)
    burst(el, 'confetti', 8)
    setGone(g => [...g, b.id])
  }
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 9, overflow: 'hidden' }}>
      {list.filter(b => !gone.includes(b.id)).map(b => (
        <motion.button key={b.id} type="button" aria-label={`Bonus-Ballon ${b.item.w}`} onClick={e => pop(b, e.currentTarget)}
          initial={{ x: b.x, y: lay.H + 10 }} animate={still ? { y: lay.H * 0.4 } : { y: -lay.cardH - 20, x: [b.x, b.x + 20, b.x - 10, b.x] }}
          transition={{ duration: b.dur, delay: b.delay, ease: 'linear' }}
          style={{ all: 'unset', position: 'absolute', left: 0, top: 0, width: lay.cw * 0.9, cursor: 'crosshair', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <svg viewBox="0 0 54 70" width={lay.cw * 0.7} height={lay.cw * 0.9} aria-hidden="true" style={{ overflow: 'visible' }}>
            <ellipse cx="27" cy="29" rx="24" ry="28" fill={b.color} stroke={INK} strokeWidth="3" />
            <path d="M27 57 v13" stroke={INK} strokeWidth="2" />
          </svg>
          <Art art={b.item.e} size={Math.round(lay.cw * 0.6)} />
        </motion.button>
      ))}
    </div>
  )
}
