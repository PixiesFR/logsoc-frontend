import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { governanceActionsApi, dpoApi } from '../../api'
import { StatCard, Badge } from '../../components/ui'
import {
  ShieldAlert,
  TrendingUp,
  Clock,
  CheckCircle,
  Calendar,
  ClipboardList,
  ArrowRight,
  FileWarning,
  AlertTriangle,
} from 'lucide-react'

interface RecurringTask {
  task_key: string
  pilot_role: string
  pilot_label: string
  control_frequency: string
  frequency_label: string
  deliverable_type: string | null
  nb_requirements: number
  last_completed_at: string | null
  done_this_period: boolean
}

interface GovAction {
  id: number
  title: string
  description: string
  regulatory_framework: string
  deliverable_id: number
  deliverable_name: string
  pilot_role: string
  status: string
  progress: number
  target_date: string | null
  requirement_count: number
  score_pct: number
  status_breakdown: Record<string, number>
}

const STATUS_LABELS: Record<string, string> = {
  a_rediger: 'À rédiger',
  en_cours: 'En cours',
  a_valider: 'À valider',
  valide: 'Validé',
  publie: 'Publié',
}

const ACTION_STATUSES = ['a_rediger', 'en_cours', 'a_valider', 'valide', 'publie']

const scoreColor = (score: number): string => {
  if (score >= 80) return 'var(--color-success, #22c55e)'
  if (score >= 50) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-danger, #ef4444)'
}

export function DpoDashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [editingProgress, setEditingProgress] = useState<number | null>(null)
  const [editingDate, setEditingDate] = useState<number | null>(null)

  // Fetch DPO actions
  const { data: actionsData, isLoading } = useQuery({
    queryKey: ['dpo-actions'],
    queryFn: () => governanceActionsApi.list({ pilot_role: 'dpo' }).then((r) => r.data),
  })
  const actions: GovAction[] = actionsData?.items || []

  // Fetch recurring tasks
  const { data: tasksData } = useQuery({
    queryKey: ['dpo-recurring-tasks'],
    queryFn: () => governanceActionsApi.recurringTasks('dpo').then((r) => r.data),
  })
  const tasks: RecurringTask[] = tasksData?.tasks || []

  // Fetch registries for alert counts
  const { data: processingData } = useQuery({ queryKey: ['dpo-processing-dashboard'], queryFn: () => dpoApi.listProcessing().then(r => r.data) })
  const { data: breachesData } = useQuery({ queryKey: ['dpo-breaches-dashboard'], queryFn: () => dpoApi.listBreaches().then(r => r.data) })
  const { data: piaData } = useQuery({ queryKey: ['dpo-pia-dashboard'], queryFn: () => dpoApi.listPia().then(r => r.data) })
  const { data: rightsData } = useQuery({ queryKey: ['dpo-rights-dashboard'], queryFn: () => dpoApi.listRights().then(r => r.data) })

  const processingCount = (processingData?.items || []).filter((p: any) => p.status === 'active').length
  const breachesOpen = (breachesData?.items || []).filter((b: any) => b.status === 'open').length
  const breachesNotified = (breachesData?.items || []).filter((b: any) => b.status === 'notified').length
  const piaInProgress = (piaData?.items || []).filter((p: any) => p.status === 'initiated' || p.status === 'in_progress').length
  const rightsOpen = (rightsData?.items || []).filter((r: any) => r.status === 'received' || r.status === 'in_progress').length

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ actionId, status }: { actionId: number; status: string }) =>
      governanceActionsApi.updateStatus(actionId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dpo-actions'] }),
  })

  const updateActionMutation = useMutation({
    mutationFn: async ({ actionId, data }: { actionId: number; data: Record<string, unknown> }) =>
      governanceActionsApi.update(actionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dpo-actions'] }),
  })

  const handleCompleteTask = async (taskKey: string) => {
    setCompletingTask(taskKey)
    try {
      await governanceActionsApi.completeTask(taskKey)
      qc.invalidateQueries({ queryKey: ['dpo-recurring-tasks'] })
    } finally {
      setCompletingTask(null)
    }
  }

  // Stats
  const totalActions = actions.length
  const avgScore = totalActions > 0 ? Math.round(actions.reduce((s, a) => s + a.score_pct, 0) / totalActions) : 0
  const enCours = actions.filter(a => a.status === 'en_cours').length
  const tasksDone = tasks.filter(t => t.done_this_period).length
  const tasksTotal = tasks.length

  const cardStyle: React.CSSProperties = {
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
    background: 'var(--color-bg-secondary)',
  }

  const sectionTitle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--color-text-secondary)',
    marginBottom: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>
          Tableau de bord DPO
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Protection des données — actions, tâches récurrentes et registres RGPD
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }} className="stat-grid">
        <StatCard label="Actions DPO" value={totalActions} icon={<ClipboardList size={20} />} color="var(--color-accent)" loading={isLoading} />
        <StatCard label="Score moyen" value={`${avgScore}%`} icon={<TrendingUp size={20} />} color={scoreColor(avgScore)} loading={isLoading} />
        <StatCard label="En cours" value={enCours} icon={<Clock size={20} />} color="#f59e0b" loading={isLoading} />
        <StatCard label="Tâches du jour" value={`${tasksDone}/${tasksTotal}`} icon={<CheckCircle size={20} />} color={tasksDone === tasksTotal ? '#22c55e' : '#ef4444'} loading={isLoading} />
      </div>

      {/* Alertes RGPD cliquables */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px', marginBottom: '24px' }}>
        <div onClick={() => navigate('/dpo/breaches')} style={{ ...cardStyle, padding: '14px', borderColor: breachesOpen > 0 ? 'var(--color-danger)' : 'var(--color-border)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={18} style={{ color: breachesOpen > 0 ? 'var(--color-danger)' : 'var(--color-text-secondary)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Registre des violations</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {breachesOpen > 0 ? `${breachesOpen} non notifiée(s) — 72h CNIL` : `${breachesNotified} notifiée(s)`}
              </div>
            </div>
            {breachesOpen > 0 && <Badge variant="danger" size="sm">{breachesOpen}</Badge>}
          </div>
        </div>
        <div onClick={() => navigate('/dpo/rights')} style={{ ...cardStyle, padding: '14px', borderColor: rightsOpen > 0 ? 'var(--color-warning)' : 'var(--color-border)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileWarning size={18} style={{ color: rightsOpen > 0 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Demandes de droits</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                {rightsOpen > 0 ? `${rightsOpen} en cours — SLA 1 mois` : 'Aucune demande en cours'}
              </div>
            </div>
            {rightsOpen > 0 && <Badge variant="warning" size="sm">{rightsOpen}</Badge>}
          </div>
        </div>
        <div onClick={() => navigate('/dpo/processing')} style={{ ...cardStyle, padding: '14px', borderColor: 'var(--color-border)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={18} style={{ color: 'var(--color-accent)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>Registre des traitements</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{processingCount} traitement(s) actif(s) — article 30 RGPD</div>
            </div>
            <Badge variant="info" size="sm">{processingCount}</Badge>
          </div>
        </div>
        <div onClick={() => navigate('/dpo/pia')} style={{ ...cardStyle, padding: '14px', borderColor: piaInProgress > 0 ? 'var(--color-warning)' : 'var(--color-border)', cursor: 'pointer' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileWarning size={18} style={{ color: piaInProgress > 0 ? 'var(--color-warning)' : 'var(--color-text-secondary)' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '13px', fontWeight: 600 }}>PIA / DPIA</div>
              <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{piaInProgress > 0 ? `${piaInProgress} en cours` : 'Aucun PIA en cours'} — article 35 RGPD</div>
            </div>
            {piaInProgress > 0 && <Badge variant="warning" size="sm">{piaInProgress}</Badge>}
          </div>
        </div>
      </div>

      {/* Tâches récurrentes */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionTitle}>
            <Calendar size={16} />
            Tâches récurrentes DPO
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '12px' }}>
            {tasks.map((task) => (
              <div key={task.task_key} style={{
                ...cardStyle,
                padding: '14px',
                opacity: task.done_this_period ? 0.6 : 1,
                borderColor: task.done_this_period ? 'var(--color-success)' : 'var(--color-border)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Badge variant={task.done_this_period ? 'success' : task.control_frequency === 'daily' ? 'danger' : 'warning'} size="sm">
                        {task.frequency_label}
                      </Badge>
                      {task.deliverable_type && (
                        <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>{task.deliverable_type.replace(/_/g, ' ')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{task.nb_requirements} exigences</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {task.done_this_period ? '✓ Fait' : task.last_completed_at ? `Dernière: ${new Date(task.last_completed_at).toLocaleDateString('fr-FR')}` : 'Jamais'}
                    </div>
                  </div>
                  {!task.done_this_period && (
                    <button
                      onClick={() => handleCompleteTask(task.task_key)}
                      disabled={completingTask === task.task_key}
                      style={{
                        padding: '4px 10px', borderRadius: '6px',
                        border: '1px solid var(--color-success)', background: 'transparent',
                        color: 'var(--color-success)', fontSize: '12px', fontWeight: 600,
                        cursor: completingTask === task.task_key ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0,
                      }}
                    >
                      <CheckCircle size={14} />
                      {completingTask === task.task_key ? '...' : 'Fait'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mes actions de gouvernance DPO */}
      <div style={{ marginBottom: '24px' }}>
        <div style={sectionTitle}>
          <ShieldAlert size={16} />
          Mes actions DPO
          <button
            onClick={async () => {
              try {
                const res = await dpoApi.actionsStatus()
                const data = res.data
                console.log('DPO actions status:', data)
                alert(`Statuts synchronisés:\n- Traitements: ${data.registry_counts.processing}\n- Violations: ${data.registry_counts.breaches}\n- PIA: ${data.registry_counts.pia} (${data.registry_counts.pia_validated} validés)\n- Demandes: ${data.registry_counts.rights}`)
              } catch (e) {
                alert('Erreur lors de la synchronisation')
              }
            }}
            style={{
              marginLeft: 'auto', padding: '4px 10px', borderRadius: '6px',
              border: '1px solid var(--color-accent)', background: 'transparent',
              color: 'var(--color-accent)', fontSize: '12px', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            Synchroniser les statuts
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {actions.map((action) => (
            <div key={action.id} style={{ ...cardStyle, padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Left: title */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: '#ec4899' }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{action.deliverable_name}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {action.regulatory_framework} · {action.requirement_count} exigences · Score: <strong style={{ color: scoreColor(action.score_pct) }}>{action.score_pct}%</strong>
                  </div>
                </div>

                {/* Progress */}
                <div style={{ width: '120px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Progression</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--color-bg-tertiary)', overflow: 'hidden' }}>
                      <div style={{ width: `${action.progress}%`, height: '100%', background: scoreColor(action.progress), borderRadius: '3px', transition: 'width 0.3s' }} />
                    </div>
                    {editingProgress === action.id ? (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        defaultValue={action.progress}
                        onBlur={(e) => {
                          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0))
                          updateActionMutation.mutate({ actionId: action.id, data: { progress: val } })
                          setEditingProgress(null)
                        }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
                        style={{ width: '40px', padding: '2px 4px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                        autoFocus
                      />
                    ) : (
                      <span
                        onClick={() => setEditingProgress(action.id)}
                        style={{ fontSize: '12px', fontWeight: 600, cursor: 'pointer', color: scoreColor(action.progress), minWidth: '30px' }}
                        title="Cliquez pour modifier"
                      >
                        {action.progress}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Target date */}
                <div style={{ width: '130px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Échéance</div>
                  {editingDate === action.id ? (
                    <input
                      type="date"
                      defaultValue={action.target_date ? action.target_date.split('T')[0] : ''}
                      onBlur={(e) => {
                        updateActionMutation.mutate({ actionId: action.id, data: { target_date: e.target.value || null } })
                        setEditingDate(null)
                      }}
                      style={{ width: '100%', padding: '2px 4px', fontSize: '12px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)' }}
                      autoFocus
                    />
                  ) : (
                    <span
                      onClick={() => setEditingDate(action.id)}
                      style={{ fontSize: '12px', cursor: 'pointer', color: action.target_date && new Date(action.target_date) < new Date() ? 'var(--color-danger)' : 'var(--color-text-primary)' }}
                      title="Cliquez pour modifier"
                    >
                      {action.target_date ? new Date(action.target_date).toLocaleDateString('fr-FR') : '—'}
                    </span>
                  )}
                </div>

                {/* Status */}
                <div>
                  <select
                    value={action.status}
                    onChange={(e) => updateStatusMutation.mutate({ actionId: action.id, status: e.target.value })}
                    style={{ padding: '4px 8px', background: 'var(--color-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                  >
                    {ACTION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                  </select>
                </div>

                {/* View detail */}
                <button
                  onClick={() => navigate('/governance/documentation')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-info, #3b82f6)' }}
                  title="Voir les exigences"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}