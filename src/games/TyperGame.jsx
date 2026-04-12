import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'

/**
 * Buchstabenwald — Tippen & Schreiben
 * Scientific basis:
 *   • Encoding Specificity (Tulving, 1983) — motor memory (typing) anchors letter shapes
 *     better than passive recognition alone.
 *   • Handwriting → Brain activation (James & Engelhardt, 2012) — letter-form motor programs
 *     activate reading circuits; keyboard input offers a comparable digital analogue.
 *   • Errorless Learning (Terrace, 1963) — immediate feedback on wrong letters prevents
 *     consolidation of incorrect patterns.
 */

const WORD_SETS = {
  // Level 1: short 2–4 letter words every child knows
  level1: [
    'OMA','OPA','EIS','UHR','ZUG','BUS','HUT','FEE','ARM','ELF',
    'TAG','OHR','GUT','ROT','WEG','ALT','NEU','HOF','TOR','TAU',
    'TEE','TON','MUT','RAT','AXT','TOP','KUH','SAG','BAD','TAL',
    'HUND','BALL','BUCH','MUND','FUSS','HAND','KOPF','NASE','WOLF','IGEL',
    'GELD','HERZ','HOLZ','BOOT','GANS','GLAS','HAAR','HAHN','HASE','KEKS',
    'LOCH','MAUS','MOND','NETZ','OBST','PILZ','RABE','ROSE','SALZ','SAND',
    'SOFA','SOHN','TANZ','TOPF','TURM','WALD','ZAUN','ZELT','BAHN','BEIN',
    'BILD','FELS','HELM','FELD','HUHN','AFFE','ESEL','PFAU','LAUB','BURG',
    'DACH','RING','TORE','GRAS','KORN','MAST','OFEN','PFAD','BOOT','HERD',
    'EIER','MILCH','MOND','BROT','FETT','HONIG','KALT',
  ],
  // Level 2: 4–5 letter everyday words
  level2: [
    'MAMA','PAPA','AUTO','HAUS','KIND','BROT','BAUM','HEMD','LÖWE','TIER',
    'GABEL','TISCH','STUHL','LAMPE','KATZE','VOGEL','STERN','APFEL','SCHUH','PIZZA',
    'FEUER','WURST','NUDEL','SUPPE','TASSE','KERZE','KISTE','DACHS','AMSEL','ADLER',
    'BIRNE','SAHNE','TORTE','BEERE','STALL','FARBE','SEIFE','NAGEL','ENGEL','KRONE',
    'ZIEGE','KAMEL','PFERD','TIGER','FLUSS','INSEL','WIESE','GURKE','SOCKE','TEICH',
    'TRAUM','WAGEN','ZWERG','MÜTZE','JACKE','PUPPE','GEIGE','SCHAF','FALKE','BIENE',
    'EICHE','BIRKE','REGAL','ANKER','OTTER','LUCHS','VATER','FISCH','KREBS','KÜCHE',
    'PFEIL','RIESE','LACHS','REGEN','STURM','WOLKE','NEBEL','HÜGEL','LICHT','STEIN',
    'HEXE','ZWERG','DRÜSE','MÄHNE','EIMER','PINKE','SPULE','HARFE','ORGEL','TINTE',
  ],
  // Level 3: 5–7 letter words
  level3: [
    'SCHULE','GARTEN','HERBST','WINTER','SOMMER','TRAUBE','FREUND','SCHATZ','RITTER','ZIRKUS',
    'RAKETE','SCHLOSS','BAHNHOF','SPIEGEL','AMEISE','BRÜCKE','FENSTER','TEMPEL','ROBOTER','ELEFANT',
    'NACHT','KRAFT','KREUZ','MARKT','MÖHRE','MÜCKE','NATUR','RAUCH','MUSIK','BÄCKER',
    'KÄFER','KREIS','GRENZE','NUMMER','QUELLE','LÖSUNG','KUGEL','TASCHE','SCHERE','BREZEL',
    'KIRCHE','HAFEN','HÜTTE','FLÖTE','LAUBE','BÜHNE','MÜHLE','BALKON','KELLER','CLOWN',
    'KOFFER','KISSEN','TELLER','PFANNE','BAGGER','TRAKTOR','POLIZEI','PIRAT','DRACHEN','BLUMEN',
    'APRIKOSE','SPINAT','PAPRIKA','KAROTTE','LATERNE','KALENDER','LEITER','TREPPE','BÜRSTE','ZAHNRAD',
    'KASPER','HEXEN','RIESEN','ZWERGE','STIFTE','FARBEN','WOLKEN','FEUERN','WELLEN','STRASSE',
  ],
  // Level 4: compound 6–9 letter words
  level4: [
    'KROKODIL','LUFTBALL','WALDTIER','FLUGZEUG','SEESTERN','GESICHT','PIRATEN',
    'BÄCKEREI','SCHULBUS','HAUSTIER','SCHULHOF','SCHNECKE','TRUTHAHN','ZAUBERER',
    'FEUERWEHR','TRAMPOLIN','OSTERHASE','SPIELZEUG','ERDBEEREN','GEHEIMNIS',
    'SCHNEEBALL','SCHAUKEL','FAHRSTUHL','BAUMSTAMM','WALDBRAND','TIERGARTEN',
    'MÜLLWAGEN','SEEHUND','BLAUBEERE','ZITRONENL','SONNENUHR','SCHÜLEREK',
    'BAUMWOLLE','STERNSCHNUPPE','GLÜHBIRNE','SEIFENBLASE','KINDERPARK',
    'TISCHTENNIS','WACKELZAHN','SCHLAFSACK','SANDKASTEN','FERNROHR',
    'KASPERLTHEATER','BALLERINA','LERNSPIEL','SEEPFERDCHEN','TISCHLAMP',
    'SCHOKOLADEN','SONNENBLUME','WASSERFALL','KINDERFILM','KRISTALLKUGEL',
  ],
  // Level 5: long compound German words
  level5: [
    'SCHMETTERLING','SONNENSCHEIN','BLAUBEERE','ERDBEERE','KARTOFFEL',
    'ASTRONAUT','LAUBFROSCH','EICHHÖRNCHEN','FAHRRADHELM','KINDERGARTEN',
    'WEIHNACHTSMANN','GEBURTSTAGSKUCHEN','TASCHENLAMPE','REGENBOGEN','STAUBSAUGER',
    'SCHOKOLADENKUCHEN','SEIFENBLASEN','FUSSBALLSPIELER','SCHULRANZEN','MEERESSCHILDKRÖTE',
    'KÜHLSCHRANK','AUTOBAHN','WINTERLANDSCHAFT','JAHRESZEITEN','ELEFANTENBABY',
    'RAUMSCHIFF','DRACHENFLIEGER','UNTERWASSERWELT','FEUERSPUCKER','ZIRKUSDIREKTOR',
    'BLUMENSTRAUSS','NIKOLAUSSTIEFEL','STRASSENLATERNE','SPIELZEUGAUTO','SANDBURGREITER',
    'SCHULTASCHE','FAHRRADTOUR','NACHTSTIMMUNG','BAUERNHOFTIER','MONDRAKETE',
    'SCHAUKELPFERD','ZAHNBÜRSTE','SEEPFERDCHEN','GÄRTNERMEISTER','BLUMENWASSER',
  ],
}

const ROWS = [
  ['Q','W','E','R','T','Z','U','I','O','P'],
  ['A','S','D','F','G','H','J','K','L'],
  ['Y','X','C','V','B','N','M','⌫'],
]

function speak(text, slow = false) {
  if (!window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang  = 'de-DE'
  u.rate  = slow ? 0.65 : 0.85
  u.pitch = 1.05
  window.speechSynthesis.speak(u)
}

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

// ─── Falling Letters Arcade (level >= 4) ────────────────────────────────────
// One letter falls at a time (always the NEXT letter of the word).
// Player must tap/type it before it hits the floor.
function FallingLettersGame({ level, onComplete }) {
  const setNum  = level <= 5 ? 2 : level <= 7 ? 3 : level <= 9 ? 4 : 5
  const wordSet = WORD_SETS[`level${setNum}`] ?? WORD_SETS.level2
  const [words]        = useState(() => shuffle(wordSet).slice(0, 5))
  const [wIdx,         setWIdx]       = useState(0)
  const [typed,        setTyped]      = useState(0) // # of letters correctly typed for current word
  const [score,        setScore]      = useState(0)
  const [lives,        setLives]      = useState(3)
  const [letterY,      setLetterY]    = useState(-10)
  const [mood,         setMood]       = useState('happy')
  const [done,         setDone]       = useState(false)
  const [completing,   setCompleting] = useState(false)
  const [missAnim,     setMissAnim]   = useState(false)
  const tickRef       = useRef(null)
  const livesRef      = useRef(3)
  const doneRef       = useRef(false)
  const completingRef = useRef(false)
  // Pre-computed random X positions — stable per (wIdx, typed) pair
  const xSeeds = useRef(Array.from({ length: 200 }, () => Math.round(10 + Math.random() * 65)))

  const word       = words[wIdx] ?? ''
  const targetChar = word[typed] ?? ''
  const letterX    = xSeeds.current[(wIdx * 20 + typed) % 200]
  const fallSpeed  = level <= 5 ? 0.38 : level <= 7 ? 0.55 : level <= 9 ? 0.78 : 1.05

  // Keep refs in sync — used inside the interval callback to avoid stale closures
  livesRef.current      = lives
  doneRef.current       = done
  completingRef.current = completing

  // Fall loop
  useEffect(() => {
    if (done || completing) { clearInterval(tickRef.current); return }
    clearInterval(tickRef.current)
    tickRef.current = setInterval(() => {
      setLetterY(y => {
        const ny = y + fallSpeed
        if (ny > 105) {
          // Letter hit the floor — lose a life, respawn same letter from top
          const newLives = livesRef.current - 1
          livesRef.current = newLives
          setLives(newLives)
          setMissAnim(true)
          setMood('encouraging')
          setTimeout(() => { setMissAnim(false); setMood('happy') }, 600)
          if (newLives <= 0 && !doneRef.current) {
            doneRef.current = true
            setDone(true)
            clearInterval(tickRef.current)
            setScore(s => { setTimeout(() => onComplete({ score: s, total: words.length }), 1200); return s })
          }
          return -10
        }
        return ny
      })
    }, 60)
    return () => clearInterval(tickRef.current)
  }, [done, completing, fallSpeed]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleChar = useCallback((char) => {
    if (doneRef.current || completingRef.current) return
    if (char !== targetChar) {
      sfx.wrong()
      setMood('encouraging')
      setTimeout(() => setMood('happy'), 400)
      return
    }
    sfx.correct()
    const newTyped = typed + 1
    if (newTyped >= word.length) {
      // Word complete!
      setCompleting(true)
      completingRef.current = true
      speak(word)
      setMood('excited')
      setScore(s => {
        const ns = s + 1
        const nextIdx = wIdx + 1
        setTimeout(() => {
          if (nextIdx >= words.length) {
            doneRef.current = true
            setDone(true)
            onComplete({ score: ns, total: words.length })
          } else {
            setWIdx(nextIdx)
            setTyped(0)
            setLetterY(-10)
            setCompleting(false)
            completingRef.current = false
            setMood('happy')
          }
        }, 900)
        return ns
      })
    } else {
      setMood('excited')
      setTimeout(() => setMood('happy'), 400)
      setTyped(newTyped)
      setLetterY(-10) // drop the next letter from the top
    }
  }, [targetChar, typed, word, wIdx, words.length, onComplete])

  // Physical keyboard
  useEffect(() => {
    const onKey = (e) => {
      const k = e.key.toUpperCase()
      if (k.length === 1 && /[A-ZÄÖÜ]/.test(k)) handleChar(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleChar])

  return (
    <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', padding:'clamp(10px,2vw,22px) clamp(12px,3vw,32px)', gap:'clamp(10px,1.5vw,18px)' }}>

      {/* HUD */}
      <div style={{ display:'flex', gap:12, width:'100%', maxWidth:720, justifyContent:'space-between', alignItems:'center', flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:6 }}>
          {words.map((_, i) => (
            <div key={i} style={{ flex:1, width:28, height:10, borderRadius:99, background: i < wIdx ? '#6C63FF' : i === wIdx ? '#FFD93D' : '#ECE8FF', transition:'background 0.3s' }} />
          ))}
        </div>
        <div style={{ display:'flex', gap:6 }}>
          {Array.from({length:3}).map((_,i) => (
            <span key={i} style={{ fontSize:22, filter: i < lives ? 'none' : 'grayscale(1) opacity(0.28)' }}>❤️</span>
          ))}
        </div>
        <div style={{ fontFamily:'var(--font-heading)', fontSize:16, color:'var(--text-secondary)', background:'white', borderRadius:99, padding:'6px 16px', boxShadow:'0 2px 10px rgba(0,0,0,0.07)' }}>
          {'✅ ' + score + ' Wörter'}
        </div>
      </div>

      {/* Lumi */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:720 }}>
        <LumiCharacter mood={mood} size={72} />
        <div style={{ flex:1, background:'white', borderRadius:'24px 24px 24px 6px', padding:'12px 18px', boxShadow:'0 4px 20px rgba(108,99,255,0.12)', fontFamily:'var(--font-heading)', fontSize:'clamp(15px,3.2vw,22px)', color:'var(--text-primary)' }}>
          {'Tippe den fallenden Buchstaben! ⌨️'}
        </div>
      </div>

      {/* Word progress display */}
      <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
        {word.split('').map((ch, i) => (
          <div key={i} style={{
            width:'clamp(32px,6vw,52px)', height:'clamp(38px,7vw,60px)',
            borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center',
            fontFamily:'var(--font-heading)', fontSize:'clamp(16px,3.5vw,26px)', fontWeight:700,
            background: i < typed ? '#E8F8EE' : i === typed ? '#FFF9E0' : '#F5F0FF',
            border: '2.5px solid ' + (i < typed ? '#6BCB77' : i === typed ? '#FFD93D' : '#ECE8FF'),
            color: i < typed ? '#2C8C50' : i === typed ? '#8B6F00' : '#BDB3E0',
            transition:'all 0.2s',
          }}>{i < typed ? ch : i === typed ? ch : '_'}</div>
        ))}
      </div>

      {/* Falling arena */}
      <div style={{
        position:'relative', width:'100%', maxWidth:720,
        height:'clamp(220px,42vw,360px)',
        background: missAnim
          ? 'linear-gradient(180deg,#33001a,#660033 65%,#CC0044)'
          : 'linear-gradient(180deg,#1a0533,#2d1066 65%,#4A00E0)',
        borderRadius:24, overflow:'hidden', flexShrink:0,
        boxShadow:'0 8px 30px rgba(74,0,224,0.35)',
        transition:'background 0.35s',
      }}>
        {/* Stars */}
        {Array.from({length:18}).map((_,i) => (
          <div key={i} style={{ position:'absolute', borderRadius:'50%', width: 2 + i%3, height: 2 + i%3, background:'white', opacity:0.3 + (i%4)*0.1, left: `${(i * 17 + 5) % 95}%`, top: `${(i * 23 + 8) % 90}%` }} />
        ))}
        {/* Floor */}
        <div style={{ position:'absolute', bottom:0, left:0, right:0, height:28, background:'rgba(255,80,80,0.22)', borderTop:'2px solid rgba(255,80,80,0.55)' }} />
        <div style={{ position:'absolute', bottom:6, left:'50%', transform:'translateX(-50%)', fontFamily:'var(--font-heading)', fontSize:12, color:'rgba(255,150,150,0.9)', whiteSpace:'nowrap', pointerEvents:'none' }}>⚠️ Nicht berühren!</div>

        {/* The single falling letter */}
        {!done && !completing && targetChar && (
          <motion.div
            key={`${wIdx}-${typed}`}
            style={{
              position:'absolute',
              left: letterX + '%',
              top:  letterY + '%',
              transform:'translate(-50%,-50%)',
              width:'clamp(48px,10vw,72px)', height:'clamp(48px,10vw,72px)',
              borderRadius:16,
              background:'linear-gradient(135deg,#6C63FF,#A78BFA)',
              border:'2.5px solid rgba(255,255,255,0.35)',
              display:'flex', alignItems:'center', justifyContent:'center',
              fontFamily:'var(--font-heading)', fontSize:'clamp(24px,5.5vw,40px)', fontWeight:800,
              color:'white', textShadow:'0 2px 8px rgba(0,0,0,0.4)',
              boxShadow:'0 4px 20px rgba(108,99,255,0.6)',
              cursor:'pointer', userSelect:'none',
            }}
            initial={{ scale:0, opacity:0 }}
            animate={{ scale:1, opacity:1 }}
            whileTap={{ scale:1.35 }}
            onClick={() => handleChar(targetChar)}
          >
            {targetChar}
          </motion.div>
        )}
      </div>

      {/* On-screen keyboard */}
      <div style={{ display:'flex', flexDirection:'column', gap:'clamp(4px,1vw,8px)', width:'100%' }}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display:'flex', justifyContent:'center', gap:'clamp(3px,0.8vw,6px)' }}>
            {row.map((k) => {
              const isTarget = k === targetChar && !completing && !done
              return (
                <motion.button key={k}
                  whileTap={{ scale:0.86 }}
                  onClick={() => k !== '⌫' && handleChar(k)}
                  animate={isTarget ? { scale:[1,1.1,1], boxShadow:['0 4px 14px rgba(255,217,61,0.3)','0 8px 30px rgba(255,217,61,0.7)','0 4px 14px rgba(255,217,61,0.3)'] } : {}}
                  transition={isTarget ? { duration:1.3, repeat:Infinity } : {}}
                  style={{
                    width:'clamp(26px,7.2vw,54px)', height:'clamp(30px,7.2vw,52px)',
                    borderRadius:10,
                    background: isTarget ? 'linear-gradient(135deg,#FFD93D,#FFB800)' : k === '⌫' ? '#FF6B6B' : 'white',
                    color: isTarget ? '#6B4C00' : k === '⌫' ? 'white' : 'var(--text-primary)',
                    border: '2px solid ' + (isTarget ? '#FFB800' : k === '⌫' ? '#FF6B6B' : '#ECE8FF'),
                    fontFamily:'var(--font-heading)', fontSize:'clamp(11px,2.6vw,19px)', fontWeight:700,
                    cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                >{k}</motion.button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Static word typer (level 1) ─────────────────────────────────────────────
function StaticTyperGame({ level, onComplete }) {
  const setNum   = level <= 1 ? 1 : level <= 2 ? 2 : level <= 3 ? 3 : level <= 6 ? 4 : 5
  const set      = WORD_SETS[`level${setNum}`] ?? WORD_SETS.level1
  const [words]  = useState(() => shuffle(set).slice(0, 6))
  const [wIdx,   setWIdx]   = useState(0)
  const [typed,  setTyped]  = useState('')
  const [shake,  setShake]  = useState(false)
  const [correct, setCorrect] = useState(0)
  const [mood,   setMood]   = useState('happy')
  const [done,   setDone]   = useState(false)

  const word      = words[wIdx] ?? ''
  const nextChar  = word[typed.length]
  const finished  = typed.length === word.length

  // Physical keyboard support
  useEffect(() => {
    const onKey = (e) => {
      if (done) return
      const k = e.key.toUpperCase()
      if (k === 'BACKSPACE') { setTyped(t => t.slice(0, -1)); return }
      if (k.length === 1 && /[A-ZÄÖÜ]/.test(k)) handleKey(k)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // intentional — handleKey recreated each render is fine for this

  // Speak word on new question
  useEffect(() => {
    if (word) setTimeout(() => speak(word, true), 400)
  }, [wIdx]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-advance when word complete
  useEffect(() => {
    if (!finished || done) return
    speak(word)
    setMood('excited')
    const nc = correct + 1
    setCorrect(nc)
    const t = setTimeout(() => {
      if (wIdx + 1 >= words.length) {
        setDone(true)
        onComplete({ score: nc, total: words.length })
      } else {
        setWIdx(i => i + 1)
        setTyped('')
        setMood('happy')
      }
    }, 1000)
    return () => clearTimeout(t)
  }, [finished]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleKey = useCallback((k) => {
    if (finished) return
    if (k === nextChar) {
      setTyped(t => t + k)
    } else {
      setShake(true)
      setMood('encouraging')
      setTimeout(() => { setShake(false); setMood('happy') }, 500)
    }
  }, [finished, nextChar])

  return (
    <div style={{
      flex:1, display:'flex', flexDirection:'column', alignItems:'center',
      padding:'clamp(14px,2.5vw,28px) clamp(12px,3vw,32px)',
      gap:'clamp(14px,2vw,22px)',
    }}>

      {/* Progress */}
      <div style={{ display:'flex', gap:6, width:'100%', maxWidth:720 }}>
        {words.map((_, i) => (
          <div key={i} style={{
            flex:1, height:10, borderRadius:99,
            background: i < wIdx ? '#6C63FF' : i === wIdx ? '#FFD93D' : '#ECE8FF',
            transition:'background 0.3s',
          }} />
        ))}
      </div>

      {/* Lumi + instruction */}
      <div style={{ display:'flex', alignItems:'flex-end', gap:12, width:'100%', maxWidth:760 }}>
        <LumiCharacter mood={mood} size={88} />
        <div style={{
          flex:1, background:'white', borderRadius:'24px 24px 24px 6px',
          padding:'16px 22px',
          boxShadow:'0 4px 24px rgba(108,99,255,0.12)',
          fontFamily:'var(--font-heading)',
          fontSize:'clamp(18px,3.8vw,26px)',
          color:'var(--text-primary)',
        }}>
          Tippe das Wort! Der goldene Buchstabe ist dran. ✨
        </div>
      </div>

      {/* Word display */}
      <AnimatePresence mode="wait">
        <motion.div key={wIdx}
          initial={{ opacity:0, y:16 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:-16 }}
          style={{
            display:'flex', gap:'clamp(6px,1.5vw,12px)',
            padding:'clamp(14px,3vw,24px)',
            background:'white', borderRadius:24,
            boxShadow:'0 6px 24px rgba(108,99,255,0.12)',
            width:'100%', maxWidth:760,
            justifyContent:'center', flexWrap:'wrap',
          }}
        >
          {word.split('').map((ch, i) => {
            const isTyped  = i < typed.length
            const isCurrent = i === typed.length

            return (
              <motion.div key={i}
                animate={isCurrent && shake ? { x:[-6,6,-6,6,0] } : isCurrent ? { scale:[1,1.12,1] } : {}}
                transition={isCurrent && !shake ? { duration:0.7, repeat:Infinity } : { duration:0.3 }}
                style={{
                  width:'clamp(40px,8vw,66px)',
                  height:'clamp(50px,10vw,80px)',
                  borderRadius:14,
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontFamily:'var(--font-heading)',
                  fontSize:'clamp(22px,5vw,38px)',
                  fontWeight:700,
                  background: isTyped ? '#E8F8EE'
                             : isCurrent ? (shake ? '#FFE8E8' : '#FFF9E0')
                             : '#F5F0FF',
                  border: `3px solid ${isTyped ? '#6BCB77' : isCurrent ? (shake ? '#FF6B6B' : '#FFD93D') : '#ECE8FF'}`,
                  color: isTyped ? '#2C8C50'
                       : isCurrent ? (shake ? '#CC2222' : '#8B6F00')
                       : '#BDB3E0',
                  transition:'all 0.2s',
                  boxShadow: isCurrent ? `0 4px 18px ${shake ? 'rgba(255,107,107,0.3)' : 'rgba(255,217,61,0.35)'}` : 'none',
                }}
              >
                {isTyped ? ch : isCurrent ? ch : '_'}
              </motion.div>
            )
          })}
        </motion.div>
      </AnimatePresence>

      {/* Keyboard */}
      <div style={{
        display:'flex', flexDirection:'column', gap:'clamp(6px,1.2vw,10px)',
        width:'100%',
      }}>
        {ROWS.map((row, ri) => (
          <div key={ri} style={{ display:'flex', justifyContent:'center', gap:'clamp(4px,1vw,8px)' }}>
            {row.map((k) => {
              const isNext = k === nextChar && !finished

              return (
                <motion.button key={k}
                  whileHover={{ scale:1.08 }}
                  whileTap={{ scale:0.90 }}
                  onClick={() => k === '⌫' ? setTyped(t => t.slice(0,-1)) : handleKey(k)}
                  animate={isNext ? { scale:[1,1.1,1], boxShadow:['0 4px 14px rgba(255,217,61,0.3)','0 8px 30px rgba(255,217,61,0.7)','0 4px 14px rgba(255,217,61,0.3)'] } : {}}
                  transition={isNext ? { duration:1.3, repeat:Infinity } : {}}
                  style={{
                    width:'clamp(30px,8.5vw,64px)',
                    height:'clamp(36px,8.5vw,64px)',
                    borderRadius:12,
                    background: isNext
                      ? 'linear-gradient(135deg,#FFD93D,#FFB800)'
                      : k === '⌫' ? '#FF6B6B' : 'white',
                    color: isNext ? '#6B4C00'
                         : k === '⌫' ? 'white' : 'var(--text-primary)',
                    border: `2.5px solid ${isNext ? '#FFB800' : k === '⌫' ? '#FF6B6B' : '#ECE8FF'}`,
                    boxShadow: isNext
                      ? '0 6px 20px rgba(255,217,61,0.45)'
                      : '0 3px 10px rgba(0,0,0,0.06)',
                    fontFamily:'var(--font-heading)',
                    fontSize:'clamp(13px,3vw,22px)',
                    fontWeight:700,
                    cursor:'pointer',
                    transition:'background 0.15s, border 0.15s',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}
                >
                  {k}
                </motion.button>
              )
            })}
          </div>
        ))}
      </div>

      <p style={{ fontFamily:'var(--font-heading)', fontSize:17, color:'var(--text-muted)' }}>
        ✅ {correct} von {wIdx} Wörter geschafft
      </p>
    </div>
  )
}

export default function TyperGame({ level = 1, onComplete }) {
  if (level >= 4) return <FallingLettersGame level={level} onComplete={onComplete} />
  return <StaticTyperGame level={level} onComplete={onComplete} />
}
