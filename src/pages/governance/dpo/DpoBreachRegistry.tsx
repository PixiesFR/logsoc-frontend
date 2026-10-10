import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dpoApi } from '../../../api'
import { Badge, Button, Modal, Input, Select, Table, ConfirmDialog } from '../../../components/ui'
import { useToast } from '../../../components/ui/Toast'
import { Plus, Edit2, Trash2, AlertTriangle } from 'lucide-react'

const sectionTitle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: 0,
}

function riskBadge(risk: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (risk) {
    case 'low': return 'success'
    case 'medium': return 'warning'
    case 'high': return 'danger'
    default: return 'default'
  }
}

function natureBadge(nature: string): 'info' | 'warning' | 'danger' | 'default' {
  switch (nature) {
    case 'confidentiality': return 'info'
    case 'integrity': return 'warning'
    case 'availability': return 'danger'
    default: return 'default'
  }
}

function statusBadge(status: string): 'success' | 'warning' | 'danger' | 'default' {
  switch (status) {
    case 'resolved': return 'success'
    case 'notified': return 'warning'
    case 'open': return 'danger'
    case 'closed': return 'default'
    default: return 'default'
  }
}

function getDeadlineInfo(detectedAt: string | null | undefined, notifiedCnil: boolean): {
  hoursLeft: number | null
  overdue: boolean
  text: string
} {
  if (!detectedAt || notifiedCnil) return { hoursLeft: null, overdue: false, text: '' }
  const detected = new Date(detectedAt).getTime()
  const deadline = detected + 72 * 60 * 60 * 1000
  const now = Date.now()
  const diff = deadline - now
  if (diff <= 0) {
    return { hoursLeft: null, overdue: true, text: 'DÉPASSÉ' }
  }
  const hoursLeft = Math.floor(diff / (60 * 60 * 1000))
  const minsLeft = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000))
  return { hoursLeft, overdue: false, text: `${hoursLeft}h${minsLeft.toString().padStart(2, '0')}` }
}

const natureOptions = [
  { label: 'Confidentialité', value: 'confidentiality' },
  { label: 'Intégrité', value: 'integrity' },
  { label: 'Disponibilité', value: 'availability' },
]

const riskLevelOptions = [
  { label: 'Faible', value: 'low' },
  { label: 'Moyen', value: 'medium' },
  { label: 'Élevé', value: 'high' },
]

const breachStatusOptions = [
  { label: 'Ouvert', value: 'open' },
  { label: 'Notifié CNIL', value: 'notified' },
  { label: 'Résolu', value: 'resolved' },
  { label: 'Clôturé', value: 'closed' },
]

const columns = [
  { key: 'detected_at', label: 'Date de détection', width: '130px' },
  { key: 'description', label: 'Description', width: '180px' },
  { key: 'nature', label: 'Nature', width: '110px' },
  { key: 'affected_persons_count', label: 'Personnes affectées', width: '110px' },
  { key: 'notified_cnil', label: 'CNIL notifiée', width: '100px' },
  { key: 'cnil_notification_deadline', label: 'Délai 72h', width: '100px' },
  { key: 'risk_level', label: 'Niveau de risque', width: '110px' },
  { key: 'status', label: 'Statut', width: '90px' },
  { key: 'actions', label: '', width: '80px' },
]

interface FormState {
  detected_at: string
  reported_at: string
  description: string
  nature: string
  data_categories: string
  affected_persons_count: string
  notified_cnil: boolean
  notified_cnil_at: string
  notified_persons: boolean
  corrective_measures: string
  risk_level: string
  status: string
}

const emptyForm: FormState = {
  detected_at: '',
  reported_at: '',
  description: '',
  nature: 'confidentiality',
  data_categories: '',
  affected_persons_count: '',
  notified_cnil: false,
  notified_cnil_at: '',
  notified_persons: false,
  corrective_measures: '',
  risk_level: 'medium',
  status: 'open',
}

const textareaStyle: React.CSSProperties = {
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
}

const labelStyle: React.CSSProperties = {
  fontSize: '13px',
  fontWeight: 500,
  color: 'var(--color-text-secondary)',
}

export function DpoBreachRegistry() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['dpo-breaches'],
    queryFn: () => dpoApi.listBreaches().then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => dpoApi.createBreach(d),
    onSuccess: () => {
      toast('success', 'Violation ajoutée avec succès')
      qc.invalidateQueries({ queryKey: ['dpo-breaches'] })
      setShowModal(false)
    },
    onError: () => toast('error', 'Erreur lors de la création'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => dpoApi.updateBreach(id, data),
    onSuccess: () => {
      toast('success', 'Violation mise à jour')
      qc.invalidateQueries({ queryKey: ['dpo-breaches'] })
      setShowModal(false)
    },
    onError: () => toast('error', 'Erreur lors de la mise à jour'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => dpoApi.deleteBreach(id),
    onSuccess: () => {
      toast('success', 'Violation supprimée')
      qc.invalidateQueries({ queryKey: ['dpo-breaches'] })
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
      detected_at: String(row.detected_at ?? '').substring(0, 16),
      reported_at: String(row.reported_at ?? '').substring(0, 16),
      description: String(row.description ?? ''),
      nature: String(row.nature ?? 'confidentiality'),
      data_categories: String(row.data_categories ?? ''),
      affected_persons_count: String(row.affected_persons_count ?? ''),
      notified_cnil: Boolean(row.notified_cnil),
      notified_cnil_at: String(row.notified_cnil_at ?? '').substring(0, 16),
      notified_persons: Boolean(row.notified_persons),
      corrective_measures: String(row.corrective_measures ?? ''),
      risk_level: String(row.risk_level ?? 'medium'),
      status: String(row.status ?? 'open'),
    })
    setShowModal(true)
  }

  function handleSubmit() {
    const payload: Record<string, unknown> = {
      ...form,
      affected_persons_count: form.affected_persons_count ? Number(form.affected_persons_count) : null,
    }
    if (editId !== null) {
      updateMut.mutate({ id: editId, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={sectionTitle}>Registre des violations</h1>
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Déclarer une violation
        </Button>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
        Article 33 RGPD — Notification d'une violation de données à la CNIL dans les 72 heures
      </p>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="Aucune violation enregistrée"
        renderCell={(col, row) => {
          if (col.key === 'status') {
            return <Badge variant={statusBadge(String(row.status))}>{String(row.status)}</Badge>
          }
          if (col.key === 'risk_level') {
            return <Badge variant={riskBadge(String(row.risk_level))}>{String(row.risk_level)}</Badge>
          }
          if (col.key === 'nature') {
            const match = natureOptions.find((o) => o.value === row.nature)
            return <Badge variant={natureBadge(String(row.nature))}>{match?.label ?? String(row.nature)}</Badge>
          }
          if (col.key === 'notified_cnil') {
            return row.notified_cnil
              ? <Badge variant="success">Oui</Badge>
              : <Badge variant="danger">Non</Badge>
          }
          if (col.key === 'cnil_notification_deadline') {
            const info = getDeadlineInfo(String(row.detected_at), Boolean(row.notified_cnil))
            if (info.overdue) {
              return (
                <Badge variant="danger">
                  <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                  DÉPASSÉ
                </Badge>
              )
            }
            if (info.hoursLeft !== null) {
              const variant = info.hoursLeft <= 24 ? 'danger' : info.hoursLeft <= 48 ? 'warning' : 'default'
              return <Badge variant={variant}>{info.text}</Badge>
            }
            return '—'
          }
          if (col.key === 'detected_at') {
            const d = String(row.detected_at ?? '')
            return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
          }
          if (col.key === 'description') {
            const val = String(row.description ?? '')
            return val.length > 60 ? val.substring(0, 60) + '…' : val
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
          return String(row[col.key] ?? '—')
        }}
      />

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title={editId !== null ? 'Modifier la violation' : 'Déclarer une violation'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Date de détection *" value={form.detected_at} onChange={(v) => setForm({ ...form, detected_at: v })} type="datetime-local" required />
          <Input label="Date de signalement" value={form.reported_at} onChange={(v) => setForm({ ...form, reported_at: v })} type="datetime-local" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={labelStyle}>Description de la violation *</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              style={textareaStyle}
            />
          </div>
          <Select label="Nature de la violation *" value={form.nature} onChange={(v) => setForm({ ...form, nature: v })} options={natureOptions} required />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={labelStyle}>Catégories de données affectées</label>
            <textarea
              value={form.data_categories}
              onChange={(e) => setForm({ ...form, data_categories: e.target.value })}
              rows={2}
              style={textareaStyle}
            />
          </div>
          <Input label="Nombre de personnes affectées" value={form.affected_persons_count} onChange={(v) => setForm({ ...form, affected_persons_count: v })} type="number" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={form.notified_cnil}
                onChange={(e) => setForm({ ...form, notified_cnil: e.target.checked })}
              />
              <label style={{ fontSize: '14px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
                CNIL notifiée
              </label>
            </div>
            {form.notified_cnil && (
              <Input label="Date de notification CNIL" value={form.notified_cnil_at} onChange={(v) => setForm({ ...form, notified_cnil_at: v })} type="datetime-local" />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={form.notified_persons}
                onChange={(e) => setForm({ ...form, notified_persons: e.target.checked })}
              />
              <label style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>
                Personnes concernées notifiées
              </label>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={labelStyle}>Mesures correctives</label>
            <textarea
              value={form.corrective_measures}
              onChange={(e) => setForm({ ...form, corrective_measures: e.target.value })}
              rows={3}
              style={textareaStyle}
            />
          </div>
          <Select label="Niveau de risque" value={form.risk_level} onChange={(v) => setForm({ ...form, risk_level: v })} options={riskLevelOptions} />
          <Select label="Statut" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={breachStatusOptions} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!form.detected_at || !form.description}>
            {editId !== null ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Supprimer la violation"
        message="Êtes-vous sûr de vouloir supprimer cette violation du registre ?"
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMut.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}