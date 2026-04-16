import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

// Sparkle burst that fires when a pair is found
function SparkBurst({ id }) {
  const sparks = Array.from({ length: 10 }, (_, i) => ({
    angle: (i / 10) * 360,
    dist:  55 + Math.random() * 40,
    emoji: ['⭐','✨','🌟','💫'][i % 4],
    size:  16 + Math.random() * 14,
  }))
  return (
    <div style={{ position:'fixed', top:'50%', left:'50%', pointerEvents:'none', zIndex:999 }}>
      {sparks.map((s, i) => (
        <motion.span
          key={i}
          initial={{ x:0, y:0, scale:0, opacity:1 }}
          animate={{
            x: Math.cos(s.angle * Math.PI/180) * s.dist,
            y: Math.sin(s.angle * Math.PI/180) * s.dist,
            scale:[0,1.3,0.8,0], opacity:[1,1,1,0],
          }}
          transition={{ duration:0.7, delay: i*0.03, ease:'easeOut' }}
          style={{ position:'absolute', fontSize:s.size, lineHeight:1, marginLeft:-s.size/2, marginTop:-s.size/2 }}
        >{s.emoji}</motion.span>
      ))}
    </div>
  )
}

/**
 * Memo-Welt — Gedächtnistraining
 * Scientific basis:
 *   • Spacing Effect (Ebbinghaus, 1885) — repeated retrieval over time prevents forgetting.
 *   • Working Memory Training (Klingberg, 2010) — improving working memory capacity
 *     transfers to reading & math performance in children.
 *   • Episodic Memory (Tulving, 1972) — visual context (emoji) creates rich episodic traces.
 */

const EMOJI_PAIRS = [
  // Tier 1 — simple animals
  '🐕','🐱','🐟','🦋','🦁','🐸','🦊','🐼','🦄','🐬',
  '🐮','🐷','🐑','🐔','🐧','🦜','🦉','🐦','🐝','🐢',
  // Tier 2 — more animals & nature
  '🐨','🦖','🐋','🦍','🐆','🦒','🦓','🦛','🦏','🐙',
  '🦀','🦑','🐡','🦈','🦞','🐊','🐍','🦎','🦔','🐿️',
  '🌸','🌻','🌴','🌵','🍄','🌾','🎋','🍁','🌿','🌺',
  // Tier 3 — food
  '🍎','🍕','🍔','🌮','🍩','🍰','🎂','🍦','🍫','🍿',
  '🍌','🍇','🍓','🍒','🥝','🍍','🥭','🫐','🍑','🥥',
  '🥕','🌽','🥦','🍅','🫑','🧄','🧅','🥬','🫛','🥑',
  // Tier 4 — objects & vehicles
  '🚀','🚗','✈️','🚂','🚢','🚁','🛸','🚲','🛴','⛵',
  '🎨','🏆','🎩','🔭','🌊','🎸','🥁','🎹','🎺','🎻',
  '📚','🧪','💡','🔬','📡','🎯','🧲','⚙️','🔑','🪄',
  // Tier 5 — symbols & advanced
  '⭐','🌈','❤️','🔥','💎','🌙','☀️','⚡','❄️','🌊',
  '🎁','🎈','🎊','🎠','🏰','🗼','⛺','🏄','🤿','🎡',
]

function buildCards(count, pool) {
  const pairs   = [...pool].sort(() => Math.random() - 0.5).slice(0, count)
  const doubled = [...pairs, ...pairs].sort(() => Math.random() - 0.5)
  return doubled.map((emoji, id) => ({ id, emoji, flipped: false, matched: false }))
}

export default function MemoryGame({ level = 1, onComplete }) {
  // Scale difficulty across 10 levels
  const pairCount   = level <= 2 ? 4 : level <= 4 ? 6 : level <= 6 ? 8 : level <= 8 ? 10 : 12
  const gridCols    = pairCount <= 4 ? 4 : pairCount <= 6 ? 4 : pairCount <= 8 ? 4 : pairCount <= 10 ? 5 : 6
  const previewSecs = level <= 2 ? 6 : level <= 4 ? 5 : level <= 6 ? 3 : level <= 8 ? 2 : 1
  // Use deeper emoji tiers at higher levels
  const emojiPool   = EMOJI_PAIRS.slice(0, Math.min(8 + (level - 1) * 6, EMOJI_PAIRS.length))

  const [cards,    setCards]    = useState(() => buildCards(pairCount, emojiPool))
  const [flipped,  setFlipped]  = useState([])
  const [locked,   setLocked]   = useState(false)
  const [moves,    setMoves]    = useState(0)
  const [matches,  setMatches]  = useState(0)
  const [mood,     setMood]     = useState('happy')
  const [trophies,       setTrophies]       = useState([])
  const [sparkKey,       setSparkKey]       = useState(null)
  const [endStars,       setEndStars]       = useState(0)
  const [justMatched,    setJustMatched]    = useState(() => new Set())
  const [justMismatched, setJustMismatched] = useState(() => new Set())
  const [matchPopup,     setMatchPopup]     = useState({ visible: false, text: '' })
  const [cursor,         setCursor]         = useState(0)
  // Preview phase: show all cards briefly at start
  const [phase,          setPhase]          = useState('preview') // 'preview' | 'playing'
  const [countdown,      setCountdown]      = useState(previewSecs)

  const flip = useCallback((id) => {
    if (locked || phase !== 'playing') return
    const card = cards[id]
    if (!card || card.flipped || card.matched) return

    sfx.flip()
    const next = cards.map((c, i) => i === id ? { ...c, flipped: true } : c)
    const newFlipped = [...flipped, id]
    setCards(next)
    setFlipped(newFlipped)

    if (newFlipped.length < 2) return

    // Two cards flipped
    setLocked(true)
    setMoves(m => m + 1)

    const [a, b] = newFlipped
    const match  = next[a].emoji === next[b].emoji

    const delay = match ? 520 : 940
    setTimeout(() => {
      if (match) {
        sfx.match()
        const newMatches = matches + 1
        setMatches(newMatches)
        setMood('excited')
        setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, matched: true } : c))
        setJustMatched(new Set([a, b]))
        setTimeout(() => setJustMatched(new Set()), 700)
        const foundEmoji = next[a].emoji
        setMatchPopup({ visible: true, text: foundEmoji + ' MATCH! 🎉' })
        setTimeout(() => setMatchPopup({ visible: false, text: '' }), 950)
        setTrophies(prev => [...prev, foundEmoji])
        setSparkKey(k => (k ?? 0) + 1)

        if (newMatches >= pairCount) {
          sfx.complete()
          // Stars: 3 if moves <= pairCount+2, 2 if <=pairCount*1.7, else 1
          const starCount = moves <= pairCount + 2 ? 3 : moves <= Math.round(pairCount * 1.7) ? 2 : 1
          setEndStars(starCount)
          setTimeout(() => onComplete({ score: pairCount, total: pairCount, bonus: moves, stars: starCount }), 400)
        } else {
          setTimeout(() => setMood('happy'), 800)
        }
      } else {
        sfx.mismatch()
        setMood('encouraging')
        setCards(prev => prev.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c))
        setJustMismatched(new Set([a, b]))
        setTimeout(() => setJustMismatched(new Set()), 640)
        setTimeout(() => setMood('happy'), 700)
      }
      setFlipped([])
      setLocked(false)
    }, delay)
  }, [locked, cards, flipped, matches, moves, pairCount, onComplete])

  // Preview phase countdown
  useEffect(() => {
    if (phase !== 'preview') return
    if (countdown <= 0) {
      setCards(prev => prev.map(c => ({ ...c, flipped: false })))
      setPhase('playing')
      return
    }
    const t = setTimeout(() => setCountdown(n => n - 1), 1000)
    return () => clearTimeout(t)
  }, [phase, countdown])

  // Arrow key navigation + Enter/Space to flip
  useEffect(() => {
    const COLS  = gridCols
    const total = cards.length
    const onKey = (e) => {
      if      (e.key === 'ArrowRight') { e.preventDefault(); setCursor(c => Math.min(c + 1,    total - 1)) }
      else if (e.key === 'ArrowLeft')  { e.preventDefault(); setCursor(c => Math.max(c - 1,    0)) }
      else if (e.key === 'ArrowDown')  { e.preventDefault(); setCursor(c => Math.min(c + COLS, total - 1)) }
      else if (e.key === 'ArrowUp')    { e.preventDefault(); setCursor(c => Math.max(c - COLS, 0)) }
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(cursor) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursor, flip, cards.length, gridCols])

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(16px,4vw,40px)',
      gap:'clamp(14px,2vw,22px)',
    }}>

      {/* Floating MATCH popup */}
      <AnimatePresence>
        {matchPopup.visible && (
          <motion.div
            key={`mp-${sparkKey}`}
            initial={{ y: 0, opacity: 1, scale: 0.7 }}
            animate={{ y: -100, opacity: 0, scale: 1.35 }}
            transition={{ duration: 0.85, ease: 'easeOut' }}
            style={{
              position: 'fixed', top: '46%', left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 300, pointerEvents: 'none',
              fontFamily: 'var(--font-heading)', fontSize: 36, fontWeight: 800,
              color: '#FFD93D', textShadow: '0 3px 18px rgba(0,0,0,0.45)',
              whiteSpace: 'nowrap',
            }}
          >
            {matchPopup.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sparkle burst on match */}
      <AnimatePresence>{sparkKey && <SparkBurst key={sparkKey} id={sparkKey} />}</AnimatePresence>

      {/* End stars overlay */}
      <AnimatePresence>
        {endStars > 0 && (
          <motion.div
            initial={{opacity:0,scale:0.5}} animate={{opacity:1,scale:1}} exit={{opacity:0}}
            transition={{type:'spring',stiffness:300,delay:0.1}}
            style={{
              position:'fixed',top:'50%',left:'50%',transform:'translate(-50%,-50%)',
              zIndex:500,background:'rgba(255,255,255,0.97)',
              borderRadius:32,padding:'32px 48px',textAlign:'center',
              boxShadow:'0 8px 48px rgba(0,0,0,0.18)',
              display:'flex',flexDirection:'column',alignItems:'center',gap:12,
            }}
          >
            <div style={{fontFamily:'var(--font-heading)',fontSize:'clamp(20px,4vw,28px)',color:'var(--text-primary)',fontWeight:700}}>
              {endStars === 3 ? '🏆 Perfekt!' : endStars === 2 ? '🥈 Super!' : '🥉 Gut gemacht!'}
            </div>
            <div style={{display:'flex',gap:8}}>
              {[1,2,3].map(s => (
                <motion.span key={s}
                  initial={{scale:0,rotate:-30}} animate={{scale:1,rotate:0}}
                  transition={{type:'spring',stiffness:400,delay:s*0.15}}
                  style={{fontSize:48,filter:s<=endStars?'none':'grayscale(1) opacity(0.25)'}}>⭐</motion.span>
              ))}
            </div>
            <div style={{fontFamily:'var(--font-heading)',fontSize:16,color:'var(--text-muted)'}}>
              {moves} Versuche · {endStars === 3 ? 'Unschlagbar! 🎉' : endStars === 2 ? 'Toll gespielt!' : 'Weiter üben!'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Trophy shelf */}
      <div style={{
        width:'100%', maxWidth:780,
        minHeight:52,
        background:'linear-gradient(135deg,#FFF9E6,#FFF3CC)',
        borderRadius:18, border:'2px solid #FFD93D',
        padding:'8px 16px',
        display:'flex', alignItems:'center', gap:8, flexWrap:'wrap',
        boxShadow:'0 3px 16px rgba(255,217,61,0.22)',
      }}>
        <span style={{ fontFamily:'var(--font-heading)', fontSize:14, color:'#9B7700', whiteSpace:'nowrap' }}>🏆 Gefunden:</span>
        <AnimatePresence>
          {trophies.map((emoji, i) => (
            <motion.span
              key={i}
              initial={{ scale:0, rotate:-30, y:-20 }}
              animate={{ scale:1, rotate:0, y:0 }}
              transition={{ type:'spring', stiffness:420, damping:16 }}
              style={{ fontSize:28, lineHeight:1, filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.15))' }}
            >{emoji}</motion.span>
          ))}
        </AnimatePresence>
        {trophies.length === 0 && (
          <span style={{ fontFamily:'var(--font-heading)', fontSize:13, color:'#C9A820', fontStyle:'italic' }}>Noch keine Paare…</span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display:'flex', gap:20, alignItems:'center' }}>
        <div style={{
          background:'white', borderRadius:99, padding:'8px 20px',
          fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-secondary)',
          boxShadow:'0 3px 12px rgba(0,0,0,0.07)',
        }}>
          🃏 {matches}/{pairCount} Paare
        </div>
        <div style={{
          background:'white', borderRadius:99, padding:'8px 20px',
          fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-secondary)',
          boxShadow:'0 3px 12px rgba(0,0,0,0.07)',
        }}>
          👆 {moves} Versuche
        </div>
      </div>

      {/* Lumi callout */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={mood} size={80} />
        <div style={{
          flex:1, background:'white', borderRadius:'24px 24px 24px 6px',
          padding:'14px 20px',
          boxShadow:'0 4px 20px rgba(253,121,168,0.12)',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(16px,3.5vw,24px)',
          color:'var(--text-primary)',
        }}>
          {phase === 'preview'
            ? 'Schau genau hin — gleich werden die Karten umgedreht! 👀'
            : 'Finde alle Paare — merkst du dir wo sie sind? 🧠'}
        </div>
      </div>

      {/* Card grid */}
      <div style={{
        display:'grid',
        gridTemplateColumns:`repeat(${gridCols},1fr)`,
        gap:'clamp(10px,2vw,18px)',
        width:'100%', maxWidth:780,
        position:'relative',
      }}>
        {/* Preview countdown overlay */}
        <AnimatePresence>
          {phase === 'preview' && (
            <motion.div
              key="preview-overlay"
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0, scale:0.9 }}
              style={{
                position:'absolute', inset:-8, zIndex:20, borderRadius:28,
                background:'rgba(74,0,224,0.55)', backdropFilter:'blur(3px)',
                display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                gap:10, pointerEvents:'none',
              }}
            >
              <div style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.5vw,24px)', color:'white', textAlign:'center', textShadow:'0 2px 8px rgba(0,0,0,0.4)' }}>
                {'Merke dir alle Paare!'}
              </div>
              <motion.div
                key={countdown}
                initial={{ scale:1.5, opacity:0 }} animate={{ scale:1, opacity:1 }}
                style={{ fontFamily:'var(--font-heading)', fontSize:'clamp(48px,10vw,80px)', fontWeight:800, color:'#FFD93D', lineHeight:1, textShadow:'0 4px 18px rgba(0,0,0,0.5)' }}
              >
                {countdown}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        {cards.map((card) => (
          <motion.div key={card.id}
            onClick={() => flip(card.id)}
            animate={
              justMatched.has(card.id)    ? { scale:[1,1.28,0.92,1.10,1] } :
              justMismatched.has(card.id) ? { x:[0,-11,11,-8,8,-4,4,0], rotate:[0,-3,3,-2,2,0] } :
              {}
            }
            transition={{ duration: 0.50 }}
            style={{ cursor: card.matched ? 'default' : 'pointer', perspective:700,
                     outline: card.id === cursor ? '3px solid #FFD93D' : 'none',
                     outlineOffset: 4, borderRadius: 22 }}
          >
            <motion.div
              animate={{ rotateY: (card.flipped || card.matched || phase === 'preview') ? 0 : 180 }}
              transition={{ type:'spring', stiffness:260, damping:22 }}
              style={{ position:'relative', transformStyle:'preserve-3d', width:'100%', aspectRatio:'1' }}
            >
              {/* Front */}
              <div style={{
                position:'absolute', inset:0, backfaceVisibility:'hidden',
                borderRadius:20,
                background: card.matched
                  ? 'linear-gradient(160deg,#F0FFF4 0%,#C8F5D8 100%)'
                  : 'linear-gradient(160deg,#FFFFFF 0%,#F0EEFF 100%)',
                border: `2.5px solid ${card.matched ? '#6BCB77' : '#D4CCFF'}`,
                boxShadow: card.matched
                  ? '0 2px 0 #A8E6B4, 0 6px 0 #78C988, 0 10px 24px rgba(107,203,119,0.30)'
                  : '0 2px 0 #E0DAFA, 0 5px 0 #B8B0E8, 0 10px 22px rgba(108,99,255,0.18)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'clamp(28px,6.5vw,50px)',
                // top-light sheen
                backgroundImage: card.matched
                  ? 'linear-gradient(160deg,#F0FFF4 0%,#C8F5D8 100%)'
                  : 'linear-gradient(160deg,#FFFFFF 0%,#EDE8FF 100%)',
              }}>
                {/* inner shine strip */}
                <div style={{
                  position:'absolute', inset:0, borderRadius:18, pointerEvents:'none',
                  background:'linear-gradient(135deg,rgba(255,255,255,0.55) 0%,transparent 55%)',
                }} />
                {card.emoji}
              </div>
              {/* Back */}
              <div style={{
                position:'absolute', inset:0, backfaceVisibility:'hidden',
                transform:'rotateY(180deg)',
                borderRadius:20,
                background:'linear-gradient(160deg,#A855F7 0%,#6C3ADE 50%,#3B0FA0 100%)',
                border:'2.5px solid #7C3AED',
                boxShadow:'0 2px 0 #7C3AED, 0 5px 0 #4A00C0, 0 10px 22px rgba(74,0,224,0.35)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:'clamp(22px,5vw,38px)',
                overflow:'hidden',
              }}>
                {/* shine */}
                <div style={{
                  position:'absolute', inset:0, borderRadius:18, pointerEvents:'none',
                  background:'linear-gradient(135deg,rgba(255,255,255,0.22) 0%,transparent 52%)',
                }} />
                {/* dot pattern */}
                <div style={{
                  position:'absolute', inset:0, borderRadius:18, pointerEvents:'none', opacity:0.18,
                  backgroundImage:'radial-gradient(circle, white 1px, transparent 1px)',
                  backgroundSize:'14px 14px',
                }} />
                ✨
              </div>
            </motion.div>
          </motion.div>
        ))}
      </div>

      <p style={{ fontFamily:'var(--font-heading)', fontSize:12, color:'var(--text-muted)', opacity:0.7 }}>
        ⌨️ Pfeiltasten navigieren · Enter / Leertaste umdrehen
      </p>
    </div>
  )
}
