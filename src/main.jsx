import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import './index.css'
import './styles/pixel.css'

// The outer boundary: should anything outside a game fail, the child sees
// Lumi and a restart button instead of a white page.
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary moduleId="app" onReload={() => window.location.reload()}>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
)
