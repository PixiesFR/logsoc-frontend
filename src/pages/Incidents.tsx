import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { casesApi } from '../api'
import { Card, Badge, StatCard, Modal, Select, Button, EmptyState, Table, useToast, Input, ConfirmDialog, AIAssistButton } from '../components/ui'
import { AlertTriangle, Clock, CheckCircle, ShieldAlert, Plus, Download } from 'lucide-react'

type IncidentStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed'
type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low'

const severityVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'default'
    default: return 'default'
  }
}

const incidentStatusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'open': return 'danger'
    case 'investigating': return 'warning'
    case 'contained': return 'info'
    case 'resolved': return 'success'
    case 'closed': return 'default'
    default: return 'default'
  }
}

export function IncidentsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedIncident, setSelectedIncident] = useState<Record<string, unknown> | null>(null)
  const [closeConfirm, setCloseConfirm] = useState<number | null>(null)
  const [postMortemText, setPostMortemText] = useState('')
  const [showPostMortem, setShowPostMortem] = useState(false)
  const [statusChange, setStatusChange] = useState<{ id: number; status: string } | null>(null)
  const [commentText, setCommentText] = useState('')

  // Create form
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formSeverity, setFormSeverity] = useState<IncidentSeverity>('medium')
  const [formType, setFormType] = useState('')
  const [formOwner, setFormOwner] = useState('')

  const params: Record<string, string> = {}
  if (severityFilter) params.severity = severityFilter
  if (statusFilter) params.status = statusFilter
  if (typeFilter) params.type = typeFilter

  const { data: incidents, isLoading } = useQuery({
    queryKey: ['incidents', params],
    queryFn: () => casesApi.list(params).then((r) => r.data),
  })

  const { data: stats } = useQuery({
    queryKey: ['incidents', 'stats'],
    queryFn: () => casesApi.stats().then((r) => r.data),
  })

  const { data: timeline } = useQuery({
    queryKey: ['incidents', 'timeline', selectedIncident?.id],
    queryFn: () => casesApi.getTimeline(Number(selectedIncident!.id)).then((r) => r.data),
    enabled: !!selectedIncident,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => casesApi.create(data),
    onSuccess: () => {
      toast('success', t('incidents.createSuccess'))
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('incidents.createError')),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => casesApi.changeStatus(id, status),
    onSuccess: () => {
      toast('success', t('incidents.statusUpdateSuccess'))
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setStatusChange(null)
    },
    onError: () => toast('error', t('incidents.statusUpdateError')),
  })

  const closeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => casesApi.close(id, data),
    onSuccess: () => {
      toast('success', t('incidents.closeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setCloseConfirm(null)
      setShowPostMortem(false)
      setSelectedIncident(null)
      setPostMortemText('')
    },
    onError: () => toast('error', t('incidents.closeError')),
  })

  const commentMutation = useMutation({
    mutationFn: ({ id, note }: { id: number; note: string }) => casesApi.addComment(id, note),
    onSuccess: () => {
      toast('success', t('incidents.commentSuccess'))
      queryClient.invalidateQueries({ queryKey: ['incidents', 'timeline'] })
      setCommentText('')
    },
    onError: () => toast('error', t('incidents.commentError')),
  })

  const resetForm = useCallback(() => {
    setFormTitle('')
    setFormDesc('')
    setFormSeverity('medium')
    setFormType('')
    setFormOwner('')
  }, [])

  const incidentsList = Array.isArray(incidents) ? incidents : (incidents as Record<string, unknown>)?.items as Record<string, unknown>[] || []
  const incidentStats = stats as Record<string, unknown> | undefined

  const mttd = (incidentStats?.mttd as number) ?? 0
  const mttr = (incidentStats?.mttr as number) ?? 0
  const openCount = (incidentStats?.open as number) ?? incidentsList.filter((i) => i.status === 'open' || i.status === 'investigating').length
  const resolvedCount = (incidentStats?.resolved as number) ?? incidentsList.filter((i) => i.status === 'resolved' || i.status === 'closed').length

  const severityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('incidents.severityLabels.critical'), value: 'critical' },
    { label: t('incidents.severityLabels.high'), value: 'high' },
    { label: t('incidents.severityLabels.medium'), value: 'medium' },
    { label: t('incidents.severityLabels.low'), value: 'low' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('incidents.statusLabels.open'), value: 'open' },
    { label: t('incidents.statusLabels.investigating'), value: 'investigating' },
    { label: t('incidents.statusLabels.contained'), value: 'contained' },
    { label: t('incidents.statusLabels.resolved'), value: 'resolved' },
    { label: t('incidents.statusLabels.closed'), value: 'closed' },
  ]

  const typeOptions = [
    { label: t('common.all'), value: '' },
    { label: t('incidents.typeLabels.malware'), value: 'malware' },
    { label: t('incidents.typeLabels.phishing'), value: 'phishing' },
    { label: t('incidents.typeLabels.intrusion'), value: 'intrusion' },
    { label: t('incidents.typeLabels.dataLeak'), value: 'data_leak' },
    { label: t('incidents.typeLabels.ddos'), value: 'ddos' },
    { label: t('incidents.typeLabels.other'), value: 'other' },
  ]

  const columns = [
    { key: 'title', label: t('incidents.title_field') },
    { key: 'severity', label: t('common.severity') },
    { key: 'status', label: t('common.status') },
    { key: 'proprietaire', label: t('incidents.owner') },
    { key: 'created_at', label: t('common.date') },
    { key: 'assets_impacted', label: t('incidents.assetsImpacted') },
  ]

  const handleExportCsv = useCallback(() => {
    const header = columns.map((c) => c.label).join(',')
    const rows = incidentsList.map((r) =>
      columns.map((c) => String(r[c.key] ?? '')).join(',')
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'incidents.csv'
    a.click()
    URL.revokeObjectURL(url)
  }, [incidentsList, columns])

  const handleCreate = useCallback(() => {
    createMutation.mutate({
      title: formTitle,
      description: formDesc,
      severity: formSeverity,
      type: formType,
      proprietaire: formOwner,
    })
  }, [createMutation, formTitle, formDesc, formSeverity, formType, formOwner])

  const timelineList = Array.isArray(timeline) ? timeline : []

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('incidents.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" onClick={handleExportCsv} icon={<Download size={14} />}>
            {t('common.export')}
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
            {t('incidents.createIncident')}
          </Button>
        </div>
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        <StatCard label={t('incidents.mttd')} value={mttd ? `${mttd}h` : '-'} icon={<Clock size={20} />} color="var(--color-warning)" />
        <StatCard label={t('incidents.mttr')} value={mttr ? `${mttr}h` : '-'} icon={<Clock size={20} />} color="var(--color-info)" />
        <StatCard label={t('incidents.openIncidents')} value={openCount} icon={<AlertTriangle size={20} />} color="var(--color-danger)" />
        <StatCard label={t('incidents.resolved')} value={resolvedCount} icon={<CheckCircle size={20} />} color="var(--color-success)" />
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('common.severity')} value={severityFilter} onChange={setSeverityFilter} options={severityOptions} />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('common.status')} value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </div>
          <div style={{ minWidth: '160px' }}>
            <Select label={t('common.type')} value={typeFilter} onChange={setTypeFilter} options={typeOptions} />
          </div>
        </div>
      </Card>

      {/* Table */}
      {incidentsList.length === 0 && !isLoading ? (
        <EmptyState icon={<ShieldAlert size={48} />} title={t('incidents.noIncidents')} />
      ) : (
        <Table
          columns={columns}
          data={incidentsList}
          loading={isLoading}
          renderCell={(col, row) => {
            if (col.key === 'severity') {
              return <Badge variant={severityVariant(String(row[col.key] ?? ''))}>{t(`incidents.severityLabels.${row[col.key] ?? 'low'}`)}</Badge>
            }
            if (col.key === 'status') {
              return <Badge variant={incidentStatusVariant(String(row[col.key] ?? ''))}>{t(`incidents.statusLabels.${row[col.key] ?? 'open'}`)}</Badge>
            }
            return String(row[col.key] ?? '-')
          }}
        />
      )}

      {/* Create Incident Modal */}
      <Modal
        open={showCreate}
        onClose={() => { setShowCreate(false); resetForm() }}
        title={t('incidents.createIncident')}
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
          <Input label={t('incidents.title_field')} value={formTitle} onChange={setFormTitle} required />
          <Input label={t('incidents.description')} value={formDesc} onChange={setFormDesc} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Select
              label={t('common.severity')}
              value={formSeverity}
              onChange={(v) => setFormSeverity(v as IncidentSeverity)}
              options={[
                { label: t('incidents.severityLabels.critical'), value: 'critical' },
                { label: t('incidents.severityLabels.high'), value: 'high' },
                { label: t('incidents.severityLabels.medium'), value: 'medium' },
                { label: t('incidents.severityLabels.low'), value: 'low' },
              ]}
            />
            <Select
              label={t('common.type')}
              value={formType}
              onChange={setFormType}
              options={typeOptions.filter((o) => o.value !== '')}
              placeholder={t('common.type')}
            />
          </div>
          <Input label={t('incidents.owner')} value={formOwner} onChange={setFormOwner} />
        </div>
      </Modal>

      {/* Detail Modal */}
      {selectedIncident && (
        <Modal
          open={!!selectedIncident}
          onClose={() => { setSelectedIncident(null); setCommentText('') }}
          title={t('incidents.incidentDetail')}
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <AIAssistButton contextType="incidents" contextData={selectedIncident} labelKey="aiAssist.analyzeIncident" />
              <Button variant="secondary" onClick={() => setStatusChange({ id: Number(selectedIncident.id), status: '' })}>
                {t('incidents.changeStatus')}
              </Button>
              <Button variant="danger" onClick={() => setCloseConfirm(Number(selectedIncident.id))}>
                {t('incidents.closeIncident')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('incidents.title_field')}
              </span>
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(selectedIncident.title ?? '')}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('common.severity')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={severityVariant(String(selectedIncident.severity ?? 'low'))}>
                    {t(`incidents.severityLabels.${selectedIncident.severity ?? 'low'}`)}
                  </Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('common.status')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={incidentStatusVariant(String(selectedIncident.status ?? 'open'))}>
                    {t(`incidents.statusLabels.${selectedIncident.status ?? 'open'}`)}
                  </Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('incidents.owner')}
                </span>
                <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                  {String(selectedIncident.proprietaire ?? selectedIncident.owner ?? '-')}
                </p>
              </div>
            </div>

            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('incidents.description')}
              </span>
              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(selectedIncident.description ?? '-')}
              </p>
            </div>

            {/* Timeline */}
            {timelineList.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('incidents.timeline')}
                </span>
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {timelineList.map((ev: Record<string, unknown>, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '8px', borderRadius: '6px', background: 'var(--color-bg-primary)' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-accent)', marginTop: '6px', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{String(ev.description ?? ev.event ?? '')}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>{String(ev.timestamp ?? ev.created_at ?? '')}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* IOCs & TTPs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('incidents.iocs')}
                </span>
                <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                  {Array.isArray(selectedIncident.iocs) ? (selectedIncident.iocs as unknown[]).map((ioc) => String(ioc)).join(', ') : '-'}
                </p>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('incidents.ttps')}
                </span>
                <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                  {Array.isArray(selectedIncident.ttps) ? (selectedIncident.ttps as unknown[]).map((ttp) => String(ttp)).join(', ') : '-'}
                </p>
              </div>
            </div>

            {/* Add comment */}
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('incidents.addComment')}
              </span>
              <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                <Input value={commentText} onChange={setCommentText} placeholder={t('incidents.commentPlaceholder')} />
                <Button variant="primary" size="sm" onClick={() => { if (commentText.trim()) commentMutation.mutate({ id: Number(selectedIncident.id), note: commentText }) }}>
                  {t('incidents.addComment')}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Status Change Modal */}
      {statusChange && (
        <Modal
          open={!!statusChange}
          onClose={() => setStatusChange(null)}
          title={t('incidents.changeStatus')}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setStatusChange(null)}>{t('common.cancel')}</Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(['open', 'investigating', 'contained', 'resolved', 'closed'] as IncidentStatus[]).map((s) => (
              <Button
                key={s}
                variant={s === 'closed' ? 'danger' : 'primary'}
                onClick={() => statusMutation.mutate({ id: statusChange.id, status: s })}
                fullWidth
              >
                {t(`incidents.statusLabels.${s}`)}
              </Button>
            ))}
          </div>
        </Modal>
      )}

      {/* Close Confirm */}
      <ConfirmDialog
        open={closeConfirm !== null}
        title={t('incidents.closeConfirmTitle')}
        message={t('incidents.closeConfirmMessage')}
        variant="danger"
        onConfirm={() => {
          if (closeConfirm !== null) {
            setShowPostMortem(true)
          }
        }}
        onCancel={() => setCloseConfirm(null)}
      />

      {/* Post-Mortem Modal */}
      <Modal
        open={showPostMortem}
        onClose={() => { setShowPostMortem(false); setCloseConfirm(null) }}
        title={t('incidents.postMortem')}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowPostMortem(false); setCloseConfirm(null) }}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={() => {
              if (closeConfirm !== null) {
                closeMutation.mutate({ id: closeConfirm, data: { post_mortem: postMortemText } })
              }
            }}>
              {t('incidents.closeIncident')}
            </Button>
          </>
        }
      >
        <Input label={t('incidents.postMortem')} value={postMortemText} onChange={setPostMortemText} />
      </Modal>
    </div>
  )
}