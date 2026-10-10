import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { nis2Api } from '../api'
import { Card, Badge, StatCard, Tabs, Table, EmptyState, AIAssistButton } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { Shield, CheckCircle, Building2, BarChart3 } from 'lucide-react'

function measureStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'compliant': return 'success'
    case 'partial': return 'warning'
    case 'non-compliant': return 'danger'
    case 'not_started': return 'default'
    case 'in_progress': return 'info'
    case 'assessed': return 'info'
    default: return 'default'
  }
}

export function Nis2Page() {
  const { t } = useTranslation()
  const { canView } = usePermissions()
  const [activeTab, setActiveTab] = useState('measures')

  const { data: classification, isLoading: classLoading } = useQuery({
    queryKey: ['nis2', 'classification'],
    queryFn: () => nis2Api.classification().then((r) => r.data),
    enabled: canView(),
  })

  const { data: measures, isLoading: measuresLoading } = useQuery({
    queryKey: ['nis2', 'measures'],
    queryFn: () => nis2Api.measures().then((r) => r.data),
    enabled: canView(),
  })

  const { data: governance, isLoading: governanceLoading } = useQuery({
    queryKey: ['nis2', 'governance'],
    queryFn: () => nis2Api.governance().then((r) => r.data),
    enabled: canView(),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['nis2', 'summary'],
    queryFn: () => nis2Api.summary().then((r) => r.data),
    enabled: canView(),
  })

  const classData = classification as Record<string, unknown> | null
  const measuresData = measures as Record<string, unknown> | null
  const governanceData = governance as Record<string, unknown> | null
  const summaryData = summary as Record<string, unknown> | null

  const rawMeasures = Array.isArray(measuresData)
    ? measuresData
    : Array.isArray((measuresData as Record<string, unknown>)?.items)
      ? (measuresData as Record<string, unknown>).items
      : Array.isArray((measuresData as Record<string, unknown>)?.measures)
        ? (measuresData as Record<string, unknown>).measures
        : []

  // Map backend fields to frontend columns
  const measuresList = (rawMeasures as Record<string, unknown>[]).map((m) => ({
    ...m,
    code: m.measure_code ?? m.code ?? '—',
    name: m.title ?? m.name ?? '—',
    category: m.recyf_mapping ?? m.iso27001_mapping ?? m.category ?? '—',
    status: (m.assessment as Record<string, unknown>)?.status ?? m.status ?? 'not-evaluated',
    auto_check: m.assessment != null ? ((m.assessment as Record<string, unknown>).approved_by_direction === true ? 'pass' : 'manual') : (m.auto_check ?? 'manual'),
  }))

  const governanceItems = (Array.isArray(governanceData)
    ? governanceData
    : Array.isArray((governanceData as Record<string, unknown>)?.items)
      ? (governanceData as Record<string, unknown>).items
      : []) as Record<string, unknown>[]

  const entityClass = String(classData?.classification ?? classData?.entity_type ?? '—')
  const isEssential = entityClass.toLowerCase().includes('essential')
  const globalScore = summaryData ? (typeof summaryData.global_score === 'number' ? summaryData.global_score as number * 100 : typeof summaryData.score === 'number' ? summaryData.score as number * 100 : typeof summaryData.compliance_score === 'number' ? summaryData.compliance_score as number * 100 : null) : null

  const tabItems = [
    { key: 'measures', label: t('compliance.nis2Measures'), count: measuresList.length },
    { key: 'governance', label: t('compliance.nis2Governance') },
    { key: 'summary', label: t('compliance.summary') },
  ]

  const measureColumns = [
    { key: 'code', label: t('compliance.measureCode'), width: '100px' },
    { key: 'name', label: t('compliance.measureName') },
    { key: 'category', label: t('compliance.category'), width: '150px' },
    { key: 'status', label: t('common.status'), width: '130px' },
    { key: 'auto_check', label: t('compliance.autoCheck'), width: '110px' },
  ]

  const governanceColumns = [
    { key: 'role', label: t('compliance.role'), width: '180px' },
    { key: 'name', label: t('common.name') },
    { key: 'responsibility', label: t('compliance.responsibility') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('compliance.nis2')}
        </h1>
        <AIAssistButton contextType="nis2" contextData={{}} labelKey="aiAssist.evaluateCompliance" />
      </div>

      {/* Classification */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('compliance.entityClassification')}
          value={isEssential ? t('compliance.essentialEntity') : entityClass !== '—' ? t('compliance.importantEntity') : '—'}
          icon={<Building2 size={20} style={{ color: isEssential ? 'var(--color-danger)' : 'var(--color-warning)' }} />}
          loading={classLoading}
        />
        <StatCard
          label={t('compliance.globalScore')}
          value={globalScore !== null ? `${globalScore}%` : '—'}
          icon={<Shield size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={summaryLoading}
        />
        <StatCard
          label={t('compliance.totalMeasures')}
          value={measuresList.length}
          icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />}
          loading={measuresLoading}
        />
        <StatCard
          label={t('compliance.compliantMeasures')}
          value={measuresList.filter((m) => m.status === 'compliant').length}
          icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />}
          loading={measuresLoading}
        />
      </div>

      <Tabs tabs={tabItems} active={activeTab} onChange={setActiveTab} />

      {activeTab === 'measures' && (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
            {t('compliance.nis2Measures')} ({measuresList.length})
          </h3>
          {measuresList.length > 0 ? (
            <Table
              columns={measureColumns}
              data={measuresList as unknown as Record<string, unknown>[]}
              renderCell={(col, row) => {
                if (col.key === 'status') {
                  const st = String(row.status ?? 'not-evaluated')
                  return <Badge variant={measureStatusVariant(st)} size="sm">{t(`compliance.statusLabels.${st}`)}</Badge>
                }
                if (col.key === 'auto_check') {
                  const ac = row.auto_check ?? row.autoCheck
                  const isPass = ac === true || ac === 'pass' || ac === 'ok' || ac === true
                  return <Badge variant={isPass ? 'success' : 'default'} size="sm">{isPass ? '✓' : t('compliance.autoCheckManual')}</Badge>
                }
                return String(row[col.key] ?? '—')
              }}
              loading={measuresLoading}
              emptyMessage={t('compliance.noMeasures')}
            />
          ) : (
            !measuresLoading && <EmptyState icon={<Shield size={32} />} title={t('compliance.noMeasures')} />
          )}
        </Card>
      )}

      {activeTab === 'governance' && (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
            {t('compliance.nis2Governance')}
          </h3>
          {governanceItems.length > 0 ? (
            <Table
              columns={governanceColumns}
              data={governanceItems as unknown as Record<string, unknown>[]}
              renderCell={(col, row) => String(row[col.key] ?? '—')}
              loading={governanceLoading}
              emptyMessage={t('compliance.noGovernance')}
            />
          ) : (
            !governanceLoading && <EmptyState icon={<BarChart3 size={32} />} title={t('compliance.noGovernance')} />
          )}
        </Card>
      )}

      {activeTab === 'summary' && summaryData && (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
            {t('compliance.summary')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
            {Object.entries(summaryData).map(([key, value]) => (
              <div key={key} style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{key}</div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {typeof value === 'number' ? `${value}%` : String(value)}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'summary' && !summaryData && !summaryLoading && (
        <EmptyState icon={<BarChart3 size={32} />} title={t('compliance.noSummary')} />
      )}
    </div>
  )
}