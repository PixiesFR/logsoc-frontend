import { useState, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../../i18n/useTranslation'
import { auditApi } from '../../api'
import { fetchAuditCrossMapping, exportAuditReport } from '../../services/auditService'
import { Card, Badge, Select, Table, Button, StatCard, EmptyState, useToast } from '../../components/ui'
import { ArrowLeftRight, Download, FileText, CheckCircle, AlertTriangle, ShieldCheck } from 'lucide-react'
import type { AuditCrossMappingItem } from '../../services/auditService'

const FRAMEWORKS = [
  { value: 'iso27001', label: 'ISO 27001' },
  { value: 'nis2', label: 'NIS2' },
  { value: 'dora', label: 'DORA' },
  { value: 'gdpr', label: 'RGPD' },
]

const EXPORT_FORMATS = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'DOCX' },
]

function statusBadge(status: string) {
  const v = status === 'covered' || status === 'compliant' ? 'success'
    : status === 'partial' ? 'warning'
    : status === 'gap' || status === 'non_compliant' ? 'danger'
    : 'default'
  return <Badge variant={v} size="sm">{status}</Badge>
}

export function CrossMappingAuditPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [framework, setFramework] = useState('iso27001')
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exporting, setExporting] = useState(false)

  // Fetch cross-mapping audit data
  const { data: mappingData, isLoading, isError, refetch } = useQuery<AuditCrossMappingItem[]>({
    queryKey: ['audit', 'cross-mapping', framework],
    queryFn: () => fetchAuditCrossMapping(framework),
    staleTime: 30000,
    retry: 0,
  })

  // Fetch audit profile for stats
  const { data: profile } = useQuery({
    queryKey: ['audit', 'profile'],
    queryFn: () => auditApi.profile().then((r) => r.data).catch(() => null),
    staleTime: 60000,
  })

  const rawMapping = mappingData as unknown
  const items: AuditCrossMappingItem[] = Array.isArray(rawMapping)
    ? (rawMapping as AuditCrossMappingItem[])
    : Array.from(
        ((rawMapping as Record<string, unknown>)?.controls ??
         (rawMapping as Record<string, unknown>)?.items ??
         []) as AuditCrossMappingItem[]
      )
  const totalControls = items.length
  const compliantControls = items.filter((i) => i.status === 'covered' || i.status === 'compliant').length
  const gapControls = items.filter((i) => i.status === 'gap' || i.status === 'non_compliant' || i.status === 'partial').length

  const handleExport = useCallback(async () => {
    setExporting(true)
    try {
      const result = await exportAuditReport(exportFormat)
      const url = URL.createObjectURL(result.blob)
      const a = document.createElement('a')
      a.href = url
      a.download = result.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast('success', t('audit.exportSuccess'))
    } catch {
      toast('error', t('audit.exportError'))
    } finally {
      setExporting(false)
    }
  }, [exportFormat, toast, t])

  const columns = [
    { key: 'control_id', label: t('audit.controlId'), width: '120px' },
    { key: 'control_title', label: t('audit.controlTitle') },
    { key: 'status', label: t('audit.status'), width: '120px' },
    { key: 'linked_policy', label: t('audit.linkedPolicy'), width: '180px' },
    { key: 'acknowledgment_rate', label: t('audit.ackRate'), width: '120px' },
    { key: 'ebpf_alerts_count', label: t('audit.ebpfAlerts'), width: '120px' },
  ]

  const auditorName = (profile as Record<string, unknown> | null)?.username as string ?? ''

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ShieldCheck size={24} style={{ color: 'var(--color-info)' }} />
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {t('audit.crossMappingTitle')}
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ minWidth: '100px' }}>
            <Select
              value={exportFormat}
              onChange={setExportFormat}
              options={EXPORT_FORMATS}
            />
          </div>
          <Button
            icon={<Download size={16} />}
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? t('common.loading') : t('audit.exportReport')}
          </Button>
        </div>
      </div>

      {/* Auditor identity banner */}
      {auditorName && (
        <Card style={{ padding: '12px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            <FileText size={16} style={{ color: 'var(--color-info)' }} />
            {t('audit.auditorIdentity')}: <strong style={{ color: 'var(--color-text-primary)' }}>{auditorName}</strong>
            <span style={{ marginLeft: 'auto', fontSize: '12px' }}>
              {new Date().toLocaleString()}
            </span>
          </div>
        </Card>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('audit.totalControls')}
          value={totalControls}
          icon={<ArrowLeftRight size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('audit.compliantControls')}
          value={compliantControls}
          icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('audit.gapControls')}
          value={gapControls}
          icon={<AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />}
          loading={isLoading}
        />
      </div>

      {/* Framework selector */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
            {t('audit.selectFramework')}
          </h3>
          <div style={{ minWidth: '240px' }}>
            <Select
              value={framework}
              onChange={setFramework}
              options={FRAMEWORKS}
              label={t('audit.framework')}
            />
          </div>
        </div>

        {/* API error fallback — degraded mode banner */}
        {isError && (
          <div
            style={{
              padding: '12px 16px',
              marginBottom: '16px',
              borderRadius: '8px',
              border: '1px solid var(--color-warning)',
              backgroundColor: 'color-mix(in srgb, var(--color-warning) 10%, transparent)',
              color: 'var(--color-warning)',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              justifyContent: 'space-between',
            }}
          >
            <span>{t('audit.dataUnavailable')}</span>
            <Button variant="secondary" size="sm" onClick={() => refetch()}>
              {t('common.retry')}
            </Button>
          </div>
        )}

        {/* Cross-mapping table */}
        {items.length > 0 ? (
          <Table
            columns={columns}
            data={items as unknown as Record<string, unknown>[]}
            renderCell={(col, row) => {
              if (col.key === 'status') {
                return statusBadge(String(row[col.key] ?? ''))
              }
              if (col.key === 'acknowledgment_rate') {
                const rate = Number(row[col.key] ?? 0)
                const v = rate >= 75 ? 'success' : rate >= 50 ? 'warning' : 'danger'
                return <Badge variant={v} size="sm">{rate}%</Badge>
              }
              if (col.key === 'ebpf_alerts_count') {
                const count = Number(row[col.key] ?? 0)
                const v = count === 0 ? 'success' : count < 5 ? 'warning' : 'danger'
                return <Badge variant={v} size="sm">{count}</Badge>
              }
              if (col.key === 'linked_policy') {
                const policy = row[col.key]
                if (!policy) return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
                return String(policy)
              }
              return String(row[col.key] ?? '—')
            }}
            loading={isLoading}
            emptyMessage={t('common.noData')}
          />
        ) : (
          !isLoading && (
            <EmptyState
              icon={<ArrowLeftRight size={32} />}
              title={t('audit.noMappingData')}
              description={t('audit.noMappingDataDesc')}
              action={
                isError ? (
                  <Button variant="secondary" size="sm" onClick={() => refetch()}>
                    {t('common.retry')}
                  </Button>
                ) : undefined
              }
            />
          )
        )}
      </Card>
    </div>
  )
}