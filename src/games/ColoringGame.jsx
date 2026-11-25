import { useState, useRef, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { useApp } from '../AppContext.jsx'
import { narrate } from '../narrator.js'
import { sfx } from '../sfx.js'
import { result } from '../lib/score.js'
import { LINES, line } from '../lib/lumiLines.js'
import { colorWord } from '../lib/words.js'
import { playAnimal } from '../lib/animalSounds.js'
import { emojiSrc } from '../lib/emojiArt.jsx'
import { pxButton, pxBubble, INK } from './px.js'
import { HintHand, Art, useBursts } from '../components/play/index.js'
import FinishWall from './coloring/FinishWall.jsx'
import PicturePanel from './coloring/PicturePanel.jsx'
import './coloring/coloring.css'

// The Mal-Atelier is a free painting tool, not a game with tasks: nothing is
// right or wrong, there are no levels and no stars (AppContext hasLevels).
// What makes it a joy is the toys: a rainbow brush, glitter that twinkles,
// stamps that land with a wobble and a sound, and "Fertig", which hangs the
// picture in a frame on the child's wall.

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'
// size of the coloring pages, and of the empty sheet
const SHEET_W = 1000, SHEET_H = 1500

const IMAGES = [
  // A completely empty sheet: somewhere to simply draw something of one's own.
  { id: 'blank', src: null, label: 'Kritzel-Leinwand', emoji: '🖍️', free: true },
  // Own pages with Lumi (scripts/generate-coloring-pages.py). The ids
  // changed with the redrawn 1000 x 1500 pages: a picture painted on the
  // first, differently shaped pages must not be continued on these.
  { id: 'lumi2-wald',      src: `${BASE}images/coloring/lumi-wald.png`,      label: 'Zauberwald',     emoji: '🍄' },
  { id: 'lumi2-bauernhof', src: `${BASE}images/coloring/lumi-bauernhof.png`, label: 'Bauernhof',      emoji: '🐮' },
  { id: 'lumi2-weltraum',  src: `${BASE}images/coloring/lumi-weltraum.png`,  label: 'Weltraum',       emoji: '🚀' },
  { id: 'lumi2-meer',      src: `${BASE}images/coloring/lumi-meer.png`,      label: 'Meer',           emoji: '🐠' },
  { id: 'lumi2-schloss',   src: `${BASE}images/coloring/lumi-schloss.png`,   label: 'Drachenschloss', emoji: '🏰' },
  { id: 'lumi2-garten',    src: `${BASE}images/coloring/lumi-garten.png`,    label: 'Garten',         emoji: '🌻' },
  { id: 'lumi2-strand',    src: `${BASE}images/coloring/lumi-strand.png`,    label: 'Strand',         emoji: '🏖️' },
  { id: 'lumi2-winter',    src: `${BASE}images/coloring/lumi-winter.png`,    label: 'Winter',         emoji: '⛄' },
]

// 14 colours a child can tell apart. Picking one, Lumi says its name
// (farbe/<name>; Rosa is not recorded yet and stays silent).
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

// three sizes in picture pixels (the sheets are 1000 px wide); a stamp
// comes in three sizes too, shown on the size buttons
const BRUSHES = [
  { id: 'thin',   r: 6,  label: 'dünn',   dot: 10, stamp: 80 },
  { id: 'medium', r: 14, label: 'mittel', dot: 18, stamp: 130 },
  { id: 'thick',  r: 28, label: 'dick',   dot: 28, stamp: 190 },
]

// Each stamp says its name when picked and makes its own little sound
// when it lands (the cat and the unicorn their animal's)
const STAMPS = [
  { e: '⭐', word: 'stern',         sound: () => sfx.sparkle() },
  { e: '❤️', word: 'herz',          sound: () => sfx.pop() },
  { e: '🌈', word: 'regenbogen',    sound: () => sfx.slideUp() },
  { e: '🌞', word: 'sonne',         sound: () => sfx.coin() },
  { e: '🌸', word: 'blume',         sound: () => sfx.pop() },
  { e: '🦋', word: 'schmetterling', sound: () => sfx.giggle() },
  { e: '🐱', word: 'katze',         sound: () => sfx.boing(), animal: true },
  { e: '🐟', word: 'fisch',         sound: () => sfx.splash() },
  { e: '🚀', word: 'rakete',        sound: () => sfx.whoosh() },
  { e: '🦄', word: 'einhorn',       sound: () => sfx.boing(), animal: true },
  { e: '⚡', word: 'blitz',         sound: () => sfx.drum(true) },
  { e: '☁️', word: 'wolke',         sound: () => sfx.whoosh() },
]
const STAMP_BY = Object.fromEntries(STAMPS.map(s => [s.e, s]))

const TOOLS = [
  { id: 'brush',   icon: '🖌️', label: 'Pinsel' },
  { id: 'rainbow', icon: '🖌️', label: 'Bunt',    rainbow: true, say: 'atelier/regenbogen' },
  { id: 'glitter', icon: '✨', label: 'Glitzer', say: 'atelier/glitzer' },
  { id: 'fill',    icon: '🪣', label: 'Eimer',   say: 'atelier/eimer' },
  { id: 'stamp',   icon: '⭐', label: 'Stempel' },
  { id: 'eraser',  icon: '🧽', label: 'Radierer' },
]
const RAINBOW_BG = 'conic-gradient(#E53935, #FB8C00, #FDD835, #43A047, #1E88E5, #8E24AA, #E53935)'

// Sentences for the Mal-Atelier that are not recorded yet. Until they are in
// lib/lumiLines.js under the same key the narrator skips them: only Lumi's
// recorded voice is heard.
const ATELIER = {
  'atelier/los':         'Such dir eine Farbe aus und mal los!',
  'atelier/eimer':       'Der Farbeimer. Tippe in eine Fläche.',
  'atelier/regenbogen':  'Der Regenbogen-Pinsel! Er malt in allen Farben.',
  'atelier/glitzer':     'Glitzer! Das funkelt.',
  'atelier/an-der-wand': 'Dein Bild hängt jetzt an der Wand!',
  'atelier/wegwischen':  'Alles wegwischen?',
  'atelier/wand-voll':   'Die Wand ist voll. Soll das älteste Bild Platz machen?',
}
const lumi = key => (LINES[key] ? line(key) : { text: ATELIER[key] })
const word = w => (LINES[`wort/${w}`] ? line(`wort/${w}`) : null)
// "Fertig": praise once, with words that fit a picture
const PRAISE = ['rueckmeldung/richtig-1', 'rueckmeldung/richtig-4', 'rueckmeldung/richtig-5']

const UNDO_MAX = 10
const TWINKLE_MAX = 90              // twinkling sparkles per sheet
const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
// Every fifth fill a little visitor crawls or flies across the sheet
const VISITORS = ['🐞', '🦋', '🐌', '🐝']
const ALBUM_MAX = 30
const NO_MARKS = { stamps: [], twinkles: [] }

// ── Album (the wall): one per profile, full size, in IndexedDB ───────────────
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
// a colour mixed with white: the glitter's soft ground
const pastel = (hex, k = 0.45) => {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${Math.round(r + (255 - r) * k)}, ${Math.round(g + (255 - g) * k)}, ${Math.round(b + (255 - b) * k)})`
}

// A four-pointed sparkle
function sparkle(ctx, x, y, r, fill) {
  const t = r * 0.28
  ctx.fillStyle = fill
  ctx.beginPath()
  ctx.moveTo(x, y - r); ctx.lineTo(x + t, y - t); ctx.lineTo(x + r, y); ctx.lineTo(x + t, y + t)
  ctx.lineTo(x, y + r); ctx.lineTo(x - t, y + t); ctx.lineTo(x - r, y); ctx.lineTo(x - t, y - t)
  ctx.closePath(); ctx.fill()
}

// A stamp, as the picture on its button (the system's emoji used to land
// instead of the picture chosen)
function drawStamp(ctx, st, imgs) {
  const img = imgs.get(st.e)
  if (img?.complete && img.naturalWidth) ctx.drawImage(img, st.x - st.size / 2, st.y - st.size / 2, st.size, st.size)
  else {
    ctx.font = `${st.size * 0.8}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(st.e, st.x, st.y)
  }
}

// ── Composite: the sheet, the paint, the stamps ───────────────────────────────
// The paint is multiplied onto the sheet so its lines stay visible. The
// stamps lie on top like stickers: multiplied too, the sheet's lines showed
// through them.
function composite(displayCtx, baseImg, paintCanvas, W, H, stamps, imgs) {
  displayCtx.globalCompositeOperation = 'source-over'
  displayCtx.fillStyle = '#ffffff'
  displayCtx.fillRect(0, 0, W, H)
  displayCtx.drawImage(baseImg, 0, 0, W, H)
  displayCtx.globalCompositeOperation = 'multiply'
  displayCtx.drawImage(paintCanvas, 0, 0, W, H)
  displayCtx.globalCompositeOperation = 'source-over'
  for (const st of stamps) drawStamp(displayCtx, st, imgs)
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

// Button and swatch sizes for the room there is. Wide (a tablet or phone
// held sideways, a desktop): tools left of the sheet, colours right of it.
// Upright: everything under the sheet, as large as the width allows.
function uiSizes({ w, h }, wide) {
  if (wide) {
    return h >= 560
      ? { tool: 72, toolH: 66, dot: 56, gap: 6, size: 52, act: 56, font: 13, icon: 28 }
      : { tool: 54, toolH: 50, dot: 44, gap: 5, size: 40, act: 46, font: 11, icon: 22 }
  }
  const avail = Math.max(300, w - 16)
  const tool = Math.max(48, Math.min(76, Math.floor((avail - 5 * 5) / 6)))
  const dot = Math.max(40, Math.min(60, Math.floor((avail - 6 * 5) / 7)))
  const big = tool >= 64 && h >= 900
  return { tool, toolH: big ? 66 : 52, dot, gap: 5, size: big ? 52 : 44, act: big ? 56 : 46, font: big ? 13 : 11, icon: big ? 28 : 22 }
}

const actionBtn = (color, size, enabled = true) => ({
  ...pxButton(color),
  // ink text: white on the pixel green/red is too weak (2.2:1, 2.8:1)
  color: INK, textShadow: 'none',
  minHeight: size, minWidth: size, padding: '2px 8px',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4,
  fontSize: 16, opacity: enabled ? 1 : 0.5, cursor: enabled ? 'pointer' : 'default',
})

export default function ColoringGame({ onComplete }) {
  const { state } = useApp()
  const profile = state.activeProfileId ?? 'default'
  // a picture to fill first: on the empty sheet the first tap of the paint
  // bucket flooded everything
  const [imgIdx, setImgIdx]       = useState(1)
  const [color, setColor]         = useState(COLORS[0].value)
  const [brushIdx, setBrushIdx]   = useState(1)
  const [tool, setTool]           = useState('fill')
  const [stamp, setStamp]         = useState(STAMPS[0].e)
  const [ready, setReady]         = useState(false)
  const [filling, setFilling]     = useState(false)
  const [hasPainted, setHasPainted] = useState(false)
  const [undoCount, setUndoCount] = useState(0)
  const [album, setAlbum]         = useState([])
  const [panelOpen, setPanelOpen] = useState(false)
  const [confirm, setConfirm]     = useState(null)    // 'clear' | 'empty' | 'full'
  const [note, setNote]           = useState(null)    // what Lumi just said, shown for a moment
  const [dispSize, setDispSize]   = useState({ w: 0, h: 0 })
  const [box, setBox]             = useState({ w: 0, h: 0 })
  const [visitor, setVisitor]     = useState(null)    // { art, y, n } crossing the sheet
  const [landing, setLanding]     = useState([])      // stamps in the air
  const [marks, setMarks]         = useState(NO_MARKS) // the stamps and twinkles on this sheet
  const [hanging, setHanging]     = useState(null)    // "Fertig": the picture on the wall
  const [bursts, burst]           = useBursts()

  const rootRef     = useRef(null)
  const displayRef  = useRef(null)
  const areaRef     = useRef(null)
  const paintRef    = useRef(document.createElement('canvas'))   // transparent colour strokes
  const basePixels  = useRef(null)                               // sheet pixels for the fill
  const baseImg     = useRef(null)
  const canvasSize  = useRef({ w: SHEET_W, h: SHEET_H })
  const undoStack   = useRef([])                                 // [{ data, marks }]
  const pointerId   = useRef(null)
  const lastPos     = useRef(null)
  const travel      = useRef(0)                                  // how far this stroke went (rainbow, glitter)
  const hue0        = useRef(0)
  const sparkGap    = useRef(0)                                  // glitter: way since the last sparkles
  // Each picture keeps its paint while the game is open; `albumId` is the
  // album entry it came from or was saved as, so saving again replaces it.
  const sheets      = useRef(new Map())                          // imgId -> { data, albumId, painted, marks }
  const albumIdRef  = useRef(null)
  const pendingPaint = useRef(null)                              // album entry to load onto the next sheet
  const noteTimer   = useRef(null)
  const fills       = useRef(0)                                  // fills so far (a visitor every fifth)
  const finished    = useRef(false)                              // "Fertig" was tapped: once only
  const timers      = useRef([])
  const marksRef    = useRef(NO_MARKS)
  const landingRef  = useRef([])
  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const currentImage = IMAGES[imgIdx]
  const brush = BRUSHES[brushIdx]
  const wide = box.w > box.h
  const ui = uiSizes(box, wide)

  const setMarksBoth = useCallback(m => { marksRef.current = m; setMarks(m) }, [])

  // the stamp pictures, for the sheet
  const stampImgs = useMemo(() => new Map(STAMPS.map(s => {
    const img = new Image()
    img.src = emojiSrc(s.e)
    return [s.e, img]
  })), [])

  // A word from Lumi on screen, for a moment (only when the wall is full of
  // trouble: the browser refused to store the picture)
  const showNote = useCallback(text => {
    setNote(text)
    clearTimeout(noteTimer.current)
    noteTimer.current = setTimeout(() => setNote(null), 3200)
  }, [])

  useEffect(() => {
    const id = setTimeout(() => narrate([lumi('atelier/los')]), 400)
    return () => { clearTimeout(id); clearTimeout(noteTimer.current) }
  }, [])

  const refreshAlbum = useCallback(() => albumList(profile).then(setAlbum).catch(() => setAlbum([])), [profile])
  useEffect(() => { migrateOldGallery(profile).catch(() => {}).finally(refreshAlbum) }, [profile, refreshAlbum])

  // object URLs for the album pictures
  const urls = useMemo(() => new Map(album.map(e => [e.id, URL.createObjectURL(e.picture)])), [album])
  useEffect(() => () => urls.forEach(u => URL.revokeObjectURL(u)), [urls])

  // The room the game has: wide or upright
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!el) return
    const measure = () => setBox(b => (b.w === el.clientWidth && b.h === el.clientHeight ? b : { w: el.clientWidth, h: el.clientHeight }))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const redraw = useCallback(() => {
    const dc = displayRef.current
    if (!dc || !baseImg.current) return
    const { w, h } = canvasSize.current
    composite(dc.getContext('2d'), baseImg.current, paintRef.current, w, h, marksRef.current.stamps, stampImgs)
  }, [stampImgs])
  // a picture continued from the wall may show its stamps before their pictures are loaded
  useEffect(() => { stampImgs.forEach(img => { img.onload = redraw }) }, [stampImgs, redraw])

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
      setMarksBoth(kept?.marks ?? NO_MARKS)
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
          setMarksBoth(pending.marks ?? NO_MARKS)
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
      blank.width = SHEET_W; blank.height = SHEET_H
      const bctx = blank.getContext('2d')
      bctx.fillStyle = '#ffffff'
      bctx.fillRect(0, 0, SHEET_W, SHEET_H)
      setup(blank, SHEET_W, SHEET_H)
    } else {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => setup(img, img.naturalWidth, img.naturalHeight)
      img.src = currentImage.src
    }
    return () => { cancelled = true }
  }, [currentImage, redraw, setMarksBoth])

  // Fit the sheet into the room left beside or above the tools
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    const fit = () => {
      const { w, h } = canvasSize.current
      const aw = el.clientWidth - 16, ah = el.clientHeight - 18
      if (aw <= 0 || ah <= 0) return
      const k = Math.min(aw / w, ah / h)
      setDispSize(d => {
        const n = { w: Math.floor(w * k), h: Math.floor(h * k) }
        return d.w === n.w && d.h === n.h ? d : n
      })
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ready, wide])

  // ── Stamps: they land with a wobble, then go onto the sheet ────────────────
  const commitStamp = useCallback(id => {
    const st = landingRef.current.find(s => s.id === id)
    if (!st) return
    landingRef.current = landingRef.current.filter(s => s.id !== id)
    setLanding(landingRef.current)
    setMarksBoth({ ...marksRef.current, stamps: [...marksRef.current.stamps, { e: st.e, x: st.x, y: st.y, size: st.size }] })
    redraw()
  }, [redraw, setMarksBoth])

  // Before anything else changes the sheet, the stamps in the air land at once
  const flushStamps = useCallback(() => {
    landingRef.current.slice().forEach(st => commitStamp(st.id))
  }, [commitStamp])

  const keepSheet = useCallback(() => {
    flushStamps()
    const pc = paintRef.current
    if (!pc.width) return
    sheets.current.set(currentImage.id, {
      data: pc.getContext('2d').getImageData(0, 0, pc.width, pc.height),
      albumId: albumIdRef.current, painted: hasPainted, marks: marksRef.current,
    })
  }, [currentImage, hasPainted, flushStamps])

  const goToImage = (idx) => {
    setPanelOpen(false)
    if (idx === imgIdx) return
    keepSheet()
    // on the empty sheet the bucket would flood the whole page: draw instead
    if (IMAGES[idx].free && tool === 'fill') setTool('brush')
    sfx.flip?.()
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

  // Every step can be taken back: a copy of the paint, and of the stamps and
  // twinkles, before it
  const snapshot = (data) => {
    const pc = paintRef.current
    undoStack.current.push({ data: data ?? pc.getContext('2d').getImageData(0, 0, pc.width, pc.height), marks: marksRef.current })
    if (undoStack.current.length > UNDO_MAX) undoStack.current.shift()
    setUndoCount(undoStack.current.length)
  }

  const undo = () => {
    flushStamps()
    const prev = undoStack.current.pop()
    if (!prev) return
    paintRef.current.getContext('2d').putImageData(prev.data, 0, 0)
    setMarksBoth(prev.marks)
    setUndoCount(undoStack.current.length)
    let painted = prev.marks.stamps.length > 0
    for (let i = 3; i < prev.data.data.length && !painted; i += 64) painted = prev.data.data[i] > 0
    setHasPainted(painted)
    sfx.flip?.()
    redraw()
  }

  // One piece of a stroke, in the tool's way
  const stroke = (from, to) => {
    const ctx = paintRef.current.getContext('2d')
    const r = brush.r
    const seg = Math.hypot(to.x - from.x, to.y - from.y)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    const line2 = (style, width) => {
      ctx.strokeStyle = ctx.fillStyle = style
      ctx.lineWidth = width
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(to.x, to.y, width / 2, 0, Math.PI * 2); ctx.fill()
    }
    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      line2('rgba(0,0,0,1)', r * 2)
      ctx.globalCompositeOperation = 'source-over'
      // a stamp the eraser touches comes off whole, like a sticker;
      // glitter it passes over stops twinkling
      const m = marksRef.current
      const stamps = m.stamps.filter(st => Math.hypot(st.x - to.x, st.y - to.y) > st.size * 0.4 + r)
      const twinkles = m.twinkles.filter(t => Math.hypot(t.x - to.x, t.y - to.y) > r + t.s * 0.3)
      if (stamps.length < m.stamps.length) sfx.pop()
      if (stamps.length < m.stamps.length || twinkles.length < m.twinkles.length) setMarksBoth({ stamps, twinkles })
    } else if (tool === 'rainbow') {
      // the colour runs through the rainbow along the stroke
      line2(`hsl(${Math.round(hue0.current + travel.current * 0.55) % 360}, 88%, 54%)`, r * 2)
    } else if (tool === 'glitter') {
      // a soft ground in the colour, strewn with sparkles; some of them
      // keep twinkling over the sheet
      line2(pastel(color), r * 2)
      // a pair of sparkles every `step` picture pixels along the stroke
      const step = Math.max(8, r * 0.9)
      const at = []
      if (!seg) at.push(0)
      for (let d = step - sparkGap.current; d <= seg; d += step) at.push(d / seg)
      sparkGap.current = seg ? (sparkGap.current + seg) % step : 0
      const add = []
      for (const f of at) {
        const cx = from.x + (to.x - from.x) * f
        const cy = from.y + (to.y - from.y) * f
        for (let n = 0; n < 2; n++) {
          const a = Math.random() * Math.PI * 2, d = Math.random() * r * 1.1
          const x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d
          const fill = ['#ffffff', '#FFE082', color, '#ffffff'][Math.floor(Math.random() * 4)]
          sparkle(ctx, x, y, Math.max(3, r * (0.3 + Math.random() * 0.35)), fill)
          if (Math.random() < 0.35) add.push({ x, y, s: Math.max(26, r * 2.4), d: +(Math.random() * 1.6).toFixed(2), t: +(1.1 + Math.random() * 1.1).toFixed(2) })
        }
      }
      if (add.length) {
        const m = marksRef.current
        setMarksBoth({ ...m, twinkles: [...m.twinkles, ...add].slice(-TWINKLE_MAX) })
      }
    } else {
      line2(color, r * 2)
    }
    travel.current += seg
    redraw()
  }

  const throwStamp = (pos, at) => {
    flushStamps()
    snapshot()
    const st = { id: Math.random(), e: stamp, x: pos.x, y: pos.y, size: brush.stamp }
    landingRef.current = [...landingRef.current, st]
    setLanding(landingRef.current)
    setHasPainted(true)
    const def = STAMP_BY[stamp]
    if (!(def?.animal && playAnimal(stamp, { volume: 0.6 }))) def?.sound()
    if (stamp === '⭐' || stamp === '🌈') burst(at, 'stars', 6)
    if (reduceMotion()) commitStamp(st.id)
  }

  // Pointer events: one finger paints; a second one (a resting hand) is ignored.
  const handleDown = (e) => {
    if (!ready || pointerId.current !== null || hanging) return
    e.preventDefault()
    const pos = getPos(e)

    if (tool === 'stamp') { throwStamp(pos, { x: e.clientX, y: e.clientY }); return }

    if (tool === 'fill') {
      if (!basePixels.current) return
      flushStamps()
      setFilling(true)
      setTimeout(() => {
        const { w, h } = canvasSize.current
        const ctx = paintRef.current.getContext('2d')
        const before = ctx.getImageData(0, 0, w, h)
        if (floodFill(ctx, basePixels.current, pos.x, pos.y, hexToRgb(color), w, h)) {
          snapshot(before)
          setHasPainted(true)
          sfx.pop()
          redraw()
          if (++fills.current % 5 === 0) setVisitor({ art: VISITORS[(fills.current / 5 - 1) % VISITORS.length], y: 0.2 + Math.random() * 0.6, n: fills.current })
        }
        setFilling(false)
      }, 10)
      return
    }

    flushStamps()
    snapshot()
    pointerId.current = e.pointerId
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* not supported */ }
    lastPos.current = pos
    travel.current = 0
    sparkGap.current = 0
    hue0.current = Math.floor(Math.random() * 360)
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
    flushStamps()
    snapshot()
    const pc = paintRef.current
    pc.getContext('2d').clearRect(0, 0, pc.width, pc.height)
    setMarksBoth(NO_MARKS)
    setHasPainted(false)
    sfx.whoosh()
    redraw()
  }

  // Saves the picture on the wall of this profile (again: replaces it).
  // With a full wall the oldest picture makes room, once the child said so.
  const saveToAlbum = useCallback(async ({ makeRoom = false } = {}) => {
    const dc = displayRef.current
    if (!dc) return false
    const replacing = albumIdRef.current && album.some(e => e.id === albumIdRef.current)
    try {
      if (!replacing && album.length >= ALBUM_MAX && makeRoom) await albumDelete(album.slice(ALBUM_MAX - 1).map(e => e.id))
      const [picture, paint] = await Promise.all([toBlob(dc, 'image/jpeg', 0.88), toBlob(paintRef.current, 'image/png')])
      const id = replacing ? albumIdRef.current : Date.now()
      await albumPut({ id, profile, imgId: currentImage.id, picture, paint, marks: marksRef.current })
      albumIdRef.current = id
      await refreshAlbum()
      return true
    } catch {
      showNote('Das Bild passt leider nicht mehr an die Wand.')
      return false
    }
  }, [album, profile, currentImage, refreshAlbum, showNote])

  // "Fertig": the picture flies onto the wall, a frame closes around it,
  // Lumi claps and praises it once, confetti. Then back home: there are no
  // levels and no stars here (AppContext hasLevels), the child made a picture.
  const finish = async ({ makeRoom = false } = {}) => {
    if (!hasPainted || finished.current) return
    flushStamps()
    const replacing = albumIdRef.current && album.some(e => e.id === albumIdRef.current)
    if (!replacing && album.length >= ALBUM_MAX && !makeRoom) {
      setConfirm('full')
      return
    }
    finished.current = true
    const dc = displayRef.current
    const { w, h } = canvasSize.current
    setHanging({
      picture: dc.toDataURL('image/jpeg', 0.9),
      from: dc.getBoundingClientRect(),
      sheet: { w, h },
      stamps: marksRef.current.stamps,
      earlier: album.filter(e => e.id !== albumIdRef.current).slice(0, 4).map(e => urls.get(e.id)).filter(Boolean),
    })
    saveToAlbum({ makeRoom })
    const at = (ms, fn) => timers.current.push(setTimeout(fn, ms))
    sfx.whoosh()
    at(650, () => sfx.drum())                              // the frame closes
    at(850, () => sfx.tada())
    at(950, () => narrate([line(PRAISE[Math.floor(Math.random() * PRAISE.length)]), { ...lumi('atelier/an-der-wand'), gap: 250 }]))
    ;[1100, 1450, 1800].forEach(ms => at(ms, () => sfx.drum(true)))   // Lumi claps
    at(4300, () => onComplete?.(result(1, 1)))
  }

  const continueFromAlbum = (entry) => {
    const idx = IMAGES.findIndex(i => i.id === entry.imgId)
    if (idx < 0 || !entry.paint) return
    keepSheet()
    sheets.current.delete(entry.imgId)
    pendingPaint.current = entry
    setPanelOpen(false)
    if (idx === imgIdx) {
      // same sheet: load the paint right away
      createImageBitmap(entry.paint).then(bmp => {
        snapshot()
        const pc = paintRef.current, ctx = pc.getContext('2d')
        ctx.clearRect(0, 0, pc.width, pc.height)
        ctx.drawImage(bmp, 0, 0, pc.width, pc.height)
        albumIdRef.current = entry.id
        pendingPaint.current = null
        setMarksBoth(entry.marks ?? NO_MARKS)
        setHasPainted(true)
        redraw()
      }).catch(() => {})
    } else setImgIdx(idx)
  }

  const chooseColor = (c) => {
    setColor(c.value)
    if (tool === 'eraser' || tool === 'stamp' || tool === 'rainbow') setTool('brush')
    narrate([colorWord(c.name)])
  }

  const chooseTool = (t) => {
    setTool(t.id)
    sfx.flip?.()
    if (t.say) narrate([lumi(t.say)])
    if (t.id === 'stamp') narrate([word(STAMP_BY[stamp].word)])
  }

  const chooseStamp = (st) => {
    setStamp(st.e)
    narrate([word(st.word)])
  }

  const chooseSize = (i) => { setBrushIdx(i); sfx.flip?.() }

  // ── The pieces of the toolbar ──────────────────────────────────────────────
  const toolButtons = TOOLS.map(t => {
    const on = tool === t.id
    return (
      <button key={t.id} onClick={() => chooseTool(t)} aria-pressed={on} aria-label={t.rainbow ? 'Regenbogen-Pinsel' : t.label} style={{
        ...pxButton(on ? 'gold' : 'parch'), color: INK, textShadow: 'none',
        width: ui.tool, height: ui.toolH, padding: 0, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1,
        fontFamily: 'var(--font-heading)', fontSize: ui.font, lineHeight: 1.05,
      }}>
        <span style={{ width: ui.icon + 4, height: ui.icon + 4, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: t.rainbow ? RAINBOW_BG : undefined }}>
          {t.id === 'stamp' ? <Art art={stamp} size={ui.icon} /> : <Art art={t.icon} size={ui.icon} />}
        </span>
        {t.label}
      </button>
    )
  })

  const sizeButtons = BRUSHES.map((b, i) => {
    const off = tool === 'fill'
    const on = brushIdx === i && !off
    const dot = Math.round(b.dot * ui.size / 52)
    return (
      <button key={b.id} onClick={() => chooseSize(i)} disabled={off} aria-pressed={on}
        aria-label={tool === 'stamp' ? `Stempel ${['klein', 'mittel', 'groß'][i]}` : `Pinsel ${b.label}`} style={{
          flex: '1 1 0', minWidth: 0, height: ui.size, padding: 0, borderRadius: 10, cursor: off ? 'default' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `2px solid ${on ? INK : 'rgba(42,27,61,0.25)'}`,
          background: on ? 'var(--px-gold)' : 'var(--px-parch-light)', opacity: off ? 0.4 : 1,
        }}>
        {tool === 'stamp'
          ? <Art art={stamp} size={Math.round(ui.size * [0.42, 0.62, 0.84][i])} />
          : <span style={{
              width: dot + 6, height: dot + 6, borderRadius: '50%', border: `2px solid ${INK}`,
              background: tool === 'eraser' ? '#ffffff' : tool === 'rainbow' ? RAINBOW_BG : color,
            }} />}
      </button>
    )
  })

  const cols = wide ? 4 : 7
  const rows = wide ? 4 : 2
  const swatches = tool === 'stamp'
    ? STAMPS.map(st => (
        <button key={st.e} onClick={() => chooseStamp(st)} aria-pressed={stamp === st.e} aria-label={`Stempel ${st.word}`} style={{
          width: ui.dot, height: ui.dot, padding: 0, borderRadius: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: `3px solid ${stamp === st.e ? INK : 'rgba(42,27,61,0.25)'}`,
          background: stamp === st.e ? 'var(--px-gold)' : 'var(--px-parch-light)',
        }}><Art art={st.e} size={Math.round(ui.dot * 0.72)} /></button>
      ))
    : COLORS.map(c => {
        const on = color === c.value && tool !== 'eraser' && tool !== 'rainbow'
        return (
          <button key={c.value} onClick={() => chooseColor(c)} aria-label={c.name} aria-pressed={on} style={{
            width: ui.dot, height: ui.dot, borderRadius: '50%', padding: 0, background: c.value,
            border: `3px solid ${INK}`, outline: on ? '4px solid var(--px-gold)' : 'none', outlineOffset: 1,
            cursor: 'pointer', boxShadow: '0 2px 0 rgba(42,27,61,0.35)',
            transform: on ? 'scale(1.06)' : undefined,
          }} />
        )
      })
  const palette = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, ${ui.dot}px)`, gridAutoRows: ui.dot, gap: ui.gap + 1, justifyContent: 'center', alignContent: 'start', minHeight: rows * ui.dot + (rows - 1) * (ui.gap + 1) }}>
      {swatches}
    </div>
  )

  const undoBtn = (
    <button onClick={undo} disabled={!undoCount} aria-label="Rückgängig" style={{ ...actionBtn('parch', ui.act, !!undoCount), flex: '1 1 0' }}>
      <UndoIcon size={ui.act * 0.5} />
    </button>
  )
  const clearBtn = (
    <button onClick={() => hasPainted && setConfirm('clear')} disabled={!hasPainted}
      aria-label="Alles wegwischen" style={{ ...actionBtn('red', ui.act, hasPainted), flex: '1 1 0' }}>
      <Art art="🗑️" size={ui.act * 0.5} />
    </button>
  )
  const picturesBtn = (
    <button onClick={() => { flushStamps(); setPanelOpen(true); sfx.flip?.() }} aria-label={`Bilder${album.length ? `, ${album.length} an der Wand` : ''}`}
      style={{ ...actionBtn('gold', ui.act), flex: '1 1 0' }}>
      <Art art="🖼️" size={ui.act * 0.56} />
    </button>
  )
  const finishBtn = onComplete && (
    <button onClick={() => finish()} disabled={!hasPainted || !!hanging} style={{ ...actionBtn('green', ui.act, hasPainted), flex: '2 1 0', paddingInline: 12, fontSize: ui.act >= 56 ? 18 : 16 }}>
      <Art art="✅" size={ui.act * 0.46} /> Fertig
    </button>
  )

  const k = dispSize.w / canvasSize.current.w
  const panelStyle = { background: 'var(--px-parch)', padding: 8, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: ui.gap + 1, justifyContent: 'center' }

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: wide ? 'row' : 'column', flex: 1, minHeight: 0, background: '#FFF1D6', overflow: 'hidden', userSelect: 'none', position: 'relative' }}>

      {/* sideways: the tools left of the sheet */}
      {wide && (
        <div style={{ ...panelStyle, borderRight: `3px solid ${INK}`, width: ui.tool * 2 + ui.gap + 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(2, ${ui.tool}px)`, gap: ui.gap + 1 }}>{toolButtons}</div>
          <div style={{ display: 'flex', gap: ui.gap + 1 }}>{undoBtn}{clearBtn}</div>
          <div style={{ display: 'flex' }}>{picturesBtn}</div>
        </div>
      )}

      {/* the easel */}
      <div ref={areaRef} style={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', background: 'var(--px-parch-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', touchAction: 'none', position: 'relative' }}>
        <div style={{ position: 'relative', width: dispSize.w || 1, height: dispSize.h || 1, visibility: ready && dispSize.w ? 'visible' : 'hidden' }}>
          <canvas
            ref={displayRef}
            style={{
              width: '100%', height: '100%', display: 'block',
              // ink frame as a shadow ring: getPos() maps via the bounding rect,
              // which a real border would shift
              borderRadius: 4,
              boxShadow: `0 0 0 3px ${INK}, 0 6px 0 3px rgba(42,27,61,0.35)`,
              cursor: tool === 'fill' ? 'pointer' : 'crosshair',
              touchAction: 'none',
            }}
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          />
          {/* over the sheet: the twinkling glitter, stamps landing, a visitor */}
          <div aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 4 }}>
            {marks.twinkles.map((t, i) => (
              <span key={i} className="co-twinkle" style={{ left: t.x * k, top: t.y * k, width: t.s * k, height: t.s * k, animationDelay: `${t.d}s`, animationDuration: `${t.t}s` }} />
            ))}
            {landing.map(st => (
              <motion.div key={st.id}
                initial={{ scale: 1.9, opacity: 0, rotate: -24 }}
                animate={{ scale: [1.9, 0.82, 1.12, 0.96, 1], opacity: 1, rotate: [-24, 12, -7, 3, 0] }}
                transition={{ duration: 0.45, ease: 'easeOut' }}
                onAnimationComplete={() => commitStamp(st.id)}
                style={{ position: 'absolute', left: (st.x - st.size / 2) * k, top: (st.y - st.size / 2) * k, width: st.size * k, height: st.size * k }}>
                <Art art={st.e} size={st.size * k} />
              </motion.div>
            ))}
            {visitor && (
              <motion.div key={visitor.n} initial={{ x: -60 }} animate={{ x: dispSize.w + 60, y: [0, -14, 6, -10, 0] }}
                transition={{ duration: reduceMotion() ? 0.01 : 4.5, ease: 'linear' }} onAnimationComplete={() => setVisitor(null)}
                style={{ position: 'absolute', left: 0, top: visitor.y * dispSize.h }}>
                <Art art={visitor.art} size={Math.max(34, Math.min(60, dispSize.w * 0.09))} />
              </motion.div>
            )}
          </div>
        </div>
        {bursts}
        {/* until the child has painted: a hand taps the picture */}
        <HintHand to={displayRef} active={ready && !hasPainted && !panelOpen && !hanging} delay={3000} />
        {!ready && <div style={{ position: 'absolute', fontSize: 32 }}>⏳</div>}
        {filling && <div style={{ position: 'absolute', fontSize: 40, pointerEvents: 'none' }}>🎨</div>}
        <AnimatePresence>
          {note && (
            <motion.div key="note" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center', pointerEvents: 'none' }}>
              <LumiCharacter mood="excited" size={48} />
              <div style={{ ...pxBubble, padding: '8px 14px', fontFamily: 'var(--font-heading)', fontSize: 16, color: INK, maxWidth: 420 }}>{note}</div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* sideways: sizes, colours and "Fertig" right of the sheet; upright: all
          of it under the sheet, in rows that keep their height, so the sheet
          never jumps when a tool changes */}
      {wide ? (
        <div style={{ ...panelStyle, borderLeft: `3px solid ${INK}`, width: ui.dot * 4 + (ui.gap + 1) * 3 + 16 }}>
          <div style={{ display: 'flex', gap: ui.gap + 1 }}>{sizeButtons}</div>
          {palette}
          <div style={{ display: 'flex' }}>{finishBtn}</div>
        </div>
      ) : (
        <div style={{ ...panelStyle, borderTop: `3px solid ${INK}`, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: ui.gap }}>{toolButtons}</div>
          <div style={{ display: 'flex', gap: ui.gap + 1, width: Math.min(box.w - 16, ui.tool * 4) }}>{sizeButtons}</div>
          {palette}
          <div style={{ display: 'flex', gap: ui.gap + 1, width: Math.min(box.w - 16, ui.tool * 6 + ui.gap * 5) }}>
            {undoBtn}{clearBtn}{picturesBtn}{finishBtn}
          </div>
        </div>
      )}

      {hanging && <FinishWall {...hanging} />}

      {panelOpen && (
        <PicturePanel images={IMAGES} current={imgIdx} sheetRatio={SHEET_W / SHEET_H} album={album} urls={urls}
          onPick={goToImage} onContinue={continueFromAlbum} onEmpty={() => setConfirm('empty')} onClose={() => setPanelOpen(false)} />
      )}

      {confirm === 'clear' && (
        <ConfirmDialog kid danger title="Alles wegwischen?" say={lumi('atelier/wegwischen')}
          yesLabel="Ja" noLabel="Nein"
          onNo={() => setConfirm(null)} onYes={() => { setConfirm(null); clearPaint() }} />
      )}
      {confirm === 'empty' && (
        <ConfirmDialog kid danger title="Alle Bilder abhängen?"
          yesLabel="Ja" noLabel="Nein"
          onNo={() => setConfirm(null)}
          onYes={async () => {
            setConfirm(null)
            await albumDelete(album.map(e => e.id)).catch(() => {})
            albumIdRef.current = null
            refreshAlbum()
          }} />
      )}
      {confirm === 'full' && (
        <ConfirmDialog kid title="Die Wand ist voll" say={lumi('atelier/wand-voll')}
          text="Das älteste Bild kommt dann ab." yesLabel="Ja" noLabel="Nein"
          onNo={() => setConfirm(null)} onYes={() => { setConfirm(null); finish({ makeRoom: true }) }} />
      )}
    </div>
  )
}
