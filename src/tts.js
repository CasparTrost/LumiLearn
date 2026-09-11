// src/tts.js — zentraler Speech-Synthesis-Helfer

let _currentUtterance = null

export const speak = (text, { rate = 0.85, pitch = 1.05, lang, onEnd } = {}) => {
  if (!window.speechSynthesis || !text) { onEnd?.(); return }
  window.speechSynthesis.cancel()
  // Strip emoji and non-printable characters
  const clean = text.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').replace(/[^\w\säöüÄÖÜß.,!?]/g, '').trim()
  if (!clean) { onEnd?.(); return }
  const u = new SpeechSynthesisUtterance(clean)
  u.rate = rate
  u.pitch = pitch
  u.lang = lang || (document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE')
  // Lets a caller sequence something after the speech instead of guessing a
  // duration — voice.chain needs this to hand over cleanly between a spoken
  // fallback and the next recorded track.
  if (onEnd) {
    u.addEventListener('end', onEnd, { once: true })
    u.addEventListener('error', onEnd, { once: true })
  }
  _currentUtterance = u
  window.speechSynthesis.speak(u)
}

export const cancelSpeech = () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
  _currentUtterance = null
}
