import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { risksApi } from '../api'
import { Card, Badge, StatCard, Modal, Select, Button, EmptyState, Table, useToast, Input, ConfirmDialog } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { ShieldAlert, AlertTriangle, Clock, CheckCircle, Plus, Download, Sparkles } from 'lucide-react'
import { formatTimestamp } from '../utils/eventFormatter'

type RiskStatus = 'open' | 'in_treatment' | 'resolved' | 'closed'

const criticiteVariant = (c: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (c) {
    case 'critical': return 'danger'
    case 'high': return 'warning'
    case 'medium': return 'info'
    case 'low': return 'default'
    default: return 'default'
  }
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'open': return 'danger'
    case 'in_treatment': return 'warning'
    case 'resolved': return 'success'
    case 'closed': return 'default'
    default: return 'default'
  }
}

const MATRIX_COLORS: Record<string, string> = {
  '5': 'var(--color-danger)',
  '4': 'var(--color-danger)',
  '3': 'var(--color-warning)',
  '2': 'var(--color-info)',
  '1': 'var(--color-success)',
}

export function RisquesPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { canEdit } = usePermissions()
  const canModify = canEdit('compliance_officer')

  const [criticiteFilter, setCriticiteFilter] = useState('')
  const [statutFilter, setStatutFilter] = useState('')
  const [proprietaireFilter, setProprietaireFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRisk, setSelectedRisk] = useState<Record<string, unknown> | null>(null)
  const [showAiSuggestions, setShowAiSuggestions] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'matrix'>('table')

  // Form state
  const [formDesc, setFormDesc] = useState('')
  const [formProb, setFormProb] = useState('3')
  const [formImpact, setFormImpact] = useState('3')
  const [formMitigation, setFormMitigation] = useState('')
  const [formOwner, setFormOwner] = useState('')
  const [formStatus, setFormStatus] = useState<RiskStatus>('open')

  const params: Record<string, string> = {}
  if (criticiteFilter) params.criticite = criticiteFilter
  if (statutFilter) params.statut = statutFilter
  if (proprietaireFilter) params.proprietaire = proprietaireFilter

  const { data: risks, isLoading } = useQuery({
    queryKey: ['risks', params],
    queryFn: () => risksApi.list(params).then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['risks', 'stats'],
    queryFn: () => risksApi.stats().then((r) => r.data),
  })

  const { data: aiSuggestions } = useQuery({
    queryKey: ['risks', 'ai-suggestions', selectedRisk?.id],
    queryFn: () => risksApi.aiSuggestions(Number(selectedRisk!.id)).then((r) => r.data),
    enabled: showAiSuggestions && !!selectedRisk,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => risksApi.create(data),
    onSuccess: () => {
      toast('success', t('risques.createSuccess'))
      queryClient.invalidateQueries({ queryKey: ['risks'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('risques.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => risksApi.delete(id),
    onSuccess: () => {
      toast('success', t('risques.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['risks'] })
      setDeleteConfirm(null)
      setSelectedRisk(null)
    },
    onError: () => toast('error', t('risques.deleteError')),
  })

  const resetForm = useCallback(() => {
    setFormDesc('')
    setFormProb('3')
    setFormImpact('3')
    setFormMitigation('')
    setFormOwner('')
    setFormStatus('open')
  }, [])

  const rawRisks = Array.isArray(risks) ? risks : (risks as Record<string, unknown>)?.items as Record<string, unknown>[] || []
  // Map backend fields to frontend column keys
  const risksList = rawRisks.map((r) => ({
    ...r,
    description: r.title ?? r.description ?? r.scenario ?? '-',
    probabilite: r.probability ?? r.likelihood ?? r.probabilite ?? '-',
    criticite: r.criticite ?? r.risk_level ?? (r.inherent_score != null ? (Number(r.inherent_score) >= 15 ? 'critical' : Number(r.inherent_score) >= 10 ? 'high' : Number(r.inherent_score) >= 5 ? 'medium' : 'low') : undefined) ?? '-',
    proprietaire: r.owner ?? r.owner_email ?? r.proprietaire ?? '-',
    date_revue: r.review_date ?? r.next_review ?? r.date_revue ?? r.updated_at ?? '-',
    statut: r.statut ?? r.status ?? 'open',
  }))
  const riskStats = stats as Record<string, unknown> | undefined
  const byStatus = (riskStats?.by_status ?? {}) as Record<string, number>
  const byScoreBand = (riskStats?.by_score_band ?? {}) as Record<string, number>

  const totalRisks = (riskStats?.total as number) ?? risksList.length
  const criticalRisks = (byScoreBand['critical'] as number) ?? (riskStats?.critical as number) ?? risksList.filter((r) => r.criticite === 'critical').length
  const inTreatment = (byStatus['in_treatment'] as number) ?? (riskStats?.in_treatment as number) ?? risksList.filter((r) => r.statut === 'in_treatment').length
  const resolved = (byStatus['resolved'] as number) ?? (byStatus['assessed'] as number) ?? (riskStats?.resolved as number) ?? risksList.filter((r) => r.statut === 'resolved').length

  const criticiteOptions = [
    { label: t('common.all'), value: '' },
    { label: t('risques.criticiteLabels.critical'), value: 'critical' },
    { label: t('risques.criticiteLabels.high'), value: 'high' },
    { label: t('risques.criticiteLabels.medium'), value: 'medium' },
    { label: t('risques.criticiteLabels.low'), value: 'low' },
  ]

  const statutOptions = [
    { label: t('common.all'), value: '' },
    { label: t('risques.statusLabels.open'), value: 'open' },
    { label: t('risques.statusLabels.in_treatment'), value: 'in_treatment' },
    { label: t('risques.statusLabels.resolved'), value: 'resolved' },
    { label: t('risques.statusLabels.closed'), value: 'closed' },
  ]

  const columns = [
    { key: 'description', label: t('risques.description') },
    { key: 'probabilite', label: t('risques.probabilite') },
    { key: 'impact', label: t('risques.impact') },
    { key: 'criticite', label: t('risques.criticite') },
    { key: 'proprietaire', label: t('risques.proprietaire') },
    { key: 'statut', label: t('common.status') },
    { key: 'date_revue', label: t('risques.dateRevue') },
  ]

  const handleExportCsv = useCallback(() => {
    const header = columns.map((c) => c.label).join(',')
    const rows = risksList.map((r) =>
      columns.map((c) => String(r[c.key] ?? '')).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'risques.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [risksList, columns])

  const handleCreate = useCallback(() => {
    createMutation.mutate({
      description: formDesc,
      probabilite: Number(formProb),
      impact: Number(formImpact),
      mesures_mitigation: formMitigation,
      proprietaire: formOwner,
      statut: formStatus,
    })
  }, [createMutation, formDesc, formProb, formImpact, formMitigation, formOwner, formStatus])

  const renderRiskMatrix = () => {
    const probs = [5, 4, 3, 2, 1]
    const impacts = [1, 2, 3, 4, 5]
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(5, 1fr)', gap: '4px' }}>
        <div />
        {impacts.map((i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            {t('risques.impact')} {i}
          </div>
        ))}
        {probs.map((p) =>
          [(
            <div key={`p-${p}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
              {p}
            </div>
          ),
          ...impacts.map((i) => {
            const score = p * i
            const cellRisks = risksList.filter((r) => Number(r.probabilite) === p && Number(r.impact) === i)
            const colorKey = score >= 15 ? '5' : score >= 10 ? '4' : score >= 5 ? '3' : score >= 3 ? '2' : '1'
            return (
              <div
                key={`${p}-${i}`}
                style={{
                  background: MATRIX_COLORS[colorKey],
                  borderRadius: '4px',
                  padding: '8px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: '#fff',
                  fontWeight: 600,
                  cursor: cellRisks.length > 0 ? 'pointer' : 'default',
                  opacity: cellRisks.length > 0 ? 1 : 0.3,
                }}
                onClick={() => {
                  if (cellRisks.length > 0) setSelectedRisk(cellRisks[0])
                }}
              >
                {cellRisks.length > 0 ? cellRisks.length : score}
              </div>
            )
          })]
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('risques.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={handleExportCsv} icon={<Download size={14} />}>
            {t('common.export')}
          </Button>
          {canModify && (
            <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
              {t('risques.createRisk')}
            </Button>
          )}
        </div>
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('risques.totalRisks')} value={totalRisks} icon={<ShieldAlert size={20} />} color="var(--color-accent)" />
        <StatCard label={t('risques.criticalRisks')} value={criticalRisks} icon={<AlertTriangle size={20} />} color="var(--color-danger)" />
        <StatCard label={t('risques.inTreatment')} value={inTreatment} icon={<Clock size={20} />} color="var(--color-warning)" />
        <StatCard label={t('risques.resolved')} value={resolved} icon={<CheckCircle size={20} />} color="var(--color-success)" />
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '180px' }}>
            <Select label={t('risques.criticite')} value={criticiteFilter} onChange={setCriticiteFilter} options={criticiteOptions} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <Select label={t('common.status')} value={statutFilter} onChange={setStatutFilter} options={statutOptions} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <Input label={t('risques.proprietaire')} value={proprietaireFilter} onChange={setProprietaireFilter} />
          </div>
        </div>
      </Card>

      {/* View toggle */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <Button variant={viewMode === 'table' ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode('table')}>
          {t('risques.tableView')}
        </Button>
        <Button variant={viewMode === 'matrix' ? 'primary' : 'secondary'} size="sm" onClick={() => setViewMode('matrix')}>
          {t('risques.matrixView')}
        </Button>
      </div>

      {/* Content */}
      {viewMode === 'matrix' ? (
        <Card>{renderRiskMatrix()}</Card>
      ) : (
        risksList.length === 0 && !isLoading ? (
          <EmptyState icon={<ShieldAlert size={48} />} title={t('risques.noRisks')} />
        ) : (
          <Table
            columns={columns}
            data={risksList}
            loading={isLoading}
            onRowClick={(row) => setSelectedRisk(row)}
            renderCell={(col, row) => {
              if (col.key === 'criticite') {
                return <Badge variant={criticiteVariant(String(row[col.key] ?? ''))}>{t(`risques.criticiteLabels.${row[col.key] ?? 'low'}`)}</Badge>
              }
              if (col.key === 'statut') {
                return <Badge variant={statusVariant(String(row[col.key] ?? ''))}>{t(`risques.statusLabels.${row[col.key] ?? 'open'}`)}</Badge>
              }
              if (col.key === 'date_revue') {
                const raw = String(row[col.key] ?? '')
                if (!raw || raw === '-') return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                return <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{formatTimestamp(raw, false)}</span>
              }
              if (col.key === 'probabilite' || col.key === 'impact') {
                return String(row[col.key] ?? '-')
              }
              return String(row[col.key] ?? '-')
            }}
          />
        )
      )}

      {/* Clickable rows handled by clicking table rows */}
      {risksList.length > 0 && viewMode === 'table' && (
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {t('risques.clickRowDetail')}
        </div>
      )}

      {/* Create Risk Modal */}
      {canModify && (
        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); resetForm() }}
          title={t('risques.createRisk')}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={() => { setShowCreate(false); resetForm() }}>{t('common.cancel')}</Button>
              <Button variant="primary" onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? t('common.loading') : t('common.create')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label={t('risques.description')} value={formDesc} onChange={setFormDesc} required />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Select
                label={`${t('risques.probabilite')} (1-5)`}
                value={formProb}
                onChange={setFormProb}
                options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: String(n) }))}
              />
              <Select
                label={`${t('risques.impact')} (1-5)`}
                value={formImpact}
                onChange={setFormImpact}
                options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: String(n) }))}
              />
            </div>
            <Input label={t('risques.mitigation')} value={formMitigation} onChange={setFormMitigation} />
            <Input label={t('risques.proprietaire')} value={formOwner} onChange={setFormOwner} />
            <Select
              label={t('common.status')}
              value={formStatus}
              onChange={(v) => setFormStatus(v as RiskStatus)}
              options={[
                { label: t('risques.statusLabels.open'), value: 'open' },
                { label: t('risques.statusLabels.in_treatment'), value: 'in_treatment' },
                { label: t('risques.statusLabels.resolved'), value: 'resolved' },
                { label: t('risques.statusLabels.closed'), value: 'closed' },
              ]}
            />
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedRisk && (
        <Modal
          open={!!selectedRisk}
          onClose={() => { setSelectedRisk(null); setShowAiSuggestions(false) }}
          title={t('risques.riskDetail')}
          size="lg"
          footer={
            <>
              {canModify && (
                <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(Number(selectedRisk.id))}>
                  {t('common.delete')}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => setShowAiSuggestions(true)}
                icon={<Sparkles size={14} />}
              >
                {t('risques.askAi')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('risques.description')}
              </span>
              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(selectedRisk.description ?? '')}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('risques.probabilite')}
                </span>
                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                  {String(selectedRisk.probabilite ?? '-')}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('risques.impact')}
                </span>
                <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                  {String(selectedRisk.impact ?? '-')}
                </p>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('risques.criticite')}
              </span>
              <div style={{ marginTop: '4px' }}>
                <Badge variant={criticiteVariant(String(selectedRisk.criticite ?? 'low'))}>
                  {t(`risques.criticiteLabels.${selectedRisk.criticite ?? 'low'}`)}
                </Badge>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('common.status')}
              </span>
              <div style={{ marginTop: '4px' }}>
                <Badge variant={statusVariant(String(selectedRisk.statut ?? 'open'))}>
                  {t(`risques.statusLabels.${selectedRisk.statut ?? 'open'}`)}
                </Badge>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('risques.mitigation')}
              </span>
              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(selectedRisk.mesures_mitigation ?? selectedRisk.mitigation ?? '-')}
              </p>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('risques.proprietaire')}
              </span>
              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(selectedRisk.proprietaire ?? '-')}
              </p>
            </div>
            {selectedRisk.date_revu && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('risques.dateRevue')}
                </span>
                <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                  {String(selectedRisk.date_revu ?? selectedRisk.date_revue ?? '-')}
                </p>
              </div>
            )}
            {showAiSuggestions && aiSuggestions && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-accent)' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)' }}>
                  {t('risques.aiSuggestions')}
                </span>
                <pre style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '8px 0 0', whiteSpace: 'pre-wrap' }}>
                  {typeof aiSuggestions === 'string' ? aiSuggestions : JSON.stringify(aiSuggestions, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={t('risques.deleteConfirmTitle')}
        message={t('risques.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteConfirm !== null) deleteMutation.mutate(deleteConfirm) }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}