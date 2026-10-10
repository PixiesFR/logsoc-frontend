import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { correlationApi } from '../api'
import { usePermissions } from '../hooks/usePermissions'
import { Card, Badge, StatCard, Table, Modal, Button, Input, EmptyState, ConfirmDialog, useToast } from '../components/ui'
import { Link2, ShieldAlert, ListChecks, Plus, X } from 'lucide-react'

interface CorrelationStats {
  recent_correlations: number
  top_rules_count: number
  alerts_generated: number
}

interface CorrelationRule {
  id: string
  rule_id: string
  name: string
  description: string
  severity: string
  query: string
  condition_logic: string
  is_active: boolean
  is_template: boolean
  exceptions: ExceptionsData | null
  created_by: number | null
  created_at: string | null
  updated_at: string | null
}

interface ExceptionsData {
  ignore_ips?: string[]
  ignore_users?: string[]
  ignore_paths?: string[]
  ignore_hours?: { start: string; end: string }[]
}

const severityVariant = (sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'default'
    default: return 'default'
  }
}

const defaultExceptions: ExceptionsData = {
  ignore_ips: [],
  ignore_users: [],
  ignore_paths: [],
  ignore_hours: [],
}

function countExceptions(exc: ExceptionsData | null): number {
  if (!exc) return 0
  let c = 0
  if (exc.ignore_ips?.length) c += exc.ignore_ips.length
  if (exc.ignore_users?.length) c += exc.ignore_users.length
  if (exc.ignore_paths?.length) c += exc.ignore_paths.length
  if (exc.ignore_hours?.length) c += exc.ignore_hours.length
  return c
}

export function CorrelationPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [showCreateRule, setShowCreateRule] = useState(false)
  const [deleteRuleId, setDeleteRuleId] = useState<string | null>(null)
  const [editRule, setEditRule] = useState<CorrelationRule | null>(null)

  // Create rule form state
  const [newRuleName, setNewRuleName] = useState('')
  const [newRuleDescription, setNewRuleDescription] = useState('')
  const [newRuleEventType, setNewRuleEventType] = useState('')
  const [newRuleSeverity, setNewRuleSeverity] = useState('medium')
  const [newRuleMessageContains, setNewRuleMessageContains] = useState('')
  const [newRuleCount, setNewRuleCount] = useState('5')
  const [newRuleWindow, setNewRuleWindow] = useState('60')
  const [newRuleExceptions, setNewRuleExceptions] = useState<ExceptionsData>({ ...defaultExceptions })
  const [newExceptionIp, setNewExceptionIp] = useState('')
  const [newExceptionUser, setNewExceptionUser] = useState('')
  const [newExceptionPath, setNewExceptionPath] = useState('')
  const [newExceptionHourStart, setNewExceptionHourStart] = useState('')
  const [newExceptionHourEnd, setNewExceptionHourEnd] = useState('')

  // Edit rule form state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editSeverity, setEditSeverity] = useState('medium')
  const [editEventType, setEditEventType] = useState('')
  const [editMessageContains, setEditMessageContains] = useState('')
  const [editCount, setEditCount] = useState('5')
  const [editWindow, setEditWindow] = useState('60')
  const [editExceptions, setEditExceptions] = useState<ExceptionsData>({ ...defaultExceptions })
  const [editExceptionIp, setEditExceptionIp] = useState('')
  const [editExceptionUser, setEditExceptionUser] = useState('')
  const [editExceptionPath, setEditExceptionPath] = useState('')
  const [editExceptionHourStart, setEditExceptionHourStart] = useState('')
  const [editExceptionHourEnd, setEditExceptionHourEnd] = useState('')

  // Queries
  const { data: stats, isLoading: statsLoading } = useQuery<CorrelationStats>({
    queryKey: ['correlation', 'stats'],
    queryFn: () => correlationApi.stats().then((r) => r.data),
  })

  const { data: customRulesRaw, isLoading: rulesLoading } = useQuery<CorrelationRule[] | { count: number; rules: CorrelationRule[] }>({
    queryKey: ['correlation', 'customRules'],
    queryFn: () => correlationApi.listCustomRules().then((r) => r.data),
  })
  const rules: CorrelationRule[] = Array.isArray(customRulesRaw) ? customRulesRaw : (customRulesRaw?.rules ?? [])

  // Mutations
  const createRuleMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => correlationApi.createCustomRule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation', 'customRules'] })
      toast('success', t('correlation.createSuccess'))
      setShowCreateRule(false)
      resetCreateForm()
    },
    onError: () => {
      toast('error', t('correlation.createError'))
    },
  })

  const updateRuleMutation = useMutation({
    mutationFn: (data: { id: string; updates: Record<string, unknown> }) => correlationApi.updateCustomRule(data.id, data.updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation', 'customRules'] })
      toast('success', t('correlation.updateSuccess'))
      setEditRule(null)
    },
    onError: () => {
      toast('error', t('correlation.updateError'))
    },
  })

  const toggleRuleMutation = useMutation({
    mutationFn: (data: { id: string; active: boolean }) => correlationApi.updateCustomRule(data.id, { is_active: !data.active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation', 'customRules'] })
    },
  })

  const deleteRuleMutation = useMutation({
    mutationFn: (id: string) => correlationApi.deleteCustomRule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['correlation', 'customRules'] })
      toast('success', t('correlation.deleteSuccess'))
      setDeleteRuleId(null)
    },
  })

  const resetCreateForm = useCallback(() => {
    setNewRuleName('')
    setNewRuleDescription('')
    setNewRuleEventType('')
    setNewRuleSeverity('medium')
    setNewRuleMessageContains('')
    setNewRuleCount('5')
    setNewRuleWindow('60')
    setNewRuleExceptions({ ...defaultExceptions })
    setNewExceptionIp('')
    setNewExceptionUser('')
    setNewExceptionPath('')
    setNewExceptionHourStart('')
    setNewExceptionHourEnd('')
  }, [])

  const buildQuery = useCallback((eventType: string, messageContains: string, count: string, window: string) => {
    const parts: string[] = []
    parts.push("SELECT source_host, actor_username")
    if (messageContains.trim()) parts.push(", message")
    parts.push(", COUNT(*) as count FROM siem_logs WHERE 1=1")
    if (eventType.trim()) parts.push(` AND event_type = '${eventType}'`)
    if (messageContains.trim()) parts.push(` AND message LIKE '%${messageContains.trim()}%'`)
    parts.push(` AND received_at >= NOW() - INTERVAL ${window || '60'} SECOND GROUP BY source_host, actor_username`)
    if (messageContains.trim()) parts.push(", message")
    parts.push(` HAVING count >= ${count || '5'}`)
    return parts.join('')
  }, [])

  const handleCreateRule = useCallback(() => {
    if (!newRuleName.trim()) return
    const query = buildQuery(newRuleEventType, newRuleMessageContains, newRuleCount, newRuleWindow)
    createRuleMutation.mutate({
      name: newRuleName,
      description: newRuleDescription,
      query,
      severity: newRuleSeverity,
      exceptions: JSON.stringify(newRuleExceptions),
    })
  }, [newRuleName, newRuleDescription, newRuleEventType, newRuleMessageContains, newRuleCount, newRuleWindow, newRuleSeverity, newRuleExceptions, createRuleMutation, buildQuery])

  const handleDeleteRule = useCallback(() => {
    if (deleteRuleId) {
      deleteRuleMutation.mutate(deleteRuleId)
    }
  }, [deleteRuleId, deleteRuleMutation])

  const openEditModal = useCallback((rule: CorrelationRule) => {
    const query = rule.query || ''
    setEditRule(rule)
    setEditName(rule.name || '')
    setEditDescription(rule.description || '')
    setEditSeverity(rule.severity || 'medium')
    // Parse SQL query to fill visual form fields
    setEditEventType('')
    setEditMessageContains('')
    setEditCount('5')
    setEditWindow('60')
    try {
      const evtMatch = query.match(/event_type\s*=\s*'([^']*)'/i)
      if (evtMatch) setEditEventType(evtMatch[1])
      const msgMatch = query.match(/message\s+LIKE\s+'%([^']*)%'/i) || query.match(/message\s+LIKE\s+'%([^%]*)%'/i)
      if (msgMatch) setEditMessageContains(msgMatch[1])
      const countMatch = query.match(/HAVING\s+count\s*>=\s*(\d+)/i)
      if (countMatch) setEditCount(countMatch[1])
      const windowMatch = query.match(/INTERVAL\s+(\d+)\s+SECOND/i)
      if (windowMatch) setEditWindow(windowMatch[1])
    } catch { /* ignore parse errors */ }
    setEditExceptions(rule.exceptions ? { ...rule.exceptions } : { ...defaultExceptions })
    setEditExceptionIp('')
    setEditExceptionUser('')
    setEditExceptionPath('')
    setEditExceptionHourStart('')
    setEditExceptionHourEnd('')
  }, [])

  const handleUpdateRule = useCallback(() => {
    if (!editRule || !editName.trim()) return
    const query = buildQuery(editEventType, editMessageContains, editCount, editWindow)
    updateRuleMutation.mutate({
      id: String(editRule.id),
      updates: {
        name: editName,
        description: editDescription,
        query,
        severity: editSeverity,
        exceptions: JSON.stringify(editExceptions),
      },
    })
  }, [editRule, editName, editDescription, editEventType, editMessageContains, editCount, editWindow, editSeverity, editExceptions, updateRuleMutation, buildQuery])

  // Exception list item component (reused in create & edit modals)
  const ExceptionList = ({ items, onRemove }: { items: string[]; onRemove: (idx: number) => void }) => {
    if (!items.length) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
        {items.map((item, idx) => (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
            {item}
            <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 0, lineHeight: 1, fontSize: '14px' }}><X size={12} /></button>
          </span>
        ))}
      </div>
    )
  }

  const HourList = ({ items, onRemove }: { items: { start: string; end: string }[]; onRemove: (idx: number) => void }) => {
    if (!items.length) return null
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
        {items.map((item, idx) => (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '13px', color: 'var(--color-text-primary)' }}>
            {item.start} - {item.end}
            <button onClick={() => onRemove(idx)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: 0, lineHeight: 1, fontSize: '14px' }}><X size={12} /></button>
          </span>
        ))}
      </div>
    )
  }

  const ruleColumns = [
    { key: 'name', label: t('common.name') },
    { key: 'severity', label: t('common.severity') },
    { key: 'threshold', label: `${t('correlation.minCount')} / ${t('correlation.windowSeconds')}` },
    { key: 'exceptions', label: t('correlation.exceptions') },
    { key: 'active', label: t('common.status') },
    { key: 'actions', label: t('common.actions') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('correlation.rules')}
      </h1>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <StatCard
          label={t('correlation.totalRules')}
          value={stats?.recent_correlations ?? 0}
          icon={<Link2 size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={statsLoading}
        />
        <StatCard
          label={t('correlation.activeRules')}
          value={stats?.top_rules_count ?? 0}
          icon={<ListChecks size={20} style={{ color: 'var(--color-info)' }} />}
          loading={statsLoading}
        />
        <StatCard
          label={t('correlation.alertsGenerated')}
          value={stats?.alerts_generated ?? 0}
          icon={<ShieldAlert size={20} style={{ color: 'var(--color-danger)' }} />}
          loading={statsLoading}
        />
      </div>

      {/* Rules table */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
          {canEdit('analyst') && (
            <Button variant="primary" size="sm" onClick={() => { resetCreateForm(); setShowCreateRule(true) }}>
              <Plus size={14} style={{ marginRight: '6px' }} />
              {t('correlation.createRule')}
            </Button>
          )}
        </div>
        {rulesLoading ? (
          <Table columns={ruleColumns} data={[]} loading />
        ) : rules.length > 0 ? (
          <Table
            columns={ruleColumns}
            data={rules as unknown as Record<string, unknown>[]}
            renderCell={(col, row) => {
              const rule = row as unknown as CorrelationRule
              if (col.key === 'name') {
                return (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: 'var(--color-text-primary)' }}>{rule.name}</span>
                    {rule.is_template && (
                      <Badge variant="info">{t('correlation.preconfigured')}</Badge>
                    )}
                  </div>
                )
              }
              if (col.key === 'severity') {
                return <Badge variant={severityVariant(rule.severity)}>{rule.severity}</Badge>
              }
              if (col.key === 'threshold') {
                // Parse from query
                let count = '5', window = '60'
                try {
                  const q = rule.query || ''
                  const cMatch = q.match(/HAVING\s+count\s*>=\s*(\d+)/i)
                  if (cMatch) count = cMatch[1]
                  const wMatch = q.match(/INTERVAL\s+(\d+)\s+SECOND/i)
                  if (wMatch) window = wMatch[1]
                } catch { /* */ }
                return <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>{count} / {window}s</span>
              }
              if (col.key === 'exceptions') {
                const c = countExceptions(rule.exceptions)
                return (
                  <Badge variant={c > 0 ? 'warning' : 'default'}>
                    {c > 0 ? `${c} ${t('correlation.exceptions')}` : t('correlation.noExceptions')}
                  </Badge>
                )
              }
              if (col.key === 'active') {
                const isActive = Boolean(rule.is_active)
                return <Badge variant={isActive ? 'success' : 'default'}>{isActive ? t('common.active') : t('common.inactive')}</Badge>
              }
              if (col.key === 'actions') {
                const ruleId = String(rule.id ?? '')
                const isActive = Boolean(rule.is_active)
                return (
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button variant="secondary" size="sm" onClick={() => openEditModal(rule)}>
                      {t('common.edit')}
                    </Button>
                    <Button variant={isActive ? 'secondary' : 'primary'} size="sm" onClick={() => toggleRuleMutation.mutate({ id: ruleId, active: isActive })}>
                      {isActive ? t('common.deactivate') : t('common.activate')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => setDeleteRuleId(ruleId)}>
                      {t('common.delete')}
                    </Button>
                  </div>
                )
              }
              return String(row[col.key] ?? '')
            }}
          />
        ) : (
          <EmptyState icon={<ListChecks size={32} />} title={t('correlation.noRules')} />
        )}
      </Card>

      {/* Create rule modal */}
      <Modal
        open={showCreateRule}
        onClose={() => setShowCreateRule(false)}
        title={t('correlation.createRule')}
        size="lg"
        footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setShowCreateRule(false)}>{t('common.cancel')}</Button>
            <Button variant="primary" onClick={handleCreateRule} disabled={!newRuleName.trim() || createRuleMutation.isPending}>
              {createRuleMutation.isPending ? t('common.loading') : t('common.create')}
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* General */}
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
            {t('correlation.general') || 'General'}
          </div>
          <Input value={newRuleName} onChange={setNewRuleName} required />
          <Input value={newRuleDescription} onChange={setNewRuleDescription} />

          {/* Detection */}
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginTop: '8px' }}>
            {t('correlation.detection') || 'Detection'}
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.eventType')}</label>
            <select
              value={newRuleEventType}
              onChange={(e) => setNewRuleEventType(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }}
            >
              <option value="">{t('common.all')}</option>
              <option value="journald">Log systeme (journald)</option>
              <option value="network">Reseau (network)</option>
              <option value="ebpf">Noyau (ebpf)</option>
              <option value="fim">Fichier (fim)</option>
            </select>
          </div>
          <Input value={newRuleMessageContains} onChange={setNewRuleMessageContains} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Input value={newRuleCount} onChange={setNewRuleCount} type="number" />
            <Input value={newRuleWindow} onChange={setNewRuleWindow} type="number" />
          </div>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('common.severity')}</label>
            <select
              value={newRuleSeverity}
              onChange={(e) => setNewRuleSeverity(e.target.value)}
              style={{ width: '100%', padding: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }}
            >
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {/* Exceptions */}
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginTop: '8px' }}>
            {t('correlation.exceptions')}
          </div>
          {/* Ignore IPs */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignoreIps')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input value={newExceptionIp} onChange={setNewExceptionIp} placeholder="192.168.1.1" />
              <Button variant="secondary" size="sm" onClick={() => {
                if (newExceptionIp.trim()) {
                  setNewRuleExceptions({ ...newRuleExceptions, ignore_ips: [...(newRuleExceptions.ignore_ips || []), newExceptionIp.trim()] })
                  setNewExceptionIp('')
                }
              }}>{t('common.add') || '+'}</Button>
            </div>
            <ExceptionList items={newRuleExceptions.ignore_ips || []} onRemove={(idx) => {
              const updated = [...(newRuleExceptions.ignore_ips || [])]
              updated.splice(idx, 1)
              setNewRuleExceptions({ ...newRuleExceptions, ignore_ips: updated })
            }} />
          </div>
          {/* Ignore Users */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignoreUsers')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input value={newExceptionUser} onChange={setNewExceptionUser} placeholder="monitoring" />
              <Button variant="secondary" size="sm" onClick={() => {
                if (newExceptionUser.trim()) {
                  setNewRuleExceptions({ ...newRuleExceptions, ignore_users: [...(newRuleExceptions.ignore_users || []), newExceptionUser.trim()] })
                  setNewExceptionUser('')
                }
              }}>{t('common.add') || '+'}</Button>
            </div>
            <ExceptionList items={newRuleExceptions.ignore_users || []} onRemove={(idx) => {
              const updated = [...(newRuleExceptions.ignore_users || [])]
              updated.splice(idx, 1)
              setNewRuleExceptions({ ...newRuleExceptions, ignore_users: updated })
            }} />
          </div>
          {/* Ignore Paths */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignorePaths')}</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Input value={newExceptionPath} onChange={setNewExceptionPath} placeholder="/tmp/" />
              <Button variant="secondary" size="sm" onClick={() => {
                if (newExceptionPath.trim()) {
                  setNewRuleExceptions({ ...newRuleExceptions, ignore_paths: [...(newRuleExceptions.ignore_paths || []), newExceptionPath.trim()] })
                  setNewExceptionPath('')
                }
              }}>{t('common.add') || '+'}</Button>
            </div>
            <ExceptionList items={newRuleExceptions.ignore_paths || []} onRemove={(idx) => {
              const updated = [...(newRuleExceptions.ignore_paths || [])]
              updated.splice(idx, 1)
              setNewRuleExceptions({ ...newRuleExceptions, ignore_paths: updated })
            }} />
          </div>
          {/* Ignore Hours */}
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignoreHours')}</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <Input value={newExceptionHourStart} onChange={setNewExceptionHourStart} placeholder="03:00" />
              <Input value={newExceptionHourEnd} onChange={setNewExceptionHourEnd} placeholder="04:00" />
              <Button variant="secondary" size="sm" onClick={() => {
                if (newExceptionHourStart.trim() && newExceptionHourEnd.trim()) {
                  setNewRuleExceptions({ ...newRuleExceptions, ignore_hours: [...(newRuleExceptions.ignore_hours || []), { start: newExceptionHourStart.trim(), end: newExceptionHourEnd.trim() }] })
                  setNewExceptionHourStart('')
                  setNewExceptionHourEnd('')
                }
              }}>{t('common.add') || '+'}</Button>
            </div>
            <HourList items={newRuleExceptions.ignore_hours || []} onRemove={(idx) => {
              const updated = [...(newRuleExceptions.ignore_hours || [])]
              updated.splice(idx, 1)
              setNewRuleExceptions({ ...newRuleExceptions, ignore_hours: updated })
            }} />
          </div>
        </div>
      </Modal>

      {/* Edit rule modal */}
      {editRule && (
        <Modal
          open={!!editRule}
          onClose={() => setEditRule(null)}
          title={editRule.is_template ? `${t('correlation.preconfigured')} — ${editName}` : t('common.edit')}
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setEditRule(null)}>{t('common.cancel')}</Button>
              <Button
                variant="primary"
                disabled={!editName.trim() || updateRuleMutation.isPending}
                onClick={handleUpdateRule}
              >
                {updateRuleMutation.isPending ? t('common.loading') : t('common.save')}
              </Button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* General */}
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px' }}>
              {t('correlation.general') || 'General'}
            </div>
            <Input value={editName} onChange={setEditName} required />
            <Input value={editDescription} onChange={setEditDescription} />

            {/* Detection */}
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginTop: '8px' }}>
              {t('correlation.detection') || 'Detection'}
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.eventType')}</label>
              <select value={editEventType} onChange={(e) => setEditEventType(e.target.value)} style={{ width: '100%', padding: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }}>
                <option value="">{t('common.all')}</option>
                <option value="journald">Log systeme (journald)</option>
                <option value="network">Reseau (network)</option>
                <option value="ebpf">Noyau (ebpf)</option>
                <option value="fim">Fichier (fim)</option>
              </select>
            </div>
            <Input value={editMessageContains} onChange={setEditMessageContains} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input value={editCount} onChange={setEditCount} type="number" />
              <Input value={editWindow} onChange={setEditWindow} type="number" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('common.severity')}</label>
              <select value={editSeverity} onChange={(e) => setEditSeverity(e.target.value)} style={{ width: '100%', padding: '8px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: '6px', color: 'var(--color-text-primary)', fontSize: '14px' }}>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>

            {/* Exceptions */}
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', borderBottom: '1px solid var(--color-border)', paddingBottom: '4px', marginTop: '8px' }}>
              {t('correlation.exceptions')}
            </div>
            {/* Ignore IPs */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignoreIps')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input value={editExceptionIp} onChange={setEditExceptionIp} placeholder="192.168.1.1" />
                <Button variant="secondary" size="sm" onClick={() => {
                  if (editExceptionIp.trim()) {
                    setEditExceptions({ ...editExceptions, ignore_ips: [...(editExceptions.ignore_ips || []), editExceptionIp.trim()] })
                    setEditExceptionIp('')
                  }
                }}>{t('common.add') || '+'}</Button>
              </div>
              <ExceptionList items={editExceptions.ignore_ips || []} onRemove={(idx) => {
                const updated = [...(editExceptions.ignore_ips || [])]
                updated.splice(idx, 1)
                setEditExceptions({ ...editExceptions, ignore_ips: updated })
              }} />
            </div>
            {/* Ignore Users */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignoreUsers')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input value={editExceptionUser} onChange={setEditExceptionUser} placeholder="monitoring" />
                <Button variant="secondary" size="sm" onClick={() => {
                  if (editExceptionUser.trim()) {
                    setEditExceptions({ ...editExceptions, ignore_users: [...(editExceptions.ignore_users || []), editExceptionUser.trim()] })
                    setEditExceptionUser('')
                  }
                }}>{t('common.add') || '+'}</Button>
              </div>
              <ExceptionList items={editExceptions.ignore_users || []} onRemove={(idx) => {
                const updated = [...(editExceptions.ignore_users || [])]
                updated.splice(idx, 1)
                setEditExceptions({ ...editExceptions, ignore_users: updated })
              }} />
            </div>
            {/* Ignore Paths */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignorePaths')}</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input value={editExceptionPath} onChange={setEditExceptionPath} placeholder="/tmp/" />
                <Button variant="secondary" size="sm" onClick={() => {
                  if (editExceptionPath.trim()) {
                    setEditExceptions({ ...editExceptions, ignore_paths: [...(editExceptions.ignore_paths || []), editExceptionPath.trim()] })
                    setEditExceptionPath('')
                  }
                }}>{t('common.add') || '+'}</Button>
              </div>
              <ExceptionList items={editExceptions.ignore_paths || []} onRemove={(idx) => {
                const updated = [...(editExceptions.ignore_paths || [])]
                updated.splice(idx, 1)
                setEditExceptions({ ...editExceptions, ignore_paths: updated })
              }} />
            </div>
            {/* Ignore Hours */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>{t('correlation.ignoreHours')}</label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                <Input value={editExceptionHourStart} onChange={setEditExceptionHourStart} placeholder="03:00" />
                <Input value={editExceptionHourEnd} onChange={setEditExceptionHourEnd} placeholder="04:00" />
                <Button variant="secondary" size="sm" onClick={() => {
                  if (editExceptionHourStart.trim() && editExceptionHourEnd.trim()) {
                    setEditExceptions({ ...editExceptions, ignore_hours: [...(editExceptions.ignore_hours || []), { start: editExceptionHourStart.trim(), end: editExceptionHourEnd.trim() }] })
                    setEditExceptionHourStart('')
                    setEditExceptionHourEnd('')
                  }
                }}>{t('common.add') || '+'}</Button>
              </div>
              <HourList items={editExceptions.ignore_hours || []} onRemove={(idx) => {
                const updated = [...(editExceptions.ignore_hours || [])]
                updated.splice(idx, 1)
                setEditExceptions({ ...editExceptions, ignore_hours: updated })
              }} />
            </div>
          </div>
        </Modal>
      )}

      {/* Delete rule confirm */}
      <ConfirmDialog
        open={deleteRuleId !== null}
        title={t('correlation.deleteRule') || 'Delete rule'}
        message={t('correlation.deleteRuleConfirm') || 'Are you sure you want to delete this rule?'}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={handleDeleteRule}
        onCancel={() => setDeleteRuleId(null)}
      />
    </div>
  )
}