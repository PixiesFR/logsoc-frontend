import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { useToast } from '../components/ui/Toast'
import { Card, StatCard, Badge, Button, Select, Modal, EmptyState } from '../components/ui'
import { aiApi } from '../api'
import { Brain, AlertTriangle, Info, Zap, EyeOff } from 'lucide-react'

export function InsightsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [selectedInsight, setSelectedInsight] = useState<Record<string, unknown> | null>(null)

  const { data: insights, isLoading } = useQuery({
    queryKey: ['insights', typeFilter, severityFilter],
    queryFn: () => aiApi.listInsights({ type: typeFilter || undefined, severity: severityFilter || undefined } as Record<string, string>).then((r) => r.data),
  })

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['insights', 'stats'],
    queryFn: () => aiApi.insightsStats().then((r) => r.data),
  })

  const { data: insightDetail } = useQuery({
    queryKey: ['insight', 'detail', selectedInsight?.id],
    queryFn: () => aiApi.getInsight(Number(selectedInsight!.id)).then((r) => r.data),
    enabled: !!selectedInsight,
  })

  const analyzeMutation = useMutation({
    mutationFn: () => aiApi.analyze(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insights'] }); toast('success', t('insights.analyzeSuccess')) },
    onError: () => toast('error', t('insights.analyzeError')),
  })

  const dismissMutation = useMutation({
    mutationFn: (id: number) => aiApi.dismissInsight(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insights'] }); toast('success', t('insights.dismissSuccess')) },
    onError: () => toast('error', t('insights.dismissError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => aiApi.deleteInsight(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['insights'] }); toast('success', t('insights.deleteSuccess')) },
    onError: () => toast('error', t('insights.deleteError')),
  })

  const statsData = stats as Record<string, unknown> | undefined
  const totalInsights = Number(statsData?.total ?? 0)
  const byType = (statsData?.by_type ?? {}) as Record<string, number>
  const bySeverity = (statsData?.by_severity ?? {}) as Record<string, number>

  const sevVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (s === 'critical') return 'danger'
    if (s === 'high') return 'warning'
    if (s === 'medium') return 'info'
    return 'default'
  }

  const typeIcon = (tp: string) => {
    if (tp === 'anomaly') return <AlertTriangle size={18} style={{ color: 'var(--color-warning)' }} />
    if (tp === 'threat') return <Zap size={18} style={{ color: 'var(--color-danger)' }} />
    return <Info size={18} style={{ color: 'var(--color-info)' }} />
  }

  const filteredInsights = ((insights ?? []) as Record<string, unknown>[]).filter((ins) => {
    if (typeFilter && ins.type !== typeFilter) return false
    if (statusFilter === 'active' && ins.is_dismissed) return false
    if (statusFilter === 'dismissed' && !ins.is_dismissed) return false
    if (severityFilter && ins.severity !== severityFilter) return false
    return true
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('insights.title')}</h1>
        <Button icon={<Brain size={16} />} onClick={() => analyzeMutation.mutate()} disabled={analyzeMutation.isPending}>{t('insights.analyze')}</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label={t('insights.totalInsights')} value={totalInsights} icon={<Brain size={20} />} color="var(--color-accent)" loading={statsLoading} />
        <StatCard label={t('insights.byType')} value={Object.keys(byType).length} icon={<Info size={20} />} color="var(--color-info)" loading={statsLoading} />
        <StatCard label={t('insights.bySeverity')} value={Object.keys(bySeverity).length} icon={<AlertTriangle size={20} />} color="var(--color-warning)" loading={statsLoading} />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '140px' }}>
            <Select label={t('common.type')} value={typeFilter} onChange={setTypeFilter} options={[{ label: t('common.all'), value: '' }, ...Object.keys(byType).map((k) => ({ label: k, value: k }))]} />
          </div>
          <div style={{ minWidth: '140px' }}>
            <Select label={t('common.status')} value={statusFilter} onChange={setStatusFilter} options={[{ label: t('common.all'), value: '' }, { label: t('insights.active'), value: 'active' }, { label: t('insights.dismissed'), value: 'dismissed' }]} />
          </div>
          <div style={{ minWidth: '140px' }}>
            <Select label={t('common.severity')} value={severityFilter} onChange={setSeverityFilter} options={[{ label: t('common.all'), value: '' }, ...Object.keys(bySeverity).map((k) => ({ label: k, value: k }))]} />
          </div>
        </div>

        {filteredInsights.length === 0 && !isLoading ? (
          <EmptyState title={t('insights.noInsights')} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {isLoading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="skeleton" style={{ height: '80px', borderRadius: '8px' }} />
              ))
            ) : (
              filteredInsights.map((ins) => (
                <div key={String(ins.id)} style={{ padding: '16px', border: '1px solid var(--color-border)', borderRadius: '8px', background: 'var(--color-bg-primary)', cursor: 'pointer' }} onClick={() => setSelectedInsight(ins)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    {typeIcon(String(ins.type ?? ''))}
                    <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px' }}>{String(ins.title ?? ins.description ?? '')}</span>
                    <Badge variant={sevVariant(String(ins.severity ?? ''))}>{String(ins.severity ?? '')}</Badge>
                    {Boolean(ins.is_dismissed) && <Badge variant="default">{t('insights.dismissed')}</Badge>}
                  </div>
                  <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 8px' }}>{String(ins.description ?? '')}</p>
                  {String(ins.recommendation ?? "") && <p style={{ fontSize: '13px', color: 'var(--color-accent)', margin: '0 0 4px' }}>💡 {String(ins.recommendation)}</p>}
                  {ins.confidence_score != null && <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('insights.confidence')}: {String(ins.confidence_score)}%</span>}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
                    {!ins.is_dismissed && <Button size="sm" variant="secondary" icon={<EyeOff size={14} />} onClick={() => dismissMutation.mutate(Number(ins.id))}>{t('insights.dismiss')}</Button>}
                    <Button size="sm" variant="danger" onClick={() => deleteMutation.mutate(Number(ins.id))}>{t('common.delete')}</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </Card>

      {selectedInsight && (
        <Modal open={!!selectedInsight} onClose={() => setSelectedInsight(null)} title={t('insights.insightDetail')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('common.type')}</span><div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>{String(insightDetail?.type ?? selectedInsight.type ?? '')}</div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('common.severity')}</span><div><Badge variant={sevVariant(String(insightDetail?.severity ?? selectedInsight.severity ?? ''))}>{String(insightDetail?.severity ?? selectedInsight.severity ?? '')}</Badge></div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('insights.confidence')}</span><div style={{ color: 'var(--color-text-primary)' }}>{insightDetail?.confidence_score ?? selectedInsight.confidence_score ?? '—'}%</div></div>
            </div>
            <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('common.description')}</span><p style={{ color: 'var(--color-text-primary)', fontSize: '14px' }}>{String(insightDetail?.description ?? selectedInsight.description ?? '')}</p></div>
            {insightDetail?.recommendation && <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('insights.recommendation')}</span><p style={{ color: 'var(--color-accent)', fontSize: '14px' }}>{String(insightDetail.recommendation)}</p></div>}
            {insightDetail?.source_events && (
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>{t('insights.sourceEvents')}</h3>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{JSON.stringify(insightDetail.source_events).slice(0, 500)}</div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}