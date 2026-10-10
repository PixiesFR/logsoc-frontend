import { useState, useCallback, useMemo } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { useAlerts, useAlertSummary } from '../hooks/useData'
import { alertsApi } from '../api'
import { Card, Badge, StatCard, Modal, Select, Button, EmptyState, ConfirmDialog, useToast } from '../components/ui'
import { AlertTriangle, CheckCircle, ArrowUpCircle, XCircle, Sparkles, ChevronDown, ChevronRight } from 'lucide-react'
import { useAuthStore } from '../stores'
import { translateAlertTitle, translateAlertDescription, formatTimestamp } from '../utils/eventFormatter'
import type { AlertItem } from '../api/types'

interface AlertGroup {
  key: string
  title: string
  severity: string
  source_host: string
  status: string
  count: number
  first_seen: string
  last_seen: string
  alerts: AlertItem[]
}

const PAGE_SIZE = 12

const severityVariant = (sev: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (sev) {
    case 'critical': return 'danger'
    case 'high': return 'danger'
    case 'error': return 'danger'
    case 'warning': return 'warning'
    case 'medium': return 'warning'
    case 'notice': return 'info'
    case 'info': return 'info'
    case 'low': return 'default'
    default: return 'default'
  }
}

const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (status) {
    case 'new': return 'danger'
    case 'acknowledged': return 'info'
    case 'escalated': return 'warning'
    case 'closed': return 'success'
    default: return 'default'
  }
}

export function AlertsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const expertMode = useAuthStore((s) => s.expertMode)
  const [page, setPage] = useState(1)
  const [severityFilter, setSeverityFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sortBy, setSortBy] = useState<'date' | 'severity' | 'host'>('date')
  const [selectedAlert, setSelectedAlert] = useState<AlertItem | null>(null)
  const [closeConfirm, setCloseConfirm] = useState<number | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const params: Record<string, string | number> = { page, page_size: PAGE_SIZE }
  if (severityFilter) params.severity = severityFilter
  if (statusFilter) params.status = statusFilter

  const { data: alerts, isLoading, refetch } = useAlerts(params)
  const { data: summary } = useAlertSummary()

  const handleAcknowledge = useCallback(async (id: number) => {
    try {
      await alertsApi.acknowledge(id)
      toast('success', t('alerts.acknowledgeSuccess'))
      refetch()
    } catch {
      toast('error', t('alerts.acknowledgeError'))
    }
  }, [toast, t, refetch])

  const handleEscalate = useCallback(async (id: number) => {
    try {
      await alertsApi.escalate(id)
      toast('success', t('alerts.escalateSuccess'))
      refetch()
    } catch {
      toast('error', t('alerts.escalateError'))
    }
  }, [toast, t, refetch])

  const handleClose = useCallback(async (id: number) => {
    try {
      await alertsApi.close(id, { closure_reason: 'resolved' })
      toast('success', t('alerts.closeSuccess'))
      refetch()
      setSelectedAlert(null)
    } catch {
      toast('error', t('alerts.closeError'))
    }
  }, [toast, t, refetch])

  const handleAskAi = useCallback(async (alert: AlertItem) => {
    setAiLoading(true)
    setAiAnalysis(null)
    try {
      // Use the alert's existing llm_analysis if present, otherwise show a message
      if (alert.llm_analysis) {
        setAiAnalysis(alert.llm_analysis)
      } else {
        setAiAnalysis(t('alerts.aiNoAnalysis'))
      }
    } finally {
      setAiLoading(false)
    }
  }, [t])

  const toggleGroup = useCallback((key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // Group similar alerts (same title + source_host + severity)
  const alertGroups = useMemo<AlertGroup[]>(() => {
    if (!alerts) return []
    const groupMap = new Map<string, AlertGroup>()
    for (const alert of alerts) {
      const key = `${alert.title}__${alert.source_host}__${alert.severity}`
      const existing = groupMap.get(key)
      if (existing) {
        existing.count++
        existing.alerts.push(alert)
        if (alert.created_at < existing.first_seen) existing.first_seen = alert.created_at
        if (alert.created_at > existing.last_seen) existing.last_seen = alert.created_at
      } else {
        groupMap.set(key, {
          key,
          title: alert.title,
          severity: alert.severity,
          source_host: alert.source_host,
          status: alert.status,
          count: 1,
          first_seen: alert.created_at,
          last_seen: alert.created_at,
          alerts: [alert],
        })
      }
    }

    const groups = Array.from(groupMap.values())

    // Sort groups
    groups.sort((a, b) => {
      if (sortBy === 'severity') {
        const sevOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 }
        return (sevOrder[a.severity] ?? 99) - (sevOrder[b.severity] ?? 99)
      }
      if (sortBy === 'host') {
        return a.source_host.localeCompare(b.source_host)
      }
      // date: most recent first
      return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime()
    })

    return groups
  }, [alerts, sortBy])

  const sortOptions = [
    { label: t('alerts.sortByDate'), value: 'date' },
    { label: t('alerts.sortBySeverity'), value: 'severity' },
    { label: t('alerts.sortByHost'), value: 'host' },
  ]

  const severityOptions = [
    { label: t('common.all'), value: '' },
    { label: t('alerts.severityLabels.critical'), value: 'critical' },
    { label: t('alerts.severityLabels.high'), value: 'high' },
    { label: t('alerts.severityLabels.medium'), value: 'medium' },
    { label: t('alerts.severityLabels.low'), value: 'low' },
  ]

  const statusOptions = [
    { label: t('common.all'), value: '' },
    { label: t('alerts.new'), value: 'new' },
    { label: t('alerts.acknowledged'), value: 'acknowledged' },
    { label: t('alerts.escalated'), value: 'escalated' },
    { label: t('alerts.closed'), value: 'closed' },
  ]

  const summaryBySev = summary?.summary ?? []
  const criticalCount = summaryBySev.find((s) => s.severity === 'critical')?.count ?? 0
  const highCount = summaryBySev.find((s) => s.severity === 'high')?.count ?? 0
  const mediumCount = summaryBySev.find((s) => s.severity === 'medium')?.count ?? 0
  const lowCount = summaryBySev.find((s) => s.severity === 'low')?.count ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('alerts.title')}
      </h1>

      {/* StatCards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        <StatCard
          label={t('alerts.severityLabels.critical')}
          value={criticalCount}
          icon={<AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />}
          loading={false}
        />
        <StatCard
          label={t('alerts.severityLabels.high')}
          value={highCount}
          icon={<AlertTriangle size={20} style={{ color: 'var(--color-danger)' }} />}
          loading={false}
        />
        <StatCard
          label={t('alerts.severityLabels.medium')}
          value={mediumCount}
          icon={<AlertTriangle size={20} style={{ color: 'var(--color-warning)' }} />}
          loading={false}
        />
        <StatCard
          label={t('alerts.severityLabels.low')}
          value={lowCount}
          icon={<AlertTriangle size={20} style={{ color: 'var(--color-info)' }} />}
          loading={false}
        />
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ width: '160px' }}>
          <Select value={severityFilter} onChange={setSeverityFilter} options={severityOptions} placeholder={t('common.severity')} />
        </div>
        <div style={{ width: '160px' }}>
          <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} placeholder={t('common.status')} />
        </div>
        <div style={{ width: '160px' }}>
          <Select value={sortBy} onChange={(v) => setSortBy(v as 'date' | 'severity' | 'host')} options={sortOptions} placeholder={t('alerts.sortBy')} />
        </div>
      </div>

      {/* Alert cards (grouped) */}
      {isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton" style={{ height: '120px', borderRadius: '12px' }} />
          ))}
        </div>
      )}

      {!isLoading && (!alerts || alerts.length === 0) && (
        <EmptyState icon={<AlertTriangle size={32} />} title={t('alerts.noAlerts')} />
      )}

      {!isLoading && alerts && alerts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {alertGroups.map((group) => {
            const isExpanded = expandedGroups.has(group.key)
            const isGrouped = group.count > 1
            return (
              <div key={group.key}>
                {isGrouped && (
                  <Card style={{ marginBottom: isExpanded ? '4px' : '0' }}>
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                      onClick={() => toggleGroup(group.key)}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {isExpanded ? <ChevronDown size={16} style={{ color: 'var(--color-text-secondary)' }} /> : <ChevronRight size={16} style={{ color: 'var(--color-text-secondary)' }} />}
                        <Badge variant={severityVariant(group.severity)} size="sm">
                          {t(`alerts.severityLabels.${group.severity}`) ?? group.severity}
                        </Badge>
                        <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                          {translateAlertTitle(group.title, expertMode)}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Badge variant="default" size="sm">{t('alerts.similarCount', { count: group.count })}</Badge>
                        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                          {formatTimestamp(group.first_seen, expertMode)} → {formatTimestamp(group.last_seen, expertMode)}
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
                {(!isGrouped || isExpanded) && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {group.alerts.map((alert) => (
                      <Card key={alert.id} onClick={() => { setSelectedAlert(alert); setAiAnalysis(null) }} style={{ cursor: 'pointer' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <Badge variant={severityVariant(alert.severity)} size="sm">
                              {t(`alerts.severityLabels.${alert.severity}`) ?? alert.severity}
                            </Badge>
                            <Badge variant={statusVariant(alert.status)} size="sm">
                              {t(`alerts.${alert.status}`) ?? alert.status}
                            </Badge>
                            {alert.sla_breached && (
                              <Badge variant="danger" size="sm">{t('alerts.slaBreached')}</Badge>
                            )}
                          </div>
                          <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {formatTimestamp(alert.created_at, expertMode)}
                          </span>
                        </div>
                        <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>
                          {translateAlertTitle(alert.title, expertMode)}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
                          {alert.source_host}
                        </div>
                        <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '600px' }}>
                          {translateAlertDescription(alert.description, expertMode)}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }} onClick={(e) => e.stopPropagation()}>
                          {alert.status === 'new' && (
                            <Button variant="primary" size="sm" icon={<CheckCircle size={14} />} onClick={() => handleAcknowledge(alert.id)}>
                              {t('utils.isNormal')}
                            </Button>
                          )}
                          {(alert.status === 'new' || alert.status === 'acknowledged') && (
                            <Button variant="secondary" size="sm" icon={<ArrowUpCircle size={14} />} onClick={() => handleEscalate(alert.id)}>
                              {t('utils.investigate')}
                            </Button>
                          )}
                          <Button variant="secondary" size="sm" icon={<Sparkles size={14} />} onClick={() => { setSelectedAlert(alert); handleAskAi(alert) }}>
                            {t('alerts.askAi')}
                          </Button>
                          {alert.status !== 'closed' && (
                            <Button variant="danger" size="sm" icon={<XCircle size={14} />} onClick={() => setCloseConfirm(alert.id)}>
                              {t('alerts.close')}
                            </Button>
                          )}
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && alerts && alerts.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px' }}>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            {t('common.previous')}
          </Button>
          <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            {t('alerts.pageOf', { page, total: Math.ceil(alertGroups.length / 1) })}
          </span>
          <Button variant="secondary" size="sm" onClick={() => setPage((p) => p + 1)} disabled={alerts.length < PAGE_SIZE}>
            {t('common.next')}
          </Button>
        </div>
      )}

      {/* Detail Modal */}
      {selectedAlert && (
        <Modal
          open={!!selectedAlert}
          onClose={() => { setSelectedAlert(null); setAiAnalysis(null) }}
          title={translateAlertTitle(selectedAlert.title, expertMode)}
          size="lg"
          footer={
            <div style={{ display: 'flex', gap: '8px' }}>
              {selectedAlert.status === 'new' && (
                <Button variant="primary" size="sm" onClick={() => handleAcknowledge(selectedAlert.id)}>
                  {t('alerts.acknowledge')}
                </Button>
              )}
              {(selectedAlert.status === 'new' || selectedAlert.status === 'acknowledged') && (
                <Button variant="secondary" size="sm" onClick={() => handleEscalate(selectedAlert.id)}>
                  {t('alerts.escalate')}
                </Button>
              )}
              <Button variant="secondary" size="sm" icon={<Sparkles size={14} />} onClick={() => handleAskAi(selectedAlert)}>
                {t('alerts.askAi')}
              </Button>
              {selectedAlert.status !== 'closed' && (
                <Button variant="danger" size="sm" onClick={() => setCloseConfirm(selectedAlert.id)}>
                  {t('alerts.close')}
                </Button>
              )}
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '4px' }}>
              <Badge variant={severityVariant(selectedAlert.severity)}>
                {t(`alerts.severityLabels.${selectedAlert.severity}`) ?? selectedAlert.severity}
              </Badge>
              <Badge variant={statusVariant(selectedAlert.status)}>
                {t(`alerts.${selectedAlert.status}`) ?? selectedAlert.status}
              </Badge>
              {selectedAlert.sla_breached && <Badge variant="danger">{t('alerts.slaBreached')}</Badge>}
            </div>
            <AlertDetail label={t('alerts.description')} value={translateAlertDescription(selectedAlert.description, expertMode)} />
            <AlertDetail label={t('alerts.ruleId')} value={selectedAlert.rule_id} />
            <AlertDetail label={t('alerts.sourceHost')} value={selectedAlert.source_host} />
            <AlertDetail label={t('alerts.assignedTo')} value={selectedAlert.assigned_to ? String(selectedAlert.assigned_to) : t('alerts.unassigned')} />
            <AlertDetail label={t('alerts.escalationLevel')} value={String(selectedAlert.escalation_level)} />
            {selectedAlert.escalated_at && <AlertDetail label={t('alerts.escalatedAt')} value={formatTimestamp(selectedAlert.escalated_at, expertMode)} />}
            {selectedAlert.first_acknowledged_at && <AlertDetail label={t('alerts.firstAcknowledgedAt')} value={formatTimestamp(selectedAlert.first_acknowledged_at, expertMode)} />}
            {selectedAlert.sla_first_response_at && <AlertDetail label={t('alerts.slaFirstResponse')} value={formatTimestamp(selectedAlert.sla_first_response_at, expertMode)} />}
            {selectedAlert.sla_resolution_at && <AlertDetail label={t('alerts.slaResolution')} value={formatTimestamp(selectedAlert.sla_resolution_at, expertMode)} />}
            {aiLoading && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-accent)' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-accent)' }}>{t('alerts.aiLoading')}</span>
              </div>
            )}
            {aiAnalysis && !aiLoading && (
              <div style={{ padding: '12px', borderRadius: '8px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-accent)' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-accent)', marginBottom: '8px' }}>{t('alerts.aiAnalysis')}</div>
                <pre style={{ fontSize: '13px', color: 'var(--color-text-primary)', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {aiAnalysis}
                </pre>
              </div>
            )}
            {selectedAlert.llm_analysis && !aiAnalysis && (
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px' }}>{t('alerts.llmAnalysis')}</div>
                <pre style={{ fontSize: '12px', color: 'var(--color-text-primary)', background: 'var(--color-bg-primary)', padding: '12px', borderRadius: '8px', overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap' }}>
                  {selectedAlert.llm_analysis}
                </pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Close confirmation */}
      <ConfirmDialog
        open={closeConfirm !== null}
        title={t('alerts.closeConfirmTitle')}
        message={t('alerts.closeConfirmMessage')}
        confirmLabel={t('alerts.close')}
        variant="danger"
        onConfirm={() => { if (closeConfirm !== null) handleClose(closeConfirm); setCloseConfirm(null) }}
        onCancel={() => setCloseConfirm(null)}
      />
    </div>
  )
}

function AlertDetail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '160px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{value || '—'}</span>
    </div>
  )
}