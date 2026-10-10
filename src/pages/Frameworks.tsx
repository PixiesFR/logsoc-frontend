import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { frameworksModularApi } from '../api'
import { Card, Badge, StatCard, Modal, EmptyState, Button } from '../components/ui'
import { useToast } from '../components/ui/Toast'
import { Layers, CheckCircle } from 'lucide-react'

export function FrameworksPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()
  const [selectedFramework, setSelectedFramework] = useState<string | null>(null)

  const { data: frameworks, isLoading: fwLoading } = useQuery({
    queryKey: ['frameworks'],
    queryFn: () => frameworksModularApi.list().then((r) => r.data),
  })

  const { data: summary } = useQuery({
    queryKey: ['frameworks', 'summary'],
    queryFn: () => frameworksModularApi.summary().then((r) => r.data),
  })

  const { data: frameworkDetail } = useQuery({
    queryKey: ['frameworks', 'detail', selectedFramework],
    queryFn: () => frameworksModularApi.get(selectedFramework!).then((r) => r.data),
    enabled: !!selectedFramework,
  })

  const toggleMutation = useMutation({
    mutationFn: ({ framework, data }: { framework: string; data: Record<string, unknown> }) =>
      frameworksModularApi.updateAssessment(framework, data),
    onSuccess: () => {
      toast('success', t('compliance.frameworks.updateSuccess'))
      qc.invalidateQueries({ queryKey: ['frameworks'] })
    },
    onError: () => toast('error', t('compliance.frameworks.updateError')),
  })

  const list = (Array.isArray(frameworks) ? frameworks : ((frameworks as Record<string, unknown>)?.items ?? [])) as Record<string, unknown>[]
  const summaryData = (summary ?? {}) as Record<string, unknown>
  const detail = (frameworkDetail ?? {}) as Record<string, unknown>
  const detailControls = (Array.isArray(detail.controls) ? detail.controls : []) as Record<string, unknown>[]

  const activeCount = list.filter((f) => f.is_active === true || f.is_active === 1).length
  const totalScore = typeof summaryData.global_score === 'number' ? summaryData.global_score : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.frameworks')}
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('compliance.frameworks.totalFrameworks')}
          value={list.length}
          icon={<Layers size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={fwLoading}
        />
        <StatCard
          label={t('compliance.frameworks.activeFrameworks')}
          value={activeCount}
          icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />}
          loading={fwLoading}
        />
        <StatCard
          label={t('compliance.frameworks.globalScore')}
          value={totalScore > 0 ? `${totalScore}%` : '—'}
          icon={<Layers size={20} style={{ color: 'var(--color-info)' }} />}
          loading={fwLoading}
        />
      </div>

      {list.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {list.map((fw, i) => {
            const isActive = fw.is_active === true || fw.is_active === 1
            const score = typeof fw.score === 'number' ? fw.score : null
            return (
              <Card key={String(fw.id ?? i)} onClick={() => setSelectedFramework(String(fw.code ?? fw.id ?? i))}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>
                    {String(fw.name ?? '—')}
                  </h3>
                  <Badge variant={isActive ? 'success' : 'default'} size="sm">
                    {isActive ? t('common.active') : t('common.inactive')}
                  </Badge>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 12px' }}>
                  {String(fw.description ?? '—')}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {score !== null ? `${score}%` : '—'}
                  </span>
                  <Button
                    variant={isActive ? 'danger' : 'primary'}
                    size="sm"
                    onClick={(e?: React.MouseEvent) => {
                      e?.stopPropagation()
                      toggleMutation.mutate({
                        framework: String(fw.code ?? fw.id),
                        data: { is_active: !isActive },
                      })
                    }}
                  >
                    {isActive ? t('compliance.frameworks.deactivate') : t('compliance.frameworks.activate')}
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        !fwLoading && <EmptyState icon={<Layers size={32} />} title={t('common.noData')} />
      )}

      <Modal
        open={!!selectedFramework}
        onClose={() => setSelectedFramework(null)}
        title={String(detail.name ?? selectedFramework ?? '')}
        size="lg"
      >
        {selectedFramework && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.frameworks.description')}</span>
                <p style={{ color: 'var(--color-text-primary)', margin: '4px 0 0' }}>{String(detail.description ?? '—')}</p>
              </div>
              <div>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('compliance.frameworks.score')}</span>
                <p style={{ color: 'var(--color-text-primary)', margin: '4px 0 0' }}>{typeof detail.score === 'number' ? `${detail.score}%` : '—'}</p>
              </div>
            </div>
            {detailControls.length > 0 && (
              <div>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
                  {t('compliance.frameworks.controls')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {detailControls.map((ctrl, j) => (
                    <div
                      key={j}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        border: '1px solid var(--color-border)',
                        borderRadius: '8px',
                        background: 'var(--color-bg-primary)',
                      }}
                    >
                      <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{String(ctrl.reference ?? ctrl.name ?? `Control ${j + 1}`)}</span>
                      <Badge variant={ctrl.status === 'compliant' ? 'success' : ctrl.status === 'partial' ? 'warning' : 'danger'} size="sm">
                        {String(ctrl.status ?? '—')}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}