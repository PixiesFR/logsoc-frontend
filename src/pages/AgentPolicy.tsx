import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, Button, Input, Modal, EmptyState } from '../components/ui'
import { agentConfigApi } from '../api'
import { RefreshCw } from 'lucide-react'

export function AgentPolicyPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [showOverride, setShowOverride] = useState<string | null>(null)
  const [editPolicy, setEditPolicy] = useState(false)

  // Policy form state
  const [probes, setProbes] = useState('')
  const [rateLimit, setRateLimit] = useState('')
  const [intervalVal, setIntervalVal] = useState('')
  const [fimPaths, setFimPaths] = useState('')

  const { data: policy, isLoading } = useQuery({
    queryKey: ['agent-policy'],
    queryFn: () => agentConfigApi.getPolicy().then((r) => r.data),
  })

  const policyData = policy as Record<string, unknown> | undefined

  const updatePolicyMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => agentConfigApi.updatePolicy(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['agent-policy'] }); setEditPolicy(false); toast('success', t('agentPolicy.updateSuccess')) },
    onError: () => toast('error', t('agentPolicy.updateError')),
  })

  const pushMutation = useMutation({
    mutationFn: () => agentConfigApi.updatePolicy(policyData ?? {}),
    onSuccess: () => { toast('success', t('agentPolicy.pushSuccess')) },
    onError: () => toast('error', t('agentPolicy.pushError')),
  })

  const policyFields = [
    { key: 'active_probes', label: t('agentPolicy.activeProbes') },
    { key: 'filters', label: t('agentPolicy.filters') },
    { key: 'rate_limit', label: t('agentPolicy.rateLimit') },
    { key: 'intervals', label: t('agentPolicy.intervals') },
    { key: 'fim_paths', label: t('agentPolicy.fimPaths') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('agentPolicy.title')}</h1>
        {canEdit('admin') && <Button icon={<RefreshCw size={16} />} onClick={() => pushMutation.mutate()} disabled={pushMutation.isPending}>{t('agentPolicy.push')}</Button>}
      </div>

      {/* Global Policy */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('agentPolicy.globalPolicy')}</h2>
          {canEdit('admin') && !editPolicy && <Button size="sm" variant="secondary" onClick={() => setEditPolicy(true)}>{t('common.edit')}</Button>}
        </div>

        {isLoading ? (
          <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
        ) : editPolicy ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('agentPolicy.activeProbes')} value={probes || String(policyData?.active_probes ?? '')} onChange={setProbes} />
            <Input label={t('agentPolicy.rateLimit')} value={rateLimit || String(policyData?.rate_limit ?? '')} onChange={setRateLimit} />
            <Input label={t('agentPolicy.intervals')} value={intervalVal || String(policyData?.intervals ?? '')} onChange={setIntervalVal} />
            <Input label={t('agentPolicy.fimPaths')} value={fimPaths || String(policyData?.fim_paths ?? '')} onChange={setFimPaths} />
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <Button variant="secondary" onClick={() => setEditPolicy(false)}>{t('common.cancel')}</Button>
              <Button onClick={() => updatePolicyMutation.mutate({ active_probes: probes, rate_limit: rateLimit, intervals: intervalVal, fim_paths: fimPaths })}>{t('common.save')}</Button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {policyFields.map((f) => (
              <div key={f.key}>
                <span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{f.label}</span>
                <div style={{ color: 'var(--color-text-primary)', fontSize: '14px', fontWeight: 500 }}>
                  {policyData?.[f.key] != null ? String(policyData[f.key]) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Overrides */}
      <Card>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: '0 0 16px' }}>{t('agentPolicy.overrides')}</h2>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{t('agentPolicy.overridesDescription')}</p>

        {canEdit('admin') && (
          <div style={{ marginTop: '12px' }}>
            <Button size="sm" variant="secondary" onClick={() => setShowOverride('new')}>{t('agentPolicy.addOverride')}</Button>
          </div>
        )}

        <EmptyState title={t('agentPolicy.noOverrides')} />
      </Card>

      {showOverride && canEdit('admin') && (
        <Modal open={!!showOverride} onClose={() => setShowOverride(null)} title={t('agentPolicy.addOverride')} footer={
          <>
            <Button variant="secondary" onClick={() => setShowOverride(null)}>{t('common.cancel')}</Button>
            <Button onClick={() => { setShowOverride(null) }}>{t('common.save')}</Button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('agentPolicy.agentId')} value="" onChange={() => {}} />
            <Input label={t('agentPolicy.activeProbes')} value="" onChange={() => {}} />
            <Input label={t('agentPolicy.rateLimit')} value="" onChange={() => {}} />
          </div>
        </Modal>
      )}
    </div>
  )
}