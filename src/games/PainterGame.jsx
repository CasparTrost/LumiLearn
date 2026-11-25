import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence, MotionConfig, useReducedMotion } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate, leaveGame, lockPreviews } from '../narrator.js'
import { colorWord } from '../lib/words.js'
import { sayRight, sayWrong } from '../lib/feedback.js'
import { result } from '../lib/score.js'
import { useBursts, HintHand } from '../components/play/index.js'
import { useLater } from './zahlen/stage.jsx'
import { INK } from './px.js'
import Monster from './farbdusche/Monster.jsx'
import { Machine, Rain, Lever, Drain, TapArt, Bubble, Shelf, Bucket, Drop } from './farbdusche/parts.jsx'
import { COLORS, MAX_SQUIRTS, hexOf, mixOf, planLevel, recipeOf } from './farbdusche/colors.js'
import { layoutFor, slotAt } from './farbdusche/layout.js'
import './farbdusche/farbdusche.css'

/**
 * Farbenreich: "Monster-Farbdusche" — colour words and colour mixing.
 *
 * A monster without a colour walks under the paint shower. Its thought
 * bubble shows the same monster in the colour it wants to be. The child
 * squirts paint from the big taps into the glass tank (the tank shows the
 * mix as it grows, three squirts fit) and pulls the lever: the paint rains
 * down and the monster takes on exactly what was mixed.
 *
 *   • A match: the monster dances, makes a funny noise and hops onto the
 *     parade shelf, where the monsters of the level collect.
 *   • No match: never an error. The wish comes next to the monster, as big
 *     as the monster, so the difference shows; the monster shakes its
 *     head, a bucket of water washes it clean, and the child tries again.
 *     After two misses the bubble shows the recipe as drops of paint, and
 *     the taps it needs hop.
 *   • The wheel on the tank's side lets the paint out again at any time.
 *
 * Levels 1–2 ask for single paints, 3–4 for the mixes of two, 5–6 bring
 * white (lighter), 7–8 black (darker), 9–10 everything, with the next
 * monster waiting in view. The odd levels show the recipe of a new colour
 * the first time, the even ones ask without it (farbdusche/colors.js).
 * Score: monsters that got their colour with the first shower.
 *
 * Lumi says one word: the wished colour when a monster arrives, the paint
 * of a tap, and the colour that came out, each only when it is not the
 * word Lumi said last ("Rot. Rot. Rot." for a red wish, a red tap and a
 * red monster). A hand shows the next step when a child waits.
 */

const LABEL = { rot: 'Rot', gelb: 'Gelb', blau: 'Blau', weiß: 'Weiß', schwarz: 'Schwarz' }
const label = id => id.charAt(0).toUpperCase() + id.slice(1)
const FUNNY = [() => sfx.giggle(), () => sfx.burp(), () => { sfx.boing(); sfx.giggle() }, () => sfx.sparkle()]

// A squirt flies in a bow from the tap into the tank
function bow(a, b, lift, steps = 8) {
  const xs = [], ys = []
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    xs.push(a.x + (b.x - a.x) * t)
    ys.push(a.y + (b.y - a.y) * t - lift * 4 * t * (1 - t))
  }
  return { x: xs, y: ys }
}

export default function PainterGame({ level = 1, onComplete }) {
  const [plan] = useState(() => planLevel(level))
  const total = plan.monsters.length
  const reduce = useReducedMotion()
  const { later, afterSpeech, paused } = useLater()
  const [bursts, burst] = useBursts()

  // The play area, and where everything stands in it
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
  const L = useMemo(() => box && layoutFor(box.w, box.h, plan.taps.length, total, plan.line), [box, plan, total])
  const ready = !!L

  const [idx,    setIdx]    = useState(0)       // the monster under the shower
  const [phase,  setPhase]  = useState('enter') // enter · mix · pour · happy · hop · compare · wash · rest · finale
  const [tank,   setTank]   = useState([])      // paints in the tank
  const [flying, setFlying] = useState([])      // squirts on their way: { id, paint, i }
  const [skin,   setSkin]   = useState(null)    // the colour on the monster (null: none yet)
  const [look,   setLook]   = useState('down')  // where it looks after a miss: down · side · no
  const [misses, setMisses] = useState(0)       // showers that did not match, for this monster
  const [rain,   setRain]   = useState(null)    // { kind, hex }
  const [puddle, setPuddle] = useState(null)
  const [glitter, setGlitter] = useState(false)
  const [parade, setParade] = useState([])      // [{ kind, color, label }]
  const [party,  setParty]  = useState(false)
  const [poked,  setPoked]  = useState(null)    // { i, n }: a parade monster wiggles
  const [wobble, setWobble] = useState(0)       // the full tank says no
  const [turn,   setTurn]   = useState(0)       // turns of the drain's wheel
  const [rattle, setRattle] = useState(0)       // the lever was pulled with an empty tank
  const [tickle, setTickle] = useState(0)       // the waiting monster was poked: it giggles
  const firstTry = useRef(0)
  const streak   = useRef(0)
  const finished = useRef(false)
  const squirtId = useRef(0)
  const tapEls   = useRef({})
  const leverEl  = useRef(null)
  const drainEl  = useRef(null)
  const lastHex  = useRef('#ffffff')
  const lastWord = useRef(null)

  // A colour's word, unless it is the one Lumi said last (the wish always)
  const sayColour = (id, always = false) => {
    const w = COLORS[id]?.word
    if (!w || (!always && w === lastWord.current)) return
    lastWord.current = w
    narrate([colorWord(w)])
  }

  const mon = plan.monsters[Math.min(idx, total - 1)]
  const mixed = mixOf(tank)
  if (mixed) lastHex.current = hexOf(mixed)

  useEffect(() => () => leaveGame(), [])

  // On screen, for the bursts: a point of the canvas
  const onScreen = (x, y) => {
    const r = rootRef.current.getBoundingClientRect()
    return { x: r.left + x * L.s, y: r.top + y * L.s }
  }

  // A monster walks in; once it stands under the shower, its wish is said.
  useEffect(() => {
    if (!ready || idx >= total) return
    lockPreviews()
    setPhase('enter')
    if (!reduce) [150, 400, 650, 900].forEach(ms => later(ms, () => sfx.step()))
    later(reduce ? 300 : 1050, () => {
      setPhase('mix')
      // after any praise still being spoken, not over it
      afterSpeech(() => sayColour(plan.monsters[idx].target, true))
    })
  }, [idx, ready]) // eslint-disable-line react-hooks/exhaustive-deps

  // The taps work whenever the shower is not running: an impatient child
  // may fill the tank while the next monster is still walking in.
  const canFill = phase !== 'pour' && phase !== 'rest' && phase !== 'finale'
  const squirt = (paint, i) => {
    if (!canFill || paused) return
    if (tank.length + flying.length >= MAX_SQUIRTS) { setWobble(w => w + 1); sfx.bump(); return }
    sfx.pop()
    sayColour(paint)
    const id = ++squirtId.current
    setFlying(f => [...f, { id, paint, i }])
    later(reduce ? 0 : 400, () => {
      setFlying(f => f.filter(x => x.id !== id))
      setTank(t => [...t, paint])
      sfx.flip()
    })
  }

  const drain = () => {
    if (!canFill || paused || !tank.length || flying.length) return
    setTank([])
    setTurn(t => t + 1)
    sfx.slideDown()
  }

  // The lever: the paint rains down and the monster takes it on.
  const pull = () => {
    if (paused || flying.length) return
    // nothing in the tank yet: the lever only rattles
    if (phase === 'mix' && !tank.length) { setRattle(r => r + 1); sfx.bump(); return }
    if (phase !== 'mix' || !tank.length) return
    const got = mixOf(tank), hex = hexOf(got), missed = misses
    setPhase('pour')
    setRattle(0)
    setTank([])
    setPuddle(null)
    setRain({ kind: 'paint', hex })
    sfx.drum()
    sfx.whoosh()
    later(140, () => sfx.splash())
    later(reduce ? 0 : 260, () => setSkin(got))
    later(reduce ? 500 : 1450, () => { setRain(null); setPuddle(hex) })
    later(reduce ? 700 : 1750, () => judge(got, missed))
  }

  const judge = (got, missed) => {
    sayColour(got)
    if (got === mon.target) {
      if (missed) streak.current = 0
      else { firstTry.current += 1; streak.current += 1 }
      setPhase('happy')
      FUNNY[idx % FUNNY.length]()
      burst(onScreen(L.mon.x + L.mon.size / 2, L.mon.y + L.mon.size / 2), 'stars', 12)
      afterSpeech(() => { lastWord.current = null; sayRight() }, 450)
      later(reduce ? 900 : 1700, hop)
      return
    }
    // Not what it wished for: the wish comes next to it, so both can be
    // compared; it looks at itself, at the wish, and shakes its head.
    streak.current = 0
    setLook('down')
    setPhase('compare')
    sfx.boing()
    afterSpeech(() => { lastWord.current = null; sayWrong() }, 450)
    later(650, () => setLook('side'))
    later(1350, () => { setLook('no'); sfx.mismatch() })
    later(reduce ? 2000 : 2500, wash)
  }

  // A bucket of water: clean again, and one more try.
  const wash = () => {
    setPhase('wash')
    later(reduce ? 0 : 450, () => { setRain({ kind: 'water' }); sfx.splash(); setSkin(null); setPuddle(null) })
    later(reduce ? 500 : 1500, () => setRain(null))
    later(reduce ? 700 : 1850, () => { setMisses(m => m + 1); setPhase('mix') })
  }

  // Up onto the parade shelf
  const hop = () => {
    setPhase('hop')
    sfx.slideUp()
    later(reduce ? 200 : 760, () => {
      const at = slotAt(L.shelf, idx)
      setParade(p => [...p, { kind: mon.kind, color: mon.target, label: label(mon.target) }])
      sfx.coin()
      burst(onScreen(at.x + at.size / 2, at.y + at.size / 2), 'stars', 8)
      setSkin(null)
      setPuddle(null)
      setMisses(0)
      // three in a row with the first shower: it rains glitter
      const shine = streak.current > 0 && streak.current % 3 === 0
      setParty(true)
      if (!shine) later(900, () => setParty(false))
      if (shine) {
        setGlitter(true)
        sfx.sparkle()
        later(300, () => { sfx.combo(5); burst(onScreen(L.mouth.x, L.machine.y + 230 * L.u), 'stars', 16) })
        later(1700, () => { setGlitter(false); setParty(false) })
      }
      if (idx + 1 >= total) { setPhase('rest'); later(shine ? 1800 : 700, () => setPhase('finale')) }
      else { setPhase('enter'); setIdx(idx + 1) }
    })
  }

  // The parade dances, then the results
  useEffect(() => {
    if (phase !== 'finale') return
    sfx.tada()
    const mid = () => { const r = rootRef.current.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } }
    later(150, () => burst(mid(), 'confetti', 24))
    later(1000, () => { burst(mid(), 'stars', 14); sfx.combo(6) })
    later(1900, () => burst(mid(), 'confetti', 20))
    later(reduce ? 1600 : 3200, () => {
      if (finished.current) return
      finished.current = true
      onComplete(result(firstTry.current, total))
    })
  }, [phase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poking the monster under the shower: it giggles (nothing else happens)
  const tickleIt = () => {
    if (phase !== 'mix' || paused) return
    const n = tickle + 1
    setTickle(n)
    sfx.giggle()
    later(650, () => setTickle(t => (t === n ? 0 : t)))
  }

  const poke = i => {
    setPoked({ i, n: Math.random() })
    ;(i % 2 ? sfx.boing : sfx.giggle)()
  }

  // ── What the hand shows: the next step towards the wish ──────────────────
  const recipe = recipeOf(mon.target)
  const showRecipe = mon.recipe || misses >= 2
  const mixing = phase === 'mix' && !flying.length
  let step = null // a paint, 'lever' or 'drain'
  if (mixing) {
    if (mixed === mon.target) step = 'lever'
    else if (tank.some(p => !recipe.includes(p)) || tank.length >= MAX_SQUIRTS) step = 'drain'
    else step = recipe.find(p => !tank.includes(p)) ?? 'lever'
  }
  const guided = showRecipe || (level <= 2 && idx === 0)
  const hintDelay = level === 1 && idx === 0 && !tank.length ? 2200 : guided ? 3500 : 9000
  const hintEl = step === 'lever' ? leverEl : step === 'drain' ? drainEl : step ? { current: tapEls.current[step] } : null

  const leverState = phase === 'pour' ? 'down' : mixing && tank.length ? 'ready' : 'off'
  const mood = phase === 'pour' || phase === 'wash' ? 'wet'
    : phase === 'happy' || phase === 'hop' ? 'happy'
    : phase === 'compare' ? look
    : tickle ? 'happy'
    : phase === 'mix' && tank.length ? 'up' : 'idle'
  const moving = phase === 'pour' || phase === 'wash' ? 'fd-shiver'
    : phase === 'happy' ? 'fd-dance'
    : phase === 'enter' ? 'fd-waddle'
    : phase === 'compare' ? (look === 'no' ? 'fd-shake' : undefined)
    : tickle ? 'fd-wiggle'
    : 'fd-bob'

  return (
    <MotionConfig reducedMotion="user">
    <div ref={rootRef} className="fd-root" data-phase={phase} data-wish={mon.target} data-recipe={recipe.join('+')} data-monster={idx}
      style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', userSelect: 'none', WebkitUserSelect: 'none' }}>
      {L && (
        <div style={{ position: 'absolute', left: 0, top: 0, width: L.cw, height: L.ch, transform: `scale(${L.s})`, transformOrigin: '0 0' }}>
          {/* the bathroom: a warm wall, a wooden floor */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(90deg, #ffe9c6 0 26px, #ffdfb0 26px 52px)' }} />
          <div aria-hidden="true" style={{
            position: 'absolute', left: 0, right: 0, top: L.floorY + 4, bottom: 0, borderTop: `4px solid ${INK}`,
            background: 'repeating-linear-gradient(0deg, #c98a52 0 20px, #b97a45 20px 23px)',
          }} />

          <Shelf shelf={L.shelf} total={total} parade={parade} party={party || phase === 'finale'} poked={poked} onPoke={poke} />

          {/* the taps, on their board */}
          <TapBoard taps={L.taps} />
          {plan.taps.map((p, i) => {
            const t = L.taps[i], full = tank.length + flying.length >= MAX_SQUIRTS
            const wanted = showRecipe && mixing && recipe.includes(p) && !tank.includes(p) && step !== 'drain'
            return (
              <motion.button key={p} type="button" className="fd-btn" aria-label={LABEL[p]} ref={el => { tapEls.current[p] = el }}
                onClick={() => squirt(p, i)} whileTap={reduce ? undefined : { scaleY: 0.84, scaleX: 1.07 }}
                style={{ left: t.x, top: t.y, width: t.size, height: t.size * 1.1, originY: 1, zIndex: 3, opacity: full && canFill ? 0.6 : 1 }}>
                <div className={wanted ? 'fd-nudge' : undefined} style={{ width: '100%', height: '100%' }}><TapArt hex={hexOf(p)} /></div>
              </motion.button>
            )
          })}

          {/* the shower */}
          <div style={{ position: 'absolute', left: L.machine.x, top: L.machine.y, width: L.machine.w, height: L.machine.h, zIndex: 2 }}>
            <Machine squirts={tank.length} hex={lastHex.current} slow={phase === 'pour'} puddle={puddle} wobble={wobble} />
          </div>
          <button type="button" className="fd-btn" aria-label="Tank leeren" aria-disabled={!(canFill && tank.length)} ref={drainEl} onClick={drain}
            style={{ left: L.drain.x, top: L.drain.y, width: L.drain.size, height: L.drain.size, zIndex: 3 }}>
            <Drain on={canFill && tank.length > 0} turn={turn} />
          </button>
          <button type="button" className="fd-btn" aria-label="Dusche an" aria-disabled={leverState !== 'ready'} ref={leverEl} onClick={pull}
            style={{ left: L.lever.x, top: L.lever.y, width: L.lever.size, height: L.lever.size, zIndex: 3 }}>
            <div key={rattle} className={leverState === 'ready' ? 'fd-pulse' : rattle ? 'fd-wobble' : undefined} style={{ width: '100%', height: '100%' }}><Lever state={leverState} /></div>
          </button>

          {/* the monster under the shower, and the one waiting in line */}
          {[idx, plan.line ? idx + 1 : -1].filter(i => i >= 0 && i < total && phase !== 'finale' && phase !== 'rest').map(i => {
            const m = plan.monsters[i], cur = i === idx
            const q = L.queue ?? L.mon
            const at = slotAt(L.shelf, idx)
            const k = cur ? 1 : q.size / L.mon.size
            const to = !cur ? { x: q.x, y: q.y, scale: k }
              : phase === 'hop' ? { x: [L.mon.x, Math.min((L.mon.x + at.x) / 2 + L.mon.size * 0.7, L.cw - L.mon.size), at.x], y: [L.mon.y, (L.mon.y + at.y) / 2 - L.mon.size * 0.3, at.y], scale: [1, 0.85, at.size / L.mon.size] }
              : { x: phase === 'compare' ? L.monCmpX : L.mon.x, y: L.mon.y, scale: 1 }
            return (
              <motion.div key={i} data-actor={cur ? 'shower' : 'line'} onClick={cur ? tickleIt : undefined}
                initial={{ x: L.entryX, y: cur ? L.mon.y : q.y, scale: k }} animate={to}
                transition={reduce ? { duration: 0.01 } : cur && phase === 'hop' ? { duration: 0.72, ease: 'easeInOut' } : { duration: cur && phase === 'compare' ? 0.3 : 0.95, ease: 'easeOut' }}
                style={{ position: 'absolute', left: 0, top: 0, width: L.mon.size, height: L.mon.size, originX: 0, originY: 0, zIndex: cur && phase === 'hop' ? 12 : 4, pointerEvents: cur && phase === 'mix' ? 'auto' : 'none' }}>
                <div key={cur ? tickle : 0} className={cur ? moving : 'fd-bob'} style={{ width: '100%', height: '100%' }}>
                  <Monster kind={m.kind} color={cur ? skin : null} size={L.mon.size} mood={cur ? mood : 'idle'}
                    wipe={phase === 'wash' ? 0.8 : 1.05} drip={cur && skin && phase !== 'pour' && phase !== 'hop' ? hexOf(skin) : null} />
                </div>
              </motion.div>
            )
          })}

          {/* paint, water or glitter from the shower head, over the monster */}
          {(rain || glitter) && (
            <div aria-hidden="true" style={{ position: 'absolute', left: L.machine.x, top: L.machine.y, width: L.machine.w, height: L.machine.h, zIndex: 5, pointerEvents: 'none' }}>
              <Rain kind={rain ? rain.kind : 'glitter'} hex={rain?.hex} />
            </div>
          )}
          <AnimatePresence>
            {phase === 'wash' && (
              <div key="bucket" style={{ position: 'absolute', left: L.machine.x + 34 * L.u, top: L.machine.y + 196 * L.u, zIndex: 7, pointerEvents: 'none' }}>
                <Bucket size={74 * L.u} />
              </div>
            )}
          </AnimatePresence>

          {/* the wishes */}
          <AnimatePresence>
            {(phase === 'mix' || phase === 'pour' || phase === 'compare' || phase === 'wash' || phase === 'happy') && (
              <Bubble key={`wish${idx}`} rect={phase === 'compare' ? L.bubbleCmp : L.bubble} big={phase === 'compare'}
                kind={mon.kind} target={mon.target} recipe={showRecipe ? recipe : null} label={`Wunsch: ${label(mon.target)}`} />
            )}
            {plan.line && idx + 1 < total && phase !== 'finale' && phase !== 'rest' && phase !== 'hop' && (
              <Bubble key={`next${idx + 1}`} rect={L.queueBubble} tail={L.queueBubble.tail} delay={0.9}
                kind={plan.monsters[idx + 1].kind} target={plan.monsters[idx + 1].target} label={`Danach: ${label(plan.monsters[idx + 1].target)}`} />
            )}
          </AnimatePresence>

          {/* squirts on their way into the tank */}
          {flying.map(f => {
            const t = L.taps[f.i]
            const path = bow({ x: t.x + t.size / 2, y: t.y + 4 }, L.mouth, L.mode === 'tall' ? 40 : 30)
            return (
              <motion.div key={f.id} aria-hidden="true" initial={{ x: path.x[0], y: path.y[0], scale: 0.7 }} animate={{ ...path, scale: 1.1 }}
                transition={{ duration: 0.4, ease: 'linear' }} style={{ position: 'absolute', left: -15, top: -16, zIndex: 11, pointerEvents: 'none' }}>
                <Drop hex={hexOf(f.paint)} size={30} />
              </motion.div>
            )
          })}

          {phase === 'finale' && <Finale parade={parade} wide={L.cw > L.ch} cw={L.cw} ch={L.ch} />}
        </div>
      )}
      <HintHand key={`${idx}-${step}`} to={hintEl} active={mixing && !!hintEl} delay={hintDelay} />
      {bursts}
    </div>
    </MotionConfig>
  )
}

// The board the taps stand on, so they read as one set of things to press
function TapBoard({ taps }) {
  const x0 = Math.min(...taps.map(t => t.x)), x1 = Math.max(...taps.map(t => t.x + t.size))
  const y0 = Math.min(...taps.map(t => t.y)), y1 = Math.max(...taps.map(t => t.y + t.size * 1.1))
  return (
    <div aria-hidden="true" style={{
      position: 'absolute', left: x0 - 7, top: y0 - 5, width: x1 - x0 + 14, height: y1 - y0 + 12, zIndex: 1,
      background: 'rgba(255,253,247,0.8)', border: `3px solid ${INK}`, borderRadius: 18, boxShadow: '0 4px 0 rgba(42,27,61,0.25)', boxSizing: 'border-box',
    }} />
  )
}

// The end of a level: every monster of the parade, big, dancing
function Finale({ parade, wide, cw, ch }) {
  const n = parade.length
  const perRow = wide ? n : n <= 4 ? 2 : n <= 6 ? 3 : 4
  const size = Math.min(140, (cw - 30) / perRow - 8, ch * 0.4)
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      style={{ position: 'absolute', inset: 0, zIndex: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'radial-gradient(circle at 50% 55%, rgba(255,253,247,0.95), rgba(255,253,247,0.78) 70%)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'center', gap: 8, maxWidth: perRow * (size + 8) + 8 }}>
        {parade.map((m, i) => (
          <motion.div key={i} initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: i * 0.08, type: 'spring', stiffness: 260, damping: 16 }}>
            <div className="fd-dance" style={{ animationDelay: `${(i % 3) * -0.27}s` }}>
              <Monster kind={m.kind} color={m.color} size={size} mood="happy" wipe={0} />
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
