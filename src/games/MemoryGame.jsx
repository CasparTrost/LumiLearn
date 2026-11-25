import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { sfx } from '../sfx.js'
import { narrate } from '../narrator.js'
import { sayTask, sayRight, sayWrong } from '../lib/feedback.js'
import { usePaused } from '../lib/pause.js'
import { LINES, line } from '../lib/lumiLines.js'
import { numberWord } from '../lib/words.js'
import { useApp } from '../AppContext.jsx'
import { Art, Critter, HintHand, useBursts, useJuice } from '../components/play/index.js'
import { voice, KEY } from './woerter/voice.js'
import Finale from './woerter/Finale.jsx'
import { useLater, useSize, pointIn } from './gefuehle/hooks.js'
import { levelConfig, buildCards, bestGrid, cellPos, starsFor } from './memo/layout.js'
import { skillFor, viewOf, observe, forget, chooseFirst, chooseSecond } from './memo/lumi.js'
import { INK, pxCard } from './px.js'

/**
 * Memo-Welt. The cards are little presents; turned over, the one inside
 * jumps up. Two the same hug and fly to the pile of whoever found them.
 *
 *   Levels 1–2  alone, to learn the game (4 pairs).
 *   Levels 3–10 against Lumi, taking turns as in the real game: whoever
 *               finds a pair goes again. Lumi sits at the table edge with
 *               its own pile and turns its cards with its wing, at a
 *               child's pace. It remembers only what it has seen, and not
 *               all of it (memo/lumi.js): at level 3 an attentive child
 *               nearly always wins, at level 10 it is a fair match.
 *   Levels 5–10 a joker card: whoever turns it sees all cards for a moment.
 *
 * Whose turn it is shows without a word: the active side is lit and the
 * other one dimmed, a hand points from the child's side on its turn, and
 * Lumi's wing is over the board on Lumi's.
 *
 * At the end the two piles are counted side by side, pair by pair, and
 * whoever has more is celebrated (Lumi wins cheerfully, never meanly; the
 * child's stars come from its own play, memo/layout.js `starsFor`).
 *
 * Scientific basis:
 *   • Working Memory Training (Klingberg, 2010) — improving working memory capacity
 *     transfers to reading & math performance in children.
 *   • Episodic Memory (Tulving, 1972) — visual context creates rich episodic traces.
 */

const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Lumi's recorded lines (lib/lumiLines.js). The ones not recorded yet are
// skipped by voice(): record them under these keys and the game says them.
const SAY = {
  solo:      KEY.task('tierparty'),          // "Finde zwei gleiche Karten!"
  versus:    KEY.task('memo-gegen-lumi'),    // "Wir spielen gegeneinander! …"
  lumiTurn:  KEY.task('memo-ich-bin-dran'),  // "Jetzt bin ich dran!"
  childTurn: KEY.task('memo-du-bist-dran'),  // "Du bist dran!"
  joker:     KEY.task('memo-zauberblick'),   // "Der Zauberblick! Schau schnell!"
  lumiJoker: KEY.task('memo-zauberblick-lumi'), // "Oh, der Zauberblick! Jetzt schaue ich."
  childWins: KEY.task('memo-du-gewinnst'),   // "Du hast mehr Paare. Du hast gewonnen!"
  lumiWins:  KEY.task('memo-lumi-gewinnt'),  // "Juhu, diesmal habe ich mehr! Du hast toll mitgespielt."
  tie:       KEY.task('memo-gleich-viele'),  // "Gleich viele! Wir haben beide gewonnen!"
}
// what Lumi says at the start until its own sentence is recorded
const START_FALLBACK = 'spielnamen/spiel-words'   // "Memo-Welt. Finde die Paare."
const wordLine = name => {
  const k = name && KEY.word(name)
  return k && LINES[k] ? line(k) : null
}

const LUMI_GOLD = '#ffc93c'

/** The back of a card: a present with a ribbon and a bow. */
// `magic`: the Zauberkarte. It is the one card without a partner, so it does
// not look like the others: a golden present with two eyes peeping out. As a
// plain present it lay there like a card whose pair was missing.
function Present({ s, magic = false }) {
  if (magic) return (
    <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden="true" style={{ display: 'block' }}>
      <rect x={3} y={3} width={94} height={94} rx={14} fill="#ffc93c" stroke={INK} strokeWidth={5} />
      {[[20, 20], [80, 22], [18, 80], [82, 80], [50, 12], [50, 88]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 7} l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2z`} fill="#fff7c2" stroke={INK} strokeWidth={1.5} strokeLinejoin="round" />
      ))}
      {[34, 66].map(x => (
        <g key={x}>
          <ellipse cx={x} cy={50} rx={15} ry={18} fill="#fff" stroke={INK} strokeWidth={4} />
          <circle cx={x + 3} cy={53} r={8} fill={INK} />
          <circle cx={x + 6} cy={49} r={3} fill="#fff" />
        </g>
      ))}
    </svg>
  )
  return (
    <svg viewBox="0 0 100 100" width={s} height={s} aria-hidden="true" style={{ display: 'block' }}>
      <rect x={3} y={3} width={94} height={94} rx={14} fill="#8e6cf0" stroke={INK} strokeWidth={5} />
      {[[22, 24], [70, 30], [30, 72], [76, 76], [50, 14], [14, 50], [86, 52]].map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill={['#ffc93c', '#ff8fb8', '#3fc1a8'][i % 3]} />
      ))}
      <rect x={42} y={3} width={16} height={94} fill="#ffc93c" stroke={INK} strokeWidth={3} />
      <rect x={3} y={42} width={94} height={16} fill="#ffc93c" stroke={INK} strokeWidth={3} />
      <path d="M50 46 C34 28 24 40 34 50 C40 56 46 52 50 50 C54 52 60 56 66 50 C76 40 66 28 50 46 Z" fill="#ff6b8a" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <circle cx={50} cy={49} r={5} fill="#ff6b8a" stroke={INK} strokeWidth={2.5} />
    </svg>
  )
}

/**
 * The tries counter's sign: a card back and a turned card with an arrow
 * between them, "cards turned over". The card back alone (a present) read
 * as presents won.
 */
function TurnedCards({ s }) {
  return (
    <svg viewBox="0 0 100 100" width={s * 1.3} height={s} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <rect x={-2} y={28} width={44} height={62} rx={8} fill="#8e6cf0" stroke={INK} strokeWidth={6} transform="rotate(-10 20 59)" />
      <rect x={58} y={28} width={44} height={62} rx={8} fill="#fffdf7" stroke={INK} strokeWidth={6} transform="rotate(10 80 59)" />
      <path d="M22 22 Q50 -4 76 20" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" />
      <path d="M64 14 L80 23 L70 36" fill="none" stroke={INK} strokeWidth={7} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Lumi's wing, the "paw" that turns Lumi's cards. Its tip is at (14, 52). */
function Wing({ s }) {
  return (
    <svg viewBox="0 0 60 60" width={s} height={s} aria-hidden="true" style={{ display: 'block', filter: 'drop-shadow(0 4px 0 rgba(42,27,61,0.3))' }}>
      <path d="M52 5 C32 3 13 17 9 39 C7 47 10 54 15 55 C19 56 22 53 22 49 C25 53 30 53 31 48 C34 51 39 50 39 45 C44 46 48 41 45 37 C53 30 57 17 52 5Z"
        fill="#ffd84a" stroke="#c98a12" strokeWidth={3} strokeLinejoin="round" />
      <path d="M22 49 C23 42 26 36 30 31 M31 48 C32 42 35 37 39 33 M39 45 C40 41 42 38 45 37" fill="none" stroke="#e0a91c" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  )
}

/** "Two the same make a pair", drawn (no card picture): two cards with the same shape and a heart. */
function PairExample({ s }) {
  const card = (
    <svg viewBox="0 0 40 40" width={s} height={s} aria-hidden="true">
      <rect x={2} y={2} width={36} height={36} rx={7} fill="#fffdf7" stroke={INK} strokeWidth={2.5} />
      <path d="M20 9 L31 30 H9 Z" fill="#4aa3ff" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
    </svg>
  )
  return (
    <motion.div aria-hidden="true" animate={reduceMotion() ? {} : { y: [0, -4, 0] }} transition={{ duration: 1.2, repeat: Infinity }}
      style={{ display: 'flex', alignItems: 'center', gap: 3, opacity: 0.7 }}>
      {card}
      <svg viewBox="-2 -2.5 24 22" width={s * 0.45} height={s * 0.4}><path d="M10 17 C2 11 0 7 0 4.5 A4.5 4.5 0 0 1 10 3 A4.5 4.5 0 0 1 20 4.5 C20 7 18 11 10 17Z" fill="#ff5b8a" stroke={INK} strokeWidth="1.5" /></svg>
      {card}
    </motion.div>
  )
}

/** One found pair on a pile: two little cards, the second a bit to the right. */
function Chip({ emoji, m }) {
  const mini = k => (
    <div style={{
      position: 'absolute', left: k * m * 0.45, top: k * m * 0.06, width: m, height: m, boxSizing: 'border-box',
      background: '#fffdf7', border: `2px solid ${INK}`, borderRadius: m * 0.18, boxShadow: '0 2px 0 rgba(42,27,61,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Art art={emoji} size={m * 0.74} />
    </div>
  )
  return <div style={{ position: 'relative', width: m * 1.45, height: m * 1.06 }}>{mini(0)}{mini(1)}</div>
}

/**
 * A pile of found pairs, laid out in `lanes` side by side along `dir`
 * ('v' down, 'h' across). Sized for `max` pairs from the start, so it never
 * reflows while it fills; if they cannot all fit, they overlap like a real
 * pile. A new pair flies in from where it was found (`from`, in root
 * coordinates), lands with a hop, and then rests.
 */
function Pile({ items, max, dir, rootRef, empty, length }) {
  const ref = useRef(null)
  const size = useSize(ref)
  const g = useMemo(() => {
    if (!size) return null
    const { w, h } = size
    const gap = 6
    let best = null
    for (let lanes = 1; lanes <= 3; lanes++) {
      const k = Math.ceil(max / lanes)
      const m = dir === 'v'
        ? Math.min((w - (lanes - 1) * gap) / lanes / 1.45, (h - (k - 1) * gap) / k / 1.06)
        : Math.min((h - (lanes - 1) * gap) / lanes / 1.06, (w - (k - 1) * gap) / k / 1.45)
      if (!best || m > best.m) best = { lanes, k, m }
    }
    // never smaller than this: then they overlap instead
    const cross = dir === 'v' ? w : h
    const m = Math.floor(Math.max(best.m, Math.min(30, cross / 1.6)))
    const mainLen = dir === 'v' ? h : w
    const chipMain = dir === 'v' ? m * 1.06 : m * 1.45
    const step = best.k > 1 ? Math.min(chipMain + gap, (mainLen - chipMain) / (best.k - 1)) : 0
    const chipCross = dir === 'v' ? m * 1.45 : m * 1.06
    const laneStep = chipCross + gap
    const used = best.lanes * chipCross + (best.lanes - 1) * gap
    return { lanes: best.lanes, m: Math.min(m, 64), step, laneStep, offset: Math.max(0, (cross - used) / 2) }
  }, [size, max, dir])
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0, minHeight: 0, alignSelf: 'stretch', ...(length ? { flex: '0 1 auto', height: length } : { flex: 1 }) }}>
      {g && items.length === 0 && empty && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{empty}</div>
      )}
      {g && items.map((it, i) => {
        const main = Math.floor(i / g.lanes) * g.step, lane = (i % g.lanes) * g.laneStep + g.offset
        return (
          <PileChip key={it.key} item={it} m={g.m} rootRef={rootRef}
            style={{ position: 'absolute', left: dir === 'v' ? lane : main, top: dir === 'v' ? main : lane, zIndex: i + 1 }} />
        )
      })}
    </div>
  )
}

function PileChip({ item, m, rootRef, style }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current, root = rootRef.current
    if (!el || !root || !item.from || reduceMotion() || !el.animate) return
    const me = pointIn(root, el)
    const dx = item.from.x - me.x, dy = item.from.y - me.y
    try {
      el.animate([
        { translate: `${dx}px ${dy}px`, scale: '1.7' },
        { translate: '0px 0px', scale: '1', offset: 0.75 },
        { translate: `0px ${-m * 0.25}px`, scale: '1', offset: 0.88 },
        { translate: '0px 0px', scale: '1' },
      ], { duration: 900, easing: 'ease-out' })
    } catch { /* an old browser: it is simply there */ }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} aria-hidden="true" style={style}><Chip emoji={item.emoji} m={m} /></div>
}

/** A player's side of the table: lit while it is that player's turn. */
function Side({ who, active, dim, style, children }) {
  return (
    <div data-side={who} data-active={active ? 'true' : 'false'} style={{
      position: 'relative', boxSizing: 'border-box', borderRadius: 22, border: `3px solid ${INK}`,
      background: who === 'lumi' ? 'linear-gradient(180deg, #fffdf7, #ffe7a0)' : 'linear-gradient(180deg, #fffdf7, #b7e893)',
      boxShadow: active
        ? `0 0 0 4px ${LUMI_GOLD}, 0 0 28px 10px rgba(255,214,70,0.85), 0 5px 0 rgba(42,27,61,0.25)`
        : '0 5px 0 rgba(42,27,61,0.25)',
      // the other side steps back a little (no grey: a greyed Lumi looked ill)
      opacity: dim ? 0.7 : 1, zIndex: 2,
      transition: 'box-shadow .35s, opacity .35s',
      ...style,
    }}>
      {children}
    </div>
  )
}

/** The child on its side: its own picture, and a hand pointing at the board on its turn. */
function ChildBadge({ avatar, s, pointing, toward }) {
  const rot = toward === 'right' ? 90 : 0
  return (
    <div style={{ position: 'relative', width: s, height: s, flexShrink: 0 }}>
      <div style={{
        width: s, height: s, borderRadius: '50%', background: '#fffdf7', border: `3px solid ${INK}`, boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 3px 0 rgba(42,27,61,0.25)',
      }}>
        <Art art={avatar} size={s * 0.72} />
      </div>
      <AnimatePresence>
        {pointing && (
          <motion.div key="hand" data-turn-hand="child" aria-hidden="true"
            initial={{ opacity: 0, scale: 0.4 }} exit={{ opacity: 0, scale: 0.4 }}
            animate={reduceMotion() ? { opacity: 1, scale: 1 } : {
              opacity: 1, scale: 1,
              x: toward === 'right' ? [0, s * 0.14, 0] : 0, y: toward === 'right' ? 0 : [0, -s * 0.14, 0],
            }}
            transition={{ x: { duration: 0.8, repeat: Infinity }, y: { duration: 0.8, repeat: Infinity } }}
            style={{
              position: 'absolute', pointerEvents: 'none',
              ...(toward === 'right' ? { left: s * 0.82, top: s * 0.18 } : { left: s * 0.72, top: -s * 0.42 }),
            }}>
            <div style={{ transform: `rotate(${rot}deg)` }}><Art art="👆" size={s * 0.62} /></div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Where the scene's sun is (the forest of components/play/Scene.jsx: sun
 * at 860/90 in a 1000 × 600 picture, rays to a radius of 78, the picture
 * scaled to cover and anchored at its bottom). Returns how far down from
 * the top of `root` it reaches, in root pixels, or 0 if it is not there.
 * Lumi's side keeps that corner free, so the sun is not half hidden.
 */
function sunReach(root) {
  const scene = root?.closest('.pl-game')?.querySelector('.pl-scene')
  if (!scene) return 0
  const s = scene.getBoundingClientRect(), r = root.getBoundingClientRect()
  if (!s.width || !s.height || !r.width) return 0
  const k = Math.max(s.width / 1000, s.height / 600)
  const left = s.left + (s.width - 1000 * k) / 2 + (860 - 78) * k
  const bottom = s.top + (s.height - 600 * k) + (90 + 78) * k
  if (bottom <= r.top || left >= r.right) return 0
  return (bottom - r.top) / (r.width / (root.offsetWidth || r.width)) + 6
}

export default function MemoryGame({ level = 1, onComplete }) {
  const cfg = useMemo(() => levelConfig(level), [level])
  const skill = useMemo(() => skillFor(level), [level])
  const paused = usePaused()
  const { later, afterSpeech } = useLater()
  const [bursts, burst] = useBursts()
  // The game screen shrinks a game to fit a low screen (a phone held
  // sideways: to 0.6). The things on the sides grow back by `ui` there, so
  // the child's picture, the counters and Lumi stay as large as on a tablet.
  const [ui, setUi] = useState(1)
  const juice = useJuice({ hudSize: Math.round(26 * ui) })
  const { hit, miss } = juice
  const app = useApp()
  const avatar = app?.state?.profiles?.[app?.state?.activeProfileId]?.avatar || '😊'

  // The game itself, also readable at once from timers (G.current)
  const [game, setGame] = useState(() => ({
    cards: buildCards(cfg), phase: 'preview', countdown: cfg.preview, turn: 'child',
    open: [], busy: false, peek: null, piles: { child: [], lumi: [] }, tries: 0,
  }))
  const G = useRef(game)
  const update = useCallback(patch => {
    G.current = { ...G.current, ...(typeof patch === 'function' ? patch(G.current) : patch) }
    setGame(G.current)
  }, [])

  const [hug, setHug] = useState(null)          // { a, b, dx, dy } two cards meeting
  const [puzzled, setPuzzled] = useState(null)  // { a, b, dir, up } two wrong ones look at each other
  const [jumps, setJumps] = useState({})        // card id -> how often it was turned
  const [paw, setPaw] = useState(null)          // { id, press } Lumi's wing over a card
  const [lumiMood, setLumiMood] = useState(cfg.versus ? 'sleep' : 'idle')
  const [cursor, setCursor] = useState(0)
  const [usingKeys, setUsingKeys] = useState(false)

  const rootRef = useRef(null)
  const boardRef = useRef(null)
  const cardRefs = useRef({})
  const root = useSize(rootRef)
  const boardBox = useSize(boardRef)

  const memRef = useRef(new Map())       // Lumi's memory: card id -> picture
  const seenRef = useRef(new Set())      // cards the child has seen face up during play
  const missedRef = useRef(new Set())    // pairs one of whose cards was part of the child's wrong try
  const forgottenRef = useRef(0)         // the child's wrong tries whose partner had been face up
  const missRowRef = useRef(0)           // the child's wrong tries in a row (alone: help after 4)
  const toldRef = useRef({})             // turn lines said once per level
  const lumiActing = useRef(false)
  const resultRef = useRef(null)

  // ── Layout ──────────────────────────────────────────────────────────
  const wide = root ? root.w / root.h >= 1.2 : typeof window !== 'undefined' && innerWidth > innerHeight
  const side = root ? Math.round(Math.max(140, Math.min(230, root.w * 0.16))) : 160
  const gap = root && root.w < 600 ? 10 : 14
  // On a tall screen the strips get the height the board cannot use (a
  // narrow phone limits the cards by its width): room for larger pairs
  const strip = (() => {
    if (!root || wide) return 96
    const n = cfg.versus ? 2 : 1
    const h0 = root.h - 22 - 12 * n - 84 * n
    const g0 = bestGrid(cfg.cards, root.w - 20, h0, gap, 170)
    const spare = h0 - (g0.rows * g0.s + (g0.rows - 1) * gap)
    return Math.round(Math.min(150, root.h * 0.2, 84 + Math.max(0, spare) / n))
  })()
  const grid = useMemo(() => {
    if (!boardBox) return null
    return bestGrid(cfg.cards, boardBox.w, boardBox.h, gap, 170)
  }, [boardBox, cfg.cards, gap])
  const pos = useCallback(id => (grid ? cellPos(id, cfg.cards, grid, gap) : { x: 0, y: 0 }), [grid, cfg.cards, gap])
  const gridW = grid ? grid.cols * grid.s + (grid.cols - 1) * gap : 0
  const gridH = grid ? grid.rows * grid.s + (grid.rows - 1) * gap : 0
  const [sunTop, setSunTop] = useState(0)
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!root || !el) return
    const k = el.getBoundingClientRect().width / (el.offsetWidth || 1)
    setUi(k > 0 ? Math.max(1, Math.min(1.7, 1 / k)) : 1)
    if (!wide || !cfg.versus) { setSunTop(0); return }
    const reach = sunReach(el)
    // only where enough room stays for Lumi and its pile
    setSunTop(reach > 0 && root.h - reach >= 240 ? Math.round(reach) : 0)
  }, [root, wide, cfg.versus])

  // ── The start ───────────────────────────────────────────────────────
  useEffect(() => {
    sayTask()
    if (!voice([cfg.versus ? SAY.versus : SAY.solo])) voice([START_FALLBACK])
  }, [cfg.versus])

  // The preview (held while the help is open); Lumi sleeps through it
  useEffect(() => {
    if (game.phase !== 'preview' || paused) return
    if (game.countdown <= 0) {
      update(g => ({ phase: 'play', cards: g.cards.map(c => ({ ...c, flipped: false })) }))
      setLumiMood('idle')
      sfx.whoosh()
      return
    }
    const t = setTimeout(() => update(g => ({ countdown: g.countdown - 1 })), 1000)
    return () => clearTimeout(t)
  }, [game.phase, game.countdown, paused, update])

  // ── Turning cards ───────────────────────────────────────────────────
  const finish = useCallback(() => {
    const g = G.current
    const child = g.piles.child.length
    const stars = starsFor({ versus: cfg.versus, pairs: cfg.pairs, tries: g.tries, forgotten: forgottenRef.current })
    // score: the child's pairs found without a wrong try on either card
    const clean = g.piles.child.filter(p => !missedRef.current.has(p.key)).length
    resultRef.current = cfg.versus
      ? { score: clean, total: child, stars }
      : { score: cfg.pairs - missedRef.current.size, total: cfg.pairs, stars }
    afterSpeech(() => update({ phase: cfg.versus ? 'count' : 'finale' }), 1400)
  }, [cfg, afterSpeech, update])

  const pairFound = useCallback((a, b, who) => {
    const g = G.current
    const ca = g.cards[a]
    const ea = cardRefs.current[a], eb = cardRefs.current[b]
    const pa = pos(a), pb = pos(b)
    setHug({ a, b, dx: (pb.x - pa.x) / 2, dy: (pb.y - pa.y) / 2 })
    if (ea) burst(ea, 'hearts', 8)
    if (eb) burst(eb, 'hearts', 8)
    if (who === 'child') {
      missRowRef.current = 0
      hit(ea)                                    // a star flies to the counter, the streak grows
    } else {
      sfx.match()
      setLumiMood('happy')
    }
    forget(memRef.current, [a, b])
    const r = rootRef.current
    const from = r && ea && eb ? (() => {
      const p = pointIn(r, ea), q = pointIn(r, eb)
      return { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    })() : null
    later(reduceMotion() ? 0 : 900, () => {
      setHug(null)
      sfx.boing()
      const now = G.current
      const cards = now.cards.map(c => (c.id === a || c.id === b) ? { ...c, matched: true, flipped: false } : c)
      const piles = { ...now.piles, [who]: [...now.piles[who], { key: ca.pairKey, emoji: ca.emoji, from }] }
      const left = cards.some(c => !c.matched && !c.joker)
      // the last pair is found and the Zauberkarte was never turned: it goes
      // in a puff of stars, so no card is left lying without a partner
      const spare = left ? null : cards.find(c => c.joker && !c.gone)
      if (spare) {
        const el = cardRefs.current[spare.id]
        if (el) burst(el, 'stars', 12)
        cards.forEach((c, i) => { if (c.id === spare.id) cards[i] = { ...c, gone: true } })
      }
      update({ cards, piles, open: [], busy: !left })
      if (who === 'lumi') later(700, () => setLumiMood('hmm'))
      if (!left) finish()
    })
  }, [pos, burst, hit, later, update, finish])

  const noPair = useCallback((a, b, who) => {
    const ea = cardRefs.current[a], eb = cardRefs.current[b]
    if (who === 'child') miss(eb)                // a soft bonk, the streak is over
    else { sfx.mismatch(); setLumiMood('oops') }
    const pa = pos(a), pb = pos(b)
    const dx = ea && eb ? pb.x - pa.x : 1, dy = ea && eb ? pb.y - pa.y : 0
    setPuzzled({ a, b, dir: Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) || 1 : 0, up: Math.sign(dy) })
    later(reduceMotion() ? 600 : 1300, () => {
      setPuzzled(null)
      sfx.slideDown()
      const now = G.current
      const turn = cfg.versus ? (who === 'child' ? 'lumi' : 'child') : 'child'
      update({ cards: now.cards.map(c => (c.id === a || c.id === b) ? { ...c, flipped: false } : c), open: [], busy: false, turn })
      if (cfg.versus) {
        setPaw(null)
        setLumiMood(turn === 'lumi' ? 'hmm' : 'idle')
        sfx.slideUp()
        // the first change of turns is said once (until recorded: the light and the hand show it)
        if (!toldRef.current[turn]) { toldRef.current[turn] = true; voice([turn === 'lumi' ? SAY.lumiTurn : SAY.childTurn]) }
      }
    })
  }, [cfg.versus, pos, miss, later, update])

  // The joker: all cards for a moment, for whoever turned it
  const playJoker = useCallback((id, who) => {
    const g = G.current
    update({ cards: g.cards.map(c => c.id === id ? { ...c, flipped: true } : c), busy: true })
    sfx.sparkle()
    later(reduceMotion() ? 200 : 650, () => {
      const el = cardRefs.current[id]
      if (el) burst(el, 'stars', 14)
      const now = G.current
      const cards = now.cards.map(c => c.id === id ? { ...c, gone: true, flipped: false } : c)
      const down = cards.filter(c => !c.matched && !c.gone && !c.flipped)
      if (who === 'child') {
        down.forEach(c => seenRef.current.add(c.id))
        setLumiMood('sleep')                    // Lumi does not look
        voice([SAY.joker])
      } else {
        // a glimpse of every card at once: Lumi keeps half as much as of
        // one card turned (with all it notices it swept the board at level 10)
        const view = viewOf(cards)
        const glimpse = { ...skill, notice: skill.notice / 2 }
        down.forEach(c => observe(memRef.current, { id: c.id, pairKey: c.pairKey }, view, grid?.cols ?? 4, glimpse))
        setLumiMood('wow')
        voice([SAY.lumiJoker])
      }
      update({ cards, peek: who })
      later(1500 + 70 * down.length, () => {
        update({ peek: null, busy: false })
        setLumiMood(G.current.turn === 'lumi' ? 'hmm' : 'idle')
      })
    })
  }, [update, later, burst, grid, skill])

  const reveal = useCallback((id, who) => {
    const g = G.current
    if (g.phase !== 'play' || g.busy || g.peek) return
    if (who === 'child' && g.turn !== 'child') return
    const card = g.cards[id]
    if (!card || card.flipped || card.matched || card.gone) return
    sfx.flip()
    setJumps(j => ({ ...j, [id]: (j[id] ?? 0) + 1 }))
    if (card.joker) { playJoker(id, who); return }

    const cards = g.cards.map(c => c.id === id ? { ...c, flipped: true } : c)
    const open = [...g.open, id]
    const seenBefore = new Set(seenRef.current)
    seenRef.current.add(id)
    if (cfg.versus) observe(memRef.current, { id, pairKey: card.pairKey }, viewOf(cards), grid?.cols ?? 4, skill)
    const word = wordLine(card.name)

    if (open.length < 2) {
      update({ cards, open })
      narrate([word])
      return
    }

    // Two cards are open
    const [a, b] = open
    const match = cards[a].pairKey === cards[b].pairKey
    update({ cards, open, busy: true, tries: who === 'child' ? g.tries + 1 : g.tries })
    if (match) {
      // the name first, then the praise (it used to cut the name off)
      // (not for the last pair against Lumi: the counting comes first, and
      // the results screen praises at the end)
      const last = !cards.some(c => !c.matched && !c.joker && c.pairKey !== card.pairKey)
      if (who === 'child' && !(cfg.versus && last)) sayRight(undefined, { lead: [word] })
      else narrate([word])
    } else if (who === 'child') {
      missedRef.current.add(cards[a].pairKey).add(cards[b].pairKey)
      const partner = cards.find(c => c.pairKey === cards[a].pairKey && c.id !== a)
      // a memory slip: the partner had been face up before, or the second
      // card had (the child turned one it could know was not it)
      if ((partner && seenBefore.has(partner.id)) || seenBefore.has(b)) forgottenRef.current++
      missRowRef.current++
      // alone, after the fourth wrong pair in a row: a kind word, after the name
      if (!cfg.versus && missRowRef.current === 4) narrate([word], { onEnd: () => sayWrong() })
      else narrate([word])
    } else {
      narrate([word])
    }
    later(match ? 520 : 600, () => (match ? pairFound(a, b, who) : noPair(a, b, who)))
  }, [cfg.versus, grid, skill, update, later, playJoker, pairFound, noPair])

  // ── Lumi's turn ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!cfg.versus || game.phase !== 'play' || game.turn !== 'lumi' || game.busy || game.peek) return
    if (lumiActing.current) return
    lumiActing.current = true
    const firstOfTurn = game.open.length === 0
    const go = () => {
      const g = G.current
      if (g.phase !== 'play' || g.turn !== 'lumi' || g.busy || g.peek) { lumiActing.current = false; return }
      const view = viewOf(g.cards)
      const id = g.open.length === 0
        ? chooseFirst(memRef.current, view)
        : chooseSecond(memRef.current, view, { id: g.open[0], pairKey: g.cards[g.open[0]].pairKey })
      if (id == null) { lumiActing.current = false; return }
      setPaw({ id, press: false })
      later(reduceMotion() ? 150 : 750, () => {
        setPaw({ id, press: true })
        later(200, () => {
          // the wing goes back to Lumi's edge: the card must be seen
          setPaw(null)
          lumiActing.current = false
          reveal(id, 'lumi')
        })
      })
    }
    // a first card after Lumi has finished speaking; a little "hm" before it
    if (firstOfTurn) afterSpeech(() => later(300 + Math.random() * 500, go), 700)
    else later(1100, go)
  }, [cfg.versus, game.phase, game.turn, game.busy, game.peek, game.open.length, later, afterSpeech, reveal])

  // ── Keys ────────────────────────────────────────────────────────────
  useEffect(() => {
    const cols = grid?.cols ?? 4
    const total = cfg.cards
    const onKey = (e) => {
      const arrow = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
      if (arrow) {
        e.preventDefault()
        setUsingKeys(true)
        setCursor(c => Math.min(total - 1, Math.max(0, c + arrow)))
      } else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setUsingKeys(true); reveal(cursor, 'child') }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cursor, reveal, cfg.cards, grid])

  // ── The hint hand ───────────────────────────────────────────────────
  // Alone: with a card open it taps that card's partner (the preview showed
  // it), otherwise a card of a pair seen in play or a card not seen yet.
  // Against Lumi it only shows "turn a card" while no card is open: it
  // never helps against Lumi.
  const handCard = useMemo(() => {
    if (game.phase !== 'play' || game.busy || game.peek || game.turn !== 'child') return null
    const cards = game.cards
    const down = cards.filter(c => !c.matched && !c.gone && !c.flipped)
    const open = cards.find(c => c.flipped && !c.matched && !c.gone)
    const seen = seenRef.current
    const partner = c => down.find(d => d.pairKey === c.pairKey && d.id !== c.id)
    if (cfg.versus) return open ? null : down[Math.floor(Math.random() * down.length)] ?? null
    if (open) return partner(open) ?? null
    const known = down.find(c => seen.has(c.id) && seen.has(partner(c)?.id))
    if (known) return known
    const fresh = down.filter(c => !seen.has(c.id))
    const pool = fresh.length ? fresh : down
    return pool[Math.floor(Math.random() * pool.length)] ?? null
  }, [game.phase, game.busy, game.peek, game.turn, game.cards, cfg.versus])
  const handDelay = game.tries === 0 && game.open.length === 0 ? 2000 : cfg.versus ? 8000 : 6000

  // ── Drawing ─────────────────────────────────────────────────────────
  const { cards, phase, turn, peek, piles } = game
  const versus = cfg.versus
  // after the last pair it is nobody's turn (the hand pointed on before)
  const allFound = !cards.some(c => !c.matched && !c.joker)
  const childActive = phase === 'play' && turn === 'child' && !allFound
  const lumiActive = phase === 'play' && turn === 'lumi' && !allFound
  const s = grid?.s ?? 0
  // Lumi's wing: over its card, or waiting at Lumi's edge of the board
  const pawHome = wide ? { x: gridW + s * 0.2, y: gridH / 2 - s * 0.4 } : { x: gridW / 2, y: -s * 0.75 }
  const pawSize = Math.max(40, s * 0.62)
  const pawAt = paw && grid ? (() => {
    const p = pos(paw.id)
    // the wing's tip (14, 52 of 60) on the middle of the card
    return { x: p.x + s / 2 - pawSize * (14 / 60), y: p.y + s / 2 - pawSize * (52 / 60) }
  })() : pawHome

  const stats = (
    <div style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
      {juice.hud}
      {/* the child's tries: Memo's own rating comes from them */}
      <div aria-label={`${game.tries} Versuche`} style={{ ...pxCard(), padding: `1px ${8 * ui}px`, fontFamily: 'var(--font-heading)', fontSize: 17 * ui, color: INK, display: 'flex', alignItems: 'center', gap: 3, borderRadius: 999 }}>
        <TurnedCards s={18 * ui} />{game.tries}
      </div>
    </div>
  )
  const timer = phase === 'preview' && (
    <motion.div key={game.countdown} aria-label={`noch ${game.countdown} Sekunden`}
      initial={{ scale: 1.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      style={{
        display: 'flex', flexShrink: 0, alignItems: 'center', gap: 2,
        fontFamily: 'var(--font-heading)', fontSize: 26 * ui, fontWeight: 800, color: INK, background: 'var(--px-gold)',
        border: `3px solid ${INK}`, borderRadius: 14, padding: '0 8px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)',
      }}>
      <Art art="⏳" size={24 * ui} />{game.countdown}
    </motion.div>
  )

  const badgeS = wide ? Math.min(64 * ui, side * 0.5) : Math.min(56, strip * 0.58)
  // In a side column the pile is as long as all pairs need, so the side
  // is no taller than its content (an empty white column before)
  const pileLength = (() => {
    if (!wide) return undefined
    const w = side - 22
    const lanes = (w - 6) / 2 / 1.45 >= 36 ? 2 : 1
    const m = Math.min(56, (w - (lanes - 1) * 6) / lanes / 1.45)
    const rows = Math.ceil(cfg.pairs / lanes)
    return Math.ceil(rows * m * 1.06 + (rows - 1) * 6)
  })()
  const childSide = (
    <Side who="child" active={versus && childActive} dim={versus && lumiActive}
      style={wide
        ? { width: side, flexShrink: 0, alignSelf: 'flex-start', maxHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 8px' }
        : { height: strip, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
      {wide || strip < 130
        ? <ChildBadge avatar={avatar} s={badgeS} pointing={versus && childActive} toward={wide ? 'right' : 'up'} />
        : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <ChildBadge avatar={avatar} s={badgeS} pointing={versus && childActive} toward="up" />
            {timer || stats}
          </div>
        )}
      {wide && (timer || stats)}
      <Pile items={piles.child} max={cfg.pairs} dir={wide ? 'v' : 'h'} rootRef={rootRef} length={pileLength}
        empty={!versus && <PairExample s={wide ? 34 : 30} />} />
      {!wide && strip < 130 && (timer || stats)}
    </Side>
  )
  const lumiS = wide ? Math.min(110 * ui, side * 0.8) : Math.min(84, strip * 0.86)
  const lumiSide = versus && (
    <Side who="lumi" active={lumiActive} dim={childActive}
      style={wide
        ? { width: side, flexShrink: 0, alignSelf: 'flex-end', maxHeight: `calc(100% - ${sunTop}px)`, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '10px 8px 6px' }
        : { height: strip, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '4px 10px' }}>
      {!wide && <Critter art="lumi" size={lumiS} mood={lumiMood} label="Lumi" shadow={false} />}
      <Pile items={piles.lumi} max={cfg.pairs} dir={wide ? 'v' : 'h'} rootRef={rootRef} length={pileLength} />
      {wide && <Critter art="lumi" size={lumiS} mood={lumiMood} label="Lumi" shadow={false} />}
    </Side>
  )

  const board = (
    <div ref={boardRef} style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {grid && (
        <div data-board style={{ position: 'relative', width: gridW, height: gridH, cursor: lumiActive ? 'default' : undefined }}>
          {cards.map(card => {
            if (card.matched || card.gone) return null
            const p = pos(card.id)
            const face = card.flipped || (phase === 'preview' && !card.joker) || (peek === 'child' && !card.joker)
            const canTap = !face && childActive && !game.busy && !peek
            const inHug = hug && (hug.a === card.id || hug.b === card.id)
            const sign = hug?.a === card.id ? 1 : -1
            const puz = puzzled && (puzzled.a === card.id || puzzled.b === card.id) ? (puzzled.a === card.id ? 1 : -1) : 0
            const lumiPeek = peek === 'lumi' && !face
            return (
              <motion.div key={card.id} ref={el => { cardRefs.current[card.id] = el }}
                role="button" tabIndex={-1} aria-label={face ? (card.joker ? 'Joker' : card.name) : 'Karte'} data-pair={card.pairKey} data-card={card.id}
                onClick={() => reveal(card.id, 'child')}
                whileHover={canTap ? { scale: 1.05, rotate: -2 } : {}}
                whileTap={canTap ? { scale: 0.9, rotate: 3 } : {}}
                animate={inHug && !reduceMotion()
                  ? { x: [0, hug.dx * sign * 0.8, 0], y: [0, hug.dy * sign * 0.8 - 10, 0], rotate: [0, sign * 10, 0], scale: [1, 1.08, 1] }
                  : lumiPeek && !reduceMotion()
                    ? { x: wide ? [0, 5, 0] : 0, y: wide ? 0 : [0, -5, 0], rotate: 0, scale: 1 }
                    : { x: 0, y: 0, rotate: 0, scale: 1 }}
                transition={inHug ? { duration: 0.9, times: [0, 0.45, 1] } : lumiPeek ? { duration: 0.7, repeat: Infinity } : { duration: 0.5 }}
                style={{
                  position: 'absolute', left: p.x, top: p.y, width: s, height: s, perspective: 700, zIndex: inHug ? 2 : 1,
                  cursor: canTap ? 'pointer' : 'default',
                  outline: usingKeys && card.id === cursor ? `4px solid ${INK}` : 'none', outlineOffset: 4, borderRadius: 16,
                }}>
                <motion.div
                  animate={{ rotateY: face ? 0 : 180 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 22 }}
                  style={{ position: 'relative', transformStyle: 'preserve-3d', width: '100%', height: '100%' }}>
                  {/* Front: the guest inside, who jumps up when turned */}
                  <div style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', ...pxCard(), borderRadius: 16,
                    ...(card.joker ? { background: 'radial-gradient(circle at 50% 40%, #fff7c2, #ffc93c 70%, #f0a020)' } : {}),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <motion.div key={jumps[card.id] ?? 0}
                      animate={jumps[card.id] && !reduceMotion() ? { y: [0, -s * 0.18, 0, -s * 0.06, 0], rotate: [0, -10, 10, -4, 0], scale: [0.8, 1.1, 1] } : {}}
                      transition={{ duration: 0.8, delay: 0.15 }}>
                      {/* a wrong pair: lean toward the other one, look, shrug (no sign over them) */}
                      <motion.div
                        animate={puz && !reduceMotion()
                          ? { x: [0, puz * (puzzled.dir || 0) * s * 0.16, puz * (puzzled.dir || 0) * s * 0.16, 0], y: [0, puz * -(puzzled.up || 0) * s * 0.06, -s * 0.08, 0],
                              rotate: [0, puz * (puzzled.dir || 1) * 18, puz * (puzzled.dir || 1) * -10, 0], scaleY: [1, 1, 1.12, 0.9] }
                          : { x: 0, y: 0, rotate: 0, scaleY: 1 }}
                        transition={{ duration: 1.2, times: [0, 0.3, 0.7, 1] }}
                        style={{ transformOrigin: '50% 100%' }}>
                        <Art art={card.emoji} size={s * 0.72} />
                      </motion.div>
                    </motion.div>
                  </div>
                  {/* Back: a present (golden glow while Lumi takes its joker peek) */}
                  <div style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', borderRadius: 16,
                    filter: 'drop-shadow(0 5px 0 rgba(42,27,61,0.3))',
                    boxShadow: lumiPeek ? `0 0 0 4px ${LUMI_GOLD}, 0 0 22px 6px rgba(255,214,70,0.9)` : 'none',
                    transition: 'box-shadow .3s',
                  }}>
                    <Present s={s} magic={card.joker} />
                  </div>
                </motion.div>
              </motion.div>
            )
          })}
          {/* Lumi's wing: over the board only on Lumi's turn */}
          {versus && (
            <motion.div data-paw aria-hidden="true"
              initial={false}
              animate={{ x: pawAt.x, y: pawAt.y, opacity: lumiActive ? 1 : 0, scale: paw?.press ? 0.82 : 1, rotate: paw?.press ? -8 : 0 }}
              transition={{ x: { type: 'spring', stiffness: 120, damping: 18 }, y: { type: 'spring', stiffness: 120, damping: 18 }, opacity: { duration: 0.3 }, scale: { duration: 0.15 }, rotate: { duration: 0.15 } }}
              style={{ position: 'absolute', left: 0, top: 0, zIndex: 5, pointerEvents: 'none', transformOrigin: '23% 87%' }}>
              <Wing s={pawSize} />
            </motion.div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div ref={rootRef} style={{
      position: 'relative', flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: wide ? 'row' : 'column',
      alignItems: 'stretch', gap: 12, padding: wide ? '12px 14px' : '10px 10px 12px', boxSizing: 'border-box',
    }}>
      {phase === 'count' ? null : wide ? (
        <>
          {childSide}
          {board}
          {versus ? lumiSide : <div style={{ width: side, flexShrink: 0 }} />}
        </>
      ) : (
        <>
          {lumiSide}
          {board}
          {childSide}
        </>
      )}

      {/* only for a child who plays with the keys */}
      {usingKeys && (
        <p style={{ position: 'absolute', left: 0, right: 0, bottom: 0, textAlign: 'center', fontFamily: 'var(--font-heading)', fontSize: 14, color: '#2a1b3d', margin: 0, opacity: 0.75, pointerEvents: 'none' }}>
          ⌨️ Pfeiltasten: wählen · Enter oder Leertaste: umdrehen
        </p>
      )}
      <HintHand key={handCard?.id ?? 'none'} to={handCard ? { current: cardRefs.current[handCard.id] } : null}
        active={!!handCard && phase === 'play'} delay={handDelay} />
      {phase === 'finale' && (
        <Finale items={piles.child.map(p => p.emoji).slice(0, 14)} hero="lumi" onDone={() => onComplete(resultRef.current)} />
      )}
      {phase === 'count' && (
        <Tally child={piles.child} lumi={piles.lumi} avatar={avatar} onDone={() => onComplete(resultRef.current)} />
      )}
      {bursts}
      {juice.layer}
    </div>
  )
}

/**
 * The end against Lumi: both piles are laid out side by side and counted
 * together, pair by pair ("eins, zwei, drei …"), then whoever has more is
 * celebrated. Lumi wins cheerfully and says nothing mean; at a draw both
 * are winners.
 */
function Tally({ child, lumi, avatar, onDone }) {
  const boxRef = useRef(null)
  const box = useSize(boxRef)
  const { later, afterSpeech } = useLater()
  const [bursts, burst] = useBursts()
  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const colRefs = useRef({})
  const n = Math.max(child.length, lumi.length)
  const winner = child.length > lumi.length ? 'child' : lumi.length > child.length ? 'lumi' : 'both'
  const end = useRef(onDone)
  end.current = onDone

  useEffect(() => {
    const count = i => {
      if (i > n) {
        setDone(true)
        sfx.tada()
        ;['child', 'lumi'].forEach(w => {
          const el = colRefs.current[w]
          if (el && (winner === w || winner === 'both')) burst(el, 'confetti', 18)
        })
        voice([winner === 'child' ? SAY.childWins : winner === 'lumi' ? SAY.lumiWins : SAY.tie])
        afterSpeech(() => later(reduceMotion() ? 1200 : 2400, () => end.current()), 600)
        return
      }
      setStep(i)
      sfx.pop()
      narrate([numberWord(i)])
      afterSpeech(() => count(i + 1), reduceMotion() ? 500 : 750)
    }
    later(600, () => count(1))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // the chips' size: as large as both columns allow for the longer pile
  const W = box?.w ?? 600, H = box?.h ?? 500
  const colW = (W - 24 - 19) / 2
  // the picture and the number side by side must fit the column
  const head = Math.min(170, H * 0.26, (colW - 34) / 1.3)
  const colH = H - 32 - head - 8
  let m = 30
  for (let per = 1; per <= 6; per++) {
    const rows = Math.ceil(Math.max(1, n) / per)
    m = Math.max(m, Math.min((colW - (per - 1) * 8) / per / 1.45, (colH - (rows - 1) * 8) / rows / 1.06, 130))
  }
  m = Math.floor(m)

  const column = (who, pile) => {
    const win = done && (winner === who || winner === 'both')
    const shown = Math.min(step, pile.length)
    return (
      <div ref={el => { colRefs.current[who] = el }} data-tally={who} style={{ width: colW, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div style={{ position: 'relative', height: head, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
          <AnimatePresence>
            {win && (
              <motion.div key="crown" initial={{ y: -30, opacity: 0, scale: 0.4 }} animate={{ y: 0, opacity: 1, scale: 1 }}
                style={{ position: 'absolute', left: head * 0.36 - head * 0.2, top: -head * 0.12, zIndex: 2 }}>
                <Art art="👑" size={head * 0.4} />
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div animate={win && !reduceMotion() ? { y: [0, -head * 0.15, 0] } : { y: 0 }} transition={{ duration: 0.6, repeat: win ? Infinity : 0 }}>
            {who === 'lumi'
              ? <Critter art="lumi" size={head * 0.72} mood={done ? (winner === 'child' ? 'happy' : 'dance') : 'idle'} shadow={false} />
              : <div style={{ width: head * 0.72, height: head * 0.72, borderRadius: '50%', background: '#fffdf7', border: `3px solid ${INK}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                  <Art art={avatar} size={head * 0.52} />
                </div>}
          </motion.div>
          <motion.div key={shown} data-count={who} initial={shown ? { scale: 1.6 } : false} animate={{ scale: 1 }}
            style={{
              minWidth: head * 0.5, textAlign: 'center', fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: head * 0.42, lineHeight: 1.1,
              color: INK, background: win ? LUMI_GOLD : '#fffdf7', border: `3px solid ${INK}`, borderRadius: 16, padding: '0 8px',
              boxShadow: '0 4px 0 rgba(42,27,61,0.3)', transition: 'background .3s',
            }}>{shown}</motion.div>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignContent: 'flex-start', gap: 8, width: '100%' }}>
          {pile.slice(0, step).map(p => (
            <motion.div key={p.key} initial={{ scale: 0.3, y: -20, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 16 }}>
              <Chip emoji={p.emoji} m={m} />
            </motion.div>
          ))}
        </div>
      </div>
    )
  }
  return (
    <div ref={boxRef} data-tally-board aria-hidden="true" style={{
      position: 'absolute', inset: 8, zIndex: 20, display: 'flex', justifyContent: 'center', alignItems: 'center',
      padding: '16px 12px', boxSizing: 'border-box',
      background: 'radial-gradient(circle at 50% 40%, #fffdf2 0%, #fff4cc 70%, #ffeaa8 100%)', borderRadius: 22, border: `3px solid ${INK}`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, maxHeight: '100%' }}>
        {column('child', child)}
        <div style={{ width: 3, alignSelf: 'stretch', background: 'rgba(42,27,61,0.15)', borderRadius: 2 }} />
        {column('lumi', lumi)}
      </div>
      {bursts}
    </div>
  )
}
