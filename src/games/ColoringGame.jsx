import { useState, useRef, useCallback } from 'react'

// ─── Ausmalbild-Liste ──────────────────────────────────────────────────────────
const BASE = import.meta.env.BASE_URL || '/LumiLearn/'

const IMAGES = [
  { id: 'mcqueen1',  src: `${BASE}images/coloring/mcqueen1.jpg`,  label: 'Lightning McQueen',   emoji: '🚗' },
  { id: 'mcqueen2',  src: `${BASE}images/coloring/mcqueen2.jpg`,  label: 'Lightning McQueen 2', emoji: '🏎️' },
  { id: 'ninja',     src: `${BASE}images/coloring/ninja.jpg`,     label: 'Grüner Ninja',        emoji: '🥷' },
  { id: 'nintendo',  src: `${BASE}images/coloring/nintendo.jpg`,  label: 'Nintendo',            emoji: '🎮' },
  { id: 'princess',  src: `${BASE}images/coloring/princess.jpg`,  label: 'Prinzessin',          emoji: '👸' },
  { id: 'page2',     src: `${BASE}images/coloring/page2.jpg`,     label: 'Ausmalbild 2',        emoji: '🌸' },
  { id: 'page3',     src: `${BASE}images/coloring/page3.jpg`,     label: 'Ausmalbild 3',        emoji: '🌟' },
  { id: 'page4',     src: `${BASE}images/coloring/page4.jpg`,     label: 'Ausmalbild 4',        emoji: '🦋' },
  { id: 'page5',     src: `${BASE}images/coloring/page5.jpg`,     label: 'Ausmalbild 5',        emoji: '🐉' },
  { id: 'page6',     src: `${BASE}images/coloring/page6.jpg`,     label: 'Ausmalbild 6',        emoji: '🌈' },
]

const COLORS = [
  // Warm
  '#FF0000', '#FF4444', '#FF7700', '#FFAA00',
  '#FFDD00', '#EEEE00', '#CCEE00', '#88DD00',
  // Grün-Blau
  '#44CC00', '#00AA44', '#00CC88', '#00BBFF',
  '#0088FF', '#0044EE', '#0022AA', '#4422FF',
  // Lila-Pink
  '#8800FF', '#AA00DD', '#CC00AA', '#EE0077',
  '#FF0099', '#FF44BB', '#FF88DD', '#FFBBEE',
  // Braun-Grau
  '#CC8800', '#996633', '#774422', '#552211',
  '#AAAAAA', '#777777', '#444444', '#000000',
  // Pastell & Weiß
  '#FFCCCC', '#FFEECC', '#FFFFCC', '#CCFFCC',
  '#CCFFFF', '#CCCCFF', '#FFCCFF', '#FFFFFF',
]

const BRUSH_SIZES = [4, 8, 14, 22, 34]

export default function ColoringGame({ level = 1, onComplete }) {
  const [imgIdx, setImgIdx]       = useState(0)
  const [color, setColor]         = useState('#FF0000')
  const [brushIdx, setBrushIdx]   = useState(1)
  const [isEraser, setIsEraser]   = useState(false)
  const [drawing, setDrawing]     = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [imgLoaded, setImgLoaded] = useState(false)

  const canvasRef = useRef(null)
  const lastPos   = useRef(null)
  const brushR    = BRUSH_SIZES[brushIdx]

  const goToImage = useCallback((idx) => {
    setImgIdx(idx)
    setImgLoaded(false)
    setCanvasKey(k => k + 1)
    // TTS: announce image name
    setTimeout(() => {
      if (!window.speechSynthesis) return
      window.speechSynthesis.cancel()
      const u = new SpeechSynthesisUtterance(`Male jetzt: ${IMAGES[idx].label}`)
      u.lang = 'de-DE'; u.rate = 0.9; u.pitch = 1.1
      window.speechSynthesis.speak(u)
    }, 300)
  }, [])

  const getPos = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    const src = e.touches ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * sx, y: (src.clientY - rect.top) * sy }
  }, [])

  const paint = useCallback((ctx, from, to) => {
    ctx.globalCompositeOperation = isEraser ? 'destination-out' : 'source-over'
    ctx.strokeStyle = isEraser ? 'rgba(0,0,0,1)' : color
    ctx.lineWidth   = brushR * 2
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    ctx.beginPath()
    ctx.moveTo(from.x, from.y)
    ctx.lineTo(to.x, to.y)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(to.x, to.y, brushR, 0, Math.PI * 2)
    ctx.fillStyle = isEraser ? 'rgba(0,0,0,1)' : color
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
  }, [color, brushR, isEraser])

  const startDraw = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    setDrawing(true)
    const pos = getPos(e, canvas)
    lastPos.current = pos
    paint(canvas.getContext('2d'), pos, pos)
  }, [getPos, paint])

  const moveDraw = useCallback((e) => {
    e.preventDefault()
    if (!drawing || !lastPos.current) return
    const canvas = canvasRef.current
    if (!canvas) return
    const pos = getPos(e, canvas)
    paint(canvas.getContext('2d'), lastPos.current, pos)
    lastPos.current = pos
  }, [drawing, getPos, paint])

  const stopDraw = useCallback(() => {
    setDrawing(false)
    lastPos.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const currentImage = IMAGES[imgIdx]

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#f8f4ff', overflow: 'hidden', userSelect: 'none',
    }}>

      {/* ── Bild-Auswahl ── */}
      <div style={{
        display: 'flex', gap: 6, padding: '8px 10px', overflowX: 'auto',
        background: 'rgba(255,255,255,0.95)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        flexShrink: 0,
      }}>
        {IMAGES.map((img, i) => (
          <button key={img.id} onClick={() => goToImage(i)} style={{
            flexShrink: 0, padding: '5px 12px', borderRadius: 20,
            border: i === imgIdx ? '2px solid #8B5CF6' : '2px solid transparent',
            background: i === imgIdx ? '#EDE9FE' : '#f0f0f0',
            cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: 13,
            fontWeight: i === imgIdx ? 700 : 400,
            color: i === imgIdx ? '#6D28D9' : '#555',
            whiteSpace: 'nowrap',
          }}>
            {img.emoji} {img.label}
          </button>
        ))}
      </div>

      {/* ── Zeichenfläche ── */}
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0,
        background: '#fff', touchAction: 'none',
      }}>
        <img
          key={currentImage.id}
          src={currentImage.src}
          alt={currentImage.label}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => { console.warn('Image failed:', currentImage.src); setImgLoaded(true) }}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            pointerEvents: 'none',
          }}
        />
        <canvas
          key={canvasKey}
          ref={canvasRef}
          width={1200}
          height={900}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            cursor: isEraser ? 'cell' : 'crosshair',
            touchAction: 'none',
          }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={stopDraw}
        />
        {!imgLoaded && (
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: 32 }}>⏳</div>
        )}
      </div>

      {/* ── Toolbar ── */}
      <div style={{
        background: 'rgba(255,255,255,0.97)', boxShadow: '0 -2px 12px rgba(0,0,0,0.1)',
        padding: '8px 10px', flexShrink: 0,
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Farben */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', justifyContent: 'center' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); setIsEraser(false) }} style={{
              width: 28, height: 28, borderRadius: '50%', padding: 0,
              background: c,
              border: c === '#FFFFFF' ? '1.5px solid #ccc' : '1.5px solid rgba(0,0,0,0.12)',
              outline: color === c && !isEraser ? '3px solid #6D28D9' : 'none',
              outlineOffset: 2,
              cursor: 'pointer', flexShrink: 0,
              boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
            }} />
          ))}
        </div>

        {/* Pinsel + Tools */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#f0f0f0', borderRadius: 20, padding: '4px 12px' }}>
            {BRUSH_SIZES.map((r, i) => (
              <button key={i} onClick={() => { setBrushIdx(i); setIsEraser(false) }} style={{
                width: r * 1.6 + 6, height: r * 1.6 + 6, borderRadius: '50%', padding: 0,
                background: brushIdx === i && !isEraser ? color : '#bbb',
                border: brushIdx === i && !isEraser ? '2px solid #6D28D9' : '2px solid transparent',
                cursor: 'pointer', flexShrink: 0,
              }} />
            ))}
          </div>
          <button onClick={() => setIsEraser(e => !e)} style={{
            padding: '6px 16px', borderRadius: 20, border: 'none',
            background: isEraser ? '#6D28D9' : '#e8e8e8',
            color: isEraser ? '#fff' : '#555',
            fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}>🩹 Radierer</button>
          <button onClick={clearCanvas} style={{
            padding: '6px 16px', borderRadius: 20, border: 'none',
            background: '#FFE4E4', color: '#CC0000',
            fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer', fontWeight: 600,
          }}>🗑️ Neu</button>
          <button onClick={() => onComplete({ score: IMAGES.length, total: IMAGES.length })} style={{
            padding: '6px 16px', borderRadius: 20, border: 'none',
            background: 'linear-gradient(135deg,#6BCB77,#44D498)', color: 'white',
            fontFamily: 'var(--font-body)', fontSize: 14, cursor: 'pointer', fontWeight: 700,
            boxShadow: '0 2px 8px rgba(107,203,119,0.4)',
          }}>✅ Fertig gemalt!</button>
        </div>
      </div>

    </div>
  )
}
