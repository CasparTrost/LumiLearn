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


/** A tone that slides from one pitch to another (boing, whoosh, slide) */
function glide(from, to, type, delay, dur, vol = 0.2) {
  const ac = getCtx()
  if (!ac) return
  try {
    const osc = ac.createOscillator()
    const g   = ac.createGain()
    osc.connect(g)
    g.connect(ac.destination)
    osc.type = type
    const t = ac.currentTime + delay
    osc.frequency.setValueAtTime(from, t)
    osc.frequency.exponentialRampToValueAtTime(to, t + dur)
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.start(t)
    osc.stop(t + dur + 0.02)
  } catch { /* ignore */ }
}

/** A short burst of filtered noise (splash, crunch, whoosh of air) */
function noise(delay, dur, vol = 0.18, freq = 1200, q = 0.8) {
  const ac = getCtx()
  if (!ac) return
  try {
    const len = Math.max(1, Math.floor(ac.sampleRate * dur))
    const buf = ac.createBuffer(1, len, ac.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    const src = ac.createBufferSource()
    src.buffer = buf
    const f = ac.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = freq
    f.Q.value = q
    const g = ac.createGain()
    const t = ac.currentTime + delay
    g.gain.setValueAtTime(vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    src.connect(f); f.connect(g); g.connect(ac.destination)
    src.start(t)
    src.stop(t + dur + 0.02)
  } catch { /* ignore */ }
}

// A major pentatonic scale from C5: any two of its notes sound good one
// after the other, so a run of quick hits is a little melody.
const PENTATONIC = [0, 2, 4, 7, 9]
const PLUCK_BASE  = 523.25
const PLUCK_TOP   = 10   // C7; above that a pluck turns into a squeak

/** Pitch of `step` on the scale of sfx.pluck (not the C major of sfx.note): 0 = C5, 1 = D5, 2 = E5, 3 = G5, 4 = A5, 5 = C6 … */
export function pluckFreq(step) {
  const n = Math.max(0, Math.min(PLUCK_TOP, Math.floor(Number(step) || 0)))
  return PLUCK_BASE * Math.pow(2, Math.floor(n / PENTATONIC.length) + PENTATONIC[n % PENTATONIC.length] / 12)
}

// Games that only play a sound for an answer still let Lumi react
// (components/LumiBuddy.jsx ignores the second of two signals for one answer)
const announce = kind => typeof window !== 'undefined' && window.dispatchEvent(new CustomEvent('lumi:feedback', { detail: kind }))

export const sfx = {
  /** Rising chime — correct answer */
  correct() {
    announce('right')
    tone(523, 'sine', 0,    0.12, 0.22)
    tone(659, 'sine', 0.08, 0.14, 0.20)
    tone(784, 'sine', 0.17, 0.18, 0.18)
  },

  /** Low buzz — wrong answer */
  wrong() {
    announce('wrong')
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
    announce('right')
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

  /** Wall bump — maze */
  bump() {
    tone(140, 'square',   0,    0.07, 0.18)
    tone(90,  'triangle', 0.02, 0.09, 0.12)
  },

  /** Soft footstep — maze */
  step() {
    tone(220, 'triangle', 0, 0.025, 0.05)
  },

  /** Potion pickup — coin + sparkle tail */
  potion() {
    tone(1046, 'sine', 0,    0.08, 0.20)
    tone(1318, 'sine', 0.06, 0.10, 0.18)
    tone(1568, 'sine', 0.14, 0.18, 0.12)
  },

  /** Player hit by dragon */
  hitPlayer() {
    tone(200, 'sawtooth', 0,    0.12, 0.20)
    tone(120, 'sawtooth', 0.10, 0.25, 0.18)
  },

  /** Dragon nearby warning */
  dragonNear() {
    tone(55, 'sawtooth', 0,    0.35, 0.16)
    tone(58, 'sawtooth', 0.02, 0.35, 0.10)
  },
  // ── Game feel (components/play/Juice.jsx). They come too often to be
  // "an answer": neither of them makes Lumi react.

  /** A short pluck on a major pentatonic scale — one good action; step 0 upward, each a note higher */
  pluck(step = 0) {
    const f = pluckFreq(step)
    tone(f,     'triangle', 0, 0.2,  0.2)
    tone(f * 2, 'sine',     0, 0.07, 0.05)
  },

  /** Soft, low bonk — a miss that is no drama */
  bonk() {
    glide(230, 120, 'sine', 0, 0.16, 0.2)
    tone(90, 'triangle', 0, 0.07, 0.08)
  },

  // ── Toy sounds for the play kit (components/play): things react when
  // they are tapped, fed, dropped or thrown. None of them means right or
  // wrong, so none of them makes Lumi react.

  /** Springy boing — something bounces, a character is poked */
  boing() {
    glide(180, 520, 'sine', 0, 0.18, 0.2)
    glide(520, 260, 'sine', 0.16, 0.16, 0.12)
  },

  /** Munch munch — a character eats what it was given */
  chomp() {
    noise(0,    0.06, 0.22, 900, 1.2)
    noise(0.13, 0.06, 0.2,  700, 1.2)
    tone(160, 'square', 0,    0.04, 0.06)
    tone(140, 'square', 0.13, 0.04, 0.05)
  },

  /** Little giggle — tickle a character */
  giggle() {
    ;[0, 0.09, 0.18, 0.27].forEach((d, i) => glide(900 + i * 60, 1300 + i * 80, 'sine', d, 0.07, 0.12))
  },

  /** Whoosh — something flies across */
  whoosh() {
    noise(0, 0.35, 0.16, 600, 0.6)
    glide(300, 900, 'sine', 0, 0.3, 0.04)
  },

  /** Splash — into the water */
  splash() {
    noise(0, 0.3, 0.24, 1800, 0.5)
    noise(0.05, 0.25, 0.12, 600, 0.7)
  },

  /** Slide whistle up — a happy jump */
  slideUp() {
    glide(400, 1200, 'sine', 0, 0.28, 0.16)
  },

  /** Slide whistle down — oops, a funny fall (never for a wrong answer alone) */
  slideDown() {
    glide(1000, 300, 'sine', 0, 0.4, 0.14)
  },

  /** A friendly drum beat (clapping syllables, marching) */
  drum(high = false) {
    glide(high ? 220 : 150, high ? 110 : 60, 'sine', 0, 0.16, 0.34)
    noise(0, 0.05, 0.08, 3000, 0.7)
  },

  /** A tiny burp — a full tummy, the classic giggle-maker */
  burp() {
    glide(140, 90, 'sawtooth', 0, 0.22, 0.09)
    noise(0, 0.2, 0.06, 300, 1)
  },

  /** Short "ta-da!" — something got built, a guest is served */
  tada() {
    tone(523, 'triangle', 0,    0.1,  0.2)
    tone(784, 'triangle', 0.1,  0.3,  0.22)
    tone(1047, 'sine',    0.1,  0.3,  0.08)
  },

  /**
   * One note of a scale: step 0 is middle C, every step one note of C major
   * up (negative steps go down). Rising steps in a row make a little melody
   * (stars connected one after another, things counted).
   */
  note(step = 0, vol = 0.2) {
    const SCALE = [0, 2, 4, 5, 7, 9, 11]
    const s = Math.round(step)
    const f = 261.63 * Math.pow(2, Math.floor(s / 7) + SCALE[((s % 7) + 7) % 7] / 12)
    tone(f,     'sine',     0, 0.34, vol)
    tone(f * 2, 'triangle', 0, 0.16, vol * 0.3)
  },

  /** Magic sparkle — something appears */
  sparkle() {
    ;[1568, 2093, 1760, 2349, 2637].forEach((f, i) => tone(f, 'sine', i * 0.05, 0.12, 0.08))
  },
}
