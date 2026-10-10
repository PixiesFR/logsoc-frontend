import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { complianceInfraApi } from '../api'
import { Card, Badge, StatCard, EmptyState, Tabs } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { Network, Lock, Server, Shield, TrendingUp, AlertTriangle } from 'lucide-react'

interface SectionScore {
  key: string
  score: number
  total: number
  details?: Array<{ control: string; status: string; asset?: string }>
}

interface InfraStats {
  total_sections: number
  global_score: number
  sections: SectionScore[]
}

export function ComplianceInfraPage() {
  const { t } = useTranslation()
  const { canView } = usePermissions()
  const [activeSection, setActiveSection] = useState('network')

  const { data: stats, isLoading: statsLoading } = useQuery<InfraStats>({
    queryKey: ['compliance-infra', 'stats'],
    queryFn: () => complianceInfraApi.stats().then((r) => r.data),
    enabled: canView(),
  })

  const { data: scores } = useQuery({
    queryKey: ['compliance-infra', 'scores'],
    queryFn: () => complianceInfraApi.scores().then((r) => r.data),
    enabled: canView(),
  })

  const { data: sectionData, isLoading: sectionLoading } = useQuery({
    queryKey: ['compliance-infra', 'section', activeSection],
    queryFn: () => complianceInfraApi.section(activeSection).then((r) => r.data),
    enabled: canView(),
  })

  const { data: trendData } = useQuery({
    queryKey: ['compliance-infra', 'trend', activeSection],
    queryFn: () => complianceInfraApi.trend(activeSection, 30).then((r) => r.data),
    enabled: canView(),
  })

  const sectionTabs = [
    { key: 'network', label: t('compliance.network') },
    { key: 'system', label: t('compliance.system') },
    { key: 'access', label: t('compliance.access') },
    { key: 'encryption', label: t('compliance.encryption') },
  ]

  const sectionIcons: Record<string, React.ReactNode> = {
    network: <Network size={20} style={{ color: 'var(--color-accent)' }} />,
    system: <Server size={20} style={{ color: 'var(--color-info)' }} />,
    access: <Lock size={20} style={{ color: 'var(--color-warning)' }} />,
    encryption: <Shield size={20} style={{ color: 'var(--color-success)' }} />,
  }

  const scoresObj = scores as Record<string, unknown> | null
  const globalScore = stats?.global_score ?? (typeof scoresObj?.global_score === 'number' ? scoresObj.global_score : null)
  const sections = stats?.sections ?? []

  const sectionDetails = sectionData as Record<string, unknown> | null
  const sectionItems = (sectionDetails?.controls ?? sectionDetails?.items ?? []) as Array<Record<string, unknown>>

  const trend = trendData as Array<{ date: string; score: number }> | null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.infra')}
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('compliance.globalScore')}
          value={globalScore !== null ? `${globalScore}%` : '—'}
          icon={<Shield size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={statsLoading}
        />
        <StatCard
          label={t('compliance.networkScore')}
          value={sections.find((s) => s.key === 'network') ? `${sections.find((s) => s.key === 'network')!.score}%` : '—'}
          icon={<Network size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={statsLoading}
        />
        <StatCard
          label={t('compliance.systemScore')}
          value={sections.find((s) => s.key === 'system') ? `${sections.find((s) => s.key === 'system')!.score}%` : '—'}
          icon={<Server size={20} style={{ color: 'var(--color-info)' }} />}
          loading={statsLoading}
        />
        <StatCard
          label={t('compliance.accessScore')}
          value={sections.find((s) => s.key === 'access') ? `${sections.find((s) => s.key === 'access')!.score}%` : '—'}
          icon={<Lock size={20} style={{ color: 'var(--color-warning)' }} />}
          loading={statsLoading}
        />
      </div>

      {sections.length > 0 && (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
            {t('compliance.sectionScores')}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
            {sections.map((section) => (
              <div
                key={section.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  border: '1px solid var(--color-border)',
                  background: 'var(--color-bg-primary)',
                }}
              >
                {sectionIcons[section.key] ?? <TrendingUp size={20} style={{ color: 'var(--color-text-secondary)' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                    {t(`compliance.${section.key}`)}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {section.score}%
                  </div>
                </div>
                <Badge variant={section.score >= 80 ? 'success' : section.score >= 50 ? 'warning' : 'danger'}>
                  {section.score >= 80 ? t('compliance.statusCompliant') : section.score >= 50 ? t('compliance.statusPartial') : t('compliance.statusNonCompliant')}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
          {t('compliance.sectionDetails')}
        </h3>
        <Tabs tabs={sectionTabs} active={activeSection} onChange={setActiveSection} />
        <div style={{ marginTop: '16px' }}>
          {sectionLoading ? (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: '40px', width: '100%', borderRadius: '4px' }} />
              ))}
            </div>
          ) : sectionItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {sectionItems.map((item, idx) => {
                const st = String(item.status ?? 'not-evaluated')
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderRadius: '6px',
                      border: '1px solid var(--color-border)',
                      background: 'var(--color-bg-primary)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {String(item.control ?? item.name ?? `Control ${idx + 1}`)}
                      </span>
                      {Boolean(item.asset) && (
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {t('compliance.linkedAsset')}: {String(item.asset)}
                        </span>
                      )}
                    </div>
                    <Badge variant={st === 'compliant' ? 'success' : st === 'partial' ? 'warning' : st === 'non-compliant' ? 'danger' : 'default'} size="sm">
                      {t(`compliance.statusLabels.${st}`)}
                    </Badge>
                  </div>
                )
              })}
            </div>
          ) : (
            <EmptyState icon={<AlertTriangle size={32} />} title={t('compliance.noSectionData')} />
          )}
        </div>
      </Card>

      {trend && trend.length > 0 && (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
            {t('compliance.trend')} — {t(`compliance.${activeSection}`)}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {trend.slice(-10).map((point, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                <span style={{ minWidth: '100px' }}>{point.date}</span>
                <div style={{ flex: 1, height: '8px', background: 'var(--color-bg-primary)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: `${point.score}%`, height: '100%', background: point.score >= 80 ? 'var(--color-success)' : point.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)', borderRadius: '4px' }} />
                </div>
                <span style={{ minWidth: '40px', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-primary)' }}>{point.score}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {Array.isArray(sectionDetails?.recommendations) ? (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 12px 0' }}>
            {t('compliance.recommendations')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(sectionDetails.recommendations as Array<{ title: string; description: string }>).map((rec, idx) => (
              <div key={idx} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)' }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{rec.title}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>{rec.description}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}