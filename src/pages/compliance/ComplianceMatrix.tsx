import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { grcBridgeApi, cmdbApi, policyDocumentsApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { Badge, Modal } from '../../components/ui'
import { Filter, Link2, Eye, Download } from 'lucide-react'

const GRC_CATEGORIES = ['Gouvernance', 'Technique', 'Physique', 'Resilience', 'Audit']
const DELIVERABLE_TYPES = [
  'Document_Cadre',
  'Charte_Contrat',
  'Registre_Inventaire',
  'Rapport_Audit',
  'Configuration_Securite',
  'Tache_Operationnelle',
]
const ACTORS = ['RSSI_Gouvernance', 'SecOps_CyberTech', 'Equipe_Infra_Ops', 'Directions_Metiers', 'RH_Juridique', 'Utilisateur_Final']
const CRITICALITIES = ['Mineure', 'Majeure', 'Critique']
const COMPLIANCE_STATUSES = ['Non_traitee', 'En_cours', 'Conforme', 'Non_conforme', 'Non_applicable']
const ENTRY_TYPES = ['requirement', 'information', 'definition']
const ENTRY_TYPE_LABELS: Record<string, string> = { requirement: 'Exigence', information: 'Information', definition: 'Definition' }
const ENTRY_TYPE_BADGE: Record<string, string> = { requirement: 'info', information: 'default', definition: 'warning' }

const statusBadgeVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'Conforme': return 'success'
    case 'En_cours': return 'info'
    case 'Non_conforme': return 'danger'
    case 'Non_applicable': return 'default'
    default: return 'warning'
  }
}

const criticalityBadgeVariant = (c: string): 'danger' | 'warning' | 'default' => {
  switch (c) {
    case 'Critique': return 'danger'
    case 'Majeure': return 'warning'
    default: return 'default'
  }
}

interface LinkedAsset {
  link_id: number
  asset_id: number
  asset_name: string
  compliance_status: string
  proof_url: string | null
  link_type: string
}

interface MatrixItem {
  id: number
  document_id: number
  page_number: number | null
  ref_id: string
  rule: string
  target: string
  control_type: string | null
  grc_category: string
  deliverable_type: string | null
  deliverable_id: number | null
  deliverable_name: string | null
  actor: string
  control_frequency: string | null
  criticality: string
  compliance_status: string
  entry_type: string
  asset_tag: string | null
  linked_assets: LinkedAsset[]
}

export default function ComplianceMatrix() {
  const { toast } = useToast()
  const qc = useQueryClient()

  const [filters, setFilters] = useState<Record<string, string | undefined>>({})
  const [search, setSearch] = useState('')
  const [linkModal, setLinkModal] = useState<{ open: boolean; requirementId: number; requirementRef: string } | null>(null)
  const [selectedAsset, setSelectedAsset] = useState<string>('')
  const [sourceModal, setSourceModal] = useState<{ open: boolean; requirementId: number | null; text: string; docName: string; loading: boolean }>({ open: false, requirementId: null, text: '', docName: '', loading: false })
  const [statusEditing, setStatusEditing] = useState<{ linkId: number; currentStatus: string } | null>(null)

  // Fetch documents for filter
  const { data: documentsData } = useQuery({
    queryKey: ['grcDocuments'],
    queryFn: () => policyDocumentsApi.list().then(r => r.data as Record<string, unknown>),
  })
  const documents = useMemo(() => {
    const items = (documentsData?.items ?? documentsData ?? []) as Record<string, unknown>[]
    return Array.isArray(items) ? items : []
  }, [documentsData])

  // Fetch matrix data
  const queryParams = useMemo(() => {
    const p: Record<string, string | number> = {}
    if (filters.document_id) p.document_id = filters.document_id
    if (filters.grc_category) p.grc_category = filters.grc_category
    if (filters.deliverable_type) p.deliverable_type = filters.deliverable_type
    if (filters.actor) p.actor = filters.actor
    if (filters.criticality) p.criticality = filters.criticality
    if (filters.compliance_status) p.compliance_status = filters.compliance_status
    if (filters.entry_type) p.entry_type = filters.entry_type
    if (filters.has_asset === 'true') p.has_asset = 'true'
    if (filters.has_asset === 'false') p.has_asset = 'false'
    if (filters.asset_id) p.asset_id = filters.asset_id
    if (search) p.search = search
    p.limit = 100
    p.offset = 0
    return p
  }, [filters, search])

  const { data: matrixData, isLoading } = useQuery({
    queryKey: ['grcMatrix', queryParams],
    queryFn: () => grcBridgeApi.matrix(queryParams).then(r => r.data as Record<string, unknown>),
  })

  const items = ((matrixData?.items ?? []) as MatrixItem[]).map(item => ({
    ...item,
    linked_assets: (item.linked_assets ?? []) as LinkedAsset[],
  }))
  const total = Number(matrixData?.total ?? 0)

  // Fetch CMDB assets for association modal
  const { data: cmdbData } = useQuery({
    queryKey: ['cmdbAssets'],
    queryFn: () => cmdbApi.list().then(r => r.data as Record<string, unknown>),
    enabled: linkModal !== null,
  })
  const cmdbAssets = useMemo(() => {
    const a = (cmdbData?.items ?? cmdbData ?? []) as Record<string, unknown>[]
    return Array.isArray(a) ? a : []
  }, [cmdbData])

  // Create link mutation
  const createLinkMutation = useMutation({
    mutationFn: (data: { asset_id: number; requirement_id: number; link_type?: string }) => grcBridgeApi.createLink(data),
    onSuccess: () => {
      toast('success', 'Asset associe avec succes')
      setLinkModal(null)
      setSelectedAsset('')
      qc.invalidateQueries({ queryKey: ['grcMatrix'] })
    },
    onError: () => toast('error', 'Erreur lors de l\'association'),
  })

  // Update link mutation
  const updateLinkMutation = useMutation({
    mutationFn: ({ linkId, data }: { linkId: number; data: Record<string, unknown> }) => grcBridgeApi.updateLink(linkId, data),
    onSuccess: () => {
      toast('success', 'Statut mis a jour')
      setStatusEditing(null)
      qc.invalidateQueries({ queryKey: ['grcMatrix'] })
    },
    onError: () => toast('error', 'Erreur lors de la mise a jour'),
  })

  // Source modal
  const handleViewSource = async (requirementId: number) => {
    setSourceModal({ open: true, requirementId, text: '', docName: '', loading: true })
    try {
      const res = await grcBridgeApi.source(requirementId)
      const data = res.data as Record<string, unknown>
      setSourceModal({ open: true, requirementId, text: String(data.source_text ?? ''), docName: String(data.document_name ?? ''), loading: false })
    } catch {
      setSourceModal({ open: true, requirementId, text: 'Erreur lors du chargement', docName: '', loading: false })
    }
  }

  const handleAssociateAsset = () => {
    if (!linkModal || !selectedAsset) return
    createLinkMutation.mutate({ asset_id: Number(selectedAsset), requirement_id: linkModal.requirementId })
  }

  const cleanFilters = () => {
    setFilters({})
    setSearch('')
  }

  const hasActiveFilters = Object.values(filters).some(v => v != null && v !== '') || search !== ''

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
        Matrice de Conformite
      </h1>

      {/* Filters */}
      <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '12px', padding: '16px', border: '1px solid var(--color-border)', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Filter size={16} style={{ color: 'var(--color-text-secondary)' }} />
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', outline: 'none', width: '200px' }}
        />
        <select value={filters.document_id || ''} onChange={e => setFilters(f => ({ ...f, document_id: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous les documents</option>
          {documents.map((d: Record<string, unknown>) => <option key={String(d.id)} value={String(d.id)}>{String(d.name ?? d.filename ?? d.id)}</option>)}
        </select>
        <select value={filters.grc_category || ''} onChange={e => setFilters(f => ({ ...f, grc_category: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Toutes categories GRC</option>
          {GRC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.deliverable_type || ''} onChange={e => setFilters(f => ({ ...f, deliverable_type: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous livrables</option>
          {DELIVERABLE_TYPES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.actor || ''} onChange={e => setFilters(f => ({ ...f, actor: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous acteurs</option>
          {ACTORS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.criticality || ''} onChange={e => setFilters(f => ({ ...f, criticality: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Toutes criticites</option>
          {CRITICALITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.compliance_status || ''} onChange={e => setFilters(f => ({ ...f, compliance_status: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous statuts</option>
          {COMPLIANCE_STATUSES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.entry_type || ''} onChange={e => setFilters(f => ({ ...f, entry_type: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous types</option>
          {ENTRY_TYPES.map(t => <option key={t} value={t}>{ENTRY_TYPE_LABELS[t]}</option>)}
        </select>
        <select value={filters.has_asset !== undefined ? (filters.has_asset === 'true' ? 'with_asset' : 'without_asset') : (filters.asset_id || '')} onChange={e => {
          const v = e.target.value
          if (v === 'with_asset') setFilters(f => ({ ...f, has_asset: 'true', asset_id: undefined }))
          else if (v === 'without_asset') setFilters(f => ({ ...f, has_asset: 'false', asset_id: undefined }))
          else if (v === '') setFilters(f => ({ ...f, has_asset: undefined, asset_id: undefined }))
          else setFilters(f => ({ ...f, has_asset: undefined, asset_id: v }))
        }} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous (avec et sans CI)</option>
          <option value="with_asset">Avec CI associé</option>
          <option value="without_asset">Sans CI associé</option>
          {cmdbAssets.length > 0 && (
            <optgroup label="CI spécifique">
              {cmdbAssets.map(a => <option key={String(a.id)} value={String(a.id)}>{String(a.asset_name ?? a.hostname ?? '')}</option>)}
            </optgroup>
          )}
        </select>
        {hasActiveFilters && (
          <button onClick={cleanFilters} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Reset</button>
        )}
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>{String(total)} exigences</span>
        <button onClick={() => {
          grcBridgeApi.exportMatrix(filters.entry_type ? { ...queryParams, entry_type: filters.entry_type } : queryParams).then(r => {
            const url = window.URL.createObjectURL(new Blob([r.data]))
            const a = document.createElement('a')
            a.href = url
            a.download = 'matrice_conformite.csv'
            a.click()
            window.URL.revokeObjectURL(url)
          }).catch(() => toast('error', 'Erreur export'))
        }} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '14px', borderRadius: '6px', fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)' }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Aucune exigence trouvee.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Ref</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Type</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Regle / Exigence</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Cible</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>GRC</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Livrable</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Acteur</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Criticite</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Statut</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Asset CMDB</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Source</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const primaryAsset = item.linked_assets.length > 0 ? item.linked_assets[0] : null
                return (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(item.ref_id || '—')}</td>
                    <td style={{ padding: '8px' }}><Badge variant={ENTRY_TYPE_BADGE[item.entry_type] as 'info' | 'default' | 'warning' || 'default'} size="sm">{ENTRY_TYPE_LABELS[item.entry_type] || item.entry_type}</Badge></td>
                    <td style={{ padding: '8px', color: 'var(--color-text-primary)', maxWidth: '300px' }}>
                      {String(item.rule || '').length > 200 ? String(item.rule).substring(0, 200) + '...' : String(item.rule || '')}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{String(item.target || '—')}</td>
                    <td style={{ padding: '8px' }}><Badge variant={statusBadgeVariant(item.grc_category === 'Gouvernance' ? 'info' : item.grc_category === 'Technique' ? 'warning' : 'default')} size="sm">{String(item.grc_category || '—')}</Badge></td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>{String(item.deliverable_name || (item.deliverable_type ? item.deliverable_type.replace(/_/g, ' ') : '—'))}</td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>{String(item.actor || '—').replace(/_/g, ' ')}</td>
                    <td style={{ padding: '8px' }}>
                      {item.criticality ? <Badge variant={criticalityBadgeVariant(String(item.criticality))} size="sm">{String(item.criticality)}</Badge> : <span style={{ color: 'var(--color-text-secondary)' }}>—</span>}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {primaryAsset && statusEditing && statusEditing.linkId === primaryAsset.link_id ? (
                        <select
                          value={statusEditing.currentStatus}
                          onChange={e => setStatusEditing({ ...statusEditing, currentStatus: e.target.value })}
                          onBlur={() => {
                            updateLinkMutation.mutate({ linkId: statusEditing.linkId, data: { compliance_status: statusEditing.currentStatus } })
                          }}
                          style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
                        >
                          {COMPLIANCE_STATUSES.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                        </select>
                      ) : (
                        <span
                          onClick={() => {
                            if (primaryAsset) {
                              setStatusEditing({ linkId: primaryAsset.link_id, currentStatus: primaryAsset.compliance_status })
                            }
                          }}
                          style={{ cursor: primaryAsset ? 'pointer' : 'default' }}
                        >
                          <Badge variant={statusBadgeVariant(String(primaryAsset?.compliance_status ?? item.compliance_status ?? 'Non_traitee'))} size="sm">
                            {String(primaryAsset?.compliance_status ?? item.compliance_status ?? 'Non_traitee').replace(/_/g, ' ')}
                          </Badge>
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      {primaryAsset ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--color-accent)', fontSize: '12px', cursor: 'pointer' }} onClick={() => setStatusEditing({ linkId: primaryAsset.link_id, currentStatus: primaryAsset.compliance_status })}>
                          <Link2 size={12} />
                          {String(primaryAsset.asset_name)}
                        </span>
                      ) : (
                        <button
                          onClick={() => setLinkModal({ open: true, requirementId: item.id, requirementRef: item.ref_id })}
                          style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--color-accent)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                        >
                          Associer Asset
                        </button>
                      )}
                    </td>
                    <td style={{ padding: '8px' }}>
                      <button
                        onClick={() => handleViewSource(item.id)}
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

      {/* Associate Asset Modal */}
      <Modal open={linkModal !== null} onClose={() => { setLinkModal(null); setSelectedAsset('') }} title={`Associer un asset — ${linkModal?.requirementRef ?? ''}`} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <select
            value={selectedAsset}
            onChange={e => setSelectedAsset(e.target.value)}
            style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
          >
            <option value="">Selectionner un asset CMDB</option>
            {cmdbAssets.map((a: Record<string, unknown>) => (
              <option key={String(a.id)} value={String(a.id)}>{String(a.name ?? a.hostname ?? `Asset #${a.id}`)}</option>
            ))}
          </select>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => { setLinkModal(null); setSelectedAsset('') }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={handleAssociateAsset} disabled={!selectedAsset || createLinkMutation.isPending} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: selectedAsset ? 'pointer' : 'not-allowed', opacity: selectedAsset ? 1 : 0.5 }}>
              Associer
            </button>
          </div>
        </div>
      </Modal>

      {/* Source Modal */}
      <Modal open={sourceModal.open} onClose={() => setSourceModal({ open: false, requirementId: null, text: '', docName: '', loading: false })} title="Source de l'exigence" size="lg">
        {sourceModal.loading ? (
          <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sourceModal.docName && (
              <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Document : <strong>{sourceModal.docName}</strong></div>
            )}
            <pre style={{ background: 'var(--color-bg-primary)', padding: '16px', borderRadius: '8px', border: '1px solid var(--color-border)', whiteSpace: 'pre-wrap', fontSize: '13px', color: 'var(--color-text-primary)', maxHeight: '400px', overflowY: 'auto' }}>
              {sourceModal.text}
            </pre>
          </div>
        )}
      </Modal>
    </div>
  )
}