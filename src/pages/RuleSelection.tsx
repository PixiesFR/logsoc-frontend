import { useState, useCallback, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { yaraApi } from '../api'
import { Card, Badge, Button, SearchBar, Select, EmptyState, StatCard } from '../components/ui'
import { Shield, ShieldOff, Sparkles, Loader2, Check, X, Zap, ChevronRight } from 'lucide-react'

interface YaraRuleItem {
  id: number
  rule_id: string
  name: string
  description: string | null
  severity: string
  is_active: boolean
  match_count: number
  last_match_at: string | null
  tags: string | null
  framework: string | null
  control_id: string | null
  scan_flags: number
}

interface AiSuggestionItem {
  rule_id: string
  action: 'activate' | 'deactivate'
  reason: string
  score: number
}

interface AiSuggestResponse {
  suggestions: AiSuggestionItem[]
  model: string
  fallback: boolean
  error: string | null
}

function severityToVariant(sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'medium': return 'warning'
    case 'low': return 'info'
    default: return 'default'
  }
}

export function RuleSelectionPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  // Filters
  const [search, setSearch] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [frameworkFilter, setFrameworkFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // AI suggestions
  const [aiPanelOpen, setAiPanelOpen] = useState(false)
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())

  // Fetch all rules (up to 200)
  const queryParams: Record<string, string> = { limit: '200' }
  if (severityFilter) queryParams.severity = severityFilter
  if (frameworkFilter) queryParams.framework = frameworkFilter
  if (statusFilter) queryParams.is_active = statusFilter

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['yara-rules-selection', queryParams],
    queryFn: async () => {
      const resp = await yaraApi.list(queryParams)
      return resp.data as YaraRuleItem[]
    },
  })

  const allRules = rulesData ?? []

  const rules = useMemo(() => {
    if (!search) return allRules
    const q = search.toLowerCase()
    return allRules.filter((r: YaraRuleItem) => r.name.toLowerCase().includes(q) || r.rule_id.toLowerCase().includes(q))
  }, [allRules, search])

  // Stats
  const totalActive = allRules.filter((r: YaraRuleItem) => r.is_active).length
  const totalInactive = allRules.filter((r: YaraRuleItem) => !r.is_active).length

  // AI Suggest mutation
  const aiSuggestMutation = useMutation({
    mutationFn: () => yaraApi.aiSuggest().then((r) => r.data as AiSuggestResponse),
    onSuccess: () => {
      setAiPanelOpen(true)
    },
  })

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: (ruleId: string) => yaraApi.toggle(ruleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yara-rules-selection'] })
    },
  })

  // Batch toggle
  const handleBatchAction = useCallback(async () => {
    if (selectedIds.size === 0) return
    for (const ruleId of selectedIds) {
      await toggleMutation.mutateAsync(ruleId)
    }
    setSelectedIds(new Set())
  }, [selectedIds, toggleMutation])

  // Apply AI suggestion
  const handleApplySuggestion = useCallback(async (s: AiSuggestionItem) => {
    const rule = allRules.find((r: YaraRuleItem) => r.rule_id === s.rule_id)
    if (!rule) return
    if ((s.action === 'activate' && !rule.is_active) || (s.action === 'deactivate' && rule.is_active)) {
      await toggleMutation.mutateAsync(s.rule_id)
    }
    setAppliedIds((prev) => new Set(prev).add(s.rule_id))
  }, [allRules, toggleMutation])

  // Apply all AI suggestions
  const handleApplyAllSuggestions = useCallback(async () => {
    const suggestions = aiSuggestMutation.data?.suggestions ?? []
    for (const s of suggestions) {
      if (appliedIds.has(s.rule_id)) continue
      const rule = allRules.find((r: YaraRuleItem) => r.rule_id === s.rule_id)
      if (!rule) continue
      if ((s.action === 'activate' && !rule.is_active) || (s.action === 'deactivate' && rule.is_active)) {
        await toggleMutation.mutateAsync(s.rule_id)
      }
      setAppliedIds((prev) => new Set(prev).add(s.rule_id))
    }
  }, [aiSuggestMutation.data, appliedIds, allRules, toggleMutation])

  const toggleSelect = (ruleId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(ruleId)) next.delete(ruleId)
      else next.add(ruleId)
      return next
    })
  }

  const severityOptions = [
    { label: t('common.all'), value: '' },
    { label: 'Critical', value: 'critical' },
    { label: 'High', value: 'high' },
    { label: 'Medium', value: 'medium' },
    { label: 'Low', value: 'low' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('common.active'), value: 'true' },
    { label: t('common.inactive'), value: 'false' },
  ]

  const frameworkOptions = useMemo(() => {
    const fws = new Set<string>()
    allRules.forEach((r: YaraRuleItem) => { if (r.framework) fws.add(r.framework) })
    return [
      { label: t('common.all'), value: '' },
      ...Array.from(fws).sort().map((f) => ({ label: f, value: f })),
    ]
  }, [allRules, t])

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '48px' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
      </div>
    )
  }

  if (!isLoading && allRules.length === 0) {
    return (
      <EmptyState
        icon={<Shield size={48} />}
        title={t('ruleSelection.noRules')}
        description={t('ruleSelection.noRulesDesc')}
      />
    )
  }

  return (
    <div style={{ display: 'flex', gap: '20px', minHeight: '100%' }}>
      {/* Main panel */}
      <div style={{ flex: aiPanelOpen ? '1 1 60%' : '1 1 100%', display: 'flex', flexDirection: 'column', gap: '16px', transition: 'flex 0.2s' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
            {t('ruleSelection.title')}
          </h1>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={<Sparkles size={14} />}
              onClick={() => {
                if (!aiSuggestMutation.isPending) {
                  setAppliedIds(new Set())
                  aiSuggestMutation.mutate()
                  setAiPanelOpen(true)
                }
              }}
              disabled={aiSuggestMutation.isPending}
            >
              {aiSuggestMutation.isPending ? t('ruleSelection.loadingAi') : t('ruleSelection.aiSuggest')}
            </Button>
            {aiSuggestMutation.data && !aiPanelOpen && (
              <Button variant="secondary" size="sm" onClick={() => setAiPanelOpen(true)}>
                {t('ruleSelection.showSuggestions')}
              </Button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          <StatCard
            label={t('yara.totalRules')}
            value={allRules.length}
            icon={<Shield size={18} style={{ color: 'var(--color-accent)' }} />}
            loading={isLoading}
          />
          <StatCard
            label={t('common.active')}
            value={totalActive}
            icon={<Shield size={18} style={{ color: 'var(--color-success)' }} />}
            loading={isLoading}
          />
          <StatCard
            label={t('common.inactive')}
            value={totalInactive}
            icon={<ShieldOff size={18} style={{ color: 'var(--color-text-secondary)' }} />}
            loading={isLoading}
          />
        </div>

        {/* Batch actions bar */}
        {selectedIds.size > 0 && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--color-text-secondary)', fontSize: '14px' }}>
                {t('ruleSelection.selectedCount', { count: selectedIds.size })}
              </span>
              <Button
                variant="primary"
                size="sm"
                icon={<Zap size={14} />}
                onClick={handleBatchAction}
                disabled={toggleMutation.isPending}
              >
                {t('ruleSelection.batchActivate')}
              </Button>
              <Button
                variant="danger"
                size="sm"
                icon={<X size={14} />}
                onClick={handleBatchAction}
                disabled={toggleMutation.isPending}
              >
                {t('ruleSelection.batchDeactivate')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => setSelectedIds(new Set())}>
                {t('common.cancel')}
              </Button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <SearchBar value={search} onChange={setSearch} placeholder={t('ruleSelection.searchPlaceholder')} />
            </div>
            <div style={{ minWidth: '140px' }}>
              <Select value={severityFilter} onChange={setSeverityFilter} options={severityOptions} placeholder={t('common.severity')} />
            </div>
            <div style={{ minWidth: '140px' }}>
              <Select value={frameworkFilter} onChange={setFrameworkFilter} options={frameworkOptions} placeholder={t('ruleSelection.framework')} />
            </div>
            <div style={{ minWidth: '120px' }}>
              <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder={t('ruleSelection.status')} />
            </div>
          </div>
        </Card>

        {/* Rules table */}
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={rules.length > 0 && rules.every((r: YaraRuleItem) => selectedIds.has(r.rule_id))}
                      onChange={() => {
                        if (rules.every((r: YaraRuleItem) => selectedIds.has(r.rule_id))) {
                          setSelectedIds(new Set())
                        } else {
                          setSelectedIds(new Set(rules.map((r: YaraRuleItem) => r.rule_id)))
                        }
                      }}
                      style={{ accentColor: 'var(--color-accent)' }}
                    />
                  </th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('ruleSelection.colName')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('common.severity')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('ruleSelection.framework')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('ruleSelection.status')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>{t('ruleSelection.matchCount')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left' }}>{t('ruleSelection.lastDetection')}</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center' }}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((rule: YaraRuleItem) => (
                  <tr key={rule.rule_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rule.rule_id)}
                        onChange={() => toggleSelect(rule.rule_id)}
                        style={{ accentColor: 'var(--color-accent)' }}
                      />
                    </td>
                    <td style={{ padding: '8px 12px', fontWeight: 500, color: 'var(--color-text-primary)' }}>{rule.name}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <Badge variant={severityToVariant(rule.severity)}>{rule.severity}</Badge>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>{rule.framework || rule.tags || '—'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <Badge variant={rule.is_active ? 'success' : 'default'}>
                        {rule.is_active ? t('common.active') : t('common.inactive')}
                      </Badge>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>{rule.match_count ?? 0}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                      {rule.last_match_at ? new Date(rule.last_match_at).toLocaleDateString() : '—'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <Button
                        variant={rule.is_active ? 'danger' : 'primary'}
                        size="sm"
                        onClick={() => toggleMutation.mutate(rule.rule_id)}
                        disabled={toggleMutation.isPending}
                      >
                        {rule.is_active ? t('ruleSelection.deactivate') : t('ruleSelection.activate')}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rules.length === 0 && (
            <EmptyState
              icon={<Shield size={32} />}
              title={t('ruleSelection.noRules')}
              description={t('ruleSelection.noRulesDesc')}
            />
          )}
        </Card>
      </div>

      {/* AI Suggestions Panel */}
      {aiPanelOpen && (
        <div style={{
          flex: '0 0 380px',
          borderLeft: '1px solid var(--color-border)',
          paddingLeft: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={18} style={{ color: 'var(--color-accent)' }} />
              {t('ruleSelection.aiSuggestions')}
            </h2>
            <Button variant="secondary" size="sm" onClick={() => setAiPanelOpen(false)}>
              <X size={16} />
            </Button>
          </div>

          {aiSuggestMutation.isPending && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
                <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-accent)' }} />
                <span style={{ color: 'var(--color-text-secondary)' }}>{t('ruleSelection.analyzing')}</span>
              </div>
            </Card>
          )}

          {aiSuggestMutation.isError && (
            <Card>
              <div style={{ padding: '16px', color: 'var(--color-danger)' }}>
                {t('ruleSelection.aiError')}: {(aiSuggestMutation.error as Error)?.message || t('common.error')}
              </div>
            </Card>
          )}

          {aiSuggestMutation.data && (
            <>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {aiSuggestMutation.data.fallback
                  ? t('ruleSelection.fallbackMode', { model: aiSuggestMutation.data.model })
                  : t('ruleSelection.aiModel', { model: aiSuggestMutation.data.model })
                }
                {' · '}
                {t('ruleSelection.suggestionCount', { count: aiSuggestMutation.data.suggestions.length })}
              </div>

              {aiSuggestMutation.data.suggestions.length > 0 && (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Check size={14} />}
                  onClick={handleApplyAllSuggestions}
                  disabled={toggleMutation.isPending}
                  fullWidth
                >
                  {t('ruleSelection.applyAll')}
                </Button>
              )}

              {aiSuggestMutation.data.suggestions.length === 0 && (
                <Card>
                  <div style={{ padding: '16px', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
                    {t('ruleSelection.noSuggestions')}
                  </div>
                </Card>
              )}

              {aiSuggestMutation.data.suggestions.map((s: AiSuggestionItem) => {
                const rule = allRules.find((r: YaraRuleItem) => r.rule_id === s.rule_id)
                const alreadyApplied = appliedIds.has(s.rule_id)
                return (
                  <Card key={s.rule_id} style={{ padding: '0' }}>
                    <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Badge variant={s.action === 'activate' ? 'success' : 'danger'}>
                            {s.action === 'activate' ? t('ruleSelection.activate') : t('ruleSelection.deactivate')}
                          </Badge>
                          <span style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '14px' }}>
                            {rule?.name || s.rule_id}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '12px',
                          color: s.score >= 0.7 ? 'var(--color-success)' : s.score >= 0.4 ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                          fontWeight: 600,
                        }}>
                          {Math.round(s.score * 100)}%
                        </span>
                      </div>
                      {rule && (
                        <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          <Badge variant={severityToVariant(rule.severity)}>{rule.severity}</Badge>
                          {' · '}
                          {rule.framework || rule.tags || '—'}
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                        {s.reason}
                      </p>
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        {alreadyApplied ? (
                          <Badge variant="success">
                            <Check size={12} style={{ marginRight: '4px' }} />
                            {t('ruleSelection.applied')}
                          </Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            icon={<ChevronRight size={14} />}
                            onClick={() => handleApplySuggestion(s)}
                            disabled={toggleMutation.isPending}
                          >
                            {t('ruleSelection.applySuggestion')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })}
            </>
          )}

          {!aiSuggestMutation.isPending && !aiSuggestMutation.data && !aiSuggestMutation.isError && (
            <Card>
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>
                <Sparkles size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                <p style={{ margin: 0 }}>{t('ruleSelection.clickToAnalyze')}</p>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}