import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp, todayMs } from '../AppContext.jsx'
import { PxStar, PxIcon } from '../components/PixelUI.jsx'
import Confetti from '../components/Confetti.jsx'
import TileArt from '../components/TileArt.jsx'
import { Scene, Critter, Art } from '../components/play/index.js'
import { sfx } from '../sfx.js'
import { afterNarration, lastSaid, narrate, stopNarration } from '../narrator.js'
import { sayCount } from '../tts.js'
import { starsFor } from '../lib/score.js'
import { journeyArt } from '../lib/assets.js'
import { startStop } from '../lib/journeyNav.js'
import { nextStopIndex } from '../lib/learning.js'
import { STICKER_BY_EMOJI } from '../lib/stickers.js'
import { MODULE_BY_ID } from '../modules.js'
import { line } from '../lib/lumiLines.js'

// One star means the level is done — the texts say so. Whether the next
// level is announced is decided below (`opened`).
const MESSAGES = {
  3: ['Fantastisch!', 'Super gemacht!', 'Perfekt!'],
  2: ['Sehr gut gemacht!', 'Klasse!', 'Toll gemacht!'],
  1: ['Gut geübt!', 'Geschafft!', 'Weiter so!'],
  0: ['Nicht aufgeben!', 'Du schaffst das!', 'Gleich klappt es!'],
}
// Lumi's recorded praise (lib/lumiLines.js); after a round without a star
// the encouragement below says enough
const praise = s => (s >= 1 ? line(`rueckmeldung/richtig-${1 + Math.floor(Math.random() * 9)}`) : null)
// A level's end is praised once. Some games praise the last answer or the
// win themselves ("Klasse!"), and a few seconds later this screen said
// "Klasse!" again, now and then with the very same recording. When praise
// was the last thing Lumi said, this screen goes straight on to its news.
const PRAISE_CLIP = /rueckmeldung\/(richtig|drangeblieben)-/
const PRAISED_MS = 15000
const justPraised = () => { const s = lastSaid(); return PRAISE_CLIP.test(s.src ?? '') && Date.now() - s.at < PRAISED_MS }

const NO_FRACTION = new Set(['coloring', 'maze'])
// Friends who come to the party when it went well
const FRIENDS = ['🐻', '🐰', '🐸', '🐧', '🦔', '🐢', '🐼', '🐨', '🦉', '🐞']
// After this much play today, Lumi suggests the movement break
const MOVE_AFTER_MS = 10 * 60 * 1000

/**
 * The end of a level is a little party, not a report card: Lumi dances,
 * friends come along when it went well, confetti. Then one clear way on —
 * Lumi's next idea from today's plan, the next level, or a bit more
 * practice (lib/learning.js) — and now and then a surprise: the movement
 * break after a while of playing, a sticker for the album when all of
 * today's ideas are played.
 */
export default function ResultsScreen() {
  const { state, dispatch } = useApp()
  const { gameResult } = state
  const profile = state.profiles[state.activeProfileId]
  const stars       = gameResult?.stars        ?? 0
  const score       = gameResult?.score        ?? 0
  const total       = gameResult?.total        ?? 0
  const moduleId    = gameResult?.moduleId     ?? 'numbers'
  const level       = gameResult?.level        ?? 1
  const nextLevel      = gameResult?.nextLevelNum   ?? null
  const justCompleted  = gameResult?.justCompleted  ?? false
  const masteredWell   = gameResult?.masteredWell   ?? false
  const isFirstPass    = gameResult?.isFirstPass    ?? false
  const streakCount    = gameResult?.streakCount ?? 0
  // what Lumi suggests next (lib/learning.js): the next level, the same one
  // to practise, or the one before
  const suggested      = gameResult?.suggestedLevel ?? nextLevel ?? level
  const practise       = suggested === level && (gameResult?.ratio ?? 1) < 0.6
  const easier         = suggested < level
  // The child is following Lumi's ideas for today: this game was started
  // from the idea, so the next idea is the big button. A game picked from
  // its tile goes on with its own next level (the big button used to lead
  // into another game whenever the tile's game happened to be on the plan).
  const onPlan         = !!gameResult?.journey?.followed

  // Today's plan after this game: the next idea, the movement break, the sticker
  const journey = profile?.journey
  const done = journey?.done ?? []
  const nextGame = (journey?.stops ?? []).findIndex((st, i) => st.moduleId && !done.includes(i) && st.moduleId !== moduleId)
  const moveIdx = (journey?.stops ?? []).findIndex((st, i) => st.kind === 'move' && !done.includes(i))
  const planDone = journey && nextStopIndex(journey) === -1
  const moveNow = moveIdx !== -1 && (nextStopIndex(journey) === moveIdx || todayMs(profile) >= MOVE_AFTER_MS || nextGame === -1)
  const nextMod = nextGame !== -1 ? MODULE_BY_ID[journey.stops[nextGame].moduleId] : null

  // All of today's ideas played: the sticker comes out of the chest, here
  const [sticker, setSticker] = useState(null)
  useEffect(() => {
    if (planDone && !journey.chest) dispatch({ type: 'OPEN_CHEST' })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (planDone && journey.chest && STICKER_BY_EMOJI[journey.chest] && !sticker) setSticker(journey.chest)
  }, [journey?.chest]) // eslint-disable-line react-hooks/exhaustive-deps
  const [freshSticker] = useState(() => planDone && !journey?.chest)

  // With the day's play time used up (parent area) the way leads home,
  // where Lumi says goodbye for today
  const limitMin = state.settings?.dailyLimitMin ?? 0
  const timeUp = limitMin > 0 && todayMs(profile) >= limitMin * 60000

  // What Lumi proposes for this game (lib/learning.js, the same rule that
  // sets the level on the game's tile):
  //   again     no star: the same level once more
  //   easier    two very hard rounds: the level before
  //   practise  fewer than 60 % right at the first try: the same level
  //   next      otherwise the next level (null after the last one)
  // A level with a star always opens the next one in the level picker; it
  // is proposed here only after a round that went well.
  const proposal = stars === 0 ? 'again' : easier ? 'easier' : practise ? 'practise' : nextLevel ? 'next' : null
  const upTo = Math.max(suggested, level + 1)
  // "Level 3 ist offen!" is said and shown only when it is news (this level
  // had no star before) and the big button leads there. It used to stand
  // over a lone "Nochmal üben", and over a big button to another game when
  // the day's plan went on elsewhere.
  const planLeads = moveNow || (onPlan && !!nextMod)
  const opened = isFirstPass && proposal === 'next' && upTo === nextLevel && !timeUp && !planLeads

  // "7 von 7 richtig" next to one star was a contradiction: the line counts
  // what the stars count (answers right on the first try) and is left out
  // for games that rate otherwise (Memo by moves, the maze by dragon hits)
  // and for free painting, where nothing is right or wrong.
  const showFraction = total > 0 && starsFor(score, total) === stars && !NO_FRACTION.has(moduleId)

  // Chosen once: picked during render, the heading changed when the
  // buttons appeared ("Du schaffst das!" → "Nicht aufgeben!")
  const msg = useMemo(() => {
    if (justCompleted) return masteredWell ? 'Du bist ein Meister!' : 'Alle Level geschafft!'
    if (opened) return `Level ${nextLevel} ist offen!`
    const list = MESSAGES[Math.max(0, Math.min(3, stars))]
    return list[Math.floor(Math.random() * list.length)]
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const friends = useMemo(() => {
    const pool = [...FRIENDS].sort(() => Math.random() - 0.5)
    return pool.slice(0, stars >= 3 ? 2 : stars >= 2 ? 1 : 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const go = (lv) => dispatch({ type: 'START_GAME', payload: { moduleId, level: lv } })
  const home = () => dispatch({ type: 'NAVIGATE', payload: 'home' })
  const toStop = idx => { if (!startStop(dispatch, journey, idx)) home() }

  // One clear main button per situation, plus a small way home
  const ideaBtn = nextMod && { label: nextMod.title, art: nextMod, onClick: () => toStop(nextGame) }
  const moveBtn = moveNow && { label: 'Bewegungspause!', icon: '🤸', onClick: () => toStop(moveIdx) }
  const levelBtn = proposal === 'again' ? { label: 'Nochmal', icon: '🔄', onClick: () => go(level) }
    : proposal === 'easier' ? { label: `Leichter: Level ${suggested}`, icon: '🌱', onClick: () => go(suggested) }
    : proposal === 'practise' ? { label: 'Nochmal üben', icon: '💪', onClick: () => go(level) }
    : proposal === 'next' ? { label: `Weiter: Level ${upTo}`, play: true, onClick: () => go(upTo) }
    : null
  // "…or play the easier level", Lumi says after a round without a star
  const easierToo = proposal === 'again' && level > 1
  const main = timeUp ? { label: 'Zur Startseite', icon: '🏠', onClick: home }
    : moveBtn || (onPlan && ideaBtn) || levelBtn || ideaBtn || { label: 'Zur Startseite', icon: '🏠', onClick: home }
  const secondary = timeUp ? [] : [
    levelBtn !== main && levelBtn,
    easierToo && { label: `Leichter: Level ${level - 1}`, icon: '🌱', onClick: () => go(level - 1) },
    stars >= 1 && levelBtn?.onClick && !/Nochmal/.test(levelBtn.label) && { label: 'Nochmal', icon: '🔄', onClick: () => go(level) },
    ideaBtn && ideaBtn !== main && ideaBtn,
  ].filter(Boolean)

  const [showButtons, setShowButtons] = useState(false)
  useEffect(() => {
    const b = setTimeout(() => setShowButtons(true), 1100)
    return () => clearTimeout(b)
  }, [])

  useEffect(() => {
    const tm = setTimeout(() => {
      if (stars >= 3)      sfx.complete()
      else if (stars >= 1) sfx.correct()
    }, 350)
    // The praise, then what is new. Lumi says what the heading says and
    // what the big button does, nothing else.
    const news = []
    if (justCompleted) news.push(line(masteredWell ? 'ergebnis/meister' : 'ergebnis/alle-level'))
    else if (opened) news.push(line('ergebnis/level-offen'))
    if (levelBtn && levelBtn === main && !justCompleted) {
      if (proposal === 'again') {
        // no recording (a number in the sentence): silent for now, the narrator skips it
        if (score > 0) news.push({ text: `Du hattest schon ${sayCount(score, 'Aufgabe', 'f')} richtig.` })
        news.push(line(easierToo ? 'ergebnis/nochmal-leichter' : 'ergebnis/nochmal'))
      } else if (proposal === 'easier') news.push(line('ergebnis/leichter'))
      else if (proposal === 'practise') news.push(line('ergebnis/ueben'))
    }
    if (freshSticker) news.push(line('ergebnis/sticker-tag'))
    else if (main === moveBtn) news.push(line('ergebnis/bewegen'))
    else if (main === ideaBtn) news.push(line('ergebnis/noch-eine-idee'))
    const stop = afterNarration(() => {
      narrate([
        justPraised() ? null : praise(stars),
        ...news.map((part, i) => ({ ...part, gap: i === 0 ? 250 : 150 })),
      ])
    }, { minMs: 900 })
    return () => { clearTimeout(tm); stop(); stopNarration() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const lumiMood = stars >= 2 ? 'dance' : stars >= 1 ? 'happy' : 'idle'
  const lumiSize = Math.min(150, Math.round((typeof window !== 'undefined' ? window.innerHeight : 800) * 0.16))

  // A phone held sideways is lower than the party and the card together:
  // they shrink to fit instead of scrolling (the buttons were below the
  // edge after a perfect level). The margin takes back the room the
  // smaller picture no longer needs.
  const fitRef = useRef(null)
  const [fit, setFit] = useState({ scale: 1, need: 0 })
  useLayoutEffect(() => {
    const el = fitRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const room = window.innerHeight - 2 * parseFloat(getComputedStyle(el.parentElement).paddingTop || 0)
      const need = el.offsetHeight
      const scale = need > room ? Math.max(0.6, room / need) : 1
      setFit(f => (f.scale === scale && f.need === need ? f : { scale, need }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  return (
    <div style={{
      minHeight: '100dvh', isolation: 'isolate', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 'clamp(12px,3dvh,32px) 16px', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{ position: 'fixed', inset: 0, zIndex: -1 }}>
        <Scene theme={MODULE_BY_ID[moduleId]?.scene ?? 'meadow'} />
      </div>
      {(stars >= 2 || sticker) && <Confetti count={stars === 3 || sticker ? 60 : 28} yFrom="-5vh" yTo="110vh" />}

      <div ref={fitRef} style={{
        position: 'relative', zIndex: 1, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center',
        ...(fit.scale < 1 ? { transform: `scale(${fit.scale})`, marginBlock: -Math.ceil(fit.need * (1 - fit.scale) / 2) } : null),
      }}>
      {/* the party: Lumi and friends dance; the friends are smaller than Lumi on every screen */}
      <div aria-hidden="true" style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(4px,2vw,20px)', marginBottom: -12, zIndex: 2 }}>
        {friends[0] && <PartyFriend art={friends[0]} delay={0.5} size={Math.round(lumiSize * 0.6)} />}
        <Critter art="lumi" size={lumiSize} mood={lumiMood} />
        {friends[1] && <PartyFriend art={friends[1]} delay={0.8} size={Math.round(lumiSize * 0.6)} flip />}
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 18 }}
        className="px-panel"
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'clamp(8px,1.6dvh,14px)', zIndex: 1, width: '100%', maxWidth: 500, padding: 'clamp(14px,2.4dvh,26px) clamp(14px,4vw,28px)' }}
      >
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(26px, 6vw, 38px)', fontWeight: 700, color: 'var(--px-ink)', textAlign: 'center', lineHeight: 1.15 }}>
          {msg}
        </div>

        <div style={{ display: 'flex', gap: 10 }} aria-label={`${stars} von 3 Sternen`}>
          {Array.from({ length: 3 }).map((_, idx) => (
            <motion.div key={idx}
              initial={{ scale: 0, rotate: -30, y: -40 }}
              animate={{ scale: idx < stars ? 1 : 0.7, rotate: 0, y: 0 }}
              transition={{ delay: 0.25 + idx * 0.18, type: 'spring', stiffness: 400, damping: 12 }}
              onAnimationStart={() => idx < stars && setTimeout(() => sfx.coin(), 500 + idx * 200)}
              style={{ filter: idx < stars ? 'drop-shadow(0 0 10px rgba(255,201,60,0.8))' : 'none' }}>
              <PxStar size="clamp(40px, 7dvh, 60px)" off={idx >= stars} />
            </motion.div>
          ))}
        </div>

        {showFraction && (
          <div style={{ fontFamily: 'var(--font-heading)', color: 'var(--px-ink)', fontSize: 'clamp(18px,2.4vw,24px)', fontWeight: 600, textAlign: 'center' }}>
            {score} von {total} gleich beim ersten Mal richtig
          </div>
        )}
        {streakCount >= 2 && (
          <div className="px-chip" style={{ fontFamily: 'var(--font-heading)' }}>🔥 {streakCount} Tage in Folge</div>
        )}

        <AnimatePresence>
          {sticker && <StickerSurprise emoji={sticker} />}
        </AnimatePresence>

        {/* Buttons — there from the start (the card stood empty for two
            seconds), but only tappable after a moment, so a tap meant for
            the game's last task doesn't land on one */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: showButtons ? 1 : 0.4, y: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 22 }}
          aria-hidden={!showButtons}
          style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', alignItems: 'center', pointerEvents: showButtons ? 'auto' : 'none' }}>
          <button className="px-btn px-btn--green px-btn--lg" onClick={main.onClick} style={{ width: '100%', whiteSpace: 'normal' }}>
            {main.art ? <TileArt mod={main.art} size={36} bare /> : main.play ? <PxIcon name="play" size={22} /> : main.icon} {main.label}
          </button>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            {secondary.map(b => (
              <button key={b.label} className="px-btn px-btn--gold px-btn--md" onClick={b.onClick}>
                {b.art ? <TileArt mod={b.art} size={28} bare /> : b.icon} {b.label}
              </button>
            ))}
            {main.onClick !== home && (
              <button className="px-btn px-btn--parch px-btn--md" onClick={home} aria-label="Startseite">🏠</button>
            )}
          </div>
        </motion.div>
      </motion.div>
      </div>
    </div>
  )
}

// A friend runs in from its side and stops next to Lumi. (They used to
// fly up from 200 px below: across the heading they stand on.)
function PartyFriend({ art, delay, flip, size }) {
  return (
    <motion.div initial={{ x: flip ? size : -size, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay, type: 'spring', stiffness: 200, damping: 14 }}>
      <Critter art={art} size={size} mood="dance" flip={flip} />
    </motion.div>
  )
}

// The chest opens and today's sticker jumps out
function StickerSurprise({ emoji }) {
  const s = STICKER_BY_EMOJI[emoji]
  useEffect(() => { const t = setTimeout(() => sfx.sparkle(), 700); return () => clearTimeout(t) }, [])
  return (
    <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.4, type: 'spring', stiffness: 260, damping: 14 }}
      aria-label={`Neuer Sticker: ${s?.name ?? ''}`}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', borderRadius: 14, background: '#fff3c4', border: '3px solid var(--px-ink)' }}>
      <div style={{ position: 'relative', width: 64, height: 64 }}>
        <img src={journeyArt('chest-open.png')} alt="" style={{ width: 64, height: 64, imageRendering: 'pixelated' }} />
        <motion.div initial={{ y: 10, scale: 0.3 }} animate={{ y: -34, scale: 1, rotate: [0, -10, 10, 0] }} transition={{ delay: 0.7, duration: 0.8 }}
          style={{ position: 'absolute', left: 8, top: 0 }}>
          <Art art={emoji} size={48} />
        </motion.div>
      </div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--px-ink)', fontSize: 18, lineHeight: 1.2 }}>
        Überraschung!<br />Ein neuer Sticker
      </div>
    </motion.div>
  )
}
