import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { soarApi } from '../api'
import { Badge, StatCard, Tabs, Table, Card, Button, useToast } from '../components/ui'
import { Play, CheckCircle, XCircle, Zap, BarChart3, Activity } from 'lucide-react'

type SoarTab = 'playbooks' | 'executions' | 'approvals' | 'integrations' | 'summary'

const statusVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'completed': case 'approved': case 'active': return 'success'
    case 'running': case 'pending': case 'in_progress': return 'warning'
    case 'failed': case 'rejected': case 'error': return 'danger'
    case 'paused': return 'info'
    default: return 'default'
  }
}

export function SoarPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<SoarTab>('playbooks')
  const [, setExecuteId] = useState<number | null>(null)
  const canAct = canEdit('analyst')

  const { data: playbooks, isLoading: playbooksLoading } = useQuery({
    queryKey: ['soar', 'playbooks'],
    queryFn: () => soarApi.playbooks().then((r) => r.data),
  })

  const { data: executions, isLoading: executionsLoading } = useQuery({
    queryKey: ['soar', 'executions'],
    queryFn: () => soarApi.executions().then((r) => r.data),
  })

  const { data: approvals, isLoading: approvalsLoading } = useQuery({
    queryKey: ['soar', 'approvals'],
    queryFn: () => soarApi.approvals().then((r) => r.data),
  })

  const { data: integrations, isLoading: integrationsLoading } = useQuery({
    queryKey: ['soar', 'integrations'],
    queryFn: () => soarApi.integrations().then((r) => r.data),
  })

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['soar', 'summary'],
    queryFn: () => soarApi.summary().then((r) => r.data),
  })

  const executeMutation = useMutation({
    mutationFn: (id: number) => soarApi.getPlaybook(id).then((r) => r.data),
    onSuccess: () => {
      toast('success', t('compliance.soar.executeSuccess'))
      setExecuteId(null)
      queryClient.invalidateQueries({ queryKey: ['soar'] })
    },
    onError: () => {
      toast('error', t('compliance.soar.executeError'))
    },
  })

  const handleExecute = useCallback((id: number) => {
    setExecuteId(id)
    executeMutation.mutate(id)
  }, [executeMutation])

  const playbooksData = (playbooks as Record<string, unknown>[] | undefined) ?? []
  const executionsData = (executions as Record<string, unknown>[] | undefined) ?? []
  const approvalsData = (approvals as Record<string, unknown>[] | undefined) ?? []
  const integrationsData = (integrations as Record<string, unknown>[] | undefined) ?? []
  const summaryData = summary as Record<string, unknown> | undefined

  const tabs = [
    { key: 'playbooks', label: t('compliance.soar.playbooks') },
    { key: 'executions', label: t('compliance.soar.executions') },
    { key: 'approvals', label: t('compliance.soar.approvals') },
    { key: 'integrations', label: t('compliance.soar.integrations') },
    { key: 'summary', label: t('compliance.soar.summary') },
  ]

  const playbookColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type') },
    { key: 'status', label: t('common.status') },
    { key: 'last_run', label: t('compliance.soar.lastRun') },
    { key: 'actions', label: t('common.actions') },
  ]

  const executionColumns = [
    { key: 'id', label: 'ID' },
    { key: 'playbook_name', label: t('compliance.soar.playbookName') },
    { key: 'status', label: t('common.status') },
    { key: 'started_at', label: t('compliance.soar.startedAt') },
    { key: 'completed_at', label: t('compliance.soar.completedAt') },
  ]

  const integrationColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: t('common.name') },
    { key: 'type', label: t('common.type') },
    { key: 'status', label: t('common.status') },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        {t('compliance.soar.title')}
      </h1>

      <Tabs tabs={tabs} active={activeTab} onChange={(k) => setActiveTab(k as SoarTab)} />

      {/* Tab: Playbooks */}
      {activeTab === 'playbooks' && (
        <Table
          columns={playbookColumns}
          data={playbooksData}
          loading={playbooksLoading}
          emptyMessage={t('compliance.soar.noPlaybooks')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              return <Badge variant={statusVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
            }
            if (col.key === 'actions') {
              return canAct ? (
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Play size={14} />}
                  onClick={() => handleExecute(Number(row.id))}
                  disabled={executeMutation.isPending}
                >
                  {t('compliance.soar.execute')}
                </Button>
              ) : null
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Executions */}
      {activeTab === 'executions' && (
        <Table
          columns={executionColumns}
          data={executionsData}
          loading={executionsLoading}
          emptyMessage={t('compliance.soar.noExecutions')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={statusVariant(v)}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Approvals */}
      {activeTab === 'approvals' && (
        approvalsLoading ? (
          <StatCard label="" value="" loading />
        ) : approvalsData.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
              {t('compliance.soar.noApprovals')}
            </div>
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {approvalsData.map((approval, i) => (
              <Card key={String(approval.id ?? i)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {String(approval.action_type ?? '')}
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      {String(approval.description ?? '')}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
                      {t('compliance.soar.requestedBy')}: {String(approval.requested_by ?? '')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Badge variant={statusVariant(String(approval.status ?? ''))}>
                      {String(approval.status ?? '')}
                    </Badge>
                    {canAct && String(approval.status ?? '') === 'pending' && (
                      <>
                        <Button variant="primary" size="sm" icon={<CheckCircle size={14} />}>
                          {t('compliance.soar.approve')}
                        </Button>
                        <Button variant="danger" size="sm" icon={<XCircle size={14} />}>
                          {t('compliance.soar.reject')}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Tab: Integrations */}
      {activeTab === 'integrations' && (
        <Table
          columns={integrationColumns}
          data={integrationsData}
          loading={integrationsLoading}
          emptyMessage={t('compliance.soar.noIntegrations')}
          renderCell={(col, row) => {
            if (col.key === 'status') {
              const v = String(row[col.key] ?? '')
              return <Badge variant={v === 'active' ? 'success' : v === 'inactive' ? 'default' : 'warning'}>{v}</Badge>
            }
            return String(row[col.key] ?? '')
          }}
        />
      )}

      {/* Tab: Summary */}
      {activeTab === 'summary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {summaryLoading ? (
            Array.from({ length: 4 }).map((_, i) => <StatCard key={i} label="" value="" loading />)
          ) : summaryData ? (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                <StatCard
                  label={t('compliance.soar.totalPlaybooks')}
                  value={String(summaryData.total_playbooks ?? 0)}
                  icon={<Zap size={20} style={{ color: 'var(--color-accent)' }} />}
                />
                <StatCard
                  label={t('compliance.soar.totalExecutions')}
                  value={String(summaryData.total_executions ?? 0)}
                  icon={<Activity size={20} style={{ color: 'var(--color-info)' }} />}
                />
                <StatCard
                  label={t('compliance.soar.pendingApprovals')}
                  value={String(summaryData.pending_approvals ?? 0)}
                  icon={<CheckCircle size={20} style={{ color: 'var(--color-warning)' }} />}
                />
                <StatCard
                  label={t('compliance.soar.successRate')}
                  value={`${Number(summaryData.success_rate ?? 0)}%`}
                  icon={<BarChart3 size={20} style={{ color: 'var(--color-success)' }} />}
                />
              </div>
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}