import { useState } from 'react'
import { useTranslation } from '../i18n/useTranslation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { agentsApi } from '../api'
import { Card, Badge, StatCard, Modal, Button, EmptyState, ConfirmDialog, useToast } from '../components/ui'
import { Server, CheckCircle, XCircle, Trash2, Clock, Filter, Settings, RefreshCw, Archive, AlertTriangle, Cpu, Network, FileText, Shield, Lock } from 'lucide-react'
import { AgentConfigModal } from '../components/agents/AgentConfigModal'
import { formatLocalTime } from '../utils/eventFormatter'
import type { AssetItem, AgentHeartbeat } from '../api/types'

const statusVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (status) {
    case 'active': return 'success'
    case 'pending': return 'warning'
    case 'disconnected': return 'danger'
    case 'inactive': return 'default'
    case 'revoked': return 'info'
    case 'deleted': return 'danger'
    default: return 'default'
  }
}

function timeAgo(timestamp: string, t: (key: string, params?: Record<string, string | number>) => string): string {
  const now = Date.now()
  const normalized = timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T')
  const ts = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z').getTime()
  const diffMs = now - ts
  if (diffMs < 0) return t('dashboard.justNow')
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('dashboard.justNow')
  if (diffMin < 60) return t('dashboard.minutesAgo', { count: diffMin })
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return t('dashboard.hoursAgo', { count: diffH })
  const diffD = Math.floor(diffH / 24)
  return t('dashboard.daysAgo', { count: diffD })
}

/** Normalize a timestamp string to include 'Z' suffix if it has no timezone info,
 *  so JavaScript Date parses it as UTC rather than local. */
function normalizeUTC(ts: string): string {
  if (!ts) return ts
  if (ts.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(ts)) return ts
  if (ts.includes('T')) return ts + 'Z'
  return ts.replace(' ', 'T') + 'Z'
}

export function AgentsPage() {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedAgent, setSelectedAgent] = useState<AssetItem | null>(null)
  const [configAgent, setConfigAgent] = useState<{ id: string; hostname: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [permanentDeleteConfirm, setPermanentDeleteConfirm] = useState<string | null>(null)
  const [reactivateConfirm, setReactivateConfirm] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [showArchive, setShowArchive] = useState(false)

  const { data: agents, isLoading } = useQuery<AssetItem[]>({
    queryKey: ['agents', showArchive],
    queryFn: () => agentsApi.list(showArchive ? { include_deleted: 'true' } : undefined).then((r) => r.data as AssetItem[]),
  })

  const approveMutation = useMutation({
    mutationFn: (id: string) => agentsApi.approve(id),
    onSuccess: () => {
      toast('success', t('agents.approveSuccess'))
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setSelectedAgent(null)
    },
    onError: () => {
      toast('error', t('agents.approveError'))
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => agentsApi.reject(id),
    onSuccess: () => {
      toast('success', t('agents.rejectSuccess'))
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setSelectedAgent(null)
    },
    onError: () => {
      toast('error', t('agents.rejectError'))
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => agentsApi.revoke(id),
    onSuccess: () => {
      toast('success', t('agents.revokeSuccess'))
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setSelectedAgent(null)
    },
    onError: () => {
      toast('error', t('agents.revokeError'))
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => agentsApi.delete(id),
    onSuccess: () => {
      toast('success', t('agents.deleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setSelectedAgent(null)
      setDeleteConfirm(null)
    },
    onError: () => {
      toast('error', t('agents.deleteError'))
    },
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: string) => agentsApi.reactivate(id),
    onSuccess: () => {
      toast('success', t('agents.reactivateSuccess'))
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setReactivateConfirm(null)
      setSelectedAgent(null)
    },
    onError: () => {
      toast('error', t('agents.reactivateError'))
    },
  })

  const permanentDeleteMutation = useMutation({
    mutationFn: (id: string) => agentsApi.permanentDelete(id),
    onSuccess: () => {
      toast('success', t('agents.permanentDeleteSuccess'))
      queryClient.invalidateQueries({ queryKey: ['agents'] })
      setPermanentDeleteConfirm(null)
      setSelectedAgent(null)
    },
    onError: () => {
      toast('error', t('agents.permanentDeleteError'))
    },
  })

  // Filter agents: hide deleted unless in archive view
  const agentList = (agents ?? []).filter((a: AssetItem) => {
    if (showArchive) {
      // In archive mode, show only deleted agents
      return a.status === 'deleted'
    }
    // In normal mode, hide deleted agents (backend already filters, but double-check)
    if (a.status === 'deleted') return false
    if (statusFilter === 'all') return true
    if (statusFilter === 'pending') return a.status === 'pending'
    if (statusFilter === 'active') return a.status === 'active'
    if (statusFilter === 'inactive') return a.status === 'inactive' || a.status === 'disconnected'
    if (statusFilter === 'revoked') return a.status === 'revoked'
    return true
  })

  const allAgents = agents ?? []
  const pendingCount = allAgents.filter((a: AssetItem) => a.status === 'pending').length
  const activeAgents = allAgents.filter((a: AssetItem) => a.status === 'active').length
  const inactiveAgents = allAgents.filter((a: AssetItem) => a.status === 'inactive' || a.status === 'disconnected').length
  const deletedCount = allAgents.filter((a: AssetItem) => a.status === 'deleted').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          {t('nav.agents')}
        </h1>
        <Button
          variant={showArchive ? 'primary' : 'secondary'}
          size="sm"
          icon={<Archive size={14} />}
          onClick={() => setShowArchive(!showArchive)}
        >
          {showArchive ? t('agents.hideArchive') : t('agents.showArchive')}
          {deletedCount > 0 && !showArchive && (
            <span style={{ marginLeft: '6px' }}><Badge variant="danger" size="sm">{deletedCount}</Badge></span>
          )}
        </Button>
      </div>

      {/* Stats */}
      {!showArchive && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <StatCard label={t('agents.totalAgents')} value={allAgents.filter(a => a.status !== 'deleted').length} icon={<Server size={20} style={{ color: 'var(--color-accent)' }} />} loading={isLoading} />
          <StatCard label={t('agents.filterPending')} value={pendingCount} icon={<Clock size={20} style={{ color: 'var(--color-warning, #eab308)' }} />} loading={isLoading} />
          <StatCard label={t('common.active')} value={activeAgents} icon={<CheckCircle size={20} style={{ color: 'var(--color-success)' }} />} loading={isLoading} />
          <StatCard label={t('common.inactive')} value={inactiveAgents} icon={<XCircle size={20} style={{ color: 'var(--color-danger)' }} />} loading={isLoading} />
        </div>
      )}

      {showArchive && (
        <div style={{ padding: '12px 16px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--color-warning, #eab308)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-warning, #eab308)' }} />
            <span style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
              {t('agents.archive')} — {deletedCount} {deletedCount === 1 ? 'agent' : 'agents'}
            </span>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {!showArchive && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Filter size={16} style={{ color: 'var(--color-text-secondary)' }} />
          {['all', 'pending', 'active', 'inactive', 'revoked'].map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={{
                padding: '4px 12px',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: statusFilter === f ? 600 : 400,
                border: `1px solid ${statusFilter === f ? 'var(--color-accent)' : 'var(--color-border)'}`,
                background: statusFilter === f ? 'var(--color-accent-bg, rgba(99,102,241,0.1))' : 'var(--color-bg-primary)',
                color: statusFilter === f ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {f === 'all' ? t('agents.filterAll') : (t(`agents.statusLabels.${f}`) || f)}
            </button>
          ))}
          {pendingCount > 0 && statusFilter !== 'pending' && (
            <Badge variant="warning" size="sm">{pendingCount} {t('agents.filterPending')}</Badge>
          )}
        </div>
      )}

      {/* Agent cards */}
      {isLoading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: '160px', borderRadius: '12px' }} />
          ))}
        </div>
      )}

      {!isLoading && agentList.length === 0 && (
        <EmptyState icon={<Server size={32} />} title={t('agents.noAgents')} />
      )}

      {!isLoading && agentList.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
          {agentList.map((agent: AssetItem) => (
            <Card key={agent.id} onClick={() => setSelectedAgent(agent)} style={{ cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  {agent.hostname || agent.agent_id}
                </div>
                <Badge variant={statusVariant(agent.status)} size="sm">
                  {t(`agents.statusLabels.${agent.status}`) || agent.status}
                </Badge>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {t('agents.platform')}: {agent.platform || '—'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {t('agents.version')}: {agent.version || '—'}
                </div>
                <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
                  {t('agents.lastSeen')}: {agent.last_seen ? timeAgo(agent.last_seen, t) : '—'}
                </div>
              </div>
              {/* Inline action buttons based on status */}
              <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                {agent.status === 'pending' && (
                  <>
                    <Button variant="primary" size="sm" onClick={() => { approveMutation.mutate(agent.agent_id) }}>
                      {t('agents.approve')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => { rejectMutation.mutate(agent.agent_id) }}>
                      {t('agents.reject')}
                    </Button>
                  </>
                )}
                {agent.status === 'active' && (
                  <>
                    <Button variant="secondary" size="sm" icon={<Settings size={14} />} onClick={() => { setConfigAgent({ id: agent.agent_id, hostname: agent.hostname || '' }) }}>
                      {t('agents.configure')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => { revokeMutation.mutate(agent.agent_id) }}>
                      {t('agents.revoke')}
                    </Button>
                  </>
                )}
                {agent.status === 'inactive' && (
                  <>
                    <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => { setReactivateConfirm(agent.agent_id) }}>
                      {t('agents.reactivate')}
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => { revokeMutation.mutate(agent.agent_id) }}>
                      {t('agents.revoke')}
                    </Button>
                  </>
                )}
                {agent.status === 'revoked' && (
                  <>
                    <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => { setReactivateConfirm(agent.agent_id) }}>
                      {t('agents.reactivate')}
                    </Button>
                    <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => { setDeleteConfirm(agent.agent_id) }}>
                      {t('common.delete')}
                    </Button>
                    <div style={{ fontSize: '12px', color: 'var(--color-warning, #eab308)', marginTop: '4px', fontStyle: 'italic' }}>
                      ⏳ {t('agents.revokedPendingConfirmation')}
                    </div>
                  </>
                )}
                {agent.status === 'deleted' && (
                  <>
                    <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => { setReactivateConfirm(agent.agent_id) }}>
                      {t('agents.reactivate')}
                    </Button>
                    <Button variant="danger" size="sm" icon={<AlertTriangle size={14} />} onClick={() => { setPermanentDeleteConfirm(agent.agent_id) }}>
                      {t('agents.permanentDelete')}
                    </Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          approveMutation={approveMutation}
          rejectMutation={rejectMutation}
          revokeMutation={revokeMutation}
          reactivateMutation={reactivateMutation}
          setDeleteConfirm={setDeleteConfirm}
          setPermanentDeleteConfirm={setPermanentDeleteConfirm}
          setReactivateConfirm={setReactivateConfirm}
          onConfigure={(id, hostname) => {
            setSelectedAgent(null)
            setConfigAgent({ id, hostname })
          }}
          t={t}
        />
      )}

      {/* Delete confirmation (soft-delete) */}
      <ConfirmDialog
        open={deleteConfirm !== null}
        title={t('agents.deleteConfirmTitle')}
        message={t('agents.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        variant="danger"
        onConfirm={() => { if (deleteConfirm !== null) deleteMutation.mutate(deleteConfirm) }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {/* Permanent delete confirmation */}
      <ConfirmDialog
        open={permanentDeleteConfirm !== null}
        title={t('agents.permanentDeleteConfirmTitle')}
        message={t('agents.permanentDeleteConfirmMessage')}
        confirmLabel={t('agents.permanentDelete')}
        variant="danger"
        onConfirm={() => { if (permanentDeleteConfirm !== null) permanentDeleteMutation.mutate(permanentDeleteConfirm) }}
        onCancel={() => setPermanentDeleteConfirm(null)}
      />

      {/* Reactivate confirmation */}
      <ConfirmDialog
        open={reactivateConfirm !== null}
        title={t('agents.reactivate')}
        message={t('agents.reactivateConfirm')}
        confirmLabel={t('agents.reactivate')}
        variant="primary"
        onConfirm={() => { if (reactivateConfirm !== null) reactivateMutation.mutate(reactivateConfirm) }}
        onCancel={() => setReactivateConfirm(null)}
      />

      {/* Agent configuration modal */}
      {configAgent && (
        <AgentConfigModal
          agentId={configAgent.id}
          agentHostname={configAgent.hostname}
          onClose={() => setConfigAgent(null)}
        />
      )}
    </div>
  )
}

// ── Agent detail modal with heartbeats ──────────────────────────────────

function AgentDetailModal({
  agent,
  onClose,
  approveMutation,
  rejectMutation,
  revokeMutation,
  setDeleteConfirm,
  setPermanentDeleteConfirm,
  setReactivateConfirm,
  onConfigure,
  t,
}: {
  agent: AssetItem
  onClose: () => void
  approveMutation: { mutate: (id: string) => void }
  rejectMutation: { mutate: (id: string) => void }
  revokeMutation: { mutate: (id: string) => void }
  reactivateMutation: { mutate: (id: string) => void }
  setDeleteConfirm: (id: string | null) => void
  setPermanentDeleteConfirm: (id: string | null) => void
  setReactivateConfirm: (id: string | null) => void
  onConfigure: (id: string, hostname: string) => void
  t: (key: string, params?: Record<string, string | number>) => string
}) {
  const { data: heartbeats, isLoading: hbLoading } = useQuery<AgentHeartbeat[]>({
    queryKey: ['agent-heartbeats', agent.agent_id],
    queryFn: () => agentsApi.heartbeats(agent.agent_id, 20).then((r) => r.data as AgentHeartbeat[]),
    enabled: !!agent.agent_id,
  })

  const { data: configData } = useQuery({
    queryKey: ['agent-config', agent.agent_id],
    queryFn: () => agentsApi.getConfig(agent.agent_id).then((r) => r.data as Record<string, unknown>),
    enabled: !!agent.agent_id && agent.status === 'active',
  })

  const hbList = heartbeats ?? []
  const now = Date.now()

  // eBPF / ETW status badge
  const isWindows = (agent.platform || '').includes('windows')
  const ebpfVariant = (status: string): 'success' | 'danger' | 'warning' | 'default' => {
    if (isWindows && status === 'unsupported') return 'success' // ETW is the Windows equivalent
    if (status === 'enabled' || status === 'active') return 'success'
    if (status === 'disabled' || status === 'error') return 'danger'
    if (status === 'pending' || status === 'unsupported') return 'warning'
    return 'default'
  }
  const ebpfLabel = (status: string): string => {
    if (isWindows && status === 'unsupported') return 'ETW actif'
    if (status === 'enabled' || status === 'active') return t('agents.ebpfActive') || 'Actif'
    if (status === 'disabled' || status === 'error') return t('agents.ebpfInactive') || 'Inactif'
    if (status === 'pending' || status === 'unsupported') return t('agents.ebpfPending') || 'En attente'
    return t('agents.ebpfUnavailable') || 'Non disponible'
  }

  // Module status from config
  const config = (configData?.config ?? configData) as Record<string, unknown> | undefined
  const modules = (config?.modules ?? {}) as Record<string, boolean>
  const ebpfProbes = (config?.ebpf_probes ?? {}) as Record<string, boolean>
  const yaraConfig = (config?.yara ?? {}) as Record<string, unknown>

  const moduleStrip = [
    { icon: <Cpu size={14} />, label: isWindows ? 'ETW' : 'eBPF', active: isWindows ? agent.ebpf_status === 'unsupported' : agent.ebpf_status === 'enabled' || agent.ebpf_status === 'active' },
    { icon: <Network size={14} />, label: 'Réseau', active: !!modules.network },
    { icon: <FileText size={14} />, label: 'Journald', active: !!modules.journald },
    { icon: <Shield size={14} />, label: 'YARA', active: !!yaraConfig.active },
    { icon: <Lock size={14} />, label: 'FIM', active: !!ebpfProbes.fim },
  ]

  // Heartbeat square color — UTC-correct, uses network_status
  const hbColor = (h: AgentHeartbeat): string => {
    if (!h.received_at) return 'var(--color-danger)'
    const ts = String(h.received_at)
    const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T')
    const d = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z')
    const ageMin = (now - d.getTime()) / 60000
    if (isNaN(d.getTime()) || ageMin > 5) return 'var(--color-danger)'
    return String(h.network_status) === 'running' ? 'var(--color-success)' : 'var(--color-danger)'
  }

  // Last heartbeat "X min ago"
  const lastHbAge = hbList[0]?.received_at
    ? (() => {
        const ts = String(hbList[0].received_at)
        const normalized = ts.includes('T') ? ts : ts.replace(' ', 'T')
        const d = new Date(normalized.endsWith('Z') ? normalized : normalized + 'Z')
        const ageMin = Math.floor((now - d.getTime()) / 60000)
        if (isNaN(d.getTime())) return '—'
        if (ageMin < 1) return t('dashboard.justNow')
        if (ageMin < 60) return t('dashboard.minutesAgo', { count: ageMin })
        const ageH = Math.floor(ageMin / 60)
        if (ageH < 24) return t('dashboard.hoursAgo', { count: ageH })
        return t('dashboard.daysAgo', { count: Math.floor(ageH / 24) })
      })()
    : '—'

  return (
    <Modal
      open
      onClose={onClose}
      title={agent.hostname || agent.agent_id}
      size="lg"
      footer={
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {agent.status === 'active' && (
            <>
              <Button variant="secondary" size="sm" icon={<Settings size={14} />} onClick={() => onConfigure(agent.agent_id, agent.hostname)}>
                {t('agents.configure')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => revokeMutation.mutate(agent.agent_id)}>
                {t('agents.revoke')}
              </Button>
            </>
          )}
          {agent.status === 'pending' && (
            <>
              <Button variant="primary" size="sm" onClick={() => approveMutation.mutate(agent.agent_id)}>
                {t('agents.approve')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => rejectMutation.mutate(agent.agent_id)}>
                {t('agents.reject')}
              </Button>
            </>
          )}
          {agent.status === 'inactive' && (
            <>
              <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReactivateConfirm(agent.agent_id)}>
                {t('agents.reactivate')}
              </Button>
              <Button variant="danger" size="sm" onClick={() => revokeMutation.mutate(agent.agent_id)}>
                {t('agents.revoke')}
              </Button>
            </>
          )}
          {agent.status === 'revoked' && (
            <>
              <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReactivateConfirm(agent.agent_id)}>
                {t('agents.reactivate')}
              </Button>
              <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => setDeleteConfirm(agent.agent_id)}>
                {t('common.delete')}
              </Button>
              <span style={{ fontSize: '12px', color: 'var(--color-warning, #eab308)', fontStyle: 'italic' }}>
                ⏳ {t('agents.revokedPendingConfirmation')}
              </span>
            </>
          )}
          {agent.status === 'deleted' && (
            <>
              <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={() => setReactivateConfirm(agent.agent_id)}>
                {t('agents.reactivate')}
              </Button>
              <Button variant="danger" size="sm" icon={<AlertTriangle size={14} />} onClick={() => setPermanentDeleteConfirm(agent.agent_id)}>
                {t('agents.permanentDelete')}
              </Button>
            </>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <AgentDetail label={t('agents.agentId')} value={agent.agent_id} />
        <AgentDetail label={t('agents.hostname')} value={agent.hostname} />

        {/* Version badge only */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '140px' }}>{t('agents.version')}</span>
          {agent.version ? <Badge variant="info" size="sm">v{agent.version}</Badge> : <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>—</span>}
        </div>

        {/* eBPF status badge */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '140px' }}>{isWindows ? 'ETW' : t('agents.ebpfStatus')}</span>
          <Badge variant={ebpfVariant(agent.ebpf_status)} size="sm">{ebpfLabel(agent.ebpf_status)}</Badge>
        </div>

        <AgentDetail label={t('agents.arch')} value={agent.arch || '—'} />
        <AgentDetail label={t('agents.lastSeen')} value={formatLocalTime(agent.last_seen)} />
        <AgentDetail label={t('agents.createdAt')} value={formatLocalTime(agent.created_at)} />
        {agent.group_name && <AgentDetail label={t('agents.group')} value={agent.group_name} />}

        {/* Modules strip */}
        {agent.status === 'active' && (
          <div style={{ marginTop: '4px', padding: '10px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '8px' }}>
              {t('agents.modules')}
            </div>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {moduleStrip.map((m) => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: m.active ? 'var(--color-success)' : 'var(--color-text-secondary)' }}>
                  {m.icon}
                  <span style={{ fontWeight: 500 }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Network table — 3 columns: Interface, IP, MAC */}
        <div style={{ marginTop: '4px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>
            {t('agents.networkInfo') || 'Réseau'}
          </h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Interface</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>IP</th>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: 'var(--color-text-secondary)', fontWeight: 600 }}>MAC</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const raw = String(agent.host_ips ?? '').split(',').map(s => s.trim()).filter(Boolean)
                const mac = String(agent.mac ?? '—')
                if (raw.length === 0) {
                  return <tr><td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>—</td><td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)' }}>—</td><td style={{ padding: '6px 8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{mac}</td></tr>
                }
                return raw.map((val, i) => {
                  let iface = '—', ip = '—'
                  if (val.includes(':') && /\d+\.\d+\.\d+\.\d+/.test(val.split(':').slice(1).join(':'))) {
                    const idx = val.indexOf(':')
                    iface = val.substring(0, idx)
                    ip = val.substring(idx + 1)
                  } else if (val.includes(':') && val.includes('::')) {
                    const idx = val.indexOf(':')
                    iface = val.substring(0, idx)
                    ip = val.substring(idx + 1)
                  } else if (/\d+\.\d+\.\d+\.\d+/.test(val) || (val.includes(':') && val.includes('::'))) {
                    ip = val
                    iface = i === 0 ? 'primary' : '—'
                  } else {
                    iface = val
                  }
                  return (
                    <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '6px 8px', color: 'var(--color-text-secondary)', fontFamily: 'monospace' }}>{iface}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{ip}</td>
                      <td style={{ padding: '6px 8px', color: 'var(--color-text-primary)', fontFamily: 'monospace' }}>{i === 0 ? mac : '—'}</td>
                    </tr>
                  )
                })
              })()}
            </tbody>
          </table>
        </div>

        {/* Heartbeats section */}
        <div style={{ marginTop: '16px', borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
            {t('agents.heartbeats')}
          </div>
          {hbLoading ? (
            <div className="skeleton" style={{ height: '40px', borderRadius: '6px' }} />
          ) : hbList.length === 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              {t('agents.noHeartbeats')}
            </div>
          ) : (
            <>
              {/* Last heartbeat info */}
              <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{t('agents.lastHeartbeat')}</span>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                    {lastHbAge}
                  </div>
                </div>
                {hbList[0]?.cpu_percent && (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>CPU</span>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {hbList[0].cpu_percent}%
                    </div>
                  </div>
                )}
                {hbList[0]?.memory_mb != null && (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>RAM</span>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {hbList[0].memory_mb} MB
                    </div>
                  </div>
                )}
                {hbList[0]?.wal_segments != null && (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>WAL</span>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {hbList[0].wal_segments}
                    </div>
                  </div>
                )}
                {hbList[0]?.network_status && (
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Net</span>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: hbList[0].network_status === 'running' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {hbList[0].network_status}
                    </div>
                  </div>
                )}
              </div>

              {/* Heartbeat squares — UTC-correct colors */}
              <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                {hbList.slice(0, 20).map((hb: AgentHeartbeat) => {
                  const bg = hbColor(hb)
                  const title = hb.received_at ? formatLocalTime(normalizeUTC(hb.received_at)) : '—'
                  return (
                    <div
                      key={hb.id}
                      title={`${title}${hb.cpu_percent ? ` · CPU ${hb.cpu_percent}%` : ''}${hb.network_status ? ` · ${hb.network_status}` : ''}`}
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '3px',
                        background: bg,
                        opacity: bg === 'var(--color-danger)' ? 0.6 : 0.85,
                        cursor: 'default',
                      }}
                    />
                  )
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

function AgentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-secondary)', minWidth: '140px' }}>{label}</span>
      <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{value || '—'}</span>
    </div>
  )
}