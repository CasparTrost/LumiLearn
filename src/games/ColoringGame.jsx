import { useState, useRef, useCallback, useEffect } from 'react'

const BASE = import.meta.env.BASE_URL || '/LumiLearn/'

const IMAGES = [
  // A completely empty sheet. Both painting modules were strictly guided —
  // colour inside these lines, or fill the region in the colour it asks for —
  // so there was nowhere in the app to simply draw something of your own.
  // Always unlocked: free drawing is not a reward for reaching a level.
  { id: 'blank', src: null, label: 'Kritzel-Leinwand', emoji: '🖍️', free: true },
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

const STAMPS = ['⭐','❤️','🌈','🌞','🌸','🦋','🐱','🐟','🚀','🍀','⚡','☁️']

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

export default function ColoringGame({ level = 1, onComplete }) {
  // Only a coloring tool, not a "correct answer" quiz — level progression
  // here means unlocking more pictures over time rather than difficulty,
  // so Level 1 and Level 10 aren't literally identical.
  const unlockedCount = Math.min(level, IMAGES.length)
  const [imgIdx, setImgIdxRaw]    = useState(0)
  const [color, setColor]         = useState('#FF0000')
  const [brushIdx, setBrushIdx]   = useState(1)
  const [tool, setTool]           = useState('fill')
  const [drawing, setDrawing]     = useState(false)
  const [canvasKey, setCanvasKey] = useState(0)
  const [filling, setFilling]     = useState(false)
  const [ready, setReady]         = useState(false)
  // "Fertig" used to hand out full marks without ever checking that anything
  // had been drawn at all.
  const [hasPainted, setHasPainted] = useState(false)
  const [stamp, setStamp]           = useState(STAMPS[0])
  const [gallery, setGallery]       = useState(() => {
    try { return JSON.parse(localStorage.getItem('lumilearn_gallery') || '[]') } catch { return [] }
  })
  const [savedNote, setSavedNote]   = useState(false)

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
    setHasPainted(false)

    if (currentImage.free) {
      // No outline to load — just a white sheet the child owns entirely.
      const W = 700, H = 900
      canvasSize.current = { w: W, h: H }
      const blank = document.createElement('canvas')
      blank.width = W; blank.height = H
      const bctx = blank.getContext('2d')
      bctx.fillStyle = '#ffffff'
      bctx.fillRect(0, 0, W, H)
      baseImg.current = blank
      basePixels.current = bctx.getImageData(0, 0, W, H)
      const pc = paintRef.current
      pc.width = W; pc.height = H
      pc.getContext('2d').clearRect(0, 0, W, H)
      const dc = displayRef.current
      if (dc) { dc.width = W; dc.height = H; composite(dc.getContext('2d'), blank, pc, W, H) }
      setReady(true)
      return
    }

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
    if (!IMAGES[idx].free && idx > unlockedCount) return
    setImgIdxRaw(idx)
    setCanvasKey(k => k + 1)
  }, [unlockedCount])

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

  const markPainted = useCallback(() => setHasPainted(true), [])

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
    markPainted()
    redraw()
  }, [tool, color, brushR, redraw, markPainted])

  // Nothing the child drew could be kept — no export, no gallery, and
  // switching pictures wiped it. Saved sheets live in localStorage and are
  // shown as a strip below the tools.
  const saveToGallery = useCallback(() => {
    const dc = displayRef.current
    if (!dc) return
    try {
      const thumb = document.createElement('canvas')
      const scale = 220 / dc.width
      thumb.width = 220
      thumb.height = Math.round(dc.height * scale)
      thumb.getContext('2d').drawImage(dc, 0, 0, thumb.width, thumb.height)
      const next = [{ id: Date.now(), data: thumb.toDataURL('image/jpeg', 0.7) },
                    ...gallery].slice(0, 12)
      setGallery(next)
      localStorage.setItem('lumilearn_gallery', JSON.stringify(next))
      setSavedNote(true)
      setTimeout(() => setSavedNote(false), 1800)
    } catch { /* storage full or blocked — drawing simply isn't kept */ }
  }, [gallery])

  const handleDown = useCallback((e) => {
    e.preventDefault()
    const pos = getPos(e)

    if (tool === 'stamp') {
      const ctx = paintRef.current.getContext('2d')
      const size = brushR * 5
      ctx.font = `${size}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(stamp, pos.x, pos.y)
      markPainted()
      redraw()
      return
    }

    if (tool === 'fill') {
      if (!basePixels.current) return
      setFilling(true)
      setTimeout(() => {
        const { w, h } = canvasSize.current
        const { r, g, b } = hexToRgb(color)
        floodFill(paintRef.current.getContext('2d'), basePixels.current, pos.x, pos.y, r, g, b, w, h)
        markPainted()
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
        {IMAGES.map((img, i) => {
          const locked = !img.free && i > unlockedCount
          return (
            <button key={img.id} onClick={() => goToImage(i)} disabled={locked} style={{
              flexShrink:0, padding:'5px 12px', borderRadius:20,
              cursor: locked ? 'not-allowed' : 'pointer',
              border: i===imgIdx ? '2px solid #8B5CF6' : '2px solid transparent',
              background: i===imgIdx ? '#EDE9FE' : '#f0f0f0',
              fontFamily:'var(--font-body)', fontSize:13,
              fontWeight: i===imgIdx ? 700 : 400,
              color: i===imgIdx ? '#6D28D9' : '#555',
              whiteSpace:'nowrap',
              opacity: locked ? 0.45 : 1,
            }}>{locked ? '🔒' : img.emoji} {locked ? `Level ${i}` : img.label}</button>
          )
        })}
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
          {[{id:'brush',label:'✏️ Pinsel'},{id:'fill',label:'🪣 Füllen'},{id:'eraser',label:'🩹 Radierer'},{id:'stamp',label:'⭐ Stempel'}].map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} style={{
              padding:'6px 14px', borderRadius:20, border:'none',
              background: tool===t.id ? '#6D28D9' : '#e8e8e8',
              color: tool===t.id ? '#fff' : '#555',
              fontFamily:'var(--font-body)', fontSize:14, cursor:'pointer', fontWeight:600,
            }}>{t.label}</button>
          ))}
          {tool === 'stamp' && (
            <div style={{ display:'flex', gap:4, alignItems:'center', flexWrap:'wrap' }}>
              {STAMPS.map(st => (
                <button key={st} onClick={() => setStamp(st)} style={{
                  fontSize:20, lineHeight:1, padding:'3px 5px', borderRadius:10, cursor:'pointer',
                  border: stamp===st ? '2px solid #6D28D9' : '2px solid transparent',
                  background: stamp===st ? '#EDE9FE' : 'transparent',
                }}>{st}</button>
              ))}
            </div>
          )}
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
          <button onClick={saveToGallery} disabled={!hasPainted} style={{
            padding:'6px 14px', borderRadius:20, border:'none',
            background: hasPainted ? '#E8F8EE' : '#eee',
            color: hasPainted ? '#2C8C50' : '#aaa',
            fontFamily:'var(--font-body)', fontSize:14,
            cursor: hasPainted ? 'pointer' : 'default', fontWeight:600,
          }}>💾 Aufheben</button>
          {savedNote && (
            <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'#2C8C50' }}>
              Im Album! 🖼️
            </span>
          )}
          {onComplete && (
            <button
              onClick={() => { if (hasPainted) onComplete({ score: 1, total: 1 }) }}
              disabled={!hasPainted}
              title={hasPainted ? '' : 'Male zuerst etwas!'}
              style={{
                padding:'6px 14px', borderRadius:20, border:'none',
                background: hasPainted ? 'linear-gradient(135deg,#6C63FF,#4A00E0)' : '#ddd',
                color: hasPainted ? '#fff' : '#999',
                fontFamily:'var(--font-body)', fontSize:14,
                cursor: hasPainted ? 'pointer' : 'default', fontWeight:600,
              }}>✅ Fertig</button>
          )}
        </div>

        {/* Album of kept pictures */}
        {gallery.length > 0 && (
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', marginTop:10 }}>
            <span style={{ fontFamily:'var(--font-body)', fontSize:13, color:'#777' }}>🖼️ Dein Album:</span>
            {gallery.map(g => (
              <img key={g.id} src={g.data} alt="Gemaltes Bild"
                style={{ height:54, borderRadius:8, border:'2px solid #E5E0F5', background:'#fff' }} />
            ))}
            <button onClick={() => { setGallery([]); localStorage.removeItem('lumilearn_gallery') }}
              style={{
                padding:'4px 10px', borderRadius:14, border:'none', background:'#FFE4E4',
                color:'#CC0000', fontFamily:'var(--font-body)', fontSize:12, cursor:'pointer',
              }}>Album leeren</button>
          </div>
        )}
        <div style={{ display:'none' }}>
        </div>
      </div>
    </div>
  )
}
