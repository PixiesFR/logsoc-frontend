import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cmdbGrcApi, grcBridgeApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { Badge, Modal } from '../../components/ui'
import { MarkdownRenderer } from '../../components/ui/MarkdownRenderer'
import { Filter, Download, ChevronRight, AlertTriangle, CheckCircle, Clock, XCircle, Eye } from 'lucide-react'

const COMPLIANCE_STATUSES = ['Non_traitee', 'En_cours', 'Conforme', 'Non_conforme', 'Non_applicable']

const STATUS_LABELS: Record<string, string> = {
  Non_traitee: 'Non traitée',
  En_cours: 'En cours',
  Conforme: 'Conforme',
  Non_conforme: 'Non conforme',
  Non_applicable: 'Non applicable',
}

const criticalityBadgeVariant = (c: string | null): 'danger' | 'warning' | 'default' => {
  switch (c) {
    case 'Critique': return 'danger'
    case 'Majeure': return 'warning'
    default: return 'default'
  }
}

const scoreColor = (score: number): string => {
  if (score >= 80) return 'var(--color-success, #22c55e)'
  if (score >= 50) return 'var(--color-warning, #f59e0b)'
  return 'var(--color-danger, #ef4444)'
}

interface AssetSummary {
  asset_id: number
  asset_name: string
  asset_type: string | null
  hostname: string | null
  ip_address: string | null
  criticality: string | null
  tier_level: string | null
  network_zone: string | null
  responsable_team: string | null
  environment: string | null
  total_reqs: number
  conforme: number
  non_conforme: number
  en_cours: number
  non_traitee: number
  non_applicable: number
  score_pct: number
  action_plan_id: number | null
  action_plan_status: string | null
  action_plan_progress: number
}

interface RequirementItem {
  link_id: number
  requirement_id: number
  document_id: number
  document_name: string
  page_number: number
  ref_id: string | null
  entry_type: string
  rule: string
  target: string | null
  control_type: string | null
  grc_category: string | null
  deliverable_type: string | null
  deliverable_id: number | null
  deliverable_name: string | null
  actor: string | null
  control_frequency: string | null
  criticality: string | null
  asset_tag: string | null
  link_type: string
  compliance_status: string
  proof_url: string | null
  waiver_reason: string | null
  waiver_expires_at: string | null
}

interface OverviewData {
  global: {
    total_assets: number
    assets_with_action_plan: number
    assets_without_plan: number
    total_requirements: number
    total_conforme: number
    total_non_conforme: number
    total_en_cours: number
    total_non_traitee: number
    total_non_applicable: number
    global_score_pct: number
    assets_by_criticality: Record<string, number>
    action_plans_by_status: Record<string, number>
  }
  assets: AssetSummary[]
}

export default function ActionPlan() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [actorFilter, setActorFilter] = useState('')
  const [criticalityFilter, setCriticalityFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [sourceModal, setSourceModal] = useState<{ open: boolean; text: string; docName: string; loading: boolean; columnNames: string[] }>({ open: false, text: '', docName: '', loading: false, columnNames: [] })

  // Fetch overview (KPI dashboard)
  const { data: overviewData, isLoading: overviewLoading } = useQuery({
    queryKey: ['actionPlansOverview'],
    queryFn: () => cmdbGrcApi.actionPlansOverview().then(r => r.data as OverviewData),
  })

  // Fetch per-asset action plan when an asset is selected
  const assetParams = useMemo(() => {
    const p: Record<string, string> = {}
    if (statusFilter) p.status = statusFilter
    if (actorFilter) p.actor = actorFilter
    if (criticalityFilter) p.criticality = criticalityFilter
    if (searchTerm) p.search = searchTerm
    return p
  }, [statusFilter, actorFilter, criticalityFilter, searchTerm])

  const { data: assetDetail, isLoading: assetLoading } = useQuery({
    queryKey: ['assetActionPlan', selectedAssetId, assetParams],
    queryFn: () => cmdbGrcApi.assetActionPlan(selectedAssetId!, assetParams).then(r => r.data as Record<string, unknown>),
    enabled: selectedAssetId !== null,
  })

  // Update link mutation (compliance status)
  const updateLinkMutation = useMutation({
    mutationFn: ({ linkId, data }: { linkId: number; data: Record<string, unknown> }) => grcBridgeApi.updateLink(linkId, data),
    onSuccess: () => {
      toast('success', 'Statut mis à jour')
      qc.invalidateQueries({ queryKey: ['assetActionPlan', selectedAssetId, assetParams] })
      qc.invalidateQueries({ queryKey: ['actionPlansOverview'] })
    },
    onError: () => toast('error', 'Erreur lors de la mise à jour'),
  })

  const handleViewSource = async (requirementId: number) => {
    setSourceModal({ open: true, text: '', docName: '', loading: true, columnNames: [] })
    try {
      const res = await grcBridgeApi.source(requirementId)
      const data = res.data as Record<string, unknown>
      let rawText = String(data.source_text ?? '')
      const columnNames = (data.column_names as string[]) ?? []
      // If the source is a pipe-table without a header separator, inject one
      // so react-markdown renders it as a proper HTML table
      const lines = rawText.split('\n').filter(l => l.trim())
      if (lines.length > 0 && lines[0].trim().startsWith('|') && !lines.some(l => l.match(/^\|\s*[-:]+\s*\|/))) {
        // Count columns from first row
        const colCount = lines[0].split('|').filter(c => c.trim() !== '').length
        const headers = columnNames.length === colCount
          ? columnNames
          : Array.from({ length: colCount }, (_, i) => `Col ${i + 1}`)
        const header = '| ' + headers.join(' | ') + ' |'
        const separator = '| ' + Array.from({ length: colCount }, () => '---').join(' | ') + ' |'
        rawText = header + '\n' + separator + '\n' + rawText
      }
      setSourceModal({ open: true, text: rawText, docName: String(data.document_name ?? ''), loading: false, columnNames })
    } catch {
      setSourceModal({ open: true, text: 'Erreur lors du chargement', docName: '', loading: false, columnNames: [] })
    }
  }

  const handleExportOverview = () => {
    cmdbGrcApi.exportOverview().then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'kpis_action_plans.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    }).catch(() => toast('error', 'Erreur lors de l\'export CSV'))
  }

  const assets = overviewData?.assets ?? []
  const globalData = overviewData?.global

  const requirements = (assetDetail?.requirements ?? []) as RequirementItem[]
  const summary = assetDetail?.summary as Record<string, unknown> | undefined
  const assetInfo = assetDetail?.asset as Record<string, string | number | null | undefined> | undefined
  const actionPlanInfo = assetDetail?.action_plan as Record<string, string | number | null | undefined> | null | undefined

  // Collect unique actors from requirements for filter dropdown
  const uniqueActors = useMemo(() => {
    const s = new Set<string>()
    requirements.forEach(r => { if (r.actor) s.add(r.actor) })
    return Array.from(s).sort()
  }, [requirements])

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Plan d'Action par Asset
        </h1>
        <button onClick={handleExportOverview} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', fontSize: '13px' }}>
          <Download size={14} /> Export KPIs
        </button>
      </div>

      {/* KPI Dashboard (visible only when no asset selected) */}
      {!selectedAssetId && globalData && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Global KPI cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            <KpiCard label="Score global" value={`${globalData.global_score_pct}%`} color={scoreColor(globalData.global_score_pct)} />
            <KpiCard label="Assets concernés" value={String(globalData.total_assets)} icon={undefined} />
            <KpiCard label="Exigences totales" value={String(globalData.total_requirements)} />
            <KpiCard label="Conformes" value={String(globalData.total_conforme)} color="var(--color-success, #22c55e)" icon={CheckCircle} />
            <KpiCard label="En cours" value={String(globalData.total_en_cours)} color="var(--color-info, #3b82f6)" icon={Clock} />
            <KpiCard label="Non traitées" value={String(globalData.total_non_traitee)} color="var(--color-text-secondary)" icon={Clock} />
            <KpiCard label="Non conformes" value={String(globalData.total_non_conforme)} color="var(--color-danger, #ef4444)" icon={XCircle} />
            <KpiCard label="Non applicables" value={String(globalData.total_non_applicable)} color="var(--color-warning, #f59e0b)" icon={AlertTriangle} />
          </div>

          {/* Assets by criticality + action plans by status */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>Assets par criticité</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(globalData.assets_by_criticality).map(([k, v]) => (
                  <Badge key={k} variant={k === 'Critique' ? 'danger' : k === 'Majeure' ? 'warning' : 'default'} size="sm">{k}: {Number(v)}</Badge>
                ))}
              </div>
            </div>
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)', margin: '0 0 8px 0' }}>Plans d'action par statut</h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {Object.entries(globalData.action_plans_by_status).map(([k, v]) => (
                  <Badge key={k} variant="info" size="sm">{k.replace(/_/g, ' ')}: {Number(v)}</Badge>
                ))}
                {globalData.assets_without_plan > 0 && (
                  <Badge variant="warning" size="sm">Sans plan: {globalData.assets_without_plan}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main content: split view (asset list + detail) or just asset list */}
      <div style={{ display: 'flex', gap: '16px', minHeight: '400px' }}>
        {/* Left panel: Asset list */}
        <div style={{
          width: selectedAssetId ? '320px' : '100%',
          flexShrink: 0,
          background: 'var(--color-bg-secondary)',
          borderRadius: '12px',
          border: '1px solid var(--color-border)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--color-border)', fontSize: '14px', fontWeight: 600, color: 'var(--color-text-secondary)' }}>
            Assets ({assets.length})
          </div>
          <div style={{ overflowY: 'auto', flex: 1, maxHeight: selectedAssetId ? 'calc(100vh - 350px)' : '60vh' }}>
            {overviewLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
            ) : assets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>Aucun asset avec exigences.</div>
            ) : (
              assets.map((a) => (
                <div
                  key={a.asset_id}
                  onClick={() => setSelectedAssetId(a.asset_id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--color-border)',
                    background: selectedAssetId === a.asset_id ? 'var(--color-accent-bg, rgba(59,130,246,0.1))' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => { if (selectedAssetId !== a.asset_id) e.currentTarget.style.background = 'var(--color-bg-tertiary, rgba(0,0,0,0.03))' }}
                  onMouseLeave={(e) => { if (selectedAssetId !== a.asset_id) e.currentTarget.style.background = 'transparent' }}
                >
                  <ChevronRight size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {a.asset_name}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                      <span>{a.total_reqs} exigences</span>
                      {a.criticality && <span style={{ color: a.criticality === 'Critique' ? 'var(--color-danger, #ef4444)' : a.criticality === 'Majeure' ? 'var(--color-warning, #f59e0b)' : 'inherit' }}>{a.criticality}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: scoreColor(a.score_pct) }}>
                      {a.score_pct}%
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--color-text-secondary)' }}>
                      {a.conforme}/{a.total_reqs}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right panel: Asset detail */}
        {selectedAssetId && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', minWidth: 0 }}>
            {/* Back button + asset info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={() => setSelectedAssetId(null)}
                style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: 'var(--color-text-primary)', fontSize: '13px' }}
              >
                ← Retour
              </button>
              {assetInfo && (
                <div>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                    {String(assetInfo.asset_name)}
                  </span>
                  {assetInfo.hostname ? (
                    <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginLeft: '8px' }}>
                      ({String(assetInfo.hostname)})
                    </span>
                  ) : null}
                </div>
              )}
            </div>

            {/* Score bar + summary */}
            {summary && (
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ fontSize: '32px', fontWeight: 800, color: scoreColor(Number(summary.score_pct)) }}>
                    {String(summary.score_pct)}%
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>Score conformité</div>
                </div>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <SummaryPill label="Conformes" value={Number(summary.conforme)} color="var(--color-success, #22c55e)" icon={CheckCircle} />
                  <SummaryPill label="En cours" value={Number(summary.en_cours)} color="var(--color-info, #3b82f6)" icon={Clock} />
                  <SummaryPill label="Non traitées" value={Number(summary.non_traitee)} color="var(--color-text-secondary)" icon={Clock} />
                  <SummaryPill label="Non conformes" value={Number(summary.non_conforme)} color="var(--color-danger, #ef4444)" icon={XCircle} />
                  <SummaryPill label="Non applicables" value={Number(summary.non_applicable)} color="var(--color-warning, #f59e0b)" icon={AlertTriangle} />
                </div>
              </div>
            )}

            {/* Action plan info */}
            {actionPlanInfo && (
              <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '12px 16px', border: '1px solid var(--color-border)', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', fontSize: '13px' }}>
                <Badge variant="info" size="sm">{String(actionPlanInfo.action_id)}</Badge>
                <span style={{ color: 'var(--color-text-secondary)' }}>Statut: <strong style={{ color: 'var(--color-text-primary)' }}>{String(actionPlanInfo.status).replace(/_/g, ' ')}</strong></span>
                <span style={{ color: 'var(--color-text-secondary)' }}>Progression: <strong style={{ color: 'var(--color-text-primary)' }}>{String(actionPlanInfo.progress)}%</strong></span>
                {actionPlanInfo.target_date && (
                  <span style={{ color: 'var(--color-text-secondary)' }}>Échéance: <strong style={{ color: 'var(--color-text-primary)' }}>{String(actionPlanInfo.target_date)}</strong></span>
                )}
              </div>
            )}

            {/* Filters */}
            <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '12px', border: '1px solid var(--color-border)', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
              <Filter size={14} style={{ color: 'var(--color-text-secondary)' }} />
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSelectStyle}>
                <option value="">Tous statuts</option>
                {COMPLIANCE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
              <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} style={filterSelectStyle}>
                <option value="">Tous acteurs</option>
                {uniqueActors.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
              <select value={criticalityFilter} onChange={e => setCriticalityFilter(e.target.value)} style={filterSelectStyle}>
                <option value="">Toutes criticités</option>
                <option value="Critique">Critique</option>
                <option value="Majeure">Majeure</option>
                <option value="Mineure">Mineure</option>
              </select>
              <input
                type="text"
                placeholder="Rechercher..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ ...filterSelectStyle, flexGrow: 1, maxWidth: '200px' }}
              />
              <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>
                {requirements.length} exigence(s)
              </span>
            </div>

            {/* Requirements table */}
            <div style={{ overflowX: 'auto' }}>
              {assetLoading ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
              ) : requirements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Aucune exigence pour ces filtres.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <th style={thStyle}>Ref</th>
                      <th style={thStyle}>Règle / Exigence</th>
                      <th style={thStyle}>Cible</th>
                      <th style={thStyle}>Livrable</th>
                      <th style={thStyle}>Acteur</th>
                      <th style={thStyle}>Criticité</th>
                      <th style={thStyle}>Catégorie</th>
                      <th style={thStyle}>Statut</th>
                      <th style={thStyle}>Source</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((r) => {
                      return (
                        <tr key={r.link_id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {r.ref_id || '—'}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--color-text-primary)', maxWidth: '350px' }}>
                            {r.rule.length > 200 ? r.rule.substring(0, 200) + '...' : r.rule}
                          </td>
                          <td style={{ padding: '8px', color: 'var(--color-text-secondary)', maxWidth: '150px' }}>
                            {r.target || '—'}
                          </td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {r.deliverable_name || (r.deliverable_type ? r.deliverable_type.replace(/_/g, ' ') : '—')}
                          </td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {r.actor ? r.actor.replace(/_/g, ' ') : '—'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            {r.criticality ? <Badge variant={criticalityBadgeVariant(r.criticality)} size="sm">{r.criticality}</Badge> : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                            {r.grc_category || '—'}
                          </td>
                          <td style={{ padding: '8px' }}>
                            <select
                              value={r.compliance_status}
                              onChange={e => updateLinkMutation.mutate({ linkId: r.link_id, data: { compliance_status: e.target.value } })}
                              style={{
                                fontSize: '12px',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                border: `1px solid var(--color-border)`,
                                background: 'var(--color-bg-primary)',
                                color: 'var(--color-text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              {COMPLIANCE_STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                            </select>
                          </td>
                          <td style={{ padding: '8px' }}>
                            <button
                              onClick={() => handleViewSource(r.requirement_id)}
                              title="Voir la source"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', display: 'inline-flex', alignItems: 'center' }}
                            >
                              <Eye size={16} />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Source Modal */}
      <Modal open={sourceModal.open} onClose={() => setSourceModal({ open: false, text: '', docName: '', loading: false, columnNames: [] })} title="Source de l'exigence" size="lg">
        {sourceModal.loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sourceModal.docName && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Document : <strong>{sourceModal.docName}</strong></div>
            )}
            <div style={{ background: 'var(--color-bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', maxHeight: '400px', overflowY: 'auto' }}>
              <MarkdownRenderer content={sourceModal.text} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// ── Helper components ──

const filterSelectStyle: React.CSSProperties = {
  padding: '4px 8px',
  fontSize: '13px',
  borderRadius: '6px',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-primary)',
  color: 'var(--color-text-primary)',
}

const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px',
  color: 'var(--color-text-secondary)',
  fontSize: '12px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

function KpiCard({ label, value, color, icon: Icon }: { label: string; value: string; color?: string; icon?: typeof Clock }) {
  return (
    <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
        {Icon && <Icon size={12} />} {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 800, color: color ?? 'var(--color-text-primary)' }}>
        {value}
      </div>
    </div>
  )
}

function SummaryPill({ label, value, color, icon: Icon }: { label: string; value: number; color: string; icon: typeof Clock }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border)' }}>
      <Icon size={14} style={{ color }} />
      <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>{label}:</span>
      <span style={{ fontSize: '14px', fontWeight: 700, color }}>{value}</span>
    </div>
  )
}