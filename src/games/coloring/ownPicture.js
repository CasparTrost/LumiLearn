// A picture from the device becomes a page of the Mal-Atelier: read in the
// browser, traced (lineArt.js, in a worker), drawn as a PNG. Nothing is
// uploaded anywhere: the file never leaves the device.
import { sheetSize, toColoringPage } from './lineArt.js'
import LineArtWorker from './lineArt.worker.js?worker&inline'

// The picture at sheet size, white where it is transparent
export async function readPicture(file) {
  let src
  try {
    src = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    // (an older Safari: through an <img>)
    const url = URL.createObjectURL(file)
    try {
      src = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = url
      })
    } finally { setTimeout(() => URL.revokeObjectURL(url), 1000) }
  }
  let w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight
  if (!w0 || !h0) throw new Error('empty picture')
  const { w, h } = sheetSize(w0, h0)
  // a big camera photo shrinks in halves first: one big step aliases
  let from = src
  while (w0 > w * 2 && h0 > h * 2) {
    const c = document.createElement('canvas')
    c.width = Math.round(w0 / 2); c.height = Math.round(h0 / 2)
    const cx = c.getContext('2d')
    cx.imageSmoothingQuality = 'high'
    cx.drawImage(from, 0, 0, c.width, c.height)
    from = c; w0 = c.width; h0 = c.height
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(from, 0, 0, w, h)
  src.close?.()
  return ctx.getImageData(0, 0, w, h)
}

let worker = null, nextId = 1
const waiting = new Map()
function getWorker() {
  if (worker) return worker
  try {
    worker = new LineArtWorker()
    worker.onmessage = e => {
      const p = waiting.get(e.data.id)
      waiting.delete(e.data.id)
      if (!p) return
      if (e.data.error) p.reject(new Error(e.data.error))
      else p.resolve(e.data.res)
    }
    worker.onerror = () => {
      waiting.forEach(p => p.reject(new Error('worker failed')))
      waiting.clear()
      worker = null
    }
  } catch { worker = null }
  return worker
}

// Traces the picture (ImageData) at a level of detail: in the worker, or —
// without one — here, after letting the screen show the wait first
export async function tracePicture(image, detail) {
  const wk = getWorker()
  if (wk) {
    try {
      return await new Promise((resolve, reject) => {
        const id = nextId++
        waiting.set(id, { resolve, reject })
        // a copy: the picture is traced again with another detail
        const rgba = new Uint8ClampedArray(image.data)
        wk.postMessage({ id, rgba, w: image.width, h: image.height, detail }, [rgba.buffer])
      })
    } catch { /* below, on this thread */ }
  }
  await new Promise(r => setTimeout(r, 60))
  return toColoringPage(image.data, image.width, image.height, detail)
}

// The page as a PNG: black lines on white, as the Mal-Atelier's own pages
export function pageToBlob({ lines, w, h }) {
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  const img = ctx.createImageData(w, h)
  for (let i = 0, p = 0; i < lines.length; i++, p += 4) {
    const v = lines[i] ? 0 : 255
    img.data[p] = v; img.data[p + 1] = v; img.data[p + 2] = v; img.data[p + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return new Promise(res => canvas.toBlob(res, 'image/png'))
}
