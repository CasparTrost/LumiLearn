// src/tts.js — zentraler Speech-Synthesis-Helfer

let _currentUtterance = null

export const speak = (text, { rate = 0.85, pitch = 1.05, lang } = {}) => {
  if (!window.speechSynthesis || !text) return
  window.speechSynthesis.cancel()
  // Strip emoji and non-printable characters
  const clean = text.replace(/[\u{1F300}-\u{1FFFF}]/gu, '').replace(/[^\w\säöüÄÖÜß.,!?]/g, '').trim()
  if (!clean) return
  const u = new SpeechSynthesisUtterance(clean)
  u.rate = rate
  u.pitch = pitch
  u.lang = lang || (document.documentElement.lang === 'en' ? 'en-GB' : 'de-DE')
  _currentUtterance = u
  window.speechSynthesis.speak(u)
}

export const cancelSpeech = () => {
  if (window.speechSynthesis) window.speechSynthesis.cancel()
  _currentUtterance = null
}
