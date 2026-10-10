import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dpoApi } from '../../../api'
import { Badge, Button, Modal, Input, Select, Table, ConfirmDialog } from '../../../components/ui'
import { useToast } from '../../../components/ui/Toast'
import { Plus, Edit2, Trash2, AlertTriangle, Clock } from 'lucide-react'

const sectionTitle: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 700,
  color: 'var(--color-text-primary)',
  margin: 0,
}

function requestTypeBadge(type: string): 'info' | 'warning' | 'danger' | 'success' | 'default' {
  switch (type) {
    case 'access': return 'info'
    case 'rectification': return 'warning'
    case 'erasure': return 'danger'
    case 'portability': return 'success'
    case 'objection': return 'default'
    case 'restriction': return 'warning'
    default: return 'default'
  }
}

function requestTypeLabel(type: string): string {
  switch (type) {
    case 'access': return 'Accès'
    case 'rectification': return 'Rectification'
    case 'erasure': return 'Effacement'
    case 'portability': return 'Portabilité'
    case 'objection': return 'Opposition'
    case 'restriction': return 'Limitation'
    default: return type
  }
}

function rightsStatusBadge(status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' {
  switch (status) {
    case 'responded': return 'success'
    case 'in_progress': return 'warning'
    case 'received': return 'info'
    case 'closed': return 'default'
    case 'rejected': return 'danger'
    default: return 'default'
  }
}

/** Compute SLA deadline (1 month from request_date) */
function getSlaInfo(requestDate: string | null | undefined, status: string): {
  daysLeft: number | null
  overdue: boolean
  text: string
} {
  if (!requestDate || status === 'closed' || status === 'responded') {
    return { daysLeft: null, overdue: false, text: '' }
  }
  const requested = new Date(requestDate).getTime()
  const deadline = requested + 30 * 24 * 60 * 60 * 1000 // 1 month
  const now = Date.now()
  const diff = deadline - now
  if (diff <= 0) {
    return { daysLeft: null, overdue: true, text: 'DÉPASSÉ' }
  }
  const daysLeft = Math.floor(diff / (24 * 60 * 60 * 1000))
  return { daysLeft, overdue: false, text: `${daysLeft}j` }
}

const requestTypeOptions = [
  { label: 'Accès (Art. 15)', value: 'access' },
  { label: 'Rectification (Art. 16)', value: 'rectification' },
  { label: 'Effacement (Art. 17)', value: 'erasure' },
  { label: 'Portabilité (Art. 20)', value: 'portability' },
  { label: 'Opposition (Art. 21)', value: 'objection' },
  { label: 'Limitation (Art. 18)', value: 'restriction' },
]

const rightsStatusOptions = [
  { label: 'Reçue', value: 'received' },
  { label: 'En cours', value: 'in_progress' },
  { label: 'Répondue', value: 'responded' },
  { label: 'Clôturée', value: 'closed' },
  { label: 'Rejetée', value: 'rejected' },
]

const columns = [
  { key: 'request_type', label: 'Type de demande', width: '140px' },
  { key: 'requester_name', label: 'Demandeur', width: '150px' },
  { key: 'request_date', label: 'Date de demande', width: '120px' },
  { key: 'sla_deadline', label: 'Délai SLA', width: '100px' },
  { key: 'status', label: 'Statut', width: '110px' },
  { key: 'actions', label: '', width: '80px' },
]

interface FormState {
  request_type: string
  requester_name: string
  requester_email: string
  request_date: string
  request_details: string
  status: string
  response: string
}

const emptyForm: FormState = {
  request_type: 'access',
  requester_name: '',
  requester_email: '',
  request_date: '',
  request_details: '',
  status: 'received',
  response: '',
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

export function DpoRightsRequests() {
  const { toast } = useToast()
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<FormState>({ ...emptyForm })

  const { data, isLoading } = useQuery({
    queryKey: ['dpo-rights'],
    queryFn: () => dpoApi.listRights().then((r) => r.data),
  })

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => dpoApi.createRight(d),
    onSuccess: () => {
      toast('success', 'Demande créée avec succès')
      qc.invalidateQueries({ queryKey: ['dpo-rights'] })
      setShowModal(false)
    },
    onError: () => toast('error', 'Erreur lors de la création'),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => dpoApi.updateRight(id, data),
    onSuccess: () => {
      toast('success', 'Demande mise à jour')
      qc.invalidateQueries({ queryKey: ['dpo-rights'] })
      setShowModal(false)
    },
    onError: () => toast('error', 'Erreur lors de la mise à jour'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => dpoApi.deleteRight(id),
    onSuccess: () => {
      toast('success', 'Demande supprimée')
      qc.invalidateQueries({ queryKey: ['dpo-rights'] })
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
      request_type: String(row.request_type ?? 'access'),
      requester_name: String(row.requester_name ?? ''),
      requester_email: String(row.requester_email ?? ''),
      request_date: String(row.request_date ?? '').substring(0, 16),
      request_details: String(row.request_details ?? ''),
      status: String(row.status ?? 'received'),
      response: String(row.response ?? ''),
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
        <h1 style={sectionTitle}>Demandes d'exercice de droits</h1>
        <Button icon={<Plus size={16} />} onClick={openCreate}>
          Nouvelle demande
        </Button>
      </div>

      <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', margin: 0 }}>
        Articles 15-22 RGPD — Droits d'accès, rectification, effacement, portabilité, opposition et limitation
      </p>

      <Table
        columns={columns}
        data={items}
        loading={isLoading}
        emptyMessage="Aucune demande enregistrée"
        renderCell={(col, row) => {
          if (col.key === 'request_type') {
            return <Badge variant={requestTypeBadge(String(row.request_type))}>{requestTypeLabel(String(row.request_type))}</Badge>
          }
          if (col.key === 'status') {
            const match = rightsStatusOptions.find((o) => o.value === row.status)
            return <Badge variant={rightsStatusBadge(String(row.status))}>{match?.label ?? String(row.status)}</Badge>
          }
          if (col.key === 'sla_deadline') {
            const info = getSlaInfo(String(row.request_date), String(row.status))
            if (info.overdue) {
              return (
                <Badge variant="danger">
                  <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                  DÉPASSÉ
                </Badge>
              )
            }
            if (info.daysLeft !== null) {
              const variant = info.daysLeft <= 7 ? 'warning' : 'default'
              return (
                <Badge variant={variant}>
                  <Clock size={12} style={{ marginRight: '4px' }} />
                  {info.text}
                </Badge>
              )
            }
            return '—'
          }
          if (col.key === 'request_date') {
            const d = String(row.request_date ?? '')
            return d ? new Date(d).toLocaleDateString('fr-FR') : '—'
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
        title={editId !== null ? 'Modifier la demande' : 'Nouvelle demande'}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Select label="Type de demande *" value={form.request_type} onChange={(v) => setForm({ ...form, request_type: v })} options={requestTypeOptions} required />
          <Input label="Nom du demandeur *" value={form.requester_name} onChange={(v) => setForm({ ...form, requester_name: v })} required />
          <Input label="Email du demandeur" value={form.requester_email} onChange={(v) => setForm({ ...form, requester_email: v })} type="email" />
          <Input label="Date de la demande *" value={form.request_date} onChange={(v) => setForm({ ...form, request_date: v })} type="datetime-local" required />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={labelStyle}>Détails de la demande</label>
            <textarea
              value={form.request_details}
              onChange={(e) => setForm({ ...form, request_details: e.target.value })}
              rows={3}
              style={textareaStyle}
            />
          </div>
          <Select label="Statut" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={rightsStatusOptions} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={labelStyle}>Réponse</label>
            <textarea
              value={form.response}
              onChange={(e) => setForm({ ...form, response: e.target.value })}
              rows={3}
              style={textareaStyle}
            />
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <Button variant="secondary" onClick={() => setShowModal(false)}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={!form.requester_name || !form.request_date}>
            {editId !== null ? 'Enregistrer' : 'Créer'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Supprimer la demande"
        message="Êtes-vous sûr de vouloir supprimer cette demande d'exercice de droits ?"
        variant="danger"
        onConfirm={() => { if (deleteId !== null) deleteMut.mutate(deleteId) }}
        onCancel={() => setDeleteId(null)}
      />
    </div>
  )
}