import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Badge, Select, Table, Button, Modal, Input, Card, ConfirmDialog } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import { Plus, Gavel } from 'lucide-react'

function decisionStatusBadge(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'approved': return 'success'
    case 'proposed': return 'info'
    case 'rejected': return 'danger'
    case 'implemented': return 'success'
    default: return 'default'
  }
}

export function Decisions() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formType, setFormType] = useState('policy')
  const [formDecider, setFormDecider] = useState('')
  const [formJustification, setFormJustification] = useState('')

  const params: Record<string, string> = {}
  if (typeFilter) params.type = typeFilter
  if (statusFilter) params.status = statusFilter

  const { data: decisions, isLoading } = useQuery({
    queryKey: ['governance', 'decisions', params],
    queryFn: () => governanceApi.decisions(params).then((r) => r.data),
  })

  const { data: decisionDetail } = useQuery({
    queryKey: ['governance', 'decision', selectedId],
    queryFn: () => governanceApi.getPolicy(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => governanceApi.createDecision(data),
    onSuccess: () => {
      toast('success', t('governance.decisions.createSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'decisions'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('governance.decisions.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => governanceApi.deleteDecision(id),
    onSuccess: () => {
      toast('success', t('governance.decisions.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'decisions'] })
      setDeleteId(null)
    },
    onError: () => toast('error', t('governance.decisions.deleteError')),
  })

  function resetForm() {
    setFormTitle('')
    setFormDescription('')
    setFormType('policy')
    setFormDecider('')
    setFormJustification('')
  }

  const items = (Array.isArray(decisions) ? decisions : (decisions as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]

  const typeOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.decisions.typePolicy'), value: 'policy' },
    { label: t('governance.decisions.typeOperational'), value: 'operational' },
    { label: t('governance.decisions.typeStrategic'), value: 'strategic' },
    { label: t('governance.decisions.typeException'), value: 'exception' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.decisions.proposed'), value: 'proposed' },
    { label: t('governance.decisions.approved'), value: 'approved' },
    { label: t('governance.decisions.rejected'), value: 'rejected' },
    { label: t('governance.decisions.implemented'), value: 'implemented' },
  ]

  const columns = [
    { key: 'title', label: t('governance.decisions.title_field') },
    { key: 'type', label: t('common.type'), width: '120px' },
    { key: 'decider', label: t('governance.decisions.decider'), width: '140px' },
    { key: 'date', label: t('common.date'), width: '120px' },
    { key: 'status', label: t('common.status'), width: '120px' },
  ]

  const detail = decisionDetail as Record<string, unknown> | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.decisions.title')}
        </h1>
        {canEdit('compliance_officer') && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('governance.decisions.createDecision')}
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '160px' }}>
          <Select value={typeFilter} onChange={setTypeFilter} options={typeOptions} label={t('common.type')} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} label={t('common.status')} />
        </div>
      </div>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('governance.decisions.noDecisions')}
        renderCell={(col, row) => {
          if (col.key === 'status') {
            return <Badge variant={decisionStatusBadge(String(row.status))}>{String(row.status)}</Badge>
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
          return String(row[col.key] ?? "")
        }}
      />

      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('governance.decisions.createDecision')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('governance.decisions.title_field')} value={formTitle} onChange={setFormTitle} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('common.description')}</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <Select label={t('common.type')} value={formType} onChange={setFormType} options={typeOptions.slice(1)} />
            <Input label={t('governance.decisions.decider')} value={formDecider} onChange={setFormDecider} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('governance.decisions.justification')}</label>
              <textarea
                value={formJustification}
                onChange={(e) => setFormJustification(e.target.value)}
                rows={3}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ title: formTitle, description: formDescription, type: formType, decider: formDecider, justification: formJustification })} disabled={!formTitle}>
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      {selectedId !== null && detail && (
        <Modal open={selectedId !== null} onClose={() => setSelectedId(null)} title={String(detail.title ?? "")} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Badge variant={decisionStatusBadge(String(detail.status))}>{String(detail.status)}</Badge>
              <Badge variant="default">{String(detail.type)}</Badge>
            </div>
            {String(detail.description ?? "") && (
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>{String(detail.description)}</p>
            )}
            {String(detail.justification ?? "") && (
              <Card>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>
                  <Gavel size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  {t('governance.decisions.justification')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{String(detail.justification)}</p>
              </Card>
            )}
            {String(detail.impact ?? "") && (
              <Card>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('governance.decisions.impact')}</h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{String(detail.impact)}</p>
              </Card>
            )}
            {String(detail.status_history ?? "") && (
              <Card>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>{t('governance.decisions.statusHistory')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(detail.status_history as unknown as { status: string; date: string }[])?.map?.((h, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      <Badge variant={decisionStatusBadge(h.status)} size="sm">{h.status}</Badge>
                      <span>{h.date}</span>
                    </div>
                  )) ?? <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{String(detail.status_history)}</span>}
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
        title={t('governance.decisions.deleteConfirmTitle')}
        message={t('governance.decisions.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}