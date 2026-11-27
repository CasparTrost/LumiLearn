import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './styles/pixel.css'
import { installErrorLog } from './lib/errorLog.js'
import { SAVE_KEY } from './AppContext.jsx'

// errors outside drawing (tap handlers, timers, promises) go into the
// parent area's error log too, named by the game on screen (GameScreen
// marks itself with data-module)
installErrorLog(() => document.querySelector('[data-module]')?.getAttribute('data-module') ?? 'app')

// The figures the children on this device have (the chick always): the
// worker saves the clothes painted onto these only (sprites/wardrobe/worn/
// <figure>/, half of all pictures); another figure's come when first shown.
function ownedFigures() {
  try {
    const save = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null')
    return [...new Set(['chick', ...Object.values(save?.profiles ?? {}).flatMap(p => (Array.isArray(p?.shapes) ? p.shapes : []))])]
  } catch { return ['chick'] }
}

// Offline play (public/sw.js). Only in the built app: in development a
// worker would serve stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      .then(() => navigator.serviceWorker.ready)
      .then(reg => { if (navigator.onLine !== false) reg.active?.postMessage({ type: 'cache-app', figures: ownedFigures() }) })
      .catch(() => { /* no offline play, the app works as before */ })
  })
}

// The outer boundary: should anything outside a game fail, the child sees
// Lumi and a restart button instead of a white page.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary moduleId="app" onReload={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
