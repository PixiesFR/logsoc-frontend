import { useTranslation } from '../../i18n/useTranslation'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'

interface EventsChartProps {
  data: { time: string; count: number }[]
  loading?: boolean
}

interface CustomTooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
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

export function EventsChart({ data, loading = false }: EventsChartProps) {
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
        {t('dashboard.alertTrend')}
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis
            dataKey="time"
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={{ stroke: 'var(--color-border)' }}
          />
          <YAxis
            tick={{ fill: 'var(--color-text-secondary)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--color-border)' }}
            tickLine={{ stroke: 'var(--color-border)' }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--color-accent)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}