import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from '../i18n/useTranslation'
import { usePermissions } from '../hooks/usePermissions'
import { useToast } from '../components/ui/Toast'
import { Card, StatCard, Badge, Button, Input, Select, Modal, Table, EmptyState } from '../components/ui'
import { usersApi, mfaPolicyApi, businessRolesApi } from '../api'
import { Users, Shield, CheckCircle, PenLine } from 'lucide-react'

// Splitte la chaîne multi-casquettes 'dsi / rssi' -> ['dsi','rssi']
function splitRoles(raw: unknown): string[] {
  const s = String(raw ?? '')
  return s.split('/').map((p) => p.trim()).filter(Boolean)
}

// Reconstruit 'dsi / rssi' depuis la sélection
function joinRoles(roles: string[]): string {
  const seen: string[] = []
  for (const r of roles) {
    const c = r.trim().toLowerCase()
    if (c && !seen.includes(c)) seen.push(c)
  }
  return seen.join(' / ')
}

export function UsersPage() {
  const { t } = useTranslation()
  const { canEdit } = usePermissions()
  const { toast } = useToast()
  const qc = useQueryClient()

  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editingUser, setEditingUser] = useState<Record<string, unknown> | null>(null)
  const [selectedUser, setSelectedUser] = useState<Record<string, unknown> | null>(null)

  // Create form
  const [formUsername, setFormUsername] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState('viewer')
  const [formPassword, setFormPassword] = useState('')
  const [formBusinessRoles, setFormBusinessRoles] = useState<string[]>([])

  // Edit form
  const [editDisplayName, setEditDisplayName] = useState('')
  const [editBusinessRoles, setEditBusinessRoles] = useState<string[]>([])
  const [editIsSignatory, setEditIsSignatory] = useState(false)
  const [editEmail, setEditEmail] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editRole, setEditRole] = useState('viewer')
  const [editPassword, setEditPassword] = useState('')
  const [editActive, setEditActive] = useState(true)
  const [editMfaEnabled, setEditMfaEnabled] = useState(false)
  const [editMfaSetupRequired, setEditMfaSetupRequired] = useState(false)
  const [roleChange, setRoleChange] = useState('')

  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then((r) => r.data),
  })

  const { data: roles } = useQuery({
    queryKey: ['users', 'roles'],
    queryFn: () => usersApi.getRoles().then((r) => r.data),
  })

  // Référentiel des casquettes métier (liste administrable, actives seules pour les formulaires)
  const { data: businessRolesRef } = useQuery({
    queryKey: ['business-roles', 'active'],
    queryFn: () => businessRolesApi.list(true).then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowCreate(false); resetForm(); toast('success', t('users.createSuccess')) },
    onError: () => toast('error', t('users.createError')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => usersApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setShowEdit(false); setEditingUser(null); toast('success', t('users.updateSuccess')) },
    onError: () => toast('error', t('users.updateError')),
  })

  function openEdit(u: Record<string, unknown>) {
    setEditingUser(u)
    setEditEmail(String(u.email ?? ''))
    setEditDisplayName(String(u.display_name ?? ''))
    setEditBusinessRoles(splitRoles((u as any).business_role))
    setEditIsSignatory(Boolean((u as any).is_signatory))
    setEditPhone(String(u.phone ?? ''))
    setEditRole(String(u.role ?? 'viewer'))
    setEditPassword('')
    setEditActive(Boolean(u.is_active !== false && u.is_active !== 'false'))
    setEditMfaEnabled(Boolean(u.mfa_enabled))
    setEditMfaSetupRequired(Boolean(u.mfa_setup_required))
    setShowEdit(true)
  }

  const roleMutation = useMutation({
    mutationFn: ({ id, role }: { id: number; role: string }) => usersApi.changeRole(id, role),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['users'] })
      setSelectedUser((prev) => (prev && Number(prev.id) === vars.id ? { ...prev, role: vars.role } : prev))
      setRoleChange(vars.role)
      toast('success', t('users.roleChangeSuccess'))
    },
    onError: () => toast('error', t('users.roleChangeError')),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => usersApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setSelectedUser(null); toast('success', t('users.deleteSuccess')) },
    onError: () => toast('error', t('users.deleteError')),
  })

  const mfaEnforceMutation = useMutation({
    mutationFn: (id: number) => mfaPolicyApi.enforceUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('success', t('mfa.enforceSuccess')) },
    onError: () => toast('error', t('mfa.enforceError')),
  })

  const mfaUnforceMutation = useMutation({
    mutationFn: (id: number) => mfaPolicyApi.unenforceUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); toast('success', t('mfa.unforceSuccess')) },
    onError: () => toast('error', t('mfa.unforceError')),
  })

  const mfaResetMutation = useMutation({
    mutationFn: (id: number) => mfaPolicyApi.resetUser(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setEditMfaEnabled(false); setEditMfaSetupRequired(false); toast('success', t('mfa.resetSuccess')) },
    onError: () => toast('error', t('mfa.resetError')),
  })

  function resetForm() {
    setFormUsername(''); setFormEmail(''); setFormRole('viewer'); setFormPassword(''); setFormBusinessRoles([])
  }

  const roleVariant = (r: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
    if (r === 'admin' || r === 'superadmin') return 'danger'
    if (r === 'analyst') return 'info'
    if (r === 'compliance_officer') return 'warning'
    return 'default'
  }

  // API returns [{role: "superadmin", permissions: [...]}], ... — extract role strings
  const rolesList = Array.isArray(roles)
    ? roles.map((r: Record<string, unknown>) => String(r.role ?? ''))
    : ['viewer', 'analyst', 'compliance_officer', 'admin', 'superadmin']

  const filteredUsers = ((users ?? []) as Record<string, unknown>[]).filter((u) => {
    const isActive = u.is_active === true || u.is_active === 'true' || u.status === 'active'
    if (roleFilter && u.role !== roleFilter) return false
    if (statusFilter === 'active' && !isActive) return false
    if (statusFilter === 'inactive' && isActive) return false
    return true
  })

  const totalUsers = filteredUsers.length
  const activeUsers = filteredUsers.filter((u) => u.is_active === true || u.is_active === 'true' || u.status === 'active').length
  const mfaEnabled = filteredUsers.filter((u) => u.mfa_enabled).length

  const columns = [
    { key: 'username', label: t('users.username') },
    { key: 'email', label: t('users.email') },
    { key: 'role', label: t('users.role') },
    { key: 'is_active', label: t('common.status') },
    { key: 'last_login_at', label: t('users.lastLogin') },
    { key: 'mfa_enabled', label: t('users.mfa') },
  ]

  function handleSaveEdit() {
    if (!editingUser) return
    const data: Record<string, unknown> = {
      email: editEmail,
      display_name: editDisplayName,
      phone: editPhone,
      role: editRole,
      is_active: editActive,
      mfa_setup_required: editMfaSetupRequired,
      business_role: joinRoles(editBusinessRoles) || undefined,
      is_signatory: editIsSignatory,
    }
    if (editPassword) {
      data.password = editPassword
    }
    updateMutation.mutate({ id: Number(editingUser.id), data })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>{t('users.title')}</h1>
        {canEdit('admin') && <Button onClick={() => setShowCreate(true)}>{t('users.createUser')}</Button>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        <StatCard label={t('users.totalUsers')} value={totalUsers} icon={<Users size={20} />} color="var(--color-accent)" loading={isLoading} />
        <StatCard label={t('users.activeUsers')} value={activeUsers} icon={<CheckCircle size={20} />} color="var(--color-success)" loading={isLoading} />
        <StatCard label={t('users.mfaEnabled')} value={mfaEnabled} icon={<Shield size={20} />} color="var(--color-info)" loading={isLoading} />
      </div>

      <Card>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ minWidth: '140px' }}>
            <Select label={t('users.role')} value={roleFilter} onChange={setRoleFilter} options={[{ label: t('common.all'), value: '' }, ...rolesList.map((r: string) => ({ label: r, value: r }))]} />
          </div>
          <div style={{ minWidth: '140px' }}>
            <Select label={t('common.status')} value={statusFilter} onChange={setStatusFilter} options={[{ label: t('common.all'), value: '' }, { label: t('common.active'), value: 'active' }, { label: t('common.inactive'), value: 'inactive' }]} />
          </div>
        </div>

        {filteredUsers.length === 0 && !isLoading && (
          <EmptyState title={t('users.noUsers')} />
        )}

        {(filteredUsers.length > 0 || isLoading) && (
          <Table
            columns={columns}
            data={filteredUsers}
            loading={isLoading}
            onRowClick={(row) => { setSelectedUser(row); setRoleChange(String(row.role ?? '')) }}
            renderCell={(col, row) => {
              if (col.key === 'role') return <Badge variant={roleVariant(String(row[col.key] ?? ''))}>{String(row[col.key] ?? '')}</Badge>
              if (col.key === 'is_active') {
                const isActive = row[col.key] === true || row[col.key] === 'true'
                return <Badge variant={isActive ? 'success' : 'default'}>{isActive ? t('common.active') : t('common.inactive')}</Badge>
              }
              if (col.key === 'mfa_enabled') return <Badge variant={row[col.key] ? 'success' : 'default'}>{row[col.key] ? t('common.yes') : t('common.no')}</Badge>
              if (col.key === 'last_login_at') return String(row[col.key] ?? '').replace('T', ' ').slice(0, 19)
              return String(row[col.key] ?? '')
            }}
          />
        )}
      </Card>

      {/* Create user modal */}
      {showCreate && canEdit('admin') && (
        <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('users.createUser')} footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>{t('common.cancel')}</Button>
            <Button onClick={() => createMutation.mutate({ username: formUsername, email: formEmail, role: formRole, password: formPassword, business_role: joinRoles(formBusinessRoles) || undefined })} disabled={!formUsername || !formEmail}>{t('common.create')}</Button>
          </>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('users.username')} value={formUsername} onChange={setFormUsername} required />
            <Input label={t('users.email')} value={formEmail} onChange={setFormEmail} type="email" required />
            <Select label={t('users.role')} value={formRole} onChange={setFormRole} options={rolesList.map((r: string) => ({ label: r, value: r }))} />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>Casquettes métier (Service / Direction — plusieurs possibles)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                {(businessRolesRef as any[] | undefined)?.map((br) => (
                  <label key={br.code} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '6px', border: formBusinessRoles.includes(br.code) ? '1px solid var(--color-accent)' : '1px solid transparent' }}>
                    <input
                      type="checkbox"
                      checked={formBusinessRoles.includes(br.code)}
                      onChange={(e) => setFormBusinessRoles((prev) => e.target.checked ? [...prev, br.code] : prev.filter((c) => c !== br.code))}
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    {br.label}
                  </label>
                ))}
              </div>
            </div>
            <Input label={t('users.password')} value={formPassword} onChange={setFormPassword} type="password" required />
          </div>
        </Modal>
      )}

      {/* User detail modal */}
      {selectedUser && (
        <Modal open={!!selectedUser} onClose={() => setSelectedUser(null)} title={t('users.userDetail')} size="lg">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('users.username')}</span><div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{String(selectedUser.username ?? '')}</div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('users.email')}</span><div style={{ color: 'var(--color-text-primary)' }}>{String(selectedUser.email ?? '')}</div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('users.displayName')}</span><div style={{ color: 'var(--color-text-primary)' }}>{String(selectedUser.display_name ?? '')}</div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('users.phone')}</span><div style={{ color: 'var(--color-text-primary)' }}>{String(selectedUser.phone ?? '—')}</div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('users.role')}</span><div><Badge variant={roleVariant(String(selectedUser.role ?? ''))}>{String(selectedUser.role ?? '')}</Badge></div></div>
              <div style={{ gridColumn: '1 / -1' }}><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>Casquettes métier</span><div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                {splitRoles(selectedUser.business_role).length === 0 ? <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>—</span> : splitRoles(selectedUser.business_role).map((c) => (
                  <Badge key={c} variant="info">{c}</Badge>
                ))}
              </div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('common.status')}</span><div><Badge variant={(selectedUser.is_active === true || selectedUser.is_active === 'true') ? 'success' : 'default'}>{(selectedUser.is_active === true || selectedUser.is_active === 'true') ? t('common.active') : t('common.inactive')}</Badge></div></div>
              <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('users.mfa')}</span><div><Badge variant={selectedUser.mfa_enabled ? 'success' : 'default'}>{selectedUser.mfa_enabled ? t('common.yes') : t('common.no')}</Badge></div></div>
              {String(selectedUser.role_expires_at ?? '') !== '' && (
                <div><span style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>{t('users.roleExpires')}</span><div style={{ color: 'var(--color-text-primary)' }}>{String(selectedUser.role_expires_at ?? '').replace('T', ' ').slice(0, 19)}</div></div>
              )}
            </div>

            {canEdit('admin') && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '4px' }}>{t('users.changeRole')}</h3>
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginBottom: '12px' }}>{t('users.changeRoleHint')}</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <Select label="" value={roleChange} onChange={setRoleChange} options={rolesList.map((r: string) => ({ label: r, value: r }))} />
                  <Button size="sm" onClick={() => roleMutation.mutate({ id: Number(selectedUser.id), role: roleChange })} disabled={!roleChange}>{t('users.changeRoleApply')}</Button>
                </div>
              </div>
            )}

            {canEdit('admin') && (
              <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '12px' }}>{t('mfa.title')}</h3>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {Boolean(selectedUser.mfa_enabled) ? (
                    <span style={{ fontSize: '13px', color: 'var(--color-success)', fontWeight: 500 }}>✓ {t('mfa.enabled')}</span>
                  ) : Boolean(selectedUser.mfa_setup_required) ? (
                    <Button size="sm" variant="danger" onClick={() => mfaUnforceMutation.mutate(Number(selectedUser.id))} disabled={mfaUnforceMutation.isPending}>
                      {t('mfa.removeRequirement')}
                    </Button>
                  ) : (
                    <Button size="sm" onClick={() => mfaEnforceMutation.mutate(Number(selectedUser.id))} disabled={mfaEnforceMutation.isPending}>
                      {t('mfa.forceSetup')}
                    </Button>
                  )}
                </div>
                {Boolean(selectedUser.mfa_enabled) && Boolean(selectedUser.mfa_setup_required) && (
                  <div style={{ marginTop: '8px' }}>
                    <Button size="sm" variant="secondary" onClick={() => mfaUnforceMutation.mutate(Number(selectedUser.id))} disabled={mfaUnforceMutation.isPending}>
                      {t('mfa.removeRequirement')}
                    </Button>
                  </div>
                )}
              </div>
            )}

            <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '16px', display: 'flex', gap: '8px' }}>
              <Button onClick={() => { const u = (users as Record<string, unknown>[] | undefined)?.find((x) => Number(x.id) === Number(selectedUser.id)) || selectedUser; setSelectedUser(null); openEdit(u); }}>{t('users.editUser')}</Button>
              {canEdit('admin') && (
                <Button variant="danger" onClick={() => deleteMutation.mutate(Number(selectedUser.id))}>{t('common.delete')}</Button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Edit user modal */}
      {showEdit && editingUser && (
        <Modal open={showEdit} onClose={() => { setShowEdit(false); setEditingUser(null) }} title={t('users.editUser')} size="lg" footer={
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>{t('common.save')}</Button>
            <Button variant="secondary" onClick={() => { setShowEdit(false); setEditingUser(null) }}>{t('common.cancel')}</Button>
          </div>
        }>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Input label={t('users.username')} value={String(editingUser.username ?? '')} onChange={() => {}} disabled />
            <Input label={t('users.email')} value={editEmail} onChange={setEditEmail} type="email" />
            <Input label={t('users.displayName')} value={editDisplayName} onChange={setEditDisplayName} />
            <Input label={t('users.phone')} value={editPhone} onChange={setEditPhone} type="tel" />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--color-text-secondary)', marginBottom: '4px', display: 'block' }}>Casquettes métier (Service / Direction — plusieurs possibles)</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '8px', background: 'var(--color-bg-secondary)', borderRadius: '8px', border: '1px solid var(--color-border)' }}>
                {(businessRolesRef as any[] | undefined)?.map((br) => (
                  <label key={br.code} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '13px', color: 'var(--color-text-primary)', padding: '4px 8px', borderRadius: '6px', border: editBusinessRoles.includes(br.code) ? '1px solid var(--color-accent)' : '1px solid transparent' }}>
                    <input
                      type="checkbox"
                      checked={editBusinessRoles.includes(br.code)}
                      onChange={(e) => setEditBusinessRoles((prev) => e.target.checked ? [...prev, br.code] : prev.filter((c) => c !== br.code))}
                      style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                    />
                    {br.label}
                  </label>
                ))}
              </div>
              {editBusinessRoles.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: '4px' }}>Aucune casquette — l'utilisateur n'est ni membre d'un service ni responsable métier.</div>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-primary)', padding: '4px 0' }}>
              <input
                type="checkbox"
                checked={editIsSignatory}
                onChange={(e) => setEditIsSignatory(e.target.checked)}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span>
                <PenLine size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Signataire — peut signer électroniquement les documents (fonction métier requise par le livrable)
              </span>
            </label>
            {canEdit('admin') && (
              <Select label={t('users.role')} value={editRole} onChange={setEditRole} options={rolesList.map((r: string) => ({ label: r, value: r }))} />
            )}
            <Input label={t('users.newPassword')} type="password" value={editPassword} onChange={setEditPassword} placeholder={t('users.passwordKeep')} />
            {canEdit('admin') && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" id="edit-active" checked={editActive} onChange={(e) => setEditActive(e.target.checked)} />
                <label htmlFor="edit-active" style={{ fontSize: '14px', color: 'var(--color-text-primary)', cursor: 'pointer' }}>{t('common.active')}</label>
              </div>
            )}
            {canEdit('admin') && (
              <div style={{ padding: '8px 12px', background: 'var(--color-bg-secondary)', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '14px', color: 'var(--color-text-primary)' }}>{t('mfa.title')}:</span>
                <Badge variant={editMfaEnabled ? 'success' : 'default'}>
                  {editMfaEnabled ? t('mfa.enabled') : t('mfa.disabled')}
                </Badge>
                <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                  ({t('mfa.userSetupHint')})
                </span>
              </div>
            )}
            {canEdit('admin') && editMfaEnabled && (
              <div style={{ padding: '8px 12px', background: 'var(--color-warning-bg, rgba(234,179,8,0.1))', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--color-text-primary)' }}>{t('mfa.resetDesc')}</span>
                <Button size="sm" variant="danger" onClick={() => { if (confirm(t('mfa.resetConfirm'))) mfaResetMutation.mutate(Number(editingUser.id)) }} disabled={mfaResetMutation.isPending}>
                  {t('mfa.reset')}
                </Button>
              </div>
            )}
            {editMfaSetupRequired && (
              <div style={{ fontSize: '12px', color: 'var(--color-warning)', padding: '8px', background: 'var(--color-warning-bg, rgba(234,179,8,0.1))', borderRadius: '4px' }}>
                ⚠ {t('mfa.setupRequiredDesc')}
              </div>
            )}
            {String(editingUser.role_expires_at ?? '') !== '' && (
              <Input label={t('users.roleExpires')} value={String(editingUser.role_expires_at ?? '').slice(0, 10)} onChange={() => {}} disabled />
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}