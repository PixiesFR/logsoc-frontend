import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { threatIntelApi } from '../api'
import { Badge, StatCard, Tabs, Table, SearchBar } from '../components/ui'
import { Bug, Users, Rss, FileText } from 'lucide-react'

type TiTab = 'indicators' | 'actors' | 'feeds' | 'bulletins' | 'summary'

const severityVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'default'
    case 'info': return 'info'
    default: return 'default'
  }
}

export function ThreatIntelPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const canAct = canEdit('analyst')
  void canAct

  const [activeTab, setActiveTab] = useState<TiTab>('indicators')
  const [indicatorSearch, setIndicatorSearch] = useState('')

  const { data: indicators, isLoading: indicatorsLoading } = useQuery({
    queryKey: ['ti', 'indicators', indicatorSearch],
    queryFn: () => threatIntelApi.indicators(indicatorSearch ? { search: indicatorSearch } : undefined).then((r) => r.data),
  })

  const { data: actors, isLoading: actorsLoading } = useQuery({
    queryKey: ['ti', 'actors'],
    queryFn: () => threatIntelApi.actors().then((r) => r.data),
  })

  const { data: feeds, isLoading: feedsLoading } = useQuery({
    queryKey: ['ti', 'feeds'],
    queryFn: () => threatIntelApi.feeds().then((r) => r.data),
  })

  const { data: bulletins, isLoading: bulletinsLoading } = useQuery({
    queryKey: ['ti', 'bulletins'],
    queryFn: () => threatIntelApi.bulletins().then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['ti', 'summary'],
    queryFn: () => threatIntelApi.summary().then((r) => r.data),
  })

  const indicatorsData = (indicators as Record<string, unknown>[] | undefined) ?? []
  const actorsData = (actors as Record<string, unknown>[] | undefined) ?? []
  const feedsData = (feeds as Record<string, unknown>[] | undefined) ?? []
  const bulletinsData = (bulletins as Record<string, unknown>[] | undefined) ?? []
  const summaryData = summary as Record<string, unknown> | undefined

  const tabs = [
    { key: 'indicators', label: t('compliance.threatIntel.indicators') },
    { key: 'actors', label: t('compliance.threatIntel.actors') },
    { key: 'feeds', label: t('compliance.threatIntel.feeds') },
    { key: 'bulletins', label: t('compliance.threatIntel.bulletins') },
    { key: 'summary', label: t('compliance.threatIntel.summary') },
  ]

  const indicatorColumns = [
    { key: 'id', label: 'ID' },
    { key: 'type', label: t('common.type') },
    { key: 'value', label: t('compliance.threatIntel.value') },
    { key: 'severity', label: t('common.severity') },
    { key: 'source', label: t('compliance.threatIntel.source') },
    { key: 'detected_at', label: t('compliance.dora.detectedAt') },
  ]

  const actorColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type') },
    { key: 'sophistication', label: t('compliance.threatIntel.sophistication') },
    { key: 'country', label: t('compliance.threatIntel.country') },
  ]

  const feedColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type') },
    { key: 'status', label: t('common.status') },
    { key: 'last_update', label: t('compliance.threatIntel.lastUpdate') },
  ]

  const bulletinColumns = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: t('common.name') },
    { key: 'severity', label: t('common.severity') },
    { key: 'published_at', label: t('compliance.threatIntel.publishedAt') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.threatIntel.title')}
      </h1>

      <Tabs tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as TiTab)} />

      {/* Tab: Indicators */}
      {activeTab === 'indicators' && (
        <>
          <SearchBar value={indicatorSearch} onChange={setIndicatorSearch} placeholder={t('compliance.threatIntel.searchIndicators')} />
          <Table
            columns={indicatorColumns}
            data={indicatorsData}
            loading={indicatorsLoading}
            emptyMessage={t('compliance.threatIntel.noIndicators')}
            renderCell={(col, row) => {
              if (col.key === 'severity') {
                return <Badge variant={severityVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
              }
              return String(row[col.key] ?? '')
            }}
          />
        </>
      )}

      {/* Tab: Actors */}
      {activeTab === 'actors' && (
        <Table
          columns={actorColumns}
          data={actorsData}
          loading={actorsLoading}
          emptyMessage={t('compliance.threatIntel.noActors')}
          renderCell={(col, row) => {
            if (col.key === 'sophistication') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'advanced' ? 'danger' : v === 'intermediate' ? 'warning' : 'default'}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Feeds */}
      {activeTab === 'feeds' && (
        <Table
          columns={feedColumns}
          data={feedsData}
          loading={feedsLoading}
          emptyMessage={t('compliance.threatIntel.noFeeds')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'active' ? 'success' : v === 'inactive' ? 'default' : 'warning'}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Bulletins */}
      {activeTab === 'bulletins' && (
        <Table
          columns={bulletinColumns}
          data={bulletinsData}
          loading={bulletinsLoading}
          emptyMessage={t('compliance.threatIntel.noBulletins')}
          renderCell={(col, row) => {
            if (col.key === 'severity') {
              return <Badge variant={severityVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
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
                label={t('compliance.threatIntel.totalIndicators')}
                value={String(summaryData.total_indicators ?? 0)}
                icon={<Bug size={20} style={{ color: 'var(--color-accent)' }} />}
              />
              <StatCard
                label={t('compliance.threatIntel.totalActors')}
                value={String(summaryData.total_actors ?? 0)}
                icon={<Users size={20} style={{ color: 'var(--color-info)' }} />}
              />
              <StatCard
                label={t('compliance.threatIntel.totalFeeds')}
                value={String(summaryData.total_feeds ?? 0)}
                icon={<Rss size={20} style={{ color: 'var(--color-success)' }} />}
              />
              <StatCard
                label={t('compliance.threatIntel.totalBulletins')}
                value={String(summaryData.total_bulletins ?? 0)}
                icon={<FileText size={20} style={{ color: 'var(--color-warning)' }} />}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}