import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, Badge, Button, Select, Modal, Table, EmptyState, Input } from '../components/ui'
import { agentConfigApi } from '../api'
import { FileText, Download } from 'lucide-react'

export function PolicyAuditPage() {
  const { t } = useTranslation()
  const { canEdit: _canEdit } = usePermissions()
  const { toast } = useToast()

  const [agentFilter, setAgentFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [selectedAudit, setSelectedAudit] = useState<Record<string, unknown> | null>(null)

  const { data: audits, isLoading } = useQuery({
    queryKey: ['policy-audit', agentFilter, typeFilter],
    queryFn: () => agentConfigApi.policyAudit({ agent_id: agentFilter || undefined, change_type: typeFilter || undefined } as Record<string, string>).then((r) => r.data),
  })

  const { data: auditDetail } = useQuery({
    queryKey: ['policy-audit', 'detail', selectedAudit?.id],
    queryFn: () => agentConfigApi.policyAuditGet(Number(selectedAudit!.id)).then((r) => r.data),
    enabled: !!selectedAudit,
  })

  const exportMutation = useMutation({
    mutationFn: () => agentConfigApi.policyAuditExport(),
    onSuccess: (response) => {
      const blob = new Blob([response.data as BlobPart], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'policy-audit.csv'
      a.click()
      URL.revokeObjectURL(url)
      toast('success', t('policyAudit.exportSuccess'))
    },
    onError: () => toast('error', t('policyAudit.exportError')),
  })

  const auditData = (Array.isArray(audits) ? audits : ((audits as Record<string, unknown> | null)?.items ?? (audits as Record<string, unknown> | null)?.audits ?? [])) as Record<string, unknown>[]
  // Map created_at -> timestamp for display
  const auditRows = auditData.map((a) => ({ ...a, timestamp: a.created_at ?? a.timestamp, change_type: a.action ?? a.change_type, user_name: a.updated_by_name ?? a.updated_by ?? '—', agent_display: a.agent_name ?? a.agent_id ?? 'Global' }))

  const columns = [
    { key: 'agent_id', label: t('policyAudit.agent') },
    { key: 'timestamp', label: t('policyAudit.date') },
    { key: 'change_type', label: t('policyAudit.changeType') },
    { key: 'changed_by', label: t('policyAudit.changedBy') },
  ]

  const [userFilter, setUserFilter] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const uniqueUsers = Array.from(new Set(auditRows.map((a) => String(a.user_name ?? '')).filter(Boolean)))
  const uniqueAgents = Array.from(new Set(auditRows.map((a) => String(a.agent_display ?? '')).filter(Boolean)))

  const typeVariant = (tp: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (tp === 'insert') return 'success'
    if (tp === 'update') return 'info'
    if (tp === 'delete') return 'danger'
    return 'default'
  }

  const filteredRows = auditRows.filter((r) => {
    if (userFilter && String(r.user_name ?? '') !== userFilter) return false
    if (agentFilter && String(r.agent_display ?? '') !== agentFilter) return false
    if (typeFilter && String(r.change_type ?? '') !== typeFilter) return false
    if (dateFilter) {
      const rowDate = String(r.timestamp ?? '').slice(0, 10)
      if (rowDate !== dateFilter) return false
    }
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('policyAudit.title')}</h1>
        <Button icon={<Download size={16} />} onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending}>{t('common.export')}</Button>
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('policyAudit.agent')} value={agentFilter} onChange={setAgentFilter} options={[
              { label: t('common.all'), value: '' },
              ...uniqueAgents.map((a) => ({ label: a, value: a })),
            ]} />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('policyAudit.changeType')} value={typeFilter} onChange={setTypeFilter} options={[
              { label: t('common.all'), value: '' },
              { label: 'Insert', value: 'insert' },
              { label: 'Update', value: 'update' },
              { label: 'Delete', value: 'delete' },
            ]} />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('policyAudit.changedBy')} value={userFilter} onChange={setUserFilter} options={[
              { label: t('common.all'), value: '' },
              ...uniqueUsers.map((u) => ({ label: u, value: u })),
            ]} />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Input label={t('policyAudit.date')} value={dateFilter} onChange={setDateFilter} type="date" />
          </div>
        </div>

        {filteredRows.length === 0 && !isLoading ? (
          <EmptyState title={t('policyAudit.noAudits')} icon={<FileText size={48} />} />
        ) : (
          <Table
            columns={columns}
            data={filteredRows}
            loading={isLoading}
            renderCell={(col, row) => {
              if (col.key === 'change_type') return <Badge variant={typeVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
              if (col.key === 'timestamp') return String(row[col.key] ?? '').replace('T', ' ').slice(0, 19)
              if (col.key === 'agent_id') return String(row.agent_display ?? 'Global')
              if (col.key === 'changed_by') return String(row.user_name ?? '—')
              return String(row[col.key] ?? '')
            }}
          />
        )}
      </Card>

      {selectedAudit && (
        <Modal open={!!selectedAudit} onClose={() => setSelectedAudit(null)} title={t('policyAudit.auditDetail')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('policyAudit.agent')}</span><div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{String(auditDetail?.agent_id ?? selectedAudit.agent_id ?? '')}</div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('policyAudit.date')}</span><div style={{ color: 'var(--color-text-primary)' }}>{String(auditDetail?.timestamp ?? selectedAudit.timestamp ?? '').replace('T', ' ').slice(0, 19)}</div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('policyAudit.changeType')}</span><div><Badge variant={typeVariant(String(auditDetail?.change_type ?? selectedAudit.change_type ?? ''))}>{String(auditDetail?.change_type ?? selectedAudit.change_type ?? '')}</Badge></div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('policyAudit.changedBy')}</span><div style={{ color: 'var(--color-text-primary)' }}>{String(auditDetail?.changed_by ?? selectedAudit.changed_by ?? '')}</div></div>
            </div>

            <div>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>{t('policyAudit.diff')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('policyAudit.before')}</span>
                  <pre style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--color-danger)', overflow: 'auto' }}>
                    {JSON.stringify(auditDetail?.before ?? selectedAudit.before ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('policyAudit.after')}</span>
                  <pre style={{ background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '12px', fontSize: '12px', color: 'var(--color-success)', overflow: 'auto' }}>
                    {JSON.stringify(auditDetail?.after ?? selectedAudit.after ?? {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}