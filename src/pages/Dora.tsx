import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { doraApi } from '../api'
import { Badge, StatCard, Tabs, Table, Modal } from '../components/ui'
import { Shield, AlertTriangle, Users, FlaskConical, BarChart3 } from 'lucide-react'

type DoraTab = 'incidents' | 'thirdParties' | 'resilience' | 'summary'

const severityVariant = (sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'default'
    default: return 'default'
  }
}

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'resolved': return 'success'
    case 'investigating': return 'warning'
    case 'open': return 'danger'
    case 'closed': return 'default'
    default: return 'default'
  }
}

export function DoraPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<DoraTab>('incidents')
  const [selectedIncident, setSelectedIncident] = useState<number | null>(null)

  const { data: pillars, isLoading: pillarsLoading } = useQuery({
    queryKey: ['dora', 'pillars'],
    queryFn: () => doraApi.pillars().then((r) => r.data),
  })

  const { data: incidents, isLoading: incidentsLoading } = useQuery({
    queryKey: ['dora', 'incidents'],
    queryFn: () => doraApi.incidents().then((r) => r.data),
  })

  const { data: thirdParties, isLoading: thirdPartiesLoading } = useQuery({
    queryKey: ['dora', 'thirdParties'],
    queryFn: () => doraApi.thirdParties().then((r) => r.data),
  })

  const { data: resilienceTests, isLoading: resilienceLoading } = useQuery({
    queryKey: ['dora', 'resilienceTests'],
    queryFn: () => doraApi.resilienceTests().then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dora', 'summary'],
    queryFn: () => doraApi.summary().then((r) => r.data),
  })

  const { data: incidentDetail } = useQuery({
    queryKey: ['dora', 'incident', selectedIncident],
    queryFn: () => doraApi.getIncident(selectedIncident!).then((r) => r.data),
    enabled: selectedIncident !== null,
  })

  const pillarData = (pillars as Record<string, unknown>[] | undefined) ?? []
  const incidentData = (incidents as Record<string, unknown>[] | undefined) ?? []
  const thirdPartyData = (thirdParties as Record<string, unknown>[] | undefined) ?? []
  const resilienceData = (resilienceTests as Record<string, unknown>[] | undefined) ?? []
  const summaryData = summary as Record<string, unknown> | undefined

  // Pillar name mapping for display
  const pillarNameMap: Record<string, string> = {
    risk_management: t('compliance.dora.pillar1'),
    incident_reporting: t('compliance.dora.pillar2'),
    resilience_testing: t('compliance.dora.pillar4'),
    third_party_risk: t('compliance.dora.pillar3'),
    info_sharing: t('compliance.dora.pillar5'),
  }

  const tabs = [
    { key: 'incidents', label: t('compliance.dora.incidents') },
    { key: 'thirdParties', label: t('compliance.dora.thirdParties') },
    { key: 'resilience', label: t('compliance.dora.resilienceTests') },
    { key: 'summary', label: t('compliance.dora.summary') },
  ]

  const incidentColumns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: t('compliance.dora.incidentTitle') },
    { key: 'severity', label: t('common.severity') },
    { key: 'status', label: t('common.status') },
    { key: 'detected_at', label: t('compliance.dora.detectedAt') },
  ]

  const thirdPartyColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'service_type', label: t('compliance.dora.serviceType') },
    { key: 'criticality', label: t('compliance.dora.criticality') },
    { key: 'contract_end', label: t('compliance.dora.contractEnd') },
  ]

  const resilienceColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type') },
    { key: 'status', label: t('common.status') },
    { key: 'last_run', label: t('compliance.dora.lastRun') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.dora.title')}
      </h1>

      {/* 5 Pillars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        {pillarsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <StatCard key={i} label="" value="" loading />
          ))
        ) : pillarData.length > 0 ? (
          pillarData.slice(0, 5).map((pillar, i) => {
            const icons = [Shield, AlertTriangle, Users, FlaskConical, BarChart3]
            const Icon = icons[i] ?? Shield
            const pillarName = String(pillarNameMap[String(pillar.pillar ?? '')] ?? pillar.name ?? pillar.pillar ?? '')
            const score = typeof pillar.score === 'number' ? pillar.score : typeof pillar.maturity_level === 'number' ? pillar.maturity_level * 20 : 0
            return (
              <StatCard
                key={String(pillar.id ?? i)}
                label={pillarName}
                value={`${score}%`}
                icon={<Icon size={20} style={{ color: 'var(--color-accent)' }} />}
                loading={false}
              />
            )
          })
        ) : (
          <>
            <StatCard label={t('compliance.dora.pillar1')} value="—" icon={<Shield size={20} style={{ color: 'var(--color-accent)' }} />} />
            <StatCard label={t('compliance.dora.pillar2')} value="—" icon={<AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />} />
            <StatCard label={t('compliance.dora.pillar3')} value="—" icon={<Users size={20} style={{ color: 'var(--color-info)' }} />} />
            <StatCard label={t('compliance.dora.pillar4')} value="—" icon={<FlaskConical size={20} style={{ color: 'var(--color-success)' }} />} />
            <StatCard label={t('compliance.dora.pillar5')} value="—" icon={<BarChart3 size={20} style={{ color: 'var(--color-text-secondary)' }} />} />
          </>
        )}
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as DoraTab)} />

      {/* Tab: Incidents */}
      {activeTab === 'incidents' && (
        <Table
          columns={incidentColumns}
          data={incidentData}
          loading={incidentsLoading}
          emptyMessage={t('compliance.dora.noIncidents')}
          renderCell={(col, row) => {
            if (col.key === 'severity') {
              return <Badge variant={severityVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
            }
            if (col.key === 'status') {
              return <Badge variant={statusVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
            }
            if (col.key === 'title') {
              return (
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                  onClick={() => setSelectedIncident(Number(row.id))}
                >
                  {String(row[col.key] ?? '')}
                </span>
              )
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Third Parties */}
      {activeTab === 'thirdParties' && (
        <Table
          columns={thirdPartyColumns}
          data={thirdPartyData}
          loading={thirdPartiesLoading}
          emptyMessage={t('compliance.dora.noThirdParties')}
          renderCell={(col, row) => {
            if (col.key === 'criticality') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'critical' ? 'danger' : v === 'high' ? 'warning' : 'default'}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Resilience Tests */}
      {activeTab === 'resilience' && (
        <Table
          columns={resilienceColumns}
          data={resilienceData}
          loading={resilienceLoading}
          emptyMessage={t('compliance.dora.noResilienceTests')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'passed' ? 'success' : v === 'failed' ? 'danger' : 'warning'}>{v}</Badge>
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
                label={t('compliance.dora.globalScore')}
                value={`${Number(summaryData.global_score ?? summaryData.overall_score ?? 0)}%`}
                icon={<BarChart3 size={20} style={{ color: 'var(--color-accent)' }} />}
              />
              {Array.isArray(summaryData.pillars) && (summaryData.pillars as Record<string, unknown>[]).map((p, i) => {
                const icons = [Shield, AlertTriangle, Users, FlaskConical, BarChart3]
                const Icon = icons[i] ?? Shield
                const pName = typeof p === 'string' ? (pillarNameMap[p] ?? p) : String(pillarNameMap[String(p.pillar ?? '')] ?? p.name ?? p.pillar ?? '')
                const pScore = typeof p === 'object' ? (typeof p.score === 'number' ? p.score : typeof p.maturity_level === 'number' ? (p.maturity_level as number) * 20 : 0) : 0
                return (
                  <StatCard
                    key={typeof p === 'string' ? p : String(p.id ?? i)}
                    label={pName}
                    value={`${pScore}%`}
                    icon={<Icon size={20} style={{ color: 'var(--color-accent)' }} />}
                  />
                )
              })}
            </>
          ) : (
            <StatCard label={t('compliance.dora.globalScore')} value="—" />
          )}
        </div>
      )}

      {/* Incident detail modal */}
      <Modal
        open={selectedIncident !== null}
        onClose={() => setSelectedIncident(null)}
        title={t('compliance.dora.incidentDetail')}
        size="lg"
      >
        {incidentDetail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {Object.entries(incidentDetail).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: '12px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '160px' }}>{k}</span>
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{String(v ?? '—')}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</div>
        )}
      </Modal>
    </div>
  )
}