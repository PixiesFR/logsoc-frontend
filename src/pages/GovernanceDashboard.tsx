import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePermissions } from '../hooks/usePermissions'
import { StatCard, Badge } from '../components/ui'
import { governanceActionsApi, wizardApi } from '../api'
import { DashboardPage } from './Dashboard'
import {
  Gavel,
  FileText,
  ClipboardList,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  Building2,
  Clock,
  FileWarning,
  ArrowRight,
  CheckCircle,
  Calendar,
} from 'lucide-react'

interface RecurringTask {
  task_key: string
  pilot_role: string
  pilot_label: string
  control_frequency: string
  frequency_label: string
  deliverable_type: string | null
  nb_requirements: number
  deliverable_ids: number[]
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
  requirement_count: number
  score_pct: number
  status_breakdown: Record<string, number>
}

interface WizardProfile {
  id: number
  status: string
  profile_data: {
    organization?: {
      name?: string
      sector?: string
      employees?: number
      country?: string
      type?: string
    }
    information_system?: {
      servers_count?: number
      workstations_count?: number
      cloud_provider?: string
    }
    security?: {
      has_rssi?: boolean
      has_dpo?: boolean
      has_secops?: boolean
      maturity_level?: number
      has_pssi?: boolean
    }
    regulatory_frameworks?: string[]
  }
  summary?: string
}

const STATUS_LABELS: Record<string, string> = {
  a_rediger: 'À rédiger',
  en_cours: 'En cours',
  en_revue: 'En revue',
  valide: 'Validé',
  publie: 'Publié',
  Non_traitee: 'Non traitée',
  Conforme: 'Conforme',
  Non_conforme: 'Non conforme',
  Partiellement_conforme: 'Partiellement conforme',
}

const STATUS_VARIANTS: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'default'> = {
  a_rediger: 'danger',
  en_cours: 'warning',
  en_revue: 'info',
  valide: 'success',
  publie: 'success',
}

const FRAMEWORK_COLORS: Record<string, string> = {
  ANSSI: '#3b82f6',
  NIS2: '#8b5cf6',
  RGPD: '#ec4899',
  DORA: '#f59e0b',
  ISO27001: '#10b981',
  Interne: '#6b7280',
}

// Roles that see the SOC/ops dashboard instead of governance
const OPS_ROLES = new Set(['analyst', 'soc_analyst'])

export function GovernanceDashboard() {
  const { role } = usePermissions()

  // Ops roles see the SOC dashboard
  if (OPS_ROLES.has(role)) {
    return <DashboardPage />
  }

  return <GovernanceDashboardInner />
}

function GovernanceDashboardInner() {
  const navigate = useNavigate()
  const { role, isRssi, isDpo, isAdmin } = usePermissions()

  const [actions, setActions] = useState<GovAction[]>([])
  const [recurringTasks, setRecurringTasks] = useState<RecurringTask[]>([])
  const [profile, setProfile] = useState<WizardProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [completingTask, setCompletingTask] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    try {
      const pilotRole = isDpo && !isRssi && !isAdmin ? 'dpo' : isRssi && !isAdmin ? 'rssi' : undefined
      const res = await governanceActionsApi.recurringTasks(pilotRole)
      setRecurringTasks(res.data.tasks || [])
    } catch (err) {
      console.error('Recurring tasks fetch error:', err)
    }
  }, [isDpo, isRssi, isAdmin])

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [actionsRes, profileRes] = await Promise.all([
          governanceActionsApi.list(),
          wizardApi.profile().catch(() => null),
        ])
        setActions(actionsRes.data.items || [])
        if (profileRes?.data) setProfile(profileRes.data)
      } catch (err) {
        console.error('Dashboard fetch error:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
    fetchTasks()
  }, [fetchTasks])

  // Pastilles gouvernance (13/09): état synthétique pratiques/audits
  const [pills, setPills] = useState<{
    total: number
    auditees: number
    enRetard: number
    aPlanifier: number
    jamais: number
    nonConformes: number
    conformes: number
  } | null>(null)
  useEffect(() => {
    const fetchPills = async () => {
      try {
        const api = (await import('../api')).api
        const [progRes, pracsRes] = await Promise.all([
          api.get('/api/v1/grc/audit-program'),
          api.get('/api/v1/grc/practices'),
        ])
        const prog = (progRes.data as { items: { etat: string }[] }).items || []
        const pracs = (pracsRes.data as { items: { realisation: string; politique?: string }[] }).items || []
        setPills({
          total: prog.length,
          auditees: prog.filter((i) => i.etat !== 'jamais_audite').length,
          enRetard: prog.filter((i) => i.etat === 'en_retard').length,
          aPlanifier: prog.filter((i) => i.etat === 'a_planifier').length,
          jamais: prog.filter((i) => i.etat === 'jamais_audite').length,
          nonConformes: pracs.filter((p) => p.realisation === 'present').length,
          conformes: pracs.filter((p) => p.politique === 'publie').length,
        })
      } catch {
        setPills(null)
      }
    }
    fetchPills()
  }, [])

  const handleCompleteTask = async (taskKey: string) => {
    setCompletingTask(taskKey)
    try {
      await governanceActionsApi.completeTask(taskKey)
      await fetchTasks()
    } catch (err) {
      console.error('Complete task error:', err)
    } finally {
      setCompletingTask(null)
    }
  }

  const handleUndoTask = async (taskKey: string) => {
    setCompletingTask(taskKey)
    try {
      const res = await governanceActionsApi.taskHistory(taskKey)
      const history = res.data.history || []
      if (history.length > 0) {
        const latestId = history[0].id
        await governanceActionsApi.deleteCompletion(latestId)
        await fetchTasks()
      }
    } catch (err) {
      console.error('Undo task error:', err)
    } finally {
      setCompletingTask(null)
    }
  }

  // Filter actions by role
  const filteredActions = actions.filter((a) => {
    if (isDpo && !isRssi && !isAdmin) return a.pilot_role === 'dpo'
    if (isRssi && !isAdmin) return a.pilot_role === 'rssi'
    return true // admin/superadmin sees all
  })

  // Group by framework
  const byFramework = filteredActions.reduce<Record<string, GovAction[]>>((acc, a) => {
    const fw = a.regulatory_framework
    if (!acc[fw]) acc[fw] = []
    acc[fw].push(a)
    return acc
  }, {})

  const totalActions = filteredActions.length
  const totalRequirements = filteredActions.reduce((sum, a) => sum + a.requirement_count, 0)
  const avgScore = totalActions > 0
    ? Math.round(filteredActions.reduce((sum, a) => sum + a.score_pct, 0) / totalActions)
    : 0
  const actionsToStart = filteredActions.filter(a => a.status === 'a_rediger').length

  const org = profile?.profile_data?.organization
  const sec = profile?.profile_data?.security
  const frameworks = profile?.profile_data?.regulatory_frameworks || []

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
          Tableau de bord
          {org?.name && <span style={{ color: 'var(--color-text-secondary)', fontWeight: 400 }}> — {org.name}</span>}
        </h1>
        <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
          {role === 'admin' || role === 'superadmin' ? 'Vue globale gouvernance et conformité' :
           isRssi ? 'Plan d\'action RSSI — sécurité et conformité' :
           isDpo ? 'Plan d\'action DPO — protection des données' :
           'Vue d\'ensemble gouvernance'}
        </p>
      </div>

      {/* Pastilles gouvernance — état synthétique au premier regard */}
      {pills && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
          {[
            { label: `${pills.total} pratiques`, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-secondary)' },
            { label: `${pills.conformes} publiées`, color: 'var(--color-success)', bg: 'var(--color-bg-secondary)' },
            { label: `${pills.nonConformes} déployées`, color: 'var(--color-accent)', bg: 'var(--color-bg-secondary)' },
            { label: `${pills.auditees} auditées`, color: 'var(--color-success)', bg: 'var(--color-bg-secondary)' },
            { label: `${pills.aPlanifier} à planifier`, color: 'var(--color-warning)', bg: 'var(--color-bg-secondary)' },
            ...(pills.enRetard > 0 ? [{ label: `${pills.enRetard} en retard`, color: 'var(--color-danger)', bg: 'var(--color-bg-secondary)' }] : []),
            ...(pills.jamais > 0 ? [{ label: `${pills.jamais} jamais auditées`, color: 'var(--color-text-secondary)', bg: 'var(--color-bg-secondary)' }] : []),
          ].map((p) => (
            <span key={p.label} style={{
              padding: '5px 12px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
              color: p.color, background: p.bg, border: '1px solid var(--color-border)',
            }}>
              {p.label}
            </span>
          ))}
        </div>
      )}

      {/* Profile summary banner */}
      {profile && profile.status === 'validated' && org && (
        <div style={{
          ...cardStyle,
          marginBottom: '24px',
          display: 'flex',
          gap: '24px',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Building2 size={24} style={{ color: 'var(--color-accent)' }} />
            <div>
              <div style={{ fontSize: '16px', fontWeight: 600 }}>{org.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                {org.sector} · {org.employees} employés · {org.country}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {frameworks.map(fw => (
              <div key={fw} style={{
                padding: '4px 12px',
                borderRadius: '6px',
                background: FRAMEWORK_COLORS[fw] || '#6b7280',
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {fw}
              </div>
            ))}
          </div>
          {sec && (
            <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              <span title="Maturité sécurité">
                Niveau {sec.maturity_level ?? 1}/5
              </span>
              {sec.has_pssi === false && (
                <Badge variant="danger" size="sm">PSSI manquante</Badge>
              )}
              {sec.has_rssi && <Badge variant="success" size="sm">RSSI</Badge>}
              {sec.has_dpo && <Badge variant="success" size="sm">DPO</Badge>}
              {!sec.has_secops && <Badge variant="warning" size="sm">Pas de SecOps</Badge>}
            </div>
          )}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }} className="stat-grid">
        <StatCard
          label="Actions de gouvernance"
          value={totalActions}
          icon={<ClipboardList size={20} />}
          color="var(--color-accent)"
          loading={loading}
        />
        <StatCard
          label="Exigences couvertes"
          value={totalRequirements}
          icon={<ShieldCheck size={20} />}
          color="#10b981"
          loading={loading}
        />
        <StatCard
          label="Score moyen"
          value={`${avgScore}%`}
          icon={<TrendingUp size={20} />}
          color={avgScore > 50 ? '#10b981' : avgScore > 20 ? '#f59e0b' : '#ef4444'}
          loading={loading}
        />
        <StatCard
          label="À démarrer"
          value={actionsToStart}
          icon={<Clock size={20} />}
          color="#ef4444"
          loading={loading}
        />
      </div>

      {/* Tâches récurrentes */}
      {recurringTasks.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={sectionTitle}>
            <Calendar size={16} />
            Tâches récurrentes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '12px' }}>
            {recurringTasks.map((task) => (
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
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '2px' }}>
                      {task.pilot_label} · {task.nb_requirements} exigences
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {task.done_this_period
                        ? '✓ Fait pour cette période'
                        : task.last_completed_at
                          ? `Dernière: ${new Date(task.last_completed_at).toLocaleDateString('fr-FR')}`
                          : 'Jamais complétée'}
                    </div>
                  </div>
                  {!task.done_this_period ? (
                    <button
                      onClick={() => handleCompleteTask(task.task_key)}
                      disabled={completingTask === task.task_key}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-success)',
                        background: 'transparent',
                        color: 'var(--color-success)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: completingTask === task.task_key ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle size={14} />
                      {completingTask === task.task_key ? '...' : 'Fait'}
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        if (confirm('Marquer cette tâche comme non faite ?')) {
                          handleUndoTask(task.task_key)
                        }
                      }}
                      disabled={completingTask === task.task_key}
                      style={{
                        padding: '4px 10px',
                        borderRadius: '6px',
                        border: '1px solid var(--color-danger)',
                        background: 'transparent',
                        color: 'var(--color-danger)',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: completingTask === task.task_key ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        flexShrink: 0,
                      }}
                    >
                      <AlertTriangle size={14} />
                      Non fait
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action plan by framework */}
      <div style={{ marginBottom: '24px' }}>
        <div style={sectionTitle}>
          <Gavel size={16} />
          Plan d'action par framework
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
          {Object.entries(byFramework).map(([fw, fwActions]) => {
            const fwScore = fwActions.length > 0
              ? Math.round(fwActions.reduce((s, a) => s + a.score_pct, 0) / fwActions.length)
              : 0
            const fwReqs = fwActions.reduce((s, a) => s + a.requirement_count, 0)
            return (
              <div key={fw} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      background: FRAMEWORK_COLORS[fw] || '#6b7280',
                    }} />
                    <span style={{ fontWeight: 600, fontSize: '15px' }}>{fw}</span>
                  </div>
                  <Badge variant={fwScore > 50 ? 'success' : fwScore > 20 ? 'warning' : 'danger'} size="sm">
                    {fwScore}%
                  </Badge>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>
                  {fwActions.length} actions · {fwReqs} exigences
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {fwActions.map(action => (
                    <div
                      key={action.id}
                      onClick={() => navigate('/governance/action-plan')}
                      style={{
                        padding: '8px 12px',
                        borderRadius: '6px',
                        background: 'var(--color-bg-tertiary)',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--color-bg-hover)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'var(--color-bg-tertiary)'}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {action.deliverable_name}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                          {action.requirement_count} exigences
                        </div>
                      </div>
                      <Badge variant={STATUS_VARIANTS[action.status] || 'default'} size="sm">
                        {STATUS_LABELS[action.status] || action.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Quick links */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
        <div
          onClick={() => navigate('/governance/action-plan')}
          style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <ClipboardList size={24} style={{ color: 'var(--color-accent)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Plan d'action global</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Toutes les actions</div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
        </div>

        <div
          onClick={() => navigate('/governance/documentation')}
          style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <FileText size={24} style={{ color: 'var(--color-accent)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Livrables & Rédaction</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Exigences, assistance IA, génération de documents</div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
        </div>

        <div
          onClick={() => navigate('/governance/policies')}
          style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <FileText size={24} style={{ color: 'var(--color-accent)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Bibliothèque</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Documents, référentiels et validation</div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
        </div>

        {(isRssi || isAdmin) && (
          <div
            onClick={() => navigate('/governance/action-plan-rssi')}
            style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <ShieldCheck size={24} style={{ color: '#3b82f6' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Plan RSSI</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Actions sécurité</div>
            </div>
            <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
          </div>
        )}

        {(isDpo || isAdmin) && (
          <div
            onClick={() => navigate('/governance/action-plan-dpo')}
            style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
          >
            <ShieldCheck size={24} style={{ color: '#ec4899' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: '14px' }}>Plan DPO</div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Protection des données</div>
            </div>
            <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
          </div>
        )}

        <div
          onClick={() => navigate('/risques')}
          style={{ ...cardStyle, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <AlertTriangle size={24} style={{ color: '#f59e0b' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Risques</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>Registre et incidents</div>
          </div>
          <ArrowRight size={16} style={{ color: 'var(--color-text-secondary)' }} />
        </div>
      </div>

      {/* Profile not validated warning */}
      {profile && profile.status !== 'validated' && (
        <div style={{
          ...cardStyle,
          marginTop: '24px',
          borderColor: 'var(--color-warning)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <FileWarning size={20} style={{ color: 'var(--color-warning)' }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: '14px' }}>Profil d'organisation incomplet</div>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              Complétez le wizard de cadrage pour activer les livrables et l'assistance IA.
            </div>
          </div>
          <button
            onClick={() => navigate('/wizard')}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: '1px solid var(--color-accent)',
              background: 'var(--color-accent)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Compléter
          </button>
        </div>
      )}
    </div>
  )
}