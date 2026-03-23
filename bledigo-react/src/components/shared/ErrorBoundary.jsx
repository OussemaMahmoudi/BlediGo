import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('[BlediGo Error]', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-muted flex items-center justify-center p-6 font-dm">
          <div className="bg-white border border-border rounded-card p-8 max-w-lg w-full shadow-card">
            <div className="w-14 h-14 bg-danger-light rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#E24B4A" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h2 className="font-syne text-xl font-bold text-center text-t1 mb-2">
              Erreur de chargement
            </h2>
            <p className="text-[13.5px] text-t3 text-center mb-4">
              Une erreur est survenue dans cette page.
            </p>
            <div className="bg-danger-light/50 rounded-lg p-3 mb-5 text-[12px] font-mono text-danger break-all">
              {this.state.error?.message || 'Erreur inconnue'}
            </div>
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full py-2.5 bg-primary text-white rounded-btn text-[14px] font-semibold hover:bg-primary-dark transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
