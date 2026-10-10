import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { governanceActionsApi, grcBridgeApi, domainSkillsApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { Badge, Modal } from '../../components/ui'
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer'
import { Eye, RefreshCw, Sparkles, ChevronDown, ChevronRight, ArrowRight, ArrowLeft } from 'lucide-react'

const ACTION_STATUSES = ['a_rediger', 'en_cours', 'a_valider', 'valide', 'publie']

const STATUS_LABELS: Record<string, string> = {
  a_rediger: 'À rédiger', en_cours: 'En cours', a_valider: 'À valider', valide: 'Validé', publie: 'Publié',
}

const FRAMEWORK_LABELS: Record<string, string> = {
  ANSSI: 'ANSSI', RGPD: 'RGPD', NIS2: 'NIS2', DORA: 'DORA', ISO27001: 'ISO 27001', Interne: 'Interne', Custom: 'Autre',
}

const FRAMEWORK_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
  ANSSI: 'info', RGPD: 'warning', NIS2: 'danger', DORA: 'danger', ISO27001: 'default', Interne: 'default', Custom: 'default',
}

const DRIVER_ORDER = [
  'Stratégie & Alignement',
  'Cadre & Organisation',
  'Conformité & Sécurité',
  'Pilotage & Performance',
]

const DRIVER_ICONS: Record<string, string> = {
  'Stratégie & Alignement': '🎯',
  'Cadre & Organisation': '🏗️',
  'Conformité & Sécurité': '🛡️',
  'Pilotage & Performance': '📊',
}

// Classification de confidentialité
const CLASSIFICATION_LABELS: Record<string, string> = {
  public: 'Public', interne: 'Interne', confidentiel: 'Confidentiel', secret: 'Secret',
}
const CLASSIFICATION_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
  public: 'success', interne: 'info', confidentiel: 'warning', secret: 'danger',
}
const CLASSIFICATION_ORDER = ['secret', 'confidentiel', 'interne', 'public']

// Niveau d'obligation
const OBLIGATION_LABELS: Record<string, string> = {
  obligatoire: 'Obligatoire', recommande: 'Recommandé', envisionne: 'Envisagé',
}
const OBLIGATION_BADGE: Record<string, 'default' | 'info' | 'warning' | 'danger' | 'success'> = {
  obligatoire: 'danger', recommande: 'warning', envisionne: 'default',
}
const OBLIGATION_ORDER = ['obligatoire', 'recommande', 'envisionne']

const PYRAMID_LABELS: Record<number, string> = { 1: 'Politique', 2: 'Opérationnel' }

const scoreColor = (score: number): string => {
  if (score >= 80) return 'var(--color-success, #22c55e)'
  if (score >= 50) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-danger, #ef4444)'
}

interface GovAction {
  id: number
  title: string
  description: string | null
  regulatory_framework: string
  deliverable_type: string
  deliverable_id: number | null
  deliverable_name: string | null
  pilot_role: string
  driver: string | null
  sub_category: string | null
  realization_role: string | null
  classification_level: string | null
  obligation_level: string | null
  pyramid_level: number | null
  status: string
  target_date: string | null
  requirement_count: number
  score_pct: number
  status_breakdown: Record<string, number>
}

interface GovActionDetail extends GovAction {
  requirements: Array<{
    id: number
    document_id: number
    document_name: string
    ref_id: string | null
    rule: string
    target: string | null
    criticality: string | null
    actor: string | null
    compliance_status: string
  }>
}

interface Props {
  title: string
  description: string
  fixedPilot?: string
  fixedPilotExclusion?: string
}

export function GovernanceActionPlanFiltered({ title, description, fixedPilot, fixedPilotExclusion }: Props) {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [frameworkFilter, setFrameworkFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [classificationFilter, setClassificationFilter] = useState('')
  const [obligationFilter, setObligationFilter] = useState('')
  const [sortBy, setSortBy] = useState('driver')
  const [selectedAction, setSelectedAction] = useState<GovActionDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [collapsedDrivers, setCollapsedDrivers] = useState<Set<string>>(new Set())
  const [sourceModal, setSourceModal] = useState<{ open: boolean; text: string; docName: string; loading: boolean }>({ open: false, text: '', docName: '', loading: false })
  const [assistOpen, setAssistOpen] = useState(false)
  const [assistMessages, setAssistMessages] = useState<Array<{ role: string; content: string }>>([])
  const [assistInput, setAssistInput] = useState('')
  const [assistLoading, setAssistLoading] = useState(false)

  const { data, isLoading } = useQuery<any>({
    queryKey: ['gov-actions-filtered', fixedPilot || '', fixedPilotExclusion || '', frameworkFilter, statusFilter],
    queryFn: async () => {
      const params: Record<string, string | number> = {}
      if (fixedPilot) params.pilot_role = fixedPilot
      if (frameworkFilter) params.regulatory_framework = frameworkFilter
      if (statusFilter) params.status = statusFilter
      const resp = await governanceActionsApi.list(params)
      let items = resp.data.items || []
      if (fixedPilotExclusion) {
        items = items.filter((a: GovAction) => a.pilot_role !== fixedPilotExclusion)
      }
      return { ...resp.data, items }
    },
  })

  const updateStatusMutation = useMutation({
    mutationFn: async ({ actionId, status }: { actionId: number; status: string }) => governanceActionsApi.updateStatus(actionId, status),
    onSuccess: () => { toast('success', 'Statut mis à jour'); qc.invalidateQueries({ queryKey: ['gov-actions-filtered'] }) },
    onError: () => { toast('error', 'Erreur') },
  })

  const reseedMutation = useMutation({
    mutationFn: async () => governanceActionsApi.reseed(),
    onSuccess: () => { toast('success', 'Actions re-générées'); qc.invalidateQueries({ queryKey: ['gov-actions-filtered'] }) },
    onError: () => { toast('error', 'Erreur lors du re-seed') },
  })

  const handleViewDetail = async (actionId: number) => {
    setDetailLoading(true)
    setAssistOpen(false)
    setAssistMessages([])
    try {
      const resp = await governanceActionsApi.get(actionId)
      setSelectedAction(resp.data)
    } catch { toast('error', 'Erreur') }
    setDetailLoading(false)
  }

  const handleViewSource = async (reqId: number, docName: string) => {
    setSourceModal({ open: true, text: '', docName, loading: true })
    try {
      const resp = await grcBridgeApi.source(reqId)
      const d = resp.data
      let text = d.source_text || d.text || ''
      if (text.startsWith('|') && !text.match(/^\|\s*[-:]+\s*\|/m)) {
        const headers = (d.column_names || []).length > 0 ? d.column_names : ['ref_id', 'entry_type', 'rule', 'target', 'control_type', 'grc_category', 'deliverable_type', 'actor', 'control_frequency', 'criticality']
        text = '| ' + headers.join(' | ') + ' |\n| ' + headers.map(() => '---').join(' | ') + ' |\n' + text
      }
      setSourceModal({ open: true, text, docName, loading: false })
    } catch { setSourceModal({ open: true, text: 'Erreur', docName, loading: false }) }
  }

  const handleAssistSend = async () => {
    if (!assistInput.trim() || !selectedAction) return
    const userMsg = assistInput.trim()
    setAssistInput('')
    const newMessages = [...assistMessages, { role: 'user', content: userMsg }]
    setAssistMessages(newMessages)
    setAssistLoading(true)
    try {
      const framework = selectedAction.regulatory_framework
      const resp = await domainSkillsApi.assist({
        framework: framework,
        skill_type: 'assistance',
        message: userMsg,
        history: assistMessages.map(m => ({ role: m.role, content: m.content })),
      }, { timeout: 120000 })
      const aiContent = resp.data?.reply || resp.data?.response || resp.data?.message || 'Aucune réponse'
      setAssistMessages([...newMessages, { role: 'assistant', content: aiContent }])
    } catch {
      setAssistMessages([...newMessages, { role: 'assistant', content: 'Erreur lors de la requête IA' }])
    }
    setAssistLoading(false)
  }

  const actions: GovAction[] = (data?.items || []).filter((a: GovAction) => {
    if (classificationFilter && (a.classification_level || 'interne') !== classificationFilter) return false
    if (obligationFilter && (a.obligation_level || 'recommande') !== obligationFilter) return false
    return true
  })

  // Sort actions
  const sortedActions = useMemo(() => {
    const arr = [...actions]
    if (sortBy === 'classification') {
      arr.sort((a, b) => {
        const ac = CLASSIFICATION_ORDER.indexOf(a.classification_level || 'interne')
        const bc = CLASSIFICATION_ORDER.indexOf(b.classification_level || 'interne')
        if (ac !== bc) return ac - bc
        return (a.deliverable_name || '').localeCompare(b.deliverable_name || '')
      })
    } else if (sortBy === 'obligation') {
      arr.sort((a, b) => {
        const ao = OBLIGATION_ORDER.indexOf(a.obligation_level || 'recommande')
        const bo = OBLIGATION_ORDER.indexOf(b.obligation_level || 'recommande')
        if (ao !== bo) return ao - bo
        return (a.deliverable_name || '').localeCompare(b.deliverable_name || '')
      })
    } else if (sortBy === 'pyramid') {
      arr.sort((a, b) => {
        const ap = a.pyramid_level || 1
        const bp = b.pyramid_level || 1
        if (ap !== bp) return ap - bp
        return (a.deliverable_name || '').localeCompare(b.deliverable_name || '')
      })
    } else if (sortBy === 'name') {
      arr.sort((a, b) => (a.deliverable_name || '').localeCompare(b.deliverable_name || ''))
    }
    return arr
  }, [actions, sortBy])

  // Group actions by driver
  const groupedActions = useMemo(() => {
    if (sortBy !== 'driver') {
      return [['__all__', sortedActions]] as Array<[string, GovAction[]]>
    }
    const groups: Record<string, GovAction[]> = {}
    for (const a of sortedActions) {
      const driver = a.driver || 'Autre'
      if (!groups[driver]) groups[driver] = []
      groups[driver].push(a)
    }
    const sorted: Array<[string, GovAction[]]> = []
    for (const d of DRIVER_ORDER) {
      if (groups[d]) sorted.push([d, groups[d]])
    }
    for (const d of Object.keys(groups)) {
      if (!DRIVER_ORDER.includes(d)) sorted.push([d, groups[d]])
    }
    return sorted
  }, [sortedActions, sortBy])

  // Compute filtered summary
  const totalReqs = actions.reduce((s: number, a: GovAction) => s + a.requirement_count, 0)
  const totalConformes = actions.reduce((s: number, a: GovAction) => s + (a.status_breakdown.Conforme || 0), 0)
  const globalScore = totalReqs > 0 ? Math.round((totalConformes / totalReqs) * 1000) / 10 : 0

  const toggleDriver = (driver: string) => {
    const next = new Set(collapsedDrivers)
    if (next.has(driver)) next.delete(driver)
    else next.add(driver)
    setCollapsedDrivers(next)
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>{title}</h1>
        {fixedPilot ? null : (
          <button
            onClick={() => reseedMutation.mutate()}
            disabled={reseedMutation.isPending}
            style={{ padding: '0.4rem 0.75rem', background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}
            title="Re-générer les actions depuis les livrables"
          >
            <RefreshCw size={14} /> Re-générer
          </button>
        )}
      </div>
      <p style={{ color: 'var(--color-muted, #888)', marginBottom: '1.5rem' }}>{description}</p>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Score', value: `${globalScore}%`, color: scoreColor(globalScore) },
          { label: 'Actions', value: actions.length, color: 'inherit' },
          { label: 'Exigences', value: totalReqs, color: 'inherit' },
          { label: 'Conformes', value: totalConformes, color: 'var(--color-success, #22c55e)' },
        ].map((kpi) => (
          <div key={kpi.label} style={{ padding: '1rem', background: 'var(--color-card, #1f2937)', borderRadius: '8px', border: '1px solid var(--color-border, #374151)' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-muted, #888)', textTransform: 'uppercase' }}>{kpi.label}</div>
            <div style={{ fontSize: '1.75rem', fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }} className="filter-bar">
        <select value={frameworkFilter} onChange={(e) => setFrameworkFilter(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="">Tous cadres</option>
          {Object.entries(FRAMEWORK_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="">Tous statuts</option>
          {ACTION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={classificationFilter} onChange={(e) => setClassificationFilter(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="">Toutes classifications</option>
          {Object.entries(CLASSIFICATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={obligationFilter} onChange={(e) => setObligationFilter(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="">Toutes obligations</option>
          {Object.entries(OBLIGATION_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}
          style={{ padding: '0.4rem', background: 'var(--color-input, #1f2937)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px' }}>
          <option value="driver">Trier: Moteur</option>
          <option value="classification">Trier: Classification</option>
          <option value="obligation">Trier: Obligation</option>
          <option value="pyramid">Trier: Niveau pyramide</option>
          <option value="name">Trier: Nom</option>
        </select>
      </div>

      {/* Tableaux groupés par driver */}
      {isLoading ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Chargement...</div>
      ) : actions.length === 0 ? (
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-muted)' }}>Aucune action</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {groupedActions.map(([driver, driverActions]) => {
            const isCollapsed = collapsedDrivers.has(driver)
            const isAllGroup = driver === '__all__'
            return (
              <div key={driver}>
                {/* Driver header */}
                {!isAllGroup && (
                  <div
                    onClick={() => toggleDriver(driver)}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--color-border, #374151)' }}
                  >
                    {isCollapsed ? <ChevronRight size={18} /> : <ChevronDown size={18} />}
                    <span style={{ fontSize: '1.1rem' }}>{DRIVER_ICONS[driver] || '📁'}</span>
                    <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{driver}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginLeft: '0.5rem' }}>
                      {driverActions.length} action{driverActions.length > 1 ? 's' : ''}
                    </span>
                  </div>
                )}

                {/* Table */}
                {!isCollapsed && (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--color-border, #374151)', textAlign: 'left' }}>
                        <th style={{ padding: '0.5rem' }}>Livrable</th>
                        <th style={{ padding: '0.5rem' }}>Cadre</th>
                        <th style={{ padding: '0.5rem' }}>Pilote</th>
                        <th style={{ padding: '0.5rem' }}>Catégorie</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Classif.</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Obligation</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Niv.</th>
                        <th style={{ padding: '0.5rem' }}>Exig.</th>
                        <th style={{ padding: '0.5rem' }}>Score</th>
                        <th style={{ padding: '0.5rem' }}>Statut</th>
                        <th style={{ padding: '0.5rem' }}>Détail</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverActions.map((action) => (
                        <tr key={action.id} style={{ borderBottom: '1px solid var(--color-border, #374151)' }}>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ fontWeight: 600 }}>{action.deliverable_name || action.title}</div>
                            {action.description && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--color-muted)', marginTop: '0.25rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {action.description}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <Badge variant={FRAMEWORK_BADGE[action.regulatory_framework] || 'default'}>
                              {FRAMEWORK_LABELS[action.regulatory_framework] || action.regulatory_framework}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.5rem', fontSize: '0.8rem' }}>
                            {action.realization_role || action.pilot_role}
                          </td>
                          <td style={{ padding: '0.5rem', fontSize: '0.8rem', color: 'var(--color-muted)' }}>
                            {action.sub_category || '—'}
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <Badge variant={CLASSIFICATION_BADGE[action.classification_level || 'interne'] || 'default'} size="sm">
                              {CLASSIFICATION_LABELS[action.classification_level || 'interne'] || 'Interne'}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                            <Badge variant={OBLIGATION_BADGE[action.obligation_level || 'recommande'] || 'default'} size="sm">
                              {OBLIGATION_LABELS[action.obligation_level || 'recommande'] || 'Recommandé'}
                            </Badge>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-muted)' }}>
                            {PYRAMID_LABELS[action.pyramid_level || 1] || `N${action.pyramid_level || 1}`}
                          </td>
                          <td style={{ padding: '0.5rem', fontWeight: 600 }}>{action.requirement_count}</td>
                          <td style={{ padding: '0.5rem' }}>
                            <span style={{ fontWeight: 600, color: scoreColor(action.score_pct) }}>{action.score_pct}%</span>
                            {action.requirement_count > 0 && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>
                                {action.status_breakdown.Conforme || 0}/{action.requirement_count}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <button
                                onClick={() => {
                                  const idx = ACTION_STATUSES.indexOf(action.status)
                                  if (idx > 0) updateStatusMutation.mutate({ actionId: action.id, status: ACTION_STATUSES[idx - 1] })
                                }}
                                disabled={action.status === ACTION_STATUSES[0]}
                                style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: action.status === ACTION_STATUSES[0] ? 'not-allowed' : 'pointer', padding: '2px 4px', opacity: action.status === ACTION_STATUSES[0] ? 0.4 : 1, color: 'var(--color-text)' }}
                                title="Statut precedent"
                              >
                                <ArrowLeft size={14} />
                              </button>
                              <select
                                value={action.status}
                                onChange={(e) => updateStatusMutation.mutate({ actionId: action.id, status: e.target.value })}
                                style={{ padding: '0.25rem', background: 'var(--color-input)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.8rem' }}
                              >
                                {ACTION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                              </select>
                              <button
                                onClick={() => {
                                  const idx = ACTION_STATUSES.indexOf(action.status)
                                  if (idx < ACTION_STATUSES.length - 1) updateStatusMutation.mutate({ actionId: action.id, status: ACTION_STATUSES[idx + 1] })
                                }}
                                disabled={action.status === ACTION_STATUSES[ACTION_STATUSES.length - 1]}
                                style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: action.status === ACTION_STATUSES[ACTION_STATUSES.length - 1] ? 'not-allowed' : 'pointer', padding: '2px 4px', opacity: action.status === ACTION_STATUSES[ACTION_STATUSES.length - 1] ? 0.4 : 1, color: 'var(--color-text)' }}
                                title="Statut suivant"
                              >
                                <ArrowRight size={14} />
                              </button>
                            </div>
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <button onClick={() => handleViewDetail(action.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-info, #3b82f6)' }} title="Voir les exigences">
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal détail action — exigences + assistance IA */}
      {selectedAction && (
        <Modal open={true} onClose={() => { setSelectedAction(null); setAssistOpen(false); setAssistMessages([]) }}
          title={`${selectedAction.deliverable_name || selectedAction.title} — ${selectedAction.requirement_count} exigence${selectedAction.requirement_count > 1 ? 's' : ''}`}
          size="xl">
          <div style={{ maxHeight: '75vh', overflowY: 'auto' }}>
            {detailLoading ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div>
            ) : (
              <>
                {/* Action metadata */}
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  {selectedAction.driver && <span>📂 {selectedAction.driver}</span>}
                  {selectedAction.sub_category && <span>🏷️ {selectedAction.sub_category}</span>}
                  {selectedAction.realization_role && <span>👤 {selectedAction.realization_role}</span>}
                  {selectedAction.classification_level && (
                    <span>🔒 <Badge variant={CLASSIFICATION_BADGE[selectedAction.classification_level] || 'default'} size="sm">{CLASSIFICATION_LABELS[selectedAction.classification_level] || selectedAction.classification_level}</Badge></span>
                  )}
                  {selectedAction.obligation_level && (
                    <span>📋 <Badge variant={OBLIGATION_BADGE[selectedAction.obligation_level] || 'default'} size="sm">{OBLIGATION_LABELS[selectedAction.obligation_level] || selectedAction.obligation_level}</Badge></span>
                  )}
                  <span>Score: <strong style={{ color: scoreColor(selectedAction.score_pct) }}>{selectedAction.score_pct}%</strong></span>
                  {selectedAction.requirement_count > 0 && (
                    <>
                      <span>Conformes: {selectedAction.status_breakdown.Conforme || 0}</span>
                      <span>En cours: {selectedAction.status_breakdown.En_cours || 0}</span>
                      <span>Non traitées: {selectedAction.status_breakdown.Non_traitee || 0}</span>
                    </>
                  )}
                </div>

                {/* Bouton Assistance IA */}
                <div style={{ marginBottom: '1rem' }}>
                  <button
                    onClick={() => setAssistOpen(!assistOpen)}
                    style={{
                      padding: '0.5rem 1rem',
                      background: assistOpen ? 'var(--color-info, #3b82f6)' : 'var(--color-card)',
                      color: assistOpen ? '#fff' : 'var(--color-text)',
                      border: `1px solid ${assistOpen ? 'var(--color-info, #3b82f6)' : 'var(--color-border)'}`,
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      fontSize: '0.875rem',
                    }}
                  >
                    <Sparkles size={16} /> {assistOpen ? 'Masquer l\'assistance IA' : 'Assistance IA'}
                  </button>
                </div>

                {/* Assistance IA Panel */}
                {assistOpen && (
                  <div style={{ marginBottom: '1rem', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '1rem', background: 'var(--color-input, #1f2937)' }}>
                    <div style={{ maxHeight: '300px', overflowY: 'auto', marginBottom: '0.75rem' }}>
                      {assistMessages.length === 0 && (
                        <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem', padding: '0.5rem' }}>
                          Posez une question sur ce livrable — l'IA a accès au cadre réglementaire et aux exigences associées.
                        </div>
                      )}
                      {assistMessages.map((msg, i) => (
                        <div key={i} style={{
                          marginBottom: '0.5rem',
                          padding: '0.5rem',
                          borderRadius: '4px',
                          background: msg.role === 'user' ? 'var(--color-card)' : 'transparent',
                          border: msg.role === 'user' ? '1px solid var(--color-border)' : 'none',
                        }}>
                          <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)', marginBottom: '0.25rem' }}>
                            {msg.role === 'user' ? 'Vous' : 'Assistant IA'}
                          </div>
                          {msg.role === 'assistant'
                            ? <MarkdownRenderer content={msg.content} />
                            : <div style={{ fontSize: '0.85rem' }}>{msg.content}</div>
                          }
                        </div>
                      ))}
                      {assistLoading && (
                        <div style={{ color: 'var(--color-muted)', fontSize: '0.85rem', padding: '0.5rem' }}>
                          <Sparkles size={14} style={{ display: 'inline', marginRight: '0.25rem', animation: 'spin 1s linear infinite' }} />
                          Réflexion en cours...
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input
                        type="text"
                        value={assistInput}
                        onChange={(e) => setAssistInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !assistLoading) handleAssistSend() }}
                        placeholder="Demander à l'IA de vous aider à rédiger ce livrable..."
                        disabled={assistLoading}
                        style={{ flex: 1, padding: '0.5rem', background: 'var(--color-card)', color: 'var(--color-text)', border: '1px solid var(--color-border)', borderRadius: '4px', fontSize: '0.85rem' }}
                      />
                      <button
                        onClick={handleAssistSend}
                        disabled={assistLoading || !assistInput.trim()}
                        style={{ padding: '0.5rem 1rem', background: 'var(--color-info, #3b82f6)', color: '#fff', border: 'none', borderRadius: '4px', cursor: assistLoading ? 'wait' : 'pointer', fontSize: '0.85rem' }}
                      >
                        Envoyer
                      </button>
                    </div>
                  </div>
                )}

                {/* Requirements table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)', textAlign: 'left' }}>
                      <th style={{ padding: '0.4rem' }}>Réf</th>
                      <th style={{ padding: '0.4rem' }}>Règle</th>
                      <th style={{ padding: '0.4rem' }}>Criticité</th>
                      <th style={{ padding: '0.4rem' }}>Statut</th>
                      <th style={{ padding: '0.4rem' }}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(selectedAction.requirements || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: 'var(--color-muted)' }}>
                          Aucune exigence associée à ce livrable pour le moment.
                        </td>
                      </tr>
                    ) : (
                      (selectedAction.requirements || []).map((req) => (
                        <tr key={req.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '0.4rem', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{req.ref_id || '—'}</td>
                          <td style={{ padding: '0.4rem', maxWidth: '400px' }}>
                            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{req.rule}</div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--color-muted)' }}>{req.document_name}</div>
                          </td>
                          <td style={{ padding: '0.4rem' }}>{req.criticality && <Badge variant={req.criticality === 'Critique' ? 'danger' : req.criticality === 'Majeure' ? 'warning' : 'default'}>{req.criticality}</Badge>}</td>
                          <td style={{ padding: '0.4rem', fontSize: '0.8rem' }}>{req.compliance_status?.replace(/_/g, ' ') || '—'}</td>
                          <td style={{ padding: '0.4rem' }}>
                            <button onClick={() => handleViewSource(req.id, req.document_name)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-info, #3b82f6)' }}>
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* Modal source */}
      {sourceModal.open && (
        <Modal open={sourceModal.open} onClose={() => setSourceModal({ ...sourceModal, open: false })} title={`Source — ${sourceModal.docName}`}>
          {sourceModal.loading ? <div style={{ padding: '2rem', textAlign: 'center' }}>Chargement...</div> : (
            <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.8rem', fontFamily: 'monospace' }}>{sourceModal.text}</pre>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}