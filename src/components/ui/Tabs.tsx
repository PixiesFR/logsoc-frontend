import { Badge } from './Badge'

interface TabItem {
  key: string
  label: string
  count?: number
}

interface TabsProps {
  tabs: TabItem[]
  active: string
  onChange: (key: string) => void
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: '0',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: isActive ? 600 : 400,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <Badge variant="default" size="sm">
                {tab.count}
              </Badge>
            )}
          </button>
        )
      })}
    </div>
  )
}