import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { generateQuestions } from './gameEngine.js'
import { sfx } from '../sfx.js'
import { lockPreviews, narrate, afterNarration, onNarrationChange, leaveGame } from '../narrator.js'
import { LINES, line } from '../lib/lumiLines.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { useMusic } from '../components/MusicControls.jsx'
import { RoundTrail, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { pxCard } from './px.js'
import {
  EMPTY, instOf, nameOf, countOf, artOf, slotsOf, wantedAt, slotAt, seated, membersOf,
  bpmOf, cheerBpm, timeline, tryFrom, finaleTune, FINALE_BPM, REST,
} from './tierband/band.js'
import { useBand, useVisible, useLater, useSize } from './tierband/useBand.js'
import { INK, Performer, Group, Stool, Bench, Lamp, Hill, Flyer, hillSlots, colsOf, groupH, GROUP_PITCH } from './tierband/stage.jsx'

/**
 * Musterpark — "Tier-Band": seeing, hearing and continuing a pattern
 *
 * A pattern is a rhythm. The animals of a row sit on stools on a stage,
 * each with an instrument that has its own short sound. A lamp runs along
 * the row in time, and the animal in its light hops and plays: "bum –
 * tschak – bum – tschak – bum – …". One stool is empty; the light passes it
 * in silence, so the gap can be heard. Then the row plays again from the
 * start, until the child acts.
 *
 * Below the stage wait the animals to choose from. The child puts the
 * right one on the empty stool: drags it there, or taps it (it plays its
 * sound alone and is picked up) and then taps the stool or the animal once
 * more. Up to level 5 a tap alone sends it to the stool.
 *
 *   • Right: a star flies to the counter, the band plays the whole row
 *     twice, faster, everybody dances, and the row's animals hop up the
 *     hill at the back to the big band, which grows over the level.
 *   • Wrong: the animal sits down all the same and the band plays the last
 *     round of the pattern with it. It sounds wrong at its place (its note
 *     comes out grey and falls down); the animal shakes its head and hops
 *     back to where it waited. Try again.
 *   • After two misses at one stool the right animal plays softly from
 *     where it waits each time the light is on the empty stool: the loop is
 *     heard whole, and one sees who made the missing sound.
 *   • Build rounds (from level 6): several stools at the end of the row,
 *     filled one by one.
 *   • A growing row (from level 5): one frog, two frogs, three frogs on
 *     their benches play one, two, three notes. Which group comes next?
 *   • Finale: the whole big band plays a short tune together.
 *   • Every animal is a toy: tapped on the stage or on the hill, it plays.
 *     While the band dances, every tap anywhere is a clap.
 *
 * The rows come from games/gameEngine.js (AB, AAB, ABB, ABC, AABB, growing
 * rows, a gap in the middle, several stools). The steady time is kept by
 * games/tierband/useBand.js on the audio clock; the loop holds still while
 * the help is open and while Lumi speaks. With the app's music switched
 * off the band is silent (the light, the hops and the little notes still
 * show the rhythm; an animal that is tapped still plays its own sound) and
 * a speaker on the stage offers to switch the sound back on.
 *
 * Why this: repeating and growing patterns are the root of early algebra
 * (Clements & Sarama, Learning Trajectories); a pattern that is heard and
 * seen at once is found by children who do not yet find it by eye alone.
 *
 * Result: rows finished without a miss.
 */

const ROUNDS = 8
// Up to this level every row has one empty stool, and a tap alone sends an
// animal there. From then on (rows with several stools come in) a tap lets
// it play alone first and picks it up; a second tap on it, a tap on the
// stool or a drag sends it.
const DIRECT_TO = 5
// The app's music switch also silences the band. Set to false if the band
// is to play whatever the switch says.
const RESPECT_MUSIC_SWITCH = true
// Lines Lumi may get later; silent until they are recorded
const SAY_START = 'musterpark/wer-fehlt'
const SAY_BUILD = 'musterpark/wie-weiter'
const optional = key => (LINES[key] ? line(key) : null)

const PAD = 8
const POST = 14            // the curtains left and right of the row
const FLOOR = 18           // the stage's wooden floor
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const NO_BEAT = { id: 0, place: -1, sub: 0, lit: false, played: false, ghost: false }

// ── Where everything stands ─────────────────────────────────────────────────
// From top to bottom: the trail of rounds and the star counter, the hill
// with the big band, the stage with the row (one line, or two on a narrow
// screen), and the animals that wait. On a screen that is low and wide the
// hill stands at the right, beside the stage.
function layout(W, H, q) {
  const short = H < 440, narrow = W < 560
  const grow = q.kind === 'grow'
  const trail = short ? 20 : narrow ? 24 : 28
  const star = short ? 26 : narrow ? 30 : 36
  const topH = Math.round(trail * 1.35) + 16
  const hudW = star * 3

  // the hill of the big band
  let hill, slots, a
  if (short) {
    const w = clamp(W * 0.21, 130, 190)
    a = clamp(w * 0.23, 28, 44)
    const h = Math.min(H - topH - 10, w * 0.7 + a)
    hill = { x: W - PAD - w, y: H - 6 - h, w, h }
    slots = hillSlots(w, h, a, { pitch: 0.6, taper: 0.16, tiers: 5 })
  } else {
    const h = clamp(H * (narrow ? 0.2 : 0.24), 84, 190), w = Math.min(W - PAD * 2, h * 3.4)
    hill = { x: (W - w) / 2, y: topH + 2, w, h }
    a = clamp(h * 0.36, 24, 62)
    slots = hillSlots(w, h, a)
  }
  // what is left for the stage and the animals that wait
  const M = short ? hill.x - 4 : W

  // the animals that wait
  const opts = q.options
  const perRow = grow && narrow ? 2 : opts.length
  const trayRows = Math.ceil(opts.length / perRow)
  const cgap = narrow ? 8 : short ? 14 : 26
  const cellW = (M - PAD * 2 - cgap * (perRow - 1)) / perRow
  let card
  if (grow) {
    const cols = Math.max(...opts.map(o => colsOf(countOf(q, o))))
    const e = clamp((Math.min(cellW, 220) - 18) / (cols * GROUP_PITCH), 30, short ? 36 : narrow ? 46 : 56)
    card = { w: Math.max(68, cols * e * GROUP_PITCH + 18), h: Math.max(68, groupH(3, e) + 18), e }
  } else {
    const c = clamp(cellW, 64, short ? 80 : narrow ? 96 : 124)
    card = { w: c, h: c, e: c * 0.8 }
  }
  const trayH = trayRows * card.h + (trayRows - 1) * cgap
  const trayTop = H - trayH - (short ? 8 : narrow ? 14 : 22)
  const cards = opts.map((token, i) => {
    const r = Math.floor(i / perRow), inRow = Math.min(perRow, opts.length - r * perRow), k = i % perRow
    const rowW = inRow * card.w + (inRow - 1) * cgap
    return { token, x: (M - rowW) / 2 + k * (card.w + cgap), y: trayTop + r * (card.h + cgap), w: card.w, h: card.h }
  })

  // the row on its stage
  const stageTop = short ? topH + 4 : hill.y + hill.h + 10
  const availH = trayTop - stageTop - (short ? 8 : 16)
  const RW = M - PAD * 2 - POST * 2 - 8
  const n = q.tokens.length
  const countAt = i => (q.tokens[i] === EMPTY ? countOf(q, wantedAt(q, slotAt(q, i))) : countOf(q, q.tokens[i]))
  const unitW = i => (grow ? colsOf(countAt(i)) * GROUP_PITCH + 0.3 : 1)   // a place's width, in animals
  const gapU = grow ? 0.42 : 0.06
  const lineU = idx => idx.reduce((sum, i) => sum + unitW(i), 0) + gapU * (idx.length - 1)
  const bodyU = grow ? (q.counts.some(c => c > 2) ? 1.82 : 1) : 1  // an animal or a group, in animals high
  const stoolU = grow ? 0.2 : 0.34, lampU = 0.36
  const all = q.tokens.map((_, i) => i)
  const roomOf = lines => (availH - (lines.length - 1) * 8) / lines.length - FLOOR - 4
  // the lamp needs LAMP_MIN pixels above the animals at least: with less,
  // its shade hung into the row (a group of three on a phone)
  const LAMP_MIN = 30
  const fit = lines => Math.min(grow ? 84 : 104, RW / Math.max(...lines.map(lineU)),
    roomOf(lines) / (bodyU + stoolU + lampU), (roomOf(lines) - LAMP_MIN) / (bodyU + stoolU))
  let lines = [all], s = fit(lines)
  if (!short && n > (narrow && !grow ? 5 : 3) && s < (grow ? 50 : narrow ? 72 : 54)) {
    // the row goes round the bend: two lines, read like a book, broken
    // between two rounds of the pattern
    const u = q.unit?.length ?? 2
    let cut = u
    for (let c = u; c < n; c += u) if (Math.max(c, n - c) < Math.max(cut, n - cut)) cut = c
    const two = [all.slice(0, cut), all.slice(cut)]
    const s2 = fit(two)
    if (s2 > s * 1.12) { lines = two; s = s2 }
  }
  s = Math.max(30, s)
  const body = s * bodyU, stool = Math.max(10, s * stoolU)
  // the lamp hangs as high as there is room: a long cone of light
  const lamp = clamp(roomOf(lines) - body - stool, Math.max(LAMP_MIN, s * lampU), Math.max(LAMP_MIN, s * 0.75))
  const lineH = lamp + body + stool + FLOOR
  const blockH = lines.length * lineH + (lines.length - 1) * 8
  const stageY = stageTop + Math.max(0, (availH - blockH) * 0.5)
  const stageW = Math.min(M - PAD * 2 - 8, Math.max(...lines.map(lineU)) * s + POST * 2 + s * 0.5)
  const stageX = (M - stageW) / 2
  const places = []
  lines.forEach((idx, li) => {
    let x = (stageW - lineU(idx) * s) / 2
    for (const i of idx) {
      const w = unitW(i) * s
      places[i] = { line: li, x: x + w / 2, w, top: li * (lineH + 8) }
      x += w + gapU * s
    }
  })

  // the speaker that switches the sound back on: where nothing else is
  const sound = short || !narrow
    ? { x: Math.max(PAD, Math.min(cards[0].x - 84, stageX)), y: trayTop + (card.h - 64) / 2 }
    : { x: PAD, y: stageTop - 62 }

  return {
    short, narrow, trail, star, topH, hudW, M, card, cards, trayTop, trayH, hill, a, slots,
    stage: { x: stageX, y: stageY, w: stageW, h: blockH }, lines, places, s, lamp, body, stool, lineH, sound,
    // the middle of what sits (or will sit) on a place, in the game's own pixels
    seatAt: i => ({ x: stageX + places[i].x, y: stageY + places[i].top + lamp + body / 2 }),
    cardAt: token => { const c = cards.find(k => k.token === token); return { x: c.x + c.w / 2, y: c.y + c.h / 2 } },
    hillAt: k => (slots[k] ? { x: hill.x + slots[k].x, y: hill.y + slots[k].y - a / 2 } : null),
  }
}

// The big band at the finale: as large as everybody fits
function grid(n, w, h, max) {
  let best = { cols: 1, size: 0 }
  for (let cols = 1; cols <= n; cols++) {
    const size = Math.min(max, w / (cols + 0.24), h / Math.ceil(n / cols))   // (a line's step juts out a little)
    if (size > best.size) best = { cols, size }
  }
  return best
}

export default function ChoiceGame({ level = 1, onComplete }) {
  const questions = useMemo(() => generateQuestions('patterns', level, ROUNDS), [level])
  const paused = usePaused()
  const reduce = useReducedMotion()
  const visible = useVisible()
  const music = useMusic()
  const muted = RESPECT_MUSIC_SWITCH && !music.enabled
  const later = useLater()
  const [bursts, burst] = useBursts()
  const rootRef = useRef(null)
  const size = useSize(rootRef)

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState('enter')   // enter | play | fly | demo | cheer | leave | finale
  const [seats, setSeats] = useState([])        // what the child has put on the stools, by stool
  const [trial, setTrial] = useState(null)      // { slot, token }: a wrong one, sitting for its try-out
  const [tried, setTried] = useState([])        // wrong ones for the stool that waits
  const [misses, setMisses] = useState(0)       // … and how many
  const [picked, setPicked] = useState(null)    // the animal that is picked up (levels with two steps)
  const [away, setAway] = useState(null)        // the animal that has left its waiting place
  const [beat, setBeat] = useState(NO_BEAT)     // where the light is, and who plays
  const [solo, setSolo] = useState({ id: 0, token: null })   // an animal that plays alone (tapped)
  const [oops, setOops] = useState(0)
  const [crowd, setCrowd] = useState([])        // the big band on the hill
  const [flyers, setFlyers] = useState([])
  const [drag, setDrag] = useState(null)        // { token, x, y, near }
  const [done, setDone] = useState(0)
  const [fbeat, setFbeat] = useState({ id: 0, who: [], all: false })
  // Lumi's voice: the band waits for it (also for what is still being said
  // when the game opens)
  const [speaking, setSpeaking] = useState(true)
  useEffect(() => {
    const stop = afterNarration(() => setSpeaking(false), { maxMs: 6000 })
    const off = onNarrationChange(setSpeaking)
    return () => { stop(); off() }
  }, [])
  useEffect(() => leaveGame, [])

  const q = questions[idx]
  const L = useMemo(() => (size && q ? layout(size.w, size.h, q) : null), [size, q])
  const juice = useJuice({ hudSize: L?.star ?? 34 })
  const { hit, miss, shake } = juice   // these three never change

  // What the band and the taps work on; the state above is its picture
  const G = useRef({ q, L, phase: 'enter', seats: [], slot: 0, misses: 0, roundMisses: 0, tried: [], firstTry: 0, streak: 0, crowdN: 0, onHill: new Set(), n: 0, resume: null, ended: false }).current
  G.q = q
  G.L = L
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  const seatEls = useRef([])
  const cardEls = useRef({})
  const dragRef = useRef(null)
  const go = p => { G.phase = p; setPhase(p) }
  // A little faster while it goes well (rows in a row without a miss), slower
  // after a miss at this stool, so the row is easier to hear
  const beatS = () => 60 / clamp(bpmOf(level) + 3 * Math.min(4, G.streak) - (G.misses ? 12 : 0), 88, 124)
  const direct = level <= DIRECT_TO

  const onStep = ev => {
    const id = ++G.n
    if (G.phase === 'finale') {
      if (!ev.show) return
      setFbeat({ id, who: ev.show, all: !!ev.all })
      if (ev.all) { shake(1.2); burst(rootRef.current, 'confetti', 26) }
      return
    }
    if (ev.off) { setBeat(b => ({ ...b, id, lit: false, played: false, ghost: false })); return }
    setBeat({ id, place: ev.place, sub: ev.sub ?? 0, lit: !ev.dark, played: !!ev.inst && !ev.ghost, ghost: !!ev.ghost })
  }
  const band = useBand({ on: !paused && !speaking && visible, mute: muted, onStep })
  useEffect(() => () => clearTimeout(G.resume), [G])

  // The row as it stands, round and round. After two misses the right
  // animal plays along softly from where it waits.
  const loop = () => {
    if (G.phase !== 'play') return
    const help = G.misses >= 2 ? wantedAt(G.q, G.slot) : null
    band.play({ ...timeline(G.q, G.seats, { help, rest: G.q.kind === 'build' ? 1 : REST }), beat: beatS(), loop: true })
  }
  const dark = () => setBeat(b => ({ ...b, lit: false, played: false, ghost: false }))

  // A new round: the row comes on, then the lamp starts its way
  useEffect(() => {
    if (!q) return
    G.seats = Array(slotsOf(q)).fill(null)
    G.slot = 0
    G.misses = 0
    G.roundMisses = 0
    G.tried = []
    setSeats(G.seats)
    setTrial(null)
    setTried([])
    setMisses(0)
    setPicked(null)
    setAway(null)
    setFlyers([])
    setDrag(null)
    setBeat(NO_BEAT)
    setSolo({ id: 0, token: null })
    go('enter')
    lockPreviews()
    sayTask()
    // after any praise still being spoken, not over it
    const say = idx === 0 ? optional(SAY_START) : q.kind === 'build' && !questions.slice(0, idx).some(x => x.kind === 'build') ? optional(SAY_BUILD) : null
    const stop = say ? afterNarration(() => narrate([say])) : undefined
    later(reduce ? 150 : 600, () => { if (G.phase === 'enter') { go('play'); loop() } })
    return stop
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  const fly = f => setFlyers(l => [...l, { id: ++G.n, ...f }])
  const landed = f => { setFlyers(l => l.filter(x => x.id !== f.id)); f.then?.() }

  // An animal plays alone: the band holds its breath and comes in again
  const alone = (art, n, who) => {
    clearTimeout(G.resume)
    band.stop()
    dark()
    band.sound(instOf(art), n, 0.3)
    setSolo({ id: ++G.n, token: who })
    G.resume = setTimeout(loop, 950 + n * 300)
  }
  const audition = token => alone(artOf(G.q, token), countOf(G.q, token), token)
  // The animals on the stage and on the hill are toys, too: a tap and
  // they play (the one on the stage in the light)
  const tapSeat = i => {
    const token = seated(G.q, G.seats)[i]
    if (G.phase !== 'play' || pausedRef.current || !token) return
    alone(artOf(G.q, token), countOf(G.q, token), `seat-${i}`)
    setBeat({ id: G.n, place: i, sub: -1, lit: true, played: false, ghost: false })
  }
  const tapHill = (c, i) => {
    if (G.phase !== 'play' || pausedRef.current) return
    alone(c.art, 1, `hill-${i}`)
  }
  // While the band has its dance (and at the finale) every tap is a clap
  const clap = e => {
    if ((G.phase !== 'cheer' && G.phase !== 'finale') || pausedRef.current) return
    band.sound('clap')
    burst({ x: e.clientX, y: e.clientY }, 'stars', 4)
  }

  const finale = () => {
    go('finale')
    burst(rootRef.current, 'confetti', 24)
    setBeat(NO_BEAT)
    sfx.sparkle()
    later(reduce ? 200 : 700, () => {
      band.play({
        ...finaleTune(crowdRef.current.map(c => instOf(c.art))), beat: 60 / FINALE_BPM,
        onEnd: () => { if (!G.ended) { G.ended = true; onComplete(result(G.firstTry, questions.length)) } },
      })
    })
  }
  const crowdRef = useRef(crowd)
  crowdRef.current = crowd

  // The row is done and has had its dance: those of its animals who are
  // not in the big band yet hop up the hill. Each animal once: with every
  // row's animals the hill became a heap of the same lions and elephants.
  const leave = () => {
    go('leave')
    dark()
    const row = seated(G.q, G.seats)
    sfx.slideUp()
    for (const art of membersOf(G.q)) {
      if (G.onHill.has(art)) continue
      const to = G.L.hillAt(G.crowdN)
      if (!to) break                      // the hill is full
      G.crowdN += 1
      G.onHill.add(art)
      const place = row.findIndex(t => t && artOf(G.q, t) === art)
      fly({ art, from: G.L.seatAt(Math.max(0, place)), to, size: Math.min(G.L.s, 80), toSize: G.L.a, then: () => setCrowd(c => [...c, { id: c.length, art }]) })
    }
    setDone(idx + 1)
    later(reduce ? 350 : 1000, () => (idx + 1 < questions.length ? setIdx(idx + 1) : finale()))
  }

  const win = () => {
    if (G.roundMisses === 0) { G.firstTry += 1; G.streak += 1 } else G.streak = 0
    go('cheer')
    sayRight()
    const places = G.q.tokens.length
    later(380, () => band.play({ ...timeline(G.q, G.seats, { rest: 0.5 }), beat: 60 / cheerBpm(level, places), passes: 2, onEnd: leave }))
  }

  // The try-out is over, it did not fit: a shake of the head, and back
  const reject = () => {
    const { token, slot } = G.trial
    const place = G.q.gapAt + slot
    dark()
    setOops(n => n + 1)
    miss(seatEls.current[place])
    sayWrong()
    later(reduce ? 300 : 700, () => {
      setTrial(null)
      const back = () => {
        G.trial = null
        G.tried = [...G.tried, token]
        G.misses += 1
        G.roundMisses += 1
        setTried(G.tried)
        setMisses(G.misses)
        setAway(null)
        go('play')
        loop()
      }
      fly({ token, from: G.L.seatAt(place), to: G.L.cardAt(token), size: G.L.s, toSize: G.L.card.e, then: back })
    })
  }

  // An animal has reached the stool
  const land = token => {
    const qq = G.q, slot = G.slot, place = qq.gapAt + slot
    const el = seatEls.current[place]
    if (token === wantedAt(qq, slot)) {
      G.seats = G.seats.map((t, i) => (i === slot ? token : t))
      setSeats(G.seats)
      setAway(null)
      if (qq.kind !== 'grow') band.sound(instOf(token))
      // the star, the climbing note, the flame for a streak
      const { milestone } = hit(el)
      burst(el, milestone ? 'confetti' : 'stars', milestone ? 18 : 8)
      if (slot + 1 < slotsOf(qq)) {
        G.slot = slot + 1
        G.misses = 0
        G.tried = []
        setTried([])
        setMisses(0)
        go('play')
        G.resume = setTimeout(loop, 500)
      } else win()
      return
    }
    // Not this one. It sits down all the same, and the band plays the last
    // round of the pattern with it: how does that sound?
    G.trial = { slot, token }
    setTrial(G.trial)
    go('demo')
    if (qq.kind !== 'grow') band.sound(instOf(token))
    later(qq.kind === 'grow' ? 250 : 400, () => band.play({
      ...timeline(qq, G.seats, { trial: G.trial, from: tryFrom(qq, place), upTo: place, rest: 0.8 }), beat: beatS(), onEnd: reject,
    }))
  }

  // To the stool that waits: from where it waits, or from under the finger
  const place = (token, from) => {
    if (G.phase !== 'play' || pausedRef.current) return
    clearTimeout(G.resume)
    band.stop()
    dark()
    go('fly')
    setPicked(null)
    if (G.q.kind !== 'build') setAway(token)
    const at = G.q.gapAt + G.slot
    fly({ token, from: from ?? G.L.cardAt(token), to: G.L.seatAt(at), size: G.L.card.e, toSize: G.L.s, then: () => land(token) })
  }

  const usable = token => G.phase === 'play' && !pausedRef.current && !G.tried.includes(token)
  const tapCard = token => {
    if (!usable(token)) return
    // a tap alone at the low levels; later the second tap on the same one
    if (direct || picked === token) { place(token); return }
    audition(token)
    setPicked(token)
  }
  const tapStool = () => {
    if (G.phase !== 'play' || pausedRef.current) return
    if (picked && usable(picked)) { place(picked); return }
    // nobody is picked up: the ones that wait hop, "one of us!"
    setSolo({ id: ++G.n, token: '*' })
    sfx.flip()
  }

  // Dragging: the animal follows the finger; let go over the stool
  const toRoot = e => { const r = rootRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top } }
  const nearStool = p => {
    const at = G.q.gapAt + G.slot, c = G.L.seatAt(at), w = G.L.places[at].w
    return Math.abs(p.x - c.x) < Math.max(70, w * 0.5 + 34) && Math.abs(p.y - c.y) < Math.max(80, G.L.body * 0.5 + 44)
  }
  const cardDown = (e, token) => {
    if (!usable(token) || e.button > 0) return
    e.currentTarget.setPointerCapture?.(e.pointerId)
    dragRef.current = { token, x0: e.clientX, y0: e.clientY, moved: false }
  }
  const cardMove = e => {
    const d = dragRef.current
    if (!d) return
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 10) return
      d.moved = true
      audition(d.token)
      clearTimeout(G.resume)
      setPicked(null)
    }
    const p = toRoot(e)
    setDrag({ token: d.token, ...p, near: nearStool(p) })
  }
  const cardUp = e => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (!d.moved) { tapCard(d.token); return }
    const p = toRoot(e)
    setDrag(null)
    if (G.phase === 'play' && nearStool(p)) { place(d.token, p); return }
    // let go somewhere else: back to where it waits
    if (G.q.kind !== 'build') setAway(d.token)
    fly({ token: d.token, from: p, to: G.L.cardAt(d.token), size: G.L.card.e, then: () => { setAway(null); G.resume = setTimeout(loop, 300) } })
  }
  const cardCancel = () => { if (dragRef.current?.moved) G.resume = setTimeout(loop, 300); dragRef.current = null; setDrag(null) }

  if (!q) return null

  const grow = q.kind === 'grow'
  const row = seated(q, seats, trial)
  const want = q.gapAt + seats.findIndex(t => t == null)         // the place of the stool that waits (or before the row: none)
  const wantIdx = seats.includes(null) ? want : -1
  const wanted = wantIdx >= 0 ? wantedAt(q, wantIdx - q.gapAt) : null
  const cheer = phase === 'cheer'
  const helping = misses >= 2 && phase === 'play'
  const playing = phase === 'play'
  const pulseAt = (placeI, k = 0) => Math.max(beat.place === placeI && beat.sub === k && beat.played ? beat.id : 0, solo.token === `seat-${placeI}` ? solo.id : 0)
  const seatDelay = (placeI, k) => (solo.token === `seat-${placeI}` && solo.id >= beat.id ? k * 0.3 : 0)
  // an animal that waits plays when it is tapped (alone), and after two
  // misses the right one plays along from where it waits
  const soloPulse = (token, k) => (solo.token === token || (solo.token === '*' && k === 0) ? solo.id : 0)
  const helpPulse = (token, k) => (helping && beat.ghost && token === wanted && beat.sub === k ? beat.id : 0)
  const cardPulse = (token, k = 0) => Math.max(soloPulse(token, k), helpPulse(token, k))
  const cardDelay = (token, k) => (solo.token === token && soloPulse(token, k) >= helpPulse(token, k) ? k * 0.3 : 0)

  // The hand shows the move on the first row of a level and after two
  // misses; it never points at a wrong animal
  const showMove = playing && wanted && ((idx === 0 && G.roundMisses === 0) || misses >= 2)
  const handFrom = showMove ? { get current() { return cardEls.current[wanted] } } : null
  const handTo = { get current() { return seatEls.current[wantIdx] } }

  const band2 = phase === 'finale' && L ? grid(Math.max(1, crowd.length), size.w - PAD * 4, size.h - L.topH - PAD * 3, 132) : null

  return (
    <div ref={el => { rootRef.current = el; juice.stage.current = el }} onPointerDown={clap} data-phase={phase} data-round={idx} data-kind={q.kind} data-light={beat.lit ? beat.place : -1}
      style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'none' }}>
      {L && (
        <>
          {/* the rounds of the level, and the stars */}
          <div style={{
            position: 'absolute', left: PAD, top: 4, height: L.topH - 6, boxSizing: 'border-box', padding: '1px 6px 0',
            width: size.w - PAD * 2 - L.hudW - 8,
            background: 'rgba(255,253,247,0.9)', border: `3px solid ${INK}`, borderRadius: 999, boxShadow: '0 3px 0 rgba(42,27,61,0.3)',
          }}>
            <RoundTrail total={questions.length} done={done} walker="🎵" goal="🎉" size={L.trail} />
          </div>
          <div style={{ position: 'absolute', right: PAD, top: 4, height: L.topH - 6, display: 'flex', alignItems: 'center' }}>{juice.hud}</div>

          <motion.div initial={false} animate={{ opacity: phase === 'finale' ? 0 : 1 }} transition={{ duration: 0.4 }}>
            <Hill box={L.hill} a={L.a} crowd={crowd} slots={L.slots} dance={cheer} reduce={reduce} peak={L.short ? 0.3 : 0.38}
              pulseOf={i => (solo.token === `hill-${i}` ? solo.id : 0)} onTap={playing ? tapHill : undefined} />
          </motion.div>

          {/* the stage: the rail with its lamp, the row on its stools */}
          {phase !== 'finale' && (
            <motion.div key={idx} role="list" aria-label="Die Band"
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18 }}
              animate={{ opacity: phase === 'leave' ? 0 : 1, y: 0 }}
              transition={{ duration: phase === 'leave' ? 0.5 : 0.35, delay: phase === 'leave' ? 0.25 : 0 }}
              style={{ position: 'absolute', left: L.stage.x, top: L.stage.y, width: L.stage.w, height: L.stage.h }}>
              {L.lines.map((_, li) => {
                const top = li * (L.lineH + 8)
                return (
                  <div key={li} aria-hidden="true" style={{ position: 'absolute', left: 0, top, width: '100%', height: L.lineH }}>
                    {/* the back of the stage, the curtains and the floor */}
                    <div style={{ position: 'absolute', left: 3, right: 3, top: 4, bottom: FLOOR - 2, background: 'linear-gradient(rgba(27,20,70,0.72), rgba(59,47,122,0.5))', borderRadius: 4 }} />
                    <div style={{ position: 'absolute', left: 0, top: 4, bottom: FLOOR - 3, width: POST, background: 'repeating-linear-gradient(90deg, #d9473f 0 5px, #b5322f 5px 7px)', border: `3px solid ${INK}`, borderRadius: '3px 3px 8px 3px', boxSizing: 'border-box' }} />
                    <div style={{ position: 'absolute', right: 0, top: 4, bottom: FLOOR - 3, width: POST, background: 'repeating-linear-gradient(90deg, #d9473f 0 5px, #b5322f 5px 7px)', border: `3px solid ${INK}`, borderRadius: '3px 3px 3px 8px', boxSizing: 'border-box' }} />
                    <div style={{ position: 'absolute', left: -3, right: -3, top: 0, height: 12, background: 'repeating-linear-gradient(90deg, #e8594c 0 16px, #c93f38 16px 18px)', border: `3px solid ${INK}`, borderRadius: '6px 6px 9px 9px', boxSizing: 'border-box' }} />
                    <div style={{ position: 'absolute', left: -8, right: -8, bottom: 0, height: FLOOR, background: 'repeating-linear-gradient(90deg, #c98a52 0 46px, #a8683a 46px 48px)', border: `3px solid ${INK}`, borderRadius: 5, boxSizing: 'border-box', boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.25), inset 0 -5px 0 rgba(0,0,0,0.18), 0 4px 0 rgba(42,27,61,0.3)' }} />
                  </div>
                )
              })}
              {beat.place >= 0 && L.places[beat.place] && (
                <Lamp x={L.places[beat.place].x} top={L.places[beat.place].top + 9} w={Math.max(L.places[beat.place].w * 1.06, 44)} h={L.lineH - FLOOR - 5} maxHead={(L.lamp - 9) / 0.9} on={beat.lit} reduce={reduce} />
              )}
              {q.tokens.map((_, i) => {
                const p = L.places[i], token = row[i]
                const isWant = i === wantIdx && !trial
                const isTrial = !!trial && slotAt(q, i) === trial.slot
                const open = isWant && playing
                const seatH = L.body
                const inner = token
                  ? (grow
                    ? <Group q={q} token={token} e={L.s} pulseOf={k => pulseAt(i, k)} delayOf={k => seatDelay(i, k)} dance={cheer} sour={isTrial} reduce={reduce} still />
                    : <Performer art={token} size={L.s} pulse={pulseAt(i)} dance={cheer} phase={i % 2} oops={isTrial ? oops : 0} sour={isTrial} reduce={reduce} still />)
                  : null
                const content = (
                  <>
                    <div ref={el => { seatEls.current[i] = el }} onPointerDown={token && playing ? () => tapSeat(i) : undefined}
                      style={{ width: p.w, height: seatH, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', marginBottom: grow ? -2 : -L.s * 0.1, position: 'relative', zIndex: 1, cursor: token && playing ? 'pointer' : undefined }}>
                      {grow && token && isTrial
                        ? <motion.div key={oops} animate={oops && !reduce ? { rotate: [0, -8, 7, -5, 3, 0] } : {}} transition={{ duration: 0.7 }}>{inner}</motion.div>
                        : inner}
                    </div>
                    {grow && token && countOf(q, token) > 2 && (
                      <div aria-hidden="true" style={{ position: 'absolute', left: 10, right: 10, bottom: L.stool - 3, height: L.s * 0.8, boxSizing: 'border-box', background: '#b3723f', border: `3px solid ${INK}`, borderRadius: '8px 8px 0 0', boxShadow: 'inset 0 4px 0 rgba(255,255,255,0.25)' }} />
                    )}
                    <div className={open ? `tb-want${picked || drag ? ' tb-want--now' : ''}` : undefined} style={{ position: 'relative', display: 'flex', justifyContent: 'center', transformOrigin: '50% 100%' }}>
                      {isWant && <span aria-hidden="true" className="tb-glow" style={{ position: 'absolute', left: '-18%', right: '-18%', top: -L.stool * 0.5, bottom: -L.stool * 0.25, borderRadius: '50%', background: 'radial-gradient(closest-side, rgba(255,211,77,0.9), rgba(255,211,77,0))' }} />}
                      {grow
                        ? <Bench w={p.w - 6} h={L.stool} want={isWant} />
                        : <Stool w={Math.min(p.w, L.s * 0.72)} h={L.stool} want={isWant} dim={!token && !isWant} />}
                    </div>
                  </>
                )
                const box = { position: 'absolute', left: p.x - p.w / 2, top: p.top + L.lamp, width: p.w, height: L.body + L.stool, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end' }
                return isWant
                  ? (
                    <div key={i} role="listitem" style={box}>
                      {/* the stool that waits takes the tap and the drop; its hit box is bigger than it looks */}
                      <button type="button" onClick={tapStool} aria-label="Freier Hocker" data-stool="want" data-want={wanted}
                        style={{
                          all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'absolute', left: '50%', bottom: -FLOOR, width: Math.max(72, p.w + 8), marginLeft: -Math.max(72, p.w + 8) / 2,
                          height: L.body + L.stool + L.lamp * 0.5 + FLOOR, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: FLOOR,
                          borderRadius: 16, outline: drag?.near ? '4px dashed #ffd34d' : undefined, background: drag?.near ? 'rgba(255,211,77,0.25)' : undefined,
                        }}>
                        {content}
                      </button>
                    </div>
                  )
                  : <div key={i} role="listitem" aria-label={token ? (grow ? `${countOf(q, token)} ${nameOf(q.sym)}` : nameOf(token)) : 'Leerer Hocker'} style={box}>{content}</div>
              })}
            </motion.div>
          )}

          {/* the animals that wait below the stage */}
          {phase !== 'finale' && L.cards.map((c, ci) => {
            const token = c.token
            const off = tried.includes(token)
            const gone = q.kind !== 'build' && (away === token || drag?.token === token || seats.includes(token))
            const isPicked = picked === token && playing
            const help = helping && token === wanted
            const state = isPicked || help ? 'selected' : undefined
            return (
              <motion.div key={`${idx}-${token}`}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 30 }} animate={{ opacity: cheer || phase === 'leave' ? 0 : 1, y: isPicked ? -8 : 0 }}
                transition={{ duration: 0.3, delay: phase === 'enter' ? 0.15 + ci * 0.06 : 0 }}
                style={{ position: 'absolute', left: c.x, top: c.y, width: c.w, height: c.h }}>
                <button type="button" ref={el => { cardEls.current[token] = el }}
                  aria-label={grow ? `${countOf(q, token)} ${nameOf(q.sym)}` : nameOf(token)} aria-pressed={isPicked} disabled={off}
                  data-card={token} data-right={token === wanted ? 1 : undefined}
                  onPointerDown={e => cardDown(e, token)} onPointerMove={cardMove} onPointerUp={cardUp} onPointerCancel={cardCancel}
                  onClick={e => { if (e.detail === 0) tapCard(token) }}
                  style={{
                    all: 'unset', boxSizing: 'border-box', width: '100%', height: '100%', cursor: off ? 'default' : 'grab', touchAction: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...pxCard(state), borderRadius: 18,
                    boxShadow: help ? '0 0 0 5px #ffc93c, 0 5px 0 rgba(42,27,61,0.35)' : isPicked ? '0 0 0 4px #ffc93c, 0 9px 0 rgba(42,27,61,0.3)' : pxCard().boxShadow,
                    opacity: off ? 0.45 : 1, filter: off ? 'grayscale(0.8)' : undefined, transition: 'opacity .2s, filter .2s',
                  }}>
                  <div style={{ visibility: gone ? 'hidden' : 'visible', display: 'flex' }}>
                    {grow
                      ? <Group q={q} token={token} e={L.card.e} pulseOf={k => cardPulse(token, k)} delayOf={k => cardDelay(token, k)} reduce={reduce} still={off} />
                      : <Performer art={token} size={L.card.e} pulse={cardPulse(token)} reduce={reduce} still={off} />}
                  </div>
                </button>
              </motion.div>
            )
          })}

          {/* under the finger */}
          {drag && (
            <div aria-hidden="true" style={{ position: 'absolute', left: drag.x, top: drag.y, width: 0, height: 0, zIndex: 40, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'scale(1.12)', filter: 'drop-shadow(0 8px 4px rgba(42,27,61,0.35))' }}>
              {grow ? <Group q={q} token={drag.token} e={L.card.e} reduce={reduce} still /> : <Performer art={drag.token} size={L.card.e} reduce={reduce} still />}
            </div>
          )}
          {flyers.map(f => (
            <Flyer key={f.id} from={f.from} to={f.to} size={f.size} toSize={f.toSize} reduce={reduce} onDone={() => landed(f)}>
              {f.art
                ? <Performer art={f.art} size={f.size} reduce={reduce} still />
                : grow ? <Group q={q} token={f.token} e={f.size} reduce={reduce} still /> : <Performer art={f.token} size={f.size} reduce={reduce} still />}
            </Flyer>
          ))}

          {/* the finale: the whole big band plays together */}
          {phase === 'finale' && band2 && (
            <div role="img" aria-label="Die große Band spielt" style={{ position: 'absolute', left: PAD * 2, right: PAD * 2, top: L.topH + PAD, bottom: PAD * 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {Array.from({ length: Math.ceil(crowd.length / band2.cols) }, (_, r) => crowd.slice(r * band2.cols, (r + 1) * band2.cols)).map((line, r) => (
                  <div key={r} style={{ position: 'relative', display: 'flex', justifyContent: 'center', height: band2.size, padding: `0 ${band2.size * 0.12}px` }}>
                    {/* the step this line stands on */}
                    <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: Math.max(10, band2.size * 0.13), boxSizing: 'border-box', background: 'repeating-linear-gradient(90deg, #c98a52 0 46px, #a8683a 46px 48px)', border: `3px solid ${INK}`, borderRadius: 5, boxShadow: 'inset 0 3px 0 rgba(255,255,255,0.25), 0 4px 0 rgba(42,27,61,0.3)' }} />
                    {line.map((c, k) => (
                      <motion.div key={c.id} initial={reduce ? { opacity: 0 } : { scale: 0, y: -60 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 16, delay: reduce ? 0 : (r * band2.cols + k) * 0.03 }}
                        style={{ position: 'relative', width: band2.size, height: band2.size, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', paddingBottom: band2.size * 0.06, boxSizing: 'border-box' }}>
                        <Performer art={c.art} size={band2.size * 0.8} pulse={fbeat.all || fbeat.who.includes(instOf(c.art)) ? fbeat.id : 0} dance phase={(r + k) % 2} reduce={reduce} />
                      </motion.div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* the app's music is off, so the band is silent: a tap brings the sound back */}
          {muted && phase !== 'finale' && (
            <button type="button" className="tb-sound" onClick={() => music.setEnabled(true)} aria-label="Musik einschalten"
              style={{ all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'absolute', left: L.sound.x, top: L.sound.y, width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ width: 52, height: 52, borderRadius: '50%', background: '#fffdf7', border: `3px solid ${INK}`, boxShadow: '0 4px 0 rgba(42,27,61,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden="true">
                  <path d="M4 12 H10 L17 6 V26 L10 20 H4 Z" fill="#6b3fd6" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
                  <path d="M21 12 L29 20 M29 12 L21 20" stroke="#e8594c" strokeWidth="3.5" strokeLinecap="round" />
                </svg>
              </span>
            </button>
          )}
        </>
      )}
      <HintHand key={`${idx}-${misses}`} from={handFrom} to={handTo} active={!!showMove && !drag} delay={misses >= 2 ? 1600 : level <= DIRECT_TO ? 2800 : 5000} />
      {bursts}
      {juice.layer}
    </div>
  )
}
