import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { regulatoryNotificationsApi } from '../api'
import { Card, Badge, Table, Modal, Button, Select, Input, EmptyState, StatCard } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { Bell, Plus, Clock, AlertTriangle } from 'lucide-react'

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'sent': return 'success'
    case 'pending': return 'warning'
    case 'overdue': return 'danger'
    case 'draft': return 'default'
    default: return 'info'
  }
}

function deadlineVariant(deadlineType: string): 'info' | 'warning' | 'danger' {
  switch (deadlineType) {
    case '24h': return 'danger'
    case '72h': return 'warning'
    case '1m': return 'info'
    default: return 'info'
  }
}

export function NotificationsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const { canEdit } = usePermissions()
  const canModify = canEdit('compliance_officer')

  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({ type: '', recipient: '', regulation: '', content: '', template_id: '' })

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => regulatoryNotificationsApi.list().then((r) => r.data),
  })

  const { data: templates } = useQuery({
    queryKey: ['notifications', 'templates', createForm.regulation],
    queryFn: () => regulatoryNotificationsApi.templates(createForm.regulation).then((r) => r.data),
    enabled: !!createForm.regulation,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => regulatoryNotificationsApi.create(data),
    onSuccess: () => {
      toast('success', t('compliance.notifications.createSuccess'))
      qc.invalidateQueries({ queryKey: ['notifications'] })
      setShowCreate(false)
      setCreateForm({ type: '', recipient: '', regulation: '', content: '', template_id: '' })
    },
    onError: () => toast('error', t('compliance.notifications.createError')),
  })

  const list = (Array.isArray(notifications) ? notifications : ((notifications as Record<string, unknown>)?.items ?? [])) as Record<string, unknown>[]
  const templateList = (Array.isArray(templates) ? templates : ((templates as Record<string, unknown>)?.items ?? [])) as Record<string, unknown>[]

  const sentCount = list.filter((n) => n.status === 'sent').length
  const pendingCount = list.filter((n) => n.status === 'pending').length
  const overdueCount = list.filter((n) => n.status === 'overdue').length

  const columns = [
    { key: 'type', label: t('common.type') },
    { key: 'recipient', label: t('compliance.notifications.recipient') },
    { key: 'regulation', label: t('compliance.notifications.regulation') },
    { key: 'status', label: t('common.status') },
    { key: 'deadline_type', label: t('compliance.notifications.deadline') },
    { key: 'created_at', label: t('common.date') },
  ]

  const regulationOptions = [
    { label: 'NIS2', value: 'nis2' },
    { label: 'DORA', value: 'dora' },
    { label: 'RGPD', value: 'gdpr' },
    { label: 'ISO 27001', value: 'iso27001' },
  ]

  const typeOptions = [
    { label: t('compliance.notifications.typeBreach'), value: 'breach' },
    { label: t('compliance.notifications.typeReport'), value: 'report' },
    { label: t('compliance.notifications.typeAudit'), value: 'audit' },
  ]

  const templateOptions = templateList.map((tp) => ({
    label: String(tp.name ?? tp.id ?? ''),
    value: String(tp.id ?? ''),
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('compliance.notifications')}
        </h1>
        {canModify && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('compliance.notifications.create')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard label={t('compliance.notifications.totalSent')} value={sentCount} icon={<Bell size={20} style={{ color: 'var(--color-success)' }} />} loading={isLoading} />
        <StatCard label={t('compliance.notifications.pending')} value={pendingCount} icon={<Clock size={20} style={{ color: 'var(--color-warning)' }} />} loading={isLoading} />
        <StatCard label={t('compliance.notifications.overdue')} value={overdueCount} icon={<AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />} loading={isLoading} />
      </div>

      {list.length > 0 ? (
        <Card>
          <Table
            columns={columns}
            data={list}
            renderCell={(col, row) => {
              if (col.key === 'status') {
                const st = String(row.status ?? 'unknown')
                return <Badge variant={statusVariant(st)} size="sm">{t(`compliance.notifications.statusLabels.${st}`, { count: 0 }) || st}</Badge>
              }
              if (col.key === 'deadline_type') {
                const dl = String(row.deadline_type ?? row.deadline ?? '')
                return <Badge variant={deadlineVariant(dl)} size="sm">{dl}</Badge>
              }
              return String(row[col.key] ?? '—')
            }}
            loading={isLoading}
            emptyMessage={t('common.noData')}
          />
        </Card>
      ) : (
        !isLoading && <EmptyState icon={<Bell size={32} />} title={t('common.noData')} />
      )}

      {canModify && (
        <Modal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          title={t('compliance.notifications.create')}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
              <Button onClick={() => createMutation.mutate(createForm as unknown as Record<string, unknown>)}>{t('common.create')}</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Select value={createForm.type} onChange={(v) => setCreateForm((f) => ({ ...f, type: v }))} options={typeOptions} label={t('common.type')} placeholder={t('compliance.notifications.selectType')} />
            <Input value={createForm.recipient} onChange={(v) => setCreateForm((f) => ({ ...f, recipient: v }))} label={t('compliance.notifications.recipient')} />
            <Select value={createForm.regulation} onChange={(v) => setCreateForm((f) => ({ ...f, regulation: v }))} options={regulationOptions} label={t('compliance.notifications.regulation')} placeholder={t('compliance.notifications.selectRegulation')} />
            {templateOptions.length > 0 && (
              <Select value={createForm.template_id} onChange={(v) => setCreateForm((f) => ({ ...f, template_id: v }))} options={[{ label: t('common.none'), value: '' }, ...templateOptions]} label={t('compliance.notifications.template')} />
            )}
            <Input value={createForm.content} onChange={(v) => setCreateForm((f) => ({ ...f, content: v }))} label={t('compliance.notifications.content')} />
          </div>
        </Modal>
      )}
    </div>
  )
}