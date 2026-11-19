import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './styles/pixel.css'

// Offline play (public/sw.js). Only in the built app: in development a
// worker would serve stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const base = import.meta.env.BASE_URL
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${base}sw.js`, { scope: base })
      .then(() => navigator.serviceWorker.ready)
      .then(reg => { if (navigator.onLine !== false) reg.active?.postMessage({ type: 'cache-app' }) })
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
