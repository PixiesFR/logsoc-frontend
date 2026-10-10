import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dpoApi } from '../../../api'
import { Card, Badge, Button, Modal, Input, ConfirmDialog } from '../../../components/ui'
import { Plus, Edit2, Trash2, FileWarning, Sparkles } from 'lucide-react'

const cardStyle: React.CSSProperties = { padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }

const RISK_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  low: 'success', medium: 'warning', high: 'danger', critical: 'danger',
}
const RISK_LABELS: Record<string, string> = { low: 'Faible', medium: 'Moyen', high: 'Élevé', critical: 'Critique' }
const STATUS_VARIANTS: Record<string, 'default' | 'warning' | 'success' | 'danger'> = {
  initiated: 'default', in_progress: 'warning', validated: 'success', obsolete: 'danger',
}
const STATUS_LABELS: Record<string, string> = {
  initiated: 'Initié', in_progress: 'En cours', validated: 'Validé', obsolete: 'Obsolète',
}

export function DpoPiaRegistry() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [aiLoading, setAiLoading] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['dpo-pia'],
    queryFn: () => dpoApi.listPia().then(r => r.data),
  })
  const items: any[] = data?.items || []

  // Fetch processing entries with has_pia=true for the dropdown
  const { data: processingData } = useQuery({
    queryKey: ['dpo-processing-for-pia'],
    queryFn: () => dpoApi.listProcessing().then(r => r.data),
  })
  const piaProcessingOptions = (processingData?.items || []).filter((p: any) => p.has_pia)

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => dpoApi.createPia(d),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dpo-pia'] }); setShowModal(false); setForm({}) },
  })
  const updateMut = useMutation({
    mutationFn: (d: { id: number; data: Record<string, unknown> }) => dpoApi.updatePia(d.id, d.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dpo-pia'] }); setShowModal(false) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => dpoApi.deletePia(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['dpo-pia'] }); setDeleteId(null) },
  })

  const openCreate = () => { setForm({}); setEditId(null); setShowModal(true) }
  const openEdit = (item: any) => { setForm(item); setEditId(item.id); setShowModal(true) }
  const save = () => {
    if (editId) updateMut.mutate({ id: editId, data: form })
    else createMut.mutate(form)
  }

  const handleAiPrefill = async () => {
    if (!form.processing_id) return
    setAiLoading(true)
    try {
      const res = await dpoApi.aiPrefillPia(form.processing_id)
      const pia = res.data.pia
      setForm({
        ...form,
        name: form.name || res.data.processing_name || 'PIA',
        description: pia.description || form.description,
        assessment: `${pia.necessity_proportionality || ''}\n\n${pia.risk_evaluation || ''}`,
        risk_level: pia.risk_level || form.risk_level,
        mitigation_measures: pia.recommended_mitigations || pia.proposed_measures || form.mitigation_measures,
      })
    } catch (err) {
      console.error('AI pre-fill error:', err)
      alert('Erreur lors de la generation IA')
    } finally {
      setAiLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>PIA / DPIA</h1>
          <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>Analyses d'impact — article 35 RGPD</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={openCreate}>Nouveau PIA</Button>
      </div>

      {isLoading ? <div>Chargement...</div> : items.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
            <FileWarning size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
            <div style={{ fontSize: '14px' }}>Aucun PIA enregistré</div>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div key={item.id} style={{ ...cardStyle, padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                  {item.processing_id && (
                    <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', background: 'var(--color-bg-tertiary)', padding: '2px 6px', borderRadius: '4px' }}>
                      Traitement #{item.processing_id}
                    </span>
                  )}
                  <Badge variant={RISK_VARIANTS[item.risk_level] || 'default'} size="sm">{RISK_LABELS[item.risk_level] || item.risk_level}</Badge>
                  <Badge variant={RISK_VARIANTS[item.residual_risk] || 'default'} size="sm">Résiduel: {RISK_LABELS[item.residual_risk] || item.residual_risk}</Badge>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {item.description || '—'} · Validé: {item.validated_at ? new Date(item.validated_at).toLocaleDateString('fr-FR') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Badge variant={STATUS_VARIANTS[item.status] || 'default'} size="sm">{STATUS_LABELS[item.status] || item.status}</Badge>
                <button onClick={() => openEdit(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-info, #3b82f6)' }} title="Modifier"><Edit2 size={16} /></button>
                <button onClick={() => setDeleteId(item.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Supprimer"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Modifier PIA' : 'Nouveau PIA'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={labelStyle}>Traitement associé</label>
            <select
              value={form.processing_id || ''}
              onChange={(e) => {
                const val = e.target.value ? parseInt(e.target.value) : null
                const selected = piaProcessingOptions.find((p: any) => p.id === val)
                setForm({ ...form, processing_id: val, name: selected ? selected.name : form.name })
              }}
              style={inputStyle}
            >
              <option value="">— Sélectionner un traitement —</option>
              {piaProcessingOptions.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {piaProcessingOptions.length === 0 && (
              <div style={{ fontSize: '11px', color: 'var(--color-warning)', marginTop: '4px' }}>
                ⚠️ Aucun traitement avec PIA requis. Cochez "PIA requis" sur un traitement dans le Registre des Traitements.
              </div>
            )}
            {form.processing_id && (
              <button
                onClick={handleAiPrefill}
                disabled={aiLoading}
                style={{
                  marginTop: '8px', padding: '6px 12px', borderRadius: '6px',
                  border: '1px solid var(--color-accent)', background: 'transparent',
                  color: 'var(--color-accent)', fontSize: '12px', fontWeight: 600,
                  cursor: aiLoading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Sparkles size={14} />
                {aiLoading ? 'Génération en cours...' : 'Pré-remplir avec l\'IA'}
              </button>
            )}
          </div>
          <Input label="Nom" value={form.name || ''} onChange={(v) => setForm({ ...form, name: v })} required />
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Niveau de risque</label>
            <select value={form.risk_level || 'medium'} onChange={(e) => setForm({ ...form, risk_level: e.target.value })} style={inputStyle}>
              <option value="low">Faible</option><option value="medium">Moyen</option><option value="high">Élevé</option><option value="critical">Critique</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Analyse des risques</label>
            <textarea value={form.assessment || ''} onChange={(e) => setForm({ ...form, assessment: e.target.value })} rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Risque résiduel</label>
            <select value={form.residual_risk || 'medium'} onChange={(e) => setForm({ ...form, residual_risk: e.target.value })} style={inputStyle}>
              <option value="low">Faible</option><option value="medium">Moyen</option><option value="high">Élevé</option><option value="critical">Critique</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Mesures de réduction</label>
            <textarea value={form.mitigation_measures || ''} onChange={(e) => setForm({ ...form, mitigation_measures: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Statut</label>
            <select value={form.status || 'initiated'} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
              <option value="initiated">Initié</option><option value="in_progress">En cours</option><option value="validated">Validé</option><option value="obsolete">Obsolète</option>
            </select>
          </div>
          <Button onClick={save} disabled={!form.name}>{editId ? 'Mettre à jour' : 'Créer'}</Button>
        </div>
      </Modal>

      <ConfirmDialog open={deleteId !== null} title="Supprimer" message="Confirmer la suppression ?" onConfirm={() => deleteId && deleteMut.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  )
}