import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { actionPlansApi } from '../../api'
import { Card, Badge, Select, Table, Button, Modal, Input, ConfirmDialog } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import {
  Plus, Download, Upload, Clock, AlertTriangle, CheckCircle, XCircle,
  ShieldAlert, Archive, ChevronRight, FileText, Server, Users as UsersIcon,
} from 'lucide-react'

function priorityVariant(p: string): 'danger' | 'warning' | 'info' | 'default' {
  switch (p) {
    case 'critical': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'info'
    default: return 'default'
  }
}

function statusVariant(s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (s) {
    case 'valide': return 'success'
    case 'en_attente_validation': return 'warning'
    case 'en_cours': return 'info'
    case 'a_planifier': return 'default'
    case 'rejete': return 'danger'
    case 'risque_accepte': return 'info'
    case 'obsolete': return 'default'
    default: return 'default'
  }
}

const STATUS_FLOW: Record<string, string[]> = {
  a_planifier: ['en_cours', 'risque_accepte', 'obsolete'],
  en_cours: ['en_attente_validation', 'risque_accepte', 'obsolete'],
  en_attente_validation: ['valide', 'rejete', 'risque_accepte', 'obsolete'],
  rejete: ['en_cours', 'risque_accepte', 'obsolete'],
  valide: ['risque_accepte', 'obsolete'],
}

const SOURCE_OPTIONS = [
  { value: 'audit', label: 'Audit' },
  { value: 'risk', label: 'Risk' },
  { value: 'compliance', label: 'Compliance' },
  { value: 'incident', label: 'Incident' },
  { value: 'other', label: 'Other' },
]

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

const CATEGORY_OPTIONS = [
  { value: 'remediation', label: 'Remediation' },
  { value: 'conformite', label: 'Conformité' },
  { value: 'amelioration', label: 'Amélioration' },
]

export function ActionPlans() {
  const { t } = useTranslation()
  const { canEdit, isAdmin, isRssi } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [view, setView] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [statusModal, setStatusModal] = useState<{ id: number; newStatus: string } | null>(null)
  const [extendModal, setExtendModal] = useState<number | null>(null)
  const [progressModal, setProgressModal] = useState<number | null>(null)
  const [rejectionComment, setRejectionComment] = useState('')
  const [riskJustification, setRiskJustification] = useState('')

  // Create form state
  const [formTitle, setFormTitle] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [formSource, setFormSource] = useState('other')
  const [formPriority, setFormPriority] = useState('medium')
  const [formCategory, setFormCategory] = useState('remediation')
  const [formTargetDate, setFormTargetDate] = useState('')
  const [formPilotId, setFormPilotId] = useState('')
  const [formActorId, setFormActorId] = useState('')
  const [formComplianceRef, setFormComplianceRef] = useState('')

  // Extend form
  const [extendDate, setExtendDate] = useState('')
  const [extendJustification, setExtendJustification] = useState('')

  // Progress form
  const [progressValue, setProgressValue] = useState(0)

  // Query params
  const params: Record<string, string> = {}
  if (view) params.view = view

  const { data: actions, isLoading } = useQuery({
    queryKey: ['action-plans', params],
    queryFn: () => actionPlansApi.list(params).then((r) => r.data),
  })

  const { data: detail } = useQuery({
    queryKey: ['action-plans', selectedId],
    queryFn: () => actionPlansApi.get(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const { data: users } = useQuery({
    queryKey: ['action-plans-users'],
    queryFn: () => actionPlansApi.users().then((r) => r.data),
  })

  const { data: history } = useQuery({
    queryKey: ['action-plans-history', selectedId],
    queryFn: () => actionPlansApi.history(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => actionPlansApi.create(data),
    onSuccess: () => {
      toast('success', t('actionPlans.createSuccess'))
      qc.invalidateQueries({ queryKey: ['action-plans'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('actionPlans.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => actionPlansApi.delete(id),
    onSuccess: () => {
      toast('success', t('actionPlans.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['action-plans'] })
      setDeleteId(null)
      setSelectedId(null)
    },
    onError: () => toast('error', t('actionPlans.deleteError')),
  })

  const statusMutation = useMutation({
    mutationFn: (data: { id: number; status: string; comment?: string }) =>
      actionPlansApi.changeStatus(data.id, { status: data.status, comment: data.comment }),
    onSuccess: () => {
      toast('success', t('actionPlans.statusSuccess'))
      qc.invalidateQueries({ queryKey: ['action-plans'] })
      setStatusModal(null)
      setRejectionComment('')
      setRiskJustification('')
    },
    onError: () => toast('error', t('actionPlans.statusError')),
  })

  const progressMutation = useMutation({
    mutationFn: (data: { id: number; progress: number }) =>
      actionPlansApi.updateProgress(data.id, data.progress),
    onSuccess: () => {
      toast('success', t('actionPlans.progressSuccess'))
      qc.invalidateQueries({ queryKey: ['action-plans'] })
      setProgressModal(null)
    },
    onError: () => toast('error', t('actionPlans.updateError')),
  })

  const proofMutation = useMutation({
    mutationFn: (data: { id: number; file: File }) => {
      const fd = new FormData()
      fd.append('file', data.file)
      return actionPlansApi.uploadProof(data.id, fd)
    },
    onSuccess: () => {
      toast('success', t('actionPlans.proofSuccess'))
      qc.invalidateQueries({ queryKey: ['action-plans'] })
      // removed
    },
    onError: () => toast('error', t('actionPlans.proofError')),
  })

  const extendMutation = useMutation({
    mutationFn: (data: { id: number; new_date: string; justification: string }) =>
      actionPlansApi.extend(data.id, data),
    onSuccess: () => {
      toast('success', t('actionPlans.extendSuccess'))
      qc.invalidateQueries({ queryKey: ['action-plans'] })
      setExtendModal(null)
      setExtendDate('')
      setExtendJustification('')
    },
    onError: () => toast('error', t('actionPlans.extendError')),
  })

  function resetForm() {
    setFormTitle('')
    setFormDescription('')
    setFormSource('other')
    setFormPriority('medium')
    setFormCategory('remediation')
    setFormTargetDate('')
    setFormPilotId('')
    setFormActorId('')
    setFormComplianceRef('')
  }

  const items = (Array.isArray(actions) ? actions : []) as Record<string, unknown>[]
  const canCreate = canEdit('compliance_officer')
  const canExport = isAdmin || isRssi

  // View buttons
  const views = [
    { key: '', label: t('actionPlans.viewAll') },
    { key: 'regulatory', label: t('actionPlans.viewRegulatory') },
    { key: 'mine', label: t('actionPlans.viewMine') },
    { key: 'top_risks', label: t('actionPlans.viewTopRisks') },
    { key: 'overdue', label: t('actionPlans.viewOverdue') },
    { key: 'pending_validation', label: t('actionPlans.viewPending') },
  ]

  const columns = [
    { key: 'action_id', label: t('actionPlans.id'), width: '110px' },
    { key: 'title', label: t('common.description') },
    { key: 'source', label: t('actionPlans.source'), width: '90px' },
    { key: 'priority', label: t('actionPlans.priority'), width: '90px' },
    { key: 'pilot_name', label: t('actionPlans.pilot'), width: '100px' },
    { key: 'target_date', label: t('actionPlans.targetDate'), width: '110px' },
    { key: 'status', label: t('actionPlans.status'), width: '140px' },
    { key: 'progress', label: t('actionPlans.progress'), width: '100px' },
    { key: 'proof', label: t('actionPlans.proof'), width: '60px' },
  ]

  function handleExport() {
    const p: Record<string, string> = {}
    if (view) p.view = view
    actionPlansApi.export(p).then((response) => {
      const blob = response.data as Blob
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'action_plans.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('actionPlans.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canExport && (
            <Button variant="secondary" icon={<Download size={16} />} onClick={handleExport}>
              {t('actionPlans.export')}
            </Button>
          )}
          {canCreate && (
            <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
              {t('actionPlans.newAction')}
            </Button>
          )}
        </div>
      </div>

      {/* Quick views */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {views.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--color-border)',
              background: view === v.key ? 'var(--color-accent)' : 'var(--color-bg-secondary)',
              color: view === v.key ? '#fff' : 'var(--color-text-primary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Main table */}
      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('actionPlans.noActions')}
        onRowClick={(row) => setSelectedId(Number(row.id))}
        renderCell={(col, row) => {
          if (col.key === 'title') {
            return (
              <span style={{ color: 'var(--color-accent)', cursor: 'pointer' }}>
                {String(row.title ?? '')}
              </span>
            )
          }
          if (col.key === 'priority') {
            return <Badge variant={priorityVariant(String(row.priority))}>{t(`actionPlans.${row.priority}`)}</Badge>
          }
          if (col.key === 'status') {
            return <Badge variant={statusVariant(String(row.status))}>{t(`actionPlans.${String(row.status)}`)}</Badge>
          }
          if (col.key === 'progress') {
            const pct = Number(row.progress ?? 0)
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: '3px', background: pct >= 100 ? 'var(--color-success)' : 'var(--color-accent)' }} />
                </div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', minWidth: '30px' }}>{pct}%</span>
              </div>
            )
          }
          if (col.key === 'proof') {
            return row.proof_file_name ? (
              <span style={{ color: 'var(--color-success)' }} title={String(row.proof_file_name)}>📎</span>
            ) : null
          }
          if (col.key === 'target_date') {
            const td = String(row.target_date ?? '')
            if (!td) return ''
            const isOverdue = row.is_overdue === true
            return (
              <span style={{ color: isOverdue ? 'var(--color-danger)' : undefined, fontWeight: isOverdue ? 600 : undefined }}>
                {td}
                {row.is_j15 === true && <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--color-warning)' }}>J-15</span>}
                {row.is_j7 === true && <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--color-danger)' }}>J-7</span>}
                {isOverdue && <AlertTriangle size={12} style={{ marginLeft: '4px', color: 'var(--color-danger)', verticalAlign: 'middle' }} />}
              </span>
            )
          }
          return String(row[col.key] ?? '')
        }}
      />

      {/* Create Modal */}
      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('actionPlans.newAction')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('common.description')} value={formTitle} onChange={setFormTitle} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('actionPlans.description')}</label>
              <textarea
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                rows={3}
                style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Select label={t('actionPlans.source')} value={formSource} onChange={setFormSource} options={SOURCE_OPTIONS} />
              <Select label={t('actionPlans.priority')} value={formPriority} onChange={setFormPriority} options={PRIORITY_OPTIONS} />
              <Select label={t('actionPlans.category')} value={formCategory} onChange={setFormCategory} options={CATEGORY_OPTIONS} />
              <Input label={t('actionPlans.targetDate')} value={formTargetDate} onChange={setFormTargetDate} type="date" />
              <Select
                label={t('actionPlans.pilot')}
                value={formPilotId}
                onChange={setFormPilotId}
                options={[{ value: '', label: '—' }, ...(users ? (users as Record<string, unknown>[]).map((u) => ({ value: String(u.id), label: String(u.username) })) : [])]}
              />
              <Select
                label={t('actionPlans.actor')}
                value={formActorId}
                onChange={setFormActorId}
                options={[{ value: '', label: '—' }, ...(users ? (users as Record<string, unknown>[]).map((u) => ({ value: String(u.id), label: String(u.username) })) : [])]}
              />
              <Input label={t('actionPlans.complianceRef')} value={formComplianceRef} onChange={setFormComplianceRef} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button
              onClick={() => createMutation.mutate({
                title: formTitle,
                description: formDescription,
                source: formSource,
                priority: formPriority,
                category: formCategory,
                target_date: formTargetDate || null,
                pilot_id: formPilotId ? Number(formPilotId) : null,
                actor_id: formActorId ? Number(formActorId) : null,
                compliance_ref: formComplianceRef || null,
              })}
              disabled={!formTitle}
            >
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedId !== null && detail && (
        <Modal open={selectedId !== null} onClose={() => setSelectedId(null)} title={String(detail.action_id ?? '')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* General info */}
            <Card>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0' }}>{t('actionPlans.generalInfo')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                <div><strong>{t('actionPlans.id')}:</strong> {String(detail.action_id ?? '')}</div>
                <div><strong>{t('actionPlans.status')}:</strong> <Badge variant={statusVariant(String(detail.status))}>{t(`actionPlans.${String(detail.status)}`)}</Badge></div>
                <div><strong>{t('actionPlans.priority')}:</strong> <Badge variant={priorityVariant(String(detail.priority))}>{t(`actionPlans.${String(detail.priority)}`)}</Badge></div>
                <div><strong>{t('actionPlans.source')}:</strong> {String(detail.source ?? '')}</div>
                <div><strong>{t('actionPlans.category')}:</strong> {t(`actionPlans.${String(detail.category)}`)}</div>
                {detail.compliance_ref && <div><strong>{t('actionPlans.complianceRef')}:</strong> {String(detail.compliance_ref)}</div>}
                {detail.rejection_comment && <div style={{ gridColumn: '1 / -1' }}><strong>{t('actionPlans.rejectionComment')}:</strong> {String(detail.rejection_comment)}</div>}
                {detail.risk_acceptance_reason && <div style={{ gridColumn: '1 / -1' }}><strong>{t('actionPlans.riskJustification')}:</strong> {String(detail.risk_acceptance_reason)}</div>}
              </div>
              {detail.description && (
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '8px 0 0 0' }}>{String(detail.description)}</p>
              )}
            </Card>

            {/* Responsibility */}
            <Card>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0' }}>{t('actionPlans.responsibility')}</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
                <div><strong>{t('actionPlans.pilot')}:</strong> {String(detail.pilot_name ?? detail.pilot_id ?? '—')}</div>
                <div><strong>{t('actionPlans.actor')}:</strong> {String(detail.actor_name ?? detail.actor_id ?? '—')}</div>
                <div><strong>{t('actionPlans.targetDate')}:</strong> {String(detail.target_date ?? '—')}
                  {detail.is_overdue && <span style={{ color: 'var(--color-danger)', marginLeft: '4px' }}>⚠ {t('actionPlans.overdue')}</span>}
                  {detail.days_remaining != null && !detail.is_overdue && <span style={{ marginLeft: '4px', color: 'var(--color-text-secondary)' }}>({String(detail.days_remaining)} {t('actionPlans.daysRemaining')})</span>}
                </div>
              </div>
            </Card>

            {/* Progress */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{t('actionPlans.progress')}</h3>
                {canEdit('compliance_officer') && (
                  <Button variant="secondary" size="sm" onClick={() => { setProgressValue(Number(detail.progress ?? 0)); setProgressModal(selectedId) }}>
                    {t('common.edit')}
                  </Button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ flex: 1, height: '10px', borderRadius: '5px', background: 'var(--color-border)', overflow: 'hidden' }}>
                  <div style={{ width: `${Number(detail.progress ?? 0)}%`, height: '100%', borderRadius: '5px', background: Number(detail.progress ?? 0) >= 100 ? 'var(--color-success)' : 'var(--color-accent)', transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', minWidth: '40px' }}>{Number(detail.progress ?? 0)}%</span>
              </div>
            </Card>

            {/* Proof */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: 0 }}>{t('actionPlans.proof')}</h3>
                {canEdit('compliance_officer') && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', fontSize: '13px' }}>
                      <Upload size={14} />
                      {t('actionPlans.uploadProof')}
                      <input
                        type="file"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0]
                          if (file && selectedId) {
                            proofMutation.mutate({ id: selectedId, file })
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>
              {detail.proof_file_name ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span>{String(detail.proof_file_name)}</span>
                  <Button variant="secondary" size="sm" onClick={() => {
                    actionPlansApi.downloadProof(selectedId).then((r) => {
                      const blob = r.data as Blob
                      const url = window.URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = String(detail.proof_file_name)
                      a.click()
                      window.URL.revokeObjectURL(url)
                    })
                  }}>
                    {t('actionPlans.downloadProof')}
                  </Button>
                </div>
              ) : (
                <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>—</span>
              )}
            </Card>

            {/* Links */}
            <Card>
              <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0' }}>{t('actionPlans.links')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={14} />
                  <strong>{t('actionPlans.linkedDoc')}:</strong> {detail.linked_policy_doc_id ? (
                    <a href={`/governance/policies`} style={{ color: 'var(--color-accent)' }}>Policy #{String(detail.linked_policy_doc_id)}</a>
                  ) : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Server size={14} />
                  <strong>{t('actionPlans.linkedAsset')}:</strong> {detail.linked_asset_id ? `Asset #${String(detail.linked_asset_id)}` : '—'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <UsersIcon size={14} />
                  <strong>{t('actionPlans.linkedVendor')}:</strong> {detail.linked_vendor_id ? `Vendor #${String(detail.linked_vendor_id)}` : '—'}
                </div>
              </div>
            </Card>

            {/* History */}
            {history && (history as Record<string, unknown>[]).length > 0 && (
              <Card>
                <h3 style={{ fontSize: '14px', fontWeight: 600, margin: '0 0 8px 0' }}>{t('actionPlans.history')}</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(history as Record<string, unknown>[]).map((h, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid var(--color-border)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)', marginTop: '5px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{String(h.action_type ?? '')}</div>
                        {Boolean(h.comment) && <div style={{ color: 'var(--color-text-secondary)' }}>{String(h.comment)}</div>}
                        <div style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{String(h.username ?? '—')} · {String(h.timestamp ?? '')}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Action buttons based on status and role */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
              {detail.status === 'a_planifier' && canEdit('compliance_officer') && detail.pilot_id && detail.actor_id && detail.target_date && (
                <Button icon={<ChevronRight size={14} />} onClick={() => setStatusModal({ id: selectedId, newStatus: 'en_cours' })}>
                  {t('actionPlans.startAction')}
                </Button>
              )}
              {detail.status === 'en_cours' && canEdit('compliance_officer') && detail.proof_file_name && (
                <Button variant="secondary" onClick={() => setStatusModal({ id: selectedId, newStatus: 'en_attente_validation' })}>
                  {t('actionPlans.submitValidation')}
                </Button>
              )}
              {detail.status === 'en_attente_validation' && (isAdmin || isRssi) && (
                <>
                  <Button icon={<CheckCircle size={14} />} onClick={() => setStatusModal({ id: selectedId, newStatus: 'valide' })}>
                    {t('actionPlans.validate')}
                  </Button>
                  <Button variant="danger" icon={<XCircle size={14} />} onClick={() => setStatusModal({ id: selectedId, newStatus: 'rejete' })}>
                    {t('actionPlans.reject')}
                  </Button>
                </>
              )}
              {(isAdmin || isRssi) && STATUS_FLOW[String(detail.status)]?.includes('risque_accepte') && (
                <Button variant="secondary" icon={<ShieldAlert size={14} />} onClick={() => setStatusModal({ id: selectedId, newStatus: 'risque_accepte' })}>
                  {t('actionPlans.acceptRisk')}
                </Button>
              )}
              {isAdmin && STATUS_FLOW[String(detail.status)]?.includes('obsolete') && (
                <Button variant="secondary" icon={<Archive size={14} />} onClick={() => setStatusModal({ id: selectedId, newStatus: 'obsolete' })}>
                  {t('actionPlans.markObsolete')}
                </Button>
              )}
              {canEdit('compliance_officer') && ['en_cours', 'a_planifier'].includes(String(detail.status)) && (
                <Button variant="secondary" icon={<Clock size={14} />} onClick={() => setExtendModal(selectedId)}>
                  {t('actionPlans.requestExtension')}
                </Button>
              )}
              {isAdmin && (
                <Button variant="danger" onClick={() => setDeleteId(selectedId)}>{t('common.delete')}</Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Status change modal */}
      {statusModal && (
        <Modal open={true} onClose={() => { setStatusModal(null); setRejectionComment(''); setRiskJustification('') }} title={`${t('actionPlans.status')}: ${t(`actionPlans.${statusModal.newStatus}`)}`} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {statusModal.newStatus === 'rejete' && (
              <Input label={t('actionPlans.rejectionComment')} value={rejectionComment} onChange={setRejectionComment} required />
            )}
            {statusModal.newStatus === 'risque_accepte' && (
              <Input label={t('actionPlans.riskJustification')} value={riskJustification} onChange={setRiskJustification} required />
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" onClick={() => { setStatusModal(null); setRejectionComment(''); setRiskJustification('') }}>{t('common.cancel')}</Button>
              <Button
                onClick={() => statusMutation.mutate({
                  id: statusModal.id,
                  status: statusModal.newStatus,
                  comment: statusModal.newStatus === 'rejete' ? rejectionComment : statusModal.newStatus === 'risque_accepte' ? riskJustification : undefined,
                })}
              >
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Extend modal */}
      {extendModal && (
        <Modal open={true} onClose={() => { setExtendModal(null); setExtendDate(''); setExtendJustification('') }} title={t('actionPlans.requestExtension')} size="md">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('actionPlans.newDate')} value={extendDate} onChange={setExtendDate} type="date" required />
            <Input label={t('actionPlans.extensionJustification')} value={extendJustification} onChange={setExtendJustification} required />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" onClick={() => { setExtendModal(null); setExtendDate(''); setExtendJustification('') }}>{t('common.cancel')}</Button>
              <Button onClick={() => extendMutation.mutate({ id: extendModal, new_date: extendDate, justification: extendJustification })} disabled={!extendDate || !extendJustification}>
                {t('common.confirm')}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Progress modal */}
      {progressModal && (
        <Modal open={true} onClose={() => setProgressModal(null)} title={t('actionPlans.progress')} size="sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('actionPlans.progress')} value={String(progressValue)} onChange={(v) => setProgressValue(Number(v))} type="number" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setProgressModal(null)}>{t('common.cancel')}</Button>
              <Button onClick={() => progressMutation.mutate({ id: progressModal, progress: progressValue })}>{t('common.confirm')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteId !== null}
        title={t('common.delete')}
        message=""
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}