import React from 'react'

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
    // Store error in localStorage for parent panel debugging
    try {
      const errors = JSON.parse(localStorage.getItem('lumilearn_errors') || '[]')
      errors.unshift({
        ts: new Date().toISOString(),
        message: error.message,
        stack: error.stack?.slice(0, 500),
        module: this.props.moduleId || 'unknown'
      })
      localStorage.setItem('lumilearn_errors', JSON.stringify(errors.slice(0, 20)))
    } catch(e) {}
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '200px', padding: '32px',
          textAlign: 'center', gap: '16px'
        }}>
          <div style={{ fontSize: '48px' }}>🌟</div>
          <h3 style={{ color: '#4A00E0', fontFamily: 'Fredoka, sans-serif', fontSize: '22px', margin: 0 }}>
            {this.props.title || 'Ups, Lumi ist gestolpert!'}
          </h3>
          <p style={{ color: '#666', fontFamily: 'Nunito, sans-serif', fontSize: '16px', margin: 0 }}>
            {this.props.message || 'Dieses Spiel hat einen kleinen Fehler. Versuch es nochmal!'}
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                padding: '12px 24px', background: 'linear-gradient(135deg, #6BCB77, #4A9E52)',
                color: 'white', border: 'none', borderRadius: '16px', cursor: 'pointer',
                fontFamily: 'Fredoka, sans-serif', fontSize: '18px', fontWeight: 600
              }}
            >
              🔄 Nochmal
            </button>
            {this.props.onHome && (
              <button
                onClick={this.props.onHome}
                style={{
                  padding: '12px 24px', background: 'rgba(74,0,224,0.1)',
                  color: '#4A00E0', border: '2px solid rgba(74,0,224,0.3)',
                  borderRadius: '16px', cursor: 'pointer',
                  fontFamily: 'Fredoka, sans-serif', fontSize: '18px', fontWeight: 600
                }}
              >
                🏠 Zum Menü
              </button>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
