import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  fallbackLabel?: string
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log to console so the user can see what went wrong
    console.error('[ErrorBoundary] Page render error:', error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              color: 'var(--color-danger)',
              fontSize: '48px',
              marginBottom: '16px',
            }}
          >
            ⚠️
          </div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 600,
              color: 'var(--color-text-primary)',
              marginBottom: '8px',
            }}
          >
            {this.props.fallbackLabel ?? 'Erreur de chargement'}
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              maxWidth: '500px',
              marginBottom: '16px',
              fontFamily: 'monospace',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error?.message ?? 'Une erreur inattendue est survenue'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 16px',
              fontSize: '14px',
              fontWeight: 500,
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-secondary)',
              color: 'var(--color-text-primary)',
              cursor: 'pointer',
            }}
          >
            Réessayer
          </button>
        </div>
      )
    }
    return this.props.children
  }
}