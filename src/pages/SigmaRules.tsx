import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { sigmaApi } from '../api'
import { Card, Badge, Button, SearchBar, Select, Modal, StatCard, Table } from '../components/ui'
import { FileText, Play, Upload, Check, Loader2, XCircle } from 'lucide-react'

interface SigmaRule {
  id: string
  uuid: string
  title: string
  description: string
  severity: string
  category: string
  status: string
  content?: string
  tags?: string[]
  mitre_tags?: string[]
  created_at?: string
  updated_at?: string
}

interface SigmaListResponse {
  items: SigmaRule[]
  total: number
  page: number
  page_size: number
  pages: number
}

interface SigmaStats {
  total: number
  active: number
  by_category: Record<string, number>
  by_severity: Record<string, number>
}

interface SigmaImportJobStatus {
  job_id: string
  status: 'running' | 'completed' | 'failed'
  step: number
  step_name: string
  progress: number
  stats: {
    files_scanned: number
    rules_imported: number
    rules_skipped_duplicate: number
    rules_skipped_invalid: number
  }
  error: string | null
  started_at: string | null
  completed_at: string | null
  result: Record<string, unknown> | null
}

const SIGMA_IMPORT_STEPS = [
  { key: 'clone', labelKey: 'sigma.stepClone' },
  { key: 'scan', labelKey: 'sigma.stepScan' },
  { key: 'parse', labelKey: 'sigma.stepParse' },
  { key: 'dedup', labelKey: 'sigma.stepDedup' },
  { key: 'insert', labelKey: 'sigma.stepInsert' },
] as const

function SigmaImportProgressModal({ open, onClose, jobId }: { open: boolean; onClose: () => void; jobId: string | null }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<SigmaImportJobStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await sigmaApi.getImportStatus(jobId)
      setStatus(res.data)
      if (res.data.status === 'completed' || res.data.status === 'failed') {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
        }
      }
    } catch {
      // ignore polling errors
    }
  }, [jobId])

  useEffect(() => {
    if (!open || !jobId) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    poll()
    intervalRef.current = setInterval(poll, 2000)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [open, jobId, poll])

  // Reset status when modal opens with new job
  useEffect(() => {
    if (open && jobId) {
      setStatus(null)
    }
  }, [jobId, open])

  const isDone = status?.status === 'completed' || status?.status === 'failed'
  const currentStep = status?.step ?? 0

  const getStepState = (stepIndex: number): 'pending' | 'running' | 'completed' => {
    if (!status) return 'pending'
    if (currentStep > stepIndex + 1) return 'completed'
    if (currentStep === stepIndex + 1) {
      if (isDone) return status.status === 'completed' ? 'completed' : 'completed'
      return 'running'
    }
    if (isDone && status.status === 'completed') return 'completed'
    return 'pending'
  }

  const stats = status?.stats ?? {
    files_scanned: 0,
    rules_imported: 0,
    rules_skipped_duplicate: 0,
    rules_skipped_invalid: 0,
  }

  // Calculate overall progress
  const overallProgress = (() => {
    if (!status) return 0
    if (isDone) return 100
    if (currentStep === 0) return 0
    const stepBase = ((currentStep - 1) / 5) * 100
    const stepFraction = (status.progress / 100) * (100 / 5)
    return Math.min(100, Math.round(stepBase + stepFraction))
  })()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('sigma.importProgress')}
      size="lg"
      footer={
        isDone ? (
          <Button variant="secondary" onClick={onClose}>
            {t('sigma.close')}
          </Button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Overall progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {status?.status === 'failed' ? t('sigma.importFailed') :
               isDone ? t('sigma.importCompleted') :
               t('sigma.importRunning')}
            </span>
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {overallProgress}%
            </span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: 'var(--color-bg-tertiary, #e2e8f0)',
            borderRadius: '4px',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${overallProgress}%`,
              height: '100%',
              background: status?.status === 'failed'
                ? 'var(--color-danger, #ef4444)'
                : isDone
                  ? 'var(--color-success, #22c55e)'
                  : 'var(--color-accent, #3b82f6)',
              borderRadius: '4px',
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* 5 steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {SIGMA_IMPORT_STEPS.map((step, idx) => {
            const state = getStepState(idx)
            return (
              <div key={step.key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: state === 'running'
                  ? 'var(--color-bg-tertiary, rgba(59, 130, 246, 0.08))'
                  : 'transparent',
              }}>
                {/* Icon */}
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: state === 'completed'
                    ? 'var(--color-success, #22c55e)'
                    : state === 'running'
                      ? 'var(--color-accent, #3b82f6)'
                      : 'var(--color-bg-tertiary, #e2e8f0)',
                  color: state === 'pending' ? 'var(--color-text-secondary)' : '#fff',
                  fontSize: '14px',
                }}>
                  {state === 'completed' ? <Check size={14} /> :
                   state === 'running' ? <Loader2 size={14} className="animate-spin" /> :
                   idx + 1}
                </div>

                {/* Label */}
                <span style={{
                  flex: 1,
                  fontSize: '14px',
                  fontWeight: state === 'running' ? 600 : 400,
                  color: state === 'pending'
                    ? 'var(--color-text-secondary)'
                    : 'var(--color-text-primary)',
                }}>
                  {t(step.labelKey)}
                </span>

                {/* Progress within step */}
                {state === 'running' && (
                  <span style={{ fontSize: '13px', color: 'var(--color-accent)' }}>
                    {Math.round(status?.progress ?? 0)}%
                  </span>
                )}
                {state === 'completed' && (
                  <Check size={16} style={{ color: 'var(--color-success, #22c55e)' }} />
                )}
              </div>
            )
          })}
        </div>

        {/* Error display */}
        {status?.status === 'failed' && status.error && (
          <div style={{
            padding: '12px',
            background: 'var(--color-danger, rgba(239, 68, 68, 0.1))',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--color-danger, #ef4444)',
          }}>
            <XCircle size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
            {status.error}
          </div>
        )}

        {/* Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: '12px',
        }}>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
              {stats.files_scanned}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('sigma.filesScanned')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success, #22c55e)' }}>
              {stats.rules_imported}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('sigma.rulesImported')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-warning, #f59e0b)' }}>
              {stats.rules_skipped_duplicate}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('sigma.rulesSkippedDuplicate')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
              {stats.rules_skipped_invalid}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('sigma.rulesSkippedInvalid')}</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function severityToVariant(sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'error': return 'danger'
    case 'warning': return 'warning'
    case 'medium': return 'warning'
    case 'notice': return 'info'
    case 'info': return 'info'
    case 'low': return 'info'
    default: return 'default'
  }
}

function statusToVariant(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'stable': return 'success'
    case 'test': return 'warning'
    case 'experimental': return 'info'
    case 'deprecated': return 'danger'
    default: return 'default'
  }
}

/** Map a Sigma severity value to its i18n translation key */
function translateSeverity(severity: string, t: (key: string) => string): string {
  const key = `dashboard.severity.${severity}`
  const translated = t(key)
  // If t() returns the key itself (missing), fall back to the raw value
  return translated === key ? severity : translated
}

/** Map a Sigma status value to its i18n translation key */
function translateStatus(status: string, t: (key: string) => string): string {
  const statusKeyMap: Record<string, string> = {
    stable: 'sigma.statusStable',
    test: 'sigma.statusTest',
    experimental: 'sigma.statusExperimental',
    deprecated: 'sigma.statusDeprecated',
  }
  const key = statusKeyMap[status]
  if (!key) return status
  const translated = t(key)
  return translated === key ? status : translated
}

/** Parse a string that may be a JSON array (e.g. '["T1059.004","T1110"]') or a plain string */
function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed as string[]
    } catch {
      // Not JSON, treat as comma-separated
      return value.split(',').map((s) => s.trim()).filter(Boolean)
    }
  }
  return []
}

export function SigmaRulesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedRule, setSelectedRule] = useState<SigmaRule | null>(null)
  const [showImportCommunity, setShowImportCommunity] = useState(false)
  const [communityCategories, setCommunityCategories] = useState<string[]>([])
  const [importJobId, setImportJobId] = useState<string | null>(null)

  const pageSize = 20

  const queryParams: Record<string, string> = {
    page: String(page),
    page_size: String(pageSize),
  }
  if (search) queryParams.search = search
  if (categoryFilter) queryParams.category = categoryFilter
  if (severityFilter) queryParams.severity = severityFilter
  if (statusFilter) queryParams.status = statusFilter

  const { data: rulesData, isLoading } = useQuery<SigmaListResponse>({
    queryKey: ['sigma-rules', queryParams],
    queryFn: () => sigmaApi.list(queryParams).then((r) => {
      const rawData = r.data
      // Backend may return a flat array or a paginated response
      if (Array.isArray(rawData)) {
        return {
          items: (rawData as Record<string, unknown>[]).map((rule) => ({
            ...rule,
            category: (rule as Record<string, unknown>).logsource_category ?? (rule as Record<string, unknown>).category ?? '',
            severity: (rule as Record<string, unknown>).severity ?? (rule as Record<string, unknown>).level ?? '',
            mitre_tags: parseStringArray((rule as Record<string, unknown>).mitre_techniques ?? (rule as Record<string, unknown>).tags ?? (rule as Record<string, unknown>).mitre_tags),
          })) as SigmaRule[],
          total: (rawData as Record<string, unknown>[]).length,
          page: 1,
          page_size: (rawData as Record<string, unknown>[]).length,
          pages: 1,
        } as SigmaListResponse
      }
      // If it's a paginated response with items
      const dataObj = rawData as Record<string, unknown>
      const items = (Array.isArray(dataObj.items) ? dataObj.items : Array.isArray(dataObj.rules) ? dataObj.rules : []) as Record<string, unknown>[]
      return {
        ...dataObj,
        items: items.map((rule) => ({
          ...rule,
          category: rule.logsource_category ?? rule.category ?? '',
          severity: rule.severity ?? rule.level ?? '',
          mitre_tags: parseStringArray(rule.mitre_techniques ?? rule.tags ?? rule.mitre_tags),
        })) as SigmaRule[],
      } as SigmaListResponse
    }),
  })

  const { data: stats } = useQuery<SigmaStats>({
    queryKey: ['sigma-stats'],
    queryFn: () => sigmaApi.stats().then((r) => r.data),
  })

  const importMutation = useMutation({
    mutationFn: (categories: string[]) => sigmaApi.importSigma({
      source: 'https://github.com/SigmaHQ/sigma.git',
      ref: 'master',
      workdir: '/tmp/sigma-import',
      categories: categories,
    }),
    onSuccess: (res) => {
      const data = res.data as { job_id?: string }
      if (data.job_id) {
        setImportJobId(data.job_id)
      }
      setShowImportCommunity(false)
    },
  })

  const evaluateMutation = useMutation({
    mutationFn: (uuid: string) => sigmaApi.evaluate(uuid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sigma-rules'] })
    },
  })

  const rules = rulesData?.items ?? []
  const totalPages = rulesData?.pages ?? 1
  const totalRules = stats?.total ?? rulesData?.total ?? 0
  const activeRules = stats?.active ?? 0

  const columns = [
    { key: 'title', label: t('sigma.colTitle') },
    { key: 'severity', label: t('common.severity') },
    { key: 'category', label: t('sigma.colCategory') },
    { key: 'status', label: t('sigma.colStatus') },
    { key: 'mitre_tags', label: t('sigma.colMitreTags') },
    { key: 'actions', label: t('common.actions') },
  ]

  const categoryOptions = [
    { label: t('common.all'), value: '' },
    { label: 'Process Creation', value: 'process_creation' },
    { label: 'Network Connection', value: 'network_connection' },
    { label: 'File Creation', value: 'file_creation' },
    { label: 'Registry', value: 'registry' },
    { label: 'Authentication', value: 'authentication' },
  ]

  const severityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('dashboard.severity.critical'), value: 'critical' },
    { label: t('dashboard.severity.high'), value: 'high' },
    { label: t('dashboard.severity.medium'), value: 'medium' },
    { label: t('dashboard.severity.warning'), value: 'warning' },
    { label: t('dashboard.severity.info'), value: 'info' },
    { label: t('dashboard.severity.low'), value: 'low' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('sigma.statusStable'), value: 'stable' },
    { label: t('sigma.statusTest'), value: 'test' },
    { label: t('sigma.statusExperimental'), value: 'experimental' },
    { label: t('sigma.statusDeprecated'), value: 'deprecated' },
  ]

  const communityCategoryOptions = [
    { key: 'linux', label: 'Linux' },
    { key: 'windows', label: 'Windows' },
    { key: 'network', label: 'Network' },
    { key: 'web', label: 'Web' },
    { key: 'proxy', label: 'Proxy' },
  ]

  const toggleCommunityCategory = useCallback((key: string) => {
    setCommunityCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }, [])

  const handleImportProgressClose = useCallback(() => {
    setImportJobId(null)
    qc.invalidateQueries({ queryKey: ['sigma-rules'] })
    qc.invalidateQueries({ queryKey: ['sigma-stats'] })
  }, [qc])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('sigma.title')}
        </h1>
        <Button
          variant="primary"
          size="sm"
          icon={<Upload size={14} />}
          onClick={() => setShowImportCommunity(true)}
        >
          {t('sigma.importCommunity')}
        </Button>
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('sigma.totalRules')}
          value={totalRules}
          icon={<FileText size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('common.active')}
          value={activeRules}
          icon={<FileText size={20} style={{ color: 'var(--color-success)' }} />}
          loading={isLoading}
        />
      </div>

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <SearchBar value={search} onChange={setSearch} placeholder={t('sigma.searchRules')} />
          </div>
          <div style={{ minWidth: '150px' }}>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              placeholder={t('sigma.colCategory')}
            />
          </div>
          <div style={{ minWidth: '150px' }}>
            <Select
              value={severityFilter}
              onChange={setSeverityFilter}
              options={severityOptions}
              placeholder={t('common.severity')}
            />
          </div>
          <div style={{ minWidth: '150px' }}>
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={statusOptions}
              placeholder={t('sigma.colStatus')}
            />
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          data={rules as unknown as Record<string, unknown>[]}
          loading={isLoading}
          emptyMessage={t('sigma.noRules')}
          renderCell={(col, row) => {
            const rule = row as unknown as SigmaRule
            if (col.key === 'severity') {
              return <Badge variant={severityToVariant(rule.severity)}>{translateSeverity(rule.severity, t)}</Badge>
            }
            if (col.key === 'status') {
              return <Badge variant={statusToVariant(rule.status)}>{translateStatus(rule.status, t)}</Badge>
            }
            if (col.key === 'mitre_tags') {
              const tags = rule.mitre_tags ?? rule.tags ?? []
              if (!tags.length) return '—'
              return (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="info" size="sm">{tag}</Badge>
                  ))}
                  {tags.length > 3 && (
                    <Badge variant="default" size="sm">+{tags.length - 3}</Badge>
                  )}
                </div>
              )
            }
            if (col.key === 'actions') {
              return (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Play size={12} />}
                  onClick={() => evaluateMutation.mutate(rule.uuid)}
                  disabled={evaluateMutation.isPending}
                >
                  {t('sigma.evaluate')}
                </Button>
              )
            }
            if (col.key === 'title') {
              return (
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                  onClick={() => setSelectedRule(rule)}
                >
                  {rule.title}
                </span>
              )
            }
            return String(rule[col.key as keyof SigmaRule] ?? '')
          }}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginTop: '16px' }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              {t('common.previous')}
            </Button>
            <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              {page} / {totalPages}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              {t('common.next')}
            </Button>
          </div>
        )}
      </Card>

      {/* Rule Detail Modal */}
      {selectedRule && (
        <Modal
          open={!!selectedRule}
          onClose={() => setSelectedRule(null)}
          title={selectedRule.title}
          size="lg"
          footer={
            <>
              <Button
                variant="secondary"
                icon={<Play size={14} />}
                onClick={() => evaluateMutation.mutate(selectedRule.uuid)}
                disabled={evaluateMutation.isPending}
              >
                {t('sigma.evaluate')}
              </Button>
              <Button variant="secondary" onClick={() => setSelectedRule(null)}>
                {t('common.close')}
              </Button>
            </>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Badge variant={severityToVariant(selectedRule.severity)}>{translateSeverity(selectedRule.severity, t)}</Badge>
              <Badge variant={statusToVariant(selectedRule.status)}>{translateStatus(selectedRule.status, t)}</Badge>
              {selectedRule.category && <Badge variant="default">{selectedRule.category}</Badge>}
            </div>
            {selectedRule.description && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('common.description')}:
                </span>
                <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', margin: '4px 0 0' }}>
                  {selectedRule.description}
                </p>
              </div>
            )}
            {selectedRule.content && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('sigma.yamlContent')}:
                </span>
                <pre style={{
                  background: 'var(--color-bg-primary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  padding: '12px',
                  fontSize: '13px',
                  color: 'var(--color-text-primary)',
                  overflow: 'auto',
                  maxHeight: '300px',
                  margin: '4px 0 0',
                }}>
                  {selectedRule.content}
                </pre>
              </div>
            )}
            {(selectedRule.mitre_tags ?? selectedRule.tags ?? []).length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('sigma.colMitreTags')}:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {(selectedRule.mitre_tags ?? selectedRule.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="info" size="sm">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Import Sigma Community Modal */}
      <Modal
        open={showImportCommunity}
        onClose={() => setShowImportCommunity(false)}
        title={t('sigma.importCommunity')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImportCommunity(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => importMutation.mutate(communityCategories)}
              disabled={importMutation.isPending || communityCategories.length === 0}
            >
              {importMutation.isPending ? t('common.loading') : t('common.import')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('sigma.importCommunityDescription')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {communityCategoryOptions.map((opt) => (
              <label
                key={opt.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: `1px solid ${communityCategories.includes(opt.key) ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  background: communityCategories.includes(opt.key)
                    ? 'color-mix(in srgb, var(--color-accent) 10%, transparent)'
                    : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={communityCategories.includes(opt.key)}
                  onChange={() => toggleCommunityCategory(opt.key)}
                  style={{ accentColor: 'var(--color-accent)' }}
                />
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </Modal>

      {/* Import Progress Modal */}
      <SigmaImportProgressModal
        open={!!importJobId}
        onClose={handleImportProgressClose}
        jobId={importJobId}
      />
    </div>
  )
}