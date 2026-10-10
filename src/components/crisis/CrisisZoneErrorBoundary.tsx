/**
 * CrisisZoneErrorBoundary — Error Boundary for individual War Room zones.
 * Ticket #46 (reopen) — prevents white screen when backend returns 404.
 *
 * Wraps each zone (Timeline / Checklist / Contacts) so that a render error
 * in one zone never crashes the entire War Room. The fallback uses the crisis
 * theme (CSS variables) and a localized message.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface CrisisZoneErrorBoundaryProps {
  children: ReactNode
  /** Localized message shown in the fallback UI. */
  fallbackMessage: string
  /** Zone label shown in the fallback header. */
  zoneLabel: string
}

interface CrisisZoneErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class CrisisZoneErrorBoundary extends Component<
  CrisisZoneErrorBoundaryProps,
  CrisisZoneErrorBoundaryState
> {
  constructor(props: CrisisZoneErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): CrisisZoneErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('[CrisisZoneErrorBoundary]', this.props.zoneLabel, error, errorInfo)
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="warroom-zone">
          <div className="warroom-zone-header">
            <span style={{ color: 'var(--color-crisis-danger)' }}>⚠</span>
            {this.props.zoneLabel}
          </div>
          <div className="warroom-zone-content">
            <div className="warroom-zone-error-fallback">
              <p style={{ color: 'var(--color-crisis-danger)', fontSize: '14px', fontWeight: 600 }}>
                {this.props.fallbackMessage}
              </p>
              {this.state.error?.message && (
                <p
                  style={{
                    color: 'var(--color-crisis-border)',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    marginTop: '8px',
                    wordBreak: 'break-word',
                  }}
                >
                  {this.state.error.message}
                </p>
              )}
              <button
                className="warroom-btn"
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{ marginTop: '12px', fontSize: '12px', padding: '6px 12px' }}
              >
                ↻
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}