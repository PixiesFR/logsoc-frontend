import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { governanceApi } from '../../api'
import { Badge, StatCard, Select, Table, Button, Modal, Input, Card, ConfirmDialog } from '../../components/ui'
import { usePermissions } from '../../hooks/usePermissions'
import { useToast } from '../../components/ui/Toast'
import { Building2, Plus, AlertTriangle, ShieldCheck } from 'lucide-react'

function criticalityBadge(criticality: string): 'danger' | 'warning' | 'info' | 'default' {
  switch (criticality) {
    case 'critical': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'info'
    default: return 'default'
  }
}

function complianceBadge(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'compliant': return 'success'
    case 'partial': return 'warning'
    case 'non_compliant': return 'danger'
    default: return 'default'
  }
}

export function Vendors() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [criticalityFilter, setCriticalityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [serviceTypeFilter, setServiceTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const [formName, setFormName] = useState('')
  const [formContact, setFormContact] = useState('')
  const [formServiceType, setFormServiceType] = useState('')
  const [formCriticality, setFormCriticality] = useState('medium')
  const [formContractRef, setFormContractRef] = useState('')
  const [formDeadline, setFormDeadline] = useState('')
  const [formDataAccessed, setFormDataAccessed] = useState('')
  const [formLocation, setFormLocation] = useState('')

  const params: Record<string, string> = {}
  if (criticalityFilter) params.criticality = criticalityFilter
  if (statusFilter) params.compliance_status = statusFilter
  if (serviceTypeFilter) params.service_type = serviceTypeFilter

  const { data: vendors, isLoading } = useQuery({
    queryKey: ['governance', 'vendors', params],
    queryFn: () => governanceApi.vendors(params).then((r) => r.data),
  })

  const { data: vendorDetail } = useQuery({
    queryKey: ['governance', 'vendor', selectedId],
    queryFn: () => governanceApi.getPolicy(selectedId!).then((r) => r.data),
    enabled: selectedId !== null,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => governanceApi.createVendor(data),
    onSuccess: () => {
      toast('success', t('governance.vendors.createSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'vendors'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('governance.vendors.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => governanceApi.deleteVendor(id),
    onSuccess: () => {
      toast('success', t('governance.vendors.deleteSuccess'))
      qc.invalidateQueries({ queryKey: ['governance', 'vendors'] })
      setDeleteId(null)
    },
    onError: () => toast('error', t('governance.vendors.deleteError')),
  })

  function resetForm() {
    setFormName('')
    setFormContact('')
    setFormServiceType('')
    setFormCriticality('medium')
    setFormContractRef('')
    setFormDeadline('')
    setFormDataAccessed('')
    setFormLocation('')
  }

  const items = (Array.isArray(vendors) ? vendors : (vendors as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]
  const total = items.length
  const critical = items.filter((i) => i.criticality === 'critical').length

  const now = new Date()
  const thirtyDays = 30 * 24 * 60 * 60 * 1000
  const nearRenewal = items.filter((i) => {
    const deadline = i.contract_deadline as string | undefined
    if (!deadline) return false
    const d = new Date(deadline)
    return d.getTime() - now.getTime() < thirtyDays && d.getTime() > 0
  }).length

  const criticalityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.vendors.critical'), value: 'critical' },
    { label: t('governance.vendors.high'), value: 'high' },
    { label: t('governance.vendors.medium'), value: 'medium' },
    { label: t('governance.vendors.low'), value: 'low' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('governance.vendors.compliant'), value: 'compliant' },
    { label: t('governance.vendors.partialCompliance'), value: 'partial' },
    { label: t('governance.vendors.nonCompliant'), value: 'non_compliant' },
  ]

  const columns = [
    { key: 'name', label: t('common.name') },
    { key: 'contact', label: t('governance.vendors.contact'), width: '140px' },
    { key: 'service_type', label: t('governance.vendors.serviceType'), width: '140px' },
    { key: 'criticality', label: t('governance.vendors.criticality'), width: '110px' },
    { key: 'contract_deadline', label: t('governance.vendors.contractDeadline'), width: '120px' },
    { key: 'compliance_status', label: t('governance.vendors.complianceStatus'), width: '140px' },
  ]

  const detail = vendorDetail as Record<string, unknown> | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('governance.vendors.title')}
        </h1>
        {canEdit('compliance_officer') && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            {t('governance.vendors.createVendor')}
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <StatCard label={t('common.total')} value={total} icon={<Building2 size={18} />} color="var(--color-accent)" loading={isLoading} />
        <StatCard label={t('governance.vendors.critical')} value={critical} icon={<AlertTriangle size={18} />} color="var(--color-danger)" loading={isLoading} />
        <StatCard label={t('governance.vendors.nearRenewal')} value={nearRenewal} icon={<ShieldCheck size={18} />} color="var(--color-warning)" loading={isLoading} />
      </div>

      {/* Renewal alerts */}
      {nearRenewal > 0 && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-warning)' }} />
            <span style={{ fontSize: '14px', color: 'var(--color-warning)', fontWeight: 500 }}>
              {t('governance.vendors.renewalAlert', { count: String(nearRenewal) })}
            </span>
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '160px' }}>
          <Select value={criticalityFilter} onChange={setCriticalityFilter} options={criticalityOptions} label={t('governance.vendors.criticality')} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} label={t('governance.vendors.complianceStatus')} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Input label={t('governance.vendors.serviceType')} value={serviceTypeFilter} onChange={setServiceTypeFilter} placeholder={t('common.search')} />
        </div>
      </div>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage={t('governance.vendors.noVendors')}
        renderCell={(col, row) => {
          if (col.key === 'criticality') {
            return <Badge variant={criticalityBadge(String(row.criticality))}>{String(row.criticality)}</Badge>
          }
          if (col.key === 'compliance_status') {
            return <Badge variant={complianceBadge(String(row.compliance_status))}>{String(row.compliance_status)}</Badge>
          }
          if (col.key === 'name') {
            return (
              <button
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: 0, font: 'inherit', textAlign: 'left' }}
                onClick={() => setSelectedId(Number(row.id))}
              >
                {String(row.name)}
              </button>
            )
          }
          return String(row[col.key] ?? "")
        }}
      />

      {showCreate && (
        <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm() }} title={t('governance.vendors.createVendor')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('common.name')} value={formName} onChange={setFormName} required />
            <Input label={t('governance.vendors.contact')} value={formContact} onChange={setFormContact} />
            <Input label={t('governance.vendors.serviceType')} value={formServiceType} onChange={setFormServiceType} />
            <Select label={t('governance.vendors.criticality')} value={formCriticality} onChange={setFormCriticality} options={criticalityOptions.slice(1)} />
            <Input label={t('governance.vendors.contractRef')} value={formContractRef} onChange={setFormContractRef} />
            <Input label={t('governance.vendors.contractDeadline')} value={formDeadline} onChange={setFormDeadline} type="date" />
            <Input label={t('governance.vendors.dataAccessed')} value={formDataAccessed} onChange={setFormDataAccessed} />
            <Input label={t('governance.vendors.location')} value={formLocation} onChange={setFormLocation} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ name: formName, contact: formContact, service_type: formServiceType, criticality: formCriticality, contract_ref: formContractRef, contract_deadline: formDeadline, data_accessed: formDataAccessed, location: formLocation })} disabled={!formName}>
              {t('common.create')}
            </Button>
          </div>
        </Modal>
      )}

      {selectedId !== null && detail && (
        <Modal open={selectedId !== null} onClose={() => setSelectedId(null)} title={String(detail.name ?? "")} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Badge variant={criticalityBadge(String(detail.criticality))}>{String(detail.criticality)}</Badge>
              <Badge variant={complianceBadge(String(detail.compliance_status))}>{String(detail.compliance_status)}</Badge>
            </div>
            {String(detail.security_evaluation ?? "") && (
              <Card>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 8px 0' }}>
                  <ShieldCheck size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                  {t('governance.vendors.securityEvaluation')}
                </h3>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>{String(detail.security_evaluation)}</p>
              </Card>
            )}
            {String(detail.data_accessed ?? "") && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <strong>{t('governance.vendors.dataAccessed')}:</strong> {String(detail.data_accessed)}
              </div>
            )}
            {String(detail.location ?? "") && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <strong>{t('governance.vendors.location')}:</strong> {String(detail.location)}
              </div>
            )}
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-secondary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
              <strong>RGPD Art.28:</strong> {t('governance.vendors.gdprArt28')}
            </div>
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
        title={t('governance.vendors.deleteConfirmTitle')}
        message={t('governance.vendors.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMutation.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}