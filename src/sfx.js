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

// ── The animal band ("Tier-Band", games/ChoiceGame.jsx) ─────────────────────
// A band needs steady time: its notes are given a moment on the audio clock
// (sfx.bandClock()) instead of "now plus a delay", and they all go through
// one bus, so the whole band can fall silent at once (sfx.bandHush()).
// Every pitched voice sits on C major pentatonic (C D E G A): whichever
// animals play together, it sounds good.

let _bus = null        // { ac, gain, comp }: where the band plays into
let _noise = null      // { ac, buf }: one second of white noise, made once

function bandBus(ac) {
  if (_bus && _bus.ac === ac) return _bus.gain
  const gain = ac.createGain()
  gain.gain.value = 0.9
  // a soft ceiling for the moments when everybody plays at once
  const comp = ac.createDynamicsCompressor()
  comp.threshold.value = -16
  comp.knee.value = 14
  comp.ratio.value = 5
  comp.attack.value = 0.004
  comp.release.value = 0.14
  gain.connect(comp)
  comp.connect(ac.destination)
  _bus = { ac, gain, comp }
  return gain
}

function noiseBuffer(ac) {
  if (_noise && _noise.ac === ac) return _noise.buf
  const buf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  _noise = { ac, buf }
  return buf
}

// A gain that swells to `vol` within `attack` seconds and dies away by t + dur
function shape(ac, out, t, attack, dur, vol) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  g.connect(out)
  return g
}

// An oscillator from t to t + dur into `out`; f1 makes it slide there within `slide` seconds
function wave(ac, out, type, t, dur, f0, f1 = f0, slide = dur) {
  const o = ac.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f0, t)
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + slide)
  o.connect(out)
  o.start(t)
  o.stop(t + dur + 0.03)
  return o
}

function filter(ac, out, type, freq, q = 0.8) {
  const f = ac.createBiquadFilter()
  f.type = type
  f.frequency.value = freq
  f.Q.value = q
  f.connect(out)
  return f
}

function hiss(ac, out, t, dur) {
  const src = ac.createBufferSource()
  src.buffer = noiseBuffer(ac)
  src.connect(out)
  // not the same grain of noise every time
  src.start(t, Math.random() * 0.4, dur + 0.03)
}

// One voice per instrument: (audio context, where to, when, how loud[, pitch])
const BAND = {
  /** frog — a big soft drum: "bum" */
  drum(ac, out, t, v) {
    wave(ac, shape(ac, out, t, 0.004, 0.28, 0.45 * v), 'sine', t, 0.28, 196, 65.4, 0.17)
    // an octave up, so a phone's small speaker has something to play
    wave(ac, shape(ac, out, t, 0.003, 0.13, 0.14 * v), 'triangle', t, 0.13, 392, 130.8, 0.1)
    hiss(ac, filter(ac, shape(ac, out, t, 0.001, 0.04, 0.1 * v), 'lowpass', 1400), t, 0.04)
  },
  /** bear — a plucked bass: "dumm" (C3) */
  bass(ac, out, t, v) {
    const lp = filter(ac, shape(ac, out, t, 0.01, 0.46, 0.36 * v), 'lowpass', 560, 0.9)
    wave(ac, lp, 'sawtooth', t, 0.46, 130.81)
    wave(ac, shape(ac, out, t, 0.01, 0.34, 0.2 * v), 'sine', t, 0.34, 261.63)
  },
  /** pig — a shaker: "tschak" */
  maraca(ac, out, t, v) {
    const hp = filter(ac, out, 'highpass', 5200, 0.7)
    hiss(ac, shape(ac, hp, t, 0.012, 0.09, 0.34 * v), t, 0.09)
    hiss(ac, shape(ac, hp, t + 0.085, 0.004, 0.05, 0.2 * v), t + 0.085, 0.05)
  },
  /** monkey — two cymbals: "tschsch" */
  cymbal(ac, out, t, v) {
    hiss(ac, filter(ac, shape(ac, out, t, 0.002, 0.5, 0.17 * v), 'bandpass', 7200, 0.6), t, 0.5)
    const ring = filter(ac, shape(ac, out, t, 0.002, 0.3, 0.03 * v), 'highpass', 2400)
    wave(ac, ring, 'square', t, 0.3, 2637)
    wave(ac, ring, 'square', t, 0.3, 3951)
  },
  /** cat — a little bell: "pling" (E6) */
  bell(ac, out, t, v) {
    wave(ac, shape(ac, out, t, 0.003, 0.75, 0.17 * v), 'sine', t, 0.75, 1318.5)
    wave(ac, shape(ac, out, t, 0.003, 0.4, 0.045 * v), 'sine', t, 0.4, 2637)
    wave(ac, shape(ac, out, t, 0.002, 0.22, 0.035 * v), 'sine', t, 0.22, 3640)
  },
  /** mouse — a xylophone bar: "plock" (C6) */
  xylo(ac, out, t, v) {
    wave(ac, shape(ac, out, t, 0.002, 0.24, 0.26 * v), 'sine', t, 0.24, 1046.5)
    wave(ac, shape(ac, out, t, 0.002, 0.06, 0.07 * v), 'sine', t, 0.06, 4186)
    wave(ac, shape(ac, out, t, 0.003, 0.14, 0.07 * v), 'triangle', t, 0.14, 523.25)
  },
  /** cow — a cowbell: "tonk" (D5 with A5) */
  cowbell(ac, out, t, v) {
    const bp = filter(ac, shape(ac, out, t, 0.002, 0.3, 0.2 * v), 'bandpass', 900, 1.1)
    wave(ac, bp, 'square', t, 0.3, 587.33)
    wave(ac, bp, 'square', t, 0.3, 880)
  },
  /** bird — two quick chirps: "tiu-tiu" (G6 to C7, A6 to D7) */
  whistle(ac, out, t, v) {
    wave(ac, shape(ac, out, t, 0.012, 0.13, 0.12 * v), 'sine', t, 0.13, 1568, 2093, 0.07)
    wave(ac, shape(ac, out, t + 0.14, 0.012, 0.15, 0.11 * v), 'sine', t + 0.14, 0.15, 1760, 2349.3, 0.07)
  },
  /** duck — a nasal honk: "quack" */
  quack(ac, out, t, v) {
    const g = shape(ac, out, t, 0.015, 0.26, 1.2 * v)
    const o = wave(ac, filter(ac, g, 'bandpass', 1050, 3), 'sawtooth', t, 0.26, 330, 247, 0.2)
    o.connect(filter(ac, shape(ac, out, t, 0.015, 0.22, 0.4 * v), 'bandpass', 2300, 4))
  },
  /** elephant — a trumpet: "taa" (C5) */
  trumpet(ac, out, t, v) {
    const g = ac.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.15 * v, t + 0.03)
    g.gain.setValueAtTime(0.13 * v, t + 0.2)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    g.connect(out)
    wave(ac, filter(ac, g, 'lowpass', 2100, 1.2), 'sawtooth', t, 0.34, 494, 523.25, 0.035)
  },
  /** hare — two sticks of wood: "tick-tock" (A5, then E5) */
  wood(ac, out, t, v) {
    ;[[0, 880, 0.42], [0.13, 659.25, 0.36]].forEach(([d, f, vol]) => {
      wave(ac, shape(ac, out, t + d, 0.001, 0.08, vol * v), 'sine', t + d, 0.08, f)
      wave(ac, shape(ac, out, t + d, 0.001, 0.03, 0.1 * v), 'sine', t + d, 0.03, f * 2.67)
      hiss(ac, filter(ac, shape(ac, out, t + d, 0.001, 0.014, 0.12 * v), 'bandpass', 2600, 1), t + d, 0.014)
    })
  },
  /** lion — a plucked guitar string: "plong" (E4) */
  guitar(ac, out, t, v) {
    const lp = filter(ac, shape(ac, out, t, 0.004, 0.55, 0.2 * v), 'lowpass', 3200, 1)
    lp.frequency.setValueAtTime(3200, t)
    lp.frequency.exponentialRampToValueAtTime(500, t + 0.3)
    wave(ac, lp, 'sawtooth', t, 0.55, 329.63)
    wave(ac, shape(ac, out, t, 0.004, 0.4, 0.14 * v), 'triangle', t, 0.4, 329.63)
  },
  /** the tune of the finale: a soft marimba at any pitch */
  tune(ac, out, t, v, f = 523.25) {
    wave(ac, shape(ac, out, t, 0.004, 0.34, 0.2 * v), 'sine', t, 0.34, f)
    wave(ac, shape(ac, out, t, 0.002, 0.06, 0.04 * v), 'sine', t, 0.06, f * 4)
    wave(ac, shape(ac, out, t, 0.004, 0.2, 0.06 * v), 'triangle', t, 0.2, f / 2)
  },
}

/** The band's instruments by name. */
export const BAND_VOICES = Object.keys(BAND)

/** One note of `name` into any audio graph (tests render it without a speaker). */
export function bandVoice(ac, out, name, t, vol = 1, freq) {
  BAND[name]?.(ac, out, t, vol, freq)
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

  // ── The animal band (see BAND above). None of these makes Lumi react.

  /**
   * One note of an instrument of the band (BAND_VOICES: drum, bass, maraca,
   * cymbal, bell, xylo, cowbell, whistle, quack, trumpet, wood, guitar, tune).
   * `at` is a moment on the audio clock (sfx.bandClock()); 0 or a moment
   * gone by means now. `freq` sets the pitch of 'tune' only.
   */
  band(name, at = 0, vol = 1, freq) {
    const ac = getCtx()
    if (!ac || !BAND[name]) return
    try {
      BAND[name](ac, bandBus(ac), Math.max(ac.currentTime, Number(at) || 0), vol, freq)
    } catch { /* ignore */ }
  },

  /** The audio clock in seconds, or null while no sound can play (no audio, or not yet unlocked by a touch). */
  bandClock() {
    const ac = getCtx()
    return ac && ac.state === 'running' ? ac.currentTime : null
  },

  /** Seconds between a moment on the audio clock and the sound reaching the ear (0 when unknown). */
  bandLatency() {
    const l = _ctx ? Number(_ctx.outputLatency) || Number(_ctx.baseLatency) || 0 : 0
    return Math.max(0, Math.min(0.2, l))
  },

  /** The band falls silent at once: what sounds and what is still to come. */
  bandHush() {
    const bus = _bus
    if (!bus) return
    _bus = null
    try {
      const t = bus.ac.currentTime
      bus.gain.gain.cancelScheduledValues(t)
      bus.gain.gain.setTargetAtTime(0, t, 0.012)
    } catch { /* ignore */ }
    setTimeout(() => { try { bus.gain.disconnect(); bus.comp.disconnect() } catch { /* ignore */ } }, 300)
  },
}
