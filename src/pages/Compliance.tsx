import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { complianceApi } from '../api'
import { Card, Badge, StatCard, EmptyState, Select, Table, Button } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Shield, Download, CheckCircle, XCircle, AlertTriangle, MinusCircle } from 'lucide-react'

function statusBadgeVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'compliant': return 'success'
    case 'partial': return 'warning'
    case 'non-compliant': return 'danger'
    default: return 'default'
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'compliant': return <CheckCircle size={14} style={{ color: 'var(--color-success)' }} />
    case 'partial': return <AlertTriangle size={14} style={{ color: 'var(--color-warning)' }} />
    case 'non-compliant': return <XCircle size={14} style={{ color: 'var(--color-danger)' }} />
    default: return <MinusCircle size={14} style={{ color: 'var(--color-text-secondary)' }} />
  }
}

export function CompliancePage() {
  const { t } = useTranslation()
  const { canView } = usePermissions()
  const { toast } = useToast()
  const [framework, setFramework] = useState('')
  const [country, setCountry] = useState('')

  const { data: controls, isLoading: controlsLoading } = useQuery({
    queryKey: ['compliance', 'controls', framework],
    queryFn: () => complianceApi.listControls(framework ? { framework } : undefined).then((r) => r.data),
    enabled: canView(),
  })

  const { data: scores, isLoading: scoresLoading } = useQuery({
    queryKey: ['compliance', 'scores', framework],
    queryFn: () => complianceApi.scores(framework || undefined).then((r) => r.data),
    enabled: canView(),
  })

  const frameworkOptions = [
    { label: t('common.all'), value: '' },
    { label: 'NIS2', value: 'nis2' },
    { label: 'RGPD', value: 'gdpr' },
    { label: 'DORA', value: 'dora' },
    { label: 'ISO 27001', value: 'iso27001' },
    { label: 'AI Act', value: 'aiact' },
  ]

  const countryOptions = [
    { label: t('common.all'), value: '' },
    { label: 'FR', value: 'FR' },
    { label: 'DE', value: 'DE' },
    { label: 'ES', value: 'ES' },
    { label: 'IT', value: 'IT' },
    { label: 'UK', value: 'UK' },
  ]

  const controlsList = (Array.isArray(controls) ? controls : (controls as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]
  const scoresData = (Array.isArray(scores) && scores.length === 0) ? null : scores as Record<string, unknown> | null
  // Compute score from API or from controls data
  const apiScore = scoresData ? (typeof scoresData.global_score === 'number' ? scoresData.global_score as number : typeof scoresData.score === 'number' ? scoresData.score as number : typeof scoresData.compliance_score === 'number' ? scoresData.compliance_score as number : null) : null
  const computedScore = controlsList.length > 0
    ? Math.round((controlsList.filter((c) => c.status === 'compliant').length / controlsList.length) * 100)
    : null
  const globalScore = apiScore !== null ? (apiScore <= 1 ? Math.round(apiScore * 100) : apiScore) : computedScore

  const handleExport = () => {
    toast('info', t('compliance.exportPlaceholder'))
  }

  const columns = [
    { key: 'reference', label: t('compliance.reference') },
    { key: 'title', label: t('compliance.controlTitle') },
    { key: 'status', label: t('common.status') },
    { key: 'framework', label: t('compliance.framework') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('compliance.title')}
        </h1>
        <Button icon={<Download size={16} />} onClick={handleExport}>
          {t('compliance.exportReport')}
        </Button>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '180px' }}>
          <Select value={framework} onChange={setFramework} options={frameworkOptions} label={t('compliance.framework')} />
        </div>
        <div style={{ minWidth: '120px' }}>
          <Select value={country} onChange={setCountry} options={countryOptions} label={t('compliance.country')} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('compliance.globalScore')}
          value={globalScore !== null ? `${globalScore}%` : t('compliance.scoreUnavailable')}
          icon={<Shield size={20} style={{ color: globalScore !== null ? (globalScore >= 80 ? 'var(--color-success)' : globalScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)') : 'var(--color-text-secondary)' }} />}
          loading={scoresLoading}
        />
        <StatCard
          label={t('compliance.totalControls')}
          value={controlsList.length}
          icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />}
          loading={controlsLoading}
        />
        <StatCard
          label={t('compliance.compliantControls')}
          value={controlsList.filter((c) => c.status === 'compliant').length}
          icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />}
          loading={controlsLoading}
        />
        <StatCard
          label={t('compliance.nonCompliantControls')}
          value={controlsList.filter((c) => c.status === 'non-compliant').length}
          icon={<XCircle size={20} style={{ color: 'var(--color-danger)' }} />}
          loading={controlsLoading}
        />
      </div>

      {globalScore !== null && (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 12px 0' }}>
            {t('compliance.scoreGauge')}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ position: 'relative', width: '120px', height: '120px' }}>
              <svg viewBox="0 0 120 120" style={{ transform: 'rotate(-90deg)' }}>
                <circle cx="60" cy="60" r="50" fill="none" stroke="var(--color-border)" strokeWidth="12" />
                <circle
                  cx="60" cy="60" r="50" fill="none"
                  stroke={globalScore >= 80 ? 'var(--color-success)' : globalScore >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'}
                  strokeWidth="12"
                  strokeDasharray={`${(globalScore / 100) * 314.16} 314.16`}
                  strokeLinecap="round"
                />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                {globalScore}%
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                {t('compliance.scoreDescription')}
              </div>
            </div>
          </div>
        </Card>
      )}

      {controlsList.length > 0 ? (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
            {t('compliance.controlsList')}
          </h3>
          <Table
            columns={columns}
            data={controlsList as unknown as Record<string, unknown>[]}
            renderCell={(col, row) => {
              if (col.key === 'status') {
                const st = String(row.status ?? 'not-evaluated')
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    {statusIcon(st)}
                    <Badge variant={statusBadgeVariant(st)} size="sm">
                      {t(`compliance.statusLabels.${st}`)}
                    </Badge>
                  </span>
                )
              }
              return String(row[col.key] ?? '—')
            }}
            loading={controlsLoading}
            emptyMessage={t('compliance.noControls')}
          />
        </Card>
      ) : (
        !controlsLoading && <EmptyState icon={<Shield size={32} />} title={t('compliance.noControls')} />
      )}
    </div>
  )
}