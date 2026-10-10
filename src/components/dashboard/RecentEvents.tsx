import { useTranslation } from '../../i18n/useTranslation'
import { EmptyState } from '../ui/EmptyState'
import { AlertCircle, Info, ShieldAlert } from 'lucide-react'

interface RecentEvent {
  id: number
  type: string
  message: string
  timestamp: string
  severity?: string
  tags?: string[]
}

interface RecentEventsProps {
  events: RecentEvent[]
  loading?: boolean
}

function getSeverityColor(severity?: string): string {
  if (severity === 'critical' || severity === 'high') return 'var(--color-danger)'
  if (severity === 'warning' || severity === 'medium') return 'var(--color-warning)'
  if (severity === 'notice' || severity === 'low' || severity === 'info') return 'var(--color-success)'
  return 'var(--color-text-secondary)'
}

function getTypeIcon(type: string) {
  if (type === 'alert' || type === 'security') return <ShieldAlert size={16} />
  if (type === 'error') return <AlertCircle size={16} />
  return <Info size={16} />
}

function timeAgo(timestamp: string): string {
  const now = Date.now()
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T')
  const then = new Date(normalized).getTime()
  const diffMs = now - then
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 0 || diffSec < 60) return `${Math.max(0, diffSec)}s`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH}h`
  const diffD = Math.floor(diffH / 24)
  return `${diffD}d`
}

export function RecentEvents({ events, loading = false }: RecentEventsProps) {
  const { t } = useTranslation()

  // Filter out operational noise tagged self-noise (AppArmor ALLOWED from logsoc-agent, ticket #56)
  const filteredEvents = events.filter(
    (event) => !event.tags?.includes('self-noise'),
  )

  if (loading) {
    return (
      <div
        style={{
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          padding: '20px',
        }}
      >
        <div className="skeleton" style={{ height: '14px', width: '140px', borderRadius: '4px', marginBottom: '16px' }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
            <div className="skeleton" style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: '12px', width: '80%', borderRadius: '4px', marginBottom: '4px' }} />
              <div className="skeleton" style={{ height: '10px', width: '40%', borderRadius: '4px' }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (filteredEvents.length === 0) {
    return (
      <div
        style={{
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          padding: '20px',
        }}
      >
        <EmptyState
          title={t('common.noData')}
          icon={<Info size={32} />}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        padding: '20px',
      }}
    >
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--color-text-primary)',
          marginBottom: '12px',
        }}
      >
        {t('dashboard.recentActivity')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredEvents.map((event) => (
          <div
            key={event.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '8px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span style={{ color: getSeverityColor(event.severity), flexShrink: 0, marginTop: '2px' }}>
              {getTypeIcon(event.type)}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {event.message}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                {timeAgo(event.timestamp)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}