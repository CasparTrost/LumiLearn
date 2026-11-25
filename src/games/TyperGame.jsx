import { memo, useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react'
import { motion, useMotionValue } from 'framer-motion'
import { sfx } from '../sfx.js'
import { afterNarration, onNarrationChange } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { usePaused } from '../lib/pause.js'
import { Art, Wish, RoundTrail, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { Cauldron, WitchLumi, Puff, Alive, Hill, useFliers } from './kessel/Cauldron.jsx'
import { ForestBack, Leaf, FallingLeaf, Raven, LostFeather, Hedgehog } from './kessel/Forest.jsx'
import { WORDS, ANLAUT, ROWS, ALPHABET, nameOf, wordKey, pickWords, shuffle, moveOf } from './kessel/words.js'
import { voice, KEY } from './woerter/voice.js'
import { LINES, line } from '../lib/lumiLines.js'
import { INK, pxCard } from './px.js'

/**
 * Buchstabenwald: "Zauberkessel im Wald"
 * In a clearing of the night forest Lumi, in a witch's hat, wants to
 * conjure a thing (the picture in the speech bubble). Its word hangs on a
 * branch over the clearing, one letter on each leaf. Every letter the child
 * types flies into the cauldron, and the potion foams higher and changes
 * colour; with the last one it goes *bang*, and the thing steps out alive
 * and joins the others on the forest floor. A wrong letter is coughed back
 * out.
 *
 * Levels 4–10: the letters fall. The next leaf comes off the branch and
 * drifts down to the forest floor, held by a firefly; typed in time, Lumi
 * zaps it into the cauldron. A leaf that lands is carried off by a
 * hedgehog, and a heart goes. Each of these levels ends with a duel: a
 * cheeky raven holds the last word, and every letter typed in time costs
 * it a feather until it drops the thing into the cauldron.
 *
 * Scientific basis:
 *   • Encoding Specificity (Tulving, 1983) — motor memory (typing) anchors letter shapes
 *     better than passive recognition alone.
 *   • Handwriting → Brain activation (James & Engelhardt, 2012) — letter-form motor programs
 *     activate reading circuits; keyboard input offers a comparable digital analogue.
 *   • Errorless Learning (Terrace, 1963) — immediate feedback on wrong letters prevents
 *     consolidation of incorrect patterns.
 */

// Word length rises with the level, one step at a time.
const STATIC_LEN = { 1: [3, 3], 2: [4, 4], 3: [5, 5] }
const STATIC_WORDS = 6
// fallS: seconds a leaf drifts from the branch to the forest floor (after
// 1.5 s wiggling on the branch and being blown to its lane). Level 4 leaves
// a six-year-old who hunts for the key on the big keyboard plenty of time;
// it gets quicker by about half a second a level, never frantic, and
// slower again after a leaf was lost.
const FALLING = {
  4:  { len: [3, 3], fallS: 12 },
  5:  { len: [4, 4], fallS: 11 },
  6:  { len: [4, 5], fallS: 10.5 },
  7:  { len: [5, 5], fallS: 10 },
  8:  { len: [5, 6], fallS: 9 },
  9:  { len: [6, 7], fallS: 8.5 },
  10: { len: [7, 8], fallS: 8 },
}
const FALLING_WORDS = 5
// The game slows down after a leaf was lost and picks up when it goes well
const SLOWER = 1.35, QUICKER = 0.9
// the leaf wiggles on the branch, then the wind takes it to its lane
const HANG_MS = 900, BLOW_MS = 650

// Lines Lumi has not recorded yet: the game says them as soon as they are
// (lib/lumiLines.js), until then they are skipped.
const TASK_STATIC = 'woerter/zauberkessel'
const TASK_FALLING = 'woerter/buchstabenwald-fallen'
const TASK_RAVEN = 'woerter/rabe-duell'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const lerp = (a, b, u) => a + (b - a) * u
const easeOut = u => 1 - (1 - u) ** 2

// The potion changes colour with every letter that goes in
const BREWS = ['#7be36b', '#5fd3c9', '#7aa8ff', '#c08bff', '#ff8fd0', '#ffb347', '#ffe066', '#9be15d']

// ─── Room ───────────────────────────────────────────────────────────────────
/**
 * The room the game has, in its own pixels, and how many screen pixels one
 * of them is: the game sits in the FitBox, which draws a phone held
 * sideways at 60 %. `kind`: 'flat' (a phone held sideways: the keyboard
 * stands beside the clearing), 'narrow' (a phone held upright: a small
 * keyboard of big keys) or 'wide'.
 */
function useRoom() {
  const ref = useRef(null)
  const [room, setRoom] = useState({ w: 720, h: 680, scale: 1 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      const scale = w ? el.getBoundingClientRect().width / w : 1
      if (w && h) setRoom(r => (r.w === w && r.h === h && Math.abs(r.scale - scale) < 0.01 ? r : { w, h, scale }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const kind = room.h < 640 && room.w > room.h * 1.6 ? 'flat' : room.w < 560 ? 'narrow' : 'wide'
  // a finger needs 64 screen pixels: so many of the game's own
  const tap = Math.ceil(66 / (room.scale || 1))
  return [ref, { ...room, kind, tap }]
}

function useBoxOf() {
  const ref = useRef(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const measure = () => {
      const w = el.clientWidth, h = el.clientHeight
      setBox(b => (b.w === w && b.h === h ? b : { w, h }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, box]
}

// ─── Keyboard ───────────────────────────────────────────────────────────────
const KEY_DROP = 'inset 0 -4px 0 rgba(42,27,61,0.10), 0 4px 0 rgba(42,27,61,0.35)'
const KEY_RING = [KEY_DROP, `${KEY_DROP}, 0 0 0 4px rgba(255,201,60,0.75)`]

// A full QWERTZ keyboard has 29 keys: on a phone they came out 28–33 px
// wide. Small screens get the letters of the word plus a few others, in
// ABC order, as big keys.
function compactKeys(word) {
  const own = [...new Set(word.split(''))]
  const others = shuffle(ALPHABET.filter(c => !own.includes(c)))
  const extra = Math.min(12, Math.max(8, own.length + 3)) - own.length
  return [...own, ...others.slice(0, extra)].sort((a, b) => a.localeCompare(b, 'de'))
}

/**
 * The on-screen keyboard. `hint` is the letter that pulses, `pictures`
 * turns it into the Anlauttabelle: each key with its picture. The layout
 * follows the room: the full QWERTZ rows on a tablet, a few big keys on a
 * phone, a block of big keys beside the clearing on a phone held sideways.
 * `onKey(letter, keyElement)`.
 */
function Keyboard({ word, hint, onKey, pictures = false, room, height }) {
  const keys = useMemo(() => compactKeys(word), [word])
  const key = (k, w, h, font) => {
    const hinted = k === hint
    const pic = pictures && ANLAUT[k]
    return (
      <motion.button key={k} data-key={k} type="button"
        whileTap={{ scale: 0.82, y: 5 }}
        onClick={e => onKey(k, e.currentTarget)}
        aria-label={pic ? `${k} wie ${ANLAUT[k][0]}` : k}
        animate={hinted ? { scale: [1, 1.12, 1], boxShadow: [KEY_RING[0], KEY_RING[1], KEY_RING[0]] } : { scale: 1 }}
        transition={hinted ? { duration: 1.1, repeat: Infinity } : { duration: 0.2 }}
        style={{
          ...pxCard(hinted ? 'selected' : undefined),
          borderRadius: 10, boxShadow: KEY_DROP,
          ...(hinted ? { background: 'var(--px-gold)' } : null),
          width: w, height: h, padding: 0, flexShrink: 0, lineHeight: 1,
          color: hinted ? INK : 'var(--text-primary)',
          fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: pic ? font * 0.85 : font,
          cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center', justifyContent: 'center',
        }}>
        {k}
        {pic && <Art art={pic[1]} size={Math.min(w, h) * 0.46} />}
      </motion.button>
    )
  }

  if (room.kind === 'wide') {
    // eleven keys and ten gaps across the widest row
    const w = Math.floor(Math.min(78, (Math.min(920, room.w - 40) - 60) / 11))
    const h = Math.max(room.tap, pictures ? 80 : 64)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 920, alignSelf: 'center', flexShrink: 0 }}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 6, width: '100%' }}>
            {row.map(k => key(k, w, h, 24))}
          </div>
        ))}
      </div>
    )
  }
  if (room.kind === 'narrow') {
    // five keys of 64 px fit a 360 px phone
    const w = Math.max(room.tap, 64), h = pictures ? Math.round(w * 1.22) : w
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8, width: '100%', maxWidth: 5 * w + 4 * 8, alignSelf: 'center', flexShrink: 0 }}>
        {keys.map(k => key(k, w, h, 28))}
      </div>
    )
  }
  // flat: a block of four columns beside the clearing, as big as the
  // height allows and never smaller than a finger
  const rows = Math.ceil(keys.length / 4)
  const gap = 10
  const s = Math.floor(clamp((height - (rows - 1) * gap) / rows, room.tap, 132))
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(4, ${s}px)`, gap, alignContent: 'center', flexShrink: 0 }}>
      {keys.map(k => key(k, s, s, s * 0.4))}
    </div>
  )
}

// ─── Lumi and the cauldron ──────────────────────────────────────────────────
// Lumi's act (WitchLumi) for a moment, then back to idle
function useAct() {
  const [state, set] = useState({ act: 'idle', beat: 0 })
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])
  const act = useCallback((a, ms = 900) => {
    clearTimeout(timer.current)
    set(s => ({ act: a, beat: s.beat + 1 }))
    timer.current = setTimeout(() => set(s => ({ ...s, act: 'idle' })), ms)
  }, [])
  return [state, act]
}

/**
 * Everything the cauldron does, shared by both ways of playing: letters fly
 * in (a splash, the potion foams up and changes colour), wrong ones are
 * coughed back out, and the finished word comes alive with a bang. Now and
 * then Lumi's hat jumps off. Everything conjured stays on the forest floor
 * (`zoo`) and jumps when the next word is done (`cheer`).
 */
function useKessel(juice) {
  const [lumi, act] = useAct()
  const [cough, setCough] = useState(false)
  const [splash, setSplash] = useState(0)
  const [zoo, setZoo] = useState([])
  const [cheer, setCheer] = useState(0)
  const wandRef = useRef(null)
  const [fliers, fly] = useFliers()
  const [bursts, burst] = useBursts()
  const mouthRef = useRef(null)
  const timers = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = (fn, ms) => { timers.current.push(setTimeout(fn, ms)) }
  const { hit, miss, shake } = juice

  const letterIn = (fromEl, char, keyEl) => {
    fly(fromEl, mouthRef.current, char, true)
    if (keyEl) burst(keyEl, 'stars', 5)
    act('stir', 500)
    later(() => { setSplash(n => n + 1); sfx.pop() }, 480)
  }
  // The falling letter: a star shoots from Lumi's wand, zaps it, and the
  // letter flies into the pot
  const zapIn = (leafEl, char, keyEl) => {
    const r = leafEl.getBoundingClientRect()
    const rect = { left: r.left, top: r.top, width: r.width, height: r.height }
    fly(wandRef.current, rect, null, true, 'zap')
    act('zap', 400)
    if (keyEl) burst(keyEl, 'stars', 5)
    sfx.whoosh()
    later(() => {
      sfx.sparkle()
      burst({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }, 'stars', 10)
      fly(rect, mouthRef.current, char, true)
    }, 260)
    later(() => { setSplash(n => n + 1); sfx.pop() }, 740)
  }
  // a wrong key: the cauldron coughs the letter back out, the streak is over
  const letterOut = (fromEl, char) => {
    miss(fromEl)
    fly(fromEl, mouthRef.current, char, false)
    later(() => { sfx.burp(); setCough(true); act('cough', 800) }, 480)
    later(() => setCough(false), 1300)
  }
  // The word is done: bang, the thing jumps out, a star flies to the
  // counter (more for the raven's word)
  const wordDone = (stars = 1, bang = 1.2) => {
    shake(bang)
    sfx.drum()
    sfx.tada()
    setCheer(c => c + 1)
    later(() => sfx.sparkle(), 400)
    later(() => { if (mouthRef.current) hit(mouthRef.current, { stars }) }, 250)
    if (juice.streak >= 2) later(() => { if (mouthRef.current) burst(mouthRef.current, 'confetti', 18) }, 350)
    if (Math.random() < 0.3) act('hat', 1300)
    else act('cheer', 1200)
    later(() => sfx.boing(), 1150)
  }
  const tickle = () => { sfx.giggle(); act('stir', 500) }
  const stir = () => { sfx.pop(); setSplash(n => n + 1) }
  // the conjured thing walks over to the forest floor
  const keep = word => setZoo(z => [...z, { art: WORDS[word], move: moveOf(word) }])
  return { lumi, act, cough, splash, fliers, bursts, burst, mouthRef, wandRef, zoo, cheer, letterIn, zapIn, letterOut, wordDone, keep, tickle, stir }
}

// ─── The clearing ───────────────────────────────────────────────────────────
/**
 * Where everything stands in a clearing `w`×`h` for a word of `n` letters:
 * the branch with the word, Lumi and the cauldron on the forest floor, and
 * (while letters fall) the lanes beside them where the leaves come down.
 */
function clearingLayout(w, h, n, falling) {
  const trunkW = clamp(w * 0.045, 16, 40)
  const branchY = clamp(h * 0.09, 22, 40)
  const span = w - 2 * trunkW - 12
  const s = Math.floor(Math.max(30, Math.min(62, h * 0.15, (span - (n - 1) * 6) / n)))
  const vineBottom = branchY + s * 1.18 + 4
  const floorH = clamp(h * 0.16, 44, 72)
  const floorY = h - floorH
  const gH = Math.max(60, floorY - vineBottom - 10)
  const tall = h > w * 0.9
  const pot = Math.floor(Math.min(250, gH / 0.95, w * (tall ? 0.44 : 0.34)))
  const lumi = Math.floor(Math.min(124, tall ? (gH - 46) / 1.87 : gH / 1.38, pot * 0.6))
  const wishW = tall ? 0 : lumi * 0.5 + 34
  const gap = clamp(w * 0.03, 8, 30)
  const groupW = wishW + lumi + gap + pot
  let groupX = (w - groupW) / 2
  let lanes = []
  if (falling) {
    const side = (w - groupW) / 2 - trunkW
    if (side >= 110) lanes = [trunkW + side / 2, w - trunkW - side / 2]
    else {
      groupX = trunkW + 2
      lanes = [(groupX + groupW + w - trunkW) / 2]
    }
  }
  // the raven of the duel sits on a twig of the right-hand tree, under
  // the branch with the word
  const raven = Math.floor(clamp(h * 0.3, 96, 150))
  const ravenX = w - trunkW - 6 - raven * 1.08
  return { trunkW, branchY, s, vineBottom, floorH, floorY, tall, pot, lumi, wishW, gap, groupW, groupX, lanes, raven, ravenX,
    // the cauldron's mouth (the group stands 8 px into the floor)
    mouth: { x: groupX + wishW + lumi + gap + pot / 2, y: floorY + 8 - pot * 0.92 * 0.61 } }
}

const Forest = memo(ForestBack)

/**
 * The clearing: forest, the word on its branch, Lumi and the cauldron, the
 * conjured things on the floor. `children` are drawn over it in its own
 * pixels (the falling leaf, the hedgehog, the raven); `layoutRef` gets the
 * layout, for them.
 */
function Clearing({ word, typed, gapAt = -1, done, k, wish = true, party, stageRef, layoutRef, slotRef, falling, children }) {
  const [boxRef, box] = useBoxOf()
  const L = clearingLayout(box.w || 600, box.h || 400, word.length, falling)
  layoutRef.current = { ...L, w: box.w, h: box.h }
  // where the leaves hang: centred on the branch
  const slotsW = word.length * L.s + (word.length - 1) * 6
  const slotX = i => (box.w - slotsW) / 2 + i * (L.s + 6) + L.s / 2
  layoutRef.current.slotX = slotX
  const n = Math.max(6, k.zoo.length)
  const itemS = Math.round(Math.min(L.floorH * 0.8, (box.w - 2 * L.trunkW) / (n * 1.25)))
  // the thing that comes out of the cauldron stays below the branch
  const aliveS = Math.max(40, Math.min(L.pot * 0.6, L.floorY + 8 - L.pot * 0.92 * 0.62 - L.vineBottom - 30))
  return (
    <div ref={stageRef} style={{ position: 'relative', flex: 1, minHeight: 0, minWidth: 0 }}>
      <div ref={boxRef} style={{ position: 'absolute', inset: 0 }}>
        {box.w > 0 && <>
          <Forest w={box.w} h={box.h} branchY={L.branchY} floorY={L.floorY} trunkW={L.trunkW} />
          {/* the word on the branch: one leaf per letter, the next one
              lit, the typed ones gold */}
          <div role="img" aria-label={nameOf(word)} data-word={word} data-typed={typed}
            style={{ position: 'absolute', left: 0, right: 0, top: L.branchY - 2, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {word.split('').map((ch, i) => (
              <Leaf key={`${word}-${i}`} char={ch} size={L.s}
                leafRef={i === typed ? slotRef : undefined}
                look={i < typed ? 'done' : i === gapAt ? 'gap' : i === typed && !done ? 'next' : 'wait'}
                pulse={i === typed && i !== gapAt && !done} />
            ))}
          </div>
          {/* Lumi and the cauldron, on the forest floor */}
          <div style={{ position: 'absolute', left: L.groupX, bottom: L.floorH - 8, display: 'flex', alignItems: 'flex-end', gap: L.gap, paddingLeft: L.wishW }}>
            <WitchLumi size={L.lumi} act={k.lumi.act} beat={k.lumi.beat} onTap={k.tickle} wandRef={k.wandRef}
              wish={wish && !done && (
                <Wish side={L.tall ? 'top' : 'left'} size={L.lumi}>
                  <motion.div key={word} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12 }}>
                    <Art art={WORDS[word]} size={L.lumi * 0.5} />
                  </motion.div>
                </Wish>
              )} />
            <div style={{ position: 'relative' }}>
              <Cauldron width={L.pot} brew={BREWS[typed % BREWS.length]} fill={typed / word.length}
                cough={k.cough} splash={k.splash} mouthRef={k.mouthRef} onTap={k.stir} />
              {done && <Puff key={'p' + word} size={L.pot * 1.3} />}
              {done && <Alive key={'a' + word} art={WORDS[word]} size={aliveS} move={moveOf(word)} />}
            </div>
          </div>
          {/* what was conjured, on the forest floor in front of the cauldron */}
          <Hill items={k.zoo} cheer={k.cheer} party={party} size={itemS}
            style={{ position: 'absolute', left: 0, right: 0, bottom: (L.floorH - itemS) * 0.45 }} />
          {children}
        </>}
      </div>
    </div>
  )
}

// The trail along the top, the hearts while letters fall, and the stars
function TopRow({ total, done, children, hud }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', flexShrink: 0, minHeight: 48 }}>
      <div style={{ flex: 1, minWidth: 0, padding: '2px 6px', borderRadius: 99, background: 'rgba(255,253,247,0.22)' }}>
        <RoundTrail total={total} done={Math.min(total, done)} walker="🧹" goal="🔮" />
      </div>
      {children}
      {hud}
    </div>
  )
}

function Hearts({ lives }) {
  return (
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} aria-label={`${lives} Herzen`}>
      {Array.from({ length: 3 }, (_, i) => (
        <motion.div key={i} animate={i < lives ? { scale: 1, opacity: 1 } : { scale: [1, 1.4, 0.7], opacity: 0.25 }} transition={{ duration: 0.5 }}>
          <Art art="❤️" size={30} style={{ filter: i < lives ? undefined : 'grayscale(1)' }} />
        </motion.div>
      ))}
    </div>
  )
}

// The end of a level, in the clearing itself: everything conjured jumps on
// the forest floor, Lumi cheers, confetti. Held while the help is open.
function useFinale(on, k, stageRef, onDone) {
  const paused = usePaused()
  const done = useRef(onDone)
  done.current = onDone
  const kRef = useRef(k)
  kRef.current = k
  useEffect(() => {
    if (!on) return undefined
    const { act, burst } = kRef.current
    sfx.tada()
    act('cheer', 1200)
    const el = stageRef.current
    const ts = []
    if (el) {
      const r = el.getBoundingClientRect()
      ;[0.25, 0.5, 0.75].forEach((x, i) => ts.push(setTimeout(() => burst({ x: r.left + r.width * x, y: r.top + r.height * 0.3 }, 'confetti', 16), i * 250)))
    }
    ts.push(setTimeout(() => act('hat', 1300), 1300))
    return () => ts.forEach(clearTimeout)
  }, [on, stageRef])
  useEffect(() => {
    if (!on || paused) return undefined
    const t = setTimeout(() => done.current(), 3000)
    return () => clearTimeout(t)
  }, [on, paused])
}

// Move on once the payoff has been seen, but never while the help is open
const PAYOFF_MS = 2400
function useAdvance(go, paused) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!ready || paused) return
    setReady(false)
    go()
  }, [ready, paused, go])
  return useCallback(() => afterNarration(() => setReady(true), { minMs: PAYOFF_MS }), [])
}

// A wrong key while Lumi still says the line for the one before: the cough
// and the sound show it, and the line is not cut off by the next one.
function useSayWrong() {
  const talking = useRef(false)
  useEffect(() => onNarrationChange(on => { if (!on) talking.current = false }), [])
  return useCallback(() => {
    if (talking.current) return
    // set after the call: starting the line stops what ran before, and that
    // stop reaches the listener above
    let ended = false
    sayWrong(null, { onEnd: () => { ended = true; talking.current = false } })
    if (!ended) talking.current = true
  }, [])
}

// A word starts: the task once per level, then the word
function announce(word, task) {
  sayTask()
  voice([task, wordKey(word)])
}
// A word is done: its last letter is named like every other one, then the
// whole word and now and then the praise ("Zett. Pilz. Ja, super!").
function conjured(word) {
  const lead = [KEY.letter(word[word.length - 1]), wordKey(word)].filter(x => x && x in LINES).map(line)
  sayRight(null, { lead, onEnd: () => voice([KEY.noise(nameOf(word))]) })
}

// The element of an on-screen key, looked up when the hint hand needs it
const keyOf = (root, char) => ({ get current() { return root.current?.querySelector(`[data-key="${char}"]`) } })

// Letters typed on a real keyboard count like taps
function usePhysicalKeys(handle, rootRef) {
  useEffect(() => {
    const onKey = (e) => {
      const c = e.key.toUpperCase()
      if (c.length === 1 && /[A-ZÄÖÜ]/.test(c)) handle(c, rootRef.current?.querySelector(`[data-key="${c}"]`))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handle, rootRef])
}

// ─── Falling letters (level >= 4) ───────────────────────────────────────────
/**
 * The leaf on its way down, moved without a render: it wiggles on the
 * branch, the wind takes it to its lane, and it drifts down to the floor.
 * `run.current` holds the flight; `onLand` comes when it is down.
 */
function useDrop(paused) {
  const x = useMotionValue(-999), y = useMotionValue(-999), rot = useMotionValue(0)
  const run = useRef(null)
  const pausedRef = useRef(paused)
  pausedRef.current = paused
  useEffect(() => {
    let raf, last = performance.now()
    const tick = now => {
      const dt = Math.min(100, now - last)
      last = now
      const r = run.current
      if (r && !pausedRef.current && r.phase !== 'down') {
        r.t += dt
        if (r.phase === 'hang') {
          x.set(r.from.x + Math.sin(r.t / 45) * 3); y.set(r.from.y); rot.set(Math.sin(r.t / 70) * 10)
          if (r.t >= HANG_MS) { r.phase = 'blow'; r.t = 0 }
        } else if (r.phase === 'blow') {
          const u = Math.min(1, r.t / BLOW_MS), e = easeOut(u)
          x.set(lerp(r.from.x, r.lane.x, e)); y.set(lerp(r.from.y, r.lane.y, e) - Math.sin(u * Math.PI) * 18); rot.set(Math.sin(u * Math.PI) * 25)
          if (u >= 1) { r.phase = 'fall'; r.t = 0 }
        } else {
          const p = Math.min(1, r.t / r.fallMs)
          x.set(r.lane.x + Math.sin(r.t / 650) * r.sway); y.set(lerp(r.lane.y, r.landY, p)); rot.set(Math.sin(r.t / 650 + 0.6) * 14)
          if (p >= 1) { r.phase = 'down'; r.onLand?.() }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [x, y, rot])
  return { x, y, rot, run }
}

function FallingLettersGame({ level, onComplete }) {
  const cfg    = FALLING[level] ?? FALLING[10]
  const paused = usePaused()
  const juice  = useJuice()
  const k      = useKessel(juice)
  const [rootRef, room] = useRoom()
  // five words, and a sixth for the raven
  const [words]  = useState(() => pickWords(cfg.len, FALLING_WORDS + 1))
  const [wIdx,     setWIdx]     = useState(0)
  const [typed,    setTyped]    = useState(0)
  const [misses,   setMisses]   = useState(0)   // wrong keys on the current letter
  const wrongKey = useSayWrong()
  const [showHint, setShowHint] = useState(false)
  const [lives,    setLives]    = useState(3)
  const [drop,     setDrop]     = useState(null) // { id, char } while a leaf is out
  const [landed,   setLanded]   = useState(null) // { id, x, y, from, char } a leaf on the floor
  const [done,     setDone]     = useState(false)
  const [finale,   setFinale]   = useState(false)
  // the duel: the raven's feathers, a lost one in the air, the thing it drops
  const [ruffle,   setRuffle]   = useState(0)
  const [feathers, setFeathers] = useState([])
  const [thing,    setThing]    = useState(null)
  const [ravenGone, setRavenGone] = useState(false)
  const stageRef  = useRef(null)
  const layoutRef = useRef(null)
  const slotRef   = useRef(null)
  const leafRef   = useRef(null)
  const floorLeafRef = useRef(null)
  const ravenRef  = useRef(null)
  const timers    = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])
  const later = useCallback((fn, ms) => { timers.current.push(setTimeout(fn, ms)) }, [])
  // Words typed with no wrong key and no leaf lost: the score
  const cleanRef  = useRef(0)
  const helpedRef = useRef(false)
  const slowRef   = useRef(1)   // slower after a lost leaf, quicker on a run
  const livesRef  = useRef(3)
  const typedRef  = useRef(0)
  const { x, y, rot, run } = useDrop(paused)

  const duel = wIdx === FALLING_WORDS
  const word = words[wIdx] ?? ''
  const targetChar = word[typed] ?? ''
  const keyRef = useMemo(() => keyOf(rootRef, targetChar), [targetChar, rootRef])
  typedRef.current = typed

  // Lay the next leaf out: it hangs where its letter is on the branch, the
  // wind takes it to a lane beside the cauldron, and down it goes.
  const release = useCallback((index) => {
    const L = layoutRef.current
    // a letter typed before its leaf came out needs no leaf
    if (!L || !words[wIdx] || typedRef.current !== index || index >= words[wIdx].length) return
    const w = words[wIdx], char = w[index]
    const leafS = clamp(room.tap * 0.95, 60, 96)
    // left and right in turn; in the duel the raven sits over the right-hand
    // lane, so the leaves come down on the left, or below the raven when
    // there is only the one lane
    const two = L.lanes.length > 1
    const laneX = two ? L.lanes[duel ? 0 : (index + wIdx) % 2] : L.lanes[0] ?? L.w * 0.85
    const top = duel && !two ? L.vineBottom + L.raven * 0.95 : L.vineBottom + 6
    const landY = L.floorY + L.floorH * 0.4 - leafS * 1.18
    run.current = {
      t: 0, phase: 'hang', sway: Math.min(14, L.w * 0.02),
      from: { x: L.slotX(index), y: L.branchY - 2 }, lane: { x: laneX, y: top }, landY,
      fallMs: cfg.fallS * 1000 * slowRef.current * (duel ? 1.1 : 1),
      onLand: () => {
        const r = run.current
        setLanded({ id: Date.now(), index, x: r ? x.get() : laneX, y: L.floorY + L.floorH * 0.4, from: laneX < L.w / 2 ? -1 : 1, char, size: leafS })
        setDrop(null)
      },
    }
    x.set(L.slotX(index)); y.set(L.branchY - 2)
    setDrop({ id: Date.now(), char, size: leafS })
  }, [words, wIdx, room.tap, cfg.fallS, duel, run, x, y])

  // A new word: Lumi wishes for it (or the raven has it), and the first
  // leaf comes after a moment
  useEffect(() => {
    if (!word) return undefined
    announce(word, duel ? TASK_RAVEN : wIdx === 0 ? TASK_FALLING : null)
    if (duel) sfx.giggle()
    const t = setTimeout(() => release(0), duel ? 1600 : 1000)
    return () => clearTimeout(t)
  }, [wIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextWord = useCallback(() => {
    k.keep(word)
    if (wIdx + 1 >= words.length) { setFinale(true); return }
    setWIdx(i => i + 1)
    setTyped(0)
    setMisses(0)
    setShowHint(false)
    setDone(false)
    helpedRef.current = false
    // hearts belong to one word: a tough word costs that word, not the run
    setLives(3)
    livesRef.current = 3
    slowRef.current = juice.streak >= 3 ? QUICKER : 1
  }, [wIdx, words.length, word, k, juice.streak])
  const advance = useAdvance(nextWord, paused)

  const finishWord = useCallback(() => {
    run.current = null
    setDrop(null)
    setDone(true)
    if (duel) {
      // the raven drops the thing into the cauldron: bang
      const L = layoutRef.current
      const r = ravenRef.current?.getBoundingClientRect(), s = stageRef.current?.getBoundingClientRect()
      const scale = s && L?.w ? s.width / L.w : 1
      const from = r && s ? { x: (r.left - s.left) / scale, y: (r.top - s.top) / scale + L.raven * 0.3 } : { x: L.w * 0.8, y: L.vineBottom }
      setThing({ from, to: L.mouth, size: L.raven * 0.55 })
      sfx.slideDown()
      return
    }
    if (!helpedRef.current) cleanRef.current += 1
    k.wordDone(1)
    conjured(word)
    advance()
  }, [duel, k, word, advance, run])

  const thingLanded = useCallback(() => {
    setThing(null)
    setRavenGone(true)
    k.wordDone(3, 2)
    conjured(word)
    advance()
  }, [k, word, advance])

  // A leaf reached the forest floor. In a word the hedgehog takes it and a
  // heart goes; in the duel the raven only laughs, and the leaf goes back
  // up. Either way the key is shown from now on and the leaves fall slower.
  const hedgehogTook = useCallback(() => {
    helpedRef.current = true
    slowRef.current = SLOWER
    juice.miss(stageRef.current)
    sfx.chomp()
    sayWrong()
    const n = livesRef.current - 1
    livesRef.current = n
    setLives(n)
  }, [juice])
  const hedgehogGone = useCallback(() => {
    const index = landed?.index
    setLanded(null)
    // the letter was typed while the hedgehog ran off with its leaf
    if (typedRef.current !== index) return
    if (livesRef.current <= 0) {
      // all hearts gone: the word is conjured anyway, and the next one comes
      setTyped(word.length)
      finishWord()
      return
    }
    setShowHint(true)
    release(typed)
  }, [landed, word, typed, finishWord, release])
  useEffect(() => {
    if (!landed || !duel) return
    sfx.giggle()
    setRuffle(r => r + 1)
    slowRef.current = SLOWER
    const index = landed.index
    later(() => {
      if (typedRef.current !== index) return   // typed just in time
      setLanded(null); setShowHint(true); release(index)
    }, 900)
  }, [landed?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChar = useCallback((char, el) => {
    if (paused || done || finale || !targetChar) return
    if (char !== targetChar) {
      k.letterOut(el, char)
      const n = misses + 1
      setMisses(n)
      helpedRef.current = true
      if (n >= 2) setShowHint(true)
      wrongKey()
      return
    }
    // Lumi zaps the leaf into the cauldron: on its way down, or just in time
    // from the forest floor before the hedgehog has it. Typed before the
    // leaf came out (or while the hedgehog runs off with it), the letter
    // flies straight from the key.
    const onFloor = landed && !landed.taken && landed.index === typed
    if (run.current && leafRef.current) k.zapIn(leafRef.current, char, el)
    else if (onFloor && floorLeafRef.current) k.zapIn(floorLeafRef.current, char, el)
    else k.letterIn(el, char, el)
    if (onFloor) setLanded(null)
    run.current = null
    setDrop(null)
    const n = typed + 1
    setTyped(n)
    setMisses(0)
    setShowHint(false)
    if (duel) {
      // the raven loses a feather
      setRuffle(r => r + 1)
      const L = layoutRef.current, r = ravenRef.current?.getBoundingClientRect(), s = stageRef.current?.getBoundingClientRect()
      if (L && r && s) {
        const scale = s.width / L.w
        setFeathers(f => [...f, { id: Date.now(), x: (r.right - s.left) / scale - L.raven * 0.3, y: (r.top - s.top) / scale + L.raven * 0.5 }])
      }
      sfx.boing()
    }
    if (n >= word.length) finishWord()
    else {
      voice([KEY.letter(char)])
      later(() => release(n), 450)
    }
  }, [paused, done, finale, targetChar, landed, misses, typed, word, duel, k, finishWord, later, release, run, wrongKey])
  usePhysicalKeys(handleChar, rootRef)

  useFinale(finale, k, stageRef, () => onComplete(result(cleanRef.current, FALLING_WORDS)))

  // The hand: on the very first leaf it shows the way to its key; later it
  // taps the key once the key is shown anyway
  const first = wIdx === 0 && typed === 0 && misses === 0 && lives === 3
  const L = layoutRef.current
  const keyboardH = room.h - 84
  return (
    <div ref={rootRef} data-phase={finale ? 'finale' : 'play'} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 'clamp(6px,1.4vw,14px) clamp(8px,2vw,20px)', gap: 8, overflow: 'hidden', userSelect: 'none' }}>
      <TopRow total={FALLING_WORDS} done={wIdx + (done ? 1 : 0)} hud={juice.hud}>
        {!duel && <Hearts lives={lives} />}
      </TopRow>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: room.kind === 'flat' ? 'row' : 'column', gap: 10 }}>
        <div ref={juice.stage} style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
          <Clearing word={word} typed={typed} gapAt={drop || landed ? typed : -1} done={done && !(duel && !ravenGone) && !finale} k={k} wish={!duel && !finale} party={finale}
            stageRef={stageRef} layoutRef={layoutRef} slotRef={slotRef} falling>
            {/* the leaf on its way down */}
            {drop && (
              <motion.div key={drop.id} style={{ position: 'absolute', left: 0, top: 0, x, y, rotate: rot, marginLeft: -drop.size / 2, zIndex: 6, pointerEvents: 'none', transformOrigin: '50% 0%' }}>
                <FallingLeaf char={drop.char} size={drop.size} leafRef={leafRef} />
              </motion.div>
            )}
            {/* …on the floor, until the hedgehog has it */}
            {landed && !landed.taken && (
              <div data-landed ref={floorLeafRef} style={{ position: 'absolute', left: landed.x - landed.size / 2, top: landed.y - landed.size * 1.1, zIndex: 5, transform: 'rotate(-28deg)', transformOrigin: '50% 100%' }}>
                <Leaf char={landed.char} size={landed.size} look="fall" />
              </div>
            )}
            {landed && !duel && L && (
              <Hedgehog key={landed.id} x={landed.x} y={landed.y} from={landed.from} char={landed.char} size={Math.max(52, L.floorH * 1.1)} w={L.w}
                onTake={() => { setLanded(l => (l ? { ...l, taken: true } : l)); hedgehogTook() }} onDone={hedgehogGone} />
            )}
            {/* the raven of the duel, on a twig of the right-hand tree */}
            {duel && L && (
              <motion.div initial={{ x: 200, y: -120, opacity: 0 }} data-raven
                animate={ravenGone ? { x: 260, y: -260, opacity: 0, transition: { duration: 1.2, ease: 'easeIn' } } : { x: 0, y: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                style={{ position: 'absolute', left: L.ravenX, top: L.vineBottom + 2, zIndex: 4 }}>
                <div style={{ position: 'absolute', left: L.raven * 0.3, width: L.w - L.ravenX - L.raven * 0.3, top: L.raven * 0.86, height: 10, borderRadius: 6, background: '#6b4a3a', border: `3px solid ${INK}` }} />
                <div ref={ravenRef}>
                  <Raven size={L.raven} total={word.length} feathers={word.length - typed} holding={!done ? WORDS[word] : null} ruffle={ruffle} />
                </div>
              </motion.div>
            )}
            {feathers.map(f => <LostFeather key={f.id} x={f.x} y={f.y} onDone={() => setFeathers(l => l.filter(o => o.id !== f.id))} />)}
            {/* the thing the raven drops, on its way into the cauldron */}
            {thing && (
              <motion.div initial={{ x: thing.from.x - thing.size / 2, y: thing.from.y, rotate: 0 }}
                animate={{ x: thing.to.x - thing.size / 2, y: thing.to.y - thing.size / 2, rotate: 360 }}
                transition={{ duration: 0.75, ease: 'easeIn' }} onAnimationComplete={thingLanded}
                style={{ position: 'absolute', left: 0, top: 0, zIndex: 6, pointerEvents: 'none' }}>
                <Art art={WORDS[word]} size={thing.size} />
              </motion.div>
            )}
          </Clearing>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <Keyboard word={word} hint={showHint && !done ? targetChar : null} onKey={handleChar} room={room} height={keyboardH} />
        </div>
      </div>
      <HintHand from={first ? leafRef : null} to={keyRef} active={!done && !finale && !!drop && (first || showHint)} delay={first ? 1800 : 300} />
      {k.fliers}
      {k.bursts}
      {juice.layer}
    </div>
  )
}

// ─── Static word typer (levels 1–3) ──────────────────────────────────────────
function StaticTyperGame({ level, onComplete }) {
  const paused   = usePaused()
  const juice    = useJuice()
  const k        = useKessel(juice)
  const [rootRef, room] = useRoom()
  const [words]  = useState(() => pickWords(STATIC_LEN[level] ?? STATIC_LEN[1], STATIC_WORDS))
  const [wIdx,   setWIdx]   = useState(0)
  const [typed,  setTyped]  = useState('')
  const [misses, setMisses] = useState(0)
  const wrongKey = useSayWrong()
  const [hintOn, setHintOn] = useState(false)
  const [finale, setFinale] = useState(false)
  // Words typed with no wrong key: the score. The spotlight that comes on
  // by itself after ten seconds is no mistake: a child who looks for the
  // key a while and then types it right has typed the word right.
  const cleanRef  = useRef(0)
  const wrongRef  = useRef(false)
  const stageRef  = useRef(null)
  const layoutRef = useRef(null)
  const slotRef   = useRef(null)

  const word      = words[wIdx] ?? ''
  const nextChar  = word[typed.length]
  const finished  = typed.length === word.length
  const keyRef    = useMemo(() => keyOf(rootRef, nextChar), [nextChar, rootRef])

  // The hint is per letter: every letter starts unaided, so the child has to
  // find it on the keyboard themselves at least once.
  useEffect(() => { setMisses(0); setHintOn(false) }, [typed.length, wIdx])

  // ...but a child who simply doesn't know the letter must not be stranded,
  // so the spotlight also comes on by itself after a while.
  useEffect(() => {
    if (finished || hintOn || paused) return undefined
    const id = setTimeout(() => setHintOn(true), 10000)
    return () => clearTimeout(id)
  }, [typed.length, wIdx, finished, hintOn, paused])

  const handleKey = useCallback((key, el) => {
    if (finished || paused || finale) return
    if (key === nextChar) {
      k.letterIn(el, key, el)
      setTyped(t => t + key)
      if (typed.length + 1 < word.length) voice([KEY.letter(key)])
    } else {
      k.letterOut(el, key)
      const n = misses + 1
      setMisses(n)
      wrongRef.current = true
      if (n >= 2) setHintOn(true)
      wrongKey()
    }
  }, [finished, paused, finale, nextChar, typed, word, misses, k, wrongKey])
  usePhysicalKeys(handleKey, rootRef)

  // The task, at the start of every word
  useEffect(() => {
    if (!word) return
    wrongRef.current = false
    announce(word, wIdx === 0 ? TASK_STATIC : null)
  }, [wIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  const nextWord = useCallback(() => {
    k.keep(word)
    if (wIdx + 1 >= words.length) { setFinale(true); return }
    setWIdx(i => i + 1)
    setTyped('')
  }, [wIdx, words.length, word, k])
  const advance = useAdvance(nextWord, paused)

  // Word complete: bang, the thing comes alive, and the next word once the
  // payoff has been seen
  useEffect(() => {
    if (!finished) return undefined
    if (!wrongRef.current) cleanRef.current += 1
    k.wordDone(1)
    conjured(word)
    return advance()
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  useFinale(finale, k, stageRef, () => onComplete(result(cleanRef.current, words.length)))

  // The hand: on the very first letter it shows the letter going to its
  // key; later it taps the key once the spotlight shows it anyway
  const first = wIdx === 0 && typed.length === 0 && misses === 0
  const keyboardH = room.h - 84

  return (
    <div ref={rootRef} data-phase={finale ? 'finale' : 'play'} style={{ position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 'clamp(6px,1.4vw,14px) clamp(8px,2vw,20px)', gap: 8, overflow: 'hidden', userSelect: 'none' }}>
      <TopRow total={words.length} done={wIdx + (finished ? 1 : 0)} hud={juice.hud} />
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: room.kind === 'flat' ? 'row' : 'column', gap: 10 }}>
        <div ref={juice.stage} style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex' }}>
          <Clearing word={word} typed={typed.length} done={finished && !finale} wish={!finale} k={k} party={finale}
            stageRef={stageRef} layoutRef={layoutRef} slotRef={slotRef} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
          <Keyboard word={word} hint={hintOn && !finished ? nextChar : null} onKey={handleKey} pictures room={room} height={keyboardH} />
        </div>
      </div>
      <HintHand from={first ? slotRef : null} to={keyRef} active={!finished && !finale && (first || hintOn)} delay={first ? 2000 : 400} />
      {k.fliers}
      {k.bursts}
      {juice.layer}
    </div>
  )
}

export default function TyperGame({ level = 1, onComplete }) {
  if (level >= 4) return <FallingLettersGame level={level} onComplete={onComplete} />
  return <StaticTyperGame level={level} onComplete={onComplete} />
}
