/**
 * LumiLearn SFX — Web Audio API synthesizer.
 * No external files needed. Works in all modern browsers.
 * Auto-resumes AudioContext on first user interaction.
 */

let _ctx = null

function getCtx() {
  if (typeof window === 'undefined') return null
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext || window.webkitAudioContext)()
    } catch {
      return null
    }
  }
  if (_ctx.state === 'suspended') _ctx.resume().catch(() => {})
  return _ctx
}

/** Play a single oscillator tone */
function tone(freq, type, delay, dur, vol = 0.26) {
  const ac = getCtx()
  if (!ac) return
  try {
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.connect(g)
    g.connect(ac.destination)
    osc.type = type
    const t = ac.currentTime + delay
    osc.frequency.setValueAtTime(freq, t)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  } catch { /* ignore */ }
}

export const sfx = {
  /** Rising chime — correct answer */
  correct() {
    tone(523, 'sine', 0,    0.12, 0.22)
    tone(659, 'sine', 0.08, 0.14, 0.20)
    tone(784, 'sine', 0.17, 0.18, 0.18)
  },

  /** Low buzz — wrong answer */
  wrong() {
    tone(280, 'sawtooth', 0,    0.13, 0.14)
    tone(220, 'sawtooth', 0.09, 0.17, 0.10)
  },

  /** Quick click — card flip */
  flip() {
    tone(900, 'sine', 0,    0.04, 0.13)
    tone(600, 'sine', 0.03, 0.07, 0.09)
  },

  /** Sparkly ascending arp — memory match */
  match() {
    tone(660,  'sine', 0,    0.10, 0.22)
    tone(880,  'sine', 0.09, 0.13, 0.22)
    tone(1100, 'sine', 0.19, 0.16, 0.20)
    tone(1320, 'sine', 0.30, 0.20, 0.16)
  },

  /** Soft low wobble — memory mismatch */
  mismatch() {
    tone(320, 'triangle', 0,    0.10, 0.10)
    tone(260, 'triangle', 0.09, 0.14, 0.08)
  },

  /** Escalating arp — combo streak (n = streak count) */
  combo(n) {
    const steps = Math.min(n, 6)
    for (let i = 0; i < steps; i++) {
      tone(440 * Math.pow(1.18, i), 'sine', i * 0.075, 0.12, 0.22)
    }
  },

  /** Victory fanfare — game complete */
  complete() {
    const melody = [523, 659, 784, 1047, 1319, 1568]
    melody.forEach((f, i) => {
      tone(f,     'sine',     i * 0.11, 0.28, 0.20)
      tone(f * 2, 'triangle', i * 0.11, 0.12, 0.05)
    })
  },

  /** Bubble pop */
  pop() {
    tone(1400, 'sine', 0,    0.04, 0.28)
    tone(900,  'sine', 0.03, 0.08, 0.18)
  },

  /** Coin / star collect */
  coin() {
    tone(1046, 'sine', 0,    0.08, 0.20)
    tone(1318, 'sine', 0.06, 0.10, 0.18)
  },
}
