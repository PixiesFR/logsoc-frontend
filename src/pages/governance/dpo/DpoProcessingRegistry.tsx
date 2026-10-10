import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dpoApi } from '../../../api'
import { Badge, Button, Modal, Input, Select, Table, ConfirmDialog } from '../../../components/ui'
import { useToast } from '../../../components/ui/Toast'
import { Plus, Edit2, Trash2 } from 'lucide-react'

const sectionTitle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: 0,
}

function statusBadge(status: string): 'success' | 'warning' | 'default' {
  switch (status) {
    case 'active': return 'success'
    case 'modified': return 'warning'
    case 'retired': return 'default'
    default: return 'default'
  }
}

const legalBasisOptions = [
  { label: 'Consentement', value: 'consent' },
  { label: 'Contrat', value: 'contract' },
  { label: 'Obligation légale', value: 'legal_obligation' },
  { label: 'Intérêt vital', value: 'vital_interest' },
  { label: 'Intérêt public', value: 'public_interest' },
  { label: 'Intérêt légitime', value: 'legitimate_interest' },
]

const statusOptions = [
  { label: 'Actif', value: 'active' },
  { label: 'Modifié', value: 'modified' },
  { label: 'Retiré', value: 'retired' },
]

const columns = [
  { key: 'name', label: 'Nom du traitement' },
  { key: 'purpose', label: 'Finalité', width: '180px' },
  { key: 'legal_basis', label: 'Base légale', width: '130px' },
  { key: 'data_subjects', label: 'Personnes concernées', width: '140px' },
  { key: 'processor_name', label: 'Sous-traitant', width: '130px' },
  { key: 'has_pia', label: 'AIPD', width: '70px' },
  { key: 'status', label: 'Statut', width: '100px' },
  { key: 'actions', label: '', width: '80px' },
]

interface FormState {
  name: string
  purpose: string
  legal_basis: string
  data_categories: string
  data_subjects: string
  recipients: string
  transfers_outside_eu: boolean
  transfer_countries: string
  processor_name: string
  processor_contract_ref: string
  retention_period: string
  security_measures: string
  has_pia: boolean
  status: string
}

const emptyForm: FormState = {
  name: '',
  purpose: '',
  legal_basis: 'consent',
  data_categories: '',
  data_subjects: '',
  recipients: '',
  transfers_outside_eu: false,
  transfer_countries: '',
  processor_name: '',
  processor_contract_ref: '',
  retention_period: '',
  security_measures: '',
  has_pia: false,
  status: 'active',
}

export function DpoProcessingRegistry() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, any>>({ ...emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['dpo-processing'],
    queryFn: () => dpoApi.listProcessing().then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => dpoApi.createProcessing(d),
    onSuccess: () => {
      toast('success', 'Traitement créé avec succès')
      qc.invalidateQueries({ queryKey: ['dpo-processing'] })
      setShowModal(false)
    },
    onError: () => toast('error', 'Erreur lors de la création'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => dpoApi.updateProcessing(id, data),
    onSuccess: () => {
      toast('success', 'Traitement mis à jour')
      qc.invalidateQueries({ queryKey: ['dpo-processing'] })
      setShowModal(false)
    },
    onError: () => toast('error', 'Erreur lors de la mise à jour'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => dpoApi.deleteProcessing(id),
    onSuccess: () => {
      toast('success', 'Traitement supprimé')
      qc.invalidateQueries({ queryKey: ['dpo-processing'] })
      setDeleteId(null)
    },
    onError: () => toast('error', 'Erreur lors de la suppression'),
  })

  const items = (Array.isArray(data) ? data : (data as Record<string, unknown> | null)?.items ?? []) as Record<string, unknown>[]

  function openCreate() {
    setEditId(null)
    setForm({ ...emptyForm })
    setShowModal(true)
  }

  function openEdit(row: Record<string, unknown>) {
    setEditId(Number(row.id))
    setForm({
      name: String(row.name ?? ''),
      purpose: String(row.purpose ?? ''),
      legal_basis: String(row.legal_basis ?? 'consent'),
      data_categories: String(row.data_categories ?? ''),
      data_subjects: String(row.data_subjects ?? ''),
      recipients: String(row.recipients ?? ''),
      transfers_outside_eu: Boolean(row.transfers_outside_eu),
      transfer_countries: String(row.transfer_countries ?? ''),
      processor_name: String(row.processor_name ?? ''),
      processor_contract_ref: String(row.processor_contract_ref ?? ''),
      retention_period: String(row.retention_period ?? ''),
      security_measures: String(row.security_measures ?? ''),
      has_pia: Boolean(row.has_pia),
      status: String(row.status ?? 'active'),
    })
    setShowModal(true)
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = { ...form }
    if (editId !== null) {
      updateMut.mutate({ id: editId, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={sectionTitle}>Registre des traitements</h1>
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Ajouter un traitement
        </Button>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
        Article 30 RGPD — Registre des activités de traitement
      </p>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="Aucun traitement enregistré"
        renderCell={(col, row) => {
          if (col.key === 'status') {
            return <Badge variant={statusBadge(String(row.status))}>{String(row.status)}</Badge>
          }
          if (col.key === 'has_pia') {
            return row.has_pia ? '✓' : '—'
          }
          if (col.key === 'legal_basis') {
            const match = legalBasisOptions.find((o) => o.value === row.legal_basis)
            return match?.label ?? String(row.legal_basis)
          }
          if (col.key === 'name') {
            return String(row.name)
          }
          if (col.key === 'actions') {
            return (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-accent)', padding: '2px' }}
                  onClick={() => openEdit(row)}
                  title="Modifier"
                >
                  <Edit2 size={14} />
                </button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', padding: '2px' }}
                  onClick={() => setDeleteId(Number(row.id))}
                  title="Supprimer"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          }
          if (col.key === 'purpose') {
            const val = String(row.purpose ?? '')
            return val.length > 50 ? val.substring(0, 50) + '…' : val
          }
          return String(row[col.key] ?? '—')
        }}
      />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId !== null ? 'Modifier le traitement' : 'Ajouter un traitement'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Nom du traitement *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Finalité
            </label>
            <textarea
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              rows={3}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
          <Select label="Base légale *" value={form.legal_basis} onChange={(v) => setForm({ ...form, legal_basis: v })} options={legalBasisOptions} required />
          {/* Champs conditionnels selon base légale */}
          {form.legal_basis === 'consent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Mode de recueil du consentement</label>
              <textarea value={form.consent_method || ''} onChange={(e) => setForm({ ...form, consent_method: e.target.value })} rows={2} placeholder="Comment le consentement est recueilli, preuve, droit de retrait..." style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          )}
          {form.legal_basis === 'contract' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Clause contractuelle</label>
              <textarea value={form.contract_clause || ''} onChange={(e) => setForm({ ...form, contract_clause: e.target.value })} rows={2} placeholder="Type de contrat, clause applicable..." style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          )}
          {form.legal_basis === 'legal_obligation' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Référence légale</label>
              <input value={form.legal_reference || ''} onChange={(e) => setForm({ ...form, legal_reference: e.target.value })} placeholder="Référence à la loi/obligation" style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box' }} />
            </div>
          )}
          {form.legal_basis === 'public_interest' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Mission d'intérêt public</label>
              <textarea value={form.public_interest_mission || ''} onChange={(e) => setForm({ ...form, public_interest_mission: e.target.value })} rows={2} placeholder="Référence à la mission d'intérêt public..." style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
            </div>
          )}
          {form.legal_basis === 'legitimate_interest' && (
            <>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-warning)' }}>Justification de l'intérêt légitime *</label>
                <textarea value={form.legitimate_interest_justification || ''} onChange={(e) => setForm({ ...form, legitimate_interest_justification: e.target.value })} rows={2} placeholder="Justification de l'intérêt légitime poursuivi..." style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-warning)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>Balance des intérêts</label>
                <textarea value={form.interest_balance || ''} onChange={(e) => setForm({ ...form, interest_balance: e.target.value })} rows={2} placeholder="Balance entre l'intérêt légitime et les droits des personnes concernées..." style={{ padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical' }} />
              </div>
              <div style={{ padding: '8px 12px', borderRadius: '6px', background: 'var(--color-warning)', color: '#000', fontSize: '12px' }}>
                ⚠️ L'intérêt légitime nécessite généralement une AIPD/PIA. Cochez "AIPD requise" ci-dessous.
              </div>
            </>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Catégories de données
            </label>
            <textarea
              value={form.data_categories}
              onChange={(e) => setForm({ ...form, data_categories: e.target.value })}
              rows={2}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Personnes concernées
            </label>
            <textarea
              value={form.data_subjects}
              onChange={(e) => setForm({ ...form, data_subjects: e.target.value })}
              rows={2}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Destinataires
            </label>
            <textarea
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              rows={2}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={form.transfers_outside_eu}
              onChange={(e) => setForm({ ...form, transfers_outside_eu: e.target.checked })}
            />
            <label style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
              Transferts hors UE
            </label>
          </div>
          {form.transfers_outside_eu && (
            <Input label="Pays de transfert" value={form.transfer_countries} onChange={(v) => setForm({ ...form, transfer_countries: v })} />
          )}
          <Input label="Nom du sous-traitant" value={form.processor_name} onChange={(v) => setForm({ ...form, processor_name: v })} />
          <Input label="Référence du contrat sous-traitant" value={form.processor_contract_ref} onChange={(v) => setForm({ ...form, processor_contract_ref: v })} />
          <Input label="Durée de conservation" value={form.retention_period} onChange={(v) => setForm({ ...form, retention_period: v })} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              Mesures de sécurité
            </label>
            <textarea
              value={form.security_measures}
              onChange={(e) => setForm({ ...form, security_measures: e.target.value })}
              rows={2}
              style={{
                padding: '8px 12px',
                fontSize: '14px',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                outline: 'none',
                width: '100%',
                boxSizing: 'border-box',
                resize: 'vertical',
              }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              checked={form.has_pia}
              onChange={(e) => setForm({ ...form, has_pia: e.target.checked })}
            />
            <label style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
              AIPD requise (Analyse d'Impact sur la Protection des Données)
            </label>
          </div>
          <Select label="Statut" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={statusOptions} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!form.name}>
            {editId !== null ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Supprimer le traitement"
        message="Êtes-vous sûr de vouloir supprimer ce traitement du registre ?"
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMut.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}