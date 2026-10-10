import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { reportingApi } from '../api'
import { Badge, StatCard, Tabs, Table, Card, Button, Modal, Select, useToast } from '../components/ui'
import { LayoutDashboard, FileText, Calendar, Clock, Download } from 'lucide-react'

type ReportTab = 'dashboards' | 'templates' | 'schedules' | 'history' | 'summary'

export function ReportingPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ReportTab>('dashboards')
  const [generateModal, setGenerateModal] = useState<number | null>(null)
  const [format, setFormat] = useState('pdf')

  const { data: dashboards, isLoading: dashLoading } = useQuery({
    queryKey: ['reporting', 'dashboards'],
    queryFn: () => reportingApi.dashboards().then((r) => r.data),
  })

  const { data: templates, isLoading: templatesLoading } = useQuery({
    queryKey: ['reporting', 'templates'],
    queryFn: () => reportingApi.templates().then((r) => r.data),
  })

  const { data: schedules, isLoading: schedulesLoading } = useQuery({
    queryKey: ['reporting', 'schedules'],
    queryFn: () => reportingApi.schedules().then((r) => r.data),
  })

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['reporting', 'history'],
    queryFn: () => reportingApi.history().then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['reporting', 'summary'],
    queryFn: () => reportingApi.summary().then((r) => r.data),
  })

  const generateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => reportingApi.generate(data).then((r) => r.data),
    onSuccess: () => {
      toast('success', t('compliance.reporting.generateSuccess'))
      setGenerateModal(null)
      queryClient.invalidateQueries({ queryKey: ['reporting'] })
    },
    onError: () => {
      toast('error', t('compliance.reporting.generateError'))
    },
  })

  const handleGenerate = useCallback((templateId: number) => {
    setGenerateModal(templateId)
  }, [])

  const confirmGenerate = useCallback(() => {
    if (generateModal !== null) {
      generateMutation.mutate({ template_id: generateModal, format })
    }
  }, [generateModal, format, generateMutation])

  const dashboardsData = (dashboards as Record<string, unknown>[] | undefined) ?? []
  const templatesData = (templates as Record<string, unknown>[] | undefined) ?? []
  const schedulesData = (schedules as Record<string, unknown>[] | undefined) ?? []
  const historyData = (history as Record<string, unknown>[] | undefined) ?? []
  const summaryData = summary as Record<string, unknown> | undefined

  const tabs = [
    { key: 'dashboards', label: t('compliance.reporting.dashboards') },
    { key: 'templates', label: t('compliance.reporting.templates') },
    { key: 'schedules', label: t('compliance.reporting.schedules') },
    { key: 'history', label: t('compliance.reporting.history') },
    { key: 'summary', label: t('compliance.reporting.summary') },
  ]

  const templateColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type') },
    { key: 'description', label: t('common.description') },
    { key: 'actions', label: t('common.actions') },
  ]

  const scheduleColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'frequency', label: t('compliance.reporting.frequency') },
    { key: 'next_run', label: t('compliance.reporting.nextRun') },
    { key: 'status', label: t('common.status') },
  ]

  const historyColumns = [
    { key: 'id', label: 'ID' },
    { key: 'report_name', label: t('compliance.reporting.reportName') },
    { key: 'format', label: t('compliance.reporting.format') },
    { key: 'generated_at', label: t('compliance.reporting.generatedAt') },
    { key: 'status', label: t('common.status') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.reporting.title')}
      </h1>

      <Tabs tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as ReportTab)} />

      {/* Tab: Dashboards */}
      {activeTab === 'dashboards' && (
        dashLoading ? (
          <StatCard label="" value="" loading />
        ) : dashboardsData.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
              {t('compliance.reporting.noDashboards')}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {dashboardsData.map((dash, i) => (
              <Card key={String(dash.id ?? i)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <LayoutDashboard size={20} style={{ color: 'var(--color-accent)', flexShrink: 0 }} />
                  <span style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {String(dash.name ?? dash.type ?? '')}
                  </span>
                </div>
                {String(dash.description ?? '') !== '' && (
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: 0 }}>
                    {String(dash.description)}
                  </p>
                )}
                {String(dash.type ?? '') !== '' && (
                  <Badge variant="info" size="sm">{String(dash.type)}</Badge>
                )}
              </Card>
            ))}
          </div>
        )
      )}

      {/* Tab: Templates */}
      {activeTab === 'templates' && (
        <Table
          columns={templateColumns}
          data={templatesData}
          loading={templatesLoading}
          emptyMessage={t('compliance.reporting.noTemplates')}
          renderCell={(col, row) => {
            if (col.key === 'actions') {
              return (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Download size={14} />}
                  onClick={() => handleGenerate(Number(row.id))}
                >
                  {t('compliance.reporting.generate')}
                </Button>
              )
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Schedules */}
      {activeTab === 'schedules' && (
        <Table
          columns={scheduleColumns}
          data={schedulesData}
          loading={schedulesLoading}
          emptyMessage={t('compliance.reporting.noSchedules')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'active' ? 'success' : v === 'paused' ? 'warning' : 'default'}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: History */}
      {activeTab === 'history' && (
        <Table
          columns={historyColumns}
          data={historyData}
          loading={historyLoading}
          emptyMessage={t('compliance.reporting.noHistory')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'completed' ? 'success' : v === 'failed' ? 'danger' : 'warning'}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Summary */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {summaryLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCard key={i} label="" value="" loading />)
          ) : summaryData ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <StatCard
                label={t('compliance.reporting.totalDashboards')}
                value={String(summaryData.total_dashboards ?? 0)}
                icon={<LayoutDashboard size={20} style={{ color: 'var(--color-accent)' }} />}
              />
              <StatCard
                label={t('compliance.reporting.totalReports')}
                value={String(summaryData.total_reports ?? 0)}
                icon={<FileText size={20} style={{ color: 'var(--color-info)' }} />}
              />
              <StatCard
                label={t('compliance.reporting.totalSchedules')}
                value={String(summaryData.total_schedules ?? 0)}
                icon={<Calendar size={20} style={{ color: 'var(--color-success)' }} />}
              />
              <StatCard
                label={t('compliance.reporting.lastGenerated')}
                value={String(summaryData.last_generated ?? '—')}
                icon={<Clock size={20} style={{ color: 'var(--color-warning)' }} />}
              />
            </div>
          ) : null}
        </div>
      )}

      {/* Generate modal */}
      <Modal
        open={generateModal !== null}
        onClose={() => setGenerateModal(null)}
        title={t('compliance.reporting.generateReport')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setGenerateModal(null)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={confirmGenerate} disabled={generateMutation.isPending}>
              {generateMutation.isPending ? t('common.loading') : t('compliance.reporting.generate')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Select
            label={t('compliance.reporting.format')}
            value={format}
            onChange={setFormat}
            options={[
              { label: 'PDF', value: 'pdf' },
              { label: 'DOCX', value: 'docx' },
              { label: 'CSV', value: 'csv' },
            ]}
          />
        </div>
      </Modal>
    </div>
  )
}