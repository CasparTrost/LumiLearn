import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { sfx } from '../../sfx.js'
import './play.css'

/**
 * Drag and drop for small hands: pick a thing up and give it to someone —
 * feed the monster, post the letter, put the sock in the basket. Moving
 * a thing to where it belongs is how young children play; a quiz button
 * is not.
 *
 * Three ways to do the same, so every child gets there:
 *   • drag it with a finger (or the mouse) and let go over the target,
 *   • tap it (it lifts, glowing), then tap the target,
 *   • keyboard: Tab to it, Enter, Tab to the target, Enter.
 * With `autoTarget`, a tap alone sends the thing to that target — for a
 * game with one character to feed, the tap is enough.
 *
 *   <DragArea autoTarget="bear">
 *     {apples.map(a => <Draggable key={a.id} id={a.id} data={a}>🍎</Draggable>)}
 *     <DropZone id="bear" onDrop={a => { eat(a); return true }}>
 *       {hover => <Critter art="🐻" mood={hover ? 'hungry' : mood} />}
 *     </DropZone>
 *   </DragArea>
 *
 * onDrop(data, zoneId) on the zone returns true to take the thing (it
 * flies in and vanishes; the game then removes it from its list) or false
 * to send it back where it came from (a friendly bounce).
 *
 * Works inside the FitBox (scaled): every position is measured on screen.
 */
const Ctx = createContext(null)
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function DragArea({ children, autoTarget = null, disabled = false }) {
  const zones = useRef(new Map())           // id -> { el, onDrop, accepts }
  const [picked, setPicked] = useState(null) // { id, data, el }
  const [hover, setHover] = useState(null)   // zone id under the dragged thing
  const [ghost, setGhost] = useState(null)   // { node, w, h, scale, x, y }
  const ghostRef = useRef(null)

  const zoneAt = useCallback((x, y) => {
    let best = null, bestD = Infinity
    for (const [id, z] of zones.current) {
      if (!z.el) continue
      const r = z.el.getBoundingClientRect()
      const pad = z.slop ?? 24
      if (x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad) {
        const d = Math.hypot(x - (r.left + r.width / 2), y - (r.top + r.height / 2))
        if (d < bestD) { best = id; bestD = d }
      }
    }
    return best
  }, [])

  // Fly the ghost to a point (taken) or back home (not taken), then clear
  const fly = useCallback((toRect, taken, done) => {
    const g = ghostRef.current
    const finish = () => { setGhost(null); done?.() }
    if (!g || reduceMotion()) { finish(); return }
    const cur = g.getBoundingClientRect()
    const dx = toRect.left + toRect.width / 2 - (cur.left + cur.width / 2)
    const dy = toRect.top + toRect.height / 2 - (cur.top + cur.height / 2)
    const base = g.style.transform
    const anim = g.animate([
      { transform: base, opacity: 1 },
      { transform: `${base} translate(${dx}px, ${dy}px) scale(${taken ? 0.35 : 1})`, opacity: taken ? 0 : 1 },
    ], { duration: taken ? 320 : 420, easing: taken ? 'ease-in' : 'cubic-bezier(.3,1.4,.5,1)', fill: 'forwards' })
    anim.onfinish = finish
  }, [])

  // Give `item` to zone `zid`; returns whether it was taken
  const deliver = useCallback((item, zid, fromRect) => {
    const z = zones.current.get(zid)
    if (!z) return false
    const ok = z.onDrop?.(item.data, zid) !== false
    const target = ok ? z.el.getBoundingClientRect() : fromRect
    if (!ok) sfx.boing()
    fly(target, ok)
    setPicked(null)
    setHover(null)
    return ok
  }, [fly])

  // A tap or key on a thing: pick it up, or send it straight to autoTarget
  const pick = useCallback((item) => {
    if (disabled) return
    if (autoTarget && zones.current.has(autoTarget)) {
      const r = item.el.getBoundingClientRect()
      setGhost(makeGhost(item, r))
      requestAnimationFrame(() => deliver(item, autoTarget, r))
      return
    }
    setPicked(p => (p?.id === item.id ? null : item))
    sfx.flip()
  }, [autoTarget, deliver, disabled])

  // A tap or key on a target while something is picked up
  const dropPicked = useCallback((zid) => {
    if (!picked) return false
    const r = picked.el.getBoundingClientRect()
    setGhost(makeGhost(picked, r))
    requestAnimationFrame(() => deliver(picked, zid, r))
    return true
  }, [picked, deliver])

  useEffect(() => { if (disabled) { setPicked(null); setHover(null) } }, [disabled])

  const api = useMemo(() => ({
    zones, picked, hover, disabled, setHover, setGhost, ghostRef, zoneAt, deliver, pick, dropPicked, fly,
  }), [picked, hover, disabled, zoneAt, deliver, pick, dropPicked, fly])

  return (
    <Ctx.Provider value={api}>
      {children}
      {ghost && createPortal(
        <div ref={ghostRef} className="pl-ghost"
          style={{ width: ghost.w, height: ghost.h, transformOrigin: '0 0', transform: `translate(${ghost.x}px, ${ghost.y}px) scale(${ghost.scale})` }}>
          <GhostCopy node={ghost.node} w={ghost.w} h={ghost.h} />
        </div>, document.body)}
    </Ctx.Provider>
  )
}

// The flying thing is a copy of what is on screen, not a second render of
// the game's children: a second render took over refs inside the thing (a
// hint hand's start point) and set them to null once it landed.
function GhostCopy({ node, w, h }) {
  const box = useRef(null)
  useLayoutEffect(() => {
    const b = box.current
    if (!b || !node) return
    b.replaceChildren(...[...node.childNodes].map(n => n.cloneNode(true)))
  }, [node])
  return <div ref={box} style={{ width: w, height: h }} />
}

function makeGhost(item, r) {
  const w = item.el.offsetWidth || r.width
  const h = item.el.offsetHeight || r.height
  return { node: item.el, w, h, scale: r.width / w, x: r.left, y: r.top }
}

/**
 * A thing that can be picked up. `data` goes to the target's onDrop.
 * While it is being carried, the thing in its place fades (`hidden` lets
 * the game hide it entirely once it was taken).
 */
export function Draggable({ id, data, children, disabled = false, label, style, className = '', ...rest }) {
  const ctx = useContext(Ctx)
  const el = useRef(null)
  const drag = useRef(null)
  const [carrying, setCarrying] = useState(false)
  if (!ctx) throw new Error('Draggable needs a DragArea around it')
  const off = disabled || ctx.disabled
  const item = () => ({ id, data, el: el.current })

  const onPointerDown = e => {
    if (off || e.button > 0) return
    el.current.setPointerCapture?.(e.pointerId)
    const r = el.current.getBoundingClientRect()
    drag.current = { x0: e.clientX, y0: e.clientY, r, moved: false }
  }
  const onPointerMove = e => {
    const d = drag.current
    if (!d) return
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 8) return
      d.moved = true
      setCarrying(true)
      ctx.setGhost(makeGhost(item(), d.r))
      sfx.flip()
    }
    const g = ctx.ghostRef.current
    if (g) {
      const w = el.current.offsetWidth || d.r.width
      g.style.transform = `translate(${d.r.left + dx}px, ${d.r.top + dy}px) scale(${(d.r.width / w) * 1.12})`
    }
    const z = ctx.zoneAt(e.clientX, e.clientY)
    if (z !== ctx.hover) ctx.setHover(z)
  }
  const end = e => {
    const d = drag.current
    drag.current = null
    if (!d) return
    if (!d.moved) { ctx.pick(item()); return }
    setCarrying(false)
    const z = ctx.zoneAt(e.clientX, e.clientY)
    if (z) ctx.deliver(item(), z, d.r)
    else { ctx.setHover(null); ctx.fly(d.r, false) }
  }
  const onKeyDown = e => {
    if (off) return
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.pick(item()) }
  }

  const isPicked = ctx.picked?.id === id
  return (
    <div {...rest} ref={el} role="button" tabIndex={off ? -1 : 0} aria-label={label} aria-pressed={isPicked}
      className={`pl-drag ${className}`} data-picked={isPicked ? 1 : 0}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={end}
      onPointerCancel={() => { drag.current = null; setCarrying(false); ctx.setGhost(null); ctx.setHover(null) }}
      onKeyDown={onKeyDown}
      style={{ opacity: carrying ? 0.25 : 1, transform: isPicked ? 'translateY(-8px) scale(1.06)' : undefined, transition: 'transform .15s, opacity .15s', cursor: off ? 'default' : 'grab', ...style }}>
      {children}
    </div>
  )
}

/**
 * A place things can be given to. `children` may be a function of
 * `hover` (something is held over it) and `ready` (something is picked
 * up and could come here) — open the mouth, glow the basket.
 */
export function DropZone({ id, onDrop, children, label, style, slop, className = '' }) {
  const ctx = useContext(Ctx)
  const el = useRef(null)
  if (!ctx) throw new Error('DropZone needs a DragArea around it')
  useEffect(() => {
    const zones = ctx.zones.current
    zones.set(id, { el: el.current, onDrop, slop })
    return () => { zones.delete(id) }
  })
  const hover = ctx.hover === id
  const ready = !!ctx.picked
  const onClick = () => { ctx.dropPicked(id) }
  const onKeyDown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ctx.dropPicked(id) } }
  return (
    <div ref={el} role={ready ? 'button' : undefined} tabIndex={ready ? 0 : -1} aria-label={label}
      className={`pl-drop ${className}`} onClick={onClick} onKeyDown={onKeyDown}
      style={{ cursor: ready ? 'pointer' : undefined, ...style }}>
      {typeof children === 'function' ? children(hover, { hover, ready }) : children}
    </div>
  )
}

/** For a target that wants to know whether something is held over it. */
export function useDragState() {
  const ctx = useContext(Ctx)
  return { hover: ctx?.hover ?? null, picked: ctx?.picked ?? null }
}
