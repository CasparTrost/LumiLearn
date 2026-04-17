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
// Fills a region on the PAINT canvas, stopping at dark pixels of the BASE canvas.
function floodFill(paintCtx, baseCtx, startX, startY, fillR, fillG, fillB, canvasW, canvasH) {
  // Read the base image to find edges (dark pixels = walls)
  const baseData = baseCtx.getImageData(0, 0, canvasW, canvasH)
  const paintData = paintCtx.getImageData(0, 0, canvasW, canvasH)
  const bd = baseData.data
  const pd = paintData.data

  // A pixel is a "wall" if it's dark in the base image (R+G+B < 200)
  function isWall(x, y) {
    if (x < 0 || y < 0 || x >= canvasW || y >= canvasH) return true
    const i = (y * canvasW + x) * 4
    return (bd[i] + bd[i+1] + bd[i+2]) < 200
  }

  // Target: the current paint color at startX/startY
  const si = (startY * canvasW + startX) * 4
  const targetR = pd[si], targetG = pd[si+1], targetB = pd[si+2], targetA = pd[si+3]

  // Don't fill if already the same color
  if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === 255) return

  // Don't fill if clicking on a wall
  if (isWall(startX, startY)) return

  // BFS flood fill
  const stack = [[startX, startY]]
  const visited = new Uint8Array(canvasW * canvasH)
  visited[startY * canvasW + startX] = 1

  while (stack.length > 0) {
    const [x, y] = stack.pop()
    const idx = (y * canvasW + x) * 4

    // Set color
    pd[idx]     = fillR
    pd[idx + 1] = fillG
    pd[idx + 2] = fillB
    pd[idx + 3] = 200 // slightly transparent so lines show through

    const neighbors = [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]
    for (const [nx, ny] of neighbors) {
      if (nx < 0 || ny < 0 || nx >= canvasW || ny >= canvasH) continue
      const ni = ny * canvasW + nx
      if (visited[ni]) continue
      if (isWall(nx, ny)) continue
      visited[ni] = 1
      stack.push([nx, ny])
    }
  }

  paintCtx.putImageData(paintData, 0, 0)
}

// Hex color → {r,g,b}
function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return {r,g,b}
}

export default function ColoringGame({ onComplete }) {
  const [imgIdx, setImgIdx]       = useState(0)
  const [color, setColor]         = useState('#FF0000')
  const [brushIdx, setBrushIdx]   = useState(1)
  const [isEraser, setIsEraser]   = useState(false)
  const [tool, setTool]           = useState('brush') // 'brush' | 'fill' | 'eraser'
  const [drawing, setDrawing]     = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [filling, setFilling]     = useState(false) // loading indicator for fill

  const canvasRef = useRef(null)  // paint canvas (transparent overlay)
  const baseRef   = useRef(null)  // offscreen canvas with base image for edge detection
  const lastPos   = useRef(null)
  const brushR    = BRUSH_SIZES[brushIdx]
  const currentImage = IMAGES[imgIdx]

  // Load base image into offscreen canvas whenever image changes
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = currentImage.src
    img.onload = () => {
      if (!baseRef.current) {
        baseRef.current = document.createElement('canvas')
      }
      baseRef.current.width  = 1200
      baseRef.current.height = 900
      const ctx = baseRef.current.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, 1200, 900)
      // Draw image maintaining aspect ratio
      const iw = img.naturalWidth, ih = img.naturalHeight
      const scale = Math.min(1200/iw, 900/ih)
      const dw = iw*scale, dh = ih*scale
      const dx = (1200-dw)/2, dy = (900-dh)/2
      ctx.drawImage(img, dx, dy, dw, dh)
    }
  }, [currentImage.src])

  const goToImage = useCallback((idx) => {
    setImgIdx(idx)
    setCanvasKey(k => k + 1)
  }, [])

  const getPos = useCallback((e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    const src = e.touches ? e.touches[0] : e
    return { x: Math.round((src.clientX - rect.left) * sx), y: Math.round((src.clientY - rect.top) * sy) }
  }, [])

  const paintStroke = useCallback((ctx, from, to) => {
    if (tool === 'eraser') {
      // Eraser: direct
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = brushR * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(to.x, to.y, brushR, 0, Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      return
    }

    // Brush with line-guard: paint only on light areas of base image
    if (!baseRef.current) {
      // fallback if base not loaded yet
      ctx.strokeStyle = color; ctx.fillStyle = color
      ctx.lineWidth = brushR * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(to.x, to.y, brushR, 0, Math.PI*2); ctx.fill()
      return
    }

    // 1. Draw stroke on a temporary offscreen canvas
    const tmp = document.createElement('canvas')
    tmp.width = ctx.canvas.width; tmp.height = ctx.canvas.height
    const t = tmp.getContext('2d')
    t.strokeStyle = color; t.fillStyle = color
    t.lineWidth = brushR * 2; t.lineCap = 'round'; t.lineJoin = 'round'
    t.beginPath(); t.moveTo(from.x, from.y); t.lineTo(to.x, to.y); t.stroke()
    t.beginPath(); t.arc(to.x, to.y, brushR, 0, Math.PI*2); t.fill()

    // 2. Mask: keep only pixels where base image is LIGHT (not a line)
    // Draw base image in 'destination-in' → removes color where base is dark
    // We invert: draw white where base is light → use as mask
    const mask = document.createElement('canvas')
    mask.width = tmp.width; mask.height = tmp.height
    const m = mask.getContext('2d')
    // Draw base image
    m.drawImage(baseRef.current, 0, 0, mask.width, mask.height)
    // Invert: dark pixels (lines) → transparent, light → white
    const imgd = m.getImageData(0, 0, mask.width, mask.height)
    const d = imgd.data
    for (let i = 0; i < d.length; i += 4) {
      const brightness = (d[i] + d[i+1] + d[i+2]) / 3
      // If dark (line), make transparent; if light, make opaque
      d[i+3] = brightness > 128 ? 255 : 0
    }
    m.putImageData(imgd, 0, 0)

    // 3. Apply mask to stroke: keep stroke only where mask is opaque
    t.globalCompositeOperation = 'destination-in'
    t.drawImage(mask, 0, 0)

    // 4. Composite masked stroke onto main canvas
    ctx.drawImage(tmp, 0, 0)
  }, [color, brushR, tool])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const pos = getPos(e, canvas)

    if (tool === 'fill') {
      // Flood fill
      if (!baseRef.current) return
      setFilling(true)
      setTimeout(() => {
        const {r,g,b} = hexToRgb(color)
        floodFill(
          canvas.getContext('2d'),
          baseRef.current.getContext('2d'),
          pos.x, pos.y, r, g, b, 1200, 900
        )
        setFilling(false)
      }, 10) // tiny delay so UI can update
      return
    }

    setDrawing(true)
    lastPos.current = pos
    paintStroke(canvas.getContext('2d'), pos, pos)
  }, [tool, color, getPos, paintStroke])

  const handlePointerMove = useCallback((e) => {
    e.preventDefault()
    if (!drawing || !lastPos.current || tool === 'fill') return
    const canvas = canvasRef.current; if (!canvas) return
    const pos = getPos(e, canvas)
    paintStroke(canvas.getContext('2d'), lastPos.current, pos)
    lastPos.current = pos
  }, [drawing, tool, getPos, paintStroke])

  const handlePointerUp = useCallback(() => {
    setDrawing(false)
    lastPos.current = null
  }, [])

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
  }, [])

  const activeTool = tool === 'eraser' ? 'eraser' : tool

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, background:'#f8f4ff', overflow:'hidden', userSelect:'none' }}>

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

      {/* Zeichenfläche */}
      <div style={{ flex:1, minHeight:0, overflow:'hidden', background:'#fff', position:'relative', touchAction:'none' }}>
        <img
          key={currentImage.id}
          src={currentImage.src}
          alt={currentImage.label}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', pointerEvents:'none', zIndex:2, mixBlendMode:'multiply' }}
        />
        <canvas
          key={canvasKey}
          ref={canvasRef}
          width={1200} height={900}
          style={{
            position:'absolute', inset:0,
            width:'100%', height:'100%',
            cursor: tool==='fill' ? 'cell' : tool==='eraser' ? 'cell' : 'crosshair',
            touchAction:'none',
            zIndex:1,
          }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
        {filling && (
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:36, pointerEvents:'none' }}>🎨</div>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ background:'rgba(255,255,255,0.97)', boxShadow:'0 -2px 12px rgba(0,0,0,0.1)', padding:'8px 10px', flexShrink:0, display:'flex', flexDirection:'column', gap:8 }}>

        {/* Farben */}
        <div style={{ display:'flex', gap:5, flexWrap:'wrap', justifyContent:'center' }}>
          {COLORS.map(c => (
            <button key={c} onClick={() => { setColor(c); if (tool==='eraser') setTool('brush') }} style={{
              width:28, height:28, borderRadius:'50%', padding:0,
              background:c,
              border: c==='#FFFFFF' ? '1.5px solid #ccc' : '1.5px solid rgba(0,0,0,0.12)',
              outline: color===c && tool!=='eraser' ? '3px solid #6D28D9' : 'none',
              outlineOffset:2, cursor:'pointer', flexShrink:0,
              boxShadow:'0 1px 3px rgba(0,0,0,0.15)',
            }} />
          ))}
        </div>

        {/* Werkzeuge + Pinselgrößen */}
        <div style={{ display:'flex', gap:8, alignItems:'center', justifyContent:'center', flexWrap:'wrap' }}>

          {/* Werkzeug-Buttons */}
          {[
            { id:'brush', label:'✏️ Pinsel' },
            { id:'fill',  label:'🪣 Füllen' },
            { id:'eraser',label:'🩹 Radierer' },
          ].map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} style={{
              padding:'6px 14px', borderRadius:20, border:'none',
              background: tool===t.id ? '#6D28D9' : '#e8e8e8',
              color: tool===t.id ? '#fff' : '#555',
              fontFamily:'var(--font-body)', fontSize:14, cursor:'pointer', fontWeight:600,
            }}>{t.label}</button>
          ))}

          {/* Pinselgrößen (nur bei Pinsel/Radierer sinnvoll) */}
          {tool !== 'fill' && (
            <div style={{ display:'flex', gap:6, alignItems:'center', background:'#f0f0f0', borderRadius:20, padding:'4px 12px' }}>
              {BRUSH_SIZES.map((r, i) => (
                <button key={i} onClick={() => setBrushIdx(i)} style={{
                  width: r*1.6+6, height: r*1.6+6, borderRadius:'50%', padding:0,
                  background: brushIdx===i ? (tool==='eraser'?'#888':color) : '#bbb',
                  border: brushIdx===i ? '2px solid #6D28D9' : '2px solid transparent',
                  cursor:'pointer', flexShrink:0,
                }} />
              ))}
            </div>
          )}

          {/* Neu */}
          <button onClick={clearCanvas} style={{
            padding:'6px 14px', borderRadius:20, border:'none',
            background:'#FFE4E4', color:'#CC0000',
            fontFamily:'var(--font-body)', fontSize:14, cursor:'pointer', fontWeight:600,
          }}>🗑️ Neu</button>
        </div>
      </div>
    </div>
  )
}
