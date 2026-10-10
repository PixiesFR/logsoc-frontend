import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { yaraApi } from '../api'
import { Card, Badge, Button, SearchBar, Select, Modal, StatCard, Table } from '../components/ui'
import { Shield, ShieldOff, Upload, RefreshCw, Check, Loader2, XCircle } from 'lucide-react'

interface YaraRule {
  id: string
  name: string
  description: string
  severity: string
  category: string
  is_active: boolean
  match_count: number
  content?: string
  tags?: string[]
  created_at?: string
  updated_at?: string
}

interface YaraListResponse {
  items: YaraRule[]
  total: number
  page: number
  page_size: number
  pages: number
}

interface ImportJobStatus {
  job_id: string
  status: 'running' | 'completed' | 'failed'
  step: number
  step_name: string
  progress: number
  stats: {
    files_scanned: number
    rules_parsed: number
    rules_imported: number
    rules_skipped_duplicate: number
    rules_skipped_invalid: number
    rules_skipped_yara5: number
  }
  error: string | null
  started_at: string | null
  completed_at: string | null
  result: {
    source: string
    git_url: string
    files_scanned: number
    rules_parsed: number
    rules_imported: number
    rules_skipped_duplicate: number
    rules_skipped_invalid: number
    rules_skipped_yara5: number
    errors: string[]
    duration_seconds: number
  } | null
}

const STEPS = [
  { key: 'clone', labelKey: 'yara.stepClone' },
  { key: 'scan', labelKey: 'yara.stepScan' },
  { key: 'parse', labelKey: 'yara.stepParse' },
  { key: 'dedup', labelKey: 'yara.stepDedup' },
  { key: 'insert', labelKey: 'yara.stepInsert' },
] as const

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

function ImportProgressModal({ open, onClose, jobId }: { open: boolean; onClose: () => void; jobId: string | null }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<ImportJobStatus | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    if (!jobId) return
    try {
      const res = await yaraApi.getImportStatus(jobId)
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
    rules_parsed: 0,
    rules_imported: 0,
    rules_skipped_duplicate: 0,
    rules_skipped_invalid: 0,
    rules_skipped_yara5: 0,
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
      title={t('yara.importProgress')}
      size="lg"
      footer={
        isDone ? (
          <Button variant="secondary" onClick={onClose}>
            {t('yara.close')}
          </Button>
        ) : undefined
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Overall progress bar */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
              {status?.status === 'failed' ? t('yara.importFailed') :
               isDone ? t('yara.importCompleted') :
               t('yara.importRunning')}
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
          {STEPS.map((step, idx) => {
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
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('yara.filesScanned')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-success, #22c55e)' }}>
              {stats.rules_imported}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('yara.rulesImported')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-warning, #f59e0b)' }}>
              {stats.rules_skipped_duplicate}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('yara.rulesSkippedDuplicate')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-danger, #ef4444)' }}>
              {stats.rules_skipped_invalid}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('yara.rulesSkippedInvalid')}</div>
          </div>
          <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-text-secondary)' }}>
              {stats.rules_skipped_yara5}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('yara.rulesSkippedYara5')}</div>
          </div>
          {status?.result && (
            <div style={{ textAlign: 'center', padding: '8px', background: 'var(--color-bg-tertiary, rgba(0,0,0,0.04))', borderRadius: '8px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--color-accent)' }}>
                {status.result.duration_seconds}s
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('yara.duration')}</div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function YaraRulesPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [selectedRule, setSelectedRule] = useState<YaraRule | null>(null)
  const [showImportForge, setShowImportForge] = useState(false)
  const [forgePackage, setForgePackage] = useState('core')
  const [importJobId, setImportJobId] = useState<string | null>(null)
  const [showProgress, setShowProgress] = useState(false)

  const pageSize = 20

  const queryParams: Record<string, string> = {
    page: String(page),
    page_size: String(pageSize),
  }
  if (search) queryParams.search = search
  if (categoryFilter) queryParams.category = categoryFilter
  if (severityFilter) queryParams.severity = severityFilter
  if (activeFilter) queryParams.is_active = activeFilter

  const { data: rulesData, isLoading } = useQuery<YaraListResponse>({
    queryKey: ['yara-rules', queryParams],
    queryFn: () => yaraApi.list(queryParams).then((r) => r.data),
  })

  const { data: allRulesForStats } = useQuery<YaraListResponse>({
    queryKey: ['yara-rules', { page: '1', page_size: '1' }],
    queryFn: () => yaraApi.list({ page: '1', page_size: '1' }).then((r) => r.data),
  })

  const { data: activeStats } = useQuery<YaraListResponse>({
    queryKey: ['yara-rules-active', { is_active: 'true', page: '1', page_size: '1' }],
    queryFn: () => yaraApi.list({ is_active: 'true', page: '1', page_size: '1' }).then((r) => r.data),
  })

  const { data: inactiveStats } = useQuery<YaraListResponse>({
    queryKey: ['yara-rules-inactive', { is_active: 'false', page: '1', page_size: '1' }],
    queryFn: () => yaraApi.list({ is_active: 'false', page: '1', page_size: '1' }).then((r) => r.data),
  })

  const toggleMutation = useMutation({
    mutationFn: (ruleId: string) => yaraApi.toggle(ruleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yara-rules'] })
    },
  })

  const reloadMutation = useMutation({
    mutationFn: () => yaraApi.reload(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['yara-rules'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: (pkg: string) => yaraApi.importSigbase({ source: 'signature-base', scan_flags: 1, package: pkg }),
    onSuccess: (response) => {
      const data = response.data
      // Async mode returns {job_id, status}
      if (data?.job_id) {
        setImportJobId(data.job_id)
        setShowProgress(true)
        setShowImportForge(false)
      }
      qc.invalidateQueries({ queryKey: ['yara-rules'] })
    },
  })

  const handleRowClick = (rule: YaraRule) => {
    setSelectedRule(rule)
  }

  // API now returns {items, total, pages, page, page_size}
  const rules = rulesData?.items ?? []
  const totalPages = rulesData?.pages ?? 1
  const totalRules = allRulesForStats?.total ?? 0
  const totalActive = activeStats?.total ?? 0
  const totalInactive = inactiveStats?.total ?? 0

  const columns = [
    { key: 'name', label: t('yara.colName') },
    { key: 'severity', label: t('common.severity') },
    { key: 'category', label: t('yara.colCategory') },
    { key: 'is_active', label: t('yara.colActive') },
    { key: 'match_count', label: t('yara.colMatchCount') },
    { key: 'actions', label: t('common.actions') },
  ]

  const categoryOptions = [
    { label: t('common.all'), value: '' },
    { label: 'Malware', value: 'malware' },
    { label: 'CVE', value: 'cve' },
    { label: 'Exploit', value: 'exploit' },
    { label: 'Credential', value: 'credential' },
    { label: 'Lateral', value: 'lateral' },
  ]

  const severityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('dashboard.severity.critical'), value: 'critical' },
    { label: t('dashboard.severity.warning'), value: 'warning' },
    { label: t('dashboard.severity.info'), value: 'info' },
  ]

  const activeOptions = [
    { label: t('common.all'), value: '' },
    { label: t('common.active'), value: 'true' },
    { label: t('common.inactive'), value: 'false' },
  ]

  const handleProgressClose = useCallback(() => {
    setShowProgress(false)
    setImportJobId(null)
    qc.invalidateQueries({ queryKey: ['yara-rules'] })
  }, [qc])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('yara.title')}
        </h1>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw size={14} />}
            onClick={() => reloadMutation.mutate()}
            disabled={reloadMutation.isPending}
          >
            {t('yara.reload')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Upload size={14} />}
            onClick={() => setShowImportForge(true)}
          >
            {t('yara.importForge')}
          </Button>
        </div>
      </div>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <StatCard
          label={t('yara.totalRules')}
          value={totalRules}
          icon={<Shield size={20} style={{ color: 'var(--color-accent)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('common.active')}
          value={totalActive}
          icon={<Shield size={20} style={{ color: 'var(--color-success)' }} />}
          loading={isLoading}
        />
        <StatCard
          label={t('common.inactive')}
          value={totalInactive}
          icon={<ShieldOff size={20} style={{ color: 'var(--color-text-secondary)' }} />}
          loading={isLoading}
        />
      </div>

      {/* Filters */}
      <Card>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <SearchBar value={search} onChange={setSearch} placeholder={t('yara.searchRules')} />
          </div>
          <div style={{ minWidth: '150px' }}>
            <Select
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={categoryOptions}
              placeholder={t('yara.colCategory')}
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
          <div style={{ minWidth: '130px' }}>
            <Select
              value={activeFilter}
              onChange={setActiveFilter}
              options={activeOptions}
              placeholder={t('yara.colActive')}
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
          emptyMessage={t('yara.noRules')}
          renderCell={(col, row) => {
            const rule = row as unknown as YaraRule
            if (col.key === 'severity') {
              return <Badge variant={severityToVariant(rule.severity)}>{rule.severity}</Badge>
            }
            if (col.key === 'is_active') {
              return <Badge variant={rule.is_active ? 'success' : 'default'}>{rule.is_active ? t('common.active') : t('common.inactive')}</Badge>
            }
            if (col.key === 'match_count') {
              return String(rule.match_count ?? 0)
            }
            if (col.key === 'actions') {
              return (
                <Button
                  variant={rule.is_active ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => toggleMutation.mutate(rule.id)}
                >
                  {rule.is_active ? t('yara.deactivate') : t('yara.activate')}
                </Button>
              )
            }
            if (col.key === 'name') {
              return (
                <span
                  style={{ cursor: 'pointer', color: 'var(--color-accent)' }}
                  onClick={() => handleRowClick(rule)}
                >
                  {rule.name}
                </span>
              )
            }
            return String(rule[col.key as keyof YaraRule] ?? '')
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
          title={selectedRule.name}
          size="lg"
          footer={
            <Button variant="secondary" onClick={() => setSelectedRule(null)}>
              {t('common.close')}
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <Badge variant={severityToVariant(selectedRule.severity)}>{selectedRule.severity}</Badge>
              <Badge variant={selectedRule.is_active ? 'success' : 'default'}>
                {selectedRule.is_active ? t('common.active') : t('common.inactive')}
              </Badge>
            </div>
            {selectedRule.category && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('yara.colCategory')}:
                </span>
                <span style={{ marginLeft: '8px', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {selectedRule.category}
                </span>
              </div>
            )}
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
                  {t('yara.ruleContent')}:
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
            {selectedRule.tags && selectedRule.tags.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('yara.mitreTags')}:
                </span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                  {selectedRule.tags.map((tag) => (
                    <Badge key={tag} variant="info" size="sm">{tag}</Badge>
                  ))}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>
                  {t('yara.colMatchCount')}:
                </span>
                <span style={{ marginLeft: '6px', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                  {selectedRule.match_count ?? 0}
                </span>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Import YARA Forge Modal (triggers async import) */}
      <Modal
        open={showImportForge}
        onClose={() => setShowImportForge(false)}
        title={t('yara.importForge')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowImportForge(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => importMutation.mutate(forgePackage)}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? t('common.loading') : t('common.import')}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
            {t('yara.importForgeDescription')}
          </p>
          <Select
            label={t('yara.forgePackage')}
            value={forgePackage}
            onChange={setForgePackage}
            options={[
              { label: 'Core', value: 'core' },
              { label: 'Extended', value: 'extended' },
              { label: 'Full', value: 'full' },
            ]}
          />
        </div>
      </Modal>

      {/* Import Progress Modal */}
      <ImportProgressModal
        open={showProgress}
        onClose={handleProgressClose}
        jobId={importJobId}
      />
    </div>
  )
}