import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { governanceActionsApi, actionPlansApi } from '../../api'
import { StatCard, Badge } from '../../components/ui'
import {
  ShieldCheck,
  TrendingUp,
  Clock,
  CheckCircle,
  Calendar,
  ClipboardList,
  ArrowRight,
  Server,
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

interface ActionPlan {
  id: number
  action_id: string
  title: string
  source: string
  priority: string
  status: string
  progress: number
  pilot_id: number | null
  pilot_name: string | null
  target_date: string | null
  category: string
}

const STATUS_LABELS: Record<string, string> = {
  a_rediger: 'À rédiger',
  en_cours: 'En cours',
  a_valider: 'À valider',
  valide: 'Validé',
  publie: 'Publié',
}

const ACTION_STATUSES = ['a_rediger', 'en_cours', 'a_valider', 'valide', 'publie']

const FRAMEWORK_COLORS: Record<string, string> = {
  ANSSI: '#3b82f6',
  NIS2: '#8b5cf6',
  RGPD: '#ec4899',
  DORA: '#f59e0b',
  ISO27001: '#10b981',
  Interne: '#6b7280',
}

const scoreColor = (score: number): string => {
  if (score >= 80) return 'var(--color-success, #22c55e)'
  if (score >= 50) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-danger, #ef4444)'
}

export function RssiDashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [completingTask, setCompletingTask] = useState<string | null>(null)
  const [editingProgress, setEditingProgress] = useState<number | null>(null)
  const [editingDate, setEditingDate] = useState<number | null>(null)

  // Fetch RSSI actions
  const { data: actionsData, isLoading } = useQuery({
    queryKey: ['rssi-actions'],
    queryFn: () => governanceActionsApi.list({ pilot_role: 'rssi' }).then((r) => r.data),
  })
  const actions: GovAction[] = actionsData?.items || []

  // Fetch recurring tasks
  const { data: tasksData } = useQuery({
    queryKey: ['rssi-recurring-tasks'],
    queryFn: () => governanceActionsApi.recurringTasks('rssi').then((r) => r.data),
  })
  const tasks: RecurringTask[] = tasksData?.tasks || []

  // Fetch action plans (conformité assets)
  const { data: plansData } = useQuery({
    queryKey: ['rssi-action-plans'],
    queryFn: () => actionPlansApi.list({ source: 'compliance' }).then((r) => r.data),
  })
  const plans: ActionPlan[] = plansData?.items || plansData || []

  // Mutations
  const updateStatusMutation = useMutation({
    mutationFn: async ({ actionId, status }: { actionId: number; status: string }) =>
      governanceActionsApi.updateStatus(actionId, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rssi-actions'] }),
  })

  const updateActionMutation = useMutation({
    mutationFn: async ({ actionId, data }: { actionId: number; data: Record<string, unknown> }) =>
      governanceActionsApi.update(actionId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rssi-actions'] }),
  })

  const handleCompleteTask = async (taskKey: string) => {
    setCompletingTask(taskKey)
    try {
      await governanceActionsApi.completeTask(taskKey)
      qc.invalidateQueries({ queryKey: ['rssi-recurring-tasks'] })
    } finally {
      setCompletingTask(null)
    }
  }

  // Stats
  const totalActions = actions.length
  const avgScore = totalActions > 0 ? Math.round(actions.reduce((s, a) => s + a.score_pct, 0) / totalActions) : 0
  const enCours = actions.filter(a => a.status === 'en_cours').length
  const enRetard = actions.filter(a => a.target_date && new Date(a.target_date) < new Date() && a.status !== 'valide' && a.status !== 'publie').length
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
          Tableau de bord RSSI
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          Pilotage sécurité — actions, tâches récurrentes et conformité
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }} className="stat-grid">
        <StatCard label="Actions RSSI" value={totalActions} icon={<ClipboardList size={20} />} color="var(--color-accent)" loading={isLoading} />
        <StatCard label="Score moyen" value={`${avgScore}%`} icon={<TrendingUp size={20} />} color={scoreColor(avgScore)} loading={isLoading} />
        <StatCard label="En cours" value={enCours} icon={<Clock size={20} />} color="#f59e0b" loading={isLoading} />
        <StatCard label="Tâches du jour" value={`${tasksDone}/${tasksTotal}`} icon={<CheckCircle size={20} />} color={tasksDone === tasksTotal ? '#22c55e' : '#ef4444'} loading={isLoading} />
      </div>

      {/* Tâches récurrentes (compact) */}
      {tasks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionTitle}>
            <Calendar size={16} />
            Tâches récurrentes
            {enRetard > 0 && (
              <span style={{ marginLeft: '8px' }}><Badge variant="danger" size="sm">{enRetard} en retard</Badge></span>
            )}
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

      {/* Mes actions de gouvernance */}
      <div style={{ marginBottom: '24px' }}>
        <div style={sectionTitle}>
          <ShieldCheck size={16} />
          Mes actions de gouvernance
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {actions.map((action) => (
            <div key={action.id} style={{ ...cardStyle, padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                {/* Left: title + framework */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: FRAMEWORK_COLORS[action.regulatory_framework] || '#6b7280' }} />
                    <span style={{ fontWeight: 600, fontSize: '14px' }}>{action.deliverable_name}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                    {action.regulatory_framework} · {action.requirement_count} exigences · Score: <strong style={{ color: scoreColor(action.score_pct) }}>{action.score_pct}%</strong>
                  </div>
                </div>

                {/* Middle: progress bar */}
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

                {/* Status select */}
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

      {/* Plan de conformité assets */}
      {plans.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionTitle}>
            <Server size={16} />
            Plan de conformité ({plans.length} assets)
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {plans.map((plan) => (
              <div key={plan.id} style={{ ...cardStyle, padding: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Server size={14} style={{ color: 'var(--color-text-secondary)' }} />
                      <span style={{ fontWeight: 600, fontSize: '14px' }}>{plan.title}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginTop: '2px' }}>
                      {plan.action_id} · Priorité: {plan.priority}
                    </div>
                  </div>

                  {/* Progress */}
                  <div style={{ width: '120px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', marginBottom: '2px' }}>Progression</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{ flex: 1, height: '6px', borderRadius: '3px', background: 'var(--color-bg-tertiary)', overflow: 'hidden' }}>
                        <div style={{ width: `${plan.progress}%`, height: '100%', background: scoreColor(plan.progress), borderRadius: '3px' }} />
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: scoreColor(plan.progress), minWidth: '30px' }}>{plan.progress}%</span>
                    </div>
                  </div>

                  {/* Status */}
                  <Badge variant={plan.status === 'a_planifier' ? 'danger' : plan.status === 'termine' ? 'success' : 'warning'} size="sm">
                    {plan.status === 'a_planifier' ? 'À planifier' : plan.status === 'en_cours' ? 'En cours' : plan.status === 'termine' ? 'Terminé' : plan.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}