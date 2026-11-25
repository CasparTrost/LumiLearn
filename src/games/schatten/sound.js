/**
 * Taschenlampen-Jagd: the two sounds the shared kit (sfx.js) does not have,
 * made the same way (Web Audio, no files): a little gasp when the light
 * catches a shadow, and the click of a lamp switched on.
 */
let ac = null

function ctx() {
  if (typeof window === 'undefined') return null
  if (!ac) {
    try { ac = new (window.AudioContext || window.webkitAudioContext)() } catch { return null }
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {})
  return ac
}

/** Call from a touch or a click: browsers start the sound only after one. */
export const wakeSound = () => { ctx() }

function breath(a, t, dur, from, to, vol) {
  const len = Math.max(1, Math.floor(a.sampleRate * dur))
  const buf = a.createBuffer(1, len, a.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = a.createBufferSource()
  src.buffer = buf
  const f = a.createBiquadFilter()
  f.type = 'bandpass'
  f.Q.value = 2.2
  f.frequency.setValueAtTime(from, t)
  f.frequency.exponentialRampToValueAtTime(to, t + dur)
  const g = a.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.25)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f); f.connect(g); g.connect(a.destination)
  src.start(t)
  src.stop(t + dur + 0.02)
}

function tone(a, t, f0, f1, dur, vol, type = 'sine') {
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  o.frequency.exponentialRampToValueAtTime(f1, t + dur)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(a.destination)
  o.start(t)
  o.stop(t + dur + 0.02)
}

/** "Hh!": a quick, breathy intake with a tiny rising "oh" (higher for small things). */
export function gasp(pitch = 1) {
  const a = ctx()
  if (!a) return
  try {
    const t = a.currentTime
    breath(a, t, 0.22, 1400 * pitch, 3600 * pitch, 0.16)
    tone(a, t + 0.02, 520 * pitch, 820 * pitch, 0.16, 0.05, 'triangle')
  } catch { /* no sound */ }
}

/** A switch clicks and the bulb hums on. */
export function lampOn() {
  const a = ctx()
  if (!a) return
  try {
    const t = a.currentTime
    breath(a, t, 0.04, 3000, 2500, 0.22)
    tone(a, t + 0.03, 880, 1320, 0.22, 0.09)
    tone(a, t + 0.05, 1760, 2640, 0.18, 0.03)
  } catch { /* no sound */ }
}
