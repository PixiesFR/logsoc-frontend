import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { iso27001Api } from '../api'
import { Badge, StatCard, Tabs, Table, Modal, Card, AIAssistButton } from '../components/ui'
import { FileCheck, ClipboardCheck, AlertTriangle, BookOpen, Award, BarChart3 } from 'lucide-react'
import { translateControlTitle } from '../utils/iso27001Controls'

type IsoTab = 'soa' | 'audits' | 'nonconformities' | 'reviews' | 'certification' | 'summary'

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'implemented':
    case 'compliant':
      return 'success'
    case 'in_progress':
    case 'partially_implemented':
    case 'partially_compliant':
      return 'warning'
    case 'not_implemented':
    case 'non_compliant':
      return 'danger'
    case 'not_applicable':
      return 'default'
    default:
      return 'default'
  }
}

export function Iso27001Page() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<IsoTab>('soa')
  const [selectedSoa, setSelectedSoa] = useState<string | null>(null)

  const { data: soa, isLoading: soaLoading } = useQuery({
    queryKey: ['iso27001', 'soa'],
    queryFn: () => iso27001Api.soa().then((r) => r.data),
  })

  const { data: soaDetail } = useQuery({
    queryKey: ['iso27001', 'soa', selectedSoa],
    queryFn: () => iso27001Api.getSoa(selectedSoa!).then((r) => r.data),
    enabled: selectedSoa !== null,
  })

  const { data: audits, isLoading: auditsLoading } = useQuery({
    queryKey: ['iso27001', 'audits'],
    queryFn: () => iso27001Api.audits().then((r) => r.data),
  })

  const { data: nonconformities, isLoading: ncLoading } = useQuery({
    queryKey: ['iso27001', 'nonconformities'],
    queryFn: () => iso27001Api.nonconformities().then((r) => r.data),
  })

  const { data: reviews, isLoading: reviewsLoading } = useQuery({
    queryKey: ['iso27001', 'reviews'],
    queryFn: () => iso27001Api.reviews().then((r) => r.data),
  })

  const { data: certification, isLoading: certLoading } = useQuery({
    queryKey: ['iso27001', 'certification'],
    queryFn: () => iso27001Api.certification().then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['iso27001', 'summary'],
    queryFn: () => iso27001Api.summary().then((r) => r.data),
  })

  const soaData = (soa as Record<string, unknown>[] | undefined) ?? []
  const auditsData = (audits as Record<string, unknown>[] | undefined) ?? []
  const ncData = (nonconformities as Record<string, unknown>[] | undefined) ?? []
  const reviewsData = (reviews as Record<string, unknown>[] | undefined) ?? []
  const certData = certification as Record<string, unknown> | undefined
  const summaryData = summary as Record<string, unknown> | undefined

  const tabs = [
    { key: 'soa', label: t('compliance.iso27001.soa') },
    { key: 'audits', label: t('compliance.iso27001.audits') },
    { key: 'nonconformities', label: t('compliance.iso27001.nonconformities') },
    { key: 'reviews', label: t('compliance.iso27001.reviews') },
    { key: 'certification', label: t('compliance.iso27001.certification') },
    { key: 'summary', label: t('compliance.iso27001.summary') },
  ]

  const soaColumns = [
    { key: 'control_id', label: t('compliance.iso27001.controlId') },
    { key: 'title', label: t('common.name') },
    { key: 'is_applicable', label: t('compliance.iso27001.applicability') },
    { key: 'implementation_status', label: t('common.status') },
  ]

  const auditsColumns = [
    { key: 'id', label: 'ID' },
    { key: 'type', label: t('common.type') },
    { key: 'date', label: t('common.date') },
    { key: 'auditor', label: t('compliance.iso27001.auditor') },
    { key: 'result', label: t('compliance.iso27001.result') },
  ]

  const ncColumns = [
    { key: 'id', label: 'ID' },
    { key: 'control_id', label: t('compliance.iso27001.controlId') },
    { key: 'description', label: t('common.description') },
    { key: 'severity', label: t('common.severity') },
    { key: 'status', label: t('common.status') },
  ]

  const reviewsColumns = [
    { key: 'id', label: 'ID' },
    { key: 'date', label: t('common.date') },
    { key: 'participants', label: t('compliance.iso27001.participants') },
    { key: 'decisions', label: t('compliance.iso27001.decisions') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('compliance.iso27001.title')}
        </h1>
        <AIAssistButton contextType="iso27001" contextData={{}} labelKey="aiAssist.evaluateCompliance" />
      </div>

      <Tabs tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as IsoTab)} />

      {/* Tab: SOA */}
      {activeTab === 'soa' && (
        <Table
          columns={soaColumns}
          data={soaData}
          loading={soaLoading}
          emptyMessage={t('compliance.iso27001.noSoa')}
          renderCell={(col, row) => {
            if (col.key === 'implementation_status') {
              const rawStatus = String(row[col.key] ?? '')
              const statusKey = `compliance.iso27001.statusLabels.${rawStatus}`
              const translated = t(statusKey)
              const label = translated === statusKey ? rawStatus : translated
              return <Badge variant={statusVariant(rawStatus)}>{label}</Badge>
            }
            if (col.key === 'is_applicable') {
              const v = row[col.key] === true || row[col.key] === 'true'
              return <Badge variant={v ? 'success' : 'default'}>{v ? t('compliance.statusLabels.compliant') : t('compliance.statusLabels.not-evaluated')}</Badge>
            }
            if (col.key === 'title') {
              const controlId = String(row.control_id ?? '')
              const originalTitle = String(row[col.key] ?? '')
              return translateControlTitle(controlId, originalTitle)
            }
            if (col.key === 'control_id') {
              return (
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                  onClick={() => setSelectedSoa(String(row[col.key] ?? ''))}
                >
                  {String(row[col.key] ?? '')}
                </span>
              )
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Audits */}
      {activeTab === 'audits' && (
        <Table
          columns={auditsColumns}
          data={auditsData}
          loading={auditsLoading}
          emptyMessage={t('compliance.iso27001.noAudits')}
        />
      )}

      {/* Tab: Non-conformities */}
      {activeTab === 'nonconformities' && (
        <Table
          columns={ncColumns}
          data={ncData}
          loading={ncLoading}
          emptyMessage={t('compliance.iso27001.noNonconformities')}
          renderCell={(col, row) => {
            if (col.key === 'severity') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'critical' ? 'danger' : v === 'major' ? 'warning' : 'default'}>{v}</Badge>
            }
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'open' ? 'danger' : v === 'closed' ? 'success' : 'warning'}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Reviews */}
      {activeTab === 'reviews' && (
        <Table
          columns={reviewsColumns}
          data={reviewsData}
          loading={reviewsLoading}
          emptyMessage={t('compliance.iso27001.noReviews')}
        />
      )}

      {/* Tab: Certification */}
      {activeTab === 'certification' && (
        certLoading ? (
          <StatCard label="" value="" loading />
        ) : certData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Card>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Award size={20} style={{ color: 'var(--color-accent)' }} />
                  <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {t('compliance.iso27001.certificationStatus')}
                  </span>
                </div>
                {Object.entries(certData).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: '12px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '180px' }}>{k}</span>
                    <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{String(v ?? '—')}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <span style={{ color: 'var(--color-text-secondary)' }}>{t('common.noData')}</span>
          </Card>
        )
      )}

      {/* Tab: Summary */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {summaryLoading ? (
            Array.from({ length: 3 }).map((_, i) => <StatCard key={i} label="" value="" loading />)
          ) : summaryData ? (
            <>
              <StatCard
                label={t('compliance.iso27001.overallScore')}
                value={`${Number(summaryData.overall_score ?? summaryData.score ?? 0)}%`}
                icon={<BarChart3 size={20} style={{ color: 'var(--color-accent)' }} />}
              />
              {Array.isArray(summaryData.domains) && (summaryData.domains as Record<string, unknown>[]).map((d, i) => {
                const icons = [FileCheck, AlertTriangle, ClipboardCheck, BookOpen, Award, BarChart3]
                const Icon = icons[i % icons.length]
                return (
                  <StatCard
                    key={String(d.name ?? i)}
                    label={String(d.name ?? '')}
                    value={`${Number(d.score ?? 0)}%`}
                    icon={<Icon size={20} style={{ color: 'var(--color-accent)' }} />}
                  />
                )
              })}
            </>
          ) : (
            <StatCard label={t('compliance.iso27001.overallScore')} value="—" />
          )}
        </div>
      )}

      {/* SOA Detail modal */}
      <Modal
        open={selectedSoa !== null}
        onClose={() => setSelectedSoa(null)}
        title={t('compliance.iso27001.controlDetail')}
        size="lg"
      >
        {soaDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(soaDetail as Record<string, unknown>).map(([k, v]) => {
              let displayValue = String(v ?? '—')
              if (k === 'title' && soaDetail.control_id) {
                displayValue = translateControlTitle(String(soaDetail.control_id), displayValue)
              }
              if (k === 'implementation_status') {
                const statusKey = `compliance.iso27001.statusLabels.${displayValue}`
                const translated = t(statusKey)
                displayValue = translated === statusKey ? displayValue : translated
              }
              return (
                <div key={k} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '180px' }}>{k}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{displayValue}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</div>
        )}
      </Modal>
    </div>
  )
}