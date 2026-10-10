import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { crossMappingApi } from '../api'
import { Card, Badge, Select, Table, Button, StatCard, EmptyState } from '../components/ui'
import { ArrowLeftRight, Download, AlertTriangle, CheckCircle } from 'lucide-react'

const FRAMEWORKS = [
  { value: 'nis2', label: 'NIS2' },
  { value: 'iso27001', label: 'ISO 27001' },
  { value: 'dora', label: 'DORA' },
  { value: 'gdpr', label: 'RGPD' },
]

function gapBadge(gap: string | undefined) {
  if (!gap) return null
  const v = gap === 'covered' ? 'success' : gap === 'partial' ? 'warning' : 'danger'
  return <Badge variant={v} size="sm">{gap}</Badge>
}

export function CrossMappingPage() {
  const { t } = useTranslation()
  const [fw1, setFw1] = useState('nis2')
  const [fw2, setFw2] = useState('iso27001')

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ['crossMapping', 'dashboard'],
    queryFn: () => crossMappingApi.unifiedDashboard().then((r) => r.data),
  })

  const { data: mapping, isLoading: mapLoading } = useQuery({
    queryKey: ['crossMapping', 'mapping', fw1, fw2],
    queryFn: () => crossMappingApi.getMapping(fw1, fw2).then((r) => r.data),
  })

  const dash = (dashboard ?? {}) as Record<string, unknown>
  const summary = (dash.summary ?? {}) as Record<string, unknown>
  const mappingItems = (Array.isArray(mapping) ? mapping : ((mapping as Record<string, unknown>)?.items ?? [])) as Record<string, unknown>[]

  const totalControls = typeof summary.total_controls === 'number' ? summary.total_controls : 0
  const coveredControls = typeof summary.covered_controls === 'number' ? summary.covered_controls : 0
  const gapControls = typeof summary.gap_controls === 'number' ? summary.gap_controls : 0

  const columns = [
    { key: 'source_control', label: t('compliance.crossMapping.sourceControl') },
    { key: 'source_title', label: t('compliance.crossMapping.sourceTitle') },
    { key: 'target_control', label: t('compliance.crossMapping.targetControl') },
    { key: 'target_title', label: t('compliance.crossMapping.targetTitle') },
    { key: 'coverage', label: t('compliance.crossMapping.coverage') },
    { key: 'gap', label: t('compliance.crossMapping.gap') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('compliance.crossMapping')}
        </h1>
        <Button icon={<Download size={16} />} onClick={() => {}}>
          {t('common.export')}
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('compliance.crossMapping.totalControls')}
          value={totalControls}
          icon={<ArrowLeftRight size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={dashLoading}
        />
        <StatCard
          label={t('compliance.crossMapping.covered')}
          value={coveredControls}
          icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />}
          loading={dashLoading}
        />
        <StatCard
          label={t('compliance.crossMapping.gaps')}
          value={gapControls}
          icon={<AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />}
          loading={dashLoading}
        />
      </div>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
          {t('compliance.crossMapping.compareFrameworks')}
        </h3>
        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '200px' }}>
            <Select value={fw1} onChange={setFw1} options={FRAMEWORKS} label={t('compliance.crossMapping.framework1')} />
          </div>
          <div style={{ minWidth: '200px' }}>
            <Select value={fw2} onChange={setFw2} options={FRAMEWORKS} label={t('compliance.crossMapping.framework2')} />
          </div>
        </div>
        {mappingItems.length > 0 ? (
          <Table
            columns={columns}
            data={mappingItems}
            renderCell={(col, row) => {
              if (col.key === 'gap' || col.key === 'coverage') {
                return gapBadge(String(row[col.key] ?? ''))
              }
              return String(row[col.key] ?? '—')
            }}
            loading={mapLoading}
            emptyMessage={t('common.noData')}
          />
        ) : (
          !mapLoading && <EmptyState icon={<ArrowLeftRight size={32} />} title={t('common.noData')} />
        )}
      </Card>
    </div>
  )
}