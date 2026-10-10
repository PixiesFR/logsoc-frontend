import { useAppStore } from '../../stores'
import { useTranslation } from '../../i18n/useTranslation'
import { Search } from 'lucide-react'

const TIME_RANGES = ['15min', '1h', '6h', '24h', '7d', '30d'] as const

interface HeaderProps {
  showSearch?: boolean
  showTimeFilter?: boolean
}

export function Header({ showSearch = false, showTimeFilter = false }: HeaderProps) {
  const { t } = useTranslation()
  const timeRange = useAppStore((s) => s.timeRange)
  const setTimeRange = useAppStore((s) => s.setTimeRange)

  // If nothing to show, don't render the header at all
  if (!showSearch && !showTimeFilter) {
    return null
  }

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '48px',
        padding: '0 20px',
        borderBottom: '1px solid var(--color-border)',
        backgroundColor: 'var(--color-bg-secondary)',
        gap: '12px',
      }}
    >
      {/* Search — only when showSearch is true */}
      {showSearch && (
        <div
          className="header-search"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            backgroundColor: 'var(--color-bg-primary)',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            flex: 1,
            maxWidth: '360px',
          }}
        >
          <Search size={16} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
          <input
            type="text"
            placeholder={t('common.search') + '...'}
            style={{
              background: 'none',
              border: 'none',
              outline: 'none',
              color: 'var(--color-text-primary)',
              fontSize: '13px',
              width: '100%',
            }}
          />
        </div>
      )}

      {/* Spacer to push time filter right when no search */}
      {showSearch ? null : <div style={{ flex: 1 }} />}

      {/* Time Range — only when showTimeFilter is true */}
      {showTimeFilter && (
        <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--color-bg-primary)', borderRadius: '6px', padding: '2px' }} className="time-filter-group">
          {TIME_RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                fontWeight: timeRange === range ? 600 : 400,
                color: timeRange === range ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                backgroundColor: timeRange === range ? 'var(--color-accent)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {range}
            </button>
          ))}
        </div>
      )}
    </header>
  )
}