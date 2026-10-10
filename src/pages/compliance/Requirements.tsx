import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { requirementsApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { ContextInfoIcon } from '../../components/ui/ContextInfoIcon'
import { usePermissions } from '../../hooks/usePermissions'
import { Download, Filter } from 'lucide-react'

const GRC_CATEGORIES = ['Gouvernance', 'Technique', 'Physique', 'Resilience', 'Audit']
const DELIVERABLE_TYPES = ['Document_Cadre', 'Charte_Contrat', 'Registre_Inventaire', 'Rapport_Audit', 'Configuration_Securite', 'Tache_Operationnelle']
const ACTORS = ['RSSI_Gouvernance', 'SecOps_CyberTech', 'Equipe_Infra_Ops', 'Directions_Metiers', 'RH_Juridique', 'Utilisateur_Final']
const CRITICALITIES = ['Mineure', 'Majeure', 'Critique']
const FREQUENCIES = ['Ponctuel', 'Continu', 'Hebdomadaire', 'Mensuel', 'Trimestriel', 'Semestriel', 'Annuel', 'Au_changement']
const COMPLIANCE_STATUSES = ['Non_traitee', 'En_cours', 'Conforme', 'Non_conforme', 'Non_applicable']

const statusBadgeVariant = (s: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  switch (s) {
    case 'Conforme': return 'success'
    case 'En_cours': return 'info'
    case 'Non_conforme': return 'danger'
    case 'Non_applicable': return 'default'
    default: return 'warning'
  }
}

const criticalityVariant = (c: string): 'danger' | 'warning' | 'default' => {
  switch (c) {
    case 'Critique': return 'danger'
    case 'Majeure': return 'warning'
    default: return 'default'
  }
}

export default function RequirementsPage() {
  const { toast } = useToast()
  const { isAdmin, isRssi } = usePermissions()
  const qc = useQueryClient()
  const canEdit = isAdmin || isRssi

  const [filters, setFilters] = useState<Record<string, string | undefined>>({})
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string | undefined>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['requirements', filters, search],
    queryFn: () => requirementsApi.list(Object.fromEntries(Object.entries({ ...filters, search: search || undefined }).filter(([, v]) => v != null)) as Record<string, string | number>).then(r => r.data as Record<string, unknown>),
  })

  const { data: stats } = useQuery({
    queryKey: ['requirements-stats'],
    queryFn: () => requirementsApi.stats().then(r => r.data as Record<string, unknown>),
  })

  // Filter out undefined values for API calls
  const cleanFilters = Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== '')) as Record<string, string>

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => requirementsApi.update(id, data),
    onSuccess: () => {
      toast('success', 'Exigence mise a jour')
      setEditingId(null)
      qc.invalidateQueries({ queryKey: ['requirements'] })
      qc.invalidateQueries({ queryKey: ['requirements-stats'] })
    },
    onError: () => toast('error', 'Erreur'),
  })

  const handleExport = () => {
    requirementsApi.export(cleanFilters).then(r => {
      const url = window.URL.createObjectURL(new Blob([r.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = 'exigences_referentiels.csv'
      a.click()
      window.URL.revokeObjectURL(url)
    }).catch(() => toast('error', 'Erreur export'))
  }

  const items = (data?.items as Record<string, unknown>[]) || []
  const total = Number(data?.total ?? 0)
  const s = stats as Record<string, unknown> | undefined

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Exigences Referentiels
        </h1>
        <button onClick={handleExport} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', background: 'transparent', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', fontSize: '14px' }}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Stats cards */}
      {s && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
          <div style={{ background: 'var(--color-bg-secondary)', borderRadius: '8px', padding: '12px', border: '1px solid var(--color-border)' }}>
            <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>Total</div>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{Number(s.total ?? 0)}</div>
          </div>
          {Object.entries(s.by_grc || {}).map(([cat, count]) => (
            <div key={cat} style={{ background: 'var(--color-bg-secondary)', borderRadius: '8px', padding: '12px', border: '1px solid var(--color-border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>{cat}</div>
              <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-accent)' }}>{Number(count)}</div>
            </div>
          ))}
        </div>
      )}

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
        <select value={filters.grc_category || ''} onChange={e => setFilters(f => ({ ...f, grc_category: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Toutes categories GRC</option>
          {GRC_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.deliverable_type || ''} onChange={e => setFilters(f => ({ ...f, deliverable_type: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous livrables</option>
          {DELIVERABLE_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.actor || ''} onChange={e => setFilters(f => ({ ...f, actor: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous acteurs</option>
          {ACTORS.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.control_frequency || ''} onChange={e => setFilters(f => ({ ...f, control_frequency: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Toutes fréquences</option>
          {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filters.criticality || ''} onChange={e => setFilters(f => ({ ...f, criticality: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Toutes criticites</option>
          {CRITICALITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filters.compliance_status || ''} onChange={e => setFilters(f => ({ ...f, compliance_status: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous statuts</option>
          {COMPLIANCE_STATUSES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={filters.regulatory_framework || ''} onChange={e => setFilters(f => ({ ...f, regulatory_framework: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Tous cadres</option>
          <option value="ANSSI">ANSSI</option>
          <option value="NIS2">NIS2</option>
          <option value="RGPD">RGPD</option>
          <option value="DORA">DORA</option>
          <option value="ISO27001">ISO 27001</option>
        </select>
        <select value={filters.destination || ''} onChange={e => setFilters(f => ({ ...f, destination: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Toutes destinations</option>
          <option value="livrable">Livrable</option>
          <option value="institutionnel">Institutionnel</option>
          <option value="technique">Technique</option>
          <option value="pratique">Pratique</option>
          <option value="audit_transverse">Audit transverse</option>
        </select>
        <select value={filters.target_status || ''} onChange={e => setFilters(f => ({ ...f, target_status: e.target.value || undefined }))} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
          <option value="">Toutes cibles</option>
          <option value="unresolved">⚠ Techniques sans asset (file CMDB)</option>
        </select>
        {(Object.keys(filters).length > 0 || search) && (
          <button onClick={() => { setFilters({}); setSearch('') }} style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Reset</button>
        )}
        <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginLeft: 'auto' }}>{total} exigences</span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Aucune exigence. Integrez les exigences depuis un referentiel analyse.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Document</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Ref</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Regle / Exigence</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Cible</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>GRC</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Livrable</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Acteur</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Freq.</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Crit.</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Asset</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Statut</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => {
                const reqId = Number(item.id)
                const isEditing = editingId === reqId
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--color-border)', cursor: canEdit ? 'pointer' : 'default' }} onClick={canEdit && !isEditing ? () => { setEditingId(reqId); setEditValues({ control_frequency: String(item.control_frequency ?? ''), criticality: String(item.criticality ?? ''), asset_tag: String(item.asset_tag ?? ''), compliance_status: String(item.compliance_status ?? 'Non_traitee') }) } : undefined}>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{String(item.document_name || '')}</td>
                    <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(item.ref_id || '—')}</td>
                    <td style={{ padding: '8px', color: 'var(--color-text-primary)', maxWidth: '300px' }}>
                      {String(item.rule || '')}
                      {item.entry_type === 'requirement' && <ContextInfoIcon reqId={reqId} />}
                    </td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{String(item.target || '—')}</td>
                    <td style={{ padding: '8px' }}><span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)', color: 'var(--color-accent)' }}>{String(item.grc_category || '—')}</span></td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>{String(item.deliverable_name || (item.deliverable_type ? String(item.deliverable_type as string).replace(/_/g, ' ') : '—'))}</td>
                    <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>{String(item.actor || '—').replace(/_/g, ' ')}</td>
                    {isEditing ? (
                      <>
                        <td style={{ padding: '4px' }}>
                          <select value={editValues.control_frequency} onChange={e => setEditValues(v => ({ ...v, control_frequency: e.target.value }))} style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
                            <option value="">—</option>
                            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '4px' }}>
                          <select value={editValues.criticality} onChange={e => setEditValues(v => ({ ...v, criticality: e.target.value }))} style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
                            <option value="">—</option>
                            {CRITICALITIES.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '4px' }}>
                          <input type="text" value={editValues.asset_tag} onChange={e => setEditValues(v => ({ ...v, asset_tag: e.target.value }))} placeholder="Tag CMDB" style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', width: '100px' }} />
                        </td>
                        <td style={{ padding: '4px' }}>
                          <select value={editValues.compliance_status} onChange={e => setEditValues(v => ({ ...v, compliance_status: e.target.value }))} style={{ fontSize: '12px', padding: '2px 4px', borderRadius: '4px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}>
                            {COMPLIANCE_STATUSES.map(c => <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '4px' }}>
                          <button onClick={(e) => { e.stopPropagation(); updateMutation.mutate({ id: reqId, data: editValues }) }} style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--color-bg-hover)', color: 'var(--color-text-primary)', border: '1px solid var(--color-accent)', borderRadius: '4px', cursor: 'pointer' }}>OK</button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingId(null) }} style={{ fontSize: '11px', padding: '2px 8px', marginLeft: '4px', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', border: '1px solid var(--color-border)', borderRadius: '4px', cursor: 'pointer' }}>X</button>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>{String(item.control_frequency || '—').replace(/_/g, ' ')}</td>
                        <td style={{ padding: '8px' }}>{item.criticality ? <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', background: criticalityVariant(String(item.criticality)) === 'danger' ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)' : criticalityVariant(String(item.criticality)) === 'warning' ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)' : 'var(--color-bg-secondary)', color: criticalityVariant(String(item.criticality)) === 'danger' ? 'var(--color-danger)' : criticalityVariant(String(item.criticality)) === 'warning' ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>{String(item.criticality)}</span> : '—'}</td>
                        <td style={{ padding: '8px', color: 'var(--color-text-secondary)', fontSize: '11px' }}>{String(item.asset_tag || '—')}</td>
                        <td style={{ padding: '8px' }}><span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '9999px', background: statusBadgeVariant(String(item.compliance_status)) === 'success' ? 'color-mix(in srgb, var(--color-success) 15%, transparent)' : statusBadgeVariant(String(item.compliance_status)) === 'danger' ? 'color-mix(in srgb, var(--color-danger) 15%, transparent)' : statusBadgeVariant(String(item.compliance_status)) === 'info' ? 'color-mix(in srgb, var(--color-info) 15%, transparent)' : statusBadgeVariant(String(item.compliance_status)) === 'warning' ? 'color-mix(in srgb, var(--color-warning) 15%, transparent)' : 'var(--color-bg-secondary)', color: statusBadgeVariant(String(item.compliance_status)) === 'success' ? 'var(--color-success)' : statusBadgeVariant(String(item.compliance_status)) === 'danger' ? 'var(--color-danger)' : statusBadgeVariant(String(item.compliance_status)) === 'info' ? 'var(--color-info)' : 'var(--color-text-secondary)' }}>{String(item.compliance_status || 'Non_traitee').replace(/_/g, ' ')}</span></td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}