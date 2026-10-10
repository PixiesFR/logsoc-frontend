import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { gdprExtApi } from '../api'
import { Card, Badge, StatCard, Tabs, Table, Button, Modal, Input, ConfirmDialog, AIAssistButton } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Database, FileCheck, Mail, Users, ArrowRightLeft, AlertTriangle } from 'lucide-react'

function statusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'compliant': case 'approved': case 'completed': case 'resolved': return 'success'
    case 'partial': case 'in_progress': case 'pending': return 'warning'
    case 'non-compliant': case 'rejected': case 'overdue': return 'danger'
    default: return 'default'
  }
}

export function GdprExtendedPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()
  const isEditor = canEdit('compliance_officer')

  const [activeTab, setActiveTab] = useState('treatments')
  const [createModal, setCreateModal] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: number } | null>(null)

  const [newTreatmentName, setNewTreatmentName] = useState('')
  const [newDpiaName, setNewDpiaName] = useState('')
  const [newRequestType, setNewRequestType] = useState('')
  const [newSubprocessorName, setNewSubprocessorName] = useState('')
  const [newTransferDest, setNewTransferDest] = useState('')
  const [newBreachTitle, setNewBreachTitle] = useState('')

  // Queries
  const { data: treatments, isLoading: treatmentsLoading } = useQuery({
    queryKey: ['gdpr-ext', 'treatments'],
    queryFn: () => gdprExtApi.treatments().then((r) => r.data),
    enabled: canEdit('viewer'),
  })

  const { data: dpias, isLoading: dpiasLoading } = useQuery({
    queryKey: ['gdpr-ext', 'dpia'],
    queryFn: () => gdprExtApi.dpia().then((r) => r.data),
    enabled: canEdit('viewer'),
  })

  const { data: requests, isLoading: requestsLoading } = useQuery({
    queryKey: ['gdpr-ext', 'requests'],
    queryFn: () => gdprExtApi.requests().then((r) => r.data),
    enabled: canEdit('viewer'),
  })

  const { data: subprocessors, isLoading: subprocessorsLoading } = useQuery({
    queryKey: ['gdpr-ext', 'subprocessors'],
    queryFn: () => gdprExtApi.subprocessors().then((r) => r.data),
    enabled: canEdit('viewer'),
  })

  const { data: transfers, isLoading: transfersLoading } = useQuery({
    queryKey: ['gdpr-ext', 'transfers'],
    queryFn: () => gdprExtApi.transfers().then((r) => r.data),
    enabled: canEdit('viewer'),
  })

  const { data: breaches, isLoading: breachesLoading } = useQuery({
    queryKey: ['gdpr-ext', 'breaches'],
    queryFn: () => gdprExtApi.breaches().then((r) => r.data),
    enabled: canEdit('viewer'),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['gdpr-ext', 'summary'],
    queryFn: () => gdprExtApi.summary().then((r) => r.data),
    enabled: canEdit('viewer'),
  })

  // Mutations
  const createTreatment = useMutation({
    mutationFn: () => gdprExtApi.treatmentsCreate({ name: newTreatmentName }),
    onSuccess: () => { toast('success', t('compliance.createSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'treatments'] }); setCreateModal(null); setNewTreatmentName('') },
    onError: () => toast('error', t('compliance.createError')),
  })

  const deleteTreatment = useMutation({
    mutationFn: (id: number) => gdprExtApi.treatmentsDelete(id),
    onSuccess: () => { toast('success', t('compliance.deleteSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'treatments'] }); setDeleteTarget(null) },
    onError: () => toast('error', t('compliance.deleteError')),
  })

  const createDpia = useMutation({
    mutationFn: () => gdprExtApi.dpiaCreate({ name: newDpiaName }),
    onSuccess: () => { toast('success', t('compliance.createSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'dpia'] }); setCreateModal(null); setNewDpiaName('') },
    onError: () => toast('error', t('compliance.createError')),
  })

  const createRequest = useMutation({
    mutationFn: () => gdprExtApi.requestsCreate({ type: newRequestType }),
    onSuccess: () => { toast('success', t('compliance.createSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'requests'] }); setCreateModal(null); setNewRequestType('') },
    onError: () => toast('error', t('compliance.createError')),
  })

  const createSubprocessor = useMutation({
    mutationFn: () => gdprExtApi.subprocessorsCreate({ name: newSubprocessorName }),
    onSuccess: () => { toast('success', t('compliance.createSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'subprocessors'] }); setCreateModal(null); setNewSubprocessorName('') },
    onError: () => toast('error', t('compliance.createError')),
  })

  const deleteSubprocessor = useMutation({
    mutationFn: (id: number) => gdprExtApi.subprocessorsDelete(id),
    onSuccess: () => { toast('success', t('compliance.deleteSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'subprocessors'] }); setDeleteTarget(null) },
    onError: () => toast('error', t('compliance.deleteError')),
  })

  const createTransfer = useMutation({
    mutationFn: () => gdprExtApi.transfersCreate({ destination: newTransferDest }),
    onSuccess: () => { toast('success', t('compliance.createSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'transfers'] }); setCreateModal(null); setNewTransferDest('') },
    onError: () => toast('error', t('compliance.createError')),
  })

  const createBreach = useMutation({
    mutationFn: () => gdprExtApi.breachesCreate({ title: newBreachTitle }),
    onSuccess: () => { toast('success', t('compliance.createSuccess')); qc.invalidateQueries({ queryKey: ['gdpr-ext', 'breaches'] }); setCreateModal(null); setNewBreachTitle('') },
    onError: () => toast('error', t('compliance.createError')),
  })

  const toList = (data: unknown): Record<string, unknown>[] => {
    if (Array.isArray(data)) return data
    if (data && typeof data === 'object' && 'items' in (data as Record<string, unknown>)) return (data as Record<string, unknown>).items as Record<string, unknown>[] ?? []
    return []
  }

  const summaryData = summary as Record<string, unknown> | null

  const tabItems = [
    { key: 'treatments', label: t('compliance.treatments'), count: toList(treatments).length },
    { key: 'dpia', label: t('compliance.dpia'), count: toList(dpias).length },
    { key: 'requests', label: t('compliance.requests'), count: toList(requests).length },
    { key: 'subprocessors', label: t('compliance.subprocessors'), count: toList(subprocessors).length },
    { key: 'transfers', label: t('compliance.transfers'), count: toList(transfers).length },
    { key: 'breaches', label: t('compliance.breaches'), count: toList(breaches).length },
    { key: 'summary', label: t('compliance.summary') },
  ]

  const treatmentCols = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'name', label: t('common.name') },
    { key: 'status', label: t('common.status'), width: '130px' },
    { key: 'created_at', label: t('common.date'), width: '120px' },
  ]

  const dpiaCols = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'name', label: t('common.name') },
    { key: 'status', label: t('common.status'), width: '130px' },
    { key: 'risk_score', label: t('compliance.riskScore'), width: '100px' },
  ]

  const requestCols = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'type', label: t('common.type') },
    { key: 'status', label: t('common.status'), width: '130px' },
    { key: 'created_at', label: t('common.date'), width: '120px' },
  ]

  const subprocessorCols = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'name', label: t('common.name') },
    { key: 'country', label: t('compliance.country'), width: '100px' },
  ]

  const transferCols = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'destination', label: t('compliance.destination') },
    { key: 'mechanism', label: t('compliance.mechanism'), width: '130px' },
    { key: 'status', label: t('common.status'), width: '130px' },
  ]

  const breachCols = [
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'title', label: t('common.name') },
    { key: 'status', label: t('common.status'), width: '130px' },
    { key: 'severity', label: t('common.severity'), width: '100px' },
  ]

  const renderBadge = (col: { key: string }, row: Record<string, unknown>) => {
    if (col.key === 'status') return <Badge variant={statusVariant(String(row.status ?? ''))} size="sm">{String(row.status ?? '—')}</Badge>
    if (col.key === 'severity') return <Badge variant={statusVariant(String(row.severity ?? ''))} size="sm">{String(row.severity ?? '—')}</Badge>
    return String(row[col.key] ?? '—')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('compliance.gdprExtended')}
        </h1>
        <AIAssistButton contextType="gdpr" contextData={{}} labelKey="aiAssist.analyzeGdpr" />
      </div>

      <Tabs tabs={tabItems} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'treatments' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('compliance.treatments')}</h3>
            {isEditor && <Button size="sm" icon={<Database size={14} />} onClick={() => setCreateModal('treatment')}>{t('common.create')}</Button>}
          </div>
          <Table columns={treatmentCols} data={toList(treatments) as unknown as Record<string, unknown>[]} renderCell={renderBadge} loading={treatmentsLoading} emptyMessage={t('compliance.noTreatments')} />
        </Card>
      )}

      {activeTab === 'dpia' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('compliance.dpia')}</h3>
            {isEditor && <Button size="sm" icon={<FileCheck size={14} />} onClick={() => setCreateModal('dpia')}>{t('common.create')}</Button>}
          </div>
          <Table columns={dpiaCols} data={toList(dpias) as unknown as Record<string, unknown>[]} renderCell={renderBadge} loading={dpiasLoading} emptyMessage={t('compliance.noDpia')} />
        </Card>
      )}

      {activeTab === 'requests' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('compliance.requests')}</h3>
            {isEditor && <Button size="sm" icon={<Mail size={14} />} onClick={() => setCreateModal('request')}>{t('common.create')}</Button>}
          </div>
          <Table columns={requestCols} data={toList(requests) as unknown as Record<string, unknown>[]} renderCell={renderBadge} loading={requestsLoading} emptyMessage={t('compliance.noRequests')} />
        </Card>
      )}

      {activeTab === 'subprocessors' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('compliance.subprocessors')}</h3>
            {isEditor && <Button size="sm" icon={<Users size={14} />} onClick={() => setCreateModal('subprocessor')}>{t('common.create')}</Button>}
          </div>
          <Table columns={subprocessorCols} data={toList(subprocessors) as unknown as Record<string, unknown>[]} renderCell={(col, row) => {
            if (col.key === 'status') return <Badge variant={statusVariant(String(row.status ?? ''))} size="sm">{String(row.status ?? '—')}</Badge>
            return String(row[col.key] ?? '—')
          }} loading={subprocessorsLoading} emptyMessage={t('compliance.noSubprocessors')} />
        </Card>
      )}

      {activeTab === 'transfers' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('compliance.transfers')}</h3>
            {isEditor && <Button size="sm" icon={<ArrowRightLeft size={14} />} onClick={() => setCreateModal('transfer')}>{t('common.create')}</Button>}
          </div>
          <Table columns={transferCols} data={toList(transfers) as unknown as Record<string, unknown>[]} renderCell={renderBadge} loading={transfersLoading} emptyMessage={t('compliance.noTransfers')} />
        </Card>
      )}

      {activeTab === 'breaches' && (
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('compliance.breaches')}</h3>
            {isEditor && <Button size="sm" icon={<AlertTriangle size={14} />} onClick={() => setCreateModal('breach')}>{t('common.create')}</Button>}
          </div>
          <Table columns={breachCols} data={toList(breaches) as unknown as Record<string, unknown>[]} renderCell={renderBadge} loading={breachesLoading} emptyMessage={t('compliance.noBreaches')} />
        </Card>
      )}

      {activeTab === 'summary' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <StatCard label={t('compliance.treatments')} value={Number(summaryData?.treatments_count ?? toList(treatments).length)} icon={<Database size={20} style={{ color: 'var(--color-accent)' }} />} loading={summaryLoading} />
          <StatCard label={t('compliance.dpia')} value={Number(summaryData?.dpia_count ?? toList(dpias).length)} icon={<FileCheck size={20} style={{ color: 'var(--color-success)' }} />} loading={summaryLoading} />
          <StatCard label={t('compliance.requests')} value={Number(summaryData?.requests_count ?? toList(requests).length)} icon={<Mail size={20} style={{ color: 'var(--color-info)' }} />} loading={summaryLoading} />
          <StatCard label={t('compliance.breaches')} value={Number(summaryData?.breaches_count ?? toList(breaches).length)} icon={<AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />} loading={summaryLoading} />
          <StatCard label={t('compliance.subprocessors')} value={Number(summaryData?.subprocessors_count ?? toList(subprocessors).length)} icon={<Users size={20} style={{ color: 'var(--color-warning)' }} />} loading={summaryLoading} />
          <StatCard label={t('compliance.transfers')} value={Number(summaryData?.transfers_count ?? toList(transfers).length)} icon={<ArrowRightLeft size={20} style={{ color: 'var(--color-text-secondary)' }} />} loading={summaryLoading} />
        </div>
      )}

      {/* Create Modals */}
      <Modal open={createModal === 'treatment'} onClose={() => { setCreateModal(null); setNewTreatmentName('') }} title={t('compliance.createTreatment')} size="sm"
        footer={<><Button variant="secondary" onClick={() => { setCreateModal(null); setNewTreatmentName('') }}>{t('common.cancel')}</Button><Button onClick={() => createTreatment.mutate()}>{t('common.create')}</Button></>}>
        <Input label={t('common.name')} value={newTreatmentName} onChange={setNewTreatmentName} required />
      </Modal>

      <Modal open={createModal === 'dpia'} onClose={() => { setCreateModal(null); setNewDpiaName('') }} title={t('compliance.createDpia')} size="sm"
        footer={<><Button variant="secondary" onClick={() => { setCreateModal(null); setNewDpiaName('') }}>{t('common.cancel')}</Button><Button onClick={() => createDpia.mutate()}>{t('common.create')}</Button></>}>
        <Input label={t('common.name')} value={newDpiaName} onChange={setNewDpiaName} required />
      </Modal>

      <Modal open={createModal === 'request'} onClose={() => { setCreateModal(null); setNewRequestType('') }} title={t('compliance.createRequest')} size="sm"
        footer={<><Button variant="secondary" onClick={() => { setCreateModal(null); setNewRequestType('') }}>{t('common.cancel')}</Button><Button onClick={() => createRequest.mutate()}>{t('common.create')}</Button></>}>
        <Input label={t('common.type')} value={newRequestType} onChange={setNewRequestType} required />
      </Modal>

      <Modal open={createModal === 'subprocessor'} onClose={() => { setCreateModal(null); setNewSubprocessorName('') }} title={t('compliance.createSubprocessor')} size="sm"
        footer={<><Button variant="secondary" onClick={() => { setCreateModal(null); setNewSubprocessorName('') }}>{t('common.cancel')}</Button><Button onClick={() => createSubprocessor.mutate()}>{t('common.create')}</Button></>}>
        <Input label={t('common.name')} value={newSubprocessorName} onChange={setNewSubprocessorName} required />
      </Modal>

      <Modal open={createModal === 'transfer'} onClose={() => { setCreateModal(null); setNewTransferDest('') }} title={t('compliance.createTransfer')} size="sm"
        footer={<><Button variant="secondary" onClick={() => { setCreateModal(null); setNewTransferDest('') }}>{t('common.cancel')}</Button><Button onClick={() => createTransfer.mutate()}>{t('common.create')}</Button></>}>
        <Input label={t('compliance.destination')} value={newTransferDest} onChange={setNewTransferDest} required />
      </Modal>

      <Modal open={createModal === 'breach'} onClose={() => { setCreateModal(null); setNewBreachTitle('') }} title={t('compliance.createBreach')} size="sm"
        footer={<><Button variant="secondary" onClick={() => { setCreateModal(null); setNewBreachTitle('') }}>{t('common.cancel')}</Button><Button onClick={() => createBreach.mutate()}>{t('common.create')}</Button></>}>
        <Input label={t('common.name')} value={newBreachTitle} onChange={setNewBreachTitle} required />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title={t('common.delete')}
        message={t('compliance.deleteConfirm')}
        onConfirm={() => {
          if (deleteTarget) {
            if (deleteTarget.type === 'treatment') deleteTreatment.mutate(deleteTarget.id)
            else if (deleteTarget.type === 'subprocessor') deleteSubprocessor.mutate(deleteTarget.id)
          }
        }}
        onCancel={() => setDeleteTarget(null)}
        variant="danger"
      />
    </div>
  )
}