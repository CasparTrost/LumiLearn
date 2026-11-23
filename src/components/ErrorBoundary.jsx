import React from 'react'
import { narrate } from '../narrator.js'
import { PixelLumi } from './PixelUI.jsx'
import { logError } from '../lib/errorLog.js'
import { line } from '../lib/lumiLines.js'

// A game that could not be loaded is not a broken game. Without a
// connection the old message claimed "Dieses Spiel hat einen kleinen
// Fehler"; now the child hears that Lumi needs the internet.
export const isLoadError = err =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) ||
  /dynamically imported module|Importing a module script failed|Loading chunk|Failed to fetch/i.test(String(err?.message ?? err))

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('LumiLearn Error:', error, info)
    const offline = isLoadError(error)
    narrate([line(offline ? 'menue/internet-fehler' : 'menue/gestolpert')])
    if (offline) return
    logError(error, this.props.moduleId || 'unknown')
  }

  retry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onRetry?.()
  }

  render() {
    if (this.state.hasError) {
      const offline = isLoadError(this.state.error)
      return (
        <div style={{
          flex: 1, minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24, background: 'var(--bg)',
        }}>
          <div className="px-panel" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
            padding: '24px 22px', maxWidth: 420, width: '100%', textAlign: 'center',
          }}>
            <PixelLumi size={96} />
            <h3 style={{ color: 'var(--px-ink)', fontFamily: 'var(--font-heading)', fontSize: 24, margin: 0 }}>
              {offline ? 'Keine Internetverbindung' : (this.props.title || 'Ups, Lumi ist gestolpert!')}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--font-body)', fontSize: 17, margin: 0, fontWeight: 600 }}>
              {offline
                ? 'Lumi braucht Internet, um dieses Spiel zu holen. Lumi wartet auf dich!'
                : (this.props.message || 'Etwas ist schiefgegangen. Versuch es nochmal!')}
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="px-btn px-btn--green px-btn--md" onClick={this.props.onReload ?? this.retry}>
                🔄 Nochmal
              </button>
              {this.props.onHome && (
                <button className="px-btn px-btn--parch px-btn--md" onClick={this.props.onHome}>
                  🏠 Startseite
                </button>
              )}
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
