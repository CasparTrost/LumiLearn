import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, lockPreviews, leaveGame } from '../narrator.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Critter, Art, HintHand, useBursts, useJuice, useMood } from '../components/play/index.js'
import { useLater } from './zahlen/stage.jsx'
import { rec, wordRec } from './buchstaben/voice.js'
import { levelConfig, findsIn, bushesFor, makeShuffle } from './huetchen/plan.js'
import { layoutFor, thingY } from './huetchen/layout.js'
import { Bush, Stump, Bubble, Speaker, SwapArrows, Rings } from './huetchen/parts.jsx'

/**
 * Hörabenteuer — "Hütchenspiel im Gebüsch": understanding a spoken word,
 * remembering where it went, following it with the eyes.
 *
 * Things stand on top of a row of bushes that all look the same. One after
 * the other each hops into its bush, saying its word as it goes ("Tiger."
 * hop, the bush rustles, leaves fly). Then the bushes swap places, two at
 * a time, sliding past each other in an arc (the one behind goes up and
 * gets smaller), with a whoosh, at a speed a child can follow. A drum roll,
 * and Lumi calls one of them by its name, without a picture. The child taps
 * the bush it is in now.
 *   • Right: it jumps out laughing, a star flies to the counter, and the
 *     thing flies up to the row of finds at the top and sits down in its
 *     ring; its bush is empty now and shrinks away. From level 5 Lumi then
 *     calls a second one from the same bushes, without a new shuffle.
 *   • Wrong: the one that really is in that bush pops out, shakes its head
 *     and says its own name, so the miss teaches a word too, and goes back
 *     in. Lumi's bubble now shows the picture of the one she wants, and she
 *     says its name again. After two misses that bush wiggles and the
 *     wanted thing peeks out of it; the hand points there.
 *   • At the end of a shuffle the others hop out and show where they were.
 * Now and then, while the child thinks, a squirrel pokes its head out from
 * behind a bush and sticks out its tongue. Only a joke: it is never asked for.
 *
 * Levels (huetchen/plan.js): three bushes and no swap, then one slow swap,
 * four bushes and two swaps, three swaps and two finds per shuffle, words
 * that sound alike side by side (Maus, Haus, Mais), five bushes and four
 * swaps; levels 8 to 10 are for reading: Lumi holds up a sign with the
 * word instead of saying it (a tap on the sign reads it; after a miss it
 * is read by itself), at the end with words that look alike (Hose, Rose).
 * The swaps get a little quicker when a shuffle goes without a miss and
 * slower after one. Score: the finds at the first tap.
 *
 * Why: hearing a word and finding its picture is how word meaning is
 * tested and trained (Peabody Picture Vocabulary method); holding it in
 * mind while the eyes track the bushes trains working memory and visual
 * tracking, and the sound-alike sets need the whole word, not a guess
 * from its meaning (phonological awareness, National Reading Panel 2000).
 */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v))

/** A drum roll that swells, and a cymbal: now Lumi says who she is looking for. */
function drumRoll(ms) {
  const t0 = sfx.bandClock()
  if (t0 == null) return
  const n = Math.max(6, Math.round(ms / 60))
  for (let k = 0; k < n; k++) sfx.band('drum', t0 + k * 0.06, 0.25 + (0.55 * k) / n)
  sfx.band('cymbal', t0 + n * 0.06 + 0.02, 0.8)
}

export default function ListenGame({ level = 1, onComplete }) {
  const cfg = useMemo(() => levelConfig(level), [level])
  const total = findsIn(cfg)
  const paused = usePaused()
  const reduce = !!useReducedMotion()
  const { later, afterSpeech } = useLater()
  const juice = useJuice({ hudSize: 30 })
  const { hit, miss } = juice
  const [bursts, burst] = useBursts()
  const [mood, setMood] = useMood()

  const fieldRef = useRef(null)
  const [size, setSize] = useState(null)
  const [n, setN] = useState(null)              // bushes in this shuffle
  const L = useMemo(() => (size ? layoutFor(size.w, size.h, n ?? bushesFor(cfg, size.w), total) : null), [size, n, cfg, total])

  const [phase, setPhase] = useState('start')   // start | drop | hide | shuffle | drum | find | oops | found | show | finale
  const [bushes, setBushes] = useState([])
  const [target, setTarget] = useState(null)
  const [pic, setPic] = useState(false)         // the bubble shows the wanted one's picture too
  const [misses, setMisses] = useState(0)       // for this call
  const [found, setFound] = useState([])        // the row at the top
  const [flyers, setFlyers] = useState([])
  const [arrows, setArrows] = useState(null)    // reduced motion: which two swap next
  const [cheeky, setCheeky] = useState({ id: null, n: 0 })
  const [signPulse, setSignPulse] = useState(0)

  // What the timers work on; the state above is its picture
  const g = useRef({
    k: 0, sh: null, call: 0, misses: 0, firstTry: 0, finds: 0, pace: 1, missedHere: false,
    used: new Set(), called: new Set(), bushes: [], phase: 'start', target: null, done: false, started: false,
  }).current
  const live = useRef(null)
  live.current = { L, reduce }

  const speakerRef = useRef(null)
  const gapRef = useRef(null)
  const helpRef = useRef(null)
  const ringEls = useRef([])
  const bushEls = useRef({})

  useEffect(() => { lockPreviews(); return () => leaveGame() }, [])

  useLayoutEffect(() => {
    const el = fieldRef.current
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      if (w && h) setSize(s => (s && s.w === w && s.h === h ? s : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const go = p => { g.phase = p; setPhase(p) }
  const put = fn => { g.bushes = fn(g.bushes); setBushes(g.bushes) }
  const patch = (id, p) => put(bs => bs.map(b => (b.id === id ? { ...b, ...(typeof p === 'function' ? p(b) : p) } : b)))
  const rustle = (id, big = false) => {
    patch(id, b => ({ rustle: b.rustle + 1, rustleBig: big }))
    sfx.band('maraca', 0, big ? 1 : 0.75)
  }
  const atSlot = s => g.bushes.find(b => b.slot === s)

  // ── One shuffle ────────────────────────────────────────────────────────

  const startShuffle = k => {
    g.k = k; g.call = 0; g.missedHere = false
    const nn = bushesFor(cfg, fieldRef.current?.clientWidth ?? 1024)
    const sh = makeShuffle(cfg, nn, { used: g.used, called: g.called })
    sh.things.forEach(t => g.used.add(t.word))
    g.sh = sh
    g.target = null
    setN(nn)
    // the same bushes stay where they stand; each gets a new thing on top
    const old = g.bushes.length === nn ? g.bushes : Array.from({ length: nn }, (_, i) => ({ id: i, slot: i, rustle: 0 }))
    put(() => old.map(b => {
      const t = sh.things[b.slot]
      return { ...b, tid: `${k}-${b.slot}`, word: t.word, emoji: t.emoji, thing: 'top', gone: false, help: false, swap: null }
    }))
    setTarget(null); setPic(false); setArrows(null)
    go('drop')
    lockPreviews()
    sh.things.forEach((_, i) => later(150 + i * 110, () => sfx.pop()))
    // the very first time: "Pass gut auf, wo sie sich verstecken!" (once recorded)
    const intro = k === 0 ? rec('hoeren/pass-auf') : null
    if (intro) { narrate([intro]); afterSpeech(() => hideNext(0), 900) }
    else later(950 + nn * 110, () => hideNext(0))
  }

  // one after the other they say their word and hop into their bush
  const hideNext = i => {
    const sh = g.sh
    if (i >= sh.things.length) { later(450, () => swapNext(0)); return }
    go('hide')
    const b = atSlot(i)
    narrate([wordRec(b.word)])
    later(reduce ? 150 : 380, () => {
      patch(b.id, { thing: 'in' })
      later(reduce ? 80 : 330, () => rustle(b.id))
    })
    afterSpeech(() => hideNext(i + 1), cfg.gap)
  }

  // two bushes swap places: one passes behind (up and smaller), one in front
  const swapNext = j => {
    const sh = g.sh
    if (j >= sh.swaps.length) {
      put(bs => bs.map(b => ({ ...b, swap: null })))
      setArrows(null)
      later(sh.swaps.length ? 300 : 100, roll)
      return
    }
    go('shuffle')
    const [a, c] = sh.swaps[j]
    const ms = reduce ? 180 : Math.round(cfg.ms * g.pace)
    const behind = Math.random() < 0.5 ? a : c
    const move = () => {
      put(bs => bs.map(b => (b.slot === a ? { ...b, slot: c, swap: { from: a, to: c, ms, role: a === behind ? 'back' : 'front' } }
        : b.slot === c ? { ...b, slot: a, swap: { from: c, to: a, ms, role: c === behind ? 'back' : 'front' } }
        : { ...b, swap: null })))
      sfx.whoosh()
    }
    if (reduce) {
      // crossing arrows show which two, then a quick slide
      setArrows({ a, b: c, j })
      later(800, () => { move(); setArrows(null); later(ms + 350, () => swapNext(j + 1)) })
    } else {
      move()
      later(ms + 170, () => swapNext(j + 1))
    }
  }

  const roll = () => {
    go('drum')
    drumRoll(reduce ? 500 : 850)
    later(reduce ? 600 : 1000, call)
  }

  // Lumi calls one by its name (in the reading levels: holds up its word)
  const call = () => {
    const t = g.sh.calls[g.call]
    g.called.add(t.word)
    g.target = t
    g.misses = 0
    setMisses(0); setPic(false); setTarget(t)
    go('find')
    lockPreviews()
    if (cfg.read) { if (g.k === 0 && g.call === 0) narrate([rec('hoeren/lies')]) }
    else narrate([wordRec(t.word)])
  }

  const say = () => {
    if (!g.target) return
    narrate([wordRec(g.target.word)])
    setSignPulse(p => p + 1)
  }

  // ── Taps ───────────────────────────────────────────────────────────────

  const tap = (b, el) => {
    if (g.phase === 'finale') { sfx.giggle(); return }
    const cur = g.bushes.find(x => x.id === b.id)
    if (g.phase !== 'find' || !cur || cur.gone || !g.target) return
    if (cur.word === g.target.word) foundIt(cur, el)
    else wrongOne(cur, el)
  }

  const foundIt = (b, el) => {
    go('found')
    if (g.misses === 0) g.firstTry++
    const { milestone } = hit(el)
    sfx.giggle()
    put(bs => bs.map(x => (x.id === b.id ? { ...x, thing: 'out', help: false } : { ...x, help: false, thing: x.thing === 'help' ? 'in' : x.thing })))
    rustle(b.id, true)
    burst(el, milestone ? 'confetti' : 'stars', milestone ? 16 : 9)
    setMood(milestone ? 'dance' : 'happy', 1500)
    setPic(true)
    sayRight()
    const k = g.finds++
    g.call++
    // off it flies to its ring at the top, and its empty bush shrinks away
    later(reduce ? 400 : 950, () => {
      const { L } = live.current
      const Y = thingY(L.bh, L.T)
      const from = { x: L.slots[b.slot], y: L.ground - L.bh + Y.top - L.T * 0.12 + L.T / 2 }
      setFlyers(f => [...f, { id: `${b.tid}`, emoji: b.emoji, from, k }])
      patch(b.id, { thing: 'gone', gone: true })
      sfx.slideUp()
    })
    later(reduce ? 1300 : 2100, () => afterSpeech(next, 0))
  }

  const landed = f => {
    setFlyers(l => l.filter(x => x.id !== f.id))
    setFound(fs => { const a = [...fs]; a[f.k] = f.emoji; return a })
    sfx.pop()
  }

  const next = () => {
    if (g.call < g.sh.calls.length) roll()
    else showAll()
  }

  const wrongOne = (b, el) => {
    g.misses++
    g.missedHere = true
    setMisses(g.misses)
    go('oops')
    miss(el)
    setMood('oops', 1000)
    patch(b.id, { thing: 'peek' })
    rustle(b.id)
    sfx.boing()
    // the one in there says who it is
    narrate([wordRec(b.word)])
    const t = g.target
    afterSpeech(() => {
      patch(b.id, { thing: 'in' })
      later(reduce ? 50 : 300, () => rustle(b.id))
      if (!cfg.read) setPic(true)
      go('find')
      if (g.misses >= 2) put(bs => bs.map(x => (x.word === t.word && !x.gone ? { ...x, help: true, thing: 'help' } : x)))
      // "Hm, noch nicht." and the wanted word again (read aloud in the reading levels)
      sayWrong(null, { onEnd: () => later(150, () => { if (g.target === t && g.phase === 'find') say() }) })
    }, 1150)
  }

  // the end of a shuffle: the others hop out, here we were!
  const showAll = () => {
    go('show')
    const rest = g.bushes.filter(b => !b.gone)
    rest.forEach((b, i) => later(i * 130, () => { patch(b.id, { thing: 'wave' }); rustle(b.id) }))
    g.pace = g.missedHere ? Math.min(1.35, g.pace + 0.12) : Math.max(0.8, g.pace - 0.05)
    later(1500 + rest.length * 130, () => {
      put(bs => bs.map(b => ({ ...b, thing: b.gone ? 'gone' : 'leave' })))
      if (rest.length) sfx.slideUp()
      later(600, () => (g.k + 1 < cfg.shuffles ? startShuffle(g.k + 1) : finale()))
    })
  }

  const finale = () => {
    go('finale')
    g.target = null
    setTarget(null)
    setMood('dance', 3400)
    sfx.tada()
    put(bs => bs.map(b => ({ ...b, gone: false, thing: 'gone', help: false })))
    later(200, () => g.bushes.forEach(b => rustle(b.id, true)))
    later(300, () => burst(ringEls.current[Math.floor(total / 2)], 'confetti', 26))
    later(1300, () => { sfx.sparkle(); burst(bushEls.current[g.bushes[0]?.id], 'stars', 12) })
    later(3000, () => {
      if (g.done) return
      g.done = true
      sfx.complete()
      onComplete(result(g.firstTry, total))
    })
  }

  // the first shuffle, once the field has its size
  useEffect(() => {
    if (!size || g.started) return
    g.started = true
    later(400, () => startShuffle(0))
  }, [size]) // eslint-disable-line react-hooks/exhaustive-deps

  // the squirrel: while the child thinks, once per call
  useEffect(() => {
    if (phase !== 'find' || paused || reduce) return
    const t = setTimeout(() => {
      const alive = g.bushes.filter(b => !b.gone)
      if (alive.length) setCheeky(c => ({ id: alive[Math.floor(Math.random() * alive.length)].id, n: c.n + 1 }))
    }, 5000 + Math.random() * 3000)
    return () => clearTimeout(t)
  }, [phase, paused, reduce, target, g])

  // ── The picture ────────────────────────────────────────────────────────

  const calling = !!target && (phase === 'find' || phase === 'oops' || phase === 'found')
  const looking = phase === 'drop' || phase === 'hide' || phase === 'shuffle'
  const helpBush = bushes.find(b => b.help && !b.gone)
  helpRef.current = helpBush ? bushEls.current[helpBush.id] ?? null : null
  const firstCall = g.k === 0 && g.call === 0

  let bubble = null
  if (L) {
    const bs = L.bubble.size
    if (looking) {
      bubble = (
        <Bubble L={L} k="look">
          <motion.div animate={reduce ? {} : { scaleY: [1, 1, 0.15, 1, 1] }} transition={{ duration: 2.6, times: [0, 0.8, 0.85, 0.9, 1], repeat: Infinity }}>
            <Art art="👀" size={bs * 0.62} />
          </motion.div>
        </Bubble>
      )
    } else if (phase === 'drum') {
      bubble = (
        <Bubble L={L} k="drum">
          <motion.div animate={reduce ? {} : { y: [0, -4, 0], rotate: [0, -6, 6, 0] }} transition={{ duration: 0.18, repeat: Infinity }}>
            <Art art="🥁" size={bs * 0.62} />
          </motion.div>
        </Bubble>
      )
    } else if (calling && cfg.read) {
      // the word as big as it fits, next to its picture once it is found
      const picS = clamp(bs * 0.55, 48, 80)
      const fs = Math.max(20, Math.min(clamp(bs * 0.36, 28, 50), (L.bubble.maxW - 52 - (phase === 'found' ? picS + 8 : 0)) / (0.64 * target.word.length + 0.5)))
      bubble = (
        <Bubble L={L} k={`sign-${target.word}`} wood>
          <motion.button type="button" ref={speakerRef} onClick={say} aria-label={`${target.word}. Vorlesen`}
            key={signPulse} initial={signPulse && !reduce ? { scale: 1.12 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 10 }}
            style={{
              all: 'unset', cursor: 'pointer', minHeight: 64, minWidth: 64, boxSizing: 'border-box', padding: '4px 14px',
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff3d6', border: '3px solid #2a1b3d', borderRadius: 10,
              fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: fs, color: '#2a1b3d', letterSpacing: 1, whiteSpace: 'nowrap',
            }}>{target.word}</motion.button>
          {phase === 'found' && <Art art={target.emoji} size={picS} />}
        </Bubble>
      )
    } else if (calling) {
      // the loudspeaker and the picture beside it, as big as the bubble allows
      const sp = clamp(bs * 0.6, 64, 84)
      const picC = Math.max(44, Math.min(clamp(bs * 0.62, 56, 96), L.bubble.maxW - 24 - 8 - sp))
      bubble = (
        <Bubble L={L} k="call">
          <Speaker size={sp} onTap={say} pulse={phase === 'find' && !reduce} btnRef={speakerRef} />
          {pic && (
            <motion.div key={target.word} initial={reduce ? false : { scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 360, damping: 13 }}>
              <Art art={target.emoji} size={picC} />
            </motion.div>
          )}
        </Bubble>
      )
    }
  }

  // the hand taps between two bushes (tap a bush!) the first time; later it
  // shows the loudspeaker or the sign; after two misses, the right bush
  const gap = L && bushes.length > 1 ? (() => {
    const alive = bushes.filter(b => !b.gone).map(b => b.slot).sort((a, b) => a - b)
    const s = alive[Math.floor((alive.length - 1) / 2)]
    return s != null && L.slots[s + 1] != null ? { x: (L.slots[s] + L.slots[s + 1]) / 2, y: L.ground - L.bh * 0.45 } : null
  })() : null

  return (
    <div ref={juice.stage} data-game="huetchen" data-phase={phase} data-target={target?.word ?? ''} data-misses={misses}
      style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <div ref={fieldRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
        {L && (
          <>
            {/* the row of finds, and the stars */}
            <div aria-hidden="true" style={{
              position: 'absolute', left: L.strip.x, top: L.strip.y, width: L.strip.w, height: L.strip.h, boxSizing: 'border-box',
              background: 'rgba(255,253,247,0.55)', border: '3px solid rgba(42,27,61,0.25)', borderRadius: L.strip.h / 2,
            }} />
            <Rings L={L} found={found} finale={phase === 'finale'} reduce={reduce} setEl={(k, el) => { ringEls.current[k] = el }} />
            <div style={{ position: 'absolute', right: L.strip.x + 4, top: L.strip.y + L.strip.h / 2, transform: 'translateY(-50%)', zIndex: 4 }}>{juice.hud}</div>

            <Stump s={L.stump} />
            <div style={{ position: 'absolute', left: L.lumi.x, top: L.lumi.y, zIndex: 6 }}>
              <Critter art="lumi" size={L.lumi.s} mood={mood} talks label="Lumi" shadow={!L.stump} />
            </div>
            {bubble}

            {bushes.map(b => (
              <Bush key={b.id} L={L} b={b} reduce={reduce}
                mode={phase === 'drum' ? 'drum' : phase === 'find' ? 'find' : 'still'}
                cheeky={cheeky.id === b.id && phase === 'find' ? cheeky.n : 0}
                setEl={el => { bushEls.current[b.id] = el }}
                onTap={tap} />
            ))}
            {arrows && <SwapArrows L={L} a={arrows.a} b={arrows.b} />}
            {gap && <span ref={gapRef} aria-hidden="true" style={{ position: 'absolute', left: gap.x, top: gap.y, width: 2, height: 2 }} />}

            {/* found things on their way to the row */}
            {flyers.map(f => {
              const to = L.rings[f.k]
              const s = L.T, x0 = f.from.x - s / 2, y0 = f.from.y - s / 2, x1 = to.x - s / 2, y1 = to.y - s / 2
              return (
                <motion.div key={f.id} aria-hidden="true"
                  initial={{ x: x0, y: y0, scale: 1.15, rotate: 0 }}
                  animate={{ x: [x0, (x0 + x1) / 2, x1], y: [y0, Math.min(y0, y1) - 50, y1], scale: [1.15, 1, (L.ring * 0.82) / s], rotate: [0, -20, 0] }}
                  transition={{ duration: reduce ? 0.01 : 0.8, times: [0, 0.45, 1], ease: 'easeInOut' }}
                  onAnimationComplete={() => landed(f)}
                  style={{ position: 'absolute', left: 0, top: 0, width: s, height: s, zIndex: 9, pointerEvents: 'none' }}>
                  <Art art={f.emoji} size={s} />
                </motion.div>
              )
            })}
          </>
        )}
      </div>

      <HintHand key={`gap-${g.k}-${g.call}`} to={gapRef} active={phase === 'find' && firstCall && misses === 0} delay={level <= 2 ? 3500 : 6000} />
      <HintHand key={`say-${g.k}-${g.call}`} to={speakerRef} active={phase === 'find' && !firstCall && misses === 0} delay={8000} />
      <HintHand key={`help-${g.k}-${g.call}`} to={helpRef} active={phase === 'find' && misses >= 2 && !!helpBush} delay={600} />
      {bursts}
      {juice.layer}
    </div>
  )
}
