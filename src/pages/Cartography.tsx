import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { assetsApi } from '../api'
import { Card, Badge, StatCard, EmptyState, SearchBar, Select } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { MapPin, Server, Shield, AlertTriangle } from 'lucide-react'
import type { AssetItem } from '../api/types'

export function CartographyPage() {
  const { t } = useTranslation()
  const { canView } = usePermissions()
  const [search, setSearch] = useState('')
  const [framework, setFramework] = useState('')
  const [group, setGroup] = useState('')
  const [criticality, setCriticality] = useState('')

  const { data: assets, isLoading } = useQuery<AssetItem[]>({
    queryKey: ['assets', 'cartography', { search, framework, group, criticality }],
    queryFn: () => assetsApi.list({ page: '1', page_size: '200' }).then((r) => r.data),
    enabled: canView(),
  })

  const { data: assetStats } = useQuery({
    queryKey: ['assets', 'stats'],
    queryFn: () => assetsApi.stats().then((r) => r.data),
  })

  const { data: groups } = useQuery({
    queryKey: ['assets', 'groups'],
    queryFn: () => assetsApi.groups().then((r) => r.data),
  })

  const filtered = (assets ?? []).filter((a: AssetItem) => {
    if (search) {
      const q = search.toLowerCase()
      if (!a.hostname?.toLowerCase().includes(q) && !a.os_name?.toLowerCase().includes(q)) return false
    }
    if (group && a.group_name !== group) return false
    if (criticality && a.status !== criticality) return false
    return true
  })

  const frameworkOptions = [
    { label: t('common.all'), value: '' },
    { label: 'NIS2', value: 'nis2' },
    { label: 'RGPD', value: 'gdpr' },
    { label: 'DORA', value: 'dora' },
    { label: 'ISO 27001', value: 'iso27001' },
    { label: 'AI Act', value: 'aiact' },
  ]

  const groupOptions = [
    { label: t('common.all'), value: '' },
    ...((groups as Array<{ name: string }>) ?? []).map((g) => ({ label: g.name, value: g.name })),
  ]

  const criticalityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('compliance.critical'), value: 'critical' },
    { label: t('compliance.important'), value: 'important' },
    { label: t('compliance.standard'), value: 'standard' },
  ]

  const totalAssets = assetStats?.total ?? 0
  const activeAssets = assetStats?.by_status?.active ?? 0
  const complianceOk = (assets ?? []).filter((a: AssetItem) => a.ebpf_status === 'active').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.cartography')}
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('compliance.totalAssets')}
          value={totalAssets}
          icon={<Server size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('compliance.activeAssets')}
          value={activeAssets}
          icon={<MapPin size={20} style={{ color: 'var(--color-success)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('compliance.compliantAssets')}
          value={complianceOk}
          icon={<Shield size={20} style={{ color: 'var(--color-info)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('compliance.nonCompliantAssets')}
          value={totalAssets - complianceOk}
          icon={<AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />}
          loading={isLoading}
        />
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBar value={search} onChange={setSearch} placeholder={t('compliance.searchAssets')} />
        <div style={{ minWidth: '160px' }}>
          <Select value={framework} onChange={setFramework} options={frameworkOptions} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select value={group} onChange={setGroup} options={groupOptions} />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select value={criticality} onChange={setCriticality} options={criticalityOptions} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>{t('compliance.legend')}:</span>
        <Badge variant="success">{t('compliance.statusCompliant')}</Badge>
        <Badge variant="warning">{t('compliance.statusPartial')}</Badge>
        <Badge variant="danger">{t('compliance.statusNonCompliant')}</Badge>
        <Badge variant="default">{t('compliance.statusNotEvaluated')}</Badge>
      </div>

      {filtered.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {filtered.map((asset: AssetItem) => (
            <Card key={asset.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {asset.hostname || '—'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                    {asset.os_name || '—'} {asset.os_version || ''}
                  </div>
                </div>
                <Badge variant={asset.ebpf_status === 'active' ? 'success' : asset.ebpf_status === 'disconnected' ? 'danger' : 'default'} size="sm">
                  {asset.status}
                </Badge>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {asset.group_name && <span>{t('compliance.group')}: {asset.group_name}</span>}
                {asset.platform && <span>{t('compliance.platform')}: {asset.platform}</span>}
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                <Badge variant={asset.ebpf_status === 'active' ? 'success' : 'warning'} size="sm">
                  eBPF: {asset.ebpf_status}
                </Badge>
                {asset.arch && <Badge variant="default" size="sm">{asset.arch}</Badge>}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState icon={<Server size={32} />} title={t('compliance.noAssets')} />
      )}
    </div>
  )
}