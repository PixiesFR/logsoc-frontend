import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface TrendData {
  value: number
  isUp: boolean
}

interface StatCardProps {
  label: string
  value: string | number
  icon?: ReactNode
  color?: string
  trend?: TrendData
  loading?: boolean
}

export function StatCard({ label, value, icon, color, trend, loading = false }: StatCardProps) {
  if (loading) {
    return (
      <div
        style={{
          padding: '20px',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <div
          className="skeleton"
          style={{ height: '12px', width: '60%', borderRadius: '4px', marginBottom: '12px' }}
        />
        <div
          className="skeleton"
          style={{ height: '28px', width: '40%', borderRadius: '4px' }}
        />
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '20px',
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-text-secondary)',
            textTransform: 'uppercase',
          }}
        >
          {label}
        </span>
        {icon && (
          <span style={{ color: color ?? 'var(--color-accent)', display: 'flex' }}>
            {icon}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: 'var(--color-text-primary)',
            lineHeight: 1.2,
          }}
        >
          {value}
        </span>
        {trend && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 600,
              color: trend.isUp ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {trend.isUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            {trend.isUp ? '+' : ''}{trend.value}%
          </span>
        )}
      </div>
    </div>
  )
}