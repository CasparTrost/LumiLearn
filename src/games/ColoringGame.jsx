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

export default function ColoringGame({ onComplete }) {
  const [imgIdx, setImgIdx]     = useState(0)
  const [color, setColor]       = useState('#FF0000')
  const [brushIdx, setBrushIdx] = useState(1)
  const [tool, setTool]         = useState('fill')
  const [drawing, setDrawing]   = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [filling, setFilling]   = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)

  // paint canvas = transparent overlay with color strokes
  const paintRef      = useRef(null)
  // pixel data of base image for edge detection
  const basePixels    = useRef(null)
  // natural dimensions of current image
  const imgNatural    = useRef({ w: 1200, h: 900 })
  const lastPos       = useRef(null)
  const brushR        = BRUSH_SIZES[brushIdx]
  const currentImage  = IMAGES[imgIdx]

  // Load image pixel data for edge detection (without showing it ourselves)
  useEffect(() => {
    setImgLoaded(false)
    basePixels.current = null
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.src = currentImage.src
    img.onload = () => {
      imgNatural.current = { w: img.naturalWidth, h: img.naturalHeight }
      // Store pixel data
      const tmp = document.createElement('canvas')
      tmp.width = img.naturalWidth; tmp.height = img.naturalHeight
      tmp.getContext('2d').drawImage(img, 0, 0)
      basePixels.current = tmp.getContext('2d').getImageData(0, 0, tmp.width, tmp.height)
      // Resize paint canvas
      if (paintRef.current) {
        paintRef.current.width  = img.naturalWidth
        paintRef.current.height = img.naturalHeight
      }
      setImgLoaded(true)
    }
  }, [currentImage.src])

  const goToImage = useCallback((idx) => {
    setImgIdx(idx)
    setCanvasKey(k => k + 1)
  }, [])

  // Map screen coords → image pixel coords (paint canvas = same size as image)
  const getPos = useCallback((e) => {
    const pc = paintRef.current; if (!pc) return { x: 0, y: 0 }
    const rect = pc.getBoundingClientRect()
    const sx = pc.width  / rect.width
    const sy = pc.height / rect.height
    const src = e.touches ? e.touches[0] : e
    return { x: Math.round((src.clientX - rect.left) * sx), y: Math.round((src.clientY - rect.top) * sy) }
  }, [])

  const doPaint = useCallback((from, to) => {
    const pc = paintRef.current; if (!pc) return
    const ctx = pc.getContext('2d')
    const W = pc.width, H = pc.height

    if (tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = brushR*2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
      ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.fillStyle = 'rgba(0,0,0,1)'
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
      ctx.beginPath(); ctx.arc(to.x, to.y, brushR, 0, Math.PI*2); ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
      return
    }

    // Brush: simple fast drawing
    ctx.strokeStyle = color; ctx.fillStyle = color
    ctx.lineWidth = brushR * 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke()
    ctx.beginPath(); ctx.arc(to.x, to.y, brushR, 0, Math.PI*2); ctx.fill()
  }, [tool, color, brushR])

  const handlePointerDown = useCallback((e) => {
    e.preventDefault()
    const pos = getPos(e)

    if (tool === 'fill') {
      if (!basePixels.current || !paintRef.current) return
      setFilling(true)
      setTimeout(() => {
        const pc = paintRef.current; if (!pc) return
        const { r, g, b } = hexToRgb(color)
        floodFill(pc.getContext('2d'), basePixels.current, pos.x, pos.y, r, g, b, pc.width, pc.height)
        setFilling(false)
      }, 10)
      return
    }

    setDrawing(true)
    lastPos.current = pos
    doPaint(pos, pos)
  }, [tool, color, getPos, doPaint])

  const handlePointerMove = useCallback((e) => {
    e.preventDefault()
    if (!drawing || !lastPos.current || tool === 'fill') return
    const pos = getPos(e)
    doPaint(lastPos.current, pos)
    lastPos.current = pos
  }, [drawing, tool, getPos, doPaint])

  const handlePointerUp = useCallback(() => { setDrawing(false); lastPos.current = null }, [])

  const clearCanvas = useCallback(() => {
    const pc = paintRef.current; if (!pc) return
    pc.getContext('2d').clearRect(0, 0, pc.width, pc.height)
  }, [])

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

      {/* Zeichenfläche */}
      <div style={{ flex:1, minHeight:0, overflow:'hidden', background:'#e8e8e8', display:'flex', alignItems:'center', justifyContent:'center', padding:8, touchAction:'none' }}>
        {/* Wrapper mit exaktem Seitenverhältnis des Bildes */}
        <div style={{
          position:'relative',
          width: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          aspectRatio: imgLoaded ? `${imgNatural.current.w} / ${imgNatural.current.h}` : '4/3',
          overflow:'hidden',
          boxShadow:'0 2px 16px rgba(0,0,0,0.15)',
        }}>
          {/* Layer 1: Originalbild (immer sichtbar) */}
          <img
            key={currentImage.id}
            src={currentImage.src}
            alt={currentImage.label}
            onLoad={() => setImgLoaded(true)}
                        style={{
              position:'absolute', inset:0,
              width:'100%', height:'100%',
              pointerEvents:'none',
              display: imgLoaded ? 'block' : 'none',
            }}
          />
          {/* Layer 2: Paint canvas */}
          {imgLoaded && (
            <canvas
              key={`paint-${canvasKey}`}
              ref={paintRef}
              width={imgNatural.current.w}
              height={imgNatural.current.h}
              style={{
                position:'absolute', inset:0,
                width:'100%', height:'100%',
                mixBlendMode:'multiply',
                cursor: tool==='fill' ? 'crosshair' : tool==='eraser' ? 'cell' : 'crosshair',
                touchAction:'none',
              }}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
            />
          )}
          {!imgLoaded && <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:32 }}>⏳</div>}
          {filling && <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', fontSize:40, pointerEvents:'none' }}>🎨</div>}
        </div>
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
