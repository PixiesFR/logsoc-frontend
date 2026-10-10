import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { gdprApi } from '../api'
import { Card, Badge, Table, EmptyState, Select, Modal } from '../components/ui'
import { usePermissions } from '../hooks/usePermissions'
import { ClipboardList, FileText } from 'lucide-react'

function auditStatusVariant(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'compliant': return 'success'
    case 'partial': return 'warning'
    case 'non-compliant': return 'danger'
    default: return 'default'
  }
}

export function GdprAuditPage() {
  const { t } = useTranslation()
  const { canView } = usePermissions()
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedRef, setSelectedRef] = useState<string | null>(null)

  const { data: audits, isLoading } = useQuery({
    queryKey: ['gdpr', 'audit', statusFilter],
    queryFn: () => gdprApi.auditList(statusFilter ? { status: statusFilter } : undefined).then((r) => r.data),
    enabled: canView(),
  })

  const { data: auditDetail, isLoading: detailLoading } = useQuery({
    queryKey: ['gdpr', 'audit-detail', selectedRef],
    queryFn: () => gdprApi.auditGet(selectedRef!).then((r) => r.data),
    enabled: !!selectedRef,
  })

  const auditList = (Array.isArray(audits) ? audits : ((audits as Record<string, unknown>)?.items ?? (audits as Record<string, unknown>)?.controls ?? (audits as Record<string, unknown>)?.audits ?? [])) as Record<string, unknown>[]
  const detail = auditDetail as Record<string, unknown> | null

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('compliance.statusCompliant'), value: 'compliant' },
    { label: t('compliance.statusPartial'), value: 'partial' },
    { label: t('compliance.statusNonCompliant'), value: 'non-compliant' },
    { label: t('compliance.statusNotEvaluated'), value: 'not-evaluated' },
  ]

  const columns = [
    { key: 'reference', label: t('compliance.reference'), width: '120px' },
    { key: 'status', label: t('common.status'), width: '140px' },
    { key: 'title', label: t('compliance.controlTitle') },
    { key: 'date', label: t('common.date'), width: '120px' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.gdprAudit')}
      </h1>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: '200px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} label={t('common.status')} />
        </div>
      </div>

      {auditList.length > 0 ? (
        <Card>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px 0' }}>
            {t('compliance.auditList')}
          </h3>
          <Table
            columns={columns}
            data={auditList as unknown as Record<string, unknown>[]}
            renderCell={(col, row) => {
              if (col.key === 'status') {
                const st = String(row.status ?? 'not-evaluated')
                return <Badge variant={auditStatusVariant(st)} size="sm">{t(`compliance.statusLabels.${st}`)}</Badge>
              }
              if (col.key === 'reference') {
                const ref = String(row.reference ?? row.id ?? '—')
                return (
                  <button
                    style={{ background: 'none', border: 'none', color: 'var(--color-accent)', cursor: 'pointer', textDecoration: 'underline', font: 'inherit', padding: 0 }}
                    onClick={() => setSelectedRef(ref)}
                  >
                    {ref}
                  </button>
                )
              }
              return String(row[col.key] ?? '—')
            }}
            loading={isLoading}
            emptyMessage={t('compliance.noAudits')}
          />
        </Card>
      ) : (
        !isLoading && <EmptyState icon={<ClipboardList size={32} />} title={t('compliance.noAudits')} />
      )}

      <Modal
        open={!!selectedRef}
        onClose={() => setSelectedRef(null)}
        title={t('compliance.auditDetail')}
        size="lg"
      >
        {detailLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton" style={{ height: '24px', borderRadius: '4px' }} />
            ))}
          </div>
        ) : detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('compliance.reference')}</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail.reference ?? detail.id ?? '—')}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('compliance.article')}</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail.article ?? '—')}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('compliance.alinea')}</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(detail.alinea ?? detail.paragraph ?? '—')}</div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('common.status')}</div>
                <Badge variant={auditStatusVariant(String(detail.status ?? 'not-evaluated'))} size="sm">
                  {t(`compliance.statusLabels.${String(detail.status ?? 'not-evaluated')}`)}
                </Badge>
              </div>
            </div>
            {detail.title != null && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('compliance.controlTitle')}</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{String(detail.title)}</div>
              </div>
            )}
            {detail.description != null && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('common.description')}</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{String(detail.description)}</div>
              </div>
            )}
            {detail.evidence != null && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('compliance.evidence')}</div>
                <div style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{String(detail.evidence)}</div>
              </div>
            )}
            {Array.isArray(detail.history) && (
              <div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('compliance.history')}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {(Array.isArray(detail.history) ? detail.history : []).map((h: Record<string, unknown>, i: number) => (
                    <div key={i} style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                      {String(h.date ?? '—')} — {String(h.status ?? '—')} {h.comment ? `(${String(h.comment)})` : ''}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={<FileText size={32} />} title={t('compliance.noAuditDetail')} />
        )}
      </Modal>
    </div>
  )
}