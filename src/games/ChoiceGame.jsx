import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateQuestions } from './gameEngine.js'
import { sfx } from '../sfx.js'

const FOODS = ['🍕','🍎','🍗','🌮','🍩','🍓','🧁','🍔','🍒','🥕']

// Fixed star burst positions
const BURST_STARS = [0,1,2,3,4,5,6,7].map(i => {
  const angle = (i / 8) * Math.PI * 2
  const r = 50 + (i % 2) * 28
  return { dx: Math.cos(angle) * r, dy: Math.sin(angle) * r - 15, e: ['⭐','✨','🌟','💫','⭐','✨','🌟','💥'][i] }
})

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
          animate={{ x: s.dx, y: s.dy, scale: [0, 1.4, 0], opacity: [1, 1, 0] }}
          transition={{ duration: 0.72, delay: i * 0.03, ease: 'easeOut' }}
          onAnimationComplete={i === BURST_STARS.length - 1 ? onDone : undefined}
          style={{ position: 'absolute', left: x, bottom: y, fontSize: 22, lineHeight: 1, pointerEvents: 'none', zIndex: 30 }}
        >{s.e}</motion.div>
      ))}
    </>
  )
}

const OBSTACLES = ['🌵','🪨','🌵','🪨','🦴']
let obstIdx = 0

function DinoScene({ chomping, shaking, dinoScale, streak, eaten, total, projectiles, puffIds, bursts, obstacles, jumpTrigger, onProjDone, onPuffDone, onBurstDone, onObstacleDone }) {
  const [jumping, setJumping] = useState(false)
  const jumpingRef = useRef(false)
  const [showJumpHint, setShowJumpHint] = useState(false)
  const hintShownRef = useRef(false)

  const doJump = useCallback(() => {
    if (jumpingRef.current) return
    jumpingRef.current = true
    setJumping(true)
    setTimeout(() => { setJumping(false); jumpingRef.current = false }, 650)
  }, [])

  // Auto-jump when a correct answer is given
  useEffect(() => {
    if (jumpTrigger) doJump()
  }, [jumpTrigger]) // eslint-disable-line react-hooks/exhaustive-deps

  // Show hint when first obstacle appears
  useEffect(() => {
    if (obstacles.length > 0 && !hintShownRef.current) {
      hintShownRef.current = true
      setShowJumpHint(true)
      setTimeout(() => setShowJumpHint(false), 2200)
    }
  }, [obstacles.length])

  const groundDuration = streak >= 4 ? 0.16 : streak >= 2 ? 0.22 : jumping ? 0.18 : chomping ? 0.26 : 0.40

  return (
    <div
      onClick={doJump}
      style={{
        position: 'relative', width: '100%', height: 210,
        borderRadius: 24, overflow: 'hidden',
        background: 'linear-gradient(180deg, #3A8BC5 0%, #6AB9E8 55%, #72C945 55%, #4A9A22 100%)',
        boxShadow: '0 6px 30px rgba(0,0,0,0.16)',
        flexShrink: 0, cursor: 'pointer',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Clouds */}
      <Cloud xStart={900}  top={8}  size={28} duration={13} />
      <Cloud xStart={1200} top={34} size={21} duration={19} />
      <Cloud xStart={1550} top={14} size={24} duration={16} />

      {/* Mountains in background */}
      <div style={{ position: 'absolute', bottom: '45%', left: '55%', width: 0, height: 0,
        borderLeft: '55px solid transparent', borderRight: '55px solid transparent',
        borderBottom: '70px solid #2E7D32', opacity: 0.35 }} />
      <div style={{ position: 'absolute', bottom: '45%', left: '72%', width: 0, height: 0,
        borderLeft: '40px solid transparent', borderRight: '40px solid transparent',
        borderBottom: '52px solid #2E7D32', opacity: 0.28 }} />

      {/* Scrolling ground */}
      <div style={{ position: 'absolute', bottom: 0, height: 40, width: '100%', overflow: 'hidden' }}>
        <motion.div
          animate={{ x: [0, -80] }}
          transition={{ duration: groundDuration * 2.5, repeat: Infinity, ease: 'linear' }}
          style={{ display: 'flex', width: '400%' }}
        >
          {[...Array(64)].map((_, i) => (
            <div key={i} style={{
              width: 40, height: 40, flexShrink: 0,
              background: i % 2 === 0 ? '#4A9A22' : '#5CB82E',
              borderTop: '3px solid #3A8015',
            }} />
          ))}
        </motion.div>
      </div>

      {/* Dino shadow (stretches when jumping) */}
      <motion.div
        animate={{ scaleX: jumping ? 0.6 : 1, opacity: jumping ? 0.18 : 0.28 }}
        transition={{ duration: 0.2 }}
        style={{
          position: 'absolute', left: '8%', bottom: 36,
          width: `calc(${dinoScale} * clamp(36px,8vw,58px))`,
          height: 10, borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          filter: 'blur(5px)',
          transformOrigin: 'center',
          pointerEvents: 'none', zIndex: 6,
        }}
      />

      {/* Dino — wrapped in scaleX(-1) so it faces the incoming food */}
      <div style={{
        position: 'absolute', left: '8%', bottom: 36,
        transform: 'scaleX(-1)', transformOrigin: 'bottom center',
        zIndex: 10,
      }}>
        <motion.div
          animate={
            jumping
              ? { y: [0, -82, -88, -60, 0], scaleX: [1, 0.78, 1.08, 0.92, 1], scaleY: [1, 1.22, 0.88, 1.14, 1] }
              : chomping
              ? { y: [0, -52, -70, -40, 0], scaleX: [1, 0.78, 1.14, 0.90, 1], scaleY: [1, 1.22, 0.80, 1.14, 1] }
              : shaking
              ? { x: [0, -12, 12, -8, 8, -4, 4, 0], rotate: [0, -8, 8, -5, 5, 0] }
              : { y: [0, -9, 0, -6, 0], scaleY: [1, 0.93, 1, 0.96, 1] }
          }
          transition={
            jumping
              ? { duration: 0.65, times: [0, 0.28, 0.44, 0.72, 1], ease: 'easeInOut' }
              : chomping
              ? { duration: 0.58, times: [0, 0.22, 0.44, 0.70, 1] }
              : shaking
              ? { duration: 0.54 }
              : { duration: 0.95, repeat: Infinity, ease: 'easeInOut' }
          }
          style={{
            fontSize: `calc(${dinoScale} * clamp(46px, 9.5vw, 76px))`,
            lineHeight: 1,
            filter: 'drop-shadow(0 5px 10px rgba(0,0,0,0.28))',
            userSelect: 'none', transformOrigin: 'bottom center',
          }}
        >{'🦖'}</motion.div>
      </div>

      {/* Food flying in from the right and arcing down to the dino mouth (left side after flip) */}
      <AnimatePresence>
        {projectiles.map(p => (
          <motion.div
            key={p.id}
            initial={{ x: 680, y: -22, rotate: 0, scale: 0.7 }}
            animate={{ x: -20, y: 10, rotate: -520, scale: 1.4 }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.15 } }}
            transition={{ duration: 0.60, ease: [0.22, 0.68, 0.45, 0.92] }}
            onAnimationComplete={() => onProjDone(p.id)}
            style={{ position: 'absolute', left: '8%', bottom: 62, fontSize: 38, lineHeight: 1, pointerEvents: 'none', zIndex: 15, filter: 'drop-shadow(0 3px 7px rgba(0,0,0,0.25))' }}
          >{p.food}</motion.div>
        ))}
      </AnimatePresence>

      {/* Obstacles (cactus / rock) scroll from right — appear on wrong answers */}
      <AnimatePresence>
        {obstacles.map((o, i) => (
          <motion.div
            key={o.id}
            initial={{ x: 720 }}
            animate={{ x: -120 }}
            transition={{ duration: Math.max(1.8, 2.6 - streak * 0.18), ease: 'linear' }}
            onAnimationComplete={() => onObstacleDone(o.id)}
            style={{
              position: 'absolute', left: '8%', bottom: 36,
              fontSize: 'clamp(24px,5.5vw,38px)', lineHeight: 1,
              pointerEvents: 'none', zIndex: 8,
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.3))',
            }}
          >{OBSTACLES[(obstIdx + i) % OBSTACLES.length]}</motion.div>
        ))}
      </AnimatePresence>

      {/* Smoke puff (wrong answer) */}
      <AnimatePresence>
        {puffIds.map(id => (
          <motion.div
            key={id}
            initial={{ x: 20, y: 0, scale: 0, opacity: 0.9 }}
            animate={{ x: 80, y: -42, scale: 3, opacity: 0 }}
            transition={{ duration: 0.65 }}
            onAnimationComplete={() => onPuffDone(id)}
            style={{ position: 'absolute', left: '8%', bottom: 72, fontSize: 26, lineHeight: 1, pointerEvents: 'none', zIndex: 20 }}
          >{'💨'}</motion.div>
        ))}
      </AnimatePresence>

      {/* Star bursts on correct eat */}
      <AnimatePresence>
        {bursts.map(b => (
          <StarBurst key={b.id} x='8%' y={72} onDone={() => onBurstDone(b.id)} />
        ))}
      </AnimatePresence>

      {/* NOM / Hm speech bubble */}
      <AnimatePresence>
        {(chomping || shaking) && (
          <motion.div
            key={chomping ? 'nom' : 'hm'}
            initial={{ scale: 0, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 580, damping: 22 }}
            style={{
              position: 'absolute',
              left: 'calc(8% + 62px)', bottom: 108,
              background: chomping ? '#FFD93D' : '#FFE8E8',
              borderRadius: 18, padding: '5px 16px',
              fontFamily: 'var(--font-heading)', fontSize: 18, fontWeight: 800,
              color: chomping ? '#7B5800' : '#CC3333',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              whiteSpace: 'nowrap', zIndex: 25,
            }}
          >{chomping ? '😋 NOM!' : '😬 Hm...'}</motion.div>
        )}
      </AnimatePresence>

      {/* "Tippe zum Springen" hint */}
      <AnimatePresence>
        {showJumpHint && (
          <motion.div
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute', left: '50%', bottom: 50,
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.52)', backdropFilter: 'blur(6px)',
              borderRadius: 18, padding: '6px 18px',
              fontFamily: 'var(--font-heading)', fontSize: 14, color: 'white',
              whiteSpace: 'nowrap', pointerEvents: 'none', zIndex: 40,
            }}
          >{'👆 Tippe zum Springen!'}</motion.div>
        )}
      </AnimatePresence>

      {/* Arcade HUD: score */}
      <motion.div
        animate={{ scale: chomping ? [1, 1.28, 1] : 1 }}
        transition={{ duration: 0.28 }}
        style={{
          position: 'absolute', top: 10, right: 14,
          background: 'rgba(0,0,0,0.32)', backdropFilter: 'blur(6px)',
          borderRadius: 14, padding: '6px 15px',
          fontFamily: 'var(--font-heading)', fontSize: 16, fontWeight: 700, color: 'white',
          display: 'flex', alignItems: 'center', gap: 8,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.15)',
          zIndex: 35,
        }}
      >
        <span style={{ fontSize: 18 }}>{'⭐'}</span>
        <span style={{ fontSize: 22, letterSpacing: -1 }}>{eaten}</span>
        <span style={{ opacity: 0.6, fontSize: 14 }}>{'/ ' + total}</span>
      </motion.div>

      {/* Strength bar (top-left) */}
      <div style={{ position: 'absolute', top: 10, left: 14, display: 'flex', flexDirection: 'column', gap: 3, zIndex: 35 }}>
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>{'💪 Stärke'}</div>
        <div style={{ width: 80, height: 10, background: 'rgba(0,0,0,0.30)', borderRadius: 99, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: (total > 0 ? Math.min(eaten / total * 100, 100) : 0) + '%' }}
            transition={{ type: 'spring', stiffness: 160, damping: 22 }}
            style={{ height: '100%', borderRadius: 99,
              background: eaten / total > 0.7 ? 'linear-gradient(90deg,#6BCB77,#00D2AA)'
                        : eaten / total > 0.4 ? 'linear-gradient(90deg,#FFD93D,#FF9F43)'
                        : 'linear-gradient(90deg,#FF9F43,#FF6B6B)' }}
          />
        </div>
      </div>

      {/* Bottom hint: tap =  jump */}
      <div style={{
        position: 'absolute', bottom: 44, right: 14,
        fontFamily: 'var(--font-heading)', fontSize: 11,
        color: 'rgba(255,255,255,0.7)', pointerEvents: 'none', zIndex: 35,
      }}>{'👆 = springen'}</div>
    </div>
  )
}

function speakDE(text) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance((text||'').replace(/[^\w\säöüÄÖÜß.,!?]/g,''))
  u.lang = 'de-DE'; u.rate = 0.8; u.pitch = 1.05
  window.speechSynthesis.speak(u)
}

export default function ChoiceGame({ moduleId, level, onComplete }) {
  const [questions]   = useState(() => generateQuestions(moduleId, level))
  const [idx,         setIdx]         = useState(0)
  const [selected,    setSelected]    = useState(null)
  const [correct,     setCorrect]     = useState(0)
  const [chomping,    setChomping]    = useState(false)
  const [shaking,     setShaking]     = useState(false)
  const [streak,      setStreak]      = useState(0)
  const [flashType,   setFlashType]   = useState(null)
  const [flashId,     setFlashId]     = useState(0)
  const [highlighted, setHighlighted] = useState(null)
  const [projectiles, setProjectiles] = useState([])
  const [puffIds,     setPuffIds]     = useState([])
  const [bursts,      setBursts]      = useState([])
  const [obstacles,   setObstacles]   = useState([])
  const [jumpTrigger, setJumpTrigger] = useState(0)
  const effectIdRef = useRef(0)

  // dino grows by 3% per correct answer, max 1.6×
  const dinoScale = Math.min(1 + correct * 0.03, 1.6)

  // q and pick must be defined before effects that reference them
  const q = questions[idx]

  const pick = useCallback((opt) => {
    if (selected !== null || !q) return
    const ok = opt === q.answer
    const nc = correct + (ok ? 1 : 0)
    setSelected(opt)
    setFlashId(n => n + 1)
    if (ok) {
      const newStreak = streak + 1
      setStreak(newStreak)
      setCorrect(nc)
      setChomping(true)
      setFlashType('ok')
      setJumpTrigger(t => t + 1)
      const pid = ++effectIdRef.current
      const food = FOODS[(nc - 1) % FOODS.length]
      setProjectiles(prev => [...prev, { id: pid, food }])
      const bid = ++effectIdRef.current
      setBursts(prev => [...prev, { id: bid }])
      if (newStreak >= 3) sfx.combo(newStreak)
      else sfx.correct()
      setTimeout(() => setChomping(false), 820)
      setTimeout(() => setFlashType(null), 400)
    } else {
      setStreak(0)
      setShaking(true)
      setFlashType('err')
      sfx.wrong()
      const pid = ++effectIdRef.current
      setPuffIds(prev => [...prev, pid])
      const oid = ++effectIdRef.current
      setObstacles(prev => [...prev, { id: oid }])
      obstIdx++
      setTimeout(() => setShaking(false), 700)
      setTimeout(() => setFlashType(null), 400)
    }
    setTimeout(() => {
      if (idx + 1 >= questions.length) { onComplete({ score: nc, total: questions.length }) }
      else { setIdx(i => i + 1); setSelected(null) }
    }, 1100)
  }, [selected, q, correct, streak, idx, questions, onComplete])

  useEffect(() => { setHighlighted(null) }, [idx])

  useEffect(() => {
    if (q?.prompt) speakDE(q.prompt)
  }, [idx]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => {
      if (selected !== null || !q) return
      const opts = q.options
      const num  = parseInt(e.key)
      if (num >= 1 && num <= opts.length) {
        pick(opts[num - 1])
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        setHighlighted(h => h === null ? 0 : Math.min(h + 1, opts.length - 1))
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        setHighlighted(h => h === null ? opts.length - 1 : Math.max(h - 1, 0))
      } else if ((e.key === 'Enter' || e.key === ' ') && highlighted !== null) {
        e.preventDefault()
        pick(opts[highlighted])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [q, selected, highlighted, pick])

  if (!q) return null

  const cols = Math.min(q.options.length, 2)

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(14px,2.5vw,28px) clamp(14px,3.5vw,36px)', gap:'clamp(12px,2vw,22px)' }}>

      <AnimatePresence>
        {flashType && (
          <motion.div
            key={flashId}
            initial={{ opacity: flashType === 'ok' ? 0.30 : 0.24 }}
            animate={{ opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position:'fixed', inset:0, zIndex:150, pointerEvents:'none',
                     background: flashType === 'ok' ? '#6BCB77' : '#FF6B6B' }}
          />
        )}
      </AnimatePresence>

      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:760 }}>
        {questions.map((_, i) => (
          <div key={i} style={{ flex:1, height:10, borderRadius:99, background: i < idx ? '#6BCB77' : i === idx ? '#FFD93D' : '#ECE8FF', transition:'background 0.3s' }} />
        ))}
      </div>

      <AnimatePresence>
        {streak >= 2 && (
          <motion.div
            key={streak}
            initial={{ scale:0, y:-10, opacity:0 }}
            animate={{ scale:1, y:0, opacity:1 }}
            exit={{ scale:0.5, opacity:0 }}
            transition={{ type:'spring', stiffness:460, damping:20 }}
            style={{
              background: streak >= 5 ? 'linear-gradient(135deg,#E84393,#FF6B6B)'
                : streak >= 4 ? 'linear-gradient(135deg,#FF6B6B,#FF9F43)'
                : streak >= 3 ? 'linear-gradient(135deg,#FF9F43,#FFD93D)'
                : 'linear-gradient(135deg,#FFD93D,#FFA500)',
              borderRadius:30, padding:'7px 22px',
              fontFamily:'var(--font-heading)', fontSize:20, color:'white',
              boxShadow:'0 4px 20px rgba(255,165,0,0.50)',
              pointerEvents:'none', whiteSpace:'nowrap',
              textShadow:'0 2px 8px rgba(0,0,0,0.18)',
            }}
          >
            {'🔥'.repeat(Math.min(streak - 1, 4)) + ' ' + streak + 'x Kombo!'}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dino game scene */}
      <DinoScene
        chomping={chomping} shaking={shaking} dinoScale={dinoScale} streak={streak}
        eaten={correct} total={questions.length}
        projectiles={projectiles} puffIds={puffIds} bursts={bursts} obstacles={obstacles}
        jumpTrigger={jumpTrigger}
        onProjDone={id => setProjectiles(prev => prev.filter(p => p.id !== id))}
        onPuffDone={id => setPuffIds(prev => prev.filter(x => x !== id))}
        onBurstDone={id => setBursts(prev => prev.filter(b => b.id !== id))}
        onObstacleDone={id => setObstacles(prev => prev.filter(o => o.id !== id))}
      />

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div key={idx}
          initial={{ opacity:0, x:18 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:-18 }} transition={{ duration:0.22 }}
          style={{ width:'100%', maxWidth:760, background:'white', borderRadius:22, padding:'clamp(14px,2.8vw,22px) clamp(16px,3.2vw,24px)', boxShadow:'0 4px 24px rgba(107,203,119,0.15)', fontFamily:'var(--font-heading)', fontSize:'clamp(17px,3.5vw,26px)', color:'var(--text-primary)' }}
        >{q.prompt}</motion.div>
      </AnimatePresence>

      {q.visual && (
        <AnimatePresence mode="wait">
          <motion.div key={'vis-' + idx}
            initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:10 }} transition={{ type:'spring', stiffness:280 }}
            style={{
              width:'100%', maxWidth:760,
              background: moduleId === 'patterns' ? 'transparent' : 'white',
              borderRadius: moduleId === 'patterns' ? 0 : 24,
              padding: moduleId === 'patterns' ? '4px 0 12px' : 'clamp(14px,3.5vw,24px) clamp(18px,5vw,36px)',
              boxShadow: moduleId === 'patterns' ? 'none' : '0 8px 32px rgba(107,203,119,0.15)',
            }}
          >
            {moduleId === 'patterns' ? (
              <div style={{ display:'flex', alignItems:'center', gap:'clamp(4px,1.5vw,12px)', flexWrap:'wrap', justifyContent:'center' }}>
                {q.visual.split(/\s+/).filter(Boolean).map((token, i) => {
                  const isQuestion = token === '❓'
                  return (
                    <motion.span
                      key={i}
                      initial={{ scale:0, opacity:0, y:16 }}
                      animate={isQuestion
                        ? { scale:[1,1.18,1], opacity:1, y:0 }
                        : { scale:1, opacity:1, y:0 }}
                      transition={isQuestion
                        ? { scale:{ delay: i * 0.38, duration:1.1, repeat:Infinity, type:'tween' }, opacity:{ delay: i * 0.38, duration:0.22 }, y:{ delay: i * 0.38, type:'spring', stiffness:340, damping:20 } }
                        : { delay: i * 0.38, type:'spring', stiffness:340, damping:20 }}
                      style={{
                        fontSize: isQuestion ? 'clamp(46px,9vw,74px)' : 'clamp(50px,10vw,82px)',
                        lineHeight: 1.1,
                        display: 'inline-block',
                        filter: isQuestion ? 'drop-shadow(0 0 10px rgba(255,200,0,0.55))' : 'none',
                      }}
                    >
                      {token}
                    </motion.span>
                  )
                })}
              </div>
            ) : (
              <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(20px,4.5vw,32px)', color:'var(--text-primary)', textAlign:'center' }}>
                {q.visual}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      <div style={{ display:'grid', gridTemplateColumns:'repeat(' + cols + ',1fr)', gap:'clamp(10px,2vw,16px)', width:'100%', maxWidth:760 }}>
        {q.options.map((opt) => {
          const isCorrect     = opt === q.answer
          const isChosen      = opt === selected
          const done          = selected !== null
          const isHighlighted = !done && highlighted === q.options.indexOf(opt)

          let bg = 'white', border = '3px solid #ECE8FF', shadow = '0 4px 16px rgba(0,0,0,0.06)'
          if (isHighlighted)         { border='3px solid #FFD93D'; shadow='0 0 0 4px rgba(255,217,61,0.35), 0 4px 16px rgba(0,0,0,0.06)' }
          if (done && isCorrect)     { bg='#E8F8EE'; border='3px solid #6BCB77'; shadow='0 8px 28px rgba(107,203,119,0.4)' }
          else if (done && isChosen) { bg='#FFE8E8'; border='3px solid #FF6B6B' }

          return (
            <motion.button key={idx + '-' + String(opt)}
              whileHover={!done ? { scale:1.05 } : {}}
              whileTap={!done ? { scale:0.95 } : {}}
              animate={
                done && isChosen && isCorrect   ? { scale:[1,1.24,0.04], y:[0,-10,-90], opacity:[1,1,0] }
                : done && isChosen && !isCorrect ? { x:[0,-12,12,-8,8,-3,3,0] }
                : {}
              }
              transition={done && isChosen && isCorrect ? { duration:0.55, times:[0,0.32,1] } : { duration:0.42 }}
              onClick={() => pick(opt)}
              style={{ padding:'clamp(14px,3vw,24px) clamp(12px,2.5vw,20px)', borderRadius:22, background:bg, border, boxShadow:shadow, fontFamily:'var(--font-heading)', fontSize:'clamp(18px,3.8vw,26px)', color:'var(--text-primary)', cursor:done?'default':'pointer', transition:'background 0.22s, border 0.22s, box-shadow 0.18s', display:'flex', alignItems:'center', justifyContent:'center', gap:10, position:'relative' }}
            >
              {!done && (
                <span style={{ position:'absolute', top:7, left:10, fontFamily:'var(--font-heading)', fontSize:12, color: isHighlighted ? '#9B7700' : 'var(--text-muted)', background: isHighlighted ? '#FFD93D' : '#ECE8FF', borderRadius:6, padding:'1px 6px', lineHeight:'1.4' }}>
                  {q.options.indexOf(opt) + 1}
                </span>
              )}
              {done && isChosen && !isCorrect ? 'X ' : ''}
              {String(opt)}
            </motion.button>
          )
        })}
      </div>

      <p style={{ fontFamily:'var(--font-heading)', fontSize:15, color:'var(--text-muted)' }}>
        {correct + ' von ' + Math.min(idx + (selected !== null ? 1 : 0), questions.length) + ' richtig'}
      </p>
    </div>
  )
}