import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { useApp, profileWardrobeStars } from '../AppContext.jsx'
import { HudBar, PxIcon, PxStar } from '../components/PixelUI.jsx'
import MusicButton from '../components/MusicControls.jsx'
import LumiFigure from '../components/LumiFigure.jsx'
import { Critter, Art, useMood, useBursts } from '../components/play/index.js'
import { asset } from '../lib/assets.js'
import { SLOTS, WARDROBE, ITEM_BY_ID, isUnlocked, cleanOutfit } from '../lib/wardrobe.js'
import { narrate, stopNarration } from '../narrator.js'
import { sfx } from '../sfx.js'
import { LINES, line } from '../lib/lumiLines.js'

/**
 * Lumis Kleiderschrank (lib/wardrobe.js): the stars a child collected
 * unlock things for Lumi to wear, five places combined freely: head, face,
 * neck, back and something to hold. Lumi stands large on the left (on top
 * on a phone held upright). The wardrobe shows ONE place at a time: five
 * big picture tabs above it choose the place (a five-year-old cannot scan
 * fifty things in one list). A tap on a thing puts it on with a little
 * show, a second tap takes it off; the button beside Lumi (a plain Lumi)
 * takes everything off at once.
 *
 * Things still to come are wrapped presents with the stars they need: per
 * place the next two, and a pile with the number of the others. The first
 * present of a place fills up as the stars come. Nothing is spent, nothing
 * can be lost.
 *
 * Lumi's sentences here are not recorded yet: they are looked up and left
 * out while missing (the screen works without words).
 */
const rec = key => (LINES[key] ? line(key) : null)
const REACTIONS = ['schrank/anziehen-1', 'schrank/anziehen-2', 'schrank/anziehen-3', 'schrank/anziehen-4']
const SHELF_LABEL = { head: 'Für den Kopf', face: 'Fürs Gesicht', neck: 'Für den Hals', back: 'Für den Rücken', hold: 'Zum Festhalten', top: 'Für den Bauch', bottom: 'Für die Beine', shoes: 'Für die Füße' }
// the tabs stand in lines of this many (eight places: two lines of four)
const TABS_PER_LINE = Math.ceil(SLOTS.length / Math.ceil(SLOTS.length / 5))
const TAB_LINES = Math.ceil(SLOTS.length / TABS_PER_LINE)
const TAB_GAP = 6
// presents shown per place before the pile
const WRAPPED_SHOWN = 2
// things that glow as new at most
const FRESH_SHOWN = 3
// the tiles: as big as fits, never smaller than this
const TILE_MAX = 92, TILE_MIN = 64
const rowGap = t => Math.round(t * 0.16) + 8
const ROW_GAP_MIN = 8
// the strip under the shelf for the "more" arrow
const MORE_STRIP = 56

function useViewport() {
  const get = () => ({ w: window.innerWidth, h: window.innerHeight })
  const [v, setV] = useState(get)
  useEffect(() => {
    const on = () => setV(get())
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  return v
}

export default function WardrobeScreen() {
  const { state, dispatch } = useApp()
  const profile = state.profiles[state.activeProfileId]
  const stars = profileWardrobeStars(profile)
  const outfit = cleanOutfit(profile?.outfit)
  const tried = profile?.wardrobeTried ?? []
  // "new" means something: only the newest three things not tried on yet
  // glow (an old save or many stars at once would make every tile glow)
  const freshIds = WARDROBE.filter(t => isUnlocked(t, stars) && !tried.includes(t.id)).slice(-FRESH_SHOWN).map(t => t.id)
  const isFresh = t => freshIds.includes(t.id)
  // opens on the place of the thing just won (results screen), else of the
  // newest thing not seen yet, else of the newest one not tried on
  const [tab, setTab] = useState(() => {
    const seen = profile?.wardrobeSeen ?? []
    const unseen = WARDROBE.filter(t => isUnlocked(t, stars) && !seen.includes(t.id))
    return ITEM_BY_ID[state.wardrobeFocus]?.slot ?? unseen.at(-1)?.slot ?? ITEM_BY_ID[freshIds.at(-1)]?.slot ?? 'head'
  })
  const [mood, setMood] = useMood('wave')
  const [wish, setWish] = useState(null)       // the present whose missing stars Lumi shows
  const [shake, setShake] = useState(null)
  const [bursts, burst] = useBursts()
  const lumiRef = useRef(null)
  const wishTimer = useRef(null)
  const reaction = useRef(Math.floor(Math.random() * REACTIONS.length))
  const worn = useRef(0), takenOff = useRef(0), toldWrapped = useRef(false)
  // Lumi is saying something about a thing just put on: a tab tapped now
  // does not cut it off, the place is said right after it
  const commenting = useRef(0), placeAfter = useRef(null)

  const { w, h } = useViewport()
  const wide = w > h || w >= 700
  // a phone held sideways: the tabs stand at the side of the wardrobe, so
  // the whole height is left for the shelf
  const sideTabs = wide && h < 560
  const hud = w < 521 ? 72 : 80
  const stageW = wide ? Math.min(440, Math.max(220, w * 0.4), Math.max(220, h - hud - (sideTabs ? 50 : 0))) : w
  const stageH = wide ? h - hud : Math.min(290, Math.round(h * 0.31))
  const lumi = Math.round(wide ? Math.min(stageW * 0.8, stageH * 0.7, 340) : stageH * 0.76)
  // the tabs: as big as fits, in lines of TABS_PER_LINE (two lines of four
  // for eight places; sideways on a phone, two columns of four), never
  // smaller than 44 px to tap
  const tabSize = sideTabs
    ? Math.round(Math.max(44, Math.min(64, (h - hud - 24) / TABS_PER_LINE - TAB_GAP - 4)))
    : Math.round(Math.max(44, Math.min(TAB_LINES > 1 ? 62 : 76, ((wide ? w - stageW : w) - 40) / TABS_PER_LINE - 10)))

  // the tabs never move: the first line (head to back) stands on one side
  // of the shelf, the second (hold to shoes) on the other (above and below
  // it, sideways on a phone left and right), so both lines touch the shelf
  // and the open tab is always one piece with it, wherever it is
  const tabLines = Array.from({ length: TAB_LINES }, (_, i) => SLOTS.slice(i * TABS_PER_LINE, (i + 1) * TABS_PER_LINE))
  const edges = sideTabs ? ['left', 'right'] : ['top', 'bottom']
  const items = WARDROBE.filter(t => t.slot === tab)
  const open = items.filter(t => isUnlocked(t, stars))
  const wrapped = items.filter(t => !isUnlocked(t, stars))
  // the next presents, and a pile for the rest (one left over is no pile:
  // it is shown as a present of its own, with its tag)
  const shown = wrapped.length === WRAPPED_SHOWN + 1 ? wrapped : wrapped.slice(0, WRAPPED_SHOWN)
  const pile = wrapped.slice(shown.length)
  const anyWorn = SLOTS.some(s => outfit[s])
  // the last step passed: the next present fills from there
  const lastStep = Math.max(0, ...WARDROBE.filter(t => t.stars <= stars).map(t => t.stars))

  // Every thing of a place on the shelf at once: the tiles are as big as
  // the shelf allows (TILE_MAX … TILE_MIN). Only where even the smallest do
  // not fit, the shelf scrolls, and a big arrow at its foot says so.
  const shelfRef = useRef(null)
  // (whether the strip for the "more" arrow was there when the shelf was measured)
  const stripRef = useRef(false)
  const [room, setRoom] = useState({ w: 0, h: 0, strip: false })
  useLayoutEffect(() => {
    const el = shelfRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const cs = getComputedStyle(el)
      const pw = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const ph = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom)
      const strip = stripRef.current
      setRoom(r => (r.w === pw && r.h === ph && r.strip === strip ? r : { w: pw, h: ph, strip }))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const count = open.length + shown.length + (pile.length ? 1 : 0)
  const fits = (t, gap = rowGap(t), h = room.h) => {
    const cols = Math.max(1, Math.floor((room.w + 10) / (t + 10)))
    const rows = Math.ceil(count / cols)
    return rows * t + (rows - 1) * gap <= h
  }
  // the shelf scrolls even with the smallest tiles: a strip at the foot of
  // its frame holds the "more" arrow, so the arrow never lies on a tile
  // (judged on the height with the strip given back, so it stays put)
  const strip = room.w > 0 && !fits(TILE_MIN, ROW_GAP_MIN, room.h + (room.strip ? MORE_STRIP : 0))
  stripRef.current = strip
  let tile = TILE_MAX
  while (tile > TILE_MIN && !fits(tile)) tile -= 2
  // a few pixels too tall even at the smallest tiles: the shelves move
  // closer together rather than hide a sliver behind the "more" arrow
  const gap = fits(tile) || !fits(tile, ROW_GAP_MIN) ? rowGap(tile) : ROW_GAP_MIN
  const [more, setMore] = useState(false)
  useEffect(() => {
    const el = shelfRef.current
    if (!el) return
    // a new place starts at the top (the last one may have been scrolled down)
    if (el.dataset.shelfTab !== tab) { el.dataset.shelfTab = tab; el.scrollTop = 0 }
    const check = () => setMore(el.scrollHeight - el.clientHeight - el.scrollTop > 6)
    check()
    // (again once the new shelf has settled: a check right at the tab
    // change could miss a shelf a few pixels too tall)
    const later = setTimeout(check, 350)
    el.addEventListener('scroll', check)
    return () => { clearTimeout(later); el.removeEventListener('scroll', check) }
  }, [tab, tile, gap, room, count])
  const scrollMore = () => {
    const el = shelfRef.current
    el?.scrollBy?.({ top: tile + gap, behavior: 'smooth' })
  }

  // Opened: what is unlocked is seen now (the sign on the home button goes),
  // Lumi waves and says what to do
  useEffect(() => {
    dispatch({ type: 'WARDROBE_SEEN' })
    // (the explanation only until the child has tried on a few things:
    // it knows the wardrobe then, and six seconds at every visit are too many)
    const t = setTimeout(() => { if (tried.length < 3) narrate([rec('schrank/willkommen')]) }, 500)
    return () => { clearTimeout(t); clearTimeout(wishTimer.current); stopNarration() }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // anything else Lumi says ends the comment (and what waited for it)
  const say = key => { commenting.current = 0; placeAfter.current = null; narrate([rec(key)]) }

  const home = () => { stopNarration(); dispatch({ type: 'NAVIGATE', payload: 'home' }) }

  const headPoint = () => {
    const r = lumiRef.current?.getBoundingClientRect()
    return r ? { x: r.left + r.width / 2, y: r.top + r.height * 0.3 } : undefined
  }

  // still wrapped: it shakes, and Lumi shows how many stars are missing
  const wrappedTap = (item, key) => {
    setShake(key + Date.now())
    sfx.bump()
    setMood('hmm', 1600)
    setWish(item)
    clearTimeout(wishTimer.current)
    wishTimer.current = setTimeout(() => setWish(null), 2600)
    // said once a visit; after that the bubble with the stars says it
    if (!toldWrapped.current) { toldWrapped.current = true; say('schrank/eingepackt') }
  }

  const tap = item => {
    setWish(null)
    // a place said after Lumi's comment is old news once the child acts
    placeAfter.current = null
    if (!isUnlocked(item, stars)) return wrappedTap(item, item.id)
    const on = outfit[item.slot] !== item.id
    dispatch({ type: 'WARDROBE_WEAR', payload: item.id })
    if (on) {
      sfx.boing()
      setTimeout(() => sfx.sparkle(), 220)
      // a hop on the spot (the spin of 'happy' swung Lumi out of the stage)
      setMood('hop', 1200)
      setTimeout(() => burst(headPoint(), 'stars', 12), 120)
      // Lumi says something about every third thing (the first one always):
      // a child tries on ten things in a row, and ten sentences are too many
      if (worn.current++ % 3 === 0) {
        reaction.current = (reaction.current + 1) % REACTIONS.length
        const r = rec(REACTIONS[reaction.current])
        if (r) {
          commenting.current = Date.now()
          placeAfter.current = null
          narrate([r], { onEnd: () => {
            commenting.current = 0
            const slot = placeAfter.current
            placeAfter.current = null
            if (slot) narrate([rec(`schrank/platz-${slot}`)])
          } })
        }
      }
    } else {
      sfx.pop()
      setMood('wow', 900)
      if (takenOff.current++ % 3 === 0) say('schrank/ausziehen')
    }
  }

  const undress = () => {
    setWish(null)
    dispatch({ type: 'WARDROBE_UNDRESS' })
    sfx.whoosh()
    setMood('wow', 900)
    say('schrank/alles-aus')
  }

  const pickTab = slot => {
    if (slot === tab) return
    sfx.pop()
    setWish(null)
    setTab(slot)
    if (Date.now() - commenting.current < 4000) { placeAfter.current = slot; return }
    say(`schrank/platz-${slot}`)
  }

  // a line of tabs on its side of the shelf (`edge`: where it stands)
  const tabLine = i => {
    const edge = edges[i], side = sideTabs
    return (
      <div role="tablist" aria-label={i === 0 ? 'Wo Lumi es trägt' : 'Wo Lumi es noch trägt'} aria-orientation={side ? 'vertical' : 'horizontal'} data-tabline={i} style={{
        display: 'flex', flexDirection: side ? 'column' : 'row', gap: TAB_GAP + (side ? 0 : 2), justifyContent: 'center',
        alignItems: { top: 'flex-end', bottom: 'flex-start', left: 'flex-end', right: 'flex-start' }[edge],
        [side ? 'paddingBlock' : 'paddingInline']: 6, flexShrink: 0, position: 'relative', zIndex: 2, alignSelf: 'center',
        // as deep as an open tab, open or not: the shelf never moves
        [side ? 'width' : 'height']: tabSize + 14,
      }}>
        {tabLines[i].map(slot => (
          <PlaceTab key={slot} slot={slot} size={tabSize} edge={edge} active={slot === tab} fresh={WARDROBE.some(t => t.slot === slot && isFresh(t))}
            worn={!!outfit[slot]} stars={stars} onTap={() => pickTab(slot)} />
        ))}
      </div>
    )
  }

  return (
    <div style={{ height: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <HudBar style={{ position: 'relative', zIndex: 10, minHeight: hud }}>
        <button className="px-btn px-btn--wood px-btn--icon" onClick={home} aria-label="Zur Startseite"><PxIcon name="back" size={20} color="#fff" /></button>
        <img src={asset('sprites/emoji/custom/kleiderschrank.webp')} alt="" style={{ width: 44, height: 44, flexShrink: 0 }} />
        <span className="px-title hud-hide-sm" style={{ flex: 1, minWidth: 0, fontSize: 'clamp(18px,3vw,28px)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Lumis Kleiderschrank</span>
        <span className="hud-only-sm" style={{ flex: 1 }} />
        <span className="px-chip" aria-label={`${stars} Sterne`} style={{ fontFamily: 'var(--font-heading)', flexShrink: 0 }}>
          <PxStar size={22} /> {stars}
        </span>
        <MusicButton />
      </HudBar>

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: wide ? 'row' : 'column' }}>
        {/* ── Lumi on a little rug, in the light ── */}
        <div style={{
          position: 'relative', zIndex: 2, flexShrink: 0, width: wide ? stageW : '100%', height: wide ? '100%' : stageH,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'radial-gradient(circle at 50% 45%, #fff8e2 0%, #ffeec2 38%, #f6dca8 70%, #ecc98c 100%)',
          borderRight: wide ? '4px solid var(--px-ink)' : 'none', borderBottom: wide ? 'none' : '4px solid var(--px-ink)',
        }}>
          <div style={{ position: 'relative', width: lumi, height: lumi * 1.06, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {/* the rug */}
            <div aria-hidden="true" style={{ position: 'absolute', bottom: 0, left: '6%', width: '88%', height: lumi * 0.16, borderRadius: '50%', background: 'radial-gradient(ellipse, #ff9fb8 0%, #f2789a 55%, #d95f82 100%)', border: '3px solid var(--px-ink)' }} />
            <div ref={lumiRef} style={{ position: 'relative', marginBottom: lumi * 0.05 }}>
              <Critter art="lumi" size={lumi} mood={mood} label="Lumi" shadow={false} />
              {/* a tapped present: the stars still missing, in a bubble beside Lumi's head */}
              {wish && (
                // (at Lumi's feet: beside the head it lay over the hat)
                <div style={{ position: 'absolute', left: '50%', bottom: -lumi * 0.08, transform: 'translateX(-50%)', zIndex: 5 }}>
                  <motion.div key={wish.id} data-wish={wish.stars - stars} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 380, damping: 18 }}
                    style={{ position: 'relative', transformOrigin: '50% 0%', background: '#fffdf7', border: '3px solid var(--px-ink)', borderRadius: 16, padding: '6px 10px', boxShadow: '0 4px 0 rgba(42,27,61,0.3)' }}>
                    <MissingStars item={wish} stars={stars} lastStep={lastStep} next={wish.id === wrapped[0]?.id} />
                    <span aria-hidden="true" style={{ position: 'absolute', top: -13, left: '50%', marginLeft: -9, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 9px 13px 9px', borderColor: 'transparent transparent #2a1b3d transparent' }} />
                  </motion.div>
                </div>
              )}
            </div>
          </div>
          {/* everything off at once: a plain Lumi */}
          {anyWorn && (
            <motion.button type="button" className="px-btn px-btn--parch" onClick={undress} aria-label="Alles ausziehen" data-undress
              initial={{ scale: 0 }} animate={{ scale: 1 }} whileTap={{ scale: 0.9 }}
              style={{ position: 'absolute', left: 10, top: 10, width: 60, height: 60, padding: 0, zIndex: 6 }}>
              <LumiFigure outfit={null} size={46} style={{ display: 'block' }} />
              <span aria-hidden="true" style={{ position: 'absolute', right: -6, bottom: -6, width: 26, height: 26, borderRadius: '50%', background: '#fff', border: '3px solid var(--px-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg viewBox="0 0 20 20" width="16" height="16"><path d="M5 5 L15 15 M15 5 L5 15" stroke="#e5483f" strokeWidth="3.4" strokeLinecap="round" /></svg>
              </span>
            </motion.button>
          )}
        </div>

        {/* ── The wardrobe: five picture tabs, one place at a time ── */}
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: sideTabs ? 'row' : 'column', padding: sideTabs ? '8px 6px' : wide ? '10px clamp(10px,2vw,22px) 12px' : '8px 10px 10px' }}>
          {tabLine(0)}
          <div style={{
            flex: 1, minHeight: 0, minWidth: 0, maxWidth: 680, width: '100%', margin: sideTabs ? '0 -4px' : '-4px auto', borderRadius: 22, border: '4px solid var(--px-ink)',
            padding: sideTabs ? 6 : 'clamp(6px,1.4vw,12px)', paddingBottom: strip ? MORE_STRIP : undefined, flexDirection: 'column',
            background: 'linear-gradient(90deg, #a8652c 0%, #c27a3a 12%, #c98443 50%, #c27a3a 88%, #a8652c 100%)',
            boxShadow: '0 6px 0 rgba(42,27,61,0.3)', display: 'flex', position: 'relative',
          }}>
            <section ref={shelfRef} role="tabpanel" aria-label={SHELF_LABEL[tab]} data-shelf={tab} data-tile={tile} style={{
              flex: 1, minHeight: 0, overflow: 'auto', borderRadius: 12, border: '3px solid var(--px-ink)',
              background: `repeating-linear-gradient(180deg, #fbeacb 0px, #fbeacb ${tile + 2}px, #b06c32 ${tile + 2}px, #8a4f22 ${tile + gap}px)`,
              backgroundPosition: `0 ${sideTabs ? 8 : 10}px`, padding: sideTabs ? '8px 8px' : '10px 10px',
            }}>
              <motion.div key={tab} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25 }}
                style={{ display: 'flex', flexWrap: 'wrap', gap: `${gap}px 10px`, justifyContent: 'flex-start' }}>
                {open.map(item => (
                  <Thing key={item.id} item={item} size={tile} stars={stars}
                    worn={outfit[tab] === item.id} fresh={isFresh(item)} shake={null} onTap={() => tap(item)} />
                ))}
                {shown.map((item, i) => (
                  // (a tap on the pile shows this place's next present: it shakes along)
                  <Thing key={item.id} item={item} size={tile} stars={stars} next={i === 0} lastStep={lastStep}
                    shake={shake?.startsWith(item.id) || (i === 0 && shake?.startsWith('pile')) ? shake : null} onTap={() => tap(item)} />
                ))}
                {pile.length > 0 && (
                  <Pile n={pile.length} size={tile} shake={shake?.startsWith('pile') ? shake : null} onTap={() => { setWish(null); wrappedTap(wrapped[0], 'pile') }} />
                )}
              </motion.div>
            </section>
            {/* more below: a big bouncing arrow in the strip at the foot of the
                shelf's frame (inside the shelf, on no tile) that scrolls it on */}
            {strip && more && (
              <motion.button type="button" onClick={scrollMore} aria-label="Weiter unten gibt es mehr" data-more
                animate={{ y: [0, 2, 0] }} transition={{ duration: 1, repeat: Infinity }}
                style={{ position: 'absolute', left: '50%', bottom: 4, marginLeft: -32, boxSizing: 'border-box', width: 64, height: 48, borderRadius: 18, border: '4px solid var(--px-ink)', background: '#ffc93c', boxShadow: '0 4px 0 rgba(42,27,61,0.35)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                <svg viewBox="0 0 24 24" width="30" height="30"><path d="M5 9 L12 16 L19 9" stroke="#2a1b3d" strokeWidth="3.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </motion.button>
            )}
          </div>
          {tabLine(1)}
        </div>
      </div>
      {bursts}
    </div>
  )
}

/**
 * A tab for a place: always the first thing of the place (a hat, glasses,
 * a scarf, wings, a balloon), so a tab never changes its picture: the thing
 * Lumi wears said the place badly (a clown's nose beside the balloon, a
 * cape like a skirt). A faded grey picture with a present while nothing of the
 * place is owned (the first thing is the first one owned, so nothing is
 * shown in colour that is not there; a black shadow of a pair of shoes read as two blobs). A sparkle when something there is
 * new, a green dot while Lumi wears something of it.
 */
function PlaceTab({ slot, size, edge, active, fresh, worn, stars, onTap }) {
  const side = edge === 'left' || edge === 'right'
  // the side that joins the shelf, and how far an idle tab steps back from it
  const join = { top: 'Bottom', bottom: 'Top', left: 'Right', right: 'Left' }[edge]
  const away = { top: 6, bottom: -6, left: 6, right: -6 }[edge]
  // the sparkle and the green dot sit on the corners away from the shelf
  const far = edge === 'bottom' ? 'bottom' : 'top', out = edge === 'left' ? 'left' : 'right', dot = out === 'left' ? 'right' : 'left'
  const rep = WARDROBE.find(t => t.slot === slot)
  const owned = !!rep && isUnlocked(rep, stars)
  return (
    <motion.button type="button" role="tab" aria-selected={active} aria-label={`${SHELF_LABEL[slot]}${fresh ? ', etwas Neues' : ''}`} data-tab={slot}
      onClick={onTap} whileTap={{ scale: 0.92 }} layout
      data-owned={owned ? '1' : undefined}
      animate={side ? { x: active ? 0 : away } : { y: active ? 0 : away }}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'relative',
        width: side ? size + (active ? 14 : 6) : size + 8, height: side ? size + 4 : size + (active ? 14 : 6),
        borderRadius: { top: '16px 16px 0 0', bottom: '0 0 16px 16px', left: '16px 0 0 16px', right: '0 16px 16px 0' }[edge], border: '4px solid var(--px-ink)',
        [`border${join}`]: active ? '4px solid #c98443' : '4px solid var(--px-ink)',
        background: active ? `linear-gradient(${edge === 'bottom' ? '0deg' : '180deg'}, #fff8e2, #f6dca8)` : 'linear-gradient(180deg, #e9c48e, #c99a60)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', [`padding${join}`]: active ? 6 : 0,
        boxShadow: active ? `0 ${edge === 'bottom' ? 3 : -3}px 0 rgba(255,255,255,0.6) inset` : 'none',
      }}>
      {rep && (
        <span style={{ position: 'relative', opacity: owned ? (active ? 1 : 0.8) : 0.45, filter: owned ? undefined : 'grayscale(1) contrast(0.8)' }}>
          <ThingPic item={rep} size={size - 10} />
        </span>
      )}
      {!owned && (
        <span aria-hidden="true" style={{ position: 'absolute', right: 2, bottom: 2 }}><Art art="🎁" size={Math.round(size * 0.36)} /></span>
      )}
      {worn && (
        <span aria-hidden="true" style={{ position: 'absolute', [dot]: -6, [far]: -6, width: 18, height: 18, borderRadius: '50%', background: '#3aa63a', border: '3px solid #fff' }} />
      )}
      {fresh && (
        <motion.span aria-hidden="true" animate={{ scale: [1, 1.25, 1] }} transition={{ duration: 1.2, repeat: Infinity }}
          style={{ position: 'absolute', [out]: -8, [far]: -8, width: 24, height: 24, borderRadius: '50%', background: '#ff5b8a', border: '3px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, lineHeight: 1 }}>✨</motion.span>
      )}
    </motion.button>
  )
}

/** More presents waiting in this place: a little pile and how many (a tap shows how far the next present is). */
function Pile({ n, size, shake, onTap }) {
  return (
    <motion.button type="button" onClick={onTap} aria-label={`Noch ${n} Geschenke`} data-pile={n}
      whileTap={{ scale: 0.9 }} key={shake ?? 'still'} animate={shake ? { rotate: [0, -10, 9, -6, 4, 0] } : { rotate: 0 }} transition={{ duration: 0.5 }}
      style={{
        all: 'unset', boxSizing: 'border-box', cursor: 'pointer', position: 'relative', width: size, height: size, flexShrink: 0,
        borderRadius: 18, border: '3px dashed rgba(42,27,61,0.35)', background: 'rgba(255,255,255,0.35)',
      }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: '8%', top: '30%' }}><Art art="🎁" size={Math.round(size * 0.4)} /></span>
      <span aria-hidden="true" style={{ position: 'absolute', right: '8%', top: '30%' }}><Art art="🎁" size={Math.round(size * 0.4)} /></span>
      <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '4%', transform: 'translateX(-50%)' }}><Art art="🎁" size={Math.round(size * 0.44)} /></span>
      <span aria-hidden="true" style={{
        position: 'absolute', bottom: 5, left: '50%', transform: 'translateX(-50%)', background: 'var(--px-ink)', color: '#fff', borderRadius: 10,
        padding: '1px 8px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, lineHeight: '20px',
      }}>+{n}</span>
    </motion.button>
  )
}

/**
 * How far the child is towards a present, the same on its tile and in
 * Lumi's bubble: the next present of a place fills from the last step
 * passed; up to five stars to go are star outlines that fill (`slots`),
 * more are a bar with the real share. A present further back shows only
 * the stars on its tag (in the bubble: the bar, which is empty or nearly).
 */
export function progressOf(item, stars, lastStep, next) {
  const span = Math.max(1, item.stars - lastStep)
  const got = Math.max(0, Math.min(span, stars - lastStep))
  return { span, got, share: next ? got / span : 0, slots: !!next && span <= 5 }
}

/**
 * The stars still missing for a present, in Lumi's bubble, by the tile's
 * rule (progressOf): where the tile shows filled and empty stars, the
 * bubble shows the same stars; where it shows a bar or only its tag, the
 * bubble shows the bar and the number on the tag (a star with a number
 * means one thing everywhere in the wardrobe: the stars a present needs).
 */
function MissingStars({ item, stars, lastStep, next }) {
  const n = item.stars - stars
  const { span, got, share, slots } = progressOf(item, stars, lastStep, next)
  if (!slots) return (
    <span role="img" aria-label={`Noch ${n} Sterne`} data-bubble="bar" style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 20, lineHeight: '24px', color: 'var(--px-ink)', whiteSpace: 'nowrap' }}>
      <span style={{ display: 'block', width: 64, height: 12, borderRadius: 6, background: '#fff', overflow: 'hidden', border: '2px solid var(--px-ink)' }}>
        <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, background: 'linear-gradient(90deg, #ffe680, #ffc93c)' }} />
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 2 }}><PxStar size={22} />{item.stars}</span>
    </span>
  )
  return (
    <span role="img" aria-label={`Noch ${n} Sterne`} data-bubble={`${got}/${span}`} style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: span }, (_, i) => i < got ? <PxStar key={i} size={24} /> : <StarOutline key={i} size={24} />)}
    </span>
  )
}

/** A thing's picture, the drawn part (item.box) filling the tile. */
export function ThingPic({ item, size }) {
  const [x0, y0, x1, y1] = item.box ?? [0, 0, 1, 1]
  const k = Math.min(1 / (x1 - x0), 1 / (y1 - y0), 2.4) * 0.86
  const S = size * k
  return (
    <span style={{ position: 'relative', display: 'block', width: size, height: size, overflow: 'hidden', pointerEvents: 'none' }}>
      <img src={asset(item.src)} alt="" draggable={false}
        style={{ position: 'absolute', width: S, height: S, maxWidth: 'none', left: size / 2 - (x0 + x1) / 2 * S, top: size / 2 - (y0 + y1) / 2 * S }} />
    </span>
  )
}

/**
 * One place in the wardrobe: a thing to put on (a ring and a tick while
 * Lumi wears it, a glow while it is new) or a present still wrapped, with
 * the stars it needs; the next present fills up as the stars come.
 */
function Thing({ item, size, stars, worn, fresh, next, lastStep = 0, shake, onTap }) {
  const open = isUnlocked(item, stars)
  // almost there, from the last step passed: up to five stars as outlines
  // that fill, more as a bar with the real share (empty is empty)
  const { span, got, share, slots } = progressOf(item, stars, lastStep, next)
  return (
    <motion.button type="button" onClick={onTap}
      aria-label={open ? `${item.name}${worn ? ', trägt Lumi' : ''}${fresh ? ', neu' : ''}` : `Geschenk, ${item.stars} Sterne`}
      aria-pressed={open ? worn : undefined}
      data-thing={item.id} data-state={open ? (worn ? 'worn' : fresh ? 'new' : 'open') : next ? 'next' : 'locked'}
      whileTap={{ scale: 0.9 }}
      animate={shake ? { rotate: [0, -14, 12, -8, 6, 0] } : next ? { rotate: [0, 0, 0, -5, 5, -3, 0] } : { rotate: 0 }}
      transition={shake ? { duration: 0.5 } : next ? { duration: 3, repeat: Infinity } : { duration: 0.2 }}
      key={shake ?? 'still'}
      style={{
        all: 'unset', boxSizing: 'border-box', position: 'relative', cursor: 'pointer', width: size, height: size,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-start', flexShrink: 0,
      }}>
      <span style={{
        position: 'relative', width: size, height: size, borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: worn ? 'radial-gradient(circle, #e9ffe0 0%, #b9ecaa 100%)' : open ? 'radial-gradient(circle, #fffdf5 0%, #fff1d0 100%)' : 'rgba(255,255,255,0.35)',
        border: worn ? '4px solid #3aa63a' : open ? '3px solid var(--px-ink)' : '3px dashed rgba(42,27,61,0.35)',
        boxShadow: worn ? '0 0 0 3px #fff, 0 4px 0 rgba(42,27,61,0.35)' : open ? '0 4px 0 rgba(42,27,61,0.3)' : 'none',
        opacity: open || next ? 1 : 0.8,
      }}>
        {fresh && !worn && (
          <motion.span aria-hidden="true" animate={{ opacity: [0.35, 0.95, 0.35], scale: [0.96, 1.06, 0.96] }} transition={{ duration: 1.6, repeat: Infinity }}
            style={{ position: 'absolute', inset: -6, borderRadius: 22, boxShadow: '0 0 14px 6px rgba(255,201,60,0.9)', border: '3px solid #ffc93c', pointerEvents: 'none' }} />
        )}
        {open ? <ThingPic item={item} size={size - 10} /> : <Art art="🎁" size={Math.round(size * (next ? 0.66 : 0.58))} style={{ marginTop: -6, pointerEvents: 'none' }} />}
        {worn && (
          <span aria-hidden="true" style={{ position: 'absolute', right: -6, top: -6, width: 26, height: 26, borderRadius: '50%', background: '#3aa63a', border: '3px solid #fff', color: '#fff', fontWeight: 800, fontSize: 16, lineHeight: '20px', textAlign: 'center', boxShadow: '0 2px 0 rgba(42,27,61,0.35)' }}>✓</span>
        )}
        {fresh && !worn && (
          <motion.span aria-hidden="true" animate={{ rotate: [0, 20, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 1.4, repeat: Infinity }}
            style={{ position: 'absolute', right: -8, top: -10, fontSize: 24, lineHeight: 1, pointerEvents: 'none' }}>✨</motion.span>
        )}
        {!open && (
          // the stars it needs, on a little tag
          <span aria-hidden="true" style={{
            position: 'absolute', bottom: next ? 16 : 5, left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: 2,
            background: 'var(--px-ink)', color: '#fff', borderRadius: 10, padding: '1px 7px 1px 4px', fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 15, lineHeight: '20px',
          }}><PxStar size={15} />{item.stars}</span>
        )}
        {next && slots && (
          <span aria-hidden="true" data-progress={`${got}/${span}`} style={{ position: 'absolute', left: 0, right: 0, bottom: 2, display: 'flex', justifyContent: 'center', gap: 1 }}>
            {Array.from({ length: span }, (_, i) => i < got
              ? <PxStar key={i} size={Math.min(19, Math.floor((size - 10) / span) - 1)} />
              : <StarOutline key={i} size={Math.min(19, Math.floor((size - 10) / span) - 1)} />)}
          </span>
        )}
        {next && !slots && (
          <span aria-hidden="true" data-progress={`${got}/${span}`} style={{ position: 'absolute', left: 7, right: 7, bottom: 4, height: 11, borderRadius: 6, background: '#fff', overflow: 'hidden', border: '2px solid var(--px-ink)' }}>
            <span style={{ display: 'block', height: '100%', width: `${share * 100}%`, background: 'linear-gradient(90deg, #ffe680, #ffc93c)' }} />
          </span>
        )}
      </span>
    </motion.button>
  )
}

/** A star still to come: a clear dark outline on white (a grey star vanished on the shelf). */
function StarOutline({ size }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      <path d="M12 2l3 6.3 6.9.9-5 4.8 1.3 6.8L12 17.5l-6.2 3.3 1.3-6.8-5-4.8 6.9-.9z" fill="#fff" stroke="#2a1b3d" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  )
}
