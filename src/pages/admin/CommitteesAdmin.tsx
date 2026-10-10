import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { committeesApi, usersApi } from '../../api'
import { Badge, Button, Modal, Input, Select, ConfirmDialog } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { Plus, Edit2, Trash2, Users, UserPlus, X } from 'lucide-react'

const cardStyle: React.CSSProperties = { padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }

const TYPE_LABELS: Record<string, string> = { codir: 'Codir', comex: 'Comex', other: 'Autre' }
const TYPE_VARIANTS: Record<string, 'info' | 'warning' | 'default'> = { codir: 'info', comex: 'warning', other: 'default' }

const BUSINESS_ROLES = [
  { label: 'Gérant / DG', value: 'gerant' },
  { label: 'RSSI', value: 'rssi' },
  { label: 'DPO', value: 'dpo' },
  { label: 'DSI / Responsable IT', value: 'dsi' },
  { label: 'Responsable métier', value: 'responsable_metier' },
  { label: 'Auditeur interne', value: 'auditeur' },
  { label: 'Expert sécurité', value: 'expert' },
  { label: 'Risk Manager', value: 'risk_manager' },
  { label: 'Compliance Officer', value: 'compliance' },
  { label: 'MOA / MOE', value: 'moe' },
  { label: 'Membre', value: 'membre' },
  { label: 'Rapporteur', value: 'rapporteur' },
]

const ROLE_LABELS: Record<string, string> = Object.fromEntries(BUSINESS_ROLES.map(r => [r.value, r.label]))

export function CommitteesAdmin() {
  const qc = useQueryClient()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})
  const [showMembers, setShowMembers] = useState<number | null>(null)
  const [addMemberUserId, setAddMemberUserId] = useState('')
  const [addMemberRole, setAddMemberRole] = useState('membre')

  const { data, isLoading } = useQuery({
    queryKey: ['governance-committees'],
    queryFn: () => committeesApi.list().then(r => r.data),
  })
  const items: any[] = data?.items || []

  const { data: membersData } = useQuery({
    queryKey: ['committee-members', showMembers],
    queryFn: () => committeesApi.listMembers(showMembers!).then(r => r.data),
    enabled: showMembers !== null,
  })
  const members: any[] = membersData?.items || []

  const { data: usersData } = useQuery({
    queryKey: ['users-for-committee'],
    queryFn: () => usersApi.list().then(r => r.data),
    enabled: showMembers !== null,
  })
  const users: any[] = usersData?.items || usersData || []
  const userOptions = users.map((u: any) => ({ label: u.display_name || u.username, value: String(u.id) }))

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => committeesApi.create(d),
    onSuccess: () => { toast('success', 'Comité créé'); qc.invalidateQueries({ queryKey: ['governance-committees'] }); setShowModal(false); setForm({}) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => committeesApi.update(id, data),
    onSuccess: () => { toast('success', 'Comité mis à jour'); qc.invalidateQueries({ queryKey: ['governance-committees'] }); setShowModal(false) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => committeesApi.delete(id),
    onSuccess: () => { toast('success', 'Comité supprimé'); qc.invalidateQueries({ queryKey: ['governance-committees'] }); setDeleteId(null) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const addMemberMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => committeesApi.addMember(showMembers!, d),
    onSuccess: () => { toast('success', 'Membre ajouté'); qc.invalidateQueries({ queryKey: ['committee-members', showMembers] }); setAddMemberUserId(''); setAddMemberRole('membre') },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const removeMemberMut = useMutation({
    mutationFn: (memberId: number) => committeesApi.removeMember(showMembers!, memberId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['committee-members', showMembers] }) },
  })

  const openCreate = () => { setForm({}); setEditId(null); setShowModal(true) }
  const openEdit = (item: any) => { setForm(item); setEditId(item.id); setShowModal(true) }
  const save = () => {
    if (editId) updateMut.mutate({ id: editId, data: form })
    else createMut.mutate(form)
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>Comités de gouvernance</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {items.length} comité(s) — Codir, Comex... utilisés pour l'homologation
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>Nouveau comité</Button>
      </div>

      {isLoading ? <div>Chargement...</div> : items.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
          <Users size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div style={{ fontSize: '14px' }}>Aucun comité défini</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>Créez le Codir ou le Comex de votre organisation</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div key={item.id} style={{ ...cardStyle, padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Users size={16} style={{ color: 'var(--color-accent)' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                  <Badge variant={TYPE_VARIANTS[item.type] || 'default'} size="sm">{TYPE_LABELS[item.type] || item.type}</Badge>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {item.description || '—'} · {item.member_count} membre(s)
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button size="sm" variant="secondary" icon={<UserPlus size={14} />} onClick={() => { setShowMembers(item.id); setAddMemberUserId(''); setAddMemberRole('membre') }}>
                  Gérer les membres
                </Button>
                <button onClick={() => openEdit(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-info, #3b82f6)' }} title="Modifier"><Edit2 size={16} /></button>
                <button onClick={() => setDeleteId(item.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Supprimer"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit committee modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Modifier comité' : 'Nouveau comité'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Nom du comité" value={form.name || ''} onChange={(v: string) => setForm({ ...form, name: v })} required />
          <div>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>Type</label>
            <select value={form.type || 'codir'} onChange={(e) => setForm({ ...form, type: e.target.value })} style={inputStyle}>
              <option value="codir">Codir</option>
              <option value="comex">Comex</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <Button onClick={save} disabled={!form.name}>{editId ? 'Mettre à jour' : 'Créer'}</Button>
        </div>
      </Modal>

      {/* Members modal */}
      <Modal open={showMembers !== null} onClose={() => setShowMembers(null)} title="Membres du comité" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {/* Add member */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', padding: '12px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-tertiary)' }}>
            <Select
              label="Utilisateur"
              value={addMemberUserId}
              onChange={setAddMemberUserId}
              options={userOptions}
              placeholder="Sélectionner…"
            />
            <Select
              label="Rôle"
              value={addMemberRole}
              onChange={setAddMemberRole}
              options={BUSINESS_ROLES}
            />
            <Button
              onClick={() => addMemberUserId && addMemberMut.mutate({ user_id: Number(addMemberUserId), business_role: addMemberRole })}
              disabled={!addMemberUserId || addMemberMut.isPending}
            >
              Ajouter
            </Button>
          </div>

          {/* Members list */}
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
              Aucun membre. Ajoutez les membres du comité (DG, RSSI, DPO, DSI...).
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {members.map((m: any) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '6px', background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-border)' }}>
                  <Users size={14} style={{ color: 'var(--color-text-secondary)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{m.display_name || m.username}</div>
                  </div>
                  <Badge variant="default" size="sm">{ROLE_LABELS[m.business_role] || m.business_role}</Badge>
                  <button onClick={() => removeMemberMut.mutate(m.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Retirer">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog open={deleteId !== null} title="Supprimer" message="Confirmer la suppression de ce comité ? Les membres seront supprimés." onConfirm={() => deleteId && deleteMut.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  )
}