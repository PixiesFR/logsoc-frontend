import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { grcBridgeApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { Badge } from '../../components/ui'
import { AlertTriangle, Filter } from 'lucide-react'

type AlertFilter = 'all' | 'unresolved' | 'resolved'

const criticalityBadgeVariant = (c: string): 'danger' | 'warning' | 'default' => {
  switch (c) {
    case 'Critique': return 'danger'
    case 'Majeure': return 'warning'
    default: return 'default'
  }
}

interface ComplianceAlert {
  id: number
  requirement_id: number
  ref_id: string
  rule: string
  criticality: string
  asset_id: number
  asset_name: string
  alert_type: string
  severity: string
  message: string
  resolved: boolean
  created_at: string
}

export default function ComplianceAlertsPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<AlertFilter>('unresolved')

  const params: Record<string, string | number> = {}
  if (filter === 'unresolved') params.resolved = 'false'
  if (filter === 'resolved') params.resolved = 'true'

  const { data, isLoading } = useQuery({
    queryKey: ['grcAlerts', filter],
    queryFn: () => grcBridgeApi.alerts(params).then(r => r.data as Record<string, unknown>),
  })

  const items = ((data?.items ?? []) as ComplianceAlert[])

  const resolveMutation = useMutation({
    mutationFn: (id: number) => grcBridgeApi.resolveAlert(id),
    onSuccess: () => {
      toast('success', 'Alerte resolue avec succes')
      qc.invalidateQueries({ queryKey: ['grcAlerts'] })
    },
    onError: () => toast('error', 'Erreur lors de la resolution'),
  })

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        Alertes Conformite
      </h1>

      {/* Filters */}
      <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)', display: 'flex', gap: '12px', alignItems: 'center' }}>
        <Filter size={16} style={{ color: 'var(--color-text-secondary)' }} />
        {(['all', 'unresolved', 'resolved'] as AlertFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: '6px', fontSize: '13px', fontWeight: 500, cursor: 'pointer',
              background: filter === f ? 'var(--color-accent)' : 'var(--color-bg-primary)',
              color: filter === f ? '#fff' : 'var(--color-text-primary)',
              border: '1px solid var(--color-border)',
            }}
          >
            {f === 'all' ? 'Toutes' : f === 'unresolved' ? 'Non resolues' : 'Resolues'}
          </button>
        ))}
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>{String(items.length)} alertes</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={32} style={{ color: 'var(--color-text-secondary)' }} />
            Aucune alerte de conformite.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Reference</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Regle</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Criticite</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Asset</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Message</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Date</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Statut</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((alert) => (
                <tr key={alert.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(alert.ref_id || '—')}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-primary)', maxWidth: '200px' }}>
                    {String(alert.rule || '').length > 80 ? String(alert.rule).substring(0, 80) + '...' : String(alert.rule || '—')}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {alert.criticality ? <Badge variant={criticalityBadgeVariant(String(alert.criticality))} size="sm">{String(alert.criticality)}</Badge> : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                  </td>
                  <td style={{ padding: '8px', color: 'var(--color-text-primary)' }}>{String(alert.asset_name || '—')}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-secondary)', maxWidth: '250px' }}>{String(alert.message || '—')}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>{alert.created_at ? String(alert.created_at).slice(0, 16).replace('T', ' ') : '—'}</td>
                  <td style={{ padding: '8px' }}>
                    {alert.resolved ? (
                      <Badge variant="success" size="sm">Resolue</Badge>
                    ) : (
                      <Badge variant="danger" size="sm">Non resolue</Badge>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {!alert.resolved && (
                      <button
                        onClick={() => resolveMutation.mutate(alert.id)}
                        disabled={resolveMutation.isPending}
                        style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '4px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: resolveMutation.isPending ? 'not-allowed' : 'pointer', opacity: resolveMutation.isPending ? 0.7 : 1 }}
                      >
                        Resoudre
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}