import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Card, Badge, StatCard, Select, Table, Button, Modal, Input, ConfirmDialog } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import { AlertTriangle, CheckSquare, Plus, Clock } from 'lucide-react'

function priorityBadge(priority: string): 'danger' | 'warning' | 'info' | 'default' {
  switch (priority) {
    case 'critical': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'info'
    default: return 'default'
  }
}

function statusBadge(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'completed': return 'success'
    case 'in_progress': return 'info'
    case 'overdue': return 'danger'
    case 'pending': return 'default'
    default: return 'default'
  }
}

export function Remediation() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formOwner, setFormOwner] = useState('')
  const [formPriority, setFormPriority] = useState('medium')
  const [formDeadline, setFormDeadline] = useState('')
  const [formBudget, setFormBudget] = useState('')

  const params: Record<string, string> = {}
  if (statusFilter) params.status = statusFilter
  if (priorityFilter) params.priority = priorityFilter
  if (ownerFilter) params.owner = ownerFilter

  const { data: actions, isLoading } = useQuery({
    queryKey: ['governance', 'remediation', params],
    queryFn: () => governanceApi.remediationActions(params).then((r) => r.data),
  })

  const { data: actionDetail } = useQuery({
    queryKey: ['governance', 'remediation', selectedId],
    queryFn: () => governanceApi.remediationActions({ id: String(selectedId) }).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => governanceApi.createRemediation(data),
    onSuccess: () => {
      toast('success', t('governance.remediation.createSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'remediation'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('governance.remediation.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => governanceApi.deletePolicy(id),
    onSuccess: () => {
      toast('success', t('governance.remediation.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'remediation'] })
      setDeleteId(null)
    },
    onError: () => toast('error', t('governance.remediation.deleteError')),
  })

  function resetForm() {
    setFormTitle('')
    setFormDescription('')
    setFormOwner('')
    setFormPriority('medium')
    setFormDeadline('')
    setFormBudget('')
  }

  const items = (Array.isArray(actions) ? actions : (actions as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]
  const total = items.length
  const overdue = items.filter((i) => i.status === 'overdue').length
  const completed = items.filter((i) => i.status === 'completed').length
  const inProgress = items.filter((i) => i.status === 'in_progress').length

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.remediation.pending'), value: 'pending' },
    { label: t('governance.remediation.inProgress'), value: 'in_progress' },
    { label: t('governance.remediation.completed'), value: 'completed' },
    { label: t('governance.remediation.overdue'), value: 'overdue' },
  ]

  const priorityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.remediation.critical'), value: 'critical' },
    { label: t('governance.remediation.high'), value: 'high' },
    { label: t('governance.remediation.medium'), value: 'medium' },
    { label: t('governance.remediation.low'), value: 'low' },
  ]

  const columns = [
    { key: 'title', label: t('governance.remediation.title_field') },
    { key: 'description', label: t('common.description') },
    { key: 'priority', label: t('common.priority'), width: '100px' },
    { key: 'owner', label: t('common.owner'), width: '120px' },
    { key: 'deadline', label: t('governance.remediation.deadline'), width: '110px' },
    { key: 'status', label: t('common.status'), width: '120px' },
    { key: 'progress', label: t('governance.remediation.progress'), width: '100px' },
  ]

  const detail = selectedId !== null ? (Array.isArray(actionDetail) ? actionDetail[0] : (actionDetail as Record<string, unknown> | null)) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.remediation.title')}
        </h1>
        {canEdit('compliance_officer') && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('governance.remediation.createAction')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <StatCard label={t('common.total')} value={total} icon={<CheckSquare size={18} />} color="var(--color-accent)" loading={isLoading} />
        <StatCard label={t('governance.remediation.overdue')} value={overdue} icon={<AlertTriangle size={18} />} color="var(--color-danger)" loading={isLoading} />
        <StatCard label={t('governance.remediation.inProgress')} value={inProgress} icon={<Clock size={18} />} color="var(--color-info)" loading={isLoading} />
        <StatCard label={t('governance.remediation.completedStat')} value={completed} icon={<CheckSquare size={18} />} color="var(--color-success)" loading={isLoading} />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '160px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} label={t('common.status')} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select value={priorityFilter} onChange={setPriorityFilter} options={priorityOptions} label={t('common.priority')} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Input label={t('common.owner')} value={ownerFilter} onChange={setOwnerFilter} placeholder={t('common.search')} />
        </div>
      </div>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('governance.remediation.noActions')}
        renderCell={(col, row) => {
          if (col.key === 'priority') {
            return <Badge variant={priorityBadge(String(row.priority))}>{String(row.priority)}</Badge>
          }
          if (col.key === 'status') {
            return <Badge variant={statusBadge(String(row.status))}>{String(row.status)}</Badge>
          }
          if (col.key === 'progress') {
            const pct = Number(row.progress ?? 0)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: pct >= 100 ? 'var(--color-success)' : 'var(--color-accent)' }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '32px' }}>{pct}%</span>
              </div>
            )
          }
          if (col.key === 'title') {
            return (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: 0, font: 'inherit', textAlign: 'left' }}
                onClick={() => setSelectedId(Number(row.id))}
              >
                {String(row.title)}
              </button>
            )
          }
          return String(row[col.key] ?? '')
        }}
      />

      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('governance.remediation.createAction')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('governance.remediation.title_field')} value={formTitle} onChange={setFormTitle} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('common.description')}</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={4}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <Input label={t('common.owner')} value={formOwner} onChange={setFormOwner} />
            <Select label={t('common.priority')} value={formPriority} onChange={setFormPriority} options={priorityOptions.slice(1)} />
            <Input label={t('governance.remediation.deadline')} value={formDeadline} onChange={setFormDeadline} type="date" />
            <Input label={t('governance.remediation.budget')} value={formBudget} onChange={setFormBudget} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ title: formTitle, description: formDescription, owner: formOwner, priority: formPriority, deadline: formDeadline, budget: formBudget })} disabled={!formTitle}>
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      {selectedId !== null && detail && (
        <Modal open={selectedId !== null} onClose={() => setSelectedId(null)} title={String(detail.title ?? '')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Badge variant={priorityBadge(String(detail.priority))}>{String(detail.priority)}</Badge>
              <Badge variant={statusBadge(String(detail.status))}>{String(detail.status)}</Badge>
            </div>
            {detail.description && (
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{String(detail.description)}</p>
            )}
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              <span>{t('common.owner')}: {String(detail.owner ?? '')}</span>
              <span>{t('governance.remediation.deadline')}: {String(detail.deadline ?? '')}</span>
            </div>
            {detail.checklist && (
              <Card>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('governance.remediation.checklist')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(detail.checklist as unknown as { item: string; done: boolean }[])?.map?.((c, i) => (
                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                      <input type="checkbox" checked={c.done} readOnly style={{ accentColor: 'var(--color-accent)' }} />
                      {c.item}
                    </label>
                  )) ?? <span style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>{String(detail.checklist)}</span>}
                </div>
              </Card>
            )}
            {canEdit('compliance_officer') && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <Button variant="danger" onClick={() => setDeleteId(Number(detail.id))}>{t('common.delete')}</Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={deleteId !== null}
        title={t('governance.remediation.deleteConfirmTitle')}
        message={t('governance.remediation.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}