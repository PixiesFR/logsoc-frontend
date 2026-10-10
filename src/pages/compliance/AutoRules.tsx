import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { grcBridgeApi } from '../../api'
import { useToast } from '../../components/ui/Toast'
import { Badge, Modal } from '../../components/ui'
import { Settings, Plus, Pencil, Trash2 } from 'lucide-react'

const MATCH_FIELDS = ['asset_type', 'device_type', 'environment', 'criticality', 'tier_level', 'network_zone', 'responsable_team', 'hostname', 'asset_name']
const MATCH_OPERATORS = ['equals', 'contains', 'starts_with', 'ends_with', 'regex', 'in']

interface AutoRule {
  id: number
  name: string
  match_field: string
  match_operator: string
  match_value: string
  requirement_filters: Record<string, unknown> | null
  auto_assign: boolean
}

interface RuleFormData {
  name: string
  match_field: string
  match_operator: string
  match_value: string
  requirement_filters: string
  auto_assign: boolean
}

const defaultForm: RuleFormData = {
  name: '',
  match_field: 'asset_type',
  match_operator: 'equals',
  match_value: '',
  requirement_filters: '{}',
  auto_assign: true,
}

export default function AutoRulesPage() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<RuleFormData>({ ...defaultForm })
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['grcRules'],
    queryFn: () => grcBridgeApi.listRules().then(r => r.data as Record<string, unknown>),
  })

  const rules = ((data?.items ?? data ?? []) as AutoRule[])

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => grcBridgeApi.createRule(data),
    onSuccess: () => {
      toast('success', 'Regle creee avec succes')
      setShowModal(false)
      setForm({ ...defaultForm })
      qc.invalidateQueries({ queryKey: ['grcRules'] })
    },
    onError: () => toast('error', 'Erreur lors de la creation'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => grcBridgeApi.updateRule(id, data),
    onSuccess: () => {
      toast('success', 'Regle mise a jour')
      setEditingId(null)
      setShowModal(false)
      setForm({ ...defaultForm })
      qc.invalidateQueries({ queryKey: ['grcRules'] })
    },
    onError: () => toast('error', 'Erreur lors de la mise a jour'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => grcBridgeApi.deleteRule(id),
    onSuccess: () => {
      toast('success', 'Regle supprimee')
      setDeleteConfirmId(null)
      qc.invalidateQueries({ queryKey: ['grcRules'] })
    },
    onError: () => toast('error', 'Erreur lors de la suppression'),
  })

  const handleSubmit = () => {
    let parsedFilters = {}
    try {
      parsedFilters = JSON.parse(form.requirement_filters || '{}')
    } catch {
      toast('error', 'JSON invalide pour les filtres exigences')
      return
    }
    const payload: Record<string, unknown> = {
      name: form.name,
      match_field: form.match_field,
      match_operator: form.match_operator,
      match_value: form.match_value,
      requirement_filters: parsedFilters,
      auto_assign: form.auto_assign,
    }
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload })
    } else {
      createMutation.mutate(payload)
    }
  }

  const openEdit = (rule: AutoRule) => {
    setEditingId(rule.id)
    setForm({
      name: String(rule.name ?? ''),
      match_field: String(rule.match_field ?? 'asset_type'),
      match_operator: String(rule.match_operator ?? 'equals'),
      match_value: String(rule.match_value ?? ''),
      requirement_filters: rule.requirement_filters ? JSON.stringify(rule.requirement_filters) : '{}',
      auto_assign: Boolean(rule.auto_assign),
    })
    setShowModal(true)
  }

  const openCreate = () => {
    setEditingId(null)
    setForm({ ...defaultForm })
    setShowModal(true)
  }

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
          Regles d'auto-association
        </h1>
        <button onClick={openCreate} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', fontWeight: 500, cursor: 'pointer', background: 'var(--color-accent)', color: '#fff', border: 'none', fontSize: '14px' }}>
          <Plus size={16} /> Creer une regle
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>Chargement...</div>
        ) : rules.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <Settings size={32} style={{ color: 'var(--color-text-secondary)' }} />
            Aucune regle d'auto-association definie.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Nom</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Champ match</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Operateur</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Valeur</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Filtres exigences</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Auto-assign</th>
                <th style={{ textAlign: 'left', padding: '8px', color: 'var(--color-text-secondary)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px', color: 'var(--color-text-primary)', fontWeight: 500 }}>{String(rule.name || '—')}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{String(rule.match_field || '—')}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-secondary)' }}>{String(rule.match_operator || '—')}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-primary)', maxWidth: '200px' }}>{String(rule.match_value || '—')}</td>
                  <td style={{ padding: '8px', color: 'var(--color-text-secondary)', maxWidth: '200px', fontSize: '12px', fontFamily: 'monospace' }}>
                    {rule.requirement_filters && Object.keys(rule.requirement_filters).length > 0
                      ? String(JSON.stringify(rule.requirement_filters)).substring(0, 60) + '...'
                      : '—'}
                  </td>
                  <td style={{ padding: '8px' }}>
                    {rule.auto_assign ? (
                      <Badge variant="success" size="sm">Oui</Badge>
                    ) : (
                      <Badge variant="default" size="sm">Non</Badge>
                    )}
                  </td>
                  <td style={{ padding: '8px' }}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => openEdit(rule)} title="Editer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', padding: '4px', display: 'inline-flex', alignItems: 'center' }}>
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setDeleteConfirmId(rule.id)} title="Supprimer" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '4px', display: 'inline-flex', alignItems: 'center' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); setEditingId(null) }} title={editingId ? 'Modifier la regle' : 'Creer une regle'} size="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Nom</label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nom de la regle"
              style={{ width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Champ match</label>
            <select
              value={form.match_field}
              onChange={e => setForm(f => ({ ...f, match_field: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
            >
              {MATCH_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Operateur</label>
            <select
              value={form.match_operator}
              onChange={e => setForm(f => ({ ...f, match_operator: e.target.value }))}
              style={{ width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
            >
              {MATCH_OPERATORS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Valeur</label>
            <input
              type="text"
              value={form.match_value}
              onChange={e => setForm(f => ({ ...f, match_value: e.target.value }))}
              placeholder="Valeur de match"
              style={{ width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)' }}
            />
          </div>
          <div>
            <label style={{ fontSize: '12px', color: 'var(--color-text-secondary)', display: 'block', marginBottom: '4px' }}>Filtres exigences (JSON)</label>
            <textarea
              value={form.requirement_filters}
              onChange={e => setForm(f => ({ ...f, requirement_filters: e.target.value }))}
              placeholder='{"grc_category": "Technique"}'
              rows={3}
              style={{ width: '100%', padding: '8px 12px', fontSize: '13px', fontFamily: 'monospace', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', resize: 'vertical' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={form.auto_assign}
              onChange={e => setForm(f => ({ ...f, auto_assign: e.target.checked }))}
              id="auto_assign"
            />
            <label htmlFor="auto_assign" style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>Auto-assign</label>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
            <button onClick={() => { setShowModal(false); setEditingId(null) }} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={!form.name || !form.match_value} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-accent)', color: '#fff', cursor: form.name && form.match_value ? 'pointer' : 'not-allowed', opacity: form.name && form.match_value ? 1 : 0.5 }}>
              {editingId ? 'Enregistrer' : 'Creer'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={deleteConfirmId !== null} onClose={() => setDeleteConfirmId(null)} title="Supprimer la regle" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: 'var(--color-text-secondary)' }}>Etes-vous sur de vouloir supprimer cette regle ?</p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button onClick={() => setDeleteConfirmId(null)} style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-primary)', color: 'var(--color-text-primary)', cursor: 'pointer' }}>
              Annuler
            </button>
            <button onClick={() => deleteMutation.mutate(deleteConfirmId!)} style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: 'var(--color-danger)', color: '#fff', cursor: 'pointer' }}>
              Supprimer
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}