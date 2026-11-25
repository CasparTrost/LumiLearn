// Runs lineArt.js off the main thread: Lumi keeps moving while the picture
// is traced. Nothing leaves the device: pixels in, lines out.
import { toColoringPage } from './lineArt.js'

self.onmessage = e => {
  const { id, rgba, w, h, detail } = e.data
  try {
    const res = toColoringPage(rgba, w, h, detail)
    self.postMessage({ id, res }, [res.lines.buffer])
  } catch (err) {
    self.postMessage({ id, error: String(err?.message ?? err) })
  }
}
