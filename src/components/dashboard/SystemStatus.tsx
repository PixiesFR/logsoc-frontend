import { useTranslation } from '../../i18n/useTranslation'
import { Badge } from '../ui/Badge'
import { GlossaryTooltip } from '../ui/GlossaryTooltip'
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react'

interface SystemStatusProps {
  status: {
    api: string
    mysql: string
    clickhouse: string
    ollama?: string
  }
}

type StatusLevel = 'OK' | 'ERROR' | 'DEGRADED'

function getVariant(status: string): 'success' | 'danger' | 'warning' {
  if (status === 'OK') return 'success'
  if (status === 'ERROR') return 'danger'
  return 'warning'
}

function getIcon(status: string) {
  if (status === 'OK') return <CheckCircle size={14} />
  if (status === 'ERROR') return <XCircle size={14} />
  return <AlertTriangle size={14} />
}

export function SystemStatus({ status }: SystemStatusProps) {
  const { t } = useTranslation()

  const entries: { label: string; value: string; glossary?: string }[] = [
    { label: 'API', value: status.api },
    { label: 'MySQL', value: status.mysql },
    { label: 'ClickHouse', value: status.clickhouse, glossary: 'glossary.clickhouse' },
  ]

  if (status.ollama) {
    entries.push({ label: 'Ollama', value: status.ollama })
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
        {t('dashboard.systemHealth')}
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {entries.map((entry) => (
          <div
            key={entry.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 0',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>
              {entry.glossary
                ? <GlossaryTooltip term={entry.glossary}>{entry.label}</GlossaryTooltip>
                : entry.label
              }
            </span>
            <Badge variant={getVariant(entry.value)} size="sm">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                {getIcon(entry.value)}
                {entry.value as StatusLevel}
              </span>
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}