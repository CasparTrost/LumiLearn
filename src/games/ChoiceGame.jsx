import { useState, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateQuestions } from './gameEngine.js'
import { sfx } from '../sfx.js'
import { sayNumber } from '../tts.js'
import { narrate, lockPreviews, afterNarration } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { hearable } from '../lib/hearable.js'
import { result } from '../lib/score.js'
import HearOptions from '../components/HearOptions.jsx'
import { pxCard, pxPanel, pxButton, pxSegment, INK } from './px.js'

// Fixed star burst positions
const BURST_STARS = [0,1,2,3,4,5,6,7].map(i => {
  const angle = (i / 8) * Math.PI * 2
  const r = 34 + (i % 2) * 18
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r - 10, e: ['⭐','✨','🌟','💫','⭐','✨','🌟','💥'][i] }
})

// The row flies in symbol by symbol; the question is asked once it is there.
const FLY_STEP = 0.19

function Cloud({ xStart, top, size, duration }) {
  return (
    <motion.div
      initial={{ x: xStart }}
      animate={{ x: -200 }}
      transition={{ duration, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
      style={{ position: 'absolute', top, left: 0, fontSize: size, opacity: 0.75, pointerEvents: 'none', userSelect: 'none', lineHeight: 1 }}
    >{'☁️'}</motion.div>
  )
}

function StarBurst({ x, y, onDone }) {
  return (
    <>
      {BURST_STARS.map((s, i) => (
        <motion.div
          key={i}
          initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
          animate={{ x: s.dx, y: s.dy, scale: [0, 1.3, 0], opacity: [1, 1, 0] }}
          transition={{ duration: 0.72, delay: i * 0.03, ease: 'easeOut' }}
          onAnimationComplete={i === BURST_STARS.length - 1 ? onDone : undefined}
          style={{ position: 'absolute', left: x, bottom: y, fontSize: 18, lineHeight: 1, pointerEvents: 'none', zIndex: 30 }}
        >{s.e}</motion.div>
      ))}
    </>
  )
}

// The dino eats the pattern: a right answer flies into its mouth. It used to
// be a 210 px arcade of its own — cacti rolling in on mistakes, a strength
// bar, "Tippe den Dino – er hüpft gern!" — that drew the eye away from the
// row the child is meant to look at. Now it is a small strip and only
// reacts to answers.
function DinoScene({ chomping, shaking, dinoScale, projectiles, puffIds, bursts, onProjDone, onPuffDone, onBurstDone }) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'relative', width: '100%', maxWidth: 760, height: 104,
        border: `3px solid ${INK}`, borderRadius: 14, overflow: 'hidden',
        background: 'linear-gradient(180deg, #3A8BC5 0%, #6AB9E8 62%, #72C945 62%, #4A9A22 100%)',
        boxShadow: '0 5px 0 rgba(42,27,61,0.35)',
        flexShrink: 0, pointerEvents: 'none',
      }}
    >
      <Cloud xStart={900}  top={6}  size={22} duration={16} />
      <Cloud xStart={1300} top={22} size={18} duration={22} />

      {/* Ground */}
      <div style={{ position: 'absolute', bottom: 0, height: 26, width: '100%', background: '#4A9A22', borderTop: '3px solid #3A8015' }} />

      {/* Dino — wrapped in scaleX(-1) so it faces the incoming food */}
      <div style={{
        position: 'absolute', left: '8%', bottom: 22,
        transform: 'scaleX(-1)', transformOrigin: 'bottom center',
        zIndex: 10,
      }}>
        <motion.div
          animate={
            chomping
              ? { y: [0, -26, -34, -18, 0], scaleX: [1, 0.82, 1.12, 0.92, 1], scaleY: [1, 1.18, 0.84, 1.1, 1] }
              : shaking
              ? { x: [0, -8, 8, -5, 5, 0], rotate: [0, -6, 6, -4, 4, 0] }
              : { y: [0, -4, 0], scaleY: [1, 0.96, 1] }
          }
          transition={
            chomping ? { duration: 0.58, times: [0, 0.22, 0.44, 0.70, 1] }
            : shaking ? { duration: 0.5 }
            : { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{
            fontSize: `calc(${dinoScale} * 54px)`,
            lineHeight: 1,
            filter: 'drop-shadow(0 3px 0 rgba(42,27,61,0.35))',
            userSelect: 'none', transformOrigin: 'bottom center',
          }}
        >{'🦖'}</motion.div>
      </div>

      {/* The answer flies in from the right into the dino's mouth */}
      <AnimatePresence>
        {projectiles.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: 640, y: -16, rotate: 0, scale: 0.8 }}
            animate={{ x: 10, y: 6, rotate: -360, scale: 1.1 }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.6, ease: [0.22, 0.68, 0.45, 0.92] }}
            onAnimationComplete={() => onProjDone(p.id)}
            style={{ position: 'absolute', left: '8%', bottom: 46, fontSize: 30, lineHeight: 1, pointerEvents: 'none', zIndex: 15 }}
          >{p.food}</motion.div>
        ))}
      </AnimatePresence>

      {/* Puff on a wrong answer */}
      <AnimatePresence>
        {puffIds.map(id => (
          <motion.div
            key={id}
            initial={{ x: 20, y: 0, scale: 0, opacity: 0.9 }}
            animate={{ x: 60, y: -24, scale: 2.2, opacity: 0 }}
            transition={{ duration: 0.6 }}
            onAnimationComplete={() => onPuffDone(id)}
            style={{ position: 'absolute', left: '8%', bottom: 50, fontSize: 20, lineHeight: 1, pointerEvents: 'none', zIndex: 20 }}
          >{'💨'}</motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence>
        {bursts.map(b => (
          <StarBurst key={b.id} x="10%" y={52} onDone={() => onBurstDone(b.id)} />
        ))}
      </AnimatePresence>
    </div>
  )
}

// What the voice says about a question.
const nameOf = (q, e) => q.names[e] ?? ''
// pictures in a string, without the emoji variation selector
const glyphs = s => [...s].filter(ch => ch !== '\uFE0F').length
const countOf = (q, opt) => glyphs(opt) / glyphs(q.sym)

function optionName(q, opt) {
  return q.kind === 'grow' ? sayNumber(countOf(q, opt)) : nameOf(q, opt)
}

// "Genau! Immer wieder Frosch, Frosch, Hund."
function praiseFor(q) {
  if (q.kind === 'grow') return `${q.counts.map(sayNumber).join(', ')}. Es wird immer eins mehr.`
  if (q.kind === 'build') return `${q.fill.map(e => nameOf(q, e)).join(', ')}!`
  return `Immer wieder ${q.unit.map(e => nameOf(q, e)).join(', ')}.`
}

// After a miss the row is read out, so the child can hear the rhythm:
// "Hör mal! Frosch, Hund, Frosch, Hund, Frosch – und dann?"
function hintFor(q, placed = []) {
  if (q.kind === 'build') return `Hör mal! ${[...q.tokens.slice(0, q.gapAt), ...placed].map(e => nameOf(q, e)).join(', ')}, und dann?`
  if (q.kind === 'grow') return `Hör mal! ${q.counts.slice(0, 3).map(sayNumber).join(', ')}, und dann?`
  if (q.kind === 'gap') {
    const said = q.tokens.map(t => (t === '❓' ? 'und hier?' : nameOf(q, t)))
    return `Hör mal! ${said.join(', ')}.`
  }
  return `Hör mal! ${q.tokens.slice(0, -1).map(e => nameOf(q, e)).join(', ')}, und dann?`
}

export default function ChoiceGame({ moduleId, level, onComplete }) {
  const [questions]   = useState(() => generateQuestions(moduleId, level))
  const [idx,         setIdx]         = useState(0)
  const [wrong,       setWrong]       = useState([])      // options already tried this round
  const [solved,      setSolved]      = useState(false)
  const [firstTry,    setFirstTry]    = useState(0)
  const [missed,      setMissed]      = useState([])      // rounds not solved on the first try
  const [chomping,    setChomping]    = useState(false)
  const [shaking,     setShaking]     = useState(false)
  const [flashType,   setFlashType]   = useState(null)
  const [flashId,     setFlashId]     = useState(0)
  const [highlighted, setHighlighted] = useState(null)
  const [projectiles, setProjectiles] = useState([])
  const [puffIds,     setPuffIds]     = useState([])
  const [bursts,      setBursts]      = useState([])
  // build rounds: the pieces laid so far, the piece bouncing back after a
  // miss, and the misses on the current place
  const [placed,      setPlaced]      = useState([])
  const [bounce,      setBounce]      = useState(null)
  const [missesHere,  setMissesHere]  = useState(0)
  const effectIdRef = useRef(0)

  // dino grows by 3% per answer right on the first try, max 1.3×
  const dinoScale = Math.min(1 + firstTry * 0.03, 1.3)

  const q = questions[idx]

  // A wrong answer no longer ends the question: the card is greyed out, the
  // row is read out loud, and the child tries again. Stars count the answers
  // right on the first try.
  const pick = useCallback((opt) => {
    if (solved || !q || wrong.includes(opt)) return
    const ok = opt === q.answer
    setFlashId(n => n + 1)
    if (ok) {
      setSolved(true)
      if (!wrong.length) setFirstTry(n => n + 1)
      setChomping(true)
      setFlashType('ok')
      const pid = ++effectIdRef.current
      setProjectiles(prev => [...prev, { id: pid, food: opt }])
      const bid = ++effectIdRef.current
      setBursts(prev => [...prev, { id: bid }])
      sfx.correct()
      sayRight(praiseFor(q))
      setTimeout(() => setChomping(false), 820)
      setTimeout(() => setFlashType(null), 400)
    } else {
      setWrong(w => [...w, opt])
      setMissed(m => (m.includes(idx) ? m : [...m, idx]))
      setShaking(true)
      setFlashType('err')
      sfx.wrong()
      sayWrong(hintFor(q))
      const pid = ++effectIdRef.current
      setPuffIds(prev => [...prev, pid])
      setTimeout(() => setShaking(false), 700)
      setTimeout(() => setFlashType(null), 400)
    }
  }, [solved, q, wrong, idx])

  // Build rounds: a tapped piece goes to the next empty place. Lumi says the
  // pieces laid so far; a wrong one bounces back to the tray, and after two
  // misses on one place the right piece lights up and is named.
  const place = useCallback((opt) => {
    if (solved || !q) return
    const want = q.fill[placed.length]
    if (opt === want) {
      const next = [...placed, opt]
      setPlaced(next)
      setMissesHere(0)
      setBounce(null)
      if (next.length < q.fill.length) {
        sfx.pop()
        narrate([{ text: `${next.map(e => nameOf(q, e)).join(', ')}!` }])
        return
      }
      setSolved(true)
      if (!wrong.length) setFirstTry(n => n + 1)
      setChomping(true)
      setFlashId(n => n + 1)
      setFlashType('ok')
      setProjectiles(prev => [...prev, { id: ++effectIdRef.current, food: opt }])
      setBursts(prev => [...prev, { id: ++effectIdRef.current }])
      sfx.correct()
      sayRight(praiseFor(q))
      setTimeout(() => setChomping(false), 820)
      setTimeout(() => setFlashType(null), 400)
    } else {
      const n = missesHere + 1
      setMissesHere(n)
      setWrong(w => [...w, opt])
      setMissed(m => (m.includes(idx) ? m : [...m, idx]))
      setBounce({ e: opt, id: ++effectIdRef.current })
      sfx.mismatch()
      sayWrong(n >= 2 ? `Als Nächstes kommt ${nameOf(q, want)}.` : hintFor(q, placed))
    }
  }, [solved, q, placed, wrong, missesHere, idx])

  const weiterClick = useCallback(() => {
    if (idx + 1 >= questions.length) {
      sfx.complete()
      afterNarration(() => onComplete(result(firstTry, questions.length)), { minMs: 300 })
    } else {
      setIdx(i => i + 1)
    }
  }, [idx, firstTry, questions, onComplete])

  // New round: clear the board, then ask once the row has flown in
  useEffect(() => {
    setHighlighted(null); setWrong([]); setSolved(false)
    setPlaced([]); setBounce(null); setMissesHere(0)
    if (!q) return
    lockPreviews()
    const id = setTimeout(() => sayTask(q.say ?? q.prompt), (q.tokens.length * FLY_STEP + 0.35) * 1000)
    return () => clearTimeout(id)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const choose = q?.kind === 'build' ? place : pick
    const onKey = (e) => {
      if (solved || !q) return
      const opts = q.options
      const num  = parseInt(e.key)
      if (num >= 1 && num <= opts.length) {
        choose(opts[num - 1])
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted(h => h === null ? 0 : Math.min(h + 1, opts.length - 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted(h => h === null ? opts.length - 1 : Math.max(h - 1, 0))
      } else if ((e.key === 'Enter' || e.key === ' ') && highlighted !== null) {
        e.preventDefault()
        choose(opts[highlighted])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, solved, highlighted, pick, place])

  if (!q) return null

  // One line for the whole row: the symbols shrink with their number instead
  // of breaking the pattern over two or three lines on a phone.
  const rowGlyphs = q.tokens.reduce((n, t) => n + glyphs(t), 0)
  const build     = q.kind === 'build'
  // build rounds: room between the empty places, which pulse one at a time
  const rowGap    = q.kind === 'grow' ? 18 : build ? 12 : 6
  const symSize   = `min(76px, calc((min(100vw, 720px) - 7vw - ${16 + rowGap * q.tokens.length}px) / ${rowGlyphs}))`
  const maxOpt    = Math.max(...q.options.map(glyphs))
  const optSize   = maxOpt > 1 ? `min(44px, calc((min(100vw, 720px) - 120px) / ${maxOpt * 2}))` : 'clamp(48px, 11vw, 72px)'
  const isLast    = idx + 1 >= questions.length
  // the right piece, lit up after two misses on one place
  const showPiece = build && !solved && missesHere >= 2 ? q.fill[placed.length] : null

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(12px,2.2vw,24px) clamp(14px,3.5vw,36px)', gap:'clamp(10px,1.8vw,18px)' }}>

      <AnimatePresence>
        {flashType && (
          <motion.div
            key={flashId}
            initial={{ opacity: flashType === 'ok' ? 0.30 : 0.2 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position:'fixed', inset:0, zIndex:150, pointerEvents:'none',
                     background: flashType === 'ok' ? '#6BCB77' : '#FF6B6B' }}
          />
        )}
      </AnimatePresence>

      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:760, flexShrink:0 }}>
        {questions.map((_, i) => (
          <div key={i} style={{
            flex:1,
            ...pxSegment(i < idx || (i === idx && solved) ? 'done' : i === idx ? 'current' : 'todo'),
            // answered, but not on the first try
            ...((i < idx || (i === idx && solved)) && missed.includes(i) ? { background: '#F3A091' } : {}),
            transition:'background 0.3s',
          }} />
        ))}
      </div>

      <DinoScene
        chomping={chomping} shaking={shaking} dinoScale={dinoScale}
        projectiles={projectiles} puffIds={puffIds} bursts={bursts}
        onProjDone={id => setProjectiles(prev => prev.filter(p => p.id !== id))}
        onPuffDone={id => setPuffIds(prev => prev.filter(x => x !== id))}
        onBurstDone={id => setBursts(prev => prev.filter(b => b.id !== id))}
      />

      {/* Question + speaker: reads the task and then every answer */}
      <div style={{ display:'flex', alignItems:'center', gap:10, width:'100%', maxWidth:760, flexShrink:0 }}>
        <AnimatePresence mode="wait">
          <motion.div key={idx}
            initial={{ opacity:0, y:-6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }} transition={{ duration:0.22 }}
            style={{ flex:1, ...pxPanel, padding:'clamp(10px,2vw,16px) clamp(14px,3vw,22px)', fontFamily:'var(--font-heading)', fontSize:'clamp(18px,3.5vw,26px)', color:'var(--text-primary)' }}
          >{q.prompt}</motion.div>
        </AnimatePresence>
        <HearOptions
          size={52}
          label="Aufgabe und Antworten vorlesen"
          items={[q.prompt, ...q.options.map(o => optionName(q, o))]}
        />
      </div>

      {/* The row */}
      <div style={{ flex:1, minHeight:0, width:'100%', maxWidth:760, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <AnimatePresence mode="wait">
          <motion.div key={'row-' + idx}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }} transition={{ duration:0.18 }}
            style={{ display:'flex', alignItems:'center', gap:rowGap, flexWrap:'nowrap', justifyContent:'center', padding:'6px 0' }}
          >
            {q.tokens.map((token, i) => {
              const isQuestion = token === '❓'
              // build rounds fill their places one by one; the others all at once
              const slot       = i - q.gapAt
              const piece      = build ? placed[slot] : solved ? q.answer : null
              const filled     = isQuestion && piece != null
              const waiting    = isQuestion && !solved && (!build || slot === placed.length)
              return (
                <motion.span
                  key={i}
                  initial={{ scale:0, opacity:0, y:16 }}
                  animate={waiting
                    ? { scale:[1,1.15,1], opacity:1, y:0 }
                    : { scale:1, opacity:1, y:0 }}
                  transition={waiting
                    ? { scale:{ delay: i * FLY_STEP, duration:1.1, repeat:Infinity, type:'tween' }, opacity:{ delay: i * FLY_STEP, duration:0.22 }, y:{ delay: i * FLY_STEP, type:'spring', stiffness:340, damping:20 } }
                    : filled ? { type:'spring', stiffness:340, damping:18 }
                    : { delay: i * FLY_STEP, type:'spring', stiffness:340, damping:20 }}
                  style={{
                    fontSize: symSize,
                    lineHeight: 1.1,
                    display: 'inline-flex',
                    whiteSpace: 'nowrap',
                    position: 'relative',
                    // the place asked for: a dashed slot, green once filled
                    ...(isQuestion ? {
                      outline: `3px dashed ${filled ? '#2F8F3A' : INK}`, outlineOffset: 3, borderRadius: 8,
                      background: filled ? '#DDF6CF' : 'var(--px-parch-light)',
                    } : {}),
                  }}
                >
                  {filled ? piece : token}
                  {/* a wrong piece drops in and bounces back down to the tray */}
                  {build && bounce && waiting && (
                    <motion.span key={bounce.id} aria-hidden="true"
                      initial={{ y:'-60%', opacity:0, scale:0.7 }}
                      animate={{ y:['-60%','0%','-18%','140%'], opacity:[0,1,1,0], scale:[0.7,1,1,0.8] }}
                      transition={{ duration:0.9, times:[0,0.3,0.5,1], ease:'easeInOut' }}
                      onAnimationComplete={() => setBounce(b => (b?.id === bounce.id ? null : b))}
                      style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--px-parch-light)', borderRadius:8, pointerEvents:'none' }}
                    >{bounce.e}</motion.span>
                  )}
                </motion.span>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Answers — the pictures as big as in the row (they were 18–26 px).
          In build rounds this is the tray: one row, every piece can be used
          again, a wrong one only wiggles. */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(' + (build ? q.options.length : Math.min(q.options.length, 2)) + ',1fr)', gap:'clamp(10px,2vw,16px)', width:'100%', maxWidth:760, flexShrink:0 }}>
        {q.options.map((opt, oi) => {
          const isCorrect     = opt === q.answer
          const isWrong       = !build && wrong.includes(opt)
          const isHighlighted = !solved && (highlighted === oi || opt === showPiece)
          const cardState = solved && isCorrect ? 'right' : isWrong ? 'wrong' : isHighlighted ? 'selected' : undefined
          const active = !solved && !isWrong
          const bounced = build && bounce?.e === opt
          return (
            <motion.button key={idx + '-' + opt}
              whileHover={active ? { scale:1.04 } : {}}
              whileTap={active ? { scale:0.95 } : {}}
              animate={isWrong ? { x:[0,-10,10,-6,6,0] } : bounced ? { x:[0,-5,5,-3,0] } : { x:0 }}
              transition={{ duration:0.42 }}
              onClick={() => (build ? place(opt) : pick(opt))}
              {...hearable(optionName(q, opt))}
              aria-label={optionName(q, opt)}
              disabled={isWrong}
              style={{
                ...pxCard(cardState),
                minHeight: 'clamp(76px, 12dvh, 112px)', padding:'8px 10px',
                fontSize: optSize, lineHeight: 1, color:'var(--text-primary)',
                cursor: active ? 'pointer' : 'default',
                opacity: isWrong ? 0.45 : 1,
                transition:'background 0.22s, border 0.22s, box-shadow 0.18s, opacity 0.2s',
                display:'flex', alignItems:'center', justifyContent:'center', flexWrap:'nowrap',
              }}
            >
              {opt}
            </motion.button>
          )
        })}
      </div>

      {/* Fixed slot for "Weiter", so nothing jumps when it appears */}
      <div style={{ height: 62, flexShrink: 0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        {solved && (
          <motion.button
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} transition={{ delay: 0.5 }}
            onClick={weiterClick}
            {...hearable(isLast ? 'Fertig' : 'Weiter')}
            style={{
              ...pxButton('green'),
              // ink on green: white text reached only 2.2:1
              color: INK, textShadow: '0 1px 0 rgba(255,255,255,0.35)',
              padding:'12px 40px', fontSize:20, minHeight: 52,
            }}
          >
            {isLast ? '🏁 Fertig!' : 'Weiter! ➡️'}
          </motion.button>
        )}
      </div>
    </div>
  )
}
