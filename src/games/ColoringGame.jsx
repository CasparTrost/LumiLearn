import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LumiCharacter from '../components/LumiCharacter.jsx'
import { sfx } from '../sfx.js'
const BASE = import.meta.env.BASE_URL || '/LumiLearn/'

// ─── Coloring images ──────────────────────────────────────────────────────────
const IMAGES = [
  { id: 'mcqueen1',  src: BASE + 'images/coloring/mcqueen1.jpg',  label: 'Lightning McQueen', emoji: '🚗' },
  { id: 'mcqueen2',  src: BASE + 'images/coloring/mcqueen2.jpg',  label: 'Lightning McQueen 2', emoji: '🏎️' },
  { id: 'ninja',     src: BASE + 'images/coloring/ninja.jpg',     label: 'Grüner Ninja', emoji: '🥷' },
  { id: 'nintendo',  src: BASE + 'images/coloring/nintendo.jpg',  label: 'Nintendo', emoji: '🎮' },
  { id: 'princess',  src: BASE + 'images/coloring/princess.jpg',  label: 'Prinzessin', emoji: '👸' },
  { id: 'page2',     src: BASE + 'images/coloring/page2.jpg',     label: 'Ausmalbild', emoji: '🖍️' },
  { id: 'page3',     src: BASE + 'images/coloring/page3.jpg',     label: 'Ausmalbild', emoji: '🎨' },
  { id: 'page4',     src: BASE + 'images/coloring/page4.jpg',     label: 'Ausmalbild', emoji: '🌟' },
  { id: 'page5',     src: BASE + 'images/coloring/page5.jpg',     label: 'Ausmalbild', emoji: '🦋' },
  { id: 'page6',     src: BASE + 'images/coloring/page6.jpg',     label: 'Ausmalbild', emoji: '🌈' },
]

const COLORS = [
  '#E53935', '#FB8C00', '#FDD835', '#43A047',
  '#00ACC1', '#1E88E5', '#8E24AA', '#E91E63',
  '#6D4C41', '#37474F', '#FAFAFA', '#000000',
]

const BRUSH_SIZES = [8, 16, 28]

function shuffle(a) { return [...a].sort(() => Math.random() - 0.5) }

export default function ColoringGame({ level = 1, onComplete }) {
  const count = level <= 3 ? 2 : level <= 6 ? 3 : 4
  const [images]        = useState(() => shuffle(IMAGES).slice(0, Math.min(count, IMAGES.length)))
  const [imgIdx, setImgIdx]     = useState(0)
  const [color, setColor]       = useState('#E53935')
  const [brushSize, setBrushSize] = useState(1) // index into BRUSH_SIZES
  const [isEraser, setIsEraser] = useState(false)
  const [drawing, setDrawing]   = useState(false)
  const [painted, setPainted]   = useState(0) // % painted estimate
  const [showWeiter, setShowWeiter] = useState(false)
  const [done, setDone]         = useState(false)
  const [score, setScore]       = useState(0)

  const canvasRef = useRef(null)
  const lastPos   = useRef(null)
  const imgRef    = useRef(null)

  const currentImage = images[imgIdx]

  // Draw on canvas
  const getPos = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }, [])

  const startDraw = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setDrawing(true)
    const pos = getPos(e, canvas)
    lastPos.current = pos
    // Draw a dot
    const ctx = canvas.getContext('2d')
    ctx.beginPath()
    ctx.arc(pos.x, pos.y, BRUSH_SIZES[brushSize], 0, Math.PI * 2)
    ctx.fillStyle = isEraser ? 'rgba(0,0,0,0)' : color
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out'
    } else {
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }, [color, brushSize, isEraser, getPos])

  const draw = useCallback((e) => {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    const last = lastPos.current

    ctx.beginPath()
    ctx.moveTo(last.x, last.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.lineWidth = BRUSH_SIZES[brushSize] * 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (isEraser) {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.strokeStyle = 'rgba(0,0,0,1)'
    } else {
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
    }
    ctx.stroke()
    ctx.globalCompositeOperation = 'source-over'
    lastPos.current = pos

    // Estimate painted coverage (sample pixels)
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let filled = 0
    const step = 40
    const total = Math.floor(canvas.width / step) * Math.floor(canvas.height / step)
    for (let y = 0; y < canvas.height; y += step) {
      for (let x = 0; x < canvas.width; x += step) {
        const idx = (y * canvas.width + x) * 4
        if (data[idx + 3] > 10) filled++
      }
    }
    const pct = Math.round((filled / total) * 100)
    setPainted(pct)
    if (pct >= 20 && !showWeiter) setShowWeiter(true)
  }, [drawing, color, brushSize, isEraser, showWeiter, getPos])

  const stopDraw = useCallback(() => {
    setDrawing(false)
    lastPos.current = null
  }, [])

  const handleWeiter = useCallback(() => {
    sfx.correct()
    setScore(s => s + 1)
    if (imgIdx + 1 >= images.length) {
      setDone(true)
      setTimeout(() => onComplete({ score: score + 1, total: images.length }), 1200)
    } else {
      setImgIdx(i => i + 1)
      setShowWeiter(false)
      setPainted(0)
      // Clear canvas
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext('2d')
        ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
    }
  }, [imgIdx, images.length, score, onComplete])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setPainted(0)
    setShowWeiter(false)
  }, [])

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: 'clamp(8px,2vw,20px)',
      gap: 8,
      background: 'var(--bg-gradient)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', maxWidth: 700 }}>
        <LumiCharacter mood="happy" size={44} />
        <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(14px,3vw,18px)', color: 'var(--text-primary)' }}>
          {currentImage.emoji} Male {currentImage.label}!
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>
          {imgIdx + 1} / {images.length}
        </div>
      </div>

      {/* Canvas area */}
      <div style={{
        position: 'relative',
        width: '100%',
        maxWidth: 700,
        flex: 1,
        minHeight: 0,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 4px 24px rgba(0,0,0,0.15)',
        background: '#fff',
        touchAction: 'none',
      }}>
        {/* Background image */}
        <img
          ref={imgRef}
          src={currentImage.src}
          alt={currentImage.label}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
        />
        {/* Drawing canvas */}
        <canvas
          ref={canvasRef}
          width={1200}
          height={900}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: isEraser ? 'cell' : 'crosshair' }}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={stopDraw}
        />
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
        justifyContent: 'center', width: '100%', maxWidth: 700,
      }}>
        {/* Colors */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => { setColor(c); setIsEraser(false) }}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: c,
                border: color === c && !isEraser ? '3px solid #333' : '2px solid rgba(0,0,0,0.2)',
                cursor: 'pointer', flexShrink: 0,
                boxShadow: color === c && !isEraser ? '0 0 0 2px white, 0 0 0 4px #333' : 'none',
              }}
            />
          ))}
        </div>

        {/* Brush sizes */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {BRUSH_SIZES.map((_, i) => (
            <button
              key={i}
              onClick={() => setBrushSize(i)}
              style={{
                width: 12 + i * 10, height: 12 + i * 10,
                borderRadius: '50%',
                background: brushSize === i ? '#333' : '#aaa',
                border: 'none', cursor: 'pointer', flexShrink: 0,
              }}
            />
          ))}
        </div>

        {/* Eraser + Clear */}
        <button
          onClick={() => setIsEraser(e => !e)}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none',
            background: isEraser ? '#555' : '#ddd',
            color: isEraser ? '#fff' : '#333',
            fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer',
          }}
        >🩹 Radierer</button>
        <button
          onClick={clearCanvas}
          style={{
            padding: '6px 14px', borderRadius: 20, border: 'none',
            background: '#fee', color: '#c00',
            fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer',
          }}
        >🗑️ Neu</button>
      </div>

      {/* Weiter button */}
      <AnimatePresence>
        {showWeiter && !done && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={handleWeiter}
            style={{
              padding: '12px 36px',
              borderRadius: 30,
              border: 'none',
              background: 'var(--color-primary)',
              color: '#fff',
              fontFamily: 'var(--font-heading)',
              fontSize: 18,
              cursor: 'pointer',
              boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            }}
          >
            {imgIdx + 1 >= images.length ? '🌟 Fertig!' : 'Weiter →'}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}
