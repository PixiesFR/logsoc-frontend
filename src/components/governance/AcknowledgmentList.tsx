import { Badge } from '../ui/Badge'
import { useTranslation } from '../../i18n/useTranslation'

export interface AcknowledgmentEntry {
  user_id: number
  user_name: string
  read_at: string | null
}

interface AcknowledgmentListProps {
  acknowledgments: AcknowledgmentEntry[]
}

export function AcknowledgmentList({ acknowledgments }: AcknowledgmentListProps) {
  const { t } = useTranslation()

  // Sort: unread first, then read by date descending
  const sorted = [...acknowledgments].sort((a, b) => {
    const aRead = a.read_at
    const bRead = b.read_at
    if (!aRead && bRead) return -1
    if (aRead && !bRead) return 1
    if (!aRead && !bRead) return 0
    return new Date(String(bRead)).getTime() - new Date(String(aRead)).getTime()
  })

  if (sorted.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '24px',
          color: 'var(--color-text-secondary)',
          fontSize: '14px',
        }}
      >
        {t('governance.policies.diffusion.noRecipients')}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {sorted.map((entry) => {
        const readDate = entry.read_at
          ? new Date(entry.read_at).toLocaleString()
          : null
        return (
          <div
            key={entry.user_id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: '8px',
              border: '1px solid var(--color-border)',
              background: 'var(--color-bg-primary)',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                color: 'var(--color-text-primary)',
                fontWeight: 500,
              }}
            >
              {entry.user_name}
            </span>
            {readDate ? (
              <span
                style={{
                  fontSize: '13px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {readDate}
              </span>
            ) : (
              <Badge variant="danger" size="sm">
                {t('governance.policies.diffusion.unread')}
              </Badge>
            )}
          </div>
        )
      })}
    </div>
  )
}