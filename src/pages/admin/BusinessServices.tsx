import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { businessServicesApi, cmdbGrcApi, serviceMembersApi, usersApi } from '../../api'
import { Badge, Button, Modal, Input, ConfirmDialog } from '../../components/ui'
import { useToast } from '../../components/ui/Toast'
import { Plus, Edit2, Trash2, Briefcase, Link2, Server, Users } from 'lucide-react'
import { useTranslation } from '../../i18n/useTranslation'

const cardStyle: React.CSSProperties = { padding: '20px', borderRadius: '12px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }

const CRIT_VARIANTS: Record<string, 'success' | 'warning' | 'danger' | 'default'> = {
  low: 'default', medium: 'warning', high: 'danger', critical: 'danger',
}
const CRIT_LABEL_KEYS: Record<string, string> = { low: 'businessServices.low', medium: 'businessServices.medium', high: 'businessServices.high', critical: 'businessServices.critical' }

export function BusinessServices() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const { toast } = useToast()
  const [showModal, setShowModal] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, any>>({})

  // Asset link modal
  const [linkServiceId, setLinkServiceId] = useState<number | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<number>>(new Set())

  // Members modal (13/09: appartenance users↔services)
  const [membersServiceId, setMembersServiceId] = useState<number | null>(null)
  const [selectedMembers, setSelectedMembers] = useState<Map<number, boolean>>(new Map()) // user_id -> is_owner

  const { data, isLoading } = useQuery({
    queryKey: ['business-services'],
    queryFn: () => businessServicesApi.list().then(r => r.data),
  })
  const items: any[] = data?.items || []

  // Fetch linked assets when modal opens
  const { data: linkedAssetsData } = useQuery({
    queryKey: ['service-linked-assets', linkServiceId],
    queryFn: () => businessServicesApi.listAssets(linkServiceId!).then(r => r.data),
    enabled: linkServiceId !== null,
  })
  const linkedAssets: any[] = linkedAssetsData?.items || []

  // Fetch all CMDB assets for the picker
  const { data: allAssetsData } = useQuery({
    queryKey: ['cmdb-assets-for-services'],
    queryFn: () => cmdbGrcApi.listAssets({ status: 'active' }).then(r => r.data),
    enabled: linkServiceId !== null,
  })
  const allAssets: any[] = allAssetsData?.items || []

  // Members modal: fetch current members + all users when opened
  const { data: membersData } = useQuery({
    queryKey: ['service-members', membersServiceId],
    queryFn: () => serviceMembersApi.members(membersServiceId!).then(r => r.data),
    enabled: membersServiceId !== null,
  })
  const { data: allUsersData } = useQuery({
    queryKey: ['users-for-services'],
    queryFn: () => usersApi.list().then(r => {
      const d = r.data as any
      return Array.isArray(d) ? d : d.items || []
    }),
    enabled: membersServiceId !== null,
  })
  // Sync local state when members load
  const currentMembers: any[] = membersData?.members || []
  const allUsers: any[] = allUsersData || []
  if (membersServiceId !== null && currentMembers.length >= 0 && selectedMembers.size === 0 && membersData) {
    const m = new Map<number, boolean>()
    currentMembers.forEach((mm: any) => m.set(mm.user_id, !!mm.is_owner))
    setSelectedMembers(m)
  }

  const openMembers = (serviceId: number) => {
    setSelectedMembers(new Map())
    setMembersServiceId(serviceId)
  }

  const toggleMember = (userId: number, checked: boolean) => {
    const next = new Map(selectedMembers)
    if (checked) next.set(userId, false)
    else next.delete(userId)
    setSelectedMembers(next)
  }

  const toggleOwner = (userId: number, isOwner: boolean) => {
    setSelectedMembers(new Map(selectedMembers).set(userId, isOwner))
  }

  const saveMembers = async () => {
    if (!membersServiceId) return
    const currentMap = new Map(currentMembers.map((m: any) => [m.user_id, !!m.is_owner]))
    try {
      // additions
      for (const [uid, isOwner] of selectedMembers) {
        if (!currentMap.has(uid)) {
          await serviceMembersApi.addMember(membersServiceId, uid, isOwner)
        } else if (currentMap.get(uid) !== isOwner) {
          await serviceMembersApi.updateMember(membersServiceId, uid, isOwner)
        }
      }
      // removals
      for (const uid of currentMap.keys()) {
        if (!selectedMembers.has(uid)) {
          await serviceMembersApi.removeMember(membersServiceId, uid)
        }
      }
      toast('success', t('businessServices.membersUpdated'))
      qc.invalidateQueries({ queryKey: ['service-members', membersServiceId] })
      setMembersServiceId(null)
    } catch (e: any) {
      toast('error', e?.response?.data?.detail || 'Erreur')
    }
  }

  const createMut = useMutation({
    mutationFn: (d: Record<string, unknown>) => businessServicesApi.create(d),
    onSuccess: () => { toast('success', t('businessServices.created')); qc.invalidateQueries({ queryKey: ['business-services'] }); setShowModal(false); setForm({}) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => businessServicesApi.update(id, data),
    onSuccess: () => { toast('success', t('businessServices.updated')); qc.invalidateQueries({ queryKey: ['business-services'] }); setShowModal(false) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => businessServicesApi.delete(id),
    onSuccess: () => { toast('success', t('businessServices.deleted')); qc.invalidateQueries({ queryKey: ['business-services'] }); setDeleteId(null) },
    onError: (e: any) => toast('error', e?.response?.data?.detail || 'Erreur'),
  })
  const openCreate = () => { setForm({}); setEditId(null); setShowModal(true) }
  const openEdit = (item: any) => { setForm(item); setEditId(item.id); setShowModal(true) }
  const save = () => {
    if (editId) updateMut.mutate({ id: editId, data: form })
    else createMut.mutate(form)
  }

  const openLinkAssets = (serviceId: number) => {
    setLinkServiceId(serviceId)
    const linkedIds = new Set(linkedAssets.map((a: any) => a.id))
    setSelectedAssetIds(linkedIds)
  }

  const toggleAsset = (assetId: number) => {
    const next = new Set(selectedAssetIds)
    if (next.has(assetId)) next.delete(assetId)
    else next.add(assetId)
    setSelectedAssetIds(next)
  }

  const saveLinks = async () => {
    if (!linkServiceId) return
    const currentIds = new Set(linkedAssets.map((a: any) => a.id))
    const toAdd = [...selectedAssetIds].filter(id => !currentIds.has(id))
    const toRemove = [...currentIds].filter(id => !selectedAssetIds.has(id))

    try {
      for (const id of toAdd) {
        await businessServicesApi.linkAsset(linkServiceId, id)
      }
      for (const id of toRemove) {
        await businessServicesApi.unlinkAsset(linkServiceId, id)
      }
      toast('success', `${toAdd.length} asset(s) ajouté(s), ${toRemove.length} retiré(s)`)
      qc.invalidateQueries({ queryKey: ['service-linked-assets', linkServiceId] })
      qc.invalidateQueries({ queryKey: ['business-services'] })
      setLinkServiceId(null)
    } catch (e: any) {
      toast('error', t('businessServices.updateError'))
    }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 12px', fontSize: '14px', borderRadius: '8px', border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)', color: 'var(--color-text-primary)', outline: 'none', boxSizing: 'border-box' }
  const labelStyle: React.CSSProperties = { fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }


  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0 }}>{t('businessServices.title')}</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            {items.length} service(s) — base pour l'homologation ANSSI
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={openCreate}>{t('businessServices.new')}</Button>
      </div>

      {isLoading ? <div>Chargement...</div> : items.length === 0 ? (
        <div style={{ ...cardStyle, textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
          <Briefcase size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
          <div style={{ fontSize: '14px' }}>{t('businessServices.none')}</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>Créez vos services métier (Comptabilité, Logistique, RH...) pour préparer l'homologation</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {items.map((item) => (
            <div key={item.id} style={{ ...cardStyle, padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Briefcase size={16} style={{ color: 'var(--color-accent)' }} />
                  <span style={{ fontWeight: 600, fontSize: '14px' }}>{item.name}</span>
                  <Badge variant={CRIT_VARIANTS[item.criticality] || 'default'} size="sm">{t(CRIT_LABEL_KEYS[item.criticality] || item.criticality)}</Badge>
                </div>
                <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                  {item.description || '—'} · {item.asset_count} asset(s) lié(s)
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Button size="sm" variant="secondary" icon={<Users size={14} />} onClick={() => openMembers(item.id)}>
                  Membres
                </Button>
                <Button size="sm" variant="secondary" icon={<Link2 size={14} />} onClick={() => openLinkAssets(item.id)}>
                  Gérer les assets
                </Button>
                <button onClick={() => openEdit(item)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-info, #3b82f6)' }} title="Modifier"><Edit2 size={16} /></button>
                <button onClick={() => setDeleteId(item.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-danger)' }} title="Supprimer"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit service modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Modifier service' : t('businessServices.new')}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Nom du service" value={form.name || ''} onChange={(v: string) => setForm({ ...form, name: v })} required />
          <div>
            <label style={labelStyle}>{t('businessServices.description')}</label>
            <textarea value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('businessServices.criticality')}</label>
            <select value={form.criticality || 'medium'} onChange={(e) => setForm({ ...form, criticality: e.target.value })} style={inputStyle}>
              <option value="low">{t('businessServices.low')}</option>
              <option value="medium">{t('businessServices.medium')}</option>
              <option value="high">{t('businessServices.high')}</option>
              <option value="critical">{t('businessServices.critical')}</option>
            </select>
          </div>
          <Button onClick={save} disabled={!form.name}>{editId ? 'Mettre à jour' : 'Créer'}</Button>
        </div>
      </Modal>

      {/* Asset link modal */}
      <Modal open={linkServiceId !== null} onClose={() => setLinkServiceId(null)} title="Gérer les assets du service" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Cochez les assets à rattacher au service. Décochez pour les retirer.
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {allAssets.map((asset: any) => {
              const isSelected = selectedAssetIds.has(asset.id)
              const wasLinked = linkedAssets.some((a: any) => a.id === asset.id)
              return (
                <label key={asset.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                  borderRadius: '6px', cursor: 'pointer',
                  background: isSelected ? 'var(--color-bg-hover)' : 'var(--color-bg-tertiary)',
                  border: `1px solid ${isSelected ? 'var(--color-accent)' : 'var(--color-border)'}`,
                  transition: 'all 0.15s',
                }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleAsset(asset.id)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <Server size={14} style={{ color: 'var(--color-text-secondary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{asset.asset_name}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {asset.asset_type}{asset.hostname ? ` · ${asset.hostname}` : ''}{asset.tier_level && asset.tier_level !== 'Non_defini' ? ` · ${asset.tier_level}` : ''}
                    </div>
                  </div>
                  {wasLinked && !isSelected && (
                    <span style={{ fontSize: '11px', color: 'var(--color-danger)' }}>{t('businessServices.toRemove')}</span>
                  )}
                  {!wasLinked && isSelected && (
                    <span style={{ fontSize: '11px', color: 'var(--color-success)' }}>{t('businessServices.ToAdd')}</span>
                  )}
                </label>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setLinkServiceId(null)}>{t('businessServices.cancel')}</Button>
            <Button variant="primary" onClick={saveLinks}>{t('businessServices.save')}</Button>
          </div>
        </div>
      </Modal>

      {/* Members modal (13/09) */}
      <Modal open={membersServiceId !== null} onClose={() => setMembersServiceId(null)} title="Membres du service" size="lg">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
            Cochez les utilisateurs membres du service. Le bouton « Responsable » désigne qui dirige le service
            (ex. le RSSI est responsable du SSI). Les membres voient les livrables et exigences du service en lecture seule,
            et peuvent mettre à jour le statut des tâches qui leur sont assignées.
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {allUsers.filter((u: any) => u.is_active !== false).map((u: any) => {
              const isMember = selectedMembers.has(u.id)
              const isOwner = selectedMembers.get(u.id) === true
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px',
                  borderRadius: '6px',
                  background: isMember ? 'var(--color-bg-hover)' : 'var(--color-bg-tertiary)',
                  border: `1px solid ${isMember ? 'var(--color-accent)' : 'var(--color-border)'}`,
                }}>
                  <input
                    type="checkbox"
                    checked={isMember}
                    onChange={(e) => toggleMember(u.id, e.target.checked)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 500 }}>{u.display_name || u.username}</div>
                    <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                      {u.username} · rôle {u.role}{u.business_role ? ` · ${String(u.business_role).split('/').map((s: string) => s.trim()).join(', ')}` : ''}
                    </div>
                  </div>
                  {isMember && (
                    <Button size="sm" variant={isOwner ? 'primary' : 'secondary'} onClick={() => toggleOwner(u.id, !isOwner)}>
                      {isOwner ? '★ Responsable' : 'Responsable'}
                    </Button>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="secondary" onClick={() => setMembersServiceId(null)}>{t('businessServices.cancel')}</Button>
            <Button variant="primary" onClick={saveMembers}>{t('businessServices.save')}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={deleteId !== null} title="Supprimer" message="Confirmer la suppression de ce service ? Les liens avec les assets seront supprimés." onConfirm={() => deleteId && deleteMut.mutate(deleteId)} onCancel={() => setDeleteId(null)} />
    </div>
  )
}