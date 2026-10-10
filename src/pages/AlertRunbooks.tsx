import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { runbooksApi } from '../api'
import { Card, Badge, Modal, Select, Button, EmptyState, Table, useToast, Input, ConfirmDialog } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { Zap, Plus, Play } from 'lucide-react'

const critVariant = (c: string): 'success' | 'warning' | 'danger' | 'default' => {
  if (c === 'critical') return 'danger'
  if (c === 'high') return 'warning'
  if (c === 'medium') return 'default'
  return 'default'
}

export function AlertRunbooksPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { canEdit } = usePermissions()
  const canModify = canEdit('analyst')

  const [alertTypeFilter, setAlertTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRunbook, setSelectedRunbook] = useState<Record<string, unknown> | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  // Create form
  const [formTitle, setFormTitle] = useState('')
  const [formAlertType, setFormAlertType] = useState('')
  const [formRunbook, setFormRunbook] = useState('')
  const [formConditions, setFormConditions] = useState('')

  const params: Record<string, string> = {}
  if (alertTypeFilter) params.alert_type = alertTypeFilter
  if (statusFilter) params.severity = statusFilter

  const { data: runbooks, isLoading } = useQuery({
    queryKey: ['alert-runbooks', params],
    queryFn: () => runbooksApi.list(params).then((r) => r.data),
  })

  const { data: runbookDetail } = useQuery({
    queryKey: ['alert-runbooks', 'detail', selectedRunbook?.id],
    queryFn: () => runbooksApi.get(Number(selectedRunbook!.id)).then((r) => r.data),
    enabled: !!selectedRunbook,
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => runbooksApi.create(data),
    onSuccess: () => {
      toast('success', t('alertRunbooks.createSuccess'))
      queryClient.invalidateQueries({ queryKey: ['alert-runbooks'] })
      setShowCreate(false)
      resetForm()
    },
    onError: () => toast('error', t('alertRunbooks.createError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => runbooksApi.delete(id),
    onSuccess: () => {
      toast('success', t('alertRunbooks.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['alert-runbooks'] })
      setDeleteConfirm(null)
      setSelectedRunbook(null)
    },
    onError: () => toast('error', t('alertRunbooks.deleteError')),
  })

  const executeMutation = useMutation({
    mutationFn: (id: number) => runbooksApi.executeDetection(id),
    onSuccess: () => {
      toast('success', t('alertRunbooks.executeSuccess'))
    },
    onError: () => toast('error', t('alertRunbooks.executeError')),
  })

  const resetForm = useCallback(() => {
    setFormTitle('')
    setFormAlertType('')
    setFormRunbook('')
    setFormConditions('')
  }, [])

  const runbookList = Array.isArray(runbooks) ? runbooks : (runbooks as Record<string, unknown>)?.items as Record<string, unknown>[] || []

  const alertTypeOptions = [
    { label: t('common.all'), value: '' },
    { label: t('alertRunbooks.alertTypeLabels.brute_force'), value: 'brute_force' },
    { label: t('alertRunbooks.alertTypeLabels.priv_esc'), value: 'priv_esc' },
    { label: t('alertRunbooks.alertTypeLabels.lateral_move'), value: 'lateral_move' },
    { label: t('alertRunbooks.alertTypeLabels.malware_detected'), value: 'malware_detected' },
    { label: t('alertRunbooks.alertTypeLabels.data_exfiltration'), value: 'data_exfiltration' },
    { label: t('alertRunbooks.alertTypeLabels.phishing'), value: 'phishing' },
    { label: t('alertRunbooks.alertTypeLabels.intrusion'), value: 'intrusion' },
    { label: t('alertRunbooks.alertTypeLabels.ddos'), value: 'ddos' },
    { label: t('alertRunbooks.alertTypeLabels.anomaly'), value: 'anomaly' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('common.criticalityLabels.critical'), value: 'critical' },
    { label: t('common.criticalityLabels.high'), value: 'high' },
    { label: t('common.criticalityLabels.medium'), value: 'medium' },
    { label: t('common.criticalityLabels.low'), value: 'low' },
  ]

  const columns = [
    { key: 'title', label: t('alertRunbooks.title_field') },
    { key: 'alert_type', label: t('alertRunbooks.alertType') },
    { key: 'severity', label: t('common.severity') },
    { key: 'escalation_contact', label: t('alertRunbooks.associatedRunbook') },
    { key: 'updated_at', label: t('alertRunbooks.lastTriggered') },
  ]

  const handleCreate = useCallback(() => {
    createMutation.mutate({
      title: formTitle,
      alert_type: formAlertType,
      runbook: formRunbook,
      conditions: formConditions,
    })
  }, [createMutation, formTitle, formAlertType, formRunbook, formConditions])

  const detail: Record<string, unknown> = (runbookDetail ?? selectedRunbook) as Record<string, unknown> ?? {}

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('alertRunbooks.title')}
        </h1>
        {canModify && (
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)} icon={<Plus size={14} />}>
            {t('alertRunbooks.createRunbook')}
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '180px' }}>
            <Select label={t('alertRunbooks.alertType')} value={alertTypeFilter} onChange={setAlertTypeFilter} options={alertTypeOptions} />
          </div>
          <div style={{ minWidth: '180px' }}>
            <Select label={t('common.severity')} value={statusFilter} onChange={setStatusFilter} options={statusOptions} />
          </div>
        </div>
      </Card>

      {/* Table */}
      {runbookList.length === 0 && !isLoading ? (
        <EmptyState icon={<Zap size={48} />} title={t('alertRunbooks.noRunbooks')} />
      ) : (
        <Table
          columns={columns}
          data={runbookList}
          loading={isLoading}
          renderCell={(col, row) => {
            if (col.key === 'severity') {
              return <Badge variant={critVariant(String(row[col.key] ?? ''))}>{t(`common.criticalityLabels.${row[col.key] ?? 'low'}`)}</Badge>
            }
            if (col.key === 'alert_type') {
              return <Badge variant="default">{t(`alertRunbooks.alertTypeLabels.${row[col.key] ?? 'anomaly'}`)}</Badge>
            }
            if (col.key === 'title') {
              const title = String(row[col.key] ?? '')
              const translated = t(`alertRunbooks.titleTranslations.${title}`)
              return translated === `alertRunbooks.titleTranslations.${title}` ? title : translated
            }
            if (col.key === 'updated_at') {
              return String(row[col.key] ?? '').replace('T', ' ').slice(0, 19)
            }
            return String(row[col.key] ?? '-')
          }}
        />
      )}

      {/* Execute detection buttons */}
      {runbookList.length > 0 && canModify && (
        <div style={{ marginTop: '16px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {runbookList.slice(0, 5).map((rb) => (
            <Button
              key={String(rb.id)}
              variant="secondary"
              size="sm"
              icon={<Play size={14} />}
              onClick={() => executeMutation.mutate(Number(rb.id))}
              disabled={executeMutation.isPending}
            >
              {t('alertRunbooks.execute')} — {(() => { const title = String(rb.title ?? rb.id); const translated = t(`alertRunbooks.titleTranslations.${title}`); return translated === `alertRunbooks.titleTranslations.${title}` ? title : translated; })()}
            </Button>
          ))}
        </div>
      )}

      {/* Create Alert Runbook Modal */}
      {canModify && (
        <Modal
          open={showCreate}
          onClose={() => { setShowCreate(false); resetForm() }}
          title={t('alertRunbooks.createRunbook')}
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
            <Input label={t('alertRunbooks.title_field')} value={formTitle} onChange={setFormTitle} required />
            <Select
              label={t('alertRunbooks.alertType')}
              value={formAlertType}
              onChange={setFormAlertType}
              options={alertTypeOptions.filter((o) => o.value !== '')}
              placeholder={t('alertRunbooks.alertType')}
            />
            <Input label={t('alertRunbooks.associatedRunbook')} value={formRunbook} onChange={setFormRunbook} />
            <div>
              <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                {t('alertRunbooks.conditions')}
              </span>
              <textarea
                value={formConditions}
                onChange={(e) => setFormConditions(e.target.value)}
                placeholder={t('alertRunbooks.conditionsPlaceholder')}
                rows={4}
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
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {selectedRunbook && (
        <Modal
          open={!!selectedRunbook}
          onClose={() => setSelectedRunbook(null)}
          title={t('alertRunbooks.runbookDetail')}
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" icon={<Play size={14} />} onClick={() => executeMutation.mutate(Number(selectedRunbook.id))}>
                {t('alertRunbooks.execute')}
              </Button>
              {canModify && (
                <Button variant="danger" size="sm" onClick={() => setDeleteConfirm(Number(selectedRunbook.id))}>
                  {t('common.delete')}
                </Button>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('alertRunbooks.title_field')}
              </span>
              <p style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {(() => { const title = String(detail.title ?? ''); const translated = t(`alertRunbooks.titleTranslations.${title}`); return translated === `alertRunbooks.titleTranslations.${title}` ? title : translated; })()}
              </p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('alertRunbooks.alertType')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant="default">{t(`alertRunbooks.alertTypeLabels.${detail.alert_type ?? 'anomaly'}`)}</Badge>
                </div>
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('common.severity')}
                </span>
                <div style={{ marginTop: '4px' }}>
                  <Badge variant={critVariant(String(detail.severity ?? 'high'))}>
                    {t(`common.criticalityLabels.${detail.severity ?? 'low'}`)}
                  </Badge>
                </div>
              </div>
            </div>
            <div>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                {t('alertRunbooks.associatedRunbook')}
              </span>
              <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                {String(detail.escalation_contact ?? detail.runbook_associe ?? detail.runbook ?? '-')}
              </p>
            </div>
            {detail.conditions ? (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('alertRunbooks.conditions')}
                </span>
                <pre style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: '4px 0 0', whiteSpace: 'pre-wrap', padding: '12px', borderRadius: '8px', background: 'var(--color-bg-primary)' }}>
                  {String(detail.conditions)}
                </pre>
              </div>
            ) : null}
            {detail.incident_id ? (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('alertRunbooks.linkedIncident')}
                </span>
                <p style={{ fontSize: '14px', color: 'var(--color-accent)', margin: '4px 0 0' }}>
                  #{String(detail.incident_id)}
                </p>
              </div>
            ) : null}
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={t('alertRunbooks.deleteConfirmTitle')}
        message={t('alertRunbooks.deleteConfirmMessage')}
        variant="danger"
        onConfirm={() => { if (deleteConfirm !== null) deleteMutation.mutate(deleteConfirm) }}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}