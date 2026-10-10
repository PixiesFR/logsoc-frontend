import { useState, useCallback } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { actionsApi } from '../api'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Table, Badge, Modal, Select, Button, EmptyState, ConfirmDialog, useToast, Input } from '../components/ui'
import { Plus, CheckCircle, XCircle } from 'lucide-react'
import { usePermissions } from '../hooks/usePermissions'
import { formatTimestamp } from '../utils/eventFormatter'

const PAGE_SIZE = 20

type ActionItem = {
  id: number
  type: string
  target: string
  status: string
  created_at: string
  justification: string
  action_type?: string
  target_summary?: string
  reason?: string
  [key: string]: unknown
}

const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (status) {
    case 'approved': return 'success'
    case 'pending': return 'warning'
    case 'cancelled': return 'danger'
    case 'executed': return 'info'
    case 'delivered': return 'info'
    case 'succeeded': return 'success'
    default: return 'default'
  }
}

export function ActionsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { canEdit } = usePermissions()
  const canCreate = canEdit('analyst')
  const canApprove = canEdit('admin')

  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [cancelConfirm, setCancelConfirm] = useState<number | null>(null)

  const [newType, setNewType] = useState('')
  const [newTarget, setNewTarget] = useState('')
  const [newJustification, setNewJustification] = useState('')

  const params: Record<string, string> = {}
  if (statusFilter) params.status = statusFilter

  const { data: actionsData, isLoading } = useQuery<ActionItem[]>({
    queryKey: ['actions', { page, page_size: PAGE_SIZE, ...params }],
    queryFn: () => actionsApi.list({ page: String(page), page_size: String(PAGE_SIZE), ...params }).then((r) => r.data),
  })

  const actions = actionsData ?? []

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => actionsApi.create(data),
    onSuccess: () => {
      toast('success', t('actions.createSuccess'))
      queryClient.invalidateQueries({ queryKey: ['actions'] })
      setCreateOpen(false)
      setNewType('')
      setNewTarget('')
      setNewJustification('')
    },
    onError: () => {
      toast('error', t('actions.createError'))
    },
  })

  const approveMutation = useMutation({
    mutationFn: (id: number) => actionsApi.approve(id),
    onSuccess: () => {
      toast('success', t('actions.approveSuccess'))
      queryClient.invalidateQueries({ queryKey: ['actions'] })
    },
    onError: () => {
      toast('error', t('actions.approveError'))
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (id: number) => actionsApi.cancel(id),
    onSuccess: () => {
      toast('success', t('actions.cancelSuccess'))
      queryClient.invalidateQueries({ queryKey: ['actions'] })
      setCancelConfirm(null)
    },
    onError: () => {
      toast('error', t('actions.cancelError'))
    },
  })

  const handleCreate = useCallback(() => {
    if (!newType || !newTarget) return
    createMutation.mutate({ type: newType, target: newTarget, justification: newJustification })
  }, [newType, newTarget, newJustification, createMutation])

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('actions.statusLabels.pending'), value: 'pending' },
    { label: t('actions.statusLabels.approved'), value: 'approved' },
    { label: t('actions.statusLabels.cancelled'), value: 'cancelled' },
    { label: t('actions.statusLabels.executed'), value: 'executed' },
  ]

  const columns = [
    { key: 'type', label: t('common.type'), width: '120px' },
    { key: 'target', label: t('actions.target'), width: '160px' },
    { key: 'status', label: t('common.status'), width: '120px' },
    { key: 'created_at', label: t('common.date'), width: '160px' },
    { key: 'justification', label: t('actions.justification') },
  ]

  const tableData = actions.map((a: ActionItem) => ({
    id: a.id,
    type: a.action_type || a.type,
    target: a.target_summary || a.target,
    status: a.status,
    created_at: a.created_at,
    justification: a.reason || a.justification,
  }))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('nav.actions')}
        </h1>
        {canCreate && (
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreateOpen(true)}>
            {t('actions.createAction')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ width: '160px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder={t('common.status')} />
        </div>
      </div>

      {isLoading && <Table columns={columns} data={[]} loading={true} />}

      {!isLoading && tableData.length === 0 && (
        <EmptyState icon={<XCircle size={32} />} title={t('actions.noActions')} />
      )}

      {!isLoading && tableData.length > 0 && (
        <>
          <Table
            columns={columns}
            data={tableData}
            renderCell={(col, row) => {
              if (col.key === 'type') {
                return <Badge variant="info">{t(`actions.actionTypes.${row.type ?? 'other'}`)}</Badge>
              }
              if (col.key === 'status') {
                return <Badge variant={statusVariant(row.status as string)} size="sm">{t(`actions.statusLabels.${row.status}`)}</Badge>
              }
              if (col.key === 'created_at') {
                return <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{formatTimestamp(row.created_at as string, false)}</span>
              }
              if (col.key === 'justification') {
                return <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{row.justification as string}</span>
              }
              return String(row[col.key] ?? '')
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
              {t('common.previous')}
            </Button>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {t('actions.page', { page })}
            </span>
            <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={tableData.length < PAGE_SIZE}>
              {t('common.next')}
            </Button>
          </div>

          {/* Action buttons for pending actions */}
          {canApprove && actions.filter((a: ActionItem) => a.status === 'pending').length > 0 && (
            <div style={{ marginTop: '8px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                {t('actions.pendingActions')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {actions.filter((a: ActionItem) => a.status === 'pending').map((a: ActionItem) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-secondary)' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{a.type} — {a.target}</div>
                      <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{a.justification}</div>
                    </div>
                    <Button variant="primary" size="sm" icon={<CheckCircle size={14} />} onClick={() => approveMutation.mutate(a.id)}>
                      {t('actions.approve')}
                    </Button>
                    <Button variant="danger" size="sm" icon={<XCircle size={14} />} onClick={() => setCancelConfirm(a.id)}>
                      {t('actions.cancel')}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create action modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={t('actions.createAction')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleCreate} disabled={!newType || !newTarget || createMutation.isPending}>
              {t('common.create')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label={t('common.type')}
            value={newType}
            onChange={setNewType}
            options={[
              { label: t('actions.actionTypes.isolation'), value: 'isolation' },
              { label: t('actions.actionTypes.remediation'), value: 'remediation' },
              { label: t('actions.actionTypes.investigation'), value: 'investigation' },
              { label: t('actions.actionTypes.other'), value: 'other' },
            ]}
            placeholder={t('actions.selectType')}
          />
          <Input
            label={t('actions.target')}
            value={newTarget}
            onChange={setNewTarget}
            placeholder={t('actions.targetPlaceholder')}
          />
          <Input
            label={t('actions.justification')}
            value={newJustification}
            onChange={setNewJustification}
            placeholder={t('actions.justificationPlaceholder')}
          />
        </div>
      </Modal>

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={cancelConfirm !== null}
        title={t('actions.cancelConfirmTitle')}
        message={t('actions.cancelConfirmMessage')}
        confirmLabel={t('actions.cancel')}
        variant="danger"
        onConfirm={() => { if (cancelConfirm !== null) cancelMutation.mutate(cancelConfirm) }}
        onCancel={() => setCancelConfirm(null)}
      />
    </div>
  )
}