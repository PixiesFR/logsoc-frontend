import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi, usersApi } from '../../api'
import { usePermissions } from '../../hooks/usePermissions'
import { ShieldCheck } from 'lucide-react'

interface CustomTooltipProps {
  active?: boolean
  payload?: { payload: PolicyReadRateData }[]
}

interface PolicyReadRateData {
  name: string
  read: number
  unread: number
  total: number
  readPct: number
  unreadPct: number
}

function PolicyReadTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div
      style={{
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '8px 12px',
        fontSize: '12px',
        maxWidth: '300px',
      }}
    >
      <div style={{ color: 'var(--color-text-primary)', fontWeight: 600, marginBottom: '4px' }}>
        {d.name}
      </div>
      <div style={{ color: 'var(--color-success)' }}>
        {d.readPct}% {d.read}/{d.total}
      </div>
      <div style={{ color: 'var(--color-warning)' }}>
        {d.unreadPct}% {d.unread}/{d.total}
      </div>
    </div>
  )
}

export function PolicyReadRateWidget() {
  const { t } = useTranslation()
  const { canView } = usePermissions()

  // Access control: only superadmin, admin, compliance_officer
  const allowed = canView('compliance_officer')

  const { data: policies, isLoading } = useQuery({
    queryKey: ['governance', 'policies', 'active-for-diffusion'],
    queryFn: () => governanceApi.policies({ status: 'published' }).then((r) => r.data),
    enabled: allowed,
  })

  const { data: users } = useQuery({
    queryKey: ['users', 'list-for-diffusion'],
    queryFn: () => usersApi.list().then((r) => r.data),
    enabled: allowed,
  })

  // Fetch acknowledgments for each active policy
  const policyList = (Array.isArray(policies) ? policies : []) as Record<string, unknown>[]
  const userList = (Array.isArray(users) ? users : []) as Record<string, unknown>[]

  const userNameMap = new Map<number, string>()
  for (const u of userList) {
    const uid = Number(u.id)
    const name = String(u.display_name || u.username || `User ${uid}`)
    userNameMap.set(uid, name)
  }

  // For each policy, fetch its acknowledgments
  const ackQueries = useQuery({
    queryKey: ['governance', 'policies', 'acknowledgments-batch', policyList.map((p) => p.id).join(',')],
    queryFn: async () => {
      const results: Record<number, Record<string, unknown>[]> = {}
      await Promise.all(
        policyList.map(async (p) => {
          const pid = Number(p.id)
          try {
            const r = await governanceApi.policyAcknowledgments(pid)
            results[pid] = (Array.isArray(r.data) ? r.data : []) as Record<string, unknown>[]
          } catch {
            results[pid] = []
          }
        })
      )
      return results
    },
    enabled: allowed && policyList.length > 0,
  })

  if (!allowed) {
    return (
      <div
        style={{
          height: 280,
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <ShieldCheck size={32} style={{ color: 'var(--color-text-secondary)' }} />
        <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0, textAlign: 'center' }}>
          {t('governance.policies.diffusion.accessDenied')}
        </p>
      </div>
    )
  }

  // Build chart data
  const ackData = ackQueries.data ?? {}
  const chartData: PolicyReadRateData[] = policyList
    .map((p) => {
      const pid = Number(p.id)
      const title = String(p.title ?? '')
      const recipients = (Array.isArray(p.recipients) ? p.recipients : []) as number[]
      const acks = ackData[pid] ?? []
      const ackUserIds = new Set(acks.map((a) => Number(a.user_id)))
      const total = recipients.length
      const read = recipients.filter((uid) => ackUserIds.has(uid)).length
      const unread = total - read
      const readPct = total > 0 ? Math.round((read / total) * 100) : 0
      const unreadPct = 100 - readPct
      return { name: title, read, unread, total, readPct, unreadPct }
    })
    // Filter out policies with no recipients
    .filter((d) => d.total > 0)
    // Sort by read rate ascending (least read on top)
    .sort((a, b) => a.readPct - b.readPct)

  return (
    <div
      style={{
        height: 280,
        borderRadius: '12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-secondary)',
        padding: '20px',
      }}
    >
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={16} style={{ color: 'var(--color-accent)' }} />
        <h3
          style={{
            fontSize: '14px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {t('governance.policies.diffusion.widgetTitle')}
        </h3>
      </div>
      {isLoading || ackQueries.isLoading ? (
        <div className="skeleton" style={{ height: '180px', width: '100%', borderRadius: '4px' }} />
      ) : chartData.length === 0 ? (
        <div
          style={{
            height: 180,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
            fontSize: '14px',
          }}
        >
          {t('governance.policies.diffusion.noData')}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} layout="vertical" barSize={18}>
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={{ stroke: 'var(--color-border)' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: 'var(--color-text-secondary)', fontSize: 10 }}
              axisLine={{ stroke: 'var(--color-border)' }}
              tickLine={{ stroke: 'var(--color-border)' }}
              width={120}
            />
            <Tooltip content={<PolicyReadTooltip />} cursor={{ fill: 'var(--color-bg-hover)' }} />
            <Bar dataKey="readPct" stackId="a" fill="var(--color-success)" radius={[0, 0, 0, 0]} />
            <Bar dataKey="unreadPct" stackId="a" fill="var(--color-warning)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}