import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { runbookApi } from '../api'
import { Card, Badge, StatCard, Modal, Select, Button, EmptyState, Table, useToast, Input, ConfirmDialog, AIAssistButton } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { BookOpen, CheckCircle, Clock, Plus } from 'lucide-react'

type RunbookType = 'pra' | 'pca' | 'pri' | 'sc' | 'fore' | 'test' | 'phishing' | 'ransomware' | 'intrusion' | 'data_leak' | 'other'

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'active': return 'success'
    case 'draft': return 'warning'
    case 'archived': return 'default'
    default: return 'default'
  }
}

const typeVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'pra': return 'info'
    case 'pca': return 'warning'
    case 'pri': return 'default'
    case 'sc': return 'info'
    case 'fore': return 'danger'
    case 'test': return 'success'
    case 'phishing': return 'info'
    case 'ransomware': return 'danger'
    case 'intrusion': return 'warning'
    case 'data_leak': return 'danger'
    default: return 'default'
  }
}

const TEMPLATES: Record<string, Record<string, string>> = {
  pra: { title: 'PCA/PRA', description: "Procédure de continuité/reprise d'activité", type: 'pra' },
  pca: { title: 'PCA', description: 'Mode dégradé lecture seule', type: 'pca' },
  pri: { title: 'PRI', description: 'Capacity planning trimestriel', type: 'pri' },
  sc: { title: 'Supply Chain', description: 'SBOM + scan vulnérabilités', type: 'sc' },
  fore: { title: 'Forensique', description: "Acquisition d'image disque", type: 'fore' },
  test: { title: 'Test', description: 'Exercice tabletop', type: 'test' },
}

export function RunbookPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { canEdit } = usePermissions()
  const canModify = canEdit('analyst')

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRunbook, setSelectedRunbook] = useState<Record<string, unknown> | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Create form
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formType, setFormType] = useState<RunbookType>('pra')
  const [formSteps, setFormSteps] = useState('')
  const [formRole, setFormRole] = useState('')
  const [formDelay, setFormDelay] = useState('')
  const [formFrequency, setFormFrequency] = useState('')

  const params: Record<string, string> = {}
  if (typeFilter) params.type = typeFilter
  if (statusFilter) params.statut = statusFilter

  const { data: runbooks, isLoading } = useQuery({
    queryKey: ['runbook', params],
    queryFn: () => runbookApi.list(params).then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['runbook', 'stats'],
    queryFn: () => runbookApi.stats().then((r) => r.data),
  })

  const { data: reviews } = useQuery({
    queryKey: ['runbook', 'reviews', selectedRunbook?.id],
    queryFn: () => runbookApi.reviews(Number(selectedRunbook!.id)).then((r) => r.data),
    enabled: !!selectedRunbook,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => runbookApi.create(data),
    onSuccess: () => {
      toast('success', t('runbook.createSuccess'))
      queryClient.invalidateQueries({ queryKey: ['runbook'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('runbook.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => runbookApi.delete(id),
    onSuccess: () => {
      toast('success', t('runbook.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['runbook'] })
      setDeleteConfirm(null)
      setSelectedRunbook(null)
    },
    onError: () => toast('error', t('runbook.deleteError')),
  })

  const resetForm = useCallback(() => {
    setFormTitle('')
    setFormDesc('')
    setFormType('pra')
    setFormSteps('')
    setFormRole('')
    setFormDelay('')
    setFormFrequency('')
  }, [])

  const runbookList = Array.isArray(runbooks) ? runbooks : (runbooks as Record<string, unknown>)?.items as Record<string, unknown>[] || []
  const runbookStats = stats as Record<string, unknown> | undefined

  const totalRunbooks = (runbookStats?.total as number) ?? runbookList.length
  const successRate = (runbookStats?.success_rate as number) ?? 0
  const avgTime = (runbookStats?.avg_execution_time as number) ?? 0

  const typeOptions = [
    { label: t('common.all'), value: '' },
    { label: t('runbook.typeLabels.pra'), value: 'pra' },
    { label: t('runbook.typeLabels.pca'), value: 'pca' },
    { label: t('runbook.typeLabels.pri'), value: 'pri' },
    { label: t('runbook.typeLabels.sc'), value: 'sc' },
    { label: t('runbook.typeLabels.fore'), value: 'fore' },
    { label: t('runbook.typeLabels.test'), value: 'test' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('runbook.statusLabels.active'), value: 'active' },
    { label: t('runbook.statusLabels.draft'), value: 'draft' },
    { label: t('runbook.statusLabels.archived'), value: 'archived' },
  ]

  const columns = [
    { key: 'title', label: t('runbook.title_field') },
    { key: 'section', label: t('common.type') },
    { key: 'last_reviewed_at', label: t('runbook.responseTime') },
    { key: 'next_review_at', label: t('runbook.reviewFrequency') },
    { key: 'version', label: t('runbook.executions') },
  ]

  const handleCreate = useCallback(() => {
    createMutation.mutate({
      title: formTitle,
      description: formDesc,
      type: formType,
      etapes: formSteps.split('\n').filter((s) => s.trim()),
      role_requis: formRole,
      delai_intervention: formDelay,
      frequence_revue: formFrequency,
    })
  }, [createMutation, formTitle, formDesc, formType, formSteps, formRole, formDelay, formFrequency])

  const handleTemplate = useCallback((key: string) => {
    const tmpl = TEMPLATES[key]
    if (tmpl) {
      setFormTitle(tmpl.title)
      setFormDesc(tmpl.description)
      setFormType(key as RunbookType)
    }
  }, [])

  const stepsList = selectedRunbook
    ? Array.isArray(selectedRunbook.etapes)
      ? (selectedRunbook.etapes as unknown[])
      : typeof selectedRunbook.etapes === 'string'
        ? (selectedRunbook.etapes as string).split('\n')
        : []
    : []

  const reviewsList = Array.isArray(reviews) ? reviews : []

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('runbook.title')}
        </h1>
        {canModify && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
            {t('runbook.createRunbook')}
          </Button>
        )}
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('runbook.totalRunbooks')} value={totalRunbooks} icon={<BookOpen size={20} />} color="var(--color-accent)" />
        <StatCard label={t('runbook.successRate')} value={`${successRate}%`} icon={<CheckCircle size={20} />} color="var(--color-success)" />
        <StatCard label={t('runbook.avgExecutionTime')} value={avgTime ? `${avgTime}min` : '-'} icon={<Clock size={20} />} color="var(--color-info)" />
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '180px' }}>
            <Select label={t('common.type')} value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <Select label={t('common.status')} value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </div>
        </div>
      </Card>

      {/* Table */}
      {runbookList.length === 0 && !isLoading ? (
        <EmptyState icon={<BookOpen size={48} />} title={t('runbook.noRunbooks')} />
      ) : (
        <Table
          columns={columns}
          data={runbookList}
          loading={isLoading}
          renderCell={(col, row) => {
            if (col.key === 'section') {
              return <Badge variant={typeVariant(String(row[col.key] ?? ''))}>{t(`runbook.typeLabels.${row[col.key] ?? 'other'}`)}</Badge>
            }
            if (col.key === 'last_reviewed_at' || col.key === 'next_review_at') {
              return String(row[col.key] ?? '-')
            }
            return String(row[col.key] ?? '-')
          }}
        />
      )}

      {/* Create Runbook Modal */}
      {canModify && (
        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); resetForm() }}
          title={t('runbook.createRunbook')}
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
            {/* Templates */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>
                {t('runbook.templates')}
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {Object.keys(TEMPLATES).map((key) => (
                  <Button key={key} variant="secondary" size="sm" onClick={() => handleTemplate(key)}>
                    {t(`runbook.typeLabels.${key}`)}
                  </Button>
                ))}
              </div>
            </div>
            <Input label={t('runbook.title_field')} value={formTitle} onChange={setFormTitle} required />
            <Input label={t('common.description')} value={formDesc} onChange={setFormDesc} />
            <Select
              label={t('common.type')}
              value={formType}
              onChange={(v) => setFormType(v as RunbookType)}
              options={[
                { label: t('runbook.typeLabels.pra'), value: 'pra' },
                { label: t('runbook.typeLabels.pca'), value: 'pca' },
                { label: t('runbook.typeLabels.pri'), value: 'pri' },
                { label: t('runbook.typeLabels.sc'), value: 'sc' },
                { label: t('runbook.typeLabels.fore'), value: 'fore' },
                { label: t('runbook.typeLabels.test'), value: 'test' },
              ]}
            />
            <div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                {t('runbook.steps')}
              </span>
              <textarea
                value={formSteps}
                onChange={(e) => setFormSteps(e.target.value)}
                placeholder={t('runbook.stepsPlaceholder')}
                rows={6}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-secondary)',
                  color: 'var(--color-text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginTop: '4px',
                  resize: 'vertical',
                }}
              />
            </div>
            <Input label={t('runbook.requiredRole')} value={formRole} onChange={setFormRole} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Input label={t('runbook.responseTime')} value={formDelay} onChange={setFormDelay} />
              <Input label={t('runbook.reviewFrequency')} value={formFrequency} onChange={setFormFrequency} />
            </div>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedRunbook && (
        <Modal
          open={!!selectedRunbook}
          onClose={() => setSelectedRunbook(null)}
          title={t('runbook.runbookDetail')}
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <AIAssistButton contextType="runbooks" contextData={selectedRunbook} labelKey="aiAssist.improveRunbook" />
              {canModify ? (
                <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(Number(selectedRunbook.id))}>
                  {t('common.delete')}
                </Button>
              ) : null}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('runbook.title_field')}
              </span>
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(selectedRunbook.title ?? '')}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('common.type')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={typeVariant(String(selectedRunbook.type ?? 'other'))}>
                    {t(`runbook.typeLabels.${selectedRunbook.type ?? 'other'}`)}
                  </Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('common.status')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={statusVariant(String(selectedRunbook.statut ?? 'draft'))}>
                    {t(`runbook.statusLabels.${selectedRunbook.statut ?? 'draft'}`)}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('common.description')}
              </span>
              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(selectedRunbook.description ?? '-')}
              </p>
            </div>
            {/* Steps checklist */}
            {stepsList.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('runbook.steps')}
                </span>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {stepsList.map((step: unknown, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '8px', borderRadius: '6px', background: 'var(--color-bg-primary)' }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid var(--color-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 600, color: 'var(--color-accent)', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{String(step)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Reviews history */}
            {reviewsList.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('runbook.reviews')}
                </span>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {reviewsList.map((rev: Record<string, unknown>, i: number) => (
                    <div key={i} style={{ padding: '8px', borderRadius: '6px', background: 'var(--color-bg-primary)', fontSize: '13px', color: 'var(--color-text-primary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{String(rev.reviewer ?? rev.reviewer_name ?? t('runbook.unknownReviewer'))}</span>
                        <span style={{ color: 'var(--color-text-secondary)' }}>{String(rev.date ?? rev.created_at ?? '')}</span>
                      </div>
                      {rev.comment ? <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{String(rev.comment)}</p> : null}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={t('runbook.deleteConfirmTitle')}
        message={t('runbook.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteConfirm !== null) deleteMutation.mutate(deleteConfirm) }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}