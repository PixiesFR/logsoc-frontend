import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, StatCard, Badge, Button, Input, Modal, EmptyState } from '../components/ui'
import { yaraApi } from '../api'
import { Shield, RefreshCw, Plus, Trash2 } from 'lucide-react'

export function YaraRulesetPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [showAddRule, setShowAddRule] = useState(false)
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleContent, setNewRuleContent] = useState('')

  const { data: ruleset, isLoading } = useQuery({
    queryKey: ['yara-ruleset'],
    queryFn: () => yaraApi.getRuleset().then((r) => r.data),
  })

  const reloadMutation = useMutation({
    mutationFn: () => yaraApi.reload(),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['yara-ruleset'] }); toast('success', t('yaraRuleset.pushSuccess')) },
    onError: () => toast('error', t('yaraRuleset.pushError')),
  })

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => yaraApi.updateRuleset(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['yara-ruleset'] }); setShowAddRule(false); setNewRuleName(''); setNewRuleContent(''); toast('success', t('yaraRuleset.updateSuccess')) },
    onError: () => toast('error', t('yaraRuleset.updateError')),
  })

  const rulesetData = ruleset as Record<string, unknown> | undefined
  const version = String(rulesetData?.version ?? '—')
  const date = String(rulesetData?.compiled_at ?? rulesetData?.date ?? '—')
  const rules = (rulesetData?.rules as Record<string, unknown>[]) ?? []
  const ruleCount = Number(rulesetData?.rule_count ?? rules.length ?? 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('yaraRuleset.title')}</h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          {canEdit('admin') && <Button icon={<RefreshCw size={16} />} onClick={() => reloadMutation.mutate()} disabled={reloadMutation.isPending}>{t('yaraRuleset.push')}</Button>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label={t('yaraRuleset.version')} value={version} icon={<Shield size={20} />} color="var(--color-accent)" loading={isLoading} />
        <StatCard label={t('yaraRuleset.ruleCount')} value={ruleCount} icon={<Shield size={20} />} color="var(--color-info)" loading={isLoading} />
        <StatCard label={t('yaraRuleset.compiledAt')} value={date.replace('T', ' ').slice(0, 19)} icon={<Shield size={20} />} color="var(--color-success)" loading={isLoading} />
      </div>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{t('yaraRuleset.rules')}</h2>
          {canEdit('admin') && <Button size="sm" icon={<Plus size={14} />} onClick={() => setShowAddRule(true)}>{t('yaraRuleset.addRule')}</Button>}
        </div>

        {rules.length === 0 && !isLoading ? (
          <EmptyState title={t('yaraRuleset.noRules')} />
        ) : isLoading ? (
          <div className="skeleton" style={{ height: '200px', borderRadius: '8px' }} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rules.map((rule, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', border: '1px solid var(--color-border)', borderRadius: '8px' }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px' }}>{String(rule.name ?? `Rule ${i + 1}`)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{String(rule.category ?? '')} {rule.active !== undefined && <Badge variant={rule.active ? 'success' : 'default'}>{rule.active ? t('common.active') : t('common.inactive')}</Badge>}</div>
                </div>
                {canEdit('admin') && (
                  <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={() => toast('info', 'Rule removal via update API')}>{t('common.delete')}</Button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {showAddRule && canEdit('admin') && (
        <Modal open={showAddRule} onClose={() => setShowAddRule(false)} title={t('yaraRuleset.addRule')} footer={
          <>
            <Button variant="secondary" onClick={() => setShowAddRule(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => updateMutation.mutate({ action: 'add', name: newRuleName, content: newRuleContent })} disabled={!newRuleName}>{t('common.create')}</Button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('yaraRuleset.ruleName')} value={newRuleName} onChange={setNewRuleName} required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>{t('yaraRuleset.ruleContent')}</label>
              <textarea
                value={newRuleContent}
                onChange={(e) => setNewRuleContent(e.target.value)}
                style={{ padding: '8px 12px', fontSize: '13px', fontFamily: 'monospace', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none', minHeight: '200px', resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
                placeholder="rule MyRule { ... }"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}