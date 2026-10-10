import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { aiactApi } from '../api'
import { Badge, StatCard, Tabs, Table, Modal } from '../components/ui'
import { Cpu, BarChart3 } from 'lucide-react'

type AiActTab = 'systems' | 'incidents' | 'transparency' | 'summary'

const riskVariant = (r: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (r) {
    case 'unacceptable': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'success'
    case 'minimal': return 'default'
    default: return 'default'
  }
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'compliant': return 'success'
    case 'partially_compliant': return 'warning'
    case 'non_compliant': return 'danger'
    case 'open': return 'danger'
    case 'investigating': return 'warning'
    case 'resolved': return 'success'
    case 'closed': return 'default'
    default: return 'default'
  }
}

export function AiActPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<AiActTab>('systems')
  const [selectedSystem, setSelectedSystem] = useState<number | null>(null)

  const { data: systems, isLoading: systemsLoading } = useQuery({
    queryKey: ['aiact', 'systems'],
    queryFn: () => aiactApi.systems().then((r) => r.data),
  })

  const { data: systemDetail } = useQuery({
    queryKey: ['aiact', 'system', selectedSystem],
    queryFn: () => aiactApi.getSystem(selectedSystem!).then((r) => r.data),
    enabled: selectedSystem !== null,
  })

  const { data: obligations } = useQuery({
    queryKey: ['aiact', 'obligations', selectedSystem],
    queryFn: () => aiactApi.obligations(selectedSystem!).then((r) => r.data),
    enabled: selectedSystem !== null,
  })

  const { data: incidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ['aiact', 'incidents'],
    queryFn: () => aiactApi.incidents().then((r) => r.data),
  })

  const { data: transparency, isLoading: transpLoading } = useQuery({
    queryKey: ['aiact', 'transparency'],
    queryFn: () => aiactApi.transparency().then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['aiact', 'summary'],
    queryFn: () => aiactApi.summary().then((r) => r.data),
  })

  const systemsData = (systems as Record<string, unknown>[] | undefined) ?? []
  const incidentsData = (incidents as Record<string, unknown>[] | undefined) ?? []
  const transparencyData = (transparency as Record<string, unknown>[] | undefined) ?? []
  const summaryData = summary as Record<string, unknown> | undefined

  const tabs = [
    { key: 'systems', label: t('compliance.aiAct.systems') },
    { key: 'incidents', label: t('compliance.aiAct.incidents') },
    { key: 'transparency', label: t('compliance.aiAct.transparency') },
    { key: 'summary', label: t('compliance.aiAct.summary') },
  ]

  const systemsColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'risk_level', label: t('compliance.aiAct.riskLevel') },
    { key: 'type', label: t('common.type') },
    { key: 'status', label: t('common.status') },
  ]

  const incidentsColumns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: t('compliance.aiAct.incidentTitle') },
    { key: 'system_name', label: t('compliance.aiAct.systemLabel') },
    { key: 'severity', label: t('common.severity') },
    { key: 'status', label: t('common.status') },
    { key: 'detected_at', label: t('compliance.dora.detectedAt') },
  ]

  const transparencyColumns = [
    { key: 'id', label: 'ID' },
    { key: 'obligation', label: t('compliance.aiAct.obligation') },
    { key: 'system_name', label: t('compliance.aiAct.systemLabel') },
    { key: 'status', label: t('common.status') },
    { key: 'deadline', label: t('compliance.aiAct.deadline') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.aiAct.title')}
      </h1>

      <Tabs tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as AiActTab)} />

      {/* Tab: Systems */}
      {activeTab === 'systems' && (
        <Table
          columns={systemsColumns}
          data={systemsData}
          loading={systemsLoading}
          emptyMessage={t('compliance.aiAct.noSystems')}
          renderCell={(col, row) => {
            if (col.key === 'risk_level') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={riskVariant(v)}>{v}</Badge>
            }
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={statusVariant(v)}>{v}</Badge>
            }
            if (col.key === 'name') {
              return (
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                  onClick={() => setSelectedSystem(Number(row.id))}
                >
                  {String(row[col.key] ?? '')}
                </span>
              )
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Incidents */}
      {activeTab === 'incidents' && (
        <Table
          columns={incidentsColumns}
          data={incidentsData}
          loading={incidentsLoading}
          emptyMessage={t('compliance.aiAct.noIncidents')}
          renderCell={(col, row) => {
            if (col.key === 'severity') {
              return <Badge variant={riskVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
            }
            if (col.key === 'status') {
              return <Badge variant={statusVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Transparency */}
      {activeTab === 'transparency' && (
        <Table
          columns={transparencyColumns}
          data={transparencyData}
          loading={transpLoading}
          emptyMessage={t('compliance.aiAct.noTransparency')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={statusVariant(v)}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Summary */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {summaryLoading ? (
            Array.from({ length: 3 }).map((_, i) => <StatCard key={i} label="" value="" loading />)
          ) : summaryData ? (
            <>
              <StatCard
                label={t('compliance.aiAct.overallScore')}
                value={`${Number(summaryData.overall_score ?? summaryData.score ?? 0)}%`}
                icon={<BarChart3 size={20} style={{ color: 'var(--color-accent)' }} />}
              />
              {Array.isArray(summaryData.risk_levels) && (summaryData.risk_levels as Record<string, unknown>[]).map((rl, i) => (
                <StatCard
                  key={String(rl.name ?? i)}
                  label={String(rl.name ?? '')}
                  value={String(rl.count ?? 0)}
                  icon={<Cpu size={20} style={{ color: 'var(--color-accent)' }} />}
                />
              ))}
            </>
          ) : (
            <StatCard label={t('compliance.aiAct.overallScore')} value="—" />
          )}
        </div>
      )}

      {/* System detail modal with obligations */}
      <Modal
        open={selectedSystem !== null}
        onClose={() => setSelectedSystem(null)}
        title={t('compliance.aiAct.systemDetail')}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {systemDetail ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(systemDetail as Record<string, unknown>).map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '180px' }}>{k}</span>
                  <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{String(v ?? '—')}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</div>
          )}

          {obligations && Array.isArray(obligations) && (obligations as Record<string, unknown>[]).length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                {t('compliance.aiAct.obligations')}
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(obligations as Record<string, unknown>[]).map((ob, i) => (
                  <div
                    key={String(ob.id ?? i)}
                    style={{
                      padding: '10px',
                      border: '1px solid var(--color-border)',
                      borderRadius: '8px',
                      background: 'var(--color-bg-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                        {String(ob.name ?? ob.obligation ?? '')}
                      </span>
                      <Badge variant={statusVariant(String(ob.status ?? ''))}>
                        {String(ob.status ?? '')}
                      </Badge>
                    </div>
                    {String(ob.description ?? '') !== '' && (
                      <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
                        {String(ob.description)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}