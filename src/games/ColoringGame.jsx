import { useState, useRef, useCallback, useEffect } from 'react'

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
  '#FF0000','#FF4444','#FF7700','#FFAA00',
  '#FFDD00','#EEEE00','#CCEE00','#88DD00',
  '#44CC00','#00AA44','#00CC88','#00BBFF',
  '#0088FF','#0044EE','#0022AA','#4422FF',
  '#8800FF','#AA00DD','#CC00AA','#EE0077',
  '#FF0099','#FF44BB','#FF88DD','#FFBBEE',
  '#CC8800','#996633','#774422','#552211',
  '#AAAAAA','#777777','#444444','#000000',
  '#FFCCCC','#FFEECC','#FFFFCC','#CCFFCC',
  '#CCFFFF','#CCCCFF','#FFCCFF','#FFFFFF',
]

const BRUSH_SIZES = [4, 8, 14, 22, 34]

// ── Flood Fill ────────────────────────────────────────────────────────────────
function floodFill(paintCtx, baseImageData, startX, startY, fillR, fillG, fillB, W, H) {
  const paintData = paintCtx.getImageData(0, 0, W, H)
  const bd = baseImageData.data
  const pd = paintData.data

  function isWall(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return true
    const i = (y * W + x) * 4
    return (bd[i] + bd[i+1] + bd[i+2]) < 180
  }

  const si = (startY * W + startX) * 4
  const tR = pd[si], tG = pd[si+1], tB = pd[si+2], tA = pd[si+3]
  if (tR === fillR && tG === fillG && tB === fillB && tA === 220) return
  if (isWall(startX, startY)) return

  const stack = [[startX, startY]]
  const visited = new Uint8Array(W * H)
  visited[startY * W + startX] = 1

  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const idx = (y * W + x) * 4
    pd[idx] = fillR; pd[idx+1] = fillG; pd[idx+2] = fillB; pd[idx+3] = 220
    for (const [nx, ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]) {
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const ni = ny * W + nx
      if (visited[ni] || isWall(nx, ny)) continue
      visited[ni] = 1
      stack.push([nx, ny])
    }
  }
  paintCtx.putImageData(paintData, 0, 0)
}

function hexToRgb(hex) {
  return { r: parseInt(hex.slice(1,3),16), g: parseInt(hex.slice(3,5),16), b: parseInt(hex.slice(5,7),16) }
}

// ── Composite: draw base image + paint layer onto display canvas ──────────────
function composite(displayCtx, baseImg, paintCanvas, W, H) {
  displayCtx.clearRect(0, 0, W, H)
  displayCtx.drawImage(baseImg, 0, 0, W, H)
  // Paint layer with multiply blend so lines stay visible
  displayCtx.globalCompositeOperation = 'multiply'
  displayCtx.drawImage(paintCanvas, 0, 0, W, H)
  displayCtx.globalCompositeOperation = 'source-over'
}

export default function ColoringGame({ onComplete }) {
  const [imgIdx, setImgIdx]       = useState(0)
  const [color, setColor]         = useState('#FF0000')
  const [brushIdx, setBrushIdx]   = useState(1)
  const [tool, setTool]           = useState('fill')
  const [drawing, setDrawing]     = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [filling, setFilling]     = useState(false)
  const [ready, setReady]         = useState(false)

  // Single display canvas shown to user
  const displayRef  = useRef(null)
  // Offscreen paint canvas (transparent color strokes)
  const paintRef    = useRef(document.createElement('canvas'))
  // Pixel data of base image for flood fill edge detection
  const basePixels  = useRef(null)
  // Loaded base image element
  const baseImg     = useRef(null)
  // Canvas dimensions (= natural image size)
  const canvasSize  = useRef({ w: 700, h: 900 })

  const lastPos     = useRef(null)
  const brushR      = BRUSH_SIZES[brushIdx]
  const currentImage = IMAGES[imgIdx]

  // Load image → set up canvases → draw
  useEffect(() => {
    setReady(false)
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = currentImage.src
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight
      canvasSize.current = { w: W, h: H }
      baseImg.current = img

      // Extract pixel data for flood fill
      const tmp = document.createElement('canvas')
      tmp.width = W; tmp.height = H
      tmp.getContext('2d').drawImage(img, 0, 0)
      basePixels.current = tmp.getContext('2d').getImageData(0, 0, W, H)

      // Resize offscreen paint canvas & clear it
      const pc = paintRef.current
      pc.width = W; pc.height = H
      pc.getContext('2d').clearRect(0, 0, W, H)

      // Resize display canvas & draw initial frame
      const dc = displayRef.current
      if (dc) {
        dc.width = W; dc.height = H
        composite(dc.getContext('2d'), img, pc, W, H)
      }
      setReady(true)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentImage.src, canvasKey])

  const redraw = useCallback(() => {
    const dc = displayRef.current
    if (!dc || !baseImg.current) return
    const { w, h } = canvasSize.current
    composite(dc.getContext('2d'), baseImg.current, paintRef.current, w, h)
  }, [])

  const goToImage = useCallback((idx) => {
    setImgIdx(idx)
    setCanvasKey(k => k + 1)
  }, [])

  // Coords: map CSS pixels on display canvas → image pixels
  const getPos = useCallback((e) => {
    const dc = displayRef.current; if (!dc) return { x: 0, y: 0 }
    const rect = dc.getBoundingClientRect()
    const { w, h } = canvasSize.current
    const sx = w / rect.width
    const sy = h / rect.height
    const src = e.touches ? e.touches[0] : e
    return {
      x: Math.round((src.clientX - rect.left) * sx),
      y: Math.round((src.clientY - rect.top)  * sy),
    }
  }, [])

  const doPaint = useCallback((from, to) => {
    const pc = paintRef.current
    const ctx = pc.getContext('2d')

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = brushR*2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(to.x, to.y, brushR, 0, Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.strokeStyle = color; ctx.fillStyle = color
      ctx.lineWidth = brushR*2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(to.x, to.y, brushR, 0, Math.PI*2); ctx.fill()
    }
    redraw()
  }, [tool, color, brushR, redraw])

  const handleDown = useCallback((e) => {
    e.preventDefault()
    const pos = getPos(e)

    if (tool === 'fill') {
      if (!basePixels.current) return
      setFilling(true)
      setTimeout(() => {
        const { w, h } = canvasSize.current
        const { r, g, b } = hexToRgb(color)
        floodFill(paintRef.current.getContext('2d'), basePixels.current, pos.x, pos.y, r, g, b, w, h)
        redraw()
        setFilling(false)
      }, 10)
      return
    }

    setDrawing(true)
    lastPos.current = pos
    doPaint(pos, pos)
  }, [tool, color, getPos, doPaint, redraw])

  const handleMove = useCallback((e) => {
    e.preventDefault()
    if (!drawing || !lastPos.current || tool === 'fill') return
    const pos = getPos(e)
    doPaint(lastPos.current, pos)
    lastPos.current = pos
  }, [drawing, tool, getPos, doPaint])

  const handleUp = useCallback(() => { setDrawing(false); lastPos.current = null }, [])

  const clearPaint = useCallback(() => {
    const pc = paintRef.current
    pc.getContext('2d').clearRect(0, 0, pc.width, pc.height)
    redraw()
  }, [redraw])

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, background:'#f0eeff', overflow:'hidden', userSelect:'none' }}>

      {/* Bild-Auswahl */}
      <div style={{ display:'flex', gap:6, padding:'8px 10px', overflowX:'auto', flexShrink:0, background:'#fff', boxShadow:'0 2px 8px rgba(0,0,0,0.08)' }}>
        {IMAGES.map((img, i) => (
          <button key={img.id} onClick={() => goToImage(i)} style={{
            flexShrink:0, padding:'5px 12px', borderRadius:20, cursor:'pointer',
            border: i===imgIdx ? '2px solid #8B5CF6' : '2px solid transparent',
            background: i===imgIdx ? '#EDE9FE' : '#f0f0f0',
            fontFamily:'var(--font-body)', fontSize:13,
            fontWeight: i===imgIdx ? 700 : 400,
            color: i===imgIdx ? '#6D28D9' : '#555',
            whiteSpace:'nowrap',
          }}>{img.emoji} {img.label}</button>
        ))}
      </div>

      {/* Zeichenfläche — EIN Canvas, kein Mismatch möglich */}
      <div style={{ flex:1, minHeight:0, overflow:'hidden', background:'#ccc', display:'flex', alignItems:'center', justifyContent:'center', padding:8, touchAction:'none', position:'relative' }}>
        <canvas
          ref={displayRef}
          width={canvasSize.current.w}
          height={canvasSize.current.h}
          style={{
            maxWidth:'100%', maxHeight:'100%',
            boxShadow:'0 2px 16px rgba(0,0,0,0.2)',
            cursor: tool==='eraser' ? 'cell' : 'crosshair',
            touchAction:'none',
            display: ready ? 'block' : 'none',
          }}
          onMouseDown={handleDown}
          onMouseMove={handleMove}
          onMouseUp={handleUp}
          onMouseLeave={handleUp}
          onTouchStart={handleDown}
          onTouchMove={handleMove}
          onTouchEnd={handleUp}
        />
        {!ready && <div style={{ fontSize:32 }}>⏳</div>}
        {filling && <div style={{ position:'absolute', fontSize:40, pointerEvents:'none' }}>🎨</div>}
      </div>

      {/* Toolbar */}
      <div style={{ background:'rgba(255,255,255,0.97)', boxShadow:'0 -2px 12px rgba(0,0,0,0.1)', padding:'8px 10px', flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>
        {/* Farben */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'center' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool==='eraser') setTool('brush') }} style={{
              width:28, height:28, borderRadius:'50%', padding:0, background:c,
              border: c==='#FFFFFF' ? '1.5px solid #ccc' : '1.5px solid rgba(0,0,0,0.12)',
              outline: color===c && tool!=='eraser' ? '3px solid #6D28D9' : 'none',
              outlineOffset:2, cursor:'pointer', flexShrink:0,
              boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
            }} />
          ))}
        </div>
        {/* Werkzeuge */}
        <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap' }}>
          {[{id:'brush',label:'✏️ Pinsel'},{id:'fill',label:'🪣 Füllen'},{id:'eraser',label:'🩹 Radierer'}].map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} style={{
              padding:'6px 14px', borderRadius:20, border:'none',
              background: tool===t.id ? '#6D28D9' : '#e8e8e8',
              color: tool===t.id ? '#fff' : '#555',
              fontFamily:'var(--font-body)', fontSize:14, cursor:'pointer', fontWeight:600,
            }}>{t.label}</button>
          ))}
          {tool !== 'fill' && (
            <div style={{ display:'flex', gap:6, alignItems:'center', background:'#f0f0f0', borderRadius:20, padding:'4px 12px' }}>
              {BRUSH_SIZES.map((r, i) => (
                <button key={i} onClick={() => setBrushIdx(i)} style={{
                  width:r*1.6+6, height:r*1.6+6, borderRadius:'50%', padding:0,
                  background: brushIdx===i ? (tool==='eraser'?'#888':color) : '#bbb',
                  border: brushIdx===i ? '2px solid #6D28D9' : '2px solid transparent',
                  cursor:'pointer', flexShrink:0,
                }} />
              ))}
            </div>
          )}
          <button onClick={clearPaint} style={{
            padding:'6px 14px', borderRadius:20, border:'none',
            background:'#FFE4E4', color:'#CC0000',
            fontFamily:'var(--font-body)', fontSize:14, cursor:'pointer', fontWeight:600,
          }}>🗑️ Neu</button>
        </div>
      </div>
    </div>
  )
}
