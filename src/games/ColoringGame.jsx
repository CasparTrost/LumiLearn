import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { PxIcon } from '../components/PixelUI.jsx'
import { useApp } from '../AppContext.jsx'
import { narrate } from '../narrator.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { pxCard, pxButton, pxBubble, INK } from './px.js'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'

const IMAGES = [
  // A completely empty sheet. Both painting modules were strictly guided —
  // colour inside these lines, or fill the region in the colour it asks for —
  // so there was nowhere in the app to simply draw something of your own.
  // Always unlocked: free drawing is not a reward for reaching a level.
  { id: 'blank', src: null, label: 'Kritzel-Leinwand', emoji: '🖍️', free: true },
  // Own pages with Lumi (scripts/generate-coloring-pages.py); ids stay
  // stable, the album remembers them for "Weitermalen"
  { id: 'lumi-wald',      src: `${BASE}images/coloring/lumi-wald.png`,      label: 'Lumi im Zauberwald',   emoji: '🍄' },
  { id: 'lumi-bauernhof', src: `${BASE}images/coloring/lumi-bauernhof.png`, label: 'Lumi auf dem Bauernhof', emoji: '🐮' },
  { id: 'lumi-weltraum',  src: `${BASE}images/coloring/lumi-weltraum.png`,  label: 'Lumi im Weltraum',     emoji: '🚀' },
  { id: 'lumi-meer',      src: `${BASE}images/coloring/lumi-meer.png`,      label: 'Lumi im Meer',         emoji: '🐠' },
  { id: 'lumi-schloss',   src: `${BASE}images/coloring/lumi-schloss.png`,   label: 'Lumi und der kleine Drache', emoji: '🏰' },
  { id: 'lumi-garten',    src: `${BASE}images/coloring/lumi-garten.png`,    label: 'Lumi im Garten',       emoji: '🌻' },
]

// 14 colours a child can tell apart, each with its name (Lumi says it). There
// were 40, many nearly the same (#FF0000 / #FF4444), as 32 px dots.
const COLORS = [
  { name: 'Rot',       value: '#E53935' },
  { name: 'Orange',    value: '#FB8C00' },
  { name: 'Gelb',      value: '#FDD835' },
  { name: 'Hellgrün',  value: '#9CCC65' },
  { name: 'Grün',      value: '#2E7D32' },
  { name: 'Hellblau',  value: '#4FC3F7' },
  { name: 'Blau',      value: '#1E5BD8' },
  { name: 'Lila',      value: '#8E24AA' },
  { name: 'Rosa',      value: '#F8A5C2' },
  { name: 'Pink',      value: '#E91E63' },
  { name: 'Hellbraun', value: '#D7A678' },
  { name: 'Braun',     value: '#6D4C41' },
  { name: 'Schwarz',   value: '#212121' },
  { name: 'Weiß',      value: '#FFFFFF' },
]

// three sizes in picture pixels (the sheets are about 1000 px wide)
const BRUSHES = [
  { id: 'thin',   r: 6,  label: 'dünn',   dot: 10 },
  { id: 'medium', r: 14, label: 'mittel', dot: 18 },
  { id: 'thick',  r: 28, label: 'dick',   dot: 28 },
]

const STAMPS = ['⭐','❤️','🌈','🌞','🌸','🦋','🐱','🐟','🚀','🍀','⚡','☁️']
const STAMP_SIZE = 120     // fixed: it used to grow with the brush, which no child could see coming

const TOOLS = [
  { id: 'brush',  icon: '🖌️', label: 'Pinsel',   say: 'Der Pinsel. Mal mit dem Finger.' },
  { id: 'fill',   icon: '🪣', label: 'Eimer',    say: 'Der Farbeimer. Tippe in eine Fläche.' },
  { id: 'eraser', icon: '🧽', label: 'Radierer', say: 'Der Radierer. Wisch die Farbe weg.' },
  { id: 'stamp',  icon: '⭐', label: 'Stempel',  say: 'Die Stempel. Such dir einen aus.' },
]

const UNDO_MAX  = 10
const ALBUM_MAX = 30

// ── Album: one per profile, full size, in IndexedDB ───────────────────────────
// It was one global list of 220 px thumbnails in localStorage: siblings saw
// and deleted each other's pictures, and a picture could not be opened again.
const DB_NAME = 'lumilearn-album', STORE = 'pictures'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' }).createIndex('profile', 'profile')
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function albumTx(mode, fn) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    const out = fn(tx.objectStore(STORE))
    tx.oncomplete = () => { db.close(); resolve(out?.result ?? out) }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

const albumList   = profile => albumTx('readonly', s => s.index('profile').getAll(profile))
  .then(list => list.sort((a, b) => b.id - a.id))
const albumPut    = entry => albumTx('readwrite', s => s.put(entry))
const albumDelete = ids => albumTx('readwrite', s => ids.forEach(id => s.delete(id)))

const toBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q))

// The old global thumbnails go to whoever opens the album first — better
// than losing them.
async function migrateOldGallery(profile) {
  let old
  try { old = JSON.parse(localStorage.getItem('lumilearn_gallery') || 'null') } catch { old = null }
  if (!Array.isArray(old)) return
  for (const g of old) {
    const picture = await (await fetch(g.data)).blob()
    await albumPut({ id: g.id, profile, imgId: null, picture, paint: null })
  }
  localStorage.removeItem('lumilearn_gallery')
}

// ── Flood fill ────────────────────────────────────────────────────────────────
// A fill stops at the dark lines of the sheet and at paint of another colour
// (on the empty sheet it fills what the child drew around). It then grows two
// pixels into the line: the grey edge pixels of a line used to stay white as
// a seam. Under the multiply blend the line stays black anyway.
function floodFill(paintCtx, base, sx, sy, rgb, W, H) {
  const paint = paintCtx.getImageData(0, 0, W, H)
  const bd = base.data, pd = paint.data
  const isLine = i => bd[i + 3] >= 128 && bd[i] + bd[i + 1] + bd[i + 2] < 600
  const s0 = (sy * W + sx) * 4
  if (isLine(s0)) return false
  const sr = pd[s0], sg = pd[s0 + 1], sb = pd[s0 + 2], sa = pd[s0 + 3]
  const same = i => Math.abs(pd[i] - sr) + Math.abs(pd[i + 1] - sg) + Math.abs(pd[i + 2] - sb) + Math.abs(pd[i + 3] - sa) < 90

  const mask = new Uint8Array(W * H)
  const stack = new Int32Array(W * H)
  let top = 0
  stack[top++] = sy * W + sx
  mask[sy * W + sx] = 1
  while (top) {
    const p = stack[--top]
    const x = p % W, y = (p - x) / W
    const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1]
    for (const n of nb) {
      if (n < 0 || mask[n]) continue
      const i = n * 4
      if (isLine(i) || !same(i)) continue
      mask[n] = 1
      stack[top++] = n
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    const grow = mask.slice()
    for (let p = 0; p < W * H; p++) {
      if (!mask[p]) continue
      const x = p % W
      if (x > 0) grow[p - 1] = 1
      if (x < W - 1) grow[p + 1] = 1
      if (p >= W) grow[p - W] = 1
      if (p < W * (H - 1)) grow[p + W] = 1
    }
    mask.set(grow)
  }
  for (let p = 0; p < W * H; p++) {
    if (!mask[p]) continue
    const i = p * 4
    pd[i] = rgb.r; pd[i + 1] = rgb.g; pd[i + 2] = rgb.b; pd[i + 3] = 255
  }
  paintCtx.putImageData(paint, 0, 0)
  return true
}

function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) }
}

// ── Composite: draw base image + paint layer onto display canvas ──────────────
function composite(displayCtx, baseImg, paintCanvas, W, H) {
  displayCtx.globalCompositeOperation = 'source-over'
  displayCtx.fillStyle = '#ffffff'
  displayCtx.fillRect(0, 0, W, H)
  displayCtx.drawImage(baseImg, 0, 0, W, H)
  // Paint layer with multiply blend so lines stay visible
  displayCtx.globalCompositeOperation = 'multiply'
  displayCtx.drawImage(paintCanvas, 0, 0, W, H)
  displayCtx.globalCompositeOperation = 'source-over'
}

// What Lumi sees in the picture: the one or two colours used most.
function colourComment(paintCanvas) {
  const { width: W, height: H } = paintCanvas
  if (!W || !H) return ''
  const d = paintCanvas.getContext('2d').getImageData(0, 0, W, H).data
  const counts = new Map()
  let n = 0
  for (let i = 0; i < d.length; i += 4 * 16) {
    if (d[i + 3] < 200) continue
    let best = null, bestD = Infinity
    for (const c of COLORS) {
      const { r, g, b } = hexToRgb(c.value)
      const dist = (d[i] - r) ** 2 + (d[i + 1] - g) ** 2 + (d[i + 2] - b) ** 2
      if (dist < bestD) { bestD = dist; best = c.name }
    }
    if (best === 'Weiß') continue
    counts.set(best, (counts.get(best) ?? 0) + 1)
    n++
  }
  const top = [...counts].sort((a, b) => b[1] - a[1]).filter(([, k]) => k / n > 0.12).slice(0, 2).map(([name]) => name)
  if (!top.length) return ''
  return top.length === 1 ? `Ich sehe ganz viel ${top[0]}!` : `Ich sehe ganz viel ${top[0]} und ${top[1]}!`
}

// A curved arrow back: "undo"
function UndoIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5 L3 10 L9 15" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 10 H14 a6 6 0 0 1 0 12 H10" fill="none" stroke={INK} strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  )
}

// Wide and not tall (a tablet held sideways, a desktop window)
function useWide() {
  const query = '(min-width: 900px) and (min-aspect-ratio: 5/4)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setWide(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return wide
}

const toolBtn = active => ({
  ...pxButton(active ? 'gold' : 'parch'),
  minWidth: 56, minHeight: 52, padding: '3px 6px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
  fontFamily: 'var(--font-heading)', fontSize: 13, lineHeight: 1.1,
})

const actionBtn = (color, enabled = true) => ({
  ...pxButton(color),
  // ink text: white on the pixel green/red is too weak (2.2:1, 2.8:1)
  color: INK, textShadow: 'none',
  minHeight: 46, padding: '4px 12px',
  fontSize: 15, opacity: enabled ? 1 : 0.55, cursor: enabled ? 'pointer' : 'default',
})

export default function ColoringGame({ onComplete }) {
  const { state } = useApp()
  const profile = state.activeProfileId ?? 'default'
  const [imgIdx, setImgIdx]       = useState(0)
  const [color, setColor]         = useState(COLORS[0].value)
  const [brushIdx, setBrushIdx]   = useState(1)
  const [tool, setTool]           = useState('fill')
  const [stamp, setStamp]         = useState(STAMPS[0])
  const [ready, setReady]         = useState(false)
  const [filling, setFilling]     = useState(false)
  // "Fertig" used to hand out full marks without ever checking that anything
  // had been drawn at all.
  const [hasPainted, setHasPainted] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [album, setAlbum]         = useState([])
  const [albumOpen, setAlbumOpen] = useState(false)
  const [viewing, setViewing]     = useState(null)    // album entry shown big
  const [confirm, setConfirm]     = useState(null)    // 'clear' | 'empty' | 'full'
  const [note, setNote]           = useState(null)    // what Lumi just said, shown for a moment
  const [dispSize, setDispSize]   = useState({ w: 0, h: 0 })

  const displayRef  = useRef(null)
  const areaRef     = useRef(null)
  const paintRef    = useRef(document.createElement('canvas'))   // transparent colour strokes
  const basePixels  = useRef(null)                               // sheet pixels for the fill
  const baseImg     = useRef(null)
  const canvasSize  = useRef({ w: 1000, h: 1164 })
  const undoStack   = useRef([])
  const pointerId   = useRef(null)
  const lastPos     = useRef(null)
  // Switching pictures used to wipe the one being painted. Each picture now
  // keeps its paint while the game is open; `albumId` is the album entry it
  // came from or was saved as, so saving again replaces it.
  const sheets      = useRef(new Map())                          // imgId -> { data, albumId, painted }
  const albumIdRef  = useRef(null)
  const pendingPaint = useRef(null)                              // album paint to load onto the next sheet
  const noteTimer   = useRef(null)

  const currentImage = IMAGES[imgIdx]
  const brushR = BRUSHES[brushIdx].r
  const wide = useWide()

  const say = useCallback((text, { show = false } = {}) => {
    narrate([{ text }])
    if (show) {
      setNote(text)
      clearTimeout(noteTimer.current)
      noteTimer.current = setTimeout(() => setNote(null), 3200)
    }
  }, [])

  useEffect(() => {
    const id = setTimeout(() => say('Such dir ein Bild aus und mal los!'), 400)
    return () => { clearTimeout(id); clearTimeout(noteTimer.current) }
  }, [say])

  const refreshAlbum = useCallback(() => albumList(profile).then(setAlbum).catch(() => setAlbum([])), [profile])
  useEffect(() => { migrateOldGallery(profile).catch(() => {}).finally(refreshAlbum) }, [profile, refreshAlbum])

  // object URLs for the album pictures
  const urls = useMemo(() => new Map(album.map(e => [e.id, URL.createObjectURL(e.picture)])), [album])
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls])

  const redraw = useCallback(() => {
    const dc = displayRef.current
    if (!dc || !baseImg.current) return
    const { w, h } = canvasSize.current
    composite(dc.getContext('2d'), baseImg.current, paintRef.current, w, h)
  }, [])

  // Load the sheet → set up canvases → draw
  useEffect(() => {
    let cancelled = false
    setReady(false)
    const setup = (img, W, H) => {
      if (cancelled) return
      canvasSize.current = { w: W, h: H }
      baseImg.current = img
      const tmp = document.createElement('canvas')
      tmp.width = W; tmp.height = H
      const tctx = tmp.getContext('2d')
      tctx.fillStyle = '#ffffff'; tctx.fillRect(0, 0, W, H)
      tctx.drawImage(img, 0, 0, W, H)
      basePixels.current = tctx.getImageData(0, 0, W, H)
      const pc = paintRef.current
      pc.width = W; pc.height = H
      const pctx = pc.getContext('2d')
      pctx.clearRect(0, 0, W, H)
      const kept = sheets.current.get(currentImage.id)
      if (kept?.data) pctx.putImageData(kept.data, 0, 0)
      albumIdRef.current = kept?.albumId ?? null
      setHasPainted(!!kept?.painted)
      undoStack.current = []; setUndoCount(0)
      const dc = displayRef.current
      if (dc) { dc.width = W; dc.height = H }
      const pending = pendingPaint.current
      pendingPaint.current = null
      if (pending) {
        createImageBitmap(pending.paint).then(bmp => {
          if (cancelled) return
          pctx.clearRect(0, 0, W, H)
          pctx.drawImage(bmp, 0, 0, W, H)
          albumIdRef.current = pending.id
          setHasPainted(true)
          redraw()
        }).catch(() => {})
      }
      redraw()
      setReady(true)
    }
    if (currentImage.free) {
      // No outline to load — just a white sheet the child owns entirely.
      const blank = document.createElement('canvas')
      blank.width = 1000; blank.height = 1164
      const bctx = blank.getContext('2d')
      bctx.fillStyle = '#ffffff'
      bctx.fillRect(0, 0, 1000, 1164)
      setup(blank, 1000, 1164)
    } else {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => setup(img, img.naturalWidth, img.naturalHeight)
      img.src = currentImage.src
    }
    return () => { cancelled = true }
  }, [currentImage, redraw])

  // Fit the canvas into the free space, whatever is left above the tools
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const fit = () => {
      const { w, h } = canvasSize.current
      const aw = el.clientWidth - 16, ah = el.clientHeight - 20
      if (aw <= 0 || ah <= 0) return
      const k = Math.min(aw / w, ah / h)
      setDispSize({ w: Math.floor(w * k), h: Math.floor(h * k) })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready])

  const keepSheet = useCallback(() => {
    const pc = paintRef.current
    if (!pc.width) return
    sheets.current.set(currentImage.id, {
      data: pc.getContext('2d').getImageData(0, 0, pc.width, pc.height),
      albumId: albumIdRef.current, painted: hasPainted,
    })
  }, [currentImage, hasPainted])

  const goToImage = (idx) => {
    if (idx === imgIdx) return
    keepSheet()
    say(IMAGES[idx].label)
    setImgIdx(idx)
  }

  // Coords: map CSS pixels on display canvas → image pixels
  const getPos = (e) => {
    const dc = displayRef.current
    const rect = dc.getBoundingClientRect()
    const { w, h } = canvasSize.current
    return {
      x: Math.max(0, Math.min(w - 1, Math.round((e.clientX - rect.left) * w / rect.width))),
      y: Math.max(0, Math.min(h - 1, Math.round((e.clientY - rect.top) * h / rect.height))),
    }
  }

  // Every step can be taken back: a copy of the paint before it
  const snapshot = () => {
    const pc = paintRef.current
    undoStack.current.push(pc.getContext('2d').getImageData(0, 0, pc.width, pc.height))
    if (undoStack.current.length > UNDO_MAX) undoStack.current.shift()
    setUndoCount(undoStack.current.length)
  }

  const undo = () => {
    const prev = undoStack.current.pop()
    if (!prev) return
    paintRef.current.getContext('2d').putImageData(prev, 0, 0)
    setUndoCount(undoStack.current.length)
    let painted = false
    for (let i = 3; i < prev.data.length && !painted; i += 64) painted = prev.data[i] > 0
    setHasPainted(painted)
    sfx.flip?.()
    redraw()
  }

  const stroke = (from, to) => {
    const ctx = paintRef.current.getContext('2d')
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.strokeStyle = ctx.fillStyle = tool === 'eraser' ? 'rgba(0,0,0,1)' : color
    ctx.lineWidth = brushR * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    ctx.beginPath(); ctx.arc(to.x, to.y, brushR, 0, Math.PI * 2); ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    redraw()
  }

  // Pointer events: one finger paints; a second one (a resting hand) is ignored.
  const handleDown = (e) => {
    if (!ready || pointerId.current !== null) return
    e.preventDefault()
    const pos = getPos(e)

    if (tool === 'stamp') {
      snapshot()
      const ctx = paintRef.current.getContext('2d')
      ctx.font = `${STAMP_SIZE}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(stamp, pos.x, pos.y)
      setHasPainted(true)
      redraw()
      return
    }

    if (tool === 'fill') {
      if (!basePixels.current) return
      setFilling(true)
      setTimeout(() => {
        const { w, h } = canvasSize.current
        const ctx = paintRef.current.getContext('2d')
        const before = ctx.getImageData(0, 0, w, h)
        if (floodFill(ctx, basePixels.current, pos.x, pos.y, hexToRgb(color), w, h)) {
          undoStack.current.push(before)
          if (undoStack.current.length > UNDO_MAX) undoStack.current.shift()
          setUndoCount(undoStack.current.length)
          setHasPainted(true)
          redraw()
        }
        setFilling(false)
      }, 10)
      return
    }

    snapshot()
    pointerId.current = e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    lastPos.current = pos
    stroke(pos, pos)
    setHasPainted(true)
  }

  const handleMove = (e) => {
    if (e.pointerId !== pointerId.current || !lastPos.current) return
    const pos = getPos(e)
    stroke(lastPos.current, pos)
    lastPos.current = pos
  }

  const handleUp = (e) => {
    if (e.pointerId !== pointerId.current) return
    pointerId.current = null
    lastPos.current = null
  }

  const clearPaint = () => {
    snapshot()
    const pc = paintRef.current
    pc.getContext('2d').clearRect(0, 0, pc.width, pc.height)
    setHasPainted(false)
    redraw()
  }

  // Saves the picture in the album of this profile (again: replaces it)
  // A full album asks first whether the oldest picture may make room;
  // `ask: false` (from "Fertig") then simply does not save.
  const saveToAlbum = useCallback(async ({ makeRoom = false, ask = true } = {}) => {
    const dc = displayRef.current
    if (!dc) return false
    const replacing = albumIdRef.current && album.some(e => e.id === albumIdRef.current)
    if (!replacing && album.length >= ALBUM_MAX && !makeRoom) { if (ask) setConfirm('full'); return false }
    try {
      if (!replacing && album.length >= ALBUM_MAX) await albumDelete(album.slice(ALBUM_MAX - 1).map(e => e.id))
      const [picture, paint] = await Promise.all([toBlob(dc, 'image/jpeg', 0.88), toBlob(paintRef.current, 'image/png')])
      const id = replacing ? albumIdRef.current : Date.now()
      await albumPut({ id, profile, imgId: currentImage.id, picture, paint })
      albumIdRef.current = id
      await refreshAlbum()
      return true
    } catch {
      say('Das Bild passt leider nicht mehr ins Album.', { show: true })
      return false
    }
  }, [album, profile, currentImage, refreshAlbum, say])

  const keep = async (opts) => {
    if (!hasPainted) return
    if (await saveToAlbum(opts)) {
      sfx.correct()
      say(`Dein Bild ist im Album! ${colourComment(paintRef.current)}`, { show: true })
    }
  }

  const finish = async () => {
    if (!hasPainted) { say('Mal zuerst etwas!'); return }
    const saved = await saveToAlbum({ ask: false })
    sfx.complete?.()
    // A free painting game: finishing is the achievement, there is nothing
    // to get wrong — one task, done.
    const text = `Fertig! Was für ein schönes Bild. ${colourComment(paintRef.current)}${saved ? ' Es ist jetzt in deinem Album.' : ''}`
    setNote(text)
    narrate([{ text }], { onEnd: () => onComplete?.(result(1, 1)) })
  }

  const continueFromAlbum = (entry) => {
    const idx = IMAGES.findIndex(i => i.id === entry.imgId)
    if (idx < 0 || !entry.paint) return
    keepSheet()
    sheets.current.delete(entry.imgId)
    pendingPaint.current = entry
    setViewing(null); setAlbumOpen(false)
    if (idx === imgIdx) {
      // same sheet: load the paint right away
      createImageBitmap(entry.paint).then(bmp => {
        snapshot()
        const pc = paintRef.current, ctx = pc.getContext('2d')
        ctx.clearRect(0, 0, pc.width, pc.height)
        ctx.drawImage(bmp, 0, 0, pc.width, pc.height)
        albumIdRef.current = entry.id
        pendingPaint.current = null
        setHasPainted(true)
        redraw()
      }).catch(() => {})
    } else setImgIdx(idx)
    say('Mal weiter!')
  }

  const chooseColor = (c) => {
    setColor(c.value)
    if (tool === 'eraser' || tool === 'stamp') setTool('brush')
    narrate([{ text: c.name }])
  }

  const chooseTool = (t) => {
    setTool(t.id)
    narrate([{ text: t.say }])
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0, background:'#FFF1D6', overflow:'hidden', userSelect:'none' }}>

      {/* Bild-Auswahl — every sheet is free to pick */}
      <div style={{ display:'flex', gap:6, padding:'6px 8px', overflowX:'auto', flexShrink:0, background:'var(--px-parch)', borderBottom:`3px solid ${INK}` }}>
        <button onClick={() => setAlbumOpen(true)} style={{ ...actionBtn('gold'), flexShrink:0, minHeight:44, whiteSpace:'nowrap' }}>
          🖼️ Album{album.length ? ` (${album.length})` : ''}
        </button>
        {IMAGES.map((img, i) => (
          <button key={img.id} onClick={() => goToImage(i)} aria-pressed={i === imgIdx} style={{
            ...pxCard(i === imgIdx ? 'selected' : undefined),
            flexShrink:0, minHeight:44, padding:'4px 12px', borderRadius:10,
            boxShadow: i === imgIdx ? `0 3px 0 ${INK}` : '0 3px 0 rgba(42,27,61,0.35)',
            cursor:'pointer', fontFamily:'var(--font-body)', fontSize:14,
            fontWeight: i === imgIdx ? 800 : 600, color: INK, whiteSpace:'nowrap',
          }}>{img.emoji} {img.label}</button>
        ))}
      </div>

      {/* Landscape screens put the tools beside the canvas instead of under it */}
      <div style={{ flex:1, minHeight:0, display:'flex', flexDirection: wide ? 'row' : 'column' }}>
      {/* Zeichenfläche — EIN Canvas, kein Mismatch möglich */}
      <div ref={areaRef} style={{ flex:1, minHeight:140, minWidth:0, overflow:'hidden', background:'var(--px-parch-dark)', display:'flex', alignItems:'center', justifyContent:'center', touchAction:'none', position:'relative' }}>
        <canvas
          ref={displayRef}
          style={{
            width: dispSize.w || undefined, height: dispSize.h || undefined,
            // ink frame as a shadow ring: getPos() maps via the bounding rect,
            // which a real border would shift
            borderRadius:4,
            boxShadow:`0 0 0 3px ${INK}, 0 6px 0 3px rgba(42,27,61,0.35)`,
            cursor: tool === 'fill' ? 'pointer' : 'crosshair',
            touchAction:'none',
            visibility: ready && dispSize.w ? 'visible' : 'hidden',
          }}
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
        {!ready && <div style={{ position:'absolute', fontSize:32 }}>⏳</div>}
        {filling && <div style={{ position:'absolute', fontSize:40, pointerEvents:'none' }}>🎨</div>}
        <AnimatePresence>
          {note && (
            <motion.div key="note" initial={{ y:-20, opacity:0 }} animate={{ y:0, opacity:1 }} exit={{ opacity:0 }}
              style={{ position:'absolute', top:8, left:8, right:8, display:'flex', alignItems:'center', gap:8, justifyContent:'center', pointerEvents:'none' }}>
              <LumiCharacter mood="excited" size={48} />
              <div style={{ ...pxBubble, padding:'8px 14px', fontFamily:'var(--font-heading)', fontSize:16, color:INK, maxWidth:420 }}>{note}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Toolbar — fixed rows, so the canvas never jumps when a tool changes */}
      <div style={{
        background:'var(--px-parch)', padding:'6px 8px 8px', flexShrink:0, display:'flex', flexDirection:'column', gap:6, alignItems:'center',
        ...(wide ? { width:380, borderLeft:`3px solid ${INK}`, justifyContent:'center', overflowY:'auto' } : { borderTop:`3px solid ${INK}` }),
      }}>
        {/* Werkzeuge + Rückgängig */}
        <div style={{ display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => chooseTool(t)} aria-pressed={tool === t.id} style={toolBtn(tool === t.id)}>
              <span style={{ fontSize:22, lineHeight:1 }}>{t.icon}</span>{t.label}
            </button>
          ))}
          <button onClick={undo} disabled={!undoCount} aria-label="Rückgängig" style={{ ...toolBtn(false), opacity: undoCount ? 1 : 0.45, cursor: undoCount ? 'pointer' : 'default' }}>
            <UndoIcon />Zurück
          </button>
        </div>

        {/* Stempel oder Pinselgröße — same row, same height */}
        <div style={{ display:'flex', minHeight:48, maxWidth:'100%', overflowX:'auto' }}>
          {/* auto margins centre the row, yet let it scroll from its start when too wide */}
          <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'center', margin:'0 auto', flexWrap: wide ? 'wrap' : 'nowrap' }}>
          {tool === 'stamp'
            ? STAMPS.map(st => (
                <button key={st} onClick={() => setStamp(st)} aria-pressed={stamp === st} style={{
                  width:46, height:46, flexShrink:0, fontSize:26, lineHeight:1, padding:0, borderRadius:10, cursor:'pointer',
                  border:`2px solid ${stamp === st ? INK : 'rgba(42,27,61,0.2)'}`,
                  background: stamp === st ? 'var(--px-gold)' : 'var(--px-parch-light)',
                }}>{st}</button>
              ))
            : BRUSHES.map((b, i) => {
                const on = brushIdx === i && tool !== 'fill'
                return (
                  <button key={b.id} onClick={() => setBrushIdx(i)} disabled={tool === 'fill'} aria-pressed={on} aria-label={`Pinsel ${b.label}`} style={{
                    minWidth:64, height:46, padding:'0 8px', borderRadius:10, cursor: tool === 'fill' ? 'default' : 'pointer',
                    display:'flex', alignItems:'center', gap:6,
                    border:`2px solid ${on ? INK : 'rgba(42,27,61,0.25)'}`,
                    background: on ? 'var(--px-gold)' : 'var(--px-parch-light)',
                    opacity: tool === 'fill' ? 0.45 : 1,
                    fontFamily:'var(--font-heading)', fontSize:14, color:INK,
                  }}>
                    <span style={{ width:b.dot, height:b.dot, borderRadius:'50%', flexShrink:0, background: tool === 'eraser' ? '#9E9E9E' : color, border:`2px solid ${INK}` }} />
                    {b.label}
                  </button>
                )
              })}
          </div>
        </div>

        {/* Farben */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'center', maxWidth:700 }}>
          {COLORS.map(c => {
            const on = color === c.value && tool !== 'eraser'
            return (
              <button key={c.value} onClick={() => chooseColor(c)} aria-label={c.name} aria-pressed={on} style={{
                width:44, height:44, minHeight:0, borderRadius:'50%', padding:0, background:c.value,
                border:`3px solid ${INK}`,
                outline: on ? '4px solid var(--px-gold)' : 'none',
                outlineOffset:1, cursor:'pointer', flexShrink:0,
                boxShadow:'0 2px 0 rgba(42,27,61,0.35)',
              }} />
            )
          })}
        </div>

        {/* Aktionen */}
        <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'center', flexWrap:'wrap' }}>
          <button onClick={() => hasPainted && setConfirm('clear')} disabled={!hasPainted} style={actionBtn('red', hasPainted)}>🗑️ Neu</button>
          <button onClick={() => keep()} disabled={!hasPainted} style={actionBtn('parch', hasPainted)}>💾 Aufheben</button>
          {onComplete && (
            <button onClick={finish} disabled={!hasPainted} title={hasPainted ? '' : 'Male zuerst etwas!'} style={actionBtn('green', hasPainted)}>✅ Fertig</button>
          )}
        </div>
      </div>
      </div>

      {/* Album */}
      {albumOpen && createPortal(
        <div className="px-backdrop" onClick={() => { setAlbumOpen(false); setViewing(null) }} style={{ zIndex: 2500 }}>
          <div className="px-panel" onClick={e => e.stopPropagation()} style={{
            width:'100%', maxWidth:760, maxHeight:'100%', display:'flex', flexDirection:'column', gap:10, padding:12, overflow:'hidden',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              <span style={{ flex:1, fontFamily:'var(--font-heading)', fontWeight:700, fontSize:22, color:INK }}>🖼️ Dein Album</span>
              {!viewing && album.length > 0 && (
                <button onClick={() => setConfirm('empty')} style={actionBtn('red')}>🗑️ Album leeren</button>
              )}
              <button onClick={() => { setAlbumOpen(false); setViewing(null) }} aria-label="Album schließen" style={{ ...actionBtn('parch'), minWidth:46 }}>❌</button>
            </div>
            {viewing ? (
              <>
                <img src={urls.get(viewing.id)} alt="Dein Bild"
                  style={{ flex:1, minHeight:0, maxWidth:'100%', objectFit:'contain', background:'#fff', border:`3px solid ${INK}`, borderRadius:8 }} />
                <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
                  <button onClick={() => setViewing(null)} style={actionBtn('parch')}><PxIcon name="back" size={16} /> Zurück</button>
                  {viewing.paint && IMAGES.some(i => i.id === viewing.imgId) && (
                    <button onClick={() => continueFromAlbum(viewing)} style={actionBtn('green')}>🖌️ Weitermalen</button>
                  )}
                </div>
              </>
            ) : album.length === 0 ? (
              <div style={{ fontFamily:'var(--font-body)', fontSize:16, color:INK, padding:20, textAlign:'center' }}>
                Noch keine Bilder. Mal etwas und tippe auf 💾 Aufheben!
              </div>
            ) : (
              <div style={{ overflowY:'auto', display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(110px, 1fr))', gap:10, padding:2 }}>
                {album.map(e => (
                  <button key={e.id} onClick={() => setViewing(e)} aria-label="Bild ansehen" style={{
                    padding:0, border:`3px solid ${INK}`, borderRadius:8, background:'#fff', cursor:'pointer', overflow:'hidden', aspectRatio:'1000 / 1164',
                  }}>
                    <img src={urls.get(e.id)} alt="" style={{ width:'100%', height:'100%', objectFit:'contain', display:'block' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}

      {confirm === 'clear' && (
        <ConfirmDialog kid danger title="Alles wegwischen?" say="Wirklich alles wegwischen?"
          yesLabel="Ja" noLabel="Nein"
          onNo={() => setConfirm(null)} onYes={() => { setConfirm(null); clearPaint() }} />
      )}
      {confirm === 'empty' && (
        <ConfirmDialog kid danger title="Album leeren?" say="Sollen wirklich alle Bilder aus dem Album weg?"
          yesLabel="Ja" noLabel="Nein"
          onNo={() => setConfirm(null)}
          onYes={async () => {
            setConfirm(null); setViewing(null)
            await albumDelete(album.map(e => e.id)).catch(() => {})
            albumIdRef.current = null
            refreshAlbum()
          }} />
      )}
      {confirm === 'full' && (
        <ConfirmDialog kid title="Das Album ist voll" say="Das Album ist voll. Soll das älteste Bild Platz machen?"
          text="Das älteste Bild kommt dann heraus." yesLabel="Ja" noLabel="Nein"
          onNo={() => setConfirm(null)} onYes={() => { setConfirm(null); keep({ makeRoom: true }) }} />
      )}
    </div>
  )
}
