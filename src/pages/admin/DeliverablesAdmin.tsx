import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { grcBridgeApi, businessServicesApi } from '../../api'
import { Badge, Button, Modal, Select } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { Plus, Trash2, Edit2, Link2 } from 'lucide-react'

const DRIVERS = ['Stratégie & Alignement', 'Cadre & Organisation', 'Conformité & Sécurité', 'Pilotage & Performance']
const FRAMEWORKS = ['ANSSI', 'RGPD', 'NIS2', 'DORA', 'ISO27001', 'Interne', 'NIST', 'PCI-DSS', 'HIPAA', 'SOC2', 'CIS', 'ISO22301']
const OBLIGATION_LEVELS = ['obligatoire', 'recommande', 'envisionne']
const CLASSIFICATION_LEVELS = ['public', 'interne', 'confidentiel', 'secret']
const PYRAMID_LEVELS = [{ label: 'Politique', value: 1 }, { label: 'Processus', value: 2 }, { label: 'Procédure', value: 3 }]

interface Deliverable {
  id: number
  deliverable_name: string
  description: string
  driver: string
  sub_category: string
  pyramid_level: number
  realization_role: string
  verification_role: string
  validation_role: string
  regulatory_framework: string
  obligation_level: string
  classification_level: string
  service_id: number | null
  is_active: boolean
}

export function DeliverablesAdmin() {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [filterFramework, setFilterFramework] = useState('')
  const [filterDriver, setFilterDriver] = useState('')
  const [filterActive, setFilterActive] = useState('')
  const [search, setSearch] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Partial<Deliverable>>({
    deliverable_name: '',
    driver: 'Conformité & Sécurité',
    sub_category: '',
    regulatory_framework: 'ANSSI',
    pyramid_level: 1,
    realization_role: '',
    verification_role: '',
    validation_role: '',
    obligation_level: 'recommande',
    classification_level: 'interne',
    description: '',
    is_active: false,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['deliverables-admin', filterFramework, filterActive],
    queryFn: () => grcBridgeApi.deliverables({
      ...(filterFramework ? { framework: filterFramework } : {}),
      active_only: filterActive === 'active' ? 'true' : filterActive === 'inactive' ? 'false' : 'false',
    }).then(r => r.data),
  })

  // Référentiel des services (select "Service porteur")
  const { data: servicesData } = useQuery({
    queryKey: ['business-services'],
    queryFn: () => businessServicesApi.list().then(r => r.data),
  })
  const services: any[] = servicesData?.items || []

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => grcBridgeApi.createDeliverable(data),
    onSuccess: () => { toast('success', 'Livrable créé'); queryClient.invalidateQueries({ queryKey: ['deliverables-admin'] }); setShowEdit(false) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => grcBridgeApi.updateDeliverable(id, data),
    onSuccess: () => { toast('success', 'Livrable mis à jour'); queryClient.invalidateQueries({ queryKey: ['deliverables-admin'] }); setShowEdit(false) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => grcBridgeApi.deleteDeliverable(id),
    onSuccess: () => { toast('success', 'Livrable supprimé'); queryClient.invalidateQueries({ queryKey: ['deliverables-admin'] }); setDeleteId(null) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: number; active: boolean }) => grcBridgeApi.updateDeliverable(id, { is_active: active }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['deliverables-admin'] }),
  })

  const relinkMutation = useMutation({
    mutationFn: () => grcBridgeApi.relinkOrphans(),
    onSuccess: (res: any) => {
      const linked = res?.data?.linked || 0
      toast('success', `${linked} exigence(s) re-rattachée(s)`)
    },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })

  const items: Deliverable[] = (data?.items || []) as Deliverable[]
  const filtered = items.filter(d => {
    if (filterDriver && d.driver !== filterDriver) return false
    if (search && !d.deliverable_name.toLowerCase().includes(search.toLowerCase()) && !d.sub_category.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const openCreate = () => {
    setEditingId(null)
    setForm({ deliverable_name: '', driver: 'Conformité & Sécurité', sub_category: '', regulatory_framework: 'ANSSI', pyramid_level: 1, realization_role: '', verification_role: '', validation_role: '', obligation_level: 'recommande', classification_level: 'interne', description: '', is_active: false })
    setShowEdit(true)
  }

  const openEdit = (d: Deliverable) => {
    setEditingId(d.id)
    setForm({ ...d })
    setShowEdit(true)
  }

  const handleSave = () => {
    if (!form.deliverable_name?.trim() || !form.driver || !form.sub_category || !form.regulatory_framework) {
      toast('error', 'Nom, moteur, sous-catégorie et framework sont obligatoires')
      return
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: form })
    } else {
      createMutation.mutate(form)
    }
  }

  const inputStyle: React.CSSProperties = {
    padding: '6px 10px', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)',
    borderRadius: '4px', color: 'var(--color-text-primary)', fontSize: '13px', width: '100%',
  }
  const labelStyle: React.CSSProperties = { fontSize: '12px', fontWeight: 600, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Livrables de Gouvernance</h1>
        <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>Nouveau livrable</Button>
        <Button
          variant="secondary"
          icon={<Link2 size={16} />}
          onClick={() => relinkMutation.mutate()}
          disabled={relinkMutation.isPending}
        >
          {relinkMutation.isPending ? 'Rattachement...' : 'Re-rattacher les exigences'}
        </Button>
      </div>

      <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
        Gestion du catalogue des livrables de gouvernance SI. {items.length} livrables au total.
      </p>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }} className="filter-bar">
        <div style={{ minWidth: '200px' }}>
          <input type="text" placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
            style={inputStyle} />
        </div>
        <Select value={filterFramework} onChange={v => setFilterFramework(v)}
          options={[{ label: 'Tous frameworks', value: '' }, ...FRAMEWORKS.map(f => ({ label: f, value: f }))]} />
        <Select value={filterDriver} onChange={v => setFilterDriver(v)}
          options={[{ label: 'Tous moteurs', value: '' }, ...DRIVERS.map(d => ({ label: d, value: d }))]} />
        <Select value={filterActive} onChange={v => setFilterActive(v)}
          options={[{ label: 'Tous statuts', value: '' }, { label: 'Actifs', value: 'active' }, { label: 'Inactifs', value: 'inactive' }]} />
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--color-text-secondary)' }}>Aucun livrable</div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border)' }} className="table-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Livrable</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Framework</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Moteur</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Sous-cat.</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Niv.</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Pilote</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Obligation</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Classif.</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Actif</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '11px', textTransform: 'uppercase', color: 'var(--color-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{d.deliverable_name}</td>
                  <td style={{ padding: '10px 12px' }}><Badge variant="info">{d.regulatory_framework}</Badge></td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.driver}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: 'var(--color-text-secondary)' }}>{d.sub_category}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px' }}>{PYRAMID_LEVELS.find(p => p.value === d.pyramid_level)?.label || `N${d.pyramid_level}`}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px' }}>{d.realization_role || '—'}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge variant={d.obligation_level === 'obligatoire' ? 'danger' : d.obligation_level === 'recommande' ? 'warning' : 'default'}>{d.obligation_level}</Badge></td>
                  <td style={{ padding: '10px 12px', textAlign: 'center', fontSize: '12px' }}>{d.classification_level}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button onClick={() => toggleActiveMutation.mutate({ id: d.id, active: !d.is_active })}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
                      title={d.is_active ? 'Désactiver' : 'Activer'}>
                      <div style={{ width: '36px', height: '20px', borderRadius: '10px', background: d.is_active ? 'var(--color-success)' : 'var(--color-border)', position: 'relative', transition: 'all 0.2s' }}>
                        <div style={{ position: 'absolute', top: '2px', left: d.is_active ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#fff', transition: 'all 0.2s' }} />
                      </div>
                    </button>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button onClick={() => openEdit(d)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '4px' }} title="Modifier"><Edit2 size={14} /></button>
                      <button onClick={() => setDeleteId(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px' }} title="Supprimer"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Create Modal */}
      {showEdit && (
        <Modal open={showEdit} onClose={() => setShowEdit(false)} title={editingId ? 'Modifier le livrable' : 'Nouveau livrable'} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={labelStyle}>Nom du livrable *</label>
              <input style={inputStyle} value={form.deliverable_name || ''} onChange={e => setForm({ ...form, deliverable_name: e.target.value })} placeholder="ex: Politique de Sécurité (PSSI)" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Framework *</label>
                <Select value={form.regulatory_framework || ''} onChange={v => setForm({ ...form, regulatory_framework: v })}
                  options={FRAMEWORKS.map(f => ({ label: f, value: f }))} />
              </div>
              <div>
                <label style={labelStyle}>Moteur *</label>
                <Select value={form.driver || ''} onChange={v => setForm({ ...form, driver: v })}
                  options={DRIVERS.map(d => ({ label: d, value: d }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Sous-catégorie *</label>
                <input style={inputStyle} value={form.sub_category || ''} onChange={e => setForm({ ...form, sub_category: e.target.value })} placeholder="ex: Sécurité (SSI)" />
              </div>
              <div>
                <label style={labelStyle}>Niveau pyramide</label>
                <Select value={String(form.pyramid_level || 1)} onChange={v => setForm({ ...form, pyramid_level: parseInt(v) })}
                  options={PYRAMID_LEVELS.map(p => ({ label: p.label, value: String(p.value) }))} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Pilote (Réalisation)</label>
                <input style={inputStyle} value={form.realization_role || ''} onChange={e => setForm({ ...form, realization_role: e.target.value })} placeholder="ex: RSSI" />
              </div>
              <div>
                <label style={labelStyle}>Vérification</label>
                <input style={inputStyle} value={form.verification_role || ''} onChange={e => setForm({ ...form, verification_role: e.target.value })} placeholder="ex: DSI" />
              </div>
              <div>
                <label style={labelStyle}>Validation</label>
                <input style={inputStyle} value={form.validation_role || ''} onChange={e => setForm({ ...form, validation_role: e.target.value })} placeholder="ex: DG" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Obligation</label>
                <Select value={form.obligation_level || 'recommande'} onChange={v => setForm({ ...form, obligation_level: v })}
                  options={OBLIGATION_LEVELS.map(o => ({ label: o, value: o }))} />
              </div>
              <div>
                <label style={labelStyle}>Classification</label>
                <Select value={form.classification_level || 'interne'} onChange={v => setForm({ ...form, classification_level: v })}
                  options={CLASSIFICATION_LEVELS.map(c => ({ label: c, value: c }))} />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Service porteur (périmètre de lecture des membres du service)</label>
              <Select
                value={form.service_id ? String(form.service_id) : ''}
                onChange={v => setForm({ ...form, service_id: v ? parseInt(v) : null })}
                options={[{ label: '— Aucun (visible rôles forts uniquement)', value: '' },
                  ...services.map((s: any) => ({ label: s.name, value: String(s.id) }))]} />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea style={{ ...inputStyle, minHeight: '60px', resize: 'vertical' }} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Description du livrable..." />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
              <input type="checkbox" checked={form.is_active || false} onChange={e => setForm({ ...form, is_active: e.target.checked })} />
              Actif (visible dans le Plan d'Action et la Documentation)
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <Button variant="secondary" onClick={() => setShowEdit(false)}>Annuler</Button>
              <Button variant="primary" onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? '...' : editingId ? 'Mettre à jour' : 'Créer'}
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleteId !== null && (
        <Modal open={deleteId !== null} onClose={() => setDeleteId(null)} title="Supprimer le livrable" size="sm">
          <p style={{ fontSize: '14px', color: 'var(--color-text-primary)', marginBottom: '16px' }}>
            Êtes-vous sûr de vouloir supprimer ce livrable ? Les exigences associées seront détachées (deliverable_id = NULL) et les actions de gouvernance liées seront supprimées.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setDeleteId(null)}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? '...' : 'Supprimer'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}