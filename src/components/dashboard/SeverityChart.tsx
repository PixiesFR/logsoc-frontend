import { useTranslation } from '../../i18n/useTranslation'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface SeverityChartProps {
  data: { severity: string; count: number }[]
  loading?: boolean
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

const severityColors: Record<string, string> = {
  critical: 'var(--color-danger)',
  high: 'var(--color-warning)',
  medium: 'var(--color-info)',
  low: 'var(--color-success)',
  notice: 'var(--color-success)',
  info: 'var(--color-success)',
  debug: 'var(--color-text-secondary)',
}

function SeverityTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '12px',
      }}
    >
      <div style={{ color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{label}</div>
      <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{payload[0].value}</div>
    </div>
  )
}

export function SeverityChart({ data, loading = false }: SeverityChartProps) {
  const { t } = useTranslation()

  if (loading) {
    return (
      <div
        style={{
          height: 250,
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          padding: '20px',
        }}
      >
        <div className="skeleton" style={{ height: '14px', width: '120px', borderRadius: '4px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '180px', width: '100%', borderRadius: '4px' }} />
      </div>
    )
  }

  return (
    <div
      style={{
        height: 250,
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
        {t('events.stats')}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="severity"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={{ stroke: 'var(--color-border)' }}
          />
          <Tooltip content={<SeverityTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry) => (
              <Cell key={entry.severity} fill={severityColors[entry.severity] ?? 'var(--color-accent)'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}