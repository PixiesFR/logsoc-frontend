import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { nis2CountriesApi } from '../api'
import { Card, Badge, Table, Modal, EmptyState } from '../components/ui'
import { Globe } from 'lucide-react'

function transpositionBadge(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'transposed': return 'success'
    case 'in_progress': return 'warning'
    case 'not_transposed': return 'danger'
    default: return 'default'
  }
}

export function Nis2CountriesPage() {
  const { t } = useTranslation()
  const [selectedCode, setSelectedCode] = useState<string | null>(null)

  const { data: countries, isLoading } = useQuery({
    queryKey: ['nis2Countries'],
    queryFn: () => nis2CountriesApi.list().then((r) => r.data),
  })

  const { data: countryDetail } = useQuery({
    queryKey: ['nis2Countries', 'detail', selectedCode],
    queryFn: () => nis2CountriesApi.get(selectedCode!).then((r) => r.data),
    enabled: !!selectedCode,
  })

  const { data: authority } = useQuery({
    queryKey: ['nis2Countries', 'authority', selectedCode],
    queryFn: () => nis2CountriesApi.authority(selectedCode!).then((r) => r.data),
    enabled: !!selectedCode,
  })

  const list = (Array.isArray(countries) ? countries : ((countries as Record<string, unknown>)?.items ?? [])) as Record<string, unknown>[]
  const detail = (countryDetail ?? {}) as Record<string, unknown>
  const auth = (authority ?? {}) as Record<string, unknown>

  const columns = [
    { key: 'flag', label: '', width: '40px' },
    { key: 'name', label: t('compliance.nis2Countries.country') },
    { key: 'code', label: t('compliance.nis2Countries.code') },
    { key: 'authority_name', label: t('compliance.nis2Countries.authority') },
    { key: 'transposition_status', label: t('compliance.nis2Countries.transpositionStatus') },
    { key: 'specific_requirements', label: t('compliance.nis2Countries.specificRequirements') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.nis2Countries')}
      </h1>

      {list.length > 0 ? (
        <Card>
          <Table
            columns={columns}
            data={list}
            renderCell={(col, row) => {
              if (col.key === 'flag') {
                return <span style={{ fontSize: '20px' }}>{String(row.flag ?? '')}</span>
              }
              if (col.key === 'transposition_status') {
                const st = String(row.transposition_status ?? 'unknown')
                return <Badge variant={transpositionBadge(st)} size="sm">{t(`compliance.nis2Countries.statusLabels.${st}`, { count: 0 }) || st}</Badge>
              }
              if (col.key === 'name') {
                return (
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', padding: 0, font: 'inherit', textDecoration: 'underline' }}
                    onClick={() => setSelectedCode(String(row.code ?? ''))}
                  >
                    {String(row.name ?? '—')}
                  </button>
                )
              }
              return String(row[col.key] ?? '—')
            }}
            loading={isLoading}
            emptyMessage={t('common.noData')}
          />
        </Card>
      ) : (
        !isLoading && <EmptyState icon={<Globe size={32} />} title={t('common.noData')} />
      )}

      <Modal
        open={!!selectedCode}
        onClose={() => setSelectedCode(null)}
        title={t('compliance.nis2Countries.countryDetail')}
        size="lg"
      >
        {selectedCode && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.nis2Countries.country')}</span>
                <p style={{ color: 'var(--color-text-primary)', margin: '4px 0 0' }}>{String(detail.name ?? '—')}</p>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.nis2Countries.code')}</span>
                <p style={{ color: 'var(--color-text-primary)', margin: '4px 0 0' }}>{String(detail.code ?? selectedCode)}</p>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.nis2Countries.authority')}</span>
                <p style={{ color: 'var(--color-text-primary)', margin: '4px 0 0' }}>{String(auth.name ?? detail.authority_name ?? '—')}</p>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.nis2Countries.transpositionStatus')}</span>
                <p style={{ margin: '4px 0 0' }}>
                  <Badge variant={transpositionBadge(String(detail.transposition_status ?? 'unknown'))} size="sm">
                    {String(detail.transposition_status ?? 'unknown')}
                  </Badge>
                </p>
              </div>
            </div>
            {detail.specific_requirements != null && String(detail.specific_requirements) !== '' && (
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.nis2Countries.specificRequirements')}</span>
                <p style={{ color: 'var(--color-text-primary)', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{String(detail.specific_requirements)}</p>
              </div>
            )}
            {auth.contact != null && String(auth.contact) !== '' && (
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.nis2Countries.contact')}</span>
                <p style={{ color: 'var(--color-text-primary)', margin: '4px 0 0' }}>{String(auth.contact)}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}